/**
 * Zero-Dependency Procedural Web Audio API Synthesizer
 * Provides Apple-style high-fidelity audio feedback with pure procedural oscillators.
 * Safe in Node.js, SSR, and Edge runtimes.
 */

const STORAGE_KEY_MUTED = "senior_broker_sound_muted";
const STORAGE_KEY_VOLUME = "senior_broker_sound_volume";

class WebAudioSynthesizer {
  private audioCtx: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private muted: boolean = false;
  private volume: number = 0.7;
  private unlockListenersAttached: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const savedMuted = localStorage.getItem(STORAGE_KEY_MUTED);
        if (savedMuted !== null) {
          this.muted = savedMuted === "true";
        }
        const savedVol = localStorage.getItem(STORAGE_KEY_VOLUME);
        if (savedVol !== null) {
          const parsed = parseFloat(savedVol);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            this.volume = parsed;
          }
        }
      } catch (e) {
        // LocalStorage may be restricted in private/iframe modes
      }
      this.attachUnlockListeners();
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    try {
      if (!this.audioCtx) {
        const AudioContextClass =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
          this.masterGainNode = this.audioCtx.createGain();
          this.masterGainNode.gain.setValueAtTime(
            this.muted ? 0 : this.volume,
            this.audioCtx.currentTime
          );
          this.masterGainNode.connect(this.audioCtx.destination);
        }
      }

      if (this.audioCtx && this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(() => {});
      }

      return this.audioCtx;
    } catch (e) {
      return null;
    }
  }

  public attachUnlockListeners(): void {
    if (typeof window === "undefined" || this.unlockListenersAttached) return;
    this.unlockListenersAttached = true;

    const unlock = () => {
      const ctx = this.getContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("click", unlock, { once: true, passive: true });
    window.addEventListener("touchstart", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true, passive: true });
  }

  public async unlockAudio(): Promise<void> {
    const ctx = this.getContext();
    if (ctx && ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(STORAGE_KEY_MUTED, String(muted));
    } catch (e) {}

    if (this.masterGainNode && this.audioCtx) {
      this.masterGainNode.gain.setValueAtTime(
        muted ? 0 : this.volume,
        this.audioCtx.currentTime
      );
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.volume = clamped;
    try {
      localStorage.setItem(STORAGE_KEY_VOLUME, String(clamped));
    } catch (e) {}

    if (this.masterGainNode && this.audioCtx && !this.muted) {
      this.masterGainNode.gain.setValueAtTime(clamped, this.audioCtx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  /**
   * Ascending Harmonic Arpeggio: C6 -> E6 -> G6 -> C7
   * Triumphant target reached chime for scaling T1 or taking full profit.
   */
  public playTargetChime(): void {
    if (this.muted) return;
    try {
      const ctx = this.getContext();
      if (!ctx || !this.masterGainNode) return;

      const now = ctx.currentTime;

      // Note 1: C6 (1046.50 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1046.5, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(this.masterGainNode);
      osc1.start(now);
      osc1.stop(now + 0.55);

      // Note 2: E6 (1318.51 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1318.51, now + 0.12);
      gain2.gain.setValueAtTime(0, now + 0.12);
      gain2.gain.linearRampToValueAtTime(0.22, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc2.connect(gain2);
      gain2.connect(this.masterGainNode);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.9);

      // Note 3: G6 (1567.98 Hz)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(1567.98, now + 0.24);
      gain3.gain.setValueAtTime(0, now + 0.24);
      gain3.gain.linearRampToValueAtTime(0.2, now + 0.28);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc3.connect(gain3);
      gain3.connect(this.masterGainNode);
      osc3.start(now + 0.24);
      osc3.stop(now + 1.25);

      // Note 4: C7 Shimmer Overtone (2093.00 Hz)
      const osc4 = ctx.createOscillator();
      const gain4 = ctx.createGain();
      osc4.type = "sine";
      osc4.frequency.setValueAtTime(2093.0, now + 0.36);
      gain4.gain.setValueAtTime(0, now + 0.36);
      gain4.gain.linearRampToValueAtTime(0.15, now + 0.4);
      gain4.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      osc4.connect(gain4);
      gain4.connect(this.masterGainNode);
      osc4.start(now + 0.36);
      osc4.stop(now + 1.45);
    } catch (err) {
      // Non-fatal audio error
    }
  }

  /**
   * Descending Warning Tone: G3 -> D3 -> A2
   * Low resonant warning pulse signaling stop invalidation or risk cap breach.
   */
  public playStopLossAlert(): void {
    if (this.muted) return;
    try {
      const ctx = this.getContext();
      if (!ctx || !this.masterGainNode) return;

      const now = ctx.currentTime;

      // Primary tone: G3 (196 Hz) descending to D3 (146.83 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(196.0, now);
      osc1.frequency.exponentialRampToValueAtTime(146.83, now + 0.4);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.25, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(this.masterGainNode);
      osc1.start(now);
      osc1.stop(now + 0.65);

      // Sub-undertone: A2 (110.0 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(110.0, now + 0.05);
      gain2.gain.setValueAtTime(0, now + 0.05);
      gain2.gain.linearRampToValueAtTime(0.15, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(this.masterGainNode);
      osc2.start(now + 0.05);
      osc2.stop(now + 0.6);
    } catch (err) {
      // Non-fatal audio error
    }
  }

  /**
   * Crisp Step Ping: A5 -> C#6
   * Clean confirmation of breakout trigger fill or trade logged.
   */
  public playEntryTriggered(): void {
    if (this.muted) return;
    try {
      const ctx = this.getContext();
      if (!ctx || !this.masterGainNode) return;

      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880.0, now);
      osc.frequency.linearRampToValueAtTime(1108.73, now + 0.1);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.connect(gain);
      gain.connect(this.masterGainNode);
      osc.start(now);
      osc.stop(now + 0.75);
    } catch (err) {
      // Non-fatal audio error
    }
  }

  /**
   * Gentle Descending Reminder Chime: F#5 -> D5
   * Subtle notification for session 5-6 stagnation warning.
   */
  public playTimeStopWarning(): void {
    if (this.muted) return;
    try {
      const ctx = this.getContext();
      if (!ctx || !this.masterGainNode) return;

      const now = ctx.currentTime;

      // First chime: F#5 (739.99 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(739.99, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.15, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(this.masterGainNode);
      osc1.start(now);
      osc1.stop(now + 0.5);

      // Second chime: D5 (587.33 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(587.33, now + 0.15);
      gain2.gain.setValueAtTime(0, now + 0.15);
      gain2.gain.linearRampToValueAtTime(0.18, now + 0.19);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(this.masterGainNode);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.7);
    } catch (err) {
      // Non-fatal audio error
    }
  }
}

export const audioSynthesizer = new WebAudioSynthesizer();
export default audioSynthesizer;
