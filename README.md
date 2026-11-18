# procedural-machine-audio

**English** · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [Tiếng Việt](README.vi.md)

**A procedural audio engine for interactive machines and simulations.**

**▶ Live demo: [pma.rewrite.tw](https://pma.rewrite.tw/)** (headphones recommended)

Small mechanical sounds — clicks, soft hisses, pneumatic thuds, the airflow of a fast-moving arm — generated live with the Web Audio API. There are no audio files: every sound is filtered noise shaped by data, driven by what your simulation is actually doing.

- **Event → sound.** Map your simulation's events to sound recipes, then `emit()` them.
- **Motion → airflow.** Feed the speed of a moving part every frame; the airflow voice swells, brightens and pushes with it.
- **Built for long listening.** Broad, non-ringing filters, no melodies, a voice pool that merges bursts of identical events, and a limiter on the output — it stays pleasant for hours.
- **Tiny.** No runtime dependencies. Written in TypeScript with full types.

This engine was extracted from **[QM-4 · The sound of a machine](https://qm4.rewrite.tw/)**, a 3D simulator of a fictional pick-and-place machine made for listening. The demo here is deliberately minimal (a 2D gantry made of rectangles); the full experience lives on that site.

## Quick start

```ts
import { MachineAudio, planMove, sampleMove } from 'procedural-machine-audio';

const audio = new MachineAudio();

// 1. Audio can only start after a user gesture
startButton.onclick = () => audio.start();

// 2. Map your simulation's events to built-in (or your own) recipes
audio.bind('PART_PLACED', { recipe: 'click', gain: 0.9 });
audio.bind('VACUUM_ON', 'hiss');

simulation.on('PART_PLACED', (e) => audio.emit('PART_PLACED', { pan: e.x }));

// 3. Drive the airflow of a moving part every frame
function frame() {
  const speed01 = head.speed / head.maxSpeed; // 0 = still, 1 = full speed
  if (audio.ready) audio.airflow('head').update(speed01, 1);
  requestAnimationFrame(frame);
}
```

## Run the demo locally

```bash
npm install
npm run dev        # opens the demo at http://localhost:5320
npm test           # unit tests
npm run build      # library → dist/
npm run build:demo # static demo → dist-demo/
```

Requires Node.js 20 or newer. Headphones recommended.

## API

### `new MachineAudio(options?)`

| option | default | |
|---|---|---|
| `context` | — | Use an existing `AudioContext` / `OfflineAudioContext`. Otherwise `start()` creates one. |
| `latency` | `0.03` | Seconds added to "now" for every trigger, so sounds scheduled from a render loop never start late. |
| `maxVoices` | `48` | Maximum simultaneous one-shots. |
| `reverb` | `0.12` | Room amount, 0–1. |

| method | |
|---|---|
| `start()` | Create / resume the audio context. Call it inside a click or tap handler. Also lets sound play with the iPhone silent switch on. |
| `play(name, { when?, delay?, gain?, pan?, key?, category? })` | Play a recipe. Returns `false` if skipped (unknown, silent, or merged with an identical trigger a few ms earlier). |
| `bind(event, recipe \| { recipe, gain?, category? })` / `emit(event, options?)` | Map simulation events to recipes. |
| `define(name, recipe)` | Add your own recipe. |
| `airflow(id, { style?, pan? })` | Get or create a named airflow voice. Call `.update(speed01, level)` every frame, `.setStyle()` to change it, `.silence()` to stop. |
| `setLevel('master' \| 'events' \| 'airflow', value)`, `setReverb(amount)` | Mixing. |
| `output` | The final node (after the limiter) for analysers or `MediaRecorder`. |
| `suspend()` / `resume()` / `stopAll()` / `dispose()` | Lifecycle. |

### Built-in recipes

`click` · `tap` · `lift` · `hiss` · `leak` · `puff` · `feed` · `clamp` · `unclamp` · `shutter` · `swap` · `settle`

### Airflow styles

`AIRFLOW_STYLES.smooth` (default) · `warm` (darker, softer) · `airy` (lighter) · `slow` (slow swells)

### Writing your own recipe

A recipe is plain data: a list of layers. Each layer is band-passed noise or a short tone with its own envelope.

```ts
audio.define('latch', [
  { kind: 'noise', noise: 'pink', freq: 1400, q: 0.8, lowpass: 3500, gain: 0.5, attack: 0.004, decay: 0.04 },
  { kind: 'noise', noise: 'brown', freq: 220, q: 0.7, lowpass: 600, gain: 0.25, attack: 0.008, decay: 0.12, delay: 0.03 },
]);
audio.play('latch');
```

Tips that keep sounds pleasant over long sessions: keep `q` low (≈0.6–1.5), add a `lowpass`, give noise layers at least a few milliseconds of `attack`, and avoid long tonal layers.

### Lower-level building blocks

Everything the engine uses is exported, so you can build your own graph:

| export | |
|---|---|
| `renderRecipe(ctx, destination, noise, recipe, { when, gain })` | Schedule a recipe into any node. |
| `AirflowVoice`, `getAirflowBuffers`, `AIRFLOW_STYLES` | The airflow synthesizer and its FFT-shaped loop buffers. |
| `createNoiseBank(ctx, seconds, seed)` | Seeded, seamlessly looping white / pink / brown noise. |
| `createRoomImpulse(ctx)` | A short soft room impulse response for a `ConvolverNode`. |
| `VoicePool` | Voice cap, oldest-voice stealing and burst merging. |
| `EventScheduler` | Deterministic (time, insertion-order) event queue for simulations. |
| `planMove`, `sampleMove` | Trapezoid / S-curve move profiles, to drive airflow with physically plausible speed. |

## How the airflow works

Two looping noise layers are built once with an inverse FFT (so they loop seamlessly):

- **body** — noise with a broad spectral curve; its level follows speed² over a quiet constant bed, and the whole spectrum glides up with speed.
- **push** — a Gaussian band of low noise (not a resonance) whose centre rises with speed. It has a faster envelope than the body, so every move begins with a soft push.

A high shelf opens slightly later than the body ("air"), and the image drifts gently in stereo. No oscillators and no resonant filters are involved, so nothing rings or whistles.

## Status

`0.1.0` — early. The API may still change. Not yet published to npm.

## Author

Made by **TENMALOG** · Full experience: [qm4.rewrite.tw](https://qm4.rewrite.tw/)

## License

[MIT](LICENSE) © 2026 TENMALOG

The MIT License covers the code in this repository only. The QM-4 website, its 3D models, characters, artwork and tuned sounds are separate works and are not included.
