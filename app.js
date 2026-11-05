/* 雪の夜の窓 — snowy night window pixel art
 * すべての絵はコードで生成しています（画像素材なし）。
 * 低解像度のキャンバス（横 約160px）に描き、整数倍で拡大表示します。
 */
'use strict';
(() => {
  const stage = document.getElementById('stage');
  const screenEl = document.getElementById('screen');
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');

  const TARGET_W = 160;      // 横方向のドット数の目安
  const PHONE_RATIO = 9 / 19.5; // PC などで表示するときのスマホ比率

  // ------------------------------------------------------------ utils
  const CC = {};
  const C = (h) => CC[h] || (CC[h] = [
    parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
  ]);
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 1枚の静的レイヤー（ピクセルバッファ）
  class Layer {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
    px(x, y, c, a) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      if (typeof c === 'string') c = C(c);
      const i = (y * this.w + x) * 4, d = this.d;
      if (a === undefined || a >= 1) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; return; }
      if (a <= 0) return;
      const da = d[i + 3] / 255, oa = a + da * (1 - a);
      d[i] = (c[0] * a + d[i] * da * (1 - a)) / oa;
      d[i + 1] = (c[1] * a + d[i + 1] * da * (1 - a)) / oa;
      d[i + 2] = (c[2] * a + d[i + 2] * da * (1 - a)) / oa;
      d[i + 3] = oa * 255;
    }
    rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, a); }
    clear(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.d[(y * this.w + x) * 4 + 3] = 0;
    }
    get(x, y) {
      const i = (y * this.w + x) * 4;
      return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
    }
    canvas() {
      const c = document.createElement('canvas');
      c.width = this.w; c.height = this.h;
      c.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
      return c;
    }
  }

  // ディザ付き縦グラデーション
  function vgrad(L, x0, x1, y0, y1, stops) {
    const cs = stops.map(C), n = cs.length - 1;
    for (let y = y0; y < y1; y++) {
      const p = clamp((y - y0) / Math.max(1, y1 - y0 - 1), 0, 1) * n;
      const i = Math.min(n - 1, Math.floor(p)), f = p - i;
      for (let x = x0; x < x1; x++) L.px(x, y, f > bay(x, y) ? cs[i + 1] : cs[i]);
    }
  }

  function sprite(L, rows, map, x, y) {
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const ch = rows[r][c];
        if (ch !== '.' && map[ch]) L.px(x + c, y + r, map[ch]);
      }
    }
  }

  function mix(a, b, t) {
    const A = C(a), B = C(b);
    return [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)];
  }

  // ------------------------------------------------------------ sprites
  const PLANT = [
    '....g....',
    '..g.G.g..',
    '.gG.G.Gg.',
    'gGG.GgGG.',
    '.gGgGGg..',
    '..gGGg...',
    '...GG....',
    'rrrrrrrrr',
    '.ppppppp.',
    '.pqppppp.',
    '..ppppp..',
    '..ppppp..',
  ];
  const PLANT_MAP = { g: '#3f6a44', G: '#679a5a', r: '#b86a44', p: '#8f4f36', q: '#a65d40' };

  const MUG = [
    'lllllll..',
    'lkkkkkl..',
    'wwwwwwwhh',
    'rrrrrrr.h',
    'wwwwwww.h',
    'wwwwwwwhh',
    '.sssss...',
  ];
  const MUG_MAP = { l: '#efe4d0', k: '#4a2c1e', w: '#cdbba0', h: '#b5a389', r: '#a8505a', s: '#6e5f50' };

  const CANDLE = [
    '..k..',
    '.ccc.',
    '.cCc.',
    '.ccc.',
    '.ccc.',
    '.ccc.',
    'bbbbb',
    '.bbb.',
  ];
  const CANDLE_MAP = { k: '#2a1a12', c: '#e6dac2', C: '#fbf4e4', b: '#9a8656' };

  const CAT = [
    '...#.....#...',
    '..##.....##..',
    '..###...###..',
    '..#########..',
    '.###########.',
    '.###########.',
    '.###########.',
    '..#########..',
    '...#######...',
    '..#########..',
    '.###########.',
    '.###########.',
    '#############',
    '#############',
    '#############',
    '#############',
    '.###########.',
    '..#########..',
  ];
  const CAT_TWITCH = CAT.slice();
  CAT_TWITCH[0] = '...#.........';
  CAT_TWITCH[1] = '..##......##.';
  CAT_TWITCH[2] = '..###...####.';

  function catCanvas(rows) {
    const w = rows[0].length, h = rows.length;
    const L = new Layer(w, h);
    const on = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] === '#';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      let c = '#16121c';
      if (!on(x, y - 1)) c = '#4b5282';
      else if (!on(x - 1, y) || !on(x + 1, y)) c = y < 9 ? '#353a62' : '#262a46';
      L.px(x, y, c);
    }
    return L.canvas();
  }

  // ------------------------------------------------------------ settings
  const settings = { snow: 1, sound: 0 };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('snowwin') || '{}')); } catch (e) { /* noop */ }
  settings.sound = 0; // 音はユーザー操作で開始する必要があるので毎回 OFF から
  const save = () => { try { localStorage.setItem('snowwin', JSON.stringify({ snow: settings.snow })); } catch (e) { /* noop */ } };

  // ------------------------------------------------------------ scene build
  let W = 0, H = 0, S = null;

  function build() {
    const R = rng(20261105);
    const s = {};
    // 一点透視: 壁面(z=1)上の座標 (x, y) を奥行き z の位置へ投影する
    const VPx = W / 2, VPy = Math.round(H * 0.55);
    const ZW = 1.12, ZL = 0.92; // 窓ガラスの奥行き / 窓台の手前の縁
    const PR = (x, y, z) => [VPx + (x - VPx) / z, VPy + (y - VPy) / z];
    const L = Math.round(W * 0.05), RW = W - L; // 奥の壁の左右の端
    const ceilY = Math.round(H * 0.03), floorY = Math.round(H * 0.87);
    const oX = Math.round(W * 0.11);
    const O = { x0: oX, x1: W - oX, y0: Math.round(H * 0.075), y1: Math.round(H * 0.72) }; // 壁の開口部
    const F = Math.max(3, Math.round(W / 42));
    const tl = PR(O.x0, O.y0, ZW), br = PR(O.x1, O.y1, ZW);
    const wx0 = Math.round(tl[0]);
    const win = { x0: wx0, x1: W - wx0, y0: Math.round(tl[1]), y1: Math.round(br[1]) };
    const g = { x0: win.x0 + F, x1: win.x1 - F, y0: win.y0 + F, y1: win.y1 - F };
    g.w = g.x1 - g.x0; g.h = g.y1 - g.y0;
    const mw = 3;
    const mx = Math.round((g.x0 + g.x1) / 2 - mw / 2);
    const ty = g.y0 + Math.round(g.h * 0.27);
    const panes = [
      { x0: g.x0, x1: mx, y0: g.y0, y1: ty },
      { x0: mx + mw, x1: g.x1, y0: g.y0, y1: ty },
      { x0: g.x0, x1: mx, y0: ty + mw, y1: g.y1 },
      { x0: mx + mw, x1: g.x1, y0: ty + mw, y1: g.y1 },
    ];
    const inPane = (x, y) => panes.some((p) => x >= p.x0 && x < p.x1 && y >= p.y0 && y < p.y1);
    const baseY = g.y1 - Math.round(g.h * 0.16);
    Object.assign(s, { F, win, g, mx, mw, ty, panes, baseY });

    const snowcap = (L, x, y, w, c1, c2) => {
      L.rect(x, y, w, 1, c1);
      for (let i = 0; i < w; i++) if (R() < 0.5) L.px(x + i, y + 1, c2);
    };

    // ---------- sky
    const sky = new Layer(W, H);
    vgrad(sky, g.x0, g.x1, g.y0, baseY + 1,
      ['#05061a', '#090b28', '#10123a', '#1a1848', '#2a2254', '#3b2c5c']);

    const moon = {
      x: Math.round(g.x0 + g.w * 0.75),
      y: Math.round(g.y0 + (ty - g.y0) * 0.5),
      r: Math.max(4, Math.round(g.w * 0.045)),
    };
    for (let y = moon.y - moon.r - 10; y <= moon.y + moon.r + 10; y++) {
      for (let x = moon.x - moon.r - 10; x <= moon.x + moon.r + 10; x++) {
        const dx = x - moon.x, dy = y - moon.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < moon.r - 0.3) {
          let c = '#f1ead0';
          if ((dx + dy) / moon.r > 0.5) c = '#ddd3b0';
          sky.px(x, y, c);
        } else if (d < moon.r + 2) sky.px(x, y, '#cdc6e6', 0.2);
        else if (d < moon.r + 5) sky.px(x, y, '#cdc6e6', 0.1);
        else if (d < moon.r + 9) sky.px(x, y, '#cdc6e6', 0.045);
      }
    }
    [[-0.32, -0.22, 0.22], [0.22, 0.28, 0.2], [0.12, -0.45, 0.13], [-0.12, 0.42, 0.11], [0.45, -0.05, 0.1]]
      .forEach(([cx, cy, cr]) => {
        const rr = Math.max(1, cr * moon.r);
        for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
          if (x * x + y * y <= rr * rr) sky.px(moon.x + Math.round(cx * moon.r) + x, moon.y + Math.round(cy * moon.r) + y, '#d4cba8');
        }
      });
    s.moon = moon;

    s.stars = [];
    const nStars = Math.round((g.w * g.h) / 380);
    for (let i = 0; i < nStars; i++) {
      const x = (g.x0 + R() * g.w) | 0;
      const y = (g.y0 + Math.pow(R(), 1.3) * g.h * 0.55) | 0;
      if (Math.hypot(x - moon.x, y - moon.y) < moon.r + 10) continue;
      if (R() < 0.3) s.stars.push({ x, y, ph: R() * 6.28, sp: 0.6 + R() * 2.2, c: R() < 0.25 ? '#ffe7c4' : '#e2e8ff' });
      else sky.px(x, y, R() < 0.4 ? '#8a90c2' : '#4f5490');
    }

    s.clouds = [];
    for (let i = 0; i < 3; i++) {
      const cw = 22 + ((R() * 22) | 0), rows = 3 + ((R() * 2) | 0), parts = [];
      for (let r = 0; r < rows; r++) {
        const k = 1 - Math.abs(r - (rows - 1) * 0.6) / rows;
        const w = Math.round(cw * (0.45 + 0.55 * k) * (0.85 + R() * 0.3));
        parts.push([Math.round((cw - w) / 2 + (R() - 0.5) * 4), r, w]);
      }
      s.clouds.push({ x: g.x0 + R() * g.w, y: Math.round(g.y0 + g.h * (0.04 + R() * 0.28)), w: cw, parts, v: 0.5 + R() * 0.7 });
    }

    // ---------- far city
    const far = new Layer(W, H);
    s.blinkers = [];
    {
      let x = g.x0 - 3, tower = false;
      const t0 = g.y0 + g.h * 0.3, t1 = g.y0 + g.h * 0.58;
      while (x < g.x1 + 3) {
        let w = 7 + ((R() * 14) | 0);
        let top = Math.round(lerp(t0, t1, R()));
        let isTower = false;
        if (!tower && x > g.x0 + g.w * 0.08 && R() < 0.45) {
          isTower = true; tower = true; w = 7; top = Math.round(g.y0 + g.h * 0.2);
        }
        const col = ['#15183a', '#181a3d', '#131634', '#1b1a3b'][(R() * 4) | 0];
        far.rect(x, top, w, baseY - top, col);
        if (!isTower && w > 9 && R() < 0.35) {
          const sw = w - 4 - ((R() * 3) | 0), sh = 3 + ((R() * 5) | 0), sx = x + (((w - sw) / 2) | 0);
          far.rect(sx, top - sh, sw, sh, col);
          snowcap(far, sx, top - sh, sw, '#565d8e', '#3c4272');
        }
        snowcap(far, x, top, w, '#565d8e', '#3c4272');
        for (let wy = top + 3; wy < baseY - 2; wy += 3) {
          for (let wx = x + 1; wx < x + w - 1; wx += 2) {
            if (R() < 0.09) far.px(wx, wy, R() < 0.7 ? '#8a7650' : '#5e6292');
          }
        }
        if (isTower) {
          const ax = x + 3;
          far.rect(ax, top - 8, 1, 8, col);
          far.rect(ax - 1, top - 4, 3, 1, col);
          s.blinkers.push({ x: ax, y: top - 9, ph: R() * 6, sp: 0.55 });
        }
        x += w + (R() < 0.3 ? 1 : 0);
      }
    }

    // ---------- mid city (向かいの建物)
    const mid = new Layer(W, H);
    s.wins = []; s.neons = []; s.chimneys = []; s.shops = [];
    {
      let x = g.x0 - 5;
      const t0 = g.y0 + g.h * 0.44, t1 = g.y0 + g.h * 0.7;
      const neonCols = ['#ff5fa8', '#5fe3ff'];
      const warm = ['#ffd88a', '#f9b768', '#ffe7b0', '#f0a860', '#ffcf7a'];
      while (x < g.x1 + 5) {
        const w = 15 + ((R() * 16) | 0);
        const top = Math.round(lerp(t0, t1, R()));
        const pal = [
          ['#262946', '#30335a', '#1c1e37'],
          ['#2b2645', '#373056', '#201c35'],
          ['#232a44', '#2e3758', '#1a1f35'],
          ['#2e2a3e', '#3a344e', '#211e2e'],
        ][(R() * 4) | 0];
        mid.rect(x, top, w, baseY - top, pal[0]);
        mid.rect(x, top, 1, baseY - top, pal[1]);
        mid.rect(x + w - 1, top, 1, baseY - top, pal[2]);
        // cornice + snow
        mid.rect(x - 1, top, w + 2, 2, pal[2]);
        mid.rect(x - 1, top - 1, w + 2, 1, '#dfe5fa');
        for (let i = -1; i <= w; i++) {
          if (R() < 0.28) mid.px(x + i, top - 2, '#c4cbea');
          if (R() < 0.15) mid.px(x + i, top + 2, '#9aa3cf');
        }

        const shop = R() < 0.62;
        const winTop = top + 5, winBot = baseY - (shop ? 9 : 3);
        const cols = Math.floor((w - 3) / 4);
        const offx = x + Math.floor((w - (cols * 4 - 2)) / 2);
        for (let wy = winTop; wy + 3 <= winBot; wy += 5) {
          for (let c = 0; c < cols; c++) {
            const wx = offx + c * 4;
            mid.rect(wx, wy, 2, 3, '#14162a');
            mid.rect(wx, wy + 3, 2, 1, '#7f88b6');
            s.wins.push({
              x: wx, y: wy, lit: R() < 0.36, col: warm[(R() * warm.length) | 0],
              blind: R() < 0.4, tv: R() < 0.05, ph: R() * 6, next: 0,
            });
          }
        }
        if (shop) {
          const sx = x + 2, sw = w - 4, sy = baseY - 6;
          const awn = ['#7c2f3c', '#2f5f50', '#3d4380', '#80602e'][(R() * 4) | 0];
          const lit = R() < 0.8;
          mid.rect(sx, sy, sw, 6, lit ? '#f2be76' : '#1a1a2c');
          if (lit) {
            mid.rect(sx, sy, sw, 1, '#d99a58');
            for (let i = 0; i < sw; i += 5) mid.rect(sx + i, sy, 1, 6, '#6e4a34');
            const door = sx + Math.floor(sw * (0.25 + R() * 0.5));
            mid.rect(door, sy + 1, 2, 5, '#3c2a26');
            s.shops.push({ x0: sx, x1: sx + sw });
          }
          mid.rect(sx - 1, sy - 2, sw + 2, 2, awn);
          for (let i = 0; i < sw + 2; i += 2) mid.px(sx - 1 + i, sy - 1, mix(awn, '#ffffff', 0.25));
          mid.rect(sx - 1, sy - 3, sw + 2, 1, '#e3e9fb');
          if (s.neons.length < 2 && x > g.x0 + 4 && x + w < g.x1 - 2 && R() < 0.6) {
            const nx = x + w - 4, ny = sy - 14;
            mid.rect(nx, ny, 3, 10, '#16121e');
            s.neons.push({ x: nx, y: ny, h: 10, col: neonCols[s.neons.length], off: 0 });
          }
        }
        // roof stuff
        const f = R();
        if (f < 0.22 && w >= 16) {
          const tx = x + 3 + ((R() * (w - 10)) | 0);
          mid.rect(tx + 1, top - 4, 1, 3, '#1b1a2c');
          mid.rect(tx + 4, top - 4, 1, 3, '#1b1a2c');
          mid.rect(tx, top - 9, 6, 5, '#3a2c34');
          mid.rect(tx, top - 7, 6, 1, '#2a2028');
          mid.rect(tx, top - 9, 1, 5, '#4a3a42');
          mid.rect(tx + 1, top - 10, 4, 1, '#3a2c34');
          mid.rect(tx + 1, top - 11, 4, 1, '#e3e8fb');
          mid.px(tx, top - 10, '#c9d0ee'); mid.px(tx + 5, top - 10, '#c9d0ee');
        } else if (f < 0.45) {
          const ax = x + 2 + ((R() * (w - 4)) | 0), h = 5 + ((R() * 6) | 0);
          mid.rect(ax, top - 1 - h, 1, h, '#1b1d33');
          mid.rect(ax - 1, top - h + 1, 3, 1, '#1b1d33');
          s.blinkers.push({ x: ax, y: top - 2 - h, ph: R() * 6, sp: 0.7 + R() * 0.5 });
        }
        if (R() < 0.38) {
          const cx = x + w - 5 - ((R() * 4) | 0);
          mid.rect(cx, top - 4, 2, 3, pal[2]);
          mid.rect(cx, top - 5, 2, 1, '#dfe5fa');
          s.chimneys.push({ x: cx, y: top - 6, acc: R() });
        }
        x += w + (R() < 0.25 ? 1 + ((R() * 2) | 0) : 0);
      }
    }

    // ---------- street
    const st = new Layer(W, H);
    const roadY0 = baseY + 4, roadY1 = g.y1 - 7;
    s.roadY0 = roadY0; s.roadY1 = roadY1;
    s.lanes = [roadY0 + 2, roadY0 + Math.max(8, Math.round((roadY1 - roadY0) / 2) + 1)];
    for (let x = g.x0; x < g.x1; x++) {
      st.px(x, baseY, '#e1e7fb');
      st.px(x, baseY + 1, R() < 0.2 ? '#d4dbf3' : '#c3cbe9');
      st.px(x, baseY + 2, '#b3bce0');
      st.px(x, baseY + 3, '#5a6190');
      for (let y = roadY0; y < roadY1; y++) {
        let c = R() < 0.16 ? '#383d62' : '#2c3050';
        if (s.lanes.some((ly) => y === ly + 5) && (x & 7) < 6) c = '#23263f';
        if (y === Math.round((roadY0 + roadY1) / 2) && (x % 8) < 4 && R() < 0.7) c = '#5e5844';
        st.px(x, y, c);
      }
      st.px(x, roadY1, '#6a72a2');
      for (let y = roadY1 + 1; y < g.y1; y++) st.px(x, y, R() < 0.18 ? '#dfe4f8' : '#c9d0ee');
    }
    // shop light spill
    s.shops.forEach((sh) => {
      for (let x = sh.x0 - 2; x < sh.x1 + 2; x++) {
        for (let y = baseY; y < baseY + 3; y++) st.px(x, y, '#f4d29a', 0.4);
        st.px(x, roadY0, '#c89a60', 0.18);
      }
    });
    // street lamps
    s.lamps = [];
    {
      const n = Math.max(2, Math.round(g.w / 46));
      for (let i = 0; i < n; i++) {
        const lx = Math.round(g.x0 + ((i + 0.5) * g.w) / n + (R() - 0.5) * 8);
        for (let dx = -10; dx <= 12; dx++) {
          const k = 1 - Math.abs(dx - 1) / 11;
          if (k <= 0) continue;
          for (let y = baseY; y < baseY + 3; y++) st.px(lx + dx, y, '#f6dcae', k * 0.7);
          for (let y = roadY0; y < roadY0 + 4; y++) st.px(lx + dx, y, '#b98a5e', k * 0.25 * (1 - (y - roadY0) / 4));
        }
        st.rect(lx, baseY - 13, 1, 15, '#121426');
        st.rect(lx - 1, baseY + 1, 3, 1, '#121426');
        st.rect(lx, baseY - 14, 3, 1, '#121426');
        st.rect(lx + 2, baseY - 13, 2, 1, '#ffe7ad');
        st.px(lx + 1, baseY - 15, '#dfe5fa'); st.px(lx + 2, baseY - 15, '#dfe5fa');
        s.lamps.push({ x: lx + 2.5, y: baseY - 12 });
      }
    }

    // ---------- glass frost & reflections
    const fr = new Layer(W, H);
    panes.forEach((p) => {
      const pw = p.x1 - p.x0, ph = p.y1 - p.y0;
      const Rb = Math.min(pw, ph) * (p.y1 === g.y1 ? 0.42 : 0.25), Rt = Math.min(pw, ph) * 0.2;
      for (let y = p.y0; y < p.y1; y++) {
        for (let x = p.x0; x < p.x1; x++) {
          const dbl = Math.hypot(x - p.x0, p.y1 - y), dbr = Math.hypot(p.x1 - x, p.y1 - y);
          const dtl = Math.hypot(x - p.x0, y - p.y0), dtr = Math.hypot(p.x1 - x, y - p.y0);
          let v = Math.max(1 - Math.min(dbl, dbr) / Rb, 1 - Math.min(dtl, dtr) / Rt, 0);
          v = Math.max(v * v, p.y1 === g.y1 ? Math.max(0, 1 - (p.y1 - y) / 5) * 0.55 : 0);
          v += (R() - 0.5) * 0.35;
          if (v > bay(x, y) + 0.12) fr.px(x, y, '#e8eeff', 0.16 + Math.min(v, 1) * 0.32);
        }
      }
      // diagonal reflection lines
      for (let k = 0; k < 2; k++) {
        const off = Math.round(pw * (0.18 + k * 0.12));
        for (let i = 0; i < ph; i++) {
          const x = p.x0 + off + Math.round(i * 0.6) - Math.round(ph * 0.3);
          const y = p.y1 - 1 - i;
          if (x >= p.x0 && x < p.x1) fr.px(x, y, '#ffffff', k ? 0.04 : 0.065);
        }
      }
    });

    // ---------- room (一点透視の部屋)
    const room = new Layer(W, H);
    const FW = W * 1.3; // 奥行き方向のスケール
    const shade = (c, k) => { const a = typeof c === 'string' ? C(c) : c; return [a[0] * k, a[1] * k, a[2] * k]; };
    const crosses = (a, b, n) => Math.floor(a / n) !== Math.floor(b / n);
    const cross = (a, b, q) => (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
    // 凸四角形を塗る（col は色 or (cx,cy)=>色）
    const quad = (pts, col, alpha) => {
      const fn = typeof col === 'function' ? col : () => col;
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
      const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const q = [x + 0.5, y + 0.5];
        let pos = 0, neg = 0;
        for (let i = 0; i < pts.length; i++) {
          const v = cross(pts[i], pts[(i + 1) % pts.length], q);
          if (v > 0) pos++; else if (v < 0) neg++;
        }
        if (pos && neg) continue;
        const c = fn(q[0], q[1]);
        if (c) room.px(x, y, c, alpha);
      }
    };
    // 直方体（見える面だけ描く）
    const box = (b, col) => {
      const { x0, x1, y0, y1, zf, zb } = b;
      if (y0 > VPy) quad([PR(x0, y0, zb), PR(x1, y0, zb), PR(x1, y0, zf), PR(x0, y0, zf)], col.top);
      if (y1 < VPy) quad([PR(x0, y1, zb), PR(x1, y1, zb), PR(x1, y1, zf), PR(x0, y1, zf)], col.side);
      if (VPx < x0) quad([PR(x0, y0, zb), PR(x0, y0, zf), PR(x0, y1, zf), PR(x0, y1, zb)], col.side);
      if (VPx > x1) quad([PR(x1, y0, zb), PR(x1, y0, zf), PR(x1, y1, zf), PR(x1, y1, zb)], col.side);
      const ft = PR(x0, y0, zf)[1];
      const front = typeof col.front === 'function' ? col.front : () => col.front;
      quad([PR(x0, y0, zf), PR(x1, y0, zf), PR(x1, y1, zf), PR(x0, y1, zf)],
        (cx, cy) => (col.edge && cy - ft < 1 ? col.edge : front(cx, cy)));
    };

    const WALL = '#211a2b', WALL_S = '#271f32';
    const ceilC = (cx, cy) => {
      const za = (VPy - ceilY) / (VPy - (cy - 0.5)), zb = (VPy - ceilY) / (VPy - (cy + 0.5));
      return crosses((1 - za) * FW, (1 - zb) * FW, 26) ? '#0d0a11' : '#16111c';
    };
    const floorC = (cx, cy) => {
      const z = (floorY - VPy) / (cy - VPy), xw = VPx + (cx - VPx) * z, dep = (1 - z) * FW;
      // rug
      const rx0 = W * 0.2, rx1 = W * 0.8, rd0 = FW * 0.07;
      if (xw >= rx0 && xw < rx1 && dep >= rd0) {
        const e = Math.min(xw - rx0, rx1 - xw, dep - rd0);
        if (e < 3) return '#c4a270';
        if (e < 4) return '#7a4a52';
        const dm = (Math.abs(xw - W / 2) + Math.abs(dep - FW * 0.3)) % 16;
        return dm < 2 ? '#b8946a' : dm < 5 ? '#7a3f50' : '#5c2f42';
      }
      const xa = VPx + (cx - 0.5 - VPx) * z, xb = VPx + (cx + 0.5 - VPx) * z;
      if (crosses(xa, xb, 9)) return '#1d1311';
      const p = Math.floor(xw / 9);
      const za = (floorY - VPy) / (cy - 0.5 - VPy), zb = (floorY - VPy) / (cy + 0.5 - VPy);
      const off = (((p * 37) % 50) + 50) % 50;
      if (crosses((1 - za) * FW + off, (1 - zb) * FW + off, 50)) return '#21160f';
      const c = ['#3b2721', '#36231d', '#402b23', '#3a2620'][((p % 4) + 4) % 4];
      return shade(c, 0.78 + 0.3 * clamp(dep / (FW * 0.25), 0, 1));
    };
    const backC = (cx, cy) => {
      if (cy >= floorY - 3) return cy < floorY - 2 ? '#3a2e3a' : '#2b2130';
      if (cy < ceilY + 2) return cy < ceilY + 1 ? '#352b3d' : '#2a2132';
      return Math.floor(cx) % 7 === 0 ? WALL_S : WALL;
    };
    const sideC = (cx, cy) => {
      const left = cx < VPx;
      const zOf = (xx) => (left ? (VPx - L) / (VPx - xx) : (RW - VPx) / (xx - VPx));
      const z = zOf(cx), yw = VPy + (cy - VPy) * z;
      if (yw < ceilY) return ceilC(cx, cy);
      if (yw >= floorY) return floorC(cx, cy);
      const k = 0.72;
      if (Math.abs(cx - (left ? L : RW)) < 1) return '#120d17';
      if (yw >= floorY - 3) return shade(yw < floorY - 2 ? '#3a2e3a' : '#2b2130', k);
      if (yw < ceilY + 2) return shade(yw < ceilY + 1 ? '#352b3d' : '#2a2132', k);
      if (crosses((1 - zOf(cx - 0.5)) * FW, (1 - zOf(cx + 0.5)) * FW, 7)) return shade(WALL_S, k);
      return shade(WALL, k);
    };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (x >= win.x0 && x < win.x1 && y >= win.y0 && y < win.y1) continue;
        const cx = x + 0.5, cy = y + 0.5;
        let c;
        if (x >= O.x0 && x < O.x1 && y >= O.y0 && y < O.y1) {
          // 窓まわりの壁の厚み（左右・上の側面と、下の窓台）
          let z = Infinity, face = '';
          if (cx < VPx) { const v = (VPx - O.x0) / (VPx - cx); if (v < z) { z = v; face = 'l'; } }
          if (cx > VPx) { const v = (O.x1 - VPx) / (cx - VPx); if (v < z) { z = v; face = 'r'; } }
          if (cy < VPy) { const v = (VPy - O.y0) / (VPy - cy); if (v < z) { z = v; face = 't'; } }
          if (cy > VPy) { const v = (O.y1 - VPy) / (cy - VPy); if (v < z) { z = v; face = 'b'; } }
          const t = clamp((z - 1) / (ZW - 1), 0, 1);
          if (face === 'l') c = mix('#33293f', '#6a6890', t * t);
          else if (face === 'r') c = mix('#2a2236', '#4c4a72', t * t);
          else if (face === 't') c = mix('#1a1424', '#3a3858', t * t);
          else {
            c = mix('#6a4636', '#8a6c62', t * t);
            if (Math.floor(VPx + (cx - VPx) * z) % 23 === 0) c = shade(c, 0.86);
          }
          if (face !== 'b' && (x === O.x0 || x === O.x1 - 1 || y === O.y0)) c = '#3d3249';
        } else if (cx < L || cx > RW) c = sideC(cx, cy);
        else if (cy < ceilY) c = ceilC(cx, cy);
        else if (cy >= floorY) c = floorC(cx, cy);
        else c = backC(cx, cy);
        room.px(x, y, c);
      }
    }

    // window frame (奥の窓枠)
    for (let y = win.y0; y < win.y1; y++) {
      for (let x = win.x0; x < win.x1; x++) {
        if (inPane(x, y)) { room.clear(x, y); continue; }
        let c = R() < 0.08 ? '#432923' : '#4a2e27';
        if (x === win.x0 || x === win.x1 - 1 || y === win.y0) c = '#2a1917';
        else if (inPane(x, y - 1)) c = '#6e4636';
        else if (inPane(x, y + 1)) c = '#331f1b';
        else if (inPane(x - 1, y) || inPane(x + 1, y)) c = '#5a3a2f';
        room.px(x, y, c);
      }
    }

    // ledge (窓台の手前に張り出した板)
    const seatTop = (cx, cy) => {
      const z = (O.y1 - VPy) / (cy - VPy);
      return Math.floor(VPx + (cx - VPx) * z) % 23 === 0 ? '#5c3c2f' : '#6a4636';
    };
    box({ x0: O.x0 - 3, x1: O.x1 + 3, y0: O.y1, y1: O.y1 + 4, zf: ZL, zb: 1 },
      { top: seatTop, front: '#4a2e26', edge: '#9a6c52', side: '#3a241e' });
    {
      const yb = Math.ceil(PR(O.x0, O.y1 + 4, ZL)[1]);
      for (let i = 0; i < 6; i++) room.rect(O.x0 - 3, yb + i, O.x1 - O.x0 + 6, 1, '#000000', 0.42 * (1 - i / 6));
    }

    // radiator
    {
      const rx0 = O.x0 + 7, rx1 = O.x1 - 7, ry0 = O.y1 + 14, ry1 = Math.min(ry0 + 28, floorY - 6);
      if (ry1 - ry0 > 8) {
        const zf = 0.965;
        quad([PR(rx0 - 2, floorY, 1), PR(rx1 + 2, floorY, 1), PR(rx1 + 2, floorY, 0.93), PR(rx0 - 2, floorY, 0.93)], '#000000', 0.3);
        const foot = { top: '#1c1724', front: '#1c1724', side: '#16121d' };
        box({ x0: rx0 + 3, x1: rx0 + 5, y0: ry1, y1: floorY, zf: 0.972, zb: 0.985 }, foot);
        box({ x0: rx1 - 5, x1: rx1 - 3, y0: ry1, y1: floorY, zf: 0.972, zb: 0.985 }, foot);
        box({ x0: rx0, x1: rx1, y0: ry0, y1: ry1, zf, zb: 1 }, {
          top: '#463e54', side: '#1c1724', edge: '#5a5168',
          front: (cx, cy) => {
            const xw = VPx + (cx - VPx) * zf, yw = VPy + (cy - VPy) * zf;
            if (yw < ry0 + 2.5 || yw > ry1 - 2) return '#363044';
            const m = (((Math.floor(xw - rx0)) % 3) + 3) % 3;
            return m === 2 ? '#130f19' : m === 0 ? '#3a3247' : '#2c2638';
          },
        });
        box({ x0: rx0 - 5, x1: rx0, y0: ry0 + 4, y1: ry0 + 6, zf: 0.975, zb: 0.99 }, { top: '#5a516a', front: '#4a4258', side: '#2c2638' });
      }
    }

    // curtains（壁の手前に吊るされたカーテン）
    {
      const ytop = O.y0 - 5, yt = Math.round(O.y0 + (O.y1 - O.y0) * 0.58), ybot = floorY + 2;
      const T = O.x0 + 4, K = O.x0 - 1, B = O.x0 + 2;
      const cw = (y) => {
        if (y < yt) { const t = (y - ytop) / (yt - ytop); return T + (K - T) * t * t; }
        const t = (y - yt) / Math.max(1, ybot - yt); return K + (B - K) * Math.sqrt(t);
      };
      const TONES = ['#2c1422', '#3d1d2f', '#52283e', '#68344d', '#80465f'];
      for (let y = ytop; y < ybot; y++) {
        const cx = cw(y) + (y > ybot - 3 ? 1 : 0);
        const w = cx - L;
        for (let x = L; x < cx; x++) {
          const u = (x - L) / w;
          const fold = Math.sin(u * Math.PI * 5 + 0.4);
          let i = Math.round((fold * 0.5 + 0.5) * 2.6 + u * 1.4);
          if (x >= Math.floor(cx) - 1) i = 4;
          if (y < ytop + 2) i = 0;
          if (y > ybot - 2) i = Math.max(0, i - 1);
          const c = TONES[clamp(i, 0, 4)];
          room.px(x, y, c);
          room.px(W - 1 - x, y, c);
        }
        // contact shadow
        for (let k = 0; k < 2; k++) {
          room.px(Math.ceil(cx) + k, y, '#000000', 0.35 - k * 0.15);
          room.px(W - 1 - Math.ceil(cx) - k, y, '#000000', 0.35 - k * 0.15);
        }
        if (Math.abs(y - yt) <= 1) {
          for (let x = L; x <= cx; x++) {
            const c = y === yt ? '#8a6a34' : '#c09a52';
            room.px(x, y, c); room.px(W - 1 - x, y, c);
          }
        }
      }
      room.rect(Math.round(K) - 1, yt + 2, 1, 3, '#c09a52');
      room.rect(W - Math.round(K), yt + 2, 1, 3, '#c09a52');
    }
    // rod
    {
      const ry = O.y0 - 8;
      room.rect(L + 1, ry, RW - L - 2, 2, '#6a4e36');
      room.rect(L + 1, ry, RW - L - 2, 1, '#9a7652');
      room.rect(L, ry - 1, 3, 4, '#a07c52');
      room.rect(RW - 3, ry - 1, 3, 4, '#a07c52');
      room.rect(L + 5, ry + 2, 1, 2, '#3a2a20');
      room.rect(RW - 6, ry + 2, 1, 2, '#3a2a20');
    }
    // fairy lights
    s.bulbs = [];
    {
      const xa = O.x0 - 3, xb = O.x1 + 3, base = O.y0 - 2, swags = 3, seg = (xb - xa) / swags;
      let i = 0;
      for (let x = xa; x <= xb; x++) {
        const f = ((x - xa) % seg) / seg;
        const y = base + Math.round(6 * 4 * f * (1 - f));
        room.px(x, y, '#120c12');
        if ((x - xa) % 6 === 3) {
          s.bulbs.push({ x, y: y + 1, c: ['#ffcf6b', '#ff8e6e', '#fff0b8', '#ffb35c'][i % 4], ph: R() * 6.28, sp: 0.5 + R() * 1.3 });
          i++;
        }
      }
    }

    // window seat objects（奥から手前の順に置く）
    const ow = O.x1 - O.x0;
    const seat = (xw, z) => PR(xw, O.y1, z).map(Math.round);
    const objShadow = (x, y, w) => { room.rect(x, y, w, 1, '#000000', 0.35); room.rect(x + 1, y + 1, w - 2, 1, '#000000', 0.15); };
    {
      const [x, y] = seat(O.x0 + 5, 1.07);
      objShadow(x + 1, y, PLANT[0].length);
      sprite(room, PLANT, PLANT_MAP, x, y - PLANT.length);
    }
    const [cdx, cdy] = seat(O.x0 + ow * 0.82, 1.06);
    objShadow(cdx - 2, cdy, CANDLE[0].length);
    sprite(room, CANDLE, CANDLE_MAP, cdx - 2, cdy - CANDLE.length);
    s.candle = { x: cdx, y: cdy - CANDLE.length - 1 };
    // books
    box({ x0: O.x0 + 1, x1: O.x0 + 14, y0: O.y1 - 2, y1: O.y1, zf: 0.945, zb: 0.99 },
      { top: '#3f5a7a', front: '#e6dcc4', side: '#2c4058', edge: '#4f6a8a' });
    box({ x0: O.x0 + 2, x1: O.x0 + 12, y0: O.y1 - 4, y1: O.y1 - 2, zf: 0.952, zb: 0.982 },
      { top: '#8a3e3e', front: '#d8ccb0', side: '#5e2a2a', edge: '#a04a48' });
    {
      const [x, y] = seat(O.x0 + ow * 0.62, 0.945);
      objShadow(x - 3, y, MUG[0].length - 1);
      sprite(room, MUG, MUG_MAP, x - 3, y - MUG.length);
      s.mug = { x, y: y - MUG.length - 1 };
    }
    {
      const [x, y] = seat(O.x0 + ow * 0.36, 1.0);
      s.cat = { x: x - 6, y: y - CAT.length, bottom: y - 1 };
      room.rect(x - 7, y, 16, 1, '#000000', 0.3);
    }

    // side table + record player (手前)
    s.record = null;
    {
      const tyT = floorY - 26, tx0 = L - 8, tx1 = L + 44;
      const leg = { top: '#2e1d17', front: '#3e271f', side: '#2a1a15' };
      box({ x0: tx1 - 5, x1: tx1 - 2, y0: tyT + 3, y1: floorY, zf: 0.835, zb: 0.85 }, leg);
      box({ x0: tx0, x1: tx1, y0: tyT, y1: tyT + 3, zf: 0.66, zb: 0.86 }, {
        top: (cx, cy) => {
          const z = (tyT - VPy) / (cy - VPy), xw = VPx + (cx - VPx) * z;
          return Math.floor(xw) % 6 === 0 ? '#4e3226' : '#5a3a2c';
        },
        front: '#3e271f', side: '#30201a', edge: '#7a5440',
      });
      box({ x0: tx1 - 5, x1: tx1 - 2, y0: tyT + 3, y1: floorY, zf: 0.665, zb: 0.68 }, leg);
      const px0 = L + 11, px1 = L + 39, pz0 = 0.70, pz1 = 0.82, pyT = tyT - 4;
      box({ x0: px0, x1: px1, y0: pyT, y1: tyT, zf: pz0, zb: pz1 },
        { top: '#3a3440', front: '#7a5236', side: '#5a3c28', edge: '#a07450' });
      const rcx = px0 + 13, rcz = 0.76, rr = 10.5;
      const label = [];
      const a0 = PR(px0, pyT, pz1), a1 = PR(px1, pyT, pz0);
      for (let y = Math.floor(a0[1]); y <= Math.ceil(a1[1]); y++) {
        for (let x = Math.floor(PR(px0, pyT, pz0)[0]); x <= Math.ceil(a1[0]); x++) {
          const cy = y + 0.5, cx = x + 0.5;
          if (cy <= VPy) continue;
          const z = (pyT - VPy) / (cy - VPy), xw = VPx + (cx - VPx) * z;
          const dx = xw - rcx, dz = (z - rcz) * FW, d = Math.hypot(dx, dz);
          if (d >= rr) continue;
          const a = Math.atan2(dz, dx);
          let c;
          if (d < 1) c = '#d8d8e0';
          else if (d < 3.8) { c = '#b8463e'; label.push({ x, y, a }); }
          else if (Math.abs(a - 2.4) < 0.3 || Math.abs(a + 0.75) < 0.3) c = '#3c3c4a';
          else c = Math.floor(d * 1.3) % 2 ? '#18171d' : '#24232b';
          room.px(x, y, c);
        }
      }
      s.record = { label };
      // tone arm
      const p0 = PR(px1 - 3, pyT - 1, 0.805), p1 = PR(rcx + 7, pyT - 1, 0.735);
      const n = Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]));
      for (let i = 0; i <= n; i++) {
        room.px(lerp(p0[0], p1[0], i / n), lerp(p0[1], p1[1], i / n), '#c8c8d2');
      }
      room.rect(Math.round(p0[0]) - 1, Math.round(p0[1]) - 1, 2, 2, '#8a8a98');
      room.px(Math.round(p1[0]), Math.round(p1[1]), '#e8e8f0');
    }

    // vignette（部屋の隅を暗く）
    {
      const vx = VPx, vy = (O.y0 + O.y1) / 2;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (!room.d[i + 3]) continue;
        const dx = (x - vx) / W, dy = (y - vy) / H;
        const d = Math.sqrt(dx * dx * 1.6 + dy * dy * 1.4);
        const k = 1 - 0.42 * clamp((d - 0.32) / 0.45, 0, 1);
        room.d[i] *= k; room.d[i + 1] *= k; room.d[i + 2] *= k;
      }
    }

    // glow sprite (candle)
    {
      const r = 36, L = new Layer(r * 2 + 1, r * 2 + 1);
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        const d = Math.hypot(x, y * 1.1);
        let a = 0;
        if (d < 4) a = 0.24; else if (d < 9) a = 0.15; else if (d < 16) a = 0.09; else if (d < 25) a = 0.05; else if (d < 36) a = 0.025;
        if (a) L.px(x + r, y + r, '#ff9a50', a);
      }
      s.glowCandle = L.canvas(); s.glowCandleR = r;
    }
    // glow sprite (street lamp)
    {
      const r = 15, L = new Layer(r * 2 + 1, r * 2 + 1);
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        const d = Math.hypot(x, y);
        let a = 0;
        if (d < 3) a = 0.4; else if (d < 6) a = 0.2; else if (d < 10) a = 0.1; else if (d < 15) a = 0.045;
        if (a) L.px(x + r, y + r, '#ffbf6a', a);
      }
      s.glowLamp = L.canvas(); s.glowLampR = r;
    }

    s.L = {
      sky: sky.canvas(), far: far.canvas(), mid: mid.canvas(), street: st.canvas(),
      frost: fr.canvas(), room: room.canvas(),
      cat: catCanvas(CAT), catTwitch: catCanvas(CAT_TWITCH),
    };
    S = s;
  }

  // ------------------------------------------------------------ dynamic state
  const SNOW_LAYERS = [
    { vy: 7, sw: 1.4, wf: 0.35, col: '#6f78aa', warm: '#a4917e', n: 45 },
    { vy: 14, sw: 2.4, wf: 0.6, col: '#bcc5e8', warm: '#f3d9a8', n: 30 },
    { vy: 25, sw: 3.6, wf: 1.0, col: '#f4f6ff', warm: '#ffe8bf', n: 12 },
  ];
  const MODES = [
    { k: 0.45, v: 0.8, wind: 1.5, max: 5 },
    { k: 1, v: 1, wind: 4, max: 7 },
    { k: 2.4, v: 1.45, wind: 15, max: 9 },
  ];
  let flakes = [], stickers = [], steam = [], smoke = [], cars = [], walkers = [];
  let acc = null, wind = 0, gust = 0, t = 0;
  let nextCar = 3, nextWalker = 6, steamAcc = 0, twitchUntil = 0, nextTwitch = 5;

  function layerBottom(l) { return l === 0 ? S.baseY : l === 1 ? S.g.y1 - 5 : S.g.y1; }

  function newFlake(l, spread) {
    const g = S.g;
    const f = {
      l, x: g.x0 + Math.random() * g.w,
      y: spread ? g.y0 + Math.random() * (layerBottom(l) - g.y0) : g.y0 - Math.random() * 12,
      s: 0.7 + Math.random() * 0.6, ph: Math.random() * 6.28, fr: 0.4 + Math.random() * 1.4,
      sz: l === 2 && Math.random() < 0.6 ? 2 : 1, stick: 1e9,
    };
    if (l === 2 && Math.random() < 0.09) f.stick = g.y0 + Math.random() * g.h;
    return f;
  }

  function syncFlakes() {
    const g = S.g, area = (g.w * g.h) / 10000, m = MODES[settings.snow];
    SNOW_LAYERS.forEach((L, l) => {
      const want = Math.round(L.n * area * m.k);
      const have = flakes.filter((f) => f.l === l);
      if (have.length < want) for (let i = have.length; i < want; i++) flakes.push(newFlake(l, true));
      else if (have.length > want) {
        let drop = have.length - want;
        flakes = flakes.filter((f) => !(f.l === l && drop-- > 0));
      }
    });
  }

  function initDynamic() {
    flakes = []; stickers = []; steam = []; smoke = []; cars = []; walkers = [];
    syncFlakes();
    acc = new Float32Array(S.g.w);
    for (let i = 0; i < acc.length; i++) acc[i] = 2 + Math.sin(i * 0.31) * 0.7 + Math.sin(i * 0.09 + 1) * 0.6;
    const t0 = t;
    S.wins.forEach((w) => { w.next = t0 + rand(5, 160); });
  }

  // ------------------------------------------------------------ update
  function update(dt) {
    const g = S.g, m = MODES[settings.snow];
    // wind
    if (Math.random() < dt * 0.04) gust += rand(3, 8) * (settings.snow + 1) * 0.6;
    gust *= Math.exp(-dt * 0.45);
    wind = m.wind * (0.55 + 0.45 * Math.sin(t * 0.05)) + gust;

    // snow
    for (let i = 0; i < flakes.length; i++) {
      let f = flakes[i];
      const L = SNOW_LAYERS[f.l];
      f.y += L.vy * f.s * m.v * dt;
      f.x += (wind * L.wf + Math.sin(t * f.fr + f.ph) * L.sw) * dt;
      if (f.x < g.x0 - 2) f.x += g.w + 4; else if (f.x > g.x1 + 2) f.x -= g.w + 4;
      if (f.y >= f.stick) {
        if (stickers.length < 40) stickers.push({ x: Math.round(f.x), y: Math.round(f.y), life: rand(5, 11), age: 0, big: Math.random() < 0.4 });
        flakes[i] = newFlake(f.l, false);
        continue;
      }
      const ix = Math.round(f.x) - g.x0;
      const bottom = f.l === 2 && ix >= 0 && ix < acc.length ? g.y1 - acc[ix] : layerBottom(f.l);
      if (f.y >= bottom) {
        if (f.l === 2 && ix >= 0 && ix < acc.length) {
          acc[ix] = Math.min(m.max, acc[ix] + 0.12);
          if (ix > 0) acc[ix - 1] = Math.min(m.max, acc[ix - 1] + 0.05);
          if (ix < acc.length - 1) acc[ix + 1] = Math.min(m.max, acc[ix + 1] + 0.05);
        }
        flakes[i] = newFlake(f.l, false);
      }
    }
    // let the sill snow settle a bit
    for (let k = 0; k < 6; k++) {
      const i = (Math.random() * (acc.length - 1)) | 0;
      const d = acc[i] - acc[i + 1];
      if (Math.abs(d) > 1.2) { acc[i] -= d * 0.25; acc[i + 1] += d * 0.25; }
    }
    if (settings.snow === 0) for (let i = 0; i < acc.length; i++) acc[i] = Math.max(1.5, acc[i] - dt * 0.01);

    for (let i = stickers.length - 1; i >= 0; i--) {
      stickers[i].age += dt;
      if (stickers[i].age > stickers[i].life) stickers.splice(i, 1);
    }

    for (const c of S.clouds) {
      c.x += c.v * (1 + wind * 0.05) * dt;
      if (c.x > g.x1 + 6) c.x = g.x0 - c.w - 6;
    }

    // windows
    for (const w of S.wins) {
      if (t > w.next) {
        if (Math.random() < 0.45) w.lit = !w.lit;
        w.next = t + rand(20, 150);
      }
    }
    // neon
    for (const n of S.neons) if (t > n.off && Math.random() < dt * 0.07) n.off = t + rand(0.05, 0.5);

    // chimney smoke
    for (const c of S.chimneys) {
      c.acc += dt;
      if (c.acc > 0.7) { c.acc = 0; smoke.push({ x: c.x + 0.5 + Math.random(), y: c.y, age: 0, life: rand(3, 5) }); }
    }
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i]; p.age += dt;
      p.y -= 3.2 * dt; p.x += (wind * 0.35 + 0.8) * dt;
      if (p.age > p.life) smoke.splice(i, 1);
    }

    // cars
    if (t > nextCar) {
      const lane = Math.random() < 0.5 ? 0 : 1, dir = lane === 0 ? 1 : -1;
      cars.push({
        x: dir > 0 ? g.x0 - 30 : g.x1 + 30, y: S.lanes[lane], dir, v: rand(20, 32),
        col: pick(['#7a3b3b', '#3b5a7a', '#c9c2b0', '#4a6a4f', '#6b5a8a', '#2a2d40', '#9a7a3a']),
      });
      nextCar = t + rand(6, 18) / (settings.snow === 2 ? 1.5 : 1);
    }
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i]; c.x += c.v * c.dir * dt;
      if ((c.dir > 0 && c.x > g.x1 + 40) || (c.dir < 0 && c.x < g.x0 - 40)) cars.splice(i, 1);
    }
    // walkers
    if (t > nextWalker) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      walkers.push({
        x: dir > 0 ? g.x0 - 6 : g.x1 + 6, dir, v: rand(3.5, 6), ph: 0,
        umb: pick(['#b33a4a', '#3a6ab3', '#d8b440', '#34344a', '#7a4ab3', '#3f8a6a']),
        coat: pick(['#3a3550', '#4a2e2e', '#2e3a4a', '#544a3a']),
      });
      nextWalker = t + rand(12, 30);
    }
    for (let i = walkers.length - 1; i >= 0; i--) {
      const p = walkers[i]; p.x += p.v * p.dir * dt; p.ph += dt * p.v * 0.45;
      if (p.x < g.x0 - 12 || p.x > g.x1 + 12) walkers.splice(i, 1);
    }

    // steam
    steamAcc += dt;
    if (steamAcc > 0.45) {
      steamAcc = 0;
      steam.push({ x: S.mug.x + rand(-1.5, 1.5), y: S.mug.y, age: 0, life: rand(2.2, 3.4), ph: Math.random() * 6 });
    }
    for (let i = steam.length - 1; i >= 0; i--) {
      const p = steam[i]; p.age += dt;
      p.y -= 4.5 * dt; p.x += Math.sin(p.age * 2.4 + p.ph) * 2.2 * dt;
      if (p.age > p.life) steam.splice(i, 1);
    }
    // cat
    if (t > nextTwitch) { twitchUntil = t + 0.22; nextTwitch = t + rand(4, 12); if (Math.random() < 0.35) nextTwitch = t + 0.45; }
  }

  // ------------------------------------------------------------ render
  const fill = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  function drawCar(c) {
    const x = Math.round(c.x), y = c.y, d = c.dir;
    const p = (rx, ry, w, h, col) => fill(d > 0 ? x + rx : x + 13 - rx - w, y + ry, w, h, col);
    // headlight beam
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= 16; i++) {
      const spread = Math.floor(i / 6);
      ctx.globalAlpha = 0.22 * (1 - i / 17);
      p(12 + i, 2 - spread, 1, 2 + spread * 2, '#ffe7a0');
    }
    ctx.globalAlpha = 0.35; p(-2, 2, 2, 1, '#ff3030');
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    p(3, -1, 7, 1, '#e8edff');
    p(3, 0, 7, 2, c.col);
    p(4, 1, 2, 1, '#55618f'); p(7, 1, 2, 1, '#55618f');
    p(0, 2, 13, 2, c.col);
    p(0, 4, 13, 1, '#15151f');
    p(1, 2, 11, 1, 'rgba(255,255,255,0.18)');
    p(2, 5, 2, 1, '#0b0b12'); p(9, 5, 2, 1, '#0b0b12');
    p(12, 2, 1, 1, '#fff6c8');
    p(0, 2, 1, 1, '#ff4040');
  }

  function drawWalker(w) {
    const x = Math.round(w.x), fy = S.baseY + 2, step = Math.floor(w.ph * 2) % 2;
    fill(x + (step ? 0 : 1), fy - 1, 1, 2, '#15141f');
    fill(x + (step ? 1 : 0), fy - 1, 1, 1, '#15141f');
    fill(x, fy - 4, 2, 3, w.coat);
    fill(x, fy - 5, 2, 1, '#b58f78');
    fill(x + (w.dir > 0 ? 1 : 0), fy - 7, 1, 2, '#222230');
    fill(x - 2, fy - 8, 6, 1, w.umb);
    fill(x - 1, fy - 9, 4, 1, w.umb);
    fill(x, fy - 10, 2, 1, w.umb);
    fill(x, fy - 11, 2, 1, '#e8edff');
    fill(x - 1, fy - 10, 1, 1, '#c9d0ee');
  }

  function render() {
    const g = S.g, L = S.L;
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(L.sky, 0, 0);

    // stars
    for (const s of S.stars) {
      const b = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
      ctx.globalAlpha = 0.25 + b * 0.75;
      fill(s.x, s.y, 1, 1, s.c);
      if (b > 0.93) {
        ctx.globalAlpha = 0.3;
        fill(s.x - 1, s.y, 3, 1, s.c); fill(s.x, s.y - 1, 1, 3, s.c);
      }
    }
    // clouds
    ctx.globalAlpha = 0.5;
    for (const c of S.clouds) {
      for (const [dx, dy, w] of c.parts) fill(Math.round(c.x + dx), c.y + dy, w, 1, '#24234f');
    }
    ctx.globalAlpha = 1;

    ctx.drawImage(L.far, 0, 0);
    // blinkers
    for (const b of S.blinkers) {
      if (((t * b.sp + b.ph) % 1) < 0.35) {
        fill(b.x, b.y, 1, 1, '#ff4a4a');
        ctx.globalAlpha = 0.25;
        fill(b.x - 1, b.y, 3, 1, '#ff4a4a'); fill(b.x, b.y - 1, 1, 3, '#ff4a4a');
        ctx.globalAlpha = 1;
      }
    }
    drawSnow(0);

    ctx.drawImage(L.mid, 0, 0);
    // lit windows
    for (const w of S.wins) {
      if (!w.lit) continue;
      let c = w.col;
      if (w.tv) c = Math.sin(t * 6 + w.ph) + Math.sin(t * 17 + w.ph * 2) > 0.4 ? '#a9d6ff' : '#6788c8';
      fill(w.x, w.y, 2, 3, c);
      if (w.blind && !w.tv) { ctx.globalAlpha = 0.45; fill(w.x, w.y, 2, 1, '#6a4a3a'); ctx.globalAlpha = 1; }
    }
    // neon
    for (const n of S.neons) {
      if (t < n.off) continue;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.18; fill(n.x - 1, n.y - 1, 5, n.h + 2, n.col);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      fill(n.x, n.y, 3, 1, n.col); fill(n.x, n.y + n.h - 1, 3, 1, n.col);
      fill(n.x, n.y, 1, n.h, n.col); fill(n.x + 2, n.y, 1, n.h, n.col);
      for (let k = 2; k < n.h - 2; k += 2) fill(n.x + 1, n.y + k, 1, 1, '#ffffff');
    }
    // smoke
    for (const p of smoke) {
      const k = p.age / p.life;
      ctx.globalAlpha = 0.42 * (1 - k);
      const sz = k > 0.35 ? 2 : 1;
      fill(Math.round(p.x), Math.round(p.y), sz, sz, '#4c5180');
    }
    ctx.globalAlpha = 1;

    ctx.drawImage(L.street, 0, 0);
    for (const w of walkers) drawWalker(w);
    for (const c of cars) drawCar(c);
    // lamp glow
    ctx.globalCompositeOperation = 'lighter';
    for (const l of S.lamps) {
      ctx.globalAlpha = 0.9 + Math.sin(t * 13 + l.x) * 0.03;
      ctx.drawImage(S.glowLamp, Math.round(l.x - S.glowLampR), Math.round(l.y - S.glowLampR));
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    drawSnow(1);
    drawSnow(2);

    // snow piled on the outside ledge
    for (let i = 0; i < acc.length; i++) {
      const h = Math.round(acc[i]);
      if (h <= 0) continue;
      const x = g.x0 + i;
      fill(x, g.y1 - h, 1, h, '#c9d1f0');
      fill(x, g.y1 - h, 1, 1, '#f2f5ff');
      if (h > 2) fill(x, g.y1 - 1, 1, 1, '#a9b3db');
    }

    ctx.drawImage(L.frost, 0, 0);
    // flakes stuck on the glass
    for (const s of stickers) {
      const a = Math.min(1, s.age * 4) * Math.min(1, (s.life - s.age) / 3);
      ctx.globalAlpha = 0.85 * a;
      fill(s.x, s.y, 1, 1, '#ffffff');
      if (s.big) {
        ctx.globalAlpha = 0.4 * a;
        fill(s.x - 1, s.y, 1, 1, '#ffffff'); fill(s.x + 1, s.y, 1, 1, '#ffffff');
        fill(s.x, s.y - 1, 1, 1, '#ffffff'); fill(s.x, s.y + 1, 1, 1, '#ffffff');
      }
    }
    ctx.globalAlpha = 1;

    // ---- room
    ctx.drawImage(L.room, 0, 0);

    const fl = 0.86 + Math.sin(t * 9.1) * 0.05 + Math.sin(t * 23.7) * 0.04 + Math.random() * 0.05;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fl;
    ctx.drawImage(S.glowCandle, S.candle.x - S.glowCandleR, S.candle.y - S.glowCandleR);
    // fairy lights
    for (const b of S.bulbs) {
      const k = 0.5 + 0.5 * Math.sin(t * b.sp + b.ph);
      if (k > 0.55) {
        ctx.globalAlpha = (k - 0.55) * 0.55;
        fill(b.x - 1, b.y, 3, 1, b.c); fill(b.x, b.y - 1, 1, 3, b.c);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    for (const b of S.bulbs) {
      const k = 0.5 + 0.5 * Math.sin(t * b.sp + b.ph);
      ctx.globalAlpha = 0.45 + k * 0.55;
      fill(b.x, b.y, 1, 1, b.c);
    }
    ctx.globalAlpha = 1;

    // candle flame
    const cx = S.candle.x, cy = S.candle.y;
    const tall = fl > 0.92;
    fill(cx, cy, 1, 1, '#fff3b8');
    fill(cx, cy - 1, 1, 1, '#ffb347');
    if (tall) fill(cx, cy - 2, 1, 1, '#ff8a3a');

    // steam
    for (const p of steam) {
      const k = p.age / p.life;
      ctx.globalAlpha = 0.32 * Math.sin(Math.PI * Math.min(1, k * 1.15));
      fill(Math.round(p.x), Math.round(p.y), 1, 1, '#ddd6ea');
    }
    ctx.globalAlpha = 1;

    // cat
    const cat = S.cat;
    ctx.drawImage(t < twitchUntil ? L.catTwitch : L.cat, cat.x, cat.y);
    {
      const bx = cat.x + 11, by = cat.bottom - 1;
      fill(bx, by, 5, 2, '#16121c');
      fill(bx, by, 5, 1, '#262a46');
      for (let k = 1; k <= 5; k++) {
        const sway = Math.round(Math.sin(t * 1.3 + k * 0.45) * k * 0.32);
        fill(bx + 4 + sway, by - k, 1, 1, k === 5 ? '#4b5282' : '#16121c');
        if (k <= 2) fill(bx + 5 + sway, by - k, 1, 1, '#262a46');
      }
    }

    // record label spinning (33rpm)
    if (S.record) {
      const rot = (t * 3.46) % 6.2832;
      ctx.fillStyle = '#f0dcb0';
      for (const p of S.record.label) {
        const d = (((p.a - rot) % 6.2832) + 6.2832) % 6.2832;
        if (d < 0.8) ctx.fillRect(p.x, p.y, 1, 1);
      }
    }
  }

  function drawSnow(l) {
    const L = SNOW_LAYERS[l], lamps = S.lamps, near = l > 0;
    ctx.fillStyle = L.col;
    for (const f of flakes) {
      if (f.l !== l) continue;
      const x = Math.round(f.x), y = Math.round(f.y);
      let warm = false;
      if (near) {
        for (const p of lamps) {
          const dx = f.x - p.x, dy = f.y - p.y;
          if (dx * dx + dy * dy < 150) { warm = true; break; }
        }
      }
      if (warm) { ctx.fillStyle = L.warm; ctx.fillRect(x, y, f.sz, f.sz); ctx.fillStyle = L.col; }
      else ctx.fillRect(x, y, f.sz, f.sz);
    }
  }

  // ------------------------------------------------------------ layout
  function layout() {
    const vw = stage.clientWidth, vh = stage.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 4);
    let cw, ch, phone = false;
    if (vw / vh > 0.8) {
      phone = true;
      ch = Math.max(240, vh - 56);
      cw = Math.round(ch * PHONE_RATIO);
      if (cw > vw - 40) { cw = vw - 40; ch = Math.round(cw / PHONE_RATIO); }
    } else { cw = vw; ch = vh; }
    screenEl.style.width = cw + 'px';
    screenEl.style.height = ch + 'px';
    screenEl.classList.toggle('phone', phone);

    const dw = cw * dpr, dh = ch * dpr;
    const P = Math.max(1, Math.round(dw / TARGET_W));
    W = Math.ceil(dw / P); H = Math.ceil(dh / P);
    cv.width = W; cv.height = H;
    cv.style.width = (W * P) / dpr + 'px';
    cv.style.height = (H * P) / dpr + 'px';
    cv.style.left = Math.floor((dw - W * P) / 2) / dpr + 'px';
    cv.style.top = Math.floor((dh - H * P) / 2) / dpr + 'px';
    ctx.imageSmoothingEnabled = false;
    build();
    initDynamic();
    render();
  }

  let resizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(layout, 120); });

  // ------------------------------------------------------------ loop
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const ms = now - last;
    if (ms < 1000 / 31) return; // 30fps で十分（電池にやさしい）
    last = now;
    const dt = Math.min(ms / 1000, 0.1);
    t += dt;
    update(dt);
    render();
  }

  // ------------------------------------------------------------ audio (環境音: 風 + レコードのノイズ)
  let audio = null;
  function startAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio) {
      const ac = new AC();
      const sr = ac.sampleRate, len = sr * 6;
      // brown noise (wind)
      const nb = ac.createBuffer(1, len, sr), d = nb.getChannelData(0);
      let v = 0;
      for (let i = 0; i < len; i++) { v = (v + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = v * 3.5; }
      const drift = d[len - 1] - d[0];
      for (let i = 0; i < len; i++) d[i] -= (drift * i) / len;
      const wind = ac.createBufferSource(); wind.buffer = nb; wind.loop = true;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.7;
      const wg = ac.createGain(); wg.gain.value = 0.5;
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.07;
      const lfoG = ac.createGain(); lfoG.gain.value = 0.22;
      lfo.connect(lfoG).connect(wg.gain);
      const lfo2 = ac.createOscillator(); lfo2.frequency.value = 0.031;
      const lfo2G = ac.createGain(); lfo2G.gain.value = 180;
      lfo2.connect(lfo2G).connect(lp.frequency);
      wind.connect(lp).connect(wg);
      // vinyl crackle
      const cb = ac.createBuffer(1, len, sr), cd = cb.getChannelData(0);
      for (let i = 0; i < len; i++) {
        if (Math.random() < 0.00035) {
          const amp = Math.random() * 0.7 + 0.1, n = 20 + ((Math.random() * 60) | 0);
          for (let k = 0; k < n && i + k < len; k++) cd[i + k] += (Math.random() * 2 - 1) * amp * Math.exp(-k / 8);
        }
        cd[i] += (Math.random() * 2 - 1) * 0.004;
      }
      const crackle = ac.createBufferSource(); crackle.buffer = cb; crackle.loop = true;
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
      const cg = ac.createGain(); cg.gain.value = 0.16;
      crackle.connect(hp).connect(cg);
      const master = ac.createGain(); master.gain.value = 0;
      wg.connect(master); cg.connect(master); master.connect(ac.destination);
      wind.start(); crackle.start(); lfo.start(); lfo2.start();
      audio = { ac, master };
    }
    audio.ac.resume();
    const now = audio.ac.currentTime;
    audio.master.gain.cancelScheduledValues(now);
    audio.master.gain.setTargetAtTime(settings.snow === 2 ? 0.75 : 0.5, now, 0.8);
  }
  function stopAudio() {
    if (!audio) return;
    const now = audio.ac.currentTime;
    audio.master.gain.cancelScheduledValues(now);
    audio.master.gain.setTargetAtTime(0, now, 0.3);
  }

  // ------------------------------------------------------------ UI
  const ui = document.getElementById('ui');
  const hint = document.getElementById('hint');
  let hideT = 0;
  const showUI = (on) => {
    ui.classList.toggle('hidden', !on);
    clearTimeout(hideT);
    if (on) hideT = setTimeout(() => showUI(false), 7000);
  };
  const refreshSeg = () => {
    document.querySelectorAll('.seg').forEach((seg) => {
      const key = seg.dataset.key;
      seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.v === settings[key])));
    });
  };
  screenEl.addEventListener('click', (e) => {
    if (ui.contains(e.target)) return;
    hint.classList.add('gone');
    showUI(ui.classList.contains('hidden'));
    requestWakeLock();
  });
  ui.addEventListener('click', (e) => {
    showUI(true);
    const b = e.target.closest('.seg button');
    if (!b) return;
    const key = b.closest('.seg').dataset.key, v = +b.dataset.v;
    settings[key] = v;
    if (key === 'snow') { syncFlakes(); save(); if (settings.sound) startAudio(); }
    if (key === 'sound') { if (v) startAudio(); else stopAudio(); }
    refreshSeg();
  });
  document.getElementById('close').addEventListener('click', (e) => { e.stopPropagation(); showUI(false); });
  const fsBtn = document.getElementById('fs');
  const fsTarget = document.documentElement;
  if (!(fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen)) fsBtn.style.display = 'none';
  fsBtn.addEventListener('click', () => {
    const doc = document;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
    else (fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen).call(fsTarget);
  });
  setTimeout(() => hint.classList.add('gone'), 4000);
  refreshSeg();

  // 画面をつけっぱなしにする（対応ブラウザのみ）
  let wakeLock = null;
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch (e) { /* noop */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { last = performance.now(); requestWakeLock(); }
  });

  // オフラインでも動くように
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && window.self === window.top) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  layout();
  requestAnimationFrame(loop);
  window.__snow = { get S() { return S; }, step: (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) { t += dt; update(dt); } render(); } };
})();
