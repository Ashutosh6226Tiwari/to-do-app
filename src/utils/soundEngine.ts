import {
  BUILT_IN_SOUNDS,
  BuiltInTrackId,
  classifyCuratedTrackError,
  isValidHttpsAudioUrl,
  normalizePersistedMixerPreferences,
  PersistedMixerPreferences,
  PREVIEW_DURATION_MS,
  REWRITTEN_SOUND_SYNTH_SPECS,
} from './focusLogic';

export type AmbientTrackId = BuiltInTrackId;

export const MIXER_STORAGE_KEY = 'focusflow_sound_mix_v1';

interface BuiltInChannelRuntime {
  trackId: BuiltInTrackId;
  gainNode: GainNode;
  nodes: AudioNode[];
  intervals: number[];
  timeouts: number[];
}

interface HtmlAudioChannelRuntime {
  layerId: string;
  title: string;
  audio: HTMLAudioElement;
  isObjectUrl: boolean;
  src: string;
}

export interface MixerSnapshot {
  masterVolume: number;
  layerVolumes: Record<string, number>;
  activeLayerIds: string[];
  pendingSavedLayerIds: string[];
  autoplayBlocked: boolean;
  autoSuggestByMood: boolean;
  trackErrors: Record<string, string>;
  previewTrackId: BuiltInTrackId | null;
}

type MixerListener = (snapshot: MixerSnapshot) => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private builtInChannels = new Map<BuiltInTrackId, BuiltInChannelRuntime>();
  private htmlAudioChannels = new Map<string, HtmlAudioChannelRuntime>();

  private masterVolume = 0.75;
  private layerVolumes: Record<string, number> = {};
  private activeLayerIds = new Set<string>();
  private pendingSavedLayerIds: string[] = [];
  private autoplayBlocked = false;
  private autoSuggestByMood = true;
  private trackErrors: Record<string, string> = {};
  private previewTrackId: BuiltInTrackId | null = null;
  private previewTimeoutId: number | null = null;
  private listeners = new Set<MixerListener>();

  constructor() {
    this.loadSavedPreferences();
  }

  private loadSavedPreferences(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(MIXER_STORAGE_KEY);
      if (!raw) return;
      const parsed = normalizePersistedMixerPreferences(JSON.parse(raw));
      this.masterVolume = parsed.masterVolume;
      this.layerVolumes = { ...parsed.layerVolumes };
      this.autoSuggestByMood = parsed.autoSuggestByMood;
      // Browsers block audio until the user taps something:
      // remember the last mix and show a clear "Tap to play" state instead of auto-starting before a click.
      if (parsed.activeLayerIds.length > 0) {
        this.pendingSavedLayerIds = parsed.activeLayerIds;
        this.autoplayBlocked = true;
      }
    } catch {
      // ignore storage errors
    }
  }

  private persistPreferences(): void {
    if (typeof window === 'undefined') return;
    try {
      const activeList =
        this.activeLayerIds.size > 0
          ? Array.from(this.activeLayerIds)
          : this.pendingSavedLayerIds;
      const prefs: PersistedMixerPreferences = {
        masterVolume: this.masterVolume,
        layerVolumes: this.layerVolumes,
        activeLayerIds: activeList,
        autoSuggestByMood: this.autoSuggestByMood,
      };
      window.localStorage.setItem(MIXER_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }

  private notifyListeners(): void {
    const snap = this.getMixerSnapshot();
    this.listeners.forEach((listener) => {
      try {
        listener(snap);
      } catch {
        // ignore listener error
      }
    });
  }

  public subscribe(listener: MixerListener): () => void {
    this.listeners.add(listener);
    listener(this.getMixerSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getMixerSnapshot(): MixerSnapshot {
    return {
      masterVolume: this.masterVolume,
      layerVolumes: { ...this.layerVolumes },
      activeLayerIds: Array.from(this.activeLayerIds),
      pendingSavedLayerIds: [...this.pendingSavedLayerIds],
      autoplayBlocked: this.autoplayBlocked,
      autoSuggestByMood: this.autoSuggestByMood,
      trackErrors: { ...this.trackErrors },
      previewTrackId: this.previewTrackId,
    };
  }

  public setAutoSuggestByMood(enabled: boolean): void {
    this.autoSuggestByMood = Boolean(enabled);
    this.persistPreferences();
    this.notifyListeners();
  }

  public clearTrackError(layerId: string): void {
    if (this.trackErrors[layerId]) {
      delete this.trackErrors[layerId];
      this.notifyListeners();
    }
  }

  public setTrackError(layerId: string, reason: string): void {
    this.trackErrors[layerId] = reason;
    this.notifyListeners();
  }

  public getLayerVolume(layerId: string): number {
    const v = this.layerVolumes[layerId];
    return typeof v === 'number' ? v : 0.65;
  }

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
    if (this.ctx && !this.masterGainNode) {
      this.masterGainNode = this.ctx.createGain();
      this.masterGainNode.gain.setValueAtTime(
        this.masterVolume,
        this.ctx.currentTime
      );
      this.masterGainNode.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx
        .resume()
        .then(() => {
          if (
            this.ctx?.state === 'running' &&
            this.autoplayBlocked &&
            this.pendingSavedLayerIds.length === 0
          ) {
            this.autoplayBlocked = false;
            this.notifyListeners();
          }
        })
        .catch(() => {
          this.autoplayBlocked = true;
          this.notifyListeners();
        });
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

  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setTargetAtTime(
        this.masterVolume,
        this.ctx.currentTime,
        0.04
      );
    }
    this.htmlAudioChannels.forEach((ch) => {
      const layerVol = this.getLayerVolume(ch.layerId);
      ch.audio.volume = Math.max(0, Math.min(1, layerVol * this.masterVolume));
    });
    this.persistPreferences();
    this.notifyListeners();
  }

  public setLayerVolume(layerId: string, vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.layerVolumes[layerId] = clamped;

    if (layerId.startsWith('builtin:')) {
      const trackId = layerId.slice('builtin:'.length) as BuiltInTrackId;
      const ch = this.builtInChannels.get(trackId);
      if (ch && this.ctx) {
        ch.gainNode.gain.setTargetAtTime(
          clamped * 0.42,
          this.ctx.currentTime,
          0.04
        );
      }
    } else {
      const htmlCh = this.htmlAudioChannels.get(layerId);
      if (htmlCh) {
        htmlCh.audio.volume = Math.max(
          0,
          Math.min(1, clamped * this.masterVolume)
        );
      }
    }

    this.persistPreferences();
    this.notifyListeners();
  }

  public isLayerActive(layerId: string): boolean {
    return this.activeLayerIds.has(layerId);
  }

  /**
   * Plays a 3-second preview sample of a built-in sound so the user can compare sounds quickly.
   * Clicking Preview again on the currently previewing sound stops the preview immediately.
   */
  public previewBuiltInTrack(
    trackId: BuiltInTrackId,
    durationMs: number = PREVIEW_DURATION_MS
  ): void {
    if (typeof window === 'undefined') return;

    // If already previewing this exact sound, toggle preview off
    if (this.previewTrackId === trackId) {
      this.stopPreview();
      return;
    }

    // Stop any previous preview that wasn't a permanently enabled layer
    if (this.previewTimeoutId !== null) {
      window.clearTimeout(this.previewTimeoutId);
      this.previewTimeoutId = null;
    }
    if (this.previewTrackId !== null) {
      const prevId = this.previewTrackId;
      this.previewTrackId = null;
      if (!this.activeLayerIds.has(`builtin:${prevId}`)) {
        this.stopBuiltInChannel(prevId);
      }
    }

    const layerId = `builtin:${trackId}`;
    const wasAlreadyActive = this.activeLayerIds.has(layerId);
    this.previewTrackId = trackId;

    if (!wasAlreadyActive) {
      this.startBuiltInChannel(trackId, true);
    }

    this.previewTimeoutId = window.setTimeout(() => {
      this.previewTimeoutId = null;
      if (this.previewTrackId === trackId) {
        this.previewTrackId = null;
        if (!this.activeLayerIds.has(layerId)) {
          this.stopBuiltInChannel(trackId);
        }
        this.notifyListeners();
      }
    }, Math.max(500, durationMs));

    this.notifyListeners();
  }

  public stopPreview(): void {
    if (typeof window !== 'undefined' && this.previewTimeoutId !== null) {
      window.clearTimeout(this.previewTimeoutId);
      this.previewTimeoutId = null;
    }
    if (this.previewTrackId !== null) {
      const prevId = this.previewTrackId;
      this.previewTrackId = null;
      if (!this.activeLayerIds.has(`builtin:${prevId}`)) {
        this.stopBuiltInChannel(prevId);
      }
      this.notifyListeners();
    }
  }

  public toggleBuiltInLayer(trackId: BuiltInTrackId): void {
    const layerId = `builtin:${trackId}`;
    this.pendingSavedLayerIds = this.pendingSavedLayerIds.filter(
      (id) => id !== layerId
    );
    if (this.previewTrackId === trackId) {
      if (typeof window !== 'undefined' && this.previewTimeoutId !== null) {
        window.clearTimeout(this.previewTimeoutId);
        this.previewTimeoutId = null;
      }
      this.previewTrackId = null;
    }

    if (this.activeLayerIds.has(layerId)) {
      this.stopBuiltInChannel(trackId);
      this.activeLayerIds.delete(layerId);
      if (
        this.activeLayerIds.size === 0 &&
        this.pendingSavedLayerIds.length === 0
      ) {
        this.autoplayBlocked = false;
      }
    } else {
      this.startBuiltInChannel(trackId, false);
    }
    this.persistPreferences();
    this.notifyListeners();
  }

  public startSingleRoomVibeBuiltIn(trackId: BuiltInTrackId): void {
    const layerId = `builtin:${trackId}`;
    if (!this.activeLayerIds.has(layerId)) {
      this.startBuiltInChannel(trackId, false);
      this.persistPreferences();
      this.notifyListeners();
    }
  }

  private stopBuiltInChannel(trackId: BuiltInTrackId): void {
    const ch = this.builtInChannels.get(trackId);
    if (!ch) return;
    ch.intervals.forEach((id) => window.clearInterval(id));
    ch.timeouts.forEach((id) => window.clearTimeout(id));
    ch.nodes.forEach((node) => {
      try {
        if (
          'stop' in node &&
          typeof (node as AudioScheduledSourceNode).stop === 'function'
        ) {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // ignore
      }
    });
    try {
      ch.gainNode.disconnect();
    } catch {
      // ignore
    }
    this.builtInChannels.delete(trackId);
  }

  private startBuiltInChannel(
    trackId: BuiltInTrackId,
    isPreviewOnly: boolean = false
  ): void {
    this.stopBuiltInChannel(trackId);
    const ctx = this.ensureContext();
    const layerId = `builtin:${trackId}`;
    if (this.layerVolumes[layerId] === undefined) {
      this.layerVolumes[layerId] = 0.65;
    }

    if (!isPreviewOnly) {
      this.activeLayerIds.add(layerId);
    }

    if (!ctx || !this.masterGainNode) {
      return;
    }

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          this.autoplayBlocked = false;
          this.notifyListeners();
        })
        .catch(() => {
          this.autoplayBlocked = true;
          this.notifyListeners();
        });
    } else {
      this.autoplayBlocked = false;
    }

    const layerVol = this.getLayerVolume(layerId);
    const channelGain = ctx.createGain();
    channelGain.gain.setValueAtTime(layerVol * 0.42, ctx.currentTime);
    channelGain.connect(this.masterGainNode);

    const nodes: AudioNode[] = [];
    const intervals: number[] = [];
    const timeouts: number[] = [];

    const runtime: BuiltInChannelRuntime = {
      trackId,
      gainNode: channelGain,
      nodes,
      intervals,
      timeouts,
    };
    this.builtInChannels.set(trackId, runtime);

    // =========================================================================
    // UNCHANGED SOUNDS: Rain, White Noise, Brown Noise, Pink Noise, Alpha Waves
    // =========================================================================
    if (trackId === 'whitenoise' || trackId === 'rain') {
      // Generate 3-second looping filtered noise buffer (existing algorithm)
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
        trackId === 'rain' ? 1100 : 650,
        ctx.currentTime
      );

      noise.connect(filter);
      filter.connect(channelGain);
      noise.start();
      nodes.push(noise, filter);
      return;
    }

    if (trackId === 'brownnoise') {
      // Deep Brownian (1/f^2) low-frequency noise (unchanged)
      const bufferSize = ctx.sampleRate * 4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 1.6;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(380, ctx.currentTime);

      noise.connect(filter);
      filter.connect(channelGain);
      noise.start();
      nodes.push(noise, filter);
      return;
    }

    if (trackId === 'pinknoise') {
      // Paul Kellet 1/f Pink Noise (unchanged)
      const bufferSize = ctx.sampleRate * 4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.055;
        b6 = white * 0.115926;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, ctx.currentTime);

      noise.connect(filter);
      filter.connect(channelGain);
      noise.start();
      nodes.push(noise, filter);
      return;
    }

    if (trackId === 'alphawaves') {
      // Alpha Waves: 10 Hz Binaural Beat (200 Hz Left ear, 210 Hz Right ear) (unchanged)
      const oscLeft = ctx.createOscillator();
      const oscRight = ctx.createOscillator();
      oscLeft.type = 'sine';
      oscRight.type = 'sine';
      oscLeft.frequency.setValueAtTime(200, ctx.currentTime);
      oscRight.frequency.setValueAtTime(210, ctx.currentTime);

      const binauralGain = ctx.createGain();
      binauralGain.gain.setValueAtTime(0.22, ctx.currentTime);

      if (typeof ctx.createStereoPanner === 'function') {
        const panLeft = ctx.createStereoPanner();
        const panRight = ctx.createStereoPanner();
        panLeft.pan.setValueAtTime(-1, ctx.currentTime);
        panRight.pan.setValueAtTime(1, ctx.currentTime);

        oscLeft.connect(panLeft);
        oscRight.connect(panRight);
        panLeft.connect(binauralGain);
        panRight.connect(binauralGain);
        nodes.push(panLeft, panRight);
      } else {
        const merger = ctx.createChannelMerger(2);
        oscLeft.connect(merger, 0, 0);
        oscRight.connect(merger, 0, 1);
        merger.connect(binauralGain);
        nodes.push(merger);
      }

      binauralGain.connect(channelGain);
      oscLeft.start();
      oscRight.start();
      nodes.push(oscLeft, oscRight, binauralGain);
      return;
    }

    // =========================================================================
    // REWRITTEN SOUND 1: OCEAN WAVES
    // Brown noise through a lowpass filter (~500 Hz), modulated by a very slow
    // swell envelope (one wave every 7 to 12s, randomized each time: rise 3-5s,
    // fall 3-5s), plus a second layer of highpassed noise (>2 kHz, quiet) that
    // peaks just after each crest like shore foam. No constant hiss.
    // =========================================================================
    if (trackId === 'ocean') {
      const spec = REWRITTEN_SOUND_SYNTH_SPECS.ocean;
      const brownLen = ctx.sampleRate * 5;
      const brownBuf = ctx.createBuffer(1, brownLen, ctx.sampleRate);
      const brownData = brownBuf.getChannelData(0);
      let lastBrown = 0;
      for (let i = 0; i < brownLen; i++) {
        const white = Math.random() * 2 - 1;
        lastBrown = (lastBrown + 0.025 * white) / 1.025;
        brownData[i] = lastBrown * 1.9;
      }

      const surfSource = ctx.createBufferSource();
      surfSource.buffer = brownBuf;
      surfSource.loop = true;

      const surfLowpass = ctx.createBiquadFilter();
      surfLowpass.type = 'lowpass';
      surfLowpass.frequency.setValueAtTime(spec.surfLowpassHz, ctx.currentTime);

      const swellGain = ctx.createGain();
      // Start near-zero so there is no constant hiss between waves
      swellGain.gain.setValueAtTime(0.0005, ctx.currentTime);

      surfSource.connect(surfLowpass);
      surfLowpass.connect(swellGain);
      swellGain.connect(channelGain);
      surfSource.start();

      // Second layer: highpassed noise (>2 kHz, quiet) for shore foam peaking just after crest
      const foamLen = ctx.sampleRate * 4;
      const foamBuf = ctx.createBuffer(1, foamLen, ctx.sampleRate);
      const foamData = foamBuf.getChannelData(0);
      for (let i = 0; i < foamLen; i++) {
        foamData[i] = (Math.random() * 2 - 1) * 0.45;
      }

      const foamSource = ctx.createBufferSource();
      foamSource.buffer = foamBuf;
      foamSource.loop = true;

      const foamHighpass = ctx.createBiquadFilter();
      foamHighpass.type = 'highpass';
      foamHighpass.frequency.setValueAtTime(
        spec.foamHighpassHz,
        ctx.currentTime
      );

      const foamGain = ctx.createGain();
      foamGain.gain.setValueAtTime(0.0001, ctx.currentTime);

      foamSource.connect(foamHighpass);
      foamHighpass.connect(foamGain);
      foamGain.connect(channelGain);
      foamSource.start();

      nodes.push(
        surfSource,
        surfLowpass,
        swellGain,
        foamSource,
        foamHighpass,
        foamGain
      );

      const scheduleWaveSwell = () => {
        if (this.builtInChannels.get('ocean') !== runtime || !this.ctx) return;
        const now = this.ctx.currentTime;
        const riseSec =
          spec.riseMinSec +
          Math.random() * (spec.riseMaxSec - spec.riseMinSec); // 3 to 5 s
        const fallSec =
          spec.fallMinSec +
          Math.random() * (spec.fallMaxSec - spec.fallMinSec); // 3 to 5 s
        const cycleSec = Math.max(
          riseSec + fallSec + 0.3,
          spec.waveCycleMinSec +
            Math.random() * (spec.waveCycleMaxSec - spec.waveCycleMinSec) // 7 to 12 s
        );

        const crestTime = now + riseSec;
        const troughTime = crestTime + fallSec;

        // Swell envelope on lowpassed brown noise (~500 Hz)
        swellGain.gain.cancelScheduledValues(now);
        swellGain.gain.setValueAtTime(0.015, now);
        swellGain.gain.linearRampToValueAtTime(0.85, crestTime);
        swellGain.gain.exponentialRampToValueAtTime(0.0008, troughTime);

        // Subtle filter opening at the crest (380 Hz -> 560 Hz -> 340 Hz)
        surfLowpass.frequency.cancelScheduledValues(now);
        surfLowpass.frequency.setValueAtTime(360, now);
        surfLowpass.frequency.linearRampToValueAtTime(560, crestTime);
        surfLowpass.frequency.exponentialRampToValueAtTime(320, troughTime);

        // Foam layer (>2 kHz, quiet) stays silent, then peaks just after each crest (+0.35s)
        const foamStart = Math.max(now + 0.1, crestTime - 0.35);
        const foamPeak = crestTime + 0.35;
        const foamEnd = Math.min(troughTime, crestTime + Math.min(fallSec, 2.8));

        foamGain.gain.cancelScheduledValues(now);
        foamGain.gain.setValueAtTime(0.0001, now);
        foamGain.gain.setValueAtTime(0.0001, foamStart);
        foamGain.gain.linearRampToValueAtTime(0.11, foamPeak);
        foamGain.gain.exponentialRampToValueAtTime(0.0001, foamEnd);

        const tid = window.setTimeout(
          scheduleWaveSwell,
          Math.round(cycleSec * 1000)
        );
        timeouts.push(tid);
      };

      scheduleWaveSwell();
      return;
    }

    // =========================================================================
    // REWRITTEN SOUND 2: THUNDERSTORM
    // Dark, low rain bed (lowpassed noise ~1 kHz, quieter than Rain), plus
    // random thunder events every 8 to 25 seconds: a short sharp crack
    // (noise burst, highpassed, ~80 ms) followed by a deep rumble (brown noise,
    // lowpass 120 to 200 Hz, 0.4 s attack, 4 to 7 s decay, with a slow wobble).
    // Vary the volume of each event.
    // =========================================================================
    if (trackId === 'thunderstorm') {
      const spec = REWRITTEN_SOUND_SYNTH_SPECS.thunderstorm;

      // Dark, low rain bed (~1 kHz lowpass, quieter than Rain)
      const rainLen = ctx.sampleRate * 4;
      const rainBuf = ctx.createBuffer(1, rainLen, ctx.sampleRate);
      const rainData = rainBuf.getChannelData(0);
      let r0 = 0,
        r1 = 0;
      for (let i = 0; i < rainLen; i++) {
        const w = Math.random() * 2 - 1;
        r0 = 0.992 * r0 + w * 0.035;
        r1 = 0.965 * r1 + w * 0.05;
        rainData[i] = (r0 + r1 + w * 0.06) * 0.32;
      }

      const rainSource = ctx.createBufferSource();
      rainSource.buffer = rainBuf;
      rainSource.loop = true;

      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'lowpass';
      rainFilter.frequency.setValueAtTime(spec.rainLowpassHz, ctx.currentTime);

      const rainBedGain = ctx.createGain();
      rainBedGain.gain.setValueAtTime(spec.rainRelativeGain, ctx.currentTime);

      rainSource.connect(rainFilter);
      rainFilter.connect(rainBedGain);
      rainBedGain.connect(channelGain);
      rainSource.start();
      nodes.push(rainSource, rainFilter, rainBedGain);

      // Pre-build white noise buffer for the ~80 ms highpassed thunder crack
      const crackLen = Math.max(1, Math.floor(ctx.sampleRate * 0.12));
      const crackBuf = ctx.createBuffer(1, crackLen, ctx.sampleRate);
      const crackData = crackBuf.getChannelData(0);
      for (let i = 0; i < crackLen; i++) {
        crackData[i] = Math.random() * 2 - 1;
      }

      // Pre-build brown noise buffer for the deep thunder rumble
      const rumbleLen = ctx.sampleRate * 8;
      const rumbleBuf = ctx.createBuffer(1, rumbleLen, ctx.sampleRate);
      const rumbleData = rumbleBuf.getChannelData(0);
      let lastRum = 0;
      for (let i = 0; i < rumbleLen; i++) {
        const w = Math.random() * 2 - 1;
        lastRum = (lastRum + 0.022 * w) / 1.022;
        rumbleData[i] = lastRum * 2.4;
      }

      const triggerThunderEvent = () => {
        if (
          this.builtInChannels.get('thunderstorm') !== runtime ||
          !this.ctx
        ) {
          return;
        }
        const now = this.ctx.currentTime;
        // Vary the volume of each thunder event (0.50 to 1.0)
        const eventVolume = 0.5 + Math.random() * 0.5;

        // 1. Short sharp crack: noise burst, highpassed, ~80 ms
        const crackSrc = this.ctx.createBufferSource();
        crackSrc.buffer = crackBuf;

        const crackHp = this.ctx.createBiquadFilter();
        crackHp.type = 'highpass';
        crackHp.frequency.setValueAtTime(spec.crackHighpassHz, now);

        const crackGain = this.ctx.createGain();
        crackGain.gain.setValueAtTime(0.42 * eventVolume, now);
        crackGain.gain.exponentialRampToValueAtTime(
          0.0008,
          now + spec.crackDurationSec
        );

        crackSrc.connect(crackHp);
        crackHp.connect(crackGain);
        crackGain.connect(channelGain);
        crackSrc.start(now);
        crackSrc.stop(now + spec.crackDurationSec + 0.01);

        // 2. Deep rumble: brown noise, lowpass 120 to 200 Hz, 0.4 s attack, 4 to 7 s decay, with a slow wobble
        const rumbleStart = now + 0.055;
        const attackSec = spec.rumbleAttackSec; // 0.4 s
        const decaySec =
          spec.rumbleDecayMinSec +
          Math.random() * (spec.rumbleDecayMaxSec - spec.rumbleDecayMinSec); // 4 to 7 s
        const totalRumbleSec = attackSec + decaySec;
        const rumbleCutoffHz =
          spec.rumbleLowpassMinHz +
          Math.random() * (spec.rumbleLowpassMaxHz - spec.rumbleLowpassMinHz); // 120 to 200 Hz

        const rumbleSrc = this.ctx.createBufferSource();
        rumbleSrc.buffer = rumbleBuf;
        rumbleSrc.loop = true;

        const rumbleLp = this.ctx.createBiquadFilter();
        rumbleLp.type = 'lowpass';
        rumbleLp.frequency.setValueAtTime(rumbleCutoffHz, rumbleStart);

        // Slow wobble on rumble amplitude and filter cutoff
        const wobbleGain = this.ctx.createGain();
        wobbleGain.gain.setValueAtTime(0.7, rumbleStart);

        const wobbleLfo = this.ctx.createOscillator();
        wobbleLfo.type = 'sine';
        const wobbleHz =
          spec.rumbleWobbleMinHz +
          Math.random() * (spec.rumbleWobbleMaxHz - spec.rumbleWobbleMinHz);
        wobbleLfo.frequency.setValueAtTime(wobbleHz, rumbleStart);

        const wobbleAmpDepth = this.ctx.createGain();
        wobbleAmpDepth.gain.setValueAtTime(0.28, rumbleStart);
        wobbleLfo.connect(wobbleAmpDepth);
        wobbleAmpDepth.connect(wobbleGain.gain);

        const wobbleFilterDepth = this.ctx.createGain();
        wobbleFilterDepth.gain.setValueAtTime(35, rumbleStart);
        wobbleLfo.connect(wobbleFilterDepth);
        wobbleFilterDepth.connect(rumbleLp.frequency);

        const envGain = this.ctx.createGain();
        envGain.gain.setValueAtTime(0.001, rumbleStart);
        envGain.gain.linearRampToValueAtTime(
          0.95 * eventVolume,
          rumbleStart + attackSec
        );
        envGain.gain.exponentialRampToValueAtTime(
          0.0008,
          rumbleStart + totalRumbleSec
        );

        rumbleSrc.connect(rumbleLp);
        rumbleLp.connect(wobbleGain);
        wobbleGain.connect(envGain);
        envGain.connect(channelGain);

        rumbleSrc.start(rumbleStart);
        wobbleLfo.start(rumbleStart);
        rumbleSrc.stop(rumbleStart + totalRumbleSec + 0.05);
        wobbleLfo.stop(rumbleStart + totalRumbleSec + 0.05);
        nodes.push(rumbleSrc, wobbleLfo);

        // Schedule next thunder event in 8 to 25 seconds
        const nextDelaySec =
          spec.thunderIntervalMinSec +
          Math.random() *
            (spec.thunderIntervalMaxSec - spec.thunderIntervalMinSec);
        const tid = window.setTimeout(
          triggerThunderEvent,
          Math.round(nextDelaySec * 1000)
        );
        timeouts.push(tid);
      };

      // Trigger first thunder event shortly after start so preview/activation hears it immediately
      const firstTid = window.setTimeout(triggerThunderEvent, 220);
      timeouts.push(firstTid);
      return;
    }

    // =========================================================================
    // REWRITTEN SOUND 3: FIREPLACE
    // Warm, quiet low bed (brown noise, lowpass ~250 Hz), plus random crackles:
    // very short bursts (5 to 30 ms) of bandpassed noise (1 to 5 kHz) in
    // irregular clusters, 4 to 20 per second, with an occasional louder pop.
    // Silence between clusters is important.
    // =========================================================================
    if (trackId === 'fireplace') {
      const spec = REWRITTEN_SOUND_SYNTH_SPECS.fireplace;

      // 1. Warm, quiet low bed (brown noise, lowpass ~250 Hz)
      const bedLen = ctx.sampleRate * 4;
      const bedBuf = ctx.createBuffer(1, bedLen, ctx.sampleRate);
      const bedData = bedBuf.getChannelData(0);
      let lastBed = 0;
      for (let i = 0; i < bedLen; i++) {
        const w = Math.random() * 2 - 1;
        lastBed = (lastBed + 0.02 * w) / 1.02;
        bedData[i] = lastBed * 1.3;
      }

      const bedSrc = ctx.createBufferSource();
      bedSrc.buffer = bedBuf;
      bedSrc.loop = true;

      const bedLp = ctx.createBiquadFilter();
      bedLp.type = 'lowpass';
      bedLp.frequency.setValueAtTime(spec.bedLowpassHz, ctx.currentTime);

      const bedGain = ctx.createGain();
      bedGain.gain.setValueAtTime(0.32, ctx.currentTime);

      bedSrc.connect(bedLp);
      bedLp.connect(bedGain);
      bedGain.connect(channelGain);
      bedSrc.start();
      nodes.push(bedSrc, bedLp, bedGain);

      // 2. Crackle burst noise source buffer
      const burstLen = ctx.sampleRate * 1;
      const burstBuf = ctx.createBuffer(1, burstLen, ctx.sampleRate);
      const burstData = burstBuf.getChannelData(0);
      for (let i = 0; i < burstLen; i++) {
        burstData[i] = Math.random() * 2 - 1;
      }

      const scheduleCrackleBurst = (startTime: number, isLoudPop: boolean) => {
        if (!this.ctx) return;
        const durSec = isLoudPop
          ? 0.014 + Math.random() * 0.016 // 14 to 30 ms
          : spec.crackleDurationMinSec +
            Math.random() *
              (spec.crackleDurationMaxSec - spec.crackleDurationMinSec); // 5 to 30 ms
        const centerHz = isLoudPop
          ? 1000 + Math.random() * 1400
          : spec.crackleBandpassMinHz +
            Math.random() *
              (spec.crackleBandpassMaxHz - spec.crackleBandpassMinHz); // 1 to 5 kHz

        const src = this.ctx.createBufferSource();
        src.buffer = burstBuf;

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(centerHz, startTime);
        bp.Q.setValueAtTime(isLoudPop ? 2.0 : 3.6, startTime);

        const g = this.ctx.createGain();
        const peakGain = isLoudPop
          ? 0.65 + Math.random() * 0.25
          : 0.16 + Math.random() * 0.22;

        g.gain.setValueAtTime(0.0008, startTime);
        g.gain.linearRampToValueAtTime(
          peakGain,
          startTime + Math.min(0.002, durSec * 0.25)
        );
        g.gain.exponentialRampToValueAtTime(0.0005, startTime + durSec);

        src.connect(bp);
        bp.connect(g);
        g.connect(channelGain);

        const offset = Math.random() * Math.max(0.05, 0.9 - durSec);
        src.start(startTime, offset, durSec + 0.004);
        src.stop(startTime + durSec + 0.005);
      };

      const scheduleCrackleCluster = () => {
        if (
          this.builtInChannels.get('fireplace') !== runtime ||
          !this.ctx
        ) {
          return;
        }
        const now = this.ctx.currentTime;
        // Cluster duration (0.35s to 0.95s)
        const clusterDurationSec = 0.35 + Math.random() * 0.6;
        // Rate inside cluster: 4 to 20 bursts per second
        const ratePerSec =
          spec.crackleRateMinPerSec +
          Math.random() *
            (spec.crackleRateMaxPerSec - spec.crackleRateMinPerSec);
        const burstCount = Math.max(
          2,
          Math.round(clusterDurationSec * ratePerSec)
        );

        for (let i = 0; i < burstCount; i++) {
          const offsetSec = Math.random() * clusterDurationSec;
          const isLoudPop = i === 0 && Math.random() < 0.35;
          scheduleCrackleBurst(now + offsetSec, isLoudPop);
        }

        // Distinct silence between clusters (0.45s to 1.25s) so clusters stand out clearly
        const silenceBetweenClustersSec = 0.45 + Math.random() * 0.8;
        const nextClusterDelayMs = Math.round(
          (clusterDurationSec + silenceBetweenClustersSec) * 1000
        );
        const tid = window.setTimeout(
          scheduleCrackleCluster,
          nextClusterDelayMs
        );
        timeouts.push(tid);
      };

      scheduleCrackleCluster();
      return;
    }

    // =========================================================================
    // REWRITTEN SOUND 4: FOREST BIRDS
    // Soft wind bed (quiet bandpassed noise), plus bird calls from sine
    // oscillators: short chirps with fast frequency sweeps between 2 and 6 kHz,
    // in patterns of 2 to 6 notes, with 3 different "species" at randomized
    // intervals of 2 to 9 seconds.
    // =========================================================================
    if (trackId === 'birds') {
      const spec = REWRITTEN_SOUND_SYNTH_SPECS.birds;

      // Soft wind bed (quiet bandpassed noise)
      const windLen = ctx.sampleRate * 4;
      const windBuf = ctx.createBuffer(1, windLen, ctx.sampleRate);
      const windData = windBuf.getChannelData(0);
      let wLast = 0;
      for (let i = 0; i < windLen; i++) {
        const w = Math.random() * 2 - 1;
        wLast = 0.988 * wLast + w * 0.03;
        windData[i] = wLast * 0.16;
      }

      const windSrc = ctx.createBufferSource();
      windSrc.buffer = windBuf;
      windSrc.loop = true;

      const windBp = ctx.createBiquadFilter();
      windBp.type = 'bandpass';
      windBp.frequency.setValueAtTime(spec.windBandpassHz, ctx.currentTime);
      windBp.Q.setValueAtTime(1.5, ctx.currentTime);

      const windGain = ctx.createGain();
      windGain.gain.setValueAtTime(0.18, ctx.currentTime);

      windSrc.connect(windBp);
      windBp.connect(windGain);
      windGain.connect(channelGain);
      windSrc.start();
      nodes.push(windSrc, windBp, windGain);

      let lastSpecies = -1;
      const playBirdCall = (forcedSpecies?: number) => {
        if (this.builtInChannels.get('birds') !== runtime || !this.ctx) return;
        const now = this.ctx.currentTime;
        const species =
          forcedSpecies !== undefined
            ? forcedSpecies % 3
            : (lastSpecies + 1 + Math.floor(Math.random() * 2)) % 3;
        lastSpecies = species;

        // 2 to 6 notes per phrase
        const noteCount =
          spec.notesMin +
          Math.floor(Math.random() * (spec.notesMax - spec.notesMin + 1));

        for (let n = 0; n < noteCount; n++) {
          const osc = this.ctx.createOscillator();
          const noteGain = this.ctx.createGain();
          osc.type = 'sine';

          let noteStart = now;
          let noteDur = 0.08;

          if (species === 0) {
            // Species 0: Canopy Warbler — bright arched up-down sweep (3.4 kHz -> 5.6 kHz -> 3.9 kHz)
            noteStart = now + n * 0.115;
            noteDur = 0.085;
            const fStart = 3300 + (n % 2) * 350;
            const fPeak = Math.min(5900, 5200 + (n % 3) * 280);
            const fEnd = 3800 + (n % 2) * 250;
            osc.frequency.setValueAtTime(fStart, noteStart);
            osc.frequency.exponentialRampToValueAtTime(
              fPeak,
              noteStart + noteDur * 0.45
            );
            osc.frequency.exponentialRampToValueAtTime(
              fEnd,
              noteStart + noteDur
            );
          } else if (species === 1) {
            // Species 1: Woodland Robin — melodic alternating slurs (2.1 kHz <-> 3.6 kHz)
            noteStart = now + n * 0.16;
            noteDur = 0.125;
            if (n % 2 === 0) {
              osc.frequency.setValueAtTime(2150, noteStart);
              osc.frequency.exponentialRampToValueAtTime(
                3550,
                noteStart + noteDur
              );
            } else {
              osc.frequency.setValueAtTime(3450, noteStart);
              osc.frequency.exponentialRampToValueAtTime(
                2250,
                noteStart + noteDur
              );
            }
          } else {
            // Species 2: High Finch — rapid descending/ascending chirps (5.8 kHz -> 2.6 kHz)
            noteStart = now + n * 0.075;
            noteDur = 0.055;
            const highF = 5750 - (n % 2) * 400;
            const lowF = 2650 + (n % 3) * 250;
            osc.frequency.setValueAtTime(highF, noteStart);
            osc.frequency.exponentialRampToValueAtTime(
              lowF,
              noteStart + noteDur
            );
          }

          noteGain.gain.setValueAtTime(0.0005, noteStart);
          noteGain.gain.linearRampToValueAtTime(0.11, noteStart + 0.015);
          noteGain.gain.exponentialRampToValueAtTime(
            0.0005,
            noteStart + noteDur
          );

          osc.connect(noteGain);
          noteGain.connect(channelGain);
          osc.start(noteStart);
          osc.stop(noteStart + noteDur + 0.01);
        }
      };

      const scheduleNextBird = () => {
        if (this.builtInChannels.get('birds') !== runtime || !this.ctx) return;
        playBirdCall();
        // Randomized interval of 2 to 9 seconds
        const nextDelaySec =
          spec.callIntervalMinSec +
          Math.random() * (spec.callIntervalMaxSec - spec.callIntervalMinSec);
        const tid = window.setTimeout(
          scheduleNextBird,
          Math.round(nextDelaySec * 1000)
        );
        timeouts.push(tid);
      };

      // Trigger species 0 immediately and species 1 at 1.2s so a 3s preview showcases distinct species calls
      playBirdCall(0);
      timeouts.push(window.setTimeout(() => playBirdCall(1), 1200));
      timeouts.push(
        window.setTimeout(
          scheduleNextBird,
          Math.round((2.2 + Math.random() * 3.5) * 1000)
        )
      );
      return;
    }

    // =========================================================================
    // REWRITTEN SOUND 5: NIGHT CRICKETS
    // Oscillators near 4.2 to 5 kHz, amplitude-modulated by pulse trains (~30 Hz)
    // in short chirps of 3 pulses, repeating about 2 times per second.
    // Use 4 to 6 slightly detuned crickets with random offsets so they overlap naturally.
    // =========================================================================
    if (trackId === 'crickets') {
      const spec = REWRITTEN_SOUND_SYNTH_SPECS.crickets;
      // 5 slightly detuned cricket carriers between 4.2 and 5.0 kHz
      const cricketFreqs = [4240, 4415, 4590, 4765, 4940];
      const pulsePeriodSec = 1 / spec.pulseRateHz; // ~0.0333 s (30 Hz)
      const pulseOnSec = 0.021;

      cricketFreqs.forEach((baseFreq, idx) => {
        const scheduleCricketChirp = () => {
          if (
            this.builtInChannels.get('crickets') !== runtime ||
            !this.ctx
          ) {
            return;
          }
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const chirpGain = this.ctx.createGain();
          osc.type = 'sine';
          const detunedFreq = baseFreq + (Math.random() * 16 - 8);
          osc.frequency.setValueAtTime(detunedFreq, now);

          chirpGain.gain.setValueAtTime(0.0001, now);

          // 3 pulses at ~30 Hz pulse rate
          for (let p = 0; p < spec.pulsesPerChirp; p++) {
            const pStart = now + p * pulsePeriodSec;
            chirpGain.gain.setValueAtTime(0.0002, pStart);
            chirpGain.gain.linearRampToValueAtTime(0.038, pStart + 0.004);
            chirpGain.gain.exponentialRampToValueAtTime(
              0.0002,
              pStart + pulseOnSec
            );
          }

          const totalChirpDur = spec.pulsesPerChirp * pulsePeriodSec + 0.01;
          osc.connect(chirpGain);
          chirpGain.connect(channelGain);
          osc.start(now);
          osc.stop(now + totalChirpDur);

          // Repeats about 2 times per second (~500 ms) with slight natural per-cricket drift
          const nextMs = 465 + idx * 18 + Math.floor(Math.random() * 35);
          const tid = window.setTimeout(scheduleCricketChirp, nextMs);
          timeouts.push(tid);
        };

        // Random initial offset (0 to 420 ms) so the 5 crickets overlap naturally
        const initialOffsetMs = Math.floor(
          idx * 75 + Math.random() * 60
        );
        const startTid = window.setTimeout(
          scheduleCricketChirp,
          initialOffsetMs
        );
        timeouts.push(startTid);
      });
      return;
    }

    // =========================================================================
    // REWRITTEN SOUND 6A: LO-FI (Warm ambient pad, soft vinyl hiss, gentle tape wobble — NO drums)
    // =========================================================================
    if (trackId === 'lofi') {
      const spec = REWRITTEN_SOUND_SYNTH_SPECS.lofi;

      // Soft continuous vinyl hiss (quiet filtered noise, no sharp pops or drums)
      const hissLen = ctx.sampleRate * 3;
      const hissBuf = ctx.createBuffer(1, hissLen, ctx.sampleRate);
      const hissData = hissBuf.getChannelData(0);
      let hLast = 0;
      for (let i = 0; i < hissLen; i++) {
        const w = Math.random() * 2 - 1;
        hLast = 0.92 * hLast + w * 0.08;
        hissData[i] = hLast * 0.04;
      }
      const hissSrc = ctx.createBufferSource();
      hissSrc.buffer = hissBuf;
      hissSrc.loop = true;

      const hissBp = ctx.createBiquadFilter();
      hissBp.type = 'bandpass';
      hissBp.frequency.setValueAtTime(1750, ctx.currentTime);
      hissBp.Q.setValueAtTime(0.9, ctx.currentTime);

      hissSrc.connect(hissBp);
      hissBp.connect(channelGain);
      hissSrc.start();

      // Shared warm lowpass filter (~720 Hz) for the ambient pad
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(spec.padLowpassHz, ctx.currentTime);
      padFilter.Q.setValueAtTime(0.85, ctx.currentTime);
      padFilter.connect(channelGain);

      // Gentle tape wobble LFO (~0.45 Hz)
      const wobbleLfo = ctx.createOscillator();
      wobbleLfo.type = 'sine';
      wobbleLfo.frequency.setValueAtTime(spec.tapeWobbleHz, ctx.currentTime);
      const wobbleDepth = ctx.createGain();
      wobbleDepth.gain.setValueAtTime(14, ctx.currentTime); // ±14 cents slow tape pitch drift
      wobbleLfo.connect(wobbleDepth);
      wobbleLfo.start();

      nodes.push(hissSrc, hissBp, padFilter, wobbleLfo, wobbleDepth);

      // Lush ambient pad chords (no drums, long crossfading swells)
      const padChords = [
        [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
        [164.81, 196.0, 246.94, 293.66, 392.0], // Em7
        [146.83, 220.0, 261.63, 329.63, 349.23], // Dm9
        [130.81, 196.0, 246.94, 293.66, 329.63], // Cmaj9
      ];
      let padIdx = 0;

      const triggerPadSwell = () => {
        if (this.builtInChannels.get('lofi') !== runtime || !this.ctx) return;
        const now = this.ctx.currentTime;
        const freqs = padChords[padIdx % padChords.length];
        padIdx += 1;

        freqs.forEach((freq, vIdx) => {
          if (!this.ctx) return;
          // Detuned sawtooth + warm sine layer per voice
          const sawOsc = this.ctx.createOscillator();
          const sineOsc = this.ctx.createOscillator();
          sawOsc.type = 'sawtooth';
          sineOsc.type = 'sine';

          sawOsc.frequency.setValueAtTime(freq, now);
          sineOsc.frequency.setValueAtTime(freq, now);
          sawOsc.detune.setValueAtTime(-7 + vIdx * 3, now);
          sineOsc.detune.setValueAtTime(6 - vIdx * 2, now);

          wobbleDepth.connect(sawOsc.detune);
          wobbleDepth.connect(sineOsc.detune);

          const sawMix = this.ctx.createGain();
          sawMix.gain.setValueAtTime(0.32, now);
          const sineMix = this.ctx.createGain();
          sineMix.gain.setValueAtTime(0.68, now);

          const voiceEnv = this.ctx.createGain();
          voiceEnv.gain.setValueAtTime(0.0005, now);
          voiceEnv.gain.linearRampToValueAtTime(0.055, now + 1.8);
          voiceEnv.gain.linearRampToValueAtTime(0.045, now + 3.8);
          voiceEnv.gain.exponentialRampToValueAtTime(0.0005, now + 6.2);

          sawOsc.connect(sawMix);
          sineOsc.connect(sineMix);
          sawMix.connect(voiceEnv);
          sineMix.connect(voiceEnv);
          voiceEnv.connect(padFilter);

          sawOsc.start(now);
          sineOsc.start(now);
          sawOsc.stop(now + 6.3);
          sineOsc.stop(now + 6.3);
        });
      };

      triggerPadSwell();
      intervals.push(window.setInterval(triggerPadSwell, 5200));
      return;
    }

    // =========================================================================
    // REWRITTEN SOUND 6B: LO-FI CHILL
    // A real loop at 72 BPM with swing: Rhodes-style chords (Cmaj7, Am7, Fmaj7, G7;
    // one per 2 bars) through a lowpass at ~3 kHz, a soft kick, snare, and hi-hat
    // pattern, vinyl crackle, and slight tape pitch wobble.
    // =========================================================================
    if (trackId === 'lofichill') {
      const spec = REWRITTEN_SOUND_SYNTH_SPECS.lofichill;
      const beatSec = 60 / spec.bpm; // 0.83333 s per quarter note at 72 BPM
      const swungSubdivisionSec = beatSec * spec.swingRatio; // ~0.483 s swung 8th

      // 1. Vinyl crackle loop
      const crackleLen = ctx.sampleRate * 3;
      const crackleBuf = ctx.createBuffer(1, crackleLen, ctx.sampleRate);
      const cData = crackleBuf.getChannelData(0);
      for (let i = 0; i < crackleLen; i++) {
        cData[i] =
          Math.random() > 0.9965
            ? (Math.random() * 2 - 1) * 0.2
            : (Math.random() * 2 - 1) * 0.005;
      }
      const crackleSrc = ctx.createBufferSource();
      crackleSrc.buffer = crackleBuf;
      crackleSrc.loop = true;

      const crackleBp = ctx.createBiquadFilter();
      crackleBp.type = 'bandpass';
      crackleBp.frequency.setValueAtTime(2800, ctx.currentTime);
      crackleBp.Q.setValueAtTime(1.4, ctx.currentTime);

      const crackleGain = ctx.createGain();
      crackleGain.gain.setValueAtTime(0.35, ctx.currentTime);

      crackleSrc.connect(crackleBp);
      crackleBp.connect(crackleGain);
      crackleGain.connect(channelGain);
      crackleSrc.start();

      // White noise buffer for snare & hi-hat percussion
      const drumNoiseLen = Math.floor(ctx.sampleRate * 0.4);
      const drumNoiseBuf = ctx.createBuffer(1, drumNoiseLen, ctx.sampleRate);
      const dData = drumNoiseBuf.getChannelData(0);
      for (let i = 0; i < drumNoiseLen; i++) {
        dData[i] = Math.random() * 2 - 1;
      }

      // 2. Rhodes lowpass filter (~3 kHz) & slight tape pitch wobble LFO
      const rhodesLp = ctx.createBiquadFilter();
      rhodesLp.type = 'lowpass';
      rhodesLp.frequency.setValueAtTime(
        spec.rhodesLowpassHz,
        ctx.currentTime
      );
      rhodesLp.Q.setValueAtTime(0.9, ctx.currentTime);
      rhodesLp.connect(channelGain);

      const tapeLfo = ctx.createOscillator();
      tapeLfo.type = 'sine';
      tapeLfo.frequency.setValueAtTime(spec.tapeWobbleHz, ctx.currentTime);
      const tapeDepth = ctx.createGain();
      tapeDepth.gain.setValueAtTime(11, ctx.currentTime); // ±11 cents subtle tape pitch wobble
      tapeLfo.connect(tapeDepth);
      tapeLfo.start();

      nodes.push(
        crackleSrc,
        crackleBp,
        crackleGain,
        rhodesLp,
        tapeLfo,
        tapeDepth
      );

      const playKick = (time: number, velocity: number = 1.0) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(122, time);
        osc.frequency.exponentialRampToValueAtTime(45, time + 0.11);

        g.gain.setValueAtTime(0.24 * velocity, time);
        g.gain.exponentialRampToValueAtTime(0.0008, time + 0.24);

        osc.connect(g);
        g.connect(channelGain);
        osc.start(time);
        osc.stop(time + 0.25);
      };

      const playSnare = (time: number) => {
        if (!this.ctx) return;
        // Soft snare body tone
        const bodyOsc = this.ctx.createOscillator();
        const bodyGain = this.ctx.createGain();
        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(185, time);
        bodyOsc.frequency.exponentialRampToValueAtTime(98, time + 0.08);
        bodyGain.gain.setValueAtTime(0.11, time);
        bodyGain.gain.exponentialRampToValueAtTime(0.0008, time + 0.1);
        bodyOsc.connect(bodyGain);
        bodyGain.connect(channelGain);
        bodyOsc.start(time);
        bodyOsc.stop(time + 0.11);

        // Brushed snare wires
        const wireSrc = this.ctx.createBufferSource();
        wireSrc.buffer = drumNoiseBuf;
        const wireBp = this.ctx.createBiquadFilter();
        wireBp.type = 'bandpass';
        wireBp.frequency.setValueAtTime(1850, time);
        wireBp.Q.setValueAtTime(1.1, time);
        const wireGain = this.ctx.createGain();
        wireGain.gain.setValueAtTime(0.12, time);
        wireGain.gain.exponentialRampToValueAtTime(0.0008, time + 0.15);
        wireSrc.connect(wireBp);
        wireBp.connect(wireGain);
        wireGain.connect(channelGain);
        wireSrc.start(time);
        wireSrc.stop(time + 0.16);
      };

      const playHiHat = (time: number, gainPeak: number) => {
        if (!this.ctx) return;
        const hatSrc = this.ctx.createBufferSource();
        hatSrc.buffer = drumNoiseBuf;
        const hatHp = this.ctx.createBiquadFilter();
        hatHp.type = 'highpass';
        hatHp.frequency.setValueAtTime(6200, time);
        const hatGain = this.ctx.createGain();
        hatGain.gain.setValueAtTime(gainPeak, time);
        hatGain.gain.exponentialRampToValueAtTime(0.0005, time + 0.048);
        hatSrc.connect(hatHp);
        hatHp.connect(hatGain);
        hatGain.connect(channelGain);
        hatSrc.start(time);
        hatSrc.stop(time + 0.055);
      };

      const playRhodesChord = (
        chordFreqs: readonly number[],
        startTime: number,
        durationSec: number
      ) => {
        if (!this.ctx) return;
        chordFreqs.forEach((freq, idx) => {
          if (!this.ctx) return;
          const slightStrum = startTime + idx * 0.018;
          // Warm triangle fundamental + bright 2x tine bell overtone on attack
          const bodyOsc = this.ctx.createOscillator();
          const tineOsc = this.ctx.createOscillator();
          bodyOsc.type = 'triangle';
          tineOsc.type = 'sine';
          bodyOsc.frequency.setValueAtTime(freq, slightStrum);
          tineOsc.frequency.setValueAtTime(freq * 2, slightStrum);

          tapeDepth.connect(bodyOsc.detune);
          tapeDepth.connect(tineOsc.detune);

          const bodyGain = this.ctx.createGain();
          bodyGain.gain.setValueAtTime(0.001, slightStrum);
          bodyGain.gain.linearRampToValueAtTime(0.068, slightStrum + 0.035);
          bodyGain.gain.exponentialRampToValueAtTime(
            0.025,
            slightStrum + durationSec * 0.45
          );
          bodyGain.gain.exponentialRampToValueAtTime(
            0.0008,
            slightStrum + durationSec
          );

          const tineGain = this.ctx.createGain();
          tineGain.gain.setValueAtTime(0.001, slightStrum);
          tineGain.gain.linearRampToValueAtTime(0.022, slightStrum + 0.012);
          tineGain.gain.exponentialRampToValueAtTime(0.0004, slightStrum + 0.35);

          bodyOsc.connect(bodyGain);
          tineOsc.connect(tineGain);
          bodyGain.connect(rhodesLp);
          tineGain.connect(rhodesLp);

          bodyOsc.start(slightStrum);
          tineOsc.start(slightStrum);
          bodyOsc.stop(slightStrum + durationSec + 0.04);
          tineOsc.stop(slightStrum + 0.4);
        });
      };

      let beatCount = 0;
      const beatsPerTwoBars = spec.barsPerChord * spec.beatsPerBar; // 8 beats per 2 bars

      const tickLoFiChillBeat = () => {
        if (
          this.builtInChannels.get('lofichill') !== runtime ||
          !this.ctx
        ) {
          return;
        }
        const now = this.ctx.currentTime;
        const beatInTwoBars = beatCount % beatsPerTwoBars; // 0..7
        const beatInBar = beatCount % spec.beatsPerBar; // 0..3

        // 1. Rhodes chord once every 2 bars (8 beats at 72 BPM = 6.67s)
        if (beatInTwoBars === 0) {
          const chordIdx =
            Math.floor(beatCount / beatsPerTwoBars) % spec.chords.length;
          playRhodesChord(
            spec.chords[chordIdx],
            now,
            beatSec * beatsPerTwoBars - 0.1
          );
        }

        // 2. Soft kick pattern with swung ghost kick before beat 3
        if (beatInBar === 0) {
          playKick(now, 1.0);
        } else if (beatInBar === 1) {
          playKick(now + swungSubdivisionSec, 0.65);
        } else if (beatInBar === 2) {
          playKick(now, 0.85);
        }

        // 3. Soft snare on backbeats (beats 2 and 4 -> indices 1 and 3)
        if (beatInBar === 1 || beatInBar === 3) {
          playSnare(now);
        }

        // 4. Swung 8th-note hi-hat pattern (downbeat + swung off-beat at 58% of beat)
        playHiHat(now, 0.048);
        playHiHat(now + swungSubdivisionSec, 0.032);

        beatCount += 1;
      };

      tickLoFiChillBeat();
      intervals.push(
        window.setInterval(tickLoFiChillBeat, Math.round(beatSec * 1000))
      );
      return;
    }
  }

  /**
   * Toggles an external HTMLAudioElement layer (Cloud Curated Track `track:<id>` or My Music `custom:<id>`).
   */
  public toggleExternalLayer(params: {
    layerId: string;
    title: string;
    src: string;
    loop?: boolean;
    isObjectUrl?: boolean;
  }): void {
    const { layerId } = params;
    this.pendingSavedLayerIds = this.pendingSavedLayerIds.filter(
      (id) => id !== layerId
    );
    if (this.activeLayerIds.has(layerId)) {
      this.stopExternalLayer(layerId);
      this.activeLayerIds.delete(layerId);
      this.persistPreferences();
      this.notifyListeners();
      return;
    }

    this.startExternalLayer(params);
  }

  public startExternalLayer(params: {
    layerId: string;
    title: string;
    src: string;
    loop?: boolean;
    isObjectUrl?: boolean;
  }): void {
    const { layerId, title, src, loop = true, isObjectUrl = false } = params;
    this.stopExternalLayer(layerId);
    delete this.trackErrors[layerId];

    if (this.layerVolumes[layerId] === undefined) {
      this.layerVolumes[layerId] = 0.7;
    }

    if (!isObjectUrl && !isValidHttpsAudioUrl(src)) {
      const classified = classifyCuratedTrackError({
        mediaErrorCode: 4,
        src,
      });
      this.trackErrors[layerId] = classified.message;
      this.notifyListeners();
      return;
    }

    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return;
    }

    const audio = new Audio();
    audio.loop = loop;
    audio.preload = 'auto';
    audio.volume = Math.max(
      0,
      Math.min(1, this.getLayerVolume(layerId) * this.masterVolume)
    );
    audio.src = src;

    audio.onerror = () => {
      const code = audio.error?.code ?? null;
      const classified = classifyCuratedTrackError({
        mediaErrorCode: code,
        src,
        errorMessage: audio.error?.message,
      });
      this.trackErrors[layerId] = classified.message;
      this.stopExternalLayer(layerId);
      this.activeLayerIds.delete(layerId);
      this.persistPreferences();
      this.notifyListeners();
    };

    audio.onended = () => {
      if (!audio.loop) {
        this.stopExternalLayer(layerId);
        this.activeLayerIds.delete(layerId);
        this.persistPreferences();
        this.notifyListeners();
      }
    };

    this.htmlAudioChannels.set(layerId, {
      layerId,
      title,
      audio,
      isObjectUrl,
      src,
    });
    this.activeLayerIds.add(layerId);

    audio
      .play()
      .then(() => {
        this.autoplayBlocked = false;
        this.notifyListeners();
      })
      .catch((err: unknown) => {
        const errName =
          typeof err === 'object' && err !== null && 'name' in err
            ? String((err as { name?: string }).name)
            : '';
        const errMsg =
          typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message?: string }).message)
            : '';
        if (errName === 'NotAllowedError') {
          this.autoplayBlocked = true;
          this.notifyListeners();
        } else {
          const classified = classifyCuratedTrackError({
            mediaErrorCode: audio.error?.code ?? null,
            src,
            errorMessage: `${errName} ${errMsg}`,
          });
          this.trackErrors[layerId] = classified.message;
          this.stopExternalLayer(layerId);
          this.activeLayerIds.delete(layerId);
          this.notifyListeners();
        }
      });

    this.persistPreferences();
    this.notifyListeners();
  }

  public updateExternalLayerLoop(layerId: string, loop: boolean): void {
    const ch = this.htmlAudioChannels.get(layerId);
    if (ch) {
      ch.audio.loop = loop;
    }
  }

  public stopExternalLayer(layerId: string): void {
    const ch = this.htmlAudioChannels.get(layerId);
    if (!ch) return;
    try {
      ch.audio.onended = null;
      ch.audio.onerror = null;
      ch.audio.pause();
      ch.audio.removeAttribute('src');
      ch.audio.load();
      if (ch.isObjectUrl) {
        URL.revokeObjectURL(ch.src);
      }
    } catch {
      // ignore
    }
    this.htmlAudioChannels.delete(layerId);
  }

  public stopAllLayers(): void {
    this.stopPreview();
    Array.from(this.builtInChannels.keys()).forEach((id) =>
      this.stopBuiltInChannel(id)
    );
    Array.from(this.htmlAudioChannels.keys()).forEach((id) =>
      this.stopExternalLayer(id)
    );
    this.activeLayerIds.clear();
    this.pendingSavedLayerIds = [];
    this.autoplayBlocked = false;
    this.persistPreferences();
    this.notifyListeners();
  }

  /**
   * Called when the user clicks the "Tap to play" button to unlock browser audio
   * and resume any blocked or remembered layers.
   */
  public resumeBlockedPlayback(
    resolveExternalTrack?: (layerId: string) => Promise<{
      title: string;
      src: string;
      loop: boolean;
      isObjectUrl: boolean;
    } | null>
  ): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Resume any pending saved layers from last session
    const toRestore = [...this.pendingSavedLayerIds];
    this.pendingSavedLayerIds = [];

    for (const layerId of toRestore) {
      if (layerId.startsWith('builtin:')) {
        const trackId = layerId.slice('builtin:'.length) as BuiltInTrackId;
        if (BUILT_IN_SOUNDS.some((s) => s.id === trackId)) {
          this.startBuiltInChannel(trackId);
        }
      } else if (resolveExternalTrack) {
        void resolveExternalTrack(layerId).then((resolved) => {
          if (resolved) {
            this.startExternalLayer({
              layerId,
              title: resolved.title,
              src: resolved.src,
              loop: resolved.loop,
              isObjectUrl: resolved.isObjectUrl,
            });
          }
        });
      }
    }

    // Also call play() on any already-created HTMLAudioElements that were paused by autoplay block
    this.htmlAudioChannels.forEach((ch) => {
      if (ch.audio.paused) {
        ch.audio.play().catch(() => {});
      }
    });

    this.autoplayBlocked = false;
    this.persistPreferences();
    this.notifyListeners();
  }

  // Backward-compatible methods for existing callers
  public setVolume(vol: number): void {
    this.setMasterVolume(vol);
  }

  public stopAmbient(): void {
    this.stopAllLayers();
  }

  public startAmbient(track: AmbientTrackId, vol?: number): void {
    if (vol !== undefined) {
      this.setMasterVolume(vol);
    }
    this.toggleBuiltInLayer(track);
  }

  public getState() {
    const firstBuiltIn = Array.from(this.builtInChannels.keys())[0] || null;
    return {
      isPlaying: this.activeLayerIds.size > 0,
      currentTrack: firstBuiltIn,
      volume: this.masterVolume,
    };
  }
}

export const soundEngine = new SoundEngine();
