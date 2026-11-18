import { describe, expect, it } from 'vitest';
import { EventScheduler } from '../src/scheduler';
import { planMove, sampleMove } from '../src/motion';
import { VoicePool, type PooledVoice } from '../src/voicePool';

describe('EventScheduler', () => {
  it('pops in time order and keeps insertion order for equal times', () => {
    const s = new EventScheduler<string>();
    s.schedule(2, 'c');
    s.schedule(1, 'a');
    s.schedule(1, 'b');
    s.schedule(0.5, 'first');
    expect([s.pop(), s.pop(), s.pop(), s.pop()].map((x) => x!.payload)).toEqual(['first', 'a', 'b', 'c']);
    expect(s.pop()).toBeUndefined();
  });

  it('drains everything due up to a time', () => {
    const s = new EventScheduler<number>();
    for (const t of [5, 1, 3, 2, 4]) s.schedule(t, t);
    expect(s.drainUntil(3).map((i) => i.payload)).toEqual([1, 2, 3]);
    expect(s.size).toBe(2);
  });

  it('is deterministic for many random items', () => {
    const run = () => {
      const s = new EventScheduler<number>();
      let seed = 7;
      for (let i = 0; i < 500; i++) {
        seed = (seed * 16807) % 2147483647;
        s.schedule(Math.floor((seed / 2147483647) * 50), i);
      }
      return s.drainUntil(Infinity).map((x) => x.payload);
    };
    const a = run();
    expect(a).toEqual(run());
    expect(a.length).toBe(500);
  });
});

describe('motion profiles', () => {
  const lim = { vmax: 1000, amax: 10000 };
  for (const kind of ['trapezoid', 'scurve'] as const) {
    it(`${kind}: starts and ends at rest, covers the distance, respects limits`, () => {
      const p = planMove(400, lim, kind);
      expect(sampleMove(p, 0).v).toBe(0);
      expect(sampleMove(p, p.duration).s).toBeCloseTo(400, 6);
      let vmax = 0, amax = 0, last = 0;
      for (let i = 1; i < 2000; i++) {
        const s = sampleMove(p, (p.duration * i) / 2000);
        vmax = Math.max(vmax, s.v);
        amax = Math.max(amax, Math.abs(s.a));
        expect(s.s).toBeGreaterThanOrEqual(last - 1e-9); // never goes backwards
        last = s.s;
      }
      expect(vmax).toBeLessThanOrEqual(lim.vmax + 1e-6);
      expect(amax).toBeLessThanOrEqual(lim.amax + 1e-6);
    });
  }

  it('short moves become triangular and never reach top speed', () => {
    const p = planMove(10, lim, 'scurve');
    expect(p.tc).toBe(0);
    expect(p.vpeak).toBeLessThan(lim.vmax);
  });

  it('s-curve acceleration is zero at both ends', () => {
    const p = planMove(400, lim, 'scurve');
    expect(Math.abs(sampleMove(p, 1e-6).a)).toBeLessThan(1);
    expect(Math.abs(sampleMove(p, p.duration - 1e-6).a)).toBeLessThan(1);
  });

  it('zero distance is a zero-length move', () => {
    expect(planMove(0, lim).duration).toBe(0);
  });
});

describe('VoicePool', () => {
  const voice = (key: string, category: string, start: number, stops: number[]): PooledVoice => ({
    key, category, start, end: start + 0.1, stop: (at) => stops.push(at),
  });

  it('merges a repeated key inside the window but not outside it', () => {
    const pool = new VoicePool(8, 0.006, 8);
    pool.add(voice('k', 'c', 1, []), 1);
    expect(pool.shouldAggregate('k', 1.004)).toBe(true);
    expect(pool.shouldAggregate('k', 1.01)).toBe(false);
    expect(pool.shouldAggregate('other', 1.001)).toBe(false);
  });

  it('steals the oldest voice when full, and respects the per-category cap', () => {
    const stops: number[] = [];
    const pool = new VoicePool(3, 0.006, 2);
    pool.add(voice('a', 'x', 0, stops), 0);
    pool.add(voice('b', 'x', 0.01, stops), 0.01);
    pool.add(voice('c', 'x', 0.02, stops), 0.02); // category x is capped at 2
    expect(pool.active.map((v) => v.key)).toEqual(['b', 'c']);
    pool.add(voice('d', 'y', 0.03, stops), 0.03);
    pool.add(voice('e', 'y', 0.04, stops), 0.04); // pool capped at 3
    expect(pool.active.length).toBe(3);
    expect(pool.stats.stolen).toBe(2);
  });
});
