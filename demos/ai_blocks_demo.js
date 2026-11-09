packing("@/engine.js", "@/debug.js", "@/system/system.js")(function (engine, dom, httprequest) {
  // AI BLOCKS DEMO (/demos/ai_blocks_demo.html): lists the pack's AI blocks (system.ai.blocks(): the 35 names and the ready-made minds, the SETS) and lets a crowd of one body live by ONE set: the body of a creature file (its own mind is
  // thrown away) is given the set's blocks and a tree made of them (the nodes of the blocks that have one, the interrupts first), in a small hosted yard.
  //   ?set=townsperson   which set (villager homebody wanderer townsperson pet patroller brawler hunter flocker ... any id of window.happy_demo.sets)      ?body=grandmother   whose body (a name in system/creatures/)
  //   ?n=6   how many      ?seconds=30   how long the page measures      ?seed=1      ?stats=1   the engine's panel
  // `window.happy_demo` is what a test reads: { done, error, block_count, set (the one used), body, walked (mean metres of path), displaced, moving, alive, events, host, worker_errors, frames, block_names (the 35), sets: [{ id, blocks, faction, kind, help }] }.
  function ready(engine) {
    const system = engine.system;
    const q = new URLSearchParams(location.search);
    const set_id = q.get("set") || "townsperson", body = q.get("body") || "grandmother", n = +(q.get("n") || 6), seconds = +(q.get("seconds") || 30);
    let seed = +(q.get("seed") || 1);
    const rnd = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const demo = window.happy_demo = { done: false, error: null, set: null, body: body, walked: 0, displaced: 0, moving: 0, alive: 0, events: {}, host: null, worker_errors: [], frames: 0 };
    if (window.PR$ && q.get("stats") !== "1") window.PR$.style.display = "none";

    const WORLD = [
      "w.bounds([-30, -30, 30, 30]); w.ground({ y: 0 }); w.nav({ agents: {} }); w.zone('yard', { rect: [-27, -27, 27, 27] });",
      "w.wall({ from: [-14, 0], to: [14, 0], h: 1.8, thick: 0.4, doors: [{ at: 14, width: 2.4, height: 1.8 }], color: [0.78, 0.74, 0.68] });",
      "for (var i = 0; i < 6; i++) w.add('crate', { pos: [-15 + i * 6, 0, 5 + (i % 2) * 5], name: 'crate_n' + i, size: 1.1 });",
      "for (var j = 0; j < 4; j++) w.add('crate', { pos: [-12 + j * 8, 0, -8], name: 'crate_s' + j, size: 1.1 });",
      "return { name: 'the yard' };"
    ].join("\n");

    const scene = engine.debug.scene();
    scene.use_deffered_rendering({ ENABLE_ATMOSPHERE: false, ENABLE_SHADOWS: true });
    scene.camera.control.distance = 28;
    engine.tra_model.yaw_pitch(scene.camera.control, 0.5, -0.9);
    let host = null, all_names = [], all_sets = [];
    scene.on_shadow_pass.add(function () { system.render_all(); engine.debug.render(); });
    scene.on_render_pass.add(function () { engine.debug.grid.render_ground(); system.render_all(); engine.debug.render(); });

    // the tree of a set: the blocks that have a node, the interrupts (flee, fight) first, wander last; it runs in the worker, which reads the blocks' names from its own config (a block without a node is left out of the tree: it acts by its hooks)
    const worker = function (api, ld) {
      var names = [], i, sel = [], first = ["flee", "fight", "guard"], b = api.cfg.mind.blocks, nm, node;
      for (i = 0; i < b.length; i++) names.push(typeof b[i] === "string" ? b[i] : b[i][0]);
      var order = first.filter(function (x) { return names.indexOf(x) >= 0; }).concat(names.filter(function (x) { return first.indexOf(x) < 0; }));
      for (i = 0; i < order.length; i++) { nm = order[i]; try { node = ld.node(nm); } catch (e) { node = null; } if (node) sel.push(node); }
      return { tree: { name: "set", select: sel } };
    };

    system.init({ table_bytes: 128 << 20, max_species: 6 });
    system.load("/system/system.bin", { all: true }).then(function () {
      return system.ai.blocks();
    }).then(function (b) {
      demo.block_count = b.index.length;
      all_names = b.index.slice();
      all_sets = b.sets.sets.map(function (s) { return { id: s.id, blocks: s.blocks.map(function (x) { return Array.isArray(x) ? x[0] : x; }), faction: s.faction, kind: s.kind, help: s.help }; });
      const set = b.sets.sets.filter(function (s) { return s.id === set_id; })[0];
      if (!set) throw new Error("no set `" + set_id + "` (" + all_sets.map(function (s) { return s.id; }).join(", ") + ")");
      demo.set = { id: set.id, blocks: all_sets.filter(function (s) { return s.id === set_id; })[0].blocks, faction: set.faction, kind: set.kind };
      return httprequest.get_url("/system/creatures/" + body + ".js").then(function (text) {
        const CF = system.creature_file_module(), c = CF.load(text);
        c.name = body + "_" + set.id;
        c.family = { faction: set.faction, kind: set.kind, hp: set.hp || 100 };
        c.mind = { hz: 6, far_hz: 2, blocks: JSON.parse(JSON.stringify(set.blocks)), worker: worker };
        host = system.world({ tolerant: true, on_event: function (fam, slot, gen, tag) { const k = fam + ":" + tag; demo.events[k] = (demo.events[k] || 0) + 1; } });
        return host.load({ world_text: WORLD, creatures: { one: c } });
      });
    }).then(function () {
      host.start();
      const fam = Object.keys(host.families)[0];
      if (!fam) throw new Error("the body could not be made: " + JSON.stringify(host.skipped).slice(0, 400));
      const crowd = [];
      for (let i = 0; i < n; i++) {
        const x = (rnd() - 0.5) * 30, z = (rnd() - 0.5) * 30, h = host.spawn(fam, x, 0, z + (Math.abs(z) < 1.5 ? 3 : 0), rnd() * 6.28);
        if (h !== null) crowd.push({ h: h, x0: x, z0: z, px: x, pz: z, path: 0, speed: 0 });
      }
      let last = performance.now(), t0 = last, sample_t = 0;
      engine.on_frame_begin.add(function () {
        demo.frames++;
        const now = performance.now();
        host.update(Math.min(0.1, (now - last) / 1000)); last = now;
        host.each_box(function (p, qq, sx, sy, sz, c) { engine.solid_boxes.set_color(c[0], c[1], c[2]).add(p[0], p[1], p[2], sx, sy, sz, qq[0], qq[1], qq[2], qq[3]); });
        if (demo.done) return;
        if (now - sample_t > 150) {
          const dts = (now - sample_t) / 1000; sample_t = now; demo.alive = 0; demo.moving = 0;
          crowd.forEach(function (c) {
            const r = host.by_handle[c.h], p = r ? host.where(c.h) : null;
            if (!p || r.sp.alive[r.c.slot] !== 1) return;
            demo.alive++;
            const d = Math.hypot(p[0] - c.px, p[2] - c.pz);
            if (d < 3) { c.path += d; c.speed = d / dts; }
            if (c.speed > 0.15) demo.moving++;
            c.px = p[0]; c.pz = p[2];
          });
        }
        if (now - t0 > seconds * 1000) {
          demo.walked = +(crowd.reduce(function (a, c) { return a + c.path; }, 0) / crowd.length).toFixed(2);
          demo.displaced = +(crowd.reduce(function (a, c) { return a + Math.hypot(c.px - c.x0, c.pz - c.z0); }, 0) / crowd.length).toFixed(2);
          demo.count = crowd.length; demo.family = fam;
          demo.host = host.stats();
          demo.worker_errors = (system.worker_errors || []).map(function (m) { return (m.what || "") + ": " + String(m.message || m).slice(0, 200); });
          demo.block_names = all_names; demo.sets = all_sets;                      // (last: the long lists)
          demo.done = true;
          console.log("happy.demo: " + crowd.length + " bodies lived by the set `" + set_id + "`, walked " + demo.walked + " m");
        }
      });
    }).catch(function (e) { demo.error = String(e && e.stack || e); console.error("happy.demo: " + demo.error); demo.done = true; });
  }

  engine({})(ready);
});
