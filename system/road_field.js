packing()("happy_road_field", function happy_road_field() {
  "use strict";
  // THE ROADS AS A FIELD, NOT A MESH. A road is not drawn: the terrain's shader asks, for every pixel of the ground, "how far is the nearest road, and which?" and paints asphalt, kerb, sidewalk, markings from the answer. So a road is
  // exactly the ground (a car on it is on the heightmap its physics knows: nothing sinks, no coplanar layers fight), its edge is as sharp as a pixel at any distance, and the corner of two roads is round where their fields join
  // (a smooth minimum of the distances: the kerb fillet, with nothing to overlap). Pure: no engine, no DOM. Node 14 and the bundler's parser: no optional chaining, no ??, no class, no async functions.
  //
  //   F = build({ roads: [{ points: [[x, z]], width, walk, cls }], pads: [{ x, z, r, walk, cls }] }, { size (metres a side of the area the roads are in, centred on 0), cell (16) }) -> field
  //   field = { n (cells a side), cell, ox, oz (the grid's corner), cells: Float32Array(n * n * 4) (x: the first entry of the cell, y: how many), list: Float32Array(row * rows * 4), row, rows, entries (how many in the list), items (the capsules themselves: [ax, az, bx, bz, half width, walk, arc length, class + 8 for a disc + 16 x id]), segments, pads }
  //   A road is cut into its segments, a junction pad is a segment of no length (a disc). An ENTRY is two texels: (ax, az, bx, bz) and (half width, walk, the arc length at a, class + 8 for a junction disc + 16 x the road's id: a disc has an id of its own). A cell lists every entry that
  //   reaches it (its box grown by half the width, the sidewalk and the blend). The shader (environment.js road_at) and `at` here are the same function: the entries of the cell, the capsule distance of each to the point minus its half width, joined
  //   by a polynomial smooth minimum (K metres); the entry nearest the point gives the rest (walk, class, lateral position, arc length).
  //   at(field, x, z) -> { d (< 0 on the asphalt, 0 .. walk on the sidewalk), walk, cls, lat (metres left of the line of travel), along, hw, junction, other (the distance to the nearest other road's asphalt: 1000 when none is near) } or null where no road reaches
  //   CLASSES: 0 asphalt street, 1 asphalt arterial (edge lines), 2 cobble, 3 dirt, 4 gravel (a road between places)
  const K = 2.0, MAX_PER_CELL = 16, CLASSES = ["street", "arterial", "cobble", "dirt", "gravel"];

  // a centre line with the points that lie on a straight run taken out (Douglas-Peucker, tol metres): the generator samples every 6 m, a straight street of 80 m is one segment. The arc length is kept for each kept point.
  function simplify(P, tol) {
    const n = P.length, s = new Array(n); s[0] = 0;
    for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
    const stack = [[0, n - 1]];
    while (stack.length) {
      const r = stack.pop(), a = r[0], b = r[1]; if (b - a < 2) continue;
      const abx = P[b][0] - P[a][0], abz = P[b][1] - P[a][1], l = Math.hypot(abx, abz) || 1;
      let worst = 0, at = -1;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((P[i][0] - P[a][0]) * abz - (P[i][1] - P[a][1]) * abx) / l; if (d > worst) { worst = d; at = i; } }
      if (worst > tol) { keep[at] = 1; stack.push([a, at]); stack.push([at, b]); }
    }
    const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push({ x: P[i][0], z: P[i][1], s: s[i] });
    return out;
  }

  function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }

  function build(input, opts) {
    opts = opts || {};
    const size = opts.size > 0 ? opts.size : 4096;
    let cell = opts.cell > 0 ? opts.cell : 16;
    while (size / cell > 512) cell *= 2;                                                     // (a grid of at most 512 x 512 cells)
    const n = Math.max(1, Math.ceil(size / cell)), ox = -size / 2, oz = -size / 2;
    const entries = [];                                                                       // [ax, az, bx, bz, hw, walk, s0, cls]
    let segments = 0, pads = 0;
    (input.roads || []).forEach(function (r, road_id) {
      const P = r.points; if (!P || P.length < 2) return;
      const hw = r.width / 2, walk = r.walk || 0, cls = r.cls | 0, Q = simplify(P, 0.04);
      for (let i = 0; i + 1 < Q.length; i++) { if (Math.hypot(Q[i + 1].x - Q[i].x, Q[i + 1].z - Q[i].z) > 1e-4) { entries.push([Q[i].x, Q[i].z, Q[i + 1].x, Q[i + 1].z, hw, walk, Q[i].s, cls + 16 * road_id]); segments++; } }
    });
    (input.pads || []).forEach(function (q, k) { entries.push([q.x, q.z, q.x, q.z, q.r, q.walk || 0, 0, (q.cls | 0) + 8 + 16 * (500000 + k)]); pads++; });
    // the entries of each cell: every entry that reaches it
    const lists = new Array(n * n), reach = 3;
    entries.forEach(function (e, id) {
      const m = e[4] + e[5] + K + reach, x0 = Math.min(e[0], e[2]) - m, x1 = Math.max(e[0], e[2]) + m, z0 = Math.min(e[1], e[3]) - m, z1 = Math.max(e[1], e[3]) + m;
      const i0 = Math.max(0, Math.floor((x0 - ox) / cell)), i1 = Math.min(n - 1, Math.floor((x1 - ox) / cell)), j0 = Math.max(0, Math.floor((z0 - oz) / cell)), j1 = Math.min(n - 1, Math.floor((z1 - oz) / cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        // the capsule really reaches this cell (a long diagonal's box does not)
        const cx = ox + (i + 0.5) * cell, cz = oz + (j + 0.5) * cell, ab = [e[2] - e[0], e[3] - e[1]], l2 = ab[0] * ab[0] + ab[1] * ab[1];
        const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((cx - e[0]) * ab[0] + (cz - e[1]) * ab[1]) / l2)) : 0;
        if (Math.hypot(cx - (e[0] + ab[0] * t), cz - (e[1] + ab[1] * t)) > cell * 0.7072 + m) continue;
        (lists[j * n + i] || (lists[j * n + i] = [])).push(id);
      }
    });
    // the cells' lists in one list of entries (an entry is copied into every cell that has it: the shader reads an entry without a second look-up)
    let total = 0, over = 0; for (let c = 0; c < lists.length; c++) if (lists[c]) { total += Math.min(lists[c].length, MAX_PER_CELL); if (lists[c].length > MAX_PER_CELL) over++; }
    const row = 2048, texels = total * 2, rows = Math.max(1, Math.ceil(texels / row));
    const cells = new Float32Array(n * n * 4), list = new Float32Array(row * rows * 4);
    let at = 0;
    for (let c = 0; c < lists.length; c++) {
      const L = lists[c]; if (!L) continue;
      // the nearest ones first when a cell holds too many: (the cell's middle decides)
      let ids = L;
      if (L.length > MAX_PER_CELL) {
        const i = c % n, j = (c - i) / n, cx = ox + (i + 0.5) * cell, cz = oz + (j + 0.5) * cell;
        ids = L.slice().sort(function (a, b) { const ea = entries[a], eb = entries[b]; return Math.hypot(cx - (ea[0] + ea[2]) / 2, cz - (ea[1] + ea[3]) / 2) - Math.hypot(cx - (eb[0] + eb[2]) / 2, cz - (eb[1] + eb[3]) / 2); }).slice(0, MAX_PER_CELL);
      }
      cells[c * 4] = at; cells[c * 4 + 1] = ids.length;
      ids.forEach(function (id) { const e = entries[id], o = at * 2 * 4; list[o] = e[0]; list[o + 1] = e[1]; list[o + 2] = e[2]; list[o + 3] = e[3]; list[o + 4] = e[4]; list[o + 5] = e[5]; list[o + 6] = e[6]; list[o + 7] = e[7]; at++; });
    }
    return { n: n, cell: cell, ox: ox, oz: oz, cells: cells, list: list, row: row, rows: rows, entries: total, items: entries, segments: segments, pads: pads, crowded: over };
  }

  function at(F, x, z) {
    const i = Math.floor((x - F.ox) / F.cell), j = Math.floor((z - F.oz) / F.cell);
    if (i < 0 || j < 0 || i >= F.n || j >= F.n) return null;
    const c = (j * F.n + i) * 4, start = F.cells[c], count = F.cells[c + 1];
    if (!count) return null;
    let dsm = 1000, best = 1000, best_id = -1; const r = { d: 1000, walk: 0, cls: 0, lat: 0, along: 0, hw: 0, junction: 0, other: 1000 };
    for (let k = 0; k < count; k++) {
      const o = (start + k) * 8, L = F.list, ax = L[o], az = L[o + 1], bx = L[o + 2], bz = L[o + 3], hw = L[o + 4], walk = L[o + 5], s0 = L[o + 6], cf = L[o + 7];
      const abx = bx - ax, abz = bz - az, l2 = abx * abx + abz * abz, t = l2 > 1e-6 ? Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / l2)) : 0;
      const vx = x - (ax + abx * t), vz = z - (az + abz * t), dist = Math.hypot(vx, vz), di = dist - hw;
      dsm = smin(dsm, di, K);
      if (di < best) {
        best = di; const len = Math.sqrt(l2) || 1;
        best_id = Math.floor(cf / 16); const low = cf % 16; r.walk = walk; r.hw = hw; r.junction = low >= 8 ? 1 : 0; r.cls = low % 8; r.along = s0 + t * len; r.lat = l2 > 1e-6 ? (abx / len) * vz - (abz / len) * vx : 0;
      }
    }
    r.d = dsm;
    // the distance to the nearest OTHER road (not a piece of the nearest one): a marking stops where another road's asphalt begins
    if (best < 0.5) for (let k = 0; k < count; k++) {
      const o = (start + k) * 8, L = F.list;
      if (Math.floor(L[o + 7] / 16) === best_id) continue;
      const ax = L[o], az = L[o + 1], abx = L[o + 2] - ax, abz = L[o + 3] - az, l2 = abx * abx + abz * abz, t = l2 > 1e-6 ? Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / l2)) : 0;
      r.other = Math.min(r.other, Math.hypot(x - (ax + abx * t), z - (az + abz * t)) - L[o + 4]);
    }
    return r;
  }

  // a city.js result (or several: places) and the links between them into the field's input: the class of a street from its kind and type, a junction's disc from its widest arm
  function from_places(places, links, opts) {
    opts = opts || {};
    const roads = [], pads = [], link_w = opts.link_width || 7;
    (places || []).forEach(function (res) {
      if (!res) return;
      const arms = {};
      (res.roads || []).forEach(function (r) {
        const cls = r.type === "road_cobble" ? 2 : r.type === "road_dirt" ? 3 : r.kind === "arterial" ? 1 : 0;
        roads.push({ points: r.points, width: r.width, walk: r.walk || 0, cls: cls });
        [r.a, r.b].forEach(function (id) { if (id === undefined || id < 0) return; const w = arms[id]; if (!w || r.width > w.width) arms[id] = { width: r.width, walk: r.walk || 0, cls: cls }; });
      });
      (res.junctions || []).forEach(function (j) {
        const a = arms[j.id]; if (!a || j.kind === "exit") return;
        pads.push({ x: j.x, z: j.z, r: a.width / 2 + (j.kind === "cap" ? 0 : 0.6), walk: a.walk, cls: a.cls });
      });
    });
    (links || []).forEach(function (l) {                                                       // (a link with `spans` (indices i: pts[i] -> pts[i + 1] is a bridge deck) is cut there: the deck is a mesh of its own)
      const pts = l.pts || l.points, cut = (l.spans || []).slice().sort(function (a, b) { return a - b; });
      let from = 0;
      cut.forEach(function (i) { if (i + 1 > from) { if (i + 1 - from >= 2) roads.push({ points: pts.slice(from, i + 1), width: link_w, walk: 0, cls: 4 }); from = i + 1; } });
      if (pts.length - from >= 2) roads.push({ points: pts.slice(from), width: link_w, walk: 0, cls: 4 });
    });
    return { roads: roads, pads: pads };
  }

  return { build: build, at: at, from_places: from_places, smin: smin, CLASSES: CLASSES, K: K, MAX_PER_CELL: MAX_PER_CELL };
});
