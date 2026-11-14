// THE HUMAN: the modules of the lite human, a person of a few sliders (no other body model in it): its model (the file read from the pack's `human.model`), the palette, the dice, the clothes, the hair and the people as data.
// Packing modules, kept by name where they are included (species.js: human_libs) and made with the ones each is made of.
// Ported 2026-11-05 from the first version of the creature system, renamed and merged by domain. From here this file is the source.

// ========================================================================================================================
// human_lite_parts
// ========================================================================================================================
packing()("human_lite_parts", function human_lite_parts() {
  "use strict";
  // HUMAN LITE PARTS: the one piece of a person that is MADE, not baked: the eyeballs (pure: no engine, no GL, no system; plain arrays in, plain arrays out). Node 14 and the bundler's parser: no optional chaining, no ??, no async / await,
  // no classes. (The hands and the feet were made here too, from the person's joints: the tubes of a hand were not good, so the lite human takes the source body's own hands and feet, decimated, in its one file.)
  //
  //   const eye = P.eye(ctx)   ctx: { s, centre, radius, base (the number the first new vertex gets), bone }
  //   -> { pos: [[x, y, z]], tris: [corner ...], skin: [[[bone, weight]]] (a list for every new vertex), bones: [], kind: "eye", uv: [[u, v]] (the shader draws the iris from it), centre, radius }
  //   P.orient(m, body, ring) turns the triangles of a part to one side (a pass over the edges makes them consistent, then the piece faces away from its middle)
  const sqrt = Math.sqrt, PI = Math.PI;
  const add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }, sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }, mul = function (a, k) { return [a[0] * k, a[1] * k, a[2] * k]; };
  const dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }, cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  const len = function (a) { return sqrt(dot(a, a)); }, unit = function (a) { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const mix = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  const clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  const smooth = function (a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  
  // a builder of a part: vertices (with their skin) and triangles (orient() turns them to one side after)
  function maker(base) {
    const m = { pos: [], skin: [], tris: [], base: base };
    m.vert = function (p, skin) { m.pos.push(p); m.skin.push(skin); return base + m.pos.length - 1; };
    m.tri = function (a, b, c) { m.tris.push(a, b, c); };
    m.quad = function (a, b, c, d) { m.tris.push(a, b, c, a, c, d); };
    m.point_of = function (i, body) { return i >= base ? m.pos[i - base] : body[i]; };
    return m;
  }
  // the triangles of a part are made in any order; this turns them to ONE side: a pass over the edges makes every piece (triangles that share vertices) consistent (a shared edge is run both ways, once by each), then the piece
  // faces out: when it has vertices of the body's ring it is welded to the body, so it must run the ring's edges the other way than the body does (`ring`: the body's loop in the body's own direction); a piece that is free
  // (a finger, an eye) faces away from its own middle
  function orient(m, body, ring) {
    const T = m.tris.length / 3, key = function (a, b) { return a * 1048576 + b; };
    const owner = {};                                                                              // (the directed edge a -> b: the triangle that has it)
    for (let t = 0; t < T; t++) for (let c = 0; c < 3; c++) owner[key(m.tris[3 * t + c], m.tris[3 * t + (c + 1) % 3])] = t;
    const flipped = new Uint8Array(T), comp = new Int32Array(T).fill(-1), has = function (t, a, b) { for (let c = 0; c < 3; c++) if (m.tris[3 * t + c] === a && m.tris[3 * t + (c + 1) % 3] === b) return true; return false; };
    let ncomp = 0;
    const edges_of = function (t) { return [[m.tris[3 * t], m.tris[3 * t + 1]], [m.tris[3 * t + 1], m.tris[3 * t + 2]], [m.tris[3 * t + 2], m.tris[3 * t]]]; };
    const dir_in = function (t, a, b) {                                                            // the direction triangle t runs the edge {a, b} in now (1: a -> b, -1: b -> a, 0: it has no such edge)
      const f = flipped[t];
      for (let c = 0; c < 3; c++) { const x = m.tris[3 * t + c], y = m.tris[3 * t + (c + 1) % 3]; if (x === a && y === b) return f ? -1 : 1; if (x === b && y === a) return f ? 1 : -1; }
      return 0;
    };
    const by_edge = {};
    for (let t = 0; t < T; t++) edges_of(t).forEach(function (e) { const k = Math.min(e[0], e[1]) * 1048576 + Math.max(e[0], e[1]); (by_edge[k] = by_edge[k] || []).push(t); });
    for (let t0 = 0; t0 < T; t0++) {
      if (comp[t0] >= 0) continue;
      const stack = [t0]; comp[t0] = ncomp;
      while (stack.length) {
        const t = stack.pop();
        edges_of(t).forEach(function (e) {
          const k = Math.min(e[0], e[1]) * 1048576 + Math.max(e[0], e[1]), list = by_edge[k];
          list.forEach(function (u) {
            if (u === t || comp[u] >= 0) return;
            comp[u] = ncomp;
            if (dir_in(u, e[0], e[1]) === dir_in(t, e[0], e[1])) flipped[u] = 1 - flipped[u];
            stack.push(u);
          });
        });
      }
      ncomp++;
    }
    for (let c = 0; c < ncomp; c++) {
      let sign = 0;
      if (ring && ring.length) for (let i = 0; i < ring.length && !sign; i++) {                      // (welded: the body runs ring[i] -> ring[i + 1]; this piece must run it the other way)
        const a = ring[i], b = ring[(i + 1) % ring.length];
        for (let t = 0; t < T; t++) if (comp[t] === c) { const d = dir_in(t, a, b); if (d !== 0) { sign = d === 1 ? -1 : 1; break; } }
      }
      if (!sign) {
        let cen = [0, 0, 0], n = 0, s = 0;
        for (let t = 0; t < T; t++) if (comp[t] === c) for (let q = 0; q < 3; q++) { cen = add(cen, m.point_of(m.tris[3 * t + q], body)); n++; }
        cen = mul(cen, 1 / n);
        for (let t = 0; t < T; t++) if (comp[t] === c) {
          const i0 = flipped[t] ? 2 : 1, i1 = flipped[t] ? 1 : 2, a = m.point_of(m.tris[3 * t], body), b = m.point_of(m.tris[3 * t + i0], body), d = m.point_of(m.tris[3 * t + i1], body);
          s += dot(cross(sub(b, a), sub(d, a)), sub(mul(add(add(a, b), d), 1 / 3), cen));
        }
        sign = s >= 0 ? 1 : -1;
      }
      if (sign < 0) for (let t = 0; t < T; t++) if (comp[t] === c) flipped[t] = 1 - flipped[t];
    }
    for (let t = 0; t < T; t++) if (flipped[t]) { const x = m.tris[3 * t + 1]; m.tris[3 * t + 1] = m.tris[3 * t + 2]; m.tris[3 * t + 2] = x; }
    return ncomp;
  }
  // ---- an eyeball: a sphere of 8 meridians and 6 parallels; its uv is its place on the ball in units of the radius, 10 taken off u on the front and 20 on the back (the shader draws the iris and the pupil from it)
  function eye(ctx) {
    const m = maker(ctx.base), c = ctx.centre, r = ctx.radius, bone = ctx.bone, MER = 8, PAR = 6, uv = [];
    const put = function (x, y, z) { const p = [c[0] + x * r, c[1] + y * r, c[2] + z * r]; const i = m.vert(p, [[bone, 1]]); uv.push([(z > 0 ? -10 : -20) + x, y]); return i; };
    const top = put(0, 0, 1), bot = put(0, 0, -1), rings = [];
    for (let p = 1; p < PAR; p++) {
      const th = PI * p / PAR, ring = [];
      for (let k = 0; k < MER; k++) { const ph = 2 * PI * k / MER; ring.push(put(Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th))); }
      rings.push(ring);
    }
    for (let k = 0; k < MER; k++) m.tri(top, rings[0][k], rings[0][(k + 1) % MER]);
    for (let p = 0; p + 1 < rings.length; p++) for (let k = 0; k < MER; k++) m.quad(rings[p][k], rings[p + 1][k], rings[p + 1][(k + 1) % MER], rings[p][(k + 1) % MER]);
    const last = rings[rings.length - 1]; for (let k = 0; k < MER; k++) m.tri(bot, last[(k + 1) % MER], last[k]);
    orient(m, {}, null);
    return { kind: "eye", pos: m.pos, tris: m.tris, skin: m.skin, bones: [], uv: uv, centre: c, radius: r };
  }

  return { eye: eye, orient: orient };
});

// ========================================================================================================================
// human_lite_look
// ========================================================================================================================
packing()("human_lite_look", function human_lite_look() {
  "use strict";
  // HUMAN LITE LOOK: the colour of a person as a PALETTE, not as pictures (pure: no engine, no GL, no system; plain arrays in, plain arrays out). Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no classes.
  // The skin is a few numbers: the TONE (0 pale .. 1 deep, a ramp through six colours), the UNDERTONE (-1 cool and pink .. +1 warm and golden), how RUDDY the blood shows (0 .. 1), and the age (a skin pales and greys after forty-five).
  // The body's vertices carry four MASKS (in the file: the lips, the flush of the cheeks and the nose, the elbows and knees, the hollows of the eyes) that the palette is painted by: a lip is darker and redder than the skin round it,
  // a cheek flushes, a knee is a little darker. Ancestry (the shape) and tone (the colour) are separate: any shape wears any tone.
  //
  //   const K = human_lite_look;
  //   K.skin(look, years) -> [r, g, b]                      the colour of the person's skin where no mask says otherwise (look: { tone, undertone, ruddy })
  //   K.paint(masks, n, look, years) -> Float32Array (3 n)  the colour of every vertex of the body from its four masks (Uint8, 4 a vertex)       K.flat(look, years, count) -> Float32Array (3 count): the skin colour, for the parts that are made
  //   K.PRESETS      { name: { tone, undertone, ruddy } }  twelve skins by name        K.DEFAULT      the look of a person who says nothing        K.check(look, who) -> the look in full, or an Error that says what is wrong
  //   K.eye_rgb(name) / K.EYES  { brown, hazel, green, grey, blue ... } -> [r, g, b]    K.tone_of(african, asian, caucasian, seed) -> a tone that goes with an ancestry (for a randomizer: nothing forces it)
  const clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  const mix = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  const RAMP = [[0, [0.94, 0.80, 0.71]], [0.2, [0.88, 0.70, 0.58]], [0.4, [0.80, 0.60, 0.46]], [0.6, [0.64, 0.45, 0.32]], [0.8, [0.44, 0.29, 0.20]], [1, [0.27, 0.17, 0.12]]];
  const ramp = function (t) { t = clamp(t, 0, 1); for (let i = 0; i < RAMP.length - 1; i++) if (t <= RAMP[i + 1][0]) return mix(RAMP[i][1], RAMP[i + 1][1], (t - RAMP[i][0]) / (RAMP[i + 1][0] - RAMP[i][0])); return RAMP[RAMP.length - 1][1].slice(); };
  const DEFAULT = { tone: 0.3, undertone: 0, ruddy: 0.25, lips: null, lip_strength: 0.6, eyes: [0.28, 0.17, 0.08] };
  const KEYS = Object.keys(DEFAULT);
  const PRESETS = {
    porcelain: { tone: 0.0, undertone: -0.5, ruddy: 0.25 }, fair: { tone: 0.1, undertone: -0.2, ruddy: 0.3 }, light: { tone: 0.2, undertone: 0, ruddy: 0.25 }, "light olive": { tone: 0.3, undertone: 0.6, ruddy: 0.15 },
    medium: { tone: 0.4, undertone: 0.3, ruddy: 0.2 }, olive: { tone: 0.5, undertone: 0.7, ruddy: 0.15 }, tan: { tone: 0.55, undertone: 0.4, ruddy: 0.2 }, golden: { tone: 0.62, undertone: 0.8, ruddy: 0.15 },
    brown: { tone: 0.72, undertone: 0.3, ruddy: 0.2 }, "deep brown": { tone: 0.85, undertone: 0.2, ruddy: 0.2 }, dark: { tone: 0.93, undertone: 0, ruddy: 0.2 }, ebony: { tone: 1, undertone: -0.2, ruddy: 0.15 },
  };
  const EYES = { brown: [0.28, 0.17, 0.08], "light brown": [0.45, 0.3, 0.14], hazel: [0.42, 0.32, 0.14], green: [0.24, 0.42, 0.24], grey: [0.46, 0.5, 0.54], blue: [0.22, 0.38, 0.62], "deep blue": [0.12, 0.22, 0.5], amber: [0.6, 0.4, 0.1], black: [0.06, 0.04, 0.03] };
  const eye_rgb = function (n) { return EYES[n] ? EYES[n].slice() : null; };
  // the look of a person: the defaults with what is given on top. A mistake is an Error that says which; with `notes` (an array) it is NOT one: a number out of its range is held to the end of it, a colour's channels too, a field that is none,
  // a name that is none, a value that is no number are left out, each said in `notes`, and the person has her look (the creature is made offline of whatever it is given)
  function check(look, who, notes) {
    const l = Object.assign({}, DEFAULT), tag = (who ? "creature '" + who + "': " : "") + "human_lite: look: ";
    const bad = function (msg) { if (notes) { notes.push(tag + msg); return; } throw new Error(tag + msg); };
    if (look === undefined || look === null) return l;
    if (typeof look !== "object" || Array.isArray(look)) { bad("the look is { tone, undertone, ruddy, lips, lip_strength, eyes } (or { preset: \"olive\" })"); return l; }
    let base = {};
    if (look.preset !== undefined) { if (PRESETS[look.preset]) base = PRESETS[look.preset]; else bad("no skin preset '" + look.preset + "' (" + Object.keys(PRESETS).join(", ") + ")"); }
    const src = Object.assign({}, base, look);
    Object.keys(src).forEach(function (k) {
      if (k === "preset") return;
      if (KEYS.indexOf(k) < 0) { bad("unknown field '" + k + "' (" + KEYS.join(", ") + ", preset)"); return; }
      const v = src[k];
      if (k === "lips" || k === "eyes") {
        if (k === "lips" && v === null) { l[k] = null; return; }
        const c = typeof v === "string" ? eye_rgb(v) : v;
        if (!(Array.isArray(c) && c.length === 3 && c.every(function (x) { return typeof x === "number" && isFinite(x) && (notes || (x >= 0 && x <= 1)); }))) { bad(k + " is a colour [r, g, b], 0 .. 1" + (k === "eyes" ? " or the name of one (" + Object.keys(EYES).join(", ") + ")" : "")); return; }
        const held = c.map(function (x) { return Math.min(1, Math.max(0, x)); });
        if (notes && held.some(function (x, i) { return x !== c[i]; })) notes.push(tag + k + " [" + c.join(", ") + "] is held to 0 .. 1");
        l[k] = held; return;
      }
      if (typeof v !== "number" || !isFinite(v)) { bad(k + " is a number"); return; }
      const lo = k === "undertone" ? -1 : 0, hi = 1;
      if (v < lo || v > hi) { if (!notes) throw new Error(tag + k + " goes from " + lo + " to " + hi + " (" + v + ")"); notes.push(tag + k + " goes from " + lo + " to " + hi + ": " + v + " is held to " + (v < lo ? lo : hi)); l[k] = v < lo ? lo : hi; return; }
      l[k] = v;
    });
    return l;
  }
  function skin(look, years) {
    let c = ramp(look.tone);
    c = [c[0] * (1 + 0.07 * look.undertone), c[1] * (1 + 0.015 * look.undertone), c[2] * (1 - 0.12 * look.undertone)];        // (warm: more red and yellow, less blue; cool: pinker)
    const blush = look.ruddy * (years < 14 ? 1.3 : 1);
    c = [c[0], c[1] * (1 - 0.06 * blush), c[2] * (1 - 0.05 * blush)];
    const age = clamp((years - 45) / 40, 0, 1);                                                                           // (paler and greyer with the years)
    const grey = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    c = mix(c, [grey * 1.04, grey * 0.98, grey * 0.95], 0.16 * age);
    return [clamp(c[0], 0, 1), clamp(c[1], 0, 1), clamp(c[2], 0, 1)];
  }
  function paint(masks, n, look, years) {
    const base = skin(look, years), out = new Float32Array(3 * n), tone = look.tone;
    const lip = look.lips ? look.lips : [base[0] * 0.82, base[1] * (0.52 + 0.08 * tone), base[2] * (0.55 + 0.1 * tone)];
    const flush = [base[0] * 1.03, base[1] * 0.84, base[2] * 0.82], knee = [base[0] * 0.93, base[1] * 0.87, base[2] * 0.87], hollow = [base[0] * 0.80, base[1] * 0.76, base[2] * 0.78];
    const strength = look.lip_strength, blush = (0.12 + 0.5 * look.ruddy) * (1 - 0.35 * tone);
    for (let i = 0; i < n; i++) {
      const l = masks[4 * i] / 255 * strength, f = masks[4 * i + 1] / 255 * blush, k = masks[4 * i + 2] / 255 * 0.6, h = masks[4 * i + 3] / 255 * 0.7;
      let c = base;
      if (f > 0) c = mix(c, flush, f);
      if (k > 0) c = mix(c, knee, k);
      if (h > 0) c = mix(c, hollow, h);
      if (l > 0) c = mix(c, lip, l);
      out[3 * i] = c[0]; out[3 * i + 1] = c[1]; out[3 * i + 2] = c[2];
    }
    return out;
  }
  function flat(look, years, count) { const b = skin(look, years), o = new Float32Array(3 * count); for (let i = 0; i < count; i++) { o[3 * i] = b[0]; o[3 * i + 1] = b[1]; o[3 * i + 2] = b[2]; } return o; }
  function tone_of(af, as, ca, seed) {                                                                                    // (a tone for an ancestry: a mean of the three, with a spread; a seed in 0 .. 1 picks inside it)
    const sum = af + as + ca || 1, m = (af * 0.86 + as * 0.38 + ca * 0.22) / sum, spread = 0.16;
    return clamp(m + (seed - 0.5) * 2 * spread, 0, 1);
  }
  return { skin: skin, paint: paint, flat: flat, check: check, PRESETS: PRESETS, DEFAULT: DEFAULT, EYES: EYES, eye_rgb: eye_rgb, tone_of: tone_of, ramp: ramp };
});

// ========================================================================================================================
// human_lite_mutate
// ========================================================================================================================
packing()("human_lite_mutate", function human_lite_mutate() {
  "use strict";
  // HUMAN LITE MUTATE: grows a different creature out of the lite human (pure: no engine, no GL, no system; plain arrays in, plain objects out). Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no classes.
  // Nothing is loaded and nothing is kept: a mutation is SIMULATED while the creature is made. `iterations` mutations are drawn one after another (a seeded dice: the same seed is the same creature, on any machine) and each changes what the
  // creature has become so far (a tail that exists is lengthened, not grown again; a bone that is as long as it may be stays); the creature that is left, the final mesh with its skeleton, is what build() makes. There is no history to keep.
  //
  //   human: { model: "lite", shape: { ... }, mutate: { seed: 7, iterations: 6, strength: 0.5, toward: "reptile", families: [...], symmetric: true, budget: 1 } }      mutate: true | a number of iterations | { ... }
  //     seed        any number (the dice)                              iterations   0 .. 48 (default 3; 0 is no mutation: the person)                    strength   0 .. 1 how far one mutation goes (default 0.5)
  //     toward      null | "reptile" | "beast" | "demon" | "brute" | "goblin" | "ghoul" | "alien": the kind of creature the dice favour (the others still happen, less)
  //     families    a list of "reshape" (proportions: bones longer, thicker, bent; sliders; size), "push" (muzzle, brow, skull), "swell" (hump, dewlap, jowls, chest: flesh that is pushed out and, with a soft tissue bone in it, moves),
  //                 "grow" (new bones with a skin: a tail that swings, horns, tusks, spines), "colour" (the skin's tint)                      default: all
  //     symmetric   true (default): both sides alike; false: each side its own                                                                             budget     0 .. 1: the share of what may grow (1: 1000 triangles, 40 bones)
  //     genes       the body's parts SET BY HAND (on top of the dice, or alone: with `genes` and no `iterations` the dice are not thrown): { bones: { "hand.*": { length: 1.5, girth: 1.6, bend: 0, lean: 0 }, "foot.*": 1.3, "upperarm.*": { girth: 1.5 } ... },
  //                 size: 1.1, push: { muzzle, brow, skull } (metres), swell: { chest: { r: 0.15, h: 0.06 }, hump, dewlap, jowls } (a bulge: its radius and height, metres) }. A bone's name ends in `.L` / `.R` or `.*` for both (upperarm.*, lowerarm.*, hand.*, fingers1.*, fingers2.*,
  //                 thumb.*, thigh.*, shin.*, foot.*, toe.*, clavicle.*, ear.*, and spine1, spine2, spine3, neck, head, jaw); a number instead of an object is a factor for the length AND the girth; length and girth are factors (1: as it is), bend and lean degrees. Every value is held to what the bone may be (LIM, CAP).
  //   Every number is held to its range and what is none is left out, each said in `notes` (the creature is made offline of whatever it is given); `strict` of the definition makes the first mistake an Error.
  //
  //   M.clean(spec, tag, notes) -> the spec in full, or null (no mutation)                         M.evolve(api, model, spec, p) -> { genome, p, applied, tags, kind }: the dice, `iterations` times
  //   M.express(api, model, rows, genome) -> { rows, pieces, tissue, tint, ... }                    the genome made flesh: the pushes, the bones' reshaping (linear blend skinning with the file's own weights), the swellings, the points
  //                                                                                                  that follow the flesh (api.points_follow), the growths as meshes with their bones
  //   api: { point(model, rows, name), points_follow(model, dv), slider_list(model) } (the lite human's own)
  // What it costs: reshaping is one pass over the 4 000 vertices (about 3 ms), a field is another; a tail is 102 triangles and 8 bones, a pair of horns 132, a pair of tusks 70, a row of spines 6 each. Nothing is stored: the genes are a dozen numbers.
  const DEG = Math.PI / 180;
  const clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  const smooth = function (a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const fail = function (msg) { throw new Error("human_lite: " + msg); };
  const add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }, sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }, mul = function (a, k) { return [a[0] * k, a[1] * k, a[2] * k]; };
  const dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }, cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  const len = function (a) { return Math.sqrt(dot(a, a)); }, unit = function (a) { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const mix3 = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  const round = function (x, n) { const m = Math.pow(10, n === undefined ? 4 : n); return Math.round(x * m) / m; };

  const FAMILIES = ["reshape", "push", "swell", "grow", "colour"];
  const ARCHETYPES = ["reptile", "beast", "demon", "brute", "goblin", "ghoul", "alien"];
  const MAX_ITER = 48;
  const BUDGET_TRIS = 1000, BUDGET_BONES = 40;                                                           // (what may grow at a budget of 1)
  const LIM = { length: [0.5, 2.2], girth: [0.55, 1.8], bend: [-45, 45], lean: [-30, 30] };            // (what a bone's gene may be: lengths and girths are factors, bend and lean degrees)
  // what a bone may be, over LIM: a neck 1.8 times as thick as the head under it is a hood, a jaw twice as long a beak (the bone's name without its side and its number)
  const CAP = { neck: { girth: [0.7, 1.25], length: [0.75, 1.7] }, head: { girth: [0.8, 1.5], length: [0.8, 1.5] }, thigh: { girth: [0.55, 1.5] }, shin: { girth: [0.55, 1.45] }, spine1: { girth: [0.6, 1.2] }, spine2: { girth: [0.6, 1.25] }, spine3: { girth: [0.6, 1.3] }, jaw: { girth: [0.7, 1.5], length: [0.7, 1.7] }, ear: { length: [0.4, 3], girth: [0.5, 1.6] }, fingers: { length: [0.5, 3], girth: [0.5, 1.5] },
    thumb: { length: [0.5, 2.2], girth: [0.5, 1.5] }, hand: { length: [0.6, 1.8], girth: [0.6, 1.5] }, foot: { length: [0.6, 1.9], bend: [-45, 40] }, clavicle: { length: [0.6, 1.4] }, upperarm: { length: [0.5, 1.9], girth: [0.55, 1.55] }, lowerarm: { length: [0.5, 1.9], girth: [0.55, 1.5] } };
  const limit_of = function (name, field) { const c = CAP[name.replace(/\.[LR]$/, "").replace(/\d$/, "")]; return c && c[field] ? c[field] : LIM[field]; };
  const PUSH_MAX = { muzzle: 0.09, brow: 0.03, skull: 0.07 };                                           // (metres)
  const SWELLS = { hump: { tissue: "hump", r: [0.09, 0.15], h: [0.03, 0.09] }, dewlap: { tissue: "dewlap", r: [0.06, 0.11], h: [0.025, 0.06] }, jowls: { tissue: "jowl", r: [0.04, 0.07], h: [0.015, 0.035] }, chest: { tissue: "chest", r: [0.11, 0.17], h: [0.03, 0.07] } };
  const TINTS = { green: [0.36, 0.56, 0.26], olive: [0.46, 0.5, 0.26], grey: [0.52, 0.52, 0.54], ash: [0.7, 0.68, 0.66], red: [0.66, 0.2, 0.14], rust: [0.6, 0.32, 0.16], blue: [0.3, 0.42, 0.62], violet: [0.46, 0.3, 0.58], bone: [0.82, 0.78, 0.66], ochre: [0.72, 0.56, 0.22] };
  const HORN_COLOUR = [0.8, 0.75, 0.6];

  // ---- the spec, as it is given
  function clean(spec, tag, notes) {
    if (spec === undefined || spec === null || spec === false) return null;
    const bad = function (msg) { if (notes) { notes.push(tag + "mutate: " + msg); return; } fail(tag + "mutate: " + msg); };
    if (spec === true) spec = {}; else if (typeof spec === "number") spec = { iterations: spec };
    if (typeof spec !== "object" || Array.isArray(spec)) { bad("mutate is true, a number of iterations or { seed, iterations, strength, toward, families, symmetric, budget }" + (notes ? ": left out" : "")); return null; }
    const out = { seed: 1, iterations: 3, strength: 0.5, toward: null, families: FAMILIES.slice(), symmetric: true, budget: 1, genes: null };
    const num = function (k, v, lo, hi, whole) {
      if (notes && typeof v === "string" && v.trim() !== "" && isFinite(+v)) v = +v;
      if (typeof v !== "number" || !isFinite(v)) { bad(k + " is a number" + (notes ? ": left out" : "")); return undefined; }
      if (lo !== null && (v < lo || v > hi)) { if (!notes) fail(tag + "mutate: " + k + " goes from " + lo + " to " + hi + " (" + v + ")"); notes.push(tag + "mutate: " + k + " goes from " + lo + " to " + hi + ": " + v + " is held to " + (v < lo ? lo : hi)); v = v < lo ? lo : hi; }
      return whole ? Math.floor(v) : v;
    };
    Object.keys(spec).forEach(function (k) {
      const v = spec[k];
      if (k === "seed") { const n = num(k, v, null, null, true); if (n !== undefined) out.seed = n; }
      else if (k === "iterations") { const n = num(k, v, 0, MAX_ITER, true); if (n !== undefined) out.iterations = n; }
      else if (k === "strength") { const n = num(k, v, 0, 1); if (n !== undefined) out.strength = n; }
      else if (k === "budget") { const n = num(k, v, 0, 1); if (n !== undefined) out.budget = n; }
      else if (k === "genes") { if (v && typeof v === "object" && !Array.isArray(v)) out.genes = v; else bad("genes is { bones, size, push, swell }" + (notes ? ": left out" : "")); }
      else if (k === "symmetric") { if (typeof v === "boolean") out.symmetric = v; else bad("symmetric is true or false" + (notes ? ": left out" : "")); }
      else if (k === "toward") { if (v === null || v === "none") out.toward = null; else if (ARCHETYPES.indexOf(v) >= 0) out.toward = v; else bad("no kind '" + v + "' to evolve toward (" + ARCHETYPES.join(", ") + ")" + (notes ? ": left out" : "")); }
      else if (k === "families") {
        if (!Array.isArray(v)) { bad("families is a list of " + FAMILIES.join(", ") + (notes ? ": left out" : "")); return; }
        const ok = v.filter(function (f) { return FAMILIES.indexOf(f) >= 0; });
        if (ok.length !== v.length) bad("families: no family '" + v.filter(function (f) { return FAMILIES.indexOf(f) < 0; }).join("', '") + "' (" + FAMILIES.join(", ") + ")" + (notes ? ": left out" : ""));
        out.families = ok;
      }
      else bad("unknown field '" + k + "' (seed, iterations, strength, toward, families, symmetric, budget, genes)" + (notes ? ": left out" : ""));
    });
    if (out.genes && spec.iterations === undefined) out.iterations = 0;                                // (genes alone: the dice are not thrown)
    return out;
  }

  // ---- the dice (mulberry32: integers only, the same numbers on every machine)
  function dice(seed) {
    let a = (Math.floor(seed) | 0) ^ 0x2545f491;
    const next = function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < 6; i++) next();                                                                  // (seeds that are next to each other do not start alike)
    return next;
  }

  // ---- the genome: what the creature has become. Bones' genes by name (length and girth factors, bend and lean in degrees), the pushes (metres), the swellings, the growths, the tint, the size, the sliders that moved
  const fresh = function () { return { bones: {}, size: 1, drift: {}, push: { muzzle: 0, brow: 0, skull: 0 }, swell: {}, grow: {}, tint: null }; };
  const gene = function (g, name) { return g.bones[name] || (g.bones[name] = { length: 1, girth: 1, bend: 0, lean: 0 }); };
  // a move of proportions: [bone (a ".*" is both sides), field, the value at full strength (a factor for length and girth, degrees for bend and lean)]
  const MOVES = {
    hunch: [["spine1", "bend", 9], ["spine2", "bend", 14], ["spine3", "bend", 11], ["neck", "bend", -16]],
    long_arms: [["upperarm.*", "length", 1.6], ["lowerarm.*", "length", 1.6], ["hand.*", "length", 1.3], ["clavicle.*", "length", 1.12]],
    short_arms: [["upperarm.*", "length", 0.55], ["lowerarm.*", "length", 0.55], ["hand.*", "length", 0.8]],
    brawn: [["clavicle.*", "length", 1.25], ["upperarm.*", "girth", 1.45], ["lowerarm.*", "girth", 1.4], ["hand.*", "girth", 1.3], ["spine3", "girth", 1.22], ["spine2", "girth", 1.12], ["neck", "girth", 1.25]],
    lanky: [["spine1", "length", 1.2], ["spine2", "length", 1.2], ["neck", "length", 1.45], ["thigh.*", "length", 1.22], ["shin.*", "length", 1.22], ["upperarm.*", "girth", 0.8], ["thigh.*", "girth", 0.82], ["spine2", "girth", 0.85]],
    squat: [["thigh.*", "length", 0.66], ["shin.*", "length", 0.66], ["thigh.*", "girth", 1.25], ["shin.*", "girth", 1.2]],
    big_hands: [["hand.*", "length", 1.55], ["hand.*", "girth", 1.55], ["thumb.*", "length", 1.4], ["fingers1.*", "length", 1.3]],
    claws: [["fingers2.*", "length", 2.4], ["fingers2.*", "girth", 0.6], ["fingers1.*", "length", 1.3], ["thumb.*", "length", 1.5], ["thumb.*", "girth", 0.7]],
    big_head: [["head", "length", 1.4], ["head", "girth", 1.4], ["neck", "girth", 1.1]],
    small_head: [["head", "length", 0.7], ["head", "girth", 0.7], ["neck", "girth", 0.9]],
    ears: [["ear.*", "length", 2.8], ["ear.*", "girth", 1.3]],
    jaw: [["jaw", "length", 1.5], ["jaw", "girth", 1.3]],
    digitigrade: [["thigh.*", "length", 0.9], ["shin.*", "length", 1.22], ["shin.*", "bend", -8], ["foot.*", "length", 1.5], ["foot.*", "bend", 36]],
    thick_legs: [["thigh.*", "girth", 1.4], ["shin.*", "girth", 1.35], ["foot.*", "girth", 1.2]],
  };
  // how far an entry of a move has gone already (1: its full strength, for that bone): an entry that has gone as far as that has little left to give, so that the same move thrown again and again, or two moves that both make a thigh thick, do not pile up
  const progress = function (g, entry) {
    const n = entry[0], b = g.bones[n], v = b ? b[entry[1]] : (entry[1] === "length" || entry[1] === "girth" ? 1 : 0);
    return entry[1] === "length" || entry[1] === "girth" ? Math.log(Math.max(v, 1e-3)) / Math.log(entry[2]) : v / entry[2];
  };
  const move = function (c, entries) {
    entries.forEach(function (e) {
      const names = /\.\*$/.test(e[0]) ? [e[0].replace("*", "L"), e[0].replace("*", "R")] : [e[0]], field = e[1], full = e[2], shared = 0.8 + 0.4 * c.u();      // (one entry of a move goes a little more or less than another)
      names.forEach(function (n) {
        const m = clamp(c.m * shared * (c.sym ? 1 : 0.6 + 0.8 * c.u()) * clamp(1.4 - progress(c.g, [n, field, full]), 0, 1), 0, 1.25), b = gene(c.g, n), lim = limit_of(n, field);
        b[field] = clamp(field === "length" || field === "girth" ? b[field] * Math.pow(full, m) : b[field] + full * m, lim[0], lim[1]);
      });
    });
  };
  // what a growth costs, and what it is when it first grows
  const tube_tris = function (n, sides) { return 2 * sides * n + sides; };
  // A growth is EXTRUDED from the skin: a disc of the body's own triangles is cut out and the loop of vertices that is left (its RIM, between MINRIM and MAXRIM of them) is the first ring of the growth, so a growth of n steps costs at most
  // 2 * rim * n + rim triangles (the cut ones are given back). RINGS: the steps of a horn's, a tusk's, a spine's path; the bones: a horn and a tusk have two each, a spine one, a tail one a step.
  const RINGS = { horns: 6, tusks: 4, spines: 2 }, MAXRIM = { tail: 14, horns: 12, tusks: 10, spines: 8 }, MINRIM = { tail: 8, horns: 7, tusks: 6, spines: 5 };
  const COST = {
    tail: function (s) { return { tris: tube_tris(s.segs, MAXRIM.tail), bones: s.segs }; },
    horns: function () { return { tris: 2 * tube_tris(RINGS.horns, MAXRIM.horns), bones: 4 }; },
    tusks: function () { return { tris: 2 * tube_tris(RINGS.tusks, MAXRIM.tusks), bones: 4 }; },
    spines: function (s) { return { tris: tube_tris(RINGS.spines, MAXRIM.spines) * s.count, bones: s.count }; },
  };
  const spent = function (g) { const t = { tris: 0, bones: 0 }; Object.keys(g.grow).forEach(function (k) { const c = COST[k](g.grow[k]); t.tris += c.tris; t.bones += c.bones; }); return t; };
  const grown_fits = function (c, kind, spec) { const s = spent(c.g), n = COST[kind](spec); return s.tris + n.tris <= Math.round(BUDGET_TRIS * c.budget) && s.bones + n.bones <= Math.round(BUDGET_BONES * c.budget); };
  const between = function (c, a, b) { return a + (b - a) * c.u(); };
  const grow_op = function (kind, make, bigger) {
    return function (c) {
      const have = c.g.grow[kind];
      if (have) { bigger(c, have); return "grew its " + kind + " more"; }
      const s = make(c);
      if (!grown_fits(c, kind, s)) return null;
      c.g.grow[kind] = s; return "grew " + kind;
    };
  };
  const swell_op = function (kind) {
    return function (c) {
      const d = SWELLS[kind], have = c.g.swell[kind];
      const r = between(c, d.r[0], d.r[1]), h = d.h[0] + (d.h[1] - d.h[0]) * clamp(c.m, 0, 1) * (0.7 + 0.3 * c.u());
      c.g.swell[kind] = have ? { r: Math.min(d.r[1], Math.max(have.r, 0.9 * r)), h: Math.min(d.h[1], have.h + 0.5 * h) } : { r: r, h: h };
      return have ? "swelled its " + kind + " more" : "grew a " + kind;
    };
  };
  const push_op = function (field, lo, hi) {
    return function (c) { const before = c.g.push[field]; c.g.push[field] = clamp(before + (lo + (hi - lo) * clamp(c.m, 0, 1)) * (0.7 + 0.3 * c.u()), 0, PUSH_MAX[field]); return (before > 0 ? "pushed its " : "grew a ") + field + (before > 0 ? " further" : ""); };
  };
  const reshape_op = function (name, what) { return function (c) { move(c, MOVES[name]); return what; }; };
  // the ops: [name, family, weight, run(c) -> what it did, or null (it could not)]; c: { g, u (dice), m (how far), sym, p (the parameters), sliders, budget, arch }
  const OPS = [
    ["hunch", "reshape", 1, reshape_op("hunch", "hunched over")],
    ["long_arms", "reshape", 0.8, reshape_op("long_arms", "lengthened its arms")],
    ["short_arms", "reshape", 0.35, reshape_op("short_arms", "shortened its arms")],
    ["brawn", "reshape", 1, reshape_op("brawn", "thickened its arms and chest")],
    ["lanky", "reshape", 0.7, reshape_op("lanky", "stretched out thin")],
    ["squat", "reshape", 0.6, reshape_op("squat", "squatted on short thick legs")],
    ["big_hands", "reshape", 0.8, reshape_op("big_hands", "grew big hands")],
    ["claws", "reshape", 1, reshape_op("claws", "grew long claws")],
    ["big_head", "reshape", 0.6, reshape_op("big_head", "grew a big head")],
    ["small_head", "reshape", 0.3, reshape_op("small_head", "shrank its head")],
    ["ears", "reshape", 0.9, reshape_op("ears", "grew long ears")],
    ["jaw", "reshape", 0.9, reshape_op("jaw", "grew a heavy jaw")],
    ["digitigrade", "reshape", 1, reshape_op("digitigrade", "stood on the toes (digitigrade legs)")],
    ["thick_legs", "reshape", 0.6, reshape_op("thick_legs", "thickened its legs")],
    ["drift", "reshape", 1.2, function (c) {
      const pool = c.sliders.slice(), n = 1 + Math.floor(c.u() * 3), done = [];
      for (let k = 0; k < n && pool.length; k++) {
        const s = pool.splice(Math.floor(c.u() * pool.length), 1)[0], v = c.p[s.name], span = s.hi - s.lo, d = (c.u() < 0.5 ? -1 : 1) * span * 0.3 * c.m * (0.5 + c.u());
        c.p[s.name] = clamp(v + d, s.lo + 0.1 * span, s.hi - 0.25 * span); done.push(s.name);
      }
      return "drifted " + done.join(", ");
    }],
    ["size", "reshape", 0.6, function (c) { const dir = c.arch && c.arch.size ? c.arch.size : (c.u() < 0.5 ? -1 : 1); c.p.scale = clamp(c.p.scale * Math.pow(dir < 0 ? 0.6 : 1.7, c.m), 0.4, 2.5); c.g.size = c.p.scale; return dir < 0 ? "shrank" : "grew bigger"; }],
    ["muzzle", "push", 1, push_op("muzzle", 0.04, 0.12)],
    ["brow", "push", 0.8, push_op("brow", 0.008, 0.024)],
    ["skull", "push", 0.5, push_op("skull", 0.02, 0.07)],
    ["hump", "swell", 0.8, swell_op("hump")],
    ["dewlap", "swell", 0.5, swell_op("dewlap")],
    ["jowls", "swell", 0.6, swell_op("jowls")],
    ["chest", "swell", 0.6, swell_op("chest")],
    ["tail", "grow", 1.2, grow_op("tail",
      function (c) { return { length: 0.28 + 0.7 * clamp(c.m, 0, 1) * (0.6 + 0.4 * c.u()), r0: between(c, 0.04, 0.075), curl: between(c, -0.8, 0.4), segs: 8 }; },
      function (c, s) { s.length = Math.min(1.1, s.length * (1.15 + 0.4 * c.m)); s.r0 = Math.min(0.1, s.r0 * 1.1); })],
    ["horns", "grow", 1, grow_op("horns",
      function (c) { return { length: 0.07 + 0.18 * clamp(c.m, 0, 1) * (0.6 + 0.4 * c.u()), r0: between(c, 0.02, 0.04), curl: between(c, 0.6, 2.2), bow: between(c, 0.3, 1.6), spread: between(c, 0.25, 0.8), place: c.u() }; },
      function (c, s) { s.length = Math.min(0.26, s.length * (1.15 + 0.4 * c.m)); s.r0 = Math.min(0.05, s.r0 * 1.15); s.curl = clamp(s.curl + 0.2 * c.m, -0.6, 2.4); s.bow = clamp(s.bow + 0.15 * c.m, 0, 2); })],
    ["tusks", "grow", 0.8, grow_op("tusks",
      function (c) { return { length: 0.04 + 0.08 * clamp(c.m, 0, 1) * (0.6 + 0.4 * c.u()), r0: between(c, 0.006, 0.011), curl: between(c, 0.3, 1), bow: between(c, 0.2, 0.9) }; },
      function (c, s) { s.length = Math.min(0.14, s.length * (1.15 + 0.4 * c.m)); s.r0 = Math.min(0.016, s.r0 * 1.12); })],
    ["spines", "grow", 0.7, grow_op("spines",
      function (c) { return { count: 4 + Math.floor(c.u() * 5), height: 0.05 + 0.07 * clamp(c.m, 0, 1), r0: between(c, 0.015, 0.025) }; },
      function (c, s) { s.height = Math.min(0.14, s.height * (1.15 + 0.4 * c.m)); })],
    ["colour", "colour", 0.8, function (c) {
      const list = c.arch && c.arch.colours ? c.arch.colours : Object.keys(TINTS), name = list[Math.floor(c.u() * list.length)], to = TINTS[name], have = c.g.tint, amount = clamp(0.25 + 0.65 * c.m * (0.7 + 0.3 * c.u()), 0, 0.9);
      c.g.tint = have ? { rgb: mix3(have.rgb, to, 0.6), amount: Math.min(0.9, Math.max(have.amount, amount)) } : { rgb: to.slice(), amount: amount };
      return "turned " + name;
    }],
  ];
  // the kinds the dice favour: the weight of an op (the others have 0.2); size: -1 smaller, 1 bigger; colours: the tints to choose from
  const ARCH = {
    reptile: { ops: { hunch: 3, digitigrade: 3, claws: 2, muzzle: 3, tail: 4, spines: 3, jaw: 2, colour: 2, ears: 0.1, brow: 1 }, colours: ["green", "olive", "ochre", "grey"] },
    beast: { ops: { hunch: 3, digitigrade: 3, muzzle: 3, ears: 3, brawn: 2, claws: 2, tail: 2, jaw: 1.5, big_hands: 1.5 }, colours: ["rust", "ash", "grey", "ochre"] },
    demon: { ops: { horns: 4, tail: 3, digitigrade: 3, claws: 2, brawn: 2, ears: 2, colour: 2, jaw: 1, spines: 1.5, chest: 1 }, colours: ["red", "rust", "violet"] },
    brute: { ops: { brawn: 4, big_hands: 3, hump: 3, tusks: 4, jaw: 3, brow: 3, squat: 2, size: 2, thick_legs: 2, small_head: 1, chest: 1.5 }, colours: ["olive", "grey", "ochre"], size: 1 },
    goblin: { ops: { ears: 4, big_head: 3, lanky: 2, claws: 2, size: 3, short_arms: 0.5, tusks: 1, muzzle: 1, colour: 2 }, colours: ["green", "olive", "ochre"], size: -1 },
    ghoul: { ops: { lanky: 4, long_arms: 4, claws: 3, jaw: 2, skull: 1.5, hunch: 2, colour: 2, dewlap: 1 }, colours: ["ash", "grey", "bone"] },
    alien: { ops: { skull: 4, big_head: 3, long_arms: 2, lanky: 3, small_head: 0.1, ears: 0.3, colour: 3, drift: 1.5 }, colours: ["grey", "blue", "violet", "bone"] },
  };
  // what it has become: tags, and a kind from them
  function describe(g, p) {
    const bone = function (n, f, d) { return g.bones[n] ? g.bones[n][f] : d; }, tags = [], tag = function (t, yes) { if (yes) tags.push(t); };
    tag("tailed", g.grow.tail); tag("horned", g.grow.horns); tag("tusked", g.grow.tusks); tag("spined", g.grow.spines);
    tag("snouted", g.push.muzzle >= 0.05); tag("heavy-browed", g.push.brow >= 0.014); tag("long-skulled", g.push.skull >= 0.04);
    tag("humped", g.swell.hump); tag("jowled", g.swell.jowls); tag("dewlapped", g.swell.dewlap); tag("deep-chested", g.swell.chest);
    tag("digitigrade", bone("foot.L", "bend", 0) >= 20); tag("hunched", bone("spine1", "bend", 0) + bone("spine2", "bend", 0) + bone("spine3", "bend", 0) >= 14);
    tag("long-armed", bone("upperarm.L", "length", 1) >= 1.25); tag("clawed", bone("fingers2.L", "length", 1) >= 1.6); tag("big-eared", bone("ear.L", "length", 1) >= 1.8);
    tag("big-headed", bone("head", "length", 1) >= 1.25); tag("brawny", bone("upperarm.L", "girth", 1) >= 1.25); tag("lanky", bone("neck", "length", 1) >= 1.25 && bone("thigh.L", "length", 1) >= 1.15);
    tag("small", p.scale < 0.8); tag("big", p.scale > 1.4);
    const has = function (t) { return tags.indexOf(t) >= 0 ? 1 : 0; }, tint = g.tint ? g.tint.rgb : null, greenish = tint && tint[1] > tint[0] && tint[1] > tint[2] ? 1 : 0, reddish = tint && tint[0] > 0.5 && tint[0] > 1.6 * tint[1] ? 1 : 0;
    const score = {
      reptilian: has("tailed") + has("snouted") + has("digitigrade") + has("clawed") + has("spined") + greenish,
      demonic: 2 * has("horned") + has("tailed") + has("digitigrade") + reddish + has("clawed"),
      brutish: 2 * has("tusked") + has("brawny") + has("humped") + has("heavy-browed") + has("big"),
      goblinoid: 2 * has("big-eared") + has("big-headed") + 2 * has("small") + greenish,
      alien: 2 * has("long-skulled") + has("big-headed") + has("long-armed") + has("lanky"),
      bestial: has("snouted") + has("big-eared") + has("hunched") + has("clawed") + has("digitigrade"),
    };
    let kind = "mutant", best = 2;
    Object.keys(score).forEach(function (k) { if (score[k] > best) { best = score[k]; kind = k; } });
    return { tags: tags, kind: kind };
  }

  // ---- the genes set by hand (spec.genes): bones' length, girth, bend and lean, the pushes, the swellings, the size; each held to its limit, a name that is no bone said in `applied`
  function apply_genes(g, genes, applied, pn) {
    const say = function (what) { applied.push({ op: "genes", family: "genes", what: what, m: 1, done: true }); };
    const bones = genes.bones && typeof genes.bones === "object" ? genes.bones : {};
    Object.keys(bones).forEach(function (key) {
      let v = bones[key];
      if (typeof v === "number") v = { length: v, girth: v };
      if (!v || typeof v !== "object") { say("bone '" + key + "': a factor or { length, girth, bend, lean }: left out"); return; }
      const names = /\.\*$/.test(key) ? [key.replace("*", "L"), key.replace("*", "R")] : [key];
      names.forEach(function (n) {
        const b = gene(g, n);
        ["length", "girth", "bend", "lean"].forEach(function (f) {
          if (v[f] === undefined) return;
          if (typeof v[f] !== "number" || !isFinite(v[f])) { say("bone '" + n + "': " + f + " is a number: left out"); return; }
          const lim = limit_of(n, f); b[f] = clamp(v[f], lim[0], lim[1]);
        });
        say("set " + n + " (length " + b.length + ", girth " + b.girth + ", bend " + b.bend + ", lean " + b.lean + ")");
      });
    });
    if (typeof genes.size === "number" && isFinite(genes.size)) { pn.scale = clamp(pn.scale * genes.size, 0.4, 2.5); g.size = pn.scale; say("size " + g.size); }
    if (genes.push && typeof genes.push === "object") Object.keys(PUSH_MAX).forEach(function (k) { if (typeof genes.push[k] === "number") { g.push[k] = clamp(genes.push[k], 0, PUSH_MAX[k]); say("pushed its " + k + " " + g.push[k]); } });
    if (genes.swell && typeof genes.swell === "object") Object.keys(genes.swell).forEach(function (k) {
      const d = SWELLS[k], v = genes.swell[k];
      if (!d) { say("no swelling '" + k + "' (" + Object.keys(SWELLS).join(", ") + "): left out"); return; }
      if (v === null || v === false) { delete g.swell[k]; return; }
      const r = typeof v.r === "number" ? v.r : d.r[1], h = typeof v.h === "number" ? v.h : d.h[1];
      g.swell[k] = { r: clamp(r, d.r[0] * 0.5, d.r[1] * 1.6), h: clamp(h, 0, d.h[1] * 1.8) }; say("swelled its " + k);
    });
  }

  // ---- the dice, `iterations` times. -> { genome, p (the parameters with what drifted), applied: [{ op, family, what, m }], tags, kind }
  function evolve(api, model, spec, p) {
    const u = dice(spec.seed), g = fresh(), pn = Object.assign({}, p), applied = [], arch = spec.toward ? ARCH[spec.toward] : null;
    const sliders = api.slider_list(model).filter(function (s) { return s.kind === "slider" || s.name === "weight" || s.name === "muscle" || s.name === "height"; });
    const ops = OPS.filter(function (o) { return spec.families.indexOf(o[1]) >= 0; });
    for (let k = 0; k < spec.iterations && ops.length; k++) {
      const weights = ops.map(function (o) { return o[2] * (arch ? (arch.ops[o[0]] !== undefined ? arch.ops[o[0]] : 0.2) : 1); });
      let total = 0; weights.forEach(function (w) { total += w; });
      let x = u() * total, at = ops.length - 1;
      for (let i = 0; i < ops.length; i++) { x -= weights[i]; if (x < 0) { at = i; break; } }
      const op = ops[at], m = clamp(spec.strength * (0.6 + 0.8 * u()), 0, 1);
      const what = op[3]({ g: g, u: u, m: m, sym: spec.symmetric, p: pn, sliders: sliders, budget: spec.budget, arch: arch });
      applied.push({ op: op[0], family: op[1], what: what === null ? "could not (nothing more may grow)" : what, m: round(m, 2), done: what !== null });
    }
    if (spec.genes) apply_genes(g, spec.genes, applied, pn);
    // the genome is finished: a foot that is bent down (the heel up) has its toes bent back by as much (all that the leg bends: the thigh's, the shin's, the foot's), so that they lie as they lie on a person, flat on the floor and the creature stands on them, as a dog does, and not on the tips of them
    ["L", "R"].forEach(function (side) {
      const f = g.bones["foot." + side]; if (!f || f.bend <= 1) return;
      let up = 0; ["thigh.", "shin.", "foot."].forEach(function (n) { const b = g.bones[n + side]; if (b) up += b.bend; });           // (every bend of the leg turns the foot about the same axis: the toes undo them all)
      gene(g, "toe." + side).bend = -up;
    });
    const d = describe(g, pn);
    return { genome: g, p: pn, applied: applied, tags: d.tags, kind: d.kind };
  }

  // ---- the genome made flesh
  const mm = function (a, b) { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[3 * i + j] = a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j]; return o; };
  const mv = function (a, v) { return [a[0] * v[0] + a[1] * v[1] + a[2] * v[2], a[3] * v[0] + a[4] * v[1] + a[5] * v[2], a[6] * v[0] + a[7] * v[1] + a[8] * v[2]]; };
  const rotx = function (a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }, rotz = function (a) { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  const share_of = function (model, names) {                                                             // the share of each vertex's skin that is on these bones
    const mine = {}; model.bones.forEach(function (b, i) { if (names.indexOf(b.name) >= 0) mine[i] = 1; });
    const out = new Float32Array(model.nv);
    for (let i = 0; i < model.nv; i++) { let w = 0; for (let q = 0; q < 4; q++) if (mine[model.skin_indices[4 * i + q]]) w += model.skin_weights[4 * i + q]; out[i] = w / 255; }
    return out;
  };
  const shares = function (model) {
    if (!model.mutate_shares) model.mutate_shares = { head: share_of(model, ["head", "jaw", "eye.L", "eye.R", "lid.L", "lid.R", "ear.L", "ear.R"]), lids: share_of(model, ["lid.L", "lid.R", "eye.L", "eye.R"]) };
    return model.mutate_shares;
  };
  // the face pushed about: a muzzle (the lower face goes forward, narrows and drops a little), a heavy brow, a long skull. A field of vertex motion (Float64Array 3 nv) or null
  function pushes(api, model, rows, g) {
    const k = g.push; if (!(k.muzzle > 0 || k.brow > 0 || k.skull > 0)) return null;
    const nv = model.nv, sh = shares(model), pt = function (n) { return api.point(model, rows, n); }, eye = pt("eye.L.front"), jaw = pt("jaw.head"), ear = pt("ear.L.base"), nose_y = eye[1] - 0.045, dv = new Float64Array(3 * nv);
    for (let v = 0; v < nv; v++) {
      const h = sh.head[v]; if (h < 0.5) continue;
      const x = rows[3 * v], y = rows[3 * v + 1], z = rows[3 * v + 2];
      if (k.muzzle > 0) {
        const f = smooth(jaw[1] - 0.06, nose_y - 0.005, y) * (1 - smooth(eye[1] - 0.025, eye[1] - 0.005, y)) * smooth(eye[2] - 0.05, eye[2] + 0.01, z) * (1 - smooth(0.04, 0.085, Math.abs(x))) * h;       // (below the eyes, in front of the cheeks: a block that goes forward, not a beak)
        dv[3 * v + 2] += k.muzzle * f; dv[3 * v] += x * 0.1 * f * Math.min(1, k.muzzle / 0.1); dv[3 * v + 1] += -0.15 * k.muzzle * f;
      }
      if (k.brow > 0) {
        const f = smooth(eye[1] + 0.012, eye[1] + 0.024, y) * (1 - smooth(eye[1] + 0.034, eye[1] + 0.05, y)) * smooth(eye[2] - 0.03, eye[2], z) * (1 - smooth(0.05, 0.4, sh.lids[v])) * h;
        dv[3 * v + 2] += k.brow * f; dv[3 * v + 1] -= 0.2 * k.brow * f;
      }
      if (k.skull > 0) {
        const f = smooth(ear[2] - 0.0, ear[2] - 0.07, z) * smooth(jaw[1] - 0.02, jaw[1] + 0.1, y) * h;                      // (behind the ears: the back of the skull goes back and up)
        dv[3 * v + 2] -= k.skull * f; dv[3 * v + 1] += 0.2 * k.skull * f;
      }
    }
    return dv;
  }
  // the bones' genes: every vertex goes with its bones as they are made longer, thicker and bent (linear blend skinning of the file's own weights, from the person's bind pose). A bone is its head, its axis and its genes: length is the
  // scale along the axis, girth across it, bend a turn in the body's side view (about x) and lean one in its front view (about z), all about the bone's head, and its children's heads go with it. -> Float64Array 3 nv or null
  // MUSCLES COME WITH THE BONE. A limb's girth is not one number along it: the flesh of a thicker bone is a muscle, a BELLY in the middle of the bone that tapers to the joints (0.35 of it there, 1 in the middle), and a longer bone
  // is thicker as well (its girth times its length to the 0.35: a limb 1.6 times as long has a muscle 1.18 times as thick), so that a limb that grows does not grow thin. The bones that have muscles: the arms, the legs, the spine, the clavicles, the neck.
  const MUSCLE = { upperarm: 1, lowerarm: 1, thigh: 1, shin: 1, spine1: 1, spine2: 1, spine3: 1, clavicle: 1, neck: 1 };
  const BELLY = 0.35, muscle_of = function (name) { return MUSCLE[name.replace(/\.[LR]$/, "")] === 1; };
  function reshape(api, model, rows, g) {
    if (!Object.keys(g.bones).length) return null;
    const B = model.bones, nb = B.length, nv = model.nv, idx = {}; B.forEach(function (b, i) { idx[b.name] = i; });
    const head = [], tail = [], R = new Array(nb), hp = new Array(nb), A = new Float64Array(9 * nb), T = new Float64Array(3 * nb), I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    for (let i = 0; i < nb; i++) { head[i] = api.point(model, rows, B[i].head); tail[i] = api.point(model, rows, B[i].tail); }
    const S = new Array(nb), mus = new Uint8Array(nb), AX = new Array(nb), LB = new Float64Array(nb), GE = new Float64Array(nb), LEN = new Float64Array(nb);
    for (let i = 0; i < nb; i++) {
      const ge = g.bones[B[i].name], y = unit(sub(tail[i], head[i])), ln = ge ? ge.length : 1;
      mus[i] = ge && muscle_of(B[i].name) && (ge.girth !== 1 || ln !== 1) ? 1 : 0;
      const gb = ge ? (mus[i] ? ge.girth * Math.pow(ln, 0.35) : ge.girth) : 1;                              // (the girth in the middle of the bone: the muscle's)
      const gi = mus[i] ? 1 + (gb - 1) * BELLY : gb, gl = ln - gi;                                          // (at the joints: a muscle's tendons)
      AX[i] = y; LB[i] = Math.max(len(sub(tail[i], head[i])), 1e-6); GE[i] = gb; LEN[i] = ln;
      S[i] = [gi + gl * y[0] * y[0], gl * y[0] * y[1], gl * y[0] * y[2], gl * y[1] * y[0], gi + gl * y[1] * y[1], gl * y[1] * y[2], gl * y[2] * y[0], gl * y[2] * y[1], gi + gl * y[2] * y[2]];   // (gi I + gl y y')
      const Rl = ge ? mm(rotx(ge.bend * DEG), rotz(ge.lean * DEG)) : I3, p = B[i].parent === null ? -1 : idx[B[i].parent];
      if (p < 0) { R[i] = Rl; hp[i] = head[i]; } else { R[i] = mm(R[p], Rl); hp[i] = add(hp[p], mv(R[p], mv(S[p], sub(head[i], head[p])))); }
      const Ab = mm(R[i], S[i]), th = mv(Ab, head[i]);
      for (let q = 0; q < 9; q++) A[9 * i + q] = Ab[q];
      T[3 * i] = hp[i][0] - th[0]; T[3 * i + 1] = hp[i][1] - th[1]; T[3 * i + 2] = hp[i][2] - th[2];
    }
    const dv = new Float64Array(3 * nv);
    for (let v = 0; v < nv; v++) {
      const x = rows[3 * v], y = rows[3 * v + 1], z = rows[3 * v + 2]; let ax = 0, ay = 0, az = 0;
      for (let q = 0; q < 4; q++) {
        const w = model.skin_weights[4 * v + q] / 255; if (!w) continue;
        const b = model.skin_indices[4 * v + q];
        if (mus[b]) {                                                                                       // (a muscle: the girth along the bone is a belly, so the scale is of the vertex's place along it)
          const hd = head[b], vx = x - hd[0], vy = y - hd[1], vz = z - hd[2], a = AX[b], yv = vx * a[0] + vy * a[1] + vz * a[2], tt = clamp(yv / LB[b], 0, 1);
          const gt = 1 + (GE[b] - 1) * (BELLY + (1 - BELLY) * Math.sin(Math.PI * tt)), al = LEN[b] - gt, sx = gt * vx + al * yv * a[0], sy = gt * vy + al * yv * a[1], sz = gt * vz + al * yv * a[2], Rb = R[b], hb = hp[b];
          ax += w * (hb[0] + Rb[0] * sx + Rb[1] * sy + Rb[2] * sz); ay += w * (hb[1] + Rb[3] * sx + Rb[4] * sy + Rb[5] * sz); az += w * (hb[2] + Rb[6] * sx + Rb[7] * sy + Rb[8] * sz);
        } else {
          const o = 9 * b;
          ax += w * (A[o] * x + A[o + 1] * y + A[o + 2] * z + T[3 * b]); ay += w * (A[o + 3] * x + A[o + 4] * y + A[o + 5] * z + T[3 * b + 1]); az += w * (A[o + 6] * x + A[o + 7] * y + A[o + 8] * z + T[3 * b + 2]);
        }
      }
      dv[3 * v] = ax - x; dv[3 * v + 1] = ay - y; dv[3 * v + 2] = az - z;
    }
    // THE SKELETON OF THE MESH IT MADE: the vertices go with the bones' transforms, so the bones' own end points are where those transforms put them (exact: a regression of the points on the vertices, joint_reg, was fitted on the file's
    // sliders and is 0.45 mm there, but on a turn of a foot by 40 degrees it turned the foot bone 23 degrees and its toes 16 degrees too few). The exceptions, whose points go with their skin (points_follow): the eyes and the lids (so that an eyeball keeps its size) and the LEGS (the engine's feet solver was tuned on those points: with a leg's exact ones it plants a digitigrade foot 5 cm into the floor)
    const pts = {};
    for (let i = 0; i < nb; i++) {
      if (/^(eye|lid|thigh|shin|foot|toe)\./.test(B[i].name)) continue;
      pts[B[i].head] = hp[i]; pts[B[i].tail] = add(hp[i], mv(R[i], mv(S[i], sub(tail[i], head[i]))));
    }
    dv.pts = pts;
    return dv;
  }
  // a swelling: the flesh within r of `at` goes out, away from `inside`, by h at the middle (a smooth bump)
  function swelling(rows, nv, dv, at, inside, r, h) {
    for (let v = 0; v < nv; v++) {
      const x = rows[3 * v] + dv[3 * v], y = rows[3 * v + 1] + dv[3 * v + 1], z = rows[3 * v + 2] + dv[3 * v + 2], d = Math.hypot(x - at[0], y - at[1], z - at[2]); if (d >= r) continue;
      const f = 1 - smooth(0, r, d), o = unit([x - inside[0], y - inside[1], z - inside[2]]);
      dv[3 * v] += h * f * o[0]; dv[3 * v + 1] += h * f * o[1]; dv[3 * v + 2] += h * f * o[2];
    }
  }
  // the places of the swellings and the way out of each, from the body as it is now: [at, inside]
  // the way is the body's own (a back that is hunched, a neck that is stretched forward): ventral is the belly's side of an axis, x cross the axis (a person's upright axis: forward)
  const ventral = function (a) { const v = cross([1, 0, 0], a); return len(v) > 1e-6 ? unit(v) : [0, 0, 1]; };
  function swell_place(api, model, rows, kind) {
    const pt = function (n) { return api.point(model, rows, n); };
    if (kind === "hump") { const s = pt("spine3.tail"), a = unit(sub(s, pt("hips.tail"))), v = ventral(a); return [sub(sub(s, mul(v, 0.07)), mul(a, 0.035)), sub(add(s, mul(v, 0.1)), mul(a, 0.1))]; }
    if (kind === "dewlap") { const a = pt("spine3.tail"), b = pt("neck.tail"), m = mix3(a, b, 0.55), ax = unit(sub(b, a)), v = ventral(ax); return [add(m, mul(v, 0.055)), sub(add(m, mul(ax, 0.03)), mul(v, 0.12))]; }
    if (kind === "chest") { const a = pt("spine2.tail"), b = pt("spine1.tail"), m = mix3(a, b, 0.5), v = ventral(unit(sub(a, b))); return [add(m, mul(v, 0.085)), sub(m, mul(v, 0.12))]; }
    const j = pt("jaw.head"), c = pt("jaw.tail"), m = mix3(j, c, 0.5);                                   // jowls (two: [at, inside] for the left, the right is its mirror)
    return [add(m, [0.045, -0.01, 0]), add(m, [0, 0.02, -0.03])];
  }
  // ---- THE GROWTHS ARE EXTRUDED FROM THE SKIN. No shell is stuck into the body: a disc of the body's own triangles (round the place where the growth leaves it) is cut out, the loop of vertices that is left, the RIM, is the first ring of the growth
  //   (they are the body's own vertices: they keep the body's skin and colour, and the shading goes smoothly from the body onto the growth because the normals are made of the triangles of both), and rings are made out from it along a path: each
  //   ring goes from the rim's own shape to a round one, and its radius tapers to a tip. The new vertices are skinned to new BONES (a horn two, a tusk two, a spine one, a tail one for each step: the first of them hangs from the host bone) and
  //   graded in colour from the skin's to the horn's. The surface stays one closed surface (a test checks every edge): nothing intersects, nothing is outside it.
  const BLENDS = [0, 0.55, 0.9];                                                                          // (how far ring k has gone from the rim's shape toward a round one)
  function topology(model) {                                                                              // (the triangles of each vertex of the body, once for a model)
    if (model.mutate_topo) return model.mutate_topo;
    const nv = model.nv, nt = model.tris.length / 3, vt = new Array(nv);
    for (let i = 0; i < nv; i++) vt[i] = [];
    for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) vt[model.tris[3 * t + k]].push(t);
    return (model.mutate_topo = { vt: vt, nt: nt });
  }
  // the patch of triangles round vertex v0: every triangle with a vertex that is within `radius` of it by way of triangles (none of them cut out already) -> { tris: [indices], loop: [vertices of its rim, the way the triangles go round it:
  // counter clockwise seen from outside], normal } or null when the rim is not ONE simple loop
  function patch_of(model, rows, v0, radius, taken) {
    const T = topology(model), tris = model.tris, nv = model.nv, p0 = [rows[3 * v0], rows[3 * v0 + 1], rows[3 * v0 + 2]], seen = {}, inp = {}, list = [], stack = [v0];
    seen[v0] = true;
    while (stack.length) {
      const vt = T.vt[stack.pop()];
      for (let q = 0; q < vt.length; q++) {
        const t = vt[q]; if (inp[t]) continue;
        if (taken[t]) return null;
        inp[t] = true; list.push(t);
        for (let k = 0; k < 3; k++) { const w = tris[3 * t + k]; if (!seen[w] && Math.hypot(rows[3 * w] - p0[0], rows[3 * w + 1] - p0[1], rows[3 * w + 2] - p0[2]) <= radius) { seen[w] = true; stack.push(w); } }
      }
    }
    const edge = {}, next = {}; let nb = 0, bad = false, nx = 0, ny = 0, nz = 0;
    list.forEach(function (t) { const a = tris[3 * t], b = tris[3 * t + 1], c = tris[3 * t + 2]; edge[a * nv + b] = true; edge[b * nv + c] = true; edge[c * nv + a] = true; });
    list.forEach(function (t) {
      const a = tris[3 * t], b = tris[3 * t + 1], c = tris[3 * t + 2];
      [[a, b], [b, c], [c, a]].forEach(function (e) { if (!edge[e[1] * nv + e[0]]) { if (next[e[0]] !== undefined) bad = true; next[e[0]] = e[1]; nb++; } });
      const ux = rows[3 * b] - rows[3 * a], uy = rows[3 * b + 1] - rows[3 * a + 1], uz = rows[3 * b + 2] - rows[3 * a + 2], vx = rows[3 * c] - rows[3 * a], vy = rows[3 * c + 1] - rows[3 * a + 1], vz = rows[3 * c + 2] - rows[3 * a + 2];
      nx += uy * vz - uz * vy; ny += uz * vx - ux * vz; nz += ux * vy - uy * vx;
    });
    if (bad || nb < 3) return null;
    const first = +Object.keys(next)[0], loop = [first]; let v = next[first];
    while (v !== first && loop.length <= nb) { loop.push(v); v = next[v]; if (v === undefined) return null; }
    if (v !== first || loop.length !== nb) return null;
    return { tris: list, loop: loop, normal: [nx, ny, nz] };
  }
  // the path of a growth: from `start`, going `dir`, `length` long in `n` steps, turning as it goes: about x (curl: radians for 0.3 m; positive turns the tip up and toward the front) and about z (bow: the tip turns in toward the middle
  // line, for the side `side`: a horn that sweeps out and then in)
  function trail(start, dir, length, n, curl, bow, side) {
    const pts = [start]; let d = unit(dir), p = start;
    for (let i = 0; i < n; i++) {
      const a = curl * (length / n) / 0.3, c = Math.cos(a), s = Math.sin(a); d = unit([d[0], d[1] * c - d[2] * s, d[1] * s + d[2] * c]);
      const b = (side || 0) * (bow || 0) * (length / n) / 0.3, cb = Math.cos(b), sb = Math.sin(b); d = unit([d[0] * cb - d[1] * sb, d[0] * sb + d[1] * cb, d[2]]);
      p = add(p, mul(d, length / n)); pts.push(p);
    }
    return pts;
  }
  const held_turn = function (curl, length, most) { const turn = Math.abs(curl * length / 0.3); return turn > most ? curl * most / turn : curl; };     // (radians a growth turns in all: most)
  // where a growth leaves the body: the outermost vertex of the body that a ray from `start` along `d` passes near (within a growth's own width), else the vertex nearest to a point 3 cm along it
  function emerge(rows, nv, start, d, r0, length) {
    let best = -1, bt = -1e9; const reach = Math.pow(2.2 * r0 + 0.012, 2);
    for (let v = 0; v < nv; v++) {
      const x = rows[3 * v] - start[0], y = rows[3 * v + 1] - start[1], z = rows[3 * v + 2] - start[2], t = x * d[0] + y * d[1] + z * d[2];
      if (t < 0 || t > 0.6 * length + 0.04) continue;
      const px = x - d[0] * t, py = y - d[1] * t, pz = z - d[2] * t, off = px * px + py * py + pz * pz;
      if (off <= reach && t - 2.5 * Math.sqrt(off) > bt) { bt = t - 2.5 * Math.sqrt(off); best = v; }                // (far along the way, and near the axis)
    }
    if (best >= 0) return best;
    const at = add(start, mul(d, 0.03)); let bd = 1e18;
    for (let v = 0; v < nv; v++) { const q = Math.pow(rows[3 * v] - at[0], 2) + Math.pow(rows[3 * v + 1] - at[1], 2) + Math.pow(rows[3 * v + 2] - at[2], 2); if (q < bd) { bd = q; best = v; } }
    return best;
  }
  // THE EXTRUSION. o: { v0 (the vertex it leaves the body at), dir, length, n (steps), curl, bow, side, rim (how wide the rim is: metres), mmin, mmax (the rim's size in vertices), tip (the tip's radius, a share of the rim's), power (the
  // taper), host (the bone it hangs from), names (its bones, root to tip) } -> { pos (the new vertices: ring 1 .. n, then the tip), tris (indices: a number >= 0 is a new vertex, a number < 0 is the body's vertex -1 - it: the rim), u (0 at ring 1,
  // 1 at the tip), skin (for each new vertex [[bone, weight]]), bones, cut (the body's triangles that are given up), rim } or null (no rim that is one loop: nothing grows)
  function extrude(model, rows, taken, o) {
    const nv = model.nv; let found = null, last = null;
    const p0 = [rows[3 * o.v0], rows[3 * o.v0 + 1], rows[3 * o.v0 + 2]];
    for (let radius = 0; radius <= 0.1; radius += 0.003) {                                                  // (from the fan of one vertex, wider and wider: the first rim that is as wide as the growth is, and has vertices enough to go round)
      const pa = patch_of(model, rows, o.v0, radius, taken); if (!pa) continue;
      if (pa.loop.length > o.mmax) break;
      let mean = 0; pa.loop.forEach(function (v) { mean += Math.hypot(rows[3 * v] - p0[0], rows[3 * v + 1] - p0[1], rows[3 * v + 2] - p0[2]) / pa.loop.length; });
      last = pa; if (pa.loop.length >= o.mmin && mean >= o.rim) { found = pa; break; }
    }
    found = found || last; if (!found || found.loop.length < 5) return null;
    const loop = found.loop.slice(), M = loop.length, P = function (v) { return [rows[3 * v], rows[3 * v + 1], rows[3 * v + 2]]; };
    let c = [0, 0, 0]; loop.forEach(function (v) { c = add(c, P(v)); }); c = mul(c, 1 / M);
    const lean = o.lean === undefined ? 0.5 : o.lean, nav = unit(found.normal); let d0 = unit(add(mul(nav, lean), mul(unit(o.dir), 1 - lean))); if (dot(d0, nav) < 0.25) d0 = unit(add(d0, mul(nav, 0.25 - dot(d0, nav))));                 // (it leaves along the skin's normal, turned toward where it is going, and never into the body: at least a quarter of it goes out of the skin)
    const ref = Math.abs(d0[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], nn0 = unit(cross(ref, d0)), bb0 = cross(d0, nn0);
    const wrap = function (a) { while (a <= -Math.PI) a += 2 * Math.PI; while (a > Math.PI) a -= 2 * Math.PI; return a; };
    const angles = function () { return loop.map(function (v) { const r = sub(P(v), c); return Math.atan2(dot(r, bb0), dot(r, nn0)); }); };
    let th = angles(), turn = 0; for (let j = 0; j < M; j++) turn += wrap(th[(j + 1) % M] - th[j]);
    if (turn < 0) { loop.reverse(); th = angles(); }                                                       // (the rim goes round the way the rings do)
    const inc = []; let isum = 0; for (let j = 0; j < M; j++) { const a = wrap(th[(j + 1) % M] - th[j]); inc.push(a > 0.05 ? a : 0.05); isum += inc[j]; }
    const theta = [th[0]]; for (let j = 0; j < M - 1; j++) theta.push(theta[j] + inc[j] * 2 * Math.PI / isum);      // (one turn, every step forward: the rings cannot fold)
    const rho = loop.map(function (v) { const r = sub(P(v), c); return Math.hypot(dot(r, nn0), dot(r, bb0)); });
    let rbar = 0; rho.forEach(function (x) { rbar += x / M; });
    if (!(rbar > 1e-4) || !rho.every(isFinite) || !isFinite(c[0] + c[1] + c[2])) return null;
    const n = o.n, path = trail(c, d0, o.length, n, o.curl, o.bow, o.side), R = [], R1 = 0.92 * rbar, rt = o.tip * rbar;
    for (let k = 1; k <= n; k++) R[k] = rt + (R1 - rt) * Math.pow(n > 1 ? 1 - (k - 1) / (n - 1) : 1, o.power);
    const pos = [], u = [], tris = [], ring = function (k) { return (k - 1) * M; }; let nn = nn0;
    for (let k = 1; k <= n; k++) {
      const t = unit(sub(path[Math.min(n, k + 1)], path[k - 1]));
      nn = sub(nn, mul(t, dot(nn, t))); nn = len(nn) > 1e-6 ? unit(nn) : unit(cross(ref, t));
      const bb = cross(t, nn), s = BLENDS[k] === undefined ? 1 : BLENDS[k];
      for (let j = 0; j < M; j++) { const r = rho[j] + (R[k] - rho[j]) * s; pos.push(add(path[k], add(mul(nn, r * Math.cos(theta[j])), mul(bb, r * Math.sin(theta[j]))))); u.push(n > 1 ? (k - 1) / (n - 1) : 0); }
    }
    pos.push(add(path[n], mul(unit(sub(path[n], path[n - 1])), Math.max(1.5 * R[n], 0.004)))); u.push(1);
    const tip = n * M;
    for (let j = 0; j < M; j++) { const j1 = (j + 1) % M; tris.push(-1 - loop[j], -1 - loop[j1], j, -1 - loop[j1], j1, j); }               // (the rim to the first ring; the triangles face outward as the body's do)
    for (let k = 1; k < n; k++) for (let j = 0; j < M; j++) { const j1 = (j + 1) % M; tris.push(ring(k) + j, ring(k) + j1, ring(k + 1) + j, ring(k) + j1, ring(k + 1) + j1, ring(k + 1) + j); }
    for (let j = 0; j < M; j++) tris.push(ring(n) + j, ring(n) + (j + 1) % M, tip);
    const m = o.names.length, skin = [];
    const skin_of = function (k) {                                                                          // (the host and the bones: each a hat over its own stretch of the path, so a vertex goes from one to the next)
      const sk = k * m / n, w = {}; let tot = 0; w[o.host] = Math.max(0, 1 - Math.abs(sk + 0.5));
      for (let i = 0; i < m; i++) w[o.names[i]] = Math.max(0, 1 - Math.abs(sk - (i + 0.5)));
      Object.keys(w).forEach(function (b) { tot += w[b]; });
      return Object.keys(w).filter(function (b) { return w[b] > 1e-6; }).map(function (b) { return [b, w[b] / tot]; });
    };
    for (let k = 1; k <= n; k++) { const e = skin_of(k); for (let j = 0; j < M; j++) skin.push(e); }
    skin.push([[o.names[m - 1], 1]]);
    const bones = o.names.map(function (nm, i) { return { name: nm, parent: i === 0 ? o.host : o.names[i - 1], head: path[Math.round(i * n / m)], tail: path[Math.round((i + 1) * n / m)] }; });
    return { pos: pos, tris: tris, u: u, skin: skin, bones: bones, cut: found.tris, rim: M };
  }
  // the growths, from the body as it is now. A piece: { name, colour: "skin" | "horn", pos, tris, u, skin, bones, chain, cut (the body's triangles given up), rims }
  function growths(api, model, rows, g) {
    const pt = function (n) { return api.point(model, rows, n); }, nv = model.nv, pieces = [], taken = {};
    // a growth brings the muscle that moves it: the flesh round its root swells (a bump of the body's own vertices, away from inside, as wide as 3 of its roots and as high as half of one) BEFORE the rim is taken, so the rim is on it
    const muscle = function (v0, dir, r0, k) {
      const R = Math.min(0.15, 3 * r0 + k), h = Math.min(0.025, 0.5 * r0), p0 = [rows[3 * v0], rows[3 * v0 + 1], rows[3 * v0 + 2]], inside = sub(p0, mul(unit(dir), 0.8 * R));
      for (let v = 0; v < nv; v++) {
        const d = Math.hypot(rows[3 * v] - p0[0], rows[3 * v + 1] - p0[1], rows[3 * v + 2] - p0[2]); if (d >= R) continue;
        const f = h * (1 - smooth(0, R, d)), o = unit([rows[3 * v] - inside[0], rows[3 * v + 1] - inside[1], rows[3 * v + 2] - inside[2]]);
        rows[3 * v] += f * o[0]; rows[3 * v + 1] += f * o[1]; rows[3 * v + 2] += f * o[2];
      }
    };
    const make = function (o) { if (o.bulge !== undefined) muscle(o.v0, o.dir, o.bulge.r0, o.bulge.k); const e = extrude(model, rows, taken, o); if (e) e.cut.forEach(function (t) { taken[t] = true; }); return e; };
    const join = function (list) {                                                                          // (a pair made one piece)
      const o = { pos: [], tris: [], u: [], skin: [], bones: [], rims: [], cut: [] };
      list.forEach(function (e) { const base = o.pos.length; e.pos.forEach(function (q) { o.pos.push(q); }); e.tris.forEach(function (i) { o.tris.push(i >= 0 ? i + base : i); }); e.u.forEach(function (x) { o.u.push(x); }); e.skin.forEach(function (x) { o.skin.push(x); }); e.bones.forEach(function (x) { o.bones.push(x); }); o.rims.push(e.rim); e.cut.forEach(function (x) { o.cut.push(x); }); });
      return o;
    };
    const tl = g.grow.tail;
    if (tl) {
      // THE LOWER BACK: the tail grows from the base of the spine, where the sacrum is (a hand's breadth under the waist, above the buttocks: a little over halfway from the hips' joint to the top of the hips bone), at the back of the body on the middle line,
      // going back and a little up so that it clears the buttocks, and then it droops
      const n = tl.segs, hh = pt("hips.head"), ht = pt("hips.tail"), yt = hh[1] + 0.6 * (ht[1] - hh[1]), dir = unit([0, 0.1, -1]), names = [];
      for (let i = 0; i < n; i++) names.push("tail." + i);
      let sacrum = -1;
      for (let v = 0; v < nv; v++) if (Math.abs(rows[3 * v]) < 0.025 && Math.abs(rows[3 * v + 1] - yt) < 0.015 && (sacrum < 0 || rows[3 * v + 2] < rows[3 * sacrum + 2])) sacrum = v;
      const e = make({ v0: sacrum >= 0 ? sacrum : emerge(rows, nv, add(hh, [0, 0.02, -0.07]), dir, tl.r0, tl.length), dir: dir, length: tl.length, n: n, curl: held_turn(tl.curl, tl.length, 1.6), bow: 0, side: 0, rim: 0.8 * tl.r0, mmin: MINRIM.tail, mmax: MAXRIM.tail, tip: 0.12, power: 0.9, host: "hips", names: names, bulge: { r0: tl.r0, k: 0.03 } });
      if (e) {
        const o = join([e]), hz = clamp(3.4 / Math.sqrt(Math.max(tl.length, 0.1) / 0.5), 1.2, 6);
        pieces.push({ name: "tail", colour: "skin", pos: o.pos, tris: o.tris, u: o.u, skin: o.skin, bones: o.bones, rims: o.rims, cut: o.cut, chain: { bones: names, hz: round(hz, 3), damping: 0.35, gravity: 1, inertia: 1.1, limit: 0.7, sway: 0.03, falloff: 0.25 } });
      }
    }
    const pair = function (name, kind, host, starts, dirs, o) {                                              // (horns and tusks: one on each side)
      const list = [];
      [1, -1].forEach(function (s, i) {
        const st = starts(s), dr = dirs(s), nm = [kind + "_" + (s > 0 ? "l" : "r") + ".0", kind + "_" + (s > 0 ? "l" : "r") + ".1"];
        const e = make(Object.assign({ v0: emerge(rows, nv, st, dr, o.r0, o.length), dir: dr, side: s, host: host, names: nm, bulge: { r0: o.r0, k: 0.02 } }, o.make(s)));
        if (e) list.push(e);
      });
      if (list.length) { const j = join(list); pieces.push({ name: name, colour: "horn", pos: j.pos, tris: j.tris, u: j.u, skin: j.skin, bones: j.bones, rims: j.rims, cut: j.cut, chain: null }); }
    };
    const hn = g.grow.horns;
    if (hn) {
      const top = pt("head.tail"), eye = pt("eye.L.head"), x0 = 0.95 * Math.abs(eye[0]);
      pair("horns", "horn", "head", function (s) { return [s * x0, top[1] - 0.03 - 0.03 * hn.place, eye[2] - 0.05 + 0.06 * hn.place]; }, function (s) { return unit([s * hn.spread, 1, -0.35]); },
        { r0: hn.r0, length: hn.length, make: function () { return { length: hn.length, n: RINGS.horns, curl: held_turn(hn.curl, hn.length, 2.2), bow: held_turn(hn.bow, hn.length, 2), rim: 0.8 * hn.r0, mmin: MINRIM.horns, mmax: MAXRIM.horns, tip: 0.08, power: 1 }; } });
    }
    const tk = g.grow.tusks;
    if (tk) {
      const m = pt("eye.L.front");
      pair("tusks", "tusk", "jaw", function (s) { return [s * 0.03, m[1] - 0.092, m[2] - 0.004]; }, function (s) { return unit([s * 0.5, 1, 0.4]); },
        { r0: tk.r0, length: tk.length, make: function () { return { length: tk.length, n: RINGS.tusks, curl: held_turn(tk.curl, tk.length, 1.6), bow: held_turn(tk.bow, tk.length, 1.6), rim: 0.8 * tk.r0, mmin: MINRIM.tusks, mmax: MAXRIM.tusks, tip: 0.08, power: 1, lean: 0.15 }; } });
    }
    const sp = g.grow.spines;
    if (sp) {
      const a = pt("hips.tail"), b = pt("neck.tail"), ys = [pt("spine1.tail")[1], pt("spine2.tail")[1]], list = [];
      for (let i = 0; i < sp.count; i++) {
        const f = 0.1 + 0.85 * i / Math.max(1, sp.count - 1), y = a[1] + (b[1] - a[1]) * f;
        let back = -1;                                                                                      // the back of the body at that height: the vertex farthest behind, near the middle line
        for (let v = 0; v < nv; v++) if (Math.abs(rows[3 * v]) < 0.025 && Math.abs(rows[3 * v + 1] - y) < 0.02 && (back < 0 || rows[3 * v + 2] < rows[3 * back + 2])) back = v;
        if (back < 0) continue;
        const dir = unit([0, 0.35 + 0.3 * f, -1]), h = sp.height * (0.7 + 0.3 * Math.sin(Math.PI * f)), host = y < ys[0] ? "spine1" : y < ys[1] ? "spine2" : "spine3";
        const e = make({ v0: back, dir: dir, length: h, n: RINGS.spines, curl: -0.8, bow: 0, side: 0, rim: 0.8 * sp.r0, mmin: MINRIM.spines, mmax: MAXRIM.spines, tip: 0.1, power: 1, host: host, names: ["dorsal." + i], bulge: { r0: sp.r0, k: 0.015 } });
        if (e) list.push(e);
      }
      if (list.length) { const j = join(list); pieces.push({ name: "spines", colour: "horn", pos: j.pos, tris: j.tris, u: j.u, skin: j.skin, bones: j.bones, rims: j.rims, cut: j.cut, chain: null }); }
    }
    return pieces;
  }
  function express(api, model, rows0, g) {
    const nv = model.nv, np = model.np; let rows = Float32Array.from(rows0);
    const move_by = function (dv) {                                                                      // a field of the vertices' motion: the vertices move, the points follow the flesh
      const pd = api.points_follow(model, dv), out = Float32Array.from(rows);
      for (let i = 0; i < 3 * nv; i++) out[i] += dv[i];
      for (let j = 0; j < 3 * np; j++) out[3 * nv + j] += pd[j];
      rows = out;
    };
    const dp = pushes(api, model, rows, g); if (dp) move_by(dp);                                         // (the face first, on the person: the bones then carry it)
    const dr = reshape(api, model, rows, g);
    if (dr) { move_by(dr); Object.keys(dr.pts).forEach(function (name) { const r = model.pt[name]; if (r !== undefined) { rows[3 * r] = dr.pts[name][0]; rows[3 * r + 1] = dr.pts[name][1]; rows[3 * r + 2] = dr.pts[name][2]; } }); }
    const sw = Object.keys(g.swell), tissue = [];
    if (sw.length) {
      const ds = new Float64Array(3 * nv), places = [];
      sw.forEach(function (k) {
        const s = g.swell[k], pl = swell_place(api, model, rows, k);
        swelling(rows, nv, ds, pl[0], pl[1], s.r, s.h);
        if (k === "jowls") swelling(rows, nv, ds, [-pl[0][0], pl[0][1], pl[0][2]], [-pl[1][0], pl[1][1], pl[1][2]], s.r, s.h);
        places.push([k, pl, s]);
      });
      move_by(ds);
      // each swelling asks the engine's tissue module for a soft bone IN it, and says where (a point of the skin there, the way out of it, how far it reaches): the module guesses the place of a kind that is for a level trunk on an upright body, and says so
      const skin_near = function (at) {
        let best = 0, bd = 1e9;
        for (let v = 0; v < nv; v++) { const d = Math.pow(rows[3 * v] - at[0], 2) + Math.pow(rows[3 * v + 1] - at[1], 2) + Math.pow(rows[3 * v + 2] - at[2], 2); if (d < bd) { bd = d; best = v; } }
        return [rows[3 * best], rows[3 * best + 1], rows[3 * best + 2]];
      };
      places.forEach(function (e) {
        if (e[0] === "jowls") {                                                                          // (a bone on the head has no twin: one request for each side)
          [1, -1].forEach(function (s) { const at = skin_near([s * e[1][0][0], e[1][0][1], e[1][0][2]]); tissue.push({ kind: SWELLS.jowls.tissue, at: at, dir: unit(sub(at, [s * e[1][1][0], e[1][1][1], e[1][1][2]])), radius: 1.3 * e[2].r, mirror: false }); });
          return;
        }
        const skin = skin_near(e[1][0]);
        tissue.push({ kind: SWELLS[e[0]].tissue, at: skin, dir: unit(sub(skin, e[1][1])), radius: 1.3 * e[2].r });
      });
    }
    const pieces = growths(api, model, rows, g);
    const cuts = []; pieces.forEach(function (pc) { pc.cut.forEach(function (t) { cuts.push(t); }); });
    return { rows: rows, pieces: pieces, cuts: cuts, tissue: tissue, tint: g.tint };
  }
  // the colour of a horn, a tusk, a spine at u along it (0 the root, 1 the tip): the skin's where it leaves the skin, a dark horn a third of the way, a pale tip
  const HORN_ROOT = [0.34, 0.25, 0.18], HORN_TIP = [0.9, 0.86, 0.74];
  const horn_colour = function (u, skin) { return u < 0.3 ? mix3(skin, HORN_ROOT, smooth(0, 0.3, u)) : mix3(HORN_ROOT, HORN_TIP, smooth(0.3, 1, u)); };
  // a colour with the tint on it: toward the tint's colour at the colour's own lightness (so the lips, the flush and the knees still show)
  function tinted(tint, c) {
    if (!tint || !(tint.amount > 0)) return c;
    const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], tl = 0.2126 * tint.rgb[0] + 0.7152 * tint.rgb[1] + 0.0722 * tint.rgb[2], k = lum / (tl || 1);
    return mix3(c, [clamp(tint.rgb[0] * k, 0, 1), clamp(tint.rgb[1] * k, 0, 1), clamp(tint.rgb[2] * k, 0, 1)], tint.amount);
  }
  return { clean: clean, evolve: evolve, express: express, tinted: tinted, horn_colour: horn_colour, topology: topology, FAMILIES: FAMILIES, ARCHETYPES: ARCHETYPES, OPS: OPS.map(function (o) { return { name: o[0], family: o[1] }; }), MAX_ITER: MAX_ITER, LIM: LIM, PUSH_MAX: PUSH_MAX, BUDGET_TRIS: BUDGET_TRIS, BUDGET_BONES: BUDGET_BONES, TINTS: TINTS };
});

// ========================================================================================================================
// human_lite_wear
// ========================================================================================================================
packing()("human_lite_wear", function human_lite_wear() {
  "use strict";
  // HUMAN LITE WEAR: what a lite person wears, made of her own body (pure: no engine, no GL, no system; plain arrays in, plain objects out). Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no classes. NOTHING IS LOADED:
  // a garment is a piece of the person's own surface, cut out by a field, pushed out along the skin's normals by the thickness of the cloth and the ease of the cut, and given the skin weights of the vertices it was cut from, so it moves with her bones
  // (and with her soft tissue: the tissue module carves the weights of every vertex of the mesh near its bone, the cloth's too).
  //
  //   THE BODY (shared with the hair, human_lite_hair.js):
  //   const B = W.body(model, P, tris)          P: the person's vertices in the model's frame (Float32Array, 3 a vertex, metres), tris: the triangles that are left of her surface; B.N the unit normals (area weighted), B.nearest(x, y, z) -> the vertex that is
  //                                              nearest, B.signed(x, y, z) -> { d, v } (d < 0 inside the skin, near it), B.push_out(p, margin) (a point of [x, y, z] is moved out of the skin), B.ray(o, dir, tmax) -> the distance to the first triangle, or Infinity
  //   const A = W.anchors(model, rows)          the person's joints and levels: { arm: { L, R: { sh, el, wr, u, f, lu, lf } }, leg: { L, R: { hip, knee, ankle, t, s, lt, ls } }, y: { hips, waist, chest, shoulder, neck, head, crotch, sole, top }, bones: {...} }
  //   W.clip(B, field, opts) -> a SHELL: the triangles of the body where the field is >= 0, the ones the zero line goes through cut at it (the cut is a line of new vertices on the edges, exactly where the field is 0), each vertex with the body's skin weights, the normal
  //                              and a place on the body (`at`) it is pushed out from (`W.finish` makes the piece of it)
  //   W.garment(ctx, spec) / W.dress(ctx, list) -> pieces: a garment is a kind (tshirt, shirt, jacket, trousers, shorts, boots ...) with a colour; THE PIECE CONTRACT (what build() of human_lite takes of anything that is worn or grown on a body):
  //        { name, part ("clothes" | "shoes" | "hair" ...: the mesh's part, the variants' dyes name it), pos: Float32Array (3 a vertex, the model's frame), tris: Int32Array (local indices), skin_bone: Int16Array (4 a vertex: a bone of the model, or -1 - k for the k-th of
  //          `bones`), skin_w: Float32Array (4 a vertex, sum 1), colors: Float32Array (3 a vertex), rough: number (the roughness, 0 .. 1), bones: [{ name, parent, head, tail }] (the bones this piece brings: a lock of hair that swings), chain: { bones: [names] } (a spring chain),
  //          cover: Uint8Array over the BODY's vertices (1: the cloth is over it: a triangle of the body whose three vertices are covered is not drawn) }
  const clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  const smooth = function (a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }, add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }, mul = function (a, k) { return [a[0] * k, a[1] * k, a[2] * k]; };
  const dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }, cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  const len = function (a) { return Math.sqrt(dot(a, a)); }, unit = function (a) { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp = function (a, b, t) { return a + (b - a) * t; };
  const BIG = 0.3;                                                                                      // (metres: how far a bone's margin goes; what a bone "is not covered" or "is covered" is worth in the field)

  // ---- THE BODY: normals, a grid of its vertices (the nearest, the side of the skin a point is on), a grid of its triangles (rays)
  function normals_of(P, tris, n) {
    const N = new Float32Array(3 * n);
    for (let t = 0; t < tris.length; t += 3) {
      const a = 3 * tris[t], b = 3 * tris[t + 1], c = 3 * tris[t + 2];
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      N[a] += nx; N[a + 1] += ny; N[a + 2] += nz; N[b] += nx; N[b + 1] += ny; N[b + 2] += nz; N[c] += nx; N[c + 1] += ny; N[c + 2] += nz;
    }
    for (let i = 0; i < n; i++) { const l = Math.sqrt(N[3 * i] * N[3 * i] + N[3 * i + 1] * N[3 * i + 1] + N[3 * i + 2] * N[3 * i + 2]) || 1; N[3 * i] /= l; N[3 * i + 1] /= l; N[3 * i + 2] /= l; }
    return N;
  }
  function body(model, P, tris) {
    const n = model.nv, N = normals_of(P, tris, n), B = { model: model, n: n, P: P, N: N, tris: tris };
    const CELL = 0.04;
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { const v = P[3 * i + c]; if (v < lo[c]) lo[c] = v; if (v > hi[c]) hi[c] = v; }
    B.lo = lo; B.hi = hi;
    const dim = [Math.max(1, Math.ceil((hi[0] - lo[0]) / CELL) + 1), Math.max(1, Math.ceil((hi[1] - lo[1]) / CELL) + 1), Math.max(1, Math.ceil((hi[2] - lo[2]) / CELL) + 1)];
    const cell_of = function (x, y, z) { return [clamp(Math.floor((x - lo[0]) / CELL), 0, dim[0] - 1), clamp(Math.floor((y - lo[1]) / CELL), 0, dim[1] - 1), clamp(Math.floor((z - lo[2]) / CELL), 0, dim[2] - 1)]; };
    const key = function (i, j, k) { return (i * dim[1] + j) * dim[2] + k; };
    const vgrid = new Map();
    for (let v = 0; v < n; v++) { const c = cell_of(P[3 * v], P[3 * v + 1], P[3 * v + 2]), k = key(c[0], c[1], c[2]); let l = vgrid.get(k); if (!l) { l = []; vgrid.set(k, l); } l.push(v); }
    // the vertex that is nearest to a point (a search that widens ring by ring while nothing is found, then once more: the nearest of a ring may be beaten by one of the next)
    B.nearest = function (x, y, z) {
      const c = cell_of(x, y, z); let best = -1, bd = 1e18, found_at = -1;
      for (let r = 0; r < 8; r++) {
        for (let i = c[0] - r; i <= c[0] + r; i++) for (let j = c[1] - r; j <= c[1] + r; j++) for (let k = c[2] - r; k <= c[2] + r; k++) {
          if (Math.max(Math.abs(i - c[0]), Math.abs(j - c[1]), Math.abs(k - c[2])) !== r) continue;
          if (i < 0 || j < 0 || k < 0 || i >= dim[0] || j >= dim[1] || k >= dim[2]) continue;
          const l = vgrid.get(key(i, j, k)); if (!l) continue;
          for (let q = 0; q < l.length; q++) { const v = l[q], dx = P[3 * v] - x, dy = P[3 * v + 1] - y, dz = P[3 * v + 2] - z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = v; } }
        }
        if (best >= 0 && found_at < 0) found_at = r;
        if (found_at >= 0 && r > found_at) break;
      }
      return best;
    };
    B.signed = function (x, y, z) {
      const v = B.nearest(x, y, z); if (v < 0) return { d: 1, v: -1 };
      const dx = x - P[3 * v], dy = y - P[3 * v + 1], dz = z - P[3 * v + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz), side = dx * N[3 * v] + dy * N[3 * v + 1] + dz * N[3 * v + 2];
      return { d: side >= 0 ? d : -d, v: v };
    };
    B.push_out = function (p, margin) {
      for (let it = 0; it < 5; it++) {
        const s = B.signed(p[0], p[1], p[2]); if (s.v < 0 || s.d >= margin) return p;
        const k = margin - s.d; p[0] += N[3 * s.v] * k; p[1] += N[3 * s.v + 1] * k; p[2] += N[3 * s.v + 2] * k;
      }
      return p;
    };
    // the triangles in a grid (made when a ray is first cast)
    let tgrid = null;
    const TC = 0.05;
    const tgrid_make = function () {
      tgrid = new Map();
      const dm = [Math.ceil((hi[0] - lo[0]) / TC) + 1, Math.ceil((hi[1] - lo[1]) / TC) + 1, Math.ceil((hi[2] - lo[2]) / TC) + 1];
      tgrid.dm = dm; tgrid.key = function (i, j, k) { return (i * dm[1] + j) * dm[2] + k; };
      for (let t = 0; t < tris.length; t += 3) {
        const a = 3 * tris[t], b = 3 * tris[t + 1], c = 3 * tris[t + 2];
        const mn = [Math.min(P[a], P[b], P[c]), Math.min(P[a + 1], P[b + 1], P[c + 1]), Math.min(P[a + 2], P[b + 2], P[c + 2])], mx = [Math.max(P[a], P[b], P[c]), Math.max(P[a + 1], P[b + 1], P[c + 1]), Math.max(P[a + 2], P[b + 2], P[c + 2])];
        const i0 = Math.floor((mn[0] - lo[0]) / TC), i1 = Math.floor((mx[0] - lo[0]) / TC), j0 = Math.floor((mn[1] - lo[1]) / TC), j1 = Math.floor((mx[1] - lo[1]) / TC), k0 = Math.floor((mn[2] - lo[2]) / TC), k1 = Math.floor((mx[2] - lo[2]) / TC);
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) { const q = tgrid.key(i, j, k); let l = tgrid.get(q); if (!l) { l = []; tgrid.set(q, l); } l.push(t); }
      }
    };
    const seen_t = new Int32Array(tris.length / 3 + 1); let ray_mark = 0;
    B.ray = function (o, d, tmax) {
      if (!tgrid) tgrid_make();
      let best = Infinity; const steps = Math.ceil(tmax / (TC * 0.5)), mark = ++ray_mark;
      for (let s = 0; s <= steps; s++) {
        const t = Math.min(tmax, s * TC * 0.5), x = o[0] + d[0] * t, y = o[1] + d[1] * t, z = o[2] + d[2] * t;
        const i = Math.floor((x - lo[0]) / TC), j = Math.floor((y - lo[1]) / TC), k = Math.floor((z - lo[2]) / TC);
        const l = tgrid.get(tgrid.key(i, j, k)); if (!l) continue;
        for (let q = 0; q < l.length; q++) {
          const tt = l[q]; if (seen_t[tt / 3] === mark) continue; seen_t[tt / 3] = mark;
          const a = 3 * tris[tt], b = 3 * tris[tt + 1], c = 3 * tris[tt + 2];
          const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
          const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x, det = e1x * px + e1y * py + e1z * pz;
          if (Math.abs(det) < 1e-12) continue;
          const inv = 1 / det, tx = o[0] - P[a], ty = o[1] - P[a + 1], tz = o[2] - P[a + 2], u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
          const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (v < 0 || u + v > 1) continue;
          const th = (e2x * qx + e2y * qy + e2z * qz) * inv; if (th > 1e-5 && th < best) best = th;
        }
      }
      return best <= tmax ? best : Infinity;
    };
    return B;
  }

  // ---- THE PERSON'S LEVELS AND LIMBS, from her points (model frame, rows: the person's vertices, then her points)
  function anchors(model, rows) {
    const pt = function (n) { const r = model.pt[n]; if (r === undefined) throw new Error("human_lite wear: no point '" + n + "'"); return [rows[3 * r], rows[3 * r + 1], rows[3 * r + 2]]; };
    const A = { arm: {}, leg: {}, y: {}, pt: pt };
    ["L", "R"].forEach(function (s) {
      const sh = pt("arm." + s + ".shoulder"), el = pt("arm." + s + ".elbow"), wr = pt("arm." + s + ".wrist"), tip = pt("hand." + s + ".tip");
      A.arm[s] = { sh: sh, el: el, wr: wr, tip: tip, u: unit(sub(el, sh)), f: unit(sub(wr, el)), lu: len(sub(el, sh)), lf: len(sub(wr, el)) };
      const heel_ = pt("foot." + s + ".heel"), hip = pt("leg." + s + ".hip"), kn = pt("leg." + s + ".knee"), an = pt("leg." + s + ".ankle"), sole = pt("foot." + s + ".sole"), ball = pt("foot." + s + ".ball"), toe = pt("foot." + s + ".tip");
      A.leg[s] = { heel_: heel_, hip: hip, knee: kn, ankle: an, sole: sole, ball: ball, toe: toe, t: unit(sub(kn, hip)), s: unit(sub(an, kn)), lt: len(sub(kn, hip)), ls: len(sub(an, kn)) };
    });
    const hips = pt("hips.head"), s1 = pt("spine1.tail"), s2 = pt("spine2.tail"), s3 = pt("spine3.tail"), neck = pt("neck.tail"), top = pt("head.tail");
    const by = A.y;
    by.hips = hips[1]; by.waist = lerp(hips[1], s1[1], 0.5); by.s1 = s1[1]; by.chest = s2[1]; by.shoulder = 0.5 * (A.arm.L.sh[1] + A.arm.R.sh[1]); by.neck = s3[1]; by.head = neck[1]; by.top = top[1];
    by.sole = Math.min(A.leg.L.sole[1], A.leg.R.sole[1]); by.hip_joint = 0.5 * (A.leg.L.hip[1] + A.leg.R.hip[1]);
    A.neck_axis = [0.5 * (neck[0] + s3[0]), neck[1], 0.5 * (neck[2] + s3[2])]; A.neck_top = neck;
    A.height = top[1] - by.sole;
    return A;
  }
  // the crotch: the height under which the legs have parted (the body's vertices round the middle line, the lowest of them), from the vertices
  function crotch_y(B, A) {
    let y = A.y.hip_joint - 0.12 * A.height, found = false;
    const P = B.P, top = A.y.hip_joint + 0.05;
    for (let i = 0; i < B.n; i++) {
      const x = P[3 * i], yy = P[3 * i + 1], z = P[3 * i + 2];
      if (Math.abs(x) < 0.012 && yy < top && yy > A.y.sole + 0.3 * A.height && Math.abs(z) < 0.12) { if (!found || yy < y) { y = yy; found = true; } }
    }
    return found ? y : A.y.hip_joint - 0.06 * A.height;
  }

  // ---- THE SHELL: the body's triangles where a field is >= 0, cut along its zero line
  //   field: Float32Array (one a body vertex). -> { n (vertices), at (Int32: the body vertex a shell vertex is on, or -1 for a vertex of the cut), a, b, t (a vertex of the cut is on the edge a -> b at t), tris (Int32 local), pos0 (Float32 3 n: on the skin),
  //   nrm (Float32 3 n), skin_i (Int16 4 n: a bone of the model), skin_w (Float32 4 n), cut (Uint8 n: 1 on the line of the cut), cover (Uint8 over the body: 1 inside) }
  function clip(B, field, opts) {
    const model = B.model, nv = B.n, P = B.P, N = B.N, tris = B.tris, SI = model.skin_indices, SW = model.skin_weights;
    opts = opts || {};
    const local = new Int32Array(nv).fill(-1), A = [], Bv = [], Tt = [], out = [], edge = new Map(), cut = [];
    const orig = function (v) { if (local[v] < 0) { local[v] = A.length; A.push(v); Bv.push(-1); Tt.push(0); cut.push(0); } return local[v]; };
    const on_edge = function (u, v, fu, fv) {
      const lo_ = Math.min(u, v), hi_ = Math.max(u, v), k = lo_ * nv + hi_;
      let id = edge.get(k);
      if (id === undefined) {
        let t = fu / (fu - fv);                                                                         // (from u toward v)
        if (u !== lo_) t = 1 - t;                                                                       // (from the lower index: the same vertex whichever triangle asks)
        id = A.length; A.push(-1); Bv.push(hi_); Tt.push(t); cut.push(1); A[id] = -2 - lo_; edge.set(k, id);
      }
      return id;
    };
    for (let t = 0; t < tris.length; t += 3) {
      const v = [tris[t], tris[t + 1], tris[t + 2]], f = [field[v[0]], field[v[1]], field[v[2]]], ins = [f[0] >= 0, f[1] >= 0, f[2] >= 0], k = (ins[0] ? 1 : 0) + (ins[1] ? 1 : 0) + (ins[2] ? 1 : 0);
      if (k === 0) continue;
      if (k === 3) { out.push(orig(v[0]), orig(v[1]), orig(v[2])); continue; }
      const poly = [];
      for (let e = 0; e < 3; e++) {
        const c = e, d = (e + 1) % 3;
        if (ins[c]) poly.push(orig(v[c]));
        if (ins[c] !== ins[d]) poly.push(on_edge(v[c], v[d], f[c], f[d]));
      }
      for (let q = 1; q + 1 < poly.length; q++) out.push(poly[0], poly[q], poly[q + 1]);
    }
    const n = A.length, S = { n: n, at: new Int32Array(n), a: new Int32Array(n), b: new Int32Array(n), t: new Float32Array(n), tris: Int32Array.from(out), pos0: new Float32Array(3 * n), nrm: new Float32Array(3 * n), skin_i: new Int16Array(4 * n), skin_w: new Float32Array(4 * n), cut: Uint8Array.from(cut) };
    for (let i = 0; i < n; i++) {
      if (Bv[i] < 0) { const v = A[i]; S.at[i] = v; S.a[i] = v; S.b[i] = -1; S.t[i] = 0; S.pos0[3 * i] = P[3 * v]; S.pos0[3 * i + 1] = P[3 * v + 1]; S.pos0[3 * i + 2] = P[3 * v + 2]; S.nrm[3 * i] = N[3 * v]; S.nrm[3 * i + 1] = N[3 * v + 1]; S.nrm[3 * i + 2] = N[3 * v + 2]; for (let q = 0; q < 4; q++) { S.skin_i[4 * i + q] = SI[4 * v + q]; S.skin_w[4 * i + q] = SW[4 * v + q] / 255; } }
      else {
        const a = -2 - A[i], b = Bv[i], t = Tt[i];                                                       // (on the edge a -> b, a < b)
        S.at[i] = t < 0.5 ? a : b; S.a[i] = a; S.b[i] = b; S.t[i] = t;
        for (let c = 0; c < 3; c++) { S.pos0[3 * i + c] = lerp(P[3 * a + c], P[3 * b + c], t); S.nrm[3 * i + c] = lerp(N[3 * a + c], N[3 * b + c], t); }
        const nl = Math.sqrt(S.nrm[3 * i] * S.nrm[3 * i] + S.nrm[3 * i + 1] * S.nrm[3 * i + 1] + S.nrm[3 * i + 2] * S.nrm[3 * i + 2]) || 1; S.nrm[3 * i] /= nl; S.nrm[3 * i + 1] /= nl; S.nrm[3 * i + 2] /= nl;
        const acc = {};
        for (let q = 0; q < 4; q++) { const wa = SW[4 * a + q] / 255 * (1 - t), wb = SW[4 * b + q] / 255 * t; if (wa > 0) acc[SI[4 * a + q]] = (acc[SI[4 * a + q]] || 0) + wa; if (wb > 0) acc[SI[4 * b + q]] = (acc[SI[4 * b + q]] || 0) + wb; }
        const list = Object.keys(acc).map(function (k) { return [+k, acc[k]]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 4);
        let tot = 0; list.forEach(function (e) { tot += e[1]; });
        for (let q = 0; q < 4; q++) { if (q < list.length) { S.skin_i[4 * i + q] = list[q][0]; S.skin_w[4 * i + q] = list[q][1] / tot; } else { S.skin_i[4 * i + q] = 0; S.skin_w[4 * i + q] = 0; } }
      }
    }
    // the body's vertices that are inside by a margin: the cloth hides them
    const margin = opts.margin === undefined ? 0.004 : opts.margin;
    S.cover = new Uint8Array(nv); for (let v = 0; v < nv; v++) S.cover[v] = field[v] > margin ? 1 : 0;
    return S;
  }
  // the loops of the edge of a shell: [[vertex ...]] in the direction the shell's triangles run the edge
  function boundary_loops(tris) {
    const next = new Map(), count = new Map();
    for (let t = 0; t < tris.length; t += 3) for (let e = 0; e < 3; e++) {
      const a = tris[t + e], b = tris[t + (e + 1) % 3];
      const k = Math.min(a, b) * 4194304 + Math.max(a, b);
      count.set(k, (count.get(k) || 0) + 1);
    }
    const starts = [];
    for (let t = 0; t < tris.length; t += 3) for (let e = 0; e < 3; e++) {
      const a = tris[t + e], b = tris[t + (e + 1) % 3];
      if (count.get(Math.min(a, b) * 4194304 + Math.max(a, b)) === 1) { if (!next.has(a)) next.set(a, []); next.get(a).push(b); starts.push(a); }
    }
    const loops = [], used = new Set();
    starts.forEach(function (s0) {
      if (used.has(s0)) return;
      const loop = []; let cur = s0, guard = 0;
      while (cur !== undefined && !used.has(cur) && guard++ < 100000) { used.add(cur); loop.push(cur); const nx = next.get(cur); cur = nx ? nx[0] : undefined; if (cur === s0) break; }
      if (loop.length >= 3) loops.push(loop);
    });
    return loops;
  }

  // ---- THE FINISH: the shell pushed out by the cloth (thickness + ease, over what is under it), smoothed, the hem turned in, the colours; -> the piece of the contract
  //   opts: { thickness (m, 0.004), ease (m, 0.0) | function (shell, i) -> m, under (Float32Array over the body: what is already worn there), smooth (iterations), colour [r, g, b], variation (0.05), lip (1: turn the edge in, a number: its depth in metres),
  //           lip_colour, sole (extra thickness under the foot), name, part, rough }
  function finish(B, S, opts) {
    const n = S.n, under = opts.under, th = opts.thickness === undefined ? 0.004 : opts.thickness;
    // RELAX: the skin that the cloth is made from is first smoothed (the toes of a foot are one lump in a shoe), the normals are those of the smoothed skin; the cut stays where it is
    if (opts.relax) {
      const nb = []; for (let i = 0; i < n; i++) nb.push([]);
      const seen = new Set();
      for (let t = 0; t < S.tris.length; t += 3) for (let e = 0; e < 3; e++) { const a = S.tris[t + e], b = S.tris[t + (e + 1) % 3], k = Math.min(a, b) * 4194304 + Math.max(a, b); if (seen.has(k)) continue; seen.add(k); nb[a].push(b); nb[b].push(a); }
      let cur = S.pos0, nxt = new Float32Array(3 * n);
      for (let it = 0; it < opts.relax; it++) {
        for (let i = 0; i < n; i++) {
          const l = nb[i];
          const rw = opts.relax_w ? opts.relax_w(S, i) : 1;
          if (S.cut[i] || !l.length || rw <= 0) { for (let c = 0; c < 3; c++) nxt[3 * i + c] = cur[3 * i + c]; continue; }
          let x = 0, y = 0, z = 0; for (let q = 0; q < l.length; q++) { x += cur[3 * l[q]]; y += cur[3 * l[q] + 1]; z += cur[3 * l[q] + 2]; }
          nxt[3 * i] = lerp(cur[3 * i], x / l.length, 0.6 * rw); nxt[3 * i + 1] = lerp(cur[3 * i + 1], y / l.length, 0.6 * rw); nxt[3 * i + 2] = lerp(cur[3 * i + 2], z / l.length, 0.6 * rw);
        }
        const sw = cur; cur = nxt; nxt = sw;
      }
      S.pos0 = Float32Array.from(cur);
      const rn = normals_of(S.pos0, S.tris, n); S.nrm = rn;
    }
    const off = new Float32Array(n), dmin = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let u = 0;
      if (under) { u = S.b[i] < 0 ? under[S.a[i]] : lerp(under[S.a[i]], under[S.b[i]], S.t[i]); }
      const e = typeof opts.ease === "function" ? opts.ease(S, i) : (opts.ease || 0);
      const d = u + (u > 0 ? 0.0015 : 0) + th + e;
      off[i] = d; dmin[i] = opts.hold ? u + th + opts.hold * e : u + 0.001 + th * 0.5;
    }
    // a surface that is close to another part of the body (the armpit, the crotch) cannot be pushed out as far as one that is free: half the way to what is there
    if (opts.guard !== false) {
      for (let i = 0; i < n; i++) {
        if (off[i] < 0.007) continue;
        const o = [S.pos0[3 * i] + S.nrm[3 * i] * 0.002, S.pos0[3 * i + 1] + S.nrm[3 * i + 1] * 0.002, S.pos0[3 * i + 2] + S.nrm[3 * i + 2] * 0.002], hit = B.ray(o, [S.nrm[3 * i], S.nrm[3 * i + 1], S.nrm[3 * i + 2]], Math.min(0.12, 2.5 * off[i] + 0.02));
        if (hit < Infinity) off[i] = Math.max(dmin[i], Math.min(off[i], 0.45 * hit));
      }
    }
    const pos = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) pos[3 * i + c] = S.pos0[3 * i + c] + S.nrm[3 * i + c] * off[i];
    // smoothing: a vertex goes toward the middle of its neighbours (the surface of the cloth is smoother than the skin under it: it bridges the hollows), then is held out of the skin along its own normal
    const iters = opts.smooth === undefined ? (th + (opts.ease === undefined || typeof opts.ease === "function" ? 0.01 : opts.ease) > 0.012 ? 3 : 1) : opts.smooth;
    if (iters > 0) {
      const nb = [], cnt = new Int32Array(n); for (let i = 0; i < n; i++) nb.push([]);
      const seen = new Set();
      for (let t = 0; t < S.tris.length; t += 3) for (let e = 0; e < 3; e++) { const a = S.tris[t + e], b = S.tris[t + (e + 1) % 3], k = Math.min(a, b) * 4194304 + Math.max(a, b); if (seen.has(k)) continue; seen.add(k); nb[a].push(b); nb[b].push(a); }
      let cur = pos, nxt = new Float32Array(3 * n);
      for (let it = 0; it < iters; it++) {
        for (let i = 0; i < n; i++) {
          if (S.cut[i] && opts.keep_cut !== false) { for (let c = 0; c < 3; c++) nxt[3 * i + c] = cur[3 * i + c]; continue; }
          const l = nb[i]; let x = 0, y = 0, z = 0;
          if (!l.length) { for (let c = 0; c < 3; c++) nxt[3 * i + c] = cur[3 * i + c]; continue; }
          for (let q = 0; q < l.length; q++) { x += cur[3 * l[q]]; y += cur[3 * l[q] + 1]; z += cur[3 * l[q] + 2]; }
          x /= l.length; y /= l.length; z /= l.length;
          const px = lerp(cur[3 * i], x, 0.5), py = lerp(cur[3 * i + 1], y, 0.5), pz = lerp(cur[3 * i + 2], z, 0.5);
          const k = (px - S.pos0[3 * i]) * S.nrm[3 * i] + (py - S.pos0[3 * i + 1]) * S.nrm[3 * i + 1] + (pz - S.pos0[3 * i + 2]) * S.nrm[3 * i + 2], need = dmin[i] - k;
          if (need > 0) { nxt[3 * i] = px + S.nrm[3 * i] * need; nxt[3 * i + 1] = py + S.nrm[3 * i + 1] * need; nxt[3 * i + 2] = pz + S.nrm[3 * i + 2] * need; } else { nxt[3 * i] = px; nxt[3 * i + 1] = py; nxt[3 * i + 2] = pz; }
        }
        const sw = cur; cur = nxt; nxt = sw;
      }
      if (cur !== pos) pos.set(cur);
    }
    // a SOLE: what is near the ground is moved down by the thickness of the sole (the more the nearer), and what faces down is brought to the plane of the sole's bottom (the toes are lifted and curled: the shoe's sole is flat)
    if (opts.sole_th) {
      const sy = opts.sole_y, th_ = opts.sole_th, plane = sy - th_;
      for (let i = 0; i < n; i++) {
        const h = S.pos0[3 * i + 1] - sy, w = smooth(0.035, 0.004, h);
        pos[3 * i + 1] -= th_ * w;
        const t = smooth(-0.25, -0.6, S.nrm[3 * i + 1]);
        if (t > 0) pos[3 * i + 1] = lerp(pos[3 * i + 1], plane, t);
      }
    }
    // KEEP OUT: a cloth that is made of a relaxed skin (a shoe) can end up in the skin it covers (the toes' creases): what is inside is pushed out along the skin's normal, to a millimetre
    if (opts.keep_out) {
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
        if (S.cut[i]) continue;
        const q = [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]], d0 = B.signed(q[0], q[1], q[2]);
        if (d0.v >= 0 && d0.d < 0.002) { const k = 0.002 - d0.d; pos[3 * i] += B.N[3 * d0.v] * k; pos[3 * i + 1] += B.N[3 * d0.v + 1] * k; pos[3 * i + 2] += B.N[3 * d0.v + 2] * k; }
      }
    }
    // the CUT is where the field is 0 (a hem across a sleeve, the neck, the waist): pushed out along the skin's normals the line of the cut wanders by what the normals tilt, so each vertex of the cut is put back on the field's zero line, at its own weights
    if (opts.field && opts.iso !== false) {
      const F = opts.field.at, h = 0.002;
      for (let i = 0; i < n; i++) {
        if (!S.cut[i]) continue;
        let x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
        for (let it = 0; it < 5; it++) {
          const f0 = F(x, y, z, S.skin_i, S.skin_w, 4 * i, 1); if (Math.abs(f0) < 1e-4) break;
          const gx = (F(x + h, y, z, S.skin_i, S.skin_w, 4 * i, 1) - F(x - h, y, z, S.skin_i, S.skin_w, 4 * i, 1)) / (2 * h), gy = (F(x, y + h, z, S.skin_i, S.skin_w, 4 * i, 1) - F(x, y - h, z, S.skin_i, S.skin_w, 4 * i, 1)) / (2 * h), gz = (F(x, y, z + h, S.skin_i, S.skin_w, 4 * i, 1) - F(x, y, z - h, S.skin_i, S.skin_w, 4 * i, 1)) / (2 * h);
          const g2 = gx * gx + gy * gy + gz * gz; if (g2 < 1e-4) break;
          let k = f0 / g2; const mv = Math.abs(k) * Math.sqrt(g2); if (mv > 0.02) k *= 0.02 / mv;
          x -= gx * k; y -= gy * k; z -= gz * k;
        }
        pos[3 * i] = x; pos[3 * i + 1] = y; pos[3 * i + 2] = z;
      }
    }
    // the colours: the cloth's with a little variation that is the same for the same place of the body (no two garments of a person are flat)
    const col = opts.colour || [0.5, 0.5, 0.5], vr = opts.variation === undefined ? 0.05 : opts.variation;
    const colors = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) {
      const h = Math.sin(pos[3 * i] * 91.7 + pos[3 * i + 1] * 57.3 + pos[3 * i + 2] * 33.1) * 43758.5453, k = 1 + vr * (h - Math.floor(h) - 0.5) * 2;
      colors[3 * i] = clamp(col[0] * k, 0, 1); colors[3 * i + 1] = clamp(col[1] * k, 0, 1); colors[3 * i + 2] = clamp(col[2] * k, 0, 1);
    }
    // the DRAPE (a skirt, a coat, a robe): rings let down from the lowest edge of the cloth, out of the legs' way
    let total = n, vpos = pos, vcol = colors, vskin_i = S.skin_i, vskin_w = S.skin_w, tris = S.tris, voff = off, vdmin = dmin, wall = null, wall_c = null;
    if (opts.drape && opts.ctx) {
      const dr = drape(B, opts.ctx, S, pos, colors, opts.drape);
      if (dr) {
        const m = n + dr.count;
        vpos = new Float32Array(3 * m); vpos.set(pos); vpos.set(dr.pos, 3 * n);
        vcol = new Float32Array(3 * m); vcol.set(colors); vcol.set(dr.colors, 3 * n);
        vskin_i = new Int16Array(4 * m); vskin_i.set(S.skin_i); vskin_i.set(dr.skin_i, 4 * n);
        vskin_w = new Float32Array(4 * m); vskin_w.set(S.skin_w); vskin_w.set(dr.skin_w, 4 * n);
        tris = new Int32Array(S.tris.length + dr.tris.length); tris.set(S.tris); tris.set(dr.tris, S.tris.length);
        voff = new Float32Array(m); voff.set(off); vdmin = new Float32Array(m); vdmin.set(dmin);
        wall = new Float32Array(m).fill(-1); for (let i = 0; i < dr.count; i++) wall[n + i] = th * 1.2;
        wall_c = dr.centre; total = m;
      }
    }
    // the BRIM (a cap's peak, a hat's brim): a sheet let out from the edge of the cloth, with a thickness (a top face, an underside, a rim between)
    if (opts.brim) {
      const loops = boundary_loops(tris);
      let lp = null; loops.forEach(function (l) { if (!lp || l.length > lp.length) lp = l; });
      if (lp && lp.length >= 6) {
        const o = opts.brim, m = lp.length, th_ = 0.003;
        let cx = 0, cz = 0; lp.forEach(function (v) { cx += vpos[3 * v]; cz += vpos[3 * v + 2]; }); cx /= m; cz /= m;
        const base = total, add = 4 * m, T = total + add;
        const np = new Float32Array(3 * T); np.set(vpos); const nc = new Float32Array(3 * T); nc.set(vcol); const ns = new Int16Array(4 * T); ns.set(vskin_i); const nw = new Float32Array(4 * T); nw.set(vskin_w);
        const no = new Float32Array(T); no.set(voff); const nd = new Float32Array(T); nd.set(vdmin); const nwall = new Float32Array(T).fill(-1); if (wall) nwall.set(wall);
        const top = [], under = [];
        const ids = function (k, i) { return base + k * m + i; };
        for (let i = 0; i < m; i++) {
          const v = lp[i], x = vpos[3 * v], y = vpos[3 * v + 1], z = vpos[3 * v + 2], hx = x - cx, hz = z - cz, hl = Math.sqrt(hx * hx + hz * hz) || 1, phi = Math.abs(Math.atan2(hx, hz - 0));
          const w = o.arc ? 1 - smooth(o.arc * 0.55, o.arc, phi) : 1, rim = o.width * w;
          const out = [x + hx / hl * rim, y - o.droop * w, z + hz / hl * rim], inn = [x, y - th_, z];
          const set = function (k, p, dark) { const j = ids(k, i); np[3 * j] = p[0]; np[3 * j + 1] = p[1]; np[3 * j + 2] = p[2]; nc[3 * j] = vcol[3 * v] * dark; nc[3 * j + 1] = vcol[3 * v + 1] * dark; nc[3 * j + 2] = vcol[3 * v + 2] * dark; for (let q = 0; q < 4; q++) { ns[4 * j + q] = vskin_i[4 * v + q]; nw[4 * j + q] = vskin_w[4 * v + q]; } };
          set(0, out, 1); set(1, [out[0], out[1] - th_, out[2]], 0.8); set(2, inn, 0.8);
          const jj = ids(3, i); np[3 * jj] = x; np[3 * jj + 1] = y; np[3 * jj + 2] = z;                                    // (a spare: the edge itself, not used)
          nc[3 * jj] = vcol[3 * v]; nc[3 * jj + 1] = vcol[3 * v + 1]; nc[3 * jj + 2] = vcol[3 * v + 2]; for (let q = 0; q < 4; q++) { ns[4 * jj + q] = vskin_i[4 * v + q]; nw[4 * jj + q] = vskin_w[4 * v + q]; }
          for (let k = 0; k < 4; k++) nwall[ids(k, i)] = k === 2 ? th_ : -1;
          o.w_ = (o.w_ || []); o.w_[i] = rim;
        }
        for (let i = 0; i < m; i++) {
          const j = (i + 1) % m, a = lp[i], b = lp[j];
          if (o.w_[i] < 1e-4 && o.w_[j] < 1e-4) continue;
          top.push(b, a, ids(0, i), b, ids(0, i), ids(0, j));                                                        // (the top face: the strip goes on from the edge of the cloth)
          under.push(ids(2, j), ids(1, i), ids(2, i), ids(2, j), ids(1, j), ids(1, i));                              // (the underside, turned over)
          under.push(ids(0, j), ids(0, i), ids(1, i), ids(0, j), ids(1, i), ids(1, j));                              // (the rim)
        }
        const t2 = new Int32Array(tris.length + top.length + under.length); t2.set(tris); t2.set(top, tris.length); t2.set(under, tris.length + top.length);
        vpos = np; vcol = nc; vskin_i = ns; vskin_w = nw; voff = no; vdmin = nd; wall = nwall; if (!wall_c) wall_c = [cx, cz]; tris = t2; total = T;
      }
    }
    // the hem: a small wall from the edge of the cloth back to the skin, so that the cloth has a thickness (and the cut is not a gap)
    const lip = opts.lip === undefined ? 1 : opts.lip;
    if (lip) {
      const loops = boundary_loops(tris), depth = typeof lip === "number" && lip !== 1 ? lip : Math.max(0.003, th * 1.2);
      let extra = 0; loops.forEach(function (lp) { extra += lp.length; });
      const m = total + extra;
      const gpos = new Float32Array(3 * m); gpos.set(vpos); const gcol = new Float32Array(3 * m); gcol.set(vcol); const gsi = new Int16Array(4 * m); gsi.set(vskin_i); const gsw = new Float32Array(4 * m); gsw.set(vskin_w);
      const strip = [], lc = opts.lip_colour || [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8], nrm_of = function (v) { return v < n ? [S.nrm[3 * v], S.nrm[3 * v + 1], S.nrm[3 * v + 2]] : [0, -1, 0]; };
      let at = total;
      loops.forEach(function (lp) {
        const first = at;
        lp.forEach(function (v) {
          // the inner edge: back toward the skin by the depth, at the vertex's own normal (a hem that hangs free: up, into the cloth)
          let back;
          const free = wall && wall[v] >= 0, nv_ = nrm_of(v);
          if (free) { back = wall[v]; const hx = wall_c[0] - vpos[3 * v], hz = wall_c[1] - vpos[3 * v + 2], hl = Math.sqrt(hx * hx + hz * hz) || 1; gpos[3 * at] = vpos[3 * v] + hx / hl * back; gpos[3 * at + 1] = vpos[3 * v + 1]; gpos[3 * at + 2] = vpos[3 * v + 2] + hz / hl * back; }
          else { back = lip === 1 ? Math.max(0, voff[v] - vdmin[v] + 0.0005) : Math.min(depth, Math.max(0, voff[v] - vdmin[v] + 0.0005)); for (let c = 0; c < 3; c++) gpos[3 * at + c] = vpos[3 * v + c] - nv_[c] * back; }
          gcol[3 * at] = lc[0]; gcol[3 * at + 1] = lc[1]; gcol[3 * at + 2] = lc[2];
          for (let q = 0; q < 4; q++) { gsi[4 * at + q] = vskin_i[4 * v + q]; gsw[4 * at + q] = vskin_w[4 * v + q]; }
          at++;
        });
        for (let k = 0; k < lp.length; k++) { const a_ = lp[k], b_ = lp[(k + 1) % lp.length], la = first + k, lb = first + (k + 1) % lp.length; strip.push(b_, a_, la, b_, la, lb); }
      });
      const t2 = new Int32Array(tris.length + strip.length); t2.set(tris); t2.set(strip, tris.length);
      vpos = gpos; vcol = gcol; vskin_i = gsi; vskin_w = gsw; tris = t2; total = m;
    }
    return { name: opts.name || "garment", part: opts.part || "clothes", pos: vpos, tris: tris, skin_bone: vskin_i, skin_w: vskin_w, colors: vcol, rough: opts.rough === undefined ? 0.85 : opts.rough, bones: [], chain: null, cover: S.cover, vertices: total, off: off, shell: S };
  }

  // ---- THE DRAPE: rings let down from the lowest edge of a shell (the hem of a bodice, a waistband) to a height, each ring wider than the one over it by the flare and never inside the body or what is worn under it (the legs' hull at that height, by
  //   angle round the middle line). o: { to (y, metres), flare (the share of its radius that the hem has more than the top: 0.2), rings (6), clear (metres the cloth stands off the legs, 0.012), fold (the amplitude of the pleats, metres), waves, stiff
  //   (0 .. 1: how far the thighs carry the cloth, the more the lower), th } -> { count, pos, colors, skin_i, skin_w, tris } (the vertices are the rings after the first, which is the edge itself, in the order of the loop)
  function drape(B, ctx, S, pos, colors, o) {
    const loops = boundary_loops(S.tris); if (!loops.length) return null;
    let best = -1, by = 1e9;
    loops.forEach(function (lp, k) { let y = 0; lp.forEach(function (v) { y += pos[3 * v + 1]; }); y /= lp.length; if (y < by) { by = y; best = k; } });
    const loop = loops[best], m = loop.length, y0 = by;
    if (!(o.to < y0 - 0.02) || m < 3) return null;
    let cx = 0, cz = 0; loop.forEach(function (v) { cx += pos[3 * v]; cz += pos[3 * v + 2]; }); cx /= m; cz /= m;
    const K = o.rings || 6, NB = 32, clear = o.clear === undefined ? 0.012 : o.clear, model = B.model;
    const th_ = {}, sn_ = {}; model.bones.forEach(function (b, i) { if (b.name === "thigh.L") th_.L = i; if (b.name === "thigh.R") th_.R = i; if (b.name === "shin.L") sn_.L = i; if (b.name === "shin.R") sn_.R = i; });
    const arm = model.bones.map(function (b) { return /^(upperarm|lowerarm|hand|thumb|fingers1|fingers2)\./.test(b.name); });
    const SI = model.skin_indices, SW = model.skin_weights, P = B.P, nvb = B.n;
    const ang = new Float32Array(m), r0 = new Float32Array(m), dx = new Float32Array(m), dz = new Float32Array(m);
    for (let i = 0; i < m; i++) { const v = loop[i], x = pos[3 * v] - cx, z = pos[3 * v + 2] - cz, r = Math.sqrt(x * x + z * z) || 1e-6; r0[i] = r; dx[i] = x / r; dz[i] = z / r; ang[i] = Math.atan2(x, z); }
    const bin = function (a) { let b = Math.floor((a + Math.PI) / (2 * Math.PI) * NB); if (b >= NB) b = NB - 1; if (b < 0) b = 0; return b; };
    const count = K * m, out = { centre: [cx, cz], count: count, pos: new Float32Array(3 * count), colors: new Float32Array(3 * count), skin_i: new Int16Array(4 * count), skin_w: new Float32Array(4 * count), tris: [] };
    let prev_r = Float32Array.from(r0);
    for (let k = 1; k <= K; k++) {
      const t = k / K, y = lerp(y0, o.to, t), R = new Float32Array(NB);
      const visit = function (x, yy, z) { if (Math.abs(yy - y) > 0.03) return; const dxx = x - cx, dzz = z - cz, r = Math.sqrt(dxx * dxx + dzz * dzz); if (r > 0.6) return; const b = bin(Math.atan2(dxx, dzz)); if (r > R[b]) R[b] = r; };
      for (let v = 0; v < nvb; v++) { let aw = 0; for (let q = 0; q < 4; q++) if (arm[SI[4 * v + q]]) aw += SW[4 * v + q] / 255; if (aw > 0.4) continue; visit(P[3 * v], P[3 * v + 1], P[3 * v + 2]); }
      (ctx.placed || []).forEach(function (pp) { for (let i = 0; i < pp.length; i += 3) visit(pp[i], pp[i + 1], pp[i + 2]); });
      const Rs = new Float32Array(NB); for (let b = 0; b < NB; b++) Rs[b] = Math.max(R[b], R[(b + 1) % NB] * 0.97, R[(b + NB - 1) % NB] * 0.97);
      let r = new Float32Array(m);
      for (let i = 0; i < m; i++) {
        const pleat = o.fold ? o.fold * t * Math.sin(ang[i] * (o.waves || 9)) : 0;
        r[i] = Math.max(r0[i] * (1 + (o.flare === undefined ? 0.2 : o.flare) * t) + pleat, Rs[bin(ang[i])] + clear);
      }
      for (let it = 0; it < 2; it++) { const r2 = new Float32Array(m); for (let i = 0; i < m; i++) r2[i] = Math.max(Rs[bin(ang[i])] + clear, 0.25 * r[(i + m - 1) % m] + 0.5 * r[i] + 0.25 * r[(i + 1) % m]); r = r2; }
      for (let i = 0; i < m; i++) {
        if (r[i] < prev_r[i] * 0.995 && o.flare !== 0) r[i] = Math.max(r[i], prev_r[i] * 0.995);
        const at = (k - 1) * m + i, x = cx + dx[i] * r[i], z = cz + dz[i] * r[i], v0 = loop[i], dark = 1 - 0.06 * t;
        out.pos[3 * at] = x; out.pos[3 * at + 1] = y; out.pos[3 * at + 2] = z;
        out.colors[3 * at] = colors[3 * v0] * dark; out.colors[3 * at + 1] = colors[3 * v0 + 1] * dark; out.colors[3 * at + 2] = colors[3 * v0 + 2] * dark;
        // the skin of the edge, and the thigh of that side more the lower the ring is
        const acc = {}; for (let q = 0; q < 4; q++) { const w = S.skin_w[4 * v0 + q]; if (w > 0) acc[S.skin_i[4 * v0 + q]] = w; }
        // the cloth is skinned to the legs that it hangs round (the left and the right shared continuously over the middle line, the thigh and the shin shared over the knee): a skirt that is carried by the hips alone is left behind by a stride, the leg comes out
        // of it. The more the lower the ring (`stiff` is how far the legs carry the cloth at the hem)
        const sh = (o.stiff === undefined ? 0.6 : o.stiff) * t;
        if (sh > 0.001 && th_.L !== undefined && th_.R !== undefined) {
          Object.keys(acc).forEach(function (b) { acc[b] *= 1 - sh; });
          const left = smooth(-0.07, 0.07, x);
          ["L", "R"].forEach(function (sd) {
            const wl = sd === "L" ? left : 1 - left, kn = ctx.A.leg[sd].knee[1], below = smooth(kn + 0.05, kn - 0.05, y);
            acc[th_[sd]] = (acc[th_[sd]] || 0) + sh * wl * (1 - below); if (sn_[sd] !== undefined) acc[sn_[sd]] = (acc[sn_[sd]] || 0) + sh * wl * below; else acc[th_[sd]] += sh * wl * below;
          });
        }
        // where the cloth is near the body (a thigh under it, the hip) it is carried by what is under it, as that is: the nearest vertex of the body gives its weights, the more the nearer (a cloth that stands off the legs is the legs' less)
        const nv0 = B.nearest(x, y, z);
        if (nv0 >= 0) {
          const dx2 = x - P[3 * nv0], dy2 = y - P[3 * nv0 + 1], dz2 = z - P[3 * nv0 + 2], dn = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2), kk = 1 - smooth(0.03, 0.16, dn);
          if (kk > 0.001) { Object.keys(acc).forEach(function (b) { acc[b] *= 1 - kk; }); for (let q = 0; q < 4; q++) { const w = SW[4 * nv0 + q] / 255; if (w > 0) acc[SI[4 * nv0 + q]] = (acc[SI[4 * nv0 + q]] || 0) + kk * w; } }
        }
        const list = Object.keys(acc).map(function (b) { return [+b, acc[b]]; }).sort(function (u, w) { return w[1] - u[1]; }).slice(0, 4); let tot = 0; list.forEach(function (e) { tot += e[1]; });
        for (let q = 0; q < 4; q++) { if (q < list.length) { out.skin_i[4 * at + q] = list[q][0]; out.skin_w[4 * at + q] = list[q][1] / tot; } }
      }
      prev_r = r;
    }
    // the strips between the rings (the first ring is the edge of the shell itself)
    for (let k = 1; k <= K; k++) for (let i = 0; i < m; i++) {
      const j = (i + 1) % m, a = k === 1 ? loop[i] : S.n + (k - 2) * m + i, b = k === 1 ? loop[j] : S.n + (k - 2) * m + j, a2 = S.n + (k - 1) * m + i, b2 = S.n + (k - 1) * m + j;
      out.tris.push(b, a, a2, b, a2, b2);
    }
    out.tris = Int32Array.from(out.tris);
    return out;
  }

  // ---- THE GARMENTS: a kind is a recipe of fields on the person's body. The FIELD of a garment is, for a vertex of the body (>= 0: the cloth is over it, in metres from the cut):
  //   `base`: the value for the trunk (a number, or a function (x, y, z, A) -> m) · for each LIMB (the arms and the legs: a vertex belongs to a limb in the share of its skin weights that are the limb's bones'): `arm` / `leg`, a number or a function
  //   (s, limb) -> m of the CHAIN COORDINATE s (metres along the bones from the shoulder or the hip: a hem across a sleeve is a plane across the bone, whatever the weights are) · then `plane` (x, y, z, A) -> m (the hem, the neck: positions), by min
  const ARM_BONES = ["upperarm", "lowerarm", "hand", "thumb", "fingers1", "fingers2"], LEG_BONES = ["thigh", "shin", "foot", "toe"];
  function bone_class(name) {
    const base = name.replace(/\.(L|R)$/, ""), side = /\.R$/.test(name) ? "R" : (/\.L$/.test(name) ? "L" : "");
    if (ARM_BONES.indexOf(base) >= 0) return { limb: "arm", side: side, c: base };
    if (LEG_BONES.indexOf(base) >= 0) return { limb: "leg", side: side, c: base };
    return { limb: null, side: side, c: base };
  }
  // the chain coordinate of a point for a bone of a limb: metres from the root of the limb along its bones
  function chain_s(k, x, y, z, A) {
    const p = [x, y, z];
    if (k.limb === "arm") { const a = A.arm[k.side]; return k.c === "upperarm" ? dot(sub(p, a.sh), a.u) : k.c === "lowerarm" ? a.lu + dot(sub(p, a.el), a.f) : a.lu + a.lf + dot(sub(p, a.wr), a.f); }
    const l = A.leg[k.side];
    return k.c === "thigh" ? dot(sub(p, l.hip), l.t) : k.c === "shin" ? l.lt + dot(sub(p, l.knee), l.s) : l.lt + l.ls + dot(sub(p, l.ankle), l.s);
  }
  const val = function (v, a, b, c, d, e) { return typeof v === "function" ? v(a, b, c, d, e) : v; };
  function make_field(B, A, spec) {
    const model = B.model, nv = B.n, P = B.P, SI = model.skin_indices, SW = model.skin_weights, f = new Float32Array(nv);
    const info = model.bones.map(function (b) { return bone_class(b.name); });
    const gate = function (a) { return smooth(0.2, 0.7, a); };
    const at = function (x, y, z, si, sw, k, scale) {
      const acc = [0, 0, 0, 0], sacc = [0, 0, 0, 0];
      for (let q = 0; q < 4; q++) {
        const w = sw[k + q] * scale; if (!w) continue;
        const inf = info[si[k + q]]; if (!inf.limb) continue;
        const g = (inf.limb === "arm" ? 0 : 2) + (inf.side === "R" ? 1 : 0);
        acc[g] += w; sacc[g] += w * chain_s(inf, x, y, z, A);
      }
      let m = clamp(val(spec.base, x, y, z, A), -BIG, BIG);
      for (let g = 0; g < 4; g++) {
        if (acc[g] < 0.2) continue;
        const arm = g < 2, side = g % 2 ? "R" : "L", v = clamp(val(arm ? spec.arm : spec.leg, sacc[g] / acc[g], arm ? A.arm[side] : A.leg[side], A), -BIG, BIG);
        m = lerp(m, v, gate(acc[g]));
      }
      if (spec.plane) m = Math.min(m, spec.plane(x, y, z, A));
      return m;
    };
    for (let v = 0; v < nv; v++) f[v] = at(P[3 * v], P[3 * v + 1], P[3 * v + 2], SI, SW, 4 * v, 1 / 255);
    return { body: f, at: at };
  }

  const KINDS = {};
  // a top: `sleeve` (a share of the arm from the shoulder to the wrist; 0 none), `below` (how far under her waist the hem is, metres; held over the crotch), the neck: `high` (metres over the base of the neck), `drop` (how far the front is lower), `wide`, `vee`
  function top_spec(o) {
    return function (B, A) {
      const y_hem = Math.max(A.y.waist - o.below, A.y.crotch + 0.02), y_n = A.y.neck + (o.high || 0), drop = o.drop || 0, wide = o.wide || 0.08, vee = !!o.vee, zc = A.neck_axis[2], bias = o.sleeve_bias === undefined ? -0.02 : o.sleeve_bias;
      const y_front = Math.min(y_n, A.pt("jaw.tail")[1] - 0.014);                                                  // (a collar is higher at the back of the neck than at the front: it stops under the chin, whatever the neck)
      return { base: BIG, leg: BIG, arm: function (s, a) { return o.sleeve * (a.lu + a.lf) + bias - s; }, plane: function (x, y, z) {
        let ny = lerp(y_n, y_front, smooth(zc - 0.01, zc + 0.05, z));
        if (drop > 0) { const k = vee ? Math.max(0, 1 - Math.abs(x) / wide) : Math.max(0, 1 - (x / wide) * (x / wide)); ny -= drop * k * smooth(zc - 0.01, zc + 0.05, z); }
        return Math.min(y - y_hem, ny - y);
      } };
    };
  }
  KINDS.tshirt = { part: "clothes", thickness: 0.004, ease: 0.008, spec: top_spec({ sleeve: 0.34, below: 0.11, drop: 0.02, wide: 0.07 }) };
  KINDS.shirt = { part: "clothes", thickness: 0.004, ease: 0.01, spec: top_spec({ sleeve: 1, sleeve_bias: -0.035, below: 0.13, drop: 0.035, wide: 0.05, vee: true }) };
  KINDS.tank = { part: "clothes", thickness: 0.004, ease: 0.005, spec: top_spec({ sleeve: 0, sleeve_bias: 0.0, below: 0.08, drop: 0.07, wide: 0.1 }) };
  KINDS.jacket = { part: "clothes", thickness: 0.006, ease: 0.018, spec: top_spec({ sleeve: 1, sleeve_bias: -0.02, below: 0.2, high: 0.03 }) };
  KINDS.vest = { part: "clothes", thickness: 0.006, ease: 0.014, spec: top_spec({ sleeve: 0, sleeve_bias: 0, below: 0.1, drop: 0.1, wide: 0.06, vee: true }) };
  KINDS.sweater = { part: "clothes", thickness: 0.007, ease: 0.02, spec: top_spec({ sleeve: 1, sleeve_bias: -0.035, below: 0.08, high: 0.045, drop: 0 }) };
  // what hangs from a top or a band: the height of its hem is a share (`length`) of the leg, from the hip to the sole
  const hem_y = function (A, g, dflt) { const len = g && g.length !== undefined ? g.length : dflt; return A.y.hip_joint - len * (A.y.hip_joint - A.y.sole); };
  KINDS.tunic = { part: "clothes", thickness: 0.005, ease: 0.018, spec: top_spec({ sleeve: 0.55, sleeve_bias: -0.02, below: 0.12, drop: 0.03, wide: 0.06 }), drape: function (A, g) { return { to: hem_y(A, g, 0.3), flare: 0.14, rings: 4, fold: 0.004, waves: 9, stiff: 0.9 }; } };
  KINDS.coat = { part: "clothes", thickness: 0.008, ease: 0.024, spec: top_spec({ sleeve: 1, sleeve_bias: -0.02, below: 0.12, high: 0.035 }), drape: function (A, g) { return { to: hem_y(A, g, 0.58), flare: 0.16, rings: 7, fold: 0.006, waves: 7, stiff: 0.9 }; } };
  KINDS.robe = { part: "clothes", thickness: 0.006, ease: 0.03, spec: top_spec({ sleeve: 0.95, sleeve_bias: -0.03, below: 0.1, high: 0.02, drop: 0.03, wide: 0.05, vee: true }), drape: function (A, g) { return { to: hem_y(A, g, 0.94), flare: 0.3, rings: 9, fold: 0.012, waves: 8, stiff: 0.85 }; } };
  KINDS.dress = { part: "clothes", thickness: 0.005, ease: 0.01, spec: top_spec({ sleeve: 0.28, sleeve_bias: 0, below: 0.02, drop: 0.06, wide: 0.08 }), drape: function (A, g) { return { to: hem_y(A, g, 0.55), flare: 0.4, rings: 7, fold: 0.008, waves: 11, stiff: 0.85 }; } };
  KINDS.skirt = { part: "clothes", thickness: 0.005, ease: 0.012, spec: function (B, A) {
    const hi = A.y.waist - 0.03, lo = Math.max(A.y.crotch + 0.02, hi - 0.045);
    return { base: BIG, arm: -BIG, leg: BIG, plane: function (x, y) { return Math.min(hi - y, y - lo); } };
  }, drape: function (A, g) { return { to: hem_y(A, g, 0.5), flare: 0.35, rings: 7, fold: 0.008, waves: 11, stiff: 0.85 }; } };
  // HEADWEAR: the cloth over the skull above a line that runs round the head (higher in front, on the temples and at the back: [front, side, back] in metres over her eyes); a cap has a peak, a hat a brim
  function head_spec(o) {
    return function (B, A) {
      const eye = A.pt("eye.L.head"), ey = eye[1], zc = A.pt("head.tail")[2], f = o.line[0], sd = o.line[1], bk = o.line[2];
      return { base: BIG, arm: -BIG, leg: -BIG, plane: function (x, y, z) { const a = Math.abs(Math.atan2(x, z - zc)), yl = a < Math.PI / 2 ? lerp(f, sd, smooth(0, Math.PI / 2, a)) : lerp(sd, bk, smooth(Math.PI / 2, Math.PI, a)); return Math.min(y - (ey + yl), A.y.top + 0.1 - y); } };
    };
  }
  KINDS.cap = { part: "clothes", hold: 0.85, thickness: 0.004, ease: 0.012, smooth: 9, rough: 0.8, spec: head_spec({ line: [0.042, 0.042, -0.012] }), brim: function (A, g) { return { width: 0.078, droop: 0.016, arc: 1.0 }; } };
  KINDS.beanie = { part: "clothes", hold: 0.85, thickness: 0.006, ease: 0.008, smooth: 9, rough: 0.9, spec: head_spec({ line: [0.03, -0.028, -0.06] }) };
  KINDS.hat = { part: "clothes", hold: 0.85, thickness: 0.005, ease: 0.02, smooth: 9, rough: 0.85, spec: head_spec({ line: [0.048, 0.048, 0.04] }), brim: function (A, g) { return { width: 0.05, droop: 0.008, arc: 0 }; } };
  KINDS.beret = { part: "clothes", hold: 0.85, thickness: 0.005, ease: 0.026, smooth: 6, rough: 0.9, spec: head_spec({ line: [0.045, 0.02, 0.0] }) };
  KINDS.gloves = { part: "clothes", thickness: 0.004, ease: 0.003, keep_out: true, spec: function (B, A) { return { base: -BIG, leg: -BIG, arm: function (s, a) { return s - (a.lu + a.lf - 0.03); }, plane: null }; } };
  // the legs: `cut` (the share of the way from the hip to the ankle where they end), the waist `belt` (under her waist)
  function legs_spec(o) {
    return function (B, A) {
      const wy = A.y.waist - o.belt;
      return { base: function (x, y, z, A2) { return wy - y; }, arm: -BIG, leg: function (s, l) { return o.cut * (l.lt + l.ls) - s; }, plane: function (x, y) { return wy - y; } };
    };
  }
  // a little more room toward the ankle (a straight leg, not a stocking)
  const flare = function (amount) { return function (S, i, A) { return amount * smooth(A.y.hip_joint - 0.25 * A.height * 0.5, A.y.sole + 0.1, S.pos0[3 * i + 1]); }; };
  KINDS.trousers = { part: "clothes", thickness: 0.005, ease: 0.016, ease_fn: flare(0.012), spec: legs_spec({ cut: 0.985, belt: 0.03 }) };
  KINDS.jeans = { part: "clothes", thickness: 0.005, ease: 0.008, ease_fn: flare(0.004), spec: legs_spec({ cut: 0.985, belt: 0.03 }) };
  KINDS.shorts = { part: "clothes", thickness: 0.005, ease: 0.014, spec: legs_spec({ cut: 0.42, belt: 0.03 }) };
  // the feet: `up` (the share of the shin that is covered, from the ankle)
  function feet_spec(o) {
    return function (B, A) { return { base: -BIG, arm: -BIG, leg: function (s, l) { return s - (l.lt + l.ls * (1 - o.up)); }, plane: null }; };
  }
  // a shoe has more room in front of the ball (a toe box), and a sole
  const toe_box = function (amount) {
    return function (S, i, A) {
      const side = S.pos0[3 * i] >= 0 ? "L" : "R", l = A.leg[side], fx = l.toe[0] - l.sole[0], fz = l.toe[2] - l.sole[2], fl = Math.sqrt(fx * fx + fz * fz) || 1;
      const s = ((S.pos0[3 * i] - l.sole[0]) * fx + (S.pos0[3 * i + 2] - l.sole[2]) * fz) / fl, ball = ((l.ball[0] - l.sole[0]) * fx + (l.ball[2] - l.sole[2]) * fz) / fl;
      return amount * smooth(ball - 0.02, fl, s);
    };
  };
  const forefoot = function (S, i, A) {
    const side = S.pos0[3 * i] >= 0 ? "L" : "R", l = A.leg[side], fx = l.toe[0] - l.sole[0], fz = l.toe[2] - l.sole[2], fl = Math.sqrt(fx * fx + fz * fz) || 1;
    const s = ((S.pos0[3 * i] - l.sole[0]) * fx + (S.pos0[3 * i + 2] - l.sole[2]) * fz) / fl, ball = ((l.ball[0] - l.sole[0]) * fx + (l.ball[2] - l.sole[2]) * fz) / fl;
    return smooth(ball - 0.025, ball + 0.01, s);
  };
  KINDS.boots = { part: "shoes", thickness: 0.006, ease: 0.006, ease_fn: toe_box(0.012), relax: 14, relax_w: forefoot, guard: false, keep_out: true, sole: 0.018, smooth: 16, rough: 0.8, spec: feet_spec({ up: 0.38 }) };
  KINDS.shoes = { part: "shoes", thickness: 0.005, ease: 0.005, ease_fn: toe_box(0.01), relax: 14, relax_w: forefoot, guard: false, keep_out: true, sole: 0.012, smooth: 16, rough: 0.7, spec: feet_spec({ up: 0.07 }) };

  function colour_of(c, fallback) {
    if (Array.isArray(c) && c.length >= 3 && c.slice(0, 3).every(function (x) { return typeof x === "number" && isFinite(x); })) return [clamp(c[0], 0, 1), clamp(c[1], 0, 1), clamp(c[2], 0, 1)];
    return fallback;
  }
  // ctx: { B (the body), A (anchors), under (Float32Array over the body vertices: what is worn there already; it is kept up to date), notes }. -> one piece
  function garment(ctx, g) {
    const K = KINDS[g.kind];
    if (!K) throw new Error("human_lite wear: no garment '" + g.kind + "' (" + Object.keys(KINDS).join(", ") + ")");
    const B = ctx.B, A = ctx.A, T = ctx.timing, now = function () { return T ? Date.now() : 0; }, t0 = now();
    const spec = K.spec(B, A), field = make_field(B, A, spec), t1 = now(), S = clip(B, field.body, {}), t2 = now();
    const th = g.thickness === undefined ? K.thickness : g.thickness, e0 = g.ease === undefined ? K.ease : g.ease;
    const ease = typeof K.ease_fn === "function" ? function (S2, i) { return e0 + K.ease_fn(S2, i, A, g); } : e0;
    const t3 = now(), piece = finish(B, S, { under: ctx.under, field: field, thickness: th, ease: ease, smooth: K.smooth, hold: K.hold, guard: K.guard, keep_out: K.keep_out, colour: colour_of(g.colour, [0.5, 0.5, 0.55]), sole_th: K.sole, sole_y: A.y.sole, ctx: ctx, drape: K.drape ? K.drape(A, g) : null, brim: K.brim ? K.brim(A, g) : null, relax: K.relax, relax_w: K.relax_w ? function (S2, i) { return K.relax_w(S2, i, A); } : null, name: g.kind, part: g.part || K.part, rough: g.rough === undefined ? K.rough : g.rough });
    if (!ctx.placed) ctx.placed = []; if (piece.part !== "shoes") ctx.placed.push(piece.pos);
    if (T) { T.field = (T.field || 0) + t1 - t0; T.clip = (T.clip || 0) + t2 - t1; T.finish = (T.finish || 0) + now() - t3; }
    // what is under the next garment: how far out this one is (over the vertices it covers and, a little less, over the rings round them: the next cloth is over its edge too)
    const under = ctx.under;
    for (let i = 0; i < S.n; i++) if (S.at[i] >= 0 && S.b[i] < 0) { const v = S.at[i]; if (piece.off[i] > under[v]) under[v] = piece.off[i]; }
    if (!ctx.nb) { ctx.nb = []; for (let v = 0; v < B.n; v++) ctx.nb.push([]); const tr = B.tris; for (let t = 0; t < tr.length; t += 3) for (let e = 0; e < 3; e++) { ctx.nb[tr[t + e]].push(tr[t + (e + 1) % 3]); ctx.nb[tr[t + (e + 1) % 3]].push(tr[t + e]); } }
    let ring = []; for (let v = 0; v < B.n; v++) if (S.cover[v] || field.body[v] > -0.004) ring.push(v);
    for (let r = 0; r < 3; r++) {
      const next = [], k = [0.85, 0.7, 0.55][r];
      ring.forEach(function (v) { const l = ctx.nb[v]; for (let q = 0; q < l.length; q++) { const u = l[q]; if (field.body[u] < 0 && under[u] < under[v] * k) { under[u] = under[v] * k; next.push(u); } } });
      ring = next;
    }
    return piece;
  }
  // `clothes` as it is given -> the list of garments { kind, colour, ease, thickness, part, rough } (inner to outer): a kind's name is a garment with its own numbers; a mistake is an Error that says which, or, given `notes`, is left out and said
  const GARMENT_KEYS = ["kind", "colour", "ease", "thickness", "part", "rough", "name", "length"];
  function clean(list, tag, notes) {
    if (list === undefined || list === null || list === false) return [];
    const bad = function (msg) { if (!notes) throw new Error(tag + msg); notes.push(tag + msg + ": left out"); };
    if (!Array.isArray(list)) { bad("clothes is a list of garments (" + Object.keys(KINDS).join(", ") + ")"); return []; }
    const out = [];
    list.forEach(function (g, i) {
      if (typeof g === "string") g = { kind: g };
      if (!g || typeof g !== "object" || Array.isArray(g)) { bad("clothes[" + i + "] is a garment { kind, colour } or the name of a kind"); return; }
      if (!Object.prototype.hasOwnProperty.call(KINDS, g.kind)) { bad("clothes[" + i + "]: no garment '" + g.kind + "' (" + Object.keys(KINDS).join(", ") + ")"); return; }
      const o = { kind: g.kind };
      Object.keys(g).forEach(function (k) {
        if (k === "kind") return;
        if (GARMENT_KEYS.indexOf(k) < 0) { bad("clothes[" + i + "]: unknown field '" + k + "' (" + GARMENT_KEYS.join(", ") + ")"); return; }
        const v = g[k];
        if (k === "colour") {
          if (Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(function (x) { return typeof x === "number" && isFinite(x); })) { const c = [clamp(v[0], 0, 1), clamp(v[1], 0, 1), clamp(v[2], 0, 1)]; if (c[0] !== v[0] || c[1] !== v[1] || c[2] !== v[2]) if (notes) notes.push(tag + "clothes[" + i + "].colour is held to 0 .. 1"); o.colour = c; }
          else bad("clothes[" + i + "].colour is [r, g, b], 0 .. 1");
          return;
        }
        if (k === "part" || k === "name") { if (typeof v === "string" && /^[a-z][a-z0-9_]*$/.test(v)) o[k] = v; else bad("clothes[" + i + "]." + k + " is a name of lower case letters, digits and _"); return; }
        if (typeof v !== "number" || !isFinite(v)) { bad("clothes[" + i + "]." + k + " is a number"); return; }
        const lim = k === "ease" ? [0, 0.15] : k === "thickness" ? [0.001, 0.03] : [0, 1];                       // (`length`: how far down the leg a skirt, a dress, a coat goes, 0 .. 1)
        if (v < lim[0] || v > lim[1]) { if (!notes) throw new Error(tag + "clothes[" + i + "]." + k + " goes from " + lim[0] + " to " + lim[1] + " (" + v + ")"); notes.push(tag + "clothes[" + i + "]." + k + " goes from " + lim[0] + " to " + lim[1] + ": " + v + " is held to " + (v < lim[0] ? lim[0] : lim[1])); o[k] = clamp(v, lim[0], lim[1]); return; }
        o[k] = v;
      });
      out.push(o);
    });
    return out;
  }
  function dress(ctx, list) {
    if (!ctx.under) ctx.under = new Float32Array(ctx.B.n);
    if (ctx.A.y.crotch === undefined) ctx.A.y.crotch = crotch_y(ctx.B, ctx.A);
    const pieces = [];
    list.forEach(function (g) { pieces.push(garment(ctx, g)); });
    return pieces;
  }
  return { HEAD_KINDS: ["cap", "beanie", "hat", "beret"], clean: clean, kinds: function () { return Object.keys(KINDS); }, body: body, anchors: anchors, crotch_y: crotch_y, clip: clip, finish: finish, boundary_loops: boundary_loops, garment: garment, dress: dress, make_field: make_field, KINDS: KINDS, BIG: BIG, normals_of: normals_of,
    helpers: { clamp: clamp, smooth: smooth, sub: sub, add: add, mul: mul, dot: dot, cross: cross, len: len, unit: unit, lerp: lerp, colour_of: colour_of } };
});

// ========================================================================================================================
// human_lite_hair
// ========================================================================================================================
packing()("human_lite_hair", function human_lite_hair(wear) {
  "use strict";
  // HUMAN LITE HAIR: the hair, the brows and the beard of a lite person, made of her own head (pure: no engine, no GL, no system; plain arrays in, plain objects out; Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no
  // classes). NOTHING IS LOADED: a style is a recipe. The scalp is a DOME of rays cast from the middle of her skull (so it is as round as the head, whatever the coarse mesh under it), cut at a hairline that the style and the sex draw, pushed out by the
  // thickness of the style (3 mm of a buzz cut, 65 mm of an afro), and closed at the hairline by a wall; long hair adds a MANTLE (a closed sheet that hangs from the scalp, kept out of the body, with spring chains of bones), a pony tail and a braid
  // are tubes, a bun a ball; brows are PAINTED on the face; a beard is a shell of the jaw's own skin (the clip of human_lite_wear.js). Everything is of the part "hair" (system's variants dye parts by name).
  //   const H = human_lite_hair(wear)               wear: human_lite_wear.js (the body, the clip, the finish, the pieces of the contract)
  //   H.clean(def, tag, notes) -> the spec of what the definition asks for (def.hair, def.brows, def.beard), or null    a mistake is left out and said in `notes` (the creature is made offline of whatever it is given); notes null: an Error
  //   H.grow(ctx, spec) -> { pieces: [piece], paint: null | { idx: Int32Array, rgb: Float32Array (3 an entry), a: Float32Array } }       ctx: { B, A, notes, tag, look, years, seed, shape (her parameters), sc } of human_lite_wear.js
  //   H.styles() -> [{ name, sex, min_age, long, dynamic, label }]    H.STYLES the table    H.COLOURS { name: [r, g, b] }    H.BROW_STYLES    H.BEARD_STYLES (plain names)    H.beard_styles() -> [{ name, label }]    H.colour(c) -> [r, g, b] | null
  //   H.surface(B, ymin) -> { closest(p) -> { q, n, s (the signed distance to the real surface), d, vn } | null, push(p, margin) }    the skin of the body near the hair, by its triangles (the tests check that hair is out of it with it)
  //   the definition:  hair: "short" | { style, colour, length 0 .. 1 (0.5), volume 0 .. 1 (0.5), seed, dynamic, part } · brows: true | { colour, thick 0 .. 1, style } · beard: "full" | { style, colour, length 0 .. 1 }
  const clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  const lerp = function (a, b, t) { return a + (b - a) * t; };
  const smooth = function (a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }, add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }, mul = function (a, k) { return [a[0] * k, a[1] * k, a[2] * k]; };
  const dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }, cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  const len = function (a) { return Math.sqrt(dot(a, a)); }, unit = function (a) { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const round = function (x, n) { const m = Math.pow(10, n === undefined ? 5 : n); return Math.round(x * m) / m; };
  const DEG = Math.PI / 180, TAU = 2 * Math.PI;
  const rng_of = function (seed) { let s = (Math.floor(seed) >>> 0) + 0x9E3779B9; return function () { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
  const hash = function (s) { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

  // ---- THE COLOURS (linear, the skin palette's space: generate/unit.js hair_rgb ramp)
  const COLOURS = { black: [0.06, 0.05, 0.045], dark_brown: [0.17, 0.11, 0.065], brown: [0.30, 0.19, 0.10], chestnut: [0.40, 0.22, 0.11], auburn: [0.45, 0.20, 0.10], red: [0.55, 0.22, 0.10], ginger: [0.62, 0.30, 0.12], blonde: [0.80, 0.63, 0.33], platinum: [0.90, 0.84, 0.70], grey: [0.55, 0.55, 0.56], white: [0.85, 0.85, 0.86] };
  function colour(c) {
    if (typeof c === "string") return COLOURS[c] ? COLOURS[c].slice() : null;
    if (Array.isArray(c) && c.length >= 3 && c.slice(0, 3).every(function (x) { return typeof x === "number" && isFinite(x); })) return [clamp(c[0], 0, 1), clamp(c[1], 0, 1), clamp(c[2], 0, 1)];
    return null;
  }

  // ---- THE STYLES. `prof`: the hairline as knots [degrees from the front, k] (k: how high over her eyes, in shares of the way from her eyes to the top of her head: 0.6 a forehead's hairline, 0 at the eyes, negative under them), for a
  // man `m` and a woman `f`; `ears`: the ears stay out; `top` / `edge`: the thickness of the hair (metres) on top and at the hairline; `front`: the share of the edge at the front (a fringe); `quiff`: volume at the front of the top
  const PROF = {
    short_m: [[0, 0.56], [22, 0.53], [38, 0.45], [52, 0.34], [64, 0.22], [74, 0.22], [86, 0.38], [105, 0.30], [125, 0.0], [150, -0.30], [180, -0.46]],
    short_f: [[0, 0.52], [22, 0.50], [38, 0.43], [52, 0.34], [64, 0.24], [74, 0.24], [86, 0.38], [105, 0.28], [125, -0.04], [150, -0.34], [180, -0.50]],
    crop_m: [[0, 0.54], [22, 0.52], [38, 0.43], [52, 0.32], [64, 0.22], [74, 0.22], [86, 0.36], [105, 0.26], [125, -0.04], [150, -0.26], [180, -0.38]],
    buzz_m: [[0, 0.52], [22, 0.50], [38, 0.41], [52, 0.30], [64, 0.22], [74, 0.22], [86, 0.34], [105, 0.22], [125, -0.06], [150, -0.22], [180, -0.30]],
    covered: [[0, 0.40], [25, 0.38], [45, 0.20], [62, 0.0], [85, -0.10], [108, -0.20], [132, -0.30], [158, -0.40], [180, -0.44]],
    pulled: [[0, 0.60], [25, 0.58], [45, 0.46], [62, 0.38], [85, 0.38], [108, 0.22], [132, -0.04], [158, -0.30], [180, -0.40]],
    afro: [[0, 0.50], [25, 0.46], [45, 0.34], [62, 0.18], [85, 0.10], [108, 0.0], [132, -0.10], [158, -0.22], [180, -0.28]],
    bob: [[0, 0.30], [25, 0.30], [45, 0.24], [62, 0.14], [85, 0.10], [108, 0.12], [132, 0.0], [158, -0.1], [180, -0.16]],
    medium: [[0, 0.44], [25, 0.42], [45, 0.30], [62, 0.20], [85, 0.12], [108, 0.06], [132, -0.04], [158, -0.14], [180, -0.2]]
  };
  const STYLES = {
    bald: { label: "bald", sex: "", min_age: 0, long: false, dynamic: false },
    buzz: { label: "buzz cut", sex: "m", min_age: 5, long: false, dynamic: false, prof: { m: PROF.buzz_m, f: PROF.buzz_m }, ears: true, top: 0.003, edge: 0.002, front: 1, rows: 5, cols: 36 },
    crop: { label: "crop", sex: "m", min_age: 3, long: false, dynamic: false, prof: { m: PROF.crop_m, f: PROF.short_f }, ears: true, top: 0.009, edge: 0.004, front: 0.8, rows: 6, cols: 36 },
    short: { label: "short, swept", sex: "m", min_age: 3, long: false, dynamic: false, prof: { m: PROF.short_m, f: PROF.short_f }, ears: true, top: 0.020, edge: 0.008, front: 0.7, quiff: 0.010, rows: 7, cols: 36 },
    medium: { label: "medium, shaggy", sex: "", min_age: 3, long: false, dynamic: false, prof: { m: PROF.medium, f: PROF.medium }, ears: false, top: 0.016, edge: 0.012, front: 1, rows: 6, cols: 36, mantle: { style: "medium", start: 42, end: "neck", rag: 0.3, cols: 24, rows: 5, links: 3, conv: [1.04, 0.9], curl: 1.3 } },
    bob: { label: "bob", sex: "f", min_age: 3, long: false, dynamic: false, prof: { m: PROF.bob, f: PROF.bob }, ears: false, top: 0.015, edge: 0.013, front: 1.1, rows: 6, cols: 36, mantle: { style: "bob", start: 30, end: "jaw", rag: 0.05, cols: 24, rows: 5, links: 3, curl: 1, conv: [1.0, 0.9] } },
    long: { label: "long", sex: "f", min_age: 4, long: true, dynamic: true, prof: { m: PROF.pulled, f: PROF.pulled }, ears: true, top: 0.014, edge: 0.010, front: 0.9, rows: 6, cols: 36, mantle: { style: "long", start: 96, end: "back", rag: 0.5, cols: 26, rows: 11, links: 4, chains: 5, conv: [1.3, 0.7] } },
    ponytail: { label: "pony tail", sex: "f", min_age: 4, long: true, dynamic: true, prof: { m: PROF.pulled, f: PROF.pulled }, ears: true, top: 0.010, edge: 0.006, front: 0.8, rows: 6, cols: 36, tube: { kind: "pony", length: 0.30, r0: 0.020, links: 5 } },
    braid: { label: "braid", sex: "f", min_age: 4, long: true, dynamic: true, prof: { m: PROF.pulled, f: PROF.pulled }, ears: true, top: 0.010, edge: 0.006, front: 0.8, rows: 6, cols: 36, tube: { kind: "braid", length: 0.42, r0: 0.020, links: 6 } },
    bun: { label: "bun", sex: "f", min_age: 4, long: false, dynamic: false, prof: { m: PROF.pulled, f: PROF.pulled }, ears: true, top: 0.011, edge: 0.006, front: 0.8, rows: 6, cols: 36, bun: { r: 0.046 } },
    afro: { label: "afro", sex: "", min_age: 3, long: false, dynamic: false, prof: { m: PROF.afro, f: PROF.afro }, ears: false, top: 0.060, edge: 0.040, front: 0.45, rows: 7, cols: 36 },
    curly: { label: "curly", sex: "", min_age: 3, long: false, dynamic: false, prof: { m: PROF.covered, f: PROF.covered }, ears: false, top: 0.030, edge: 0.020, front: 0.7, bumps: 0.024, rows: 8, cols: 36, mantle: null },
    mohawk: { label: "mohawk", sex: "m", min_age: 10, long: false, dynamic: false, prof: { m: PROF.crop_m, f: PROF.crop_m }, ears: true, top: 0.003, edge: 0.002, front: 1, rows: 5, cols: 36, ridge: { h: 0.055, w: 0.016 } }
  };
  const STYLE_NAMES = Object.keys(STYLES);
  const styles = function () { return STYLE_NAMES.map(function (n) { const s = STYLES[n]; return { name: n, label: s.label, sex: s.sex, min_age: s.min_age, long: s.long, dynamic: s.dynamic }; }); };
  const BROW_STYLES = ["straight", "arched", "thick", "thin"], BEARD_STYLES = ["stubble", "moustache", "goatee", "short", "full", "handlebar", "walrus", "pencil", "chinstrap"];
  const BEARD_LABELS = { stubble: "stubble", moustache: "moustache", goatee: "goatee", short: "short beard", full: "full beard", handlebar: "handlebar moustache", walrus: "walrus moustache", pencil: "pencil moustache", chinstrap: "chinstrap beard" };
  const beard_styles = function () { return BEARD_STYLES.map(function (n) { return { name: n, label: BEARD_LABELS[n] }; }); };

  // ---- THE SPEC: what the definition says, held to what can be made (a mistake is said in `notes`, left out; given no notes it is an Error)
  const HAIR_KEYS = ["style", "colour", "length", "volume", "seed", "dynamic", "part"], BROW_KEYS = ["colour", "thick", "style"], BEARD_KEYS = ["style", "colour", "length"];
  function clean(def, tag, notes) {
    if (!def || typeof def !== "object") return null;
    const bad = function (msg) { if (!notes) throw new Error(tag + msg); notes.push(tag + msg + ": left out"); };
    const num = function (v, lo, hi, what, d) {
      if (typeof v === "string" && v.trim() !== "" && isFinite(+v) && notes) v = +v;
      if (typeof v !== "number" || !isFinite(v)) { bad(what + " is a number"); return d; }
      if (v < lo || v > hi) { if (!notes) throw new Error(tag + what + " goes from " + lo + " to " + hi + " (" + v + ")"); notes.push(tag + what + " goes from " + lo + " to " + hi + ": " + v + " is held to " + (v < lo ? lo : hi)); return v < lo ? lo : hi; }
      return v;
    };
    const col = function (v, what) { const c = colour(v); if (!c) { bad(what + " is [r, g, b], 0 .. 1, or one of " + Object.keys(COLOURS).join(", ")); return null; } if (Array.isArray(v) && (v[0] !== c[0] || v[1] !== c[1] || v[2] !== c[2]) && notes) notes.push(tag + what + " is held to 0 .. 1"); return c; };
    let hair = null, brows = null, beard = null, given = false;
    // the hair
    let h = def.hair;
    if (h !== undefined && h !== null && h !== false) {
      given = true;
      if (typeof h === "string") h = { style: h };
      if (typeof h !== "object" || Array.isArray(h)) { bad("hair is a style (" + STYLE_NAMES.join(", ") + ") or { style, colour, length, volume, seed, dynamic, part }"); h = null; }
      if (h) {
        const sp = { style: "short", colour: null, length: 0.5, volume: 0.5, seed: 1, dynamic: null, part: "hair" };
        Object.keys(h).forEach(function (k) {
          const v = h[k];
          if (HAIR_KEYS.indexOf(k) < 0) { bad("hair: unknown field '" + k + "' (" + HAIR_KEYS.join(", ") + ")"); return; }
          if (k === "style") { if (typeof v === "string" && STYLES[v] && Object.prototype.hasOwnProperty.call(STYLES, v)) sp.style = v; else { bad("hair: no style '" + v + "' (" + STYLE_NAMES.join(", ") + ")"); sp.style = "bald"; } return; }
          if (k === "colour") { sp.colour = col(v, "hair.colour"); return; }
          if (k === "length" || k === "volume") { sp[k] = num(v, 0, 1, "hair." + k, sp[k]); return; }
          if (k === "seed") { const s = num(v, -1e9, 1e9, "hair.seed", 1); sp.seed = Math.floor(s); return; }
          if (k === "dynamic") { if (typeof v === "boolean") sp.dynamic = v; else bad("hair.dynamic is true or false"); return; }
          if (k === "part") { if (typeof v === "string" && /^[a-z][a-z0-9_]*$/.test(v)) sp.part = v; else bad("hair.part is a name of lower case letters, digits and _"); }
        });
        hair = sp;
      }
    } else if (h === undefined && def.hair === undefined) hair = null;
    // the brows: on by default when hair is asked for
    let b = def.brows;
    if (b === undefined || b === null) b = given ? true : false;
    if (b !== false) {
      if (b === true) b = {};
      if (typeof b !== "object" || Array.isArray(b)) { bad("brows is true, false or { colour, thick, style }"); b = null; }
      if (b) {
        const sp = { colour: null, thick: 0.5, style: "straight" };
        Object.keys(b).forEach(function (k) {
          const v = b[k];
          if (BROW_KEYS.indexOf(k) < 0) { bad("brows: unknown field '" + k + "' (" + BROW_KEYS.join(", ") + ")"); return; }
          if (k === "colour") { sp.colour = col(v, "brows.colour"); return; }
          if (k === "thick") { sp.thick = num(v, 0, 1, "brows.thick", 0.5); return; }
          if (k === "style") { if (BROW_STYLES.indexOf(v) >= 0) sp.style = v; else bad("brows.style is one of " + BROW_STYLES.join(", ")); }
        });
        brows = sp;
      }
    }
    // the beard
    let d = def.beard;
    if (d !== undefined && d !== null && d !== false) {
      if (typeof d === "string") d = { style: d };
      if (typeof d !== "object" || Array.isArray(d)) { bad("beard is a style (" + BEARD_STYLES.join(", ") + ") or { style, colour, length }"); d = null; }
      if (d) {
        const sp = { style: "short", colour: null, length: 0.5 };
        let ok = true;
        Object.keys(d).forEach(function (k) {
          const v = d[k];
          if (BEARD_KEYS.indexOf(k) < 0) { bad("beard: unknown field '" + k + "' (" + BEARD_KEYS.join(", ") + ")"); return; }
          if (k === "style") { if (BEARD_STYLES.indexOf(v) >= 0) sp.style = v; else { ok = false; bad("beard: no style '" + v + "' (" + BEARD_STYLES.join(", ") + ")"); } return; }
          if (k === "colour") { sp.colour = col(v, "beard.colour"); return; }
          if (k === "length") sp.length = num(v, 0, 1, "beard.length", 0.5);
        });
        beard = ok ? sp : null;
      }
    }
    if (hair && hair.style === "bald") hair = { style: "bald", colour: hair.colour, length: 0, volume: 0, seed: hair.seed, dynamic: false, part: hair.part };
    if (!hair && !brows && !beard) return null;
    return { hair: hair, brows: brows, beard: beard };
  }

  // ---- THE SKULL: the middle of it, and rays from there (the head as it is: any size, any shape). `ctx.B` is the body of human_lite_wear.js
  function skull(ctx) {
    const B = ctx.B, pt = ctx.A.pt, top = pt("head.tail"), eL = pt("eye.L.head"), eR = pt("eye.R.head"), ey = 0.5 * (eL[1] + eR[1]), H = Math.max(top[1] - ey, 0.03), hs = H / 0.115;
    const yc = ey + 0.3 * H, o = [0, yc, top[2]];
    let zf = B.ray(o, [0, 0, 1], 0.4), zb = B.ray(o, [0, 0, -1], 0.4);
    if (!isFinite(zf)) zf = 0.1 * hs; if (!isFinite(zb)) zb = 0.09 * hs;
    const c = [0, yc, top[2] + 0.5 * (zf - zb)];
    const dir = function (phi, lat) { const cl = Math.cos(lat); return [Math.sin(phi) * cl, Math.sin(lat), Math.cos(phi) * cl]; };
    const sk = { B: B, c: c, ey: ey, top: top[1], H: H, hs: hs, dir: dir, fallback: 0.092 * hs };
    sk.r = function (phi, lat) { const d = dir(phi, lat), t = B.ray(c, d, 0.5); return isFinite(t) ? t : sk.fallback; };
    // the ear: where it is round the head (degrees from the front) and how high its top is
    const ea = pt("ear.L.base"), et = pt("ear.L.tip");
    sk.ear_phi = Math.atan2(ea[0] - c[0], ea[2] - c[2]) / DEG; sk.ear_top = Math.max(et[1], ea[1]);
    sk.ear_k = (sk.ear_top - ey) / H;
    return sk;
  }
  function profile_k(knots, deg) {                                                                       // the hairline's height at an angle (0 .. 180, the head is symmetric)
    deg = Math.abs(deg); if (deg > 180) deg = 360 - deg;
    for (let i = 0; i < knots.length - 1; i++) if (deg <= knots[i + 1][0]) { const a = knots[i], b = knots[i + 1], t = (deg - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], t * t * (3 - 2 * t)); }
    return knots[knots.length - 1][1];
  }
  // the weights of a vertex of the body for a piece of hair on it: the body's own, the eyelids' and the eyes' given to the head (hair does not blink)
  function skin_of(model, v, out, at) {
    const acc = {};
    for (let q = 0; q < 4; q++) {
      const w = model.skin_weights[4 * v + q] / 255; if (!w) continue;
      let b = model.skin_indices[4 * v + q]; const nm = model.bones[b].name;
      if (/^(lid|eye)\./.test(nm)) b = model.bones.findIndex(function (x) { return x.name === "head"; });
      acc[b] = (acc[b] || 0) + w;
    }
    const list = Object.keys(acc).map(function (k) { return [+k, acc[k]]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 4);
    let tot = 0; list.forEach(function (e) { tot += e[1]; });
    for (let q = 0; q < 4; q++) { if (q < list.length) { out.i[4 * at + q] = list[q][0]; out.w[4 * at + q] = list[q][1] / tot; } else { out.i[4 * at + q] = 0; out.w[4 * at + q] = 0; } }
  }
  // a shell of the contract of wear.finish out of a grid of points on the skin: S { n, tris, pos0, nrm, skin_i, skin_w } and the thickness of each; -> the piece
  function shell_piece(ctx, pos0, nrm, tris, thick, colr, opts) {
    const n = pos0.length / 3, model = ctx.B.model, sk_i = new Int16Array(4 * n), sk_w = new Float32Array(4 * n), tmp = { i: sk_i, w: sk_w };
    const head = model.bones.findIndex(function (x) { return x.name === "head"; }), y_low = opts.y_low === undefined ? -1e9 : opts.y_low;
    for (let i = 0; i < n; i++) {
      if (pos0[3 * i + 1] > y_low) { sk_i[4 * i] = head; sk_w[4 * i] = 1; continue; }                     // (the skull is the head's: the weights of the nearest vertex are looked up only low down, where the neck begins)
      skin_of(model, ctx.B.nearest(pos0[3 * i], pos0[3 * i + 1], pos0[3 * i + 2]), tmp, i);
    }
    const S = { n: n, at: new Int32Array(n).fill(-1), a: new Int32Array(n), b: new Int32Array(n).fill(-1), t: new Float32Array(n), tris: Int32Array.from(tris), pos0: pos0, nrm: nrm, skin_i: sk_i, skin_w: sk_w, cut: opts.edge || new Uint8Array(n), cover: null };
    const pc = wear.finish(ctx.B, S, { keep_cut: !!opts.edge, thickness: 0.0005, ease: function (s, i) { return thick[i]; }, guard: false, smooth: opts.smooth === undefined ? 2 : opts.smooth, colour: colr, variation: opts.variation === undefined ? 0.04 : opts.variation, lip: 1, lip_colour: [colr[0] * 0.8, colr[1] * 0.8, colr[2] * 0.8], name: opts.name || "hair", part: opts.part || "hair", rough: 0.6 });
    pc.cover = null;
    return pc;
  }
  // the lightness of the vertices of a piece, by a function of the vertex (hue is kept: system's dye changes the hue and keeps the lightness)
  function shade(pc, n, f) { for (let i = 0; i < pc.colors.length / 3; i++) { const k = f(i, i < n); for (let c = 0; c < 3; c++) pc.colors[3 * i + c] = clamp(pc.colors[3 * i + c] * k, 0, 1); } }

  // the vertices of a finished piece that are in the skin (a smoothing took them there) are put out of it
  function clear_of_skin(pc, surf, margin, upto) {
    const P = pc.pos, p = [0, 0, 0];
    for (let i = 0; i < (upto === undefined ? P.length / 3 : upto); i++) { p[0] = P[3 * i]; p[1] = P[3 * i + 1]; p[2] = P[3 * i + 2]; const cl = surf.closest(p); if (cl && cl.s < margin) { const k = margin - cl.s; P[3 * i] += cl.n[0] * k; P[3 * i + 1] += cl.n[1] * k; P[3 * i + 2] += cl.n[2] * k; } }
  }
  // the body's vertices that the dome covers: the direction from the middle of the skull is inside the hairline (by 3 degrees) and the vertex is lower than the hair's outer surface there (the radius of the grid, by its four corners), 1.5 mm at the least
  function cap_cover(ctx, sk, C, R, lat_h, sm, thick) {
    const B = ctx.B, P = B.P, n = B.n, c = sk.c, cover = new Uint8Array(n);
    const outer = function (i, j) { if (i <= 0) return sm[0] + thick[0]; const idx = 1 + (i - 1) * C + j; return sm[idx] + thick[idx]; };
    for (let v = 0; v < n; v++) {
      const dx = P[3 * v] - c[0], dy = P[3 * v + 1] - c[1], dz = P[3 * v + 2] - c[2], r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r < 1e-6 || r > 0.22 * sk.hs) continue;                                                       // (the head's: the shoulders and the arms are not under a hairline)
      const lat = Math.asin(clamp(dy / r, -1, 1)); let phi = Math.atan2(dx, dz); if (phi < 0) phi += TAU;
      const x = phi / TAU * C, f = x - Math.floor(x), j0 = Math.floor(x) % C, j1 = (j0 + 1) % C, lh = lerp(lat_h[j0], lat_h[j1], f);
      if (lat < lh + 0.05) continue;
      const row = clamp((Math.PI / 2 - lat) / (Math.PI / 2 - lh), 0, 1) * R, i0 = Math.min(Math.floor(row), R - 1), g = row - i0;
      const top = lerp(outer(i0, j0), outer(i0, j1), f), bot = lerp(outer(i0 + 1, j0), outer(i0 + 1, j1), f);
      if (r + 0.0015 < lerp(top, bot, g)) cover[v] = 1;
    }
    return cover;
  }
  // the head's own vertices are the peaks of its facets (the mesh is coarse: a vertex stands up to a centimetre over the surface that rays find between the vertices): the hair is raised over each vertex that is inside the hairline, at the
  // four points of the grid round it (the least that lifts the hair over it: by its weights), so that no vertex of the scalp is over the hair. `margin`: how far over the vertex the hair is (metres)
  function raise_over_vertices(ctx, sk, C, R, lat_h, sm, thick, margin) {
    const B = ctx.B, P = B.P, n = B.n, c = sk.c, ix = function (i, j) { return i <= 0 ? 0 : 1 + (i - 1) * C + j; };
    for (let v = 0; v < n; v++) {
      const dx = P[3 * v] - c[0], dy = P[3 * v + 1] - c[1], dz = P[3 * v + 2] - c[2], r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r < 1e-6 || r > 0.22 * sk.hs) continue;                                                       // (the head's: the shoulders and the arms are not under a hairline)
      const lat = Math.asin(clamp(dy / r, -1, 1)); let phi = Math.atan2(dx, dz); if (phi < 0) phi += TAU;
      const x = phi / TAU * C, f = x - Math.floor(x), j0 = Math.floor(x) % C, j1 = (j0 + 1) % C, lh = lerp(lat_h[j0], lat_h[j1], f);
      if (lat < lh) continue;
      const row = clamp((Math.PI / 2 - lat) / (Math.PI / 2 - lh), 0, 1) * R, i0 = Math.min(Math.floor(row), R - 1), g = row - i0;
      const k = [ix(i0, j0), ix(i0, j1), ix(i0 + 1, j0), ix(i0 + 1, j1)], w = [(1 - f) * (1 - g), f * (1 - g), (1 - f) * g, f * g];
      let have = 0, w2 = 0; for (let q = 0; q < 4; q++) { have += w[q] * (sm[k[q]] + thick[k[q]]); w2 += w[q] * w[q]; }
      const need = r + margin;
      if (have < need && w2 > 1e-9) { const d = need - have; for (let q = 0; q < 4; q++) thick[k[q]] += d * w[q] / w2; }
    }
  }
  // ---- THE CAP: the dome of the style
  //   returns { piece, sk, lat_h (per column) } ; sp the hair spec, st its style
  function make_cap(ctx, sk, sp, st, sex_f, hs_k, rnd, surf, hw) {
    const C = st.cols, R = st.rows, knots = sex_f ? st.prof.f : st.prof.m, H = sk.H, ey = sk.ey, c = sk.c;
    const vm = 0.6 + 0.8 * sp.volume, vol = vm * hs_k;
    // the hairline, column by column: the height (k), the ears kept out, then the angle that puts the hairline at that height
    const lat_h = new Float32Array(C), phis = new Float32Array(C), r_h = new Float32Array(C), kk = new Float32Array(C);
    for (let j = 0; j < C; j++) {
      const phi = TAU * j / C; phis[j] = phi;
      const deg = phi / DEG, wd = deg > 180 ? deg - 360 : deg;
      let k = profile_k(knots, deg);
      if (st.ears) { const d = Math.abs(Math.abs(wd) - sk.ear_phi), kear = sk.ear_k + 0.1; k = Math.max(k, lerp(kear, -9, smooth(10, 26, d))); }
      kk[j] = k;
      const yh = ey + k * H, r0 = sk.r(phi, 0);
      let lat = Math.atan2(yh - c[1], r0);
      for (let it = 0; it < 2; it++) { const r = sk.r(phi, lat), yhit = c[1] + Math.sin(lat) * r; lat = clamp(lat + (yh - yhit) / Math.max(r, 0.05), -1.15, 1.45); }
      lat_h[j] = lat; r_h[j] = sk.r(phi, lat);
    }
    // the grid: the pole, then R rings; the radius of the skull on each (raw, then smoothed)
    const n = 1 + R * C, raw = new Float32Array(n), lat = new Float32Array(n);
    raw[0] = sk.r(0, Math.PI / 2); lat[0] = Math.PI / 2;
    for (let i = 1; i <= R; i++) for (let j = 0; j < C; j++) {
      const idx = 1 + (i - 1) * C + j, u = i / R; lat[idx] = lerp(Math.PI / 2, lat_h[j], u);
      raw[idx] = i === R ? r_h[j] : sk.r(phis[j], lat[idx]);
    }
    // an ear that is much bigger than a person's, a horn: not part of the skull (the dome is the skull's: a ring's rays are held to a little over their middle one)
    for (let i = 1; i <= R; i++) {
      const ring = []; for (let j = 0; j < C; j++) ring.push(raw[1 + (i - 1) * C + j]);
      const med = ring.slice().sort(function (a, b) { return a - b; })[Math.floor(C / 2)];
      for (let j = 0; j < C; j++) { const idx = 1 + (i - 1) * C + j; if (raw[idx] > 1.14 * med) raw[idx] = 1.14 * med; }
    }
    let sm = Float32Array.from(raw), tmp = new Float32Array(n);
    for (let it = 0; it < 2; it++) {
      for (let i = 1; i <= R; i++) for (let j = 0; j < C; j++) {
        const idx = 1 + (i - 1) * C + j, l = 1 + (i - 1) * C + (j + C - 1) % C, r = 1 + (i - 1) * C + (j + 1) % C, up = i === 1 ? 0 : idx - C, dn = i === R ? idx : idx + C;
        tmp[idx] = 0.4 * sm[idx] + 0.15 * (sm[l] + sm[r]) + 0.15 * (sm[up] + sm[dn]);
      }
      let top = 0; for (let j = 0; j < C; j++) top += tmp[1 + j] / C;
      tmp[0] = 0.5 * sm[0] + 0.5 * top; const t = sm; sm = tmp; tmp = t;                                     // (the pole is the mean of its ring: the top of the head is round, not a nipple)
    }
    // the points, the thickness
    const pos0 = new Float32Array(3 * n), nrm = new Float32Array(3 * n), thick = new Float32Array(n);
    const front_k = function (wd) { return 1 - smooth(20, 60, Math.abs(wd)); };
    for (let idx = 0; idx < n; idx++) {
      let phi = 0, u = 0, j = 0;
      if (idx > 0) { j = (idx - 1) % C; phi = phis[j]; u = (Math.floor((idx - 1) / C) + 1) / R; }
      const d = sk.dir(phi, lat[idx]), r = sm[idx];
      pos0[3 * idx] = c[0] + d[0] * r; pos0[3 * idx + 1] = c[1] + d[1] * r; pos0[3 * idx + 2] = c[2] + d[2] * r;
      nrm[3 * idx] = d[0]; nrm[3 * idx + 1] = d[1]; nrm[3 * idx + 2] = d[2];
      const deg = phi / DEG, wd = deg > 180 ? deg - 360 : deg, fr = front_k(wd);
      const edge = st.edge * lerp(1, st.front, fr), tt = lerp(st.top * (0.6 + 0.8 * sp.length), edge, smooth(0.3, 1, u));
      let t = tt * vol;
      if (st.quiff) t += st.quiff * vol * smooth(0.15, 0.8, d[2]) * smooth(0.3, 0.8, d[1]);
      if (st.bumps) { const b = Math.sin(8 * phi + 1.7) * Math.sin(8 * lat[idx] + 0.6) + 0.6 * Math.sin(12 * phi - 2.2 + 4 * lat[idx]); t += st.bumps * vol * Math.max(0, b) * (1 - 0.65 * smooth(0.5, 1, u)); }
      if (hw) t = Math.min(t, hw.tmax);                                                                  // (under a cap, a hat, a beanie: as thin as the cloth allows)
      let clear = Math.max(0, raw[idx] - sm[idx]);
      if (idx > 0) { const jl = 1 + (Math.floor((idx - 1) / C)) * C, l = jl + (j + C - 1) % C, r = jl + (j + 1) % C; clear = Math.max(clear, raw[l] - sm[l], raw[r] - sm[r]); if (idx > C) clear = Math.max(clear, raw[idx - C] - sm[idx - C]); if (idx + C < n) clear = Math.max(clear, raw[idx + C] - sm[idx + C]); }
      thick[idx] = Math.max(0.004, t) + Math.max(0, clear) + 0.0015;                                    // (never less than 4 mm: the skin must not show at the edge triangles of a coarse head)
    }
    // the hair is made to stand out of the skin: where the skull is not as smooth as the dome (a bump between two rays), the thickness grows to clear it
    const thick0 = Float32Array.from(thick);
    for (let it = 0; it < 2; it++) for (let idx = 0; idx < n; idx++) {
      const q = [pos0[3 * idx] + nrm[3 * idx] * thick[idx], pos0[3 * idx + 1] + nrm[3 * idx + 1] * thick[idx], pos0[3 * idx + 2] + nrm[3 * idx + 2] * thick[idx]], cl = surf.closest(q);
      if (cl && cl.s < 0.0025) thick[idx] += Math.min(0.0025 - cl.s, 0.004);                               // (a horn or an ear of a mutant is not what the hair clears)
    }
    for (let idx = 0; idx < n; idx++) thick[idx] = Math.min(thick[idx], Math.max(thick0[idx] + 0.008, 0.01));
    const lumpy = st.top >= 0.02;                                                                       // (a thick head of hair is smoothed once: it hides what the raise leaves; a close one is not: it is the skull)
    raise_over_vertices(ctx, sk, C, R, lat_h, sm, thick, lumpy ? 0.006 : 0.0028);
    // the triangles: a fan from the pole, then the quads of the rings (turned to face out by the test below)
    const tris = [];
    for (let j = 0; j < C; j++) tris.push(0, 1 + j, 1 + (j + 1) % C);
    for (let i = 1; i < R; i++) for (let j = 0; j < C; j++) {
      const a = 1 + (i - 1) * C + j, b = 1 + (i - 1) * C + (j + 1) % C, a2 = a + C, b2 = b + C;
      tris.push(a, a2, b, b, a2, b2);
    }
    const flip = (function () { let s = 0; for (let t = 0; t < tris.length; t += 3) { const p = [pos0[3 * tris[t]], pos0[3 * tris[t] + 1], pos0[3 * tris[t] + 2]], q = [pos0[3 * tris[t + 1]], pos0[3 * tris[t + 1] + 1], pos0[3 * tris[t + 1] + 2]], w = [pos0[3 * tris[t + 2]], pos0[3 * tris[t + 2] + 1], pos0[3 * tris[t + 2] + 2]]; const nn = cross(sub(q, p), sub(w, p)); s += dot(nn, sub(mul(add(add(p, q), w), 1 / 3), c)); } return s < 0; })();
    if (flip) for (let t = 0; t < tris.length; t += 3) { const x = tris[t + 1]; tris[t + 1] = tris[t + 2]; tris[t + 2] = x; }
    const edge = new Uint8Array(n); for (let j = 0; j < C; j++) edge[1 + (R - 1) * C + j] = 1;           // (the hairline is not smoothed: it would creep up the head)
    const base = sp.colour || COLOURS.brown, pc = shell_piece(ctx, pos0, nrm, tris, thick, base, { name: "hair", part: sp.part, smooth: lumpy ? 1 : 0, y_low: ey - 0.03 * sk.hs, edge: edge });
    // the colours: darker at the roots (the hairline), streaks from column to column (lightness only)
    const streak = []; for (let j = 0; j < C; j++) streak.push(0.93 + 0.14 * rnd());
    const col_of = function (i) { return i === 0 ? 1 : streak[(i - 1) % C] * 0.5 + 0.5 * streak[((i - 1) % C + 1) % C]; };
    shade(pc, n, function (i, own) { if (!own) return 0.7; if (i === 0) return 1; const u = (Math.floor((i - 1) / C) + 1) / R; return col_of(i) * (0.82 + 0.22 * (1 - u)); });
    clear_of_skin(pc, surf, 0.0012, n);
    // the wall at the hairline goes INTO the skin (3.5 mm toward the middle of the skull): from outside there is no gap that can be seen into, whatever the skin does between the rays
    for (let i = n; i < pc.vertices; i++) { const d = unit([pc.pos[3 * i] - c[0], pc.pos[3 * i + 1] - c[1], pc.pos[3 * i + 2] - c[2]]); pc.pos[3 * i] -= d[0] * 0.0035; pc.pos[3 * i + 1] -= d[1] * 0.0035; pc.pos[3 * i + 2] -= d[2] * 0.0035; }
    // the body's vertices that are under the hair (inside the hairline by a margin, lower than the hair's surface): the scalp is not drawn there (build leaves out the triangles whose three vertices are covered)
    pc.cover = cap_cover(ctx, sk, C, R, lat_h, sm, thick);
    const edge_r = new Float32Array(C), edge_t = new Float32Array(C);
    for (let j = 0; j < C; j++) { const idx = 1 + (R - 1) * C + j; edge_r[j] = sm[idx]; edge_t[j] = thick[idx]; }
    return { piece: pc, sk: sk, lat_h: lat_h, phis: phis, C: C, edge_r: edge_r, edge_t: edge_t };
  }

  // ---- THE BROWS: painted on the face
  function make_brows(ctx, sk, br, hair_col) {
    const B = ctx.B, P = B.P, n = B.n, A = ctx.A, pt = A.pt, out = { idx: [], rgb: [], a: [] };
    const col = br.colour || (hair_col ? hair_col.map(function (x) { return x * 0.8; }) : [0.12, 0.08, 0.05]);
    const male = ctx.shape && ctx.shape.gender > 0.5, hs = sk.hs, thick = (0.0022 + 0.0030 * br.thick) * hs * (male ? 1.15 : 1);
    const st = br.style, lift = (st === "thick" ? 0.019 : 0.022) * hs - (male ? 0.002 : 0);
    ["L", "R"].forEach(function (s) {
      const sg = s === "L" ? 1 : -1, e = pt("eye." + s + ".head"), ex = Math.abs(e[0]);
      const xin = 0.011 * hs, xout = ex + 0.022 * hs, ez = e[2];
      const arc = function (t) {                                                                         // the eyebrow's centre line at t (0 inner .. 1 outer): x (from the middle), y
        const x = lerp(xin, xout, t);
        let a = 0;
        if (st === "arched") a = 0.009 * hs * Math.sin(Math.PI * clamp(t / 0.78, 0, 1.2)) - 0.004 * hs * smooth(0.75, 1, t);
        else if (st === "straight") a = 0.0035 * hs * t - 0.001 * hs;
        else if (st === "thick") a = 0.004 * hs * Math.sin(Math.PI * t) - 0.002 * hs * t;
        else a = 0.007 * hs * Math.sin(Math.PI * clamp(t / 0.8, 0, 1.2)) - 0.003 * hs * smooth(0.7, 1, t);
        return [x, e[1] + lift + a];
      };
      const wt = function (t) { return thick * (st === "thin" ? 0.7 : 1) * (0.55 + 0.45 * Math.sin(Math.PI * clamp(0.18 + 0.82 * t, 0, 1))) * (1 - 0.25 * t); };
      for (let v = 0; v < n; v++) {
        const x = P[3 * v] * sg, y = P[3 * v + 1], z = P[3 * v + 2];
        if (x < 0 || z < ez - 0.012 * hs || Math.abs(y - e[1] - lift) > 0.03 * hs) continue;
        let best = 1e9, bt = 0;
        for (let k = 0; k <= 10; k++) { const t = k / 10, q = arc(t), d = Math.hypot(x - q[0], y - q[1]); if (d < best) { best = d; bt = t; } }
        const w = wt(bt), a = 1 - smooth(w * 0.55, w * 1.25, best);
        if (a > 0.02) { out.idx.push(v); out.rgb.push(col[0], col[1], col[2]); out.a.push(a * 0.92); }
      }
    });
    return { idx: Int32Array.from(out.idx), rgb: Float32Array.from(out.rgb), a: Float32Array.from(out.a) };
  }

  // ---- THE SURFACE (for what hangs): the body's triangles near the hair, a grid of their vertices and the triangles of each, so that a point is pushed OUT of the skin by its distance to the real surface (not to a vertex)
  function make_surface(B, ymin, under) {
    const P = B.P, tris = B.tris, n = B.n, CELL = 0.03, lo = [B.lo[0], Math.min(B.lo[1], ymin), B.lo[2]], hi = B.hi;
    const dim = [Math.ceil((hi[0] - lo[0]) / CELL) + 2, Math.ceil((hi[1] - lo[1]) / CELL) + 2, Math.ceil((hi[2] - lo[2]) / CELL) + 2];
    const cell = function (x, y, z) { const i = Math.floor((x - lo[0]) / CELL), j = Math.floor((y - lo[1]) / CELL), k = Math.floor((z - lo[2]) / CELL); return (i < 0 || j < 0 || k < 0 || i >= dim[0] || j >= dim[1] || k >= dim[2]) ? -1 : (i * dim[1] + j) * dim[2] + k; };
    const nc = dim[0] * dim[1] * dim[2], start = new Int32Array(nc + 1), cid = new Int32Array(n).fill(-1);
    for (let v = 0; v < n; v++) { if (P[3 * v + 1] < ymin) continue; const c = cell(P[3 * v], P[3 * v + 1], P[3 * v + 2]); cid[v] = c; if (c >= 0) start[c + 1]++; }
    for (let c = 0; c < nc; c++) start[c + 1] += start[c];
    const fill = start.slice(0, nc), items = new Int32Array(start[nc]);
    for (let v = 0; v < n; v++) if (cid[v] >= 0) items[fill[cid[v]]++] = v;
    const tstart = new Int32Array(n + 1);
    for (let t = 0; t < tris.length; t++) tstart[tris[t] + 1]++;
    for (let v = 0; v < n; v++) tstart[v + 1] += tstart[v];
    const tfill = tstart.slice(0, n), tlist = new Int32Array(tris.length);
    for (let t = 0; t < tris.length; t++) tlist[tfill[tris[t]]++] = (t / 3) | 0;
    const nearest = function (x, y, z) {
      const ci = Math.floor((x - lo[0]) / CELL), cj = Math.floor((y - lo[1]) / CELL), ck = Math.floor((z - lo[2]) / CELL);
      for (let r = 1; r <= 3; r++) {
        let best = -1, bd = 1e9;
        for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) for (let k = ck - r; k <= ck + r; k++) {
          if (i < 0 || j < 0 || k < 0 || i >= dim[0] || j >= dim[1] || k >= dim[2]) continue;
          const c = (i * dim[1] + j) * dim[2] + k;
          for (let q = start[c]; q < start[c + 1]; q++) { const v = items[q], dx = P[3 * v] - x, dy = P[3 * v + 1] - y, dz = P[3 * v + 2] - z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = v; } }
        }
        if (best >= 0) return best;
      }
      return -1;
    };
    // the closest point of a triangle (Ericson, Real-Time Collision Detection)
    const closest_tri = function (p, a, b, c) {
      const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
      if (d1 <= 0 && d2 <= 0) return a;
      const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
      if (d3 >= 0 && d4 <= d3) return b;
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, mul(ab, d1 / (d1 - d3)));
      const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
      if (d6 >= 0 && d5 <= d6) return c;
      const vb = d5 * d2 - d1 * d6;
      if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, mul(ac, d2 / (d2 - d6)));
      const va = d3 * d6 - d5 * d4;
      if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) return add(b, mul(sub(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6))));
      const den = 1 / (va + vb + vc);
      return add(a, add(mul(ab, vb * den), mul(ac, vc * den)));
    };
    const vert = function (v) { return [P[3 * v], P[3 * v + 1], P[3 * v + 2]]; };
    // -> { q: the closest point of the skin, n: its outward normal, s: the signed distance of p } or null (nothing near)
    const closest = function (p) {
      const v = nearest(p[0], p[1], p[2]); if (v < 0) return null;
      let best = null, bd = 1e9;
      for (let q = tstart[v]; q < tstart[v + 1]; q++) {
        const t = tlist[q], a = vert(tris[3 * t]), b = vert(tris[3 * t + 1]), c = vert(tris[3 * t + 2]), cp = closest_tri(p, a, b, c), d = len(sub(p, cp));
        if (d < bd) { bd = d; best = { q: cp, n: unit(cross(sub(b, a), sub(c, a))), d: d, v: v, vn: [B.N[3 * v], B.N[3 * v + 1], B.N[3 * v + 2]] }; }
      }
      if (!best) return null;
      best.s = dot(sub(p, best.q), best.n) >= 0 ? best.d : -best.d;
      return best;
    };
    // `under`: how far out the clothes are over each vertex of the body (human_lite_wear.js ctx.under): hair lies on them, not on the skin
    // a push that leaves the sideways place of a point alone: the hair is lifted over a shoulder and pushed back off the back, not made wider (where the skin faces sideways, at the head, the whole normal is used)
    const push_flat = function (p, margin) {
      for (let it = 0; it < 3; it++) {
        const c = closest(p); if (!c) return p;
        const m = margin + (under ? under[c.v] : 0); if (c.s >= m - 1e-5) return p;
        const nl = Math.sqrt(c.n[1] * c.n[1] + c.n[2] * c.n[2]);
        if (nl < 0.4) { p[0] = c.q[0] + c.n[0] * m; p[1] = c.q[1] + c.n[1] * m; p[2] = c.q[2] + c.n[2] * m; continue; }
        const t = (m - c.s) / nl; p[1] += c.n[1] / nl * t; p[2] += c.n[2] / nl * t;
      }
      return p;
    };
    return { closest: closest, push_flat: push_flat, under: under || null, push: function (p, margin) { for (let it = 0; it < 2; it++) { const c = closest(p); if (!c) return p; const m = margin + (under ? under[c.v] : 0); if (c.s >= m - 1e-5) return p; p[0] = c.q[0] + c.n[0] * m; p[1] = c.q[1] + c.n[1] * m; p[2] = c.q[2] + c.n[2] * m; } return p; } };
  }
  // a closed mesh made to face OUT: every piece of it (triangles that share edges) is made consistent, then each is turned so that its volume is positive
  function orient_closed(pos, tris) {
    const T = tris.length / 3, edges = new Map(), seen = new Uint8Array(T), key = function (a, b) { return a < b ? a * 1048576 + b : b * 1048576 + a; };
    for (let t = 0; t < T; t++) for (let e = 0; e < 3; e++) { const k = key(tris[3 * t + e], tris[3 * t + (e + 1) % 3]); let l = edges.get(k); if (!l) { l = []; edges.set(k, l); } l.push(t); }
    const has = function (t, a, b) { for (let e = 0; e < 3; e++) if (tris[3 * t + e] === a && tris[3 * t + (e + 1) % 3] === b) return true; return false; };
    for (let t0 = 0; t0 < T; t0++) {
      if (seen[t0]) continue;
      const comp = [t0], stack = [t0]; seen[t0] = 1;
      while (stack.length) {
        const t = stack.pop();
        for (let e = 0; e < 3; e++) {
          const a = tris[3 * t + e], b = tris[3 * t + (e + 1) % 3], l = edges.get(key(a, b));
          for (let q = 0; q < l.length; q++) {
            const u = l[q]; if (u === t || seen[u]) continue;
            seen[u] = 1; comp.push(u); stack.push(u);
            if (has(u, a, b)) { const x = tris[3 * u + 1]; tris[3 * u + 1] = tris[3 * u + 2]; tris[3 * u + 2] = x; }          // (the neighbour runs the shared edge the way this one does: it is turned)
          }
        }
      }
      let vol = 0;
      comp.forEach(function (t) { const a = 3 * tris[3 * t], b = 3 * tris[3 * t + 1], c = 3 * tris[3 * t + 2]; vol += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) + pos[a + 1] * (pos[b + 2] * pos[c] - pos[b] * pos[c + 2]) + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]); });
      if (vol < 0) comp.forEach(function (t) { const x = tris[3 * t + 1]; tris[3 * t + 1] = tris[3 * t + 2]; tris[3 * t + 2] = x; });
    }
    return tris;
  }
  // ---- the CHAINS of a hanging piece: bones from the head down, the hat blend of the weights, the numbers of the spring
  const head_index = function (model) { return model.bones.findIndex(function (x) { return x.name === "head"; }); };
  const link_w = function (sk, L) { const w = [Math.max(0, 1 - (sk + 0.5))]; for (let i = 0; i < L; i++) w.push(Math.max(0, 1 - Math.abs(sk - (i + 0.5)))); return w; };       // [the head, link 0, link 1 ...]
  const CHAIN = { damping: 0.42, gravity: 1, inertia: 1.15, limit: 0.5, sway: 0.02, falloff: 0.35 };
  function chain_of(names, total_len) { return Object.assign({ bones: names.slice(), hz: round(clamp(3.5 / Math.sqrt(Math.max(total_len, 0.1) / 0.4), 1.5, 6), 3) }, CHAIN); }
  // the capsules that the chains are pushed out of: the head, the neck, the torso, the shoulders, the arms (fitted to the body: the clearance of the hair is part of the radius)
  function colliders_of(ctx, sk) {
    const B = ctx.B, model = B.model, A = ctx.A, out = [], P = B.P, hs = sk.hs;
    out.push({ bone: "head", a: sk.c.slice(), b: sk.c.slice(), r: round(0.5 * (sk.r(0, 0.2) + sk.r(Math.PI, 0.2)) + 0.012 * hs, 4) });
    const segs = [["neck", 0.012], ["spine3", 0.012], ["spine2", 0.012], ["clavicle.L", 0.01], ["clavicle.R", 0.01], ["upperarm.L", 0.012], ["upperarm.R", 0.012]];
    segs.forEach(function (sg) {
      const bi = model.bones.findIndex(function (x) { return x.name === sg[0]; }); if (bi < 0) return;
      const a = A.pt(model.bones[bi].head), b = A.pt(model.bones[bi].tail), ab = sub(b, a), l2 = Math.max(dot(ab, ab), 1e-9), ds = [];
      for (let v = 0; v < B.n; v++) {
        let w = 0; for (let q = 0; q < 4; q++) if (model.skin_indices[4 * v + q] === bi) w += model.skin_weights[4 * v + q] / 255;
        if (w < 0.5) continue;
        const p = [P[3 * v], P[3 * v + 1], P[3 * v + 2]], t = clamp(dot(sub(p, a), ab) / l2, 0, 1);
        ds.push(len(sub(p, add(a, mul(ab, t)))));
      }
      if (ds.length < 3) return;
      ds.sort(function (x, y) { return x - y; });
      out.push({ bone: sg[0], a: a, b: b, r: round(clamp(ds[Math.floor(0.7 * (ds.length - 1))] + sg[1] * hs, 0.01, 0.3), 4) });
    });
    return out.map(function (c) { return { bone: c.bone, a: c.a.map(function (x) { return round(x, 5); }), b: c.b.map(function (x) { return round(x, 5); }), r: c.r }; });
  }
  // the piece of the contract out of arrays: pos (3 a vertex), tris, per vertex the weights as a list of [bone (model index, or -1 - k of the piece's own), w], colours
  function make_piece(name, part, pos, tris, weights, colors, o) {
    const n = pos.length / 3, sb = new Int16Array(4 * n), sw = new Float32Array(4 * n);
    for (let i = 0; i < n; i++) {
      const l = weights[i].slice().sort(function (x, y) { return y[1] - x[1]; }).slice(0, 4); let tot = 0; l.forEach(function (e) { tot += e[1]; });
      for (let q = 0; q < 4; q++) { if (q < l.length) { sb[4 * i + q] = l[q][0]; sw[4 * i + q] = l[q][1] / tot; } else { sb[4 * i + q] = 0; sw[4 * i + q] = 0; } }
    }
    return { name: name, part: part, pos: Float32Array.from(pos), tris: Int32Array.from(tris), skin_bone: sb, skin_w: sw, colors: Float32Array.from(colors), rough: 0.6, bones: (o && o.bones) || [], chain: (o && o.chain) || null, colliders: (o && o.colliders) || null, cover: null, vertices: n };
  }
  // the lightness of one vertex of a hanging piece: darker at the roots, streaks, the inner side darker
  const smooth_noise = function (rnd, m, every) { const k = []; for (let i = 0; i <= Math.ceil(m / every) + 1; i++) k.push(rnd()); return function (j) { const x = j / every, i = Math.floor(x), f = x - i; return lerp(k[i], k[i + 1], f * f * (3 - 2 * f)); }; };

  // ---- THE MANTLE: a closed sheet of hair that hangs from the scalp round the back and the sides, kept out of the skin (medium, bob, long)
  function make_mantle(ctx, sk, cap, sp, st, sex_f, hs_k, rnd, surf, dynamic) {
    const mt = st.mantle, M = mt.cols, K = mt.rows, A = ctx.A, model = ctx.B.model, hs = sk.hs, vm = 0.6 + 0.8 * sp.volume, c = sk.c, Href = A.height / 1.7;
    const phi0 = mt.start * DEG;
    const at_phi = function (phi) {
      const C = cap.C, x = (((phi % TAU) + TAU) % TAU) / TAU * C, i0 = Math.floor(x) % C, i1 = (i0 + 1) % C, f = x - Math.floor(x);
      return { lat: lerp(cap.lat_h[i0], cap.lat_h[i1], f), r: lerp(cap.edge_r[i0], cap.edge_r[i1], f), th: lerp(cap.edge_t[i0], cap.edge_t[i1], f) };
    };
    const chin = A.pt("jaw.tail")[1], sh = A.pt("spine3.tail")[1], len_k = sp.length - 0.5;
    const y_end0 = mt.end === "jaw" ? chin + 0.012 * Href - len_k * 0.07 * Href : mt.end === "neck" ? sh + 0.015 * Href - len_k * 0.09 * Href : A.y.chest - 0.02 * Href - len_k * 0.3 * Href;
    const clump = smooth_noise(rnd, M, 3), cols = [], strands = [];
    for (let j = 0; j < M; j++) strands.push(rnd() * 2 - 1);
    for (let j = 0; j < M; j++) {
      const u = j / (M - 1), phi = phi0 + (TAU - 2 * phi0) * u, a = at_phi(phi), lat = a.lat + 0.22, d = sk.dir(phi, lat), R = sk.r(phi, lat) + 0.45 * a.th;
      const anchor = [c[0] + d[0] * R, c[1] + d[1] * R, c[2] + d[2] * R], side = Math.abs(u - 0.5) * 2;
      // the hem: the outer locks a little shorter, every strand its own length (a few together are alike), not one line
      let y_end = y_end0 + (mt.style === "long" ? 0.09 : 0.03) * Href * side * side - mt.rag * 0.14 * Href * (0.6 * strands[j] + 0.4 * (clump(j) * 2 - 1));
      if (mt.style === "bob") y_end += 0.02 * Href * (1 - side);
      cols.push({ phi: phi, anchor: anchor, y_end: Math.min(y_end, anchor[1] - 0.05 * Href), out: [Math.sin(phi), 0, Math.cos(phi)], x0: anchor[0] - c[0] });
    }
    const oh = mt.style === "bob" ? 0.6 : mt.style === "medium" ? 0.3 : 0.45, tau = function (k) { return Math.max(0.004, 0.016 * hs_k * vm * (1 - 0.5 * k / K)); };
    // THE BAND: the sheet is as wide as the head near the neck and a little wider at the shoulders (`conv[0]`), and goes in below them (`conv[1]`, of the width there): the columns converge, the hair does not spread over the shoulders. Where the skin
    // faces sideways (the head) a point is pushed out the whole way; below the head's base it is lifted and pushed back, never made wider
    const y_head = A.pt("neck.tail")[1] - 0.012 * hs, conv = mt.conv || [1, 1];
    const widen = function (s) { return lerp(1, conv[0], smooth(0, 0.22, s)) * lerp(1, conv[1], smooth(0.22, 1, s)); };
    const lay = function (p, margin) { return p[1] < y_head ? surf.push_flat(p, margin) : surf.push(p, margin); };
    const trace = function (col) {
      const D = col.anchor[1] - col.y_end, ds = D / (K * 0.9), pts = [col.anchor.slice()];
      let p = col.anchor.slice(), d = unit([0, -1, -oh * 0.6]), shift = 0;
      for (let k = 1; k <= K; k++) {
        const prev = p.slice(), s = k / K;
        d = unit([0, d[1] + (-1 - d[1]) * 0.35, d[2] * 0.65]);
        if (mt.curl) { const w = 0.5 * mt.curl * smooth(0.55, 1, s); d = unit([0, d[1], d[2] - col.out[2] * w]); }
        p = [c[0] + col.x0 * widen(s) + shift, p[1] + d[1] * ds, p[2] + d[2] * ds];
        const x_in = p[0]; lay(p, 0.5 * tau(k) + 0.004 * hs);
        if (p[1] >= y_head) shift += p[0] - x_in;                                                          // (at the head the push is a bell: it is kept)
        d = unit(add(mul(d, 0.5), mul(unit([0, p[1] - prev[1], p[2] - prev[2]]), 0.5)));
        pts.push(p.slice());
      }
      return pts;
    };
    const paths = cols.map(trace);
    for (let it = 0; it < 2; it++) {                                                                       // (the paths are smoothed along the sheet and along the hair, and pushed out again)
      const nxt = paths.map(function (pa, j) { return pa.map(function (p, k) { if (k === 0) return p; const a = paths[Math.max(0, j - 1)][k], b = paths[Math.min(M - 1, j + 1)][k], u = pa[k - 1], w = pa[Math.min(K, k + 1)], q = [0, 0, 0]; for (let i = 0; i < 3; i++) q[i] = 0.5 * p[i] + 0.15 * (a[i] + b[i]) + 0.1 * (u[i] + w[i]); lay(q, 0.5 * tau(k) + 0.004 * hs); return q; }); });
      for (let j = 0; j < M; j++) paths[j] = nxt[j];
    }
    // the columns keep their order along the sheet at every row (hair that is pushed round a shoulder must not cross itself: a fold turns the sheet inside out there)
    for (let k = 1; k <= K; k++) for (let j = 1; j < M; j++) {
      const w0 = unit(sub(paths[j][0], paths[j - 1][0])), d = dot(sub(paths[j][k], paths[j - 1][k]), w0), gap = 0.4 * len(sub(paths[j][0], paths[j - 1][0]));
      if (d < gap) { const q = add(paths[j][k], mul(w0, gap - d)); lay(q, 0.5 * tau(k) + 0.004 * hs); paths[j][k] = q; }
    }
    // the sheet: an outer and an inner surface, joined at the four edges (a closed thing, so that it is seen from both sides)
    const NV = M * (K + 1), pos = [], weights = [], colors = [], idx = function (j, k, side) { return side * NV + j * (K + 1) + k; };
    const streak = smooth_noise(rnd, M, 2.5), base = sp.colour || COLOURS.brown, G = dynamic ? (mt.chains || 5) : 0, L = mt.links, head = head_index(model);
    const bones = [], chain_names = [];
    if (dynamic) for (let g = 0; g < G; g++) {
      const cj = Math.round((g + 0.5) * M / G - 0.5), names = [];
      for (let i = 0; i < L; i++) {
        const r0 = Math.round(i * K / L), r1 = Math.round((i + 1) * K / L), nm = "hair.c" + g + "." + i; names.push(nm);
        bones.push({ name: nm, parent: i === 0 ? "head" : "hair.c" + g + "." + (i - 1), head: paths[cj][r0].map(function (x) { return round(x, 5); }), tail: paths[cj][Math.max(r1, r0 + 1)].map(function (x) { return round(x, 5); }) });
      }
      chain_names.push(names);
    }
    // the sheet's outside at every point: away from the body's middle line where the hair hangs free, the way the skin looks where it lies on it (a lock on a shoulder faces up and out); made square to the way the hair goes, and smoothed
    const nrm = [];
    for (let j = 0; j < M; j++) {
      nrm.push([]);
      for (let k = 0; k <= K; k++) {
        const p = paths[j][k], q = unit(sub(paths[j][Math.min(K, k + 1)], paths[j][Math.max(0, k - 1)])), out = unit([p[0], 0, p[2] - c[2]]), cl = surf.closest(p);
        let n = out;
        if (cl) { const w = smooth(0.04, 0.015, cl.d - (surf.under ? surf.under[cl.v] : 0)); n = unit(add(mul(out, 1 - w), mul(cl.vn, w))); }
        n = sub(n, mul(q, dot(n, q))); n = len(n) < 1e-4 ? out : unit(n);
        nrm[j].push(n);
      }
    }
    for (let it = 0; it < 2; it++) {
      const nx = nrm.map(function (col, j) { return col.map(function (n, k) { let a = mul(n, 2); [[j - 1, k], [j + 1, k], [j, k - 1], [j, k + 1]].forEach(function (q) { if (q[0] >= 0 && q[0] < M && q[1] >= 0 && q[1] <= K) a = add(a, nrm[q[0]][q[1]]); }); return len(a) < 1e-6 ? n : unit(a); }); });
      for (let j = 0; j < M; j++) nrm[j] = nx[j];
    }
    for (let side = 0; side < 2; side++) for (let j = 0; j < M; j++) for (let k = 0; k <= K; k++) {
      const p = paths[j][k], n = nrm[j][k];
      const t = tau(k) * (k === K ? 0.4 : 1) * 0.5 * (side === 0 ? 1 : -1);
      pos.push(p[0] + n[0] * t, p[1] + n[1] * t, p[2] + n[2] * t);
      // the weights
      const w = [];
      if (!dynamic) w.push([head, 1]);
      else {
        const gj = (j + 0.5) / (M / G) - 0.5, g0 = clamp(Math.floor(gj), 0, G - 1), g1 = clamp(g0 + 1, 0, G - 1), f = g0 === g1 ? 0 : clamp(gj - g0, 0, 1), skk = k * L / K, lw = link_w(skk, L);
        if (lw[0] > 0) w.push([head, lw[0]]);
        for (let i = 0; i < L; i++) { if (lw[i + 1] <= 0) continue; if (f < 1) w.push([-1 - (g0 * L + i), lw[i + 1] * (1 - f)]); if (f > 0) w.push([-1 - (g1 * L + i), lw[i + 1] * f]); }
      }
      weights.push(w);
      const col = base, lk = clamp((0.8 + 0.2 * Math.min(1, k / 3)) * (0.88 + 0.24 * streak(j)) * (side === 0 ? 1 : 0.78) * (1 + 0.03 * Math.sin(k * 1.7 + j * 2.3)), 0.3, 1.4);
      colors.push(col[0] * lk, col[1] * lk, col[2] * lk);
    }
    const tris = [], quad = function (a, b, cc, d) { tris.push(a, b, cc, a, cc, d); };
    for (let side = 0; side < 2; side++) for (let j = 0; j < M - 1; j++) for (let k = 0; k < K; k++) quad(idx(j, k, side), idx(j + 1, k, side), idx(j + 1, k + 1, side), idx(j, k + 1, side));
    for (let k = 0; k < K; k++) { quad(idx(0, k, 0), idx(0, k + 1, 0), idx(0, k + 1, 1), idx(0, k, 1)); quad(idx(M - 1, k, 0), idx(M - 1, k + 1, 0), idx(M - 1, k + 1, 1), idx(M - 1, k, 1)); }
    for (let j = 0; j < M - 1; j++) { quad(idx(j, K, 0), idx(j, K, 1), idx(j + 1, K, 1), idx(j + 1, K, 0)); quad(idx(j, 0, 0), idx(j + 1, 0, 0), idx(j + 1, 0, 1), idx(j, 0, 1)); }
    orient_closed(pos, tris);
    const o = { bones: bones };
    if (dynamic) { const total = Math.abs(cols[Math.floor(M / 2)].anchor[1] - cols[Math.floor(M / 2)].y_end); o.chains = chain_names.map(function (nm) { return chain_of(nm, total); }); o.chain = o.chains[0]; o.colliders = colliders_of(ctx, sk); }
    const pc = make_piece("hair_mantle", sp.part, pos, tris, weights, colors, o);
    pc.chains = o.chains || null;
    return pc;
  }

  // ---- TUBES: a pony tail and a braid (a closed tube along a path that hangs from a tie on the back of the head), a bun (a ball)
  function make_tube(ctx, sk, cap, sp, st, sex_f, hs_k, rnd, surf, dynamic, hw) {
    const tb = st.tube, hs = sk.hs, vm = 0.6 + 0.8 * sp.volume, c = sk.c, model = ctx.B.model, head = head_index(model), n = tb.kind === "braid" ? 24 : 12, M = 7, L = tb.links;
    const phi = Math.PI; let lat = tb.kind === "braid" ? 0.2 : 0.5;
    if (hw) {                                                                                          // (under headwear: the tie is under the cloth's line at the back, at the nape; under a beanie it is tucked in: no tail)
      const y_tie = Math.min(c[1] + Math.sin(lat) * sk.r(phi, lat), sk.ey + hw.line[2] - 0.045 * hs);
      if (y_tie < sk.ey - 0.075 * hs) return null;
      lat = lat_at_y(sk, phi, y_tie);
    }
    const d0 = sk.dir(phi, lat), R = sk.r(phi, lat) + 0.006 * hs, tie = [c[0] + d0[0] * R, c[1] + d0[1] * R, c[2] + d0[2] * R];
    const length = tb.length * (0.65 + 0.7 * sp.length) * hs, r0 = tb.r0 * hs_k * (0.8 + 0.4 * vm);
    const ds = length / n, pts = [tie];
    let p = tie.slice(), d = unit(tb.kind === "braid" ? [0, -0.55, -1] : [0, -0.2, -1]);
    for (let k = 1; k <= n; k++) {
      const prev = p.slice();
      d = unit([d[0] * 0.6, d[1] + (-1 - d[1]) * 0.22, d[2] * 0.85]);
      p = [p[0] + d[0] * ds, p[1] + d[1] * ds, p[2] + d[2] * ds];
      surf.push(p, r0 * 0.9 + 0.004 * hs);
      d = unit(add(mul(d, 0.5), mul(unit(sub(p, prev)), 0.5)));
      pts.push(p.slice());
    }
    for (let it = 0; it < 2; it++) for (let k = 1; k < n; k++) { const q = [0, 0, 0]; for (let i = 0; i < 3; i++) q[i] = 0.5 * pts[k][i] + 0.25 * (pts[k - 1][i] + pts[k + 1][i]); surf.push(q, r0 * 0.8 + 0.004 * hs); pts[k] = q; }
    const radius = function (s) { return r0 * lerp(1, 0.22, smooth(0.35, 1, s)) * (1 + 0.38 * Math.sin(Math.PI * clamp(s * 1.7, 0, 1))); };
    const pos = [], weights = [], colors = [], base = sp.colour || COLOURS.brown, streak = smooth_noise(rnd, M, 1.5), bones = [], names = [];
    const link_pt = function (i) { return pts[Math.round(i * n / L)]; };
    if (dynamic) for (let i = 0; i < L; i++) { names.push("hair.t." + i); bones.push({ name: "hair.t." + i, parent: i === 0 ? "head" : "hair.t." + (i - 1), head: link_pt(i).map(function (x) { return round(x, 5); }), tail: link_pt(i + 1).map(function (x) { return round(x, 5); }) }); }
    let nn = unit(cross([0, 0, 1], sub(pts[1], pts[0]))); if (len(nn) < 1e-6) nn = [1, 0, 0];
    const weights_at = function (s) { const w = []; if (!dynamic) { w.push([head, 1]); return w; } const lw = link_w(s * L, L); if (lw[0] > 0) w.push([head, lw[0]]); for (let i = 0; i < L; i++) if (lw[i + 1] > 0) w.push([-1 - i, lw[i + 1]]); return w; };
    const cyc = tb.kind === "braid" ? length / 0.05 : 0;
    for (let k = 0; k <= n; k++) {
      const s = k / n, t = unit(sub(pts[Math.min(n, k + 1)], pts[Math.max(0, k - 1)]));
      nn = sub(nn, mul(t, dot(nn, t))); nn = len(nn) > 1e-6 ? unit(nn) : unit(cross([1, 0, 0], t));
      const bb = cross(t, nn);
      let r = radius(s), off = 0;
      if (cyc) { off = 0.45 * r * Math.sin(TAU * s * cyc * 0.5); r *= 1 + 0.22 * Math.cos(TAU * s * cyc); }
      for (let j = 0; j < M; j++) {
        const a = TAU * j / M, q = add(pts[k], add(mul(nn, off + r * Math.cos(a)), mul(bb, 0.85 * r * Math.sin(a))));
        pos.push(q[0], q[1], q[2]); weights.push(weights_at(s));
        const lk = (0.82 + 0.2 * Math.min(1, s * 3)) * (0.9 + 0.2 * streak(j)) * (1 + 0.04 * Math.sin(k * 1.3 + j * 2.1));
        colors.push(base[0] * lk, base[1] * lk, base[2] * lk);
      }
    }
    const ring = function (k) { return k * M; }, tris = [];
    for (let k = 0; k < n; k++) for (let j = 0; j < M; j++) { const j1 = (j + 1) % M; tris.push(ring(k) + j, ring(k) + j1, ring(k + 1) + j, ring(k) + j1, ring(k + 1) + j1, ring(k + 1) + j); }
    const tip = pos.length / 3, tl = unit(sub(pts[n], pts[n - 1])), tp = add(pts[n], mul(tl, 1.6 * radius(1))), t0 = unit(sub(pts[0], pts[1])), bp = add(pts[0], mul(t0, 0.8 * radius(0)));
    pos.push(tp[0], tp[1], tp[2]); weights.push(weights_at(1)); colors.push(base[0] * 0.9, base[1] * 0.9, base[2] * 0.9);
    pos.push(bp[0], bp[1], bp[2]); weights.push(weights_at(0)); colors.push(base[0] * 0.8, base[1] * 0.8, base[2] * 0.8);
    for (let j = 0; j < M; j++) { tris.push(ring(n) + j, ring(n) + (j + 1) % M, tip); tris.push(ring(0) + (j + 1) % M, ring(0) + j, tip + 1); }
    orient_closed(pos, tris);
    const o = { bones: bones };
    if (dynamic) { o.chain = chain_of(names, length); o.colliders = colliders_of(ctx, sk); }
    return make_piece("hair_" + tb.kind, sp.part, pos, tris, weights, colors, o);
  }
  function make_bun(ctx, sk, cap, sp, st, sex_f, hs_k, rnd, hw) {
    const bn = st.bun, hs = sk.hs, c = sk.c, head = head_index(ctx.B.model), rb = bn.r * hs_k * (0.8 + 0.4 * (0.6 + 0.8 * sp.volume) / 1.4), phi = Math.PI; let lat = 0.95;
    if (hw) { const y_c = sk.ey + hw.line[2] - 0.004 * hs - rb; if (y_c < sk.ey - 0.07 * hs) return null; lat = lat_at_y(sk, phi, y_c); }
    const d0 = sk.dir(phi, lat), R = sk.r(phi, lat) + 0.85 * rb, cen = [c[0] + d0[0] * R, c[1] + d0[1] * R, c[2] + d0[2] * R];
    const RING = 9, SEG = 12, pos = [], weights = [], colors = [], base = sp.colour || COLOURS.brown, tris = [];
    pos.push(cen[0], cen[1] + 0.85 * rb, cen[2]); weights.push([[head, 1]]); colors.push(base[0], base[1], base[2]);
    for (let i = 1; i < RING; i++) { const a = Math.PI * i / RING; for (let j = 0; j < SEG; j++) { const b = TAU * j / SEG; pos.push(cen[0] + rb * Math.sin(a) * Math.cos(b), cen[1] + 0.85 * rb * Math.cos(a), cen[2] + rb * Math.sin(a) * Math.sin(b)); weights.push([[head, 1]]); const lk = (0.85 + 0.2 * Math.cos(a)) * (1 + 0.05 * Math.sin(5 * b + 3 * a)); colors.push(base[0] * lk, base[1] * lk, base[2] * lk); } }
    pos.push(cen[0], cen[1] - 0.85 * rb, cen[2]); weights.push([[head, 1]]); colors.push(base[0] * 0.8, base[1] * 0.8, base[2] * 0.8);
    const bot = pos.length / 3 - 1;
    for (let j = 0; j < SEG; j++) { tris.push(0, 1 + j, 1 + (j + 1) % SEG); tris.push(bot, 1 + (RING - 2) * SEG + (j + 1) % SEG, 1 + (RING - 2) * SEG + j); }
    for (let i = 0; i < RING - 2; i++) for (let j = 0; j < SEG; j++) { const a = 1 + i * SEG + j, b = 1 + i * SEG + (j + 1) % SEG; tris.push(a, a + SEG, b, b, a + SEG, b + SEG); }
    orient_closed(pos, tris);
    return make_piece("hair_bun", sp.part, pos, tris, weights, colors, {});
  }

  // ---- THE MOHAWK: a ridge along the middle of the head, from the forehead to the nape (a half-ellipse across, rays to the skin, the lip closes its ends)
  function make_mohawk(ctx, sk, sp, st, hs_k, rnd, hw) {
    const rg = st.ridge, c = sk.c, hs = sk.hs, vm = 0.6 + 0.8 * sp.volume, Kr = 16, M = 7, A = ctx.A;
    const a0 = 0.62, a1 = Math.PI + 0.3, n = (Kr + 1) * M, pos0 = new Float32Array(3 * n), nrm = new Float32Array(3 * n), thick = new Float32Array(n), tris = [];
    const w = rg.w * hs_k, h = hw ? hw.tmax : rg.h * vm * hs_k * (0.7 + 0.6 * sp.length);
    for (let k = 0; k <= Kr; k++) {
      const s = k / Kr, al = lerp(a0, a1, s), d = [0, Math.sin(al), Math.cos(al)], env = Math.pow(Math.sin(Math.PI * clamp(s * 0.96 + 0.02, 0, 1)), 0.55), spike = 1 + 0.12 * Math.sin(k * 2.9);
      for (let m = 0; m < M; m++) {
        const x = (m / (M - 1) - 0.5) * 2 * w, dd = unit([x / (0.09 * hs), d[1], d[2]]), r = sk.r(Math.atan2(dd[0], dd[2]), Math.asin(clamp(dd[1], -1, 1))), i = k * M + m;
        pos0[3 * i] = c[0] + dd[0] * r; pos0[3 * i + 1] = c[1] + dd[1] * r; pos0[3 * i + 2] = c[2] + dd[2] * r;
        nrm[3 * i] = dd[0]; nrm[3 * i + 1] = dd[1]; nrm[3 * i + 2] = dd[2];
        thick[i] = Math.max(0.0015, h * env * spike * Math.pow(Math.sin(Math.PI * m / (M - 1)), 0.7)) + 0.0015;
      }
    }
    for (let k = 0; k < Kr; k++) for (let m = 0; m < M - 1; m++) { const a = k * M + m, b = a + 1, a2 = a + M, b2 = b + M; tris.push(a, a2, b, b, a2, b2); }
    let sgn = 0; for (let t = 0; t < tris.length; t += 3) { const p0 = [pos0[3 * tris[t]], pos0[3 * tris[t] + 1], pos0[3 * tris[t] + 2]], p1 = [pos0[3 * tris[t + 1]], pos0[3 * tris[t + 1] + 1], pos0[3 * tris[t + 1] + 2]], p2 = [pos0[3 * tris[t + 2]], pos0[3 * tris[t + 2] + 1], pos0[3 * tris[t + 2] + 2]]; sgn += dot(cross(sub(p1, p0), sub(p2, p0)), sub(mul(add(add(p0, p1), p2), 1 / 3), c)); }
    if (sgn < 0) for (let t = 0; t < tris.length; t += 3) { const x = tris[t + 1]; tris[t + 1] = tris[t + 2]; tris[t + 2] = x; }
    const edge = new Uint8Array(n); for (let k = 0; k <= Kr; k++) { edge[k * M] = 1; edge[k * M + M - 1] = 1; }
    const base = sp.colour || COLOURS.black, pc = shell_piece(ctx, pos0, nrm, tris, thick, base, { name: "hair_mohawk", part: sp.part, smooth: 1, y_low: sk.ey - 0.03 * hs, edge: edge, variation: 0.06 });
    shade(pc, n, function (i, own) { if (!own) return 0.75; const k = Math.floor(i / M); return 0.85 + 0.25 * (k % 2 ? 1 : 0.8) * (1 - 0.3 * Math.abs(k / Kr - 0.5)); });
    return pc;
  }

  // ---- THE BEARD: a shell of the skin of the jaw (the clip of wear), or paint (stubble). The mouth is found from the lip mask of the body's vertices
  function mouth_of(ctx, sk) {
    const B = ctx.B, model = B.model, P = B.P, m = model.masks; let n = 0, sx = 0, sy = 0, sz = 0, lo = [1e9, 1e9], hi = [-1e9, -1e9];
    for (let v = 0; v < B.n; v++) { if (m[4 * v] < 128 || P[3 * v + 1] > sk.ey - 0.02) continue; n++; sx += P[3 * v]; sy += P[3 * v + 1]; sz += P[3 * v + 2]; lo[0] = Math.min(lo[0], Math.abs(P[3 * v])); hi[0] = Math.max(hi[0], Math.abs(P[3 * v])); lo[1] = Math.min(lo[1], P[3 * v + 1]); hi[1] = Math.max(hi[1], P[3 * v + 1]); }
    const hs = sk.hs, chin = ctx.A.pt("jaw.tail");
    if (n < 4) return { y: chin[1] + 0.046 * hs, hx: 0.022 * hs, hy: 0.008 * hs, z: chin[2] };
    return { y: lo[1] + 0.45 * (hi[1] - lo[1]), hx: Math.max(0.72 * hi[0], 0.014 * hs), hy: Math.max(0.3 * (hi[1] - lo[1]), 0.005 * hs), z: sz / n };
  }
  function beard_field(ctx, sk, bd, mo) {
    const A = ctx.A, pt = A.pt, hs = sk.hs, chin = pt("jaw.tail"), ear = pt("ear.L.base"), len_k = 0.4 + 1.2 * bd.length, style = bd.style, B = ctx.B, P = B.P, n = B.n;
    const f = new Float32Array(n), ey = sk.ey, my = mo.y, hy = mo.hy, nose = my + 0.022 * hs;
    for (let v = 0; v < n; v++) {
      const x = Math.abs(P[3 * v]), y = P[3 * v + 1], z = P[3 * v + 2];
      let top, low, side, back;
      if (style === "moustache") { top = nose - 0.002 * hs - 0.008 * hs * smooth(0.012 * hs, 0.036 * hs, x); low = my + 0.2 * hy; side = 0.034 * hs - x; back = mo.z - 0.04 * hs; }
      else if (style === "goatee") { top = my - 0.6 * hy; low = chin[1] - 0.012 * hs * len_k; side = 0.025 * hs - x; back = mo.z - 0.04 * hs; }
      else {
        top = lerp(nose - 0.003 * hs, ear[1] - (style === "full" ? 0.012 : 0.028) * hs, smooth(0.025 * hs, 0.072 * hs, x));
        low = style === "full" ? chin[1] - 0.022 * hs * len_k : chin[1] - 0.003 * hs; side = 0.082 * hs - x;
        back = lerp(ear[2] + 0.010 * hs, chin[2] - 0.045 * hs, 1 - smooth(chin[1] - 0.02 * hs, ear[1] - 0.015 * hs, y));
      }
      let m = Math.min(top - y, y - low, side, z - back);
      const ex = x / (mo.hx + 0.006 * hs), ey2 = (y - my) / (mo.hy + 0.007 * hs), e = Math.sqrt(ex * ex + ey2 * ey2);
      m = Math.min(m, style === "moustache" ? (e - 0.6) * 0.012 : (e - 1) * 0.012);                      // (the mouth stays bare; a moustache is over the lip's upper edge)
      { const rx = P[3 * v] - sk.c[0], ry = y - sk.c[1], rz = z - sk.c[2], rl = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1; if ((B.N[3 * v] * rx + B.N[3 * v + 1] * ry + B.N[3 * v + 2] * rz) / rl < 0.1) m = Math.min(m, -0.01); }          // (a skin that looks into the head, the cheeks' inside, is not a face)
      f[v] = m;
    }
    return f;
  }
  // a shell with its inner vertices merged by a grid of `cell` metres (the vertices of the edge are kept: the line of the cut and the mouth stay as they are); the degenerate triangles go
  function cluster(S, cell) {
    const n = S.n, map = new Int32Array(n), cells = new Map(), keep = [];
    for (let i = 0; i < n; i++) {
      if (S.cut[i]) { map[i] = keep.length; keep.push([i]); continue; }
      const k = Math.floor(S.pos0[3 * i] / cell) + "," + Math.floor(S.pos0[3 * i + 1] / cell) + "," + Math.floor(S.pos0[3 * i + 2] / cell);
      let g = cells.get(k); if (g === undefined) { g = keep.length; keep.push([]); cells.set(k, g); }
      keep[g].push(i); map[i] = g;
    }
    const m = keep.length, o = { n: m, at: new Int32Array(m).fill(-1), a: new Int32Array(m), b: new Int32Array(m).fill(-1), t: new Float32Array(m), pos0: new Float32Array(3 * m), nrm: new Float32Array(3 * m), skin_i: new Int16Array(4 * m), skin_w: new Float32Array(4 * m), cut: new Uint8Array(m), cover: S.cover };
    keep.forEach(function (g, j) {
      let x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0; const acc = {};
      g.forEach(function (i) { x += S.pos0[3 * i]; y += S.pos0[3 * i + 1]; z += S.pos0[3 * i + 2]; nx += S.nrm[3 * i]; ny += S.nrm[3 * i + 1]; nz += S.nrm[3 * i + 2]; for (let q = 0; q < 4; q++) { const w = S.skin_w[4 * i + q]; if (w > 0) acc[S.skin_i[4 * i + q]] = (acc[S.skin_i[4 * i + q]] || 0) + w; } });
      const c = g.length, nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      o.pos0[3 * j] = x / c; o.pos0[3 * j + 1] = y / c; o.pos0[3 * j + 2] = z / c; o.nrm[3 * j] = nx / nl; o.nrm[3 * j + 1] = ny / nl; o.nrm[3 * j + 2] = nz / nl; o.cut[j] = S.cut[g[0]];
      const list = Object.keys(acc).map(function (k) { return [+k, acc[k]]; }).sort(function (u, v) { return v[1] - u[1]; }).slice(0, 4); let tot = 0; list.forEach(function (e) { tot += e[1]; });
      for (let q = 0; q < 4; q++) { if (q < list.length) { o.skin_i[4 * j + q] = list[q][0]; o.skin_w[4 * j + q] = list[q][1] / tot; } }
    });
    const tris = [], seen = new Set();
    for (let t = 0; t < S.tris.length; t += 3) {
      const a = map[S.tris[t]], b = map[S.tris[t + 1]], c = map[S.tris[t + 2]];
      if (a === b || b === c || a === c) continue;
      const k = Math.min(a, b, c) + "," + Math.max(a, b, c) + "," + (a + b + c); if (seen.has(k)) continue; seen.add(k);
      tris.push(a, b, c);
    }
    o.tris = Int32Array.from(tris);
    return o;
  }
  function make_beard(ctx, sk, bd, hair_col, part, rnd) {
    if (STRIPS[bd.style]) return { piece: make_strip_beard(ctx, sk, bd, hair_col, part), paint: null };
    const B = ctx.B, mo = mouth_of(ctx, sk), hs = sk.hs, f = beard_field(ctx, sk, bd, mo), len_k = 0.4 + 1.2 * bd.length;
    const col = bd.colour || hair_col || COLOURS.brown, chin = ctx.A.pt("jaw.tail");
    if (bd.style === "stubble") {
      const idx = [], rgb = [], a = [], dark = col.map(function (x) { return x * 0.8; });
      for (let v = 0; v < B.n; v++) if (f[v] > -0.004) { idx.push(v); rgb.push(dark[0], dark[1], dark[2]); a.push(0.42 * smooth(-0.004, 0.008, f[v])); }
      return { paint: { idx: Int32Array.from(idx), rgb: Float32Array.from(rgb), a: Float32Array.from(a) }, piece: null };
    }
    let S = wear.clip(B, f, { margin: 1e9 });
    if (S.n < 12) return { piece: null, paint: null };
    const target = bd.style === "full" ? 420 : bd.style === "short" ? 400 : 330;
    for (let cell = 0.007 * hs; S.tris.length / 3 > target && cell < 0.03 * hs; cell += 0.002 * hs) S = cluster(wear.clip(B, f, { margin: 1e9 }), cell);       // (the face is dense: a beard of fewer triangles, the edge kept)
    const base_t = { moustache: 0.007, goatee: 0.010, short: 0.008, full: 0.012 }[bd.style] * (0.6 + 0.8 * bd.length) * Math.pow(hs, 0.8), chin_bump = bd.style === "full" ? 0.014 : bd.style === "goatee" ? 0.008 : 0;
    const thick = function (sh, i) { const y = sh.pos0[3 * i + 1], x = Math.abs(sh.pos0[3 * i]); return base_t + chin_bump * len_k * hs * smooth(chin[1] + 0.03 * hs, chin[1] - 0.005 * hs, y) * (1 - smooth(0.01 * hs, 0.04 * hs, x) * 0.5); };
    const pc = wear.finish(B, S, { thickness: 0.0008, ease: thick, guard: false, smooth: 2, colour: col, variation: 0.06, lip: 1, lip_colour: col.map(function (x) { return x * 0.8; }), name: "beard_" + bd.style, part: part, rough: 0.6 });
    pc.cover = null;
    // the head hair's lightness (a dye changes the hue and keeps this)
    const n = S.n; for (let i = 0; i < pc.colors.length / 3; i++) { const k = i < n ? 0.92 + 0.1 * Math.sin(i * 1.9) : 0.7; for (let c = 0; c < 3; c++) pc.colors[3 * i + c] = clamp(pc.colors[3 * i + c] * k, 0, 1); }
    return { piece: pc, paint: null };
  }
  // ---- STRIPS: a moustache or a chinstrap is a ribbon of hair that stands on the skin along a curve in the plane of the face. Each ring is a half ellipse across the curve; its feet are put on the skin by a ray from the front and
  // the closest point of the real surface, so it is as crisp as the curve says whatever the density of the face (a clip of the face's own triangles cannot be thinner than a row of vertices: a vertex a centimetre).
  //   pts: [[x, y, w, h]] the centre of the strip (x from the middle, y: metres, in the model's frame), w half of its width across the curve, h how high it stands off the skin; the list is the whole curve, left to right
  function catmull(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }
  function make_strip(ctx, sk, surf, o) {
    const B = ctx.B, P = o.pts, K = P.length, N = o.rings || 18, M = 5, c = sk.c, n = N * M, pos0 = new Float32Array(3 * n), nrm = new Float32Array(3 * n), thick = new Float32Array(n), tris = [];
    const at = function (u, q) { const k = Math.min(Math.floor(u), K - 2), f = u - k; return catmull(P[Math.max(0, k - 1)][q], P[k][q], P[k + 1][q], P[Math.min(K - 1, k + 2)][q], f); };
    const ring = [];
    for (let i = 0; i < N; i++) { const u = i / (N - 1) * (K - 1) * 0.99999; ring.push([at(u, 0), at(u, 1), Math.max(at(u, 2), 0.0015), Math.max(at(u, 3), 0.002)]); }
    let zlast = 0.15;
    for (let i = 0; i < N; i++) {
      const a = ring[Math.max(0, i - 1)], b = ring[Math.min(N - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.sqrt(tx * tx + ty * ty) || 1, nx = -ty / tl, ny = tx / tl, r = ring[i];
      for (let m = 0; m < M; m++) {
        const e = (m / (M - 1) - 0.5) * 2, x = r[0] + nx * r[2] * e, y = r[1] + ny * r[2] * e, t = B.ray([x, y, 0.4], [0, 0, -1], 0.5);
        const z = isFinite(t) ? 0.4 - t : zlast; zlast = z;
        const cl = surf.closest([x, y, z]), q = cl ? cl.q : [x, y, z], v = cl ? cl.vn : [0, 0, 1], j = i * M + m;
        pos0[3 * j] = q[0]; pos0[3 * j + 1] = q[1]; pos0[3 * j + 2] = q[2]; nrm[3 * j] = v[0]; nrm[3 * j + 1] = v[1]; nrm[3 * j + 2] = v[2];
        thick[j] = r[3] * Math.pow(Math.sin(Math.PI * m / (M - 1)), 0.7) + 0.0012;
      }
    }
    for (let i = 0; i < N - 1; i++) for (let m = 0; m < M - 1; m++) { const a = i * M + m, b = a + 1, a2 = a + M, b2 = b + M; tris.push(a, a2, b, b, a2, b2); }
    let sgn = 0; for (let t = 0; t < tris.length; t += 3) { const p0 = [pos0[3 * tris[t]], pos0[3 * tris[t] + 1], pos0[3 * tris[t] + 2]], p1 = [pos0[3 * tris[t + 1]], pos0[3 * tris[t + 1] + 1], pos0[3 * tris[t + 1] + 2]], p2 = [pos0[3 * tris[t + 2]], pos0[3 * tris[t + 2] + 1], pos0[3 * tris[t + 2] + 2]]; sgn += dot(cross(sub(p1, p0), sub(p2, p0)), sub(mul(add(add(p0, p1), p2), 1 / 3), c)); }
    if (sgn < 0) for (let t = 0; t < tris.length; t += 3) { const x = tris[t + 1]; tris[t + 1] = tris[t + 2]; tris[t + 2] = x; }
    const edge = new Uint8Array(n); for (let i = 0; i < N; i++) { edge[i * M] = 1; edge[i * M + M - 1] = 1; }
    const pc = shell_piece(ctx, pos0, nrm, tris, thick, o.colour, { name: o.name, part: o.part, smooth: 1, y_low: 1e9, edge: edge, variation: 0.06 });
    shade(pc, n, function (i, own) { if (!own) return 0.75; const k = Math.floor(i / M); return 0.9 + 0.2 * Math.sin(k * 1.9 + 0.5) * 0.5 + 0.1; });
    pc.cover = null;
    return pc;
  }
  // the curves of the moustaches and the chinstrap: [x from the middle, the height over the middle of the lip's upper edge (a chinstrap: over the chin), half the width, how high it stands], half of it (x >= 0); the other half is its mirror
  const STRIPS = {
    handlebar: { from: "lip", pts: [[0.000, -0.002, 0.0085, 0.0075], [0.012, -0.002, 0.0085, 0.0072], [0.024, -0.001, 0.0065, 0.0060], [0.034, 0.004, 0.0045, 0.0045], [0.042, 0.013, 0.0035, 0.0040], [0.047, 0.024, 0.0028, 0.0035]] },
    walrus: { from: "lip", pts: [[0.000, -0.006, 0.0105, 0.0100], [0.016, -0.008, 0.0115, 0.0115], [0.030, -0.012, 0.0115, 0.0115], [0.042, -0.020, 0.0090, 0.0095], [0.049, -0.030, 0.0055, 0.0065]] },
    pencil: { from: "lip", pts: [[0.000, -0.0005, 0.0026, 0.0035], [0.012, -0.0015, 0.0026, 0.0035], [0.024, -0.0035, 0.0022, 0.0030]] },
    chinstrap: { from: "chin", pts: [[0.000, 0.014, 0.0095, 0.0075], [0.020, 0.016, 0.0095, 0.0075], [0.038, 0.025, 0.0095, 0.0075], [0.054, 0.040, 0.0090, 0.0070], [0.063, 0.056, 0.0075, 0.0060], [0.067, 0.068, 0.0055, 0.0045]] }
  };
  function make_strip_beard(ctx, sk, bd, hair_col, part) {
    const def = STRIPS[bd.style], hs = sk.hs, mo = mouth_of(ctx, sk), chin = ctx.A.pt("jaw.tail"), kx = 0.75 + 0.5 * bd.length, kh = 0.7 + 0.6 * bd.length;
    const y0 = def.from === "chin" ? chin[1] : mo.y + 0.0195 * hs, pts = [];
    const one = function (q) { return [q[0] * hs * kx, y0 + q[1] * hs * (def.from === "lip" && q[1] > 0 ? kx : 1), q[2] * hs * kh, q[3] * hs * kh]; };
    for (let i = def.pts.length - 1; i >= 1; i--) { const q = one(def.pts[i]); pts.push([-q[0], q[1], q[2], q[3]]); }
    def.pts.forEach(function (q) { pts.push(one(q)); });
    const surf = make_surface(ctx.B, chin[1] - 0.06 * hs, null);
    return make_strip(ctx, sk, surf, { pts: pts, rings: 2 * def.pts.length + 6, colour: bd.colour || hair_col || COLOURS.brown, name: "beard_" + bd.style, part: part });
  }
  const merge_paint = function (a, b) {
    if (!a) return b; if (!b) return a;
    const idx = new Int32Array(a.idx.length + b.idx.length), rgb = new Float32Array(a.rgb.length + b.rgb.length), al = new Float32Array(a.a.length + b.a.length);
    idx.set(a.idx); idx.set(b.idx, a.idx.length); rgb.set(a.rgb); rgb.set(b.rgb, a.rgb.length); al.set(a.a); al.set(b.a, a.a.length);
    return { idx: idx, rgb: rgb, a: al };
  };

  // ---- HEADWEAR (ctx.headwear = { kind } when a cap, a beanie, a hat or a beret is worn: human_lite_wear.js; its cloth is in ctx.placed): the hair is made to FIT UNDER IT
  //   the cloth sits 12 .. 26 mm off the skull above a line that runs round the head over her eyes: [front, side, back] in metres over the eye height (the numbers of the wear module's head kinds). Under it a cap of hair is 6 mm thick at the most (4 under a beanie: it is
  //   close), a mohawk is flat, a pony tail, a braid and a bun go down to the nape under the line (under a beanie, which reaches 6 cm under her eyes at the back, they are tucked: not made), a mantle hangs from under the edge. Whatever is still beyond the
  //   cloth is put back: each vertex of the hair near the cloth (the vertices of the cloth, their height over the skin, a weighted mean of the nearest three) is held 3 mm under it
  const HEAD_LINES = { cap: [0.042, 0.042, -0.012], beanie: [0.03, -0.028, -0.06], hat: [0.048, 0.048, 0.04], beret: [0.045, 0.02, 0.0] };
  function head_wear(ctx) {
    if (!ctx.headwear || typeof ctx.headwear !== "object") return null;
    const kind = ctx.headwear.kind;
    return { kind: kind, line: HEAD_LINES[kind] || [0.04, 0.04, 0.0], tmax: kind === "beanie" ? 0.004 : 0.006 };
  }
  function lat_at_y(sk, phi, y) {                                                                      // the angle (up from the level through the skull's middle) at which the skin round the head, at `phi`, is at the height y
    let lat = Math.atan2(y - sk.c[1], sk.r(phi, 0));
    for (let it = 0; it < 2; it++) { const r = sk.r(phi, lat), yhit = sk.c[1] + Math.sin(lat) * r; lat = clamp(lat + (y - yhit) / Math.max(r, 0.05), -1.15, 1.45); }
    return lat;
  }
  // the height of the cloth's line over her eyes at an angle round the head (the wear module's head kinds: higher in front, on the temples and at the back)
  function line_at(line, a) { return a < Math.PI / 2 ? lerp(line[0], line[1], smooth(0, Math.PI / 2, a)) : lerp(line[1], line[2], smooth(Math.PI / 2, Math.PI, a)); }
  // the cloth of the head as a function: the height over the skin at which the cloth is near p (0.2: none near). The vertices of the cloth are the points (the hem's own, a band of 8 mm over the line, are not: they are on the skin)
  function cloth_limit(ctx, sk, surf, hw) {
    const ey = sk.ey, hs = sk.hs, pts = [], q = [0, 0, 0], zc = ctx.A.pt("head.tail")[2];
    (ctx.placed || []).forEach(function (arr) {
      const n = arr.length / 3; let up = 0;
      for (let i = 0; i < n; i++) if (arr[3 * i + 1] > ey - 0.07 * hs) up++;
      if (!n || up < 0.6 * n) return;                                                                  // (a piece of the head: nearly all of its vertices are over the eyes)
      for (let i = 0; i < n; i++) {
        const x = arr[3 * i], y = arr[3 * i + 1], z = arr[3 * i + 2];
        if (y < ey + line_at(hw.line, Math.abs(Math.atan2(x, z - zc))) + 0.008) continue;
        q[0] = x; q[1] = y; q[2] = z; const cl = surf.closest(q); if (cl) pts.push(x, y, z, Math.max(cl.s, 0.0005));
      }
    });
    if (!pts.length) return null;
    return function (p) {
      let d1 = 1e9, d2 = 1e9, d3 = 1e9, s1 = 0, s2 = 0, s3 = 0;
      for (let i = 0; i < pts.length; i += 4) {
        const dx = pts[i] - p[0], dy = pts[i + 1] - p[1], dz = pts[i + 2] - p[2], d = dx * dx + dy * dy + dz * dz;
        if (d < d3) { if (d < d2) { if (d < d1) { d3 = d2; s3 = s2; d2 = d1; s2 = s1; d1 = d; s1 = pts[i + 3]; } else { d3 = d2; s3 = s2; d2 = d; s2 = pts[i + 3]; } } else { d3 = d; s3 = pts[i + 3]; } }
      }
      d1 = Math.sqrt(d1); if (d1 > 0.045) return 0.2;
      let w = 0, sm = 0; [[d1, s1], [Math.sqrt(d2), s2], [Math.sqrt(d3), s3]].forEach(function (e) { if (e[0] > 0.06) return; const k = 1 / ((e[0] + 0.006) * (e[0] + 0.006)); w += k; sm += k * e[1]; });
      return lerp(0.2, sm / w, smooth(0.045, 0.02, d1));
    };
  }
  function fit_under(ctx, sk, surf, pieces, hw) {
    const lim = cloth_limit(ctx, sk, surf, hw); if (!lim) return;
    const p = [0, 0, 0], ey = sk.ey, lo = ey - 0.14 * sk.hs, zc = ctx.A.pt("head.tail")[2];
    pieces.forEach(function (pc) {
      const P = pc.pos;
      for (let i = 0; i < pc.vertices; i++) {
        if (P[3 * i + 1] < lo) continue;
        p[0] = P[3 * i]; p[1] = P[3 * i + 1]; p[2] = P[3 * i + 2];
        const L = lim(p), cl = surf.closest(p); if (!cl) continue;
        // over the cloth's line the cloth is there: what is made of hair there is held to a millimetre over the skin (it is not seen); under the line it is held 3 mm under the cloth where the cloth is near
        const above = p[1] > ey + line_at(hw.line, Math.abs(Math.atan2(p[0], p[2] - zc))) + 0.002 && Math.sqrt(p[0] * p[0] + (p[2] - zc) * (p[2] - zc)) < 0.2 * sk.hs;
        let to = L >= 0.2 ? Infinity : Math.max(L - 0.003, 0.0012);
        if (above) to = Math.min(to, 0.0008);
        if (cl.s > to) { P[3 * i] = cl.q[0] + cl.n[0] * to; P[3 * i + 1] = cl.q[1] + cl.n[1] * to; P[3 * i + 2] = cl.q[2] + cl.n[2] * to; }
      }
    });
  }
  // the hair that is wholly under the cloth is not drawn: a triangle of it whose three vertices are over the cloth's line by 4 mm is left out (the cloth covers the whole head over its line; a coarse cloth over a coarse head is within a few
  // millimetres of the skin on the crown, and no hair that is made to be under it can keep from poking through it). What shows is the hair at and under the edge, held under the cloth by `fit_under`.
  function drop_under_cloth(ctx, sk, pieces, hw) {
    const ey = sk.ey, zc = ctx.A.pt("head.tail")[2];
    const over = function (P, i) { const x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2]; return y > ey + line_at(hw.line, Math.abs(Math.atan2(x, z - zc))) + 0.004 && Math.sqrt(x * x + (z - zc) * (z - zc)) < 0.2 * sk.hs; };
    pieces.forEach(function (pc) {
      const keep = [], T = pc.tris;
      for (let t = 0; t < T.length; t += 3) if (!(over(pc.pos, T[t]) && over(pc.pos, T[t + 1]) && over(pc.pos, T[t + 2]))) keep.push(T[t], T[t + 1], T[t + 2]);
      if (keep.length < T.length) pc.tris = Int32Array.from(keep);
    });
  }
  // what `under` means for the hair that hangs: the clothes it lies on; the cloth of the head is not one of them (the hair comes from under it)
  function under_for_hair(ctx, sk) {
    if (!ctx.under) return null;
    const u = Float32Array.from(ctx.under), P = ctx.B.P, lo = sk.ey - 0.1 * sk.hs;
    for (let v = 0; v < ctx.B.n; v++) if (P[3 * v + 1] > lo) u[v] = 0;
    return u;
  }

  // ---- grow
  function grow(ctx, spec) {
    const pieces = [];
    let paint = null;
    if (!spec) return { pieces: pieces, paint: null };
    const sk = skull(ctx), g = ctx.shape ? ctx.shape.gender : 0.5, sex_f = g < 0.5;
    const hs_k = Math.pow(sk.hs, 0.8);
    let hair_col = null;
    if (spec.hair && spec.hair.style !== "bald") {
      const sp = spec.hair, st = STYLES[sp.style], rnd = rng_of((sp.seed | 0) * 7919 + hash(sp.style) + (ctx.seed | 0));
      hair_col = sp.colour || COLOURS.brown;
      const dynamic = sp.dynamic === null ? st.dynamic : sp.dynamic, Href = ctx.A.height / 1.7, hw = head_wear(ctx), mine = [];
      const surf = make_surface(ctx.B, (st.mantle || st.tube) ? ctx.A.y.chest - 0.2 * Href : ctx.A.pt("jaw.tail")[1] - 0.06 * Href, st.mantle || st.tube ? (hw ? under_for_hair(ctx, sk) : ctx.under) : null);
      if (st.ridge) mine.push(make_mohawk(ctx, sk, sp, st, hs_k, rnd, hw));
      const cap = st.ridge ? null : make_cap(ctx, sk, sp, st, sex_f, hs_k, rnd, surf, hw);
      if (cap) mine.push(cap.piece);
      if (cap && (st.mantle || st.tube)) {
        const pc = st.mantle ? make_mantle(ctx, sk, cap, sp, st, sex_f, hs_k, rnd, surf, dynamic) : make_tube(ctx, sk, cap, sp, st, sex_f, hs_k, rnd, surf, dynamic, hw);
        if (pc) mine.push(pc);
      }
      if (cap && st.bun) { const pc = make_bun(ctx, sk, cap, sp, st, sex_f, hs_k, rnd, hw); if (pc) mine.push(pc); }
      if (hw) { fit_under(ctx, sk, surf, mine, hw); drop_under_cloth(ctx, sk, mine, hw); }
      mine.forEach(function (pc) { pieces.push(pc); });
    } else if (spec.hair) hair_col = spec.hair.colour || null;
    if (spec.brows) paint = make_brows(ctx, sk, spec.brows, spec.brows.colour ? null : (hair_col || COLOURS.dark_brown));
    if (spec.beard) {
      const bd = make_beard(ctx, sk, spec.beard, hair_col, spec.hair ? spec.hair.part : "hair", rng_of(hash("beard") + (ctx.seed | 0)));
      if (bd.piece) pieces.push(bd.piece);
      paint = merge_paint(paint, bd.paint);
    }
    return { pieces: pieces, paint: paint };
  }
  return { clean: clean, grow: grow, surface: make_surface, skull: skull, styles: styles, STYLES: STYLES, COLOURS: COLOURS, BROW_STYLES: BROW_STYLES, BEARD_STYLES: BEARD_STYLES, beard_styles: beard_styles, HEAD_LINES: HEAD_LINES, line_at: line_at, colour: colour };
});

// ========================================================================================================================
// human_lite_people
// ========================================================================================================================
packing()("human_lite_people", function human_lite_people() {
  "use strict";
  // HUMAN LITE PEOPLE: 72 named peoples of the lite human (pure data and small helpers: no engine, no GL, no system, nothing of human/; plain arrays in, plain objects out). Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no classes.
  // A people is the three shares of the body model (the lite human's `african`, `asian` and `caucasian` sliders, drawn round the people's own), a SKIN shift (what goes with them: -1 pale .. +1 dark of the colour that the shares make) and the chance of each EYE
  // colour and of each HAIR pigment (and the curl of the hair) that its people have. They are approximate: a body model of three races cannot say more, and two people of a people are drawn apart by the generator that uses this (a unit's face, its years).
  //   const P = human_lite_people();
  //   P.ETHNICITIES      [{ name, label, region, eth: [african, asian, caucasian], tone, eyes: [blue, grey, green, hazel, brown] | null, hair: { pig: [blond, light brown, brown, black], curl: [least, most] } | null }]      P.ethnicity_of(name) -> one or null (spaces and - are _)
  //   P.shares(E, rng) -> [african, asian, caucasian] of a person of the people E (E.eth, each moved by chance a little, made one, 4 digits)                     rng: a function -> 0 .. 1
  //   P.skin(shares, E, rng) -> { tone 0 .. 1, undertone -1 .. 1, ruddy 0 .. 1 } the look's three numbers of the lite human (human_lite_look.js)        P.eye(shares, E, rng) -> the name of one of the lite human's eyes (brown, light brown, hazel, green, grey, blue)
  //   P.hair(shares, E, rng) -> { pigment 0 (blond) .. 1 (black), red (true: a redhead), curl 0 (straight) .. 1 (tight) }
  const EYE_GROUPS = {"north":[0.55,0.12,0.08,0.1,0.15],"central":[0.35,0.12,0.13,0.15,0.25],"south":[0.08,0.05,0.12,0.2,0.55],"dark":[0.02,0.02,0.06,0.15,0.75],"latin":[0.05,0.04,0.08,0.18,0.65]};
  const HAIR_GROUPS = {"north":{"pig":[0.45,0.3,0.2,0.05],"curl":[0.05,0.5]},"central":{"pig":[0.2,0.3,0.35,0.15],"curl":[0.05,0.75]},"south":{"pig":[0.03,0.12,0.45,0.4],"curl":[0.1,0.8]},"dark":{"pig":[0,0.02,0.2,0.78],"curl":[0.1,0.8]},"latin":{"pig":[0.02,0.08,0.4,0.5],"curl":[0.1,0.85]},"horn":{"pig":[0,0.02,0.1,0.88],"curl":[0.35,0.85]}};
  const RACE_EYES = { african: [0.01, 0.01, 0.02, 0.1, 0.86], asian: [0.01, 0.01, 0.02, 0.06, 0.9], caucasian: [0.3, 0.12, 0.13, 0.15, 0.3] };                                  // (blue, grey, green, hazel, brown)
  const RACE_HAIR = { african: { pig: [0, 0.02, 0.08, 0.9], curl: [0.55, 0.95] }, asian: { pig: [0, 0.01, 0.09, 0.9], curl: [0.05, 0.3] }, caucasian: { pig: [0.2, 0.3, 0.3, 0.2], curl: [0.05, 0.75] } };       // (blond, light brown, brown, black; the curl)
  const RACES = ["african", "asian", "caucasian"], PIGMENT = [0, 0.34, 0.67, 1], EYE_NAMES = ["blue", "grey", "green", "hazel", "brown"];
  const clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  const round = function (x, n) { const m = Math.pow(10, n); return Math.round(x * m) / m; };
  // [name, label, region, [african, asian, caucasian], tone, eyes (EYE_GROUPS key | null), hair (HAIR_GROUPS key | null)]
  const ROWS = [
      ["swedish", "Swedish", "Northern Europe", [0, 0, 1], -0.35, "north", "north"],
      ["norwegian", "Norwegian", "Northern Europe", [0, 0, 1], -0.35, "north", "north"],
      ["danish", "Danish", "Northern Europe", [0, 0, 1], -0.33, "north", "north"],
      ["finnish", "Finnish", "Northern Europe", [0, 0.03, 0.97], -0.35, "north", "north"],
      ["icelandic", "Icelandic", "Northern Europe", [0, 0, 1], -0.32, "north", "north"],
      ["british", "British", "Western Europe", [0.01, 0.01, 0.98], -0.22, "central", "central"],
      ["irish", "Irish", "Western Europe", [0, 0, 1], -0.3, "central", "central"],
      ["german", "German", "Western Europe", [0, 0, 1], -0.2, "central", "central"],
      ["dutch", "Dutch", "Western Europe", [0, 0, 1], -0.25, "north", "central"],
      ["french", "French", "Western Europe", [0.02, 0.01, 0.97], -0.12, "central", "central"],
      ["austrian", "Austrian", "Western Europe", [0, 0, 1], -0.18, "central", "central"],
      ["italian", "Italian", "Southern Europe", [0.02, 0, 0.98], 0.12, "south", "south"],
      ["spanish", "Spanish", "Southern Europe", [0.02, 0, 0.98], 0.14, "south", "south"],
      ["portuguese", "Portuguese", "Southern Europe", [0.04, 0, 0.96], 0.14, "south", "south"],
      ["greek", "Greek", "Southern Europe", [0.01, 0, 0.99], 0.18, "south", "south"],
      ["polish", "Polish", "Eastern Europe", [0, 0.01, 0.99], -0.2, "central", "central"],
      ["russian", "Russian", "Eastern Europe", [0, 0.06, 0.94], -0.15, "central", "central"],
      ["ukrainian", "Ukrainian", "Eastern Europe", [0, 0.02, 0.98], -0.15, "central", "central"],
      ["czech", "Czech", "Eastern Europe", [0, 0, 1], -0.18, "central", "central"],
      ["hungarian", "Hungarian", "Eastern Europe", [0, 0.03, 0.97], -0.1, "central", "south"],
      ["romanian", "Romanian", "Eastern Europe", [0, 0.01, 0.99], -0.02, "south", "south"],
      ["turkish", "Turkish", "Middle East and North Africa", [0.02, 0.1, 0.88], 0.15, "south", "south"],
      ["saudi", "Saudi", "Middle East and North Africa", [0.12, 0, 0.88], 0.32, "dark", "dark"],
      ["egyptian", "Egyptian", "Middle East and North Africa", [0.2, 0, 0.8], 0.3, "dark", "dark"],
      ["moroccan", "Moroccan", "Middle East and North Africa", [0.18, 0, 0.82], 0.24, "dark", "dark"],
      ["lebanese", "Lebanese", "Middle East and North Africa", [0.03, 0, 0.97], 0.22, "south", "dark"],
      ["iranian", "Iranian", "Middle East and North Africa", [0, 0.08, 0.92], 0.25, "dark", "dark"],
      ["israeli", "Israeli", "Middle East and North Africa", [0.08, 0, 0.92], 0.2, "south", "south"],
      ["north_indian", "North Indian", "South Asia", [0.03, 0.15, 0.82], 0.4, "dark", "dark"],
      ["south_indian", "South Indian", "South Asia", [0.12, 0.1, 0.78], 0.6, "dark", "dark"],
      ["pakistani", "Pakistani", "South Asia", [0.03, 0.12, 0.85], 0.38, "dark", "dark"],
      ["bangladeshi", "Bangladeshi", "South Asia", [0.05, 0.25, 0.7], 0.45, "dark", "dark"],
      ["sri_lankan", "Sri Lankan", "South Asia", [0.1, 0.15, 0.75], 0.55, "dark", "dark"],
      ["nepali", "Nepali", "South Asia", [0, 0.5, 0.5], 0.3, "dark", "dark"],
      ["chinese", "Chinese", "East Asia", [0, 1, 0], -0.05, null, null],
      ["japanese", "Japanese", "East Asia", [0, 1, 0], -0.12, null, null],
      ["korean", "Korean", "East Asia", [0, 1, 0], -0.12, null, null],
      ["mongolian", "Mongolian", "East Asia", [0, 0.95, 0.05], 0, null, null],
      ["thai", "Thai", "Southeast and Central Asia", [0, 0.92, 0.08], 0.1, null, null],
      ["vietnamese", "Vietnamese", "Southeast and Central Asia", [0, 0.97, 0.03], 0.05, null, null],
      ["filipino", "Filipino", "Southeast and Central Asia", [0.03, 0.9, 0.07], 0.2, null, null],
      ["indonesian", "Indonesian", "Southeast and Central Asia", [0.03, 0.92, 0.05], 0.2, null, null],
      ["malaysian", "Malaysian", "Southeast and Central Asia", [0.02, 0.9, 0.08], 0.2, null, null],
      ["kazakh", "Kazakh", "Southeast and Central Asia", [0, 0.7, 0.3], -0.05, null, null],
      ["uzbek", "Uzbek", "Southeast and Central Asia", [0, 0.45, 0.55], 0.05, "dark", "dark"],
      ["afghan", "Afghan", "Southeast and Central Asia", [0, 0.25, 0.75], 0.2, "dark", "dark"],
      ["nigerian", "Nigerian", "Sub-Saharan Africa", [1, 0, 0], 0.15, null, null],
      ["ghanaian", "Ghanaian", "Sub-Saharan Africa", [1, 0, 0], 0.18, null, null],
      ["kenyan", "Kenyan", "Sub-Saharan Africa", [1, 0, 0], 0.1, null, null],
      ["ethiopian", "Ethiopian", "Sub-Saharan Africa", [0.8, 0, 0.2], -0.15, null, "horn"],
      ["happyli", "Happyli", "Sub-Saharan Africa", [0.78, 0, 0.22], -0.08, null, "horn"],
      ["south_african", "South African", "Sub-Saharan Africa", [1, 0, 0], 0.1, null, null],
      ["congolese", "Congolese", "Sub-Saharan Africa", [1, 0, 0], 0.2, null, null],
      ["senegalese", "Senegalese", "Sub-Saharan Africa", [1, 0, 0], 0.25, null, null],
      ["brazilian", "Brazilian", "Latin America and the Caribbean", [0.25, 0.12, 0.63], 0.2, "latin", "latin"],
      ["mexican", "Mexican", "Latin America and the Caribbean", [0.03, 0.3, 0.67], 0.15, "latin", "latin"],
      ["colombian", "Colombian", "Latin America and the Caribbean", [0.18, 0.15, 0.67], 0.15, "latin", "latin"],
      ["argentine", "Argentine", "Latin America and the Caribbean", [0.01, 0.05, 0.94], -0.02, "south", "south"],
      ["peruvian", "Peruvian", "Latin America and the Caribbean", [0.03, 0.6, 0.37], 0.1, "dark", "latin"],
      ["chilean", "Chilean", "Latin America and the Caribbean", [0.01, 0.25, 0.74], 0.02, "latin", "latin"],
      ["cuban", "Cuban", "Latin America and the Caribbean", [0.28, 0.02, 0.7], 0.2, "latin", "latin"],
      ["jamaican", "Jamaican", "Latin America and the Caribbean", [0.88, 0.02, 0.1], 0.18, null, null],
      ["haitian", "Haitian", "Latin America and the Caribbean", [0.9, 0, 0.1], 0.2, null, null],
      ["puerto_rican", "Puerto Rican", "Latin America and the Caribbean", [0.25, 0.1, 0.65], 0.18, "latin", "latin"],
      ["venezuelan", "Venezuelan", "Latin America and the Caribbean", [0.18, 0.12, 0.7], 0.15, "latin", "latin"],
      ["american", "American (mixed)", "North America", [0.15, 0.1, 0.75], 0, "central", "central"],
      ["african_american", "African American", "North America", [0.78, 0.02, 0.2], 0.1, null, null],
      ["native_american", "Native American", "North America", [0, 0.82, 0.18], 0.12, null, null],
      ["inuit", "Inuit", "North America", [0, 0.88, 0.12], -0.05, null, null],
      ["maori", "Maori", "Oceania", [0.05, 0.5, 0.45], 0.2, null, null],
      ["polynesian", "Polynesian", "Oceania", [0.08, 0.55, 0.37], 0.22, null, null],
      ["aboriginal_australian", "Aboriginal Australian", "Oceania", [0.65, 0.2, 0.15], 0.25, null, null]
  ];
  const ETHNICITIES = ROWS.map(function (r) { return { name: r[0], label: r[1], region: r[2], eth: r[3].slice(), tone: r[4], eyes: r[5] ? EYE_GROUPS[r[5]].slice() : null, hair: r[6] ? { pig: HAIR_GROUPS[r[6]].pig.slice(), curl: HAIR_GROUPS[r[6]].curl.slice() } : null }; });
  const BY = {}; ETHNICITIES.forEach(function (e) { BY[e.name] = e; });
  const ethnicity_of = function (x) { if (x === undefined || x === null || x === "") return null; const k = String(x).toLowerCase().replace(/[ -]+/g, "_"); return Object.prototype.hasOwnProperty.call(BY, k) ? BY[k] : null; };
  function shares(E, rng) {
    const s = E.eth.map(function (x) { return Math.max(0, x + (rng() - 0.5) * 0.06); }), t = s[0] + s[1] + s[2] || 1;
    return s.map(function (x) { return round(x / t, 4); });
  }
  // what the three races make of a table that is theirs, by the person's shares (a people with a table of its own: that)
  const mixed = function (sh, table, n) { const o = new Array(n).fill(0); for (let k = 0; k < 3; k++) for (let i = 0; i < n; i++) o[i] += sh[k] * table[RACES[k]][i]; return o; };
  const weighted = function (list, w, u) { let tot = 0; w.forEach(function (x) { tot += x; }); let v = u * tot; for (let i = 0; i < list.length; i++) { v -= w[i]; if (v <= 0) return list[i]; } return list[list.length - 1]; };
  // the colour of the skin: the three races' (a pale .. deep ramp of the look: the means of what each race is) shifted by the people's own tone, and by chance; the undertone is warm for an asian or a southern skin, cool for a northern one
  function skin(sh, E, rng) {
    const tot = sh[0] + sh[1] + sh[2] || 1, mean = (sh[0] * 0.86 + sh[1] * 0.38 + sh[2] * 0.22) / tot, t = E ? E.tone : 0;
    return { tone: round(clamp(mean + 0.2 * t + (rng() - 0.5) * 0.24, 0, 1), 3), undertone: round(clamp(0.5 * sh[1] / tot + 0.1 * sh[0] / tot - 0.2 * sh[2] / tot + 0.5 * t + (rng() - 0.5) * 0.4, -1, 1), 3), ruddy: round(clamp(0.18 + 0.1 * sh[2] / tot + rng() * 0.12, 0, 1), 3) };
  }
  function eye(sh, E, rng) {
    const f = E && E.eyes ? E.eyes : mixed(sh, RACE_EYES, 5), k = weighted(EYE_NAMES, f, rng()), v = rng();
    return k === "brown" ? (v < 0.28 ? "light brown" : "brown") : k;
  }
  function hair(sh, E, rng) {
    let pig, lo, hi;
    if (E && E.hair) { pig = E.hair.pig; lo = E.hair.curl[0]; hi = E.hair.curl[1]; }
    else { pig = mixed(sh, { african: RACE_HAIR.african.pig, asian: RACE_HAIR.asian.pig, caucasian: RACE_HAIR.caucasian.pig }, 4); lo = 0; hi = 0; for (let k = 0; k < 3; k++) { lo += sh[k] * RACE_HAIR[RACES[k]].curl[0]; hi += sh[k] * RACE_HAIR[RACES[k]].curl[1]; } }
    const p = weighted([0, 1, 2, 3], pig, rng()), red = rng() < 0.1 && p <= 2, curl = lo + (hi - lo) * rng();
    return { pigment: PIGMENT[p], red: red, curl: round(curl, 3) };
  }
  return { ETHNICITIES: ETHNICITIES, ethnicity_of: ethnicity_of, shares: shares, skin: skin, eye: eye, hair: hair, EYE_NAMES: EYE_NAMES.slice() };
});

// ========================================================================================================================
// human_lite
// ========================================================================================================================
packing()("human_lite", function human_lite(parts, look, mutate, wear, hair, skin, face_shape) {
  "use strict";
  // HUMAN LITE: a person of a few sliders, with no other body model in it (pure: no engine, no GL, no system; plain arrays in, plain objects out). Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no classes.
  // Everything it needs to know about a body is in ONE file, human_lite.hlt.gz (human_lite/tools/lite_harvest.js made it once, from the source body's targets; it is the source of the lite human from then on):
  //   the mesh (the whole body of the source body decimated to about 8 000 triangles: the face, the breast, the hands and the feet are its own), the skin weights of a 31 bone skeleton, the masks the palette is painted by, the POINTS (the joints, the joints of the
  //   fingers and the toes, anchors for the eyes, the feet and the hands), the MACRO MODEL (gender, age, muscle, weight, height and the three races: the bodies at the corners of their knots, compressed to K components) and the SLIDERS
  //   (additive deltas of the rows: head width, nose length, leg length ...). The belly, the bottom, the thighs ... are sliders of the source body's own modifiers added up (composites), taken past their top.
  //
  //   const L = human_lite(parts, look, mutate, wear, hair, skin);   the modules human_lite_parts (the eyes), human_lite_look (the palette), human_lite_mutate (MUTATION below), human_lite_wear (CLOTHES below) and human_lite_hair (HAIR below);
  //                                                        `skin` (human_lite_skin, optional) draws the person from a TEXTURE: def.skin, TEXTURED SKIN below
  //   L.load(bytes) -> Promise<model>                      the bytes of the file (a gzip file is unpacked, with DecompressionStream; the container itself too)
  //   L.parse(arraybuffer) -> model                        the container of the file
  //   L.defaults(model) -> { gender: 0.5, age: 0.5, ..., african: 1 / 3, ..., <every slider>: its default, <every field>: 0, scale: 1 }       L.slider_list(model) -> [{ name, group, label, lo, hi, def, kind }] for a panel
  //   L.params(model, shape, who) -> the full parameters (the defaults, the shape on top; an unknown name or a value out of range is an Error that says so)
  //   L.shape(model, params) -> { rows: Float32Array (3 numbers a row: the vertices, then the points; metres, the y of the real system), frame: { ground, top, height } }        the macros, then the sliders
  //   L.point(model, rows, name) -> [x, y, z]              L.age_years(v)  L.age_value(years)
  //   L.build(model, def, who) -> { file, measure, ... }   the creature of a lite human: def { shape: { gender, age, nose_length, belly ... }, look: { tone, ... }, gait, soft }; `file` is what system.species takes (the restart's creature
  //                                                        format: skeleton, rig, roles, legs, body, physics, mesh, tissue), made.measure the proportions in metres, made.frame, made.shape the full parameters, made.look the full look,
  //                                                        made.soft the soft bones and their numbers (SOFT TISSUE below), made.mutation what the dice did (MUTATION below)
  const GZIP = [0x1f, 0x8b];
  const clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  const fail = function (msg) { throw new Error("human_lite: " + msg); };

  // ---- the file
  function inflate(bytes) {
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (u[0] === GZIP[0] && u[1] === GZIP[1]) {
      if (typeof DecompressionStream === "function" && typeof Response === "function" && typeof Blob === "function") return new Response(new Response(new Blob([u])).body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
      return Promise.reject(new Error("human_lite: no DecompressionStream: this host cannot read a gzip file"));
    }
    return Promise.resolve(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength));
  }
  // the container of the lite human's files (tools/lite_container.js writes it): four letters (HLT1), the header's length (u32), the header as JSON padded to 4 bytes, the blobs { o, n, t } of it
  function container(buf, magic) {
    const u8 = new Uint8Array(buf);
    if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== magic) fail("not a human_lite file (it does not begin with " + magic + ")");
    const n = u8[4] | (u8[5] << 8) | (u8[6] << 16) | (u8[7] << 24);
    let text = ""; for (let i = 0; i < n; i += 8192) text += String.fromCharCode.apply(null, u8.subarray(8 + i, 8 + Math.min(n, i + 8192)));
    const h = JSON.parse(text), base = 8 + n + ((4 - n % 4) % 4);
    const view = function (b) { const C = b.t === "i16" ? Int16Array : b.t === "u8" ? Uint8Array : b.t === "u16" ? Uint16Array : b.t === "u32" ? Uint32Array : Float32Array; return new C(buf, base + b.o, b.n); };
    return { header: h, view: view };
  }
  function parse(buf) {
    const ct = container(buf, "HLT1"), h = ct.header, view = ct.view;
    if (h.format !== "happy.human_lite" || h.version !== 1) fail("a file of format '" + h.format + "' " + h.version + ": this reads system.human_lite 1");
    const nv = h.nv, np = h.np, D = 3 * (nv + np), K = h.K;
    const model = { header: h, nv: nv, np: np, rows: nv + np, D: D, K: K, tris: view(h.triangles), mean: view(h.mean), basis: view(h.basis), basis_scale: h.basis_scale, coef: view(h.coef), skin_indices: view(h.skin_indices), skin_weights: view(h.skin_weights), masks: view(h.masks),
      uv: h.uv ? { render: h.uv.render, coords: view(h.uv.coords), owner: view(h.uv.owner), corner: view(h.uv.corner) } : null, skin: null,    // (uv: lite_harvest.js --uv; skin: the base skin kit of human_lite_skin.parse, given by whoever read the pack's human.skin)
      dims: h.dims, macros: h.macros, bones: h.bones, pt: {}, sliders: [], by_name: {},
      joint_reg: h.joint_reg ? { off: view(h.joint_reg.off), idx: view(h.joint_reg.idx), w: view(h.joint_reg.w) } : null };    // (tools/lite_extend.js: what a the source body target needs, MORE SLIDERS below)
    h.points.forEach(function (name, i) { model.pt[name] = nv + i; });
    h.sliders.forEach(function (s) {
      const side = function (b, scale) {                                                              // (the rows that a delta moves, with the numbers: most sliders move a part of the body)
        if (!b) return null;
        const q = view(b), idx = [], rows = h.nv + h.np;
        for (let r = 0; r < rows; r++) if (q[3 * r] || q[3 * r + 1] || q[3 * r + 2]) idx.push(r);
        const vals = new Float32Array(3 * idx.length);
        idx.forEach(function (r, i) { vals[3 * i] = q[3 * r] * scale; vals[3 * i + 1] = q[3 * r + 1] * scale; vals[3 * i + 2] = q[3 * r + 2] * scale; });
        return { rows: Uint16Array.from(idx), vals: vals };
      };
      const o = { name: s.name, group: s.group, label: s.label, lo: s.lo, hi: s.hi, def: s.def, up: side(s.up, s.up_scale), dn: side(s.dn, s.dn_scale), bust: !!s.bust, table: s.table || null };
      model.sliders.push(o); model.by_name[s.name] = o;
    });
    return model;
  }
  function load(bytes) { return inflate(bytes).then(parse); }

  // ---- the numbers of a person
  const AGE = { min: 1, mid: 25, max: 90 };
  const age_years = function (v) { v = clamp(+v, 0, 1); return v < 0.5 ? AGE.min + (AGE.mid - AGE.min) * 2 * v : AGE.mid + (AGE.max - AGE.mid) * 2 * (v - 0.5); };
  const age_value = function (y) { y = clamp(+y, AGE.min, AGE.max); return y < AGE.mid ? (y - AGE.min) / ((AGE.mid - AGE.min) * 2) : 0.5 + (y - AGE.mid) / ((AGE.max - AGE.mid) * 2); };
  const MACRO_NAMES = ["gender", "age", "muscle", "weight", "height"], RACE_NAMES = ["african", "asian", "caucasian"];
  function defaults(model) {
    const d = { scale: 1 };
    model.macros.forEach(function (m) { d[m.name] = m.def; });
    RACE_NAMES.forEach(function (r) { d[r] = 1 / 3; });
    model.sliders.forEach(function (s) { d[s.name] = s.def; });
    return d;
  }
  function slider_list(model) {
    const out = [];
    model.macros.forEach(function (m) { out.push({ name: m.name, group: "type", label: m.label, lo: m.lo === undefined ? 0 : m.lo, hi: m.hi === undefined ? 1 : m.hi, def: m.def, kind: "macro" }); });
    RACE_NAMES.forEach(function (r) { out.push({ name: r, group: "type", label: r, lo: 0, hi: 1, def: 1 / 3, kind: "race" }); });
    out.push({ name: "scale", group: "type", label: "size (a whole body bigger or smaller)", lo: 0.4, hi: 2.5, def: 1, kind: "scale" });
    const rank = { body: 0, bust: 1, face: 2 };                                                       // (the panel's order of the groups: type, body, bust, face, whatever the file lists first)
    model.sliders.map(function (s, i) { return [rank[s.group] === undefined ? 9 : rank[s.group], i, s]; }).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }).forEach(function (e) { const s = e[2]; out.push({ name: s.name, group: s.group, label: s.label, lo: s.lo, hi: s.hi, def: s.def, kind: "slider" }); });
    return out;
  }
  function edit_distance(a, b) {                                                                  // (for a slider that is spelt a little wrong: did you mean ...)
    let prev = []; for (let j = 0; j <= b.length; j++) prev.push(j);
    for (let i = 1; i <= a.length; i++) { const cur = [i]; for (let j = 1; j <= b.length; j++) cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))); prev = cur; }
    return prev[b.length];
  }
  // the full parameters of a person: the defaults with `shape` on top. A mistake is an Error that names the creature and says which (an unknown slider, a value that is no number or is out of its range); given `notes` (an array) it is NOT one: the creature is
  // made offline of whatever it is given, so a value out of its range is held to the end of it, a value that is no number and a slider that does not exist are left out, and each is said in `notes`
  function params(model, shape, who, notes) {
    const p = defaults(model), known = {}, list = slider_list(model), errs = [];
    list.forEach(function (s) { known[s.name] = s; });
    if (shape !== undefined && shape !== null && (typeof shape !== "object" || Array.isArray(shape))) { errs.push("the shape is { slider: value }"); shape = {}; }
    Object.keys(shape || {}).forEach(function (k) {
      const s = known[k]; let v = shape[k];
      if (!s) { const near = Object.keys(known).filter(function (n) { return n.indexOf(k) >= 0 || k.indexOf(n) >= 0 || edit_distance(n, k) <= Math.max(2, Math.floor(k.length / 4)); }).slice(0, 4); errs.push("no slider '" + k + "'" + (near.length ? " (did you mean " + near.join(", ") + "?)" : "")); return; }
      if (notes && typeof v === "string" && v.trim() !== "" && isFinite(+v)) v = +v;
      if (typeof v !== "number" || !isFinite(v)) { errs.push("the slider '" + k + "' is a number"); return; }
      if (v < s.lo - 1e-9 || v > s.hi + 1e-9) {
        if (!notes) { errs.push("the slider '" + k + "' is " + v + ": it goes from " + s.lo + " to " + s.hi); return; }
        notes.push((who ? "creature '" + who + "': " : "") + "human_lite: the slider '" + k + "' goes from " + s.lo + " to " + s.hi + ": " + v + " is held to " + (v < s.lo ? s.lo : s.hi));
        v = v < s.lo ? s.lo : s.hi;
      }
      p[k] = v;
    });
    if (errs.length) {
      if (!notes) fail((who ? "creature '" + who + "': " : "") + errs.join("; "));
      errs.forEach(function (e) { notes.push((who ? "creature '" + who + "': " : "") + "human_lite: " + e + ": left out"); });
    }
    return p;
  }

  // ---- THE POINTS FOLLOW THE FLESH: a deformation of the mesh (a field of the motion of every vertex: what a gene, a mutation or a test makes) moves the skeleton with it. The file's `joint_reg` (tools/lite_extend.js) gives each of the 69 points
  //   the weights, all >= 0 and 1 in all, of the vertices that it is the mean of (fitted on bodies of the file's own model, exact non negative least squares), so a point goes where the flesh round it goes and the SKELETON follows a morph that the
  //   file has no rows for: on the file's own sliders it predicts the joints' motion to 0.45 mm where they move 7.4 mm. (A free regression, SMPL's way, was 1 mm on people and sent a joint away on a horse: its weights were +-16 in all.) The eyes are
  //   the exception: they go with the skin of their lids, whole, so that a face that is pushed about does not stretch the eyeball (it was 2.5 times as big).
  //   L.points_follow(model, dv) -> Float32Array (3 numbers for each of the 69 points: their motion, metres)        dv: 3 numbers for each vertex, the motion of the vertex (metres)
  //   L.add_slider(model, { name, group, label, lo, hi, def, up: { rows: Uint16Array, vals: Float32Array } }) -> the slider      a slider made of such a field (the rows are of vertices, then of points): the model has it from then on
  const EPS_ROW = 5e-6;                                                                                  // (metres: a row that moves less is not a row)
  function points_follow(model, dv) {
    if (!model.joint_reg) fail("this file has no joint_reg (human_lite/tools/lite_extend.js adds it)");
    const nv = model.nv, np = model.np, reg = model.joint_reg, out = new Float32Array(3 * np);
    if (!model.eye_skin) {
      model.eye_skin = {};
      ["L", "R"].forEach(function (s) {
        const mine = {}; model.bones.forEach(function (b, i) { if (b.name === "lid." + s || b.name === "eye." + s) mine[i] = 1; });
        const list = []; for (let i = 0; i < nv; i++) { let w = 0; for (let q = 0; q < 4; q++) if (mine[model.skin_indices[4 * i + q]]) w += model.skin_weights[4 * i + q]; if (w >= 102) list.push(i); }
        model.eye_skin[s] = list;
      });
    }
    const over = {};
    ["L", "R"].forEach(function (s) {
      const list = model.eye_skin[s]; if (list.length < 3) return;
      let mx = 0, my = 0, mz = 0; list.forEach(function (i) { mx += dv[3 * i]; my += dv[3 * i + 1]; mz += dv[3 * i + 2]; }); mx /= list.length; my /= list.length; mz /= list.length;
      ["eye." + s + ".head", "eye." + s + ".tail", "eye." + s + ".front", "lid." + s + ".head", "lid." + s + ".tail"].forEach(function (n) { if (model.pt[n] !== undefined) over[model.pt[n] - nv] = [mx, my, mz]; });
    });
    for (let j = 0; j < np; j++) {
      let x = 0, y = 0, z = 0;
      if (over[j]) { x = over[j][0]; y = over[j][1]; z = over[j][2]; }
      else for (let q = reg.off[j]; q < reg.off[j + 1]; q++) { const v = reg.idx[q], w = reg.w[q]; x += w * dv[3 * v]; y += w * dv[3 * v + 1]; z += w * dv[3 * v + 2]; }
      out[3 * j] = x; out[3 * j + 1] = y; out[3 * j + 2] = z;
    }
    return out;
  }
  function add_slider(model, s) {
    const known = {}; slider_list(model).forEach(function (x) { known[x.name] = true; });
    if (typeof s.name !== "string" || !/^[a-z][a-z0-9_]*$/.test(s.name)) fail("a slider's name is lower case letters, digits and _ ('" + s.name + "')");
    if (known[s.name]) fail("the file has a slider '" + s.name + "' already");
    const o = { name: s.name, group: s.group || "body", label: s.label || s.name.replace(/_/g, " "), lo: s.lo === undefined ? 0 : s.lo, hi: s.hi === undefined ? 1 : s.hi, def: s.def === undefined ? 0 : s.def, up: s.up || null, dn: s.dn || null, bust: false, table: null };
    model.sliders.push(o); model.by_name[o.name] = o;
    return o;
  }

  // ---- the shape: the macro model, then the sliders
  function tents(x, knots) {                                                                      // the weights of a value between the knots; past the first or the last knot the last segment is FOLLOWED ON (a weight of 2: the body at 1 and once more what 0.5 .. 1 added)
    const o = new Array(knots.length).fill(0), n = knots.length;
    if (x < knots[0]) { const t = (knots[0] - x) / (knots[1] - knots[0]); o[0] = 1 + t; o[1] = -t; return o; }
    if (x > knots[n - 1]) { const t = (x - knots[n - 1]) / (knots[n - 1] - knots[n - 2]); o[n - 1] = 1 + t; o[n - 2] = -t; return o; }
    if (x === knots[0]) { o[0] = 1; return o; }
    if (x === knots[n - 1]) { o[n - 1] = 1; return o; }
    for (let i = 0; i < n - 1; i++) if (x >= knots[i] && x <= knots[i + 1]) { const t = (x - knots[i]) / (knots[i + 1] - knots[i]); o[i] = 1 - t; o[i + 1] = t; return o; }
    return o;
  }
  function shape(model, p) {
    const K = model.K, D = model.D, dims = model.dims, c = new Float64Array(K);
    const factors = model.macros.map(function (m) { return tents(p[m.name], m.knots); });
    let rs = p.african + p.asian + p.caucasian; if (!(rs > 0)) rs = 1;
    factors.push([p.african / rs, p.asian / rs, p.caucasian / rs]);
    // the corners with a weight (at most 2 x 2 x 2 x 2 x 2 x 3): the product of the factors' weights, the sum of their rows of coefficients
    let list = [[0, 1]];
    for (let d = 0; d < dims.length; d++) {
      const next = [], f = factors[d];
      for (let i = 0; i < list.length; i++) for (let j = 0; j < f.length; j++) if (Math.abs(f[j]) > 1e-9) next.push([list[i][0] * dims[d] + j, list[i][1] * f[j]]);
      list = next;
    }
    for (let i = 0; i < list.length; i++) { const o = list[i][0] * K, w = list[i][1]; for (let k = 0; k < K; k++) c[k] += w * model.coef[o + k]; }
    const rows = new Float32Array(D);
    rows.set(model.mean);
    const B = model.basis, sc = model.basis_scale;
    for (let k = 0; k < K; k++) { const ck = c[k] * sc; if (!ck) continue; const o = k * D; for (let i = 0; i < D; i++) rows[i] += ck * B[o + i]; }
    // the sliders: x = how far to the top (up) or the bottom (down) of the slider's range; the bust's are scaled by the corner table (a woman's, in her years)
    const g_t = factors[0], a_t = factors[1];
    for (let s = 0; s < model.sliders.length; s++) {
      const sl = model.sliders[s], v = p[sl.name];
      if (v === sl.def) continue;
      const up = v > sl.def, side = up ? sl.up : sl.dn;
      if (!side) continue;
      let x = up ? (v - sl.def) / (sl.hi - sl.def) : (sl.def - v) / (sl.def - sl.lo);
      if (sl.bust && sl.table) {
        const tb = sl.table[up ? "up" : "dn"]; let f = 0;
        if (tb) for (let g = 0; g < g_t.length; g++) for (let a = 0; a < a_t.length; a++) f += g_t[g] * a_t[a] * tb[g * a_t.length + a];
        x *= f;
      }
      for (let i = 0; i < side.rows.length; i++) { const r = 3 * side.rows[i]; rows[r] += x * side.vals[3 * i]; rows[r + 1] += x * side.vals[3 * i + 1]; rows[r + 2] += x * side.vals[3 * i + 2]; }
    }
    return { rows: rows, frame: frame_of(model, rows), tents: { gender: g_t, age: a_t } };
  }
  const point = function (model, rows, name) { const r = model.pt[name]; if (r === undefined) fail("no point '" + name + "'"); return [rows[3 * r], rows[3 * r + 1], rows[3 * r + 2]]; };
  // the frame of the body: its ground and its top, from the points (the soles, the top of the head) as the source body has them. A morph that is no person's (a horse's head hangs low, a sole is carried by the flesh round it: the points are where
  // the flesh took them) can leave them far from the mesh, so the body stands on its lowest vertex when the soles would sink it more than 2 cm, and is as high as its highest vertex when the top of the head is more than a thirtieth of the
  // body under it. (A person's vertices and points agree to a centimetre: nothing is touched.)
  function frame_of(model, rows) {
    let top = rows[3 * model.pt["head.tail"] + 1], ground = Math.min(rows[3 * model.pt["foot.L.sole"] + 1], rows[3 * model.pt["foot.R.sole"] + 1]), lo = 1e9, hi = -1e9;
    for (let i = 0; i < model.nv; i++) { const y = rows[3 * i + 1]; if (y < lo) lo = y; if (y > hi) hi = y; }
    if (lo < ground - 0.02) ground = lo;
    if (hi > top + 0.03 * (hi - lo)) top = hi;
    if (!(top - ground > 0.05)) top = ground + Math.max(hi - lo, 0.05);                                  // (a body has a height)
    return { ground: ground, top: top, height: top - ground };
  }
  // ---- THE CREATURE: the skeleton from the points, the rig (joints that have limits, chains), the roles the life plays, the legs of the gait, the physics proxy, and the skinned mesh (the body, the hands and feet, the eyes). The pieces
  // that are not about the source body come from human/human_creature.js, which the lite human replaces (the numbers of the joints, the gait's ride and crouch, the sole's roll are the same: a person of the lite human walks as hers did)
  // A PERSON STANDS WITH STRAIGHT LEGS AND WALKS WITH THE KNEES BENT. The ride (the hips' height) is the bind pose's, a leg at 99.5 % of its length (a knee bent 11 degrees: the relaxed stand of a person), and the gait sinks the hips by
  // `crouch` for every unit of speed over the style's walking speed, so the walk keeps the height it always had: 0.084 of the leg (a person's walk is made at 93 % of the leg: the recorded stride needs the reach that height gives, a
  // straighter walk shortens the step and makes the feet shuffle: measured with the gait demo). Standing at that height was a crouch of 40 degrees at every street corner. A style recorded at a lower hip height (its `ride` is under 1:
  // person_walk_cautious 0.977) still stands a little lower: the style's share multiplies the ride
  const DEG = Math.PI / 180, RIDE_STRETCH = 0.995, CROUCH_SHARE = 0.084, PEOPLE_POSTURE = 0.25, BALL_SHARE = 0.75, JAW_MAX = 22;
  // the share of the sideways spread of the feet's stance places that a person's gait keeps: the lite human's bind pose stands its feet 38 cm apart (ankle to ankle: its legs are 6 degrees out, the way of a T pose), and a walk
  // on two lines 38 cm apart is a skater's; a person's feet land 8 to 15 cm apart. 0.35 puts them 13 cm apart (the hips' joints are 22 cm apart, the knees do not touch)
  const PEOPLE_STANCE = 0.35;
  const add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }, sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }, mul = function (a, k) { return [a[0] * k, a[1] * k, a[2] * k]; };
  const dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }, cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  const len = function (a) { return Math.sqrt(dot(a, a)); }, unit = function (a) { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const round = function (x, n) { const m = Math.pow(10, n === undefined ? 4 : n); return Math.round(x * m) / m; }, rounded = function (p, n) { return [round(p[0], n), round(p[1], n), round(p[2], n)]; };
  const PROFILE = {
    hips: "hips", spine: ["spine1", "spine2", "spine3"], neck: ["neck"], head: "head", eyes: ["eye.L", "eye.R"], jaw: "jaw", lids: [{ bone: "lid.L", dir: 1 }, { bone: "lid.R", dir: 1 }],
    legs: [{ side: "l", bones: ["thigh.L", "shin.L"], tip: "foot.L" }, { side: "r", bones: ["thigh.R", "shin.R"], tip: "foot.R" }],
    arms: [{ side: "l", bones: ["upperarm.L", "lowerarm.L"], hand: "hand.L" }, { side: "r", bones: ["upperarm.R", "lowerarm.R"], hand: "hand.R" }],
  };
  function measure_of(skeleton, profile, height) {
    const by = {}; skeleton.forEach(function (b) { by[b.name] = b; });
    const leg = profile.legs[0], up = by[leg.bones[0]], knee = by[leg.bones[1]], foot = by[leg.tip];
    const thigh = len(sub(knee.head, up.head)), shin = len(sub(foot.head, knee.head));
    const a = profile.arms[0], u = by[a.bones[0]], f = by[a.bones[1]], arm = len(sub(f.head, u.head)) + len(sub(f.tail, f.head));
    return { height: height, hips: by[profile.hips].head[1], leg: thigh + shin, thigh: thigh, shin: shin, ankle: foot.head[1], arm: arm, scale: height / 1.8 };
  }
  // THE RIG IS MADE OF WHATEVER THE BODY IS: no geometry is refused (a morph may lay the spine down, put two joints in one place, bend a knee past its range: a horse, a mutant), because the creature is made offline from any settings. What the engine
  // refuses (kernel.js: a bone with no axis, a chain whose bone does not point at the next, a joint whose `up / down` is not along the bone's lateral axis, a hinge along its bone, a range that does not hold 0) is never given to it: a bone is at least
  // MIN_BONE long, a chain's links are made so that each bone points at the next, the joints say only what the engine takes for any bone (`out / in` with a side, never `up / down` or an `out_dir`), a hinge's axis is across its bone and its range holds 0.
  const MIN_BONE = 0.004;
  function sane_bones(bones, by) {                                                                       // every bone is numbers and has an axis (a tail on its head has none)
    bones.forEach(function (b) {
      for (let q = 0; q < 3; q++) { if (!isFinite(b.head[q])) b.head[q] = 0; if (!isFinite(b.tail[q])) b.tail[q] = b.head[q]; }
      if (len(sub(b.tail, b.head)) < 0.002) {
        const pa = b.parent ? by[b.parent] : null, ax = pa && len(sub(pa.tail, pa.head)) > 1e-6 ? unit(sub(pa.tail, pa.head)) : [0, -1, 0];
        b.tail = rounded(add(b.head, mul(ax, 0.002)), 5);
      }
    });
  }
  // a chain's bones are each the child of the one before and CONTINUE it along its axis: a bone that hangs from the side of another (a clavicle from the top of the spine) has its head put on its parent's axis, ahead of the parent's head (the
  // body of a person: at the child's own height; a spine that lies down: where the child's head projects). A link that is shorter than MIN_BONE is made one, along the way the chain was going. A link that is right is left as it is, to the digit.
  function chain_axes(by, chains, side_links) {
    chains.forEach(function (ch) {
      let way = null;                                                                                    // the way the chain has been going (the axis of the last link)
      for (let k = 1; k < ch.length; k++) {
        const p = by[ch[k - 1]], c = by[ch[k]], pa = sub(p.tail, p.head), d = sub(c.head, p.head), y = len(pa) > 1e-6 ? unit(pa) : (way || [0, -1, 0]), along = dot(d, y), perp = len(sub(d, mul(y, along)));
        if (along > 1e-6 && perp <= 0.0015 * len(d) && len(d) >= MIN_BONE) { way = y; continue; }
        if (side_links[c.name]) {
          const yl = Math.max(len(pa), MIN_BONE), t0 = y[1] > 0.2 ? (c.head[1] - p.head[1]) / y[1] : along, t = clamp(isFinite(t0) ? t0 : yl, Math.max(0.1 * yl, MIN_BONE), 4 * yl);
          c.head = rounded(add(p.head, mul(y, t)), t < 0.02 ? 7 : 5);                                           // (a short link is held to more digits: the engine takes a head 0.2 % of the link off the axis)
        } else {
          if (len(d) < MIN_BONE) { c.head = rounded(add(p.head, mul(len(d) > 1e-9 ? unit(d) : (way || y), MIN_BONE)), 5); }
          p.tail = c.head.slice();
        }
        way = unit(sub(c.head, p.head));
      }
    });
  }
  const bend_between = function (u, f) { return Math.acos(clamp(dot(u, f), -1, 1)) / DEG; };
  function flex_joint(by, name, upper, fore, away, max_flex) {
    const u = unit(sub(by[upper].tail, by[upper].head)), f = unit(sub(by[fore].tail, by[fore].head)), bend = bend_between(u, f);
    let n = cross(u, f);
    if (len(n) > 0.02) n = unit(n);
    else {                                                                                               // (a straight limb: the axis is across it toward `away`; a limb that points that way takes the next axis that is across it)
      let best = null;
      [away, [1, 0, 0], [0, 1, 0], [0, 0, 1]].some(function (a) { const c = cross(u, a); if (len(c) > 0.3) { best = c; return true; } if (!best || len(c) > len(best)) best = c; return false; });
      n = unit(best);
    }
    return { bone: name, kind: "hinge", axis: n.map(function (x) { return round(x, 4); }), range: [-round(bend + 3, 1), Math.max(1, round(max_flex - bend, 1))] };      // (the range holds 0 whatever the bind pose's bend is)
  }
  function joints_def(by, profile, chains) {
    const J = [], B = function (name, o) { J.push(Object.assign({ bone: name }, o)); }, torso = chains.torso, neck = chains.neck;
    torso.forEach(function (nm) { const n = torso.length; B(nm, { kind: "ball", fwd: round(70 / n, 1), back: round(45 / n, 1), lat: round(50 / n, 1), twist: round(60 / n, 1) }); });
    neck.forEach(function (nm) { const n = neck.length; B(nm, { kind: "ball", fwd: round(50 / n, 1), back: round(50 / n, 1), lat: round(40 / n, 1), twist: round(60 / n, 1) }); });
    B(profile.head, { kind: "ball", fwd: 35, back: 45, lat: 35, twist: 50 });
    profile.arms.forEach(function (a, i) {
      const clav = chains.clav[i], upper = a.bones[0], fore = a.bones[1], u = unit(sub(by[upper].tail, by[upper].head)), side = by[upper].head[0] >= 0 ? 1 : -1, sd = side > 0 ? "left" : "right";
      if (clav) B(clav, { kind: "ball", out: 30, in: 15, fwd: 20, back: 20, twist: 15, side: sd });
      const elev = Math.asin(clamp(u[1], -1, 1)) / DEG;
      if (Math.abs(u[1]) < 0.9 && Math.hypot(u[0], u[1]) > 0.3) B(upper, { kind: "ball", out: clamp(round(100 - elev, 1), 40, 180), in: clamp(round(110 + elev, 1), 20, 180), fwd: 100, back: 50, twist: [-90, 90], side: sd });
      else B(upper, { kind: "ball", out: 100, in: 60, fwd: 100, back: 50, twist: [-90, 90], side: sd });
      B(fore, flex_joint(by, fore, upper, fore, [0, 0, 1], 150));
      B(a.hand, { kind: "ball", fwd: 55, back: 55, lat: 45, twist: [-100, 100] });
    });
    profile.legs.forEach(function (l) {
      B(l.bones[0], { kind: "ball", fwd: 120, back: 25, out: 50, in: 30, twist: [-40, 40] });
      B(l.bones[1], flex_joint(by, l.bones[1], l.bones[0], l.bones[1], [0, 0, -1], 150));
      B(l.tip, { kind: "ball", fwd: 30, back: 50, lat: 20, twist: 20 });
    });
    return J;
  }
  function legs_def(profile, M, by, gait, ball_heel) {
    const g = gait || {}, walk = g.walk || "person_walk";
    const hip_y = by[profile.legs[0].bones[0]].head[1], ride = Math.max(round(by[profile.hips].head[1] - Math.max(0, hip_y - (M.ankle + RIDE_STRETCH * M.leg)), 4), round(0.05 * M.height, 4), 0.01), crouch = round(CROUCH_SHARE * M.leg, 4);       // (the ride is a height the engine wants over 0.1 mm: a body whose legs cannot reach the ground from its hips has at least a twentieth of its height)
    const gaits = [{ from: walk, ride: ride, crouch: crouch }];
    if (g.run) gaits.push({ from: g.run, ride: ride, crouch: crouch });
    gaits.forEach(function (x) {
      x.stance = g.stance === undefined ? PEOPLE_STANCE : g.stance;
      if (g.upper === false) x.upper = false; else if (g.upper && typeof g.upper === "object") x.upper = Object.assign({ posture: PEOPLE_POSTURE }, g.upper); else x.upper = { posture: PEOPLE_POSTURE };
      if (g.feet === false) x.feet = false; else if (g.feet && typeof g.feet === "object") x.feet = Object.assign({}, g.feet);
    });
    const kb = g.ball === undefined ? 1 : g.ball;
    return { body: profile.hips, legs: profile.legs.map(function (l) { const bh = ball_heel[l.side]; return { chain: "leg_" + l.side, foot: { ball: round(bh.ball * kb, 4), heel: bh.heel } }; }), gaits: gaits };
  }
  function physics_def(profile, M, by) {
    const H = M.height, hips = by[profile.hips], neck = by[profile.neck[0]], head = by[profile.head], sp = by[profile.spine[0]], hx = by[profile.legs[0].bones[0]].head[0], ankle = by[profile.legs[0].tip];
    const lerp = function (a, b, t) { return a + (b - a) * t; };
    return { mass: Math.max(round(75 * Math.pow(M.scale, 3), 1), 0.1), shapes: [
      { id: "trunk", shape: "capsule", a: [0, round(lerp(hips.head[1], neck.head[1], 0.3), 3), 0], b: [0, round(lerp(hips.head[1], neck.head[1], 0.85), 3), 0], radius: round(0.094 * H, 3), bone: sp.name },
      { id: "head", shape: "sphere", center: [0, round(head.head[1] + 0.5 * len(sub(head.tail, head.head)), 3), round(head.head[2] + 0.015 * H, 3)], radius: round(0.064 * H, 3), bone: profile.head },
      { id: "leg", shape: "capsule", a: [round(hx, 3), round(0.9 * hips.head[1], 3), 0], b: [round(hx, 3), round(ankle.head[1] + 0.12 * H, 3), 0], radius: round(0.047 * H, 3), mirror: "x" }] };
  }
  function face_def(profile, bones) {
    const have = {}; bones.forEach(function (b) { have[b.name] = true; });
    const face = {};
    const eyes = (profile.eyes || []).filter(function (n) { return have[n]; });
    if (eyes.length) face.eyes = eyes.slice();
    const lids = (profile.lids || []).filter(function (l) { return have[l.bone]; });
    if (lids.length) face.lids = lids.map(function (l) { return { bone: l.bone, dir: l.dir }; });
    if (profile.jaw && have[profile.jaw]) face.jaw = { bone: profile.jaw, max: JAW_MAX };
    return Object.keys(face).length ? face : null;
  }
  // ---- SOFT TISSUE (SYSTEM.md "Tissue bones", body.cpp happy_life_soft): the breast and the butt of the skeleton are MASSES ON SPRINGS that gravity and the body's motion move, with numbers made from THIS body (ported from the human
  //   system's soft_def, tuned on a woman's own walk and jog: her breasts travel 17 mm at a walk, 87 at a jog). The more tissue (the weight, the bust, the belly / bottom / thighs sliders, a woman's chest) the more it moves, the firmer or the more
  //   muscular the faster and the less, the heavier the more damped; a child has little of it (it grows from 8 to 16 years) and a giant's is slower (a pendulum of its own size). `generate` asks for the fat that the skeleton has no bone for
  //   (a belly, the flanks, the thighs, the upper arms) as `file.tissue` (pure.js: system.species expands it: a bone placed on THIS body, its skin carved out of the bones round it, soft with the numbers given here).
  //   soft: true | { regions: [kinds] (all six), generate: true | [kinds] (none), gain, stiffness, damping (factors, 1) }          kinds: breast, buttock, belly, flank, thigh, arm
  const SOFT_KINDS = ["breast", "buttock", "belly", "flank", "thigh", "arm"];
  const SOFT_OWN = { breast: ["breast.L", "breast.R"], buttock: ["butt.L", "butt.R"] };                    // (the kinds that the skeleton has bones for)
  const SOFT_TISSUE = { belly: "belly", flank: "flank", thigh: "thigh", arm: "upper_arm" };                // (the kinds of the engine's tissue bones for the fat that it has none for)
  const SOFT_GAIN_K = 0.7, SOFT_REACH_K = 0.49, SOFT_SIZE_REF = 1.7;
  // `soft` as it is given -> what is made of it. A mistake is an Error that says which; given `notes` it is not one: what is none is left out and a factor out of 0 .. 8 is held to the end of it, each said in `notes`
  function soft_clean(s, tag, notes) {
    if (s === undefined || typeof s === "boolean") return s;
    const bad = function (msg) { if (notes) { notes.push(tag + msg); return; } fail(tag + msg); };
    if (s === null) return false;
    if (typeof s !== "object" || Array.isArray(s)) { bad("soft is true, false or { regions, generate, gain, stiffness, damping }"); return s ? true : false; }
    const out = {}, valid = function (k) { return SOFT_KINDS.indexOf(k) >= 0; };
    Object.keys(s).forEach(function (k) {
      const v = s[k];
      if (["regions", "generate", "gain", "stiffness", "damping"].indexOf(k) < 0) { bad("soft: unknown field '" + k + "' (regions, generate, gain, stiffness, damping)"); return; }
      if (k === "regions") {
        if (!Array.isArray(v) || !v.every(valid)) { bad("soft.regions is a list of kinds (" + SOFT_KINDS.join(", ") + ")"); if (Array.isArray(v)) out.regions = v.filter(valid); return; }
        out.regions = v; return;
      }
      if (k === "generate") {
        if (typeof v !== "boolean" && !(Array.isArray(v) && v.every(valid))) { bad("soft.generate is true, false or a list of kinds (" + SOFT_KINDS.join(", ") + ")"); if (Array.isArray(v)) out.generate = v.filter(valid); return; }
        out.generate = v; return;
      }
      if (typeof v !== "number" || !isFinite(v)) { bad("soft." + k + " is a factor, 0 .. 8 (" + v + ")"); return; }
      if (v < 0 || v > 8) { if (!notes) fail(tag + "soft." + k + " is a factor, 0 .. 8 (" + v + ")"); notes.push(tag + "soft." + k + " is a factor, 0 .. 8: " + v + " is held to " + (v < 0 ? 0 : 8)); out[k] = v < 0 ? 0 : 8; return; }
      out[k] = v;
    });
    return out;
  }
  // how far a bone has to move for its vertices to move as far as the numbers say: the more weight its vertices have on it, the less (a breast's top is 0.67, a butt's 0.85: the numbers are for a bone that carries about 0.49 of its vertices)
  function soft_reach(model, bone) {
    if (!model.reach) {
      const top = {};
      for (let i = 0; i < model.nv; i++) for (let q = 0; q < 4; q++) { const w = model.skin_weights[4 * i + q], b = model.skin_indices[4 * i + q]; if (w > (top[b] || 0)) top[b] = w; }
      model.reach = {}; model.bones.forEach(function (b, i) { model.reach[b.name] = top[i] ? clamp(SOFT_REACH_K / (top[i] / 255), 0.5, 1.5) : 1; });
    }
    return model.reach[bone] || 1;
  }
  // the numbers of one soft bone: { stiffness (Hz), damping (the ratio), gain, limit (metres), axis (the weights of the model's x, y, z) } from the body's factors
  //   f: { gender (0 a woman .. 1 a man), weight (0 .. 2, 0.5 the default body), muscle, breast_size, breast_firmness (0 .. 1), age (years), belly, butt, thighs, hips (the sliders) }; height (metres); reach (soft_reach); k: { gain, stiffness, damping }
  function soft_numbers(kind, f, height, reach, k) {
    const woman = 1 - clamp(f.gender, 0, 1), muscle = clamp(f.muscle, 0, 1), size = clamp(f.breast_size, 0, 1), firm = clamp(f.breast_firmness, 0, 1), growth = clamp((f.age - 8) / 8, 0.2, 1);
    const fat = kind === "buttock" ? f.weight + 0.15 * f.butt : kind === "belly" ? f.weight + 0.2 * f.belly : kind === "flank" ? f.weight + 0.1 * f.belly + 0.1 * f.hips : kind === "thigh" ? f.weight + 0.2 * f.thighs : f.weight;   // (a belly slider makes more belly to move)
    const weight = clamp(fat, 0, 2);
    let hz, z, tissue, axis, limit, base;
    if (kind === "breast") {
      tissue = (0.3 + 0.7 * woman) * (0.55 + 0.9 * size) * (0.75 + 0.5 * weight) * growth;
      hz = clamp(3.0 * Math.sqrt((0.5 + firm) / (0.5 + size)), 1.5, 5);
      z = clamp(0.31 + 0.12 * (weight - 0.5) - 0.08 * (firm - 0.5), 0.12, 0.55);
      axis = [0.55, 1, 0.8]; limit = 0.08 * height; base = 1.5;
    } else if (kind === "buttock") {
      tissue = (0.55 + 0.9 * weight) * (1 - 0.45 * muscle) * (1.1 - 0.2 * (1 - woman)) * growth;
      hz = clamp(3.4 * (0.85 + 0.3 * muscle) / (0.8 + 0.4 * weight), 2, 5);
      z = clamp(0.3 + 0.1 * weight, 0.2, 0.55);
      axis = [0.5, 1, 0.7]; limit = 0.06 * height; base = 1.3;
    } else if (kind === "belly") {                                                                         // (nothing on a light body, a lot on a heavy one: slow, and well damped)
      tissue = clamp(1.7 * (weight - 0.25), 0.08, 2) * (1 - 0.4 * muscle) * growth;
      hz = clamp(2.6 - 0.8 * weight + 0.5 * muscle, 1.5, 3.5);
      z = clamp(0.32 + 0.1 * weight, 0.2, 0.55);
      axis = [0.5, 1, 0.9]; limit = 0.07 * height; base = 1.3;
    } else if (kind === "flank") {                                                                         // (the love handles: they swing sideways with the hips more than they bounce)
      tissue = clamp(1.5 * (weight - 0.3), 0.05, 1.8) * (1 - 0.4 * muscle) * growth;
      hz = clamp(2.8 - 0.8 * weight + 0.5 * muscle, 1.5, 3.6);
      z = clamp(0.35 + 0.1 * weight, 0.2, 0.55);
      axis = [0.9, 0.8, 0.5]; limit = 0.05 * height; base = 1.3;
    } else if (kind === "thigh") {
      tissue = (0.25 + 1.1 * weight) * (1 - 0.55 * muscle) * (0.8 + 0.2 * woman) * growth;
      hz = clamp(3.4 - 0.6 * weight + 0.6 * muscle, 2, 4.5);
      z = clamp(0.35 + 0.1 * weight, 0.2, 0.55);
      axis = [0.7, 1, 0.6]; limit = 0.05 * height; base = 1.2;
    } else {                                                                                               // arm: the underside of the upper arm
      tissue = (0.1 + 1.0 * weight) * (1 - 0.6 * muscle) * (0.7 + 0.3 * woman) * growth;
      hz = clamp(3.6 - 0.6 * weight + 0.6 * muscle, 2, 4.5);
      z = clamp(0.35 + 0.1 * weight, 0.2, 0.55);
      axis = [0.5, 1, 0.6]; limit = 0.04 * height; base = 1.0;
    }
    const slow = Math.sqrt(SOFT_SIZE_REF / clamp(height, 0.3, 6));                                         // (a pendulum of its own size: a giant's tissue is slower, a child's quicker)
    return { stiffness: round(clamp(hz * slow * k.stiffness, 0.3, 12), 3), damping: round(clamp(z * k.damping, 0.02, 1), 3), gain: round(clamp(SOFT_GAIN_K * base * tissue * reach * k.gain, 0, 8), 3), limit: round(limit, 4), axis: axis };
  }

  // the shader of the eyes: the uv of an eyeball vertex is its place on the ball (units of the radius) with 10 taken off u on the front and 20 on the back; a u under -5 says "an eye" and the fragment draws the white, an iris of the
  // vertex colour with streaks and a ring, and a pupil (a round iris at any distance, not the polygon of 42 vertices). The skin is the vertex colours: no picture is read
  const SHADER = `
void resolve_shading_attributes(inout Material mat){
	vec3 c = v_color.rgb;
	if (mat.uv.x < -5.0) {
		vec2 e = vec2(mat.uv.x + 10.0, mat.uv.y);
		float rho = length(e), a = atan(e.y, e.x);
		vec3 white = vec3(0.93, 0.92, 0.9) * (1.0 - 0.16 * smoothstep(0.5, 1.0, rho));
		c = white;
		if (mat.uv.x > -15.0) {
			float t = rho / 0.5;
			float streak = 0.78 + 0.22 * sin(a * 19.0 + sin(a * 5.0) * 2.0) * (0.5 + 0.5 * sin(a * 7.0));
			vec3 iris = mix(v_color.rgb * 1.35, v_color.rgb * 0.7, smoothstep(0.25, 1.0, t)) * streak;
			iris = mix(iris, v_color.rgb * 0.35, smoothstep(0.82, 1.0, t));
			c = mix(c, iris, 1.0 - smoothstep(0.94, 1.0, t));
			c = mix(c, vec3(0.015), 1.0 - smoothstep(0.2, 0.25, rho));
		}
	}
	mat.base_color = vec4(c, 1.0);
	super_resolve_shading_attributes(mat);
	happy_material(mat);
}
`;
  // The same shader for a person drawn from a PICTURE (def.skin): the colour of a pixel that is not an eye is what the engine resolved before it (the picture times the vertex colours: white on the skin, the colour of a garment or of hair on those),
  // not the vertex colour alone. The eyes are drawn as above. (The plain person's shader is not changed by it: it is a different text.)
  const SHADER_MAP = SHADER.replace("vec3 c = v_color.rgb;", "vec3 c = mat.base_color.rgb;");
  const GLOSS = { eye: 0.05 };
  function normals_of(P, tris) {                                                                  // the unit normals of the vertices (the sum of the normals of the triangles that meet there: the area is the weight)
    const n = P.length / 3, N = new Float32Array(3 * n);
    for (let t = 0; t < tris.length; t += 3) {
      const a = 3 * tris[t], b = 3 * tris[t + 1], c = 3 * tris[t + 2];
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      N[a] += nx; N[a + 1] += ny; N[a + 2] += nz; N[b] += nx; N[b + 1] += ny; N[b + 2] += nz; N[c] += nx; N[c + 1] += ny; N[c + 2] += nz;
    }
    for (let i = 0; i < n; i++) { const l = Math.sqrt(N[3 * i] * N[3 * i] + N[3 * i + 1] * N[3 * i + 1] + N[3 * i + 2] * N[3 * i + 2]) || 1; N[3 * i] /= l; N[3 * i + 1] /= l; N[3 * i + 2] /= l; }
    return N;
  }
  const DEF_FIELDS = ["model", "shape", "look", "gait", "eyes", "mesh", "bare", "soft", "rig", "mutate", "strict", "clothes", "hair", "brows", "beard", "hide_covered", "skin", "face_warp"];

  // THE DEFINITION, as it is given. The creature is made offline from a script, of WHATEVER it is given: a slider out of its range is held to the end of it, a number that is no number, a slider or a field that does not exist, a look that is none
  // are left out, and every such thing is said in `made.notes` (a list of sentences) while the creature is made. `strict: true` is the old way: the first mistake is an Error that names the creature and says which.
  function build(model, def, who) {
    if (def === undefined || def === null || typeof def !== "object" || Array.isArray(def)) def = {};
    const strict = def.strict === true, notes = strict ? null : [], tag = "creature '" + (who || "human") + "': human_lite: ";
    const bad = function (msg) { if (strict) fail(tag + msg); notes.push(tag + msg); };
    Object.keys(def).forEach(function (k) { if (DEF_FIELDS.indexOf(k) < 0) bad("unknown field '" + k + "' (" + DEF_FIELDS.join(", ") + ")" + (strict ? "" : ": left out")); });
    if (def.rig !== undefined && typeof def.rig !== "boolean") bad("rig is true (the rig of a person, made of whatever the body is: the default) or false (the mesh and the skeleton, no rig, no life)" + (strict ? "" : ": it is true"));
    // MUTATION (def.mutate, human_lite_mutate.js): the dice are thrown `iterations` times (the sliders that drift are in p), the body that is left is made flesh (the pushes, the bones' reshaping, the swellings, the points that follow, the growths)
    const mut = mutate.clean(def.mutate, tag, notes);
    // CLOTHES (def.clothes, human_lite_wear.js) and HAIR (def.hair, def.brows, def.beard, human_lite_hair.js): pieces of the person's own surface, cut and pushed out, skinned like the body
    const wlist = wear.clean(def.clothes, tag, notes), hspec = hair.clean(def, tag, notes);
    // TEXTURED SKIN (def.skin: true or { size, tone, face, layers }, human_lite_skin.js): the body is drawn from ONE picture (the pack's base skin, painted over) instead of the palette's vertex colours. It needs a file with uvs and the skin kit; without them
    // the person is made with the palette and it is said. The body's vertices are WHITE (the picture is the colour) and every vertex that is not the body's skin (an eye has its own shader, a garment, a strand of hair, a horn has its colour) has its uv in the picture's white block.
    let skin_spec = null;
    if (def.skin !== undefined && def.skin !== null && def.skin !== false) {
      if (!skin) bad("skin: this build of the lite human has no skin module" + (strict ? "" : ": the palette is used"));
      else if (!model.uv) bad("skin: the file of the lite human has no uvs" + (strict ? "" : ": the palette is used"));
      else if (!model.skin) bad("skin: the system has no base skin (the pack's human.skin)" + (strict ? "" : ": the palette is used"));
      else skin_spec = skin.clean(def.skin === true ? {} : def.skin, notes ? notes : null, strict);
    }
    if (def.eyes !== undefined && def.eyes !== true && def.eyes !== false && def.eyes !== "face") bad("eyes is true (the eyeballs, drawn by the shader: the default), false (no eyeballs: the sockets stay open) or \"face\" (the eyeballs are drawn from the face's picture: a photo's eyes)" + (strict ? "" : ": it is true"));
    if (def.hide_covered !== undefined && typeof def.hide_covered !== "boolean") bad("hide_covered is true (the default: the skin that the clothes cover is not drawn) or false" + (strict ? "" : ": it is true"));
    let p = params(model, def.shape, who, notes);
    const lk = look.check(def.look, who, notes);
    const plan = mut && (mut.iterations > 0 || mut.genes) ? mutate.evolve(MU_API, model, mut, p) : null;
    if (plan) p = plan.p;
    const sh = shape(model, p);
    // THE FACE WARP (def.face_warp, human_face_shape.js: { amount, t: { cheek: [half width, b] ... } } in the frame of the eyes, what the user's shape markers say): what the face sliders cannot make (they move the head by a few millimetres)
    // is closed by a smooth field over the head's rows, the vertices and the points, the eyes and the ears held; it is solved from the targets, so it composes with whatever the sliders are. It comes before the mutation's flesh.
    let warp_info = null;
    if (def.face_warp !== undefined && def.face_warp !== null && def.face_warp !== false) {
      if (!face_shape) bad("face_warp: this build of the lite human has no face shape module" + (strict ? "" : ": the face is as the sliders make it"));
      else if (!model.skin || !model.skin.fit) bad("face_warp: the system has no shape data (the pack's human.skin: fit)" + (strict ? "" : ": the face is as the sliders make it"));
      else {
        const wn = [], ws = face_shape.warp_clean(def.face_warp, wn); wn.forEach(function (m) { bad(m); });
        if (ws) {
          const w = face_shape.warp({ pt: model.pt, tris: model.tris, fit: model.skin.fit }, sh.rows, ws);
          sh.rows = w.rows; sh.frame = frame_of(model, w.rows); warp_info = { amount: ws.amount, after: round(w.after, 4), moved: round(w.moved, 4), controls: w.controls };
          w.notes.forEach(function (m) { if (notes) notes.push(tag + "face_warp: " + m); });
        }
      }
    }
    const grown = plan ? mutate.express(MU_API, model, sh.rows, plan.genome) : null;
    if (grown) { sh.rows = grown.rows; sh.frame = frame_of(model, grown.rows); }
    let fr = sh.frame; const sc = p.scale, years = age_years(p.age);
    let skin_info = null;
    if (skin_spec) {                                                                                             // (the colour of the palette is linear light, the picture's bytes are sRGB)
      const enc = function (x) { x = clamp(x, 0, 1); return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; };
      const spec = Object.assign({}, skin_spec), layers = (spec.layers || []).slice();
      if (!spec.tone) spec.tone = look.skin(lk, years).map(enc);
      if (def.brows !== false && (def.hair || def.brows || def.beard) && !layers.some(function (l) { return l.kind === "brows"; })) {       // (brows are painted on the skin, in the hair's colour, as the palette's vertices were)
        const bw = def.brows && typeof def.brows === "object" ? def.brows : {}, hc = hair.colour(bw.colour !== undefined ? bw.colour : (def.hair && def.hair.colour !== undefined ? def.hair.colour : "dark_brown"));
        layers.unshift({ kind: "brows", style: bw.style || "straight", thick: bw.thick === undefined ? 0.5 : bw.thick, colour: (hc || [0.2, 0.12, 0.07]).map(enc) });
      }
      spec.layers = layers;
      try {
        const pic = skin.compose(model.skin, spec, { size: spec.size });
        skin_info = { maps: { color: { size: pic.size, data: pic.data } }, spec: spec, report: pic.report || null };
      } catch (e) { bad("skin: the picture could not be made (" + String(e && e.message || e) + ")" + (strict ? "" : ": the palette is used")); skin_spec = null; }
    }
    const point = function (n) { return point_at(model, sh.rows, n); };
    const N = model.nv, pos = new Array(N), cut = {}, tris = [];
    if (grown) grown.cuts.forEach(function (t) { cut[t] = true; });                                           // (the triangles that a growth is extruded from are given up: its rim is the body's own vertices)
    let tri_id = [];                                                                                          // (the number of the file's triangle that each triangle of the body is: the uvs are by the file's corners)
    for (let t = 0; t < model.tris.length; t += 3) if (!cut[t / 3]) { tris.push(model.tris[t], model.tris[t + 1], model.tris[t + 2]); tri_id.push(t / 3); }
    for (let i = 0; i < N; i++) pos[i] = [sh.rows[3 * i], sh.rows[3 * i + 1], sh.rows[3 * i + 2]];
    // what is worn: made of the body as it is now (the model's frame), before the eyes and the growths; the skin that is covered is not drawn
    let worn = [], paint = null, hidden_triangles = 0;
    if (wlist.length || hspec) {
      const Pb = new Float32Array(3 * N); for (let i = 0; i < N; i++) { Pb[3 * i] = pos[i][0]; Pb[3 * i + 1] = pos[i][1]; Pb[3 * i + 2] = pos[i][2]; }
      const wctx = { B: wear.body(model, Pb, Int32Array.from(tris)), A: wear.anchors(model, sh.rows), notes: notes, tag: tag, look: lk, years: years, seed: (mut && mut.seed) || 0, shape: p, sc: sc, headwear: (function () { const h = wlist.filter(function (g) { return wear.HEAD_KINDS.indexOf(g.kind) >= 0; })[0]; return h ? { kind: h.kind } : null; })() };
      if (wlist.length) worn = worn.concat(wear.dress(wctx, wlist));
      if (hspec) { const h = hair.grow(wctx, hspec); worn = worn.concat(h.pieces); paint = h.paint || null; }
      if (def.hide_covered !== false && worn.length) {
        const cov = new Uint8Array(N); worn.forEach(function (pc) { if (pc.cover) for (let i = 0; i < N; i++) if (pc.cover[i]) cov[i] = 1; });
        const keep = [], keep_id = []; for (let t = 0; t < tris.length; t += 3) { if (cov[tris[t]] && cov[tris[t + 1]] && cov[tris[t + 2]]) hidden_triangles++; else { keep.push(tris[t], tris[t + 1], tris[t + 2]); keep_id.push(tri_id[t / 3]); } }
        tris.length = 0; for (let t = 0; t < keep.length; t++) tris.push(keep[t]); tri_id = keep_id;
      }
    }
    // the only piece that is made: an eyeball for each eye (the hands, the feet, the face and the breast are the body's own)
    const made_parts = [], skin_extra = [], eye_uv = {}, eye_pic = {}, kind_of = [], grow_u = {};
    // EYES FROM THE FACE (def.eyes: "face"): the eyeballs stay (the sockets are pockets that they fill, the eye bones turn them) but they are drawn from the face's picture, not by the shader: a photo's face has eyes of its own. Each vertex of a ball takes the
    // texel of the sheet that the skin round that eye has at its place seen from the front: a map (x, y) -> (u, v) fitted to the body's own vertices near the eye (a few outliers, the lids' pockets, are dropped). Without a photo face there is nothing to draw
    // them from: the shader's eyes stay, and it is said.
    let eyes_pic = def.eyes === "face";
    if (eyes_pic && !(skin_info && skin_spec && skin_spec.face && skin_spec.face.image)) { bad("eyes: \"face\" needs a photo face (def.skin.face.image): the eyes are drawn by the shader" + (strict ? "" : "")); eyes_pic = false; }
    const eye_map = function (c, r) {                                                                         // -> function (x, y) -> [u, v] | null
      const U = model.uv, X = [], Q = [];
      for (let ri = 0; ri < U.render; ri++) { const q = pos[U.owner[ri]]; if (Math.abs(q[0] - c[0]) < 3 * r && Math.abs(q[1] - c[1]) < 3 * r && q[2] > c[2] - 0.3 * r) { X.push([q[0], q[1]]); Q.push([U.coords[2 * ri], U.coords[2 * ri + 1]]); } }
      if (X.length < 12) return null;
      let w = X.map(function () { return 1; }), A = null;
      for (let it = 0; it < 4; it++) {
        const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bu = [0, 0, 0], bv = [0, 0, 0];
        for (let k = 0; k < X.length; k++) { if (!w[k]) continue; const f = [X[k][0], X[k][1], 1]; for (let a = 0; a < 3; a++) { for (let b = 0; b < 3; b++) M[a][b] += f[a] * f[b]; bu[a] += f[a] * Q[k][0]; bv[a] += f[a] * Q[k][1]; } }
        const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]); if (Math.abs(det) < 1e-30) return null;
        const solve = function (rhs) { const out = []; for (let col = 0; col < 3; col++) { const T = M.map(function (row, i) { return row.map(function (v, j) { return j === col ? rhs[i] : v; }); }); out.push((T[0][0] * (T[1][1] * T[2][2] - T[1][2] * T[2][1]) - T[0][1] * (T[1][0] * T[2][2] - T[1][2] * T[2][0]) + T[0][2] * (T[1][0] * T[2][1] - T[1][1] * T[2][0])) / det); } return out; };
        A = [solve(bu), solve(bv)];
        const res = X.map(function (x, k) { return Math.hypot(A[0][0] * x[0] + A[0][1] * x[1] + A[0][2] - Q[k][0], A[1][0] * x[0] + A[1][1] * x[1] + A[1][2] - Q[k][1]); });
        const sorted = res.slice().sort(function (a, b) { return a - b; }), lim = Math.max(2.5 * sorted[sorted.length >> 1], 0.0015);
        w = res.map(function (e) { return e <= lim ? 1 : 0; });
        if (w.reduce(function (a, b) { return a + b; }, 0) < 10) return null;
      }
      return function (x, y) { return [A[0][0] * x + A[0][1] * y + A[0][2], A[1][0] * x + A[1][1] * y + A[1][2]]; };
    };
    ["L", "R"].forEach(function (s) {
      if (def.eyes === false) return;
      const c = point("eye." + s + ".head"), r = len(sub(point("eye." + s + ".front"), c)), first = pos.length, e = parts.eye({ s: s, centre: c, radius: r, base: pos.length, bone: "eye." + s });
      e.pos.forEach(function (q) { pos.push(q); kind_of[pos.length - 1] = 2; }); e.tris.forEach(function (x) { tris.push(x); }); e.skin.forEach(function (l) { skin_extra.push(l); });
      e.uv.forEach(function (u, i) { eye_uv[first + i] = u; });
      if (eyes_pic) { const m = eye_map(c, r); if (m) e.pos.forEach(function (q, i) { eye_pic[first + i] = m(q[0], q[1]); }); else bad("eyes: \"face\": the skin round the " + s + " eye has too few vertices to map the picture: that eye is drawn by the shader"); }
      made_parts.push({ kind: "eye", first: first, count: e.pos.length, triangles: e.tris.length / 3 });
    });
    // the growths of a mutation (a tail, horns, tusks, spines): vertices after the eyes', skinned to the bones they name (a tail's own bones come below)
    if (grown) grown.pieces.forEach(function (pc) {
      const first = pos.length;
      pc.pos.forEach(function (q, k) { pos.push(q); kind_of[pos.length - 1] = pc.colour === "horn" ? 3 : 4; grow_u[pos.length - 1] = pc.u[k]; });
      for (let t = 0; t < pc.tris.length; t++) tris.push(pc.tris[t] < 0 ? -1 - pc.tris[t] : pc.tris[t] + first);               // (a number under 0 is a vertex of the body: the rim)
      pc.skin.forEach(function (l) { skin_extra.push(l); });
      made_parts.push({ kind: pc.name, first: first, count: pc.pos.length, triangles: pc.tris.length / 3, rims: pc.rims, removed: pc.cut.length });
    });
    // the worn pieces' vertices (after the eyes and the growths): kind 5, the piece and the vertex of it are looked up by `piece_of`
    const piece_of = [];
    worn.forEach(function (pc) {
      const first = pos.length, n = pc.pos.length / 3;
      for (let k = 0; k < n; k++) { pos.push([pc.pos[3 * k], pc.pos[3 * k + 1], pc.pos[3 * k + 2]]); kind_of[pos.length - 1] = 5; piece_of[pos.length - 1] = pc; }
      pc.first = first;
      for (let t = 0; t < pc.tris.length; t++) tris.push(pc.tris[t] + first);
      made_parts.push({ kind: pc.name, part: pc.part, first: first, count: n, triangles: pc.tris.length / 3 });
    });
    // shoes have soles: the person stands on the lowest of them (the feet's own soles are in the shoes)
    worn.forEach(function (pc) { if (pc.part !== "shoes") return; let lo = fr.ground; for (let k = 1; k < pc.pos.length; k += 3) if (pc.pos[k] < lo) lo = pc.pos[k]; if (lo < fr.ground) fr = { ground: lo, top: fr.top, height: fr.top - lo }; });
    const nv = pos.length, T = function (q) { return [q[0] * sc, (q[1] - fr.ground) * sc, q[2] * sc]; };
    // the skeleton, in metres on the ground (and the person's size)
    const names = model.bones.map(function (b) { return b.name; }), bones = model.bones.map(function (b) { return { name: b.name, parent: b.parent, head: rounded(T(point(b.head)), 5), tail: rounded(T(point(b.tail)), 5) }; });
    const by = {}; bones.forEach(function (b) { by[b.name] = b; });
    if (grown) grown.pieces.forEach(function (pc) { pc.bones.forEach(function (b) { const nb = { name: b.name, parent: b.parent, head: rounded(T(b.head), 5), tail: rounded(T(b.tail), 5) }; bones.push(nb); by[nb.name] = nb; names.push(nb.name); }); });
    worn.forEach(function (pc) { pc.bone_map = []; (pc.bones || []).forEach(function (b, k) { const nb = { name: b.name, parent: b.parent, head: rounded(T(b.head), 5), tail: rounded(T(b.tail), 5) }; if (by[nb.name]) fail("a worn piece brings a bone '" + nb.name + "' that the creature has already"); bones.push(nb); by[nb.name] = nb; names.push(nb.name); pc.bone_map[k] = names.length - 1; }); });
    const profile = PROFILE, torso = profile.spine.slice(), head_path = torso.concat(profile.neck, [profile.head]);
    const clav = ["clavicle.L", "clavicle.R"], arm_paths = profile.arms.map(function (a, i) { return torso.concat([clav[i]], a.bones); }), leg_paths = profile.legs.map(function (l) { return l.bones.concat([l.tip]); });
    const rigged = def.rig !== false;                                                                  // (rig: false: the mesh and the skeleton only: a static creature; the default is a rig for WHATEVER the body is)
    sane_bones(bones, by);
    if (rigged) chain_axes(by, [head_path].concat(arm_paths.map(function (pth, i) { return pth.concat([profile.arms[i].hand]); }), leg_paths), { "clavicle.L": true, "clavicle.R": true });
    const M = measure_of(bones, profile, fr.height * sc);
    // where the sole rolls (the ball, measured from the ankle along the foot, and how far behind it the heel is: metres), from the points of the foot (the heel, the ball, the front of the toes)
    const ball_heel = {};
    profile.legs.forEach(function (l) {
      const s = l.side === "l" ? "L" : "R", ank = point("leg." + s + ".ankle"), bl = point("foot." + s + ".ball"), hl = point("foot." + s + ".heel"), fw = unit([bl[0] - hl[0], 0, bl[2] - hl[2]]);
      const met = dot(sub(bl, ank), fw) * sc, front = dot(sub(point("foot." + s + ".toe"), ank), fw) * sc, heel = -dot(sub(hl, ank), fw) * sc;
      ball_heel[l.side] = { ball: round(Math.max(0.05, met + BALL_SHARE * (front - 0.008 - met)), 4), heel: round(clamp(heel, 0.03, 0.12), 4) };
    });
    // SOFT TISSUE (def.soft; not for a bare body): the bones of the skeleton that are soft say it on their entry (the breast, the butt); the fat that it has no bone for is asked for in `file.tissue`
    const softdef = soft_clean(def.soft, tag, notes), soft = [], tissue = [];
    if (softdef && !def.bare && rigged) {
      const opt = softdef === true ? {} : softdef, want = opt.regions === undefined ? SOFT_KINDS : opt.regions;
      const val = function (n, d) { return p[n] === undefined ? d : p[n]; };
      const f = { gender: p.gender, weight: p.weight, muscle: p.muscle, breast_size: val("bust_size", 0.5), breast_firmness: val("bust_firmness", 0.5), age: years, belly: val("belly", 0), butt: val("butt", 0), thighs: val("thighs", 0), hips: val("hips", 0) };
      const k = { gain: opt.gain === undefined ? 1 : opt.gain, stiffness: opt.stiffness === undefined ? 1 : opt.stiffness, damping: opt.damping === undefined ? 1 : opt.damping };
      let lo3 = [1e9, 1e9, 1e9], hi3 = [-1e9, -1e9, -1e9];
      bones.forEach(function (b) { [b.head, b.tail].forEach(function (q) { for (let c = 0; c < 3; c++) { if (q[c] < lo3[c]) lo3[c] = q[c]; if (q[c] > hi3[c]) hi3[c] = q[c]; } }); });
      const sk_size = Math.max(hi3[0] - lo3[0], hi3[1] - lo3[1], hi3[2] - lo3[2], 0.1);                      // (the engine takes no spring that moves more than the skeleton is big: a limit is at most half of it)
      const own = function (n) { n.limit = round(Math.min(n.limit, 0.5 * sk_size), 4); return { stiffness: n.stiffness, damping: n.damping, gain: n.gain, limit: n.limit, axis: n.axis.slice() }; };
      Object.keys(SOFT_OWN).forEach(function (kind) {
        if (want.indexOf(kind) < 0) return;
        SOFT_OWN[kind].forEach(function (bn) {
          if (!by[bn] || !by[bn].parent) return;
          const n = soft_numbers(kind, f, M.height, soft_reach(model, bn), k);
          by[bn].soft = own(n); soft.push(Object.assign({ bone: bn, kind: kind }, n));
        });
      });
      const asked = opt.generate === true ? ["belly", "flank", "thigh", "arm"] : (Array.isArray(opt.generate) ? opt.generate : []);
      asked.forEach(function (kind) {
        if (!SOFT_TISSUE[kind] || want.indexOf(kind) < 0) return;
        const n = soft_numbers(kind, f, M.height, 1, k);
        tissue.push({ kind: SOFT_TISSUE[kind], soft: own(n) }); soft.push(Object.assign({ bone: null, kind: kind, tissue: SOFT_TISSUE[kind] }, n));
      });
    }
    if (grown && !def.bare && rigged) grown.tissue.forEach(function (t) { tissue.push(Object.assign({ kind: t.kind, at: rounded(T(t.at), 5), dir: rounded(t.dir, 4), radius: round(t.radius * sc, 4) }, t.mirror === false ? { mirror: false } : {})); });          // (a swelling has a soft tissue bone in it: the engine's tissue module places it, there)
    // the mesh: positions, normals (one surface), colours (the palette), the skin weights (4 a vertex), the eyes' uv, the roughness
    const Pw = new Float32Array(3 * nv);
    for (let i = 0; i < nv; i++) { const q = T(pos[i]); Pw[3 * i] = round(q[0], 5); Pw[3 * i + 1] = round(q[1], 5); Pw[3 * i + 2] = round(q[2], 5); }
    const normals = normals_of(Pw, tris);
    const colors = new Float32Array(4 * nv), skin_i = new Uint8Array(4 * nv), skin_w = new Float32Array(4 * nv), uv = new Float32Array(2 * nv), roughness = new Float32Array(nv).fill(-1);
    const body_c = look.paint(model.masks, N, lk, years), flat_c = mutate.tinted(grown ? grown.tint : null, look.skin(lk, years)), index = {}; names.forEach(function (n, i) { index[n] = i; });
    if (grown && grown.tint) for (let i = 0; i < N; i++) { const c = mutate.tinted(grown.tint, [body_c[3 * i], body_c[3 * i + 1], body_c[3 * i + 2]]); body_c[3 * i] = c[0]; body_c[3 * i + 1] = c[1]; body_c[3 * i + 2] = c[2]; }
    if (skin_info) { const wc = grown && grown.tint ? mutate.tinted(grown.tint, [1, 1, 1]) : [1, 1, 1]; for (let i = 0; i < N; i++) { body_c[3 * i] = wc[0]; body_c[3 * i + 1] = wc[1]; body_c[3 * i + 2] = wc[2]; } }
    if (paint && !skin_info) for (let j = 0; j < paint.idx.length; j++) { const i = paint.idx[j], a = paint.a[j]; for (let c = 0; c < 3; c++) body_c[3 * i + c] += (paint.rgb[3 * j + c] - body_c[3 * i + c]) * a; }
    for (let i = 0; i < nv; i++) {
      const k = i < N ? 0 : kind_of[i];
      const wp = k === 5 ? piece_of[i] : null, wj = wp ? i - wp.first : 0;
      const c = i < N ? [body_c[3 * i], body_c[3 * i + 1], body_c[3 * i + 2]] : wp ? [wp.colors[3 * wj], wp.colors[3 * wj + 1], wp.colors[3 * wj + 2]] : k === 2 ? (eye_pic[i] ? [1, 1, 1] : lk.eyes) : k === 3 ? mutate.horn_colour(grow_u[i], flat_c) : flat_c;
      colors[4 * i] = c[0]; colors[4 * i + 1] = c[1]; colors[4 * i + 2] = c[2]; colors[4 * i + 3] = 1;
      if (i < N) { for (let q = 0; q < 4; q++) { skin_i[4 * i + q] = model.skin_indices[4 * i + q]; skin_w[4 * i + q] = model.skin_weights[4 * i + q] / 255; } }
      else if (wp) {
        for (let q = 0; q < 4; q++) { const b = wp.skin_bone[4 * wj + q]; skin_i[4 * i + q] = b >= 0 ? b : wp.bone_map[-1 - b]; skin_w[4 * i + q] = wp.skin_w[4 * wj + q]; }
        roughness[i] = wp.rough;
      }
      else {
        const acc = {}; skin_extra[i - N].forEach(function (e) { const b = index[e[0]]; if (b === undefined) fail("a part is skinned to '" + e[0] + "', which is no bone"); acc[b] = (acc[b] || 0) + e[1]; });
        const list = Object.keys(acc).map(function (b) { return [+b, acc[b]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 4);
        let tot = 0; list.forEach(function (e) { tot += e[1]; });
        list.forEach(function (e, q) { skin_i[4 * i + q] = e[0]; skin_w[4 * i + q] = e[1] / tot; });
      }
      if (k === 2) { const u = eye_pic[i] || eye_uv[i]; uv[2 * i] = u[0]; uv[2 * i + 1] = u[1]; roughness[i] = GLOSS.eye; }
      else if (skin_info && i >= N) { uv[2 * i] = (model.skin.white[0] + 0.5) / model.skin.size; uv[2 * i + 1] = (model.skin.white[1] + 0.5) / model.skin.size; }
    }
    const plist = [{ id: "body" }, { id: "eyes" }], pindex = { body: 0, eyes: 1 };
    if (grown && grown.pieces.length) { pindex.growths = plist.length; plist.push({ id: "growths" }); }
    worn.forEach(function (pc) { if (pindex[pc.part] === undefined) { pindex[pc.part] = plist.length; plist.push({ id: pc.part }); } });
    const pid = new Uint16Array(nv); for (let i = N; i < nv; i++) pid[i] = kind_of[i] === 2 ? 1 : kind_of[i] === 5 ? pindex[piece_of[i].part] : kind_of[i] >= 3 ? pindex.growths : 0;
    let nvt = nv, X = function (a) { return a; }, uv_out = uv;
    if (skin_info) {                                                                                             // (the body's triangles are the first of `tris`: corner c of triangle k is the render vertex corner[3 * tri_id[k] + c] of the file)
      const U = model.uv, got = new Int32Array(N).fill(-1), vert_of = new Int32Array(U.render).fill(-1), first_r = new Int32Array(N).fill(-1), extra = [], extra_r = [];
      for (let r = 0; r < U.render; r++) if (first_r[U.owner[r]] < 0) first_r[U.owner[r]] = r;
      for (let k = 0; k < tri_id.length; k++) for (let c = 0; c < 3; c++) {
        const w = tris[3 * k + c], r = U.corner[3 * tri_id[k] + c];
        if (vert_of[r] < 0) { if (got[w] < 0) { got[w] = r; vert_of[r] = w; } else { vert_of[r] = nv + extra.length; extra.push(w); extra_r.push(r); } }
        tris[3 * k + c] = vert_of[r];
      }
      nvt = nv + extra.length;
      X = function (a, stride) { if (!extra.length) return a; const o = new a.constructor(stride * nvt); o.set(a); extra.forEach(function (w, j) { for (let q = 0; q < stride; q++) o[stride * (nv + j) + q] = a[stride * w + q]; }); return o; };
      uv_out = new Float32Array(2 * nvt); uv_out.set(uv);
      for (let w = 0; w < N; w++) { const r = got[w] >= 0 ? got[w] : first_r[w]; if (r >= 0) { uv_out[2 * w] = U.coords[2 * r]; uv_out[2 * w + 1] = U.coords[2 * r + 1]; } }
      extra_r.forEach(function (r, j) { uv_out[2 * (nv + j)] = U.coords[2 * r]; uv_out[2 * (nv + j) + 1] = U.coords[2 * r + 1]; });
    }
    const mesh = { positions: X(Pw, 3), normals: X(normals, 3), uvs: uv_out, colors: X(colors, 4), indices: nvt < 65536 ? Uint16Array.from(tris) : Uint32Array.from(tris), skin_indices: X(skin_i, 4), skin_weights: X(skin_w, 4), skin_count: 4, roughness: X(roughness, 1), part_ids: X(pid, 1), parts: plist };
    // the definition: the rig (joints and chains), the roles, the legs, the body, the shapes
    const file = { skeleton: bones };
    if (rigged) {
      const chain_list = [{ name: "head", bones: head_path.slice() }];
      profile.arms.forEach(function (a, i) { const side = by[a.bones[0]].head[0] >= 0 ? 1 : -1; chain_list.push({ name: "arm_" + a.side, bones: arm_paths[i].slice(), tip: a.hand, pole: [side * 0.3, -1, -0.3], pole_w: 0.5 }); });
      profile.legs.forEach(function (l) { chain_list.push({ name: "leg_" + l.side, solver: "limb", bones: l.bones.slice(), tip: l.tip, pole: [0, 0, 1], pole_w: 1 }); });
      file.rig = { joints: joints_def(by, profile, { torso: torso, neck: profile.neck.slice(), clav: clav }), chains: chain_list };
    }
    const face = def.bare || !rigged ? null : face_def(profile, bones);
    if (!def.bare && rigged) {
      const roles = { hips: profile.hips, spine: profile.spine.slice(), neck: profile.neck.slice(), head: profile.head, arms: profile.arms.map(function (a) { return { chain: "arm_" + a.side, rest: [0.1, -0.92, 0.04] }; }) };
      if (face) Object.assign(roles, face);
      {                                                                                                // (a tail, a pony tail, long hair are spring chains: the worker swings them; the capsules of the body that they are pushed out of come with them)
        const ch = [];
        if (grown) grown.pieces.forEach(function (pc) { if (pc.chain) ch.push(pc.chain); });
        const seen_chain = {};
        ch.forEach(function (c) { seen_chain[c.bones.join(",")] = true; });
        worn.forEach(function (pc) { (pc.chains || (pc.chain ? [pc.chain] : [])).forEach(function (c) { const k = c.bones.join(","); if (!seen_chain[k]) { seen_chain[k] = true; ch.push(c); } }); });          // (a piece has `chain` or, for long hair that swings in several, `chains`)
        if (ch.length) {
          roles.chains = ch;
          const col = []; worn.forEach(function (pc) { (pc.colliders || []).forEach(function (c) { col.push({ bone: c.bone, a: rounded(T(c.a), 5), b: rounded(T(c.b), 5), r: round(c.r * sc, 4) }); }); });
          if (col.length) roles.chain_colliders = col;
        }
      }
      file.roles = roles; file.traits = {};
      file.legs = legs_def(profile, M, by, def.gait, ball_heel);
      file.body = { accel: round(3 * Math.sqrt(Math.max(M.scale, 1e-3)), 3), gravity: 9.8 };
      file.physics = physics_def(profile, M, by);
      if (tissue.length) file.tissue = tissue;
    }
    if (def.mesh !== false) file.mesh = mesh;
    const mutation = plan ? { seed: mut.seed, iterations: mut.iterations, strength: mut.strength, toward: mut.toward, families: mut.families.slice(), symmetric: mut.symmetric, budget: mut.budget, applied: plan.applied, tags: plan.tags, kind: plan.kind,
      growth: { triangles: grown.pieces.reduce(function (n, pc) { return n + pc.tris.length / 3; }, 0), removed: grown.cuts.length, bones: grown.pieces.reduce(function (n, pc) { return n + pc.bones.length; }, 0), pieces: grown.pieces.map(function (pc) { return pc.name; }) }, tissue: grown.tissue.map(function (t) { return t.kind; }) } : null;
    return { file: file, face: face, soft: soft, mutation: mutation, notes: notes || [], measure: M, skeleton: { bones: bones }, skin: skin_info, face_warp: warp_info, vertices: nvt, triangles: tris.length / 3, body_triangles: model.tris.length / 3, hidden_triangles: hidden_triangles, worn: worn.map(function (pc) { return { name: pc.name, part: pc.part, vertices: pc.pos.length / 3, triangles: pc.tris.length / 3 }; }), ball_heel: ball_heel, parts: made_parts, shape: p, look: lk, frame: fr, barefoot: round(sh.frame.height * sc, 4), years: years, dynamic: null };
  }
  const point_at = point;
  const MU_API = { point: point, points_follow: points_follow, slider_list: slider_list };                // (what the mutation module takes of the lite human)

  return { parse: parse, load: load, inflate: inflate, defaults: defaults, params: params, slider_list: slider_list, shape: shape, point: point, frame_of: frame_of, age_years: age_years, age_value: age_value,
    MACRO_NAMES: MACRO_NAMES, RACE_NAMES: RACE_NAMES, tents: tents, build: build, SHADER: SHADER, PROFILE: PROFILE, SOFT_KINDS: SOFT_KINDS, soft_numbers: soft_numbers, soft_reach: soft_reach,
    points_follow: points_follow, add_slider: add_slider, MUTATE: mutate, SHADER_MAP: SHADER_MAP };
});
