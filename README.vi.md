# procedural-machine-audio

[English](README.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · **Tiếng Việt**

**Engine âm thanh thủ tục cho máy móc tương tác và mô phỏng.**

**▶ Demo trực tuyến: [pma.rewrite.tw](https://pma.rewrite.tw/?lang=vi)** (nên dùng tai nghe)

Những âm thanh cơ khí nhỏ — tiếng tách, tiếng xì nhẹ, tiếng khí nén trầm, luồng khí của một cánh tay di chuyển nhanh — được tạo trực tiếp bằng Web Audio API. Không có tệp âm thanh nào: mọi âm thanh đều là nhiễu được lọc và tạo hình bằng dữ liệu, được điều khiển bởi chính những gì mô phỏng của bạn đang làm.

- **Sự kiện → âm thanh.** Gán các sự kiện của mô phỏng cho các công thức âm thanh, rồi gọi `emit()`.
- **Chuyển động → luồng khí.** Truyền tốc độ của bộ phận đang chuyển động mỗi khung hình; tiếng luồng khí sẽ phồng lên, sáng hơn và đẩy tới theo nó.
- **Làm cho việc nghe lâu.** Bộ lọc băng rộng không cộng hưởng, không có giai điệu, một voice pool gộp các loạt sự kiện giống nhau, và bộ giới hạn ở đầu ra — nghe hàng giờ vẫn dễ chịu.
- **Nhỏ gọn.** Không có phụ thuộc lúc chạy. Viết bằng TypeScript với kiểu đầy đủ.

Engine này được tách ra từ **[QM-4 · Âm thanh của một cỗ máy](https://qm4.rewrite.tw/)**, một trình mô phỏng 3D về một máy gắn linh kiện hư cấu được làm ra để nghe. Bản demo ở đây được cố tình làm tối giản (một gantry 2D vẽ bằng các hình chữ nhật); trải nghiệm đầy đủ nằm trên trang web đó.

## Bắt đầu nhanh

```ts
import { MachineAudio, planMove, sampleMove } from 'procedural-machine-audio';

const audio = new MachineAudio();

// 1. Âm thanh chỉ có thể bắt đầu sau một thao tác của người dùng
startButton.onclick = () => audio.start();

// 2. Gán các sự kiện của mô phỏng cho công thức có sẵn (hoặc của bạn)
audio.bind('PART_PLACED', { recipe: 'click', gain: 0.9 });
audio.bind('VACUUM_ON', 'hiss');

simulation.on('PART_PLACED', (e) => audio.emit('PART_PLACED', { pan: e.x }));

// 3. Điều khiển luồng khí của bộ phận chuyển động mỗi khung hình
function frame() {
  const speed01 = head.speed / head.maxSpeed; // 0 = đứng yên, 1 = tốc độ tối đa
  if (audio.ready) audio.airflow('head').update(speed01, 1);
  requestAnimationFrame(frame);
}
```

## Chạy bản demo trên máy

```bash
npm install
npm run dev        # mở demo tại http://localhost:5320
npm test           # kiểm thử đơn vị
npm run build      # thư viện → dist/
npm run build:demo # demo tĩnh → dist-demo/
```

Cần Node.js 20 trở lên. Nên dùng tai nghe.

## API

### `new MachineAudio(options?)`

| tùy chọn | mặc định | |
|---|---|---|
| `context` | — | Dùng một `AudioContext` / `OfflineAudioContext` có sẵn. Nếu không, `start()` sẽ tạo mới. |
| `latency` | `0.03` | Số giây cộng thêm vào "hiện tại" cho mỗi lần phát, để âm thanh lên lịch từ vòng lặp vẽ không bao giờ bị trễ. |
| `maxVoices` | `48` | Số âm thanh ngắn phát cùng lúc tối đa. |
| `reverb` | `0.12` | Lượng không gian, 0–1. |

| phương thức | |
|---|---|
| `start()` | Tạo / tiếp tục audio context. Hãy gọi trong trình xử lý nhấp chuột hoặc chạm. Cũng giúp có tiếng khi iPhone bật công tắc im lặng. |
| `play(name, { when?, delay?, gain?, pan?, key?, category? })` | Phát một công thức. Trả về `false` nếu bị bỏ qua (không rõ, im lặng, hoặc gộp với một lần phát giống hệt vài mili giây trước). |
| `bind(event, recipe \| { recipe, gain?, category? })` / `emit(event, options?)` | Gán các sự kiện của mô phỏng cho công thức. |
| `define(name, recipe)` | Thêm công thức của riêng bạn. |
| `airflow(id, { style?, pan? })` | Lấy hoặc tạo một giọng luồng khí có tên. Gọi `.update(speed01, level)` mỗi khung hình, `.setStyle()` để đổi âm sắc, `.silence()` để dừng. |
| `setLevel('master' \| 'events' \| 'airflow', value)`, `setReverb(amount)` | Trộn âm. |
| `output` | Nút cuối cùng (sau bộ giới hạn), để nối bộ phân tích hoặc `MediaRecorder`. |
| `suspend()` / `resume()` / `stopAll()` / `dispose()` | Vòng đời. |

### Công thức có sẵn

`click` · `tap` · `lift` · `hiss` · `leak` · `puff` · `feed` · `clamp` · `unclamp` · `shutter` · `swap` · `settle`

### Âm sắc luồng khí

`AIRFLOW_STYLES.smooth` (mặc định) · `warm` (trầm, mềm hơn) · `airy` (nhẹ hơn) · `slow` (dâng lên chậm rãi)

### Viết công thức của riêng bạn

Một công thức chỉ là dữ liệu: một danh sách các lớp. Mỗi lớp là nhiễu qua bộ lọc thông dải hoặc một âm ngắn, mỗi lớp có đường bao riêng.

```ts
audio.define('latch', [
  { kind: 'noise', noise: 'pink', freq: 1400, q: 0.8, lowpass: 3500, gain: 0.5, attack: 0.004, decay: 0.04 },
  { kind: 'noise', noise: 'brown', freq: 220, q: 0.7, lowpass: 600, gain: 0.25, attack: 0.008, decay: 0.12, delay: 0.03 },
]);
audio.play('latch');
```

Mẹo để âm thanh dễ chịu khi nghe lâu: giữ `q` thấp (khoảng 0,6–1,5), thêm `lowpass`, cho các lớp nhiễu ít nhất vài mili giây `attack`, và tránh các lớp âm điệu dài.

### Các khối cấp thấp

Mọi thành phần engine sử dụng đều được xuất ra, nên bạn có thể tự dựng chuỗi xử lý của mình:

| xuất | |
|---|---|
| `renderRecipe(ctx, destination, noise, recipe, { when, gain })` | Lên lịch một công thức vào bất kỳ nút nào. |
| `AirflowVoice`, `getAirflowBuffers`, `AIRFLOW_STYLES` | Bộ tổng hợp luồng khí và các bộ đệm lặp được tạo hình bằng FFT. |
| `createNoiseBank(ctx, seconds, seed)` | Nhiễu trắng / hồng / nâu có hạt giống, lặp liền mạch. |
| `createRoomImpulse(ctx)` | Đáp ứng xung phòng ngắn và mềm cho `ConvolverNode`. |
| `VoicePool` | Giới hạn số giọng, chiếm giọng cũ nhất, gộp các loạt sự kiện. |
| `EventScheduler` | Hàng đợi sự kiện tất định cho mô phỏng (theo thời gian, rồi theo thứ tự thêm vào). |
| `planMove`, `sampleMove` | Biên dạng chuyển động hình thang / đường cong S, để luồng khí theo tốc độ hợp lý về mặt vật lý. |

## Cách luồng khí hoạt động

Hai lớp nhiễu lặp được dựng một lần bằng FFT ngược (nên lặp liền mạch):

- **thân** — nhiễu có đường cong phổ rộng; âm lượng theo bình phương tốc độ, bên dưới có một luồng khí nền nhỏ cố định, và toàn bộ phổ dịch lên theo tốc độ.
- **đẩy** — một dải nhiễu trầm hình Gauss (không phải cộng hưởng) có tần số trung tâm tăng theo tốc độ. Đường bao của nó nhanh hơn phần thân, nên mỗi chuyển động bắt đầu bằng một cú "đẩy" nhẹ.

Bộ lọc kệ cao mở muộn hơn phần thân một chút ("cảm giác không khí"), và hình ảnh âm thanh trôi nhẹ giữa trái và phải. Không có bộ dao động hay bộ lọc cộng hưởng nào, nên không có tiếng ù hay tiếng huýt.

## Trạng thái

`0.1.0` — giai đoạn đầu. API vẫn có thể thay đổi. Chưa phát hành lên npm.

## Tác giả

Thực hiện bởi **TENMALOG** · Trải nghiệm đầy đủ: [qm4.rewrite.tw](https://qm4.rewrite.tw/)

## Giấy phép

[MIT](LICENSE) © 2026 TENMALOG

Giấy phép MIT chỉ áp dụng cho mã nguồn trong kho này. Trang web QM-4, các mô hình 3D, nhân vật, hình ảnh và âm thanh đã tinh chỉnh của nó là những tác phẩm riêng và không được bao gồm.
