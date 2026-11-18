import type { NoiseBank, NoiseColor } from './noise.js';

/**
 * One-shot sounds are described as data: a recipe is a list of layers, and each layer is either
 * a filtered noise burst or a short (optionally gliding) tone, each with its own envelope.
 * Describing sounds as data keeps them easy to tweak, test and analyse offline.
 */

/** Band-passed noise with an attack / exponential-decay envelope. */
export interface NoiseLayer {
  kind: 'noise';
  noise: NoiseColor;
  /** Band-pass centre frequency (Hz). */
  freq: number;
  /** Band-pass Q. Keep it low (about 0.6–1.5) for broad, non-ringing textures. */
  q: number;
  /** Optional low-pass after the band-pass (Hz) to tame sharp transients. */
  lowpass?: number;
  /** Optional band-pass sweep target (Hz), reached at the end of the decay. */
  sweepTo?: number;
  /** Peak gain of this layer (before the trigger gain). */
  gain: number;
  /** Seconds from silence to peak. */
  attack: number;
  /** Seconds from peak to −80 dB. Roughly a third of it is audible. */
  decay: number;
  /** Seconds after the trigger time. */
  delay?: number;
}

/** A short sine (or other waveform) blip, optionally gliding in pitch. */
export interface ToneLayer {
  kind: 'tone';
  wave?: OscillatorType;
  freq: number;
  sweepTo?: number;
  gain: number;
  attack?: number;
  decay: number;
  delay?: number;
  lowpass?: number;
}

export type Layer = NoiseLayer | ToneLayer;
export type Recipe = readonly Layer[];

/** Everything a one-shot created, so the caller can stop it early or disconnect it when done. */
export interface PlayedSound {
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  /** Context time when the last layer has finished. */
  end: number;
}

export interface RenderOptions {
  /** Context time to start at. */
  when: number;
  /** Multiplies every layer's gain. */
  gain?: number;
  /**
   * Random detune of filter frequencies per trigger (fraction, e.g. 0.06 = ±6%), so repeated
   * triggers do not sound like a machine gun. 0 = identical every time.
   */
  jitter?: number;
  /** Random source for jitter and noise offsets (defaults to Math.random). */
  random?: () => number;
}

const DEFAULT_ATTACK = 0.0008;

/** Schedule a recipe into `out`. Returns the nodes it created. */
export function renderRecipe(ctx: BaseAudioContext, out: AudioNode, noise: NoiseBank, recipe: Recipe, opt: RenderOptions): PlayedSound {
  const rnd = opt.random ?? Math.random;
  const gain = opt.gain ?? 1;
  const j = 1 + (rnd() - 0.5) * 2 * (opt.jitter ?? 0.06);
  const shot: PlayedSound = { sources: [], nodes: [], end: opt.when };
  for (const layer of recipe) {
    const when = opt.when + (layer.delay ?? 0);
    if (layer.kind === 'noise') noiseLayer(ctx, out, noise, shot, layer, when, gain, j, rnd);
    else toneLayer(ctx, out, shot, layer, when, gain, j);
  }
  return shot;
}

function envelope(g: GainNode, when: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(peak, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
}

function lowpassNode(ctx: BaseAudioContext, hz: number) {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = hz;
  lp.Q.value = -3; // Web Audio low-pass Q is in dB: −3 dB = no resonant peak
  return lp;
}

function noiseLayer(ctx: BaseAudioContext, out: AudioNode, noise: NoiseBank, shot: PlayedSound, l: NoiseLayer, when: number, gain: number, j: number, rnd: () => number) {
  const src = ctx.createBufferSource();
  src.buffer = noise[l.noise];
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = l.freq * j;
  bp.Q.value = l.q;
  const attack = l.attack ?? DEFAULT_ATTACK;
  if (l.sweepTo) {
    bp.frequency.setValueAtTime(l.freq * j, when);
    bp.frequency.exponentialRampToValueAtTime(l.sweepTo * j, when + attack + l.decay);
  }
  const g = ctx.createGain();
  envelope(g, when, l.gain * gain, attack, l.decay);
  let last: AudioNode = src.connect(bp);
  shot.nodes.push(src, bp, g);
  if (l.lowpass) {
    const lp = lowpassNode(ctx, l.lowpass);
    last = last.connect(lp);
    shot.nodes.push(lp);
  }
  last.connect(g).connect(out);
  const dur = attack + l.decay + 0.01;
  // Start from a random point in the noise buffer so consecutive hits are not identical
  const buf = noise[l.noise];
  src.start(when, rnd() * Math.max(0, buf.duration - dur), dur);
  shot.sources.push(src);
  shot.end = Math.max(shot.end, when + dur);
}

function toneLayer(ctx: BaseAudioContext, out: AudioNode, shot: PlayedSound, l: ToneLayer, when: number, gain: number, j: number) {
  const o = ctx.createOscillator();
  o.type = l.wave ?? 'sine';
  o.frequency.setValueAtTime(l.freq * j, when);
  if (l.sweepTo) o.frequency.exponentialRampToValueAtTime(l.sweepTo, when + l.decay);
  const g = ctx.createGain();
  const attack = l.attack ?? 0.001;
  envelope(g, when, l.gain * gain, attack, l.decay);
  let last: AudioNode = o;
  shot.nodes.push(o, g);
  if (l.lowpass) {
    const lp = lowpassNode(ctx, l.lowpass);
    last = o.connect(lp);
    shot.nodes.push(lp);
  }
  last.connect(g).connect(out);
  const end = when + attack + l.decay + 0.01;
  o.start(when);
  o.stop(end);
  shot.sources.push(o);
  shot.end = Math.max(shot.end, end);
}
