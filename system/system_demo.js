packing("@/engine.js", "@/system/system.js")(function (engine) {
  // THE SYSTEM'S DEMO PAGE (/system/system_demo.html): loads system.bin, puts a gait library and an action set in the creatures' hands (the page's and the worker's), makes a biped (12 bones, two legs, no mesh) and a person of the lite human and has them walk.
  // `window.happy_demo` is what a test reads.

  // a person of 12 bones: skeleton, rig (limits, the legs' chains), the legs (a gait of the library: `from`), the body (the mover), roles and traits, a few shapes of the physics proxy
  const BIPED = {"skeleton":[{"name":"hips","parent":null,"head":[0,0.76,0],"tail":[0,0.8400000000000001,0]},{"name":"spine","parent":"hips","head":[0,0.8400000000000001,0],"tail":[0,1,0]},{"name":"chest","parent":"spine","head":[0,1,0],"tail":[0,1.16,0]},{"name":"neck","parent":"chest","head":[0,1.16,0],"tail":[0,1.2640000000000002,0]},{"name":"head","parent":"neck","head":[0,1.2640000000000002,0],"tail":[0,1.4400000000000002,0]},{"name":"clav_l","parent":"chest","head":[0,1.136,0],"tail":[0.136,1.136,0],"mirror":"x"},{"name":"upper_l","parent":"clav_l","head":[0.136,1.136,0],"tail":[0.36000000000000004,1.136,0],"mirror":"x"},{"name":"fore_l","parent":"upper_l","head":[0.36000000000000004,1.136,0],"tail":[0.568,1.136,0],"mirror":"x"},{"name":"hand_l","parent":"fore_l","head":[0.568,1.136,0],"tail":[0.656,1.136,0],"mirror":"x"},{"name":"thigh_l","parent":"hips","head":[0.072,0.76,0],"tail":[0.072,0.41600000000000004,0],"mirror":"x"},{"name":"shin_l","parent":"thigh_l","head":[0.072,0.41600000000000004,0],"tail":[0.072,0.072,0],"mirror":"x"},{"name":"foot_l","parent":"shin_l","head":[0.072,0.072,0],"tail":[0.072,0.024,0.128],"mirror":"x"}],"rig":{"joints":[{"bone":"spine","fwd":40,"back":25,"lat":25,"twist":30},{"bone":"chest","fwd":30,"back":20,"lat":25,"twist":30},{"bone":"neck","fwd":50,"back":50,"lat":40,"twist":60},{"bone":"head","fwd":35,"back":45,"lat":35,"twist":50},{"bone":"clav_l","mirror":"x","up":30,"down":15,"fwd":20,"back":20,"twist":15},{"bone":"upper_l","mirror":"x","up":100,"down":110,"fwd":100,"back":50,"twist":[-90,90]},{"bone":"fore_l","mirror":"x","kind":"hinge","axis":[0,-1,0],"range":[0,150]},{"bone":"hand_l","mirror":"x","up":35,"down":35,"fwd":70,"back":70,"twist":40},{"bone":"thigh_l","mirror":"x","fwd":120,"back":25,"out":50,"in":30,"twist":[-40,40]},{"bone":"shin_l","mirror":"x","kind":"hinge","axis":[1,0,0],"range":[0,150]},{"bone":"foot_l","mirror":"x","fwd":30,"back":50,"lat":20,"twist":20}],"chains":[{"name":"head","bones":["spine","chest","neck","head"]},{"name":"arm_l","mirror":"x","bones":["spine","chest","clav_l","upper_l","fore_l"],"tip":"hand_l","pole":[0.3,-1,-0.3],"pole_w":0.5},{"name":"leg_l","mirror":"x","solver":"limb","bones":["thigh_l","shin_l"],"tip":"foot_l","pole":[0,0,1],"pole_w":1}]},"legs":{"legs":[{"chain":"leg_l","mirror":"x"}],"gait":{"from":"person_walk"},"slots":3},"body":{"accel":4,"gravity":9.8,"max_speed":4.5},"roles":{"hips":"hips","spine":["spine","chest"],"neck":["neck"],"head":"head","arms":[{"chain":"arm_l","mirror":"x"}]},"traits":{"head_yaw":50,"head_pitch":35,"neck_yaw":45,"neck_pitch":30},"physics":{"mass":45,"shapes":[{"id":"trunk","shape":"capsule","a":[0,0.8960000000000001,0],"b":[0,1.088,0],"radius":0.136,"bone":"spine"},{"id":"head","shape":"sphere","center":[0,1.36,0.016],"radius":0.09200000000000001,"bone":"head"},{"id":"leg","shape":"capsule","a":[0.072,0.68,0],"b":[0.072,0.16000000000000003,0],"radius":0.068,"mirror":"x"}]},"name":"biped","max_instances":16};

  function ready(engine) {
    const happy = engine, system = happy.system;
    const hash = function (text) { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0; return h; };
    const demo = window.happy_demo = { done: false, error: null, frames: 0 };
    const t0 = performance.now();
    system.init({ table_bytes: 64 << 20, max_species: 16 });
    system.load("/system/system.bin").then(function () {
      demo.loaded_ms = performance.now() - t0;
      demo.size = system.size;
      demo.sections = system.sections().length;
      demo.libraries = system.gaits.libraries();
      demo.sets = system.actions.sets();
      return system.use({ gaits: ["people"], actions: ["designed_basic"] });
    }).then(function (used) {
      demo.used = used;
      return Promise.all(["people", "corpus_quadrupeds"].map(function (n) { return system.gaits.library(n); }).concat(["designed_basic", "corpus_quadrupeds"].map(function (n) { return system.actions.set(n); })));
    }).then(function (files) {
      demo.hashes = { "gaits.people": hash(JSON.stringify(files[0])), "gaits.corpus_quadrupeds": hash(JSON.stringify(files[1])), "actions.designed_basic": hash(JSON.stringify(files[2])), "actions.corpus_quadrupeds": hash(JSON.stringify(files[3])) };
      demo.counts = { styles: files[0].gaits.length + files[1].gaits.length, actions: files[2].actions.length + files[3].actions.length };
      demo.pack_ms = performance.now() - t0;
      // walkers: a biped of 12 bones (no mesh) and a lite person (the pack's human model: about 8,000 triangles, a skeleton of its own); the gait is the library's, the legs and the body are the worker's
      const t1 = performance.now();
      return system.human({ model: "lite" }, { name: "person" }).then(function (person) {
        demo.person = { ms: performance.now() - t1, bones: person.skeleton.length, vertices: person.mesh.positions.length / 3, triangles: person.mesh.indices.length / 3, info: system.human_info({ model: "lite" }) };
        demo.walkers = {};
        const walkers = [];
        const add = function (name, def, x) {
          const sp = system.species(Object.assign({}, def, { max_instances: 4 })), c = sp.spawn({ x: x, y: 0, z: 0, scale: 1, yaw: 0 });
          sp.set_intent(c, 0, 1.4, 0, 0);
          const names = def.skeleton.map(function (b) { return b.name; });
          const root = names.indexOf("hips") >= 0 ? "hips" : names[0];
          const foot = names.filter(function (n) { return /foot/i.test(n) && /(_l|\.l|left)$/i.test(n); })[0] || names.filter(function (n) { return /foot/i.test(n); })[0];
          const w = demo.walkers[name] = { frames: 0, root: root, foot: foot, hips: [], foot_z: [], moved: 0 };
          walkers.push({ sp: sp, c: c, w: w });
        };
        add("biped", BIPED, -1);
        add("person", person, 1);
        const started = performance.now();
        engine.on_frame.add(function () {
          system.render_all();
          demo.frames++;
          if (demo.done || demo.frames % 4 !== 0) return;
          walkers.forEach(function (k) {
            const h = k.sp.bone_world(k.c, k.w.root), f = k.w.foot ? k.sp.bone_world(k.c, k.w.foot) : null;
            if (!h || (k.w.foot && !f) || !(h[1] > 0)) return;
            k.w.frames++; k.w.hips.push(h[2]); k.w.foot_z.push(f ? f[2] - h[2] : 0); k.w.moved = h[2] - k.w.hips[0];
          });
          if (walkers.every(function (k) { return k.w.moved > 2 && k.w.frames > 12; }) || performance.now() - started > 40000) {
            demo.walk_ms = performance.now() - started; demo.worker_loaded = system.worker_loaded || null; demo.worker_errors = system.worker_errors || [];
            console.log("happy.system: a biped walked " + demo.walkers.biped.moved.toFixed(2) + " m, a person " + demo.walkers.person.moved.toFixed(2) + " m");
            demo.done = true;
          }
        });
      });
    }).catch(function (e) { demo.error = String(e && e.stack || e); console.error("happy.system: " + demo.error); demo.done = true; });
  }

  engine({})(ready);
});
