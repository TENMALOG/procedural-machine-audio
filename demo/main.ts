import { AIRFLOW_STYLES, MachineAudio, planMove, sampleMove, type AirflowStyle, type MoveProfile } from '../src/index';
import { LANGS, readLang, saveLang, t, type Lang } from './i18n';

// ---- language (four languages; follows the device until the visitor picks one) ----
let lang: Lang = readLang();
function applyLang() {
  document.documentElement.lang = LANGS.find((l) => l.id === lang)!.html;
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(lang, el.dataset.i18n as never);
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-label]')) el.setAttribute('aria-label', t(lang, el.dataset.i18nLabel as never));
  const start = document.getElementById('start') as HTMLButtonElement | null;
  if (start?.disabled) start.textContent = t(lang, 'on');
  const pause = document.getElementById('pause');
  if (pause && paused) pause.textContent = t(lang, 'resume');
}
const langSel = document.getElementById('lang') as HTMLSelectElement;
for (const l of LANGS) langSel.add(new Option(l.label, l.id));
langSel.value = lang;
langSel.addEventListener('change', () => {
  lang = langSel.value as Lang;
  saveLang(lang);
  applyLang();
});

/**
 * Demo: a two-axis gantry. The head travels between random targets with an S-curve profile;
 * the airflow voice is driven by its real speed, and arrivals trigger one-shots through bind/emit.
 */
const canvas = document.getElementById('view') as HTMLCanvasElement;
const g = canvas.getContext('2d')!;
const W = canvas.width, H = canvas.height;
const PAD = 90;
const LIMITS = { vmax: 1400, amax: 14000 }; // px/s, px/s²

const audio = new MachineAudio({ reverb: 0.12 });
audio.bind('ARRIVED', { recipe: 'click', gain: 0.9 });
audio.bind('GRIPPED', { recipe: 'hiss', gain: 0.7 });
audio.bind('FED', { recipe: 'feed', gain: 0.6 });
audio.bind('SETTLED', { recipe: 'settle' });
// Development only: lets automated checks inspect the engine from the browser console
if (import.meta.env.DEV) (window as unknown as { __demo: unknown }).__demo = { audio };

// ---- state ----
let speedScale = 1;
let paused = false;
let pos = { x: W / 2, y: H / 2 };
let move: { from: { x: number; y: number }; to: { x: number; y: number }; p: MoveProfile; t0: number } | null = null;
let dwellUntil = 0;
let simTime = 0;
let lastFrame = performance.now();
const trail: { x: number; y: number; t: number }[] = [];
const flashes: { x: number; y: number; t: number }[] = [];

function nextTarget() {
  const to = { x: PAD + Math.random() * (W - 2 * PAD), y: PAD + Math.random() * (H - 2 * PAD) };
  const d = Math.hypot(to.x - pos.x, to.y - pos.y);
  const lim = { vmax: LIMITS.vmax * speedScale, amax: LIMITS.amax * speedScale * speedScale };
  move = { from: { ...pos }, to, p: planMove(d, lim, 'scurve'), t0: simTime };
}

/** Normalised speed of the head this frame (0..1 of the nominal top speed). */
function step(dt: number): number {
  simTime += dt;
  if (!move) {
    if (simTime >= dwellUntil) nextTarget();
    return 0;
  }
  const t = simTime - move.t0;
  const s = sampleMove(move.p, t);
  const k = move.p.distance > 0 ? s.s / move.p.distance : 1;
  pos = { x: move.from.x + (move.to.x - move.from.x) * k, y: move.from.y + (move.to.y - move.from.y) * k };
  trail.push({ ...pos, t: simTime });
  if (t >= move.p.duration) {
    const pan = (pos.x / W) * 2 - 1;
    audio.emit('ARRIVED', { pan: pan * 0.6 });
    audio.emit('GRIPPED', { delay: 0.06 + Math.random() * 0.04, pan: pan * 0.6 });
    if (Math.random() < 0.35) audio.emit('FED', { delay: 0.25, pan: -0.5 });
    audio.emit('SETTLED', { delay: 0.01 });
    flashes.push({ ...pos, t: simTime });
    move = null;
    dwellUntil = simTime + 0.18 + Math.random() * 0.35;
  }
  return s.v / LIMITS.vmax;
}

function draw() {
  g.fillStyle = '#0b0d10';
  g.fillRect(0, 0, W, H);
  // work area grid
  g.strokeStyle = '#1b2027';
  g.lineWidth = 1;
  for (let x = PAD; x <= W - PAD; x += 60) { g.beginPath(); g.moveTo(x, PAD); g.lineTo(x, H - PAD); g.stroke(); }
  for (let y = PAD; y <= H - PAD; y += 60) { g.beginPath(); g.moveTo(PAD, y); g.lineTo(W - PAD, y); g.stroke(); }
  // gantry beam (moves in y) and carriage (moves in x)
  g.fillStyle = '#2b313a';
  g.fillRect(PAD - 30, pos.y - 14, W - 2 * PAD + 60, 28);
  g.fillStyle = '#3a414c';
  g.fillRect(PAD - 44, 30, 14, H - 60);
  g.fillRect(W - PAD + 30, 30, 14, H - 60);
  // trail
  while (trail.length && simTime - trail[0].t > 0.6) trail.shift();
  for (let i = 1; i < trail.length; i++) {
    const a = 1 - (simTime - trail[i].t) / 0.6;
    g.strokeStyle = `rgba(127,182,255,${a * 0.5})`;
    g.lineWidth = 6 * a;
    g.beginPath(); g.moveTo(trail[i - 1].x, trail[i - 1].y); g.lineTo(trail[i].x, trail[i].y); g.stroke();
  }
  // arrival rings
  while (flashes.length && simTime - flashes[0].t > 0.5) flashes.shift();
  for (const f of flashes) {
    const u = (simTime - f.t) / 0.5;
    g.strokeStyle = `rgba(232,234,237,${1 - u})`;
    g.lineWidth = 2;
    g.beginPath(); g.arc(f.x, f.y, 10 + u * 30, 0, Math.PI * 2); g.stroke();
  }
  // head
  g.fillStyle = '#e8eaed';
  g.fillRect(pos.x - 26, pos.y - 26, 52, 52);
  g.fillStyle = '#101215';
  g.beginPath(); g.arc(pos.x, pos.y, 7, 0, Math.PI * 2); g.fill();
}

const statsEl = document.getElementById('stats')!;
function frame(now: number) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (!paused) {
    const speed = step(dt);
    if (audio.ready) audio.airflow('head').update(speed, 1);
    const s = audio.stats();
    statsEl.textContent = audio.ready ? t(lang, 'stats', { v: s.voices, s: s.started, m: s.aggregated }) : t(lang, 'off');
  }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- controls ----
const startBtn = document.getElementById('start') as HTMLButtonElement;
const pauseBtn = document.getElementById('pause') as HTMLButtonElement;
startBtn.addEventListener('click', async () => {
  await audio.start();
  audio.airflow('head', { style: AIRFLOW_STYLES[(document.getElementById('style') as HTMLSelectElement).value as keyof typeof AIRFLOW_STYLES] });
  startBtn.disabled = true;
  startBtn.textContent = t(lang, 'on');
  pauseBtn.disabled = false;
});
pauseBtn.addEventListener('click', async () => {
  paused = !paused;
  pauseBtn.textContent = t(lang, paused ? 'resume' : 'pause');
  if (paused) {
    audio.airflow('head').silence();
    await audio.suspend();
  } else await audio.resume();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) void audio.suspend();
  else if (!paused) void audio.resume();
});

function slider(id: string, apply: (v: number) => void) {
  const input = document.getElementById(id) as HTMLInputElement;
  const out = input.parentElement!.querySelector('output')!;
  const update = () => {
    out.textContent = Number(input.value).toFixed(2);
    apply(Number(input.value));
  };
  input.addEventListener('input', update);
  update();
}
applyLang();
slider('speed', (v) => (speedScale = v));
slider('airflow', (v) => audio.setLevel('airflow', v));
slider('events', (v) => audio.setLevel('events', v));
slider('reverb', (v) => audio.setReverb(v));
slider('master', (v) => audio.setLevel('master', v));
document.getElementById('style')!.addEventListener('change', (e) => {
  const style: AirflowStyle = AIRFLOW_STYLES[(e.target as HTMLSelectElement).value as keyof typeof AIRFLOW_STYLES];
  if (audio.ready) audio.airflow('head').setStyle(style);
});
