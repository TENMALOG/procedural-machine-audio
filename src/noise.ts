import { lcgSigned } from './random.js';

/** Three loopable mono noise buffers that every recipe draws from. */
export interface NoiseBank {
  white: AudioBuffer;
  pink: AudioBuffer;
  brown: AudioBuffer;
}

export type NoiseColor = keyof NoiseBank;

/**
 * Write `fill`-generated noise into `out` so that it loops without a click, and remove DC.
 * The noise is generated `fade` samples longer than needed; the extra tail is cross-faded into the
 * first `fade` samples, and the buffer starts right after them. The last sample therefore flows into
 * the first one exactly as it did in the original continuous noise.
 */
function makeLoopable(out: Float32Array, fill: (d: Float32Array) => void, fade = 2048) {
  const n = Math.max(1, Math.min(fade, Math.floor(out.length / 4)));
  const ext = new Float32Array(out.length + n);
  fill(ext);
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    const k = out.length + i;
    ext[k] = ext[k] * (1 - t) + ext[i] * t;
  }
  let mean = 0;
  for (let i = n; i < ext.length; i++) mean += ext[i];
  mean /= out.length;
  for (let i = 0; i < out.length; i++) out[i] = ext[i + n] - mean;
}

/**
 * Create white, pink and brown noise buffers.
 * Pink noise uses Paul Kellet's refined filter; brown noise is leaky-integrated white noise.
 */
export function createNoiseBank(ctx: BaseAudioContext, seconds = 5, seed = 12345): NoiseBank {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const rnd = lcgSigned(seed);
  const make = (fill: (d: Float32Array) => void) => {
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    makeLoopable(b.getChannelData(0), fill);
    return b;
  };
  const white = make((d) => {
    for (let i = 0; i < d.length; i++) d[i] = rnd();
  });
  const pink = make((d) => {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = rnd();
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  });
  const brown = make((d) => {
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * rnd()) / 1.02;
      d[i] = last * 3.5;
    }
  });
  return { white, pink, brown };
}
