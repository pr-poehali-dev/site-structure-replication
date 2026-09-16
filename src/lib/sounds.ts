/**
 * Звуковые эффекты шахматной партии: ход, взятие, шах, окончание партии.
 * Звуки синтезируются на лету через Web Audio API — без внешних аудиофайлов.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', gain = 0.2) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + start;
  gainNode.gain.setValueAtTime(0.0001, t0);
  gainNode.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function clickNoise(start: number, duration: number, freq: number, gain = 0.18) {
  const ctx = getCtx();
  if (!ctx) return;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 1.2;
  const gainNode = ctx.createGain();
  const t0 = ctx.currentTime + start;
  gainNode.gain.setValueAtTime(gain, t0);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  noise.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);
  noise.start(t0);
}

const STORAGE_KEY = 'chess_sound_enabled';

export function isSoundEnabled(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean) {
  try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch { /* ignore */ }
}

function withSound(fn: () => void) {
  if (!isSoundEnabled()) return;
  try { fn(); } catch { /* аудио может быть заблокировано браузером — тихо игнорируем */ }
}

/** Обычный тихий ход — короткий стук по доске. */
export function playMoveSound() {
  withSound(() => clickNoise(0, 0.05, 1600, 0.16));
}

/** Взятие фигуры — более резкий и глубокий стук. */
export function playCaptureSound() {
  withSound(() => {
    clickNoise(0, 0.07, 900, 0.22);
    tone(160, 0, 0.09, 'square', 0.07);
  });
}

/** Шах — два коротких предупреждающих сигнала. */
export function playCheckSound() {
  withSound(() => {
    tone(880, 0, 0.11, 'sine', 0.16);
    tone(1108, 0.1, 0.14, 'sine', 0.16);
  });
}

/** Окончание партии — победная, проигрышная или ничейная мелодия. */
export function playGameEndSound(outcome: 'win' | 'loss' | 'draw') {
  withSound(() => {
    if (outcome === 'win') {
      tone(523.25, 0, 0.16, 'sine', 0.18);
      tone(659.25, 0.14, 0.16, 'sine', 0.18);
      tone(783.99, 0.28, 0.28, 'sine', 0.18);
    } else if (outcome === 'loss') {
      tone(392, 0, 0.16, 'sine', 0.15);
      tone(349.23, 0.14, 0.16, 'sine', 0.15);
      tone(293.66, 0.28, 0.32, 'sine', 0.15);
    } else {
      tone(440, 0, 0.16, 'sine', 0.15);
      tone(440, 0.2, 0.22, 'sine', 0.15);
    }
  });
}
