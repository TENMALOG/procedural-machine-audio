import { AirflowVoice, AIRFLOW_STYLES, type AirflowOptions } from './airflow.js';
import { pauseSilentSwitch, unlockSilentSwitch } from './iosSilentSwitch.js';
import { createNoiseBank, type NoiseBank } from './noise.js';
import { renderRecipe, type Recipe } from './oneshot.js';
import { RECIPES } from './recipes.js';
import { createRoomImpulse } from './reverb.js';
import { VoicePool, type PooledVoice } from './voicePool.js';

export interface MachineAudioOptions {
  /** Use an existing context (for example an OfflineAudioContext). Otherwise start() creates one. */
  context?: BaseAudioContext;
  /** Seconds added to "now" for every trigger, so sounds scheduled from the render loop never start late. */
  latency?: number;
  /** Maximum simultaneous one-shots. */
  maxVoices?: number;
  /** Reverb amount, 0 (dry) .. 1. */
  reverb?: number;
  /** Length of the shared noise buffers (seconds). */
  noiseSeconds?: number;
}

export interface PlayOptions {
  /** Exact context time. Overrides `delay`. */
  when?: number;
  /** Seconds from now (plus the engine latency). */
  delay?: number;
  /** Linear gain for this trigger (multiplied with the recipe and the events level). */
  gain?: number;
  /** Stereo position, −1 (left) .. 1 (right). */
  pan?: number;
  /** Triggers with the same key within a few milliseconds are merged. Defaults to the recipe name. */
  key?: string;
  /** Voice-pool category (each category has its own cap). Defaults to the recipe name. */
  category?: string;
}

export interface Binding {
  recipe: string;
  gain?: number;
  category?: string;
}

export type LevelName = 'master' | 'events' | 'airflow';

/**
 * A small mixer for procedural machine sounds.
 *
 *   one-shots ─┐                 ┌─ dry ──────────┐
 *              ├─ mix ───────────┤                ├─ master ─ limiter ─ speakers
 *   airflow ───┘                 └─ room reverb ──┘
 *
 * Call start() from a user gesture (browsers require one before audio can play).
 */
export class MachineAudio {
  readonly recipes: Record<string, Recipe> = { ...RECIPES };
  private ctx: BaseAudioContext | null;
  private noise: NoiseBank | null = null;
  private eventsBus!: GainNode;
  private airflowBus!: GainNode;
  private master!: GainNode;
  private dry!: GainNode;
  private limiter!: DynamicsCompressorNode;
  private wet!: GainNode;
  private readonly pool: VoicePool;
  private readonly bindings = new Map<string, Binding>();
  private readonly voices = new Map<string, { voice: AirflowVoice; panner: StereoPannerNode | null }>();
  private readonly latency: number;
  private readonly noiseSeconds: number;
  private reverbAmount: number;
  /**
   * Default balance (measured in the demo): at events 1.5 / airflow 0.3 the clicks peak clearly above a
   * soft, continuous airflow instead of being buried under it.
   */
  private levels: Record<LevelName, number> = { master: 0.8, events: 1.5, airflow: 0.3 };
  private live = 0;

  constructor(opt: MachineAudioOptions = {}) {
    this.ctx = opt.context ?? null;
    this.latency = opt.latency ?? 0.03;
    this.noiseSeconds = opt.noiseSeconds ?? 5;
    this.reverbAmount = opt.reverb ?? 0.12;
    this.pool = new VoicePool(opt.maxVoices ?? 48);
    if (this.ctx) this.build(this.ctx);
  }

  get context(): BaseAudioContext | null {
    return this.ctx;
  }

  /**
   * The final output (after the limiter). It is already connected to the speakers; connect an
   * AnalyserNode or a MediaStreamAudioDestinationNode to it for visualisers or recording.
   */
  get output(): AudioNode | null {
    return this.limiter ?? null;
  }

  /** True once there is a context to play into. */
  get ready(): boolean {
    return this.noise !== null;
  }

  /** Create (or resume) the audio context. Call this inside a click / tap handler. */
  async start(): Promise<void> {
    unlockSilentSwitch();
    if (!this.ctx) {
      const Ctor = (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
      if (!Ctor) throw new Error('Web Audio is not available in this environment');
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.build(this.ctx);
    }
    await this.resume();
  }

  /** Pause all audio processing (for example when the page is hidden). */
  async suspend(): Promise<void> {
    pauseSilentSwitch();
    const c = this.ctx as AudioContext | null;
    if (c && 'suspend' in c && c.state === 'running') await c.suspend();
  }

  async resume(): Promise<void> {
    unlockSilentSwitch();
    const c = this.ctx as AudioContext | null;
    if (c && 'resume' in c && c.state === 'suspended') await c.resume();
  }

  private build(ctx: BaseAudioContext) {
    this.noise = createNoiseBank(ctx, this.noiseSeconds);
    const limiter = (this.limiter = ctx.createDynamicsCompressor());
    limiter.threshold.value = -9;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    limiter.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(limiter);
    const mix = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = createRoomImpulse(ctx);
    mix.connect(this.dry).connect(this.master);
    mix.connect(conv).connect(this.wet).connect(this.master);
    this.eventsBus = ctx.createGain();
    this.airflowBus = ctx.createGain();
    this.eventsBus.connect(mix);
    this.airflowBus.connect(mix);
    this.applyLevels();
  }

  private applyLevels() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.levels.master, t, 0.05);
    this.eventsBus.gain.setTargetAtTime(this.levels.events, t, 0.05);
    this.airflowBus.gain.setTargetAtTime(this.levels.airflow, t, 0.05);
    this.wet.gain.setTargetAtTime(this.reverbAmount * 0.6, t, 0.05);
    this.dry.gain.setTargetAtTime(1 - this.reverbAmount * 0.3, t, 0.05);
  }

  setLevel(name: LevelName, value: number) {
    this.levels[name] = Math.max(0, value);
    this.applyLevels();
  }

  getLevel(name: LevelName): number {
    return this.levels[name];
  }

  setReverb(amount: number) {
    this.reverbAmount = Math.max(0, Math.min(1, amount));
    this.applyLevels();
  }

  /** Add or replace a named recipe. */
  define(name: string, recipe: Recipe) {
    this.recipes[name] = recipe;
  }

  /**
   * Play a recipe. Returns false when it was skipped (no context yet, unknown recipe, silent, or
   * merged with an identical trigger a few milliseconds earlier).
   */
  play(name: string, opt: PlayOptions = {}): boolean {
    const ctx = this.ctx;
    const recipe = this.recipes[name];
    if (!ctx || !this.noise || !recipe) return false;
    const gain = opt.gain ?? 1;
    if (gain <= 0.0005) return false;
    const when = opt.when ?? ctx.currentTime + this.latency + (opt.delay ?? 0);
    const key = opt.key ?? name;
    if (this.pool.shouldAggregate(key, when)) return false;

    const vg = ctx.createGain();
    let tail: AudioNode = vg;
    let panner: StereoPannerNode | null = null;
    if (opt.pan !== undefined && typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, opt.pan));
      vg.connect(panner);
      tail = panner;
    }
    tail.connect(this.eventsBus);
    const shot = renderRecipe(ctx, vg, this.noise, recipe, { when, gain });
    const nodes = [...shot.nodes, vg, ...(panner ? [panner] : [])];
    this.live += nodes.length;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      for (const n of nodes) n.disconnect();
      this.live -= nodes.length;
      this.pool.release(voice);
    };
    const voice: PooledVoice = {
      key,
      category: opt.category ?? name,
      start: when,
      end: shot.end,
      stop: (at: number) => {
        const t = Math.max(at, ctx.currentTime);
        vg.gain.cancelScheduledValues(t);
        vg.gain.setTargetAtTime(0, t, 0.004);
        for (const s of shot.sources) {
          try {
            s.stop(Math.max(t + 0.025, when));
          } catch {
            /* already stopped */
          }
        }
      },
    };
    let remaining = shot.sources.length;
    for (const s of shot.sources)
      s.onended = () => {
        if (--remaining <= 0) cleanup();
      };
    if (remaining === 0) cleanup();
    this.pool.add(voice, ctx.currentTime);
    return true;
  }

  /** Map an event name from your simulation to a recipe, so emit() can be used instead of play(). */
  bind(event: string, binding: string | Binding) {
    this.bindings.set(event, typeof binding === 'string' ? { recipe: binding } : binding);
  }

  /** Play the recipe bound to an event. Per-call gain multiplies the binding's gain. */
  emit(event: string, opt: PlayOptions = {}): boolean {
    const b = this.bindings.get(event);
    if (!b) return false;
    return this.play(b.recipe, { ...opt, gain: (b.gain ?? 1) * (opt.gain ?? 1), category: opt.category ?? b.category });
  }

  /**
   * Get (or create) a named airflow voice. Drive it every frame with
   * `airflow(id).update(speed01, level)`.
   */
  airflow(id = 'default', opt: AirflowOptions & { pan?: number } = {}): AirflowVoice {
    const hit = this.voices.get(id);
    if (hit) return hit.voice;
    const ctx = this.ctx;
    if (!ctx) throw new Error('Call start() before creating airflow voices');
    let dest: AudioNode = this.airflowBus;
    let panner: StereoPannerNode | null = null;
    if (opt.pan !== undefined && typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      panner.pan.value = opt.pan;
      panner.connect(this.airflowBus);
      dest = panner;
    }
    const voice = new AirflowVoice(ctx, dest, { style: opt.style ?? AIRFLOW_STYLES.smooth, ...opt });
    this.voices.set(id, { voice, panner });
    return voice;
  }

  /** Stop every one-shot and silence every airflow voice. */
  stopAll() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.pool.stopAll(t);
    for (const { voice } of this.voices.values()) voice.silence(t);
  }

  stats() {
    return { voices: this.pool.active.length, nodes: this.live, ...this.pool.stats };
  }

  dispose() {
    this.stopAll();
    for (const { voice, panner } of this.voices.values()) {
      voice.dispose();
      panner?.disconnect();
    }
    this.voices.clear();
    const c = this.ctx as AudioContext | null;
    if (c && 'close' in c) void c.close();
  }
}
