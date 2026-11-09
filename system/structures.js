packing()("happy_structures", function happy_structures() {
  "use strict";
  // THE STRUCTURES: what an environment's elements are made of. An element is a RECIPE with numbers (a rock, a tree, a house, a wall, a bunker, a tower ...), written as the parts of an sdf in the mesher's grammar,
  // and the system makes ONE static mesh of it (system.species(def, { static: true }), item frame: the origin on the floor under the middle of the piece, +z the front, y up) and an instance for every element that stands in the world.
  // Pure: no engine, no DOM: node tests it, the elements runtime (environment's page) and the editor use it. Node 14 and the bundler's parser: no optional chaining, no ??, no class.
  //
  //   RECIPES[name] -> { title, group, params: { name: [default, min, max, whole?] }, colors: { name: [r, g, b] }, make(p) -> { cell, parts } }      NAMES: the recipes in the order a palette shows them      GROUPS: [[id, title, [name]]]
  //   recipe_params(name, given) -> { params, problems }     the numbers of a recipe: what is given, else the default (a number out of its range, or one the recipe does not have, is a problem: text)
  //   sdf_of(name, given) -> the sdf the recipe makes      species_def(name, sdf, max) -> what system.species takes      bounds(sdf) -> { lo, hi }: the box round the parts (item frame, the parts that cut are left out)
  //   key_of(type, p) -> "rock" | "rock{radius:2}": the same text for the same numbers (what a species is kept under)
  //   reach(type, p) -> metres      how far the piece reaches from its origin over the ground (the circle that holds its footprint, before `scale`): what a location counts an element's extent by (kept by key_of: made once)
  //   element(o) -> { id, type, x, z, yaw, scale, dy, pitch, roll, p }      check_element(e) -> "" | the problem
  //   add_group(id, title, recipes) -> the names      More recipes can come from another file that calls add_group (a group of the palette and its recipes); `RECIPES`, `GROUPS` and `NAMES` hold them all (none is added now).
  //   helpers { box, cyl_up, tint, shade, color, r3, rgb, FOUND, SINK, colors: { CONCRETE, DARK, WOOD, SAND, STONE, STONE_D, MOSS, ASPHALT, BARK, LEAF, PINE, PLASTER, TILE, GLASS, DOOR } }      what a recipe is written with
  //   tilt(gy, x, z, yaw, length, width) -> { pitch, roll }      the slope of the ground under a piece that is `length` long (along its +z) and `width` wide (along its +x), at x, z, turned `yaw` degrees: the numbers that lay it on the ground (gy(x, z) -> metres)
  // An ELEMENT of a world's locations (`locations[].elements`): { id: "e12", type: "rock", x, z (metres from the middle of the land), yaw (degrees, about up), scale (1), dy (metres over the ground, 0), pitch, roll (degrees, 0: a piece that is
  // laid on a slope; pitch lifts its +z end, roll its +x side; they turn about the piece's own origin, after the yaw), p: { radius: 2, color: [r, g, b] } }. The ground's height
  // is not kept: an element stands on whatever the terrain is, `sink` below it (the piece reaches a metre under its origin: no gap shows on a slope).
  const FOUND = 1, SINK = 0.15, BONE = "root";
  const CONCRETE = [0.55, 0.55, 0.52, 1], DARK = [0.38, 0.38, 0.36, 1], WOOD = [0.45, 0.33, 0.22, 1], SAND = [0.68, 0.6, 0.42, 1], STONE = [0.5, 0.48, 0.45, 1], STONE_D = [0.4, 0.39, 0.38, 1], MOSS = [0.33, 0.43, 0.27, 1];
  const ASPHALT = [0.12, 0.12, 0.13, 1], BARK = [0.32, 0.22, 0.15, 1], LEAF = [0.2, 0.4, 0.15, 1], PINE = [0.12, 0.3, 0.16, 1], PLASTER = [0.8, 0.74, 0.62, 1], TILE = [0.55, 0.27, 0.2, 1], GLASS = [0.35, 0.5, 0.6, 1], DOOR = [0.34, 0.22, 0.14, 1];
  const r3 = function (x) { return Math.round(x * 1000) / 1000; };
  const rgb = function (c) { return [c[0], c[1], c[2]]; };
  const color = function (p, dflt) { return Array.isArray(p.color) && p.color.length >= 3 ? [p.color[0], p.color[1], p.color[2], p.color[3] === undefined ? 1 : p.color[3]] : dflt; };
  // a colour a recipe takes by name (`color`, `roof_color`, `leaf_color` ...: [r, g, b] or [r, g, b, a]), else the default; shade: the same colour lighter or darker
  const tint = function (p, key, dflt) { const v = p[key]; return Array.isArray(v) && v.length >= 3 ? [v[0], v[1], v[2], v[3] === undefined ? 1 : v[3]] : dflt; };
  const shade = function (c, k) { return [r3(Math.min(1, c[0] * k)), r3(Math.min(1, c[1] * k)), r3(Math.min(1, c[2] * k)), c[3] === undefined ? 1 : c[3]]; };
  const cyl_up = function (id, c, radius, half, col, extra) { const o = { id: id, shape: "cylinder", center: c.map(r3), axis: "y", radius: r3(radius), half: r3(half), color: col }; if (extra) for (const k in extra) o[k] = extra[k]; return o; };
  const box = function (id, c, h, col, extra) { const o = { id: id, shape: "box", center: c.map(r3), half: h.map(r3), color: col }; if (extra) for (const k in extra) o[k] = extra[k]; return o; };

  // ---- the recipes: numbers in, the parts out. `params`: name -> [default, min, max]; `colors`: the colours the recipe has, with their defaults (a colour is only a number of the recipe when it is given)
  const RECIPES = {
    rock: { title: "Boulder", group: "nature", params: { radius: [1.4, 0.3, 8], height: [1.4, 0.2, 8] }, colors: { color: rgb(STONE) },
      make: function (p) {
        const r = p.radius, h = p.height, a = color(p, STONE), b = [Math.max(0, a[0] - 0.1), Math.max(0, a[1] - 0.1), Math.max(0, a[2] - 0.1), 1];
        return { cell: Math.max(0.04, Math.min(0.2, r / 12)), parts: [
          { id: "main", shape: "ellipsoid", center: [0, r3(0.5 * h - 0.2), 0], radii: [r3(r), r3(0.62 * h), r3(0.85 * r)], color: a, collide: "slices", slices: 4 },
          { id: "bump_a", shape: "ellipsoid", center: [r3(-0.5 * r), r3(0.35 * h - 0.2), r3(-0.3 * r)], radii: [r3(0.6 * r), r3(0.55 * h), r3(0.55 * r)], color: b, blend: 0.1, collide: "slices", slices: 3 },
          { id: "bump_b", shape: "ellipsoid", center: [r3(0.55 * r), r3(0.32 * h - 0.2), r3(0.15 * r)], radii: [r3(0.5 * r), r3(0.5 * h), r3(0.5 * r)], color: a, blend: 0.1, collide: "slices", slices: 3 },
          { id: "moss", shape: "ellipsoid", center: [r3(0.5 * r), r3(0.1 * h - 0.2), r3(-0.45 * r)], radii: [r3(0.3 * r), r3(0.12 * h), r3(0.22 * r)], color: MOSS, blend: 0.03, collide: false }] };
      } },
    tree: { title: "Broad tree", group: "nature", params: { height: [6.5, 2, 20], crown: [2.6, 0.8, 8] }, colors: { leaf_color: rgb(LEAF), bark_color: rgb(BARK) },
      make: function (p) {
        const Ht = p.height, Rc = p.crown, th = Math.max(0.8, Ht - 1.4 * Rc), leaf = tint(p, "leaf_color", LEAF), bark = tint(p, "bark_color", BARK), tr = Math.max(0.1, 0.045 * Ht), cy = th + 0.55 * Rc, parts = [];
        parts.push(cyl_up("trunk", [0, (th - FOUND) / 2, 0], tr, (th + FOUND) / 2, bark));
        parts.push({ id: "crown", shape: "ellipsoid", center: [0, r3(cy), 0], radii: [r3(Rc), r3(0.85 * Rc), r3(Rc)], color: leaf, collide: false });
        [[0.55, 0.1, 0.2, 1.08], [-0.5, 0.2, -0.3, 0.92], [0.1, 0.4, -0.5, 1.0], [-0.2, 0.3, 0.5, 0.96]].forEach(function (l, i) {
          parts.push({ id: "lump" + i, shape: "sphere", center: [r3(l[0] * Rc), r3(cy + l[1] * Rc), r3(l[2] * Rc)], radius: r3(0.62 * Rc), color: shade(leaf, l[3]), blend: r3(0.3 * Rc), collide: false });
        });
        return { cell: r3(Math.max(0.06, Math.min(0.16, Rc / 16))), parts: parts };
      } },
    pine: { title: "Pine", group: "nature", params: { height: [10, 3, 30], radius: [2.4, 0.8, 8] }, colors: { leaf_color: rgb(PINE), bark_color: rgb(BARK) },
      make: function (p) {
        const Ht = p.height, R = p.radius, th = 0.22 * Ht, tr = Math.max(0.1, 0.035 * Ht), col = tint(p, "leaf_color", PINE), bark = tint(p, "bark_color", BARK), parts = [];
        parts.push(cyl_up("trunk", [0, (0.55 * Ht - FOUND) / 2, 0], tr, (0.55 * Ht + FOUND) / 2, bark));
        for (let i = 0; i < 4; i++) {
          const y0 = th + i * (Ht - th) * 0.24, y1 = Math.min(Ht, y0 + (Ht - th) * 0.42), r = R * (1 - 0.2 * i);
          parts.push({ id: "cone" + i, shape: "loft", points: [[0, r3(y0), 0], [0, r3(y1), 0]], radii: [r3(r), 0.05], radii_v: [r3(r), 0.05], color: shade(col, 1 + 0.06 * i), collide: false });
        }
        return { cell: r3(Math.max(0.06, Math.min(0.15, R / 16))), parts: parts };
      } },
    // a house of the plain kind: a box with a doorway and windows cut into it (the cuts and what fills them are a look only: the collision is the one box), a hip roof and a chimney. The front is +z.
    house: { title: "House", group: "buildings", params: { width: [8, 3, 30], depth: [6, 3, 30], height: [3, 2.4, 12], roof: [1.8, 0.4, 8] }, colors: { color: rgb(PLASTER), roof_color: rgb(TILE) },
      make: function (p) {
        const W = p.width, D = p.depth, H = p.height, RH = p.roof, wall = tint(p, "color", PLASTER), roof = tint(p, "roof_color", TILE), parts = [];
        const hole = function (id, c, h) { parts.push(box(id + "_cut", c, h, wall, { op: "subtract", collide: false })); };
        const wy = Math.min(1.5, H * 0.55), dx = W > 6 ? -0.18 * W : 0;
        parts.push(box("body", [0, (H - FOUND) / 2, 0], [W / 2, (H + FOUND) / 2, D / 2], wall, { round: 0.03 }));
        hole("door", [dx, 1.05, D / 2], [0.55, 1.05, 0.3]);
        if (W >= 5) hole("win_f", [0.27 * W, wy, D / 2], [0.5, 0.45, 0.22]);
        if (D >= 4) { hole("win_l", [W / 2, wy, 0], [0.22, 0.45, 0.5]); hole("win_r", [-W / 2, wy, 0], [0.22, 0.45, 0.5]); }
        parts.push(box("door", [dx, 0.98, D / 2 - 0.2], [0.5, 0.93, 0.06], DOOR, { collide: false }));
        parts.push(box("step", [dx, 0.07, D / 2 + 0.4], [0.8, 0.08, 0.4], CONCRETE, { collide: false }));
        if (W >= 5) parts.push(box("glass_f", [0.27 * W, wy, D / 2 - 0.12], [0.44, 0.39, 0.06], GLASS, { collide: false }));
        if (D >= 4) { parts.push(box("glass_l", [W / 2 - 0.12, wy, 0], [0.06, 0.39, 0.44], GLASS, { collide: false })); parts.push(box("glass_r", [-W / 2 + 0.12, wy, 0], [0.06, 0.39, 0.44], GLASS, { collide: false })); }
        // (a roof is a loft with a squircle section, which cuts the corners of a rectangle: wide enough, 1.2 of the half sizes, that its corners clear the walls', and it starts a little below their top)
        parts.push({ id: "roof", shape: "loft", points: [[0, r3(H - 0.15), 0], [0, r3(H + RH), 0]], radii: [r3(W / 2 * 1.2 + 0.25), 0.07], radii_v: [r3(D / 2 * 1.2 + 0.25), 0.07], square: 1, color: roof, collide: false });
        parts.push(box("chimney", [r3(W * 0.22), r3(H + RH * 0.5), r3(-D * 0.18)], [0.28, r3(RH * 0.5 + 0.4), 0.28], STONE_D, { collide: false }));
        return { cell: 0.1, decimate: { ratio: 0.04, error: 0.04, max_edge: 2 }, parts: parts };                    // (a house is flat faces: a grid of 10 cm and a decimation that keeps its edges, a few thousand triangles and not ten)
      } },
    // a plain box: a whole building of a city (a width, a depth and a height, one colour). Its origin is on the floor under the middle, it reaches FOUND under it, the front is +z. Flat faces: the grid follows the size (64 cells across the
    // biggest side). The faces are flat and `decimate` (the native mesher's) keeps their edges; the CPU mesher does not decimate: it makes about 750 triangles for a box of 4 m and 3,100 for 24 m (a mesh of the box itself would be 12).
    box: { title: "Box", group: "buildings", params: { width: [8, 1, 80], depth: [6, 1, 80], height: [3, 1, 120] }, colors: { color: rgb(PLASTER) },
      make: function (p) {
        const W = p.width, D = p.depth, H = p.height, c = tint(p, "color", PLASTER), big = Math.max(W, D, H);
        return { cell: r3(Math.max(0.1, big / 64)), decimate: { ratio: 0.04, error: 0.04, max_edge: r3(Math.max(2, big)) }, parts: [box("body", [0, (H - FOUND) / 2, 0], [W / 2, (H + FOUND) / 2, D / 2], c)] };
      } },
    tower: { title: "Observation tower", group: "buildings", params: { width: [3, 1.5, 12], height: [7, 2, 30] }, colors: { color: rgb(WOOD) },
      make: function (p) {
        const W = p.width, H = p.height, c = color(p, WOOD), leg = 0.18, off = W / 2 - leg, parts = [];
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s, i) { parts.push(box("leg" + i, [s[0] * off, (H - FOUND) / 2, s[1] * off], [leg, (H + FOUND) / 2, leg], c)); });
        parts.push(box("deck", [0, H, 0], [W / 2 + 0.2, 0.12, W / 2 + 0.2], DARK));
        parts.push(box("rail_n", [0, H + 0.55, -W / 2], [W / 2, 0.45, 0.05], c, { collide: false }), box("rail_s", [0, H + 0.55, W / 2], [W / 2, 0.45, 0.05], c, { collide: false }), box("rail_w", [-W / 2, H + 0.55, 0], [0.05, 0.45, W / 2], c, { collide: false }), box("rail_e", [W / 2, H + 0.55, 0], [0.05, 0.45, W / 2], c, { collide: false }));
        return { cell: 0.1, parts: parts };
      } },
    bunker: { title: "Bunker (open to the front, +z)", group: "buildings", params: { width: [6, 2, 30], depth: [5, 2, 30], height: [2.2, 1.2, 8], wall: [0.5, 0.2, 2] }, colors: { color: rgb(CONCRETE) },
      make: function (p) {
        const W = p.width, D = p.depth, H = p.height, T = p.wall, c = color(p, CONCRETE), d = DARK;
        return { cell: 0.12, parts: [
          box("back", [0, (H - FOUND) / 2, -D / 2 + T / 2], [W / 2, (H + FOUND) / 2, T / 2], c),
          box("left", [-W / 2 + T / 2, (H - FOUND) / 2, 0], [T / 2, (H + FOUND) / 2, D / 2], c),
          box("right", [W / 2 - T / 2, (H - FOUND) / 2, 0], [T / 2, (H + FOUND) / 2, D / 2], c),
          box("roof", [0, H + T / 2, 0], [W / 2 + 0.15, T / 2, D / 2 + 0.15], d),
          box("floor", [0, -FOUND / 2 + 0.05, 0], [W / 2 - T, FOUND / 2, D / 2 - T / 2], d, { collide: false })] };
      } },
    pillar: { title: "Pillar", group: "buildings", params: { width: [0.8, 0.2, 5], height: [3, 0.5, 20] }, colors: { color: rgb(CONCRETE) },
      make: function (p) { const W = p.width, H = p.height; return { cell: 0.08, parts: [box("pillar", [0, (H - FOUND) / 2, 0], [W / 2, (H + FOUND) / 2, W / 2], color(p, CONCRETE))] }; } },
    wall: { title: "Wall", group: "barriers", params: { length: [8, 1, 60], height: [2.5, 0.5, 10], thick: [0.6, 0.1, 4] }, colors: { color: rgb(CONCRETE) },
      make: function (p) { const L = p.length, H = p.height, T = p.thick; return { cell: r3(Math.max(0.08, Math.min(0.25, T / 3))), parts: [box("wall", [0, (H - FOUND) / 2, 0], [L / 2, (H + FOUND) / 2, T / 2], color(p, CONCRETE))] }; } },
    sandbags: { title: "Bank of sandbags", group: "barriers", params: { length: [5, 1, 30], height: [1, 0.3, 2.5], thick: [0.9, 0.3, 2] }, colors: { color: rgb(SAND) },
      make: function (p) { const L = p.length, H = p.height, T = p.thick; return { cell: 0.08, parts: [box("bank", [0, (H - FOUND) / 2, 0], [L / 2, (H + FOUND) / 2, T / 2], color(p, SAND), { round: Math.min(0.2, H / 3) })] }; } },
    tank_trap: { title: "Tank trap", group: "barriers", params: { size: [1.8, 0.8, 5] }, colors: { color: rgb(DARK) },
      make: function (p) {
        const h = p.size / 2, r = Math.max(0.06, p.size * 0.07), c = color(p, DARK), cyl = function (id, axis) { return { id: id, shape: "cylinder", center: [0, r3(h * 0.7), 0], axis: axis, radius: r3(r), half: r3(h), color: c, collide: "cut" }; };
        return { cell: 0.06, parts: [cyl("a", [1, 1, 0]), cyl("b", [1, -1, 0]), cyl("c", [0, 1, 1]), box("foot", [0, -FOUND / 2, 0], [h * 0.4, FOUND / 2, h * 0.4], c, { collide: false })] };
      } },
    // a bridge: a deck on a span between two banks, a parapet along each side, piers down to the bed of what it crosses and a cap on each pier. It runs along z (`length`), `width` across; the TOP of the deck is 5 cm over the origin's height,
    // so the origin stands at the level of the two banks (`dy` lifts it) and the deck lies flush with the ground at both ends, where it is sunk into it.
    bridge: { title: "Bridge", group: "infrastructure", params: { length: [28, 6, 120], width: [8, 3, 30], depth: [10, 1, 60], thick: [0.8, 0.3, 3], rail: [1.1, 0.5, 2.5], piers: [2, 0, 6, true] }, colors: { color: rgb(CONCRETE) },
      make: function (p) {
        const L = p.length, W = p.width, D = p.depth, T = p.thick, Hr = p.rail, n = Math.round(p.piers), top = 0.05, conc = tint(p, "color", CONCRETE), pale = shade(conc, 1.12), dark = shade(conc, 0.82), parts = [];
        parts.push(box("deck", [0, top - T / 2, 0], [W / 2, T / 2, L / 2], conc));
        parts.push(box("road", [0, top + 0.015, 0], [W / 2 - 0.5, 0.02, L / 2], ASPHALT, { collide: false }));
        [-1, 1].forEach(function (s, i) { parts.push(box("rail" + i, [s * (W / 2 - 0.2), top + Hr / 2, 0], [0.2, Hr / 2, L / 2 - 0.15], pale)); });
        for (let k = 0; k < n; k++) {
          const z = (k + 1) / (n + 1) * L - L / 2;
          parts.push(cyl_up("pier" + k, [0, (top - T - D) / 2, z], Math.min(0.9, W * 0.11), (D + T - top) / 2, dark, { collide: false }));
          parts.push(box("cap" + k, [0, top - T - 0.3, z], [W / 2 - 0.6, 0.3, 0.95], dark, { collide: false }));
        }
        return { cell: 0.15, decimate: { ratio: 0.05, error: 0.04, max_edge: 3 }, parts: parts };
      } }
  };
  const GROUPS = [["nature", "Nature", ["rock", "tree", "pine"]], ["buildings", "Buildings", ["box", "house", "tower", "bunker", "pillar"]], ["barriers", "Walls and barriers", ["wall", "sandbags", "tank_trap"]], ["infrastructure", "Infrastructure", ["bridge"]]];
  const NAMES = GROUPS.reduce(function (a, g) { return a.concat(g[2]); }, []);

  // the numbers of a recipe: what is given, else the default; a number outside the range is a problem (returned as text), and so is a name the recipe does not have
  function recipe_params(name, given) {
    const R = RECIPES[name], out = {}, bad = [];
    if (!R) return { params: out, problems: ["`" + name + "` is not a recipe (" + NAMES.join(", ") + ")"] };
    Object.keys(R.params).forEach(function (k) { out[k] = R.params[k][0]; });
    Object.keys(given || {}).forEach(function (k) {
      if (R.colors[k] !== undefined) { if (!Array.isArray(given[k]) || given[k].length < 3 || !given[k].slice(0, 3).every(function (v) { return typeof v === "number" && v >= 0 && v <= 1; })) bad.push(k + " is [r, g, b] in 0 .. 1"); else out[k] = given[k]; return; }
      const lim = R.params[k];
      if (!lim) { bad.push("`" + k + "` is not a number of the recipe `" + name + "` (" + Object.keys(R.params).concat(Object.keys(R.colors)).join(", ") + ")"); return; }
      if (!(typeof given[k] === "number" && given[k] >= lim[1] && given[k] <= lim[2])) { bad.push(k + " is " + lim[1] + " .. " + lim[2]); return; }
      out[k] = given[k];
    });
    return { params: out, problems: bad };
  }
  function sdf_of(name, given) {
    const r = recipe_params(name, given);
    if (r.problems.length) throw new Error("structures: " + name + ": " + r.problems.join("; "));
    return RECIPES[name].make(r.params);
  }
  // the mesher's def of an item: every part on the item's one bone, the collision hints taken out, a cell and a decimation of its own when the recipe says none
  function render_def(sdf) {
    const d = JSON.parse(JSON.stringify(sdf));
    d.parts.forEach(function (p) { if (p.bone === undefined) p.bone = BONE; delete p.collide; delete p.slices; });
    if (d.cell === undefined) d.cell = 0.03;
    if (d.decimate === undefined && d.adaptive === undefined) d.decimate = { ratio: 0.1, error: d.cell * 0.3, max_edge: 1.0 };
    return d;
  }
  function species_def(name, sdf, max) {
    return { name: "item_" + name, max_instances: Math.max(1, max | 0), skeleton: [{ name: BONE, head: [0, 0, 0], tail: [0, 0.1, 0] }], sdf: render_def(sdf) };
  }
  // the box round the parts that add (item frame): { lo: [x, y, z], hi: [x, y, z] }; a part it does not know the shape of is left out
  function bounds(sdf) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const add = function (c, e) { for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], c[i] - e[i]); hi[i] = Math.max(hi[i], c[i] + e[i]); } };
    sdf.parts.forEach(function (p) {
      if (p.op === "subtract" || p.op === "intersect") return;
      const c = p.center || [0, 0, 0];
      if (p.shape === "box") add(c, p.half);
      else if (p.shape === "ellipsoid") add(c, p.radii);
      else if (p.shape === "sphere") add(c, [p.radius, p.radius, p.radius]);
      else if (p.shape === "cylinder") {
        const a = p.axis === "x" ? [1, 0, 0] : p.axis === "z" ? [0, 0, 1] : Array.isArray(p.axis) ? p.axis : [0, 1, 0], n = Math.hypot(a[0], a[1], a[2]) || 1;
        const u = [a[0] / n, a[1] / n, a[2] / n];                                                      // (the reach along an axis of the world: half the length along it, and the radius of the round, which reaches sqrt(1 - u^2) of itself that way: a disc is flat)
        add(c, [Math.abs(u[0]) * p.half + p.radius * Math.sqrt(Math.max(0, 1 - u[0] * u[0])), Math.abs(u[1]) * p.half + p.radius * Math.sqrt(Math.max(0, 1 - u[1] * u[1])), Math.abs(u[2]) * p.half + p.radius * Math.sqrt(Math.max(0, 1 - u[2] * u[2]))]);
      } else if (p.shape === "loft" && Array.isArray(p.points)) {
        const r = Math.max.apply(null, (p.radii || [0]).concat(p.radii_v || [0]));
        p.points.forEach(function (q) { add(q, [r, r, r]); });
      }
    });
    if (!isFinite(lo[0])) return { lo: [-0.5, 0, -0.5], hi: [0.5, 1, 0.5] };
    return { lo: lo.map(r3), hi: hi.map(r3) };
  }
  // what a species is kept under: the type and the numbers that are given (sorted: the same numbers give the same text)
  function key_of(type, p) {
    const ks = Object.keys(p || {}).sort();
    return ks.length ? type + "{" + ks.map(function (k) { return k + ":" + JSON.stringify(p[k]); }).join(",") + "}" : type;
  }

  // how far a piece reaches from its origin on the ground: the circle that holds its footprint (made once for each type and numbers; a recipe that cannot be made is 3 m)
  let reach_cache = {}, reach_n = 0;
  function reach(type, p) {
    const key = key_of(type, p);
    if (reach_cache[key] !== undefined) return reach_cache[key];
    let r = 3;
    try { const b = bounds(sdf_of(type, p)); r = Math.hypot(Math.max(Math.abs(b.lo[0]), Math.abs(b.hi[0])), Math.max(Math.abs(b.lo[2]), Math.abs(b.hi[2]))); } catch (e) { /* the recipe says why when it is shown */ }
    if (++reach_n > 4000) { reach_cache = {}; reach_n = 0; }
    return (reach_cache[key] = r3(r));
  }

  // ---- an element of a document
  const finite = function (v) { return typeof v === "number" && isFinite(v); };
  function element(o) {
    if (!o || typeof o.type !== "string") throw new Error("structures: an element has a type (" + NAMES.join(", ") + ")");
    const e = { id: o.id, type: o.type, x: o.x || 0, z: o.z || 0, yaw: o.yaw || 0, scale: o.scale === undefined ? 1 : o.scale, dy: o.dy || 0 };
    if (o.pitch) e.pitch = o.pitch;
    if (o.roll) e.roll = o.roll;
    if (o.p && Object.keys(o.p).length) e.p = JSON.parse(JSON.stringify(o.p));
    return e;
  }
  function check_element(e) {
    if (!e || typeof e !== "object") return "an element is an object { id, type, x, z, yaw, scale, dy, p }";
    if (typeof e.id !== "string" || !e.id) return "an element has an id (a text)";
    if (!RECIPES[e.type]) return "`" + e.type + "` is not a type of element (" + NAMES.join(", ") + ")";
    if (!finite(e.x) || !finite(e.z)) return "x and z are metres from the middle of the land";
    if (e.yaw !== undefined && !finite(e.yaw)) return "yaw is degrees";
    if (e.scale !== undefined && !(finite(e.scale) && e.scale >= 0.05 && e.scale <= 50)) return "scale is 0.05 .. 50";
    if (e.dy !== undefined && !(finite(e.dy) && Math.abs(e.dy) <= 10000)) return "dy is metres over the ground";
    if (e.pitch !== undefined && !(finite(e.pitch) && Math.abs(e.pitch) <= 89)) return "pitch is degrees, -89 .. 89";
    if (e.roll !== undefined && !(finite(e.roll) && Math.abs(e.roll) <= 89)) return "roll is degrees, -89 .. 89";
    if (e.p !== undefined) { if (!e.p || typeof e.p !== "object") return "p is { number: value }"; const r = recipe_params(e.type, e.p); if (r.problems.length) return r.problems.join("; "); }
    return "";
  }

  // ---- more recipes from other files, in groups of the palette (none now)
  function add_group(id, title, recipes) {
    if (typeof id !== "string" || !id || typeof title !== "string" || !recipes || typeof recipes !== "object") throw new Error("structures: add_group(id, title, { name: recipe })");
    const names = Object.keys(recipes);
    names.forEach(function (n) {                                                                     // (all of them are looked at before any is added: a group is added whole or not at all)
      const R = recipes[n];
      if (RECIPES[n]) throw new Error("structures: the recipe `" + n + "` is already there (group `" + id + "`: a name is the one recipe's in the whole palette, whatever file it came from)");
      if (!R || typeof R.make !== "function" || !R.params || !R.colors || typeof R.title !== "string") throw new Error("structures: the recipe `" + n + "` is { title, group, params: { name: [default, min, max] }, colors: { name: [r, g, b] }, make(p) }");
    });
    names.forEach(function (n) { recipes[n].group = id; RECIPES[n] = recipes[n]; });
    let g = null; GROUPS.forEach(function (x) { if (x[0] === id) g = x; });
    if (g) names.forEach(function (n) { g[2].push(n); }); else GROUPS.push([id, title, names.slice()]);
    names.forEach(function (n) { NAMES.push(n); });
    return names;
  }
  // the slope of the ground under a piece: its pitch lifts the +z end, its roll the +x side (the piece is turned `yaw` degrees about up: its +z is (sin yaw, cos yaw), its +x is (cos yaw, -sin yaw))
  function tilt(gy, x, z, yaw, length, width) {
    const a = yaw * Math.PI / 180, s = Math.sin(a), c = Math.cos(a), hl = length / 2, hw = width / 2;
    const dz = (gy(x + s * hl, z + c * hl) - gy(x - s * hl, z - c * hl)) / Math.max(1e-6, length), dx = (gy(x + c * hw, z - s * hw) - gy(x - c * hw, z + s * hw)) / Math.max(1e-6, width);
    return { pitch: r3(Math.atan(dz) * 180 / Math.PI), roll: r3(Math.atan(dx) * 180 / Math.PI) };
  }
  const helpers = { box: box, cyl_up: cyl_up, tint: tint, shade: shade, color: color, r3: r3, rgb: rgb, FOUND: FOUND, SINK: SINK,
    colors: { CONCRETE: CONCRETE, DARK: DARK, WOOD: WOOD, SAND: SAND, STONE: STONE, STONE_D: STONE_D, MOSS: MOSS, ASPHALT: ASPHALT, BARK: BARK, LEAF: LEAF, PINE: PINE, PLASTER: PLASTER, TILE: TILE, GLASS: GLASS, DOOR: DOOR } };

  return { RECIPES: RECIPES, NAMES: NAMES, add_group: add_group, tilt: tilt, helpers: helpers, GROUPS: GROUPS, recipe_params: recipe_params, sdf_of: sdf_of, render_def: render_def, species_def: species_def, bounds: bounds, key_of: key_of, reach: reach, element: element, check_element: check_element, FOUND: FOUND, SINK: SINK };
});
