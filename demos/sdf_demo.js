packing("@/engine.js", "@/debug.js", "@/system/system.js")(function (engine, dom, httprequest) {
  // SDF DEMO (/demos/sdf_demo.html): creatures that are MADE FROM AN SDF. A creature file of system/creatures/ has `sdf` (parts: shapes on the creature's bones, smooth blends, islands); system.make_creature -> system.build_sdf
  // runs the system's own mesher (marching cubes in the wasm worker, built in) and makes a SKINNED mesh and its skin weights on the creature's bones, and the species is made of that. Twelve of them side by side on the grid floor,
  // each scaled to the same size so that a golem and a fly can be seen together; the stone golem and the fly carry a TEXTURE RECIPE (system.maps.paint: unwrap + bake: colour, packed roughness / metal map, and for the golem a NORMAL MAP).
  //   ?wire=1   wireframe: the mesh the mesher made is drawn as lines (sp.set_wireframe)      ?files=stone_golem,fly,ant   which creature files (names in system/creatures/, no .js)      ?size=1.5   the biggest side of each (metres)
  //   ?walk=1   0: they stand, 1 (default): the ones with legs walk in place      ?cols=4   columns      ?dist=11   camera distance      ?stats=1   the engine's numbers panel      ?shadows=0   ?atmosphere=1
  // `window.happy_demo` is what a test reads: { done, error, creatures: [{ name, ok, error, vertices, triangles, bones, legs, textured, maps: [color, pack, normal], extent, scale, ms (the mesher), walked }], frames, ms }.
  const FILES = ["stone_golem", "fly", "ladybird", "bee", "ant", "spider", "rhino_beetle", "jumping_spider", "android", "mummy", "fat_monster", "knight"];

  function ready(engine) {
    const system = engine.system;
    const q = new URLSearchParams(location.search);
    const files = q.get("files") ? q.get("files").split(",") : FILES, size = +(q.get("size") || 1.5), cols = Math.max(1, +(q.get("cols") || 4)), walk = q.get("walk") !== "0", wire = q.get("wire") === "1";
    const demo = window.happy_demo = { done: false, error: null, wire: wire, creatures: [], frames: 0, ms: 0 };

    if (window.PR$ && q.get("stats") !== "1") window.PR$.style.display = "none";
    const scene = engine.debug.scene();
    scene.use_deffered_rendering({ ENABLE_ATMOSPHERE: q.get("atmosphere") === "1", ENABLE_SHADOWS: q.get("shadows") !== "0" });
    scene.on_shadow_pass.add(function () { system.render_all(); engine.debug.render(); });
    scene.on_render_pass.add(function () { engine.debug.grid.render_ground(); system.render_all(); engine.debug.render(); });
    const rows = Math.ceil(files.length / cols), CELL_X = size * 2.0, CELL_Z = size * 2.2;
    scene.camera.update_perspective(0.05, 1500, 60);
    scene.camera.control.distance = +(q.get("dist") || Math.max(4, cols * CELL_X * 0.74 + rows * 0.3));
    engine.tra_model.yaw_pitch(scene.camera.control, 0.0, -0.5);
    engine.tra_model.set_position(scene.camera.control, 0, size * 0.25, 0.3);

    // the size of a mesh: the biggest side of its box (metres) from the positions the mesher made
    function extent_of(geo) {
      const m = geo && geo.mesh, P = m && m.positions;
      if (!P || !P.length) return null;
      const flat = typeof P[0] === "number", n = flat ? P.length / 3 : P.length;
      const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { const v = flat ? P[3 * i + c] : P[i][c]; if (v < lo[c]) lo[c] = v; if (v > hi[c]) hi[c] = v; }
      return { lo: lo, hi: hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
    }

    const crowd = [];
    const t_all = performance.now();
    system.init({ table_bytes: 192 << 20, max_species: files.length + 4 });
    system.load("/system/system.bin", { all: true }).then(function () {
      let chain = Promise.resolve();
      files.forEach(function (name, i) {
        chain = chain.then(function () {
          const rec = { name: name, ok: false };
          demo.creatures.push(rec);
          const t0 = performance.now();
          return httprequest.get_url("/system/creatures/" + name + ".js").then(function (text) {
            return system.make_creature(text, { max_instances: 1, mind: false });
          }).then(function (r) {
            rec.ms = Math.round(performance.now() - t0);
            const ex = extent_of(system.sdf_mesh(r.def));
            const big = ex ? Math.max(ex.size[0], ex.size[1], ex.size[2]) : 1, scale = size / big;
            if (wire) r.sp.set_wireframe(true);
            const col = i % cols, row = Math.floor(i / cols), x = (col - (cols - 1) / 2) * CELL_X, z = (row - (rows - 1) / 2) * CELL_Z;
            const c = r.sp.spawn({ x: x, y: 0, z: z, scale: scale, yaw: -0.5 });
            const mm = r.sp.material && r.sp.material.maps ? r.sp.material.maps : null, maps = mm ? Object.keys(mm).filter(function (k) { return mm[k]; }) : [];
            const has_legs = !!(r.sp.legs && r.sp.legs.legs && r.sp.legs.legs.length);
            if (walk && has_legs) { try { r.sp.set_treadmill(c, 0, 0.7 * scale * Math.min(1.5, big)); } catch (e) { /* no legs */ } }
            rec.ok = true; rec.vertices = r.sp.vertex_count; rec.triangles = r.sp.index_data ? r.sp.index_data.length / 3 : undefined; rec.bones = r.def.skeleton.length; rec.legs = has_legs ? r.sp.legs.legs.length : 0;
            rec.parts = r.def.sdf && r.def.sdf.parts ? r.def.sdf.parts.length : 0;
            rec.textured = !!r.sp.texture; rec.maps = maps; rec.extent = ex ? ex.size.map(function (v) { return +v.toFixed(2); }) : null; rec.scale = +scale.toFixed(2);
            if (r.sp.texture) rec.texture = { keys: Object.keys(r.sp.texture).join(","), layers: r.sp.texture.layers && (r.sp.texture.layers.length !== undefined ? r.sp.texture.layers.length : r.sp.texture.layers), size: mm && mm.color ? mm.color.size : undefined };
            if (r.sp.texture && r.sp.texture.notes && r.sp.texture.notes.length) rec.texture_notes = r.sp.texture.notes.slice(0, 2);
            crowd.push({ sp: r.sp, c: c, root: r.def.skeleton[0].name, rec: rec, p0: null });
          }).catch(function (e) { rec.error = String(e && e.message || e).slice(0, 240); });
        });
      });
      return chain;
    }).then(function () {
      demo.ms = Math.round(performance.now() - t_all);
      if (!crowd.length) { demo.error = "no creature could be made: " + JSON.stringify(demo.creatures).slice(0, 500); demo.done = true; return; }
      engine.on_frame.add(function () {
        demo.frames++;
        if (demo.frames === 8) crowd.forEach(function (k) { try { k.p0 = k.sp.bone_world(k.c, k.root); } catch (e) { k.p0 = null; } });
        if (demo.frames === 90 && !demo.done) {
          crowd.forEach(function (k) { try { const p = k.sp.bone_world(k.c, k.root); if (p && k.p0) k.rec.walked = +Math.hypot(p[0] - k.p0[0], p[2] - k.p0[2]).toFixed(3); } catch (e) { /* gone */ } });
          demo.done = true;
          console.log("happy.demo: " + crowd.length + " sdf creatures meshed in " + demo.ms + " ms");
        }
      });
    }).catch(function (e) { demo.error = String(e && e.stack || e); console.error("happy.demo: " + demo.error); demo.done = true; });
  }

  engine({})(ready);
});
