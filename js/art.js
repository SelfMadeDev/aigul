// Soft vector cartoon art. Every sprite is drawn once with canvas paths at high resolution
// (R px per logical unit) and then reused. `c.lw/c.lh` hold the logical size.
'use strict';

const R = 8;
const INK = '#3b2835';
const PAL = {
  skin: '#f7cdb0', skinS: '#e9aa8c', blush: 'rgba(238,110,120,0.35)', lip: '#c9566a', white: '#fffaf3',
  hairA: '#2d1d22', hairAH: '#5e4046', gold: '#dca54a', topA: '#2f2a3a',
  pants: '#40486b', shoe: '#fbf6ee',
  hairT: '#3a2a22', beard: '#4a3226', shirt: '#fdfaf4', shirtS: '#e3ddd3', trou: '#454a5c', shoeT: '#6a4331',
  hairN: '#744b33', hairNS: '#b9a08e', hood: '#f9c73f', hoodS: '#e3a623', hoodL: '#ffe07a', jeans: '#4a5b8a',
  coinG: '#2f9a60', poo: '#96603b', pooL: '#c08556',
};

function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }

function sprite(w, h, draw, res = R) {
  const c = mkCanvas(w * res, h * res), x = c.getContext('2d');
  x.scale(res, res); x.lineJoin = 'round'; x.lineCap = 'round';
  draw(x);
  c.lw = w; c.lh = h;
  return c;
}
function flipH(src) {
  const c = mkCanvas(src.width, src.height), x = c.getContext('2d');
  x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
  c.lw = src.lw; c.lh = src.lh; return c;
}

// ---------------------------------------------------------------- drawing helpers
const OL = 0.85; // outline width
function ell(x, cx, cy, rx, ry, rot = 0) { x.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot)); x.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); }
function rr(x, x0, y0, w, h, r) { x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + h, r); x.arcTo(x0 + w, y0 + h, x0, y0 + h, r); x.arcTo(x0, y0 + h, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath(); }
function shape(x, path, fill, stroke = INK, lw = OL) {
  x.beginPath(); path(x);
  if (fill) { x.fillStyle = fill; x.fill(); }
  if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); }
}
// Several blobs rendered as one silhouette with a single outer outline.
function blobs(x, list, fill, hl) {
  x.beginPath(); list.forEach(([a, b, r]) => ell(x, a, b, r, r));
  x.strokeStyle = INK; x.lineWidth = OL * 2; x.stroke();
  x.fillStyle = fill; x.fill();
  if (hl) { x.strokeStyle = hl; x.lineWidth = 0.6; list.forEach(([a, b, r]) => { if (r < 2.4) return; x.beginPath(); x.arc(a - r * 0.1, b - r * 0.05, r * 0.5, Math.PI * 1.05, Math.PI * 1.75); x.stroke(); }); }
}
function limb(x, pts, w, col) {
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
  x.strokeStyle = INK; x.lineWidth = w + OL * 2; x.stroke();
  x.strokeStyle = col; x.lineWidth = w; x.stroke();
}
function hand(x, a, b, r = 1.45, col = PAL.skin) { shape(x, c => ell(c, a, b, r, r), col); }
function shoe(x, a, b, col = PAL.shoe) { shape(x, c => ell(c, a, b, 2.3, 1.3), col); }
function eyes(x, lx, rx, y, mood, look = 0) {
  x.lineWidth = 0.75; x.strokeStyle = INK;
  for (const ex of [lx, rx]) {
    if (mood === 'happy') { x.beginPath(); x.arc(ex, y + 0.8, 1.3, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
    else if (mood === 'calm') { x.beginPath(); x.arc(ex, y - 0.2, 1.2, Math.PI * 0.15, Math.PI * 0.85); x.stroke(); }
    else if (mood === 'hit') { shape(x, c => ell(c, ex, y, 1.3, 1.5), PAL.white, INK, 0.5); shape(x, c => ell(c, ex, y, 0.55, 0.55), INK, null); }
    else { shape(x, c => ell(c, ex + look, y, 0.95, 1.25), INK, null); shape(x, c => ell(c, ex + look + 0.35, y - 0.45, 0.35, 0.35), '#fff', null); }
  }
}
function blush(x, a, b) { shape(x, c => ell(c, a, b, 1.6, 0.9), PAL.blush, null); }

// ---------------------------------------------------------------- Aigul (32 x 48)
const AIGUL_HAIR = [[16, 15.5, 10.4], [7.2, 12.5, 4.3], [24.8, 12.5, 4.3], [10, 6.5, 4.4], [16, 5.2, 4.6], [22, 6.5, 4.4], [6.4, 19.5, 4.2], [25.6, 19.5, 4.2], [7, 25.5, 3.8], [25, 25.5, 3.8], [9.2, 29.8, 2.9], [22.8, 29.8, 2.9]];
function aigulBody(x, arms, y = 0) {
  limb(x, [[13, 39], [12.6, 45]], 3.6, PAL.pants); limb(x, [[19, 39], [19.4, 45]], 3.6, PAL.pants);
  shoe(x, 12.2, 46); shoe(x, 19.8, 46);
  const A = {
    down: [[[10, 31 + y], [8.6, 38 + y]], [[22, 31 + y], [23.4, 38 + y]]],
    up: [[[10, 31 + y], [6, 25 + y], [6.5, 19 + y]], [[22, 31 + y], [26, 25 + y], [25.5, 19 + y]]],
    wave: [[[10, 31 + y], [8.6, 38 + y]], [[22, 31 + y], [26.5, 26 + y], [26.5, 20 + y]]],
  }[arms];
  A.forEach(p => limb(x, p, 3, PAL.topA));
  shape(x, c => { c.moveTo(9, 30 + y); c.quadraticCurveTo(16, 27.5 + y, 23, 30 + y); c.quadraticCurveTo(24.5, 36, 23, 41); c.lineTo(9, 41); c.quadraticCurveTo(7.5, 36, 9, 30 + y); c.closePath(); }, PAL.topA);
  shape(x, c => { c.moveTo(13.8, 28.6 + y); c.lineTo(16, 32 + y); c.lineTo(18.2, 28.6 + y); c.closePath(); }, PAL.skinS, null);
  A.forEach(p => hand(x, p[p.length - 1][0], p[p.length - 1][1]));
}
function aigulHead(x, mood, y = 0) {
  shape(x, c => ell(c, 16, 17.8 + y, 7.7, 8.6), PAL.skin);
  blobs(x, [[11, 10.5 + y, 3.4], [16, 9.3 + y, 3.6], [21, 10.5 + y, 3.4], [8.2, 14.5 + y, 2.6], [23.8, 14.5 + y, 2.6], [8, 20 + y, 2.2], [24, 20 + y, 2.2]], PAL.hairA, PAL.hairAH);
  x.strokeStyle = PAL.hairA; x.lineWidth = 0.8;
  x.beginPath(); x.moveTo(10.6, 15.1 + y); x.quadraticCurveTo(12.5, 14.2 + y, 14.3, 15 + y); x.stroke();
  x.beginPath(); x.moveTo(17.7, 15 + y); x.quadraticCurveTo(19.5, 14.2 + y, 21.4, 15.1 + y); x.stroke();
  eyes(x, 12.5, 19.5, 18.4 + y, mood);
  x.lineWidth = 0.8; x.strokeStyle = PAL.gold;
  for (const gx of [12.5, 19.5]) { x.beginPath(); rr(x, gx - 3.1, 15.9 + y, 6.2, 5.1, 1.6); x.fillStyle = 'rgba(255,255,255,0.14)'; x.fill(); x.stroke(); }
  x.beginPath(); x.moveTo(15.6, 17.6 + y); x.quadraticCurveTo(16, 17.1 + y, 16.4, 17.6 + y); x.stroke();
  blush(x, 10.8, 22.3 + y); blush(x, 21.2, 22.3 + y);
  x.strokeStyle = PAL.skinS; x.lineWidth = 0.6; x.beginPath(); x.arc(16, 20.6 + y, 0.7, 0.2, Math.PI - 0.2); x.stroke();
  if (mood === 'happy') shape(x, c => { c.moveTo(13.9, 23.1 + y); c.quadraticCurveTo(16, 26.6 + y, 18.1, 23.1 + y); c.closePath(); }, '#b8475c', INK, 0.6);
  else if (mood === 'hit') shape(x, c => ell(c, 16, 23.8 + y, 1, 1.2), '#b8475c', INK, 0.6);
  else { x.strokeStyle = PAL.lip; x.lineWidth = 0.9; x.beginPath(); x.arc(16, 22.2 + y, 1.9, 0.25 * Math.PI, 0.75 * Math.PI); x.stroke(); }
}
function aigulFront(mood = 'neutral', arms = 'down', bob = 0) {
  return sprite(32, 50, x => {
    x.translate(0, 2);
    blobs(x, AIGUL_HAIR.map(([a, b, r]) => [a, b + bob, r]), PAL.hairA, PAL.hairAH);
    aigulBody(x, arms, bob);
    aigulHead(x, mood, bob);
  });
}
function aigulBack(f) {
  const up = f % 2 ? -0.8 : 0, lift = [2.6, 0, 0, 0][f], lift2 = [0, 0, 2.6, 0][f], sw = [1.6, 0, -1.6, 0][f];
  return sprite(32, 50, x => {
    x.translate(0, 2);
    limb(x, [[13, 38], [12.6, 45 - lift]], 3.6, PAL.pants); limb(x, [[19, 38], [19.4, 45 - lift2]], 3.6, PAL.pants);
    shoe(x, 12.3, 46 - lift, lift ? '#ddd3c6' : PAL.shoe); shoe(x, 19.7, 46 - lift2, lift2 ? '#ddd3c6' : PAL.shoe);
    limb(x, [[10, 30 + up], [7.6, 36 + up + sw]], 3, PAL.topA); limb(x, [[22, 30 + up], [24.4, 36 + up - sw]], 3, PAL.topA);
    hand(x, 7.6, 36.8 + up + sw, 1.35, PAL.skinS); hand(x, 24.4, 36.8 + up - sw, 1.35, PAL.skinS);
    shape(x, c => { c.moveTo(9, 29 + up); c.quadraticCurveTo(16, 26.5 + up, 23, 29 + up); c.quadraticCurveTo(24.5, 35, 23, 40); c.lineTo(9, 40); c.quadraticCurveTo(7.5, 35, 9, 29 + up); c.closePath(); }, PAL.topA);
    const H = [[16, 14.5, 10.6], [7, 12, 4.5], [25, 12, 4.5], [10, 5.8, 4.5], [16, 4.6, 4.7], [22, 5.8, 4.5], [6, 19.5, 4.8], [26, 19.5, 4.8], [8, 26, 4.4], [24, 26, 4.4], [12, 28, 4], [20, 28, 4], [16, 27, 4.2]];
    blobs(x, H.map(([a, b, r]) => [a + (b > 20 ? sw * 0.25 : 0), b + up, r]), PAL.hairA, PAL.hairAH);
    x.strokeStyle = PAL.gold; x.lineWidth = 0.7;
    x.beginPath(); x.moveTo(3.6, 17 + up); x.lineTo(5, 17.4 + up); x.stroke();
    x.beginPath(); x.moveTo(28.4, 17 + up); x.lineTo(27, 17.4 + up); x.stroke();
  });
}
function aigulMeditate(f) {
  const y = f ? -0.7 : 0;
  return sprite(36, 48, x => {
    x.translate(0, 4);
    x.save(); x.translate(2, -4 + y); blobs(x, AIGUL_HAIR, PAL.hairA, PAL.hairAH); x.restore();
    shape(x, c => ell(c, 18, 40, 13, 3.6), PAL.pants);
    shoe(x, 7, 41); shoe(x, 29, 41);
    x.translate(0, -4 + y);
    limb(x, [[12, 31], [7, 39], [5.5, 42]], 3, PAL.topA); limb(x, [[24, 31], [29, 39], [30.5, 42]], 3, PAL.topA);
    shape(x, c => { c.moveTo(11, 30); c.quadraticCurveTo(18, 27.5, 25, 30); c.quadraticCurveTo(26.5, 36, 25, 43); c.lineTo(11, 43); c.quadraticCurveTo(9.5, 36, 11, 30); c.closePath(); }, PAL.topA);
    shape(x, c => { c.moveTo(15.8, 28.6); c.lineTo(18, 32); c.lineTo(20.2, 28.6); c.closePath(); }, PAL.skinS, null);
    hand(x, 5.8, 42.2); hand(x, 30.2, 42.2);
    x.translate(2, 0);
    aigulHead(x, 'calm');
  });
}

// ---------------------------------------------------------------- Timofey (34 x 50)
function timofey(pose = 'idle', look = 0) {
  return sprite(34, 50, x => {
    x.translate(1, 0);
    const wf = pose === 'walk1' ? 1 : pose === 'walk0' ? -1 : 0;
    limb(x, [[13, 40], [12.5 + wf * 0.6, 47 - (wf > 0 ? 1.2 : 0)]], 3.8, PAL.trou); limb(x, [[19, 40], [19.5 - wf * 0.6, 47 - (wf < 0 ? 1.2 : 0)]], 3.8, PAL.trou);
    shoe(x, 12.2 + wf * 0.6, 48 - (wf > 0 ? 1.2 : 0), PAL.shoeT); shoe(x, 19.8 - wf * 0.6, 48 - (wf < 0 ? 1.2 : 0), PAL.shoeT);
    const S = [[8.5, 28.5], [23.5, 28.5]], pocket = pose === 'pocket' || pose === 'empty' || pose === 'look';
    let arms;
    switch (pose) {
      case 'windup': arms = [[S[0], [7, 38]], [S[1], [27, 24], [26, 17]]]; break;
      case 'throw': arms = [[S[0], [7, 38]], [S[1], [28, 29], [32, 28]]]; break;
      case 'pocket': case 'empty': case 'look': arms = [[S[0], [8, 34], [11, 39]], [S[1], [24, 34], [21, 39]]]; break;
      case 'shrug': arms = [[S[0], [4.5, 32], [2.5, 25]], [S[1], [27.5, 32], [29.5, 25]]]; break;
      default: arms = [[S[0], [7.2 - wf * 0.8, 38]], [S[1], [24.8 + wf * 0.8, 38]]];
    }
    arms.forEach(p => limb(x, p, 3.3, PAL.shirt));
    shape(x, c => { c.moveTo(8, 28); c.quadraticCurveTo(16, 25.5, 24, 28); c.quadraticCurveTo(25.6, 34.5, 24.2, 41); c.lineTo(7.8, 41); c.quadraticCurveTo(6.4, 34.5, 8, 28); c.closePath(); }, PAL.shirt);
    shape(x, c => { c.moveTo(21.5, 28); c.quadraticCurveTo(24.6, 33, 23.6, 40.5); c.lineTo(21.8, 40.5); c.quadraticCurveTo(22.4, 33, 21.5, 28); }, PAL.shirtS, null);
    x.strokeStyle = PAL.shirtS; x.lineWidth = 0.5; x.beginPath(); x.moveTo(16, 29); x.lineTo(16, 40.5); x.stroke();
    [31.5, 34.5, 37.5].forEach(b => shape(x, c => ell(c, 16.9, b, 0.35, 0.35), '#c8c1b6', null));
    shape(x, c => rr(c, 7.8, 40.2, 16.4, 1.6, 0.6), '#3e3029');
    shape(x, c => { c.moveTo(12.5, 26.5); c.lineTo(16, 29.5); c.lineTo(13.2, 30.4); c.closePath(); }, PAL.shirt, INK, 0.6);
    shape(x, c => { c.moveTo(19.5, 26.5); c.lineTo(16, 29.5); c.lineTo(18.8, 30.4); c.closePath(); }, PAL.shirt, INK, 0.6);
    if (pose === 'empty' || pose === 'look') {
      shape(x, c => { c.moveTo(9, 40.8); c.quadraticCurveTo(8, 44.5, 10.5, 44.2); c.quadraticCurveTo(12, 43.5, 11.5, 40.8); c.closePath(); }, PAL.white, INK, 0.6);
      shape(x, c => { c.moveTo(23, 40.8); c.quadraticCurveTo(24, 44.5, 21.5, 44.2); c.quadraticCurveTo(20, 43.5, 20.5, 40.8); c.closePath(); }, PAL.white, INK, 0.6);
    }
    if (!pocket) arms.forEach(p => { const e = p[p.length - 1]; hand(x, e[0], e[1], 1.5); });
    shape(x, c => rr(c, 13.6, 22, 4.8, 5, 1.5), PAL.skinS, null);
    shape(x, c => ell(c, 8.6, 16.3, 1.4, 2), PAL.skin); shape(x, c => ell(c, 23.4, 16.3, 1.4, 2), PAL.skin);
    shape(x, c => ell(c, 16, 11.5, 7.8, 6.4), PAL.hairT);
    shape(x, c => ell(c, 16, 16.3, 7.1, 8), PAL.skin);
    shape(x, c => { c.moveTo(9, 12.2); c.quadraticCurveTo(12, 8.4, 16, 9.8); c.quadraticCurveTo(20, 8.4, 23, 12.2); c.quadraticCurveTo(22, 7, 16, 6.6); c.quadraticCurveTo(10, 7, 9, 12.2); c.closePath(); }, PAL.hairT, null);
    shape(x, c => {
      c.moveTo(8.9, 14.6); c.quadraticCurveTo(9.4, 19, 12.2, 19.6); c.quadraticCurveTo(16, 18.4, 19.8, 19.6); c.quadraticCurveTo(22.6, 19, 23.1, 14.6);
      c.quadraticCurveTo(24.4, 22.8, 16, 26.2); c.quadraticCurveTo(7.6, 22.8, 8.9, 14.6); c.closePath();
    }, PAL.beard);
    shape(x, c => { c.moveTo(12.6, 20.3); c.quadraticCurveTo(16, 18.6, 19.4, 20.3); c.quadraticCurveTo(16, 19.9, 12.6, 20.3); }, PAL.beard, INK, 0.5);
    if (pose === 'shrug') shape(x, c => { c.moveTo(14.3, 21.6); c.quadraticCurveTo(16.5, 22.8, 18, 21.2); }, null, PAL.lip, 0.8);
    else shape(x, c => ell(c, 16, 21.5, 1.6, 0.55), PAL.lip, null);
    x.strokeStyle = PAL.hairT; x.lineWidth = 1;
    const lift = pose === 'empty' || pose === 'shrug' ? -0.8 : 0;
    x.beginPath(); x.moveTo(10.6, 13.3 + lift); x.lineTo(14.2, 13.1); x.stroke();
    x.beginPath(); x.moveTo(17.8, 13.1); x.lineTo(21.4, 13.3 + lift); x.stroke();
    eyes(x, 12.6, 19.4, 15.6, 'neutral', look ? 0.6 : 0);
    x.strokeStyle = PAL.skinS; x.lineWidth = 0.6; x.beginPath(); x.arc(16, 17.9, 0.7, 0.2, Math.PI - 0.2); x.stroke();
  });
}

// ---------------------------------------------------------------- Andrey (36 x 50)
function andrey(pose = 'idle') {
  return sprite(36, 50, x => {
    x.translate(2, 0);
    const wf = pose === 'walk1' ? 1 : pose === 'walk0' ? -1 : 0;
    limb(x, [[13, 40], [12.5 + wf * 0.6, 47 - (wf > 0 ? 1.2 : 0)]], 3.8, PAL.jeans); limb(x, [[19, 40], [19.5 - wf * 0.6, 47 - (wf < 0 ? 1.2 : 0)]], 3.8, PAL.jeans);
    shoe(x, 12.2 + wf * 0.6, 48 - (wf > 0 ? 1.2 : 0)); shoe(x, 19.8 - wf * 0.6, 48 - (wf < 0 ? 1.2 : 0));
    const S = [[8, 29], [24, 29]];
    let arms;
    if (pose === 'wave') arms = [[S[0], [6.5, 38]], [S[1], [28.5, 23], [28, 16]]];
    else if (pose === 'throw') arms = [[S[0], [3, 29], [-1, 28]], [S[1], [25.5, 38]]];
    else arms = [[S[0], [6.5 - wf * 0.8, 38]], [S[1], [25.5 + wf * 0.8, 38]]];
    arms.forEach(p => limb(x, p, 3.8, PAL.hood));
    shape(x, c => { c.moveTo(7.5, 28.5); c.quadraticCurveTo(16, 25, 24.5, 28.5); c.quadraticCurveTo(26.4, 35, 25, 41.5); c.quadraticCurveTo(16, 42.5, 7, 41.5); c.quadraticCurveTo(5.6, 35, 7.5, 28.5); c.closePath(); }, PAL.hood);
    shape(x, c => { c.moveTo(22, 28); c.quadraticCurveTo(25.8, 34, 24.4, 41); c.lineTo(22.6, 41.2); c.quadraticCurveTo(23.6, 34, 22, 28); }, PAL.hoodS, null);
    shape(x, c => rr(c, 10.5, 34.5, 11, 5.2, 2.2), PAL.hoodS, INK, 0.55);
    shape(x, c => { c.moveTo(9.5, 26.5); c.quadraticCurveTo(16, 33, 22.5, 26.5); c.quadraticCurveTo(16, 24, 9.5, 26.5); c.closePath(); }, PAL.hoodL, INK, 0.7);
    x.strokeStyle = '#fff5d8'; x.lineWidth = 0.6;
    x.beginPath(); x.moveTo(14.2, 29.5); x.lineTo(13.9, 33.3); x.stroke(); x.beginPath(); x.moveTo(17.8, 29.5); x.lineTo(18.1, 33.3); x.stroke();
    arms.forEach(p => { const e = p[p.length - 1]; hand(x, e[0], e[1], 1.6); });
    shape(x, c => ell(c, 8.7, 16.2, 1.4, 2), PAL.skin); shape(x, c => ell(c, 23.3, 16.2, 1.4, 2), PAL.skin);
    shape(x, c => ell(c, 16, 16, 7.2, 8.1), PAL.skin);
    shape(x, c => { c.moveTo(8.9, 13.5); c.quadraticCurveTo(8.7, 9.5, 10.5, 8.5); c.lineTo(10.4, 12); c.closePath(); }, PAL.hairNS, null);
    shape(x, c => { c.moveTo(23.1, 13.5); c.quadraticCurveTo(23.3, 9.5, 21.5, 8.5); c.lineTo(21.6, 12); c.closePath(); }, PAL.hairNS, null);
    shape(x, c => { c.moveTo(9.6, 11); c.quadraticCurveTo(9.5, 5.2, 15, 4.8); c.quadraticCurveTo(21, 3.2, 23.6, 7.4); c.quadraticCurveTo(24, 10.5, 22.3, 11.2); c.quadraticCurveTo(18.5, 8.3, 13.5, 10.2); c.quadraticCurveTo(11, 11.2, 9.6, 11); c.closePath(); }, PAL.hairN);
    x.strokeStyle = '#9a6a48'; x.lineWidth = 0.55; x.beginPath(); x.moveTo(12.5, 7.3); x.quadraticCurveTo(17, 5.3, 21.5, 6.6); x.stroke();
    x.strokeStyle = PAL.hairN; x.lineWidth = 0.85;
    x.beginPath(); x.moveTo(10.7, 12.6); x.quadraticCurveTo(12.5, 11.7, 14.2, 12.4); x.stroke();
    x.beginPath(); x.moveTo(17.8, 12.4); x.quadraticCurveTo(19.5, 11.7, 21.3, 12.6); x.stroke();
    eyes(x, 12.6, 19.4, 15, 'happy');
    blush(x, 10.8, 18.6); blush(x, 21.2, 18.6);
    x.strokeStyle = PAL.skinS; x.lineWidth = 0.6; x.beginPath(); x.arc(16, 17.2, 0.7, 0.2, Math.PI - 0.2); x.stroke();
    if (pose === 'talk') shape(x, c => { c.moveTo(13.4, 19.6); c.quadraticCurveTo(16, 23.4, 18.6, 19.6); c.closePath(); }, '#b8475c', INK, 0.6);
    else {
      shape(x, c => { c.moveTo(12.4, 19.2); c.quadraticCurveTo(16, 24.6, 19.6, 19.2); c.closePath(); }, PAL.white, INK, 0.65);
      shape(x, c => { c.moveTo(13.4, 21.2); c.quadraticCurveTo(16, 23.8, 18.6, 21.2); c.quadraticCurveTo(16, 22.3, 13.4, 21.2); }, '#d9677c', null);
    }
  });
}

// ---------------------------------------------------------------- crowd NPCs (16 x 32)
const NPC_STYLES = [
  { shirt: '#7d95b8', hair: '#5a3a26' }, { shirt: '#c48b78', hair: '#2a2222' }, { shirt: '#86ab93', hair: '#b58d5a' },
  { shirt: '#9d8cbc', hair: '#3b2a24' }, { shirt: '#cdb67c', hair: '#6d4630' },
];
function npc(style, front, cheer = false, hat = false) {
  const s = NPC_STYLES[style];
  return sprite(16, 32, x => {
    x.translate(0, 2);
    limb(x, [[6, 22], [6, 28]], 2.6, '#4a4658'); limb(x, [[10, 22], [10, 28]], 2.6, '#4a4658');
    if (cheer) { limb(x, [[4.5, 15], [2.5, 10], [2.5, 6.5]], 2.2, s.shirt); limb(x, [[11.5, 15], [13.5, 10], [13.5, 6.5]], 2.2, s.shirt); hand(x, 2.5, 6, 1.1); hand(x, 13.5, 6, 1.1); }
    else { limb(x, [[4.5, 15], [3.8, 21]], 2.2, s.shirt); limb(x, [[11.5, 15], [12.2, 21]], 2.2, s.shirt); }
    shape(x, c => rr(c, 3.8, 13, 8.4, 10, 3), s.shirt);
    shape(x, c => ell(c, 8, 8, 4.3, 4.6), PAL.skin);
    if (front) {
      shape(x, c => { c.moveTo(3.8, 8); c.quadraticCurveTo(4, 2.6, 8, 3.2); c.quadraticCurveTo(12, 2.6, 12.2, 8); c.quadraticCurveTo(9, 5, 3.8, 8); c.closePath(); }, s.hair);
      if (cheer) { eyes(x, 6.4, 9.6, 8.4, 'happy'); shape(x, c => { c.moveTo(6.6, 10.2); c.quadraticCurveTo(8, 12.4, 9.4, 10.2); c.closePath(); }, '#b8475c', INK, 0.4); }
      else { shape(x, c => ell(c, 6.4, 8.4, 0.55, 0.75), INK, null); shape(x, c => ell(c, 9.6, 8.4, 0.55, 0.75), INK, null); }
      shape(x, c => rr(c, 6.6, 16.5, 2.8, 2.2, 0.5), '#fffaf3', INK, 0.4);
    } else shape(x, c => ell(c, 8, 7.4, 4.5, 4.4), s.hair);
    if (hat) shape(x, c => { c.moveTo(5.5, 4.5); c.lineTo(8, -1.8); c.lineTo(10.5, 4.5); c.closePath(); }, ['#ff7aa2', '#6fc8f0', '#ffcf4a', '#8bd98b', '#c59bff'][style], INK, 0.5);
  }, 6);
}

// ---------------------------------------------------------------- collectibles
function leadCoin() {
  return sprite(20, 20, x => {
    const g = x.createLinearGradient(0, 1, 0, 19); g.addColorStop(0, '#ffe785'); g.addColorStop(1, '#f2a92a');
    shape(x, c => ell(c, 10, 10, 8.6, 8.6), g, '#a8661b', 1.1);
    shape(x, c => ell(c, 10, 10, 6.4, 6.4), null, 'rgba(180,110,20,0.55)', 0.7);
    shape(x, c => ell(c, 10, 7.4, 2.1, 2.1), PAL.coinG, null);
    shape(x, c => { c.moveTo(5.8, 14.2); c.quadraticCurveTo(6.2, 10.2, 10, 10.2); c.quadraticCurveTo(13.8, 10.2, 14.2, 14.2); c.closePath(); }, PAL.coinG, null);
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 1; x.beginPath(); x.arc(10, 10, 7.2, Math.PI * 1.1, Math.PI * 1.45); x.stroke();
  });
}
function poop(f = 0) {
  return sprite(22, 21, x => {
    const g = (y0, y1) => { const q = x.createLinearGradient(0, y0, 0, y1); q.addColorStop(0, PAL.pooL); q.addColorStop(1, PAL.poo); return q; };
    shape(x, c => ell(c, 11, 16, 9.4, 4), g(12, 20));
    shape(x, c => ell(c, 11, 11.4, 7, 3.5), g(8, 15));
    shape(x, c => ell(c, 11, 7.3, 4.6, 2.9), g(4, 10));
    shape(x, c => { c.moveTo(9.5, 5); c.quadraticCurveTo(11.5, 0.8, 13.4, 1.8); c.quadraticCurveTo(12.4, 3.4, 13, 5.2); c.closePath(); }, PAL.pooL);
    for (const ex of [7.8, 14.2]) { shape(x, c => ell(c, ex, 11.4, 1.9, 2.1), PAL.white, INK, 0.5); shape(x, c => ell(c, ex + 0.5 + f * 0.6, 11.7, 0.9, 1.1), INK, null); }
    shape(x, c => { c.moveTo(8.3, 15.2); c.quadraticCurveTo(11, 18.6, 13.7, 15.2); c.closePath(); }, '#5a2f1c', INK, 0.5);
    shape(x, c => ell(c, 11, 16.7, 1.3, 0.7), '#ff8c9a', null);
  });
}
function heartPath(c, cx, cy, s) {
  c.moveTo(cx, cy + s * 0.9);
  c.bezierCurveTo(cx - s * 1.25, cy + s * 0.05, cx - s * 1.05, cy - s * 0.95, cx, cy - s * 0.4);
  c.bezierCurveTo(cx + s * 1.05, cy - s * 0.95, cx + s * 1.25, cy + s * 0.05, cx, cy + s * 0.9);
  c.closePath();
}
function heart() {
  return sprite(20, 18, x => {
    const g = x.createLinearGradient(0, 1, 0, 17); g.addColorStop(0, '#ff8aa2'); g.addColorStop(1, '#e2345c');
    shape(x, c => heartPath(c, 10, 9, 8.2), g, '#9e2446', 1.1);
    shape(x, c => ell(c, 6.2, 6, 2, 1.2, -0.6), 'rgba(255,255,255,0.75)', null);
  });
}

// ---------------------------------------------------------------- scenery billboards
function rollup(col, accent) {
  return sprite(14, 34, x => {
    shape(x, c => rr(c, 1.2, 1, 11.6, 29, 1.2), col, '#5b5063', 0.6);
    shape(x, c => ell(c, 7, 9, 3.2, 3.2), accent, null);
    x.fillStyle = 'rgba(255,255,255,0.7)'; [16, 18.5, 21].forEach((y, i) => { x.beginPath(); rr(x, 3, y, 8 - i * 1.5, 1.1, 0.5); x.fill(); });
    shape(x, c => rr(c, 2, 30, 10, 2.2, 1), '#6d6577', null);
  }, 5);
}
function counter(col, accent) {
  return sprite(44, 18, x => {
    shape(x, c => rr(c, 1, 3, 42, 14, 2), col, '#4a3f52', 0.7);
    shape(x, c => rr(c, 0, 1, 44, 3.4, 1.5), '#f3ebe0', '#4a3f52', 0.7);
    shape(x, c => ell(c, 22, 10.5, 3.2, 3.2), accent, null);
  }, 6);
}

// ---------------------------------------------------------------- small UI icons
function icon(w, h, draw) { return sprite(w, h, draw, 12); }
const ICONS = {
  heart: () => icon(20, 18, x => { const g = x.createLinearGradient(0, 1, 0, 17); g.addColorStop(0, '#ff8aa2'); g.addColorStop(1, '#e2345c'); shape(x, c => heartPath(c, 10, 9, 8.2), g, null); }),
  check: () => icon(20, 20, x => { x.strokeStyle = '#5fd08a'; x.lineWidth = 3.4; x.beginPath(); x.moveTo(3.5, 10.5); x.lineTo(8, 15); x.lineTo(16.5, 5); x.stroke(); }),
  left: () => icon(20, 16, x => { x.strokeStyle = '#fff'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(17, 8); x.lineTo(4, 8); x.moveTo(9, 3); x.lineTo(4, 8); x.lineTo(9, 13); x.stroke(); }),
  right: () => icon(20, 16, x => { x.strokeStyle = '#fff'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(3, 8); x.lineTo(16, 8); x.moveTo(11, 3); x.lineTo(16, 8); x.lineTo(11, 13); x.stroke(); }),
  coin: () => leadCoin(),
  hand: () => icon(20, 24, x => {
    shape(x, c => { c.moveTo(6, 13); c.lineTo(6, 4); c.quadraticCurveTo(7.5, 1.6, 9, 4); c.lineTo(9, 11); c.lineTo(15.5, 12); c.quadraticCurveTo(18, 12.6, 17.6, 15.5); c.lineTo(16.6, 20); c.quadraticCurveTo(16, 22.5, 13, 22.5); c.lineTo(8.5, 22.5); c.quadraticCurveTo(6, 22.5, 4.8, 20); c.lineTo(3, 16); c.quadraticCurveTo(2.4, 13.6, 4.4, 13.4); c.closePath(); }, '#fff8ee', '#6b5a73', 1);
  }),
  sound: () => icon(22, 20, x => { shape(x, c => { c.moveTo(3, 7.5); c.lineTo(7, 7.5); c.lineTo(11.5, 3.5); c.lineTo(11.5, 16.5); c.lineTo(7, 12.5); c.lineTo(3, 12.5); c.closePath(); }, '#fff', null); x.strokeStyle = '#fff'; x.lineWidth = 1.8; x.beginPath(); x.arc(12, 10, 4, -0.8, 0.8); x.stroke(); x.beginPath(); x.arc(12, 10, 7.4, -0.8, 0.8); x.stroke(); }),
  mute: () => icon(22, 20, x => { shape(x, c => { c.moveTo(3, 7.5); c.lineTo(7, 7.5); c.lineTo(11.5, 3.5); c.lineTo(11.5, 16.5); c.lineTo(7, 12.5); c.lineTo(3, 12.5); c.closePath(); }, 'rgba(255,255,255,0.7)', null); x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 1.8; x.beginPath(); x.moveTo(14, 7); x.lineTo(19, 13); x.moveTo(19, 7); x.lineTo(14, 13); x.stroke(); }),
  play: () => icon(20, 20, x => shape(x, c => { c.moveTo(6, 3.5); c.lineTo(17, 10); c.lineTo(6, 16.5); c.closePath(); }, '#5a3410', '#5a3410', 1.5)),
  next: () => icon(12, 12, x => shape(x, c => { c.moveTo(3, 2); c.lineTo(10, 6); c.lineTo(3, 10); c.closePath(); }, '#b6a6c4', '#b6a6c4', 1)),
};

function buildArt() {
  const A = {};
  A.aigul = {
    front: aigulFront('neutral'), happy: aigulFront('happy'), hit: aigulFront('hit'), calm: aigulFront('calm'),
    cheer: aigulFront('happy', 'up'), wave: aigulFront('happy', 'wave'), bob: aigulFront('neutral', 'down', 0.7), happyBob: aigulFront('happy', 'down', 0.7),
    back: [0, 1, 2, 3].map(aigulBack), med: [aigulMeditate(0), aigulMeditate(1)],
  };
  A.tim = {};
  ['idle', 'windup', 'throw', 'pocket', 'empty', 'shrug', 'walk0', 'walk1'].forEach(k => A.tim[k] = timofey(k));
  A.tim.look = timofey('look', 1);
  A.tim.walkL0 = flipH(A.tim.walk0); A.tim.walkL1 = flipH(A.tim.walk1);
  A.and = {};
  ['idle', 'wave', 'throw', 'talk', 'walk0', 'walk1'].forEach(k => A.and[k] = andrey(k));
  A.npc = NPC_STYLES.map((_, i) => ({ back: npc(i, false), front: npc(i, true), cheer: npc(i, true, true, true), fronthat: npc(i, true, false, true) }));
  A.coin = leadCoin(); A.poop = [poop(0), poop(-1)]; A.heart = heart();
  A.rollups = [rollup('#c98a6e', '#f3d39a'), rollup('#7e9cb3', '#dcecf5'), rollup('#b9a6c9', '#f6e3a4'), rollup('#d6b98a', '#fff1d0')];
  A.counterL = counter('#c8876a', '#ffd98a'); A.counterR = counter('#7a9bb8', '#ffe3a0');
  A.icons = {}; for (const k in ICONS) A.icons[k] = ICONS[k]();
  return A;
}
