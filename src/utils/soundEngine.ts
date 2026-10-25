export type AmbientTrackId = 'rain' | 'lofi' | 'whitenoise';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private activeSourceNodes: AudioNode[] = [];
  private gainNode: GainNode | null = null;
  private intervalId: number | null = null;
  private currentTrack: AmbientTrackId | null = null;
  private isPlaying = false;
  private volume = 0.45;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playAlert(tone: 'chime' | 'bell' | 'marimba' = 'chime'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes =
      tone === 'chime'
        ? [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
        : tone === 'bell'
          ? [440, 554.37, 659.25] // A4, C#5, E5
          : [392.0, 493.88, 587.33, 783.99]; // G4, B4, D5, G5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tone === 'marimba' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.7);
    });
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(
        this.volume * 0.35,
        this.ctx.currentTime,
        0.05
      );
    }
  }

  public stopAmbient(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.activeSourceNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // ignore already stopped
      }
    });
    this.activeSourceNodes = [];
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {
        // ignore
      }
      this.gainNode = null;
    }
    this.isPlaying = false;
  }

  public startAmbient(track: AmbientTrackId, vol?: number): void {
    if (vol !== undefined) {
      this.volume = vol;
    }
    this.stopAmbient();
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.currentTrack = track;
    this.isPlaying = true;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume * 0.35, ctx.currentTime);
    masterGain.connect(ctx.destination);
    this.gainNode = masterGain;

    if (track === 'whitenoise' || track === 'rain') {
      // Generate 3-second looping filtered noise buffer
      const bufferSize = ctx.sampleRate * 3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      let b0 = 0,
        b1 = 0,
        b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Soft pink/brown filtering
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.95 * b2 + white * 0.048;
        output[i] = (b0 + b1 + b2 + white * 0.08) * 0.35;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(
        track === 'rain' ? 1100 : 650,
        ctx.currentTime
      );

      noise.connect(filter);
      filter.connect(masterGain);
      noise.start();
      this.activeSourceNodes.push(noise, filter);
    } else if (track === 'lofi') {
      // Warm Lo-Fi electric piano chord progression
      const chords = [
        [261.63, 329.63, 392.0, 493.88], // Cmaj7
        [220.0, 261.63, 329.63, 392.0], // Am7
        [174.61, 220.0, 261.63, 349.23], // Fmaj7
        [196.0, 246.94, 293.66, 349.23], // G7
      ];
      let chordIdx = 0;

      const playChord = () => {
        if (!this.isPlaying || !this.ctx || !this.gainNode) return;
        const now = this.ctx.currentTime;
        const notes = chords[chordIdx % chords.length];
        chordIdx += 1;

        notes.forEach((freq) => {
          if (!this.ctx || !this.gainNode) return;
          const osc = this.ctx.createOscillator();
          const noteGain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          noteGain.gain.setValueAtTime(0.001, now);
          noteGain.gain.linearRampToValueAtTime(0.08, now + 0.35);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + 3.4);

          osc.connect(noteGain);
          noteGain.connect(this.gainNode);
          osc.start(now);
          osc.stop(now + 3.5);
        });
      };

      playChord();
      this.intervalId = window.setInterval(playChord, 3500);
    }
  }

  public getState() {
    return {
      isPlaying: this.isPlaying,
      currentTrack: this.currentTrack,
      volume: this.volume,
    };
  }
}

export const soundEngine = new SoundEngine();
