packing("@/engine.js", "@/system/system.js", "@/system/environment.js")(function (engine, dom, httprequest) {
  // TERRAIN DEMO (/demos/terrain_demo.html): the procedural terrain of system/environment.js (a heightmap made by the worker, drawn as a chunk quadtree, the PBR ground materials of system.bin, the sky, the sun, the cascaded shadows).
  // Left drag turns the camera, right drag pans, the wheel zooms; W / S / A / D fly (hold Shift for fast), Q / E down / up, R puts the camera back.
  //   ?preset=highlands|alps|plains|canyons|river_plains|... (default highlands)    the terrain preset (env.presets: the names are in window.happy_demo.presets)      ?seed=1024      the land's seed      ?size=4096      metres a side of the land
  //   ?map=512      texels a side of the heightmap (64 .. 4096)      ?height=0.25      the world's height scale (0.05 .. 4)      ?sun=35,50      the sun's azimuth and elevation (degrees)      ?ambient=0.5
  //   ?atmosphere=0|1  ?shadows=0|1      (both on by default)      ?cam=yaw,pitch,distance      where the orbit camera starts (degrees, degrees, metres)      ?look=x,z      what it looks at (default: the middle of the land)      ?stats=1      the engine's own numbers panel
  // `window.happy_demo` is what a test reads: { done, error, preset, seed, size, presets, ground: { min, max, sea, land, centre }, collision, ground_materials, frames, camera: [x, y, z] }.

  const lib_of = function (read) { let lib = null; read(function () { return function (name, factory) { lib = factory(); }; }); return lib; };
  const Ground = lib_of(function (packing) { import("@/system/ground.js"); });

  function ready(engine) {
    const system = engine.system;
    const q = new URLSearchParams(location.search);
    const num = function (k, d) { const v = q.get(k); return v === null || v === "" || !isFinite(+v) ? d : +v; };
    const list = function (k, d) { const v = q.get(k); if (!v) return d; const a = v.split(",").map(Number); return a.every(isFinite) ? a : d; };
    const demo = window.happy_demo = { done: false, error: null, preset: q.get("preset") || "highlands", seed: num("seed", 1024), size: num("size", 4096), presets: null, ground: null, collision: null, ground_materials: 0, frames: 0, camera: null };
    if (window.PR$ && q.get("stats") !== "1") window.PR$.style.display = "none";
    const t0 = performance.now();
    const sun = list("sun", [35, 50]);

    // ?fl=AERIAL_SCALE:0.2,EXPOSURE:20   the lighting pass's own live sliders (deffered_rendering_v2.js FL(): AERIAL_SCALE, EXPOSURE, DENSITY, AMBIENT_SCALE, SHADOW_*): without the sidebar they are constants, so with the numbers given here the page makes them uniforms
    const fl = { AERIAL_SCALE: 0.1 }; let fl_n = 1;                                 // (the default haze of the lighting pass, 0.8, washes a land of kilometres out to white: 0.1 is a clear day)
    (q.get("fl") || "").split(",").forEach(function (kv) { const a = kv.split(":"); if (a.length === 2 && isFinite(+a[1])) fl[a[0]] = +a[1]; });
    if (fl_n) {
      const names = {}; let next = 1;
      window.SL = function (name, value) {
        if (names[name]) return names[name];
        const expr = "u_float_params[" + (next++) + "]";
        engine.uniforms.set(expr, fl[name] !== undefined ? fl[name] : parseFloat(value));
        return (names[name] = expr);
      };
    }

    let env;
    try {
      env = engine.environment.create({
        map_size: num("map", 512),
        world: {
          size: demo.size,
          terrain: { preset: demo.preset, seed: demo.seed, height_scale: num("height", 0.25) },
          sun: { azimuth: sun[0], elevation: sun[1] }, ambient: num("ambient", 0.5),
          atmosphere: q.get("atmosphere") !== "0", shadows: q.get("shadows") !== "0",
          camera: { fov: 65, near: 0.5, far: 0, min_height: 3 }
        }
      });
    } catch (e) { demo.error = String(e && e.message || e); demo.done = true; console.error("happy.demo: " + demo.error); return; }
    demo.presets = Object.keys(env.presets || {});
    window.happy_env = env;

    // ---- the camera: an orbit node (left drag turns, right drag pans, the wheel zooms) and the keys that fly it
    const ctl = env.camera.control, tm = engine.tra_model;
    const keys = {};
    const look_at = list("look", [0, 0]);
    function place_camera() {
      const cam = list("cam", [35, -30, Math.max(300, demo.size * 0.25)]);
      const gy = env.ground ? env.ground.y(look_at[0], look_at[1]) : 0;
      tm.set_position(ctl, look_at[0], Math.max(gy, env.ground ? env.ground.sea : 0) + 2, look_at[1]);
      ctl.distance = cam[2];
      ctl.eular[1] = cam[0] * Math.PI / 180; ctl.eular[0] = cam[1] * Math.PI / 180;
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
    engine.on_frame_begin.add(function (time, dt) {
      const sp = Math.max(1, ctl.distance * 0.012) * (keys.ShiftLeft || keys.ShiftRight ? 5 : 1);
      if (keys.KeyW) tm.front_back(ctl, -sp); if (keys.KeyS) tm.front_back(ctl, sp);
      if (keys.KeyA) tm.pan_xz(ctl, -sp, 0); if (keys.KeyD) tm.pan_xz(ctl, sp, 0);
      if (keys.KeyE) tm.add_position(ctl, 0, sp, 0); if (keys.KeyQ) tm.add_position(ctl, 0, -sp, 0);
    });

    // ---- the ground materials of the pack (once the terrain is there), then the numbers a test reads
    const load_ground = function () {
      return system.load("/system/system.bin").then(function () {
        if (!system.sections("ground.").length) return 0;
        return system.bytes("ground.textures").then(function (bytes) { return Ground.load(bytes, Ground.browser_decode); }).then(function (L) {
          L.table = Ground.table(L.header); env.set_ground(L); return L.header.materials.length;
        });
      }).catch(function (e) { console.warn("happy.demo: no ground materials: " + (e && e.message || e)); return 0; });
    };
    const measure = function () {
      const g = env.ground, n = 96, half = demo.size / 2;
      let lo = 1e9, hi = -1e9, land = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = -half + (i + 0.5) * demo.size / n, z = -half + (j + 0.5) * demo.size / n, y = g.y(x, z);
        if (y < lo) lo = y; if (y > hi) hi = y; if (g.land(x, z)) land++;
      }
      return { min: +lo.toFixed(1), max: +hi.toFixed(1), sea: +g.sea.toFixed(1), land: +(land / (n * n)).toFixed(3), centre: +g.y(0, 0).toFixed(1) };
    };

    system.init({ table_bytes: 16 << 20, max_species: 4 });
    env.ready.then(function () {
      demo.ready_ms = Math.round(performance.now() - t0);
      demo.ground = measure();
      env.draw_color.push(system.render_all); env.draw_shadow.push(system.render_all);
      place_camera();
      return load_ground();
    }).then(function (n) {
      demo.ground_materials = n; demo.total_ms = Math.round(performance.now() - t0);
      let frames_at = 0;
      engine.on_frame_begin.add(function () {                                   // (not on_frame: the deferred pass's handler is walked there and what is added after it is skipped)
        demo.frames++;
        if (demo.done) return;
        const c = ctl.world_position; demo.camera = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
        if (!frames_at) frames_at = demo.frames;
        if (demo.frames - frames_at >= 40) {
          demo.collision = env.stats && env.stats.collision ? { shapes: env.stats.collision.boxes, max_error: +env.stats.collision.max_error.toFixed(2) } : null;
          demo.done = true;
          console.log("happy.demo: terrain " + demo.preset + " seed " + demo.seed + " " + demo.size + " m, heights " + demo.ground.min + " .. " + demo.ground.max + " m, " + Math.round(demo.ground.land * 100) + " % land, " + n + " ground materials");
        }
      });
    }).catch(function (e) { demo.error = String(e && e.stack || e); console.error("happy.demo: " + demo.error); demo.done = true; });
  }

  engine({})(ready);
});
