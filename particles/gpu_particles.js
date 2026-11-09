packing("engine")("gpu_particles", function (engine) {
  // GPU PARTICLES (engine.gpu_particles): particles that live and move on the GPU, with SOFT edges where they meet the scene (fire, smoke, explosions, sparks, dust, rain).
  // The page only counts what is born this frame (a few numbers per emitter and burst); nothing runs per particle on the CPU, nothing is uploaded per particle and no worker is involved
  // (the physics / AI worker is never asked for anything). A frame with nothing alive does no GPU work at all.
  //
  //   const gp  = engine.gpu_particles;
  //   const scr = engine.deffered_rendering({ camera, dlight0, ... });
  //   gp.attach(scr);                                    // soft particles: "alpha" / "add" systems are drawn after the lighting pass and fade where they sink into the G-buffer's surfaces
  //   const fx  = gp.create({ capacity: 65536, blend: "add", depth_fade: 0.6 });         // a system: one draw call, one blend mode, one texture
  //   const fire = fx.emitter("fire", { rate: 4000, lifetime: [0.4, 0.9], speed: [0.5, 1.5], spread: 18, size: [0.4, 0.05], color: [[1, 0.9, 0.4, 1], [1, 0.4, 0.1, 0.7], [0.1, 0, 0, 0]], gravity: [0, 2, 0], turbulence: 1.2 });
  //   fire.at(x, y, z);                                  // every frame if it moves (a moving emitter leaves a continuous trail at any frame rate)
  //   fire.burst(5000, x, y, z, vx, vy, vz);             // an explosion: n at once from a point, (vx, vy, vz) added to what the emitter gives them
  //   fire.stop(); fire.start(); fire.set({ rate: 800 }); fire.dispose();
  //   gp.render();                                       // call it in the scene pass (the G-buffer pass of a deferred scene) for the systems that are NOT soft: blend "dither", or any system while nothing is attached
  //   fx.clear(); fx.dispose();   gp.stats  { systems, window, births, dropped, passes }
  //
  // SYSTEM options: capacity (slots: the longest lifetime x the rate that is alive at once; births that do not fit are dropped and counted), blend "dither" (stochastic alpha into the G-buffer: lit by the
  // deferred pass, noisy, no soft edges) | "alpha" | "add" (default "add"), texture (an engine texture; without one the sprite is a soft round disc), sheet [columns, rows] (a flipbook: the frame follows
  // the age, or `flip` frames a second), soft (0 hard .. 1 all falloff, the disc's edge), depth_fade (metres over which a particle fades out where it meets a surface; 0 = off; default 0.5),
  // intensity (a multiplier of the colour of alpha / add systems: the lit image is tonemapped, so 1 is white), diffuse (dither systems only, as in the deferred pass),
  // cast_shadow (any blend; default false; a property: `sys.cast_shadow = true / false` at any time; drawn into the sun's shadow maps as stochastic opacity, so a smoke column shades the ground in
  // proportion to its alpha) and shadow_density (default 1: a multiplier of that opacity; `sys.shadow_density`). `gp.shadows = false` switches every system's off, `gp.shadow_cascades` (2) how many cascades take them.
  // receive_shadow (alpha systems, default 1 .. 0: how much a puff dims where the sun's shadow falls on it, so smoke in a tank's shadow is not a bright patch over a dark surface; `gp.shadow_receive = false` switches every system's off).
  // EMITTER options (angles in degrees, lengths in metres, times in seconds; a typo throws; all optional):
  //   rate 0 per second     lifetime [1, 1]    speed [1, 1]    direction [0, 1, 0] + spread 30 (half angle of the cone; 180 = everywhere)    shape "point" | "sphere" | "box" | "disc" + extent + shell
  //   size 0.25 | [start, end] | [4 keys]   size_random 0 .. 1   color [r, g, b, a] | 2 to 4 keys of them over the life   fade [in, out] (fractions of the life)   gravity [0, 0, 0]   wind [0, 0, 0] (what drag pulls to)
  //   drag 0 (1/s)   turbulence 0 | { strength, scale, speed }   rotation [a, b]   spin [a, b] (degrees / s)   collide "none" | "die" | "bounce" | "slide" + ground (a height, or "terrain": see gp.set_ground) + bounce + friction + radius
  //   stretch 0 (seconds of its velocity added to its length: sparks, rain)   flip 0   inherit 0 (the share of a moving emitter's velocity)   lod [near, far] (fewer births with the distance)   max_distance 0
  //
  // HOW IT WORKS (so that it stays fast). Each system keeps its particles in a WINDOW of a buffer, oldest first. Every frame one transform-feedback pass reads the window (minus the oldest slots, whose
  // latest possible death the page knows from the lifetimes: no read-back), moves each particle and writes it, with this frame's newborns appended, into the other buffer: so the window is contiguous, needs
  // no free list, and one instanced draw covers it. Newborns are made by the same pass from a small table of "batches" (emitter, count, where from -> to, when): a trail, a burst, a rate are the same row.
  //   Cost: the update is one vertex-shader run per live slot (64 bytes read, 64 written), the draw 4 vertices per slot; dead slots inside the window are skipped by the draw at once.
  // WHAT IT DOES NOT DO: it cannot touch the physics world (a GPU particle is not readable) and it does not sort ("add" and "dither" need no order; "alpha" is unsorted).
  block$(function engine_core() {
    engine.gpu_particles = (function () {
      const gp = {};
      const gl = engine.webgl.gl;

      const MAX_EMITTERS = 256, ROW = 80, ROW_TEXELS = 20, MAX_BATCH = 1024, MAX_BURSTS = 1024, REC = 16, STRIDE = 64, MAX_CAPACITY = 4194304, MAX_SYSTEMS = 32, QUEUE = 16384;
      const DEG = Math.PI / 180;
      // the params of an emitter, as the shaders read them (the order is shared with the shaders through the constants made below)
      const PARAMS = ["rate", "life0", "life1", "speed0", "speed1", "dir_x", "dir_y", "dir_z", "spread", "shape", "ext_x", "ext_y", "ext_z", "shell",
        "size0", "size1", "size2", "size3", "size_rnd",
        "c0r", "c0g", "c0b", "c0a", "c1r", "c1g", "c1b", "c1a", "c2r", "c2g", "c2b", "c2a", "c3r", "c3g", "c3b", "c3a",
        "fade_in", "fade_out", "grav_x", "grav_y", "grav_z", "wind_x", "wind_y", "wind_z", "drag", "turb", "turb_scale", "turb_speed",
        "rot0", "rot1", "spin0", "spin1", "collide", "bounce", "friction", "ground_mode", "ground_y", "radius",
        "stretch", "flip_frames", "flip_fps", "inherit", "lod_near", "lod_far", "max_dist"];
      const P = Object.create(null);
      PARAMS.forEach(function (n, i) { P[n] = i; });
      const NP = PARAMS.length;                                   // 64: sixteen texels of a row; the seventeenth texel is "this emitter exists"
      const SHAPES = { point: 0, sphere: 1, box: 2, disc: 3 }, COLLIDE = { none: 0, die: 1, bounce: 2, slide: 3 };
      const OPTIONS = ["rate", "lifetime", "speed", "direction", "spread", "shape", "extent", "shell", "size", "size_random", "color", "fade", "gravity", "wind", "drag", "turbulence",
        "rotation", "spin", "collide", "ground", "bounce", "friction", "radius", "stretch", "flip", "inherit", "lod", "max_distance"];
      const DEFAULTS = {
        rate: 0, lifetime: [1, 1], speed: [1, 1], direction: [0, 1, 0], spread: 30, shape: "point", extent: 0, shell: false, size: 0.25, size_random: 0, color: [1, 1, 1, 1], fade: [0.1, 0.4],
        gravity: [0, 0, 0], wind: [0, 0, 0], drag: 0, turbulence: 0, rotation: [0, 0], spin: [0, 0], collide: "none", ground: "terrain", bounce: 0.4, friction: 0.3, radius: 1,
        stretch: 0, flip: 0, inherit: 0, lod: [0, 0], max_distance: 0
      };
      // the dither shader (the G-buffer pass and the shadow pass) replaces the default material's has_discard(): a function that both a parent and a child shader define is a GLSL error unless the
      // engine is told to inherit it (it then renames the parent's), as rendering.js does for the pbr hooks
      if (engine.shaders.inherritables.indexOf("has_discard") < 0) engine.shaders.inherritables.push("has_discard");
      gp.P = P; gp.PARAMS = PARAMS; gp.MAX_EMITTERS = MAX_EMITTERS; gp.DEFAULTS = DEFAULTS; gp.DEG = DEG;
      gp.stats = { systems: 0, window: 0, births: 0, dropped: 0, passes: 0, gpu_ms: -1 };      // gpu_ms: the GPU time of the update passes of a recent frame (gp.timing), -1 = unknown
      gp.timing = false;                                          // true: time the update passes on the GPU (EXT_disjoint_timer_query_webgl2; the result arrives a few frames late)
      gp.debug = false;                                           // true: every pass checks gl.getError() and throws
      gp.manual = false;                                          // true: the engine's frames do not step the systems; call gp.update(dt) yourself (tests)
      gp.screen = null;
      gp.atmosphere = true;                                       // false: the soft particles are not hazed by the attached pass's atmosphere (a system can also turn it down: its `atmosphere` option, 0 .. 1)
      engine.uniforms.set("ps_moon", new Float32Array([0.5, 0.25, 1.0]));          // (the lighting pass's moon; gp.attach reads the screen's)
      // the sun's shadow on the soft alpha particles: they are drawn after the lighting pass in a colour of their own, so without it a puff in a shadow stays as bright as one in the sun and shows as a light patch on a dark surface.
      // Each corner of a puff looks up the attached pass's cascade maps (the lighting pass's own: nearest cascade by the distance to the camera) and takes the share of the colour that is left in shadow: gp.shadow_receive_min
      // (in the screen's colours, 0 .. 1: the lighting pass keeps about a fifth of the sun's light in a shadow, which is half of a display value)
      gp.shadow_receive = true; gp.shadow_receive_min = 0.5;
      function receives() { const s = gp.screen; return !!(gp.shadow_receive && s && s.shadows_enabled && s.cascades && s.cascades.length === 3); }

      // ---- quality ------------------------------------------------------------------------------------------------------------------------------------------
      // What a frame of particles costs is the births (the update, the draw and the overdraw all grow with them), the size of the picture the soft pass is drawn in, and how far away particles are still drawn.
      //   gp.set_quality("low" | "medium" | "high" | "ultra")      or  gp.set_quality({ count, resolution, lod, far, soft })  (the level then reads "custom")
      //   count        a multiplier of every emitter's births (rate and bursts): 0.25 = a quarter of the particles (a burst of 100 gives 25; the remainders are carried, not lost)
      //   resolution   the soft pass is drawn in a picture of this share of the screen's size (0.25 .. 1) and laid over the screen: fill rate falls with its square, the edges of smoke are bilinearly soft anyway
      //   lod          a multiplier of every emitter's lod distances and max_distance (0.5: everything is thinned and cut at half the distance)
      //   far          no particle is drawn beyond this many metres (0 = no limit)
      //   soft         false: no depth fade, a hard cut where a particle meets a surface
      //   auto         true: the level follows the frame time: lowered (never below "low") when the frames are over `auto_ms` for `auto_hold` frames, raised (never above `auto_max`) after `auto_room` frames
      //                under 75% of it; a raise that does not hold doubles the wait for the next (the water module's scheme). The frame time is the whole frame's: use it when particles are what costs.
      const LEVELS = ["low", "medium", "high", "ultra"];
      const LEVEL_DEFS = {
        low: { count: 0.25, resolution: 0.5, lod: 0.5, far: 80, soft: true },
        medium: { count: 0.5, resolution: 0.75, lod: 0.75, far: 160, soft: true },
        high: { count: 1, resolution: 1, lod: 1, far: 0, soft: true },
        ultra: { count: 1.5, resolution: 1, lod: 1.5, far: 0, soft: true }
      };
      const quality = gp.quality = { level: "high", count: 1, resolution: 1, lod: 1, far: 0, soft: true, auto: false, auto_ms: 16.7, auto_hold: 45, auto_room: 90, auto_max: "ultra" };
      const qvec = new Float32Array([1, 1, 0, 0]);                // what the shaders read (ps_q): x the lod scale, y the resolution of the picture the soft pass is in, z the far limit
      const snap_res = function (r) { return Math.max(0.25, Math.min(1, Math.round(r * 4) / 4)); };
      function sync_quality() {
        quality.count = Math.max(0, Math.min(4, +quality.count));
        quality.resolution = snap_res(quality.resolution);
        quality.lod = Math.max(0.05, +quality.lod);
        quality.far = Math.max(0, +quality.far);
        qvec[0] = quality.lod; qvec[2] = quality.far;
      }
      gp.set_quality = function (q) {
        if (typeof q === "string") {
          if (!LEVEL_DEFS[q]) fail("quality is " + LEVELS.join(", ") + " or an object");
          Object.assign(quality, LEVEL_DEFS[q]); quality.level = q;
        } else {
          if (q === null || typeof q !== "object") fail("quality is " + LEVELS.join(", ") + " or an object");
          Object.keys(q).forEach(function (k) { if (!(k in quality) || k === "level") fail("unknown quality option '" + k + "'"); });
          Object.assign(quality, q);
          if (!Object.keys(q).every(function (k) { return k.indexOf("auto") === 0; })) quality.level = "custom";          // (only the auto settings changed: the level is what it was)
        }
        sync_quality();
        return quality;
      };
      gp.quality_levels = LEVELS; gp.quality_defs = LEVEL_DEFS;
      engine.uniforms.set("ps_q", qvec);
      const auto = { ema: 0, over: 0, room: 0, wait: 0, backoff: 0, tried: false };
      function auto_tick(real_dt) {
        if (!quality.auto) { auto.ema = 0; auto.over = 0; auto.room = 0; return; }
        const ms = real_dt * 1000;
        if (!(ms > 0) || ms > 2500) return;                       // (the first frame, a hidden tab)
        auto.ema = auto.ema ? auto.ema + (ms - auto.ema) * 0.1 : ms;
        if (auto.wait > 0) { auto.wait--; return; }
        let at = LEVELS.indexOf(quality.level);
        if (at < 0) at = LEVELS.indexOf("high");
        const top = Math.max(0, LEVELS.indexOf(quality.auto_max));
        if (auto.ema > quality.auto_ms * 1.1) { auto.over++; auto.room = 0; }
        else if (auto.ema < quality.auto_ms * 0.75) { auto.room++; auto.over = 0; }
        else { auto.over = 0; auto.room = 0; }
        const need = auto.backoff || quality.auto_room;
        const was_auto = quality.auto;
        if (auto.over >= quality.auto_hold && at > 0) {
          Object.assign(quality, LEVEL_DEFS[LEVELS[at - 1]]); quality.level = LEVELS[at - 1]; sync_quality();
          auto.over = 0; auto.wait = 30; auto.ema = quality.auto_ms;
          if (auto.tried) { auto.backoff = Math.min(need * 2, quality.auto_room * 30); auto.tried = false; }
        } else if (auto.room >= need && at < top) {               // (a raise is a trial: if the frame time breaks the limit again soon, the wait for the next is doubled)
          Object.assign(quality, LEVEL_DEFS[LEVELS[at + 1]]); quality.level = LEVELS[at + 1]; sync_quality();
          auto.room = 0; auto.wait = 30; auto.tried = true; auto.ema = quality.auto_ms * 0.9;
        } else if (auto.tried && auto.room > need * 5) { auto.tried = false; auto.backoff = 0; }
        quality.auto = was_auto;
      }
      gp.auto_state = auto;

      // ---- options -> params -----------------------------------------------------------------------------------------------------------------------------
      function fail(msg) { throw new Error("gpu_particles: " + msg); }
      function range(v, name, out, a, b) {
        if (typeof v === "number") { out[a] = v; out[b] = v; return; }
        if (Array.isArray(v) && v.length >= 2 && typeof v[0] === "number" && typeof v[1] === "number") { out[a] = v[0]; out[b] = v[1]; return; }
        fail(name + " is a number or [min, max]");
      }
      function vec3(v, name, out, a) {
        if ((!Array.isArray(v) && !ArrayBuffer.isView(v)) || v.length < 3) fail(name + " is [x, y, z]");
        out[a] = +v[0]; out[a + 1] = +v[1]; out[a + 2] = +v[2];
      }
      function size_keys(v, out) {                                // 1 value, [start, end] or 4 keys -> the 4 keys (linear in between)
        let k;
        if (typeof v === "number") k = [v, v, v, v];
        else if (Array.isArray(v) && v.length === 2) k = [v[0], v[0] + (v[1] - v[0]) / 3, v[0] + (v[1] - v[0]) * 2 / 3, v[1]];
        else if (Array.isArray(v) && v.length === 4) k = v;
        else fail("size is a number, [start, end] or four numbers");
        for (let i = 0; i < 4; i++) out[P.size0 + i] = +k[i];
      }
      function color_keys(v, out) {                               // [r, g, b, a] or 2 .. 4 keys of them -> the 4 keys
        let ks = v;
        if (typeof v[0] === "number") ks = [v, v];
        if (!Array.isArray(ks) || ks.length < 2 || ks.length > 4) fail("color is [r, g, b, a] or two to four of them");
        for (let i = 0; i < 4; i++) {
          const t = i / 3 * (ks.length - 1), j = Math.min(ks.length - 2, Math.floor(t)), u = t - j, a = ks[j], b = ks[j + 1];
          for (let c = 0; c < 4; c++) {
            const av = a[c] === undefined ? (c === 3 ? 1 : 0) : a[c], bv = b[c] === undefined ? (c === 3 ? 1 : 0) : b[c];
            out[P.c0r + i * 4 + c] = av + (bv - av) * u;
          }
        }
      }
      // def (the options given) -> out (the params). `all`: start from the defaults, else only what is given is written
      function fill(out, def, sys, all) {
        if (def === null || typeof def !== "object") fail("the options of an emitter are an object");
        Object.keys(def).forEach(function (k) { if (OPTIONS.indexOf(k) < 0) fail("unknown emitter option '" + k + "' (" + OPTIONS.join(", ") + ")"); });
        const d = all ? Object.assign({}, DEFAULTS, def) : def;
        const has = function (k) { return d[k] !== undefined; };
        if (has("rate")) { if (typeof d.rate !== "number" || !(d.rate >= 0)) fail("rate is a number >= 0"); out[P.rate] = d.rate; }
        if (has("lifetime")) { range(d.lifetime, "lifetime", out, P.life0, P.life1); if (!(out[P.life0] > 0) || !(out[P.life1] > 0)) fail("lifetime must be > 0"); }
        if (has("speed")) range(d.speed, "speed", out, P.speed0, P.speed1);
        if (has("direction")) vec3(d.direction, "direction", out, P.dir_x);
        if (has("spread")) out[P.spread] = d.spread * DEG;
        if (has("shape")) { if (SHAPES[d.shape] === undefined) fail("shape is point, sphere, box or disc"); out[P.shape] = SHAPES[d.shape]; }
        if (has("extent")) { if (typeof d.extent === "number") { out[P.ext_x] = d.extent; out[P.ext_y] = d.extent; out[P.ext_z] = d.extent; } else vec3(d.extent, "extent", out, P.ext_x); }
        if (has("shell")) out[P.shell] = d.shell ? 1 : 0;
        if (has("size")) size_keys(d.size, out);
        if (has("size_random")) out[P.size_rnd] = d.size_random;
        if (has("color")) color_keys(d.color, out);
        if (has("fade")) { if (!Array.isArray(d.fade) || d.fade.length < 2) fail("fade is [in, out]"); out[P.fade_in] = d.fade[0]; out[P.fade_out] = d.fade[1]; }
        if (has("gravity")) vec3(d.gravity, "gravity", out, P.grav_x);
        if (has("wind")) vec3(d.wind, "wind", out, P.wind_x);
        if (has("drag")) out[P.drag] = d.drag;
        if (has("turbulence")) {
          const t = d.turbulence;
          if (typeof t === "number") { out[P.turb] = t; if (!(out[P.turb_scale] > 0)) out[P.turb_scale] = 1; if (!(out[P.turb_speed] > 0)) out[P.turb_speed] = 1; }
          else { out[P.turb] = t.strength === undefined ? 1 : t.strength; out[P.turb_scale] = t.scale === undefined ? 1 : t.scale; out[P.turb_speed] = t.speed === undefined ? 1 : t.speed; }
        }
        if (has("rotation")) { range(d.rotation, "rotation", out, P.rot0, P.rot1); out[P.rot0] *= DEG; out[P.rot1] *= DEG; }
        if (has("spin")) { range(d.spin, "spin", out, P.spin0, P.spin1); out[P.spin0] *= DEG; out[P.spin1] *= DEG; }
        if (has("collide")) { if (COLLIDE[d.collide] === undefined) fail("collide is none, die, bounce or slide"); out[P.collide] = COLLIDE[d.collide]; }
        if (has("ground")) { if (d.ground === "terrain") out[P.ground_mode] = 0; else if (typeof d.ground === "number") { out[P.ground_mode] = 1; out[P.ground_y] = d.ground; } else fail("ground is 'terrain' or a height"); }
        if (has("bounce")) out[P.bounce] = d.bounce;
        if (has("friction")) out[P.friction] = d.friction;
        if (has("radius")) out[P.radius] = d.radius;
        if (has("stretch")) out[P.stretch] = d.stretch;
        if (has("flip")) out[P.flip_fps] = d.flip;
        if (all) out[P.flip_frames] = sys.sheet[0] * sys.sheet[1];
        if (has("inherit")) out[P.inherit] = d.inherit;
        if (has("lod")) { if (!Array.isArray(d.lod) || d.lod.length < 2) fail("lod is [near, far]"); out[P.lod_near] = d.lod[0]; out[P.lod_far] = d.lod[1]; }
        if (has("max_distance")) out[P.max_dist] = d.max_distance;
      }

      // ---- the shaders -----------------------------------------------------------------------------------------------------------------------------------
      // (GLSL is built from plain strings: no apostrophes in its comments, the engine strips comments with a regular expression that reads them as strings)
      const GLSL_PARAMS = PARAMS.map(function (n, i) { return "const int PE_" + n + " = " + i + ";"; }).join("\n");
      const GLSL_COMMON = [
        GLSL_PARAMS,
        "uniform sampler2D ps_params;",
        "int ps_eid = 0;",
        "float P(int i) { return texelFetch(ps_params, ivec2(i >> 2, ps_eid), 0)[i & 3]; }",
        "bool ps_exists() { return texelFetch(ps_params, ivec2(16, ps_eid), 0).x > 0.5; }",
        "float ps_curve4(int first, float t) {",
        "  float f = clamp(t, 0.0, 1.0) * 3.0;",
        "  int i = min(int(f), 2);",
        "  return mix(P(first + i), P(first + i + 1), f - float(i));",
        "}",
        "vec4 ps_gradient(float t) {",
        "  float f = clamp(t, 0.0, 1.0) * 3.0;",
        "  int i = min(int(f), 2);",
        "  int a = PE_c0r + i * 4;",
        "  return mix(vec4(P(a), P(a + 1), P(a + 2), P(a + 3)), vec4(P(a + 4), P(a + 5), P(a + 6), P(a + 7)), f - float(i));",
        "}",
        "float ps_smooth(float a, float b, float v) {",
        "  if (b <= a) return v >= b ? 1.0 : 0.0;",
        "  float t = clamp((v - a) / (b - a), 0.0, 1.0);",
        "  return t * t * (3.0 - 2.0 * t);",
        "}",
        "float ps_size_at(float t, float prnd, float sc) {",
        "  return ps_curve4(PE_size0, t) * (1.0 + P(PE_size_rnd) * (prnd * 2.0 - 1.0)) * sc;",
        "}"
      ].join("\n");

      const GLSL_UPDATE = [
        "#version 300 es",
        "precision highp float;",
        "precision highp int;",
        "precision highp sampler2D;",
        "layout(location = 0) in vec4 i0;",
        "layout(location = 1) in vec4 i1;",
        "layout(location = 2) in vec4 i2;",
        "layout(location = 3) in vec4 i3;",
        "uniform int u_mode;",
        "uniform float u_dt;",
        "uniform float u_time;",
        "uniform uint u_seed;",
        "uniform int u_nbatch;",
        "uniform sampler2D u_batch;",
        "uniform sampler2D u_ground_tex;",
        "uniform vec4 u_ground;",
        "uniform vec2 u_ground_origin;",
        "out vec4 o0;",
        "out vec4 o1;",
        "out vec4 o2;",
        "out vec4 o3;",
        GLSL_COMMON,
        "uint g_h = 0u;",
        "uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }",
        "float rnd() { g_h = pcg(g_h); return float(g_h >> 8) * (1.0 / 16777216.0); }",
        "vec3 ps_qrot(vec4 q, vec3 v) {",
        "  vec3 t = 2.0 * cross(q.xyz, v);",
        "  return v + q.w * t + cross(q.xyz, t);",
        "}",
        "vec3 ps_noise(vec3 p, float t) {",
        "  return vec3(0.5 * (sin(p.y * 1.7 + t) + sin(p.z * 2.3 - t * 1.3 + p.x * 0.7)),",
        "              0.5 * (sin(p.z * 1.9 + t * 0.8) + sin(p.x * 2.1 - t + p.y * 0.6)),",
        "              0.5 * (sin(p.x * 1.3 - t * 1.1) + sin(p.y * 2.7 + t * 0.9 + p.z * 0.5)));",
        "}",
        "float ps_gfetch(ivec2 p, ivec2 sz) { return texelFetch(u_ground_tex, clamp(p, ivec2(0), sz - ivec2(1)), 0).r; }",
        "float ps_ground_at(vec2 xz) {",
        "  vec2 uv = (xz - u_ground_origin) / u_ground.x + 0.5;",
        "  int m = int(u_ground.w + 0.5);",
        "  if (m == 0) return texture(u_ground_tex, uv).r * u_ground.y;",
        "  ivec2 sz = textureSize(u_ground_tex, 0);",
        "  vec2 p = clamp(uv * vec2(sz) - 0.5, vec2(0.0), vec2(sz) - 1.0);",
        "  vec2 p0 = floor(p);",
        "  vec2 t = p - p0;",
        "  ivec2 i0 = ivec2(p0);",
        "  if (m == 1) {",
        "    float a = mix(ps_gfetch(i0, sz), ps_gfetch(i0 + ivec2(1, 0), sz), t.x);",
        "    float b = mix(ps_gfetch(i0 + ivec2(0, 1), sz), ps_gfetch(i0 + ivec2(1, 1), sz), t.x);",
        "    return mix(a, b, t.y) * u_ground.y;",
        "  }",
        "  vec2 t2 = t * t;",
        "  vec2 t3 = t2 * t;",
        "  vec4 wx = vec4(-0.5 * t3.x + t2.x - 0.5 * t.x, 1.5 * t3.x - 2.5 * t2.x + 1.0, -1.5 * t3.x + 2.0 * t2.x + 0.5 * t.x, 0.5 * t3.x - 0.5 * t2.x);",
        "  vec4 wy = vec4(-0.5 * t3.y + t2.y - 0.5 * t.y, 1.5 * t3.y - 2.5 * t2.y + 1.0, -1.5 * t3.y + 2.0 * t2.y + 0.5 * t.y, 0.5 * t3.y - 0.5 * t2.y);",
        "  float h = 0.0;",
        "  for (int j = 0; j < 4; j++) {",
        "    float rh = 0.0;",
        "    for (int i = 0; i < 4; i++) rh += wx[i] * ps_gfetch(i0 + ivec2(i - 1, j - 1), sz);",
        "    h += wy[j] * rh;",
        "  }",
        "  return h * u_ground.y;",
        "}",
        "bool ps_advance(inout vec3 pos, inout vec3 vel, inout float age, inout float rot, float spin, float life, float prnd, float sc, float h) {",
        "  vec3 acc = vec3(P(PE_grav_x), P(PE_grav_y), P(PE_grav_z));",
        "  float turb = P(PE_turb);",
        "  if (turb > 0.0) acc += ps_noise(pos * P(PE_turb_scale), u_time * P(PE_turb_speed) + prnd * 6.28) * turb;",
        "  float drag = P(PE_drag);",
        "  vec3 wind = vec3(P(PE_wind_x), P(PE_wind_y), P(PE_wind_z));",
        "  vel = (vel + (acc + drag * wind) * h) / (1.0 + drag * h);",
        "  pos += vel * h;",
        "  age += h;",
        "  rot += spin * h;",
        "  if (age >= life) return false;",
        "  int mode = int(P(PE_collide) + 0.5);",
        "  if (mode != 0) {",
        "    float gy = -1.0e30;",
        "    if (P(PE_ground_mode) > 0.5) gy = P(PE_ground_y);",
        "    else if (u_ground.z > 0.5) gy = ps_ground_at(pos.xz);",
        "    float r = 0.5 * P(PE_radius) * ps_size_at(age / life, prnd, sc);",
        "    if (pos.y - r < gy) {",
        "      if (mode == 1) return false;",
        "      pos.y = gy + r;",
        "      float keep = 1.0 - clamp(P(PE_friction), 0.0, 1.0);",
        "      if (mode == 2 && vel.y < 0.0) {",
        "        vel.y = -vel.y * P(PE_bounce);",
        "        vel.xz *= keep;",
        "        if (vel.y < 0.15) vel.y = 0.0;",
        "      } else if (mode == 3 || vel.y < 0.0) {",
        "        if (vel.y < 0.0) vel.y = 0.0;",
        "        vel.xz *= keep;",
        "      }",
        "    }",
        "  }",
        "  return true;",
        "}",
        "void main() {",
        "  if (u_mode == 0) {",
        "    ps_eid = int(i2.w + 0.5);",
        "    if (i1.w <= 0.0 || i0.w >= i1.w || !ps_exists()) { o0 = i0; o1 = vec4(i1.xyz, 0.0); o2 = i2; o3 = i3; return; }",
        "    vec3 pos = i0.xyz; vec3 vel = i1.xyz; float age = i0.w; float rot = i2.x;",
        "    bool alive = ps_advance(pos, vel, age, rot, i2.y, i1.w, i2.z, i3.x, u_dt);",
        "    o0 = vec4(pos, age); o1 = vec4(vel, alive ? i1.w : 0.0); o2 = vec4(rot, i2.y, i2.z, i2.w); o3 = i3;",
        "    return;",
        "  }",
        "  int k = gl_VertexID;",
        "  int lo = 0;",
        "  int hi = u_nbatch - 1;",
        "  for (int it = 0; it < 11; it++) {",
        "    if (lo >= hi) break;",
        "    int mid = (lo + hi + 1) >> 1;",
        "    if (int(texelFetch(u_batch, ivec2(4, mid), 0).x) <= k) lo = mid; else hi = mid - 1;",
        "  }",
        "  vec4 t0 = texelFetch(u_batch, ivec2(0, lo), 0);",
        "  vec4 t1 = texelFetch(u_batch, ivec2(1, lo), 0);",
        "  vec4 t2 = texelFetch(u_batch, ivec2(2, lo), 0);",
        "  vec4 t3 = texelFetch(u_batch, ivec2(3, lo), 0);",
        "  vec4 tq = texelFetch(u_batch, ivec2(5, lo), 0);",
        "  int j = k - int(texelFetch(u_batch, ivec2(4, lo), 0).x);",
        "  ps_eid = int(t3.w + 0.5);",
        "  g_h = pcg(uint(k) ^ pcg(u_seed));",
        "  float tt = clamp(t0.w + float(j) * t1.w, 0.0, u_dt);",
        "  float u = u_dt > 0.0 ? tt / u_dt : 1.0;",
        "  vec3 org = mix(t0.xyz, t1.xyz, u);",
        "  float sc = t2.w;",
        "  int shape = int(P(PE_shape) + 0.5);",
        "  if (shape == 1) {",
        "    float z = rnd() * 2.0 - 1.0; float a = rnd() * 6.2831853; float rr = sqrt(max(1.0 - z * z, 0.0));",
        "    float rad = P(PE_shell) > 0.5 ? 1.0 : pow(rnd(), 1.0 / 3.0);",
        "    org += ps_qrot(tq, vec3(rr * cos(a), z, rr * sin(a)) * rad * P(PE_ext_x) * sc);",
        "  } else if (shape == 2) {",
        "    org += ps_qrot(tq, vec3(rnd() * 2.0 - 1.0, rnd() * 2.0 - 1.0, rnd() * 2.0 - 1.0) * vec3(P(PE_ext_x), P(PE_ext_y), P(PE_ext_z)) * sc);",
        "  } else if (shape == 3) {",
        "    float a = rnd() * 6.2831853; float rad = (P(PE_shell) > 0.5 ? 1.0 : sqrt(rnd())) * P(PE_ext_x) * sc;",
        "    org += ps_qrot(tq, vec3(cos(a) * rad, 0.0, sin(a) * rad));",
        "  }",
        "  vec3 dir = vec3(P(PE_dir_x), P(PE_dir_y), P(PE_dir_z));",
        "  float dl = length(dir);",
        "  dir = dl < 1.0e-6 ? vec3(0.0, 1.0, 0.0) : dir / dl;",
        "  float cmin = cos(min(P(PE_spread), 3.14159265));",
        "  float cz = 1.0 - rnd() * (1.0 - cmin);",
        "  float sz = sqrt(max(1.0 - cz * cz, 0.0));",
        "  float ph = rnd() * 6.2831853;",
        "  vec3 side = abs(dir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);",
        "  vec3 ax = normalize(cross(side, dir));",
        "  vec3 ay = cross(dir, ax);",
        "  vec3 cone = ps_qrot(tq, ax * (sz * cos(ph)) + ay * (sz * sin(ph)) + dir * cz);",
        "  float speed = mix(P(PE_speed0), P(PE_speed1), rnd());",
        "  vec3 vel = (cone * speed + t2.xyz * P(PE_inherit)) * sc + t3.xyz;",
        "  float life = max(mix(P(PE_life0), P(PE_life1), rnd()), 0.001);",
        "  float rot = mix(P(PE_rot0), P(PE_rot1), rnd());",
        "  float spin = mix(P(PE_spin0), P(PE_spin1), rnd());",
        "  float prnd = rnd();",
        "  float age = 0.0;",
        "  bool alive = true;",
        "  float ahead = u_dt - tt;",
        "  if (ahead > 0.0) alive = ps_advance(org, vel, age, rot, spin, life, prnd, sc, ahead);",
        "  o0 = vec4(org, age); o1 = vec4(vel, alive ? life : 0.0); o2 = vec4(rot, spin, prnd, float(ps_eid));",
        "  o3 = vec4(sc, 0.0, 0.0, 0.0);",
        "}"
      ].join("\n");

      function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          const log = gl.getShaderInfoLog(s);
          gl.deleteShader(s);
          fail("shader error: " + log);
        }
        return s;
      }

      // ---- the shared GPU resources (made when the first system is) -----------------------------------------------------------------------------------------
      let R = null;
      function resources() {
        if (R) return R;
        R = {};
        const vs = compile(gl.VERTEX_SHADER, GLSL_UPDATE);
        const fs = compile(gl.FRAGMENT_SHADER, "#version 300 es\nprecision highp float;\nout vec4 c;\nvoid main(){ c = vec4(0.0); }");
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.transformFeedbackVaryings(prog, ["o0", "o1", "o2", "o3"], gl.INTERLEAVED_ATTRIBS);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) fail("link error: " + gl.getProgramInfoLog(prog));
        gl.deleteShader(vs); gl.deleteShader(fs);
        R.prog = prog;
        R.u = {};
        ["u_mode", "u_dt", "u_time", "u_seed", "u_nbatch", "u_batch", "u_ground_tex", "u_ground", "u_ground_origin", "ps_params"].forEach(function (n) { R.u[n] = gl.getUniformLocation(prog, n); });
        R.tf = gl.createTransformFeedback();
        R.empty_vao = gl.createVertexArray();
        function float_texture(w, h, nearest) {
          const t = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
          gl.bindTexture(gl.TEXTURE_2D, null);
          return t;
        }
        R.params_tex = float_texture(ROW_TEXELS, MAX_EMITTERS, true);
        R.batch_tex = float_texture(8, MAX_BATCH, true);
        R.dummy_ground = float_texture(1, 1, true);
        R.params_data = new Float32Array(MAX_EMITTERS * ROW);
        R.batch_data = new Float32Array(MAX_BATCH * 32);
        R.dirty = new Uint8Array(MAX_EMITTERS);
        R.dirty_any = false;
        // the params texture as the engine's materials see it (they only read target and gl_texture)
        R.params_obj = { target: gl.TEXTURE_2D, gl_texture: R.params_tex, update_source: false, uuid: engine.guid() };
        return R;
      }

      // ---- emitters --------------------------------------------------------------------------------------------------------------------------------------
      const emitters = new Array(MAX_EMITTERS);
      const free_ids = [];                                        // ids that can be taken at once
      const quarantine = [];                                      // { id, at }: a disposed emitter's id waits until its particles are certainly gone
      let next_id = 0;
      const systems = [];
      let clock_now = 0;                                          // the sum of the frame times (seconds): the clock of the quarantine

      function alloc_id() {
        while (quarantine.length && quarantine[0].at <= clock_now) free_ids.push(quarantine.shift().id);
        if (free_ids.length) return free_ids.pop();
        if (next_id < MAX_EMITTERS) return next_id++;
        fail("at most " + MAX_EMITTERS + " emitters (a disposed emitter's place is free again once its particles are gone)");
      }

      function Emitter(sys, name, def) {
        const r = resources();
        this.id = alloc_id();
        this.system = sys; this.name = name; this.disposed = false;
        this.row = r.params_data.subarray(this.id * ROW, this.id * ROW + ROW);
        this.row.fill(0);
        this.params = this.row.subarray(0, NP);                   // write it and call touch() for changes without garbage
        this.pos = new Float32Array(3); this.prev = new Float32Array(3); this.vel = new Float32Array(3);
        this.moved = false; this.has_prev = false; this.jump = false; this.active = true; this.acc = 0; this.qcarry = 0;
        this.q = new Float32Array([0, 0, 0, 1]); this.model = null; this.parent_model = null; this.pending = false; this.max_jump = 100;          // q: the world rotation of an attached emitter (the shader turns the births with it)
        try { fill(this.params, def || {}, sys, true); } catch (e) { free_ids.push(this.id); throw e; }
        this.row[NP] = 1;
        emitters[this.id] = this;
        r.dirty[this.id] = 1; r.dirty_any = true;
        this.life_max = Math.max(this.params[P.life0], this.params[P.life1]);
      }
      Emitter.prototype.touch = function () { const r = resources(); r.dirty[this.id] = 1; r.dirty_any = true; this.life_max = Math.max(this.params[P.life0], this.params[P.life1]); return this; };
      Emitter.prototype.set = function (def) { fill(this.params, def, this.system, false); return this.touch(); };
      // every frame for an emitter that moves: the births of the frame lie along the way from last frame's place (a continuous trail at any frame rate). q: [x, y, z, w], optional: its orientation from now on
      // (see orient; one orientation per frame: the births of a frame all take this one)
      Emitter.prototype.at = function (x, y, z, q) {
        this.pos[0] = x; this.pos[1] = y; this.pos[2] = z;
        if (!this.has_prev) { this.prev[0] = x; this.prev[1] = y; this.prev[2] = z; this.has_prev = true; this.moved = false; } else this.moved = true;
        if (q) this.orient(q);
        return this;
      };
      // a jump: no trail from where it was
      Emitter.prototype.teleport = function (x, y, z, q) {
        this.pos[0] = x; this.pos[1] = y; this.pos[2] = z; this.prev[0] = x; this.prev[1] = y; this.prev[2] = z;
        this.has_prev = true; this.moved = false;
        if (q) this.orient(q);
        return this;
      };
      Emitter.prototype.start = function () { this.active = true; return this; };
      Emitter.prototype.stop = function () { this.active = false; this.acc = 0; return this; };
      // n particles at once from (x, y, z) (the emitter's own position by default), (vx, vy, vz) added to what the emitter gives them, `scale` makes them bigger and faster (an elephant's dust)
      Emitter.prototype.burst = function (count, x, y, z, vx, vy, vz, scale) {
        if (this.disposed) return false;
        const sys = this.system;
        count = count > 0 ? Math.floor(count) : 0;
        if (count === 0) return true;
        if (sys.nbursts >= MAX_BURSTS) { gp.stats.dropped += count; sys.dropped += count; return false; }
        const b = sys.bursts, o = sys.nbursts++ * 12;
        b[o] = this.id; b[o + 1] = count;
        b[o + 2] = x === undefined ? this.pos[0] : x; b[o + 3] = y === undefined ? this.pos[1] : y; b[o + 4] = z === undefined ? this.pos[2] : z;
        b[o + 5] = vx || 0; b[o + 6] = vy || 0; b[o + 7] = vz || 0; b[o + 8] = scale === undefined ? 1 : scale;
        return true;
      };
      Emitter.prototype.dispose = function () {
        if (this.disposed) return;
        this.disposed = true;
        const r = resources(), sys = this.system;
        this.detach();
        this.row[NP] = 0;                                         // its particles die at the next pass
        r.dirty[this.id] = 1; r.dirty_any = true;
        emitters[this.id] = undefined;
        quarantine.push({ id: this.id, at: clock_now + sys.life_cap + 0.25 });
        const k = sys.emitters.indexOf(this);
        if (k >= 0) sys.emitters.splice(k, 1);
      };
      gp.Emitter = Emitter;
      gp.emitters_used = function () { let n = 0; for (let i = 0; i < MAX_EMITTERS; i++) if (emitters[i]) n++; return n; };
      Object.defineProperty(Emitter.prototype, "rate", { get: function () { return this.params[P.rate]; }, set: function (v) { this.params[P.rate] = v; this.touch(); } });

      // ---- the draw: one instanced quad per slot ------------------------------------------------------------------------------------------------------------
      const QUAD = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), QUAD_INDICES = new Uint32Array([0, 1, 2, 0, 2, 3]);

      // The engine cuts a shader at the end of vertex(): what is before it is the vertex shader's, what is after it the fragment shader's
      // (caster: the variant drawn into the sun's shadow maps: the dither shape, whatever the system's blend, with a coverage test of its own in has_discard and the real camera for the distance limits)
      function draw_shader(sys, soft, caster) {
        const tex = !!sys.texture, blend = caster ? "dither" : sys.blend, sheet = sys.sheet[0] * sys.sheet[1] > 1, recv = soft && !caster && sys.blend === "alpha" && receives();
        const edge = (1 - Math.max(0.02, Math.min(1, sys.soft))).toFixed(3);
        const lines = [
          GLSL_COMMON,
          "uniform mat4 u_inverse_view_matrix;",
          "uniform vec4 ps_cfg;",
          "uniform vec4 ps_q;",
          "attribute vec4 a_ps0;",
          "attribute vec4 a_ps1;",
          "attribute vec4 a_ps2;",
          "attribute vec4 a_ps3;",
          "varying float v_ps_depth;",
          "varying float v_ps_radius;",
          "varying vec2 v_ps_q;"
        ];
        if (caster) lines.push("uniform vec3 ps_cull;", "uniform vec4 ps_shadow;");          // (in a shadow pass u_camera_position is the sun's camera: the limits are measured from the one the player sees through)
        if (soft) {
          // the lighting pass (deffered_rendering_v2.js) hazes what it lights; these particles are drawn after it, so they do the same for themselves: ONE GetAtmosphere per particle (its centre), here in the
          // vertex shader, with the pass's own sliders (FL: the same names are the same slots) and distance scale. v_ps_t dims the particle (the air in front of it), v_ps_s is the air's own light, both in the
          // screen's colours (tonemapped, gamma). ps_air.x is 0 when the pass has no atmosphere or the system turned it off
          lines.push(
            "#ifndef PI",
            "#define PI 3.14159265358",
            "#endif",
            engine.shaders_cat.atmosphere(),
            "struct Light { vec3 direction; vec3 color; float illuminated; float attenuation; };",
            "uniform Light directional_lights[2];",
            "uniform float u_float_params[24];",                    // (what FL() reads: the pass sliders)
            "uniform vec4 ps_air;",
            "uniform vec3 ps_moon;",
            "varying vec3 v_ps_t;",
            "varying vec3 v_ps_s;",
            "void ps_air_vertex(vec3 pc) {",
            "  v_ps_t = vec3(1.0); v_ps_s = vec3(0.0);",
            "  if (ps_air.x <= 0.0) return;",
            "  AERIAL_SCALE = FL(\"AERIAL_SCALE\",0.8,0.1,5.0,0.1);",
            "  EXPOSURE = FL(\"EXPOSURE\",32.0,1.0,64.0,0.25);",
            "  DENSITY = FL(\"DENSITY\",2.0,1.0,16.0,0.1);",
            "  vec3 ro = u_camera_position;",
            "  vec3 d = pc - ro;",
            "  float dist = length(d);",
            "  if (dist < 0.001) return;",
            "  vec3 rd = d / dist;",
            "  vec4 clip = u_view_projection_matrix * vec4(pc, 1.0);",
            "  float zn = ps_air.y > 0.5 ? log2(max(0.00001, clip.w + 2.0)) * u_camera_bounds[2] - 1.0 : clip.z / max(clip.w, 0.00001);",
            "  float world_scale = smoothstep(0.5, FL(\"foq_unit\",1.0,0.1,4.0,0.1), zn * 0.5 + 0.5) * 5.0 + 1.0;",
            "  vec3 sun_dir = normalize(directional_lights[0].direction);",
            "  vec3 sun_rad = directional_lights[0].color * directional_lights[0].illuminated * directional_lights[0].attenuation;",
            "  vec3 moon_dir = normalize(ps_moon);",
            "  vec3 moon_rad = vec3(0.01) * (dot(sun_dir, -moon_dir) * 0.5 + 0.5);",
            "  sun_rad *= mix(1.0, 1.0 - smoothstep(0.99985, 1.0, dot(sun_dir, moon_dir)), 0.999);",
            "  vec4 ts; vec4 tm;",
            "  vec3 s = GetAtmosphere(ro, rd, dist * world_scale, sun_dir, sun_rad, ts) + GetAtmosphere(ro, rd, dist * world_scale, moon_dir, moon_rad, tm);",
            "  v_ps_t = mix(vec3(1.0), pow(ts.xyz, vec3(1.0 / 2.2)), ps_air.x);",
            "  v_ps_s = pow(TonemapACES(max(s, vec3(0.0))), vec3(1.0 / 2.2)) * ps_air.x;",
            "}"
          );
        }
        if (recv) {
          // (the lighting pass's own maps and matrices, by the distance to the camera; a point that is outside a cascade or past the last one is in the sun. The bias is in the pass's units: texels of the cascade)
          lines.push(
            "precision highp sampler2DShadow;",
            "uniform sampler2DShadow ps_sm0;",
            "uniform sampler2DShadow ps_sm1;",
            "uniform sampler2DShadow ps_sm2;",
            "uniform mat4 ps_sm_m0;",
            "uniform mat4 ps_sm_m1;",
            "uniform mat4 ps_sm_m2;",
            "uniform vec3 ps_sm_split;",
            "uniform vec3 ps_sm_texel;",
            "uniform vec3 ps_sm_scale;",
            "uniform vec4 ps_recv;",                                 // (x: how much of the shadow it takes, y: what is left of the colour in the full shadow, z: how far toward the sun, in sizes, it looks: a system that casts itself must not shade itself)
            "float ps_sm_tap(sampler2DShadow m, mat4 vp, float texel, float scale, vec3 p) {",
            "  vec4 l = vp * vec4(p, 1.0);",
            "  vec3 c = l.xyz / l.w * 0.5 + 0.5;",
            "  if (c.z > 1.0 || c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0) return 1.0;",
            "  return texture(m, vec3(c.xy, c.z - texel * 3.0 * scale));",
            "}",
            "float ps_sun_lit(vec3 p) {",
            "  float d = length(p - u_camera_position);",
            "  if (d < ps_sm_split.x) return ps_sm_tap(ps_sm0, ps_sm_m0, ps_sm_texel.x, ps_sm_scale.x, p);",
            "  if (d < ps_sm_split.y) return ps_sm_tap(ps_sm1, ps_sm_m1, ps_sm_texel.y, ps_sm_scale.y, p);",
            "  if (d < ps_sm_split.z) return mix(ps_sm_tap(ps_sm2, ps_sm_m2, ps_sm_texel.z, ps_sm_scale.z, p), 1.0, smoothstep(ps_sm_split.z * 0.9, ps_sm_split.z, d));",
            "  return 1.0;",
            "}"
          );
        }
        lines.push(
          "void vertex(void) {",
          "  float age = a_ps0.w;",
          "  float life = a_ps1.w;",
          "  ps_eid = int(a_ps2.w + 0.5);",
          "  float md = 0.0;",
          "  bool dead = life <= 0.0 || age >= life;",
          // (a shadow map is low quality on purpose: only the share ps_shadow.y of the slots is drawn, a fixed set (a hash of the slot, so a particle never flickers in and out), each bigger by ps_shadow.w to make up for the others)
          caster ? "  if (!dead) { dead = fract(float(gl_InstanceID) * 0.6180339) >= ps_shadow.y; }" : "",
          "  if (!dead) { dead = !ps_exists(); }",
          "  if (!dead) {",
          "    float dc = distance(a_ps0.xyz, " + (caster ? "ps_cull" : "u_camera_position") + ");",
          "    md = P(PE_max_dist) * ps_q.x;",
          "    if ((md > 0.0 && dc > md) || (ps_q.z > 0.0 && dc > ps_q.z)) dead = true;",
          "  }",
          "  if (dead) {",
          "    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);",
          "    v_color = vec4(0.0); v_uv = vec2(0.0); v_position_world = vec3(0.0); v_ps_depth = 1.0; v_ps_radius = 0.0; v_ps_q = vec2(0.0);" + (soft ? " v_ps_t = vec3(1.0); v_ps_s = vec3(0.0);" : ""),
          "    return;",
          "  }",
          "  float t = age / life;",
          "  float size = ps_size_at(t, a_ps2.z, a_ps3.x);",
          caster ? "  size *= ps_shadow.w;" : "",
          // (a particle smaller than ps_shadow.z metres (rain, sparks) is under a shadow texel: it adds noise and no shade)
          caster ? "  if (size < ps_shadow.z) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); v_color = vec4(0.0); v_uv = vec2(0.0); v_position_world = vec3(0.0); v_ps_depth = 1.0; v_ps_radius = 0.0; v_ps_q = vec2(0.0); return; }" : "",
          "  vec4 col = ps_gradient(t);",
          "  col.a *= ps_smooth(0.0, P(PE_fade_in), t) * (1.0 - ps_smooth(1.0 - P(PE_fade_out), 1.0, t));",
          "  vec3 right = vec3(u_inverse_view_matrix[0][0], u_inverse_view_matrix[1][0], u_inverse_view_matrix[2][0]);",
          "  vec3 up = vec3(u_inverse_view_matrix[0][1], u_inverse_view_matrix[1][1], u_inverse_view_matrix[2][1]);",
          "  vec2 c = a_position.xy;",
          "  vec2 q;",
          "  float stretch = P(PE_stretch);",
          "  vec2 vs = vec2(dot(a_ps1.xyz, right), dot(a_ps1.xyz, up));",
          "  float sp = length(vs);",
          "  if (stretch > 0.0 && sp > 0.0001) {",
          "    vec2 d = vs / sp;",
          "    vec2 n = vec2(d.y, -d.x);",
          "    q = d * (c.y * (size + sp * stretch)) + n * (c.x * size);",
          "  } else {",
          "    float s = sin(a_ps2.x); float co = cos(a_ps2.x);",
          "    q = vec2(c.x * co - c.y * s, c.x * s + c.y * co) * size;",
          "  }",
          "  v_position_world = a_ps0.xyz + right * q.x + up * q.y;",
          "  gl_Position = u_view_projection_matrix * vec4(v_position_world, 1.0);",
          "  v_ps_depth = gl_Position.w;",
          "  v_ps_radius = size * 0.5;",
          "  v_ps_q = c * 2.0;",
          "  v_color = col;",
          soft ? "  ps_air_vertex(a_ps0.xyz);" : "",
          // (the corners' values are interpolated: a puff on a shadow's edge is half dim; a puff that casts a shadow itself looks toward the sun by its own size, so it does not shade itself)
          recv ? "  v_ps_t *= mix(1.0, mix(ps_recv.y, 1.0, ps_sun_lit(v_position_world + normalize(directional_lights[0].direction) * (size * ps_recv.z + 0.05))), ps_recv.x);" : "",
          "  vec2 uv = c + 0.5;"
        );
        if (sheet) {
          lines.push(
            "  float cols = ps_cfg.x; float rows = ps_cfg.y; float frames = cols * rows;",
            "  float fps = P(PE_flip_fps);",
            "  float frame = fps > 0.0 ? floor(mod(age * fps, frames)) : floor(t * frames);",
            "  frame = min(frame, frames - 1.0);",
            "  uv = (vec2(mod(frame, cols), rows - 1.0 - floor(frame / cols)) + uv) / vec2(cols, rows);"
          );
        }
        lines.push("  v_uv = uv;", "}");
        // ---- the fragment shader's part
        lines.push(
          "precision highp sampler2D;",
          "uniform vec4 ps_cfg;",
          "uniform vec4 ps_q;",
          "uniform vec4 ps_shadow;",
          "uniform vec2 u_render_size;",
          "varying float v_ps_depth;",
          "varying float v_ps_radius;",
          "varying vec2 v_ps_q;"
        );
        if (tex) lines.push("uniform sampler2D ps_tex;");
        if (soft) lines.push("uniform sampler2D ps_scene;", "uniform mat4 u_view_projection_matrix;", "varying vec3 v_ps_t;", "varying vec3 v_ps_s;");
        lines.push("float ps_ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }");
        if (blend === "dither") {
          if (sys.diffuse) lines.push("#define DIFFUSE_SURFACE");
          // (has_discard is the shadow pass's hook: the caster variant keeps a pixel with the odds of its opacity, times ps_shadow.x, with the soft disc for a shape (no texture fetch: a shadow map is low quality on purpose); every other variant casts nothing)
          lines.push("#define HAS_DISCARD", "void has_discard() {", caster ? "  if (v_color.a * ps_shadow.x * (1.0 - smoothstep(" + edge + ", 1.0, sqrt(dot(v_ps_q, v_ps_q)))) < ps_ign(gl_FragCoord.xy)) discard;" : "  discard;", "}");
        }
        lines.push("void fragment() {", "  vec4 c = v_color;", "  float r2 = dot(v_ps_q, v_ps_q);");
        lines.push(tex ? "  c *= texture2D(ps_tex, v_uv);" : "  c.a *= 1.0 - smoothstep(" + edge + ", 1.0, sqrt(r2));");
        if (soft) {
          lines.push(
            "  vec4 sp = texture(ps_scene, gl_FragCoord.xy / (u_render_size * ps_q.y));",
            "  float scene_w = dot(sp.xyz, sp.xyz) > 1.0e-6 ? (u_view_projection_matrix * vec4(sp.xyz, 1.0)).w : 1.0e30;",
            "  float front = v_ps_depth - v_ps_radius * sqrt(max(1.0 - r2, 0.0));",
            "  c.a *= clamp((scene_w - front) * ps_cfg.z, 0.0, 1.0);",
            "  c.a *= clamp((v_ps_depth - 0.1) * 4.0, 0.0, 1.0);"
          );
        }
        // (the air in front of a soft particle dims it; only an alpha particle also takes the air's own light, joined by a screen blend 1 - (1 - a)(1 - b) in the screen's own colours: it never goes above the particle or the haze. An added one is light, it does not cover what is behind it)
        const air_t = soft ? "v_ps_t" : "vec3(1.0)", air_s = soft ? "v_ps_s" : "vec3(0.0)";
        if (blend === "add") lines.push("  if (c.a < 0.002) discard;", "  gl_FragColor = vec4(c.rgb * ps_cfg.w * " + air_t + " * c.a, 0.0);");
        else if (blend === "alpha") lines.push("  if (c.a < 0.002) discard;", "  vec3 lit = vec3(1.0) - (vec3(1.0) - clamp(c.rgb * ps_cfg.w * " + air_t + ", 0.0, 1.0)) * (vec3(1.0) - " + air_s + ");", "  gl_FragColor = vec4(lit * c.a, c.a);");
        else lines.push("  if (c.a < ps_ign(gl_FragCoord.xy)) discard;", "  gl_FragColor = vec4(c.rgb, 1.0);");
        lines.push("}");
        return lines.join("\n");
      }

      function make_material(sys, soft, caster) {
        const state = { cullFace: null };
        // (the soft pass is the LAST draw of a frame and has no depth test, so it must not leave the depth mask off: the next frame's depth clear would do nothing and nothing would pass its depth test)
        if (!caster && sys.blend === "alpha") { state.blend = { func: [gl.ONE, gl.ONE_MINUS_SRC_ALPHA] }; if (!soft) state.depthMask = false; }
        else if (!caster && sys.blend === "add") { state.blend = { func: [gl.ONE, gl.ONE] }; if (!soft) state.depthMask = false; }
        if (soft) state.depthFunc = null;                         // drawn after the lighting pass, to the screen: no depth buffer to test, the G-buffer's positions are the test
        const uniforms = { ps_params: resources().params_obj, ps_cfg: sys.cfg, ps_shadow: sys.shadow };
        if (soft) { uniforms.ps_air = sys.air; uniforms.ps_recv = sys.recv; }
        if (sys.texture) uniforms.ps_tex = sys.texture;
        return engine.materials.create({ props: { enable_vertex_color: true }, uniforms: uniforms, shader: draw_shader(sys, soft, caster), state: state });
      }

      // ---- a system --------------------------------------------------------------------------------------------------------------------------------------
      gp.create = function (opts) {
        opts = opts || {};
        const r = resources();
        for (let i = systems.length - 1; i >= 0; i--) if (systems[i].disposed) systems.splice(i, 1);          // (the ids are the places in the list: a system made after a dispose takes the free one)
        if (systems.length >= MAX_SYSTEMS) fail("at most " + MAX_SYSTEMS + " systems");
        let sid = 0;
        while (systems.some(function (s) { return s.id === sid; })) sid++;
        const cap = Math.max(1, Math.min(MAX_CAPACITY, (opts.capacity === undefined ? 16384 : opts.capacity) | 0));
        const blend = opts.blend || "add";
        if (blend !== "dither" && blend !== "alpha" && blend !== "add") fail("blend is dither, alpha or add");
        const sheet = opts.sheet || [1, 1];
        const sys = {
          id: sid, capacity: cap, blend: blend, sheet: sheet, texture: opts.texture || null, soft: opts.soft === undefined ? 0.5 : opts.soft,
          depth_fade: opts.depth_fade === undefined ? 0.5 : opts.depth_fade, intensity: opts.intensity === undefined ? 1 : opts.intensity,
          atmosphere: opts.atmosphere === undefined ? 1 : Math.max(0, Math.min(1, +opts.atmosphere)), air: new Float32Array(4),
          cast_shadow: !!opts.cast_shadow, shadow_density: opts.shadow_density === undefined ? 1 : Math.max(0, +opts.shadow_density), diffuse: !!opts.diffuse,
          receive_shadow: opts.receive_shadow === undefined ? 1 : Math.max(0, Math.min(1, +opts.receive_shadow)), recv_built: false, recv: new Float32Array(4),
          emitters: [], disposed: false, len: 0, cur: 0, clock: 0, frame: 0, life_cap: 0, dropped: 0, births: 0,
          q_expire: new Float64Array(QUEUE), q_count: new Int32Array(QUEUE), q_head: 0, q_n: 0,
          bursts: new Float32Array(MAX_BURSTS * 12), nbursts: 0,
          cfg: new Float32Array([sheet[0], sheet[1], 1, 1]), shadow: new Float32Array(4), mats: [null, null, null]
        };
        sys.buf = [gl.createBuffer(), gl.createBuffer()];
        for (let i = 0; i < 2; i++) { gl.bindBuffer(gl.ARRAY_BUFFER, sys.buf[i]); gl.bufferData(gl.ARRAY_BUFFER, cap * STRIDE, gl.DYNAMIC_COPY); }
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        sys.vao = [gl.createVertexArray(), gl.createVertexArray()];
        for (let i = 0; i < 2; i++) { gl.bindVertexArray(sys.vao[i]); for (let a = 0; a < 4; a++) gl.enableVertexAttribArray(a); }
        gl.bindVertexArray(null);
        sys.geo = [0, 1].map(function (i) {
          const attr = function (off) { return { item_size: 4, divisor: 1, stride: STRIDE, offset: off, buffer_type: gl.DYNAMIC_DRAW }; };
          const g = engine.geometries.create({ attributes: { a_position: { item_size: 3, data: QUAD }, a_ps0: attr(0), a_ps1: attr(16), a_ps2: attr(32), a_ps3: attr(48) }, indices: QUAD_INDICES });
          ["a_ps0", "a_ps1", "a_ps2", "a_ps3"].forEach(function (n) { engine._attributes.get(g.attr[n]).buffer = sys.buf[i]; });
          return g;
        });
        systems.push(sys);
        if (!gp.hooked_frame) { gp.hooked_frame = true; engine.on_frame_begin.add(function (time, dt) { if (!gp.manual) gp.frame(dt); }); }

        sys.emitter = function (name, def) { const e = new Emitter(sys, name, def); sys.emitters.push(e); sys.life_cap = Math.max(sys.life_cap, e.life_max); return e; };
        sys.clear = function () { sys.len = 0; sys.q_n = 0; sys.q_head = 0; sys.nbursts = 0; };
        sys.soft_now = function () { return !!gp.screen && sys.blend !== "dither"; };
        sys.material = function () {
          const s = sys.soft_now() ? 1 : 0;
          sys.cfg[2] = sys.depth_fade > 0 && quality.soft ? 1 / sys.depth_fade : 1.0e6;          // (quality.soft off: a hard cut at the surface, the fade costs nothing but looks like a cut)
          sys.cfg[3] = sys.intensity;
          const scr = gp.screen;                                  // (the air: only a pass that has an atmosphere has one to dim and tint the particles with)
          sys.air[0] = gp.atmosphere && scr && scr.atmosphere ? sys.atmosphere : 0; sys.air[1] = scr && scr.logdepth ? 1 : 0;
          sys.recv[0] = sys.receive_shadow; sys.recv[1] = Math.max(0, Math.min(1, +gp.shadow_receive_min)); sys.recv[2] = sys.cast_shadow ? 0.6 : 0;
          if (s === 1 && sys.mats[1] && sys.recv_built !== receives()) sys.mats[1] = null;          // (the pass changed, or shadows were switched: the shader has the shadow lookup or it does not)
          if (!sys.mats[s]) { sys.mats[s] = make_material(sys, s === 1); if (s === 1) sys.recv_built = receives(); }
          return sys.mats[s];
        };
        sys.render = function () {
          if (sys.disposed || sys.len <= 0) return;
          engine.render_item(sys.geo[sys.cur], sys.material(), 0, 0, sys.len);
        };
        // into a sun shadow map (gp.render_shadow calls it): `cast_shadow` is read now, so it can be switched at any time (the material is made the first time it is on)
        sys.render_shadow = function () {
          if (sys.disposed || sys.len <= 0 || !sys.cast_shadow) return;
          const detail = Math.max(0.02, Math.min(1, +gp.shadow_detail));
          sys.shadow[0] = sys.shadow_density; sys.shadow[1] = detail; sys.shadow[2] = gp.shadow_min_size; sys.shadow[3] = Math.pow(detail, -0.25);
          if (!sys.mats[2]) sys.mats[2] = make_material(sys, false, true);
          engine.render_item(sys.geo[sys.cur], sys.mats[2], 0, 0, sys.len);
        };
        sys.dispose = function () {
          if (sys.disposed) return;
          sys.emitters.slice().forEach(function (e) { e.dispose(); });
          sys.disposed = true; sys.len = 0;
          gl.deleteBuffer(sys.buf[0]); gl.deleteBuffer(sys.buf[1]);
          gl.deleteVertexArray(sys.vao[0]); gl.deleteVertexArray(sys.vao[1]);
        };
        // the live window as numbers (tests, tools): the slots 0 .. len - 1 of the current buffer, 16 floats each: x y z age | vx vy vz life | rot spin random emitter | scale
        sys.read = function () {
          const out = new Float32Array(sys.len * REC);
          if (sys.len > 0) { gl.bindBuffer(gl.ARRAY_BUFFER, sys.buf[sys.cur]); gl.getBufferSubData(gl.ARRAY_BUFFER, 0, out); gl.bindBuffer(gl.ARRAY_BUFFER, null); }
          return out;
        };
        return sys;
      };

      // ---- the frame --------------------------------------------------------------------------------------------------------------------------------------
      let seed_base = 0x1234567;
      gp.seed = function (n) { seed_base = n >>> 0; };
      let nb = 0, births = 0, batch_life = 0;                     // the batches being made for one system
      function push_batch(bd, eid, count, p0x, p0y, p0z, tt0, p1x, p1y, p1z, step, evx, evy, evz, sc, xvx, xvy, xvz) {
        const o = nb * 32;
        bd[o] = p0x; bd[o + 1] = p0y; bd[o + 2] = p0z; bd[o + 3] = tt0;
        bd[o + 4] = p1x; bd[o + 5] = p1y; bd[o + 6] = p1z; bd[o + 7] = step;
        bd[o + 8] = evx; bd[o + 9] = evy; bd[o + 10] = evz; bd[o + 11] = sc;
        bd[o + 12] = xvx; bd[o + 13] = xvy; bd[o + 14] = xvz; bd[o + 15] = eid;
        bd[o + 16] = births; bd[o + 17] = count; bd[o + 18] = 0; bd[o + 19] = 0;
        nb++; births += count;
        const e = emitters[eid];
        if (e) { bd[o + 20] = e.q[0]; bd[o + 21] = e.q[1]; bd[o + 22] = e.q[2]; bd[o + 23] = e.q[3]; if (e.life_max > batch_life) batch_life = e.life_max; }          // (the emitter's world rotation: texel 5)
        else { bd[o + 20] = 0; bd[o + 21] = 0; bd[o + 22] = 0; bd[o + 23] = 1; }
      }

      function upload_params(r) {
        if (!r.dirty_any) return;
        r.dirty_any = false;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, r.params_tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        for (let i = 0; i < MAX_EMITTERS; i++) {
          if (!r.dirty[i]) continue;
          r.dirty[i] = 0;
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, i, ROW_TEXELS, 1, gl.RGBA, gl.FLOAT, r.params_data, i * ROW);
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
      }

      // one system, one frame: expire the oldest slots, count the newborns, run the pass
      function update_system(sys, dt, r, cam) {
        sys.clock += dt; sys.frame++;
        let drop = 0;
        while (sys.q_n > 0 && sys.q_expire[sys.q_head] <= sys.clock) {                  // the oldest births are certainly dead by now
          drop += sys.q_count[sys.q_head];
          sys.q_head = (sys.q_head + 1) % QUEUE; sys.q_n--;
        }
        if (drop > sys.len) drop = sys.len;
        const survivors = sys.len - drop;
        const free = sys.capacity - survivors;
        const bd = r.batch_data;
        nb = 0; births = 0; batch_life = 0;
        let want = 0;
        // the emitters' own velocities first (a burst inherits what its emitter moves at)
        const list = sys.emitters;
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (e.moved && dt > 0) { e.vel[0] = (e.pos[0] - e.prev[0]) / dt; e.vel[1] = (e.pos[1] - e.prev[1]) / dt; e.vel[2] = (e.pos[2] - e.prev[2]) / dt; }
          else { e.vel[0] = 0; e.vel[1] = 0; e.vel[2] = 0; }
        }
        for (let i = 0; i < list.length; i++) {
          const e = list[i], p = e.params;
          let rate = p[P.rate] * quality.count;
          if (e.active && rate > 0 && dt > 0) {
            if (p[P.lod_far] > p[P.lod_near] && p[P.lod_far] > 0) {                       // fewer births with the distance to the camera: all up to lod_near, none from lod_far (quality.lod scales both)
              const near = p[P.lod_near] * quality.lod, far = p[P.lod_far] * quality.lod;
              const dx = e.pos[0] - cam[0], dy = e.pos[1] - cam[1], dz = e.pos[2] - cam[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
              rate *= Math.max(0, Math.min(1, (far - d) / (far - near)));
            }
            const before = e.acc;
            e.acc += rate * dt;
            let n = Math.floor(e.acc);
            e.acc -= n;
            if (n > 16384) n = 16384;
            if (n > 0) {
              want += n;
              if (nb < MAX_BATCH && births < free) {
                if (n > free - births) n = free - births;
                push_batch(bd, e.id, n, e.prev[0], e.prev[1], e.prev[2], (1 - before) / rate, e.pos[0], e.pos[1], e.pos[2], 1 / rate, e.vel[0], e.vel[1], e.vel[2], 1, 0, 0, 0);
              }
            }
          }
          e.prev[0] = e.pos[0]; e.prev[1] = e.pos[1]; e.prev[2] = e.pos[2];
          e.moved = false;
        }
        for (let i = 0; i < sys.nbursts; i++) {
          const o = i * 12, b = sys.bursts, e = emitters[b[o] | 0];
          if (!e || e.disposed) continue;
          const exact = b[o + 1] * quality.count + e.qcarry;                              // (quality.count: a burst of 100 at 0.25 gives 25; what is left over is carried to the next burst)
          let n = Math.floor(exact);
          e.qcarry = exact - n;
          if (n <= 0) continue;
          want += n;
          if (nb >= MAX_BATCH || births >= free) continue;
          if (n > free - births) n = free - births;
          push_batch(bd, e.id, n, b[o + 2], b[o + 3], b[o + 4], dt, b[o + 2], b[o + 3], b[o + 4], 0, e.vel[0], e.vel[1], e.vel[2], b[o + 8], b[o + 5], b[o + 6], b[o + 7]);
        }
        sys.nbursts = 0;
        const lost = want - births;
        if (lost > 0) { sys.dropped += lost; gp.stats.dropped += lost; }
        if (births > 0) {                                                                  // when the oldest of these may be gone
          const expire = sys.clock + batch_life + 0.002;
          if (sys.q_n < QUEUE) { const t = (sys.q_head + sys.q_n) % QUEUE; sys.q_expire[t] = expire; sys.q_count[t] = births; sys.q_n++; }
          else { const t = (sys.q_head + sys.q_n - 1) % QUEUE; if (expire > sys.q_expire[t]) sys.q_expire[t] = expire; sys.q_count[t] += births; }
        }
        sys.births = births;
        if (survivors + births === 0) { sys.len = 0; return; }
        if (births > 0) {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, r.batch_tex);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 8, nb, gl.RGBA, gl.FLOAT, bd, 0);
        }
        const src = sys.cur, dst = 1 - src, u = r.u;
        gl.uniform1f(u.u_dt, dt);
        gl.uniform1f(u.u_time, sys.clock);
        gl.uniform1ui(u.u_seed, (seed_base + Math.imul(sys.id + 1, 0x9E3779B1) + Math.imul(sys.frame, 0x85EBCA6B)) >>> 0);
        gl.uniform1i(u.u_nbatch, nb);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, sys.buf[dst]);
        gl.beginTransformFeedback(gl.POINTS);
        if (survivors > 0) {
          gl.bindVertexArray(sys.vao[src]);
          gl.bindBuffer(gl.ARRAY_BUFFER, sys.buf[src]);
          const base = drop * STRIDE;
          for (let a = 0; a < 4; a++) gl.vertexAttribPointer(a, 4, gl.FLOAT, false, STRIDE, base + a * 16);
          gl.uniform1i(u.u_mode, 0);
          gl.drawArrays(gl.POINTS, 0, survivors);
        }
        if (births > 0) {
          gl.bindVertexArray(r.empty_vao);
          gl.uniform1i(u.u_mode, 1);
          gl.drawArrays(gl.POINTS, 0, births);
        }
        gl.endTransformFeedback();
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        sys.cur = dst; sys.len = survivors + births;
        gp.stats.passes++;
      }

      // ground: a heightfield the emitters with ground "terrain" collide with: { height: texture (r: 0 .. 1), size: its width in metres, scale: metres for a value of 1, origin: [x, z] of its centre,
      // filter: how the heights are joined between the texels }. size and scale are read every frame (a getter follows a world that changes). The point (x, z) is at uv = (x - origin) / size + 0.5 of the texture.
      //   filter "hardware" (default): the texture's own filter, for 8 bit textures      "bilinear": four texels joined by hand (a float texture needs no filtering extension)
      //   "bicubic": Catmull-Rom through 16 texels, the surface a game draws and collides with when it does the same (game/game8.js). Exact, and 16 fetches only for a particle that is colliding; bilinear is within about half a metre of it on the 16 m texels of that game's map
      let ground = null;
      gp.ground_version = 0;                                      // changes with set_ground: effects look at it to put their particles on the plane or on the terrain
      gp.set_ground = function (g) { ground = g || null; gp.ground_version++; };
      gp.has_ground = function () { return !!(ground && ground.height); };

      // ---- the GPU time of the update passes (opt in): a few queries in flight, the oldest that has finished is read
      let tq = null;
      function timer_begin() {
        if (!gp.timing) return false;
        if (tq === null) { const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2"); tq = ext ? { ext: ext, pool: [], pending: [], cur: null } : false; }
        if (!tq) { gp.stats.gpu_ms = -1; return false; }
        if (tq.pending.length > 6) tq.pool.push(tq.pending.shift());
        tq.cur = tq.pool.pop() || gl.createQuery();
        gl.beginQuery(tq.ext.TIME_ELAPSED_EXT, tq.cur);
        return true;
      }
      function timer_end() {
        gl.endQuery(tq.ext.TIME_ELAPSED_EXT);
        tq.pending.push(tq.cur);
        while (tq.pending.length > 1 && gl.getQueryParameter(tq.pending[0], gl.QUERY_RESULT_AVAILABLE)) {          // (the one just ended is never ready: the older ones are)
          const q = tq.pending.shift();
          if (!gl.getParameter(tq.ext.GPU_DISJOINT_EXT)) gp.stats.gpu_ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
          tq.pool.push(q);
        }
      }

      // ---- the frame, as the engine calls it: the quality follows the frame time, pause and slow motion apply
      gp.paused = false;                                          // true: the particles stand still (they are still drawn); gp.step(n) lets n frames of 1/60 s pass
      gp.time_scale = 1;                                          // 0.1 = slow motion
      let steps = 0;
      gp.step = function (n) { steps += (n === undefined ? 1 : n) | 0; };
      gp.frame = function (real_dt) {
        auto_tick(real_dt);
        if (gp.paused) { if (steps > 0) { steps--; gp.update(1 / 60); } return; }
        steps = 0;
        gp.update(real_dt * gp.time_scale);
      };
      // every particle of every system is gone (the emitters stay)
      gp.clear_all = function () { for (let i = 0; i < systems.length; i++) if (!systems[i].disposed) systems[i].clear(); };
      gp.systems = function () { return systems.filter(function (s) { return !s.disposed; }); };

      // an emitter as the options that make it (the inverse of the options above: a tool tunes the numbers and hands over the object to paste into code)
      gp.options_of = function (e) {
        const p = e.params, q = function (v) { return Math.round(v * 10000) / 10000; };
        const pair = function (a, b) { return a === b ? q(a) : [q(a), q(b)]; };
        const v3 = function (i) { return [q(p[i]), q(p[i + 1]), q(p[i + 2])]; };
        const o = {};
        o.rate = q(p[P.rate]);
        o.lifetime = pair(p[P.life0], p[P.life1]);
        o.speed = pair(p[P.speed0], p[P.speed1]);
        o.direction = v3(P.dir_x);
        o.spread = q(p[P.spread] / DEG);
        o.shape = ["point", "sphere", "box", "disc"][p[P.shape] | 0] || "point";
        if (p[P.ext_x] === p[P.ext_y] && p[P.ext_y] === p[P.ext_z]) o.extent = q(p[P.ext_x]); else o.extent = v3(P.ext_x);
        if (p[P.shell] > 0.5) o.shell = true;
        const sz = [p[P.size0], p[P.size1], p[P.size2], p[P.size3]];
        if (sz[0] === sz[1] && sz[1] === sz[2] && sz[2] === sz[3]) o.size = q(sz[0]);
        else if (Math.abs(sz[1] - (sz[0] + (sz[3] - sz[0]) / 3)) < 1e-4 && Math.abs(sz[2] - (sz[0] + (sz[3] - sz[0]) * 2 / 3)) < 1e-4) o.size = [q(sz[0]), q(sz[3])];
        else o.size = sz.map(q);
        if (p[P.size_rnd] !== 0) o.size_random = q(p[P.size_rnd]);
        const keys = [];
        for (let i = 0; i < 4; i++) keys.push([q(p[P.c0r + i * 4]), q(p[P.c0r + i * 4 + 1]), q(p[P.c0r + i * 4 + 2]), q(p[P.c0r + i * 4 + 3])]);
        const same = function (a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]; };
        const mix = function (a, b, t) { return [0, 1, 2, 3].map(function (c) { return a[c] + (b[c] - a[c]) * t; }); };
        const near = function (a, b) { return [0, 1, 2, 3].every(function (c) { return Math.abs(a[c] - b[c]) < 2e-4; }); };
        if (same(keys[0], keys[1]) && same(keys[1], keys[2]) && same(keys[2], keys[3])) o.color = keys[0];
        else if (near(keys[1], mix(keys[0], keys[3], 1 / 3)) && near(keys[2], mix(keys[0], keys[3], 2 / 3))) o.color = [keys[0], keys[3]];
        else o.color = keys;
        o.fade = [q(p[P.fade_in]), q(p[P.fade_out])];
        o.gravity = v3(P.grav_x);
        o.wind = v3(P.wind_x);
        o.drag = q(p[P.drag]);
        o.turbulence = p[P.turb] > 0 ? { strength: q(p[P.turb]), scale: q(p[P.turb_scale]), speed: q(p[P.turb_speed]) } : 0;
        o.rotation = pair(p[P.rot0] / DEG, p[P.rot1] / DEG);
        o.spin = pair(p[P.spin0] / DEG, p[P.spin1] / DEG);
        o.collide = ["none", "die", "bounce", "slide"][p[P.collide] | 0] || "none";
        o.ground = p[P.ground_mode] > 0.5 ? q(p[P.ground_y]) : "terrain";
        o.bounce = q(p[P.bounce]); o.friction = q(p[P.friction]); o.radius = q(p[P.radius]);
        o.stretch = q(p[P.stretch]);
        o.flip = q(p[P.flip_fps]);
        o.inherit = q(p[P.inherit]);
        o.lod = [q(p[P.lod_near]), q(p[P.lod_far])];
        o.max_distance = q(p[P.max_dist]);
        return o;
      };

      // ---- attached to a moving thing -------------------------------------------------------------------------------------------------------------------------------
      //   emitter.attach(target, { offset: [x, y, z], rotation: [x, y, z, w], max_jump: 100 })        gp.effect(...).attach(target, ...)        emitter.detach()
      // The emitter gets a transform of its own (engine.tra_model) parented to `target` in the WORKER: a physics body (engine.phy: the worker links a model to its render pose) or any tra_model (a node, a bone,
      // another emitter's model). The worker composes position and rotation (offset and rotation are local to the target); the page does no transform maths: each frame it only copies the model's
      // world_position into the emitter (so the trail is continuous at any frame rate and `inherit` hands on the velocity) and its world_rotation, which the update shader applies to the emission direction and the
      // shape (a box or disc turns with the body). A jump of more than `max_jump` metres in a frame (the first frame, a respawn) is a teleport: no trail across the map.
      const attached = [];
      const model_pool = [];                                      // models given back by detach: engine.tra_model has no remove, a model is made once and reused
      Emitter.prototype.attach = function (target, o) {
        o = o || {};
        const tra = engine.tra_model;
        let parent = null;
        if (target && target.model_matrix && target.uuid) parent = target;                          // a tra_model
        else if (target && target.shapes && target.uuid) parent = tra.body_model(target);           // a physics body
        if (!parent) fail("attach needs a physics body (engine.phy) or a tra_model (engine.tra_model)");
        const off = o.offset || [0, 0, 0], rot = o.rotation || [0, 0, 0, 1];
        if (off.length < 3 || rot.length < 4) fail("offset is [x, y, z], rotation [x, y, z, w]");
        if (!this.model) { this.model = model_pool.pop() || tra(); attached.push(this); }
        tra.set_parent(this.model, parent);
        tra.set_position(this.model, +off[0], +off[1], +off[2]);
        tra.set_rotation(this.model, +rot[0], +rot[1], +rot[2], +rot[3]);
        this.parent_model = parent; this.attach_off = Math.hypot(off[0], off[1], off[2]); this.max_jump = o.max_jump === undefined ? 100 : +o.max_jump;
        this.pending = true;                                      // until the worker has answered (a few frames): the model reads what it was before
        return this;
      };
      Emitter.prototype.detach = function () {
        if (!this.model) return this;
        engine.tra_model.set_parent(this.model, null);
        const k = attached.indexOf(this);
        if (k >= 0) attached.splice(k, 1);
        model_pool.push(this.model);
        this.model = null; this.parent_model = null;
        this.q[0] = 0; this.q[1] = 0; this.q[2] = 0; this.q[3] = 1;
        return this;
      };
      // The emitter's orientation in the world (a unit quaternion x, y, z, w; an array or four numbers): the update shader turns the emission direction and the shape by it, so a cone aims, a disc / box lies
      // the way the quaternion says. The default is the identity: `direction` and `extent` are then world axes. An attached emitter is oriented by its model every frame (this is then overwritten).
      Emitter.prototype.orient = function (x, y, z, w) {
        if (typeof x === "object" && x !== null) { w = x[3]; z = x[2]; y = x[1]; x = x[0]; }
        const l = Math.sqrt(x * x + y * y + z * z + w * w);
        if (!(l > 1e-6)) fail("orient needs a quaternion [x, y, z, w]");
        this.q[0] = x / l; this.q[1] = y / l; this.q[2] = z / l; this.q[3] = w / l;
        return this;
      };
      // started somewhere, facing somewhere: the same as teleport(x, y, z, q): a jump to (x, y, z) with the orientation q ([x, y, z, w], optional: the one it has). For an emitter that moves, call at(x, y, z, q) every frame
      Emitter.prototype.place = function (x, y, z, q) { return this.teleport(x, y, z, q); };
      gp.attached = function () { return attached.length; };
      // the worker's answer for a freshly attached emitter has come when both models have a scale (the worker writes 1 at creation; a model never heard from reads 0) and the child is where the offset puts it
      function answered(e) {
        const c = e.model, p = e.parent_model;
        if (!(c.world_scale[0] > 0) || !(p.world_scale[0] > 0)) return false;
        const dx = c.world_position[0] - p.world_position[0], dy = c.world_position[1] - p.world_position[1], dz = c.world_position[2] - p.world_position[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz) <= e.attach_off * Math.max(p.world_scale[0], p.world_scale[1], p.world_scale[2]) * 1.001 + 1e-3;
      }
      function step_attached() {
        for (let i = attached.length - 1; i >= 0; i--) {
          const e = attached[i];
          if (e.disposed) { attached.splice(i, 1); continue; }
          const m = e.model, wp = m.world_position, wr = m.world_rotation;
          if (e.pending) { if (!answered(e)) continue; e.pending = false; e.teleport(wp[0], wp[1], wp[2]); }
          else {
            const dx = wp[0] - e.pos[0], dy = wp[1] - e.pos[1], dz = wp[2] - e.pos[2];
            if (dx * dx + dy * dy + dz * dz > e.max_jump * e.max_jump) e.teleport(wp[0], wp[1], wp[2]); else e.at(wp[0], wp[1], wp[2]);
          }
          e.q[0] = wr[0]; e.q[1] = wr[1]; e.q[2] = wr[2]; e.q[3] = wr[3];
        }
      }

      // does the system have anything to do this frame: particles alive, a burst waiting, an emitter that is giving births
      function busy(sys) {
        if (sys.len > 0 || sys.nbursts > 0) return true;
        for (let i = 0; i < sys.emitters.length; i++) { const e = sys.emitters[i]; if (e.active && e.params[P.rate] > 0) return true; }
        return false;
      }

      // steps every system by dt seconds (the engine does it each frame, before anything is drawn; gp.manual = true leaves it to you)
      gp.update = function (dt) {
        if (!(dt > 0)) dt = 0;
        if (dt > 0.1) dt = 0.1;
        clock_now += dt;
        if (attached.length) step_attached();
        const st = gp.stats;
        let live = 0, any = false;
        for (let i = 0; i < systems.length; i++) { const s = systems[i]; if (s.disposed) continue; live++; if (!any && busy(s)) any = true; }
        st.systems = live; st.births = 0; st.window = 0; st.passes = 0;
        if (live === 0) return;
        const r = resources();
        upload_params(r);
        if (!any) return;                                         // nothing alive, nothing to be born: no GPU work at all
        const cam = engine.global_camera_position || [0, 0, 0, 0];
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.useProgram(r.prog);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, r.tf);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, r.params_tex); gl.bindSampler(0, null);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, r.batch_tex); gl.bindSampler(1, null);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, ground && ground.height && ground.height.gl_texture ? ground.height.gl_texture : r.dummy_ground); gl.bindSampler(2, null);
        const u = r.u;
        gl.uniform1i(u.ps_params, 0); gl.uniform1i(u.u_batch, 1); gl.uniform1i(u.u_ground_tex, 2);
        if (ground && ground.height) {
          if (ground.height.update_source) engine.update_texture(ground.height);
          gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, ground.height.gl_texture);
          gl.uniform4f(u.u_ground, ground.size, ground.scale, 1, ground.filter === "bicubic" ? 2 : (ground.filter === "bilinear" ? 1 : 0));
          gl.uniform2f(u.u_ground_origin, ground.origin ? ground.origin[0] : 0, ground.origin ? ground.origin[1] : 0);
        } else { gl.uniform4f(u.u_ground, 1, 1, 0, 0); gl.uniform2f(u.u_ground_origin, 0, 0); }
        gl.enable(gl.RASTERIZER_DISCARD);
        const timed = timer_begin();
        for (let i = 0; i < systems.length; i++) {
          const s = systems[i];
          if (s.disposed) continue;
          if (busy(s)) update_system(s, dt, r, cam); else s.births = 0;
          st.births += s.births; st.window += s.len;
        }
        if (timed) timer_end();
        gl.disable(gl.RASTERIZER_DISCARD);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        for (let t = 2; t >= 0; t--) { gl.activeTexture(gl.TEXTURE0 + t); gl.bindTexture(gl.TEXTURE_2D, null); }
        gl.useProgram(null);
        if (gp.debug) { const err = gl.getError(); if (err !== 0) fail("GL error " + err + " in the update pass"); }
        if (typeof PR !== "undefined") PR.gpu_particles = st.window + " in " + st.systems + " / " + st.births + " born / " + st.dropped + " dropped";
      };

      // ---- drawing ---------------------------------------------------------------------------------------------------------------------------------------
      // the systems that are drawn in the scene pass (dither; and alpha / add while no deferred pass is attached: they then use the hardware depth test and have no soft edges)
      gp.render = function () { for (let i = 0; i < systems.length; i++) { const s = systems[i]; if (!s.disposed && !s.soft_now()) s.render(); } };
      // the soft ones: after the lighting pass, to the screen (gp.attach calls it). With quality.resolution under 1 they are drawn into a smaller picture (premultiplied: the same blend as on the screen,
      // so the result is the same as drawing them there in the same order) and that is laid over the screen with one quad: bilinear, and a fraction of the fill rate.
      let half = null;
      function half_target(res) {
        if (!half) half = { rts: {}, mat: engine.materials.clone(engine.render_texture.mat, { state: { blend: { func: [gl.ONE, gl.ONE_MINUS_SRC_ALPHA] } } }) };
        const key = res.toFixed(2);
        if (!half.rts[key]) half.rts[key] = engine.render_targets.create({ width: res, height: res, color: { filter: gl.LINEAR, clamp: true } });          // (a size under 1 is a share of the screen's)
        return half.rts[key];
      }
      gp.render_forward = function () {
        let any = false;
        for (let i = 0; i < systems.length && !any; i++) { const s = systems[i]; any = !s.disposed && s.len > 0 && s.soft_now(); }
        if (!any) return;
        const res = quality.resolution;
        if (res < 0.999) {
          const rt = half_target(res);
          qvec[1] = res;
          engine.push_render_target(rt, true);
          for (let i = 0; i < systems.length; i++) { const s = systems[i]; if (!s.disposed && s.soft_now()) s.render(); }
          engine.pop_render_target();
          engine.render_texture(rt.color, 0, 0, 1, 1, half.mat);
        } else {
          qvec[1] = 1;
          for (let i = 0; i < systems.length; i++) { const s = systems[i]; if (!s.disposed && s.soft_now()) s.render(); }
        }
      };
      // the systems with `cast_shadow` into one cascade of the sun's shadow maps (gp.attach hooks screen.on_shadowmap and calls it with the cascade's index; a pass you do not attach calls it from its own on_shadowmap).
      // gp.shadows = false: none at all; gp.shadow_cascades: how many cascades, nearest first, take particles (the far ones cover too much ground for a smoke column to show in them)
      // A shadow map is low quality on purpose, to cost little: of the slots of a system only the share `gp.shadow_detail` (0.02 .. 1, default 0.25) is drawn, each bigger by detail ^ -1/4 (the
      // area-keeping 1 / sqrt(detail) is right for a sparse cloud, but puffs overlap and the map holds the union of them, so it would make a dense column's shadow far too big); particles under `gp.shadow_min_size` metres (default 0.1: rain, sparks) are left out; the fragment is the soft disc alone (no texture fetch).
      gp.shadows = true; gp.shadow_cascades = 2; gp.shadow_detail = 0.25; gp.shadow_min_size = 0.1;
      const cull = new Float32Array(3);
      engine.uniforms.set("ps_cull", cull);
      gp.render_shadow = function (cascade_index) {
        if (!gp.shadows || (cascade_index !== undefined && cascade_index >= gp.shadow_cascades)) return;
        const c = engine.global_camera_position || cull;
        cull[0] = c[0]; cull[1] = c[1]; cull[2] = c[2];          // (the camera of the player, for the distance limits: the shadow pass's own camera is the sun's)
        for (let i = 0; i < systems.length; i++) systems[i].render_shadow();
      };
      gp.hook = function () { if (!gp.hooked_render) { gp.hooked_render = true; engine.on_frame.add(gp.render); } return gp; };

      // a deferred pass (engine.deffered_rendering): its G-buffer is what soft particles fade against, and they are drawn when it has finished
      gp.attach = function (screen) {
        if (!screen || !screen.frag_position) fail("attach needs the screen of engine.deffered_rendering");
        gp.screen = screen;
        engine.uniforms.set("ps_scene", screen.frag_position);
        if (screen.moon_direction) engine.uniforms.set("ps_moon", new Float32Array(screen.moon_direction));
        if (screen.shadows_enabled && screen.cascades && screen.cascades.length === 3) {          // (the lighting pass's own cascade maps and matrices, read by the soft alpha particles to take the sun's shadow)
          const cs = screen.cascades;
          for (let i = 0; i < 3; i++) { engine.uniforms.set("ps_sm" + i, cs[i].depth); engine.uniforms.set("ps_sm_m" + i, cs[i].camera.view_projection_matrix); }
          engine.uniforms.set("ps_sm_split", new Float32Array([cs[0].d, cs[1].d, cs[2].d]));
          engine.uniforms.set("ps_sm_texel", new Float32Array([cs[0].texel_size, cs[1].texel_size, cs[2].texel_size]));
          engine.uniforms.set("ps_sm_scale", new Float32Array([1 / cs[0].depth_range, 1 / cs[1].depth_range, 1 / cs[2].depth_range]));
        }
        if (!screen.gpu_particles_hooked) {
          screen.gpu_particles_hooked = true;
          const prev = screen.on_after_frame;
          screen.on_after_frame = function (time, dt) {
            if (prev) prev.call(screen, time, dt);
            if (gp.screen === screen && screen.enabled !== false) gp.render_forward();
          };
          const prev_shadow = screen.on_shadowmap;
          screen.on_shadowmap = function (time, dt, cascade, index) {
            if (prev_shadow) prev_shadow.call(screen, time, dt, cascade, index);
            if (gp.screen === screen) gp.render_shadow(index);
          };
        }
        return gp;
      };
      gp.detach = function () { gp.screen = null; };

      return gp;
    })();
  });
});
