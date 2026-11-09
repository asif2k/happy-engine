packing()("happy_bridge", function happy_bridge() {
  "use strict";
  // BRIDGES. A road between places that meets water or a gorge it cannot go round crosses it on a DECK: a straight span from one bank to the other, level or on a grade, on piers when it is long. Pure: no engine, no DOM, Node 14 and the bundler's
  // parser (no optional chaining, no ??, no class, no async).
  //
  //   jump(R, ci, cj, di, dj, o) -> { land (the cell on the far bank), k (cells), len (metres) } or null          the router's one move over a gap (sandbox world route()): from cell (ci, cj) in direction (di, dj) over cells that all lie
  //        R = { n, cs, ys (Float32Array n x n: the ground's height, the sea floor under water), ok (Uint8Array: dry land), sea (the sea's height, metres) }
  //        o = { max_span (120 m), max_slope (0.07: of the deck, end to end), clear (1.5 m: how far under the deck line every cell between must lie), dry (1.2 m: how far over the sea both banks must be) }
  //        The far bank is the first dry cell on the line that a deck can reach (over `dry`, within max_slope of this one: an island in a river is one), and the deck line must be `clear` above every cell between: so water, a gorge or a river valley, never a hill or flat land.
  //   spans_of(link) -> [{ i, a: [x, z], b: [x, z] }]         the spans of a link { pts, spans: [i ...] }: pts[i] -> pts[i + 1] is a deck
  //   build(span, o) -> { P, N, C, I (a mesh of positions, normals, colours, indices: the deck, its parapets, the piers), rows (the collision: [cx, cy, cz, hx, hy, hz, yaw, pitch] of every box), info }
  //        span = { a: [x, z], b: [x, z], ya, yb (the height of the road at its two ends, metres), width (7) }, o = { ground: function (x, z) -> height of the ground (the sea floor too), sea (metres), colors }
  //   The deck is straight and on one grade (ya -> yb), so it is ONE slab to the physics: a box turned by the span's yaw and tipped by its grade (pitch: the rise angle, forward up), and a parapet box each side.

  const DEFAULTS = { max_span: 120, max_slope: 0.07, clear: 1.5, dry: 1.2 };

  function jump(R, ci, cj, di, dj, o) {
    o = o || {};
    const max_span = o.max_span > 0 ? o.max_span : DEFAULTS.max_span, max_slope = o.max_slope > 0 ? o.max_slope : DEFAULTS.max_slope, clear = o.clear >= 0 ? o.clear : DEFAULTS.clear, dry = o.dry >= 0 ? o.dry : DEFAULTS.dry;
    const n = R.n, step = R.cs * (di && dj ? 1.4142 : 1), K = Math.floor(max_span / step), y0 = R.ys[cj * n + ci];
    if (!R.ok[cj * n + ci] || y0 < R.sea + dry) return null;
    for (let k = 2; k <= K; k++) {
      const ii = ci + di * k, jj = cj + dj * k;
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) return null;
      const idx = jj * n + ii;
      const y1 = R.ys[idx], len = k * step;
      if (!R.ok[idx] || y1 < R.sea + dry || Math.abs(y1 - y0) / len > max_slope) continue;      // (still the gap: water, a gorge, a hill too high to land on, the land beyond the margin of the world)
      for (let m = 1; m < k; m++) { const g = R.ys[(cj + dj * m) * n + ci + di * m]; if (g > y0 + (y1 - y0) * (m / k) - clear) return null; }
      return { land: idx, k: k, len: len };
    }
    return null;
  }

  function spans_of(link) {
    const out = [];
    (link.spans || []).forEach(function (i) { if (i >= 0 && i + 1 < link.pts.length) out.push({ i: i, a: link.pts[i], b: link.pts[i + 1] }); });
    return out;
  }

  // ---- the mesh: polygons wound to face a point (the sandbox's mb_poly, the engine's winding), boxes in any frame
  function poly(m, pts, toward, col) {
    const n = pts.length; let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < n; i++) { const u = pts[i], v = pts[(i + 1) % n]; nx += (u[1] - v[1]) * (u[2] + v[2]); ny += (u[2] - v[2]) * (u[0] + v[0]); nz += (u[0] - v[0]) * (u[1] + v[1]); }
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz); if (!(l > 1e-9)) return;
    nx /= l; ny /= l; nz /= l;
    let V = pts; if (nx * toward[0] + ny * toward[1] + nz * toward[2] < 0) { nx = -nx; ny = -ny; nz = -nz; V = pts.slice().reverse(); }
    const base = m.P.length / 3;
    for (let i = 0; i < n; i++) { const q = V[i]; m.P.push(q[0], q[1], q[2]); m.N.push(nx, ny, nz); m.C.push(col[0], col[1], col[2]); }
    for (let i = 1; i + 1 < n; i++) m.I.push(base, base + i, base + i + 1);
  }
  // a box of centre c, half sizes (hx, hy, hz) along the unit axes r, u, f; `top` colours its +u face, `side` the others, `under` the -u face
  function box(m, c, r, u, f, hx, hy, hz, top, side, under) {
    const at = function (a, b, d) { return [c[0] + r[0] * a + u[0] * b + f[0] * d, c[1] + r[1] * a + u[1] * b + f[1] * d, c[2] + r[2] * a + u[2] * b + f[2] * d]; };
    poly(m, [at(-hx, hy, -hz), at(hx, hy, -hz), at(hx, hy, hz), at(-hx, hy, hz)], u, top);
    poly(m, [at(-hx, -hy, -hz), at(hx, -hy, -hz), at(hx, -hy, hz), at(-hx, -hy, hz)], [-u[0], -u[1], -u[2]], under);
    poly(m, [at(hx, -hy, -hz), at(hx, hy, -hz), at(hx, hy, hz), at(hx, -hy, hz)], r, side);
    poly(m, [at(-hx, -hy, -hz), at(-hx, hy, -hz), at(-hx, hy, hz), at(-hx, -hy, hz)], [-r[0], -r[1], -r[2]], side);
    poly(m, [at(-hx, -hy, hz), at(hx, -hy, hz), at(hx, hy, hz), at(-hx, hy, hz)], f, side);
    poly(m, [at(-hx, -hy, -hz), at(hx, -hy, -hz), at(hx, hy, -hz), at(-hx, hy, -hz)], [-f[0], -f[1], -f[2]], side);
  }

  function build(span, o) {
    o = o || {};
    const col = Object.assign({ road: [0.17, 0.18, 0.2], paint: [0.85, 0.85, 0.78], parapet: [0.7, 0.7, 0.68], side: [0.6, 0.6, 0.58], under: [0.42, 0.42, 0.4] }, o.colors || {});
    const width = span.width > 0 ? span.width : 7, ax = span.a[0], az = span.a[1], dx = span.b[0] - ax, dz = span.b[1] - az, L = Math.hypot(dx, dz), ya = span.ya, yb = span.yb;
    const m = { P: [], N: [], C: [], I: [], rows: [], info: null };
    if (!(L > 0.5)) { m.info = { length: 0 }; return m; }
    const fx = dx / L, fz = dz / L, yaw = Math.atan2(fx, fz), rise = Math.atan2(yb - ya, L), cr = Math.cos(rise), sr = Math.sin(rise);
    const f = [fx * cr, sr, fz * cr], u = [-fx * sr, cr, -fz * sr], r = [fz, 0, -fx];                    // (along the deck, up from it, across: r = u x f at no grade; (fz, 0, -fx) is the right of the way)
    const len3 = Math.hypot(L, yb - ya), thick = 0.45, hw = width / 2 + 0.3, par_h = 0.5, par_w = 0.3;
    const mid = [ax + dx / 2, (ya + yb) / 2, az + dz / 2];
    const under_c = [mid[0] - u[0] * thick, mid[1] - u[1] * thick, mid[2] - u[2] * thick];               // the slab: its top is the road
    const colr = { top: col.road, side: col.side, under: col.under };
    box(m, under_c, r, u, f, hw, thick, len3 / 2, colr.top, colr.side, colr.under);
    [-1, 1].forEach(function (s) {                                                                          // the parapets on the edges
      const c = [mid[0] + r[0] * s * (hw - par_w / 2) + u[0] * par_h / 2, mid[1] + r[1] * s * (hw - par_w / 2) + u[1] * par_h / 2, mid[2] + r[2] * s * (hw - par_w / 2) + u[2] * par_h / 2];
      box(m, c, r, u, f, par_w / 2, par_h / 2, len3 / 2, col.parapet, col.parapet, col.parapet);
    });
    // the centre line: dashes of 3 m every 6 m, a hair over the road (a long deck only)
    if (L > 16) for (let s = 1.5; s + 3 < L; s += 6) {
      const cs = s + 1.5, c = [ax + dx * cs / L + u[0] * 0.015, ya + (yb - ya) * cs / L + u[1] * 0.015, az + dz * cs / L + u[2] * 0.015];
      const q = function (a, b) { return [c[0] + r[0] * a + f[0] * b, c[1] + r[1] * a + f[1] * b, c[2] + r[2] * a + f[2] * b]; };
      poly(m, [q(-0.08, -1.5), q(0.08, -1.5), q(0.08, 1.5), q(-0.08, 1.5)], u, col.paint);
    }
    // the physics: the slab and a parapet each side (yaw about the vertical, then the tip of the grade: forward up is a NEGATIVE turn about the box's own x)
    const row = function (c, hx, hy, hz) { return [c[0], c[1], c[2], hx, hy, hz, yaw, rise]; };
    m.rows.push(row(under_c, hw, thick, len3 / 2 + 0.2));
    [-1, 1].forEach(function (s) { m.rows.push(row([mid[0] + r[0] * s * (hw - par_w / 2) + u[0] * par_h / 2, mid[1] + r[1] * s * (hw - par_w / 2) + u[1] * par_h / 2, mid[2] + r[2] * s * (hw - par_w / 2) + u[2] * par_h / 2], par_w / 2, par_h / 2, len3 / 2)); });
    // the piers: a long span stands on columns where the ground is well under the deck
    let piers = 0;
    if (o.ground && L > 34) {
      const n = Math.max(1, Math.ceil(L / 30) - 1);
      for (let j = 1; j <= n; j++) {
        const t = j / (n + 1), px = ax + dx * t, pz = az + dz * t, top = ya + (yb - ya) * t - 2 * thick, g = o.ground(px, pz);
        if (g > top - 0.6) continue;
        const base = Math.min(g, o.sea === undefined ? g : o.sea) - 1.5, h = (top - base) / 2;
        box(m, [px, base + h, pz], [fz, 0, -fx], [0, 1, 0], [fx, 0, fz], hw * 0.55, h, 0.9, col.side, col.side, col.under); piers++;
      }
    }
    m.info = { length: L, rise: yb - ya, grade: (yb - ya) / L, piers: piers, tris: m.I.length / 3, yaw: yaw, pitch: rise };
    return m;
  }

  return { jump: jump, spans_of: spans_of, build: build, DEFAULTS: DEFAULTS };
});
