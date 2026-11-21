<div align="center">

# procedural-machine-audio

[English](README.md) · **繁體中文** · [日本語](README.ja.md) · [Tiếng Việt](README.vi.md)

一個以 Web Audio 實作、即時合成機器聲音的引擎：<br>
喀答聲、氣動嘶聲、夾具動作聲，以及快速移動的機械臂所帶起的氣流聲。<br>
它是合成器，而非取樣播放器：所有聲音皆即時產生，不使用任何音訊檔案。

[線上展示](https://pma.rewrite.tw/) · [快速開始](#quick-start) · [API](#api-reference) · [運作原理](#how-the-airflow-works)

[![MIT License](https://img.shields.io/badge/license-MIT-2b313a?style=flat-square)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-2b313a?style=flat-square)
![Runtime dependencies: 0](https://img.shields.io/badge/runtime%20deps-0-2b313a?style=flat-square)
![Status: 0.1 preview](https://img.shields.io/badge/status-0.1%20preview-2b313a?style=flat-square)

<a href="https://pma.rewrite.tw/"><img src="docs/media/demo.gif" alt="展示：龍門架機頭在格線上的目標點之間移動" width="720"></a>

<sub>此 GIF 無聲。請至<a href="https://pma.rewrite.tw/">線上展示</a>或觀看<a href="docs/media/demo.mp4">12 秒有聲短片</a>收聽。建議配戴耳機。</sub>

</div>

## 為何需要它

模擬、數位孿生與機器視覺化通常沒有聲音，或只搭配少量每隔數秒就重複一次的取樣。本程式庫直接由模擬本身產生聲音：

- **事件化為聲音。** 將模擬事件（`PART_PLACED`、`VACUUM_ON` 等）綁定到簡短的聲音*配方*，再呼叫 `emit()` 即可。
- **動作化為氣流。** 每個影格傳入移動零件的正規化速度，氣流便會隨每次移動而增強、變亮並產生推送感。
- **為避免聽覺疲勞而設計。** 寬頻、非共振的濾波器、不含旋律、合併幾乎相同的觸發，以及輸出限幅器，讓長時間使用也不會出現刺耳或帶有餘響的聲音。

**概覽：** 12 種內建配方 · 4 種氣流風格 · 以純資料定義自訂配方 · 支援錄音與離線算圖 · 零執行階段相依套件。

此引擎擷取自 [QM-4 · 機器的聲音](https://qm4.rewrite.tw/)，這是一款以聆聽為目的、模擬虛構取放機台的 3D 模擬器。

## 安裝

此套件尚未發布至 npm。請從 GitHub 安裝；安裝過程中會自行編譯：

```bash
npm install github:TENMALOG/procedural-machine-audio
```

由於套件在安裝時進行建置，因此需要 Node.js 20 或更新版本。

套件以 ES 模組形式提供，並附帶 TypeScript 型別定義。請透過 Vite、webpack、esbuild 等打包工具或 import map 匯入；不提供 CDN 版本。

<a id="quick-start"></a>
## 快速開始

最精簡的可執行範例，會在按下按鈕時播放一次喀答聲。頁面上放一個按鈕：

```html
<button id="play">Play</button>
```

腳本如下：

```ts
import { MachineAudio } from 'procedural-machine-audio';

const audio = new MachineAudio();

document.querySelector('#play')!.addEventListener('click', async () => {
  await audio.start(); // 瀏覽器僅允許在使用者操作之後播放音訊
  audio.play('click');
});
```

按下按鈕後，會播放一聲簡短而柔和的喀答聲。

典型的整合方式是綁定模擬事件，並在每個影格驅動氣流。`startButton`、`simulation`、`head` 與 `halfWidth` 代表你自己應用程式中的對應物件：

```ts
import { MachineAudio } from 'procedural-machine-audio';

const audio = new MachineAudio();

// 1. 由使用者操作啟動音訊。
startButton.addEventListener('click', () => void audio.start());

// 2. 將模擬事件對應到內建（或自訂）的配方。
audio.bind('PART_PLACED', { recipe: 'click', gain: 0.9 });
audio.bind('VACUUM_ON', 'hiss');

// pan 的範圍為 −1（左）… 1（右），因此請將座標正規化。
simulation.on('PART_PLACED', (e) => audio.emit('PART_PLACED', { pan: e.x / halfWidth }));

// 3. 每個影格驅動一次移動零件的氣流。
//    airflow() 需要音訊情境（context），因此請等到 audio.ready 為 true。
function frame() {
  const speed01 = head.speed / head.maxSpeed; // 0 = 靜止，1 = 全速
  if (audio.ready) audio.airflow('head').update(speed01, 1);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 4. 頁面隱藏時暫停音訊處理。
document.addEventListener('visibilitychange', () => {
  if (!audio.ready) return;
  if (document.hidden) audio.suspend();
  else audio.resume();
});
```

<a id="api-reference"></a>
## API 參考

### `new MachineAudio(options?)`

| 選項 | 預設值 | 說明 |
|---|---|---|
| `context` | — | 既有的 `AudioContext` 或 `OfflineAudioContext`。若省略，則由 `start()` 建立。 |
| `latency` | `0.03` | 每次觸發時加到目前時間上的秒數，確保由算圖迴圈排程的聲音不會延遲開始。 |
| `maxVoices` | `48` | 同時播放的單發音效數量上限。達到上限時，會停止最舊的發聲單元。 |
| `reverb` | `0.12` | 房間殘響量，範圍為 0（乾聲）至 1。 |
| `noiseSeconds` | `5` | 共用雜訊緩衝區的長度，單位為秒。 |

### 方法與屬性

| 成員 | 回傳值 | 說明 |
|---|---|---|
| `start()` | `Promise<void>` | 建立或恢復音訊情境。請在點擊或觸控的處理函式內呼叫。在 iOS 上，它也會要求媒體播放，使靜音開關不會讓頁面靜音（參見[瀏覽器支援](#browser-support)）。 |
| `play(name, options?)` | `boolean` | 播放一個配方。若聲音被略過則回傳 `false`：尚無音訊情境、未知的配方、增益為零，或與數毫秒前具有相同 `key` 的觸發合併。 |
| `bind(event, binding)` | `void` | 將事件名稱對應到配方名稱，或對應到 `Binding` 物件 `{ recipe, gain?, category? }`。 |
| `emit(event, options?)` | `boolean` | 播放綁定到 `event` 的配方。每次呼叫的 `gain` 會與綁定的增益相乘；除非呼叫時另行指定，否則使用綁定的 `category`。 |
| `define(name, recipe)` | `void` | 註冊自訂配方，或取代內建配方。 |
| `airflow(id?, options?)` | `AirflowVoice` | 回傳名為 `id`（預設為 `'default'`）的氣流發聲單元，首次使用時建立。若尚無音訊情境則會**擲出例外**，因此請在 `start()` 之後呼叫，或先檢查 `ready`。選項請參見[氣流發聲單元](#airflow-voices)。 |
| `setLevel(bus, value)` / `getLevel(bus)` | `void` / `number` | `'master'`（預設 `0.8`）、`'events'`（`1.5`）或 `'airflow'`（`0.3`）匯流排的線性音量。 |
| `setReverb(amount)` | `void` | 變更殘響量，並限制在 0–1 之間。 |
| `output` | `AudioNode \| null` | 經過限幅器之後的最終節點；在有音訊情境之前為 `null`。它已連接至喇叭；若要視覺化或錄音，可連接 `AnalyserNode` 或 `MediaStreamAudioDestinationNode`。 |
| `context` | `BaseAudioContext \| null` | 目前使用的音訊情境。 |
| `ready` | `boolean` | 一旦有可供播放的音訊情境即為 `true`。 |
| `stats()` | object | `{ voices, nodes, started, aggregated, stolen, released }`，供除錯使用。 |
| `recipes` | object | 目前已註冊的配方，以名稱為索引。 |
| `suspend()` / `resume()` | `Promise<void>` | 暫停與恢復音訊處理，例如頁面隱藏時。 |
| `stopAll()` / `dispose()` | `void` | 停止所有單發音效並讓所有氣流發聲單元淡出；釋放所有節點並關閉音訊情境。 |

`play()` 與 `emit()` 的選項：

| 選項 | 說明 |
|---|---|
| `when` | 開始播放時的音訊情境絕對時間。會覆寫 `delay`。 |
| `delay` | 從現在起算的秒數（再加上 `latency`）。 |
| `gain` | 線性增益倍數。 |
| `pan` | 立體聲位置，範圍為 −1（左）至 1（右）。 |
| `key` | 在約 6 毫秒內具有相同 key 的觸發會合併為一個。預設為配方名稱。 |
| `category` | 同一類別的發聲單元上限為 14（0.1 版中無法透過 `MachineAudio` 設定），因此繁忙的聲音不會耗盡整個發聲單元池。預設為配方名稱。 |

### 需要留意的行為

- **可在任何地方建構，於瀏覽器中啟動。** 在伺服器端算圖期間呼叫 `new MachineAudio()` 是安全的；在不存在 `AudioContext` 的環境中，`start()` 會擲出例外。
- **重複播放會略有變化。** 透過 `MachineAudio` 播放的每個單發音效，其濾波器與振盪器的起始頻率都會隨機偏移最多 ±6%，因此重複觸發時聽起來不會完全相同。
- **發聲單元的回收很平順。** 達到上限時，最舊的發聲單元會在數毫秒內淡出，而不是被硬切斷。
- **`dispose()` 會關閉音訊情境**（當它是 `AudioContext` 時），包括你透過 `context` 傳入的音訊情境。
- **氣流發聲單元會持續存在。** 每個 `id` 的發聲單元會保留到 `audio.dispose()` 為止；若之後還要使用該 id，請勿呼叫發聲單元本身的 `dispose()`。請為每個移動零件固定使用一個 id，停止時呼叫 `silence()`，而不是每次移動都建立新的 id。

<a id="airflow-voices"></a>
### 氣流發聲單元

`airflow(id, options)` 的選項，僅在建立發聲單元時有效：

| 選項 | 預設值 | 說明 |
|---|---|---|
| `style` | `AIRFLOW_STYLES.smooth` | 一個 `AirflowStyle` 物件：可為內建風格之一，或你自己的風格（展開內建風格並修改欄位）。 |
| `pan` | — | 固定的立體聲位置，範圍為 −1 至 1（與 `play()` 不同，不會被限制範圍）。 |
| `bufferLength` | `524288` (2¹⁹) | 迴圈緩衝區的長度，單位為取樣數，須為 2 的冪。較短則建置較快；較長則更能隱藏迴圈痕跡。 |
| `trim` | `0.56` | 輸出微調值，會在 `update()` 中與 `level` 相乘。 |

| 成員 | 說明 |
|---|---|
| `update(speed01, level, at?)` | 每個影格呼叫一次。`speed01` 為正規化速度（0–1）；`level` 為線性增益，會與 `trim` 相乘；傳入 `1` 即為預設平衡，整體混音請使用 `setLevel('airflow', …)`。 |
| `setStyle(style)` | 切換為另一種風格，例如 `AIRFLOW_STYLES.warm`。發聲單元會從靜音重新開始，並在下一次 `update()` 時跟隨。 |
| `silence(at?)` | 使發聲單元淡出，例如機器停止時。 |
| `dispose()` | 停止並中斷發聲單元的連接。 |

內建風格以 `AIRFLOW_STYLES` 匯出：`smooth`（預設）、`warm`（較暗、較柔和）、`airy`（較輕盈）、`slow`（起伏較緩慢）。

```ts
import { AIRFLOW_STYLES } from 'procedural-machine-audio';

audio.airflow('head', { style: AIRFLOW_STYLES.warm, pan: -0.3 });
```

### 內建配方

`click` · `tap` · `lift` · `hiss` · `leak` · `puff` · `feed` · `clamp` · `unclamp` · `shutter` · `swap` · `settle`

這些配方本身以 `RECIPES` 匯出（名稱型別為 `BuiltInRecipe`），因此你可以複製其中一個作為起點。

## 自訂配方

配方是純資料：由多個圖層組成的陣列。圖層可以是帶通雜訊，也可以是短音調，每個圖層都有各自的包絡。

```ts
import type { Recipe } from 'procedural-machine-audio';

const latch: Recipe = [
  { kind: 'noise', noise: 'pink', freq: 1400, q: 0.8, lowpass: 3500, gain: 0.5, attack: 0.004, decay: 0.04 },
  { kind: 'noise', noise: 'brown', freq: 220, q: 0.7, lowpass: 600, gain: 0.25, attack: 0.008, decay: 0.12, delay: 0.03 },
];

audio.define('latch', latch);
audio.play('latch');
```

| 欄位 | 雜訊圖層 | 音調圖層 | 說明 |
|---|---|---|---|
| `kind` | 必填 | 必填 | `'noise'` 或 `'tone'`。 |
| `noise` | 必填 | — | `'white'`、`'pink'` 或 `'brown'`。 |
| `freq` | 必填 | 必填 | 帶通中心頻率（雜訊）或振盪器頻率（音調），單位為 Hz。 |
| `q` | 必填 | — | 帶通的 Q 值。 |
| `wave` | — | 選填 | 振盪器類型，預設為 `'sine'`。 |
| `gain` | 必填 | 必填 | 圖層的峰值增益。 |
| `attack` | 必填 | 選填 | 從靜音升至峰值所需的秒數（音調的預設值為 `0.001`）。 |
| `decay` | 必填 | 必填 | 從峰值衰減至 −80 dB 所需的秒數；大致上前三分之一的時間可被聽見。 |
| `sweepTo` | 選填 | 選填 | 滑移的目標頻率（Hz）：雜訊為帶通中心頻率（歷時 `attack` + `decay`），音調則為音高（歷時 `decay`）。 |
| `lowpass` | 選填 | 選填 | 圖層之後的低通濾波器，單位為 Hz。 |
| `delay` | 選填 | 選填 | 相對於觸發時間的偏移，單位為秒。 |

為了讓聲音在長時間使用下仍保持悅耳，請將 `q` 維持在較低的值（約 0.6–1.5）、加入 `lowpass`、讓雜訊圖層具有數毫秒的 `attack`，並避免使用過長的音調圖層。

## 錄音與離線算圖

若要錄下正在播放的內容，請將 `output` 連接到 `MediaStreamAudioDestinationNode`，並使用 `MediaRecorder`：

```ts
const ctx = audio.context as AudioContext; // 即時音訊情境，須在 start() 之後
const dest = ctx.createMediaStreamDestination();
audio.output!.connect(dest);

const recorder = new MediaRecorder(dest.stream);
const chunks: Blob[] = [];
recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.onstop = () => {
  const file = new Blob(chunks, { type: recorder.mimeType }); // 例如 audio/webm
};
recorder.start();
```

若要在沒有喇叭的情況下以快於即時的速度算圖，例如在測試中分析某個配方，或匯出一段聲音，請傳入 `OfflineAudioContext`。這種情況下不需要 `start()`。

```ts
const ctx = new OfflineAudioContext(2, 48000 * 2, 48000); // 2 秒，立體聲
const audio = new MachineAudio({ context: ctx });

audio.play('click', { when: 0.1 });
audio.play('hiss', { when: 0.5 });

const buffer = await ctx.startRendering(); // AudioBuffer
```

## 基礎元件

引擎的內部元件也一併匯出，因此你可以組裝自己的訊號圖。主要如下：

| 匯出項目 | 說明 |
|---|---|
| `renderRecipe(ctx, destination, noise, recipe, { when, gain?, jitter?, random? })` | 將配方排程到任何 `AudioNode`。`jitter` 為每次觸發的隨機偏調量（預設 `0.06` = ±6%；`0` = 每次完全相同）；`random` 可取代 `Math.random`，以取得可重現的輸出。 |
| `RECIPES` | 以資料形式提供的內建配方。 |
| `AirflowVoice`、`getAirflowBuffers`、`AIRFLOW_STYLES` | 氣流合成器及其經 FFT 塑形的迴圈緩衝區。 |
| `createNoiseBank(ctx, seconds?, seed?)` | 帶種子、可無縫循環的白、粉紅與棕色雜訊（預設：`5` 秒、種子 `12345`）。 |
| `createRoomImpulse(ctx)` | 供 `ConvolverNode` 使用的短而柔和的房間脈衝響應。 |
| `VoicePool` | 發聲單元數量上限、最舊發聲單元回收，以及合併幾乎相同的觸發。 |
| `EventScheduler` | 依時間排序、時間相同時再依插入順序排序的確定性事件佇列。 |
| `planMove`、`sampleMove` | 梯形與 S 曲線的運動輪廓，用來以合理的速度驅動氣流（範例見下）。 |
| `unlockSilentSwitch`、`pauseSilentSwitch` | `start()` 與 `suspend()` 所使用的 iOS 靜音開關處理機制。 |

TypeScript 型別也一併匯出：`MachineAudioOptions`、`PlayOptions`、`Binding`、`LevelName`、`Recipe`、`Layer`、`NoiseLayer`、`ToneLayer`、`AirflowStyle`、`AirflowOptions`、`MotionLimits`、`MoveProfile`、`MoveSample` 等；請參閱 [`src/index.ts`](src/index.ts)。

若你的模擬尚未建立運動模型，`planMove` 可提供逼真的速度曲線，供氣流使用：

```ts
import { planMove, sampleMove } from 'procedural-machine-audio';

const limits = { vmax: 1400, amax: 14000 };        // 單位/秒 與 單位/秒²
const move = planMove(distance, limits, 'scurve'); // 或 'trapezoid'

// 每個影格，t = 自移動開始起經過的秒數：
const { s, v } = sampleMove(move, t);              // 已行進距離、目前速度
audio.airflow('head').update(v / limits.vmax, 1);
```

<a id="how-the-airflow-works"></a>
## 氣流的運作原理

```
one-shots ─┐            ┌─ dry ─────────┐
           ├─ mix ──────┤               ├─ master ─ limiter ─ output
airflow ───┘            └─ room reverb ─┘
```

每個氣流發聲單元會播放兩層循環雜訊。兩者皆以反向 FFT 一次性產生，因此循環時沒有接縫：

- **本體（Body）**：具有寬頻頻譜曲線的雜訊。其音量在一個安靜的恆定底噪之上，隨速度的平方而變化，且整個頻譜會隨速度增加而向上滑移。
- **推送（Push）**：一段高斯形的低頻雜訊頻帶（並非共振），其中心頻率隨速度上升。它的包絡反應比本體更快，因此每次移動都會以一股柔和的推送感開始。

一個高頻擱架濾波器會稍晚於本體開啟（「空氣感」），而立體聲影像會隨速度輕微漂移。氣流路徑中沒有振盪器，也沒有共振濾波器，因此不會產生餘響或哨音。

<a id="browser-support"></a>
## 瀏覽器支援

本程式庫需要 Web Audio API（`AudioContext`），且尚未在各瀏覽器間進行系統性測試。

- 在沒有 `StereoPannerNode` 的環境中，`pan` 會被忽略。
- 在 iPhone 與 iPad 上，Web Audio 預設會被靜音開關靜音。在 Safari 支援的情況下，`start()` 會將 `navigator.audioSession.type` 設為 `'playback'`，同時播放一個無聲的循環媒體元素，使頁面被視為媒體播放。`suspend()` 會暫停該元素，`resume()` 則會重新啟動它。

## 限制

- 單發音效僅由經濾波的雜訊與短音調組成。本程式庫不播放音訊檔案。
- 不提供空間（3D）定位；位置安排僅限於立體聲平衡。
- 氣流迴圈緩衝區會在首次使用發聲單元或風格時於主執行緒上產生；在預設緩衝區長度下，可能會有明顯的等待時間。

## 開發

```bash
npm install
npm run dev         # 展示頁面位於 http://localhost:5320
npm test            # 單元測試（Vitest）
npm run typecheck   # TypeScript，嚴格模式
npm run build       # 程式庫 → dist/
npm run build:demo  # 靜態展示 → dist-demo/
```

需要 Node.js 20 或更新版本。

## 專案狀態

版本 `0.1.0` 為早期預覽版。在 1.0 之前 API 仍可能變動；破壞性變更將在已標記的 [GitHub releases](https://github.com/TENMALOG/procedural-machine-audio/releases) 中註明。

## 參與貢獻

歡迎在 [Issues](https://github.com/TENMALOG/procedural-machine-audio/issues) 提出錯誤回報與建議。在開啟 pull request 之前，請先執行 `npm test` 與 `npm run typecheck`。

## 授權

[MIT](LICENSE) © 2026 TENMALOG。

QM-4 網站及其 3D 模型、美術作品與調校過的音效設定為獨立著作，不屬於本儲存庫的一部分。
