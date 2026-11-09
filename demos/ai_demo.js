packing("@/engine.js", "@/debug.js", "@/system/system.js")(function (engine, dom, httprequest) {
  // AI DEMO (/demos/ai_demo.html): creatures that LIVE by their own minds inside a small hosted world. system.world(...) is the host: it makes the world of a world file (a yard: the ground, a few walls, crates and barrels, zones),
  // bakes the navigation of it in the worker, makes a species of every creature file with the blocks of its `mind` (wander, flee, needs, greet, curious, follow ...) and the page only calls host.update(dt) once a frame and draws.
  // Nobody here is steered by the page: where they go is their blocks' choice (the walls and the crates are in the way, so the navigation shows).
  // Left drag turns the camera, right drag pans, the wheel zooms.
  //   ?files=grandmother,oink_boy,bear   which creature files (names in system/creatures/, no .js)      ?n=4   how many of each      ?seed=1   another crowd      ?seconds=40   how long the page measures (real seconds)
  //   ?close=1   (with the zombie) everybody starts 5 to 9 m from it      ?order=1   (with the zombie) the page orders it (message 460) at the nearest creature: a probe of `fight`      ?scare=1   at about 55% of the time the page tells everybody a scare (message 390) at a point of the yard: a mind that has `flee` runs away from it      ?zombie=1   one zombie_walker (a hostile faction) is let into the yard
  //   ?stats=1   the engine's own panel      ?shadows=0      no shadows
  // `window.happy_demo` is what a test reads: { done, error, kinds: { name: { faction, mind (the blocks), count, alive, moving, walked (metres of path, mean), displaced (metres from where they began, mean), worst_walk } },
  //   scare: { at_sim, point, told, near, near_before / near_after (mean metres of the creatures that were within 12 m of the point), ran_away_m, rate_before / rate_after (m/s of path) },
  //   hostile (with the zombie): { min_gap, closest, gap_trace, ... }, events (what the minds said, counted by family:tag), host: host.stats(), worker_errors, skipped, world, frames, sim_seconds }.
  const DEFAULT_FILES = ["grandmother", "old_sailor", "oink_boy", "pig_dad", "bear", "horse"];

  function ready(engine) {
    const system = engine.system;
    const q = new URLSearchParams(location.search);
    const files = q.get("files") ? q.get("files").split(",") : DEFAULT_FILES.slice();
    if (q.get("zombie") === "1" && files.indexOf("zombie_walker") < 0) files.push("zombie_walker");
    const per = +(q.get("n") || 4), seconds = +(q.get("seconds") || 40), do_scare = q.get("scare") !== "0";
    let seed = +(q.get("seed") || 1);
    const rnd = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const demo = window.happy_demo = { done: false, error: null, kinds: {}, scare: null, host: null, worker_errors: [], skipped: [], world: null, events: {}, frames: 0, sim_seconds: 0, files: files };

    if (window.PR$ && q.get("stats") !== "1") window.PR$.style.display = "none";

    // THE YARD: a world file is JS text given a builder `w`. A long wall with two doors splits the yard, a short wall makes a corner pen, crates and barrels stand about; the zone `yard` is what the minds wander in.
    const WORLD = [
      "w.bounds([-30, -30, 30, 30]);",
      "w.ground({ y: 0 });",
      "w.nav({ agents: {} });",
      "w.zone('yard', { rect: [-27, -27, 27, 27] });",
      "w.zone('north', { rect: [-27, 2, 27, 27] });",
      "w.zone('south', { rect: [-27, -27, 27, -2] });",
      "w.wall({ from: [-14, 0], to: [14, 0], h: 1.8, thick: 0.4, doors: [{ at: 8, width: 2.4, height: 1.8 }, { at: 20, width: 2.4, height: 1.8 }], color: [0.78, 0.74, 0.68] });",
      "w.wall({ from: [-20, 12], to: [-8, 12], h: 1.4, thick: 0.4, color: [0.7, 0.55, 0.5] });",
      "w.wall({ from: [-20, 12], to: [-20, 20], h: 1.4, thick: 0.4, color: [0.7, 0.55, 0.5] });",
      "w.wall({ from: [12, -14], to: [12, -6], h: 1.4, thick: 0.4, color: [0.5, 0.6, 0.7] });",
      "for (var i = 0; i < 7; i++) w.add('crate', { pos: [-18 + i * 4.5, 0, 7 + (i % 3) * 3], name: 'crate_n' + i, size: 1.1 });",
      "for (var j = 0; j < 5; j++) w.add('crate', { pos: [-16 + j * 7, 0, -10 - (j % 2) * 6], name: 'crate_s' + j, size: 1.1 });",
      "for (var k = 0; k < 4; k++) w.add('barrel', { pos: [-4 + k * 2.2, 0, -4], name: 'barrel' + k });",
      "return { name: 'the yard' };"
    ].join("\n");

    const scene = engine.debug.scene();
    scene.use_deffered_rendering({ ENABLE_ATMOSPHERE: false, ENABLE_SHADOWS: q.get("shadows") !== "0" });
    scene.camera.control.distance = 30;
    engine.tra_model.yaw_pitch(scene.camera.control, 0.5, -0.9);

    let host = null;
    const draw_world = function () {                                                 // the host's boxes (walls, crates, barrels) into the engine's solid batch, once for each pass
      if (!host || !host.spec) return;
      host.spec.zones.forEach(function (z) {                                          // the zones' outlines on the ground: `north` (green) and `south` (blue), the whole yard is a third zone
        if (z.name === "yard") return;
        const r = z.rect, c = z.name === "north" ? [0.3, 0.9, 0.4] : [0.3, 0.6, 1.0], L = engine.debug_lines;
        L.color[0] = c[0]; L.color[1] = c[1]; L.color[2] = c[2];
        L.add_xyz(r[0], 0.04, r[1], r[2], 0.04, r[1]); L.add_xyz(r[2], 0.04, r[1], r[2], 0.04, r[3]); L.add_xyz(r[2], 0.04, r[3], r[0], 0.04, r[3]); L.add_xyz(r[0], 0.04, r[3], r[0], 0.04, r[1]);
      });
      host.each_box(function (p, qq, sx, sy, sz, c) {
        engine.solid_boxes.set_color(c[0], c[1], c[2]).add(p[0], p[1], p[2], sx, sy, sz, qq[0], qq[1], qq[2], qq[3]);
      });
    };
    scene.on_shadow_pass.add(function () { system.render_all(); engine.debug.render(); });
    scene.on_render_pass.add(function () { engine.debug.grid.render_ground(); system.render_all(); engine.debug.render(); });

    const crowd = [];                                                                // { h, kind, x0, z0, px, pz, path, moved_frames }
    const kinds = demo.kinds;
    const text_of = function (n) { return "/system/creatures/" + n + ".js"; };       // (the host fetches a url; a text that begins with a comment looks like a path to it, so urls are given)

    system.init({ table_bytes: 128 << 20, max_species: files.length + 4 });
    const t_start = performance.now();
    system.load("/system/system.bin", { all: true }).then(function () {
      host = system.world({ tolerant: true, on_event: function (fam, slot, gen, tag, value) { const k = fam + ":" + tag; demo.events[k] = (demo.events[k] || 0) + 1; } });          // (what the minds say: a tag of a block's event, counted)
      const creatures = {};
      files.forEach(function (n) { creatures[n] = text_of(n); });
      return host.load({ world_text: WORLD, creatures: creatures });
    }).then(function () {
      host.start();
      demo.skipped = host.skipped.slice();
      demo.world = { name: host.spec.name, boxes: host.spec.boxes.length, entities: host.spec.entities.length, zones: host.spec.zones.length, families: Object.keys(host.families), load_ms: Math.round(performance.now() - t_start) };
      // the crowd: spread over the yard, off the walls (the nav snaps a spawn that is in a wall onto the ground that can be stood on)
      Object.keys(host.families).forEach(function (fam) {
        const f = host.families[fam], blocks = ((f.def.mind && f.def.mind.blocks) || (f.cfg && f.cfg.mind && f.cfg.mind.blocks) || []).map(function (b) { return Array.isArray(b) ? b[0] : b; });
        kinds[fam] = { faction: f.cfg ? f.cfg.faction : null, mind: blocks, count: 0, alive: 0, moving: 0, walked: 0, displaced: 0, worst_walk: 0 };
        const n = fam === "zombie_walker" ? 1 : per;
        for (let i = 0; i < n; i++) {
          let x, z;
          if (fam === "zombie_walker") { x = 8; z = -8; } else if (q.get("close") === "1") { const a = rnd() * 6.28, d = 5 + rnd() * 4; x = 8 + Math.cos(a) * d; z = -8 + Math.sin(a) * d; } else { x = (rnd() - 0.5) * 36; z = (rnd() - 0.5) * 36; if (Math.abs(z) < 1.5) z += 3; }
          const h = host.spawn(fam, x, 0, z, rnd() * Math.PI * 2);
          if (h === null) continue;
          crowd.push({ h: h, kind: fam, x0: x, z0: z, px: x, pz: z, path: 0, speed: 0, pre_path: 0 });
          kinds[fam].count++;
        }
      });
      if (!crowd.length) { demo.error = "no creature could be spawned: " + JSON.stringify(host.skipped).slice(0, 500); demo.done = true; return; }

      let last = performance.now(), t_begin = last, sim = 0, sample_t = 0, scared = false, scare_pt = null, scare_list = [], scare_sim = 0;
      let frames_at_begin = 0, trace_t = 0, ordered = false;
      const zom = crowd.filter(function (c) { return c.kind === "zombie_walker"; })[0] || null, hostile = demo.hostile = zom ? { min_gap: 999, closest: null, near_samples: 0, deaths: 0, gap_trace: [] } : null;
      engine.on_frame_begin.add(function () {                                     // (before any pass: the boxes are queued and the passes draw them; debug.clear runs at the frame's end)
        demo.frames++;
        const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        host.update(dt);
        sim += dt; demo.sim_seconds = Math.round(sim * 10) / 10;
        draw_world();
        if (demo.done) return;
        // samples: where everybody is, how far the path went (the page measures; the minds decide)
        let sampled = false;
        if (now - sample_t > 150) {
          sampled = true;
          const step_dt = (now - sample_t) / 1000;
          sample_t = now;
          for (const k in kinds) { kinds[k].alive = 0; kinds[k].moving = 0; }
          crowd.forEach(function (c) {
            const r = host.by_handle[c.h], p = r ? host.where(c.h) : null;
            if (!p || r.sp.alive[r.c.slot] !== 1) return;
            kinds[c.kind].alive++;
            const d = Math.hypot(p[0] - c.px, p[2] - c.pz);
            if (d < 3) { c.path += d; c.speed = d / step_dt; }                       // (a jump of metres in one sample is a teleport of a spawn or a wall's push-out: not walking)
            if (c.speed > 0.15) kinds[c.kind].moving++;
            c.px = p[0]; c.pz = p[2]; c.y = p[1];
          });
        }
        if (sampled && zom) {                                                        // (right after a sample: the zombie's nearest neighbour, and who has died since)
          const zp = host.where(zom.h);
          let nearest = 999;
          if (zp) crowd.forEach(function (c) {
            if (c === zom || !host.by_handle[c.h]) return;
            const d = Math.hypot(c.px - zp[0], c.pz - zp[2]);
            if (d < hostile.min_gap) { hostile.min_gap = +d.toFixed(2); hostile.closest = c.kind; }
            if (d < 6) hostile.near_samples++;
            if (d < nearest) nearest = d;
          });
          if (zp && now - trace_t > 2000) { trace_t = now; hostile.gap_trace.push(+nearest.toFixed(1)); }
          hostile.deaths = crowd.filter(function (c) { const r = host.by_handle[c.h]; return !r || r.sp.alive[r.c.slot] !== 1; }).length;
        }
        if (zom && q.get("order") === "1" && !ordered && now - t_begin > seconds * 200) {      // (a probe: the page orders the zombie at the creature nearest a point: message 460)
          ordered = true;
          const v = crowd.filter(function (c) { return c.kind !== "zombie_walker"; })[0], r = host.by_handle[zom.h];
          r.sp.worker_msg(460, r.c.slot, v.px, v.pz); hostile.ordered_at = [v.kind, +v.px.toFixed(1), +v.pz.toFixed(1)];
        }
        if (do_scare && !scared && now - t_begin > seconds * 550) {                  // the scare: the page tells every mind message 390 (x, z) of a point (2 m from the first creature); a mind with the `flee` block runs from it
          scared = true;
          const first = crowd.filter(function (c) { return c.kind !== "zombie_walker"; })[0];
          scare_pt = [first.px + 2, first.pz];
          const d_all = [], d_near = [];
          crowd.forEach(function (c) {
            const r = host.by_handle[c.h];
            if (!r || c.kind === "zombie_walker" || r.sp.alive[r.c.slot] !== 1) return;
            r.sp.worker_msg(390, r.c.slot, scare_pt[0], scare_pt[1]);
            const d = Math.hypot(c.px - scare_pt[0], c.pz - scare_pt[1]);
            scare_list.push(c); c.pre_path = c.path; c.d0 = d; c.near = d < 12;
            if (d < 12) d_near.push(d);
          });
          scare_sim = sim;
          demo.scare = { at_sim: Math.round(sim * 10) / 10, point: [Math.round(scare_pt[0] * 10) / 10, Math.round(scare_pt[1] * 10) / 10], told: scare_list.length, near: d_near.length, near_before: d_near.reduce(function (a, b) { return a + b; }, 0) / (d_near.length || 1), near_after: null, ran_away_m: null, rate_before: scare_list.reduce(function (a, c) { return a + c.pre_path; }, 0) / scare_list.length / Math.max(1, sim), rate_after: null };
        }
        if (scared && demo.scare && now - t_begin > seconds * 800 && demo.scare.near_after === null) {
          let sn = 0, nn = 0, sp = 0;
          scare_list.forEach(function (c) { sp += c.path - c.pre_path; if (c.near) { sn += Math.hypot(c.px - scare_pt[0], c.pz - scare_pt[1]); nn++; } });
          demo.scare.near_after = nn ? sn / nn : -1;
          demo.scare.ran_away_m = nn ? demo.scare.near_after - demo.scare.near_before : 0;
          demo.scare.rate_after = sp / scare_list.length / Math.max(0.1, sim - scare_sim);          // (metres of path a second, per creature: before the scare and after it)
          demo.scare.window_sim = Math.round((sim - scare_sim) * 10) / 10;
        }
        if (now - t_begin > seconds * 1000) {
          const sums = {};
          crowd.forEach(function (c) {
            const o = sums[c.kind] || (sums[c.kind] = { path: 0, disp: 0, worst: 0, n: 0 });
            o.path += c.path; o.disp += Math.hypot(c.px - c.x0, c.pz - c.z0); o.worst = Math.max(o.worst, c.path); o.n++;
          });
          for (const k in sums) { kinds[k].walked = +(sums[k].path / sums[k].n).toFixed(2); kinds[k].displaced = +(sums[k].disp / sums[k].n).toFixed(2); kinds[k].worst_walk = +sums[k].worst.toFixed(2); }
          demo.host = host.stats();
          demo.worker_errors = (system.worker_errors || []).map(function (m) { return (m.what || "") + ": " + String(m.message || m).slice(0, 200); });
          demo.log = host.log().slice(-6);
          demo.real_seconds = Math.round((now - t_begin) / 100) / 10;
          demo.measured_frames = demo.frames - frames_at_begin;
          demo.done = true;
          console.log("happy.demo: " + crowd.length + " creatures lived in a world for " + demo.real_seconds + " s, they walked " + JSON.stringify(Object.keys(kinds).map(function (k) { return k + " " + kinds[k].walked; })));
        }
      });
    }).catch(function (e) { demo.error = String(e && e.stack || e); console.error("happy.demo: " + demo.error); demo.done = true; });
  }

  engine({})(ready);
});
