// Tiny WebAudio synth: all sounds and music are generated in code (no files to fail loading).
// Any failure leaves the game silent but fully playable.
'use strict';

const Sound = (() => {
  let ctx = null, master, music, sfx, lp, noiseBuf, muted = false;
  let track = null, step = 0, nextT = 0;

  function init() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
      lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000; lp.connect(master);
      music = ctx.createGain(); music.gain.value = 0.28; music.connect(lp);
      sfx = ctx.createGain(); sfx.gain.value = 0.55; sfx.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  const ok = () => ctx && ctx.state === 'running';
  const mid = m => 440 * Math.pow(2, (m - 69) / 12);

  function tone(f, t, dur, { type = 'square', vol = 0.2, to = null, bus = sfx, a = 0.005, r = null } = {}) {
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (r || dur));
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + (r || dur) + 0.05);
    } catch (e) { /* ignore */ }
  }
  function noise(t, dur, { vol = 0.2, f = 1200, q = 1, to = null, type = 'bandpass', bus = sfx, a = 0.005 } = {}) {
    try {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
      if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  }

  const fx = {
    lead() { const t = ctx.currentTime; tone(mid(88), t, 0.07, { vol: 0.13 }); tone(mid(95), t + 0.06, 0.16, { vol: 0.13 }); },
    heart() { const t = ctx.currentTime; [76, 80, 83, 88].forEach((m, i) => tone(mid(m), t + i * 0.07, 0.5, { type: 'triangle', vol: 0.2, a: 0.01 })); tone(mid(64), t, 0.6, { type: 'sine', vol: 0.12 }); },
    plop() { const t = ctx.currentTime; tone(420, t, 0.14, { type: 'sine', vol: 0.18, to: 90 }); noise(t, 0.08, { vol: 0.06, f: 600 }); },
    hit() { const t = ctx.currentTime; tone(300, t, 0.22, { type: 'triangle', vol: 0.22, to: 110 }); noise(t + 0.02, 0.16, { vol: 0.1, f: 500, to: 150, type: 'lowpass' }); },
    swish() { noise(ctx.currentTime, 0.09, { vol: 0.035, f: 2400, to: 900, q: 0.7 }); },
    toss() { tone(500, ctx.currentTime, 0.12, { type: 'sine', vol: 0.06, to: 900 }); },
    pop() { tone(900, ctx.currentTime, 0.06, { type: 'square', vol: 0.05, to: 1400 }); },
    sting() { const t = ctx.currentTime; [72, 76, 79, 84].forEach((m, i) => tone(mid(m), t + i * 0.09, 0.2, { vol: 0.12 })); tone(mid(84), t + 0.36, 0.7, { vol: 0.12 }); tone(mid(88), t + 0.36, 0.7, { type: 'triangle', vol: 0.12 }); },
    tick() { tone(mid(84), ctx.currentTime, 0.08, { vol: 0.08 }); },
    stamp() { const t = ctx.currentTime; tone(160, t, 0.25, { type: 'triangle', vol: 0.35, to: 50 }); noise(t, 0.12, { vol: 0.12, f: 300, type: 'lowpass' }); [79, 84, 88].forEach(m => tone(mid(m), t + 0.05, 0.5, { vol: 0.07 })); },
    scratch() { const t = ctx.currentTime; noise(t, 0.28, { vol: 0.2, f: 3000, to: 250, q: 4 }); tone(700, t, 0.25, { type: 'sawtooth', vol: 0.04, to: 90 }); },
    chime() { const t = ctx.currentTime; [72, 76, 79, 84, 88, 91].forEach((m, i) => tone(mid(m), t + i * 0.08, 1.2, { type: 'triangle', vol: 0.12, a: 0.01 })); },
    confetti() { const t = ctx.currentTime; for (let i = 0; i < 6; i++) noise(t + i * 0.05, 0.05, { vol: 0.08, f: 2000 + i * 400, q: 3 }); },
    blip() { tone(mid(81 + ((Math.random() * 3) | 0)), ctx.currentTime, 0.035, { vol: 0.035 }); },
    breathIn() { noise(ctx.currentTime, 1.3, { vol: 0.05, f: 500, to: 1100, q: 0.6, a: 0.6 }); },
    breathOut() { noise(ctx.currentTime, 1.6, { vol: 0.05, f: 1000, to: 350, q: 0.6, a: 0.1 }); },
    bell() { const t = ctx.currentTime; tone(mid(69), t, 2.4, { type: 'sine', vol: 0.12, a: 0.02 }); tone(mid(76), t, 2.4, { type: 'sine', vol: 0.07, a: 0.02 }); },
  };

  // ---------- music: 16th-note step sequencer
  // work loop (A minor-ish, busy but friendly), 4 bars
  const WORK = {
    bpm: 128, steps: 64,
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    melody: [76, 0, 72, 0, 74, 0, 76, 0, 0, 79, 0, 76, 74, 0, 72, 0, 72, 0, 69, 0, 72, 0, 74, 0, 0, 72, 0, 69, 67, 0, 0, 0,
      67, 0, 64, 0, 67, 0, 72, 0, 0, 71, 0, 72, 74, 0, 0, 0, 74, 0, 71, 0, 67, 0, 71, 0, 74, 0, 76, 0, 74, 0, 71, 0],
  };
  // Happy Birthday (traditional, public domain), 3/4 in C, one 8th = 1 step
  const HB = (() => {
    const n = [[67, 1.5], [67, .5], [69, 2], [67, 2], [72, 2], [71, 4], [67, 1.5], [67, .5], [69, 2], [67, 2], [74, 2], [72, 4],
      [67, 1.5], [67, .5], [79, 2], [76, 2], [72, 2], [71, 2], [69, 2], [77, 1.5], [77, .5], [76, 2], [72, 2], [74, 2], [72, 6], [0, 4]];
    const out = []; let t = 0; n.forEach(([m, d]) => { out.push([t, m, d]); t += d; });
    return { notes: out, len: t, bpm: 150 };
  })();

  function schedule() {
    if (!ok() || !track) return;
    const now = ctx.currentTime;
    if (nextT < now) nextT = now + 0.05;
    while (nextT < now + 0.15) {
      if (track === 'work') {
        const s16 = 60 / WORK.bpm / 4, st = step % WORK.steps, ch = WORK.chords[(st / 16) | 0];
        if (st % 4 === 0) tone(mid(ch[0] - 12), nextT, s16 * 3, { type: 'triangle', vol: 0.3, bus: music });
        if (st % 4 === 2) tone(mid(ch[0] - 12 + 7), nextT, s16 * 1.5, { type: 'triangle', vol: 0.18, bus: music });
        tone(mid(ch[st % 3] + 12), nextT, s16 * 0.9, { type: 'square', vol: 0.035, bus: music });
        const m = WORK.melody[st]; if (m) tone(mid(m), nextT, s16 * 1.8, { type: 'square', vol: 0.06, bus: music });
        if (st % 2 === 0) noise(nextT, 0.03, { vol: st % 8 === 4 ? 0.07 : 0.03, f: 7000, q: 1, bus: music });
        if (st % 8 === 4) noise(nextT, 0.09, { vol: 0.08, f: 1800, q: 0.8, bus: music });
        nextT += s16;
      } else if (track === 'birthday') {
        const e8 = 60 / HB.bpm / 2, pos = step % HB.len;
        HB.notes.forEach(([t0, m, d]) => { if (t0 === pos && m) tone(mid(m), nextT, e8 * d * 0.95, { type: 'triangle', vol: 0.22, bus: music, a: 0.01 }); if (t0 === pos && m) tone(mid(m + 12), nextT, e8 * d * 0.6, { type: 'square', vol: 0.025, bus: music }); });
        if (pos >= 2 && (pos - 2) % 6 === 0) { const root = [48, 43, 43, 48, 48, 53, 48, 48, 48][((pos - 2) / 6) | 0]; [0, 4, 7].forEach(i => tone(mid(root + 12 + i), nextT, e8 * 5, { type: 'sine', vol: 0.05, bus: music, a: 0.08 })); tone(mid(root), nextT, e8 * 4, { type: 'triangle', vol: 0.22, bus: music }); }
        nextT += e8 * 0.5; // HB steps are in half-8ths so dotted rhythms fit
      }
      step += track === 'birthday' ? 0.5 : 1;
    }
  }

  return {
    unlock() { if (!ctx) init(); if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); },
    play(name) { if (ok() && fx[name]) try { fx[name](); } catch (e) { /* ignore */ } },
    music(name) { if (track === name) return; track = name; step = 0; if (ctx) nextT = ctx.currentTime + 0.05; },
    duck(on) { if (!ctx) return; const t = ctx.currentTime; lp.frequency.cancelScheduledValues(t); lp.frequency.setTargetAtTime(on ? 500 : 18000, t, 0.25); music.gain.setTargetAtTime(on ? 0.12 : 0.28, t, 0.25); },
    tick: schedule,
    setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.02); },
    get muted() { return muted; },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
  };
})();
