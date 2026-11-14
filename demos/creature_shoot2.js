packing("@/engine.js", "@/debug.js", "@/system/system.js", "@/particles/gpu_particles.js", "@/particles/gpu_particle_effects.js", "@/particles/soma_fx_presets.js")(function (engine, dom, httprequest) {
  // THE SHOOTING RANGE WITH A HERO (/demos/creature_shoot2.html): system_creature_shoot.js, but you are in it. The HERO is a robot file of system/creatures/ (android or bolt, no weapon prop), and you drive it:
  //   hold the RIGHT mouse button   walks toward the point the mouse points at, whichever way the hero faces      hold F   fires, and the hero KEEPS ITS FRONT: the way it faces and fires is the one it had when F went down, the mouse and the right button never turn it (so it walks backward or sideways and fires)
  //   W / S   walk toward / away from where it looks      A / D   step to its left / right (it keeps facing the mouse: the gait walks sideways and backward)      the mouse   the hero turns to face what the mouse points at (the creature under it, else the ground) and takes aim at it
  //   hold the F key   fires there: a hitscan (system.shoot) from the hero's chest toward the mouse's point, six times a second, an impact on the hit zone it meets
  //   the camera follows the hero (it starts above it; LEFT drag turns it, the wheel zooms); the creatures the SIDEBAR brings (as system_creature_shoot.js: choose a file, ADD) are what it shoots; a creature that is hit bleeds and loses the weapon's damage from its mind's hit points too.
  //   the sidebar also chooses the hero (a kind of people that carry a firearm and a seed) and makes it again.
  //   window.happy_creature_shoot2 = { hero: { sp, c, kind }, make_hero(file) -> Promise, add(name, count) -> Promise, clear(), species, shots, hits, died, fired, ready } is what a test reads.
  const MAX_PER = 64, RING = [7, 14], DEAD_SECONDS = 12, ATTACK_GAP = 2, BITE = 0.35, HERO_HP = 100, HERO_REST = 6, HERO_SAFE = 3, FLY_HEIGHT = 1.3, HURT_MSG = 7001, WALK = 3, FOLLOW = { pitch: -1.0, yaw: 0, distance: 9 };       // (instances of a file at most; the ring round the hero (nearest, farthest metres) the creatures are put in; how long a dead creature lies before it comes back; the seconds between two bites (a creature bites from about the size of its body from the hero and stands at three quarters of that); the share of a file's fighting damage a bite takes from the hero; the hero's hit points, the seconds it lies when it is dead and the seconds it cannot be bitten after it stands again; the height a flyer holds over the ground while it hunts the hero; the `health` block's message; the hero's pace; the camera)
  const FOLDER = "/system/creatures/";
  const LIBRARY_ATTACKS = ["designed_basic::bite", "designed_basic::lunge", "designed_basic::swipe", "designed_basic::headbutt"];          // (the clips a creature that has none of its own bites with: they play on any body)
  const WEAPONS = ["none", "assault_rifle", "carbine", "sniper_rifle", "light_machine_gun", "pistol"];       // (none: no weapon, F fires a hitscan from the chest; the others are the library's of creature_file.js, mounted by hand: the library's own mount is on a person's `spine02`, so its `rest` is said here)
  const REST = { bone: "chest", at: [0, 0.1, -0.17], dir: [0.4, 1, 0.05] };
  const HEROES = ["android", "bolt"];       // (the robots of system/creatures/ with two arms and hands that the hero can be)
  // every creature file of system/creatures/ that is not a vehicle (the page cannot list a folder: this is the list, made by reading each file: family kind person, monster, robot, animal, or a human body; not vehicle, aircraft, drone, machine, mech): [file, what it is]
  const GROUPS = [
    ["People", [
      ["brawler", "a boxer"], ["grandmother", "a person"], ["knight", "an armoured knight"],
      ["lite_person", "a person"], ["lite_person2", "a person"], ["lite_person3", "a person"],
      ["old_sailor", "a person"], ["punk_girl", "a person"], ["tribal_chief", "a person"]
    ]],
    ["Monsters", [
      ["fat_monster", "a swamp ogre with soft tissue"], ["mummy", "monster"], ["stone_golem", "monster"],
      ["zombie_ancient", "a person"], ["zombie_farmer", "a person"], ["zombie_nurse", "a person"],
      ["zombie_soldier", "a person"], ["zombie_walker", "a person"]
    ]],
    ["Robots", [
      ["android", "a humanoid robot that shoots, punches and kicks"], ["bolt", "a helper robot"], ["crawler", "a six legged robot with a stinger tail"],
      ["hopper", "a robot on spring legs that hops"], ["robo_hound", "a robot dog on four legs"], ["transformer", "a giant robot with gaits and actions of its own"]
    ]],
    ["Animals (hand made)", [
      ["ant", "an insect on six legs"], ["bear", "a brown bear"], ["bee", "animal"],
      ["bird", "a small bird that walks and flies"], ["black_widow", "a black widow, a spider of eight legs"], ["elephant", "an elephant with a trunk"],
      ["fly", "a big blowfly: six legs, a hover and soft tissue on an sdf body"], ["gator_dog", "an alligator dog, built of pieces"], ["horse", "a bay horse"],
      ["huntsman", "a huntsman spider, flat and sprawling"], ["jumping_spider", "a jumping spider that leaps on its prey"], ["ladybird", "animal"],
      ["orb_weaver", "an orb weaver, a timid banded spider"], ["rhino_beetle", "animal"], ["spider", "a big hunting spider on eight legs"],
      ["tarantula", "a heavy tarantula"], ["wolf_spider", "a fast wolf spider"]
    ]],
    ["Big birds (system/birds.js)", [
      ["andean_condor", "an Andean condor: black with a white collar, a high soarer"], ["emu", "an emu: a tall flightless runner"],
      ["golden_eagle", "a golden eagle: a brown raptor that soars and stoops"], ["ostrich", "an ostrich: a giant flightless runner"],
      ["sarus_crane", "a sarus crane: the tallest flying bird, grey with a red head"]
    ]],
    ["Animals (the library, system.bin)", [
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
    ]]
  ];
  const el = function (tag, css, text) { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text !== undefined) e.textContent = text; return e; };
  const FIELD = "background:#222;color:#ddd;border:1px solid #444;font:11px monospace;padding:1px 3px;box-sizing:border-box";

  function ready(engine) {
    const system = engine.system;
    const scene = engine.debug.scene(), camera = scene.camera, ctl = camera.control, canvas = engine.webgl.canvas;
    camera.update_perspective(0.05, 1500, 60);
    scene.use_deffered_rendering();
    scene.on_shadow_pass.add(function () {
      system.render_all();
      engine.debug.render();
    });
    scene.on_render_pass.add(function () {
      engine.debug.grid.render_ground();
      system.render_all();
      engine.debug.render();
    });

    // PARTICLES: the soft pass of the deferred scene; the weapon's own (its muzzle flash, its tracer) are played by system.fx_player; BLOOD is a system of ours with two emitters that only burst
    const gp = engine.gpu_particles;
    gp.attach(scene.dfd);
    system.use_particles(system.fx_player(gp));
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
    const range = window.happy_creature_shoot2 = { species: {}, hero: null, shots: 0, hits: 0, died: 0, revived: 0, fired: 0, events: {}, bites: 0, hero_deaths: 0, last: null, ready: null, status: "" };
    const ui = {};
    const say = function (m, bad) { range.status = m; if (ui.status) { ui.status.textContent = m; ui.status.style.color = bad ? "#f88" : "#9fd"; } };
    const count_all = function () { let n = 0; for (const k in range.species) n += range.species[k].list.length; return n; };
    const show_stats = function () { if (ui.stats) ui.stats.textContent = "fired " + range.fired + "   hits " + range.hits + "   died " + range.died + "   back " + range.revived + "   hero hp " + Math.max(0, Math.round(range.hero ? range.hero.hp : 0)) + "   creatures " + count_all(); };

    // ---- the hero's shot: no weapon prop (the library's weapons mount on a person's bones); F fires a hitscan (system.shoot) from the hero's chest toward the aim, as system_creature_shoot.js does from the camera
    const SHOT = { damage: 20, impulse: 16, set_ui: null }, RATE = 6, RANGE = 200;
    let next_shot = 0, last_fire = null;
    system.on_prop = function (sp, h, kind, info) {                                                          // (a held weapon: "fire" says where the shot left and its way, "shot" tells each pellet when the worker has answered)
      if (!range.hero || h !== range.hero.h) return;
      if (kind === "fire") { last_fire = info; range.fired++; }
      else if (kind === "shot" && info.hit && info.target && last_fire) {
        const from = last_fire.from, d = last_fire.dir, x = from[0] + d[0] * info.distance, y = from[1] + d[1] * info.distance, z = from[2] + d[2] * info.distance;
        range.hits++; bleed(x, y, z, d);
        info.target.sp.worker_msg(HURT_MSG, info.target.c.slot, h.entry.fire.damage, -1);
      }
      show_stats();
    };
    const fire = function (aim_at, H) {
      const m = H.sp.mirror, o = H.c.slot * 8, from = [m[o], m[o + 1] + 1.2, m[o + 2]];
      const dx = aim_at[0] - from[0], dy = aim_at[1] - from[1], dz = aim_at[2] - from[2], l = Math.hypot(dx, dy, dz);
      if (!(l > 0.3)) return;
      const d = [dx / l, dy / l, dz / l];
      range.fired++; range.shots++;
      system.shoot({ from: from, dir: d, range: RANGE, impulse: SHOT.impulse, damage: SHOT.damage }, function (shot) {
        const x = from[0] + d[0] * shot.distance, y = from[1] + d[1] * shot.distance, z = from[2] + d[2] * shot.distance;
        if (shot.hit && shot.sp) { range.hits++; bleed(x, y, z, d); shot.sp.worker_msg(HURT_MSG, shot.slot, SHOT.damage, -1); }
        if (engine.debug_points) engine.debug_points.add(x, y, z, shot.hit ? 1 : 0.6, shot.hit ? 0.2 : 0.6, 0.2, 2);
        show_stats();
      });
      show_stats();
    };

        // a bite: the hero loses hit points and bleeds; at 0 it falls (the page's ragdoll) and lies HERO_REST seconds, then it stands again whole
    const hurt_hero = function (damage, dx, dz) {
      const H = range.hero;
      if (!H || H.dead_at || performance.now() < H.safe_until) return;
      const m = H.sp.mirror, o = H.c.slot * 8;
      H.hp -= damage * BITE; range.bites++;
      bleed(m[o], m[o + 1] + 1.1, m[o + 2], [dx, 0, dz]);
      if (H.hp <= 0) { H.hp = 0; H.dead_at = performance.now(); range.hero_deaths++; try { H.sp.set_intent(H.c, 0, 0); H.sp.ragdoll(H.c, true, { velocity: [0, 0, 0] }); } catch (e) { /* no ragdoll */ } }
      show_stats();
    };
    // one creature of a species, on the ring round the hero, facing it (a flyer takes off at once and flies at FLY_HEIGHT)
    const spawn_one = function (entry) {
      const H = range.hero, hm = H ? H.sp.mirror : null, hx = H ? hm[H.c.slot * 8] : 0, hz = H ? hm[H.c.slot * 8 + 2] : 0;
      const a = Math.random() * Math.PI * 2, rad = RING[0] + Math.random() * (RING[1] - RING[0]);
      const c = entry.sp.spawn({ x: hx + Math.sin(a) * rad, y: 0, z: hz + Math.cos(a) * rad, scale: 1, yaw: a + Math.PI });
      entry.sp.set_tier(c, "near");                                                                        // (the hit zones follow the pose only at the near tier)
      if (entry.flyer) { try { entry.sp.fly(c, true); } catch (e) { entry.flyer = false; } }
      entry.list.push(c);
      return c;
    };

    // ---- the hero
    let hero_n = 0;
    const build_hero = function (text, weapon) {
      const CF = system.creature_file_module();
      let src = text;
      if (weapon !== "none") src = "const hero = (function () {" + text + "\n})();\n" +
        "hero.abilities = (hero.abilities || []).concat([\"props\", \"effects\", \"ranged\"]).filter(function (a, i, l) { return l.indexOf(a) === i; });\n" +
        "hero.props = Object.assign({}, hero.props, { weapon: api.weapon(" + JSON.stringify(weapon) + ", { rest: " + JSON.stringify(REST) + ", start: \"grip\" }) });\n" +
        "return hero;";
      const creature = CF.load(src), def = CF.body_def(creature);
      def.name = creature.name + "_hero" + (++hero_n); def.max_instances = 1;
      return Promise.resolve(def.human ? system.human_creature(def) : def).then(function (made) {
        made.name = def.name; made.max_instances = 1;
        return Promise.resolve(system.build_sdf(made)).then(function () { const sp = system.species(made); return { sp: sp, made: made }; });
      });
    };
    const make_hero = function (file, weapon) {
      weapon = weapon || "none";
      say("making " + file + (weapon !== "none" ? " with " + weapon : "") + " ...");
      return httprequest.get_url(url_of(file)).then(function (text) {
        return build_hero(text, weapon).then(null, function (e) {                                             // (a weapon that cannot be mounted: the hero is made without it)
          if (weapon === "none") throw e;
          console.warn("shoot2: " + file + " without " + weapon + ": " + (e && e.message || e)); say(file + ": no " + weapon + " (" + (e && e.message || e) + "), made without it", true);
          weapon = "none"; return build_hero(text, "none");
        });
      }).then(function (r) {
        if (range.hero) { try { range.hero.sp.release(range.hero.c); range.hero.sp.dispose(); } catch (e) { /* gone */ } range.hero = null; }
        const sp = r.sp, c = sp.spawn({ x: 0, y: 0, z: 0, scale: 1, yaw: 0 });
        sp.set_tier(c, "near");
        range.hero = { sp: sp, c: c, h: null, hp: HERO_HP, dead_at: 0, safe_until: 0, kind: file, weapon: weapon, face: [0, 1] };
        if (weapon !== "none") say("the hero is " + file + " with a " + weapon + ": WASD walks, the mouse aims, hold F to fire");
        return range.hero;
      }, function (e) { say(file + ": " + (e && e.message || e), true); throw e; });
    };

        // THE POINT THE MOUSE MEANS: the ray of the mouse against the creatures first (a sphere round each one's hit zones: sp.hit.radius at sp.hit.center, the nearest the ray goes through; the aim is its middle, so the shot meets its zones),
    // and the ground where it meets none. The aim is a point ON the mouse's ray (for a creature the one nearest its middle), so the gun points where the ray does.
    const pick = function (o, d, out) {
      let best = Infinity, found = false;
      for (const k in range.species) {
        const e = range.species[k], hz = e.sp.hit, m = e.sp.mirror;
        if (!hz) continue;
        for (let i = 0; i < e.list.length; i++) {
          const q = e.list[i].slot * 8, sc = m[q + 3] > 0 ? m[q + 3] : 1, cx = m[q], cy = m[q + 1] + hz.center[1] * sc, cz = m[q + 2], R = hz.radius * sc;
          const wx = cx - o[0], wy = cy - o[1], wz = cz - o[2], t = wx * d[0] + wy * d[1] + wz * d[2];
          if (t <= 0 || t >= best) continue;
          if (wx * wx + wy * wy + wz * wz - t * t > R * R) continue;
          best = t; found = true; out[0] = o[0] + d[0] * t; out[1] = o[1] + d[1] * t; out[2] = o[2] + d[2] * t;          // (the point of the mouse's ray that is nearest the creature's middle: the aim is ON the ray)
        }
      }
      if (found) return "creature";
      if (d[1] < -1e-4) { const t = -o[1] / d[1]; out[0] = o[0] + d[0] * t; out[1] = 0; out[2] = o[2] + d[2] * t; return "ground"; }
      return null;
    };
    // every frame: the mouse's point, the hero's wish (WASD, facing it), the weapon aimed at it, fired while the F key is down; the RIGHT button walks it toward the aim (the left one is the camera's), and the camera over the hero
    const aim = [0, 0, 0], mouse = [0, 0, 0], ray = [0, 0, 0];
    // AUTO MODE: the hero hunts like a person would. It RUNS to a place of its own choosing (away from what is near it, or about when nothing is), TURNS to the nearest creature that is alive at a turn rate of its own, takes AIM (the weapon comes up: a pause), fires a BURST of
    // a few shots, and runs again. The creatures come ONE AT A TIME (a new one every few seconds, two of each kind alive (fourteen bees, which come quickly and are back 1.5 s after they die)), so there is always one to turn to and none are piled up.
    const AUTO_RUN = 4.6, AUTO_TURN = 3.2, AUTO_RANGE = 45, AUTO_PER = 2, AUTO_COUNT = { bee: 14 }, REBORN = { bee: 1.5 },       // (more than ten bees alive; a dead bee is back after 1.5 s, the others after DEAD_SECONDS)
    AUTO_ARENA = 13, AUTO_KINDS = ["spider", "black_widow", "huntsman", "jumping_spider", "orb_weaver", "tarantula", "wolf_spider", "bee"];       // (two of each kind alive at a time)
    range.auto = false; range.auto_fire = false; range.auto_dist = -1; range.auto_state = "";
    let next_spawn = 0, spawning = false, spawn_n = 0;
    const auto_target = function (H, px, pz) {
      let best = Infinity, bx = 0, by = 0, bz = 0, found = false;
      for (const key in range.species) {
        const e = range.species[key], m2 = e.sp.mirror, hz = e.sp.hit;
        for (let i = 0; i < e.list.length; i++) {
          const c = e.list[i]; if (c.dead_at) continue;
          const q = c.slot * 8, sc = m2[q + 3] > 0 ? m2[q + 3] : 1, d = Math.hypot(m2[q] - px, m2[q + 2] - pz);
          if (d < best) { best = d; bx = m2[q]; by = m2[q + 1] + (hz ? hz.center[1] * sc : 0.6); bz = m2[q + 2]; found = true; }
        }
      }
      if (found) { mouse[0] = bx; mouse[1] = by; mouse[2] = bz; range.auto_dist = best; range.auto_fire = best <= AUTO_RANGE; }
      else { range.auto_dist = -1; range.auto_fire = false; mouse[0] = px + H.face[0] * 6; mouse[1] = 1; mouse[2] = pz + H.face[1] * 6; }
    };
    const wrap = function (a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const choose_run = function (H, px, pz) {                                                              // (a place 6 .. 13 m off: farther from the creature that is nearest, on the side the hero is already on, else anywhere in the arena)
      let a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 7;
      if (range.auto_dist >= 0) { const dx = px - mouse[0], dz = pz - mouse[2]; a = Math.atan2(dz, dx) + (Math.random() - 0.5) * 2.2; }
      let x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      const l = Math.hypot(x, z); if (l > AUTO_ARENA) { x *= AUTO_ARENA / l; z *= AUTO_ARENA / l; }       // (it stays inside the arena)
      H.auto.dest = [x, z];
    };
    // the hero's wish this frame, by its state: returns { vx, vz, fx, fz, fire }
    const auto_step = function (H, px, pz, now, dt) {
      const A = H.auto || (H.auto = { state: "run", until: 0, dest: null, shots: 0 });
      const have = range.auto_dist >= 0, mx = mouse[0] - px, mz = mouse[2] - pz, ml = Math.hypot(mx, mz) || 1;
      let vx = 0, vz = 0, fx = H.face[0], fz = H.face[1], fire = false;
      const turn_to = function (tx, tz) {                                                                  // (it turns at AUTO_TURN rad/s, not at once: the weapon follows)
        const cur = Math.atan2(fz, fx), want = Math.atan2(tz, tx), d = wrap(want - cur), st = Math.max(-AUTO_TURN * dt, Math.min(AUTO_TURN * dt, d));
        fx = Math.cos(cur + st); fz = Math.sin(cur + st); return Math.abs(d - st);
      };
      if (A.state === "run") {
        if (!A.dest) choose_run(H, px, pz);
        const dx = A.dest[0] - px, dz = A.dest[1] - pz, dl = Math.hypot(dx, dz);
        if (dl < 0.8 || now > A.until) { A.state = have ? "turn" : "run"; A.dest = null; A.until = now + (have ? 2500 : 1500 + Math.random() * 2500); if (!have) A.state = "wait"; }
        else { vx = dx / dl * AUTO_RUN; vz = dz / dl * AUTO_RUN; turn_to(dx, dz); }
      }
      if (A.state === "wait") { if (have) { A.state = "turn"; A.until = now + 2500; } else if (now > A.until) { A.state = "run"; A.until = now + 5000; } }
      else if (A.state === "turn") {
        if (!have) { A.state = "run"; A.until = now + 5000; }
        else if (turn_to(mx, mz) < 0.1 || now > A.until) { A.state = "aim"; A.until = now + 450 + Math.random() * 450; }
      } else if (A.state === "aim") {
        if (!have) { A.state = "run"; A.until = now + 5000; }
        else { turn_to(mx, mz); if (now > A.until) { A.state = "fire"; A.until = now + 600 + Math.random() * 900; } }
      } else if (A.state === "fire") {
        if (!have) { A.state = "run"; A.until = now + 5000; }
        else {
          turn_to(mx, mz); fire = range.auto_dist <= AUTO_RANGE;
          if (now > A.until) { A.state = "run"; A.until = now + 5000; A.dest = null; }
        }
      }
      if (have && range.auto_dist < 3 && A.state !== "run") { A.state = "run"; A.dest = null; A.until = now + 4000; }          // (something is on it: it runs)
      range.auto_state = A.state;
      return { vx: vx, vz: vz, fx: fx, fz: fz, fire: fire };
    };
    // THE CAMERA IN AUTO MODE takes the shots: following behind while the hero runs (wide, high), over its shoulder while it turns and aims (nearer), and a close low shot, the target in the frame, while it fires.
    // It eases to each pose (the angle, the distance, the point looked at), it does not jump.
    const CAM_POSE = { run: { d: 8.5, pitch: -0.38, side: 0, lead: 0 }, wait: { d: 7, pitch: -0.3, side: 0.5, lead: 1 }, turn: { d: 6, pitch: -0.26, side: 0.5, lead: 2 }, aim: { d: 4.6, pitch: -0.18, side: 0.45, lead: 3 }, fire: { d: 3.8, pitch: -0.1, side: 0.4, lead: 3.5 } };
    const cam = { yaw: null, pitch: FOLLOW.pitch, d: FOLLOW.distance, x: 0, y: 0.9, z: 0 };
    const auto_camera = function (H, px, py, pz, dt) {
      const P = CAM_POSE[range.auto_state] || CAM_POSE.run, k = 1 - Math.exp(-dt * 3.2);
      const dx = H.face[0], dz = H.face[1];
      const want = Math.atan2(-dx, -dz) + P.side;                                                         // (the camera looks the way the hero faces, a little off it so the hero is on the side of the picture)
      if (cam.yaw === null) { cam.yaw = want; cam.x = px; cam.y = py + 1.0; cam.z = pz; }
      let dy = want - cam.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      cam.yaw += dy * k; cam.pitch += (P.pitch - cam.pitch) * k; cam.d += (P.d - cam.d) * k;
      cam.x += (px + dx * P.lead - cam.x) * k; cam.y += (py + 1.0 - cam.y) * k; cam.z += (pz + dz * P.lead - cam.z) * k;
      ctl.eular[0] = cam.pitch; ctl.eular[1] = cam.yaw; engine.tra_model.set_eular(ctl, cam.pitch, cam.yaw, 0);
      ctl.distance = cam.d;
      engine.tra_model.set_position(ctl, cam.x, cam.y, cam.z);
    };
    engine.on_frame.add(function () {
      const H = range.hero;
      if (!H) return;
      const now0 = performance.now();
      const m = H.sp.mirror, o = H.c.slot * 8, px = m[o], py = m[o + 1], pz = m[o + 2];
      const co = camera.world_position, r = camera.mouse_ray, rl = Math.hypot(r[0], r[1], r[2]) || 1;
      ray[0] = r[0] / rl; ray[1] = r[1] / rl; ray[2] = r[2] / rl;
      const dt = Math.min(0.1, (now0 - (H.t_last || now0)) / 1000); H.t_last = now0;
      if (range.auto) auto_target(H, px, pz);
      else if (ray.every(isFinite)) range.target = pick(co, ray, mouse);                                       // (no mouse position yet: the last point stays)
      const mx = mouse[0] - px, mz = mouse[2] - pz, ml = Math.hypot(mx, mz);
      const now = now0;
      if (H.dead_at && now - H.dead_at > HERO_REST * 1000) { H.dead_at = 0; H.hp = HERO_HP; H.safe_until = now + HERO_SAFE * 1000; try { H.sp.ragdoll(H.c, false); } catch (e) { /* stands */ } show_stats(); }
      const k = engine.keys, down = canvas.mouse_down_buttons, go = down >= 0 && (down & 2) !== 0, firing = !!k[70] && !range.auto;
      let trigger = !!k[70];
      // FACING AND AIM: the hero faces the mouse's point. While F is held it does NOT: the way it faces and shoots (and how far, and how high) is what it was when F went down, and the mouse, the right button and its own walking never turn it:
      // it keeps its front toward what it fires at, and walks backward or sideways if it is asked to
      let fx, fz;
      if (firing) {
        if (!H.lock) H.lock = { face: [H.face[0], H.face[1]], off: ml > 1 ? [mx, mouse[1] - py, mz] : [H.face[0] * 6, 1, H.face[1] * 6] };
        fx = H.lock.face[0]; fz = H.lock.face[1];
        aim[0] = px + H.lock.off[0]; aim[1] = py + H.lock.off[1]; aim[2] = pz + H.lock.off[2];             // (the same direction, from where the hero is now)
      } else {
        H.lock = null;
        if (ml > 0.4) { fx = mx / ml; fz = mz / ml; H.face[0] = fx; H.face[1] = fz; } else { fx = H.face[0]; fz = H.face[1]; }          // (a point at its feet: it keeps its facing)
        aim[0] = mouse[0]; aim[1] = mouse[1]; aim[2] = mouse[2];
      }
      // WALKING: W S and A D are relative to where it faces (its left is (fz, -fx)); the right button walks toward the mouse's point whichever way it faces (so, firing, backward or sideways)
      const f = (k[87] ? 1 : 0) - (k[83] ? 1 : 0), s = (k[65] ? 1 : 0) - (k[68] ? 1 : 0);
      let vx = fx * f + fz * s, vz = fz * f - fx * s;
      const vl = Math.hypot(vx, vz);
      if (vl > 1e-6) { vx = vx / vl * WALK; vz = vz / vl * WALK; }
      else if (go && ml > 0.8) { vx = mx / ml * WALK; vz = mz / ml * WALK; }
      if (range.auto) { const W = auto_step(H, px, pz, now, dt); vx = W.vx; vz = W.vz; fx = W.fx; fz = W.fz; H.face[0] = fx; H.face[1] = fz; trigger = W.fire; range.auto_fire = W.fire; }
      if (H.dead_at) { vx = 0; vz = 0; }
      H.sp.set_intent(H.c, vx, vz, fx, fz);
      if (H.weapon !== "none" && !H.h) {
        H.h = H.sp.prop_held(H.c, "weapon");                                                              // (born holding it: the handle is there once the instance is)
        if (H.h) { const F = H.h.entry.fire; SHOT.damage = F.damage; SHOT.impulse = F.impulse; if (SHOT.set_ui) SHOT.set_ui(); }
      }
      if (H.h) {
        const F = H.h.entry.fire; F.damage = SHOT.damage; F.impulse = SHOT.impulse;
        H.sp.prop_aim(H.h, { at: aim });
        if (trigger && !H.dead_at) { try { if (H.sp.prop_fire(H.h, { at: aim, free: true })) range.shots++; } catch (e) { /* the muzzle is at the target */ } }
      } else if (trigger && !H.dead_at && now >= next_shot) { next_shot = now + 1000 / RATE; fire(aim, H); }
            if (range.auto && !spawning && now >= next_spawn) {                                                  // (creatures come slowly: one, then a pause of 4 .. 8 s)
        const need = AUTO_KINDS.filter(function (n) { const e = range.species[n]; let alive = 0; if (e) e.list.forEach(function (c) { if (!c.dead_at) alive++; }); return alive < (AUTO_COUNT[n] || AUTO_PER); });
        if (need.length) { const n = need[spawn_n++ % need.length]; next_spawn = now + (n === "bee" ? 500 : 4000 + Math.random() * 4000); spawning = true; add(n, 1).then(null, function () { /* said */ }).then(function () { spawning = false; }); } else next_spawn = now + 500;
      }
      for (const key in range.species) {                                                                  // every creature walks to the hero (a dead one lies, then goes)
        const e = range.species[key];
        for (let i = e.list.length - 1; i >= 0; i--) {
          const c = e.list[i];
          if (c.dead_at) {
            if (now - c.dead_at > (REBORN[key] || DEAD_SECONDS) * 1000) {                                                    // (it has lain long enough: it comes BACK, whole, on the ring round the hero)
              try { e.sp.release(c); } catch (x) { /* gone */ }
              e.list.splice(i, 1);
              try { spawn_one(e); } catch (x) { /* the species is full or gone */ }
              range.revived++;
            }
            continue;
          }
          if (e.still) continue;
          const q = c.slot * 8, mx = e.sp.mirror[q], mz = e.sp.mirror[q + 2], dx = px - mx, dz = pz - mz, dl = Math.hypot(dx, dz) || 1;
          try {
            if (e.flyer) e.sp.set_climb(c, Math.max(-1.5, Math.min(1.5, (FLY_HEIGHT - e.sp.mirror[q + 1]) * 2)));          // (up or down to the height it flies at)
            if (dl <= e.reach && !H.dead_at && now >= (c.next_bite || 0)) {                             // (it reached the hero: it bites, and again every ATTACK_GAP seconds)
              c.next_bite = now + ATTACK_GAP * 1000 * (0.8 + Math.random() * 0.4); c.biting_until = now + 700;                    // (it stands and plays the clip: a wish to walk would cut it short)
              try { e.sp.ai_play(c.slot, e.attacks[(Math.random() * e.attacks.length) | 0]); } catch (x) { /* no such clip */ }
              hurt_hero(e.damage, -dx / dl, -dz / dl);
            }
            if (now < (c.biting_until || 0)) e.sp.set_intent(c, 0, 0, dx / dl, dz / dl);
            else if (dl > e.reach * 0.75) e.sp.set_intent(c, dx / dl * e.speed, dz / dl * e.speed);
            else e.sp.set_intent(c, 0, 0, dx / dl, dz / dl);                                              // (there: it stands facing the hero)
          } catch (x) { e.still = true; }                                                                   // (a species with no body to walk with stands where it is)
        }
      }
      if (range.auto) auto_camera(H, px, py, pz, dt); else engine.tra_model.set_position(ctl, px, 0.9, pz);                                                    // (the camera stays over the hero; its angle and distance are the mouse's: left drag turns, wheel zooms)
    });
    ctl.eular[0] = FOLLOW.pitch; ctl.eular[1] = FOLLOW.yaw; engine.tra_model.set_eular(ctl, FOLLOW.pitch, FOLLOW.yaw, 0);
    document.addEventListener("contextmenu", function (e) { if (e.target === canvas) e.preventDefault(); });          // (the right button is the trigger, not a menu)
    ctl.distance = FOLLOW.distance;

    // ---- the creatures to shoot (as system_creature_shoot.js)
    const agents = {};
    const world = function () {
      return { format: "system-world", version: 1, name: "range", nav: { cell: 0.25, bounds: [-32, -32, 32, 32], agents: Object.assign({}, agents), default_agent: "person" }, ground: { y: 0 }, terrain: {},
        boxes: [], stairs: [], ramps: [], links: [], doors: [], zones: [], scenes: [], entities: [], slots: [], bindings: [], spawn_rules: [], required_blocks: [], gives: [], block_params: {}, keys: [], relations: [], roles: [] };
    };
    const url_of = function (x) { return /[\/.]/.test(x) ? x : FOLDER + x + ".js"; };
    const make = function (name) {
      const url = url_of(name);
      say("reading " + url + " ...");
      return httprequest.get_url(url).then(function (text) {
        const CF = system.creature_file_module(), c = CF.load(text);
        if (c.nav && c.nav.agent && typeof c.nav.agent === "object") { const a = c.nav.agent; agents[a.name] = { radius: a.radius, height: a.height, step: a.step, slope: a.slope, drop: a.drop }; }
        say("making " + c.name + " ...");
        return system.make_creature(text, { max_instances: MAX_PER, mind: health_only, hit: true, world: world() }).then(null, function (e) {
          console.warn("shoot2: " + name + " without its mind: " + (e && e.message || e));
          return system.make_creature(text, { max_instances: MAX_PER, hit: true });
        });
      }).then(function (r) {
        const flyer = !!r.sp.flyer, max = flyer && r.sp.flyer.max_speed > 0 ? r.sp.flyer.max_speed : (r.def.body && r.def.body.max_speed > 0 ? r.def.body.max_speed : 2.5);
        let damage = 6;                                                                                    // (what a bite takes from the hero: the file's own fighting damage, else 6)
        ((r.creature.mind && r.creature.mind.blocks) || []).forEach(function (b) { if (Array.isArray(b) && b[0] === "fight" && b[1] && b[1].damage > 0) damage = b[1].damage; });
        const own_attacks = ((r.def.actions || []).filter(function (a) { return a && a.kind === "attack"; }).map(function (a) { return a.name; }));
        const attacks = own_attacks.length ? own_attacks : LIBRARY_ATTACKS;
        const body = r.sp.hit && r.sp.hit.radius > 0 ? r.sp.hit.radius : 0.5, reach = Math.max(1, Math.min(4, body + 0.5));           // (how near the hero it bites from: the size of its body and a little; it stands at three quarters of that)
        const entry = { sp: r.sp, creature: r.creature, list: [], died: 0, hurt: 0, damage: damage, attacks: attacks, reach: reach, flyer: flyer, speed: Math.max(0.4, Math.min(6, (flyer ? 0.7 : 0.45) * max)), still: false };           // (a creature goes to the hero at about half its top speed; a flyer at 0.7 of its own)
        r.sp.on_worker_event = function (slot, gen, tag, value) {
          if (tag === "ai_preview") { const key = "ai_preview " + value; range.events[key] = (range.events[key] || 0) + 1; return; }          // (the worker's answer to ai_play: 1 it plays, -1 no such clip)
          if (tag === "hurt") { entry.hurt++; return; }
          if (tag !== "died") return;
          entry.died++; range.died++; show_stats();
          for (let i = 0; i < entry.list.length; i++) {
            const c = entry.list[i];
            if (c.slot !== slot || c.dead_at) continue;
            c.dead_at = performance.now();                                                                 // (it lies there DEAD_SECONDS: the page's ragdoll is the page's, it does not stand by itself; then it comes back (a new one, whole, on the ring round the hero))
            if (entry.flyer) { try { entry.sp.fly(c, false); entry.sp.set_climb(c, 0); } catch (e) { /* not flying */ } }          // (a flyer comes down: its body's gravity takes it)
            try { entry.sp.set_intent(c, 0, 0); } catch (e) { /* a body that does not walk */ }
            try { entry.sp.ragdoll(c, true, { velocity: [0, 0, 0] }); } catch (e) { /* no ragdoll to fall as: it stops where it is */ }
          }
        };
        range.species[name] = entry;
        return entry;
      });
    };
    // The creatures' mind: only the `health` block of the file (the hit points, and the dying: the worker says "died"). Where they go is the page's (below): every one walks to the hero.
    const health_only = function (mind) {
      let hp = { hp: 60 };
      ((mind && mind.blocks) || []).forEach(function (b) { if (Array.isArray(b) && b[0] === "health" && b[1]) hp = b[1]; });
      return { hz: 4, far_hz: 2, blocks: [["health", hp]], worker: function (api, ld) { return { tree: { name: "still", select: [{ name: "stay", call: function (me, el) { return api.ai.OK; } }] } }; } };          // (a tree needs one node: this one does nothing)
    };
    let queue = Promise.resolve();                                                                         // (one at a time: a new nav profile installs the world again)
    const add = function (name, count) {
      const job = queue.then(function () {
        return range.species[name] ? range.species[name] : make(name);
      }).then(function (entry) {
        const room = MAX_PER - entry.list.length, n = Math.max(0, Math.min(count | 0, room));
        for (let k = 0; k < n; k++) spawn_one(entry);
        say(entry.creature.name + ": " + entry.list.length + " in the scene" + (n < count ? " (" + MAX_PER + " is the most of one file)" : ""), n < count);
        show_stats();
        return entry;
      });
      queue = job.then(null, function () { /* the next one goes on; this one said why */ });
      return job.then(null, function (e) { say(name + ": " + (e && e.message || e), true); console.error("happy.system shoot2: " + (e && e.stack || e)); throw e; });
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
    range.set_auto = function (on) {
      range.auto = !!on; if (ui.auto) ui.auto.checked = range.auto;
      if (range.auto) { next_spawn = 0; if (range.hero) range.hero.auto = null; cam.yaw = null; }
      say(range.auto ? "auto mode: the hero hunts and shoots on its own" : "auto mode off: WASD, the mouse and F");
    };
    // every species of auto mode is made BEFORE it is needed (reading the file, the mesh, the texture and the worker's mind take a while: made when the first one is called for, the frame freezes)
    range.preload = function () {
      let n = 0;
      return AUTO_KINDS.reduce(function (p, name) {
        return p.then(function () { say("loading " + name + " (" + (++n) + " of " + AUTO_KINDS.length + ") ..."); return add(name, 0); }).then(null, function () { /* said */ });
      }, Promise.resolve()).then(function () { say("preloaded " + AUTO_KINDS.length + " kinds: tick AUTO"); show_stats(); });
    };
    range.add = add; range.clear = clear; range.make_hero = make_hero; range.system = system; range.camera = camera; range.engine = engine; range.gp = gp; range.aim = aim;

    // ---- the sidebar
    const build_ui = function () {
      const panel = el("div", "background:rgba(24,24,28,0.95);color:#ddd;font:11px monospace;padding:6px 8px;box-sizing:border-box;width:100%");
      ["keydown", "keyup"].forEach(function (t) { panel.addEventListener(t, function (e) { e.stopPropagation(); }); });          // (typing in a box does not walk the hero)
      panel.appendChild(el("div", "font:bold 13px monospace;color:#fff;margin-bottom:4px", "SHOOTING RANGE: THE HERO"));
      ui.status = el("div", "color:#9fd;min-height:14px;margin-bottom:2px;word-break:break-word"); panel.appendChild(ui.status);
      ui.stats = el("div", "color:#fc6;margin-bottom:4px"); panel.appendChild(ui.stats);
      const row = function () { const r = el("div", "display:flex;align-items:center;gap:4px;margin:3px 0"); panel.appendChild(r); return r; };
      const section = function (title) { panel.appendChild(el("div", "color:#fff;border-bottom:1px solid #444;margin:8px 0 3px;font-weight:bold", title)); };
      const button = function (parent, text, fn) { const b = el("button", FIELD + ";cursor:pointer;padding:2px 10px", text); b.addEventListener("click", function () { fn(); b.blur(); }); parent.appendChild(b); return b; };

      section("THE HERO");
      let r = row();
      ui.kind = el("select", FIELD + ";flex:1;min-width:0");
      HEROES.forEach(function (k) { const o = el("option", "", k); o.value = k; ui.kind.appendChild(o); });
      r.appendChild(ui.kind);
      ui.weapon = el("select", FIELD + ";width:120px");
      WEAPONS.forEach(function (k) { const o = el("option", "", k); o.value = k; ui.weapon.appendChild(o); });
      ui.weapon.value = "assault_rifle"; r.appendChild(ui.weapon);
      button(r, "make", function () { make_hero(ui.kind.value, ui.weapon.value).then(null, function () { /* said */ }); });

      r = row();
      ui.auto = el("input"); ui.auto.type = "checkbox"; ui.auto.checked = range.auto; ui.auto.addEventListener("change", function () { range.set_auto(ui.auto.checked); });
      const al = el("label", "cursor:pointer;color:#fc6"); al.title = "the hero picks the nearest creature, walks to a firing distance and shoots it; it runs, turns, aims and fires a burst, and spiders and bees arrive one at a time"; al.appendChild(ui.auto); al.appendChild(document.createTextNode(" AUTO: run, turn, aim, shoot; spiders and bees arrive slowly")); r.appendChild(al);
      section("THE SHOT");
      const sliders = [];
      const slider = function (name, min, max, step, key, unit, title) {
        const r2 = row(); r2.title = title; r2.appendChild(el("span", "color:#9ab;width:52px;flex:none", name));
        const input = el("input", "flex:1;min-width:0;height:12px"); input.type = "range"; input.min = String(min); input.max = String(max); input.step = String(step);
        const val = el("span", "width:78px;flex:none;text-align:right;color:#9cf", "");
        const show = function () { if (SHOT[key] !== null) { input.value = String(SHOT[key]); val.textContent = +(+SHOT[key]).toFixed(1) + " " + unit; } };
        input.addEventListener("input", function () { SHOT[key] = +input.value; show(); });
        r2.appendChild(input); r2.appendChild(val); sliders.push(show);
      };
      slider("power", 0, 300, 1, "damage", "hp", "what a shot takes from the hit zone and from the creature's hit points");
      slider("impulse", 0, 2000, 5, "impulse", "kg m/s", "the shove of a shot: a pistol bullet is about 3, a rifle's 8, a blast thousands. A big impulse knocks a creature over");
      SHOT.set_ui = function () { sliders.forEach(function (f) { f(); }); };
      SHOT.set_ui();

      section("CREATURES TO SHOOT");
      r = row();
      ui.files = el("select", FIELD + ";flex:1;min-width:0");
      GROUPS.forEach(function (gr) {
        const og = document.createElement("optgroup"); og.label = gr[0] + ", " + gr[1].length;
        gr[1].forEach(function (f) { const o = el("option", "", f[0] + "   " + f[1]); o.value = f[0]; og.appendChild(o); });
        ui.files.appendChild(og);
      });
      r.appendChild(ui.files);
      r = row();
      r.appendChild(el("span", "color:#9ab", "how many"));
      ui.count = el("input", FIELD + ";width:48px"); ui.count.type = "number"; ui.count.min = "1"; ui.count.max = String(MAX_PER); ui.count.value = "8"; r.appendChild(ui.count);
      button(r, "ADD", function () { add(ui.files.value, +ui.count.value || 1).then(null, function () { /* said */ }); });
      button(r, "clear all", clear);
      panel.appendChild(el("div", "color:#778;margin-top:8px", "W S walk, A D step aside (the hero faces the mouse), hold F to fire (the hero then keeps its front where it was and the mouse does not turn it), hold the right mouse button to walk toward the mouse (with F held it walks backward or sideways, still facing front), the left button turns the camera, the wheel zooms. Creatures that reach the hero bite it. A hit takes the weapon's damage from the hit zone and from the mind's hit points. Up to " + MAX_PER + " of a file."));
      if (dom && dom.sidebar$ && dom.$ && dom.$.div && dom.$.div.collapseable) {                           // (the engine's own sidebar, at the right: a section that collapses)
        dom.sidebar$.appendChild(dom.$.div.collapseable({ heading: "Shooting range: the hero" }, panel));
        try { dom.sidebar$.style.width = "350px"; } catch (e) { /* its own width */ }
        try { let n = dom.sidebar$.parentNode; while (n && n !== document.body) { if (n.classList && n.classList.contains("collapsed")) n.classList.remove("collapsed"); n = n.parentNode; } } catch (e) { /* it stays as it is */ }
      } else { panel.style.cssText += ";position:fixed;right:0;top:0;bottom:0;width:350px;overflow-y:auto;z-index:30"; document.body.appendChild(panel); }
    };
    build_ui();
    say("loading the system ...");
    range.ready = system.load("/system/system.bin", { all: true }).then(function () { return system.use({ gaits: [], actions: ["designed_basic"] }); }).then(function () { return make_hero("android", "assault_rifle"); }).then(function () { return range.preload(); }).then(function () { if (/[?&]auto=1/.test(location.search)) range.set_auto(true); }).then(function () { show_stats(); }, function (e) { say(String(e && e.message || e), true); });
  }

  engine({})(ready);
});
