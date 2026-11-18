import { lcgUnit } from './random.js';

/**
 * Airflow voice: the continuous "whoosh" of a fast-moving machine part, driven every frame by its
 * speed. There are no oscillators and no resonant filters: only noise shaped by broad spectral
 * curves, so it never rings or whistles.
 *
 * Two looping noise layers, built once per style with an FFT so they loop seamlessly:
 *  - body:  noise with the style's spectrum; its loudness follows speed² over a constant quiet bed,
 *           and the whole spectrum glides up with speed (via playback rate)
 *  - push:  a Gaussian band of low noise (not a resonance) whose centre rises with speed; it has a
 *           faster envelope than the body, so every move starts with a soft "push"
 * plus a high-shelf "air" that opens slightly later than the body, and a gentle stereo drift.
 */
export interface AirflowStyle {
  id: string;
  /** Body spectrum as [frequency Hz, level dB] points, interpolated on a log-frequency axis. */
  spectrum: readonly (readonly [number, number])[];
  /** How far (octaves) the body spectrum glides up between standstill and full speed. */
  shiftOct: number;
  /** Envelope rise / fall times (s) for body, push, air and push-centre followers. */
  bodyUp: number; bodyDn: number; pushUp: number; pushDn: number; airUp: number; airDn: number; centreUp: number; centreDn: number;
  /** Constant airflow while standing still (0..1 of full level). */
  bed: number;
  /** How strongly the air shelf reacts when air leads or lags the body. */
  airGain: number;
  /** Push band centre at standstill / full speed (Hz) and its width (octaves, Gaussian sigma). */
  pushF0: number; pushF1: number; pushWidth: number;
  /** Correlation between left and right noise (0 = independent, 1 = mono). */
  stereoCorrelation: number;
  /** Stereo drift with speed (0..1). */
  pan: number;
  /** Above kneeHz the body falls by kneeSlope dB per octave; below 600 Hz it yields pushYield dB to the push layer. */
  kneeHz: number; kneeSlope: number; pushYield: number;
  /** Air shelf frequency (Hz) and maximum boost (dB). */
  shelfHz: number; shelfMax: number;
  /** Level of each layer. */
  bodyGain: number; pushGain: number;
}

/**
 * Default body spectrum: a broad hump around 1.6 kHz with a gentle roll-off on both sides.
 * Designed for this library (it is not taken from any recording).
 */
const NEUTRAL_SPECTRUM = [
  [100, -30], [160, -20], [250, -13], [400, -9], [630, -7], [1000, -4], [1600, 0], [2500, -3],
  [4000, -7], [6300, -12], [10000, -20], [14000, -26],
] as const;

const SMOOTH: AirflowStyle = {
  id: 'smooth', spectrum: NEUTRAL_SPECTRUM, shiftOct: 0.6,
  bodyUp: 0.15, bodyDn: 0.25, pushUp: 0.09, pushDn: 0.18, airUp: 0.22, airDn: 0.2, centreUp: 0.06, centreDn: 0.1,
  bed: 0.08, airGain: 0.6, pushF0: 200, pushF1: 600, pushWidth: 0.55, stereoCorrelation: 0.8, pan: 0.12,
  kneeHz: 4000, kneeSlope: 4, pushYield: 6, shelfHz: 5000, shelfMax: 9, bodyGain: 1, pushGain: 1,
};

/** Ready-made styles. All of them stay within about 1 dB of the default loudness. */
export const AIRFLOW_STYLES = {
  /** Balanced default. */
  smooth: SMOOTH,
  /** Darker and softer: highs roll off early, the push is lower and thicker. */
  warm: { ...SMOOTH, id: 'warm', shiftOct: 0.35, bed: 0.12, airGain: 0.2, pushF0: 160, pushF1: 420, pushWidth: 0.65, kneeHz: 2500, kneeSlope: 7, bodyGain: 0.85, pushGain: 1.4 },
  /** Lighter: the push steps back and the low mids make room. */
  airy: { ...SMOOTH, id: 'airy', shiftOct: 0.65, bed: 0.05, airGain: 0.7, pushF0: 240, pushF1: 680, kneeHz: 3800, kneeSlope: 4.5, pushYield: 10, shelfMax: 5, pushGain: 0.6 },
  /** Slow swells: envelopes twice as slow, mostly low push. */
  slow: {
    ...SMOOTH, id: 'slow', shiftOct: 0.3, bodyUp: 0.3, bodyDn: 0.5, pushUp: 0.2, pushDn: 0.4, airUp: 0.4, airDn: 0.4, centreUp: 0.15, centreDn: 0.25,
    bed: 0.12, airGain: 0.1, pushF0: 150, pushF1: 340, pushWidth: 0.7, kneeHz: 3000, kneeSlope: 6, bodyGain: 0.65, pushGain: 1.5,
  },
} satisfies Record<string, AirflowStyle>;

const pushCentre = (s: AirflowStyle) => Math.sqrt(s.pushF0 * s.pushF1);

/** In-place radix-2 inverse FFT (length must be a power of two). */
function ifftInPlace(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/** Seamlessly looping noise with a given magnitude spectrum and random phases. */
export function shapedNoise(n: number, sampleRate: number, magnitude: (hz: number) => number, random: () => number): Float32Array {
  const re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n / 2; k++) {
    const m = magnitude((k * sampleRate) / n);
    const ph = 2 * Math.PI * random();
    re[k] = m * Math.cos(ph); im[k] = m * Math.sin(ph);
    re[n - k] = re[k]; im[n - k] = -im[k];
  }
  ifftInPlace(re, im);
  return re;
}

/** Body spectrum of a style as a linear magnitude function. */
export function bodyMagnitude(style: AirflowStyle): (hz: number) => number {
  const pts = style.spectrum;
  const lx = pts.map(([f]) => Math.log2(f));
  return (f: number) => {
    if (f < 60) return 0;
    const x = Math.log2(Math.max(f, 20));
    let db: number;
    if (x <= lx[0]) db = pts[0][1] - 30;
    else if (x >= lx[lx.length - 1]) db = pts[pts.length - 1][1] - 6;
    else {
      let i = 1;
      while (lx[i] < x) i++;
      const t = (x - lx[i - 1]) / (lx[i] - lx[i - 1]);
      db = pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1]);
    }
    db -= (style.pushYield * Math.min(2, Math.max(0, Math.log2(600 / Math.max(f, 150))))) / 2;
    db -= style.kneeSlope * Math.max(0, Math.log2(f / style.kneeHz));
    return Math.pow(10, db / 20);
  };
}

/** Push layer as a linear magnitude function (a Gaussian band on a log-frequency axis). */
export function pushMagnitude(style: AirflowStyle): (hz: number) => number {
  const c = pushCentre(style);
  return (f: number) => (f < 110 ? 0 : Math.exp(-0.5 * Math.pow(Math.log2(Math.max(f, 1) / c) / style.pushWidth, 2)));
}

export interface AirflowBuffers {
  body: AudioBuffer;
  push: AudioBuffer;
}

const cache = new WeakMap<BaseAudioContext, Map<string, AirflowBuffers>>();

/**
 * Build (or reuse) the two stereo noise layers for a style. Both layers are scaled by the same
 * factor so that the body has an RMS of 0.25, keeping the designed balance between them.
 * `length` must be a power of two; the default (2^19) is about 11 s at 48 kHz.
 */
export function getAirflowBuffers(ctx: BaseAudioContext, style: AirflowStyle = SMOOTH, length = 1 << 19, seed = 20261117): AirflowBuffers {
  let byStyle = cache.get(ctx);
  if (!byStyle) cache.set(ctx, (byStyle = new Map()));
  const key = `${style.id}:${length}:${seed}`;
  const hit = byStyle.get(key);
  if (hit) return hit;
  const sr = ctx.sampleRate;
  const rnd = lcgUnit(seed);
  const ind = Math.sqrt(1 - style.stereoCorrelation * style.stereoCorrelation);
  const make = (mag: (f: number) => number) => {
    const c = shapedNoise(length, sr, mag, rnd), l = shapedNoise(length, sr, mag, rnd), r = shapedNoise(length, sr, mag, rnd);
    const buf = ctx.createBuffer(2, length, sr);
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    for (let i = 0; i < length; i++) {
      L[i] = style.stereoCorrelation * c[i] + ind * l[i];
      R[i] = style.stereoCorrelation * c[i] + ind * r[i];
    }
    return buf;
  };
  const body = make(bodyMagnitude(style));
  const push = make(pushMagnitude(style));
  let s = 0;
  const bl = body.getChannelData(0);
  for (let i = 0; i < length; i++) s += bl[i] * bl[i];
  const k = 0.25 / Math.sqrt(s / length || 1);
  for (const buf of [body, push]) for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) d[i] *= k;
  }
  const out = { body, push };
  byStyle.set(key, out);
  return out;
}

export interface AirflowOptions {
  style?: AirflowStyle;
  /** Noise buffer length (power of two). Shorter builds faster; longer hides the loop better. */
  bufferLength?: number;
  /** Output trim applied on top of `level` in update(). */
  trim?: number;
}

export class AirflowVoice {
  readonly output: GainNode;
  private style: AirflowStyle;
  private body!: AudioBufferSourceNode;
  private push!: AudioBufferSourceNode;
  private readonly bodyGain: GainNode;
  private readonly pushGain: GainNode;
  private readonly airShelf: BiquadFilterNode;
  private readonly panL: GainNode;
  private readonly panR: GainNode;
  private eBody = 0;
  private ePush = 0;
  private eAir = 0;
  private eCentre = 0;
  private lastAt = -1;
  private readonly bufferLength: number;
  private readonly trim: number;

  constructor(private readonly ctx: BaseAudioContext, destination: AudioNode, opt: AirflowOptions = {}) {
    this.style = opt.style ?? SMOOTH;
    this.bufferLength = opt.bufferLength ?? 1 << 19;
    this.trim = opt.trim ?? 0.56;
    this.output = ctx.createGain();
    this.output.connect(destination);
    this.airShelf = ctx.createBiquadFilter();
    this.airShelf.type = 'highshelf';
    this.airShelf.gain.value = 0;
    this.bodyGain = ctx.createGain();
    this.bodyGain.gain.value = 0;
    this.pushGain = ctx.createGain();
    this.pushGain.gain.value = 0;
    const sum = ctx.createGain();
    const split = ctx.createChannelSplitter(2);
    const merge = ctx.createChannelMerger(2);
    this.panL = ctx.createGain();
    this.panR = ctx.createGain();
    this.airShelf.connect(this.bodyGain).connect(sum);
    this.pushGain.connect(sum);
    sum.connect(split);
    split.connect(this.panL, 0).connect(merge, 0, 0);
    split.connect(this.panR, 1).connect(merge, 0, 1);
    merge.connect(this.output);
    this.startSources();
  }

  get currentStyle(): AirflowStyle {
    return this.style;
  }

  private startSources() {
    const { body, push } = getAirflowBuffers(this.ctx, this.style, this.bufferLength);
    const loop = (buf: AudioBuffer, to: AudioNode) => {
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.connect(to);
      s.start(this.ctx.currentTime, Math.random() * buf.duration); // random start: several voices never align
      return s;
    };
    this.body = loop(body, this.airShelf);
    this.push = loop(push, this.pushGain);
    this.airShelf.frequency.value = this.style.shelfHz;
  }

  private stopSources() {
    for (const s of [this.body, this.push]) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
      s.disconnect();
    }
  }

  /** Switch style. The voice goes silent for one frame and comes back on the next update(). */
  setStyle(style: AirflowStyle) {
    if (style === this.style) return;
    const t = this.ctx.currentTime;
    for (const g of [this.bodyGain, this.pushGain]) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(0, t);
    }
    this.eBody = this.ePush = this.eAir = this.eCentre = 0;
    this.stopSources();
    this.style = style;
    this.startSources();
  }

  /**
   * Call once per frame.
   * @param speed normalised speed of the moving part, 0 (still) .. 1 (full speed)
   * @param level output level (linear)
   * @param at    context time of this frame (usually ctx.currentTime)
   */
  update(speed: number, level: number, at: number = this.ctx.currentTime) {
    const c = this.style;
    const v = Math.max(0, Math.min(1, speed));
    const dt = this.lastAt < 0 ? 0.016 : Math.max(0.001, Math.min(0.1, at - this.lastAt));
    this.lastAt = at;
    const follow = (s: number, up: number, dn: number) => {
      const k = Math.exp(-dt / (v > s ? up : dn));
      return k * s + (1 - k) * v;
    };
    this.eBody = follow(this.eBody, c.bodyUp, c.bodyDn);
    this.ePush = follow(this.ePush, c.pushUp, c.pushDn);
    this.eAir = follow(this.eAir, c.airUp, c.airDn);
    this.eCentre = follow(this.eCentre, c.centreUp, c.centreDn);
    const L = level * this.trim;
    const tc = 0.02;
    this.bodyGain.gain.setTargetAtTime(L * c.bodyGain * (c.bed + (1 - c.bed) * this.eBody * this.eBody), at, tc);
    this.pushGain.gain.setTargetAtTime(L * c.pushGain * this.ePush * this.ePush, at, tc);
    this.body.playbackRate.setTargetAtTime(Math.pow(2, (this.eBody - 0.5) * c.shiftOct), at, tc);
    this.push.playbackRate.setTargetAtTime((c.pushF0 * Math.pow(c.pushF1 / c.pushF0, this.eCentre)) / pushCentre(c), at, tc);
    const air = 1 + (c.airGain * (this.eAir - this.eBody)) / (this.eBody + 0.05);
    this.airShelf.gain.setTargetAtTime(Math.max(-12, Math.min(c.shelfMax, 20 * Math.log10(Math.max(0.1, air)))), at, tc);
    const pan = c.pan * (2 * this.eBody - 1);
    this.panL.gain.setTargetAtTime(Math.sqrt(1 - pan), at, tc);
    this.panR.gain.setTargetAtTime(Math.sqrt(1 + pan), at, tc);
  }

  /** Fade to silence (for example when the machine stops). */
  silence(at: number = this.ctx.currentTime) {
    for (const g of [this.bodyGain, this.pushGain]) {
      g.gain.cancelScheduledValues(at);
      g.gain.setTargetAtTime(0, at, 0.15);
    }
    this.eBody = this.ePush = this.eAir = this.eCentre = 0;
    this.lastAt = -1;
  }

  dispose() {
    this.stopSources();
    this.output.disconnect();
  }
}
