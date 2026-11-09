packing()("happy_road_mesh", function happy_road_mesh() {
  "use strict";
  // ONE MESH FOR THE ROADS OF A PLACE, NOTHING DRAWN TWICE. Pure: no engine, no DOM. Node 14 and the bundler's parser: no optional chaining, no ??, no class, no async functions.
  // city.js gives a graph: chains (roads: centre line, width, walk, trim) that meet in junctions. Here every square metre of road is ONE surface:
  //   * an ARM is a strip along a chain from its start trim to its end trim: sidewalk, kerb, asphalt, kerb, sidewalk in one row of vertices (a kerb is a vertical face, not a second layer), with a skirt down at the outer edges so no gap shows on a slope;
  //   * a PAD is the junction: the asphalt a fan from the middle to the ends of the arms and the corners between two arms (a curve tangent to both asphalt edges), the sidewalk a strip along each corner; its vertices are the arms' end vertices, so there is no crack;
  //   * the rows of an arm are where the ground asks for them (a flat straight stretch is one 16 m row, a bend or a bump gets rows down to 2 m), the height of a row is its highest ground sample + `lift`.
  // build(res, opts, sink) appends triangles to `sink` ({ P, N, C, I: arrays, ox, oz: the origin the positions are relative to}) and returns { tris, rows, pads, arms, ms }.
  //   res = { roads: [{ points: [[x, z]], width, walk, trim: [t0, t1], a, b, kind, type }], junctions: [{ id, x, z, r, kind, arms }] }   (city.js generate())
  //   opts = { ground: { y(x, z) }, lift (0.05), curb (0.12), skirt (0.45), step (16: the longest row), min_step (2), tol (0.06: how far the ground may leave a row's plane), fillet (0.8: the kerb corners are rounded to leave at least this much radius to the sidewalk's outer edge), color(road) -> [r, g, b], walk_color, curb_color, skirt_color }
  //   build_line(points, width, opts, sink) is the same for a road that is not a city's (a link between places): no pads, a shoulder of `opts.shoulder` metres (0) in place of the sidewalks.
  // Heights are a row property: a bridge (a row whose height is not the ground's) is a matter of giving the rows another `y` (see `profile` in opts, not yet used).
  const DEG = Math.PI / 180;

  // ---- a centre line: positions at an arc length
  function make_line(pts) {
    const n = pts.length, x = new Float64Array(n), z = new Float64Array(n), s = new Float64Array(n);
    for (let i = 0; i < n; i++) { x[i] = pts[i][0]; z[i] = pts[i][1]; s[i] = i ? s[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]) : 0; }
    return { x: x, z: z, s: s, n: n, len: s[n - 1], hint: 0 };
  }
  function line_at(L, a, out) {                                                             // the position at arc length a (held to the line)
    a = a < 0 ? 0 : a > L.len ? L.len : a;
    let i = L.hint; if (i >= L.n - 1 || L.s[i] > a) i = 0;
    while (i < L.n - 2 && L.s[i + 1] < a) i++;
    L.hint = i;
    const d = L.s[i + 1] - L.s[i], t = d > 1e-9 ? (a - L.s[i]) / d : 0;
    out.x = L.x[i] + (L.x[i + 1] - L.x[i]) * t; out.z = L.z[i] + (L.z[i + 1] - L.z[i]) * t;
    return out;
  }
  const P0 = { x: 0, z: 0 }, P1 = { x: 0, z: 0 };
  function line_dir(L, a, out) {                                                            // the direction of travel at a: the chord from a - h to a + h (3 m of the line smooth the 6 m corners)
    const h = 2.5, a0 = Math.max(0, a - h), a1 = Math.min(L.len, a + h);
    line_at(L, a0, P0); line_at(L, a1, P1);
    let dx = P1.x - P0.x, dz = P1.z - P0.z; const l = Math.hypot(dx, dz) || 1;
    out.dx = dx / l; out.dz = dz / l; return out;
  }

  // ---- the mesh sink
  function tri(b, p, q, r, col, hint) {                                                     // one triangle of world points, wound so that its normal faces `hint`
    let ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (!(l > 1e-9)) return false;
    nx /= l; ny /= l; nz /= l;
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { nx = -nx; ny = -ny; nz = -nz; const t = q; q = r; r = t; }
    const base = b.P.length / 3, V = [p, q, r];
    for (let i = 0; i < 3; i++) { b.P.push(V[i][0] - b.ox, V[i][1], V[i][2] - b.oz); b.N.push(nx, ny, nz); b.C.push(col[0], col[1], col[2]); }
    b.I.push(base, base + 1, base + 2); if (b.T) b.T.push(tag); return true;
  }
  let tag = "";                                                                              // (what is being drawn: a sink with a T array records it for every triangle, for finding what overlaps)
  const UP = [0, 1, 0];
  function quad(b, p, q, r, s, col, hint) { return (tri(b, p, q, r, col, hint) ? 1 : 0) + (tri(b, p, r, s, col, hint) ? 1 : 0); }

  // ---- rows: a cross-section of an arm. cols are 3D points from the far left to the far right; kinds[j] is what lies between cols[j] and cols[j+1]
  // (the left of a direction of travel (dx, dz) is (-dz, dx), the side the angles of the junctions turn toward)
  function make_row(L, a, R, o, g) {
    const c = line_at(L, a, {}), d = line_dir(L, a, {}), lx = -d.dz, lz = d.dx, h = R.hw + R.walk;
    const y = Math.max(g(c.x, c.z), g(c.x + lx * h, c.z + lz * h), g(c.x - lx * h, c.z - lz * h)) + o.lift;
    return { s: a, x: c.x, z: c.z, dx: d.dx, dz: d.dz, lx: lx, lz: lz, y: y };
  }
  // the columns of a row of a road: [skirt, outer top, kerb top, kerb foot, | kerb foot, kerb top, outer top, skirt]; a road with no sidewalk: [skirt, edge, edge, skirt]
  function row_cols(r, R, o) {
    const hw = R.hw, h = hw + R.walk, y = r.y, yc = y + o.curb, ys = y - o.skirt;
    const at = function (lat, yy) { return [r.x + r.lx * lat, yy, r.z + r.lz * lat]; };
    if (R.walk > 0) return { cols: [at(-h, ys), at(-h, yc), at(-hw, yc), at(-hw, y), at(hw, y), at(hw, yc), at(h, yc), at(h, ys)], kinds: ["skirt", "walk", "curb", "road", "curb", "walk", "skirt"] };
    return { cols: [at(-hw, ys), at(-hw, y), at(hw, y), at(hw, ys)], kinds: ["skirt", "road", "skirt"] };
  }
  function row_hints(r, R) {                                                                // what each quad of a strip faces: up, or out (a skirt), or toward the asphalt (a kerb)
    const pos = [r.lx, 0, r.lz], neg = [-r.lx, 0, -r.lz];                                  // (toward +lat, toward -lat)
    if (R.walk > 0) return [neg, UP, pos, UP, neg, UP, pos];                               // skirt outward, top, kerb toward the asphalt, asphalt, kerb, top, skirt
    return [neg, UP, pos];
  }
  function strip(b, rows, R, o, col) {                                                      // the quads between consecutive rows
    let n = 0;
    for (let i = 0; i + 1 < rows.length; i++) {
      const A = rows[i].cc, B = rows[i + 1].cc, hint = rows[i].hints;
      for (let j = 0; j < A.cols.length - 1; j++) {
        const k = A.kinds[j], c = k === "road" ? col.road : k === "walk" ? col.walk : k === "curb" ? col.curb : col.skirt;
        n += quad(b, A.cols[j], A.cols[j + 1], B.cols[j + 1], B.cols[j], c, hint[j]);
      }
    }
    return n;
  }

  // ---- the rows of one road: subdivided where the ground, or a bend, asks for it
  function plan_rows(L, s0, s1, R, o, g) {
    const out = [make_row(L, s0, R, o, g)], stack = [], ends = [out[0], make_row(L, s1, R, o, g)];
    // the spans are taken left to right with an explicit stack so that rows come out in order
    const dev = function (r0, r1) {
      let worst = 0;
      for (let k = 1; k <= 3; k++) { const t = k / 4, m = make_row(L, r0.s + (r1.s - r0.s) * t, R, o, g); worst = Math.max(worst, Math.abs(m.y - (r0.y + (r1.y - r0.y) * t))); }
      const turn = Math.acos(Math.max(-1, Math.min(1, r0.dx * r1.dx + r0.dz * r1.dz)));
      return { worst: worst, turn: turn };
    };
    stack.push([ends[0], ends[1]]);
    while (stack.length) {
      const sp = stack.pop(), r0 = sp[0], r1 = sp[1], len = r1.s - r0.s;
      let split = len > o.step;
      if (!split && len > o.min_step * 2) { const q = dev(r0, r1); split = q.worst > o.tol || q.turn > 5 * DEG; }
      if (split) { const m = make_row(L, (r0.s + r1.s) / 2, R, o, g); stack.push([m, r1]); stack.push([r0, m]); } else out.push(r1);
    }
    return out;
  }

  function arm_rows(road, L, s0, s1, o, g) {
    const R = { hw: road.width / 2, walk: road.walk || 0 };
    const rows = plan_rows(L, s0, s1, R, o, g);
    rows.forEach(function (r) { r.cc = row_cols(r, R, o); r.hints = row_hints(r, R); });
    return { rows: rows, R: R };
  }

  // ---- a junction
  const cross2 = function (ax, az, bx, bz) { return ax * bz - az * bx; };
  // the arm's end as the pad sees it: outward direction u (away from the junction), the asphalt and sidewalk corners on its left and right (left of u), and the height
  function arm_end(road, end, rows, R) {
    const r = end === 0 ? rows[0] : rows[rows.length - 1], sgn = end === 0 ? 1 : -1;                // for the end b the row's own left is the arm's right
    const ux = sgn * r.dx, uz = sgn * r.dz, lx = -uz, lz = ux, hw = R.hw;
    return { road: road, end: end, row: r, ux: ux, uz: uz, lx: lx, lz: lz, hw: hw, walk: R.walk, cx: r.x, cz: r.z, y: r.y, ang: Math.atan2(uz, ux) };
  }

  function pad(b, J, arms, o, g, colors) {
    const m = arms.length; let tris = 0;
    if (!m) return 0;
    arms.sort(function (p, q) { return p.ang - q.ang; });
    const cy0 = arms.reduce(function (s, A) { return s + A.y; }, 0) / m;
    const cy = Math.max(cy0, g(J.x, J.z) + o.lift), C = [J.x, cy, J.z];
    // the border of the asphalt, counter clockwise: for each arm its right corner, its left corner, then the curve to the next arm's right corner
    const border = [], sides = [];                                                          // sides: the sidewalk curves [{ pts: [[x, z, y]], n: [[nx, nz]], walk: [w] }]
    const curve = function (A, B) {
      const pa = [A.cx + A.lx * A.hw, A.cz + A.lz * A.hw], pb = [B.cx - B.lx * B.hw, B.cz - B.lz * B.hw], na = [A.lx, A.lz], nb = [-B.lx, -B.lz];
      // the asphalt edges run along u; extended into the junction they meet in X (the corner of the two kerbs, to be rounded)
      let ctrl = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
      const den = cross2(A.ux, A.uz, B.ux, B.uz);
      if (Math.abs(den) > 0.05) {
        const wx = pb[0] - pa[0], wz = pb[1] - pa[1], t = cross2(wx, wz, B.ux, B.uz) / den, s = cross2(wx, wz, A.ux, A.uz) / den;       // pa + t uA = pb + s uB
        const X = [pa[0] + A.ux * t, pa[1] + A.uz * t], span = Math.hypot(wx, wz);
        if (t < 0 && s < 0 && t > -2 * ARM_MAX && s > -2 * ARM_MAX) ctrl = X;                      // (into the junction: both negative)
      }
      const len = Math.hypot(ctrl[0] - pa[0], ctrl[1] - pa[1]) + Math.hypot(pb[0] - ctrl[0], pb[1] - ctrl[1]), n = Math.max(2, Math.min(12, Math.ceil(len / 2.5)));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, u = 1 - t, x = u * u * pa[0] + 2 * u * t * ctrl[0] + t * t * pb[0], z = u * u * pa[1] + 2 * u * t * ctrl[1] + t * t * pb[1];
        let nx = u * na[0] + t * nb[0], nz = u * na[1] + t * nb[1]; const nl = Math.hypot(nx, nz);
        if (nl < 0.25) { nx = x - J.x; nz = z - J.z; const ql = Math.hypot(nx, nz) || 1; nx /= ql; nz /= ql; } else { nx /= nl; nz /= nl; }
        const y = A.y * u + B.y * t;
        pts.push({ x: x, z: z, y: Math.max(y, g(x, z) + o.lift), nx: nx, nz: nz, walk: A.walk * u + B.walk * t });
      }
      pts[0].y = A.y; pts[n].y = B.y; return pts;
    };
    if (m === 1) {                                                                          // a turning head or a cap: round the end, through the far side (-u): the angles of the position and of the outward direction both turn counter clockwise
      const A = arms[0], pl = [A.cx + A.lx * A.hw, A.cz + A.lz * A.hw], pr = [A.cx - A.lx * A.hw, A.cz - A.lz * A.hw], rad = Math.hypot(pl[0] - J.x, pl[1] - J.z);
      const aL = Math.atan2(pl[1] - J.z, pl[0] - J.x), aR = Math.atan2(pr[1] - J.z, pr[0] - J.x), nA = Math.atan2(A.lz, A.lx);
      let sweep = aR - aL; while (sweep <= 0.01) sweep += 2 * Math.PI;
      const n = Math.max(8, Math.min(24, Math.ceil(rad * sweep / 2.5))), pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, ang = aL + sweep * t, x = J.x + Math.cos(ang) * rad, z = J.z + Math.sin(ang) * rad, na = nA + Math.PI * t;
        pts.push({ x: x, z: z, y: i === 0 || i === n ? A.y : Math.max(A.y, g(x, z) + o.lift), nx: Math.cos(na), nz: Math.sin(na), walk: A.walk });
      }
      sides.push(pts); border.push([pr[0], A.y, pr[1]]);
      pts.forEach(function (q) { border.push([q.x, q.y, q.z]); });
    } else {
      for (let i = 0; i < m; i++) {
        const A = arms[i], B = arms[(i + 1) % m];
        border.push([A.cx - A.lx * A.hw, A.y, A.cz - A.lz * A.hw]);                         // A's right corner (the first arm's, the others close the curve before)
        const pts = curve(A, B); sides.push(pts);
        pts.forEach(function (q, k) { if (k < pts.length - 1) border.push([q.x, q.y, q.z]); });
      }
    }
    // the asphalt: a fan from the middle
    tag = "pad " + J.id + " fan";
    for (let i = 0; i < border.length; i++) { const p = border[i], q = border[(i + 1) % border.length]; if (tri(b, C, p, q, colors.road, UP)) tris++; }
    // the sidewalk of every corner: skirt, outer top, kerb top, kerb foot (a ribbon along the curve)
    tag = "pad " + J.id + " corner";
    sides.forEach(function (pts) {
      const rows = pts.map(function (q) {
        const w = q.walk, h = w, ys = q.y - o.skirt;
        const P = function (off, yy) { return [q.x + q.nx * off, yy, q.z + q.nz * off]; };
        if (w > 0.01) return { cols: [P(w, ys), P(w, q.y + o.curb), P(0, q.y + o.curb), P(0, q.y)], kinds: ["skirt", "walk", "curb"], hints: [[q.nx, 0, q.nz], UP, [-q.nx, 0, -q.nz]] };
        return { cols: [P(0, ys), P(0, q.y)], kinds: ["skirt"], hints: [[q.nx, 0, q.nz]] };
      });
      for (let i = 0; i + 1 < rows.length; i++) {
        const A = rows[i], B = rows[i + 1], nc = Math.min(A.cols.length, B.cols.length);
        for (let j = 0; j < nc - 1; j++) {
          const k = A.kinds[j], c = k === "walk" ? colors.walk : k === "curb" ? colors.curb : colors.skirt;
          tris += quad(b, A.cols[j], A.cols[j + 1], B.cols[j + 1], B.cols[j], c, A.hints[j]);
        }
      }
    });
    return tris;
  }

  const road_rgb = function (road, o) { const c = o.color ? o.color(road) : null; return c || [0.28, 0.3, 0.33]; };
  function make_options(opts) {
    const o = Object.assign({ lift: 0.05, curb: 0.12, skirt: 0.45, step: 16, min_step: 2, tol: 0.06, fillet: 0.8, walk_color: [0.66, 0.65, 0.62], curb_color: [0.74, 0.73, 0.7], skirt_color: [0.3, 0.26, 0.2] }, opts || {});
    if (!o.ground || typeof o.ground.y !== "function") throw new Error("road_mesh: opts.ground.y(x, z) is needed");
    return o;
  }

  // where an arm ends before the pad is laid: the arm's end as the corners need it (outward direction u, the left of u, the half widths)
  function end_geom(L, s, end, R) {
    const c = line_at(L, s, {}), d = line_dir(L, s, {}), sg = end === 0 ? 1 : -1, ux = sg * d.dx, uz = sg * d.dz;
    return { cx: c.x, cz: c.z, ux: ux, uz: uz, lx: -uz, lz: ux, hw: R.hw, walk: R.walk, ang: Math.atan2(uz, ux) };
  }
  const ARM_MAX = 14;
  // THE KERB FILLETS. At a junction the kerb of an arm's left side and the kerb of the next arm's right side meet at a corner X; the corner is rounded (a radius that leaves the sidewalk, walk metres wide, a curve of its own
  // that does not fold) and each arm ends where its fillet begins: no arm runs into the corner of its neighbour, so nothing is covered twice. This says how far each arm has to be shortened (its end moved outward).
  function fillet_trims(list, rho_min) {
    const m = list.length; if (m < 2) return;
    list.sort(function (p, q) { return p.G.ang - q.G.ang; });
    for (let i = 0; i < m; i++) {
      const A = list[i], B = list[(i + 1) % m], ga = A.G, gb = B.G;
      let gap = gb.ang - ga.ang; while (gap <= 0) gap += 2 * Math.PI; if (m === 2 && i === 1) gap = 2 * Math.PI - (list[1].G.ang - list[0].G.ang);
      if (gap < 0.05 || gap > Math.PI - 0.05) continue;                                     // (collinear or a reflex corner: a straight kerb, nothing to round)
      const pa = [ga.cx + ga.lx * ga.hw, ga.cz + ga.lz * ga.hw], pb = [gb.cx - gb.lx * gb.hw, gb.cz - gb.lz * gb.hw], den = cross2(ga.ux, ga.uz, gb.ux, gb.uz);
      if (Math.abs(den) < 0.05) continue;
      const wx = pb[0] - pa[0], wz = pb[1] - pa[1], t = cross2(wx, wz, gb.ux, gb.uz) / den, s = cross2(wx, wz, ga.ux, ga.uz) / den;       // pa + t uA = pb + s uB = X
      const k = Math.min(ARM_MAX - 2, (Math.max(ga.walk, gb.walk) + rho_min) / Math.tan(gap / 2));          // the fillet starts k metres from X along each kerb
      A.extra = Math.max(A.extra, Math.min(ARM_MAX, t + k)); B.extra = Math.max(B.extra, Math.min(ARM_MAX, s + k));
    }
  }

  function build(res, opts, sink) {
    const t0 = Date.now(), o = make_options(opts), g = o.ground.y, by_j = {}, st = { tris: 0, rows: 0, pads: 0, arms: 0, ms: 0 };
    const J = {}; (res.junctions || []).forEach(function (j) { J[j.id] = j; });
    // 1. the roads and where their arms would end by the generator's trim; the arms of each junction
    const RS = [];
    res.roads.forEach(function (road) {
      if (!road.points || road.points.length < 2) return;
      const L = make_line(road.points), tr = road.trim || [0, 0], R = { hw: road.width / 2, walk: road.walk || 0 };
      const q = { road: road, L: L, R: R, e: [Math.min(tr[0] || 0, L.len * 0.5), Math.max(L.len - (tr[1] || 0), L.len * 0.5)], col: { road: road_rgb(road, o), walk: o.walk_color, curb: o.curb_color, skirt: o.skirt_color } };
      RS.push(q);
      [[0, road.a], [1, road.b]].forEach(function (p) {
        const id = p[1]; if (id === undefined || id < 0 || !J[id] || J[id].kind === "exit") return;
        (by_j[id] || (by_j[id] = [])).push({ q: q, end: p[0], G: end_geom(L, q.e[p[0]], p[0], R), extra: 0 });
      });
    });
    // 2. the fillets say how far each arm is moved back
    Object.keys(by_j).forEach(function (id) {
      fillet_trims(by_j[id], o.fillet);
      by_j[id].forEach(function (A) {
        const q = A.q, len = q.L.len;
        if (A.end === 0) q.e[0] = Math.min(q.e[0] + A.extra, len * 0.5); else q.e[1] = Math.max(q.e[1] - A.extra, len * 0.5);
      });
    });
    // 3. the arms (strips), and their ends for the pads
    RS.forEach(function (q) {
      const e0 = q.e[0], e1 = Math.max(q.e[1], e0 + 0.01), arm = arm_rows(q.road, q.L, e0, e1, o, g);
      tag = "arm " + q.road.id; q.arm = arm;
      if (e1 - e0 >= 0.25) { st.tris += strip(sink, arm.rows, arm.R, o, q.col); st.rows += arm.rows.length; st.arms++; }
    });
    // 4. the pads
    Object.keys(by_j).forEach(function (id) {
      const list = by_j[id], arms = list.map(function (A) { return arm_end(A.q.road, A.end, A.q.arm.rows, A.q.arm.R); });
      let widest = list[0]; list.forEach(function (A) { if (A.q.R.hw > widest.q.R.hw) widest = A; });                // (the asphalt colour of a pad is the widest arm's)
      st.tris += pad(sink, J[id], arms, o, g, { road: widest.q.col.road, walk: o.walk_color, curb: o.curb_color, skirt: o.skirt_color }); st.pads++;
    });
    st.ms = Date.now() - t0; return st;
  }

  // a road that is not a city's: a strip of one width, no sidewalks, no pads (a link between places)
  function build_line(points, width, opts, sink) {
    const o = make_options(opts), g = o.ground.y, L = make_line(points), col = { road: o.road_color || [0.85, 0.72, 0.47], walk: o.walk_color, curb: o.curb_color, skirt: o.skirt_color };
    const road = { width: width, walk: o.shoulder || 0 }, arm = arm_rows(road, L, 0, L.len, o, g);
    return { tris: strip(sink, arm.rows, arm.R, o, col), rows: arm.rows.length };
  }

  return { build: build, build_line: build_line, make_line: make_line, line_at: line_at, line_dir: line_dir };
});
