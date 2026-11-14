packing("@/engine.js", "@/debug.js", "@/system/system.js")(function (engine, dom) {
  // THE CREATURE DEMO (/demos/creature_demo.html): load a creature FILE of system/creatures/ (or any creature file: a path, or a file of your disk), stand it on a grid floor, put any GAIT STYLE of the libraries on its legs and play any ACTION of the libraries on it.
  //   1. system.load(url, { all: true })       every gait library and action set of the pack is in, in the page's registry AND in the worker's
  //   2. fetch(file) -> text -> system.creature_file_module().load(text) -> .body_def(creature)      the file's BODY as the flat definition system.species takes (its family, its abilities and its mind, a tree of blocks for a world, are left out: this page is not a world)
  //      system.build_sdf(def) makes the mesh of a creature that is built of an sdf, system.species(def), sp.spawn(): one creature on the floor (a file with a `human` part is made first: system.human_creature)
  //   3. GAIT: sp.set_style(name, { fade }) puts a style of the libraries on the creature's legs WHILE IT WALKS (the styles that have as many legs as the creature). MOVE: "in place" is the treadmill (sp.set_treadmill: the ground scrolls under
  //      the feet, the body stays), "circle" walks it round on its own (sp.set_intent every frame: the gait turns it by stepping), "stand" none. With "speed follows the style" the treadmill goes at the style's own speed
  //   4. ACTION: the creature's own function in the worker (`mind`, below) plays an action of the library (api.action("<set>::<name>"), me.act) when the page says (sp.worker_send), and says how it goes (me.say: how far into it it is, which phase;
  //      api.post: that it began, or why it could not; on.end: that it ended, and how). An action is played on whatever body the creature has: a track of a part the body lacks (an arm of a horse) is left out by the runtime
  //   ?file=<a file of system/creatures by its name (brawler), or a path (/system/creatures/jeep.js)>   ?gait=<a style>   ?mode=place | circle | stand   ?speed=<m/s>   ?set=<an action set>   ?action=<an action of it>   ?play=1 plays it at once   ?loop=1
  //   ?view=front | side | three | top   ?bones=1 draws the skeleton   ?mesh=0 hides the mesh   ?wire=1 draws it as a wireframe   ?ui=1 shows the engine's overlays too.    A file of the disk: drop it on the page, or use the file button of the panel.
  // `window.happy_creature_demo` is what a test reads: { ready (a promise), error, frames, state, files, sp, c, def, creature, load(name | path | { text, name }) -> Promise<info>, info(), styles() -> [names], gait(name, { fade }) -> report | null, mode(m), speed(v),
  //   sets() -> [{ name, count, suggested }], load_set(name) -> Promise<[row]>, choose(set, name), play(opts?) -> Promise<report>, stop(), view(name), bones(on), feet(on), sample(bones) -> the root and the bones' places in the world now, events, reports }.
  //   No optional chaining, no ??, no async / await, no class (the bundler's parser).
  const q = function (k) { const m = new RegExp("[?&]" + k + "=([^&]*)").exec(location.search); return m ? decodeURIComponent(m[1]) : null; };
  const FIELD = "background:#222;color:#ddd;border:1px solid #444;font:11px monospace;padding:1px 3px;box-sizing:border-box";
  // the files of system/creatures/ (the page cannot list a folder: a file that is added is typed in the path box, or given by ?file=)
  const FILES = [["ant", "an insect on six legs"], ["bear", "a brown bear"], ["bird", "a small bird that walks and flies"], ["black_widow", "a black widow, a spider of eight legs"], ["bolt", "a helper robot"], ["brawler", "a boxer"], ["drone", "a quadcopter"], ["elephant", "an elephant with a trunk"],
    ["excavator", "a tracked excavator"], ["fat_monster", "a swamp ogre with soft tissue"], ["fly", "a big blowfly: six legs, a hover and soft tissue on an sdf body"], ["gator_dog", "an alligator dog, built of pieces"], ["horse", "a bay horse"], ["huntsman", "a huntsman spider, flat and sprawling"], ["jeep", "an open car with doors"], ["jet", "a small jet"], ["jumping_spider", "a jumping spider that leaps on its prey"],
    ["knight", "an armoured knight"], ["orb_weaver", "an orb weaver, a timid banded spider"], ["spider", "a big hunting spider on eight legs"], ["tarantula", "a heavy tarantula"],
    ["transformer", "a giant robot with gaits and actions of its own"], ["walker", "a bird legged mech"], ["wolf_spider", "a fast wolf spider"],
    ["android", "a humanoid robot that shoots, punches and kicks"], ["robo_hound", "a robot dog on four legs"], ["crawler", "a six legged robot with a stinger tail"], ["hopper", "a robot on spring legs that hops"],
    ["rover", "a six wheeled exploration rover with two arms"], ["tank_bot", "a tracked robot with a turret and a gun"], ["sentinel", "a hovering orb with a lens and two rings"],
    // the big birds of system/birds.js: three that fly, two runners
    ["andean_condor", "an Andean condor: black with a white collar, a high soarer"], ["emu", "an emu: a tall flightless runner"],
    ["golden_eagle", "a golden eagle: a brown raptor that soars and stoops"], ["ostrich", "an ostrich: a giant flightless runner"],
    ["sarus_crane", "a sarus crane: the tallest flying bird, grey with a red head"]];
  // BEGIN ANIMALS (written by system/export_animals.js: the animals of the library that are files of system/creatures/)
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
    ["wood_bison_endangered_own_66b5", "Bison, 1.7 m, herbivore"], ["zebra_old_own_af62", "Zebra, 1.35 m, herbivore"], ["zebra_poly_own_fbd7", "Zebra, 1.35 m, herbivore"]];
  // END ANIMALS
  const FOLDER = "/system/creatures/";
  const VIEWS = { front: { yaw: 0, pitch: -0.08 }, side: { yaw: Math.PI / 2, pitch: -0.08 }, three: { yaw: 0.6, pitch: -0.15 }, top: { yaw: 0.6, pitch: -1.2 } };          // (a creature faces +z: the camera at yaw 0 looks at its front)
  const MAX_ROWS = 1500, MAX_STYLES = 2500;                                                          // (the rows of a list: a set has up to 1,462 actions, a number of legs up to 2,009 styles)
  const el = function (tag, css, text) { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text !== undefined) e.textContent = text; return e; };
  const fmt = function (v) { return typeof v !== "number" ? String(v) : (Math.abs(v) >= 100 ? String(Math.round(v)) : String(+v.toFixed(2))); };

  // The action sets that were made for a kind of body: a person's (the designer's presets, the people's corpora and the captured motion), a four legged animal's, a dinosaur's, a bird's, an insect's
  const PEOPLE_SETS = /^(designed_|corpus_people|reallusion|animset|motus|happybvh|accubvh|mixamo|learned_(corpus_people|reallusion|animset|motus|happybvh|accubvh|mixamo))/;
  function body_kind(S) {                                                                            // what the body is: from its family and the number of its legs
    const fam = S.creature && S.creature.family ? S.creature.family.kind : "", n = S.legs, name = S.name || "";
    if (fam === "person" || fam === "robot") return n === 2 ? "person" : "other";
    if (fam === "animal" || fam === "flyer") return /rex|saur|dino/.test(name) ? "dinosaur" : n >= 6 ? "insect" : n === 4 ? "quadruped" : n === 2 ? "bird" : "other";
    return n === 2 && /^(walker|bolt|knight|brawler)/.test(name) ? "person" : "other";
  }
  const SUGGESTED = { person: PEOPLE_SETS, quadruped: /^(corpus|learned_corpus)_quadrupeds/, dinosaur: /^(corpus|learned_corpus)_dinosaurs/, bird: /^(corpus|learned_corpus)_birds/, insect: /^(corpus|learned_corpus)_insects/, other: /^designed_/ };
  const FIRST_SET = { person: "designed_basic", quadruped: "corpus_quadrupeds", dinosaur: "corpus_dinosaurs", bird: "corpus_birds", insect: "corpus_insects", other: "designed_basic" };

  // The creature's mind. It is SENT to the worker as text (a function cannot cross), so it holds nothing of this page: everything it uses is `api`. State of the instances is in columns indexed by the slot. (ES5 style.)
  //   message: { kind: "play", id, slot, name ("<set>::<action>"), loop, speed, power, mirror, stand }  { kind: "stop", slot }
  //   what it says back: api.post("action_state", { id, slot, ok, name, handle | error })   api.post("action_ended", { slot, how })   me.say("tau", seconds into the action) and me.say("phase", the number of its phase), ten times a second
  const mind = function (api) {
    var T_TAU = api.tag("tau"), T_PHASE = api.tag("phase");
    var last = api.i32().fill(-1), loop = api.u8(), speed = api.f32(), power = api.f32(), mirror = api.u8(), clock = api.f32();
    var begin = function (me, h) { me.act(h); me.act_opts(power[me.slot], speed[me.slot], mirror[me.slot] === 1); };
    return {
      think: function (me, dt) {
        var s = me.slot;
        if (me.acting() < 0) { clock[s] = 0; return; }
        clock[s] += dt;
        if (clock[s] >= 0.1) { clock[s] = 0; me.say(T_TAU, +me.act_tau().toFixed(2)); me.say(T_PHASE, me.act_phase_index()); }
      },
      message: function (A, data) {
        var s = data.slot;
        if (data.kind === "stop") { loop[s] = 0; try { A.at(s).act_stop(); } catch (e) { /* not live yet: nothing plays */ } return; }
        if (data.kind !== "play") return;
        try {
          var me = A.at(s), h = A.action(data.name);
          last[s] = h; loop[s] = data.loop ? 1 : 0; speed[s] = data.speed; power[s] = data.power; mirror[s] = data.mirror ? 1 : 0; clock[s] = 0;
          if (data.stand) { try { me.stop(); } catch (e) { /* a body that does not walk */ } }
          begin(me, h);
          A.post("action_state", { id: data.id, slot: s, ok: 1, name: data.name, handle: h });
        } catch (e) {
          A.post("action_state", { id: data.id, slot: s, ok: 0, name: data.name, error: String(e && e.message || e) });
        }
      },
      on: {
        emit: function (me, tag, value) { me.say(tag, value); },                           // (what an action tells: swing, impact, shoot ... comes to the page as the event of that name)
        end: function (me, how) {
          var s = me.slot;
          if (how === 0 && loop[s] === 1 && last[s] >= 0) { try { begin(me, last[s]); return; } catch (e) { loop[s] = 0; } }       // (a loop starts it again when it has finished; a stop or a new action is not a finish)
          api.post("action_ended", { slot: s, how: how });
        }
      }
    };
  };

  function ready(engine) {
    const system = engine.system;
    const scene = engine.debug.scene(), camera = scene.camera, ctl = camera.control;
    camera.update_perspective(0.05, 1500, 60);
    const S = { file: "", label: "", text: "", name: "", creature: null, def: null, sp: null, c: null, legs: 0, leg_length: 0, height: 1.8, length: 1, width: 1, own: null, own_styles: [], own_acts: 0, told: [], style: "", radius: 4,
      mode: "stand", mode_pref: /^(place|circle|stand)$/.test(q("mode") || "") ? q("mode") : "place", speed: 1.2, follow: true, fade: 0.4, all_legs: false, gait_filter: "",
      set: "", action: "", filter: "", kind_filter: "", loop: q("loop") === "1", auto: q("autoplay") !== "0", stand: true, a_speed: 1, power: 1, mirror: false, playing: null, acting: false, tau: 0, phase: -1, last: null,
      view: VIEWS[q("view")] ? q("view") : "three", show_bones: q("bones") === "1", show_feet: false, show_mesh: q("mesh") !== "0", wire: q("wire") === "1", busy: 0, error: null, sent: 0, token: 0, go: null, f0: 0, live: null };
    const demo = window.happy_creature_demo = { state: S, files: FILES.concat(ANIMALS).map(function (f) { return f[0]; }), ready: null, error: null, frames: 0, events: [], reports: [], info_text: "" };
    const ui = {}, sets = {}, loading = {}, waiting = {};
    let panel = null, set_names = [], rows = [], style_names = [], made_n = 0;

    // ---- the scene -----------------------------------------------------------------------------------------------------------------------------------------------------------------
    if (q("ui") !== "1") { try { if (window.PR$ && window.PR$.style) window.PR$.style.display = "none"; } catch (e) { /* no overlay */ } }          // (the engine's debug page has a list of numbers at the top left: not part of this page; its Sidebar is where the panel is)
    const where = function () { const m = S.sp.mirror, o = S.c.slot * 8; return [m[o], m[o + 1], m[o + 2]]; };
    function frame(view) {
      if (view) S.view = VIEWS[view] ? view : S.view;
      const v = VIEWS[S.view], h = S.height, big = Math.max(1.35 * h, S.length * 0.7, S.width * 0.6, 0.3);
      ctl.eular[0] = v.pitch; ctl.eular[1] = v.yaw; engine.tra_model.set_eular(ctl, v.pitch, v.yaw, 0);
      ctl.distance = 1.6 * big + Math.min(0.9, 1.2 * big) + 0.6;
      follow(true);
    }
    // the camera looks at the creature: at the middle of what the Sidebar leaves (half its width, as the camera sees it at that distance)
    function follow(first) {
      const v = VIEWS[S.view], p = S.sp && S.c && S.mode === "circle" ? where() : [0, 0, 0];
      const off = panel && panel.getBoundingClientRect ? (panel.getBoundingClientRect().width / 2) / ((window.innerHeight / 2) / Math.tan(Math.PI / 6)) * ctl.distance : 0;
      engine.tra_model.set_position(ctl, p[0] + Math.cos(v.yaw) * off, 0.5 * S.height, p[2] - Math.sin(v.yaw) * off);
    }
    // walking round: the place a little further along the circle round the origin is where it wants to go (the gait turns the body by stepping)
    function move_step() {
      if (S.mode !== "circle" || !S.legs || S.acting) return;
      const p = where(), a = Math.atan2(p[2], p[0]), look = Math.max(0.35, 1.5 / S.radius);
      const vx = Math.cos(a + look) * S.radius - p[0], vz = Math.sin(a + look) * S.radius - p[2], l = Math.hypot(vx, vz) || 1;
      S.sp.set_intent(S.c, vx / l * S.speed, vz / l * S.speed);
      follow();
    }
    engine.on_frame.add(function () {
      engine.debug.grid.render();
      if (S.sp && S.c) move_step();
      system.render_all();
      if (S.show_bones || S.show_feet) engine.debug.render();                                            // (the worker only QUEUES the lines of system.debug: the host draws them, as the engine's debug scene does)
      demo.frames++;
      if (S.go && demo.frames - S.f0 >= 30) { const g = S.go; S.go = null; g(); }                       // (the worker has made the columns of its family by now: it can be told things)
    });

    // ---- the creature file ---------------------------------------------------------------------------------------------------------------------------------------------------------
    function unload() {
      if (!S.sp) return;
      try { system.debug(null); } catch (e) { /* nothing drawn */ }
      try { S.sp.release(S.c); S.sp.dispose(); } catch (e) { /* gone */ }
      S.sp = null; S.c = null; S.playing = null; S.acting = false; S.legs = 0; S.live = null; S.go = null;
    }
    const url_of = function (x) { return /[\/.]/.test(x) ? x : FOLDER + x + ".js"; };
    // the text of a file -> the creature on the floor. A newer request leaves an older one's result unseen
    function make(text, label, file) {
      const token = ++S.token;
      let CF, creature, def;
      try { CF = system.creature_file_module(); creature = CF.load(text); def = CF.body_def(creature); } catch (e) { return Promise.reject(fail(e)); }
      def.name = "cd" + (++made_n) + "_" + creature.name; def.max_instances = 1;
      S.busy++; say("making " + creature.name + " (" + Math.round(text.length / 1024) + " kB) ...");
      const t0 = performance.now();
      return Promise.resolve(def.human ? system.human_creature(def) : def).then(function (made) {
        made.name = def.name; made.max_instances = 1;
        made.worker = mind;                                                                              // (BEFORE build_sdf: a file with `tissue` is expanded once into a copy of the definition, kept with it, and the species is made of that copy)
        return Promise.resolve(system.build_sdf(made)).then(function () { return made; });
      }).then(function (made) {
        S.busy--;
        if (token !== S.token) return null;
        unload();
        const sp = system.species(made), c = sp.spawn({ x: 0, y: 0, z: 0, scale: 1, yaw: 0 });
        sp.set_tier(c, "near");                                                                           // (its mind runs every frame: the progress of an action is read ten times a second)
        sp.on_worker_event = function (slot, gen, tag, value) {
          demo.events.push([tag, value]); if (demo.events.length > 300) demo.events.shift();
          if (tag === "tau") { S.tau = value; show_progress(); } else if (tag === "phase") { S.phase = value; }
          else { S.told.push(tag + (value !== 1 ? " " + fmt(value) : "")); if (S.told.length > 6) S.told.shift(); if (ui.told) ui.told.textContent = "told the page: " + S.told.join(", "); }
        };
        S.sp = sp; S.c = c; S.def = made; S.creature = creature; S.name = creature.name; S.file = file || ""; S.label = label; S.text = text;
        S.legs = sp.legs && sp.legs.legs ? sp.legs.legs.length : 0; S.leg_length = sp.legs && sp.legs.length ? sp.legs.length : 0;
        S.own_styles = register_styles(made);
        S.own = made.legs && made.legs.gait && made.legs.gait.from ? made.legs.gait.from : (S.own_styles[0] || null); S.style = made.legs && made.legs.gait && made.legs.gait.from ? S.own : "";
        S.own_acts = own_actions(made).length;
        if (S.own_acts) { S.set = "@own"; S.set_auto = true; S.action = ""; } else if (S.set === "@own") S.set = "";
        measure(made);
        S.go = null; S.f0 = demo.frames; S.live = new Promise(function (resolve) { S.go = resolve; });
        S.playing = null; S.acting = false; S.told = []; if (ui.told) ui.told.textContent = "";
        // what a body does at first: a creature with legs walks in place at the speed of its own style, one without stands
        S.mode = S.legs ? S.mode_pref : "stand";
        S.radius = Math.max(3, Math.min(25, 2.2 * Math.max(S.height, S.length) + 1.5));
        if (S.legs && S.follow) own_speed();
        apply_mode(true);
        if (S.legs && S.own && !S.style) gait(S.own, { fade: 0 });                                          // (a file that declares styles of its own stands on the first of them: its upper body is the style's)
        debug_draw(); skin_draw();
        frame();
        demo.info_text = info_text(made, creature, performance.now() - t0);
        fill_styles(); fill_sets(); sync_all();
        if (S.own_acts) choose_set("@own");                                                                 // (the list of actions is the file's own)
        S.error = null; demo.error = null;
        say(creature.name + " is on the floor (" + Math.round(performance.now() - t0) + " ms)");
        return info();
      }).catch(function (e) {
        S.busy = Math.max(0, S.busy - 1);
        const m = String(e && e.message || e);
        if (/\.happypart/.test(m)) e = new Error(m + "\n(the pieces the file names are not in the format system reads, .happypart: the file was made for another system)");
        fail(e); throw e;
      });
    }
    // the file by its name or path, the text of a file of the disk ({ text, name }), or the text itself
    function load(x) {
      if (x && typeof x === "object" && typeof x.text === "string") return make(x.text, x.name || "a file", x.name || "");
      const url = url_of(String(x)), label = url.replace(/^.*\//, "");
      say("reading " + url + " ...");
      return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ": " + r.status + " " + r.statusText); return r.text(); }).then(function (t) { return make(t, label, url); }, function (e) { throw fail(e); });
    }
    // the whole gait styles a file declares (`body.gaits`, the form of a style of the libraries) go into the page's registry: sp.set_style names them and the list of styles has them first.
    // (a design of a library style, { name, base, tweaks }, is only made by the creature's own function in the worker: it is left out here)
    function register_styles(def) {
      const names = [];
      (def.gaits || []).forEach(function (g) {
        if (!g || typeof g !== "object" || g.phase === undefined || g.speed === undefined) return;
        try { system.gaits.add(Object.assign({}, g)); names.push(g.name); } catch (e) { fail(e); }
      });
      return names;
    }
    // the actions a file declares (`body.actions`, the form of an action of the libraries) as the rows of a set of their own: the creature's function finds them by their plain names
    function own_actions(def) {
      const list = (def.actions || []).filter(function (a) { return a && a.name && a.phases; }).map(function (a) {
        const dur = a.phases.reduce(function (s, p) { return s + (p.t || 0); }, 0);
        return { set: "@own", name: a.name, ref: a.name, title: a.title || a.name, kind: a.kind || "", dur: dur, tracks: (a.tracks || []).length, events: (a.events || []).length, spec: a };
      });
      if (list.length) sets["@own"] = list; else delete sets["@own"];
      return list;
    }
    // height, length and width of the body: from its bones (the camera and the circle read them)
    function measure(def) {
      let ymax = 0, zmin = 1e9, zmax = -1e9, xmax = 0;
      (def.skeleton || []).forEach(function (b) { [b.head, b.tail].forEach(function (p) { if (!p) return; ymax = Math.max(ymax, p[1]); zmin = Math.min(zmin, p[2]); zmax = Math.max(zmax, p[2]); xmax = Math.max(xmax, Math.abs(p[0])); }); });
      S.height = Math.max(0.2, ymax || 1.8); S.length = Math.max(0.2, zmax > zmin ? zmax - zmin : 0.5); S.width = Math.max(0.2, 2 * xmax);
    }
    function mesh_of(def) { const m = def.mesh || (system.sdf_mesh(def) && system.sdf_mesh(def).mesh); return m || null; }
    function info() {
      if (!S.sp) return null;
      const d = S.def, cr = S.creature, m = mesh_of(d), g = S.sp.legs && S.sp.legs.gaits ? S.sp.legs.gaits[0] : null;
      return { name: S.name, file: S.file, bones: d.skeleton.length, legs: S.legs, leg_length: S.leg_length, height: S.height, length: S.length, width: S.width, kind: cr.family ? cr.family.kind : "", abilities: cr.abilities || [],
        vertices: m && m.positions ? m.positions.length / 3 : 0, triangles: m && m.indices ? m.indices.length / 3 : 0, own_gait: S.own, style: S.style, body: body_kind(S), numbers: g && g.numbers ? Object.assign({}, g.numbers) : null };
    }
    function info_text(def, cr, ms) {
      const i = info(), lines = [];
      lines.push(i.name + "  (" + (i.kind || "no family") + ", " + i.body + ")");
      lines.push(fmt(i.height) + " m high, " + fmt(i.length) + " long, " + fmt(i.width) + " wide;  " + i.bones + " bones" + (i.triangles ? ", " + Math.round(i.triangles) + " triangles" : ""));
      lines.push(i.legs ? i.legs + " legs (" + fmt(i.leg_length) + " m)" + (def.legs && def.legs.gait && def.legs.gait.from ? ", gait from " + def.legs.gait.from : ", a gait of its own numbers") : "no legs: it cannot take a gait");
      if (S.own_styles.length) lines.push("gait styles in the file: " + S.own_styles.join(", "));
      if (S.own_acts) lines.push("actions in the file: " + (def.actions || []).map(function (a) { return a.name; }).join(", "));
      if (cr.abilities && cr.abilities.length) lines.push("abilities: " + cr.abilities.join(", "));
      if (def.flight || def.wings || def.vehicle || def.aircraft) lines.push("has " + ["flight", "wings", "vehicle", "aircraft"].filter(function (k) { return def[k]; }).join(", ") + " (not driven here)");
      return lines.join("\n");
    }

    // ---- the gait ------------------------------------------------------------------------------------------------------------------------------------------------------------------
    // the styles that have as many legs as the creature (or every style)
    function styles() {
      if (!S.legs && !S.all_legs) return [];
      const own = S.own, mine = function (n) { return n === own || S.own_styles.indexOf(n) >= 0; }, list = system.gaits.list(S.all_legs ? {} : { legs: S.legs }).map(function (s) { return s.name; }).filter(function (n) { return n.charAt(0) !== "_"; });
      list.sort(function (a, b) {
        const pa = mine(a) ? 0 : a.indexOf("person_") === 0 && S.legs === 2 ? 1 : 2, pb = mine(b) ? 0 : b.indexOf("person_") === 0 && S.legs === 2 ? 1 : 2;
        return pa !== pb ? pa - pb : (a < b ? -1 : a > b ? 1 : 0);
      });
      return list;
    }
    function own_numbers() {
      const g = S.sp && S.sp.legs && S.sp.legs.gaits ? S.sp.legs.gaits[0] : null;
      return g && g.numbers ? g.numbers : null;
    }
    // the treadmill's speed that the gait asks: the legs' numbers are in metres (a style's speed is in leg lengths a second, the legs have it times the first leg's length)
    function own_speed() {
      const n = own_numbers();
      if (n && n.speed > 0) { S.speed = Math.min(12, +n.speed.toFixed(2)); }
    }
    // gait(name, { fade }) -> { style, ... } | null: a style of the libraries on the legs; it takes over while it walks
    function gait(name, o) {
      if (!S.sp || !S.legs) { say("this creature has no legs: no gait", true); return null; }
      o = o || {};
      let r;
      try { r = S.sp.set_style(name, { fade: o.fade !== undefined ? o.fade : S.fade }); } catch (e) { fail(e); return null; }
      S.style = name;
      if (S.follow) own_speed();
      apply_mode();
      const n = own_numbers(), rep = { style: name, gait: r.gait, from: r.from, feet: r.feet, upper: r.upper, fade: r.fade, numbers: n ? Object.assign({}, n) : null, speed_ms: S.speed };
      demo.reports.push(rep); if (demo.reports.length > 50) demo.reports.shift();
      if (ui.style_now) ui.style_now.textContent = name;
      if (ui.gait_info) ui.gait_info.textContent = "style " + name + "\nspeed " + (n ? fmt(S.leg_length > 0 ? n.speed / S.leg_length : n.speed) + " leg/s = " + fmt(n.speed) + " m/s" : "?") + (n ? "   stride " + fmt(n.stride) + "   lift " + fmt(n.step_height) : "") + "\nfeet " + (r.feet ? "yes" : "no") + ", upper body " + (r.upper ? "yes" : "no (the creature has no roles for it)");
      sync_move();
      say("gait: " + name);
      return rep;
    }
    // the way it moves: the treadmill (in place), a circle of its own, or standing
    function apply_mode(quiet) {
      if (!S.sp || !S.c) return;
      const v = S.mode === "place" && !S.acting ? S.speed : 0;
      try { S.sp.set_treadmill(S.c, 0, v); } catch (e) { /* not a body that walks */ }
      if (S.mode !== "circle") { try { S.sp.set_intent(S.c, 0, 0); } catch (e) { /* no mover */ } }
      follow();
      if (!quiet) sync_move();
    }
    function mode(m) { if (m !== "place" && m !== "circle" && m !== "stand") return S.mode; S.mode = m; if (S.legs) S.mode_pref = m; apply_mode(); return S.mode; }
    function speed(v) { S.speed = Math.max(0, +v || 0); apply_mode(); return S.speed; }
    function skin_draw() {
      if (!S.sp) return;
      S.sp.visible = S.show_mesh;
      try { S.sp.set_wireframe(S.wire); } catch (e) { /* a species with no mesh */ }
    }
    function debug_draw() {
      try { if (S.show_bones || S.show_feet) system.debug({ bones: S.show_bones, legs: S.show_feet }); else system.debug(null); } catch (e) { /* no debug draw */ }
    }

    // ---- the actions ---------------------------------------------------------------------------------------------------------------------------------------------------------------
    // a set of the pack, read once: its actions as rows { name, title, kind, dur, tracks, spec }
    function load_set(name) {
      if (sets[name]) return Promise.resolve(sets[name]);
      if (loading[name]) return loading[name];
      say("reading the set " + name + " ...");
      return (loading[name] = system.actions.set(name).then(function (f) {
        const set_name = f.name || name;
        const list = (f.actions || []).map(function (a) {
          const dur = (a.phases || []).reduce(function (s, p) { return s + (p.t || 0); }, 0);
          return { set: name, name: a.name, ref: set_name + "::" + a.name, title: a.title || a.name, kind: a.kind || "", dur: dur, tracks: (a.tracks || []).length, events: (a.events || []).length, spec: a };
        });
        sets[name] = list; delete loading[name];
        return list;
      }));
    }
    function choose_set(name) {
      S.set = name;
      if (ui.set) ui.set.value = name;
      return load_set(name).then(function (list) {
        if (S.set !== name) return list;
        const kinds_here = {}; list.forEach(function (r) { if (r.kind) kinds_here[r.kind] = true; });
        if (ui.kind_filter) { const cur = S.kind_filter; ui.kind_filter.innerHTML = ""; const o0 = el("option", "", "(every kind of action)"); o0.value = ""; ui.kind_filter.appendChild(o0); Object.keys(kinds_here).sort().forEach(function (k) { const o = el("option", "", k); o.value = k; ui.kind_filter.appendChild(o); }); S.kind_filter = kinds_here[cur] ? cur : ""; ui.kind_filter.value = S.kind_filter; }
        fill_rows(); say((name === "@own" ? "this creature's own" : name) + ": " + list.length + " actions");
        return list;
      }).catch(fail);
    }
    function fill_rows() {
      const list = sets[S.set] || [], f = S.filter.toLowerCase();
      rows = list.filter(function (r) {
        if (S.kind_filter && r.kind !== S.kind_filter) return false;
        if (!f) return true;
        return r.name.toLowerCase().indexOf(f) >= 0 || r.title.toLowerCase().indexOf(f) >= 0 || r.kind.toLowerCase().indexOf(f) >= 0 || String(r.spec.description || "").toLowerCase().indexOf(f) >= 0;
      });
      if (!ui.list) return;
      ui.list.innerHTML = "";
      if (rows.length && !row_of(S.action)) S.action = rows[0].name;                                    // (a set that was just chosen has its first action chosen)
      rows.slice(0, MAX_ROWS).forEach(function (r) { const said = r.kind && r.title.toLowerCase().slice(-r.kind.length) === r.kind.toLowerCase(), o = el("option", "", r.title + "   " + (r.kind && !said ? r.kind + "   " : "") + (r.dur ? fmt(r.dur) + " s" : "")); o.value = r.name; if (r.name === S.action) o.selected = true; ui.list.appendChild(o); });
      ui.count.textContent = rows.length + " of " + list.length + (rows.length > MAX_ROWS ? " (" + MAX_ROWS + " shown: filter them)" : "");
      show_info();
    }
    function row_of(name) { return (sets[S.set] || []).filter(function (r) { return r.name === name; })[0] || null; }
    function choose(set, name) {
      return choose_set(set).then(function () { S.action = name; if (ui.list) { Array.from(ui.list.options).forEach(function (o) { o.selected = o.value === name; }); } show_info(); sync_play(); return row_of(name); });
    }
    function show_info() {
      const r = row_of(S.action);
      if (!ui.info) return;
      if (!r) { ui.info.textContent = "choose an action in the list"; return; }
      const a = r.spec, ph = (a.phases || []).map(function (p) { return p.name + " " + fmt(p.t) + " s"; }).join("  >  ");
      const ev = (a.events || []).map(function (e) { return e.type + (e.tag ? ":" + e.tag : ""); });
      ui.info.textContent = (a.title || a.name) + "  (" + (a.kind || "action") + ", " + (a.end || "once") + ")\n" + (a.description ? a.description + "\n" : "") + fmt(r.dur) + " s, " + (a.phases || []).length + " phases, " + r.tracks + " tracks" + (ev.length ? ", events: " + ev.slice(0, 6).join(", ") : "") + (ph ? "\n" + ph : "");
    }
    const suggested = function () { return SUGGESTED[body_kind(S)] || SUGGESTED.other; };
    const can_act = function () { return !!(S.sp && (S.sp.life || S.sp.legs || S.sp.body)); };          // (what the species is given an action plan for: runtime.js worker_setup)

    // ---- playing ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
    // the worker's rich answers (api.post): that an action began, or why it could not, and that it ended
    engine.happy_worker_action_state = function (d) {
      demo.reports.push(d); if (demo.reports.length > 100) demo.reports.shift();
      const w = waiting[d.id];
      if (w) { delete waiting[d.id]; w(d); }
      if (!S.sp || d.js !== S.sp.js_id) return;
      if (d.ok) { S.playing = { name: d.name, t0: performance.now() }; S.tau = 0; say("playing " + d.name, false, true); }
      else { S.playing = null; S.acting = false; apply_mode(); fail(new Error(d.error)); }
      sync_play();
    };
    engine.happy_worker_action_ended = function (d) {
      demo.reports.push(d); if (demo.reports.length > 100) demo.reports.shift();
      if (!S.sp || d.js !== S.sp.js_id) return;
      S.playing = null; S.tau = 0; S.phase = -1;
      if (d.how !== 3) { S.acting = false; apply_mode(); }                                              // (a new action that replaced it goes on: the creature goes on standing)
      say((S.last ? S.last.title : "the action") + " " + (["finished", "was stopped", "is gone", "was replaced"][d.how] || "ended"));
      sync_play();
    };
    // play({ set?, action?, loop?, speed?, power?, mirror?, stand? }): the chosen action; resolves with what the worker answered
    function play(o) {
      o = o || {};
      if (!S.sp) return Promise.reject(fail(new Error("load a creature first")));
      if (!can_act()) return Promise.reject(fail(new Error(S.name + " cannot play actions: it has no legs, no body and no roles (the action runtime needs one of them)")));
      const r = o.action ? (sets[o.set || S.set] || []).filter(function (x) { return x.name === o.action; })[0] || row_of(o.action) : row_of(S.action);
      if (!r) return Promise.reject(fail(new Error(o.action ? "no action `" + o.action + "` in the set " + (o.set || S.set) + " (a set is read when it is chosen)" : "choose an action first")));
      const id = ++S.sent, sp = S.sp, c = S.c, stand = o.stand !== undefined ? !!o.stand : S.stand;
      S.last = r;
      return S.live.then(function () { return new Promise(function (resolve) {
        if (sp !== S.sp) { resolve(null); return; }                                                       // (another creature was made meanwhile)
        waiting[id] = resolve;
        if (stand) { S.acting = true; apply_mode(true); try { sp.set_intent(c, 0, 0); } catch (e) { /* no mover */ } }          // (it stands while it plays: the treadmill and the circle wait)
        sp.worker_send({ kind: "play", id: id, slot: c.slot, name: r.ref, loop: o.loop !== undefined ? !!o.loop : S.loop, speed: o.speed !== undefined ? o.speed : S.a_speed, power: o.power !== undefined ? o.power : S.power, mirror: o.mirror !== undefined ? !!o.mirror : S.mirror, stand: stand });
        setTimeout(function () { if (waiting[id]) { delete waiting[id]; resolve(null); } }, 8000);
      }); });
    }
    function stop() { if (S.sp) { S.sp.worker_send({ kind: "stop", slot: S.c.slot }); S.acting = false; apply_mode(); } }
    function show_progress() {
      if (!ui.bar || !S.playing) return;                                                                // (a message of the progress that comes after the end is not shown)
      const dur = S.last && S.last.dur ? S.last.dur / Math.max(0.05, S.a_speed) : 0;
      ui.bar.style.width = dur > 0 ? Math.min(100, 100 * S.tau / dur) + "%" : "0%";
      const ph = S.last && S.last.spec.phases && S.phase >= 0 ? S.last.spec.phases[S.phase] : null;
      ui.progress.textContent = fmt(S.tau) + " s" + (dur ? " of " + fmt(dur) : "") + (ph ? "   phase: " + ph.name : "");
    }
    function sync_play() {
      if (ui.play) ui.play.textContent = S.playing ? "play again" : "play";
      if (ui.bar && !S.playing) { ui.bar.style.width = "0%"; if (ui.progress) ui.progress.textContent = ""; }
    }

    // ---- the panel -----------------------------------------------------------------------------------------------------------------------------------------------------------------
    function say(m, bad, quiet) { if (ui.status) { ui.status.textContent = m; ui.status.style.color = bad ? "#f88" : "#9fd"; } }
    function fail(e) { S.error = String(e && e.message || e); demo.error = S.error; say(S.error, true); console.error("happy.system creature demo: " + (e && e.stack || e)); return e; }
    function row(parent) { const r = el("div", "display:flex;align-items:center;gap:4px;margin:3px 0"); parent.appendChild(r); return r; }
    function label(parent, text, w) { const l = el("span", "color:#9ab;width:" + (w || 52) + "px;flex:none", text); parent.appendChild(l); return l; }
    function button(parent, text, fn, title) { const b = el("button", FIELD + ";cursor:pointer;padding:2px 7px", text); if (title) b.title = title; b.addEventListener("click", function () { fn(b); b.blur(); }); parent.appendChild(b); return b; }
    function section(parent, title) { const s = el("div", "margin-top:8px"); s.appendChild(el("div", "color:#fff;border-bottom:1px solid #444;margin-bottom:3px;font-weight:bold", title)); parent.appendChild(s); return s; }
    function dropdown(parent, fn) { const s = el("select", FIELD + ";flex:1;min-width:0"); s.addEventListener("change", function () { fn(s.value); s.blur(); }); parent.appendChild(s); return s; }
    function check(parent, text, value, fn, title) {
      const l = el("label", "cursor:pointer;color:#bbb"), cb = el("input"); cb.type = "checkbox"; cb.checked = !!value; cb.addEventListener("change", function () { fn(cb.checked); });
      if (title) l.title = title; l.appendChild(cb); l.appendChild(document.createTextNode(" " + text)); parent.appendChild(l); return cb;
    }
    function slider(parent, name, min, max, step, value, unit, on_input) {
      const r = row(parent); label(r, name, 52);
      const input = el("input", "flex:1;min-width:0;height:12px"); input.type = "range"; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
      const val = el("span", "width:54px;flex:none;text-align:right;color:#9cf", fmt(value) + " " + unit);
      input.addEventListener("input", function () { val.textContent = fmt(+input.value) + " " + unit; on_input(+input.value); });
      input.addEventListener("dblclick", function () { input.value = String(value); val.textContent = fmt(value) + " " + unit; on_input(value); });
      r.appendChild(input); r.appendChild(val); return { input: input, val: val, unit: unit };
    }
    const set_slider = function (s, v) { if (s) { s.input.value = String(v); s.val.textContent = fmt(v) + " " + s.unit; } };

    function fill_files() {
      ui.files.innerHTML = "";
      FILES.forEach(function (f) { const o = el("option", "", f[0] + "   " + f[1]); o.value = f[0]; ui.files.appendChild(o); });
      if (ANIMALS.length) {
        const g = document.createElement("optgroup");
        g.label = "the library's animals (system.bin), " + ANIMALS.length;
        ANIMALS.forEach(function (f) { const o = el("option", "", f[0] + "   " + f[1]); o.value = f[0]; g.appendChild(o); });
        ui.files.appendChild(g);
      }
      const cur = S.file.replace(/^.*\//, "").replace(/\.js$/, "");
      if (cur && FILES.concat(ANIMALS).some(function (f) { return f[0] === cur; })) ui.files.value = cur;
    }
    function fill_styles() {
      if (!ui.styles) return;
      style_names = styles();
      const f = S.gait_filter.toLowerCase();
      ui.styles.innerHTML = "";
      let n = 0;
      for (let i = 0; i < style_names.length && n < MAX_STYLES; i++) { const nm = style_names[i]; if (f && nm.toLowerCase().indexOf(f) < 0) continue; const o = el("option", "", (nm === S.own || S.own_styles.indexOf(nm) >= 0 ? "* " : "") + nm); o.value = nm; if (nm === S.style) o.selected = true; ui.styles.appendChild(o); n++; }
      ui.styles_count.textContent = !S.legs && !S.all_legs ? "no legs: no gait" : (f ? n + " of " : "") + style_names.length + " styles with " + (S.all_legs ? "any number of" : S.legs) + " legs" + (n >= MAX_STYLES ? " (" + MAX_STYLES + " shown: filter them)" : "") + (S.own ? ";  * is the creature's own" : "");
      ui.own.disabled = !S.own;
    }
    function fill_sets() {
      if (!ui.set) return;
      ui.set.innerHTML = "";
      const re = suggested(), mine = set_names.filter(function (n) { return re.test(n); }), other = set_names.filter(function (n) { return !re.test(n); });
      if (sets["@own"]) { const og = el("optgroup"); og.label = "in this creature's file"; const o = el("option", "", "this creature's own  (" + sets["@own"].length + ")"); o.value = "@own"; og.appendChild(o); ui.set.appendChild(og); }
      [["made for this body (*)", mine], ["other sets", other]].forEach(function (g) {
        if (!g[1].length) return;
        const og = el("optgroup"); og.label = g[0];
        g[1].forEach(function (n) { const info = system.actions.sets().filter(function (x) { return x.name === n; })[0], o = el("option", "", n + (info ? "  (" + info.count + ")" : "")); o.value = n; og.appendChild(o); });
        ui.set.appendChild(og);
      });
      if (!S.set || (S.sp && S.set !== "@own" && !re.test(S.set) && S.set_auto)) { const w = set_names.indexOf(FIRST_SET[body_kind(S)]) >= 0 ? FIRST_SET[body_kind(S)] : mine[0] || set_names[0]; S.set_auto = true; if (w) choose_set(w); }
      ui.set.value = S.set;
    }
    function sync_move() {
      if (ui.mode) ui.mode.value = S.mode;
      set_slider(ui.speed, S.speed);
      if (ui.follow) ui.follow.checked = S.follow;
      if (ui.style_now) ui.style_now.textContent = S.style || (S.legs ? "(made of numbers)" : "(no legs)");
      if (ui.styles) Array.from(ui.styles.options).forEach(function (o) { o.selected = o.value === S.style; });
    }
    function sync_all() {
      sync_move(); sync_play(); fill_files();
      if (ui.card) ui.card.textContent = demo.info_text;
      if (ui.legs_only) ui.legs_only.style.opacity = S.legs ? "1" : "0.4";
      if (ui.gait_info) ui.gait_info.textContent = S.legs ? "choose a style in the list" : "this creature has no legs";
      if (ui.act_note) ui.act_note.textContent = can_act() ? "" : S.name + " cannot play actions: it has no legs, no body and no roles";
    }
    function build_ui() {
      panel = el("div", "background:rgba(24,24,28,0.95);color:#ddd;font:11px monospace;padding:6px 8px;box-sizing:border-box;width:100%");
      panel.id = "creature_demo";
      ["keydown", "keyup"].forEach(function (t) { panel.addEventListener(t, function (e) { e.stopPropagation(); }); });          // (typing in a box does not move the camera)
      panel.appendChild(el("div", "font:bold 13px monospace;color:#fff;margin-bottom:4px", "CREATURE DEMO"));
      ui.status = el("div", "color:#9fd;min-height:14px;margin-bottom:2px;word-break:break-word"); panel.appendChild(ui.status);

      const a = section(panel, "1. A CREATURE FILE");
      let r = row(a); label(r, "file"); ui.files = dropdown(r, function (v) { load(v).catch(function () { /* said */ }); });
      r = row(a); label(r, "path");
      ui.path = el("input", FIELD + ";flex:1;min-width:0"); ui.path.placeholder = FOLDER + "name.js  (or any url)"; ui.path.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter" && ui.path.value) load(ui.path.value).catch(function () { /* said */ }); }); r.appendChild(ui.path);
      button(r, "load", function () { if (ui.path.value) load(ui.path.value).catch(function () { /* said */ }); });
      r = row(a); label(r, "disk");
      ui.pick = el("input", "flex:1;min-width:0;color:#bbb;font:11px monospace"); ui.pick.type = "file"; ui.pick.accept = ".js,text/javascript"; ui.pick.addEventListener("change", function () { if (ui.pick.files && ui.pick.files[0]) read_file(ui.pick.files[0]); }); r.appendChild(ui.pick);
      r = row(a); button(r, "make it again", function () { if (S.text) make(S.text, S.label, S.file).catch(function () { /* said */ }); }, "the same file, a fresh creature (its own gait back, the pose it started in)");
      ui.card = el("pre", "margin:3px 0 0;white-space:pre-wrap;color:#cde;font:11px monospace", "loading the system ..."); a.appendChild(ui.card);
      a.appendChild(el("div", "color:#778;margin-top:2px", "or drop a creature file of your disk on the page"));

      const m = section(panel, "2. MOVE"); ui.legs_only = m;
      r = row(m); label(r, "move"); ui.mode = dropdown(r, function (v) { mode(v); });
      [["place", "in place (a treadmill)"], ["circle", "round in a circle (its own steps)"], ["stand", "stand"]].forEach(function (p) { const o = el("option", "", p[1]); o.value = p[0]; ui.mode.appendChild(o); });
      ui.mode.value = S.mode;
      ui.speed = slider(m, "speed", 0, 12, 0.05, S.speed, "m/s", function (v) { S.speed = v; S.follow = false; if (ui.follow) ui.follow.checked = false; apply_mode(true); });
      r = row(m); ui.follow = check(r, "speed follows the style", S.follow, function (on) { S.follow = on; if (on) { own_speed(); apply_mode(); } }, "the treadmill and the circle go at the speed the style asks for (its own, in the creature's leg lengths)");
      r = row(m); label(r, "view"); Object.keys(VIEWS).forEach(function (k) { button(r, k === "three" ? "3/4" : k, function () { frame(k); }); });
      r = row(m); label(r, "draw"); ui.bones = check(r, "bones", S.show_bones, function (on) { S.show_bones = on; debug_draw(); }); ui.feet = check(r, "feet", S.show_feet, function (on) { S.show_feet = on; debug_draw(); }, "the feet, their stance places and the reach of each leg");
      ui.mesh = check(r, "mesh", S.show_mesh, function (on) { S.show_mesh = on; skin_draw(); }, "off: only the skeleton (with bones on) is seen"); ui.wire = check(r, "wire", S.wire, function (on) { S.wire = on; skin_draw(); }, "the mesh as a wireframe");

      const g = section(panel, "3. A GAIT");
      ui.style_now = el("div", "color:#fc6;margin-bottom:2px;word-break:break-all", ""); g.appendChild(ui.style_now);
      r = row(g); label(r, "find");
      ui.gait_find = el("input", FIELD + ";flex:1;min-width:0"); ui.gait_find.placeholder = "walk, run, cmu, lion, trot ..."; ui.gait_find.addEventListener("input", function () { S.gait_filter = ui.gait_find.value; fill_styles(); }); ui.gait_find.addEventListener("keydown", function (e) { e.stopPropagation(); }); r.appendChild(ui.gait_find);
      ui.styles = el("select", FIELD + ";width:100%"); ui.styles.size = 9;
      ui.styles.addEventListener("change", function () { if (ui.styles.value) gait(ui.styles.value); });             // (a style chosen in the list goes on the legs at once: the arrow keys go down the list and try each one)
      g.appendChild(ui.styles);
      ui.styles_count = el("div", "color:#778"); g.appendChild(ui.styles_count);
      r = row(g); ui.own = button(r, "its own gait", function () { if (S.own) gait(S.own); }, "the style the creature's file names (legs.gait.from)");
      check(r, "any legs", S.all_legs, function (on) { S.all_legs = on; fill_styles(); }, "list the styles of every number of legs (the order of the steps is made again for this creature's legs, but the stride and the foot's path are of the body the style was recorded on: it may look odd)");
      const fd = slider(g, "fade", 0, 2, 0.05, S.fade, "s", function (v) { S.fade = v; }); ui.fade = fd;
      ui.gait_info = el("pre", "margin:3px 0 0;white-space:pre-wrap;color:#cde;font:11px monospace", ""); g.appendChild(ui.gait_info);

      const b = section(panel, "4. AN ACTION");
      ui.act_note = el("div", "color:#f88;word-break:break-word"); b.appendChild(ui.act_note);
      r = row(b); label(r, "set"); ui.set = dropdown(r, function (v) { S.set_auto = false; choose_set(v); });
      r = row(b); label(r, "kind"); ui.kind_filter = dropdown(r, function (v) { S.kind_filter = v; fill_rows(); });
      r = row(b); label(r, "find");
      ui.find = el("input", FIELD + ";flex:1;min-width:0"); ui.find.placeholder = "name, kind, words of the description"; ui.find.addEventListener("input", function () { S.filter = ui.find.value; fill_rows(); }); ui.find.addEventListener("keydown", function (e) { e.stopPropagation(); }); r.appendChild(ui.find);
      ui.list = el("select", FIELD + ";width:100%"); ui.list.size = 10;
      ui.list.addEventListener("change", function () { S.action = ui.list.value; show_info(); sync_play(); if (S.auto) play().catch(function () { /* said */ }); });          // (changing the action in the list plays it: the arrow keys go down the list and play each one)
      ui.list.addEventListener("dblclick", function () { play().catch(function () { /* said */ }); });
      ui.list.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") { S.action = ui.list.value; play().catch(function () { /* said */ }); } });
      b.appendChild(ui.list);
      ui.count = el("div", "color:#778"); b.appendChild(ui.count);
      ui.info = el("pre", "margin:3px 0 0;white-space:pre-wrap;color:#cde;font:11px monospace;max-height:130px;overflow:auto", "choose an action in the list"); b.appendChild(ui.info);
      r = row(b);
      ui.play = button(r, "play", function () { play().catch(function () { /* said */ }); }, "the chosen action (double click a row, or Enter, does it too)");
      button(r, "stop", function () { stop(); }, "the creature stops its action");
      check(r, "loop", S.loop, function (on) { S.loop = on; });
      check(r, "mirror", S.mirror, function (on) { S.mirror = on; });
      r = row(b); check(r, "stand still while it plays", S.stand, function (on) { S.stand = on; }, "the treadmill and the circle wait until the action is over");
      r = row(b); check(r, "play at once when the action is changed", S.auto, function (on) { S.auto = on; }, "?autoplay=0 starts with it off");
      slider(b, "speed", 0.25, 2.5, 0.05, 1, "x", function (v) { S.a_speed = v; });
      slider(b, "power", 0, 2, 0.05, 1, "x", function (v) { S.power = v; });
      const pb = el("div", "height:6px;background:#333;margin:4px 0 1px;border-radius:3px;overflow:hidden"); ui.bar = el("div", "height:100%;width:0%;background:#fc6"); pb.appendChild(ui.bar); b.appendChild(pb);
      ui.progress = el("div", "color:#9cf;min-height:13px"); b.appendChild(ui.progress);
      ui.told = el("div", "color:#8a9;min-height:13px;word-break:break-word"); b.appendChild(ui.told);

      panel.appendChild(el("div", "color:#778;margin-top:8px", "mouse: left drag turns, right drag pans, wheel zooms. an action plays on whatever body the creature has: a part the body lacks (an arm of a horse) is left out."));
      if (dom && dom.sidebar$ && dom.$ && dom.$.div && dom.$.div.collapseable) {                           // (the engine's own sidebar, at the right: a section that collapses)
        dom.sidebar$.appendChild(dom.$.div.collapseable({ heading: "Creature demo" }, panel));
        try { dom.sidebar$.style.width = "350px"; } catch (e) { /* its own width */ }
        try { let n = dom.sidebar$.parentNode; while (n && n !== document.body) { if (n.classList && n.classList.contains("collapsed")) n.classList.remove("collapsed"); if (n.style && /position:\s*absolute/.test(n.getAttribute("style") || "")) { n.style.position = "fixed"; n.style.top = "0"; n.style.right = "0"; } n = n.parentNode; } } catch (e) { /* it stays as it is */ }
      } else { panel.style.cssText += ";position:fixed;right:0;top:0;bottom:0;width:350px;overflow-y:auto;z-index:30"; document.body.appendChild(panel); }
    }

    // a file of the disk: dropped on the page, or chosen with the button
    function read_file(f) {
      const rd = new FileReader();
      rd.onload = function () { load({ text: String(rd.result), name: f.name }).catch(function () { /* said */ }); };
      rd.onerror = function () { fail(new Error("cannot read " + f.name)); };
      rd.readAsText(f);
    }
    window.addEventListener("dragover", function (e) { e.preventDefault(); });
    window.addEventListener("drop", function (e) { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) read_file(f); });

    // ---- start ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
    system.init({ table_bytes: 128 << 20, max_species: 16 });
    build_ui(); say("loading the system ...");
    demo.load = load; demo.make = make; demo.info = info; demo.styles = styles; demo.gait = gait; demo.mode = mode; demo.speed = speed; demo.choose = choose; demo.load_set = load_set; demo.play = play; demo.stop = stop; demo.view = frame; demo.system = system;
    demo.bones = function (on) { S.show_bones = on !== false; if (ui.bones) ui.bones.checked = S.show_bones; debug_draw(); }; demo.feet = function (on) { S.show_feet = on !== false; if (ui.feet) ui.feet.checked = S.show_feet; debug_draw(); };
    demo.rows = function () { return rows.slice(); };
    demo.sets = function () { const re = suggested(); return system.actions.sets().map(function (x) { return { name: x.name, count: x.count, suggested: re.test(x.name) }; }); };
    demo.sample = function (names) {
      const out = { t: performance.now(), root: [], p: {} };
      if (!S.sp) return out;
      const m = S.sp.mirror, o = S.c.slot * 8;
      out.root = [m[o], m[o + 1], m[o + 2], m[o + 3]];
      (names || S.def.skeleton.map(function (b) { return b.name; })).forEach(function (n) { try { out.p[n] = S.sp.bone_world(S.c, n); } catch (e) { /* not a bone */ } });
      return out;
    };
    demo.ready = system.load("/system/system.bin", { all: true }).then(function () {
      set_names = system.actions.sets().map(function (x) { return x.name; });
      fill_files(); fill_sets();
      return load(q("file") || "brawler");
    }).then(function () {
      if (q("gait")) gait(q("gait"));
      if (q("speed") !== null && isFinite(+q("speed"))) { S.follow = false; speed(+q("speed")); sync_move(); }
      if (q("set") && set_names.indexOf(q("set")) >= 0) { S.set_auto = false; return choose_set(q("set")); }
      return null;
    }).then(function () {
      fill_sets();
      const want = q("action");
      return want ? choose(S.set, want) : (rows[0] ? choose(S.set, rows[0].name) : null);
    }).then(function () {
      if (q("play") === "1") return play();
      return null;
    }).then(function () { console.log("happy.system creature demo: " + S.name + " is on the floor"); }, function (e) { fail(e); });
  }

  engine({})(ready);
});
