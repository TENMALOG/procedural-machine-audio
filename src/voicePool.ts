/**
 * Voice pool: caps the number of simultaneous one-shots, steals the oldest when full, and merges
 * repeated triggers of the same key that arrive within a few milliseconds (which would otherwise
 * stack into a loud click when a fast machine fires many identical events at once).
 */
export interface PooledVoice {
  key: string;
  category: string;
  start: number;
  end: number;
  stop(at: number): void;
}

export class VoicePool {
  readonly active: PooledVoice[] = [];
  private lastStart = new Map<string, number>();
  readonly stats = { started: 0, aggregated: 0, stolen: 0, released: 0 };

  constructor(
    public maxVoices = 48,
    /** Seconds within which a repeated key is merged into the previous voice. */
    public aggregateWindow = 0.006,
    /** Per-category cap, so one long or busy category cannot take the whole pool. */
    public maxPerCategory = 14,
  ) {}

  /** True if a voice with this key started within the aggregate window (the caller should skip it). */
  shouldAggregate(key: string, when: number): boolean {
    const last = this.lastStart.get(key);
    if (last !== undefined && Math.abs(when - last) < this.aggregateWindow) {
      this.stats.aggregated++;
      return true;
    }
    return false;
  }

  add(v: PooledVoice, now: number) {
    this.prune(now);
    const same = this.active.filter((x) => x.category === v.category);
    if (same.length >= this.maxPerCategory) {
      const oldest = same[0];
      this.active.splice(this.active.indexOf(oldest), 1);
      oldest.stop(now);
      this.stats.stolen++;
    }
    while (this.active.length >= this.maxVoices) {
      this.active.shift()!.stop(now);
      this.stats.stolen++;
    }
    this.active.push(v);
    this.lastStart.set(v.key, v.start);
    this.stats.started++;
    if (this.lastStart.size > 512) this.lastStart.clear();
  }

  release(v: PooledVoice) {
    const i = this.active.indexOf(v);
    if (i >= 0) {
      this.active.splice(i, 1);
      this.stats.released++;
    }
  }

  /** Drop voices that ended more than half a second ago (in case their release was missed). */
  prune(now: number) {
    for (let i = this.active.length - 1; i >= 0; i--) if (this.active[i].end < now - 0.5) this.active.splice(i, 1);
  }

  stopAll(at: number) {
    for (const v of this.active.splice(0)) v.stop(at);
    this.lastStart.clear();
  }
}
