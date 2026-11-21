<div align="center">

# procedural-machine-audio

**English** · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [Tiếng Việt](README.vi.md)

A Web Audio engine that synthesizes the sounds of machines in real time:<br>
clicks, pneumatic hisses, clamps and the airflow of a fast-moving arm.<br>
It is a synthesizer, not a sample player: everything is generated, and no audio files are used.

[Live demo](https://pma.rewrite.tw/) · [Quick start](#quick-start) · [API](#api-reference) · [How it works](#how-the-airflow-works)

[![MIT License](https://img.shields.io/badge/license-MIT-2b313a?style=flat-square)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-2b313a?style=flat-square)
![Runtime dependencies: 0](https://img.shields.io/badge/runtime%20deps-0-2b313a?style=flat-square)
![Status: 0.1 preview](https://img.shields.io/badge/status-0.1%20preview-2b313a?style=flat-square)

<a href="https://pma.rewrite.tw/"><img src="docs/media/demo.gif" alt="Demo: a gantry head moving between targets on a grid" width="720"></a>

<sub>The GIF is silent. Listen in the <a href="https://pma.rewrite.tw/">live demo</a> or the <a href="docs/media/demo.mp4">12-second clip with sound</a>. Headphones recommended.</sub>

</div>

## Why

Simulations, digital twins and machine visualisations usually ship without sound, or with a handful of samples that repeat every few seconds. This library generates the sound from the simulation itself:

- **Events become sounds.** Bind simulation events (`PART_PLACED`, `VACUUM_ON`, …) to short sound *recipes* and call `emit()`.
- **Motion becomes airflow.** Pass the normalised speed of a moving part every frame; the airflow swells, brightens and pushes with each move.
- **Built to avoid fatigue.** Broad, non-resonant filters, no melodies, merging of near-identical triggers and an output limiter keep long sessions free of harsh, ringing sounds.

**At a glance:** 12 built-in recipes · 4 airflow styles · custom recipes as plain data · recording and offline rendering · zero runtime dependencies.

The engine was extracted from [QM-4 · The sound of a machine](https://qm4.rewrite.tw/), a 3D simulator of a fictional pick-and-place machine made for listening.

## Install

The package is not published to npm yet. Install it from GitHub; it compiles itself during installation:

```bash
npm install github:TENMALOG/procedural-machine-audio
```

Because the package is built during installation, this requires Node.js 20 or newer.

It ships as an ES module with TypeScript type definitions. Import it through a bundler such as Vite, webpack or esbuild, or through an import map; no CDN build is provided.

## Quick start

The smallest working example plays one click when a button is pressed. With this button on the page:

```html
<button id="play">Play</button>
```

the script is:

```ts
import { MachineAudio } from 'procedural-machine-audio';

const audio = new MachineAudio();

document.querySelector('#play')!.addEventListener('click', async () => {
  await audio.start(); // browsers only allow audio after a user gesture
  audio.play('click');
});
```

Pressing the button plays one short, soft click.

A typical integration binds simulation events and drives the airflow every frame. `startButton`, `simulation`, `head` and `halfWidth` stand for things in your own application:

```ts
import { MachineAudio } from 'procedural-machine-audio';

const audio = new MachineAudio();

// 1. Start audio from a user gesture.
startButton.addEventListener('click', () => void audio.start());

// 2. Map simulation events to built-in (or your own) recipes.
audio.bind('PART_PLACED', { recipe: 'click', gain: 0.9 });
audio.bind('VACUUM_ON', 'hiss');

// pan expects −1 (left) … 1 (right), so normalise your coordinates.
simulation.on('PART_PLACED', (e) => audio.emit('PART_PLACED', { pan: e.x / halfWidth }));

// 3. Drive the airflow of a moving part once per frame.
//    airflow() needs a context, so wait until audio.ready is true.
function frame() {
  const speed01 = head.speed / head.maxSpeed; // 0 = still, 1 = full speed
  if (audio.ready) audio.airflow('head').update(speed01, 1);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 4. Pause audio processing while the page is hidden.
document.addEventListener('visibilitychange', () => {
  if (!audio.ready) return;
  if (document.hidden) audio.suspend();
  else audio.resume();
});
```

## API reference

### `new MachineAudio(options?)`

| Option | Default | Description |
|---|---|---|
| `context` | — | An existing `AudioContext` or `OfflineAudioContext`. If omitted, `start()` creates one. |
| `latency` | `0.03` | Seconds added to the current time for every trigger, so sounds scheduled from a render loop never start late. |
| `maxVoices` | `48` | Maximum number of simultaneous one-shots. When the limit is reached, the oldest voice is stopped. |
| `reverb` | `0.12` | Room reverb amount, from 0 (dry) to 1. |
| `noiseSeconds` | `5` | Length of the shared noise buffers, in seconds. |

### Methods and properties

| Member | Returns | Description |
|---|---|---|
| `start()` | `Promise<void>` | Creates or resumes the audio context. Call it inside a click or tap handler. On iOS it also requests media playback so the silent switch does not mute the page (see [Browser support](#browser-support)). |
| `play(name, options?)` | `boolean` | Plays a recipe. Returns `false` if the sound was skipped: no context yet, unknown recipe, zero gain, or merged with a trigger of the same `key` a few milliseconds earlier. |
| `bind(event, binding)` | `void` | Maps an event name to a recipe name, or to a `Binding` object `{ recipe, gain?, category? }`. |
| `emit(event, options?)` | `boolean` | Plays the recipe bound to `event`. The per-call `gain` multiplies the bound gain; the binding's `category` is used unless the call sets one. |
| `define(name, recipe)` | `void` | Registers a custom recipe, or replaces a built-in one. |
| `airflow(id?, options?)` | `AirflowVoice` | Returns the airflow voice called `id` (default `'default'`), creating it on first use. **Throws** if there is no context yet, so call it after `start()` or check `ready`. See [Airflow voices](#airflow-voices) for options. |
| `setLevel(bus, value)` / `getLevel(bus)` | `void` / `number` | Linear level of the `'master'` (default `0.8`), `'events'` (`1.5`) or `'airflow'` (`0.3`) bus. |
| `setReverb(amount)` | `void` | Changes the reverb amount, clamped to 0–1. |
| `output` | `AudioNode \| null` | The final node, after the limiter; `null` until there is a context. It is already connected to the speakers; connect an `AnalyserNode` or a `MediaStreamAudioDestinationNode` for visualisation or recording. |
| `context` | `BaseAudioContext \| null` | The audio context in use. |
| `ready` | `boolean` | `true` once there is a context to play into. |
| `stats()` | object | `{ voices, nodes, started, aggregated, stolen, released }`, for debugging. |
| `recipes` | object | The recipes currently registered, by name. |
| `suspend()` / `resume()` | `Promise<void>` | Pause and resume audio processing, for example when the page is hidden. |
| `stopAll()` / `dispose()` | `void` | Stop every one-shot and fade out every airflow voice; release every node and close the context. |

Options for `play()` and `emit()`:

| Option | Description |
|---|---|
| `when` | Absolute context time to start at. Overrides `delay`. |
| `delay` | Seconds from now (plus `latency`). |
| `gain` | Linear gain multiplier. |
| `pan` | Stereo position, from −1 (left) to 1 (right). |
| `key` | Triggers with the same key within about 6 ms are merged into one. Defaults to the recipe name. |
| `category` | Voices in one category are capped at 14 (not configurable through `MachineAudio` in 0.1), so a busy sound cannot use up the whole pool. Defaults to the recipe name. |

### Behaviour to be aware of

- **Construct anywhere, start in the browser.** `new MachineAudio()` is safe during server-side rendering; `start()` throws where `AudioContext` does not exist.
- **Repeats vary slightly.** Every one-shot played through `MachineAudio` detunes its starting filter and oscillator frequencies randomly by up to ±6%, so repeated triggers do not sound identical.
- **Voice stealing is smooth.** When a limit is reached, the oldest voice fades out over a few milliseconds instead of being cut.
- **`dispose()` closes the context** when it is an `AudioContext`, including one you passed in through `context`.
- **Airflow voices persist.** Each `id` keeps its voice until `audio.dispose()`; do not call a voice's own `dispose()` if you will use that id again. Reuse one id per moving part and call `silence()` when it stops, instead of creating a new id for every move.

### Airflow voices

Options for `airflow(id, options)`, used only when the voice is created:

| Option | Default | Description |
|---|---|---|
| `style` | `AIRFLOW_STYLES.smooth` | An `AirflowStyle` object: one of the built-in styles, or your own (spread a built-in style and change fields). |
| `pan` | — | Fixed stereo position, from −1 to 1 (not clamped, unlike `play()`). |
| `bufferLength` | `524288` (2¹⁹) | Length of the loop buffers in samples, a power of two. Shorter builds faster; longer hides the loop better. |
| `trim` | `0.56` | Output trim, multiplied with `level` in `update()`. |

| Member | Description |
|---|---|
| `update(speed01, level, at?)` | Call once per frame. `speed01` is the normalised speed (0–1); `level` is a linear gain, multiplied by `trim`; pass `1` for the default balance and use `setLevel('airflow', …)` for the overall mix. |
| `setStyle(style)` | Switches to another style, for example `AIRFLOW_STYLES.warm`. The voice restarts from silence and follows the next `update()`. |
| `silence(at?)` | Fades the voice out, for example when the machine stops. |
| `dispose()` | Stops and disconnects the voice. |

Built-in styles, exported as `AIRFLOW_STYLES`: `smooth` (default), `warm` (darker and softer), `airy` (lighter), `slow` (slower swells).

```ts
import { AIRFLOW_STYLES } from 'procedural-machine-audio';

audio.airflow('head', { style: AIRFLOW_STYLES.warm, pan: -0.3 });
```

### Built-in recipes

`click` · `tap` · `lift` · `hiss` · `leak` · `puff` · `feed` · `clamp` · `unclamp` · `shutter` · `swap` · `settle`

The recipes themselves are exported as `RECIPES` (with the name type `BuiltInRecipe`), so you can copy one as a starting point.

## Custom recipes

A recipe is plain data: an array of layers. A layer is either band-passed noise or a short tone, each with its own envelope.

```ts
import type { Recipe } from 'procedural-machine-audio';

const latch: Recipe = [
  { kind: 'noise', noise: 'pink', freq: 1400, q: 0.8, lowpass: 3500, gain: 0.5, attack: 0.004, decay: 0.04 },
  { kind: 'noise', noise: 'brown', freq: 220, q: 0.7, lowpass: 600, gain: 0.25, attack: 0.008, decay: 0.12, delay: 0.03 },
];

audio.define('latch', latch);
audio.play('latch');
```

| Field | Noise layer | Tone layer | Description |
|---|---|---|---|
| `kind` | required | required | `'noise'` or `'tone'`. |
| `noise` | required | — | `'white'`, `'pink'` or `'brown'`. |
| `freq` | required | required | Band-pass centre (noise) or oscillator frequency (tone), in Hz. |
| `q` | required | — | Band-pass Q. |
| `wave` | — | optional | Oscillator type, default `'sine'`. |
| `gain` | required | required | Peak gain of the layer. |
| `attack` | required | optional | Seconds from silence to peak (tone default `0.001`). |
| `decay` | required | required | Seconds from peak to −80 dB; roughly the first third is audible. |
| `sweepTo` | optional | optional | Frequency (Hz) to glide to: the band-pass centre for noise (over `attack` + `decay`), the pitch for tones (over `decay`). |
| `lowpass` | optional | optional | Low-pass filter after the layer, in Hz. |
| `delay` | optional | optional | Offset from the trigger time, in seconds. |

To keep sounds pleasant over long sessions, keep `q` low (about 0.6–1.5), add a `lowpass`, give noise layers a few milliseconds of `attack`, and avoid long tonal layers.

## Recording and offline rendering

To record what is playing, connect `output` to a `MediaStreamAudioDestinationNode` and use `MediaRecorder`:

```ts
const ctx = audio.context as AudioContext; // a real-time context, after start()
const dest = ctx.createMediaStreamDestination();
audio.output!.connect(dest);

const recorder = new MediaRecorder(dest.stream);
const chunks: Blob[] = [];
recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.onstop = () => {
  const file = new Blob(chunks, { type: recorder.mimeType }); // e.g. audio/webm
};
recorder.start();
```

To render faster than real time without speakers, for example to analyse a recipe in tests or to export a sound, pass an `OfflineAudioContext`. `start()` is not needed in this case.

```ts
const ctx = new OfflineAudioContext(2, 48000 * 2, 48000); // 2 seconds, stereo
const audio = new MachineAudio({ context: ctx });

audio.play('click', { when: 0.1 });
audio.play('hiss', { when: 0.5 });

const buffer = await ctx.startRendering(); // AudioBuffer
```

## Building blocks

The engine's internals are exported too, so you can assemble your own signal graph. The main ones:

| Export | Description |
|---|---|
| `renderRecipe(ctx, destination, noise, recipe, { when, gain?, jitter?, random? })` | Schedules a recipe into any `AudioNode`. `jitter` is the random detune per trigger (default `0.06` = ±6%; `0` = identical every time); `random` replaces `Math.random` for reproducible output. |
| `RECIPES` | The built-in recipes, as data. |
| `AirflowVoice`, `getAirflowBuffers`, `AIRFLOW_STYLES` | The airflow synthesizer and its FFT-shaped loop buffers. |
| `createNoiseBank(ctx, seconds?, seed?)` | Seeded, seamlessly looping white, pink and brown noise (defaults: `5` s, seed `12345`). |
| `createRoomImpulse(ctx)` | A short, soft room impulse response for a `ConvolverNode`. |
| `VoicePool` | Voice limits, oldest-voice stealing and merging of near-identical triggers. |
| `EventScheduler` | A deterministic event queue ordered by time, then by insertion order. |
| `planMove`, `sampleMove` | Trapezoidal and S-curve motion profiles, for driving airflow with plausible speeds (example below). |
| `unlockSilentSwitch`, `pauseSilentSwitch` | The iOS silent-switch handling used by `start()` and `suspend()`. |

TypeScript types are exported alongside: `MachineAudioOptions`, `PlayOptions`, `Binding`, `LevelName`, `Recipe`, `Layer`, `NoiseLayer`, `ToneLayer`, `AirflowStyle`, `AirflowOptions`, `MotionLimits`, `MoveProfile`, `MoveSample` and others; see [`src/index.ts`](src/index.ts).

If your simulation does not already model motion, `planMove` gives realistic speed curves to feed the airflow:

```ts
import { planMove, sampleMove } from 'procedural-machine-audio';

const limits = { vmax: 1400, amax: 14000 };        // units/s and units/s²
const move = planMove(distance, limits, 'scurve'); // or 'trapezoid'

// each frame, t = seconds since the move started:
const { s, v } = sampleMove(move, t);              // distance travelled, current speed
audio.airflow('head').update(v / limits.vmax, 1);
```

## How the airflow works

```
one-shots ─┐            ┌─ dry ─────────┐
           ├─ mix ──────┤               ├─ master ─ limiter ─ output
airflow ───┘            └─ room reverb ─┘
```

Each airflow voice plays two looping noise layers. Both are generated once with an inverse FFT, so they loop without a seam:

- **Body**: noise with a broad spectral curve. Its level follows speed² above a quiet constant bed, and its whole spectrum glides upwards as speed increases.
- **Push**: a Gaussian band of low-frequency noise (not a resonance) whose centre rises with speed. Its envelope reacts faster than the body's, so each move begins with a soft push.

A high shelf opens slightly after the body ("air"), and the stereo image drifts gently with speed. There are no oscillators and no resonant filters in the airflow path, so nothing rings or whistles.

## Browser support

The library requires the Web Audio API (`AudioContext`) and has not yet been systematically tested across browsers.

- `pan` is ignored where `StereoPannerNode` is unavailable.
- On iPhone and iPad, Web Audio is muted by the silent switch by default. `start()` sets `navigator.audioSession.type` to `'playback'` where Safari supports it, and also plays a silent looping media element, so that the page is treated as media playback. `suspend()` pauses that element and `resume()` restarts it.

## Limitations

- One-shots are built only from filtered noise and short tones. The library does not play audio files.
- There is no spatial (3D) positioning; placement is limited to stereo panning.
- Airflow loop buffers are generated on the main thread when a voice or style is first used, which can take a noticeable moment with the default buffer length.

## Development

```bash
npm install
npm run dev         # demo at http://localhost:5320
npm test            # unit tests (Vitest)
npm run typecheck   # TypeScript, strict mode
npm run build       # library → dist/
npm run build:demo  # static demo → dist-demo/
```

Requires Node.js 20 or newer.

## Project status

Version `0.1.0` is an early preview. The API may still change before 1.0; breaking changes will be called out in tagged [GitHub releases](https://github.com/TENMALOG/procedural-machine-audio/releases).

## Contributing

Bug reports and suggestions are welcome in [Issues](https://github.com/TENMALOG/procedural-machine-audio/issues). Before opening a pull request, please run `npm test` and `npm run typecheck`.

## License

[MIT](LICENSE) © 2026 TENMALOG.

The QM-4 website, its 3D models, artwork and tuned sound settings are separate works and are not part of this repository.
