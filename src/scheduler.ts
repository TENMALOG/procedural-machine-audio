/**
 * Deterministic event scheduler: a binary heap ordered by (time, insertion order).
 * Items with the same time come out in the order they were added, so a simulation driven by it
 * produces the same event sequence on every run, independent of frame rate.
 */
export interface ScheduledItem<T> {
  t: number;
  seq: number;
  payload: T;
}

export class EventScheduler<T> {
  private heap: ScheduledItem<T>[] = [];
  private seq = 0;

  get size() {
    return this.heap.length;
  }

  schedule(t: number, payload: T): ScheduledItem<T> {
    const item = { t, seq: this.seq++, payload };
    const h = this.heap;
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(h[p], h[i])) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
    return item;
  }

  peek(): ScheduledItem<T> | undefined {
    return this.heap[0];
  }

  pop(): ScheduledItem<T> | undefined {
    const h = this.heap;
    if (h.length === 0) return undefined;
    const top = h[0];
    const last = h.pop()!;
    if (h.length > 0) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && this.less(h[l], h[m])) m = l;
        if (r < h.length && this.less(h[r], h[m])) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  }

  /** Pop every item with t <= time, in order. */
  drainUntil(time: number): ScheduledItem<T>[] {
    const out: ScheduledItem<T>[] = [];
    while (this.heap.length && this.heap[0].t <= time) out.push(this.pop()!);
    return out;
  }

  clear() {
    this.heap = [];
  }

  private less(a: ScheduledItem<T>, b: ScheduledItem<T>) {
    return a.t < b.t || (a.t === b.t && a.seq < b.seq);
  }
}
