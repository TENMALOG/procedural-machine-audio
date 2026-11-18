import { describe, expect, it } from 'vitest';
import { AIRFLOW_STYLES, AirflowVoice, getAirflowBuffers } from '../src/airflow';
import { MachineAudio } from '../src/engine';
import { createNoiseBank } from '../src/noise';
import { renderRecipe } from '../src/oneshot';
import { RECIPES } from '../src/recipes';
import { asCtx, FakeContext, type FakeNode } from './fakeAudio';

const rms = (d: Float32Array) => Math.sqrt(d.reduce((a, x) => a + x * x, 0) / d.length);

describe('noise bank', () => {
  it('is deterministic for a seed and loops without a jump', () => {
    const a = createNoiseBank(asCtx(new FakeContext()), 1, 42);
    const b = createNoiseBank(asCtx(new FakeContext()), 1, 42);
    for (const color of ['white', 'pink', 'brown'] as const) {
      const da = a[color].getChannelData(0), db = b[color].getChannelData(0);
      expect(da).toEqual(db);
      expect(rms(da)).toBeGreaterThan(0.01);
      // the step from the last sample back to the first is no bigger than a normal step inside the buffer
      let step = 0;
      for (let i = 1; i < da.length; i++) step += Math.abs(da[i] - da[i - 1]);
      step /= da.length - 1;
      expect(Math.abs(da[0] - da[da.length - 1]), color).toBeLessThan(step * 4);
      // no DC offset
      expect(Math.abs(da.reduce((s, x) => s + x, 0) / da.length), color).toBeLessThan(1e-6);
    }
  });
});

describe('built-in recipes', () => {
  it('every layer has a sane envelope and a broad (non-ringing) filter', () => {
    for (const [name, recipe] of Object.entries(RECIPES)) {
      expect(recipe.length, name).toBeGreaterThan(0);
      for (const l of recipe) {
        expect(l.gain, name).toBeGreaterThan(0);
        expect(l.gain, name).toBeLessThanOrEqual(1);
        expect(l.decay, name).toBeGreaterThan(0);
        expect(l.decay, name).toBeLessThan(0.5);
        if (l.kind === 'noise') expect(l.q, name).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it('renderRecipe schedules one source per layer and reports when it ends', () => {
    const ctx = new FakeContext();
    const noise = createNoiseBank(asCtx(ctx), 1);
    const out = ctx.createGain();
    const shot = renderRecipe(asCtx(ctx), out as unknown as AudioNode, noise, RECIPES.feed, { when: 2, gain: 0.5, jitter: 0, random: () => 0.5 });
    expect(shot.sources.length).toBe(RECIPES.feed.length);
    const second = shot.sources[1] as unknown as FakeNode;
    expect(second.started!.when).toBeCloseTo(2 + 0.045, 9); // the delayed layer
    expect(shot.end).toBeGreaterThan(2.045);
    // the layer envelope peaks at layer gain × trigger gain
    const gains = ctx.created.filter((n) => n.kind === 'gain' && n.gain.events.some((e) => e.type === 'linear'));
    expect(gains[0].gain.events.find((e) => e.type === 'linear')!.value).toBeCloseTo(0.3 * 0.5, 9);
  });
});

describe('airflow', () => {
  const SMALL = 1 << 14;

  it('normalises the body layer to an RMS of 0.25 for every style', () => {
    for (const style of Object.values(AIRFLOW_STYLES)) {
      const { body } = getAirflowBuffers(asCtx(new FakeContext()), style, SMALL);
      expect(rms(body.getChannelData(0))).toBeCloseTo(0.25, 3);
    }
  });

  it('the warm style has less high-frequency energy than the default', () => {
    // crude high-pass by first difference: more high frequencies → larger differences
    const hf = (style: (typeof AIRFLOW_STYLES)[keyof typeof AIRFLOW_STYLES]) => {
      const d = getAirflowBuffers(asCtx(new FakeContext()), style, SMALL).body.getChannelData(0);
      let s = 0;
      for (let i = 1; i < d.length; i++) s += (d[i] - d[i - 1]) ** 2;
      return s;
    };
    expect(hf(AIRFLOW_STYLES.warm)).toBeLessThan(hf(AIRFLOW_STYLES.smooth));
  });

  it('gets louder with speed and goes quiet when silenced', () => {
    const ctx = new FakeContext();
    const v = new AirflowVoice(asCtx(ctx), ctx.destination as unknown as AudioNode, { bufferLength: SMALL });
    const bodyGain = () => {
      const gains = ctx.created.filter((n) => n.kind === 'gain');
      return gains[1].gain.value; // [output, body, push, sum, panL, panR]
    };
    for (let i = 0; i < 60; i++) v.update(0, 1, (ctx.currentTime += 1 / 60));
    const still = bodyGain();
    for (let i = 0; i < 60; i++) v.update(1, 1, (ctx.currentTime += 1 / 60));
    const moving = bodyGain();
    expect(still).toBeGreaterThan(0); // the quiet constant bed
    expect(moving).toBeGreaterThan(still * 5);
    v.silence(ctx.currentTime);
    expect(bodyGain()).toBe(0);
  });
});

describe('MachineAudio', () => {
  const engine = () => {
    const ctx = new FakeContext();
    return { ctx, audio: new MachineAudio({ context: asCtx(ctx), noiseSeconds: 1 }) };
  };

  it('plays built-in recipes and skips unknown ones', () => {
    const { ctx, audio } = engine();
    const before = ctx.count('bufferSource');
    expect(audio.play('click')).toBe(true);
    expect(ctx.count('bufferSource')).toBe(before + 1);
    expect(audio.play('no-such-sound')).toBe(false);
  });

  it('merges identical triggers within a few milliseconds', () => {
    const { audio } = engine();
    expect(audio.play('click', { when: 1 })).toBe(true);
    expect(audio.play('click', { when: 1.003 })).toBe(false);
    expect(audio.play('click', { when: 1.1 })).toBe(true);
  });

  it('maps simulation events to recipes with bind/emit', () => {
    const { audio } = engine();
    audio.bind('PART_PLACED', { recipe: 'click', gain: 0.8 });
    expect(audio.emit('PART_PLACED')).toBe(true);
    expect(audio.emit('UNBOUND_EVENT')).toBe(false);
  });

  it('accepts custom recipes', () => {
    const { audio } = engine();
    audio.define('beep-free-knock', [{ kind: 'noise', noise: 'brown', freq: 200, q: 0.7, gain: 0.3, attack: 0.005, decay: 0.08 }]);
    expect(audio.play('beep-free-knock')).toBe(true);
  });

  it('creates one airflow voice per id and applies levels', () => {
    const { audio } = engine();
    const a = audio.airflow('arm', { bufferLength: 1 << 12 });
    expect(audio.airflow('arm')).toBe(a);
    audio.setLevel('airflow', 0.5);
    expect(audio.getLevel('airflow')).toBe(0.5);
  });

  it('a silent trigger is skipped', () => {
    const { audio } = engine();
    expect(audio.play('click', { gain: 0 })).toBe(false);
  });
});
