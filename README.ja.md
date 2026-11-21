<div align="center">

# procedural-machine-audio

[English](README.md) · [繁體中文](README.zh-TW.md) · **日本語** · [Tiếng Việt](README.vi.md)

機械の音をリアルタイムに合成する Web Audio エンジンです。<br>
クリック音、空気圧のヒス音、クランプ音、高速で動くアームの気流音を生成します。<br>
サンプルプレーヤーではなくシンセサイザーです。すべての音をその場で生成し、オーディオファイルは使いません。

[ライブデモ](https://pma.rewrite.tw/) · [クイックスタート](#quick-start) · [API](#api-reference) · [しくみ](#how-the-airflow-works)

[![MIT License](https://img.shields.io/badge/license-MIT-2b313a?style=flat-square)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-2b313a?style=flat-square)
![Runtime dependencies: 0](https://img.shields.io/badge/runtime%20deps-0-2b313a?style=flat-square)
![Status: 0.1 preview](https://img.shields.io/badge/status-0.1%20preview-2b313a?style=flat-square)

<a href="https://pma.rewrite.tw/"><img src="docs/media/demo.gif" alt="デモ：グリッド上のターゲット間を移動するガントリーヘッド" width="720"></a>

<sub>この GIF は無音です。音は<a href="https://pma.rewrite.tw/">ライブデモ</a>、または<a href="docs/media/demo.mp4">音声付きの 12 秒クリップ</a>でお聴きください。ヘッドホンでの視聴を推奨します。</sub>

</div>

## 概要

シミュレーション、デジタルツイン、機械の可視化には、音がないか、数秒ごとに繰り返される少数のサンプル音しか付いていないことがよくあります。このライブラリは、シミュレーションそのものから音を生成します。

- **イベントが音になります。** シミュレーションのイベント（`PART_PLACED`、`VACUUM_ON` など）を短い音の*レシピ*に結び付け、`emit()` を呼び出します。
- **動きが気流になります。** 動いている部品の正規化された速度を毎フレーム渡すと、動きに合わせて気流音が盛り上がり、明るさを増し、押し出すような感触を生みます。
- **聴き疲れしにくい設計です。** 広帯域で共鳴しないフィルター、メロディーを持たない音作り、ほぼ同一のトリガーの統合、出力リミッターにより、長時間のセッションでも耳障りな音や響きが生じません。

**主な特長：** 組み込みレシピ 12 種 · 気流スタイル 4 種 · プレーンなデータで書けるカスタムレシピ · 録音とオフラインレンダリング · 実行時の依存パッケージなし。

このエンジンは、聴くために作られた架空のピックアンドプレース機の 3D シミュレーター [QM-4 · 機械の音](https://qm4.rewrite.tw/) から切り出したものです。

## インストール

このパッケージはまだ npm に公開されていません。GitHub からインストールしてください。インストール時に自動でコンパイルされます。

```bash
npm install github:TENMALOG/procedural-machine-audio
```

パッケージはインストール中にビルドされるため、Node.js 20 以降が必要です。

ES モジュールとして、TypeScript の型定義付きで提供されます。Vite、webpack、esbuild などのバンドラー、またはインポートマップ経由で読み込んでください。CDN 向けのビルドは提供していません。

<a id="quick-start"></a>
## クイックスタート

最小の動作例です。ボタンを押すとクリック音を 1 回再生します。ページに次のボタンを置きます。

```html
<button id="play">Play</button>
```

スクリプトは次のとおりです。

```ts
import { MachineAudio } from 'procedural-machine-audio';

const audio = new MachineAudio();

document.querySelector('#play')!.addEventListener('click', async () => {
  await audio.start(); // ブラウザーはユーザー操作の後でないとオーディオを許可しない
  audio.play('click');
});
```

ボタンを押すと、短くやわらかいクリック音が 1 回鳴ります。

一般的な組み込み方では、シミュレーションのイベントを結び付け、毎フレーム気流を駆動します。`startButton`、`simulation`、`head`、`halfWidth` は、お使いのアプリケーション側の要素を表しています。

```ts
import { MachineAudio } from 'procedural-machine-audio';

const audio = new MachineAudio();

// 1. ユーザー操作からオーディオを開始する。
startButton.addEventListener('click', () => void audio.start());

// 2. シミュレーションのイベントを組み込み（または独自）のレシピに対応付ける。
audio.bind('PART_PLACED', { recipe: 'click', gain: 0.9 });
audio.bind('VACUUM_ON', 'hiss');

// pan には −1（左）… 1（右）を渡すので、座標を正規化する。
simulation.on('PART_PLACED', (e) => audio.emit('PART_PLACED', { pan: e.x / halfWidth }));

// 3. 動いている部品の気流を、フレームごとに 1 回駆動する。
//    airflow() にはコンテキストが必要なので、audio.ready が true になるまで待つ。
function frame() {
  const speed01 = head.speed / head.maxSpeed; // 0 = 静止、1 = 最高速度
  if (audio.ready) audio.airflow('head').update(speed01, 1);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 4. ページが非表示の間は、オーディオ処理を一時停止する。
document.addEventListener('visibilitychange', () => {
  if (!audio.ready) return;
  if (document.hidden) audio.suspend();
  else audio.resume();
});
```

<a id="api-reference"></a>
## API リファレンス

### `new MachineAudio(options?)`

| オプション | 既定値 | 説明 |
|---|---|---|
| `context` | — | 既存の `AudioContext` または `OfflineAudioContext`。省略すると `start()` が作成します。 |
| `latency` | `0.03` | すべてのトリガーで現在時刻に加算する秒数。描画ループからスケジュールした音の開始が遅れないようにします。 |
| `maxVoices` | `48` | 同時に鳴らせるワンショットの最大数。上限に達すると、最も古いボイスが停止されます。 |
| `reverb` | `0.12` | ルームリバーブの量。0（ドライ）から 1 まで。 |
| `noiseSeconds` | `5` | 共有ノイズバッファの長さ（秒）。 |

### メソッドとプロパティ

| メンバー | 戻り値 | 説明 |
|---|---|---|
| `start()` | `Promise<void>` | オーディオコンテキストを作成または再開します。クリックまたはタップのハンドラー内で呼び出してください。iOS ではメディア再生も要求し、サイレントスイッチでページが消音されないようにします（[ブラウザーサポート](#browser-support)を参照）。 |
| `play(name, options?)` | `boolean` | レシピを再生します。音がスキップされた場合は `false` を返します。スキップされるのは、コンテキストがまだない場合、未知のレシピの場合、ゲインが 0 の場合、または数ミリ秒前の同じ `key` のトリガーと統合された場合です。 |
| `bind(event, binding)` | `void` | イベント名をレシピ名、または `Binding` オブジェクト `{ recipe, gain?, category? }` に対応付けます。 |
| `emit(event, options?)` | `boolean` | `event` に結び付けられたレシピを再生します。呼び出しごとの `gain` は結び付けられたゲインに乗算されます。呼び出しで `category` を指定しない限り、バインディングの `category` が使われます。 |
| `define(name, recipe)` | `void` | カスタムレシピを登録します。組み込みレシピを置き換えることもできます。 |
| `airflow(id?, options?)` | `AirflowVoice` | `id`（既定値は `'default'`）という名前の気流ボイスを返し、初回使用時に作成します。コンテキストがまだない場合は**例外をスロー**するため、`start()` の後に呼び出すか、`ready` を確認してください。オプションは[気流ボイス](#airflow-voices)を参照してください。 |
| `setLevel(bus, value)` / `getLevel(bus)` | `void` / `number` | `'master'`（既定値 `0.8`）、`'events'`（`1.5`）、`'airflow'`（`0.3`）の各バスのリニアレベル。 |
| `setReverb(amount)` | `void` | リバーブ量を変更します。0〜1 の範囲に丸められます。 |
| `output` | `AudioNode \| null` | リミッターの後段にある最終ノード。コンテキストができるまでは `null` です。すでにスピーカーに接続されています。可視化や録音には、`AnalyserNode` や `MediaStreamAudioDestinationNode` を接続してください。 |
| `context` | `BaseAudioContext \| null` | 使用中のオーディオコンテキスト。 |
| `ready` | `boolean` | 再生先のコンテキストができると `true` になります。 |
| `stats()` | object | デバッグ用の `{ voices, nodes, started, aggregated, stolen, released }`。 |
| `recipes` | object | 現在登録されているレシピ（名前をキーとするオブジェクト）。 |
| `suspend()` / `resume()` | `Promise<void>` | オーディオ処理の一時停止と再開。たとえばページが非表示のときに使います。 |
| `stopAll()` / `dispose()` | `void` | すべてのワンショットを停止し、すべての気流ボイスをフェードアウトします。／すべてのノードを解放し、コンテキストを閉じます。 |

`play()` と `emit()` のオプション：

| オプション | 説明 |
|---|---|
| `when` | 開始するコンテキスト上の絶対時刻。`delay` より優先されます。 |
| `delay` | 現在からの秒数（`latency` を加算）。 |
| `gain` | リニアのゲイン乗数。 |
| `pan` | ステレオ位置。−1（左）から 1（右）まで。 |
| `key` | 約 6 ms 以内に同じキーで発生したトリガーは 1 つに統合されます。既定値はレシピ名です。 |
| `category` | 同じカテゴリーのボイスは 14 までに制限されます（0.1 では `MachineAudio` 経由で設定できません）。これにより、頻繁に鳴る音がプール全体を使い切ることを防ぎます。既定値はレシピ名です。 |

### 注意すべき動作

- **どこでも構築でき、開始はブラウザーで行います。** `new MachineAudio()` はサーバーサイドレンダリング中でも安全に呼び出せます。`AudioContext` が存在しない環境では `start()` が例外をスローします。
- **繰り返しごとにわずかに変化します。** `MachineAudio` 経由で再生されるすべてのワンショットは、フィルターとオシレーターの開始周波数が最大 ±6% の範囲でランダムにデチューンされるため、繰り返しのトリガーが同一の音になりません。
- **ボイススティールはなめらかです。** 上限に達すると、最も古いボイスは途中で切られず、数ミリ秒かけてフェードアウトします。
- **`dispose()` はコンテキストを閉じます。** コンテキストが `AudioContext` の場合に該当し、`context` 経由で渡したものも含まれます。
- **気流ボイスは保持されます。** 各 `id` のボイスは `audio.dispose()` まで残ります。その id を再び使う場合は、ボイス自身の `dispose()` を呼ばないでください。動く部品ごとに 1 つの id を使い回し、停止時は `silence()` を呼んでください。移動のたびに新しい id を作らないでください。

<a id="airflow-voices"></a>
### 気流ボイス

`airflow(id, options)` のオプションです。ボイスの作成時にのみ使用されます。

| オプション | 既定値 | 説明 |
|---|---|---|
| `style` | `AIRFLOW_STYLES.smooth` | `AirflowStyle` オブジェクト。組み込みスタイルのいずれか、または独自のもの（組み込みスタイルを展開してフィールドを変更）を指定します。 |
| `pan` | — | 固定のステレオ位置。−1 から 1 まで（`play()` と異なり、範囲への丸めは行われません）。 |
| `bufferLength` | `524288`（2¹⁹） | ループバッファの長さ（サンプル数）。2 のべき乗にします。短いほど構築が速く、長いほどループが目立ちにくくなります。 |
| `trim` | `0.56` | 出力トリム。`update()` の `level` と乗算されます。 |

| メンバー | 説明 |
|---|---|
| `update(speed01, level, at?)` | フレームごとに 1 回呼び出します。`speed01` は正規化された速度（0〜1）、`level` はリニアゲインで、`trim` と乗算されます。既定のバランスにするには `1` を渡し、全体のミックスには `setLevel('airflow', …)` を使います。 |
| `setStyle(style)` | 別のスタイル（たとえば `AIRFLOW_STYLES.warm`）に切り替えます。ボイスは無音から再開し、次の `update()` に追従します。 |
| `silence(at?)` | ボイスをフェードアウトします。たとえば機械が停止したときに使います。 |
| `dispose()` | ボイスを停止し、接続を解除します。 |

組み込みスタイルは `AIRFLOW_STYLES` としてエクスポートされています。`smooth`（既定、標準）、`warm`（より暗くやわらかい音）、`airy`（より軽い音）、`slow`（ゆっくり盛り上がる）。

```ts
import { AIRFLOW_STYLES } from 'procedural-machine-audio';

audio.airflow('head', { style: AIRFLOW_STYLES.warm, pan: -0.3 });
```

### 組み込みレシピ

`click` · `tap` · `lift` · `hiss` · `leak` · `puff` · `feed` · `clamp` · `unclamp` · `shutter` · `swap` · `settle`

レシピ自体は `RECIPES`（名前の型は `BuiltInRecipe`）としてエクスポートされているため、出発点としてコピーして使えます。

## カスタムレシピ

レシピはプレーンなデータで、レイヤーの配列です。レイヤーはバンドパスをかけたノイズか短いトーンのいずれかで、それぞれ独自のエンベロープを持ちます。

```ts
import type { Recipe } from 'procedural-machine-audio';

const latch: Recipe = [
  { kind: 'noise', noise: 'pink', freq: 1400, q: 0.8, lowpass: 3500, gain: 0.5, attack: 0.004, decay: 0.04 },
  { kind: 'noise', noise: 'brown', freq: 220, q: 0.7, lowpass: 600, gain: 0.25, attack: 0.008, decay: 0.12, delay: 0.03 },
];

audio.define('latch', latch);
audio.play('latch');
```

| フィールド | ノイズレイヤー | トーンレイヤー | 説明 |
|---|---|---|---|
| `kind` | 必須 | 必須 | `'noise'` または `'tone'`。 |
| `noise` | 必須 | — | `'white'`、`'pink'`、`'brown'` のいずれか。 |
| `freq` | 必須 | 必須 | バンドパスの中心周波数（ノイズ）またはオシレーターの周波数（トーン）。単位は Hz。 |
| `q` | 必須 | — | バンドパスの Q。 |
| `wave` | — | 任意 | オシレーターの種類。既定値は `'sine'`。 |
| `gain` | 必須 | 必須 | レイヤーのピークゲイン。 |
| `attack` | 必須 | 任意 | 無音からピークまでの秒数（トーンの既定値は `0.001`）。 |
| `decay` | 必須 | 必須 | ピークから −80 dB までの秒数。聴き取れるのはおおよそ最初の 3 分の 1 です。 |
| `sweepTo` | 任意 | 任意 | グライド先の周波数（Hz）。ノイズではバンドパスの中心（`attack` + `decay` の間）、トーンではピッチ（`decay` の間）です。 |
| `lowpass` | 任意 | 任意 | レイヤーの後段に置くローパスフィルター。単位は Hz。 |
| `delay` | 任意 | 任意 | トリガー時刻からのオフセット（秒）。 |

長時間のセッションでも心地よい音を保つには、`q` を低く（0.6〜1.5 程度）し、`lowpass` を加え、ノイズレイヤーには数ミリ秒の `attack` を与え、長く続くトーンのレイヤーは避けてください。

## 録音とオフラインレンダリング

再生中の音を録音するには、`output` を `MediaStreamAudioDestinationNode` に接続し、`MediaRecorder` を使います。

```ts
const ctx = audio.context as AudioContext; // リアルタイムのコンテキスト（start() の後）
const dest = ctx.createMediaStreamDestination();
audio.output!.connect(dest);

const recorder = new MediaRecorder(dest.stream);
const chunks: Blob[] = [];
recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.onstop = () => {
  const file = new Blob(chunks, { type: recorder.mimeType }); // 例：audio/webm
};
recorder.start();
```

スピーカーを使わずにリアルタイムより高速にレンダリングするには（たとえばテストでレシピを解析する場合や、音を書き出す場合）、`OfflineAudioContext` を渡します。この場合、`start()` は不要です。

```ts
const ctx = new OfflineAudioContext(2, 48000 * 2, 48000); // 2 秒、ステレオ
const audio = new MachineAudio({ context: ctx });

audio.play('click', { when: 0.1 });
audio.play('hiss', { when: 0.5 });

const buffer = await ctx.startRendering(); // AudioBuffer
```

## ビルディングブロック

エンジン内部の部品もエクスポートされているため、独自のシグナルグラフを組み立てられます。主なものは次のとおりです。

| エクスポート | 説明 |
|---|---|
| `renderRecipe(ctx, destination, noise, recipe, { when, gain?, jitter?, random? })` | 任意の `AudioNode` に対してレシピをスケジュールします。`jitter` はトリガーごとのランダムなデチューン量です（既定値 `0.06` = ±6%、`0` = 毎回同一）。`random` は `Math.random` の代わりに使われ、再現可能な出力を得られます。 |
| `RECIPES` | 組み込みレシピ（データ）。 |
| `AirflowVoice`, `getAirflowBuffers`, `AIRFLOW_STYLES` | 気流シンセサイザーと、FFT で成形したループバッファ。 |
| `createNoiseBank(ctx, seconds?, seed?)` | シード付きで、継ぎ目なくループするホワイト、ピンク、ブラウンノイズ（既定値：`5` 秒、シード `12345`）。 |
| `createRoomImpulse(ctx)` | `ConvolverNode` 用の、短くやわらかいルームインパルス応答。 |
| `VoicePool` | ボイス数の上限、最古ボイスのスティール、ほぼ同一のトリガーの統合。 |
| `EventScheduler` | 時刻順、同時刻なら挿入順に並べる、決定論的なイベントキュー。 |
| `planMove`, `sampleMove` | 台形およびS字カーブの動作プロファイル。もっともらしい速度で気流を駆動するために使います（下記の例を参照）。 |
| `unlockSilentSwitch`, `pauseSilentSwitch` | `start()` と `suspend()` が使う、iOS のサイレントスイッチ対応。 |

TypeScript の型も併せてエクスポートされています。`MachineAudioOptions`、`PlayOptions`、`Binding`、`LevelName`、`Recipe`、`Layer`、`NoiseLayer`、`ToneLayer`、`AirflowStyle`、`AirflowOptions`、`MotionLimits`、`MoveProfile`、`MoveSample` などです。詳しくは [`src/index.ts`](src/index.ts) を参照してください。

シミュレーションが動きをモデル化していない場合は、`planMove` を使うと、気流に与えるリアルな速度カーブを得られます。

```ts
import { planMove, sampleMove } from 'procedural-machine-audio';

const limits = { vmax: 1400, amax: 14000 };        // units/s と units/s²
const move = planMove(distance, limits, 'scurve'); // または 'trapezoid'

// フレームごとに。t = 動作開始からの経過秒数：
const { s, v } = sampleMove(move, t);              // 移動距離、現在の速度
audio.airflow('head').update(v / limits.vmax, 1);
```

<a id="how-the-airflow-works"></a>
## 気流のしくみ

```
one-shots ─┐            ┌─ dry ─────────┐
           ├─ mix ──────┤               ├─ master ─ limiter ─ output
airflow ───┘            └─ room reverb ─┘
```

各気流ボイスは、ループする 2 つのノイズレイヤーを再生します。どちらも逆 FFT で一度だけ生成されるため、継ぎ目なくループします。

- **ボディ**：広いスペクトル曲線を持つノイズです。レベルは、静かな一定の下地の上で速度の 2 乗に従って変化し、速度が上がるにつれてスペクトル全体が上方へ滑らかに移動します。
- **プッシュ**：低周波ノイズのガウス帯域（共鳴ではありません）で、中心は速度とともに上昇します。エンベロープの反応はボディより速く、各動作の始まりでやわらかい押し出し感を生みます。

ハイシェルフはボディからわずかに遅れて開き（「空気感」）、ステレオイメージは速度に応じて穏やかに揺れます。気流の経路にはオシレーターも共鳴フィルターもないため、響きや笛のような音は生じません。

<a id="browser-support"></a>
## ブラウザーサポート

このライブラリには Web Audio API（`AudioContext`）が必要で、ブラウザー間での体系的なテストはまだ行われていません。

- `StereoPannerNode` が利用できない環境では、`pan` は無視されます。
- iPhone と iPad では、Web Audio は既定でサイレントスイッチによって消音されます。`start()` は、Safari が対応している環境では `navigator.audioSession.type` を `'playback'` に設定し、無音のループするメディア要素も再生します。これにより、ページがメディア再生として扱われます。`suspend()` はその要素を一時停止し、`resume()` は再開します。

## 制限事項

- ワンショットは、フィルターをかけたノイズと短いトーンだけで構成されます。このライブラリはオーディオファイルを再生しません。
- 空間（3D）の定位はなく、配置はステレオパンニングに限られます。
- 気流のループバッファは、ボイスまたはスタイルを初めて使うときにメインスレッドで生成されます。既定のバッファ長では、体感できる程度の時間がかかることがあります。

## 開発

```bash
npm install
npm run dev         # http://localhost:5320 でデモを起動
npm test            # 単体テスト（Vitest）
npm run typecheck   # TypeScript、strict モード
npm run build       # ライブラリ → dist/
npm run build:demo  # 静的デモ → dist-demo/
```

Node.js 20 以降が必要です。

## プロジェクトの状況

バージョン `0.1.0` は初期プレビューです。1.0 より前に API が変更される可能性があります。破壊的変更は、タグ付きの [GitHub リリース](https://github.com/TENMALOG/procedural-machine-audio/releases)で告知します。

## コントリビューション

バグ報告や提案は [Issues](https://github.com/TENMALOG/procedural-machine-audio/issues) で歓迎します。プルリクエストを開く前に、`npm test` と `npm run typecheck` を実行してください。

## ライセンス

[MIT](LICENSE) © 2026 TENMALOG.

QM-4 のウェブサイト、その 3D モデル、アートワーク、調整済みのサウンド設定は別個の著作物であり、このリポジトリには含まれません。
