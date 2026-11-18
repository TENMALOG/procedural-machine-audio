/**
 * A tiny stand-in for the Web Audio API, enough to run the library in Node:
 * buffers hold real sample data (so buffer generation can be measured), and every node records
 * the parameter automation it receives (so scheduling can be checked).
 */
export class FakeParam {
  value: number;
  events: { type: string; value: number; time: number }[] = [];
  constructor(v = 0) {
    this.value = v;
  }
  setValueAtTime(value: number, time: number) {
    this.events.push({ type: 'set', value, time });
    this.value = value;
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: 'linear', value, time });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: 'exp', value, time });
    return this;
  }
  setTargetAtTime(value: number, time: number) {
    this.events.push({ type: 'target', value, time });
    this.value = value;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

export class FakeNode {
  kind: string;
  outputs: FakeNode[] = [];
  disconnected = false;
  started: { when: number; offset?: number; duration?: number } | null = null;
  stopped: number | null = null;
  onended: (() => void) | null = null;
  buffer: FakeBuffer | null = null;
  loop = false;
  type = '';
  gain = new FakeParam(1);
  frequency = new FakeParam(350);
  Q = new FakeParam(1);
  pan = new FakeParam(0);
  playbackRate = new FakeParam(1);
  detune = new FakeParam(0);
  threshold = new FakeParam(-24);
  knee = new FakeParam(30);
  ratio = new FakeParam(12);
  attack = new FakeParam(0.003);
  release = new FakeParam(0.25);
  constructor(kind: string) {
    this.kind = kind;
  }
  connect(target: FakeNode) {
    this.outputs.push(target);
    return target;
  }
  disconnect() {
    this.disconnected = true;
  }
  start(when = 0, offset?: number, duration?: number) {
    this.started = { when, offset, duration };
  }
  stop(when = 0) {
    this.stopped = when;
  }
  setAttribute() {}
}

export class FakeBuffer {
  readonly channels: Float32Array[];
  constructor(readonly numberOfChannels: number, readonly length: number, readonly sampleRate: number) {
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  get duration() {
    return this.length / this.sampleRate;
  }
  getChannelData(ch: number) {
    return this.channels[ch];
  }
}

export class FakeContext {
  sampleRate: number;
  currentTime = 0;
  state = 'running';
  destination = new FakeNode('destination');
  created: FakeNode[] = [];
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
  }
  private make(kind: string) {
    const n = new FakeNode(kind);
    this.created.push(n);
    return n;
  }
  createBuffer(ch: number, len: number, sr: number) {
    return new FakeBuffer(ch, len, sr);
  }
  createGain() { return this.make('gain'); }
  createBiquadFilter() { return this.make('biquad'); }
  createBufferSource() { return this.make('bufferSource'); }
  createOscillator() { return this.make('oscillator'); }
  createStereoPanner() { return this.make('stereoPanner'); }
  createConvolver() { return this.make('convolver'); }
  createDynamicsCompressor() { return this.make('compressor'); }
  createChannelSplitter() { return this.make('splitter'); }
  createChannelMerger() { return this.make('merger'); }
  count(kind: string) {
    return this.created.filter((n) => n.kind === kind).length;
  }
}

/** Cast helper: the library takes a BaseAudioContext. */
export const asCtx = (c: FakeContext) => c as unknown as BaseAudioContext;
