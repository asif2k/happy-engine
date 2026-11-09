// THE WORLD: what a creature lives in, as packing modules kept by name where they are included (species.js: world_libs): the world's builder (a world file is a JS text given `w`: w.add("chair", { pos, yaw })), the kit of things it can add,
// its pieces of sdf, the world's own blocks, the page's runtime of a hosted world (doors, lamps, the spawner, the requests), the host that makes a world live on a real page (the engine's physics, the worker's nav and blocks, the creatures),
// and the AI's clip sets (the clips a block needs, by species and pack). The navigation (world_nav) is with the pure modules: the worker has it.
// Ported 2026-11-05 from the first version of the creature system, renamed and merged by domain. From here this file is the source.

// ========================================================================================================================
// world_spec
// ========================================================================================================================
packing()("happy_world_spec", function happy_world_spec() {
  "use strict";
  // HAPPY WORLD SPEC: the BUILDER a world file is given (SYSTEM.md). A world file is JS text, like a creature file: it runs as the body of a function with one argument, `w`, calls it to make the world and ends with
  // `return { ... }`; every world is different, so it is code (loops, helpers) and not a table:
  //     w.bounds([-30, -30, 30, 30]); w.ground({ y: 0 });
  //     w.room("kitchen", { x0: 0, z0: 0, x1: 5, z1: 4, h: 2.6, doors: [{ side: "s", at: 2.5 }], scene: "kitchen" });
  //     w.stairs({ from: [4, 0, 1], yaw: 0, rise: 2.7 });  w.add("chair", { pos: [1, 0, 1], yaw: 3.14 });  w.spawn({ id: "folk", family: "person", zones: ["kitchen"], cap: 3 });
  //     return { name: "my house" };
  // The builder RECORDS what the file declares as plain data (the spec: JSON, so that the page and the workers bake the same nav from it); the runtime derives collision, navigation and interaction from it and never the
  // reverse. Everything geometric is a BOX (the physics has boxes, spheres, capsules and compounds of them): walls, floors, steps, rails. y is up, metres, a yaw turns about y and its forward is (sin yaw, cos yaw).
  //   const w = create(name, kit)      load(text, name, kit) -> the same, from a world file's text      w.build(returned) -> { spec (data), blocks (the world blocks of the file: functions, run on the page), creature_blocks ({ name: source text }: for the workers), report }
  // The builders (w.floor, wall, room, door, stairs, ramp, ladder, ledge, zone, scene, entity, add, spawn ...) check their options (an unknown key or a wrong number is thrown with its name), and the kit (world/kit.js of `happy`, which is not kept here)
  // adds the furniture and the physical elements on top of w.entity. Node 14: no optional chaining, no ??.
  const RAIL_H = 1.0, RAIL_T = 0.1;
  const CLASSES = ["static", "dynamic", "kinematic"];
  const SIDES = { n: [0, 1], s: [0, -1], e: [1, 0], w: [-1, 0] };
  const fail = function (where, text) { throw new Error("happy_world_spec: " + where + ": " + text); };
  const num = function (where, k, v, dflt) { if (v === undefined) { if (dflt === undefined) fail(where, k + " is a number (metres)"); return dflt; } if (typeof v !== "number" || !isFinite(v)) fail(where, k + " is a number, not " + JSON.stringify(v)); return v; };
  const vec = function (where, k, v, n, dflt) { if (v === undefined) { if (dflt === undefined) fail(where, k + " is " + n + " numbers"); return dflt.slice(); } if (!Array.isArray(v) || v.length !== n) fail(where, k + " is a list of " + n + " numbers"); for (let i = 0; i < n; i++) if (typeof v[i] !== "number" || !isFinite(v[i])) fail(where, k + "[" + i + "] is a number"); return v.slice(); };
  const known = function (where, o, keys) { if (!o || typeof o !== "object") fail(where, "options are an object { " + keys.slice(0, 4).join(", ") + " ... }"); for (const k in o) if (keys.indexOf(k) < 0) fail(where, "`" + k + "` is not an option (" + keys.join(", ") + ")"); };
  const rot = function (yaw, lx, lz) { const c = Math.cos(yaw), s = Math.sin(yaw); return [lx * c + lz * s, -lx * s + lz * c]; };    // a local (x, z) to the world's: forward (0, 1) is (sin yaw, cos yaw)

  function create(name, kit_module) {
    const S = {
      format: "system-world", version: 1, name: name || "world",
      nav: { cell: 0.25, bounds: [-32, -32, 32, 32], agents: {}, default_agent: "person" },
      ground: { y: 0 }, terrain: {},
      boxes: [], stairs: [], ramps: [], links: [], doors: [], zones: [], scenes: [], entities: [], slots: [], bindings: [], spawn_rules: [], required_blocks: [], gives: [], block_params: {}, keys: [], relations: [], roles: []
    };
    const world_blocks = {}, creature_blocks = {}, kit = {}, report = { warnings: [] };
    let next_group = 100;
    const w = { S: S, kit: kit };
    w.warn = function (text) { report.warnings.push(String(text)); };                                      // (a builder of the kit says what it could not do: the host prints it, a world test asserts there is none)

    // ---- the plane, the bounds, the nav
    w.bounds = function (b) { S.nav.bounds = vec("w.bounds", "bounds", b, 4); if (!(b[2] > b[0] && b[3] > b[1])) fail("w.bounds", "[x0, z0, x1, z1] with x1 > x0 and z1 > z0"); };
    w.ground = function (o) { if (o === null) { S.ground = null; return; } known("w.ground", o || {}, ["y"]); S.ground = { y: num("w.ground", "y", (o || {}).y, 0) }; };
    w.terrain = function (o) { S.terrain = o || {}; };                                                      // (empty for now: the nav is built from a walkable-surface provider, so terrain is added there later)
    w.nav = function (o) {
      known("w.nav", o, ["cell", "agents", "default_agent"]);
      if (o.cell !== undefined) { S.nav.cell = num("w.nav", "cell", o.cell); if (!(o.cell >= 0.1 && o.cell <= 1)) fail("w.nav", "cell is 0.1 .. 1 metres"); }
      if (o.agents) for (const k in o.agents) { known("w.nav agents." + k, o.agents[k], ["radius", "height", "step", "slope", "drop"]); S.nav.agents[k] = o.agents[k]; }
      if (o.default_agent) S.nav.default_agent = o.default_agent;
    };
    w.group = function () { return next_group++; };                                                         // (a number for the boxes of one surface: a stair's steps, a ramp's slices)

    // ---- the low level: a box
    const BOX_KEYS = ["pos", "size", "yaw", "pitch", "cls", "walk", "block", "group", "owner", "layer", "color", "name", "kind", "virtual"];
    w.box = function (o) {
      known("w.box", o, BOX_KEYS);
      const pos = vec("w.box", "pos", o.pos, 3), size = vec("w.box", "size", o.size, 3);
      for (let i = 0; i < 3; i++) if (!(size[i] > 0)) fail("w.box", "size[" + i + "] is above 0");
      if (o.cls !== undefined && CLASSES.indexOf(o.cls) < 0) fail("w.box", "cls is " + CLASSES.join(", "));
      const b = { id: S.boxes.length, owner: o.owner === undefined ? -1 : o.owner, group: o.group || 0, cls: o.cls || "static", pos: pos, half: [size[0] / 2, size[1] / 2, size[2] / 2], yaw: num("w.box", "yaw", o.yaw, 0), pitch: num("w.box", "pitch", o.pitch, 0), walk: !!o.walk, block: o.block === undefined ? true : !!o.block, layer: o.layer || "world", kind: o.kind || "box", color: o.color || null, virtual: !!o.virtual };            // (virtual: the nav has it (a deck a mechanism carries), the physics world has no body of it)
      S.boxes.push(b);
      return b.id;
    };
    const solid = function (cx, cy, cz, sx, sy, sz, yaw, extra) { const o = { pos: [cx, cy, cz], size: [sx, sy, sz], yaw: yaw || 0 }; for (const k in (extra || {})) o[k] = extra[k]; return w.box(o); };

    // ---- floors: a slab whose top is `y`, with holes (a stairwell), and rails round its open edges
    w.floor = function (o) {
      known("w.floor", o, ["name", "x0", "z0", "x1", "z1", "y", "thick", "holes", "rails", "scene", "color"]);
      const x0 = num("w.floor", "x0", o.x0), z0 = num("w.floor", "z0", o.z0), x1 = num("w.floor", "x1", o.x1), z1 = num("w.floor", "z1", o.z1), y = num("w.floor", "y", o.y, 0), th = num("w.floor", "thick", o.thick, 0.2);
      if (!(x1 > x0 && z1 > z0)) fail("w.floor", "x1 > x0 and z1 > z0");
      let rects = [[x0, z0, x1, z1]];
      const holes = (o.holes || []).map(function (h) { return Array.isArray(h) ? { rect: h, rails: "nsew" } : h; });
      holes.forEach(function (h, i) {
        known("w.floor holes[" + i + "]", h, ["rect", "rails"]);
        const r = vec("w.floor holes[" + i + "]", "rect", h.rect, 4);
        const next = [];
        rects.forEach(function (q) {
          if (r[2] <= q[0] || r[0] >= q[2] || r[3] <= q[1] || r[1] >= q[3]) { next.push(q); return; }
          const a0 = Math.max(r[0], q[0]), a1 = Math.min(r[2], q[2]), b0 = Math.max(r[1], q[1]), b1 = Math.min(r[3], q[3]);
          if (b0 > q[1]) next.push([q[0], q[1], q[2], b0]);
          if (b1 < q[3]) next.push([q[0], b1, q[2], q[3]]);
          if (a0 > q[0]) next.push([q[0], b0, a0, b1]);
          if (a1 < q[2]) next.push([a1, b0, q[2], b1]);
        });
        rects = next;
      });
      const group = w.group();
      rects.forEach(function (q) { if (q[2] - q[0] > 1e-4 && q[3] - q[1] > 1e-4) solid((q[0] + q[2]) / 2, y - th / 2, (q[1] + q[3]) / 2, q[2] - q[0], th, q[3] - q[1], 0, { walk: true, block: true, group: group, kind: "floor", color: o.color }); });
      const rail = function (a, b, c, d) { w.rail([a, y, b], [c, y, d]); };
      const sides = o.rails === "all" ? "nsew" : (typeof o.rails === "string" ? o.rails : "");
      for (let i = 0; i < sides.length; i++) {
        if (!SIDES[sides[i]]) fail("w.floor", "rails is `all` or letters of n s e w (" + o.rails + ")");
        if (sides[i] === "n") rail(x0, z1 - RAIL_T / 2, x1, z1 - RAIL_T / 2); if (sides[i] === "s") rail(x0, z0 + RAIL_T / 2, x1, z0 + RAIL_T / 2);
        if (sides[i] === "e") rail(x1 - RAIL_T / 2, z0, x1 - RAIL_T / 2, z1); if (sides[i] === "w") rail(x0 + RAIL_T / 2, z0, x0 + RAIL_T / 2, z1);
      }
      holes.forEach(function (h) {                                                                          // (a hole's rails stand ON the slab, round the hole; a side the stairs arrive at has none)
        const r = h.rect, ss = h.rails === undefined ? "nsew" : h.rails;
        for (let i = 0; i < ss.length; i++) {
          if (!SIDES[ss[i]]) fail("w.floor holes", "rails is letters of n s e w (" + h.rails + ")");
          if (ss[i] === "n") rail(r[0] - RAIL_T / 2, r[3] + RAIL_T / 2, r[2] + RAIL_T / 2, r[3] + RAIL_T / 2); if (ss[i] === "s") rail(r[0] - RAIL_T / 2, r[1] - RAIL_T / 2, r[2] + RAIL_T / 2, r[1] - RAIL_T / 2);
          if (ss[i] === "e") rail(r[2] + RAIL_T / 2, r[1], r[2] + RAIL_T / 2, r[3]); if (ss[i] === "w") rail(r[0] - RAIL_T / 2, r[1], r[0] - RAIL_T / 2, r[3]);
        }
      });
      return { x0: x0, z0: z0, x1: x1, z1: z1, y: y, group: group };
    };
    // a rail: a thin solid box a metre high between two points (a, b: [x, y, z] with y the floor it stands on)
    w.rail = function (a, b, o) {
      const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.sqrt(dx * dx + dz * dz);
      if (!(len > 0.01)) return -1;
      const h = (o && o.h) || RAIL_H;
      return solid((a[0] + b[0]) / 2, a[1] + h / 2, (a[2] + b[2]) / 2, RAIL_T, h, len, Math.atan2(dx, dz), { kind: "rail", group: (o && o.group) || 0 });
    };

    // a KEY: a name that doors and containers are locked by (`key: "red"`); a creature holds it as a bit of its flags (pure.js), the world numbers them from 1 (at most 8)
    w.key = function (name) { const i = S.keys.indexOf(name); const k = i >= 0 ? i + 1 : S.keys.push(name); if (k > 8) fail("w.key", "at most 8 different keys in a world"); return k; };

    // FACTIONS and what they feel for each other: `w.relate("folk", "raiders", -1)` (-1 hostile, 0 neutral, 1 friendly; `{ both: true }` says it of the other way too). The worker's blackboard has them (a creature's `family.faction` is its side):
    // the blocks that go for a hostile creature (fight, goals' engage, flee, greet ...) ask the blackboard who is
    w.relate = function (a, b, v, o) {
      o = o || {};
      if (typeof a !== "string" || typeof b !== "string" || a === "" || b === "") fail("w.relate", "two names of factions");
      if (v !== -1 && v !== 0 && v !== 1) fail("w.relate", "the relation is -1 (hostile), 0 (neutral) or 1 (friendly) (" + v + ")");
      for (const k in o) if (k !== "both") fail("w.relate", "`" + k + "` is not an option (both)");
      S.relations.push([a, b, v]);
      if (o.both) S.relations.push([b, a, v]);
    };

    // ---- doors: an entity (kinematic leaf) and a gate for the nav; `w.wall` makes them in the gaps it cuts. A door's FRAME: its x axis runs along the wall (the leaf's width), its z axis through the doorway (a creature
    // comes from -z or +z), its origin is the floor at the middle of the doorway; `yaw` turns that frame
    const DOOR_KEYS = ["name", "pos", "yaw", "width", "height", "thick", "hinge", "swing", "open_angle", "locked", "key", "open", "scene", "block", "auto", "color", "double", "mode", "look"];
    w.door = function (o) {
      known("w.door", o, DOOR_KEYS);
      const pos = vec("w.door", "pos", o.pos, 3), width = num("w.door", "width", o.width, 1.1), height = num("w.door", "height", o.height, 2.1), thick = num("w.door", "thick", o.thick, 0.06);
      if (!(width > 0.5 && width < 6)) fail("w.door", "width is 0.5 .. 6 metres");
      const gate = S.doors.length, hinge = o.hinge || "left";
      if (["left", "right", "slide"].indexOf(hinge) < 0) fail("w.door", "hinge is left, right or slide");
      if (o.mode !== undefined && ["auto", "joint"].indexOf(o.mode) < 0) fail("w.door", "mode is auto (it opens when a creature comes and closes itself) or joint (a leaf on a hinge: it moves when it is pushed or when the world's AI says, and never by itself)");
      const key = o.key === undefined ? 0 : w.key(o.key);
      S.doors.push({ id: gate, gate: gate, pos: pos, yaw: num("w.door", "yaw", o.yaw, 0), width: width, thick: Math.max(thick, 0.2), height: height, key: key, locked: !!o.locked, open: !!o.open });
      // one leaf, or two (`double`: each leaf half the doorway, the left hinged at its left jamb and the right at its right, both swinging the same way; one gate for the doorway; the left leaf is the one a creature asks, and it asks the other)
      const yaw0 = o.yaw || 0, slots = [{ kind: "use", id: "front", pos: [0, 0, -0.9], stand: [0, 0, -0.9], yaw: 0, radius: 0.5 }, { kind: "use", id: "back", pos: [0, 0, 0.9], stand: [0, 0, 0.9], yaw: Math.PI, radius: 0.5 }];
      const leaf = function (name, lpos, lwidth, lhinge, state_gate, partner) {
        const st = { open: o.open ? 1 : 0, locked: o.locked ? 1 : 0, key: key, angle: o.open ? 1 : 0 };
        if (state_gate !== undefined) st.gate = state_gate;
        return w.entity({ type: "door", name: name, cls: "kinematic", pos: lpos, yaw: yaw0, scene: o.scene, color: o.color, look: o.look, shapes: [{ pos: [0, height / 2, 0], size: [lwidth, height, thick], block: false }], affords: ["open", "close"].concat(o.locked || key ? ["unlock"] : []),
          blocks: o.auto === false ? [] : [{ name: o.mode === "joint" ? "door_joint" : "door", params: { hinge: lhinge, width: lwidth, height: height, open_angle: o.open_angle === undefined ? (o.mode === "joint" ? 165 : 100) : o.open_angle, swing: o.swing === -1 ? -1 : 1, gate: gate, partner: partner || "" } }],
          state: st, slots: state_gate !== undefined ? slots : [] });
      };
      if (!o.double) return { entity: leaf(o.name, pos, width, hinge, gate, ""), gate: gate };
      const base_name = o.name || ("door" + gate), off = rot(yaw0, width / 4, 0), lp = [pos[0] - off[0], pos[1], pos[2] - off[1]], rp = [pos[0] + off[0], pos[1], pos[2] + off[1]];
      const el = leaf(base_name + "_l", lp, width / 2, "left", gate, base_name + "_r"), er = leaf(base_name + "_r", rp, width / 2, "right", undefined, "");
      return { entity: el, entities: [el, er], gate: gate };
    };

    // ---- a GATE with no leaf: a stretch of the ground the nav may cross or not as its state says (0 open, 1 closed: it is asked to open, 2 locked): the span of a drawbridge, a portcullis a block moves. Its frame is a door's: x across the
    // way (`width`), z along it (`length`), the origin on the floor in the middle. Returns the gate's number: an entity names it in its state (`gate`, and `gate2` for a second one) and its block sets it (c.gate, c.set_gate)
    w.gate = function (o) {
      known("w.gate", o, ["pos", "yaw", "width", "length", "height", "locked", "key", "open"]);
      const pos = vec("w.gate", "pos", o.pos, 3), width = num("w.gate", "width", o.width, 2), length = num("w.gate", "length", o.length, 1), height = num("w.gate", "height", o.height, 3);
      if (!(width > 0.3 && length > 0.05)) fail("w.gate", "width is above 0.3 m and length above 0.05");
      const gate = S.doors.length, key = o.key === undefined ? 0 : w.key(o.key);
      S.doors.push({ id: gate, gate: gate, pos: pos, yaw: num("w.gate", "yaw", o.yaw, 0), width: width, thick: Math.max(length - 0.5, 0.2), height: height, key: key, locked: !!o.locked, open: !!o.open });
      return gate;
    };

    // ---- walls: boxes along a line, cut where a door or an opening is
    w.wall = function (o) {
      known("w.wall", o, ["from", "to", "y", "h", "thick", "doors", "openings", "scene", "color", "name"]);
      const f = vec("w.wall", "from", o.from, 2), t = vec("w.wall", "to", o.to, 2), y = num("w.wall", "y", o.y, 0), h = num("w.wall", "h", o.h, 2.6), th = num("w.wall", "thick", o.thick, 0.2);
      const dx = t[0] - f[0], dz = t[1] - f[1], L = Math.sqrt(dx * dx + dz * dz);
      if (!(L > 0.1)) fail("w.wall", "from and to are two different points");
      const ux = dx / L, uz = dz / L, yaw = Math.atan2(dx, dz), cuts = [];
      const made = { boxes: [], doors: [] };
      (o.doors || []).forEach(function (d, i) {
        known("w.wall doors[" + i + "]", d, ["at", "width", "height", "hinge", "swing", "open_angle", "locked", "key", "open", "auto", "name", "double", "mode"]);
        const at = num("w.wall doors[" + i + "]", "at", d.at), wd = num("w.wall doors[" + i + "]", "width", d.width, 1.1), hd = num("w.wall doors[" + i + "]", "height", d.height, 2.1);
        if (at - wd / 2 < 0.2 || at + wd / 2 > L - 0.2) fail("w.wall doors[" + i + "]", "the door is inside the wall (at " + at + ", width " + wd + ", wall length " + L.toFixed(2) + ")");
        cuts.push({ a: at - wd / 2, b: at + wd / 2, top: hd, door: d });
      });
      (o.openings || []).forEach(function (d, i) {
        known("w.wall openings[" + i + "]", d, ["at", "width", "sill", "top"]);
        const at = num("w.wall openings[" + i + "]", "at", d.at), wd = num("w.wall openings[" + i + "]", "width", d.width, 1.0);
        cuts.push({ a: at - wd / 2, b: at + wd / 2, top: num("w.wall openings[" + i + "]", "top", d.top, 2.1), sill: num("w.wall openings[" + i + "]", "sill", d.sill, 0) });
      });
      cuts.sort(function (p, q) { return p.a - q.a; });
      for (let i = 1; i < cuts.length; i++) if (cuts[i].a < cuts[i - 1].b + 0.05) fail("w.wall", "two openings overlap");
      const piece = function (a, b, y0, y1) { if (b - a < 0.01 || y1 - y0 < 0.01) return; made.boxes.push(solid(f[0] + ux * (a + b) / 2, (y0 + y1) / 2, f[1] + uz * (a + b) / 2, th, y1 - y0, b - a, yaw, { kind: "wall", color: o.color })); };
      let cur = 0;
      cuts.forEach(function (c) {
        piece(cur, c.a, y, y + h);
        if (c.sill) piece(c.a, c.b, y, y + c.sill);
        piece(c.a, c.b, y + c.top, y + h);                                                                  // (over the opening: a lintel)
        cur = c.b;
      });
      piece(cur, L, y, y + h);
      cuts.forEach(function (c) {
        if (!c.door) return;
        const d = c.door, at = (c.a + c.b) / 2, dopts = { pos: [f[0] + ux * at, y, f[1] + uz * at], yaw: yaw - Math.PI / 2, width: c.b - c.a, height: c.top, scene: o.scene, color: o.color };      // (a door's frame: x along the wall (the leaf's width), z through the doorway; the wall's own yaw has z along it)
        ["hinge", "swing", "open_angle", "locked", "key", "open", "auto", "name", "double", "mode"].forEach(function (k) { if (d[k] !== undefined) dopts[k] = d[k]; });
        made.doors.push(w.door(dopts));
      });
      return made;
    };
    // a room: four walls round a rectangle, doors by side (n s e w) and a zone of its floor; the floor and the ceiling are the world's (w.floor)
    w.room = function (rname, o) {
      known("w.room", o, ["x0", "z0", "x1", "z1", "y", "h", "thick", "doors", "openings", "zone", "scene", "color", "walls"]);
      const x0 = num("w.room", "x0", o.x0), z0 = num("w.room", "z0", o.z0), x1 = num("w.room", "x1", o.x1), z1 = num("w.room", "z1", o.z1), y = num("w.room", "y", o.y, 0), h = num("w.room", "h", o.h, 2.6);
      const th = num("w.room", "thick", o.thick, 0.2), pick = function (side, list) { return (list || []).filter(function (d) { return d.side === side; }).map(function (d) { const r = {}; for (const k in d) if (k !== "side") r[k] = d[k]; return r; }); };
      const edges = { s: [[x0, z0], [x1, z0]], n: [[x0, z1], [x1, z1]], w: [[x0, z0], [x0, z1]], e: [[x1, z0], [x1, z1]] };
      const walls = o.walls === undefined ? "nsew" : o.walls, out = {};
      for (let i = 0; i < walls.length; i++) {
        const s = walls[i];
        if (!edges[s]) fail("w.room", "walls is letters of n s e w");
        out[s] = w.wall({ from: edges[s][0], to: edges[s][1], y: y, h: h, thick: th, doors: pick(s, o.doors), openings: pick(s, o.openings), scene: o.scene, color: o.color });
      }
      if (o.zone !== false) w.zone(rname, { rect: [x0 + th / 2, z0 + th / 2, x1 - th / 2, z1 - th / 2], y: [y, y + h], scene: o.scene });
      return { name: rname, x0: x0, z0: z0, x1: x1, z1: z1, y: y, h: h, walls: out };
    };

    // ---- stairs and ramps: declared with their step height and depth so the nav knows who can climb them
    w.stairs = function (o) {
      known("w.stairs", o, ["from", "yaw", "width", "rise", "count", "step_h", "step_d", "rails", "name"]);
      const from = vec("w.stairs", "from", o.from, 3), yaw = num("w.stairs", "yaw", o.yaw, 0), width = num("w.stairs", "width", o.width, 1.2), sh = num("w.stairs", "step_h", o.step_h, 0.18), sd = num("w.stairs", "step_d", o.step_d, 0.28);
      let count = o.count;
      if (count === undefined) { if (o.rise === undefined) fail("w.stairs", "rise (the height gained) or count (the steps)"); count = Math.round(o.rise / sh); }
      if (!(count >= 1 && count <= 60) || count !== Math.floor(count)) fail("w.stairs", "count is a whole number of steps, 1 .. 60");
      if (!(sh >= 0.08 && sh <= 0.4) || !(sd >= 0.15 && sd <= 0.6) || !(width >= 0.6)) fail("w.stairs", "step_h 0.08 .. 0.4, step_d 0.15 .. 0.6, width at least 0.6 m");
      const rise = o.rise !== undefined ? o.rise : count * sh, h = rise / count, group = w.group();                // (the steps are as high as the rise says: it must meet the floor above)
      if (Math.abs(h - sh) > 0.02 && o.rise !== undefined && o.count === undefined) fail("w.stairs", "rise " + rise + " is not a whole number of steps of " + sh);
      const id = S.stairs.length;
      S.stairs.push({ id: id, group: group, pos: from, yaw: yaw, width: width, count: count, step_h: h, step_d: sd });
      for (let i = 0; i < count; i++) {
        const lz = (i + 0.5) * sd, wx = rot(yaw, 0, lz), top = (i + 1) * h;
        solid(from[0] + wx[0], from[1] + top / 2, from[2] + wx[1], width, top, sd, yaw, { kind: "step", block: true, group: group });
      }
      const rails = o.rails === undefined ? "both" : o.rails;
      if (["both", "left", "right", "none"].indexOf(rails) < 0) fail("w.stairs", "rails is both, left, right or none");
      if (rails !== "none") for (let i = 0; i < count; i++) {                                              // (a rail a step, outside the width: the nav's clearance keeps a body off it)
        const lz = (i + 0.5) * sd, top = (i + 1) * h;
        [-1, 1].forEach(function (side) {
          if ((side === 1 && rails === "right") || (side === -1 && rails === "left")) return;
          const wx = rot(yaw, side * (width / 2 + RAIL_T / 2), lz);
          solid(from[0] + wx[0], from[1] + top + RAIL_H / 2, from[2] + wx[1], RAIL_T, RAIL_H, sd, yaw, { kind: "rail" });
        });
      }
      const e = rot(yaw, 0, count * sd);
      return { id: id, top: [from[0] + e[0], from[1] + rise, from[2] + e[1]], length: count * sd, count: count, rise: rise, width: width, yaw: yaw, group: group };
    };
    w.ramp = function (o) {
      known("w.ramp", o, ["from", "yaw", "width", "length", "rise", "rails", "name"]);
      const from = vec("w.ramp", "from", o.from, 3), yaw = num("w.ramp", "yaw", o.yaw, 0), width = num("w.ramp", "width", o.width, 1.5), length = num("w.ramp", "length", o.length), rise = num("w.ramp", "rise", o.rise);
      if (!(length > 0.5) || !(rise > 0) || !(width >= 0.6)) fail("w.ramp", "length above 0.5 m, rise above 0, width at least 0.6 m");
      const group = w.group(), id = S.ramps.length;
      S.ramps.push({ id: id, group: group, pos: from, yaw: yaw, width: width, length: length, rise: rise });
      const n = Math.max(1, Math.ceil(length / 0.25)), d = length / n;                                      // (the solid body: slices a quarter of a metre deep, each as high as the ramp at its far end)
      for (let i = 0; i < n; i++) { const top = rise * (i + 1) / n, wx = rot(yaw, 0, (i + 0.5) * d); solid(from[0] + wx[0], from[1] + top / 2, from[2] + wx[1], width, top, d, yaw, { kind: "ramp", block: true, group: group }); }
      const rails = o.rails === undefined ? "both" : o.rails;
      if (rails !== "none") for (let i = 0; i < n; i++) {
        const top = rise * (i + 1) / n;
        [-1, 1].forEach(function (side) {
          if ((side === 1 && rails === "right") || (side === -1 && rails === "left")) return;
          const wx = rot(yaw, side * (width / 2 + RAIL_T / 2), (i + 0.5) * d);
          solid(from[0] + wx[0], from[1] + top + RAIL_H / 2, from[2] + wx[1], RAIL_T, RAIL_H, d, yaw, { kind: "rail" });
        });
      }
      const e = rot(yaw, 0, length);
      return { id: id, top: [from[0] + e[0], from[1] + rise, from[2] + e[1]], length: length, rise: rise, yaw: yaw, group: group };
    };
    // a ladder or a ledge: the nav cannot find these in the geometry, so they are LINKS: `from` is where a body stands below, `to` where it stands when it has climbed (a walkable surface under each). `rungs` draws the ladder
    w.ladder = function (o) {
      known("w.ladder", o, ["from", "to", "width", "yaw", "rungs", "bidir", "cost", "name"]);
      const a = vec("w.ladder", "from", o.from, 3), b = vec("w.ladder", "to", o.to, 3), id = S.links.length;
      if (!(b[1] > a[1] + 0.3) && o.bidir !== false) report.warnings.push("w.ladder: `to` is not above `from`");
      S.links.push({ id: id, kind: "climb", a: a, b: b, bidir: o.bidir !== false, cost: o.cost, name: o.name || "ladder" + id });
      if (o.rungs !== false) {
        const width = num("w.ladder", "width", o.width, 0.5), yaw = num("w.ladder", "yaw", o.yaw, 0), n = Math.max(2, Math.floor((b[1] - a[1]) / 0.3)), mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2;
        for (let i = 0; i < n; i++) solid(mx, a[1] + (i + 0.5) * (b[1] - a[1]) / n, mz, width, 0.04, 0.04, yaw, { kind: "rung", block: false });
      }
      return id;
    };
    w.ledge = function (o) {
      known("w.ledge", o, ["from", "to", "bidir", "cost", "kind", "name"]);
      const id = S.links.length;
      S.links.push({ id: id, kind: o.kind || "ledge", a: vec("w.ledge", "from", o.from, 3), b: vec("w.ledge", "to", o.to, 3), bidir: o.bidir === true, cost: o.cost, name: o.name || "ledge" + id });
      return id;
    };

    // ---- zones and scenes
    w.zone = function (zname, o) {
      known("w.zone " + zname, o, ["rect", "y", "tags", "scene"]);
      if (S.zones.some(function (z) { return z.name === zname; })) fail("w.zone", "the zone `" + zname + "` exists");
      const rect = vec("w.zone " + zname, "rect", o.rect, 4);
      if (!(rect[2] > rect[0] && rect[3] > rect[1])) fail("w.zone " + zname, "rect is [x0, z0, x1, z1]");
      S.zones.push({ id: S.zones.length, name: zname, rect: rect, y: o.y ? vec("w.zone " + zname, "y", o.y, 2) : null, tags: o.tags || [], scene: o.scene || null });
      return S.zones.length - 1;
    };
    // a scene: a room (or several) as a unit that can be active, dormant or unloaded. policy: "auto" (dormant when no creature is in or near it), "always" (never sleeps: the default of the world's own), "manual"
    w.scene = function (sname, o) {
      known("w.scene " + sname, o || {}, ["zones", "policy", "state", "wake_margin", "mood", "blocks", "pinned"]);
      o = o || {};
      if (S.scenes.some(function (s) { return s.name === sname; })) fail("w.scene", "the scene `" + sname + "` exists");
      const policy = o.policy || "auto";
      if (["auto", "always", "manual"].indexOf(policy) < 0) fail("w.scene " + sname, "policy is auto, always or manual");
      S.scenes.push({ id: S.scenes.length, name: sname, zones: o.zones || [], policy: policy, state: o.state || "active", wake_margin: num("w.scene", "wake_margin", o.wake_margin, 3), mood: o.mood || {}, blocks: o.blocks || [] });
      return S.scenes.length - 1;
    };

    // ---- entities: the props. class static (collision only), dynamic (simulated) or kinematic (moved by a world block); affordances; slots; blocks
    const ENTITY_KEYS = ["type", "name", "cls", "pos", "yaw", "shapes", "mass", "layer", "color", "affords", "slots", "blocks", "state", "hold", "scene", "walk", "tags", "look", "scale"];
    w.entity = function (o) {
      known("w.entity", o, ENTITY_KEYS);
      const cls = o.cls || "static";
      if (CLASSES.indexOf(cls) < 0) fail("w.entity", "cls is " + CLASSES.join(", "));
      const pos = vec("w.entity", "pos", o.pos, 3, [0, 0, 0]), yaw = num("w.entity", "yaw", o.yaw, 0), id = S.entities.length;
      if (!Array.isArray(o.shapes) || !o.shapes.length) fail("w.entity " + (o.type || ""), "shapes is a list of boxes { pos (local), size, block }");
      const e = { id: id, type: o.type || "prop", name: o.name || ((o.type || "prop") + id), cls: cls, pos: pos, yaw: yaw, mass: o.mass || 0, layer: o.layer || (o.hold ? "holdable" : "world"), color: o.color || null, affords: (o.affords || []).slice(), slots: [], blocks: (o.blocks || []).slice(), state: o.state || {}, hold: o.hold || null, scene: o.scene || null, tags: o.tags || [], look: o.look || null, scale: o.scale === undefined ? 1 : o.scale, shapes: [], boxes: [] };
      o.shapes.forEach(function (s, i) {
        known("w.entity shapes[" + i + "]", s, ["pos", "size", "yaw", "block", "walk", "color", "kind"]);
        const lp = vec("w.entity shapes", "pos", s.pos, 3, [0, 0, 0]), size = vec("w.entity shapes", "size", s.size, 3), r = rot(yaw, lp[0], lp[2]);
        e.shapes.push({ pos: lp, size: size, yaw: s.yaw || 0, block: s.block, walk: !!s.walk });
        if (cls === "static") e.boxes.push(w.box({ pos: [pos[0] + r[0], pos[1] + lp[1], pos[2] + r[1]], size: size, yaw: yaw + (s.yaw || 0), owner: id, walk: !!s.walk, block: s.block === false ? false : true, kind: s.kind || "prop", color: s.color || o.color, layer: e.layer }));
      });
      (o.slots || []).forEach(function (sl, i) {
        known("w.entity slots[" + i + "]", sl, ["id", "kind", "pos", "yaw", "radius", "stand", "exclusive", "items", "tags", "duration", "seat"]);
        const lp = vec("w.entity slots", "pos", sl.pos, 3, [0, 0, 0]), r = rot(yaw, lp[0], lp[2]), st = sl.stand ? vec("w.entity slots", "stand", sl.stand, 3) : [lp[0], 0, lp[2] - 0.7 * 1], rs = rot(yaw, st[0], st[2]);
        const slot = { id: S.slots.length, owner: id, key: sl.id || ("s" + i), kind: sl.kind, local: lp, yaw: num("w.entity slots", "yaw", sl.yaw, 0), wpos: [pos[0] + r[0], pos[1] + lp[1], pos[2] + r[1]], wyaw: yaw + (sl.yaw || 0), radius: num("w.entity slots", "radius", sl.radius, 0.6), stand_local: st, stand: [pos[0] + rs[0], pos[1] + st[1], pos[2] + rs[1]], exclusive: sl.exclusive !== false, items: sl.items || [], tags: sl.tags || [], duration: sl.duration || 0, seat: sl.seat || null };
        if (typeof sl.kind !== "string" || !sl.kind) fail("w.entity slots[" + i + "]", "kind is a name (sit, sleep, place, stand, use ...)");
        S.slots.push(slot); e.slots.push(slot.id);
        if (e.affords.indexOf(slot.kind) < 0) e.affords.push(slot.kind);
      });
      S.entities.push(e);
      return id;
    };
    // the kit: types of entities (world/kit.js of `happy`, which is not kept here adds the furniture and the physical elements): w.type(name, function (w, o) -> entity id), w.add(name, o)
    w.type = function (tname, fn) { if (typeof fn !== "function") fail("w.type", "a function (w, options)"); kit[tname] = fn; };
    w.add = function (tname, o) {
      if (!kit[tname]) fail("w.add", "no type `" + tname + "` (" + Object.keys(kit).sort().join(", ") + ")");
      const r = kit[tname](w, o || {});
      if (o && o.tags !== undefined) {                                                                      // (`tags: [...]` on any type adds to the type's own: `needs:tool` says that using the thing takes an item of that kind)
        if (!Array.isArray(o.tags) || o.tags.some(function (g) { return typeof g !== "string"; })) fail("w.add " + tname, "tags is a list of names");
        (Array.isArray(r) ? r : [r]).forEach(function (id) { const e = S.entities[id]; if (e) o.tags.forEach(function (g) { if (e.tags.indexOf(g) < 0) e.tags.push(g); }); });
      }
      return r;
    };
    w.types = function () { return Object.keys(kit).sort(); };

    // ---- blocks: the world's own (run on the page, over entities and scenes) and the creature blocks it needs its hosted creatures to have
    w.block = function (bname, def) { if (world_blocks[bname]) fail("w.block", "the world block `" + bname + "` exists"); world_blocks[bname] = def; };
    w.bind = function (bname, target, params) { S.bindings.push({ block: bname, target: target, params: params || {} }); };                // (target: an entity id or name, a scene name, or "world": the world's own AI, a block that is no entity's)
    w.creature_block = function (bname, def) {                                                              // a creature block this world brings: its source goes to every worker as text
      if (typeof def === "function") def = { worker: def };
      if (!def || typeof def.worker !== "function") fail("w.creature_block", "{ name, params, plug, worker: function (api, P) ... } (ES5)");
      creature_blocks[bname] = def;
    };
    // the settings the WORLD gives a creature block for every creature it hosts: w.params("goto", { speed: 1.2 }) (they win over the creature's own: pure.js)
    w.params = function (bname, o) { if (!o || typeof o !== "object") fail("w.params", "(block name, { setting: value, ... })"); S.block_params[bname] = Object.assign(S.block_params[bname] || {}, o); };
    // w.give(who, { blocks, props, remove }): what the WORLD gives the creatures it hosts, by what they are: `who` is a family's name, "*" (every creature), { family }, { ability: "grab" } (the ones that can),
    // { block: "walk" } (the ones that have that skill). `blocks` are skills the world adds to a creature or settings it gives one it has (the world's settings win: goals are given here, `goals: [...]` as data), `remove` are skills it takes
    // away (wander, in a world where the creatures do what they are told), `props` the settings of paths. A creature that is only its skills (its tree is `ld.auto_tree()`) takes what it is given into its tree by priority.
    w.give = function (who, o) {
      if (!(typeof who === "string" || (who && typeof who === "object" && Object.keys(who).length === 1 && ["family", "ability", "block"].indexOf(Object.keys(who)[0]) >= 0))) fail("w.give", "(who, { blocks, props, remove }): who is a family's name, \"*\", { family } , { ability } or { block }");
      known("w.give", o || {}, ["blocks", "props", "remove"]);
      S.gives.push({ who: who, blocks: (o && o.blocks) || [], props: (o && o.props) || {}, remove: (o && o.remove) || [] });
    };
    w.require = function (names) { (Array.isArray(names) ? names : [names]).forEach(function (n) { if (S.required_blocks.indexOf(n) < 0) S.required_blocks.push(n); }); };
    // THE ROLES the world's AI gives the creatures it hosts (world/blocks/role.js, SYSTEM.md "Roles"): `w.roles(["lead", "cover"])`. A role is its place in the list, from 1. The creatures' goals and skills name them (`when: { role: "lead" }`,
    // the errand skill's `roles`); the world's AI gives them (`c.assign(handle, "lead", { x, z })`, `c.allot("lead", jobs, crew)`). A second call adds more; a name is a text and is there once; at most 255.
    w.roles = function (names) {
      (Array.isArray(names) ? names : [names]).forEach(function (n) {
        if (typeof n !== "string" || n === "") fail("w.roles", "a role is a name (" + String(n) + ")");
        if (S.roles.indexOf(n) >= 0) fail("w.roles", "the role `" + n + "` is there already");
        S.roles.push(n);
      });
      if (S.roles.length > 255) fail("w.roles", "at most 255 roles");
    };

    // ---- spawn rules: which families may exist, where, how many, and how long a slot waits to come back
    w.spawn = function (o) {
      known("w.spawn", o, ["id", "family", "zones", "cap", "initial", "respawn", "corpse", "clear", "agent", "variant", "skin", "scale", "when", "mind", "faction", "tags"]);
      ["variant", "skin"].forEach(function (k) {                                                      // (a look or a skin: a whole number, a name, or a list of them to pick one from at each spawn)
        if (o[k] === undefined) return;
        const ok = function (x) { return (typeof x === "number" && Number.isInteger(x) && x >= 0) || (typeof x === "string" && x !== ""); };
        if (!(ok(o[k]) || (Array.isArray(o[k]) && o[k].length > 0 && o[k].every(ok)))) fail("w.spawn", k + " is a whole number, a name, or a list of them (one is picked at each spawn)");
      });
      const family = o.family;
      if (!family || (typeof family !== "string" && !Array.isArray(family))) fail("w.spawn", "family is the name of a creature (or a list of them)");
      const cap = num("w.spawn", "cap", o.cap), re = o.respawn === undefined ? [20, 40] : (typeof o.respawn === "number" ? [o.respawn, o.respawn] : vec("w.spawn", "respawn", o.respawn, 2));
      if (!(cap >= 0) || cap !== Math.floor(cap)) fail("w.spawn", "cap is a whole number");
      const rule = { id: o.id || ("rule" + S.spawn_rules.length), family: [].concat(family), zones: [].concat(o.zones || []), cap: cap, initial: o.initial === undefined ? cap : o.initial, respawn: re, corpse: num("w.spawn", "corpse", o.corpse, 8), clear: num("w.spawn", "clear", o.clear, 1.0), agent: o.agent || null, variant: o.variant, skin: o.skin, scale: o.scale || [1, 1], mind: o.mind, faction: o.faction || null, tags: o.tags || [] };
      if (S.spawn_rules.some(function (r) { return r.id === rule.id; })) fail("w.spawn", "the rule `" + rule.id + "` exists");
      S.spawn_rules.push(rule);
      return rule.id;
    };

    // ---- the end: the returned object, the checks that need everything, the plain data
    w.build = function (returned) {
      const r = returned && typeof returned === "object" ? returned : {};
      if (r.name) S.name = r.name;
      const zone_names = S.zones.map(function (z) { return z.name; }), scene_names = S.scenes.map(function (s) { return s.name; });
      S.scenes.forEach(function (s) { s.zones.forEach(function (z) { if (zone_names.indexOf(z) < 0) fail("scene `" + s.name + "`", "its zone `" + z + "` does not exist (" + zone_names.join(", ") + ")"); }); });
      S.zones.forEach(function (z) { if (z.scene && scene_names.indexOf(z.scene) < 0) fail("zone `" + z.name + "`", "its scene `" + z.scene + "` does not exist"); });
      S.entities.forEach(function (e) { if (e.scene && scene_names.indexOf(e.scene) < 0) fail("entity `" + e.name + "`", "its scene `" + e.scene + "` does not exist"); });
      S.spawn_rules.forEach(function (rl) { rl.zones.forEach(function (z) { if (zone_names.indexOf(z) < 0) fail("spawn rule `" + rl.id + "`", "its zone `" + z + "` does not exist"); }); });
      S.bindings.forEach(function (b) {
        if (!world_blocks[b.block] && !b.builtin) report.warnings.push("bind: the block `" + b.block + "` is not one of this file's (it must be a generic world block)");
        if (typeof b.target === "string" && b.target !== "world" && scene_names.indexOf(b.target) < 0 && !S.entities.some(function (e) { return e.name === b.target; })) fail("bind `" + b.block + "`", "the target `" + b.target + "` is neither a scene nor an entity");
      });
      // an entity that says no scene belongs to the scene whose zone it stands in (the first one), else to the world
      S.entities.forEach(function (e) {
        if (e.scene) return;
        for (let i = 0; i < S.zones.length; i++) {
          const z = S.zones[i], p = e.pos;
          if (z.scene && p[0] >= z.rect[0] && p[0] <= z.rect[2] && p[2] >= z.rect[1] && p[2] <= z.rect[3] && (!z.y || (p[1] >= z.y[0] - 0.2 && p[1] <= z.y[1]))) { e.scene = z.scene; break; }
        }
      });
      const sources = {};
      for (const k in creature_blocks) sources[k] = { name: k, params: creature_blocks[k].params || {}, plug: creature_blocks[k].plug || {}, source: String(creature_blocks[k].worker) };
      S.creature_blocks = Object.keys(sources);
      S.extra = r.extra || {};
      const items = w.items_out || {};                                                                      // (the items of the world's sdf pieces: world/world_items.js; counted by what looks like them)
      for (const k in items) items[k].count = 0;
      S.entities.forEach(function (e) { if (!e.look) return; if (!items[e.look] || !items[e.look].sdf) fail("entity `" + e.name + "`", "its look `" + e.look + "` is not an item with an sdf (w.item)"); items[e.look].count++; });
      return { spec: JSON.parse(JSON.stringify(S)), blocks: world_blocks, creature_blocks: sources, report: report, items: items };
    };
    if (kit_module) kit_module.install(w);                                                                  // (the furniture and the physical elements: world/kit.js of `happy`, which is not kept here)
    return w;
  }

  // run a world file's text: it is the body of a function with one argument, `w`, and returns its definition
  function load(text, name, kit_module) {
    const w = create(name, kit_module);
    let fn, ret;
    try { fn = new Function("w", String(text)); } catch (e) { throw new Error("happy_world_spec: the world file does not compile: " + e.message); }
    ret = fn(w);
    return w.build(ret);
  }
  // the gives of a spec that are meant for a creature (its file's object: name, abilities, mind.blocks): [{ blocks, props, remove }] in the order they were made
  const gives_for = function (spec, c) {
    const names = ((c.mind && c.mind.blocks) || []).map(function (b) { return typeof b === "string" ? b : Array.isArray(b) ? b[0] : b.block; }), ab = c.abilities || [];
    return (spec.gives || []).filter(function (g) {
      const w = g.who;
      if (w === "*") return true;
      if (typeof w === "string") return w === c.name;
      return w.family !== undefined ? w.family === c.name : w.ability !== undefined ? ab.indexOf(w.ability) >= 0 : names.indexOf(w.block) >= 0;
    });
  };
  return { create: create, load: load, gives_for: gives_for, RAIL_H: RAIL_H };
});

// ========================================================================================================================
// kit
// ========================================================================================================================
packing()("happy_world_kit", function happy_world_kit() {
  "use strict";
  // HAPPY WORLD KIT: the types of entity a world file can `w.add("chair", { pos, yaw })` (SYSTEM.md). Each is a function (w, o) that makes ONE entity with w.entity: its physical class (static: collision only; dynamic: simulated;
  // kinematic: moved by a world block), its boxes, its AFFORDANCES (what a creature may do with it: sit, sleep, place, store, open, grab, switch, use, climb) and its SLOTS (where it is done: a sofa has three sit slots, a table
  // a grid of place slots, a bed one sleep slot), and the generic world block that drives it. A creature never asks for "a chair": it asks for a free slot of an affordance, and the world answers. A world file adds its own
  // types with w.type(name, fn). Every type takes the common options { pos, yaw, scene, name, color } and its own (below). Sizes are metres; `pos` is the point on the floor under the middle of the piece.
  //   BUILDINGS: w.building (storeys of rooms, stairs, furniture by style: see below, at its end) and w.furnish / w.style.
  //   crate barrel pillar | sword rifle (holdable) | chair stool bench sofa | bed | table desk counter shelf | cupboard chest wardrobe | lamp stove | rug | curtain | door (w.door) | windmill drawbridge | plate (a pressure plate)
  // Node 14: no optional chaining, no ??.
  const num = function (o, k, d) { return o[k] === undefined ? d : o[k]; };
  const common = function (o, extra) {
    const r = { pos: o.pos || [0, 0, 0], yaw: o.yaw || 0, scene: o.scene, name: o.name, color: o.color };
    for (const k in extra) r[k] = extra[k];
    return r;
  };
  // a sit slot: the seat's place, and where a body stands before it sits: in front (a seat against a wall or tucked under a table is `approach`ed from a side: "left", "right" or "back"; the entity's own frame: +z is the way it faces)
  const APPROACH = { front: [0, 0.65], back: [0, -0.65], left: [0.65, 0], right: [-0.65, 0] };
  const seat = function (id, x, z, y, yaw, approach) { const a = APPROACH[approach || "front"]; if (!a) throw new Error("happy_world_kit: approach is front, back, left or right (" + approach + ")"); return { id: id, kind: "sit", pos: [x, y, z], yaw: yaw || 0, radius: 0.5, stand: [x + a[0], 0, z + a[1]], tags: ["seat"] }; };

  const Items = world_libs.happy_world_items();      // (w.item, w.place, w.row, w.seat_at: a world of sdf pieces)
  function install(w) {
    Items.install(w);
    const T = w.type;

    // ---- loose things: dynamic props
    T("crate", function (w, o) {
      const s = num(o, "size", 0.5);
      return w.entity(common(o, { type: "crate", cls: "dynamic", mass: num(o, "mass", 12 * s * s * s * 8), shapes: [{ pos: [0, s / 2, 0], size: [s, s, s] }], affords: ["grab", "push", "stack"], tags: ["loose"] }));
    });
    T("barrel", function (w, o) {
      return w.entity(common(o, { type: "barrel", cls: "dynamic", mass: num(o, "mass", 25), shapes: [{ pos: [0, 0.45, 0], size: [0.55, 0.9, 0.55] }], affords: ["grab", "push"], tags: ["loose"] }));
    });
    T("pillar", function (w, o) {
      return w.entity(common(o, { type: "pillar", cls: "static", shapes: [{ pos: [0, num(o, "h", 2.6) / 2, 0], size: [num(o, "w", 0.4), num(o, "h", 2.6), num(o, "w", 0.4)] }] }));
    });

    // ---- ITEMS: small things a creature takes by hand and carries in its pockets (its inventory: world/blocks/inventory.js): a key (opens the doors of its number), a tool, a parcel. They are not bodies of the physics world (a crate is: it is carried
    // in the hands): they are posed by the world block `item` from their STATE (px, py, pz, and holder: the handle + 1 of the creature that carries one, 0 when it lies about). `key: n` is the number of the doors it opens (a key piece defaults to 1)
    const item = function (type, kind, dflt_key, color) {
      return function (w, o) {
        const p = o.pos || [0, 0, 0], sz = num(o, "size", 0.14);
        return w.entity(common(o, { type: type, cls: "kinematic", color: o.color || color, shapes: [{ pos: [0, sz / 2, 0], size: [sz * 1.6, sz, sz], block: false }], affords: ["take"], tags: ["item", kind].concat(o.tags || []),
          state: { holder: 0, px: p[0], py: p[1], pz: p[2], key: num(o, "key", dflt_key), weight: num(o, "weight", 1) }, blocks: [{ name: "item", params: {} }] }));
      };
    };
    T("item", item("item", "item", 0, [0.8, 0.8, 0.8]));
    T("key", item("key", "key", 1, [0.95, 0.8, 0.2]));
    T("tool", item("tool", "tool", 0, [0.55, 0.6, 0.65]));
    T("parcel", item("parcel", "parcel", 0, [0.75, 0.55, 0.35]));

    // ---- holdables: a grip transform and a collision layer, so a weapon bound to a hand does not hit its holder. grip.pos / grip.rot: where the hand is on the body, in the body's frame
    const weapon = function (type, len, thick, grip_at, kind, damage) {
      return function (w, o) {
        return w.entity(common(o, { type: type, cls: "dynamic", mass: num(o, "mass", 1.5), layer: "holdable", shapes: [{ pos: [0, thick / 2, 0], size: [thick, thick, len] }], affords: ["grab", "wield"], tags: ["weapon", kind],
          hold: { grip: { pos: [0, 0, grip_at], rot: [0, 0, 0] }, layer: "held", kind: kind, damage: num(o, "damage", damage), reach: len, style: type === "rifle" ? "long" : "tool" } }));
      };
    };
    T("sword", weapon("sword", 0.95, 0.06, -0.3, "melee", 20));
    T("rifle", weapon("rifle", 1.0, 0.08, -0.1, "ranged", 35));

    // ---- sittables: a slot a seat
    T("chair", function (w, o) {
      return w.entity(common(o, { type: "chair", shapes: [{ pos: [0, 0.225, 0], size: [0.45, 0.45, 0.45] }, { pos: [0, 0.7, -0.2], size: [0.45, 0.5, 0.06] }], slots: [seat("seat", 0, 0, 0.45, 0, o.approach)], tags: ["furniture"] }));
    });
    T("stool", function (w, o) {
      return w.entity(common(o, { type: "stool", shapes: [{ pos: [0, 0.2, 0], size: [0.35, 0.4, 0.35] }], slots: [seat("seat", 0, 0, 0.4, 0, o.approach)], tags: ["furniture"] }));
    });
    const long_seat = function (type, seats, seat_w, depth, h) {
      return function (w, o) {
        const n = num(o, "seats", seats), len = n * seat_w, slots = [];
        for (let i = 0; i < n; i++) slots.push(seat("seat" + i, -len / 2 + (i + 0.5) * seat_w, 0, h, 0, o.approach));
        const shapes = [{ pos: [0, h / 2, 0], size: [len, h, depth] }];
        if (type === "sofa") shapes.push({ pos: [0, h + 0.2, -depth / 2 + 0.1], size: [len, 0.45, 0.2] }, { pos: [-len / 2 + 0.1, h + 0.1, 0], size: [0.2, 0.25, depth] }, { pos: [len / 2 - 0.1, h + 0.1, 0], size: [0.2, 0.25, depth] });
        return w.entity(common(o, { type: type, shapes: shapes, slots: slots, tags: ["furniture"] }));
      };
    };
    T("bench", long_seat("bench", 3, 0.5, 0.4, 0.45));
    T("sofa", long_seat("sofa", 3, 0.7, 0.9, 0.42));

    // ---- sleepables: a lie-down transform (the pose's place is the middle of the mattress, its yaw the head's way)
    T("bed", function (w, o) {
      const wd = num(o, "width", 1.0), len = num(o, "length", 2.0);
      return w.entity(common(o, { type: "bed", shapes: [{ pos: [0, 0.25, 0], size: [wd, 0.5, len] }, { pos: [0, 0.6, -len / 2 + 0.05], size: [wd, 0.5, 0.1] }],
        slots: [{ id: "sleep", kind: "sleep", pos: [0, 0.55, 0.05], yaw: 0, radius: 0.8, stand: [wd / 2 + 0.55, 0, 0.2], tags: ["bed"] }, { id: "edge", kind: "sit", pos: [wd / 2 - 0.1, 0.5, 0.6], yaw: -Math.PI / 2, radius: 0.5, stand: [wd / 2 + 0.5, 0, 0.6] }], tags: ["furniture"] }));
    });

    // ---- surfaces: a grid of slots where items are placed and picked up
    const surface = function (type, w_, d_, h_, cols, rows, extra) {
      const e0 = extra || {};
      return function (w, o) {
        const wd = num(o, "width", w_), dp = num(o, "depth", d_), h = num(o, "height", h_), c = num(o, "cols", cols), r = num(o, "rows", rows), slots = [];
        for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) slots.push({ id: "p" + j + "_" + i, kind: "place", pos: [-wd / 2 + (i + 0.5) * wd / c, h, -dp / 2 + (j + 0.5) * dp / r], radius: 0.25, stand: [-wd / 2 + (i + 0.5) * wd / c, 0, dp / 2 + 0.55], exclusive: true });
        if (e0.eat) for (let i = 0; i < e0.eat; i++) { const x = -wd / 2 + (i + 0.5) * wd / e0.eat; slots.push({ id: "eat" + i, kind: "eat", pos: [x, h, dp / 2 - 0.1], yaw: Math.PI, radius: 0.4, stand: [x, 0, dp / 2 + 0.5], exclusive: true }); }
        const shapes = [{ pos: [0, h - 0.03, 0], size: [wd, 0.06, dp] }];
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { shapes.push({ pos: [s[0] * (wd / 2 - 0.05), (h - 0.06) / 2, s[1] * (dp / 2 - 0.05)], size: [0.06, h - 0.06, 0.06] }); });
        const e = extra || {};
        return w.entity(common(o, { type: type, shapes: e.solid ? [{ pos: [0, h / 2, 0], size: [wd, h, dp] }] : shapes, slots: slots.concat(e.use ? [{ id: "use", kind: "use", pos: [0, 0, dp / 2 + 0.5], stand: [0, 0, dp / 2 + 0.5], yaw: Math.PI, radius: 0.5 }] : []), tags: ["furniture", "surface"] }));
      };
    };
    T("table", surface("table", 1.4, 0.8, 0.75, 3, 2, { eat: 2 }));
    T("desk", surface("desk", 1.2, 0.6, 0.74, 2, 1, { use: true }));
    T("counter", surface("counter", 2.0, 0.6, 0.9, 4, 1, { solid: true, use: true }));
    T("shelf", function (w, o) {
      const wd = num(o, "width", 1.0), h = num(o, "height", 1.8), rows = num(o, "rows", 4), cols = num(o, "cols", 3), slots = [], shapes = [{ pos: [0, h / 2, -0.15], size: [wd, h, 0.03] }, { pos: [-wd / 2 + 0.015, h / 2, 0], size: [0.03, h, 0.35] }, { pos: [wd / 2 - 0.015, h / 2, 0], size: [0.03, h, 0.35] }];
      for (let j = 0; j < rows; j++) { const y = 0.15 + j * (h - 0.2) / rows; shapes.push({ pos: [0, y, 0], size: [wd, 0.03, 0.35] }); for (let i = 0; i < cols; i++) slots.push({ id: "r" + j + "_" + i, kind: "place", pos: [-wd / 2 + (i + 0.5) * wd / cols, y + 0.015, 0], radius: 0.18, stand: [-wd / 2 + (i + 0.5) * wd / cols, 0, 0.7] }); }
      return w.entity(common(o, { type: "shelf", shapes: shapes, slots: slots, tags: ["furniture", "surface"] }));
    });

    // ---- storage: opens and holds items; a creature without the key is refused by the container's own block
    const storage = function (type, w_, d_, h_, cap) {
      return function (w, o) {
        const wd = num(o, "width", w_), dp = num(o, "depth", d_), h = num(o, "height", h_);
        return w.entity(common(o, { type: type, shapes: [{ pos: [0, h / 2, 0], size: [wd, h, dp] }], affords: ["open", "close", "store", "take"], slots: [{ id: "front", kind: "store", pos: [0, h / 2, 0], radius: 0.4, stand: [0, 0, dp / 2 + 0.6], items: [] }],
          state: { open: 0, locked: o.locked || o.key !== undefined ? 1 : 0, key: o.key === undefined ? 0 : w.key(o.key), items: 0, capacity: num(o, "capacity", cap) }, blocks: [{ name: "container", params: { capacity: num(o, "capacity", cap) } }], tags: ["furniture", "storage"] }));
      };
    };
    T("cupboard", storage("cupboard", 0.9, 0.45, 1.0, 12));
    T("chest", storage("chest", 0.9, 0.5, 0.5, 20));
    T("wardrobe", storage("wardrobe", 1.1, 0.6, 2.0, 30));

    // ---- fixtures: a lamp that is on while its scene is occupied, a stove with a heat sensor, a rug that makes a zone, a curtain
    T("lamp", function (w, o) {
      const h = num(o, "height", 1.6);
      return w.entity(common(o, { type: "lamp", shapes: [{ pos: [0, h / 2, 0], size: [0.12, h, 0.12], block: false }], affords: ["switch"], slots: [{ id: "switch", kind: "use", pos: [0, 1.0, 0], radius: 0.6, stand: [0, 0, 0.6] }], state: { on: 0, intensity: num(o, "intensity", 1), light_y: h }, blocks: o.auto === false ? [] : [{ name: "lamp", params: { auto: true } }], tags: ["fixture", "light"] }));
    });
    T("stove", function (w, o) {
      return w.entity(common(o, { type: "stove", shapes: [{ pos: [0, 0.45, 0], size: [0.7, 0.9, 0.6] }], affords: ["use", "switch"], slots: [{ id: "use", kind: "use", pos: [0, 0.9, 0], radius: 0.5, stand: [0, 0, 0.7] }], state: { on: 0, heat: 0 }, blocks: [{ name: "heat", params: { radius: num(o, "radius", 1.2) } }], tags: ["fixture", "hot"] }));
    });
    T("rug", function (w, o) {
      const wd = num(o, "width", 2.5), dp = num(o, "depth", 1.8), p = o.pos || [0, 0, 0], name = o.name || "rug";
      w.zone(name, { rect: [p[0] - wd / 2, p[2] - dp / 2, p[0] + wd / 2, p[2] + dp / 2], y: [p[1] - 0.1, p[1] + 2.5], tags: ["rug"], scene: o.scene });
      return w.entity(common(o, { type: "rug", name: name + "_rug", shapes: [{ pos: [0, 0.01, 0], size: [wd, 0.02, dp], block: false }], tags: ["fixture", "rug"] }));
    });
    T("curtain", function (w, o) {
      const wd = num(o, "width", 1.4), h = num(o, "height", 2.0);
      return w.entity(common(o, { type: "curtain", cls: "kinematic", shapes: [{ pos: [0, h / 2, 0], size: [wd, h, 0.05], block: false }], affords: ["open", "close"], state: { open: 0 }, blocks: [{ name: "curtain", params: { width: wd } }], tags: ["fixture"] }));
    });

    // ---- the physical elements: kinematic (moved by their block, never by forces, so they do not flop and jitter) over a static frame
    T("windmill", function (w, o) {
      const h = num(o, "height", 6), bl = num(o, "blade", 3.2);
      const tower = w.entity(common(o, { type: "windmill_tower", name: (o.name || "windmill") + "_tower", shapes: [{ pos: [0, h / 2, 0], size: [1.2, h, 1.2] }] }));
      const p = o.pos || [0, 0, 0], yaw = o.yaw || 0, hub = [p[0] + Math.sin(yaw) * 0.9, p[1] + h, p[2] + Math.cos(yaw) * 0.9];
      return w.entity({ type: "windmill", name: o.name || "windmill", cls: "kinematic", pos: hub, yaw: yaw, scene: o.scene, color: o.color, shapes: [{ pos: [0, 0, 0], size: [0.3, 0.3, 0.3], block: false }, { pos: [0, 0, 0], size: [0.2, bl * 2, 0.08], block: false }, { pos: [0, 0, 0], size: [bl * 2, 0.2, 0.08], block: false }],
        affords: [], state: { speed: 0 }, blocks: [{ name: "spin", params: { axis: "z", rate: num(o, "rate", 40), wind: true, tower: tower } }], tags: ["mechanism"] });
    });
    T("drawbridge", function (w, o) {
      const wd = num(o, "width", 2.5), len = num(o, "length", 4.0), p = o.pos || [0, 0, 0], yaw = o.yaw || 0, raised = !!o.raised, at = function (d) { return [p[0] + Math.sin(yaw) * d, p[1], p[2] + Math.cos(yaw) * d]; };
      const shapes = [{ pos: [0, 0.1, len / 2], size: [wd, 0.2, len], walk: false, block: false }], blocks = [{ name: "bridge", params: { length: len, raise_deg: 80, trigger: o.trigger || "", keep: o.keep === undefined ? 0 : o.keep } }];
      if (!o.span) return w.entity(common(o, { type: "drawbridge", cls: "kinematic", shapes: shapes, affords: ["raise", "lower"], state: { angle: 0, raised: 0 }, blocks: blocks, tags: ["mechanism"] }));          // (a leaf that rises and lowers: the nav does not know it)
      // `span: true` makes it part of the NAVIGATION: a deck of the length of the leaf (a virtual box: the leaf, a kinematic body, is the physical floor while it lies down; the nav has the deck, and rails along its sides) and a gate at each end of
      // it, open while the leaf is down. A creature at a closed gate asks the bridge to lower (the verb `open`). Put it over a gap (a ditch: ground below the span, with the banks higher; where there is ground under it the nav has two floors). `raised: true`
      // begins it up; `keep` seconds after the last creature has gone it is raised again (0: it stays down, and follows the trigger zone).
      const mid = at(len / 2), up = function (v) { return [v[0], v[1] + 0.2, v[2]]; }, side = wd / 2 + 0.05;
      w.box({ pos: [mid[0], p[1] + 0.1, mid[2]], size: [wd, 0.2, len], yaw: yaw, walk: true, block: false, virtual: true, kind: "deck" });
      [-1, 1].forEach(function (s) { w.box({ pos: [mid[0] + Math.cos(yaw) * side * s, p[1] + 0.2 + 0.5, mid[2] - Math.sin(yaw) * side * s], size: [0.06, 1.0, len], yaw: yaw, walk: false, block: true, virtual: true, kind: "rail" }); });
      const g1 = w.gate({ pos: up(at(0.5)), yaw: yaw, width: wd, length: 1.0, open: !raised }), g2 = w.gate({ pos: up(at(len - 0.5)), yaw: yaw, width: wd, length: 1.0, open: !raised });
      return w.entity(common(o, { type: "drawbridge", cls: "kinematic", shapes: shapes, affords: ["raise", "lower", "open"], state: { angle: raised ? 1 : 0, raised: raised ? 1 : 0, open: raised ? 0 : 1, gate: g1, gate2: g2 }, blocks: blocks, tags: ["mechanism"] }));
    });
    T("plate", function (w, o) {                                                                           // a pressure plate: stepped on, it fires its block (a trap, a door, a spawner)
      const wd = num(o, "width", 1.0), p = o.pos || [0, 0, 0], name = o.name || "plate";
      w.zone(name, { rect: [p[0] - wd / 2, p[2] - wd / 2, p[0] + wd / 2, p[2] + wd / 2], y: [p[1] - 0.2, p[1] + 1.0], tags: ["plate"], scene: o.scene });
      return w.entity(common(o, { type: "plate", name: name + "_plate", shapes: [{ pos: [0, 0.015, 0], size: [wd, 0.03, wd], block: false }], state: { pressed: 0 }, blocks: [{ name: "plate", params: { zone: name, fires: o.fires || "" } }], tags: ["trap"] }));
    });

    // ---- BUILDINGS: storeys of rooms, the stairs between them and the furniture, from one call.
    //   w.building("manor", {
    //     rect: [x0, z0, x1, z1],                                 the footprint: the middle lines of its outer walls
    //     storeys: [ { h: 2.6, rooms: [ { name, rect: [x0, z0, x1, z1], style: "living" | function (F) {...} | false, doors: [{ side, at, width, name, hinge }], openings: [...] }, ... ] }, ... ],     from the ground up
    //     links: [ { a: "hall", b: "kitchen", at: 1.5, width: 1.0 } ],      a door in the wall two rooms of a storey SHARE (the wall is built once, by the room whose edge is the longer: a corridor with a row of rooms along it; `at` from the start of the shorter edge, the middle when it is left out)
    //     stairs: [ { from: [x, z], yaw: 0, width: 1.2 } ],       one for each two storeys (leave a metre behind the foot, and a metre and a half where it arrives): the foot of the flight on the storey below, its way (a yaw turns about y, the flight climbs along (sin yaw, cos yaw)); the stairwell is cut in the
    //                                                             floor above (rails round it but where the flight arrives), and nothing is put where the flight stands or arrives
    //     scene: "manor"                                          the scenes are manor_0, manor_1 ... (one a storey: they sleep when nobody is there)
    //     roof: "gable" | "hip" | "flat" | { kind, overhang, ridge: "x" | "z", step_h, run, color }      a ceiling over the top storey and a ROOF over it, made of boxes (a stepped one: the host's boxes turn about y only): a gable (a ridge along the longer side), a hip
    //                                                             (a ridge shorter than the house) or a flat one with a parapet. Nothing walks on it, and a cutaway (host.cut, the sandbox's levels) takes it off
    //   })
    //   -> { name, storeys: [{ y, h, rooms: { name: room } }], stairs: [{ from, top, rect }] }.  A storey is its rooms' height + 0.1 m of floor.
    // Furnishing is by STYLE (a room's `style`, or w.furnish(room, style, { doors: ["s"], scene })): bedroom, living, kitchen, dining, study, store, hall, tavern; w.style("name", function (F) { ... }) adds one. F places what a room of that
    // kind has against the walls that have no door, in the middle and in its corners; what would stand where a door opens or a flight stands is left out (w.warn says which). F.wall(type, side, along 0..1, o), F.corner(type, "ne", o),
    // F.at(type, fx, fz, yaw, o), F.set(fx, fz, chairs, o) (a table with its chairs), F.back (the wall that has no door, the farthest from it), F.sides (the other free walls), F.w / F.d (the room's size inside), F.add(type, x, z, yaw, o).
    const SIZE = { bed: [1.0, 2.0], sofa: [2.1, 0.9], table: [1.4, 0.8], desk: [1.2, 0.6], counter: [2.0, 0.6], stove: [0.7, 0.6], wardrobe: [1.1, 0.6], chest: [0.9, 0.5], cupboard: [0.9, 0.45], shelf: [1.0, 0.35], chair: [0.45, 0.45], stool: [0.35, 0.35],
      bench: [1.5, 0.4], lamp: [0.12, 0.12], barrel: [0.55, 0.55], crate: [0.5, 0.5], rug: [2.5, 1.8], pillar: [0.4, 0.4], curtain: [1.4, 0.05] };
    const OPPOSITE = { n: "s", s: "n", e: "w", w: "e" }, YAW_OF = { n: Math.PI, s: 0, e: -Math.PI / 2, w: Math.PI / 2 };
    const STYLES = {};
    w.style = function (sname, fn) { if (typeof fn !== "function") throw new Error("happy_world_kit: w.style(name, function (F) { ... })"); STYLES[sname] = fn; };
    const furnisher = function (room, sides_with_doors, keep, scene) {
      const reserved = [];
      const FRONT = { sofa: 0.8, bench: 0.7, table: 0.7, desk: 0.8, counter: 0.8, shelf: 0.7, cupboard: 0.8, chest: 0.8, wardrobe: 0.8, stove: 0.9, lamp: 0.9 };
      const strips = function (type, x, z, yaw, ex, ez) {                                                    // the rectangles in front of a piece (its +z, the way it faces) or beside a bed, where a body stands
        if (type === "bed") { const d = Math.abs(Math.sin(yaw)) > 0.5; return d ? [[x - ex, z - ez - 0.9, x + ex, z - ez], [x - ex, z + ez, x + ex, z + ez + 0.9]] : [[x - ex - 0.9, z - ez, x - ex, z + ez], [x + ex, z - ez, x + ex + 0.9, z + ez]]; }
        const d = FRONT[type];
        if (!d) return [];
        const c = Math.round(Math.cos(yaw)), sn = Math.round(Math.sin(yaw));
        if (c === 1) return [[x - ex, z + ez, x + ex, z + ez + d]];
        if (c === -1) return [[x - ex, z - ez - d, x + ex, z - ez]];
        return sn === 1 ? [[x + ex, z - ez, x + ex + d, z + ez]] : [[x - ex - d, z - ez, x - ex, z + ez]];
      };
      const placed = [];                                                                                      // (what the style has put already: a piece does not stand on another, and a lamp's place to stand in front of it is kept clear)
      const th = room.thick || 0.2, g = 0.06, x0 = room.x0 + th / 2 + g, x1 = room.x1 - th / 2 - g, z0 = room.z0 + th / 2 + g, z1 = room.z1 - th / 2 - g, counts = {};
      const F = { room: room, x0: x0, x1: x1, z0: z0, z1: z1, w: x1 - x0, d: z1 - z0, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, added: [] };
      const free = ["n", "e", "s", "w"].filter(function (s) { return sides_with_doors.indexOf(s) < 0; });
      F.back = (sides_with_doors.length && free.indexOf(OPPOSITE[sides_with_doors[0]]) >= 0) ? OPPOSITE[sides_with_doors[0]] : (free[0] || "n");
      F.sides = free.filter(function (s) { return s !== F.back; });
      F.add = function (type, x, z, yaw, o) {
        const sz = SIZE[type] || [0.6, 0.6], turned = Math.abs(Math.sin(yaw || 0)) > 0.5, ex = (turned ? sz[1] : sz[0]) / 2, ez = (turned ? sz[0] : sz[1]) / 2, n = counts[type] = (counts[type] || 0) + 1;
        if (type !== "rug" && (type === "bed" || FRONT[type])) {                                                // (the place a body stands to use it must be inside the room, a body's width from the walls: a piece that is beside a wall is moved along it, or left out)
          const lo = [room.x0 + th / 2 + 0.32, room.z0 + th / 2 + 0.32], hi = [room.x1 - th / 2 - 0.32, room.z1 - th / 2 - 0.32], along_x = Math.abs(Math.cos(yaw || 0)) > 0.5;
          for (let pass = 0; pass < 2; pass++) {
            let dx = 0, dz = 0;
            strips(type, x, z, yaw || 0, ex, ez).forEach(function (r) {                                              // (only the side of a strip that goes out beyond the piece: the side along the wall it stands against is the wall's)
              if (r[0] < x - ex - 1e-6 && r[0] < lo[0]) dx = Math.max(dx, lo[0] - r[0]); if (r[2] > x + ex + 1e-6 && r[2] > hi[0]) dx = Math.min(dx, hi[0] - r[2]);
              if (r[1] < z - ez - 1e-6 && r[1] < lo[1]) dz = Math.max(dz, lo[1] - r[1]); if (r[3] > z + ez + 1e-6 && r[3] > hi[1]) dz = Math.min(dz, hi[1] - r[3]);
            });
            if (!dx && !dz) break;
            if (along_x) { if (dz) return null; x += dx; } else { if (dx) return null; z += dz; }
            if (pass === 1) return null;
          }
        }                    // (the half sizes of the piece as it stands: a quarter turn swaps them)
        if (type === "rug" ? (x - ex < room.x0 + th / 2 || x + ex > room.x1 - th / 2 || z - ez < room.z0 + th / 2 || z + ez > room.z1 - th / 2) : (x - ex < room.x0 + th / 2 - 0.001 || x + ex > room.x1 - th / 2 + 0.001 || z - ez < room.z0 + th / 2 - 0.001 || z + ez > room.z1 - th / 2 + 0.001)) { w.warn("room `" + room.name + "`: a " + type + " does not fit"); return null; }
        const kx = type === "lamp" ? 0.95 : ex, kz = type === "lamp" ? 0.95 : ez;                                // (a lamp is switched from a place in front of it: that place is kept free of a flight too)
        if (type !== "rug" && keep.some(function (k) { return x + kx > k[0] && x - kx < k[2] && z + kz > k[1] && z - kz < k[3]; })) return null;                                                                          // (where a door opens or a flight stands: left out, nothing to say)
        if (type !== "rug" && placed.some(function (k) { return x + kx > k[0] + 0.02 && x - kx < k[2] - 0.02 && z + kz > k[1] + 0.02 && z - kz < k[3] - 0.02; })) return null;
        const mine = type === "rug" ? [] : strips(type, x, z, yaw || 0, ex, ez);                           // (the places a creature stands to use it: kept free of what comes after, and not on what is there already)
        if (type !== "rug" && reserved.some(function (k) { return x + ex > k[0] + 0.02 && x - ex < k[2] - 0.02 && z + ez > k[1] + 0.02 && z - ez < k[3] - 0.02; })) return null;
        if (mine.some(function (m) { return placed.some(function (k) { return m[2] > k[0] + 0.02 && m[0] < k[2] - 0.02 && m[3] > k[1] + 0.02 && m[1] < k[3] - 0.02; }); })) return null;
        if (type !== "rug") placed.push([x - ex, z - ez, x + ex, z + ez]);
        mine.forEach(function (m) { reserved.push(m); });
        const e = w.add(type, Object.assign({ pos: [x, room.y, z], yaw: yaw || 0, scene: scene, name: room.name + "_" + type + (n > 1 ? n : "") }, o || {}));
        F.added.push(type);
        return e;
      };
      F.wall = function (type, side, along, o) {
        const sz = SIZE[type] || [0.6, 0.6], hw = sz[0] / 2, dp = sz[1] / 2, f = Math.max(0, Math.min(1, along === undefined ? 0.5 : along));
        if (!OPPOSITE[side]) return null;
        if (side === "n") return F.add(type, x0 + hw + f * Math.max(0, F.w - 2 * hw), z1 - dp, Math.PI, o);
        if (side === "s") return F.add(type, x0 + hw + f * Math.max(0, F.w - 2 * hw), z0 + dp, 0, o);
        if (side === "e") return F.add(type, x1 - dp, z0 + hw + f * Math.max(0, F.d - 2 * hw), -Math.PI / 2, o);
        return F.add(type, x0 + dp, z0 + hw + f * Math.max(0, F.d - 2 * hw), Math.PI / 2, o);
      };
      F.corner = function (type, c, o) {
        const sz = SIZE[type] || [0.3, 0.3], hw = type === "lamp" ? 0.5 : sz[0] / 2, dp = type === "lamp" ? 0.5 : sz[1] / 2;                              // (a lamp is switched from in front of it: it stands a body's width from the corner)
        return F.add(type, c.indexOf("e") >= 0 ? x1 - hw : x0 + hw, c.indexOf("n") >= 0 ? z1 - dp : z0 + dp, c.indexOf("n") >= 0 ? Math.PI : 0, o);                // (it faces into the room: the way a lamp is switched from)
      };
      F.at = function (type, fx, fz, yaw, o) { return F.add(type, x0 + fx * F.w, z0 + fz * F.d, yaw, o); };
      F.set = function (fx, fz, chairs, o) {                                                                // a table with its chairs on the two long sides (and a third at the end that has none)
        const x = x0 + fx * F.w, z = z0 + fz * F.d, t = F.add("table", x, z, 0, o);
        if (!t) return null;
        F.add("chair", x - 1.3, z, Math.PI / 2, { approach: "right" }); F.add("chair", x + 1.3, z, -Math.PI / 2, { approach: "right" });
        return t;
      };
      F.free_side = function (i) { return F.sides[i === undefined ? 0 : i] || F.back; };
      return F;
    };
    const CORNER = { n: "ne", s: "se", e: "ne", w: "nw" };
    w.style("bedroom", function (F) { F.wall("bed", F.back, 0.2); F.wall("wardrobe", F.back, 0.9); F.wall("chest", F.free_side(0), 0.5); F.corner("lamp", CORNER[F.back]); F.at("rug", 0.5, 0.5, 0); });
    w.style("living", function (F) { F.wall("sofa", F.back, 0.5); F.wall("shelf", F.free_side(0), 0.5); F.wall("cupboard", F.free_side(1), 0.5); F.at("chair", 0.2, 0.5, Math.PI / 2, { approach: "right" }); F.corner("lamp", CORNER[F.back]); F.at("rug", 0.5, 0.45, 0); });
    w.style("kitchen", function (F) { F.wall("counter", F.back, 0.3); F.wall("stove", F.back, 0.85); F.wall("cupboard", F.free_side(0), 0.5); F.set(0.5, 0.45, 2); F.corner("lamp", CORNER[F.back]); });
    w.style("dining", function (F) { F.set(0.5, 0.5, 3); F.wall("shelf", F.back, 0.5); F.wall("bench", F.free_side(0), 0.5); F.corner("lamp", CORNER[F.back]); });
    w.style("study", function (F) { F.wall("desk", F.back, 0.5); const d = F.added.length ? 1 : 0; F.wall("chair", F.back, 0.85); F.wall("shelf", F.free_side(0), 0.3); F.wall("shelf", F.free_side(0), 0.8); F.wall("chest", F.free_side(1), 0.5); F.corner("lamp", CORNER[F.back]); });
    w.style("store", function (F) { F.wall("shelf", F.back, 0.2); F.wall("shelf", F.back, 0.8); F.wall("barrel", F.free_side(0), 0.2); F.wall("barrel", F.free_side(0), 0.35); F.wall("crate", F.free_side(1), 0.3); F.wall("crate", F.free_side(1), 0.5); F.at("crate", 0.5, 0.5, 0.4); });
    w.style("hall", function (F) { F.wall("bench", F.back, 0.2); F.wall("chest", F.back, 0.85); F.corner("lamp", CORNER[F.back]); F.at("rug", 0.5, 0.5, 0); });
    w.style("tavern", function (F) { F.wall("counter", F.back, 0.5); F.wall("barrel", F.back, 0.05); F.wall("barrel", F.back, 0.95); F.wall("shelf", F.free_side(0), 0.5); F.set(0.25, 0.45, 2); F.set(0.75, 0.45, 2); F.corner("lamp", CORNER[F.back]); });
    // w.furnish(room, style, { doors: ["s"], scene, keep: [[x0, z0, x1, z1]] }): the room w.room made, furnished by a style (a name, or a function (F))
    w.furnish = function (room, style, o) {
      o = o || {};
      const fn = typeof style === "function" ? style : STYLES[style];
      if (!fn) throw new Error("happy_world_kit: no furniture style `" + style + "` (" + Object.keys(STYLES).join(", ") + ")");
      const F = furnisher(room, o.doors || [], o.keep || [], o.scene);
      fn(F);
      return F;
    };

    const SLAB = 0.1, STEP_D = 0.28;
    const door_zone = function (q, side, at, width) {                                                       // the metre and a half in front of a door of the room q (the edge's own start)
      const wd = (width || 1.1) / 2 + 0.2, dep = 1.3;
      if (side === "s") return [q[0] + at - wd, q[1], q[0] + at + wd, q[1] + dep];
      if (side === "n") return [q[0] + at - wd, q[3] - dep, q[0] + at + wd, q[3]];
      if (side === "w") return [q[0], q[1] + at - wd, q[0] + dep, q[1] + at + wd];
      return [q[2] - dep, q[1] + at - wd, q[2], q[1] + at + wd];
    };
    w.building = function (bname, o) {
      if (!o || !Array.isArray(o.rect) || o.rect.length !== 4 || !Array.isArray(o.storeys) || !o.storeys.length) throw new Error("happy_world_kit: w.building(name, { rect: [x0, z0, x1, z1], storeys: [{ h, rooms: [...] }], links, stairs })");
      const R = o.rect, links = o.links || [], stair_specs = o.stairs || [], out = { name: bname, storeys: [], stairs: [] };
      if (o.storeys.length > 1 && stair_specs.length < o.storeys.length - 1) throw new Error("happy_world_kit: w.building `" + bname + "`: stairs is a list with one flight for each two storeys (" + (o.storeys.length - 1) + ")");
      let y = 0;
      const ys = o.storeys.map(function (s, k) { const here = y; y += (s.h || 2.6) + SLAB; return here; });
      // the flights: the foot, the run, its rectangle, the way it arrives (what is above and below it is left free of furniture)
      o.storeys.forEach(function (s, k) {
        if (k >= o.storeys.length - 1) return;
        const sp = stair_specs[k], yaw = sp.yaw || 0, width = sp.width || 1.2, rise = (s.h || 2.6) + SLAB, count = Math.round(rise / 0.18), sh = rise / count, run = count * STEP_D;
        const dx = Math.sin(yaw), dz = Math.cos(yaw), px = Math.cos(yaw), pz = -Math.sin(yaw), f = sp.from, ex = f[0] + dx * run, ez = f[1] + dz * run;
        const xs = [f[0] + px * width / 2, f[0] - px * width / 2, ex + px * width / 2, ex - px * width / 2], zs = [f[1] + pz * width / 2, f[1] - pz * width / 2, ez + pz * width / 2, ez - pz * width / 2];
        const rect = [Math.min.apply(null, xs), Math.min.apply(null, zs), Math.max.apply(null, xs), Math.max.apply(null, zs)];
        const arrive = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "e" : "w") : (dz > 0 ? "n" : "s");
        out.stairs.push({ from: [f[0], ys[k], f[1]], yaw: yaw, width: width, count: count, step_h: sh, rise: rise, rect: rect, arrive: arrive, top: [ex, ys[k] + rise, ez] });
      });
      o.storeys.forEach(function (s, k) {
        const h = s.h || 2.6, y0 = ys[k], scene = (o.scene || bname) + "_" + k, rooms = {}, names = [];
        // the doors of the rooms and the walls the links share
        const spec = {};
        (s.rooms || []).forEach(function (r) { spec[r.name] = { r: r, doors: (r.doors || []).map(function (d) { return Object.assign({}, d); }), walls: "nsew", sides: (r.doors || []).map(function (d) { return d.side; }), keep: (r.doors || []).map(function (d) { return door_zone(r.rect, d.side, d.at, d.width); }) }; });
        links.forEach(function (l) {
          const A = spec[l.a], B = spec[l.b];
          if (!A || !B) return;
          const a = A.r.rect, b = B.r.rect, eps = 0.01, door = { width: l.width || 1.0, name: l.name || (l.a + "_" + l.b + "_door"), hinge: l.hinge || "left" };
          if (l.height) door.height = l.height;
          let sa, sb, ea, eb;                                                                              // (the sides the rooms meet on, and the extents of their edges along the wall)
          if (Math.abs(a[2] - b[0]) < eps) { sa = "e"; sb = "w"; ea = [a[1], a[3]]; eb = [b[1], b[3]]; }
          else if (Math.abs(b[2] - a[0]) < eps) { sa = "w"; sb = "e"; ea = [a[1], a[3]]; eb = [b[1], b[3]]; }
          else if (Math.abs(a[3] - b[1]) < eps) { sa = "n"; sb = "s"; ea = [a[0], a[2]]; eb = [b[0], b[2]]; }
          else if (Math.abs(b[3] - a[1]) < eps) { sa = "s"; sb = "n"; ea = [a[0], a[2]]; eb = [b[0], b[2]]; }
          else throw new Error("happy_world_kit: w.building `" + bname + "`: the rooms `" + l.a + "` and `" + l.b + "` of storey " + k + " do not share a wall");
          // the wall is built by the room whose edge is the longer (or by a, when they are equal): the other leaves its own wall out; `at` is from the start of the SHORTER edge
          let host = A, other = B, hs = sa, os = sb, he = ea, oe = eb, hr = a, or = b;
          if (eb[1] - eb[0] > ea[1] - ea[0] + eps) { host = B; other = A; hs = sb; os = sa; he = eb; oe = ea; hr = b; or = a; }
          if (oe[0] < he[0] - eps || oe[1] > he[1] + eps) throw new Error("happy_world_kit: w.building `" + bname + "`: the rooms `" + l.a + "` and `" + l.b + "` share only a part of their walls: the edge of one is inside the edge of the other (or they are equal), or give each room a door of its own");
          const at_other = l.at === undefined ? (oe[1] - oe[0]) / 2 : l.at, at_host = (oe[0] - he[0]) + at_other;
          host.doors.push(Object.assign({ side: hs }, door, { at: at_host })); host.sides.push(hs); other.sides.push(os);
          host.keep.push(door_zone(hr, hs, at_host, door.width)); other.keep.push(door_zone(or, os, at_other, door.width));
          other.walls = other.walls.replace(os, "");
        });
        (s.rooms || []).forEach(function (r) {
          const sp = spec[r.name], q = r.rect;
          if (!Array.isArray(q) || q.length !== 4) throw new Error("happy_world_kit: w.building `" + bname + "`: the room `" + r.name + "` has a rect [x0, z0, x1, z1]");
          rooms[r.name] = Object.assign(w.room(r.name, { x0: q[0], z0: q[1], x1: q[2], z1: q[3], y: y0, h: h, thick: r.thick || o.thick, doors: sp.doors, openings: r.openings, scene: scene, walls: sp.walls, color: r.color }), { thick: r.thick || o.thick || 0.2 });
          names.push(r.name);
        });
        w.scene(scene, { zones: names, policy: s.policy || o.policy || "auto", mood: s.mood || o.mood || { light: 0.6, sound: "quiet" } });
        // the slab over this storey (the floor of the next), with the stairwell of the flight that climbs from here
        if (k < o.storeys.length - 1) {
          const st = out.stairs[k], a = st.rect, nx = o.storeys[k + 1], hole_rails = ["n", "e", "s", "w"].filter(function (c) { return c !== st.arrive; }).join("");
          w.floor({ x0: R[0] + 0.1, z0: R[1] + 0.1, x1: R[2] - 0.1, z1: R[3] - 0.1, y: ys[k + 1], holes: [{ rect: a, rails: hole_rails }] });
          const sc = stair_specs[k];
          w.stairs({ from: [st.from[0], st.from[1], st.from[2]], yaw: st.yaw, rise: st.rise, count: st.count, step_h: st.step_h, width: st.width, name: sc.name });
        }
        out.storeys.push({ y: y0, h: h, scene: scene, rooms: rooms, keep: names.reduce(function (o2, n) { o2[n] = spec[n].keep; return o2; }, {}), sides: names.reduce(function (o2, n) { o2[n] = spec[n].sides; return o2; }, {}) });
      });
      // the furniture, now that every flight is known: a flight's rectangle (and the run beyond where it arrives) is kept free on the storey it climbs from and on the one it arrives on
      o.storeys.forEach(function (s, k) {
        (s.rooms || []).forEach(function (r) {
          if (r.style === false || r.style === undefined) return;
          const room = out.storeys[k].rooms[r.name], keep = (out.storeys[k].keep[r.name] || []).slice(), sides = (out.storeys[k].sides[r.name] || []).slice();
          out.stairs.forEach(function (st, j) {
            if (j !== k && j !== k - 1) return;
            const a = st.rect, m = 0.5;
            keep.push([a[0] - m, a[1] - m, a[2] + m, a[3] + m]);
            if (j === k - 1) { const d = st.arrive; keep.push([a[0] - m - (d === "w" ? 1.2 : 0), a[1] - m - (d === "s" ? 1.2 : 0), a[2] + m + (d === "e" ? 1.2 : 0), a[3] + m + (d === "n" ? 1.2 : 0)]); }
          });
          w.furnish(room, r.style, { doors: sides, keep: keep, scene: out.storeys[k].scene });
        });
      });
      if (o.roof) {                                                                                        // the ceiling of the top storey and the roof over it
        const ro = typeof o.roof === "string" ? { kind: o.roof } : o.roof, kind = ro.kind || "gable", over = ro.overhang === undefined ? 0.4 : ro.overhang, step_h = ro.step_h || 0.3, run = ro.run || 0.8, col = ro.color || [0.56, 0.3, 0.24];
        const last = o.storeys.length - 1, y_top = ys[last] + (o.storeys[last].h || 2.6), base = y_top + SLAB, cx = (R[0] + R[2]) / 2, cz = (R[1] + R[3]) / 2, W = R[2] - R[0] + 2 * over, D = R[3] - R[1] + 2 * over;
        if (["gable", "hip", "flat"].indexOf(kind) < 0) throw new Error("happy_world_kit: w.building `" + bname + "`: roof is gable, hip or flat");
        w.box({ pos: [cx, y_top + SLAB / 2, cz], size: [R[2] - R[0], SLAB, R[3] - R[1]], walk: false, kind: "roof", color: col });
        if (kind === "flat") {
          [[R[0], R[1], R[2], R[1]], [R[2], R[1], R[2], R[3]], [R[2], R[3], R[0], R[3]], [R[0], R[3], R[0], R[1]]].forEach(function (e) { w.wall({ from: [e[0], e[1]], to: [e[2], e[3]], y: base, h: ro.parapet || 0.8, thick: 0.3, color: col }); });
        } else if (kind === "gable") {
          const ridge = ro.ridge || (W >= D ? "x" : "z"), across = ridge === "x" ? D : W, length = ridge === "x" ? W : D, n = Math.max(2, Math.ceil(across / 2 / run));
          for (let i = 0; i < n; i++) { const a = across * (n - i) / n; w.box({ pos: [cx, base + step_h * (i + 0.5), cz], size: ridge === "x" ? [length, step_h, a] : [a, step_h, length], walk: false, kind: "roof", color: col }); }
        } else {
          for (let i = 0; ; i++) { const sx = W - 2 * run * i, sz = D - 2 * run * i; if (Math.min(sx, sz) < 0.5) break; w.box({ pos: [cx, base + step_h * (i + 0.5), cz], size: [sx, step_h, sz], walk: false, kind: "roof", color: col }); }
        }
        out.roof = { kind: kind, y: base };
      }
      return out;
    };
  }
  return { install: install };
});

// ========================================================================================================================
// world_items
// ========================================================================================================================
packing()("happy_world_items", function happy_world_items() {
  "use strict";
  // HAPPY WORLD ITEMS: a world built of SDF pieces (SYSTEM.md section 12). A world file DECLARES an item once, as an sdf, and PLACES it as many times as it likes:
  //     w.item("chair", { sdf: { cell: 0.02, parts: [ { id: "seat", shape: "box", center: [0, 0.43, 0], half: [0.22, 0.025, 0.22], round: 0.01, color: [0.6, 0.4, 0.25, 1] }, ... ] },
  //                       seats: { seat: { at: [0, 0.45, 0], approach: "front" } } });
  //     w.place("chair", { pos: [1, 0, 2], yaw: Math.PI, name: "chair_a" });      w.row("pillar", { from: [0, 0, 0], to: [10, 0, 0], step: 2.5 });
  // The sdf is the mesher's def (the creature library's grammar, SYSTEM.md) in the ITEM's frame: the origin is on the floor under the middle of the piece, +z is the way it faces, +x its left, y up. What the world makes of it:
  //   THE LOOK     the host makes ONE STATIC MESH of the item (system.species(def, { static: true }): a skeleton of one bone, the sdf meshed once; not a family of the worker, the page keeps its rows) and ONE INSTANCE for every placement: the mesh is made once and drawn in one instanced call, however many times it is placed.
  //   THE PHYSICS  a STATIC body for every placement (the instances have none): the item's PROXY, boxes in its frame, made from the sdf itself (derive_proxy): a `box` part is its own box, a sphere / capsule / cylinder / loft / torus the
  //                box round it, a `subtract` part with a box cuts the boxes made before it (a doorway through a wall piece, a window), so the collision has the holes of the look. `collide: false` on a part leaves it out (a cushion, a picture),
  //                `collide: "walk"` makes its box a walkable surface for the navigation (a floor slab, a platform), `collide: "cut"` lets a non-box subtract part cut by its box, `collide: "slices"` (a sphere or ellipsoid, a rock: `slices: 4`) makes a few boxes stacked that follow its silhouette instead of the one box round it. `proxy: [{ pos, size, walk, block }]` says them by hand instead
  //                (`proxy: false`: no collision at all). The navigation is baked from these boxes, as for every world: an item is a prop, a floor or a wall to it, by what its proxy says.
  //   THE SEATS    `seats: { name: { at: [x, y, z] (the point of the cushion's SURFACE, item frame), yaw (the way a body faces sitting, 0: the item's front), approach: "front" | "back" | "left" | "right" | [x, y, z] (the item's frame: where a body
  //                stands before it sits down), stand: [x, y, z] (instead of approach), reach: 0.7 (how far the approach is), lift: metres (how far the hips ride over the surface: by default the creature's own, by its body), repeat: { count, step: [dx, dy, dz] } } }`.
  //                A seat is a SLOT of kind `sit` with `seat: { anchor: true }`: any creature may use it, by the `use` block: it walks to the approach point, turns, sits down (the native seat: species.js `sp.sit`) and its hips are then
  //                fixed to the anchor with its gait off; `w.seat_at({ pos, yaw })` is a seat with no piece (a log, a curb, the ground).
  // The scene's pieces that MOVE (a door's leaf, a sail) are items of class `kinematic` that a world block drives (w.door({ look: "oak_door" })); the host moves the instance with the body.
  // Node 14: no optional chaining, no ??.
  const fail = function (where, text) { throw new Error("happy_world_items: " + where + ": " + text); };
  const finite = function (v) { return typeof v === "number" && isFinite(v); };
  const known = function (where, o, keys) { if (!o || typeof o !== "object" || Array.isArray(o)) fail(where, "options are an object { " + keys.slice(0, 4).join(", ") + " ... }"); for (const k in o) if (keys.indexOf(k) < 0) fail(where, "`" + k + "` is not an option (" + keys.join(", ") + ")"); };
  const vec3 = function (where, k, v) { if (!Array.isArray(v) || v.length !== 3 || !v.every(finite)) fail(where, k + " is [x, y, z] (numbers)"); return v.slice(); };
  const BONE = "root";
  const ITEM_KEYS = ["sdf", "proxy", "cls", "mass", "seats", "slots", "affords", "state", "blocks", "tags", "hold", "layer", "color"];
  const PLACE_KEYS = ["pos", "yaw", "scale", "name", "scene", "color", "state", "mass", "blocks", "affords", "tags", "cls", "approach"];
  const SEAT_KEYS = ["at", "yaw", "approach", "stand", "reach", "lift", "repeat", "radius", "tags"];
  const APPROACH = { front: [0, 1], back: [0, -1], left: [1, 0], right: [-1, 0] };
  const MIN_SIDE = 0.01;                                                                                   // (a piece of a cut that is thinner than this is not made)

  // ---- the proxy: boxes from the parts of an sdf ----------------------------------------------------------------------------------------------------------
  const axis_of = function (a, where) {
    if (a === undefined || a === null) return [0, 1, 0];
    if (a === "x") return [1, 0, 0]; if (a === "y") return [0, 1, 0]; if (a === "z") return [0, 0, 1];
    if (!Array.isArray(a) || a.length !== 3 || !a.every(finite)) fail(where, "axis is \"x\", \"y\", \"z\" or [x, y, z]");
    const l = Math.hypot(a[0], a[1], a[2]);
    if (!(l > 1e-9)) fail(where, "axis is not an axis");
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const grow = function (b, p, r) { for (let i = 0; i < 3; i++) { if (p[i] - r[i] < b.lo[i]) b.lo[i] = p[i] - r[i]; if (p[i] + r[i] > b.hi[i]) b.hi[i] = p[i] + r[i]; } };
  // the box round one part, in the item's frame, before its mirror: { lo, hi } | null (a shape the proxy cannot know)
  function part_box(p, where) {
    const b = { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] }, s = p.shape;
    const R = function (r) { return [r, r, r]; };
    if (s === "box") { const c = vec3(where, "center", p.center), h = vec3(where, "half", p.half); grow(b, c, h); }
    else if (s === "sphere") grow(b, vec3(where, "center", p.center), R(p.radius));
    else if (s === "ellipsoid") grow(b, vec3(where, "center", p.center), vec3(where, "radii", p.radii));
    else if (s === "capsule" || s === "round_cone") {
      const a = vec3(where, "a", p.a), c = vec3(where, "b", p.b), ra = p.ra !== undefined ? p.ra : p.radius, rb = p.rb !== undefined ? p.rb : (p.radius !== undefined ? p.radius : ra);
      grow(b, a, R(ra)); grow(b, c, R(rb));
    } else if (s === "chain" || s === "loft") {
      if (!Array.isArray(p.points) || !p.points.length) fail(where, "points is a list of [x, y, z]");
      const rs = p.radii !== undefined ? p.radii : p.radius, rv = p.radii_v !== undefined ? p.radii_v : rs;
      const at = function (v, i) { return Array.isArray(v) ? (v[Math.min(i, v.length - 1)] || 0) : (v || 0); };
      p.points.forEach(function (q, i) { grow(b, vec3(where, "points[" + i + "]", q), [at(rs, i), Math.max(at(rs, i), at(rv, i)), at(rs, i)]); });
    } else if (s === "cylinder") {
      const c = vec3(where, "center", p.center), a = axis_of(p.axis, where), h = p.half !== undefined ? p.half : (p.height !== undefined ? p.height / 2 : 0), r = p.radius;
      const e = [0, 1, 2].map(function (i) { return Math.abs(a[i]) * h + Math.sqrt(Math.max(0, 1 - a[i] * a[i])) * r; });
      grow(b, c, e);
    } else if (s === "torus") {
      const c = vec3(where, "center", p.center), a = axis_of(p.axis, where);
      grow(b, c, [0, 1, 2].map(function (i) { return Math.sqrt(Math.max(0, 1 - a[i] * a[i])) * p.radius + p.tube; }));
    } else return null;
    for (let i = 0; i < 3; i++) if (!finite(b.lo[i]) || !finite(b.hi[i])) fail(where, "the shape `" + s + "` has a number that is not finite");
    return b;
  }
  // the copies a mirror makes ("x", "y", "z" or "xz" ...): the box reflected about each axis named
  function mirrored(b, m) {
    let out = [b];
    for (let a = 0; a < 3; a++) {
      if (m.indexOf("xyz"[a]) < 0) continue;
      const next = [];
      out.forEach(function (q) {
        next.push(q);
        const r = { lo: q.lo.slice(), hi: q.hi.slice() };
        r.lo[a] = -q.hi[a]; r.hi[a] = -q.lo[a];
        if (Math.abs(r.lo[a] - q.lo[a]) > 1e-9 || Math.abs(r.hi[a] - q.hi[a]) > 1e-9) next.push(r);
      });
      out = next;
    }
    return out;
  }
  // `collide: "slices"` of a sphere or an ellipsoid (a rock): not the one box round it but `slices` (4) boxes stacked, each as wide as the shape is at the widest point of its slice, so the collision follows the silhouette
  // (a boulder is wide at its middle and narrow at its foot and its top: its box would stop a body a third of a radius short of it)
  function slices_of(p, where) {
    if (p.shape !== "sphere" && p.shape !== "ellipsoid") fail(where, "`collide: \"slices\"` is for a sphere or an ellipsoid");
    const c = vec3(where, "center", p.center), r = p.shape === "sphere" ? [p.radius, p.radius, p.radius] : vec3(where, "radii", p.radii), n = p.slices === undefined ? 4 : p.slices, out = [];
    if (!(n >= 1 && n <= 16) || n !== Math.floor(n)) fail(where, "slices is a whole number, 1 .. 16");
    for (let k = 0; k < n; k++) {
      const y0 = c[1] - r[1] + 2 * r[1] * k / n, y1 = y0 + 2 * r[1] / n, t = y0 <= c[1] && y1 >= c[1] ? 0 : Math.min(Math.abs(y0 - c[1]), Math.abs(y1 - c[1])), f = Math.sqrt(Math.max(0, 1 - (t / r[1]) * (t / r[1])));
      if (f < 0.05) continue;
      out.push({ lo: [c[0] - r[0] * f, y0, c[2] - r[2] * f], hi: [c[0] + r[0] * f, y1, c[2] + r[2] * f] });
    }
    return out;
  }
  // box minus box, both axis aligned: the pieces that are left (at most six)
  function box_minus(b, c) {
    for (let i = 0; i < 3; i++) if (c.hi[i] <= b.lo[i] + 1e-9 || c.lo[i] >= b.hi[i] - 1e-9) return [b];       // (they do not meet)
    const out = [], cur = { lo: b.lo.slice(), hi: b.hi.slice(), walk: b.walk, id: b.id };
    for (let a = 0; a < 3; a++) {
      if (c.lo[a] > cur.lo[a] + 1e-9) { const q = { lo: cur.lo.slice(), hi: cur.hi.slice(), walk: b.walk, id: b.id }; q.hi[a] = c.lo[a]; out.push(q); cur.lo[a] = c.lo[a]; }
      if (c.hi[a] < cur.hi[a] - 1e-9) { const q = { lo: cur.lo.slice(), hi: cur.hi.slice(), walk: b.walk, id: b.id }; q.lo[a] = c.hi[a]; out.push(q); cur.hi[a] = c.hi[a]; }
    }
    return out;
  }
  // derive_proxy(sdf, warn) -> [{ pos, size, walk, id }] in the item's frame (the origin on the floor). `warn(text)` hears what it could not do
  function derive_proxy(sdf, warn) {
    warn = warn || function () { };
    const parts = (sdf && sdf.parts) || [];
    let boxes = [];
    parts.forEach(function (p, pi) {
      const where = "part `" + (p.id || pi) + "`";
      if (p.enabled === false || p.collide === false) return;
      const op = p.op === undefined ? "union" : p.op;
      const b0 = part_box(p, where);
      if (!b0) { if (p.shape === "volume") warn(where + ": a volume has no box here: give the item a `proxy`"); else warn(where + ": the shape `" + p.shape + "` is not one the proxy knows"); return; }
      const base = p.collide === "slices" ? slices_of(p, where) : [b0];
      let list = base;
      if (typeof p.mirror === "string" && p.mirror) { list = []; base.forEach(function (q) { list = list.concat(mirrored(q, p.mirror)); }); }
      if (op === "union") { list.forEach(function (b) { boxes.push({ lo: b.lo, hi: b.hi, walk: p.collide === "walk", id: p.id || ("p" + pi) }); }); return; }
      if (op === "subtract") {
        if (p.shape !== "box" && p.collide !== "cut") return;                                                // (a round hole stays solid in the collision unless the part says it cuts by its box)
        list.forEach(function (c) { let next = []; boxes.forEach(function (b) { next = next.concat(box_minus(b, c)); }); boxes = next; });
        return;
      }
      warn(where + ": the op `" + op + "` is not used for the proxy");
    });
    const out = [];
    boxes.forEach(function (b) {
      const size = [b.hi[0] - b.lo[0], b.hi[1] - b.lo[1], b.hi[2] - b.lo[2]];
      if (size[0] < MIN_SIDE || size[1] < MIN_SIDE || size[2] < MIN_SIDE) return;
      out.push({ pos: [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2], size: size, walk: !!b.walk, id: b.id });
    });
    return out;
  }

  // ---- the look: the def a species is made from -------------------------------------------------------------------------------------------------------------
  // render_def(sdf) -> the mesher's def: every part on the item's one bone, the proxy's hints taken out, a cell and a decimation of its own when the item says none (a flat wall of a uniform grid is thousands of triangles)
  function render_def(sdf) {
    if (!sdf || !Array.isArray(sdf.parts) || !sdf.parts.length) fail("sdf", "{ cell, parts: [ { id, shape, ... } ] }: the mesher's def (SYSTEM.md)");
    const d = JSON.parse(JSON.stringify(sdf));
    d.parts.forEach(function (p) { if (p.bone === undefined) p.bone = BONE; delete p.collide; delete p.slices; });
    if (d.cell === undefined) d.cell = 0.03;
    if (d.decimate === undefined && d.adaptive === undefined) d.decimate = { ratio: 0.1, error: d.cell * 0.3, max_edge: 1.0 };
    return d;
  }
  // species_def(name, sdf, max) -> what system.species takes: one bone, the item's sdf on it, room for `max` placements
  function species_def(name, sdf, max) {
    return { name: "item_" + name, max_instances: Math.max(1, max | 0), skeleton: [{ name: BONE, head: [0, 0, 0], tail: [0, 0.1, 0] }], sdf: render_def(sdf) };
  }

  // ---- small part makers for a world file: w.parts.box("seat", [cx, cy, cz], [hx, hy, hz], color, { round: 0.01 }) ----------------------------------------------------
  const maker = function (shape, make) {
    return function (id, a, b, color, extra) {
      const p = make(id, a, b);
      p.id = id; p.shape = shape;
      if (color) p.color = color;
      if (extra) for (const k in extra) p[k] = extra[k];
      return p;
    };
  };
  const PARTS = {
    box: maker("box", function (id, c, h) { return { center: c, half: h }; }),
    sphere: maker("sphere", function (id, c, r) { return { center: c, radius: r }; }),
    ellipsoid: maker("ellipsoid", function (id, c, r) { return { center: c, radii: r }; }),                                              // (centre, [rx, ry, rz]: a rock is a few of them blended)
    cylinder: maker("cylinder", function (id, c, rh) { return { center: c, axis: "y", radius: rh[0], half: rh[1] }; }),                  // (upright: [radius, half height])
    capsule: maker("capsule", function (id, a, bq) { return { a: a, b: bq[0], radius: bq[1] }; }),                                          // (from a to [b, radius])
    cut: function (id, c, h, extra) { const p = PARTS.box(id, c, h, null, extra); p.op = "subtract"; return p; }                           // (a box taken out of what is before it: a doorway, a window)
  };

  // ---- the builder ------------------------------------------------------------------------------------------------------------------------------------------
  function install(w) {
    const S = w.S, items = Object.create(null);
    w.items_out = {};                                                                                          // (name -> { sdf, max }: what the host makes species of; not in the spec: the workers do not need meshes)
    S.items = {};
    w.parts = PARTS;

    // the slots of an item's seats, in the item's frame (w.entity turns them by the yaw and moves them by the position)
    const seat_slots = function (name, seats) {
      const slots = [];
      Object.keys(seats || {}).forEach(function (sn) {
        const sd = seats[sn], where = "w.item `" + name + "` seats." + sn;
        known(where, sd, SEAT_KEYS);
        const at = vec3(where, "at", sd.at), yaw = sd.yaw === undefined ? 0 : sd.yaw, reach = sd.reach === undefined ? 0.7 : sd.reach;
        if (!finite(yaw)) fail(where, "yaw is radians");
        if (!(reach >= 0.2 && reach <= 3)) fail(where, "reach is 0.2 .. 3 metres");
        if (sd.lift !== undefined && !(finite(sd.lift) && sd.lift >= 0 && sd.lift <= 1)) fail(where, "lift is 0 .. 1 metres");
        let rep = [[0, 0, 0]], n = 1;
        if (sd.repeat !== undefined) {
          known(where + " repeat", sd.repeat, ["count", "step"]);
          n = sd.repeat.count;
          if (!(n >= 1 && n <= 32) || n !== Math.floor(n)) fail(where, "repeat.count is a whole number, 1 .. 32");
          const st = vec3(where + " repeat", "step", sd.repeat.step);
          rep = []; for (let i = 0; i < n; i++) rep.push([(i - (n - 1) / 2) * st[0], (i - (n - 1) / 2) * st[1], (i - (n - 1) / 2) * st[2]]);
        }
        for (let i = 0; i < n; i++) {
          const p = [at[0] + rep[i][0], at[1] + rep[i][1], at[2] + rep[i][2]];
          let stand;
          if (sd.stand !== undefined) { const s0 = vec3(where, "stand", sd.stand); stand = [s0[0] + rep[i][0], s0[1], s0[2] + rep[i][2]]; }
          else {
            let dir;                                                                                           // (the way the body comes from: x, z of the item's frame)
            if (Array.isArray(sd.approach)) { const a = vec3(where, "approach", sd.approach); dir = [a[0], a[2]]; }
            else dir = APPROACH[sd.approach === undefined ? "front" : sd.approach];
            if (!dir) fail(where, "approach is front, back, left, right or [x, y, z] (" + sd.approach + ")");
            const l = Math.hypot(dir[0], dir[1]) || 1;
            stand = [p[0] + dir[0] / l * reach, 0, p[2] + dir[1] / l * reach];
          }
          slots.push({ id: n > 1 ? sn + i : sn, kind: "sit", pos: p, yaw: yaw, radius: sd.radius === undefined ? 0.5 : sd.radius, stand: stand, tags: (sd.tags || []).concat(["seat"]), seat: { anchor: true, lift: sd.lift === undefined ? -1 : sd.lift } });
        }
      });
      return slots;
    };

    // w.item(name, { sdf, proxy, cls, seats, ... }): the piece, declared
    w.item = function (name, o) {
      if (typeof name !== "string" || !/^[a-z][a-z0-9_]*$/.test(name)) fail("w.item", "the name is lower case letters, digits and _");
      if (items[name]) fail("w.item", "the item `" + name + "` exists");
      known("w.item " + name, o, ITEM_KEYS);
      const cls = o.cls || "static";
      if (["static", "dynamic", "kinematic"].indexOf(cls) < 0) fail("w.item " + name, "cls is static, dynamic or kinematic");
      let proxy;
      if (o.proxy === false) proxy = [];
      else if (Array.isArray(o.proxy)) proxy = o.proxy.map(function (s, i) { known("w.item " + name + " proxy[" + i + "]", s, ["pos", "size", "walk", "block", "yaw"]); return { pos: vec3("w.item " + name + " proxy[" + i + "]", "pos", s.pos), size: vec3("w.item " + name + " proxy[" + i + "]", "size", s.size), walk: !!s.walk, block: s.block, yaw: s.yaw || 0 }; });
      else if (o.proxy === undefined || o.proxy === "auto") {
        if (!o.sdf) proxy = [];
        else proxy = derive_proxy(o.sdf, function (t) { w.warn("w.item `" + name + "`: " + t); });
      } else fail("w.item " + name, "proxy is \"auto\", false or a list of boxes { pos, size, walk, block }");
      if (o.sdf) render_def(o.sdf);                                                                          // (checked now: a mistake is thrown with the item's name by the world file's own line)
      const slots = (o.slots || []).concat(seat_slots(name, o.seats));
      items[name] = { name: name, def: o, cls: cls, proxy: proxy, slots: slots, seats: Object.keys(o.seats || {}) };
      S.items[name] = { name: name, boxes: proxy.length, seats: slots.filter(function (s) { return s.seat; }).length, look: !!o.sdf };
      w.items_out[name] = { sdf: o.sdf ? JSON.parse(JSON.stringify(o.sdf)) : null, count: 0 };
      return name;
    };

    // w.place(name, { pos, yaw, scale, name, scene, ... }) -> the entity's id: one more of an item
    w.place = function (name, o) {
      const it = items[name];
      if (!it) fail("w.place", "no item `" + name + "` (w.item declares it first; the items are " + (Object.keys(items).join(", ") || "none") + ")");
      o = o || {};
      known("w.place " + name, o, PLACE_KEYS);
      const sc = o.scale === undefined ? 1 : o.scale;
      if (!(finite(sc) && sc > 0.05 && sc < 20)) fail("w.place " + name, "scale is a number, 0.05 .. 20");
      const k = function (v) { return [v[0] * sc, v[1] * sc, v[2] * sc]; };
      let shapes = it.proxy.map(function (s) { return { pos: k(s.pos), size: k(s.size), yaw: s.yaw, walk: s.walk, block: s.block }; });
      if (!shapes.length) shapes = [{ pos: [0, 0.05 * sc, 0], size: [0.1 * sc, 0.1 * sc, 0.1 * sc], block: false, kind: "hidden" }];             // (a piece with no collision still is an entity: a body that blocks nothing)
      let from = it.slots;
      if (o.approach !== undefined) {                                                                          // (this placement is come at from another side: a chair tucked under a table, a seat against a wall)
        const over = {}; Object.keys(it.def.seats || {}).forEach(function (sn) { const c0 = Object.assign({}, it.def.seats[sn]); c0.approach = o.approach; delete c0.stand; over[sn] = c0; });
        from = (it.def.slots || []).concat(seat_slots(name, over));
      }
      const slots = from.map(function (s) {
        const c = JSON.parse(JSON.stringify(s));
        c.pos = k(s.pos); if (s.stand) c.stand = [s.stand[0] * sc, s.stand[1], s.stand[2] * sc];
        if (c.seat && c.seat.lift >= 0) c.seat.lift *= sc;
        return c;
      });
      const e = it.def;
      const id = w.entity({ type: name, name: o.name, cls: o.cls || it.cls, pos: o.pos || [0, 0, 0], yaw: o.yaw || 0, shapes: shapes, mass: o.mass !== undefined ? o.mass : e.mass, layer: e.layer, color: o.color || e.color, affords: (e.affords || []).concat(o.affords || []),
        slots: slots, blocks: (e.blocks || []).concat(o.blocks || []), state: Object.assign({}, e.state || {}, o.state || {}), hold: e.hold, scene: o.scene, tags: (e.tags || []).concat(o.tags || []), look: e.sdf ? name : undefined, scale: sc });
      return id;
    };

    // w.row(name, { from, to, step | count, yaw, ...the options of w.place }) -> [ids]: pillars along a line, lamps along a street
    w.row = function (name, o) {
      o = o || {};
      const rest = {}; for (const kk in o) if (["from", "to", "step", "count", "face"].indexOf(kk) < 0) rest[kk] = o[kk];
      const a = vec3("w.row", "from", o.from), b = vec3("w.row", "to", o.to), len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      let n = o.count;
      if (n === undefined) { if (!(o.step > 0)) fail("w.row", "step (metres between two) or count"); n = Math.floor(len / o.step + 1e-9) + 1; }
      if (!(n >= 1 && n <= 4096) || n !== Math.floor(n)) fail("w.row", "count is a whole number, 1 .. 4096");
      const ids = [];
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1), q = Object.assign({}, rest);
        q.pos = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        if (o.face === "along" && len > 0) q.yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
        if (q.name !== undefined) q.name = q.name + i;
        ids.push(w.place(name, q));
      }
      return ids;
    };

    // w.seat_at({ pos, yaw, approach, reach, lift, name, scene }): a seat with no piece (a log, a curb, the ground): a sit slot on a body that blocks nothing
    w.seat_at = function (o) {
      known("w.seat_at", o, ["pos", "floor", "yaw", "approach", "stand", "reach", "lift", "name", "scene", "tags"]);
      const p0 = vec3("w.seat_at", "pos", o.pos), floor = o.floor === undefined ? 0 : o.floor;                  // (pos: the point sat on, its height; floor: the height of the ground under it, 0 unless it says)
      if (!finite(floor)) fail("w.seat_at", "floor is a height in metres");
      const pos = [p0[0], floor, p0[2]], sd = { at: [0, p0[1] - floor, 0] };
      ["yaw", "approach", "reach", "lift", "tags"].forEach(function (kk) { if (o[kk] !== undefined) sd[kk] = o[kk]; });
      if (o.stand !== undefined) sd.stand = vec3("w.seat_at", "stand", [o.stand[0] - pos[0], o.stand[1] - pos[1], o.stand[2] - pos[2]]);
      const slots = seat_slots("seat", { seat: sd });
      return w.entity({ type: "seat", name: o.name, cls: "static", pos: pos, yaw: 0, shapes: [{ pos: [0, 0.05, 0], size: [0.1, 0.1, 0.1], block: false, kind: "hidden" }], slots: slots, scene: o.scene });
    };
  }

  return { install: install, derive_proxy: derive_proxy, render_def: render_def, species_def: species_def, parts: PARTS, part_box: part_box, box_minus: box_minus };
});

// ========================================================================================================================
// world_blocks
// ========================================================================================================================
packing()("happy_world_blocks", function happy_world_blocks() {
  "use strict";
  // HAPPY WORLD BLOCKS: the generic blocks of the WORLD (SYSTEM.md): behaviour that belongs to the environment and acts on its own. Each is a def for world/world_runtime.js (sensors read the world, states hold
  // the conditions and actions, transitions decide what comes next; `verbs` are what a creature's interaction may ask of the entity the block is bound to). The kit's furniture and elements name them in their `blocks`:
  //   door      a leaf that opens when a creature comes (or is asked: open / close / lock / unlock), waits, closes; its gate in the nav follows          lamp      lit while its room is occupied; `switch` by hand holds it for a minute
  //   spin      a windmill's blades turn (the wind is a fact of the blackboard)          container   a cupboard, a chest: open / close / store / take, refuses when it is locked          curtain   open / close
  //   bridge    a drawbridge: raises when a zone is entered, lowers when it is empty          plate     a pressure plate: pressed while a creature stands on its zone, it fires an entity (verb `trigger`) or a fact
  //   heat      a stove: warms while it is on, smokes          trap   hurts the creatures near it when it is triggered (a plate's `fires`)          item   a key, a tool, a parcel: taken (`take`) and put down (`drop`), posed from its state
  // None of them knows a creature family. They meet creatures only through positions (c.near, c.occupied), the entity's state and the verbs.
  // Node 14: no optional chaining, no ??. Written in plain ES5 style.
  const PI = Math.PI;
  const rot = function (yaw, lx, lz) { const c = Math.cos(yaw), s = Math.sin(yaw); return [lx * c + lz * s, -lx * s + lz * c]; };

  // ---- door: the leaf swings about its hinge (or slides into the wall); the body is driven to the pose by velocity
  const door_pose = function (c, frac) {
    const P = c.P, e = c.e, w = P.width, yaw = e.yaw, base = e.spec.pos;
    if (P.hinge === "slide") {
      const o = rot(yaw, frac * w * 0.95, 0);
      c.pose(base[0] + o[0], base[1], base[2] + o[1], c.quat(0, 1, 0, yaw));
      return;
    }
    const sgn = P.hinge === "left" ? 1 : -1, phi = -sgn * frac * P.open_angle * PI / 180 * P.swing;
    const lx = -sgn * w / 2 + sgn * w / 2 * Math.cos(phi), lz = -sgn * w / 2 * Math.sin(phi), o = rot(yaw, lx, lz);
    c.pose(base[0] + o[0], base[1], base[2] + o[1], c.quat(0, 1, 0, yaw + phi));
  };
  const door = {
    name: "door", kind: "world", title: "Door",
    settle: function (c) { },
    params: { hinge: "left", width: 1.1, height: 2.1, open_angle: 100, swing: 1, gate: -1, radius: 1.5, speed: 140, hold: 3, auto: true, partner: "" },                    // (partner: the other leaf of a double door: what is asked of this one is asked of it too)
    init: function (c) { c.S.hold = 0; c.S.frac = c.get("angle"); door_pose(c, c.S.frac); },
    sensors: {
      want: function (c) { return c.S.hold > 0 || (c.P.auto && c.get("locked") === 0 && c.near(c.P.radius) > 0); }
    },
    tick: function (c, dt) { if (c.S.hold > 0) c.S.hold -= dt; },
    verbs: {
      open: function (c) { if (c.get("locked")) return false; c.S.hold = c.P.hold; if (c.P.partner) c.call(c.P.partner, "open"); },
      close: function (c) { c.S.hold = 0; c.S.shut = 1.5; if (c.P.partner) c.call(c.P.partner, "close"); },
      lock: function (c) { c.set("locked", 1); if (c.P.partner) c.call(c.P.partner, "lock"); },
      unlock: function (c) { c.set("locked", 0); if (c.P.partner) c.call(c.P.partner, "unlock"); }
    },
    start: function (c) { return c.get("open") ? "open" : "closed"; },
    states: {
      closed: {
        enter: function (c) { c.set("open", 0); c.S.frac = 0; c.set("angle", 0); door_pose(c, 0); },
        on: [{ when: function (c) { return c.s.want && !(c.S.shut > 0); }, to: "opening" }],
        tick: function (c, dt) { if (c.S.shut > 0) c.S.shut -= dt; }
      },
      opening: {
        enter: function (c) { c.effect("creak", c.e.pos[0], c.e.pos[1] + 1, c.e.pos[2], 0, 0, 0, 1); },
        tick: function (c, dt) {
          c.S.frac = Math.min(1, c.S.frac + dt * c.P.speed / c.P.open_angle);
          if (c.S.frac >= 0.5 && c.get("open") !== 1) c.set("open", 1);
          door_pose(c, c.S.frac);
        },
        on: [{ when: function (c) { return c.S.frac >= 1; }, to: "open" }]
      },
      open: {
        enter: function (c) { c.set("open", 1); c.set("angle", 1); },
        on: [{ when: function (c) { return !c.s.want && c.time_in("open") > 1.0; }, to: "closing" }]
      },
      closing: {
        tick: function (c, dt) {
          c.S.frac = Math.max(0, c.S.frac - dt * c.P.speed / c.P.open_angle);
          if (c.S.frac < 0.5 && c.get("open") !== 0) c.set("open", 0);
          door_pose(c, c.S.frac);
        },
        on: [{ when: function (c) { return c.S.frac <= 0; }, to: "closed" }, { when: function (c) { return c.s.want && !(c.S.shut > 0); }, to: "opening" }]
      }
    }
  };

  // ---- door_joint: a leaf on a HINGE. It never opens or closes by itself. It has an angle (degrees, either way from shut) and is moved by a HAND: the verb `open`, which a creature's walk asks of a shut door in its way, swings the leaf AWAY from
  // whoever asks, through its whole arc, until it rests flat against the wall (an upright open leaf would be a wall beside the doorway that the navigation does not know), and there it stays. It stops when a creature stands in its way (it never
  // knocks one over) and waits for it to go. The WORLD's AI is what closes it and locks it (`close`, `lock`,
  // `unlock`: a motor swings it to shut and a lock holds it). Its state says what the nav needs: `open` is 1 once it is more than `open_at` of the way open (the gate follows), `angle` how far (0 .. 1).
  const dist_to_leaf = function (px, pz, pvx, pvz, dx, dz, len) {                                           // (a point to the leaf's segment from its pivot (pvx, pvz) along (dx, dz), `len` long)
    let t = ((px - pvx) * dx + (pz - pvz) * dz);
    t = t < 0 ? 0 : t > len ? len : t;
    const ex = px - (pvx + dx * t), ez = pz - (pvz + dz * t);
    return Math.sqrt(ex * ex + ez * ez);
  };
  const door_joint = {
    name: "door_joint", kind: "world", title: "Door (a joint)",
    settle: function (c) { },
    params: { hinge: "left", width: 1.1, height: 2.1, open_angle: 165, swing: 1, gate: -1, partner: "", friction: 2.2, max_speed: 110, push: 100, close_speed: 45, body: 0.32, open_at: 0.45 },
    init: function (c) { c.S.phi = (c.get("angle") > 0.5 ? c.P.open_angle * 0.9 : 0); c.S.w = 0; c.S.motor = false; c.S.to = null; door_joint_pose(c); },
    verbs: {
      open: function (c, req) {                                                                              // (a hand pushes: away from the one who asks)
        if (c.get("locked")) return false;
        const me = req && req.h >= 0 ? c.where(req.h) : null, e = c.e, loc = me ? rot(-e.yaw, me.x - e.spec.pos[0], me.z - e.spec.pos[2]) : [0, -1], sgn = c.P.hinge === "left" ? 1 : -1, want = (loc[1] < 0 ? -sgn : sgn);
        if (c.S.phi * want > c.P.open_angle * c.P.open_at) return true;                                    // (it is open that way already)
        c.S.motor = false;
        c.S.to = want * c.P.open_angle * 0.96;                                                              // (swung to rest against the wall)
        if (c.P.partner) c.call(c.P.partner, "open", req ? req.a : 0);
        return true;
      },
      close: function (c) { c.S.motor = true; if (c.P.partner) c.call(c.P.partner, "close"); },
      lock: function (c) { c.set("locked", 1); c.S.motor = true; if (c.P.partner) c.call(c.P.partner, "lock"); },
      unlock: function (c) { c.set("locked", 0); if (c.P.partner) c.call(c.P.partner, "unlock"); }
    },
    tick: function (c, dt) {
      const S = c.S, P = c.P, lim = P.open_angle, sgn = P.hinge === "left" ? 1 : -1, e = c.e, w0 = P.width;
      let phi = S.phi, w = S.w, np, hit = false;
      if (c.get("locked")) S.motor = true;
      if (S.to !== null && !S.motor) {                                                                        // (a hand swings it through its arc)
        const d = S.to - phi, sp = P.push;
        if (d > -sp * dt && d < sp * dt) { phi = S.to; w = 0; S.to = null; } else w = d > 0 ? sp : -sp;
      } else if (S.motor) {                                                                                  // (the world's AI shuts it, or a lock holds it)
        S.to = null;
        if (phi === 0) { S.motor = false; w = 0; }
        else { w = phi > 0 ? -P.close_speed : P.close_speed; if (Math.abs(phi) <= P.close_speed * dt) { phi = 0; w = 0; S.motor = false; } }
      } else if (w !== 0) { w *= Math.exp(-P.friction * dt); if (w < 1.5 && w > -1.5) w = 0; if (w > P.max_speed) w = P.max_speed; else if (w < -P.max_speed) w = -P.max_speed; }
      if (S.to !== null && w === 0) { /* (blocked or not begun: it waits) */ }
      np = phi + w * dt;
      if (np > lim) { np = lim; w = 0; } else if (np < -lim) { np = -lim; w = 0; }
      if (w !== 0 && np !== phi) {                                                                           // (a creature in the leaf's way stops it: the leaf's new place must not be nearer to one than it is already, within its body)
        const ra = phi * PI / 180, rb = np * PI / 180, pvx = -sgn * w0 / 2, a = [sgn * Math.cos(ra), -sgn * Math.sin(ra)], bb = [sgn * Math.cos(rb), -sgn * Math.sin(rb)];
        c.each_creature(w0 + 1, function (h, x, y, z) {
          const l = rot(-e.yaw, x - e.spec.pos[0], z - e.spec.pos[2]), d0 = dist_to_leaf(l[0], l[1], pvx, 0, a[0], a[1], w0), d1 = dist_to_leaf(l[0], l[1], pvx, 0, bb[0], bb[1], w0);
          if (d1 < P.body && d1 < d0) hit = true;
        });
      }
      if (hit) { np = phi; w = 0; }                                                                          // (it waits where it is; the hand keeps pushing: S.to stays)
      S.phi = np; S.w = w;
      door_joint_pose(c);
      c.set("angle", Math.abs(np) / lim);
      c.set("open", Math.abs(np) > lim * P.open_at ? 1 : 0);
    }
  };
  const door_joint_pose = function (c) {
    const P = c.P, e = c.e, w = P.width, sgn = P.hinge === "left" ? 1 : -1, phi = c.S.phi * PI / 180;
    const lx = -sgn * w / 2 + sgn * w / 2 * Math.cos(phi), lz = -sgn * w / 2 * Math.sin(phi), o = rot(e.yaw, lx, lz), base = e.spec.pos;
    c.pose(base[0] + o[0], base[1], base[2] + o[1], c.quat(0, 1, 0, e.yaw + phi));
  };

  // ---- lamp: on while its scene is occupied (or a creature is near), off a few seconds after the last leaves; the switch by hand wins for a minute
  const lamp = {
    name: "lamp", kind: "world", title: "Lamp",
    params: { auto: true, radius: 5, linger: 2, manual: 60 },
    init: function (c) { c.S.manual = 0; c.S.forced = -1; },
    sensors: { occ: function (c) { return c.scene_occupied() || c.near(c.P.radius) > 0; } },
    tick: function (c, dt) { if (c.S.manual > 0) c.S.manual -= dt; },
    verbs: {
      switch: function (c) { c.S.manual = c.P.manual; c.S.forced = c.get("on") ? 0 : 1; },
      on: function (c) { c.S.manual = c.P.manual; c.S.forced = 1; },
      off: function (c) { c.S.manual = c.P.manual; c.S.forced = 0; }
    },
    settle: function (c) { if (c.P.auto && !(c.S.manual > 0)) { c.set("on", 0); c.goto("off"); } },          // (a room that falls asleep is not left lit, unless somebody switched the lamp by hand)
    start: function (c) { return c.get("on") ? "lit" : "off"; },
    states: {
      off: { on: [{ when: function (c) { return c.S.manual > 0 ? c.S.forced === 1 : (c.P.auto && c.s.occ); }, to: "lit", "do": function (c) { c.set("on", 1); } }] },
      lit: { on: [{ when: function (c) { return c.S.manual > 0 ? c.S.forced === 0 : (c.P.auto && !c.s.occ && c.time_in("lit") > c.P.linger); }, to: "off", "do": function (c) { c.set("on", 0); } }] }
    }
  };

  // ---- spin: a windmill's blades; the wind is a fact (`wind`, 1 when nobody set it)
  const spin = {
    name: "spin", kind: "world", title: "Spin",
    params: { axis: "z", rate: 40, wind: true, tower: -1 },
    init: function (c) { c.S.angle = 0; },
    tick: function (c, dt) {
      const w = c.P.wind ? c.fact("wind", 1) : 1, rate = c.P.rate * w;
      c.S.angle += rate * dt * PI / 180;
      const e = c.e, q = c.quat_mul(c.quat(0, 1, 0, e.yaw), c.P.axis === "x" ? c.quat(1, 0, 0, c.S.angle) : c.P.axis === "y" ? c.quat(0, 1, 0, c.S.angle) : c.quat(0, 0, 1, c.S.angle));
      c.pose(e.spec.pos[0], e.spec.pos[1], e.spec.pos[2], q);
      if (Math.abs(c.get("speed") - rate) > 0.5) c.set("speed", rate);
    }
  };

  // ---- container: a cupboard or a chest. Locked, it refuses everything but unlock
  const container = {
    name: "container", kind: "world", title: "Container",
    params: { capacity: 12 },
    verbs: {
      open: function (c) { if (c.get("locked")) return false; c.set("open", 1); },
      close: function (c) { c.set("open", 0); },
      lock: function (c) { c.set("open", 0); c.set("locked", 1); },
      unlock: function (c) { c.set("locked", 0); },
      store: function (c) { if (c.get("locked") || c.get("items") >= c.P.capacity) return false; c.set("items", c.get("items") + 1); },
      take: function (c) { if (c.get("locked") || c.get("items") <= 0) return false; c.set("items", c.get("items") - 1); }
    }
  };

  // ---- curtain: slides open and shut
  const curtain = {
    name: "curtain", kind: "world", title: "Curtain",
    params: { width: 1.4, speed: 0.6 },
    init: function (c) { c.S.want = c.get("open"); c.S.frac = c.get("open"); },
    verbs: { open: function (c) { c.S.want = 1; }, close: function (c) { c.S.want = 0; } },
    tick: function (c, dt) {
      const d = c.S.want - c.S.frac;
      if (d === 0) return;
      c.S.frac += Math.max(-dt * c.P.speed, Math.min(dt * c.P.speed, d));
      const o = rot(c.e.yaw, c.S.frac * c.P.width * 0.8, 0);
      c.pose(c.e.spec.pos[0] + o[0], c.e.spec.pos[1], c.e.spec.pos[2] + o[1], c.quat(0, 1, 0, c.e.yaw));
      if (c.S.frac === c.S.want) c.set("open", c.S.want);
    }
  };

  // ---- bridge: a drawbridge hinged at its foot; it rises when a creature enters its trigger zone (or a plate says so) and lowers when the zone has been empty (a bridge with `keep` is raised until it is asked). Its span is a pair of GATES of the nav (the entity's state: gate and gate2, one at each
  // end of the deck: world/kit.js of `happy`, which is not kept here): open (0) while the leaf lies down, closed (1) while it rises, is up or lowers: a creature that wants to cross a closed one walks to it and ASKS (the verb `open`), and the leaf lowers at once and stays
  // down while anyone is near; `keep` seconds after the last one has gone it is raised again (0: it stays down). `raise`, `lower` and `trigger` are the verbs of a plate.
  const bridge_pose = function (c, frac) {
    const e = c.e, q = c.quat_mul(c.quat(0, 1, 0, e.yaw), c.quat(1, 0, 0, -frac * c.P.raise_deg * PI / 180));
    c.pose(e.spec.pos[0], e.spec.pos[1], e.spec.pos[2], q);
  };
  const bridge_gates = function (c, st) { c.set_gate(c.e.state.gate, st); c.set_gate(c.e.state.gate2, st); };
  const bridge = {
    name: "bridge", kind: "world", title: "Drawbridge",
    params: { length: 4, raise_deg: 80, speed: 30, trigger: "", linger: 5, keep: 0, near: 7 },
    init: function (c) { c.S.frac = c.get("raised") ? 1 : 0; c.S.forced = -1; c.S.asked = 0; c.S.idle = 0; bridge_pose(c, c.S.frac); },
    sensors: { inside: function (c) { return c.S.forced >= 0 ? c.S.forced === 1 : (c.P.trigger !== "" && c.occupied(c.P.trigger) > 0); } },
    verbs: {
      raise: function (c) { c.S.forced = 1; }, lower: function (c) { c.S.forced = 0; c.S.asked = 1; },
      open: function (c) { c.S.forced = 0; c.S.asked = 1; c.S.idle = 0; return true; },                      // (a creature at a closed gate: it lowers)
      trigger: function (c, r) { c.S.forced = r.a > 0 ? 1 : 0; if (r.a <= 0) c.S.asked = 1; }
    },
    tick: function (c, dt) {                                                                               // (a bridge that was asked down is raised again when nobody has been near for `keep` seconds)
      if (c.S.forced === 0 && c.P.keep > 0 && c.S.frac <= 0) {
        if (c.near(c.P.near) > 0) c.S.idle = 0; else { c.S.idle += dt; if (c.S.idle > c.P.keep) { c.S.forced = 1; c.S.idle = 0; } }
      }
    },
    start: function (c) { return c.get("raised") ? "up" : "down"; },
    states: {
      down: { enter: function (c) { c.set("raised", 0); c.set("angle", 0); c.set("open", 1); bridge_gates(c, 0); }, on: [{ when: function (c) { return c.s.inside; }, to: "raising" }] },
      raising: {
        enter: function (c) { c.S.asked = 0; c.set("open", 0); bridge_gates(c, 1); },
        tick: function (c, dt) { c.S.frac = Math.min(1, c.S.frac + dt * c.P.speed / c.P.raise_deg); bridge_pose(c, c.S.frac); },
        on: [{ when: function (c) { return c.S.frac >= 1; }, to: "up" }]
      },
      up: { enter: function (c) { c.set("raised", 1); c.set("angle", 1); bridge_gates(c, 1); }, on: [{ when: function (c) { return !c.s.inside && (c.S.asked === 1 || (c.P.keep === 0 && c.time_in("up") > c.P.linger)); }, to: "lowering" }] },
      lowering: {
        tick: function (c, dt) { c.S.frac = Math.max(0, c.S.frac - dt * c.P.speed / c.P.raise_deg); bridge_pose(c, c.S.frac); },
        on: [{ when: function (c) { return c.S.frac <= 0; }, to: "down" }, { when: function (c) { return c.s.inside; }, to: "raising" }]
      }
    }
  };

  // ---- plate: pressed while a creature stands in its zone; it fires the entity named in `fires` (verb `trigger`, 1 pressed, 0 released) or sets the fact of that name
  const plate = {
    name: "plate", kind: "world", title: "Pressure plate",
    params: { zone: "", fires: "" },
    sensors: { on_it: function (c) { return c.P.zone !== "" ? c.occupied(c.P.zone) : 0; } },
    start: "up",
    states: {
      up: {
        enter: function (c) { c.set("pressed", 0); },
        on: [{ when: function (c) { return c.s.on_it > 0; }, to: "down", "do": function (c) { c.set("pressed", 1); c.effect("click", c.e.pos[0], c.e.pos[1], c.e.pos[2], 0, 0, 0, 1); if (c.P.fires && !c.call(c.P.fires, "trigger", 1)) c.set_fact(c.P.fires, 1); } }]
      },
      down: { on: [{ when: function (c) { return c.s.on_it === 0; }, to: "up", "do": function (c) { if (c.P.fires && !c.call(c.P.fires, "trigger", 0)) c.set_fact(c.P.fires, 0); } }] }
    }
  };

  // ---- heat: a stove warms while it is on; the creatures read its `heat` state (a sensor that says "near a hot thing")
  const heat = {
    name: "heat", kind: "world", title: "Stove",
    params: { radius: 1.2, warm: 5 },
    init: function (c) { c.S.puff = 0; },
    verbs: { switch: function (c) { c.set("on", c.get("on") ? 0 : 1); }, on: function (c) { c.set("on", 1); }, off: function (c) { c.set("on", 0); } },
    tick: function (c, dt) {
      const on = c.get("on"), h = c.get("heat"), nh = Math.max(0, Math.min(1, h + (on ? dt : -dt) / c.P.warm));
      if (nh !== h) c.set("heat", Math.round(nh * 100) / 100);
      c.S.puff -= dt;
      if (on && nh > 0.5 && c.S.puff <= 0) { c.S.puff = 0.6; c.effect("smoke", c.e.pos[0], c.e.pos[1] + 1, c.e.pos[2], 0, 0.6, 0, 2); }
    }
  };

  // ---- trap: hurts the creatures within its radius when it is triggered, with a rest between
  const trap = {
    name: "trap", kind: "world", title: "Trap",
    params: { radius: 2, damage: 30, rest: 3 },
    init: function (c) { c.S.rest = 0; },
    tick: function (c, dt) { if (c.S.rest > 0) c.S.rest -= dt; },
    verbs: {
      trigger: function (c, r) {
        if (!(r.a > 0) || c.S.rest > 0) return false;
        c.S.rest = c.P.rest;
        c.effect("spark", c.e.pos[0], c.e.pos[1] + 0.5, c.e.pos[2], 0, 2, 0, 20);
        c.hurt(c.P.radius, c.P.damage);
      }
    }
  };

  // ---- item: a small thing that a creature takes (`take`: it is carried when nobody has it, `holder` is the handle + 1 of the one who does) and puts down (`drop`; the worker says where with the state px, py, pz first). The
  // entity is posed from its state: at its place while it lies about, under the ground while it is carried
  const item = {
    name: "item", kind: "world", title: "Item",
    params: {},
    init: function (c) { c.S.at = null; },
    verbs: {
      take: function (c, r) { if (c.get("holder") > 0) return false; c.set("holder", r.h + 1); },
      drop: function (c, r) { if (c.get("holder") !== r.h + 1 && c.get("holder") > 0 && r.h >= 0) return false; c.set("holder", 0); }
    },
    tick: function (c) {
      const held = c.get("holder") > 0, x = c.get("px"), y = held ? -100 : c.get("py"), z = c.get("pz"), S = c.S;
      if (S.at !== null && S.at[0] === x && S.at[1] === y && S.at[2] === z) return;
      S.at = [x, y, z];
      c.pose(x, y, z, c.quat(0, 1, 0, c.e.yaw));
    }
  };

  const BLOCKS = { door: door, door_joint: door_joint, lamp: lamp, spin: spin, container: container, curtain: curtain, bridge: bridge, plate: plate, heat: heat, trap: trap, item: item };
  return { blocks: BLOCKS, door_pose: door_pose };
});

// ========================================================================================================================
// world_runtime
// ========================================================================================================================
packing()("happy_world_runtime", function happy_world_runtime() {
  "use strict";
  // HAPPY WORLD RUNTIME: the page's half of a hosted world (SYSTEM.md): the world AS A PARTICIPANT. It reads the spec (world/world_spec.js), keeps the STATE of every prop, runs the WORLD BLOCKS that move
  // them (a door that opens when a creature comes, a lamp that is lit while its room is occupied, a windmill, a bridge, a trap), decides which SCENES are awake, spawns and removes the CREATURES by the spawn rules
  // (pending -> spawning -> alive -> dying -> dead -> despawning, the slot returned to the pool) and answers the requests the creatures' workers make (an effect, a prop thrown into the world, an interaction, their life).
  // It is pure: everything it touches outside itself goes through PORTS that the host (world_host.js, on a real page) fills and a test fakes:
  //   ports.phy        { ground(y), box(b) -> id, entity(e) -> [body ids], move(id, [x, y, z], [qx, qy, qz, qw], dt) (a kinematic body is driven there), velocity(id, vx, vy, vz), park(id), unpark(id), snapshot(id) -> any, restore(id, snap) }
  //   ports.creatures  { each(fn(handle, x, y, z, info)) the living, spawn(family, x, y, z, yaw, opts) -> handle | null, release(handle), hurt(handle, damage, from), agent(family) -> the nav profile }
  //   ports.fx         { burst(name, x, y, z, vx, vy, vz, n) }          ports.worker   { state(diff) }  what the page's blocks changed, for `api.sw`: { gates, ent, scenes, facts }
  //   const R = create({ spec, blocks: { name: def }, ports, Nav, Spec, Kit, rand })      R.tick(dt)      R.on_requests(m)  (what system.on_world_requests is given)      R.stats()
  // THE WORLD BLOCK (the same four-part structure as a creature's: SENSORS read the world, CONDITIONS evaluate it, ACTIONS change it, TRANSITIONS decide what happens next), a def { name, params, sensors, states, verbs, start, init, tick }:
  //   sensors: { name: function (c) -> value }   run at the start of every tick of the block, into c.s.name      states: { name: { enter(c), tick(c, dt), leave(c), on: [{ when: function (c) -> bool, to: "state", do: function (c) }] } }
  //   verbs: { open: function (c, req) } what a creature's interaction asks of the block's entity (req: { h, a }); a block with no tick but a function `tick(c, dt)` is a one-state machine
  //   It meets creatures only through what the contract exposes (c.near, c.occupied, c.mail, the entity's state): no block names a family, and no creature block names a prop.
  //   c: dt, time, P (the settings), S (private state), s (the sensors' values), e (the entity: { id, name, pos, yaw, state }), scene, get(key), set(key, v), near(r) -> count (c.nearest_h, c.nearest_d), occupied(zone) -> count, gate(state),
  //      pose(x, y, z, quat) (drive the kinematic body there), effect(name, x, y, z, vx, vy, vz, n), fact(name) / set_fact(name, v, zone), hurt(r, damage), call(entity_name, verb, a), rand(), time_in(state)
  // Node 14: no optional chaining, no ??.
  const LIFE = { PENDING: 0, SPAWNING: 1, ALIVE: 2, DYING: 3, DEAD: 4, DESPAWNING: 5 };
  const SCENE = { ACTIVE: 0, DORMANT: 1, UNLOADED: 2 };
  const R_EFFECT = 1, R_PROP = 2, R_IMPULSE = 3, R_INTERACT = 4, R_STATE = 5, R_LIFE = 6, R_FACT = 7, R_SIT = 8, R_STAND = 9, STRIDE = 10;
  const MSG_SIT_REFUSED = 312;                                                                              // (what the `use` block hears when the page could not sit its creature down: it gives the seat up)
  const SCENE_CHECK = 0.25, SCENE_GRACE = 3, SCENE_MARGIN_Y = 1.0, MAX_LOOSE = 24;
  const NOOP = function () { };
  const quat_axis = function (ax, ay, az, a) { const s = Math.sin(a / 2); return [ax * s, ay * s, az * s, Math.cos(a / 2)]; };
  const quat_mul = function (a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; };
  const fail = function (where, text) { throw new Error("happy_world_runtime: " + where + ": " + text); };

  function create(o) {
    const spec = o.spec, ports = o.ports || {}, Nav = o.Nav || null, Spec = o.Spec || null, Kit = o.Kit || null, rand = o.rand || Math.random;
    const phy = ports.phy || {}, cre = ports.creatures || {}, fx = ports.fx || {}, wk = ports.worker || {};
    const R = { spec: spec, time: 0, nav: null, E: [], scenes: [], facts: Object.create(null), zfacts: [], blocks: [], loose: [], pop: { rules: [], recs: Object.create(null) }, counters: { requests: 0, effects: 0, props: 0, interactions: 0, unhandled: 0, spawned: 0, died: 0, despawned: 0, spawn_failed: 0, woke: 0, slept: 0, sat: 0, stood: 0, assigned: 0, released: 0, allots: 0, allot_evals: 0 } };
    const diff = { gates: [], ent: [], scenes: [], facts: [] };
    const dirty = function () { return diff.gates.length || diff.ent.length || diff.scenes.length || diff.facts.length; };
    const defs = o.blocks || {};
    const names = [];                                                                                      // (the names the workers' requests use: the dictionary grows with their messages)

    // ---- the nav (the page's own bake: the spawner needs it), the gates
    if (Nav) { R.nav = Nav.create(spec); }
    // the keys of entity state, in the order the worker's service interns them (sworld.js install): the same loop
    const state_ids = Object.create(null);
    let nsk = 0;
    spec.entities.forEach(function (e) { for (const k in e.state) if (state_ids[k] === undefined) state_ids[k] = nsk++; });
    R.state_key = function (name) { const k = state_ids[name]; return k === undefined ? -1 : k; };

    // ---- the entities: their state, their bodies
    const by_name = Object.create(null);
    spec.entities.forEach(function (e) {
      const rec = { id: e.id, spec: e, name: e.name, type: e.type, cls: e.cls, pos: e.pos.slice(), yaw: e.yaw, state: {}, bodies: [], scene: -1, target: null, parked: false, snap: null };
      for (const k in e.state) rec.state[k] = e.state[k];
      R.E.push(rec); by_name[e.name] = rec;
    });
    R.entity = function (name) { return by_name[name] || null; };
    R.get = function (e, key) { const v = e.state[key]; return v === undefined ? 0 : v; };
    R.set_state = function (e, key, v) {
      if (e.state[key] === v) return;
      e.state[key] = v;
      const k = state_ids[key];
      if (k !== undefined) diff.ent.push([e.id, k, v]);
      if (e.state.gate !== undefined && (key === "open" || key === "locked")) {                           // (a door: its gate follows: locked 2, closed 1, open 0)
        const g = e.state.locked ? 2 : (e.state.open > 0.5 ? 0 : 1);
        diff.gates.push([e.state.gate, g]);
        if (R.nav) R.nav.set_gate(e.state.gate, g);
      }
    };

    // ---- the scenes
    const zone_by_name = Object.create(null);
    spec.zones.forEach(function (z) { zone_by_name[z.name] = z; });
    spec.scenes.forEach(function (s) { R.scenes.push({ id: s.id, spec: s, name: s.name, state: SCENE.ACTIVE, quiet: 0, pinned: s.policy === "always" || !!s.pinned }); });
    const scene_ids = Object.create(null);
    R.scenes.forEach(function (s) { scene_ids[s.name] = s.id; });
    R.E.forEach(function (e) { e.scene = e.spec.scene !== null && scene_ids[e.spec.scene] !== undefined ? scene_ids[e.spec.scene] : -1; });
    R.scene = function (name) { const i = scene_ids[name]; return i === undefined ? null : R.scenes[i]; };

    // ---- the creatures, once a tick: where they are (the blocks and the scenes ask)
    let cn = 0, ch = new Int32Array(256), cx = new Float32Array(256), cy = new Float32Array(256), cz = new Float32Array(256), cvx = new Float32Array(256), cvz = new Float32Array(256);
    const cinfo = [], seen_at = Object.create(null);                                                       // (cinfo: what the host says of each creature's family, the world's AI asks for its skills; seen_at: where each was at the last snapshot, for its velocity)
    let snap_t = 0;
    const snapshot_creatures = function () {
      const dt = R.time - snap_t;
      cn = 0;
      if (!cre.each) return;
      cre.each(function (h, x, y, z, info) {
        if (cn === ch.length) { const g = function (a, T) { const b = new T(a.length * 2); b.set(a); return b; }; ch = g(ch, Int32Array); cx = g(cx, Float32Array); cy = g(cy, Float32Array); cz = g(cz, Float32Array); cvx = g(cvx, Float32Array); cvz = g(cvz, Float32Array); }
        const p = seen_at[h];
        ch[cn] = h; cx[cn] = x; cy[cn] = y; cz[cn] = z; cinfo[cn] = info || null;
        cvx[cn] = p && dt > 0 ? (x - p[0]) / dt : 0; cvz[cn] = p && dt > 0 ? (z - p[1]) / dt : 0;
        if (p) { p[0] = x; p[1] = z; } else seen_at[h] = [x, z];
        cn++;
      });
      snap_t = R.time;
      if (roles.size > 0 && R.time - prune_t >= 1) prune_roles();                                           // (a creature that is gone takes its role with it)
    };
    const in_zone = function (z, x, y, zz, margin, my) {
      const r = z.rect;
      if (x < r[0] - margin || x > r[2] + margin || zz < r[1] - margin || zz > r[3] + margin) return false;
      return !z.y || (y >= z.y[0] - 0.5 - my && y <= z.y[1] + 0.5);
    };
    R.count_in_zone = function (name) {
      const z = zone_by_name[name];
      if (!z) return 0;
      let n = 0;
      for (let i = 0; i < cn; i++) if (in_zone(z, cx[i], cy[i], cz[i], 0, 0)) n++;
      return n;
    };
    R.creature_count = function () { return cn; };

    // ---- the scenes: awake when someone is in or near them, dormant when no one has been for a while
    const scene_occupied = function (s) {
      for (let k = 0; k < s.spec.zones.length; k++) {
        const z = zone_by_name[s.spec.zones[k]], m = s.spec.wake_margin;
        for (let i = 0; i < cn; i++) if (in_zone(z, cx[i], cy[i], cz[i], m, SCENE_MARGIN_Y)) return true;
      }
      return false;
    };
    const set_scene = function (s, st) {
      if (s.state === st) return;
      const members = R.E.filter(function (e) { return e.scene === s.id; });
      if (st === SCENE.ACTIVE) {
        members.forEach(function (e) { e.bodies.forEach(function (b, i) { if (phy.unpark) phy.unpark(b); if (phy.restore && e.snap) phy.restore(b, e.snap[i]); }); e.parked = false; e.snap = null; });
        R.counters.woke++;
      } else {                                                                                             // (dormant or unloaded: what the bodies were is kept, they are taken out of the physics world, the blocks stop)
        R.blocks.forEach(function (b) { if (b.scene === s && b.def.settle) { b.c.time = R.time; b.def.settle(b.c); } });             // (a block says how it is left: a lamp is put out, so that a room that sleeps is not left lit)
        R.E.forEach(function (e) { if (e.scene === s.id && e.target && !e.parked && phy.move) e.bodies.forEach(function (bd) { phy.move(bd, e.target.pos, e.target.quat, 0); }); });
        members.forEach(function (e) { e.snap = e.bodies.map(function (b) { return phy.snapshot ? phy.snapshot(b) : null; }); e.bodies.forEach(function (b) { if (phy.park) phy.park(b); }); e.parked = true; });
        R.counters.slept++;
      }
      s.state = st; s.quiet = 0;
      diff.scenes.push([s.id, st]);
    };
    R.set_scene = function (name, st) { const s = R.scene(name); if (!s) fail("set_scene", "no scene `" + name + "`"); set_scene(s, st === "active" ? 0 : st === "dormant" ? 1 : st === "unloaded" ? 2 : st); };
    let scene_t = 0;
    const update_scenes = function (dt) {
      scene_t += dt;
      if (scene_t < SCENE_CHECK) return;
      const step = scene_t; scene_t = 0;
      for (let i = 0; i < R.scenes.length; i++) {
        const s = R.scenes[i];
        if (s.spec.policy !== "auto" || s.pinned || !s.spec.zones.length) continue;
        if (scene_occupied(s)) { s.quiet = 0; if (s.state !== SCENE.ACTIVE) set_scene(s, SCENE.ACTIVE); }
        else { s.quiet += step; if (s.state === SCENE.ACTIVE && s.quiet >= SCENE_GRACE) set_scene(s, SCENE.DORMANT); }
      }
    };

    // ---- ROLES (SYSTEM.md "Roles"). The world's AI gives a creature a ROLE and a TARGET; the creature's own skills do the work (its goals are gated by the role, the errand skill serves it). The world's AI says WHO, the creature says HOW.
    //   R.assign(handle, role, target, key, ttl)   gives it (message 602 of the creature's `role` block) and ONLY when the role, its kind of target, its key or its place changed: a job that goes on costs no message
    //   R.release(handle)                          takes it away (603)         R.role_of(handle) -> { role, key, kind, a, b, x, z, since } | null  (what was sent last: read only)
    //   R.allot(role, jobs, crew, o)               says WHO: the jobs of a role against the creatures that may have them (below)           R.role_log(n) -> the last n changes, the newest first
    //   a TARGET is { x, z } | { entity: name } | { zone: name } | { creature: handle } | null      (a thing that moves is not followed: a block that wants that gives it again)
    // SCALE: the creatures' side is typed columns of the blackboard (one entry a creature, pure.js); here a Map by handle whose entries are changed in place, and scratch arrays that grow and are never made again. A call of
    // allot that changes nothing sends no message and makes no object; what it costs is the pairs it looks at (the crew times the jobs, less the creatures already taken: R.counters.allot_evals counts them), so a world with a great crew
    // gives each job a crew of its own (a zone, a skill) and calls it a few times a second, not every frame.
    const role_names = spec.roles || [];
    const MSG_ROLE = 602, MSG_ROLE_RELEASE = 603, RETARGET = 0.4;
    const roles = new Map();
    let prune_t = 0;
    const role_num = function (name, where) { const i = role_names.indexOf(name); if (i < 0) fail(where, "no role `" + name + "` (w.roles: " + (role_names.join(", ") || "none") + ")"); return i + 1; };
    const T = new Float64Array(5);                                                                          // (a target, encoded: its kind, a, b, and where it is on the ground, x and z, for the costs)
    const find_h = function (h) { for (let i = 0; i < cn; i++) if (ch[i] === h) return i; return -1; };
    const encode = function (t, where) {
      if (t === null || t === undefined) { T[0] = 0; T[1] = 0; T[2] = 0; T[3] = 0; T[4] = 0; return; }
      if (t.x !== undefined) { if (typeof t.x !== "number" || typeof t.z !== "number") fail(where, "a place is { x, z }, numbers"); T[0] = 1; T[1] = t.x; T[2] = t.z; T[3] = t.x; T[4] = t.z; return; }
      if (t.entity !== undefined) {
        const e = by_name[t.entity];
        if (!e) fail(where, "no entity `" + t.entity + "`");
        const w = e.bodies.length && phy.where ? phy.where(e.bodies[0]) : null, p = w || e.pos;
        T[0] = 2; T[1] = e.id; T[2] = 0; T[3] = p[0]; T[4] = p[2]; return;
      }
      if (t.zone !== undefined) {
        const z = zone_by_name[t.zone];
        if (!z) fail(where, "no zone `" + t.zone + "`");
        T[0] = 3; T[1] = z.id; T[2] = 0; T[3] = (z.rect[0] + z.rect[2]) / 2; T[4] = (z.rect[1] + z.rect[3]) / 2; return;
      }
      if (t.creature !== undefined) { const i = find_h(t.creature); T[0] = 4; T[1] = t.creature; T[2] = 0; T[3] = i >= 0 ? cx[i] : 0; T[4] = i >= 0 ? cz[i] : 0; return; }
      fail(where, "a target is { x, z }, { entity }, { zone } or { creature }");
    };
    const LOG = 256, lg_t = new Float64Array(LOG), lg_ev = new Uint8Array(LOG), lg_h = new Int32Array(LOG), lg_role = new Uint8Array(LOG), lg_key = new Array(LOG), LOG_NAMES = ["", "assign", "retarget", "release", "gone"];
    let lg_n = 0;
    const role_log = function (ev, h, rid, key) { const i = lg_n % LOG; lg_t[i] = R.time; lg_ev[i] = ev; lg_h[i] = h; lg_role[i] = rid; lg_key[i] = key; lg_n++; };
    R.role_log = function (n) {
      const out = [], m = Math.min(lg_n, LOG, n === undefined ? LOG : n);
      for (let k = 0; k < m; k++) { const i = (lg_n - 1 - k) % LOG; out.push({ t: lg_t[i], ev: LOG_NAMES[lg_ev[i]], h: lg_h[i], role: role_names[lg_role[i] - 1] || "", key: lg_key[i] }); }
      return out;
    };
    R.assign = function (h, role, target, key, ttl) {
      const rid = role_num(role, "assign");
      encode(target, "assign");
      const k = key === undefined ? "" : key, tt = ttl > 0 ? ttl : 0;
      let e = roles.get(h);
      const same = e !== undefined && e.rid === rid && e.kind === T[0] && e.key === k && e.ttl === tt && (T[0] === 1 ? Math.abs(e.a - T[1]) < RETARGET && Math.abs(e.b - T[2]) < RETARGET : e.a === T[1]);
      if (same) return true;
      if (!cre.tell || !cre.tell(h, MSG_ROLE, [rid, T[0], T[1], T[2], tt])) return false;
      const fresh = e === undefined || e.rid !== rid || e.key !== k;
      if (e === undefined) { e = { role: role, rid: rid, key: k, kind: 0, a: 0, b: 0, x: 0, z: 0, ttl: 0, since: 0 }; roles.set(h, e); }
      e.role = role; e.rid = rid; e.key = k; e.kind = T[0]; e.a = T[1]; e.b = T[2]; e.x = T[3]; e.z = T[4]; e.ttl = tt;
      if (fresh) e.since = R.time;
      R.counters.assigned++;
      role_log(fresh ? 1 : 2, h, rid, k);
      return true;
    };
    R.release = function (h) {
      const e = roles.get(h);
      if (e === undefined) return false;
      roles.delete(h);
      if (cre.tell) cre.tell(h, MSG_ROLE_RELEASE, []);
      R.counters.released++; role_log(3, h, e.rid, e.key);
      return true;
    };
    R.role_of = function (h) { return roles.get(h) || null; };
    const alive_set = new Set();
    const prune_roles = function () {
      prune_t = R.time;
      alive_set.clear();
      for (let i = 0; i < cn; i++) alive_set.add(ch[i]);
      for (const [h, e] of roles) if (!alive_set.has(h)) { roles.delete(h); role_log(4, h, e.rid, e.key); }
    };
    // ALLOT: who has which job. `jobs`: [{ key (a name that stays the same while the job lasts), target, want (how many creatures: 1), prio (metres of preference: 0), locked (the holder keeps it: a thing is in its hands) }],
    // `crew`: the creatures that may have them (c.creatures(...): { h, x, z }), o: { cap (at most this many hold the role at once: tokens, the cheapest pairs have them), margin (4 m: a creature keeps its job unless another is cheaper by
    // this much, so that assignments do not flip), max_d (no pair dearer than this), cost (function (member, job) -> a number: the default is the distance on the ground; a world file can give the length of a path), idle (the roles whose holders
    // count as free: ["rest"]), ttl (seconds the role lasts from the last time it is sent) }. A creature that holds a job whose key is no longer there, or that is not in the crew, is released. The pairs are matched the way a greedy
    // match goes, the cheapest pair first, but lazily: each job keeps its cheapest creature in a heap and looks again only when another job took that creature, so the cost is about jobs x crew and not every pair sorted.
    // -> { started: [handles that were given a job just now], ended: [handles that lost theirs], idle: [crew members with no job], open: jobs that nobody has, assigned } (one object that the next call writes over)
    let cap_n = 0, a_cx, a_cz, a_taken, a_held, a_got, a_jx, a_jz, a_want, a_prio, hp_k, hp_j, hp_c, hp_n = 0, pop_j = 0, pop_c = 0;
    const ensure = function (n) {
      if (n <= cap_n) return;
      let m = cap_n > 64 ? cap_n : 64;
      while (m < n) m *= 2;
      cap_n = m;
      a_cx = new Float64Array(m); a_cz = new Float64Array(m); a_taken = new Uint8Array(m); a_held = new Int32Array(m); a_got = new Int32Array(m);
      a_jx = new Float64Array(m); a_jz = new Float64Array(m); a_want = new Int32Array(m); a_prio = new Float64Array(m);
      hp_k = new Float64Array(m); hp_j = new Int32Array(m); hp_c = new Int32Array(m);
    };
    const hp_push = function (k, j, c) {
      let i = hp_n++;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (hp_k[p] < k || (hp_k[p] === k && (hp_j[p] < j || (hp_j[p] === j && hp_c[p] <= c)))) break;
        hp_k[i] = hp_k[p]; hp_j[i] = hp_j[p]; hp_c[i] = hp_c[p]; i = p;
      }
      hp_k[i] = k; hp_j[i] = j; hp_c[i] = c;
    };
    const hp_pop = function () {
      pop_j = hp_j[0]; pop_c = hp_c[0];
      const n = --hp_n;
      if (n > 0) {
        const k = hp_k[n], j = hp_j[n], c = hp_c[n];
        let i = 0;
        for (;;) {
          let l = 2 * i + 1;
          if (l >= n) break;
          const r = l + 1;
          if (r < n && (hp_k[r] < hp_k[l] || (hp_k[r] === hp_k[l] && (hp_j[r] < hp_j[l] || (hp_j[r] === hp_j[l] && hp_c[r] < hp_c[l]))))) l = r;
          if (k < hp_k[l] || (k === hp_k[l] && (j < hp_j[l] || (j === hp_j[l] && c <= hp_c[l])))) break;
          hp_k[i] = hp_k[l]; hp_j[i] = hp_j[l]; hp_c[i] = hp_c[l]; i = l;
        }
        hp_k[i] = k; hp_j[i] = j; hp_c[i] = c;
      }
    };
    const allot_out = { started: [], ended: [], idle: [], open: 0, assigned: 0 };
    const jm = new Map(), cm = new Map();
    R.allot = function (role, jobs, crew, o) {
      o = o || {};
      const rid = role_num(role, "allot"), nc = crew.length, nj = jobs.length, out = allot_out;
      const cap = o.cap > 0 ? o.cap : 1e9, margin = o.margin >= 0 ? o.margin : 4, max_d = o.max_d > 0 ? o.max_d : 1e18, idle = o.idle || null, cost_fn = o.cost || null, ttl = o.ttl > 0 ? o.ttl : 0;
      ensure((nc > nj ? nc : nj) + 1);
      out.started.length = 0; out.ended.length = 0; out.idle.length = 0; out.open = 0; out.assigned = 0;
      R.counters.allots++;
      jm.clear(); cm.clear();
      for (let j = 0; j < nj; j++) {
        const jb = jobs[j];
        if (jm.has(jb.key)) fail("allot", "two jobs have the key `" + jb.key + "`");
        jm.set(jb.key, j);
        encode(jb.target, "allot");
        a_jx[j] = T[3]; a_jz[j] = T[4]; a_want[j] = jb.want > 0 ? jb.want | 0 : 1; a_prio[j] = jb.prio || 0;
      }
      for (let i = 0; i < nc; i++) cm.set(crew[i].h, i);
      for (const [h, e] of roles) if (e.rid === rid && (!cm.has(h) || !jm.has(e.key))) { R.release(h); out.ended.push(h); }     // (the job is gone, or the creature is no longer one that may have it)
      for (let i = 0; i < nc; i++) {
        const m = crew[i], e = roles.get(m.h);
        a_cx[i] = m.x; a_cz[i] = m.z; a_got[i] = -1; a_held[i] = -1;
        if (e !== undefined && e.rid !== rid && !(idle !== null && idle.indexOf(e.role) >= 0)) a_taken[i] = 2;      // (it has another role: it is not for this one's jobs, unless that role is one that counts as idle)
        else { a_taken[i] = 0; if (e !== undefined && e.rid === rid) { const j = jm.get(e.key); a_held[i] = j === undefined ? -1 : j; } }
      }
      let given = 0;
      for (let i = 0; i < nc; i++) { const j = a_held[i]; if (j >= 0 && jobs[j].locked && a_want[j] > 0 && given < cap) { a_got[i] = j; a_taken[i] = 1; a_want[j]--; given++; } }
      const best = function (j) {                                                                           // (the cheapest creature still free for the job: it goes in the heap)
        let bi = -1, bk = 0;
        for (let i = 0; i < nc; i++) {
          if (a_taken[i] !== 0) continue;
          let d;
          if (cost_fn !== null) d = cost_fn(crew[i], jobs[j]); else { const dx = a_cx[i] - a_jx[j], dz = a_cz[i] - a_jz[j]; d = Math.sqrt(dx * dx + dz * dz); }
          if (d > max_d) continue;
          d -= a_prio[j];
          if (a_held[i] === j) d -= margin;
          if (bi < 0 || d < bk) { bi = i; bk = d; }
        }
        R.counters.allot_evals += nc;
        if (bi >= 0) hp_push(bk, j, bi);
      };
      hp_n = 0;
      for (let j = 0; j < nj; j++) if (a_want[j] > 0) best(j);
      while (hp_n > 0 && given < cap) {
        hp_pop();
        const j = pop_j, i = pop_c;
        if (a_taken[i] !== 0) { best(j); continue; }                                                        // (another job took it first: this one looks again)
        a_got[i] = j; a_taken[i] = 1; a_want[j]--; given++;
        if (a_want[j] > 0) best(j);
      }
      for (let i = 0; i < nc; i++) {
        if (a_taken[i] === 2) continue;
        const m = crew[i], j = a_got[i], e0 = roles.get(m.h);
        if (j >= 0) {
          const jb = jobs[j], fresh = e0 === undefined || e0.rid !== rid || e0.key !== jb.key;
          if (R.assign(m.h, role, jb.target, jb.key, ttl) && fresh) out.started.push(m.h);
        } else {
          if (e0 !== undefined && e0.rid === rid) { R.release(m.h); out.ended.push(m.h); }
          out.idle.push(m);
        }
      }
      for (let j = 0; j < nj; j++) if (a_want[j] > 0) out.open++;
      out.assigned = given;
      return out;
    };

    // ---- the world blocks
    const make_ctx = function (b) {
      const c = { dt: 0, time: 0, P: b.P, S: b.S, s: {}, e: b.e, scene: b.scene, nearest_h: -1, nearest_d: 0 };
      c.get = function (k) { return b.e ? R.get(b.e, k) : 0; };
      c.set = function (k, v) { if (b.e) R.set_state(b.e, k, v); };
      c.near = function (r) {
        const p = b.e ? b.e.pos : [0, 0, 0], r2 = r * r;
        let n = 0, bd = 1e18;
        c.nearest_h = -1;
        for (let i = 0; i < cn; i++) {
          const dx = cx[i] - p[0], dy = cy[i] - p[1], dz = cz[i] - p[2];
          if (dy > 2.5 || dy < -2.5) continue;
          const d = dx * dx + dz * dz;
          if (d <= r2) { n++; if (d < bd) { bd = d; c.nearest_h = ch[i]; } }
        }
        c.nearest_d = Math.sqrt(bd);
        return n;
      };
      c.occupied = function (zone) { return R.count_in_zone(zone); };
      c.scene_occupied = function () { return b.scene ? scene_occupied(b.scene) : false; };
      c.gate = function (st) { if (b.e && b.e.state.gate !== undefined) { diff.gates.push([b.e.state.gate, st]); if (R.nav) R.nav.set_gate(b.e.state.gate, st); } };
      c.set_gate = function (g, st) { if (g === undefined || g < 0) return; diff.gates.push([g, st]); if (R.nav) R.nav.set_gate(g, st); };                  // (any gate by its number: an entity with two, a drawbridge, says them in its state: gate, gate2)
      c.pose = function (x, y, z, q) { if (b.e) b.e.target = { pos: [x, y, z], quat: q }; };
      c.quat = quat_axis; c.quat_mul = quat_mul;
      c.effect = function (name, x, y, z, vx, vy, vz, n) { R.counters.effects++; if (fx.burst) fx.burst(name, x, y, z, vx || 0, vy || 0, vz || 0, n || 1); };
      c.fact = function (name, d) { const v = R.facts[name]; return v === undefined ? (d === undefined ? 0 : d) : v; };
      c.set_fact = function (name, v, zone) { R.set_fact(name, v, zone === undefined ? -1 : zone); };
      c.hurt = function (r, damage) { const p = b.e ? b.e.pos : [0, 0, 0]; let n = 0; for (let i = 0; i < cn; i++) { const dx = cx[i] - p[0], dz = cz[i] - p[2]; if (dx * dx + dz * dz <= r * r && cre.hurt) { cre.hurt(ch[i], damage, -1); n++; } } return n; };
      c.call = function (name, verb, a) { const e = by_name[name]; if (!e) return false; return R.verb(e, -1, verb, a || 0); };
      c.rand = rand;
      c.goto = function (st) { if (!b.def.states || !b.def.states[st]) fail("block `" + b.name + "`", "no state `" + st + "`"); b.st = st; b.entered = false; };
      c.time_in = function (st) { return R.time - b.t_in; };
      // ---- THE WORLD'S AI: a block that belongs to the world (bound to "world", or to anything) looks at the creatures and the things in it and tells the creatures what to do. It sees WHO they are (the family, the skills their mind has, what they
      // can do), WHERE (and how fast they go), what the things are (by tag, type, zone) and where; it tells a creature a message of its mind (c.tell: the goals block's order, a block's own message) and sets facts the creatures' goals read (c.set_fact)
      c.creatures = function (sel) {
        sel = sel || {};
        const out = [], z = sel.zone ? zone_by_name[sel.zone] : null;
        for (let i = 0; i < cn; i++) {
          const f = cinfo[i], cfg = f && f.cfg, name = cfg ? cfg.name : "", skills = cfg && cfg.mind ? cfg.mind.blocks.map(function (x) { return typeof x === "string" ? x : Array.isArray(x) ? x[0] : x.block; }) : [], ab = cfg && cfg.abilities ? cfg.abilities : [];
          if (sel.family !== undefined && sel.family !== name) continue;
          if (sel.skill !== undefined && skills.indexOf(sel.skill) < 0) continue;
          if (sel.ability !== undefined && ab.indexOf(sel.ability) < 0) continue;
          if (z && !in_zone(z, cx[i], cy[i], cz[i], 0, 0)) continue;
          out.push({ h: ch[i], x: cx[i], y: cy[i], z: cz[i], vx: cvx[i], vz: cvz[i], family: name, skills: skills, abilities: ab });
        }
        return out;
      };
      c.tell = function (h, id) { if (!cre.tell) return false; const a = []; for (let i = 2; i < arguments.length; i++) a.push(arguments[i]); return cre.tell(h, id, a); };
      c.entities = function (sel) {
        sel = sel || {};
        const out = [], z = sel.zone ? zone_by_name[sel.zone] : null;
        for (let i = 0; i < R.E.length; i++) {
          const e = R.E[i], tg = e.spec.tags || [];
          if (sel.tag !== undefined && tg.indexOf(sel.tag) < 0) continue;
          if (sel.type !== undefined && e.type !== sel.type) continue;
          if (sel.name !== undefined && e.name !== sel.name) continue;
          const w = e.bodies.length && phy.where ? phy.where(e.bodies[0]) : null, p = w || e.pos;
          if (z && !in_zone(z, p[0], p[1], p[2], 0, 0)) continue;
          out.push({ name: e.name, type: e.type, x: p[0], y: p[1], z: p[2], state: e.state, carried_by: e.carried_by || 0 });
        }
        return out;
      };
      c.each_creature = function (r, fn) {                                                                  // (the creatures within r metres of this block's entity, without making a list: fn(handle, x, y, z, vx, vz))
        const p = b.e ? b.e.pos : [0, 0, 0], r2 = r * r;
        for (let i = 0; i < cn; i++) { const dx = cx[i] - p[0], dz = cz[i] - p[2]; if (dx * dx + dz * dz <= r2 && Math.abs(cy[i] - p[1]) < 3) fn(ch[i], cx[i], cy[i], cz[i], cvx[i], cvz[i]); }
      };
      c.where = function (h) { for (let i = 0; i < cn; i++) if (ch[i] === h) return { x: cx[i], y: cy[i], z: cz[i] }; return null; };
      // a thing carried by a creature, and set down: the WORLD moves the body (a crate of the physics world follows the creature, `lift` metres over its feet, and is put where the world says), the creature carries nothing in its hands. The world's
      // AI decides who carries what (c.carry(name, handle, lift)), and where it comes to rest (c.drop(name, x, y, z)).
      c.carry = function (name, h, lift) { const e = by_name[name]; if (!e) return false; e.follow = { h: h, lift: lift === undefined ? 1.5 : lift }; e.carried_by = h; return true; };
      c.drop = function (name, x, y, z) {
        const e = by_name[name];
        if (!e) return false;
        e.follow = null; e.carried_by = 0;
        if (x !== undefined) e.target = { pos: [x, y, z], quat: [0, 0, 0, 1], once: true };
        return true;
      };
      // ROLES (the block of the world's AI gives them; the section "ROLES" above): c.roles() the names, c.assign(h, role, target, { key, ttl }), c.release(h), c.role_of(h), c.allot(role, jobs, crew, o)
      c.roles = function () { return role_names.slice(); };
      c.assign = function (h, role, target, o) { return R.assign(h, role, target, o && o.key !== undefined ? o.key : "", o && o.ttl > 0 ? o.ttl : 0); };
      c.release = function (h) { return R.release(h); };
      c.role_of = function (h) { return R.role_of(h); };
      c.allot = function (role, jobs, crew, o) { return R.allot(role, jobs, crew, o); };
      c.zone_rect = function (name) { const z = zone_by_name[name]; return z ? z.rect.slice() : null; };                   // ([x0, z0, x1, z1])
      c.in_zone = function (name, x, y, zz) { const z = zone_by_name[name]; return !!z && in_zone(z, x, y, zz, 0, 0); };
      return c;
    };
    const bind = function (name, target, params, where) {
      const def = defs[name];
      if (!def) fail(where, "no world block `" + name + "` (" + Object.keys(defs).sort().join(", ") + ")");
      const P = {};
      for (const k in (def.params || {})) P[k] = def.params[k];
      for (const k in (params || {})) { if (!def.params || def.params[k] === undefined) fail(where, "block `" + name + "`: `" + k + "` is not one of its settings (" + Object.keys(def.params || {}).join(", ") + ")"); P[k] = params[k]; }
      const e = target.kind === "entity" ? target.e : null, scene = target.kind === "scene" ? target.s : (e && e.scene >= 0 ? R.scenes[e.scene] : null);
      const b = { id: R.blocks.length, def: def, name: name, P: P, S: {}, e: e, scene: scene, st: null, entered: false, t_in: 0, c: null };
      b.c = make_ctx(b);
      R.blocks.push(b);
      if (def.init) def.init(b.c);
      b.st = typeof def.start === "function" ? def.start(b.c) : (def.start || (def.states ? Object.keys(def.states)[0] : null));       // (a block starts in the state the entity's own state says: a door that was built open begins open)
      return b;
    };
    spec.entities.forEach(function (e, i) { (e.blocks || []).forEach(function (bl) { bind(bl.name, { kind: "entity", e: R.E[i] }, bl.params, "entity `" + e.name + "`"); }); });
    spec.scenes.forEach(function (s, i) { (s.blocks || []).forEach(function (bl) { bind(bl.name || bl.block, { kind: "scene", s: R.scenes[i] }, bl.params, "scene `" + s.name + "`"); }); });
    spec.bindings.forEach(function (bd) {
      const e = by_name[bd.target], s = R.scene(bd.target);
      if (e) bind(bd.block, { kind: "entity", e: e }, bd.params, "bind `" + bd.block + "` to `" + bd.target + "`");
      else if (bd.target === "world") bind(bd.block, { kind: "world" }, bd.params, "bind `" + bd.block + "` to the world");                 // (the world's own AI: a block that is no entity's and no scene's)
      else if (s) bind(bd.block, { kind: "scene", s: s }, bd.params, "bind `" + bd.block + "` to scene `" + bd.target + "`");
    });
    R.bind = function (name, target, params) { const e = by_name[target], s = R.scene(target); if (!e && !s) fail("bind", "no entity or scene `" + target + "`"); return bind(name, e ? { kind: "entity", e: e } : { kind: "scene", s: s }, params, "bind"); };
    const run_block = function (b, dt) {
      const def = b.def, c = b.c;
      c.dt = dt; c.time = R.time;
      if (b.scene && b.scene.state !== SCENE.ACTIVE) return;                                              // (a dormant scene's blocks do not run)
      if (def.sensors) for (const k in def.sensors) c.s[k] = def.sensors[k](c);
      if (def.tick) def.tick(c, dt);
      if (def.states) {
        const st = def.states[b.st];
        if (!st) fail("block `" + b.name + "`", "no state `" + b.st + "`");
        if (!b.entered) { b.entered = true; b.t_in = R.time; if (st.enter) st.enter(c); }
        if (st.tick) st.tick(c, dt);
        const on = st.on || [];
        for (let i = 0; i < on.length; i++) if (on[i].when(c)) {
          if (st.leave) st.leave(c);
          if (!def.states[on[i].to]) fail("block `" + b.name + "`", "state `" + b.st + "` goes to `" + on[i].to + "`, which does not exist");
          b.st = on[i].to; b.entered = false;
          if (on[i]["do"]) on[i]["do"](c);
          break;
        }
      }
    };
    // an interaction of a creature (or of another block) with an entity: the verbs of the blocks bound to it; true when one took it
    R.verb = function (e, h, verb, a) {
      let took = false;
      for (let i = 0; i < R.blocks.length; i++) {
        const b = R.blocks[i];
        if (b.e !== e || !b.def.verbs || !b.def.verbs[verb]) continue;
        if (b.scene && b.scene.state !== SCENE.ACTIVE) continue;
        b.c.time = R.time;
        if (b.def.verbs[verb](b.c, { h: h, a: a }) !== false) took = true;
      }
      if (took) R.counters.interactions++; else R.counters.unhandled++;
      return took;
    };

    // ---- facts of the blackboard, as the page's blocks see them
    R.set_fact = function (name, v, zone) {
      if (zone >= 0) { (R.zfacts[zone] || (R.zfacts[zone] = Object.create(null)))[name] = v; } else R.facts[name] = v;
      diff.facts.push([name, v, zone]);
    };

    // ---- building the physics: the ground, the static boxes, the entities that move
    R.box_bodies = [];
    R.build = function () {
      if (phy.ground && spec.ground) phy.ground(spec.ground.y);
      spec.boxes.forEach(function (b) { if (b.cls === "static" && !b.virtual && phy.box) R.box_bodies[b.id] = phy.box(b); });                  // (a virtual box is the nav's alone: the deck of a drawbridge)
      R.E.forEach(function (e) { if (e.cls !== "static" && phy.entity) e.bodies = phy.entity(e.spec) || []; });
      return R;
    };

    // ---- the creatures: spawn rules and the life of an instance
    spec.spawn_rules.forEach(function (rl) { R.pop.rules.push({ rule: rl, pending: [], live: 0, started: false, serial: 0 }); });
    const reserved = [];                                                                                    // (a point where a spawn is under way: no other spawn comes near it)
    const rand_between = function (r) { return r[0] + (r[1] - r[0]) * rand(); };
    const point_free = function (x, y, z, clear, except) {
      for (let i = 0; i < cn; i++) { const dx = cx[i] - x, dz = cz[i] - z; if (dx * dx + dz * dz < clear * clear) return false; }
      for (let i = 0; i < reserved.length; i++) { const r = reserved[i]; if (r.rec !== except && (r.x - x) * (r.x - x) + (r.z - z) * (r.z - z) < clear * clear) return false; }
      return true;
    };
    const choose_point = function (pr, family, out, clear) {
      const rl = pr.rule, agent = rl.agent || (cre.agent ? cre.agent(family) : null) || spec.nav.default_agent;
      if (!R.nav) return false;
      for (let k = 0; k < 16; k++) {
        const zone = rl.zones.length ? rl.zones[Math.floor(rand() * rl.zones.length) % rl.zones.length] : null;
        if (zone === null) return false;
        if (!R.nav.random_in_zone(agent, zone, rand, out)) continue;
        if ((out.flags & 7) !== 0) continue;                                                              // (not on stairs, a ramp or in a doorway: ground that is a place to stand)
        if (point_free(out.x, out.y, out.z, clear, null)) { out.zone = zone; return true; }
      }
      return false;
    };
    const rec_count = function (pr) { let n = 0; for (const h in R.pop.recs) { const r = R.pop.recs[h]; if (r.pr === pr && r.state <= LIFE.ALIVE) n++; } return n + pr.pending.length; };
    const update_population = function (dt) {
      const out = { x: 0, y: 0, z: 0, zone: "" };
      for (let i = 0; i < R.pop.rules.length; i++) {
        const pr = R.pop.rules[i], rl = pr.rule;
        if (!pr.started) { pr.started = true; for (let k = 0; k < rl.initial; k++) pr.pending.push({ due: R.time + 0.05 + k * 0.1, family: null }); }
        for (let guard = 0; rec_count(pr) < rl.cap && guard < 64; guard++) pr.pending.push({ due: R.time + rand_between(rl.respawn), family: null });   // (a slot is filled again `respawn` seconds after the one before was returned)
        for (let k = pr.pending.length - 1; k >= 0; k--) {
          const p = pr.pending[k];
          if (p.due > R.time) continue;
          const family = rl.family[Math.floor(rand() * rl.family.length) % rl.family.length];
          if (!choose_point(pr, family, out, rl.clear)) { p.due = R.time + 2; R.counters.spawn_failed++; continue; }
          pr.pending.splice(k, 1);
          const z = zone_by_name[out.zone];
          if (z && z.scene && scene_ids[z.scene] !== undefined && R.scenes[scene_ids[z.scene]].state !== SCENE.ACTIVE) set_scene(R.scenes[scene_ids[z.scene]], SCENE.ACTIVE);      // (a spawn wakes the scene it is in)
          const rec = { h: -1, pr: pr, family: family, state: LIFE.SPAWNING, t: R.time, x: out.x, y: out.y, z: out.z, yaw: rand() * 6.2832, due: R.time + 0.4 };
          R.pop.recs["s" + (pr.serial++) + "_" + i] = rec;
          reserved.push({ x: out.x, z: out.z, rec: rec });
          if (fx.burst) fx.burst("spawn", out.x, out.y, out.z, 0, 0.5, 0, 12);
        }
      }
      for (const key in R.pop.recs) {
        const r = R.pop.recs[key], rl = r.pr.rule;
        if (r.state === LIFE.SPAWNING && R.time >= r.due) {
          const sc = rl.scale ? rl.scale[0] + (rl.scale[1] - rl.scale[0]) * rand() : 1;
          const pick = function (x) { return Array.isArray(x) ? x[Math.floor(rand() * x.length) % x.length] : x; };                                  // (a list of looks or skins: one at each spawn)
          const h = cre.spawn ? cre.spawn(r.family, r.x, r.y, r.z, r.yaw, { scale: sc, rule: rl.id, variant: pick(rl.variant), skin: pick(rl.skin), mind: rl.mind }) : -1;
          for (let q = reserved.length - 1; q >= 0; q--) if (reserved[q].rec === r) reserved.splice(q, 1);
          if (h === null || h === undefined || h < 0) { delete R.pop.recs[key]; r.pr.pending.push({ due: R.time + 1, family: null }); R.counters.spawn_failed++; continue; }
          r.h = h; r.state = LIFE.ALIVE; r.t = R.time; R.counters.spawned++;
          delete R.pop.recs[key]; R.pop.recs[h] = r;
        } else if (r.state === LIFE.DEAD && R.time - r.t >= rl.corpse) {
          r.state = LIFE.DESPAWNING; r.t = R.time;
          if (fx.burst) { const p = r.pos || [r.x, r.y, r.z]; fx.burst("despawn", p[0], p[1], p[2], 0, 0.5, 0, 10); }
        } else if (r.state === LIFE.DESPAWNING && R.time - r.t >= 1) {
          if (cre.release) cre.release(r.h);
          R.counters.despawned++;
          delete R.pop.recs[key];                                                                          // (the population was filled up when it died: its place in the rule is free since then, only its slot was kept)
        } else if (r.state === LIFE.ALIVE && cre.alive && !cre.alive(r.h)) {                                // (it is gone some other way: its slot is free)
          delete R.pop.recs[key];
        }
      }
    };
    // a creature's own word about its life (sw.life): 3 dying, 4 dead (the page keeps the body for the corpse time, then removes it and returns the slot to the pool)
    R.life = function (h, st) {
      const r = R.pop.recs[h];
      const died = function () { if (!cre.died) return; let vx = 0, vz = 0; for (let i = 0; i < cn; i++) if (ch[i] === h) { vx = cvx[i]; vz = cvz[i]; break; } cre.died(h, [vx, 0, vz]); };      // (the host lets the body fall: ragdoll.js)
      if (!r) { if (st === LIFE.DYING || st === LIFE.DEAD) died(); return false; }                        // (a creature that no spawn rule made: it still falls)
      if (st === LIFE.DYING && r.state === LIFE.ALIVE) { r.state = LIFE.DYING; r.t = R.time; R.counters.died++; died(); return true; }
      if (st === LIFE.DEAD && (r.state === LIFE.DYING || r.state === LIFE.ALIVE)) { if (r.state === LIFE.ALIVE) { R.counters.died++; died(); } r.state = LIFE.DEAD; r.t = R.time; return true; }
      return false;
    };
    R.life_of = function (h) { const r = R.pop.recs[h]; return r ? r.state : -1; };
    R.population = function () {
      const o = { rules: {}, states: [0, 0, 0, 0, 0, 0] };
      R.pop.rules.forEach(function (pr) { o.rules[pr.rule.id] = { cap: pr.rule.cap, alive: 0, pending: pr.pending.length }; });
      for (const k in R.pop.recs) { const r = R.pop.recs[k]; o.states[r.state]++; if (r.state === LIFE.ALIVE) o.rules[r.pr.rule.id].alive++; }
      return o;
    };

    // ---- props that the creatures throw into the world (pure.js spawn_prop): the kit makes the entity, the physics its body; the oldest is taken out when there are too many
    R.add_prop = function (type, x, y, z, vx, vy, vz) {
      if (!Spec || !Kit) return -1;
      const w = Spec.create("loose", Kit);
      try { w.add(type, { pos: [x, y, z] }); } catch (e) { return -1; }
      const es = w.build({}).spec.entities[0];
      const bodies = phy.entity ? (phy.entity(es) || []) : [];
      R.loose.push({ spec: es, bodies: bodies });
      if (phy.velocity) bodies.forEach(function (b) { phy.velocity(b, vx, vy, vz); });
      while (R.loose.length > MAX_LOOSE) { const old = R.loose.shift(); old.bodies.forEach(function (b) { if (phy.park) phy.park(b); }); }
      R.counters.props++;
      return R.loose.length - 1;
    };

    // ---- the workers' requests (pure.js flush): numbers in rows of STRIDE, and the names that are new
    R.on_requests = function (m) {
      for (let i = 0; i < m.names.length; i++) names[m.names_at + i] = m.names[i];
      for (let i = 0; i < m.n; i++) {
        const r = m.data.slice(i * STRIDE, i * STRIDE + STRIDE);
        R.counters.requests++;
        switch (r[0]) {
          case R_EFFECT: R.counters.effects++; if (fx.burst) fx.burst(names[r[1]], r[2], r[3], r[4], r[5], r[6], r[7], r[8]); break;
          case R_PROP: R.add_prop(names[r[1]], r[2], r[3], r[4], r[5], r[6], r[7]); break;
          case R_IMPULSE: { const e = R.E[r[1]]; if (e && phy.velocity) e.bodies.forEach(function (b) { phy.velocity(b, r[2], r[3], r[4]); }); break; }
          case R_INTERACT: { const e = R.E[r[2]]; if (e) R.verb(e, r[1], names[r[3]], r[4]); break; }
          case R_STATE: { const e = R.E[r[1]]; if (e) R.set_state(e, names[r[2]], r[3]); break; }
          case R_LIFE: R.life(r[1], r[2]); break;
          case R_SIT: {                                                                                      // (a creature sits down on an anchored seat: its hips go to the anchor and stay there, species.js sp.sit)
            const sl = spec.slots[r[2]];
            let ok = false;
            if (sl && cre.sit) ok = !!cre.sit(r[1], { x: sl.wpos[0], y: sl.wpos[1], z: sl.wpos[2], yaw: sl.wyaw, lift: sl.seat ? sl.seat.lift : -1, floor: sl.stand[1], dur: r[3] });
            if (ok) R.counters.sat++; else if (cre.tell) cre.tell(r[1], MSG_SIT_REFUSED, [r[2]]);
            break;
          }
          case R_STAND: {                                                                                    // (and gets up: to the seat's stand point, facing away from the seat)
            const sl = spec.slots[r[2]];
            if (sl && cre.stand) { cre.stand(r[1], { x: sl.stand[0], y: sl.stand[1], z: sl.stand[2], yaw: Math.atan2(sl.stand[0] - sl.wpos[0], sl.stand[2] - sl.wpos[2]), dur: r[3] }); R.counters.stood++; }
            break;
          }
          case R_FACT: { const nm = names[r[1]]; if (r[3] >= 0) (R.zfacts[r[3]] || (R.zfacts[r[3]] = Object.create(null)))[nm] = r[2]; else R.facts[nm] = r[2]; break; }
          default: break;
        }
      }
    };

    // ---- once a frame
    R.tick = function (dt) {
      R.time += dt;
      snapshot_creatures();
      update_scenes(dt);
      for (let i = 0; i < R.blocks.length; i++) run_block(R.blocks[i], dt);
      for (let i = 0; i < R.E.length; i++) {                                                               // (what a creature carries follows it, over its head; one whose carrier is gone stays where it is)
        const e = R.E[i], f = e.follow;
        if (!f) continue;
        let k = -1;
        for (let j = 0; j < cn; j++) if (ch[j] === f.h) { k = j; break; }
        if (k < 0) { e.follow = null; e.carried_by = 0; continue; }
        e.target = { pos: [cx[k], cy[k] + f.lift, cz[k]], quat: [0, 0, 0, 1], follow: true };
      }
      for (let i = 0; i < R.E.length; i++) {                                                               // (a kinematic body is driven to the pose its block gave: by velocity, so that it pushes what it meets)
        const e = R.E[i];
        if (e.target && !e.parked) {
          e.pos = e.target.pos.slice();
          if (phy.move) e.bodies.forEach(function (b) { phy.move(b, e.target.pos, e.target.quat, dt); if ((e.target.follow || e.target.once) && phy.velocity) phy.velocity(b, 0, 0, 0); });
          if (e.target.once) e.target = null;                                                              // (put there once, and the physics world has it)
        }
      }
      update_population(dt);
      if (dirty()) {
        if (wk.state) wk.state({ gates: diff.gates.slice(), ent: diff.ent.slice(), scenes: diff.scenes.slice(), facts: diff.facts.slice(), now: R.time });
        diff.gates.length = 0; diff.ent.length = 0; diff.scenes.length = 0; diff.facts.length = 0;
      }
    };
    R.stats = function () { return { time: R.time, creatures: cn, blocks: R.blocks.length, roles: roles.size, scenes: R.scenes.map(function (s) { return [s.name, s.state]; }), counters: R.counters, population: R.population() }; };
    R.LIFE = LIFE; R.SCENE = SCENE;
    return R;
  }
  return { create: create, LIFE: LIFE, SCENE: SCENE, STRIDE: STRIDE, quat_axis: quat_axis, quat_mul: quat_mul };
});

// ========================================================================================================================
// world_host
// ========================================================================================================================
packing()("happy_world_host", function happy_world_host() {
  "use strict";
  // HAPPY WORLD HOST: a world on a REAL PAGE (SYSTEM.md). The sandbox that reads a world definition file and makes it live: it builds the physics bodies (the engine's `engine.phy`: the static boxes of walls, floors, steps
  // and furniture, the kinematic leaves and blades that world blocks move by velocity, the dynamic crates), has the worker bake the same navigation map and serve the slots, registers the world's blocks and the creature blocks
  // (system.worker_modules), makes a system species of every creature file it is given, runs the page's runtime (world/world_runtime.js) when the page says so and spawns the first creatures by the rules.
  //     const host = create(engine, system, { fx: function (name, x, y, z, vx, vy, vz, n) { return shown; } });
  //     host.load({ world: "/world/worlds/house.world.js", creatures: { mannequin: "/creatures/mannequin.js" }, gaits: [...], actions: [...] }).then(function () { host.start(); });
  //   THE HOST DRAWS NOTHING AND HOOKS NOTHING INTO THE ENGINE'S FRAME: the page owns the frame and the rendering (a sandbox page of the first repository). Once a frame, before anything is drawn, the page calls
  //   host.update(dt) (the runtime's tick: the doors, the lamps, the spawner, the requests) and host.each_box(fn) (what there is to show: fn(pos, quat, sx, sy, sz, color), with scratch arrays that fn must not keep, so the page puts the boxes into the
  //   engine's batches ONCE and every pass it has (the shadow maps, the scene) draws them); the creatures are system's (system.render_all() in each pass), the effects go to the page's own `fx` (below).
  //   host.R (the runtime: R.entity(name), R.scene(name), R.population(), R.stats()), host.spec, host.nav (the page's bake), host.families[name] = { sp, cfg, def }, host.log(what happened, newest last)
  //   host.remake(name, creature, { tweak(def) }) -> Promise of { family, note }   a family made again where it stands (the AI editor's live preview), or a NEW one made while the world runs (the sandbox's Add a creature)
  //   host.load({ ..., creatures_for(spec) -> { key: url | text } })  the creatures the world's own spawn rules name, found after its file is read      create(engine, system, { tolerant: true })  a creature that cannot be made is left out (host.skipped says which)
  //   host.cut = y: the boxes whose top is above that height are not given to each_box (a cutaway of a house: 2.65 shows the ground floor, Infinity everything)
  //   host.spawn(family, x, y, z, yaw) -> handle | null      host.hurt(handle, damage)      host.kill(handle)      host.where(handle) -> [x, y, z] | null      host.each_creature(fn)      host.stats()      host.start()      host.stop()
  // The ports the runtime is given: phy (the engine's bodies), creatures (system's species), fx (the page's `opts.fx(name, x, y, z, vx, vy, vz, n)`, which returns true when it showed the effect; without it the effects are counted and not shown),
  // worker (system.worker_world_state). Nothing here edits the engine: the world uses system's own command queue and the physics API the page already has.
  // Node 14: no optional chaining, no ??.
  const Spec = world_libs.happy_world_spec();
  const Kit = world_libs.happy_world_kit();
  const Nav = pure.happy_world_nav();
  const RT = world_libs.happy_world_runtime();
  const WB = world_libs.happy_world_blocks();
  let CF = null;                                                                       // (the creature file's module: from the generators' bundle, given by the page when a host is made)
  const Items = world_libs.happy_world_items();             // (a world of sdf pieces: one species of each item, one instance of each placement)
  const HURT_MSG = 7001;
  const PHS_DYNAMIC = 2, PHS_STATIC = 4, PHS_KINEMATIC = 8;
  const COLORS = { floor: [0.62, 0.58, 0.52], wall: [0.78, 0.74, 0.68], step: [0.55, 0.55, 0.62], rail: [0.45, 0.32, 0.22], ramp: [0.45, 0.62, 0.8], rung: [0.5, 0.4, 0.3], roof: [0.56, 0.3, 0.24], prop: [0.6, 0.45, 0.3], box: [0.6, 0.6, 0.6] };
  const TYPE_COLORS = { door: [0.5, 0.33, 0.2], crate: [0.78, 0.55, 0.28], barrel: [0.55, 0.38, 0.25], chair: [0.6, 0.42, 0.3], sofa: [0.4, 0.5, 0.65], bed: [0.75, 0.7, 0.85], table: [0.65, 0.5, 0.35], lamp: [1.0, 0.9, 0.5], windmill: [0.9, 0.9, 0.85], drawbridge: [0.55, 0.4, 0.28], plate: [0.7, 0.7, 0.3], stove: [0.35, 0.35, 0.38], cupboard: [0.55, 0.4, 0.28], chest: [0.5, 0.35, 0.22], wardrobe: [0.5, 0.36, 0.25], curtain: [0.7, 0.3, 0.35], sword: [0.8, 0.8, 0.85], rifle: [0.3, 0.3, 0.32], rug: [0.65, 0.25, 0.25], shelf: [0.55, 0.4, 0.3], desk: [0.6, 0.45, 0.32], counter: [0.65, 0.6, 0.55], bench: [0.58, 0.42, 0.3], stool: [0.6, 0.42, 0.3] };
  const q_yaw = function (y) { return [0, Math.sin(y / 2), 0, Math.cos(y / 2)]; };
  const fetch_text = function (u) { return fetch(u, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status + " " + u); return r.text(); }); };

  function create(engine, system, opts) {
    opts = opts || {};
    CF = system.creature_file_module();
    const phy = engine.phy;
    const host = { skipped: [], engine: engine, system: system, R: null, spec: null, nav: null, families: {}, by_handle: Object.create(null), logs: [], started: false, drawn: 0, cut: Infinity, error: null, counters: { frames: 0, effects: 0, effects_shown: 0, moved: 0 } };
    const log = function (m) { host.logs.push(m); if (host.logs.length > 200) host.logs.shift(); if (typeof console !== "undefined" && opts.verbose) console.log("happy_world: " + m); };
    host.log = function () { return host.logs; };
    const bodies = [];                                                                                      // (every body the host made: [{ id, kind, half | shapes, color, entity }]: what is drawn)
    const kin = [];                                                                                         // (kinematic bodies and their last commanded pose)
    // ---- the looks: a world of sdf pieces (world/world_items.js). Every entity that has a `look` is an INSTANCE of its item's species; its boxes are bodies of the physics world and are not drawn. host.items[name] = { sp, def, count },
    // host.looks[entity name] = { sp, c, e, at, q } (the instance of a placement and where it was put last)
    const look_dyn = [], look_owner = Object.create(null);                                                  // (the loose bodies whose instance follows them; the entities (ids) that have a look: their boxes are not drawn)
    host.items = Object.create(null); host.looks = Object.create(null);
    const look_put = function (name, pos, q) {
      const L = host.looks[name];
      if (!L) return;
      const a = L.at, b = L.q;
      if (a && Math.abs(a[0] - pos[0]) < 1e-4 && Math.abs(a[1] - pos[1]) < 1e-4 && Math.abs(a[2] - pos[2]) < 1e-4 && Math.abs(b[0] - q[0]) + Math.abs(b[1] - q[1]) + Math.abs(b[2] - q[2]) + Math.abs(b[3] - q[3]) < 1e-5) return;
      L.at = [pos[0], pos[1], pos[2]]; L.q = [q[0], q[1], q[2], q[3]];
      L.sp.set_root(L.c, pos[0], pos[1], pos[2], L.q);
    };

    // ---- the physics port: the engine's bodies
    const make_body = function (type, pos, q) {
      const b = phy.body({ type: type, pos: pos });
      return b;
    };
    const ports = { phy: {}, creatures: {}, fx: {}, worker: {} };
    if (opts.solver_iterations !== undefined && phy.set_world) phy.set_world({ solver_iterations: opts.solver_iterations });                          // (the engine's solver: more iterations hold a ragdoll's joints)
    ports.phy.ground = function (y) { if (opts.ground === "own" && phy.plane_body) phy.plane_body(y, 0, 1, 0); };                                            // (the debug scene has its own plane at y = 0)
    ports.phy.box = function (b) {
      const body = make_body(PHS_STATIC, b.pos);
      const s = phy.shape_box(b.half[0], b.half[1], b.half[2]);
      phy.shape_material(s, 0, 0.6, 0.1);
      phy.body_add_shape(body, s); phy.body_setup_mass(body);
      if (b.yaw) { const q = q_yaw(b.yaw); phy.body_set_orientation(body, q[0], q[1], q[2], q[3]); }
      bodies.push({ id: body, kind: b.kind, half: b.half, color: b.color || COLORS[b.kind] || COLORS.box, p: b.pos, q: q_yaw(b.yaw || 0), dynamic: false, owner: b.owner });
      return body;
    };
    ports.phy.entity = function (e) {
      // a compound body: every shape of the entity, at its place in the entity's frame (the body's origin is the entity's `pos`)
      // A MOVING entity (a door, a bridge, a sail: `cls` kinematic) is a STATIC body that is put where it should be every frame, as the lab's platforms are: this engine's kinematic body, where it touches a static box (a door in its frame, a leaf on a bank) or the
      // ground, goes NaN and takes the bodies near it too. The page keeps its pose (rec.p, rec.q: `each_box` draws from it), and a creature's ray sees it as a prop like any static box.
      const moving = e.cls === "kinematic", type = moving ? PHS_STATIC : PHS_DYNAMIC;
      const body = make_body(type, e.pos);
      const density = e.mass > 0 ? e.mass / Math.max(1e-6, e.shapes.reduce(function (v, s) { return v + s.size[0] * s.size[1] * s.size[2]; }, 0)) : 1;
      const shapes = [];
      e.shapes.forEach(function (sh) {
        const s = phy.shape_box(sh.size[0] / 2, sh.size[1] / 2, sh.size[2] / 2);
        phy.shape_material(s, moving ? 0 : density, 0.6, 0.1);
        phy.shape_relative(s, sh.pos, q_yaw(sh.yaw || 0));
        phy.body_add_shape(body, s);
        shapes.push({ pos: sh.pos, half: [sh.size[0] / 2, sh.size[1] / 2, sh.size[2] / 2], yaw: sh.yaw || 0 });
      });
      phy.body_setup_mass(body);
      if (e.yaw) { const q = q_yaw(e.yaw); phy.body_set_orientation(body, q[0], q[1], q[2], q[3]); }
      if (!moving && phy.body_allow_sleep) phy.body_allow_sleep(body, true);
      const rec = { id: body, kind: e.type, shapes: shapes, color: e.color || TYPE_COLORS[e.type] || COLORS.prop, entity: e.name, dynamic: true, moving: moving, cls: e.cls, p: e.pos.slice(), q: q_yaw(e.yaw || 0), last: null, last_q: null, look: e.look || null };
      if (e.look && !moving) look_dyn.push(rec);                                                              // (a loose piece that has a look: its instance follows the body)
      bodies.push(rec);
      if (moving) kin.push(rec);
      return [body];
    };
    // a moving entity is put at its pose (`move(id, pos, q, dt)`: q is the true turn, [x, y, z, w]); the body's own position is the engine's, and is not read back
    ports.phy.move = function (id, pos, q, dt) {
      const rec = bodies.find(function (r) { return r.id === id; });
      if (!rec) return;
      phy.body_set_position(id, pos[0], pos[1], pos[2]); phy.body_set_orientation(id, q[0], q[1], q[2], q[3]);
      rec.p = pos.slice(); rec.q = q.slice(); host.counters.moved++;
      if (rec.look) look_put(rec.entity, pos, q);                                                             // (a door's leaf, a sail: the instance goes where the body was put)
    };
    ports.phy.where = function (id) { const w = id && id.world_position; return w ? [w[0], w[1], w[2]] : null; };                       // (where a body is now: the engine's own, read back)
    ports.phy.velocity = function (id, vx, vy, vz) { phy.body_set_velocity(id, vx, vy, vz); };
    ports.phy.park = function (id) { phy.body_park(id); };
    ports.phy.unpark = function (id) { phy.body_unpark(id); };
    ports.phy.snapshot = function (id) {
      const rec = bodies.find(function (r) { return r.id === id; });
      if (rec && rec.moving) return { p: rec.p.slice(), q: rec.q.slice() };                                  // (a moving entity: where it was put)
      const w = id.world_position, r = id.world_rotation; return w ? { p: [w[0], w[1], w[2]], q: [r[0], r[1], r[2], -r[3]] } : null;
    };
    ports.phy.restore = function (id, s) {
      if (!s) return;
      phy.body_set_position(id, s.p[0], s.p[1], s.p[2]); phy.body_set_orientation(id, s.q[0], s.q[1], s.q[2], s.q[3]); phy.body_set_velocity(id, 0, 0, 0);
      const rec = bodies.find(function (r) { return r.id === id; });
      if (rec && rec.moving) { rec.p = s.p.slice(); rec.q = s.q.slice(); }
    };

    // ---- the creatures port: system's species. A handle is the worker's: js id << 16 | slot
    const handle_of = function (sp, slot) { return (sp.js_id << 16) | slot; };
    ports.creatures.each = function (fn) {
      for (const name in host.families) {
        const sp = host.families[name].sp, m = sp.mirror;
        for (let s = 0; s < sp.max_instances; s++) if (sp.alive[s] === 1) fn(handle_of(sp, s), m[s * 8], m[s * 8 + 1], m[s * 8 + 2], host.families[name]);
      }
    };
    ports.creatures.spawn = function (family, x, y, z, yaw, o) {
      const f = host.families[family];
      if (!f) { log("spawn: no family `" + family + "`"); return null; }
      let c;
      const so = { x: x, y: y, z: z, scale: o && o.scale > 0 ? o.scale : 1, yaw: yaw || 0 };
      if (o && o.variant !== undefined) so.variant = o.variant;                                         // (the look and the skin that the spawn rule says: a species that has none is not affected)
      if (o && o.skin !== undefined) so.skin = o.skin;
      try { c = f.sp.spawn(so); } catch (e) { log("spawn refused: " + (e && e.message || e)); return null; }
      const h = handle_of(f.sp, c.slot);
      host.by_handle[h] = { sp: f.sp, c: c, family: family };
      return h;
    };
    ports.creatures.release = function (h) {
      const r = host.by_handle[h];
      if (!r) return;
      try { r.sp.release(r.c); } catch (e) { log("release: " + (e && e.message || e)); }
      delete host.by_handle[h];
    };
    // A creature DIES (the runtime: its mind said dying): its body falls. The worker does it (world.cpp: a ragdoll of the physics world's own bodies and joints, made from the skeleton, the rig and the skin, nothing a frame from the page): one word,
    // with the speed it had. `opts.ragdoll: false` leaves the body standing; every species has a ragdoll (a person, a hound, a spider, a tank), unless its definition says `ragdoll: false`. `opts.fall_dir(handle) -> [dx, dz]` says the way it falls
    // (the way it was hit), `opts.fall_push` how hard. `opts.solver_iterations` (the engine's 8 by default) makes the world's solver hold the joints better (16: a ragdoll comes to rest in two seconds, and its bones go less far into the floor; it costs
    // the world's step a half as much again while there are bodies).
    ports.creatures.died = function (h, vel) {
      const r = host.by_handle[h];
      if (!r || opts.ragdoll === false || !r.sp.has_ragdoll) return;
      try { r.sp.ragdoll(r.c, true, { velocity: vel || [0, 0, 0], dir: opts.fall_dir ? opts.fall_dir(h) : undefined, push: opts.fall_push }); } catch (e) { log("ragdoll: " + (e && e.message || e)); }
    };
    ports.creatures.alive = function (h) { const r = host.by_handle[h]; return !!r && r.sp.alive[r.c.slot] === 1; };
    ports.creatures.hurt = function (h, damage, from) { const r = host.by_handle[h]; if (r) r.sp.worker_msg(HURT_MSG, r.c.slot, damage, from === undefined ? -1 : from); };
    // THE WORLD'S AI talks to the creatures: it tells one a message of its mind (`sp.worker_msg`: the goals block has an order, the blocks list their messages), and asks what a creature is (its family, its skills)
    // A BLAST of a creature's thrown prop (runtime.js `throw.blast`): the page has told every creature it reached (zones: the shock and the zone's health) and here the world's creatures take it as HIT POINTS too: the health block's message, with the damage
    // that fell to them by the distance, and who threw it. A creature that is not the world's (the lab's, a test's) is not in by_handle: nothing is sent for it.
    const prev_on_prop = system.on_prop;
    system.on_prop = function (sp, h, kind, info) {
      if (typeof prev_on_prop === "function") prev_on_prop(sp, h, kind, info);
      if (kind !== "blast" || !info || !info.hits) return;
      const from = h.parent ? handle_of(sp, h.parent.slot) : -1;
      for (let i = 0; i < info.hits.length; i++) { const x = info.hits[i], hd = handle_of(x.sp, x.c.slot); if (x.damage > 0 && host.by_handle[hd]) ports.creatures.hurt(hd, x.damage, from); }
    };
    ports.creatures.tell = function (h, id, args) { const r = host.by_handle[h]; if (!r) return false; r.sp.worker_msg.apply(r.sp, [id, r.c.slot].concat(args || [])); return true; };
    ports.creatures.agent = function (family) { const f = host.families[family]; return f ? f.cfg.nav.agent : "person"; };
    // A creature SITS on an anchored seat (world/world_items.js): its hips go to the seat's anchor (the cushion's surface and the creature's own lift: how far its hips ride over what it sits on, 0.15 of the height of its hips by default,
    // scaled as it is) in `dur` seconds, and stay there with the gait off (species.js sp.sit); `floor` is the height its feet stand on. A creature with no legs cannot (false). stand: it gets up to a place, facing a way
    const scale_of = function (sp, c) { const s = sp.mirror[c.slot * 8 + 3]; return s > 0 ? s : (c.scale0 > 0 ? c.scale0 : 1); };
    ports.creatures.sit = function (h, o) {
      const r = host.by_handle[h];
      if (!r || !r.sp.legs || typeof r.sp.sit !== "function") return false;
      const sc = scale_of(r.sp, r.c), hh = r.sp.sk.head[r.sp.legs.body * 3 + 1], lift = o.lift >= 0 ? o.lift : 0.15 * hh * sc;
      try { return r.sp.sit(r.c, { at: [o.x, o.y + lift, o.z], yaw: o.yaw, dur: o.dur, floor: o.floor }); } catch (e) { log("sit refused: " + (e && e.message || e)); return false; }
    };
    ports.creatures.stand = function (h, o) {
      const r = host.by_handle[h];
      if (!r || typeof r.sp.stand !== "function") return false;
      try { return r.sp.stand(r.c, { to: [o.x, o.y, o.z], yaw: o.yaw, dur: o.dur }); } catch (e) { log("stand refused: " + (e && e.message || e)); return false; }
    };

    // ---- effects: asked for by name (dust spark smoke spawn despawn creak click ...); how they look, and drawing them, is the page's (opts.fx)
    ports.fx.burst = function (name, x, y, z, vx, vy, vz, n) {
      host.counters.effects++;
      if (typeof opts.fx !== "function") return;
      try { if (opts.fx(name, x, y, z, vx, vy, vz, n || 1)) host.counters.effects_shown++; }
      catch (e) { if (!host.fx_error) { host.fx_error = String(e && e.message || e); log("effects: " + host.fx_error); } }
    };
    ports.worker.state = function (d) { system.worker_world_state(d); };

    // ---- loading: the world file, the creature files, the libraries, the blocks, the worker's copy
    host.load = function (o) {
      return Promise.resolve().then(function () {
        return o.world_text !== undefined ? o.world_text : fetch_text(o.world);
      }).then(function (world_text) {
        const built = Spec.load(world_text, o.name || "world", Kit);
        host.built = built; host.spec = built.spec;
        const creature_texts = Object.assign({}, o.creatures || {}, o.creatures_for ? o.creatures_for(built.spec, built) || {} : {}), names = Object.keys(creature_texts);          // (creatures_for(spec): the ones the world's own rules name, found after the file is read)
        // (a creature is its TEXT or the URL of its text: a URL is one line, a file's text never is, so a text that begins with a `//` comment is not fetched)
        return Promise.all(names.map(function (k) { const v = creature_texts[k]; return typeof v === "string" && v.indexOf("\n") < 0 && /^\s*(\/|https?:|\.)/.test(v) ? fetch_text(v) : Promise.resolve(v); })).then(function (texts) {
          texts.forEach(function (tx, i) {
            const c = typeof tx === "string" ? CF.load(tx) : tx, comp = CF.compile(c, { required: built.spec.required_blocks, give: Spec.gives_for(built.spec, c) });
            host.families[comp.def.name] = { cfg: comp.cfg, def: comp.def, agent: comp.agent, sp: null };
            if (comp.agent) built.spec.nav.agents[comp.agent.name] = { radius: comp.agent.radius, height: comp.agent.height, step: comp.agent.step, slope: comp.agent.slope, drop: comp.agent.drop };      // (a creature brings its own profile: the nav is baked with it)
          });
          (host.spec.spawn_rules || []).forEach(function (rl) { rl.family.forEach(function (fam) { if (!host.families[fam]) { if (opts.tolerant) { host.skipped.push({ family: fam, error: "no creature file of this host is called that (the spawn rule `" + rl.id + "`)" }); return; } throw new Error("happy_world_host: the spawn rule `" + rl.id + "` names the family `" + fam + "`, which no creature file of this world's host is (" + Object.keys(host.families).join(", ") + ")"); } }); });
        });
      }).then(function () {
        // the libraries come from the pack: the gait libraries and the action sets by name (system.use: the page's registry and the worker's), the blocks (system.ai.use: the worker registers them)
        return (o.gaits && o.gaits.length) || (o.actions && o.actions.length) ? system.use({ gaits: o.gaits || [], actions: o.actions || [] }) : undefined;
      }).then(function () {
        return system.ai.use(o.blocks === undefined ? "all" : o.blocks);
      }).then(function () {
        system.worker_world(host.spec, host.built.creature_blocks);
        // the species: a body of each family, with its cfg (the worker's `api.cfg`)
        const names = Object.keys(host.families);
        return names.reduce(function (p, n) {
          return p.then(function () {
            const f = host.families[n];
            return Promise.resolve(body_made(f.def)).then(function () { f.sp = system.species(f.def, { cfg: f.cfg }); f.sp.on_worker_event = function (slot, gen, tag, value) { if (opts.on_event) opts.on_event(n, slot, gen, tag, value); }; }).catch(function (e) {
              if (!opts.tolerant) throw e;                                                                      // (a creature whose body cannot be made (a person whose data is not there): the world goes on without it, and says so)
              host.skipped.push({ family: n, error: String(e && e.message || e) }); delete host.families[n]; log("no family `" + n + "`: " + (e && e.message || e));
            });
          });
        }, Promise.resolve());
      }).then(function () {
        return make_items();                                                                                   // (the pieces of the world's sdf: their species and instances, before the runtime makes the bodies)
      }).then(function () {
        if (opts.tolerant) (host.spec.spawn_rules || []).forEach(function (rl) {                               // (a rule whose creatures could not be had spawns the ones that could, or nothing)
          const ok = rl.family.filter(function (fam) { return host.families[fam] && host.families[fam].sp; });
          if (ok.length) rl.family = ok; else { rl.cap = 0; rl.initial = 0; }                                    // (none: the rule keeps its names, and spawns nobody)
        });
        const blocks = Object.assign({}, WB.blocks, host.built.blocks);
        host.R = RT.create({ spec: host.spec, blocks: blocks, ports: ports, Nav: Nav, Spec: Spec, Kit: Kit, rand: opts.rand || Math.random });
        host.nav = host.R.nav;
        host.R.build();
        system.on_world_requests = function (m) { host.R.on_requests(m); };
        if (opts.on_ready) opts.on_ready(host);
        return host;
      }).catch(function (e) { host.error = String(e && e.stack || e); throw e; });
    };

    // ---- running: the PAGE calls update(dt) once a frame, before it draws anything (the host has no handler in the engine's frame: where in the frame it runs is the page's to say)
    // the body that has to be MADE before the species: an sdf (the mesher), or a person of the human system (`body: { human: {...} }`: system.build_human, asynchronous, once for each definition)
    const body_made = function (d) {
      const own = d.human ? system.build_human(d) : d.sdf || d.family_props ? system.build_sdf(d) : null;
      return d.human && d.family_props ? Promise.resolve(own).then(function () { return system.build_props(d); }) : own;                        // (a person's props are made after the person: runtime.js)
    };
    // the SPECIES of the items the world places (the sdf meshed once, system.build_sdf, then the species: one bone, room for every placement) and an INSTANCE for each placement; an item that cannot be made is left out (host.skipped says so)
    // and its pieces are drawn as the boxes of their proxy
    const make_items = function () {
      const made = host.built.items || {}, names = Object.keys(made).filter(function (n) { return made[n].sdf && made[n].count > 0; });
      return names.reduce(function (p, n) {
        return p.then(function () {
          const def = Items.species_def(n, made[n].sdf, made[n].count);
          return Promise.resolve(system.build_sdf(def)).then(function () { host.items[n] = { sp: system.species(def, { static: true }), def: def, count: made[n].count }; });
        }).catch(function (e) {
          if (!opts.tolerant) throw e;
          host.skipped.push({ family: "item " + n, error: String(e && e.message || e) }); log("no item `" + n + "`: " + (e && e.message || e));
        });
      }, Promise.resolve()).then(function () {
        host.spec.entities.forEach(function (e) {
          const it = e.look ? host.items[e.look] : null;
          if (!it) return;
          let c;
          try { c = it.sp.spawn({ x: e.pos[0], y: e.pos[1], z: e.pos[2], scale: e.scale || 1, yaw: e.yaw || 0 }); } catch (x) { log("no instance of `" + e.look + "` for `" + e.name + "`: " + (x && x.message || x)); return; }
          host.looks[e.name] = { sp: it.sp, c: c, e: e, at: null, q: [0, 0, 0, 1] };
          look_owner[e.id] = true;
        });
      });
    };
    // ---- SITTING DOWN BY THE PAGE, for ANY creature that has legs (the sandbox's Everybody sits; a creature whose own mind has no `use` skill, a knight, a hound, a robot, is sat down all the same). The creature's mind is held (it is the
    // page's: sp.mind(false, c)), it is walked in a straight line to the stand point of the free anchored seat that fits it best (near, and a cushion about half as high as its hips: so a chair of its own size), turned to face away
    // from the seat, sat down (the same native seat as the use block's: ports.creatures.sit), kept there until it is told to get up (host.get_up) or `hold` seconds are over, stood up at the stand point, and given its mind back.
    // host.sit_down(handle, { hold }) -> a task { h, slot, state: walk | turn | down | seated | up | done | failed, why } | null (no legs, no free seat);  host.get_up(handle) -> bool;  host.sit_all() / host.get_up_all() -> how many
    const seat_tasks = [];
    host.seat_tasks = seat_tasks;
    const wrap_pi = function (a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const seat_held = function (si) {                                                                         // (a seat that a task has, or that a creature sits on: the anchor's place says so)
      for (let i = 0; i < seat_tasks.length; i++) if (seat_tasks[i].slot === si && seat_tasks[i].state !== "done" && seat_tasks[i].state !== "failed") return true;
      const s = host.spec.slots[si];
      for (const k in host.by_handle) { const st = host.by_handle[k].c.seated; if (st && st.world && Math.abs(st.anchor[0] - s.wpos[0]) < 0.35 && Math.abs(st.anchor[2] - s.wpos[2]) < 0.35) return true; }
      return false;
    };
    const seat_fit = function (r) {
      const m = r.sp.mirror, o = r.c.slot * 8, px = m[o], py = m[o + 1], pz = m[o + 2], hh = r.sp.sk.head[r.sp.legs.body * 3 + 1] * scale_of(r.sp, r.c);
      let best = -1, bs = Infinity;
      host.spec.slots.forEach(function (s, i) {
        if (!s.seat || !s.seat.anchor || Math.abs(s.stand[1] - py) > 1.0 || seat_held(i)) return;
        const score = Math.hypot(s.stand[0] - px, s.stand[2] - pz) + 8 * Math.abs((s.wpos[1] - s.stand[1]) - 0.48 * hh);
        if (score < bs) { bs = score; best = i; }
      });
      return best;
    };
    host.sit_down = function (h, o) {
      const r = host.by_handle[h];
      if (!r || !r.sp.legs || typeof r.sp.sit !== "function" || r.sp.alive[r.c.slot] !== 1 || r.c.seated || seat_tasks.some(function (t) { return t.h === h && t.state !== "done" && t.state !== "failed"; })) return null;
      const si = o && o.slot !== undefined ? (host.spec.slots[o.slot] && host.spec.slots[o.slot].seat && host.spec.slots[o.slot].seat.anchor && !seat_held(o.slot) ? o.slot : -1) : seat_fit(r);      // (a seat the caller names, if it is free)
      if (si < 0) return null;
      const t = { h: h, slot: si, state: "walk", t: 0, t_state: 0, hold: o && o.hold > 0 ? o.hold : Infinity, why: "" };
      try { r.sp.mind(false, r.c); } catch (e) { /* a creature with no mind of its own: nothing to hold */ }
      seat_tasks.push(t);
      return t;
    };
    host.get_up = function (h) {
      for (let i = 0; i < seat_tasks.length; i++) {
        const t = seat_tasks[i], r = host.by_handle[h];
        if (t.h !== h) continue;
        if (t.state === "seated" || t.state === "down") { t.hold = 0; t.state = "seated"; return true; }               // (sitting or sat: it is stood up at the next step)
        if (t.state === "walk" || t.state === "turn") {                                                      // (it never sat: it stops, and has its mind back)
          if (r) { try { r.sp.set_intent(r.c, 0, 0); r.sp.mind(true, r.c); } catch (e) { /* gone */ } }
          t.state = "done"; t.t_state = 0; return true;
        }
      }
      return false;
    };
    host.sit_all = function () { let n = 0; Object.keys(host.by_handle).forEach(function (k) { if (host.sit_down(Number(k))) n++; }); return n; };
    host.get_up_all = function () { let n = 0; seat_tasks.slice().forEach(function (t) { if (host.get_up(t.h)) n++; }); return n; };
    const seat_step = function (dt) {
      for (let i = seat_tasks.length - 1; i >= 0; i--) {
        const t = seat_tasks[i], r = host.by_handle[t.h];
        if (t.state === "done" || t.state === "failed") { if (t.t_state > 30) seat_tasks.splice(i, 1); else t.t_state += dt; continue; }
        const finish = function (state, why) { t.state = state; t.why = why || ""; t.t_state = 0; if (r) { try { r.sp.mind(true, r.c); } catch (e) { /* gone */ } } };
        if (!r || r.sp.alive[r.c.slot] !== 1) { t.state = "failed"; t.why = "gone"; t.t_state = 0; continue; }
        const sp = r.sp, c = r.c, s = host.spec.slots[t.slot], m = sp.mirror, o = c.slot * 8, x = m[o], z = m[o + 2];
        t.t += dt; t.t_state += dt;
        try {
          if (t.state === "walk") {
            const dx = s.stand[0] - x, dz = s.stand[2] - z, d = Math.hypot(dx, dz), sc = scale_of(sp, c);
            if (d < 0.25 * sc + 0.05) { sp.set_intent(c, 0, 0); t.state = "turn"; t.t_state = 0; }
            else if (t.t_state > 45) { sp.set_intent(c, 0, 0); finish("failed", "it did not get there in 45 s"); }
            else sp.set_intent(c, dx / d * 1.4, dz / d * 1.4);
          } else if (t.state === "turn") {
            const face = Math.atan2(s.stand[0] - s.wpos[0], s.stand[2] - s.wpos[2]);
            sp.set_intent(c, 0, 0, Math.sin(face), Math.cos(face));
            if (Math.abs(wrap_pi(face - sp.heading(c))) < 0.3 || t.t_state > 3) {
              if (ports.creatures.sit(t.h, { x: s.wpos[0], y: s.wpos[1], z: s.wpos[2], yaw: s.wyaw, lift: s.seat.lift, floor: s.stand[1], dur: 0.9 })) { t.state = "down"; t.t_state = 0; }
              else finish("failed", "the creature could not be sat down");
            }
          } else if (t.state === "down") {
            if (t.t_state > 1.1) { t.state = "seated"; t.t_state = 0; }
          } else if (t.state === "seated") {
            if (t.t_state >= t.hold) t.state = "up_now";
          }
          if (t.state === "up_now") {
            ports.creatures.stand(t.h, { x: s.stand[0], y: s.stand[1], z: s.stand[2], yaw: Math.atan2(s.stand[0] - s.wpos[0], s.stand[2] - s.wpos[2]), dur: 0.8 });
            t.state = "up"; t.t_state = 0;
          } else if (t.state === "up" && t.t_state > 0.95) finish("done");
        } catch (e) { finish("failed", String(e && e.message || e)); }
      }
    };
    host.start = function () { host.started = true; return host; };
    host.stop = function () { host.started = false; };
    host.update = function (dt) {                                                                          // (the runtime's tick: nothing before the world is loaded, nothing while it is stopped)
      if (!host.started) return host;
      host.counters.frames++;
      if (host.R) host.R.tick(Math.min(0.05, dt > 0 ? dt : (engine.time_delta || 0.016)));
      if (seat_tasks.length) seat_step(dt > 0 ? Math.min(0.1, dt) : 0.016);
      for (let i = 0; i < look_dyn.length; i++) {                                                           // (a loose piece with a look: its instance goes where the engine's body is)
        const r = look_dyn[i], w0 = r.id.world_position, q0 = r.id.world_rotation;
        if (!w0 || !q0 || (w0[3] & 128)) continue;
        look_put(r.entity, w0, [q0[0], q0[1], q0[2], -q0[3]]);
      }
      return host;
    };

    // what there is to show of the world: the static boxes from the spec, the entities' bodies where they are now. fn(pos, quat, sx, sy, sz, color [r, g, b]) for each; pos and quat are scratch arrays (copy them to keep them).
    // The page decides where the boxes go and how many times they are drawn (the sandbox puts them in the engine's solids once a frame, and the shadow pass and the scene pass both draw those)
    const box_p = [0, 0, 0], box_q = [0, 0, 0, 1];
    host.each_box = function (fn) {
      let n = 0;
      for (let i = 0; i < bodies.length; i++) {
        const r = bodies[i], c = r.color;
        if (r.look || r.kind === "hidden" || (r.owner !== undefined && look_owner[r.owner])) continue;                             // (a piece with a look is drawn by its instance: the boxes are its collision only)
        if (!r.dynamic) {
          if (r.p[1] + r.half[1] > host.cut + 0.01) continue;                                              // (host.cut hides what is above a height: the cutaway)
          fn(r.p, r.q, r.half[0] * 2, r.half[1] * 2, r.half[2] * 2, c); n++; continue;
        }
        const w0 = r.id.world_position;
        if ((w0 && (w0[3] & 128)) || (!w0 && !r.moving)) continue;                                        // (a parked body is not shown)
        const w = r.moving ? r.p : w0;
        if (w[1] >= host.cut) continue;
        const q = r.moving ? r.q : (function (rr) { return [rr[0], rr[1], rr[2], -rr[3]]; })(r.id.world_rotation);
        for (let k = 0; k < r.shapes.length; k++) {
          const sh = r.shapes[k], o = rotate(q, sh.pos);
          box_p[0] = w[0] + o[0]; box_p[1] = w[1] + o[1]; box_p[2] = w[2] + o[2];
          const sq = sh.yaw ? qmul(q, q_yaw(sh.yaw)) : q;
          box_q[0] = sq[0]; box_q[1] = sq[1]; box_q[2] = sq[2]; box_q[3] = sq[3];
          fn(box_p, box_q, sh.half[0] * 2, sh.half[1] * 2, sh.half[2] * 2, c); n++;
        }
      }
      host.drawn = n;
      return n;
    };
    const rotate = function (q, v) {
      const x = q[0], y = q[1], z = q[2], w = q[3], ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
      return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
    };
    const qmul = function (a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; };

    // ---- a family made AGAIN where it stands: the AI editor's live preview (the AI editor's page, which is not in this repo) makes the creature again at every change of its file. `creature` is the text of a creature file or its object; it is
    // compiled, the instances of the family are let go, the species is made again (system.species_again: the same family in the worker, so its table is built again in the same place: a species made new for every edit would use the arena
    // up) and the family takes the new body, settings and mind (the worker has them when it reads the context that is queued after this). A nav profile of its own that the world does not have cannot be added to a world that is baked
    // already: it walks as a `person`, and the note says so. host.remake(name, creature) -> Promise of { family, note }; the caller spawns again (host.spawn).
    host.remake = function (name, creature, o) {
      const c = typeof creature === "string" ? CF.load(creature) : creature, comp = CF.compile(c, { required: host.spec ? host.spec.required_blocks : [], give: host.spec ? Spec.gives_for(host.spec, c) : [] }), old = host.families[name], d = comp.def;
      let note = "";
      const profile = comp.cfg.nav.agent;
      if (host.spec && !host.spec.nav.agents[profile] && !Nav.DEFAULT_AGENTS[profile]) { comp.cfg.nav.agent = host.spec.nav.default_agent || "person"; note = "its nav profile `" + profile + "` is not in this world: it walks as a `" + comp.cfg.nav.agent + "`"; }
      if (o && typeof o.tweak === "function") o.tweak(d);                                                  // (the caller changes the body of this make only: the preview gives the legs spare gait slots to try a gait)
      return Promise.resolve(body_made(d)).then(function () {
        const live = old && old.sp && !old.sp.disposed;
        if (live) Object.keys(host.by_handle).forEach(function (k) { const r = host.by_handle[k]; if (r.sp === old.sp) { try { r.sp.release(r.c); } catch (e) { /* gone */ } delete host.by_handle[k]; } });
        let sp;
        try { sp = live ? system.species_again(old.sp, d, { cfg: comp.cfg }) : system.species(d, { cfg: comp.cfg }); }
        catch (e) {
          if (live && !old.sp.disposed) try { old.sp.dispose(); } catch (x) { /* gone */ }
          sp = system.species(d, { cfg: comp.cfg });
        }
        const f = host.families[name] = { cfg: comp.cfg, def: d, agent: comp.agent, sp: sp };
        sp.on_worker_event = function (slot, gen, tag, value) { if (opts.on_event) opts.on_event(name, slot, gen, tag, value); };
        return { family: f, note: note };
      });
    };

    // ---- for the page and for tests
    host.spawn = function (family, x, y, z, yaw) { return ports.creatures.spawn(family, x, y, z, yaw, {}); };
    host.hurt = function (h, damage) { ports.creatures.hurt(h, damage, -1); };
    host.kill = function (h) { ports.creatures.hurt(h, 1e6, -1); };
    host.where = function (h) { const r = host.by_handle[h]; if (!r) return null; const m = r.sp.mirror, o = r.c.slot * 8; return [m[o], m[o + 1], m[o + 2]]; };
    host.each_creature = function (fn) { ports.creatures.each(function (h, x, y, z, f) { fn(h, x, y, z, f); }); };
    host.stats = function () { return Object.assign({ started: host.started, drawn: host.drawn, bodies: bodies.length, kinematic: kin.length, fx: host.fx_error || null }, host.R ? host.R.stats() : {}, { counters_host: host.counters }); };
    return host;
  }
  return { create: create, HURT_MSG: HURT_MSG };
});

// ========================================================================================================================
// clip_sets
// ========================================================================================================================
packing()("happy_ai_clip_sets", function happy_ai_clip_sets() {
  "use strict";
  // HAPPY AI CLIP SETS (SYSTEM.md "Clip sets"): the clips that a block needs (jump, attack, eat, sleep, a run, a creep ...) are not one pair of hard coded names any more: the libraries are INDEXED into sets, one set a species
  // (bear, deer, wolf ...) or one pack of people (Mixamo, Reallusion ...), each with the clips it has for every ROLE. A block has slots (id, kind, search words); a slot has a role; a set that has a clip for the role of a slot
  // can fill it. The editor lists, for a block, every set that can fill its slots ("bear 6/6, deer 5/6, person (Mixamo) 6/6") and the clips of the block take the one the user chooses; a slot the set has nothing for is filled
  // from the block's own default for this creature's legs (`by_legs`) and said to be borrowed, or left empty when the block has none.
  // The data is happy_actions/clip_sets.json, made by tools/clip_sets.js (it uses `classify_action` / `classify_style` of this file: the same words rule the index and the tests). No DOM, no engine, ES5 (node tests load it).
  //   CS.ACTION_ROLES / CS.STYLE_ROLES    [{ id, about }]    the roles
  //   CS.classify_action(a) -> role id | ""        a: { name, title, kind, end, events? }                CS.classify_style(g) -> role id | ""        g: { name, tags }
  //   CS.slot_role(slot) -> role id | ""           slot: { id, kind: "action" | "style", search, role? } (an explicit `role` first, then the words of `search`, then the id)
  //   CS.chain(kind, role) -> [role ids]           the roles that stand in for a role, best first (a dance of an animal is its play clip, a hop ...)
  //   CS.make(data) -> { sets, by_id }             the index data read once
  //   CS.pick(set, kind, role, nth) -> name | ""   the nth distinct clip of the role (and of its chain, the role's own first), cycling when there are fewer
  //   CS.resolve(set, slots, { legs }) -> { clips: { slot id: name }, own, borrowed, empty, role_of }       one block's slots filled from one set
  //   CS.sets_for(idx, blocks, { legs, name, fam }) -> [{ set, own, total, borrowed, empty, rank, by_name, by_fam }]     blocks: [[slots] ...]; sorted: the species of the creature's name, its family (fam: "person" | "bird" ...), its number of legs, then the most slots filled by the set itself
  //   CS.legs_rank(set_legs, legs) -> 0 (the same) | 1 (any body) | 2 (another)

  var ACTION_ROLES = [
    { id: "attack", about: "a quick strike: a punch, a bite, a claw" }, { id: "kick", about: "a kick, a headbutt, a stomp" }, { id: "heavy", about: "a heavy blow: a smash, an overhead swing" },
    { id: "pounce", about: "a pounce, a lunge" }, { id: "taunt", about: "a roar, a taunt, a battle cry" }, { id: "call", about: "a call: a howl, a bark, a caw" }, { id: "talk", about: "talking" },
    { id: "hit", about: "hurt, a flinch, taking a hit" }, { id: "dodge", about: "a dodge, a block" }, { id: "death", about: "dying" },
    { id: "eat", about: "eating, drinking, grazing" }, { id: "sleep_down", about: "lying down (the start of a rest)" }, { id: "sleep", about: "asleep: a rest that loops" }, { id: "sleep_up", about: "getting up (the end of a rest)" },
    { id: "sit", about: "sitting" }, { id: "idle", about: "standing about: an idle, a shift of the weight" }, { id: "breathe", about: "breathing" },
    { id: "look", about: "looking around, sniffing, watching" }, { id: "point", about: "pointing, an alert stance" }, { id: "groom", about: "scratching, grooming, licking" },
    { id: "stretch", about: "a stretch" }, { id: "yawn", about: "a yawn" }, { id: "wave", about: "a wave, a greeting, a bow, a nod" }, { id: "jump", about: "a jump, a hop" },
    { id: "dance", about: "a dance" }, { id: "flap", about: "wings: a flap, a glide" }, { id: "emote", about: "anything it does for show: a play, a victory" },
    { id: "gun_aim", about: "holding a gun, aiming" }, { id: "gun_fire", about: "firing a gun" }, { id: "reload", about: "reloading" }
  ];
  var STYLE_ROLES = [
    { id: "walk", about: "a walk" }, { id: "run", about: "a run, a jog, a canter, a gallop" }, { id: "sprint", about: "a flat out run, a bound" }, { id: "trot", about: "a trot" },
    { id: "creep", about: "a low slow creep" }, { id: "sneak", about: "a sneak" }, { id: "limp", about: "a limp, an injured walk" }, { id: "drag", about: "a dragging crawl" }, { id: "carry", about: "walking while carrying" },
    { id: "angry", about: "an angry walk" }, { id: "happy", about: "a happy walk" }, { id: "sad", about: "a sad walk" }, { id: "scared", about: "a scared walk" }, { id: "tired", about: "a tired walk" }, { id: "confident", about: "a confident walk" }
  ];
  // what stands in for a role when the set has none of its own (best first; the role itself is always first). A walk of a mood has no stand in: a happy walk that is a plain walk is not a happy walk
  var ACTION_CHAIN = {
    attack: ["kick", "pounce", "heavy"], kick: ["attack", "heavy"], heavy: ["attack", "kick"], pounce: ["attack", "jump"], taunt: ["call", "talk", "emote"], call: ["taunt", "talk"], talk: ["call", "emote"],
    hit: ["dodge"], dodge: ["hit"], death: [], eat: [], sleep_down: [], sleep: ["sit"], sleep_up: [], sit: ["sleep", "idle"], idle: ["breathe", "look"], breathe: ["idle"],
    look: ["idle", "emote"], point: ["look", "emote"], groom: ["emote"], stretch: ["emote", "idle"], yawn: ["stretch", "emote"], wave: ["emote", "talk"], jump: [], dance: ["emote", "jump"], flap: ["emote"],
    emote: ["wave", "idle"], gun_aim: [], gun_fire: [], reload: []
  };
  var STYLE_CHAIN = { walk: [], run: ["sprint"], sprint: ["run"], trot: ["run"], creep: ["sneak"], sneak: ["creep"], limp: ["drag"], drag: ["limp"], carry: [], angry: [], happy: [], sad: [], scared: [], tired: [], confident: [] };
  // which roles are played once or looped, and which need the events (a blow that raises `hit`, a jump that raises `jumped`): the ranking inside a role
  var LOOPS = { idle: 1, breathe: 1, look: 1, sleep: 1, dance: 1, flap: 1, sit: 1, groom: 0 };
  var EVENTS = { attack: 1, kick: 1, heavy: 1, pounce: 1, hit: 1, jump: 1, death: 0 };

  var SLOT_WORDS = {                                                                                        // the `search` words a block gives a slot -> its role
    "action:attack": "attack", "action:attack_ev": "attack", "action:bite attack": "attack", "action:pounce": "pounce", "action:pounce lunge": "pounce", "action:taunt": "taunt", "action:hit": "hit", "action:death": "death",
    "action:eat": "eat", "action:rest lie down": "sleep_down", "action:sleep rest": "sleep", "action:up": "sleep_up", "action:sit": "sit", "action:idle": "idle", "action:breathe": "breathe",
    "action:look": "look", "action:point": "point", "action:emote": "emote", "action:scratch groom": "groom", "action:stretch": "stretch", "action:yawn": "yawn", "action:talk": "talk", "action:wave": "wave",
    "action:jump": "jump", "action:dance": "dance", "action:glid": "flap", "action:reload": "reload",
    "action:punch strike attack bite": "attack", "action:punch attack": "attack", "action:cheer clap dance": "dance",                // (the words of the world blocks: fight, goals, celebrate)
    "style:walk": "walk", "style:run": "run", "style:sprint": "sprint", "style:trot": "trot", "style:creep": "creep", "style:sneak": "sneak", "style:limp": "limp", "style:drag": "drag", "style:carry": "carry",
    "style:angry": "angry", "style:happy": "happy", "style:sad": "sad", "style:scared": "scared", "style:tired": "tired", "style:confident": "confident"
  };
  var ALL = {};
  ACTION_ROLES.forEach(function (r) { ALL["action:" + r.id] = 1; }); STYLE_ROLES.forEach(function (r) { ALL["style:" + r.id] = 1; });

  function tokens_of(s) { return String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w.length > 0; }); }
  function any(toks, re) { var i; for (i = 0; i < toks.length; i++) if (re.test(toks[i])) return true; return false; }
  function species_free(title) { var i = String(title || "").indexOf(":"); return i >= 0 ? String(title).slice(i + 1) : String(title || ""); }

  var POSTURE_WORDS = /^(getup|wake|waking|sleep|sleeping|asleep|doze|nap|prone|lie|lying|lay|laying|liedown|rest|resting|sit|sitting|seated|kneel|kneeling)$/;
  // the hips of a clip, in the clip's own numbers (the role space of happy_actions: the height of the hips against standing): [first key .. last key], or null (a library that was read without its tracks)
  function hips_of(a) {
    var k, t, tr = a.tracks;
    if (!tr) return null;
    for (k in tr) { t = tr[k]; if (t && t.c === "hips.y" && t.v && t.v.length > 1) return t.v; }
    return null;
  }
  // lying down, a rest that loops, getting up, sitting: what the hips do says it (a clip that begins standing and ends low goes down, the other way it gets up); the words decide when the hips end where they began
  function posture_role(a, T, kind) {
    var v = hips_of(a), h = a.height > 0 ? a.height : 1, d = null, mn = null, i, up, down;
    if (v) { d = v[v.length - 1] - v[0]; mn = v[0]; for (i = 1; i < v.length; i++) if (v[i] < mn) mn = v[i]; mn = mn / h; d = d / h; }
    if (d !== null && d > 0.1) return "sleep_up";
    if (d !== null && d < -0.1) return "sleep_down";
    up = T(/^(getup|wake|waking)$/) || (T(/^up$/) && T(/^(get|stand|from|rest|sleep|lie|kneel|sit)$/)) || (T(/^end$/) && T(/^(lie|sleep|sit|rest|kneel)$/));
    down = T(/^(down|start|begin|goes|liedown)$/) && T(/^(lie|sleep|sit|rest|kneel|liedown)$/);
    if (up) return "sleep_up";
    if (down) return "sleep_down";
    if (T(/^(sleep|sleeping|asleep|doze|nap|prone|lie|lying|lay|laying)$/)) return "sleep";
    if (T(/^(sit|sitting|seated|kneel|kneeling)$/)) return "sit";
    if (mn !== null) return mn < -0.45 ? "sleep" : (mn < -0.1 ? "sit" : "");
    return T(/^(rest|resting)$/) ? (a.end === "loop" ? "sleep" : "sleep_down") : "";
  }
  // ---- the role of a clip. The name of an animal's clip says it (`bear_attack_3_ev`: attack), a person's clip is in its title (`Person: street thug rigged animated angry`): the words of both, the species left out
  function classify_action(a) {
    var name = String(a.name || "").toLowerCase().replace(/_ev$/, ""), rest = tokens_of(name).slice(1), tt = tokens_of(species_free(a.title)), toks = rest.concat(tt), kind = a.kind || "", r;
    var T = function (re) { return any(toks, re); };
    if (T(/^(reload|reloading)$/)) return "reload";
    if (T(/^(gun|guns|rifle|rifles|pistol|bazooka|minigun|musket)$/) && !T(/^(punch|kick|butt)$/)) { if (T(/^(attack|fire|firing|shoot|shooting|shot)$/) || kind === "attack") return "gun_fire"; if (T(/^(aim|aiming|idle|hold|holding|stand|standing|ready|stance|crouch|walk)$/) || kind === "idle" || kind === "pose") return "gun_aim"; }
    if (T(/^(death|die|dies|dying|dead|died|collapse|knockdown)$/)) return "death";
    if (kind === "dance" || T(/^(dance|dancing|disco|samba|waltz|salsa|hiphop|breakdance|twerk|macarena)$/)) return "dance";
    if (T(/^(yawn|yawning)$/)) return "yawn";
    if (T(/^(stretch|stretching)$/)) return "stretch";
    if (T(/^(pounce|lunge|leaping)$/) || (kind === "attack" && T(/^(charge|swoop|dive)$/))) return "pounce";
    if (kind === "reaction" && T(/^(dodge|block|evade|esquiva|duck|sidestep|parry)$/)) return "dodge";
    if (kind === "reaction" || T(/^(hit|hurt|hurts|damage|damaged|stun|stunned|flinch|pain|injured|wound)$/)) return "hit";
    if (T(/^(eat|eating|chew|chewing|drink|drinking|graze|grazing|feed|feeding|swallow|forage|foraging)$/) || (T(/^(peck|pecking)$/) && kind !== "attack")) return "eat";
    if (kind === "pose" || T(POSTURE_WORDS)) { r = posture_role(a, T, kind); if (r) return r; }
    if (kind === "attack" && T(/^(kick|kicks|butt|headbutt|knee|stomp|stomps|trample)$/)) return "kick";
    if (kind === "attack" && T(/^(smash|slam|overhead|heavy|uppercut|swing|crush|stomp|slaughter|spin|great|special|power)$/)) return "heavy";
    if (T(/^(attack|attacks|bite|bites|punch|punches|claw|strike|slash|swipe|jab|hook|chop|snap|peck|stab|fight|combat|melee|spit|tackle)$/) || kind === "attack") return T(/^(kick|kicks|butt|headbutt|knee)$/) ? "kick" : "attack";
    if (T(/^(taunt|battlecry|roar|shout|scream|challenge|bellow)$/)) return "taunt";
    if (T(/^(talk|talking|speak|speaking|say|chat|discussion|conversation|explain|argue|whisper)$/)) return "talk";
    if (T(/^(call|howl|bark|caw|growl|cry|chirp|squeak|moo|neigh|hoot|meow|purr|sing|whistle)$/)) return "call";
    if (T(/^(groom|grooming|scratch|scratching|lick|licking|clean|wash|preen|preening|itch)$/)) return "groom";
    if (T(/^(point|pointing)$/)) return "point";
    if (T(/^(wave|waving|greet|greeting|hello|bow|salute|nod|thumbs|clap|cheer|thanks|goodbye)$/)) return "wave";
    if (T(/^(look|looking|scan|watch|stare|sniff|sniffing|search|alert|observe|glance|peek|listen)$/)) return "look";
    if (T(/^(jump|jumps|jumping|hop|hopping|leap|vault|takeoff)$/) || (kind === "movement" && T(/^(jump|hop)$/))) return "jump";
    if (T(/^(flap|flapping|fly|flying|glide|gliding|soar|soaring|hover|hovering|wing|wings)$/)) return "flap";
    if (T(/^(breathe|breath|breathing)$/)) return "breathe";
    if (kind === "idle" || T(/^(idle|idles|stand|standing|relaxed)$/)) return "idle";
    if (kind === "gesture" || kind === "social" || T(/^(emote|play|victory|happy|angry|fear|clicked|celebrate|show)$/)) return "emote";
    return "";
  }

  // ---- the role of a gait style, by its name and its tags
  function classify_style(g) {
    var name = String(g.name || "").toLowerCase(), toks = tokens_of(name).concat((g.tags || []).map(function (x) { return String(x).toLowerCase(); })), nt = tokens_of(name);
    var T = function (re) { return any(toks, re); }, N = function (re) { return any(nt, re); };
    if (N(/^(carry|carrying|carries)$/)) return "carry";
    if (N(/^(drag|dragging|crawl|crawling|dragbadlegwalk|badleg)$/) || /dragbadleg/.test(name)) return "drag";
    if (N(/^(limp|limping|injured|hurt|wounded|lame)$/) || /limp/.test(name)) return "limp";
    if (N(/^(sneak|sneaky|sneaking|stealth|stealthy|tiptoe)$/) || /sneak/.test(name)) return "sneak";
    if (N(/^(creep|creeping|crouch|crouching|crawl)$/) || /creep/.test(name)) return "creep";
    if (/(^|_)(angry|mad|aggressive|furious|rage)(_|$)/.test(name) || /angry/.test(name)) return "angry";
    if (/(^|_)(happy|cheerful|joyful|joy|excited)(_|$)/.test(name) || /happy/.test(name)) return "happy";
    if (/sadwalk|(^|_)(sad|depressed|sorrow|mourning)(_|$)/.test(name)) return "sad";
    if (/scaredwalk|(^|_)(scared|afraid|fear|frightened|terrified|nervous|panic)(_|$)/.test(name)) return "scared";
    if (/(^|_)(tired|exhausted|old|weak|sick|weakend|drunk|weary)(_|$)/.test(name)) return "tired";
    if (/(^|_)(confident|proud|strut|swagger|catwalk|brave)(_|$)/.test(name)) return "confident";
    if (N(/^(sprint|sprinting|bound|pronk|dash)$/) || /sprint/.test(name)) return "sprint";
    if (N(/^(trot|trotting)$/)) return "trot";
    if (N(/^(run|running|jog|jogging|gallop|galloping|canter|cantering|charge|flee|fleeing)$/) || T(/^(run|jog|gallop|canter)$/) && !N(/^walk$/)) return "run";
    if (N(/^(walk|walking|walks|stroll|march|pace|amble|stride)$/) || T(/^(walk)$/)) return "walk";
    return "";
  }

  function slot_role(slot) {
    var k, r;
    if (!slot) return "";
    if (slot.role && ALL[slot.kind + ":" + slot.role]) return slot.role;
    k = slot.kind + ":" + String(slot.search || "").toLowerCase();
    if (SLOT_WORDS[k]) return SLOT_WORDS[k];
    r = SLOT_WORDS[slot.kind + ":" + String(slot.search || "").toLowerCase().split(/\s+/)[0]];
    return r || "";
  }
  function chain(kind, role) { return [role].concat((kind === "style" ? STYLE_CHAIN : ACTION_CHAIN)[role] || []); }

  // ---- the index data, read once
  function make(data) {
    var sets = (data && data.sets) || [], by_id = {};
    sets.forEach(function (s) { by_id[s.id] = s; });
    return { sets: sets, by_id: by_id, libraries: (data && data.libraries) || {} };
  }
  function list_of(set, kind, role) { var m = kind === "style" ? set.g : set.a; return (m && m[role]) || []; }
  // the nth distinct clip a set has for a role: the role's own clips first, then those of the roles that stand in for it; cycling when there are fewer than n + 1
  function candidates(set, kind, role, nth) {                                                               // the distinct clips of the role, then of the roles that stand in for it (those only when the role's own are not enough for the nth)
    var seen = {}, all = [], c = chain(kind, role), i, j, l;
    for (i = 0; i < c.length; i++) { l = list_of(set, kind, c[i]); for (j = 0; j < l.length; j++) if (!seen[l[j]]) { seen[l[j]] = 1; all.push(l[j]); } if (i === 0 && all.length > (nth || 0)) break; }
    return all;
  }
  function pick(set, kind, role, nth) { var all = candidates(set, kind, role, nth); return all.length ? all[nth % all.length] : ""; }
  function has_role(set, kind, role) { var c = chain(kind, role), i; for (i = 0; i < c.length; i++) if (list_of(set, kind, c[i]).length) return true; return false; }
  function default_for(slot, legs) { return slot.by_legs && legs !== null && legs !== undefined && slot.by_legs[String(legs)] ? slot.by_legs[String(legs)] : ""; }

  // one block's slots, filled from one set. A slot takes the first clip of its role (or of the roles that stand in) that no other slot of the block took, so the four blows of a fight are four clips when the set has them;
  // when they are all taken it goes round (the nth of the role). `own`: the set has a clip for it; `borrowed`: it has none, the
  // block's own default for the legs is used (a mixed set is better than a hole: the user is told which); `empty`: neither (the slot stays empty: the creature's own gait, no clip)
  function resolve(set, slots, o) {
    var legs = o && o.legs !== undefined ? o.legs : null, n = {}, used = {}, out = { clips: {}, own: [], borrowed: [], empty: [], role_of: {} };
    (slots || []).forEach(function (s) {
      var role = slot_role(s), nth = 0, name = "", dflt, all, i;
      out.role_of[s.id] = role;
      if (role) {
        nth = n[s.kind + ":" + role] || 0; n[s.kind + ":" + role] = nth + 1;
        all = candidates(set, s.kind, role, 99);
        for (i = 0; i < all.length; i++) if (!used[s.kind + ":" + all[i]]) { name = all[i]; break; }
        if (!name && all.length) name = all[nth % all.length];
        if (name) used[s.kind + ":" + name] = 1;
      }
      if (name) { out.clips[s.id] = name; out.own.push(s.id); return; }
      dflt = default_for(s, legs);
      if (dflt) { out.clips[s.id] = dflt; out.borrowed.push(s.id); } else out.empty.push(s.id);
    });
    return out;
  }
  // how well a set's species fits the creature's NAME: 0 every word of the species is in the name (`bear` in `black_bear`), 1 every word of the name is in the species (`bear` in `polar bear`), 2 neither
  function name_rank(set, name) {
    var sp = tokens_of(String(set.id).split("/")[1] || ""), nm = tokens_of(name).filter(function (w) { return w !== "kit" && w !== "lowpoly" && w !== "low" && w !== "poly"; }), i, a = true, b = true;
    if (!sp.length || !nm.length || set.fam === "designed" || set.fam === "generic" || set.fam === "person") return 2;
    for (i = 0; i < sp.length; i++) if (nm.indexOf(sp[i]) < 0) a = false;
    for (i = 0; i < nm.length; i++) if (sp.indexOf(nm[i]) < 0) b = false;
    return a ? 0 : (b ? 1 : 2);
  }
  function legs_rank(set_legs, legs) { if (legs === null || legs === undefined) return 1; if (!set_legs) return 1; return set_legs === legs ? 0 : 2; }
  // every set that fills at least one slot of the blocks, best first: the species of the creature's name, then the family it is (`o.fam`: "person" for a human, "bird" for a creature with wings), then the same number of legs, then the most slots
  // filled by the set itself. `own` counts them over all the blocks' slots (`total`)
  function sets_for(idx, blocks, o) {
    var legs = o && o.legs !== undefined ? o.legs : null, out = [], total = 0, name = (o && o.name) || "", fam = (o && o.fam) || "";
    (blocks || []).forEach(function (sl) { total += sl.length; });
    idx.sets.forEach(function (set) {
      var own = 0, borrowed = 0, empty = 0;
      (blocks || []).forEach(function (sl) { var r = resolve(set, sl, { legs: legs }); own += r.own.length; borrowed += r.borrowed.length; empty += r.empty.length; });
      if (own > 0) out.push({ set: set, own: own, total: total, borrowed: borrowed, empty: empty, rank: legs_rank(set.legs, legs), by_name: name_rank(set, name), by_fam: fam && set.fam === fam ? 0 : 1 });
    });
    out.sort(function (a, b) { return a.by_name - b.by_name || a.by_fam - b.by_fam || a.rank - b.rank || (b.own / (b.total || 1)) - (a.own / (a.total || 1)) || b.own - a.own || (a.set.label < b.set.label ? -1 : a.set.label > b.set.label ? 1 : 0); });
    return out;
  }

  return { ACTION_ROLES: ACTION_ROLES, STYLE_ROLES: STYLE_ROLES, classify_action: classify_action, classify_style: classify_style, slot_role: slot_role, chain: chain, make: make, pick: pick, candidates: candidates, resolve: resolve, sets_for: sets_for, legs_rank: legs_rank,
    has_role: has_role, name_rank: name_rank, list_of: list_of, default_for: default_for, LOOPS: LOOPS, EVENTS: EVENTS, SLOT_WORDS: SLOT_WORDS };
});
