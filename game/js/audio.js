/* Laguna Azul — synthesized WebAudio: engine, siren, gunshots, bassline radio. No audio files. */
'use strict';
const AudioSys = {
  ctx: null, master: null, engineOsc: null, engineGain: null, sirenOn: false,
  sirenTimer: null, musicTimer: null, step: 0, enabled: false,
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
      // Engine: two detuned saw oscillators through a lowpass.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'square'; osc2.frequency.value = 28;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(lp); osc2.connect(lp);
      lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start(); osc2.start();
      this.enabled = true;
      this.startMusic();
    } catch (e) { this.enabled = false; }
  },
  setEngine(speed01, on) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.09 : 0.0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 170, t, 0.08);
  },
  blip(freq, dur, type, vol) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  },
  noiseBurst(dur, vol, freq) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1800;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.5;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  },
  gunshot() { this.noiseBurst(0.14, 0.6, 2400); this.blip(160, 0.09, 'square', 0.25); },
  explosion() { this.noiseBurst(0.9, 0.9, 500); this.blip(55, 0.7, 'sine', 0.5); },
  sirenStart() {
    if (!this.enabled || this.sirenOn) return;
    this.sirenOn = true; let hi = false;
    this.sirenTimer = setInterval(() => { this.blip(hi ? 960 : 720, 0.42, 'triangle', 0.10); hi = !hi; }, 430);
  },
  sirenStop() { this.sirenOn = false; if (this.sirenTimer) { clearInterval(this.sirenTimer); this.sirenTimer = null; } },
  // Golden Hour FM: lazy synth bassline + hats, A-minor groove.
  startMusic() {
    if (!this.enabled || this.musicTimer) return;
    const bass = [55, 0, 65.41, 0, 49, 0, 65.41, 82.41];
    this.musicTimer = setInterval(() => {
      if (!this.enabled) return;
      const n = bass[this.step % bass.length];
      if (n) this.blip(n, 0.34, 'triangle', 0.16);
      if (this.step % 2 === 0) this.noiseBurst(0.03, 0.05, 6000);
      this.step++;
    }, 240);
  }
};
