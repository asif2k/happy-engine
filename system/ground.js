packing()("happy_ground", function happy_ground() {
  "use strict";
  // THE GROUND MATERIALS (system.bin keeps them as the section `ground.textures`): the base PBR sets of the terrain and of the roads, as two atlases. Pure but for the decoder a page gives:
  // no engine, no DOM of its own. Node 14 and the bundler's parser: no optional chaining, no ??, no class, no async functions.
  //
  //   G.parse(bytes) -> { header, images: { albedo, normal, rao: Uint8Array (a JPEG each) } }       the container (HGT1: the letters, the header's length, the header as JSON padded to 4, the JPEGs)
  //   G.load(bytes, decode) -> Promise<{ header, atlas0, atlas1, width, height }>        decode(jpeg: Uint8Array) -> Promise<{ width, height, data: RGBA bytes }> (G.browser_decode in a page)
  //     atlas0  RGBA: albedo rgb, ambient occlusion      atlas1  RGBA: normal x, normal y (0.5 + n / 2, OpenGL: +y up; z = sqrt(1 - x^2 - y^2)), roughness, height (0.5 flat)
  //   G.table(header) -> { names, kinds, tile: [m], origin: Float32Array(2 n) (uv of the first texel of each material's own picture), inner: [u, v] (its size in uv), border: [u, v], avg: Float32Array(3 n) (linear), count }
  //   G.index(header, name) -> the id of a material      G.KINDS: the names of the kinds, in the order of `kind` ids
  // A material is a CELL of the atlas, `cell` pixels with `border` pixels of its own picture wrapped round it: a shader reads a tiling texture as origin + fract(uv) * inner, with gradients scaled to match, and keeps
  // its mip level under log2(border) so that the filter never reaches the next cell.
  const KINDS = ["grass", "soil", "sand", "road", "rock", "gravel", "snow", "paving"];
  const fail = function (m) { throw new Error("ground: " + m); };

  function parse(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (u8.length < 8 || String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== "HGT1") fail("not a ground pack (it must begin HGT1)");
    const n = u8[4] | (u8[5] << 8) | (u8[6] << 16) | (u8[7] << 24), base = 8 + n + (4 - n % 4) % 4;
    let text = ""; for (let i = 0; i < n; i++) text += String.fromCharCode(u8[8 + i]);
    const header = JSON.parse(text);
    if (header.format !== "happy.ground" || header.version !== 1) fail("a file of format '" + header.format + "' " + header.version + ": this reads happy.ground 1");
    const images = {};
    ["albedo", "normal", "rao"].forEach(function (k) {
      const im = header.images && header.images[k]; if (!im) fail("the pack has no '" + k + "' picture");
      if (base + im.o + im.n > u8.length) fail("the '" + k + "' picture is past the end of the file");
      images[k] = u8.subarray(base + im.o, base + im.o + im.n);
    });
    return { header: header, images: images };
  }

  function join(header, pics) {                                                              // the three decoded pictures (RGBA bytes) into the two atlases
    const W = header.width, H = header.height, n = W * H, a0 = new Uint8Array(n * 4), a1 = new Uint8Array(n * 4);
    ["albedo", "normal", "rao"].forEach(function (k) { if (pics[k].width !== W || pics[k].height !== H) fail("the '" + k + "' picture is " + pics[k].width + " x " + pics[k].height + ", the header says " + W + " x " + H); });
    const A = pics.albedo.data, N = pics.normal.data, R = pics.rao.data;
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      a0[o] = A[o]; a0[o + 1] = A[o + 1]; a0[o + 2] = A[o + 2]; a0[o + 3] = R[o + 1];
      a1[o] = N[o]; a1[o + 1] = N[o + 1]; a1[o + 2] = R[o]; a1[o + 3] = R[o + 2];
    }
    return { atlas0: a0, atlas1: a1 };
  }

  function load(bytes, decode) {
    const p = parse(bytes), h = p.header, names = ["albedo", "normal", "rao"];
    return Promise.all(names.map(function (k) { return decode(p.images[k]); })).then(function (list) {
      const pics = {}; names.forEach(function (k, i) { pics[k] = list[i]; });
      const j = join(h, pics);
      return { header: h, atlas0: j.atlas0, atlas1: j.atlas1, width: h.width, height: h.height };
    });
  }

  // a page's decoder: the browser's own (createImageBitmap, no colour conversion), through a canvas for the bytes
  function browser_decode(jpeg) {
    return createImageBitmap(new Blob([jpeg], { type: "image/jpeg" }), { colorSpaceConversion: "none", premultiplyAlpha: "none" }).then(function (bm) {
      const c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height;
      const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(bm, 0, 0);
      const w = bm.width, h = bm.height, d = g.getImageData(0, 0, w, h); if (bm.close) bm.close();             // (the size first: a closed bitmap is 0 x 0)
      return { width: w, height: h, data: d.data };
    });
  }

  const srgb_to_linear = function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  function table(h) {
    const m = h.materials, n = m.length, W = h.width, H = h.height, origin = new Float32Array(n * 2), avg = new Float32Array(n * 3), names = [], kinds = [], tile = [];
    for (let i = 0; i < n; i++) {
      const c = m[i];
      origin[i * 2] = (c.cell[0] * h.cell + h.border) / W; origin[i * 2 + 1] = (c.cell[1] * h.cell + h.border) / H;
      avg[i * 3] = srgb_to_linear(c.avg[0]); avg[i * 3 + 1] = srgb_to_linear(c.avg[1]); avg[i * 3 + 2] = srgb_to_linear(c.avg[2]);
      names.push(c.name); kinds.push(KINDS.indexOf(c.kind)); tile.push(c.tile);
    }
    const inner = h.cell - 2 * h.border;
    return { names: names, kinds: kinds, tile: tile, origin: origin, avg: avg, inner: [inner / W, inner / H], border: [h.border / W, h.border / H], count: n };
  }
  function index(h, name) { for (let i = 0; i < h.materials.length; i++) if (h.materials[i].name === name) return i; fail("no material '" + name + "' (they are: " + h.materials.map(function (c) { return c.name; }).join(", ") + ")"); return -1; }

  return { parse: parse, join: join, load: load, browser_decode: browser_decode, table: table, index: index, KINDS: KINDS };
});
