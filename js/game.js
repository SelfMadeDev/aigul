// «Где лиды, Тимофей?» — a tiny 3-lane birthday runner. Vanilla JS + Canvas.
'use strict';

// ---------------------------------------------------------------- constants
const LW = 180;            // logical (pixel-art) width; height follows the screen aspect
const LANE = 50;           // lane spacing in px at the player's depth
const DEPTH = 8;           // projection constant: scale = DEPTH / (DEPTH + z)
const SPEED = 15;          // world units / second
const ZFAR = 36;           // spawn distance (horizon)
const ZHIT = 0.35;         // an object resolves once when it crosses this depth
const TARGET = 20;
const SWITCH_T = 0.2;      // lane switch duration, s
const T_WIND = 0.55, T_FLY = 0.5, Z_LAND = 22; // throw telegraph timing
const ASSIST_AT = 60, ASSIST_EVERY = 0.9;

const TIM_LINES = ['Норм лид!', 'Берём!', 'В план!', 'Контакт же есть!', 'Потом разберёмся!', 'И это лид!', 'Берём всех!', 'Сделаем план!'];
const TIM_RARE = 'А ты сама продавала?';
const AND_LINES = ['Ты молодец! ❤️', 'Я на твоей стороне', 'Пиши, если нужна помощь', 'У тебя получится', 'Выдохни. Всё нормально ❤️', 'Спасибо тебе'];
const DIALOGUE = [
  'Ну что. Всё работает.',
  'Айгуль, спасибо тебе за доброту, большое сердце и за то, что тебе по-настоящему не всё равно.',
  'Мне очень радостно, что мы когда-то работали вместе.',
  'Пусть дальше будет побольше того, что тебя драйвит, классных людей и событий, которые хочется проживать, а не организовывать.',
  'Поменьше поводов переживать. И побольше дней, когда ничего не нужно держать под контролем. ❤️',
];
// pattern cycles per phase (see GAME_DESIGN_SPEC §16)
const CYCLES = {
  A: { beat: 2.5, list: ['single', 'poop', 'single', 'poopx', 'pair', 'poopx'] },
  B: { beat: 2.3, list: ['poop', 'single', 'double', 'poopx', 'pair', 'poopx'] },
  F: { beat: 2.0, list: ['poop', 'single', 'poopx', 'pair', 'double', 'poop'] },
};

// ---------------------------------------------------------------- DOM
const $ = id => document.getElementById(id);
const gameEl = $('game'), view = $('view'), vx = view.getContext('2d');
const QA_MODE = /[?&]qa\b/.test(location.search);

let ART = null;
let LH = 320, CX = LW / 2, YH = 128, YP = 274, GH = 146, K = 2; // layout
let screenBox = { x: 30, y: 30, w: 120, h: 50 };
let touchDevice = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// ---------------------------------------------------------------- state
let G = null;
let paused = false, pauseReason = null, timeScale = 1;

function newGame() {
  return {
    state: 'title', t: 0, runT: 0,
    score: 0, anx: 0, anxShown: 0,
    lane: 1, x: 1, sw: null, buf: null,
    objs: [], props: [], fx: [], floats: [], evq: [],
    dist: 0, speed: 0,
    tut: 0, tutT: 0, tutSpawn: 0, tutFlag: 0,
    beatAt: 0, cyc: { A: 0, B: 0, F: 0 }, heartAt: 0, assist: false, assistAt: 0, finalShown: false,
    lastLeadLane: 1, laneRot: 0,
    noPoopUntil: 0, immuneUntil: 0, hitAt: -9, happyAt: -9, meds: 0, med: null,
    timLine: 0, andLine: 0, timCount: 0, rareShown: false,
    tim: actor(), and: actor(),
    party: 0, aigul: { mode: 'run', x: 1, scale: 1, fy: 0 }, shake: 0,
    dlg: 0, typed: 0, fullText: '', log: [],
  };
}
function actor() { return { y: 1, ty: 1, pose: 'idle', seq: null, bubble: null, bubbleUntil: 0, x: 0, look: 0 }; }

// ---------------------------------------------------------------- layout
function layout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  let w = vw, h = vh;
  const portraitTouch = touchDevice && vh >= vw;
  if (!portraitTouch) { h = vh; w = Math.min(vw, Math.round(vh * 9 / 16)); }
  const ar = Math.min(Math.max(h / w, 16 / 9), 2.35);
  if (h / w > ar) h = Math.round(w * ar);
  Object.assign(gameEl.style, { width: w + 'px', height: h + 'px', left: Math.round((vw - w) / 2) + 'px', top: Math.round((vh - h) / 2) + 'px' });
  LH = Math.round(LW * h / w);
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  view.width = Math.round(w * dpr); view.height = Math.round(h * dpr);
  K = view.width / LW;
  CX = LW / 2; YH = Math.round(LH * 0.4); YP = Math.round(LH * 0.855); GH = YP - YH;
  const cssK = w / LW, padTop = parseFloat(getComputedStyle($('hud')).paddingTop) || 10;
  const hudLow = Math.round((padTop + 46) / cssK);
  const sy = hudLow + 5, sh = Math.max(30, Math.min(58, YH - 50 - sy));
  screenBox = { x: 34, y: sy, w: 112, h: sh };
  checkOrientation();
}

// ---------------------------------------------------------------- projection
const sOf = z => DEPTH / (DEPTH + z);
function proj(x, z, hgt = 0) { const s = sOf(z); return { X: CX + (x - 1) * LANE * s, Y: YH + GH * s - hgt * LANE * s, s }; }

// ---------------------------------------------------------------- UI helpers
function iconURL(c) { return c.toDataURL(); }
function rich(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/❤️?/g, '<i class="ic ic-heart"></i>').replace(/✓/g, '<i class="ic ic-check"></i>')
    .replace(/←/g, '<i class="ic ic-left"></i>').replace(/→/g, '<i class="ic ic-right"></i>');
}
function show(id, on = true) { $(id).classList.toggle('hidden', !on); }
let capTimers = [];
function caption(items, keepOld = false) {
  const el = $('caption');
  if (!keepOld) el.innerHTML = '';
  items.forEach(([text, cls]) => { const s = document.createElement('span'); s.className = 'c ' + (cls || ''); s.innerHTML = rich(text); el.appendChild(s); });
}
function captionOut() { $('caption').querySelectorAll('.c').forEach(c => c.classList.add('out')); }
function clearCaption() { $('caption').innerHTML = ''; }
function hint(text) {
  const el = $('hint');
  if (!text) { el.classList.add('hidden'); el.dataset.t = ''; return; }
  if (el.dataset.t === text) return;
  el.dataset.t = text; el.innerHTML = rich(text); el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
}
function hud() {
  $('score').textContent = G.score;
  $('anxv').textContent = Math.round(G.anxShown);
  $('anxbar').style.width = G.anxShown + '%';
  $('anx').classList.toggle('soft', G.anxShown >= 60);
}
function popScore() { const l = $('leads'); l.classList.remove('pop'); void l.offsetWidth; l.classList.add('pop'); }

// ---------------------------------------------------------------- state machine
function setState(s) { G.state = s; G.t = 0; }
const RUNNER = s => s === 'tutorial' || s === 'running';

function toTitle() {
  G = newGame();
  ['hud', 'mute', 'dlg', 'card', 'post', 'hint', 'finger'].forEach(i => show(i, false));
  clearCaption(); show('title');
  buildProps();
  hud();
}

function startRun() {
  Sound.unlock();
  G = newGame();
  buildProps();
  show('title', false); show('post', false); show('hud'); show('mute'); clearCaption();
  setState('tutorial');
  G.speed = SPEED;
  Sound.music('work'); Sound.duck(false);
  hud();
}

// ---------------------------------------------------------------- input
function move(dir) {
  if (paused || !RUNNER(G.state)) return;
  if (G.sw) { if (G.buf === null) G.buf = dir; return; }
  const to = G.lane + dir;
  if (to < 0 || to > 2) return;
  G.lane = to; G.sw = { from: G.x, to, t: 0 };
  Sound.play('swish');
  if (G.state === 'tutorial' && G.tut === 0) tutStep(1);
}

let ptr = null;
gameEl.addEventListener('pointerdown', e => {
  if (e.target.closest('button')) return;
  ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), done: false };
});
gameEl.addEventListener('pointermove', e => {
  if (!ptr || ptr.id !== e.pointerId || ptr.done) return;
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y, th = Math.min(34, gameEl.clientWidth * 0.07);
  if (Math.abs(dx) >= th && Math.abs(dx) > Math.abs(dy) * 1.1) { ptr.done = true; move(dx > 0 ? 1 : -1); }
});
gameEl.addEventListener('pointerup', e => {
  if (!ptr || ptr.id !== e.pointerId) return;
  const p = ptr; ptr = null;
  if (p.done || e.target.closest('button')) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && performance.now() - p.t < 400) {
    if (RUNNER(G.state)) { const r = gameEl.getBoundingClientRect(); move(e.clientX < r.left + r.width / 2 ? -1 : 1); }
    else advance();
  }
});
gameEl.addEventListener('pointercancel', () => { ptr = null; });
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', e => {
  if (e.repeat && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
  if (e.key === 'ArrowLeft') { move(-1); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { move(1); e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (paused && pauseReason === 'user') return resume();
    if (G.state === 'title') return startRun();
    if (G.state === 'postCredits' && !$('again').classList.contains('hidden')) return startRun();
    advance();
  }
});
$('go').addEventListener('click', startRun);
$('again').addEventListener('click', startRun);
$('mute').addEventListener('click', () => { Sound.unlock(); Sound.setMuted(!Sound.muted); setMuteIcon(); });
$('resume').addEventListener('click', resume);
$('dlg').addEventListener('click', e => { e.stopPropagation(); advance(); });
$('card').addEventListener('click', e => { e.stopPropagation(); advance(); });

// ---------------------------------------------------------------- pause / orientation
function isLandscapeTouch() { return touchDevice && window.innerWidth > window.innerHeight; }
function pauseGame(reason) {
  if (G.state === 'title' || G.state === 'postCredits') { if (reason === 'hidden') Sound.suspend(); return; }
  paused = true; pauseReason = reason; ptr = null; G.buf = null;
  Sound.suspend();
}
function resume() {
  if (isLandscapeTouch() || document.hidden) return;
  paused = false; pauseReason = null; show('pause', false);
  Sound.unlock(); Sound.resume();
}
function checkOrientation() {
  const land = isLandscapeTouch();
  show('rotate', land);
  if (!G) return;
  if (land) pauseGame('rotate');
  else if (paused && pauseReason === 'rotate') afterInterruption();
}
function afterInterruption() {
  // Runner states wait for an explicit tap so nothing hits the player on return.
  if (RUNNER(G.state) || G.state === 'meditation') { pauseReason = 'user'; show('pause'); }
  else resume();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame('hidden');
  else if (paused && pauseReason === 'hidden') afterInterruption();
  else Sound.resume();
});
window.addEventListener('pagehide', () => pauseGame('hidden'));
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 200));

// ---------------------------------------------------------------- spawning
function spawnLead(lane, opts = {}) {
  if (QA_MODE) G.log.push({ k: 'lead', t: G.runT, lane, arrive: G.runT + (opts.z || ZFAR) / SPEED, home: !!opts.home });
  G.objs.push({ type: 'lead', x: lane, z: opts.z || ZFAR, home: !!opts.home, age: 0, done: false });
}
function laneFree(lane, arrive, win = 0.7) {
  return !G.objs.some(o => !o.done && o.type === 'poop' && Math.round(o.x) === lane && Math.abs(o.z / SPEED - arrive) < win);
}
function pendingPoops() { return G.objs.some(o => !o.done && o.type === 'poop'); }
function later(delay, fn) { G.evq.push({ at: G.runT + delay, fn }); }
function adj(l) { return l === 0 ? 1 : l === 2 ? 1 : (G.laneRot++ % 2 ? 0 : 2); }

function timThrow(lanes, line) {
  const a = G.tim;
  a.seq = { t: 0, kind: 'throw', objs: [] };
  lanes.forEach(l => {
    const o = { type: 'poop', x: l, z: Z_LAND + SPEED * (T_WIND + T_FLY), age: 0, air: true, done: false, spin: Math.random() * 6 };
    G.objs.push(o); a.seq.objs.push(o);
  });
  G.timCount++;
  if (QA_MODE) G.log.push({ k: 'poop', t: G.runT, lanes: lanes.slice(), player: G.lane, arrive: G.runT + (Z_LAND + SPEED * (T_WIND + T_FLY)) / SPEED, line: line || null, state: G.state, score: G.score });
  say(a, line || TIM_LINES[G.timLine++ % TIM_LINES.length], 1.6);
}
function andThrow(lane) {
  const a = G.and;
  a.seq = { t: 0, kind: 'throw', objs: [] };
  const o = { type: 'heart', x: lane, z: 20 + SPEED * (T_WIND + T_FLY), age: 0, air: true, done: false };
  G.objs.push(o); a.seq.objs.push(o);
  if (QA_MODE) G.log.push({ k: 'heart', t: G.runT, lane, arrive: G.runT + o.z / SPEED });
  say(a, AND_LINES[G.andLine++ % AND_LINES.length], 1.9);
}
function say(a, text, dur) { a.bubble = text; a.bubbleUntil = dur; a.bubbleT = 0; }

// choose a lane for plain lead patterns; alternates so an idle player still gets some
function leadLane() {
  const P = G.lane, opts = [P, adj(P), P, 2 - P === P ? adj(P) : 2 - P];
  const l = opts[G.laneRot++ % opts.length];
  return l;
}

function runPattern(name) {
  const P = G.lane;
  const poopOk = G.runT >= G.noPoopUntil;
  if ((name === 'poop' || name === 'poopx' || name === 'double') && !poopOk) name = 'single';
  if (name === 'double' && pendingPoops()) name = 'poop';
  const arriveLead = T_WIND + T_FLY + Z_LAND / SPEED - ZFAR / SPEED; // delay so a lead meets the poop beat
  switch (name) {
    case 'single': spawnLead(leadLane()); break;
    case 'pair': { const l = leadLane(); spawnLead(l); later(0.32, () => spawnLead(l)); break; }
    case 'swap': { const a = leadLane(), b = adj(a); spawnLead(a); later(0.55, () => spawnLead(b)); break; }
    case 'poop': case 'poopx': {
      const safe = adj(P);
      let line = null;
      if (!G.rareShown && G.state === 'running' && G.runT > 22 && G.score <= 13 && G.timCount >= 3) { line = TIM_RARE; G.rareShown = true; }
      timThrow([P], line);
      if (name === 'poop') later(Math.max(0, arriveLead), () => spawnLead(safe));
      break;
    }
    case 'double': {
      const safe = adj(P), other = [0, 1, 2].find(l => l !== P && l !== safe);
      timThrow([P, other]);
      later(Math.max(0, arriveLead), () => spawnLead(safe));
      break;
    }
  }
}

// ---------------------------------------------------------------- tutorial
function tutStep(n) {
  G.tut = n; G.tutT = 0; G.tutFlag = 0;
  if (n === 1) { hint('Собирай хорошие лиды'); show('finger', false); }
  if (n === 2) { hint('От этого лучше увернуться'); const P = G.lane; timThrow([P]); later(Math.max(0, T_WIND + T_FLY + Z_LAND / SPEED - ZFAR / SPEED), () => spawnLead(adj(P))); }
  if (n === 3) { hint('А это пригодится'); andThrow(G.lane); }
}
function updateTutorial(dt) {
  G.tutT += dt;
  if (G.tut === 0) {
    if (G.t > 0.4 && !G.tutFlag) { G.tutFlag = 1; hint('Свайпай ← →'); show('finger'); }
    G.tutSpawn -= dt;
    if (G.t > 0.5 && G.tutSpawn <= 0) { spawnLead(adj(G.lane)); G.tutSpawn = 2.2; }
  } else if (G.tut === 1) {
    G.tutSpawn -= dt;
    if (G.tutSpawn <= 0 && G.score < 1) { spawnLead(G.lane); later(0.32, () => spawnLead(G.lane)); G.tutSpawn = 2.0; }
    if (G.score >= 1 && G.tutT > 1.6 && !G.objs.some(o => o.type === 'lead' && !o.done && o.z > 8)) tutStep(2);
  } else if (G.tut === 2) {
    const alive = G.objs.some(o => o.type === 'poop' && !o.done);
    if (!alive) { G.tutFlag += dt; if (G.tutFlag > 0.5) tutStep(3); }
  } else if (G.tut === 3) {
    const alive = G.objs.some(o => o.type === 'heart' && !o.done);
    if (!alive && G.tutT > 1) {
      G.tutFlag += dt;
      if (G.tutFlag > 0.5) {
        hint(null); setState('running');
        G.beatAt = G.runT + 0.6; G.heartAt = G.runT + 9;
      }
    }
  }
}

// ---------------------------------------------------------------- running director
function updateDirector() {
  if (!G.assist && G.runT >= ASSIST_AT && G.score < TARGET) { G.assist = true; G.assistAt = G.runT; }
  if (G.assist) {
    // Silent assist: no new attacks, leads come to the current lane and drift with the player.
    if (G.runT >= G.assistAt) { spawnLead(G.lane, { home: true }); G.assistAt = G.runT + ASSIST_EVERY; }
    return;
  }
  if (G.runT >= G.beatAt) {
    const ph = G.score >= TARGET - 5 ? 'F' : G.runT < 30 ? 'A' : 'B';
    const c = CYCLES[ph];
    runPattern(c.list[G.cyc[ph]++ % c.list.length]);
    G.beatAt = G.runT + c.beat;
  }
  if (G.runT >= G.heartAt && !G.and.seq) {
    const arrive = T_WIND + T_FLY + 20 / SPEED;
    const P = G.lane, pref = [P, adj(P), 2 - P, 0, 1, 2];
    const lane = pref.find(l => laneFree(l, arrive, 0.9));
    if (lane !== undefined) { andThrow(lane); G.heartAt = G.runT + 11 + (G.andLine % 3); }
    else G.heartAt = G.runT + 1;
  }
}

// ---------------------------------------------------------------- effects
function burst(x, y, n, colors, spd = 40, up = 20, life = 0.6, grav = 60) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random() * 0.8);
    G.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, life, max: life, c: colors[i % colors.length], g: grav, sz: Math.random() < 0.3 ? 2 : 1 });
  }
}
function floater(text, x, y, color) { G.floats.push({ text, x, y, t: 0, color }); }

function collect(o) {
  const p = proj(o.x, 0, 0.3);
  if (o.type === 'lead') {
    G.score = Math.min(TARGET, G.score + 1);
    Sound.play('lead');
    burst(p.X, p.Y - 6, 12, ['#ffcf4a', '#fff0a6', '#57b979'], 45, 25);
    floater('+1', p.X, p.Y - 16, '#ffcf4a');
    popScore();
    if (G.score === TARGET - 5 && !G.finalShown && G.state === 'running') {
      G.finalShown = true; caption([['ДО ПЛАНА: 5', 'big']]);
      setTimeout(() => { if (G.state === 'running' || G.state === 'meditation') captionOut(); }, 1500);
    }
  } else if (o.type === 'heart') {
    const before = G.anx;
    G.anx = Math.max(0, G.anx - 25);
    Sound.play('heart');
    G.happyAt = G.runT;
    burst(p.X, p.Y - 10, 14, ['#ff5b7c', '#ffc4d0', '#ffe486'], 35, 35, 0.9, 20);
    const d = before - G.anx;
    floater(d > 0 ? '−' + d : '❤', p.X, p.Y - 18, '#ffc4d0');
  }
}
function hitPoop(o) {
  if (G.runT < G.immuneUntil) return;
  const p = proj(o.x, 0, 0.3);
  G.anx = Math.min(100, G.anx + 20);
  G.hitAt = G.runT; G.shake = 0.18;
  G.noPoopUntil = Math.max(G.noPoopUntil, G.runT + 1.25);
  Sound.play('hit');
  burst(p.X, p.Y - 4, 14, ['#8a5433', '#b57a4a', '#643a22'], 50, 20);
  floater('+20', p.X, p.Y - 26, '#d9c8ff');
}

// ---------------------------------------------------------------- runner update
function updateLane(dt) {
  if (!G.sw) return;
  G.sw.t += dt / SWITCH_T;
  const k = Math.min(1, G.sw.t), e = 1 - Math.pow(1 - k, 3);
  G.x = G.sw.from + (G.sw.to - G.sw.from) * e;
  if (k >= 1) {
    G.x = G.sw.to; G.sw = null;
    if (G.buf !== null) { const d = G.buf; G.buf = null; move(d); }
  }
}

function updateActors(dt, runner) {
  for (const who of ['tim', 'and']) {
    const a = G[who], s = a.seq;
    if (a.bubble) { a.bubbleT += dt; if (a.bubbleT > a.bubbleUntil) a.bubble = null; }
    if (!s) { a.y += (a.ty - a.y) * Math.min(1, dt * 10); continue; }
    s.t += dt;
    if (s.kind === 'throw') {
      a.ty = s.t < 1.75 ? 0 : 1;
      a.pose = s.t < 0.12 ? 'idle' : s.t < T_WIND ? (who === 'tim' ? 'windup' : 'wave') : s.t < T_WIND + 0.35 ? 'throw' : 'idle';
      if (s.t >= T_WIND && !s.released) { s.released = true; Sound.play('toss'); }
      if (s.t > 2.1) { a.seq = null; a.pose = 'idle'; }
    }
    a.y += (a.ty - a.y) * Math.min(1, dt * 12);
  }
}

function updateObjects(dt) {
  const dz = G.speed * dt;
  const hits = [];
  for (const o of G.objs) {
    if (o.done) continue;
    o.age += dt;
    const prev = o.z;
    o.z -= dz;
    if (o.air && o.age >= T_WIND + T_FLY) { o.air = false; if (o.type === 'poop') { Sound.play('plop'); const p = proj(o.x, o.z); burst(p.X, p.Y, 6, ['#8a8290', '#6a6272'], 20, 8, 0.4); } }
    if (o.home && o.z > 7) o.x += (G.lane - o.x) * Math.min(1, dt * 8);
    if (!o.air && prev > ZHIT && o.z <= ZHIT) hits.push(o);
    if (o.z < -3) o.done = true;
  }
  if (!RUNNER(G.state)) return;
  // Resolve rewards first: the 20th lead wins over a same-step 100% anxiety.
  hits.sort((a, b) => (a.type === 'poop') - (b.type === 'poop'));
  for (const o of hits) {
    if (!RUNNER(G.state)) break;
    const d = Math.abs(G.x - o.x);
    if (o.type === 'poop') {
      o.resolved = true;
      if (d < 0.45 && G.runT >= G.immuneUntil) { o.done = true; hitPoop(o); if (G.anx >= 100) { enterMeditation(); break; } }
    } else if (d < 0.62) {
      o.done = true; collect(o);
      if (G.score >= TARGET) { enterTargetHit(); break; }
    } else o.resolved = true;
  }
  G.objs = G.objs.filter(o => !o.done);
}

function updateFx(dt) {
  for (const p of G.fx) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  G.fx = G.fx.filter(p => p.life > 0);
  for (const f of G.floats) f.t += dt;
  G.floats = G.floats.filter(f => f.t < 0.9);
}

function updateRunner(dt) {
  G.runT += dt;
  G.dist += G.speed * dt;
  for (const e of G.evq.slice()) if (G.runT >= e.at) { G.evq.splice(G.evq.indexOf(e), 1); e.fn(); }
  updateLane(dt);
  updateActors(dt, true);
  updateObjects(dt);
}

// ---------------------------------------------------------------- meditation
function enterMeditation() {
  const prev = G.state;
  setState('meditation');
  G.meds++;
  G.med = { dur: G.meds === 1 ? 4 : 2.8, stage: 0, prev };
  G.sw && (G.x = G.sw.to, G.sw = null); G.buf = null;
  hint(null); G.floats = [];
  Sound.duck(true); Sound.play('bell');
  clearCaption();
}
function updateMeditation(dt) {
  const m = G.med, k = m.dur / 4, t = G.t;
  const steps = [[0.25 * k, () => { caption([['Так. Выдох.', 'calm']]); Sound.play('breathOut'); }],
    [1.0 * k, () => { G.anx = 70; }], [1.8 * k, () => { G.anx = 45; Sound.play('breathIn'); }], [2.6 * k, () => { G.anx = 30; }],
    [2.9 * k, () => { caption([['Теперь можно дальше.', 'calm']]); }], [m.dur, () => { captionOut(); }]];
  while (m.stage < steps.length && t >= steps[m.stage][0]) steps[m.stage++][1]();
  if (t >= m.dur) {
    // safe resume: clear hazards, block new ones, brief immunity; rewards stay collectible
    G.objs = G.objs.filter(o => o.type !== 'poop');
    if (G.tim.seq) { G.tim.seq = null; G.tim.ty = 1; }
    G.immuneUntil = G.runT + 1.5; G.noPoopUntil = G.runT + 1.5;
    G.beatAt = Math.max(G.beatAt, G.runT + 0.8);
    Sound.duck(false);
    setState(m.prev);
  }
}

// ---------------------------------------------------------------- scripted ending
function enterTargetHit() {
  setState('targetHit');
  G.evq = []; G.buf = null;
  hint(null); show('finger', false);
  for (const o of G.objs) if (!o.done && o.type !== 'lead') { const p = proj(o.x, Math.max(0, o.z)); burst(p.X, p.Y - 4, 6, ['#fff3de', '#cbb9c9'], 25, 10, 0.5); o.done = true; }
  G.objs = G.objs.filter(o => !o.done && o.z > 0);
  G.objs.forEach(o => o.fade = 1);
  G.tim.seq = null; G.and.seq = null; G.tim.bubble = null; G.and.bubble = null;
  G.and.ty = 1;
  Sound.play('sting');
  const p = proj(G.x, 0, 0.5); burst(p.X, p.Y - 10, 30, ['#ffcf4a', '#fff0a6', '#57b979', '#ffffff'], 70, 40, 1);
  caption([['ПЛАН ВЫПОЛНЕН ✓', 'huge']]);
}
function updateTargetHit(dt) {
  const t = G.t, a = G.tim;
  G.speed = Math.max(0, G.speed - SPEED * dt / 1.2);
  G.dist += G.speed * dt;
  updateLane(dt);
  for (const o of G.objs) { o.z -= G.speed * dt; o.fade = Math.max(0, (o.fade || 1) - dt * 2); }
  G.objs = G.objs.filter(o => o.fade > 0);
  if (t > 1.5 && t - dt <= 1.5) captionOut();
  // Timofey: reach for another bad lead → empty → look → shrug → leaves
  if (t > 0.9) a.ty = 0;
  a.pose = t < 1.6 ? 'pocket' : t < 2.2 ? 'empty' : t < 2.7 ? 'look' : t < 3.2 ? 'shrug' : ((t * 6) | 0) % 2 ? 'walkL0' : 'walkL1';
  if (t > 1.6 && t - dt <= 1.6) { a.q = 1; Sound.play('pop'); }
  if (t > 2.7 && t - dt <= 2.7) a.q = 0;
  if (t >= 3.2) a.x -= dt * 60;
  a.y += (a.ty - a.y) * Math.min(1, dt * 10);
  if (t > 3.3 && t - dt <= 3.3) caption([['Тимофей ушёл куда-то.', 'note']]);
  if (t > 5.0 && t - dt <= 5.0) captionOut();
  if (t >= 5.4) { setState('falseEnding'); clearCaption(); }
}
function updateFalseEnding() {
  const t = G.t, at = x => G.t >= x && G.t - G.dt < x;
  if (at(0.05)) { caption([['ЛИДЫ 20/20 ✓', '']]); Sound.play('tick'); }
  if (at(0.55)) { caption([['ПЛАН ✓', '']], true); Sound.play('tick'); }
  if (at(1.05)) { caption([['ВЫСТАВКА ✓', '']], true); Sound.play('tick'); }
  if (at(1.6)) captionOut();
  if (at(1.9)) { caption([['ВСЁ, КОРОЧЕ, РАБОТАЕТ.', 'stamp']]); Sound.play('stamp'); G.shake = 0.15; }
  if (at(3.7)) captionOut();
  if (t >= 4.0) { setState('birthdayReveal'); clearCaption(); }
}
function updateReveal(dt) {
  const t = G.t, at = x => G.t >= x && G.t - dt < x;
  if (t < 0.9) G.speed = Math.min(SPEED, G.speed + SPEED * dt * 2.4);
  else G.speed = Math.max(0, G.speed - SPEED * dt * 6);
  G.dist += G.speed * dt;
  if (at(0.01)) { G.aigul.mode = 'run'; show('hud', false); show('mute'); }
  if (at(0.9)) { Sound.music(null); Sound.play('scratch'); G.shake = 0.12; G.aigul.mode = 'stop'; }
  if (at(1.3)) caption([['Айгуль.', 'calm']]);
  if (at(2.2)) caption([['Всё.', 'calm']], true);
  if (at(3.1)) caption([['Сегодня больше никаких лидов.', 'calm']], true);
  if (at(4.8)) captionOut();
  if (t > 5.0) {
    const k = Math.min(1, (t - 5.0) / 2.2);
    if (G.party === 0) { Sound.play('chime'); Sound.music('birthday'); G.aigul.mode = 'turn'; }
    G.party = Math.max(0.001, k);
  }
  if (at(5.8)) { confetti(80); Sound.play('confetti'); G.aigul.mode = 'cheer'; }
  if (at(6.9)) confetti(50);
  if (t >= 8.0) { setState('dialogue'); G.dlg = -1; }
}
function confetti(n) {
  const cols = ['#ff5b7c', '#ffcf4a', '#6fd0ff', '#8be28b', '#c79bff', '#fff3de'];
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    G.fx.push({ x: CX + side * (LW / 2 + 4), y: YH - 10 + Math.random() * 40, vx: -side * (40 + Math.random() * 70), vy: -60 - Math.random() * 60, life: 3, max: 3, c: cols[i % cols.length], g: 55, sz: 2, conf: Math.random() * 6 });
  }
}
function updateDialogue(dt) {
  const t = G.t, a = G.and;
  // Andrey walks in; Aigul zooms to the stage
  G.aigul.x += (0.62 - G.aigul.x) * Math.min(1, dt * 3);
  G.aigul.scale += (2 - G.aigul.scale) * Math.min(1, dt * 3);
  if (G.dlg === -1) {
    if (!a.walk) { a.walk = true; a.wx = LW + 30; }
    a.wx += (128 - a.wx) * Math.min(1, dt * 3.2);
    if (t > 1.3) { G.dlg = 0; openPage(0); }
  } else a.wx += (128 - a.wx) * Math.min(1, dt * 4);
  if (G.dlg >= 0 && G.dlg < DIALOGUE.length && G.typed < G.fullText.length) {
    const before = Math.floor(G.typed);
    G.typed = Math.min(G.fullText.length, G.typed + dt * 45);
    if (Math.floor(G.typed) !== before && Math.floor(G.typed) % 3 === 0) Sound.play('blip');
    renderTyped();
  }
  if (Math.random() < dt * 0.6) confetti(3);
}
function openPage(i) {
  G.fullText = DIALOGUE[i]; G.typed = 0;
  show('dlg'); renderTyped();
}
function renderTyped() {
  const n = Math.floor(G.typed), done = n >= G.fullText.length;
  $('dlgText').innerHTML = rich(G.fullText.slice(0, n)) + '<span style="visibility:hidden">' + rich(G.fullText.slice(n)) + '</span>';
  $('dlg').classList.toggle('typing', !done);
}
function advance() {
  if (paused) return;
  if (G.state === 'dialogue') {
    if (G.dlg < 0) return;
    if (G.dlg < DIALOGUE.length) {
      if (G.typed < G.fullText.length) { G.typed = G.fullText.length; renderTyped(); return; }
      G.dlg++;
      Sound.play('tick');
      if (G.dlg < DIALOGUE.length) openPage(G.dlg);
      else { show('dlg', false); show('card'); confetti(90); Sound.play('chime'); Sound.play('confetti'); G.cardAt = G.t; }
    } else if (G.t - G.cardAt > 0.6) {
      show('card', false); enterPost();
    }
  }
}
function enterPost() {
  setState('postCredits');
  show('post'); show('postAndrey', false); show('postSmall', false); show('again', false);
  Sound.music(null);
}
function updatePost() {
  const at = x => G.t >= x && G.t - G.dt < x;
  if (at(1.8)) { show('postAndrey'); Sound.play('pop'); drawPostSprite(); }
  if (at(3.2)) show('postSmall');
  if (at(4.0)) show('again');
}
function drawPostSprite() {
  const c = $('postSprite'), s = ART.and.idle; c.width = s.width; c.height = s.height;
  const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.drawImage(s, 0, 0);
}

// ---------------------------------------------------------------- main update
function update(dt) {
  G.dt = dt;
  if (G.shake > 0) G.shake -= dt;
  switch (G.state) {
    case 'title': G.t += dt; break;
    case 'tutorial':
      G.t += dt; updateRunner(dt);
      if (G.state === 'tutorial') updateTutorial(dt);
      break;
    case 'running':
      G.t += dt; updateRunner(dt);
      if (G.state === 'running') updateDirector();
      break;
    case 'meditation': G.t += dt; updateMeditation(dt); break;
    case 'targetHit': G.t += dt; updateTargetHit(dt); break;
    case 'falseEnding': G.t += dt; updateFalseEnding(); break;
    case 'birthdayReveal': G.t += dt; updateReveal(dt); break;
    case 'dialogue': G.t += dt; updateDialogue(dt); break;
    case 'postCredits': G.t += dt; updatePost(); break;
  }
  if (G.state !== 'meditation') updateFx(dt);
  // HUD anxiety eases toward its value (meditation animates it slowly)
  const rate = G.state === 'meditation' ? 55 : 160;
  G.anxShown += Math.sign(G.anx - G.anxShown) * Math.min(Math.abs(G.anx - G.anxShown), rate * dt);
  hud();
}

// ---------------------------------------------------------------- rendering
// Everything is drawn straight to the device canvas in logical units (LW wide) with smooth vector shapes.
const X = vx;
const FONT = 'Nunito, "Segoe UI", Roboto, sans-serif';
function buildProps() { /* scenery is a deterministic repeating strip; nothing to prebuild */ }
const BOOTH = [
  { wall: '#8f6f7c', fas: '#6b5060', scr: '#9fd4d8' },
  { wall: '#6f7f98', fas: '#515d73', scr: '#f3d9a4' },
  { wall: '#a08a78', fas: '#76645a', scr: '#a9d6cf' },
  { wall: '#7d7196', fas: '#5c5373', scr: '#f0c9b8' },
];
const PARTY = ['#ff7aa2', '#ffcf4a', '#6fc8f0', '#8bd98b', '#c59bff'];

function mix(a, b, k) { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; }
function tint(c) { return G.party ? mix(c, '#d9956b', G.party * 0.45) : c; }
function poly(pts, fill) { X.beginPath(); X.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) X.lineTo(pts[i][0], pts[i][1]); X.closePath(); X.fillStyle = fill; X.fill(); }
function glow(x, y, r, col, a) {
  const g = X.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
  X.fillStyle = g; X.fillRect(x - r, y - r, r * 2, r * 2);
}
function img(s, x, y, w = s.lw, h = s.lh) { X.drawImage(s, x, y, w, h); }
function ground(xl, z, hgt = 0) { return proj(xl, z, hgt); }

function drawHall(t) {
  const party = G.party;
  const g = X.createLinearGradient(0, 0, 0, YH);
  g.addColorStop(0, party ? mix('#241d2e', '#5a2f3a', party) : '#241d2e');
  g.addColorStop(1, party ? mix('#4a4057', '#b8705a', party) : '#4a4057');
  X.fillStyle = g; X.fillRect(0, 0, LW, YH + 1);
  // hanging lamps drifting towards the camera: soft light only, no clutter
  const cH = 5.6, off = G.dist % 6;
  for (let i = 7; i >= 0; i--) {
    const z = i * 6 - off + 2; if (z < -1) continue;
    const s = sOf(z), y = YH + (GH - cH * LANE) * s;
    X.fillStyle = `rgba(20,14,26,${0.35 * Math.min(1, s * 2)})`; X.fillRect(CX - 3.2 * LANE * s, y - 0.4 * s, 6.4 * LANE * s, Math.max(0.4, 1.2 * s));
    for (const k of [-1.2, 1.2]) {
      const lx0 = CX + k * LANE * s;
      glow(lx0, y + 2 * s, 14 * s + 2, party ? 'rgba(255,190,120,A)' : 'rgba(255,226,170,A)', 0.35);
      X.fillStyle = party ? '#ffe2b0' : '#fff1cf'; X.beginPath(); X.arc(lx0, y + 2 * s, Math.max(0.5, 1.6 * s), 0, 7); X.fill();
    }
  }
  // far end of the hall
  const sF = sOf(ZFAR + 2), fw = 3.1 * LANE * sF, fy0 = YH + (GH - 3.4 * LANE) * sF, fy1 = YH + GH * sF;
  X.fillStyle = party ? mix('#5a4a66', '#c98b68', party) : '#5a4a66'; X.fillRect(CX - fw, fy0, fw * 2, fy1 - fy0);
  glow(CX, fy1 - 2, 30, party ? 'rgba(255,200,140,A)' : 'rgba(255,220,180,A)', 0.25);
  drawFloor(t);
  drawBooths(-1); drawBooths(1);
  // horizon haze
  const hz = X.createLinearGradient(0, YH - 6, 0, YH + 34);
  const hc = party ? '120,80,80' : '74,64,87';
  hz.addColorStop(0, `rgba(${hc},0.95)`); hz.addColorStop(1, `rgba(${hc},0)`);
  X.fillStyle = hz; X.fillRect(0, YH - 6, LW, 40);
}

function drawFloor() {
  const party = G.party, yb = LH + 2, sB = (yb - YH) / GH;
  // side floor
  const sg = X.createLinearGradient(0, YH, 0, LH);
  sg.addColorStop(0, tint('#4d4556')); sg.addColorStop(1, tint('#6c6272'));
  X.fillStyle = sg; X.fillRect(0, YH, LW, LH - YH);
  // the track: lighter and cleaner than everything around it
  const hw0 = 1.5 * LANE * 0.001, hwB = 1.5 * LANE * sB;
  const tg = X.createLinearGradient(0, YH, 0, LH);
  tg.addColorStop(0, tint('#5a5165')); tg.addColorStop(1, tint('#8a7f8f'));
  poly([[CX - hw0, YH], [CX + hw0, YH], [CX + hwB, yb], [CX - hwB, yb]], tg);
  // gentle moving bands for speed
  const zOff = G.dist % 3;
  for (let i = 0; i < 14; i++) {
    const z1 = i * 3 - zOff, z2 = z1 + 1.5; if (z2 < -2) continue;
    const a = proj(-0.5, Math.max(z1, -1.9)), b = proj(-0.5, z2), c = proj(2.5, z2), d = proj(2.5, Math.max(z1, -1.9));
    poly([[a.X, a.Y], [b.X, b.Y], [c.X, c.Y], [d.X, d.Y]], 'rgba(255,255,255,0.035)');
  }
  // lane dividers (dashed, moving)
  const dOff = G.dist % 4;
  for (const lx0 of [0.5, 1.5]) {
    for (let i = 0; i < 11; i++) {
      const z1 = i * 4 - dOff, z2 = z1 + 2; if (z2 < -2 || z1 > ZFAR + 4) continue;
      const w = 0.035;
      const a = proj(lx0 - w, Math.max(z1, -1.9)), b = proj(lx0 - w, z2), c = proj(lx0 + w, z2), d = proj(lx0 + w, Math.max(z1, -1.9));
      poly([[a.X, a.Y], [b.X, b.Y], [c.X, c.Y], [d.X, d.Y]], 'rgba(255,248,235,0.5)');
    }
  }
  // warm edge lines
  X.strokeStyle = party ? 'rgba(255,214,140,0.95)' : 'rgba(255,190,110,0.85)'; X.lineWidth = 1.2;
  for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(CX, YH); X.lineTo(CX + sd * hwB, yb); X.stroke(); }
}

function wallQuad(side, off, z1, z2, h1, h2, col) {
  z1 = Math.max(z1, -0.6);
  if (z2 <= z1) return;
  const a = proj(1 + side * off, z1, h1), b = proj(1 + side * off, z2, h1), c = proj(1 + side * off, z2, h2), d = proj(1 + side * off, z1, h2);
  poly([[a.X, a.Y], [b.X, b.Y], [c.X, c.Y], [d.X, d.Y]], col);
}
function drawBooths(side) {
  const seg = 7, off = G.dist % seg;
  for (let i = 6; i >= 0; i--) {
    const z1 = i * seg - off, z2 = z1 + 6;
    if (z2 < 0) continue;
    const idx = Math.floor((G.dist + z1 + 0.001) / seg) + (side > 0 ? 2 : 0), b = BOOTH[((idx % 4) + 4) % 4];
    wallQuad(side, 3.0, z1, z2, 0, 2.5, tint(b.wall));
    wallQuad(side, 3.0, z1, z2, 2.1, 2.5, tint(b.fas));
    if (idx % 2) wallQuad(side, 3.0, z1 + 1.6, z2 - 1.6, 1.0, 1.75, G.party ? PARTY[((idx % 5) + 5) % 5] : b.scr);
    wallQuad(side, 2.6, z1 + 0.9, z2 - 0.9, 0, 0.7, tint('#e9e0d6'));
    wallQuad(side, 3.0, z2, z2 + 1, 0, 2.7, tint('#3c3446'));
  }
}

// billboard props (roll-ups, visitors) — returned for depth sorting; kept sparse on purpose
function sceneryItems() {
  const seg = 7, off = G.dist % seg, out = [];
  for (let i = 6; i >= 0; i--) {
    const z1 = i * seg - off;
    for (const side of [-1, 1]) {
      const idx = Math.floor((G.dist + z1 + 0.001) / seg) * 2 + (side > 0 ? 1 : 0), m = ((idx % 20) + 20) % 20;
      if (m % 2 === 0) out.push({ z: z1 + 0.3, draw: () => billboard(ART.rollups[(m / 2) % 4], side * 1.95 + 1, z1 + 0.3, 0.95) });
      if (m % 3 !== 2) {
        const st = m % 5, nz = z1 + 3 + (m % 2);
        out.push({ z: nz, draw: () => { const n = ART.npc[st], p = G.party > 0.3, sp = p ? ((((G.t * 3) | 0) + st) % 2 ? n.cheer : n.fronthat) : n.back; billboard(sp, side * 2.2 + 1, nz, 0.66, p ? Math.abs(Math.sin(G.t * 6 + st)) * 0.08 : 0); } });
      }
    }
  }
  return out;
}
function billboard(s, xl, z, hUnits, lift = 0) {
  if (z < -1.5 || z > ZFAR + 4) return;
  const p = proj(xl, z, lift), h = hUnits * LANE * p.s, w = s.lw * h / s.lh;
  if (h < 1.5) return;
  img(s, p.X - w / 2, p.Y - h, w, h);
}

function drawScreen(t) {
  const b = screenBox, party = G.party;
  X.strokeStyle = 'rgba(20,14,26,0.6)'; X.lineWidth = 0.6;
  X.beginPath(); X.moveTo(b.x + 14, 0); X.lineTo(b.x + 14, b.y); X.moveTo(b.x + b.w - 14, 0); X.lineTo(b.x + b.w - 14, b.y); X.stroke();
  glow(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.75, party ? 'rgba(255,170,110,A)' : 'rgba(90,200,210,A)', party ? 0.35 : 0.14);
  X.beginPath(); rr(X, b.x - 2, b.y - 2, b.w + 4, b.h + 4, 5); X.fillStyle = '#2a2233'; X.fill();
  X.save(); X.beginPath(); rr(X, b.x, b.y, b.w, b.h, 3.5); X.clip();
  if (party < 0.5) {
    const g = X.createLinearGradient(0, b.y, 0, b.y + b.h); g.addColorStop(0, '#1d3a47'); g.addColorStop(1, '#132a34');
    X.fillStyle = g; X.fillRect(b.x, b.y, b.w, b.h);
    // a calm rising "leads" line
    X.strokeStyle = 'rgba(126,224,234,0.85)'; X.lineWidth = 1.3; X.beginPath();
    for (let i = 0; i <= 24; i++) { const u = i / 24, v = 0.25 + 0.55 * u + 0.08 * Math.sin(u * 9 + t * 1.2); const px = b.x + 8 + u * (b.w - 16), py = b.y + b.h - 7 - v * (b.h - 16); i ? X.lineTo(px, py) : X.moveTo(px, py); }
    X.stroke();
    X.fillStyle = '#ffd35a'; X.beginPath(); X.arc(b.x + b.w - 8, b.y + b.h - 7 - (0.8 + 0.08 * Math.sin(9 + t * 1.2)) * (b.h - 16), 2, 0, 7); X.fill();
    X.fillStyle = 'rgba(126,224,234,0.5)'; X.beginPath(); rr(X, b.x + 7, b.y + 6, 26, 2.2, 1); X.fill();
  } else {
    const g = X.createLinearGradient(0, b.y, 0, b.y + b.h); g.addColorStop(0, '#ff9f6b'); g.addColorStop(1, '#e0557a');
    X.fillStyle = g; X.fillRect(b.x, b.y, b.w, b.h);
    for (let i = 0; i < 10; i++) { X.fillStyle = 'rgba(255,255,255,0.25)'; X.beginPath(); X.arc(b.x + ((i * 37 + t * 12) % b.w), b.y + ((i * 23 + t * 7) % b.h), 0.8 + (i % 3) * 0.5, 0, 7); X.fill(); }
  }
  X.restore();
}

function podPos(who) { return who === 'tim' ? { x: 36, y: YH + 10 } : { x: LW - 36, y: YH + 10 }; }
function drawPod(who) {
  const a = G[who], P = podPos(who), c = who === 'tim' ? ART.counterL : ART.counterR;
  let s;
  if (who === 'tim') s = ART.tim[a.pose] || ART.tim.idle;
  else s = a.pose === 'throw' ? ART.and.throw : a.pose === 'wave' ? ART.and.wave : ART.and.idle;
  const hideOff = a.y * 42, sx = P.x + (a.x || 0) - s.lw / 2, sy = P.y - s.lh + 1 + hideOff;
  X.save(); X.beginPath(); X.rect(-50, -50, LW + 100, P.y + 50); X.clip();
  if (a.y < 0.98 || (who === 'tim' && G.state === 'targetHit')) img(s, sx, sy);
  if (a.seq && a.seq.kind === 'throw' && a.seq.t < T_WIND && a.seq.t > 0.12) {
    const it = who === 'tim' ? ART.poop[0] : ART.heart;
    const hx = who === 'tim' ? sx + 27 : sx + 30, hy = who === 'tim' ? sy + 15 : sy + 14;
    img(it, hx - it.lw * 0.3, hy - it.lh * 0.6, it.lw * 0.6, it.lh * 0.6);
  }
  X.restore();
  img(c, P.x - c.lw / 2, P.y - 17);
}

function drawObject(o) {
  const t = performance.now() / 1000;
  const alpha = Math.min(1, (ZFAR + 2 - o.z) / 5) * (o.fade === undefined ? 1 : o.fade);
  if (alpha <= 0) return;
  X.globalAlpha = Math.max(0, alpha);
  const g = proj(o.x, o.z);
  const shw = 9 * g.s;
  if (o.type === 'poop' && o.air) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 12);
    X.strokeStyle = `rgba(255,160,70,${0.5 + 0.45 * pulse})`; X.lineWidth = Math.max(0.6, 1.4 * g.s);
    X.beginPath(); X.ellipse(g.X, g.Y, shw * 1.25, shw * 0.42, 0, 0, 7); X.stroke();
  }
  X.fillStyle = 'rgba(25,15,30,0.3)'; X.beginPath(); X.ellipse(g.X, g.Y, shw * 0.8, shw * 0.26, 0, 0, 7); X.fill();
  let s, size, hover = o.type === 'poop' ? 0.06 : 0.3 + Math.sin(t * 5 + o.x) * 0.06, wScale = 1;
  if (o.type === 'lead') { s = ART.coin; size = 19; wScale = 0.45 + 0.55 * Math.abs(Math.cos(t * 3 + o.x * 1.7)); }
  else if (o.type === 'poop') { s = ART.poop[((t * 3) | 0) % 2]; size = 19; }
  else { s = ART.heart; size = 17 * (1 + Math.sin(t * 7) * 0.06); }
  let px = g.X, py = g.Y - hover * LANE * g.s, sc = g.s;
  if (o.air) {
    const who = o.type === 'poop' ? 'tim' : 'and', P = podPos(who);
    const k = Math.min(1, Math.max(0, (o.age - T_WIND) / T_FLY));
    if (k <= 0) { X.globalAlpha = 1; return; }
    const hx = P.x + (who === 'tim' ? 12 : -14), hy = P.y - 26;
    px = hx + (g.X - hx) * k; py = hy + (py - hy) * k - Math.sin(Math.PI * k) * 26; sc = 0.5 + (g.s - 0.5) * k;
  }
  const h = Math.max(1.5, size * sc), w = h * (s.lw / s.lh);
  if (o.type !== 'poop') glow(px, py - h / 2, h * 0.95, o.type === 'lead' ? 'rgba(255,210,90,A)' : 'rgba(255,110,140,A)', 0.45);
  img(s, px - w * wScale / 2, py - h, w * wScale, h);
  X.globalAlpha = 1;
}

function aigulPose() {
  const A = ART.aigul, st = G.state, t = G.t;
  const runIdx = Math.floor(G.dist * 0.75) % 4;
  let s, bob = 0, sc = 1, x, footY = YP;
  if (st === 'title') { s = Math.floor(t * 2) % 2 ? A.bob : A.front; sc = 2; x = CX; footY = LH * 0.66; }
  else if (RUNNER(st)) {
    x = CX + (G.x - 1) * LANE;
    if (G.runT - G.hitAt < 0.4) s = A.hit;
    else if (G.runT - G.happyAt < 0.5) s = A.happy;
    else { s = A.back[runIdx]; bob = runIdx % 2 ? -0.8 : 0; }
  } else if (st === 'targetHit' || st === 'falseEnding') {
    x = CX + (G.x - 1) * LANE;
    s = G.speed > 2 ? A.back[runIdx] : st === 'targetHit' && t < 1.8 ? A.cheer : A.happy;
    if (st === 'falseEnding' && G.t > 1.9) s = Math.floor(t * 3) % 2 ? A.happyBob : A.happy;
    G.aigul.x = G.x;
  } else if (st === 'birthdayReveal') {
    x = CX + (G.aigul.x - 1) * LANE;
    const m = G.aigul.mode;
    s = m === 'run' ? A.back[runIdx] : m === 'stop' ? A.back[0] : m === 'turn' ? A.front : (Math.floor(t * 4) % 2 ? A.cheer : A.happy);
    if (m === 'stop' && t < 1.1) x += Math.sin(t * 60) * 1.2;
  } else if (st === 'dialogue') {
    sc = G.aigul.scale; const k = sc - 1;
    x = CX + (G.aigul.x - 1) * LANE; footY = YP + (LH * 0.6 - YP) * k;
    s = G.dlg >= DIALOGUE.length ? (Math.floor(t * 4) % 2 ? A.cheer : A.happy) : Math.floor(t * 1.5) % 2 ? A.happyBob : A.happy;
  } else return null;
  return { s, bob, sc, x, footY };
}
function drawAigul() {
  if (G.state === 'meditation') return;
  const p = aigulPose(); if (!p) return;
  const { s, bob, sc, x, footY } = p;
  X.fillStyle = 'rgba(25,15,30,0.32)'; X.beginPath(); X.ellipse(x, footY, 9 * sc, 2.4 * sc, 0, 0, 7); X.fill();
  const w = s.lw * sc, h = s.lh * sc;
  let dx = 0; if (G.shake > 0 && RUNNER(G.state)) dx = (Math.random() - 0.5) * 3;
  if (RUNNER(G.state) && G.runT < G.immuneUntil && Math.floor(G.runT * 10) % 2) X.globalAlpha = 0.55;
  img(s, x - w / 2 + dx, footY - h + (bob + 1.2) * sc, w, h);
  X.globalAlpha = 1;
}
function drawFinaleAndrey() {
  const a = G.and; if (!a.walk) return;
  const moving = Math.abs(a.wx - 128) > 1.5;
  const s = moving ? (Math.floor(G.t * 6) % 2 ? ART.and.walk0 : ART.and.walk1) : (G.typed < G.fullText.length && Math.floor(G.t * 8) % 2 ? ART.and.talk : ART.and.idle);
  const sc = 2, footY = LH * 0.6;
  X.fillStyle = 'rgba(25,15,30,0.3)'; X.beginPath(); X.ellipse(a.wx, footY, 18, 4.5, 0, 0, 7); X.fill();
  img(s, a.wx - s.lw, footY - s.lh * sc + 2.4, s.lw * sc, s.lh * sc);
}

function drawGarlands(t) {
  const k = G.party; if (!k) return;
  const drop = (1 - Math.min(1, k * 1.5)) * -30;
  for (const [y0, sag, n] of [[screenBox.y + screenBox.h + 9, 10, 11], [YH - 5, 7, 9]]) {
    X.strokeStyle = 'rgba(60,40,50,0.8)'; X.lineWidth = 0.5; X.beginPath();
    for (let i = 0; i <= 40; i++) { const u = i / 40, x = u * LW, y = y0 + drop + Math.sin(u * Math.PI) * sag; i ? X.lineTo(x, y) : X.moveTo(x, y); }
    X.stroke();
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, x = u * LW, y = y0 + drop + Math.sin(u * Math.PI) * sag + 1.6;
      const on = 0.6 + 0.4 * Math.sin(t * 3 + i * 1.7);
      const c = hex(PARTY[i % 5]).join(',');
      glow(x, y, 6, `rgba(${c},A)`, 0.45 * on);
      X.fillStyle = PARTY[i % 5]; X.beginPath(); X.arc(x, y, 1.5, 0, 7); X.fill();
    }
  }
}

function drawParty(t) {
  const k = G.party;
  // warm wash + a soft spotlight where Aigul (and later Andrey) stand
  X.fillStyle = `rgba(255,160,90,${0.12 * k})`; X.fillRect(0, 0, LW, LH);
  X.globalCompositeOperation = 'lighter';
  const cx = G.state === 'dialogue' ? CX + 6 : CX + (G.aigul.x - 1) * LANE, cy = G.state === 'dialogue' ? LH * 0.5 : YP - 20;
  glow(cx, cy, 95, 'rgba(255,190,120,A)', 0.28 * k);
  // floating warm bokeh
  for (let i = 0; i < 14; i++) {
    const bx = (i * 47.3 + Math.sin(t * 0.3 + i) * 10) % LW, by = LH - ((t * (6 + i % 4 * 3) + i * 61) % (LH + 30));
    glow(bx, by, 5 + (i % 4) * 2.5, i % 2 ? 'rgba(255,200,130,A)' : 'rgba(255,140,170,A)', 0.22 * k);
  }
  X.globalCompositeOperation = 'source-over';
}

function vignette(strength) {
  const g = X.createRadialGradient(CX, LH * 0.55, LH * 0.3, CX, LH * 0.55, LH * 0.8);
  g.addColorStop(0, 'rgba(15,8,20,0)'); g.addColorStop(1, `rgba(15,8,20,${strength})`);
  X.fillStyle = g; X.fillRect(0, 0, LW, LH);
}

function render() {
  const t = performance.now() / 1000;
  const sx = view.width / LW, sy = view.height / LH;
  let ox = 0, oy = 0;
  if (G.shake > 0 && !RUNNER(G.state)) { ox = (Math.random() - 0.5) * 2.5; oy = (Math.random() - 0.5) * 2.5; }
  X.setTransform(sx, 0, 0, sy, ox * sx, oy * sy);
  X.imageSmoothingEnabled = true; X.imageSmoothingQuality = 'high';
  X.clearRect(-5, -5, LW + 10, LH + 10);
  drawHall(t);
  drawScreen(t);
  drawPod('tim'); drawPod('and');
  const items = sceneryItems();
  if (G.state !== 'title') for (const o of G.objs) items.push({ z: o.air ? -100 : o.z, draw: () => drawObject(o) });
  if (G.state !== 'dialogue' && G.state !== 'title') items.push({ z: 0, draw: drawAigul });
  items.sort((a, b) => b.z - a.z);
  for (const it of items) it.draw();
  if (G.party) drawParty(t);
  vignette(G.state === 'dialogue' ? 0.55 : 0.35);
  drawGarlands(t);
  if (G.state === 'dialogue' || G.state === 'postCredits') drawFinaleAndrey();
  if (G.state === 'dialogue') drawAigul();
  if (G.state === 'title') drawTitleCast(t);
  for (const p of G.fx) {
    X.globalAlpha = Math.min(1, p.life / p.max * 2); X.fillStyle = p.c;
    if (p.conf !== undefined) {
      X.save(); X.translate(p.x, p.y); X.rotate(p.life * 6 + p.conf); X.fillRect(-1.2, -0.7, 2.4 * Math.abs(Math.cos(p.life * 7 + p.conf)) + 0.4, 1.4); X.restore();
    } else { X.beginPath(); X.arc(p.x, p.y, p.sz * 0.75, 0, 7); X.fill(); }
  }
  X.globalAlpha = 1;
  if (G.state === 'meditation') drawMeditationOverlay();
  drawBubbles();
  drawFloats();
  if (G.party > 0.4) drawScreenText(t);
}

function drawMeditationOverlay() {
  const m = G.med, t = G.t, k = Math.max(0, Math.min(1, t / 0.5) * Math.min(1, (m.dur - t) / 0.4 + 0.001));
  const g = X.createLinearGradient(0, 0, 0, LH);
  g.addColorStop(0, `rgba(40,30,80,${0.55 * k})`); g.addColorStop(1, `rgba(90,70,140,${0.5 * k})`);
  X.fillStyle = g; X.fillRect(0, 0, LW, LH);
  const x = CX + (G.x - 1) * LANE, y = YP - 20;
  const r = 22 + Math.sin(t * 2.2) * 6;
  X.globalCompositeOperation = 'lighter';
  glow(x, y, r + 16, 'rgba(190,160,255,A)', 0.45 * k);
  glow(x, y, r, 'rgba(240,225,255,A)', 0.35 * k);
  X.globalCompositeOperation = 'source-over';
  const s = ART.aigul.med[Math.floor(t * 1.2) % 2];
  img(s, x - s.lw / 2, YP - s.lh - 1 - Math.sin(t * 2) * 1.2);
  for (let i = 0; i < 6; i++) {
    const a = t * 0.6 + i * 1.05, rr0 = 30 + (i % 3) * 6;
    X.fillStyle = `rgba(255,245,225,${0.7 * k})`; X.beginPath(); X.arc(x + Math.cos(a) * rr0, y - 4 + Math.sin(a) * rr0 * 0.6, 0.8, 0, 7); X.fill();
  }
}

function drawTitleCast(t) {
  const y = LH * 0.66;
  const tb = Math.sin(t * 2) * 1.5, ab = Math.sin(t * 2 + 1) * 1.5;
  const tim = ART.tim.windup, and = ART.and.wave, sc = 1.5;
  img(tim, -5, y - tim.lh * sc + tb, tim.lw * sc, tim.lh * sc);
  img(ART.poop[0], 23, y - tim.lh * sc - 7 + tb, 16, 15);
  img(and, LW - and.lw * sc + 7, y - and.lh * sc + ab, and.lw * sc, and.lh * sc);
  img(ART.heart, LW - 38, y - and.lh * sc - 9 + ab, 16, 14);
  drawAigul();
}

function bubble(text, x, y, anchor, maxW = 92) {
  const fs = 7.2, lh = fs * 1.25, pad = 4;
  X.font = `800 ${fs}px ${FONT}`;
  const lines = wrap(text, maxW - pad * 2);
  const w = Math.min(maxW, Math.max(...lines.map(l => measureRich(l))) + pad * 2), h = lines.length * lh + pad * 1.6;
  let bx = anchor === 'right' ? x : x - w; bx = Math.max(3, Math.min(LW - w - 3, bx));
  const by = y - h;
  X.save();
  X.shadowColor = 'rgba(20,10,30,0.35)'; X.shadowBlur = 4 * view.width / LW; X.shadowOffsetY = 1 * view.width / LW;
  X.fillStyle = '#fffaf2'; X.beginPath(); rr(X, bx, by, w, h, 4.5); X.fill();
  X.restore();
  const tx = Math.max(bx + 5, Math.min(bx + w - 5, x));
  X.fillStyle = '#fffaf2'; X.beginPath(); X.moveTo(tx - 2.6, by + h - 0.5); X.lineTo(tx + (anchor === 'right' ? -2.5 : 2.5), by + h + 3.6); X.lineTo(tx + 2.6, by + h - 0.5); X.fill();
  X.fillStyle = '#3b2835'; X.textBaseline = 'middle';
  lines.forEach((l, i) => drawRichText(l, bx + pad, by + pad * 0.8 + lh * (i + 0.5), fs));
}
function measureRich(s) { const hs = (s.match(/❤️?/g) || []).length; return X.measureText(s.replace(/❤️?/g, '')).width + hs * 8; }
function drawRichText(s, x, y, fs) {
  for (const p of s.split(/(❤️?)/)) {
    if (!p) continue;
    if (p[0] === '❤') { img(ART.icons.heart, x + 0.8, y - fs * 0.4, fs * 0.9, fs * 0.8); x += fs * 1.1; }
    else { X.fillText(p, x, y); x += X.measureText(p).width; }
  }
}
function wrap(text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const test = cur ? cur + ' ' + w : w; if (measureRich(test) > maxW && cur) { lines.push(cur); cur = w; } else cur = test; }
  if (cur) lines.push(cur);
  return lines;
}
function drawBubbles() {
  if (G.state === 'targetHit' && G.tim.q) {
    const p = podPos('tim');
    X.font = `900 14px ${FONT}`; X.textAlign = 'center'; X.textBaseline = 'alphabetic';
    X.lineWidth = 2.5; X.strokeStyle = '#3b2835'; X.fillStyle = '#fff3de';
    const y = p.y - 42 - Math.abs(Math.sin(G.t * 8)) * 2;
    X.strokeText('?', p.x + (G.tim.x || 0), y); X.fillText('?', p.x + (G.tim.x || 0), y); X.textAlign = 'left';
  }
  if (!RUNNER(G.state)) return;
  const tp = podPos('tim'), ap = podPos('and');
  if (G.tim.bubble && G.tim.y < 0.5) bubble(G.tim.bubble, tp.x + 8, tp.y - 38 + G.tim.y * 30, 'right', 96);
  if (G.and.bubble && G.and.y < 0.5) bubble(G.and.bubble, ap.x - 8, ap.y - 38 + G.and.y * 30, 'left', 96);
}
function drawFloats() {
  for (const f of G.floats) {
    const k = f.t / 0.9;
    X.globalAlpha = 1 - k * k;
    const y = f.y - k * 16;
    if (f.text === '❤') img(ART.icons.heart, f.x - 5, y - 4.5, 10, 9);
    else {
      X.font = `900 9px ${FONT}`; X.textAlign = 'center'; X.textBaseline = 'middle';
      X.lineWidth = 2.2; X.strokeStyle = 'rgba(40,24,40,0.85)'; X.strokeText(f.text, f.x, y);
      X.fillStyle = f.color; X.fillText(f.text, f.x, y);
      X.textAlign = 'left';
    }
    X.globalAlpha = 1;
  }
}
function drawScreenText(t) {
  const b = screenBox, k = Math.min(1, (G.party - 0.4) / 0.3);
  X.globalAlpha = k;
  X.textAlign = 'center'; X.textBaseline = 'middle';
  let fs = Math.min(12, b.h / 3.2);
  X.font = `900 ${fs}px ${FONT}`;
  while (X.measureText('С ДНЁМ РОЖДЕНИЯ!').width + fs > b.w - 10 && fs > 6) { fs -= 0.5; X.font = `900 ${fs}px ${FONT}`; }
  const pulse = 1 + Math.sin(t * 3) * 0.025;
  X.save(); X.translate(b.x + b.w / 2, b.y + b.h / 2); X.scale(pulse, pulse);
  X.shadowColor = 'rgba(120,30,50,0.6)'; X.shadowBlur = 3 * view.width / LW;
  X.fillStyle = '#fff4c7'; X.fillText('АЙГУЛЬ,', 0, -fs * 0.62);
  const l2 = 'С ДНЁМ РОЖДЕНИЯ!', w2 = X.measureText(l2).width;
  X.fillStyle = '#ffffff'; X.fillText(l2, -fs * 0.45, fs * 0.62);
  X.shadowBlur = 0;
  img(ART.icons.heart, w2 / 2 - fs * 0.2, fs * 0.62 - fs * 0.42, fs * 0.9, fs * 0.8);
  X.restore();
  X.textAlign = 'left'; X.globalAlpha = 1;
}

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  const raw = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  if (!paused) update(raw * timeScale);
  Sound.tick();
  render();
  requestAnimationFrame(frame);
}

function setMuteIcon() {
  $('mute').querySelector('.ic').style.backgroundImage = `url(${Sound.muted ? ICON_URL.mute : ICON_URL.sound})`;
}
let ICON_URL = {};

async function boot() {
  try { await Promise.race([Promise.all([document.fonts.load('800 16px Nunito', 'ЛИДЫ'), document.fonts.load('900 16px Nunito', 'ЛИДЫ')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* fall back to system font */ }
  ART = buildArt();
  for (const k in ART.icons) ICON_URL[k] = iconURL(ART.icons[k]);
  const css = Object.keys(ICON_URL).map(k => `.ic-${k}{background-image:url(${ICON_URL[k]})}`).join('\n');
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  setMuteIcon();
  G = newGame();
  layout();
  toTitle();
  show('loading', false);
  if (QA_MODE) window.QA = { get G() { return G; }, set timeScale(v) { timeScale = v; }, step: dt => update(dt), move, advance, startRun, pauseGame, resume, get paused() { return paused; }, TARGET };
  requestAnimationFrame(t => { last = t; frame(t); });
}
boot();
