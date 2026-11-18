/**
 * Small seeded pseudo-random generators. Everything in this library that needs
 * randomness at build time (noise buffers, impulse responses) is seeded, so the
 * same seed always produces the same sound.
 */

/** Linear congruential generator returning floats in [-1, 1). */
export function lcgSigned(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2147483648 - 1;
  };
}

/** Linear congruential generator returning floats in [0, 1). */
export function lcgUnit(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
