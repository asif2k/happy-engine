// THE MESHER: the sdf mesher and the codecs of the part pieces (their reader and the mesh optimizer). Packing modules, kept by name where they are included (species.js: mesher_libs).
// Ported 2026-11-05 from the first version of the creature system, renamed and merged by domain. From here this file is the source.

// ========================================================================================================================
// mesher
// ========================================================================================================================
// happy_mesher: HAPPY'S OWN COPY of the sdf mesher (sdf/mesher/sdf_mesher.js, version 0.2.0), copied on 2026-10-12 and again, into the restart of , on 2026-10-17, so that system needs nothing outside  to make a
// creature's mesh and skin weights from the `sdf` of its definition. The code was the original's, number for number, but for the name (sdf_mesher -> happy_mesher), until 2026-10-18; since then system's copy has what
// the ASSEMBLY of pieces needs (SYSTEM.md "Assembly"): a mirrored volume that is the mirror image, `origin` and volume_place, bone_map / @host / @host:k on a rigged volume and the twins of its mirror copy,
// the seam's shares of skin and colour (skin.seam, shade.color_blend), skin_probe, and four fixes (the locator of a mirrored part's copies, decode_volume of a node Buffer, pose_skeleton of a skeleton listed child
// first, the bins of a coarse file). A def without volumes is meshed to the same bytes as before. It has no link to the original at run time.
// It is BUILT IN: system.js includes this file as text (species.js) and makes the mesher when the first creature with an `sdf` is met, so a page lists @/system/system.js and nothing else. SYSTEM.md is the
// original's README under the new name (the numbers, the def's grammar, the limits).
//
// happy_mesher - turns an SDF definition (bones + parts) into geometry data: on the GPU when there is one (WebGL2, any GPU), on the CPU when there is not. It runs in a Web Worker when it
// can, so the page never waits for a build, and it has sessions for live editing. SYSTEM.md next to this file has the numbers, the tests and the limits.
//
//   packing("@/sdf/mesher/mesher.js")(function (happy_mesher) {
//     happy_mesher.create().then(function (mesher) {                    // the GPU in a worker when there is one
//       mesher.build(def, { cell: 0.02 }).then(function (geo) { ... });  // geo.positions, normals, uvs, indices, colors, part_ids, bone_indices, bone_weights, bounds, stats
//       const live = mesher.session();                                // live editing: live.update(def) on every change, live.on_geometry = function (geo, meta) { ... }
//     });
//   });
//
// def is the `sdf` of a creature of SYSTEM.md (section 4): { cell, bones: [...], parts: [...] }, plus what this library adds: the shapes torus and cylinder, `island` on a part (a part
// of an island never blends with another island's: its own field, grid, shading and skin), the meshing settings `adaptive` (an octree) and `decimate` (quadric edge collapse) of the native
// mesher, and the shape `volume`: a triangle mesh (a glTF character) baked to a grid of distances (mesher.bake), which is then edited like any primitive (the volumes section below).
// The Geometry is described at create_engine, the worker and the sessions at the end.
//
// The whole library is this one function and it needs nothing else: no other file, no other packing module (it is not integrated with the engine, sfm or sdf on purpose). The worker is
// made from the source of this very function (worker_source), so there is no file to load and no build step. The sections, in order: compile (def -> primitive tables), grid (the
// samples and the cull lists), extract (surface nets), cpu (the field and the per-vertex passes in JavaScript), adaptive (the octree), decimate (the quadric edge collapse),
// volumes and bake (a triangle mesh as a primitive, with its colours and its skin), pose (a skeleton in a pose, a geometry skinned to it: pose_skeleton, skin_geometry), volume file (a volume as bytes), shaders + gpu (the WebGL2 backend),
// engine (one mesher: islands, backends, reuse), host (worker, sessions).
packing()("happy_mesher", function happy_mesher() {
  "use strict";
  const DEG = Math.PI / 180, MAX_BONES = 127, STRIDE = 20, LX = 28, BIG = 1e9, VOLUME_LIP = 1.15;   // what the sections share: the layout of the primitive tables (compile), ... (VOLUME_LIP: the bound on the gradient of a volume's field)
  const T_SPHERE = 0, T_ELLIPSOID = 1, T_CAPSULE = 2, T_BOX = 3, T_LOFT = 4, T_TORUS = 5, T_CYLINDER = 6, T_VOLUME = 7;
  const OP_UNION = 0, OP_SUBTRACT = 1, OP_INTERSECT = 2;
  const now = function () { return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now(); };

  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // compile - an SDF definition -> the tables every backend evaluates.
  //
  // def = { cell, uv_scale, part_ids, skin, shade, bones: [...], parts: [...] }   (the format of engine.sdf.create / SYSTEM.md section 4: the creature library's `sdf`)
  //
  // What comes out (`Compiled`, plain data, no GL, no wasm):
  //   n         the number of primitives (sphere, ellipsoid, capsule, box, loft segment, torus, cylinder, volume): mirrors, chains, lofts and `bones` lofts are already expanded
  //   prim      Float64Array n * 20    one record per primitive, the layout of geometry_creature.cpp:
  //               [0] type (0 sphere 1 ellipsoid 2 capsule 3 box 4 loft 5 torus 6 cylinder 7 volume) [1] op (0 union 1 subtract 2 intersect) [2] blend [3] part index
  //               sphere 4-6 centre, 7 radius | ellipsoid 4-6 centre, 7-9 1 / radii, 10 smallest radius | box 4-6 centre, 7-9 half - round, 10 round
  //               capsule 4-6 a, 7-9 b - a, 10 1 / |b - a|^2, 11 radius at a, 12 radius at b - radius at a, 16-17 slopes of the radius (times the length) | loft 4-6 a, 7-9 b - a, 10 1 / |b - a|^2, 11 index in lx
  //               torus 4-6 centre, 7-9 axis (unit), 10 ring radius, 11 tube radius | cylinder 4-6 centre, 7-9 axis (unit), 10 radius - round, 11 half height - round, 12 round (both are exact distances)
  //               volume 4-6 where the middle of its box stands, 7 its index in `vols`, 8 the scale, 11 its own index (its lx record: the matrix to the volume's frame; see emit_volume)
  //               [13] bone row (-1 none) [14] group tag (0 none: the segments of one group are united with a hard min first) [15] blend mode (0 round 1 cubic 2 chamfer)
  //               [18] island (0 the default one: the primitives of an island form their own field, see build) [19] a bound on the gradient of this primitive's distance (capsule, loft)
  //   lx        Float64Array n * 28    the cross section of a loft segment (see emit_loft), indexed by the primitive
  //   box       Float64Array n * 6     the primitive's box including its radius (no blend): the grid is made from it
  //   rbox      Float64Array n * 6     the same, widened where a primitive reaches further than its box (a squircle loft): what the cull lists use
  //   lip       a bound on the gradient of the field (for skipping empty space), kmax the largest blend, bmax the largest bulge of a smooth union, gmin / gmax the union's box with the bulge
  //   parts     [{ id, source, color, bone, bone_name, ... }] one per part AFTER the mirrors across bones were written out; prim[3] indexes it
  //   skeleton  null, or { n, names, index, parent, head, tail, length, bind, ... } (make_skeleton)
  //   vols      the volumes the def uses (a volume primitive's [7] indexes it), vol_prim: per part index the primitives that are volumes (a mirrored part has two)
  //   settings  the numbers of the def that shape the mesh (cell, skin, shade, ...), normalised
  // The semantics (blend modes, groups, the pchip radii, the loft frames) are those of geometries.js / geometry_creature.cpp; tests/repo/parity_compile.js checks that the tables are identical.
  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  function fail(msg) { throw new Error("happy_mesher: " + msg); }
  function finite(v, what) {
    if (typeof v !== "number" || !isFinite(v)) fail(what + " must be a finite number");
    return v;
  }
  function vec3(a, what) {
    if (!a || a.length < 3) fail(what + " must be [x, y, z]");
    finite(a[0], what); finite(a[1], what); finite(a[2], what);
    return a;
  }
  function radius(v, what) {
    if (finite(v, what) <= 0) fail(what + " must be > 0");
    return v;
  }

  // ---- bones ----------------------------------------------------------------------------------------------------------------------------------------
  const MIRRORS = [[/^(.+[._-])l$/, "r"], [/^(.+[._-])r$/, "l"], [/^(.+[._-])L$/, "R"], [/^(.+[._-])R$/, "L"], [/^(.+[._-])left$/, "right"], [/^(.+[._-])right$/, "left"]];
  function mirror_name(name) {
    for (let i = 0; i < MIRRORS.length; i++) {
      const m = MIRRORS[i][0].exec(name);
      if (m) return m[1] + MIRRORS[i][1];
    }
    return null;
  }

  // bones with `mirror: "x"` -> the list with their mirrored copies right behind them
  function expand_bones(defs) {
    const out = [], flagged = Object.create(null);
    defs.forEach(function (b) { if (b && b.mirror) flagged[b.name] = true; });
    defs.forEach(function (b) {
      if (!b || typeof b.name !== "string" || b.name === "") fail("every bone needs a name");
      out.push(b);
      if (!b.mirror) return;
      if (b.mirror !== "x") fail("bone '" + b.name + "': only mirror \"x\" is supported");
      const n = mirror_name(b.name);
      if (!n) fail("bone '" + b.name + "' is mirrored, its name must end in _l / _r (.l/.r, -l/-r, _L/_R, _left/_right)");
      const c = Object.assign({}, b, { name: n });
      delete c.mirror;
      vec3(b.head, "bone '" + b.name + "'.head");
      c.head = [-b.head[0], b.head[1], b.head[2]];
      if (b.tail !== undefined) { vec3(b.tail, "bone '" + b.name + "'.tail"); c.tail = [-b.tail[0], b.tail[1], b.tail[2]]; }
      if (b.roll) c.roll = -b.roll;
      if (b.parent !== undefined && b.parent !== null && flagged[b.parent]) c.parent = mirror_name(b.parent);
      out.push(c);
    });
    return out;
  }

  function mul34(o, oo, a, ao, b, bo) {                          // o = a * b for 3x4 affine matrices (row major, 12 floats at the offsets); o must not alias a or b
    for (let r = 0; r < 3; r++) {
      const a0 = a[ao + r * 4], a1 = a[ao + r * 4 + 1], a2 = a[ao + r * 4 + 2], a3 = a[ao + r * 4 + 3];
      o[oo + r * 4] = a0 * b[bo] + a1 * b[bo + 4] + a2 * b[bo + 8];
      o[oo + r * 4 + 1] = a0 * b[bo + 1] + a1 * b[bo + 5] + a2 * b[bo + 9];
      o[oo + r * 4 + 2] = a0 * b[bo + 2] + a1 * b[bo + 6] + a2 * b[bo + 10];
      o[oo + r * 4 + 3] = a0 * b[bo + 3] + a1 * b[bo + 7] + a2 * b[bo + 11] + a3;
    }
  }

  // the bone tree: bind frames (y along head -> tail, x by parallel transport from the parent's x, z = x cross y), the rest transforms relative to the parent, a parent-before-child order
  function make_skeleton(raw) {
    if (!Array.isArray(raw)) fail("bones must be an array");
    const defs = expand_bones(raw), n = defs.length;
    if (n > MAX_BONES) fail("at most " + MAX_BONES + " bones (" + n + ")");
    const sk = {
      n: n, names: [], index: Object.create(null), parent: new Int32Array(n), mirror: new Int32Array(n), children: [], order: [], depth: new Int32Array(n),
      head: new Float64Array(n * 3), tail: new Float64Array(n * 3), length: new Float64Array(n),
      bind: new Float64Array(n * 12), bind_inv: new Float64Array(n * 12), rest: new Float64Array(n * 12), bones: []
    };
    let i, k;
    for (i = 0; i < n; i++) {
      const b = defs[i], h = vec3(b.head, "bone '" + b.name + "'.head");
      if (sk.index[b.name] !== undefined) fail("duplicate bone name '" + b.name + "'");
      sk.index[b.name] = i; sk.names.push(b.name);
      sk.head[i * 3] = h[0]; sk.head[i * 3 + 1] = h[1]; sk.head[i * 3 + 2] = h[2];
      sk.children.push([]);
    }
    const roots = [];
    for (i = 0; i < n; i++) {
      const b = defs[i];
      let p = -1;
      if (b.parent !== undefined && b.parent !== null) {
        p = sk.index[b.parent];
        if (p === undefined) fail("bone '" + b.name + "' has the unknown parent '" + b.parent + "'");
        if (p === i) fail("bone '" + b.name + "' is its own parent");
      }
      sk.parent[i] = p;
      if (p < 0) roots.push(i); else sk.children[p].push(i);
      const m = mirror_name(b.name);
      sk.mirror[i] = m !== null && sk.index[m] !== undefined ? sk.index[m] : -1;
    }
    if (!roots.length) fail("the skeleton has no root bone (all bones have parents)");
    const stack = roots.slice().reverse();
    while (stack.length) {
      const j = stack.pop(), ch = sk.children[j];
      sk.order.push(j);
      for (k = ch.length - 1; k >= 0; k--) { sk.depth[ch[k]] = sk.depth[j] + 1; stack.push(ch[k]); }
    }
    if (sk.order.length !== n) fail("the bone parents form a cycle");

    const B = sk.bind, BI = sk.bind_inv;
    for (let oi = 0; oi < n; oi++) {
      i = sk.order[oi];
      const b = defs[i], p = sk.parent[i], h = i * 3, o = i * 12, pb = p * 12;
      const hx = sk.head[h], hy = sk.head[h + 1], hz = sk.head[h + 2];
      let dx = 0, dy = 1, dz = 0, tx = 0, ty = 0, tz = 0, have = false;
      if (p >= 0) { dx = B[pb + 1]; dy = B[pb + 5]; dz = B[pb + 9]; }
      if (b.tail !== undefined) { vec3(b.tail, "bone '" + b.name + "'.tail"); tx = b.tail[0]; ty = b.tail[1]; tz = b.tail[2]; have = true; }
      else if (b.length !== undefined) {
        if (!(b.length > 0)) fail("bone '" + b.name + "'.length must be > 0");
        tx = hx + dx * b.length; ty = hy + dy * b.length; tz = hz + dz * b.length; have = true;
      } else if (sk.children[i].length) {
        const ch = sk.children[i];
        for (k = 0; k < ch.length; k++) { tx += sk.head[ch[k] * 3]; ty += sk.head[ch[k] * 3 + 1]; tz += sk.head[ch[k] * 3 + 2]; }
        tx /= ch.length; ty /= ch.length; tz /= ch.length;
        have = Math.hypot(tx - hx, ty - hy, tz - hz) > 1e-6;
      }
      if (!have) {
        const fallback = p >= 0 ? Math.max(0.02, 0.5 * sk.length[p]) : 0.1;
        tx = hx + dx * fallback; ty = hy + dy * fallback; tz = hz + dz * fallback;
      }
      const len = Math.hypot(tx - hx, ty - hy, tz - hz);
      if (!(len > 1e-6)) fail("bone '" + b.name + "' has no length (head and tail coincide)");
      sk.tail[h] = tx; sk.tail[h + 1] = ty; sk.tail[h + 2] = tz; sk.length[i] = len;
      const yx = (tx - hx) / len, yy = (ty - hy) / len, yz = (tz - hz) / len;

      // x: the parent's x (its z when that lies along this bone), else a world axis
      let xx = 0, xy = 0, xz = 0, found = false;
      for (k = 0; k < 5 && !found; k++) {
        let cx, cy, cz;
        if (p >= 0 && k === 0) { cx = B[pb]; cy = B[pb + 4]; cz = B[pb + 8]; }
        else if (p >= 0 && k === 1) { cx = B[pb + 2]; cy = B[pb + 6]; cz = B[pb + 10]; }
        else { const w = k - (p >= 0 ? 2 : 0); if (w < 0 || w > 2) continue; cx = w === 0 ? 1 : 0; cy = w === 1 ? 1 : 0; cz = w === 2 ? 1 : 0; }
        const d = cx * yx + cy * yy + cz * yz, vx = cx - d * yx, vy = cy - d * yy, vz = cz - d * yz, l = Math.hypot(vx, vy, vz);
        if (l > 0.2) { xx = vx / l; xy = vy / l; xz = vz / l; found = true; }
      }
      let zx = xy * yz - xz * yy, zy = xz * yx - xx * yz, zz = xx * yy - xy * yx;
      if (b.roll) {
        const r = finite(b.roll, "bone '" + b.name + "'.roll") * DEG, c = Math.cos(r), s = Math.sin(r), nx = xx * c - zx * s, ny = xy * c - zy * s, nz = xz * c - zz * s;
        zx = xx * s + zx * c; zy = xy * s + zy * c; zz = xz * s + zz * c;
        xx = nx; xy = ny; xz = nz;
      }
      B[o] = xx; B[o + 1] = yx; B[o + 2] = zx; B[o + 3] = hx;
      B[o + 4] = xy; B[o + 5] = yy; B[o + 6] = zy; B[o + 7] = hy;
      B[o + 8] = xz; B[o + 9] = yz; B[o + 10] = zz; B[o + 11] = hz;
      BI[o] = xx; BI[o + 1] = xy; BI[o + 2] = xz; BI[o + 3] = -(xx * hx + xy * hy + xz * hz);
      BI[o + 4] = yx; BI[o + 5] = yy; BI[o + 6] = yz; BI[o + 7] = -(yx * hx + yy * hy + yz * hz);
      BI[o + 8] = zx; BI[o + 9] = zy; BI[o + 10] = zz; BI[o + 11] = -(zx * hx + zy * hy + zz * hz);
      if (p < 0) for (k = 0; k < 12; k++) sk.rest[o + k] = B[o + k];
      else mul34(sk.rest, o, BI, pb, B, o);
    }
    for (i = 0; i < n; i++) {
      sk.bones.push({
        name: sk.names[i], index: i, parent: sk.parent[i], children: sk.children[i], depth: sk.depth[i], length: sk.length[i], mirror: sk.mirror[i],
        head: [sk.head[i * 3], sk.head[i * 3 + 1], sk.head[i * 3 + 2]], tail: [sk.tail[i * 3], sk.tail[i * 3 + 1], sk.tail[i * 3 + 2]],
        bind: Array.from(sk.bind.subarray(i * 12, i * 12 + 12)), bind_inv: Array.from(sk.bind_inv.subarray(i * 12, i * 12 + 12)), rest: Array.from(sk.rest.subarray(i * 12, i * 12 + 12))     // (3 x 4, row major: the bone's frame in the model, its inverse, and in its parent's frame)
      });
    }
    return sk;
  }

  // ---- parts: the def's parts -> native parts (mirrors across bones written out, `bones` lofts cut into one piece per bone, a bone row on every part) -----------------------------------
  const EXTRA = ["radii_v", "twist", "square"];

  function flip_x(q) {
    const f = function (v) { return [-v[0], v[1], v[2]]; };
    if (q.shape === "volume") { q.__mirror_x = !q.__mirror_x; return; }   // (a volume is reflected WHOLE where it is emitted: its place, its turn and its grid; emit_volume)
    if (q.center) q.center = f(q.center);
    if (q.a) q.a = f(q.a);
    if (q.b) q.b = f(q.b);
    if (q.points) q.points = q.points.map(f);
    if (Array.isArray(q.axis)) q.axis = f(q.axis);
    if (q.twist) q.twist = q.twist.map(function (v) { return -v; });
  }

  // a chain / loft along bones -> one piece per bone. `J` = the joints (heads + the last tail)
  function along(p, label, bones, sk) {
    const m = bones.length, J = [];
    if (p.shape !== "chain" && p.shape !== "loft") fail(label + ": `bones` is for chain and loft shapes");
    if (p.points !== undefined) fail(label + ": a part with `bones` takes its points from the skeleton (give radii, or t and radii)");
    for (let k = 0; k < m; k++) J.push([sk.head[bones[k] * 3], sk.head[bones[k] * 3 + 1], sk.head[bones[k] * 3 + 2]]);
    const lt = bones[m - 1] * 3;
    J.push([sk.tail[lt], sk.tail[lt + 1], sk.tail[lt + 2]]);
    const r = p.radii, extra = p.shape === "loft" ? EXTRA.filter(function (k) { return Array.isArray(p[k]); }) : [];
    if (!Array.isArray(r)) fail(label + ": radii is required");
    const base = function () {
      const q = Object.assign({}, p);
      delete q.bones; delete q.t;
      q.group = p.group !== undefined ? p.group : "~" + p.id;
      return q;
    };
    const out = [];
    if (p.t === undefined) {
      if (r.length !== m + 1) fail(label + ": radii needs " + (m + 1) + " values (the joints of its " + m + " bones), or give t");
      extra.forEach(function (k) { if (p[k].length !== m + 1) fail(label + ": " + k + " needs " + (m + 1) + " values"); });
      for (let k = 0; k < m; k++) {
        const q = base();
        q.id = p.id + "~" + k; q.points = [J[k], J[k + 1]]; q.radii = [r[k], r[k + 1]]; q.bone = bones[k];
        extra.forEach(function (e) { q[e] = [p[e][k], p[e][k + 1]]; });
        out.push(q);
      }
      return out;
    }
    const t = p.t;
    if (!Array.isArray(t) || t.length < 2 || t.length !== r.length) fail(label + ": t and radii must be arrays of the same length (2 or more)");
    for (let i = 0; i < t.length; i++) if (!(t[i] >= 0 && t[i] <= 1) || (i > 0 && !(t[i] > t[i - 1]))) fail(label + ": t must increase within 0 .. 1");
    extra.forEach(function (k) { if (p[k].length !== t.length) fail(label + ": " + k + " needs one value per t"); });
    const C = [0];
    for (let j = 0; j < m; j++) C.push(C[j] + Math.hypot(J[j + 1][0] - J[j][0], J[j + 1][1] - J[j][1], J[j + 1][2] - J[j][2]));
    const total = C[m], S = t.map(function (v) { return v * total; });
    const value_at = function (arr, s) {
      if (s <= S[0]) return arr[0];
      for (let i = 1; i < S.length; i++) if (s <= S[i]) return arr[i - 1] + (arr[i] - arr[i - 1]) * (s - S[i - 1]) / (S[i] - S[i - 1]);
      return arr[arr.length - 1];
    };
    const point_at = function (j, s) {
      const u = C[j + 1] > C[j] ? (s - C[j]) / (C[j + 1] - C[j]) : 0, a = J[j], b = J[j + 1];
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    };
    let made = 0;
    for (let j = 0; j < m; j++) {
      const a = Math.max(C[j], S[0]), b = Math.min(C[j + 1], S[S.length - 1]);
      if (b - a < 1e-6 * total) continue;
      const ss = [a];
      for (let i = 0; i < S.length; i++) if (S[i] > a + 1e-6 * total && S[i] < b - 1e-6 * total) ss.push(S[i]);
      ss.push(b);
      if (ss.length > 12) fail(label + ": more than 10 points on one bone");
      const q = base();
      q.id = p.id + "~" + j; q.bone = bones[j];
      q.points = ss.map(function (s) { return point_at(j, s); });
      q.radii = ss.map(function (s) { return value_at(r, s); });
      extra.forEach(function (e) { q[e] = ss.map(function (s) { return value_at(p[e], s); }); });
      out.push(q); made++;
    }
    if (!made) fail(label + ": t covers none of the bones");
    return out;
  }

  function expand_parts(def, sk) {
    const parts = def.parts, out = [], seen = Object.create(null);
    if (!Array.isArray(parts) || !parts.length) fail("def.parts is required");
    const bone_of = function (ref, label) {
      const i = typeof ref === "number" ? (ref === (ref | 0) && ref >= 0 && ref < sk.n ? ref : undefined) : sk.index[ref];
      if (i === undefined) fail(label + " follows the unknown bone '" + ref + "'");
      return i;
    };
    parts.forEach(function (src, pi) {
      const id = src.id !== undefined ? String(src.id) : "p" + pi, label = "part '" + id + "'";
      if (seen[id]) fail("duplicate part id '" + id + "'");
      seen[id] = true;
      const p = Object.assign({}, src, { id: id });
      const union = p.op === undefined || p.op === "union";
      if (!sk && (p.bone !== undefined || p.bones !== undefined)) fail(label + " follows a bone but the def has no bones");
      if (p.bone !== undefined && p.bones !== undefined) fail(label + ": give `bone` or `bones`, not both");
      let pieces;
      if (sk && p.bones !== undefined) {
        if (!Array.isArray(p.bones) || !p.bones.length) fail(label + ": bones must be a non-empty array");
        pieces = along(p, label, p.bones.map(function (b) { return bone_of(b, label); }), sk);
      } else {
        const q = Object.assign({}, p);
        q.bone = sk ? (p.bone !== undefined ? bone_of(p.bone, label) : (union ? sk.order[0] : -1)) : -1;
        if (p.shape === "volume" && sk && p.bone !== undefined) q.host_name = sk.names[q.bone];    // (a rigged volume's `@host` goes to the bone the part names, the original's for its mirror copy: volume_skin)
        pieces = [q];
      }
      // mirror x across left / right bones: two parts, the second one reflected and bound to the counterpart
      const flags = typeof p.mirror === "string" ? p.mirror : "";
      let list = pieces;
      if (sk && flags.indexOf("x") >= 0) {
        const cps = pieces.map(function (q) { return q.bone >= 0 ? sk.mirror[q.bone] : -1; });
        const n_ok = cps.filter(function (c) { return c >= 0; }).length;
        if (n_ok === pieces.length) {
          const rest_flags = flags.replace("x", "");
          list = [];
          pieces.forEach(function (q, k) {
            const c = Object.assign({}, q);
            if (rest_flags) c.mirror = rest_flags; else delete c.mirror;
            const r = JSON.parse(JSON.stringify(q));
            flip_x(r);
            r.id = q.id + "#x"; r.bone = cps[k];
            if (rest_flags) r.mirror = rest_flags; else delete r.mirror;
            if (q.group !== undefined) r.group = String(q.group) + "#x";
            list.push(c, r);
          });
        } else if (n_ok > 0) fail(label + ": mirror x needs a left / right counterpart for every one of its bones (or none)");
      }
      list.forEach(function (q) { q.source = id; q.bone_name = q.bone >= 0 && sk ? sk.names[q.bone] : null; out.push(q); });
    });
    return out;
  }

  // ---- primitives ----------------------------------------------------------------------------------------------------------------------------------
  // The radius along a chain / loft is a smooth monotone cubic (PCHIP): m[i] = the slope dr/ds of point i, s = the arc length along the points. A flat spot stays flat,
  // there is no overshoot between two points, and the silhouette has no kinks where a polyline of radii would have them.
  function pchip(s, r, n) {
    const m = new Array(n), d = new Array(n), h = new Array(n);
    if (n < 2) { m[0] = 0; return m; }
    for (let i = 0; i < n - 1; i++) { h[i] = Math.max(s[i + 1] - s[i], 1e-9); d[i] = (r[i + 1] - r[i]) / h[i]; }
    if (n === 2) { m[0] = m[1] = d[0]; return m; }
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
    }
    m[0] = ((2 * h[0] + h[1]) * d[0] - h[0] * d[1]) / (h[0] + h[1]);
    if (m[0] * d[0] <= 0) m[0] = 0; else if (d[0] * d[1] <= 0 && Math.abs(m[0]) > 3 * Math.abs(d[0])) m[0] = 3 * d[0];
    m[n - 1] = ((2 * h[n - 2] + h[n - 3]) * d[n - 2] - h[n - 2] * d[n - 3]) / (h[n - 2] + h[n - 3]);
    if (m[n - 1] * d[n - 2] <= 0) m[n - 1] = 0; else if (d[n - 2] * d[n - 3] <= 0 && Math.abs(m[n - 1]) > 3 * Math.abs(d[n - 2])) m[n - 1] = 3 * d[n - 2];
    return m;
  }
  function arc(pts, sx, sy, sz) {
    const out = [0];
    for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + Math.hypot((pts[i][0] - pts[i - 1][0]) * sx, (pts[i][1] - pts[i - 1][1]) * sy, (pts[i][2] - pts[i - 1][2]) * sz));
    return out;
  }

  // a group tag (part.group: a positive number, or a string that is hashed): the segments of one chain / loft, and consecutive parts with the same tag, are united with a hard min first
  function group_code(v) {
    if (typeof v === "number") return v > 0 ? v | 0 : 0;
    v = String(v);
    let h = 5381;
    for (let i = 0; i < v.length; i++) h = ((h * 33) ^ v.charCodeAt(i)) >>> 0;
    return h % 1000003 + 1;
  }

  function part_points(p) {                                      // the points that define a part's position (to find mirror copies that coincide with it)
    if (p.shape === "capsule" || p.shape === "round_cone") return [p.a, p.b];
    if (p.shape === "chain" || p.shape === "loft") return p.points;
    if (p.shape === "volume") return [p.center || [1, 1, 1]];  // (a volume without a centre stands where it was baked: its mirror copy is somewhere else)
    return [p.center];
  }
  function loft_values(v, n, dflt, what) {
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = v === undefined ? dflt : (typeof v === "object" && v ? v[i] : v);
      finite(out[i], what + "[" + i + "]");
    }
    return out;
  }

  // the volume `id` of a part of shape "volume": vols is a Map or a plain object of id -> volume (see the volumes section)
  function find_volume(vols, id, label) {
    const v = vols && id !== undefined ? (typeof vols.get === "function" ? vols.get(String(id)) : vols[String(id)]) : null;
    if (!v) fail(label + ": the volume '" + id + "' is not loaded (mesher.add_volume or happy_mesher.bake_mesh makes one)");
    return v;
  }

  // the primitive table of a list of native parts. vols: the loaded volumes (for the parts of shape "volume")
  function emit_prims(native, vols) {
    let prim = new Float64Array(STRIDE * 256), lx = new Float64Array(LX * 256), pbox = new Float64Array(6 * 256);
    const used_vols = [], vol_prim = Object.create(null);       // the volumes the primitives use (a volume primitive's [7] indexes it) and the primitive of each part that is one
    let nprims = 0, lip = 1, kmax = 0, bmax = 0, group_n = 0, cur_group = 0, cur_mode = 0, cur_bone = -1, cur_tag = 0, cur_island = 0;
    const island_names = [""];                                  // the islands in the order they appear: the default island (parts without `island`) is 0
    function island_index(v, label) {
      if (v === undefined || v === null || v === false || v === "") return 0;
      if (v !== true && typeof v !== "string" && !(typeof v === "number" && isFinite(v))) fail(label + ".island must be a name (a string or a number)");
      const name = v === true ? "island" : String(v);
      let i = island_names.indexOf(name);
      if (i < 0) { i = island_names.length; island_names.push(name); }
      return i;
    }
    const gmin = [BIG, BIG, BIG], gmax = [-BIG, -BIG, -BIG];

    function alloc_prim() {
      if ((nprims + 1) * STRIDE > prim.length) {
        let a = new Float64Array(prim.length * 2); a.set(prim); prim = a;
        a = new Float64Array(pbox.length * 2); a.set(pbox); pbox = a;
        a = new Float64Array(lx.length * 2); a.set(lx); lx = a;
      }
      return nprims++;
    }
    function set_box(i, x0, y0, z0, x1, y1, z1, op, k) {
      const o = i * 6, g = k * (cur_mode === 2 ? 0.5 : (cur_mode === 1 ? 1 / 6 : 0.25));
      pbox[o] = x0; pbox[o + 1] = y0; pbox[o + 2] = z0; pbox[o + 3] = x1; pbox[o + 4] = y1; pbox[o + 5] = z1;
      if (k > kmax) kmax = k;
      if (op === OP_UNION) {                                      // a smooth union bulges by at most k / 4 (round), k / 6 (cubic), k / 2 (chamfer)
        if (g > bmax) bmax = g;
        if (x0 - g < gmin[0]) gmin[0] = x0 - g;
        if (y0 - g < gmin[1]) gmin[1] = y0 - g;
        if (z0 - g < gmin[2]) gmin[2] = z0 - g;
        if (x1 + g > gmax[0]) gmax[0] = x1 + g;
        if (y1 + g > gmax[1]) gmax[1] = y1 + g;
        if (z1 + g > gmax[2]) gmax[2] = z1 + g;
      }
    }
    function head(i, ty, op, k, part) {
      const o = i * STRIDE;
      prim[o] = ty; prim[o + 1] = op; prim[o + 2] = k; prim[o + 3] = part; prim[o + 13] = cur_bone; prim[o + 14] = cur_group; prim[o + 15] = cur_mode; prim[o + 18] = cur_island; prim[o + 19] = 1;
      return o;
    }
    function emit_sphere(part, op, k, cx, cy, cz, r) {
      const i = alloc_prim(), o = head(i, T_SPHERE, op, k, part);
      prim[o + 4] = cx; prim[o + 5] = cy; prim[o + 6] = cz; prim[o + 7] = r;
      set_box(i, cx - r, cy - r, cz - r, cx + r, cy + r, cz + r, op, k);
    }
    function emit_ellipsoid(part, op, k, cx, cy, cz, rx, ry, rz) {
      const i = alloc_prim(), o = head(i, T_ELLIPSOID, op, k, part);
      prim[o + 4] = cx; prim[o + 5] = cy; prim[o + 6] = cz;
      prim[o + 7] = 1 / rx; prim[o + 8] = 1 / ry; prim[o + 9] = 1 / rz;
      prim[o + 10] = Math.min(rx, ry, rz);
      set_box(i, cx - rx, cy - ry, cz - rz, cx + rx, cy + ry, cz + rz, op, k);
    }
    function emit_capsule(part, op, k, ax, ay, az, bx, by, bz, ra, rb, ma, mb) {
      const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz;
      if (l2 < 1e-12) { emit_sphere(part, op, k, ax, ay, az, ra > rb ? ra : rb); return; }
      const i = alloc_prim(), o = head(i, T_CAPSULE, op, k, part), len = Math.sqrt(l2);
      prim[o + 4] = ax; prim[o + 5] = ay; prim[o + 6] = az;
      prim[o + 7] = dx; prim[o + 8] = dy; prim[o + 9] = dz;
      prim[o + 10] = 1 / l2; prim[o + 11] = ra; prim[o + 12] = rb - ra;
      if (ma === undefined) { ma = (rb - ra) / len; mb = ma; }    // a straight taper
      prim[o + 16] = ma * len; prim[o + 17] = mb * len;
      const rm = ra > rb ? ra : rb;
      set_box(i, Math.min(ax, bx) - rm, Math.min(ay, by) - rm, Math.min(az, bz) - rm, Math.max(ax, bx) + rm, Math.max(ay, by) + rm, Math.max(az, bz) + rm, op, k);
      const s = Math.max(Math.abs(rb - ra) * 1.5 / len, Math.abs(ma), Math.abs(mb)), g = Math.sqrt(1 + s * s);     // |grad d| of a tapered capsule: feeds the block-skip bound
      if (g > lip) lip = g;
      prim[o + 19] = g;
    }
    // one segment of a loft from a to b: cross section ellipses (rua x rva) -> (rub x rvb), squareness sqa -> sqb, twist pha -> phb (radians)
    function emit_loft(part, op, k, ax, ay, az, bx, by, bz, rua, rva, rub, rvb, sqa, sqb, pha, phb, mua, mub, mva, mvb) {
      const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz;
      if (l2 < 1e-12) { emit_sphere(part, op, k, ax, ay, az, Math.max(rua, rva, rub, rvb)); return; }
      const i = alloc_prim(), o = head(i, T_LOFT, op, k, part), len = Math.sqrt(l2), hx = dx / len, hy = dy / len, hz = dz / len;
      let ux, uy, uz;
      if (Math.abs(hx) < 0.9) { ux = 1 - hx * hx; uy = -hx * hy; uz = -hx * hz; }
      else { ux = -hz * hx; uy = -hz * hy; uz = 1 - hz * hz; }
      const ul = Math.sqrt(ux * ux + uy * uy + uz * uz); ux /= ul; uy /= ul; uz /= ul;
      prim[o + 4] = ax; prim[o + 5] = ay; prim[o + 6] = az;
      prim[o + 7] = dx; prim[o + 8] = dy; prim[o + 9] = dz;
      prim[o + 10] = 1 / l2; prim[o + 11] = i;
      const q = i * LX;
      lx[q] = rua; lx[q + 1] = rub - rua; lx[q + 2] = rva; lx[q + 3] = rvb - rva; lx[q + 4] = sqa; lx[q + 5] = sqb - sqa;
      lx[q + 6] = Math.cos(pha); lx[q + 7] = Math.sin(pha); lx[q + 8] = Math.cos(phb) - lx[q + 6]; lx[q + 9] = Math.sin(phb) - lx[q + 7];
      lx[q + 10] = ux; lx[q + 11] = uy; lx[q + 12] = uz;
      lx[q + 13] = hy * uz - hz * uy; lx[q + 14] = hz * ux - hx * uz; lx[q + 15] = hx * uy - hy * ux;
      lx[q + 16] = len;
      lx[q + 17] = mua * len; lx[q + 18] = mub * len; lx[q + 19] = mva * len; lx[q + 20] = mvb * len;
      const rm = Math.max(rua, rva, rub, rvb);
      set_box(i, Math.min(ax, bx) - rm, Math.min(ay, by) - rm, Math.min(az, bz) - rm, Math.max(ax, bx) + rm, Math.max(ay, by) + rm, Math.max(az, bz) + rm, op, k);
      // the distance is an estimate (exact near the surface): allow for its gradient when deciding which blocks can be skipped
      const s = Math.max(Math.abs(rub - rua) * 1.5 / len, Math.abs(rvb - rva) * 1.5 / len, Math.abs(mua), Math.abs(mub), Math.abs(mva), Math.abs(mvb)), g = 1.1 * Math.sqrt(1 + s * s);
      if (g > lip) lip = g;
      prim[o + 19] = g;
    }
    function emit_box(part, op, k, cx, cy, cz, hx, hy, hz, r) {
      r = Math.min(r, hx, hy, hz);
      const i = alloc_prim(), o = head(i, T_BOX, op, k, part);
      prim[o + 4] = cx; prim[o + 5] = cy; prim[o + 6] = cz;
      prim[o + 7] = hx - r; prim[o + 8] = hy - r; prim[o + 9] = hz - r; prim[o + 10] = r;
      set_box(i, cx - hx, cy - hy, cz - hz, cx + hx, cy + hy, cz + hz, op, k);
    }
    // a unit axis: "x" | "y" | "z" or a vector [x, y, z] (default y). A torus and a cylinder are symmetric about their middle plane: the sign of the axis does not matter
    function axis_vec(a, label) {
      if (a === undefined) return [0, 1, 0];
      if (a === "x" || a === "y" || a === "z") return [a === "x" ? 1 : 0, a === "y" ? 1 : 0, a === "z" ? 1 : 0];
      vec3(a, label);
      const l = Math.hypot(a[0], a[1], a[2]);
      if (!(l > 1e-9)) fail(label + " must not be the zero vector");
      return [a[0] / l, a[1] / l, a[2] / l];
    }
    // a ring about an axis: the distance to a circle of radius `big`, minus `small` (the tube). The box: along each world axis the disc's reach (big * sin of the angle to the axis) plus the tube
    function emit_torus(part, op, k, cx, cy, cz, ax, ay, az, big, small) {
      const i = alloc_prim(), o = head(i, T_TORUS, op, k, part);
      prim[o + 4] = cx; prim[o + 5] = cy; prim[o + 6] = cz; prim[o + 7] = ax; prim[o + 8] = ay; prim[o + 9] = az; prim[o + 10] = big; prim[o + 11] = small;
      const ex = big * Math.sqrt(Math.max(0, 1 - ax * ax)) + small, ey = big * Math.sqrt(Math.max(0, 1 - ay * ay)) + small, ez = big * Math.sqrt(Math.max(0, 1 - az * az)) + small;
      set_box(i, cx - ex, cy - ey, cz - ez, cx + ex, cy + ey, cz + ez, op, k);
    }
    // a cylinder about an axis with rounded edges: the exact distance of a rounded box in the (radial, axial) half plane. rad / half are the outer sizes, round <= min(rad, half)
    function emit_cylinder(part, op, k, cx, cy, cz, ax, ay, az, rad, half, round) {
      round = Math.max(0, Math.min(round, rad, half));
      const i = alloc_prim(), o = head(i, T_CYLINDER, op, k, part);
      prim[o + 4] = cx; prim[o + 5] = cy; prim[o + 6] = cz; prim[o + 7] = ax; prim[o + 8] = ay; prim[o + 9] = az; prim[o + 10] = rad - round; prim[o + 11] = half - round; prim[o + 12] = round;
      const ex = half * Math.abs(ax) + rad * Math.sqrt(Math.max(0, 1 - ax * ax)), ey = half * Math.abs(ay) + rad * Math.sqrt(Math.max(0, 1 - ay * ay)), ez = half * Math.abs(az) + rad * Math.sqrt(Math.max(0, 1 - az * az));
      set_box(i, cx - ex, cy - ey, cz - ez, cx + ex, cy + ey, cz + ez, op, k);
    }

    // a volume: a baked grid of distances (the bake section) placed in the world. The record: 4-6 where the middle of the volume's box stands (mirrored), 7 the volume's index in used_vols,
    // 8 the scale, 9 1 for a copy reflected across x (a mirror: its skin takes the twin bones, volume_skin), 11 the primitive's own index (its lx record); lx 0-8 the matrix that takes a world offset from
    // that middle to the volume's own frame (the turn undone, over the scale, and the mirror's reflection: R^T M / s), 9-11 the box middle in the volume's frame. The distance is the grid's (trilinear inside
    // it, the distance to its box outside) times the scale.
    // THE PLACEMENT (volume_place says it as a function): a point p of the volume's own frame (the frame its mesh was baked in) stands at  w = C + s R (p - mid)  (R = Rz Ry Rx of `rotate`, degrees, x first;
    // mid = the middle of the volume's box), C = `center`, or `origin` + s R mid (`origin`: where the volume's own origin stands, a piece's socket), or mid when neither is given; a mirror copy stands at M w
    // (M the reflection: x -> -x for "x"): the mirror image of the whole thing, its grid reflected too (a left leg's copy is a right leg, not a left leg moved across).
    function emit_volume(p, label, part, op, k, sx, sy, sz) {
      const V = find_volume(vols, p.volume, label);
      if (p.__mirror_x) sx = -sx;                                                                            // (the mirror copy across bones of a volume part: expand_parts left its place to this)
      if (p.center !== undefined && p.origin !== undefined) fail(label + ": give center (where the middle of the volume's box stands) or origin (where its own origin stands), not both");
      const rot = p.rotate !== undefined ? vec3(p.rotate, label + ".rotate") : [0, 0, 0];
      const s = p.scale === undefined ? 1 : finite(p.scale, label + ".scale");
      if (!(s > 0)) fail(label + ".scale must be > 0");
      const ca = Math.cos(rot[0] * DEG), sa = Math.sin(rot[0] * DEG), cb = Math.cos(rot[1] * DEG), sb = Math.sin(rot[1] * DEG), cc = Math.cos(rot[2] * DEG), sc = Math.sin(rot[2] * DEG);
      const R = [cc * cb, cc * sb * sa - sc * ca, cc * sb * ca + sc * sa, sc * cb, sc * sb * sa + cc * ca, sc * sb * ca - cc * sa, -sb, cb * sa, cb * ca];     // Rz * Ry * Rx (degrees, x first: the editor's q_euler)
      let c = V.mid;
      if (p.center !== undefined) c = vec3(p.center, label + ".center");
      else if (p.origin !== undefined) {
        const og = vec3(p.origin, label + ".origin"), m = V.mid;
        c = [og[0] + s * (R[0] * m[0] + R[1] * m[1] + R[2] * m[2]), og[1] + s * (R[3] * m[0] + R[4] * m[1] + R[5] * m[2]), og[2] + s * (R[6] * m[0] + R[7] * m[1] + R[8] * m[2])];
      }
      const M = [sx, sy, sz], Rm = new Array(9);
      for (let r = 0; r < 3; r++) for (let j = 0; j < 3; j++) Rm[r * 3 + j] = M[r] * R[r * 3 + j] * M[j];
      let vi = used_vols.indexOf(V);
      if (vi < 0) { vi = used_vols.length; used_vols.push(V); }
      const i = alloc_prim(), o = head(i, T_VOLUME, op, k, part), q = i * LX, cm = [c[0] * sx, c[1] * sy, c[2] * sz], is = 1 / s;
      if (V.attr && V.attr.skin) prim[o + 13] = -1;                                                          // (a rigged mesh brings its own weights: the vertices it owns take them, it does not claim them for a bone)
      prim[o + 4] = cm[0]; prim[o + 5] = cm[1]; prim[o + 6] = cm[2]; prim[o + 7] = vi; prim[o + 8] = s; prim[o + 9] = sx < 0 ? 1 : 0; prim[o + 11] = i;
      for (let r = 0; r < 3; r++) for (let j = 0; j < 3; j++) lx[q + r * 3 + j] = R[j * 3 + r] * M[j] * is;          // row r of R^T M / s (unmirrored: R^T / s, the numbers of before)
      lx[q + 9] = V.mid[0]; lx[q + 10] = V.mid[1]; lx[q + 11] = V.mid[2];
      const b = V.box, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let cn = 0; cn < 8; cn++) {
        const u = [(cn & 1 ? b[3] : b[0]) - V.mid[0], (cn & 2 ? b[4] : b[1]) - V.mid[1], (cn & 4 ? b[5] : b[2]) - V.mid[2]];
        for (let a = 0; a < 3; a++) { const w = cm[a] + s * (Rm[a * 3] * u[0] + Rm[a * 3 + 1] * u[1] + Rm[a * 3 + 2] * u[2]); if (w < lo[a]) lo[a] = w; if (w > hi[a]) hi[a] = w; }
      }
      set_box(i, lo[0], lo[1], lo[2], hi[0], hi[1], hi[2], op, k);
      if (VOLUME_LIP > lip) lip = VOLUME_LIP;
      prim[o + 19] = VOLUME_LIP;
      (vol_prim[part] || (vol_prim[part] = [])).push(i);                                                      // (a mirror copy is a second primitive of the same part)
    }

    function emit_shape(p, label, part, op, k, sx, sy, sz) {
      const s = p.shape;
      let i, n, r, ra, rb, pts, a, b, c, h, s_arc, mu, mv;
      if (s === "sphere") {
        c = vec3(p.center, label + ".center");
        emit_sphere(part, op, k, c[0] * sx, c[1] * sy, c[2] * sz, radius(p.radius, label + ".radius"));
      } else if (s === "ellipsoid") {
        c = vec3(p.center, label + ".center");
        r = vec3(p.radii, label + ".radii");
        emit_ellipsoid(part, op, k, c[0] * sx, c[1] * sy, c[2] * sz, radius(r[0], label + ".radii"), radius(r[1], label + ".radii"), radius(r[2], label + ".radii"));
      } else if (s === "capsule" || s === "round_cone") {
        a = vec3(p.a, label + ".a"); b = vec3(p.b, label + ".b");
        ra = p.ra !== undefined ? p.ra : p.radius;
        rb = p.rb !== undefined ? p.rb : (p.radius !== undefined ? p.radius : ra);
        emit_capsule(part, op, k, a[0] * sx, a[1] * sy, a[2] * sz, b[0] * sx, b[1] * sy, b[2] * sz, radius(ra, label + ".ra"), radius(rb, label + ".rb"));
      } else if (s === "chain") {
        pts = p.points;
        if (!pts || pts.length < 1) fail(label + ".points needs at least 1 point");
        n = pts.length;
        for (i = 0; i < n; i++) {
          vec3(pts[i], label + ".points[" + i + "]");
          if (typeof p.radii === "object" && p.radii) radius(p.radii[i], label + ".radii[" + i + "]");
        }
        if (!(typeof p.radii === "object" && p.radii)) radius(p.radius, label + ".radius");
        if (n === 1) emit_sphere(part, op, k, pts[0][0] * sx, pts[0][1] * sy, pts[0][2] * sz, p.radii ? p.radii[0] : p.radius);
        cur_group = cur_tag || (n > 2 ? ++group_n : 0);          // the segments meet in a hard union
        r = []; for (i = 0; i < n; i++) r.push(p.radii ? p.radii[i] : p.radius);
        ra = pchip(arc(pts, sx, sy, sz), r, n);
        for (i = 0; i < n - 1; i++) {
          a = pts[i]; b = pts[i + 1];
          emit_capsule(part, op, k, a[0] * sx, a[1] * sy, a[2] * sz, b[0] * sx, b[1] * sy, b[2] * sz, r[i], r[i + 1], ra[i], ra[i + 1]);
        }
        cur_group = 0;
      } else if (s === "loft") {
        pts = p.points;
        if (!pts || pts.length < 2) fail(label + ".points needs at least 2 points for a loft");
        n = pts.length;
        for (i = 0; i < n; i++) vec3(pts[i], label + ".points[" + i + "]");
        r = loft_values(p.radii !== undefined ? p.radii : p.radius, n, undefined, label + ".radii");
        ra = p.radii_v === undefined ? r.slice() : loft_values(p.radii_v, n, undefined, label + ".radii_v");
        rb = loft_values(p.twist, n, 0, label + ".twist");
        h = loft_values(p.square, n, 0, label + ".square");
        for (i = 0; i < n; i++) { radius(r[i], label + ".radii[" + i + "]"); radius(ra[i], label + ".radii_v[" + i + "]"); }
        c = sx * sy * sz < 0 ? -Math.PI / 180 : Math.PI / 180;    // a reflection turns the other way
        cur_group = cur_tag || (n > 2 ? ++group_n : 0);
        s_arc = arc(pts, sx, sy, sz); mu = pchip(s_arc, r, n); mv = pchip(s_arc, ra, n);
        for (i = 0; i < n - 1; i++) {
          a = pts[i]; b = pts[i + 1];
          emit_loft(part, op, k, a[0] * sx, a[1] * sy, a[2] * sz, b[0] * sx, b[1] * sy, b[2] * sz, r[i], ra[i], r[i + 1], ra[i + 1],
            Math.min(1, Math.max(0, h[i])), Math.min(1, Math.max(0, h[i + 1])), rb[i] * c, rb[i + 1] * c, mu[i], mu[i + 1], mv[i], mv[i + 1]);
        }
        cur_group = 0;
      } else if (s === "box") {
        c = vec3(p.center, label + ".center");
        h = vec3(p.half, label + ".half");
        emit_box(part, op, k, c[0] * sx, c[1] * sy, c[2] * sz, radius(h[0], label + ".half"), radius(h[1], label + ".half"), radius(h[2], label + ".half"), p.round === undefined ? 0 : finite(p.round, label + ".round"));
      } else if (s === "torus") {
        c = vec3(p.center, label + ".center");
        a = axis_vec(p.axis, label + ".axis");
        if (finite(p.radius, label + ".radius") < 0) fail(label + ".radius must be >= 0");
        emit_torus(part, op, k, c[0] * sx, c[1] * sy, c[2] * sz, a[0] * sx, a[1] * sy, a[2] * sz, p.radius, radius(p.tube, label + ".tube"));
      } else if (s === "cylinder") {
        c = vec3(p.center, label + ".center");
        a = axis_vec(p.axis, label + ".axis");
        h = p.half !== undefined ? p.half : (p.height !== undefined ? finite(p.height, label + ".height") * 0.5 : undefined);
        emit_cylinder(part, op, k, c[0] * sx, c[1] * sy, c[2] * sz, a[0] * sx, a[1] * sy, a[2] * sz, radius(p.radius, label + ".radius"), radius(h, label + ".half (or .height)"), p.round === undefined ? 0 : finite(p.round, label + ".round"));
      } else if (s === "volume") {
        emit_volume(p, label, part, op, k, sx, sy, sz);
      } else fail(label + " has the unknown shape '" + s + "'");
    }

    for (let pi = 0; pi < native.length; pi++) {
      const p = native[pi], label = "part '" + p.id + "'";
      if (p.enabled === false) continue;
      let op = OP_UNION;
      if (p.op === "subtract") op = OP_SUBTRACT;
      else if (p.op === "intersect") op = OP_INTERSECT;
      else if (p.op !== undefined && p.op !== "union") fail(label + " has the unknown op '" + p.op + "'");
      const k = p.blend === undefined ? 0 : finite(p.blend, label + ".blend");
      if (k < 0) fail(label + ".blend must be >= 0");
      const mir = typeof p.mirror === "string" ? p.mirror : "";
      cur_mode = p.blend_mode === undefined || p.blend_mode === "round" ? 0 : (p.blend_mode === "cubic" ? 1 : (p.blend_mode === "chamfer" ? 2 : -1));
      if (cur_mode < 0) fail(label + ".blend_mode must be 'round', 'cubic' or 'chamfer'");
      cur_tag = p.group !== undefined && mir === "" ? 1048576 + group_code(p.group) : 0;
      cur_bone = p.bone;
      cur_island = island_index(p.island, label);
      const mx = mir.indexOf("x") >= 0, my = mir.indexOf("y") >= 0, mz = mir.indexOf("z") >= 0;
      let first = true;
      for (let ix = 0; ix < (mx ? 2 : 1); ix++) {
        for (let iy = 0; iy < (my ? 2 : 1); iy++) {
          for (let iz = 0; iz < (mz ? 2 : 1); iz++) {
            if (!first) {                                         // skip a reflected copy that lies exactly on the original
              let same = true;
              const pts = part_points(p);
              for (let j = 0; j < pts.length && same; j++) {
                if (!pts[j]) continue;
                if ((ix && Math.abs(pts[j][0]) > 1e-9) || (iy && Math.abs(pts[j][1]) > 1e-9) || (iz && Math.abs(pts[j][2]) > 1e-9)) same = false;
              }
              if (same) continue;
            }
            first = false;
            cur_group = cur_tag;
            emit_shape(p, label, pi, op, k, ix ? -1 : 1, iy ? -1 : 1, iz ? -1 : 1);
            cur_group = 0;
          }
        }
      }
    }
    if (gmin[0] > gmax[0]) fail("the def needs at least one 'union' part");
    // the box the cull lists use ("reach"). A loft's box is the box of its polyline grown by its largest radius (what the grid is made from, as the native mesher does). A square cross section (squareness > 0)
    // is a squircle, and along a world axis it reaches up to 2^(1/4) = 1.19 times its radius: the support of the L4 ball of that radius in the direction of the axis, (|u|^(4/3) + |v|^(4/3))^(3/4) for the
    // components u, v of the world axis along the cross section's own two axes, which the loft's frame and its twist turn (a twist of 45 degrees makes a diamond whose corners stand out of the box: the
    // ridge of the barn's roof). For the lists such a loft's box is widened axis by axis by what its frame needs: nothing where the cross section is aligned with the world axes (most lofts), so the lists
    // stay short. Every other primitive keeps its box.
    const rbox = pbox.slice(0, nprims * 6);
    for (let i = 0; i < nprims; i++) {
      const o = i * STRIDE;
      if (prim[o] !== T_LOFT) continue;
      const q = prim[o + 11] * LX;
      if (!(Math.max(lx[q + 4], lx[q + 4] + lx[q + 5]) > 0)) continue;
      const rm = Math.max(Math.abs(lx[q]), Math.abs(lx[q] + lx[q + 1]), Math.abs(lx[q + 2]), Math.abs(lx[q + 2] + lx[q + 3]));
      for (let c = 0; c < 3; c++) {
        const e1 = lx[q + 10 + c], e2 = lx[q + 13 + c];                          // the frame's two axes, along world axis c
        let reach = 0;
        for (let s = 0; s <= 8; s++) {                                         // the twist turns the cross section along the segment: the worst direction of its length
          const t = s / 8;
          let cs = lx[q + 6] + lx[q + 8] * t, sn = lx[q + 7] + lx[q + 9] * t;
          const l = Math.sqrt(cs * cs + sn * sn);
          if (l > 1e-12) { cs /= l; sn /= l; } else { cs = 1; sn = 0; }
          const u = Math.abs(cs * e1 + sn * e2), v = Math.abs(cs * e2 - sn * e1);
          const h = Math.pow(Math.pow(u, 4 / 3) + Math.pow(v, 4 / 3), 0.75);
          if (h > reach) reach = h;
        }
        const w = Math.max(0, 1.03 * reach * rm - rm);
        rbox[i * 6 + c] -= w; rbox[i * 6 + 3 + c] += w;
      }
    }
    return { n: nprims, prim: prim.slice(0, nprims * STRIDE), lx: lx.slice(0, nprims * LX), box: pbox.slice(0, nprims * 6), rbox: rbox, lip: lip, kmax: kmax, bmax: bmax, gmin: gmin, gmax: gmax, islands: island_names, vols: used_vols, vol_prim: vol_prim };
  }

  // def.adaptive = { min_cell, max_cell, tolerance, features, balance, project }: an octree instead of the uniform grid (geometry_creature.cpp: the leaves are min_cell .. max_cell, rounded to min_cell * 2^k; a
  // leaf is split while it is bigger than max_cell, while a primitive crossing it is thinner than `features` leaves, while its vertex is further than `tolerance` from the surface or the field is not linear in it;
  // `balance` grades the tree, `project` pulls the vertices onto the surface). max_cell defaults to the def's cell, else 4 * min_cell; tolerance to 0.35 * min_cell, features to 3.
  function norm_adaptive(ad, def_cell, label) {
    if (ad === undefined || ad === null || ad === false) return null;
    if (typeof ad !== "object") fail(label + " must be an object { min_cell, max_cell, tolerance, features, balance, project }");
    const min_cell = finite(ad.min_cell, label + ".min_cell");
    if (!(min_cell > 1e-6)) fail(label + ".min_cell must be > 0");
    const max_cell = ad.max_cell !== undefined ? finite(ad.max_cell, label + ".max_cell") : (def_cell !== undefined ? def_cell : min_cell * 4);
    if (max_cell < min_cell) fail(label + ".max_cell must be >= min_cell");
    return {
      min_cell: min_cell, max_cell: max_cell, tolerance: ad.tolerance !== undefined ? finite(ad.tolerance, label + ".tolerance") : 0, features: ad.features !== undefined ? finite(ad.features, label + ".features") : 3,
      balance: ad.balance === true, project: ad.project !== false
    };
  }
  // def.decimate = true | { ratio, triangles, error, max_edge, min_quality, project, color }: quadric edge collapse of the finished mesh. ratio (default 0.5) of the triangles are kept, or `triangles` of them (wins);
  // it stops when a collapse would move the surface by more than `error` (default 0.5 * the finest cell), never makes an edge longer than `max_edge` (default 4 * the coarsest cell) or a triangle thinner than
  // `min_quality` (0 = a sliver, 1 = equilateral; default 0.1); `project` (default on) pulls every vertex back onto the surface afterwards. `color` (default 1, 0 = off) is how much a change of colour counts
  // in the order the edges go (it only matters where a volume has colours): an edge between two colours goes later than one inside a colour, so the vertices that are left are where the colour changes.
  function norm_decimate(dec, label) {
    if (dec === undefined || dec === null || dec === false) return null;
    if (dec === true) dec = {};
    if (typeof dec !== "object") fail(label + " must be true or an object { ratio, triangles, error, max_edge, min_quality, project, color }");
    const num = function (v, k, d) { return v !== undefined ? finite(v, label + "." + k) : d; };
    const color = num(dec.color, "color", 1);
    if (color < 0) fail(label + ".color must be >= 0 (0 leaves the colours out of it)");
    return { ratio: num(dec.ratio, "ratio", 0), triangles: num(dec.triangles, "triangles", 0), error: num(dec.error, "error", 0), max_edge: num(dec.max_edge, "max_edge", 0), min_quality: num(dec.min_quality, "min_quality", -1), project: dec.project !== false, color: color };
  }

  // ---- settings: the numbers of the def (and the caller's overrides) that shape the mesh -----------------------------------------------------------------------------------------------
  function settings(def, opts) {
    opts = opts || {};
    const pick = function (a, b, d) { return a !== undefined ? a : (b !== undefined ? b : d); };
    const cell = finite(pick(opts.cell, def.cell, 0.05), "cell");
    if (!(cell > 1e-6 && cell < 1e4)) fail("cell is out of range (" + cell + ")");
    const sh = def.shade || {}, sk = def.skin || {};
    const s = {
      cell: cell,
      max_samples: pick(opts.max_samples, def.max_samples, 16777216),
      uv_scale: def.uv_scale === undefined ? 1 : finite(def.uv_scale, "uv_scale"),
      part_ids: pick(opts.part_ids, def.part_ids, false) === true,
      ao: sh.ao > 0 ? Math.min(1, finite(sh.ao, "shade.ao")) : 0,
      ao_radius: sh.ao_radius > 0 ? finite(sh.ao_radius, "shade.ao_radius") : 0,
      tone: sh.tone ? finite(sh.tone, "shade.tone") : 0,
      color_blend: sh.color_blend > 0 ? finite(sh.color_blend, "shade.color_blend") : 0,
      skin_falloff: sk.falloff !== undefined ? finite(sk.falloff, "skin.falloff") : 0.5,
      skin_min_blend: sk.min_blend !== undefined ? finite(sk.min_blend, "skin.min_blend") : 0,        // 0: half a cell
      skin_range: sk.range !== undefined ? finite(sk.range, "skin.range") : 1,
      skin_seam: sk.seam !== undefined ? finite(sk.seam, "skin.seam") : 1                                // a rigged volume's skin mixes with its neighbours' across seam * blend (+ min_blend): volume_skin; 0: by ownership
    };
    if (s.skin_falloff < 0 || s.skin_min_blend < 0 || !(s.skin_range > 0) || s.skin_seam < 0) fail("skin needs falloff >= 0, min_blend >= 0, range > 0 and seam >= 0");
    if (opts.shade === false) { s.ao = 0; s.tone = 0; s.color_blend = 0; }
    if (opts.skin === false) s.skin = false;
    // the call's adaptive / decimate win over the def's (false turns it off, true takes the def's)
    const want_ad = opts.adaptive === undefined || opts.adaptive === true ? def.adaptive : opts.adaptive;
    const want_dec = opts.decimate === undefined ? def.decimate : (opts.decimate === true ? (def.decimate !== undefined && def.decimate !== false ? def.decimate : true) : opts.decimate);
    s.adaptive = norm_adaptive(want_ad, def.cell, "adaptive");
    s.decimate = norm_decimate(want_dec, "decimate");
    return s;
  }

  // the bone names of a volume part (volume_skin reads them; only a part that says them has them, so the parts of every other def are what they were): `host`, the bone the part names (`@host`
  // goes to it unless bone_map says otherwise; a mirror copy across bones keeps its original's: the twin is taken after), and bone_map { name in the volume's skin: bone of the def | null (dropped) },
  // checked here: a name that maps to no bone of the def is a mistake, not a weight to lose
  function volume_names(p, e, sk) {
    if (p.host_name) e.host = p.host_name;
    if (p.bone_map === undefined || p.bone_map === null) return;
    const label = "part '" + p.id + "'.bone_map";
    if (typeof p.bone_map !== "object" || Array.isArray(p.bone_map)) fail(label + " must be an object { name in the volume's skin: bone of the def (or null: dropped) }");
    if (!sk) fail(label + ": the def has no bones to map to");
    const bad = [];
    for (const k in p.bone_map) { const t = p.bone_map[k]; if (t !== null && (typeof t !== "string" || sk.index[t] === undefined)) bad.push(k + " -> " + JSON.stringify(t)); }
    if (bad.length) fail(label + ": these names map to no bone of the def: " + bad.join(", "));
    e.bone_map = p.bone_map;
  }

  // def -> Compiled. Throws (and keeps nothing) when the def is bad.
  function compile(def, opts) {
    if (!def || typeof def !== "object") fail("the def must be an object");
    if (def.bones !== undefined && !Array.isArray(def.bones)) fail("bones must be an array");
    const sk = def.bones && def.bones.length ? make_skeleton(def.bones) : null;
    const native = expand_parts(def, sk), E = emit_prims(native, opts && opts.volumes), st = settings(def, opts);
    let use_colors = E.vols.some(function (v) { return !!(v.attr && v.attr.colors); }), use_uvs = false;     // (a volume that carries colours makes colours)
    const parts = native.map(function (p) {
      const c = p.color;
      if (c !== undefined) { use_colors = true; }
      if (p.uv_offset !== undefined) use_uvs = true;
      const e = {
        id: p.id, source: p.source, bone: p.bone, bone_name: p.bone_name, op: p.op === "subtract" ? OP_SUBTRACT : (p.op === "intersect" ? OP_INTERSECT : OP_UNION),
        color: c !== undefined ? [finite(c[0], p.id + ".color"), finite(c[1], p.id + ".color"), finite(c[2], p.id + ".color"), c.length > 3 ? finite(c[3], p.id + ".color") : 1] : [1, 1, 1, 1],
        uv_offset: p.uv_offset !== undefined ? [finite(p.uv_offset[0], p.id + ".uv_offset"), finite(p.uv_offset[1], p.id + ".uv_offset")] : null,
        uv_scale: p.uv_offset !== undefined ? (p.uv_scale ? [finite(p.uv_scale[0], p.id + ".uv_scale"), finite(p.uv_scale[1], p.id + ".uv_scale")] : [1, 1]) : null
      };
      if (p.shape === "volume") volume_names(p, e, sk);
      return e;
    });
    let n_bone_prims = 0;
    for (let i = 0; i < E.n; i++) if (E.prim[i * STRIDE + 1] === OP_UNION && (E.prim[i * STRIDE + 13] >= 0 || (E.prim[i * STRIDE] === T_VOLUME && has_skin(E.vols[E.prim[i * STRIDE + 7] | 0])))) n_bone_prims++;
    return {
      n: E.n, prim: E.prim, lx: E.lx, box: E.box, rbox: E.rbox, lip: E.lip, kmax: E.kmax, bmax: E.bmax, gmin: E.gmin, gmax: E.gmax, islands: E.islands, vols: E.vols, vol_prim: E.vol_prim,
      parts: parts, skeleton: sk, settings: st, use_colors: use_colors, use_uvs: use_uvs, skin: !!sk && n_bone_prims > 0 && st.skin !== false
    };
  }

  // do two compiled defs use the same volumes (the same object, or the same id at the same version)?
  function same_vols(a, b) {
    const x = a.vols || [], y = b.vols || [];
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i] && (x[i].id !== y[i].id || x[i].version !== y[i].version)) return false;
    return true;
  }

  // do two compiled defs describe the same shape (primitives, colours, settings)? A live edit that changed nothing is not rebuilt.
  function same(a, b) {
    if (!a || !b || a.n !== b.n || a.parts.length !== b.parts.length || !same_vols(a, b)) return false;
    for (let i = 0, m = a.prim.length; i < m; i++) if (a.prim[i] !== b.prim[i]) return false;
    for (let i = 0, m = a.lx.length; i < m; i++) if (a.lx[i] !== b.lx[i]) return false;
    for (let i = 0; i < a.parts.length; i++) {
      const p = a.parts[i], q = b.parts[i];
      if (p.color[0] !== q.color[0] || p.color[1] !== q.color[1] || p.color[2] !== q.color[2] || p.color[3] !== q.color[3]) return false;
      if (JSON.stringify(p.uv_offset) !== JSON.stringify(q.uv_offset) || JSON.stringify(p.uv_scale) !== JSON.stringify(q.uv_scale)) return false;
    }
    return JSON.stringify(a.settings) === JSON.stringify(b.settings);
  }

  // do two compiled defs have the same SHAPE (the primitives and the grid they are sampled on)? Then only what is computed per vertex (colours, uvs, skin, shading) can differ.
  function same_shape(a, b) {
    if (!a || !b || a.n !== b.n || a.settings.cell !== b.settings.cell || a.settings.max_samples !== b.settings.max_samples || !same_vols(a, b)) return false;
    if (JSON.stringify(a.settings.adaptive) !== JSON.stringify(b.settings.adaptive) || JSON.stringify(a.settings.decimate) !== JSON.stringify(b.settings.decimate)) return false;
    for (let i = 0, m = a.prim.length; i < m; i++) if (a.prim[i] !== b.prim[i]) return false;
    for (let i = 0, m = a.lx.length; i < m; i++) if (a.lx[i] !== b.lx[i]) return false;
    return true;
  }

  // ---- islands: the primitives of one island as a Compiled of its own ----------------------------------------------------------------------------------------------------------------------
  // A part with `island: "name"` belongs to the island of that name, together with the other parts that name it (and its mirror copies, chain segments, loft pieces); the parts without one are the
  // default island. An island is its OWN field: its union / subtract / intersect parts and nothing else. It is meshed on its own grid and shaded and skinned from its own primitives, so two islands
  // never blend, never carve each other and never share a vertex or a skin weight, even where they overlap or touch (a wheel in its arch). The parts, the skeleton and the part indices stay the
  // def's: part_ids of every island index the same parts array. def.islands = { name: { cell } } gives an island a grid step of its own (the call's own cell wins over it).
  function island_comp(comp, isl, def, opts) {
    const name = comp.islands[isl], P = comp.prim, idx = [];
    for (let i = 0; i < comp.n; i++) if (P[i * STRIDE + 18] === isl) idx.push(i);
    const n = idx.length, prim = new Float64Array(n * STRIDE), lx = new Float64Array(n * LX), box = new Float64Array(n * 6), rbox = new Float64Array(n * 6), used = Object.create(null), vol_prim = Object.create(null);
    let lip = 1, kmax = 0, bmax = 0, n_bone_prims = 0;
    const gmin = [BIG, BIG, BIG], gmax = [-BIG, -BIG, -BIG];
    for (let k = 0; k < n; k++) {
      const i = idx[k], o = i * STRIDE, o2 = k * STRIDE;
      for (let c = 0; c < STRIDE; c++) prim[o2 + c] = P[o + c];
      if (P[o] === T_LOFT || P[o] === T_VOLUME) {                 // a loft's cross section record (a volume's matrix) is indexed by the primitive itself
        const q = P[o + 11] * LX;
        prim[o2 + 11] = k;
        for (let c = 0; c < LX; c++) lx[k * LX + c] = comp.lx[q + c];
        if (P[o] === T_VOLUME) (vol_prim[P[o + 3]] || (vol_prim[P[o + 3]] = [])).push(k);
      }
      for (let c = 0; c < 6; c++) { box[k * 6 + c] = comp.box[i * 6 + c]; rbox[k * 6 + c] = comp.rbox[i * 6 + c]; }
      used[P[o + 3]] = true;
      if (P[o + 19] > lip) lip = P[o + 19];
      if (P[o + 2] > kmax) kmax = P[o + 2];
      if (P[o + 1] === OP_UNION) {
        const g = P[o + 2] * (P[o + 15] === 2 ? 0.5 : (P[o + 15] === 1 ? 1 / 6 : 0.25));
        if (g > bmax) bmax = g;
        for (let c = 0; c < 3; c++) { if (box[k * 6 + c] - g < gmin[c]) gmin[c] = box[k * 6 + c] - g; if (box[k * 6 + 3 + c] + g > gmax[c]) gmax[c] = box[k * 6 + 3 + c] + g; }
        if (P[o + 13] >= 0 || (P[o] === T_VOLUME && has_skin(comp.vols[P[o + 7] | 0]))) n_bone_prims++;
      }
    }
    if (gmin[0] > gmax[0]) fail("the island '" + name + "' needs at least one 'union' part");
    const st = Object.assign({}, comp.settings), over = def && def.islands && def.islands[name];
    if (over && over.cell !== undefined && (!opts || opts.cell === undefined)) {
      st.cell = finite(over.cell, "islands." + name + ".cell");
      if (!(st.cell > 1e-6 && st.cell < 1e4)) fail("islands." + name + ".cell is out of range (" + st.cell + ")");
    }
    if (over && over.adaptive !== undefined && (!opts || opts.adaptive === undefined)) st.adaptive = norm_adaptive(over.adaptive, over.cell !== undefined ? over.cell : def.cell, "islands." + name + ".adaptive");
    if (over && over.decimate !== undefined && (!opts || opts.decimate === undefined)) st.decimate = norm_decimate(over.decimate, "islands." + name + ".decimate");
    return {
      n: n, prim: prim, lx: lx, box: box, rbox: rbox, lip: lip, kmax: kmax, bmax: bmax, gmin: gmin, gmax: gmax, islands: comp.islands, vols: comp.vols, vol_prim: vol_prim,
      parts: comp.parts, skeleton: comp.skeleton, settings: st, use_colors: comp.use_colors, use_uvs: comp.use_uvs, skin: !!comp.skeleton && n_bone_prims > 0 && st.skin !== false,
      island: name, island_index: isl, used_parts: Object.keys(used).map(Number).sort(function (a, b) { return a - b; })
    };
  }

  // the islands of a compiled def that have something in them: [{ index, name, comp }] (a def without islands is one island: the compiled def itself)
  function island_list(comp, def, opts) {
    if (comp.islands.length === 1) return [{ index: 0, name: "", comp: comp }];
    const out = [], count = new Int32Array(comp.islands.length);
    for (let i = 0; i < comp.n; i++) count[comp.prim[i * STRIDE + 18]]++;
    for (let k = 0; k < comp.islands.length; k++) if (count[k] > 0) out.push({ index: k, name: comp.islands[k], comp: island_comp(comp, k, def, opts) });
    return out;
  }

  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // grid - where the samples go, and which primitives matter where.
  //
  // The mesh is the zero set of the field sampled on a uniform grid ("samples" at origin + i * cell, i = 0 .. n - 1 on each axis); a sample grid is laid out like the native uniform mesher
  // does (the union's box plus the largest bulge plus 3 cells on every side, so the surface never touches the border) and is coarsened when it would hold more than `max_samples`.
  //
  // The cull lists are a CSR over BLOCKS of B x B x B cells: block (bx, by, bz) owns the samples whose index / B is that block. Its list holds every primitive that can change the field
  // anywhere in the block (the primitive's box grown by its blend and by `pad`, per axis for the stretched distances of ellipsoids and lofts), in the order of the primitive table, so folding
  // the list gives the same value as folding every primitive wherever the true field is within `pad` of the block. Intersections clip everywhere: they are in every list.
  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  function make_grid(comp, cell, max_samples) {
    let c = cell, ex, ey, ez, ox, oy, oz, total = 0;
    for (let guard = 0; guard < 80; guard++) {
      const mg = 3 * c + comp.bmax;
      ox = comp.gmin[0] - mg; oy = comp.gmin[1] - mg; oz = comp.gmin[2] - mg;
      ex = Math.max(1, Math.ceil((comp.gmax[0] - comp.gmin[0] + 2 * mg) / c));
      ey = Math.max(1, Math.ceil((comp.gmax[1] - comp.gmin[1] + 2 * mg) / c));
      ez = Math.max(1, Math.ceil((comp.gmax[2] - comp.gmin[2] + 2 * mg) / c));
      total = (ex + 1) * (ey + 1) * (ez + 1);
      if (total <= max_samples && ex < 30000 && ey < 30000 && ez < 30000) break;
      c *= Math.pow(total / max_samples, 1 / 3) * 1.01;
      if (!(c > 0) || c > 1e6) throw new Error("happy_mesher: the grid cannot be made (cell " + c + ")");
    }
    return { cell: c, requested_cell: cell, coarsened: c !== cell, origin: [ox, oy, oz], n: [ex + 1, ey + 1, ez + 1], total: total };
  }

  // the cull lists for blocks of B cells. pad: how far (world units) from a block a primitive may still matter.
  function build_csr(comp, grid, B, pad) {
    const n = comp.n, prim = comp.prim, box = comp.rbox, cs = grid.cell * B;
    const nb = [Math.ceil(grid.n[0] / B), Math.ceil(grid.n[1] / B), Math.ceil(grid.n[2] / B)], nblocks = nb[0] * nb[1] * nb[2];
    const ox = grid.origin[0], oy = grid.origin[1], oz = grid.origin[2], inv = 1 / cs;
    const rng = new Int32Array(n * 6), start = new Int32Array(nblocks + 1);
    const nbx = nb[0], nby = nb[1], nbz = nb[2];
    for (let i = 0; i < n; i++) {
      const o = i * STRIDE, r = i * 6, b = i * 6;
      let x0 = 0, x1 = nbx - 1, y0 = 0, y1 = nby - 1, z0 = 0, z1 = nbz - 1;
      if (prim[o + 1] !== OP_INTERSECT) {
        const ty = prim[o], k = prim[o + 2] + pad;
        let ex = k, ey = k, ez = k;
        if (ty === T_ELLIPSOID) { ex = k / (prim[o + 7] * prim[o + 10]); ey = k / (prim[o + 8] * prim[o + 10]); ez = k / (prim[o + 9] * prim[o + 10]); }    // the distance is scaled: it reaches further along the long axes
        else if (ty === T_LOFT) { ex = ey = ez = k * 1.3; }                                                                                            // the loft distance is an estimate that can fall short of the true distance
        x0 = Math.max(0, Math.floor((box[b] - ex - ox) * inv)); x1 = Math.min(nbx - 1, Math.floor((box[b + 3] + ex - ox) * inv));
        y0 = Math.max(0, Math.floor((box[b + 1] - ey - oy) * inv)); y1 = Math.min(nby - 1, Math.floor((box[b + 4] + ey - oy) * inv));
        z0 = Math.max(0, Math.floor((box[b + 2] - ez - oz) * inv)); z1 = Math.min(nbz - 1, Math.floor((box[b + 5] + ez - oz) * inv));
      }
      rng[r] = x0; rng[r + 1] = x1; rng[r + 2] = y0; rng[r + 3] = y1; rng[r + 4] = z0; rng[r + 5] = z1;
      for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) {
        let c = x0 + nbx * (y + nby * z) + 1;
        for (let x = x0; x <= x1; x++, c++) start[c]++;
      }
    }
    for (let c = 0; c < nblocks; c++) start[c + 1] += start[c];
    const list = new Int32Array(start[nblocks]), cur = start.slice(0, nblocks);
    for (let i = 0; i < n; i++) {
      const r = i * 6, x0 = rng[r], x1 = rng[r + 1], y0 = rng[r + 2], y1 = rng[r + 3], z0 = rng[r + 4], z1 = rng[r + 5];
      for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) {
        let c = x0 + nbx * (y + nby * z);
        for (let x = x0; x <= x1; x++, c++) list[cur[c]++] = i;
      }
    }
    return { B: B, nb: nb, nblocks: nblocks, start: start, list: list, cs: cs, pad: pad, entries: list.length };
  }

  // the block of a point (clamped into the grid)
  function block_of(csr, grid, x, y, z) {
    let bx = Math.floor((x - grid.origin[0]) / csr.cs), by = Math.floor((y - grid.origin[1]) / csr.cs), bz = Math.floor((z - grid.origin[2]) / csr.cs);
    bx = bx < 0 ? 0 : (bx >= csr.nb[0] ? csr.nb[0] - 1 : bx);
    by = by < 0 ? 0 : (by >= csr.nb[1] ? csr.nb[1] - 1 : by);
    bz = bz < 0 ? 0 : (bz >= csr.nb[2] ? csr.nb[2] - 1 : bz);
    return bx + csr.nb[0] * (by + csr.nb[1] * bz);
  }

  // how far from the surface the passes over the vertices need an exact field: ambient occlusion reaches `ao_radius` (+ the blends), soft colours and skin weights a little more than a blend
  function pass_reach(comp, st, cell) {
    const kmax = comp.kmax;
    let r = 3 * cell;
    if (st.ao > 0) r = Math.max(r, 2 * (st.ao_radius > 0 ? st.ao_radius : 0.12) + kmax + 1e-3);      // a sample up to R from the vertex must see every primitive within R + blend of it
    if (st.color_blend > 0) r = Math.max(r, comp.bmax + st.color_blend * kmax + cell + 1e-3);
    if (comp.skin) r = Math.max(r, st.skin_range * (kmax * st.skin_falloff + (st.skin_min_blend > 0 ? st.skin_min_blend : 0.5 * cell)) + comp.bmax + cell);
    return r;
  }

  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // extract - the surface from the samples: surface nets (one vertex per cell the surface crosses, at the mean of the crossings of the cell's edges; one quad per crossed edge), the
  // same cells, corners, quads and diagonals as the native uniform mesher, so the meshes agree.
  //
  // The samples come from a `vol` (a dense array, or the atlas the GPU filled): { nx, ny, nz, layer(z, out), active } where layer fills out.data (a Float32Array) and out.a / out.b (Int32Array ny)
  // with the offsets of the rows y of the planes z and z + 1 in out.data. A sample is inside when it is < 0. The grid's border must be outside (make_grid pads it).
  // `active` (optional): { B, nb: [bx, by, bz], start } - the cull lists of blocks of B cells (the grid section): a block whose list is empty has no primitive within the pad, so every sample of it
  // is far outside and no cell that starts in it can hold the surface (the pad is more than a cell): those cells are not looked at.
  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const EA = [0, 2, 4, 6, 0, 1, 4, 5, 0, 1, 2, 3], EB = [1, 3, 5, 7, 2, 3, 6, 7, 4, 5, 6, 7];            // the 12 edges of a cell as corner pairs (corner bits: x = 1, y = 2, z = 4)
  const CX = [0, 1, 0, 1, 0, 1, 0, 1], CY = [0, 0, 1, 1, 0, 0, 1, 1], CZ = [0, 0, 0, 0, 1, 1, 1, 1];

  // samples in a dense array, x fastest then y then z
  function dense_volume(data, nx, ny, nz) {
    return {
      nx: nx, ny: ny, nz: nz,
      layer: function (z, out) {
        out.data = data;
        for (let y = 0; y < ny; y++) { out.a[y] = (z * ny + y) * nx; out.b[y] = ((z + 1) * ny + y) * nx; }
      }
    };
  }

  // -> { positions: Float32Array (3 nv, a view of a larger buffer), nv, indices: Uint32Array, ni }
  function surface_nets(vol, grid, scratch) {
    const nx = vol.nx, ny = vol.ny, nz = vol.nz, cxn = nx - 1, cyn = ny - 1, czn = nz - 1, layer = cxn * cyn, cell = grid.cell;
    const ox = grid.origin[0], oy = grid.origin[1], oz = grid.origin[2];
    const vid = new Int32Array(layer * 2), cv = new Float32Array(8), L = { data: null, a: new Int32Array(ny), b: new Int32Array(ny) };
    const act = vol.active || null, B = act ? act.B : 1, nbx = act ? act.nb[0] : 0, nby = act ? act.nb[1] : 0, start = act ? act.start : null;
    let pos = scratch && scratch.pos ? scratch.pos : new Float32Array(3 * 65536), nv = 0;
    let idx = scratch && scratch.idx ? scratch.idx : new Uint32Array(6 * 65536), ni = 0;

    function quad(q0, q1, q2, q3, flip) {
      if (q0 < 0 || q1 < 0 || q2 < 0 || q3 < 0) return;
      if (flip) { const t = q1; q1 = q3; q3 = t; }
      if (ni + 6 > idx.length) { const a = new Uint32Array(idx.length * 2); a.set(idx); idx = a; }
      const ax = pos[q0 * 3], ay = pos[q0 * 3 + 1], az = pos[q0 * 3 + 2], bx = pos[q1 * 3], by = pos[q1 * 3 + 1], bz = pos[q1 * 3 + 2];
      const cx = pos[q2 * 3], cy = pos[q2 * 3 + 1], cz = pos[q2 * 3 + 2], dx = pos[q3 * 3], dy = pos[q3 * 3 + 1], dz = pos[q3 * 3 + 2];
      const d02 = (ax - cx) * (ax - cx) + (ay - cy) * (ay - cy) + (az - cz) * (az - cz), d13 = (bx - dx) * (bx - dx) + (by - dy) * (by - dy) + (bz - dz) * (bz - dz);
      // split along the diagonal whose two triangles agree best (a bent or bow tie quad folds along the other one); among equally flat splits the shorter diagonal wins
      let n1x = (by - ay) * (cz - az) - (bz - az) * (cy - ay), n1y = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), n1z = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      let n2x = (cy - ay) * (dz - az) - (cz - az) * (dy - ay), n2y = (cz - az) * (dx - ax) - (cx - ax) * (dz - az), n2z = (cx - ax) * (dy - ay) - (cy - ay) * (dx - ax);
      let l1 = Math.sqrt(n1x * n1x + n1y * n1y + n1z * n1z), l2 = Math.sqrt(n2x * n2x + n2y * n2y + n2z * n2z);
      const coh_a = l1 > 1e-20 && l2 > 1e-20 ? (n1x * n2x + n1y * n2y + n1z * n2z) / (l1 * l2) : 1;
      n1x = (by - ay) * (dz - az) - (bz - az) * (dy - ay); n1y = (bz - az) * (dx - ax) - (bx - ax) * (dz - az); n1z = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
      n2x = (cy - by) * (dz - bz) - (cz - bz) * (dy - by); n2y = (cz - bz) * (dx - bx) - (cx - bx) * (dz - bz); n2z = (cx - bx) * (dy - by) - (cy - by) * (dx - bx);
      l1 = Math.sqrt(n1x * n1x + n1y * n1y + n1z * n1z); l2 = Math.sqrt(n2x * n2x + n2y * n2y + n2z * n2z);
      const coh_b = l1 > 1e-20 && l2 > 1e-20 ? (n1x * n2x + n1y * n2y + n1z * n2z) / (l1 * l2) : 1;
      if (coh_a > coh_b + 0.02 || (coh_a >= coh_b - 0.02 && d02 <= d13)) { idx[ni++] = q0; idx[ni++] = q1; idx[ni++] = q2; idx[ni++] = q0; idx[ni++] = q2; idx[ni++] = q3; }
      else { idx[ni++] = q0; idx[ni++] = q1; idx[ni++] = q3; idx[ni++] = q1; idx[ni++] = q2; idx[ni++] = q3; }
    }

    for (let z = 0; z < czn; z++) {
      const cu = (z & 1) * layer, pv = ((z + 1) & 1) * layer;
      vid.fill(-1, cu, cu + layer);
      vol.layer(z, L);
      const D = L.data, A = L.a, Bq = L.b;
      for (let y = 0; y < cyn; y++) {
        const b00 = A[y], b10 = A[y + 1], b01 = Bq[y], b11 = Bq[y + 1];
        const brow = act ? ((y / B | 0) + nby * (z / B | 0)) * nbx : 0;
        for (let x = 0; x < cxn; x++) {
          if (act && (x % B === 0) && start[brow + x / B] === start[brow + x / B + 1]) { x += B - 1; continue; }        // (an empty block: its B cells in this row)
          const v0 = D[b00 + x], v1 = D[b00 + x + 1], v2 = D[b10 + x], v3 = D[b10 + x + 1], v4 = D[b01 + x], v5 = D[b01 + x + 1], v6 = D[b11 + x], v7 = D[b11 + x + 1];
          const mask = (v0 < 0 ? 1 : 0) | (v1 < 0 ? 2 : 0) | (v2 < 0 ? 4 : 0) | (v3 < 0 ? 8 : 0) | (v4 < 0 ? 16 : 0) | (v5 < 0 ? 32 : 0) | (v6 < 0 ? 64 : 0) | (v7 < 0 ? 128 : 0);
          if (mask === 0 || mask === 255) continue;
          cv[0] = v0; cv[1] = v1; cv[2] = v2; cv[3] = v3; cv[4] = v4; cv[5] = v5; cv[6] = v6; cv[7] = v7;
          let sx = 0, sy = 0, sz = 0, cnt = 0;
          for (let e = 0; e < 12; e++) {
            const a = EA[e], b = EB[e], va = cv[a], vb = cv[b];
            if ((va < 0) !== (vb < 0)) {
              const t = va / (va - vb);
              sx += CX[a] + (CX[b] - CX[a]) * t; sy += CY[a] + (CY[b] - CY[a]) * t; sz += CZ[a] + (CZ[b] - CZ[a]) * t;
              cnt++;
            }
          }
          if (nv * 3 + 3 > pos.length) { const a = new Float32Array(pos.length * 2); a.set(pos); pos = a; }
          const ic = 1 / cnt, ci = x + cxn * y, me = nv++;
          pos[me * 3] = ox + (x + sx * ic) * cell; pos[me * 3 + 1] = oy + (y + sy * ic) * cell; pos[me * 3 + 2] = oz + (z + sz * ic) * cell;
          vid[cu + ci] = me;
          // each sign-changing edge starting at this cell's min corner owns one quad of the four cells around it (all of them have lower or equal indices)
          const m0 = mask & 1, flip = m0 === 0;
          if (m0 !== ((mask >> 1) & 1) && y > 0 && z > 0) quad(me, vid[cu + ci - cxn], vid[pv + ci - cxn], vid[pv + ci], flip);
          if (m0 !== ((mask >> 2) & 1) && z > 0 && x > 0) quad(me, vid[pv + ci], vid[pv + ci - 1], vid[cu + ci - 1], flip);
          if (m0 !== ((mask >> 4) & 1) && x > 0 && y > 0) quad(me, vid[cu + ci - 1], vid[cu + ci - 1 - cxn], vid[cu + ci - cxn], flip);
        }
      }
    }
    return { positions: pos, nv: nv, indices: idx, ni: ni };
  }

  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // cpu - the field in plain JavaScript: the fallback when there is no GPU, and the reference the GPU's answers are tested against.
  //
  //   make_field(comp)                       the field of the primitives over a list: eval(x, y, z, L, ls, le, track), wdist(o, x, y, z) (the distance the skin weights use), hit()
  //   cpu_sample(comp, grid, csr, field, opts)   the samples of the whole grid (a dense Float32Array, x fastest): blocks the Lipschitz bound proves empty or full are not evaluated
  //   cpu_vertex_passes(comp, grid, mesh, csr, field, want)   per vertex: normal (field gradient), the part that owns it, colour (part colour, soft colours, baked ambient occlusion and tone),
  //                                                       uv (box projection), skin weights - what geometry_creature.cpp does after meshing (cg_finish_vertices, cg_soft_colors, cg_shade, cg_skin)
  // The maths is geometry_creature.cpp's in double precision; evaluation order and the group / blend semantics are the same.
  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const FAR = 1e6, SQRT3 = 1.7320508075688772;

  function make_field(comp) {
    const P = comp.prim, X = comp.lx, vols = comp.vols || [];
    let hit = -1;

    // smooth-union / smooth-subtract / smooth-intersect step: fold primitive distance dd into the running value d. mode 0 round (the quadratic smooth min:
    // h = (k - |a - b|) / k, min - h^2 k / 4), 1 cubic (min - h^3 k / 6: C2, a smaller bulge, more local), 2 chamfer (a bevel: min(min(a, b), (a + b - k) / sqrt 2)).
    function fold(d, dd, op, k, mode) {
      let h, m;
      if (op === 0) {
        m = d < dd ? d : dd;
        if (k > 0) {
          if (mode === 2) { h = (d + dd - k) * 0.7071067811865476; return h < m ? h : m; }
          h = k - (d > dd ? d - dd : dd - d);
          if (h > 0) { h /= k; return m - (mode === 1 ? h * h * h * k / 6 : h * h * k * 0.25); }
        }
        return m;
      }
      if (op === 1) dd = -dd;
      m = d > dd ? d : dd;
      if (k > 0) {
        if (mode === 2) { h = (d + dd + k) * 0.7071067811865476; return h > m ? h : m; }
        h = k - (d > dd ? d - dd : dd - d);
        if (h > 0) { h /= k; return m + (mode === 1 ? h * h * h * k / 6 : h * h * k * 0.25); }
      }
      return m;
    }

    // Distance to one loft segment: the cross section is measured in the plane normal to the axis at the nearest axis point (clamped to the segment), the ends are rounded by an extra
    // axial term. With the gauge rho (1 on the surface: an ellipse r2 = |(a, b)| or a squircle r4 = (a^4 + b^4)^(1/4), blended by the squareness, plus the cap term) the distance is
    // (rho - 1) / |grad rho|: exact near the surface, and a plain round cone when ru = rv.
    function loft_dist(o, x, y, z) {
      const q = P[o + 11] * LX;
      const dx = x - P[o + 4], dy = y - P[o + 5], dz = z - P[o + 6];
      const tr = (dx * P[o + 7] + dy * P[o + 8] + dz * P[o + 9]) * P[o + 10], t = tr < 0 ? 0 : (tr > 1 ? 1 : tr);
      const qx = dx - P[o + 7] * t, qy = dy - P[o + 8] * t, qz = dz - P[o + 9] * t;
      const a0 = qx * X[q + 10] + qy * X[q + 11] + qz * X[q + 12], b0 = qx * X[q + 13] + qy * X[q + 14] + qz * X[q + 15];
      let c = X[q + 6], sn = X[q + 7];
      const t2 = t * t, t3 = t2 * t, hb = 3 * t2 - 2 * t3, h1 = t3 - 2 * t2 + t, h2 = t3 - t2;
      const ru = X[q] + X[q + 1] * hb + X[q + 17] * h1 + X[q + 18] * h2, rv = X[q + 2] + X[q + 3] * hb + X[q + 19] * h1 + X[q + 20] * h2, sq = X[q + 4] + X[q + 5] * t;
      if (X[q + 8] !== 0 || X[q + 9] !== 0) {                     // the twist changes along the segment: interpolate the direction
        c += X[q + 8] * t; sn += X[q + 9] * t;
        let l = c * c + sn * sn;
        if (l > 1e-12) { l = 1 / Math.sqrt(l); c *= l; sn *= l; } else { c = 1; sn = 0; }
      }
      const iu = 1 / ru, iv = 1 / rv, ra = (a0 * c + b0 * sn) * iu, rb = (b0 * c - a0 * sn) * iv, a2 = ra * ra, b2 = rb * rb, r2 = Math.sqrt(a2 + b2);
      let r4 = 0, rs = r2;
      if (sq > 0) { r4 = Math.sqrt(Math.sqrt(a2 * a2 + b2 * b2)); rs = r2 + sq * (r4 - r2); }
      const rmin = ru < rv ? ru : rv, e = (tr - t) * X[q + 16];
      let ce = 0, rho = rs;
      if (e !== 0) { ce = e / rmin; rho = Math.sqrt(rs * rs + ce * ce); }
      if (rho < 1) return (rho - 1) * rmin;                       // inside: the estimate below can be too deep, this one never is
      let ga = 0, gb = 0, gs;
      if (r2 > 1e-12) { gs = 1 / r2; ga = ra * gs; gb = rb * gs; }
      if (sq > 0 && r4 > 1e-12) { gs = 1 / (r4 * r4 * r4); ga += sq * (ra * a2 * gs - ga); gb += sq * (rb * b2 * gs - gb); }
      ga *= iu; gb *= iv;
      const den2 = rs * rs * (ga * ga + gb * gb) + ce * ce / (rmin * rmin);
      if (den2 < 1e-24) return 0;
      return (rho - 1) * rho / Math.sqrt(den2);                   // outside: first order exact, and never more than the true distance (the gauge is convex)
    }

    // Is this loft segment surely further than `lim`? Its distance is at least about half the distance to its bounding capsule, and a cheap test spares the full evaluation for most
    // samples: when a union only changes the field within k of the running value, a segment further than that cannot change it.
    function loft_far(o, x, y, z, lim) {
      const q = P[o + 11] * LX;
      const dx = x - P[o + 4], dy = y - P[o + 5], dz = z - P[o + 6];
      const tr = (dx * P[o + 7] + dy * P[o + 8] + dz * P[o + 9]) * P[o + 10], t = tr < 0 ? 0 : (tr > 1 ? 1 : tr);
      const qx = dx - P[o + 7] * t, qy = dy - P[o + 8] * t, qz = dz - P[o + 9] * t;
      const t2 = t * t, t3 = t2 * t, hb = 3 * t2 - 2 * t3, h1 = t3 - 2 * t2 + t, h2 = t3 - t2;
      const ru = X[q] + X[q + 1] * hb + X[q + 17] * h1 + X[q + 18] * h2, rv = X[q + 2] + X[q + 3] * hb + X[q + 19] * h1 + X[q + 20] * h2, sq = X[q + 4] + X[q + 5] * t;
      let r = ru > rv ? ru : rv;
      const qq = qx * qx + qy * qy + qz * qz;
      r *= 1 + 0.2 * (sq > 0 ? sq : 0);
      if (qq <= r * r) return false;                              // inside the bounding capsule
      if (lim <= 0) return true;
      const v = r + 2 * lim;                                      // |q| - r >= 2 lim, without the root
      return qq >= v * v;
    }

    // a ring (torus) and a rounded cylinder about an axis: both exact distances
    function torus_dist(o, x, y, z) {
      const dx = x - P[o + 4], dy = y - P[o + 5], dz = z - P[o + 6], h = dx * P[o + 7] + dy * P[o + 8] + dz * P[o + 9];
      const rx = dx - P[o + 7] * h, ry = dy - P[o + 8] * h, rz = dz - P[o + 9] * h, q = Math.sqrt(rx * rx + ry * ry + rz * rz) - P[o + 10];
      return Math.sqrt(q * q + h * h) - P[o + 11];
    }
    function cylinder_dist(o, x, y, z) {
      const dx = x - P[o + 4], dy = y - P[o + 5], dz = z - P[o + 6], h = dx * P[o + 7] + dy * P[o + 8] + dz * P[o + 9];
      const rx = dx - P[o + 7] * h, ry = dy - P[o + 8] * h, rz = dz - P[o + 9] * h, qa = Math.sqrt(rx * rx + ry * ry + rz * rz) - P[o + 10], qb = (h < 0 ? -h : h) - P[o + 11];
      const ea = qa > 0 ? qa : 0, eb = qb > 0 ? qb : 0, m = qa > qb ? qa : qb;
      return Math.sqrt(ea * ea + eb * eb) + (m < 0 ? m : 0) - P[o + 12];
    }

    // a volume (the bake section): the grid's value at the point (trilinear; the box middle `mid` of the volume's frame is where the primitive's centre stands), plus the distance to the grid's box
    // when the point is outside it, times the scale. Both parts are 1-Lipschitz, so the block skipping and the cull lists can trust it like any other distance
    function volume_dist(o, x, y, z) {
      const q = P[o + 11] * LX, V = vols[P[o + 7] | 0], dx = x - P[o + 4], dy = y - P[o + 5], dz = z - P[o + 6], inv = V.inv, nx = V.nx, mx = nx - 1, my = V.ny - 1, mz = V.nz - 1;
      let gx = (X[q] * dx + X[q + 1] * dy + X[q + 2] * dz + X[q + 9] - V.ox) * inv, gy = (X[q + 3] * dx + X[q + 4] * dy + X[q + 5] * dz + X[q + 10] - V.oy) * inv, gz = (X[q + 6] * dx + X[q + 7] * dy + X[q + 8] * dz + X[q + 11] - V.oz) * inv;
      let ex = 0, ey = 0, ez = 0;
      if (gx < 0) { ex = -gx; gx = 0; } else if (gx > mx) { ex = gx - mx; gx = mx; }
      if (gy < 0) { ey = -gy; gy = 0; } else if (gy > my) { ey = gy - my; gy = my; }
      if (gz < 0) { ez = -gz; gz = 0; } else if (gz > mz) { ez = gz - mz; gz = mz; }
      const x0 = gx | 0, y0 = gy | 0, z0 = gz | 0, fx = gx - x0, fy = gy - y0, fz = gz - z0, D = V.data, sx = x0 < mx ? 1 : 0, sy = y0 < my ? nx : 0, sz = z0 < mz ? nx * V.ny : 0;
      const b = x0 + nx * y0 + nx * V.ny * z0;
      const c00 = D[b] + (D[b + sx] - D[b]) * fx, c10 = D[b + sy] + (D[b + sy + sx] - D[b + sy]) * fx, c01 = D[b + sz] + (D[b + sz + sx] - D[b + sz]) * fx, c11 = D[b + sy + sz] + (D[b + sy + sz + sx] - D[b + sy + sz]) * fx;
      const c0 = c00 + (c10 - c00) * fy, c1 = c01 + (c11 - c01) * fy, val = c0 + (c1 - c0) * fz;
      return (ex !== 0 || ey !== 0 || ez !== 0 ? val + Math.sqrt(ex * ex + ey * ey + ez * ez) * V.cell : val) * P[o + 8];
    }

    // the field at a point over the primitives L[ls .. le), in order. The segments of a group (one chain / loft part) are united with a hard min and folded in as one primitive.
    // `track`: also find the part of the last union primitive that was closer than everything before it (hit()).
    function eval_list(x, y, z, L, ls, le, track) {
      let d = BIG, dd = 0, gid = 0, gd = 0, gop = 0, gk = 0, gmode = 0, gpart = 0;
      if (track) hit = -1;
      for (let i = ls; i < le; i++) {
        const o = L[i] * STRIDE, ty = P[o], g = P[o + 14];
        let dx, dy, dz;
        if (ty === 2) {
          dx = x - P[o + 4]; dy = y - P[o + 5]; dz = z - P[o + 6];
          let t = (dx * P[o + 7] + dy * P[o + 8] + dz * P[o + 9]) * P[o + 10];
          t = t < 0 ? 0 : (t > 1 ? 1 : t);
          dx -= P[o + 7] * t; dy -= P[o + 8] * t; dz -= P[o + 9] * t;
          dd = Math.sqrt(dx * dx + dy * dy + dz * dz) - (P[o + 11] + P[o + 12] * (3 - 2 * t) * t * t + P[o + 16] * (t * t * t - 2 * t * t + t) + P[o + 17] * (t * t * t - t * t));
        } else if (ty === 0) {
          dx = x - P[o + 4]; dy = y - P[o + 5]; dz = z - P[o + 6];
          dd = Math.sqrt(dx * dx + dy * dy + dz * dz) - P[o + 7];
        } else if (ty === 1) {
          dx = (x - P[o + 4]) * P[o + 7]; dy = (y - P[o + 5]) * P[o + 8]; dz = (z - P[o + 6]) * P[o + 9];
          dd = (Math.sqrt(dx * dx + dy * dy + dz * dz) - 1) * P[o + 10];
        } else if (ty === 4) {
          let lim = BIG * 4;
          if (g !== 0 && g === gid) lim = gd;
          else if (P[o + 1] === 0 && P[o + 15] !== 2) lim = d + P[o + 2];
          dd = (lim < BIG * 2 && loft_far(o, x, y, z, lim)) ? BIG : loft_dist(o, x, y, z);
        } else if (ty === 5) {
          dd = torus_dist(o, x, y, z);
        } else if (ty === 6) {
          dd = cylinder_dist(o, x, y, z);
        } else if (ty === 7) {
          dd = volume_dist(o, x, y, z);
        } else {
          dx = Math.abs(x - P[o + 4]) - P[o + 7]; dy = Math.abs(y - P[o + 5]) - P[o + 8]; dz = Math.abs(z - P[o + 6]) - P[o + 9];
          const ex = dx > 0 ? dx : 0, ey = dy > 0 ? dy : 0, ez = dz > 0 ? dz : 0, m = dx > dy ? (dx > dz ? dx : dz) : (dy > dz ? dy : dz);
          dd = Math.sqrt(ex * ex + ey * ey + ez * ez) + (m < 0 ? m : 0) - P[o + 10];
        }
        if (g !== 0 && g === gid) { if (dd < gd) { gd = dd; gpart = P[o + 3]; } continue; }     // (the part of a group is the part of its nearest member: it does not depend on which members are in the list)
        if (gid !== 0) {
          if (track && gop === 0 && gd < d) hit = gpart;
          d = fold(d, gd, gop, gk, gmode); gid = 0;
        }
        if (g !== 0) { gid = g; gd = dd; gop = P[o + 1]; gk = P[o + 2]; gmode = P[o + 15]; gpart = P[o + 3]; continue; }
        if (track && P[o + 1] === 0 && dd < d) hit = P[o + 3];
        d = fold(d, dd, P[o + 1], P[o + 2], P[o + 15]);
      }
      if (gid !== 0) {
        if (track && gop === 0 && gd < d) hit = gpart;
        d = fold(d, gd, gop, gk, gmode);
      }
      return d;
    }

    // distance used for weights: like the field's, but the ellipsoid uses the better approximation (exact near the surface)
    function wdist(o, x, y, z) {
      const ty = P[o];
      let dx, dy, dz;
      if (ty === 0) {
        dx = x - P[o + 4]; dy = y - P[o + 5]; dz = z - P[o + 6];
        return Math.sqrt(dx * dx + dy * dy + dz * dz) - P[o + 7];
      }
      if (ty === 1) {
        dx = (x - P[o + 4]) * P[o + 7]; dy = (y - P[o + 5]) * P[o + 8]; dz = (z - P[o + 6]) * P[o + 9];
        const k0 = Math.sqrt(dx * dx + dy * dy + dz * dz);
        dx *= P[o + 7]; dy *= P[o + 8]; dz *= P[o + 9];
        const k1 = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return k1 > 1e-12 ? k0 * (k0 - 1) / k1 : -P[o + 10];
      }
      if (ty === 2) {
        dx = x - P[o + 4]; dy = y - P[o + 5]; dz = z - P[o + 6];
        let t = (dx * P[o + 7] + dy * P[o + 8] + dz * P[o + 9]) * P[o + 10];
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        dx -= P[o + 7] * t; dy -= P[o + 8] * t; dz -= P[o + 9] * t;
        return Math.sqrt(dx * dx + dy * dy + dz * dz) - (P[o + 11] + P[o + 12] * (3 - 2 * t) * t * t + P[o + 16] * (t * t * t - 2 * t * t + t) + P[o + 17] * (t * t * t - t * t));
      }
      if (ty === 4) return loft_dist(o, x, y, z);
      if (ty === 5) return torus_dist(o, x, y, z);
      if (ty === 6) return cylinder_dist(o, x, y, z);
      if (ty === 7) return volume_dist(o, x, y, z);
      dx = Math.abs(x - P[o + 4]) - P[o + 7]; dy = Math.abs(y - P[o + 5]) - P[o + 8]; dz = Math.abs(z - P[o + 6]) - P[o + 9];
      const ex = dx > 0 ? dx : 0, ey = dy > 0 ? dy : 0, ez = dz > 0 ? dz : 0, m = dx > dy ? (dx > dz ? dx : dz) : (dy > dz ? dy : dz);
      return Math.sqrt(ex * ex + ey * ey + ez * ez) + (m < 0 ? m : 0) - P[o + 10];
    }

    return { eval: eval_list, wdist: wdist, loft_dist: loft_dist, fold: fold, hit: function () { return hit; } };
  }

  // ---- the samples of the whole grid -----------------------------------------------------------------------------------------------------------------------------
  // The cull lists must have been made with pad >= tskip + kmax (cpu_pad): a block whose centre is further from the surface than the Lipschitz bound allows is filled with +-FAR.
  function cpu_pad(comp, cell, B) { return comp.lip * 1.05 * SQRT3 * (B + 1) * 0.5 * cell + comp.kmax + cell; }

  function cpu_sample(comp, grid, csr, field, opts) {
    opts = opts || {};
    const nx = grid.n[0], ny = grid.n[1], nz = grid.n[2], B = csr.B, cell = grid.cell, ox = grid.origin[0], oy = grid.origin[1], oz = grid.origin[2];
    const total = nx * ny * nz, data = opts.scratch && opts.scratch.length >= total ? opts.scratch : new Float32Array(total);
    const tskip = comp.lip * 1.05 * SQRT3 * (B + 1) * 0.5 * cell, L = csr.list, ev = field.eval, start = csr.start, nbx = csr.nb[0], nby = csr.nb[1], nbz = csr.nb[2];
    let evaluated = 0, blocks_sampled = 0;
    for (let bz = 0; bz < nbz; bz++) {
      const z0 = bz * B, z1 = Math.min(z0 + B, nz);
      for (let by = 0; by < nby; by++) {
        const y0 = by * B, y1 = Math.min(y0 + B, ny);
        for (let bx = 0; bx < nbx; bx++) {
          const x0 = bx * B, x1 = Math.min(x0 + B, nx), b = bx + nbx * (by + nby * bz), ls = start[b], le = start[b + 1];
          let d = FAR;
          if (ls !== le) {
            d = ev(ox + (x0 + (B - 1) * 0.5) * cell, oy + (y0 + (B - 1) * 0.5) * cell, oz + (z0 + (B - 1) * 0.5) * cell, L, ls, le, false);
            d = d > tskip ? FAR : (d < -tskip ? -FAR : 0);
          }
          if (d !== 0) {                                          // empty, or provably inside / outside: no sample of it can change sign
            for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) { const r = (z * ny + y) * nx; data.fill(d, r + x0, r + x1); }
            continue;
          }
          blocks_sampled++;
          for (let z = z0; z < z1; z++) {
            const pz = oz + z * cell;
            for (let y = y0; y < y1; y++) {
              const py = oy + y * cell, r = (z * ny + y) * nx;
              for (let x = x0; x < x1; x++) data[r + x] = ev(ox + x * cell, py, pz, L, ls, le, false);
              evaluated += x1 - x0;
            }
          }
        }
      }
    }
    return { data: data, evaluated: evaluated, blocks_sampled: blocks_sampled, blocks: nbx * nby * nbz };
  }

  // ---- per vertex ------------------------------------------------------------------------------------------------------------------------------------------------
  // `want`: { normals, part_ids, colors, uvs, skin } (booleans). mesh: { positions, nv }. csr: lists that were made with pad >= pass_reach (the grid section), blocks of any size.
  function cpu_vertex_passes(comp, grid, mesh, csr, field, want) {
    const P = comp.prim, box = comp.rbox, st = comp.settings, nv = mesh.nv, pos = mesh.positions, cell = grid.cell, L = csr.list, nprims = comp.n;
    const out = { normals: new Float32Array(nv * 3), uvs: want.uvs ? new Float32Array(nv * 2) : null, part_ids: want.part_ids ? new Uint16Array(nv) : null, colors: null, bone_indices: null, bone_weights: null };
    const parts = comp.parts, hgrad = 0.3 * cell;
    const need_part = want.part_ids || want.colors || want.uvs && comp.use_uvs;
    const ao = want.colors && st.ao > 0 ? st.ao : 0, tone = want.colors ? st.tone : 0, cb = want.colors && st.color_blend > 0 ? st.color_blend : 0;
    if (want.colors) out.colors = new Float32Array(nv * 4);
    const skin = want.skin && comp.skin;
    if (skin) { out.bone_indices = new Uint8Array(nv * 4); out.bone_weights = new Float32Array(nv * 4); }
    const near = new Int32Array(nprims), near_d = new Float64Array(nprims), sl = new Int32Array(nprims), sd = new Float64Array(nprims);
    const R = st.ao_radius > 0 ? st.ao_radius : 0.12, kmax = comp.kmax, ao_reach = 2 * R + kmax + 1e-3;
    const soft_infl = comp.bmax + cb * kmax + cell + 1e-3, soft_wcell = 0.5 * cell;
    const falloff = st.skin_falloff, min_blend = st.skin_min_blend > 0 ? st.skin_min_blend : 0.5 * cell, range = st.skin_range;
    const acc = new Float64Array(128), touch = new Int32Array(128);
    const TH = [1 / 12, 2 / 9, 0.5, 1], TW = [0.4, 0.3, 0.2, 0.1];
    const ev = field.eval, wdist = field.wdist;

    // the primitives of L[ls .. le) whose reach (blend + `reach`) includes the point, in order -> `near`; the count
    function gather(x, y, z, ls, le, reach) {
      let n = 0;
      for (let j = ls; j < le; j++) {
        const i = L[j], o = i * STRIDE;
        if (P[o + 1] !== OP_INTERSECT) {
          const b = i * 6, ty = P[o], k = P[o + 2] + reach;
          let ex = k, ey = k, ez = k;
          if (ty === T_ELLIPSOID) { ex = k / (P[o + 7] * P[o + 10]); ey = k / (P[o + 8] * P[o + 10]); ez = k / (P[o + 9] * P[o + 10]); }
          else if (ty === T_LOFT) { ex = ey = ez = k * 1.3; }
          if (box[b] - ex > x || box[b + 3] + ex < x || box[b + 1] - ey > y || box[b + 4] + ey < y || box[b + 2] - ez > z || box[b + 5] + ez < z) continue;
        }
        near[n++] = i;
      }
      return n;
    }

    for (let v = 0; v < nv; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      const bl = block_of(csr, grid, x, y, z), ls = csr.start[bl], le = csr.start[bl + 1];
      // normal: the tetrahedral gradient of the field
      let n = gather(x, y, z, ls, le, 3 * cell);
      const h = hgrad;
      const f0 = ev(x + h, y - h, z - h, near, 0, n, false), f1 = ev(x - h, y - h, z + h, near, 0, n, false), f2 = ev(x - h, y + h, z - h, near, 0, n, false), f3 = ev(x + h, y + h, z + h, near, 0, n, false);
      let gx = f0 - f1 - f2 + f3, gy = -f0 - f1 + f2 + f3, gz = -f0 + f1 - f2 + f3, gl = Math.sqrt(gx * gx + gy * gy + gz * gz);
      if (gl > 1e-20) { gl = 1 / gl; gx *= gl; gy *= gl; gz *= gl; } else { gx = 0; gy = 1; gz = 0; }
      out.normals[v * 3] = gx; out.normals[v * 3 + 1] = gy; out.normals[v * 3 + 2] = gz;
      let part = 0;
      if (need_part) {
        ev(x, y, z, near, 0, n, true);
        const hh = field.hit();
        part = hh < 0 ? 0 : hh;
        if (out.part_ids) out.part_ids[v] = part;
      }
      if (out.uvs) {                                              // box projected uvs
        const ax = gx < 0 ? -gx : gx, ay = gy < 0 ? -gy : gy, az = gz < 0 ? -gz : gz;
        let u, w;
        if (ax >= ay && ax >= az) { u = z; w = y; } else if (ay >= az) { u = x; w = z; } else { u = x; w = y; }
        u *= st.uv_scale; w *= st.uv_scale;
        const pr = parts[part];
        if (comp.use_uvs && pr && pr.uv_offset) { u = u * pr.uv_scale[0] + pr.uv_offset[0]; w = w * pr.uv_scale[1] + pr.uv_offset[1]; }
        out.uvs[v * 2] = u; out.uvs[v * 2 + 1] = w;
      }
      if (out.colors) {
        const c = parts[part] ? parts[part].color : [1, 1, 1, 1];
        let r = c[0], g = c[1], b = c[2], a = c[3];
        if (cb > 0) {                                             // soft colours: the colours of the union parts that meet here, over cb * blend (+ half a cell)
          let m = 0, dmin = BIG;
          for (let j = ls; j < le; j++) {
            const i = L[j], o = i * STRIDE;
            if (P[o + 1] !== 0) continue;
            const bb = i * 6, e = P[o] === T_LOFT ? soft_infl * 1.3 : soft_infl;
            if (box[bb] - e > x || box[bb + 3] + e < x || box[bb + 1] - e > y || box[bb + 4] + e < y || box[bb + 2] - e > z || box[bb + 5] + e < z) continue;
            const d = wdist(o, x, y, z);
            sd[m] = d; sl[m++] = i;
            if (d < dmin) dmin = d;
          }
          if (m > 0) {
            let wt = 0, rr = 0, gg = 0, bb2 = 0, aa = 0;
            for (let j = 0; j < m; j++) {
              const o = sl[j] * STRIDE, W = cb * P[o + 2] + soft_wcell;
              let w = 1 - (sd[j] - dmin) / W;
              if (w <= 0) continue;
              w *= w;
              const pc = parts[P[o + 3]].color;
              rr += w * pc[0]; gg += w * pc[1]; bb2 += w * pc[2]; aa += w * pc[3]; wt += w;
            }
            if (wt > 0) { r = rr / wt; g = gg / wt; b = bb2 / wt; a = aa / wt; }
          }
        }
        if (ao > 0 || tone !== 0) {                               // baked shading: ambient occlusion (the field estimate at 4 heights along the normal) and a belly / back tone
          let fac = 1;
          if (ao > 0) {
            const na = gather(x, y, z, ls, le, ao_reach);
            let occ = 0;
            for (let k = 0; k < 4; k++) {
              const hk = R * TH[k], f = ev(x + gx * hk, y + gy * hk, z + gz * hk, near, 0, na, false), w = (hk - f) / hk;
              if (w > 0) occ += TW[k] * w;
            }
            let w = 1 - 1.6 * occ;
            if (w < 0) w = 0;
            fac = 1 - ao * 0.7 * (1 - w);
          }
          if (tone !== 0) {
            let under = 0.5 - 0.5 * gy;
            under = under < 0 ? 0 : (under > 1 ? 1 : under);
            fac *= 1 + tone * (under - 0.5);
          }
          r *= fac; g *= fac; b *= fac;
        }
        out.colors[v * 4] = r; out.colors[v * 4 + 1] = g; out.colors[v * 4 + 2] = b; out.colors[v * 4 + 3] = a;
      }
      if (skin) {                                                 // skin weights: every union primitive with a bone claims the vertex with a compact falloff of its distance relative to the nearest one
        let m = 0, dmin = BIG, ntouch = 0;
        for (let j = ls; j < le; j++) {
          const i = L[j], o = i * STRIDE;
          if (P[o + 1] !== 0 || P[o + 13] < 0) continue;
          const d = wdist(o, x, y, z);
          sd[m] = d; sl[m++] = i;
          if (d < dmin) dmin = d;
        }
        for (let j = 0; j < m; j++) {
          const o = sl[j] * STRIDE, tau = P[o + 2] * falloff + min_blend, t = (sd[j] - dmin) / (range * tau);
          if (t < 1) {
            const w = 1 - t, bone = P[o + 13];
            if (acc[bone] === 0) touch[ntouch++] = bone;
            acc[bone] += w * w;
          }
        }
        const tw = [0, 0, 0, 0], tb = [0, 0, 0, 0];
        for (let j = 0; j < ntouch; j++) {
          const bone = touch[j], val = acc[bone];
          if (val <= tw[3]) continue;
          let k = 3;
          while (k > 0 && val > tw[k - 1]) { tw[k] = tw[k - 1]; tb[k] = tb[k - 1]; k--; }
          tw[k] = val; tb[k] = bone;
        }
        let sum = tw[0] + tw[1] + tw[2] + tw[3];
        if (sum <= 0) { tw[0] = 1; sum = 1; }
        for (let k = 1; k < 4; k++) if (tw[k] < 0.005 * sum) tw[k] = 0;
        sum = tw[0] + tw[1] + tw[2] + tw[3];
        for (let k = 0; k < 4; k++) { out.bone_indices[v * 4 + k] = tw[k] > 0 ? tb[k] : tb[0]; out.bone_weights[v * 4 + k] = tw[k] / sum; }
        for (let j = 0; j < ntouch; j++) acc[touch[j]] = 0;
      }
    }
    return out;
  }

  // box projected uvs from the normals (what vertex_passes does inline): u, v from the two axes the normal is least along, times uv_scale; a part with uv_offset has its own offset and scale
  function box_uvs(comp, mesh, normals, part_ids) {
    const nv = mesh.nv, pos = mesh.positions, uv = new Float32Array(nv * 2), st = comp.settings, parts = comp.parts, own = comp.use_uvs && part_ids;
    for (let v = 0; v < nv; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], gx = normals[v * 3], gy = normals[v * 3 + 1], gz = normals[v * 3 + 2];
      const ax = gx < 0 ? -gx : gx, ay = gy < 0 ? -gy : gy, az = gz < 0 ? -gz : gz;
      let u, w;
      if (ax >= ay && ax >= az) { u = z; w = y; } else if (ay >= az) { u = x; w = z; } else { u = x; w = y; }
      u *= st.uv_scale; w *= st.uv_scale;
      if (own) { const pr = parts[part_ids[v]]; if (pr && pr.uv_offset) { u = u * pr.uv_scale[0] + pr.uv_offset[0]; w = w * pr.uv_scale[1] + pr.uv_offset[1]; } }
      uv[v * 2] = u; uv[v * 2 + 1] = w;
    }
    return uv;
  }

  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // adaptive - the octree dual contouring (def.adaptive) and the quadric decimation (def.decimate) of geometry_creature.cpp, in JavaScript.
  //
  // The domain is a cube of 2^L "min cells". A node is dropped when the Lipschitz bound proves the surface cannot reach it, split while it is bigger than max_cell, while a primitive whose surface crosses it
  // is thinner than `features` cells across, while its dual vertex is further than `tolerance` from the surface or while the field is not linear in it; otherwise it is a leaf: one vertex at the mean of its edge
  // crossings. The quads come from the dual grid (one per sign changing edge of the finest leaf around it), so the mesh is crack free where resolutions meet. Every node carries the short list of the
  // primitives that can reach it and the corner samples are cached by lattice position, so a build evaluates the field a few hundred thousand times, not millions.
  // make_octree(comp, ad, field) holds the tree and the mesh; build_cpu() makes the tree with the CPU field (the GPU's tree builder fills the same arrays, see the gpu section), contour() makes the mesh.
  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const FACE_C = [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 4, 5, 2, 3, 6, 7, 0, 2, 4, 6, 1, 3, 5, 7];                 // the 4 corners of each face of a cube
  const FACE_O = [1, 1, 0, 1, 1, 2, 1, 0, 1, 1, 2, 1, 0, 1, 1, 2, 1, 1];                                   // the centre of each face in half cell units
  const QSP = [1, -1, -1, 1], QSQ = [1, 1, -1, -1];                                                         // the four quadrants around an edge, counter clockwise

  // the field and its gradient near the surface: the primitive list around a point, the tetrahedral gradient (4h * grad), Newton steps onto the zero surface. csr / lgrid: lists over blocks (build_csr).
  // The block lists are long (they are padded for every point of a block of 4 coarse cells), and a step evaluates the field five times: project_to first narrows the block's list to the primitives
  // that can reach a point within a step of the vertex (what the per-vertex passes do), which is the same field and a fraction of the work.
  function surface_tools(comp, field, csr, lgrid, h) {
    const L = csr.list, P = comp.prim, box = comp.rbox, near = new Int32Array(comp.n), t = { prx: 0, pry: 0, prz: 0, gx: 0, gy: 0, gz: 0, h: h };
    let ls = 0, le = 0, nn = 0;
    const ev = function (x, y, z) { return field.eval(x, y, z, L, ls, le, false); };
    const evn = function (x, y, z) { return field.eval(x, y, z, near, 0, nn, false); };
    t.lookup = function (x, y, z) { const b = block_of(csr, lgrid, x, y, z); ls = csr.start[b]; le = csr.start[b + 1]; };
    t.list = function () { return [ls, le]; };
    t.value = ev;
    t.gradient = function (x, y, z) {
      const f0 = ev(x + h, y - h, z - h), f1 = ev(x - h, y - h, z + h), f2 = ev(x - h, y + h, z - h), f3 = ev(x + h, y + h, z + h);
      t.gx = f0 - f1 - f2 + f3; t.gy = -f0 - f1 + f2 + f3; t.gz = -f0 + f1 - f2 + f3;
    };
    const narrow = function (x, y, z, reach) {                      // the primitives of the block's list (in order) whose reach (blend + `reach`) includes the point -> near[0 .. nn)
      let n = 0;
      for (let j = ls; j < le; j++) {
        const i = L[j], o = i * STRIDE;
        if (P[o + 1] !== OP_INTERSECT) {
          const b = i * 6, ty = P[o], k = P[o + 2] + reach;
          let ex = k, ey = k, ez = k;
          if (ty === T_ELLIPSOID) { ex = k / (P[o + 7] * P[o + 10]); ey = k / (P[o + 8] * P[o + 10]); ez = k / (P[o + 9] * P[o + 10]); }
          else if (ty === T_LOFT) ex = ey = ez = k * 1.3;
          if (box[b] - ex > x || box[b + 3] + ex < x || box[b + 1] - ey > y || box[b + 4] + ey < y || box[b + 2] - ez > z || box[b + 5] + ez < z) continue;
        }
        near[n++] = i;
      }
      nn = n;
    };
    t.project_to = function (x, y, z, iters, limit) {
      for (let it = 0; it < iters; it++) {
        t.lookup(x, y, z);
        narrow(x, y, z, limit + 4 * h);                              // (a step moves at most `limit`, the gradient looks h to each side)
        const f = evn(x, y, z);
        const f0 = evn(x + h, y - h, z - h), f1 = evn(x - h, y - h, z + h), f2 = evn(x - h, y + h, z - h), f3 = evn(x + h, y + h, z + h);
        const gx = f0 - f1 - f2 + f3, gy = -f0 - f1 + f2 + f3, gz = -f0 + f1 - f2 + f3, gl2 = gx * gx + gy * gy + gz * gz;
        if (gl2 < 1e-30) break;
        const s = f * 4 * h / gl2;
        let dx = gx * s, dy = gy * s, dz = gz * s, sl = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (sl > limit) { sl = limit / sl; dx *= sl; dy *= sl; dz *= sl; }
        x -= dx; y -= dy; z -= dz;
      }
      t.prx = x; t.pry = y; t.prz = z;
    };
    return t;
  }

  function make_octree(comp, ad, field) {
    const P = comp.prim, X = comp.lx, pbox = comp.box, rbox = comp.rbox, nprims = comp.n, kmax = comp.kmax;
    const cmin = ad.min_cell, cmax = ad.max_cell > 0 ? Math.max(ad.max_cell, cmin) : cmin * 4;
    const maxlvl = Math.floor(Math.log(cmax / cmin) / Math.LN2 + 1e-9), cq = cmin * (1 << maxlvl), mg = 2 * cq + 2 * cmin + comp.bmax;
    const ext = Math.max(comp.gmax[0] - comp.gmin[0], comp.gmax[1] - comp.gmin[1], comp.gmax[2] - comp.gmin[2]) + 2 * mg;
    let L = Math.ceil(Math.log(ext / cmin) / Math.LN2 - 1e-9);
    if (L < maxlvl) L = maxlvl;
    if (L > 12) fail("the adaptive octree would be too deep (min_cell " + cmin + " is too small for this shape)");
    const S2 = cmin * (1 << L), stride = (1 << L) + 1, lim4 = 4 * (1 << L);
    const ox = (comp.gmin[0] + comp.gmax[0]) * 0.5 - S2 * 0.5, oy = (comp.gmin[1] + comp.gmax[1]) * 0.5 - S2 * 0.5, oz = (comp.gmin[2] + comp.gmax[2]) * 0.5 - S2 * 0.5;
    const tol = ad.tolerance > 0 ? ad.tolerance : 0.35 * cmin, feat = ad.features > 0 ? ad.features : 3, lipc = comp.lip * 1.05, bal = ad.balance === true;
    // the lists around a point for the passes that come after the tree (normals of the vertices, projection, the vertices of leaves that have none): blocks of 4 lookup cells
    const lk_lvl = maxlvl > L - 7 ? maxlvl : L - 7, lcell = cmin * (1 << lk_lvl), nl = 1 << (L - lk_lvl);
    const lgrid = { cell: lcell, origin: [ox, oy, oz], n: [nl + 1, nl + 1, nl + 1] };
    const lcsr = build_csr(comp, lgrid, 4, cpu_pad(comp, lcell, 4));
    const tools = surface_tools(comp, field, lcsr, lgrid, 0.3 * cmin);

    // ---- the tree
    let o_child = new Int32Array(4096), o_vert = new Int32Array(4096), o_mask = new Uint8Array(4096), o_flag = new Uint8Array(4096), onodes = 1, ocap = 4096;
    function ogrow(n) {
      if (onodes + n <= ocap) return;
      const cap = Math.max(ocap * 2, onodes + n);
      let a = new Int32Array(cap); a.set(o_child); o_child = a;
      a = new Int32Array(cap); a.set(o_vert); o_vert = a;
      let b = new Uint8Array(cap); b.set(o_mask); o_mask = b;
      b = new Uint8Array(cap); b.set(o_flag); o_flag = b;
      ocap = cap;
    }
    // ---- the mesh
    let vpos = new Float32Array(3 * 8192), nv = 0, idx = new Uint32Array(6 * 8192), ni = 0;
    function new_vertex(x, y, z) {
      if ((nv + 1) * 3 > vpos.length) { const a = new Float32Array(vpos.length * 2); a.set(vpos); vpos = a; }
      vpos[nv * 3] = x; vpos[nv * 3 + 1] = y; vpos[nv * 3 + 2] = z;
      return nv++;
    }
    function emit_tri(a, b, c) {
      if (ni + 3 > idx.length) { const g = new Uint32Array(idx.length * 2); g.set(idx); idx = g; }
      idx[ni++] = a; idx[ni++] = b; idx[ni++] = c;
    }
    // a quad split along the diagonal whose two triangles agree best (a bent or bow tie quad folds along the other one); among equally flat splits the shorter diagonal wins
    function emit_quad(q0, q1, q2, q3) {
      if (ni + 6 > idx.length) { const g = new Uint32Array(idx.length * 2); g.set(idx); idx = g; }
      const v = vpos;
      const ax = v[q0 * 3], ay = v[q0 * 3 + 1], az = v[q0 * 3 + 2], bx = v[q1 * 3], by = v[q1 * 3 + 1], bz = v[q1 * 3 + 2];
      const cx = v[q2 * 3], cy = v[q2 * 3 + 1], cz = v[q2 * 3 + 2], dx = v[q3 * 3], dy = v[q3 * 3 + 1], dz = v[q3 * 3 + 2];
      const d02 = (ax - cx) * (ax - cx) + (ay - cy) * (ay - cy) + (az - cz) * (az - cz), d13 = (bx - dx) * (bx - dx) + (by - dy) * (by - dy) + (bz - dz) * (bz - dz);
      let n1x = (by - ay) * (cz - az) - (bz - az) * (cy - ay), n1y = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), n1z = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      let n2x = (cy - ay) * (dz - az) - (cz - az) * (dy - ay), n2y = (cz - az) * (dx - ax) - (cx - ax) * (dz - az), n2z = (cx - ax) * (dy - ay) - (cy - ay) * (dx - ax);
      let l1 = Math.sqrt(n1x * n1x + n1y * n1y + n1z * n1z), l2 = Math.sqrt(n2x * n2x + n2y * n2y + n2z * n2z);
      const coh_a = l1 > 1e-20 && l2 > 1e-20 ? (n1x * n2x + n1y * n2y + n1z * n2z) / (l1 * l2) : 1;
      n1x = (by - ay) * (dz - az) - (bz - az) * (dy - ay); n1y = (bz - az) * (dx - ax) - (bx - ax) * (dz - az); n1z = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
      n2x = (cy - by) * (dz - bz) - (cz - bz) * (dy - by); n2y = (cz - bz) * (dx - bx) - (cx - bx) * (dz - bz); n2z = (cx - bx) * (dy - by) - (cy - by) * (dx - bx);
      l1 = Math.sqrt(n1x * n1x + n1y * n1y + n1z * n1z); l2 = Math.sqrt(n2x * n2x + n2y * n2y + n2z * n2z);
      const coh_b = l1 > 1e-20 && l2 > 1e-20 ? (n1x * n2x + n1y * n2y + n1z * n2z) / (l1 * l2) : 1;
      if (coh_a > coh_b + 0.02 || (coh_a >= coh_b - 0.02 && d02 <= d13)) { idx[ni++] = q0; idx[ni++] = q1; idx[ni++] = q2; idx[ni++] = q0; idx[ni++] = q2; idx[ni++] = q3; }
      else { idx[ni++] = q0; idx[ni++] = q1; idx[ni++] = q3; idx[ni++] = q1; idx[ni++] = q2; idx[ni++] = q3; }
    }

    // ---- the primitive lists of the nodes: a stack (a node's list is made from its parent's) and the field over a list
    let o_list = new Int32Array(Math.max(64, (L + 4) * nprims + 64)), o_top = 0;
    function list_room(n) { if (n > o_list.length) { const a = new Int32Array(Math.max(o_list.length * 2, n + 16)); a.set(o_list); o_list = a; } }
    function eval_field(x, y, z, ls, le) { return field.eval(x, y, z, o_list, ls, le, false); }

    // ---- the corner samples, cached by lattice position (stored as float32 so that every node sees the same number)
    let hk = new Float64Array(1 << 17), hv = new Float32Array(1 << 17), hmask = (1 << 17) - 1, hn = 0;
    function hgrow() {
      const ncap = hk.length * 2, m2 = ncap - 1, nk = new Float64Array(ncap), nvv = new Float32Array(ncap);
      for (let i = 0; i < hk.length; i++) {
        const key = hk[i];
        if (key === 0) continue;
        let r = key - 1;
        const ix = r % stride; r = (r - ix) / stride;
        const iy = r % stride, iz = (r - iy) / stride;
        let h = ((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) & m2;
        while (nk[h] !== 0) h = (h + 1) & m2;
        nk[h] = key; nvv[h] = hv[i];
      }
      hk = nk; hv = nvv; hmask = m2;
    }
    function osample(ix, iy, iz, ls, le) {
      const key = 1 + ix + stride * (iy + stride * iz);
      let h = ((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) & hmask, kk;
      while ((kk = hk[h]) !== 0) { if (kk === key) return hv[h]; h = (h + 1) & hmask; }
      const v = eval_field(ox + ix * cmin, oy + iy * cmin, oz + iz * cmin, ls, le);
      hk[h] = key; hv[h] = v;
      if (++hn * 2 > hk.length) { const r = hv[h]; hgrow(); return r; }
      return hv[h];
    }
    const cv = new Float64Array(8);
    function ocorners(x, y, z, sz, ls, le) {                 // the corner values into cv, the inside mask
      let m = 0;
      for (let c = 0; c < 8; c++) {
        const v = osample(x + (c & 1) * sz, y + ((c >> 1) & 1) * sz, z + ((c >> 2) & 1) * sz, ls, le);
        cv[c] = v;
        if (v < 0) m |= (1 << c);
      }
      return m;
    }
    let mp_x = 0, mp_y = 0, mp_z = 0;
    function omass(x, y, z, sz) {                            // the mean of the edge crossings of the corners in cv -> mp_*, the number of crossings
      let sxs = 0, sys = 0, szs = 0, cnt = 0;
      for (let e = 0; e < 12; e++) {
        const a = EA[e], b = EB[e], va = cv[a], vb = cv[b];
        if ((va < 0) !== (vb < 0)) {
          const t = va / (va - vb);
          sxs += CX[a] + (CX[b] - CX[a]) * t; sys += CY[a] + (CY[b] - CY[a]) * t; szs += CZ[a] + (CZ[b] - CZ[a]) * t;
          cnt++;
        }
      }
      if (cnt === 0) return 0;
      mp_x = ox + (x + sxs / cnt * sz) * cmin; mp_y = oy + (y + sys / cnt * sz) * cmin; mp_z = oz + (z + szs / cnt * sz) * cmin;
      return cnt;
    }
    // is any primitive whose surface can cross this node thinner than `features` cells across the node?
    function othin(cx, cy, cz, s, ls, le) {
      const hs = s * 0.5;
      for (let i = ls; i < le; i++) {
        const q = o_list[i], b = q * 6;
        if (pbox[b] > cx + hs || pbox[b + 3] < cx - hs || pbox[b + 1] > cy + hs || pbox[b + 4] < cy - hs || pbox[b + 2] > cz + hs || pbox[b + 5] < cz - hs) continue;
        const o = q * STRIDE, ty = P[o];
        let r, t;
        if (ty === T_SPHERE) r = P[o + 7];
        else if (ty === T_ELLIPSOID) r = P[o + 10];
        else if (ty === T_CAPSULE) {
          t = ((cx - P[o + 4]) * P[o + 7] + (cy - P[o + 5]) * P[o + 8] + (cz - P[o + 6]) * P[o + 9]) * P[o + 10];
          t = t < 0 ? 0 : (t > 1 ? 1 : t);
          r = P[o + 11] + P[o + 12] * t;
        } else if (ty === T_LOFT) {
          t = ((cx - P[o + 4]) * P[o + 7] + (cy - P[o + 5]) * P[o + 8] + (cz - P[o + 6]) * P[o + 9]) * P[o + 10];
          t = t < 0 ? 0 : (t > 1 ? 1 : t);
          const q2 = P[o + 11] * LX;
          r = X[q2] + X[q2 + 1] * t; t = X[q2 + 2] + X[q2 + 3] * t;
          if (t < r) r = t;
        } else if (ty === T_TORUS) r = P[o + 11];
        else if (ty === T_CYLINDER) r = Math.min(P[o + 10], P[o + 11]) + P[o + 12];
        else if (ty === T_VOLUME) r = BIG;                    // (a baked grid has its own resolution: the tolerance decides where the tree splits, not a thin primitive)
        else { r = P[o + 7] < P[o + 8] ? P[o + 7] : P[o + 8]; if (P[o + 9] < r) r = P[o + 9]; r += P[o + 10]; }
        if (s * feat > 2 * r) return true;
      }
      return false;
    }
    // is the field in this node (corners in cv) further than the tolerance from the trilinear interpolation of its corners? At the centre, the face centres and the edge midpoints
    function ononlin(x, y, z, sz, fc, ls, le) {
      const half = sz >> 1;
      let avg = (cv[0] + cv[1] + cv[2] + cv[3] + cv[4] + cv[5] + cv[6] + cv[7]) * 0.125, v = fc - avg;
      if (v > tol || -v > tol) return true;
      for (let f = 0; f < 6; f++) {
        avg = (cv[FACE_C[f * 4]] + cv[FACE_C[f * 4 + 1]] + cv[FACE_C[f * 4 + 2]] + cv[FACE_C[f * 4 + 3]]) * 0.25;
        v = osample(x + FACE_O[f * 3] * half, y + FACE_O[f * 3 + 1] * half, z + FACE_O[f * 3 + 2] * half, ls, le) - avg;
        if (v > tol || -v > tol) return true;
      }
      for (let e = 0; e < 12; e++) {
        const a = EA[e], b = EB[e];
        avg = (cv[a] + cv[b]) * 0.5;
        v = osample(x + (CX[a] + CX[b]) * half, y + (CY[a] + CY[b]) * half, z + (CZ[a] + CZ[b]) * half, ls, le) - avg;
        if (v > tol || -v > tol) return true;
      }
      return false;
    }
    // the primitives of o_list[ls .. le) that can reach a child cube, appended at o_top; returns the new end
    function ofilter(x, y, z, sz, ls, le) {
      const s = sz * cmin, lox = ox + x * cmin, loy = oy + y * cmin, loz = oz + z * cmin, hix = lox + s, hiy = loy + s, hiz = loz + s;
      const pad = lipc * 0.8660254037844386 * s + kmax + s;
      list_room(o_top + (le - ls));
      let w = o_top;
      for (let i = ls; i < le; i++) {
        const q = o_list[i], o = q * STRIDE;
        if (P[o + 1] !== OP_INTERSECT) {
          const b = q * 6, k = P[o + 2] + pad, ty = P[o];
          let ex = k, ey = k, ez = k;
          if (ty === T_ELLIPSOID) { ex = k / (P[o + 7] * P[o + 10]); ey = k / (P[o + 8] * P[o + 10]); ez = k / (P[o + 9] * P[o + 10]); }
          else if (ty === T_LOFT) ex = ey = ez = k * 1.3;
          if (rbox[b] - ex > hix || rbox[b + 3] + ex < lox || rbox[b + 1] - ey > hiy || rbox[b + 4] + ey < loy || rbox[b + 2] - ez > hiz || rbox[b + 5] + ez < loz) continue;
        }
        o_list[w++] = q;
      }
      o_top = w;
      return w;
    }

    let leaves = 0;
    // builds node n (its slot is reserved) covering the lattice cube [x, x + 2^lvl)^3 with the primitive list [ls, le)
    function obuild(n, x, y, z, lvl, ls, le) {
      const sz = 1 << lvl, s = sz * cmin, hs = s * 0.5, cx = ox + x * cmin + hs, cy = oy + y * cmin + hs, cz = oz + z * cmin + hs;
      let m = 0, have = false, split = false;
      o_child[n] = -1; o_vert[n] = -1; o_mask[n] = 0; o_flag[n] = 0;
      const fc = eval_field(cx, cy, cz, ls, le), tt = lipc * 0.8660254037844386 * s;
      if (fc > tt) return;                                                  // provably outside
      if (fc < -tt) { o_mask[n] = 255; return; }                            // provably inside
      if (lvl > 0) {
        if (lvl > maxlvl) split = true;
        else if (othin(cx, cy, cz, s, ls, le)) split = true;
        else {
          m = ocorners(x, y, z, sz, ls, le);
          have = true;
          if (m === 0 || m === 255) split = (m === 255) !== (fc < 0);       // the surface is inside without touching a corner
          else {
            omass(x, y, z, sz);
            const ev = eval_field(mp_x, mp_y, mp_z, ls, le);
            split = (ev < 0 ? -ev : ev) > tol;
          }
          if (!split) split = ononlin(x, y, z, sz, fc, ls, le);
        }
        if (split) {
          ogrow(8);
          const c = onodes, half = sz >> 1, base = o_top;
          onodes += 8;
          o_child[n] = c;
          for (let i = 0; i < 8; i++) {
            o_top = base;
            const ce = ofilter(x + (i & 1) * half, y + ((i >> 1) & 1) * half, z + ((i >> 2) & 1) * half, half, ls, le);
            obuild(c + i, x + (i & 1) * half, y + ((i >> 1) & 1) * half, z + ((i >> 2) & 1) * half, lvl - 1, base, ce);
          }
          o_top = base;
          return;
        }
      }
      // a leaf
      if (!have) m = ocorners(x, y, z, sz, ls, le);
      o_mask[n] = m;
      if (m !== 0 && m !== 255 && omass(x, y, z, sz) > 0) { o_vert[n] = new_vertex(mp_x, mp_y, mp_z); leaves++; }
    }
    function build_cpu() {
      ogrow(1);
      o_top = nprims;
      list_room(o_top);
      for (let i = 0; i < nprims; i++) o_list[i] = i;
      obuild(0, 0, 0, 0, L, 0, nprims);
    }

    // ---- finding leaves, balancing, contouring
    let loc_x = 0, loc_y = 0, loc_z = 0, loc_l = 0;
    function ofind(qx, qy, qz) {                             // the leaf containing the point (qx, qy, qz) in quarter lattice units (never on a cell boundary) -> loc_*
      let n = 0, x = 0, y = 0, z = 0, lvl = L, c;
      while ((c = o_child[n]) >= 0) {
        const half = 1 << (lvl - 1);
        let i = 0;
        if (qx >= 4 * (x + half)) { i |= 1; x += half; }
        if (qy >= 4 * (y + half)) { i |= 2; y += half; }
        if (qz >= 4 * (z + half)) { i |= 4; z += half; }
        n = c + i; lvl--;
      }
      loc_x = x; loc_y = y; loc_z = z; loc_l = lvl;
      return n;
    }
    let need_n = [], need_x = [], need_y = [], need_z = [], need_l = [];
    function queue(n, x, y, z, l) { need_n.push(n); need_x.push(x); need_y.push(y); need_z.push(z); need_l.push(l); }
    // split a leaf into 8 children; their lists come from the lookup grid (the tree's own list stack is gone)
    function osplit(n, x, y, z, lvl) {
      const sz = 1 << lvl, half = sz >> 1, s = sz * cmin, top = o_top;
      tools.lookup(ox + x * cmin + s * 0.5, oy + y * cmin + s * 0.5, oz + z * cmin + s * 0.5);
      const lk = tools.list(), cnt = lk[1] - lk[0];
      list_room(top + cnt);
      for (let i = 0; i < cnt; i++) o_list[top + i] = lcsr.list[lk[0] + i];
      const ls = top, le = top + cnt;
      ogrow(8);
      const c = onodes;
      onodes += 8;
      o_child[n] = c;
      for (let i = 0; i < 8; i++) {
        o_top = le;
        const ce = ofilter(x + (i & 1) * half, y + ((i >> 1) & 1) * half, z + ((i >> 2) & 1) * half, half, ls, le);
        obuild(c + i, x + (i & 1) * half, y + ((i >> 1) & 1) * half, z + ((i >> 2) & 1) * half, lvl - 1, le, ce);
      }
      o_top = top;
    }
    function osplit_queued() {                               // splits every queued leaf that can be split; returns how many were
      let done = 0;
      for (let c = 0; c < need_n.length; c++) if (need_l[c] > 0) { osplit(need_n[c], need_x[c], need_y[c], need_z[c], need_l[c]); done++; }
      need_n = []; need_x = []; need_y = []; need_z = []; need_l = [];
      return done;
    }
    const ec = [0, 0, 0], eb = [0, 0, 0];
    function obal_walk(n, x, y, z, lvl) {                    // queues the neighbours (26 directions) of every surface leaf that are more than one level coarser than it
      const c = o_child[n];
      if (c >= 0) {
        const half = 1 << (lvl - 1);
        for (let i = 0; i < 8; i++) obal_walk(c + i, x + (i & 1) * half, y + ((i >> 1) & 1) * half, z + ((i >> 2) & 1) * half, lvl - 1);
        return;
      }
      if (o_vert[n] < 0) return;
      const sz = 1 << lvl;
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        ec[0] = dx < 0 ? 4 * x - 2 : (dx > 0 ? 4 * (x + sz) + 2 : 4 * x + 2 * sz + 1);
        ec[1] = dy < 0 ? 4 * y - 2 : (dy > 0 ? 4 * (y + sz) + 2 : 4 * y + 2 * sz + 1);
        ec[2] = dz < 0 ? 4 * z - 2 : (dz > 0 ? 4 * (z + sz) + 2 : 4 * z + 2 * sz + 1);
        if (ec[0] < 0 || ec[1] < 0 || ec[2] < 0 || ec[0] >= lim4 || ec[1] >= lim4 || ec[2] >= lim4) continue;
        const t = ofind(ec[0], ec[1], ec[2]);
        if (loc_l > lvl + 1 && !o_flag[t]) { o_flag[t] = 1; queue(t, loc_x, loc_y, loc_z, loc_l); }
      }
    }
    function omake_vertex(node, x, y, z, lvl) {              // a leaf with no vertex (its corners agree, but a finer neighbour sees the surface): one at its centre, pulled onto the surface
      const s = (1 << lvl) * cmin;
      const v = new_vertex(ox + x * cmin + s * 0.5, oy + y * cmin + s * 0.5, oz + z * cmin + s * 0.5);
      tools.project_to(vpos[v * 3], vpos[v * 3 + 1], vpos[v * 3 + 2], 3, s);
      vpos[v * 3] = tools.prx; vpos[v * 3 + 1] = tools.pry; vpos[v * 3 + 2] = tools.prz;
      o_vert[node] = v;
      if (lvl > 0 && !o_flag[node]) { o_flag[node] = 1; queue(node, x, y, z, lvl); }       // this leaf should have been split: the next round does it
      return v;
    }
    const pu = [0, 0, 0, 0];
    function opoly(a, b, c, d, flip) {                       // the polygon of the four leaf vertices around an edge (counter clockwise; flipped when the edge starts outside)
      if (flip) { const t = b; b = d; d = t; }
      const pv = [a, b, c, d];
      let k = 0;
      for (let i = 0; i < 4; i++) { if (k > 0 && pu[k - 1] === pv[i]) continue; pu[k++] = pv[i]; }
      if (k > 1 && pu[k - 1] === pu[0]) k--;
      if (k === 4) { if (pu[0] === pu[2] || pu[1] === pu[3]) return; emit_quad(pu[0], pu[1], pu[2], pu[3]); }
      else if (k === 3) emit_tri(pu[0], pu[1], pu[2]);
    }
    const qn = [0, 0, 0, 0], qx = [0, 0, 0, 0], qy = [0, 0, 0, 0], qz = [0, 0, 0, 0], ql = [0, 0, 0, 0];
    function oedge(n, x, y, z, lvl, e) {                     // leaf n owns edge e when it is the finest of the four leaves around it (the lowest node index among equals): then it emits the polygon
      const sz = 1 << lvl, a = EA[e], k = e >> 2, p = (k + 1) % 3, q = (k + 2) % 3;
      eb[0] = 4 * (x + CX[a] * sz); eb[1] = 4 * (y + CY[a] * sz); eb[2] = 4 * (z + CZ[a] * sz);
      const sp = ((a >> p) & 1) === 0 ? 1 : -1, sq = ((a >> q) & 1) === 0 ? 1 : -1;
      for (let j = 0; j < 4; j++) {
        if (QSP[j] === sp && QSQ[j] === sq) { qn[j] = n; qx[j] = x; qy[j] = y; qz[j] = z; ql[j] = lvl; continue; }
        ec[k] = eb[k] + 1; ec[p] = eb[p] + 2 * QSP[j]; ec[q] = eb[q] + 2 * QSQ[j];
        if (ec[0] < 0 || ec[1] < 0 || ec[2] < 0 || ec[0] >= lim4 || ec[1] >= lim4 || ec[2] >= lim4) return;
        const t = ofind(ec[0], ec[1], ec[2]);
        if (loc_l < lvl || (loc_l === lvl && t < n)) return;
        qn[j] = t; qx[j] = loc_x; qy[j] = loc_y; qz[j] = loc_z; ql[j] = loc_l;
      }
      let v0 = o_vert[qn[0]]; if (v0 < 0) v0 = omake_vertex(qn[0], qx[0], qy[0], qz[0], ql[0]);
      let v1 = o_vert[qn[1]]; if (v1 < 0) v1 = omake_vertex(qn[1], qx[1], qy[1], qz[1], ql[1]);
      let v2 = o_vert[qn[2]]; if (v2 < 0) v2 = omake_vertex(qn[2], qx[2], qy[2], qz[2], ql[2]);
      let v3 = o_vert[qn[3]]; if (v3 < 0) v3 = omake_vertex(qn[3], qx[3], qy[3], qz[3], ql[3]);
      opoly(v0, v1, v2, v3, ((o_mask[n] >> a) & 1) === 0);
    }
    function owalk(n, x, y, z, lvl) {
      const c = o_child[n];
      if (c >= 0) {
        const half = 1 << (lvl - 1);
        for (let i = 0; i < 8; i++) owalk(c + i, x + (i & 1) * half, y + ((i >> 1) & 1) * half, z + ((i >> 2) & 1) * half, lvl - 1);
        return;
      }
      const m = o_mask[n];
      if (m === 0 || m === 255) return;
      for (let e = 0; e < 12; e++) if (((m >> EA[e]) & 1) !== ((m >> EB[e]) & 1)) oedge(n, x, y, z, lvl, e);
    }

    // the tree is built: grade it (opt in), contour it (a leaf whose corners agree can still hold a thin sheet that a finer neighbour sees: its vertex is invented, the leaf split, and the contouring
    // done again, a few rounds at most), drop the vertices no triangle uses, pull the vertices onto the surface -> { positions, nv, indices, ni, stats }
    function contour() {
      if (bal) {
        for (let i = 0; i < 12; i++) {
          need_n = []; need_x = []; need_y = []; need_z = []; need_l = [];
          obal_walk(0, 0, 0, 0, L);
          if (osplit_queued() === 0) break;
        }
      }
      let nv_tree = nv;
      for (let i = 0; i < 6; i++) {
        ni = 0; nv = nv_tree; need_n = []; need_x = []; need_y = []; need_z = []; need_l = [];
        owalk(0, 0, 0, 0, L);
        if (need_n.length === 0) break;
        for (let c = 0; c < need_n.length; c++) o_vert[need_n[c]] = -1;
        nv = nv_tree;
        const done = osplit_queued();
        nv_tree = nv;
        if (done === 0) { ni = 0; need_n = []; need_x = []; need_y = []; need_z = []; need_l = []; owalk(0, 0, 0, 0, L); break; }      // only the smallest leaves are left: keep their vertices
      }
      // drop the vertices no triangle uses (leaves that were split after they had made one)
      const remap = new Int32Array(nv + 1).fill(-1);
      for (let i = 0; i < ni; i++) remap[idx[i]] = 0;
      let nn = 0;
      for (let i = 0; i < nv; i++) {
        if (remap[i] < 0) continue;
        remap[i] = nn;
        vpos[nn * 3] = vpos[i * 3]; vpos[nn * 3 + 1] = vpos[i * 3 + 1]; vpos[nn * 3 + 2] = vpos[i * 3 + 2];
        nn++;
      }
      for (let i = 0; i < ni; i++) idx[i] = remap[idx[i]];
      nv = nn;
      if (ad.project) {                                      // a coarse leaf's mean-of-crossings vertex sits off the surface: pulling every vertex onto it keeps the triangles between leaves of different sizes from folding
        const limit = 0.5 * cmin * (1 << maxlvl);
        for (let i = 0; i < nv; i++) {
          tools.project_to(vpos[i * 3], vpos[i * 3 + 1], vpos[i * 3 + 2], 1, limit);
          vpos[i * 3] = tools.prx; vpos[i * 3 + 1] = tools.pry; vpos[i * 3 + 2] = tools.prz;
        }
      }
      return { positions: vpos, nv: nv, indices: idx, ni: ni };
    }

    return {
      cmin: cmin, coarse_cell: cmin * (1 << maxlvl), maxlvl: maxlvl, levels: L, origin: [ox, oy, oz], tools: tools, build_cpu: build_cpu, contour: contour,
      stats: function () { return { nodes: onodes, leaves: leaves, corner_samples: hn, min_cell: cmin, max_cell: cmin * (1 << maxlvl) }; }
    };
  }

  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // decimate - quadric error edge collapse (Garland - Heckbert) of a welded, closed mesh, as geometry_creature.cpp does it (def.decimate).
  //
  // Every vertex keeps the summed, area weighted plane quadric of its faces; the cheapest edge collapses first (a lazy heap: an entry is stale when either end changed). A collapse is refused when it
  // would pinch the surface (the link condition), flip or badly squash a triangle, or make an edge longer than max_edge. Afterwards every vertex is pulled back onto the true surface and the normals,
  // uvs, colours and weights are made from the field again (the per-vertex passes run on the finished mesh), so the shading stays crisp with far fewer triangles.
  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  // mesh: { positions Float32Array, nv, indices Uint32Array, ni } -> the same kind of mesh with fewer triangles (the arrays are made new); dec: the normalised def.decimate; tools: surface_tools
  // (null: a plain triangle mesh with no field behind it, as the bake decimates the mesh it is given: no projection, and a collapse that turns a face by more than 60 degrees is refused);
  // colours: optional, 3 numbers per vertex (linear rgb, NaN where a vertex has none): an edge between two colours then goes later (dec.color says how much later), so the vertices left are where the colour changes
  function decimate_mesh(mesh, dec, base_cell, coarse_cell, tools, colours) {
    const nv = mesh.nv, nf = mesh.ni / 3, vpos = mesh.positions.slice(0, nv * 3), idx = mesh.indices.slice(0, mesh.ni);
    let target = dec.triangles > 0 ? Math.floor(dec.triangles) : Math.floor(nf * (dec.ratio > 0 ? dec.ratio : 0.5) + 0.5);
    if (target < 4) target = 4;
    const max_err2 = dec.error > 0 ? dec.error * dec.error : 0.25 * base_cell * base_cell;
    const cw = colours && dec.color !== 0 ? (dec.color > 0 ? dec.color : 1) * 4 * base_cell * base_cell : 0, dcol = cw > 0 ? Float64Array.from(colours.subarray(0, nv * 3)) : null;      // (a change of 0.3 in one colour channel costs as much as a collapse at the default error)
    const d_max_edge2 = dec.max_edge > 0 ? dec.max_edge * dec.max_edge : 16 * coarse_cell * coarse_cell, d_min_q = dec.min_quality >= 0 ? dec.min_quality : 0.1;
    const dq = new Float64Array(10 * nv), dw = new Float64Array(nv), dvhead = new Int32Array(nv).fill(-1), dvver = new Int32Array(nv), dmark = new Int32Array(nv), dvalive = new Uint8Array(nv).fill(1);
    const dvnext = new Int32Array(3 * nf), dfalive = new Uint8Array(nf);
    let ecap = 4 * nf + 1024;
    const eh_cost = new Float64Array(ecap), eh_a = new Int32Array(ecap), eh_b = new Int32Array(ecap), eh_va = new Int32Array(ecap), eh_vb = new Int32Array(ecap), heap = new Int32Array(ecap);
    let ne = 0, nheap = 0, dstamp = 0, dfaces = nf, dcap_hit = false, reason = 3;
    const qt = new Float64Array(10);
    let tgt_x = 0, tgt_y = 0, tgt_z = 0, d_err = 0;

    function q_err(q, x, y, z) { return q[0] * x * x + q[4] * y * y + q[7] * z * z + 2 * (q[1] * x * y + q[2] * x * z + q[5] * y * z + q[3] * x + q[6] * y + q[8] * z) + q[9]; }
    // the cost of collapsing a-b: the best of the quadric optimum (when it is near the edge), both ends and the midpoint -> tgt_*, d_err (the mean squared distance)
    function edge_cost(a, b) {
      const q = qt, oa = a * 10, ob = b * 10;
      for (let i = 0; i < 10; i++) q[i] = dq[oa + i] + dq[ob + i];
      const ax = vpos[a * 3], ay = vpos[a * 3 + 1], az = vpos[a * 3 + 2], bx = vpos[b * 3], by = vpos[b * 3 + 1], bz = vpos[b * 3 + 2];
      const mx = (ax + bx) * 0.5, my = (ay + by) * 0.5, mz = (az + bz) * 0.5, ddx = bx - ax, ddy = by - ay, ddz = bz - az, len2 = ddx * ddx + ddy * ddy + ddz * ddz;
      let best = q_err(q, mx, my, mz), e;
      tgt_x = mx; tgt_y = my; tgt_z = mz;
      e = q_err(q, ax, ay, az); if (e < best) { best = e; tgt_x = ax; tgt_y = ay; tgt_z = az; }
      e = q_err(q, bx, by, bz); if (e < best) { best = e; tgt_x = bx; tgt_y = by; tgt_z = bz; }
      const m00 = q[0], m01 = q[1], m02 = q[2], m11 = q[4], m12 = q[5], m22 = q[7], tr = m00 + m11 + m22;
      const c00 = m11 * m22 - m12 * m12, c01 = m02 * m12 - m01 * m22, c02 = m01 * m12 - m02 * m11, det = m00 * c00 + m01 * c01 + m02 * c02;
      if (tr > 0 && det > 1e-6 * (tr / 3) * (tr / 3) * (tr / 3)) {
        const r0 = -q[3], r1 = -q[6], r2 = -q[8], inv = 1 / det;
        const px = (c00 * r0 + c01 * r1 + c02 * r2) * inv, py = (c01 * r0 + (m00 * m22 - m02 * m02) * r1 + (m01 * m02 - m00 * m12) * r2) * inv, pz = (c02 * r0 + (m01 * m02 - m00 * m12) * r1 + (m00 * m11 - m01 * m01) * r2) * inv;
        const dx = px - mx, dy = py - my, dz = pz - mz;
        if (dx * dx + dy * dy + dz * dz <= 0.5 * len2) {       // keep the optimum near the edge
          e = q_err(q, px, py, pz);
          if (e < best) { best = e; tgt_x = px; tgt_y = py; tgt_z = pz; }
        }
      }
      if (best < 0) best = 0;
      d_err = best / (dw[a] + dw[b]);
      let cc = 0;                                            // the colour change along the edge: it orders the collapses, it does not count as an error (the surface does not move)
      if (dcol) {
        const ca = dcol[a * 3], cb = dcol[b * 3];
        if (ca === ca && cb === cb) { const r = ca - cb, g = dcol[a * 3 + 1] - dcol[b * 3 + 1], bl = dcol[a * 3 + 2] - dcol[b * 3 + 2]; cc = cw * (r * r + g * g + bl * bl); }
      }
      return d_err + 2e-3 * len2 + cc;                       // tie break: among equal errors the shorter edge goes first
    }
    function hpush(cost, a, b) {
      const id = ne;
      if (id >= ecap) { dcap_hit = true; return; }
      eh_cost[id] = cost; eh_a[id] = a; eh_b[id] = b; eh_va[id] = dvver[a]; eh_vb[id] = dvver[b];
      ne++;
      let i = nheap++;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (eh_cost[heap[p]] <= cost) break;
        heap[i] = heap[p]; i = p;
      }
      heap[i] = id;
    }
    function hpop() {
      const top = heap[0], last = heap[--nheap];
      let i = 0;
      if (nheap > 0) {
        const cost = eh_cost[last];
        for (;;) {
          let c = 2 * i + 1;
          if (c >= nheap) break;
          if (c + 1 < nheap && eh_cost[heap[c + 1]] < eh_cost[heap[c]]) c++;
          if (eh_cost[heap[c]] >= cost) break;
          heap[i] = heap[c]; i = c;
        }
        heap[i] = last;
      }
      return top;
    }
    function prune(v) {                                      // the corners of v that belong to a dead face are dropped from its list
      let n = dvhead[v], prev = -1;
      while (n >= 0) {
        const nx = dvnext[n];
        if (!dfalive[(n / 3) | 0]) { if (prev < 0) dvhead[v] = nx; else dvnext[prev] = nx; }
        else prev = n;
        n = nx;
      }
    }
    // would face f survive moving vertex mv to the collapse target: no flip, no sliver, no over long edge
    function face_ok(f, mv) {
      const c0 = idx[f * 3], c1 = idx[f * 3 + 1], c2 = idx[f * 3 + 2];
      let x0 = vpos[c0 * 3], y0 = vpos[c0 * 3 + 1], z0 = vpos[c0 * 3 + 2], x1 = vpos[c1 * 3], y1 = vpos[c1 * 3 + 1], z1 = vpos[c1 * 3 + 2], x2 = vpos[c2 * 3], y2 = vpos[c2 * 3 + 1], z2 = vpos[c2 * 3 + 2];
      let ux = x1 - x0, uy = y1 - y0, uz = z1 - z0, vx = x2 - x0, vy = y2 - y0, vz = z2 - z0;
      const ox = uy * vz - uz * vy, oy = uz * vx - ux * vz, oz = ux * vy - uy * vx, lo = Math.sqrt(ox * ox + oy * oy + oz * oz);
      const so = ux * ux + uy * uy + uz * uz + vx * vx + vy * vy + vz * vz + (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) + (z2 - z1) * (z2 - z1), qo = so > 0 ? 3.4641016151377544 * lo / so : 0;
      if (c0 === mv) { x0 = tgt_x; y0 = tgt_y; z0 = tgt_z; } else if (c1 === mv) { x1 = tgt_x; y1 = tgt_y; z1 = tgt_z; } else { x2 = tgt_x; y2 = tgt_y; z2 = tgt_z; }
      ux = x1 - x0; uy = y1 - y0; uz = z1 - z0; vx = x2 - x0; vy = y2 - y0; vz = z2 - z0;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, ln = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const e0 = ux * ux + uy * uy + uz * uz, e1 = vx * vx + vy * vy + vz * vz, e2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) + (z2 - z1) * (z2 - z1);
      const qn_ = e0 + e1 + e2 > 0 ? 3.4641016151377544 * ln / (e0 + e1 + e2) : 0;
      if (lo > 1e-20) {                                      // a face that was already degenerate can't get worse
        if (ln < 1e-20 || ln < 1e-3 * lo) return false;
        const dt = ox * nx + oy * ny + oz * nz;
        if (dt < 0.25 * lo * ln) return false;               // folds over by more than ~75 degrees
        if (!tools) { if (dt < 0.5 * lo * ln) return false; }  // (a mesh with no field behind it, the bake's: a face may not turn by more than 60 degrees)
        else if (dt < 0.87 * lo * ln || qn_ < 0.25) {        // turned a lot or got thin: cumulative drift can fold a face, so ask the field
          const tx = (x0 + x1 + x2) / 3, ty = (y0 + y1 + y2) / 3, tz = (z0 + z1 + z2) / 3;
          tools.lookup(tx, ty, tz);
          tools.gradient(tx, ty, tz);
          if (nx * tools.gx + ny * tools.gy + nz * tools.gz <= 0) return false;
        }
      }
      if (qn_ < d_min_q && qn_ < qo) return false;
      if (c0 === mv) { if (e0 > d_max_edge2 || e1 > d_max_edge2) return false; }
      else if (c1 === mv) { if (e0 > d_max_edge2 || e2 > d_max_edge2) return false; }
      else if (e1 > d_max_edge2 || e2 > d_max_edge2) return false;
      return true;
    }
    function collapse_ok(a, b) {
      const s = (dstamp += 2);
      let common = 0, shared = 0;
      for (let n = dvhead[a]; n >= 0; n = dvnext[n]) {
        const f = (n / 3) | 0;
        if (!dfalive[f]) continue;
        dmark[idx[f * 3]] = s; dmark[idx[f * 3 + 1]] = s; dmark[idx[f * 3 + 2]] = s;
      }
      for (let n = dvhead[b]; n >= 0; n = dvnext[n]) {
        const f = (n / 3) | 0;
        if (!dfalive[f]) continue;
        const c0 = idx[f * 3], c1 = idx[f * 3 + 1], c2 = idx[f * 3 + 2];
        if (c0 === a || c1 === a || c2 === a) shared++;
        if (c0 !== a && c0 !== b && dmark[c0] === s) { common++; dmark[c0] = s + 1; }
        if (c1 !== a && c1 !== b && dmark[c1] === s) { common++; dmark[c1] = s + 1; }
        if (c2 !== a && c2 !== b && dmark[c2] === s) { common++; dmark[c2] = s + 1; }
      }
      if (shared !== 2 || common !== 2) return false;        // only interior manifold edges may collapse
      for (let n = dvhead[a]; n >= 0; n = dvnext[n]) {
        const f = (n / 3) | 0;
        if (!dfalive[f] || idx[f * 3] === b || idx[f * 3 + 1] === b || idx[f * 3 + 2] === b) continue;
        if (!face_ok(f, a)) return false;
      }
      for (let n = dvhead[b]; n >= 0; n = dvnext[n]) {
        const f = (n / 3) | 0;
        if (!dfalive[f] || idx[f * 3] === a || idx[f * 3 + 1] === a || idx[f * 3 + 2] === a) continue;
        if (!face_ok(f, b)) return false;
      }
      return true;
    }
    function do_collapse(a, b) {                             // merge b into a at the target position
      let killed = 0, p0 = -1, p1 = -1;
      vpos[a * 3] = tgt_x; vpos[a * 3 + 1] = tgt_y; vpos[a * 3 + 2] = tgt_z;
      for (let i = 0; i < 10; i++) dq[a * 10 + i] += dq[b * 10 + i];
      if (dcol) {                                            // the merged vertex has the colour of the two, by area (a vertex without one takes the other's)
        const a3 = a * 3, b3 = b * 3;
        if (dcol[b3] === dcol[b3]) {
          if (dcol[a3] === dcol[a3]) { const s = dw[a] + dw[b] > 0 ? dw[b] / (dw[a] + dw[b]) : 0.5; for (let i = 0; i < 3; i++) dcol[a3 + i] += (dcol[b3 + i] - dcol[a3 + i]) * s; }
          else for (let i = 0; i < 3; i++) dcol[a3 + i] = dcol[b3 + i];
        }
      }
      dw[a] += dw[b];
      dvalive[b] = 0; dvver[a]++;
      let n = dvhead[b];
      while (n >= 0) {
        const nn = dvnext[n], f = (n / 3) | 0;
        if (dfalive[f]) {
          const c0 = idx[f * 3], c1 = idx[f * 3 + 1], c2 = idx[f * 3 + 2];
          if (c0 === a || c1 === a || c2 === a) {
            dfalive[f] = 0; dfaces--;
            const x = (c0 !== a && c0 !== b) ? c0 : ((c1 !== a && c1 !== b) ? c1 : c2);
            if (killed === 0) p0 = x; else p1 = x;
            killed++;
          } else { idx[n] = a; dvnext[n] = dvhead[a]; dvhead[a] = n; }        // the corner moves to a's list
        }
        n = nn;
      }
      dvhead[b] = -1;
      prune(a);
      if (p0 >= 0) prune(p0);
      if (p1 >= 0) prune(p1);
      const s = ++dstamp;
      for (let m = dvhead[a]; m >= 0; m = dvnext[m]) {
        const f = (m / 3) | 0;
        for (let i = 0; i < 3; i++) {
          const x = idx[f * 3 + i];
          if (x !== a && dmark[x] !== s) { dmark[x] = s; hpush(edge_cost(a, x), a, x); }
        }
      }
    }
    function build_heap() {
      ne = 0; nheap = 0;
      for (let f = 0; f < nf; f++) {
        if (!dfalive[f]) continue;
        for (let c = 0; c < 3; c++) {
          const u = idx[f * 3 + c], v = idx[f * 3 + (c + 1) % 3];
          if (u < v) hpush(edge_cost(u, v), u, v);
        }
      }
    }

    for (let f = 0; f < nf; f++) {
      dfalive[f] = 1;
      for (let c = 0; c < 3; c++) { const v = idx[f * 3 + c]; dvnext[f * 3 + c] = dvhead[v]; dvhead[v] = f * 3 + c; }
      const a = idx[f * 3], b = idx[f * 3 + 1], w = idx[f * 3 + 2];
      const ax = vpos[a * 3], ay = vpos[a * 3 + 1], az = vpos[a * 3 + 2];
      const ux = vpos[b * 3] - ax, uy = vpos[b * 3 + 1] - ay, uz = vpos[b * 3 + 2] - az, vx = vpos[w * 3] - ax, vy = vpos[w * 3 + 1] - ay, vz = vpos[w * 3 + 2] - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len < 1e-20) continue;                             // zero area (coincident vertices) is real topology: keep the face, it just adds no quadric
      const area = 0.5 * len, inv = 1 / len;
      nx *= inv; ny *= inv; nz *= inv;
      const d = -(nx * ax + ny * ay + nz * az);
      for (let c = 0; c < 3; c++) {
        const vtx = idx[f * 3 + c], o = vtx * 10;
        dq[o] += area * nx * nx; dq[o + 1] += area * nx * ny; dq[o + 2] += area * nx * nz; dq[o + 3] += area * nx * d;
        dq[o + 4] += area * ny * ny; dq[o + 5] += area * ny * nz; dq[o + 6] += area * ny * d;
        dq[o + 7] += area * nz * nz; dq[o + 8] += area * nz * d; dq[o + 9] += area * d * d;
        dw[vtx] += area;
      }
    }
    let max_pass = 4, total = 0, stop = false, err_hit = false;
    for (let pass = 0; pass < max_pass && dfaces > target && !stop; pass++) {
      dcap_hit = false;
      build_heap();
      let progress = 0;
      while (nheap > 0 && dfaces > target && !dcap_hit) {
        const e = hpop(), a = eh_a[e], b = eh_b[e];
        if (!dvalive[a] || !dvalive[b] || dvver[a] !== eh_va[e] || dvver[b] !== eh_vb[e]) continue;
        edge_cost(a, b);
        if (d_err > max_err2) {
          if (!dcol) { stop = true; reason = 2; break; }       // (sorted by the error: all the rest are over it too)
          err_hit = true; continue;                            // (with the colours in the order it is not: this edge is left and the others go on)
        }
        if (!collapse_ok(a, b)) continue;
        do_collapse(a, b);
        progress++; total++;
      }
      if (dcap_hit && max_pass < 16) max_pass++;            // the heap was too small for this pass: it does not count against the limit
      if (progress === 0 && !dcap_hit) break;
    }
    if (dfaces <= target) reason = 1; else if (err_hit) reason = 2;
    if (dec.project && tools) {                              // pull every surviving vertex back onto the true surface, unless that would flip / squash a face around it
      for (let i = 0; i < nv; i++) {
        if (!dvalive[i] || dvhead[i] < 0) continue;
        tools.project_to(vpos[i * 3], vpos[i * 3 + 1], vpos[i * 3 + 2], 1, 0.75 * base_cell);
        tgt_x = tools.prx; tgt_y = tools.pry; tgt_z = tools.prz;
        let ok_all = true;
        for (let o = dvhead[i]; o >= 0; o = dvnext[o]) { const f = (o / 3) | 0; if (dfalive[f] && !face_ok(f, i)) { ok_all = false; break; } }
        if (ok_all) { vpos[i * 3] = tgt_x; vpos[i * 3 + 1] = tgt_y; vpos[i * 3 + 2] = tgt_z; }
      }
    }
    // compact vertices and faces
    const remap = new Int32Array(nv).fill(-1);
    for (let f = 0; f < nf; f++) if (dfalive[f]) { remap[idx[f * 3]] = 0; remap[idx[f * 3 + 1]] = 0; remap[idx[f * 3 + 2]] = 0; }
    let nn = 0;
    for (let i = 0; i < nv; i++) {
      if (remap[i] < 0) continue;
      remap[i] = nn;
      vpos[nn * 3] = vpos[i * 3]; vpos[nn * 3 + 1] = vpos[i * 3 + 1]; vpos[nn * 3 + 2] = vpos[i * 3 + 2];
      nn++;
    }
    let np = 0;
    const out = new Uint32Array(dfaces * 3);
    for (let f = 0; f < nf; f++) if (dfalive[f]) { out[np * 3] = remap[idx[f * 3]]; out[np * 3 + 1] = remap[idx[f * 3 + 1]]; out[np * 3 + 2] = remap[idx[f * 3 + 2]]; np++; }
    return { positions: vpos.slice(0, nn * 3), nv: nn, indices: out.slice(0, np * 3), ni: np * 3, stats: { triangles_before: nf, triangles_after: np, collapses: total, stopped: reason === 1 ? "target" : (reason === 2 ? "error" : "blocked") } };
  }

  // ==== volumes and bake: begin ================================================================================================================================================
  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // volumes - a baked mesh as a primitive: a part of shape "volume" is a grid of signed distances (negative inside) the field samples like any other primitive, so everything a part can do (union,
  // subtract, intersect, blends, mirrors, groups, islands, being moved / turned / scaled) it does too. bake_mesh makes a volume of a triangle mesh (a glTF character); engine.set_volume /
  // mesher.add_volume load one under its id; the def's part names it:
  //   { id: "xbot", shape: "volume", volume: "xbot", center: [x, y, z], rotate: [rx, ry, rz] (degrees), scale: s, op, blend, blend_mode, mirror, color: [r, g, b, a] (a tint), group, island, bone ... }
  // `center` is where the MIDDLE OF THE VOLUME'S BOX stands (volume.mid, the middle of the baked mesh's box: where it stood when it was baked, when `center` is left out), the turn and the scale
  // are about it. The scale is uniform and moves the distances too, so a volume scaled down is sampled at the same cell: bake again (or use a smaller cell) for the detail.
  //
  // volume = { id, version, nx, ny, nz, ox, oy, oz, cell, data: Float32Array (nx * ny * nz, x fastest: the sample at (ox + i * cell, oy + j * cell, oz + k * cell)), box: [x0, y0, z0, x1, y1, z1] (where
  //            the surface is: the grid's box without its margin), attr: { colors: { keys: Uint32Array (the sorted indices of the voxels that have a colour), rgba: Uint8Array (4 per key, sRGB) } } | null,
  //            band (the cells either side of the surface where the distance is exact: beyond it the value stops at +- band * cell), stats }; prepare_volume adds mid, half and inv.
  // The colours are what the bake saw at the surface next to each voxel: the vertex colours times the texture. The vertices a volume OWNS (the parts' ids say which) are given them, times the part's
  // colour (a tint: white when the part has none) and the baked shading, in every build: a draft, the uniform grid, the octree. The decimation (def.decimate) sees them too: an edge between two
  // colours is collapsed later than one inside a colour (decimate.color, 0 to turn it off), so a heavily decimated character keeps its vertices where its texture changes.
  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const SRGB_TO_LIN = (function () {
    const t = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const c = i / 255; t[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    return t;
  })();
  function lin_to_srgb8(c) { c = c < 0 ? 0 : (c > 1 ? 1 : c); return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); }

  // checks a volume and adds what the field needs (inv, mid, half); the volume object itself is kept (the engine owns it from now on). Returns it
  function prepare_volume(v) {
    if (!v || typeof v !== "object") fail("a volume must be an object");
    if (typeof v.id !== "string" || v.id === "") fail("a volume needs an id (a string)");
    const lab = "volume '" + v.id + "'";
    ["nx", "ny", "nz"].forEach(function (k) { if (!(v[k] >= 2) || v[k] !== Math.floor(v[k])) fail(lab + "." + k + " must be a whole number >= 2"); });
    if (!(v.data instanceof Float32Array) || v.data.length !== v.nx * v.ny * v.nz) fail(lab + ".data must be a Float32Array of nx * ny * nz distances");
    if (!(finite(v.cell, lab + ".cell") > 0)) fail(lab + ".cell must be > 0");
    finite(v.ox, lab + ".ox"); finite(v.oy, lab + ".oy"); finite(v.oz, lab + ".oz");
    if (v.box === undefined) v.box = [v.ox + v.cell, v.oy + v.cell, v.oz + v.cell, v.ox + (v.nx - 2) * v.cell, v.oy + (v.ny - 2) * v.cell, v.oz + (v.nz - 2) * v.cell];
    if (!Array.isArray(v.box) || v.box.length < 6) fail(lab + ".box must be [x0, y0, z0, x1, y1, z1]");
    for (let i = 0; i < 6; i++) finite(v.box[i], lab + ".box");
    if (!(v.box[3] >= v.box[0] && v.box[4] >= v.box[1] && v.box[5] >= v.box[2])) fail(lab + ".box is inverted");
    v.inv = 1 / v.cell;
    v.mid = [(v.box[0] + v.box[3]) * 0.5, (v.box[1] + v.box[4]) * 0.5, (v.box[2] + v.box[5]) * 0.5];
    v.half = [(v.box[3] - v.box[0]) * 0.5, (v.box[4] - v.box[1]) * 0.5, (v.box[5] - v.box[2]) * 0.5];
    v.version = v.version > 0 ? v.version : 1;
    const c = v.attr && v.attr.colors;
    if (c && (!(c.keys instanceof Uint32Array) || !(c.rgba instanceof Uint8Array) || c.rgba.length !== c.keys.length * 4)) fail(lab + ".attr.colors needs keys (Uint32Array) and rgba (Uint8Array, 4 per key)");
    const s = v.attr && v.attr.skin;
    if (s) {
      if (!Array.isArray(s.names) || !s.names.length || s.names.length > 255 || !s.names.every(function (n) { return typeof n === "string"; })) fail(lab + ".attr.skin.names must be 1 .. 255 bone names");
      if (!(s.P instanceof Float32Array) || s.P.length % 3 || !(s.I instanceof Uint32Array) || s.I.length % 3 || !(s.J instanceof Uint8Array) || !(s.W instanceof Uint8Array) || s.J.length !== (s.P.length / 3) * 4 || s.W.length !== s.J.length) fail(lab + ".attr.skin needs P (Float32Array, 3 per vertex), I (Uint32Array, 3 per triangle), J and W (Uint8Array, 4 per vertex)");
      if (s.parents !== undefined && s.parents !== null && !skin_parents_ok(s.parents, s.names.length)) fail(lab + ".attr.skin.parents is the index of the name above every name (-1: none), as many as names, with no cycle");
    }
    return v;
  }
  // WHERE A POINT OF A VOLUME STANDS: p in the volume's own frame (the frame its mesh was baked in: a piece's bones, its socket) -> where the part of shape "volume" puts it in the def, exactly what emit_volume
  // does to the grid: w = C + s R (p - mid), R = Rz Ry Rx of part.rotate (degrees, x first), s = part.scale, mid = the middle of the volume's box, C = part.center, or part.origin + s R mid, or mid; mirrored
  // (true, or "x"): the mirror copy's point (x negated: the copy across the bone plane that `mirror: "x"` makes). A skeleton that belongs to a volume is placed with it by this, head and tail
  function volume_place(vol, part, p, mirrored) {
    const b = vol.box, mid = vol.mid || [(b[0] + b[3]) * 0.5, (b[1] + b[4]) * 0.5, (b[2] + b[5]) * 0.5];
    part = part || {};
    const rot = part.rotate || [0, 0, 0], s = part.scale === undefined ? 1 : part.scale;
    const ca = Math.cos(rot[0] * DEG), sa = Math.sin(rot[0] * DEG), cb = Math.cos(rot[1] * DEG), sb = Math.sin(rot[1] * DEG), cc = Math.cos(rot[2] * DEG), sc = Math.sin(rot[2] * DEG);
    const R = [cc * cb, cc * sb * sa - sc * ca, cc * sb * ca + sc * sa, sc * cb, sc * sb * sa + cc * ca, sc * sb * ca - cc * sa, -sb, cb * sa, cb * ca];
    const turn = function (u) { return [R[0] * u[0] + R[1] * u[1] + R[2] * u[2], R[3] * u[0] + R[4] * u[1] + R[5] * u[2], R[6] * u[0] + R[7] * u[1] + R[8] * u[2]]; };
    let C = mid;
    if (part.center !== undefined) C = part.center;
    else if (part.origin !== undefined) { const m = turn(mid); C = [part.origin[0] + s * m[0], part.origin[1] + s * m[1], part.origin[2] + s * m[2]]; }
    const u = turn([p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]]), w = [C[0] + s * u[0], C[1] + s * u[1], C[2] + s * u[2]];
    if (mirrored) w[0] = -w[0];
    return w;
  }
  // a copy that owns its arrays (a volume that is sent to a second thread: the first keeps its own)
  function clone_volume(v) {
    const o = Object.assign({}, v);
    o.data = v.data.slice();
    if (v.box) o.box = v.box.slice();
    if (v.attr) {
      o.attr = {};
      if (v.attr.colors) o.attr.colors = { keys: v.attr.colors.keys.slice(), rgba: v.attr.colors.rgba.slice() };
      if (v.attr.skin) { const s = v.attr.skin; o.attr.skin = { names: s.names.slice(), P: s.P.slice(), I: s.I.slice(), J: s.J.slice(), W: s.W.slice() }; if (s.parents) o.attr.skin.parents = s.parents.slice(); }
    }
    if (v.stats) o.stats = JSON.parse(JSON.stringify(v.stats));
    return o;
  }
  function volume_buffers(v) {                                    // the buffers of a volume, for a transfer list
    const l = [v.data.buffer];
    if (v.attr && v.attr.colors) { l.push(v.attr.colors.keys.buffer); l.push(v.attr.colors.rgba.buffer); }
    if (v.attr && v.attr.skin) { const s = v.attr.skin; l.push(s.P.buffer); l.push(s.I.buffer); l.push(s.J.buffer); l.push(s.W.buffer); }
    return l;
  }

  function key_index(keys, key) {                                 // binary search in sorted keys: the index, or -1
    let lo = 0, hi = keys.length - 1;
    while (lo <= hi) { const m = (lo + hi) >> 1, k = keys[m]; if (k === key) return m; if (k < key) lo = m + 1; else hi = m - 1; }
    return -1;
  }
  // the slot of the colour of the voxel nearest to the grid point (gx, gy, gz); a voxel that has none is replaced by the nearest of its 26 neighbours that has one (-1: none)
  function colour_slot(V, gx, gy, gz) {
    const nx = V.nx, ny = V.ny, nz = V.nz, keys = V.attr.colors.keys;
    let ix = Math.round(gx), iy = Math.round(gy), iz = Math.round(gz);
    ix = ix < 0 ? 0 : (ix >= nx ? nx - 1 : ix); iy = iy < 0 ? 0 : (iy >= ny ? ny - 1 : iy); iz = iz < 0 ? 0 : (iz >= nz ? nz - 1 : iz);
    const k = key_index(keys, ix + nx * (iy + ny * iz));
    if (k >= 0) return k;
    let best = -1, bd = 1e9;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const jx = ix + dx, jy = iy + dy, jz = iz + dz;
      if (jx < 0 || jy < 0 || jz < 0 || jx >= nx || jy >= ny || jz >= nz) continue;
      const j = key_index(keys, jx + nx * (jy + ny * jz)), d = dx * dx + dy * dy + dz * dz;
      if (j >= 0 && d < bd) { bd = d; best = j; }
    }
    return best;
  }
  // which volume of the candidate primitives (indices) a point belongs to - the one whose SURFACE it is nearest to (the grid's distance there, outside the grid the distance to its box; the two copies of a
  // mirrored part, whose grids can overlap across the middle, are told apart by it: "the first whose grid holds the point" gave a right leg the left copy's weights and colours) - and where the point is:
  // LOC = { V, vi (its index in comp.vols), prim, gx, gy, gz (grid coordinates), lx, ly, lz (the point in the volume's own frame) }. `want` is what the volume has to carry ("colors" | "skin"); false when none of them does
  const LOC = { V: null, vi: 0, prim: -1, gx: 0, gy: 0, gz: 0, lx: 0, ly: 0, lz: 0 };
  function grid_value(V, gx, gy, gz) {                            // a volume's distance at grid coordinates (unscaled): trilinear inside, plus the distance to the grid's box outside it (volume_dist's)
    const nx = V.nx, mx = nx - 1, my = V.ny - 1, mz = V.nz - 1;
    let ex = 0, ey = 0, ez = 0;
    if (gx < 0) { ex = -gx; gx = 0; } else if (gx > mx) { ex = gx - mx; gx = mx; }
    if (gy < 0) { ey = -gy; gy = 0; } else if (gy > my) { ey = gy - my; gy = my; }
    if (gz < 0) { ez = -gz; gz = 0; } else if (gz > mz) { ez = gz - mz; gz = mz; }
    const x0 = gx | 0, y0 = gy | 0, z0 = gz | 0, fx = gx - x0, fy = gy - y0, fz = gz - z0, D = V.data, sx = x0 < mx ? 1 : 0, sy = y0 < my ? nx : 0, sz = z0 < mz ? nx * V.ny : 0, b = x0 + nx * y0 + nx * V.ny * z0;
    const c00 = D[b] + (D[b + sx] - D[b]) * fx, c10 = D[b + sy] + (D[b + sy + sx] - D[b + sy]) * fx, c01 = D[b + sz] + (D[b + sz + sx] - D[b + sz]) * fx, c11 = D[b + sy + sz] + (D[b + sy + sz + sx] - D[b + sy + sz]) * fx;
    const c0 = c00 + (c10 - c00) * fy, c1 = c01 + (c11 - c01) * fy, val = c0 + (c1 - c0) * fz;
    return ex !== 0 || ey !== 0 || ez !== 0 ? val + Math.sqrt(ex * ex + ey * ey + ez * ez) * V.cell : val;
  }
  function volume_frame(comp, cand, x, y, z, want, loc) {
    const P = comp.prim, X = comp.lx, vols = comp.vols;
    let best = null, bd = Infinity;
    for (let c = 0; c < cand.length; c++) {
      const i = cand[c], o = i * STRIDE, q = i * LX, vi = P[o + 7] | 0, V = vols[vi];
      if (!(V.attr && V.attr[want])) continue;
      const dx = x - P[o + 4], dy = y - P[o + 5], dz = z - P[o + 6], inv = V.inv;
      const lx = X[q] * dx + X[q + 1] * dy + X[q + 2] * dz + X[q + 9], ly = X[q + 3] * dx + X[q + 4] * dy + X[q + 5] * dz + X[q + 10], lz = X[q + 6] * dx + X[q + 7] * dy + X[q + 8] * dz + X[q + 11];
      const gx = (lx - V.ox) * inv, gy = (ly - V.oy) * inv, gz = (lz - V.oz) * inv;
      const d = cand.length > 1 ? Math.abs(grid_value(V, gx, gy, gz)) * P[o + 8] : 0;
      if (d < bd || best === null) { bd = d; best = V; loc.vi = vi; loc.prim = i; loc.gx = gx; loc.gy = gy; loc.gz = gz; loc.lx = lx; loc.ly = ly; loc.lz = lz; }
    }
    loc.V = best;
    return !!best;
  }
  // the colour (linear rgba in out) the volumes give the point (x, y, z): of the candidate primitives the one whose grid the point is inside, or nearest to; false when there is none, or no colour there
  function volume_colour_at(comp, cand, x, y, z, out) {
    if (!volume_frame(comp, cand, x, y, z, "colors", LOC)) return false;
    const best = LOC.V, s = colour_slot(best, LOC.gx, LOC.gy, LOC.gz);
    if (s < 0) return false;
    const rgba = best.attr.colors.rgba;
    out[0] = SRGB_TO_LIN[rgba[s * 4]]; out[1] = SRGB_TO_LIN[rgba[s * 4 + 1]]; out[2] = SRGB_TO_LIN[rgba[s * 4 + 2]]; out[3] = rgba[s * 4 + 3] / 255;
    return true;
  }
  function has_volume_colours(comp) {
    for (let i = 0; i < comp.vols.length; i++) if (comp.vols[i].attr && comp.vols[i].attr.colors) return true;
    return false;
  }
  // the colours of the vertices that a volume owns: the colour the baked mesh had in the voxel the vertex is in, times what the passes made of the part's colour and the baked shading. (The part
  // ids tell which vertex a part owns; of the two primitives of a mirrored part the one whose grid the vertex is inside is its.) A vertex whose voxel has no colour keeps its colour.
  // With soft colours (shade.color_blend > 0) a volume's colours go ACROSS the blend instead of stopping at the line where another part owns the vertex: the fold's shares (fold_shares, the skin's seam) with
  // w = color_blend * blend + half a cell (no wider than the volumes' bands) mix the volumes' colours and plain white (what the other parts' own colours, already softened by the passes, are multiplied by)
  function prim_colour_at(comp, i, x, y, z, out) {                // the colour of volume primitive i at (x, y, z): its voxel there (or its nearest neighbour's with one), linear; false: none
    const P = comp.prim, X = comp.lx, o = i * STRIDE, q = P[o + 11] * LX, V = comp.vols[P[o + 7] | 0];
    if (!(V.attr && V.attr.colors)) return false;
    const dx = x - P[o + 4], dy = y - P[o + 5], dz = z - P[o + 6];
    const s = colour_slot(V, (X[q] * dx + X[q + 1] * dy + X[q + 2] * dz + X[q + 9] - V.ox) * V.inv, (X[q + 3] * dx + X[q + 4] * dy + X[q + 5] * dz + X[q + 10] - V.oy) * V.inv, (X[q + 6] * dx + X[q + 7] * dy + X[q + 8] * dz + X[q + 11] - V.oz) * V.inv);
    if (s < 0) return false;
    const rgba = V.attr.colors.rgba;
    out[0] = SRGB_TO_LIN[rgba[s * 4]]; out[1] = SRGB_TO_LIN[rgba[s * 4 + 1]]; out[2] = SRGB_TO_LIN[rgba[s * 4 + 2]]; out[3] = rgba[s * 4 + 3] / 255;
    return true;
  }
  function volume_colors(comp, mesh, vd, grid, ctx) {
    if (!comp.vols.length || !vd.colors || !has_volume_colours(comp)) return;
    const pos = mesh.positions, nv = mesh.nv, col = vd.colors, c = [0, 0, 0, 1], st = comp.settings;
    if (!(st.color_blend > 0) || !grid) {
      if (!vd.part_ids) return;
      const vp = comp.vol_prim, ids = vd.part_ids;
      for (let v = 0; v < nv; v++) {
        const cand = vp[ids[v]];
        if (!cand || !volume_colour_at(comp, cand, pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], c)) continue;
        col[v * 4] *= c[0]; col[v * 4 + 1] *= c[1]; col[v * 4 + 2] *= c[2]; col[v * 4 + 3] *= c[3];
      }
      return;
    }
    const P = comp.prim, trk = new Uint8Array(comp.n);
    for (let i = 0; i < comp.n; i++) { const o = i * STRIDE; if (P[o] === T_VOLUME && P[o + 1] === OP_UNION) { const V = comp.vols[P[o + 7] | 0]; if (V.attr && V.attr.colors) trk[i] = 1; } }
    const wmul = st.color_blend, wadd = 0.5 * grid.cell, sl = share_lists(comp, grid, trk, wmul, wadd), csr = sl.csr, L = csr.list, field = (ctx && ctx.field) || make_field(comp);
    for (let v = 0; v < nv; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], bl = block_of(csr, grid, x, y, z);
      if (!sl.hot[bl]) continue;
      fold_shares(comp, field, L, csr.start[bl], csr.start[bl + 1], x, y, z, trk, wmul, wadd, sl.bmin);
      let any = false, r = 0, g = 0, b = 0, a = 0, wsum = SH.base;                              // (a volume with no colour there, a cap that the bake closed, is left out of the mix: its neighbours' colours cover it)
      for (let j = 0; j < SH.n; j++) {
        const s = SH.s[j];
        if (!(s > 0) || !prim_colour_at(comp, SH.idx[j], x, y, z, c)) continue;
        r += s * c[0]; g += s * c[1]; b += s * c[2]; a += s * c[3]; wsum += s; any = true;
      }
      if (!any) continue;
      const base = SH.base;
      col[v * 4] *= (r + base) / wsum; col[v * 4 + 1] *= (g + base) / wsum; col[v * 4 + 2] *= (b + base) / wsum; col[v * 4 + 3] *= (a + base) / wsum;
    }
  }
  // the colours a mesh would have from the volumes alone (3 per vertex, linear; NaN where no volume has one): what the edge collapse is told, so that it keeps vertices where the colour changes.
  // null when the decimation does not ask for it (dec.color 0) or no volume has colours
  function decimation_colours(comp, mesh, dec) {
    if (!dec || dec.color === 0 || !has_volume_colours(comp)) return null;
    const nv = mesh.nv, pos = mesh.positions, out = new Float32Array(nv * 3).fill(NaN), all = [], c = [0, 0, 0, 1];
    for (const k in comp.vol_prim) comp.vol_prim[k].forEach(function (i) { all.push(i); });
    for (let v = 0; v < nv; v++) if (volume_colour_at(comp, all, pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], c)) { out[v * 3] = c[0]; out[v * 3 + 1] = c[1]; out[v * 3 + 2] = c[2]; }
    return out;
  }

  // ---- skin: the weights of the file's vertices, carried to the vertices that a volume owns --------------------------------------------------------------------------------------------------------------
  // A rigged mesh keeps its skin with the volume: vol.attr.skin = { names, P, I, J, W } - the bones' names (the weights name them, so the def's skeleton may be renumbered or edited), the file's vertices (positions in
  // the volume's frame: Float32Array, 3 each), its triangles (Uint32Array, 3 each) and per vertex its four joints (Uint8Array, 4: an index in `names`) and weights (Uint8Array, 4: 0 .. 255, the sum is 255). A vertex of
  // a build that the volume owns (the part ids say which) takes the weights of the NEAREST POINT OF THE FILE'S SURFACE: that point is in a triangle, and the weights of its three vertices are interpolated there. Whatever
  // happened to the volume since (carved, blended with another part, moved, scaled, mirrored) the weights are the file's, exact at the vertex, not a grid's. The vertices of the other parts get theirs from their own bone,
  // as ever, and a rigged volume does not claim a bone itself.
  // THE NAMES (skin_name_map): a name of the file goes to the bone of the def that the part's `bone_map` says (`@host`, the weights the source gave to bones outside the piece: to the bone the part names
  // unless the map says), else to the bone of that name; one that is neither is dropped and the rest made up to 1. A copy reflected across x takes the twin of every bone (a mirrored left leg is skinned to the right leg).
  // THE SEAM (volume_skin, `skin.seam`, default 1): a volume and what it is blended into SHARE the vertices of the blend: the field's fold carries every union step's blend factor (fold_shares), and a vertex's weights are
  // the shares of the volumes' file weights and of the bone parts' weights (what the vertex pass gave), so the skin goes over from the torso's to the piece's across the fillet instead of at an ownership line
  // (where a turned bone tore the seam open); seam 0 is the ownership rule of before.
  function has_skin(V) { return !!(V && V.attr && V.attr.skin); }
  function has_volume_skin(comp) {
    for (let i = 0; i < comp.vols.length; i++) if (has_skin(comp.vols[i])) return true;
    return false;
  }

  // the bins that make the nearest triangle quick to find: every triangle in the bins its box touches (a bin is 1.5 cells), as lists. Built when the first vertex asks, by the thread that meshes; it is not part of the
  // volume (not enumerable: it is neither copied nor sent)
  function skin_bins(S, cell) {
    if (S.bins) return S.bins;
    const P = S.P, I = S.I, nt = (I.length / 3) | 0, nvv = (P.length / 3) | 0;
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < nvv; i++) for (let k = 0; k < 3; k++) { const p = P[i * 3 + k]; if (p < mn[k]) mn[k] = p; if (p > mx[k]) mx[k] = p; }
    let edge = 0;                                                  // the mean edge of the file's triangles: a coarse file (a piece of a low poly model) gets bins of its own size, not the grid's (a point a few cm from it searched thousands of empty bins)
    for (let t = 0; t < nt; t++) { const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3; edge += Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]) + Math.hypot(P[b] - P[c], P[b + 1] - P[c + 1], P[b + 2] - P[c + 2]) + Math.hypot(P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]); }
    edge = nt > 0 ? edge / (3 * nt) : 0;
    let h = cell > 0 ? Math.max(1.5 * cell, edge) : Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2], 1e-6) / 64, nx = 1, ny = 1, nz = 1;
    for (let guard = 0; guard < 60; guard++) {
      nx = Math.floor((mx[0] - mn[0]) / h) + 1; ny = Math.floor((mx[1] - mn[1]) / h) + 1; nz = Math.floor((mx[2] - mn[2]) / h) + 1;
      if (nx * ny * nz <= 4000000) break;
      h *= 1.3;
    }
    const inv = 1 / h, nb = nx * ny * nz, start = new Int32Array(nb + 1), lo = [0, 0, 0], hi = [0, 0, 0];
    const range = function (t) {
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      for (let k = 0; k < 3; k++) {
        const u = Math.min(P[a + k], P[b + k], P[c + k]), w = Math.max(P[a + k], P[b + k], P[c + k]), n = k === 0 ? nx : (k === 1 ? ny : nz);
        lo[k] = Math.max(0, Math.floor((u - mn[k]) * inv)); hi[k] = Math.min(n - 1, Math.floor((w - mn[k]) * inv));
      }
    };
    for (let t = 0; t < nt; t++) { range(t); for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) start[x + nx * (y + ny * z) + 1]++; }
    for (let b = 0; b < nb; b++) start[b + 1] += start[b];
    const cur = start.slice(0, nb), list = new Int32Array(start[nb]);
    for (let t = 0; t < nt; t++) { range(t); for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) list[cur[x + nx * (y + ny * z)]++] = t; }
    const B = { ox: mn[0], oy: mn[1], oz: mn[2], h: h, inv: inv, nx: nx, ny: ny, nz: nz, start: start, list: list, mark: new Int32Array(nt), stamp: 0 };
    Object.defineProperty(S, "bins", { value: B, enumerable: false, writable: true, configurable: true });
    return B;
  }
  // the triangle of the file nearest to (x, y, z) -> res.t (-1: the file has no triangle), res.u / v / w the barycentric coordinates of the nearest point in it. The bins are searched ring by ring from the one the
  // point is in, and the search ends when no bin that is left can hold anything nearer than what was found
  function skin_nearest(S, B, x, y, z, res) {
    const P = S.P, I = S.I, mark = B.mark, nx = B.nx, ny = B.ny, nz = B.nz, h = B.h, start = B.start, list = B.list;
    const fx = (x - B.ox) * B.inv, fy = (y - B.oy) * B.inv, fz = (z - B.oz) * B.inv;
    const bx = Math.floor(fx), by = Math.floor(fy), bz = Math.floor(fz);
    const inside = bx >= 0 && by >= 0 && bz >= 0 && bx < nx && by < ny && bz < nz;
    const cx = bx < 0 ? 0 : (bx >= nx ? nx - 1 : bx), cy = by < 0 ? 0 : (by >= ny ? ny - 1 : by), cz = bz < 0 ? 0 : (bz >= nz ? nz - 1 : bz);
    let edge = 0;                                                  // how far the point is from the faces of its own bin: nothing outside the rings searched can be nearer than r * h + that
    if (inside) {
      const ex = fx - bx, ey = fy - by, ez = fz - bz;
      edge = Math.min(ex < 1 - ex ? ex : 1 - ex, ey < 1 - ey ? ey : 1 - ey, ez < 1 - ez ? ez : 1 - ez) * h;
    }
    const stamp = ++B.stamp;
    let best = Infinity, bt = -1;
    const scan = function (b) {
      for (let j = start[b], e = start[b + 1]; j < e; j++) {
        const t = list[j];
        if (mark[t] === stamp) continue;
        mark[t] = stamp;
        const a = I[t * 3] * 3, bb = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
        const d = bk_dist2(x, y, z, P[a], P[a + 1], P[a + 2], P[bb], P[bb + 1], P[bb + 2], P[c], P[c + 1], P[c + 2]);
        if (d < best) { best = d; bt = t; }
      }
    };
    const rmax = Math.max(nx, ny, nz);
    for (let r = 0; r <= rmax; r++) {
      const z0 = cz - r < 0 ? 0 : cz - r, z1 = cz + r >= nz ? nz - 1 : cz + r, y0 = cy - r < 0 ? 0 : cy - r, y1 = cy + r >= ny ? ny - 1 : cy + r, x0 = cx - r < 0 ? 0 : cx - r, x1 = cx + r >= nx ? nx - 1 : cx + r;
      for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) {
        if (z === cz - r || z === cz + r || y === cy - r || y === cy + r) { for (let xx = x0; xx <= x1; xx++) scan(xx + nx * (y + ny * z)); }     // (a row of the ring's faces: all of it)
        else { if (cx - r >= 0) scan(cx - r + nx * (y + ny * z)); if (cx + r < nx) scan(cx + r + nx * (y + ny * z)); }                                // (inside the faces: only the two ends)
      }
      if (bt >= 0) { const bound = r * h + edge; if (best <= bound * bound) break; }
    }
    res.t = bt;
    if (bt < 0) return false;
    const a = I[bt * 3] * 3, b = I[bt * 3 + 1] * 3, c = I[bt * 3 + 2] * 3;
    bk_closest(x, y, z, P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2]);
    const abx = P[b] - P[a], aby = P[b + 1] - P[a + 1], abz = P[b + 2] - P[a + 2], acx = P[c] - P[a], acy = P[c + 1] - P[a + 1], acz = P[c + 2] - P[a + 2], apx = bq[0] - P[a], apy = bq[1] - P[a + 1], apz = bq[2] - P[a + 2];
    const d00 = abx * abx + aby * aby + abz * abz, d01 = abx * acx + aby * acy + abz * acz, d11 = acx * acx + acy * acy + acz * acz, d20 = apx * abx + apy * aby + apz * abz, d21 = apx * acx + apy * acy + apz * acz, den = d00 * d11 - d01 * d01;
    let w1 = den !== 0 ? (d11 * d20 - d01 * d21) / den : 0, w2 = den !== 0 ? (d00 * d21 - d01 * d20) / den : 0, w0 = 1 - w1 - w2;
    w0 = w0 < 0 ? 0 : w0; w1 = w1 < 0 ? 0 : w1; w2 = w2 < 0 ? 0 : w2;
    const s = w0 + w1 + w2 || 1;
    res.u = w0 / s; res.v = w1 / s; res.w = w2 / s;
    return true;
  }

  const SK_RES = { t: -1, u: 0, v: 0, w: 0 }, SK_B = new Int32Array(64), SK_W = new Float64Array(64), SK_TB = new Int32Array(16), SK_TW = new Float64Array(16);

  // the bones of the def that the names of a rigged volume primitive's skin go to (-1: dropped; the section's head says the rule): its part's bone_map, `@host` to the part's own bone, any other name as it is,
  // and for a copy reflected across x (the record's 9) the twin of every bone that has one (sk.mirror: system's rule, a name ending _l has an _r twin).
  // A name `@<name>:<k>` that the map does not say is found from `@<name>`: `@host:k` is the k-th bone UP from where `@host` went (the source's host, its parent, its grandparent: a piece keeps the falloff of
  // its host's region, mapped onto the creature's own chain), any other `@<socket>:k` the k-th bone DOWN the chain from where `@<socket>` went (a torso's weights on the second bone of a cut off leg go to the
  // second bone of the leg that is put there), as far as the chain goes (up: to the root; down: while a bone has one child)
  // A NAME THAT RESOLVES TO NOTHING (neither mapped, nor a bone of the def, nor an `@<name>:<k>` whose base resolves) is not dropped at once: it goes up the volume's own chain of names (skin.parents, what a
  // piece's anchors say: an outside bone > the anchor above it > ... > @host) to the first name that resolves, and else into the part's `@host` target (a volume with no chain: a .sdfvol of before, a mesh made by
  // hand), so a piece whose outside anchors nobody mapped is skinned as if they were folded into its host (v1's pieces), and a creator that maps them by their source names gains; only with no host to fold
  // into is a name dropped. A name mapped to null is dropped on purpose (and so are the names below it on the chain that resolve through it). `info` (optional) collects "<part>:<name>" of the names folded
  // (info.folded) and dropped (info.dropped): the build's stats.skin_folded / skin_dropped, so that a typo in a bone_map is seen
  function skin_name_map(comp, o, info) {
    const P = comp.prim, sk = comp.skeleton, V = comp.vols[P[o + 7] | 0], part = comp.parts[P[o + 3]] || {}, S = V.attr.skin, names = S.names, par = S.parents || null, bm = part.bone_map || null, mir = P[o + 9] === 1, m = new Int16Array(names.length);
    const has = function (k) { return !!bm && Object.prototype.hasOwnProperty.call(bm, k); }, DROP = -2;
    const own = function (n) {                                                         // a name by itself: its map, its bone, its @<name>:<k>; undefined: it does not resolve; DROP: mapped to null
      const rel = has(n) ? null : /^(@[^:]+):(\d+)$/.exec(n), base = rel ? rel[1] : n;
      const t = has(base) ? bm[base] : (base === "@host" && part.host ? part.host : base);
      if (t === null) return DROP;
      let b = sk.index[t];
      if (b !== undefined && rel) {
        for (let s = +rel[2], up = base === "@host"; s > 0; s--) {
          if (up) { if (sk.parent[b] < 0) break; b = sk.parent[b]; }
          else { if (sk.children[b].length !== 1) break; b = sk.children[b][0]; }
        }
      }
      return b;
    };
    const ht = has("@host") ? bm["@host"] : (part.host || null), host = ht === null || ht === undefined ? undefined : sk.index[ht];
    for (let j = 0; j < names.length; j++) {
      let b = own(names[j]), folded = false;
      if (b === undefined && par) for (let k = par[j], s = 0; k >= 0 && s < names.length; k = par[k], s++) { const c = own(names[k]); if (c !== undefined) { b = c; folded = true; break; } }
      if (b === undefined && host !== undefined) { b = host; folded = true; }
      if (b === DROP) b = undefined;
      else if (b === undefined) { if (info) info.dropped[part.id + ":" + names[j]] = 1; }
      else if (folded && info) info.folded[part.id + ":" + names[j]] = 1;
      if (b !== undefined && mir && sk.mirror[b] >= 0) b = sk.mirror[b];
      m[j] = b === undefined ? -1 : b;
    }
    return m;
  }
  // the file's weights at (x, y, z) for the rigged volume primitive at o: the nearest point of its surface (in the volume's own frame), its triangle's three vertices interpolated -> SK_TB / SK_TW (bone, raw weight:
  // the bytes times the barycentric weight; a bone twice is one), the count
  function skin_file(comp, o, map, x, y, z) {
    const P = comp.prim, X = comp.lx, q = P[o + 11] * LX, V = comp.vols[P[o + 7] | 0], S = V.attr.skin;
    const dx = x - P[o + 4], dy = y - P[o + 5], dz = z - P[o + 6];
    const lx = X[q] * dx + X[q + 1] * dy + X[q + 2] * dz + X[q + 9], ly = X[q + 3] * dx + X[q + 4] * dy + X[q + 5] * dz + X[q + 10], lz = X[q + 6] * dx + X[q + 7] * dy + X[q + 8] * dz + X[q + 11];
    if (!skin_nearest(S, skin_bins(S, V.cell), lx, ly, lz, SK_RES)) return 0;
    const t = SK_RES.t;
    let n = 0;
    for (let c = 0; c < 3; c++) {
      const vi = S.I[t * 3 + c], bw = c === 0 ? SK_RES.u : (c === 1 ? SK_RES.v : SK_RES.w);
      if (!(bw > 0)) continue;
      for (let qq = 0; qq < 4; qq++) {
        const w = S.W[vi * 4 + qq];
        if (w === 0) continue;
        const bone = map[S.J[vi * 4 + qq]];
        if (bone < 0) continue;
        let at = -1;
        for (let k = 0; k < n; k++) if (SK_TB[k] === bone) { at = k; break; }
        if (at < 0) { at = n++; SK_TB[at] = bone; SK_TW[at] = 0; }
        SK_TW[at] += bw * w;
      }
    }
    return n;
  }
  function sk_add(n, bone, w) {                                   // w more for the bone in SK_B / SK_W (n bones there) -> the count
    for (let k = 0; k < n; k++) if (SK_B[k] === bone) { SK_W[k] += w; return n; }
    if (n < SK_B.length) { SK_B[n] = bone; SK_W[n] = w; n++; }
    return n;
  }
  // the four strongest of SK_B / SK_W (n of them) as the vertex's skin: strongest first, a weight under half a percent of the sum dropped, the rest made up to 1. (Taking the fifth off the four makes the cut
  // continuous where two bones change places, but where five bones are near equal, as two skins with different bones mixed in a seam are, it took 0.37 of a bone to 0.94: not done)
  function skin_write(BI, BW, v, n) {
    const tw = [0, 0, 0, 0], tb = [0, 0, 0, 0];
    for (let k = 0; k < n; k++) {
      const val = SK_W[k];
      if (val <= tw[3]) continue;
      let a = 3;
      while (a > 0 && val > tw[a - 1]) { tw[a] = tw[a - 1]; tb[a] = tb[a - 1]; a--; }
      tw[a] = val; tb[a] = SK_B[k];
    }
    let sum = tw[0] + tw[1] + tw[2] + tw[3];
    if (!(sum > 0)) return;
    for (let k = 1; k < 4; k++) if (tw[k] < 0.005 * sum) tw[k] = 0;
    sum = tw[0] + tw[1] + tw[2] + tw[3];
    for (let k = 0; k < 4; k++) { BI[v * 4 + k] = tw[k] > 0 ? tb[k] : tb[0]; BW[v * 4 + k] = tw[k] / sum; }
  }

  // THE SHARES of a point: the field's fold over L[ls .. le) (the same order, groups and operations as eval_list), every UNION step mixing what came before with the new primitive by its blend factor
  // h = clamp(0.5 + 0.5 (d - dd) / w, 0, 1) (d the union so far, dd the primitive's distance, w = wmul * the step's blend + wadd; w 0: the nearer takes it all), the way an attribute is carried through a smooth
  // union: the crease of two parts is half and half, a part whose surface is a width nearer than the rest's has it all. The primitives that `trk` marks are counted on their own (SH.idx, SH.s: SH.n of them),
  // everything else is one share (SH.base); they add up to 1. A group (a loft's pieces) is folded as one, its nearest member's.
  // A VOLUME'S DISTANCE IS EXACT ONLY IN ITS BAND (band cells either side of its surface, the bake's `band`, 4 by default): beyond it, anywhere in its grid's box, it reads the band's value, a bound and not a
  // distance (a point 30 cm from a leg reads 2 cm inside the leg's box). So no step is wider than the narrowest band of the def's volumes (SH.bmin, times their scales: share_lists finds it, ONE number for the
  // whole build, so that two blocks of the cull lists never fold with different widths): a width the band cannot see gave shares to parts that are far away (they stopped at the edges of their boxes: lines
  // across the skin); within the cap a band's bound, read as it is, gives a part no share near another surface. A wider seam needs volumes baked with a wider band. A BLEND wider than a band is another
  // matter: its fillet lies where the volume's distance is only the bound (the geometry is made of it too), and its shares are as smooth as that bound
  const SH = { base: 0, n: 0, idx: new Int32Array(64), s: new Float64Array(64), bmin: Infinity };
  function volume_band(comp, o) { const V = comp.vols[comp.prim[o + 7] | 0]; return (V.band > 0 ? V.band : 4) * V.cell * comp.prim[o + 8]; }
  function share_step(fold, d, dd, ds, op, k, mode, p, trk, wmul, wadd) {               // (ds: the distance the share is made of: dd, or BIG where a volume reads its band's bound)
    if (op === OP_UNION) {
      let w = wmul * k + wadd;
      if (w > SH.bmin) w = SH.bmin;
      let h = ds >= BIG ? 0 : (w > 0 ? 0.5 + 0.5 * (d - ds) / w : (ds < d ? 1 : 0));
      h = h < 0 ? 0 : (h > 1 ? 1 : h);
      if (h > 0) {
        const m = 1 - h;
        SH.base *= m;
        for (let j = 0; j < SH.n; j++) SH.s[j] *= m;
        let j = -1;
        if (p >= 0 && trk[p]) { j = 0; while (j < SH.n && SH.idx[j] !== p) j++; if (j === SH.n) { if (SH.n < SH.idx.length) { SH.idx[j] = p; SH.s[j] = 0; SH.n++; } else j = -1; } }
        if (j >= 0) SH.s[j] += h; else SH.base += h;
      }
    }
    return fold(d, dd, op, k, mode);
  }
  function fold_shares(comp, field, L, ls, le, x, y, z, trk, wmul, wadd, bmin) {
    const P = comp.prim, wdist = field.wdist, fold = field.fold;
    let d = BIG, gid = 0, gd = 0, gds = 0, gop = 0, gk = 0, gmode = 0, gp = -1;
    SH.base = 0; SH.n = 0; SH.bmin = bmin > 0 ? bmin : Infinity;
    for (let j = ls; j < le; j++) {
      const p = L[j], o = p * STRIDE, g = P[o + 14], dd = wdist(o, x, y, z), ds = dd;           // (a volume's band bound is used as it reads: with the width capped by the narrowest band it gives no share near another surface, and on a fillet wider than the band it goes on smoothly; counting it as far broke the share there)
      if (g !== 0 && g === gid) { if (dd < gd) { gd = dd; gds = ds; gp = p; } continue; }
      if (gid !== 0) { d = share_step(fold, d, gd, gds, gop, gk, gmode, gp, trk, wmul, wadd); gid = 0; }
      if (g !== 0) { gid = g; gd = dd; gds = ds; gop = P[o + 1]; gk = P[o + 2]; gmode = P[o + 15]; gp = p; continue; }
      d = share_step(fold, d, dd, ds, P[o + 1], P[o + 2], P[o + 15], p, trk, wmul, wadd);
    }
    if (gid !== 0) share_step(fold, d, gd, gds, gop, gk, gmode, gp, trk, wmul, wadd);
  }
  // the cull lists of the share passes (the grid section's CSR: every primitive that can change a share in a block) and which blocks have a primitive that trk marks
  function share_lists(comp, grid, trk, wmul, wadd) {
    let kmax = 0;
    for (let i = 0; i < comp.n; i++) if (comp.prim[i * STRIDE + 2] > kmax) kmax = comp.prim[i * STRIDE + 2];
    const cell = grid.cell, pad = wmul * kmax + wadd + comp.bmax + cell, csr = build_csr(comp, grid, clamp(Math.round(pad / cell), 4, 16), pad), L = csr.list, hot = new Uint8Array(csr.nblocks);
    for (let b = 0; b < csr.nblocks; b++) for (let j = csr.start[b]; j < csr.start[b + 1]; j++) if (trk[L[j]]) { hot[b] = 1; break; }
    return { csr: csr, hot: hot, bmin: share_band(comp) };
  }
  function share_band(comp) {                                     // the narrowest band of the def's union volumes, in the def's units (the widest a share step may be)
    let b = Infinity;
    for (let i = 0; i < comp.n; i++) { const o = i * STRIDE; if (comp.prim[o] === T_VOLUME && comp.prim[o + 1] === OP_UNION) { const v = volume_band(comp, o); if (v < b) b = v; } }
    return b;
  }

  // what the seam pass sees at a point (a tool for tests and for looking: happy_mesher.skin_probe(def, volumes, [x, y, z], { cell })): the shares of the fold (every primitive that has one, `base` for the parts that
  // follow a bone), the weights each rigged volume's file gives there (by bone name, summing to 1) and their mix by the shares (before the cut to four)
  function skin_probe(def, volumes, p, o) {
    o = o || {};
    const comp = compile(def, { volumes: volumes }), st = comp.settings, field = make_field(comp), sk = comp.skeleton, all = new Int32Array(comp.n), trk = new Uint8Array(comp.n), P = comp.prim;
    for (let i = 0; i < comp.n; i++) { all[i] = i; const q = i * STRIDE; if (P[q] === T_VOLUME && P[q + 1] === OP_UNION && has_skin(comp.vols[P[q + 7] | 0])) trk[i] = 1; }
    const cell = o.cell || st.cell, wmul = st.skin_seam, wadd = st.skin_min_blend > 0 ? st.skin_min_blend : 0.5 * cell;
    fold_shares(comp, field, all, 0, comp.n, p[0], p[1], p[2], trk, wmul, wadd, share_band(comp));
    const out = { base: SH.base, shares: [], sources: [], mix: {} }, info = { folded: {}, dropped: {} };
    for (let j = 0; j < SH.n; j++) out.shares.push({ prim: SH.idx[j], part: comp.parts[P[SH.idx[j] * STRIDE + 3]].id, share: SH.s[j] });
    out.shares.forEach(function (e) {
      if (!sk) return;
      const n = skin_file(comp, e.prim * STRIDE, skin_name_map(comp, e.prim * STRIDE, info), p[0], p[1], p[2]), w = {};
      let rs = 0;
      for (let k = 0; k < n; k++) rs += SK_TW[k];
      for (let k = 0; k < n; k++) { const nm = sk.names[SK_TB[k]]; w[nm] = (w[nm] || 0) + SK_TW[k] / rs; out.mix[nm] = (out.mix[nm] || 0) + e.share * SK_TW[k] / rs; }
      out.sources.push({ part: e.part, prim: e.prim, weights: w });
    });
    out.folded = Object.keys(info.folded); out.dropped = Object.keys(info.dropped);
    return out;
  }

  // the skin of the vertices near a rigged volume. seam > 0 (skin.seam, default 1): the shares of the fold with w = seam * blend + min_blend (half a cell by default) mix the volumes' file weights and the
  // weights the vertex pass gave (the parts that follow a bone: SH.base); a vertex that only one volume has takes its file's weights as they are, one that no volume has keeps the vertex pass's. seam 0: the
  // ownership rule of before (a vertex that a volume owns, by the part ids, takes its weights). A vertex left with no weight keeps what the other passes gave it
  function volume_skin(comp, mesh, vd, grid, ctx) {
    if (!comp.skeleton || !vd.bone_indices || !vd.bone_weights || !has_volume_skin(comp)) return;
    const P = comp.prim, st = comp.settings, pos = mesh.positions, nv = mesh.nv, BI = vd.bone_indices, BW = vd.bone_weights, maps = [], info = { folded: {}, dropped: {} };
    const map_of = function (i) { if (!maps[i]) { maps[i] = skin_name_map(comp, i * STRIDE, info); vd.skin_names = { folded: Object.keys(info.folded), dropped: Object.keys(info.dropped) }; } return maps[i]; };
    if (!(st.skin_seam > 0) || !grid) {
      if (!vd.part_ids) return;
      const vp = comp.vol_prim, ids = vd.part_ids;
      for (let v = 0; v < nv; v++) {
        const cand = vp[ids[v]], x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
        if (!cand || !volume_frame(comp, cand, x, y, z, "skin", LOC)) continue;
        const n = skin_file(comp, LOC.prim * STRIDE, map_of(LOC.prim), x, y, z);
        for (let k = 0; k < n; k++) { SK_B[k] = SK_TB[k]; SK_W[k] = SK_TW[k]; }
        if (n) skin_write(BI, BW, v, n);
      }
      return;
    }
    const trk = new Uint8Array(comp.n);
    let any = false;
    for (let i = 0; i < comp.n; i++) { const o = i * STRIDE; if (P[o] === T_VOLUME && P[o + 1] === OP_UNION && has_skin(comp.vols[P[o + 7] | 0])) { trk[i] = 1; any = true; } }
    if (!any) return;
    const wmul = st.skin_seam, wadd = st.skin_min_blend > 0 ? st.skin_min_blend : 0.5 * grid.cell, sl = share_lists(comp, grid, trk, wmul, wadd), csr = sl.csr, L = csr.list, field = (ctx && ctx.field) || make_field(comp);
    for (let v = 0; v < nv; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], bl = block_of(csr, grid, x, y, z);
      if (!sl.hot[bl]) continue;
      fold_shares(comp, field, L, csr.start[bl], csr.start[bl + 1], x, y, z, trk, wmul, wadd, sl.bmin);
      let srcs = 0, one = -1;
      for (let j = 0; j < SH.n; j++) if (SH.s[j] > 0) { srcs++; one = SH.idx[j]; }
      if (srcs === 0) continue;
      let n = 0;
      if (!(SH.base > 0) && srcs === 1) {                                                       // one volume and nothing else: its weights as they are
        n = skin_file(comp, one * STRIDE, map_of(one), x, y, z);
        for (let k = 0; k < n; k++) { SK_B[k] = SK_TB[k]; SK_W[k] = SK_TW[k]; }
      } else {
        if (SH.base > 0) for (let k = 0; k < 4; k++) { const w = BW[v * 4 + k]; if (w > 0) n = sk_add(n, BI[v * 4 + k], SH.base * w); }
        for (let j = 0; j < SH.n; j++) {
          if (!(SH.s[j] > 0)) continue;
          const i = SH.idx[j], tn = skin_file(comp, i * STRIDE, map_of(i), x, y, z);
          let rs = 0;
          for (let k = 0; k < tn; k++) rs += SK_TW[k];
          if (!(rs > 0)) continue;
          const f = SH.s[j] / rs;
          for (let k = 0; k < tn; k++) n = sk_add(n, SK_TB[k], f * SK_TW[k]);
        }
      }
      if (n) skin_write(BI, BW, v, n);
    }
  }

  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // bake - a triangle mesh (a glTF character) to a volume.
  //
  //   const vol = happy_mesher.bake_mesh(mesh, opts)
  //   mesh = { positions: Float32Array (3 per vertex), indices: Uint32Array (3 per triangle: counter clockwise from outside), and, all optional, what the colours are made of:
  //            colors: Float32Array (4 per vertex, linear: the material's colour times COLOR_0), uvs: Float32Array (2 per vertex), material_ids: Uint16Array (per vertex),
  //            material_texture: Int32Array (per material: the index in `textures`, or -1), textures: [{ width, height, data: Uint8Array | Uint8ClampedArray (RGBA, sRGB) }],
  //            and the skin: joints (Uint8Array | Uint16Array, 4 per vertex: an index in joint_names), weights (Float32Array, 4 per vertex), joint_names: [the bones' names] - kept with the volume, see the skin section }
  //   opts = { id (the volume's name), cell (the grid step: the mesh's longest side / 200), band: 4 (cells either side of the surface where the distance is exact), max_voxels: 12 M (the cell grows
  //            to fit), cap: true (nearly closed pieces are closed: below), cap_max: 0.05, sheet: 1.6 (the thickness, in cells, of what is not closed), flat: 0.33 (a closed shell thinner than that many cells,
  //            3 V / A, holds no volume the grid can see: it is a sheet too; a thin piece of the parts catalogue is baked with 1.5, a coherent sheet), decimate: undefined | true (as much as the grid can
  //            use) | false | n (triangles) | { triangles, error, max_edge }, progress: function (stage, fraction) }
  //
  // HOW. The vertices are welded (a glTF mesh is split at every uv seam), the pieces ("shells": the connected triangles) found. A closed shell is a SOLID: its sign is the angle weighted pseudo
  // normal of the nearest feature (Baerentzen and Aanaes), exact for a closed manifold; the voxels farther than the band are signed by flood fill (a component of far voxels takes the sign of the
  // band voxels it touches). Every shell is its own field and the fields are united: the joints of a mannequin are closed shells that overlap, and one nearest triangle for all of them would give
  // them each other's sign. A shell that is nearly closed (the boundary is under cap_max of its edges: a shirt open at the neck, the cuffs and the hem) is CLOSED first, every hole with a fan to
  // the middle of its rim, and is then a solid too. What is left, open, is a SHEET (hair cards, foliage, a flap): its unsigned distance minus half `sheet` cells, a thin solid. Real characters are
  // 96 - 99 % open shells: without the capping a jacket would come out as a thin skin.
  // PRE-DECIMATION. The distance is taken from a simplified copy (the decimate section's edge collapse, no field behind it, so `error` bounds the shape: 0.25 cell) when the mesh is denser than the
  // grid can use (a triangle a cell or two across): the bake costs as many distance tests as there are triangles. The colours always come from the original triangles.
  // THE SHELLS OF REAL FILES. A closed shell with a NEGATIVE signed volume is inside out (a part that a rig mirrored): its triangles are turned over. One that holds no volume (3 V / A under a third of a cell: a flat piece
  // of four triangles, an eyelash) has no inside to find, its voxels would take any sign and a whole box of them "inside": it is a sheet.
  // COLOURS. In every voxel within 2.5 cells of the surface: the colour at the nearest point of the ORIGINAL surface (the vertex colours interpolated, times the texture at the interpolated uv,
  // bilinear, repeating): the detail of a texture survives as far as the grid has it. Stored sparse (a sorted list of the voxels that have one: a few percent of the grid).
  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const bq = [0, 0, 0];                                           // the point bk_closest found

  // the closest point of triangle abc to p (Ericson, Real-Time Collision Detection 5.1.5) in bq; the feature it lies on: 0 the face, 1 a, 2 b, 3 c, 4 the edge ab, 5 bc, 6 ca
  function bk_closest(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
    const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az, apx = px - ax, apy = py - ay, apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
    if (d1 <= 0 && d2 <= 0) { bq[0] = ax; bq[1] = ay; bq[2] = az; return 1; }
    const bpx = px - bx, bpy = py - by, bpz = pz - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { bq[0] = bx; bq[1] = by; bq[2] = bz; return 2; }
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); bq[0] = ax + abx * v; bq[1] = ay + aby * v; bq[2] = az + abz * v; return 4; }
    const cpx = px - cx, cpy = py - cy, cpz = pz - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    if (d6 >= 0 && d5 <= d6) { bq[0] = cx; bq[1] = cy; bq[2] = cz; return 3; }
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); bq[0] = ax + acx * w; bq[1] = ay + acy * w; bq[2] = az + acz * w; return 6; }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); bq[0] = bx + (cx - bx) * w; bq[1] = by + (cy - by) * w; bq[2] = bz + (cz - bz) * w; return 5; }
    const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
    bq[0] = ax + abx * v + acx * w; bq[1] = ay + aby * v + acy * w; bq[2] = az + abz * v + acz * w;
    return 0;
  }
  function bk_dist2(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
    bk_closest(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz);
    const dx = px - bq[0], dy = py - bq[1], dz = pz - bq[2];
    return dx * dx + dy * dy + dz * dz;
  }

  // the vertices welded (the same place within tol is one vertex) and the triangles that have an area -> { V: Float64Array, T: Int32Array (welded indices), src: Int32Array (the triangle it was), map: old vertex -> welded }
  function bk_weld(P, I, tol) {
    const nv = (P.length / 3) | 0, map = new Int32Array(nv), key = new Map(), V = [], inv = 1 / tol;
    for (let i = 0; i < nv; i++) {
      const k = Math.round(P[i * 3] * inv) + "," + Math.round(P[i * 3 + 1] * inv) + "," + Math.round(P[i * 3 + 2] * inv);
      let w = key.get(k);
      if (w === undefined) { w = V.length / 3; key.set(k, w); V.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); }
      map[i] = w;
    }
    const nt = (I.length / 3) | 0, T = [], src = [];
    for (let t = 0; t < nt; t++) {
      const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
      if (a >= nv || b >= nv || c >= nv) fail("bake: an index of the mesh is past its last vertex");
      const wa = map[a], wb = map[b], wc = map[c];
      if (wa === wb || wb === wc || wa === wc) continue;
      T.push(wa, wb, wc); src.push(t);
    }
    return { V: Float64Array.from(V), T: Int32Array.from(T), src: Int32Array.from(src), map: map };
  }

  // the shells of a welded mesh (the connected triangles): per triangle its shell, per shell its triangles, its edges and the edges only one triangle has (the rim of a hole)
  function bk_shells(nvert, T) {
    const nt = T.length / 3, par = new Int32Array(nvert);
    for (let i = 0; i < nvert; i++) par[i] = i;
    const find = function (a) { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    for (let t = 0; t < nt; t++) { const a = find(T[t * 3]), b = find(T[t * 3 + 1]), c = find(T[t * 3 + 2]); if (b !== a) par[b] = a; const c2 = find(c); if (c2 !== find(a)) par[c2] = find(a); }
    const id = new Int32Array(nvert).fill(-1), shell_of = new Int32Array(nt);
    let ns = 0;
    for (let t = 0; t < nt; t++) { const r = find(T[t * 3]); if (id[r] < 0) id[r] = ns++; shell_of[t] = id[r]; }
    const edge = new Map(), bnd = new Int32Array(ns), edges = new Int32Array(ns), tris = new Int32Array(ns);
    for (let t = 0; t < nt; t++) {
      tris[shell_of[t]]++;
      for (let k = 0; k < 3; k++) { const a = T[t * 3 + k], b = T[t * 3 + (k + 1) % 3], key = (a < b ? a : b) * nvert + (a < b ? b : a); edge.set(key, (edge.get(key) || 0) + 1); }
    }
    for (let t = 0; t < nt; t++) {
      const s = shell_of[t];
      for (let k = 0; k < 3; k++) {
        const a = T[t * 3 + k], b = T[t * 3 + (k + 1) % 3], key = (a < b ? a : b) * nvert + (a < b ? b : a), n = edge.get(key);
        if (n === 1) { bnd[s]++; edges[s]++; } else if (a < b) edges[s]++;                 // (an edge with two faces is counted once: from the side where a < b)
      }
    }
    return { shell_of: shell_of, count: ns, bnd: bnd, edges: edges, tris: tris };
  }

  // the holes of the shells that are nearly closed (the rim is under `ratio` of their edges) closed with a fan from the middle of each rim (the rims of one shell that touch are one hole).
  // -> { V, T (with the fans), caps (fans made), shells (shells that got one), triangles (added) }
  function bk_cap(V, T, sh, ratio) {
    const nt = T.length / 3, nvert = V.length / 3, cnt = new Map(), dirs = [];
    for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
      const a = T[t * 3 + k], b = T[t * 3 + (k + 1) % 3], key = (a < b ? a : b) * nvert + (a < b ? b : a);
      cnt.set(key, (cnt.get(key) || 0) + 1);
      dirs.push(a, b, key, t);
    }
    const par = new Map(), find = function (a) { let r = a; while (par.get(r) !== r) r = par.get(r); while (par.get(a) !== r) { const n = par.get(a); par.set(a, r); a = n; } return r; };
    const rim = [];
    for (let i = 0; i < dirs.length; i += 4) {
      const s = sh.shell_of[dirs[i + 3]];
      if (cnt.get(dirs[i + 2]) !== 1 || sh.bnd[s] > ratio * sh.edges[s]) continue;
      rim.push(dirs[i], dirs[i + 1], s);
      if (!par.has(dirs[i])) par.set(dirs[i], dirs[i]);
      if (!par.has(dirs[i + 1])) par.set(dirs[i + 1], dirs[i + 1]);
    }
    for (let i = 0; i < rim.length; i += 3) { const a = find(rim[i]), b = find(rim[i + 1]); if (a !== b) par.set(a, b); }
    const holes = new Map(), capped = new Set();
    for (let i = 0; i < rim.length; i += 3) {
      const r = find(rim[i]);
      let h = holes.get(r);
      if (!h) { h = { verts: new Set(), edges: [] }; holes.set(r, h); }
      h.verts.add(rim[i]); h.verts.add(rim[i + 1]); h.edges.push(rim[i], rim[i + 1]);
      capped.add(rim[i + 2]);
    }
    const nv2 = [], nt2 = [];
    holes.forEach(function (h) {
      let cx = 0, cy = 0, cz = 0;
      h.verts.forEach(function (w) { cx += V[w * 3]; cy += V[w * 3 + 1]; cz += V[w * 3 + 2]; });
      const n = h.verts.size, c = nvert + nv2.length / 3;
      nv2.push(cx / n, cy / n, cz / n);
      for (let i = 0; i < h.edges.length; i += 2) nt2.push(h.edges[i + 1], h.edges[i], c);          // the rim edge a -> b of a face is b -> a in the fan: the fan closes the surface
    });
    const V2 = new Float64Array(V.length + nv2.length), T2 = new Int32Array(T.length + nt2.length);
    V2.set(V); V2.set(nv2, V.length); T2.set(T); T2.set(nt2, T.length);
    return { V: V2, T: T2, caps: holes.size, shells: capped.size, triangles: nt2.length / 3 };
  }

  function bk_area(V, T) {
    let a = 0;
    for (let t = 0; t < T.length; t += 3) {
      const i = T[t] * 3, j = T[t + 1] * 3, k = T[t + 2] * 3, ux = V[j] - V[i], uy = V[j + 1] - V[i + 1], uz = V[j + 2] - V[i + 2], vx = V[k] - V[i], vy = V[k + 1] - V[i + 1], vz = V[k + 2] - V[i + 2];
      a += 0.5 * Math.sqrt((uy * vz - uz * vy) * (uy * vz - uz * vy) + (uz * vx - ux * vz) * (uz * vx - ux * vz) + (ux * vy - uy * vx) * (ux * vy - uy * vx));
    }
    return a;
  }

  // pseudo normals of a welded mesh: per face (unit), per vertex (the faces' normals weighted by their angle there), per edge (the sum of its two faces): te[t * 3 + k] is the edge of triangle t from corner k to k + 1
  function bk_normals(V, T) {
    const nt = T.length / 3, nvert = V.length / 3, FN = new Float64Array(nt * 3), VN = new Float64Array(nvert * 3), edge = new Map(), te = new Int32Array(nt * 3), EN = [];
    for (let t = 0; t < nt; t++) {
      const a = T[t * 3], b = T[t * 3 + 1], c = T[t * 3 + 2];
      const ux = V[b * 3] - V[a * 3], uy = V[b * 3 + 1] - V[a * 3 + 1], uz = V[b * 3 + 2] - V[a * 3 + 2], vx = V[c * 3] - V[a * 3], vy = V[c * 3 + 1] - V[a * 3 + 1], vz = V[c * 3 + 2] - V[a * 3 + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= l; ny /= l; nz /= l;
      FN[t * 3] = nx; FN[t * 3 + 1] = ny; FN[t * 3 + 2] = nz;
      for (let k = 0; k < 3; k++) {
        const p = T[t * 3 + k], n1 = T[t * 3 + (k + 1) % 3], n2 = T[t * 3 + (k + 2) % 3];
        const e1x = V[n1 * 3] - V[p * 3], e1y = V[n1 * 3 + 1] - V[p * 3 + 1], e1z = V[n1 * 3 + 2] - V[p * 3 + 2], e2x = V[n2 * 3] - V[p * 3], e2y = V[n2 * 3 + 1] - V[p * 3 + 1], e2z = V[n2 * 3 + 2] - V[p * 3 + 2];
        const dd = (e1x * e2x + e1y * e2y + e1z * e2z) / ((Math.sqrt(e1x * e1x + e1y * e1y + e1z * e1z) * Math.sqrt(e2x * e2x + e2y * e2y + e2z * e2z)) || 1), ang = Math.acos(dd < -1 ? -1 : (dd > 1 ? 1 : dd));
        VN[p * 3] += ang * nx; VN[p * 3 + 1] += ang * ny; VN[p * 3 + 2] += ang * nz;
        const key = (p < n1 ? p : n1) * nvert + (p < n1 ? n1 : p);
        let e = edge.get(key);
        if (e === undefined) { e = EN.length / 3; edge.set(key, e); EN.push(0, 0, 0); }
        EN[e * 3] += nx; EN[e * 3 + 1] += ny; EN[e * 3 + 2] += nz;
        te[t * 3 + k] = e;
      }
    }
    const norm = function (A) { for (let i = 0; i < A.length; i += 3) { const l = Math.sqrt(A[i] * A[i] + A[i + 1] * A[i + 1] + A[i + 2] * A[i + 2]) || 1; A[i] /= l; A[i + 1] /= l; A[i + 2] /= l; } return A; };
    return { FN: FN, VN: norm(VN), EN: norm(Float64Array.from(EN)), te: te };
  }

  // the field of one shell (a list of triangles) inside a box of the grid, united into ctx.data: for every voxel within the band of a triangle the nearest one and its distance; a solid's sign
  // from the pseudo normal of the nearest feature, the voxels beyond the band by flood fill (a component takes the sign of the band voxels it touches; the box's border is outside); a sheet's
  // distance is unsigned minus half its thickness. box: { x0, y0, z0, nx, ny, nz } in the grid's voxels
  function bk_field(ctx, list, mode, thickness, box) {
    const V = ctx.V, T = ctx.T, PN = ctx.PN, cell = ctx.cell, bd = ctx.bd, gx = ctx.nx, gy = ctx.ny, ox = ctx.ox, oy = ctx.oy, oz = ctx.oz, data = ctx.data;
    const bx = box.x0, by = box.y0, bz = box.z0, nx = box.nx, ny = box.ny, nz = box.nz, nvox = nx * ny * nz, inv = 1 / cell, b2 = bd * bd;
    const d2 = new Float32Array(nvox).fill(Infinity), tri = new Int32Array(nvox).fill(-1);
    for (let li = 0; li < list.length; li++) {
      const t = list[li], a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3;
      const ax = V[a], ay = V[a + 1], az = V[a + 2], bxx = V[b], byy = V[b + 1], bzz = V[b + 2], cx = V[c], cy = V[c + 1], cz = V[c + 2];
      const x0 = Math.max(0, Math.floor((Math.min(ax, bxx, cx) - bd - ox) * inv) - bx), x1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bxx, cx) + bd - ox) * inv) - bx);
      const y0 = Math.max(0, Math.floor((Math.min(ay, byy, cy) - bd - oy) * inv) - by), y1 = Math.min(ny - 1, Math.ceil((Math.max(ay, byy, cy) + bd - oy) * inv) - by);
      const z0 = Math.max(0, Math.floor((Math.min(az, bzz, cz) - bd - oz) * inv) - bz), z1 = Math.min(nz - 1, Math.ceil((Math.max(az, bzz, cz) + bd - oz) * inv) - bz);
      for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) {
        let k = x0 + nx * (y + ny * z);
        for (let x = x0; x <= x1; x++, k++) {
          const d = bk_dist2(ox + (bx + x) * cell, oy + (by + y) * cell, oz + (bz + z) * cell, ax, ay, az, bxx, byy, bzz, cx, cy, cz);
          if (d < d2[k] && d < b2) { d2[k] = d; tri[k] = t; }
        }
      }
      ctx.tests += (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);
    }
    const put = function (x, y, z, v) { const g = (bx + x) + gx * ((by + y) + gy * (bz + z)); if (v < data[g]) data[g] = v; };
    if (mode === "sheet") {
      const half = (thickness || 1.5 * cell) * 0.5;
      for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) { let k = nx * (y + ny * z); for (let x = 0; x < nx; x++, k++) if (tri[k] >= 0) put(x, y, z, Math.sqrt(d2[k]) - half); }
      return 0;
    }
    const sgn = new Int8Array(nvox);                                                                   // 0 far, +1 outside, -1 inside
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) {
      let k = nx * (y + ny * z);
      for (let x = 0; x < nx; x++, k++) {
        const t = tri[k];
        if (t < 0) continue;
        const a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3, px = ox + (bx + x) * cell, py = oy + (by + y) * cell, pz = oz + (bz + z) * cell;
        const f = bk_closest(px, py, pz, V[a], V[a + 1], V[a + 2], V[b], V[b + 1], V[b + 2], V[c], V[c + 1], V[c + 2]);
        let nxx, nyy, nzz;
        if (f === 0) { nxx = PN.FN[t * 3]; nyy = PN.FN[t * 3 + 1]; nzz = PN.FN[t * 3 + 2]; }
        else if (f <= 3) { const v = T[t * 3 + f - 1]; nxx = PN.VN[v * 3]; nyy = PN.VN[v * 3 + 1]; nzz = PN.VN[v * 3 + 2]; }
        else { const e = PN.te[t * 3 + (f === 4 ? 0 : (f === 5 ? 1 : 2))]; nxx = PN.EN[e * 3]; nyy = PN.EN[e * 3 + 1]; nzz = PN.EN[e * 3 + 2]; }
        sgn[k] = (px - bq[0]) * nxx + (py - bq[1]) * nyy + (pz - bq[2]) * nzz >= 0 ? 1 : -1;
      }
    }
    const seen = new Uint8Array(nvox), queue = new Int32Array(nvox), sy = nx, sz = nx * ny;
    let leaky = 0;
    for (let s0 = 0; s0 < nvox; s0++) {
      if (sgn[s0] !== 0 || seen[s0] !== 0) continue;
      let head = 0, tail = 0, pos = 0, neg = 0;
      queue[tail++] = s0; seen[s0] = 1;
      while (head < tail) {
        const k = queue[head++], x = k % nx, y = ((k / nx) | 0) % ny, z = (k / sz) | 0;
        for (let n = 0; n < 6; n++) {
          const m = n === 0 ? (x > 0 ? k - 1 : -1) : n === 1 ? (x < nx - 1 ? k + 1 : -1) : n === 2 ? (y > 0 ? k - sy : -1) : n === 3 ? (y < ny - 1 ? k + sy : -1) : n === 4 ? (z > 0 ? k - sz : -1) : (z < nz - 1 ? k + sz : -1);
          if (m < 0) continue;
          if (sgn[m] === 0) { if (seen[m] === 0) { seen[m] = 1; queue[tail++] = m; } }
          else if (sgn[m] > 0) pos++; else neg++;
        }
      }
      if (pos > 0 && neg > 0 && (pos < neg ? pos : neg) > 0.02 * (pos + neg)) leaky++;               // (the voxels round it do not agree: a hole the cap did not close)
      if (neg > pos) for (let i = 0; i < tail; i++) { const k = queue[i]; put(k % nx, ((k / nx) | 0) % ny, (k / sz) | 0, -bd); }
    }
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) { let k = nx * (y + ny * z); for (let x = 0; x < nx; x++, k++) if (tri[k] >= 0) put(x, y, z, sgn[k] * Math.sqrt(d2[k])); }
    return leaky;
  }

  // the texture at (u, v), bilinear, repeating, in LINEAR light -> out[0..2] (the picture is sRGB bytes, RGBA; v runs down the picture's rows, as glTF's does)
  function bk_texture(tex, u, v, out) {
    const w = tex.width, h = tex.height, d = tex.data;
    let fx = (u - Math.floor(u)) * w - 0.5, fy = (v - Math.floor(v)) * h - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    fx -= x0; fy -= y0;
    const xa = ((x0 % w) + w) % w, xb = (xa + 1) % w, ya = ((y0 % h) + h) % h, yb = (ya + 1) % h;
    const i00 = (ya * w + xa) * 4, i10 = (ya * w + xb) * 4, i01 = (yb * w + xa) * 4, i11 = (yb * w + xb) * 4;
    for (let c = 0; c < 3; c++) {
      const a = SRGB_TO_LIN[d[i00 + c]] + (SRGB_TO_LIN[d[i10 + c]] - SRGB_TO_LIN[d[i00 + c]]) * fx, b = SRGB_TO_LIN[d[i01 + c]] + (SRGB_TO_LIN[d[i11 + c]] - SRGB_TO_LIN[d[i01 + c]]) * fx;
      out[c] = a + (b - a) * fy;
    }
  }

  // the colours of the voxels near the SURFACE OF THE ORIGINAL MESH (not the simplified one the distances came from): the nearest triangle of every voxel within `reach` cells, then its colour there
  function bk_colors(mesh, P, I, grid, reach, tick) {
    const nt = (I.length / 3) | 0, nx = grid.nx, ny = grid.ny, nz = grid.nz, nvox = nx * ny * nz, cell = grid.cell, ox = grid.ox, oy = grid.oy, oz = grid.oz, inv = 1 / cell, rr = reach * cell, r2 = rr * rr;
    const best = new Float32Array(nvox).fill(Infinity), tri = new Int32Array(nvox).fill(-1);
    for (let t = 0; t < nt; t++) {
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3, ax = P[a], ay = P[a + 1], az = P[a + 2], bx = P[b], by = P[b + 1], bz = P[b + 2], cx = P[c], cy = P[c + 1], cz = P[c + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az, cxx = uy * vz - uz * vy, cyy = uz * vx - ux * vz, czz = ux * vy - uy * vx;
      if (cxx * cxx + cyy * cyy + czz * czz < 1e-24) continue;
      const x0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - rr - ox) * inv)), x1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx, cx) + rr - ox) * inv));
      const y0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - rr - oy) * inv)), y1 = Math.min(ny - 1, Math.ceil((Math.max(ay, by, cy) + rr - oy) * inv));
      const z0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - rr - oz) * inv)), z1 = Math.min(nz - 1, Math.ceil((Math.max(az, bz, cz) + rr - oz) * inv));
      for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) {
        let k = x0 + nx * (y + ny * z);
        for (let x = x0; x <= x1; x++, k++) {
          const d = bk_dist2(ox + x * cell, oy + y * cell, oz + z * cell, ax, ay, az, bx, by, bz, cx, cy, cz);
          if (d < best[k] && d < r2) { best[k] = d; tri[k] = t; }
        }
      }
      if ((t & 4095) === 0 && tick) tick(t / nt);
    }
    let n = 0;
    for (let k = 0; k < nvox; k++) if (tri[k] >= 0) n++;
    const keys = new Uint32Array(n), rgba = new Uint8Array(n * 4), C = mesh.colors, UV = mesh.uvs, MID = mesh.material_ids, MT = mesh.material_texture, TX = mesh.textures || [], tl = [0, 0, 0];
    let j = 0;
    for (let k = 0; k < nvox; k++) {
      const t = tri[k];
      if (t < 0) continue;
      const i0 = I[t * 3], i1 = I[t * 3 + 1], i2 = I[t * 3 + 2], a = i0 * 3, b = i1 * 3, c = i2 * 3, x = k % nx, y = ((k / nx) | 0) % ny, z = (k / (nx * ny)) | 0;
      bk_closest(ox + x * cell, oy + y * cell, oz + z * cell, P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2]);
      const abx = P[b] - P[a], aby = P[b + 1] - P[a + 1], abz = P[b + 2] - P[a + 2], acx = P[c] - P[a], acy = P[c + 1] - P[a + 1], acz = P[c + 2] - P[a + 2], apx = bq[0] - P[a], apy = bq[1] - P[a + 1], apz = bq[2] - P[a + 2];
      const d00 = abx * abx + aby * aby + abz * abz, d01 = abx * acx + aby * acy + abz * acz, d11 = acx * acx + acy * acy + acz * acz, d20 = apx * abx + apy * aby + apz * abz, d21 = apx * acx + apy * acy + apz * acz, den = d00 * d11 - d01 * d01 || 1;
      let w1 = (d11 * d20 - d01 * d21) / den, w2 = (d00 * d21 - d01 * d20) / den, w0 = 1 - w1 - w2;
      w0 = w0 < 0 ? 0 : w0; w1 = w1 < 0 ? 0 : w1; w2 = w2 < 0 ? 0 : w2;
      const ws = w0 + w1 + w2 || 1;
      w0 /= ws; w1 /= ws; w2 /= ws;
      let r = 1, g = 1, bl = 1, al = 1;
      if (C) { r = w0 * C[i0 * 4] + w1 * C[i1 * 4] + w2 * C[i2 * 4]; g = w0 * C[i0 * 4 + 1] + w1 * C[i1 * 4 + 1] + w2 * C[i2 * 4 + 1]; bl = w0 * C[i0 * 4 + 2] + w1 * C[i1 * 4 + 2] + w2 * C[i2 * 4 + 2]; al = w0 * C[i0 * 4 + 3] + w1 * C[i1 * 4 + 3] + w2 * C[i2 * 4 + 3]; }
      if (UV && MT && TX.length) {
        const m = MID ? MID[i0] : 0, ti = m < MT.length ? MT[m] : -1;
        if (ti >= 0 && TX[ti]) { bk_texture(TX[ti], w0 * UV[i0 * 2] + w1 * UV[i1 * 2] + w2 * UV[i2 * 2], w0 * UV[i0 * 2 + 1] + w1 * UV[i1 * 2 + 1] + w2 * UV[i2 * 2 + 1], tl); r *= tl[0]; g *= tl[1]; bl *= tl[2]; }
      }
      keys[j] = k; rgba[j * 4] = lin_to_srgb8(r); rgba[j * 4 + 1] = lin_to_srgb8(g); rgba[j * 4 + 2] = lin_to_srgb8(bl); rgba[j * 4 + 3] = Math.round(255 * (al < 0 ? 0 : (al > 1 ? 1 : al)));
      j++;
    }
    return { keys: keys, rgba: rgba };
  }

  // the file's skin packed to travel with the volume (see the skin section): its vertices, triangles, and the four strongest joints of every vertex with their weights as bytes (the sum is 255); and, when the mesh
  // gives `joint_parents` (for every name the index of the name above it, -1 none: a piece's anchor chain, @host:2 > @host:1 > @host, an outside bone > the anchor above it), `parents`: a name the creature has no
  // bone for is resolved along it (skin_name_map)
  function bk_skin_pack(P, I, mesh) {
    const names = mesh.joint_names, J = mesh.joints, Wt = mesh.weights, nv = (P.length / 3) | 0;
    if (!Array.isArray(names) || !names.length) fail("bake: a skin needs joint_names (the bones' names)");
    if (names.length > 255) fail("bake: at most 255 joints (" + names.length + ")");
    if (!J || !Wt || J.length !== nv * 4 || Wt.length !== nv * 4) fail("bake: joints and weights need 4 numbers per vertex");
    const jp = mesh.joint_parents;
    if (jp !== undefined && jp !== null && !skin_parents_ok(jp, names.length)) fail("bake: joint_parents is the index of the name above every name (-1: none), as many as joint_names, with no cycle");
    const Pj = new Float32Array(nv * 3), Jo = new Uint8Array(nv * 4), W = new Uint8Array(nv * 4), Io = new Uint32Array(I.length);
    for (let i = 0; i < nv * 3; i++) Pj[i] = P[i];
    for (let i = 0; i < I.length; i++) Io[i] = I[i];
    for (let v = 0; v < nv; v++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) { const w = Wt[v * 4 + k], j = J[v * 4 + k]; if (w > 0 && j >= 0 && j < names.length) sum += w; }
      if (!(sum > 0)) { W[v * 4] = 255; continue; }                                         // (a vertex with no weight at all: all of it on the first joint)
      let tot = 0, big = 0;
      for (let k = 0; k < 4; k++) {
        const w = Wt[v * 4 + k], j = J[v * 4 + k];
        if (!(w > 0 && j >= 0 && j < names.length)) continue;
        const q = Math.round(255 * w / sum);
        W[v * 4 + k] = q; Jo[v * 4 + k] = j; tot += q;
        if (q > W[v * 4 + big]) big = k;
      }
      W[v * 4 + big] += 255 - tot;
    }
    const out = { names: names.slice(), P: Pj, I: Io, J: Jo, W: W };
    if (jp !== undefined && jp !== null) out.parents = Array.from(jp, function (x) { return x | 0; });
    return out;
  }
  // is `p` a chain over n names: an index of another name (or -1) for each, and no cycle?
  function skin_parents_ok(p, n) {
    if (!p || typeof p.length !== "number" || p.length !== n) return false;
    for (let i = 0; i < n; i++) { const x = p[i]; if (x !== -1 && !(x >= 0 && x < n && x === Math.floor(x) && x !== i)) return false; }
    for (let i = 0; i < n; i++) { let k = i, s = 0; while (k >= 0 && s <= n) { k = p[k]; s++; } if (s > n) return false; }
    return true;
  }

  function bake_mesh(mesh, opts) {
    opts = opts || {};
    const T0 = now(), ms = { weld: 0, shells: 0, cap: 0, decimate: 0, distance: 0, colors: 0, skin: 0, total: 0 }, stats = { ms: ms }, tick = typeof opts.progress === "function" ? opts.progress : function () { };
    const P = mesh && mesh.positions, I = mesh && mesh.indices;
    if (!P || !I || P.length < 9 || I.length < 3) fail("bake: the mesh needs positions and indices (at least one triangle)");
    const nv0 = (P.length / 3) | 0;
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < nv0; i++) for (let k = 0; k < 3; k++) { const p = P[i * 3 + k]; if (!isFinite(p)) fail("bake: a position of the mesh is not a number"); if (p < mn[k]) mn[k] = p; if (p > mx[k]) mx[k] = p; }
    const size = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
    if (!(size > 0)) fail("bake: the mesh has no size");
    let cell = opts.cell !== undefined ? finite(opts.cell, "bake: cell") : size / 200;
    if (!(cell > size * 1e-5)) fail("bake: the cell is too small for this mesh (" + cell + " for a mesh " + size + " across)");
    const band = opts.band > 0 ? opts.band : 4, pad = band + 2, max_vox = opts.max_voxels > 0 ? opts.max_voxels : 12000000, sheet = opts.sheet > 0 ? opts.sheet : 1.6, flat_cells = opts.flat > 0 ? opts.flat : 0.33;          // (flat: a closed shell thinner than that many cells, 3 V / A, is made a sheet)
    let nx = 0, ny = 0, nz = 0, coarsened = false;
    for (let guard = 0; guard < 60; guard++) {
      nx = Math.ceil((mx[0] - mn[0]) / cell) + 2 * pad + 1; ny = Math.ceil((mx[1] - mn[1]) / cell) + 2 * pad + 1; nz = Math.ceil((mx[2] - mn[2]) / cell) + 2 * pad + 1;
      if (nx * ny * nz <= max_vox) break;
      cell *= Math.pow(nx * ny * nz / max_vox, 1 / 3) * 1.01; coarsened = true;
    }
    stats.cell = cell; stats.requested_cell = opts.cell !== undefined ? opts.cell : size / 200; stats.coarsened = coarsened; stats.grid = [nx, ny, nz];
    // 1. weld, 2. shells, 3. cap the nearly closed ones
    let t = now();
    tick("weld", 0);
    const W = bk_weld(P, I, size * 1e-5);
    let V = W.V, T = W.T;
    if (T.length < 3) fail("bake: the mesh has no triangle with an area");
    stats.source = { vertices: nv0, triangles: (I.length / 3) | 0, welded_vertices: V.length / 3, triangles_with_area: T.length / 3 };
    ms.weld = now() - t; t = now();
    let sh = bk_shells(V.length / 3, T);
    stats.shells = { total: sh.count, closed: 0, capped: 0, holes: 0, cap_triangles: 0, sheets: 0 };
    for (let s = 0; s < sh.count; s++) if (sh.bnd[s] === 0) stats.shells.closed++;
    ms.shells = now() - t; t = now();
    if (opts.cap !== false) {
      tick("cap", 0);
      const cp = bk_cap(V, T, sh, opts.cap_max > 0 ? opts.cap_max : 0.05);
      if (cp.caps > 0) { V = cp.V; T = cp.T; stats.shells.capped = cp.shells; stats.shells.holes = cp.caps; stats.shells.cap_triangles = cp.triangles; }
    }
    ms.cap = now() - t; t = now();
    // 4. simplify (the distances only: the colours come from the original triangles)
    const area = bk_area(V, T), nt_all = T.length / 3;
    let dec = opts.decimate, target = 0, err = 0.25 * cell, maxe = 24 * cell;
    if (dec === undefined || dec === true) target = Math.max(2000, Math.floor(area / (cell * cell) * 0.5));
    else if (typeof dec === "number" && dec > 0) target = Math.floor(dec);
    else if (dec && typeof dec === "object") { target = dec.triangles > 0 ? Math.floor(dec.triangles) : Math.max(2000, Math.floor(area / (cell * cell) * 0.5)); if (dec.error > 0) err = dec.error; if (dec.max_edge > 0) maxe = dec.max_edge; }
    stats.decimate = { from: nt_all, to: nt_all, target: target, error: err, stopped: "not asked" };
    if (target > 0 && nt_all > 1.3 * target) {
      tick("decimate", 0);
      const r = decimate_mesh({ positions: Float32Array.from(V), nv: V.length / 3, indices: Uint32Array.from(T), ni: T.length }, { triangles: target, ratio: 0, error: err, max_edge: maxe, min_quality: 0.1, project: false }, cell, cell, null);
      V = Float64Array.from(r.positions.subarray(0, r.nv * 3)); T = Int32Array.from(r.indices.subarray(0, r.ni));
      stats.decimate = { from: nt_all, to: T.length / 3, target: target, error: err, stopped: r.stats.stopped };
    } else if (target > 0) stats.decimate.stopped = "the mesh is not denser than the grid can use";
    ms.decimate = now() - t; t = now();
    // 5. the distances: the solids (every closed shell its own field), the sheets (one field)
    sh = bk_shells(V.length / 3, T);
    // a closed shell has an inside only when it holds a volume: its signed volume says which way it faces (negative: inside out, a part that a rig mirrored: its triangles are turned over) and, with
    // its area, how thick it is (3 V / A: a sphere's radius). One thinner than a third of a cell (a flat piece of four triangles, a fin) has no inside to find: it is a sheet like the open ones
    const svol = new Float64Array(sh.count), sarea = new Float64Array(sh.count), flat = new Uint8Array(sh.count);
    for (let k = 0, m = T.length / 3; k < m; k++) {
      const a = T[k * 3] * 3, b = T[k * 3 + 1] * 3, c = T[k * 3 + 2] * 3, s = sh.shell_of[k];
      const cxx = V[b + 1] * V[c + 2] - V[b + 2] * V[c + 1], cyy = V[b + 2] * V[c] - V[b] * V[c + 2], czz = V[b] * V[c + 1] - V[b + 1] * V[c];
      svol[s] += (V[a] * cxx + V[a + 1] * cyy + V[a + 2] * czz) / 6;
      const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
      sarea[s] += 0.5 * Math.sqrt((uy * vz - uz * vy) * (uy * vz - uz * vy) + (uz * vx - ux * vz) * (uz * vx - ux * vz) + (ux * vy - uy * vx) * (ux * vy - uy * vx));
    }
    let n_flat = 0, n_flipped = 0;
    const flat_info = [];
    for (let s = 0; s < sh.count; s++) {
      if (sh.bnd[s] !== 0) continue;
      if (!(3 * Math.abs(svol[s]) >= flat_cells * cell * sarea[s])) { flat[s] = 1; n_flat++; flat_info.push({ area: sarea[s], thickness_cells: sarea[s] > 0 ? 3 * Math.abs(svol[s]) / sarea[s] / cell : 0 }); }
      else if (svol[s] < 0) { svol[s] = -svol[s]; n_flipped++; flat[s] = 2; }
    }
    flat_info.sort(function (a, b) { return b.area - a.area; }); flat_info.length = Math.min(flat_info.length, 8);
    if (n_flipped) for (let k = 0, m = T.length / 3; k < m; k++) if (flat[sh.shell_of[k]] === 2) { const x = T[k * 3 + 1]; T[k * 3 + 1] = T[k * 3 + 2]; T[k * 3 + 2] = x; }
    const ox = mn[0] - pad * cell, oy = mn[1] - pad * cell, oz = mn[2] - pad * cell, bd = band * cell, nvox = nx * ny * nz, data = new Float32Array(nvox).fill(bd);
    const ctx = { V: V, T: T, PN: bk_normals(V, T), cell: cell, bd: bd, nx: nx, ny: ny, ox: ox, oy: oy, oz: oz, data: data, tests: 0 };
    const nt = T.length / 3, lists = [], sheet_list = [];
    for (let s = 0; s < sh.count; s++) lists.push([]);
    for (let k = 0; k < nt; k++) lists[sh.shell_of[k]].push(k);
    let leaky = 0, solids = 0, sheets = 0;
    const box_of = function (list) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < list.length; i++) for (let k = 0; k < 3; k++) { const v = T[list[i] * 3 + k] * 3; for (let a = 0; a < 3; a++) { if (V[v + a] < lo[a]) lo[a] = V[v + a]; if (V[v + a] > hi[a]) hi[a] = V[v + a]; } }
      const x0 = Math.max(0, Math.floor((lo[0] - ox) / cell) - pad), y0 = Math.max(0, Math.floor((lo[1] - oy) / cell) - pad), z0 = Math.max(0, Math.floor((lo[2] - oz) / cell) - pad);
      return { x0: x0, y0: y0, z0: z0, nx: Math.min(nx - 1, Math.ceil((hi[0] - ox) / cell) + pad) - x0 + 1, ny: Math.min(ny - 1, Math.ceil((hi[1] - oy) / cell) + pad) - y0 + 1, nz: Math.min(nz - 1, Math.ceil((hi[2] - oz) / cell) + pad) - z0 + 1 };
    };
    for (let s = 0; s < sh.count; s++) {
      if (sh.bnd[s] === 0 && flat[s] !== 1) { solids++; leaky += bk_field(ctx, lists[s], "solid", 0, box_of(lists[s])); }
      else { sheets++; for (let i = 0; i < lists[s].length; i++) sheet_list.push(lists[s][i]); }
      if ((s & 15) === 0) tick("distance", s / sh.count);
    }
    if (sheet_list.length) bk_field(ctx, sheet_list, "sheet", sheet * cell, box_of(sheet_list));
    stats.shells.solid = solids; stats.shells.sheets = sheets; stats.shells.flat = n_flat; stats.shells.flipped = n_flipped; stats.shells.flat_largest = flat_info; stats.leaky = leaky; stats.distance_tests = ctx.tests;
    ms.distance = now() - t; t = now();
    // 6. the colours
    let attr = null;
    if (mesh.colors || (mesh.textures && mesh.textures.length)) {
      tick("colors", 0);
      attr = { colors: bk_colors(mesh, P, I, { nx: nx, ny: ny, nz: nz, cell: cell, ox: ox, oy: oy, oz: oz }, 2.5, function (f) { tick("colors", f); }) };
      stats.colored_voxels = attr.colors.keys.length;
    }
    ms.colors = now() - t; t = now();
    // 7. the skin
    if (mesh.joints || mesh.weights || mesh.joint_names) {
      tick("skin", 0);
      attr = attr || {};
      attr.skin = bk_skin_pack(P, I, mesh);
      stats.skin = { joints: attr.skin.names.length, vertices: attr.skin.P.length / 3, triangles: attr.skin.I.length / 3 };
    }
    ms.skin = now() - t;
    let inside = 0;
    for (let k = 0; k < nvox; k++) if (data[k] < 0) inside++;
    stats.inside_voxels = inside; stats.voxels = nvox;
    const ex = cell + (sheets ? 0.5 * sheet * cell : 0);
    ms.total = now() - T0;
    return { id: typeof opts.id === "string" && opts.id ? opts.id : "volume", version: 1, nx: nx, ny: ny, nz: nz, ox: ox, oy: oy, oz: oz, cell: cell, band: band, data: data,
      box: [mn[0] - ex, mn[1] - ex, mn[2] - ex, mx[0] + ex, mx[1] + ex, mx[2] + ex], attr: attr, stats: stats };
  }
  // ==== volumes and bake: end ==================================================================================================================================================

  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // pose - a skeleton in a pose, and a geometry skinned to it (on the CPU: for a preview, a test, a tool; what plays clips on the GPU is the engine's)
  //
  //   const mats = happy_mesher.pose_skeleton(geo.skeleton, { "arm_l": { rotate: [0, 0, 60] } })       -> Float32Array(12 * n): the SKIN matrices (3 x 4, row major) of the pose
  //   const out  = happy_mesher.skin_geometry(geo, mats)                                                -> { positions, normals }: the geometry moved by the four bones of every vertex
  //
  // pose = { [bone name]: { rotate: [rx, ry, rz] (degrees, x first), q: [x, y, z, w] (wins over rotate), translate: [x, y, z] } }: a bone's own transform, in ITS frame (it turns about its head and the bones
  // below it come along); a bone that is not named stays as it is. A skin matrix is world(i) * inverse(bind(i)): every matrix is the identity when nothing is posed. geo.skeleton is the def's bones with their
  // frames (bind, bind_inv, rest: 3 x 4, row major).
  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  function pose_local(p, out) {                                   // a bone's own transform as a 3 x 4 matrix
    let x = 0, y = 0, z = 0, w = 1;
    if (p && p.q) { x = p.q[0]; y = p.q[1]; z = p.q[2]; w = p.q[3]; const l = Math.sqrt(x * x + y * y + z * z + w * w) || 1; x /= l; y /= l; z /= l; w /= l; }
    else if (p && p.rotate) {
      const ax = p.rotate[0] * DEG * 0.5, ay = p.rotate[1] * DEG * 0.5, az = p.rotate[2] * DEG * 0.5, sx = Math.sin(ax), cx = Math.cos(ax), sy = Math.sin(ay), cy = Math.cos(ay), sz = Math.sin(az), cz = Math.cos(az);
      x = sx * cy * cz - cx * sy * sz; y = cx * sy * cz + sx * cy * sz; z = cx * cy * sz - sx * sy * cz; w = cx * cy * cz + sx * sy * sz;      // (z * y * x: x first, as a volume's rotate)
    }
    const tr = p && p.translate ? p.translate : null;
    out[0] = 1 - 2 * (y * y + z * z); out[1] = 2 * (x * y - z * w); out[2] = 2 * (x * z + y * w); out[3] = tr ? tr[0] : 0;
    out[4] = 2 * (x * y + z * w); out[5] = 1 - 2 * (x * x + z * z); out[6] = 2 * (y * z - x * w); out[7] = tr ? tr[1] : 0;
    out[8] = 2 * (x * z - y * w); out[9] = 2 * (y * z + x * w); out[10] = 1 - 2 * (x * x + y * y); out[11] = tr ? tr[2] : 0;
  }
  function pose_skeleton(bones, pose, out) {
    if (!Array.isArray(bones)) fail("pose_skeleton needs the bones of a geometry (geo.skeleton)");
    const n = bones.length, M = out && out.length >= n * 12 ? out : new Float32Array(n * 12), world = new Float64Array(n * 12), done = new Uint8Array(n), loc = new Float64Array(12), rp = new Float64Array(12), pm = new Float64Array(12);
    const walk = function (i) {
      if (done[i]) return;
      done[i] = 1;
      const b = bones[i], p = b.parent, o = i * 12;
      if (p === undefined || p < 0) { for (let k = 0; k < 12; k++) rp[k] = b.bind[k]; }
      else { walk(p); for (let k = 0; k < 12; k++) rp[k] = b.rest[k]; }
      pose_local(pose && pose[b.name], pm);                         // (after the parent's walk: it fills the same pm, and a bone listed before its parent kept the parent's turn)
      mul34(loc, 0, rp, 0, pm, 0);                                  // the bone's frame in its parent's, posed
      if (p === undefined || p < 0) { for (let k = 0; k < 12; k++) world[o + k] = loc[k]; }
      else mul34(world, o, world, p * 12, loc, 0);                                          // (the parent's region and this bone's do not overlap)
    };
    for (let i = 0; i < n; i++) walk(i);
    for (let i = 0; i < n; i++) { mul34(loc, 0, world, i * 12, bones[i].bind_inv, 0); for (let k = 0; k < 12; k++) M[i * 12 + k] = loc[k]; }
    return M;
  }
  function skin_geometry(geo, mats, out) {
    const P = geo.positions, N = geo.normals, BI = geo.bone_indices, BW = geo.bone_weights, nv = (P.length / 3) | 0;
    const op = out && out.positions && out.positions.length >= nv * 3 ? out.positions : new Float32Array(nv * 3), on = N ? (out && out.normals && out.normals.length >= nv * 3 ? out.normals : new Float32Array(nv * 3)) : null;
    for (let v = 0; v < nv; v++) {
      const px = P[v * 3], py = P[v * 3 + 1], pz = P[v * 3 + 2], hn = !!N, nx = hn ? N[v * 3] : 0, ny = hn ? N[v * 3 + 1] : 0, nz = hn ? N[v * 3 + 2] : 0;
      let x = 0, y = 0, z = 0, ax = 0, ay = 0, az = 0, ws = 0;
      if (BI && BW) {
        for (let k = 0; k < 4; k++) {
          const w = BW[v * 4 + k];
          if (!(w > 0)) continue;
          const o = BI[v * 4 + k] * 12;
          x += w * (mats[o] * px + mats[o + 1] * py + mats[o + 2] * pz + mats[o + 3]); y += w * (mats[o + 4] * px + mats[o + 5] * py + mats[o + 6] * pz + mats[o + 7]); z += w * (mats[o + 8] * px + mats[o + 9] * py + mats[o + 10] * pz + mats[o + 11]);
          if (hn) { ax += w * (mats[o] * nx + mats[o + 1] * ny + mats[o + 2] * nz); ay += w * (mats[o + 4] * nx + mats[o + 5] * ny + mats[o + 6] * nz); az += w * (mats[o + 8] * nx + mats[o + 9] * ny + mats[o + 10] * nz); }
          ws += w;
        }
      }
      if (!(ws > 0)) { x = px; y = py; z = pz; ax = nx; ay = ny; az = nz; }
      op[v * 3] = x; op[v * 3 + 1] = y; op[v * 3 + 2] = z;
      if (on) { const l = Math.sqrt(ax * ax + ay * ay + az * az) || 1; on[v * 3] = ax / l; on[v * 3 + 1] = ay / l; on[v * 3 + 2] = az / l; }
    }
    return { positions: op, normals: on };
  }

  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // volume file - a baked volume as bytes (a .sdfvol): what a saved creature keeps of an imported mesh, next to its json.
  //
  //   const bytes = happy_mesher.encode_volume(vol)        -> Uint8Array
  //   const vol   = happy_mesher.decode_volume(bytes)      -> a volume that is ready (set_volume and mesher.add_volume take it): its id, grid, colours and skin as they were baked
  //   happy_mesher.bytes_hash(bytes)                       -> "a1b2c3d4" (FNV-1a of the bytes: tells two files apart)
  //
  // Little endian. "SDFV", u32 version (1), u32 length of the header, the header (json, UTF-8, padded with spaces to a multiple of 4), then the blobs that the header gives the offsets and lengths of (from the
  // end of the header, each 4 byte aligned). The distances are 16 bit integers (the band either side of the surface in 65534 steps: under a micron at a centimetre cell; the voxels beyond the band are all
  // exactly +- band, so they are runs) run length encoded: the value, then the count as a LEB128 number. The keys of the coloured voxels are sorted: LEB128 deltas. The colours and the skin (the names are in the
  // header; the file's vertices, its triangles as 16 bit indices when they fit, the joints and the weights) are the arrays as they are. A character of 2.6 M voxels with 100 k coloured ones and its skin: about 1.5 MB.
  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  function byte_writer() {
    let a = new Uint8Array(4096), n = 0;
    const put = function (b) { if (n === a.length) { const c = new Uint8Array(a.length * 2); c.set(a); a = c; } a[n++] = b; };
    return {
      put: put,
      varint: function (v) { while (v >= 128) { put((v % 128) | 128); v = Math.floor(v / 128); } put(v); },
      bytes: function () { return a.subarray(0, n); }
    };
  }
  function utf8_bytes(s) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s);
    const e = unescape(encodeURIComponent(s)), u = new Uint8Array(e.length);
    for (let i = 0; i < e.length; i++) u[i] = e.charCodeAt(i);
    return u;
  }
  function utf8_text(u) {
    if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(u);
    let s = "";
    for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return decodeURIComponent(escape(s));
  }
  function bytes_hash(u) {
    let h = 0x811c9dc5;
    for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    return ("00000000" + (h >>> 0).toString(16)).slice(-8);
  }
  function u8_of(a) { return new Uint8Array(a.buffer, a.byteOffset, a.byteLength); }

  function encode_volume(v) {
    prepare_volume(v);
    const nvox = v.nx * v.ny * v.nz, blobs = [];
    let mx = 0;
    for (let i = 0; i < nvox; i++) { const d = v.data[i]; if (d > mx) mx = d; else if (-d > mx) mx = -d; }
    const bd = Math.max(v.band > 0 ? v.band * v.cell : 4 * v.cell, mx), scale = bd / 32767, inv = 1 / scale;
    const head = { format: "sdfvol", version: 1, id: v.id, nx: v.nx, ny: v.ny, nz: v.nz, ox: v.ox, oy: v.oy, oz: v.oz, cell: v.cell, band: v.band > 0 ? v.band : 4, box: v.box.slice() };
    const field = byte_writer();
    let cur = 0, run = 0, runs = 0;
    const flush = function () { if (run > 0) { field.put(cur & 255); field.put((cur >> 8) & 255); field.varint(run); runs++; } };
    for (let i = 0; i < nvox; i++) {
      const d = v.data[i];
      let q = Math.round(d * inv);
      if (q === 0 && d !== 0) q = d < 0 ? -1 : 1;                                   // (a voxel that is inside by a hair stays inside: the sign is what the surface is made of)
      q = q > 32767 ? 32767 : (q < -32767 ? -32767 : q);
      if (run > 0 && q === cur) run++; else { flush(); cur = q; run = 1; }
    }
    flush();
    blobs.push(field.bytes());
    head.field = { kind: "i16rle", scale: scale, runs: runs, blob: 0 };
    const c = v.attr && v.attr.colors;
    if (c) {
      const ks = byte_writer();
      let prev = 0;
      for (let i = 0; i < c.keys.length; i++) { ks.varint(c.keys[i] - prev); prev = c.keys[i]; }
      blobs.push(ks.bytes()); blobs.push(u8_of(c.rgba));
      head.colors = { count: c.keys.length, keys: blobs.length - 2, rgba: blobs.length - 1 };
    }
    const s = v.attr && v.attr.skin;
    if (s) {
      const nvs = s.P.length / 3, wide = nvs > 65535, I = wide ? s.I : Uint16Array.from(s.I);
      blobs.push(u8_of(s.P)); blobs.push(u8_of(I)); blobs.push(u8_of(s.J)); blobs.push(u8_of(s.W));
      head.skin = { names: s.names.slice(), vertices: nvs, triangles: s.I.length / 3, index_bytes: wide ? 4 : 2, P: blobs.length - 4, I: blobs.length - 3, J: blobs.length - 2, W: blobs.length - 1 };
      if (s.parents) head.skin.parents = Array.from(s.parents);                    // (the names' chain: a reader of before ignores it)
    }
    if (v.stats) head.stats = JSON.parse(JSON.stringify(v.stats));
    let at = 0;
    head.blobs = blobs.map(function (b) { const o = { offset: at, length: b.length }; at += (b.length + 3) & ~3; return o; });
    let hb = utf8_bytes(JSON.stringify(head));
    const hl = (hb.length + 3) & ~3, out = new Uint8Array(12 + hl + at), dv = new DataView(out.buffer);
    out.set([0x53, 0x44, 0x46, 0x56], 0);
    dv.setUint32(4, 1, true); dv.setUint32(8, hl, true);
    out.set(hb, 12);
    for (let i = hb.length; i < hl; i++) out[12 + i] = 32;
    blobs.forEach(function (b, i) { out.set(b, 12 + hl + head.blobs[i].offset); });
    return out;
  }

  function decode_volume(bytes) {
    const u = bytes instanceof Uint8Array ? bytes : (bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : (bytes && bytes.buffer ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : null));
    if (!u || u.length < 12 || u[0] !== 0x53 || u[1] !== 0x44 || u[2] !== 0x46 || u[3] !== 0x56) fail("a volume file starts with SDFV (this is not one)");
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength), version = dv.getUint32(4, true), hl = dv.getUint32(8, true);
    if (version !== 1) fail("a volume file of version " + version + " (this reads 1)");
    if (12 + hl > u.length) fail("the volume file is cut short (its header is past the end)");
    let head;
    try { head = JSON.parse(utf8_text(u.subarray(12, 12 + hl))); } catch (e) { fail("the header of the volume file is not json (" + e.message + ")"); }
    const base = 12 + hl;
    const blob = function (i) {
      const b = head.blobs && head.blobs[i];
      if (!b || b.offset < 0 || b.length < 0 || base + b.offset + b.length > u.length) fail("the volume file is cut short (blob " + i + " is past the end)");
      return u.subarray(base + b.offset, base + b.offset + b.length);
    };
    const own = function (u8, T) { const c = new Uint8Array(u8.length); c.set(u8); return new T(c.buffer, 0, Math.floor(c.length / T.BYTES_PER_ELEMENT)); };     // (a copy that owns its buffer, aligned for the type; not u8.slice(): node's Buffer.slice shares the memory of a pool)
    if (!head.field || head.field.kind !== "i16rle") fail("the volume file has no distance field it can read");
    const nvox = head.nx * head.ny * head.nz;
    if (!(nvox > 0) || nvox > 1e9) fail("the volume file has an impossible grid");
    const data = new Float32Array(nvox), f = blob(head.field.blob), scale = head.field.scale;
    let p = 0, at = 0;
    while (p < f.length && at < nvox) {
      const q = (f[p] | (f[p + 1] << 8)) << 16 >> 16;
      p += 2;
      let run = 0, mul = 1, b;
      do { if (p >= f.length) fail("the distance field of the volume file is cut short"); b = f[p++]; run += (b & 127) * mul; mul *= 128; } while (b & 128);
      if (at + run > nvox) fail("the distance field of the volume file is longer than its grid");
      if (q !== 0) data.fill(q * scale, at, at + run);
      at += run;
    }
    if (at !== nvox) fail("the distance field of the volume file is shorter than its grid (" + at + " of " + nvox + " voxels)");
    const vol = { id: head.id, version: 1, nx: head.nx, ny: head.ny, nz: head.nz, ox: head.ox, oy: head.oy, oz: head.oz, cell: head.cell, band: head.band, data: data, box: head.box.slice(), attr: null, stats: head.stats || null };
    if (head.colors) {
      const kb = blob(head.colors.keys), keys = new Uint32Array(head.colors.count);
      let q = 0, prev = 0;
      for (let i = 0; i < keys.length; i++) {
        let d = 0, mul = 1, b;
        do { if (q >= kb.length) fail("the colour keys of the volume file are cut short"); b = kb[q++]; d += (b & 127) * mul; mul *= 128; } while (b & 128);
        prev += d; keys[i] = prev;
      }
      const rgba = own(blob(head.colors.rgba), Uint8Array);
      if (rgba.length !== keys.length * 4) fail("the colours of the volume file do not match their keys");
      vol.attr = { colors: { keys: keys, rgba: rgba } };
    }
    if (head.skin) {
      const s = head.skin, I = own(blob(s.I), s.index_bytes === 4 ? Uint32Array : Uint16Array);
      vol.attr = vol.attr || {};
      vol.attr.skin = { names: s.names.slice(), P: own(blob(s.P), Float32Array), I: s.index_bytes === 4 ? I : Uint32Array.from(I), J: own(blob(s.J), Uint8Array), W: own(blob(s.W), Uint8Array) };
      if (Array.isArray(s.parents)) vol.attr.skin.parents = s.parents.slice();
    }
    return prepare_volume(vol);
  }

  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // shaders - the GLSL (WebGL2, #version 300 es) of the GPU path. The field is a port of the cpu section / geometry_creature.cpp: one fold over a list of primitives, read from float textures.
  //
  // Textures (all RGBA32F or R32F, NEAREST):
  //   u_prim   5 texels per primitive (row = primitive): texel k holds floats 4k .. 4k + 3 of the 20 float record (the compile section)
  //   u_lx     7 texels per loft record (row = the primitive's index); a volume's matrix and box middle
  //   u_cell   (start, count) of the cull list of block b at texel (b & 4095, b >> 12)
  //   u_list   the lists: primitive index k at texel (k & 2047, k >> 11)
  //   u_part   the colour of part i at texel (i, 0)
  //   u_vol    (3D, R32F) every volume of the def, their slices one after the other along z; u_vinfo 2 texels per volume: (origin, 1 / cell) and (nx, ny, nz, first slice)
  // A pass draws one full-screen triangle into a float render target; every fragment is one job (4 samples, or 1 vertex).
  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const HEAD = "#version 300 es\nprecision highp float; precision highp int; precision highp sampler2D; precision highp sampler3D;\n";

  const VERT = "#version 300 es\nvoid main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }\n";

  const FIELD = `
uniform sampler2D u_prim; uniform sampler2D u_lx; uniform sampler2D u_cell; uniform sampler2D u_list;
uniform sampler3D u_vol; uniform sampler2D u_vinfo;
const float BIG = 1e9;
const float FAR = 1e6;

int list_at(int k) { return int(texelFetch(u_list, ivec2(k & 2047, k >> 11), 0).r + 0.5); }

float fold(float d, float dd, int op, float k, int mode) {
  float h, m;
  if (op == 0) {
    m = min(d, dd);
    if (k > 0.0) {
      if (mode == 2) { h = (d + dd - k) * 0.70710678118; return min(h, m); }
      h = k - abs(d - dd);
      if (h > 0.0) { h /= k; return m - (mode == 1 ? h * h * h * k * 0.16666666667 : h * h * k * 0.25); }
    }
    return m;
  }
  if (op == 1) dd = -dd;
  m = max(d, dd);
  if (k > 0.0) {
    if (mode == 2) { h = (d + dd + k) * 0.70710678118; return max(h, m); }
    h = k - abs(d - dd);
    if (h > 0.0) { h /= k; return m + (mode == 1 ? h * h * h * k * 0.16666666667 : h * h * k * 0.25); }
  }
  return m;
}

// lim < BIG * 0.5: a union segment further than lim from its bounding capsule cannot change the running value (the early out of loft_far in the cpu section)
float loft_dist(vec3 pt, vec4 t1, vec4 t2, int li, float lim) {
  vec3 a = t1.xyz, ab = vec3(t1.w, t2.x, t2.y);
  float inv = t2.z;
  vec4 L0 = texelFetch(u_lx, ivec2(0, li), 0), L1 = texelFetch(u_lx, ivec2(1, li), 0), L4 = texelFetch(u_lx, ivec2(4, li), 0), L5 = texelFetch(u_lx, ivec2(5, li), 0);
  vec3 d = pt - a;
  float tr = dot(d, ab) * inv, t = clamp(tr, 0.0, 1.0);
  vec3 q = d - ab * t;
  float tt = t * t, t3 = tt * t, hb = 3.0 * tt - 2.0 * t3, h1 = t3 - 2.0 * tt + t, h2 = t3 - tt;
  float ru = L0.x + L0.y * hb + L4.y * h1 + L4.z * h2;
  float rv = L0.z + L0.w * hb + L4.w * h1 + L5.x * h2;
  float sq = L1.x + L1.y * t;
  if (lim < BIG * 0.5) {
    float r = max(ru, rv) * (1.0 + 0.2 * max(sq, 0.0)), qq = dot(q, q);
    if (qq > r * r) { float v = r + 2.0 * lim; if (qq >= v * v) return BIG; }
  }
  vec4 L2 = texelFetch(u_lx, ivec2(2, li), 0), L3 = texelFetch(u_lx, ivec2(3, li), 0);
  float a0 = dot(q, vec3(L2.z, L2.w, L3.x)), b0 = dot(q, vec3(L3.y, L3.z, L3.w));
  float c = L1.z, sn = L1.w;
  if (L2.x != 0.0 || L2.y != 0.0) { c += L2.x * t; sn += L2.y * t; float l = c * c + sn * sn; if (l > 1e-12) { l = inversesqrt(l); c *= l; sn *= l; } else { c = 1.0; sn = 0.0; } }
  float iu = 1.0 / ru, iv = 1.0 / rv;
  float ra = (a0 * c + b0 * sn) * iu, rb = (b0 * c - a0 * sn) * iv;
  float a2 = ra * ra, b2 = rb * rb;
  float r2 = sqrt(a2 + b2), r4 = 0.0, rs = r2;
  if (sq > 0.0) { r4 = sqrt(sqrt(a2 * a2 + b2 * b2)); rs = r2 + sq * (r4 - r2); }
  float rmin = min(ru, rv);
  float e = (tr - t) * L4.x, ce = 0.0, rho = rs;
  if (e != 0.0) { ce = e / rmin; rho = sqrt(rs * rs + ce * ce); }
  if (rho < 1.0) return (rho - 1.0) * rmin;
  float ga = 0.0, gb = 0.0, gs;
  if (r2 > 1e-12) { gs = 1.0 / r2; ga = ra * gs; gb = rb * gs; }
  if (sq > 0.0 && r4 > 1e-12) { gs = 1.0 / (r4 * r4 * r4); ga += sq * (ra * a2 * gs - ga); gb += sq * (rb * b2 * gs - gb); }
  ga *= iu; gb *= iv;
  float den2 = rs * rs * (ga * ga + gb * gb) + ce * ce / (rmin * rmin);
  if (den2 < 1e-24) return 0.0;
  return (rho - 1.0) * rho / sqrt(den2);
}

// a volume (the volumes section): the 8 samples round the point, trilinear by hand (the texture is R32F: no filtering needed, no extension), plus the distance to the grid's box outside it, times the scale
float volume_dist(vec3 p, vec4 t1, vec4 t2, int li) {
  int vi = int(t1.w + 0.5);
  vec4 V0 = texelFetch(u_vinfo, ivec2(0, vi), 0), V1 = texelFetch(u_vinfo, ivec2(1, vi), 0);
  vec4 L0 = texelFetch(u_lx, ivec2(0, li), 0), L1 = texelFetch(u_lx, ivec2(1, li), 0), L2 = texelFetch(u_lx, ivec2(2, li), 0);
  vec3 d = p - t1.xyz;
  vec3 g = (vec3(dot(L0.xyz, d), dot(vec3(L0.w, L1.x, L1.y), d), dot(vec3(L1.z, L1.w, L2.x), d)) + L2.yzw - V0.xyz) * V0.w;
  vec3 mx = V1.xyz - 1.0;
  vec3 gc = clamp(g, vec3(0.0), mx), e = g - gc;
  ivec3 i0 = ivec3(floor(gc)), o = ivec3(lessThan(vec3(i0), mx));
  vec3 f = gc - vec3(i0);
  int zb = i0.z + int(V1.w + 0.5);
  float c000 = texelFetch(u_vol, ivec3(i0.x, i0.y, zb), 0).r, c100 = texelFetch(u_vol, ivec3(i0.x + o.x, i0.y, zb), 0).r;
  float c010 = texelFetch(u_vol, ivec3(i0.x, i0.y + o.y, zb), 0).r, c110 = texelFetch(u_vol, ivec3(i0.x + o.x, i0.y + o.y, zb), 0).r;
  float c001 = texelFetch(u_vol, ivec3(i0.x, i0.y, zb + o.z), 0).r, c101 = texelFetch(u_vol, ivec3(i0.x + o.x, i0.y, zb + o.z), 0).r;
  float c011 = texelFetch(u_vol, ivec3(i0.x, i0.y + o.y, zb + o.z), 0).r, c111 = texelFetch(u_vol, ivec3(i0.x + o.x, i0.y + o.y, zb + o.z), 0).r;
  float val = mix(mix(mix(c000, c100, f.x), mix(c010, c110, f.x), f.y), mix(mix(c001, c101, f.x), mix(c011, c111, f.x), f.y), f.z);
  if (e.x != 0.0 || e.y != 0.0 || e.z != 0.0) val += length(e) / V0.w;
  return val * t2.x;
}

// the field over list[ls .. le); hit = the part of the last union primitive that was closer than everything before it
float field(vec3 p, int ls, int le, out int hit) {
  float d = BIG, gd = 0.0, gk = 0.0;
  int gid = 0, gop = 0, gmode = 0, gpart = 0;
  hit = -1;
  for (int j = ls; j < le; j++) {
    int i = list_at(j);
    vec4 t0 = texelFetch(u_prim, ivec2(0, i), 0);
    vec4 t1 = texelFetch(u_prim, ivec2(1, i), 0);
    vec4 t3 = texelFetch(u_prim, ivec2(3, i), 0);
    int ty = int(t0.x + 0.5), op = int(t0.y + 0.5), g = int(t3.z + 0.5), mode = int(t3.w + 0.5);
    float k = t0.z, dd;
    if (ty == 4) {
      vec4 t2 = texelFetch(u_prim, ivec2(2, i), 0);
      float lim = BIG * 4.0;
      if (g != 0 && g == gid) lim = gd; else if (op == 0 && mode != 2) lim = d + k;
      dd = loft_dist(p, t1, t2, int(t2.w + 0.5), lim);
    } else if (ty == 2) {
      vec4 t2 = texelFetch(u_prim, ivec2(2, i), 0), t4 = texelFetch(u_prim, ivec2(4, i), 0);
      vec3 dv = p - t1.xyz; vec3 ab = vec3(t1.w, t2.x, t2.y);
      float t = clamp(dot(dv, ab) * t2.z, 0.0, 1.0);
      dv -= ab * t;
      float tt = t * t, t3_ = tt * t;
      dd = length(dv) - (t2.w + t3.x * (3.0 - 2.0 * t) * tt + t4.x * (t3_ - 2.0 * tt + t) + t4.y * (t3_ - tt));
    } else if (ty == 0) {
      dd = length(p - t1.xyz) - t1.w;
    } else if (ty == 1) {
      vec4 t2 = texelFetch(u_prim, ivec2(2, i), 0);
      vec3 dv = (p - t1.xyz) * vec3(t1.w, t2.x, t2.y);
      dd = (length(dv) - 1.0) * t2.z;
    } else if (ty == 5) {
      vec4 t2 = texelFetch(u_prim, ivec2(2, i), 0);
      vec3 dv = p - t1.xyz; vec3 ax = vec3(t1.w, t2.x, t2.y);
      float h = dot(dv, ax), q = length(dv - ax * h) - t2.z;
      dd = length(vec2(q, h)) - t2.w;
    } else if (ty == 6) {
      vec4 t2 = texelFetch(u_prim, ivec2(2, i), 0);
      vec3 dv = p - t1.xyz; vec3 ax = vec3(t1.w, t2.x, t2.y);
      float h = dot(dv, ax);
      vec2 q = vec2(length(dv - ax * h) - t2.z, abs(h) - t2.w);
      dd = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - t3.x;
    } else if (ty == 7) {
      vec4 t2 = texelFetch(u_prim, ivec2(2, i), 0);
      dd = volume_dist(p, t1, t2, int(t2.w + 0.5));
    } else {
      vec4 t2 = texelFetch(u_prim, ivec2(2, i), 0);
      vec3 dv = abs(p - t1.xyz) - vec3(t1.w, t2.x, t2.y);
      float m = max(dv.x, max(dv.y, dv.z));
      dd = length(max(dv, 0.0)) + min(m, 0.0) - t2.z;
    }
    if (g != 0 && g == gid) { if (dd < gd) { gd = dd; gpart = int(t0.w + 0.5); } continue; }     // (the part of a group is the part of its nearest member)
    if (gid != 0) { if (gop == 0 && gd < d) hit = gpart; d = fold(d, gd, gop, gk, gmode); gid = 0; }
    if (g != 0) { gid = g; gd = dd; gop = op; gk = k; gmode = mode; gpart = int(t0.w + 0.5); continue; }
    if (op == 0 && dd < d) hit = int(t0.w + 0.5);
    d = fold(d, dd, op, k, mode);
  }
  if (gid != 0) { if (gop == 0 && gd < d) hit = gpart; d = fold(d, gd, gop, gk, gmode); }
  return d;
}

// the distance one primitive has for the skin weights and the soft colours (the ellipsoid's is the better approximation)
float wdist(int i, vec3 p) {
  vec4 t0 = texelFetch(u_prim, ivec2(0, i), 0), t1 = texelFetch(u_prim, ivec2(1, i), 0), t2 = texelFetch(u_prim, ivec2(2, i), 0);
  int ty = int(t0.x + 0.5);
  if (ty == 0) return length(p - t1.xyz) - t1.w;
  if (ty == 1) {
    vec3 inv = vec3(t1.w, t2.x, t2.y);
    vec3 d = (p - t1.xyz) * inv; float k0 = length(d); d *= inv; float k1 = length(d);
    return k1 > 1e-12 ? k0 * (k0 - 1.0) / k1 : -t2.z;
  }
  if (ty == 2) {
    vec4 t3 = texelFetch(u_prim, ivec2(3, i), 0), t4 = texelFetch(u_prim, ivec2(4, i), 0);
    vec3 dv = p - t1.xyz; vec3 ab = vec3(t1.w, t2.x, t2.y);
    float t = clamp(dot(dv, ab) * t2.z, 0.0, 1.0); dv -= ab * t;
    float tt = t * t, t3_ = tt * t;
    return length(dv) - (t2.w + t3.x * (3.0 - 2.0 * t) * tt + t4.x * (t3_ - 2.0 * tt + t) + t4.y * (t3_ - tt));
  }
  if (ty == 4) return loft_dist(p, t1, t2, int(t2.w + 0.5), BIG * 4.0);
  if (ty == 7) return volume_dist(p, t1, t2, int(t2.w + 0.5));
  if (ty == 5 || ty == 6) {
    vec3 dv = p - t1.xyz; vec3 ax = vec3(t1.w, t2.x, t2.y);
    float h = dot(dv, ax), rr = length(dv - ax * h);
    if (ty == 5) return length(vec2(rr - t2.z, h)) - t2.w;
    vec2 q = vec2(rr - t2.z, abs(h) - t2.w);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - texelFetch(u_prim, ivec2(3, i), 0).x;
  }
  vec3 dv = abs(p - t1.xyz) - vec3(t1.w, t2.x, t2.y);
  float m = max(dv.x, max(dv.y, dv.z));
  return length(max(dv, 0.0)) + min(m, 0.0) - t2.z;
}
`;

  // one fragment = four consecutive samples along x (so a row of samples is contiguous in the atlas and the read back is always RGBA / FLOAT)
  const SAMPLE = `
uniform ivec3 u_n; uniform int u_sw; uniform int u_tx; uniform int u_z0; uniform int u_B; uniform ivec3 u_nb; uniform vec3 u_o; uniform float u_h;
out vec4 o_val;
void main() {
  ivec2 f = ivec2(gl_FragCoord.xy);
  int tx = f.x / u_sw, ty = f.y / u_n.y;
  int z = u_z0 + tx + ty * u_tx;
  int y = f.y - ty * u_n.y;
  int xt = f.x - tx * u_sw;
  float v[4];
  v[0] = FAR; v[1] = FAR; v[2] = FAR; v[3] = FAR;
  if (z < u_n.z) {
    for (int c = 0; c < 4; c++) {
      int x = xt * 4 + c;
      if (x >= u_n.x) break;
      ivec3 b = ivec3(x, y, z) / u_B;
      int bi = b.x + u_nb.x * (b.y + u_nb.y * b.z);
      vec2 cl = texelFetch(u_cell, ivec2(bi & 4095, bi >> 12), 0).xy;
      int ls = int(cl.x + 0.5), le = ls + int(cl.y + 0.5);
      if (le > ls) { int h; v[c] = field(u_o + vec3(float(x), float(y), float(z)) * u_h, ls, le, h); }
    }
  }
  o_val = vec4(v[0], v[1], v[2], v[3]);
}`;

  // one fragment = one vertex: the normal (the tetrahedral gradient), the part that owns it, the colour (soft colours, ambient occlusion, tone)
  const SHADE = `
uniform sampler2D u_pos; uniform sampler2D u_part;
uniform int u_nv; uniform float u_gh; uniform vec3 u_o; uniform float u_cs; uniform ivec3 u_nb;
uniform int u_flags;                        // 1 colours, 2 ambient occlusion, 4 tone, 8 soft colours
uniform float u_ao; uniform float u_ao_r; uniform float u_tone; uniform float u_cb; uniform float u_wcell;
layout(location = 0) out vec4 o_nrm;
layout(location = 1) out vec4 o_col;
float fl(vec3 p, int ls, int le) { int h; return field(p, ls, le, h); }
void main() {
  ivec2 f = ivec2(gl_FragCoord.xy);
  int k = f.x + f.y * 2048;
  o_nrm = vec4(0.0, 1.0, 0.0, 0.0); o_col = vec4(1.0);
  if (k >= u_nv) return;
  vec3 p = texelFetch(u_pos, f, 0).xyz;
  ivec3 b = clamp(ivec3(floor((p - u_o) / u_cs)), ivec3(0), u_nb - ivec3(1));
  int bi = b.x + u_nb.x * (b.y + u_nb.y * b.z);
  vec2 cl = texelFetch(u_cell, ivec2(bi & 4095, bi >> 12), 0).xy;
  int ls = int(cl.x + 0.5), le = ls + int(cl.y + 0.5);
  if (le == ls) return;
  float h = u_gh;
  float f0 = fl(p + vec3(h, -h, -h), ls, le), f1 = fl(p + vec3(-h, -h, h), ls, le), f2 = fl(p + vec3(-h, h, -h), ls, le), f3 = fl(p + vec3(h, h, h), ls, le);
  vec3 g = vec3(f0 - f1 - f2 + f3, -f0 - f1 + f2 + f3, -f0 + f1 - f2 + f3);
  float gl = length(g);
  vec3 n = gl > 1e-20 ? g / gl : vec3(0.0, 1.0, 0.0);
  int hit; field(p, ls, le, hit);
  int part = hit < 0 ? 0 : hit;
  o_nrm = vec4(n, float(part));
  if ((u_flags & 1) == 0) return;
  vec4 col = texelFetch(u_part, ivec2(part, 0), 0);
  if ((u_flags & 8) != 0) {
    float dmin = BIG;
    for (int j = ls; j < le; j++) {
      int i = list_at(j);
      vec4 t0 = texelFetch(u_prim, ivec2(0, i), 0);
      if (int(t0.y + 0.5) != 0) continue;
      dmin = min(dmin, wdist(i, p));
    }
    if (dmin < BIG * 0.5) {
      float wt = 0.0; vec4 acc = vec4(0.0);
      for (int j = ls; j < le; j++) {
        int i = list_at(j);
        vec4 t0 = texelFetch(u_prim, ivec2(0, i), 0);
        if (int(t0.y + 0.5) != 0) continue;
        float w = 1.0 - (wdist(i, p) - dmin) / (u_cb * t0.z + u_wcell);
        if (w <= 0.0) continue;
        w *= w;
        acc += w * texelFetch(u_part, ivec2(int(t0.w + 0.5), 0), 0); wt += w;
      }
      if (wt > 0.0) col = acc / wt;
    }
  }
  float fac = 1.0;
  if ((u_flags & 2) != 0) {
    float occ = 0.0;
    float th[4] = float[4](0.08333333333, 0.22222222222, 0.5, 1.0), tw[4] = float[4](0.4, 0.3, 0.2, 0.1);
    for (int q = 0; q < 4; q++) { float hq = u_ao_r * th[q]; float w = (hq - fl(p + n * hq, ls, le)) / hq; if (w > 0.0) occ += tw[q] * w; }
    float w = max(1.0 - 1.6 * occ, 0.0);
    fac = 1.0 - u_ao * 0.7 * (1.0 - w);
  }
  if ((u_flags & 4) != 0) fac *= 1.0 + u_tone * (clamp(0.5 - 0.5 * n.y, 0.0, 1.0) - 0.5);
  o_col = vec4(col.rgb * fac, col.a);
}`;

  // one fragment = one vertex: the four strongest bones and their weights (cg_skin)
  const SKIN = `
uniform sampler2D u_pos;
uniform int u_nv; uniform vec3 u_o; uniform float u_cs; uniform ivec3 u_nb;
uniform float u_falloff; uniform float u_minblend; uniform float u_range;
layout(location = 0) out vec4 o_idx;
layout(location = 1) out vec4 o_w;
void main() {
  ivec2 f = ivec2(gl_FragCoord.xy);
  int k = f.x + f.y * 2048;
  o_idx = vec4(0.0); o_w = vec4(1.0, 0.0, 0.0, 0.0);
  if (k >= u_nv) return;
  vec3 p = texelFetch(u_pos, f, 0).xyz;
  ivec3 b = clamp(ivec3(floor((p - u_o) / u_cs)), ivec3(0), u_nb - ivec3(1));
  int bi = b.x + u_nb.x * (b.y + u_nb.y * b.z);
  vec2 cl = texelFetch(u_cell, ivec2(bi & 4095, bi >> 12), 0).xy;
  int ls = int(cl.x + 0.5), le = ls + int(cl.y + 0.5);
  float dmin = BIG;
  for (int j = ls; j < le; j++) {
    int i = list_at(j);
    vec4 t0 = texelFetch(u_prim, ivec2(0, i), 0), t3 = texelFetch(u_prim, ivec2(3, i), 0);
    if (int(t0.y + 0.5) != 0 || t3.y < -0.5) continue;
    dmin = min(dmin, wdist(i, p));
  }
  int bi8[8]; float bw[8]; int nb = 0;
  for (int q = 0; q < 8; q++) { bi8[q] = 0; bw[q] = 0.0; }
  for (int j = ls; j < le; j++) {
    int i = list_at(j);
    vec4 t0 = texelFetch(u_prim, ivec2(0, i), 0), t3 = texelFetch(u_prim, ivec2(3, i), 0);
    if (int(t0.y + 0.5) != 0 || t3.y < -0.5) continue;
    float t = (wdist(i, p) - dmin) / (u_range * (t0.z * u_falloff + u_minblend));
    if (t < 1.0) {
      float w = 1.0 - t; w *= w;
      int bone = int(t3.y + 0.5), s = -1;
      for (int q = 0; q < 8; q++) if (q < nb && bi8[q] == bone) s = q;
      if (s < 0 && nb < 8) { s = nb; bi8[s] = bone; nb++; }
      if (s >= 0) bw[s] += w;
    }
  }
  float tw[4]; int tb[4];
  for (int a = 0; a < 4; a++) { tw[a] = 0.0; tb[a] = 0; }
  for (int a = 0; a < 4; a++) {
    float best = 0.0; int bs = -1;
    for (int q = 0; q < 8; q++) if (q < nb && bw[q] > best) { best = bw[q]; bs = q; }
    if (bs >= 0) { tw[a] = best; tb[a] = bi8[bs]; bw[bs] = -1.0; }
  }
  float sum = tw[0] + tw[1] + tw[2] + tw[3];
  if (sum <= 0.0) { tw[0] = 1.0; sum = 1.0; }
  for (int a = 1; a < 4; a++) if (tw[a] < 0.005 * sum) tw[a] = 0.0;
  sum = tw[0] + tw[1] + tw[2] + tw[3];
  o_idx = vec4(float(tb[0]), tw[1] > 0.0 ? float(tb[1]) : float(tb[0]), tw[2] > 0.0 ? float(tb[2]) : float(tb[0]), tw[3] > 0.0 ? float(tb[3]) : float(tb[0]));
  o_w = vec4(tw[0], tw[1], tw[2], tw[3]) / sum;
}`;

  const shaders = { VERT: VERT, SAMPLE: HEAD + FIELD + SAMPLE, SHADE: HEAD + FIELD + SHADE, SKIN: HEAD + FIELD + SKIN };

  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // gpu - the WebGL2 backend: the samples of the grid and the per-vertex passes are drawn into float textures by the shaders above and read back with readPixels.
  //
  //   const g = gpu_backend({ allow_software: false, power: "high-performance", max_texture: undefined })
  //   g.ok        false when this environment has no usable GPU path (g.reason says why: no WebGL2, no float render targets, a software renderer, a failed self test)
  //   g.info      { backend: "gpu", renderer, canvas: "offscreen" | "canvas", software, max_texture, ... }
  //   g.volume / g.vertex / g.dispose     what the engine section calls (the same contract as the CPU backend)
  //
  // The context is made on an OffscreenCanvas when the environment has one (so this runs inside a Web Worker too), on a canvas of the page otherwise. A software renderer (SwiftShader,
  // llvmpipe, WARP) is refused unless allow_software: the CPU path is faster than software GL.
  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const SOFTWARE = /swiftshader|llvmpipe|softpipe|lavapipe|software|basic render|microsoft basic|\bwarp\b|mesa offscreen/i;

  function make_context(options) {
    const attrs = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: options.power || "high-performance" };
    let canvas = null, kind = "";
    if (typeof OffscreenCanvas !== "undefined") { try { canvas = new OffscreenCanvas(4, 4); kind = "offscreen"; } catch (e) { canvas = null; } }
    if (!canvas && typeof document !== "undefined" && document.createElement) { canvas = document.createElement("canvas"); canvas.width = 4; canvas.height = 4; kind = "canvas"; }
    if (!canvas) return { reason: "no canvas: neither OffscreenCanvas nor a document" };
    let gl = null;
    try { gl = canvas.getContext("webgl2", Object.assign({ failIfMajorPerformanceCaveat: true }, attrs)); } catch (e) { gl = null; }
    let refused = false;
    if (!gl) { try { gl = canvas.getContext("webgl2", attrs); refused = !!gl; } catch (e) { gl = null; } }
    if (!gl) return { reason: "no WebGL2" };
    return { gl: gl, canvas: canvas, kind: kind, refused_by_browser: refused };
  }

  function gpu_backend(options) {
    options = options || {};
    const cx = make_context(options);
    if (!cx.gl) return { ok: false, reason: cx.reason };
    const gl = cx.gl;
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    const software = cx.refused_by_browser || SOFTWARE.test(renderer);
    if (software && !options.allow_software) return { ok: false, reason: "a software renderer (" + renderer + ")", renderer: renderer };
    if (!gl.getExtension("EXT_color_buffer_float")) return { ok: false, reason: "no float render targets (EXT_color_buffer_float)", renderer: renderer };
    const max_texture = Math.min(options.max_texture || 1e9, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    if (max_texture < (options.max_texture ? 32 : 2048) || gl.getParameter(gl.MAX_DRAW_BUFFERS) < 2) return { ok: false, reason: "the limits are too small (texture " + max_texture + ")", renderer: renderer };

    let lost = false;
    cx.canvas.addEventListener && cx.canvas.addEventListener("webglcontextlost", function (e) { lost = true; e.preventDefault && e.preventDefault(); }, false);
    const GL = gl, T2 = gl.TEXTURE_2D, F = gl.FLOAT;

    // ---- programs, compiled when first used -----------------------------------------------------------------------------------------------------------------------------------
    const programs = {};
    let compile_ms = 0;
    function program(name) {
      if (programs[name]) return programs[name];
      const t0 = now();
      const sh = function (type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(name + " shader: " + gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, shaders.VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, shaders[name]));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(name + " program: " + gl.getProgramInfoLog(p));
      programs[name] = { p: p, u: Object.create(null) };
      compile_ms += now() - t0;
      return programs[name];
    }
    function uni(pr, name) {
      let l = pr.u[name];
      if (l === undefined) { l = gl.getUniformLocation(pr.p, name); pr.u[name] = l; }
      return l;
    }

    // ---- the arrays the pixels are read into: the big ones are kept for the next build (a 30 MB array costs more to make and to collect than the GPU takes to fill it)
    const pool = [];
    function take_f32(n) {
      let best = -1;
      for (let i = 0; i < pool.length; i++) if (pool[i].length >= n && (best < 0 || pool[i].length < pool[best].length)) best = i;
      if (best >= 0 && pool[best].length < 4 * n + 4096) { const a = pool.splice(best, 1)[0]; return { base: a, view: a.length === n ? a : a.subarray(0, n) }; }
      const a = new Float32Array(n);
      return { base: a, view: a };
    }
    function give_f32(base) { if (base.length >= 65536) { pool.push(base); while (pool.length > 6) pool.shift(); } }

    // ---- textures -------------------------------------------------------------------------------------------------------------------------------------------------------------
    const tex = {};                                              // name -> { t, w, h }
    const SCRATCH_UNIT = 15;                                     // textures are made and filled on this unit, so that making one never takes the place of a texture a pass has bound
    function texture(name, w, h, ifmt, fmt, data) {              // (re)made when its size changes, filled with data (a typed array of w * h texels) when given
      gl.activeTexture(gl.TEXTURE0 + SCRATCH_UNIT);
      let e = tex[name];
      if (!e || e.w !== w || e.h !== h || e.ifmt !== ifmt) {
        if (e) gl.deleteTexture(e.t);
        const t = gl.createTexture();
        gl.bindTexture(T2, t);
        gl.texParameteri(T2, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(T2, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(T2, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(T2, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(T2, 1, ifmt, w, h);
        e = tex[name] = { t: t, w: w, h: h, ifmt: ifmt };
      }
      if (data) { gl.bindTexture(T2, e.t); gl.texSubImage2D(T2, 0, 0, 0, w, h, fmt, F, data); }
      return e.t;
    }
    function bind(unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(T2, t); }
    function bind3(unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_3D, t); }
    function pad_to(a, n) { if (a.length === n) return a; const b = new Float32Array(n); b.set(a.length > n ? a.subarray(0, n) : a); return b; }

    // ---- the volumes (the volumes section): every volume of a compiled def in ONE 3D texture (R32F), their slices one after the other along z, and a table of where each one is. A shader cannot
    // index an array of samplers, and the def may name several volumes: one texture it is. A def that names none gets a texture of one sample (a sampler must have a texture of its type bound).
    // It is made again only when the set of volumes changes. A set the GPU cannot hold (a side over MAX_3D_TEXTURE_SIZE) is meshed by the CPU path for that build (can_volumes).
    const max_3d = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE) || 256;
    let vols_key = null, vols_tex = null, vols_info = null, vols_dims = "";
    function volume_atlas(vols) {
      let w = 1, h = 1, d = 0;
      vols.forEach(function (v) { if (v.nx > w) w = v.nx; if (v.ny > h) h = v.ny; d += v.nz; });
      return { w: w, h: h, d: Math.max(1, d) };
    }
    function can_volumes(comp) {
      if (!comp.vols || !comp.vols.length) return true;
      const a = volume_atlas(comp.vols);
      return a.w <= max_3d && a.h <= max_3d && a.d <= max_3d;
    }
    function upload_volumes(comp) {
      const vols = comp.vols || [], key = vols.map(function (v) { return v.id + ":" + v.version + ":" + v.nx + "x" + v.ny + "x" + v.nz; }).join("|");
      if (vols_tex && key === vols_key) return { vol: vols_tex, info: vols_info };
      gl.activeTexture(gl.TEXTURE0 + SCRATCH_UNIT);
      if (vols_tex) { gl.deleteTexture(vols_tex); vols_tex = null; }
      const a = volume_atlas(vols), t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_3D, t);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
      gl.texStorage3D(gl.TEXTURE_3D, 1, gl.R32F, a.w, a.h, a.d);
      const info = new Float32Array(Math.max(1, vols.length) * 8);
      let z0 = 0;
      vols.forEach(function (v, i) {
        gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, z0, v.nx, v.ny, v.nz, gl.RED, F, v.data);
        info[i * 8] = v.ox; info[i * 8 + 1] = v.oy; info[i * 8 + 2] = v.oz; info[i * 8 + 3] = v.inv; info[i * 8 + 4] = v.nx; info[i * 8 + 5] = v.ny; info[i * 8 + 6] = v.nz; info[i * 8 + 7] = z0;
        z0 += v.nz;
      });
      vols_tex = t; vols_key = key;
      vols_info = texture("vinfo", 2, Math.max(1, vols.length), gl.RGBA32F, gl.RGBA, info);
      return { vol: vols_tex, info: vols_info };
    }
    // the volume textures of a pass: both programs of a build bind them (a sampler that nothing is bound to is an error at the draw)
    function bind_volumes(pr, comp) {
      const tv = upload_volumes(comp);
      bind3(6, tv.vol); gl.uniform1i(uni(pr, "u_vol"), 6);
      bind(7, tv.info); gl.uniform1i(uni(pr, "u_vinfo"), 7);
    }

    // the cull lists of a CSR as the two textures the shaders read (cell table: (start, count) per block; list: indices, 2048 per row)
    function upload_csr(prefix, csr) {
      const nb = csr.nblocks, crows = Math.max(1, Math.ceil(nb / 4096)), cdata = new Float32Array(4096 * crows * 4);
      for (let b = 0; b < nb; b++) { cdata[b * 4] = csr.start[b]; cdata[b * 4 + 1] = csr.start[b + 1] - csr.start[b]; }
      const lrows = Math.max(1, Math.ceil(csr.list.length / 2048)), ldata = new Float32Array(2048 * lrows);
      for (let i = 0; i < csr.list.length; i++) ldata[i] = csr.list[i];
      return { cell: texture(prefix + "cell", 4096, crows, gl.RGBA32F, gl.RGBA, cdata), list: texture(prefix + "list", 2048, lrows, gl.R32F, gl.RED, ldata) };
    }

    // the primitive tables and the part colours (what every pass reads); uploaded once for a compiled def
    let tables_of = null, tables_tex = null;
    function upload_tables(comp) {
      if (tables_of === comp) return tables_tex;
      tables_of = comp;
      tables_tex = upload_tables_now(comp);
      return tables_tex;
    }
    function upload_tables_now(comp) {
      const n = comp.n, p32 = new Float32Array(comp.prim.length), l32 = new Float32Array(comp.lx.length);
      for (let i = 0; i < p32.length; i++) p32[i] = comp.prim[i];
      for (let i = 0; i < l32.length; i++) l32[i] = comp.lx[i];
      const parts = comp.parts, c32 = new Float32Array(Math.max(1, parts.length) * 4);
      parts.forEach(function (p, i) { c32[i * 4] = p.color[0]; c32[i * 4 + 1] = p.color[1]; c32[i * 4 + 2] = p.color[2]; c32[i * 4 + 3] = p.color[3]; });
      return { prim: texture("prim", 5, n, gl.RGBA32F, gl.RGBA, p32), lx: texture("lx", 7, n, gl.RGBA32F, gl.RGBA, l32), part: texture("part", Math.max(1, parts.length), 1, gl.RGBA32F, gl.RGBA, c32) };
    }

    // (getError and checkFramebufferStatus are answered by the GPU process: each one is a round trip of 0.1 to 0.2 ms, and a build used to make a dozen. The errors are read once at the end of volume() and
    //  vertex() - a WebGL error stays until it is read - and a framebuffer layout is checked the first time it is used (the self test uses them all); options.debug_gl checks after every stage)
    const debug_gl = !!options.debug_gl;
    function check(stage) { if (!debug_gl) return; const e = gl.getError(); if (e !== gl.NO_ERROR) throw new Error("WebGL error " + e + " after " + stage); }

    const fbo = gl.createFramebuffer();
    const rt = {};                                               // render targets: name -> { t, w, h }
    function target(name, w, h) {
      gl.activeTexture(gl.TEXTURE0 + SCRATCH_UNIT);
      let e = rt[name];
      if (!e || e.w !== w || e.h !== h) {
        if (e) gl.deleteTexture(e.t);
        const t = gl.createTexture();
        gl.bindTexture(T2, t);
        gl.texStorage2D(T2, 1, gl.RGBA32F, w, h);
        e = rt[name] = { t: t, w: w, h: h };
      }
      return e.t;
    }
    const fbo_ok = {};
    function check_fbo(layout) {
      if (fbo_ok[layout] && !debug_gl) return;
      const s = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (s !== gl.FRAMEBUFFER_COMPLETE) throw new Error("framebuffer incomplete (" + s + ")");
      fbo_ok[layout] = true;
    }

    // ---- the samples -------------------------------------------------------------------------------------------------------------------------------------------------------------
    // The grid is drawn in chunks of planes (overlapping by one plane, so every layer of cells has both its planes in one chunk): a chunk is an atlas, tx x ty slices of ceil(nx / 4) x ny texels,
    // 4 samples a texel along x. A chunk is at most max_texture texels wide and high and about 6M samples.
    function plan_chunks(n, max_chunk_samples) {
      const nx = n[0], ny = n[1], nz = n[2], sw = Math.ceil(nx / 4);
      if (sw > max_texture || ny > max_texture) throw new Error("the grid is too big for this GPU (" + nx + " x " + ny + " samples a plane, textures up to " + max_texture + ")");
      const tx_max = Math.floor(max_texture / sw), ty_max = Math.floor(max_texture / ny);
      const kz = Math.max(2, Math.min(nz, tx_max * ty_max, Math.floor(max_chunk_samples / (nx * ny))));
      const chunks = [];
      for (let z0 = 0; z0 < nz - 1; z0 += kz - 1) {
        const planes = Math.min(kz, nz - z0), tx = Math.min(planes, tx_max), ty = Math.ceil(planes / tx);
        chunks.push({ z0: z0, planes: planes, tx: tx, ty: ty, sw: sw, w: tx * sw, h: ty * ny, data: null });
      }
      return { chunks: chunks, step: kz - 1, sw: sw };
    }

    function volume(comp, grid, ctx) {
      if (lost) throw new Error("the WebGL context was lost");
      const t_a = now();
      const tb = upload_tables(comp);
      check("uploading the primitive tables");
      const B = 8, csr = build_csr(comp, grid, B, 3 * grid.cell);
      const tl = upload_csr("s_", csr), t_b = now();
      check("uploading the cull lists");
      const pr = program("SAMPLE");
      gl.useProgram(pr.p);
      bind(0, tb.prim); gl.uniform1i(uni(pr, "u_prim"), 0);
      bind(1, tb.lx); gl.uniform1i(uni(pr, "u_lx"), 1);
      bind(2, tl.cell); gl.uniform1i(uni(pr, "u_cell"), 2);
      bind(3, tl.list); gl.uniform1i(uni(pr, "u_list"), 3);
      bind_volumes(pr, comp);
      const n = grid.n;
      gl.uniform3i(uni(pr, "u_n"), n[0], n[1], n[2]); gl.uniform1i(uni(pr, "u_B"), B); gl.uniform3i(uni(pr, "u_nb"), csr.nb[0], csr.nb[1], csr.nb[2]);
      gl.uniform3f(uni(pr, "u_o"), grid.origin[0], grid.origin[1], grid.origin[2]); gl.uniform1f(uni(pr, "u_h"), grid.cell);
      const plan = plan_chunks(n, options.chunk_samples || 6000000);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]); gl.readBuffer(gl.COLOR_ATTACHMENT0);
      let ms_draw = 0, ms_read = 0;
      plan.chunks.forEach(function (ch, ci) {
        const t = target("atlas", ch.w, ch.h);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, T2, t, 0);
        if (ci === 0) check_fbo("atlas");
        gl.viewport(0, 0, ch.w, ch.h);
        gl.uniform1i(uni(pr, "u_sw"), ch.sw); gl.uniform1i(uni(pr, "u_tx"), ch.tx); gl.uniform1i(uni(pr, "u_z0"), ch.z0);
        check("setting up chunk " + ci);
        const t0 = now();
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        check("drawing chunk " + ci);
        const t1 = now();
        const buf = take_f32(ch.w * ch.h * 4);
        ch.base = buf.base; ch.data = buf.view;
        gl.readPixels(0, 0, ch.w, ch.h, gl.RGBA, F, ch.data);           // (this waits for the draw)
        check("reading chunk " + ci);
        const t2 = now();
        ms_draw += t1 - t0; ms_read += t2 - t1;
      });
      const err = gl.getError();
      if (err !== gl.NO_ERROR) throw new Error("WebGL error " + err + " while sampling");
      const nx = n[0], ny = n[1], step = plan.step, chunks = plan.chunks;
      const vol = {
        nx: nx, ny: ny, nz: n[2], active: { B: csr.B, nb: csr.nb, start: csr.start },
        layer: function (z, out) {
          const ch = chunks[Math.floor(z / step)], zi = z - ch.z0, sw = ch.sw, w = ch.w;
          const ta = zi % ch.tx, ya = Math.floor(zi / ch.tx), tb2 = (zi + 1) % ch.tx, yb = Math.floor((zi + 1) / ch.tx);
          out.data = ch.data;
          for (let y = 0; y < ny; y++) { out.a[y] = ((ya * ny + y) * w + ta * sw) * 4; out.b[y] = ((yb * ny + y) * w + tb2 * sw) * 4; }
        }
      };
      ctx.gpu_csr = csr;
      return { recycle: function () { chunks.forEach(function (c) { if (c.base) give_f32(c.base); c.base = null; c.data = null; }); }, vol: vol, stats: { upload: t_b - t_a, lists: csr.entries, chunks: chunks.length, draw_and_wait: ms_draw, readback: ms_read, readback_mb: chunks.reduce(function (a, c) { return a + c.data.byteLength; }, 0) / 1048576 } };
    }

    // ---- per vertex ----------------------------------------------------------------------------------------------------------------------------------------------------------------
    function vertex(comp, grid, mesh, want, ctx) {
      if (lost) throw new Error("the WebGL context was lost");
      const st = comp.settings, nv = mesh.nv, cell = grid.cell, t_a = now();
      const tb = upload_tables(comp);
      const reach = pass_reach(comp, st, cell), Bv = Math.max(4, Math.min(16, Math.round(reach / cell)));
      const csr = build_csr(comp, grid, Bv, reach), tl = upload_csr("v_", csr);
      const VW = 2048, VH = Math.ceil(nv / VW);
      if (VH > max_texture) throw new Error("too many vertices for this GPU");
      const pos = new Float32Array(VW * VH * 4);
      for (let i = 0; i < nv; i++) { pos[i * 4] = mesh.positions[i * 3]; pos[i * 4 + 1] = mesh.positions[i * 3 + 1]; pos[i * 4 + 2] = mesh.positions[i * 3 + 2]; }
      const tpos = texture("pos", VW, VH, gl.RGBA32F, gl.RGBA, pos);
      const t_b = now();
      const out = { normals: new Float32Array(nv * 3), uvs: null, part_ids: want.part_ids ? new Uint16Array(nv) : null, colors: want.colors ? new Float32Array(nv * 4) : null, bone_indices: null, bone_weights: null, stats: {} };
      const uv_parts = want.uvs && comp.use_uvs && !out.part_ids ? new Uint16Array(nv) : null;      // (a part with its own uv offset needs the part ids even when the caller does not)
      const parts_pass = function (name, bind_extra) {
        const pr = program(name);
        gl.useProgram(pr.p);
        bind(0, tb.prim); gl.uniform1i(uni(pr, "u_prim"), 0);
        bind(1, tb.lx); gl.uniform1i(uni(pr, "u_lx"), 1);
        bind(2, tl.cell); gl.uniform1i(uni(pr, "u_cell"), 2);
        bind(3, tl.list); gl.uniform1i(uni(pr, "u_list"), 3);
        bind(4, tpos); gl.uniform1i(uni(pr, "u_pos"), 4);
        bind_volumes(pr, comp);
        gl.uniform1i(uni(pr, "u_nv"), nv);
        gl.uniform3f(uni(pr, "u_o"), grid.origin[0], grid.origin[1], grid.origin[2]); gl.uniform1f(uni(pr, "u_cs"), csr.cs); gl.uniform3i(uni(pr, "u_nb"), csr.nb[0], csr.nb[1], csr.nb[2]);
        if (bind_extra) bind_extra(pr);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        const a = target(name + "0", VW, VH), b = target(name + "1", VW, VH);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, T2, a, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, T2, b, 0);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        check_fbo("mrt");
        gl.viewport(0, 0, VW, VH);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const b0 = take_f32(VW * VH * 4), b1 = take_f32(VW * VH * 4), d0 = b0.view, d1 = b1.view;
        gl.readBuffer(gl.COLOR_ATTACHMENT0); gl.readPixels(0, 0, VW, VH, gl.RGBA, F, d0);
        gl.readBuffer(gl.COLOR_ATTACHMENT1); gl.readPixels(0, 0, VW, VH, gl.RGBA, F, d1);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, T2, null, 0);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]); gl.readBuffer(gl.COLOR_ATTACHMENT0);
        return [d0, d1, b0.base, b1.base];
      };
      // the normal, the owning part and the colour
      let t0 = now();
      const sh = parts_pass("SHADE", function (pr) {
        bind(5, tb.part); gl.uniform1i(uni(pr, "u_part"), 5);
        const ao = want.colors ? st.ao : 0, tone = want.colors ? st.tone : 0, cb = want.colors ? st.color_blend : 0;
        gl.uniform1f(uni(pr, "u_gh"), 0.3 * cell);
        gl.uniform1i(uni(pr, "u_flags"), (want.colors ? 1 : 0) | (ao > 0 ? 2 : 0) | (tone !== 0 ? 4 : 0) | (cb > 0 ? 8 : 0));
        gl.uniform1f(uni(pr, "u_ao"), ao); gl.uniform1f(uni(pr, "u_ao_r"), st.ao_radius > 0 ? st.ao_radius : 0.12); gl.uniform1f(uni(pr, "u_tone"), tone);
        gl.uniform1f(uni(pr, "u_cb"), cb); gl.uniform1f(uni(pr, "u_wcell"), 0.5 * cell);
      });
      const n0 = sh[0], c0 = sh[1];
      for (let i = 0; i < nv; i++) {
        out.normals[i * 3] = n0[i * 4]; out.normals[i * 3 + 1] = n0[i * 4 + 1]; out.normals[i * 3 + 2] = n0[i * 4 + 2];
        if (out.part_ids) out.part_ids[i] = n0[i * 4 + 3];
        else if (uv_parts) uv_parts[i] = n0[i * 4 + 3];
      }
      if (out.colors) out.colors.set(c0.subarray(0, nv * 4));
      give_f32(sh[2]); give_f32(sh[3]);
      out.stats.shade = now() - t0;
      if (want.skin && comp.skin) {
        t0 = now();
        const sk = parts_pass("SKIN", function (pr) {
          gl.uniform1f(uni(pr, "u_falloff"), st.skin_falloff); gl.uniform1f(uni(pr, "u_minblend"), st.skin_min_blend > 0 ? st.skin_min_blend : 0.5 * cell); gl.uniform1f(uni(pr, "u_range"), st.skin_range);
        });
        out.bone_indices = new Uint8Array(nv * 4); out.bone_weights = new Float32Array(nv * 4);
        for (let i = 0; i < nv * 4; i++) { out.bone_indices[i] = sk[0][i] + 0.5; out.bone_weights[i] = sk[1][i]; }
        give_f32(sk[2]); give_f32(sk[3]);
        out.stats.skin = now() - t0;
      }
      const err = gl.getError();
      if (err !== gl.NO_ERROR) throw new Error("WebGL error " + err + " in the vertex passes");
      if (want.uvs) out.uvs = box_uvs(comp, mesh, out.normals, out.part_ids || uv_parts);
      out.stats.upload = t_b - t_a; out.stats.list_entries = csr.entries;
      return out;
    }

    function dispose() {
      Object.keys(tex).forEach(function (k) { gl.deleteTexture(tex[k].t); });
      Object.keys(rt).forEach(function (k) { gl.deleteTexture(rt[k].t); });
      if (vols_tex) { gl.deleteTexture(vols_tex); vols_tex = null; }
      Object.keys(programs).forEach(function (k) { gl.deleteProgram(programs[k].p); });
      gl.deleteFramebuffer(fbo);
      const ext = gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext();
      lost = true;
    }

    const backend = {
      ok: true, name: "gpu", volume: volume, vertex: vertex, dispose: dispose, can_volumes: can_volumes,
      info: { backend: "gpu", reason: software ? "a software renderer, allowed" : "", renderer: renderer, canvas: cx.kind, software: software, max_texture: max_texture }
    };

    // ---- a self test: a sphere through the whole path. A driver that cannot do float targets or reads back garbage is found here, not in the user's first mesh
    if (options.skip_self_test) return backend;
    try {
      const def = { cell: 0.1, part_ids: true, parts: [{ id: "s", shape: "sphere", center: [0, 0, 0], radius: 0.5, color: [1, 0, 0, 1] }] };
      const comp = compile(def), grid = make_grid(comp, 0.1, 1e6), c = {};
      const v = volume(comp, grid, c), mesh = surface_nets(v.vol, grid, {});
      if (mesh.nv < 50) throw new Error("the sphere has " + mesh.nv + " vertices");
      const vd = vertex(comp, grid, mesh, { part_ids: true, colors: true, uvs: false, skin: false }, c);
      let worst = 1;
      for (let i = 0; i < mesh.nv; i++) {
        const x = mesh.positions[i * 3], y = mesh.positions[i * 3 + 1], z = mesh.positions[i * 3 + 2], r = Math.hypot(x, y, z);
        if (Math.abs(r - 0.5) > 0.06) throw new Error("a vertex is " + r.toFixed(3) + " from the centre");
        worst = Math.min(worst, (vd.normals[i * 3] * x + vd.normals[i * 3 + 1] * y + vd.normals[i * 3 + 2] * z) / r);
      }
      if (worst < 0.97) throw new Error("the normals disagree with the shape (" + worst.toFixed(3) + ")");
      if (vd.colors[0] !== 1 || vd.colors[1] !== 0) throw new Error("the colours are wrong");
      // a second one with bones and every kind of shading: the skin pass, ambient occlusion, tone and soft colours are drawn once here, not in the middle of the user's first build
      const def2 = { cell: 0.1, shade: { ao: 0.5, ao_radius: 0.1, tone: 0.2, color_blend: 0.5 }, bones: [{ name: "b", head: [0, 0, 0], tail: [0, 0.2, 0] }],
        parts: [{ id: "s", shape: "sphere", center: [0, 0, 0], radius: 0.5, color: [1, 0, 0, 1], bone: "b", blend: 0.1 }, { id: "t", shape: "capsule", a: [0, 0, 0], b: [0.6, 0, 0], radius: 0.2, color: [0, 1, 0, 1], bone: "b", blend: 0.1 }] };
      const comp2 = compile(def2), grid2 = make_grid(comp2, 0.1, 1e6), c2 = {}, v2 = volume(comp2, grid2, c2), mesh2 = surface_nets(v2.vol, grid2, {});
      if (v2.recycle) v2.recycle();
      vertex(comp2, grid2, mesh2, { part_ids: true, colors: true, uvs: true, skin: true }, c2);
    } catch (e) {
      try { backend.dispose(); } catch (e2) { /* gone */ }
      return { ok: false, reason: "the self test failed: " + String(e && e.message || e), renderer: renderer };
    }
    backend.info.compile_ms = compile_ms;
    return backend;
  }

  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // engine - one mesher: compile the def, sample the field on a grid, extract the surface, then compute what each vertex needs. The samples and the per-vertex passes are done by a BACKEND:
  // the GPU (the gpu section, WebGL2) or the CPU (the cpu section); everything else is the same code, so both give the same geometry.
  //
  //   const eng = happy_mesher.create_engine({ prefer: "auto" | "gpu" | "cpu", allow_software: false, ... });     // sync; eng.info says what was chosen and why
  //   const geo = eng.build(def, { cell, part_ids, shade, skin, uvs, ... });                                    // -> Geometry (below), sync
  //   eng.dispose()
  //
  // Geometry = {
  //   positions Float32Array 3 nv, normals Float32Array 3 nv, uvs Float32Array 2 nv | null, indices Uint32Array 3 nt (counter clockwise seen from outside),
  //   colors Float32Array 4 nv | null (the part colours, soft colours, baked occlusion and tone), part_ids Uint16Array nv | null,
  //   bone_indices Uint8Array 4 nv | null, bone_weights Float32Array 4 nv | null (the four strongest bones, weights sum to 1; a def with bones),
  //   bounds [minx, miny, minz, maxx, maxy, maxz], cell (the grid step that was used), parts [{ id, ... }] (what part_ids index), skeleton (the bones of the def) | null,
  //   stats { backend, vertices, triangles, samples, cell, requested_cell, ms: { compile, grid, sample, extract, vertex, total, ... }, ... } }
  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // ---- the CPU backend --------------------------------------------------------------------------------------------------------------------------------------
  function cpu_backend() {
    let scratch = null;
    return {
      name: "cpu",
      volume: function (comp, grid, ctx) {
        const field = make_field(comp), B = 4, pad = cpu_pad(comp, grid.cell, B);
        const t0 = now(), csr = build_csr(comp, grid, B, pad), t1 = now();
        const s = cpu_sample(comp, grid, csr, field, { scratch: scratch });
        scratch = s.data;
        ctx.field = field;
        const vol = dense_volume(s.data, grid.n[0], grid.n[1], grid.n[2]);
        vol.active = { B: csr.B, nb: csr.nb, start: csr.start };
        return { vol: vol, stats: { lists: t1 - t0, list_entries: csr.entries, evaluated: s.evaluated, blocks: s.blocks, blocks_sampled: s.blocks_sampled } };
      },
      vertex: function (comp, grid, mesh, want, ctx) {
        const reach = pass_reach(comp, comp.settings, grid.cell);
        const t0 = now(), csr = build_csr(comp, grid, clamp(Math.round(reach / grid.cell), 4, 16), reach), t1 = now();
        if (!ctx.field) ctx.field = make_field(comp);
        const out = cpu_vertex_passes(comp, grid, mesh, csr, ctx.field, want);
        out.stats = { lists: t1 - t0, list_entries: csr.entries };
        return out;
      },
      dispose: function () { scratch = null; }
    };
  }

  // ---- the pipeline -------------------------------------------------------------------------------------------------------------------------------------------
  function create_engine(options) {
    options = options || {};
    const prefer = options.prefer || "auto";
    let backend = null, info = { backend: "cpu", reason: "" }, gpu_error = null;
    if (prefer !== "cpu") {
      try {
        const g = gpu_backend(options);
        if (g.ok) { backend = g; info = g.info; }
        else gpu_error = g.reason;
      } catch (e) { gpu_error = String(e && e.message || e); }
      if (!backend && prefer === "gpu") throw new Error("happy_mesher: no usable GPU (" + gpu_error + ")");
    }
    if (!backend) {
      backend = cpu_backend();
      info = { backend: "cpu", reason: prefer === "cpu" ? "requested" : (gpu_error || "no GPU backend in this environment") };
    }
    const cpu = backend.name === "cpu" ? backend : null;
    let fallback = cpu, scratch = {};                             // a GPU that fails in the middle of a build is replaced by the CPU for the rest of the session
    let last = {};                                                // the previous build, per island: its comp, grid, mesh and vertex data - a live edit that leaves an island's shape alone starts from it
    const GPU_FAILED = { gpu_failed: true };
    const volumes = new Map();                                    // id -> volume (the volumes section): what the parts of shape "volume" are made of

    // the backend a compiled def is built with: the engine's, except that volumes a GPU cannot hold (a side over MAX_3D_TEXTURE_SIZE) are meshed by the CPU path, for this build only
    function pick_backend(comp) {
      if (backend.name === "gpu" && comp.vols.length && backend.can_volumes && !backend.can_volumes(comp)) return fallback || (fallback = cpu_backend());
      return backend;
    }

    // one island: its grid, its samples, its surface, its vertex data (or what the last build of it left, when its shape did not change)
    function build_island(item, def, opts, want_all, ms, ctx_scratch) {
      const comp = item.comp, st = comp.settings, be = pick_backend(comp);
      const draft = opts.draft > 1, ad = draft ? null : st.adaptive, dec = draft ? null : st.decimate;      // a draft is a coarse uniform grid and nothing else
      let t = now();
      let grid;
      if (ad) grid = make_grid(comp, ad.min_cell, 1e12);                                            // the octree has no grid: the vertex passes use one of the finest cell
      else grid = make_grid(comp, draft ? st.cell * opts.draft : st.cell, st.max_samples);
      ms.grid += now() - t;
      const ctx = { scratch: ctx_scratch };
      const want = { part_ids: want_all.part_ids, colors: want_all.colors, uvs: want_all.uvs, skin: comp.skin && opts.skin !== false };
      const parts_key = comp.used_parts ? comp.used_parts.map(function (i) { return comp.parts[i]; }) : comp.parts;
      const key = JSON.stringify([want, st, parts_key, grid.cell, grid.n, comp.vols.map(function (v) { return v.id + ":" + v.version; }), comp.skeleton && has_volume_skin(comp) ? comp.skeleton.names : 0]);               // everything the vertex data depends on besides the shape
      const prev = last[item.name];
      let mesh, v = null, vd = null, reused = "", detail = null;
      if (prev && prev.backend === be.name && same_shape(prev.comp, comp) && prev.grid.cell === grid.cell && prev.grid.n.join() === grid.n.join()) {
        // the shape is the one of the last build: no sampling, no extraction (and when nothing else changed either, not even the vertex passes)
        mesh = { positions: prev.positions, nv: prev.nv, indices: prev.indices, ni: prev.ni };
        reused = prev.key === key ? "geometry" : "shape";
        if (reused === "geometry") vd = prev.vd;
        detail = prev.detail;
      } else if (ad) {
        t = now();
        const field = make_field(comp), ot = make_octree(comp, ad, field);
        ot.build_cpu();
        mesh = ot.contour();
        ctx.field = field;
        detail = { adaptive: ot.stats() };
        if (dec) { mesh = decimate_mesh(mesh, dec, ad.min_cell, ot.coarse_cell, ot.tools, decimation_colours(comp, mesh, dec)); detail.decimation = mesh.stats; }
        ms.extract += now() - t;
        if (mesh.nv === 0) throw new Error("happy_mesher: " + (item.name ? "the island '" + item.name + "'" : "the shape") + " produced no surface (check the radii and min_cell)");
      } else {
        t = now();
        try { v = be.volume(comp, grid, ctx); }
        catch (e) {
          if (be.name === "cpu") throw e;
          gpu_error = String(e && e.message || e);
          if (!fallback) fallback = cpu_backend();
          backend = fallback; info = { backend: "cpu", reason: "the GPU failed: " + gpu_error }; last = {};
          throw GPU_FAILED;
        }
        ms.sample += now() - t;
        t = now();
        mesh = surface_nets(v.vol, grid, scratch);
        scratch.pos = mesh.positions; scratch.idx = mesh.indices;
        if (v.recycle) v.recycle();
        if (mesh.nv === 0) throw new Error("happy_mesher: " + (item.name ? "the island '" + item.name + "'" : "the shape") + " produced no surface (check the radii and the cell size)");
        if (dec) {                                                                                  // a uniform mesh can be decimated too
          const field = ctx.field || make_field(comp);
          ctx.field = field;
          const tools = surface_tools(comp, field, build_csr(comp, grid, 4, cpu_pad(comp, grid.cell, 4)), grid, 0.3 * grid.cell);
          mesh = decimate_mesh(mesh, dec, grid.cell, grid.cell, tools, decimation_colours(comp, mesh, dec));
          detail = { decimation: mesh.stats };
        }
        ms.extract += now() - t;
      }
      t = now();
      if (!vd) { vd = be.vertex(comp, grid, mesh, want, ctx); volume_colors(comp, mesh, vd, grid, ctx); if (want.skin) volume_skin(comp, mesh, vd, grid, ctx); }
      ms.vertex += now() - t;
      // the geometry owns its arrays (a worker transfers them away): what is kept for the next build is a copy
      const nv = mesh.nv, positions = reused ? mesh.positions : mesh.positions.slice(0, nv * 3), indices = reused ? mesh.indices : mesh.indices.slice(0, mesh.ni);
      return { name: item.name, comp: comp, grid: grid, key: key, backend: be.name, positions: positions, indices: indices, nv: nv, ni: mesh.ni, vd: vd, reused: reused, sample_detail: v ? v.stats || null : detail, detail: detail };
    }

    function cat(pieces, field, stride, make) {                    // the per-vertex array of every island in one (null when no island has it)
      if (!pieces.some(function (p) { return p.vd[field]; })) return null;
      let nv = 0; pieces.forEach(function (p) { nv += p.nv; });
      const out = make(nv * stride);
      let o = 0;
      pieces.forEach(function (p) { const a = p.vd[field]; if (a) out.set(a.subarray(0, p.nv * stride), o * stride); o += p.nv; });
      return out;
    }

    function build(def, opts) {
      opts = opts || {};
      const T0 = now(), ms = { compile: 0, grid: 0, sample: 0, extract: 0, vertex: 0 };
      let t = now();
      const comp = compile(def, Object.assign({}, opts, { volumes: volumes }));
      ms.compile = now() - t;
      const st = comp.settings, items = island_list(comp, def, opts);
      const keep_ids = st.part_ids || opts.part_ids === true, vol_col = (comp.vols.some(function (v) { return !!(v.attr && v.attr.colors); }) && opts.colors !== false) || (comp.skin && opts.skin !== false && has_volume_skin(comp));
      const want = { part_ids: keep_ids || vol_col, colors: (comp.use_colors || st.ao > 0 || st.tone !== 0) && opts.colors !== false, uvs: opts.uvs !== false };       // (the colours of a volume are put on the vertices it owns: the passes tell which)
      const pieces = [];
      try { items.forEach(function (item) { pieces.push(build_island(item, def, opts, want, ms, scratch)); }); }
      catch (e) { if (e === GPU_FAILED) return build(def, opts); throw e; }
      const kept = {};
      pieces.forEach(function (p) { if (p.reused !== "geometry" || !last[p.name]) kept[p.name] = { backend: p.backend, comp: p.comp, grid: p.grid, key: p.key, positions: p.positions, indices: p.indices, nv: p.nv, ni: p.ni, vd: p.vd, detail: p.detail }; else kept[p.name] = last[p.name]; });
      last = kept;
      // one geometry: the vertices grouped by island, the indices of every island offset to its own vertices
      let nv = 0, ni = 0;
      pieces.forEach(function (p) { nv += p.nv; ni += p.ni; });
      const positions = new Float32Array(nv * 3), indices = new Uint32Array(ni), ranges = [];
      let vo = 0, io = 0;
      pieces.forEach(function (p) {
        positions.set(p.positions.subarray(0, p.nv * 3), vo * 3);
        for (let i = 0; i < p.ni; i++) indices[io + i] = p.indices[i] + vo;
        ranges.push({ name: p.name, vertex_start: vo, vertex_count: p.nv, index_start: io, index_count: p.ni, cell: p.grid.cell, reused: p.reused, backend: p.backend, samples: p.grid.total, grid: p.grid.n.slice(), adaptive: p.detail && p.detail.adaptive || null, decimation: p.detail && p.detail.decimation || null });
        vo += p.nv; io += p.ni;
      });
      const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { const p = positions[i * 3 + k]; if (p < b[k]) b[k] = p; if (p > b[k + 3]) b[k + 3] = p; }
      const first = pieces[0];
      let all_geometry = true, all_reused = true, samples = 0, coarsened = false, min_cell = Infinity;
      pieces.forEach(function (p) { if (p.reused !== "geometry") all_geometry = false; if (p.reused === "") all_reused = false; samples += p.grid.total; if (p.grid.coarsened) coarsened = true; if (p.grid.cell < min_cell) min_cell = p.grid.cell; });
      const folded = {}, dropped = {};                                                // (the names of rigged volumes' skins that went to the host's chain or to nothing: skin_name_map; a typo in a bone_map shows here)
      pieces.forEach(function (p) { const s = p.vd && p.vd.skin_names; if (s) { s.folded.forEach(function (k) { folded[k] = 1; }); s.dropped.forEach(function (k) { dropped[k] = 1; }); } });
      ms.total = now() - T0;
      return {
        positions: positions, normals: cat(pieces, "normals", 3, function (n) { return new Float32Array(n); }), uvs: cat(pieces, "uvs", 2, function (n) { return new Float32Array(n); }), indices: indices,
        colors: cat(pieces, "colors", 4, function (n) { return new Float32Array(n); }), part_ids: keep_ids ? cat(pieces, "part_ids", 1, function (n) { return new Uint16Array(n); }) : null,
        bone_indices: cat(pieces, "bone_indices", 4, function (n) { return new Uint8Array(n); }), bone_weights: cat(pieces, "bone_weights", 4, function (n) { return new Float32Array(n); }),
        bounds: b, cell: min_cell, parts: comp.parts.map(function (p) { return { id: p.id, source: p.source, bone: p.bone, bone_name: p.bone_name, color: p.color }; }),
        skeleton: comp.skeleton ? comp.skeleton.bones : null, islands: ranges,
        stats: { backend: pieces.every(function (p) { return p.backend === pieces[0].backend; }) ? pieces[0].backend : "mixed", reused: all_geometry ? "geometry" : (all_reused ? "shape" : ""), vertices: nv, triangles: ni / 3, samples: samples, cell: min_cell, requested_cell: st.cell, coarsened: coarsened, grid: first.grid.n.slice(), primitives: comp.n, islands: ranges.length, ms: ms,
          skin_folded: Object.keys(folded).length, skin_folded_names: Object.keys(folded).slice(0, 64), skin_dropped: Object.keys(dropped).length, skin_dropped_names: Object.keys(dropped).slice(0, 64),
          detail: { sample: first.sample_detail, vertex: first.vd.stats || null } }
      };
    }
    // the volumes this engine knows (a part of shape "volume" names one by its id). A volume that is set again under an id that is taken replaces it (its version goes up, so nothing built from the old one is reused)
    function set_volume(v) {
      const old = volumes.get(v && v.id);
      prepare_volume(v);
      if (old && old !== v) v.version = Math.max(v.version, old.version + 1);
      volumes.set(v.id, v);
      return v;
    }
    return {
      get info() { return info; },
      build: build,
      compile: function (def, opts) { return compile(def, Object.assign({}, opts, { volumes: volumes })); },
      set_volume: set_volume,
      drop_volume: function (id) { return volumes.delete(String(id)); },
      get_volume: function (id) { return volumes.get(String(id)) || null; },
      volume_ids: function () { return Array.from(volumes.keys()); },
      // a triangle mesh baked to a volume and kept here (bake_mesh makes it: see the bake section for the mesh and the options)
      bake: function (mesh, bopts) { return set_volume(bake_mesh(mesh, bopts)); },
      dispose: function () { if (backend && backend.dispose) backend.dispose(); if (fallback && fallback !== backend && fallback.dispose) fallback.dispose(); backend = null; volumes.clear(); }
    };
  }

  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // host - the public API: a mesher that runs in a Web Worker when it can (the page never waits for a build), on the page's thread when it has to, and sessions for live editing.
  //
  //   const mesher = await happy_mesher.create({ prefer: "auto" | "gpu" | "cpu", thread: "auto" | "worker" | "main", allow_software: false });
  //   mesher.info                         { backend: "gpu" | "cpu", thread: "worker" | "main", renderer, canvas: "offscreen" | "canvas", reason, ... }
  //   const geo = await mesher.build(def, { cell, ... });          one build -> Geometry (create_engine says what it holds). The arrays are the caller's: from a worker they are transferred, not copied.
  //   const live = mesher.session({ progressive: true, draft: 3, settle_ms: 120 });
  //   live.on_geometry = (geo, meta) => { ... };                  meta = { quality: "draft" | "final", seq, ms, stale }
  //   live.update(def, opts)  -> Promise<Geometry | null>         for live editing: call it on every change. Builds never queue up behind each other: a build that is waiting when a newer
  //                                                               update arrives is dropped (its promise resolves null); one that is running finishes and is delivered (stale: true).
  //                                                               progressive: the first answer is a DRAFT (the grid `draft` times coarser, no baked shading or skin), the FINAL (full quality)
  //                                                               follows when no update has come for settle_ms. The promise is the final's. A final that is slow (an adaptive / decimated def) is made by a
  //                                                               second worker (the CPU path only, started on the first such job: `info.slow`; create({ slow_lane: false }) keeps one lane), so the drafts of
  //                                                               the next edit never wait for it; a slow final that a newer update has overtaken is not delivered.
  //   live.dispose(); mesher.dispose()
  //
  // Where things run: a worker has no `document`, so its GPU context is an OffscreenCanvas; when the worker cannot make one (no OffscreenCanvas / no WebGL2 in workers) and there is a GPU
  // on the page's thread, the mesher runs there with a canvas of the page; when there is no GPU at all it is the CPU path, in the worker.
  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const IN_WORKER = typeof WorkerGlobalScope !== "undefined" && typeof self !== "undefined" && self instanceof WorkerGlobalScope;
  const ARRAYS = ["positions", "normals", "uvs", "indices", "colors", "part_ids", "bone_indices", "bone_weights"];

  function transfer_list(geo) {
    const list = [], seen = new Set();
    ARRAYS.forEach(function (k) { const a = geo[k]; if (a && a.buffer && !seen.has(a.buffer)) { seen.add(a.buffer); list.push(a.buffer); } });
    return list;
  }
  // the buffers of a mesh that is sent to be baked (its arrays and its pictures): they are GIVEN to the worker (the caller's arrays are empty afterwards)
  function mesh_buffers(mesh) {
    const list = [], seen = new Set(), add = function (a) { if (a && a.buffer && a.buffer instanceof ArrayBuffer && !seen.has(a.buffer)) { seen.add(a.buffer); list.push(a.buffer); } };
    ["positions", "indices", "colors", "uvs", "material_ids", "material_texture", "joints", "weights"].forEach(function (k) { add(mesh[k]); });
    (mesh.textures || []).forEach(function (t) { add(t && t.data); });
    return list;
  }

  // ---- the worker's side ------------------------------------------------------------------------------------------------------------------------------------------------------
  function worker_main() {
    let engine = null;
    self.onmessage = function (e) {
      const m = e.data;
      try {
        if (m.type === "init") { engine = create_engine(m.options); self.postMessage({ id: m.id, ok: true, info: engine.info }); }
        else if (m.type === "build") { const geo = engine.build(m.def, m.opts); self.postMessage({ id: m.id, ok: true, geometry: geo, info: engine.info }, transfer_list(geo)); }
        else if (m.type === "volume") { engine.set_volume(m.volume); self.postMessage({ id: m.id, ok: true }); }
        else if (m.type === "drop_volume") { engine.drop_volume(m.volume_id); self.postMessage({ id: m.id, ok: true }); }
        else if (m.type === "bake") {                                                    // the volume is kept here, and a copy goes back (the page keeps the master)
          const vol = engine.bake(m.mesh, Object.assign({}, m.opts, { progress: function (stage, fraction) { self.postMessage({ id: m.id, progress: true, stage: stage, fraction: fraction }); } })), copy = clone_volume(vol);
          self.postMessage({ id: m.id, ok: true, volume: copy }, volume_buffers(copy));
        }
        else if (m.type === "dispose") { if (engine) engine.dispose(); engine = null; self.close(); }
      } catch (err) { self.postMessage({ id: m.id, ok: false, error: String(err && err.message || err) }); }
    };
  }

  // ---- transports: how a job gets to an engine -----------------------------------------------------------------------------------------------------------------------------------
  function local_transport(engine) {
    return {
      run: function (def, opts) { return new Promise(function (res, rej) { setTimeout(function () { try { res({ geometry: engine.build(def, opts), info: engine.info }); } catch (e) { rej(e); } }, 0); }); },
      volume: function (v) { return new Promise(function (res, rej) { try { engine.set_volume(v); res(); } catch (e) { rej(e); } }); },
      drop_volume: function (id) { return Promise.resolve(engine.drop_volume(id)); },
      bake: function (mesh, opts, progress) { return new Promise(function (res, rej) { setTimeout(function () { try { res(engine.bake(mesh, Object.assign({}, opts, { progress: progress }))); } catch (e) { rej(e); } }, 0); }); },
      dispose: function () { engine.dispose(); }
    };
  }
  function worker_transport(w) {
    let next = 1;
    const pending = new Map();
    w.onmessage = function (e) {
      const m = e.data, p = pending.get(m.id);
      if (!p) return;
      if (m.progress) { if (p.progress) p.progress(m.stage, m.fraction); return; }
      pending.delete(m.id);
      if (m.ok) p.resolve(m); else p.reject(new Error(m.error));
    };
    w.onerror = function (e) {
      const err = new Error("the worker failed: " + (e && e.message || "unknown"));
      pending.forEach(function (p) { p.reject(err); });
      pending.clear();
    };
    const call = function (msg, transfer, progress) { return new Promise(function (resolve, reject) { const id = next++; pending.set(id, { resolve: resolve, reject: reject, progress: progress }); msg.id = id; w.postMessage(msg, transfer || []); }); };
    return {
      init: function (options) { return call({ type: "init", options: options }); },
      run: function (def, opts) { return call({ type: "build", def: def, opts: opts }).then(function (m) { return { geometry: m.geometry, info: m.info }; }); },
      volume: function (v) { return call({ type: "volume", volume: v }); },                                  // (a copy: the volume stays with the caller)
      drop_volume: function (id) { return call({ type: "drop_volume", volume_id: id }); },
      bake: function (mesh, opts, progress) { return call({ type: "bake", mesh: mesh, opts: opts }, mesh_buffers(mesh), progress).then(function (m) { return m.volume; }); },
      dispose: function () { try { w.postMessage({ type: "dispose" }); } catch (e) { /* gone */ } setTimeout(function () { try { w.terminate(); } catch (e) { /* gone */ } }, 50); },
      kill: function () { try { w.terminate(); } catch (e) { /* gone */ } }          // now, whatever it is doing (a worker that is mid-build never reads a dispose message)
    };
  }

  // ---- the mesher: jobs one at a time, sessions that keep at most one waiting -----------------------------------------------------------------------------------------------------
  // Two lanes: the fast one is the mesher's own engine (a GPU when there is one) and takes everything that is quick; the octree and the decimation are CPU work that takes from a third of a second
  // to a second or two, so a job that asks for them goes to a lane of its own, a second worker that only has the CPU path (started when the first such job comes). A final of that kind never holds up
  // the drafts of the next edit. (Without workers there is one lane.)
  function wants_octree(def, opts) {
    opts = opts || {};
    if (opts.draft > 1) return false;                              // a draft is the coarse uniform grid
    const isl = def && typeof def.islands === "object" && def.islands ? def.islands : null;
    const asks = function (key) {
      if (opts[key] === false) return false;
      if (opts[key]) return true;
      if (def && def[key]) return true;
      if (isl) for (const n in isl) if (isl[n] && isl[n][key]) return true;
      return false;
    };
    return asks("adaptive") || asks("decimate");
  }

  function Mesher(transport, info, make_slow) {
    const self = this;
    let disposed = false, slow = null;
    const fast = { transport: transport, busy: false, queue: [], running: null, epoch: 0 };
    const masters = new Map();                                     // the volumes this mesher knows, by id: the page's copy (every lane has one of its own, made from it)
    this.info = info;
    this.volumes = masters;
    function pump(lane) {
      if (lane.busy || disposed || !lane.queue.length) return;
      const job = lane.queue.shift(), epoch = lane.epoch;
      lane.busy = true; lane.running = job;
      const t0 = now(), baking = job.kind === "bake";
      (baking ? lane.transport.bake(job.mesh, job.opts, job.progress) : lane.transport.run(job.def, job.opts)).then(function (r) {
        if (epoch !== lane.epoch) return;                          // (the lane was restarted since: this job was stopped and has been answered)
        lane.busy = false; lane.running = null;
        if (baking) job.resolve(r);
        else {
          if (lane === fast && r.info) self.info = Object.assign({}, self.info, { backend: r.info.backend, reason: r.info.reason });
          job.resolve({ geometry: r.geometry, ms: now() - t0 });
        }
        pump(lane);
      }, function (e) {
        if (epoch !== lane.epoch) return;
        lane.busy = false; lane.running = null;
        if (lane !== fast && lane.transport.dead) { fast.queue.push(job); pump(fast); }        // the second worker did not start: the fast lane does the job
        else job.reject(e);
        pump(lane);
      });
    }
    // the second lane (a worker with the CPU path only), made when the first job that wants it comes: the octree, the decimation, a bake. A lane that is new has no volumes: it is given copies
    function slow_lane() {
      if (!make_slow) return null;
      if (slow === null) {
        const t = make_slow();
        slow = t ? { transport: t, busy: false, queue: [], running: null, epoch: 0 } : false;
        if (slow) { self.info = Object.assign({}, self.info, { slow: { thread: "worker", backend: "cpu" } }); masters.forEach(function (v) { t.volume(v).then(null, function () { /* the lane is dead: its jobs go to the fast one */ }); }); }
      }
      return slow && !slow.transport.dead ? slow : null;
    }
    function lane_for(def, opts) {
      if (!make_slow || !wants_octree(def, opts)) return fast;
      return slow_lane() || fast;
    }
    this._submit = function (def, opts, session) {
      return new Promise(function (resolve, reject) {
        if (disposed) { reject(new Error("happy_mesher: the mesher was disposed")); return; }
        const lane = lane_for(def, opts);
        lane.queue.push({ def: def, opts: opts, resolve: resolve, reject: reject, session: session || null });
        pump(lane);
      });
    };
    this._drop = function (session, stop_slow) {                   // the waiting job of a session (not the one that is running) is replaced: take it out
      [fast, slow].forEach(function (lane) {
        if (!lane) return;
        for (let i = lane.queue.length - 1; i >= 0; i--) if (lane.queue[i].session === session) { const j = lane.queue.splice(i, 1)[0]; j.resolve(null); }
      });
      // a final that the second worker is making for this session and that a newer update has overtaken is of no use to anyone: the worker is stopped and started again (about 20 ms: it has no GPU
      // and no shaders to compile) instead of making the next final wait for it
      if (stop_slow && slow && slow.running && slow.running.session === session && !disposed) {
        const j = slow.running, t = make_slow();
        slow.epoch++; slow.running = null; slow.busy = false;
        (slow.transport.kill || slow.transport.dispose)();
        if (t) { slow.transport = t; masters.forEach(function (v) { t.volume(v).then(null, function () { }); }); }
        else slow.transport = { dead: true, run: function () { return Promise.reject(new Error("happy_mesher: the second worker did not start")); }, dispose: function () {} };
        j.resolve(null);
        pump(slow);
      }
    };
    this.build = function (def, opts) {
      return this._submit(def, opts || {}).then(function (r) {
        if (!r) throw new Error("happy_mesher: the mesher was disposed");        // (null: the job was taken out of the queue because the mesher went away)
        return r.geometry;
      });
    };
    this.session = function (options) { return new Session(this, options || {}); };
    // VOLUMES (the volumes section). add_volume(volume): the mesher keeps it (the page's own copy stays in mesher.volumes) and every lane gets a copy of its own, in order: a build that is
    // asked for after this call finds it. -> Promise of the volume.  remove_volume(id).  bake(mesh, opts, progress): bake_mesh in a worker (the second lane when there is one, so that the GPU
    // lane goes on meshing; the other lane is given a copy) -> Promise of the volume (also in mesher.volumes: a part { shape: "volume", volume: id } can use it). The mesh's arrays and pictures
    // are GIVEN to the worker (empty afterwards). progress(stage, fraction) is called as the bake goes ("weld", "cap", "decimate", "distance", "colors")
    this.add_volume = function (v) {
      prepare_volume(v);
      masters.set(v.id, v);
      const ps = [fast.transport.volume(v)];
      if (slow && !slow.transport.dead) ps.push(slow.transport.volume(v).then(null, function () { /* a second worker that is gone: its jobs go to the fast lane */ }));
      return Promise.all(ps).then(function () { return v; });
    };
    this.remove_volume = function (id) {
      id = String(id);
      masters.delete(id);
      const ps = [fast.transport.drop_volume(id)];
      if (slow && !slow.transport.dead) ps.push(slow.transport.drop_volume(id).then(null, function () { }));
      return Promise.all(ps).then(function () { return true; });
    };
    this.bake = function (mesh, opts, progress) {
      let lane = null;
      return new Promise(function (resolve, reject) {
        if (disposed) { reject(new Error("happy_mesher: the mesher was disposed")); return; }
        lane = slow_lane() || fast;
        lane.queue.push({ kind: "bake", mesh: mesh, opts: opts || {}, progress: progress, resolve: resolve, reject: reject, session: null });
        pump(lane);
      }).then(function (vol) {
        if (!vol) throw new Error("happy_mesher: the mesher was disposed");
        prepare_volume(vol);
        masters.set(vol.id, vol);
        const ps = [];
        [fast, slow].forEach(function (l) { if (l && l !== lane && !l.transport.dead) ps.push(l === fast ? l.transport.volume(vol) : l.transport.volume(vol).then(null, function () { })); });
        return Promise.all(ps).then(function () { return vol; });
      });
    };
    this.dispose = function () {
      disposed = true;
      masters.clear();
      [fast, slow].forEach(function (lane) {
        if (!lane) return;
        lane.queue.splice(0).forEach(function (j) { j.resolve(null); });
        if (lane.running) { lane.epoch++; lane.running.resolve(null); lane.running = null; lane.busy = false; }       // (a worker that is mid-build never answers)
        lane.transport.dispose();
      });
    };
  }

  // a worker that has only the CPU path, for the octree and the decimation (see Mesher); null when there are no workers. `dead` says that it never started
  function spawn_cpu_lane(options) {
    let url, w;
    try { url = URL.createObjectURL(new Blob([worker_source()], { type: "text/javascript" })); w = new Worker(url); }
    catch (e) { return null; }
    const t = worker_transport(w), lane = { dead: false };
    const ready = t.init(Object.assign({}, options, { prefer: "cpu" })).then(function (m) { URL.revokeObjectURL(url); return m; }, function (e) { URL.revokeObjectURL(url); lane.dead = true; throw e; });
    lane.run = function (def, opts) { return ready.then(function () { return t.run(def, opts); }); };
    lane.volume = function (v) { return ready.then(function () { return t.volume(v); }); };                          // (in the order they are asked in: before the builds that come after)
    lane.drop_volume = function (id) { return ready.then(function () { return t.drop_volume(id); }); };
    lane.bake = function (mesh, opts, progress) { return ready.then(function () { return t.bake(mesh, opts, progress); }); };
    lane.dispose = t.dispose;
    lane.kill = function () { URL.revokeObjectURL(url); t.kill(); };
    return lane;
  }

  function Session(mesher, options) {
    const self = this;
    const progressive = options.progressive !== false, draft = options.draft || 3, settle = options.settle_ms === undefined ? 120 : options.settle_ms;
    let seq = 0, timer = null, disposed = false, final_resolve = null;
    this.on_geometry = null;
    this.geometry = null;
    let delivered = 0;
    function deliver(geo, meta) {
      if (disposed || !geo || meta.seq < delivered) return;           // (a slow final of an older update that a newer update has already shown a draft of is not shown over it)
      delivered = meta.seq;
      self.geometry = geo;
      if (self.on_geometry) self.on_geometry(geo, meta);
    }
    // update(def, opts): def is snapshotted (a structured clone, or JSON) when the job is sent, so the caller may go on editing it
    this.update = function (def, opts) {
      if (disposed) return Promise.resolve(null);
      const my = ++seq;
      if (timer) { clearTimeout(timer); timer = null; }
      mesher._drop(self, progressive);                                         // (a progressive session shows drafts meanwhile: its slow final that is still running is stopped)
      if (final_resolve) { final_resolve(null); final_resolve = null; }       // the final of the update before this one will not come
      opts = opts || {};
      const snapshot = JSON.parse(JSON.stringify(def));
      const submit_final = function () {
        return mesher._submit(snapshot, opts, self).then(function (r) {
          if (!r) return null;
          const stale = my !== seq;
          deliver(r.geometry, { quality: "final", seq: my, ms: r.ms, stale: stale });
          return stale ? null : r.geometry;
        });
      };
      if (!progressive) return submit_final();
      return new Promise(function (resolve) {
        final_resolve = resolve;
        const dopts = Object.assign({}, opts, { draft: draft, shade: false, skin: false });
        mesher._submit(snapshot, dopts, self).then(function (r) {
          if (!r) return;
          deliver(r.geometry, { quality: "draft", seq: my, ms: r.ms, stale: my !== seq });
          if (my !== seq) return;
          timer = setTimeout(function () {                              // nothing newer came: the full quality
            timer = null;
            if (my !== seq) return;
            submit_final().then(function (g) { if (final_resolve === resolve) final_resolve = null; resolve(g); });
          }, settle);
        }, function () { resolve(null); });
      });
    };
    this.dispose = function () { disposed = true; if (timer) clearTimeout(timer); mesher._drop(self); if (final_resolve) final_resolve(null); };
  }

  // ---- create ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
  function capabilities() {
    return {
      worker: typeof Worker !== "undefined" && typeof Blob !== "undefined" && typeof URL !== "undefined" && !!URL.createObjectURL,
      offscreen_canvas: typeof OffscreenCanvas !== "undefined",
      document: typeof document !== "undefined",
      in_worker: IN_WORKER
    };
  }

  function create(options) {
    options = options || {};
    const caps = capabilities(), prefer = options.prefer || "auto", thread = options.thread || "auto";
    const slow = options.slow_lane === false ? null : function () { return spawn_cpu_lane(options); };         // the lane of the octree and the decimation (a worker with the CPU path)
    const main = function () {
      const eng = create_engine(options);
      return new Mesher(local_transport(eng), Object.assign({ thread: "main" }, eng.info));                 // (on the page's thread by request or for lack of workers: one lane)
    };
    return new Promise(function (resolve, reject) {
      if (thread === "main" || !caps.worker || IN_WORKER) { try { resolve(main()); } catch (e) { reject(e); } return; }
      let w, url;
      try { url = URL.createObjectURL(new Blob([worker_source()], { type: "text/javascript" })); w = new Worker(url); }
      catch (e) { if (thread === "worker") { reject(e); return; } try { resolve(main()); } catch (e2) { reject(e2); } return; }
      const t = worker_transport(w);
      t.init(options).then(function (m) {
        URL.revokeObjectURL(url);
        const info = Object.assign({ thread: "worker" }, m.info);
        if (info.backend === "gpu" || prefer === "cpu" || thread === "worker") { resolve(new Mesher(t, info, slow)); return; }
        // no GPU in the worker (no OffscreenCanvas or no WebGL2 there): the page's thread may have one
        let eng = null;
        try { const e = create_engine(Object.assign({}, options, { prefer: "gpu" })); if (e.info.backend === "gpu") eng = e; } catch (e) { eng = null; }
        if (eng) { t.dispose(); resolve(new Mesher(local_transport(eng), Object.assign({ thread: "main" }, eng.info), slow)); }
        else resolve(new Mesher(t, info, slow));
      }, function (e) {
        URL.revokeObjectURL(url);
        t.dispose();
        if (thread === "worker") { reject(e); return; }
        try { resolve(main()); } catch (e2) { reject(e2); }
      });
    });
  }

  // the source of a worker that has the whole library: this function itself (packing hands it over as plain code), started there and told to serve jobs
  function worker_source() { return "(" + happy_mesher.toString() + ")().worker_main();\n"; }

  return {
    version: "0.2.0",
    create: create,                      // async: a mesher (worker / GPU / CPU as available): build(def, opts), session(opts), info, dispose()
    capabilities: capabilities,          // what this environment can do: { worker, offscreen_canvas, document, in_worker }
    create_engine: create_engine,        // sync: one mesher on this thread (what runs inside the worker): build(def, opts), info, dispose()
    compile: compile,                    // def -> the primitive tables (plain data), for tools and tests (parts of shape "volume": compile(def, { volumes: Map of id -> volume }))
    bake_mesh: bake_mesh,                // a triangle mesh -> a volume (the volumes section): sync, on this thread; mesher.bake does it in a worker
    prepare_volume: prepare_volume,      // checks a volume and adds what the field needs (inv, mid, half), in place
    clone_volume: clone_volume,          // a copy of a volume that owns its arrays
    volume_place: volume_place,          // where a point of a volume's own frame stands in the def, by a part's center / origin, rotate, scale (and the mirror copy's): what places a piece's bones
    skin_probe: skin_probe,              // the seam pass at a point: the fold's shares, each rigged volume's file weights there, their mix (tests, looking)
    pose_skeleton: pose_skeleton,        // geo.skeleton + a pose -> the skin matrices (the pose section)
    encode_volume: encode_volume,        // a volume -> the bytes of a .sdfvol file (the volume file section)
    decode_volume: decode_volume,        // the bytes of a .sdfvol file -> a volume that is ready
    bytes_hash: bytes_hash,              // FNV-1a of bytes, 8 hex digits
    skin_geometry: skin_geometry,        // a geometry + skin matrices -> the geometry moved by them (positions, normals)
    make_field: make_field,              // the CPU field of compiled tables, the reference the GPU is tested against
    worker_main: worker_main             // the worker's side: serve build jobs (worker_source starts it)
  };
});

// ========================================================================================================================
// part_file
// ========================================================================================================================
packing()("happy_part_file", function happy_part_file() {
  "use strict";
  // THE PIECE FILE, format v1 (SYSTEM.md, STATUS: BUILD). One file a piece: `parts/catalog/<kind>/<id>.happypart`. A piece is a body part cut out of a rigged model (parts/build/): a CLOSED, decimated,
  // optimized, skinned mesh with vertex colours (textures baked in, no uvs), its bones, its socket(s), chain / ik hints, roles, material, quality scores, where it came from, and a small preview picture.
  // Pure (bytes in, objects out: no engine, no DOM, no files; node and the page run the same code; Node 14: no optional chaining, no ??, no async, no class).
  //
  //   use_meshpack(m)             the mesh codec: parts/optimize/mesh_optimize.js (its pack / unpack: the OPTIMIZER's "happy.meshpack"); node: part_file.use_meshpack(module_of(text)), the page: the module by its name
  //   write(piece, o?) -> Uint8Array          read(bytes, o?) -> piece          info(bytes) -> the header alone (no blob decoded: what a catalog lists)          validate(piece) -> [complaints]
  //   o (write): { normal_bits: 16 | 8 (the octahedral normals' precision, 16) }     o (read): { mesh: false (leave the mesh packed: piece.mesh_packed = { header, blobs }) }
  //
  // THE BYTES (little endian):
  //   0  "HSYSPART"   8  u32 format version (1)   12  u32 L: the header's length in bytes (UTF-8 JSON padded with spaces to a multiple of 4)   16  the header   16 + L  the blobs, one after the other, each at a multiple of 4
  //   (header.blobs = [{ name, offset (from 16 + L), bytes }], header.bytes = their total). A reader refuses another magic, another version, a header that is not JSON or a blob that runs past the end.
  //
  // THE HEADER (and the piece object: the same fields, with `mesh`, `preview` and `volume` as data instead of blob references):
  //   format "happy.part", version 1, id, kind (leg, arm, neck, head, tail, wing, torso, ear, horn ...: SYSTEM.md "The kinds"), style (free words), side "l" | "r" | "m", tags [],
  //   units "m", frame: the creature frame of SYSTEM.md (+x the creature's LEFT, +y up, +z forward), the bind pose, the piece TRANSLATED so that its socket (the head of its root bone) is the origin, never turned or
  //     scaled; a lateral piece is stored for the side it was cut from (its mirror is made when it is used: x -> -x, `_l` <-> `_r`).
  //   source { uid, title, folder, file (relative to the corpus root), group (the group it was cut by: root, bones / subtree, exclude, attach, kind, side, style), frame (up, forward, scale, height, source:
  //     "options" | "study" | "guess"), at [x, y, z] (the socket in the source's creature frame: x is its offset from the middle), height (the source model's, m), clips [names], mesher { version, hash },
  //     optimizer (its VERSION), tool }
  //   bones [{ name, src (the source's own name), parent (a name | null), head, tail, length, anchor?: "host" | "socket" | "outside", socket?: id }]: the skin's bone indices are indices of this list, PARENT
  //     FIRST: `@host:2` (the host's grandparent and everything above it) and `@host:1` (its parent) when the piece leans on them, the anchor `@host` (the bone the piece hangs on: a thigh's blend into the
  //     hip; at assembly the host's bone; the parent of the root bone), the piece's own bones (root first), an anchor `@<socket id>` for every part cut off this piece (the weights its bones had near the cut;
  //     at assembly the first bone of what is attached there, else the bone the socket is on), then the OUTSIDE bones (no ancestors of the host: a clavicle beside a neck) under their SOURCE names, anchor
  //     "outside", parent the anchor above them: an assembly maps them to its bone of the same source (a piece of the same model), else follows `parent` down to `@host`'s bone
  //     (happy_mesher drops a name it cannot place: map every outside anchor)
  //   socket { origin [0, 0, 0], axis (unit: the way the part leaves its host, into the piece), up (unit, perpendicular to axis: the creature's up, or its forward for a part that hangs down), host { bone: "@host", src,
  //     kind: pelvis | chest | neck | head | tail | spine | limb | ... }, radius (the root bone's: the median distance of its vertices to it), overlap (how far the piece reaches past its joint into the host, m), blend
  //     (a suggested smooth-union radius, m; overlap >= blend; 0 for a piece with no cut), band (the bake band in cells, at `cell`, that the blend needs: ceil(blend / cell) + 1, at least 4), cell (m) }
  //   source.size { height, length, width }: the source body's box (m): the creator scales a piece by the ratio of body sizes
  //   sockets [{ id, bone ("@<id>"), on (the piece's bone it hangs on), origin, axis (out of this piece, into the part that hangs there), up, kind, side, radius, blend }]: a TORSO's (the parts cut off it)
  //   chain [bone names: the main chain, root down], ik { solver ("limb" 2 bones, "z_leg" 3, "fabrik"), bones, tip, pole } | null, joints [{ bone, kind "hinge" | "ball", axis, range [lo, hi] (degrees, 0 = the bind
  //     pose), from }], roles { eyes, jaw, ears, tongue, brows, lids, nose, mouth, hips, spine, chest, neck, head, tail: bone names } (what the source's names say; empty when nothing does)
  //   material { roughness, metal, emissive [r, g, b] (linear), glow (a real emission, not an exporter's brightness trick), alpha "opaque" | "mask" | "blend", double_sided, from, regions [{ id, name, roughness, metal,
  //     share }] (when the piece covers more than one source material: an eye is glossy; the mesh's `material_ids` index them) }
  //   mesh: the "happy.meshpack" header of the OPTIMIZER (positions 16 bit to the box, normals octahedral, colours sRGB bytes, skin indices / weights bytes that add up to 255, indices u16 / u32, material_ids);
  //     its blobs are this file's "mesh/<name>"
  //   preview { blob, mime "image/png", width, height, view } | null        volume { blob, format "sdfvol", cell } | null (a cache of the piece's own bake; see STATUS: BUILD for when it is written)
  //   scores { closed, boundary_edges, non_manifold_edges, volume, normals_out, weights { sum_error, max_influences, unused }, color { p50, p90 }, shape { p50, p99, max, as shares of the radius }, coverage, pose,
  //     triangles, vertices, budget }: the quality gate (no timings: the same build gives the same bytes)
  const MAGIC = "HSYSPART", VERSION = 1;
  let MP = null;
  function fail(msg) { throw new Error("system part file: " + msg); }
  function use_meshpack(m) { if (!m || typeof m.pack !== "function" || typeof m.unpack !== "function") fail("use_meshpack needs the mesh codec (parts/optimize/mesh_optimize.js: pack / unpack)"); MP = m; }
  function utf8(text) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text);
    const e = unescape(encodeURIComponent(text)), u = new Uint8Array(e.length);
    for (let i = 0; i < e.length; i++) u[i] = e.charCodeAt(i);
    return u;
  }
  function text_of(u) {
    if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(u);
    let s = "";
    for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return decodeURIComponent(escape(s));
  }
  const DATA_KEYS = { mesh: 1, preview: 1, volume: 1, mesh_packed: 1 };

  // the piece's complaints: [] when it can be written
  function validate(p) {
    const E = [];
    if (!p || typeof p !== "object") return ["a piece must be an object"];
    if (typeof p.id !== "string" || !/^[a-z0-9_.\-]+$/.test(p.id)) E.push("id must be lower case letters, digits, _ . - (" + JSON.stringify(p.id) + ")");
    if (typeof p.kind !== "string" || !p.kind) E.push("kind must be a word (leg, head, tail ...)");
    if (["l", "r", "m"].indexOf(p.side) < 0) E.push("side must be l, r or m");
    if (!Array.isArray(p.bones) || !p.bones.length) E.push("bones must be a list of { name, parent, head, tail }");
    else {
      const names = {};
      p.bones.forEach(function (b, i) {
        if (!b || typeof b.name !== "string" || !b.name) { E.push("bones[" + i + "] has no name"); return; }
        if (names[b.name]) E.push("the bone name '" + b.name + "' is there twice");
        names[b.name] = true;
        ["head", "tail"].forEach(function (k) { if (!Array.isArray(b[k]) || b[k].length !== 3 || !b[k].every(isFinite)) E.push("bones[" + i + "]." + k + " must be [x, y, z]"); });
      });
      p.bones.forEach(function (b) { if (b && b.parent !== null && b.parent !== undefined && !names[b.parent]) E.push("the bone '" + b.name + "' has the parent '" + b.parent + "', which is not a bone of the piece"); });
    }
    const m = p.mesh;
    if (!p.mesh_packed) {
      if (!m || !(m.positions instanceof Float32Array) || !m.indices || m.positions.length % 3 || m.indices.length % 3) E.push("mesh must have positions (Float32Array, 3 a vertex) and indices (3 a triangle)");
      else {
        const nv = m.positions.length / 3, nb = Array.isArray(p.bones) ? p.bones.length : 0;
        for (let i = 0; i < m.indices.length; i++) if (!(m.indices[i] < nv)) { E.push("mesh.indices[" + i + "] = " + m.indices[i] + " is not a vertex"); break; }
        const si = m.skin_indices;
        if (si) for (let i = 0; i < si.length; i++) if (!(si[i] < nb)) { E.push("mesh.skin_indices[" + i + "] = " + si[i] + " is not a bone (0 .. " + (nb - 1) + ")"); break; }
      }
    }
    if (!p.socket || !Array.isArray(p.socket.origin) || !Array.isArray(p.socket.axis)) E.push("socket must be { origin, axis, up, host, radius, overlap, blend }");
    return E;
  }

  function write(piece, o) {
    o = o || {};
    if (!MP && !piece.mesh_packed) fail("write: no mesh codec (use_meshpack(parts/optimize/mesh_optimize.js) first)");
    const E = validate(piece);
    if (E.length) fail("write: " + E.join("; "));
    const header = { format: "happy.part", version: VERSION }, blobs = [];
    Object.keys(piece).forEach(function (k) { if (!DATA_KEYS[k] && k !== "format" && k !== "version" && k !== "blobs" && k !== "bytes") header[k] = piece[k]; });
    // the mesh: the optimizer's pack, its blobs under "mesh/"
    const packed = piece.mesh_packed || MP.pack(piece.mesh, { normal_bits: o.normal_bits === 8 ? 8 : 16 });
    header.mesh = packed.header;
    packed.header.blobs.forEach(function (b) { blobs.push({ name: "mesh/" + b.name, bytes: packed.blobs[b.name] }); });
    if (piece.preview && piece.preview.png) { header.preview = { blob: "preview", mime: "image/png", width: piece.preview.width, height: piece.preview.height, view: piece.preview.view || "three" }; blobs.push({ name: "preview", bytes: piece.preview.png }); }
    else header.preview = null;
    if (piece.volume && piece.volume.bytes) { header.volume = { blob: "volume", format: "sdfvol", cell: piece.volume.cell }; blobs.push({ name: "volume", bytes: piece.volume.bytes }); }
    else header.volume = null;
    let off = 0;
    header.blobs = blobs.map(function (b) { const e = { name: b.name, offset: off, bytes: b.bytes.length }; off += (b.bytes.length + 3) & ~3; return e; });
    header.bytes = off;
    let json = utf8(JSON.stringify(header));
    const pad = (4 - (json.length % 4)) % 4;
    if (pad) { const j2 = new Uint8Array(json.length + pad); j2.set(json); for (let i = json.length; i < j2.length; i++) j2[i] = 32; json = j2; }
    const out = new Uint8Array(16 + json.length + off), dv = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) out[i] = MAGIC.charCodeAt(i);
    dv.setUint32(8, VERSION, true); dv.setUint32(12, json.length, true);
    out.set(json, 16);
    const base = 16 + json.length;
    blobs.forEach(function (b, i) { out.set(b.bytes, base + header.blobs[i].offset); });
    return out;
  }

  // -> { header, base, bytes }: the header checked
  function open(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : (bytes && bytes.buffer ? new Uint8Array(bytes.buffer, bytes.byteOffset || 0, bytes.byteLength) : new Uint8Array(bytes || 0));
    if (b.length < 16) fail("read: " + b.length + " bytes are too few for a piece file");
    let magic = "";
    for (let i = 0; i < 8; i++) magic += String.fromCharCode(b[i]);
    if (magic !== MAGIC) fail("read: this is not a piece file (it starts with '" + magic.replace(/[^\x20-\x7e]/g, "?") + "', not '" + MAGIC + "')");
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), version = dv.getUint32(8, true), L = dv.getUint32(12, true);
    if (version !== VERSION) fail("read: version " + version + " of the piece file is not known (this reads " + VERSION + ")");
    if (16 + L > b.length) fail("read: the file is cut short (its header says " + L + " bytes, " + (b.length - 16) + " are there)");
    let h;
    try { h = JSON.parse(text_of(b.subarray(16, 16 + L))); } catch (e) { fail("read: the header is not JSON (" + e.message + ")"); }
    if (!h || h.format !== "happy.part" || h.version !== VERSION || !Array.isArray(h.blobs)) fail("read: the header is not a piece's (format 'happy.part', version " + VERSION + ")");
    const base = 16 + L;
    h.blobs.forEach(function (e) { if (!(e.offset >= 0) || !(e.bytes >= 0) || base + e.offset + e.bytes > b.length) fail("read: the blob '" + e.name + "' runs past the end of the file"); });
    return { header: h, base: base, bytes: b };
  }
  function blob(f, name) {
    const e = f.header.blobs.filter(function (x) { return x.name === name; })[0];
    if (!e) return null;
    const c = new Uint8Array(e.bytes);                                                // (a copy: aligned, owned)
    c.set(f.bytes.subarray(f.base + e.offset, f.base + e.offset + e.bytes));
    return c;
  }
  function info(bytes) { return open(bytes).header; }
  function read(bytes, o) {
    o = o || {};
    const f = open(bytes), h = f.header, piece = {};
    Object.keys(h).forEach(function (k) { if (k !== "blobs" && k !== "bytes" && k !== "mesh" && k !== "preview" && k !== "volume") piece[k] = h[k]; });
    const mb = {};
    (h.mesh && h.mesh.blobs || []).forEach(function (b) { const by = blob(f, "mesh/" + b.name); if (!by) fail("read: the mesh blob '" + b.name + "' is missing"); mb[b.name] = by; });
    if (o.mesh === false) piece.mesh_packed = { header: h.mesh, blobs: mb };
    else { if (!MP) fail("read: no mesh codec (use_meshpack(parts/optimize/mesh_optimize.js) first, or read(bytes, { mesh: false }))"); piece.mesh = MP.unpack(h.mesh, mb); }
    piece.preview = h.preview ? { width: h.preview.width, height: h.preview.height, view: h.preview.view, png: blob(f, h.preview.blob) } : null;
    piece.volume = h.volume ? { cell: h.volume.cell, bytes: blob(f, h.volume.blob) } : null;
    return piece;
  }

  return { version: VERSION, MAGIC: MAGIC, use_meshpack: use_meshpack, write: write, read: read, info: info, validate: validate };
});

// ========================================================================================================================
// mesh_optimize
// ========================================================================================================================
packing()("happy_mesh_optimize", function happy_mesh_optimize() {
  "use strict";
  // THE MESH OPTIMIZER of the piece pipeline (SYSTEM.md "OPTIMIZER"). A closed piece mesh comes out of the mesher and its decimation (positions, normals, vertex colours, up to four skin
  // influences a vertex, material ids, islands); this makes it CLEAN, FAST FOR THE GPU and SMALL FOR THE FILE. Pure (typed arrays in, typed arrays out: no engine, no DOM, no files; node and the page run the same code;
  // Node 14: no optional chaining, no ??, no async, no class), deterministic (the same input twice is the same bytes: no random numbers, no timing in a result, every tie goes to the lower index), no dependencies:
  // the algorithms are written out here.
  //
  //   optimize(mesh, opts?) -> { mesh, remap, stats }   weld -> clean -> cache -> fetch, one island at a time. remap (Uint32Array): remap[i] = the INPUT vertex that OUTPUT vertex i is (its attributes are that vertex's, bit for bit)
  //   stats(mesh, opts?)    -> { vertices, triangles, acmr, atvr, bytes, boundary_edges, non_manifold_edges, islands, ... }     what a mesh is: how well it caches, how closed it is
  //   pack(mesh, opts?)     -> { header, blobs }        the mesh quantized for the piece file (positions 16 bit to the bounds, normals octahedral, colours u8, skin weights u8 that add up to exactly 255 ...)
  //   unpack(header, blobs) -> mesh | unpack({ header, blobs })                                                       the arrays system reads again, within the errors the header states
  //   encode({ header, blobs }) -> Uint8Array | decode(bytes) -> { header, blobs }                                    the same as one self contained buffer (HSYSMPK1: for a file that holds nothing else)
  //   weld(mesh, opts) / clean(mesh, opts) / cache(mesh, opts) / fetch(mesh, opts): the one pass alone (optimize with the other three off)       acmr(mesh, size) -> the vertex cache's average miss ratio
  //
  // THE MESH is { positions: Float32Array (3 n), indices: Uint16Array | Uint32Array (3 t), normals?, colors?, uvs?, skin_indices? + skin_weights? (or bone_indices + bone_weights, or joints + weights: the mesher's, system's and
  // the glTF importer's names), material_ids?, part_ids?, ..., islands?: [{ name, vertex_start, vertex_count, index_start, index_count, ... }] }. EVERY other typed array whose length is a whole multiple of the vertex count is a
  // per-vertex array and follows the vertices (any element type); any other property (skin_count, parts, a name) is carried through as it is (a number `vertex_count` and an array of six numbers `bounds` are made new).
  //
  // THE PASSES, in this order, on one island at a time (an island is a range of vertices and a range of indices that use no vertex outside it: the mesher's output; the mesh with no `islands` is one):
  //   weld   vertices of one place, within `weld` metres, with equal attributes (normals within `weld_normal` degrees, colours within `weld_color` of their full scale, uvs within `weld_uv`, the same skin: the same bones, weights within
  //          `weld_skin`; every other array exactly equal) are one: the first of them stays and the others are its alias. A grid of cells 16 tolerances wide holds the representatives (an open addressing hash table: a vertex
  //          looks into the one to eight cells its tolerance sphere touches, takes the NEAREST representative that agrees, else becomes one), so the cost is a few hash probes a vertex whatever the tolerance.
  //   clean  triangles that are degenerate (a vertex twice, or a height under `min_height`, the weld distance: the triangle is a line to that precision) or duplicate (the same three vertices, the same way round: a hash of the
  //          rotation that starts at the lowest index; the same three vertices the other way round are counted, not removed: they bound no volume but they are a surface), floating islands of fewer than
  //          `min_island_triangles` triangles (union find over the vertices), the vertices no triangle uses. BEFORE a sliver is taken out, two of its corners that are within the weld distance of each other AND agree in everything
  //          else are joined into one vertex (the sliver held the surface together there: without the join its three edges would be open), so a closed mesh stays closed; a hard edge's two vertices stay two.
  //   cache  the TRIANGLE ORDER for the post transform vertex cache, `cache` entries (32): FORSYTH's linear speed greedy (a score for every vertex from its place in the cache and from how few triangles still need
  //          it; the next triangle is the best one among those that touch the cache; window of `cache` entries, a stack of the last vertices for the dead ends) or TIPSIFY (Sander, Nehab, Barczak 2007: fans round a vertex, the
  //          next fanning vertex is the one that stays the longest in the cache). Both were measured on 25 meshes of the mesher (SYSTEM.md, STATUS: OPTIMIZER): Forsyth, the default, is 0.66 / 0.60 ACMR for caches of 16 / 32
  //          (about 38 ms a 100 k triangles), Tipsify tuned for 32 is 0.87 / 0.59 (5 ms): Forsyth is good for any size, Tipsify for the one it is told (`cache_algorithm: "tipsify"` when 32 is the one and time matters).
  //   fetch  the VERTEX ORDER is the order of first use in the index buffer (the memory is read once, forward); every per-vertex array follows
  // ACMR is the average cache miss ratio: vertices fetched a triangle with a FIFO cache of K entries (a hit does not refresh: the post transform caches of GPUs are FIFOs), 3 for no cache and no sharing, about 0.5 at best for
  // a big regular mesh; ATVR the same over the vertices (1 is every vertex transformed once). OVERDRAW optimization is NOT done: the piece is baked to a volume again at assembly and the creature meshed again, so the triangle order of a
  // piece never reaches a draw call that fills pixels, and a clustered, depth sorted order costs a rasterizer to find (SYSTEM.md, STATUS: OPTIMIZER).
  //
  // opts (optimize): weld (metres, 1e-6; 0 = the same position only; false = off), weld_normal (degrees, 1; false = not compared), weld_color (0.004 of the full scale; false), weld_uv (1e-4; false), weld_skin (1e-4 of a weight; false),
  //   clean (true | false | { degenerate, duplicates, unreferenced, min_height }), min_island_triangles (0 = off), cache (32 | a size 4 .. 64 | false), cache_algorithm ("forsyth" | "tipsify"), fetch (true | false),
  //   keep_islands (true: every island on its own, the ranges written back; false: the mesh as one, the islands dropped), indices ("keep": a Uint16Array stays one, anything else is Uint32Array; "auto": u16 when the vertices
  //   fit; "u16"; "u32"), stats (true: before and after in the result)
  const BIG = 1e30;
  const now = function () { return typeof performance !== "undefined" && performance.now ? performance.now() : (typeof process !== "undefined" && process.hrtime ? (function () { const h = process.hrtime(); return h[0] * 1e3 + h[1] / 1e6; })() : Date.now()); };
  const TYPE = { Float32Array: "f32", Float64Array: "f64", Uint8Array: "u8", Uint16Array: "u16", Uint32Array: "u32", Int8Array: "i8", Int16Array: "i16", Int32Array: "i32" };
  const CTOR = { f32: Float32Array, f64: Float64Array, u8: Uint8Array, u16: Uint16Array, u32: Uint32Array, i8: Int8Array, i16: Int16Array, i32: Int32Array };
  const BYTES = { f32: 4, f64: 8, u8: 1, u16: 2, u32: 4, i8: 1, i16: 2, i32: 4 };
  const UNIT = { f32: 1, f64: 1, u8: 255, u16: 65535, u32: 4294967295, i8: 127, i16: 32767, i32: 2147483647 };          // (the full scale of an element type: a tolerance is a share of it)
  const LITTLE = new Uint8Array(new Uint16Array([258]).buffer)[0] === 2;
  const SKIN_PAIRS = [["skin_indices", "skin_weights"], ["bone_indices", "bone_weights"], ["joints", "weights"]];
  const NOT_VERTEX = { bounds: 1 };
  function fail(msg) { throw new Error("system mesh optimize: " + msg); }
  const type_of = function (a) { const n = a && ArrayBuffer.isView(a) && a.constructor ? TYPE[a.constructor.name] : undefined; return n && a instanceof CTOR[n] ? n : null; };

  // ---- reading a mesh ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // the mesh checked, and its arrays by what they are for -> { P (Float32Array), I (Uint32Array), nv, nt, vert: [{ key, a, stride }], norm, color, skin: { si, sw, stride } | null, by_key }
  function read_mesh(mesh, who) {
    if (!mesh || typeof mesh !== "object") fail(who + ": the mesh must be an object { positions, indices, ... }");
    let P = mesh.positions, I = mesh.indices;
    if (!P || typeof P.length !== "number" || P.length % 3 !== 0) fail(who + ": mesh.positions must hold 3 numbers a vertex");
    if (!I || typeof I.length !== "number" || I.length % 3 !== 0) fail(who + ": mesh.indices must hold 3 vertex numbers a triangle");
    if (!(P instanceof Float32Array)) P = Float32Array.from(P);
    const nv = P.length / 3, nt = I.length / 3;
    for (let i = 0; i < P.length; i++) { const v = P[i]; if (!(v > -BIG && v < BIG)) fail(who + ": the position of vertex " + ((i / 3) | 0) + " is not a finite number (" + v + ")"); }
    for (let k = 0; k < I.length; k++) { const v = I[k]; if (!(v >= 0 && v < nv) || v !== Math.floor(v)) fail(who + ": mesh.indices[" + k + "] = " + v + " is not a vertex (0 .. " + (nv - 1) + ")"); }
    if (!(I instanceof Uint32Array)) I = Uint32Array.from(I);
    const L = { P: P, I: I, nv: nv, nt: nt, vert: [], norm: null, color: null, skin: null, by_key: {} };
    if (nv > 0) Object.keys(mesh).forEach(function (k) {
      if (k === "positions" || k === "indices" || NOT_VERTEX[k]) return;
      const a = mesh[k];
      if (!type_of(a) || a.length === 0 || a.length % nv !== 0) return;
      const e = { key: k, a: a, stride: a.length / nv };
      L.vert.push(e); L.by_key[k] = e;
    });
    if (L.by_key.normals && L.by_key.normals.stride === 3) L.norm = L.by_key.normals;
    L.color = L.by_key.colors || L.by_key.colours || null;
    L.uv = L.by_key.uvs && L.by_key.uvs.stride === 2 ? L.by_key.uvs : null;
    for (let p = 0; p < SKIN_PAIRS.length && !L.skin; p++) {
      const si = L.by_key[SKIN_PAIRS[p][0]], sw = L.by_key[SKIN_PAIRS[p][1]];
      if (si && sw && si.stride === sw.stride) L.skin = { si: si, sw: sw, stride: si.stride };
    }
    return L;
  }
  function hash3(a, b, c) {
    let h = Math.imul(a, 0x9E3779B1) ^ Math.imul(b, 0x85EBCA6B) ^ Math.imul(c, 0xC2B2AE35);
    h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12;
    return h;
  }
  function pow2_over(n) { let c = 16; while (c < n) c <<= 1; return c; }

  // ---- topology: vertex -> triangles, edges, components ------------------------------------------------------------------------------------------------------------------------------------------
  // the triangles each vertex is a corner of (a triangle that uses a vertex twice is listed twice there): start[v] .. start[v + 1] in tris
  function adjacency(I, nt, nv) {
    const start = new Int32Array(nv + 1), n3 = nt * 3;
    for (let k = 0; k < n3; k++) start[I[k] + 1]++;
    for (let v = 0; v < nv; v++) start[v + 1] += start[v];
    const fill = start.slice(0, nv), tris = new Int32Array(n3);
    for (let k = 0; k < n3; k++) tris[fill[I[k]]++] = (k / 3) | 0;
    return { start: start, tris: tris };
  }
  // the edges of a triangle list and how many triangles each has: -> { edges, boundary (one triangle), non_manifold (more than two) }. A triangle with a vertex twice has no edges here.
  function edge_counts(I, nt, nv, adj) {
    const start = adj.start, tris = adj.tris;
    let buf = new Int32Array(64), edges = 0, boundary = 0, non_manifold = 0;
    for (let u = 0; u < nv; u++) {
      const s0 = start[u], s1 = start[u + 1];
      if (s1 === s0) continue;
      if ((s1 - s0) * 2 > buf.length) buf = new Int32Array((s1 - s0) * 4);
      let n = 0;
      for (let k = s0; k < s1; k++) {
        const t = tris[k] * 3, a = I[t], b = I[t + 1], c = I[t + 2];
        if (a === b || b === c || a === c) continue;
        let p, q;
        if (a === u) { p = b; q = c; } else if (b === u) { p = a; q = c; } else { p = a; q = b; }
        if (p > u) buf[n++] = p;                                    // (an edge is counted at its lower end: once for each triangle that has it)
        if (q > u) buf[n++] = q;
      }
      if (n > 24) buf.subarray(0, n).sort();
      else for (let i = 1; i < n; i++) { const x = buf[i]; let j = i - 1; while (j >= 0 && buf[j] > x) { buf[j + 1] = buf[j]; j--; } buf[j + 1] = x; }
      for (let i = 0; i < n;) {
        let j = i + 1;
        while (j < n && buf[j] === buf[i]) j++;
        edges++;
        if (j - i === 1) boundary++; else if (j - i > 2) non_manifold++;
        i = j;
      }
    }
    return { edges: edges, boundary: boundary, non_manifold: non_manifold };
  }
  function find(parent, x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  // the vertices that share a triangle are one component: -> { parent (union find), seen (the vertices a triangle uses), count }
  function components(I, nt, nv) {
    const parent = new Int32Array(nv), seen = new Uint8Array(nv);
    for (let v = 0; v < nv; v++) parent[v] = v;
    for (let t = 0; t < nt; t++) {
      const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
      seen[a] = 1; seen[b] = 1; seen[c] = 1;
      const ra = find(parent, a), rb = find(parent, b), rc = find(parent, c);
      if (ra !== rb) parent[ra] = rb;
      const rc2 = find(parent, rc), rb2 = find(parent, rb);
      if (rc2 !== rb2) parent[rc2] = rb2;
    }
    let count = 0;
    for (let v = 0; v < nv; v++) if (seen[v] && find(parent, v) === v) count++;
    return { parent: parent, seen: seen, count: count };
  }

  // ---- the vertex cache: how well an index order uses it ---------------------------------------------------------------------------------------------------------------------------------------
  // a FIFO cache of K entries (a vertex is in it while fewer than K other vertices have been fetched since it was; a hit does not refresh it) -> { misses, used (the vertices that are referenced) }
  function cache_sim(I, nt, nv, K) {
    const stamp = new Int32Array(nv), n3 = nt * 3;
    let ts = K + 1, misses = 0;                                    // (a stamp of 0 is "never": the first use of every vertex is a miss)
    for (let k = 0; k < n3; k++) { const v = I[k]; if (ts - stamp[v] > K) { stamp[v] = ts++; misses++; } }
    let used = 0;
    for (let v = 0; v < nv; v++) if (stamp[v] !== 0) used++;
    return { misses: misses, used: used };
  }
  // ACMR of a mesh (or of an index array, with the vertex count) for a cache of `size` entries
  function acmr(mesh, size, nv) {
    const I = mesh && mesh.indices ? mesh.indices : mesh, n = nv !== undefined ? nv : (mesh && mesh.positions ? mesh.positions.length / 3 : 0);
    const T = I instanceof Uint32Array ? I : Uint32Array.from(I), nt = T.length / 3;
    if (!nt) return 0;
    let top = n;
    if (!(n > 0)) { for (let k = 0; k < T.length; k++) if (T[k] >= top) top = T[k] + 1; }
    return cache_sim(T, nt, top, size > 0 ? size | 0 : 32).misses / nt;
  }

  // ---- the triangle order: Forsyth ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // Tom Forsyth, "Linear-Speed Vertex Cache Optimisation" (2006), with the scoring window the size of the cache. A vertex scores for where it is in the cache (the last triangle's three: 0.75, then falling off to 0 at the
  // end of the window: (1 - (p - 3) / (K - 3))^0.75, so a vertex that is about to leave the cache is worth little) and for how few triangles still need it (3 / sqrt(live): finish the vertices that are nearly done, or they are
  // fetched again for a lone triangle later). The two constants that are not Forsyth's (his: the power 1.5, the scale 2) are the best of a search of 240 on 11 real meshes (the mesher's bodies and corpus animals): the mean ACMR
  // for caches of 16 / 32 went from 0.684 / 0.633 to 0.677 / 0.622, and the surface around the best is flat (a tenth of a percent between its ten best). A triangle scores the sum of its three vertices. After each triangle the next one is the best of the triangles that touch the cache; when there is none (a boundary, an island
  // done) the triangle of the latest vertex that still has one (a stack: the walk goes back along where it has been), else the first triangle not yet written. T: dense vertex numbers (3 nt), unchanged; -> a new Uint32Array.
  function forsyth(T, nt, nv, K) {
    const W = Math.max(4, Math.min(64, K | 0)), adj = adjacency(T, nt, nv), start = adj.start, tris = adj.tris, live = new Int32Array(nv), out = new Uint32Array(nt * 3);
    for (let v = 0; v < nv; v++) live[v] = start[v + 1] - start[v];
    const cache_score = new Float64Array(W);
    for (let p = 0; p < W; p++) { const x = 1 - (p - 3) / (W - 3), q = Math.sqrt(x); cache_score[p] = p < 3 ? 0.75 : q * Math.sqrt(q); }          // (x^0.75 as sqrt(x) sqrt(sqrt(x)): every operation is exactly rounded, so the table is the same on every engine)
    const VT = 64, HUB = 256, live_score = new Float64Array(VT + 1);
    for (let n = 1; n <= VT; n++) live_score[n] = 3 / Math.sqrt(n);
    const score = new Float64Array(nv), done = new Uint8Array(nt), stack = new Int32Array(nt * 3 + 3), hub = new Uint8Array(nv);
    for (let v = 0; v < nv; v++) { score[v] = live_score[live[v] < VT ? live[v] : VT]; if (live[v] > HUB) hub[v] = 1; }
    let cache = new Int32Array(W + 3), next = new Int32Array(W + 3), len = 0, sp = 0, scan = 0, cur = -1, best_s = -1;
    for (let t = 0; t < nt; t++) { const s = score[T[t * 3]] + score[T[t * 3 + 1]] + score[T[t * 3 + 2]]; if (s > best_s) { best_s = s; cur = t; } }       // (the first triangle: the best by the valences alone: a corner of the mesh)
    for (let o = 0; o < nt; o++) {
      if (cur < 0) fail("internal: the cache optimizer has no next triangle");
      const a = T[cur * 3], b = T[cur * 3 + 1], c = T[cur * 3 + 2];
      out[o * 3] = a; out[o * 3 + 1] = b; out[o * 3 + 2] = c;
      done[cur] = 1;
      for (let j = 0; j < 3; j++) {                                    // the triangle leaves the lists of its corners (the live ones are the first live[v] of the list; a hub's list is not kept)
        const v = T[cur * 3 + j], s0 = start[v], e0 = s0 + live[v];
        if (!hub[v]) for (let k = s0; k < e0; k++) if (tris[k] === cur) { tris[k] = tris[e0 - 1]; break; }
        live[v]--;
        stack[sp++] = v;
      }
      // the new cache: the triangle's vertices, then the old ones in their order; what falls off the end of the window is only worth its valence
      let n = 0;
      next[n++] = a; if (b !== a) next[n++] = b; if (c !== a && c !== b) next[n++] = c;
      for (let i = 0; i < len; i++) {
        const u = cache[i];
        if (u === a || u === b || u === c) continue;
        if (n < W) next[n++] = u;
        else score[u] = live_score[live[u] < VT ? live[u] : VT];
      }
      const swap = cache; cache = next; next = swap; len = n;
      for (let i = 0; i < n; i++) { const u = cache[i]; score[u] = cache_score[i] + live_score[live[u] < VT ? live[u] : VT]; }
      // the best triangle among those that touch the cache
      cur = -1; best_s = -1;
      for (let i = 0; i < n; i++) {
        const u = cache[i], s0 = start[u], e0 = s0 + live[u];
        if (hub[u]) continue;
        for (let k = s0; k < e0; k++) {
          const t = tris[k], s = score[T[t * 3]] + score[T[t * 3 + 1]] + score[T[t * 3 + 2]];
          if (s > best_s) { best_s = s; cur = t; }
        }
      }
      if (cur < 0) {
        while (sp > 0) { const v = stack[--sp]; if (live[v] > 0 && !hub[v]) { cur = tris[start[v]]; break; } }
        if (cur < 0) { while (scan < nt && done[scan]) scan++; if (scan < nt) cur = scan; }
      }
    }
    return out;
  }
  // ---- the triangle order: Tipsify ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // Sander, Nehab, Barczak, "Fast Triangle Reordering for Vertex Locality and Reduced Overdraw" (2007): the triangles round one vertex (a fan) are written together; the next fanning vertex is the one of the
  // candidates (the vertices of the fan just written) that is the oldest in the cache and still will be after its own remaining triangles; with no candidate, the latest vertex that has live triangles, else the next one by number.
  function tipsify(T, nt, nv, K) {
    const adj = adjacency(T, nt, nv), start = adj.start, tris = adj.tris, live = new Int32Array(nv), stamp = new Int32Array(nv), done = new Uint8Array(nt), out = new Uint32Array(nt * 3), stack = new Int32Array(nt * 3 + 3);
    let maxdeg = 0;
    for (let v = 0; v < nv; v++) { live[v] = start[v + 1] - start[v]; if (live[v] > maxdeg) maxdeg = live[v]; }
    const cand = new Int32Array(maxdeg * 3 + 3);
    let sp = 0, s = K + 1, i = 0, o = 0, f = 0;
    while (f < nv && live[f] === 0) f++;
    if (f >= nv) f = -1;
    while (f >= 0) {
      let nc = 0;
      for (let k = start[f]; k < start[f + 1]; k++) {
        const t = tris[k];
        if (done[t]) continue;
        done[t] = 1;
        out[o * 3] = T[t * 3]; out[o * 3 + 1] = T[t * 3 + 1]; out[o * 3 + 2] = T[t * 3 + 2]; o++;
        for (let j = 0; j < 3; j++) {
          const v = T[t * 3 + j];
          stack[sp++] = v; cand[nc++] = v; live[v]--;
          if (s - stamp[v] > K) stamp[v] = s++;
        }
      }
      let n = -1, m = -1;
      for (let j = 0; j < nc; j++) {
        const v = cand[j];
        if (live[v] > 0) { let p = 0; if (s - stamp[v] + 2 * live[v] <= K) p = s - stamp[v]; if (p > m) { m = p; n = v; } }
      }
      if (n < 0) {
        while (sp > 0) { const d = stack[--sp]; if (live[d] > 0) { n = d; break; } }
        if (n < 0) { while (i < nv && live[i] === 0) i++; if (i < nv) n = i; }
      }
      f = n;
    }
    if (o !== nt) fail("internal: tipsify wrote " + o + " of " + nt + " triangles");
    return out;
  }
  function cache_order(T, nt, nv, K, algorithm) { return algorithm === "tipsify" ? tipsify(T, nt, nv, K) : forsyth(T, nt, nv, K); }

  // ---- clean: slivers that hold the surface together, then which triangles stay ---------------------------------------------------------------------------------------------------------------------------
  // A triangle with two corners within `tol` of each other is a line. When the two corners agree in everything else they are ONE vertex (the lower number stays): taking the sliver out would open the three edges of
  // the surface round it (a closed mesh from the mesher has a few: two vertices of one place that its decimation left). Corners that differ (a hard edge) stay two, and the sliver goes. Only the corners of
  // a triangle are ever joined: the copies a vertex was split into on purpose (no triangle has two of them) are not. T: local vertex numbers; canon (the weld's representatives): both are rewritten. -> how many were joined
  function join_slivers(P, T, nT, n, plan_of, tol, canon) {
    const t2 = tol * tol;
    let par = null, plan = null, joined = 0;
    for (let t = 0; t < nT; t++) {
      for (let e = 0; e < 3; e++) {
        const u = T[t * 3 + e], v = T[t * 3 + (e + 1) % 3];
        if (u === v) continue;
        const dx = P[u * 3] - P[v * 3], dy = P[u * 3 + 1] - P[v * 3 + 1], dz = P[u * 3 + 2] - P[v * 3 + 2];
        if (!(dx * dx + dy * dy + dz * dz <= t2)) continue;
        if (par === null) { par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i; plan = plan_of(); }
        const ru = find(par, u), rv = find(par, v);
        if (ru === rv || !same_vertex(plan, u, v)) continue;
        if (ru < rv) par[rv] = ru; else par[ru] = rv;
        joined++;
      }
    }
    if (par !== null) {
      for (let k = 0; k < nT * 3; k++) T[k] = find(par, T[k]);
      for (let v = 0; v < n; v++) canon[v] = find(par, canon[v]);
    }
    return joined;
  }
  // does triangle j (in the table) have the rotation (m0, m1, m2) that starts at its lowest vertex
  function rotation_is(T, j, m0, m1, m2) {
    const a = T[j * 3], b = T[j * 3 + 1], c = T[j * 3 + 2];
    if (a < b && a < c) return a === m0 && b === m1 && c === m2;
    if (b < c) return b === m0 && c === m1 && a === m2;
    return c === m0 && a === m1 && b === m2;
  }
  // -> { keep (Uint8Array), collapsed (a vertex twice), thin (a line to h_tol), duplicates (the same three vertices the same way round: the later ones go), opposite (the same three the other way round: kept) }
  function triangle_filter(P, T, nt, o) {
    const keep = new Uint8Array(nt), h2 = o.min_height * o.min_height, r = { keep: keep, collapsed: 0, thin: 0, duplicates: 0, opposite: 0 };
    const cap = o.duplicates ? pow2_over(nt * 2) : 16, mask = cap - 1, tab = o.duplicates ? new Int32Array(cap).fill(-1) : null;
    for (let t = 0; t < nt; t++) {
      const a = T[t * 3], b = T[t * 3 + 1], c = T[t * 3 + 2];
      if (a === b || b === c || a === c) { if (o.degenerate) { r.collapsed++; continue; } keep[t] = 1; continue; }
      if (o.degenerate) {
        const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2], e1x = P[b * 3] - ax, e1y = P[b * 3 + 1] - ay, e1z = P[b * 3 + 2] - az, e2x = P[c * 3] - ax, e2y = P[c * 3 + 1] - ay, e2z = P[c * 3 + 2] - az;
        const cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x, ex = e2x - e1x, ey = e2y - e1y, ez = e2z - e1z;
        const l1 = e1x * e1x + e1y * e1y + e1z * e1z, l2 = e2x * e2x + e2y * e2y + e2z * e2z, l3 = ex * ex + ey * ey + ez * ez, lm = l1 > l2 ? (l1 > l3 ? l1 : l3) : (l2 > l3 ? l2 : l3);
        if (!(cx * cx + cy * cy + cz * cz > h2 * lm)) { r.thin++; continue; }                     // (|cross| / the longest edge is the triangle's lowest height: a triangle that is flatter than h_tol is a line)
      }
      if (tab) {
        let m0, m1, m2;
        if (a < b && a < c) { m0 = a; m1 = b; m2 = c; } else if (b < c) { m0 = b; m1 = c; m2 = a; } else { m0 = c; m1 = a; m2 = b; }
        let h = hash3(m0, m1, m2) & mask, dup = false;
        for (; tab[h] >= 0; h = (h + 1) & mask) if (rotation_is(T, tab[h], m0, m1, m2)) { dup = true; break; }
        if (dup) { r.duplicates++; continue; }
        for (let g = hash3(m0, m2, m1) & mask; tab[g] >= 0; g = (g + 1) & mask) if (rotation_is(T, tab[g], m0, m2, m1)) { r.opposite++; break; }
        tab[h] = t;
      }
      keep[t] = 1;
    }
    return r;
  }

  // ---- weld --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // the vertices u and v of one place: do their other attributes agree
  function same_skin(p, u, v) {
    const si = p.si, sw = p.sw, s = p.s, ou = u * s, ov = v * s, t = p.tol;
    let ok = true;
    for (let j = 0; j < s; j++) if (si[ou + j] !== si[ov + j] || !(Math.abs(sw[ou + j] - sw[ov + j]) <= t)) { ok = false; break; }          // (written so that a NaN is never "the same")
    if (ok) return true;
    for (let j = 0; j < s; j++) if (sw[ou + j] !== sw[ou + j] || sw[ov + j] !== sw[ov + j]) return false;                  // (a NaN weight: never the same)
    // (the same influences listed in another order, or one with no weight: the bones with a weight, by bone, compared as sets)
    let nu = 0, nv_ = 0;
    const ub = p.ub, uw = p.uw, vb = p.vb, vw = p.vw, wmin = p.wmin;
    for (let j = 0; j < s; j++) {
      if (sw[ou + j] > wmin) { let i = nu++; while (i > 0 && ub[i - 1] > si[ou + j]) { ub[i] = ub[i - 1]; uw[i] = uw[i - 1]; i--; } ub[i] = si[ou + j]; uw[i] = sw[ou + j]; }
      if (sw[ov + j] > wmin) { let i = nv_++; while (i > 0 && vb[i - 1] > si[ov + j]) { vb[i] = vb[i - 1]; vw[i] = vw[i - 1]; i--; } vb[i] = si[ov + j]; vw[i] = sw[ov + j]; }
    }
    if (nu !== nv_) return false;
    for (let j = 0; j < nu; j++) if (ub[j] !== vb[j] || !(Math.abs(uw[j] - vw[j]) <= t)) return false;
    return true;
  }
  function same_vertex(plan, u, v) {
    for (let c = 0; c < plan.length; c++) {
      const p = plan[c], a = p.a, s = p.s, ou = u * s, ov = v * s;
      switch (p.kind) {
        case 0: for (let j = 0; j < s; j++) if (a[ou + j] !== a[ov + j]) return false; break;                            // (exactly equal: NaN is never equal to anything)
        case 1: {                                                                                                        // normals: within an angle
          const ax = a[ou], ay = a[ou + 1], az = a[ou + 2], bx = a[ov], by = a[ov + 1], bz = a[ov + 2], la = ax * ax + ay * ay + az * az, lb = bx * bx + by * by + bz * bz;
          if (la === 0 || lb === 0) { if (la !== lb) return false; break; }                                                // (a normal of no length equals only another)
          if (!(ax * bx + ay * by + az * bz >= p.c * Math.sqrt(la * lb))) return false;
          break;
        }
        case 2: for (let j = 0; j < s; j++) if (!(Math.abs(a[ou + j] - a[ov + j]) <= p.tol)) return false; break;          // colours: each channel within a share of the full scale
        default: if (!same_skin(p, u, v)) return false;
      }
    }
    return true;
  }
  // the attributes to compare for the vertices v0 .. v1 of the mesh, as views of those vertices
  function weld_plan(L, S, v0, v1) {
    const plan = [], sub = function (e) { return e.a.subarray(v0 * e.stride, v1 * e.stride); }, skin = L.skin && S.weld_skin !== Infinity ? L.skin : null;
    L.vert.forEach(function (e) {
      if (L.norm === e) { if (S.weld_normal < 180) plan.push({ kind: 1, a: sub(e), s: 3, c: Math.cos(Math.max(0, S.weld_normal) * Math.PI / 180) }); return; }
      if (L.color === e) { if (S.weld_color !== Infinity) plan.push({ kind: 2, a: sub(e), s: e.stride, tol: S.weld_color * UNIT[type_of(e.a)] }); return; }
      if (L.uv === e) { if (S.weld_uv !== Infinity) plan.push({ kind: 2, a: sub(e), s: 2, tol: S.weld_uv * UNIT[type_of(e.a)] }); return; }                        // (a uv: within a share of 0..1: the mesher's box projection differs in the last bits at one place; a seam differs by much more)
      if (L.skin && (L.skin.si === e || L.skin.sw === e)) return;                                       // (the two arrays of a skin are one attribute: below)
      plan.push({ kind: 0, a: sub(e), s: e.stride });
    });
    if (skin) {
      const u = UNIT[type_of(skin.sw.a)], k = skin.stride;
      plan.push({ kind: 3, si: sub(skin.si), sw: sub(skin.sw), s: k, tol: S.weld_skin * u, wmin: 1e-6 * u, ub: new Float64Array(k), uw: new Float64Array(k), vb: new Float64Array(k), vw: new Float64Array(k) });
    }
    return plan;
  }
  // The vertices n of one group (positions P, triangles T, `used`: the vertices T uses) -> canon: the representative of each vertex (itself for a representative), and how many were merged. See the header for the grid.
  function weld_group(P, n, T, ni, plan, tol, canon) {
    const used = new Uint8Array(n);
    for (let k = 0; k < ni; k++) used[T[k]] = 1;
    let lox = BIG, loy = BIG, loz = BIG, hix = -BIG, hiy = -BIG, hiz = -BIG;
    for (let v = 0; v < n; v++) {
      if (!used[v]) continue;
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      if (x < lox) lox = x; if (x > hix) hix = x; if (y < loy) loy = y; if (y > hiy) hiy = y; if (z < loz) loz = z; if (z > hiz) hiz = z;
    }
    const extent = Math.max(hix - lox, hiy - loy, hiz - loz, 0), cs = Math.max(16 * tol, extent * 1e-6, 1e-12), inv = 1 / cs, rr = tol * inv * (1 + 1e-6), r2 = tol * tol;
    const next = new Int32Array(n);
    let cap = 1024, hx = new Int32Array(cap), hy = new Int32Array(cap), hz = new Int32Array(cap), hh = new Int32Array(cap).fill(-1), cells = 0, merged = 0;
    const grow = function () {
      const ocap = cap, ohx = hx, ohy = hy, ohz = hz, ohh = hh;
      cap <<= 1; hx = new Int32Array(cap); hy = new Int32Array(cap); hz = new Int32Array(cap); hh = new Int32Array(cap).fill(-1);
      const mask = cap - 1;
      for (let s = 0; s < ocap; s++) {
        if (ohh[s] < 0) continue;
        let h = hash3(ohx[s], ohy[s], ohz[s]) & mask;
        while (hh[h] >= 0) h = (h + 1) & mask;
        hx[h] = ohx[s]; hy[h] = ohy[s]; hz[h] = ohz[s]; hh[h] = ohh[s];
      }
    };
    for (let v = 0; v < n; v++) {
      if (!used[v]) { canon[v] = v; continue; }
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], fx = (x - lox) * inv, fy = (y - loy) * inv, fz = (z - loz) * inv;
      const x0 = Math.floor(fx - rr), x1 = Math.floor(fx + rr), y0 = Math.floor(fy - rr), y1 = Math.floor(fy + rr), z0 = Math.floor(fz - rr), z1 = Math.floor(fz + rr);
      let best = -1, bd = Infinity;
      for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) for (let iz = z0; iz <= z1; iz++) {
        const mask = cap - 1;
        let h = hash3(ix, iy, iz) & mask;
        for (;;) {
          const head = hh[h];
          if (head < 0) break;
          if (hx[h] === ix && hy[h] === iy && hz[h] === iz) {
            for (let u = head; u >= 0; u = next[u]) {
              const dx = P[u * 3] - x, dy = P[u * 3 + 1] - y, dz = P[u * 3 + 2] - z, d2 = dx * dx + dy * dy + dz * dz;
              if (d2 <= r2 && (d2 < bd || (d2 === bd && u < best)) && same_vertex(plan, u, v)) { best = u; bd = d2; }
            }
            break;
          }
          h = (h + 1) & mask;
        }
      }
      if (best >= 0) { canon[v] = best; merged++; continue; }
      canon[v] = v;
      if ((cells + 1) * 2 > cap) grow();
      const cx = Math.floor(fx), cy = Math.floor(fy), cz = Math.floor(fz), mask = cap - 1;
      let h = hash3(cx, cy, cz) & mask;
      for (;;) {
        if (hh[h] < 0) { hx[h] = cx; hy[h] = cy; hz[h] = cz; cells++; next[v] = -1; hh[h] = v; break; }
        if (hx[h] === cx && hy[h] === cy && hz[h] === cz) { next[v] = hh[h]; hh[h] = v; break; }
        h = (h + 1) & mask;
      }
    }
    return merged;
  }

  // ---- the options -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  function settings(o) {
    o = o || {};
    const S = {}, flag = function (v, d) { return v === undefined || v === null ? d : !!v; }, number = function (v, d, what) {
      if (v === undefined || v === null || v === true) return d;
      if (v === false) return Infinity;
      if (typeof v !== "number" || !(v >= 0)) fail("opts." + what + " must be a number >= 0 (or false for not at all): " + v);
      return v;
    };
    if (o.weld === false) S.weld = -1;
    else if (o.weld === undefined || o.weld === null || o.weld === true) S.weld = 1e-6;
    else if (typeof o.weld === "number" && o.weld >= 0 && isFinite(o.weld)) S.weld = o.weld;
    else fail("opts.weld is a distance in metres (a number >= 0), true or false: " + o.weld);
    S.weld_normal = o.weld_normal === false ? 180 : number(o.weld_normal, 1, "weld_normal");
    S.weld_color = number(o.weld_color, 0.004, "weld_color");
    S.weld_uv = number(o.weld_uv, 1e-4, "weld_uv");
    S.weld_skin = number(o.weld_skin, 1e-4, "weld_skin");
    const c = o.clean;
    S.clean = { on: c !== false, degenerate: true, duplicates: true, unreferenced: true, min_height: S.weld > 0 ? S.weld : (S.weld === 0 ? 0 : 1e-6) };
    if (c && typeof c === "object") ["degenerate", "duplicates", "unreferenced"].forEach(function (k) { if (c[k] !== undefined) S.clean[k] = !!c[k]; });
    if (c && typeof c === "object" && c.min_height !== undefined) { if (!(c.min_height >= 0)) fail("opts.clean.min_height must be a number >= 0 (metres)"); S.clean.min_height = c.min_height; }
    const mi = o.min_island_triangles !== undefined ? o.min_island_triangles : (c && typeof c === "object" ? c.min_island_triangles : 0);
    S.min_island = mi > 0 ? Math.floor(mi) : 0;
    if (o.cache === false || o.cache === 0) S.cache = 0;
    else if (o.cache === undefined || o.cache === null || o.cache === true) S.cache = 32;
    else if (typeof o.cache === "number" && o.cache >= 4) S.cache = Math.min(64, Math.floor(o.cache));
    else fail("opts.cache is a cache size (4 .. 64), true or false: " + o.cache);
    S.algorithm = o.cache_algorithm === undefined ? "forsyth" : o.cache_algorithm;
    if (S.algorithm !== "forsyth" && S.algorithm !== "tipsify") fail("opts.cache_algorithm is \"forsyth\" or \"tipsify\": " + S.algorithm);
    S.fetch = flag(o.fetch, true); S.keep_islands = flag(o.keep_islands, true); S.stats = flag(o.stats, true);
    S.indices = o.indices === undefined ? "keep" : o.indices;
    if (["keep", "auto", "u16", "u32"].indexOf(S.indices) < 0) fail("opts.indices is \"keep\", \"auto\", \"u16\" or \"u32\": " + S.indices);
    return S;
  }

  // ---- the groups: the islands, or the whole mesh --------------------------------------------------------------------------------------------------------------------------------------------
  // -> [{ name, v0, v1, i0, i1, entry (the index of the island in mesh.islands, or -1) }] in the order of their ranges, which must tile the mesh
  function make_groups(mesh, L, S) {
    const isl = mesh.islands, ni = L.nt * 3;
    if (!S.keep_islands || !Array.isArray(isl) || isl.length === 0) return [{ name: "", v0: 0, v1: L.nv, i0: 0, i1: ni, entry: -1 }];
    const list = isl.map(function (e, k) {
      if (!e || typeof e !== "object") fail("mesh.islands[" + k + "] must be { name, vertex_start, vertex_count, index_start, index_count }");
      ["vertex_start", "vertex_count", "index_start", "index_count"].forEach(function (f) { if (!Number.isInteger(e[f]) || e[f] < 0) fail("mesh.islands[" + k + "]." + f + " must be a whole number >= 0 (" + e[f] + ")"); });
      if (e.index_count % 3 !== 0) fail("mesh.islands[" + k + "].index_count must be a multiple of 3 (" + e.index_count + ")");
      return { name: e.name === undefined ? "" : String(e.name), v0: e.vertex_start, v1: e.vertex_start + e.vertex_count, i0: e.index_start, i1: e.index_start + e.index_count, entry: k };
    });
    list.sort(function (a, b) { return a.v0 - b.v0 || a.i0 - b.i0 || a.entry - b.entry; });
    let v = 0, i = 0;
    list.forEach(function (g) {
      if (g.v0 !== v || g.i0 !== i) fail("the islands must tile the mesh, in the order of their ranges: island '" + g.name + "' starts at vertex " + g.v0 + ", index " + g.i0 + " where " + v + ", " + i + " is next (keep_islands: false optimizes the mesh as one)");
      v = g.v1; i = g.i1;
    });
    if (v !== L.nv || i !== ni) fail("the islands must cover the whole mesh: they end at vertex " + v + " of " + L.nv + ", index " + i + " of " + ni + " (keep_islands: false optimizes the mesh as one)");
    return list;
  }

  // ---- one group through the passes --------------------------------------------------------------------------------------------------------------------------------------------------------
  // the vertices g.v0 .. g.v1 and the indices g.i0 .. g.i1 of the mesh; the result goes to out.I (indices of the OUTPUT, from out.ni on), out.remap (the input vertex of each output vertex, from out.nv on)
  function process_group(L, S, g, out, ms, rep) {
    const n = g.v1 - g.v0, ni = g.i1 - g.i0, P = L.P.subarray(g.v0 * 3, g.v1 * 3), T = new Uint32Array(ni);
    for (let k = 0; k < ni; k++) {
      const v = L.I[g.i0 + k] - g.v0;
      if (v < 0 || v >= n) fail("island '" + g.name + "': the triangle " + ((g.i0 + k) / 3 | 0) + " uses the vertex " + L.I[g.i0 + k] + ", which is outside the island's vertices (" + g.v0 + " .. " + (g.v1 - 1) + "): the islands of a mesh must not share vertices (keep_islands: false optimizes the mesh as one)");
      T[k] = v;
    }
    let t0 = now(), nT = ni / 3, plan = null;
    const canon = new Int32Array(n), plan_of = function () { return plan || (plan = weld_plan(L, S, g.v0, g.v1)); };
    let welded = 0;
    if (S.weld >= 0 && n > 0) {
      welded = weld_group(P, n, T, ni, plan_of(), S.weld, canon);
      for (let k = 0; k < ni; k++) T[k] = canon[T[k]];
    } else for (let v = 0; v < n; v++) canon[v] = v;
    ms.weld += now() - t0; t0 = now();
    if (S.clean.on) {
      if (S.clean.degenerate && nT > 0) rep.joined += join_slivers(P, T, nT, n, plan_of, S.clean.min_height, canon);
      const f = triangle_filter(P, T, nT, S.clean);
      let w = 0;
      for (let t = 0; t < nT; t++) if (f.keep[t]) { T[w * 3] = T[t * 3]; T[w * 3 + 1] = T[t * 3 + 1]; T[w * 3 + 2] = T[t * 3 + 2]; w++; }
      rep.collapsed += f.collapsed; rep.thin += f.thin; rep.duplicates += f.duplicates; rep.opposite += f.opposite;
      nT = w;
      if (S.min_island > 0 && nT > 0) {                                                      // floating islands: the components that are fewer triangles than that
        const comp = components(T, nT, n), cnt = new Int32Array(n);
        for (let t = 0; t < nT; t++) cnt[find(comp.parent, T[t * 3])]++;
        let w2 = 0;
        for (let t = 0; t < nT; t++) {
          if (cnt[find(comp.parent, T[t * 3])] >= S.min_island) { T[w2 * 3] = T[t * 3]; T[w2 * 3 + 1] = T[t * 3 + 1]; T[w2 * 3 + 2] = T[t * 3 + 2]; w2++; }
          else rep.island_triangles++;
        }
        for (let v = 0; v < n; v++) if (comp.seen[v] && find(comp.parent, v) === v && cnt[v] < S.min_island) rep.islands_removed++;
        nT = w2;
      }
    }
    ms.clean += now() - t0; t0 = now();
    // the vertices that are left, in their own order: what weld merged away is gone, and (with clean) so is what no triangle uses
    const drop_unref = S.clean.on && S.clean.unreferenced, used = new Uint8Array(n);
    for (let k = 0; k < nT * 3; k++) used[T[k]] = 1;
    const dense = new Int32Array(n);
    let back = new Uint32Array(n), m = 0;
    for (let v = 0; v < n; v++) if (canon[v] === v && (used[v] || !drop_unref)) { dense[v] = m; back[m++] = v; }
    for (let k = 0; k < nT * 3; k++) T[k] = dense[T[k]];
    let Tc = nT * 3 === T.length ? T : T.subarray(0, nT * 3);
    ms.clean += now() - t0; t0 = now();
    if (S.cache > 0 && nT > 0) { const R = cache_order(Tc, nT, m, S.cache, S.algorithm); Tc.set(R); }
    ms.cache += now() - t0; t0 = now();
    if (S.fetch && m > 0) {
      const map = new Int32Array(m).fill(-1), order = new Uint32Array(m);
      let c = 0;
      for (let k = 0; k < nT * 3; k++) { const v = Tc[k]; if (map[v] < 0) { map[v] = c; order[c++] = v; } Tc[k] = map[v]; }
      for (let v = 0; v < m; v++) if (map[v] < 0) { map[v] = c; order[c++] = v; }              // (the vertices no triangle uses, when they are kept: at the end)
      const nb = new Uint32Array(m);
      for (let i = 0; i < m; i++) nb[i] = back[order[i]];
      back = nb;
    }
    ms.fetch += now() - t0;
    for (let k = 0; k < nT * 3; k++) out.I[out.ni + k] = Tc[k] + out.nv;
    for (let i = 0; i < m; i++) out.remap[out.nv + i] = g.v0 + back[i];
    const res = { vertex_start: out.nv, vertex_count: m, index_start: out.ni, index_count: nT * 3 };
    rep.welded += welded;
    out.nv += m; out.ni += nT * 3;
    return res;
  }

  // ---- the arrays follow the vertices -------------------------------------------------------------------------------------------------------------------------------------------------------
  function gather(a, stride, remap, n) {
    const out = new a.constructor(n * stride);
    if (stride === 1) for (let i = 0; i < n; i++) out[i] = a[remap[i]];
    else if (stride === 2) for (let i = 0; i < n; i++) { const s = remap[i] * 2; out[i * 2] = a[s]; out[i * 2 + 1] = a[s + 1]; }
    else if (stride === 3) for (let i = 0; i < n; i++) { const s = remap[i] * 3; out[i * 3] = a[s]; out[i * 3 + 1] = a[s + 1]; out[i * 3 + 2] = a[s + 2]; }
    else if (stride === 4) for (let i = 0; i < n; i++) { const s = remap[i] * 4; out[i * 4] = a[s]; out[i * 4 + 1] = a[s + 1]; out[i * 4 + 2] = a[s + 2]; out[i * 4 + 3] = a[s + 3]; }
    else for (let i = 0; i < n; i++) { const s = remap[i] * stride, d = i * stride; for (let j = 0; j < stride; j++) out[d + j] = a[s + j]; }
    return out;
  }

  // ---- optimize ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  function optimize(mesh, o) {
    const S = settings(o), L = read_mesh(mesh, "optimize"), T_all = now(), nv = L.nv, ni = L.nt * 3;
    const before = S.stats ? stats_of(L, mesh, {}) : null;
    const groups = make_groups(mesh, L, S), ms = { weld: 0, clean: 0, cache: 0, fetch: 0, gather: 0, stats: 0, total: 0 };
    const out = { I: new Uint32Array(ni), remap: new Uint32Array(nv), ni: 0, nv: 0 };
    const rep = { welded: 0, joined: 0, collapsed: 0, thin: 0, duplicates: 0, opposite: 0, island_triangles: 0, islands_removed: 0 };
    const ranges = new Array(groups.length), per = [];
    groups.forEach(function (g, k) {
      const r = process_group(L, S, g, out, ms, rep);
      ranges[k] = r;
      per.push({ name: g.name, vertices_before: g.v1 - g.v0, vertices_after: r.vertex_count, triangles_before: (g.i1 - g.i0) / 3, triangles_after: r.index_count / 3 });
    });
    const nvo = out.nv, nio = out.ni, remap = out.remap.slice(0, nvo);
    let t0 = now();
    const u16 = S.indices === "u16" || (S.indices === "auto" && nvo <= 65536) || (S.indices === "keep" && mesh.indices instanceof Uint16Array && nvo <= 65536);
    if (u16 && nvo > 65536) fail("opts.indices \"u16\" needs at most 65536 vertices (the mesh has " + nvo + ")");
    const indices = u16 ? Uint16Array.from(out.I.subarray(0, nio)) : out.I.slice(0, nio), res = {};
    Object.keys(mesh).forEach(function (k) {
      const v = mesh[k];
      if (k === "positions") res.positions = gather(L.P, 3, remap, nvo);
      else if (k === "indices") res.indices = indices;
      else if (L.by_key[k] && L.by_key[k].a === v) res[k] = gather(v, L.by_key[k].stride, remap, nvo);
      else if (k === "islands" && groups[0].entry >= 0) {
        res.islands = mesh.islands.map(function (e) { return Object.assign({}, e); });
        groups.forEach(function (g, i) { Object.assign(res.islands[g.entry], ranges[i]); });
      }
      else if (k === "islands" && Array.isArray(v) && v.length) return;                                    // (keep_islands: false: the ranges mean nothing now)
      else res[k] = v;
    });
    if (Array.isArray(mesh.bounds) && mesh.bounds.length === 6) res.bounds = bounds_of(res.positions, nvo);
    if (typeof mesh.vertex_count === "number" && mesh.vertex_count === nv) res.vertex_count = nvo;
    ms.gather += now() - t0;
    const result = { mesh: res, remap: remap, stats: null };
    if (S.stats) {
      t0 = now();
      const after = stats_of(read_mesh(res, "optimize"), res, {});
      ms.stats += now() - t0;
      result.stats = Object.assign({}, after, { before: before, after: after });
    } else result.stats = {};
    ms.total = now() - T_all;
    result.stats.removed = { welded: rep.welded, slivers_joined: rep.joined, collapsed: rep.collapsed, thin: rep.thin, duplicates: rep.duplicates, opposite_pairs: rep.opposite, island_triangles: rep.island_triangles, islands_removed: rep.islands_removed,
      unreferenced: nv - rep.welded - rep.joined - nvo, vertices: nv - nvo, triangles: L.nt - nio / 3 };
    result.stats.groups = per; result.stats.ms = ms; result.stats.options = S;
    return result;
  }
  function bounds_of(P, n) {
    const b = [BIG, BIG, BIG, -BIG, -BIG, -BIG];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const v = P[i * 3 + k]; if (v < b[k]) b[k] = v; if (v > b[k + 3]) b[k + 3] = v; }
    return n ? b : [0, 0, 0, 0, 0, 0];
  }
  // one pass alone: weld(mesh, 1e-4), cache(mesh, 16), clean(mesh), fetch(mesh); a number is the pass's own setting, an object is the options of optimize (they win over "the others off")
  function only(which) {
    return function (mesh, o) {
      const x = { weld: false, clean: false, cache: false, fetch: false, stats: false };
      x[which] = typeof o === "number" ? o : true;
      if (o && typeof o === "object") Object.assign(x, o);
      return optimize(mesh, x);
    };
  }

  // ---- stats -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  function raw_bytes(mesh) {
    let n = 0;
    Object.keys(mesh).forEach(function (k) {
      const a = mesh[k];
      if (type_of(a)) n += a.byteLength; else if ((k === "positions" || k === "indices") && a && typeof a.length === "number") n += a.length * 4;
    });
    return n;
  }
  function stats_of(L, mesh, o) {
    const K = o.cache_size > 0 ? Math.floor(o.cache_size) : 32, sizes = [16, 32], nv = L.nv, nt = L.nt, I = L.I, P = L.P, r = { vertices: nv, triangles: nt };
    if (sizes.indexOf(K) < 0) sizes.push(K);
    const sim = {};
    sizes.forEach(function (k) { sim[k] = cache_sim(I, nt, nv, k); });
    const ratio = function (a, b) { return b > 0 ? a / b : 0; };
    r.cache_size = K; r.acmr = ratio(sim[K].misses, nt); r.atvr = ratio(sim[K].misses, sim[K].used);
    r.acmr16 = ratio(sim[16].misses, nt); r.atvr16 = ratio(sim[16].misses, sim[16].used); r.acmr32 = ratio(sim[32].misses, nt); r.atvr32 = ratio(sim[32].misses, sim[32].used);
    r.referenced = sim[K].used; r.unreferenced = nv - sim[K].used;
    r.bytes = raw_bytes(mesh);
    const adj = adjacency(I, nt, nv), e = edge_counts(I, nt, nv, adj);
    r.edges = e.edges; r.boundary_edges = e.boundary; r.non_manifold_edges = e.non_manifold;
    r.islands = components(I, nt, nv).count;
    r.islands_declared = Array.isArray(mesh.islands) ? mesh.islands.length : 0;
    // the surface and the volume it holds (the signed volume: positive when the triangles face outwards)
    let area = 0, vol = 0;
    for (let t = 0; t < nt; t++) {
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3, ax = P[a], ay = P[a + 1], az = P[a + 2], bx = P[b], by = P[b + 1], bz = P[b + 2], cx = P[c], cy = P[c + 1], cz = P[c + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az, nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      area += 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz);
      vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    }
    r.area = area; r.volume = vol; r.bounds = bounds_of(P, nv);
    const f = triangle_filter(P, I, nt, { degenerate: true, duplicates: true, min_height: 1e-6 });
    r.degenerate = f.collapsed + f.thin; r.duplicates = f.duplicates; r.opposite_pairs = f.opposite;
    // the same by PLACE: the vertices within `place` metres of each other (1e-6, the weld's own) are one vertex, whatever their attributes (a seam of the uvs or a hard edge is not an opening)
    if (o.by_position !== false) {
      const pc = new Int32Array(nv), J = new Uint32Array(I.length), merged = weld_group(P, nv, I, I.length, [], o.place >= 0 ? o.place : 1e-6, pc);
      for (let k = 0; k < I.length; k++) J[k] = pc[I[k]];
      const ea = edge_counts(J, nt, nv, adjacency(J, nt, nv));
      r.open_edges = ea.boundary; r.non_manifold_places = ea.non_manifold; r.shells = components(J, nt, nv).count; r.places = r.referenced - merged;
    }
    return r;
  }
  function stats(mesh, o) { return stats_of(read_mesh(mesh, "stats"), mesh, o || {}); }

  // ---- pack: the mesh for the piece file --------------------------------------------------------------------------------------------------------------------------------------------------
  // THE LAYOUT. pack(mesh) -> { header, blobs }. `header` is a plain JSON object, `blobs` an object { name: Uint8Array } in the order of header.blobs (each: { name, offset, bytes }: offset into the blobs laid one after
  // the other, each starting at a multiple of 4 bytes; header.bytes is their total). All numbers little endian. For a mesh of nv vertices and nt triangles:
  //   positions   u16 x 3 a vertex: round((p - lo) / (hi - lo) * 65535) on each axis (header.positions.bounds = [lox, loy, loz, hix, hiy, hiz]: the box of the vertices, doubles in the JSON); an axis with no extent is all 0
  //               error: at most (hi - lo) / 131070 on each axis, + the rounding of the Float32 result: 0.0076 mm for a part 1 m long (header.quality.position_error says the one measured)
  //   normals     (a typed array `normals`, 3 a vertex) OCTAHEDRAL: the unit vector folded on the octahedron, (u, v) in -1 .. 1 as i16 x 2 (bits 16, the default: 4 bytes a vertex, 0.0025 degrees off at the worst, 0.0012 on average,
  //               measured on 600 k random vectors) or i8 x 2 (bits 8: 2 bytes, 0.63 degrees at the worst, 0.31 on average), the best of the four neighbouring grid points kept (header.quality.normal_error_max_degrees
  //               is the worst error of THIS mesh's vectors, measured); a zero vector is stored as +y; the vectors come back unit
  //   colors      (typed array `colors`, 3 or 4 a vertex) u8: red, green, blue as sRGB (space "srgb": the mesher's colours are linear light and its textures are sRGB bytes, so a colour that came from a
  //               texture is stored as the byte it was: no loss) or as they are (space "linear": round(c * 255)); alpha (always as it is) only when some vertex has one under 1, else it is implied (alpha "one": RGB, 3 bytes)
  //               a vertex; a Uint8Array of colours is stored as it is. Clamped to 0 .. 1 (the count is in header.quality.colors_clipped)
  //   skin_*      the pair of skin arrays (skin_indices + skin_weights, bone_indices + bone_weights, joints + weights): `slots` influences a vertex (the most any vertex uses: 1 .. the mesh's stride; the rest are zero
  //               weights and come back as bone 0, weight 0): the bone indices u8 (u16 when a bone is 256 or more), the weights u8 that add up to EXACTLY 255 for every vertex (the weights over their sum, rounded
  //               down, the left over units to the largest remainders, the lowest slot on a tie; a vertex with no weight is 255 on slot 0): each weight off by less than 1 / 255
  //   indices     u16 when the mesh has at most 65536 vertices, else u32; the triangles as they are
  //   others      an integer array (material_ids, part_ids ...) in the narrowest of u8 / u16 / u32 that holds its values (exact), any other typed array (uvs, roughness ...) as its own bytes
  //   header      { format: "happy.meshpack", version: 1, vertices, triangles, positions: { blob, bounds, bits: 16 }, indices: { blob, type, source }, arrays: [{ key, codec, blob, source (the typed array it comes back as),
  //               stride (per vertex) ... }], fields (every property that is not a typed array, as JSON: skin_count, parts, islands ...: opts.fields = false or a list of names keeps the rest out), skipped (the typed
  //               arrays left out: not per vertex, or opts.drop), blobs, bytes, quality }
  // opts (pack): normal_bits (16 | 8), color_space ("srgb" | "linear"), drop ([keys of per-vertex arrays to leave out]), fields (true | false | [names])
  function pack(mesh, o) {
    o = o || {};
    if (!LITTLE) fail("pack: the file's arrays are little endian and this machine is not");
    const L = read_mesh(mesh, "pack"), nv = L.nv, nt = L.nt, P = L.P, I = L.I, bits = o.normal_bits === 8 ? 8 : 16, space = o.color_space === "linear" ? "linear" : "srgb", drop = o.drop || [];
    const keep_field = function (k) { return o.fields === undefined || o.fields === true ? true : (Array.isArray(o.fields) ? o.fields.indexOf(k) >= 0 : false); };       // (fields: false stores none, a list of names only those, the default every one JSON can say)
    const header = { format: "happy.meshpack", version: 1, vertices: nv, triangles: nt, positions: null, indices: null, arrays: [], fields: {}, blobs: [], bytes: 0, quality: {} }, blobs = {}, names = [];
    const put = function (name, bytes) { blobs[name] = bytes; names.push(name); };
    const view = function (a) { return new Uint8Array(a.buffer, a.byteOffset, a.byteLength); };
    const copy = function (a) { const c = new Uint8Array(a.byteLength); c.set(view(a)); return c; };                    // (the blobs own their bytes: a pack is not a window on the mesh it was made of)
    // positions
    const b = bounds_of(P, nv), q = new Uint16Array(nv * 3), perr = [0, 0, 0], sc = [0, 0, 0], step = [0, 0, 0];
    for (let k = 0; k < 3; k++) { const ext = b[k + 3] - b[k]; sc[k] = ext > 0 ? 65535 / ext : 0; step[k] = ext > 0 ? ext / 65535 : 0; }
    for (let v = 0; v < nv; v++) for (let k = 0; k < 3; k++) {
      const x = P[v * 3 + k], qi = sc[k] > 0 ? Math.round((x - b[k]) * sc[k]) : 0, e = Math.abs(Math.fround(b[k] + qi * step[k]) - x);
      q[v * 3 + k] = qi;
      if (e > perr[k]) perr[k] = e;
    }
    put("positions", view(q));
    header.positions = { blob: "positions", bounds: b, bits: 16 };
    header.quality.position_error = perr;
    header.quality.position_error_bound = [0, 1, 2].map(function (k) { return (b[k + 3] - b[k]) / 131070; });
    // the per-vertex arrays
    const skip = {};
    if (L.skin) { skip[L.skin.si.key] = 1; skip[L.skin.sw.key] = 1; }
    L.vert.forEach(function (e) {
      if (skip[e.key] || drop.indexOf(e.key) >= 0) return;
      const a = e.a, ty = type_of(a), s = e.stride, ent = { key: e.key, stride: s, source: a.constructor.name };
      if (L.norm === e && (ty === "f32" || ty === "f64")) {
        const m = oct_encode(a, nv, bits);
        ent.codec = "oct"; ent.bits = bits; ent.blob = e.key; put(e.key, view(m.q));
        header.quality.normal_error_max_degrees = m.max_deg;
      } else if (L.color === e && (ty === "f32" || ty === "f64") && (s === 3 || s === 4)) {
        const m = color_encode(a, nv, s, space);
        ent.codec = "color"; ent.space = space; ent.alpha = s === 3 ? "none" : (m.alpha_one ? "one" : "stored"); ent.channels = m.channels; ent.blob = e.key; put(e.key, m.bytes);
        header.quality.color_error_max = m.err; header.quality.colors_clipped = m.clipped;
      } else if (ty === "u8" || ty === "u16" || ty === "u32" || ty === "i8" || ty === "i16" || ty === "i32") {
        const w = int_width(a), stored = w || ty;
        ent.codec = "int"; ent.type = stored; ent.blob = e.key;
        if (stored === ty) put(e.key, copy(a)); else { const c = new CTOR[stored](a.length); c.set(a); put(e.key, view(c)); }
      } else { ent.codec = "raw"; ent.type = ty; ent.blob = e.key; put(e.key, copy(a)); }
      header.arrays.push(ent);
    });
    if (L.skin && drop.indexOf(L.skin.si.key) < 0) {
      const sk = skin_encode(L.skin, nv), s = L.skin.stride;
      put(L.skin.si.key, view(sk.indices)); put(L.skin.sw.key, view(sk.weights));
      header.arrays.push({ key: L.skin.si.key, codec: "skin_indices", blob: L.skin.si.key, type: sk.index_type, stride: s, slots: sk.slots, source: L.skin.si.a.constructor.name });
      header.arrays.push({ key: L.skin.sw.key, codec: "skin_weights", blob: L.skin.sw.key, stride: s, slots: sk.slots, source: L.skin.sw.a.constructor.name });
      header.quality.weight_error_max = sk.err; header.quality.weightless_vertices = sk.zero;
    }
    // the triangles
    const it = nv <= 65536 ? "u16" : "u32", ix = it === "u16" ? Uint16Array.from(I) : I;
    put("indices", view(ix));
    header.indices = { blob: "indices", type: it, source: mesh.indices && mesh.indices.constructor && mesh.indices.constructor.name !== "Array" ? mesh.indices.constructor.name : "Uint32Array" };
    // everything else of the mesh that JSON can say (a typed array that is not a per-vertex array is not stored: header.skipped lists it)
    header.skipped = [];
    Object.keys(mesh).forEach(function (k) {
      if (k === "positions" || k === "indices") return;
      if (type_of(mesh[k])) { if (!L.by_key[k] || drop.indexOf(k) >= 0) header.skipped.push(k); return; }
      if (typeof mesh[k] === "function" || mesh[k] === undefined || !keep_field(k)) return;
      let text;
      try { text = JSON.stringify(mesh[k]); } catch (err) { return; }
      if (text !== undefined) header.fields[k] = JSON.parse(text);
    });
    let off = 0;
    names.forEach(function (n) { header.blobs.push({ name: n, offset: off, bytes: blobs[n].length }); off += (blobs[n].length + 3) & ~3; });
    header.bytes = off;
    return { header: header, blobs: blobs };
  }
  // ---- the codecs ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // the narrowest unsigned type that holds an integer array's values (null: it is not one that narrows: negative values, or it is as narrow as it goes)
  function int_width(a) {
    let hi = 0;
    for (let i = 0; i < a.length; i++) { const v = a[i]; if (v < 0) return null; if (v > hi) hi = v; }
    return hi <= 255 ? "u8" : (hi <= 65535 ? "u16" : "u32");
  }
  // unit vectors as octahedral coordinates (Cigolle, Donow, Evangelakos, Mara, McGuire, Meyer 2014): the vector is divided by |x| + |y| + |z|, the lower half folded over, (u, v) in -1 .. 1 stored as snorm i8 / i16
  function oct_decode_one(qu, qv, M, out) {
    let u = qu / M, v = qv / M;
    const z = 1 - Math.abs(u) - Math.abs(v);
    let x = u, y = v, zz = z;
    if (z < 0) { x = (1 - Math.abs(v)) * (u >= 0 ? 1 : -1); y = (1 - Math.abs(u)) * (v >= 0 ? 1 : -1); }
    const l = Math.sqrt(x * x + y * y + zz * zz) || 1;
    out[0] = x / l; out[1] = y / l; out[2] = zz / l;
  }
  function oct_encode(N, nv, bits) {
    const M = bits === 8 ? 127 : 32767, q = bits === 8 ? new Int8Array(nv * 2) : new Int16Array(nv * 2), d = [0, 0, 0];
    let worst = 1;
    for (let i = 0; i < nv; i++) {
      let x = N[i * 3], y = N[i * 3 + 1], z = N[i * 3 + 2];
      const len = Math.sqrt(x * x + y * y + z * z), l1 = Math.abs(x) + Math.abs(y) + Math.abs(z);
      if (!(len > 0) || !(l1 > 0)) { q[i * 2] = 0; q[i * 2 + 1] = M; continue; }          // (no direction: +y)
      let u = x / l1, v = y / l1;
      if (z < 0) { const ou = u; u = (1 - Math.abs(v)) * (ou >= 0 ? 1 : -1); v = (1 - Math.abs(ou)) * (v >= 0 ? 1 : -1); }
      x /= len; y /= len; z /= len;
      const fu = Math.floor(u * M), fv = Math.floor(v * M);
      let bu = 0, bv = 0, bd = -2;
      for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) {                         // (the four grid points round (u, v): the one that points closest)
        const cu = Math.max(-M, Math.min(M, fu + a)), cv = Math.max(-M, Math.min(M, fv + c));
        oct_decode_one(cu, cv, M, d);
        const dot = d[0] * x + d[1] * y + d[2] * z;
        if (dot > bd) { bd = dot; bu = cu; bv = cv; }
      }
      q[i * 2] = bu; q[i * 2 + 1] = bv;
      if (bd < worst) worst = bd;
    }
    return { q: q, max_deg: Math.acos(Math.min(1, worst)) * 180 / Math.PI };
  }
  const SRGB_TO_LIN = (function () {
    const t = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const c = i / 255; t[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    return t;
  })();
  function lin_to_srgb8(c) { return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); }
  // colours (floats, 3 or 4 a vertex) -> bytes. alpha_one: every vertex has alpha 1 and it is not stored.
  function color_encode(a, nv, s, space) {
    let alpha_one = s === 3;
    if (s === 4) { alpha_one = true; for (let v = 0; v < nv; v++) if (!(a[v * 4 + 3] === 1)) { alpha_one = false; break; } }
    const ch = s === 3 || alpha_one ? 3 : 4, bytes = new Uint8Array(nv * ch), srgb = space === "srgb";
    let err = 0, clipped = 0;
    for (let v = 0; v < nv; v++) for (let k = 0; k < ch; k++) {
      let c = a[v * s + k];
      if (!(c >= 0)) { if (c !== 0) clipped++; c = 0; } else if (c > 1) { clipped++; c = 1; }          // (NaN and negative: 0)
      const byte = srgb && k < 3 ? lin_to_srgb8(c) : Math.round(c * 255), back = srgb && k < 3 ? SRGB_TO_LIN[byte] : byte / 255, e = Math.abs(Math.fround(back) - c);
      bytes[v * ch + k] = byte;
      if (e > err) err = e;
    }
    return { bytes: bytes, alpha_one: alpha_one, channels: ch, err: err, clipped: clipped };
  }
  // the pair of skin arrays -> { indices (Uint8Array | Uint16Array), weights (Uint8Array), slots, index_type, err, zero }
  function skin_encode(sk, nv) {
    const s = sk.stride, si = sk.si.a, sw = sk.sw.a, wt = type_of(sw), unit = UNIT[wt];
    let slots = 0, top = 0;
    for (let v = 0; v < nv; v++) for (let j = 0; j < s; j++) if (sw[v * s + j] > 0 && j + 1 > slots) slots = j + 1;
    if (slots === 0) slots = 1;
    for (let v = 0; v < nv; v++) for (let j = 0; j < slots; j++) if (si[v * s + j] > top) top = si[v * s + j];             // (the width holds every stored index, a weightless slot's too: a reader may check them)
    const wide = top > 255, indices = wide ? new Uint16Array(nv * slots) : new Uint8Array(nv * slots), weights = new Uint8Array(nv * slots), w = new Float64Array(slots), fr = new Float64Array(slots), fl = new Int32Array(slots);
    let err = 0, zero = 0;
    for (let v = 0; v < nv; v++) {
      let sum = 0;
      for (let j = 0; j < slots; j++) { let x = sw[v * s + j] / unit; if (!(x > 0)) x = 0; w[j] = x; sum += x; indices[v * slots + j] = si[v * s + j]; }
      if (!(sum > 0)) { zero++; weights[v * slots] = 255; continue; }                       // (no weight at all: the whole vertex on its first bone; counted in header.quality.weightless_vertices)
      let total = 0;
      for (let j = 0; j < slots; j++) { const t = w[j] / sum * 255; fl[j] = Math.floor(t); fr[j] = t - fl[j]; total += fl[j]; }
      for (let left = 255 - total; left > 0; left--) {                                  // (the left over units: to the largest remainder, the lowest slot first)
        let best = 0;
        for (let j = 1; j < slots; j++) if (fr[j] > fr[best]) best = j;
        fl[best]++; fr[best] = -1;
      }
      for (let j = 0; j < slots; j++) { weights[v * slots + j] = fl[j]; const e = Math.abs(fl[j] / 255 - w[j] / sum); if (e > err) err = e; }
    }
    return { indices: indices, weights: weights, slots: slots, index_type: wide ? "u16" : "u8", err: err, zero: zero };
  }

  // ---- unpack --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  function blob_of(header, blobs, name) {
    const e = header.blobs.find(function (b) { return b.name === name; });
    if (!e) fail("unpack: the header has no blob '" + name + "'");
    let bytes;
    if (blobs instanceof Uint8Array) bytes = blobs.subarray(e.offset, e.offset + e.bytes);
    else if (Array.isArray(blobs)) bytes = blobs[header.blobs.indexOf(e)];
    else bytes = blobs && blobs[name];
    if (!(bytes instanceof Uint8Array) || bytes.length !== e.bytes) fail("unpack: the blob '" + name + "' is " + (bytes && bytes.length !== undefined ? bytes.length + " bytes" : "missing") + ", the header says " + e.bytes);
    const copy = new Uint8Array(e.bytes);                                                // (a copy: the typed arrays made of it start at 0, aligned, whatever the file's buffer was)
    copy.set(bytes);
    return copy;
  }
  function typed(bytes, ty, n) {
    if (bytes.length < n * BYTES[ty]) fail("unpack: " + bytes.length + " bytes are too few for " + n + " " + ty);
    return new CTOR[ty](bytes.buffer, 0, n);
  }
  function unpack(header, blobs, o) {
    if (header && header.header && blobs === undefined) { blobs = header.blobs; header = header.header; }
    o = o || {};
    if (!LITTLE) fail("unpack: the file's arrays are little endian and this machine is not");
    if (!header || header.format !== "happy.meshpack") fail("unpack: this is not a mesh pack (format 'happy.meshpack' expected)");
    if (header.version !== 1) fail("unpack: version " + header.version + " of the mesh pack is not known (this reads 1)");
    const nv = header.vertices, nt = header.triangles, mesh = {};
    const pb = header.positions.bounds, pq = typed(blob_of(header, blobs, header.positions.blob), "u16", nv * 3), P = new Float32Array(nv * 3);
    for (let k = 0; k < 3; k++) { const ext = pb[k + 3] - pb[k], step = ext > 0 ? ext / 65535 : 0; for (let v = 0; v < nv; v++) P[v * 3 + k] = pb[k] + pq[v * 3 + k] * step; }
    mesh.positions = P;
    const iq = typed(blob_of(header, blobs, header.indices.blob), header.indices.type, nt * 3), want = o.indices === "stored" ? header.indices.type === "u16" ? "Uint16Array" : "Uint32Array" : header.indices.source;
    mesh.indices = want === "Uint32Array" || !CTOR[TYPE[want]] ? Uint32Array.from(iq) : CTOR[TYPE[want]].from(iq);
    const arrays = {}, order = header.arrays.map(function (e) { return e.key; });
    header.arrays.forEach(function (e) {
      const bytes = blob_of(header, blobs, e.blob), C = CTOR[TYPE[e.source]] || Float32Array, s = e.stride, n = nv * s;
      let a;
      if (e.codec === "oct") {
        const M = e.bits === 8 ? 127 : 32767, q = typed(bytes, e.bits === 8 ? "i8" : "i16", nv * 2), d = [0, 0, 0];
        a = new C(n);
        for (let v = 0; v < nv; v++) { oct_decode_one(q[v * 2], q[v * 2 + 1], M, d); a[v * 3] = d[0]; a[v * 3 + 1] = d[1]; a[v * 3 + 2] = d[2]; }
      } else if (e.codec === "color") {
        const ch = e.channels, srgb = e.space === "srgb";
        a = new C(n);
        for (let v = 0; v < nv; v++) {
          for (let k = 0; k < ch; k++) { const byte = bytes[v * ch + k]; a[v * s + k] = srgb && k < 3 ? SRGB_TO_LIN[byte] : byte / 255; }
          if (ch < s) a[v * s + 3] = 1;
        }
      } else if (e.codec === "skin_indices" || e.codec === "skin_weights") {
        const sl = e.slots, q = typed(bytes, e.codec === "skin_indices" ? e.type || "u8" : "u8", nv * sl), unit = UNIT[TYPE[e.source]] || 1;
        a = new C(n);
        for (let v = 0; v < nv; v++) for (let j = 0; j < sl; j++) a[v * s + j] = e.codec === "skin_indices" ? q[v * sl + j] : (unit === 1 ? q[v * sl + j] / 255 : Math.round(q[v * sl + j] / 255 * unit));
      } else {
        const stored = typed(bytes, e.type, n);
        a = new C(n);
        a.set(stored);
      }
      arrays[e.key] = a;
    });
    // the keys in the order the header lists them, then what JSON said
    order.forEach(function (k) { mesh[k] = arrays[k]; });
    Object.keys(header.fields).forEach(function (k) { mesh[k] = JSON.parse(JSON.stringify(header.fields[k])); });
    return mesh;
  }

  // ---- the file: HSYSMPK1, the header's length, the version, the header (JSON, utf-8, padded to 4), the blobs ----------------------------------------------------------------------------
  function utf8(text) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text);
    return new Uint8Array(Buffer.from(text, "utf8"));
  }
  function encode(packed) {
    const h = packed && packed.header, blobs = packed && packed.blobs;
    if (!h || h.format !== "happy.meshpack") fail("encode: this is not a mesh pack ({ header, blobs } from pack)");
    const jb = utf8(JSON.stringify(h)), pad = function (n) { return (4 - (n % 4)) % 4; }, base = 16 + jb.length + pad(jb.length), out = new Uint8Array(base + h.bytes), dv = new DataView(out.buffer);
    "HSYSMPK1".split("").forEach(function (ch, i) { out[i] = ch.charCodeAt(0); });
    dv.setUint32(8, jb.length, true); dv.setUint32(12, 1, true);
    out.set(jb, 16);
    h.blobs.forEach(function (e) { out.set(blob_of(h, blobs, e.name), base + e.offset); });
    return out;
  }
  function decode(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (b.length < 16 || String.fromCharCode.apply(null, Array.from(b.subarray(0, 8))) !== "HSYSMPK1") fail("decode: this is not a mesh pack file (it should start with HSYSMPK1)");
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), jl = dv.getUint32(8, true), version = dv.getUint32(12, true);
    if (version !== 1) fail("decode: version " + version + " of the mesh pack file is not known (this reads 1)");
    if (16 + jl > b.length) fail("decode: the file is cut short (the header)");
    const text = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8").decode(b.subarray(16, 16 + jl)) : Buffer.from(b.buffer, b.byteOffset + 16, jl).toString("utf8");
    let h;
    try { h = JSON.parse(text); } catch (e) { fail("decode: the header is not JSON: " + e.message); }
    if (!h || h.format !== "happy.meshpack" || !Array.isArray(h.blobs)) fail("decode: the header is not a mesh pack's");
    const base = 16 + jl + ((4 - (jl % 4)) % 4), blobs = {};
    h.blobs.forEach(function (e) {
      if (base + e.offset + e.bytes > b.length) fail("decode: the file is cut short (the blob '" + e.name + "')");
      const copy = new Uint8Array(e.bytes);                                                  // (a copy that owns its bytes: a Buffer's slice would be a window on the file)
      copy.set(b.subarray(base + e.offset, base + e.offset + e.bytes));
      blobs[e.name] = copy;
    });
    return { header: h, blobs: blobs };
  }

  // VERSION is the optimizer's: what a mesh comes out as (1: weld, clean, cache, fetch; 2: slivers that hold the surface together are joined before they go, uvs weld within 1e-4); the pack's own is header.version
  return { optimize: optimize, stats: stats, acmr: acmr, pack: pack, unpack: unpack, encode: encode, decode: decode, weld: only("weld"), clean: only("clean"), cache: only("cache"), fetch: only("fetch"), cache_order: cache_order, VERSION: 2 };
});
