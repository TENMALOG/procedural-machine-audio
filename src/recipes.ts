import type { Recipe } from './oneshot.js';

/**
 * Built-in one-shot recipes for small mechanical actions.
 * Design rules used for all of them: broad filtered noise (low Q, plus a low-pass) rather than
 * resonators, short envelopes, and at most a very quiet low tone for "weight". Nothing rings,
 * nothing is tonal enough to read as a melody, so they stay pleasant when repeated for hours.
 */
export const RECIPES = {
  /** A firm, small contact click (a tool touching down). */
  click: [
    { kind: 'noise', noise: 'white', freq: 3800, q: 0.9, gain: 0.3, attack: 0.0008, decay: 0.007 },
    { kind: 'tone', freq: 170, sweepTo: 95, gain: 0.06, decay: 0.016 },
  ],
  /** A lighter, brighter tap. */
  tap: [
    { kind: 'noise', noise: 'white', freq: 4200, q: 0.9, gain: 0.32, attack: 0.0008, decay: 0.006 },
    { kind: 'tone', freq: 210, sweepTo: 120, gain: 0.05, decay: 0.014 },
  ],
  /** A tiny tick when something lifts away. */
  lift: [{ kind: 'noise', noise: 'white', freq: 2800, q: 1.2, gain: 0.14, attack: 0.0008, decay: 0.005 }],
  /** A short soft hiss (vacuum on). */
  hiss: [{ kind: 'noise', noise: 'pink', freq: 2600, q: 0.7, lowpass: 5500, gain: 0.35, attack: 0.006, decay: 0.06 }],
  /** A longer leak hiss. */
  leak: [{ kind: 'noise', noise: 'pink', freq: 2200, q: 0.6, lowpass: 5000, gain: 0.35, attack: 0.012, decay: 0.24 }],
  /** A low, short puff of released air. */
  puff: [{ kind: 'noise', noise: 'pink', freq: 1500, q: 0.7, lowpass: 4000, gain: 0.4, attack: 0.005, decay: 0.05 }],
  /** A tiny motor rustle followed by a detent click (a feeder advancing one step). */
  feed: [
    { kind: 'noise', noise: 'pink', freq: 900, q: 0.8, lowpass: 2500, gain: 0.3, attack: 0.006, decay: 0.05 },
    { kind: 'noise', noise: 'pink', freq: 1800, q: 1.0, lowpass: 4000, gain: 0.6, attack: 0.005, decay: 0.03, delay: 0.045 },
  ],
  /** A soft low thud with a little exhaust (a pneumatic clamp closing). */
  clamp: [
    { kind: 'noise', noise: 'brown', freq: 190, q: 0.7, lowpass: 500, gain: 0.28, attack: 0.012, decay: 0.2 },
    { kind: 'noise', noise: 'pink', freq: 1100, q: 0.6, lowpass: 2800, gain: 0.07, attack: 0.03, decay: 0.28, delay: 0.02 },
  ],
  /** Exhaust first, then a lighter low knock (a clamp opening). */
  unclamp: [
    { kind: 'noise', noise: 'pink', freq: 1000, q: 0.6, lowpass: 2800, gain: 0.1, attack: 0.025, decay: 0.24 },
    { kind: 'noise', noise: 'brown', freq: 170, q: 0.7, lowpass: 450, gain: 0.22, attack: 0.012, decay: 0.16, delay: 0.06 },
  ],
  /** A soft shutter-like "tk". */
  shutter: [
    { kind: 'noise', noise: 'pink', freq: 2200, q: 1.0, lowpass: 4500, gain: 0.6, attack: 0.005, decay: 0.024, delay: 0.015 },
    { kind: 'noise', noise: 'pink', freq: 3000, q: 0.8, lowpass: 5000, gain: 0.15, attack: 0.008, decay: 0.07, delay: 0.02 },
  ],
  /** Two light mechanical knocks, low then higher (a tool being swapped). */
  swap: [
    { kind: 'noise', noise: 'pink', freq: 700, q: 0.9, lowpass: 2200, gain: 0.8, attack: 0.006, decay: 0.05 },
    { kind: 'noise', noise: 'pink', freq: 1100, q: 0.9, lowpass: 3000, gain: 0.64, attack: 0.006, decay: 0.045, delay: 0.17 },
  ],
  /** A barely audible servo settle at the end of a move. */
  settle: [{ kind: 'noise', noise: 'white', freq: 900, q: 0.8, gain: 0.04, attack: 0.0008, decay: 0.01 }],
} satisfies Record<string, Recipe>;

export type BuiltInRecipe = keyof typeof RECIPES;
