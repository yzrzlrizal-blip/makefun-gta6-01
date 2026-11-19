// Synthesised sound for Solmar Bay — no audio files, everything is built with
// the Web Audio API so the game stays offline and self-contained.
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenTimer = 0;
    this.sirenHigh = false;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  _tone(freq, dur, type = 'sine', vol = 0.5, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise(dur, vol = 0.5, lowpass = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  shoot() { this._noise(0.14, 0.7, 2600); this._tone(190, 0.08, 'square', 0.25, 60); }
  punch() { this._noise(0.09, 0.5, 500); this._tone(120, 0.1, 'sine', 0.4, 50); }
  crash() { this._noise(0.3, 0.8, 900); }
  pickup() { this._tone(660, 0.09, 'sine', 0.4); this._tone(990, 0.12, 'sine', 0.35); }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.22, 'triangle', 0.4), i * 110);
    });
  }
  busted() { this._tone(220, 0.5, 'sawtooth', 0.3, 110); }
  click() { this._tone(880, 0.05, 'square', 0.2); }

  // Continuous engine hum whose pitch follows speed; call every frame.
  engine(speed, maxSpeed, driving) {
    if (!this.ctx || this.muted) {
      if (this.engineOsc) { try { this.engineOsc.stop(); } catch { /* already stopped */ } this.engineOsc = null; }
      return;
    }
    if (!driving) {
      if (this.engineOsc) { try { this.engineOsc.stop(); } catch { /* already stopped */ } this.engineOsc = null; }
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.05;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const ratio = Math.abs(speed) / Math.max(1, maxSpeed);
    this.engineOsc.frequency.value = 55 + ratio * 165;
    this.engineGain.gain.value = 0.03 + ratio * 0.05;
  }

  // Two-tone police siren while any cop is close; call every frame.
  siren(dt, active) {
    if (!this.ctx || this.muted || !active) return;
    this.sirenTimer -= dt;
    if (this.sirenTimer <= 0) {
      this.sirenTimer = 0.42;
      this.sirenHigh = !this.sirenHigh;
      this._tone(this.sirenHigh ? 920 : 700, 0.4, 'sine', 0.12);
    }
  }
}
