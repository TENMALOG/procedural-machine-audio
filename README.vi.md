<div align="center">

# procedural-machine-audio

[English](README.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · **Tiếng Việt**

Một engine Web Audio tổng hợp âm thanh của máy móc theo thời gian thực:<br>
tiếng click, tiếng xì khí nén, tiếng kẹp và luồng khí của một cánh tay chuyển động nhanh.<br>
Đây là bộ tổng hợp âm thanh, không phải trình phát mẫu âm thanh: mọi âm thanh đều được tạo ra, không dùng tệp âm thanh nào.

[Bản demo trực tiếp](https://pma.rewrite.tw/) · [Bắt đầu nhanh](#quick-start) · [API](#api-reference) · [Cách hoạt động](#how-the-airflow-works)

[![MIT License](https://img.shields.io/badge/license-MIT-2b313a?style=flat-square)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-2b313a?style=flat-square)
![Runtime dependencies: 0](https://img.shields.io/badge/runtime%20deps-0-2b313a?style=flat-square)
![Status: 0.1 preview](https://img.shields.io/badge/status-0.1%20preview-2b313a?style=flat-square)

<a href="https://pma.rewrite.tw/"><img src="docs/media/demo.gif" alt="Demo: một đầu gantry di chuyển giữa các mục tiêu trên một lưới" width="720"></a>

<sub>Ảnh GIF không có tiếng. Hãy nghe trong <a href="https://pma.rewrite.tw/">bản demo trực tiếp</a> hoặc <a href="docs/media/demo.mp4">đoạn clip 12 giây có âm thanh</a>. Khuyến nghị dùng tai nghe.</sub>

</div>

## Tại sao cần thư viện này

Các mô phỏng, bản sao số (digital twin) và công cụ trực quan hóa máy móc thường được phát hành không có âm thanh, hoặc chỉ có vài mẫu âm thanh lặp lại sau mỗi vài giây. Thư viện này tạo ra âm thanh trực tiếp từ chính mô phỏng:

- **Sự kiện trở thành âm thanh.** Gắn các sự kiện mô phỏng (`PART_PLACED`, `VACUUM_ON`, …) với các *recipe* (công thức âm thanh) ngắn rồi gọi `emit()`.
- **Chuyển động trở thành luồng khí.** Truyền tốc độ đã chuẩn hóa của một bộ phận đang chuyển động ở mỗi khung hình; luồng khí sẽ dâng lên, sáng dần và tạo lực đẩy theo từng chuyển động.
- **Thiết kế để tránh gây mệt mỏi.** Các bộ lọc dải rộng, không cộng hưởng, không có giai điệu, việc gộp các lần kích hoạt gần như giống hệt nhau và bộ giới hạn đầu ra giúp các phiên làm việc dài không bị âm thanh chói hoặc ngân vang.

**Tóm tắt:** 12 recipe tích hợp sẵn · 4 kiểu luồng khí · recipe tùy chỉnh dưới dạng dữ liệu thuần · ghi âm và kết xuất ngoại tuyến · không có phụ thuộc lúc chạy.

Engine này được tách ra từ [QM-4 · Âm thanh của một cỗ máy](https://qm4.rewrite.tw/), một trình mô phỏng 3D về một máy gắp-đặt (pick-and-place) hư cấu, được tạo ra để lắng nghe.

## Cài đặt

Gói chưa được xuất bản lên npm. Hãy cài đặt từ GitHub; gói sẽ tự biên dịch trong quá trình cài đặt:

```bash
npm install github:TENMALOG/procedural-machine-audio
```

Vì gói được xây dựng trong quá trình cài đặt, nên cần Node.js 20 trở lên.

Gói được phát hành dưới dạng ES module kèm định nghĩa kiểu TypeScript. Hãy nhập (import) thông qua một bundler như Vite, webpack hoặc esbuild, hoặc thông qua import map; không cung cấp bản dựng CDN.

<a id="quick-start"></a>
## Bắt đầu nhanh

Ví dụ hoạt động nhỏ nhất sẽ phát một tiếng click khi nhấn một nút. Với nút này trên trang:

```html
<button id="play">Play</button>
```

đoạn mã là:

```ts
import { MachineAudio } from 'procedural-machine-audio';

const audio = new MachineAudio();

document.querySelector('#play')!.addEventListener('click', async () => {
  await audio.start(); // trình duyệt chỉ cho phép âm thanh sau một cử chỉ của người dùng
  audio.play('click');
});
```

Nhấn nút sẽ phát một tiếng click ngắn, nhẹ.

Một tích hợp điển hình sẽ gắn các sự kiện mô phỏng và điều khiển luồng khí ở mỗi khung hình. `startButton`, `simulation`, `head` và `halfWidth` đại diện cho các thành phần trong ứng dụng của riêng bạn:

```ts
import { MachineAudio } from 'procedural-machine-audio';

const audio = new MachineAudio();

// 1. Khởi động âm thanh từ một cử chỉ của người dùng.
startButton.addEventListener('click', () => void audio.start());

// 2. Ánh xạ các sự kiện mô phỏng tới các recipe tích hợp sẵn (hoặc của riêng bạn).
audio.bind('PART_PLACED', { recipe: 'click', gain: 0.9 });
audio.bind('VACUUM_ON', 'hiss');

// pan nhận giá trị từ −1 (trái) … 1 (phải), vì vậy hãy chuẩn hóa tọa độ của bạn.
simulation.on('PART_PLACED', (e) => audio.emit('PART_PLACED', { pan: e.x / halfWidth }));

// 3. Điều khiển luồng khí của một bộ phận đang chuyển động một lần mỗi khung hình.
//    airflow() cần một context, vì vậy hãy chờ đến khi audio.ready là true.
function frame() {
  const speed01 = head.speed / head.maxSpeed; // 0 = đứng yên, 1 = tốc độ tối đa
  if (audio.ready) audio.airflow('head').update(speed01, 1);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 4. Tạm dừng xử lý âm thanh khi trang bị ẩn.
document.addEventListener('visibilitychange', () => {
  if (!audio.ready) return;
  if (document.hidden) audio.suspend();
  else audio.resume();
});
```

<a id="api-reference"></a>
## Tham chiếu API

### `new MachineAudio(options?)`

| Tùy chọn | Giá trị mặc định | Mô tả |
|---|---|---|
| `context` | — | Một `AudioContext` hoặc `OfflineAudioContext` có sẵn. Nếu bỏ qua, `start()` sẽ tạo một context. |
| `latency` | `0.03` | Số giây được cộng vào thời gian hiện tại cho mỗi lần kích hoạt, để các âm thanh được lên lịch từ vòng lặp kết xuất không bao giờ bắt đầu trễ. |
| `maxVoices` | `48` | Số lượng one-shot đồng thời tối đa. Khi đạt đến giới hạn, voice cũ nhất sẽ bị dừng. |
| `reverb` | `0.12` | Mức độ vang phòng, từ 0 (khô) đến 1. |
| `noiseSeconds` | `5` | Độ dài của các bộ đệm nhiễu dùng chung, tính bằng giây. |

### Phương thức và thuộc tính

| Thành viên | Giá trị trả về | Mô tả |
|---|---|---|
| `start()` | `Promise<void>` | Tạo hoặc tiếp tục audio context. Hãy gọi hàm này bên trong trình xử lý click hoặc chạm. Trên iOS, hàm này cũng yêu cầu phát media để công tắc im lặng không làm tắt tiếng trang (xem [Hỗ trợ trình duyệt](#browser-support)). |
| `play(name, options?)` | `boolean` | Phát một recipe. Trả về `false` nếu âm thanh bị bỏ qua: chưa có context, recipe không xác định, gain bằng không, hoặc đã được gộp với một lần kích hoạt có cùng `key` vài mili giây trước đó. |
| `bind(event, binding)` | `void` | Ánh xạ tên một sự kiện tới tên một recipe, hoặc tới một đối tượng `Binding` có dạng `{ recipe, gain?, category? }`. |
| `emit(event, options?)` | `boolean` | Phát recipe được gắn với `event`. `gain` của mỗi lần gọi sẽ được nhân với gain đã gắn; `category` của binding được dùng trừ khi lời gọi đặt một giá trị khác. |
| `define(name, recipe)` | `void` | Đăng ký một recipe tùy chỉnh, hoặc thay thế một recipe tích hợp sẵn. |
| `airflow(id?, options?)` | `AirflowVoice` | Trả về airflow voice có tên `id` (mặc định `'default'`), tạo mới ở lần dùng đầu tiên. **Ném lỗi** nếu chưa có context, vì vậy hãy gọi sau `start()` hoặc kiểm tra `ready`. Xem [Airflow voice](#airflow-voices) để biết các tùy chọn. |
| `setLevel(bus, value)` / `getLevel(bus)` | `void` / `number` | Mức tuyến tính của bus `'master'` (mặc định `0.8`), `'events'` (`1.5`) hoặc `'airflow'` (`0.3`). |
| `setReverb(amount)` | `void` | Thay đổi mức độ vang, được giới hạn trong khoảng 0–1. |
| `output` | `AudioNode \| null` | Node cuối cùng, sau bộ giới hạn; là `null` cho đến khi có context. Node này đã được kết nối với loa; hãy kết nối một `AnalyserNode` hoặc một `MediaStreamAudioDestinationNode` để trực quan hóa hoặc ghi âm. |
| `context` | `BaseAudioContext \| null` | Audio context đang được sử dụng. |
| `ready` | `boolean` | Là `true` khi đã có context để phát âm thanh vào. |
| `stats()` | object | `{ voices, nodes, started, aggregated, stolen, released }`, dùng để gỡ lỗi. |
| `recipes` | object | Các recipe hiện đã đăng ký, theo tên. |
| `suspend()` / `resume()` | `Promise<void>` | Tạm dừng và tiếp tục xử lý âm thanh, ví dụ khi trang bị ẩn. |
| `stopAll()` / `dispose()` | `void` | Dừng mọi one-shot và làm mờ dần mọi voice luồng khí; giải phóng mọi node và đóng context. |

Các tùy chọn của `play()` và `emit()`:

| Tùy chọn | Mô tả |
|---|---|
| `when` | Thời điểm tuyệt đối của context để bắt đầu. Ghi đè `delay`. |
| `delay` | Số giây tính từ bây giờ (cộng thêm `latency`). |
| `gain` | Hệ số nhân gain tuyến tính. |
| `pan` | Vị trí âm thanh nổi, từ −1 (trái) đến 1 (phải). |
| `key` | Các lần kích hoạt có cùng key trong khoảng 6 ms sẽ được gộp thành một. Mặc định là tên recipe. |
| `category` | Các voice trong cùng một category bị giới hạn tối đa 14 (không thể cấu hình thông qua `MachineAudio` ở phiên bản 0.1), để một âm thanh dày đặc không thể chiếm hết toàn bộ pool. Mặc định là tên recipe. |

### Các hành vi cần lưu ý

- **Khởi tạo ở bất kỳ đâu, khởi động trong trình duyệt.** `new MachineAudio()` an toàn khi dùng trong quá trình kết xuất phía máy chủ; `start()` sẽ ném lỗi ở nơi không có `AudioContext`.
- **Các lần lặp lại thay đổi nhẹ.** Mỗi one-shot được phát thông qua `MachineAudio` đều làm lệch ngẫu nhiên tần số khởi đầu của bộ lọc và bộ dao động tối đa ±6%, nhờ đó các lần kích hoạt lặp lại không nghe giống hệt nhau.
- **Việc lấy lại voice diễn ra mượt mà.** Khi đạt đến giới hạn, voice cũ nhất sẽ tắt dần trong vài mili giây thay vì bị cắt đột ngột.
- **`dispose()` đóng context** khi đó là một `AudioContext`, kể cả khi bạn truyền vào qua `context`.
- **Voice luồng khí được giữ lại.** Mỗi `id` giữ voice của nó cho đến khi gọi `audio.dispose()`; đừng gọi `dispose()` của chính voice nếu bạn sẽ dùng lại id đó. Hãy dùng lại một id cho mỗi bộ phận chuyển động và gọi `silence()` khi nó dừng, thay vì tạo id mới cho mỗi lần di chuyển.

<a id="airflow-voices"></a>
### Airflow voice

Các tùy chọn của `airflow(id, options)`, chỉ được dùng khi voice được tạo:

| Tùy chọn | Giá trị mặc định | Mô tả |
|---|---|---|
| `style` | `AIRFLOW_STYLES.smooth` | Một đối tượng `AirflowStyle`: một trong các kiểu tích hợp sẵn, hoặc kiểu của riêng bạn (dùng spread một kiểu tích hợp sẵn rồi thay đổi các trường). |
| `pan` | — | Vị trí âm thanh nổi cố định, từ −1 đến 1 (không bị giới hạn, khác với `play()`). |
| `bufferLength` | `524288` (2¹⁹) | Độ dài của các bộ đệm vòng lặp tính bằng mẫu, là lũy thừa của hai. Ngắn hơn thì dựng nhanh hơn; dài hơn thì che giấu vòng lặp tốt hơn. |
| `trim` | `0.56` | Mức cắt tỉa đầu ra, được nhân với `level` trong `update()`. |

| Thành viên | Mô tả |
|---|---|
| `update(speed01, level, at?)` | Gọi một lần mỗi khung hình. `speed01` là tốc độ đã chuẩn hóa (0–1); `level` là gain tuyến tính, được nhân với `trim`; truyền `1` để có cân bằng mặc định và dùng `setLevel('airflow', …)` cho mức trộn tổng thể. |
| `setStyle(style)` | Chuyển sang một kiểu khác, ví dụ `AIRFLOW_STYLES.warm`. Voice khởi động lại từ im lặng và theo `update()` tiếp theo. |
| `silence(at?)` | Làm voice tắt dần, ví dụ khi máy dừng. |
| `dispose()` | Dừng và ngắt kết nối voice. |

Các kiểu tích hợp sẵn, được xuất dưới dạng `AIRFLOW_STYLES`: `smooth` (mặc định), `warm` (tối và mềm hơn), `airy` (nhẹ hơn), `slow` (nhịp dâng chậm hơn).

```ts
import { AIRFLOW_STYLES } from 'procedural-machine-audio';

audio.airflow('head', { style: AIRFLOW_STYLES.warm, pan: -0.3 });
```

### Các recipe tích hợp sẵn

`click` · `tap` · `lift` · `hiss` · `leak` · `puff` · `feed` · `clamp` · `unclamp` · `shutter` · `swap` · `settle`

Bản thân các recipe được xuất dưới dạng `RECIPES` (với kiểu tên `BuiltInRecipe`), vì vậy bạn có thể sao chép một recipe để làm điểm khởi đầu.

## Recipe tùy chỉnh

Một recipe là dữ liệu thuần: một mảng các lớp (layer). Mỗi layer là nhiễu đã qua lọc dải hoặc một âm ngắn, mỗi layer có đường bao riêng.

```ts
import type { Recipe } from 'procedural-machine-audio';

const latch: Recipe = [
  { kind: 'noise', noise: 'pink', freq: 1400, q: 0.8, lowpass: 3500, gain: 0.5, attack: 0.004, decay: 0.04 },
  { kind: 'noise', noise: 'brown', freq: 220, q: 0.7, lowpass: 600, gain: 0.25, attack: 0.008, decay: 0.12, delay: 0.03 },
];

audio.define('latch', latch);
audio.play('latch');
```

| Trường | Layer nhiễu | Layer âm | Mô tả |
|---|---|---|---|
| `kind` | bắt buộc | bắt buộc | `'noise'` hoặc `'tone'`. |
| `noise` | bắt buộc | — | `'white'`, `'pink'` hoặc `'brown'`. |
| `freq` | bắt buộc | bắt buộc | Tâm của bộ lọc thông dải (nhiễu) hoặc tần số bộ dao động (âm), tính bằng Hz. |
| `q` | bắt buộc | — | Q của bộ lọc thông dải. |
| `wave` | — | tùy chọn | Loại bộ dao động, mặc định `'sine'`. |
| `gain` | bắt buộc | bắt buộc | Gain đỉnh của layer. |
| `attack` | bắt buộc | tùy chọn | Số giây từ im lặng đến đỉnh (mặc định của layer âm là `0.001`). |
| `decay` | bắt buộc | bắt buộc | Số giây từ đỉnh xuống −80 dB; khoảng một phần ba đầu tiên là nghe thấy được. |
| `sweepTo` | tùy chọn | tùy chọn | Tần số (Hz) để trượt tới: tâm bộ lọc thông dải đối với nhiễu (trong `attack` + `decay`), cao độ đối với âm (trong `decay`). |
| `lowpass` | tùy chọn | tùy chọn | Bộ lọc thông thấp đặt sau layer, tính bằng Hz. |
| `delay` | tùy chọn | tùy chọn | Độ lệch so với thời điểm kích hoạt, tính bằng giây. |

Để âm thanh dễ chịu trong các phiên làm việc dài, hãy giữ `q` thấp (khoảng 0,6–1,5), thêm `lowpass`, cho các layer nhiễu vài mili giây `attack` và tránh các layer âm kéo dài.

## Ghi âm và kết xuất ngoại tuyến

Để ghi lại những gì đang phát, hãy kết nối `output` với một `MediaStreamAudioDestinationNode` và dùng `MediaRecorder`:

```ts
const ctx = audio.context as AudioContext; // một context thời gian thực, sau start()
const dest = ctx.createMediaStreamDestination();
audio.output!.connect(dest);

const recorder = new MediaRecorder(dest.stream);
const chunks: Blob[] = [];
recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.onstop = () => {
  const file = new Blob(chunks, { type: recorder.mimeType }); // ví dụ audio/webm
};
recorder.start();
```

Để kết xuất nhanh hơn thời gian thực mà không cần loa, ví dụ để phân tích một recipe trong kiểm thử hoặc để xuất một âm thanh, hãy truyền một `OfflineAudioContext`. Trong trường hợp này không cần `start()`.

```ts
const ctx = new OfflineAudioContext(2, 48000 * 2, 48000); // 2 giây, âm thanh nổi
const audio = new MachineAudio({ context: ctx });

audio.play('click', { when: 0.1 });
audio.play('hiss', { when: 0.5 });

const buffer = await ctx.startRendering(); // AudioBuffer
```

## Các khối xây dựng

Các thành phần bên trong của engine cũng được xuất ra, vì vậy bạn có thể tự lắp ráp đồ thị tín hiệu của riêng mình. Các thành phần chính:

| Thành phần xuất | Mô tả |
|---|---|
| `renderRecipe(ctx, destination, noise, recipe, { when, gain?, jitter?, random? })` | Lên lịch một recipe vào bất kỳ `AudioNode` nào. `jitter` là độ lệch tần số ngẫu nhiên cho mỗi lần kích hoạt (mặc định `0.06` = ±6%; `0` = giống hệt nhau mọi lần); `random` thay thế `Math.random` để có đầu ra có thể tái lập. |
| `RECIPES` | Các recipe tích hợp sẵn, dưới dạng dữ liệu. |
| `AirflowVoice`, `getAirflowBuffers`, `AIRFLOW_STYLES` | Bộ tổng hợp luồng khí và các bộ đệm vòng lặp được định hình bằng FFT của nó. |
| `createNoiseBank(ctx, seconds?, seed?)` | Nhiễu trắng, hồng và nâu lặp liền mạch, có hạt giống (seed) (mặc định: `5` giây, seed `12345`). |
| `createRoomImpulse(ctx)` | Một đáp ứng xung phòng ngắn, mềm cho `ConvolverNode`. |
| `VoicePool` | Giới hạn voice, lấy lại voice cũ nhất và gộp các lần kích hoạt gần như giống hệt nhau. |
| `EventScheduler` | Hàng đợi sự kiện có tính xác định, sắp xếp theo thời gian, sau đó theo thứ tự chèn. |
| `planMove`, `sampleMove` | Các biên dạng chuyển động hình thang và đường cong chữ S, để điều khiển luồng khí với tốc độ hợp lý (ví dụ bên dưới). |
| `unlockSilentSwitch`, `pauseSilentSwitch` | Phần xử lý công tắc im lặng trên iOS được `start()` và `suspend()` sử dụng. |

Các kiểu TypeScript cũng được xuất kèm theo: `MachineAudioOptions`, `PlayOptions`, `Binding`, `LevelName`, `Recipe`, `Layer`, `NoiseLayer`, `ToneLayer`, `AirflowStyle`, `AirflowOptions`, `MotionLimits`, `MoveProfile`, `MoveSample` và các kiểu khác; xem [`src/index.ts`](src/index.ts).

Nếu mô phỏng của bạn chưa mô hình hóa chuyển động, `planMove` cung cấp các đường cong tốc độ thực tế để đưa vào luồng khí:

```ts
import { planMove, sampleMove } from 'procedural-machine-audio';

const limits = { vmax: 1400, amax: 14000 };        // đơn vị/s và đơn vị/s²
const move = planMove(distance, limits, 'scurve'); // hoặc 'trapezoid'

// mỗi khung hình, t = số giây kể từ khi chuyển động bắt đầu:
const { s, v } = sampleMove(move, t);              // quãng đường đã đi, tốc độ hiện tại
audio.airflow('head').update(v / limits.vmax, 1);
```

<a id="how-the-airflow-works"></a>
## Cách hoạt động của luồng khí

```
one-shots ─┐            ┌─ dry ─────────┐
           ├─ mix ──────┤               ├─ master ─ limiter ─ output
airflow ───┘            └─ room reverb ─┘
```

Mỗi airflow voice phát hai layer nhiễu lặp vòng. Cả hai được tạo một lần bằng FFT ngược, nên chúng lặp lại mà không có đường nối:

- **Body**: nhiễu có đường cong phổ rộng. Mức của nó tỉ lệ với speed² trên một nền tĩnh không đổi, và toàn bộ phổ của nó trượt lên cao khi tốc độ tăng.
- **Push**: một dải Gauss của nhiễu tần số thấp (không phải cộng hưởng) có tâm tăng dần theo tốc độ. Đường bao của nó phản ứng nhanh hơn của body, nên mỗi chuyển động bắt đầu bằng một lực đẩy nhẹ.

Một bộ lọc high shelf mở ra hơi muộn hơn body ("air"), và hình ảnh âm thanh nổi trôi nhẹ nhàng theo tốc độ. Không có bộ dao động và không có bộ lọc cộng hưởng nào trong đường dẫn luồng khí, nên không có gì ngân vang hay rít lên.

<a id="browser-support"></a>
## Hỗ trợ trình duyệt

Thư viện yêu cầu Web Audio API (`AudioContext`) và chưa được kiểm thử một cách hệ thống trên các trình duyệt.

- `pan` bị bỏ qua ở nơi không có `StereoPannerNode`.
- Trên iPhone và iPad, Web Audio mặc định bị công tắc im lặng làm tắt tiếng. `start()` đặt `navigator.audioSession.type` thành `'playback'` ở nơi Safari hỗ trợ, và đồng thời phát một phần tử media lặp vòng im lặng, để trang được coi là đang phát media. `suspend()` tạm dừng phần tử đó và `resume()` khởi động lại nó.

## Hạn chế

- Các one-shot chỉ được xây dựng từ nhiễu đã lọc và các âm ngắn. Thư viện không phát các tệp âm thanh.
- Không có định vị không gian (3D); việc đặt vị trí chỉ giới hạn ở panning âm thanh nổi.
- Các bộ đệm vòng lặp luồng khí được tạo trên luồng chính khi một voice hoặc kiểu được dùng lần đầu, việc này có thể mất một khoảng thời gian đáng chú ý với độ dài bộ đệm mặc định.

## Phát triển

```bash
npm install
npm run dev         # demo tại http://localhost:5320
npm test            # kiểm thử đơn vị (Vitest)
npm run typecheck   # TypeScript, chế độ strict
npm run build       # thư viện → dist/
npm run build:demo  # demo tĩnh → dist-demo/
```

Yêu cầu Node.js 20 trở lên.

## Trạng thái dự án

Phiên bản `0.1.0` là bản xem trước sớm. API vẫn có thể thay đổi trước 1.0; các thay đổi phá vỡ tương thích sẽ được nêu rõ trong các [bản phát hành GitHub](https://github.com/TENMALOG/procedural-machine-audio/releases) có gắn thẻ.

## Đóng góp

Chào đón báo cáo lỗi và đề xuất tại [Issues](https://github.com/TENMALOG/procedural-machine-audio/issues). Trước khi mở pull request, vui lòng chạy `npm test` và `npm run typecheck`.

## Giấy phép

[MIT](LICENSE) © 2026 TENMALOG.

Trang web QM-4, các mô hình 3D, tác phẩm nghệ thuật và các thiết lập âm thanh đã tinh chỉnh của nó là các tác phẩm riêng biệt và không thuộc kho mã này.
