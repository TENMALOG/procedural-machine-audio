/** Demo page text in four languages. The library itself has no user-facing text. */
export type Lang = 'en' | 'zh' | 'ja' | 'vi';

export const LANGS: { id: Lang; label: string; html: string }[] = [
  { id: 'en', label: 'English', html: 'en' },
  { id: 'zh', label: '繁體中文', html: 'zh-Hant' },
  { id: 'ja', label: '日本語', html: 'ja' },
  { id: 'vi', label: 'Tiếng Việt', html: 'vi' },
];

const en = {
  lead: 'A gantry head moves between random targets. Its airflow follows the real speed of an S-curve move, and every arrival plays a click and a short hiss. Every sound is synthesized live — no audio files. Headphones recommended.',
  canvas: 'Animated gantry demo',
  start: 'Start sound',
  on: 'Sound on',
  pause: 'Pause',
  resume: 'Resume',
  speed: 'Speed',
  airflow: 'Airflow',
  events: 'Clicks',
  reverb: 'Room',
  master: 'Volume',
  style: 'Style',
  language: 'Language',
  off: 'sound is off',
  stats: 'voices {v} · started {s} · merged {m}',
  by: 'By',
  extracted: 'The full experience this engine was extracted from:',
  qm4: 'QM-4 · The sound of a machine',
  'style.smooth': 'smooth',
  'style.warm': 'warm',
  'style.airy': 'airy',
  'style.slow': 'slow',
};

type Key = keyof typeof en;

const zh: Record<Key, string> = {
  lead: '一個移動頭在隨機的目標之間移動。它的氣流聲跟著 S 曲線運動的真實速度變化，每次到位都會發出一下喀聲和一小聲嘶聲。所有聲音都是即時合成，沒有任何音檔。建議戴上耳機。',
  canvas: '移動頭動畫示範',
  start: '開啟聲音',
  on: '聲音已開啟',
  pause: '暫停',
  resume: '繼續',
  speed: '速度',
  airflow: '氣流',
  events: '喀聲',
  reverb: '空間',
  master: '音量',
  style: '音色',
  language: '語言',
  off: '聲音未開啟',
  stats: '聲部 {v} · 已觸發 {s} · 已合併 {m}',
  by: '作者',
  extracted: '這個引擎取自完整作品：',
  qm4: 'QM-4 · 機器的聲音',
  'style.smooth': '平順',
  'style.warm': '溫暖',
  'style.airy': '輕盈',
  'style.slow': '緩慢',
};

const ja: Record<Key, string> = {
  lead: 'ガントリーのヘッドがランダムな目標の間を移動します。気流の音は S 字カーブの実際の速度に合わせて変化し、到着するたびにクリック音と短いエア音が鳴ります。音はすべてリアルタイム合成で、音声ファイルは使っていません。ヘッドホン推奨。',
  canvas: 'ガントリーのアニメーションデモ',
  start: '音を出す',
  on: '音が出ています',
  pause: '一時停止',
  resume: '再開',
  speed: '速度',
  airflow: '気流',
  events: 'クリック',
  reverb: '空間',
  master: '音量',
  style: '音色',
  language: '言語',
  off: '音はオフです',
  stats: 'ボイス {v} · 発音 {s} · 統合 {m}',
  by: '制作',
  extracted: 'このエンジンの元になった作品：',
  qm4: 'QM-4 · 機械の音',
  'style.smooth': 'なめらか',
  'style.warm': 'あたたか',
  'style.airy': '軽やか',
  'style.slow': 'ゆっくり',
};

const vi: Record<Key, string> = {
  lead: 'Một đầu gantry di chuyển giữa các điểm ngẫu nhiên. Tiếng luồng khí thay đổi theo tốc độ thật của chuyển động đường cong S, và mỗi lần đến nơi sẽ có một tiếng tách cùng một tiếng xì ngắn. Mọi âm thanh đều được tổng hợp trực tiếp, không dùng tệp âm thanh nào. Nên dùng tai nghe.',
  canvas: 'Bản demo hoạt hình gantry',
  start: 'Bật âm thanh',
  on: 'Đang bật âm thanh',
  pause: 'Tạm dừng',
  resume: 'Tiếp tục',
  speed: 'Tốc độ',
  airflow: 'Luồng khí',
  events: 'Tiếng tách',
  reverb: 'Không gian',
  master: 'Âm lượng',
  style: 'Âm sắc',
  language: 'Ngôn ngữ',
  off: 'âm thanh đang tắt',
  stats: 'giọng {v} · đã phát {s} · đã gộp {m}',
  by: 'Tác giả',
  extracted: 'Tác phẩm đầy đủ mà engine này được tách ra từ đó:',
  qm4: 'QM-4 · Âm thanh của một cỗ máy',
  'style.smooth': 'êm',
  'style.warm': 'ấm',
  'style.airy': 'nhẹ',
  'style.slow': 'chậm',
};

const TABLE: Record<Lang, Record<Key, string>> = { en, zh, ja, vi };

export function t(lang: Lang, key: Key, vars: Record<string, string | number> = {}): string {
  return (TABLE[lang][key] ?? en[key]).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

/** First supported language in the device's preference list; English otherwise. Chinese always uses Traditional. */
export function detectLang(prefs: readonly string[] = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []): Lang {
  for (const raw of prefs) {
    const n = String(raw).toLowerCase();
    if (n.startsWith('zh')) return 'zh';
    if (n.startsWith('ja')) return 'ja';
    if (n.startsWith('vi')) return 'vi';
    if (n.startsWith('en')) return 'en';
  }
  return 'en';
}

export function readLang(): Lang {
  const q = new URLSearchParams(location.search).get('lang');
  if (q && LANGS.some((l) => l.id === q)) return q as Lang;
  try {
    const v = localStorage.getItem('pma.lang');
    if (v && LANGS.some((l) => l.id === v)) return v as Lang;
  } catch {
    /* storage unavailable */
  }
  return detectLang();
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem('pma.lang', lang);
  } catch {
    /* storage unavailable */
  }
}
