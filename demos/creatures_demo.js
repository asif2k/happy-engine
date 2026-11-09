packing("@/engine.js", "@/debug.js", "@/system/system.js")(function (engine, dom, httprequest) {
  // CREATURES DEMO (/demos/creatures_demo.html): a grid floor and a crowd of creatures of the files of system/creatures/ (people, animals), each species made once and spawned many times, wandering inside a ring.
  // Left drag turns the camera, right drag pans, the wheel zooms.
  //   ?files=knight,wolf,horse     which creature files (names in system/creatures/, no .js)      ?n=5      how many of each      ?radius=18      the size of the ring      ?speed=1.3      m/s
  //   ?stats=1     the engine's own numbers panel (hidden by default)      ?atmosphere=1                the sky and the air      ?shadows=0      no shadows      ?seed=3      another crowd
  // `window.happy_demo` is what a test reads: { done, error, species: { name: { ok, count, error } }, spawned, frames, walked (the mean metres they went from where they began) }.
  const DEFAULT_FILES = ["knight", "punk_girl", "zombie_soldier", "grandmother", "old_sailor", "bear", "jaguar", "horse", "rhino", "trex", "elephant", "spider"];

  function ready(engine) {
    const system = engine.system, math = engine.math;
    const q = new URLSearchParams(location.search);
    const files = (q.get("files") ? q.get("files").split(",") : DEFAULT_FILES), per = +(q.get("n") || 5), R = +(q.get("radius") || 18), speed = +(q.get("speed") || 1.3);
    let seed = +(q.get("seed") || 1);
    const rnd = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const demo = window.happy_demo = { done: false, error: null, species: {}, spawned: 0, frames: 0, walked: 0 };

    if (window.PR$ && q.get("stats") !== "1") window.PR$.style.display = "none";
    const scene = engine.debug.scene();
    scene.use_deffered_rendering({ ENABLE_ATMOSPHERE: q.get("atmosphere") === "1", ENABLE_SHADOWS: q.get("shadows") !== "0" });
    scene.on_shadow_pass.add(function () { system.render_all(); engine.debug.render(); });
    scene.on_render_pass.add(function () { engine.debug.grid.render_ground(); system.render_all(); engine.debug.render(); });
    scene.camera.control.distance = R * 1.5;
    engine.tra_model.yaw_pitch(scene.camera.control, 0.6, -0.55);

    const crowd = [];
    const where = function (k) { try { return k.sp.bone_world(k.c, k.root); } catch (e) { return null; } };      // (the species' own first bone: not every body has a `hips`)
    const make = function (name) {
      return httprequest.get_url("/system/creatures/" + name + ".js").then(function (text) {
        return system.make_creature(text, { max_instances: per + 1 });
      }).then(function (r) {
        for (let i = 0; i < per; i++) {
          const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R * 0.8, h = rnd() * Math.PI * 2, x = Math.cos(a) * d, z = Math.sin(a) * d;
          const c = r.sp.spawn({ x: x, y: 0, z: z, scale: 1, yaw: h });
          crowd.push({ sp: r.sp, c: c, root: r.def.skeleton[0].name, x0: x, z0: z, heading: h, turn: 0, next: 0, speed: speed * (0.7 + 0.6 * rnd()) });
        }
        demo.species[name] = { ok: true, count: per };
      }).catch(function (e) { demo.species[name] = { ok: false, error: String(e && e.message || e).slice(0, 200) }; });
    };

    system.init({ table_bytes: 128 << 20, max_species: files.length + 4 });
    system.load("/system/system.bin", { all: true }).then(function () {
      let chain = Promise.resolve();
      files.forEach(function (n) { chain = chain.then(function () { return make(n); }); });
      return chain;
    }).then(function () {
      demo.spawned = crowd.length;
      let t_last = 0;
      engine.on_frame.add(function () {
        demo.frames++;
        const now = performance.now() / 1000;
        for (let i = 0; i < crowd.length; i++) {
          const k = crowd[i];
          if (now >= k.next) {                                           // a new wish now and then: a little turn, or back toward the middle when it has gone far
            const p = where(k);
            const x = p ? p[0] : k.x0, z = p ? p[2] : k.z0;
            if (Math.hypot(x, z) > R) k.heading = Math.atan2(-x, -z) + (rnd() - 0.5) * 0.8; else k.heading += (rnd() - 0.5) * 1.6;
            k.sp.set_intent(k.c, Math.sin(k.heading) * k.speed, Math.cos(k.heading) * k.speed, 0, 0);
            k.next = now + 1.5 + rnd() * 3;
          }
        }
        if (demo.frames === 150 && !demo.done) {
          let sum = 0, n = 0;
          crowd.forEach(function (k) { const p = where(k); if (p) { sum += Math.hypot(p[0] - k.x0, p[2] - k.z0); n++; } });
          demo.walked = n ? sum / n : 0; demo.measured = n;
          demo.done = true;
          console.log("happy.demo: " + crowd.length + " creatures of " + Object.keys(demo.species).filter(function (s) { return demo.species[s].ok; }).length + " kinds, they walked " + demo.walked.toFixed(2) + " m on average");
        }
      });
      if (!demo.spawned) { demo.error = "no creature could be made: " + JSON.stringify(demo.species).slice(0, 400); demo.done = true; }
    }).catch(function (e) { demo.error = String(e && e.stack || e); console.error("happy.demo: " + demo.error); demo.done = true; });
  }

  engine({})(ready);
});
