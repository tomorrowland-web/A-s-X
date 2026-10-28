export interface VolumeSettings { master: number; music: number; ambience: number; effects: number }
export type SoundName = 'footstep' | 'breath' | 'heartbeat' | 'door' | 'electric' | 'candle' | 'whisper' | 'scream' | 'presence' | 'chase' | 'success' | 'failure' | 'coin' | 'complete' | 'pickup' | 'click' | 'death' | 'ending';
export interface AudioFrame {
  tension: number;
  moving?: boolean;
  sprinting?: boolean;
  material?: 'stone' | 'water' | 'metal' | 'wood' | string;
  health?: number;
  sanity?: number;
  player?: { x: number; z: number; yaw?: number };
  enemy?: { x: number; z: number };
}

/** All audio is synthesized locally. No downloads, voice API, or autoplay assumption. */
export class AudioEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private buses: Partial<Record<'music' | 'ambience' | 'effects', GainNode>> = {};
  private reverb?: ConvolverNode;
  private noiseBuffer?: AudioBuffer;
  private tensionGain?: GainNode;
  private droneGain?: GainNode;
  private volumes: VolumeSettings = { master: 0.65, music: 0.6, ambience: 0.7, effects: 0.8 };
  private stepTime = 0;
  private heartTime = 0;
  private breathTime = 0;
  private player = { x: 0, z: 0, yaw: 0 };

  async unlock(): Promise<void> {
    if (!this.ctx) this.create();
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
  }

  private create(): void {
    this.ctx = new AudioContext();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 8;
    this.master.connect(compressor).connect(ctx.destination);
    for (const bus of ['music', 'ambience', 'effects'] as const) {
      this.buses[bus] = ctx.createGain();
      this.buses[bus]!.connect(this.master);
    }
    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let smooth = 0;
    for (let i = 0; i < data.length; i++) { smooth = (smooth + (Math.random() * 2 - 1) * 0.035) / 1.02; data[i] = smooth * 3; }
    this.reverb = ctx.createConvolver();
    const impulse = ctx.createBuffer(2, ctx.sampleRate * 2.8, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const samples = impulse.getChannelData(ch);
      for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, 3.5) * 0.3;
    }
    this.reverb.buffer = impulse;
    const wet = ctx.createGain(); wet.gain.value = 0.25;
    this.reverb.connect(wet).connect(this.buses.effects!);
    this.droneGain = ctx.createGain(); this.droneGain.gain.value = 0.08;
    this.droneGain.connect(this.buses.ambience!);
    for (const frequency of [43.65, 65.4, 87.6]) {
      const oscillator = ctx.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      oscillator.connect(this.droneGain); oscillator.start();
    }
    const air = ctx.createBufferSource(); air.buffer = this.noiseBuffer; air.loop = true;
    const airFilter = ctx.createBiquadFilter(); airFilter.type = 'lowpass'; airFilter.frequency.value = 460;
    const airGain = ctx.createGain(); airGain.gain.value = 0.11;
    air.connect(airFilter).connect(airGain).connect(this.buses.ambience!); air.start();
    this.tensionGain = ctx.createGain(); this.tensionGain.gain.value = 0;
    this.tensionGain.connect(this.buses.music!);
    const tense = ctx.createOscillator(); tense.type = 'sawtooth'; tense.frequency.value = 54;
    const tenseFilter = ctx.createBiquadFilter(); tenseFilter.type = 'lowpass'; tenseFilter.frequency.value = 180;
    tense.connect(tenseFilter).connect(this.tensionGain); tense.start();
    const tremolo = ctx.createOscillator(); tremolo.frequency.value = 5.5;
    const depth = ctx.createGain(); depth.gain.value = 0.024;
    tremolo.connect(depth).connect(this.tensionGain.gain); tremolo.start();
    this.setVolumes(this.volumes);
  }

  setVolumes(volumes: Partial<VolumeSettings>): void {
    for (const key of ['master', 'music', 'ambience', 'effects'] as const) {
      const value = volumes[key];
      if (typeof value === 'number' && Number.isFinite(value)) this.volumes[key] = Math.max(0, Math.min(1, value));
    }
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(this.volumes.master, this.ctx.currentTime, 0.05);
    for (const bus of ['music', 'ambience', 'effects'] as const) this.buses[bus]!.gain.setTargetAtTime(this.volumes[bus], this.ctx.currentTime, 0.05);
  }

  private route(node: AudioNode, position?: { x: number; z: number }, volume = 1): void {
    if (!this.ctx) return;
    const gain = this.ctx.createGain();
    const distance = position ? Math.hypot(position.x - this.player.x, position.z - this.player.z) : 0;
    gain.gain.value = volume / (1 + distance * 0.13);
    node.connect(gain);
    if (position) {
      const panner = this.ctx.createStereoPanner();
      const dx = position.x - this.player.x; const dz = position.z - this.player.z;
      panner.pan.value = Math.max(-1, Math.min(1, (dx * Math.cos(this.player.yaw) - dz * Math.sin(this.player.yaw)) / Math.max(2, distance)));
      gain.connect(panner).connect(this.buses.effects!);
    } else gain.connect(this.buses.effects!);
    if (this.reverb) gain.connect(this.reverb);
  }

  private tone(frequency: number, duration: number, volume: number, type: OscillatorType = 'sine', endFrequency = frequency, delay = 0, position?: { x: number; z: number }): void {
    const ctx = this.ctx; if (!ctx) return;
    const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.025, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain); this.route(gain, position);
    oscillator.start(start); oscillator.stop(start + duration + 0.05);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  private noise(duration: number, frequency: number, volume: number, position?: { x: number; z: number }, filterType: BiquadFilterType = 'bandpass'): void {
    const ctx = this.ctx; if (!ctx || !this.noiseBuffer) return;
    const source = ctx.createBufferSource(); source.buffer = this.noiseBuffer; source.loop = duration > 2;
    const filter = ctx.createBiquadFilter(); filter.type = filterType; filter.frequency.value = frequency; filter.Q.value = 1;
    const envelope = ctx.createGain(); const start = ctx.currentTime;
    envelope.gain.setValueAtTime(0, start); envelope.gain.linearRampToValueAtTime(volume, start + Math.min(0.15, duration / 5));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(envelope); this.route(envelope, position);
    source.start(start, Math.random() * 0.5); source.stop(start + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
  }

  play(name: SoundName | string, position?: { x: number; z: number }): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'footstep': this.noise(0.15, 450, 0.24, position); this.tone(75, 0.13, 0.13, 'sine', 32, 0, position); break;
      case 'breath': this.noise(1.3, 800, 0.13, position); break;
      case 'heartbeat': this.tone(48, 0.16, 0.28); this.tone(43, 0.18, 0.19, 'sine', 30, 0.24); break;
      case 'door': this.noise(1.2, 250, 0.55, position); this.tone(170, 1.4, 0.12, 'sawtooth', 48, 0, position); break;
      case 'electric': this.tone(60, 0.65, 0.13, 'sawtooth', 60, 0, position); this.noise(0.5, 1800, 0.25, position); break;
      case 'candle': this.noise(0.65, 2600, 0.09, position, 'highpass'); break;
      case 'whisper': this.noise(2.8, 1400, 0.45, position); this.tone(180, 2, 0.025, 'sine', 120, 0, position); break;
      case 'scream': this.tone(600, 1.8, 0.09, 'sawtooth', 140, 0, position); this.noise(1.7, 2200, 0.35, position); break;
      case 'presence': this.tone(73.4, 3, 0.24, 'sine', 36.7, 0, position); this.tone(78, 2.5, 0.15, 'sine', 38, 0, position); break;
      case 'chase': this.tone(40, 1.3, 0.3, 'sawtooth', 28); this.noise(0.7, 150, 0.45); break;
      case 'coin': this.tone(1046, 0.2, 0.12); this.tone(1568, 0.35, 0.08, 'sine', 1568, 0.09); break;
      case 'success': case 'complete':
        [196, 246.94, 293.66, 392].forEach((f, i) => this.tone(f, 1.7, 0.08, 'sine', f, i * 0.16)); break;
      case 'failure': this.tone(98, 0.8, 0.25, 'triangle', 49); this.noise(0.3, 900, 0.25); break;
      case 'death': this.tone(55, 3, 0.3, 'sawtooth', 15); this.noise(1.5, 300, 0.5); break;
      case 'ending': [146.83, 220, 293.66, 349.23].forEach((f, i) => this.tone(f, 4, 0.08, 'sine', f, i * 0.4)); break;
      default: this.tone(350, 0.12, 0.075, 'triangle', 180);
    }
  }

  update(dt: number, frame: AudioFrame): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (frame.player) this.player = { ...frame.player, yaw: frame.player.yaw ?? 0 };
    const tension = Math.max(0, Math.min(1, frame.tension));
    this.tensionGain?.gain.setTargetAtTime(tension * 0.065, this.ctx.currentTime, 0.4);
    this.droneGain?.gain.setTargetAtTime(0.045 + tension * 0.035, this.ctx.currentTime, 0.6);
    this.stepTime -= dt; this.heartTime -= dt; this.breathTime -= dt;
    if (frame.moving && this.stepTime <= 0) {
      this.stepTime = frame.sprinting ? 0.3 : 0.53;
      if (frame.material === 'water') this.noise(0.32, 1800, 0.38);
      else if (frame.material === 'metal') { this.tone(270, 0.22, 0.07, 'triangle', 180); this.play('footstep'); }
      else if (frame.material === 'wood') { this.tone(120, 0.18, 0.14, 'triangle', 55); this.noise(0.16, 750, 0.15); }
      else this.play('footstep');
    }
    if ((tension > 0.6 || (frame.health ?? 100) < 35 || (frame.sanity ?? 100) < 30) && this.heartTime <= 0) {
      this.heartTime = 1.3 - tension * 0.6; this.play('heartbeat');
    }
    if (frame.sprinting && this.breathTime <= 0) { this.breathTime = 2; this.play('breath'); }
  }

  stop(): void { void this.ctx?.suspend(); }
  dispose(): void { void this.ctx?.close(); this.ctx = undefined; }
}
