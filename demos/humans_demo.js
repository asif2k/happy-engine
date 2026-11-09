packing("@/engine.js", "@/debug.js", "@/system/system.js")(function (engine, dom, httprequest) {
  // HUMANS DEMO (/demos/humans_demo.html): a lineup of procedural people of the LITE HUMAN (system.human({ model: "lite", shape, look, clothes, hair, brows, beard, mutate })), side by side on the grid floor: different bodies
  // (gender, age, muscle, weight, height, the three races, face sliders), skins (look), clothes, hair, beards, children, a mutated one. Each person is its own species (its own mesh), one instance each. Some walk (in place,
  // the treadmill: the gait takes the speed), some stand.
  // Left drag turns the camera, right drag pans, the wheel zooms.
  //   ?n=12      how many of the lineup (1 .. 12)     ?rows=2     rows of the lineup     ?walk=1     0: they all stand, 1: every other one walks, 2: all walk      ?speed=1.1     m/s of the walkers 
  //   ?gap=1.5   metres between two      ?stats=1   the engine's numbers panel      ?atmosphere=1     the sky      ?shadows=0     no shadows      ?wire=1     wireframe
  // `window.happy_demo` is what a test reads: { done, error, people: [{ name, ok, triangles, bones, years, height, notes, error }], built, frames, walked: [metres each walker went in its place (0 = in place; the feet
  // move, the body stays)], moving: how many walkers' skeletons moved (the hips' height changed or the feet's), notes: [the human's own notes] }.
  const CAT = "caucasian", AFR = "african", ASN = "asian";

  // the lineup: [label, human def]. Colours are linear 0 .. 1.
  const LINEUP = [
    ["young man, tshirt + jeans, short hair", { shape: { gender: 1, age: 0.4, muscle: 0.55, weight: 0.5, height: 0.6, african: 0.1, asian: 0.1, caucasian: 0.8 }, look: { tone: 0.2, undertone: 0.1, ruddy: 0.3 },
      clothes: [{ kind: "tshirt", colour: [0.1, 0.25, 0.55] }, { kind: "jeans", colour: [0.1, 0.13, 0.25] }, { kind: "shoes", colour: [0.06, 0.06, 0.06] }], hair: { style: "short", colour: "dark_brown" }, brows: true }],
    ["woman, long hair, dress", { shape: { gender: 0, age: 0.38, muscle: 0.3, weight: 0.4, height: 0.5, african: 0.05, asian: 0.05, caucasian: 0.9, bust_firmness: 0.6 }, look: { tone: 0.12, undertone: -0.1, ruddy: 0.35 },
      clothes: [{ kind: "dress", colour: [0.65, 0.12, 0.2] }, { kind: "shoes", colour: [0.2, 0.08, 0.05] }], hair: { style: "long", colour: "blonde" }, brows: true }],
    ["big bearded man, jacket", { shape: { gender: 1, age: 0.58, muscle: 0.8, weight: 0.85, height: 0.75, african: 0.05, asian: 0.05, caucasian: 0.9 }, look: { tone: 0.3, undertone: 0.2, ruddy: 0.5 },
      clothes: [{ kind: "jacket", colour: [0.35, 0.22, 0.1] }, { kind: "trousers", colour: [0.15, 0.15, 0.17] }, { kind: "boots", colour: [0.08, 0.06, 0.05] }], hair: { style: "crop", colour: "red" }, beard: { style: "full", colour: "ginger" }, brows: { thick: 0.9 } }],
    ["tall dark woman, afro", { shape: { gender: 0, age: 0.36, muscle: 0.5, weight: 0.35, height: 0.9, african: 0.9, asian: 0.02, caucasian: 0.08 }, look: { tone: 0.88, undertone: 0.2, ruddy: 0.2 },
      clothes: [{ kind: "tank", colour: [0.9, 0.75, 0.1] }, { kind: "skirt", colour: [0.1, 0.4, 0.35] }, { kind: "shoes", colour: [0.9, 0.9, 0.9] }], hair: { style: "afro", colour: "black" }, brows: true }],
    ["old man, sweater, grey moustache, bald", { shape: { gender: 1, age: 0.93, muscle: 0.15, weight: 0.45, height: 0.35, african: 0, asian: 0.2, caucasian: 0.8 }, look: { tone: 0.35, undertone: 0.3, ruddy: 0.2 },
      clothes: [{ kind: "sweater", colour: [0.45, 0.4, 0.3] }, { kind: "trousers", colour: [0.25, 0.25, 0.28] }, { kind: "shoes", colour: [0.1, 0.08, 0.06] }], hair: "bald", beard: { style: "walrus", colour: "grey" }, brows: { colour: "grey" } }],
    ["child, shorts, pony tail", { shape: { gender: 0, age: 0.13, muscle: 0.3, weight: 0.4, height: 0.5, african: 0.2, asian: 0.5, caucasian: 0.3 }, look: { tone: 0.5, undertone: 0.5, ruddy: 0.3 },
      clothes: [{ kind: "tshirt", colour: [0.9, 0.4, 0.5] }, { kind: "shorts", colour: [0.2, 0.3, 0.6] }, { kind: "shoes", colour: [0.9, 0.9, 0.9] }], hair: { style: "ponytail", colour: "black" }, brows: true }],
    ["teen boy, beanie, hoodie-like coat", { shape: { gender: 1, age: 0.27, muscle: 0.3, weight: 0.35, height: 0.55, african: 0.3, asian: 0.2, caucasian: 0.5 }, look: { tone: 0.55, undertone: 0.4, ruddy: 0.2 },
      clothes: [{ kind: "coat", colour: [0.15, 0.4, 0.2], length: 0.4 }, { kind: "jeans", colour: [0.12, 0.12, 0.2] }, { kind: "beanie", colour: [0.8, 0.2, 0.1] }, { kind: "shoes", colour: [0.9, 0.9, 0.9] }], brows: true }],
    ["heavy woman, robe-like tunic, bob", { shape: { gender: 0, age: 0.62, muscle: 0.3, weight: 0.95, height: 0.4, african: 0.3, asian: 0.4, caucasian: 0.3 }, look: { tone: 0.6, undertone: 0.5, ruddy: 0.25 },
      clothes: [{ kind: "tunic", colour: [0.25, 0.55, 0.6] }, { kind: "trousers", colour: [0.9, 0.85, 0.7] }, { kind: "shoes", colour: [0.3, 0.2, 0.15] }], hair: { style: "bob", colour: "auburn" }, brows: true }],
    ["asian man, vest, mohawk", { shape: { gender: 1, age: 0.45, muscle: 0.7, weight: 0.3, height: 0.5, african: 0, asian: 1, caucasian: 0 }, look: { tone: 0.42, undertone: 0.6, ruddy: 0.15 },
      clothes: [{ kind: "vest", colour: [0.12, 0.12, 0.14] }, { kind: "shorts", colour: [0.45, 0.35, 0.2] }, { kind: "boots", colour: [0.1, 0.1, 0.1] }], hair: { style: "mohawk", colour: "black" }, beard: { style: "goatee", colour: "black" }, brows: true }],
    ["MUTATED person (reptile, seed 7)", { shape: { gender: 1, age: 0.45, muscle: 0.6, weight: 0.5, height: 0.65 }, look: { tone: 0.35, undertone: 0, ruddy: 0.2 }, clothes: [{ kind: "shorts", colour: [0.3, 0.2, 0.1] }], hair: "bald", mutate: { seed: 7, iterations: 8, strength: 0.6, toward: "reptile" } }],
    ["MUTATED person (brute, seed 3)", { shape: { gender: 1, age: 0.5, muscle: 0.9, weight: 0.7, height: 0.8 }, look: { tone: 0.55, undertone: 0.3, ruddy: 0.4 }, clothes: [{ kind: "trousers", colour: [0.25, 0.2, 0.15] }], hair: "bald", mutate: { seed: 3, iterations: 6, strength: 0.6, toward: "brute" } }],
    ["woman, coat, bun", { shape: { gender: 0, age: 0.5, muscle: 0.35, weight: 0.5, height: 0.45, african: 0.1, asian: 0.3, caucasian: 0.6 }, look: { tone: 0.38, undertone: 0.4, ruddy: 0.2 },
      clothes: [{ kind: "coat", colour: [0.5, 0.1, 0.3] }, { kind: "boots", colour: [0.1, 0.07, 0.05] }], hair: { style: "bun", colour: "chestnut" }, brows: true }]
  ];

  function ready(engine) {
    const system = engine.system;
    const q = new URLSearchParams(location.search);
    const n = Math.max(1, Math.min(LINEUP.length, +(q.get("n") || 12))), rows = Math.max(1, +(q.get("rows") || 2)), cols = Math.ceil(n / rows), walk = q.get("walk") === null ? 1 : +q.get("walk"), speed = +(q.get("speed") || 1.1), gap = +(q.get("gap") || 1.6);
    const demo = window.happy_demo = { done: false, error: null, people: [], built: 0, frames: 0, walked: [], moving: 0, notes: [] };

    if (window.PR$ && q.get("stats") !== "1") window.PR$.style.display = "none";
    const scene = engine.debug.scene();
    scene.use_deffered_rendering({ ENABLE_ATMOSPHERE: q.get("atmosphere") === "1", ENABLE_SHADOWS: q.get("shadows") !== "0" });
    scene.on_shadow_pass.add(function () { system.render_all(); engine.debug.render(); });
    scene.on_render_pass.add(function () { engine.debug.grid.render_ground(); system.render_all(); engine.debug.render(); });
    const width = (cols - 1) * gap + (rows > 1 ? gap / 2 : 0);
    scene.camera.update_perspective(0.05, 1500, 60);
    scene.camera.control.distance = Math.max(3, width * 0.55 + 2.0 + rows * 0.5);
    engine.tra_model.yaw_pitch(scene.camera.control, 0.0, -0.33);
    engine.tra_model.set_position(scene.camera.control, 0, 0.9, 0);

    const stands = [];
    system.init({ table_bytes: 128 << 20, max_species: n + 4 });
    system.load("/system/system.bin", { all: true }).then(function () {
      let chain = Promise.resolve();
      for (let i = 0; i < n; i++) (function (i) {
        chain = chain.then(function () {
          const label = LINEUP[i][0], d = JSON.parse(JSON.stringify(LINEUP[i][1]));
          d.model = "lite";
          const rec = { name: label, ok: false };
          demo.people.push(rec);
          return system.human(d, { name: "person" + i }).then(function (def) {
            def.max_instances = 1;
            const legs = Object.assign({}, def.legs);
            def.legs = legs;
            const sp = system.species(def);
            if (q.get("wire") === "1") sp.set_wireframe(true);
            const col = i % cols, row = Math.floor(i / cols), x = -width / 2 + col * gap + (row % 2 ? gap / 2 : 0), z = -row * 1.8, walks = walk === 2 || (walk === 1 && i % 2 === 0);
            const c = sp.spawn({ x: x, y: 0, z: z, scale: 1, yaw: 0 });
            if (walks) sp.set_treadmill(c, 0, speed);
            const info = system.human_info ? system.human_info(def) : null;
            rec.ok = true; rec.walks = walks;
            rec.triangles = def.mesh ? def.mesh.indices.length / 3 : 0; rec.bones = def.skeleton.length;
            rec.height = info && info.height !== undefined ? +info.height.toFixed(2) : undefined;
            rec.years = info && info.years !== undefined ? Math.round(info.years) : undefined;
            if (def.notes && def.notes.length) { rec.notes = def.notes.slice(0, 3); def.notes.forEach(function (t) { if (demo.notes.indexOf(t) < 0 && demo.notes.length < 12) demo.notes.push(String(t).slice(0, 160)); }); }
            stands.push({ sp: sp, c: c, x0: x, walks: walks, root: def.skeleton[0].name, y0: null, ymin: 1e9, ymax: -1e9, z0: 0, label: label });
            demo.built++;
          }).catch(function (e) { rec.error = String(e && e.message || e).slice(0, 240); });
        });
      })(i);
      return chain;
    }).then(function () {
      if (!demo.built) { demo.error = "no person could be made: " + JSON.stringify(demo.people).slice(0, 500); demo.done = true; return; }
      engine.on_frame.add(function () {
        demo.frames++;
        if (demo.frames > 20 && demo.frames % 5 === 0) stands.forEach(function (k) {                 // (the root bone's height over the frames: a walker's hips bob)
          let p = null; try { p = k.sp.bone_world(k.c, k.root); } catch (e) { p = null; }
          if (p) { if (k.y0 === null) { k.y0 = p[1]; k.xs = p[0]; k.zs = p[2]; } k.ymin = Math.min(k.ymin, p[1]); k.ymax = Math.max(k.ymax, p[1]); k.dx = Math.hypot(p[0] - k.xs, p[2] - k.zs); }
        });
        if (demo.frames === 140 && !demo.done) {
          demo.walked = stands.filter(function (k) { return k.walks; }).map(function (k) { return +(k.dx || 0).toFixed(3); });
          demo.moving = stands.filter(function (k) { return k.walks && k.ymax - k.ymin > 0.004; }).length;
          demo.bob = stands.filter(function (k) { return k.walks; }).map(function (k) { return +((k.ymax - k.ymin) * 100).toFixed(1); });
          demo.done = true;
          console.log("happy.demo: " + demo.built + " people, " + demo.moving + " walkers whose hips bob");
        }
      });
    }).catch(function (e) { demo.error = String(e && e.stack || e); console.error("happy.demo: " + demo.error); demo.done = true; });
  }

  engine({})(ready);
});
