# procedural-machine-audio

[English](README.md) · [繁體中文](README.zh-TW.md) · **日本語** · [Tiếng Việt](README.vi.md)

**インタラクティブな機械とシミュレーションのためのプロシージャル・オーディオエンジン。**

クリック音、やわらかなエア音、空気圧のこもった音、すばやく動くアームの気流音といった小さな機械音を、Web Audio API でリアルタイムに生成します。音声ファイルは一切使いません。すべての音はデータで形づくったフィルタ付きノイズで、シミュレーションが実際に行っている動作によって鳴ります。

- **イベント → 音**：シミュレーションのイベントを音のレシピに割り当て、`emit()` するだけ。
- **動き → 気流**：動く部品の速度を毎フレーム渡すと、気流音がそれに合わせてふくらみ、明るくなり、押し出されます。
- **長時間聴くために**：共振しない広帯域フィルタ、メロディなし、同じイベントの連打をまとめるボイスプール、出力段のリミッター。何時間聴いても耳障りになりません。
- **小さい**：実行時の依存パッケージはゼロ。TypeScript で書かれ、型定義も完備。

このエンジンは **[QM-4 · 機械の音](https://qm4.rewrite.tw/)** から切り出したものです。QM-4 は「聴く」ために作られた架空のマウンターの 3D シミュレーターです。ここのデモはあえて最小限（長方形で描いた 2D ガントリー）にしてあり、完全な作品はそのサイトで体験できます。

## クイックスタート

```ts
import { MachineAudio, planMove, sampleMove } from 'procedural-machine-audio';

const audio = new MachineAudio();

// 1. 音はユーザー操作のあとでしか鳴らせません
startButton.onclick = () => audio.start();

// 2. シミュレーションのイベントを内蔵（または自作）のレシピに割り当てる
audio.bind('PART_PLACED', { recipe: 'click', gain: 0.9 });
audio.bind('VACUUM_ON', 'hiss');

simulation.on('PART_PLACED', (e) => audio.emit('PART_PLACED', { pan: e.x }));

// 3. 動く部品の気流音を毎フレーム更新する
function frame() {
  const speed01 = head.speed / head.maxSpeed; // 0 = 静止、1 = 全速
  if (audio.ready) audio.airflow('head').update(speed01, 1);
  requestAnimationFrame(frame);
}
```

## デモの実行

```bash
npm install
npm run dev        # http://localhost:5320 でデモを開く
npm test           # ユニットテスト
npm run build      # ライブラリ → dist/
npm run build:demo # 静的デモ → dist-demo/
```

Node.js 20 以上が必要です。ヘッドホン推奨。

## API

### `new MachineAudio(options?)`

| オプション | 既定値 | |
|---|---|---|
| `context` | — | 既存の `AudioContext`／`OfflineAudioContext` を使う。なければ `start()` が作成します。 |
| `latency` | `0.03` | 発音ごとに加える秒数。描画ループから予約した音が遅れて鳴らないようにします。 |
| `maxVoices` | `48` | 同時に鳴らせるワンショットの上限。 |
| `reverb` | `0.12` | 空間の量、0–1。 |

| メソッド | |
|---|---|
| `start()` | audio context を作成／再開します。クリックやタップのハンドラ内で呼んでください。iPhone のサイレントスイッチがオンでも音が出るようにします。 |
| `play(name, { when?, delay?, gain?, pan?, key?, category? })` | レシピを再生します。スキップされた場合（未知、無音、数ミリ秒前の同じ発音と統合）は `false`。 |
| `bind(event, recipe \| { recipe, gain?, category? })`／`emit(event, options?)` | シミュレーションのイベントをレシピに割り当てます。 |
| `define(name, recipe)` | 独自のレシピを追加します。 |
| `airflow(id, { style?, pan? })` | 名前付きの気流ボイスを取得／作成します。毎フレーム `.update(speed01, level)`、`.setStyle()` で音色変更、`.silence()` で停止。 |
| `setLevel('master' \| 'events' \| 'airflow', value)`、`setReverb(amount)` | ミックス。 |
| `output` | 最終ノード（リミッターの後）。アナライザーや `MediaRecorder` に接続できます。 |
| `suspend()`／`resume()`／`stopAll()`／`dispose()` | ライフサイクル。 |

### 内蔵レシピ

`click` · `tap` · `lift` · `hiss` · `leak` · `puff` · `feed` · `clamp` · `unclamp` · `shutter` · `swap` · `settle`

### 気流の音色

`AIRFLOW_STYLES.smooth`（既定）· `warm`（暗め・やわらか）· `airy`（軽め）· `slow`（ゆっくりしたうねり）

### 独自のレシピを書く

レシピはただのデータで、レイヤーの並びです。各レイヤーはバンドパスしたノイズか短いトーンで、それぞれにエンベロープがあります。

```ts
audio.define('latch', [
  { kind: 'noise', noise: 'pink', freq: 1400, q: 0.8, lowpass: 3500, gain: 0.5, attack: 0.004, decay: 0.04 },
  { kind: 'noise', noise: 'brown', freq: 220, q: 0.7, lowpass: 600, gain: 0.25, attack: 0.008, decay: 0.12, delay: 0.03 },
]);
audio.play('latch');
```

長時間でも心地よい音にするコツ：`q` は低め（約 0.6–1.5）にし、`lowpass` を加え、ノイズレイヤーには数ミリ秒以上の `attack` を与え、長いトーンのレイヤーは避けること。

### 低レベルの部品

エンジンが使う部品はすべてエクスポートされているので、独自の構成も組めます。

| エクスポート | |
|---|---|
| `renderRecipe(ctx, destination, noise, recipe, { when, gain })` | レシピを任意のノードに予約します。 |
| `AirflowVoice`、`getAirflowBuffers`、`AIRFLOW_STYLES` | 気流シンセサイザーと、FFT で整形したループバッファ。 |
| `createNoiseBank(ctx, seconds, seed)` | シード指定可能で、継ぎ目なくループするホワイト／ピンク／ブラウンノイズ。 |
| `createRoomImpulse(ctx)` | `ConvolverNode` 用の短くやわらかな空間インパルス応答。 |
| `VoicePool` | ボイス数の上限、古いボイスの奪取、連続イベントの統合。 |
| `EventScheduler` | シミュレーション用の決定的なイベントキュー（時刻、次に追加順）。 |
| `planMove`、`sampleMove` | 台形／S 字カーブの移動プロファイル。物理的にもっともらしい速度で気流を動かせます。 |

## 気流音のしくみ

2 層のループノイズを逆 FFT で一度だけ作ります（そのため継ぎ目なくループします）。

- **ボディ**：広い周波数カーブを持つノイズ。音量は速度の 2 乗に従い、その下に小さな常時の気流があります。スペクトル全体も速度とともに上へ移動します。
- **プッシュ**：ガウス形の低域ノイズ帯（共振ではありません）で、中心周波数が速度とともに上がります。ボディより速いエンベロープなので、動き出すたびにやわらかな「押し」が入ります。

高域のシェルフはボディより少し遅れて開き（「空気感」）、音像は左右にゆるやかに揺れます。オシレーターも共振フィルタも使わないので、うなりや笛のような音は出ません。

## ステータス

`0.1.0`：初期段階で、API は今後変わる可能性があります。npm にはまだ公開していません。

## 作者

制作：**TENMALOG** · 完全版：[qm4.rewrite.tw](https://qm4.rewrite.tw/)

## ライセンス

[MIT](LICENSE) © 2026 TENMALOG

MIT ライセンスの対象はこのリポジトリのコードのみです。QM-4 のサイト本体、その 3D モデル、キャラクター、アートワーク、調整済みのサウンドは別の作品であり、含まれません。
