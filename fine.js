(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const LIGHT = [139, 98, 0];
  const COLOR = {
    gold: '#c29400', yellow: '#f6e040', rim: '#512900', seam: '#7a4806', ink: '#1d1203', smoke: '#685e4c',
  };
  const svg = document.getElementById('fine');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');

  const seated = !/[?&]seat\b/.test(location.search);

  const hash = (i, salt) => {
    let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    return ((h ^ (h >>> 12)) >>> 0) / 4294967296;
  };

  const noise = (x, ch) => {
    const i = Math.floor(x), u = x - i, w = u * u * u * (u * (u * 6 - 15) + 10);
    const a = (hash(i, ch) * 2 - 1) * u, b = (hash(i + 1, ch) * 2 - 1) * (u - 1);
    return (a + (b - a) * w) * 7;
  };

  const smooth = (a, b, x) => {
    const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return u * u * (3 - 2 * u);
  };
  const clamp = (v, m) => Math.max(-m, Math.min(m, v));

  const noise2 = (x, y, ch) => {
    const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j;
    const g = (a, b) => {
      const h = hash(a * 7919 + b, ch) * 6.2832;
      return Math.cos(h) * (u + i - a) + Math.sin(h) * (v + j - b);
    };
    const fu = u * u * u * (u * (u * 6 - 15) + 10), fv = v * v * v * (v * (v * 6 - 15) + 10);
    const g00 = g(i, j), g10 = g(i + 1, j), g01 = g(i, j + 1), g11 = g(i + 1, j + 1);
    const a = g00 + (g10 - g00) * fu, b = g01 + (g11 - g01) * fu;
    return (a + (b - a) * fv) * 1.4;
  };

  const PACE = 12, DRAWINGS = 8, GRAIN = 32, WOBBLE = 2.6, PIECE = 16;
  const wobble = (x, y, k) => {
    const c = 600 + 8 * k, u = x / GRAIN + 31 * hash(k, 1), v = y / GRAIN + 31 * hash(k, 2);
    return [WOBBLE * (noise2(u, v, c) + 0.25 * noise2(2.3 * u, 2.3 * v, c + 1)),
      WOBBLE * (noise2(u + 0.5, v + 0.5, c + 2) + 0.25 * noise2(2.3 * u + 0.5, 2.3 * v + 0.5, c + 3))];
  };

  function outline(d) {
    const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g), out = [];
    let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0;
    const num = () => +tok[i++];
    const line = (X, Y) => {
      const n = Math.max(1, Math.ceil(Math.hypot(X - x, Y - y) / PIECE)), p = u => [x + (X - x) * u, y + (Y - y) * u];
      for (let s = 0; s < n; s++) out.push('C', p((s + 1 / 3) / n), p((s + 2 / 3) / n), p((s + 1) / n));
      x = X;
      y = Y;
    };
    while (i < tok.length) {
      if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
      const rel = cmd === cmd.toLowerCase(), ox = rel ? x : 0, oy = rel ? y : 0;
      switch (cmd.toUpperCase()) {
        case 'M':
          x = sx = ox + num();
          y = sy = oy + num();
          out.push('M', [x, y]);
          cmd = rel ? 'l' : 'L';
          break;
        case 'L': line(ox + num(), oy + num()); break;
        case 'H': line(ox + num(), y); break;
        case 'V': line(x, oy + num()); break;
        case 'C': {
          const c1 = [ox + num(), oy + num()], c2 = [ox + num(), oy + num()];
          x = ox + num();
          y = oy + num();
          out.push('C', c1, c2, [x, y]);
          break;
        }
        case 'Z':
          if (Math.hypot(x - sx, y - sy) > 0.5) line(sx, sy);
          out.push('Z');
          cmd = '';
          break;
        default: i++;
      }
    }
    return out;
  }

  const still = [];
  const boil = (e, d) => {
    const o = outline(d), v = [];
    const at = k => v[k] ??= o.map(q => {
      if (typeof q === 'string') return q;
      const [wx, wy] = wobble(q[0], q[1], k);
      return pt([q[0] + wx, q[1] + wy]);
    }).join(' ');
    still.push({ e, at });
    e.setAttribute('d', at(0));
    return e;
  };

  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  const f = n => Math.round(n * 10) / 10;
  const pt = p => `${f(p[0])} ${f(p[1])}`;
  const C = (c1, c2, p) => `C${pt(c1)} ${pt(c2)} ${pt(p)}`;

  function split(p, u) {
    const l = (a, b) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    const a = l(p[0], p[1]), b = l(p[1], p[2]), c = l(p[2], p[3]), d = l(a, b), e = l(b, c), m = l(d, e);
    return [[p[0], a, d, m], [m, e, c, p[3]]];
  }

  function polyline(pts) {
    const seg = [];
    let L = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay);
      seg.push({ ax, ay, tx: (bx - ax) / l, ty: (by - ay) / l, s0: L, l });
      L += l;
    }
    const project = (x, y, dx, dy) => {
      let s = 0, u = -Infinity;
      for (const q of seg) {
        const det = q.tx * dy - q.ty * dx;
        if (Math.abs(det) < 0.2) continue;
        const rx = x - q.ax, ry = y - q.ay, a = (rx * dy - ry * dx) / det, h = (q.tx * ry - q.ty * rx) / det;
        if (a >= -30 && a <= q.l + 30 && (u === -Infinity || Math.abs(h) < Math.abs(u))) {
          s = q.s0 + Math.max(0, Math.min(q.l, a));
          u = h;
        }
      }
      return { s, u };
    };
    const tangent = (s, r) => {
      let x = 0, y = 0;
      for (const q of seg) {
        const w = Math.min(q.s0 + q.l, s + r) - Math.max(q.s0, s - r);
        if (w > 0) { x += q.tx * w; y += q.ty * w; }
      }
      const n = Math.hypot(x, y) || 1;
      return [x / n, y / n];
    };
    return { L, project, tangent };
  }

  function along(xy, v, sigma) {
    const n = v.length, at = new Float32Array(n + 1), out = new Float32Array(n);
    for (let i = 1; i <= n; i++) {
      const j = i % n;
      at[i] = at[i - 1] + Math.hypot(xy[2 * j] - xy[2 * i - 2], xy[2 * j + 1] - xy[2 * i - 1]);
    }
    const P = at[n];
    for (let i = 0; i < n; i++) {
      let sum = 0, wt = 0;
      for (let j = 0; j < n; j++) {
        let d = Math.abs(at[j] - at[i]);
        d = Math.min(d, P - d);
        if (d > 3 * sigma) continue;
        const w = Math.exp(-0.5 * (d / sigma) ** 2);
        sum += w * v[j];
        wt += w;
      }
      out[i] = sum / wt;
    }
    return out;
  }

  let made = 0;
  function Fire(name, o, layer) {
    const line = polyline(o.root), e = o.energy || 1, H = o.H, ch = 1000 + 16 * made++, [SLIDE, HEAVE] = o.roll;
    const STEP = 6, cells = Math.ceil(line.L / STEP) + 2;
    const sway = new Float32Array(cells), grow = new Float32Array(cells);
    const boilX = new Float32Array(cells), boilY = new Float32Array(cells);
    const slide = new Float32Array(cells), heave = new Float32Array(cells);

    const prep = runs => runs.map(xy => {
      const n = xy.length / 2, s = new Float32Array(n), k = new Float32Array(n), ride = new Float32Array(n);
      const cos = new Float32Array(n), sin = new Float32Array(n), tx = new Float32Array(n), ty = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = xy[2 * i], y = xy[2 * i + 1], a = o.lean ? o.lean(x) : 0;
        cos[i] = Math.cos(a);
        sin[i] = Math.sin(a);
        const q = line.project(x, y, sin[i], -cos[i]);
        s[i] = q.s;
        k[i] = Math.min(1.3, Math.max(0, q.u / H));
        ride[i] = smooth(-1.6, -0.2, q.u / H);
      }
      const rs = along(xy, s, 0.5 * H);
      for (let i = 0; i < n; i++) [tx[i], ty[i]] = line.tangent(rs[i], 120);
      const wob = Array.from({ length: DRAWINGS }, (_, d) => {
        const w = new Float32Array(2 * n);
        for (let i = 0; i < n; i++) [w[2 * i], w[2 * i + 1]] = wobble(xy[2 * i], xy[2 * i + 1], d);
        return w;
      });
      return { xy, s, rs, k, ride, cos, sin, tx, ty, wob, dx: new Float32Array(n), dy: new Float32Array(n) };
    });
    const art = window.FIRE_ART[name], outer = prep(art.outer), inner = prep(art.inner);

    function field(t, env, boil) {
      for (let j = 0; j < cells; j++) {
        const s = j * STEP;
        sway[j] = e * (0.16 * noise(t * 0.8 - s / 700, ch) + 0.12 * noise(t * 1.9 - s / 380, ch + 1) +
          0.04 * noise(t * 4.2 - s / 300, ch + 2));
        grow[j] = e * (0.12 * noise(t * 1.2 - s / 480, ch + 3) + 0.1 * noise(t * 2.3 - s / 260, ch + 4) +
          0.04 * noise(t * 5 - s / 320, ch + 5));
        boilX[j] = e * 6 * noise(t * 2.6 - s / 220, ch + boil);
        boilY[j] = e * 6 * noise(t * 2.9 - s / 220, ch + boil + 1);
        slide[j] = SLIDE * (0.8 * noise(t * 0.55 - s / 900, ch + 10) + 0.35 * noise(t * 1.3 - s / 650, ch + 11));
        heave[j] = HEAVE * (0.8 * noise(t * 0.7 - s / 700, ch + 12) + 0.35 * noise(t * 1.6 - s / 450, ch + 13));
      }
    }

    const HANDLE = 0.3;
    function path(runs, env, drawing) {
      let d = '';
      for (const { xy, s, rs, k, ride, cos, sin, tx, ty, wob, dx: DX, dy: DY } of runs) {
        const W = wob[drawing];
        for (let i = 0; i < s.length; i++) {
          const x = xy[2 * i], y = xy[2 * i + 1], kk = k[i], r = ride[i], kc = Math.min(1, kk);
          let X = x, Y = y;
          const j = s[i] / STEP, j0 = j | 0, w = j - j0, lerp = a => a[j0] + (a[j0 + 1] - a[j0]) * w;
          if (r > 0) {
            const jr = rs[i] / STEP, r0 = jr | 0, wr = jr - r0, at = a => a[r0] + (a[r0 + 1] - a[r0]) * wr;
            const sl = r * at(slide), hv = r * at(heave);
            X += tx[i] * sl + sin[i] * hv;
            Y += ty[i] * sl - cos[i] * hv;
          }
          let g = Math.max(-0.1, Math.min(0.45, lerp(grow) + 0.05)) + env.gain - 1;
          if (env.near) {
            const dx = env.px - x, dy = env.py - y, dist = Math.hypot(dx, dy) || 1;
            const q = Math.max(0, 1 - dist / 480), wake = Math.max(0, 1 - dist / 650);
            const ahead = Math.max(0, (dx * sin[i] - dy * cos[i]) / dist);
            g += 0.7 * q * q;
            const reach = Math.min(dist * 0.8, 0.6 * H) * q * q * kc * ahead;
            const drag = 0.08 * wake * wake * (0.3 + 0.7 * kc);
            X += dx / dist * reach + env.vx * drag;
            Y += dy / dist * reach + env.vy * drag;
          }
          if (kk > 0) {
            const bend = H * kc * (2 - kc), side = bend * 1.15 * clamp(lerp(sway), 0.5);
            const up = H * kc * g, b = Math.min(1, kk * 3);
            X += cos[i] * side + sin[i] * up + b * lerp(boilX) + bend * env.wind;
            Y += sin[i] * side - cos[i] * up + b * lerp(boilY);
          }
          DX[i] = X - x + W[2 * i];
          DY[i] = Y - y + W[2 * i + 1];
        }
        for (let i = 0; i < s.length; i++) {
          let mx = DX[i], my = DY[i];
          const m = i % 3, a = m === 1 ? i - 1 : m === 2 ? i + 1 : i;
          if (a !== i) {
            mx = DX[a] + (mx - DX[a]) * HANDLE;
            my = DY[a] + (my - DY[a]) * HANDLE;
          }
          d += (i === 0 ? 'M' : m === 1 ? 'C' : ' ') + f(xy[2 * i] + mx) + ' ' + f(xy[2 * i + 1] + my);
        }
        d += 'Z';
      }
      return d;
    }

    const defs = svg.querySelector('defs');
    const po = el('path', { id: `${name}-o` }, defs), pi = el('path', { id: `${name}-i` }, defs);
    el('use', { href: `#${name}-o` }, el('clipPath', { id: `${name}-c` }, defs));
    const g = el('g', {}, layer);
    el('use', { href: `#${name}-o`, fill: COLOR.gold }, g);
    const inside = el('g', { 'clip-path': `url(#${name}-c)` }, g);
    const seam = { stroke: COLOR.seam, 'stroke-width': 3.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
    el('use', { href: `#${name}-i`, fill: COLOR.yellow, ...seam }, inside);
    const ps = o.streaks && el('path', { fill: 'none', ...seam }, inside);
    const rim = { fill: 'none', stroke: COLOR.rim, 'stroke-width': 7, 'stroke-linejoin': 'round' };
    el('use', { href: `#${name}-o`, ...rim }, g);
    if (o.base) {
      const [x0] = o.base[0], low = o.base.map(([x, y]) => `${x} ${y + 3.5}`).join('L');
      boil(el('path', {}, el('clipPath', { id: `${name}-b` }, defs)), `M${low}V-2000H${x0}Z`);
      g.setAttribute('clip-path', `url(#${name}-b)`);
      boil(el('path', { ...rim, 'clip-path': `url(#${name}-c)` }, layer), `M${o.base.map(p => p.join(' ')).join('L')}`);
    }
    let flare = 0;

    return {
      flare: () => flare,
      draw(t, env, drawing) {
        field(t, env, 6);
        flare = grow.reduce((a, b) => a + b) / cells;
        po.setAttribute('d', path(outer, env, drawing));
        field(t - 0.08, env, 8);
        pi.setAttribute('d', path(inner, env, drawing));
        if (ps) {
          ps.setAttribute('d', o.streaks.map(([x, y, len], i) => {
            const c = 9000 + i * 4, l = len * (0.85 + 0.12 * noise(t * 2.2, c) + 0.05 * noise(t * 7, c + 1));
            const lean = (env.wind + 0.05 * noise(t * 1.6, c + 2)) * l;
            const [mx, my] = wobble(x, y - l / 2, drawing), [tx, ty] = wobble(x, y - l, drawing);
            return `M${x} ${y}Q${f(x + lean * 0.3 + mx)} ${f(y - l * 0.5 + my)} ${f(x + lean + tx)} ${f(y - l + ty)}`;
          }).join(''));
        }
      },
    };
  }

  for (const p of svg.querySelectorAll('path')) boil(p, p.getAttribute('d'));
  const paint = (parent, art) => {
    for (const [fill, d] of art) boil(el('path', { fill }, parent), d);
    return parent;
  };
  paint(document.getElementById('chair'), window.STILL_ART.chair);
  paint(document.getElementById('mug'), window.STILL_ART.mug);

  const front = document.getElementById('front-fire');
  const banks = [
    Fire('door', { root: [[540, 500], [880, 480]], H: 110, energy: 1.4, roll: [10, 8] },
      document.getElementById('door-fire')),
    Fire('back', {
      root: [[1000, 800], [1060, 700], [1150, 640], [1250, 570], [1450, 520], [6500, 520]],
      H: 170, energy: 1.6, roll: [16, 12],
      base: [[900, 893], [1036, 893], [1072, 894], [1092, 889], [1124, 875], [1119, 905], [1143, 903], [1165, 895],
             [1165, 908], [1191, 907], [1214, 905], [1240, 893], [1236, 907], [1262, 905], [1290, 886], [1284, 906],
             [1318, 904], [1338, 894], [1336, 907], [1372, 906], [1400, 889], [1393, 907], [1430, 905], [1452, 893],
             [1449, 906], [1490, 904], [1521, 887], [1514, 906], [1556, 905], [1580, 894], [1577, 906], [1620, 905],
             [8000, 905]],
    }, document.getElementById('back-fire')),
    Fire('left', {
      root: [[-1600, -2300], [-200, -330], [230, 230], [410, 475], [494, 684], [630, 860], [700, 990], [790, 1200],
             [950, 1480], [1150, 4000]],
      H: 130, lean: () => 0.1, energy: 1.3, roll: [80, 52],
      streaks: [[170, 1050, 150], [205, 1000, 110], [385, 1060, 130], [420, 1030, 90], [460, 1070, 120],
                [530, 1075, 160], [560, 1040, 70]],
    }, front),
    Fire('right', {
      root: [[700, 4000], [900, 1480], [1000, 1280], [1130, 1060], [1303, 900], [1450, 820], [1610, 727],
             [1743, 647], [1863, 553], [1920, 530], [1976, 553], [2096, 647], [2229, 727], [2389, 820], [2536, 900],
             [2709, 1060], [2839, 1280], [2939, 1480], [3139, 4000]],
      H: 120, energy: 1.6, roll: [110, 65],
      lean: x => 0.45 * smooth(1000, 1250, x) * smooth(2840, 2590, x) * (1 - 2 * smooth(1880, 1960, x)),
      streaks: [[1858, 1060, 120], [1880, 1010, 90]],
    }, front),
  ];

  const smokeLayer = document.getElementById('smoke');
  const smokeBody = el('path', { fill: COLOR.smoke, stroke: COLOR.ink, 'stroke-width': 7, 'stroke-linejoin': 'round' },
    smokeLayer);
  const smokeArcs = el('path', { fill: 'none', stroke: COLOR.ink, 'stroke-width': 5, 'stroke-linecap': 'round' },
    smokeLayer);
  const ROWS = [
    { w: 150, sag: 46, lift: 0, drift: -20 },
    { w: 270, sag: 58, lift: 82, drift: -13 },
    { w: 340, sag: 50, lift: 168, drift: -8 },
  ];

  function smoke(t, v, env, drawing) {
    const jot = (k, r, u) => wobble((k + u) * 150 + r * 5000, r * 300 + 40 * u, drawing);
    const base = v.y + 190 * Math.sqrt(v.h / 1080) + 8 * noise(t * 0.7, 7);
    const lo = v.x - 500, hi = v.x + v.w + 500;
    const shove = (x, y) => {
      if (!env.near) return [0, 0, 0];
      const dx = x - env.px, dy = y - env.py, d = Math.hypot(dx, dy) || 1, q = Math.max(0, 1 - d / 560);
      const q2 = q * q;
      return [dx / d * 150 * q2 + env.vx * 0.16 * q2, dy / d * 60 * q2 - 110 * q2 + env.vy * 0.08 * q2, q2];
    };
    const row = r => {
      const { w: W, sag: depth, lift, drift } = ROWS[r], shift = t * drift + r * 61, rowY = base - lift;
      const k0 = Math.floor((lo - shift) / W) - 1, k1 = Math.ceil((hi - shift) / W) + 1;
      const cusp = k => {
        const c = 20000 + k * 48 + r * 16;
        const wob = clamp(W * (0.2 * noise(t * 1.8, c) + 0.05 * noise(t * 4.5, c + 1)), W * 0.36);
        const bob = clamp(10 * noise(t * 2, c + 2) + 4 * noise(t * 5, c + 11), 22);
        const x = k * W + shift + (hash(k, r * 3) - 0.5) * W * 0.2 + wob + env.wind * W * 1.2;
        const y = rowY + (hash(k, r * 3 + 1) - 0.5) * 24 + bob, [sx, sy] = shove(x, y), [jx, jy] = jot(k, r, 0);
        return [x + sx + jx, y + sy + jy];
      };
      const cusps = [];
      for (let k = k0; k <= k1; k++) cusps.push(cusp(k));
      for (let i = 1; i < cusps.length; i++) cusps[i][0] = Math.max(cusps[i][0], cusps[i - 1][0] + W * 0.25);
      const out = [];
      for (let k = k0; k < k1; k++) {
        const p0 = cusps[k - k0], p3 = cusps[k - k0 + 1], c = 20000 + k * 48 + r * 16, w = p3[0] - p0[0];
        const swell = 1 + clamp(0.28 * noise(t * 2.2, c + 3) + 0.08 * noise(t * 5.5, c + 4), 0.5) +
          0.7 * shove((p0[0] + p3[0]) / 2, (p0[1] + p3[1]) / 2)[2];
        const sag = Math.min(w * 0.55, depth * (0.75 + 0.5 * hash(k, r * 3 + 2)) * swell);
        const skew = clamp(0.12 * noise(t * 1.9, c + 5), 0.2);
        const [ax, ay] = jot(k, r, 1 / 3), [bx, by] = jot(k, r, 2 / 3);
        const p1 = [p0[0] + w * (0.04 + skew) + ax, p0[1] + sag + ay];
        const p2 = [p3[0] - w * (0.04 - skew) + bx, p3[1] + sag + by];
        out.push({ k, c, p: [p0, p1, p2, p3] });
      }
      return out;
    };
    const under = row(0);
    smokeBody.setAttribute('d', `M${f(lo)} ${f(v.y - 400)}L${pt(under[0].p[0])}` +
      under.map(a => C(a.p[1], a.p[2], a.p[3])).join('') + `L${f(hi)} ${f(v.y - 400)}Z`);
    let arcs = '';
    for (const r of [1, 2]) {
      for (const a of row(r)) {
        if (hash(a.k, 40 + r) < 0.18) continue;
        const u0 = Math.min(0.2, Math.max(0, 0.06 + 0.07 * noise(t * 1.7, a.c + 7)));
        const u1 = Math.min(1, Math.max(0.8, 0.94 + 0.07 * noise(t * 1.7, a.c + 6)));
        const seg = split(split(a.p, u1)[0], u0 / u1)[1];
        arcs += `M${pt(seg[0])}${C(seg[1], seg[2], seg[3])}`;
      }
    }
    smokeArcs.setAttribute('d', arcs);
  }

  let view;
  function fit() {
    const a = innerWidth / innerHeight, wide = 16 / 9;
    let w, h, cx = 960;
    if (a >= wide) {
      w = 1080 * Math.min(a, 2.4); h = w / a;
    } else {
      w = Math.max(1000, 1080 * a); h = w / a;
      cx += 40 * Math.min(1, (wide - a) / (wide - 1));
    }
    view = { x: cx - w / 2, y: (1080 - h) * (a >= wide ? 0.45 : 0.5), w, h };
    svg.setAttribute('viewBox', `${f(view.x)} ${f(view.y)} ${f(view.w)} ${f(view.h)}`);
  }
  addEventListener('resize', fit);
  fit();

  function Dog(layer) {
    const P = window.DOG_PARTS, defs = svg.querySelector('defs'), HIP = [860, 790];
    const clip = (id, d) => boil(el('path', {}, el('clipPath', { id }, defs)), d);
    paint(el('g', { id: 'dog-art' }, defs), window.STILL_ART.dog);
    const art = (parent, id, d) => {
      el('path', { d, fill: '#fff' }, el('mask', { id }, defs));
      el('use', { href: '#dog-art', mask: `url(#${id})` }, parent);
    };
    const body = el('g', {}, layer);
    const feet = ['foot1', 'foot2'].map(n => {
      const g = el('g', {}, body);
      art(g, `dog-${n}`, P[n].clip);
      return { g, knee: P[n].knee };
    });
    art(body, 'dog-body', P.body.clip);
    const eyes = ['eye_left', 'eye_right'].map(n => {
      const e = P[n], id = `dog-${n}`;
      clip(id, e.socket);
      const g = el('g', { 'clip-path': `url(#${id})` }, body);
      const white = boil(el('path', { fill: '#fbf8f2' }, g), e.socket);
      const look = el('g', {}, g);
      const oval = (o, parent, fill) => el('ellipse',
        { cx: o.cx, cy: o.cy, rx: o.rx, ry: o.ry, transform: `rotate(${o.rot} ${o.cx} ${o.cy})`, ...fill }, parent);
      oval(e.pupil, look, { fill: COLOR.ink });
      oval(e.pupil, el('clipPath', { id: `${id}-p` }, defs));
      const light = oval(e.iris, el('g', { 'clip-path': `url(#${id}-p)` }, look), { fill: `rgb(${LIGHT})` });
      const b = white.getBBox();
      const reach = [Math.max(4, b.width / 2 - e.pupil.rx) + 4, Math.max(4, b.height / 2 - e.pupil.ry) + 4];
      return {
        look, light, iris: e.iris, home: [e.pupil.cx, e.pupil.cy], mid: [b.x + b.width / 2, b.y + b.height / 2], reach,
        at: [0, 0],
      };
    });

    let kickAt = 3 + 5 * Math.random(), watchTill = -1, nextGlance = 0;
    const KICK = 1.4;
    return {
      notice(t) {
        if (t < watchTill || t < nextGlance) return;
        if (Math.random() < 0.65) watchTill = t + 2.5 + 3.5 * Math.random();
        nextGlance = Math.max(t, watchTill) + 2 + 4 * Math.random();
      },
      draw(t, dt, env, drawing, flare) {
        const breath = Math.sin(t * 2 * Math.PI / 3.4);
        const sway = 1.1 * Math.sin(t * 2 * Math.PI / 2.6 + 0.5 * Math.sin(t * 0.37)) + 0.3 * noise(t * 0.6, 31);
        const sx = (1 + 0.004 * breath).toFixed(4), sy = (1 + 0.012 * breath).toFixed(4);
        body.setAttribute('transform',
          `translate(${HIP}) rotate(${sway.toFixed(2)}) scale(${sx} ${sy}) translate(${-HIP[0]} ${-HIP[1]})`);

        if (t > kickAt + KICK) kickAt = t + 3 + 6 * Math.random();
        const u = (t - kickAt) / KICK, fade = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
        feet.forEach(({ g, knee }, i) => {
          const s = Math.sin((t - kickAt) * 2 * Math.PI * 2.3 + i * Math.PI);
          const a = fade * (s < 0 ? 14 * s : 5 * s) + 1.5 * Math.sin(t * 2 * Math.PI * 0.45 + i * 1.3);
          g.setAttribute('transform', `rotate(${f(a)} ${knee[0]} ${knee[1]})`);
        });

        const lit = 0.75 * clamp(flare / 0.15, 2.5) + 0.35 * noise(t * 8.3, 71);
        const grow = 1 + clamp(0.05 * lit, 0.12), bright = 1 + clamp(0.12 * lit, 0.25) + 0.5 * (env.gain - 1);
        const glow = `rgb(${LIGHT.map(c => Math.min(255, Math.round(c * bright)))})`;
        const watching = env.near && t < watchTill;
        for (const e of eyes) {
          let to = [0, 0];
          if (watching) {
            const dx = env.px - e.mid[0], dy = env.py - e.mid[1], d = Math.hypot(dx, dy) || 1, s = Math.min(1, d / 260);
            to = [e.mid[0] + dx / d * e.reach[0] * s - e.home[0], e.mid[1] + dy / d * e.reach[1] * s - e.home[1]];
          }
          const k = Math.min(1, dt * 14);
          e.at = [e.at[0] + (to[0] - e.at[0]) * k, e.at[1] + (to[1] - e.at[1]) * k];
          const [wx, wy] = wobble(e.home[0], e.home[1], drawing);
          e.look.setAttribute('transform', `translate(${f(e.at[0] + wx)} ${f(e.at[1] + wy)})`);
          e.light.setAttribute('rx', f(e.iris.rx * grow));
          e.light.setAttribute('ry', f(e.iris.ry * grow));
          e.light.setAttribute('fill', glow);
        }
      },
    };
  }
  const dog = seated ? Dog(document.getElementById('dog')) : null;

  const env = { gain: 1, wind: 0, near: false, px: 0, py: 0, vx: 0, vy: 0 };
  let pull = [0, 0], moved = 0, held = false, t = 0;
  const world = e => [view.x + (e.clientX / innerWidth) * view.w, view.y + (e.clientY / innerHeight) * view.h];
  svg.addEventListener('pointermove', e => {
    const [x, y] = world(e), dt = (e.timeStamp - moved) / 1000;
    if (env.near && dt > 0.004 && dt < 0.2) pull = [clamp((x - env.px) / dt, 1400), clamp((y - env.py) / dt, 1400)];
    moved = e.timeStamp;
    env.px = x; env.py = y; env.near = true;
    if (dog) dog.notice(t);
  });
  svg.addEventListener('pointerleave', () => { env.near = false; });
  const panic = on => {
    held = on;
    svg.classList.toggle('panic', on && !calm.matches);
  };
  svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); panic(true); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => svg.addEventListener(n, () => panic(false)));

  let last = performance.now(), shown = 0;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt * (calm.matches ? 0.3 : 1);
    pull = pull.map(v => v * Math.pow(0.02, dt));
    env.vx += (pull[0] - env.vx) * Math.min(1, dt * 8);
    env.vy += (pull[1] - env.vy) * Math.min(1, dt * 8);
    env.wind += (clamp(env.vx / 1800, 0.65) - env.wind) * Math.min(1, dt * 3);
    env.gain += ((held ? 1.35 : 1) - env.gain) * Math.min(1, dt * 3);
    const drawing = calm.matches ? 0 : Math.floor(now * PACE / 1000) % DRAWINGS;
    if (drawing !== shown) {
      shown = drawing;
      for (const s of still) s.e.setAttribute('d', s.at(drawing));
    }
    for (const b of banks) b.draw(t, env, drawing);
    smoke(t, view, env, drawing);
    if (dog) dog.draw(t, dt, env, drawing, banks[0].flare());
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
