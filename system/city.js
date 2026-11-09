packing()("happy_city", function happy_city() {
  "use strict";
  // THE CITY GENERATOR (system/CITY.md): a street network, its blocks, its lots and what stands in them, as a list of ELEMENTS (structures.js: recipes laid on the ground) in WORLD metres. Pure: no engine, no DOM, deterministic (a seeded mulberry32).
  // The streets are DATA (`roads`, `junctions`: the road field and the road mesh draw them); the road pieces and the street furniture, the recipes of a road kit, are not in `elements` unless `pieces: true`. The BUILDINGS are BOXES: `make_building(request)` is a callback the caller gives (the default makes one `box` of structures.js by size).
  // Node 14 and the bundler's parser: no optional chaining, no ??, no class, no async functions.
  //
  //   generate(opts) -> { areas, elements, blocks, roads, junctions, lots, stats, notes }
  //   opts = { x, z (the middle, metres, 0), radius (300; 80 .. 3000), seed (1), layout: "grid" | "organic" | "radial" | "suburb" | "village" ("grid"), density (0 .. 1, 0.6: the size of blocks, how built-up, how tall), ground: { y(x, z), land(x, z) } (flat dry land),
  //            make_building(request) (below), building_styles: { name: weight } ({ residential: 0.6, commercial: 0.25, industrial: 0.1, civic: 0.05 }), floors: [min, max] ([1, 6]), road_width (the asphalt of a local street: 7; 4 .. 12),
  //            props (0 .. 1, 0.6: street furniture, crossings, trees), structures (structures.js: its `tilt` lays a piece on the slope; city.js has the same formula when it is not given), pieces (false: the road pieces and street furniture are made but not returned; true: they are returned, for a host that has their recipes) }
  //   A number out of its range is held to it (and said in `notes`), a name that is not known throws and says the valid ones, junk is dropped; an empty city (the middle is in the sea) is an empty result with a note, not an error.
  //   make_building(request) -> [element] | { elements, world: true }    request = { x, z (the middle of the building, WORLD), yaw (degrees: its front, +z, faces the street), w (width along the street), d (depth), floors, style, seed, lot (id), y (the ground at its middle),
  //     rise (the ground's height range over its footprint), lot_w, lot_d, corner, front: [fx, fz] }. The elements it returns are in the BUILDING's frame (x right, z forward (to the street), yaw added to the request's, dy) unless `world: true` (or an element has `world: true`).
  //   elements: [{ type, x, z, yaw, scale, dy, pitch, roll, p }] (no ids: the caller gives them, and puts each in the location that holds its place)
  //   areas: [{ kind: "city" | "village" | "district", name, x, z, r }]   the whole place and (from 150 m) its districts of 100 m, so that streaming loads one at a time
  //   roads: [{ id, points: [[x, z]], width (asphalt), walk, kind: "arterial" | "street" | "lane", type (the recipe), length, trim: [metres cut off the start, off the end: where the junction pad takes over], a, b (junction ids) }] centre lines, 6 m apart      junctions: [{ id, x, z, r, kind, arms }]
  //   blocks: [{ id, x, z, area, kind: "block" | "park" | "plaza", style, poly: [[x, z]] }]      lots: [{ id, x, z, yaw, w, d, kind: "building" | "park", block, style, floors }]      stats, notes
  // HOW: a graph of nodes and edges is made by the layout (a lattice with jitter and bends, rings and spokes, collectors with cul-de-sacs, a winding main street with lanes), the edges into water, off the radius or over steep ground are dropped, what is not connected is dropped,
  // streets are CHAINS of edges between junctions and are rounded with fillets (never tighter than a lorry's turn when the geometry allows), a junction is a pad (a square when the arms are square, else a disc: the arms end on its chord), the chains are laid as
  // short pieces of 4, 6 or 8 m (as long as the bend lets them, overlapping at the ends so that a curve has no gap), each tilted on the slope and lifted until the ground does not cover it. The faces of the graph are the BLOCKS; each block is lotted along its
  // frontage (the lots are tried at three set-backs and four depths, against the streets, the junctions and the lots already made); every lot asks `make_building`; a few blocks and lots are parks and plazas.
  const DEG = Math.PI / 180, TAU = Math.PI * 2;
  const LAYOUTS = ["grid", "organic", "radial", "suburb", "village"];
  const KINDS = ["lane", "street", "arterial"];
  const QL = [4, 6, 8];                                                                      // the lengths of a road piece
  const SINK = 0.15, TOP = SINK + 0.06, WALK_H = 0.12;                                       // (structures.js SINK; TOP, the sidewalk's height)
  const POOL = [5, 6, 7, 8, 9, 10, 12, 14, 16];
  const PIECE = /^(road|street)(_|$)/;                                                      // the types of the road kit's recipes: the pieces of a street and its furniture
  function strip_pieces(list) { let w = 0; for (let i = 0; i < list.length; i++) if (!PIECE.test(list[i].type)) list[w++] = list[i]; list.length = w; return list; }                                              // the radii of a round junction

  const clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  const r1 = function (v) { return Math.round(v * 10) / 10; };
  const r3 = function (v) { return Math.round(v * 1000) / 1000; };
  const lerp = function (a, b, t) { return a + (b - a) * t; };
  const mod = function (a, n) { return ((a % n) + n) % n; };
  const isnum = function (v) { return typeof v === "number" && isFinite(v); };
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hash2(a, b) { let h = Math.imul(a | 0, 0x9E3779B1) ^ Math.imul(b | 0, 0x85EBCA6B); h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15; return h >>> 0; }
  function make_noise(seed) {                                                               // smooth value noise, -1 .. 1
    const lat = function (i, j) { return hash2(hash2(i, j), seed) / 2147483648 - 1; };
    return function (x, z) {
      const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), a = lat(i, j), b = lat(i + 1, j), c = lat(i, j + 1), d = lat(i + 1, j + 1);
      return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
    };
  }
  // a hash of boxes by cell: ids in the cells a box touches
  function make_hash(cell) {
    const map = new Map(), seen = []; let tick = 0;
    const key = function (i, j) { return (i + 8192) * 16384 + (j + 8192); };
    return {
      add: function (id, x0, z0, x1, z1) {
        const i0 = Math.floor(Math.min(x0, x1) / cell), i1 = Math.floor(Math.max(x0, x1) / cell), j0 = Math.floor(Math.min(z0, z1) / cell), j1 = Math.floor(Math.max(z0, z1) / cell);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = key(i, j); let l = map.get(k); if (!l) { l = []; map.set(k, l); } l.push(id); }
      },
      query: function (x0, z0, x1, z1, out) {
        out.length = 0; tick++;
        const i0 = Math.floor(x0 / cell), i1 = Math.floor(x1 / cell), j0 = Math.floor(z0 / cell), j1 = Math.floor(z1 / cell);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const l = map.get(key(i, j)); if (!l) continue; for (let n = 0; n < l.length; n++) { const id = l[n]; if (seen[id] !== tick) { seen[id] = tick; out.push(id); } } }
        return out;
      }
    };
  }

  // ---- geometry
  function pt_seg(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let t = l2 > 1e-12 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t - px, qz = az + dz * t - pz;
    return Math.sqrt(qx * qx + qz * qz);
  }
  function pt_box(x, z, hw, hd) { const dx = Math.max(Math.abs(x) - hw, 0), dz = Math.max(Math.abs(z) - hd, 0); return Math.sqrt(dx * dx + dz * dz); }
  // the distance from a segment to a box |x| <= hw, |z| <= hd (the segment is in the box's frame): 0 when they meet
  function seg_box(x0, z0, x1, z1, hw, hd) {
    let t0 = 0, t1 = 1; const dx = x1 - x0, dz = z1 - z0;
    const P = [-dx, dx, -dz, dz], Q = [x0 + hw, hw - x0, z0 + hd, hd - z0];
    let hit = true;
    for (let i = 0; i < 4; i++) {
      if (P[i] === 0) { if (Q[i] < 0) { hit = false; break; } continue; }
      const r = Q[i] / P[i];
      if (P[i] < 0) { if (r > t1) { hit = false; break; } if (r > t0) t0 = r; } else { if (r < t0) { hit = false; break; } if (r < t1) t1 = r; }
    }
    if (hit) return 0;
    let d = Math.min(pt_box(x0, z0, hw, hd), pt_box(x1, z1, hw, hd));
    d = Math.min(d, pt_seg(hw, hd, x0, z0, x1, z1), pt_seg(-hw, hd, x0, z0, x1, z1), pt_seg(hw, -hd, x0, z0, x1, z1), pt_seg(-hw, -hd, x0, z0, x1, z1));
    return d;
  }
  // a lot: { x, z, c, s, hw, hd } with its +z (its front) = (s, c) and its +x = (c, -s)
  function obb_hit(a, b, gap) {
    const dx = b.x - a.x, dz = b.z - a.z, axes = [[a.c, -a.s], [a.s, a.c], [b.c, -b.s], [b.s, b.c]];
    for (let i = 0; i < 4; i++) {
      const ux = axes[i][0], uz = axes[i][1];
      const ra = a.hw * Math.abs(ux * a.c - uz * a.s) + a.hd * Math.abs(ux * a.s + uz * a.c), rb = b.hw * Math.abs(ux * b.c - uz * b.s) + b.hd * Math.abs(ux * b.s + uz * b.c);
      if (Math.abs(dx * ux + dz * uz) > ra + rb + gap) return false;
    }
    return true;
  }
  function poly_area(pts) { let a = 0; for (let i = 0, n = pts.length; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function in_poly(pts, x, z) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
    return c;
  }
  // a polyline with its arc length: at(s) gives the point and the direction
  function make_poly(pts) {
    const n = pts.length, x = new Float64Array(n), z = new Float64Array(n), s = new Float64Array(n);
    for (let i = 0; i < n; i++) { x[i] = pts[i][0]; z[i] = pts[i][1]; if (i) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]); }
    return { x: x, z: z, s: s, n: n, len: s[n - 1] };
  }
  function poly_at(P, s, out) {
    s = s < 0 ? 0 : s > P.len ? P.len : s;
    let lo = 0, hi = P.n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P.s[m] <= s) lo = m; else hi = m; }
    const l = P.s[hi] - P.s[lo], t = l > 1e-9 ? (s - P.s[lo]) / l : 0, dx = P.x[hi] - P.x[lo], dz = P.z[hi] - P.z[lo], dl = Math.hypot(dx, dz) || 1;
    out.x = P.x[lo] + dx * t; out.z = P.z[lo] + dz * t; out.dx = dx / dl; out.dz = dz / dl;
    return out;
  }
  function reverse_poly(P) {
    const pts = []; for (let i = P.n - 1; i >= 0; i--) pts.push([P.x[i], P.z[i]]);
    return make_poly(pts);
  }
  // straight lines and arcs: every corner of `pts` is rounded by a fillet as wide as `rpref` (or as the two segments allow: half of each, and a junction's arm stays straight for 10 m when it can); a fillet tighter than `rmin` is counted
  function fillet(pts, rpref, rmin, st) {
    const P = [pts[0]];
    for (let i = 1; i < pts.length; i++) { const q = P[P.length - 1]; if (Math.hypot(pts[i][0] - q[0], pts[i][1] - q[1]) > 0.5) P.push(pts[i]); }
    const n = P.length;
    if (n < 2) return P;
    const seg = [], dir = [], t = [], th = [];
    for (let k = 0; k < n - 1; k++) { const dx = P[k + 1][0] - P[k][0], dz = P[k + 1][1] - P[k][1], l = Math.hypot(dx, dz); seg.push(l); dir.push([dx / l, dz / l]); }
    for (let i = 1; i < n - 1; i++) {
      const d0 = dir[i - 1], d1 = dir[i], ang = Math.acos(clamp(d0[0] * d1[0] + d0[1] * d1[1], -1, 1));
      th[i] = ang;
      if (ang < 0.012) { t[i] = 0; continue; }
      const lim0 = i === 1 ? Math.max(0.5 * seg[0], seg[0] - 10) : 0.5 * seg[i - 1], lim1 = i === n - 2 ? Math.max(0.5 * seg[i], seg[i] - 10) : 0.5 * seg[i];
      t[i] = Math.min(rpref * Math.tan(ang / 2), lim0, lim1);
    }
    const out = [P[0]];
    for (let i = 1; i < n - 1; i++) {
      if (!(t[i] > 0)) { out.push(P[i]); continue; }
      const d0 = dir[i - 1], d1 = dir[i], T1 = [P[i][0] - d0[0] * t[i], P[i][1] - d0[1] * t[i]], R = t[i] / Math.tan(th[i] / 2);
      if (R < rmin - 0.01) st.tight_bends++;
      const sg = d0[0] * d1[1] - d0[1] * d1[0] >= 0 ? 1 : -1, cx = T1[0] - d0[1] * sg * R, cz = T1[1] + d0[0] * sg * R, a0 = Math.atan2(T1[1] - cz, T1[0] - cx), steps = Math.max(2, Math.ceil(th[i] / (6 * DEG)));
      for (let k = 0; k <= steps; k++) { const a = a0 + sg * th[i] * k / steps; out.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]); }
    }
    out.push(P[n - 1]);
    return out;
  }
  // the slope of the ground under a piece (structures.js `tilt`: pitch lifts the +z end, roll the +x side)
  function tilt_of(gy, x, z, yaw, length, width) {
    const a = yaw * DEG, s = Math.sin(a), c = Math.cos(a), hl = length / 2, hw = width / 2;
    const dz = (gy(x + s * hl, z + c * hl) - gy(x - s * hl, z - c * hl)) / Math.max(1e-6, length), dx = (gy(x + c * hw, z - s * hw) - gy(x - c * hw, z + s * hw)) / Math.max(1e-6, width);
    return { pitch: r3(Math.atan(dz) * 180 / Math.PI), roll: r3(Math.atan(dx) * 180 / Math.PI) };
  }

  // ---- what a road is made of, by layout and kind
  function road_style(layout, kind, w0) {
    let o;
    if (layout === "village") o = kind === 0 ? { type: "road_dirt", width: 4, walk: 0, surface: 1 } : { type: "road_cobble", width: 5, walk: 0, surface: 2 };
    else if (layout === "suburb") o = kind === 2 ? { type: "road", width: w0 + 3, walk: 2, surface: 0 } : kind === 1 ? { type: "road", width: w0, walk: 2, surface: 0 } : { type: "road_plain", width: Math.max(4, w0 - 1), walk: 2, surface: 0 };
    else o = kind === 2 ? { type: "road", width: w0 + 3, walk: 2.5, surface: 0 } : kind === 1 ? { type: "road_plain", width: w0, walk: 2.5, surface: 0 } : { type: "road_plain", width: Math.max(4, w0 - 2), walk: 2.5, surface: 0 };
    o.kind = kind; o.h = o.width / 2 + o.walk; o.rmin = Math.max(9, 1.2 * 2 * o.h); o.gmax = kind === 2 ? 0.1 : kind === 1 ? 0.13 : 0.15;
    return o;
  }

  // ---- laying a centre line as pieces (the same for a city's streets and for `lay`'s long roads)
  // the arc s0 .. s1 of the polyline P is cut into equal chords whose ends are on the line; a bend needs each piece to reach past its chord by (half the road) * tan(half the turn) at both ends, so the pieces are as long as 4, 6 or 8 m and more of them when the
  // bend is tight. -> [{ x, z (the middle of the chord), yaw (degrees), L (4, 6 or 8), s (the arc length of the middle), tight }]
  function plan_pieces(P, s0, s1, ht) {
    const T = s1 - s0, out = [], q = {};
    if (!(T >= 2.5)) return out;
    let n = Math.max(1, Math.ceil(T / 7.4)), vx, vz, need, dirs;
    for (let tries = 0; tries < 14; tries++) {
      vx = []; vz = []; need = []; dirs = [];
      for (let k = 0; k <= n; k++) { poly_at(P, s0 + T * k / n, q); vx.push(q.x); vz.push(q.z); }
      const ch = [];
      for (let k = 0; k < n; k++) { const dx = vx[k + 1] - vx[k], dz = vz[k + 1] - vz[k], l = Math.hypot(dx, dz) || 1; ch.push(l); dirs.push([dx / l, dz / l]); }
      const e = [0.15]; for (let k = 1; k < n; k++) { const th = Math.acos(clamp(dirs[k - 1][0] * dirs[k][0] + dirs[k - 1][1] * dirs[k][1], -1, 1)); e.push(ht * Math.tan(th / 2) + 0.15); } e.push(0.15);
      let good = true; for (let k = 0; k < n; k++) { need.push(ch[k] + 2 * Math.max(e[k], e[k + 1])); if (need[k] > 8.001) good = false; }
      if (good || n > 400) break;
      n = Math.ceil(n * 1.25) + 1;
    }
    for (let k = 0; k < n; k++) {
      let L = 8; for (let i = 0; i < QL.length; i++) if (QL[i] >= need[k] - 1e-6) { L = QL[i]; break; }
      out.push({ x: (vx[k] + vx[k + 1]) / 2, z: (vz[k] + vz[k + 1]) / 2, yaw: Math.atan2(dirs[k][0], dirs[k][1]) / DEG, L: L, s: s0 + T * (k + 0.5) / n, tight: need[k] > 8.001 });
    }
    return out;
  }
  // a piece on the ground: its tilt (the slope under it) and how far it is lifted (until the ground, at the middle, the corners and the middles of the sides, does not cover it)
  function make_layer(gy, tilt) {
    const lift = function (x, z, yaw, pitch, roll, L, Wt) {
      const a = yaw * DEG, s = Math.sin(a), c = Math.cos(a), tp = Math.tan(pitch * DEG), tr = Math.tan(roll * DEG), y0 = gy(x, z);
      let ex = 0;
      for (let k = 0; k < 9; k++) {
        const lx = ((k % 3) - 1) * Wt / 2, lz = (((k / 3) | 0) - 1) * L / 2, g = gy(x + lx * c + lz * s, z - lx * s + lz * c);
        ex = Math.max(ex, g - (y0 + tp * lz + tr * lx));
      }
      return clamp(ex, 0, 0.7);
    };
    // `up` (1.2 cm for every other piece of a street): where two pieces overlap their tops are not on one plane, so they do not fight over the same pixels
    const piece = function (type, x, z, yaw, L, Wt, p, up) {
      const t = tilt(x, z, yaw, L, Wt), dy = lift(x, z, yaw, t.pitch, t.roll, L, Wt) + (up || 0);
      return { type: type, x: r3(x), z: r3(z), yaw: r3(yaw), scale: 1, dy: r3(dy), pitch: t.pitch, roll: t.roll, p: p };
    };
    return { lift: lift, piece: piece };
  }
  // the record of a laid piece (for what stands on the road), and the height of the asphalt at a place beside the piece nearest to arc length s
  function piece_record(gy, e, s) { return { s: s, x: e.x, z: e.z, yaw: e.yaw * DEG, top: gy(e.x, e.z) - SINK + e.dy + TOP, tp: Math.tan(e.pitch * DEG), tr: Math.tan(e.roll * DEG) }; }
  function surface_of(gy, pieces, s, x, z) {
    let best = null, bd = 1e9;
    for (let i = 0; i < pieces.length; i++) { const d = Math.abs(pieces[i].s - s); if (d < bd) { bd = d; best = pieces[i]; } }
    if (!best) return gy(x, z) + 0.06;
    const dx = x - best.x, dz = z - best.z, sn = Math.sin(best.yaw), cs = Math.cos(best.yaw);
    return best.top + best.tp * (dx * sn + dz * cs) + best.tr * (dx * cs - dz * sn);
  }

  // the ground the caller gave, made safe: heights are finite numbers (0 when it gives none), `land` is a boolean (dry when it is not given)
  function ground_of(g) {
    g = g && typeof g === "object" ? g : {};
    return { gy: typeof g.y === "function" ? function (x, z) { const v = g.y(x, z); return isnum(v) ? v : 0; } : function () { return 0; }, land: typeof g.land === "function" ? function (x, z) { return !!g.land(x, z); } : function () { return true; } };
  }
  function seg_cross(ax, az, bx, bz, cx, cz, dx, dz) {
    const d1x = bx - ax, d1z = bz - az, d2x = dx - cx, d2z = dz - cz, den = d1x * d2z - d1z * d2x;
    if (Math.abs(den) < 1e-9) return false;
    const t = ((cx - ax) * d2z - (cz - az) * d2x) / den, u = ((cx - ax) * d1z - (cz - az) * d1x) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }
  // a thing that stands beside a road: on the `side` (+1 left of the line's direction) `lat` metres from the middle, its +z toward the road, on the asphalt's plane (+ `up`); null where `ok(x, z)` says no
  function furn_at(gy, ok, P, pieces, s, side, lat, type, p, up, yaw_extra) {
    const q = poly_at(P, s, {}), nx = -q.dz * side, nz = q.dx * side, x = q.x + nx * lat, z = q.z + nz * lat;
    if (!ok(x, z)) return null;
    const floor = surface_of(gy, pieces, s, x, z) + (up || 0);
    return { type: type, x: r3(x), z: r3(z), yaw: r3(Math.atan2(-nx, -nz) / DEG + (yaw_extra || 0)), scale: 1, dy: r3(floor - (gy(x, z) - SINK)), pitch: 0, roll: 0, p: p };
  }
  // ---- long roads that are not the streets of a city (the world generator joins towns with them): lay(roads, opts) -> { elements, notes, stats }
  //   roads = [{ points: [[x, z] ...], width (asphalt, m), kind: "highway" | "road" | "track" }]: centre lines of any length, already smooth. highway = road_motorway (10 .. 30 m, a median), road = `road` (a centre line, no sidewalk), track = road_dirt.
  //   opts = { ground: { y, land }, structures, props (0 .. 1, 0: a lamp now and then on highways and roads, a signpost on roads), gaps: [{ x, z, r }] (a piece whose middle is within r of a gap's middle is left out: a bridge stands there) }
  //   The same pieces as a city's streets (4, 6 or 8 m, overlapped at the ends so that a bend has no gap, tilted on the slope, lifted until the ground does not cover them). Roads that cross or meet just overlap. A piece on water (`land` false) is left out too.
  function lay(roads, opts) {
    const notes = [], say = function (t) { if (notes.length < 40 && notes.indexOf(t) < 0) notes.push(t); };
    opts = opts && typeof opts === "object" ? opts : {};
    const G0 = ground_of(opts.ground), gy = G0.gy, land = G0.land, S = opts.structures && typeof opts.structures.tilt === "function" ? opts.structures : null;
    const tilt = S ? function (x, z, yaw, l, w) { return S.tilt(gy, x, z, yaw, l, w); } : function (x, z, yaw, l, w) { return tilt_of(gy, x, z, yaw, l, w); };
    const props = isnum(opts.props) ? clamp(opts.props, 0, 1) : 0.5, layer = make_layer(gy, tilt), out = [], stats = { roads: 0, pieces: 0, lamps: 0, signs: 0, dropped_water: 0, dropped_gaps: 0, tight: 0 };
    const gaps = []; (Array.isArray(opts.gaps) ? opts.gaps : []).forEach(function (g) { if (g && isnum(g.x) && isnum(g.z) && isnum(g.r) && g.r > 0) gaps.push(g); else say("a gap is { x, z, r }: one was dropped"); });
    const in_gap = function (x, z) { for (let i = 0; i < gaps.length; i++) if (Math.hypot(x - gaps[i].x, z - gaps[i].z) <= gaps[i].r) return true; return false; };
    if (!Array.isArray(roads)) { say("roads is a list of { points, width, kind }"); return { elements: out, notes: notes, stats: stats }; }
    const DEF = { highway: [14, 10, 30], road: [7, 3, 16], track: [4, 2, 12] };
    roads.forEach(function (rd, ri) {
      if (!rd || !Array.isArray(rd.points)) { say("road " + ri + " has no points: dropped"); return; }
      let kind = rd.kind === undefined ? "road" : rd.kind;
      if (!DEF[kind]) { say("road " + ri + ": kind `" + kind + "` is not highway, road or track: road is used"); kind = "road"; }
      const pts = []; rd.points.forEach(function (q) { if (Array.isArray(q) && isnum(q[0]) && isnum(q[1]) && (!pts.length || Math.hypot(q[0] - pts[pts.length - 1][0], q[1] - pts[pts.length - 1][1]) > 0.5)) pts.push([q[0], q[1]]); });
      if (pts.length < 2) { say("road " + ri + " has fewer than two usable points: dropped"); return; }
      const d = DEF[kind], width = Math.round(clamp(isnum(rd.width) ? rd.width : d[0], d[1], d[2]));
      if (isnum(rd.width) && Math.round(clamp(rd.width, d[1], d[2])) !== Math.round(rd.width)) say("road " + ri + ": width " + rd.width + " is held to " + d[1] + " .. " + d[2]);
      const P = make_poly(pts), type = kind === "highway" ? "road_motorway" : kind === "track" ? "road_dirt" : "road", pieces = [];
      stats.roads++;
      plan_pieces(P, 0, P.len, width / 2).forEach(function (q, qi) {
        if (q.tight) stats.tight++;
        if (in_gap(q.x, q.z)) { stats.dropped_gaps++; return; }
        if (!land(q.x, q.z)) { stats.dropped_water++; return; }
        const p = { length: q.L, width: width }; if (kind === "highway") p.median = 1.4; else if (kind === "road") p.walk = 0;
        const e = layer.piece(type, q.x, q.z, q.yaw, q.L, width, p, qi & 1 ? 0.012 : 0);
        out.push(e); stats.pieces++; pieces.push(piece_record(gy, e, q.s));
      });
      if (props > 0 && kind !== "track" && pieces.length) {
        const ok = function (x, z) { return land(x, z) && !in_gap(x, z); }, rr = mulberry32(hash2(ri + 7, Math.floor(P.len)));
        let k = 0;
        for (let s = 25 + rr() * 30; s < P.len - 20; s += (kind === "highway" ? 80 : 65) / props, k++) { const e = furn_at(gy, ok, P, pieces, s, k % 2 ? 1 : -1, width / 2 + (kind === "highway" ? 1.4 : 0.9), "street_lamp", kind === "highway" ? { height: 8, arm: 2 } : { height: 6, arm: 1.4 }, 0); if (e) { out.push(e); stats.lamps++; } }
        if (kind === "road") for (let s = 120 + rr() * 150; s < P.len - 40; s += (420 + rr() * 200) / props) { const e = furn_at(gy, ok, P, pieces, s, rr() < 0.5 ? 1 : -1, width / 2 + 1.1, "street_signpost", { height: 2.7 }, 0); if (e) { out.push(e); stats.signs++; } }
      }
    });
    return { elements: opts.pieces === true ? out : strip_pieces(out), notes: notes, stats: stats };
  }

  // ======================================================================================================================================
  function generate(opts) {
    const T0 = Date.now(), notes = [], say = function (t) { if (notes.length < 60 && notes.indexOf(t) < 0) notes.push(t); };
    opts = opts && typeof opts === "object" ? opts : {};
    // ---- the numbers, held to their range
    const hold = function (name, v, d, lo, hi) { if (v === undefined || v === null) return d; if (!isnum(v)) { say(name + " is a number: " + d + " is used"); return d; } const c = clamp(v, lo, hi); if (c !== v) say(name + " " + v + " is held to " + c + " (" + lo + " .. " + hi + ")"); return c; };
    const layout = opts.layout === undefined || opts.layout === null ? "grid" : opts.layout;
    if (LAYOUTS.indexOf(layout) < 0) throw new Error("city: `" + layout + "` is not a layout (" + LAYOUTS.join(", ") + ")");
    const R = hold("radius", opts.radius, 300, 80, 3000), density = hold("density", opts.density, 0.6, 0, 1), props = hold("props", opts.props, 0.6, 0, 1), W0 = Math.round(hold("road_width", opts.road_width, 7, 4, 12));
    const seed = isnum(opts.seed) ? Math.floor(opts.seed) : (opts.seed === undefined ? 1 : (say("seed is a number: 1 is used"), 1));
    let cx = isnum(opts.x) ? opts.x : 0, cz = isnum(opts.z) ? opts.z : 0;
    let fl = Array.isArray(opts.floors) && opts.floors.length >= 2 && isnum(opts.floors[0]) && isnum(opts.floors[1]) ? [Math.round(clamp(opts.floors[0], 1, 40)), Math.round(clamp(opts.floors[1], 1, 40))] : [1, 6];
    if (opts.floors !== undefined && !(Array.isArray(opts.floors) && opts.floors.length >= 2)) say("floors is [min, max]: [1, 6] is used");
    if (fl[0] > fl[1]) fl = [fl[1], fl[0]];
    const gnd = opts.ground && typeof opts.ground === "object" ? opts.ground : {};
    const G1 = ground_of(gnd), gy = G1.gy, land = G1.land;
    const builder = typeof opts.make_building === "function" ? opts.make_building : null;
    if (opts.make_building !== undefined && opts.make_building !== null && !builder) say("make_building is a function: the default buildings are used");
    const S = opts.structures && typeof opts.structures.tilt === "function" ? opts.structures : null;
    const tilt = S ? function (x, z, yaw, l, w) { return S.tilt(gy, x, z, yaw, l, w); } : function (x, z, yaw, l, w) { return tilt_of(gy, x, z, yaw, l, w); };
    let bstyles = {}, bsum = 0;
    if (opts.building_styles && typeof opts.building_styles === "object") Object.keys(opts.building_styles).forEach(function (k) { const w = opts.building_styles[k]; if (isnum(w) && w > 0) { bstyles[k] = w; bsum += w; } else say("building_styles." + k + " is a weight over 0: it is dropped"); });
    const default_styles = bsum === 0;
    if (default_styles) bstyles = { residential: 0.6, commercial: 0.25, industrial: 0.1, civic: 0.05 };
    const style_names = Object.keys(bstyles);
    const rng = mulberry32(hash2(seed, 101)), rng_b = mulberry32(hash2(seed, 202)), rng_f = mulberry32(hash2(seed, 303)), noise = make_noise(hash2(seed, 404));
    const stats = { layout: layout, tight_bends: 0, ms: {} };
    const result = { areas: [], elements: [], blocks: [], roads: [], junctions: [], exits: [], lots: [], stats: stats, notes: notes };
    const STY = [road_style(layout, 0, W0), road_style(layout, 1, W0), road_style(layout, 2, W0)];

    // ---- the middle must be dry and not steep: else the nearest ground that is
    const ok_ground = function (x, z) {
      if (!land(x, z)) return false;
      const y = gy(x, z);
      return Math.abs(gy(x + 6, z) - y) < 1.2 && Math.abs(gy(x, z + 6) - y) < 1.2;
    };
    if (!ok_ground(cx, cz)) {
      let found = false;
      for (let ring = 1; ring * 12 <= R * 0.6 && !found; ring++) for (let a = 0; a < 16 && !found; a++) { const x = cx + Math.cos(a / 16 * TAU) * ring * 12, z = cz + Math.sin(a / 16 * TAU) * ring * 12; if (ok_ground(x, z)) { cx = x; cz = z; found = true; } }
      if (!found) { say("the middle is not on dry, gentle ground and none is near: no city is made"); stats.ms.total = Date.now() - T0; stats.elements = 0; return result; }
      say("the middle was not dry or gentle: the city is moved to " + r1(cx) + ", " + r1(cz));
    }
    const LIM = R - 20;                                                                      // nodes stay this far from the edge
    const ctx = { R: R, cx: cx, cz: cz, LIM: LIM, gy: gy, land: land, rng: rng, noise: noise, layout: layout, density: density };

    // ================================================================================================================================ the graph
    const G = { nodes: [], edges: [] };
    const add_node = function (x, z) { G.nodes.push({ x: x, z: z, adj: [], alive: true, arms: null, pad: null }); return G.nodes.length - 1; };
    const add_edge = function (a, b, kind, ctrl, keep) {
      if (a === b) return -1;
      const e = { a: a, b: b, kind: kind, ctrl: ctrl || [], alive: true, keep: !!keep };
      G.edges.push(e); const id = G.edges.length - 1; G.nodes[a].adj.push(id); G.nodes[b].adj.push(id); return id;
    };
    const edge_pts = function (e) { const a = G.nodes[e.a], b = G.nodes[e.b]; return [[a.x, a.z]].concat(e.ctrl, [[b.x, b.z]]); };
    const deg = function (n) { let d = 0; for (let i = 0; i < n.adj.length; i++) if (G.edges[n.adj[i]].alive) d++; return d; };
    const path_ok = function (pts, st, lim) {
      lim = lim === undefined ? LIM : lim;                                                      // a path stays inside, on dry ground (with a margin on both sides) and not too steep
      let py = null;
      for (let k = 0; k + 1 < pts.length; k++) {
        const ax = pts[k][0], az = pts[k][1], bx = pts[k + 1][0], bz = pts[k + 1][1], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / 5)), tx = (bx - ax) / (len || 1), tz = (bz - az) / (len || 1), m = st.h + 2.5;
        for (let i = k ? 1 : 0; i <= n; i++) {
          const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
          if (Math.hypot(x - cx, z - cz) > lim) return false;
          if (!land(x, z) || !land(x - tz * m, z + tx * m) || !land(x + tz * m, z - tx * m)) return false;
          const y = gy(x, z);
          if (py !== null && Math.abs(y - py.y) > st.gmax * Math.hypot(x - py.x, z - py.z) + 0.05) return false;
          if (Math.abs(gy(x - tz * st.h, z + tx * st.h) - gy(x + tz * st.h, z - tx * st.h)) > 0.34 * 2 * st.h) return false;
          py = { x: x, z: z, y: y };
        }
      }
      return true;
    };
    const split_edge = function (ei, s) {                                                      // a node at arc length s of an edge: the edge is cut in two (the first half keeps its id)
      const e = G.edges[ei], pts = edge_pts(e), P = make_poly(pts), q = poly_at(P, s, {}), first = [], rest = [];
      for (let k = 1; k < pts.length - 1; k++) if (Math.hypot(pts[k][0] - q.x, pts[k][1] - q.z) > 1) (P.s[k] < s ? first : rest).push(pts[k]);
      const nn = add_node(q.x, q.z), b = e.b, nb = G.nodes[b];
      nb.adj.splice(nb.adj.indexOf(ei), 1);
      e.b = nn; e.ctrl = first; G.nodes[nn].adj.push(ei);
      add_edge(nn, b, e.kind, rest, e.keep);
      return nn;
    };

    // ---- a lattice of lines: a grid, jittered or warped
    const lattice = function (S0, d) {
      S0 = Math.min(S0, LIM / d.fit);                                                        // (a small radius needs small blocks)
      const rot = d.rotate ? rng() * Math.PI / 2 : 0, cr = Math.cos(rot), sr = Math.sin(rot), n = Math.ceil((R + S0) / S0) + 1, N = 2 * n + 1;
      const pi = [], pj = [];
      for (let k = -n; k <= n; k++) { pi.push(k * S0 + (k === 0 ? 0 : (rng() - 0.5) * d.irr * S0)); pj.push(k * S0 + (k === 0 ? 0 : (rng() - 0.5) * d.irr * S0)); }
      const idx = new Int32Array(N * N).fill(-1), wl = S0 * 3.3;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        let x = pi[i], z = pj[j];
        if (d.warp) { const w = d.warp * S0; x += w * noise(x / wl + 11.3, z / wl + 4.7); z += w * noise(x / wl + 71.1, z / wl + 29.9); }
        if (d.jit) { x += (rng() - 0.5) * 2 * d.jit * S0; z += (rng() - 0.5) * 2 * d.jit * S0; }
        const X = cx + x * cr - z * sr, Z = cz + x * sr + z * cr;
        if (Math.hypot(X - cx, Z - cz) <= LIM) idx[j * N + i] = add_node(X, Z);
      }
      const AE = d.arterial_every, z1 = lerp(0.25, 0.6, density) * R, z2 = lerp(0.5, 0.85, density) * R;
      const link = function (a, b, kind, line) {
        const na = G.nodes[a], nb = G.nodes[b], mx = (na.x + nb.x) / 2, mz = (na.z + nb.z) / 2, rr = Math.hypot(mx - cx, mz - cz);
        if (d.thin && kind < 2) { const m = rr < z1 ? 1 : rr < z2 ? 2 : 4; if (mod(line, m) !== 0) return; }
        const dx = nb.x - na.x, dz = nb.z - na.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, ctrl = [];
        if (d.bend) {
          const b1 = noise(mx / 61 + 3.1, mz / 61 + 9.7) * d.bend * S0;
          if (d.bend > 0.08) { ctrl.push([na.x + dx * 0.33 + nx * b1 * 0.7, na.z + dz * 0.33 + nz * b1 * 0.7], [na.x + dx * 0.67 + nx * b1, na.z + dz * 0.67 + nz * b1]); } else ctrl.push([mx + nx * b1, mz + nz * b1]);
        }
        add_edge(a, b, kind, ctrl, false);
      };
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const a = idx[j * N + i]; if (a < 0) continue;
        if (i + 1 < N && idx[j * N + i + 1] >= 0) link(a, idx[j * N + i + 1], mod(j - n, AE) === 0 ? 2 : 1, j - n);
        if (j + 1 < N && idx[(j + 1) * N + i] >= 0) link(a, idx[(j + 1) * N + i], mod(i - n, AE) === 0 ? 2 : 1, i - n);
      }
    };

    // ---- rings and spokes
    const radial = function (S0) {
      const rho = []; let r = 0, step = S0;
      while (r + step <= LIM - 4) { r += step; rho.push(r); step = S0 * (1 + 0.45 * Math.max(0, r / R - 0.5)); }
      if (rho.length < 1) { rho.push(Math.min(LIM - 4, S0)); }
      let n = density > 0.6 ? 8 : 6; const ns = [], twist = [rng() * TAU];
      for (let k = 0; k < rho.length; k++) { while (rho[k] * TAU / n > 2.1 * S0) n *= 2; if (k) twist.push(twist[k - 1]); ns.push(n); }
      const c0 = add_node(cx, cz), ids = [];
      for (let k = 0; k < rho.length; k++) {
        const row = []; for (let j = 0; j < ns[k]; j++) { const a = twist[k] + TAU * j / ns[k], rr = rho[k] + noise(a * 3 + k * 7.1, k * 3.7) * 0.04 * S0; row.push(add_node(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr)); }
        ids.push(row);
      }
      for (let j = 0; j < ns[0]; j++) add_edge(c0, ids[0][j], 2, [], false);
      for (let k = 0; k < rho.length; k++) {
        const nk = ns[k], kind = (k + 1) % 3 === 0 ? 2 : 1;
        for (let j = 0; j < nk; j++) {                                                         // the ring: arcs with points on the circle
          const a0 = twist[k] + TAU * j / nk, a1 = a0 + TAU / nk, m = Math.max(1, Math.ceil(rho[k] * TAU / nk / 30)), ctrl = [];
          for (let q = 1; q < m; q++) { const a = lerp(a0, a1, q / m); ctrl.push([cx + Math.cos(a) * rho[k], cz + Math.sin(a) * rho[k]]); }
          add_edge(ids[k][j], ids[k][(j + 1) % nk], kind, ctrl, false);
        }
        if (k + 1 < rho.length) for (let j = 0; j < nk; j++) add_edge(ids[k][j], ids[k + 1][ns[k + 1] === nk ? j : 2 * j], j % Math.max(1, nk / ns[0]) === 0 && k < 5 ? 2 : 1, [], false);
      }
    };

    // ---- lanes that grow from a street and end in a dead end
    const lane_hash = make_hash(32), lane_segs = [];
    const lane_add = function (pts, owner) { for (let k = 0; k + 1 < pts.length; k++) { const id = lane_segs.length; lane_segs.push([pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], owner]); lane_hash.add(id, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]); } };
    const tmp_ids = [];
    const lane_clear = function (x, z, owner, near_start, sx, sz, dmin) {
      lane_hash.query(x - dmin, z - dmin, x + dmin, z + dmin, tmp_ids);
      for (let i = 0; i < tmp_ids.length; i++) {
        const sg = lane_segs[tmp_ids[i]];
        if (sg[4] === owner && Math.hypot(x - sx, z - sz) < near_start) continue;
        if (pt_seg(x, z, sg[0], sg[1], sg[2], sg[3]) < dmin) return false;
      }
      return true;
    };
    const grow_lane = function (x0, z0, heading, maxlen, owner, wobble, dmin) {
      const pts = [[x0, z0]]; let x = x0, z = z0, h = heading, len = 0;
      const st = STY[0];
      while (len < maxlen) {
        h += (rng() - 0.5) * wobble;
        const nx = x + Math.cos(h) * 12, nz = z + Math.sin(h) * 12;
        if (!path_ok([[x, z], [nx, nz]], st) || !lane_clear(nx, nz, owner, 36, x0, z0, dmin)) break;
        pts.push([nx, nz]); x = nx; z = nz; len += 12;
      }
      return len >= 36 ? pts : null;
    };
    const comb = function (edge_ids, every, side_mode, maxlen, wobble, dmin, kind) {
      edge_ids.forEach(function (ei) {
        const e = G.edges[ei]; if (!e.alive) return;
        const P = make_poly(edge_pts(e)), made = [];
        let s = 20 + rng() * every * 0.5, flip = rng() < 0.5 ? 1 : -1;
        while (s < P.len - 20) {
          const q = poly_at(P, s, {}), sides = side_mode === 2 ? [1, -1] : [flip];
          sides.forEach(function (sd) {
            const heading = Math.atan2(sd * q.dx, -sd * q.dz) + (rng() - 0.5) * 0.3;
            const pts = grow_lane(q.x, q.z, heading, maxlen * (0.6 + rng() * 0.6), ei, wobble, dmin);
            if (pts) { made.push({ s: s, pts: pts }); lane_add(pts, -1 - ei); }
          });
          flip = -flip; s += every * (0.8 + rng() * 0.5);
        }
        for (let k = made.length - 1; k >= 0; k--) {                                       // from the far end: the arc length of the near ones does not change when the edge is cut
          const m = made[k], nn = split_edge(ei, m.s), end = add_node(m.pts[m.pts.length - 1][0], m.pts[m.pts.length - 1][1]);
          add_edge(nn, end, kind, m.pts.slice(1, m.pts.length - 1), true);
        }
      });
    };
    const register_edges = function () { G.edges.forEach(function (e, i) { if (e.alive) lane_add(edge_pts(e), i); }); };

    // ---- drop what cannot be: into water, over steep ground, off the radius, a spur, what is not joined to the biggest piece
    const validate = function () { G.edges.forEach(function (e) { if (e.alive && !path_ok(edge_pts(e), STY[e.kind])) e.alive = false; }); };
    const prune = function () {
      let changed = true;
      while (changed) {
        changed = false;
        for (let i = 0; i < G.nodes.length; i++) {
          const n = G.nodes[i]; if (!n.alive) continue;
          const d = deg(n);
          if (d === 0) { n.alive = false; continue; }
          if (d === 1) { for (let k = 0; k < n.adj.length; k++) { const e = G.edges[n.adj[k]]; if (e.alive && !e.keep) { e.alive = false; changed = true; } } }
        }
      }
    };
    const biggest = function () {                                                             // flood fill: only the connected piece with the most street stays
      const comp = new Int32Array(G.nodes.length).fill(-1), len = [];
      for (let i = 0; i < G.nodes.length; i++) {
        if (!G.nodes[i].alive || comp[i] >= 0 || deg(G.nodes[i]) === 0) continue;
        const c = len.length; len.push(0); comp[i] = c; const stack = [i];
        while (stack.length) {
          const ni = stack.pop(), n = G.nodes[ni];
          for (let k = 0; k < n.adj.length; k++) { const e = G.edges[n.adj[k]]; if (!e.alive) continue; const oi = e.a === ni ? e.b : e.a; if (comp[oi] < 0) { comp[oi] = c; stack.push(oi); } if (e.a === ni) len[c] += make_poly(edge_pts(e)).len; }
        }
      }
      if (!len.length) return false;
      let best = 0; len.forEach(function (l, i) { if (l > len[best]) best = i; });
      G.edges.forEach(function (e) { if (e.alive && comp[e.a] !== best) e.alive = false; });
      G.nodes.forEach(function (n, i) { if (n.alive && comp[i] !== best) n.alive = false; });
      return true;
    };
    const cleanup = function () { validate(); prune(); return biggest(); };
    const live_ids = function () { const out = []; G.edges.forEach(function (e, i) { if (e.alive) out.push(i); }); return out; };

    // ---- the layouts
    const lay_t0 = Date.now();
    if (layout === "grid") lattice(lerp(100, 62, density), { rotate: true, irr: 0.1, warp: 0, jit: 0.025, bend: 0.035, arterial_every: 3, thin: true, fit: 1.6 });
    else if (layout === "organic") lattice(lerp(105, 66, density), { rotate: true, irr: 0.26, warp: 0.3, jit: 0.07, bend: 0.12, arterial_every: 3, thin: true, fit: 1.6 });
    else if (layout === "radial") radial(lerp(105, 70, density));
    else if (layout === "suburb") {                                                           // collectors round big blocks, and cul-de-sacs grown into them
      lattice(lerp(240, 165, density), { rotate: true, irr: 0.3, warp: 0.34, jit: 0.1, bend: 0.14, arterial_every: 99, thin: false, fit: 1.3 });
      G.edges.forEach(function (e) { if (e.kind === 2) e.kind = 1; });
      if (cleanup()) { register_edges(); comb(live_ids(), lerp(70, 48, density), 1, 95, 0.5, 34, 0); }
    } else {                                                                                  // a village: a winding main street from side to side, lanes off it, lanes off the lanes
      const a0 = rng() * TAU, ca = Math.cos(a0), sa = Math.sin(a0), half = R - 26, pts = [];
      for (let t = -half; t <= half; t += 22) {
        const off = noise(t / 140 + 5.5, a0 * 3) * Math.min(60, R * 0.16) + noise(t / 45 + 1.3, 7.7) * 7;
        pts.push([cx + ca * t - sa * off, cz + sa * t + ca * off]);
      }
      let lo = Math.floor(pts.length / 2), hi = lo;                                          // the valid part of it, outwards from the middle
      while (lo > 0 && path_ok([pts[lo], pts[lo - 1]], STY[1])) lo--;
      while (hi < pts.length - 1 && path_ok([pts[hi], pts[hi + 1]], STY[1])) hi++;
      if (hi - lo >= 2) {
        const a = add_node(pts[lo][0], pts[lo][1]), b = add_node(pts[hi][0], pts[hi][1]);
        add_edge(a, b, 1, pts.slice(lo + 1, hi), true); register_edges();
        const n0 = G.edges.length;
        comb([0], lerp(70, 45, density), 2, 80, 0.45, 26, 0);
        const lanes = []; for (let i = n0; i < G.edges.length; i++) if (G.edges[i].kind === 0) lanes.push(i);
        comb(lanes, 55, 1, 55, 0.5, 26, 0);
      }
    }
    stats.ms.layout = Date.now() - lay_t0;
    if (!cleanup()) { say("no street fits on this ground (water or steep land): no city is made"); stats.ms.total = Date.now() - T0; stats.elements = 0; return result; }

    // ---- exits: the streets nearest the rim are carried out to it, where a road may join (a free end: no pad, no cap)
    const exits = [];
    {
      const K = clamp(Math.round(R / 100), 2, 10), a0 = rng() * TAU, used = new Set(), alive = [], RIM = R - 6;
      G.nodes.forEach(function (n, i) { if (n.alive && deg(n) > 0) alive.push(i); });
      const live = []; G.edges.forEach(function (e, ei) { if (e.alive) live.push({ a: e.a, b: e.b, pts: edge_pts(e) }); });
      for (let k = 0; k < K; k++) {
        const a = a0 + TAU * k / K + (rng() - 0.5) * 0.5, ux = Math.cos(a), uz = Math.sin(a);
        const cand = alive.filter(function (i) { return !used.has(i); }).map(function (i) { const n = G.nodes[i], dx = n.x - cx, dz = n.z - cz; return { i: i, score: dx * ux + dz * uz - 0.6 * Math.abs(dx * uz - dz * ux) }; }).sort(function (p, q) { return q.score - p.score; }).slice(0, 6);
        for (let c = 0; c < cand.length; c++) {
          const n = G.nodes[cand[c].i], dx = n.x - cx, dz = n.z - cz, d0 = Math.hypot(dx, dz), t = RIM - d0;
          if (t < 25) continue;                                                              // (already at the rim)
          const fx = d0 > 20 ? dx / d0 : ux, fz = d0 > 20 ? dz / d0 : uz, ex = n.x + fx * t, ez = n.z + fz * t;
          let kind = 1; n.adj.forEach(function (ei) { if (G.edges[ei].alive && G.edges[ei].kind === 2) kind = 2; });
          if (layout === "village") kind = 1;
          let cross = false;
          for (let li = 0; li < live.length && !cross; li++) {
            const e = live[li];
            if (e.a === cand[c].i || e.b === cand[c].i) {                                      // (a street of this node: the exit must leave it at an angle, not run along it: two roads on one line are drawn twice)
              const pp = e.pts, at_a = e.a === cand[c].i, p0 = at_a ? pp[0] : pp[pp.length - 1], p1 = at_a ? pp[1] : pp[pp.length - 2], l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
              if (((p1[0] - p0[0]) * fx + (p1[1] - p0[1]) * fz) / l > Math.cos(35 * DEG)) cross = true;
              continue;
            }
            const pp = e.pts; for (let q = 0; q + 1 < pp.length; q++) if (seg_cross(n.x, n.z, ex, ez, pp[q][0], pp[q][1], pp[q + 1][0], pp[q + 1][1])) { cross = true; break; }
          }
          if (cross || !path_ok([[n.x, n.z], [ex, ez]], STY[kind], RIM + 1)) continue;
          const en = add_node(ex, ez); G.nodes[en].exit = true; add_edge(cand[c].i, en, kind, [], true); used.add(cand[c].i);
          break;
        }
      }
    }

    // ================================================================================================================================ chains
    const chains = [];
    const terminal = function (ni) {
      const n = G.nodes[ni], es = n.adj.filter(function (ei) { return G.edges[ei].alive; });
      return es.length !== 2 || G.edges[es[0]].kind !== G.edges[es[1]].kind;
    };
    const visited = new Uint8Array(G.edges.length), is_term = new Uint8Array(G.nodes.length);
    G.nodes.forEach(function (n, i) { if (n.alive && deg(n) > 0 && terminal(i)) is_term[i] = 1; });
    const walk = function (start, ei0) {
      const pts = [[G.nodes[start].x, G.nodes[start].z]]; let cur = start, ei = ei0, end = -1; const kind = G.edges[ei0].kind;
      for (;;) {
        const e = G.edges[ei]; visited[ei] = 1;
        const ep = edge_pts(e); if (e.a !== cur) ep.reverse();
        for (let i = 1; i < ep.length; i++) pts.push(ep[i]);
        cur = e.a === cur ? e.b : e.a;
        if (is_term[cur]) { end = cur; break; }
        const n = G.nodes[cur]; let nxt = -1;
        for (let k = 0; k < n.adj.length; k++) { const c = n.adj[k]; if (G.edges[c].alive && c !== ei) nxt = c; }
        if (nxt < 0 || visited[nxt]) { end = cur; break; }
        ei = nxt;
      }
      return { a: start, b: end, pts: pts, kind: kind };
    };
    const rpref0 = { grid: 0.5, organic: 1.3, radial: 1.6, suburb: 1.1, village: 0.9 }[layout];
    const add_chain = function (c) {
      const st = STY[c.kind], dense = fillet(c.pts, rpref0 * 80 * (c.kind === 2 ? 1.2 : 1), st.rmin, stats);
      c.id = chains.length; c.st = st; c.poly = make_poly(dense); c.rpoly = reverse_poly(c.poly); c.len = c.poly.len; c.trim = [0, 0]; c.pieces = [];
      chains.push(c);
    };
    for (let ni = 0; ni < G.nodes.length; ni++) {
      if (!is_term[ni]) continue;
      const n = G.nodes[ni];
      for (let k = 0; k < n.adj.length; k++) { const ei = n.adj[k]; if (G.edges[ei].alive && !visited[ei]) add_chain(walk(ni, ei)); }
    }
    for (let ei = 0; ei < G.edges.length; ei++) if (G.edges[ei].alive && !visited[ei]) { is_term[G.edges[ei].a] = 1; add_chain(walk(G.edges[ei].a, ei)); }   // (a ring with no junction on it)
    stats.chains = chains.length; stats.nodes = G.nodes.filter(function (n) { return n.alive; }).length;
    stats.road_length = Math.round(chains.reduce(function (a, c) { return a + c.len; }, 0));

    // ================================================================================================================================ junctions
    const tmp = {};
    const arm_dir = function (c, end) { const P = end === 0 ? c.poly : c.rpoly, q = poly_at(P, Math.min(5, P.len * 0.5), {}), dx = q.x - P.x[0], dz = q.z - P.z[0], l = Math.hypot(dx, dz) || 1; return { dx: dx / l, dz: dz / l }; };
    chains.forEach(function (c) {
      [0, 1].forEach(function (end) {
        const ni = end === 0 ? c.a : c.b, n = G.nodes[ni]; if (!n.arms) n.arms = [];
        const d = arm_dir(c, end);
        n.arms.push({ chain: c.id, end: end, ang: Math.atan2(d.dz, d.dx), dx: d.dx, dz: d.dz });
      });
    });
    const junctions = [], pool_r = function (need) { for (let i = 0; i < POOL.length; i++) if (POOL[i] >= need) return POOL[i]; return POOL[POOL.length - 1]; };
    const pad_elems = [], ends = [];
    G.nodes.forEach(function (n, ni) {
      if (!n.alive || !n.arms) return;
      n.arms.sort(function (p, q) { return p.ang - q.ang; });
      const m = n.arms.length, arms = n.arms.map(function (a) { return { a: a, c: chains[a.chain] }; });
      let hmax = 0, wmax = 0, kmax = 0, widest = arms[0].c;
      arms.forEach(function (o) { hmax = Math.max(hmax, o.c.st.h); if (o.c.st.width > wmax) { wmax = o.c.st.width; widest = o.c; } kmax = Math.max(kmax, o.c.st.walk); });
      const surface = widest.st.surface, J = { id: junctions.length, x: r1(n.x), z: r1(n.z), r: 0, kind: "round", arms: m };
      const set_trim = function (fn) { arms.forEach(function (o) { o.c.trim[o.a.end] = Math.max(0, fn(o.c.st)); }); };
      if (m === 1) {                                                                          // a dead end: a turning head (suburb), a cap (village) or a plain end
        const o = arms[0];
        if (n.exit) { J.kind = "exit"; J.r = o.c.st.h; exits.push({ x: r1(n.x), z: r1(n.z), yaw: r3(Math.atan2(-o.a.dx, -o.a.dz) / DEG), width: o.c.st.width, kind: KINDS[o.c.st.kind] }); }
        else if (layout === "suburb") { const R0 = pool_r(Math.max(1.25 * o.c.st.h + 2.5, 8)); J.r = R0; set_trim(function (st) { return Math.sqrt(R0 * R0 - st.h * st.h) - 0.05; }); pad_elems.push({ type: "road_junction_round", x: n.x, z: n.z, yaw: 0, p: { radius: R0, surface: surface }, size: 2 * R0, node: ni }); J.kind = "head"; }
        else { J.kind = "cap"; J.r = o.c.st.h; ends.push({ x: n.x, z: n.z, dx: -o.a.dx, dz: -o.a.dz, st: o.c.st, node: ni }); }
      } else if (m === 2) {
        const R0 = pool_r(Math.max(1.2 * hmax + 1, 6)); J.r = R0; J.kind = "joint";
        set_trim(function (st) { return Math.sqrt(Math.max(0, R0 * R0 - st.h * st.h)) - 0.05; });
        pad_elems.push({ type: "road_junction_round", x: n.x, z: n.z, yaw: 0, p: { radius: R0, surface: surface }, size: 2 * R0, node: ni });
      } else if (layout === "radial" && m >= 5) {
        const R0 = Math.min(30, Math.max(12, Math.round(hmax * 2 + 4))); J.r = R0; J.kind = "roundabout";
        set_trim(function (st) { return Math.sqrt(Math.max(0, R0 * R0 - st.h * st.h)) - 0.05; });
        pad_elems.push({ type: "road_roundabout", x: n.x, z: n.z, yaw: 0, p: { radius: R0, island: 0.42 }, size: 2 * R0, node: ni });
      } else {
        // square when 3 or 4 arms lie within 6 degrees of a pair of axes
        let square = false, yaw = 0;
        if (layout === "grid" && (m === 3 || m === 4)) {
          let sx = 0, sz = 0; arms.forEach(function (o) { sx += Math.cos(4 * o.a.ang); sz += Math.sin(4 * o.a.ang); });
          const base = Math.atan2(sz, sx) / 4;                                               // the axes: base + k * 90 degrees
          let worst = 0; arms.forEach(function (o) { let dlt = mod(o.a.ang - base + Math.PI / 4, Math.PI / 2) - Math.PI / 4; worst = Math.max(worst, Math.abs(dlt)); });
          if (worst < 6 * DEG) {
            const quad = arms.map(function (o) { return mod(Math.round((o.a.ang - base) / (Math.PI / 2)), 4); });
            if (m === 4 && new Set(quad).size === 4) { square = true; yaw = (Math.PI / 2 - base) / DEG; }
            else if (m === 3 && new Set(quad).size === 3) {
              let missing = 0; for (let q = 0; q < 4; q++) if (quad.indexOf(q) < 0) missing = q;
              const stem_q = mod(missing + 2, 4), a = base + stem_q * Math.PI / 2;           // the stem points where the closed side is opposite
              square = true; yaw = Math.atan2(Math.cos(a), Math.sin(a)) / DEG;
            }
          }
        }
        if (square) {
          const W = Math.round(wmax), Rq = Math.hypot(W / 2 + kmax, W / 2 + kmax); J.kind = m === 4 ? "x" : "t"; J.r = Rq;
          set_trim(function () { return W / 2 - 0.15; });
          const p = { width: W, surface: surface }; if (m === 3) p.walk = kmax;
          pad_elems.push({ type: m === 4 ? "road_junction_x" : "road_junction_t", x: n.x, z: n.z, yaw: r3(yaw), p: p, size: W + (m === 3 ? 2 * kmax : 0), node: ni });
        } else {
          const R0 = pool_r(Math.max(1.2 * hmax + 1, 6)); J.r = R0;
          set_trim(function (st) { return Math.sqrt(Math.max(0, R0 * R0 - st.h * st.h)) - 0.05; });
          pad_elems.push({ type: "road_junction_round", x: n.x, z: n.z, yaw: 0, p: { radius: R0, surface: surface }, size: 2 * R0, node: ni });
        }
      }
      junctions.push(J); n.pad = J;
    });
    stats.junctions = {}; junctions.forEach(function (j) { stats.junctions[j.kind] = (stats.junctions[j.kind] || 0) + 1; });

    // ================================================================================================================================ street obstacles (for the lots) and the pieces
    const el = result.elements, seg_hash = make_hash(32), SEG = [];                         // SEG: [ax, az, bx, bz, r]
    const add_seg = function (ax, az, bx, bz, r) { const id = SEG.length; SEG.push([ax, az, bx, bz, r]); seg_hash.add(id, ax - r, az - r, bx + r, bz + r); };
    chains.forEach(function (c) {
      const P = c.poly; let last = 0;
      for (let i = 1; i < P.n; i++) { if (P.s[i] - P.s[last] >= 3 || i === P.n - 1) { add_seg(P.x[last], P.z[last], P.x[i], P.z[i], c.st.h); last = i; } }
    });
    pad_elems.forEach(function (p) { add_seg(p.x, p.z, p.x, p.z, p.p.radius ? p.p.radius : p.size / 2 * 1.42); });
    ends.forEach(function (e) { add_seg(e.x, e.z, e.x, e.z, e.st.h); });

    const layer = make_layer(gy, tilt);
    const lay_piece = function (type, x, z, yaw, L, Wt, p, up) { const e = layer.piece(type, x, z, yaw, L, Wt, p, up); el.push(e); return e; };
    stats.tight_pieces = 0;
    const lay_chain = function (c) {
      const st = c.st, Wt = st.width + 2 * st.walk, plan = plan_pieces(c.poly, c.trim[0], c.len - c.trim[1], st.h);
      plan.forEach(function (q, qi) {
        if (q.tight) stats.tight_pieces++;
        if (!land(q.x, q.z) || Math.hypot(q.x - cx, q.z - cz) > R - 4) return;
        const p = { length: q.L, width: st.width }; if (st.type !== "road_dirt") p.walk = st.walk;
        c.pieces.push(piece_record(gy, lay_piece(st.type, q.x, q.z, q.yaw, q.L, Wt, p, qi & 1 ? 0.012 : 0), q.s));
      });
    };
    chains.forEach(lay_chain);
    pad_elems.forEach(function (p) { lay_piece(p.type, p.x, p.z, p.yaw, p.size, p.size, p.p); });
    ends.forEach(function (e) {
      const yaw = Math.atan2(e.dx, e.dz) / DEG, p = { width: e.st.width, surface: e.st.surface, walk: e.st.walk };
      lay_piece("road_end", e.x, e.z, yaw, e.st.width, e.st.width, p);
    });
    const surface_at = function (c, s, x, z) { return surface_of(gy, c.pieces, s, x, z); };
    stats.ms.roads = Date.now() - T0;

    // ================================================================================================================================ blocks (the faces of the graph)
    const he_face = new Int32Array(chains.length * 2).fill(-1), faces = [];
    {
      const head = function (he) { const c = chains[he >> 1]; return (he & 1) === 0 ? c.b : c.a; };
      const nxt = function (he) {
        const c = chains[he >> 1], v = head(he), n = G.nodes[v], arms = n.arms, end = (he & 1) === 0 ? 1 : 0;
        let idx = 0; for (let i = 0; i < arms.length; i++) if (arms[i].chain === c.id && arms[i].end === end) { idx = i; break; }
        const a = arms[(idx - 1 + arms.length) % arms.length];
        return a.chain * 2 + (a.end === 0 ? 0 : 1);
      };
      let outer = -1;
      for (let h0 = 0; h0 < chains.length * 2; h0++) {
        if (he_face[h0] >= 0) continue;
        const list = []; let h = h0, guard = 0;
        do { list.push(h); h = nxt(h); } while (h !== h0 && ++guard < chains.length * 2 + 4);
        const poly = [];
        list.forEach(function (hh) { const P = (hh & 1) === 0 ? chains[hh >> 1].poly : chains[hh >> 1].rpoly; for (let i = poly.length ? 1 : 0; i < P.n; i++) poly.push([P.x[i], P.z[i]]); });
        const area = poly_area(poly);
        if (area <= 20) {                                                                     // the outside of the streets (a tree of streets has only it): lots go along it too, anywhere inside the radius
          if (outer < 0) { outer = faces.length; faces.push({ id: outer, outer: true, area: 1e9, x: cx, z: cz, poly: [], hes: [], park: 0, style: null }); }
          list.forEach(function (hh) { he_face[hh] = outer; faces[outer].hes.push(hh); }); continue;
        }
        let gx = 0, gz = 0; poly.forEach(function (q) { gx += q[0]; gz += q[1]; });
        const id = faces.length; faces.push({ id: id, area: area, x: gx / poly.length, z: gz / poly.length, poly: poly, hes: list, park: 0, style: null });
        list.forEach(function (hh) { he_face[hh] = id; });
      }
    }
    // the plaza and the parks
    const rng_p = mulberry32(hash2(seed, 505));
    {
      const ok = faces.filter(function (f) { return !f.outer && f.area > 1200 && f.area < 22000; });
      if (layout === "village") { let best = null, bd = 1e9; ok.forEach(function (f) { const d = Math.hypot(f.x - cx, f.z - cz); if (d < bd) { bd = d; best = f; } }); if (best) best.park = 1; }
      else {
        const pp = 0.05 + 0.1 * (1 - density);
        ok.forEach(function (f) { if (rng_p() < pp) f.park = 1; });
        if (R >= 180 && layout !== "suburb") { let best = null, bd = 1e9; faces.forEach(function (f) { if (f.outer || f.area < 1800 || f.area > 14000) return; const d = Math.hypot(f.x - cx, f.z - cz); if (d < bd) { bd = d; best = f; } }); if (best) best.park = 2; }
      }
    }
    stats.blocks = faces.filter(function (f) { return !f.outer; }).length;

    // ================================================================================================================================ lots
    const lot_hash = make_hash(40), LOTS = [], tmp_a = [], tmp_b = [], request_seed = hash2(seed, 606);
    const zone = function (x, z) { return clamp(1 - Math.hypot(x - cx, z - cz) / R, 0, 1); };
    const style_at = function (px, pz, r) {
      if (default_styles) {
        const t = zone(px, pz), w = { residential: 0.35 + 0.5 * (1 - Math.abs(t - 0.35)), commercial: 0.04 + 1.1 * Math.pow(t, 2) * (0.4 + density), industrial: 0.05 + 0.5 * (1 - t) * (1 - t), civic: 0.1 + 0.15 * t };
        if (layout === "suburb") { w.commercial *= 0.15; w.industrial *= 0.2; }
        if (layout === "village") { w.commercial = 0.03; w.industrial = 0; w.civic = 0.04; }
        let sum = 0; style_names.forEach(function (k) { sum += w[k]; });
        let x = r() * sum, pick = style_names[0]; for (let i = 0; i < style_names.length; i++) { x -= w[style_names[i]]; if (x <= 0) { pick = style_names[i]; break; } }
        return pick;
      }
      let x = r() * bsum, pick = style_names[0]; for (let i = 0; i < style_names.length; i++) { x -= bstyles[style_names[i]]; if (x <= 0) { pick = style_names[i]; break; } }
      return pick;
    };
    const pick_style = function (f) { return f.outer ? null : style_at(f.x, f.z, mulberry32(hash2(seed, 700 + f.id))); };
    // what a style asks of a lot: [min width, max width, depth, set-back, deepest building]
    const lot_rule = function (style) {
      const sub = layout === "suburb", vil = layout === "village", s = style;
      let w0, w1, d0, fs, bd;
      if (s === "commercial") { w0 = 14; w1 = 28; d0 = 28; fs = 0.6; bd = 24; }
      else if (s === "industrial") { w0 = 20; w1 = 38; d0 = 34; fs = 4; bd = 30; }
      else if (s === "civic") { w0 = 22; w1 = 32; d0 = 32; fs = 5; bd = 26; }
      else { w0 = 10; w1 = 16; d0 = 26; fs = 3.5; bd = 12; }
      if (sub) { w0 += 5; w1 += 7; d0 += 6; fs += 3.5; }
      if (vil) { w0 -= 2; w1 -= 2; d0 -= 4; fs = 2; }
      return { w0: w0, w1: w1, d0: d0, fs: fs, bd: bd };
    };
    const floors_for = function (style, x, z, rr) {
      const t = zone(x, z), base = fl[0] + (fl[1] - fl[0]) * Math.pow(t, 1.3) * (0.45 + 0.7 * density), bonus = style === "commercial" ? 0.2 * (fl[1] - fl[0]) : 0;
      let f = Math.round(base + bonus + (rr() - 0.5) * 2);
      if (style === "industrial") f = Math.min(f, Math.max(fl[0], 2));
      if (layout === "village") f = Math.min(f, 2);
      return clamp(f, fl[0], fl[1]);
    };
    const corners = function (o) { return [[-o.hw, -o.hd], [o.hw, -o.hd], [o.hw, o.hd], [-o.hw, o.hd]].map(function (q) { return [o.x + q[0] * o.c + q[1] * o.s, o.z - q[0] * o.s + q[1] * o.c]; }); };
    const lot_ok = function (o) {
      const cs = corners(o);
      for (let i = 0; i < 4; i++) if (Math.hypot(cs[i][0] - cx, cs[i][1] - cz) > R - 2) return -1;
      let ymin = 1e9, ymax = -1e9;
      const pts = cs.concat([[o.x, o.z], [(cs[0][0] + cs[1][0]) / 2, (cs[0][1] + cs[1][1]) / 2], [(cs[2][0] + cs[3][0]) / 2, (cs[2][1] + cs[3][1]) / 2]]);
      for (let i = 0; i < pts.length; i++) { if (!land(pts[i][0], pts[i][1])) return -1; const y = gy(pts[i][0], pts[i][1]); if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
      if (ymax - ymin > 2.0) return -1;
      const rad = Math.hypot(o.hw, o.hd) + 1, ids = seg_hash.query(o.x - rad - 12, o.z - rad - 12, o.x + rad + 12, o.z + rad + 12, tmp_a);
      for (let i = 0; i < ids.length; i++) {
        const sg = SEG[ids[i]], dx0 = sg[0] - o.x, dz0 = sg[1] - o.z, dx1 = sg[2] - o.x, dz1 = sg[3] - o.z;
        const d = seg_box(dx0 * o.c - dz0 * o.s, dx0 * o.s + dz0 * o.c, dx1 * o.c - dz1 * o.s, dx1 * o.s + dz1 * o.c, o.hw, o.hd);
        if (d < sg[4] + 0.25) return -1;
      }
      const ls = lot_hash.query(o.x - rad, o.z - rad, o.x + rad, o.z + rad, tmp_b);
      for (let i = 0; i < ls.length; i++) if (obb_hit(o, LOTS[ls[i]], 0.4)) return -1;
      return ymax - ymin;
    };
    const default_build = function (q) {                                                      // (a BOX: sizes in a few steps, a mesh is made for each, so a city of thousands asks for dozens)
      const fit = function (v, list) { let b = list[0]; for (let i = 0; i < list.length; i++) if (list[i] <= v + 0.01) b = list[i]; return b; };
      const p = { width: fit(q.w, [4, 6, 8, 12, 16, 24]), depth: fit(q.d, [4, 6, 8, 12, 16]), height: fit(3 * q.floors, [3, 6, 9, 12, 18, 24]) };
      if (q.style === "industrial") { p.color = [0.5, 0.5, 0.48]; p.height = Math.min(p.height, 6); }
      else if (q.style === "commercial") p.color = [0.62, 0.6, 0.58];
      else if (q.style === "civic") p.color = [0.72, 0.68, 0.58];
      return [{ type: "box", x: 0, z: 0, yaw: 0, p: p }];
    };
    const build_fn = builder || default_build;
    stats.buildings = 0; stats.builder_errors = 0;
    const emit_building = function (q) {
      let res = null;
      try { res = build_fn(q); } catch (e) { stats.builder_errors++; say("make_building threw (" + String(e && e.message || e).slice(0, 80) + "): that lot has no building"); return 0; }
      let list = Array.isArray(res) ? res : res && Array.isArray(res.elements) ? res.elements : null; const world_all = !!(res && !Array.isArray(res) && res.world);
      if (!list) { stats.builder_errors++; say("make_building returns a list of elements: a lot was left empty"); return 0; }
      const c = Math.cos(q.yaw * DEG), s = Math.sin(q.yaw * DEG); let n = 0;
      list.forEach(function (o) {
        if (!o || typeof o.type !== "string" || !isnum(o.x || 0) || !isnum(o.z || 0)) { stats.builder_errors++; return; }
        const world = world_all || o.world === true, lx = o.x || 0, lz = o.z || 0;
        const e = { type: o.type, x: r3(world ? lx : q.x + lx * c + lz * s), z: r3(world ? lz : q.z - lx * s + lz * c), yaw: r3(world ? (o.yaw || 0) : q.yaw + (o.yaw || 0)), scale: o.scale === undefined ? 1 : o.scale, dy: o.dy || 0, pitch: o.pitch || 0, roll: o.roll || 0, p: o.p };
        if (!isnum(e.x) || !isnum(e.z) || !isnum(e.yaw) || !isnum(e.scale) || !isnum(e.dy)) { stats.builder_errors++; return; }
        el.push(e); n++;
      });
      return n;
    };
    const tree_at = function (x, z, big) {
      const k = hash2(Math.floor(x * 10), Math.floor(z * 10)) % 4;
      const v = [["tree", { height: 5, crown: 2.2 }], ["tree", { height: 6.5, crown: 2.6 }], ["tree", { height: 8, crown: 3.2 }], ["pine", { height: 8, radius: 2 }]][big ? 2 - (k & 1) : k];
      el.push({ type: v[0], x: r3(x), z: r3(z), yaw: r3(hash2(Math.floor(x), Math.floor(z)) % 360), scale: 1, dy: 0, pitch: 0, roll: 0, p: v[1] });
    };
    const rng_l = mulberry32(hash2(seed, 800));
    const lot_t0 = Date.now(); stats.lots = 0; stats.parks = 0;
    faces.forEach(function (f) { f.style = pick_style(f); });
    chains.forEach(function (c) {
      [0, 1].forEach(function (dir) {
        const he = c.id * 2 + dir, fi = he_face[he]; if (fi < 0) return;
        const f = faces[fi]; if (f.park || f.area < 300) return;
        const P = dir === 0 ? c.poly : c.rpoly, trA = c.trim[dir === 0 ? 0 : 1], trB = c.trim[dir === 0 ? 1 : 0], st = c.st;
        const s_end = P.len - trB - 0.8; let s = trA + 0.8, guard = 0;
        const q0 = {}, q1 = {};
        while (s < s_end - 8 && guard++ < 4000) {
          poly_at(P, s, q0);
          const style = f.style || style_at(q0.x, q0.z, rng_l), rule = lot_rule(style);
          let w = rule.w0 + rng_l() * (rule.w1 - rule.w0);
          if (s + w > s_end) w = s_end - s;
          if (w < Math.min(8, rule.w0)) break;
          poly_at(P, s + w, q1);
          let tx = q1.x - q0.x, tz = q1.z - q0.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
          const nx = -tz, nz = tx, mx = (q0.x + q1.x) / 2, mz = (q0.z + q1.z) / 2, yaw = Math.atan2(-nx, -nz) / DEG, cy = Math.cos(yaw * DEG), sy = Math.sin(yaw * DEG);
          let got = null;
          for (let oi = 0; oi < 3 && !got; oi++) {
            const off = st.h + [0.4, 1.3, 2.6][oi];
            for (let di = 0; di < 4 && !got; di++) {
              const ld = rule.d0 * [1, 0.8, 0.62, 0.48][di] * (0.9 + 0.2 * rng_l());
              if (ld < 12) continue;
              const o = { x: mx + nx * (off + ld / 2), z: mz + nz * (off + ld / 2), c: cy, s: sy, hw: tl / 2, hd: ld / 2 };
              const rise = lot_ok(o);
              if (rise >= 0) got = { o: o, ld: ld, off: off, rise: rise };
            }
          }
          if (!got) { s += 4; continue; }
          const lid = LOTS.length, o = got.o; o.id = lid; LOTS.push(o);
          const rad = Math.hypot(o.hw, o.hd); lot_hash.add(lid, o.x - rad, o.z - rad, o.x + rad, o.z + rad);
          const lot = { id: lid, x: r3(o.x), z: r3(o.z), yaw: r3(yaw), w: r1(tl), d: r1(got.ld), kind: "building", block: f.outer ? -1 : f.id, style: style, floors: 0 };
          if (rng_l() < 0.035 + (layout === "village" ? 0.02 : 0)) {                        // a pocket park: some trees and a bench
            lot.kind = "park"; stats.parks++;
            const nt = 2 + ((rng_l() * 4) | 0);
            for (let i = 0; i < nt; i++) { const lx = (rng_l() - 0.5) * (tl - 3), lz = (rng_l() - 0.5) * (got.ld - 4); tree_at(o.x + lx * o.c + lz * o.s, o.z - lx * o.s + lz * o.c, rng_l() < 0.5); }
            if (props > 0.2) { const bz = -got.ld / 2 + 1.2, bx = o.x + bz * o.s, bzz = o.z + bz * o.c; el.push({ type: "street_bench", x: r3(bx), z: r3(bzz), yaw: r3(yaw), scale: 1, dy: SINK, pitch: 0, roll: 0, p: { length: 1.8 } }); }
          } else {
            const fs = rule.fs + rng_l() * 1.5, bw = Math.max(6, tl - (style === "commercial" ? 0.8 : 3.2)), bdp = Math.max(6, Math.min(rule.bd, got.ld - fs - 3)), floors = floors_for(style, o.x, o.z, rng_l);
            const bcz = -got.ld / 2 + fs + bdp / 2, bx = o.x + bcz * o.s, bz = o.z + bcz * o.c;
            const q = { x: r3(bx), z: r3(bz), yaw: r3(yaw), w: r1(bw), d: r1(bdp), floors: floors, style: style, seed: hash2(request_seed, lid), lot: lid, y: r3(gy(bx, bz)), rise: r3(got.rise), lot_w: lot.w, lot_d: lot.d, corner: s < trA + 6 || s + w > s_end - 6, front: [r3(sy), r3(cy)] };
            lot.floors = floors;
            if (emit_building(q) > 0) stats.buildings++;
            if (rng_l() < props * (layout === "suburb" || layout === "village" ? 0.8 : 0.35)) {   // a tree in the yard
              const lx = (rng_l() - 0.5) * (tl - 4), lz = got.ld / 2 - 2.5 - rng_l() * 2;
              tree_at(o.x + lx * o.c + lz * o.s, o.z - lx * o.s + lz * o.c, false);
            }
          }
          result.lots.push(lot);
          s += w + 0.3;
        }
      });
    });
    stats.lots = result.lots.length;
    stats.ms.lots = Date.now() - lot_t0;

    // ---- the parks and plazas: trees where no street is near, a paved middle, benches
    faces.forEach(function (f) {
      if (!f.park) return;
      const poly = f.poly; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; poly.forEach(function (q) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); });
      const clear = function (x, z) {
        const ids = seg_hash.query(x - 20, z - 20, x + 20, z + 20, tmp_a); let d = 1e9;
        for (let i = 0; i < ids.length; i++) { const sg = SEG[ids[i]]; d = Math.min(d, pt_seg(x, z, sg[0], sg[1], sg[2], sg[3]) - sg[4]); }
        return d;
      };
      const placed = [], want = Math.min(70, Math.round(f.area / 90));
      let plaza = null; const tiles = [];
      if (f.park === 2) {                                                                     // the plaza: a paved square round the middle of the block, as big as the block allows
        for (let size = 24; size >= 8 && !plaza; size -= 8) { let okp = true; for (let k = 0; k < 4 && okp; k++) { const px = f.x + (k & 1 ? size : -size) / 2, pz = f.z + (k & 2 ? size : -size) / 2; if (!in_poly(poly, px, pz) || clear(px, pz) < 3 || !land(px, pz)) okp = false; } if (okp) plaza = size; }
        if (plaza) { const n = plaza / 8; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const px = f.x - plaza / 2 + 4 + i * 8, pz = f.z - plaza / 2 + 4 + j * 8; tiles.push(lay_piece("road_paving", px, pz, 0, 8, 8, { width: 8, length: 8 })); } }
      }
      for (let tries = 0; tries < want * 6 && placed.length < want; tries++) {
        const x = x0 + rng_p() * (x1 - x0), z = z0 + rng_p() * (z1 - z0);
        if (!in_poly(poly, x, z) || clear(x, z) < 2.8 || !land(x, z)) continue;
        if (plaza && Math.abs(x - f.x) < plaza / 2 + 1 && Math.abs(z - f.z) < plaza / 2 + 1 && rng_p() < 0.85) continue;
        let near = false; for (let i = 0; i < placed.length; i++) if (Math.hypot(placed[i][0] - x, placed[i][1] - z) < 5.5) { near = true; break; }
        if (near) continue;
        placed.push([x, z]); tree_at(x, z, rng_p() < 0.4);
      }
      if (plaza) for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, px = f.x + Math.cos(a) * (plaza / 2 - 1), pz = f.z + Math.sin(a) * (plaza / 2 - 1); let t0 = tiles[0], bd = 1e9; tiles.forEach(function (t) { const d = Math.hypot(t.x - px, t.z - pz); if (d < bd) { bd = d; t0 = t; } }); el.push({ type: "street_bench", x: r3(px), z: r3(pz), yaw: r3(Math.atan2(-Math.cos(a), -Math.sin(a)) / DEG), scale: 1, dy: r3(t0.dy + TOP + 0.04 + gy(t0.x, t0.z) - gy(px, pz)), pitch: 0, roll: 0, p: { length: 1.8 } }); }
      stats.parks++;
    });

    // ================================================================================================================================ street furniture
    const fur_t0 = Date.now(), rng_s = rng_f;
    const rim_ok = function (x, z) { return land(x, z) && Math.hypot(x - cx, z - cz) <= R - 2; };
    const furn = function (type, c, s, side, lat, p, yaw_extra, up) {                         // on chain c at arc s, on the `side` (+1 left), `lat` metres from the middle of the road
      const e = furn_at(gy, rim_ok, c.poly, c.pieces, s, side, lat, type, p, (c.st.walk >= 1.2 && lat < c.st.width / 2 + c.st.walk ? WALK_H : 0) + (up || 0), yaw_extra);
      if (e) el.push(e);
      return e;
    };
    stats.furniture = 0;
    if (props > 0) chains.forEach(function (c) {
      const st = c.st, lo = c.trim[0] + 5, hi = c.len - c.trim[1] - 5; if (hi - lo < 8) return;
      const lat = st.width / 2 + (st.walk >= 1.2 ? 0.55 : 0.8), sp = (st.kind === 2 ? 32 : 40) / Math.max(0.3, props), lamp = st.kind === 2 ? { height: 8, arm: 2 } : { height: 6, arm: 1.4 };
      if (layout !== "village" || props > 0.5) {
        let k = 0; for (let s = lo + rng_s() * sp * 0.4; s < hi; s += sp, k++) {
          if (st.kind === 2) { furn("street_lamp", c, s, 1, lat, lamp); furn("street_lamp", c, s + sp * 0.5, -1, lat, lamp); stats.furniture += 2; }
          else { furn("street_lamp", c, s, k % 2 ? 1 : -1, lat, lamp); stats.furniture++; }
        }
      }
      if (st.walk >= 2) {
        for (let s = lo + rng_s() * 40; s < hi; s += (55 + rng_s() * 40) / Math.max(0.3, props)) { furn("street_bench", c, s, rng_s() < 0.5 ? 1 : -1, st.width / 2 + st.walk - 0.5, { length: 1.8 }, 180); stats.furniture++; }
        for (let s = lo + rng_s() * 50; s < hi; s += (70 + rng_s() * 40) / Math.max(0.3, props)) { furn("street_bin", c, s, rng_s() < 0.5 ? 1 : -1, st.width / 2 + 0.45, {}); stats.furniture++; }
        if (st.kind >= 1) for (let s = lo + rng_s() * 150; s < hi; s += (230 + rng_s() * 80) / Math.max(0.3, props)) { furn("street_bus_stop", c, s, rng_s() < 0.5 ? 1 : -1, st.width / 2 + 1.35, { length: 3.6 }); stats.furniture++; }
      }
      for (let s = lo + rng_s() * 70; s < hi; s += (95 + rng_s() * 60) / Math.max(0.3, props)) { furn("street_hydrant", c, s, rng_s() < 0.5 ? 1 : -1, st.width / 2 + 0.4, {}); stats.furniture++; }
    });
    // at the junctions: a signpost, a traffic light on the big roads, a crossing on the arms
    if (props > 0) G.nodes.forEach(function (n) {
      if (!n.alive || !n.arms || !n.pad || n.pad.kind === "cap" || n.pad.kind === "exit") return;
      n.arms.forEach(function (a) {
        const c = chains[a.chain], st = c.st, s = a.end === 0 ? c.trim[0] + 1.2 : c.len - c.trim[1] - 1.2;
        if (c.len < 30) return;
        const sd = a.end === 0 ? -1 : 1;                                                      // the right of the traffic that comes toward the node
        const big = st.kind >= 1 && n.arms.length >= 3;
        if (big && st.walk >= 2 && rng_s() < Math.min(1, props * 1.3)) {
          const v = rng_s() < 0.5; furn(v && st.kind === 2 ? "street_traffic_light" : "street_signpost", c, s, sd, st.width / 2 + 0.5, v && st.kind === 2 ? { height: 4.6, arm: 2.4 } : { height: 2.7 }, 0); stats.furniture++;
        }
        if (st.walk >= 2 && n.arms.length >= 3 && rng_s() < props * 0.9) {                    // a crossing, 3 m long, on the asphalt
          const cs = a.end === 0 ? c.trim[0] + 2.4 : c.len - c.trim[1] - 2.4, q = poly_at(c.poly, cs, tmp), yaw = Math.atan2(q.dx, q.dz) / DEG;
          if (!land(q.x, q.z)) return;
          const top = surface_at(c, cs, q.x, q.z), e = { type: "road_crossing", x: r3(q.x), z: r3(q.z), yaw: r3(yaw), scale: 1, dy: r3(top - (gy(q.x, q.z) - SINK)), pitch: 0, roll: 0, p: { width: st.width, length: 3 } };
          let nearest = null, bd = 1e9; c.pieces.forEach(function (pc) { const d = Math.abs(pc.s - cs); if (d < bd) { bd = d; nearest = pc; } });
          if (nearest) { e.pitch = r3(Math.atan(nearest.tp) / DEG); e.roll = r3(Math.atan(nearest.tr) / DEG); }
          el.push(e); stats.furniture++;
        }
      });
    });
    stats.ms.furniture = Date.now() - fur_t0;

    // ================================================================================================================================ the answer
    chains.forEach(function (c) {
      const pts = [], P = c.poly; for (let s = 0; s < P.len; s += 6) { const q = poly_at(P, s, {}); pts.push([r1(q.x), r1(q.z)]); } const q = poly_at(P, P.len, {}); pts.push([r1(q.x), r1(q.z)]);
      result.roads.push({ id: c.id, points: pts, width: c.st.width, walk: c.st.walk, kind: KINDS[c.kind], type: c.st.type, length: r1(c.len), trim: [r1(c.trim[0]), r1(c.trim[1])], a: G.nodes[c.a].pad ? G.nodes[c.a].pad.id : -1, b: G.nodes[c.b].pad ? G.nodes[c.b].pad.id : -1 });
    });
    result.junctions = junctions; result.exits = exits;
    faces.forEach(function (f) {
      if (f.outer) return;
      const poly = []; f.poly.forEach(function (q, i) { if (i % 3 === 0 || i === f.poly.length - 1) poly.push([r1(q[0]), r1(q[1])]); });
      result.blocks.push({ id: f.id, x: r1(f.x), z: r1(f.z), area: Math.round(f.area), kind: f.park === 2 ? "plaza" : f.park ? "park" : "block", style: f.style, poly: poly });
    });
    // the areas: the whole place, and from 150 m its districts (squares of 140 m: a circle of 100 m holds one)
    const NAMES_A = ["Oak", "Elm", "River", "Stone", "Mill", "Fair", "North", "Harbor", "Green", "Red", "Silver", "Bright", "Ash", "Cold", "Fox"], NAMES_B = ["ford", "ton", "field", "wick", "haven", "brook", "bury", "port", "gate", "mere", "dale", "stead"];
    const rn = mulberry32(hash2(seed, 900)), pname = NAMES_A[(rn() * NAMES_A.length) | 0] + NAMES_B[(rn() * NAMES_B.length) | 0];
    result.areas.push({ kind: layout === "village" ? "village" : "city", name: pname, x: r1(cx), z: r1(cz), r: Math.round(R) });
    if (R >= 150) {
      const cell = 140, cells = new Map(), DN = ["Old Town", "Market Quarter", "Riverside", "Hillside", "Station District", "Garden Quarter", "Harbour Row", "The Heights", "Mill Lane", "Park Side", "Foundry", "Cross Quarter", "Orchard", "Lantern District", "Westgate", "Eastgate"];
      const touch = function (x, z) { const i = Math.floor((x - cx) / cell), j = Math.floor((z - cz) / cell), k = i + "," + j; let c = cells.get(k); if (!c) { c = { i: i, j: j, n: 0 }; cells.set(k, c); } c.n++; };
      el.forEach(function (e) { touch(e.x, e.z); });
      const list = Array.from(cells.values()).filter(function (c) { return c.n >= 12; }).sort(function (a, b) { return a.j - b.j || a.i - b.i; });
      list.forEach(function (c, i) { result.areas.push({ kind: "district", name: DN[(i + (hash2(seed, 1) % 7)) % DN.length] + (i >= DN.length ? " " + (1 + Math.floor(i / DN.length)) : ""), x: r1(cx + (c.i + 0.5) * cell), z: r1(cz + (c.j + 0.5) * cell), r: 100 }); });
    }
    // numbers
    if (opts.pieces !== true) strip_pieces(el);
    const keys = {}; const by = {};
    el.forEach(function (e) { by[e.type] = (by[e.type] || 0) + 1; const k = e.type + JSON.stringify(e.p || {}, Object.keys(e.p || {}).sort()); keys[k] = 1; });
    stats.elements = el.length; stats.keys = Object.keys(keys).length; stats.by_type = by; stats.districts = result.areas.length - 1;
    stats.center = [r1(cx), r1(cz)]; stats.ms.total = Date.now() - T0;
    if (stats.tight_bends) say(stats.tight_bends + " bends are tighter than a lorry's turn (the streets there are too short to round)");
    return result;
  }

  return { generate: generate, lay: lay, LAYOUTS: LAYOUTS, tilt_of: tilt_of, road_style: road_style };
});
