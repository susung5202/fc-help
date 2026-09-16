export const ALERT_VOLUME_STORAGE_KEY = "fc-help-alert-volume";
export const DEFAULT_ALERT_VOLUME = 70;

export function getStoredAlertVolume() {
  if (typeof window === "undefined") return DEFAULT_ALERT_VOLUME;

  const raw = window.localStorage.getItem(ALERT_VOLUME_STORAGE_KEY);
  const value = Number(raw);

  if (!Number.isFinite(value)) return DEFAULT_ALERT_VOLUME;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function storeAlertVolume(volume: number) {
  if (typeof window === "undefined") return;

  const safeVolume = Math.min(100, Math.max(0, Math.round(volume)));
  window.localStorage.setItem(ALERT_VOLUME_STORAGE_KEY, String(safeVolume));
}

export async function playAlertSound(volume = getStoredAlertVolume()) {
  if (typeof window === "undefined" || volume <= 0) return false;

  type WindowWithWebkitAudio = Window &
    typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };

  const AudioContextConstructor =
    window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;

  if (!AudioContextConstructor) return false;

  const context = new AudioContextConstructor();

  try {
    await context.resume();

    const masterGain = context.createGain();
    const now = context.currentTime;
    const level = Math.min(1, Math.max(0, volume / 100));

    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, level * 0.22),
      now + 0.02
    );
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
    masterGain.connect(context.destination);

    const tones = [
      { frequency: 784, start: 0, duration: 0.2 },
      { frequency: 1046.5, start: 0.2, duration: 0.28 },
    ];

    for (const tone of tones) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + tone.start;
      const end = start + tone.duration;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.9, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start(start);
      oscillator.stop(end);
    }

    window.setTimeout(() => {
      void context.close();
    }, 850);

    return true;
  } catch {
    void context.close();
    return false;
  }
}
