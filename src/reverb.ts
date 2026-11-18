import { lcgSigned } from './random.js';

/**
 * A short, soft room impulse response for a ConvolverNode: a 10 ms pre-delay, a tail that
 * darkens over time, and no discrete early reflections (which would add a comb-filter "ring").
 */
export function createRoomImpulse(ctx: BaseAudioContext, seconds = 0.6, seed = 777): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * seconds));
  const pre = Math.floor(0.01 * sr);
  const ir = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    const rnd = lcgSigned(seed + ch * 31);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const k = Math.min(0.95, 0.35 + t * 2.2); // the tail gets darker as it decays
      lp = lp * k + rnd() * (1 - k);
      d[i] = lp * 2.2 * Math.exp(-t * 10) * (t < 0.003 ? t / 0.003 : 1);
    }
  }
  return ir;
}
