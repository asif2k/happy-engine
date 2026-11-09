packing()("system_maps", function system_maps() {
  "use strict";
  // TEXTURE MAPS of a creature (pure: no engine, no DOM, no node module; the page, the worker and the tools use it; Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no classes).
  // A creature gets its detail from SMALL pictures, not from vertices: a colour map and ONE packed map, 64, 128 or 256 texels a side (any size 8 .. 1024), made from the mesh it already has.
  //
  //   THE MAPS: a definition's `material.maps` is { color?, pack?, normal?, ao? }; color, pack and normal are { size, data } (or { width, height, data }), data being the bytes of the picture (RGBA, row 0 is v = 0: no flip) as a Uint8Array or as a BASE64 string
  //   (a creature file is text). Two pictures, because the colour needs three channels and the rest of what a surface says fits in four; a third when the surface has relief:
  //     color   R G B  the colour, sRGB (the renderer decodes it: it is linear light by the time it is lit), times the mesh's own vertex colours (so a mesh whose vertices are white shows the picture as it is); A is not used (it is 255)
  //     pack    R  ambient occlusion (255: open, 0: shut)      G  roughness      B  metal      A  opacity (255: solid; the renderer cuts out under `alpha_test`)       ONE read of ONE picture for four things
  //     normal  R G B  a tangent-space normal, (x, y, z) * 0.5 + 0.5: x along u, y along v (row 0 is v = 0), z out of the surface; flat is (128, 128, 255). The engine's own normal map reads it (u_normal_map): the light finds the cracks between stones
  //   ao: [how much of the occlusion goes to the ambient light, how much of it darkens the colour] (0 .. 1: the default is [1, 0.5]: the deferred renderer has no occlusion of its own, so the colour carries some of it)
  //
  //   M.unwrap(mesh, opts?) -> { mesh, source, tri_chart, charts, scale, report }      UVs that belong to one place only: the triangles are grouped in CHARTS (patches that face about one way: `cone`, degrees), each is laid flat along its mean
  //     normal, turned to the box that holds it best, and the charts are packed in the unit square at one texel density (`scale`, texels a metre), `pad` texels apart. Every chart's vertices are its own (a vertex on a seam is made again:
  //     `source` says which vertex of the old mesh each is; positions, normals, colours, roughness, metallic, part_ids, skin_indices, skin_weights go with it).   opts: { size: 128, pad: 1 (2 above 128), cone: 70 }
  //   M.bake(mesh, opts?) -> { color, pack, normal?, report }       (normal when opts.relief = { height(p, n, info) -> metres, depth, strength, cavity }: the slope of that height, measured half a texel each way; the occlusion is darker where it is low)   the pictures of a mesh that has `uvs` of that kind: each texel is a point on the surface (its triangle, by barycentric), its colour and material are the mesh's there (opts.sampler(p, n, v)
  //     says another: (position, normal, interpolated defaults) -> { color: [r, g, b] linear, roughness, metal }, how an sdf's own field is read), its occlusion is counted by rays (opts.ao: { rays, radius, strength }, false: none), and the
  //     texels the charts leave are filled outwards (so that a filter or a mip never reads a hole).   opts: { size, roughness: 0.8, metal: 0, ao, sampler }
  //   M.make(mesh, opts?) -> { mesh, maps, report }       unwrap + bake: the mesh with its new uvs and WHITE vertex colours (the picture has the colour now), and the `maps` for a material
  //   M.apply(def, opts?) -> def           a creature's definition with its mesh unwrapped and its material given the maps (the definition is not changed)
  //   M.check(maps) -> [complaints]   M.bytes(entry) -> Uint8Array   M.text(maps) -> the maps with base64 text for data (what a creature file holds)   M.to_base64(u8) -> string   M.from_base64(string) -> Uint8Array
  //
  //   STORED ENCODED (a creature file is text, and raw pictures are big): an entry may be { size, jpeg: base64 } (the COLOUR map: a JPEG, a seventh of the raw bytes at quality 0.85) or { size, deflate: base64 } (any map, lossless: its four
  //   planes one after the other, deflated; the PACK map is stored this way, never as a JPEG: it holds the opacity and the metal, which a lossy picture without alpha spoils). The page turns them to and from bytes (system.maps.encode / decode:
  //   runtime.js, the browser's own codecs); here an encoded entry is only CHECKED and passed on (`text` writes the encoded form when there is one; `bytes` of one that is not decoded yet says so).
  //   M.encoded(entry) -> "jpeg" | "deflate" | null (null: raw bytes, or not a map)
  //
  //   THE PAINTER (a TEXTURE RECIPE for a creature of an sdf: `texture: { size, seed, layers }` next to its `sdf`, species.js bakes it when the species is made):
  //   M.painter(spec) -> { sampler, spec (cleaned), notes }   M.paint(mesh, spec, opts?) -> { mesh, maps, report }   M.clean_texture(spec) -> { spec, notes }   M.LAYERS -> the kinds of layer
  //   Layers act in order on the colour and the material of each texel, in the creature's own space (so a pattern is the same on every chart and on the other side of the body): fill, stripes, spots, cells, gradient, noise (below).
  //   RELIEF: a layer may also say `height` (metres, -0.5 .. 0.5: it raises the surface where it is, sinks it with a minus: the lines of cells are grooves, the ribs of a corduroy stripes) and cells `bulge` (a stone is a dome) and `step` (every stone at a level
  //   of its own). The recipe then bakes a NORMAL MAP of that height next to the colour (and darkens the occlusion in what is low): `normal: false` leaves it out, `normal: { strength, cavity }` tunes it. A recipe with no height makes none.

  const MIN_SIZE = 8, MAX_SIZE = 1024;
  const fail = function (msg) { throw new Error("system maps: " + msg); };
  const own = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  const is_bytes = function (a) { return a instanceof Uint8Array || a instanceof Uint8ClampedArray || Array.isArray(a); };

  // ---- base64 (a creature file is text) --------------------------------------------------------------------------------------------------------------------------------------------------------------
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function to_base64(u8) {
    let s = "";
    const n = u8.length;
    for (let i = 0; i < n; i += 3) {
      const a = u8[i], b = i + 1 < n ? u8[i + 1] : 0, c = i + 2 < n ? u8[i + 2] : 0, x = (a << 16) | (b << 8) | c;
      s += B64[(x >> 18) & 63] + B64[(x >> 12) & 63] + (i + 1 < n ? B64[(x >> 6) & 63] : "=") + (i + 2 < n ? B64[x & 63] : "=");
    }
    return s;
  }
  const B64_AT = (function () { const t = new Int16Array(128).fill(-1); for (let i = 0; i < 64; i++) t[B64.charCodeAt(i)] = i; return t; })();
  function base64_length(s) {                                                                          // the bytes a base64 text holds (-1: it is not one)
    if (typeof s !== "string" || s.length % 4 !== 0 || !/^[A-Za-z0-9+\/]*={0,2}$/.test(s)) return -1;
    return s.length / 4 * 3 - (s.length && s[s.length - 1] === "=" ? 1 : 0) - (s.length > 1 && s[s.length - 2] === "=" ? 1 : 0);
  }
  function from_base64(s) {
    const n = base64_length(s);
    if (n < 0) fail("not base64 text");
    const out = new Uint8Array(n);
    let o = 0;
    for (let i = 0; i < s.length; i += 4) {
      const a = B64_AT[s.charCodeAt(i)], b = B64_AT[s.charCodeAt(i + 1)], c = s[i + 2] === "=" ? 0 : B64_AT[s.charCodeAt(i + 2)], d = s[i + 3] === "=" ? 0 : B64_AT[s.charCodeAt(i + 3)], x = (a << 18) | (b << 12) | (c << 6) | d;
      if (o < n) out[o++] = (x >> 16) & 255;
      if (o < n) out[o++] = (x >> 8) & 255;
      if (o < n) out[o++] = x & 255;
    }
    return out;
  }

  // ---- the maps of a material: checked, and read as bytes --------------------------------------------------------------------------------------------------------------------------------------------
  function dims(e) {
    if (!e || typeof e !== "object" || Array.isArray(e)) return null;
    const w = e.size !== undefined ? e.size : e.width, h = e.size !== undefined ? e.size : e.height;
    return Number.isInteger(w) && Number.isInteger(h) && w >= MIN_SIZE && h >= MIN_SIZE && w <= MAX_SIZE && h <= MAX_SIZE ? { w: w, h: h } : null;
  }
  function check(maps) {
    const errs = [];
    if (!maps || typeof maps !== "object" || Array.isArray(maps)) return ["maps is { color?, pack?, normal?, ao? }"];
    Object.keys(maps).forEach(function (k) {
      if (k === "ao") {
        const a = maps.ao;
        if (!Array.isArray(a) || a.length !== 2 || !a.every(function (x) { return typeof x === "number" && x >= 0 && x <= 1; })) errs.push("maps.ao is [ambient, colour]: two numbers from 0 to 1 (" + JSON.stringify(a) + ")");
        return;
      }
      if (k !== "color" && k !== "pack" && k !== "normal") { errs.push("maps: unknown key '" + k + "' (color, pack, normal, ao)"); return; }
      const e = maps[k], d = dims(e);
      if (!d) { errs.push("maps." + k + " is { size, data } (or { width, height, data }) with a size from " + MIN_SIZE + " to " + MAX_SIZE + " (a small creature: 64, 128 or 256)"); return; }
      if (e.data === undefined && (e.jpeg !== undefined || e.deflate !== undefined)) {                                    // (stored encoded: only what can be told without decoding it)
        if (e.jpeg !== undefined && e.deflate !== undefined) errs.push("maps." + k + " is stored as jpeg or as deflate, not both");
        else if (e.jpeg !== undefined && (typeof e.jpeg !== "string" || e.jpeg.length < 16)) errs.push("maps." + k + ".jpeg is base64 text of a JPEG");
        else if (e.deflate !== undefined && (typeof e.deflate !== "string" || e.deflate.length < 4)) errs.push("maps." + k + ".deflate is base64 text of the deflated planes");
        else if (k === "pack" && e.jpeg !== undefined) errs.push("maps.pack is stored lossless (deflate), not as a JPEG: it holds the opacity and the metal");
        else if (k === "normal" && e.jpeg !== undefined) errs.push("maps.normal is stored lossless (deflate), not as a JPEG: a lossy picture bends every normal it holds");
        return;
      }
      const want = d.w * d.h * 4, have = typeof e.data === "string" ? base64_length(e.data) : is_bytes(e.data) ? e.data.length : -1;
      if (have !== want) errs.push("maps." + k + ".data must be " + want + " bytes (RGBA, " + d.w + " x " + d.h + ") as a Uint8Array or a base64 text (" + (have < 0 ? "it is neither" : "it has " + have) + ")");
    });
    return errs;
  }
  function encoded(e) { return e && typeof e === "object" && !Array.isArray(e) ? (typeof e.jpeg === "string" ? "jpeg" : typeof e.deflate === "string" ? "deflate" : null) : null; }
  function bytes(e) {
    const d = dims(e);
    if (!d) fail("a map is { size, data }");
    if (e.data === undefined && encoded(e)) fail("a map that is stored encoded (" + encoded(e) + ") has to be decoded first: await system.maps.decode(maps)");
    const u8 = typeof e.data === "string" ? from_base64(e.data) : e.data instanceof Uint8Array ? e.data : Uint8Array.from(e.data);
    if (u8.length !== d.w * d.h * 4) fail("a map of " + d.w + " x " + d.h + " has " + d.w * d.h * 4 + " bytes (it has " + u8.length + ")");
    return u8;
  }

  // the maps with their bytes as base64 text, what a creature file holds (a Uint8Array is not a picture once it has been through JSON)
  function text(maps) {
    const out = {};
    Object.keys(maps).forEach(function (k) {
      const e = maps[k];
      if ((k === "color" || k === "pack" || k === "normal") && e && typeof e === "object" && encoded(e)) { const d = dims(e); out[k] = typeof e.jpeg === "string" ? { size: d.w, jpeg: e.jpeg } : { size: d.w, deflate: e.deflate }; if (d.w !== d.h) { out[k].width = d.w; out[k].height = d.h; delete out[k].size; } return; }   // (encoded: that is what the file holds)
      out[k] = (k === "color" || k === "pack" || k === "normal") && e && typeof e === "object" ? Object.assign({}, e, { data: typeof e.data === "string" ? e.data : to_base64(bytes(e)) }) : e;
    });
    return out;
  }

  // ---- the unwrap ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const PER_VERTEX = ["positions", "normals", "colors", "roughness", "metallic", "part_ids", "skin_indices", "skin_weights"];
  function check_size(size) { if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) fail("size is a whole number from " + MIN_SIZE + " to " + MAX_SIZE + " (" + size + ")"); }
  function mesh_arrays(mesh) {
    if (!mesh || typeof mesh !== "object") fail("the mesh is an object of arrays");
    const P = mesh.positions, N = mesh.normals, I = mesh.indices;
    if (!P || P.length < 9 || P.length % 3 !== 0) fail("mesh.positions: 3 numbers a vertex");
    if (!N || N.length !== P.length) fail("mesh.normals: as many as the positions");
    if (!I || I.length < 3 || I.length % 3 !== 0) fail("mesh.indices: 3 vertex numbers a triangle");
    const nv = P.length / 3;
    for (let i = 0; i < I.length; i++) if (!(I[i] >= 0 && I[i] < nv) || I[i] !== (I[i] | 0)) fail("mesh.indices[" + i + "] = " + I[i] + " is not a vertex");
    return { P: P, N: N, I: I, nv: nv, nt: I.length / 3 };
  }
  function unwrap(mesh, opts) {
    opts = opts || {};
    const t0 = Date.now(), size = opts.size === undefined ? 128 : opts.size;
    check_size(size);
    const A = mesh_arrays(mesh), P = A.P, I = A.I, nv = A.nv, nt = A.nt;
    const pad = opts.pad !== undefined ? opts.pad : (size <= 128 ? 1 : 2), cone = Math.cos((opts.cone === undefined ? 70 : opts.cone) * Math.PI / 180);
    // the box, and positions that are the same place (a mesh is split at its seams of normal, colour and uv: the triangles on both sides of one are neighbours all the same)
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < nv; v++) for (let k = 0; k < 3; k++) { const x = P[v * 3 + k]; if (x < lo[k]) lo[k] = x; if (x > hi[k]) hi[k] = x; }
    const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]), eps = Math.max(diag * 1e-6, 1e-9);
    const wid = new Int32Array(nv), seen = new Map();
    for (let v = 0; v < nv; v++) {
      const key = Math.round(P[v * 3] / eps) + "_" + Math.round(P[v * 3 + 1] / eps) + "_" + Math.round(P[v * 3 + 2] / eps);
      let w = seen.get(key);
      if (w === undefined) { w = seen.size; seen.set(key, w); }
      wid[v] = w;
    }
    const nw = seen.size;
    // the faces: normal and area
    const tn = new Float64Array(nt * 3), ta = new Float64Array(nt);
    for (let t = 0; t < nt; t++) {
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x, len = Math.hypot(nx, ny, nz);
      ta[t] = len / 2;
      if (len > 1e-20) { tn[t * 3] = nx / len; tn[t * 3 + 1] = ny / len; tn[t * 3 + 2] = nz / len; } else { tn[t * 3] = 0; tn[t * 3 + 1] = 1; tn[t * 3 + 2] = 0; }
    }
    // the neighbours across an edge (the first other triangle that has it)
    const nbr = new Int32Array(nt * 3).fill(-1), edge = new Map();
    for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
      const w0 = wid[I[t * 3 + k]], w1 = wid[I[t * 3 + (k + 1) % 3]];
      if (w0 === w1) continue;
      const key = (w0 < w1 ? w0 * nw + w1 : w1 * nw + w0), o = edge.get(key);
      if (o === undefined) edge.set(key, t * 3 + k);
      else if (nbr[o] < 0 && nbr[t * 3 + k] < 0 && (o / 3 | 0) !== t) { nbr[o] = t; nbr[t * 3 + k] = (o / 3) | 0; }
    }
    // CHARTS: from the biggest triangle that is not in one, the neighbours whose normal is within the cone of the seed's
    const chart = new Int32Array(nt).fill(-1), order = [];
    for (let t = 0; t < nt; t++) order.push(t);
    order.sort(function (a, b) { return ta[b] - ta[a] || a - b; });
    let lists = [];
    for (let s = 0; s < nt; s++) {
      const seed = order[s];
      if (chart[seed] >= 0) continue;
      const id = lists.length, tris = [seed], stack = [seed], sx = tn[seed * 3], sy = tn[seed * 3 + 1], sz = tn[seed * 3 + 2];
      chart[seed] = id;
      while (stack.length) {
        const t = stack.pop();
        for (let k = 0; k < 3; k++) {
          const q = nbr[t * 3 + k];
          if (q >= 0 && chart[q] < 0 && tn[q * 3] * sx + tn[q * 3 + 1] * sy + tn[q * 3 + 2] * sz >= cone) { chart[q] = id; tris.push(q); stack.push(q); }
        }
      }
      lists.push(tris);
    }
    // the small charts join the neighbour they face most like (a chart of a few triangles would cost its padding all round)
    const area_of = function (tris) { let a = 0; for (let i = 0; i < tris.length; i++) a += ta[tris[i]]; return a; };
    const normal_of = function (tris) {
      let x = 0, y = 0, z = 0;
      for (let i = 0; i < tris.length; i++) { const t = tris[i]; x += tn[t * 3] * ta[t]; y += tn[t * 3 + 1] * ta[t]; z += tn[t * 3 + 2] * ta[t]; }
      const l = Math.hypot(x, y, z);
      return l > 1e-12 ? [x / l, y / l, z / l] : [tn[tris[0] * 3], tn[tris[0] * 3 + 1], tn[tris[0] * 3 + 2]];
    };
    let total = 0;
    for (let t = 0; t < nt; t++) total += ta[t];
    const small = total * 0.004, join = Math.cos(80 * Math.PI / 180);
    const by_area = lists.map(function (l, i) { return i; }).sort(function (a, b) { return area_of(lists[a]) - area_of(lists[b]) || a - b; });
    for (let r = 0; r < by_area.length; r++) {
      const id = by_area[r], tris = lists[id];
      if (!tris || area_of(tris) >= small) continue;
      const n = normal_of(tris), seen_ids = {};
      let best = -1, best_dot = join;
      for (let i = 0; i < tris.length; i++) for (let k = 0; k < 3; k++) {
        const q = nbr[tris[i] * 3 + k];
        if (q < 0 || chart[q] === id || seen_ids[chart[q]]) continue;
        seen_ids[chart[q]] = true;
        const m = normal_of(lists[chart[q]]), d = m[0] * n[0] + m[1] * n[1] + m[2] * n[2];
        if (d > best_dot) { best_dot = d; best = chart[q]; }
      }
      if (best >= 0) { tris.forEach(function (t) { chart[t] = best; lists[best].push(t); }); lists[id] = null; }
    }
    lists = lists.filter(function (l) { return l && l.length; });
    lists.forEach(function (l, i) { l.forEach(function (t) { chart[t] = i; }); });
    // each chart laid flat: along its mean normal, turned to the box that holds its points best
    const flat = lists.map(function (tris) {
      const n = normal_of(tris), a = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      let tx = a[1] * n[2] - a[2] * n[1], ty = a[2] * n[0] - a[0] * n[2], tz = a[0] * n[1] - a[1] * n[0];
      const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
      const bx = n[1] * tz - n[2] * ty, by = n[2] * tx - n[0] * tz, bz = n[0] * ty - n[1] * tx;
      const verts = [], local = new Map();
      tris.forEach(function (t) { for (let k = 0; k < 3; k++) { const v = I[t * 3 + k]; if (!local.has(v)) { local.set(v, verts.length); verts.push(v); } } });
      const X = new Float64Array(verts.length), Y = new Float64Array(verts.length);
      let mx = 0, my = 0;
      verts.forEach(function (v, i) { X[i] = P[v * 3] * tx + P[v * 3 + 1] * ty + P[v * 3 + 2] * tz; Y[i] = P[v * 3] * bx + P[v * 3 + 1] * by + P[v * 3 + 2] * bz; mx += X[i]; my += Y[i]; });
      mx /= verts.length; my /= verts.length;
      let th = 0, least = Infinity;                                                                       // (the turn, in steps of 3 degrees, that leaves the smallest box round the points)
      for (let a = 0; a < 90; a += 3) {
        const ra = a * Math.PI / 180, rc = Math.cos(ra), rs = Math.sin(ra);
        let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
        for (let i = 0; i < verts.length; i++) { const dx = X[i] - mx, dy = Y[i] - my, u = dx * rc + dy * rs, w = -dx * rs + dy * rc; if (u < u0) u0 = u; if (u > u1) u1 = u; if (w < w0) w0 = w; if (w > w1) w1 = w; }
        const box = (u1 - u0) * (w1 - w0);
        if (box < least - 1e-15) { least = box; th = ra; }
      }
      const c = Math.cos(th), s = Math.sin(th);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < verts.length; i++) {
        const dx = X[i] - mx, dy = Y[i] - my, u = dx * c + dy * s, w = -dx * s + dy * c;
        X[i] = u; Y[i] = w;
        if (u < x0) x0 = u; if (u > x1) x1 = u; if (w < y0) y0 = w; if (w > y1) y1 = w;
      }
      return { tris: tris, verts: verts, local: local, X: X, Y: Y, x0: x0, y0: y0, w: Math.max(x1 - x0, 1e-9), h: Math.max(y1 - y0, 1e-9) };
    });
    // PACKING: shelves, tallest first, one texel density for all the charts (the biggest it can be)
    const shelf = function (s) {
      const rects = flat.map(function (f, i) { return { i: i, w: f.w * s + 2 * pad, h: f.h * s + 2 * pad }; });
      rects.sort(function (a, b) { return b.h - a.h || a.i - b.i; });
      let x = 0, y = 0, row = 0;
      const at = new Array(flat.length);
      for (let k = 0; k < rects.length; k++) {
        const r = rects[k];
        if (r.w > size || r.h > size) return null;
        if (x + r.w > size) { x = 0; y += row; row = 0; }
        if (y + r.h > size) return null;
        at[r.i] = [x, y]; x += r.w; if (r.h > row) row = r.h;
      }
      return at;
    };
    let boxes = 0;
    flat.forEach(function (f) { boxes += f.w * f.h; });
    let hi_s = Math.sqrt(size * size / boxes), lo_s = hi_s * 0.2, placed = null;
    while (!(placed = shelf(lo_s))) { lo_s *= 0.5; if (lo_s < 1e-9) fail("the " + flat.length + " charts of this mesh do not fit " + size + " x " + size + " texels (a bigger size, or a wider `cone`)"); }
    for (let it = 0; it < 14; it++) { const mid = (lo_s + hi_s) / 2; if (shelf(mid)) lo_s = mid; else hi_s = mid; }
    const scale = lo_s;
    placed = shelf(scale);
    // THE NEW MESH: every chart's vertices are its own
    let nnv = 0;
    flat.forEach(function (f) { f.base = nnv; nnv += f.verts.length; });
    const uvs = new Float32Array(nnv * 2), source = new Uint32Array(nnv), tri_chart = new Uint16Array(nt), idx = new (nnv > 65535 ? Uint32Array : Uint16Array)(nt * 3);
    flat.forEach(function (f, c) {
      const ox = placed[c][0] + pad, oy = placed[c][1] + pad;
      f.verts.forEach(function (v, i) { const o = f.base + i; source[o] = v; uvs[o * 2] = (ox + (f.X[i] - f.x0) * scale) / size; uvs[o * 2 + 1] = (oy + (f.Y[i] - f.y0) * scale) / size; });
      f.tris.forEach(function (t) { tri_chart[t] = c; for (let k = 0; k < 3; k++) idx[t * 3 + k] = f.base + f.local.get(I[t * 3 + k]); });
    });
    const out = {};
    Object.keys(mesh).forEach(function (k) { out[k] = mesh[k]; });
    PER_VERTEX.forEach(function (k) {
      const a = mesh[k];
      if (!a || !a.length) return;
      const stride = a.length / nv, b = new a.constructor(nnv * stride);
      for (let i = 0; i < nnv; i++) for (let j = 0; j < stride; j++) b[i * stride + j] = a[source[i] * stride + j];
      out[k] = b;
    });
    out.indices = idx; out.uvs = uvs;
    let used = 0;
    for (let t = 0; t < nt; t++) used += ta[t];
    return { mesh: out, source: source, tri_chart: tri_chart, charts: flat.length, scale: scale, report: { size: size, pad: pad, charts: flat.length, vertices_before: nv, vertices_after: nnv, texels_a_metre: scale, filled: used * scale * scale / (size * size), ms: Date.now() - t0 } };
  }

  // ---- the bake -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const srgb = function (x) { x = x <= 0 ? 0 : x >= 1 ? 1 : x; return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)); };
  const byte = function (x) { return Math.round(255 * (x <= 0 ? 0 : x >= 1 ? 1 : x)); };
  function radical(k) { let r = 0, f = 0.5; for (let n = k; n > 0; n >>= 1) { if (n & 1) r += f; f *= 0.5; } return r; }
  // a grid of the triangles for the rays (cells of one size; the triangles are listed in every cell their box touches)
  function make_grid(P, I, lo, hi) {
    const nt = I.length / 3, ext = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1e-9), G = Math.max(4, Math.min(48, Math.round(Math.cbrt(nt) * 0.9) + 2)), cs = ext / G;
    const nx = Math.max(1, Math.ceil((hi[0] - lo[0]) / cs)), ny = Math.max(1, Math.ceil((hi[1] - lo[1]) / cs)), nz = Math.max(1, Math.ceil((hi[2] - lo[2]) / cs));
    const count = new Int32Array(nx * ny * nz + 1);
    const span = function (t, f) {
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (let k = 0; k < 3; k++) { const v = I[t * 3 + k] * 3, x = P[v], y = P[v + 1], z = P[v + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      const cl = function (v, n) { return v < 0 ? 0 : v >= n ? n - 1 : v; };
      const ax = cl(Math.floor((x0 - lo[0]) / cs), nx), bx = cl(Math.floor((x1 - lo[0]) / cs), nx), ay = cl(Math.floor((y0 - lo[1]) / cs), ny), by = cl(Math.floor((y1 - lo[1]) / cs), ny), az = cl(Math.floor((z0 - lo[2]) / cs), nz), bz = cl(Math.floor((z1 - lo[2]) / cs), nz);
      for (let z = az; z <= bz; z++) for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) f((z * ny + y) * nx + x);
    };
    for (let t = 0; t < nt; t++) span(t, function (c) { count[c + 1]++; });
    for (let c = 0; c < nx * ny * nz; c++) count[c + 1] += count[c];
    const fill = count.slice(0, nx * ny * nz), items = new Int32Array(count[nx * ny * nz]);
    for (let t = 0; t < nt; t++) span(t, function (c) { items[fill[c]++] = t; });
    return { P: P, I: I, lo: lo, cs: cs, nx: nx, ny: ny, nz: nz, start: count, items: items };
  }
  // the nearest hit of a ray within [tmin, tmax] (Infinity: none), by the cells it passes (Amanatides and Woo) and Moller and Trumbore in each
  function ray(g, ox, oy, oz, dx, dy, dz, tmin, tmax) {
    const P = g.P, I = g.I, cs = g.cs, nx = g.nx, ny = g.ny, nz = g.nz;
    let ix = Math.floor((ox - g.lo[0]) / cs), iy = Math.floor((oy - g.lo[1]) / cs), iz = Math.floor((oz - g.lo[2]) / cs);
    ix = ix < 0 ? 0 : ix >= nx ? nx - 1 : ix; iy = iy < 0 ? 0 : iy >= ny ? ny - 1 : iy; iz = iz < 0 ? 0 : iz >= nz ? nz - 1 : iz;
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    let tx = dx !== 0 ? ((dx > 0 ? ix + 1 : ix) * cs + g.lo[0] - ox) / dx : Infinity, ty = dy !== 0 ? ((dy > 0 ? iy + 1 : iy) * cs + g.lo[1] - oy) / dy : Infinity, tz = dz !== 0 ? ((dz > 0 ? iz + 1 : iz) * cs + g.lo[2] - oz) / dz : Infinity;
    const ddx = dx !== 0 ? cs / Math.abs(dx) : Infinity, ddy = dy !== 0 ? cs / Math.abs(dy) : Infinity, ddz = dz !== 0 ? cs / Math.abs(dz) : Infinity;
    for (;;) {
      const c = (iz * ny + iy) * nx + ix;
      let best = Infinity;
      for (let q = g.start[c]; q < g.start[c + 1]; q++) {
        const t = g.items[q], a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, d = I[t * 3 + 2] * 3;
        const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[d] - P[a], e2y = P[d + 1] - P[a + 1], e2z = P[d + 2] - P[a + 2];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-14 && det < 1e-14) continue;
        const inv = 1 / det, sx0 = ox - P[a], sy0 = oy - P[a + 1], sz0 = oz - P[a + 2], u = (sx0 * px + sy0 * py + sz0 * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = sy0 * e1z - sz0 * e1y, qy = sz0 * e1x - sx0 * e1z, qz = sx0 * e1y - sy0 * e1x, v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const t0 = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t0 >= tmin && t0 <= tmax && t0 < best) best = t0;
      }
      if (best < Infinity) return best;
      if (tx <= ty && tx <= tz) { if (tx > tmax) return Infinity; ix += sx; tx += ddx; if (ix < 0 || ix >= nx) return Infinity; }
      else if (ty <= tz) { if (ty > tmax) return Infinity; iy += sy; ty += ddy; if (iy < 0 || iy >= ny) return Infinity; }
      else { if (tz > tmax) return Infinity; iz += sz; tz += ddz; if (iz < 0 || iz >= nz) return Infinity; }
    }
  }

  function bake(mesh, opts) {
    opts = opts || {};
    const t0 = Date.now(), size = opts.size === undefined ? 128 : opts.size;
    check_size(size);
    const A = mesh_arrays(mesh), P = A.P, Nm = A.N, I = A.I, nv = A.nv, nt = A.nt, UV = mesh.uvs;
    if (!UV || UV.length !== nv * 2) fail("bake: the mesh has no uvs (unwrap it first)");
    const rough0 = opts.roughness === undefined ? 0.8 : opts.roughness, metal0 = opts.metal === undefined ? 0 : opts.metal;
    if (!(rough0 >= 0 && rough0 <= 1) || !(metal0 >= 0 && metal0 <= 1)) fail("bake: roughness and metal are numbers from 0 to 1");
    const C = mesh.colors, ck = C ? C.length / nv : 0, RG = mesh.roughness, MT = mesh.metallic, PID = mesh.part_ids, PARTS = mesh.parts;
    const vrough = function (v) { if (RG && RG[v] >= 0) return RG[v]; if (PID && PARTS && PARTS[PID[v]] && PARTS[PID[v]].roughness >= 0) return PARTS[PID[v]].roughness; return rough0; };
    const vmetal = function (v) { if (MT && MT[v] >= 0) return MT[v]; if (PID && PARTS && PARTS[PID[v]] && PARTS[PID[v]].metal >= 0) return PARTS[PID[v]].metal; return metal0; };
    const NN = size * size, cov = new Uint8Array(NN), val = new Float32Array(NN * 6), pos = new Float32Array(NN * 3), nor = new Float32Array(NN * 3);   // val: r g b (linear), ao, roughness, metal
    // RELIEF (opts.relief: { height(p, n, info) -> metres, depth, strength, cavity }): a height of the surface that the painter's layers say; the NORMAL MAP is its slope and the occlusion is darker where it is low. Each texel keeps the directions its u and v
    // go in on the surface (metres a texel) and the corner of its triangle it is nearest (the part it is on)
    const relief = opts.relief && typeof opts.relief.height === "function" ? opts.relief : null, tg = relief ? new Float32Array(NN * 6) : null, pv = relief ? new Int32Array(NN).fill(-1) : null;
    // every texel whose centre a triangle holds: the point, its normal, its colour and material
    for (let t = 0; t < nt; t++) {
      const i0 = I[t * 3], i1 = I[t * 3 + 1], i2 = I[t * 3 + 2];
      const ax = UV[i0 * 2] * size, ay = UV[i0 * 2 + 1] * size, bx = UV[i1 * 2] * size, by = UV[i1 * 2 + 1] * size, cx = UV[i2 * 2] * size, cy = UV[i2 * 2 + 1] * size;
      const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(den) < 1e-12) continue;
      let Tx = 0, Ty = 0, Tz = 0, Bx = 0, By = 0, Bz = 0;
      if (relief) {                                                                                                          // (the triangle's own frame: how the point moves when u (a texel to the right) and v (a texel down the picture) do)
        const p0 = i0 * 3, p1 = i1 * 3, p2 = i2 * 3, q1x = P[p1] - P[p0], q1y = P[p1 + 1] - P[p0 + 1], q1z = P[p1 + 2] - P[p0 + 2], q2x = P[p2] - P[p0], q2y = P[p2 + 1] - P[p0 + 1], q2z = P[p2 + 2] - P[p0 + 2];
        const du1 = bx - ax, dv1 = by - ay, du2 = cx - ax, dv2 = cy - ay, dd = du1 * dv2 - du2 * dv1;
        if (Math.abs(dd) > 1e-12) { Tx = (q1x * dv2 - q2x * dv1) / dd; Ty = (q1y * dv2 - q2y * dv1) / dd; Tz = (q1z * dv2 - q2z * dv1) / dd; Bx = (q2x * du1 - q1x * du2) / dd; By = (q2y * du1 - q1y * du2) / dd; Bz = (q2z * du1 - q1z * du2) / dd; }
      }
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 0.5)), x1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx) - 0.5)), y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - 0.5)), y1 = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy) - 0.5));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5, w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const o = y * size + x;
        let X = 0, Y = 0, Z = 0, nx = 0, ny = 0, nz = 0, r = 1, g = 1, b = 1, rg = 0, mt = 0;
        const ws = [w0, w1, w2], vs = [i0, i1, i2];
        for (let k = 0; k < 3; k++) {
          const v = vs[k], w = ws[k];
          X += w * P[v * 3]; Y += w * P[v * 3 + 1]; Z += w * P[v * 3 + 2]; nx += w * Nm[v * 3]; ny += w * Nm[v * 3 + 1]; nz += w * Nm[v * 3 + 2];
          rg += w * vrough(v); mt += w * vmetal(v);
        }
        if (ck) { r = g = b = 0; for (let k = 0; k < 3; k++) { const v = vs[k], w = ws[k]; r += w * C[v * ck]; g += w * C[v * ck + 1]; b += w * C[v * ck + 2]; } }
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        if (opts.sampler) {
          let pm = 0; if (w1 > w0 && w1 >= w2) pm = 1; else if (w2 > w0 && w2 > w1) pm = 2;                                // (the corner the texel is nearest: the part it is on)
          const pt = PID && PARTS ? PARTS[PID[vs[pm]]] : null;
          const s = opts.sampler([X, Y, Z], [nx, ny, nz], { color: [r, g, b], roughness: rg, metal: mt }, pt ? { part: pt.id, source: pt.source !== undefined ? pt.source : pt.id } : null);
          if (s) { if (s.color) { r = s.color[0]; g = s.color[1]; b = s.color[2]; } if (s.roughness !== undefined) rg = s.roughness; if (s.metal !== undefined) mt = s.metal; }
        }
        cov[o] = 1; pos[o * 3] = X; pos[o * 3 + 1] = Y; pos[o * 3 + 2] = Z; nor[o * 3] = nx; nor[o * 3 + 1] = ny; nor[o * 3 + 2] = nz;
        if (relief) { const g = o * 6; tg[g] = Tx; tg[g + 1] = Ty; tg[g + 2] = Tz; tg[g + 3] = Bx; tg[g + 4] = By; tg[g + 5] = Bz; pv[o] = vs[w1 > w0 && w1 >= w2 ? 1 : (w2 > w0 && w2 > w1 ? 2 : 0)]; }
        val[o * 6] = r; val[o * 6 + 1] = g; val[o * 6 + 2] = b; val[o * 6 + 3] = 1; val[o * 6 + 4] = rg; val[o * 6 + 5] = mt;
      }
    }
    // the occlusion: rays over the hemisphere of each texel's normal, counted for what they meet within the radius
    let covered = 0, ao_sum = 0, rays = 0;
    for (let o = 0; o < NN; o++) covered += cov[o];
    const ao_opts = opts.ao === false ? null : (opts.ao || {});
    if (ao_opts) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let v = 0; v < nv; v++) for (let k = 0; k < 3; k++) { const x = P[v * 3 + k]; if (x < lo[k]) lo[k] = x; if (x > hi[k]) hi[k] = x; }
      const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]), radius = ao_opts.radius !== undefined ? ao_opts.radius : 0.15 * diag, strength = ao_opts.strength !== undefined ? ao_opts.strength : 1;
      rays = ao_opts.rays !== undefined ? ao_opts.rays : (size <= 64 ? 24 : size <= 128 ? 16 : 12);
      if (!(radius > 0) || !(rays >= 1) || !(strength >= 0 && strength <= 1)) fail("bake: ao is { rays >= 1, radius > 0, strength 0 .. 1 }");
      const grid = make_grid(P, I, lo, hi), K = Math.round(rays), local = [];
      for (let k = 0; k < K; k++) { const u1 = (k + 0.5) / K, u2 = radical(k + 1); local.push([Math.sqrt(u1), 2 * Math.PI * u2, Math.sqrt(1 - u1)]); }
      const tmin = radius * 0.02;
      for (let o = 0; o < NN; o++) {
        if (!cov[o]) continue;
        const nx = nor[o * 3], ny = nor[o * 3 + 1], nz = nor[o * 3 + 2], a = Math.abs(nx) < 0.9 ? [1, 0, 0] : [0, 1, 0];
        let tx = a[1] * nz - a[2] * ny, ty = a[2] * nx - a[0] * nz, tz = a[0] * ny - a[1] * nx;
        const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
        const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx, rot = ((((o * 2654435761) >>> 0) % 4096) / 4096) * 2 * Math.PI;
        const ox = pos[o * 3] + nx * radius * 0.01, oy = pos[o * 3 + 1] + ny * radius * 0.01, oz = pos[o * 3 + 2] + nz * radius * 0.01;
        let occ = 0;
        for (let k = 0; k < K; k++) {
          const L = local[k], ph = L[1] + rot, cu = L[0] * Math.cos(ph), cv = L[0] * Math.sin(ph);
          const t = ray(grid, ox, oy, oz, tx * cu + bx * cv + nx * L[2], ty * cu + by * cv + ny * L[2], tz * cu + bz * cv + nz * L[2], tmin, radius);
          if (t < Infinity) occ += 1 - t / radius;
        }
        const ao = 1 - strength * (occ / K);
        val[o * 6 + 3] = ao; ao_sum += ao;
      }
      const blur = ao_opts.blur === undefined ? 0 : ao_opts.blur;                                                          // (the rays are few: a blur of 1 texel takes the noise out, and a picture of smooth shade is a smaller file)
      if (blur >= 1) for (let pass = 0; pass < Math.min(3, Math.round(blur)); pass++) {
        const src = new Float32Array(NN); for (let o = 0; o < NN; o++) src[o] = val[o * 6 + 3];
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const o = y * size + x; if (!cov[o]) continue;
          let a = 0, n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= size || yy >= size || !cov[yy * size + xx]) continue; a += src[yy * size + xx]; n++; }
          val[o * 6 + 3] = a / n;
        }
        ao_sum = 0; for (let o = 0; o < NN; o++) if (cov[o]) ao_sum += val[o * 6 + 3];
      }
    } else ao_sum = covered;
    // THE RELIEF: the normal of each texel is the slope of the height round it, measured on the surface (half a texel each way along the directions u and v go in: a texel's own size, whatever the size of the picture), in the frame
    // the renderer builds from the uvs (x along u, y along v, z the surface's normal, the engine's own cotangent frame): (-dh/du, -dh/dv, 1), normalized. Where the surface is low (a crack, a groove) the occlusion is darker.
    const nrm = new Float32Array(NN * 3), relief_report = relief ? { depth: relief.depth, strength: relief.strength === undefined ? 1 : relief.strength, cavity: relief.cavity === undefined ? 0.6 : relief.cavity, ms: 0, steepest: 0 } : null;
    for (let o = 0; o < NN; o++) nrm[o * 3 + 2] = 1;
    if (relief) {
      const t1 = Date.now(), K = relief_report.strength, cav = relief_report.cavity, depth = relief.depth > 1e-9 ? relief.depth : 1e-3, hf = relief.height;
      const sample = function (px, py, pz, n, info) { return hf([px, py, pz], n, info); };
      let steep = 0; ao_sum = 0;
      for (let o = 0; o < NN; o++) {
        if (cov[o] !== 1) continue;
        const nx = nor[o * 3], ny = nor[o * 3 + 1], nz = nor[o * 3 + 2], g = o * 6, n = [nx, ny, nz];
        let tx = tg[g], ty = tg[g + 1], tz = tg[g + 2], bx = tg[g + 3], by = tg[g + 4], bz = tg[g + 5];
        const dt = tx * nx + ty * ny + tz * nz, db = bx * nx + by * ny + bz * nz;
        tx -= nx * dt; ty -= ny * dt; tz -= nz * dt; bx -= nx * db; by -= ny * db; bz -= nz * db;
        const tl = Math.hypot(tx, ty, tz), bl = Math.hypot(bx, by, bz), v = pv[o], pt = PID && PARTS && v >= 0 ? PARTS[PID[v]] : null;
        const info = pt ? { part: pt.id, source: pt.source !== undefined ? pt.source : pt.id } : null, X = pos[o * 3], Y = pos[o * 3 + 1], Z = pos[o * 3 + 2];
        if (cav > 0) { const h0 = sample(X, Y, Z, n, info); if (h0 < 0) val[o * 6 + 3] *= 1 - cav * Math.min(1, -h0 / depth); }
        ao_sum += val[o * 6 + 3];
        if (!(tl > 1e-12) || !(bl > 1e-12)) continue;
        tx /= tl; ty /= tl; tz /= tl; bx /= bl; by /= bl; bz /= bl;
        const et = 0.5 * tl, eb = 0.5 * bl;
        const gx = (sample(X + tx * et, Y + ty * et, Z + tz * et, n, info) - sample(X - tx * et, Y - ty * et, Z - tz * et, n, info)) / (2 * et);
        const gy = (sample(X + bx * eb, Y + by * eb, Z + bz * eb, n, info) - sample(X - bx * eb, Y - by * eb, Z - bz * eb, n, info)) / (2 * eb);
        const x = -gx * K, y = -gy * K, l = Math.hypot(x, y, 1);
        nrm[o * 3] = x / l; nrm[o * 3 + 1] = y / l; nrm[o * 3 + 2] = 1 / l;
        const slope = Math.hypot(gx, gy); if (slope > steep) steep = slope;
      }
      relief_report.ms = Date.now() - t1; relief_report.steepest = steep;
    }
    // the texels no triangle holds, filled outwards from the ones that are (a filter and a mip read across the edge of a chart), and what is left by the mean
    for (let pass = 0; pass < 8; pass++) {
      const add = [];
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const o = y * size + x;
        if (cov[o]) continue;
        let n = 0; const s = [0, 0, 0, 0, 0, 0], sn = [0, 0, 0];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= size || yy >= size || !cov[yy * size + xx]) continue;
          for (let k = 0; k < 6; k++) s[k] += val[(yy * size + xx) * 6 + k];
          for (let k = 0; k < 3; k++) sn[k] += nrm[(yy * size + xx) * 3 + k];
          n++;
        }
        if (n) add.push([o, s, n, sn]);
      }
      if (!add.length) break;
      add.forEach(function (e) { for (let k = 0; k < 6; k++) val[e[0] * 6 + k] = e[1][k] / e[2]; for (let k = 0; k < 3; k++) nrm[e[0] * 3 + k] = e[3][k] / e[2]; cov[e[0]] = 2; });
    }
    const mean = [0, 0, 0, 1, rough0, metal0];
    if (covered) { for (let k = 0; k < 6; k++) { let s = 0; for (let o = 0; o < NN; o++) if (cov[o] === 1) s += val[o * 6 + k]; mean[k] = s / covered; } }
    const color = new Uint8Array(NN * 4), pack = new Uint8Array(NN * 4), normal = relief ? new Uint8Array(NN * 4) : null;
    for (let o = 0; o < NN; o++) {
      const v = cov[o] ? val.subarray(o * 6, o * 6 + 6) : mean;
      color[o * 4] = srgb(v[0]); color[o * 4 + 1] = srgb(v[1]); color[o * 4 + 2] = srgb(v[2]); color[o * 4 + 3] = 255;
      pack[o * 4] = byte(v[3]); pack[o * 4 + 1] = byte(v[4]); pack[o * 4 + 2] = byte(v[5]); pack[o * 4 + 3] = 255;
      if (normal) {                                                                                                       // (a normal as bytes: x y z from -1 .. 1 to 0 .. 255; the texels no chart holds are flat)
        if (cov[o]) { const l = Math.hypot(nrm[o * 3], nrm[o * 3 + 1], nrm[o * 3 + 2]) || 1; normal[o * 4] = Math.round(255 * (nrm[o * 3] / l * 0.5 + 0.5)); normal[o * 4 + 1] = Math.round(255 * (nrm[o * 3 + 1] / l * 0.5 + 0.5)); normal[o * 4 + 2] = Math.round(255 * (nrm[o * 3 + 2] / l * 0.5 + 0.5)); }
        else { normal[o * 4] = 128; normal[o * 4 + 1] = 128; normal[o * 4 + 2] = 255; }
        normal[o * 4 + 3] = 255;
      }
    }
    const out = { color: { size: size, data: color }, pack: { size: size, data: pack }, report: { size: size, covered: covered / NN, texels: covered, rays: rays, ao_mean: covered ? ao_sum / covered : 1, ms: Date.now() - t0, relief: relief_report } };
    if (normal) out.normal = { size: size, data: normal };
    return out;
  }

  // ---- THE PAINTER: a texture recipe -> the sampler of a bake ------------------------------------------------------------------------------------------------------------------------------------------
  // `texture: { size: 128, seed: 1, ao: { blur: 1 } | false, roughness: 0.8, metal: 0, layers: [ ... ] }`. A layer is { kind, parts?, colour?, strength?, roughness?, metal?, sym?, edge?, seed?, ...its own }:
  //   parts       the sdf parts it paints (their ids, or the start of an id and `*`: "abdomen*"; `!` before one leaves it out: ["!eye*"] is every part but the eyes; none: the whole creature)      colour  [r, g, b] on the scale of the parts' own colours      strength  0 .. 1 (1)
  //   roughness / metal   what the layer's paint is (lerped in by the layer's weight, as the colour is)      sym  true (the default): the pattern is the same on both sides of the body (it is read at |x|)      edge  how soft its edge is, 0 .. 1 (0.15)
  //   fill        nothing of its own: the colour, the roughness, the metal everywhere on the parts (a base tint, a glossy shell)
  //   stripes     axis [x, y, z] ([0, 0, 1]), period (metres), width (0 .. 1 of a period, 0.5), offset, wobble (in periods, 0.3: the stripes drift by it) and wobble_scale (metres)     bands across the body, a tiger's, a zebra's
  //   spots       size (metres a cell), radius (0 .. 0.6 of a cell, 0.3), density (0 .. 1: the share of cells that have one, 0.6), vary (0 .. 1: how much spots differ in size, 0.4)     a leopard's, a ladybird's
  //   cells       size, line (width of the lines in cells, 0.1), vary (0 .. 1: each cell is lighter or darker, 0.2): the lines are the colour, the cells' brightness varies    scales, scutes, cracked mud, a giraffe
  //   gradient    by "position" (axis, from, to: metres) or "normal" (axis, from, to: the cosine of the surface's turn from the axis, -0.2 .. 0.8)      a pale belly, a dark back, a bleached tail
  //   noise       scale (metres), octaves (1 .. 4, 3), amount (0 .. 1, 0.2) brightens and darkens; with a colour it is PATCHES of it: threshold (0.5)     mottling, dirt, a hide's variation
  // Everything a layer needs is a number: the same recipe gives the same bytes. A number out of range is held to it and said (`notes`); a layer that is not one is left out and said.
  const LAYERS = ["fill", "stripes", "spots", "cells", "gradient", "noise"];
  const hash3 = function (x, y, z, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1103515245) ^ Math.imul(s | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const smooth01 = function (t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const clamp01 = function (t) { return t < 0 ? 0 : t > 1 ? 1 : t; };
  function vnoise(x, y, z, s) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = smooth01(x - ix), fy = smooth01(y - iy), fz = smooth01(z - iz);
    const a = function (i, j, k) { return hash3(ix + i, iy + j, iz + k, s); };
    const x00 = a(0, 0, 0) + (a(1, 0, 0) - a(0, 0, 0)) * fx, x10 = a(0, 1, 0) + (a(1, 1, 0) - a(0, 1, 0)) * fx, x01 = a(0, 0, 1) + (a(1, 0, 1) - a(0, 0, 1)) * fx, x11 = a(0, 1, 1) + (a(1, 1, 1) - a(0, 1, 1)) * fx;
    const y0 = x00 + (x10 - x00) * fy, y1 = x01 + (x11 - x01) * fy;
    return y0 + (y1 - y0) * fz;
  }
  function fbm(x, y, z, s, oct) {
    let sum = 0, amp = 0.5, tot = 0, f = 1;
    for (let o = 0; o < oct; o++) { sum += amp * vnoise(x * f, y * f, z * f, s + o * 31); tot += amp; amp *= 0.5; f *= 2.03; }
    return sum / tot;
  }
  const WK = [0, 0, 0];                                                                                      // (worley's answer: nearest, second nearest, the nearest point's number: 0 .. 1)
  function worley(x, y, z, s) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z); let f1 = 9, f2 = 9, id = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const cx = ix + a, cy = iy + b, cz = iz + c;
      const d = Math.hypot(cx + 0.15 + 0.7 * hash3(cx, cy, cz, s + 1) - x, cy + 0.15 + 0.7 * hash3(cx, cy, cz, s + 2) - y, cz + 0.15 + 0.7 * hash3(cx, cy, cz, s + 3) - z);
      if (d < f1) { f2 = f1; f1 = d; id = hash3(cx, cy, cz, s + 4); } else if (d < f2) f2 = d;
    }
    WK[0] = f1; WK[1] = f2; WK[2] = id;
    return WK;
  }
  function clean_texture(spec) {
    const notes = [];
    const say = function (t) { notes.push("texture: " + t); };
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) { say("a texture is { size, seed, layers }: none made"); return { spec: null, notes: notes }; }
    Object.keys(spec).forEach(function (k) { if (["size", "seed", "ao", "roughness", "metal", "layers", "jpeg", "normal"].indexOf(k) < 0) say("unknown key '" + k + "' left out (size, seed, ao, roughness, metal, normal, layers)"); });
    const num = function (o, k, d, lo, hi, what) {
      let v = o[k];
      if (v === undefined) return d;
      if (typeof v !== "number" || !isFinite(v)) { say(what + k + " must be a number (" + JSON.stringify(v) + "): " + d); return d; }
      if (v < lo || v > hi) { const c = v < lo ? lo : hi; say(what + k + " = " + v + " is held to " + c + " (" + lo + " .. " + hi + ")"); return c; }
      return v;
    };
    const out = { size: Math.round(num(spec, "size", 128, MIN_SIZE, MAX_SIZE, "")), seed: Math.round(num(spec, "seed", 1, 0, 1e6, "")), roughness: num(spec, "roughness", 0.8, 0, 1, ""), metal: num(spec, "metal", 0, 0, 1, ""), layers: [] };
    out.ao = spec.ao === false ? false : (spec.ao && typeof spec.ao === "object" ? Object.assign({ blur: 1 }, spec.ao) : { blur: 1 });
    // the relief: `normal: false` makes no normal map whatever the layers say; { strength (0 .. 4, 1: how steep the slopes read), cavity (0 .. 1, 0.6: how much darker the occlusion is where the surface is low) }
    if (spec.normal === false) out.normal = false;
    else {
      const nm = spec.normal && typeof spec.normal === "object" && !Array.isArray(spec.normal) ? spec.normal : {};
      if (spec.normal !== undefined && spec.normal !== true && !(spec.normal && typeof spec.normal === "object" && !Array.isArray(spec.normal))) say("normal is false, true or { strength, cavity }: the default is used");
      out.normal = { strength: num(nm, "strength", 1, 0, 4, "normal."), cavity: num(nm, "cavity", 0.6, 0, 1, "normal.") };
    }
    if (spec.layers !== undefined && !Array.isArray(spec.layers)) say("layers is a list");
    (Array.isArray(spec.layers) ? spec.layers : []).forEach(function (L, i) {
      const w = "layers[" + i + "]: ";
      if (!L || typeof L !== "object" || Array.isArray(L)) { say(w + "not a layer: left out"); return; }
      if (LAYERS.indexOf(L.kind) < 0) { say(w + "kind '" + L.kind + "' is none of " + LAYERS.join(", ") + ": left out"); return; }
      const c = { kind: L.kind };
      const col = L.colour !== undefined ? L.colour : L.color;
      if (col !== undefined) {
        if (!Array.isArray(col) || col.length < 3 || !col.slice(0, 3).every(function (v) { return typeof v === "number" && isFinite(v); })) { say(w + "colour is [r, g, b]: layer left out"); return; }
        c.colour = col.slice(0, 3).map(clamp01);
      }
      if (L.parts !== undefined) {
        const list = typeof L.parts === "string" ? [L.parts] : L.parts;
        if (!Array.isArray(list) || !list.length || !list.every(function (x) { return typeof x === "string" && x; })) { say(w + "parts is a list of part ids (a start and * is allowed): all the creature is painted"); } else c.parts = list.slice();
      }
      c.strength = num(L, "strength", 1, 0, 1, w); c.edge = num(L, "edge", 0.15, 0.01, 1, w); c.sym = L.sym !== false; c.seed = Math.round(num(L, "seed", i + 1, 0, 1e6, w));
      if (L.roughness !== undefined) c.roughness = num(L, "roughness", 0.8, 0, 1, w);
      if (L.metal !== undefined) c.metal = num(L, "metal", 0, 0, 1, w);
      c.height = num(L, "height", 0, -0.5, 0.5, w);                                                          // (metres: how far the layer raises (+) or sinks (-) the surface where it is, times its weight; a noise with no colour: the noise itself, -height .. +height)
      if (L.kind === "cells") { c.bulge = num(L, "bulge", 0, -0.5, 0.5, w); c.step = num(L, "step", 0, -0.5, 0.5, w); }
      else if (L.bulge !== undefined || L.step !== undefined) say(w + "bulge and step are for cells only: left out");
      const axis = function (def) {
        const a = L.axis === undefined ? def : L.axis;
        if (!Array.isArray(a) || a.length < 3 || !a.slice(0, 3).every(function (v) { return typeof v === "number" && isFinite(v); }) || !(Math.hypot(a[0], a[1], a[2]) > 0)) { say(w + "axis is [x, y, z] (not zero): " + JSON.stringify(def)); return def.slice(); }
        const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l];
      };
      if (L.kind === "stripes") { c.axis = axis([0, 0, 1]); c.period = num(L, "period", 0.05, 1e-4, 1e3, w); c.width = num(L, "width", 0.5, 0.02, 0.98, w); c.offset = num(L, "offset", 0, -1e3, 1e3, w); c.wobble = num(L, "wobble", 0.3, 0, 5, w); c.wobble_scale = num(L, "wobble_scale", c.period * 3, 1e-4, 1e3, w); }
      else if (L.kind === "spots") { c.size = num(L, "size", 0.05, 1e-4, 1e3, w); c.radius = num(L, "radius", 0.3, 0.02, 0.6, w); c.density = num(L, "density", 0.6, 0, 1, w); c.vary = num(L, "vary", 0.4, 0, 1, w); }
      else if (L.kind === "cells") { c.size = num(L, "size", 0.03, 1e-4, 1e3, w); c.line = num(L, "line", 0.1, 0.005, 0.5, w); c.vary = num(L, "vary", 0.2, 0, 1, w); }
      else if (L.kind === "gradient") {
        c.by = L.by === "normal" ? "normal" : "position"; if (L.by !== undefined && L.by !== "normal" && L.by !== "position") say(w + "by is 'position' or 'normal': position");
        c.axis = axis([0, 1, 0]); c.from = num(L, "from", c.by === "normal" ? -0.2 : -1, -1e3, 1e3, w); c.to = num(L, "to", c.by === "normal" ? 0.8 : 1, -1e3, 1e3, w);
        if (c.to === c.from) { say(w + "from and to are the same: 1 is added to to"); c.to = c.from + 1; }
      }
      else if (L.kind === "fill") { if (c.colour === undefined && c.roughness === undefined && c.metal === undefined && c.height === 0) { say(w + "a fill needs a colour (or a roughness, a metal or a height): layer left out"); return; } }
      else if (L.kind === "noise") { c.scale = num(L, "scale", 0.05, 1e-4, 1e3, w); c.octaves = Math.round(num(L, "octaves", 3, 1, 4, w)); c.amount = num(L, "amount", 0.2, 0, 1, w); c.threshold = num(L, "threshold", 0.5, 0, 1, w); }
      const relief_only = c.height !== 0;                                                                     // (a layer of relief alone, with no colour of its own: ribs, warts, a pitted skin)
      if (c.colour === undefined && (L.kind === "spots" || L.kind === "stripes") && !relief_only) { say(w + L.kind + " needs a colour (or a height): layer left out"); return; }
      if (c.colour === undefined && L.kind === "gradient" && c.roughness === undefined && c.metal === undefined && !relief_only) { say(w + "a gradient needs a colour (or a roughness, a metal or a height): layer left out"); return; }
      out.layers.push(c);
    });
    return { spec: out, notes: notes };
  }
  function painter(spec) {
    const cl = clean_texture(spec), S = cl.spec;
    if (!S) return { sampler: null, spec: null, notes: cl.notes };
    // a part id, or the start of one and `*`; one that starts with `!` is EXCLUDED ("!eye*": every part but the eyes); a list of exclusions only means all the others
    const named = function (q, info) {
      const star = q.charAt(q.length - 1) === "*", base = star ? q.slice(0, -1) : q;
      return star ? (info.part.indexOf(base) === 0 || (info.source !== undefined && String(info.source).indexOf(base) === 0)) : (info.part === q || info.source === q);
    };
    const match = function (L, info) {
      if (!L.parts) return true;
      let any_in = false, hit = false;
      for (let i = 0; i < L.parts.length; i++) {
        const q = L.parts[i];
        if (q.charAt(0) === "!") { if (info && named(q.slice(1), info)) return false; }
        else { any_in = true; if (info && named(q, info)) hit = true; }
      }
      return any_in ? hit : true;
    };
    const layers = S.layers, seed0 = S.seed * 97;
    // what a layer says of a point: its weight (0 .. 1: how much of the paint is there), the brightness it multiplies by (cells and plain noise), and, for the relief, the dome of a cell, the level of its stone and the noise's own value
    const EV = { w: 0, mul: 1, dome: 0, level: 0, v: 0.5 };
    const evaluate = function (L, p, n) {
      const x = L.sym ? Math.abs(p[0]) : p[0], y = p[1], z = p[2], s = seed0 + L.seed * 13;
      let w = 0, mul = 1, dome = 0, level = 0, nv = 0.5;
      if (L.kind === "fill") w = 1;
      else if (L.kind === "stripes") {
        const a = L.axis, drift = L.wobble > 0 ? (fbm(x / L.wobble_scale, y / L.wobble_scale, z / L.wobble_scale, s, 2) - 0.5) * 2 * L.wobble : 0;
        const u = (a[0] * x + a[1] * y + a[2] * z + L.offset) / L.period + drift, f = u - Math.floor(u);
        if (f < L.width) { const t = f / L.width, e = L.edge * 0.5; w = Math.min(smooth01(t / e), smooth01((1 - t) / e)); }
      } else if (L.kind === "spots") {
        const k = worley(x / L.size, y / L.size, z / L.size, s);
        if (k[2] < L.density) { const rad = L.radius * (1 - L.vary * 0.5 + L.vary * 0.5 * hash3(Math.floor(k[2] * 65536), 7, 1, s)); w = 1 - smooth01((k[0] - rad * (1 - L.edge)) / (rad * L.edge + 1e-6)); }
      } else if (L.kind === "cells") {
        const k = worley(x / L.size, y / L.size, z / L.size, s);
        mul = 1 + L.vary * (k[2] - 0.5) * 2;
        w = 1 - smooth01(((k[1] - k[0]) - L.line * (1 - L.edge)) / (L.line * L.edge + 1e-6));
        dome = smooth01((k[1] - k[0]) / 0.5);                                                                // (0 on the line between two cells, 1 well inside a cell: a stone is rounded, not flat)
        level = (k[2] - 0.5) * 2;                                                                            // (each cell at a level of its own: -1 .. 1)
      } else if (L.kind === "gradient") {
        const a = L.axis, v = L.by === "normal" ? a[0] * (L.sym ? Math.abs(n[0]) : n[0]) + a[1] * n[1] + a[2] * n[2] : a[0] * x + a[1] * y + a[2] * z;
        w = smooth01((v - L.from) / (L.to - L.from));
      } else if (L.kind === "noise") {
        const v = fbm(x / L.scale, y / L.scale, z / L.scale, s, L.octaves); nv = v;
        if (L.colour) w = smooth01((v - L.threshold) / (L.edge * 0.5 + 1e-6) * 0.5 + 0.5); else mul = 1 + L.amount * (v - 0.5) * 2;
      }
      EV.w = w * L.strength; EV.mul = mul; EV.dome = dome; EV.level = level; EV.v = nv;
      return EV;
    };
    const sampler = function (p, n, d, info) {
      let r = d.color[0], g = d.color[1], b = d.color[2], rg = d.roughness, mt = d.metal, hit = false;
      for (let i = 0; i < layers.length; i++) {
        const L = layers[i];
        if (!match(L, info)) continue;
        const e = evaluate(L, p, n), w = e.w, mul = e.mul;
        if (mul !== 1) { r *= mul; g *= mul; b *= mul; hit = true; }
        if (w > 0) {
          if (L.colour) { r += (L.colour[0] - r) * w; g += (L.colour[1] - g) * w; b += (L.colour[2] - b) * w; }
          if (L.roughness !== undefined) rg += (L.roughness - rg) * w;
          if (L.metal !== undefined) mt += (L.metal - mt) * w;
          hit = true;
        }
      }
      return hit ? { color: [r < 0 ? 0 : r > 1 ? 1 : r, g < 0 ? 0 : g > 1 ? 1 : g, b < 0 ? 0 : b > 1 ? 1 : b], roughness: rg, metal: mt } : null;
    };
    // THE HEIGHT of the surface at a point, in metres (the layers' `height`, `bulge` and `step`, in order): the layers that have none cost nothing. A weight is the layer's pattern times its strength; a plain noise is its own value, -height .. +height.
    const relief_layers = layers.filter(function (L) { return L.height !== 0 || L.bulge || L.step; });
    let depth = 0;
    relief_layers.forEach(function (L) { depth += Math.abs(L.height) + Math.abs(L.bulge || 0) + Math.abs(L.step || 0); });
    const height = S.normal !== false && relief_layers.length ? function (p, n, info) {
      let h = 0;
      for (let i = 0; i < relief_layers.length; i++) {
        const L = relief_layers[i];
        if (!match(L, info)) continue;
        const e = evaluate(L, p, n);
        if (L.kind === "noise" && !L.colour) h += L.height * (e.v - 0.5) * 2 * L.strength;
        else h += L.height * e.w;
        if (L.kind === "cells") h += (L.bulge * e.dome + L.step * e.level) * L.strength;
      }
      return h;
    } : null;
    return { sampler: sampler, height: height, depth: depth, spec: S, notes: cl.notes };
  }
  // a mesh painted by a recipe: unwrapped and baked at the recipe's size -> { mesh, maps, report: { unwrap, bake, notes, layers } }
  function paint(mesh, spec, opts) {
    const pt = painter(spec);
    if (!pt.sampler) fail(pt.notes.join("; "));
    const relief = pt.height ? { height: pt.height, depth: pt.depth, strength: pt.spec.normal.strength, cavity: pt.spec.normal.cavity } : null;            // (a recipe whose layers have a height makes a normal map as well)
    const made = make(mesh, Object.assign({}, opts || {}, { size: pt.spec.size, sampler: pt.sampler, ao: pt.spec.ao, roughness: pt.spec.roughness, metal: pt.spec.metal, relief: relief }));
    made.report.notes = pt.notes; made.report.layers = pt.spec.layers.length;
    return made;
  }

  // ---- unwrap + bake, and a creature's definition ------------------------------------------------------------------------------------------------------------------------------------------------
  function make(mesh, opts) {
    opts = opts || {};
    const u = unwrap(mesh, opts), b = bake(u.mesh, opts), out = {};
    Object.keys(u.mesh).forEach(function (k) { if (k !== "colors") out[k] = u.mesh[k]; });                  // (the colour is in the picture: white vertices, or it would be there twice)
    const maps = { color: b.color, pack: b.pack };
    if (b.normal) maps.normal = b.normal;
    return { mesh: out, maps: maps, report: { unwrap: u.report, bake: b.report } };
  }
  function apply(def, opts) {
    if (!def || typeof def !== "object" || !def.mesh) fail("apply: the definition has no mesh");
    const made = make(def.mesh, opts), maps = Object.assign({}, def.material && def.material.maps, made.maps);
    return Object.assign({}, def, { mesh: made.mesh, material: Object.assign({}, def.material, { maps: maps }) });
  }

  return { MIN_SIZE: MIN_SIZE, MAX_SIZE: MAX_SIZE, MAP_KEYS: ["color", "pack", "normal"], unwrap: unwrap, bake: bake, make: make, apply: apply, painter: painter, paint: paint, clean_texture: clean_texture, LAYERS: LAYERS, encoded: encoded, check: check, bytes: bytes, text: text, dims: dims, to_base64: to_base64, from_base64: from_base64, base64_length: base64_length, srgb: srgb };
});
