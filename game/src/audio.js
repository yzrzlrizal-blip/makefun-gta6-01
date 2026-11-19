// All sound and music are synthesized with WebAudio — no audio files, no
// network. A tiny step-sequencer plays an original synthwave bassline while
// you drive; sirens, gunshots, engine hum, pickups and punches are oscillators
// and filtered noise. M toggles mute; R changes the radio station (bassline).
const STATIONS = [
  { name: 'SOLMAR FM — Sunset Drive', bpm: 96, root: 55, minor: true },
  { name: 'BAY 104 — Night Cruise', bpm: 112, root: 49, minor: true },
  { name: 'PALM RADIO — Day Shift', bpm: 84, root: 65.4, minor: false },
];
// Semitone steps of one original 8-step bass riff, per station flavour.
const RIFF = [0, 0, 7, 0, 10, 0, 7, 5];

export function createAudio() {
  let ctx = null, master = null, musicGain = null, engineOsc = null, engineGain = null;
  let muted = false, station = 0, stepTimer = null, stepIndex = 0, started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      engineGain = ctx.createGain(); engineGain.gain.value = 0; engineGain.connect(master);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 60;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      engineOsc.connect(lp); lp.connect(engineGain); engineOsc.start();
      return true;
    } catch { return false; }
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  function musicStep() {
    if (!ctx || muted) return;
    const st = STATIONS[station];
    const semis = RIFF[stepIndex % RIFF.length];
    const freq = st.root * Math.pow(2, semis / 12);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.5, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    o.connect(g); g.connect(musicGain); o.start(); o.stop(ctx.currentTime + 0.24);
    if (stepIndex % 4 === 0) tone(st.root * 2, 0.1, 'sine', 0.25);
    stepIndex += 1;
  }
  return {
    start() {
      if (started || !ensure()) return;
      started = true;
      const st = STATIONS[station];
      stepTimer = window.setInterval(musicStep, 60000 / st.bpm / 2);
    },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setEngine(speed01, driving) {
      if (!ctx || !engineOsc) return;
      engineOsc.frequency.value = 55 + speed01 * 130;
      engineGain.gain.value = muted || !driving ? 0 : 0.05 + speed01 * 0.05;
    },
    siren(on) { if (on) tone(720, 0.4, 'sine', 0.12, 980); },
    shot() { noise(0.14, 0.5, 1800); tone(160, 0.1, 'square', 0.2, 60); },
    punch() { noise(0.08, 0.3, 900); },
    pickup() { tone(660, 0.09, 'sine', 0.25); tone(990, 0.14, 'sine', 0.25); },
    cash() { tone(880, 0.1, 'triangle', 0.3); tone(1320, 0.18, 'triangle', 0.3); },
    horn() { tone(370, 0.25, 'square', 0.18); tone(466, 0.25, 'square', 0.12); },
    crash() { noise(0.25, 0.5, 700); },
    busted() { tone(220, 0.5, 'sawtooth', 0.25, 110); },
    nextStation() {
      station = (station + 1) % STATIONS.length;
      if (stepTimer) { window.clearInterval(stepTimer); stepTimer = window.setInterval(musicStep, 60000 / STATIONS[station].bpm / 2); }
      return STATIONS[station].name;
    },
    stationName() { return STATIONS[station].name; },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    isMuted() { return muted; },
  };
}
