/**
 * One-dimensional move profiles, useful for driving AirflowVoice with physically plausible speed.
 *  - trapezoid: constant acceleration, constant speed, constant deceleration
 *  - scurve:    cosine-shaped acceleration (zero at both ends, finite jerk)
 * Short moves automatically become triangular (they never reach top speed).
 */
export interface MotionLimits {
  /** Maximum speed (units per second). */
  vmax: number;
  /** Maximum acceleration (units per second²). */
  amax: number;
}

export type ProfileKind = 'trapezoid' | 'scurve';

export interface MoveProfile {
  kind: ProfileKind;
  distance: number;
  duration: number;
  /** Acceleration (and deceleration) time. */
  ta: number;
  /** Constant-speed time. */
  tc: number;
  vpeak: number;
  apeak: number;
}

export interface MoveSample {
  /** Distance travelled. */
  s: number;
  /** Speed. */
  v: number;
  /** Acceleration (negative while braking). */
  a: number;
}

export function planMove(distance: number, lim: MotionLimits, kind: ProfileKind = 'scurve'): MoveProfile {
  const d = Math.abs(distance);
  if (d < 1e-9) return { kind, distance: 0, duration: 0, ta: 0, tc: 0, vpeak: 0, apeak: 0 };
  // With a = (v/ta)(1 − cos(2πτ/ta)) the peak is twice the average, so average = amax / 2
  const aAvg = kind === 'scurve' ? lim.amax / 2 : lim.amax;
  let ta = lim.vmax / aAvg;
  let vpeak = lim.vmax;
  let tc: number;
  if (vpeak * ta >= d) {
    vpeak = Math.sqrt(d * aAvg);
    ta = vpeak / aAvg;
    tc = 0;
  } else {
    tc = (d - vpeak * ta) / vpeak;
  }
  const apeak = kind === 'scurve' ? (2 * vpeak) / ta : vpeak / ta;
  return { kind, distance: d, duration: 2 * ta + tc, ta, tc, vpeak, apeak };
}

/** Sample a move at time t (0..duration). */
export function sampleMove(p: MoveProfile, t: number): MoveSample {
  if (p.duration === 0 || t <= 0) return { s: 0, v: 0, a: 0 };
  if (t >= p.duration) return { s: p.distance, v: 0, a: 0 };
  const { ta, tc, vpeak } = p;
  const accel = (tau: number): MoveSample => {
    if (p.kind === 'trapezoid') {
      const a = vpeak / ta;
      return { s: 0.5 * a * tau * tau, v: a * tau, a };
    }
    const x = tau / ta;
    const v = vpeak * (x - Math.sin(2 * Math.PI * x) / (2 * Math.PI));
    const s = vpeak * ta * ((x * x) / 2 + (Math.cos(2 * Math.PI * x) - 1) / (4 * Math.PI * Math.PI));
    const a = (vpeak / ta) * (1 - Math.cos(2 * Math.PI * x));
    return { s, v, a };
  };
  if (t < ta) return accel(t);
  const sa = accel(ta).s;
  if (t < ta + tc) return { s: sa + vpeak * (t - ta), v: vpeak, a: 0 };
  const r = accel(p.duration - t);
  return { s: p.distance - r.s, v: r.v, a: -r.a };
}
