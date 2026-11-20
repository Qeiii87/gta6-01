// All sound is synthesized live with WebAudio: no audio files, no network.
// Engine hum follows speed, sirens wail near police, and a small bass loop
// keeps the streets warm. Audio only starts after a user gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let musicTimer = 0;
  let musicStep = 0;
  let muted = false;
  let started = false;

  const BASS = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 73.42, 65.41, 58.27, 49];

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  return {
    /** Call from any user gesture; safe to call every frame. */
    unlock() {
      if (ensure() && ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    gunshot() {
      noise(0.09, 0.5, 1800);
      blip(140, 0.08, 'square', 0.25);
    },
    enemyShot() {
      noise(0.08, 0.22, 1200);
    },
    explosion() {
      noise(0.7, 0.9, 500);
      blip(60, 0.5, 'sine', 0.6);
    },
    crash() {
      noise(0.18, 0.5, 700);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.3);
      blip(880, 0.12, 'sine', 0.3, 0.08);
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.16, 'triangle', 0.3, i * 0.11));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => blip(f, 0.2, 'triangle', 0.25, i * 0.13));
    },
    click() {
      blip(900, 0.05, 'square', 0.15);
    },
    /** Per-frame: engine pitch by speed, siren wail, bass loop. */
    update(dt, speed, policeNear) {
      if (!ctx || muted) {
        if (engineGain) engineGain.gain.value = 0;
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      if (engineGain) {
        const target = speed > 5 ? 0.05 + Math.min(0.09, speed / 5200) : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
        engineOsc.frequency.setTargetAtTime(46 + speed * 0.16, ctx.currentTime, 0.08);
      }
      if (sirenGain) {
        sirenTimer += dt;
        if (sirenTimer > 0.45) {
          sirenTimer = 0;
          sirenHigh = !sirenHigh;
          sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, ctx.currentTime, 0.05);
        }
        sirenGain.gain.setTargetAtTime(policeNear ? 0.045 : 0, ctx.currentTime, 0.2);
      }
      musicTimer += dt;
      if (musicTimer >= 0.32) {
        musicTimer = 0;
        const note = BASS[musicStep % BASS.length];
        musicStep += 1;
        if (note > 0) blip(note, 0.28, 'triangle', 0.1);
        if (musicStep % 2 === 0) noise(0.02, 0.05, 6000);
      }
    },
  };
}
