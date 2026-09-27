// Stylized 2D art, drawn in code: chunky silhouettes, thick ink outlines and two-tone cel shading.
// Every sprite is rendered once at high resolution (R px per logical unit) and reused.
// `c.lw/c.lh` hold the logical size used by the renderer.
'use strict';

const R = 8;
const INK = '#2a1a2c';
const OL = 1.0; // outline width (logical units)
const PAL = {
  skin: '#ffd3b6', skinS: '#f0a68a', blush: 'rgba(242,104,120,0.38)', lip: '#d4566e', mouth: '#9e3350', white: '#fffaf3',
  hairA: '#2e1b22', hairAS: '#1d1015', hairAH: '#6a4248', gold: '#f0b43c',
  topA: '#3a3150', topAS: '#282239', denim: '#4f63a8', denimS: '#3a4a84', shoe: '#fffaf3', shoeS: '#d9cfc3',
  hairT: '#3a2820', beard: '#533628', beardS: '#3a241a', shirt: '#ffffff', shirtS: '#d8dde8', trou: '#4a5064', trouS: '#373c4d', shoeT: '#7a4a32',
  hairN: '#7a4a2e', hairNS: '#c2a48c', hood: '#ffc93a', hoodS: '#eda21c', hoodL: '#ffe27a', jeans: '#3f5e9c', jeansS: '#2f4777',
};
const FONT_ART = 'Nunito, "Segoe UI", Roboto, sans-serif';

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
function ell(x, cx, cy, rx, ry, rot = 0) { x.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot)); x.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); }
function rr(x, x0, y0, w, h, r) { x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + h, r); x.arcTo(x0 + w, y0 + h, x0, y0 + h, r); x.arcTo(x0, y0 + h, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath(); }
function shape(x, path, fill, stroke = INK, lw = OL) {
  x.beginPath(); path(x);
  if (fill) { x.fillStyle = fill; x.fill(); }
  if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); }
}
// Cel-shaded part: shade colour fills the shape, the base colour is the same shape shifted
// towards the light (top-left), leaving a crisp shadow crescent bottom-right.
function part(x, path, base, shade, off = [1.2, 0.8], stroke = INK, lw = OL) {
  x.save(); x.beginPath(); path(x); x.clip();
  x.fillStyle = shade; x.fillRect(-60, -60, 200, 200);
  x.translate(-off[0], -off[1]); x.beginPath(); path(x); x.fillStyle = base; x.fill();
  x.restore();
  if (stroke) { x.beginPath(); path(x); x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); }
}
// Several blobs rendered as one silhouette with one outer outline and a shaded underside.
function blobs(x, list, base, shade, curl) {
  const path = c => list.forEach(([a, b, r]) => ell(c, a, b, r, r));
  x.beginPath(); path(x); x.strokeStyle = INK; x.lineWidth = OL * 2; x.stroke();
  x.save(); x.beginPath(); path(x); x.clip();
  x.fillStyle = shade; x.fillRect(-60, -60, 200, 200);
  x.translate(-1, -1.1); x.beginPath(); path(x); x.fillStyle = base; x.fill();
  x.restore();
  if (curl) {
    x.strokeStyle = curl; x.lineWidth = 0.7;
    list.forEach(([a, b, r]) => {
      if (r < 2.2) return;
      x.beginPath(); x.arc(a - r * 0.12, b - r * 0.1, r * 0.55, Math.PI * 0.95, Math.PI * 1.85); x.stroke();
      if (r > 3.5) { x.beginPath(); x.arc(a + r * 0.1, b + r * 0.25, r * 0.28, Math.PI * 1.1, Math.PI * 2.1); x.stroke(); }
    });
  }
}
function limb(x, pts, w, col, shade) {
  const line = c => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); };
  line(x); x.strokeStyle = INK; x.lineWidth = w + OL * 2; x.stroke();
  x.strokeStyle = col; x.lineWidth = w; x.stroke();
  if (shade) { x.save(); x.translate(w * 0.24, 0.15); line(x); x.strokeStyle = shade; x.lineWidth = w * 0.46; x.stroke(); x.restore(); }
}
function hand(x, a, b, r = 1.75, col = PAL.skin) { part(x, c => ell(c, a, b, r, r * 0.92), col, PAL.skinS, [0.5, 0.4]); }
function sneaker(x, a, b, col = PAL.shoe, sole = PAL.shoeS) {
  part(x, c => { c.moveTo(a - 2.7, b + 1.2); c.quadraticCurveTo(a - 2.8, b - 1.6, a, b - 1.6); c.quadraticCurveTo(a + 2.9, b - 1.5, a + 2.8, b + 1.2); c.closePath(); }, col, sole, [0.4, 0.5]);
}
function eyeOpen(x, cx, cy, look = 0, lashes = false, lid = 0, iris = '#3b2426') {
  shape(x, c => ell(c, cx, cy, 1.45, 1.75), PAL.white, INK, 0.5);
  shape(x, c => ell(c, cx + look * 0.5, cy + 0.15, 1.05, 1.3), iris, null);
  shape(x, c => ell(c, cx + look * 0.5, cy + 0.35, 0.55, 0.65), '#140a0c', null);
  shape(x, c => ell(c, cx + look * 0.5 + 0.45, cy - 0.35, 0.38, 0.38), '#fff', null);
  if (lid) { // heavy, matter-of-fact lids
    x.save(); x.beginPath(); ell(x, cx, cy, 1.45, 1.75); x.clip();
    x.fillStyle = PAL.skin; x.fillRect(cx - 2, cy - 2, 4, 2 * lid); x.restore();
    x.strokeStyle = INK; x.lineWidth = 0.6; x.beginPath(); x.moveTo(cx - 1.5, cy - 1.75 + 2 * lid - 0.15); x.lineTo(cx + 1.5, cy - 1.75 + 2 * lid - 0.15); x.stroke();
  }
  if (lashes) {
    x.strokeStyle = INK; x.lineWidth = 0.55;
    const s = cx < 16 ? -1 : 1;
    x.beginPath(); x.moveTo(cx + s * 1.2, cy - 1.2); x.lineTo(cx + s * 2, cy - 1.8); x.stroke();
    x.beginPath(); x.moveTo(cx + s * 0.6, cy - 1.6); x.lineTo(cx + s * 1.1, cy - 2.35); x.stroke();
  }
}
function eyeArc(x, cx, cy, happy) {
  x.strokeStyle = INK; x.lineWidth = 0.85; x.beginPath();
  if (happy) x.arc(cx, cy + 0.9, 1.4, Math.PI * 1.15, Math.PI * 1.85); else x.arc(cx, cy - 0.3, 1.3, Math.PI * 0.15, Math.PI * 0.85);
  x.stroke();
}
function blush(x, a, b) { shape(x, c => ell(c, a, b, 1.7, 1), PAL.blush, null); }
function badge(x, cx, cy, strap = '#e8505b', card = '#fffaf3') {
  x.strokeStyle = strap; x.lineWidth = 0.55;
  x.beginPath(); x.moveTo(cx - 2.4, cy - 5.4); x.lineTo(cx - 0.9, cy - 1.2); x.moveTo(cx + 2.4, cy - 5.4); x.lineTo(cx + 0.9, cy - 1.2); x.stroke();
  shape(x, c => rr(c, cx - 1.8, cy - 1.3, 3.6, 2.9, 0.5), card, INK, 0.45);
  shape(x, c => rr(c, cx - 1.8, cy - 1.3, 3.6, 0.9, 0.4), strap, null);
}

// ---------------------------------------------------------------- Aigul (32 x 50)
// shoulder-length curls: close to the crown, widening from the ears down (as in the photo)
const AIGUL_CROWN = [16, 13.4, 9.4];
const AIGUL_HAIR = [[8.4, 13.5, 4], [23.6, 13.5, 4], [6.8, 18.5, 4.4], [25.2, 18.5, 4.4], [6, 23.6, 4.6], [26, 23.6, 4.6], [6.6, 28.4, 4], [25.4, 28.4, 4], [9.6, 31, 3], [22.4, 31, 3]];
function aigulHair(x, y) {
  blobs(x, AIGUL_HAIR.map(([a, b, r]) => [a, b + y, r]).concat([[AIGUL_CROWN[0], AIGUL_CROWN[1] + y, AIGUL_CROWN[2]]]), PAL.hairA, PAL.hairAS, null);
  x.strokeStyle = PAL.hairAH; x.lineWidth = 0.7;
  AIGUL_HAIR.forEach(([a, b, r]) => { x.beginPath(); x.arc(a - r * 0.12, b + y - r * 0.1, r * 0.55, Math.PI * 0.95, Math.PI * 1.85); x.stroke(); x.beginPath(); x.arc(a + r * 0.1, b + y + r * 0.25, r * 0.28, Math.PI * 1.1, Math.PI * 2.1); x.stroke(); });
  x.beginPath(); x.arc(16, 13.4 + y, 7.6, Math.PI * 1.2, Math.PI * 1.45); x.stroke(); x.beginPath(); x.arc(16, 13.4 + y, 7.6, Math.PI * 1.55, Math.PI * 1.8); x.stroke();
}
function aigulLegs(x) {
  part(x, c => rr(c, 10.7, 38.5, 4.6, 7.4, 1.8), PAL.denim, PAL.denimS);
  part(x, c => rr(c, 16.7, 38.5, 4.6, 7.4, 1.8), PAL.denim, PAL.denimS);
  sneaker(x, 12.8, 46.4); sneaker(x, 19.2, 46.4);
}
function aigulTorso(x, y) {
  part(x, c => { c.moveTo(8.6, 30.4 + y); c.quadraticCurveTo(16, 27.2 + y, 23.4, 30.4 + y); c.quadraticCurveTo(25.2, 36, 23.6, 41.2); c.quadraticCurveTo(16, 42.4, 8.4, 41.2); c.quadraticCurveTo(6.8, 36, 8.6, 30.4 + y); c.closePath(); }, PAL.topA, PAL.topAS);
  shape(x, c => { c.moveTo(13.4, 28.6 + y); c.lineTo(16, 32.6 + y); c.lineTo(18.6, 28.6 + y); c.closePath(); }, PAL.skinS, null);
  badge(x, 16, 36.4 + y, '#2bb3a3');
}
function aigulFace(x, mood, y = 0) {
  part(x, c => ell(c, 16, 18.4 + y, 7.8, 8.7), PAL.skin, PAL.skinS, [1.4, 0.4]);
  // centre-parted hair swept to the sides, forehead open; curls frame the cheeks
  const sweep = (c, s) => { c.moveTo(16, 7.2 + y); c.quadraticCurveTo(16 - s * 5.4, 7.2 + y, 16 - s * 8.3, 11.4 + y); c.lineTo(16 - s * 8.6, 16.5 + y); c.quadraticCurveTo(16 - s * 7.4, 12.6 + y, 16 - s * 4.6, 10.9 + y); c.quadraticCurveTo(16 - s * 1.8, 9.6 + y, 16, 7.2 + y); c.closePath(); };
  for (const sd of [1, -1]) part(x, c => sweep(c, sd), PAL.hairA, PAL.hairAS, [sd * -0.6, -0.4], INK, 0.8);
  blobs(x, [[8.2, 17.4 + y, 2.2], [23.8, 17.4 + y, 2.2], [7.8, 21.8 + y, 2.4], [24.2, 21.8 + y, 2.4]], PAL.hairA, PAL.hairAS, PAL.hairAH);
  x.strokeStyle = PAL.hairAH; x.lineWidth = 0.55;
  x.beginPath(); x.moveTo(14.6, 8.4 + y); x.quadraticCurveTo(11, 8.8 + y, 9.4, 12 + y); x.moveTo(17.4, 8.4 + y); x.quadraticCurveTo(21, 8.8 + y, 22.6, 12 + y); x.stroke();
  // strong, softly arched brows
  x.strokeStyle = PAL.hairA; x.lineWidth = 1.25;
  x.beginPath(); x.moveTo(9.7, 15.5 + y); x.quadraticCurveTo(12, 13.8 + y, 14.6, 14.9 + y); x.stroke();
  x.beginPath(); x.moveTo(17.4, 14.9 + y); x.quadraticCurveTo(20, 13.8 + y, 22.3, 15.5 + y); x.stroke();
  const ey = 18.1 + y;
  if (mood === 'happy') { eyeArc(x, 12.3, ey, true); eyeArc(x, 19.7, ey, true); }
  else if (mood === 'calm') { eyeArc(x, 12.3, ey, false); eyeArc(x, 19.7, ey, false); }
  else if (mood === 'hit') {
    for (const ex of [12.3, 19.7]) { shape(x, c => ell(c, ex, ey, 1.6, 1.9), PAL.white, INK, 0.5); shape(x, c => ell(c, ex, ey, 0.55, 0.6), INK, null); }
  } else { eyeOpen(x, 12.3, ey, 0, true, 0.22, '#7a5a34'); eyeOpen(x, 19.7, ey, 0, true, 0.22, '#7a5a34'); }
  // thin gold wire glasses, large and rectangular
  x.lineWidth = 0.45; x.strokeStyle = '#e3b25a';
  for (const gx of [12.3, 19.7]) { x.beginPath(); rr(x, gx - 3.2, 16 + y, 6.4, 4.8, 0.9); x.fillStyle = 'rgba(210,235,255,0.14)'; x.fill(); x.stroke(); }
  x.beginPath(); x.moveTo(15.8, 17.3 + y); x.quadraticCurveTo(16, 16.7 + y, 16.2, 17.3 + y); x.moveTo(8.8, 17 + y); x.lineTo(8, 16.6 + y); x.moveTo(23.2, 17 + y); x.lineTo(24, 16.6 + y); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 0.4;
  for (const gx of [12.3, 19.7]) { x.beginPath(); x.moveTo(gx + 1.3, 16.7 + y); x.lineTo(gx + 2.5, 18 + y); x.stroke(); }
  blush(x, 10.2, 22.6 + y); blush(x, 21.8, 22.6 + y);
  // nose
  x.strokeStyle = PAL.skinS; x.lineWidth = 0.7; x.beginPath(); x.moveTo(15.1, 21.3 + y); x.quadraticCurveTo(16, 22 + y, 16.9, 21.3 + y); x.stroke();
  if (mood === 'happy') {
    shape(x, c => { c.moveTo(13.4, 23.4 + y); c.quadraticCurveTo(16, 27.4 + y, 18.6, 23.4 + y); c.closePath(); }, PAL.mouth, INK, 0.6);
    shape(x, c => { c.moveTo(14.4, 25.3 + y); c.quadraticCurveTo(16, 24.2 + y, 17.6, 25.3 + y); c.quadraticCurveTo(16, 26.5 + y, 14.4, 25.3 + y); }, '#ff8fa0', null);
  } else if (mood === 'hit') shape(x, c => ell(c, 16, 24.2 + y, 1.1, 1.3), PAL.mouth, INK, 0.6);
  else {
    // full soft lips, calm half-smile
    shape(x, c => { c.moveTo(13.7, 23.5 + y); c.quadraticCurveTo(15, 22.5 + y, 16, 23.1 + y); c.quadraticCurveTo(17, 22.5 + y, 18.3, 23.5 + y); c.quadraticCurveTo(16, 26 + y, 13.7, 23.5 + y); c.closePath(); }, '#e0788a', INK, 0.45);
    x.strokeStyle = '#a84460'; x.lineWidth = 0.4; x.beginPath(); x.moveTo(13.9, 23.6 + y); x.quadraticCurveTo(16, 24.1 + y, 18.1, 23.6 + y); x.stroke();
  }
}
function aigulFront(mood = 'neutral', arms = 'down', bob = 0) {
  return sprite(32, 50, x => {
    x.translate(0, 2);
    aigulHair(x, bob);
    aigulLegs(x);
    const y = bob;
    const A = {
      down: [[[10, 31 + y], [8.4, 38 + y]], [[22, 31 + y], [23.6, 38 + y]]],
      up: [[[10, 31 + y], [5.8, 25 + y], [6.2, 19 + y]], [[22, 31 + y], [26.2, 25 + y], [25.8, 19 + y]]],
      wave: [[[10, 31 + y], [8.4, 38 + y]], [[22, 31 + y], [26.6, 26 + y], [26.8, 20 + y]]],
    }[arms];
    A.forEach(p => limb(x, p, 3.6, PAL.topA, PAL.topAS));
    aigulTorso(x, y);
    A.forEach(p => hand(x, p[p.length - 1][0], p[p.length - 1][1] + 0.4));
    aigulFace(x, mood, y);
  });
}
function aigulBack(f) {
  const up = f % 2 ? -0.8 : 0, lift = [2.6, 0, 0, 0][f], lift2 = [0, 0, 2.6, 0][f], sw = [1.8, 0, -1.8, 0][f];
  return sprite(32, 50, x => {
    x.translate(0, 2);
    part(x, c => rr(c, 10.7, 37.5, 4.6, 7.8 - lift, 1.8), PAL.denim, PAL.denimS);
    part(x, c => rr(c, 16.7, 37.5, 4.6, 7.8 - lift2, 1.8), PAL.denim, PAL.denimS);
    sneaker(x, 12.9, 46.2 - lift, lift ? PAL.shoeS : PAL.shoe, '#b9ae9f'); sneaker(x, 19.1, 46.2 - lift2, lift2 ? PAL.shoeS : PAL.shoe, '#b9ae9f');
    limb(x, [[10, 30 + up], [7.4, 36 + up + sw]], 3.6, PAL.topA, PAL.topAS); limb(x, [[22, 30 + up], [24.6, 36 + up - sw]], 3.6, PAL.topA, PAL.topAS);
    hand(x, 7.4, 37 + up + sw, 1.6, PAL.skinS); hand(x, 24.6, 37 + up - sw, 1.6, PAL.skinS);
    part(x, c => { c.moveTo(8.6, 29.4 + up); c.quadraticCurveTo(16, 26.4 + up, 23.4, 29.4 + up); c.quadraticCurveTo(25.2, 35, 23.6, 40.4); c.quadraticCurveTo(16, 41.6, 8.4, 40.4); c.quadraticCurveTo(6.8, 35, 8.6, 29.4 + up); c.closePath(); }, PAL.topA, PAL.topAS);
    const H = [[16, 13.2, 9.6], [8.6, 14, 4.2], [23.4, 14, 4.2], [6.6, 19.5, 4.6], [25.4, 19.5, 4.6], [6.6, 25.4, 4.6], [25.4, 25.4, 4.6], [10.4, 25, 5.2], [21.6, 25, 5.2], [16, 25, 5.4], [9.6, 29.8, 3.6], [22.4, 29.8, 3.6], [16, 29.6, 3.8]];
    blobs(x, H.map(([a, b, r]) => [a + (b > 20 ? sw * 0.3 : 0), b + up, r]), PAL.hairA, PAL.hairAS, PAL.hairAH);
    // glasses temples and the badge lanyard peeking out of the curls
    x.strokeStyle = PAL.gold; x.lineWidth = 0.8;
    x.beginPath(); x.moveTo(3.2, 17 + up); x.lineTo(4.8, 17.5 + up); x.stroke();
    x.beginPath(); x.moveTo(28.8, 17 + up); x.lineTo(27.2, 17.5 + up); x.stroke();
  });
}
function aigulMeditate(f) {
  const y = f ? -0.7 : 0;
  return sprite(36, 48, x => {
    x.translate(0, 4);
    x.save(); x.translate(2, -4 + y); aigulHair(x, 0); x.restore();
    part(x, c => ell(c, 18, 40, 13.4, 3.9), PAL.denim, PAL.denimS);
    sneaker(x, 6.8, 41.2); sneaker(x, 29.2, 41.2);
    x.translate(0, -4 + y);
    limb(x, [[12, 31], [7, 39], [5.6, 42]], 3.6, PAL.topA, PAL.topAS); limb(x, [[24, 31], [29, 39], [30.4, 42]], 3.6, PAL.topA, PAL.topAS);
    x.save(); x.translate(2, 0); aigulTorso(x, 0); x.restore();
    hand(x, 5.6, 42.4); hand(x, 30.4, 42.4);
    x.translate(2, 0);
    aigulFace(x, 'calm');
  });
}

// ---------------------------------------------------------------- Timofey (34 x 50)
function timofey(pose = 'idle', look = 0) {
  return sprite(34, 50, x => {
    x.translate(1, 0);
    const wf = pose === 'walk1' ? 1 : pose === 'walk0' ? -1 : 0;
    part(x, c => rr(c, 10.4, 39.5, 5, 7.4 - (wf > 0 ? 1.2 : 0), 1.6), PAL.trou, PAL.trouS);
    part(x, c => rr(c, 16.6, 39.5, 5, 7.4 - (wf < 0 ? 1.2 : 0), 1.6), PAL.trou, PAL.trouS);
    sneaker(x, 12.6 + wf * 0.5, 47.4 - (wf > 0 ? 1.2 : 0), PAL.shoeT, '#5a3222'); sneaker(x, 19.4 - wf * 0.5, 47.4 - (wf < 0 ? 1.2 : 0), PAL.shoeT, '#5a3222');
    const S = [[8, 29], [24, 29]], pocket = pose === 'pocket' || pose === 'empty' || pose === 'look';
    let arms;
    switch (pose) {
      case 'windup': arms = [[S[0], [6.6, 38]], [S[1], [27.4, 24], [26.4, 17]]]; break;
      case 'throw': arms = [[S[0], [6.6, 38]], [S[1], [28.5, 29], [32.4, 28]]]; break;
      case 'pocket': case 'empty': case 'look': arms = [[S[0], [7.6, 34.5], [11, 39.4]], [S[1], [24.4, 34.5], [21, 39.4]]]; break;
      case 'shrug': arms = [[S[0], [4.2, 32.5], [2.2, 25.5]], [S[1], [27.8, 32.5], [29.8, 25.5]]]; break;
      default: arms = [[S[0], [6.8 - wf * 0.8, 38]], [S[1], [25.2 + wf * 0.8, 38]]];
    }
    // shirt sleeves rolled up: white upper arm, skin forearm
    arms.forEach(p => {
      const mid = p.length === 3 ? p[1] : [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2];
      limb(x, [p[0], mid, p[p.length - 1]], 3.1, PAL.skin, PAL.skinS);
      limb(x, [p[0], mid], 4, PAL.shirt, PAL.shirtS);
    });
    // shirt body with a slight comic belly
    part(x, c => { c.moveTo(7.6, 28.2); c.quadraticCurveTo(16, 25.4, 24.4, 28.2); c.quadraticCurveTo(27, 35, 24.8, 41); c.quadraticCurveTo(16, 42.2, 7.2, 41); c.quadraticCurveTo(5, 35, 7.6, 28.2); c.closePath(); }, PAL.shirt, PAL.shirtS, [1.6, 0.6]);
    x.strokeStyle = PAL.shirtS; x.lineWidth = 0.55; x.beginPath(); x.moveTo(16, 29.5); x.lineTo(16, 40.6); x.stroke();
    [32, 35, 38].forEach(b => shape(x, c => ell(c, 16.9, b, 0.4, 0.4), '#b9bfcc', null));
    part(x, c => rr(c, 7.4, 39.8, 17.2, 2, 0.8), '#3e2e28', '#2c201c', [0.3, 0.3]);
    shape(x, c => rr(c, 14.8, 39.9, 2.4, 1.8, 0.3), '#e8c160', INK, 0.4);
    shape(x, c => { c.moveTo(12.2, 26.4); c.lineTo(16, 29.8); c.lineTo(12.8, 31); c.closePath(); }, PAL.shirt, INK, 0.65);
    shape(x, c => { c.moveTo(19.8, 26.4); c.lineTo(16, 29.8); c.lineTo(19.2, 31); c.closePath(); }, PAL.shirt, INK, 0.65);
    badge(x, 20.6, 35.2, '#e8505b');
    if (pose === 'empty' || pose === 'look') {
      for (const s of [-1, 1]) shape(x, c => { const a = 16 + s * 6.4; c.moveTo(a - 1.6, 41); c.quadraticCurveTo(a - 2.2, 45, a, 44.8); c.quadraticCurveTo(a + 2.2, 45, a + 1.6, 41); c.closePath(); }, PAL.white, INK, 0.6);
    }
    if (!pocket) arms.forEach(p => { const e = p[p.length - 1]; hand(x, e[0], e[1], 1.8); });
    // head: broad face, short fade haircut, full trimmed beard, calm serious look (as in the photo)
    part(x, c => rr(c, 13.2, 21.6, 5.6, 5.4, 1.6), PAL.skinS, '#d98e74', [0.6, 0]);
    part(x, c => ell(c, 8.1, 16.6, 1.6, 2.3), PAL.skin, PAL.skinS, [0.4, 0.3]); part(x, c => ell(c, 23.9, 16.6, 1.6, 2.3), PAL.skin, PAL.skinS, [0.4, 0.3]);
    part(x, c => { c.moveTo(8.5, 13); c.quadraticCurveTo(8.3, 6.6, 16, 6.4); c.quadraticCurveTo(23.7, 6.6, 23.5, 13); c.quadraticCurveTo(23.8, 22.5, 16, 24.6); c.quadraticCurveTo(8.2, 22.5, 8.5, 13); c.closePath(); }, PAL.skin, PAL.skinS, [1.4, 0.4]);
    // skin-fade sides and a short, slightly textured top
    shape(x, c => { c.moveTo(8.5, 14.2); c.quadraticCurveTo(8.2, 9.4, 9.8, 8.2); c.lineTo(10, 12.4); c.closePath(); }, '#8d7a6e', null);
    shape(x, c => { c.moveTo(23.5, 14.2); c.quadraticCurveTo(23.8, 9.4, 22.2, 8.2); c.lineTo(22, 12.4); c.closePath(); }, '#8d7a6e', null);
    part(x, c => { c.moveTo(9.2, 10.4); c.quadraticCurveTo(9.4, 5, 16, 4.6); c.quadraticCurveTo(22.6, 5, 22.8, 10.4); c.quadraticCurveTo(19.5, 8.6, 16, 9.2); c.quadraticCurveTo(12.5, 8.6, 9.2, 10.4); c.closePath(); }, PAL.hairT, '#241812', [0.5, 0.8], INK, 0.8);
    x.strokeStyle = '#5a4234'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(12, 6.4); x.lineTo(13.2, 8); x.moveTo(15.6, 5.8); x.lineTo(16.4, 7.6); x.moveTo(19.2, 6.2); x.lineTo(19.8, 7.8); x.stroke();
    // full beard covering jaw and chin, joined moustache
    part(x, c => {
      c.moveTo(8.5, 15.2); c.quadraticCurveTo(9.2, 19.4, 12.2, 20); c.quadraticCurveTo(16, 18.9, 19.8, 20); c.quadraticCurveTo(22.8, 19.4, 23.5, 15.2);
      c.quadraticCurveTo(23.9, 23.4, 16, 25.8); c.quadraticCurveTo(8.1, 23.4, 8.5, 15.2); c.closePath();
    }, PAL.beard, PAL.beardS, [1, 0.8]);
    shape(x, c => { c.moveTo(11.8, 21.2); c.quadraticCurveTo(16, 18.7, 20.2, 21.2); c.quadraticCurveTo(16, 20.5, 11.8, 21.2); }, PAL.beard, INK, 0.55);
    if (pose === 'shrug') shape(x, c => { c.moveTo(14, 22.5); c.quadraticCurveTo(16.2, 23.6, 18.3, 22); }, null, PAL.lip, 0.9);
    else shape(x, c => { c.moveTo(14.2, 22.3); c.quadraticCurveTo(16, 23.4, 17.8, 22.3); c.quadraticCurveTo(16, 22.7, 14.2, 22.3); }, '#c9707e', INK, 0.4);
    // thick straight brows sitting low over the eyes
    x.strokeStyle = PAL.hairT; x.lineWidth = 1.35;
    const shock = pose === 'empty' || pose === 'shrug' || pose === 'look';
    x.beginPath(); x.moveTo(9.9, 14 - (shock ? 1.1 : 0)); x.quadraticCurveTo(12.2, 13.2 - (shock ? 1.1 : 0), 14.4, 13.8 - (shock ? 0.5 : 0)); x.stroke();
    x.beginPath(); x.moveTo(17.6, 13.8 - (shock ? 0.5 : 0)); x.quadraticCurveTo(19.8, 13.2 - (shock ? 1.1 : 0), 22.1, 14 - (shock ? 1.1 : 0)); x.stroke();
    eyeOpen(x, 12.4, 16.1, look ? 1.2 : 0, false, shock ? 0.15 : 0.42, '#4a3a30'); eyeOpen(x, 19.6, 16.1, look ? 1.2 : 0, false, shock ? 0.15 : 0.42, '#4a3a30');
    x.strokeStyle = PAL.skinS; x.lineWidth = 0.75; x.beginPath(); x.moveTo(14.9, 19); x.quadraticCurveTo(16, 19.8, 17.1, 19); x.stroke();
  });
}

// ---------------------------------------------------------------- Andrey (36 x 50)
function andrey(pose = 'idle') {
  return sprite(36, 50, x => {
    x.translate(2, 0);
    const wf = pose === 'walk1' ? 1 : pose === 'walk0' ? -1 : 0;
    part(x, c => rr(c, 10.4, 39.5, 5, 7.4 - (wf > 0 ? 1.2 : 0), 1.6), PAL.jeans, PAL.jeansS);
    part(x, c => rr(c, 16.6, 39.5, 5, 7.4 - (wf < 0 ? 1.2 : 0), 1.6), PAL.jeans, PAL.jeansS);
    sneaker(x, 12.6 + wf * 0.5, 47.4 - (wf > 0 ? 1.2 : 0)); sneaker(x, 19.4 - wf * 0.5, 47.4 - (wf < 0 ? 1.2 : 0));
    const S = [[7.6, 29.4], [24.4, 29.4]];
    let arms;
    if (pose === 'wave') arms = [[S[0], [6, 38]], [S[1], [28.8, 23.4], [28.4, 16.4]]];
    else if (pose === 'throw') arms = [[S[0], [2.6, 29.4], [-1.2, 28.4]], [S[1], [26, 38]]];
    else arms = [[S[0], [6 - wf * 0.8, 38]], [S[1], [26 + wf * 0.8, 38]]];
    // hood behind the head
    part(x, c => { c.moveTo(8.2, 27.6); c.quadraticCurveTo(6.8, 21.6, 16, 21.2); c.quadraticCurveTo(25.2, 21.6, 23.8, 27.6); c.closePath(); }, PAL.hoodS, '#d48c12', [0.6, 0.3]);
    arms.forEach(p => limb(x, p, 4.4, PAL.hood, PAL.hoodS));
    part(x, c => { c.moveTo(7, 28.6); c.quadraticCurveTo(16, 25, 25, 28.6); c.quadraticCurveTo(27.2, 35, 25.6, 41.6); c.quadraticCurveTo(16, 42.8, 6.4, 41.6); c.quadraticCurveTo(4.8, 35, 7, 28.6); c.closePath(); }, PAL.hood, PAL.hoodS, [1.6, 0.6]);
    shape(x, c => rr(c, 6.6, 39.6, 18.8, 2.2, 1), PAL.hoodS, INK, 0.55);
    part(x, c => rr(c, 10.2, 34, 11.6, 5.4, 2.4), PAL.hoodS, '#d48c12', [0.5, 0.5], INK, 0.6);
    // hood rim around the neck + drawstrings
    shape(x, c => { c.moveTo(9.2, 26.4); c.quadraticCurveTo(16, 33.4, 22.8, 26.4); c.quadraticCurveTo(16, 23.8, 9.2, 26.4); c.closePath(); }, PAL.hoodL, INK, 0.75);
    x.strokeStyle = '#fff4d4'; x.lineWidth = 0.7;
    x.beginPath(); x.moveTo(14, 29.4); x.lineTo(13.7, 33.6); x.stroke(); x.beginPath(); x.moveTo(18, 29.4); x.lineTo(18.3, 33.6); x.stroke();
    shape(x, c => ell(c, 13.7, 33.8, 0.5, 0.6), '#fff4d4', null); shape(x, c => ell(c, 18.3, 33.8, 0.5, 0.6), '#fff4d4', null);
    arms.forEach(p => { const e = p[p.length - 1]; hand(x, e[0], e[1], 1.85); });
    // head: slimmer face, noticeable ears, high swept-back top with skin-fade sides (as in the photo)
    part(x, c => ell(c, 8.5, 16.4, 1.6, 2.3), PAL.skin, PAL.skinS, [0.5, 0.3]); part(x, c => ell(c, 23.5, 16.4, 1.6, 2.3), PAL.skin, PAL.skinS, [0.5, 0.3]);
    part(x, c => { c.moveTo(9, 13); c.quadraticCurveTo(9, 7, 16, 6.8); c.quadraticCurveTo(23, 7, 23, 13); c.quadraticCurveTo(23, 22.8, 16, 25); c.quadraticCurveTo(9, 22.8, 9, 13); c.closePath(); }, PAL.skin, PAL.skinS, [1.4, 0.4]);
    shape(x, c => { c.moveTo(9.1, 13.8); c.quadraticCurveTo(8.9, 9, 11, 7.8); c.lineTo(11.2, 11.4); c.closePath(); }, PAL.hairNS, null);
    shape(x, c => { c.moveTo(22.9, 13.8); c.quadraticCurveTo(23.1, 9, 21, 7.8); c.lineTo(20.8, 11.4); c.closePath(); }, PAL.hairNS, null);
    part(x, c => { c.moveTo(10.4, 10.2); c.quadraticCurveTo(9.8, 4.6, 15.6, 4); c.quadraticCurveTo(22.2, 3.2, 23.6, 7.2); c.quadraticCurveTo(23.9, 9.8, 22, 10.4); c.quadraticCurveTo(18.6, 7.6, 13.6, 9.2); c.quadraticCurveTo(11.6, 10, 10.4, 10.2); c.closePath(); }, PAL.hairN, '#5e3620', [0.8, 1]);
    x.strokeStyle = '#a8764f'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(12, 6.8); x.quadraticCurveTo(17, 4.4, 22.4, 6); x.moveTo(13.4, 8.4); x.quadraticCurveTo(17.6, 6.4, 22, 8); x.stroke();
    x.strokeStyle = '#6a4630'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(10.3, 12.8); x.quadraticCurveTo(12.4, 11.8, 14.5, 12.6); x.stroke();
    x.beginPath(); x.moveTo(17.5, 12.6); x.quadraticCurveTo(19.6, 11.8, 21.7, 12.8); x.stroke();
    // smiling eyes: open, crinkled below
    for (const ex of [12.5, 19.5]) {
      shape(x, c => { c.moveTo(ex - 1.5, 15.4); c.quadraticCurveTo(ex, 13.6, ex + 1.5, 15.4); c.quadraticCurveTo(ex, 16.3, ex - 1.5, 15.4); c.closePath(); }, PAL.white, INK, 0.5);
      shape(x, c => ell(c, ex + 0.1, 15, 0.8, 0.8), '#5f86a3', null); shape(x, c => ell(c, ex + 0.1, 15.05, 0.4, 0.4), '#10202c', null);
      x.strokeStyle = PAL.skinS; x.lineWidth = 0.55; x.beginPath(); x.arc(ex, 15.2, 1.7, Math.PI * 0.2, Math.PI * 0.8); x.stroke();
    }
    blush(x, 10.6, 19); blush(x, 21.4, 19);
    x.strokeStyle = PAL.skinS; x.lineWidth = 0.75; x.beginPath(); x.moveTo(14.9, 18); x.quadraticCurveTo(16, 18.8, 17.1, 18); x.stroke();
    // cheek lines of a big grin
    x.beginPath(); x.moveTo(11.2, 19.6); x.quadraticCurveTo(11.4, 21.4, 12.4, 22); x.moveTo(20.8, 19.6); x.quadraticCurveTo(20.6, 21.4, 19.6, 22); x.stroke();
    if (pose === 'talk') {
      shape(x, c => { c.moveTo(13.2, 20.2); c.quadraticCurveTo(16, 24.6, 18.8, 20.2); c.closePath(); }, PAL.mouth, INK, 0.6);
      shape(x, c => { c.moveTo(13.6, 20.4); c.quadraticCurveTo(16, 21.2, 18.4, 20.4); c.lineTo(18.1, 21.1); c.quadraticCurveTo(16, 21.8, 13.9, 21.1); c.closePath(); }, PAL.white, null);
    } else {
      // wide smile showing the upper teeth
      shape(x, c => { c.moveTo(12.2, 19.9); c.quadraticCurveTo(16, 24.8, 19.8, 19.9); c.quadraticCurveTo(16, 20.6, 12.2, 19.9); c.closePath(); }, PAL.mouth, INK, 0.65);
      shape(x, c => { c.moveTo(12.7, 20.1); c.quadraticCurveTo(16, 20.8, 19.3, 20.1); c.lineTo(18.9, 21.3); c.quadraticCurveTo(16, 22.1, 13.1, 21.3); c.closePath(); }, PAL.white, null);
      shape(x, c => { c.moveTo(14.4, 23); c.quadraticCurveTo(16, 22.2, 17.6, 23); c.quadraticCurveTo(16, 23.9, 14.4, 23); }, '#ff8fa0', null);
    }
  });
}

// ---------------------------------------------------------------- crowd NPCs (16 x 32)
const NPC_STYLES = [
  { shirt: '#4f8fe0', shade: '#3a6fbd', hair: '#5a3a26', strap: '#ffc93a' },
  { shirt: '#ff7a59', shade: '#dc5b3c', hair: '#2a2222', strap: '#2bb3a3' },
  { shirt: '#34b38a', shade: '#248f6c', hair: '#c9985a', strap: '#e8505b' },
  { shirt: '#9a74e8', shade: '#7a57c8', hair: '#3b2a24', strap: '#ffc93a' },
  { shirt: '#ffb238', shade: '#e08f16', hair: '#6d4630', strap: '#4f8fe0' },
];
function npc(style, front, cheer = false, hat = false) {
  const s = NPC_STYLES[style];
  return sprite(16, 32, x => {
    x.translate(0, 2);
    part(x, c => rr(c, 4.8, 21, 3, 7, 1.2), '#454a60', '#343849'); part(x, c => rr(c, 8.2, 21, 3, 7, 1.2), '#454a60', '#343849');
    if (cheer) { limb(x, [[4.5, 15], [2.4, 10], [2.4, 6.5]], 2.6, s.shirt, s.shade); limb(x, [[11.5, 15], [13.6, 10], [13.6, 6.5]], 2.6, s.shirt, s.shade); hand(x, 2.4, 6, 1.3); hand(x, 13.6, 6, 1.3); }
    else { limb(x, [[4.5, 15], [3.6, 21]], 2.6, s.shirt, s.shade); limb(x, [[11.5, 15], [12.4, 21]], 2.6, s.shirt, s.shade); }
    part(x, c => rr(c, 3.6, 12.8, 8.8, 10, 3.2), s.shirt, s.shade);
    part(x, c => ell(c, 8, 8, 4.5, 4.8), PAL.skin, PAL.skinS, [0.9, 0.3]);
    if (front) {
      shape(x, c => { c.moveTo(3.6, 8); c.quadraticCurveTo(3.6, 2.4, 8, 2.9); c.quadraticCurveTo(12.4, 2.4, 12.4, 8); c.quadraticCurveTo(9, 5, 3.6, 8); c.closePath(); }, s.hair);
      if (cheer) { eyeArc(x, 6.3, 8.2, true); eyeArc(x, 9.7, 8.2, true); shape(x, c => { c.moveTo(6.5, 10.1); c.quadraticCurveTo(8, 12.6, 9.5, 10.1); c.closePath(); }, PAL.mouth, INK, 0.45); }
      else { shape(x, c => ell(c, 6.3, 8.4, 0.6, 0.8), INK, null); shape(x, c => ell(c, 9.7, 8.4, 0.6, 0.8), INK, null); }
      badge(x, 8, 17.6, s.strap);
    } else { shape(x, c => ell(c, 8, 7.2, 4.7, 4.6), s.hair); x.strokeStyle = s.strap; x.lineWidth = 0.6; x.beginPath(); x.moveTo(5.8, 12.4); x.quadraticCurveTo(8, 13.8, 10.2, 12.4); x.stroke(); }
    if (hat) shape(x, c => { c.moveTo(5.4, 4.4); c.lineTo(8, -2); c.lineTo(10.6, 4.4); c.closePath(); }, ['#ff7aa2', '#6fc8f0', '#ffcf4a', '#8bd98b', '#c59bff'][style], INK, 0.55);
  }, 6);
}

// ---------------------------------------------------------------- collectibles
function leadCoin() {
  return sprite(20, 20, x => {
    shape(x, c => ell(c, 10, 10.6, 8.8, 8.8), '#c9781b', INK, 1.1);          // coin edge (thickness)
    const g = x.createLinearGradient(0, 1, 0, 18); g.addColorStop(0, '#fff09a'); g.addColorStop(0.55, '#ffcc3a'); g.addColorStop(1, '#f5a21f');
    shape(x, c => ell(c, 10, 9.6, 8.6, 8.6), g, INK, 1.1);
    shape(x, c => ell(c, 10, 9.6, 6.5, 6.5), null, 'rgba(190,110,20,0.55)', 0.8);
    // green contact pictogram
    shape(x, c => ell(c, 10, 7.1, 2.2, 2.2), '#23945a', '#11643a', 0.5);
    shape(x, c => { c.moveTo(5.6, 14); c.quadraticCurveTo(6, 10, 10, 10); c.quadraticCurveTo(14, 10, 14.4, 14); c.closePath(); }, '#23945a', '#11643a', 0.5);
    x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 1.1; x.beginPath(); x.arc(10, 9.6, 7.2, Math.PI * 1.08, Math.PI * 1.42); x.stroke();
    shape(x, c => ell(c, 5.2, 5.4, 0.9, 0.9), '#fff', null);
  });
}
function poop(f = 0) {
  return sprite(22, 21, x => {
    const B = '#9a5f36', S = '#6d3f22';
    part(x, c => ell(c, 11, 16, 9.6, 4.1), B, S, [1.2, 1]);
    part(x, c => ell(c, 11, 11.3, 7.2, 3.6), B, S, [1, 0.9]);
    part(x, c => ell(c, 11, 7.2, 4.8, 3), B, S, [0.8, 0.7]);
    part(x, c => { c.moveTo(9.4, 5); c.quadraticCurveTo(11.4, 0.4, 13.6, 1.6); c.quadraticCurveTo(12.4, 3.4, 13.1, 5.2); c.closePath(); }, B, S, [0.4, 0.4]);
    x.strokeStyle = 'rgba(255,220,180,0.55)'; x.lineWidth = 0.7;
    [[11, 14.8, 6.5], [11, 10.3, 4.8], [11, 6.4, 3]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a - 1, b, r * 0.8, Math.PI * 1.15, Math.PI * 1.5); x.stroke(); });
    // cheeky, smug face
    for (const ex of [7.9, 14.1]) { shape(x, c => ell(c, ex, 11.3, 2, 2.2), PAL.white, INK, 0.55); shape(x, c => ell(c, ex + 0.5 + f * 0.6, 11.7, 1, 1.15), INK, null); shape(x, c => ell(c, ex + 0.9 + f * 0.6, 11.1, 0.35, 0.35), '#fff', null); }
    x.strokeStyle = INK; x.lineWidth = 0.6; x.beginPath(); x.moveTo(5.8, 8.4); x.lineTo(9.4, 9); x.moveTo(16.2, 8.4); x.lineTo(12.6, 9); x.stroke();
    shape(x, c => { c.moveTo(8.2, 15); c.quadraticCurveTo(11, 18.8, 13.8, 15); c.closePath(); }, '#4d2616', INK, 0.55);
    shape(x, c => ell(c, 11, 16.8, 1.4, 0.75), '#ff8c9a', null);
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
    part(x, c => heartPath(c, 10, 9, 8.2), '#ff5c7f', '#d8295a', [1.3, 1.1], INK, 1.1);
    shape(x, c => ell(c, 6.2, 5.8, 2.1, 1.25, -0.6), 'rgba(255,255,255,0.85)', null);
    shape(x, c => ell(c, 9, 4.6, 0.6, 0.6), 'rgba(255,255,255,0.85)', null);
  });
}

// ---------------------------------------------------------------- expo scenery
const BRANDS = [
  { name: 'LEAD LAB', panel: '#ff7a59', dark: '#c84f35', fascia: '#fff6ea', text: '#c84f35', icon: 'chart' },
  { name: 'CRM+', panel: '#2bb3a3', dark: '#1a8579', fascia: '#1d2a3f', text: '#7ff0de', icon: 'person' },
  { name: 'ЭКСПО', panel: '#8a6cf0', dark: '#6247c4', fascia: '#fff6ea', text: '#6247c4', icon: 'star' },
  { name: 'PROMO', panel: '#ffc43d', dark: '#e0961a', fascia: '#1d2a3f', text: '#ffd86b', icon: 'mega' },
  { name: 'B2B HUB', panel: '#4a9dff', dark: '#2f74cf', fascia: '#fff6ea', text: '#2f74cf', icon: 'chart' },
  { name: 'EVENT', panel: '#ff6f9f', dark: '#d44678', fascia: '#1d2a3f', text: '#ffb3cc', icon: 'star' },
];
function brandIcon(x, kind, cx, cy, s, col) {
  x.fillStyle = col; x.strokeStyle = col; x.lineWidth = s * 0.22;
  if (kind === 'chart') { [[-1, 0.5], [0, -0.1], [1, -0.8]].forEach(([dx, h]) => { x.beginPath(); rr(x, cx + dx * s * 0.7 - s * 0.25, cy + h * s, s * 0.5, s * (1 - h), s * 0.12); x.fill(); }); }
  else if (kind === 'person') { x.beginPath(); ell(x, cx, cy - s * 0.35, s * 0.38, s * 0.38); x.fill(); x.beginPath(); x.moveTo(cx - s * 0.75, cy + s); x.quadraticCurveTo(cx, cy - s * 0.1, cx + s * 0.75, cy + s); x.closePath(); x.fill(); }
  else if (kind === 'star') { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.45 : s; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); x.fill(); }
  else { x.beginPath(); x.moveTo(cx - s * 0.8, cy - s * 0.3); x.lineTo(cx + s * 0.6, cy - s * 0.9); x.lineTo(cx + s * 0.6, cy + s * 0.9); x.lineTo(cx - s * 0.8, cy + s * 0.3); x.closePath(); x.fill(); }
}
function fitText(x, text, maxW, size, weight = 900) {
  let fs = size; x.font = `${weight} ${fs}px ${FONT_ART}`;
  while (x.measureText(text).width > maxW && fs > 3) { fs -= 0.25; x.font = `${weight} ${fs}px ${FONT_ART}`; }
  return fs;
}
// front face of a booth block (faces the camera): 85 x 115 logical
function boothFace(b) {
  return sprite(85, 115, x => {
    const W = 85, H = 115;
    // back panel
    part(x, c => rr(c, 1, 14, W - 2, H - 15, 3), b.panel, b.dark, [2.4, 0], INK, 1.4);
    // fascia with the brand name
    part(x, c => rr(c, 0, 1, W, 17, 3), b.fascia, b.fascia === '#fff6ea' ? '#e6d8c6' : '#131c2c', [0, 2], INK, 1.4);
    x.fillStyle = b.text; x.textAlign = 'center'; x.textBaseline = 'middle';
    fitText(x, b.name, W - 12, 11); x.fillText(b.name, W / 2, 10.2);
    // big screen
    part(x, c => rr(c, 10, 24, W - 20, 36, 3), '#1d2a3f', '#141d2d', [0, 0], INK, 1.2);
    const g = x.createLinearGradient(0, 27, 0, 57); g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0.02)');
    x.fillStyle = g; x.beginPath(); rr(x, 13, 27, W - 26, 30, 2); x.fill();
    brandIcon(x, b.icon, W / 2, 42, 9, b.panel);
    // decorative stripe
    x.fillStyle = 'rgba(255,255,255,0.28)'; x.beginPath(); rr(x, 8, 66, W - 16, 3, 1.5); x.fill();
    // counter
    part(x, c => rr(c, 6, 78, W - 12, 34, 3), '#fff6ea', '#e1d2bf', [2, 0], INK, 1.3);
    part(x, c => rr(c, 4, 74, W - 8, 7, 2.5), '#ffffff', '#e8dccd', [0, 1], INK, 1.2);
    shape(x, c => ell(c, W / 2, 95, 9, 9), b.panel, INK, 1);
    brandIcon(x, b.icon, W / 2, 95, 5, '#fff6ea');
    // flyers on the counter
    shape(x, c => rr(c, 12, 69, 9, 5.6, 1), '#ffffff', INK, 0.7); shape(x, c => rr(c, 24, 70.4, 8, 4.2, 1), b.panel, INK, 0.7);
  }, 3);
}
// aisle-facing side of a booth block: 150 x 66 logical (5.2 x 2.3 world units)
function boothSide(b) {
  return sprite(150, 66, x => {
    const W = 150, H = 66;
    x.fillStyle = b.panel; x.fillRect(0, 0, W, H);
    x.fillStyle = b.dark; x.fillRect(0, 0, 4, H); x.fillRect(W - 4, 0, 4, H);
    x.fillStyle = b.fascia; x.fillRect(0, 0, W, 13);
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, 13, W, 1.5);
    x.fillStyle = b.text; x.textAlign = 'center'; x.textBaseline = 'middle';
    fitText(x, b.name, 70, 10); x.fillText(b.name, W / 2, 7);
    // wall screen + brand bubble
    shape(x, c => rr(c, 18, 19, 46, 25, 2.5), '#1d2a3f', INK, 1.2);
    x.fillStyle = 'rgba(255,255,255,0.14)'; x.beginPath(); rr(x, 21, 22, 40, 19, 1.5); x.fill();
    brandIcon(x, b.icon, 41, 31.5, 7, b.panel);
    shape(x, c => ell(c, 108, 30, 13, 13), '#fff6ea', INK, 1.2);
    brandIcon(x, b.icon, 108, 30, 7.5, b.panel);
    // counter along the aisle
    shape(x, c => rr(c, 10, 47, W - 20, 19, 2), '#fff6ea', INK, 1.2);
    x.fillStyle = '#e6d8c6'; x.fillRect(11, 57, W - 22, 8);
    shape(x, c => rr(c, 8, 45, W - 16, 4, 1.5), '#ffffff', INK, 1);
    x.fillStyle = b.panel; x.beginPath(); rr(x, 60, 51, 30, 4, 2); x.fill();
  }, 3);
}
// fixed pods at the far end, where Timofey and Andrey pop up
function counter(label, panel, dark) {
  return sprite(46, 20, x => {
    part(x, c => rr(c, 1.5, 4.5, 43, 15, 2.5), panel, dark, [1.5, 0], INK, 1);
    part(x, c => rr(c, 0.5, 1, 45, 4.6, 2), '#fff6ea', '#e3d4c2', [0, 0.8], INK, 1);
    x.fillStyle = '#fff6ea'; x.textAlign = 'center'; x.textBaseline = 'middle';
    fitText(x, label, 38, 6.4); x.fillText(label, 23, 12.3);
  }, 8);
}
function rollup(b) {
  return sprite(16, 38, x => {
    part(x, c => rr(c, 1.5, 1, 13, 32, 1.5), b.panel, b.dark, [1.4, 0], INK, 0.9);
    shape(x, c => rr(c, 1.5, 1, 13, 7, 1.5), b.fascia, INK, 0.9);
    x.fillStyle = b.text; x.textAlign = 'center'; x.textBaseline = 'middle'; fitText(x, b.name, 11, 4); x.fillText(b.name, 8, 4.6);
    shape(x, c => ell(c, 8, 15, 4, 4), '#fff6ea', null); brandIcon(x, b.icon, 8, 15, 2.6, b.panel);
    x.fillStyle = 'rgba(255,255,255,0.8)'; [22, 24.6, 27.2].forEach((y, i) => { x.beginPath(); rr(x, 4, y, 8 - i * 1.6, 1.2, 0.6); x.fill(); });
    shape(x, c => rr(c, 2.5, 33.2, 11, 2.6, 1.2), '#8a8298', INK, 0.8);
  }, 6);
}
function hangingSign(text, bg, fg) {
  return sprite(100, 30, x => {
    x.strokeStyle = '#3c3550'; x.lineWidth = 1; x.beginPath(); x.moveTo(20, 0); x.lineTo(20, 5); x.moveTo(80, 0); x.lineTo(80, 5); x.stroke();
    part(x, c => rr(c, 2, 5, 96, 23, 4), bg, 'rgba(0,0,0,0.18)', [0, 2.4], INK, 1.4);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    fitText(x, text, 84, 13); x.fillText(text, 50, 16.4);
  }, 4);
}

// ---------------------------------------------------------------- small UI icons
function icon(w, h, draw) { return sprite(w, h, draw, 12); }
const ICONS = {
  heart: () => icon(20, 18, x => part(x, c => heartPath(c, 10, 9, 8.2), '#ff5c7f', '#d8295a', [1.3, 1.1], null)),
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
  A.booths = BRANDS.map(boothFace);
  A.boothSides = BRANDS.map(boothSide);
  A.rollups = BRANDS.map(rollup);
  A.signs = [hangingSign('ЗАЛ A', '#fff6ea', '#2f3f63'), hangingSign('РЕГИСТРАЦИЯ →', '#2bb3a3', '#ffffff'), hangingSign('EXPO', '#ff7a59', '#ffffff'), hangingSign('← СТЕНДЫ 1–40', '#1d2a3f', '#ffd35a')];
  A.counterL = counter('ТИМОФЕЙ', '#e8505b', '#b8323f'); A.counterR = counter('АНДРЕЙ', '#4a9dff', '#2f74cf');
  A.icons = {}; for (const k in ICONS) A.icons[k] = ICONS[k]();
  return A;
}
