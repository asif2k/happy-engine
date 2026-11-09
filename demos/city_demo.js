packing("@/engine.js", "@/system/system.js", "@/system/environment.js")(function (engine, dom, httprequest) {
  // CITY DEMO (/demos/city_demo.html): the terrain of terrain_demo.js with a generated place on it. worldgen.js plan() finds flat dry land, city.js generate() lays a street network, blocks, lots and a BOX on every lot (structures.js recipe `box`, shown by
  // elements.js: one static mesh a size and colour, an instance a building); the streets are DATA that road_field.js turns into the terrain shader's overlay (no road mesh), grade.js cuts and fills the ground under them (env.set_heights: the physics
  // ground is the graded one), worldgen.connect() joins the places with roads and bridge.js crosses the river where a road meets it (a deck mesh and its physics boxes: env.set_decks).
  // Left drag turns the camera, right drag pans, the wheel zooms; W / S / A / D fly (Shift: fast), Q / E down / up, R puts the camera back.
  //   ?layout=grid|organic|radial|suburb|village      the main place's street plan (default grid)      ?seed=3      the land's seed and the places' (default 3)      ?kind=city|town|village      the main place's size class (default: village for the village plan, else city)
  //   ?radius=300      its radius in metres (80 .. 600)      ?density=0.6      ?floors=1,6      lowest and highest storeys      ?places=2      how many more places (a town, villages) are laid and joined by roads (0: none)
  //   ?preset=river_plains|plains|lake_district|...      the terrain (default river_plains: a river, so the roads need a bridge)      ?size=4096      ?map=1024      texels a side of the heightmap (the roads grade it: 1024 is 4 m a texel at 4 km)      ?grade=0      do not grade the ground
  //   ?cam=yaw,pitch,distance      ?look=x,z      the camera (default: the main place from above)      ?atmosphere=0|1  ?shadows=0|1  ?sun=az,el  ?fl=AERIAL_SCALE:0.1      as in terrain_demo.js      ?stats=1
  // `window.happy_demo` is what a test reads: { done, error, layout, seed, sites: [{ kind, name, x, z, r, layout, lots, boxes, roads, junctions }], elements, shown, species, triangles, roads: { segments, pads }, links, bridges: { count, boxes, piers, longest }, grade: { texels, max_cut, max_fill }, ground, frames, ms }.

  const lib_of = function (read) { let lib = null; read(function () { return function (name, factory) { lib = factory(); }; }); return lib; };
  const City = lib_of(function (packing) { import("@/system/city.js"); });
  const Worldgen = lib_of(function (packing) { import("@/system/worldgen.js"); });
  const Structures = lib_of(function (packing) { import("@/system/structures.js"); });
  const Elements = lib_of(function (packing) { import("@/system/elements.js"); });
  const RoadField = lib_of(function (packing) { import("@/system/road_field.js"); });
  const Grade = lib_of(function (packing) { import("@/system/grade.js"); });
  const Bridge = lib_of(function (packing) { import("@/system/bridge.js"); });
  const Ground = lib_of(function (packing) { import("@/system/ground.js"); });

  // the colour of a building by the style of its lot (a few tints a style: a mesh is made for each size and colour)
  const STYLE_COLOR = { residential: [[0.86, 0.74, 0.58], [0.78, 0.62, 0.5]], commercial: [[0.55, 0.66, 0.8], [0.7, 0.78, 0.86]], industrial: [[0.62, 0.62, 0.58], [0.5, 0.5, 0.48]], civic: [[0.8, 0.58, 0.72], [0.9, 0.82, 0.6]] };
  const STEP_W = [6, 9, 13, 18], STEP_H = [3, 6, 9, 12, 18];
  const step = function (v, list) { let b = list[0]; for (let i = 0; i < list.length; i++) if (list[i] <= v + 0.01) b = list[i]; return b; };
  function make_building(req) {
    const tints = STYLE_COLOR[req.style] || STYLE_COLOR.residential, c = tints[(req.lot | 0) % tints.length];
    return [{ type: "box", x: 0, z: 0, yaw: 0, p: { width: step(Math.max(2, req.w - 1), STEP_W), depth: step(Math.max(2, req.d - 1), STEP_W), height: step(3 * Math.max(1, req.floors), STEP_H), color: c } }];
  }
  const KIND_RADIUS = { city: 300, town: 190, village: 120 }, KIND_FLOORS = { city: [2, 8], town: [1, 4], village: [1, 2] }, KIND_LAYOUT = { town: "organic", village: "village", city: "grid" };

  function ready(engine) {
    const system = engine.system;
    const q = new URLSearchParams(location.search);
    const num = function (k, d) { const v = q.get(k); return v === null || v === "" || !isFinite(+v) ? d : +v; };
    const list = function (k, d) { const v = q.get(k); if (!v) return d; const a = v.split(",").map(Number); return a.every(isFinite) ? a : d; };
    const layout = q.get("layout") || "grid", seed = num("seed", 3), size = num("size", 4096);
    const main_kind = q.get("kind") || (layout === "village" ? "village" : "city");
    const demo = window.happy_demo = { done: false, error: null, layout: layout, seed: seed, kind: main_kind, preset: q.get("preset") || "river_plains", size: size, sites: [], elements: 0, shown: 0, species: 0, triangles: 0, roads: null, links: 0, bridges: null, grade: null, ground: null, frames: 0, ms: {}, notes: [] };
    if (window.PR$ && q.get("stats") !== "1") window.PR$.style.display = "none";
    const t0 = performance.now(), lap = function (k) { demo.ms[k] = Math.round(performance.now() - t0); };
    const fail = function (e) { demo.error = String(e && e.stack || e); console.error("happy.demo: " + demo.error); demo.done = true; };

    // ---- the world: the spec decides the terrain and the rivers; the places are found on the ground the worker makes
    const satellites = Math.max(0, Math.round(num("places", 2)));
    const spec_in = { game: "city_action", size: size, seed: seed, preset: demo.preset, rivers: true, roads: true, vegetation: false, cities: main_kind === "city" ? 1 : 0, towns: (main_kind === "town" ? 1 : 0) + (main_kind === "city" && satellites > 0 ? 1 : 0), villages: (main_kind === "village" ? 1 : 0) + Math.max(0, satellites - (main_kind === "city" ? 1 : 0)), farms: 0, camps: 0, outposts: 0, ruins: 0 };
    let spec;
    try { spec = Worldgen.normalize_spec(spec_in).spec; } catch (e) { fail(e); return; }
    const part = Worldgen.terrain_part(spec);
    spec.river_lines = part.terrain.rivers;
    const sun = list("sun", [part.sun.azimuth, part.sun.elevation]);
    demo.rivers = part.terrain.rivers.length;

    const fl = { AERIAL_SCALE: 0.1 };
    (q.get("fl") || "").split(",").forEach(function (kv) { const a = kv.split(":"); if (a.length === 2 && isFinite(+a[1])) fl[a[0]] = +a[1]; });
    { const names = {}; let next = 1; window.SL = function (name, value) { if (names[name]) return names[name]; const expr = "u_float_params[" + (next++) + "]"; engine.uniforms.set(expr, fl[name] !== undefined ? fl[name] : parseFloat(value)); return (names[name] = expr); }; }

    let env;
    try {
      env = engine.environment.create({
        map_size: num("map", 1024),
        world: { size: part.size, terrain: part.terrain, sun: { azimuth: sun[0], elevation: sun[1] }, ambient: num("ambient", 0.5), atmosphere: q.get("atmosphere") !== "0", shadows: q.get("shadows") !== "0", camera: { fov: 65, near: 0.5, far: 0, min_height: 3 } }
      });
    } catch (e) { fail(e); return; }
    window.happy_env = env;

    // ---- the camera (as terrain_demo.js)
    const ctl = env.camera.control, tm = engine.tra_model, keys = {};
    let focus = { x: 0, z: 0, r: 300 };
    function place_camera() {
      const cam = list("cam", [35, -38, Math.max(200, focus.r * 1.7)]), at = list("look", [focus.x, focus.z]);
      const gy = env.ground ? env.ground.y(at[0], at[1]) : 0;
      tm.set_position(ctl, at[0], Math.max(gy, env.ground ? env.ground.sea : 0) + 2, at[1]);
      ctl.distance = cam[2]; ctl.eular[1] = cam[0] * Math.PI / 180; ctl.eular[0] = cam[1] * Math.PI / 180;
      tm.set_eular(ctl, ctl.eular[0], ctl.eular[1], 0);
    }
    const mouse = engine.webgl.elm = dom.use_mouse(engine.webgl.canvas);
    mouse.mouse_drag = function (dx, dy, e) {
      if (e.buttons === 1) tm.yaw_pitch(ctl, -dx * 0.0025, -dy * 0.0025);
      else if (e.buttons === 2) { const k = Math.max(0.25, ctl.distance * 0.0016); tm.pan_xz(ctl, -dx * k, -dy * k); }
    };
    mouse.mouse_wheel = function (sp) { ctl.distance = Math.max(2, ctl.distance * Math.exp(-sp * 0.0012)); };
    window.addEventListener("keydown", function (e) { keys[e.code] = true; if (e.code === "KeyR") place_camera(); });
    window.addEventListener("keyup", function (e) { keys[e.code] = false; });
    engine.on_frame_begin.add(function () {
      const sp = Math.max(1, ctl.distance * 0.012) * (keys.ShiftLeft || keys.ShiftRight ? 5 : 1);
      if (keys.KeyW) tm.front_back(ctl, -sp); if (keys.KeyS) tm.front_back(ctl, sp);
      if (keys.KeyA) tm.pan_xz(ctl, -sp, 0); if (keys.KeyD) tm.pan_xz(ctl, sp, 0);
      if (keys.KeyE) tm.add_position(ctl, 0, sp, 0); if (keys.KeyQ) tm.add_position(ctl, 0, -sp, 0);
    });

    // ---- the pieces
    const load_ground = function () {
      return system.load("/system/system.bin").then(function () {
        if (!system.sections("ground.").length) return 0;
        return system.bytes("ground.textures").then(function (bytes) { return Ground.load(bytes, Ground.browser_decode); }).then(function (L) {
          L.table = Ground.table(L.header); env.set_ground(L); return L.header.materials.length;
        });
      }).catch(function (e) { console.warn("happy.demo: no ground materials: " + (e && e.message || e)); return 0; });
    };
    // the places: each is a city.js generation on the real ground; the main one has the layout of the URL
    function make_places() {
      const ground = env.ground, plan = Worldgen.plan(spec, ground);
      demo.notes = demo.notes.concat(plan.notes || []);
      const rank = { city: 3, town: 2, village: 1 };
      const sites = plan.sites.filter(function (s) { return rank[s.kind]; }).sort(function (a, b) { return (b.kind === main_kind) - (a.kind === main_kind) || rank[b.kind] - rank[a.kind]; });
      if (!sites.length) throw new Error("no flat dry land was found for a " + main_kind + " (" + (plan.notes || []).join("; ") + "): try another ?seed=");
      const out = [];
      sites.forEach(function (site, k) {
        const main = k === 0, kind = site.kind, lay = main ? layout : KIND_LAYOUT[kind];
        const radius = Math.max(80, Math.min(main ? num("radius", KIND_RADIUS[kind]) : KIND_RADIUS[kind], site.r * 0.95));
        const fl_ = main && q.get("floors") ? list("floors", KIND_FLOORS[kind]) : KIND_FLOORS[kind];
        let res = null, rad = radius, lay_used = lay;
        // a place that gets no street on this ground is tried again: another seed, then smaller, and last in a plan that fits anywhere (the layout actually used is in the state)
        const tries = [[1, 0], [1, 1], [1, 2], [0.8, 3], [0.65, 4], [0.7, 5]];
        for (let t = 0; t < tries.length; t++) {
          rad = Math.max(70, radius * tries[t][0]); lay_used = t < tries.length - 1 ? lay : (kind === "village" ? "village" : "organic");
          res = City.generate({ x: site.x, z: site.z, radius: rad, seed: site.seed + (main ? seed : 0) + tries[t][1] * 7919, layout: lay_used, density: main ? num("density", 0.6) : 0.45, ground: ground, make_building: make_building, floors: fl_, props: num("props", 0), structures: Structures });
          if (res.elements && res.elements.length) break;
        }
        if (lay_used !== lay && res.elements.length) demo.notes.push(site.name + ": the " + lay + " plan did not fit this ground: " + lay_used + " was used");
        out.push({ site: site, kind: kind, layout: lay_used, radius: rad, res: res, main: main });
        demo.sites.push({ dropped: res.elements.length === 0, kind: kind, name: site.name, x: site.x, z: site.z, r: Math.round(rad), layout: lay_used, lots: res.lots.length, boxes: res.elements.length, roads: res.roads.length, junctions: res.junctions.length, tight_bends: res.stats && res.stats.tight_bends });
        (res.notes || []).forEach(function (n) { demo.notes.push(site.name + ": " + n); });
      });
      const kept = out.filter(function (p) { return p.res.elements.length > 0; });                 // (a place that got no street is left out: nothing joins it)
      return { out: kept, sites: kept.map(function (p) { return p.site; }) };
    }
    // the roads between the places (worldgen.connect): points + width + the bridges where one meets the river. A road is cut where a deck goes (the deck's two ends are the road's ends).
    function make_links(sites) {
      const conn = Worldgen.connect(sites, env.ground, spec), roads = [], bridges = [];
      demo.notes = demo.notes.concat(conn.notes || []);
      conn.roads.forEach(function (r) {
        let pts = r.points, cuts = [];
        (r.bridges || []).forEach(function (b) {
          const half = b.length / 2 + 4; let i0 = -1, i1 = -1;
          for (let i = 0; i < pts.length; i++) if (Math.hypot(pts[i][0] - b.x, pts[i][1] - b.z) < half) { if (i0 < 0) i0 = i; i1 = i; }
          if (i0 < 1 || i1 > pts.length - 2) return;                                            // (a bridge at the very end of a road: left to the ground)
          cuts.push([i0, i1]);
          bridges.push({ a: pts[i0 - 1], b: pts[i1 + 1], width: Math.max(7, r.width + 2) });
        });
        let from = 0;
        cuts.sort(function (a, b) { return a[0] - b[0]; }).forEach(function (c) { if (c[0] - from >= 2) roads.push({ points: pts.slice(from, c[0]), width: r.width, walk: 0, cls: 4 }); from = c[1] + 1; });
        if (pts.length - from >= 2) roads.push({ points: pts.slice(from), width: r.width, walk: 0, cls: 4 });
      });
      demo.links = conn.roads.length;
      return { roads: roads, bridges: bridges };
    }
    // the ground is graded under the roads (grade.js): the worker makes the collision again from it
    function grade(F) {
      if (q.get("grade") === "0") return Promise.resolve(null);
      const wm = env.world_map, t = performance.now(), g = Grade.apply(env.heights0, wm.width, wm.world_size, wm.world_height, F.items, { sea: wm.sea_level });
      demo.grade = { texels: g.texels, max_cut: +g.max_cut.toFixed(2), max_fill: +g.max_fill.toFixed(2), skipped: g.skipped, ms: Math.round(performance.now() - t) };
      return env.set_heights(g.heights, { graded: true });
    }
    // the decks: one static mesh for all of them + their boxes in the physics world
    function make_decks(bridges) {
      const gy = env.ground.y, mesh = { P: [], N: [], C: [], I: [] }, rows = []; let piers = 0, longest = 0, n = 0;
      bridges.forEach(function (b) {
        const m = Bridge.build({ a: b.a, b: b.b, ya: gy(b.a[0], b.a[1]), yb: gy(b.b[0], b.b[1]), width: b.width }, { ground: gy, sea: env.ground.sea });
        if (!m.I.length) return;
        const base = mesh.P.length / 3;
        for (let i = 0; i < m.P.length; i++) { mesh.P.push(m.P[i]); mesh.N.push(m.N[i]); mesh.C.push(m.C[i]); }
        for (let i = 0; i < m.I.length; i++) mesh.I.push(m.I[i] + base);
        m.rows.forEach(function (r) { rows.push(r); }); n++; piers += m.info.piers; longest = Math.max(longest, m.info.length);
      });
      demo.bridges = { list: bridges.map(function (b) { return [Math.round(b.a[0]), Math.round(b.a[1]), Math.round(b.b[0]), Math.round(b.b[1])]; }), count: n, piers: piers, longest: Math.round(longest), boxes: 0, triangles: mesh.I.length / 3 };
      if (mesh.I.length) {
        const def = { name: "demo_bridges", max_instances: 1, skeleton: [{ name: "root", head: [0, 0, 0], tail: [0, 0.1, 0] }], mesh: { positions: Float32Array.from(mesh.P), normals: Float32Array.from(mesh.N), indices: Uint32Array.from(mesh.I), colors: Float32Array.from(mesh.C) } };
        const sp = system.species(def, { static: true }); sp.spawn({ x: 0, y: 0, z: 0, scale: 1, yaw: 0 });
      }
      return env.set_decks(rows).then(function (boxes) { demo.bridges.boxes = boxes; });
    }
    const measure = function () {
      const g = env.ground, n = 96, half = size / 2; let lo = 1e9, hi = -1e9, land = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = -half + (i + 0.5) * size / n, z = -half + (j + 0.5) * size / n, y = g.y(x, z); if (y < lo) lo = y; if (y > hi) hi = y; if (g.land(x, z)) land++; }
      return { min: +lo.toFixed(1), max: +hi.toFixed(1), sea: +g.sea.toFixed(1), land: +(land / (n * n)).toFixed(3) };
    };

    system.init({ table_bytes: 64 << 20, max_species: 500 });
    let places = null, runner = null;
    env.ready.then(function () {
      lap("terrain"); demo.ground = measure();
      env.draw_color.push(system.render_all); env.draw_shadow.push(system.render_all);
      return load_ground();
    }).then(function (n) {
      demo.ground_materials = n; lap("ground_materials");
      places = make_places(); lap("places");
      const main = places.out[0].site; focus = { x: main.x, z: main.z, r: places.out[0].radius };
      place_camera();
      const links = places.sites.length > 1 ? make_links(places.sites) : { roads: [], bridges: [] };
      lap("links");
      const input = RoadField.from_places(places.out.map(function (p) { return p.res; }), [], {});
      links.roads.forEach(function (r) { input.roads.push(r); });
      const F = RoadField.build(input, { size: size });
      demo.roads = { segments: F.segments, pads: F.pads, cells: F.n, entries: F.entries };
      if (n) env.set_roads(F); else demo.notes.push("the pack has no ground materials: the roads are not drawn");
      lap("road_field");
      return grade(F).then(function () { lap("grade"); return make_decks(links.bridges); });
    }).then(function () {
      lap("bridges");
      // the buildings: ids, then the elements runtime (a mesh a size and colour); the boxes stand on the graded ground
      const all = []; let id = 0;
      places.out.forEach(function (p) { p.res.elements.forEach(function (e) { const el = Structures.element(e); el.id = "b" + (++id); all.push(el); }); });
      demo.elements = all.length;
      const keys_ = {}; all.forEach(function (e) { keys_[Structures.key_of(e.type, e.p)] = 1; }); demo.meshes_wanted = Object.keys(keys_).length;
      runner = Elements.create({ system: system, structures: Structures, ground: function () { return env.ground; }, on_error: function (t) { console.warn("happy.demo: elements: " + t); } });
      return runner.set(all);
    }).then(function () {
      lap("buildings");
      const st = runner.stats(); demo.shown = st.shown; demo.species = st.species; demo.by_type = st.by_type; demo.triangles = st.triangles; demo.element_errors = runner.errors.slice(0, 5);
      let frames_at = 0;
      engine.on_frame_begin.add(function () {
        demo.frames++;
        if (demo.done) return;
        if (!frames_at) frames_at = demo.frames;
        if (demo.frames - frames_at >= 40) {
          demo.collision = env.stats && env.stats.collision ? { shapes: env.stats.collision.boxes } : null;
          demo.done = true;
          console.log("happy.demo: " + demo.sites.length + " places, " + demo.shown + " of " + demo.elements + " buildings in " + demo.species + " meshes, " + (demo.roads ? demo.roads.segments : 0) + " road segments, " + (demo.bridges ? demo.bridges.count : 0) + " bridges");
        }
      });
    }).catch(fail);
  }

  engine({})(ready);
});
