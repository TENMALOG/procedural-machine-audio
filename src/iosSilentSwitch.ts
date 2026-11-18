/**
 * On iPhone and iPad, Web Audio is treated like a ringtone: with the side silent switch on, nothing
 * plays. Call unlockSilentSwitch() inside a user gesture (for example the "start" click):
 *  1. Safari 17+: navigator.audioSession.type = "playback" (the media category, unaffected by the switch)
 *  2. older iOS: also play a silent, looping <audio> element so the page counts as media playback
 * Step 2 only runs on iOS.
 */
let silent: HTMLAudioElement | null = null;

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Half a second of 8 kHz, 16-bit silence as a WAV blob URL. */
function silentWavUrl(): string {
  const n = 4000;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export function unlockSilentSwitch() {
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
  } catch {
    /* not supported */
  }
  if (!isIOS() || typeof Audio === 'undefined') return;
  try {
    if (!silent) {
      silent = new Audio(silentWavUrl());
      silent.loop = true;
      silent.setAttribute('playsinline', '');
    }
    void silent.play().catch(() => undefined);
  } catch {
    /* the main audio still works without it */
  }
}

export function pauseSilentSwitch() {
  silent?.pause();
}
