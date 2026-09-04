type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'sign_lock' | 'speech_in';

class HapticFeedbackService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isHapticEnabled: boolean = true;
  private listeners: Set<(type: HapticPattern) => void> = new Set();

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  private initAudio() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
  }

  public subscribe(callback: (type: HapticPattern) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public setHapticsEnabled(enabled: boolean) {
    this.isHapticEnabled = enabled;
  }

  public setSoundEnabled(enabled: boolean) {
    this.isMuted = !enabled;
  }

  public trigger(pattern: HapticPattern = 'light') {
    // Notify visual listeners for screen ripple / tactile glow
    this.listeners.forEach((cb) => cb(pattern));

    // 1. Hardware Vibration API if available
    if (this.isHapticEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        switch (pattern) {
          case 'light':
            navigator.vibrate(25);
            break;
          case 'sign_lock':
            navigator.vibrate([35, 40, 50]);
            break;
          case 'medium':
            navigator.vibrate(50);
            break;
          case 'success':
            navigator.vibrate([30, 50, 40, 60, 80]);
            break;
          case 'speech_in':
            navigator.vibrate([20, 30, 20]);
            break;
          case 'warning':
            navigator.vibrate([100, 50, 100]);
            break;
          case 'heavy':
            navigator.vibrate(100);
            break;
        }
      } catch (e) {
        // Ignore vibration errors on restricted iframes
      }
    }

    // 2. Synthesized acoustic chime feedback
    if (!this.isMuted) {
      this.playAcousticCue(pattern);
    }
  }

  private playAcousticCue(pattern: HapticPattern) {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (pattern === 'sign_lock') {
        // Pleasant high chime: 880Hz -> 1046Hz (A5 -> C6)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1046, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (pattern === 'success') {
        // Major chord arpeggio
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (pattern === 'speech_in') {
        // Soft bubble pop
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.08);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (pattern === 'warning') {
        // Low cautionary double beep
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else {
        // Subtle micro-tick
        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, now);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch (err) {
      // Ignore audio playback restriction errors
    }
  }
}

export const hapticService = new HapticFeedbackService();
