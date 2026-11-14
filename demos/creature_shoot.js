packing("@/engine.js", "@/debug.js", "@/system/system.js", "@/particles/gpu_particles.js")(function (engine, dom, httprequest) {
  // THE SHOOTING RANGE (/demos/creature_shoot.html): an empty scene and a list. Choose a creature file in the SIDEBAR and press ADD: that many of it come into the scene at random places (walking on their own minds when the file has one),
  // and you shoot them. LEFT CLICK (without dragging) on a creature: the ray of the mouse is shot into the creatures' hit zones (system.shoot, a hitscan from the camera through the mouse); the one under it takes the hit (its hit zone loses
  // health, a hard shove brings it down, its `health` block loses the same hit points and it dies at 0) and bleeds (particles/gpu_particles.js, at the point of the hit). Drag turns the camera, right drag pans, the wheel zooms.
  //   one species a file (a second ADD of a file brings more of the same species, up to MAX_PER of it in all); a file that has no mind or that the system cannot give hit zones to is added as far as it goes, and the status line says what it could not.
  //   window.happy_creature_shoot = { add(name, count) -> Promise, clear(), species: { file: { sp, list } }, shots, hits, died, last, ready } is what a test reads.
  const MAX_PER = 64, AREA = 10, RANGE = 200, HURT_MSG = 7001;       // (instances of a file at most; the half side of the square they are put in; how far the ray goes; the `health` block's message)
  const SHOT = { damage: 10, impulse: 16 };                           // (the shot: what it takes from a zone and from the mind's hit points (the sidebar's POWER), the momentum it shoves with in kg m/s (IMPULSE: a pistol's bullet is about 3, a rifle's 8, a blast's thousands))
  const FOLDER = "/system/creatures/";
  // the files of system/creatures/ (the page cannot list a folder): [file, what it is]
    const FILES = [
    ["ant", "an insect on six legs"], ["bear", "a brown bear"], ["bird", "a small bird that walks and flies"],
    ["black_widow", "a black widow, a spider of eight legs"], ["bolt", "a helper robot"], ["brawler", "a boxer"],
    ["drone", "a quadcopter"], ["elephant", "an elephant with a trunk"], ["excavator", "a tracked excavator"],
    ["fat_monster", "a swamp ogre with soft tissue"], ["fly", "a big blowfly: six legs, a hover and soft tissue on an sdf body"], ["gator_dog", "an alligator dog, built of pieces"],
    ["horse", "a bay horse"], ["huntsman", "a huntsman spider, flat and sprawling"], ["jeep", "an open car with doors"],
    ["jet", "a small jet"], ["jumping_spider", "a jumping spider that leaps on its prey"], ["knight", "an armoured knight"],
    ["orb_weaver", "an orb weaver, a timid banded spider"], ["spider", "a big hunting spider on eight legs"], ["tarantula", "a heavy tarantula"],
    ["transformer", "a giant robot with gaits and actions of its own"], ["walker", "a bird legged mech"], ["wolf_spider", "a fast wolf spider"],
    ["android", "a humanoid robot that shoots, punches and kicks"], ["robo_hound", "a robot dog on four legs"], ["crawler", "a six legged robot with a stinger tail"],
    ["hopper", "a robot on spring legs that hops"], ["rover", "a six wheeled exploration rover with two arms"], ["tank_bot", "a tracked robot with a turret and a gun"],
    ["sentinel", "a hovering orb with a lens and two rings"],
    // the big birds of system/birds.js: three that fly, two runners
    ["andean_condor", "an Andean condor: black with a white collar, a high soarer"], ["emu", "an emu: a tall flightless runner"],
    ["golden_eagle", "a golden eagle: a brown raptor that soars and stoops"], ["ostrich", "an ostrich: a giant flightless runner"],
    ["sarus_crane", "a sarus crane: the tallest flying bird, grey with a red head"]
  ];
  // the animals of the library that are files of system/creatures/ (system/export_animals.js writes them)
  const ANIMALS = [
    ["a_3drt_safari_animals_tiger_own_7239", "Tiger, 0.95 m, predator"], ["aardwolf_hyena_lowpoly_own_86c3", "Hyena, 0.5 m, pack hunter"], ["african_bush_elephant_own_c3d7", "Elephant, 3 m, giant"],
    ["african_civet_animal_lowpoly_own_ba0e", "Civet, 0.3 m, small"], ["american_badger_gameready_own_3642", "Badger, 0.3 m, small"], ["antelope_impala_old_own_7f53", "Impala, 0.9 m, herbivore"],
    ["arctic_polar_fox_summer_lowpoly_own_a7c5", "Fox, 0.3 m, small"], ["asian_zebu_cattle_low_poly_own_ad4a", "Cattle, 1.3 m, herbivore"], ["bat_eared_fox_animal_lowpoly_own_f96b", "Fox, 0.3 m, small"],
    ["bear_animated_own_8186", "Bear, 1 m, bear"], ["bear_big_own_fb80", "Bear, 1.1 m, bear"], ["black_bear", "Black bear, 0.9 m, bear"],
    ["black_footed_ferret_endangered_own_30d4", "Ferret, 0.1 m, small"], ["black_jaguar_own_815b", "Jaguar, 0.7 m, predator"], ["bull_animations_own_975e", "Cattle, 1.4 m, herbivore"],
    ["bunny_animations_own_a551", "Rabbit, 0.25 m, small"], ["calf_own_573c", "Cattle (young), 0.9 m, herbivore"], ["caspian_tiger_own_8e6f", "Tiger, 1 m, predator"],
    ["chipmunk_tamias_lowpoly_own_a747", "Chipmunk, 0.07 m, small"], ["clouded_leopard_own_7de0", "Clouded leopard, 0.5 m, predator"], ["cow_animations_own_6a1c", "Cattle (female), 1.4 m, herbivore"],
    ["deer_doe_own_5bee", "Deer (female), 0.95 m, herbivore"], ["deer_red_own_2eb3", "Deer, 1.2 m, herbivore"], ["deer_stag_own_9490", "Deer (male), 1.2 m, herbivore"],
    ["desert_bighorn_sheep_lowpoly_own_7195", "Sheep, 0.8 m, herbivore"], ["diary_cattle_lowpoly_own_db8c", "Cattle, 1.4 m, herbivore"], ["domestic_cattle_oxen_lowpoly_own_9f3b", "Cattle, 1.4 m, herbivore"],
    ["domestic_yak_lowpoly_own_77b8", "Yak, 1.4 m, herbivore"], ["eastern_bongo_male_antelope_endangered_own_e4b1", "Bongo (male), 1.2 m, herbivore"], ["ethiopian_wolf_own_d330", "Wolf, 0.6 m, pack hunter"],
    ["eurasian_gray_wolf_own_953b", "Wolf, 0.78 m, pack hunter"], ["european_bison_calf_lowpoly_own_52e7", "Bison (young), 0.9 m, herbivore"], ["european_polecat_lowpoly_own_5fe7", "Ferret, 0.12 m, small"],
    ["fanged_mouse_deer_animal_lowpoly_own_dd6d", "Mouse deer, 0.25 m, small"], ["female_southern_african_lion_endangered_own_30b0", "Lion (female), 1 m, predator"], ["fennec_fox_low_poly_own_a544", "Fox, 0.2 m, small"],
    ["foal_horse_lowpoly_own_e2ff", "Horse (young), 1 m, herbivore"], ["fox_cub_own_6d4f", "Fox (young), 0.2 m, small"], ["fox_squirrel_lowpoly_own_5082", "Squirrel, 0.12 m, small"],
    ["goat_own_1304", "Goat, 0.75 m, herbivore"], ["hare_young_own_6f70", "Rabbit (young), 0.2 m, small"], ["hippopotamus_own_56a1", "Hippo, 1.5 m, giant"],
    ["horse_own_30cf", "Horse, 1.55 m, mount"], ["hyena_own_951b", "Hyena, 0.75 m, pack hunter"], ["indian_gray_wolf_gameready_own_5c83", "Wolf, 0.78 m, pack hunter"],
    ["jaguar", "Jaguar, 0.7 m, predator"], ["jaguar_lowpoly", "Jaguar (light), 0.7 m, predator"], ["llama_lowpoly_own_2996", "Llama, 1.2 m, herbivore"],
    ["malayan_gaur_indian_bison_endangered_own_f0f2", "Bison, 1.8 m, herbivore"], ["male_african_lion_mr_big_endangered_own_4717", "Lion (male), 1.2 m, predator"], ["medhue_camel_own_d65b", "Camel, 1.9 m, herbivore"],
    ["medhue_raccoon_own_719c", "Raccoon, 0.3 m, small"], ["medhue_tiger_own_90bd", "Tiger, 0.95 m, predator"], ["miniature_pig_animal_lowpoly_own_bb4f", "Pig, 0.4 m, herbivore"],
    ["moose_bull_own_6046", "Moose (male), 1.9 m, herbivore"], ["moose_calf_own_9a22", "Moose (young), 1 m, herbivore"], ["moose_cow_own_6e9a", "Moose (female), 1.7 m, herbivore"],
    ["okapi_forest_giraffe_low_poly_own_81ad", "Giraffe, 3 m, giant"], ["opossum_didelphidae_lowpoly_own_9dac", "Opossum, 0.2 m, small"], ["otter", "Otter, 0.3 m, small"],
    ["owl", "Owl, 0.244 m, bird"], ["ox_bull_animal_low_poly_own_71bd", "Cattle (male), 1.4 m, herbivore"], ["oxford_sandy_and_black_pig_lowpoly_own_bb53", "Pig, 0.9 m, herbivore"],
    ["parasaurolophus", "Parasaurolophus, 3.039 m, dinosaur"], ["polar_bear_own_2b0f", "Bear, 1.3 m, bear"], ["rabbit_animations_own_e9d5", "Rabbit, 0.25 m, small"],
    ["reindeer_own_fa54", "Reindeer, 1.1 m, herbivore"], ["rhino", "Rhinoceros, 1.8 m, giant"], ["rhino_white_own_3ab9", "Rhino, 1.8 m, giant"],
    ["rocky_mountain_elk_stag_own_4d27", "Elk (male), 1.5 m, herbivore"], ["sauropod", "Sauropod, 4.341 m, dinosaur"], ["snow_leopard_own_af91", "Snow leopard, 0.6 m, predator"],
    ["south_african_lion_own_f9af", "Lion, 1.1 m, predator"], ["spanish_bull_cattle_animal_low_poly_own_696d", "Cattle (male), 1.4 m, herbivore"], ["squirrel_monkeys_saimiri_game_ready_own_c1ad", "Monkey, 0.2 m, small"],
    ["striped_hyena_male_animal_lowpoly_own_0461", "Hyena (male), 0.7 m, pack hunter"], ["suffolk_sheep_lowpoly_own_9d84", "Sheep, 0.8 m, herbivore"], ["texas_longhorn_cattle_lowpoly_own_9336", "Cattle, 1.4 m, herbivore"],
    ["trex", "Tyrannosaurus, 3.9 m, dinosaur"], ["vietnamese_pig_lowpoly_own_6002", "Pig, 0.5 m, herbivore"], ["water_buffalo_own_5270", "Buffalo, 1.5 m, herbivore"],
    ["white_rhinoceros_own_f56e", "Rhino, 1.8 m, giant"], ["wild_boar_young_own_3fda", "Pig (young), 0.5 m, herbivore"], ["wildebeest_own_ddc7", "Wildebeest, 1.35 m, herbivore"],
    ["wolf_animations_own_3620", "Wolf, 0.78 m, pack hunter"], ["wombat", "Wombat, 0.4 m, small"], ["wombat_joey_animal_game_ready_own_1585", "Wombat (young), 0.2 m, small"],
    ["wood_bison_endangered_own_66b5", "Bison, 1.7 m, herbivore"], ["zebra_old_own_af62", "Zebra, 1.35 m, herbivore"], ["zebra_poly_own_fbd7", "Zebra, 1.35 m, herbivore"]
  ];
  const el = function (tag, css, text) { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text !== undefined) e.textContent = text; return e; };
  const FIELD = "background:#222;color:#ddd;border:1px solid #444;font:11px monospace;padding:1px 3px;box-sizing:border-box";

  function ready(engine) {
    const system = engine.system;
    const scene = engine.debug.scene(), camera = scene.camera, canvas = engine.webgl.canvas;
    scene.use_deffered_rendering();

    // the dots where the shots ended (red on a creature, grey on nothing) for a moment
    const marks = [];
    const draw_marks = function () {
      const now = performance.now();
      for (let i = marks.length - 1; i >= 0; i--) {
        if (now > marks[i].until) { marks.splice(i, 1); continue; }
        engine.debug_points.add(marks[i].x, marks[i].y, marks[i].z, marks[i].hit ? 1 : 0.6, marks[i].hit ? 0.2 : 0.6, 0.2, 2);
      }
    };

    engine.phy.set_world({ gravity: [0, -9.81, 0], solver_iterations: 16 });                              // (the physics world the creatures fall in: this engine has no physics test bed)
    scene.camera.control.distance = 22; engine.tra_model.yaw_pitch(scene.camera.control, 0.45, -0.5); engine.tra_model.set_position(scene.camera.control, 0, 1, 0);
    scene.on_shadow_pass.add(function () {
      system.render_all();
      engine.debug.render();
    });
    scene.on_render_pass.add(function () {
      engine.debug.grid.render_ground();
      system.render_all();
      draw_marks();
      engine.debug.render();
    });

    // BLOOD: one soft alpha system with two emitters that only burst: droplets that fly out the way the shot went, fall and die at the ground, and a short red mist
    const gp = engine.gpu_particles;
    gp.attach(scene.dfd);
    const blood_system = gp.create({ capacity: 16384, blend: "alpha", depth_fade: 0.1 });
    const droplets = blood_system.emitter("droplets", { rate: 0, lifetime: [0.5, 1.2], speed: [1.5, 5], direction: [0, 1, 0], spread: 60, shape: "point", size: [0.05, 0.03], size_random: 0.5,
      color: [[0.62, 0.02, 0.03, 0.95], [0.38, 0.0, 0.02, 0.9], [0.22, 0.0, 0.01, 0.0]], gravity: [0, -9.8, 0], drag: 0.25, stretch: 0.03, collide: "die", ground: 0 });
    const mist = blood_system.emitter("mist", { rate: 0, lifetime: [0.25, 0.6], speed: [0.3, 1.4], direction: [0, 1, 0], spread: 90, shape: "sphere", extent: 0.03, size: [0.12, 0.32], size_random: 0.4,
      color: [[0.55, 0.0, 0.02, 0.4], [0.3, 0.0, 0.01, 0.0]], gravity: [0, -1, 0], drag: 1.2 });
    const bleed = function (x, y, z, d) {                                                                  // d: the way the shot went (the blood leaves that way, a little upward)
      const out = [d[0], d[1] * 0.5 + 0.5, d[2]];
      droplets.set({ direction: out }); mist.set({ direction: out });
      droplets.burst(70, x, y, z, d[0] * 1.5, 0.5, d[2] * 1.5, 1);
      mist.burst(14, x, y, z, 0, 0, 0, 1);
    };

    system.init({ table_bytes: 256 << 20, max_species: 64 });
    const range = window.happy_creature_shoot = { species: {}, shots: 0, hits: 0, died: 0, last: null, ready: null, status: "" };
    const ui = {};
    const say = function (m, bad) { range.status = m; if (ui.status) { ui.status.textContent = m; ui.status.style.color = bad ? "#f88" : "#9fd"; } };
    const show_stats = function () { if (ui.stats) ui.stats.textContent = "shots " + range.shots + "   hits " + range.hits + "   died " + range.died + "   creatures " + count_all(); };
    const count_all = function () { let n = 0; for (const k in range.species) n += range.species[k].list.length; return n; };

    // ---- shooting: the camera's position and the way the mouse points (the debug scene keeps camera.mouse_ray up to date) are the ray
    const shoot = function () {
      const o = camera.world_position, r = camera.mouse_ray, l = Math.sqrt(r[0] * r[0] + r[1] * r[1] + r[2] * r[2]) || 1, d = [r[0] / l, r[1] / l, r[2] / l], from = [o[0], o[1], o[2]];
      if (!d.every(isFinite) || !from.every(isFinite)) return;                                           // (no mouse position yet: the ray is not known)
      range.shots++;
      const damage = SHOT.damage;
      system.shoot({ from: from, dir: d, range: RANGE, impulse: SHOT.impulse, damage: damage }, function (shot) {
        range.last = { hit: shot.hit, distance: shot.distance, slot: shot.slot };
        const x = from[0] + d[0] * shot.distance, y = from[1] + d[1] * shot.distance, z = from[2] + d[2] * shot.distance;
        marks.push({ x: x, y: y, z: z, hit: shot.hit, until: performance.now() + 600 });
        if (shot.hit && shot.sp) {
          range.hits++;
          bleed(x, y, z, d);
          shot.sp.worker_msg(HURT_MSG, shot.slot, damage, -1);                                            // (the mind's hit points: the zone's health is the hit zone's own)
        }
        show_stats();
      });
    };
    // the engine's own mouse state (the canvas' events do not reach a listener of the page the way they do the engine): a click is `mouse_click_buttons === 1`, and a drag (the camera orbiting) is moving with the button down
    const elm = engine.webgl.elm, orig_mouse_drag = elm.mouse_drag;
    let drag_px = 0, prev_down = -1;
    elm.mouse_drag = function (dx, dy, e) { if (canvas.mouse_down_buttons > 0) drag_px += Math.abs(dx) + Math.abs(dy); if (orig_mouse_drag) orig_mouse_drag.call(elm, dx, dy, e); };
    engine.on_frame.add(function () {
      const down = canvas.mouse_down_buttons;
      if (down === 1 && prev_down !== 1) drag_px = 0;
      if (canvas.mouse_click_buttons === 1) { if (drag_px < 6) shoot(); drag_px = 0; }
      prev_down = down;
    });

    // ---- bringing creatures in
    // The worker's world is one spec for every creature: the nav profiles of the files that came so far (it is installed again when a new file brings its own), no zones, no relations.
    const agents = {};
    const world = function () {
      return { format: "system-world", version: 1, name: "range", nav: { cell: 0.25, bounds: [-32, -32, 32, 32], agents: Object.assign({}, agents), default_agent: "person" }, ground: { y: 0 }, terrain: {},
        boxes: [], stairs: [], ramps: [], links: [], doors: [], zones: [], scenes: [], entities: [], slots: [], bindings: [], spawn_rules: [], required_blocks: [], gives: [], block_params: {}, keys: [], relations: [], roles: [] };
    };
    const url_of = function (x) { return /[\/.]/.test(x) ? x : FOLDER + x + ".js"; };
    // a file -> its species (made once: the instances of the next ADD go into it). A file with no mind (or whose mind cannot be made) is made without one: it stands
    const make = function (name) {
      const url = url_of(name);
      say("reading " + url + " ...");
      return httprequest.get_url(url).then(function (text) {
        const CF = system.creature_file_module(), c = CF.load(text);
        if (c.nav && c.nav.agent && typeof c.nav.agent === "object") { const a = c.nav.agent; agents[a.name] = { radius: a.radius, height: a.height, step: a.step, slope: a.slope, drop: a.drop }; }
        say("making " + c.name + " ...");
        return system.make_creature(text, { max_instances: MAX_PER, mind: true, hit: true, world: world() }).then(null, function (e) {
          console.warn("shoot: " + name + " without its mind: " + (e && e.message || e));
          return system.make_creature(text, { max_instances: MAX_PER, hit: true });
        });
      }).then(function (r) {
        const entry = { sp: r.sp, creature: r.creature, list: [], died: 0, hurt: 0 };
        r.sp.on_worker_event = function (slot, gen, tag) { if (tag === "died") { entry.died++; range.died++; show_stats(); } else if (tag === "hurt") entry.hurt++; };
        range.species[name] = entry;
        return entry;
      });
    };
    let queue = Promise.resolve();                                                                         // (one ADD at a time: each one that needs a new nav profile installs the world again)
    const add = function (name, count) {
      const job = queue.then(function () {
        return range.species[name] ? range.species[name] : make(name);
      }).then(function (entry) {
        const room = MAX_PER - entry.list.length, n = Math.max(0, Math.min(count | 0, room));
        for (let k = 0; k < n; k++) {
          const c = entry.sp.spawn({ x: (Math.random() * 2 - 1) * AREA, y: 0, z: (Math.random() * 2 - 1) * AREA, scale: 1, yaw: Math.random() * Math.PI * 2 });
          entry.sp.set_tier(c, "near");                                                                    // (the hit zones follow the pose only at the near tier: a far creature's zones are not where it is drawn)
          entry.list.push(c);
        }
        say(entry.creature.name + ": " + entry.list.length + " in the scene" + (n < count ? " (" + MAX_PER + " is the most of one file)" : ""), n < count);
        show_stats();
        return entry;
      });
      queue = job.then(null, function () { /* the next one goes on; this one said why */ });
      return job.then(null, function (e) { say(name + ": " + (e && e.message || e), true); console.error("happy.system shoot: " + (e && e.stack || e)); throw e; });
    };
    const clear = function () {
      for (const k in range.species) {
        const e = range.species[k];
        e.list.forEach(function (c) { try { e.sp.release(c); } catch (x) { /* gone */ } });
        e.list.length = 0;
      }
      say("the scene is empty");
      show_stats();
    };
    range.shot = SHOT; range.add = add; range.clear = clear; range.shoot = shoot; range.system = system; range.camera = camera; range.engine = engine; range.bleed = bleed; range.gp = gp;

    // ---- the sidebar
    const build_ui = function () {
      const panel = el("div", "background:rgba(24,24,28,0.95);color:#ddd;font:11px monospace;padding:6px 8px;box-sizing:border-box;width:100%");
      ["keydown", "keyup"].forEach(function (t) { panel.addEventListener(t, function (e) { e.stopPropagation(); }); });          // (typing in a box does not move the camera)
      panel.appendChild(el("div", "font:bold 13px monospace;color:#fff;margin-bottom:4px", "SHOOTING RANGE"));
      ui.status = el("div", "color:#9fd;min-height:14px;margin-bottom:2px;word-break:break-word"); panel.appendChild(ui.status);
      ui.stats = el("div", "color:#fc6;margin-bottom:4px"); panel.appendChild(ui.stats);
      const row = function () { const r = el("div", "display:flex;align-items:center;gap:4px;margin:3px 0"); panel.appendChild(r); return r; };
      let r = row();
      ui.files = el("select", FIELD + ";flex:1;min-width:0");
      FILES.forEach(function (f) { const o = el("option", "", f[0] + "   " + f[1]); o.value = f[0]; ui.files.appendChild(o); });
      const g = document.createElement("optgroup"); g.label = "the library's animals (system.bin), " + ANIMALS.length;
      ANIMALS.forEach(function (f) { const o = el("option", "", f[0] + "   " + f[1]); o.value = f[0]; g.appendChild(o); });
      ui.files.appendChild(g);
      r.appendChild(ui.files);
      r = row();
      r.appendChild(el("span", "color:#9ab", "how many"));
      ui.count = el("input", FIELD + ";width:48px"); ui.count.type = "number"; ui.count.min = "1"; ui.count.max = String(MAX_PER); ui.count.value = "8"; r.appendChild(ui.count);
      const go = el("button", FIELD + ";cursor:pointer;padding:2px 10px", "ADD"); go.addEventListener("click", function () { add(ui.files.value, +ui.count.value || 1).then(null, function () { /* said */ }); go.blur(); }); r.appendChild(go);
      const wipe = el("button", FIELD + ";cursor:pointer;padding:2px 10px", "clear all"); wipe.addEventListener("click", function () { clear(); wipe.blur(); }); r.appendChild(wipe);
      const slider = function (name, min, max, step, key, unit, title) {                                  // (a number of the shot: it is read at every click)
        const r2 = row(); r2.title = title; r2.appendChild(el("span", "color:#9ab;width:52px;flex:none", name));
        const input = el("input", "flex:1;min-width:0;height:12px"); input.type = "range"; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(SHOT[key]);
        const val = el("span", "width:62px;flex:none;text-align:right;color:#9cf", SHOT[key] + " " + unit);
        input.addEventListener("input", function () { SHOT[key] = +input.value; val.textContent = SHOT[key] + " " + unit; });
        r2.appendChild(input); r2.appendChild(val);
      };
      panel.appendChild(el("div", "color:#fff;border-bottom:1px solid #444;margin:8px 0 3px;font-weight:bold", "THE SHOT"));
      slider("power", 0, 200, 1, "damage", "hp", "what a hit takes from the hit zone and from the creature's hit points");
      slider("impulse", 0, 500, 1, "impulse", "kg m/s", "the momentum that shoves the creature: a pistol bullet is about 3, a rifle's 8, a blast thousands. A hard shove brings a creature down");
      panel.appendChild(el("div", "color:#778;margin-top:8px", "left click shoots the creature under the mouse (a click that drags turns the camera). Power is what a hit takes from the hit zone and from the mind's hit points; impulse is the shove. Up to " + MAX_PER + " of a file."));
      if (dom && dom.sidebar$ && dom.$ && dom.$.div && dom.$.div.collapseable) {                           // (the engine's own sidebar, at the right: a section that collapses)
        dom.sidebar$.appendChild(dom.$.div.collapseable({ heading: "Shooting range" }, panel));
        try { dom.sidebar$.style.width = "350px"; } catch (e) { /* its own width */ }
        try { let n = dom.sidebar$.parentNode; while (n && n !== document.body) { if (n.classList && n.classList.contains("collapsed")) n.classList.remove("collapsed"); n = n.parentNode; } } catch (e) { /* it stays as it is */ }
      } else { panel.style.cssText += ";position:fixed;right:0;top:0;bottom:0;width:350px;overflow-y:auto;z-index:30"; document.body.appendChild(panel); }
    };
    build_ui();
    say("loading the system ...");
    range.ready = system.load("/system/system.bin", { all: true }).then(function () { say("choose a creature and press ADD"); show_stats(); }, function (e) { say(String(e && e.message || e), true); });
  }

  engine({})(ready);
});
