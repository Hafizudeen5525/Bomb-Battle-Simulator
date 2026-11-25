class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playTone(frequency: number, durationMs = 220, type: OscillatorType = 'sine', volume = 0.16) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  }

  public playClick(pitchShift = 1) {
    this.playTone(620 * pitchShift, 55, 'triangle', 0.08);
  }

  public playConnect() {
    this.playTone(523.25, 90, 'sine', 0.12);
    setTimeout(() => this.playTone(783.99, 130, 'sine', 0.12), 65);
  }

  public playLevelClear() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 150, 'triangle', 0.13), idx * 70);
    });
  }

  public playError() {
    this.playTone(170, 180, 'sawtooth', 0.13);
    setTimeout(() => this.playTone(135, 220, 'sawtooth', 0.13), 100);
  }

  public playTick(urgent = false) {
    this.playTone(urgent ? 980 : 720, urgent ? 60 : 35, 'square', urgent ? 0.07 : 0.03);
  }

  public playPumpSurge(success: boolean) {
    if (success) {
      this.playTone(220, 120, 'sawtooth', 0.1);
      setTimeout(() => this.playTone(440, 140, 'triangle', 0.14), 80);
      setTimeout(() => this.playTone(880, 220, 'sine', 0.14), 160);
    } else {
      this.playTone(150, 260, 'sawtooth', 0.16);
      setTimeout(() => this.playTone(110, 300, 'sawtooth', 0.16), 140);
    }
  }

  public playPaintBlast() {
    this.playTone(120, 420, 'sawtooth', 0.18);
    setTimeout(() => this.playTone(85, 520, 'square', 0.15), 110);
  }
}

export const soundEngine = new SoundEngine();
