packing()("system_data", function system_data() {
  "use strict";
  // SYSTEM DATA: the container of system.bin, the one file that holds everything the creature system reads (gaits, actions, ...). Pure (no engine, no DOM, no node module: the page, the worker and the tools all use it; Node 14 and the
  // bundler's parser: no optional chaining, no ??, no async / await, no classes).
  //
  // The file: four letters (HSY1), the header's length (u32), the header as JSON padded to 4 bytes, then the sections' blobs, each one gzipped on its own (a page only unzips what it asks for):
  //   header = { format: "happy.system", version: 1, sections: [{ name, kind: "tree" | "raw", o (offset from the end of the header), n (bytes in the file), raw (bytes unzipped), meta? }, ...] }
  //   raw   the bytes as they are (a file that has a format of its own: the lite human's)
  //   tree  a tree of plain JSON values (objects, arrays, strings, numbers, booleans, null) stored as NUMBERS: every array that holds only numbers (a track of an action, the harmonics of a gait) is cut out of the text and
  //         written to a pool, the text keeps `[]` in its place. A pooled array is: its length, the decimals its numbers had (0 .. 6: they are whole numbers over 10^d: 0.224 is 224 at 3), then each number's difference from the
  //         one before as a zigzag varint (a curve is smooth: most differences are one byte). It is LOSSLESS: a number that would not come back as the very same double (more than 6 decimals, 1e9 or more) keeps its array in the text.
  //         The payload of a tree: u32 (the text's length), the text (JSON), the pool. Reading it walks the text in the order the writer did and puts the pool's arrays back where the `[]` are.
  //
  //   S.parse(bytes, { inflate? }) -> pack        bytes: ArrayBuffer | Uint8Array, the whole file; throws on a file that is not one (the letters, the version, a section past the end)
  //   S.load(url, { inflate?, cache? }) -> Promise<pack>      a page's way: fetch + parse
  //   pack.names(prefix?)  pack.has(name)  pack.info(name) -> { name, kind, packed, raw, meta }     what is in it (nothing is unzipped)
  //   pack.tree(name) -> Promise<value>   a tree section, unzipped and put together ONCE (the same promise after that)       pack.bytes(name) -> Promise<Uint8Array>   any section's bytes unzipped       pack.drop(name)   let go of a tree
  //   S.build(sections, gzip) -> Uint8Array       the writer (a tool's): sections [{ name, kind?: "tree" | "raw", value | bytes, meta? }], gzip(Uint8Array) -> Uint8Array (the tool's zlib: this module has none)
  //   S.encode_tree(value) -> Uint8Array   S.decode_tree(Uint8Array) -> value      the payload of a tree (the tests' way in)
  //   `inflate(Uint8Array) -> Promise<Uint8Array> | Uint8Array` is how a host unzips: the default is DecompressionStream (a page, a worker); a node tool gives zlib's.

  const MAGIC = "HSY1", VERSION = 1, FORMAT = "happy.system";
  const POW = [1, 10, 100, 1000, 10000, 100000, 1000000];
  const MAX = 1e9;
  const fail = function (msg) { throw new Error("system data: " + msg); };
  const pad4 = function (n) { return n + ((4 - n % 4) % 4); };

  // ---- bytes: a growing writer and a reader of varints -------------------------------------------------------------------------------------------------------------------------------
  function writer() {
    let a = new Uint8Array(1 << 16), n = 0;
    const grow = function (k) { if (n + k > a.length) { const b = new Uint8Array(Math.max(a.length * 2, n + k)); b.set(a.subarray(0, n)); a = b; } };
    const w = {
      byte: function (v) { grow(1); a[n++] = v; },
      u: function (v) { grow(10); while (v >= 128) { a[n++] = (v % 128) | 128; v = Math.floor(v / 128); } a[n++] = v; },
      z: function (v) { w.u(v < 0 ? -2 * v - 1 : 2 * v); },
      bytes: function (b) { grow(b.length); a.set(b, n); n += b.length; },
      done: function () { return a.subarray(0, n); }
    };
    return w;
  }
  function reader(a, p) {
    const r = {
      p: p,
      byte: function () { if (r.p >= a.length) fail("a tree ends short"); return a[r.p++]; },
      u: function () { let v = 0, m = 1, c; do { if (r.p >= a.length) fail("a tree ends short"); c = a[r.p++]; v += (c & 127) * m; m *= 128; } while (c & 128); return v; },
      z: function () { const v = r.u(); return v % 2 ? -(v + 1) / 2 : v / 2; }
    };
    return r;
  }

  // ---- a tree -> text + pool and back --------------------------------------------------------------------------------------------------------------------------------------------------
  // the decimals a number was written with (0 .. 6) so that whole / 10^d is the very same double, else -1
  function decimals_of(x) {
    if (!(Math.abs(x) < MAX)) return -1;
    for (let d = 0; d <= 6; d++) if (Math.round(x * POW[d]) / POW[d] === x) return d;
    return -1;
  }
  // an array of numbers to the pool; false: it does not come back exact, it stays in the text
  function pool_array(w, arr) {
    const n = arr.length;
    if (n === 0) { w.u(0); return true; }
    let d = 0;
    for (let i = 0; i < n; i++) { const k = decimals_of(arr[i]); if (k < 0) return false; if (k > d) d = k; }
    const s = POW[d];
    for (let i = 0; i < n; i++) if (Math.round(arr[i] * s) / s !== arr[i]) return false;
    w.u(n); w.byte(d);
    let prev = 0;
    for (let i = 0; i < n; i++) { const q = Math.round(arr[i] * s); w.z(q - prev); prev = q; }
    return true;
  }
  function all_numbers(arr) { for (let i = 0; i < arr.length; i++) if (typeof arr[i] !== "number") return false; return true; }

  function encode_tree(value) {
    const w = writer();
    const walk = function (v, at) {
      if (typeof v === "number" && !isFinite(v)) fail("a tree holds plain JSON: " + at + " is " + v);
      if (v === undefined || typeof v === "function") fail("a tree holds plain JSON: " + at + " is " + typeof v);
      if (Array.isArray(v)) {
        if (all_numbers(v)) {
          for (let i = 0; i < v.length; i++) if (!isFinite(v[i])) fail("a tree holds plain JSON: " + at + "[" + i + "] is " + v[i]);
          if (pool_array(w, v)) return [];
          return v.slice();
        }
        return v.map(function (x, i) { return walk(x, at + "[" + i + "]"); });
      }
      if (v !== null && typeof v === "object") {
        const o = {}, keys = Object.keys(v);
        for (let i = 0; i < keys.length; i++) o[keys[i]] = walk(v[keys[i]], at + "." + keys[i]);
        return o;
      }
      return v;
    };
    const text = new TextEncoder().encode(JSON.stringify(walk(value, "$")));
    const pool = w.done(), out = new Uint8Array(4 + text.length + pool.length);
    new DataView(out.buffer).setUint32(0, text.length, true);
    out.set(text, 4); out.set(pool, 4 + text.length);
    return out;
  }

  function decode_tree(u8) {
    if (u8.length < 4) fail("a tree ends short");
    const len = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0, true);
    if (4 + len > u8.length) fail("a tree ends short");
    const text = JSON.parse(new TextDecoder("utf-8").decode(u8.subarray(4, 4 + len)));
    const r = reader(u8, 4 + len);
    const take = function () {
      const n = r.u(), a = [];
      if (n === 0) return a;
      const d = r.byte();
      if (d > 6) fail("a tree has a pool that is not one (decimals " + d + ")");
      const s = POW[d];
      let q = 0;
      for (let i = 0; i < n; i++) { q += r.z(); a.push(q / s); }
      return a;
    };
    const walk = function (v) {
      if (Array.isArray(v)) {
        if (v.length === 0) return take();
        for (let i = 0; i < v.length; i++) v[i] = walk(v[i]);
        return v;
      }
      if (v !== null && typeof v === "object") {
        const keys = Object.keys(v);
        for (let i = 0; i < keys.length; i++) v[keys[i]] = walk(v[keys[i]]);
      }
      return v;
    };
    const value = walk(text);
    if (r.p !== u8.length) fail("a tree has bytes left over (" + (u8.length - r.p) + ")");
    return value;
  }

  // ---- the container -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // the sections checked and their payloads made (a tree is written as numbers and text, a raw section is its bytes)
  function prepare(sections) {
    const seen = Object.create(null);
    return sections.map(function (s) {
      if (!s || typeof s.name !== "string" || !/^[A-Za-z0-9_.\-]+$/.test(s.name)) fail("a section has a name of letters, digits, _ . - (" + (s && s.name) + ")");
      if (seen[s.name]) fail("two sections are called " + s.name);
      seen[s.name] = true;
      const kind = s.kind || (s.bytes ? "raw" : "tree");
      if (kind !== "tree" && kind !== "raw") fail("section " + s.name + ": kind is tree or raw");
      let payload;
      if (kind === "raw") { if (!(s.bytes instanceof Uint8Array)) fail("section " + s.name + ": raw takes bytes (a Uint8Array)"); payload = s.bytes; }
      else payload = encode_tree(s.value);
      return { name: s.name, kind: kind, payload: payload, meta: s.meta };
    });
  }
  // the file: the header, then the blobs (each section gzipped on its own)
  function assemble(items, blobs) {
    const list = [];
    let o = 0;
    items.forEach(function (it, i) {
      const entry = { name: it.name, kind: it.kind, o: o, n: blobs[i].length, raw: it.payload.length };
      if (it.meta !== undefined) entry.meta = it.meta;
      list.push(entry); o += blobs[i].length;
    });
    const json = new TextEncoder().encode(JSON.stringify({ format: FORMAT, version: VERSION, sections: list }));
    const head = pad4(json.length), out = new Uint8Array(8 + head + o);
    for (let i = 0; i < 4; i++) out[i] = MAGIC.charCodeAt(i);
    new DataView(out.buffer).setUint32(4, json.length, true);
    out.set(json, 8);
    let p = 8 + head;
    blobs.forEach(function (bl) { out.set(bl, p); p += bl.length; });
    return out;
  }
  function build(sections, gzip) {
    if (typeof gzip !== "function") fail("build takes gzip(bytes) -> bytes");
    const items = prepare(sections);
    return assemble(items, items.map(function (it) { return gzip(it.payload); }));
  }
  // the writer of a page: gzip(bytes) -> Promise<bytes> (the default is CompressionStream: a page, a worker), the sections gzipped together; the file is the same one build writes
  function build_async(sections, gzip) {
    gzip = gzip || default_deflate;
    if (typeof gzip !== "function") fail("build_async takes gzip(bytes) -> Promise<bytes>");
    const items = prepare(sections);
    return Promise.all(items.map(function (it) { return Promise.resolve(gzip(it.payload)).then(function (b) { return b instanceof Uint8Array ? b : new Uint8Array(b); }); })).then(function (blobs) { return assemble(items, blobs); });
  }
  function default_deflate(u8) {
    if (typeof CompressionStream === "function" && typeof Response === "function" && typeof Blob === "function") return new Response(new Response(new Blob([u8])).body.pipeThrough(new CompressionStream("gzip"))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return Promise.reject(new Error("system data: no CompressionStream: this host cannot write a gzip file (give build_async(sections, gzip) a function)"));
  }

  function default_inflate(u8) {
    if (typeof DecompressionStream === "function" && typeof Response === "function" && typeof Blob === "function") return new Response(new Response(new Blob([u8])).body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return Promise.reject(new Error("system data: no DecompressionStream: this host cannot read a gzip file (give parse({ inflate }) a function)"));
  }

  function parse(bytes, opts) {
    opts = opts || {};
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (u8.length < 8) fail("not a system.bin: " + u8.length + " bytes");
    const magic = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
    if (magic !== MAGIC) fail("not a system.bin: it begins " + JSON.stringify(magic) + ", not " + MAGIC);
    const hn = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(4, true);
    if (8 + hn > u8.length) fail("the header ends past the file");
    const header = JSON.parse(new TextDecoder("utf-8").decode(u8.subarray(8, 8 + hn)));
    if (header.format !== FORMAT) fail("not a system.bin: its format is " + JSON.stringify(header.format));
    if (header.version > VERSION) fail("this file is version " + header.version + ", the reader knows " + VERSION);
    const base = 8 + pad4(hn), by_name = Object.create(null), inflate = opts.inflate || default_inflate;
    header.sections.forEach(function (s) {
      if (base + s.o + s.n > u8.length) fail("section " + s.name + " is past the end of the file (the file is cut short)");
      by_name[s.name] = s;
    });
    const unzipped = Object.create(null), trees = Object.create(null);
    const sec = function (name) { const s = by_name[name]; if (!s) fail("no section '" + name + "' (it has " + header.sections.length + ": " + header.sections.slice(0, 6).map(function (x) { return x.name; }).join(", ") + " ...)"); return s; };
    const pack = {
      header: header,
      size: u8.length,
      names: function (prefix) { return header.sections.map(function (s) { return s.name; }).filter(function (n) { return prefix === undefined || n.indexOf(prefix) === 0; }); },
      has: function (name) { return by_name[name] !== undefined; },
      info: function (name) { const s = sec(name); return { name: s.name, kind: s.kind, packed: s.n, raw: s.raw, meta: s.meta }; },
      bytes: function (name) {
        const s = sec(name);
        if (unzipped[name] === undefined) {
          unzipped[name] = Promise.resolve().then(function () { return inflate(u8.subarray(base + s.o, base + s.o + s.n)); }).then(function (b) {
            const out = b instanceof Uint8Array ? b : new Uint8Array(b);
            if (out.length !== s.raw) fail("section " + name + " unzipped to " + out.length + " bytes, the header says " + s.raw);
            return out;
          }, function (e) { delete unzipped[name]; throw new Error("system data: section " + name + " could not be unzipped: " + (e && e.message || e)); });
        }
        return unzipped[name];
      },
      tree: function (name) {
        const s = sec(name);
        if (s.kind !== "tree") fail("section " + name + " is " + s.kind + ", not a tree: use bytes()");
        if (trees[name] === undefined) trees[name] = pack.bytes(name).then(function (b) { delete unzipped[name]; return decode_tree(b); });
        return trees[name];
      },
      drop: function (name) { delete trees[name]; delete unzipped[name]; }
    };
    return pack;
  }

  function load(url, opts) {
    opts = opts || {};
    if (typeof fetch !== "function") return Promise.reject(new Error("system data: load needs fetch (a node tool reads the file and calls parse)"));
    return fetch(url, { cache: opts.cache || "no-cache" }).then(function (r) {
      if (!r.ok) fail(r.status + " for " + url);
      return r.arrayBuffer();
    }).then(function (b) { return parse(b, opts); });
  }

  // ---- a mesh of typed arrays, and a creature (its structure as JSON, its mesh) -------------------------------------------------------------------------------------------------------------------
  // A creature's body is a mesh: { positions: Float32Array (xyz), normals: Float32Array, indices: Uint16Array | Uint32Array, colors: Float32Array (rgba), skin_indices: Uint8Array, skin_weights: Float32Array, skin_count }. It is written as bytes:
  //   positions   QUANTIZED to 16 bits over the mesh's own box (the one lossy step: a position moves by at most half of span / 65535 on an axis, 0.05 mm for an animal 6.6 m long; encode says it and refuses a box too big for `bound`), then the
  //               difference of each from the vertex before as zigzag varints (a mesh is ordered: neighbours are near)
  //   normals, colors, skin_weights   as BYTES when every value is a byte over 127 or 255 (a mesh that was made that way: they come back EXACTLY the same floats), else as float32; normals that are unit vectors of signed bytes (each divided by its
  //               length, as the animal files make them) as those bytes
  //   indices     the difference of each from the one before, zigzag varints (lossless)      skin_indices   bytes as they are
  //   S.encode_mesh(mesh, { bound? }) -> { bytes, stats: { vertices, triangles, max_error (metres), exact: [the arrays that came back exact] } }       S.decode_mesh(bytes) -> mesh       `bound`: the most a position may move, metres (0.0001)
  //   S.encode_creature(head, mesh, { bound? }) -> { bytes, stats }      S.decode_creature(bytes) -> { head, mesh }      the section of a creature: u32 (the head's length), the head as JSON (the creature without its mesh), the mesh's bytes
  const MESH_KEYS = ["positions", "normals", "indices", "colors", "skin_indices", "skin_weights", "skin_count"];
  const as_bytes = function (a) { return new Uint8Array(a.buffer, a.byteOffset, a.byteLength); };
  // the array as bytes over d (signed or not), when every value is exactly what a byte over d is; else null
  function byte_form(arr, d, signed) {
    const lo = signed ? -128 : 0, hi = signed ? 127 : 255, q = signed ? new Int8Array(arr.length) : new Uint8Array(arr.length);
    for (let i = 0; i < arr.length; i++) { const v = Math.round(arr[i] * d); if (!(v >= lo && v <= hi) || Math.fround(v / d) !== arr[i]) return null; q[i] = v; }
    return q;
  }
  // normals that were made of bytes and then NORMALIZED (the vector of three signed bytes divided by its length, in float32): the bytes that give every one of them exactly, or null (one that has none: the whole array stays float32)
  function unit_bytes(arr) {
    const q = new Int8Array(arr.length);
    for (let v = 0; v < arr.length; v += 3) {
      const nx = arr[v], ny = arr[v + 1], nz = arr[v + 2];
      let found = false;
      for (let d = 0; d <= 140 && !found; d++) {
        for (let s = 0; s < (d === 0 ? 1 : 2) && !found; s++) {
          const t = s === 0 ? 127 + d : 127 - d;
          if (t < 60) continue;
          const x = Math.round(nx * t), y = Math.round(ny * t), z = Math.round(nz * t);
          if (x < -128 || x > 127 || y < -128 || y > 127 || z < -128 || z > 127) continue;
          const l = Math.hypot(x, y, z) || 1;
          if (Math.fround(x / l) === nx && Math.fround(y / l) === ny && Math.fround(z / l) === nz) { q[v] = x; q[v + 1] = y; q[v + 2] = z; found = true; }
        }
      }
      if (!found) return null;
    }
    return q;
  }
  function encode_mesh(mesh, o) {
    o = o || {};
    const bound = o.bound === undefined ? 0.0001 : o.bound;
    Object.keys(mesh).forEach(function (k) { if (MESH_KEYS.indexOf(k) < 0) fail("a mesh has " + MESH_KEYS.join(", ") + " (not '" + k + "')"); });
    MESH_KEYS.forEach(function (k) { if (mesh[k] === undefined) fail("a mesh has " + k); });
    const P = mesh.positions, nv = P.length / 3, ni = mesh.indices.length;
    if (nv % 1 !== 0 || mesh.normals.length !== 3 * nv || mesh.colors.length !== 4 * nv || mesh.skin_indices.length !== mesh.skin_weights.length || mesh.skin_indices.length !== mesh.skin_count * nv) fail("a mesh's arrays do not agree about its " + nv + " vertices");
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < P.length; i++) { const k = i % 3; if (P[i] < min[k]) min[k] = P[i]; if (P[i] > max[k]) max[k] = P[i]; }
    const span = [0, 1, 2].map(function (k) { return max[k] - min[k] || 1; });
    const err = Math.max(span[0], span[1], span[2]) / 65535 / 2;
    if (err > bound) fail("a mesh " + Math.max(span[0], span[1], span[2]).toFixed(1) + " m across is quantized to " + (err * 1000).toFixed(3) + " mm: more than the bound of " + (bound * 1000).toFixed(3) + " mm");
    const w = writer();
    let prev = [0, 0, 0], worst = 0;
    for (let v = 0; v < nv; v++) for (let k = 0; k < 3; k++) {
      const q = Math.round((P[3 * v + k] - min[k]) / span[k] * 65535);
      worst = Math.max(worst, Math.abs(P[3 * v + k] - (min[k] + q / 65535 * span[k])));
      w.z(q - prev[k]); prev[k] = q;
    }
    const pos = w.done().slice(), w2 = writer();
    let last = 0;
    for (let i = 0; i < ni; i++) { w2.z(mesh.indices[i] - last); last = mesh.indices[i]; }
    const idx = w2.done().slice(), exact = [];
    const form = function (name, arr, d, signed) { const b = byte_form(arr, d, signed); if (b) { exact.push(name); return { t: signed ? "i8" : "u8", bytes: as_bytes(b) }; } return { t: "f32", bytes: as_bytes(new Float32Array(arr)) }; };
    const nb = unit_bytes(mesh.normals), nrm = nb ? (exact.push("normals"), { t: "i8u", bytes: as_bytes(nb) }) : form("normals", mesh.normals, 127, true), col = form("colors", mesh.colors, 255, false), wts = form("skin_weights", mesh.skin_weights, 255, false), skin = as_bytes(new Uint8Array(mesh.skin_indices));
    const head = { nv: nv, ni: ni, i32: !(mesh.indices instanceof Uint16Array), skin_count: mesh.skin_count, min: min, span: span, normals: nrm.t, colors: col.t, weights: wts.t, sizes: [pos.length, nrm.bytes.length, idx.length, col.bytes.length, skin.length, wts.bytes.length] };
    const json = new TextEncoder().encode(JSON.stringify(head)), total = 4 + json.length + head.sizes.reduce(function (a, b) { return a + b; }, 0), out = new Uint8Array(total);
    new DataView(out.buffer).setUint32(0, json.length, true);
    out.set(json, 4);
    let at = 4 + json.length;
    [pos, nrm.bytes, idx, col.bytes, skin, wts.bytes].forEach(function (b) { out.set(b, at); at += b.length; });
    return { bytes: out, stats: { vertices: nv, triangles: ni / 3, max_error: worst, exact: exact } };
  }
  function decode_mesh(u8) {
    const hl = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0, true);
    const h = JSON.parse(new TextDecoder("utf-8").decode(u8.subarray(4, 4 + hl)));
    let at = 4 + hl;
    const blob = function (i) { const b = u8.subarray(at, at + h.sizes[i]); at += h.sizes[i]; return b; };
    const nv = h.nv, P = new Float32Array(3 * nv), pr = reader(blob(0), 0), prev = [0, 0, 0];
    for (let v = 0; v < nv; v++) for (let k = 0; k < 3; k++) { prev[k] += pr.z(); P[3 * v + k] = h.min[k] + prev[k] / 65535 * h.span[k]; }
    const bytes_to = function (b, form, d, signed, n) {
      if (form === "f32") return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
      const q = signed ? new Int8Array(b.buffer, b.byteOffset, n) : b, o = new Float32Array(n);
      for (let i = 0; i < n; i++) o[i] = q[i] / d;
      return o;
    };
    const nbytes = blob(1);
    let normals;
    if (h.normals === "i8u") {                                                                       // signed bytes, each vector divided by its length (as the file that made them did)
      const q = new Int8Array(nbytes.buffer, nbytes.byteOffset, 3 * nv);
      normals = new Float32Array(3 * nv);
      for (let i = 0; i < 3 * nv; i += 3) { const x = q[i], y = q[i + 1], z = q[i + 2], l = Math.hypot(x, y, z) || 1; normals[i] = x / l; normals[i + 1] = y / l; normals[i + 2] = z / l; }
    } else normals = bytes_to(nbytes, h.normals, 127, true, 3 * nv);
    const ir = reader(blob(2), 0), indices = h.i32 ? new Uint32Array(h.ni) : new Uint16Array(h.ni);
    let last = 0;
    for (let i = 0; i < h.ni; i++) { last += ir.z(); indices[i] = last; }
    const colors = bytes_to(blob(3), h.colors, 255, false, 4 * nv), skin_indices = new Uint8Array(blob(4)), weights = bytes_to(blob(5), h.weights, 255, false, h.skin_count * nv);
    return { positions: P, normals: normals, indices: indices, colors: colors, skin_indices: skin_indices, skin_weights: weights, skin_count: h.skin_count };
  }
  function encode_creature(head, mesh, o) {
    const json = new TextEncoder().encode(JSON.stringify(head)), m = encode_mesh(mesh, o), out = new Uint8Array(4 + json.length + m.bytes.length);
    new DataView(out.buffer).setUint32(0, json.length, true);
    out.set(json, 4); out.set(m.bytes, 4 + json.length);
    return { bytes: out, stats: m.stats };
  }
  function decode_creature(u8) {
    const hl = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0, true);
    return { head: JSON.parse(new TextDecoder("utf-8").decode(u8.subarray(4, 4 + hl))), mesh: decode_mesh(u8.subarray(4 + hl)) };
  }

  return { MAGIC: MAGIC, VERSION: VERSION, build: build, build_async: build_async, parse: parse, load: load, encode_tree: encode_tree, decode_tree: decode_tree, encode_mesh: encode_mesh, decode_mesh: decode_mesh, encode_creature: encode_creature, decode_creature: decode_creature };
});
