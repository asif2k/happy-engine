packing("@/engine.js", "@/debug.js", "@/system/system.js", "@/system/environment.js", "@/land.js")(function (engine, land, dom, httprequest) {
  // VEGETATION DEMO (/demos/vegetation_demo.html): the terrain of terrain_demo.js with the trees and plants of land.js. The world asks for them (`vegetation: true`) and gives environment.create the module (`land`): when the ground is there the environment calls land(scene),
  // which makes the species' meshes (the C++ tree and plant generators), the billboards and the passes' draws; the worker's scatter (land_init: rules by temperature, humidity, altitude and slope from the biome map, in chunks tested against the camera's frustum) is started by THIS page
  // (land.js ends its function with an early `return;` before the call, and environment.js keeps no biome map: the page reads the biome pass's `vegetation` pixels itself and sends them with the sizes).
  // Left drag turns the camera, right drag pans, the wheel zooms; W / S / A / D fly (Shift: fast), Q / E down / up, R puts the camera back on the chunk with the most trees.
  //   ?preset=highlands|alps|plains|lakeland|tropical|...      the terrain (default highlands)      ?seed=5      ?size=4096      ?map=512      texels a side of the heightmap (the biome map the scatter reads is the same size)      ?height=0.25
  //   ?cam=yaw,pitch,distance      ?look=x,z      the camera (default: the chunk with the most trees, 130 m away)      ?atmosphere=0|1  ?shadows=0|1  ?sun=az,el  ?fl=AERIAL_SCALE:0.1  ?boxes=1      also draw the wire boxes of the species that have no mesh      ?stats=1      as in terrain_demo.js
  // `window.happy_demo` is what a test reads: { done, error, preset, seed, size, ground, vegetation: { instances, chunks, species_used, with_mesh, top, drawn, visible_chunks, densest, grove }, frames, camera }.

  const lib_of = function (read) { let lib = null; read(function () { return function (name, factory) { lib = factory(); }; }); return lib; };
  const Ground = lib_of(function (packing) { import("@/system/ground.js"); });

  function ready(engine) {
    const system = engine.system;
    const q = new URLSearchParams(location.search);
    const num = function (k, d) { const v = q.get(k); return v === null || v === "" || !isFinite(+v) ? d : +v; };
    const list = function (k, d) { const v = q.get(k); if (!v) return d; const a = v.split(",").map(Number); return a.every(isFinite) ? a : d; };
    const demo = window.happy_demo = { done: false, error: null, preset: q.get("preset") || "highlands", seed: num("seed", 5), size: num("size", 4096), ground: null, ground_materials: 0, vegetation: null, frames: 0, camera: null, ms: {} };
    if (window.PR$ && q.get("stats") !== "1") window.PR$.style.display = "none";
    const t0 = performance.now(), lap = function (k) { demo.ms[k] = Math.round(performance.now() - t0); };
    const sun = list("sun", [35, 40]);
    const fl = { AERIAL_SCALE: 0.1 };
    (q.get("fl") || "").split(",").forEach(function (kv) { const a = kv.split(":"); if (a.length === 2 && isFinite(+a[1])) fl[a[0]] = +a[1]; });
    { const names = {}; let next = 1; window.SL = function (name, value) { if (names[name]) return names[name]; const expr = "u_float_params[" + (next++) + "]"; engine.uniforms.set(expr, fl[name] !== undefined ? fl[name] : parseFloat(value)); return (names[name] = expr); }; }

    let env, ctl, tm, got_land = null;
    // THE VEGETATION: land.js's page side first, then the worker's scatter from the biome map's pixels
    const start_land = function (scene) {
      land(scene);
      // land.js loads the meshes of the first 11 trees and the first 11 plants of its presets; the other species of the rules are drawn as coloured wire boxes (land.vegid, its debug draw): left out unless ?boxes=1
      if (q.get("boxes") !== "1" && land.vegid) land.vegid.render = function () {};
      const wm = env.world_map, n = wm.biome_map.width, bytes = new Uint8Array(n * n * 4), veg = wm.biome_map.vegetation;
      engine._read_pixel_pbo_from_buffer(wm.biome_map, 0, 0, n, n, veg.attachment, veg.format, veg.format_type, bytes);
      let sum = 0; for (let i = 0; i < bytes.length; i += 97) sum += bytes[i];
      demo.biome_map = { size: n, bytes: bytes.length, checksum: sum };
      const output = engine.land_output;                                                          // (what the worker answers with: the chunks and the instances)
      engine.land_output = function (def) {
        output(def);
        const per = {}; let at = null, groves = null;
        def.chunks.forEach(function (c) {
          if (!at || c.count > at.count) at = c;
          let trees = 0;                                                                         // (the trees that have a mesh in this chunk: where the camera goes)
          for (let a = 0; a < c.count; a++) { const s = def.species_map[def.instances[(c.start_index + a) * 6 + 5]]; if (s.is_tree && land.species[s.name]) trees++; }
          if (!groves || trees > groves.trees) groves = { x: Math.round(c.center[0]), y: Math.round(c.center[1]), z: Math.round(c.center[2]), r: Math.round(c.radius), trees: trees, count: c.count };
        });
        for (let i = 0; i < def.count; i++) { const s = def.species_map[def.instances[i * 6 + 5]]; per[s.name] = (per[s.name] || 0) + 1; }
        const names = Object.keys(per).sort(function (a, b) { return per[b] - per[a]; });
        got_land = { instances: def.count, chunks: def.chunks.length, species_map: def.species_map.length, species_used: names.length, with_mesh: names.filter(function (k) { return land.species[k]; }).length, instances_with_mesh: names.reduce(function (a, k) { return a + (land.species[k] ? per[k] : 0); }, 0), top: names.slice(0, 8).map(function (k) { return k + ":" + per[k] + (land.species[k] ? "" : "(box)"); }), densest: at ? { x: Math.round(at.center[0]), z: Math.round(at.center[2]), count: at.count } : null, grove: groves };
        lap("land_output");
      };
      engine.call_worker("land_init", { world_size: wm.world_size, world_height: wm.world_height, has_heightmap: true, biome_map: bytes, biome_map_size: n });
      lap("land_init");
    };

    try {
      env = engine.environment.create({
        map_size: num("map", 512), land: start_land,
        world: { size: demo.size, terrain: { preset: demo.preset, seed: demo.seed, height_scale: num("height", 0.25) }, sun: { azimuth: sun[0], elevation: sun[1] }, ambient: num("ambient", 0.5), atmosphere: q.get("atmosphere") !== "0", shadows: q.get("shadows") !== "0", vegetation: true, camera: { fov: 65, near: 0.5, far: 0, min_height: 2 } }
      });
    } catch (e) { demo.error = String(e && e.message || e); demo.done = true; console.error("happy.demo: " + demo.error); return; }
    window.happy_env = env;

    // ---- the camera (as terrain_demo.js)
    ctl = env.camera.control; tm = engine.tra_model;
    const keys = {};
    let focus = null;
    function place_camera() {
      const cam = list("cam", [35, -14, 130]), at = list("look", focus ? [focus.x, focus.z] : [0, 0]);
      const gy = env.ground ? env.ground.y(at[0], at[1]) : 0;
      tm.set_position(ctl, at[0], Math.max(gy, env.ground ? env.ground.sea : 0) + 4, at[1]);
      ctl.distance = cam[2]; ctl.eular[1] = cam[0] * Math.PI / 180; ctl.eular[0] = cam[1] * Math.PI / 180;
      tm.set_eular(ctl, ctl.eular[0], ctl.eular[1], 0);
    }
    const mouse = engine.webgl.elm = dom.use_mouse(engine.webgl.canvas);
    mouse.mouse_drag = function (dx, dy, e) {
      if (e.buttons === 1) tm.yaw_pitch(ctl, -dx * 0.0025, -dy * 0.0025);
      else if (e.buttons === 2) { const k = Math.max(0.1, ctl.distance * 0.0016); tm.pan_xz(ctl, -dx * k, -dy * k); }
    };
    mouse.mouse_wheel = function (sp) { ctl.distance = Math.max(2, ctl.distance * Math.exp(-sp * 0.0012)); };
    window.addEventListener("keydown", function (e) { keys[e.code] = true; if (e.code === "KeyR") place_camera(); });
    window.addEventListener("keyup", function (e) { keys[e.code] = false; });
    engine.on_frame_begin.add(function () {
      const sp = Math.max(0.5, ctl.distance * 0.012) * (keys.ShiftLeft || keys.ShiftRight ? 5 : 1);
      if (keys.KeyW) tm.front_back(ctl, -sp); if (keys.KeyS) tm.front_back(ctl, sp);
      if (keys.KeyA) tm.pan_xz(ctl, -sp, 0); if (keys.KeyD) tm.pan_xz(ctl, sp, 0);
      if (keys.KeyE) tm.add_position(ctl, 0, sp, 0); if (keys.KeyQ) tm.add_position(ctl, 0, -sp, 0);
    });

    const load_ground = function () {
      return system.load("/system/system.bin").then(function () {
        if (!system.sections("ground.").length) return 0;
        return system.bytes("ground.textures").then(function (bytes) { return Ground.load(bytes, Ground.browser_decode); }).then(function (L) {
          L.table = Ground.table(L.header); env.set_ground(L); return L.header.materials.length;
        });
      }).catch(function (e) { console.warn("happy.demo: no ground materials: " + (e && e.message || e)); return 0; });
    };
    const measure = function () {
      const g = env.ground, n = 96, half = demo.size / 2; let lo = 1e9, hi = -1e9, land_ = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = -half + (i + 0.5) * demo.size / n, z = -half + (j + 0.5) * demo.size / n, y = g.y(x, z); if (y < lo) lo = y; if (y > hi) hi = y; if (g.land(x, z)) land_++; }
      return { min: +lo.toFixed(1), max: +hi.toFixed(1), sea: +g.sea.toFixed(1), land: +(land_ / (n * n)).toFixed(3) };
    };

    system.init({ table_bytes: 16 << 20, max_species: 4 });
    env.ready.then(function () {
      lap("terrain"); demo.ground = measure();
      env.draw_color.push(system.render_all); env.draw_shadow.push(system.render_all);
      return load_ground();
    }).then(function (n) {
      demo.ground_materials = n; lap("ground_materials");
      place_camera();
      // wait for the worker's scatter (a minute at most), then put the camera on its densest chunk
      return new Promise(function (resolve) {
        const t = performance.now(), poll = function () { if (got_land || performance.now() - t > 180000) resolve(); else setTimeout(poll, 200); };
        poll();
      });
    }).then(function () {
      if (!got_land) { demo.error = "the worker's vegetation scatter (land_init) never answered"; demo.done = true; return; }
      if (got_land.grove && !q.get("look")) { focus = { x: got_land.grove.x, z: got_land.grove.z }; place_camera(); }
      let frames_at = 0;
      engine.on_frame_begin.add(function () {
        demo.frames++;
        if (demo.done) return;
        if (!frames_at) frames_at = demo.frames;
        if (demo.frames - frames_at >= 60) {
          const c = ctl.world_position; demo.camera = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
          demo.vegetation = Object.assign({}, got_land, { drawn: window.PR ? window.PR.drawn_instances : null, visible_chunks: window.PR ? window.PR.land_chunks : null, drawn_species: land.all_species ? land.all_species.filter(function (s) { return s.draw_instances > 0; }).map(function (s) { return s.id + ":" + s.draw_instances; }) : null });
          demo.done = true;
          console.log("happy.demo: vegetation " + got_land.instances + " instances in " + got_land.chunks + " chunks, " + got_land.species_used + " species used, " + got_land.with_mesh + " with a mesh");
        }
      });
    }).catch(function (e) { demo.error = String(e && e.stack || e); console.error("happy.demo: " + demo.error); demo.done = true; });
  }

  engine({})(ready);
});
