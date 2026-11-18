# procedural-machine-audio

[English](README.md) · **繁體中文** · [日本語](README.ja.md) · [Tiếng Việt](README.vi.md)

**給互動機械與模擬用的程序式音效引擎。**

細小的機械聲：喀聲、輕柔的嘶聲、氣壓的悶響、快速移動手臂帶起的氣流聲。全部用 Web Audio API 即時產生，沒有任何音檔；每一個聲音都是依資料塑形的濾波雜訊，由你的模擬實際在做的事情驅動。

- **事件 → 聲音**：把模擬的事件對應到聲音配方，然後 `emit()`。
- **動作 → 氣流**：每一幀傳入移動部件的速度，氣流聲會跟著鼓起、變亮、往前推。
- **為長時間聆聽而做**：寬頻、不共振的濾波器，沒有旋律；聲部池會把一連串相同的事件合併；輸出端有限幅器。連續聽幾個小時也不刺耳。
- **很小**：沒有任何執行期相依套件。用 TypeScript 撰寫，型別完整。

這個引擎取自 **[QM-4 · 機器的聲音](https://qm4.rewrite.tw/)**，一個為了「聽」而做的虛構打件機 3D 模擬器。這裡的示範刻意做得很簡單（用長方形畫的 2D 龍門機構）；完整的作品請看那個網站。

## 快速開始

```ts
import { MachineAudio, planMove, sampleMove } from 'procedural-machine-audio';

const audio = new MachineAudio();

// 1. 聲音只能在使用者操作之後開始
startButton.onclick = () => audio.start();

// 2. 把模擬的事件對應到內建（或自訂）的配方
audio.bind('PART_PLACED', { recipe: 'click', gain: 0.9 });
audio.bind('VACUUM_ON', 'hiss');

simulation.on('PART_PLACED', (e) => audio.emit('PART_PLACED', { pan: e.x }));

// 3. 每一幀驅動移動部件的氣流聲
function frame() {
  const speed01 = head.speed / head.maxSpeed; // 0 = 靜止，1 = 全速
  if (audio.ready) audio.airflow('head').update(speed01, 1);
  requestAnimationFrame(frame);
}
```

## 執行示範

```bash
npm install
npm run dev        # 在 http://localhost:5320 開啟示範
npm test           # 單元測試
npm run build      # 函式庫 → dist/
npm run build:demo # 靜態示範 → dist-demo/
```

需要 Node.js 20 以上。建議戴上耳機。

## API

### `new MachineAudio(options?)`

| 選項 | 預設 | |
|---|---|---|
| `context` | — | 使用現有的 `AudioContext`／`OfflineAudioContext`；沒有的話由 `start()` 建立。 |
| `latency` | `0.03` | 每次觸發都加上的秒數，讓從畫面更新迴圈排程的聲音不會遲到。 |
| `maxVoices` | `48` | 同時發聲的一次性聲音上限。 |
| `reverb` | `0.12` | 空間感，0–1。 |

| 方法 | |
|---|---|
| `start()` | 建立／恢復 audio context。請在點擊或觸控的處理函式裡呼叫；也會讓 iPhone 開著靜音開關時仍有聲音。 |
| `play(name, { when?, delay?, gain?, pan?, key?, category? })` | 播放一個配方。被略過時回傳 `false`（不認得、音量為零，或和幾毫秒前相同的觸發合併）。 |
| `bind(event, recipe \| { recipe, gain?, category? })`／`emit(event, options?)` | 把模擬事件對應到配方。 |
| `define(name, recipe)` | 加入自己的配方。 |
| `airflow(id, { style?, pan? })` | 取得或建立一個具名的氣流聲部。每一幀呼叫 `.update(speed01, level)`；`.setStyle()` 換音色、`.silence()` 停止。 |
| `setLevel('master' \| 'events' \| 'airflow', value)`、`setReverb(amount)` | 混音。 |
| `output` | 最後一個節點（限幅器之後），可接分析器或 `MediaRecorder`。 |
| `suspend()`／`resume()`／`stopAll()`／`dispose()` | 生命週期。 |

### 內建配方

`click` · `tap` · `lift` · `hiss` · `leak` · `puff` · `feed` · `clamp` · `unclamp` · `shutter` · `swap` · `settle`

### 氣流音色

`AIRFLOW_STYLES.smooth`（預設）· `warm`（較暗、較柔）· `airy`（較輕）· `slow`（緩慢起伏）

### 自訂配方

配方就是一般的資料：一串「層」。每一層是帶通雜訊或短音，各自有包絡。

```ts
audio.define('latch', [
  { kind: 'noise', noise: 'pink', freq: 1400, q: 0.8, lowpass: 3500, gain: 0.5, attack: 0.004, decay: 0.04 },
  { kind: 'noise', noise: 'brown', freq: 220, q: 0.7, lowpass: 600, gain: 0.25, attack: 0.008, decay: 0.12, delay: 0.03 },
]);
audio.play('latch');
```

讓聲音長時間聽起來舒服的小訣竅：`q` 保持低（約 0.6–1.5）、加上 `lowpass`、雜訊層至少給幾毫秒的 `attack`、避免很長的音調層。

### 底層元件

引擎用到的每個元件都有匯出，可以自己組聲音流程：

| 匯出 | |
|---|---|
| `renderRecipe(ctx, destination, noise, recipe, { when, gain })` | 把配方排程到任意節點。 |
| `AirflowVoice`、`getAirflowBuffers`、`AIRFLOW_STYLES` | 氣流合成器，以及用 FFT 塑形的循環緩衝。 |
| `createNoiseBank(ctx, seconds, seed)` | 可指定種子、無接縫循環的白／粉紅／棕色雜訊。 |
| `createRoomImpulse(ctx)` | 給 `ConvolverNode` 用的短而柔和的空間脈衝響應。 |
| `VoicePool` | 聲部上限、搶占最舊的聲部、合併連發事件。 |
| `EventScheduler` | 給模擬用的確定性事件佇列（依時間、再依加入順序）。 |
| `planMove`、`sampleMove` | 梯形／S 曲線運動曲線，讓氣流聲跟著符合物理的速度。 |

## 氣流聲的原理

兩層循環雜訊用反 FFT 一次建好（所以循環沒有接縫）：

- **主體**：具寬廣頻譜曲線的雜訊；音量跟著速度的平方，底下有一層很小的常駐氣流，整個頻譜也會隨速度往上移。
- **推力**：一段高斯形的低頻雜訊帶（不是共振），中心頻率隨速度升高。它的包絡比主體快，所以每次移動一開始都有一下輕柔的「推」。

高頻擱架比主體晚一點打開（「空氣感」），聲像在左右之間輕微飄動。整個過程沒有振盪器、也沒有共振濾波器，所以不會出現嗡聲或哨音。

## 狀態

`0.1.0`：早期版本，API 之後可能還會變動。尚未發布到 npm。

## 作者

**TENMALOG** 製作 · 完整作品：[qm4.rewrite.tw](https://qm4.rewrite.tw/)

## 授權

尚未決定（考慮採用 MIT）。在加入授權檔之前，保留所有權利。
