packing("@/engine.js", "@/debug.js")(function (engine, dom, httprequest) {
  // RENDER DEMO (/demos/render_demo.html): the deferred renderer with its cascaded shadow maps and its atmosphere (the sky), on a lit checker floor with a few primitive meshes
  // (engine.geometries cube / sphere / capsule, each with an engine material, drawn as instanced debug meshes: engine.debug.mesh) and a tall pillar whose shadow shows the sun's way.
  // Left drag turns the camera, right drag pans, the wheel zooms.
  //   ?sun_azimuth=40      degrees round the sky (0: the sun is on the +x side, 90: +z)         ?sun_elevation=30      degrees over the horizon (a low sun makes long shadows; under 0 it is night)
  //   ?atmosphere=1        the sky and the air (0: a black sky, no scattering)                  ?shadows=0             no shadow maps (every shape floats on the floor lit, with no shadow)
  //   ?stats=1             the engine's own numbers panel (hidden by default)                    ?spin=1                the shapes turn (a moving shadow); ?n=12  the size of the ring of boxes
  //   ?distance=26  ?yaw=0.75  ?pitch=-0.3      the camera (a pitch near 0 or above shows the sky)
  // `window.happy_demo` is what a test reads: { done, error, atmosphere, shadows, sun: { azimuth, elevation, direction }, shapes, frames, caster_height }.
  const q = new URLSearchParams(location.search);
  const num = function (k, d) { const v = parseFloat(q.get(k)); return isFinite(v) ? v : d; };

  function ready(engine) {
    const demo = window.happy_demo = { done: false, error: null, atmosphere: q.get("atmosphere") === "1", shadows: q.get("shadows") !== "0", sun: null, shapes: 0, frames: 0, caster_height: 0 };
    if (window.PR$ && q.get("stats") !== "1") window.PR$.style.display = "none";
    try {
      const azimuth = num("sun_azimuth", 40), elevation = num("sun_elevation", 30);
      const scene = engine.debug.scene();
      // the sun: the scene's directional light turned (euler: pitch -elevation, yaw) so that its fw_vector, which the lighting reads as the direction TO the sun, is (cos el cos az, sin el, cos el sin az)
      const az = azimuth * Math.PI / 180, el = elevation * Math.PI / 180;
      engine.tra_model.set_eular(scene.dlight0, -el, Math.atan2(Math.cos(az), Math.sin(az)), 0);
      demo.sun = { azimuth: azimuth, elevation: elevation, direction: Array.prototype.slice.call(scene.dlight0.fw_vector) };

      scene.use_deffered_rendering({ ENABLE_ATMOSPHERE: demo.atmosphere, ENABLE_SHADOWS: demo.shadows, ENABLE_SKY_REFLECTION: true, ENABLE_GLOSS: true });

      // three materials on three geometries: a rough box, a shiny metal sphere, a half-metal capsule; the colour of each instance is its vertex colour
      const mesh = function (geo, rough, metal) {
        return engine.debug.mesh({ geo: geo, material: { uniforms: { u_roughness: rough, u_metallic: metal } } });
      };
      const boxes = mesh(engine.geometries.cube(1, 1, 1, 1), 0.85, 0.0);
      const spheres = mesh(engine.geometries.sphere(1, 24, 16), 0.25, 0.9);
      const capsules = mesh(engine.geometries.capsule(0.4, 1.2, 16, 6), 0.5, 0.3);
      const all = [boxes, spheres, capsules];

      const shapes = [];       // { kind, x, y, z, sx, sy, sz, yaw, color }
      const add = function (kind, x, y, z, sx, sy, sz, yaw, color) { shapes.push({ kind: kind, x: x, y: y, z: z, sx: sx, sy: sy, sz: sz, yaw: yaw || 0, color: color }); };
      add("box", 0, 3.5, 0, 1.2, 7, 1.2, 0.3, [0.85, 0.82, 0.78]);                     // the pillar: its shadow is the clearest thing on the floor
      add("sphere", 0, 7.8, 0, 0.8, 0.8, 0.8, 0, [0.9, 0.55, 0.2]);                    // a ball on top of it
      add("sphere", 5, 1.2, 1, 1.2, 1.2, 1.2, 0, [0.95, 0.85, 0.4]);
      add("sphere", 8, 0.9, -3, 0.9, 0.9, 0.9, 0, [0.6, 0.75, 0.95]);
      add("capsule", -5, 1.0, 3, 1, 1, 1, 0, [0.9, 0.35, 0.35]);
      add("capsule", -7, 1.0, -2, 1, 1, 1, 0, [0.4, 0.8, 0.5]);
      add("box", 4, 0.75, -6, 1.5, 1.5, 1.5, 0.5, [0.3, 0.55, 0.9]);
      add("box", 4, 2.25, -6, 1.0, 1.5, 1.0, 1.1, [0.9, 0.4, 0.7]);                    // a box on a box
      const ring = Math.round(num("n", 10));
      for (let i = 0; i < ring; i++) {                                                  // a ring of boxes, a little far: the shadows' cascade changes along it
        const a = i / ring * Math.PI * 2, r = 16 + (i % 3) * 4;
        add("box", Math.cos(a) * r, 0.6 + (i % 2) * 0.4, Math.sin(a) * r, 1.2, 1.2 + (i % 2) * 0.8, 1.2, a, [0.55 + 0.4 * Math.sin(a), 0.6, 0.55 + 0.4 * Math.cos(a)]);
      }
      add("box", 0, 0.1, 0, 0.1, 0.1, 0.1, 0, [0, 0, 0]);                              // (nothing: keeps the list non-empty if n is 0)
      demo.shapes = shapes.length;
      demo.caster_height = 7;

      const spin = q.get("spin") === "1";
      engine.on_frame_begin.add(function (time) {                                       // the instances are queued every frame (the debug meshes are cleared at the end of each one)
        const t = spin ? time / 1000 : 0;
        for (let i = 0; i < shapes.length; i++) {
          const s = shapes[i], yaw = s.yaw + (i > 1 ? t * 0.5 : 0), h = yaw * 0.5, sy = Math.sin(h), cy = Math.cos(h);
          const m = s.kind === "box" ? boxes : s.kind === "sphere" ? spheres : capsules;
          m.set_color(s.color[0], s.color[1], s.color[2]);
          m.add(s.x, s.y, s.z, s.sx, s.sy, s.sz, 0, sy, 0, cy);
        }
      });

      const draw = function () { all.forEach(function (m) { m.render(); }); };
      scene.on_shadow_pass.add(draw);
      scene.on_render_pass.add(function () { engine.debug.grid.render_ground(); draw(); });

      scene.camera.control.distance = num("distance", 26);
      engine.tra_model.yaw_pitch(scene.camera.control, num("yaw", 0.75), num("pitch", -0.3));

      engine.on_frame.add(function () {
        demo.frames++;
        if (demo.frames === 40 && !demo.done) { demo.sun.direction = Array.prototype.map.call(scene.dlight0.fw_vector, function (v) { return Math.round(v * 1000) / 1000; }); demo.done = true; console.log("happy.demo: render demo up: atmosphere " + demo.atmosphere + ", shadows " + demo.shadows + ", sun " + azimuth + "/" + elevation); }
      });
    } catch (e) { demo.error = String(e && e.stack || e); console.error("happy.demo: " + demo.error); demo.done = true; }
  }

  engine({})(ready);
});
