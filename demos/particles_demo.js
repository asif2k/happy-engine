packing("@/engine.js", "@/debug.js", "@/particles/gpu_particles.js", "@/particles/gpu_particle_effects.js")(function (engine, dom, httprequest) {
  // PARTICLES DEMO (/demos/particles_demo.html): the GPU particles (particles/gpu_particles.js, the ready-made effects of particles/gpu_particle_effects.js) on a lit scene with a wall, a pillar and a crate that the soft
  // particles fade against. Left to right along the floor: a campfire, a torch on a pole, black smoke, a fountain, welding sparks, magic motes, steam; an EXPLOSION (flash, fireball, smoke, bouncing sparks, dust) goes
  // off in the middle every few seconds; a comet of your own (gp.create + an emitter moved every frame, a trail at any frame rate) circles over it; ?rain=1 adds rain over the scene.
  // Left drag turns the camera, right drag pans, the wheel zooms.
  //   ?boom_every=3     seconds between explosions (0: none)     ?first_boom=1     when the first goes off     ?only=campfire,steam     only these loop effects (the names of gp.preset_names())
  //   ?until=6.8        done is set when the particle clock has run that many seconds     ?freeze=1     at done the particle clock stops: a still picture of that moment (a test's screenshot)
  //   ?quality=high     low | medium | high | ultra      ?soft=0   no depth fade (hard cuts where particles meet a surface)      ?atmosphere=0  ?shadows=0   as the render demo      ?stats=1   the engine's panel
  // `window.happy_demo` is what a test reads: { done, error, frames, t, effects: [names], live (the slots alive now: gp.stats.window), max_live, births (total), dropped, systems, booms, boom_at: [..], live_at_boom }.
  const q = new URLSearchParams(location.search);
  const num = function (k, d) { const v = parseFloat(q.get(k)); return isFinite(v) ? v : d; };
  const r2 = function (v) { return Math.round(v * 100) / 100; };

  function ready(engine) {
    const gp = engine.gpu_particles;
    const demo = window.happy_demo = { done: false, error: null, frames: 0, t: 0, effects: [], live: 0, max_live: 0, births: 0, dropped: 0, systems: 0, booms: 0, boom_at: [], live_at_boom: [], frozen: false };
    if (window.PR$ && q.get("stats") !== "1") window.PR$.style.display = "none";
    try {
      const scene = engine.debug.scene();
      scene.use_deffered_rendering({ ENABLE_ATMOSPHERE: q.get("atmosphere") !== "0", ENABLE_SHADOWS: q.get("shadows") !== "0" });
      const az = num("sun_azimuth", 60) * Math.PI / 180, el = num("sun_elevation", 38) * Math.PI / 180;
      engine.tra_model.set_eular(scene.dlight0, -el, Math.atan2(Math.cos(az), Math.sin(az)), 0);
      gp.attach(scene.dfd);                                        // the soft particles are drawn after the lighting pass and fade where they sink into the G-buffer
      if (q.get("quality")) gp.set_quality(q.get("quality"));
      if (q.get("soft") === "0") gp.set_quality({ soft: false });

      // ---- the scene: things for the particles to meet -------------------------------------------------------------------------------------------------------------------------------
      const boxes = engine.debug.mesh({ geo: engine.geometries.cube(1, 1, 1, 1), material: { uniforms: { u_roughness: 0.85, u_metallic: 0 } } });
      const solids = [
        [0, 1.6, -5.5, 30, 3.2, 0.5, [0.62, 0.58, 0.52]],             // a back wall
        [-1.6, 1.2, 2.2, 0.8, 2.4, 0.8, [0.55, 0.6, 0.7]],            // a pillar in front of the explosion
        [-10.5, 0.55, 2, 1.1, 1.1, 1.1, [0.7, 0.5, 0.25]],            // a crate
        [-5.5, 0.7, 0, 0.1, 1.4, 0.1, [0.35, 0.25, 0.15]],              // the torch's pole
        [5.5, 0.45, 0, 0.7, 0.9, 0.7, [0.45, 0.45, 0.5]]                // the welder's bench
      ];
      engine.on_frame_begin.add(function () { solids.forEach(function (s) { boxes.set_color(s[6][0], s[6][1], s[6][2]).add(s[0], s[1], s[2], s[3], s[4], s[5], 0, 0, 0, 1); }); });
      const draw = function () { boxes.render(); };
      scene.on_shadow_pass.add(draw);
      scene.on_render_pass.add(function () { engine.debug.grid.render_ground(); draw(); });
      engine.on_frame_end.add(function () { boxes.clear(); });

      // ---- the effects -----------------------------------------------------------------------------------------------------------------------------------------------------------------
      const only = q.get("only") ? q.get("only").split(",") : null;
      const loops = [["campfire", -8, 0, 0, 1], ["torch", -5.5, 1.45, 0, 1], ["black_smoke", -3.2, 0, -1, 0.8], ["fountain", 3.2, 0, 0, 1], ["welding", 5.5, 0.95, 0, 1], ["magic", 8, 0, 0, 1], ["steam", 10.5, 0, -1, 1]];
      const fx = [];
      loops.forEach(function (l) {
        if (only && only.indexOf(l[0]) < 0) return;
        fx.push(gp.effect(l[0], { x: l[1], y: l[2], z: l[3], scale: l[4] }));
        demo.effects.push(l[0]);
      });
      if (q.get("rain") === "1") { fx.push(gp.effect("rain", { x: 0, y: 12, z: 0 })); demo.effects.push("rain"); }
      // a comet of the page's own: its own system and emitter, moved every frame (at()), the trail is continuous at any frame rate
      const comet_sys = gp.create({ capacity: 8192, blend: "add", depth_fade: 0.2 });
      const comet = comet_sys.emitter("comet", { rate: 600, lifetime: [0.6, 1.1], speed: [0.1, 0.5], spread: 180, size: [0.22, 0.02], size_random: 0.3, color: [[0.6, 0.85, 1, 0.9], [0.3, 0.5, 1, 0.5], [0.1, 0.1, 0.5, 0]], gravity: [0, 0.3, 0], drag: 1, fade: [0, 0.5] });
      demo.effects.push("comet");

      // ---- the clock ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
      const boom_every = num("boom_every", 3), first_boom = num("first_boom", 1), until = num("until", 6.8), freeze = q.get("freeze") === "1";
      let T = 0, next_boom = first_boom;
      scene.camera.control.distance = num("distance", 15);
      engine.tra_model.yaw_pitch(scene.camera.control, 0.0, -0.3);
      engine.tra_model.set_position(scene.camera.control, 1.2, 1.4, 0);

      engine.on_frame.add(function (time, dt) {
        demo.frames++;
        if (demo.frames < 3) return;
        const step = Math.min(dt, 0.1);
        T += step; demo.t = r2(T);
        const a = T * 1.3;
        comet.at(Math.cos(a) * 6 + 1.5, 4 + Math.sin(a * 0.7) * 1.2, Math.sin(a) * 3 - 1);
        const st = gp.stats;
        demo.live = st.window; demo.systems = st.systems; demo.births += st.births; demo.dropped = st.dropped;
        if (st.window > demo.max_live) demo.max_live = st.window;
        if (boom_every > 0 && T >= next_boom) {
          next_boom += boom_every;
          demo.booms++; demo.boom_at.push(r2(T));
          gp.play("explosion", 0, 0, 0.8, 1);
          demo.live_at_boom.push(st.window);
          demo.birth_burst = demo.births;
        }
        if (T >= until && !demo.done) {
          demo.stats = { systems: st.systems, window: st.window, births_last_frame: st.births, dropped: st.dropped, passes: st.passes };
          demo.preset_names = gp.preset_names().length;
          if (freeze) { gp.manual = true; demo.frozen = true; }
          demo.done = true;
          console.log("happy.demo: particles demo done: " + st.window + " particles alive in " + st.systems + " systems, " + demo.booms + " explosions");
        }
      });
    } catch (e) { demo.error = String(e && e.stack || e); console.error("happy.demo: " + demo.error); demo.done = true; }
  }

  engine({})(ready);
});
