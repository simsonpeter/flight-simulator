export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.engineGain = null;
    this.engineOsc = null;
    this.engineNoise = null;
    this.abGain = null;
    this.musicTimer = 0;
    this.enabled = true;
    this.musicOn = true;
    this.gunCooldown = 0;
  }

  async unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.18;
    this.musicGain.connect(this.master);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineGain.connect(this.sfxGain);

    this.abGain = this.ctx.createGain();
    this.abGain.gain.value = 0;
    this.abGain.connect(this.sfxGain);

    this._startEngine();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.7 : 0;
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.value = on ? 0.18 : 0;
  }

  _noiseBuffer() {
    const len = this.ctx.sampleRate * 1.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _startEngine() {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 70;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 400;
    osc.connect(filt);
    filt.connect(this.engineGain);
    osc.start();
    this.engineOsc = osc;

    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    src.loop = true;
    const nfilt = this.ctx.createBiquadFilter();
    nfilt.type = 'bandpass';
    nfilt.frequency.value = 900;
    src.connect(nfilt);
    nfilt.connect(this.abGain);
    src.start();
    this.engineNoise = src;
  }

  playEngineSound(throttle, afterburner, airborne) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const vol = airborne ? 0.08 + throttle * 0.16 : 0.04 + throttle * 0.08;
    this.engineGain.gain.setTargetAtTime(vol, t, 0.08);
    if (this.engineOsc) this.engineOsc.frequency.setTargetAtTime(55 + throttle * 90 + (afterburner ? 40 : 0), t, 0.08);
    this.abGain.gain.setTargetAtTime(afterburner ? 0.12 : 0.015, t, 0.1);
  }

  playAfterburnerSound() {
    this._blip(90, 180, 0.18, 0.12, 'sawtooth');
  }

  playGunSound() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 220;
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.05);
    g.gain.value = 0.09;
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  playMissileLaunchSound() {
    this._blip(140, 40, 0.35, 0.16, 'sawtooth');
    this._noiseBurst(0.22, 600, 0.12);
  }

  playExplosionSound() {
    this._noiseBurst(0.45, 180, 0.28);
    this._blip(80, 30, 0.4, 0.2, 'triangle');
  }

  playWarningSound() {
    this._blip(880, 880, 0.12, 0.1, 'square');
    this._blip(620, 620, 0.12, 0.1, 'square', 0.14);
  }

  playLockSound() {
    this._blip(1400, 1800, 0.08, 0.07, 'square');
  }

  playHitSound() {
    this._noiseBurst(0.12, 900, 0.08);
  }

  updateMusic(dt, playing) {
    if (!this.ctx || !this.enabled || !this.musicOn || !playing) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 2.4;
    const base = 110;
    const notes = [0, 3, 7, 10, 7, 3];
    notes.forEach((n, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = base * Math.pow(2, n / 12);
      const t = this.ctx.currentTime + i * 0.18;
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 0.42);
    });
  }

  _blip(from, to, dur, vol, type, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noiseBurst(dur, freq, vol) {
    if (!this.ctx || !this.enabled) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = freq;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}

export function playEngineSound(audio, throttle, ab, airborne) { audio.playEngineSound(throttle, ab, airborne); }
export function playAfterburnerSound(audio) { audio.playAfterburnerSound(); }
export function playGunSound(audio) { audio.playGunSound(); }
export function playMissileLaunchSound(audio) { audio.playMissileLaunchSound(); }
export function playExplosionSound(audio) { audio.playExplosionSound(); }
export function playWarningSound(audio) { audio.playWarningSound(); }
export function playLockSound(audio) { audio.playLockSound(); }
