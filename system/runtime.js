// THE RUNTIME: the link to the worker, the drawing (one instanced draw a species), variants, culling, skins, particles, family props and the frame.
// Ported 2026-11-05 from the first version of the creature system, renamed and merged by domain. From here this file is the source.
// Its parts are INCLUDED (the bundler's import directive) into the one closure that makes engine.system (system.js), so each sees every name of the parts before it.

      // ========================================================================================================================
      // worker_link
      // ========================================================================================================================
// system.js, a part: the LINK to the worker's JS side (SYSTEM.md, "The worker's logic"; pure.js is the other end).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js (after the species and the live style: it adds to the species' prototype).
      // ---- the worker's own copy of what it needs of a species and of the libraries --------------------------------------------------------------------------
      // The logic of the creatures runs in the worker (a creature's gait styles, its actions, its AI), so the worker has to be able to do what the page does for a species when a style is put on its legs: compile the legs from the
      // species' skeleton and rig and a style of the library (kernel.js, the same file as the page's). The page gives it the species once, as plain data, and the libraries are read by the worker itself.
      //   sp.worker_install()           posts the species to the worker (engine._worker, { call: "happy_worker_install" }): its compiled skeleton and rig (typed arrays and numbers: a structured clone carries them), the legs, roles and
      //                                 traits of its definition (what a style is compiled with) and how many gaits and which flags its compiled legs have. The worker answers nothing; a species that has no legs has nothing to install.
      //   system.worker_gaits(urls)       the worker reads libraries of gait styles itself (fetch, system.gaits.load in its own registry): the urls are the page's (happy_gaits/*.gaits.json; made absolute here: a worker made
      //                                 from a blob has no base of its own)
      // What the worker has of a species is asked for by tests (the worker's selftest and plan probe: pure.js, system.js); a page has no use for it.
      // the page's own action runtime makes the plan of a species (which bones play which role, the arms, the legs' rest places): the files of the designer, as they are, used for that and nothing else
      const AP = pure.happy_action_player();
      const AR = pure.happy_action_runtime();
      let plan_rt = null;
      const link_post = function (what, msg) {
        if (!engine._worker || typeof engine._worker.postMessage !== "function") throw new Error("system: " + what + ": there is no worker (engine._worker) to give it to");
        engine._worker.postMessage(msg);
      };
      SP.worker_install = function () {
        need(this, "worker_install", "legs");
        const d = this.input || {}, pick = { legs: d.legs, roles: d.roles, traits: d.traits, human: d.human ? true : undefined };
        if (d.system && typeof d.system === "object") pick.system = { legs: d.system.legs, roles: d.system.roles, traits: d.system.traits };
        link_post("worker_install", { call: "happy_worker_install", js: this.js_id, name: this.name, sk: this.sk, rig: this.rig, input: pick, ngaits: this.legs.gaits.length, declared: this.legs.declared, flags: this.legs.words[2], fingers: this.finger_table ? this.finger_table() : null });
      };
      // the worker's actions: system.worker_actions(urls) has it read libraries of actions itself (happy_actions/*.json: the worker registers them by name and compiles an action when it is first used);
      // sp.worker_action_plan(plan) gives it what an action needs of the species: the PLAN that the action runtime makes (action_designer/action_runtime.js, rt.plan(sp): which bones play which role, the arms, the legs' rest
      // places, the body), plain data, with the overlay slot of every bone and the body's gravity added here
      // a url made absolute for the worker (a blob has no base): "/x" is relative to the site root (window.HAPPY_ROOT, the folder of packing.js), so a site under /repo/ works
      const happy_abs = function (u) { if (typeof window !== "undefined" && window.HAPPY_ROOT && /^\/(?!\/)/.test(u)) return window.HAPPY_ROOT + u; return new URL(u, location.href).href; };
      system.worker_actions = function (urls) {
        if (!Array.isArray(urls) || urls.some(function (u) { return typeof u !== "string"; })) throw new Error("system: worker_actions: a list of urls of libraries of actions (happy_actions/*.json)");
        link_post("worker_actions", { call: "happy_worker_actions", urls: urls.map(function (u) { return typeof location !== "undefined" ? happy_abs(u) : u; }) });
      };
      // THE PACK for the worker: system.worker_pack(url, { gaits: [library names], actions: [set names] }) has the worker read system.bin ITSELF (data.js is in the worker too) and put the gait libraries in its registry and
      // the action sets in its library; the page's `system.use(...)` (system.js) does it for both sides. The url is made absolute (a worker made from a blob has no base of its own)
      system.worker_pack = function (url, what) {
        if (typeof url !== "string" || !what || typeof what !== "object") throw new Error("system: worker_pack(url, { gaits: [names], actions: [names] })");
        link_post("worker_pack", { call: "happy_worker_pack", url: typeof location !== "undefined" ? happy_abs(url) : url, gaits: what.gaits || [], actions: what.actions || [] });
      };
      // THE WORLD (SYSTEM.md). system.worker_modules(urls | { name: text }): AI blocks as MODULES (world/blocks/*.js: a file that ends with `return { name, params, plug, worker }`; a creature's worker loads them by name with
      // api.blocks.load([...])); a url is a block file or a JSON bundle { format: "system-world-blocks", blocks: { name: text } }. system.worker_world(spec, creature_blocks) installs a world's spec (world/world_spec.js `build().spec`)
      // in the worker: its nav is baked there, its slots, zones and props are what `api.sw` answers from; the creature blocks the WORLD brings go with it. system.worker_world_state(diff) changes what the page's world blocks move
      // ({ gates: [[gate, 0 open | 1 closed | 2 locked]], ent: [[entity, key, value]], scenes: [[scene, 0 active | 1 dormant | 2 unloaded]] }). What the creatures ask of the world (effects, props, interactions, their life) comes back as
      // system.on_world_requests({ n, data, names, names_at }) (world/world_host.js reads it). All of it is ordered with the libraries and the species, as the gaits and the actions are.
      const absolute = function (u) { return typeof location !== "undefined" ? happy_abs(u) : u; };
      system.worker_modules = function (what) {
        if (Array.isArray(what)) { if (what.some(function (u) { return typeof u !== "string"; })) throw new Error("system: worker_modules: a list of urls"); link_post("worker_modules", { call: "happy_worker_modules", urls: what.map(absolute) }); }
        else if (what && typeof what === "object" && Object.keys(what).every(function (k) { return typeof what[k] === "string"; })) link_post("worker_modules", { call: "happy_worker_modules", urls: [], texts: what });
        else throw new Error("system: worker_modules(urls | { name: text of a block file })");
      };
      system.worker_world = function (spec, creature_blocks) {
        if (!spec || spec.format !== "system-world") throw new Error("system: worker_world(spec): the spec of a world (world_spec.js build().spec)");
        link_post("worker_world", { call: "happy_worker_world", spec: spec, creature_blocks: creature_blocks || {} });
      };
      system.worker_world_state = function (diff) { link_post("worker_world_state", { call: "happy_worker_world_state", diff: diff }); };
      system.on_world_requests = null;
      engine.happy_world_requests = function (m) { if (typeof system.on_world_requests === "function") system.on_world_requests(m); };
      SP.worker_action_plan = function (plan) {
        if (plan === undefined) plan = (plan_rt || (plan_rt = AR.create(system, { player: AP }))).plan(this);              // (no plan given: the page's runtime makes it)
        if (!plan || !plan.groups || !plan.bones) throw new Error("system: worker_action_plan: the plan of rt.plan(sp) (action_designer/action_runtime.js)");
        const pl = Object.assign({}, plan), sk = this.sk, L = this.life;
        delete pl.sp;
        pl.bone_slot = new Int16Array(sk.n).fill(-1);
        if (L) sk.names.forEach(function (nm, b) { const k = L.slot_of[nm]; if (k !== undefined) pl.bone_slot[b] = k; });
        pl.gravity = this.body && this.body.gravity > 0 ? this.body.gravity : 0;
        link_post("worker_action_plan", { call: "happy_worker_action_plan", js: this.js_id, plan: pl });
      };
      // A CREATURE'S FUNCTION FOR THE WORKER (pure.js): the definition may carry `worker: function (api) { ...; return { think(me, dt) { ... }, ... }; }`. The page sends its SOURCE (a function cannot cross to the worker, so
      // it has to be self-contained: it takes everything it uses from `api`) with what the worker needs of the species (sp.worker_setup: the species' data, the plan of its actions, the function), when the species is made. The worker
      // calls the function once for the family, after the libraries that were asked for (system.worker_gaits / worker_actions) are in, and runs its hooks every frame before the system frame. What the creature `say`s comes back as
      // sp.on_worker_event(slot, generation, tag, value) (tag: its name)
      //   sp.worker_context(fn | source)      sp.worker_setup(fn | source)      system.worker_tags: the names of the tags that creatures have made
      SP.worker_context = function (fn) {
        const src = typeof fn === "function" ? Function.prototype.toString.call(fn) : String(fn);
        // the creature's OWN actions and gaits (its definition's `actions: [...]`, `gaits: [...]`: JSON; pure.js `declare`, SYSTEM.md "Actions and gaits of its own") go with the function and are made before it is called
        // and its PROPS (the definition's `props`, resolved to bone numbers by system.compile: the worker shows and hides them, SYSTEM.md "Props a creature shows and hides")
        const inp = this.input || {}, dd = {};
        if (inp.actions !== undefined) dd.actions = inp.actions;
        if (inp.gaits !== undefined) dd.gaits = inp.gaits;
        if (this.prop_defs) dd.props = this.prop_defs;
        // and the FAMILY PROPS (the file's `props`, runtime.js): their names, how many, the places the mind may name: me.take / me.put / me.release / me.throw / me.holding
        if (this.fprops) dd.fprops = system.fp_worker_defs(this.fprops);
        const defs = Object.keys(dd).length ? JSON.parse(JSON.stringify(dd)) : undefined;
        link_post("worker_context", { call: "happy_worker_context", js: this.js_id, name: this.name, max: this.max_instances, src: src, mind: this.mind_on !== false, defs: defs, cfg: this.worker_cfg ? JSON.parse(JSON.stringify(this.worker_cfg)) : undefined });
      };
      SP.worker_setup = function (fn) {
        if (this.legs) this.worker_install();
        if (this.life || this.legs || this.body) this.worker_action_plan();
        this.worker_context(fn);
      };
      // sp.worker_send(data): a message to the creature's function (its `message(api, data)` hook), in the order of the other messages (the libraries, the species, the function)
      SP.worker_send = function (data) { link_post("worker_send", { call: "happy_worker_message", js: this.js_id, data: data }); };
      system.worker_tags = [];
      // system.worker_logic_stats({ timing, reset }) -> Promise of what the families' logic cost in the worker: { frames, tick_ms, families: [{ name, alive, ai, ai_visits, ai_ms, thinks, errors }] } (the times are 0 until timing is on)
      const stats_wait = {};
      let stats_id = 0;
      system.worker_logic_stats = function (opts) {
        const id = ++stats_id;
        return new Promise(function (resolve) {
          stats_wait[id] = resolve;
          link_post("worker_logic_stats", { call: "happy_worker_logic_stats", id: id, timing: opts && opts.timing, reset: !!(opts && opts.reset) });
        });
      };
      engine.happy_worker_logic_stats_reply = function (m) { const f = stats_wait[m.id]; if (f) { delete stats_wait[m.id]; f(m.report); } };
      // ---- NUMBERS, NOT OBJECTS: what the page says to a creature's function that happens often (the user did something, an event), and what creatures say back, goes in the engine's own buffers, as system's other commands do.
      //   sp.worker_msg(id, slot, a, b, ...)      any number of numbers (1000 at most) to the `msg(api, m)` hook of the family, about the instance `slot`; `id` is a whole number that the page and the creature's function agree on
      // It is a command (CMD_HAPPY_MSG) in system's queue: it goes with the other commands, in their order (an instance is spawned before a message about it), in the payload that goes to the worker anyway. Nothing is serialized and nothing
      // is allocated for it once the queue has grown to the size it needs. What a creature says (me.say) comes back as a command in the response (CMD_HAPPY_EVENTS) and is read here: sp.on_worker_event(slot, generation, tag, value).
      // sp.worker_send(data) (above) still serializes: it is for what is rare and rich (a design, a configuration), not for what happens often.
      SP.worker_msg = function (id, slot) {
        const n = arguments.length - 2;
        if (!(id >= 0 && id < 65536 && id === Math.floor(id)) || !(slot >= 0 && slot < 65536) || n > 1000) throw new Error("system: worker_msg(id, slot, numbers ...): a whole number below 65536 for the message, a slot, and up to 1000 numbers");
        q_begin(5 + n); q_u(CMD_HAPPY_MSG); q_u(n); q_u(this.js_id); q_u(slot); q_u(id);
        for (let k = 0; k < n; k++) q_f(arguments[k + 2]);
      };
      // ---- THE AI WATCH (pure.js, "THE AI WATCH"; the AI editor's preview): messages of the engine's own, answered by a family that has an `ai` (the creature needs no `msg` hook for them)
      //   sp.ai_watch(on)         the instances say which LEAF of their tree runs, as the event "ai_node" (sp.on_worker_event(slot, gen, "ai_node", id): the id is the place of the node in the tree read from the root down, the root is 0, -1 none), every
      //                           time it changes; and the SHAPE of the tree comes once, as sp.on_worker_ai_shape({ parent, idx, kind }) (and stays as sp.ai_shape). Say it again when the species is made again: the worker's context is new then
      //   sp.ai_force(slot, node) that node runs now whatever its `when` and cooldown say (its ancestors are entered as if the tree had come down to it), and the tree goes on from there      sp.ai_restart(slot)   it decides again
      //   sp.ai_play(slot, name)   sp.ai_gait(slot, name)   sp.ai_preview_stop(slot)   the instance plays a clip of the libraries, or walks in a circle in a gait style, whatever the tree does (pause it first); the worker says "ai_preview" (1 it plays, -1 no such name, -2 no spare gait slots, 0 stopped)
      //                           and the gait the TREE puts on an instance as "ai_gait" (the id of the style; sp.ai_gaits[id] is its name: sp.on_worker_ai_gaits(names))
      //   sp.ai_pause(on)         every instance of the family stands and decides nothing by itself (the ones born later too); sp.ai_force(slot, node) then runs that node BY ITSELF and the instance stands again when it is done. false: they are let go
      SP.ai_watch = function (on) { this.worker_msg(65520, 0, on ? 1 : 0); };
      SP.ai_force = function (slot, node) { this.worker_msg(65521, slot, node); };
      SP.ai_restart = function (slot) { this.worker_msg(65522, slot); };
      SP.ai_pause = function (on) { this.worker_msg(65523, 0, on ? 1 : 0); };
      // ---- THE MIND: the creature's OWN function for the worker (its definition's `worker`: the spawn / think / tick that wander, wave at a neighbour, the `ai` tree) decides for it, or it does not
      //   sp.mind(on)             the whole family (the instances born later too); system.species(def, { mind: false }) makes the family without its mind     sp.mind(on, c)   one instance (c: what sp.spawn gave, or its slot)
      //   sp.mind_on              what the family's mind is (the page's copy)       sp.has_worker   true when the definition has a worker (there is a mind to turn off)
      // Off: no think, no visit of the tree, no tick; the wish it had is stopped once. Whatever the page asks (a gait, an action, sp.worker_send), a hit, and the events still go through: the creature is YOURS. On: it decides again
      SP.mind = function (on, c) {
        let slot = 65535;
        if (c !== undefined && c !== null) { slot = typeof c === "object" ? c.slot : c; if (!(slot >= 0 && slot < 65535 && slot === Math.floor(slot))) throw new Error("system: mind(on, c): c is an instance, or a whole number slot below 65535"); }
        else this.mind_on = !!on;
        this.worker_msg(65527, slot, on ? 1 : 0);
        return this;
      };
      const codes = function (name) { const a = []; for (let i = 0; i < name.length && i < 200; i++) a.push(name.charCodeAt(i)); return a; };
      SP.ai_play = function (slot, name) { this.worker_msg.apply(this, [65524, slot].concat(codes(String(name)))); };           // (a clip of the libraries plays on the instance; the name goes as character codes)
      SP.ai_gait = function (slot, name) { this.worker_msg.apply(this, [65525, slot].concat(codes(String(name)))); };           // (the instance walks in a circle in that gait style)
      SP.ai_preview_stop = function (slot) { this.worker_msg(65526, slot); };
      engine.happy_worker_ai_gaits = function (m) {
        const sp = species_map.get(m.js);
        if (!sp) return;
        sp.ai_gaits = m.names;
        if (typeof sp.on_worker_ai_gaits === "function") sp.on_worker_ai_gaits(m.names);
      };
      // WHAT A CREATURE'S GOALS ARE DOING (world/blocks/goals.js, `msg_report`; world/world_goals_watch.js is the page's side of it): the answer to the page's question, an object { js, slot, gen, t, ids, report?, stats? }, as sp.on_worker_goals(m)
      engine.happy_worker_goals = function (m) {
        const sp = species_map.get(m.js);
        if (sp && typeof sp.on_worker_goals === "function") sp.on_worker_goals(m);
      };
      engine.happy_worker_ai_shape = function (m) {
        const sp = species_map.get(m.js);
        if (!sp) return;
        sp.ai_shape = m.shape;
        if (typeof sp.on_worker_ai_shape === "function") sp.on_worker_ai_shape(m.shape);
      };
      system.on_events = function (u32, f32, i) {
        const n = u32[i++], end = i + n;
        for (; i + 4 <= end; i += 4) {
          const sp = species_map.get(u32[i] >>> 16);
          if (sp && sp.fx) system.fx_tag(sp, u32[i] & 0xffff, system.worker_tags[u32[i + 2]], f32[i + 3]);                  // (me.fx(name, v) in the worker: runtime.js)
          if (sp && sp.fprops) system.fp_tag(sp, u32[i] & 0xffff, u32[i + 1], system.worker_tags[u32[i + 2]], f32[i + 3]);    // (me.take / put / release / throw: runtime.js)
          if (sp && typeof sp.on_worker_event === "function") sp.on_worker_event(u32[i] & 0xffff, u32[i + 1], system.worker_tags[u32[i + 2]], f32[i + 3]);
        }
        return end;
      };
      engine.happy_worker_tags = function (m) { system.worker_tags = m.tags; };
      system.worker_gaits = function (urls) {
        if (!Array.isArray(urls) || urls.some(function (u) {
          return typeof u !== "string";
        }))
          throw new Error("system: worker_gaits: a list of urls of libraries of gait styles (happy_gaits/*.gaits.json)");
        link_post("worker_gaits", {
          call: "happy_worker_gaits", urls: urls.map(function (u) {
            return typeof location !== "undefined" ? happy_abs(u) : u;
          })
        });
      };

      // ========================================================================================================================
      // draw
      // ========================================================================================================================
// system.js, a part: drawing: the texture a species' rows go to, its geometry and material, the instanced draw.
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- drawing -----------------------------------------------------------------------------------------------------------------------------------------
      // A species is DRAWN by one instanced draw: its mesh once (bind position and normal, the colour, up to four bones and weights a vertex), every instance as a row of the species' TEXTURE (the instance's root, then
      // the skinning transform of each of its bones: the rows the worker sends, kept in sp.mirror), read by the vertex shader (mesh.js) with gl_InstanceID. So a crowd of any number is ONE draw call and one upload of the
      // rows that changed; the cost is the vertices of the mesh times the instances, and the page spends nothing per instance but the copy of its rows.
      // a species' texture has a row of W texels for every W / (2 + 2 bones) instances: one that needs more rows than the GPU's largest texture is refused, before anything is sent to the worker
      function texture_fits(name, max_instances, bones) {
        const gl = engine.webgl && engine.webgl.gl, limit = gl && gl.getParameter ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 0, rows = Math.ceil(max_instances * 2 / W) + Math.ceil(max_instances * bones * 2 / W);
        if (limit > 0 && rows > limit) throw new Error("system: species '" + name + "': " + max_instances + " instances of " + bones + " bones need a texture of " + rows + " rows and the largest this GPU makes is " + limit + ": lower max_instances (about " + Math.floor((limit - 2) * W / (2 + 2 * bones)) + " fit)");
      }
      function make_gl_resources(sp) {
        texture_fits(sp.name, sp.max_instances, sp.bone_count);                                       // (system.species asks it first, before the worker hears of the species: a species that was made with no mesh and gets one later comes here)
        sp.info = new Float32Array([W, sp.rows, sp.root_rows * W, sp.bone_count]);
        sp.tex = engine.textures.create({ width: W, height: sp.rows, clamp: true, min_filter: GL_NEAREST, mag_filter: GL_NEAREST, format_type: GL_FLOAT, internal_format: GL_RGBA32F });
        sp.up_root_rows = 0; sp.up_pose_rows = 0; sp.root_view = null; sp.pose_view = null;
      }
      // the material of a species: the engine's pbr material with the skinning shader of its mesh, the vertex colours, and what the page asked for (`material`: roughness, metal, base_color_map, normal_map, roughness_map,
      // metal_map, ao_map, alpha_test, double_sided, shader_extra, uniforms, props, and the material by part: bones, eyes, eyes_bones, below): system never reads an image, the page gives the textures it loaded. A map that is
      // asked for with `true` (a creature file is JS that has no picture to hold) is a one pixel PLACEHOLDER that makes the shader read a map at all (white for the base colour and the occlusion, a flat normal, and for the
      // roughness and the metal maps a pixel of the species' own value: until the picture comes the creature looks as it did); the page gives the real one with `sp.set_base_color_map(texture)` /
      // `sp.set_uniform("u_normal_map" | "u_roughness_map" | "u_metallic_map" | "u_ao_map", texture)`, any time, as often as it likes. The engine reads a map's RED channel for the roughness, the metal and the occlusion
      // (the occlusion only in the forward pass: the deferred one has none), and a roughness / metal map REPLACES the species' u_roughness / u_metallic.
      // THE MAPS (maps.js): `material.maps` is { color, pack, ao }, the pictures of a creature (64, 128 or 256 texels a side), made into engine textures here, once for a species (the page's side: the worker never reads them). The colour map is read as sRGB
      // (SRGB8_ALPHA8: the card turns it into linear light before it filters and lights it, as the vertex colours already are), the packed one as data; both are clamped (an atlas of charts) and have mipmaps (a creature far off reads the small ones).
      // The colour map is the engine's own base colour map (times the vertex colours); the packed one is read by happy_material (species.js: MAT_PACK_CODE) from u_happy_pack, with u_happy_pack_ao = [the ambient's share, the colour's share] of its occlusion.
      const happy_maps = (function () { let lib = null; const packing = function () { return function (name, factory) { lib = factory(); }; }; import("@/system/maps.js"); return lib; })();
      const MAP_RGBA = typeof GL_RGBA !== "undefined" ? GL_RGBA : 6408, MAP_SRGB8_ALPHA8 = typeof GL_SRGB8_ALPHA8 !== "undefined" ? GL_SRGB8_ALPHA8 : 35907;
      function map_textures(sp) {
        const m = sp.material && sp.material.maps;
        if (!m || (!m.color && !m.pack && !m.normal)) return null;
        if (sp.map_tex && sp.map_tex.src === m) return sp.map_tex;
        free_map_textures(sp);
        const make = function (e, srgb) {
          const d = happy_maps.dims(e);
          return engine.textures.create({ width: d.w, height: d.h, source: happy_maps.bytes(e), clamp: true, mipmap: true, internal_format: srgb ? MAP_SRGB8_ALPHA8 : MAP_RGBA });
        };
        sp.map_tex = { src: m, color: m.color ? make(m.color, true) : null, pack: m.pack ? make(m.pack, false) : null, normal: m.normal ? make(m.normal, false) : null };
        return sp.map_tex;
      }
      function free_map_textures(sp) {
        const t = sp.map_tex;
        if (!t) return;
        const gl = engine.webgl && engine.webgl.gl;
        [t.color, t.pack, t.normal].forEach(function (x) {
          if (!x) return;
          if (gl && x.gl_texture && gl.deleteTexture) gl.deleteTexture(x.gl_texture);
          x.gl_texture = null;
          if (engine._textures) engine._textures.delete(x.uuid);
        });
        sp.map_tex = null;
      }
      let white_pixel = null, flat_normal = null;
      const value_pixels = new Map();
      const placeholder = function (normal) {
        if (normal) return flat_normal || (flat_normal = engine.textures.create({ width: 1, height: 1, source: new Uint8Array([128, 128, 255, 255]), clamp: true }));
        return white_pixel || (white_pixel = engine.textures.create({ width: 1, height: 1, source: new Uint8Array([255, 255, 255, 255]), clamp: true }));
      };
      const value_pixel = function (v) {                                                                 // (a grey pixel of a value 0 .. 1: the roughness / metal map of a species until the page gives its picture)
        const b = Math.max(0, Math.min(255, Math.round(v * 255)));
        if (!value_pixels.has(b)) value_pixels.set(b, engine.textures.create({ width: 1, height: 1, source: new Uint8Array([b, b, b, 255]), clamp: true }));
        return value_pixels.get(b);
      };
      // what the page asked of the material, as a short text: scalars as they are, the objects it holds (textures, arrays of a uniform) by identity (a stringified texture is a megabyte of numbers)
      const object_ids = new WeakMap();
      let object_n = 0;
      const object_id = function (o) { let i = object_ids.get(o); if (!i) { i = ++object_n; object_ids.set(o, i); } return i; };
      const material_value = function (v) { return v && typeof v === "object" ? (Array.isArray(v) && v.length <= 16 && v.every(function (x) { return typeof x === "number"; }) ? JSON.stringify(v) : "#" + object_id(v)) : JSON.stringify(v); };
      function material_key(m) {
        if (!m) return "";
        return Object.keys(m).sort().map(function (k) {
          const v = m[k];
          if (v && typeof v === "object" && !Array.isArray(v) && (k === "uniforms" || k === "props")) return k + ":{" + Object.keys(v).sort().map(function (u) { return u + "=" + material_value(v[u]); }).join(",") + "}";
          return k + "=" + material_value(v);
        }).join(";");
      }
      // a species' material and the clones the deferred renderer made of it (engine.materials.clone makes each the first time it is drawn) leave the engine's table together
      function drop_material(mat) {
        if (!mat || !engine._materials) return;
        const gone = [];
        engine._materials.forEach(function (m) { if (m === mat) gone.push(m.uuid); else for (let q = m.parent; q; q = q.parent) if (q === mat) { gone.push(m.uuid); break; } });
        gone.forEach(function (id) { engine._materials.delete(id); });
      }
      function make_material(sp, influences, skinning) {
        const m = sp.material || {}, channel = !!(sp.matx && sp.matx.bytes), sky = channel ? sky_of(sp) : null, sky_on = !!(sky && sky.on);
        const variant = sp.vx ? { dyes: sp.variants.dyes.length, optional: sp.variants.optional.length, K: sp.variants.K, M: sp.variants.M } : null;
        const T = sp.holder || sp.skin_body || sp;                                                                                          // (a prop is drawn with the rows of its HOLDER, the creature that holds it: runtime.js)
        const uniforms = Object.assign({ happy_tex: T.tex, happy_info: T.info, u_metallic: m.metal === undefined ? 0 : m.metal, u_roughness: m.roughness === undefined ? 0.8 : m.roughness }, m.uniforms || {});
        if (variant) for (let k = 0; k < variant.M; k++) uniforms["happy_looks[" + k + "]"] = sp.look_els[k];                          // (the table of looks, a vec4 an element, set once with the material and written in place when the mesh changes: runtime.js)
        if (m.base_color_map) uniforms.u_base_color_map = m.base_color_map === true ? placeholder(false) : m.base_color_map;
        if (m.normal_map) uniforms.u_normal_map = m.normal_map === true ? placeholder(true) : m.normal_map;
        if (m.roughness_map) uniforms.u_roughness_map = m.roughness_map === true ? value_pixel(m.roughness === undefined ? 0.8 : m.roughness) : m.roughness_map;
        if (m.metal_map) uniforms.u_metallic_map = m.metal_map === true ? value_pixel(m.metal === undefined ? 0 : m.metal) : m.metal_map;
        if (m.ao_map) uniforms.u_ao_map = m.ao_map === true ? placeholder(false) : m.ao_map;
        const mt = map_textures(sp);                                                                                        // (the pictures of material.maps: the colour in the engine's own slot, the packed one for happy_material)
        if (mt && mt.color && !m.base_color_map) uniforms.u_base_color_map = mt.color;
        if (mt && mt.normal) { uniforms.u_happy_normal = mt.normal; uniforms.u_happy_normal_scale = 1; }                          // (the baked relief: happy_material perturbs the normal by it, species.js MAT_NORMAL_CODE)
        if (mt && mt.pack) { uniforms.u_happy_pack = mt.pack; uniforms.u_happy_pack_ao = Float32Array.from(m.maps.ao || [1, 0.5]); }
        if (sky_on) { uniforms.u_happy_sky_horizon = Float32Array.from(sky.values.horizon); uniforms.u_happy_sky_zenith = Float32Array.from(sky.values.zenith); uniforms.u_happy_sky_ground = Float32Array.from(sky.values.ground); uniforms.u_happy_sky_strength = sky.values.strength; }
        if (sp.uniform_values) Object.assign(uniforms, sp.uniform_values);                                                  // (what the page set since: a picture, a switch of the shader)
        sp.translucent = m.translucent > 0 && m.translucent <= 1 ? m.translucent : 0;                                       // (the opacity from which a pixel is SOLID: under it the pixel is glass, drawn by the transparent pass, not the G-buffer's: SYSTEM.md "Transparent surfaces")
        if (sp.translucent > 0) uniforms.u_alpha_test = sp.translucent;
        else if (m.alpha_test > 0) uniforms.u_alpha_test = m.alpha_test;
        const extra = typeof m.shader_extra === "string" ? m.shader_extra : "";
        const def = { compiler: "pbr", props: Object.assign({ enable_vertex_color: true }, m.props || {}), uniforms: uniforms, shader: (sp.holder ? holder_shader(channel) : skinned_shader(influences, skinning, channel, variant, !!sp.listed)) + material_shader(channel, extra, !!m.metal_map, m.specular_aa !== false, sky_on, !!(mt && mt.pack), !!(mt && mt.normal)) + (extra ? "\n" + extra : ""), wireframe: !!sp.wire };
        if (m.double_sided) def.state = { cullFace: null };
        sp.mat_channel = channel; sp.mat_sky = sky_on; sp.mat_variant = variant ? variant.dyes + "/" + variant.optional + "/" + variant.M : ""; sp.mat_listed = !!sp.listed;
        return engine.materials.create(def);
      }

      // ---- MATERIALS BY PART (SYSTEM.md "Materials") --------------------------------------------------------------------------------------------------------------------------------------------------------
      // A species' material says ONE roughness and ONE metal (the engine's u_roughness and u_metallic), and an eye, a tooth, a lens, a visor or a claw is not the fur. The CHANNEL gives every vertex values of its own: four
      // bytes a vertex (the roughness, how much of it the vertex takes, the metal, how much of it), mixed into what the species says by the shader (happy_material: mesh.js; a weight of 1 replaces it, 0 leaves it). A
      // vertex's values are made from LAYERS, each of which says a value and how much of the vertex it covers; the higher layer covers first, the next one what is left, the species what nobody covers:
      //   what the page set (sp.set_material): a part's, then the bones' (by the weights of the vertex's skin; a bone's share of a vertex is the page's value of it or the definition's, never both)
      //   what the definition says: the VERTEX's own (mesh.roughness / mesh.metallic: a number a vertex, -1: none), its PART's (an sdf part's `roughness` / `metal`; a plain mesh's part_ids + parts), its BONES'
      //     (material.bones: { name: { roughness, metal } }; and the EYES: a creature whose roles have eyes, or that names them in material.eyes_bones, has glossy eyes: material.eyes, 0.05 by default (metal 0), false: none)
      //   the SPECIES' (u_roughness or the roughness map, u_metallic or the metal map: sp.set_material("all", ...) and sp.set_uniform change them for every vertex that takes them)
      // A bone covers as much of a vertex as the vertex's skin weight on it (an eyeball, all of it on its eye bone, is all the eye's; a vertex that is 30 % on a bone takes 30 % of the bone's value). A species that has none
      // of it (no values, no bone with a value that has vertices, no eyes that have vertices) has NO channel: the same six attributes, the same shader text, the same cost as before.
      const MATERIAL_KEYS = ["roughness", "metal", "base_color_map", "normal_map", "roughness_map", "metal_map", "ao_map", "maps", "alpha_test", "translucent", "double_sided", "shader_extra", "uniforms", "props", "bones", "eyes", "eyes_bones", "specular_aa", "sky"];
      const EYE_GLOSS = 0.05;
      // the sky that a glossy part mirrors in a forward page (mesh.js MAT_SKY_FN): the lab's stage (happy_lab.js make_stage: the horizon, the zenith; the ground is the mean of its checkers), and how much of it: 2, twice
      // what Fresnel says (a forward pass has no tone mapping and a sky of these colours is dim beside a sunlit face: at 1 an eye seen from the front only darkens its pupil a little; at 2 it reads as wet)
      const SKY_DEFAULTS = { horizon: [0.80, 0.86, 0.92], zenith: [0.30, 0.50, 0.80], ground: [0.56, 0.60, 0.54], strength: 2 };
      const SKY_KEYS = ["horizon", "zenith", "ground", "strength"];
      const GL_UBYTE = typeof GL_UNSIGNED_BYTE !== "undefined" ? GL_UNSIGNED_BYTE : 5121, GL_ARRAY = typeof GL_ARRAY_BUFFER !== "undefined" ? GL_ARRAY_BUFFER : 34962;
      const unit_number = function (x) { return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1; };
      // the material of a definition, checked (every complaint is listed) and compiled: the bones' values (Float64Array, -1: none; the eyes' default is in them) and the eye bones. sk: the species' skeleton, life: what
      // compile_roles made of the roles (its eyes are eye bones) or null
      function compile_material(m, sk, life) {
        const errs = [], n = sk.n, bone_r = new Float64Array(n).fill(-1), bone_m = new Float64Array(n).fill(-1);
        if (m !== undefined && m !== null && (typeof m !== "object" || Array.isArray(m))) fail("material must be an object { " + MATERIAL_KEYS.join(", ") + " }");
        m = m || {};
        for (const k in m) if (MATERIAL_KEYS.indexOf(k) < 0) errs.push("unknown key '" + k + "' (" + MATERIAL_KEYS.join(", ") + ")");
        ["roughness", "metal"].forEach(function (k) { if (m[k] !== undefined && !unit_number(m[k])) errs.push(k + " is a number from 0 to 1 (" + m[k] + ")"); });
        if (m.specular_aa !== undefined && typeof m.specular_aa !== "boolean") errs.push("specular_aa is true (the default: a glossy part's glint is widened to the pixels it covers) or false (" + m.specular_aa + ")");
        ["base_color_map", "normal_map", "roughness_map", "metal_map", "ao_map"].forEach(function (k) { const v = m[k]; if (v !== undefined && v !== null && typeof v !== "boolean" && typeof v !== "object") errs.push(k + " is true (a placeholder: the page gives the picture, sp.set_uniform) or a texture of the engine (" + v + ")"); });
        if (m.maps !== undefined && m.maps !== null) happy_maps.check(m.maps).forEach(function (e) { errs.push(e); });
        const bone_of = function (b, what) { const i = typeof b === "number" ? b : sk.index[b]; if (i === undefined || !(i >= 0 && i < n) || i !== (i | 0)) { errs.push(what + ": no bone '" + b + "' in the skeleton"); return -1; } return i; };
        const pair = function (o, what) {                                                                    // { roughness?, metal? } -> [r, m] (-1: not said)
          const out = [-1, -1];
          if (!o || typeof o !== "object" || Array.isArray(o)) { errs.push(what + " is { roughness, metal } (numbers from 0 to 1)"); return out; }
          for (const k in o) if (k !== "roughness" && k !== "metal") errs.push(what + ": unknown key '" + k + "' (roughness, metal)");
          ["roughness", "metal"].forEach(function (k, j) { if (o[k] === undefined || o[k] === null) return; if (unit_number(o[k])) out[j] = o[k]; else errs.push(what + "." + k + " is a number from 0 to 1 (" + o[k] + ")"); });
          return out;
        };
        // the eyes: the roles' eye bones and the ones material.eyes_bones names; their default (unless material.eyes says another: a roughness, { roughness, metal }, false: none)
        const eyes = [];
        if (life && life.roles && Array.isArray(life.roles.eyes)) life.roles.eyes.forEach(function (s) { const b = life.bones[s]; if (b >= 0 && eyes.indexOf(b) < 0) eyes.push(b); });
        if (m.eyes_bones !== undefined) {
          if (!Array.isArray(m.eyes_bones)) errs.push("eyes_bones is a list of bones: the eyes of a creature whose roles do not say them");
          else m.eyes_bones.forEach(function (b, j) { const i = bone_of(b, "eyes_bones[" + j + "]"); if (i >= 0 && eyes.indexOf(i) < 0) eyes.push(i); });
        }
        let eye = [EYE_GLOSS, 0];
        if (m.eyes === false) eye = null;
        else if (typeof m.eyes === "number") { if (unit_number(m.eyes)) eye = [m.eyes, 0]; else errs.push("eyes is the eyes' roughness from 0 to 1, { roughness, metal } or false (" + m.eyes + ")"); }
        else if (m.eyes !== undefined && m.eyes !== true && (!m.eyes || typeof m.eyes !== "object" || Array.isArray(m.eyes))) errs.push("eyes is the eyes' roughness from 0 to 1, { roughness, metal } or false (" + JSON.stringify(m.eyes) + ")");
        else if (m.eyes !== undefined && m.eyes !== true) { const e = pair(m.eyes, "eyes"); eye = [e[0] >= 0 ? e[0] : EYE_GLOSS, e[1] >= 0 ? e[1] : 0]; }
        if (eye) eyes.forEach(function (b) { bone_r[b] = eye[0]; bone_m[b] = eye[1]; });
        // the bones the material names (over the eyes' default)
        if (m.bones !== undefined) {
          if (!m.bones || typeof m.bones !== "object" || Array.isArray(m.bones)) errs.push("bones is { <bone name>: { roughness, metal } }");
          else for (const name in m.bones) { const i = bone_of(name, "bones"), v = pair(m.bones[name], "bones." + name); if (i >= 0) { if (v[0] >= 0) bone_r[i] = v[0]; if (v[1] >= 0) bone_m[i] = v[1]; } }
        }
        // the sky in the glossy parts (forward pages): `sky: true | false | { horizon, zenith, ground, strength }`; not said: on when the eyes are glossy by the eyes' default (a creature's eyes catch the sky whatever the sun does)
        let sky_on = !!(eye && eyes.length), sky_values = null;
        if (m.sky === true || m.sky === false) sky_on = m.sky;
        else if (m.sky !== undefined && m.sky !== null) {
          const v = sky_check(m.sky, "sky");
          if (typeof v === "string") errs.push(v); else { sky_on = true; sky_values = v; }
        }
        if (errs.length) fail("material: " + errs.join("; "));
        return { bone_r: bone_r, bone_m: bone_m, eyes: eyes, eye: eye, sky_on: sky_on, sky_values: sky_values };
      }
      // the values of a sky (`material.sky`, sp.set_sky): { horizon, zenith, ground: [r, g, b] 0 .. 4, strength: 0 .. 16 } -> the values given, or the complaint (a string)
      function sky_check(o, what) {
        if (!o || typeof o !== "object" || Array.isArray(o)) return what + " is true, false or { horizon, zenith, ground: [r, g, b], strength }";
        const out = {};
        for (const k in o) {
          if (SKY_KEYS.indexOf(k) < 0) return what + ": unknown key '" + k + "' (" + SKY_KEYS.join(", ") + ")";
          const x = o[k];
          if (k === "strength") { if (typeof x !== "number" || !(x >= 0 && x <= 16)) return what + ".strength is a number from 0 to 16 (" + x + ")"; out[k] = x; }
          else { if (!Array.isArray(x) || x.length !== 3 || !x.every(function (c) { return typeof c === "number" && c >= 0 && c <= 4; })) return what + "." + k + " is a colour [r, g, b], 0 .. 4 (" + JSON.stringify(x) + ")"; out[k] = x.slice(); }
        }
        return out;
      }
      // the sky a species' glossy parts mirror now: on or off (the page's sp.set_sky, else the definition's, else the eyes' rule) and its values (the defaults, the definition's, the page's)
      function sky_of(sp) {
        const s = sp.mat_spec, live = sp.sky_live;
        const on = live && live.on !== undefined ? live.on : !!(s && s.sky_on);
        return { on: on, values: Object.assign({}, SKY_DEFAULTS, s && s.sky_values || {}, live && live.values || {}) };
      }
      system.compile_material = compile_material;
      // THE MAPS' STORAGE (maps.js "STORED ENCODED"): the browser's own codecs. encode(maps, { quality: 0.88 }) -> Promise of the maps with the colour as { size, jpeg } and the pack as { size, deflate } (four planes, deflated, lossless); decode(maps)
      // -> Promise of the same maps with `data` (the bytes) filled in on each encoded entry, in place (the encoded text stays, so `system.maps.text` writes it). A raw entry is left as it is. JPEG is for the COLOUR only (a seventh of the
      // raw bytes at 0.85, 36 dB on a baked animal); the pack holds opacity and metal, which a lossy picture without alpha spoils.
      const maps_codec = function () { if (typeof document === "undefined" || typeof createImageBitmap !== "function" || typeof CompressionStream !== "function") throw new Error("system.maps: encode and decode need a browser (canvas, createImageBitmap, CompressionStream)"); };
      const maps_pipe = function (u8, stream) { const w = stream.writable.getWriter(); w.write(u8); w.close(); return new Response(stream.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); }); };
      const maps_api = Object.assign({}, happy_maps, {
        encode: function (maps, opts) {
          maps_codec();
          const q = opts && opts.quality !== undefined ? opts.quality : 0.88, errs = happy_maps.check(maps);
          if (errs.length) return Promise.reject(new Error("system.maps.encode: " + errs.join("; ")));
          if (!(q > 0 && q <= 1)) return Promise.reject(new Error("system.maps.encode: quality is a number above 0 and up to 1 (" + q + ")"));
          const out = Object.assign({}, maps), jobs = [];
          if (maps.color && !happy_maps.encoded(maps.color)) jobs.push(function () {
            const d = happy_maps.dims(maps.color), cv = document.createElement("canvas"); cv.width = d.w; cv.height = d.h;
            const rgba = happy_maps.bytes(maps.color), px = new Uint8ClampedArray(rgba.length); px.set(rgba); for (let i = 3; i < px.length; i += 4) px[i] = 255;
            cv.getContext("2d").putImageData(new ImageData(px, d.w, d.h), 0, 0);
            return new Promise(function (res) { cv.toBlob(res, "image/jpeg", q); }).then(function (blob) { return blob.arrayBuffer(); }).then(function (b) { out.color = d.w === d.h ? { size: d.w, jpeg: happy_maps.to_base64(new Uint8Array(b)) } : { width: d.w, height: d.h, jpeg: happy_maps.to_base64(new Uint8Array(b)) }; });
          });
          ["pack", "normal"].forEach(function (key) {                                                                  // (the pack and the normal map are lossless: their four planes one after the other, deflated)
            if (!maps[key] || happy_maps.encoded(maps[key])) return;
            jobs.push(function () {
              const d = happy_maps.dims(maps[key]), rgba = happy_maps.bytes(maps[key]), n = d.w * d.h, planes = new Uint8Array(n * 4);
              for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) planes[k * n + i] = rgba[i * 4 + k];
              return maps_pipe(planes, new CompressionStream("deflate")).then(function (z) { out[key] = d.w === d.h ? { size: d.w, deflate: happy_maps.to_base64(z) } : { width: d.w, height: d.h, deflate: happy_maps.to_base64(z) }; });
            });
          });
          return jobs.reduce(function (p, j) { return p.then(j); }, Promise.resolve()).then(function () { return out; });
        },
        decode: function (maps) {
          maps_codec();
          const errs = happy_maps.check(maps);
          if (errs.length) return Promise.reject(new Error("system.maps.decode: " + errs.join("; ")));
          const jobs = [];
          ["color", "pack", "normal"].forEach(function (k) {
            const e = maps[k], kind = happy_maps.encoded(e);
            if (!kind || e.data !== undefined) return;
            const d = happy_maps.dims(e);
            if (kind === "jpeg") jobs.push(function () {
              return createImageBitmap(new Blob([happy_maps.from_base64(e.jpeg)], { type: "image/jpeg" }), { colorSpaceConversion: "none", premultiplyAlpha: "none" }).then(function (bm) {
                if (bm.width !== d.w || bm.height !== d.h) throw new Error("system.maps.decode: maps." + k + " says " + d.w + " x " + d.h + " and its JPEG is " + bm.width + " x " + bm.height);
                const cv = document.createElement("canvas"); cv.width = d.w; cv.height = d.h; const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(bm, 0, 0);
                const px = cx.getImageData(0, 0, d.w, d.h).data, u8 = new Uint8Array(px.length); u8.set(px); for (let i = 3; i < u8.length; i += 4) u8[i] = 255; e.data = u8; if (bm.close) bm.close();
              });
            });
            else jobs.push(function () {
              return maps_pipe(happy_maps.from_base64(e.deflate), new DecompressionStream("deflate")).then(function (planes) {
                const n = d.w * d.h; if (planes.length !== n * 4) throw new Error("system.maps.decode: maps." + k + " has " + planes.length + " bytes of planes, " + n * 4 + " were expected");
                const u8 = new Uint8Array(n * 4); for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) u8[i * 4 + c] = planes[c * n + i]; e.data = u8;
              });
            });
          });
          return jobs.reduce(function (p, j) { return p.then(j); }, Promise.resolve()).then(function () { return maps; });
        }
      });
      system.maps = maps_api;                                                                                                // (the unwrap, the bake, the painter and the storage of a creature's maps: maps.js, and the codecs above)
      system.SKY_DEFAULTS = SKY_DEFAULTS;
      // the eye bones that a definition's roles name (the mirrors written out): a page that makes a species WITHOUT its roles (the lab's rig mode: no life) and keeps the gloss of its eyes gives them as material.eyes_bones
      system.eye_bones = function (def) {
        const r = def && (def.roles !== undefined ? def.roles : def.system && def.system.roles), out = [];
        if (!r || r.eyes === undefined || r.eyes === null) return out;
        (Array.isArray(r.eyes) ? r.eyes : [r.eyes]).forEach(function (e) {
          const o = e !== null && typeof e === "object" && !Array.isArray(e) ? e : { bone: e };
          if (typeof o.bone !== "string" && typeof o.bone !== "number") return;
          if (out.indexOf(o.bone) < 0) out.push(o.bone);
          if (o.mirror === "x" && typeof o.bone === "string") { try { const t = mirror_name(o.bone, "eyes"); if (out.indexOf(t) < 0) out.push(t); } catch (err) { /* not a name that mirrors: compile_roles says so */ } }
        });
        return out;
      };
      // what the material of the vertices is made from (the INDEX: kept by a species that has a channel, made when it is first asked for by one that has not): the mesh's own values, its parts (the definition's values,
      // and what the page set for them: by the part's id), its skin (the four bones of a vertex, the weights as bytes). bytes: the channel (null: none)
      function material_index(sp, p) {
        const n = p.n, bi = new Uint8Array(4 * n), bw = new Uint8Array(4 * n), np = p.parts ? p.parts.length : 0;
        for (let i = 0; i < 4 * n; i++) { bi[i] = p.bone_indices[i]; bw[i] = Math.round(p.bone_weights[i] * 255); }
        const x = { n: n, v_r: p.roughness, v_m: p.metallic, part_ids: p.part_ids, parts: p.parts, bi: bi, bw: bw, live_pr: new Float64Array(np).fill(-1), live_pm: new Float64Array(np).fill(-1), bytes: null };
        const live = sp.mat_live;
        if (live) for (let q = 0; q < np; q++) { const o = live.parts[p.parts[q].id]; if (o) { if (o.r !== undefined) x.live_pr[q] = o.r; if (o.m !== undefined) x.live_pm[q] = o.m; } }
        return x;
      }
      // does the definition (or the page) say anything of the material of the vertices of this mesh? (the bones' values may still have no vertex: encode says)
      function material_wanted(sp, p) {
        const said = function (a) { if (a) for (let i = 0; i < a.length; i++) if (a[i] >= 0) return true; return false; };
        if (said(p.roughness) || said(p.metallic)) return true;
        if (p.parts && p.parts.some(function (q) { return q.roughness >= 0 || q.metal >= 0; })) return true;
        const s = sp.mat_spec, live = sp.mat_live;
        if (s && (said(s.bone_r) || said(s.bone_m))) return true;
        return !!(live && (Object.keys(live.parts).length || Object.keys(live.bones).length));
      }
      // one value of a vertex (the roughness or the metal: the arrays of that one) from its layers -> [value, weight] in out (no closures, no allocation: a loop over thousands of vertices)
      //   lp: the page's value of its part, lb: the page's values of the bones, vv: the vertex's own, dp: the definition's value of its part, db: the definition's values of the bones (-1: none)
      function material_layers(out, lp, lb, vv, dp, db, BI, BW, o4) {
        let A = 0, W = 0, s = 0, sw = 0, k, w, b;
        if (lp >= 0) { A = lp; W = 1; }
        if (W < 1) {
          for (k = 0; k < 4; k++) { w = BW[o4 + k]; if (w) { b = lb[BI[o4 + k]]; if (b >= 0) { sw += w; s += w * b; } } }
          if (sw > 0) { w = sw >= 255 ? 1 : sw / 255; A += (1 - W) * w * (s / sw); W += (1 - W) * w; }
        }
        if (W < 1 && vv >= 0) { A += (1 - W) * vv; W = 1; }
        if (W < 1 && dp >= 0) { A += (1 - W) * dp; W = 1; }
        if (W < 1) {
          s = 0; sw = 0;
          for (k = 0; k < 4; k++) { w = BW[o4 + k]; if (w) { b = db[BI[o4 + k]]; if (b >= 0) { sw += w; s += w * b; } } }
          if (sw > 0) { w = sw >= 255 ? 1 : sw / 255; A += (1 - W) * w * (s / sw); W += (1 - W) * w; }
        }
        out[0] = W > 0 ? A / W : 0; out[1] = W;
      }
      const layer_out = new Float64Array(2);
      // the bytes of the channel: of every vertex (list: null) or of the vertices of the list (a selector's: material_list); -> { lo, hi, any, count } (the first and the last vertex written, whether a vertex of the mesh
      // takes anything of its own, how many were written)
      function encode_material(sp, x, list) {
        const nb = sp.bone_count, s = sp.mat_spec, live = sp.mat_live, np = x.parts ? x.parts.length : 0;
        const lbr = new Float64Array(nb).fill(-1), lbm = new Float64Array(nb).fill(-1), dbr = new Float64Array(nb).fill(-1), dbm = new Float64Array(nb).fill(-1), dpr = new Float64Array(np), dpm = new Float64Array(np);
        if (live) for (const k in live.bones) { const o = live.bones[k]; if (o.r !== undefined) lbr[+k] = o.r; if (o.m !== undefined) lbm[+k] = o.m; }
        if (s) for (let b = 0; b < nb; b++) { if (lbr[b] < 0) dbr[b] = s.bone_r[b]; if (lbm[b] < 0) dbm[b] = s.bone_m[b]; }        // (a bone's share of a vertex is the page's value or the definition's, never both)
        for (let q = 0; q < np; q++) { dpr[q] = x.parts[q].roughness; dpm[q] = x.parts[q].metal; }
        const B = x.bytes, VR = x.v_r, VM = x.v_m, PID = x.part_ids, BI = x.bi, BW = x.bw, LPR = x.live_pr, LPM = x.live_pm, L = layer_out, n = list ? list.length : x.n;
        let lo = -1, hi = -1, any = false;
        for (let i = 0; i < n; i++) {
          const v = list ? list[i] : i, q = PID ? PID[v] : -1, o = 4 * v;
          material_layers(L, q >= 0 ? LPR[q] : -1, lbr, VR ? VR[v] : -1, q >= 0 ? dpr[q] : -1, dbr, BI, BW, o);
          B[o] = Math.round(L[0] * 255); B[o + 1] = Math.round(L[1] * 255);
          material_layers(L, q >= 0 ? LPM[q] : -1, lbm, VM ? VM[v] : -1, q >= 0 ? dpm[q] : -1, dbm, BI, BW, o);
          B[o + 2] = Math.round(L[0] * 255); B[o + 3] = Math.round(L[1] * 255);
          if (B[o + 1] || B[o + 3]) any = true;
          if (lo < 0 || v < lo) lo = v;
          if (v > hi) hi = v;
        }
        return { lo: lo, hi: hi, any: any, count: n };
      }
      // the vertices a selector covers (a part's: of its parts; a bone's: with a weight on one of its bones), made once a selector and kept with the index (a slider that is dragged writes the same vertices again)
      function material_list(sp, x, sel) {
        const key = sel.level === "part" ? "p" + sel.parts.join(",") : "b" + sel.bones.join(",");
        x.lists = x.lists || {};
        if (x.lists[key]) return x.lists[key];
        const tmp = new Uint32Array(x.n);
        let n = 0;
        if (sel.level === "part") { const on = new Uint8Array(x.parts.length); sel.parts.forEach(function (q) { on[q] = 1; }); for (let v = 0; v < x.n; v++) if (on[x.part_ids[v]]) tmp[n++] = v; }
        else { const on = new Uint8Array(sp.bone_count); sel.bones.forEach(function (b) { on[b] = 1; }); for (let v = 0; v < x.n; v++) for (let j = 0; j < 4; j++) if (x.bw[4 * v + j] && on[x.bi[4 * v + j]]) { tmp[n++] = v; break; } }
        return (x.lists[key] = tmp.slice(0, n));
      }
      // the channel of a mesh that was packed (set_mesh): made when the material of its vertices is said, else none
      function make_channel(sp, p) {
        if (!material_wanted(sp, p)) return null;
        const x = material_index(sp, p);
        x.bytes = new Uint8Array(4 * x.n);
        if (!encode_material(sp, x, null).any) return null;                                                // (bones with values and no vertex on them: nothing to draw differently, nothing kept: material_of / set_material make the index again)
        return x;
      }
      // the channel's attribute: made the first time, its buffer filled (bufferData) or a range of it rewritten (bufferSubData); dropped with the channel
      function upload_channel(sp, lo, hi) {
        const x = sp.matx;
        if (!sp.atts.happy_mat) { const att = engine.geometry_set_attr({ buffer_type: GL_DYNAMIC_DRAW, item_size: 4, data_type: GL_UBYTE }); sp.atts.happy_mat = att; sp.geo.attr.happy_mat = att.uuid; lo = -1; }
        const att = sp.atts.happy_mat, gl = engine.webgl.gl;
        if (lo < 0 || !att.buffer || att.data_length !== x.bytes.length) { upload_attr(att, x.bytes); att.data_length = x.bytes.length; return x.bytes.length; }
        gl.bindBuffer(GL_ARRAY, att.buffer);
        gl.bufferSubData(GL_ARRAY, lo * 4, x.bytes.subarray(lo * 4, (hi + 1) * 4));
        return (hi + 1 - lo) * 4;
      }
      function drop_channel(sp) {
        const att = sp.atts && sp.atts.happy_mat, gl = engine.webgl && engine.webgl.gl;
        if (!att) return;
        if (gl && att.buffer && gl.deleteBuffer) gl.deleteBuffer(att.buffer);
        att.buffer = null;
        if (engine._attributes) engine._attributes.delete(att.uuid);
        delete sp.atts.happy_mat; delete sp.geo.attr.happy_mat;
      }

      // the geometry's buffers are made once and rewritten in place by every set_mesh (no new ids per edit)
      function upload_attr(att, data) { engine.geometry_set_attr(att, data); }
      const VERTEX_ATTRIBUTES = [["a_position", 3], ["a_normal", 3], ["a_uv", 2], ["a_color", 4], ["happy_bone_indices", 4], ["happy_bone_weights", 4]];
      const HOLDER_VERTEX_ATTRIBUTES = VERTEX_ATTRIBUTES.slice(0, 4);                                                      // (a prop has no bone of its own to skin to: its holder's bone is an attribute of the INSTANCE, below)
      SP.set_mesh = function (mesh) {
        if (this.disposed) throw new Error("system: this species was disposed");
        const gl = engine.webgl.gl, p = pack_mesh(mesh, this.sk), VA = this.holder ? HOLDER_VERTEX_ATTRIBUTES : VERTEX_ATTRIBUTES;
        if (!this.tex && !this.holder && !this.skin_body) make_gl_resources(this);
        if (this.skin_body && !this.skin_body.tex) make_gl_resources(this.skin_body);                                      // (a skin that comes first: the body's rows need their texture)
        if (!this.geo) {
          const g = { attr: {}, uuid: engine.guid(), draw_count: 0 };
          this.atts = {};
          VA.forEach(function (e) { const att = engine.geometry_set_attr({ buffer_type: GL_DYNAMIC_DRAW, item_size: e[1] }); this.atts[e[0]] = att; g.attr[e[0]] = att.uuid; }, this);
          g.indices = { buffer: null, buffer_type: GL_DYNAMIC_DRAW, wireframe: { buffer: null, buffer_type: GL_DYNAMIC_DRAW }, data_length: 0 };
          engine._geometries.set(g.uuid, g);
          this.geo = g;
        }
        const data = { a_position: p.a_position, a_normal: p.a_normal, a_uv: p.a_uv, a_color: p.a_color, happy_bone_indices: p.bone_indices, happy_bone_weights: p.bone_weights };
        VA.forEach(function (e) { upload_attr(this.atts[e[0]], data[e[0]]); }, this);
        // the material of the vertices (MATERIALS BY PART above): a channel when the mesh, its parts, its bones or the page say anything of it, else none (and the attribute of an earlier mesh's goes)
        this.mesh_src = mesh;
        this.matx = make_channel(this, p);
        if (this.matx && this.matx.bytes) upload_channel(this, -1, -1);
        else drop_channel(this);
        this.vx = make_variant_channel(this.variants, p, this.name);                                                          // (the variants of the vertices: runtime.js; none when the definition says none)
        if (this.vx) upload_variant(this); else drop_variant(this);
        if (this.listed) upload_list(this, true); else drop_list(this);                                                          // (a species that culls is drawn from a list of its instances: runtime.js)
        send_bound(this, p);                                                                                                    // (the sphere of the mesh, or the definition's: the worker culls the instances by it: runtime.js)
        const ind = this.geo.indices;
        if (!ind.buffer) ind.buffer = gl.createBuffer();
        gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER, ind.buffer);
        gl.bufferData(GL_ELEMENT_ARRAY_BUFFER, p.indices, GL_DYNAMIC_DRAW);
        ind.data_length = p.indices.length;
        this.geo.draw_count = p.indices.length;
        this.index_data = p.indices;
        if (this.wire) upload_wire(this);
        else if (ind.wireframe && ind.wireframe.buffer) { gl.deleteBuffer(ind.wireframe.buffer); ind.wireframe.buffer = null; ind.wireframe.data_length = 0; }      // (the lines of a mesh that is gone)
        this.vertex_count = p.n; this.triangle_count = p.indices.length / 3; this.influences = p.influences; this.glass_from = p.glass_from;
        const mat_key = material_key(this.material);                                                                       // (what the page asked of the material: a species given another may ask for another: a skin that is a picture, or not)
        const has_channel = !!(this.matx && this.matx.bytes), wants_sky = has_channel && sky_of(this).on, variant_key = this.vx ? this.variants.dyes.length + "/" + this.variants.optional.length + "/" + this.variants.M : "";
        if (this.holder && !this.holder.tex) { }                                                                            // (a prop: the rows are its holder's and the holder's texture is made with ITS mesh, after its props: SP.render makes the material then)
        else if (!this.mat || this.mat_influences !== p.influences || this.mat_skinning !== this.skinning || this.mat_key !== mat_key || this.mat_channel !== has_channel || this.mat_sky !== wants_sky || this.mat_variant !== variant_key || this.mat_listed !== !!this.listed) {                  // the shader is the cheapest one that has every influence of the mesh, and blends them the way the species says (and reads the channel when there is one, and mirrors the sky when it is asked to)
          if (this.mat) {                                                                                           // (the old material and its clones go; another material (what the page asked of it changed): the pictures and switches the page set on the old one are not the new one's)
            if (this.mat_key !== mat_key) this.uniform_values = null;
            drop_material(this.mat);
          }
          this.mat = make_material(this, p.influences, this.skinning); this.mat_influences = p.influences; this.mat_skinning = this.skinning; this.mat_key = mat_key;
          if (this.wire) this.mat.wireframe = true;
        }
        this.dirty_root = true; this.dirty_pose = true;                                                                 // (a texture that was made now has none of the rows yet)
        if (this.wmode) make_wire(this);                                                                               // (the wire's edges and shader are of the mesh that is there now)
      };

      // a uniform of the species' material set by the page (a picture it made, a switch of the shader): on the material and on the clones that the deferred renderer made of it, and kept for when the material is made again
      // (a skinning mode that changes). `u_base_color_map` / `u_normal_map` are the pictures of a material that asked for a map (material: { base_color_map: true })
      SP.set_uniform = function (name, value) {
        if (typeof name !== "string" || !/^u_[A-Za-z0-9_]+$/.test(name)) throw new Error("system: a uniform is named u_something (" + name + ")");
        this.uniform_values = this.uniform_values || {};
        this.uniform_values[name] = value;
        const mat = this.mat;
        if (mat) {
          mat.uniforms = mat.uniforms || {}; mat.uniforms[name] = value;
          if (engine._materials) engine._materials.forEach(function (m) { for (let p = m.parent; p; p = p.parent) if (p === mat) { m.uniforms = m.uniforms || {}; m.uniforms[name] = value; break; } });
        }
        return value;
      };
      // other maps for a species (maps.js): { color?, pack?, ao? } (or null for none): its material is made again with them (the page's own pictures stay as they are)
      SP.set_maps = function (maps) {
        if (this.disposed) throw new Error("system: set_maps: this species was disposed");
        if (maps !== null && maps !== undefined) { const errs = happy_maps.check(maps); if (errs.length) throw new Error("system: set_maps: " + errs.join("; ")); }
        this.material = Object.assign({}, this.material);
        if (maps) this.material.maps = maps; else delete this.material.maps;
        if (this.mat) { drop_material(this.mat); this.mat = make_material(this, this.influences, this.skinning); this.mat_key = material_key(this.material); if (this.wire) this.mat.wireframe = true; }
        return this;
      };
      SP.set_base_color_map = function (texture) {
        if (!this.material || !this.material.base_color_map) throw new Error("system: this species was made with no base colour map: its material is { base_color_map: true }");
        return this.set_uniform("u_base_color_map", texture);
      };

      // ---- the material by part, live: sp.set_material(selector, { roughness, metal }), sp.material_of(selector) ----------------------------------------------------------------------------------------------------------------
      // selector: "all" (the SPECIES' values: u_roughness, u_metallic, what every vertex takes that has none of its own), "eyes" (the eye bones), a PART of the mesh (its id, or the id of the sdf part it was made from:
      // the mirror twins too; "part:<id>" when a bone has the name as well), a BONE ("bone:<name>", or a name that is no part's). A value is a number 0 .. 1, null (back to what the definition says), or left out (as it
      // is). What the page sets is a layer over the definition's (a part's over the bones'): sp.set_material("eyes", { roughness: 0.3 }) makes the eyes 0.3 whatever their parts or vertices say. The bytes of the vertices it
      // touches are made again and rewritten with ONE bufferSubData (the range between the first and the last); no new material, no new mesh. A species that has no channel yet gets one the first time a selector
      // covers vertices (its material is made again once, with the channel's shader). -> what material_of says of the selector
      const material_index_of = function (sp) { if (!sp.matx && sp.mesh_src) sp.matx = material_index(sp, pack_mesh(sp.mesh_src, sp.sk)); return sp.matx; };
      const part_names = function (sp) { const x = material_index_of(sp); return x && x.parts ? x.parts : []; };
      function material_selector(sp, s, what) {
        if (s === "all") return { level: "species" };
        if (typeof s !== "string" || !s) throw new Error("system: " + what + ": the selector is \"all\", \"eyes\", a part of the mesh or a bone (" + s + ")");
        if (s === "eyes") {
          const eyes = sp.mat_spec ? sp.mat_spec.eyes : [];
          if (!eyes.length) throw new Error("system: " + what + ": species '" + sp.name + "' has no eyes (no bone in its roles' eyes nor in material.eyes_bones)");
          return { level: "bone", bones: eyes.slice() };
        }
        const pre = /^(part|bone):(.+)$/.exec(s), kind = pre ? pre[1] : null, name = pre ? pre[2] : s;
        if (kind !== "bone") {
          const parts = part_names(sp), hit = [];
          parts.forEach(function (p, q) { if (p.id === name || p.source === name) hit.push(q); });
          if (hit.length) return { level: "part", parts: hit };
          if (kind === "part") throw new Error("system: " + what + ": no part '" + name + "' in the mesh of species '" + sp.name + "' (" + (parts.length ? parts.slice(0, 16).map(function (p) { return p.id; }).join(", ") + (parts.length > 16 ? " ..." : "") : "its mesh has no parts") + ")");
        }
        const b = sp.sk.index[name];
        if (b !== undefined) return { level: "bone", bones: [b] };
        throw new Error("system: " + what + ": '" + s + "' is not \"all\", \"eyes\", a part of the mesh nor a bone of species '" + sp.name + "'");
      }
      function material_values(o) {
        if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("system: set_material: the values are { roughness, metal } (numbers from 0 to 1, or null: back to what the definition says)");
        for (const k in o) if (k !== "roughness" && k !== "metal") throw new Error("system: set_material: unknown key '" + k + "' (roughness, metal)");
        ["roughness", "metal"].forEach(function (k) { if (o[k] !== undefined && o[k] !== null && !unit_number(o[k])) throw new Error("system: set_material: " + k + " is a number from 0 to 1, or null (" + o[k] + ")"); });
        return { r: o.roughness, m: o.metal };
      }
      // a value of the page's layer: set (a number), taken away (null: the definition's again), left (undefined)
      const live_put = function (o, v) { if (v.r === null) delete o.r; else if (v.r !== undefined) o.r = v.r; if (v.m === null) delete o.m; else if (v.m !== undefined) o.m = v.m; };
      SP.set_material = function (selector, values) {
        if (this.disposed) throw new Error("system: set_material: this species was disposed");
        const v = material_values(values), sel = material_selector(this, selector, "set_material");
        const live = this.mat_live || (this.mat_live = { parts: Object.create(null), bones: Object.create(null) });
        if (sel.level === "species") {
          const m = this.material || {};
          if (v.r !== undefined) this.set_uniform("u_roughness", v.r === null ? (m.roughness === undefined ? 0.8 : m.roughness) : v.r);
          if (v.m !== undefined) this.set_uniform("u_metallic", v.m === null ? (m.metal === undefined ? 0 : m.metal) : v.m);
          return this.material_of(selector);
        }
        const x = material_index_of(this);
        if (sel.level === "part") sel.parts.forEach(function (q) {
          const id = x.parts[q].id, o = live.parts[id] || (live.parts[id] = {});
          live_put(o, v);
          if (o.r === undefined && o.m === undefined) delete live.parts[id];
          x.live_pr[q] = o.r === undefined ? -1 : o.r; x.live_pm[q] = o.m === undefined ? -1 : o.m;
        });
        else sel.bones.forEach(function (b) { const o = live.bones[b] || (live.bones[b] = {}); live_put(o, v); if (o.r === undefined && o.m === undefined) delete live.bones[b]; });
        if (!x || !this.geo) return this.material_of(selector);                                            // (no mesh yet: the page's values wait for it)
        const t0 = typeof performance !== "undefined" && performance.now ? performance.now() : 0;
        let r;
        if (x.bytes) {                                                                                     // the channel is there: the bytes of the vertices that the selector covers, one rewrite of their range
          r = encode_material(this, x, material_list(this, x, sel));
          this.mat_upload = r.lo >= 0 ? upload_channel(this, r.lo, r.hi) : 0;
          this.mat_ms = t0 ? performance.now() - t0 : 0;
          return Object.assign(material_said(this, sel), { vertices: r.count });                           // (the vertices it wrote are the ones the selector covers: no second pass to count them)
        } else {                                                                                           // the first time: the channel is made, the material made again with its shader (once)
          x.bytes = new Uint8Array(4 * x.n);
          r = encode_material(this, x, null);
          if (!r.any) { x.bytes = null; return this.material_of(selector); }
          this.mat_upload = upload_channel(this, -1, -1);
          if (this.mat) { drop_material(this.mat); this.mat = make_material(this, this.influences, this.skinning); if (this.wire) this.mat.wireframe = true; }
        }
        this.mat_ms = t0 ? performance.now() - t0 : 0;
        return this.material_of(selector);
      };
      // what a selector's own level says now: { level: "species" | "part" | "bone", roughness, metal } (the page's value, else the definition's; null: none)
      function material_said(sp, sel) {
        const m = sp.material || {}, u = sp.uniform_values || {}, live = sp.mat_live, spec = sp.mat_spec;
        if (sel.level === "species") return { level: "species", roughness: u.u_roughness !== undefined ? u.u_roughness : (m.roughness === undefined ? 0.8 : m.roughness), metal: u.u_metallic !== undefined ? u.u_metallic : (m.metal === undefined ? 0 : m.metal) };
        const val = function (lv, dv) { return lv !== undefined ? lv : (dv >= 0 ? dv : null); };
        if (sel.level === "part") { const p = material_index_of(sp).parts[sel.parts[0]], o = live && live.parts[p.id] || {}; return { level: "part", roughness: val(o.r, p.roughness), metal: val(o.m, p.metal) }; }
        const b = sel.bones[0], o = live && live.bones[b] || {};
        return { level: "bone", roughness: val(o.r, spec ? spec.bone_r[b] : -1), metal: val(o.m, spec ? spec.bone_m[b] : -1) };
      }
      // THE PAGE'S MATERIAL CARRIED OVER to another species of the same creature (system.species_again: a person whose slider moved in the human studio; lab.replace: a creature that its host made again): what the page set
      // with sp.set_material, by selector -- a part by its id, a bone by its NAME (the eyes are bones), "all" (the species' u_roughness / u_metallic) -- and sp.set_sky. A part or a bone that the new species does not have
      // is dropped, and said (console, and to.material_carried.dropped). The new species' channel is made again with them. -> { carried: [selectors], dropped: [selectors] }
      system.carry_material = function (from, to) {
        const out = { carried: [], dropped: [] };
        if (!from || !to || from === to || to.disposed) return out;
        const live = from.mat_live, u = from.uniform_values || {};
        if (u.u_roughness !== undefined) { to.set_uniform("u_roughness", u.u_roughness); out.carried.push("all.roughness"); }
        if (u.u_metallic !== undefined) { to.set_uniform("u_metallic", u.u_metallic); out.carried.push("all.metal"); }
        if (from.sky_live) { to.sky_live = JSON.parse(JSON.stringify(from.sky_live)); out.carried.push("sky"); }
        let any = false;
        if (live && (Object.keys(live.parts).length || Object.keys(live.bones).length)) {
          const tl = to.mat_live || (to.mat_live = { parts: Object.create(null), bones: Object.create(null) }), ids = {};
          part_names(to).forEach(function (p) { ids[p.id] = true; });
          for (const id in live.parts) { if (ids[id]) { tl.parts[id] = Object.assign({}, live.parts[id]); out.carried.push("part:" + id); any = true; } else out.dropped.push("part:" + id); }
          for (const k in live.bones) { const name = from.sk.names[+k], b = to.sk.index[name]; if (b !== undefined) { tl.bones[b] = Object.assign({}, live.bones[k]); out.carried.push("bone:" + name); any = true; } else out.dropped.push("bone:" + name); }
        }
        if (any && to.geo && to.mesh_src) to.set_mesh(to.mesh_src);                                        // (the channel made again with the page's values: the bytes, the material when its shader changes)
        if (from.sky_live) apply_sky(to);                                                                  // (and the sky the page said)
        to.material_carried = out;
        if (out.dropped.length && typeof console !== "undefined") console.warn("system: the page's material of " + out.dropped.join(", ") + " is not carried over to the species '" + to.name + "' made again: it has no such part or bone");
        return out;
      };
      // THE SKY of the glossy parts (forward pages; mesh.js MAT_SKY_FN): sp.set_sky(true | false) switches it (the material is made again with the other shader, once), sp.set_sky({ horizon, zenith, ground, strength })
      // gives it values (live: the uniforms of the material and of its clones) and switches it on, sp.set_sky(null) is the definition's again. A species with no channel has no glossy part: it is kept for when it has one.
      // -> { on, active (the shader has it: a channel and on), values }
      SP.set_sky = function (o) {
        if (this.disposed) throw new Error("system: set_sky: this species was disposed");
        if (o === null) this.sky_live = null;
        else if (o === true || o === false) (this.sky_live = this.sky_live || {}).on = o;
        else {
          const v = sky_check(o, "set_sky");
          if (typeof v === "string") throw new Error("system: " + v);
          const live = this.sky_live = this.sky_live || {};
          live.on = true; live.values = Object.assign(live.values || {}, v);
        }
        return apply_sky(this);
      };
      // the sky as sky_of says it on the species' material: made again when it is switched (another shader), else its values put on the material and on the deferred renderer's clones
      function apply_sky(sp) {
        const sky = sky_of(sp), want = !!(sp.matx && sp.matx.bytes) && sky.on, mat = sp.mat;
        if (mat && want !== !!sp.mat_sky) { drop_material(mat); sp.mat = make_material(sp, sp.influences, sp.skinning); if (sp.wire) sp.mat.wireframe = true; }
        else if (mat && want) {
          const u = { u_happy_sky_horizon: Float32Array.from(sky.values.horizon), u_happy_sky_zenith: Float32Array.from(sky.values.zenith), u_happy_sky_ground: Float32Array.from(sky.values.ground), u_happy_sky_strength: sky.values.strength };
          const put = function (m) { m.uniforms = m.uniforms || {}; for (const k in u) m.uniforms[k] = u[k]; };
          put(mat);
          if (engine._materials) engine._materials.forEach(function (m) { for (let q = m.parent; q; q = q.parent) if (q === mat) { put(m); break; } });
        }
        return { on: sky.on, active: want, values: sky.values };
      }
      SP.sky_state = function () { const s = sky_of(this); return { on: s.on, active: !!this.mat_sky, values: s.values }; };       // (what set_sky would say, changing nothing)
      // what the selector's material is: what its level says (material_said) and how many vertices it covers
      SP.material_of = function (selector) {
        const sel = material_selector(this, selector, "material_of"), out = material_said(this, sel);
        if (sel.level === "species") { out.vertices = this.vertex_count || 0; return out; }
        const x = material_index_of(this);
        out.vertices = x ? material_list(this, x, sel).length : 0;
        return out;
      };

      // how the species blends the bones of a vertex: "dual_quaternion" (the default) or "linear". The material is made again with the other shader; the instances stay
      SP.set_skinning = function (mode) {
        if (SKINNING_MODES.indexOf(mode) < 0) throw new Error("system: skinning must be one of " + SKINNING_MODES.join(", ") + " (" + mode + ")");
        if (this.skinning === mode) return mode;
        this.skinning = mode;
        if (this.mat) {
          drop_material(this.mat);
          this.mat = make_material(this, this.influences, mode); this.mat_skinning = mode;
          if (this.wire) this.mat.wireframe = true;
        }
        if (this.wmode && this.geo && this.index_data) make_wire(this);                                                  // (the wire's shader blends the same way)
        return mode;
      };

      // WIREFRAME: the species drawn as lines (the material's wireframe flag: the engine draws GL_LINES from the geometry's `wireframe` indices). The line indices (two for each side of each triangle) are made the
      // first time they are asked for and again with every new mesh while it is on
      function upload_wire(sp) {
        const gl = engine.webgl.gl, ind = sp.geo.indices, tri = sp.index_data, n = tri.length - tri.length % 3, w = new Uint32Array(n * 2);
        for (let i = 0, o = 0; i < n; i += 3, o += 6) { w[o] = tri[i]; w[o + 1] = tri[i + 1]; w[o + 2] = tri[i + 1]; w[o + 3] = tri[i + 2]; w[o + 4] = tri[i + 2]; w[o + 5] = tri[i]; }
        if (!ind.wireframe.buffer) ind.wireframe.buffer = gl.createBuffer();
        gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER, ind.wireframe.buffer);
        gl.bufferData(GL_ELEMENT_ARRAY_BUFFER, w, GL_DYNAMIC_DRAW);
        ind.wireframe.data_length = w.length;
      }
      // The deferred renderer draws with CLONES of the material (a pass for the shadow maps, one for the G-buffer: engine.materials.clone makes each the first time it is drawn and copies the wireframe flag THEN), so a
      // flag set on the material afterwards would not reach what is drawn: the clones of the species' material are given it too
      SP.set_wireframe = function (on) {
        on = !!on;
        const mat = this.mat;
        this.wire = on;
        if (mat) {
          mat.wireframe = on;
          if (engine._materials) engine._materials.forEach(function (m) { for (let p = m.parent; p; p = p.parent) if (p === mat) { m.wireframe = on; break; } });
        }
        if (on && this.geo && this.index_data) upload_wire(this);
      };


      // THE WIRE OVERLAY (sp.set_wire(mode)): the species' own triangles drawn as LINES, skinned like the body: "overlay" over the shaded creature, "only" with no shading (hidden lines removed: a depth-only pass of the
      // body first, so that the far side does not show through), "off" (the default) NOTHING: no buffer, no material, no draw. The lines are the creature's UNIQUE EDGES (a closed mesh of T triangles has 3 T / 2 of them:
      // the shared edge of two triangles is one line, not two), in an index buffer of their own on a second geometry that uses the species' vertex buffers (so the lines are what the shader makes of the same
      // bones: the creature walking, blinking, looking has its wire walk, blink and look with it); the draw is ONE more instanced call with the same texture of rows. A line is a flat colour (the engine's unlit pbr:
      // base colour times the vertex's colour, which the shader sets): color [r, g, b] or, left out, a colour that reads on what it is drawn over (an overlay: dark on a light vertex colour and light on a dark one; only:
      // dark navy, for a light stage). The lines are pulled toward the camera by a depth bias (a line and the triangle it is the edge of have the same depth to a rounding, and a polygon offset does not reach lines in
      // WebGL), in world units: a thousandth of the mesh's size, about 2 mm for a person. For the forward pages (the lab, the studios): a deferred renderer would draw the lines into its G-buffer.
      function unique_edges(tri, nv) {
        const n = tri.length - tri.length % 3, keys = new Float64Array(n), m = nv > 0 ? nv : 1;
        for (let i = 0, o = 0; i < n; i += 3) {
          const a = tri[i], b = tri[i + 1], c = tri[i + 2];
          keys[o++] = a < b ? a * m + b : b * m + a; keys[o++] = b < c ? b * m + c : c * m + b; keys[o++] = c < a ? c * m + a : a * m + c;
        }
        keys.sort();
        let k = 0;
        for (let i = 0; i < n; i++) if (i === 0 || keys[i] !== keys[i - 1]) keys[k++] = keys[i];
        const e = new Uint32Array(k * 2);
        for (let i = 0; i < k; i++) { const a = Math.floor(keys[i] / m); e[2 * i] = a; e[2 * i + 1] = keys[i] - a * m; }
        return e;
      }
      system.unique_edges = unique_edges;
      const WIRE_DECL = "uniform vec4 u_happy_wire;\t\t// the line colour rgb and the depth bias (the clip-space shift at a distance of one unit)\nuniform float u_happy_wire_auto;\t// 1: a colour that reads on the vertex colour, 0: the one of u_happy_wire\n";
      const WIRE_TAIL_FROM = "gl_Position = u_view_projection_matrix * vec4(v_position_world, 1.0);";
      const WIRE_TAIL_TO = WIRE_TAIL_FROM + "\n\tv_color = vec4(u_happy_wire_auto > 0.5 ? (dot(a_color.rgb, vec3(0.299, 0.587, 0.114)) > 0.65 ? vec3(0.03, 0.03, 0.05) : vec3(0.97, 0.97, 0.99)) : u_happy_wire.rgb, 1.0);\n\tgl_Position.z -= u_happy_wire.w / gl_Position.w;";
      function wire_material(sp, lines) {                                                                    // (lines: the wire's; else the depth-only pass of a wire-only view)
        let text = skinned_shader(sp.influences, sp.skinning, false);
        if (lines) { const at = text.lastIndexOf(WIRE_TAIL_FROM); text = WIRE_DECL + text.slice(0, at) + WIRE_TAIL_TO + text.slice(at + WIRE_TAIL_FROM.length); }
        const uniforms = { happy_tex: sp.tex, happy_info: sp.info };
        if (lines) { uniforms.u_happy_wire = sp.wire_u; uniforms.u_happy_wire_auto = sp.wire_auto; }
        return engine.materials.create({ compiler: "pbr", props: { enable_vertex_color: true, unlit: true }, uniforms: uniforms, shader: text, wireframe: !!lines, state: lines ? { depthFunc: GL_LEQUAL } : { colorMask: false } });
      }
      // the colour the lines have now (the user's, or what the mode says), written into the uniforms the materials hold
      function wire_colors(sp) {
        const u = sp.wire_u, c = sp.wire_color;
        if (c) { u[0] = c[0]; u[1] = c[1]; u[2] = c[2]; sp.wire_auto[0] = 0; }
        else if (sp.wmode === "only") { u[0] = 0.04; u[1] = 0.07; u[2] = 0.16; sp.wire_auto[0] = 0; }
        else sp.wire_auto[0] = 1;
        u[3] = sp.wire_bias;
      }
      function free_wire(sp) {
        const gl = engine.webgl && engine.webgl.gl;
        if (sp.wgeo) {
          const w = sp.wgeo.indices.wireframe;
          if (gl && w.buffer && gl.deleteBuffer) gl.deleteBuffer(w.buffer);
          w.buffer = null;
          if (engine._vaos) { const vaos = engine._vaos.get(sp.wgeo.uuid); if (vaos) { if (gl && gl.deleteVertexArray) vaos.forEach(function (vao) { gl.deleteVertexArray(vao); }); engine._vaos.delete(sp.wgeo.uuid); } }
          if (engine._geometries) engine._geometries.delete(sp.wgeo.uuid);
          sp.wgeo = null;
        }
        if (sp.wmat) { drop_material(sp.wmat); sp.wmat = null; }
        if (sp.dmat) { drop_material(sp.dmat); sp.dmat = null; }
        sp.wire_edges = 0;
      }
      // the unique edges of the species' mesh in a buffer of their own, the materials of the lines and of the depth pass (made again when the mesh is another: its influences may be)
      function make_wire(sp) {
        const gl = engine.webgl.gl, t0 = typeof performance !== "undefined" && performance.now ? performance.now() : 0, P = sp.mesh_src && sp.mesh_src.positions;
        free_wire(sp);
        const e = unique_edges(sp.index_data, sp.vertex_count);
        sp.wgeo = { attr: sp.geo.attr, uuid: engine.guid(), draw_count: 0, indices: { buffer: null, buffer_type: GL_DYNAMIC_DRAW, wireframe: { buffer: gl.createBuffer(), buffer_type: GL_DYNAMIC_DRAW, data_length: e.length }, data_length: 0 } };
        engine._geometries.set(sp.wgeo.uuid, sp.wgeo);
        gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER, sp.wgeo.indices.wireframe.buffer);
        gl.bufferData(GL_ELEMENT_ARRAY_BUFFER, e, GL_DYNAMIC_DRAW);
        sp.wire_edges = e.length / 2;
        let ext = 0;                                                                                          // (the mesh's size, for the bias: its largest extent)
        if (P && P.length >= 3) { const lo = [1e30, 1e30, 1e30], hi = [-1e30, -1e30, -1e30]; for (let i = 0; i + 2 < P.length; i += 3) for (let k = 0; k < 3; k++) { const v = P[i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; } ext = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]); }
        sp.wire_bias = 0.1 * 0.001 * (ext > 0 ? ext : 1);                                                      // (the camera's 2 f n / (f - n) is about 0.1: a shift of this much in clip space is a thousandth of the mesh's size at any distance)
        if (!sp.wire_u) { sp.wire_u = new Float32Array(4); sp.wire_auto = new Float32Array(1); sp.wire_auto[0] = 1; }
        wire_colors(sp);
        sp.wmat = wire_material(sp, true);
        if (sp.wmode === "only") sp.dmat = wire_material(sp, false);
        sp.wire_ms = t0 ? performance.now() - t0 : 0;
      }
      // sp.set_wire("off" | "overlay" | "only" | true | false, { color: [r, g, b] | null }) -> the state: { mode, color, edges, triangles, ms }. The colour may be given alone: sp.set_wire(undefined, { color }) keeps the mode
      SP.set_wire = function (mode, o) {
        if (this.disposed) throw new Error("system: set_wire: this species was disposed");
        o = o || {};
        if (mode === true) mode = "overlay"; else if (mode === false || mode === null) mode = "off";
        if (mode !== undefined && mode !== "off" && mode !== "overlay" && mode !== "only") throw new Error("system: set_wire: the mode is \"off\", \"overlay\" (the lines over the shaded body) or \"only\" (the lines alone) (" + mode + ")");
        if (o.color !== undefined) {
          const c = o.color;
          if (c !== null && !(Array.isArray(c) && c.length >= 3 && c.slice(0, 3).every(function (x) { return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 4; }))) throw new Error("system: set_wire: color is [r, g, b] (0 .. 1) or null (a colour that reads on what is under it)");
          this.wire_color = c === null ? null : c.slice(0, 3);
        }
        const before = this.wmode || null, next = mode === undefined ? before : (mode === "off" ? null : mode);
        this.wmode = next;
        if (!next) free_wire(this);
        else if (this.geo && this.index_data) { if (!this.wgeo || before !== next || !this.wmat || (next === "only" && !this.dmat)) make_wire(this); else wire_colors(this); }
        return this.wire_state();
      };
      SP.wire_state = function () { return { mode: this.wmode || "off", color: this.wire_color ? this.wire_color.slice() : null, edges: this.wire_edges || 0, triangles: this.triangle_count || 0, ms: this.wire_ms || 0 }; };

      // the live prefix of the changed regions of the texture: one texSubImage2D each; the rest of the texture is not touched
      // THE PROPS OF A FAMILY (runtime.js) are drawn by it with its own rows: one instanced draw of each kind of prop, whose instances are attributes (happy_hold: the holder's slot, the holder's bone, the scale; happy_at,
      // happy_rot: the mount, or the world place of a prop that is free), compact (the first `pn`), the entries that changed rewritten by one bufferSubData each
      const HOLD_ATTS = [["happy_hold", 4, "hold"], ["happy_at", 3, "at"], ["happy_rot", 4, "rot"]];
      function upload_holds(sp) {
        const gl = engine.webgl.gl;
        HOLD_ATTS.forEach(function (e) {
          const data = sp[e[2]];
          let att = sp.atts[e[0]];
          if (!att) { att = engine.geometry_set_attr({ buffer_type: GL_DYNAMIC_DRAW, item_size: e[1], divisor: 1 }); sp.atts[e[0]] = att; sp.geo.attr[e[0]] = att.uuid; upload_attr(att, data); att.data_length = data.length; return; }
          if (sp.hold_hi >= sp.hold_lo) { gl.bindBuffer(GL_ARRAY, att.buffer); gl.bufferSubData(GL_ARRAY, sp.hold_lo * e[1] * 4, data.subarray(sp.hold_lo * e[1], (sp.hold_hi + 1) * e[1])); }
        });
        sp.hold_dirty = false; sp.hold_lo = 1 << 30; sp.hold_hi = -1;
      }
      SP.upload = function () {
        if (this.holder) { if (this.hold_dirty && this.geo && !this.disposed) upload_holds(this); return; }
        if (this.skin_body) { if (this.dirty_list && this.geo && !this.disposed) upload_list(this, false); return; }                   // (a skin has no rows of its own: only its list)
        if (this.fprops && !this.disposed) { const d = this.fprops.draws; for (let k = 0; k < d.length; k++) d[k].upload(); }
        if (this.skin_list && !this.disposed) { const sl = this.skin_list; for (let k = 1; k < sl.length; k++) sl[k].upload(); }          // (its skins' lists: runtime.js)
        if (this.disposed || !this.tex) return;                          // (a species that has no mesh has no texture; a disposed one has none any more: update_sub_texture would make a new one)
        if (this.dirty_list && this.geo) upload_list(this, false);                                                  // (the list of the instances that are drawn: the entries that changed)
        if (this.hw === 0) { this.dirty_root = this.dirty_pose = false; return; }
        if (this.dirty_root) {
          this.dirty_root = false;
          const rr = Math.ceil(this.hw * 2 / W);
          if (this.up_root_rows !== rr) { this.root_view = this.mirror.subarray(0, rr * W * 4); this.up_root_rows = rr; }
          engine.update_sub_texture(this.tex, 0, 0, 0, W, rr, 0, this.root_view);
          this.uploads++;
        }
        if (this.dirty_pose) {
          this.dirty_pose = false;
          const pr = Math.ceil(this.hw * this.bone_count * 2 / W);
          if (this.up_pose_rows !== pr) { this.pose_view = this.mirror.subarray(this.root_rows * W * 4, (this.root_rows + pr) * W * 4); this.up_pose_rows = pr; }
          engine.update_sub_texture(this.tex, 0, this.root_rows, 0, W, pr, 0, this.pose_view);
          this.uploads++;
        }
      };
      // draws the species: every live instance (the first `hw` slots) with one instanced draw; sp.visible = false leaves it out
      SP.render = function () {
        if (this.skin_body) {                                                                                               // (a skin: the instances that wear it, with the body's rows, one draw)
          if (this.disposed || this.visible === false || this.draw_n === 0 || !this.geo || !this.mat) return;
          engine.render_item(this.geo, this.mat, 0, 0, this.draw_n);
          return;
        }
        if (this.holder) {                                                                                                 // (a prop of a family: its holder's rows and its own instance attributes, one draw)
          if (this.disposed || this.visible === false || this.pn === 0 || !this.geo) return;
          if (!this.mat) { if (!this.holder.tex || !this.mesh_src) return; this.set_mesh(this.mesh_src); if (!this.mat) return; }          // (the holder's texture is made after its props: the material is made the first time it is there)
          engine.render_item(this.geo, this.mat, 0, 0, this.pn);
          return;
        }
        if (this.fprops && !this.disposed && this.visible !== false) { const d = this.fprops.draws; for (let k = 0; k < d.length; k++) d[k].render(); }
        if (this.skin_list && !this.disposed && this.visible !== false) { const sl = this.skin_list; for (let k = 1; k < sl.length; k++) sl[k].render(); }          // (the skins of the species: one draw each)          // (the family draws its props like its own instances: each an sdf mesh with no bone of its own, on the bone of the instance that holds it: runtime.js)
        if (this.disposed || this.visible === false || this.hw === 0 || !this.geo || !this.mat) return;
        const n = this.listed ? this.draw_n : this.hw;                                                         // (a species that culls draws the list of its instances that are not culled: its entries, not the first hw slots; the wire reads every slot, a culled one is a point there)
        if (this.wmode && this.wmat) {                                                                         // (the wire: the body's depth alone when only the lines are wanted, else the body shaded; then the lines)
          if (this.wmode === "only") { if (this.dmat) engine.render_item(this.geo, this.dmat, 0, 0, this.hw); }
          else if (n > 0) engine.render_item(this.geo, this.mat, 0, 0, n);
          engine.render_item(this.wgeo, this.wmat, 0, this.wire_edges, this.hw);
          return;
        }
        if (n > 0) {
          if (this.glass_from >= 0) { if (this.glass_from > 0) engine.render_item(this.geo, this.mat, 0, this.glass_from * 3, n); }          // (the triangles from glass_from on are glass: drawn by render_glass, not here)
          else engine.render_item(this.geo, this.mat, 0, 0, n);
        }
      };
      // THE GLASS of the species: the triangles from `glass_from` on (a mesh of its own) or, with material.translucent, the WHOLE mesh (its opacity map says which pixels are glass: the opaque draw alpha-tests them away, the
      // transparent material drops the solid ones); drawn with `mat`, a transparent material (screen.transparent.material of a deferred pass, or the forward one below), every instance that is drawn, one instanced draw
      SP.render_glass = function (mat) {
        if (this.disposed || this.visible === false || !this.geo || !mat || !(this.glass_from >= 0 || this.translucent > 0) || this.skin_body || this.holder || !this.index_data) return;
        const n = this.listed ? this.draw_n : this.hw;
        if (n <= 0) return;
        if (this.glass_from >= 0) engine.render_item(this.geo, mat, this.glass_from * 3, this.index_data.length - this.glass_from * 3, n);
        else engine.render_item(this.geo, mat, 0, 0, n);
      };
      // the material of the glass on a FORWARD page: the species' own, blended over what is behind (the hardware depth test, no depth write), the glass is the pack's opacity, no alpha test
      SP.forward_glass_material = function () {
        const base = this.mat;
        if (!base) return null;
        if (!base.forward_glass) base.forward_glass = engine.materials.clone(base, { uniforms: { u_alpha_test: 0 }, state: { blend: { func: [770, 771] }, depthMask: false } });
        return base.forward_glass;
      };
      // THE PAGE'S CHOICE (system.transparent): the glass is drawn where the page says. `system.transparent(screen)` of a deferred pass (engine.deffered_rendering: screen.transparent draws it after the lighting pass, lit by the pass's own light, depth tested
      // against the G-buffer); `system.transparent("forward")` for a forward page (system.render_all draws the glass after every opaque thing); `system.transparent(null)` (the default): none, the windows are the holes of the opaque mesh. -> what is chosen
      const glass = { mode: null, screen: null, item: null };
      system.transparent = function (choice) {
        if (glass.screen && glass.item) { glass.screen.transparent.remove(glass.item); }
        glass.mode = null; glass.screen = null; glass.item = null;
        if (choice === "forward") glass.mode = "forward";
        else if (choice && choice.transparent && typeof choice.transparent.add === "function") {
          glass.mode = "screen"; glass.screen = choice;
          glass.item = { render: function () { for (let i = 0; i < list.length; i++) { const sp = list[i]; if ((sp.glass_from >= 0 || sp.translucent > 0) && sp.mat && !sp.disposed) sp.render_glass(choice.transparent.material(sp.mat, { cut: sp.glass_from >= 0 ? 0 : sp.translucent })); } } };
          choice.transparent.add(glass.item);
        } else if (choice) throw new Error("system.transparent: the screen of engine.deffered_rendering, \"forward\", or null (" + choice + ")");
        return glass.mode;
      };
      system.render_all = function () {
        system.props_frame();
        for (let i = 0; i < list.length; i++) list[i].render();
        if (glass.mode === "forward") for (let i = 0; i < list.length; i++) { const sp = list[i]; if (sp.glass_from >= 0) sp.render_glass(sp.forward_glass_material()); }
      };          // (system.props_frame: the props that fly are put where they are first; the ones on a bone need nothing, the shader reads the bone: runtime.js)

      // the species leaves the worker (its table stays used until the page is reloaded: the arena is a bump allocator) and the page: its GL buffers and its bones texture are freed (a page that makes creatures over and over,
      // an editor, would otherwise leave a few MB of them behind for every one)
      SP.dispose = function () {
        if (this.fprops) fp_forget(this);
        if (this.skin_list && !this.disposed) { const sl = this.skin_list; for (let k = 1; k < sl.length; k++) sl[k].dispose(); }          // (its skins go with it)
        if (this.disposed) return;
        this.disposed = true;
        if (!this.render_only) { q_begin(2); q_u(CMD_HAPPY_DESTROY); q_u(this.js_id); }
        species_map.delete(this.js_id);
        const i = list.indexOf(this);
        if (i >= 0) list.splice(i, 1);
        const gl = engine.webgl && engine.webgl.gl;
        if (this.atts) for (const k in this.atts) {
          const att = this.atts[k];
          if (gl && att.buffer && gl.deleteBuffer) gl.deleteBuffer(att.buffer);
          att.buffer = null;
          if (engine._attributes) engine._attributes.delete(att.uuid);
        }
        if (this.geo) {
          const ind = this.geo.indices;
          if (gl && ind && ind.buffer && gl.deleteBuffer) gl.deleteBuffer(ind.buffer);
          if (gl && ind && ind.wireframe && ind.wireframe.buffer && gl.deleteBuffer) gl.deleteBuffer(ind.wireframe.buffer);
          if (ind) { ind.buffer = null; if (ind.wireframe) ind.wireframe.buffer = null; }
          if (engine._geometries) engine._geometries.delete(this.geo.uuid);
        }
        if (this.tex) {
          if (gl && this.tex.gl_texture && gl.deleteTexture) gl.deleteTexture(this.tex.gl_texture);
          this.tex.gl_texture = null;
          if (engine._textures) engine._textures.delete(this.tex.uuid);
        }
        if (this.geo && engine._vaos) {                                                                                      // (the engine keeps a vertex array of the geometry for each shader that drew it, and never lets go of them: they hold the buffers)
          const vaos = engine._vaos.get(this.geo.uuid);
          if (vaos) { if (gl && gl.deleteVertexArray) vaos.forEach(function (vao) { gl.deleteVertexArray(vao); }); engine._vaos.delete(this.geo.uuid); }
        }
        free_wire(this);
        free_map_textures(this);
        drop_material(this.mat);
        this.geo = null; this.atts = null;
      };

      // ========================================================================================================================
      // variants
      // ========================================================================================================================
// system.js, a part: VARIANTS: the individuals of a species (a coat's colour, a pair of horns that is there or not) drawn by the species' ONE instanced draw.
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- variants ------------------------------------------------------------------------------------------------------------------------------------------
      // A species is one mesh, one material, one draw: its instances differ in their rows alone (the root, the bones). VARIANTS give them a look of their own without a draw, a mesh or a texture more. The definition says WHAT can
      // differ and the LIST OF LOOKS the species has (the page does not have to know the creature):
      //   variants: {
      //     dyes:     { coat: { parts: ["torso", "head"], bones: ["tail"], palette: [[r, g, b], ...], base?: [r, g, b] }, mane: { ... } }        up to 3 regions of the body, each with the colours it may wear
      //     optional: { horns: { parts: ["horn"], bones: [...] }, ... }                                                                            up to 16 pieces that a look may leave out
      //     looks:    [{ coat: 0, saddle: 2 }, { coat: [r, g, b], horns: false }, ...]       or { black: {...}, cream: {...} }: the list; each look says a dye (a colour, a number of its palette, null) and a piece (true | false)
      //   }
      // A DYE is a region of the body (the mesh's PARTS by id, mirror twins too; and/or the BONES by name: a vertex takes the share of the dye that its skin has on them, so the edge of a region is soft) and the colours it may wear
      // (`palette`, linear 0 .. 1). A look's colour REPLACES the hue of the region and keeps the shading the mesh was made with: the vertex's own luminance, over the luminance of the dye's colour in the mesh (`base`, else the mean
      // of its vertices), times the colour. A dye that a look does not say is the file's own colour. An OPTIONAL piece is hidden whole: its vertices all go to the root's point, so every triangle of it has no area (the way a prop
      // that is away does); it must therefore be a SHELL OF ITS OWN (an island, an sdf.meshes piece, a part of the catalogue, a prop): a piece that is welded to the body is refused with the number of triangles that join them.
      // `looks` left out: one look for every colour of the palettes (look i wears the i-th colour of every dye's palette, taken round).
      // HOW IT REACHES THE GPU (nothing of it goes through the worker): the vertices carry their share of each dye and their piece in one attribute of 4 bytes (happy_variant); the LOOKS are a table of vec4 in a UNIFORM ARRAY of the
      // species' material (`happy_looks[k]`, one vec4 each, set once when the material is made and written in place when the mesh changes: a look is K = dyes + pieces / 4 vec4: the colour of each dye over the dye's reference
      // luminance with w = 1 when the look says it, then the pieces' flags four to a vec4; the first look is all zeros: the file's own); and an instance has ONE NUMBER, the look it wears, an attribute of the species' draw list
      // (runtime.js: (slot, look), divisor 1), so a species that has variants is always drawn from its list. The vertex shader indexes the table by it: no texture fetch and no `if` or ternary at all (a dye is a mix(), a piece's flag is step() and a dot product). The fragment shader is not touched.
      // WHAT IT COSTS: nothing for a species with no `variants` (the same shader text, the same texture, the same attributes). With them: 4 bytes a vertex, (looks + 1) K vec4 of uniforms (a hound: 5 looks, 2 dyes: 12) of
      // which the engine writes one gl call each at every draw, 2 bytes an instance in the draw list, no work a frame. At most 128 vec4 a species.
      //   sp.spawn({ ..., variant: 2 })        the look of the list by its NUMBER (taken round the list: 7 of 5 looks is the third) or its name ("black"); left out: the file's own, or a look picked by `seed`
      //   sp.spawn({ ..., seed })              a look of the list picked by a seed (the same seed, the same look; any finite number)
      //   sp.set_variant(c, 3 | "cream" | null)        changes an instance (null: the file's own)           sp.variant_of(c)        { look: its number | null, coat: [r, g, b] | null, horns: true | false }
      // A species that declares no `variants` (or no looks) is NOT AFFECTED by a variant it is told (a page can say "variant 3" to every creature it spawns), and wears nothing: sp.variant_of(c) is {}.
      const VARIANT_KEYS = ["dyes", "optional", "looks"], DYE_KEYS = ["parts", "bones", "palette", "base"], OPTIONAL_KEYS = ["parts", "bones"];
      const MAX_DYES = 3, MAX_OPTIONAL = 16, MAX_LOOK_VECTORS = 128;
      const LUMINANCE = [0.2126, 0.7152, 0.0722];
      const variant_rgb = function (c) { return Array.isArray(c) && c.length === 3 && c.every(function (x) { return typeof x === "number" && x >= 0 && x <= 1; }); };
      // a vec4 of the table: the engine's (engine.math.vec4), or a plain Float32Array where there is none (the node tests' engine)
      const variant_vec4 = function () { return engine.math && engine.math.vec4 ? engine.math.vec4(0, 0, 0, 0) : new Float32Array(4); };
      // the definition's `variants`, checked (every complaint is listed) -> null (none) or { dyes: [{ name, parts, bones, bone_ids, palette, base }], optional: [{ name, parts, bones, bone_ids }],
      // looks: [{ dye: [colour | null], hide: [bool] }], look_names: [name | ""], look_by_name, K: vec4 a look, M: vec4 of the table, bone_count }
      function compile_variants(v, sk) {
        if (v === undefined || v === null) return null;
        if (typeof v !== "object" || Array.isArray(v)) fail("variants must be an object { dyes: { name: { parts, bones, palette } }, optional: { name: { parts, bones } }, looks: [...] }");
        const errs = [], taken = Object.create(null), out = { dyes: [], optional: [], bone_count: sk.n };
        for (const k in v) if (VARIANT_KEYS.indexOf(k) < 0) errs.push("unknown key '" + k + "' (" + VARIANT_KEYS.join(", ") + ")");
        const each = function (kind, keys, max, make) {
          const table = v[kind];
          if (table === undefined) return;
          if (!table || typeof table !== "object" || Array.isArray(table)) { errs.push(kind + " is an object { name: { " + keys.join(", ") + " } }"); return; }
          const names = Object.keys(table);
          if (names.length > max) errs.push(kind + " has " + names.length + " entries and the most is " + max);
          names.forEach(function (name, i) {
            const what = kind + "." + name, e = table[name];
            if (i >= max) return;
            if (taken[name]) errs.push(what + ": the name is another entry's (a dye and an optional piece share the names a look says them by)");
            if (name === "look") errs.push(what + ": 'look' is not a name for a dye or a piece");
            taken[name] = true;
            if (!e || typeof e !== "object" || Array.isArray(e)) { errs.push(what + " is an object { " + keys.join(", ") + " }"); return; }
            for (const k in e) if (keys.indexOf(k) < 0) errs.push(what + ": unknown key '" + k + "' (" + keys.join(", ") + ")");
            const o = { name: name, parts: [], bones: [], bone_ids: [] };
            ["parts", "bones"].forEach(function (k) {
              if (e[k] === undefined) return;
              if (!Array.isArray(e[k]) || !e[k].length || !e[k].every(function (s) { return typeof s === "string" && s; })) { errs.push(what + "." + k + " is a list of names (" + JSON.stringify(e[k]) + ")"); return; }
              o[k] = e[k].slice();
            });
            o.bones.forEach(function (b) { const id = sk.index[b]; if (id === undefined) errs.push(what + ".bones: no bone '" + b + "' in the skeleton"); else o.bone_ids.push(id); });
            if (!o.parts.length && !o.bones.length) errs.push(what + " says no parts and no bones: it covers nothing");
            make(o, e, what);
            (kind === "dyes" ? out.dyes : out.optional).push(o);
          });
        };
        each("dyes", DYE_KEYS, MAX_DYES, function (o, e, what) {
          o.palette = []; o.base = null;
          if (e.palette !== undefined) {
            if (!Array.isArray(e.palette) || !e.palette.length) errs.push(what + ".palette is a list of colours [r, g, b] (0 .. 1)");
            else e.palette.forEach(function (c, j) { if (variant_rgb(c)) o.palette.push(c.slice()); else errs.push(what + ".palette[" + j + "] is a colour [r, g, b], 0 .. 1 (" + JSON.stringify(c) + ")"); });
          }
          if (e.base !== undefined) { if (variant_rgb(e.base)) o.base = e.base.slice(); else errs.push(what + ".base is a colour [r, g, b], 0 .. 1 (" + JSON.stringify(e.base) + ")"); }
        });
        each("optional", OPTIONAL_KEYS, MAX_OPTIONAL, function () { });
        // the looks: the LIST of variants the species declares, in order (an array, or an object whose names are the looks' names and whose order is their numbers), checked against the dyes and pieces that are there and
        // made whole: every look has a colour or null for every dye (what it does not say: null, the file's own) and a flag for every piece (what it does not say: there). A palette number is the colour it stands for.
        out.looks = []; out.look_names = []; out.look_by_name = Object.create(null);
        const blank = function () { return { dye: out.dyes.map(function () { return null; }), hide: out.optional.map(function () { return false; }) }; };
        if (v.looks !== undefined) {
          const L = v.looks, known = out.dyes.concat(out.optional).map(function (e) { return e.name; }).join(", ");
          if (!L || typeof L !== "object") errs.push("looks is a list [{ <dye>: colour | palette number | null, <piece>: true | false }, ...] or an object of them by name");
          else (Array.isArray(L) ? L.map(function (e, i) { return ["", e, "looks[" + i + "]"]; }) : Object.keys(L).map(function (name) { return [name, L[name], "looks." + name]; })).forEach(function (item) {
            const name = item[0], e = item[1], what = item[2], look = blank();
            if (!e || typeof e !== "object" || Array.isArray(e)) { errs.push(what + " is an object { <dye>: colour | palette number | null, <piece>: true | false }"); return; }
            for (const key in e) {
              const di = out.dyes.findIndex(function (x) { return x.name === key; }), gi = out.optional.findIndex(function (x) { return x.name === key; }), x = e[key];
              if (di >= 0) {
                const d = out.dyes[di];
                if (x === null) look.dye[di] = null;
                else if (Number.isInteger(x)) { if (x >= 0 && x < d.palette.length) look.dye[di] = d.palette[x].slice(); else errs.push(what + "." + key + ": the dye has " + d.palette.length + " colours in its palette, not a number " + x); }
                else if (variant_rgb(x)) look.dye[di] = x.slice();
                else errs.push(what + "." + key + " is a colour [r, g, b] (0 .. 1), a number of the dye's palette or null (" + JSON.stringify(x) + ")");
              } else if (gi >= 0) {
                if (typeof x === "boolean") look.hide[gi] = !x; else errs.push(what + "." + key + " is true (the piece is there) or false (" + JSON.stringify(x) + ")");
              } else errs.push(what + ": no dye or optional piece '" + key + "' (" + (known || "none") + ")");
            }
            if (name) out.look_by_name[name] = out.looks.length;
            out.looks.push(look); out.look_names.push(name);
          });
        } else {                                                                                             // (no list: look i wears the i-th colour of every dye's palette, taken round)
          let n = 0;
          out.dyes.forEach(function (d) { if (d.palette.length > n) n = d.palette.length; });
          for (let i = 0; i < n; i++) { const look = blank(); out.dyes.forEach(function (d, k) { if (d.palette.length) look.dye[k] = d.palette[i % d.palette.length].slice(); }); out.looks.push(look); out.look_names.push(""); }
        }
        if (!out.dyes.length && !out.optional.length && !errs.length) errs.push("it says no dye and no optional piece");
        out.K = out.dyes.length + Math.ceil(out.optional.length / 4);
        out.M = (out.looks.length + 1) * out.K;
        if (out.M > MAX_LOOK_VECTORS) errs.push("looks: " + out.looks.length + " looks of " + out.K + " vec4 each (and the first, the file's own) are " + out.M + " uniforms and the most is " + MAX_LOOK_VECTORS);
        if (errs.length) fail("variants: " + errs.join("; "));
        return out;
      }
      // the vertices a list of part names covers, as the mesh's part numbers: a part's id or the id of the sdf part it was made from (its twins too); a name that is no part's is a complaint
      function variant_part_set(p, names, what, errs) {
        const on = new Uint8Array(p.parts ? p.parts.length : 0);
        names.forEach(function (name) {
          let hit = false;
          if (p.parts) p.parts.forEach(function (q, i) { if (q.id === name || q.source === name) { on[i] = 1; hit = true; } });
          if (!hit) errs.push(what + ": no part '" + name + "' in the mesh (" + (p.parts ? p.parts.slice(0, 16).map(function (q) { return q.id; }).join(", ") + (p.parts.length > 16 ? " ..." : "") : "it has no parts") + ")");
        });
        return on;
      }
      // what a species' mesh says of its variants: one byte each for the three dyes' shares of a vertex (0 .. 255) and a fourth for the piece (0: none, else the piece's number + 1), the luminance of every dye's colour as the mesh has
      // it. vs: the compiled `variants`; p: the packed mesh; name: the species'. Every mistake is thrown (a dye that covers no vertex, an optional piece that two entries claim or that is welded to the rest), naming the entry.
      function make_variant_channel(vs, p, name) {
        if (!vs) return null;
        const n = p.n, B = new Uint8Array(4 * n), refs = [1, 1, 1], errs = [], BI = p.bone_indices, BW = p.bone_weights, PID = p.part_ids, C = p.a_color;
        vs.dyes.forEach(function (d, k) {
          const what = "dyes." + d.name, on = variant_part_set(p, d.parts, what, errs), bone = new Uint8Array(vs.bone_count);
          d.bone_ids.forEach(function (b) { bone[b] = 1; });
          let sum = 0, lum = 0, count = 0;
          for (let v = 0; v < n; v++) {
            let a = PID && on[PID[v]] ? 1 : 0;
            if (a < 1) { let s = 0; for (let j = 0; j < 4; j++) if (BW[4 * v + j] > 0 && bone[BI[4 * v + j]]) s += BW[4 * v + j]; a = s > 1 ? 1 : s; }
            const q = Math.round(a * 255);
            B[4 * v + k] = q;
            if (q) { const l = LUMINANCE[0] * C[4 * v] + LUMINANCE[1] * C[4 * v + 1] + LUMINANCE[2] * C[4 * v + 2]; sum += a; lum += a * l; count++; }
          }
          if (!count) errs.push(what + " covers no vertex of the mesh");
          const base = d.base ? LUMINANCE[0] * d.base[0] + LUMINANCE[1] * d.base[1] + LUMINANCE[2] * d.base[2] : (sum > 0 ? lum / sum : 1);
          refs[k] = base > 0.02 ? base : 0.02;                                                              // (a dye over a black region cannot be a ratio of nothing)
        });
        const group = new Uint8Array(n);
        vs.optional.forEach(function (g, k) {
          const what = "optional." + g.name, on = variant_part_set(p, g.parts, what, errs), bone = new Uint8Array(vs.bone_count);
          g.bone_ids.forEach(function (b) { bone[b] = 1; });
          let count = 0, clash = 0;
          for (let v = 0; v < n; v++) {
            if (!(PID && on[PID[v]]) && !(BW[4 * v] > 0 && bone[BI[4 * v]])) continue;                     // (a bone's vertex is one whose strongest bone it is)
            if (group[v]) { clash++; continue; }
            group[v] = k + 1; count++;
          }
          if (clash) errs.push(what + ": " + clash + " vertices are also another optional piece's");
          if (!count) errs.push(what + " covers no vertex of the mesh");
        });
        if (vs.optional.length) {
          const T = p.indices, joined = new Int32Array(vs.optional.length + 1);
          for (let i = 0; i < T.length; i += 3) {
            const a = group[T[i]], b = group[T[i + 1]], c = group[T[i + 2]];
            if (a === b && b === c) continue;
            if (a) joined[a]++; if (b && b !== a) joined[b]++; if (c && c !== a && c !== b) joined[c]++;
          }
          vs.optional.forEach(function (g, k) { if (joined[k + 1]) errs.push("optional." + g.name + ": " + joined[k + 1] + " triangles join it to the rest of the mesh: it is welded to the body, and only a shell of its own (an island, an sdf.meshes piece, a catalogue part, a prop) can be left out whole"); });
          for (let v = 0; v < n; v++) B[4 * v + 3] = group[v];
        }
        if (errs.length) fail("species '" + name + "': variants: " + errs.join("; "));
        return { bytes: B, refs: refs, group_of: group };
      }
      system.compile_variants = compile_variants; system.make_variant_channel = make_variant_channel;

      // ---- the table of looks (the uniform array) and the look an instance wears ----------------------------------------------------------------------------------------------
      // the table's vec4, made with the species (all zeros: the material holds them), and filled in place whenever the mesh is (the dyes' reference luminances are of the mesh): look number i (the first, 0, is the file's own)
      // is K vec4: for a dye the colour over the dye's reference luminance with w = 1 when the look says it, and the pieces' flags four to a vec4 (1: left out)
      function variant_make_table(vs) { const els = []; for (let e = 0; e < vs.M; e++) els.push(variant_vec4()); return els; }
      function variant_fill_table(sp) {
        const vs = sp.variants, K = vs.K, nd = vs.dyes.length, els = sp.look_els, refs = sp.vx ? sp.vx.refs : [1, 1, 1];
        for (let e = 0; e < els.length; e++) { els[e][0] = 0; els[e][1] = 0; els[e][2] = 0; els[e][3] = 0; }
        vs.looks.forEach(function (lk, i) {
          const base = (i + 1) * K;
          for (let k = 0; k < nd; k++) { const c = lk.dye[k], e = els[base + k]; if (c) { e[0] = c[0] / refs[k]; e[1] = c[1] / refs[k]; e[2] = c[2] / refs[k]; e[3] = 1; } }
          for (let g = 0; g < vs.optional.length; g++) if (lk.hide[g]) els[base + nd + (g >> 2)][g & 3] = 1;
        });
      }
      function variant_rng(seed) {
        let a = Math.floor(seed) >>> 0;
        return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      }
      // a look told by its NUMBER (taken round the list: 7 of 5 looks is the third, so that a page that asks every species for a number gets a look of each) or its name -> the number in the table (1 .. looks), or 0 for a species
      // that has no looks (it takes none); a mistake is thrown naming the species
      function variant_look(vs, sel, name, what) {
        const n = vs.looks.length, listed = vs.look_names.some(Boolean) ? vs.look_names.filter(Boolean).join(", ") : (n ? "0 .. " + (n - 1) : "it has none");
        if (sel !== null && typeof sel === "object" && !Array.isArray(sel) && Object.keys(sel).length === 1 && sel.look !== undefined) sel = sel.look;
        if (typeof sel === "number") {
          if (!Number.isInteger(sel) || sel < 0) throw new Error("system: " + what + ": a look is a whole number from 0 or a name (" + sel + ")");
          return n ? 1 + sel % n : 0;
        }
        if (typeof sel === "string") {
          const k = vs.look_by_name[sel];
          if (k === undefined) { if (!n) return 0; throw new Error("system: " + what + ": species '" + name + "' has no look '" + sel + "' (" + listed + ")"); }
          return 1 + k;
        }
        throw new Error("system: " + what + ": a look is a whole number from 0 or a name (" + JSON.stringify(sel) + ")");
      }
      // the look an instance is spawned with (its number in the table, 0: the file's own), thrown BEFORE the slot is taken; null for a species that has no variants
      function variant_for_spawn(sp, o) {
        if (!sp.variants) return null;                                                                      // (a species that has no variants takes none: a page may tell every species which variant, and the ones that have none are not affected)
        if (o.seed !== undefined && (typeof o.seed !== "number" || !Number.isFinite(o.seed))) throw new Error("system: spawn: seed is a finite number (" + o.seed + ")");
        const n = sp.variants.looks.length;
        let idx = o.seed !== undefined && n ? 1 + Math.floor(variant_rng(o.seed)() * n) : 0;
        if (o.variant !== undefined) { const k = variant_look(sp.variants, o.variant, sp.name, "spawn"); if (k) idx = k; }
        return idx;
      }
      // an instance wears look idx: kept by the page and, in the draw list (it is there while the instance is not culled), in the instance's entry
      function variant_set(sp, slot, idx) {
        sp.look_of[slot] = idx;
        const p = sp.draw_pos ? sp.draw_pos[slot] : -1;
        if (p >= 0) { sp.draw_list[p * 2 + 1] = idx; list_touch(sp, p); }
      }
      SP.set_variant = function (c, sel) {
        live_instance(this, c, "set_variant");
        const d = this.skin_list ? this.skin_list[this.skin_at[c.slot]] : this;                           // (the look is read as one of the skin the instance wears)
        if (!d.variants) return;                                                                        // (a species that has no variants is not affected)
        const idx = sel === null ? 0 : variant_look(d.variants, sel, d.name, "set_variant");
        if (sel !== null && idx === 0) return;                                                             // (a species with variants and no looks takes none)
        variant_set(d, c.slot, idx);
      };
      SP.variant_of = function (c) {
        live_instance(this, c, "variant_of");
        const d = this.skin_list ? this.skin_list[this.skin_at[c.slot]] : this;
        if (!d.variants) return {};                                                                     // (it wears nothing of what a species with variants does)
        const vs = d.variants, idx = this.look_of[c.slot], lk = idx ? vs.looks[idx - 1] : null, out = { look: idx ? idx - 1 : null };
        vs.dyes.forEach(function (d, k) { out[d.name] = lk && lk.dye[k] ? lk.dye[k].slice() : null; });
        vs.optional.forEach(function (g, k) { out[g.name] = lk ? !lk.hide[k] : true; });
        return out;
      };

      // ---- the page's half of the draw: the attribute of the vertices ---------------------------------------------------------------------------------------------------------
      // the attribute of the vertices' variant bytes: made the first time, its buffer filled; dropped with the channel (a species whose mesh is another one that has no variants' need)
      function upload_variant(sp) {
        const x = sp.vx;
        if (!sp.atts.happy_variant) { const att = engine.geometry_set_attr({ buffer_type: GL_DYNAMIC_DRAW, item_size: 4, data_type: GL_UBYTE }); sp.atts.happy_variant = att; sp.geo.attr.happy_variant = att.uuid; }
        const att = sp.atts.happy_variant;
        upload_attr(att, x.bytes); att.data_length = x.bytes.length;
        variant_fill_table(sp);                                                                              // (in place: the material's uniforms are these arrays, and the dyes' reference luminances are the mesh's)
      }
      function drop_variant(sp) {
        const att = sp.atts && sp.atts.happy_variant, gl = engine.webgl && engine.webgl.gl;
        if (!att) return;
        if (gl && att.buffer && gl.deleteBuffer) gl.deleteBuffer(att.buffer);
        att.buffer = null;
        if (engine._attributes) engine._attributes.delete(att.uuid);
        delete sp.atts.happy_variant; delete sp.geo.attr.happy_variant;
      }

      // ========================================================================================================================
      // cull
      // ========================================================================================================================
// system.js, a part: CULLING, the page's half: which camera culls, how, and the sphere of every species. The work is the worker's (body.cpp happy_cull_pass).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- culling ---------------------------------------------------------------------------------------------------------------------------------------------
      // The worker knows where every instance is and, if it is told which camera looks, whether the camera sees it. An instance that is outside the camera's frustum is updated at a coarse rate (`lod` frames: its time adds up, the
      // movers go on moving its root every frame), and the worker tells the page NOTHING of it: when it leaves, ONE root record whose scale is 0 (the page's rows say "not drawn", the way a released instance does), then no
      // record until it is back; when it is, its root is sent again with its scale and the rows of its bones that changed meanwhile go out in the rows' usual way. So a crowd of which a tenth is in sight costs a tenth of the
      // solve, of the traffic and of the uploads. What the page reads of an instance that is out of sight (sp.bone_position, sp.rows_of, ...) is what it last had of it: old.
      // CULLING IS ON BY DEFAULT: system culls by the engine's one perspective camera (see below, the auto mode) and a page does nothing for it; a page that has several cameras says which one:
      //   system.cull({ camera, on, lod, margin, auto })      camera: the engine's camera (engine.create_camera(): the id the worker knows it by is camera.uuid) whose frustum culls, null: none; on: true (the default) or false;
      //                                                lod: the divisor of the update of an instance that is out of sight, 1 .. 255 (8); margin: world units added to every instance's sphere (0.25: what an instance moves in a frame);
      //                                                auto: true gives the choice of the camera back to system. A call turns culling on (`on` is true unless it says false); the camera, lod and margin that are left out keep what they
      //                                                were; a call that says a camera, or says off, takes culling over from the auto mode. system.cull(false) is system.cull({ on: false }): everything is shown again.
      //                                                Culling with no camera culls nothing. -> what is in force: system.culling = { on, auto, lod, margin, camera }
      //   a species' SPHERE is what an instance is tested by: a centre and a radius about the root in the root's frame at scale 1, times the instance's scale. It is made from the mesh (the centre of its box, the distance of
      //   its farthest vertex from it, times 1.2 for the arms and wings that the bind pose does not have out) every time the species gets a mesh, or given: `bound: { center: [x, y, z], radius }` in the definition (a flyer
      //   whose wings reach far, a creature whose mesh is a stand-in). A species with no mesh and no `bound` is never culled. sp.bound: { center, radius, source: "mesh" | "definition" } or null.
      const CULL_KEYS = ["camera", "on", "lod", "margin", "auto"], CULL_PAD = 1.2;
      // CULLING IS ON BY DEFAULT, by the engine's one perspective camera (the AUTO mode: every frame system looks at the engine's cameras, `engine._cameras`, when their number has changed; if exactly one of them is a perspective
      // camera (type 1: the shadow cascades' cameras are orthographic) it is the camera that culls, and every species is drawn from its list; with none, or with several (a minimap, a split screen: system cannot know which one
      // the creatures are for, and culling by the wrong one hides them), nothing is culled until a page says system.cull({ camera })). `camera` is the camera that is culled by now (null: none).
      system.culling = { on: true, auto: true, lod: 8, margin: 0.25, camera: null };
      const culling_active = function () { return !!(system.culling.on && system.culling.camera); };
      system.cull = function (o) {
        if (o === false) o = { on: false };
        else if (o === true || o === undefined) o = {};
        if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("system: cull is { camera, on, lod, margin, auto }, true or false (" + JSON.stringify(o) + ")");
        for (const k in o) if (CULL_KEYS.indexOf(k) < 0) throw new Error("system: cull: unknown key '" + k + "' (" + CULL_KEYS.join(", ") + ")");
        const now = system.culling, v = { on: o.on === undefined ? true : o.on, auto: now.auto, lod: o.lod === undefined ? now.lod : o.lod, margin: o.margin === undefined ? now.margin : o.margin, camera: o.camera === undefined ? now.camera : o.camera };
        if (typeof v.on !== "boolean") throw new Error("system: cull: on is true or false (" + v.on + ")");
        if (o.auto !== undefined && typeof o.auto !== "boolean") throw new Error("system: cull: auto is true or false (" + o.auto + ")");
        if (!Number.isInteger(v.lod) || v.lod < 1 || v.lod > 255) throw new Error("system: cull: lod is a whole number from 1 to 255 (" + v.lod + ")");
        if (typeof v.margin !== "number" || !Number.isFinite(v.margin) || v.margin < 0) throw new Error("system: cull: margin is a number of world units, 0 or more (" + v.margin + ")");
        if (v.camera !== null && (typeof v.camera !== "object" || !Number.isInteger(v.camera.uuid) || v.camera.uuid <= 0)) throw new Error("system: cull: camera is the engine's camera (engine.create_camera(): it has a uuid) or null");
        // a page that says a camera, or says off, has taken culling over from the auto mode; { auto: true } gives it back (the camera is found again)
        if (o.auto !== undefined) v.auto = o.auto; else if (o.camera !== undefined || !v.on) v.auto = false;
        if (v.auto && o.auto === true && o.camera === undefined) v.camera = null;
        if (!initialized) system.init({});
        if (o.camera !== undefined || (o.auto === true && now.camera)) { q_begin(2); q_u(CMD_HAPPY_CAMERA); q_u(v.camera ? v.camera.uuid : 0); }
        q_begin(4); q_u(CMD_HAPPY_CULL); q_u(v.on ? 1 : 0); q_u(v.lod); q_f(v.margin);
        system.culling = v; cull_seen = -1;
        if (culling_active()) system.list.forEach(function (sp) { sp.set_listed(true); });                    // (every species is drawn from a list of its instances that are not culled from now on, below)
        return v;
      };
      // the auto mode: once a frame, before the commands go out (frame.js), look at the engine's cameras when there are more or fewer than last time
      let cull_seen = -1;
      function cull_auto() {
        const c = system.culling;
        if (!c.auto || !c.on || !initialized) return;
        const cams = engine._cameras;
        if (!cams || cams.size === cull_seen) return;
        cull_seen = cams.size;
        let one = null, n = 0;
        cams.forEach(function (cam) { if (cam.type === 1) { n++; one = cam; } });
        const want = n === 1 && Number.isInteger(one.uuid) && one.uuid > 0 ? one : null;
        if (want === c.camera) return;
        c.camera = want;
        q_begin(2); q_u(CMD_HAPPY_CAMERA); q_u(want ? want.uuid : 0);
        q_begin(4); q_u(CMD_HAPPY_CULL); q_u(1); q_u(c.lod); q_f(c.margin);
        if (want) system.list.forEach(function (sp) { sp.set_listed(true); });
      }
      // a definition's `bound` -> null (none) or { center: [x, y, z], radius, source: "definition" }; compile() says every mistake
      function compile_bound(b) {
        if (b === undefined || b === null) return null;
        if (typeof b !== "object" || Array.isArray(b)) fail("bound is { center: [x, y, z], radius } (a sphere about the root, in the root's frame at scale 1)");
        const errs = [];
        for (const k in b) if (k !== "center" && k !== "radius") errs.push("unknown key '" + k + "' (center, radius)");
        const c = b.center === undefined ? [0, 0, 0] : b.center;
        if (!Array.isArray(c) || c.length !== 3 || !c.every(function (x) { return typeof x === "number" && Number.isFinite(x); })) errs.push("center is [x, y, z] (" + JSON.stringify(b.center) + ")");
        if (typeof b.radius !== "number" || !Number.isFinite(b.radius) || b.radius < 0) errs.push("radius is a number of model units, 0 or more (" + b.radius + ")");
        if (errs.length) fail("bound: " + errs.join("; "));
        return { center: c.slice(), radius: b.radius, source: "definition" };
      }
      // the sphere of a packed mesh (pack_mesh's a_position): the centre of its box, the distance of its farthest vertex from it, padded
      function mesh_bound(p) {
        const P = p.a_position, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { const x = P[i + k]; if (x < lo[k]) lo[k] = x; if (x > hi[k]) hi[k] = x; }
        const c = [(lo[0] + hi[0]) * 0.5, (lo[1] + hi[1]) * 0.5, (lo[2] + hi[2]) * 0.5];
        let r2 = 0;
        for (let i = 0; i < P.length; i += 3) { const dx = P[i] - c[0], dy = P[i + 1] - c[1], dz = P[i + 2] - c[2], d = dx * dx + dy * dy + dz * dz; if (d > r2) r2 = d; }
        return { center: c, radius: Math.sqrt(r2) * CULL_PAD, source: "mesh" };
      }
      // the sphere the species has now (the definition's, else its mesh's) goes to the worker
      function send_bound(sp, p) {
        sp.bound = sp.bound_def || (p ? mesh_bound(p) : null);
        sp.sphere_own = sp.bound;                                                                       // (a species' own sphere; a skin's: the sphere that the worker culls by is their union, runtime.js)
        if (sp.skin_body) { if (sp.skin_body.skin_list) skins_bound(sp.skin_body); return; }          // (a skin: the worker knows the body)
        if (!sp.bound || sp.render_only) return;
        if (sp.skin_list) { skins_bound(sp); return; }                                                        // (the worker does not know a drawable of a family: it does not cull it)
        q_begin(6); q_u(CMD_HAPPY_BOUND); q_u(sp.js_id); q_f(sp.bound.center[0]); q_f(sp.bound.center[1]); q_f(sp.bound.center[2]); q_f(sp.bound.radius);
      }
      system.compile_bound = compile_bound; system.mesh_bound = mesh_bound;

      // ---- the list a species that culls is drawn from ---------------------------------------------------------------------------------------------------------------
      // A species that culls is drawn by ONE instanced draw of as many instances as are NOT culled: the draw's instance k is the slot `draw_list[k]`, an ATTRIBUTE of the draw (happy_slot: unsigned shorts, divisor 1; the shader
      // reads the instance's rows by it instead of by gl_InstanceID), so an instance that is out of sight is not in the draw at all: no vertex of it is shaded, and there is no fetch more for the vertex. The page keeps the
      // list from what the worker says and does itself, at no cost to the worker's response: a root record whose scale is 0 takes its slot out of the list, any other puts it in (nothing, if it is there), spawn puts
      // an instance in and release takes it out. Both are O(1) (the last entry takes the place of the one that goes) and the list goes to the GPU only when it changed, the entries from the first to the last that changed
      // in one bufferSubData. A species is listed from the moment culling is on (system.cull turns every species on; a species made while it is on is made so) and stays listed.
      const GL_USHORT = typeof GL_UNSIGNED_SHORT !== "undefined" ? GL_UNSIGNED_SHORT : 5123;
      function list_init(sp) {
        if (!sp.draw_list) { sp.list_stride = sp.variants ? 2 : 1; sp.draw_list = new Uint16Array(sp.max_instances * sp.list_stride); sp.draw_pos = new Int32Array(sp.max_instances); }          // (an entry is the slot and, for a species that has variants, the look it wears)
        sp.draw_pos.fill(-1);
        sp.draw_n = 0; sp.list_lo = 1 << 30; sp.list_hi = -1; sp.dirty_list = true;
      }
      function list_touch(sp, k) { if (k < sp.list_lo) sp.list_lo = k; if (k > sp.list_hi) sp.list_hi = k; sp.dirty_list = true; }
      function list_add(sp, slot) {
        if (sp.draw_pos[slot] >= 0) return;
        const n = sp.draw_n, S = sp.list_stride;
        sp.draw_list[n * S] = slot; if (S === 2) sp.draw_list[n * S + 1] = sp.look_of[slot];
        sp.draw_pos[slot] = n; sp.draw_n = n + 1;
        list_touch(sp, n);
      }
      function list_remove(sp, slot) {
        const p = sp.draw_pos[slot];
        if (p < 0) return;
        const S = sp.list_stride, n = sp.draw_n - 1, last = sp.draw_list[n * S];
        sp.draw_list[p * S] = last; if (S === 2) sp.draw_list[p * S + 1] = sp.draw_list[n * S + 1];
        sp.draw_pos[last] = p; sp.draw_pos[slot] = -1; sp.draw_n = n;
        if (p < n) list_touch(sp, p);
      }
      // the attribute: made the first time, its buffer filled whole (full) or the entries that changed rewritten; dropped with the list. happy_slot: an unsigned short an entry; happy_inst: two, the slot and the look
      function upload_list(sp, full) {
        if (!sp.draw_list) list_init(sp);
        const S = sp.list_stride, name = S === 2 ? "happy_inst" : "happy_slot";
        if (!sp.atts[name]) { const att = engine.geometry_set_attr({ buffer_type: GL_DYNAMIC_DRAW, item_size: S, data_type: GL_USHORT, divisor: 1 }); sp.atts[name] = att; sp.geo.attr[name] = att.uuid; full = true; }
        const att = sp.atts[name], gl = engine.webgl.gl;
        if (full || !att.buffer) { upload_attr(att, sp.draw_list); att.data_length = sp.draw_list.length; }
        else if (sp.list_hi >= sp.list_lo) { gl.bindBuffer(GL_ARRAY, att.buffer); gl.bufferSubData(GL_ARRAY, sp.list_lo * S * 2, sp.draw_list.subarray(sp.list_lo * S, (sp.list_hi + 1) * S)); }
        sp.dirty_list = false; sp.list_lo = 1 << 30; sp.list_hi = -1;
      }
      function drop_list(sp) {
        ["happy_slot", "happy_inst"].forEach(function (name) {
          const att = sp.atts && sp.atts[name], gl = engine.webgl && engine.webgl.gl;
          if (!att) return;
          if (gl && att.buffer && gl.deleteBuffer) gl.deleteBuffer(att.buffer);
          att.buffer = null;
          if (engine._attributes) engine._attributes.delete(att.uuid);
          delete sp.atts[name]; delete sp.geo.attr[name];
        });
      }
      // the species is drawn from a list (on) or by the first hw slots (off: the shader and the attribute follow; the instances that are culled are points in the rows, so nothing of them shows)
      SP.set_listed = function (on) {
        if (this.disposed || this.static) return;                                                            // (a static mesh is drawn by its first `hw` slots: the worker does not cull what it does not know)
        on = !!on;
        if (on === !!this.listed) return;
        if (!on && (this.variants || this.skin_list)) return;                                                                    // (a species that has variants is drawn from its list: the look is an attribute of the draw)
        this.listed = on;
        if (on) { list_init(this); for (let s = 0; s < this.hw; s++) if (this.alive[s] && this.mirror[s * 8 + 3] > 0) list_add(this, s); }
        if (this.mesh_src) this.set_mesh(this.mesh_src);
      };

      // ========================================================================================================================
      // skins
      // ========================================================================================================================
// system.js, a part: SKINS: one body, several skins.
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js (after cull: an instance is put in the draw list of its skin).
      // ---- skins ------------------------------------------------------------------------------------------------------------------------------------------------
      // A species is a BODY (its skeleton, rig, legs, mind, hit zones, physics: one family in the worker, one texture of rows) and the SKINS it can wear: each its own sdf or mesh, its own material, its own variants and
      // its own draw. Every skin is built on the bones of the same skeleton (the mesher names them), so one body and one mind serve a rifleman, an officer and a medic that look nothing alike; proportions differ by the
      // instance's scale. The definition's own sdf / mesh / variants / material are SKIN 0; `skins` lists the others:
      //   definition: skins: [ { name: "officer", sdf, variants?, material?, bound? }, { name: "medic", mesh, variants: true } ]      a skin has an `sdf` (system.build_sdf makes it, as for the body) or a plain `mesh`;
      //               `variants` its own (parts and bones of ITS mesh), or true: the body's definition, read against this skin's parts; `material` its own, else the body's; `bound` its own sphere, else the body's
      //   sp.spawn({ ..., skin: 2 | "officer", variant: 1, seed })      the skin by its number (taken round the list, as a look is) or its name ("default" is skin 0); then the look is one of THAT skin's variants
      //   sp.set_skin(c, 2 | "officer", { variant, seed })   changes an instance's skin (its look: the first, the file's own, unless the options say one)      sp.skin_of(c) -> { skin, name }
      //   sp.skin_list [the species itself, then a drawable for each skin: set_uniform, set_material, set_wire work on it]   sp.skin_names ["default", ...]   sp.skin_info() -> [{ skin, name, vertices, triangles, instances }]
      // A species that has no skins is not affected by a `skin` it is told and costs nothing here. HOW IT IS DRAWN: a skin is a render-only drawable of its body, like a family's prop, but skinned by all the bones:
      // it reads the BODY's texture (the rows the worker sends are the body's, one copy), has its own geometry, material and look table, and its own DRAW LIST (runtime.js: an entry is the slot, and the look for a skin that
      // has variants). An instance is in the list of the skin it wears and in no other, so a skin that nobody wears draws nothing; a species that has skins is always drawn from lists (as one that has variants is). Culling is
      // the body's: the sphere the worker tests an instance by is the union of the spheres of the skins' meshes (or the definition's `bound`). The look of an instance is one number (`look_of`), read as the look of its skin.
      const SKIN_KEYS = ["name", "sdf", "mesh", "variants", "material", "bound"], MAX_SKINS = 255;
      // the definition's `skins`, checked (every complaint at once) -> null (none) or [{ index, name, sdf, mesh, material_in, material, variants, bound }]; the variants are compiled against the bones and read against the mesh when the species is made
      function compile_skins(list, sk, life, input, body_variants) {
        if (list === undefined || list === null) return null;
        if (!Array.isArray(list) || !list.length) fail("skins is a list of skins { name, sdf | mesh, variants, material, bound } (the skins after the first: the definition's own sdf or mesh is skin 0)");
        if (list.length > MAX_SKINS - 1) fail("skins: " + list.length + " skins and the most is " + (MAX_SKINS - 1) + " besides the first");
        const errs = [], out = [], taken = { default: 0 };
        list.forEach(function (s, i) {
          const w = "skins[" + i + "]", c = { index: i + 1, name: "", sdf: null, mesh: null, material_in: undefined, material: null, variants: null, bound: null };
          if (!s || typeof s !== "object" || Array.isArray(s)) { errs.push(w + " is { name, sdf | mesh, variants, material, bound }"); return; }
          for (const k in s) if (SKIN_KEYS.indexOf(k) < 0) errs.push(w + ": unknown key '" + k + "' (" + SKIN_KEYS.join(", ") + ")");
          if (s.name !== undefined) {
            if (typeof s.name !== "string" || !/^[A-Za-z][A-Za-z0-9_\-]*$/.test(s.name)) errs.push(w + ".name is a word that starts with a letter (" + JSON.stringify(s.name) + ")");
            else if (taken[s.name] !== undefined) errs.push(w + ".name '" + s.name + "' is another skin's (the first skin is 'default')");
            else { taken[s.name] = i + 1; c.name = s.name; }
          }
          const has_sdf = s.sdf !== undefined && s.sdf !== null, has_mesh = s.mesh !== undefined && s.mesh !== null;
          if (!has_sdf && !has_mesh) errs.push(w + " needs an sdf or a mesh");
          if (has_sdf && has_mesh) errs.push(w + " has an sdf and a mesh: it is one or the other");
          if (has_sdf) { c.sdf = s.sdf; try { sdf_part_materials(s.sdf, (typeof input.name === "string" ? input.name : "system") + "#" + (c.name || i + 1)); } catch (e) { errs.push(w + ": " + String(e.message).replace(/^system: /, "")); } }
          if (has_mesh) c.mesh = s.mesh;
          if (s.material !== undefined) { c.material_in = s.material; try { c.material = compile_material(s.material, sk, life); } catch (e) { errs.push(w + ": " + String(e.message).replace(/^system: /, "")); } }
          if (s.variants === true) { if (!body_variants) errs.push(w + ".variants is true (the body's) and the definition has no variants"); else c.variants = body_variants; }
          else if (s.variants !== undefined && s.variants !== null && s.variants !== false) { try { c.variants = compile_variants(s.variants, sk); } catch (e) { errs.push(w + ": " + String(e.message).replace(/^system: /, "")); } }
          if (s.bound !== undefined) { try { c.bound = compile_bound(s.bound); } catch (e) { errs.push(w + ": " + String(e.message).replace(/^system: /, "")); } }
          out.push(c);
        });
        if (errs.length) fail("skins: " + errs.join("; "));
        return out;
      }
      system.compile_skins = compile_skins;
      // the geometry of every skin, resolved (an sdf must have been made: system.build_sdf) and checked BEFORE the species is registered with the worker -> [{ mesh, notes }] (null for a species with no skins)
      function skins_resolve(input, comp, ro) {
        if (!comp.skins) return null;
        if (ro) throw new Error("system: species '" + (input.name || "species") + "': a prop, a static mesh and a render-only species have no skins");
        return comp.skins.map(function (cs) {
          const who = (typeof input.name === "string" ? input.name : "species") + "#" + (cs.name || cs.index);
          const g = resolve_mesh({ name: who, sdf: cs.sdf, mesh: cs.mesh }, comp.sk), packed = pack_mesh(g.mesh, comp.sk);
          if (cs.variants) make_variant_channel(cs.variants, packed, who);                               // (a dye with no vertex in THIS mesh is refused now, naming the skin)
          return g;
        });
      }
      // the skin as a drawable of its body: what set_mesh, the material, the draw and the list ask of a species, with the body's rows, instance table and bones
      function make_skin(body, cs) {
        const d = new Species();
        d.name = body.name + "#" + (cs.name || cs.index); d.skin_body = body; d.skin_index = cs.index; d.skin_name = cs.name || String(cs.index);
        d.sk = body.sk; d.bone_count = body.bone_count; d.max_instances = body.max_instances; d.alive = body.alive; d.gen = body.gen; d.hw = 0;
        d.holder = null; d.static = false; d.render_only = true; d.built = true; d.disposed = false; d.visible = true; d.wire = false; d.error = 0; d.uploads = 0; d.fprops = null; d.fx = null;
        d.skinning = body.skinning; d.bound_def = cs.bound || body.bound_def; d.bound = null;
        d.material = cs.material_in !== undefined ? cs.material_in : body.material; d.mat_spec = cs.material || body.mat_spec;
        d.variants = cs.variants; d.look_els = cs.variants ? variant_make_table(cs.variants) : null; d.look_of = body.look_of;               // (the look of an instance is the body's one number a slot: this skin reads it as its own)
        d.geo = null; d.tex = null; d.mat = null; d.mesh_src = null; d.matx = null; d.mat_live = null; d.mat_channel = false; d.sky_live = null; d.mat_sky = false; d.vx = null; d.mat_variant = "";
        d.listed = true; d.draw_list = null; d.draw_pos = null; d.draw_n = 0; d.dirty_list = false; list_init(d);
        return d;
      }
      // the body's skins made and given their meshes (after the body's own set_mesh); the sphere culling uses is made from all of them
      function skins_attach(sp, comp, geos, input) {
        sp.skin_list = [sp]; sp.skin_names = ["default"]; sp.skin_at = new Uint8Array(sp.max_instances);
        comp.skins.forEach(function (cs, i) {
          const d = make_skin(sp, cs);
          sp.skin_list.push(d); sp.skin_names.push(d.skin_name);
          geos[i].notes.forEach(function (n) { sp.notes.push(n); if (typeof console !== "undefined") console.warn(n); });
          d.set_mesh(geos[i].mesh);
        });
      }
      // the sphere of the species is the union of the spheres of its skins' meshes: the worker culls the instance, whichever skin it wears. A sphere {center, radius} that holds both
      function sphere_union(a, b) {
        const dx = b.center[0] - a.center[0], dy = b.center[1] - a.center[1], dz = b.center[2] - a.center[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d + b.radius <= a.radius) return a;
        if (d + a.radius <= b.radius) return b;
        const R = (d + a.radius + b.radius) * 0.5, t = (R - a.radius) / d;
        return { center: [a.center[0] + dx * t, a.center[1] + dy * t, a.center[2] + dz * t], radius: R, source: a.source === b.source ? a.source : "mesh" };
      }
      function skins_bound(body) {
        let u = null;
        body.skin_list.forEach(function (d) { if (d.sphere_own && !d.disposed) u = u ? sphere_union(u, d.sphere_own) : d.sphere_own; });
        if (!u) return;
        body.bound = u;
        q_begin(6); q_u(CMD_HAPPY_BOUND); q_u(body.js_id); q_f(u.center[0]); q_f(u.center[1]); q_f(u.center[2]); q_f(u.radius);
      }
      // a skin told by its number (taken round the list: 7 of 3 skins is the second, so that a page that asks every species for a number gets a skin of each) or its name -> its number; a mistake is thrown naming the species
      function skin_index(sp, sel, what) {
        const n = sp.skin_list ? sp.skin_list.length : 1;
        if (typeof sel === "number") { if (!Number.isInteger(sel) || sel < 0) throw new Error("system: " + what + ": a skin is a whole number from 0 or a name (" + sel + ")"); return sel % n; }
        if (typeof sel === "string") { const k = sp.skin_names ? sp.skin_names.indexOf(sel) : -1; if (k < 0) throw new Error("system: " + what + ": species '" + sp.name + "' has no skin '" + sel + "' (" + (sp.skin_names ? sp.skin_names.join(", ") : "it has none") + ")"); return k; }
        throw new Error("system: " + what + ": a skin is a whole number from 0 or a name (" + JSON.stringify(sel) + ")");
      }
      // the skin an instance is spawned with, thrown BEFORE the slot is taken; 0 for a species that has no skins (it takes none: a page may tell every species which skin)
      function skin_for_spawn(sp, o) {
        if (!sp.skin_list || o.skin === undefined || o.skin === null) return 0;
        return skin_index(sp, o.skin, "spawn");
      }
      SP.set_skin = function (c, sel, o) {
        live_instance(this, c, "set_skin");
        if (!this.skin_list) return;                                                                       // (a species that has no skins is not affected)
        const k = skin_index(this, sel, "set_skin"), from = this.skin_list[this.skin_at[c.slot]], to = this.skin_list[k];
        o = o || {};
        const look = variant_for_spawn(to, o) || 0;
        if (from === to) { if (to.variants && (o.variant !== undefined || o.seed !== undefined)) variant_set(to, c.slot, look); return; }
        const drawn = from.draw_pos[c.slot] >= 0;                                                          // (in the draw: an instance that is out of sight is in no list, and goes into its skin's when it is back)
        if (drawn) list_remove(from, c.slot);
        this.skin_at[c.slot] = k; this.look_of[c.slot] = look;
        if (drawn) list_add(to, c.slot);
      };
      SP.skin_of = function (c) {
        live_instance(this, c, "skin_of");
        const k = this.skin_list ? this.skin_at[c.slot] : 0;
        return { skin: k, name: this.skin_names ? this.skin_names[k] : "default" };
      };
      SP.skin_info = function () {
        const sp = this, list = this.skin_list || [this];
        return list.map(function (d, k) { return { skin: k, name: sp.skin_names ? sp.skin_names[k] : "default", vertices: d.vertex_count || 0, triangles: d.triangle_count || 0, instances: d.draw_n || 0 }; });
      };

      // ========================================================================================================================
      // fx
      // ========================================================================================================================
// system.js, a part: CREATURE PARTICLES (SYSTEM.md "Creature particles"): what a creature asks of the world's particle system. The creature file's `particles` section names effects of the particle system and where on the
// body they are played; system does not draw or simulate them and does not import the particle system: each frame, from the render loop, it works out the WORLD position and facing of every mount that is on and hands them to a
// PLAYER the host gave it (system.use_particles). Nothing is attached: the player is asked again every frame, and an effect that is not asked for any more stops by itself. It is not a module of its own: system.js includes it,
// by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its.
//
//   particles: {                                                      the section of a creature definition (the file's top-level `particles`: creature_file.js)
//     exhaust: { effect: "exhaust_smoke", mount: { bone: "cab", at: [0.4, 1.2, -0.9], dir: [0, 1, 0] }, loop: { while: "speed", from: 0.3, to: 6 }, scale: 1 },
//     dust:    { effect: "dust_puff", mount: { bone: "foot_l" }, once: "landed" }
//   }
//     effect   the name of an effect of the player (the library of the GPU particle system: particles/gpu_particle_effects.js, happy_fx_presets.js): a "loop" kind for a loop, a "burst" kind for a once
//     mount    where it is played: `bone`, `at` the offset from the bone's head in the creature's frame at rest (x to its left, y up, z forward), `dir` where the effect's up points (a smoke goes up, a jet's flame back): [0, 1, 0].
//              Or `prop` (a prop of the creature's `props`, runtime.js) instead of `bone`: `at` and `dir` are then in the PROP's own frame (a rifle's muzzle), and it plays while the instance holds that prop
//     loop     it is played every frame while it is on, with an INTENSITY 0 .. 1: { while: "speed", from, to }  the creature's speed over the ground, off at `from` m/s and below, full at `to`   { while: "always" }
//              { while: "mind" }  what the creature's mind says: me.fx("exhaust", 0.7) in its worker (0 puts it out)   { while: "thrown" }  (a mount on a prop) while the prop is thrown: in the air or lying where it landed (a tear gas canister's cloud)
//     once     it is played once, when the event comes: "landed" (the speed of the landing makes it bigger), "hit" (a hit zone took an impact), "mind" (me.fx("flash", 1) in the worker), "impact" (a prop of the creature that was thrown
//              lands: the mount is on that prop, runtime.js: a bomb's burst, an axe's dust; the speed of the landing makes it bigger), "fire" (a weapon of the creature fires: the mount is on that prop, at its muzzle: the flash)
//              { while: "spin", bone: "prop" }  the engine is running: the intensity is 1 while the bone (a propeller, a rotor: the bone that the aircraft's `rotors` turn) turns, 0 when it stands, and follows it up and down in a fraction of a second as the
//              rotor spools (a quarter of a second up, half a second down); it is measured from the bone's own rows, so it needs nothing of the worker (a helicopter that hovers has a ground speed of 0 and its engine runs). The page does not get
//              a new row every frame, so the bone is turning for a quarter of a second after the last row in which it had changed
//     scale    the size of the effect (1)
//     on       false: the mount starts out SWITCHED OFF in every new instance (a flame that the pilot lights): true (the default)
//     lod      { near, far } in metres from the camera: the effect is played in full up to `near`, thins out (its rate falls) to nothing at `far` and is not played beyond it; `lod: false` plays it in full at any distance; left out: near 30 x scale,
//              far 4 x near (say only one of them and the other is worked out from it: far = 4 x near, near = far / 4)
//
//   SWITCHES: three, and a mount plays when all of them are on. system.fx_enable(on) is the page's: every effect of every creature (false: nothing is asked for and the player puts out what it had, in three frames);
//   sp.fx_species(name | null, on) the species': that mount (null: all of them) of every instance of it; sp.fx_on(c, name | null, on) the instance's. A switch that is off plays no `loop` and no `once` of that mount; the mind's
//   me.fx and the other state is kept, so a mount that is switched on again picks up where its source is now. sp.fx_state(c) -> [{ name, effect, on, level, lod }]: for each mount whether it is on, the intensity it was asked for at the
//   last frame (0 .. 1, after the LOD) and the LOD's share of it (1: in full, 0: too far)
//   LOD: system.fx_lod(o) -> { on, scale, camera }: o is true / false (the distance LOD on or off), or { on, scale, camera }: `scale` multiplies every mount's near and far (0.5: half the distance: a slower machine), `camera` is where
//   the camera is: [x, y, z], a function that returns it, or null for the camera that culls (system.culling.camera) and then the engine's (engine.global_camera_position); with none of them the LOD is not applied (the effects are in full).
//   system.fx_stats -> { instances, asked, off, far }: what the last system.fx_frame did: the instances it looked at, the loops it handed to the player, the mounts that a switch kept quiet, the mounts that were too far
//
//   system.use_particles(player | null)    player: { play(key, name, x, y, z, q, intensity, scale), once(name, x, y, z, q, scale), trail?(name, ax, ay, az, bx, by, bz, speed, scale, age) (a tracer: a loop effect flown along a shot), frame?(dt) }
//        play   a loop that is on: asked every frame, `key` is a number that is the same for the same mount of the same instance; (x, y, z) the world place, q = [x, y, z, w] the facing (the effect's up along the mount's dir:
//               a scratch array, copy it to keep it), intensity 0 .. 1.  once   one burst.  frame(dt)  once after the creatures of the frame were asked: where a player puts out what it was not asked for
//   system.fx_player(gp, { idle })         the player of the GPU particle system gp (engine.gpu_particles): one effect of the library for every key, made when the key is first asked for, put to sleep and kept in a pool when
//                                        it has not been asked for `idle` frames (3); the intensity is the rate of its layers
//   sp.fx                                null, or { list, by_name, ... } the compiled section of a species with one (every mount: name, effect, bone, p (the bind point), dir, loop, once, scale)
//   what the page does each frame: system.use_particles puts system.fx_frame(dt) at the engine's on_frame_begin (once a frame, before any pass: render_all is called by every shadow cascade and by the scene pass, so it is not the place): for
//   every drawn instance (an instance that is out of sight plays nothing) of a species with the section. A page without on_frame_begin calls system.fx_frame(dt) itself.
//   a creature's WORKER says me.fx(name, intensity): the page hears the event "fx:<name>" (pure.js)
      const FX_SOURCES = ["speed", "always", "mind", "thrown", "spin"], FX_ONCE = ["landed", "hit", "mind", "impact", "fire"];
      const FX_LOD_NEAR = 30;                                                                          // (metres, times the mount's scale: where the effect starts to thin out; it is gone at four times that)
      const fx_state = { player: null, species: [], seq: 0, on: true, lod: { on: true, scale: 1, camera: null }, stats: { instances: 0, asked: 0, off: 0, far: 0 } };
      system.fx_stats = fx_state.stats;
      const fx_p = new Float32Array(3), fx_q = new Float32Array(4);

      // the section as the species keeps it: checked here against the skeleton; null for none
      function compile_particles(input, sk) {
        if (input === undefined || input === null) return null;
        if (typeof input !== "object" || Array.isArray(input)) fail("particles is { name: { effect, mount: { bone, at, dir }, loop | once, scale } }");
        const names = Object.keys(input);
        if (!names.length) return null;
        if (names.length > 32) fail("particles: at most 32 of them (" + names.length + ")");
        const list = [], by_name = Object.create(null);
        names.forEach(function (name) {
          const where = "particles." + name, d = input[name];
          if (!/^[a-z][a-z0-9_]*$/.test(name)) fail(where + ": a name is lower case letters, digits and _");
          if (!d || typeof d !== "object" || Array.isArray(d)) fail(where + " is { effect, mount: { bone, at, dir }, loop | once, scale }");
          only_keys(d, ["effect", "mount", "loop", "once", "scale", "on", "lod"], where);
          if (typeof d.effect !== "string" || !d.effect) fail(where + ".effect is the name of an effect of the particle system");
          const m = d.mount;
          if (!m || typeof m !== "object" || Array.isArray(m)) fail(where + ".mount is { bone, at, dir }");
          only_keys(m, ["bone", "prop", "at", "dir"], where + ".mount");
          if ((m.bone === undefined) === (m.prop === undefined)) fail(where + ".mount is on a `bone` or on a `prop` (one of them)");
          if (m.prop !== undefined && (typeof m.prop !== "string" || !/^[a-z][a-z0-9_]*$/.test(m.prop))) fail(where + ".mount.prop is the name of a prop of the creature (its `props`)");
          const b = m.prop !== undefined ? -1 : sk.index[m.bone];
          if (b === undefined) fail(where + ".mount.bone '" + m.bone + "' is not a bone of the skeleton");
          const at = m.at === undefined ? [0, 0, 0] : vec3(m.at, where + ".mount.at"), dir = m.dir === undefined ? [0, 1, 0] : vec3(m.dir, where + ".mount.dir");
          const dl = Math.hypot(dir[0], dir[1], dir[2]);
          if (!(dl > 1e-6)) fail(where + ".mount.dir is a direction, not [0, 0, 0]");
          if ((d.loop === undefined) === (d.once === undefined)) fail(where + " is a loop or a once: it has one of them");
          const scale = d.scale === undefined ? 1 : d.scale;
          if (typeof scale !== "number" || !(scale > 0 && scale <= 100)) fail(where + ".scale is a number above 0 (1)");
          if (d.on !== undefined && typeof d.on !== "boolean") fail(where + ".on is true or false (true: the mount starts out switched on)");
          let near = FX_LOD_NEAR * scale, far = near * 4, lod = true;
          if (d.lod === false) lod = false;
          else if (d.lod !== undefined) {
            const l = d.lod;
            if (!l || typeof l !== "object" || Array.isArray(l)) fail(where + ".lod is { near, far } in metres from the camera, or false");
            only_keys(l, ["near", "far"], where + ".lod");
            if (l.near !== undefined) { near = l.near; far = l.far === undefined ? near * 4 : l.far; } else if (l.far !== undefined) { far = l.far; near = far / 4; }
            if (typeof near !== "number" || typeof far !== "number" || !(near >= 0) || !(far > near) || !(far < 100000)) fail(where + ".lod: near and far are distances in metres, 0 <= near < far");
          }
          const e = { name: name, effect: d.effect, bone: b, prop: m.prop !== undefined ? m.prop : null, p: b < 0 ? [at[0], at[1], at[2]] : [sk.head[b * 3] + at[0], sk.head[b * 3 + 1] + at[1], sk.head[b * 3 + 2] + at[2]], dir: [dir[0] / dl, dir[1] / dl, dir[2] / dl], loop: false, src: -1, from: 0, to: 1, once: -1, scale: scale, on: d.on !== false, lod: lod, near: near, far: far, spin: -1 };
          if (d.loop !== undefined) {
            const l = d.loop;
            if (!l || typeof l !== "object" || Array.isArray(l)) fail(where + ".loop is { while: \"speed\" | \"always\" | \"mind\" | \"thrown\" | \"spin\", from, to, bone }");
            only_keys(l, ["while", "from", "to", "bone"], where + ".loop");
            e.src = FX_SOURCES.indexOf(l.while);
            if (e.src < 0) fail(where + ".loop.while is " + FX_SOURCES.map(function (s) { return "\"" + s + "\""; }).join(", ") + " (" + JSON.stringify(l.while) + ")");
            if (e.src !== 0 && (l.from !== undefined || l.to !== undefined)) fail(where + ".loop: from and to are for while \"speed\"");
            if (e.src === 3 && e.prop === null) fail(where + ".loop.while \"thrown\" is of a prop: its mount is on a `prop`");
            if (e.src === 4) {
              if (typeof l.bone !== "string" || sk.index[l.bone] === undefined) fail(where + ".loop.bone '" + l.bone + "' is not a bone of the skeleton: while \"spin\" watches the bone that turns (a propeller, a rotor)");
              e.spin = sk.index[l.bone];
            } else if (l.bone !== undefined) fail(where + ".loop: bone is for while \"spin\"");
            if (e.src === 0) {
              e.from = l.from === undefined ? 0 : l.from; e.to = l.to === undefined ? 1 : l.to;
              if (typeof e.from !== "number" || typeof e.to !== "number" || !(e.from >= 0) || !(e.to > e.from) || !(e.to < 1000)) fail(where + ".loop: from and to are speeds in m/s, 0 <= from < to");
            }
            e.loop = true;
          } else {
            e.once = FX_ONCE.indexOf(d.once);
            if (e.once < 0) fail(where + ".once is " + FX_ONCE.map(function (s) { return "\"" + s + "\""; }).join(", ") + " (" + JSON.stringify(d.once) + ")");
            if ((e.once === 3 || e.once === 4) && e.prop === null) fail(where + ".once \"" + FX_ONCE[e.once] + "\" is of a prop (the landing of a thrown one, the shot of a weapon): its mount is on a `prop`");
          }
          by_name[name] = list.length;
          list.push(e);
        });
        return { list: list, by_name: by_name };
      }

      // the species has the section: its state per instance (what the mind said, the speed, where the root was)
      function fx_setup(sp, comp, max) {
        if (!comp) return null;
        const n = comp.list.length;
        comp.list.forEach(function (e) { if (e.prop !== null && !(sp.fprops && sp.fprops.by_name[e.prop] !== undefined)) fail("particles." + e.name + ".mount.prop '" + e.prop + "' is not a prop of the creature (the file's `props`)"); });
        // level: what the mind said, or how much a `spin` is turning; off: the instance's switch (1 = off); mount_off: the species' switch; last / lodk: what the last frame asked for (after the LOD) and the LOD's share; sq: a spin bone's last turn (fx_spin)
        const f = { id: ++fx_state.seq, list: comp.list, by_name: comp.by_name, level: new Float32Array(max * n), off: new Uint8Array(max * n), mount_off: new Uint8Array(n), last: new Float32Array(max * n), lodk: new Float32Array(max * n),
          sq: new Float32Array(max * n * 5), speed: new Float32Array(max), px: new Float32Array(max), pz: new Float32Array(max), have: new Uint8Array(max) };
        for (let s = 0; s < max; s++) comp.list.forEach(function (e, i) { f.off[s * n + i] = e.on ? 0 : 1; });
        fx_state.species.push(sp);
        return f;
      }
      function fx_reset(sp, slot) {
        const f = sp.fx, n = f.list.length;
        for (let i = 0; i < n; i++) { f.level[slot * n + i] = 0; f.off[slot * n + i] = f.list[i].on ? 0 : 1; f.last[slot * n + i] = 0; f.lodk[slot * n + i] = 0; }
        f.speed[slot] = 0; f.have[slot] = 0;
      }
      function fx_forget(sp) { const k = fx_state.species.indexOf(sp); if (k >= 0) fx_state.species.splice(k, 1); }

      // v rotated by q = [x, y, z, w] -> out (no allocation)
      function fx_rot(qx, qy, qz, qw, vx, vy, vz, out) {
        const cx = qy * vz - qz * vy + qw * vx, cy = qz * vx - qx * vz + qw * vy, cz = qx * vy - qy * vx + qw * vz;
        out[0] = vx + 2 * (qy * cz - qz * cy); out[1] = vy + 2 * (qz * cx - qx * cz); out[2] = vz + 2 * (qx * cy - qy * cx);
      }
      const fx_a = new Float32Array(3), fx_b = new Float32Array(3);
      // where the mount is in the world now, and which way its up points: fx_p, fx_q. From the rows the worker sent: the bone's skinning transform takes the bind point to the model's space, the root's takes it to the world
      let fx_flying = false;                                                                           // (set by the last prop's pose: the prop is thrown)
      function fx_mount_pose(sp, slot, e, hh) {
        fx_flying = false;
        if (e.prop !== null) return fx_prop_pose(sp, slot, e, hh);
        const m = sp.mirror, o = sp.root_rows * W * 4 + slot * sp.bone_count * 8 + e.bone * 8, r = slot * 8;
        const bq0 = m[o + 4], bq1 = m[o + 5], bq2 = m[o + 6], bq3 = m[o + 7], bs = m[o + 3];
        const rq0 = m[r + 4], rq1 = m[r + 5], rq2 = m[r + 6], rq3 = m[r + 7], rs = m[r + 3];
        fx_rot(bq0, bq1, bq2, bq3, e.p[0], e.p[1], e.p[2], fx_a);                                  // (the point, turned by its bone)
        const mx = fx_a[0] * bs + m[o], my = fx_a[1] * bs + m[o + 1], mz = fx_a[2] * bs + m[o + 2];
        fx_rot(rq0, rq1, rq2, rq3, mx, my, mz, fx_a);                                              // (and by the root)
        fx_p[0] = m[r] + fx_a[0] * rs; fx_p[1] = m[r + 1] + fx_a[1] * rs; fx_p[2] = m[r + 2] + fx_a[2] * rs;
        fx_rot(bq0, bq1, bq2, bq3, e.dir[0], e.dir[1], e.dir[2], fx_a);                            // (the direction: the bone's turn, then the root's: no scale, no place)
        fx_rot(rq0, rq1, rq2, rq3, fx_a[0], fx_a[1], fx_a[2], fx_b);
        // the turn that takes the effect's up [0, 1, 0] to that direction: the axis is [d.z, 0, -d.x], the angle the one whose cosine is d.y
        const dx = fx_b[0], dy = fx_b[1], dz = fx_b[2], w = 1 + dy;
        if (w < 1e-6) { fx_q[0] = 1; fx_q[1] = 0; fx_q[2] = 0; fx_q[3] = 0; }
        else { const l = Math.hypot(dz, dx, w) || 1; fx_q[0] = dz / l; fx_q[1] = 0; fx_q[2] = -dx / l; fx_q[3] = w / l; }
        return true;
      }
      // a mount on a prop: the prop's own row (its place, its scale, its turn: runtime.js puts it at its parent's bone) carries the point and the direction; false when the instance does not hold the prop (or it is not drawn)
      function fx_prop_pose(sp, slot, e, hh) {                                                         // hh: the prop that is asked for (the one that landed); left out: the first the instance has
        const f = sp.fprops, i = f ? f.by_name[e.prop] : undefined;
        if (i === undefined) return false;
        let h = hh || null;
        for (let k = 0; k < f.list[i].per && !h; k++) h = f.slots[i][slot * f.list[i].per + k];
        if (!h) return false;
        const pm = system.fp_pose(sp, h), s = pm[3], qx = pm[4], qy = pm[5], qz = pm[6], qw = pm[7];         // (the prop's place now: on its bone's row, or its flight's: runtime.js)
        if (!(s > 0)) return false;
        fx_flying = !!h.flight;
        fx_rot(qx, qy, qz, qw, e.p[0], e.p[1], e.p[2], fx_a);
        fx_p[0] = pm[0] + fx_a[0] * s; fx_p[1] = pm[1] + fx_a[1] * s; fx_p[2] = pm[2] + fx_a[2] * s;
        fx_rot(qx, qy, qz, qw, e.dir[0], e.dir[1], e.dir[2], fx_b);
        const dx = fx_b[0], dy = fx_b[1], dz = fx_b[2], w = 1 + dy;
        if (w < 1e-6) { fx_q[0] = 1; fx_q[1] = 0; fx_q[2] = 0; fx_q[3] = 0; }
        else { const l = Math.hypot(dz, dx, w) || 1; fx_q[0] = dz / l; fx_q[1] = 0; fx_q[2] = -dx / l; fx_q[3] = w / l; }
        return true;
      }

      system.use_particles = function (player) {
        if (player !== null && (typeof player !== "object" || typeof player.play !== "function" || typeof player.once !== "function")) throw new Error("system: use_particles takes { play(key, name, x, y, z, q, intensity, scale), once(name, x, y, z, q, scale), frame?(dt) } or null");
        fx_state.player = player;
        if (player && !fx_state.hooked && engine.on_frame_begin && typeof engine.on_frame_begin.add === "function") { fx_state.hooked = true; engine.on_frame_begin.add(function (time, dt) { system.fx_frame(dt); }); }
        return system;
      };

      // where the camera is, for the LOD: the page's (system.fx_lod({ camera })), else the camera that culls, else the engine's last (debug.js sets it each frame, its [3] is the far plane: 0 = never set); null: unknown
      function fx_camera() {
        const c = fx_state.lod.camera;
        if (c) return typeof c === "function" ? c() : c;
        const cam = system.culling && system.culling.camera;
        if (cam && cam.world_position) return cam.world_position;
        const g = engine.global_camera_position;
        return g && g[3] > 0 ? g : null;
      }
      // the LOD's share of a mount at the distance d: 1 up to near, a smooth fall to 0 at far (the share of the rate that is played: a plume that is far thins out before it is gone)
      function fx_lod_k(e, d) {
        const L = fx_state.lod;
        if (!e.lod || !L.on || d < 0) return 1;
        const near = e.near * L.scale, far = e.far * L.scale;
        if (d <= near) return 1;
        if (d >= far) return 0;
        const u = (d - near) / (far - near);
        return 1 - u * u * (3 - 2 * u);
      }
      // a spin: the bone's turn since the last frame, from its own row (a skinning rotation, in the model's space: the aircraft's own bank and pitch are in the root's), smoothed so that a rotor that spools up or down fades
      // The page does not get a new row every frame (the worker's frames and the page's are not the same), so a frame in which the bone has not changed is no proof that it stands: it turns while it changed in the last FX_SPIN_HOLD seconds.
      // sq has five floats for a mount: the bone's rotation the last time it differed, and the seconds since
      const FX_SPIN_HOLD = 0.25;
      function fx_spin(sp, f, slot, e, ni, dt, had) {
        const m = sp.mirror, o = sp.root_rows * W * 4 + slot * sp.bone_count * 8 + e.spin * 8, s = ni * 5, q = f.sq;
        const x = m[o + 4], y = m[o + 5], z = m[o + 6], w = m[o + 7];
        if (!had) { q[s] = x; q[s + 1] = y; q[s + 2] = z; q[s + 3] = w; q[s + 4] = 1e3; }                // (not seen last frame: it starts out standing)
        else if (Math.abs(x * q[s] + y * q[s + 1] + z * q[s + 2] + w * q[s + 3]) < 0.99999) { q[s] = x; q[s + 1] = y; q[s + 2] = z; q[s + 3] = w; q[s + 4] = 0; }      // (it turned by more than about half a degree: a rotor at idle turns many times that)
        else q[s + 4] += dt;
        const l = f.level[ni];
        f.level[ni] = q[s + 4] < FX_SPIN_HOLD ? Math.min(1, l + dt * 4) : Math.max(0, l - dt * 2);       // (a quarter of a second up, half a second down: a rotor that has stopped is not smoking for long)
      }

      // once a frame, from system.render_all: every loop that is on is asked for, at the place it is now
      let fx_last = 0;
      system.fx_frame = function (dt) {
        const P = fx_state.player, sl = fx_state.species, st = fx_state.stats;
        st.instances = 0; st.asked = 0; st.off = 0; st.far = 0;
        if (!P || !sl.length) { fx_last = 0; return; }
        if (!(dt > 0)) {
          const now = typeof performance !== "undefined" ? performance.now() : Date.now();
          dt = fx_last ? (now - fx_last) / 1000 : (engine.time_delta > 0 ? engine.time_delta : 1 / 60); fx_last = now;
        }
        dt = Math.min(Math.max(dt, 1 / 240), 0.1);
        const cam = fx_state.on && fx_state.lod.on ? fx_camera() : null;                                  // (the switch that is off: no loop is asked for, and the player puts out what it had)
        if (!fx_state.on) fx_state.paused = true;
        else if (fx_state.paused) { fx_state.paused = false; for (let k = 0; k < sl.length; k++) sl[k].fx.have.fill(0); }      // (switched on again: the speeds and the spins start over, they would jump by what moved meanwhile)
        if (fx_state.on) for (let k = 0; k < sl.length; k++) {
          const sp = sl[k], f = sp.fx;
          if (sp.disposed || sp.visible === false) continue;
          const n = f.list.length, m = sp.mirror, smooth = Math.min(1, dt * 6);
          for (let slot = 0; slot < sp.hw; slot++) {
            if (!sp.alive[slot]) { f.have[slot] = 0; continue; }
            const r = slot * 8;
            if (!(m[r + 3] > 0)) { f.have[slot] = 0; continue; }                                    // (not drawn: out of sight, or just released: it plays nothing)
            const had = f.have[slot];
            if (had) f.speed[slot] += (Math.hypot(m[r] - f.px[slot], m[r + 2] - f.pz[slot]) / dt - f.speed[slot]) * smooth;
            else f.speed[slot] = 0;
            f.px[slot] = m[r]; f.pz[slot] = m[r + 2]; f.have[slot] = 1;
            st.instances++;
            const d = cam ? Math.hypot(m[r] - cam[0], m[r + 1] - cam[1], m[r + 2] - cam[2]) : -1;
            for (let i = 0; i < n; i++) {
              const e = f.list[i];
              if (!e.loop) continue;
              const ni = slot * n + i;
              if (e.src === 4) fx_spin(sp, f, slot, e, ni, dt, had);                                  // (it goes on measuring while the mount is switched off: no jump when it is switched on)
              if (f.off[ni] || f.mount_off[i]) { f.last[ni] = 0; st.off++; continue; }
              const kl = fx_lod_k(e, d), v = f.speed[slot], a = e.src === 0 ? (v <= e.from ? 0 : Math.min(1, (v - e.from) / (e.to - e.from))) : e.src === 2 || e.src === 4 ? f.level[ni] : 1;
              f.lodk[ni] = kl;
              if (!(a > 0.001)) { f.last[ni] = 0; continue; }
              if (!(kl > 0.001)) { f.last[ni] = 0; st.far++; continue; }
              if (!fx_mount_pose(sp, slot, e)) { f.last[ni] = 0; continue; }
              if (e.src === 3 && !fx_flying) { f.last[ni] = 0; continue; }                            // (a loop of a prop that is thrown: not while it is in a hand or on a back)
              f.last[ni] = a * kl; st.asked++;
              P.play(f.id * 4194304 + slot * 64 + i, e.effect, fx_p[0], fx_p[1], fx_p[2], fx_q, a * kl, e.scale);
            }
          }
        }
        if (typeof P.frame === "function") P.frame(dt);
      };

      // the switches (see the header). A mount's name is the key of the file's section; null is every mount
      function fx_of(sp, what) { if (!sp.fx) throw new Error("system: " + what + ": species '" + sp.name + "' has no `particles` section"); return sp.fx; }
      function fx_mounts(f, name, what) {
        if (name === null || name === undefined) return f.list.map(function (e, i) { return i; });
        const i = f.by_name[name];
        if (i === undefined) throw new Error("system: " + what + ": no mount '" + name + "' in the `particles` of the species (" + f.list.map(function (e) { return e.name; }).join(", ") + ")");
        return [i];
      }
      system.fx_enable = function (on) {
        if (on === undefined) return fx_state.on;
        if (typeof on !== "boolean") throw new Error("system: fx_enable takes true or false (" + JSON.stringify(on) + ")");
        fx_state.on = on;
        return on;
      };
      system.fx_lod = function (o) {
        const L = fx_state.lod;
        if (o === undefined) return L;
        if (typeof o === "boolean") { L.on = o; return L; }
        if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("system: fx_lod is true, false or { on, scale, camera } (" + JSON.stringify(o) + ")");
        only_keys(o, ["on", "scale", "camera"], "fx_lod");
        if (o.on !== undefined) { if (typeof o.on !== "boolean") throw new Error("system: fx_lod.on is true or false"); L.on = o.on; }
        if (o.scale !== undefined) { if (typeof o.scale !== "number" || !(o.scale > 0 && o.scale <= 1000)) throw new Error("system: fx_lod.scale is a number above 0 (1)"); L.scale = o.scale; }
        if (o.camera !== undefined) {
          if (o.camera !== null && typeof o.camera !== "function" && !(Array.isArray(o.camera) && o.camera.length >= 3 && o.camera.slice(0, 3).every(Number.isFinite))) throw new Error("system: fx_lod.camera is [x, y, z], a function that returns it, or null");
          L.camera = o.camera;
        }
        return L;
      }
      SP.fx_on = function (c, name, on) {
        live_instance(this, c, "fx_on");
        const f = fx_of(this, "fx_on"), idx = fx_mounts(f, name, "fx_on");
        if (typeof on !== "boolean") throw new Error("system: fx_on(c, name, on): on is true or false (" + JSON.stringify(on) + ")");
        for (let k = 0; k < idx.length; k++) f.off[c.slot * f.list.length + idx[k]] = on ? 0 : 1;
        return this;
      };
      SP.fx_species = function (name, on) {
        const f = fx_of(this, "fx_species"), idx = fx_mounts(f, name, "fx_species");
        if (typeof on !== "boolean") throw new Error("system: fx_species(name, on): on is true or false (" + JSON.stringify(on) + ")");
        for (let k = 0; k < idx.length; k++) f.mount_off[idx[k]] = on ? 0 : 1;
        return this;
      };
      SP.fx_state = function (c) {
        live_instance(this, c, "fx_state");
        const f = fx_of(this, "fx_state"), n = f.list.length;
        return f.list.map(function (e, i) {
          const ni = c.slot * n + i;
          const on = fx_state.on && !f.off[ni] && !f.mount_off[i];
          return { name: e.name, effect: e.effect, loop: e.loop, on: on, level: on && f.have[c.slot] ? f.last[ni] : 0, lod: f.lodk[ni] };
        });
      };

      // an event of a creature: kind 0 landed, 1 hit, 2 mind (the effect `only`), 3 impact (of the prop named `prop`: its effects only); the once effects of that kind are played at their mounts
      system.fx_fire = function (sp, slot, kind, value, only, prop, handle) {
        const P = fx_state.player, f = sp.fx;
        if (!P || !f || !fx_state.on || !(sp.mirror[slot * 8 + 3] > 0)) return;
        const n = f.list.length, k = kind === 0 ? Math.min(3, Math.max(0.25, value / 4)) : kind === 2 ? (value > 0 ? value : 1) : kind === 3 ? Math.min(2, Math.max(0.5, value / 8)) : 1;
        const cam = fx_state.lod.on ? fx_camera() : null, r = slot * 8, d = cam ? Math.hypot(sp.mirror[r] - cam[0], sp.mirror[r + 1] - cam[1], sp.mirror[r + 2] - cam[2]) : -1;
        for (let i = 0; i < n; i++) {
          const e = f.list[i];
          if (e.once !== kind || (only !== undefined && only !== i) || (prop !== undefined && e.prop !== prop)) continue;
          if (f.off[slot * n + i] || f.mount_off[i] || !(fx_lod_k(e, d) > 0.001)) continue;                // (switched off, or too far to be seen: a burst is played or not, it does not thin out)
          if (!fx_mount_pose(sp, slot, e, handle)) continue;
          P.once(e.effect, fx_p[0], fx_p[1], fx_p[2], fx_q, e.scale * k);
        }
      };
      // what the creature's worker said: me.fx(name, v) is the tag "fx:<name>"
      system.fx_tag = function (sp, slot, tag, value) {
        if (typeof tag !== "string" || tag.charCodeAt(0) !== 102 || tag.indexOf("fx:") !== 0) return;
        const f = sp.fx, i = f.by_name[tag.slice(3)];
        if (i === undefined || slot >= sp.max_instances || !sp.alive[slot]) return;
        const e = f.list[i];
        if (e.loop) { if (e.src === 2) f.level[slot * f.list.length + i] = value > 1 ? 1 : value > 0 ? value : 0; }
        else if (e.once === 2) system.fx_fire(sp, slot, 2, value, i);
      };

      // the player of the GPU particle system (particles/gpu_particles.js, gpu_particle_effects.js) for system.use_particles
      system.fx_player = function (gp, o) {
        if (!gp || typeof gp.effect !== "function" || typeof gp.play !== "function") throw new Error("system: fx_player takes the GPU particle system (engine.gpu_particles with the effects loaded)");
        o = o || {};
        const idle = o.idle === undefined ? 3 : o.idle, live = new Map(), pool = Object.create(null), bad = Object.create(null);
        let frame = 0;
        const trails = [];
        const warn = function (name, err) { if (bad[name]) return; bad[name] = 1; if (typeof console !== "undefined") console.warn("system: particles: " + name + ": " + (err && err.message || err)); };      // (said once, and the effect is left alone from then on)
        return {
          live: live, pool: pool, trails: trails,
          play: function (key, name, x, y, z, q, a, scale) {
            if (bad[name]) return;
            try {
              let e = live.get(key);
              if (!e) {
                const pk = name + "@" + scale, list = pool[pk];
                let fx = list && list.length ? list.pop() : null;
                if (!fx) { fx = gp.effect(name, { x: x, y: y, z: z, scale: scale, start: false, trigger: false }); fx.rates = fx.layers.map(function (l) { return l.def.emitter && l.def.emitter.rate > 0 ? l.def.emitter.rate : 0; }); }
                if (!fx.loop) { warn(name, "it is not a loop effect (a loop is `loop`; a burst is `once`)"); return; }
                e = { fx: fx, pool: pk, frame: frame, a: -1 };
                live.set(key, e);
                fx.teleport(x, y, z, q); fx.start();
              } else e.fx.at(x, y, z, q);
              e.frame = frame;
              if (Math.abs(a - e.a) > 0.04) {                                                      // (the rate follows the intensity: a change that can be seen)
                e.a = a;
                for (let i = 0; i < e.fx.layers.length; i++) if (e.fx.rates[i] > 0) e.fx.layers[i].emitter.set({ rate: e.fx.rates[i] * a });
              }
            } catch (err) { warn(name, err); }
          },
          once: function (name, x, y, z, q, scale) {
            if (bad[name]) return;
            try { gp.play(name, x, y, z, scale, q); } catch (err) { warn(name, err); }
          },
          // a TRACER: the loop effect `name` flown from (ax, ay, az) to (bx, by, bz) at `speed` m/s, `age` seconds after it left (an answer that came late: the bullet is already that far); it stops when it gets there and its particles finish by themselves, then the
          // effect goes back to the pool. (runtime.js "TRACERS")
          trail: function (name, ax, ay, az, bx, by, bz, speed, scale, age) {
            if (bad[name]) return;
            try {
              const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
              if (!(len > 1e-3) || !(speed > 0)) return;
              const pk = name + "@" + scale, list = pool[pk];
              let fx = list && list.length ? list.pop() : null;
              if (!fx) fx = gp.effect(name, { x: ax, y: ay, z: az, scale: scale, start: false, trigger: false });
              if (!fx.loop) { warn(name, "a tracer is a loop effect"); return; }
              const ux = dx / len, uy = dy / len, uz = dz / len, w = 1 + uy, q = [0, 0, 0, 1];
              if (w < 1e-6) { q[0] = 1; q[3] = 0; } else { const l = Math.hypot(uz, ux, w) || 1; q[0] = uz / l; q[1] = 0; q[2] = -ux / l; q[3] = w / l; }       // (the turn that takes the effect's up to the way of the shot)
              const t0 = Math.min(Math.max(age || 0, 0) * speed, len);
              fx.teleport(ax + ux * t0, ay + uy * t0, az + uz * t0, q); fx.start();
              trails.push({ fx: fx, pool: pk, a: [ax, ay, az], u: [ux, uy, uz], len: len, speed: speed, d: t0, q: q, over: -1 });
            } catch (err) { warn(name, err); }
          },
          frame: function (dt) {
            for (let i = trails.length - 1; i >= 0; i--) {
              const t = trails[i];
              if (t.over < 0) {
                t.d = Math.min(t.len, t.d + t.speed * (dt > 0 ? Math.min(dt, 0.1) : 1 / 60));
                t.fx.at(t.a[0] + t.u[0] * t.d, t.a[1] + t.u[1] * t.d, t.a[2] + t.u[2] * t.d, t.q);
                if (t.d >= t.len) { t.fx.stop(); t.over = 0; }
              } else {
                t.over += dt > 0 ? dt : 1 / 60;
                if (t.over > 0.4) { (pool[t.pool] || (pool[t.pool] = [])).push(t.fx); trails[i] = trails[trails.length - 1]; trails.pop(); }
              }
            }
            frame++;
            live.forEach(function (e, key) {
              if (frame - e.frame <= idle) return;
              e.fx.stop();
              (pool[e.pool] || (pool[e.pool] = [])).push(e.fx);
              live.delete(key);
            });
          }
        };
      };

      // ========================================================================================================================
      // family_props
      // ========================================================================================================================
// system.js, a part: FAMILY PROPS (SYSTEM.md "Family props"): things that only a creature and its own family know: an axe, a rifle, a bag, a wagon. The creature file's top-level `props` section declares them; each is just a MESH built round ONE imaginary
// bone (an sdf or a mesh; its origin is the holding point) that the family keeps a pool of, drawn in the creature's own render loop with the creature's own texture of rows, and each prop instance has a HOLDER: a bone of one of the family's creature
// instances. A prop is no species and no family: it has no rows, no texture and nothing in the worker. Its instance is three attributes of its draw (`happy_hold`: the holder instance's slot, the holder's bone, the scale; `happy_at`, `happy_rot`: the
// mount, the prop's frame in the bone's bind pose) and the vertex shader reads the holder's bone from the family's texture (species.js holder_shader): the prop is on the bone every frame with nothing written by the page. They are not world entities and not
// physics bodies, and nothing outside the family is told of them. The creature (or its mind) takes one from the pool and gives it back.
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, after runtime.js.
//
//   props: {                                                                  the section (the file's top-level `props`; `body.props` stays what it was: an sdf ISLAND on a bone of the creature's own mesh, for what is always there)
//     axe: { sdf: { cell: 0.006, parts: [ { id: "handle", shape: "capsule", a: [0, -0.15, 0], b: [0, 0.45, 0], radius: 0.02, color: [0.4, 0.26, 0.14, 1] }, ... ] },     the sdf of its body (the mesher's def; a part with no `bone` is on its one bone, "root"),
//            grip: { at: [0, 0, 0], dir: [0, 1, 0], roll: 0, hand: "main" },                                      or `mesh`: plain arrays. Its origin is where the hand holds it and its +y its long axis
//            rest: { bone: "spine", at: [0.15, 0.1, -0.2], dir: [0, 1, 0], roll: 0 },                                where it rides when nobody holds it (the back, the hip)
//            scale: 1, per: 1 } }                                                                                  per: how many an instance may hold of it (1 .. 8): the pool is the family's max_instances x per
//     grip   held by the hand of an arm (`hand`: "main" the right arm, "off" the left): the hand bone of the rig's arm chain; `at` the offset from that bone's head in the creature's frame AT REST (x to its left, y up, z forward), `dir` where the
//            prop's +y points in that frame, `roll` degrees about it. The prop follows the hand bone as the animation moves it
//     rest   the same on any bone
//   system.build_props(x)         the meshes of the props' sdfs, made by the mesher (system.build_sdf(x) does it too: it is for a page that has no other sdf); system.sdf_made(x) says so as well
//   a species with the section makes a drawable of each prop when it is made (`sp.fprops`: { list, by_name, draws: [one a prop], slots }); it is drawn by the family's render loop and is never in the worker
//   sp.prop_take(c, name, where) -> handle | null      where: "grip" (the default of a prop that has one), "off" (the other hand), "rest", or { bone, at, dir, roll, scale }; null when the instance holds as many as `per`
//   sp.prop_attach(h, where)    moves it (the axe from the back to the hand)      sp.prop_release(h)    gives it back to the pool (it is hidden)      sp.prop_held(c, name) -> handle | null      sp.props_of(c) -> [handle]
//   handle: { owner, parent (the instance), name, prop (its species), slot, gen, where, released }. An instance that is released gives back what it holds
//   system.props_frame()          once a call of system.render_all (nothing is done twice for the same entries): the props that FLY are put where they are. A prop on a bone needs nothing (the shader reads the bone), so it is never a frame behind its hand
//   sp.prop_pose(h)             where a prop is in the world now: [x, y, z, scale, qx, qy, qz, qw] (a muzzle, a throw, a particle on it ask: the draw does not; system.fp_pose(sp, h) is the same with no copy)
//   THROWN PROPS (`throw: { speed, gravity, spin, align, radius, life, linger, hit: { impulse, damage } }` in a prop's section): sp.prop_throw(h, { speed, up | dir | at | vel }) lets go of it: it leaves its parent and FLIES (ballistic, on the page: system.props_step(dt), once a
//     frame at the engine's on_frame_begin), the hitscan (system.shoot: the physics world's props, the terrain and the creatures' hit zones) looks a few frames ahead of it, so it lands where it meets something: on the world (it lies there) or on a creature (the
//     `hit` is an impact on its zone: sp.impact), then it LIES `linger` seconds and goes back to the pool. system.on_prop(sp, h, kind, info) (and sp.on_prop): "throw", "land" | "hit" ({ at, speed, target: { sp, c } }), "release"
//   BORN WITH (`start: "rest"` in a prop's section: a place of the prop): every new instance takes one at once, at that place (a holstered pistol, a helmet, a vest: what an officer is born wearing; a shared pool that is empty leaves the instance without it)
//   WEAPONS (`fire: { muzzle: { at, dir }, range, impulse, damage, spread, pellets, rate }`): sp.prop_fire(h, { at: [x, y, z] | dir, paced }) fires a held prop: a hitscan from its muzzle (the prop's frame: `at` the point, `dir` the way, +y by default) toward the point, `pellets` of them within `spread` radians, each
//     an impact `impulse` / `damage` on the first thing it meets (system.shoot: the creatures' hit zones, the world's props, the terrain); at most `rate` times a second by the PAGE'S clock (a trigger pulled too soon is refused; the mind's me.fire is paced by the worker's own time and the page does not
//     pace it again: `paced: false`, or a burst would be refused where the page's frames bunch up); the particle `once: "fire"` mounted on the prop (the muzzle's flash) plays at the shot. system.on_prop: "fire" ({ from, dir, aim, pellets }), then "shot" for each pellet when the worker answers ({ distance, hit, target })
//   THE SHOT LEAVES BY THE BARREL (`fire.aim_tol`, radians, 0.05): prop_fire goes out of the muzzle as it really is, the way it really looks, and only when that is the way asked for within the tolerance (else false, stats.unaimed, the event "unaimed"); `free: true` is the shot toward the point whatever the barrel looks at (a tool's).
//   TAKING AIM (`aim: { butt, hands, up, raise, rate, pocket, palm, muzzle, arc }`; a creature takes aim only at what is IN FRONT of it, `aim.arc`; the section TAKING AIM below, SYSTEM.md "Weapons are real"): sp.prop_aim(h, { at }) brings a weapon up to the shoulder (a creature with arms: both hands on it) and points it, sp.prop_aim_off(h), sp.prop_aimed(h); the mind's me.aim / me.aimed / me.fire; worker message 65530. The weapons of the library (weapons/) come with this: creature_file.js `api.weapon`
//   A RIG (`joint: { parent, name, axis, at, range, rate }` in a prop's section; the section A RIG below, SYSTEM.md "Weapons are real"): a weapon with a SKELETON and no mind: parts (props) that hang from one another by joints, mounted together on any bone of any creature, turned by whoever carries it (sp.prop_turn, sp.prop_aim, the mind's me.turn / me.aim / me.fire); each part's mount is worked out every frame in the bind frame of the carrier's bone.
//   A SHARED POOL (`pool: n` in a prop's section): the family has n of the prop for ALL its instances (a tool shed: 4 axes for 16 villagers) and each instance may have `per` of them out of the pool at once (in a hand, on the back, or thrown and not back yet). A take gives the
//     lowest free of the n and nothing when none is free; a release (or the end of a flight, or the instance that goes) gives it back to everybody. Without `pool`, every instance has `per` props of its own (the pool is max_instances x per). The worker is told how many are free
//     (worker message 65529: a number for each prop, -1 for one that is not shared), so that `me.take` and `me.pool_free` know it at once
//   THE MIND (pure.js): me.take(name, where) / me.put(name, where) / me.release(name) / me.throw(name, speed, up) / me.throw_at(name, x, y, z, speed) / me.holding(name): the worker keeps the count of what the instance holds and says the verb as an event ("prop:take:axe"),
//     the page does it (system.fp_tag) and tells the worker the truth back (worker message 65528: the masks of what is held and of what is busy, with the generation); a prop's `places: { name: { bone, at, dir, roll } }` are more places than grip / off / rest to take it to
      const FP_ROOT_SK = [{ name: "root", parent: null, head: [0, 0, 0], tail: [0, 0.1, 0] }];
      const fp_state = { species: [] };
      const fp_filled = new WeakMap();
      const fp_sc = new Float32Array(3);

      // an sdf of a prop with every part (and island piece) on the prop's one bone; the same object for the same sdf, so that the mesher's cache is found again when the species is made
      function fp_fill(sdf) {
        let o = fp_filled.get(sdf);
        if (o) return o;
        o = JSON.parse(JSON.stringify(sdf));
        ["parts", "meshes"].forEach(function (k) { if (Array.isArray(o[k])) o[k].forEach(function (p) { if (p && typeof p === "object" && p.bone === undefined) p.bone = "root"; }); });
        fp_filled.set(sdf, o);
        return o;
      }
      // the turn that takes +y to dir, then `roll` degrees about dir: [x, y, z, w]
      function fp_quat(dir, roll) {
        const l = Math.hypot(dir[0], dir[1], dir[2]), dx = dir[0] / l, dy = dir[1] / l, dz = dir[2] / l, w = 1 + dy;
        let q = w < 1e-6 ? [1, 0, 0, 0] : (function () { const n = Math.hypot(dz, dx, w); return [dz / n, 0, -dx / n, w / n]; })();
        if (roll) { const h = roll * Math.PI / 360, s = Math.sin(h), c = Math.cos(h), a = [dx * s, dy * s, dz * s, c]; q = [a[3] * q[0] + a[0] * q[3] + a[1] * q[2] - a[2] * q[1], a[3] * q[1] - a[0] * q[2] + a[1] * q[3] + a[2] * q[0], a[3] * q[2] + a[0] * q[1] - a[1] * q[0] + a[2] * q[3], a[3] * q[3] - a[0] * q[0] - a[1] * q[1] - a[2] * q[2]]; }
        return q;
      }
      // where a prop is on a bone: the bind-pose point (the bone's head and `at`) and the turn from the prop's axes to the creature's at rest
      function fp_mount(sk, b, at, dir, roll, where, along) {
        at = at === undefined ? [0, 0, 0] : vec3(at, where + ".at"); dir = dir === undefined ? [0, 1, 0] : vec3(dir, where + ".dir");
        if (along !== undefined && (typeof along !== "number" || !Number.isFinite(along) || Math.abs(along) > 5)) fail(where + ".along is metres along the bone from its head toward its tail (a hand's palm: 0.09)");
        if (along) {                                                                                   // (`along`: the point is that far down the bone's own axis, then `at`: a grip at the palm, whatever the size of the body)
          const l = Math.hypot(sk.tail[b * 3] - sk.head[b * 3], sk.tail[b * 3 + 1] - sk.head[b * 3 + 1], sk.tail[b * 3 + 2] - sk.head[b * 3 + 2]) || 1;
          at = [at[0] + (sk.tail[b * 3] - sk.head[b * 3]) / l * along, at[1] + (sk.tail[b * 3 + 1] - sk.head[b * 3 + 1]) / l * along, at[2] + (sk.tail[b * 3 + 2] - sk.head[b * 3 + 2]) / l * along];
        }
        if (!(Math.hypot(dir[0], dir[1], dir[2]) > 1e-6)) fail(where + ".dir is a direction, not [0, 0, 0]");
        if (roll !== undefined && (typeof roll !== "number" || !Number.isFinite(roll))) fail(where + ".roll is degrees");
        return { bone: b, p: [sk.head[b * 3] + at[0], sk.head[b * 3 + 1] + at[1], sk.head[b * 3 + 2] + at[2]], q: fp_quat(dir, roll || 0), scale: 1 };
      }
      // THE CARRIED GRIP FROM THE HOLD: a weapon with `aim.holds` rides on the hand bone with its main hold in the palm, the same frame the hand takes when the weapon is aimed (the palm on the handle, the fingers' way and the thumb's from the hold), so
      // the carried weapon is in the hand and not on the back of it, and the hand does not jump when the weapon comes up. The hand's own palm is the table of pure.js (from the bind pose). A creature whose hands have no bones to
      // say it keeps the grip's `along / dir / roll`. The hand bone of the grip is the one of the arm that `fp_hand` names; the other hand ("off") takes the hold mirrored
      function fp_grip_from_hold(sk, life, e) {
        const arms = life && life.arms ? life.arms : [];
        if (!arms.length || !e.aim || !e.aim.holds.length || !e.grip) return;
        const bone = function (b) { return typeof b === "number" ? b : sk.index[b]; };
        const tab = FING.build(sk, arms.map(function (a) { return { side: a.side, shoulder: bone(a.shoulder), wrist: bone(a.wrist) }; }));
        if (!tab) return;
        const hold = e.aim.holds.filter(function (h) { return h.hand === "main"; })[0] || e.aim.holds[0];
        const mount = function (hb) {
          let ent = null;
          for (let i = 0; i < tab.length; i++) if (tab[i].hand === hb) ent = tab[i];
          if (!ent || !ent.palm) return null;
          const p = ent.palm, m = hold.side !== 0 && arms[ent.arm].side !== hold.side ? -1 : 1;
          const nx = -hold.from[0] * m, ny = -hold.from[1], nz = -hold.from[2], tx = hold.axis[0] * m, ty = hold.axis[1], tz = hold.axis[2];
          const fx = p.sh * (ny * tz - nz * ty), fy = p.sh * (nz * tx - nx * tz), fz = p.sh * (nx * ty - ny * tx);
          const Fb = [p.f[0], p.n[0], p.th[0], p.f[1], p.n[1], p.th[1], p.f[2], p.n[2], p.th[2]], Fp = [fx, nx, tx, fy, ny, ty, fz, nz, tz], R = new Float64Array(9), q = [0, 0, 0, 1];
          hh_mul_bt(R, Fb, Fp);                                                                            // (the turn that takes the prop's frame to the model's bind frame: the hand's frame times the hold's undone)
          hh_m_q(q, R);
          const off = e.scale * hold.radius + FA_PALM, at = [hold.at[0] * m, hold.at[1], hold.at[2]], fr = [hold.from[0] * m, hold.from[1], hold.from[2]];
          const a = [R[0] * at[0] + R[1] * at[1] + R[2] * at[2], R[3] * at[0] + R[4] * at[1] + R[5] * at[2], R[6] * at[0] + R[7] * at[1] + R[8] * at[2]];
          const f = [R[0] * fr[0] + R[1] * fr[1] + R[2] * fr[2], R[3] * fr[0] + R[4] * fr[1] + R[5] * fr[2], R[6] * fr[0] + R[7] * fr[1] + R[8] * fr[2]];
          return { bone: hb, p: [sk.head[hb * 3] + p.c[0] - e.scale * a[0] - f[0] * off, sk.head[hb * 3 + 1] + p.c[1] - e.scale * a[1] - f[1] * off, sk.head[hb * 3 + 2] + p.c[2] - e.scale * a[2] - f[2] * off], q: q, scale: 1 };
        };
        const g1 = mount(e.grip.bone), g2 = e.grip_off ? mount(e.grip_off.bone) : null;
        if (g1) e.grip = g1;
        if (g2) e.grip_off = g2;
      }
      // the fingers of the hand that carries a weapon close on its main hold (and open when it is put away): the hand of the place the weapon is at ("grip" the main arm, "off" the other)
      function fp_curl_hand(sp, h, closed) {
        const e = h.entry;
        if (!e.aim || !e.aim.holds.length || !sp.life || !sp.life.arms || !sp.life.arms.length) return;
        const rig = fp_aim_rig(sp);
        if (!rig) return;
        const arm = h.where === "grip" ? rig.main : (h.where === "off" ? rig.off : -1);
        if (arm < 0) return;
        const hold = e.aim.holds.filter(function (x) { return x.hand === "main"; })[0] || e.aim.holds[0];
        try { sp.hand_curl(h.parent, arm, closed ? hold.curl : 0, { thumb: hold.thumb, index: hold.index }); } catch (err) { /* a creature with no hand bones: nothing to close */ }
      }
      // the arms of a creature that has no `roles: arms` (the rig lab strips the roles, a host may leave them out): the rig's own chains of two bones or more that end in a hand (a wrist or a hand bone), the side by the x of the upper arm's head
      function fp_rig_arms(sk, rig) {
        const out = [];
        if (!rig || !rig.chains) return out;
        rig.chains.forEach(function (ch, i) {
          const cb = ch.bones || [], tip = ch.tip >= 0 ? ch.tip : cb[cb.length - 1];
          if (cb.length < 2 || tip === undefined || !/(wrist|hand)/i.test(sk.names[tip])) return;
          out.push({ chain: i, name: ch.name, side: sk.head[cb[cb.length - 2] * 3] >= 0 ? 1 : -1, wrist: sk.names[cb[cb.length - 1]] });
        });
        return out;
      }
      // the hand bone of an arm of the creature: "main" the right arm, "off" the left
      function fp_hand(sk, rig, life, hand, where) {
        let arms = life && life.arms ? life.arms : [];
        if (!arms.length) arms = fp_rig_arms(sk, rig);
        if (!arms.length) fail(where + ": a grip needs a creature with arms (roles: arms, or a rig chain that ends in a hand bone)");
        const arm = hand === "off" ? (arms.filter(function (a) { return a.side > 0; })[0] || arms[arms.length - 1]) : (arms.filter(function (a) { return a.side < 0; })[0] || arms[0]);
        const ch = rig && rig.chains ? rig.chains[arm.chain] : null, b = ch && ch.tip >= 0 ? ch.tip : sk.index[arm.wrist];
        if (b === undefined) fail(where + ": the hand of the arm " + arm.name + " is not a bone");
        return b;
      }

      // `throw`: what a prop does when it is thrown. speed (m/s the mind's verb says when it says none), gravity (a share of the earth's 9.81: 0 flies straight), spin ([x, y, z] radians a second about the prop's own axes: an axe tumbles),
      // align (its +y follows its flight: a spear, an arrow; spin y is then its roll), radius (how far its leading point is from its origin: it lands that much short), life (seconds in the air at most), linger (seconds it lies before it goes
      // back to the pool), hit ({ impulse, damage }: what a creature it lands on takes, sp.impact), blast ({ radius, impulse, damage }: an AREA BLAST where it lands: every creature within `radius` metres of the landing (less the radius of its body) takes an impact
      // that falls off with the square of the way to the edge (1 at the landing, 0 at the radius); the creatures that have hit zones take it as an impact (sp.impact: the shock, the zone's health), and whoever listens (system.on_prop kind "blast") is told
      // every creature it reached with the damage that it should take, so that a machine with no hit zones can lose health too), fuse ("aim": a prop thrown AT a point lands, and blasts, where that point is, the moment its flight has got there: a shell, a rocket or
      // a grenade does not go through a creature that has no hit zones and come down behind it; "none", the default: it flies on until it meets something)
      function compile_throw(d, where) {
        if (!d || typeof d !== "object" || Array.isArray(d)) fail(where + " is { speed, gravity, spin, align, radius, life, linger, hit, blast, fuse }");
        only_keys(d, ["speed", "gravity", "spin", "align", "radius", "life", "linger", "hit", "blast", "fuse"], where);
        const num = function (k, dflt, lo, hi) {
          const v = d[k] === undefined ? dflt : d[k];
          if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) fail(where + "." + k + " is a number from " + lo + " to " + hi + " (" + dflt + ")");
          return v;
        };
        if (d.align !== undefined && typeof d.align !== "boolean") fail(where + ".align is true or false");
        const t = { speed: num("speed", 12, 0.1, 200), gravity: num("gravity", 1, 0, 10), radius: num("radius", 0.1, 0, 5), life: num("life", 5, 0.1, 60), linger: num("linger", 3, 0, 600), spin: d.spin === undefined ? [0, 0, 0] : vec3(d.spin, where + ".spin"), align: d.align === true, hit: { impulse: 0, damage: 0 }, blast: null, fuse: "none" };
        if (d.fuse !== undefined) { if (d.fuse !== "aim" && d.fuse !== "none") fail(where + ".fuse is \"aim\" or \"none\""); t.fuse = d.fuse; }
        if (d.blast !== undefined) {
          const b = d.blast;
          if (!b || typeof b !== "object" || Array.isArray(b)) fail(where + ".blast is { radius, impulse, damage }");
          only_keys(b, ["radius", "impulse", "damage"], where + ".blast");
          t.blast = { radius: 4, impulse: 0, damage: 0 };
          ["radius", "impulse", "damage"].forEach(function (k) {
            if (b[k] === undefined) return;
            if (typeof b[k] !== "number" || !Number.isFinite(b[k]) || b[k] < (k === "radius" ? 0.1 : 0) || b[k] > (k === "radius" ? 200 : 1e6)) fail(where + ".blast." + k + " is a number" + (k === "radius" ? " from 0.1 to 200" : ", 0 or more"));
            t.blast[k] = b[k];
          });
        }
        if (d.hit !== undefined) {
          const h = d.hit;
          if (!h || typeof h !== "object" || Array.isArray(h)) fail(where + ".hit is { impulse, damage }");
          only_keys(h, ["impulse", "damage"], where + ".hit");
          ["impulse", "damage"].forEach(function (k) {
            if (h[k] === undefined) return;
            if (typeof h[k] !== "number" || !(h[k] >= 0) || !Number.isFinite(h[k])) fail(where + ".hit." + k + " is a number, 0 or more");
            t.hit[k] = h[k];
          });
        }
        return t;
      }
      // `fire`: what a shot of a prop is. muzzle { at (the point in the prop's frame, required), dir (the way: +y, the prop's long axis, by default) }, range (m, 100), impulse (kg m/s, 3: a pistol's bullet), damage (10), spread (radians, the half angle of the cone a pellet goes in: 0.01), pellets (1: a
      // shotgun's 8), rate (shots a second at most: 5), modes (the selector switch: ["single"], or any of "single" "burst" "auto": sp.prop_mode(h, mode), sp.prop_trigger(h, down) fire as it says, at `rate`), burst (the shots of a burst: 3), velocity (the bullet's speed, m/s:
      // 600: the tracer flies at it), tracer (a visible tracer every that many shots: 0 none)
      function compile_fire(d, where) {
        if (!d || typeof d !== "object" || Array.isArray(d)) fail(where + " is { muzzle: { at, dir }, range, impulse, damage, spread, pellets, rate, aim_tol }");
        only_keys(d, ["muzzle", "range", "impulse", "damage", "spread", "pellets", "rate", "aim_tol", "modes", "burst", "velocity", "tracer", "trail"], where);
        const m = d.muzzle;
        if (!m || typeof m !== "object" || Array.isArray(m) || m.at === undefined) fail(where + ".muzzle is { at: [x, y, z], dir: [x, y, z] } in the prop's own frame (+y its long axis): where the shot leaves it");
        only_keys(m, ["at", "dir"], where + ".muzzle");
        const at = vec3(m.at, where + ".muzzle.at"), dir = m.dir === undefined ? [0, 1, 0] : vec3(m.dir, where + ".muzzle.dir"), dl = Math.hypot(dir[0], dir[1], dir[2]);
        if (!(dl > 1e-6)) fail(where + ".muzzle.dir is a direction, not [0, 0, 0]");
        const num = function (k, dflt, lo, hi) {
          const v = d[k] === undefined ? dflt : d[k];
          if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) fail(where + "." + k + " is a number from " + lo + " to " + hi + " (" + dflt + ")");
          return v;
        };
        const pellets = num("pellets", 1, 1, 32);
        const modes = d.modes === undefined ? ["single"] : d.modes;
        if (!Array.isArray(modes) || !modes.length || modes.length > 3 || !modes.every(function (x, i) { return (x === "single" || x === "burst" || x === "auto") && modes.indexOf(x) === i; })) fail(where + ".modes is a list of \"single\", \"burst\", \"auto\" (each once): what the weapon's selector switch has; the first is the one it starts in");
        const burst = num("burst", 3, 2, 12), tracer = num("tracer", 0, 0, 20);
        if (d.trail !== undefined && (typeof d.trail !== "string" || !/^[a-z][a-z0-9_]*$/.test(d.trail))) fail(where + ".trail is the name of the effect of a tracer (\"tracer\")");
        if (!Number.isInteger(burst) || !Number.isInteger(tracer)) fail(where + ".burst and .tracer are whole numbers (the shots of a burst; a tracer every that many shots, 0 none)");
        if (!Number.isInteger(pellets)) fail(where + ".pellets is a whole number from 1 to 32 (1)");
        return { at: at, dir: [dir[0] / dl, dir[1] / dl, dir[2] / dl], range: num("range", 100, 1, 2000), impulse: num("impulse", 3, 0, 1e4), damage: num("damage", 10, 0, 1e4), spread: num("spread", 0.01, 0, 1), pellets: pellets, rate: num("rate", 5, 0.05, 60), aim_tol: num("aim_tol", 0.05, 0.003, 0.5), modes: modes, burst: burst, velocity: num("velocity", 600, 20, 3000), tracer: tracer, trail: d.trail === undefined ? "tracer" : d.trail };
      }
      // `aim`: how a creature that holds the weapon takes aim (sp.prop_aim; the mind's me.aim and me.fire do it). The weapon comes up to the SHOULDER of the main arm, its `butt` (the point of it that sits against the shoulder, in the prop's frame) in the pocket, and swings about it until the muzzle looks
      // where it is told; the hands go to its `hands` (the point the main hand holds, then the other hand's: a rifle's grip and its handguard; a pistol has one), the `up` of the sights is the prop's own axis (-z). `raise` seconds to come up and to go down, `rate` radians a second that the barrel slews at,
      // `pocket` [in, up, forward]: where the butt sits, from the shoulder joint (in: the share of the way to the middle of the body, up and forward in metres at a size of 1), `palm` how far the palm is from the wrist (metres at size 1), `muzzle` { at, dir } for a weapon with no `fire` section (a launcher)
      // `aim.arc`: where, in FRONT of the creature that holds the weapon, a point may be for the weapon to be taken up at it: degrees from the way the creature faces, `yaw` to each side (80), `up` (70) and `down` (60) from the shoulder. A point outside
      // of it is not aimed at: the weapon stays as it is carried, or is lowered when it was up (the creature has to turn to it first, as the gunner block does). A number is the yaw; `false` is all round (a creature that is its own turret). Only a creature with arms
      // takes aim by hand: a weapon that is mounted on a bone (a turret's gun) is turned by whatever moves its bone and has no arc.
      const FP_ARC = { yaw: 80 * Math.PI / 180, up: 70 * Math.PI / 180, down: 60 * Math.PI / 180 };
      function compile_arc(a, where) {
        if (a === undefined) return { yaw: FP_ARC.yaw, up: FP_ARC.up, down: FP_ARC.down };
        if (a === false) return null;
        const deg = function (v, k, lo, hi) { if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) fail(where + "." + k + " is a number of degrees from " + lo + " to " + hi + " (" + v + ")"); return v * Math.PI / 180; };
        if (typeof a === "number") return { yaw: deg(a, "yaw", 5, 180), up: FP_ARC.up, down: FP_ARC.down };
        if (!a || typeof a !== "object" || Array.isArray(a)) fail(where + " is { yaw, up, down } in degrees, a number (the yaw) or false (all round)");
        only_keys(a, ["yaw", "up", "down"], where);
        return { yaw: a.yaw === undefined ? FP_ARC.yaw : deg(a.yaw, "yaw", 5, 180), up: a.up === undefined ? FP_ARC.up : deg(a.up, "up", 0, 90), down: a.down === undefined ? FP_ARC.down : deg(a.down, "down", 0, 90) };
      }
      function compile_aim(d, where) {
        if (!d || typeof d !== "object" || Array.isArray(d)) fail(where + " is { butt, hands, up, raise, rate, pocket, palm, muzzle, recoil, arc }");
        only_keys(d, ["butt", "hands", "holds", "up", "raise", "rate", "pocket", "palm", "muzzle", "recoil", "arc"], where);
        if (d.holds === undefined && (!Array.isArray(d.hands) || d.hands.length < 1 || d.hands.length > 2)) fail(where + ".hands is [[x, y, z], [x, y, z]]: the point the main hand holds (and the other hand's), in the prop's own frame (or `holds`: where the hands go, each with the way the palm faces)");
        if (d.holds !== undefined && (!Array.isArray(d.holds) || d.holds.length < 1 || d.holds.length > 4)) fail(where + ".holds is a list of one to four holds: { at, axis, from, radius, hand, curl ... }");
        const num = function (k, dflt, lo, hi) {
          const v = d[k] === undefined ? dflt : d[k];
          if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) fail(where + "." + k + " is a number from " + lo + " to " + hi + " (" + dflt + ")");
          return v;
        };
        const up = d.up === undefined ? [0, 0, -1] : vec3(d.up, where + ".up"), ul = Math.hypot(up[0], up[1], up[2]);
        if (!(ul > 1e-6)) fail(where + ".up is a direction, not [0, 0, 0]");
        const pocket = d.pocket === undefined ? [0.45, -0.02, 0.1] : vec3(d.pocket, where + ".pocket");
        let muzzle = null;
        if (d.muzzle !== undefined) {
          const m = d.muzzle;
          if (!m || typeof m !== "object" || Array.isArray(m) || m.at === undefined) fail(where + ".muzzle is { at: [x, y, z], dir: [x, y, z] } in the prop's own frame");
          only_keys(m, ["at", "dir"], where + ".muzzle");
          const dir = m.dir === undefined ? [0, 1, 0] : vec3(m.dir, where + ".muzzle.dir"), dl = Math.hypot(dir[0], dir[1], dir[2]);
          if (!(dl > 1e-6)) fail(where + ".muzzle.dir is a direction, not [0, 0, 0]");
          muzzle = { at: vec3(m.at, where + ".muzzle.at"), dir: [dir[0] / dl, dir[1] / dl, dir[2] / dl] };
        }
        const holds = d.holds !== undefined ? d.holds.map(function (h, i) { return compile_hold(h, i, where + ".holds[" + i + "]"); }) : null;
        const hands = d.hands !== undefined ? d.hands.map(function (h, i) { return vec3(h, where + ".hands[" + i + "]"); }) : holds.slice(0, 2).map(function (h) { return h.at.slice(); });
        // a weapon that only says where its hands go (`hands`: the main hand's point, then the other's) gets the holds of a rifle: the main hand round the pistol grip (the handle through that point, raked a little forward at the top), the other under the handguard
        const hs = holds || hands.map(function (h, i) { return compile_hold(i === 0 ? { at: h, axis: [0, 0.25, -0.97], from: [-1, -0.4, 0], radius: 0.017, hand: "main", trigger: true, kind: "grip" } : { at: [h[0], h[1], h[2] - 0.03], axis: [0, 1, 0], from: [0, 0, 1], radius: 0.03, hand: "off", kind: "handguard" }, i, where + ".hands[" + i + "]"); });
        return { butt: d.butt === undefined ? [0, 0, 0] : vec3(d.butt, where + ".butt"), hands: hands, holds: hs, up: [up[0] / ul, up[1] / ul, up[2] / ul], raise: num("raise", 0.35, 0.05, 5), rate: num("rate", 5, 0.2, 40), pocket: pocket, palm: num("palm", 0.09, 0, 0.5), muzzle: muzzle, recoil: d.recoil === undefined ? null : compile_recoil(d.recoil, where + ".recoil"), arc: compile_arc(d.arc, where + ".arc") };
      }
      // `holds`: where a hand goes on the weapon and how it takes it. `at` is the point on the thing that the fingers go round (the AXIS of the handle, the middle of the handguard), `axis` the way that thing runs, pointing to the THUMB's side
      // (up the handle, toward the muzzle along a handguard), `from` the way from the thing to the hand (out of the handle's right side for the right hand: it is made square to the axis), `radius` how thick the thing is (the palm sits that far
      // and a little more from the axis), `to` the other end of a hold that SLIDES (a handguard: the hand takes the point of the segment at -> to that is nearest its shoulder). `hand`: "main", "off" or "any" (a main hold goes to the main arm, an off hold to the arm
      // on the other side, an "any" to the first arm that is left: a creature with four arms takes up to four holds), `side` the side the hold is made for (-1 the creature's right, +1 its left; left out: the main hand's right, the off hand's left, an "any" is the arm's own): a
      // hand on the other side takes it mirrored. `curl` closes the fingers (0 open .. 1 a fist; left out: by the radius), `thumb` and `index` the thumb's and the index finger's share (`trigger: true`: the index finger lies straight, on the trigger)
      function compile_hold(d, i, where) {
        if (!d || typeof d !== "object" || Array.isArray(d)) fail(where + " is { at, axis, from, radius, hand, curl ... }");
        only_keys(d, ["name", "at", "to", "axis", "from", "radius", "hand", "side", "curl", "thumb", "index", "trigger", "kind"], where);
        const unit = function (v, w) { const l = Math.hypot(v[0], v[1], v[2]); if (!(l > 1e-6)) fail(w + " is a direction, not [0, 0, 0]"); return [v[0] / l, v[1] / l, v[2] / l]; };
        const num = function (k, dflt, lo, hi) {
          const v = d[k] === undefined ? dflt : d[k];
          if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) fail(where + "." + k + " is a number from " + lo + " to " + hi);
          return v;
        };
        const at = vec3(d.at, where + ".at"), to = d.to === undefined ? null : vec3(d.to, where + ".to"), axis = unit(d.axis === undefined ? [0, 1, 0] : vec3(d.axis, where + ".axis"), where + ".axis");
        let from = unit(d.from === undefined ? [0, 0, 1] : vec3(d.from, where + ".from"), where + ".from");
        const dd = from[0] * axis[0] + from[1] * axis[1] + from[2] * axis[2];
        from = unit([from[0] - dd * axis[0], from[1] - dd * axis[1], from[2] - dd * axis[2]], where + ".from (it must not run along the axis)");
        const hand = d.hand === undefined ? (i === 0 ? "main" : "off") : d.hand;
        if (hand !== "main" && hand !== "off" && hand !== "any") fail(where + ".hand is \"main\", \"off\" or \"any\"");
        const side = d.side === undefined ? (hand === "main" ? -1 : (hand === "off" ? 1 : 0)) : d.side;
        if (side !== -1 && side !== 0 && side !== 1) fail(where + ".side is -1 (the creature's right), 1 (its left) or 0 (the arm's own)");
        const radius = num("radius", 0.016, 0, 0.2), trigger = d.trigger === true;
        if (d.trigger !== undefined && typeof d.trigger !== "boolean") fail(where + ".trigger is true or false");
        if (d.kind !== undefined && typeof d.kind !== "string") fail(where + ".kind is a word (grip, foregrip, handguard, forend, stock, handle ...)");
        return { name: d.name === undefined ? "hold" + i : String(d.name), kind: d.kind === undefined ? "grip" : d.kind, at: at, to: to, axis: axis, from: from, radius: radius, hand: hand, side: side,
          curl: num("curl", Math.max(0.35, Math.min(0.85, 0.95 - 8 * radius)), 0, 1), thumb: num("thumb", 1, 0, 1.5), index: num("index", trigger ? 0.3 : 1, 0, 1.5), trigger: trigger };
      }
      // `recoil`: what a shot does to the one who fires it. The weapon kicks BACK along its barrel by `back` metres (at a size of 1) and the muzzle climbs by `climb` radians (about the shoulder: the butt stays in the pocket), both for a moment (they spring back
      // at `rate` radians a second), a little to a side by `side`; the hands, which are on the weapon, go with it, and the trunk takes `shock` of the shot's impulse as a hit that does no damage (a shove back, the spine leans). What is not said comes from the weapon's `fire.impulse`
      function compile_recoil(d, where) {
        if (!d || typeof d !== "object" || Array.isArray(d)) fail(where + " is { back, climb, side, rate, shock, aim }");
        only_keys(d, ["back", "climb", "side", "rate", "shock", "comp"], where);
        const num = function (k, lo, hi) {
          if (d[k] === undefined) return null;
          if (typeof d[k] !== "number" || !Number.isFinite(d[k]) || d[k] < lo || d[k] > hi) fail(where + "." + k + " is a number from " + lo + " to " + hi);
          return d[k];
        };
        return { back: num("back", 0, 0.3), climb: num("climb", 0, 0.5), side: num("side", 0, 0.3), rate: num("rate", 4, 80), shock: num("shock", 0, 10), comp: num("comp", 0, 1) };
      }
      // `joint`: the prop is a PART of a weapon that moves (a RIG: a turret is a base, a head that turns and a gun that nods). Its skeleton is the parts' joints: a part hangs from `parent` (the name of another prop of the section; the root of the rig, with no joint, is mounted by its
      // `rest`), and turns about `axis` through the point `at` (both in the assembly's own frame: the parts of a rig are made in ONE frame, the sdf of each where it is in the whole, and mounted at the same place: every part has the same `rest`) by an angle that is not the
      // part's to say: whoever mounted the weapon turns it (sp.prop_turn, sp.prop_aim, the mind's me.turn and me.aim: SYSTEM.md "Weapons are real"); a weapon has no mind of its own. `name` is what the controller calls the joint ("yaw", "pitch"), `range` the [low, high] of the angle in degrees
      // (the whole turn, [-180, 180], when it is not said), `rate` how fast it turns (radians a second), the angle is positive when the part turns about `axis` by the right-hand rule (about the weapon's up, -z, positive is to the left; about -x positive raises the muzzle)
      function compile_joint(d, where) {
        if (!d || typeof d !== "object" || Array.isArray(d)) fail(where + " is { parent, name, axis, at, range, rate }");
        only_keys(d, ["parent", "name", "axis", "at", "range", "rate"], where);
        if (typeof d.parent !== "string") fail(where + ".parent is the name of the prop that this part hangs from");
        const axis = d.axis === undefined ? [0, 0, -1] : vec3(d.axis, where + ".axis"), al = Math.hypot(axis[0], axis[1], axis[2]);
        if (!(al > 1e-6)) fail(where + ".axis is a direction, not [0, 0, 0]");
        const rg = d.range === undefined ? [-180, 180] : d.range;
        if (!Array.isArray(rg) || rg.length !== 2 || !rg.every(Number.isFinite) || !(rg[0] <= rg[1]) || rg[0] < -360 || rg[1] > 360) fail(where + ".range is [low, high] in degrees, from -360 to 360");
        const rate = d.rate === undefined ? 3 : d.rate;
        if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0.05 || rate > 100) fail(where + ".rate is radians a second, from 0.05 to 100 (3)");
        const nm = d.name === undefined ? "joint" : d.name;
        if (typeof nm !== "string" || !/^[a-z][a-z0-9_]*$/.test(nm)) fail(where + ".name is lower case letters, digits and _ (yaw, pitch)");
        return { parent_name: d.parent, parent: -1, name: nm, axis: [axis[0] / al, axis[1] / al, axis[2] / al], at: d.at === undefined ? [0, 0, 0] : vec3(d.at, where + ".at"), lo: rg[0] * Math.PI / 180, hi: rg[1] * Math.PI / 180, rate: rate, full: rg[1] - rg[0] >= 360 - 1e-9 };
      }
      // the section: checked against the skeleton, the arms and the rig; null for none
      function compile_family_props(input, sk, rig, life) {
        if (input === undefined || input === null) return null;
        if (typeof input !== "object" || Array.isArray(input)) fail("props is { name: { sdf | mesh, grip, rest, places, throw, scale, per } }");
        const names = Object.keys(input);
        if (!names.length) return null;
        if (names.length > 16) fail("props: at most 16 of them (" + names.length + ")");
        const list = [], by_name = Object.create(null);
        names.forEach(function (name) {
          const where = "props." + name, d = input[name];
          if (!/^[a-z][a-z0-9_]*$/.test(name)) fail(where + ": a name is lower case letters, digits and _");
          if (!d || typeof d !== "object" || Array.isArray(d)) fail(where + " is { sdf | mesh, grip, rest, scale, per }");
          only_keys(d, ["sdf", "mesh", "scale", "per", "pool", "grip", "rest", "places", "throw", "fire", "aim", "joint", "start", "material"], where);
          if ((d.sdf === undefined) === (d.mesh === undefined)) fail(where + " has an `sdf` or a `mesh` (one of them): its body");
          if (d.sdf !== undefined && (!d.sdf || typeof d.sdf !== "object" || !Array.isArray(d.sdf.parts) || !d.sdf.parts.length)) fail(where + ".sdf is the mesher's definition: { parts: [...], cell, ... }");
          const scale = d.scale === undefined ? 1 : d.scale, per = d.per === undefined ? 1 : d.per;
          if (typeof scale !== "number" || !(scale > 0 && scale <= 100)) fail(where + ".scale is a number above 0 (1)");
          if (!Number.isInteger(per) || per < 1 || per > 8) fail(where + ".per is a whole number from 1 to 8 (1)");
          if (d.pool !== undefined && (!Number.isInteger(d.pool) || d.pool < 1 || d.pool > 65535)) fail(where + ".pool is a whole number from 1 to 65535: how many of it the whole family has, for all its instances (left out: each instance has `per` of its own)");
          const e = { name: name, sdf: d.sdf !== undefined ? d.sdf : null, sdf_filled: d.sdf !== undefined ? fp_fill(d.sdf) : null, mesh: d.mesh !== undefined ? d.mesh : null, material: d.material || null, scale: scale, per: per, pool: d.pool === undefined ? 0 : d.pool, grip: null, grip_off: null, rest: null, places: {}, throw: null, fire: null, aim: null, joint: null, rest_spec: d.rest === undefined ? null : JSON.stringify(d.rest), muzzle: null, start: null, where_list: [] };
          if (d.grip !== undefined) {
            const g = d.grip;
            if (!g || typeof g !== "object" || Array.isArray(g)) fail(where + ".grip is { at, dir, roll, hand }");
            only_keys(g, ["at", "dir", "roll", "hand", "along"], where + ".grip");
            if (g.hand !== undefined && g.hand !== "main" && g.hand !== "off") fail(where + ".grip.hand is \"main\" or \"off\"");
            e.grip = fp_mount(sk, fp_hand(sk, rig, life, g.hand || "main", where + ".grip"), g.at, g.dir, g.roll, where + ".grip", g.along);
            e.grip_off = fp_mount(sk, fp_hand(sk, rig, life, g.hand === "off" ? "main" : "off", where + ".grip"), g.at, g.dir, g.roll, where + ".grip", g.along);          // (the other hand takes it the same way)
          }
          if (d.rest !== undefined) {
            const r = d.rest;
            if (!r || typeof r !== "object" || Array.isArray(r)) fail(where + ".rest is { bone, at, dir, roll }");
            only_keys(r, ["bone", "at", "dir", "roll", "along"], where + ".rest");
            const b = sk.index[r.bone];
            if (b === undefined) fail(where + ".rest.bone '" + r.bone + "' is not a bone of the skeleton");
            e.rest = fp_mount(sk, b, r.at, r.dir, r.roll, where + ".rest", r.along);
          }
          if (d.places !== undefined) {
            const pl = d.places;
            if (!pl || typeof pl !== "object" || Array.isArray(pl)) fail(where + ".places is { name: { bone, at, dir, roll } }");
            const pn = Object.keys(pl);
            if (pn.length > 12) fail(where + ".places: at most 12 of them");
            pn.forEach(function (n) {
              if (!/^[a-z][a-z0-9_]*$/.test(n) || n === "grip" || n === "off" || n === "rest") fail(where + ".places." + n + ": a name of lower case letters, digits and _ (grip, off and rest are the prop's own)");
              const r = pl[n];
              if (!r || typeof r !== "object" || Array.isArray(r)) fail(where + ".places." + n + " is { bone, at, dir, roll }");
              only_keys(r, ["bone", "at", "dir", "roll", "along"], where + ".places." + n);
              const b = sk.index[r.bone];
              if (b === undefined) fail(where + ".places." + n + ".bone '" + r.bone + "' is not a bone of the skeleton");
              e.places[n] = fp_mount(sk, b, r.at, r.dir, r.roll, where + ".places." + n, r.along);
            });
          }
          if (d.throw !== undefined) e.throw = compile_throw(d.throw, where + ".throw");
          if (d.fire !== undefined) e.fire = compile_fire(d.fire, where + ".fire");
          if (d.joint !== undefined) { e.joint = compile_joint(d.joint, where + ".joint"); if (!e.rest) fail(where + ".joint: a part of a rig is mounted by `rest`, the same place as the rest of the rig"); if (e.grip) fail(where + ": a part of a rig has no grip (it is on its mount)"); }
          if (d.aim !== undefined) e.aim = compile_aim(d.aim, where + ".aim");
          e.muzzle = e.aim && e.aim.muzzle ? e.aim.muzzle : (e.fire ? { at: e.fire.at, dir: e.fire.dir } : null);                     // (where the shot leaves it and the way it looks: what taking aim points)
          if (e.aim && !e.muzzle) fail(where + ".aim needs a muzzle: the `fire` section's, or `aim.muzzle`");
          if (e.aim) { const ql = fp_frame_q(e.muzzle.dir, e.aim.up); e.aim.ql_inv = [-ql[0], -ql[1], -ql[2], ql[3]]; }              // (the turn of the prop's own frame, its muzzle's way and its up, undone: taking aim then puts the world's where they point)
          if (e.aim && e.grip) fp_grip_from_hold(sk, life, e);                                                                         // (the carried weapon has its main hold in the palm)
          e.where_list = (e.grip ? ["grip", "off"] : []).concat(e.rest ? ["rest"] : [], Object.keys(e.places));                       // (the places the mind may name: its number is the place in this list + 1, 0 is the default)
          if (d.start !== undefined) {
            if (typeof d.start !== "string" || e.where_list.indexOf(d.start) < 0) fail(where + ".start is a place of the prop that every new instance takes it to (" + (e.where_list.length ? e.where_list.join(", ") : "it has none: a grip, a rest or places") + ")");
            e.start = d.start;
          }
          by_name[name] = list.length;
          list.push(e);
        });
        list.forEach(function (e, i) {                                                                 // (the rigs: every part hangs from a prop of the section, down to one that is the root; no loop; one place for the whole rig)
          if (!e.joint) return;
          const pi = by_name[e.joint.parent_name], where = "props." + e.name + ".joint";
          if (pi === undefined) fail(where + ".parent '" + e.joint.parent_name + "' is not a prop of the section");
          e.joint.parent = pi;
        });
        list.forEach(function (e) {
          if (!e.joint) return;
          let x = e, n = 0;
          while (x.joint) { x = list[x.joint.parent]; if (++n > 6) fail("props." + e.name + ".joint: a rig of at most 6 parts in a chain (and no part hangs from itself)"); }
          if (x.rest_spec !== e.rest_spec) fail("props." + e.name + ".joint: a part of a rig is mounted at the same `rest` as the root of the rig ('" + x.name + "'): the parts are made in one frame");
        });
        return { list: list, by_name: by_name };
      }

      // the meshes of the props' sdfs (the mesher, asynchronous): system.build_sdf(x) does this after its own; the prop's species def is { name, skeleton: root, sdf }
      function fp_build_item(item) {
        if (!item || typeof item !== "object" || !item.family_props || typeof item.family_props !== "object") return null;
        const ps = [];
        for (const n in item.family_props) { const d = item.family_props[n]; if (d && d.sdf && typeof d.sdf === "object") ps.push(fp_base_build({ name: (item.name || "system") + "_" + n, skeleton: FP_ROOT_SK, sdf: fp_fill(d.sdf) })); }
        return Promise.all(ps);
      }
      const fp_base_build = system.build_sdf, fp_base_made = system.sdf_made;
      system.build_sdf = function (x) {
        return fp_base_build(x).then(function () { return Promise.all((Array.isArray(x) ? x : [x]).map(fp_build_item)); }).then(function () { return x; });
      };
      system.build_props = function (x) { return Promise.all((Array.isArray(x) ? x : [x]).map(fp_build_item)).then(function () { return x; }); };
      system.sdf_made = function (x) {
        if (!fp_base_made(x)) return false;
        const fp = x && typeof x === "object" ? x.family_props : null;
        if (!fp || typeof fp !== "object") return true;
        for (const n in fp) if (fp[n] && fp[n].sdf && !fp_base_made({ name: (x.name || "system") + "_" + n, skeleton: FP_ROOT_SK, sdf: fp_fill(fp[n].sdf) })) return false;
        return true;
      };

      // the species has the section: a species for each prop (made like any other: its mesh is the one the mesher made, or its own arrays), and the slots of the pool: an instance's own `per` slots are slot * per + k
      function fp_setup(sp, comp, max) {
        if (!comp) return null;
        const n = comp.list.length, f = { list: comp.list, by_name: comp.by_name, draws: [], slots: [], pools: [], pool_sent: new Int32Array(comp.list.length).fill(-2), msg_pool: new Array(comp.list.length).fill(-1), att: [], fly: [], jointed: [], aiming: [], trigged: [], aim_sent: new Int32Array(max * n), msg_aim: new Array(1 + n).fill(0), args: new Array(max).fill(null), sync: true, sent: new Uint8Array(max * n * 2), sent_gen: new Uint32Array(max).fill(0xffffffff), msg: new Array(1 + 2 * n).fill(0), starts: [], stats: { thrown: 0, landed: 0, hits: 0, casts: 0, said: 0, released: 0, errors: 0, fired: 0, shots: 0, shot_hits: 0, cooldown: 0, unaimed: 0, aimed: 0 } };
        comp.list.forEach(function (e) {
          if (e.pool > max * e.per) fail("props." + e.name + ".pool " + e.pool + " is more than max_instances x per (" + max * e.per + "): nothing could use the rest");
          const def = { name: sp.name + "_" + e.name, skeleton: FP_ROOT_SK, max_instances: e.pool > 0 ? e.pool : max * e.per };
          if (e.sdf_filled) def.sdf = e.sdf_filled; else def.mesh = e.mesh;
          if (e.material) def.material = e.material;
          const psp = system.species(def, { holder: sp });                                                 // (a drawable of THIS family, not a species: a mesh round one imaginary bone, no rows, no texture; the family draws it in its own render loop on the bones of its instances)
          psp.prop_of = sp; psp.prop_entry = e;
          if (e.throw) fp_hook();
          if (e.start) f.starts.push(f.draws.length);
          f.draws.push(psp); f.slots.push(new Array(max * e.per).fill(null));                      // (f.slots: the places of the instances, slot * per + k; a prop species' own slot is the same place, or one of the shared pool's)
          f.pools.push(e.pool > 0 ? { size: e.pool, free: Array.from({ length: e.pool }, function (_, k) { return e.pool - 1 - k; }) } : null);          // (the free ones, the lowest last: it is the one a take gets)
        });
        fp_state.species.push(sp);
        return f;
      }
      function fp_forget(sp) {
        const k = fp_state.species.indexOf(sp);
        if (k >= 0) fp_state.species.splice(k, 1);
        if (sp.fprops) sp.fprops.draws.forEach(function (p) { if (!p.disposed) p.dispose(); });
      }
      // a prop instance is the page's alone: the worker does not know it (no command is sent), so its slot and its entry in the draw are made here. The draw is COMPACT (the first `pn` entries: happy_hold, happy_at, happy_rot, runtime.js):
      // an entry is added at the end and a released one is taken out by the last entry's moving into its place, both O(1); the entries that changed go to the GPU in one bufferSubData each
      function fp_hold_touch(psp, k) { if (k < psp.hold_lo) psp.hold_lo = k; if (k > psp.hold_hi) psp.hold_hi = k; psp.hold_dirty = true; }
      function fp_spawn(psp, slot) {
        let g = (psp.gen[slot] + 1) & 0xffff;
        if (g === 0) g = 1;
        psp.gen[slot] = g; psp.alive[slot] = 1; psp.live++;
        if (slot + 1 > psp.hw) psp.hw = slot + 1;
        const k = psp.pn++, o = k * 4;
        psp.hold_pos[slot] = k; psp.hold_slot[k] = slot;
        psp.hold[o] = 0; psp.hold[o + 1] = -1; psp.hold[o + 2] = 0; psp.hold[o + 3] = 0;               // (hidden, free, scale 0, until fp_hold_put says where it is)
        psp.at[k * 3] = 0; psp.at[k * 3 + 1] = 0; psp.at[k * 3 + 2] = 0; psp.rot[o] = 0; psp.rot[o + 1] = 0; psp.rot[o + 2] = 0; psp.rot[o + 3] = 1;
        fp_hold_touch(psp, k);
      }
      function fp_release_slot(psp, slot) {
        const k = psp.hold_pos[slot], last = psp.pn - 1;
        if (k >= 0) {
          if (k !== last) {
            const ls = psp.hold_slot[last];
            for (let i = 0; i < 4; i++) { psp.hold[k * 4 + i] = psp.hold[last * 4 + i]; psp.rot[k * 4 + i] = psp.rot[last * 4 + i]; }
            for (let i = 0; i < 3; i++) psp.at[k * 3 + i] = psp.at[last * 3 + i];
            psp.hold_slot[k] = ls; psp.hold_pos[ls] = k;
            fp_hold_touch(psp, k);
          }
          psp.hold_pos[slot] = -1; psp.pn = last;
        }
        psp.alive[slot] = 0; psp.live--;
        while (psp.hw > 0 && !psp.alive[psp.hw - 1]) psp.hw--;
      }
      // what the prop's entry in the draw says now: HELD on a bone of its parent (the parent's slot, the bone, the scale of the mount and the prop; the mount's point and turn: the shader does the rest from the parent's own rows) or FREE (it flies,
      // it lies: bone -1, its world place). Written when it differs from what is there (a held prop is written when it is taken or moved, never again: it follows its bone by itself)
      const fp_hv = new Float32Array(11);
      function fp_hold_put(h) {
        const psp = h.prop, k = psp.hold_pos[h.slot];
        if (k < 0) return;
        const F = h.flight, mt = h.mount, v = fp_hv;
        if (F) { v[0] = h.parent.slot; v[1] = -1; v[2] = F.s; v[3] = 0; v[4] = F.p[0]; v[5] = F.p[1]; v[6] = F.p[2]; v[7] = F.q[0]; v[8] = F.q[1]; v[9] = F.q[2]; v[10] = F.q[3]; }
        else { v[0] = h.parent.slot; v[1] = mt.bone; v[2] = mt.scale * h.entry.scale; v[3] = 0; v[4] = mt.p[0]; v[5] = mt.p[1]; v[6] = mt.p[2]; v[7] = mt.q[0]; v[8] = mt.q[1]; v[9] = mt.q[2]; v[10] = mt.q[3]; }
        const H = psp.hold, A = psp.at, R = psp.rot, o = k * 4, a = k * 3;
        if (H[o] === v[0] && H[o + 1] === v[1] && H[o + 2] === v[2] && A[a] === v[4] && A[a + 1] === v[5] && A[a + 2] === v[6] && R[o] === v[7] && R[o + 1] === v[8] && R[o + 2] === v[9] && R[o + 3] === v[10]) return;
        H[o] = v[0]; H[o + 1] = v[1]; H[o + 2] = v[2]; H[o + 3] = 0;
        A[a] = v[4]; A[a + 1] = v[5]; A[a + 2] = v[6];
        R[o] = v[7]; R[o + 1] = v[8]; R[o + 2] = v[9]; R[o + 3] = v[10];
        fp_hold_touch(psp, k);
      }
      function fp_mount_of(sp, e, where) {
        if (where === undefined || where === null) where = e.grip ? "grip" : (e.rest ? "rest" : null);
        if (where === null) throw new Error("system: prop '" + e.name + "' has neither a grip nor a rest: say where it goes ({ bone, at, dir })");
        if (where === "grip") { if (!e.grip) throw new Error("system: prop '" + e.name + "' has no grip"); return { m: e.grip, label: "grip" }; }
        if (where === "off") { if (!e.grip_off) throw new Error("system: prop '" + e.name + "' has no grip"); return { m: e.grip_off, label: "off" }; }
        if (where === "rest") { if (!e.rest) throw new Error("system: prop '" + e.name + "' has no rest place"); return { m: e.rest, label: "rest" }; }
        if (typeof where === "string" && e.places[where] !== undefined) return { m: e.places[where], label: where };
        if (where && typeof where === "object" && !Array.isArray(where)) {
          only_keys(where, ["bone", "at", "dir", "roll", "scale", "along"], "prop_attach: where");
          const b = sp.sk.index[where.bone];
          if (b === undefined) throw new Error("system: prop_attach: '" + where.bone + "' is not a bone of species '" + sp.name + "'");
          const m = fp_mount(sp.sk, b, where.at, where.dir, where.roll, "prop_attach: where", where.along);
          if (where.scale !== undefined) { if (typeof where.scale !== "number" || !(where.scale > 0)) throw new Error("system: prop_attach: where.scale is a number above 0"); m.scale = where.scale; }
          return { m: m, label: "bone" };
        }
        throw new Error("system: prop_attach: where is \"grip\", \"off\", \"rest\", the name of one of the prop's `places` or { bone, at, dir, roll, scale } (" + JSON.stringify(where) + ")");
      }
      function fp_of(sp, what) { if (!sp.fprops) throw new Error("system: " + what + ": species '" + sp.name + "' has no props (the file's `props` section)"); return sp.fprops; }

      // a call that changes what an instance holds tells the worker the truth (so that the mind's `me.holding` is right): the masks of what is attached and of what is busy (attached or thrown and not back yet), a number each, with the instance's generation
      function fp_sync(sp, slot, gen, force) {
        const f = sp.fprops;
        if (!f.sync || !sp.has_worker) return;
        fp_pool_sync(sp, force);
        const n = f.list.length, a = f.msg;
        let same = force !== true && f.sent_gen[slot] === gen;
        a[0] = gen;
        for (let i = 0; i < n; i++) {
          const per = f.list[i].per;
          let held = 0, busy = 0;
          for (let k = 0; k < per; k++) { const h = f.slots[i][slot * per + k]; if (h) { busy |= 1 << k; if (!h.flight) held |= 1 << k; } }
          a[1 + 2 * i] = held; a[2 + 2 * i] = busy;
          if (f.sent[slot * n * 2 + 2 * i] !== held || f.sent[slot * n * 2 + 2 * i + 1] !== busy) same = false;
        }
        if (same) return;
        f.sent_gen[slot] = gen;
        for (let i = 0; i < n * 2; i++) f.sent[slot * n * 2 + i] = a[1 + i];
        sp.worker_msg.apply(sp, [FP_MSG_SYNC, slot].concat(Array.prototype.slice.call(a, 0, 1 + 2 * n)));
      }
      const FP_MSG_SYNC = 65528, FP_MSG_POOL = 65529;                                                  // (pure.js: AI_BASE + 8, + 9)
      // how many of each SHARED pool are free (-1: the prop is not shared): one message for the family, when a number changed (or `force`)
      function fp_pool_sync(sp, force) {
        const f = sp.fprops;
        if (!sp.has_worker || !f.pools.some(function (p) { return p !== null; })) return;
        let same = force !== true;
        for (let i = 0; i < f.list.length; i++) { const v = f.pools[i] ? f.pools[i].free.length : -1; if (f.pool_sent[i] !== v) same = false; f.msg_pool[i] = v; }
        if (same) return;
        for (let i = 0; i < f.list.length; i++) f.pool_sent[i] = f.msg_pool[i];
        sp.worker_msg.apply(sp, [FP_MSG_POOL, 0].concat(f.msg_pool));
      }
      // what the worker's mind needs to know of the props: their names, how many of each, the places it may name (the number is the place in the list + 1), the speed of a throw
      system.fp_worker_defs = function (f) {
        return f.list.map(function (e) { return { name: e.name, per: e.per, pool: e.pool, where: e.where_list.slice(), can_throw: e.throw !== null, can_fire: e.fire !== null, can_aim: e.muzzle !== null, can_turn: e.joint !== null, fire_gap: e.fire ? 1 / e.fire.rate : 0, speed: e.throw ? e.throw.speed : 0 }; });
      };

      function fp_take_k(sp, c, i, k0, where) {                                                          // k0: the slot of the instance's own that is asked for (-1: the lowest that is free)
        const f = sp.fprops, e = f.list[i], psp = f.draws[i], mt = fp_mount_of(sp, e, where);           // (a mistake in `where` is thrown before a slot is taken)
        let k = k0;
        if (k < 0 || k >= e.per || f.slots[i][c.slot * e.per + k]) { k = 0; while (k < e.per && f.slots[i][c.slot * e.per + k]) k++; }
        if (k === e.per) return null;                                                                  // (it holds as many as it may)
        const place = c.slot * e.per + k, pool = f.pools[i];
        let slot = place;
        if (pool) { if (!pool.free.length) return null; slot = pool.free.pop(); }                      // (a shared pool: the lowest that is free; none: the family has no more of it for now)
        fp_spawn(psp, slot);
        const h = { owner: sp, parent: c, name: e.name, prop: psp, slot: slot, place: place, gen: psp.gen[slot], where: mt.label, mount: mt.m, entry: e, released: false, index: i, k: k, flight: null, jt: null };
        f.slots[i][place] = h; f.att.push(h);
        if (e.joint) { h.jt = { angle: 0, target: 0, mount: { bone: mt.m.bone, p: [0, 0, 0], q: [0, 0, 0, 1], scale: mt.m.scale } }; f.jointed.push(h); }          // (a part of a rig: its angle is the controller's; its mount is worked out from the angles of its chain, system.props_frame)
        fp_hold_put(h);                                                                                // (it is on its bone from this frame: the holder's slot, the bone and the mount go to its entry in the draw)
        fp_curl_hand(sp, h, true);                                                                     // (a hand that takes it closes on it)
        return h;
      }
      SP.prop_take = function (c, name, where) {
        live_instance(this, c, "prop_take");
        const f = fp_of(this, "prop_take"), i = f.by_name[name];
        if (i === undefined) throw new Error("system: prop_take: species '" + this.name + "' has no prop '" + name + "' (" + Object.keys(f.by_name).join(", ") + ")");
        const h = fp_take_k(this, c, i, -1, where);
        if (h) fp_sync(this, c.slot, c.gen);
        return h;
      };
      SP.prop_attach = function (h, where) {
        if (!h || h.owner !== this || h.released) throw new Error("system: prop_attach: not a prop that this species gave and that is still held");
        if (h.flight) throw new Error("system: prop_attach: the prop is thrown (it comes back to the pool by itself)");
        if (h.jt) throw new Error("system: prop_attach: a part of a rig stays where the rig is mounted");
        const mt = fp_mount_of(this, h.entry, where), was = h.where;
        h.where = mt.label;
        if (h.aim) { h.aim.base = mt.m; return h; }                                                   // (it is up at the shoulder: the place it goes back to is the new one, the aim lowers it there)
        h.mount = mt.m;
        fp_hold_put(h);
        if (was !== h.where) { h.where = was; fp_curl_hand(this, h, false); h.where = mt.label; fp_curl_hand(this, h, true); }          // (the hand that had it opens, the hand that takes it closes)
        return h;
      };
      SP.prop_release = function (h, quiet) {
        if (!h || h.owner !== this) throw new Error("system: prop_release: not a prop of species '" + this.name + "'");
        if (h.released) return false;
        const f = this.fprops;
        if (h.aim) fp_aim_end(this, h, true);
        if (h.jt) { const jl = f.jointed.indexOf(h); if (jl >= 0) { f.jointed[jl] = f.jointed[f.jointed.length - 1]; f.jointed.pop(); } h.jt = null; }                                                          // (the hands let go of it)
        let k = f.att.indexOf(h);
        if (k >= 0) { f.att[k] = f.att[f.att.length - 1]; f.att.pop(); }
        k = f.fly.indexOf(h);
        if (k >= 0) { f.fly[k] = f.fly[f.fly.length - 1]; f.fly.pop(); }
        if (quiet !== true && !h.flight) fp_curl_hand(this, h, false);                                // (the hand that held it opens)
        f.slots[h.index][h.place] = null;
        fp_release_slot(h.prop, h.slot);
        const pool = f.pools[h.index];
        if (pool) { pool.free.push(h.slot); pool.free.sort(function (a, b) { return b - a; }); }           // (back to everybody's pool)
        h.released = true; h.flight = null;
        if (quiet !== true) { fp_sync(this, h.parent.slot, h.parent.gen); fp_event(this, h, "release", null); }
        return true;
      };
      SP.prop_held = function (c, name) {
        live_instance(this, c, "prop_held");
        const f = fp_of(this, "prop_held"), i = f.by_name[name];
        if (i === undefined) return null;
        const per = f.list[i].per;
        for (let k = 0; k < per; k++) { const h = f.slots[i][c.slot * per + k]; if (h) return h; }
        return null;
      };
      SP.props_of = function (c) {
        live_instance(this, c, "props_of");
        const f = fp_of(this, "props_of"), out = [];
        f.list.forEach(function (e, i) { for (let k = 0; k < e.per; k++) { const h = f.slots[i][c.slot * e.per + k]; if (h) out.push(h); } });
        return out;
      };
      // an instance that goes gives back what it holds (and what it threw that has not come back)
      function fp_release_all(sp, c) {
        const f = sp.fprops;
        for (let i = 0; i < f.list.length; i++) for (let k = 0; k < f.list[i].per; k++) { const h = f.slots[i][c.slot * f.list[i].per + k]; if (h) sp.prop_release(h, true); }
        if (f.sent_gen) f.sent_gen[c.slot] = 0xffffffff;
        for (let i = 0; i < f.list.length; i++) f.aim_sent[c.slot * f.list.length + i] = 0;
        fp_pool_sync(sp);                                                                              // (what it gave back is free for the others)
      }

      // ---- what happens to a prop, for whoever listens: system.on_prop(sp, h, kind, info) and sp.on_prop(h, kind, info)
      system.on_prop = null;
      function fp_event(sp, h, kind, info) {
        const f = sp.fprops;
        if (kind === "release") f.stats.released++;
        try {
          if (typeof sp.on_prop === "function") sp.on_prop(h, kind, info);
          if (typeof system.on_prop === "function") system.on_prop(sp, h, kind, info);
        } catch (err) { if (typeof console !== "undefined") console.warn("system: on_prop: " + (err && err.message || err)); }
      }

      // ---- the mind's verbs, as the worker says them (the events "prop:take:axe", "prop:put:axe", "prop:rel:axe", "prop:thr:axe" and the numbers "prop:arg" that go before a throw): runtime.js hands them over
      const fp_tag_cache = Object.create(null);
      function fp_tag_parse(tag) {
        let r = fp_tag_cache[tag];
        if (r !== undefined) return r;
        r = null;
        if (typeof tag === "string" && tag.charCodeAt(0) === 112 && tag.indexOf("prop:") === 0) { const a = tag.indexOf(":", 5); r = a > 0 ? { verb: tag.slice(5, a), name: tag.slice(a + 1) } : { verb: tag.slice(5), name: "" }; }
        fp_tag_cache[tag] = r;
        return r;
      }
      const fp_warned = Object.create(null);
      function fp_warn(sp, text) { const k = sp.name + ": " + text; if (fp_warned[k]) return; fp_warned[k] = 1; if (typeof console !== "undefined") console.warn("system: props: " + k); }
      system.fp_tag = function (sp, slot, gen, tag, value) {
        const f = sp.fprops;
        if (!f) return;
        const p = fp_tag_parse(tag);
        if (p === null) return;
        if (!(slot < sp.max_instances) || !sp.alive[slot] || sp.gen[slot] !== (gen & 0xffff)) return;
        if (p.verb === "arg") { (f.args[slot] || (f.args[slot] = [])).push(value); return; }
        const args = f.args[slot] || null;
        f.args[slot] = null;
        const i = f.by_name[p.name];
        if (i === undefined) { fp_warn(sp, "the mind said '" + tag + "': no such prop"); return; }
        const e = f.list[i], c = { species: sp, slot: slot, gen: sp.gen[slot] }, v = value | 0;
        const place = function (w) {                                                                   // (the number the worker said: 0 the default, else a place of the prop's list)
          if (w === 0) return undefined;
          if (e.where_list[w - 1] === undefined) throw new Error("the prop '" + e.name + "' has no place number " + w + " (" + e.where_list.join(", ") + ")");
          return e.where_list[w - 1];
        };
        f.stats.said++;
        try {
          if (p.verb === "take") {
            const w = v & 15, k = (v >> 4) & 15;
            fp_take_k(sp, c, i, k, place(w));
          } else if (p.verb === "put") {
            const w = v & 15, k = (v >> 4) & 15, h = f.slots[i][slot * e.per + k];
            if (h && !h.flight) sp.prop_attach(h, place(w));
          } else if (p.verb === "rel") {
            const h = f.slots[i][slot * e.per + (v & 15)];
            if (h && !h.flight) sp.prop_release(h);
          } else if (p.verb === "thr") {
            const k = v & 15, mode = (v >> 4) & 15, h = f.slots[i][slot * e.per + k];
            if (h && !h.flight) {
              if (mode === 0 && args && args.length === 2) sp.prop_throw(h, { speed: args[0], up: args[1] });
              else if (mode === 1 && args && args.length === 4) sp.prop_throw(h, { at: [args[0], args[1], args[2]], speed: args[3] });
              else fp_warn(sp, "a throw of the mind with " + (args ? args.length : 0) + " numbers");
            }
          } else if (p.verb === "aim") {
            const k = v & 15, h = f.slots[i][slot * e.per + k];
            if (h && !h.flight) { if (args && args.length === 3) sp.prop_aim(h, { at: [args[0], args[1], args[2]] }); else fp_warn(sp, "an aim of the mind with " + (args ? args.length : 0) + " numbers"); }
          } else if (p.verb === "trn") {
            const h = f.slots[i][slot * e.per + (v & 15)];
            if (h && !h.flight) { if (args && args.length === 2) sp.prop_turn(h, { yaw: args[0], pitch: args[1] }); else fp_warn(sp, "a turn of the mind with " + (args ? args.length : 0) + " numbers"); }
          } else if (p.verb === "fif") {
            const h = f.slots[i][slot * e.per + (v & 15)];
            if (h && !h.flight) sp.prop_fire(h, { forward: true, paced: false });
          } else if (p.verb === "aof") {
            const h = f.slots[i][slot * e.per + (v & 15)];
            if (h && !h.flight) sp.prop_aim_off(h);
          } else if (p.verb === "fir") {
            const k = v & 15, h = f.slots[i][slot * e.per + k];
            if (h && !h.flight) { if (args && args.length === 3) sp.prop_fire(h, { at: [args[0], args[1], args[2]], paced: false }); else fp_warn(sp, "a shot of the mind with " + (args ? args.length : 0) + " numbers"); }
          } else fp_warn(sp, "the mind said '" + tag + "': no such verb");
        } catch (err) { f.stats.errors++; fp_warn(sp, "'" + tag + "': " + (err && err.message || err)); }
        fp_sync(sp, slot, c.gen, true);                                                                // (the worker counted by itself: what is the case is told back, even when it is what was told last: the worker may be ahead)
      };

      // ---- the attached prop's root row from its parent's bone row: v' = rot(bone, v) * s + t takes a bind-pose point to the model's space, the root's row takes it to the world. Into fp_row
      const fp_a = new Float32Array(3), fp_row = new Float32Array(8);                                  // (fp_row: the numbers as the row holds them, 32 bits: a row is compared with those, or it would always look changed)
      function fp_attached_row(sp, h) { fp_mount_row(sp, h.parent.slot, h.mount, h.entry.scale); }
      // the same for a mount ({ bone, p, q, scale }) of an instance's slot, and a prop's own scale: the world place of what is on that bone (into fp_row)
      function fp_mount_row(sp, slot, mt, escale) {
        const m = sp.mirror, base = sp.root_rows * W * 4, nb = sp.bone_count * 8, r = slot * 8;
        let x = 0, y = 0, z = 0, s = 0, qx = 0, qy = 0, qz = 0, qw = 1;
        if (slot >= 0 && sp.alive[slot] && m[r + 3] > 0) {                                           // (a parent that is not drawn, out of sight, hides its props)
          const o = base + slot * nb + mt.bone * 8, bs = m[o + 3], bx = m[o + 4], by = m[o + 5], bz = m[o + 6], bw = m[o + 7], rx = m[r + 4], ry = m[r + 5], rz = m[r + 6], rw = m[r + 7], rs = m[r + 3];
          fx_rot(bx, by, bz, bw, mt.p[0], mt.p[1], mt.p[2], fp_a);
          fx_rot(rx, ry, rz, rw, fp_a[0] * bs + m[o], fp_a[1] * bs + m[o + 1], fp_a[2] * bs + m[o + 2], fp_a);
          x = m[r] + fp_a[0] * rs; y = m[r + 1] + fp_a[1] * rs; z = m[r + 2] + fp_a[2] * rs;
          const q = mt.q, mx = bw * q[0] + bx * q[3] + by * q[2] - bz * q[1], my = bw * q[1] - bx * q[2] + by * q[3] + bz * q[0], mz = bw * q[2] + bx * q[1] - by * q[0] + bz * q[3], mw = bw * q[3] - bx * q[0] - by * q[1] - bz * q[2];
          qx = rw * mx + rx * mw + ry * mz - rz * my; qy = rw * my - rx * mz + ry * mw + rz * mx; qz = rw * mz + rx * my - ry * mx + rz * mw; qw = rw * mw - rx * mx - ry * my - rz * mz;
          s = rs * bs * mt.scale * escale;
        }
        fp_row[0] = x; fp_row[1] = y; fp_row[2] = z; fp_row[3] = s; fp_row[4] = qx; fp_row[5] = qy; fp_row[6] = qz; fp_row[7] = qw;
      }
      // where the prop is in the world now, into fp_row (place, scale, turn): on demand, for what needs it (a muzzle, the start of a throw, a particle on the prop: the draw itself does not). A flying one is where its flight says
      function fp_pose(sp, h) {
        const F = h.flight;
        if (!F) { fp_attached_row(sp, h); return fp_row; }
        fp_row[0] = F.p[0]; fp_row[1] = F.p[1]; fp_row[2] = F.p[2]; fp_row[3] = F.s; fp_row[4] = F.q[0]; fp_row[5] = F.q[1]; fp_row[6] = F.q[2]; fp_row[7] = F.q[3];
        return fp_row;
      }
      system.fp_pose = fp_pose;
      SP.prop_pose = function (h) {                                                                          // the prop's place now, a copy: [x, y, z, scale, qx, qy, qz, qw]
        if (!h || h.owner !== this || h.released) throw new Error("system: prop_pose: not a prop that this species gave and that is still held");
        return Array.prototype.slice.call(fp_pose(this, h));
      };
      // once a call of system.render_all (nothing is done twice for the same entries): the props that FLY are put where they are. A prop on a bone needs nothing: its entry says the holder and the bone, the shader reads the bone's row (species.js holder_shader)
      system.props_frame = function () {
        const sl = fp_state.species;
        for (let k = 0; k < sl.length; k++) {
          const sp = sl[k], f = sp.fprops;
          if (sp.disposed) continue;
          for (let a = 0; a < f.fly.length; a++) fp_hold_put(f.fly[a]);
        }
        fp_trigger_frame(system.props_clock());                                                          // (the triggers that are held: the shots that are due, at the weapon's rate)
        fp_joint_frame();                                                                              // (the rigs: the joints turn toward what they are told, the parts' mounts follow)
        fp_aim_frame();                                                                                // (the weapons that are aimed: their mounts, their hands)
      };

      // ---- BORN WITH: what a new instance takes at once (the file's `start`), from spawn
      function fp_start(sp, c) {
        const f = sp.fprops;
        let any = false;
        for (let n = 0; n < f.starts.length; n++) { const i = f.starts[n]; if (fp_take_k(sp, c, i, -1, f.list[i].start)) any = true; }
        if (any) fp_sync(sp, c.slot, c.gen);
      }
      // ---- WEAPONS: sp.prop_fire(h, { at | dir }). system.props_clock() is the page's time in seconds (a test puts its own), system.props_fire_cast(sp, c, from, dir, range, impulse, damage, answer) the hitscan (a test puts its own)
      system.props_clock = function () { return (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000; };
      system.props_fire_cast = function (sp, c, from, dir, range, impulse, damage, answer) { system.shoot({ from: from, dir: dir, range: range, impulse: impulse, damage: damage, shooter: { sp: sp, c: c } }, answer); };
      const fp_rng = { s: 2463534242 };
      function fp_rand() { let x = fp_rng.s; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; fp_rng.s = x >>> 0; return fp_rng.s / 4294967296; }
      SP.prop_fire = function (h, o) {
        if (!h || h.owner !== this || h.released) throw new Error("system: prop_fire: not a prop that this species gave and that is still held");
        const e = h.entry, F = e.fire, f = this.fprops;
        if (!F) throw new Error("system: prop_fire: prop '" + e.name + "' has no `fire` section (the muzzle, the damage, the rate ...)");
        if (h.flight) return false;
        o = o === undefined || o === null ? {} : o;
        if (typeof o !== "object") throw new Error("system: prop_fire takes { at: [x, y, z] } or { dir: [x, y, z] }");
        only_keys(o, ["at", "dir", "paced", "free", "forward"], "prop_fire");
        if (o.forward !== true && (o.at === undefined) === (o.dir === undefined)) throw new Error("system: prop_fire takes { at: [x, y, z] } or { dir: [x, y, z] } (one of them), or { forward: true } (the way the barrel looks)");
        const target = o.forward !== true && o.at !== undefined ? vec3(o.at, "prop_fire: at") : null, way = o.forward !== true && o.dir !== undefined ? vec3(o.dir, "prop_fire: dir") : null;
        const now = system.props_clock();
        if (o.paced !== false && h.fired_at !== undefined && now - h.fired_at < 1 / F.rate - 1e-9) { f.stats.cooldown++; return false; }          // (the trigger is pulled too soon by the page's clock; the mind's shots are paced by the worker's own time: `paced: false`)
        if (h.aim && h.aim.rig) { try { fp_aim_step(this, h, 0, system.props_clock()); } catch (err) { f.stats.errors++; fp_warn(this, "its aim: " + (err && err.message || err)); } }          // (an aimed weapon is posed again from the rows that the worker sent LAST, with no time passing: it is on the torso's bone, and a torso that has turned since the page's last frame would turn the barrel with it: the shot leaves by the barrel as it is drawn NOW)
        fp_attached_row(this, h);
        if (!(fp_row[3] > 0)) return false;                                                            // (not drawn: its parent is out of sight)
        const s = fp_row[3], qx = fp_row[4], qy = fp_row[5], qz = fp_row[6], qw = fp_row[7], m = new Float32Array(3), b = new Float32Array(3);
        fx_rot(qx, qy, qz, qw, F.at[0], F.at[1], F.at[2], m);
        const from = [fp_row[0] + m[0] * s, fp_row[1] + m[1] * s, fp_row[2] + m[2] * s];
        fx_rot(qx, qy, qz, qw, F.dir[0], F.dir[1], F.dir[2], b);
        let ax, ay, az;
        if (o.forward === true) { ax = b[0]; ay = b[1]; az = b[2]; }                                  // (forward: it fires where it looks, whatever that is: nothing to be aimed at)
        else if (target) { ax = target[0] - from[0]; ay = target[1] - from[1]; az = target[2] - from[2]; } else { ax = way[0]; ay = way[1]; az = way[2]; }
        const al = Math.hypot(ax, ay, az);
        if (!(al > 1e-6)) throw new Error("system: prop_fire: the target is at the muzzle (or dir is [0, 0, 0])");
        ax /= al; ay /= al; az /= al;
        if (o.free !== true) {                                                                         // (THE SHOT LEAVES BY THE BARREL: it goes the way the muzzle really looks, from where it really is, and only when that is the way asked for within the weapon's `aim_tol`: nothing is fired out of a weapon that points elsewhere)
          const bl = Math.hypot(b[0], b[1], b[2]) || 1, bx = b[0] / bl, by = b[1] / bl, bz = b[2] / bl, err = Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz)));
          if (err > F.aim_tol) { f.stats.unaimed++; fp_event(this, h, "unaimed", { error: err, aim: [ax, ay, az], dir: [bx, by, bz] }); return false; }
          ax = bx; ay = by; az = bz;
        }
        // two directions across the aim, for the cone
        let ux = -az, uy = 0, uz = ax;                                                                   // aim x [0, 1, 0]: across it, in the horizontal
        if (Math.hypot(ux, uy, uz) < 1e-6) { ux = 1; uy = 0; uz = 0; }
        const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
        const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
        const sp_ = this;
        for (let n = 0; n < F.pellets; n++) {
          let dx = ax, dy = ay, dz = az;
          if (F.spread > 0) {
            const th = F.spread * Math.sqrt(fp_rand()), ph = 2 * Math.PI * fp_rand(), ct = Math.cos(th), st = Math.sin(th), cu = Math.cos(ph) * st, cv = Math.sin(ph) * st;
            dx = ax * ct + ux * cu + vx * cv; dy = ay * ct + uy * cu + vy * cv; dz = az * ct + uz * cu + vz * cv;
          }
          f.stats.shots++;
          try {
            const trace = n === 0 && F.tracer > 0 && f.stats.fired % F.tracer === 0, born = now;
            system.props_fire_cast(this, h.parent, from, [dx, dy, dz], F.range, F.impulse, F.damage, function (shot) {
              if (shot.hit) f.stats.shot_hits++;
              if (trace) fp_tracer(sp_, h, from, dx, dy, dz, shot.hit ? shot.distance : Math.min(F.range, 400), system.props_clock() - born);
              fp_event(sp_, h, "shot", { distance: shot.distance, hit: !!shot.hit, target: shot.hit && shot.sp ? { sp: shot.sp, c: { species: shot.sp, slot: shot.slot, gen: shot.gen } } : null });
            });
          } catch (err) { f.stats.errors++; fp_warn(this, "its shot: " + (err && err.message || err)); }
        }
        h.fired_at = now; f.stats.fired++;
        fp_recoil_kick(this, h);                                                                       // (the weapon kicks back, the muzzle climbs: the shot has left already, by the barrel as it was)
        system.fx_fire(this, h.parent.slot, 4, 1, undefined, h.name, h);                                  // (the muzzle's flash)
        fp_event(this, h, "fire", { from: from, dir: [b[0], b[1], b[2]], aim: [ax, ay, az], pellets: F.pellets });
        return true;
      };

      // ---- TRACERS: a shot with a visible bullet. The shot is a hitscan (it has landed when the worker answers); the player of the particle system (system.use_particles) is asked to fly a `trail` effect from the muzzle to where the shot ended, at the bullet's
      // speed as the eye takes it (never more than 350 m/s: a bullet at 900 m/s would be a line from the barrel to the wall in one frame), and for as long as the answer was late (`age`) it is already on its way. A player that has no `trail` plays nothing.
      function fp_tracer(sp, h, from, dx, dy, dz, dist, age) {
        const P = fx_state.player, F = h.entry.fire;
        if (!P || typeof P.trail !== "function" || !fx_state.on || !(dist > 0.3)) return;
        const l = Math.hypot(dx, dy, dz) || 1;
        try { P.trail(F.trail, from[0], from[1], from[2], from[0] + dx / l * dist, from[1] + dy / l * dist, from[2] + dz / l * dist, Math.min(350, Math.max(120, F.velocity * 0.5)), h.entry.scale, age > 0 ? age : 0); } catch (err) { fp_warn(sp, "its tracer: " + (err && err.message || err)); }
      }
      // ---- THE SELECTOR AND THE TRIGGER: a weapon with `fire.modes` has a selector switch (sp.prop_mode) and a trigger (sp.prop_trigger): the page fires it at the weapon's own rate as the mode says (single: one shot to a pull of the trigger; burst: `fire.burst` shots
      // to a pull, whatever the finger does after it; auto: shots for as long as the trigger is held), from system.props_frame; a shot is only taken when the weapon is aimed (a weapon that has no aim of its own, a turret's, fires as it points)
      SP.prop_mode = function (h, mode) {
        if (!h || h.owner !== this || h.released) throw new Error("system: prop_mode: not a prop that this species gave and that is still held");
        const F = h.entry.fire;
        if (!F) throw new Error("system: prop_mode: prop '" + h.entry.name + "' has no `fire` section");
        if (mode === undefined) return h.mode || F.modes[0];
        if (F.modes.indexOf(mode) < 0) throw new Error("system: prop_mode: '" + h.entry.name + "' has no '" + mode + "' (" + F.modes.join(", ") + ")");
        h.mode = mode;
        return mode;
      };
      SP.prop_trigger = function (h, down, o) {
        if (!h || h.owner !== this || h.released) throw new Error("system: prop_trigger: not a prop that this species gave and that is still held");
        if (!h.entry.fire) throw new Error("system: prop_trigger: prop '" + h.entry.name + "' has no `fire` section");
        if (typeof down !== "boolean") throw new Error("system: prop_trigger(h, down, { at }): down is true (pulled) or false (let go)");
        if (o !== undefined && (o === null || typeof o !== "object")) throw new Error("system: prop_trigger takes { at: [x, y, z] } or nothing");
        if (o) only_keys(o, ["at"], "prop_trigger");
        let T = h.trig;
        if (!T) { T = h.trig = { down: false, latch: false, left: 0, next: 0, at: null, shots: 0 }; this.fprops.trigged.push(h); }
        if (o && o.at !== undefined) T.at = vec3(o.at, "prop_trigger: at").slice();
        if (down && !T.down) { T.latch = false; T.shots = 0; }
        T.down = down;
        return true;
      };
      function fp_trigger_frame(now) {
        const sl = fp_state.species;
        for (let k = 0; k < sl.length; k++) {
          const sp = sl[k], f = sp.fprops;
          if (sp.disposed || !f.trigged.length) continue;
          for (let a = f.trigged.length - 1; a >= 0; a--) {
            const h = f.trigged[a], T = h.trig;
            if (h.released || h.flight) { h.trig = null; f.trigged[a] = f.trigged[f.trigged.length - 1]; f.trigged.pop(); continue; }
            if (!T.down && T.left <= 0) { if (!T.latch) { h.trig = null; f.trigged[a] = f.trigged[f.trigged.length - 1]; f.trigged.pop(); } continue; }
            const F = h.entry.fire, mode = h.mode || F.modes[0], gap = 1 / F.rate, A = h.aim;
            if (T.down && !T.latch && mode !== "auto") { T.latch = true; if (mode === "burst") T.left = F.burst; else T.left = 1; }
            if (T.down && mode === "auto") T.left = 1e9;
            if (now - T.next > 0.25) T.next = now - gap;                                                 // (a page that stood still does not fire the shots it owes in one frame)
            for (let n = 0; n < 3 && T.left > 0 && now >= T.next + gap - 1e-9; n++) {
              if (A && A.rig && !A.ok) break;                                                           // (waiting to be aimed: nothing is fired out of a weapon that points elsewhere)
              const at = T.at || (A ? A.at : null);
              let ok = false;
              try { ok = at ? sp.prop_fire(h, { at: at, paced: false }) : sp.prop_fire(h, { forward: true, paced: false }); } catch (err) { f.stats.errors++; fp_warn(sp, "its trigger: " + (err && err.message || err)); T.left = 0; break; }
              if (!ok) break;
              T.shots++; T.next = Math.max(T.next + gap, now - gap); if (T.left < 1e8) T.left--;
            }
            if (!T.down && T.left <= 0) T.latch = false;
          }
        }
      }
      // ---- TAKING AIM ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
      // A weapon is aimed by its own body: sp.prop_aim(h, { at: [x, y, z] }) (the mind says it with me.aim, and me.fire says it too) puts the muzzle on a point, and sp.prop_aimed(h) is true when it is there (within `fire.aim_tol`). A creature with ARMS (`aim` in the prop's section, roles: arms) brings the weapon up to
      // its shoulder, both hands on it, and swings the barrel at `aim.rate` radians a second; a weapon that is mounted on a bone (a turret's gun, a machine on a drone) is only measured: whatever moves its bone is the creature's own business. The shot (prop_fire) leaves by the barrel as it really looks, and only when it is
      // aimed. Every frame (system.props_frame) each weapon that is aimed at something does this, from the rows of the bones that the worker last sent: the weapon's world place is blended (by the weight s: 0 where it is carried, 1 at the shoulder) from its normal place to the aim pose, put on the TORSO bone as a mount that is
      // worked out from that world place (the shader then draws it with the torso's own rows: it is never a frame behind the body), and each hand is told (sp.hand_world, the world reach, the weight the same) the place of the weapon's hand point, less the palm's length along the barrel. A weapon that is not told where to aim for FP_AIM_HOLD
      // seconds is lowered. The creature's mind learns the truth (worker message 65530: a mask of the aimed places of each prop, with the generation) when it changes.
      const FP_AIM_HOLD = 0.9, FP_MSG_AIM = 65530;                                                     // (pure.js: AI_BASE + 10)
      const FA_O = new Float64Array(3), FA_QC = new Float64Array(4), FA_A = new Float64Array(4), FA_B = new Float64Array(4), FA_V = new Float64Array(3), FA_W = new Float64Array(3), FA_QA = new Float64Array(4), FA_QN = new Float64Array(4), FA_Q = new Float64Array(4);
      const FA_AX = new Float64Array(3), FA_QK = new Float64Array(4), FA_QY = new Float64Array(4);
      const FA_P = new Float64Array(3), FA_PN = new Float64Array(3), FA_PW = new Float64Array(3), FA_D = new Float64Array(3), FA_T = new Float64Array(3), FA_HO = { x: 0, y: 0, z: 0, w: 1, lean: false, crouch: false };
      function fa_mul(o, a, b) {
        const ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
        o[0] = aw * bx + ax * bw + ay * bz - az * by; o[1] = aw * by - ax * bz + ay * bw + az * bx; o[2] = aw * bz + ax * by - ay * bx + az * bw; o[3] = aw * bw - ax * bx - ay * by - az * bz;
      }
      function fa_rot(o, q, x, y, z) {                                                                 // q turns (x, y, z) into o
        const qx = q[0], qy = q[1], qz = q[2], qw = q[3], cx = qy * z - qz * y + qw * x, cy = qz * x - qx * z + qw * y, cz = qx * y - qy * x + qw * z;
        o[0] = x + 2 * (qy * cz - qz * cy); o[1] = y + 2 * (qz * cx - qx * cz); o[2] = z + 2 * (qx * cy - qy * cx);
      }
      function fa_conj(o, q) { o[0] = -q[0]; o[1] = -q[1]; o[2] = -q[2]; o[3] = q[3]; }
      // the turn that takes the frame of a weapon (y its way, z its down = -up, x = y cross z) to the world's own axes: the way and the up need not be unit, and the up is made square to the way (a way straight up has no up: the x axis is taken)
      function fa_frame_q(o, fx, fy, fz, ux, uy, uz) {
        let l = Math.hypot(fx, fy, fz) || 1;
        fx /= l; fy /= l; fz /= l;
        const d = ux * fx + uy * fy + uz * fz;
        ux -= d * fx; uy -= d * fy; uz -= d * fz; l = Math.hypot(ux, uy, uz);
        if (l < 1e-6) { ux = Math.abs(fx) < 0.9 ? 1 : 0; uy = 0; uz = Math.abs(fx) < 0.9 ? 0 : 1; const e = ux * fx + uy * fy + uz * fz; ux -= e * fx; uy -= e * fy; uz -= e * fz; l = Math.hypot(ux, uy, uz); }
        ux /= l; uy /= l; uz /= l;
        const zx = -ux, zy = -uy, zz = -uz, xx = fy * zz - fz * zy, xy = fz * zx - fx * zz, xz = fx * zy - fy * zx;
        const m00 = xx, m10 = xy, m20 = xz, m01 = fx, m11 = fy, m21 = fz, m02 = zx, m12 = zy, m22 = zz, tr = m00 + m11 + m22;
        let s;
        if (tr > 0) { s = Math.sqrt(tr + 1) * 2; o[3] = 0.25 * s; o[0] = (m21 - m12) / s; o[1] = (m02 - m20) / s; o[2] = (m10 - m01) / s; }
        else if (m00 > m11 && m00 > m22) { s = Math.sqrt(1 + m00 - m11 - m22) * 2; o[3] = (m21 - m12) / s; o[0] = 0.25 * s; o[1] = (m01 + m10) / s; o[2] = (m02 + m20) / s; }
        else if (m11 > m22) { s = Math.sqrt(1 + m11 - m00 - m22) * 2; o[3] = (m02 - m20) / s; o[0] = (m01 + m10) / s; o[1] = 0.25 * s; o[2] = (m12 + m21) / s; }
        else { s = Math.sqrt(1 + m22 - m00 - m11) * 2; o[3] = (m10 - m01) / s; o[0] = (m02 + m20) / s; o[1] = (m12 + m21) / s; o[2] = 0.25 * s; }
      }
      function fp_frame_q(dir, up) { const t = new Float64Array(4); fa_frame_q(t, dir[0], dir[1], dir[2], up[0], up[1], up[2]); return [t[0], t[1], t[2], t[3]]; }
      // the frame of a bone's bind space in the world, from the rows the worker last sent: the origin (FA_O: where the bind point 0 is) and the turn (FA_QC: bind axes to world); -> its scale, 0 when the instance is not drawn
      function fa_bone_frame(sp, slot, bone) {
        const m = sp.mirror, base = sp.root_rows * W * 4, nb = sp.bone_count * 8, r = slot * 8, o = base + slot * nb + bone * 8;
        if (!(slot >= 0 && sp.alive[slot] && m[r + 3] > 0)) return 0;
        const rs = m[r + 3];
        FA_A[0] = m[r + 4]; FA_A[1] = m[r + 5]; FA_A[2] = m[r + 6]; FA_A[3] = m[r + 7];
        FA_B[0] = m[o + 4]; FA_B[1] = m[o + 5]; FA_B[2] = m[o + 6]; FA_B[3] = m[o + 7];
        fa_rot(FA_V, FA_A, m[o], m[o + 1], m[o + 2]);
        FA_O[0] = m[r] + FA_V[0] * rs; FA_O[1] = m[r + 1] + FA_V[1] * rs; FA_O[2] = m[r + 2] + FA_V[2] * rs;
        fa_mul(FA_QC, FA_A, FA_B);
        return rs * m[o + 3];
      }
      // the arms of the creature for taking aim: the main arm (the right: side -1) and the other, the torso bone the weapon rides on and the shoulder joint of the main arm (the bind pose, the model's own units); null for a creature with no arms
      function fp_aim_rig(sp) {
        const f = sp.fprops;
        if (f.aim_rig !== undefined) return f.aim_rig;
        let r = null;
        const arms = sp.life && sp.life.arms ? sp.life.arms : [];
        if (arms.length && sp.sk) {
          let jm = 0, jo = -1;
          for (let j = 0; j < arms.length; j++) if (arms[j].side < 0) { jm = j; break; }
          for (let j = 0; j < arms.length; j++) if (j !== jm && arms[j].side !== arms[jm].side) { jo = j; break; }
          if (jo < 0 && arms.length > 1) jo = jm === 0 ? 1 : 0;
          const sk = sp.sk, tb = arms[jm].torso ? sk.index[arms[jm].torso] : undefined, sb = sk.index[arms[jm].shoulder];
          if (tb !== undefined && sb !== undefined) {
            const order = [jm];                                                                              // (the arms in the order that holds take them: the main arm, the arm on the other side, the rest)
            if (jo >= 0) order.push(jo);
            for (let j = 0; j < arms.length; j++) if (order.indexOf(j) < 0) order.push(j);
            const shoulders = arms.map(function (a) { const s = sk.index[a.shoulder]; return s === undefined ? null : [sk.head[s * 3], sk.head[s * 3 + 1], sk.head[s * 3 + 2]]; });
            r = { main: jm, off: jo, torso: tb, shoulder: [sk.head[sb * 3], sk.head[sb * 3 + 1], sk.head[sb * 3 + 2]], order: order, shoulders: shoulders, sides: arms.map(function (a) { return a.side; }) };
          }
        }
        f.aim_rig = r;
        return r;
      }
      // which arm takes which hold (an arm that is left over takes nothing, a hold that finds no arm is not held): a main hold goes to the main arm, an off hold to the first arm on the other side, an "any" to the first arm that is left; and whether
      // the hold is mirrored for it (it was made for a hand on the other side)
      function fp_assign(rig, holds) {
        const n = holds.length, asg = new Array(n).fill(-1), mir = new Array(n).fill(false), taken = {};
        for (let i = 0; i < n; i++) {
          const hd = holds[i];
          let want = rig.order.slice();
          if (hd.hand === "off") want = rig.order.slice(1).concat(rig.order.slice(0, 1));
          if (hd.hand === "off") { const other = want.filter(function (a) { return rig.sides[a] !== rig.sides[rig.main]; }); want = other.concat(want.filter(function (a) { return other.indexOf(a) < 0; })); }
          for (let k = 0; k < want.length; k++) if (!taken[want[k]]) { asg[i] = want[k]; taken[want[k]] = true; break; }
          if (asg[i] >= 0) mir[i] = hd.side !== 0 && rig.sides[asg[i]] !== hd.side;
        }
        return { asg: asg, mir: mir };
      }
      SP.prop_aim = function (h, o) {
        if (!h || h.owner !== this || h.released) throw new Error("system: prop_aim: not a prop that this species gave and that is still held");
        const e = h.entry;
        if (!e.muzzle) throw new Error("system: prop_aim: prop '" + e.name + "' has no muzzle (a `fire` section, or `aim.muzzle`)");
        if (h.flight) return false;
        if (!o || typeof o !== "object" || o.at === undefined) throw new Error("system: prop_aim takes { at: [x, y, z] }");
        only_keys(o, ["at"], "prop_aim");
        const at = vec3(o.at, "prop_aim: at"), now = system.props_clock();
        let A = h.aim, front = true;
        if (e.aim && e.aim.arc) { const rg = fp_aim_rig(this); if (rg) front = fp_in_front(this, h.parent.slot, rg, e.aim, at[0], at[1], at[2], !!(A && A.want && A.front)); }
        if (!A && !front) return false;                                                                    // (a point that is not in front of the creature is not aimed at: the weapon stays as it is carried; one that is up comes down by itself)
        if (!A) {
          A = h.aim = { at: [0, 0, 0], said: now, want: true, front: true, s: 0, ok: false, err: 1, dir: new Float64Array(3), has_dir: false, base: h.mount, mount: { bone: 0, p: [0, 0, 0], q: [0, 0, 0, 1], scale: 1 }, rig: e.aim ? fp_aim_rig(this) : null, moved: false,
            asg: null, mir: null, slide: [-1, -1, -1, -1], rec: new Float64Array(6), pk: new Float64Array(2), held: [], tgt: new Float64Array(36) };
          if (A.rig) { const a = fp_assign(A.rig, e.aim.holds); A.asg = a.asg; A.mir = a.mir; }
          this.fprops.aiming.push(h);
        }
        A.at[0] = at[0]; A.at[1] = at[1]; A.at[2] = at[2]; A.said = now; A.want = true; A.front = front;
        return front;                                                                                      // (false: the point is out of the arc, the weapon is coming down)
      };
      SP.prop_aim_off = function (h) {                                                                     // it is lowered (a weapon that was never aimed is left as it is)
        if (!h || h.owner !== this || h.released) throw new Error("system: prop_aim_off: not a prop that this species gave and that is still held");
        if (h.aim) h.aim.want = false;
        return true;
      };
      SP.prop_aimed = function (h) { return !!(h && h.aim && h.aim.ok && !h.released); };
      // is the point `at` in front of the creature that holds the weapon (`aim.arc`: the arc it takes aim in)? True too for a weapon with no arc, a creature with no arms (a mounted weapon) and a creature that is not drawn (there is nothing to measure)
      SP.prop_in_front = function (h, at) {
        if (!h || h.owner !== this || h.released) throw new Error("system: prop_in_front: not a prop that this species gave and that is still held");
        const e = h.entry;
        if (!e.aim || !e.aim.arc || h.flight) return true;
        const rg = fp_aim_rig(this);
        if (!rg) return true;
        const p = vec3(at, "prop_in_front: at");
        return fp_in_front(this, h.parent.slot, rg, e.aim, p[0], p[1], p[2], !!(h.aim && h.aim.want && h.aim.front));
      };
      // what the hands of an aimed weapon are doing, one record a hold: { name, arm, mirrored, state (what the reach says: 0 none, 1 reaching, 2 on, 3 out of reach), held (0 no bones, 1 held, 2 held at the wrist's limit), miss (metres: the middle of the palm from where the hold puts it),
      // turn (radians: the palm's way from the hold's) }; null for a weapon that is not up. For tests and for the designer's page
      SP.prop_hold_report = function (h) {
        if (!h || h.owner !== this || h.released) throw new Error("system: prop_hold_report: not a prop that this species gave and that is still held");
        const A = h.aim;
        if (!A || !A.rig || !A.moved) return null;
        const out = [], pal = { p: [0, 0, 0], n: [0, 0, 0], f: [0, 0, 0], th: [0, 0, 0] };
        for (let i = 0; i < h.entry.aim.holds.length; i++) {
          const arm = A.asg[i], rec = { name: h.entry.aim.holds[i].name, arm: arm, mirrored: arm >= 0 ? A.mir[i] : false, state: 0, held: 0, miss: -1, turn: -1, slide: A.slide[i] };
          if (arm >= 0) {
            rec.state = this.reach_state(h.parent, arm); rec.held = A.held[i] || 0;
            if (this.hand_palm(h.parent, arm, pal)) {
              const t = A.tgt, o = i * 9;
              rec.miss = Math.hypot(pal.p[0] - t[o], pal.p[1] - t[o + 1], pal.p[2] - t[o + 2]);
              rec.turn = Math.acos(Math.max(-1, Math.min(1, (pal.n[0] * t[o + 3] + pal.n[1] * t[o + 4] + pal.n[2] * t[o + 5]) / (Math.hypot(t[o + 3], t[o + 4], t[o + 5]) || 1))));
            }
          }
          out.push(rec);
        }
        return out;
      };
      // ---- A RIG (`joint`): the angles of its joints are the controller's: sp.prop_turn(h, { yaw, pitch }) (radians, about the joints' axes; any joint by its `name`) or sp.prop_aim(h, { at }) (the page works the angles out from the point and turns the joints at their rates), and every frame
      // (system.props_frame) each part's mount is worked out from the angles of its chain: all of it in the BIND frame of the host's bone, from the rig's own numbers, so a part is never behind the bone that carries the rig (a car's roof, a dog's back, a hand). The part of the rig that fires (the one
      // with `fire`) is the weapon: the handle that prop_fire, prop_aim, prop_turn and prop_aimed are called with. sp.prop_joints(h) -> [{ name, angle, target, low, high }] from the root down
      const fp_chain = [null, null, null, null, null, null, null];
      function fp_joint_chain(sp, h) {                                                                  // the part and what it hangs from, up to the root: into fp_chain; how many are jointed
        const f = sp.fprops;
        let n = 0, x = h;
        while (x && x.jt && n < 7) { fp_chain[n++] = x; const pe = x.entry.joint.parent; x = f.slots[pe][x.parent.slot * f.list[pe].per + x.k] || null; }
        return n;
      }
      function fa_axq(o, axis, ang) { const s = Math.sin(ang * 0.5); o[0] = axis[0] * s; o[1] = axis[1] * s; o[2] = axis[2] * s; o[3] = Math.cos(ang * 0.5); }
      const FJ_QA = new Float64Array(4), FJ_QJ = new Float64Array(4), FJ_TA = new Float64Array(3), FJ_TJ = new Float64Array(3), FJ_V = new Float64Array(3), FJ_Q0 = new Float64Array(4);
      function fp_joint_apply(sp, h) {                                                                  // the mount of a part from the angles of its chain (A = the joints from the root down, J = T(at) R(axis, angle) T(-at); the mount = the rig's `rest` times A)
        const n = fp_joint_chain(sp, h), m0 = h.entry.rest, M = h.jt.mount;
        FJ_QA[0] = 0; FJ_QA[1] = 0; FJ_QA[2] = 0; FJ_QA[3] = 1; FJ_TA[0] = 0; FJ_TA[1] = 0; FJ_TA[2] = 0;
        for (let i = n - 1; i >= 0; i--) {
          const j = fp_chain[i].entry.joint, at = j.at;
          fa_axq(FJ_QJ, j.axis, fp_chain[i].jt.angle);
          fa_rot(FJ_V, FJ_QJ, at[0], at[1], at[2]);
          FJ_TJ[0] = at[0] - FJ_V[0]; FJ_TJ[1] = at[1] - FJ_V[1]; FJ_TJ[2] = at[2] - FJ_V[2];
          fa_rot(FJ_V, FJ_QA, FJ_TJ[0], FJ_TJ[1], FJ_TJ[2]);
          FJ_TA[0] += FJ_V[0]; FJ_TA[1] += FJ_V[1]; FJ_TA[2] += FJ_V[2];
          fa_mul(FJ_QA, FJ_QA, FJ_QJ);
        }
        FJ_Q0[0] = m0.q[0]; FJ_Q0[1] = m0.q[1]; FJ_Q0[2] = m0.q[2]; FJ_Q0[3] = m0.q[3];
        fa_rot(FJ_V, FJ_Q0, FJ_TA[0], FJ_TA[1], FJ_TA[2]);
        M.bone = m0.bone; M.scale = m0.scale;
        M.p[0] = m0.p[0] + FJ_V[0]; M.p[1] = m0.p[1] + FJ_V[1]; M.p[2] = m0.p[2] + FJ_V[2];
        fa_mul(FJ_QA, FJ_Q0, FJ_QA);
        M.q[0] = FJ_QA[0]; M.q[1] = FJ_QA[1]; M.q[2] = FJ_QA[2]; M.q[3] = FJ_QA[3];
        h.mount = M;
        fp_hold_put(h);
      }
      let fp_joint_t = 0;
      function fp_joint_frame() {
        const sl = fp_state.species;
        let now = -1, dt = 0;
        for (let k = 0; k < sl.length; k++) {
          const sp = sl[k], f = sp.fprops;
          if (sp.disposed || !f.jointed.length) continue;
          if (now < 0) { now = system.props_clock(); dt = fp_joint_t > 0 ? Math.min(Math.max(now - fp_joint_t, 0), 0.1) : 1 / 60; fp_joint_t = now; }
          let moved = false;
          for (let a = 0; a < f.jointed.length; a++) {
            const h = f.jointed[a], j = h.entry.joint, J = h.jt;
            if (J.angle !== J.target) {
              let d = J.target - J.angle;
              if (j.full) { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; }
              const step = j.rate * dt;
              if (Math.abs(d) <= step) J.angle = J.target; else J.angle += d > 0 ? step : -step;
              if (j.full) { while (J.angle > Math.PI) J.angle -= 2 * Math.PI; while (J.angle < -Math.PI) J.angle += 2 * Math.PI; }
              moved = true; J.moved = true;
            }
          }
          if (moved) for (let a = 0; a < f.jointed.length; a++) fp_joint_apply(sp, f.jointed[a]);
        }
      }
      // a joint's target: kept in its range (a joint of the whole turn has none: the angle is wrapped)
      function fp_joint_set(j, J, v) {
        if (j.full) { while (v > Math.PI) v -= 2 * Math.PI; while (v < -Math.PI) v += 2 * Math.PI; J.target = v; }
        else J.target = Math.max(j.lo, Math.min(j.hi, v));
      }
      SP.prop_turn = function (h, o) {
        if (!h || h.owner !== this || h.released) throw new Error("system: prop_turn: not a prop that this species gave and that is still held");
        if (!h.jt) throw new Error("system: prop_turn: prop '" + h.entry.name + "' has no joint (a weapon that turns is a rig: `joint` in the parts' sections)");
        if (!o || typeof o !== "object") throw new Error("system: prop_turn takes { yaw, pitch } (radians, by the names of the rig's joints)");
        const n = fp_joint_chain(this, h), names = [];
        for (let i = 0; i < n; i++) names.push(fp_chain[i].entry.joint.name);
        for (const key in o) {
          if (names.indexOf(key) < 0) throw new Error("system: prop_turn: the rig has no joint '" + key + "' (" + names.reverse().join(", ") + ")");
          if (typeof o[key] !== "number" || !Number.isFinite(o[key])) throw new Error("system: prop_turn: " + key + " is an angle in radians");
        }
        if (h.aim) fp_aim_end(this, h, false, true);                                                    // (a hand on the controls: what was aimed is let go, the joints are where they are told)
        for (let i = 0; i < n; i++) { const x = fp_chain[i]; if (o[x.entry.joint.name] !== undefined) fp_joint_set(x.entry.joint, x.jt, o[x.entry.joint.name]); }
        return true;
      };
      SP.prop_joints = function (h) {
        if (!h || h.owner !== this || h.released) throw new Error("system: prop_joints: not a prop that this species gave and that is still held");
        const n = h.jt ? fp_joint_chain(this, h) : 0, out = [];
        for (let i = n - 1; i >= 0; i--) { const x = fp_chain[i], j = x.entry.joint; out.push({ name: j.name, angle: x.jt.angle, target: x.jt.target, low: j.lo, high: j.hi }); }
        return out;
      };
      // the angles that point a rig at a direction (into the targets of its joints): `d` is the world's way to the point, FA_D here the muzzle's own way; the yaw is the angle about the yaw joint's axis that takes the weapon's way to d's, the pitch the angle about the (turned) pitch axis from there
      const FR_D = new Float64Array(3), FR_F = new Float64Array(3), FR_P = new Float64Array(3), FR_Q = new Float64Array(4), FR_Y = new Float64Array(4);
      function fp_rig_aim(sp, h, dx, dy, dz) {
        const e = h.entry, n = fp_joint_chain(sp, h), slot = h.parent.slot, m0 = e.rest;
        let jy = null, jp = null;
        for (let i = 0; i < n; i++) { const x = fp_chain[i]; if (x.entry.joint.name === "yaw") jy = x; else if (x.entry.joint.name === "pitch") jp = x; }
        if (!jy && !jp) return;
        if (!(fa_bone_frame(sp, slot, m0.bone) > 0)) return;                                            // (the assembly's frame in the world: the bone's, then the rig's own turn)
        FR_Q[0] = m0.q[0]; FR_Q[1] = m0.q[1]; FR_Q[2] = m0.q[2]; FR_Q[3] = m0.q[3];
        fa_mul(FR_Y, FA_QC, FR_Q);
        FR_Y[0] = -FR_Y[0]; FR_Y[1] = -FR_Y[1]; FR_Y[2] = -FR_Y[2];
        fa_rot(FR_D, FR_Y, dx, dy, dz);                                                                  // (the way to the point in the assembly's frame)
        const f0 = e.muzzle.dir;
        let ty = 0;
        if (jy) {
          const a = jy.entry.joint.axis, dd = FR_D[0] * a[0] + FR_D[1] * a[1] + FR_D[2] * a[2], fd = f0[0] * a[0] + f0[1] * a[1] + f0[2] * a[2];
          const px = FR_D[0] - dd * a[0], py = FR_D[1] - dd * a[1], pz = FR_D[2] - dd * a[2], fx = f0[0] - fd * a[0], fy = f0[1] - fd * a[1], fz = f0[2] - fd * a[2];
          if (Math.hypot(px, py, pz) > 1e-6) { ty = Math.atan2(((fy * pz - fz * py) * a[0] + (fz * px - fx * pz) * a[1] + (fx * py - fy * px) * a[2]), fx * px + fy * py + fz * pz); fp_joint_set(jy.entry.joint, jy.jt, ty); ty = jy.jt.target; }
          else ty = jy.jt.target;
        }
        if (jp) {
          const aj = jp.entry.joint.axis;
          fa_axq(FR_Q, jy ? jy.entry.joint.axis : [0, 0, 1], jy ? ty : 0);
          fa_rot(FR_F, FR_Q, f0[0], f0[1], f0[2]);
          fa_rot(FR_P, FR_Q, aj[0], aj[1], aj[2]);
          const cx = FR_F[1] * FR_D[2] - FR_F[2] * FR_D[1], cy = FR_F[2] * FR_D[0] - FR_F[0] * FR_D[2], cz = FR_F[0] * FR_D[1] - FR_F[1] * FR_D[0];
          fp_joint_set(jp.entry.joint, jp.jt, Math.atan2(cx * FR_P[0] + cy * FR_P[1] + cz * FR_P[2], FR_F[0] * FR_D[0] + FR_F[1] * FR_D[1] + FR_F[2] * FR_D[2]));
        }
      }
      // what the mind is told: the aimed places of every prop of the instance, one number each (a bit for each place), when one has changed
      function fp_aim_sync(sp, slot, gen) {
        const f = sp.fprops;
        if (!sp.has_worker) return;
        const n = f.list.length, a = f.msg_aim;
        let same = true;
        a[0] = gen;
        for (let i = 0; i < n; i++) {
          let mask = 0;
          for (let k = 0; k < f.list[i].per; k++) { const h = f.slots[i][slot * f.list[i].per + k]; if (h && h.aim && h.aim.ok) mask |= 1 << k; }
          a[1 + i] = mask;
          if (f.aim_sent[slot * n + i] !== mask) { same = false; f.aim_sent[slot * n + i] = mask; }
        }
        if (!same) sp.worker_msg.apply(sp, [FP_MSG_AIM, slot].concat(a));
      }
      function fp_aim_arm(sp, c, arm, w, x, y, z) {                                                      // an arm of the creature to a world point (w 0: let go): the wrist of a creature that has no hand bones to hold with
        FA_HO.x = x; FA_HO.y = y; FA_HO.z = z; FA_HO.w = w;
        try { sp.hand_world(c, arm, FA_HO); } catch (err) { sp.fprops.stats.errors++; fp_warn(sp, "its hand: " + (err && err.message || err)); }
      }
      // ONE HOLD of one aimed weapon: the palm goes on the thing the hold says, in the weapon's frame as it is now (px, py, pz and FA_Q: its place and its turn; ws the scale of its frame in the world, sc the creature's), turned the way the hold says
      // (the palm faces the thing, the thumb up the handle), the fingers round it (sp.hand_hold, species.js). A hold that slides (`to`) takes the point of its segment that is nearest the arm's shoulder, eased: a long handguard is taken
      // where the arm reaches it. A hold on the other side than the one it was made for is mirrored. A creature whose hands have no bones (no fingers to curl, no wrist to turn) has its wrist put where the hold's point is, as it was before holds were
      const FA_HH = { p: [0, 0, 0], n: [0, 0, 0], th: [0, 0, 0], w: 1, curl: 0, thumb: 1, index: 1 }, FA_HV = new Float64Array(3), FA_HQ = new Float64Array(4), FA_PALM = 0.02;          // (FA_PALM: metres at a size of 1 from the bone line of the palm to the skin that lies on the thing)
      function fp_aim_hold(sp, c, A, ai, rig, i, arm, ease, ws, sc, px, py, pz, dt, mz) {
        const hd = ai.holds[i], m = A.mir[i] ? -1 : 1;
        let ax = hd.at[0] * m, ay = hd.at[1], az = hd.at[2];
        if (hd.to) {
          const sh = rig.shoulders[arm], bx = hd.to[0] * m - ax, by = hd.to[1] - ay, bz = hd.to[2] - az, b2 = bx * bx + by * by + bz * bz;
          let t = 0.5;
          if (sh && b2 > 1e-10) {                                                                          // (the arm's shoulder in the weapon's frame: the torso's frame is still FA_O, FA_QC)
            fa_rot(FA_HV, FA_QC, sh[0], sh[1], sh[2]);
            fa_conj(FA_HQ, FA_Q);
            fa_rot(FA_HV, FA_HQ, FA_O[0] + FA_HV[0] * sc - px, FA_O[1] + FA_HV[1] * sc - py, FA_O[2] + FA_HV[2] * sc - pz);
            t = Math.max(0, Math.min(1, ((FA_HV[0] / ws - ax) * bx + (FA_HV[1] / ws - ay) * by + (FA_HV[2] / ws - az) * bz) / b2));
          }
          A.slide[i] = A.slide[i] < 0 ? t : A.slide[i] + (t - A.slide[i]) * Math.min(1, dt * 8);
          ax += bx * A.slide[i]; ay += by * A.slide[i]; az += bz * A.slide[i];
        }
        const fx = hd.from[0] * m, fy = hd.from[1], fz = hd.from[2], off = hd.radius * ws + FA_PALM * sc;
        let r = 0;
        if (hh_geometry(sp, arm)) {
          fa_rot(FA_HV, FA_Q, ax * ws + fx * off, ay * ws + fy * off, az * ws + fz * off);                  // (the middle of the palm's bone: the thing's axis point, out to the hand's side by the thing's radius and the palm's own thickness)
          FA_HH.p[0] = px + FA_HV[0]; FA_HH.p[1] = py + FA_HV[1]; FA_HH.p[2] = pz + FA_HV[2];
          fa_rot(FA_HH.n, FA_Q, -fx, -fy, -fz);                                                             // (the palm faces the thing)
          fa_rot(FA_HH.th, FA_Q, hd.axis[0] * m, hd.axis[1], hd.axis[2]);                                 // (the thumb is up the handle)
          FA_HH.w = ease; FA_HH.curl = hd.curl; FA_HH.thumb = hd.thumb; FA_HH.index = hd.index;
          FA_HH.lean = arm !== rig.main; FA_HH.turn = true;                                                // (the support arm has the body's help, its TURN only: the trunk turns toward the weapon as a shooter's does (a bladed stance), it does not bow; the main arm's hold is near the shoulder)
          try { r = hh_hold(sp, c, arm, hh_geometry(sp, arm), FA_HH); } catch (err) { sp.fprops.stats.errors++; fp_warn(sp, "its hand: " + (err && err.message || err)); }
          for (let k = 0; k < 3; k++) { A.tgt[i * 9 + k] = FA_HH.p[k]; A.tgt[i * 9 + 3 + k] = FA_HH.n[k]; A.tgt[i * 9 + 6 + k] = FA_HH.th[k]; }
        }
        if (!r) {                                                                                          // (no bones to hold with: the wrist at the hold's point, the palm's length back along the barrel)
          fa_rot(FA_HV, FA_Q, ax * ws, ay * ws, az * ws);
          fa_rot(FA_D, FA_Q, mz.dir[0], mz.dir[1], mz.dir[2]);
          fp_aim_arm(sp, c, arm, ease, px + FA_HV[0] - FA_D[0] * ai.palm * ws, py + FA_HV[1] - FA_D[1] * ai.palm * ws, pz + FA_HV[2] - FA_D[2] * ai.palm * ws);
        }
        A.held[i] = r;
      }
      // ---- RECOIL: a shot kicks the weapon back along its barrel and lifts the muzzle (about the shoulder: the butt stays in the pocket), a little to a side; the hands, which are on the weapon, go with it; the shooter pulls the muzzle down against
      // the climb (it aims below the point by `comp` of the climb: 0.75), and the trunk takes a share of the shot's impulse as a shove that does no damage. A.rec = [back, back's speed, climb, climb's speed, yaw, yaw's speed]: three springs
      // (an underdamped one: it overshoots a little and settles), kicked by a speed that makes it peak where the weapon says
      const FA_RZ = 0.55, FA_RPK = 0.5217;                                                               // (the damping ratio of the springs, and the peak of one kicked at speed v in units of v / frequency)
      function fa_spring(S, i, w, dt) {
        const z = FA_RZ, wd = w * Math.sqrt(1 - z * z), e = Math.exp(-z * w * dt), c = Math.cos(wd * dt), s = Math.sin(wd * dt), x0 = S[i], v0 = S[i + 1], B = (v0 + z * w * x0) / wd;
        S[i] = e * (x0 * c + B * s);
        S[i + 1] = e * (v0 * c - (z * w * B + x0 * wd) * s);
        if (Math.abs(S[i]) < 1e-6 && Math.abs(S[i + 1]) < 1e-4) { S[i] = 0; S[i + 1] = 0; }
      }
      function fp_recoil_rate(ai) { return ai.recoil && ai.recoil.rate !== null ? ai.recoil.rate : 26; }
      // what a shot of this weapon does: [back (m at size 1), climb (rad), side (rad)]
      function fp_recoil_of(e, out) {
        const R = e.aim && e.aim.recoil, imp = e.fire ? e.fire.impulse : 3;
        out[0] = R && R.back !== null ? R.back : Math.min(0.1, 0.012 + 0.0045 * imp);
        out[1] = R && R.climb !== null ? R.climb : Math.min(0.14, 0.025 + 0.012 * imp);
        out[2] = R && R.side !== null ? R.side : 0.25 * out[1];
        return out;
      }
      const FA_RC = [0, 0, 0];
      function fp_recoil_kick(sp, h) {
        const A = h.aim;
        if (!A || !A.rig || A.s < 0.5 || !h.entry.aim) return false;                                     // (a weapon that is not up has no shoulder to kick)
        const w = fp_recoil_rate(h.entry.aim), k = w / FA_RPK, r = fp_recoil_of(h.entry, FA_RC);
        A.rec[1] += r[0] * k; A.rec[3] += r[1] * k; A.rec[5] += r[2] * k * (fp_rand() * 2 - 1);
        const cap = 3;
        if (A.rec[0] > cap * r[0]) A.rec[0] = cap * r[0];
        if (A.rec[2] > cap * r[1]) A.rec[2] = cap * r[1];
        // the trunk takes the shock: a hit with no damage, no count and no event (CMD_HAPPY_IMPACT with bit 8 of the zone: world.cpp, QUIET) along the barrel the other way, a share of the shot's impulse (`recoil.shock`, 0.5)
        if (sp.has_hit) {
          const f = sp.fprops, R = h.entry.aim.recoil, sh = R && R.shock !== null ? R.shock : 0.5, imp = (h.entry.fire ? h.entry.fire.impulse : 3) * sh;
          if (f.recoil_zone === undefined) { try { f.recoil_zone = hit_zone_index(sp, "torso", "recoil"); } catch (err) { f.recoil_zone = -1; } }
          if (f.recoil_zone >= 0 && imp > 0 && A.has_dir) {
            q_begin(13); q_u(CMD_HAPPY_IMPACT); q_u(sp.js_id); q_u(h.parent.slot); q_u(h.parent.gen);
            q_f(0); q_f(0); q_f(0); q_f(-A.dir[0]); q_f(-A.dir[1]); q_f(-A.dir[2]); q_f(imp); q_f(0); q_u(f.recoil_zone | 0x100);
          }
        }
        return true;
      }
      system.fp_recoil_of = function (sp, h) { return fp_recoil_of(h.entry, [0, 0, 0]); };
      // the end of an aim: the weapon is where it is carried (the mount it had), the hands are let go, the mind is told
      function fp_aim_end(sp, h, quiet, keep) {
        const A = h.aim, f = sp.fprops;
        if (!A) return;
        h.aim = null;
        const k = f.aiming.indexOf(h);
        if (k >= 0) { f.aiming[k] = f.aiming[f.aiming.length - 1]; f.aiming.pop(); }
        if (A.rig && A.moved && sp.alive[h.parent.slot] === 1 && sp.gen[h.parent.slot] === h.parent.gen) {
          for (let i = 0; i < A.asg.length; i++) if (A.asg[i] >= 0) { try { sp.hand_hold_end(h.parent, A.asg[i]); } catch (err) { f.stats.errors++; fp_warn(sp, "its hand: " + (err && err.message || err)); } }          // (every hand that held: the pose eases back, the fingers open, the reach is let go)
          if (!h.released && !h.flight) fp_curl_hand(sp, h, true);                                         // (a weapon that is carried in the hand again: the hand is closed on it)
        }
        if (h.jt) { if (keep !== true && !h.released) { const n = fp_joint_chain(sp, h); for (let i = 0; i < n; i++) fp_chain[i].jt.target = 0; } }          // (a rig that is let go goes back to where it looks forward; its mounts are the joints')
        else if (!h.released && !h.flight) { h.mount = A.base; fp_hold_put(h); }
        if (A.ok && quiet !== true) { A.ok = false; fp_aim_sync(sp, h.parent.slot, h.parent.gen); }
      }
      // THE FRONT: is the point (x, y, z) inside the arc (`aim.arc`) of the creature of `slot`? The way it faces is the turn of its instance (the worker's row: the model's +z), the point is measured from its main shoulder: the bearing
      // from the way it faces, and the elevation. `was`: the weapon is up already, so the arc is FP_ARC_HOLD radians wider (a point at the edge does not make it flutter between up and down). A creature that is not drawn has no row: it is in front.
      const FP_ARC_HOLD = 0.14, FA_FQ = new Float64Array(4), FA_FF = new Float64Array(3), FA_FS = new Float64Array(3);
      function fp_in_front(sp, slot, rig, ai, x, y, z, was) {
        const arc = ai.arc;
        if (!arc) return true;
        const m = sp.mirror, r = slot * 8, rs = m[r + 3];
        if (!(slot >= 0 && sp.alive[slot] && rs > 0)) return true;
        FA_FQ[0] = m[r + 4]; FA_FQ[1] = m[r + 5]; FA_FQ[2] = m[r + 6]; FA_FQ[3] = m[r + 7];
        fa_rot(FA_FF, FA_FQ, 0, 0, 1);
        fa_rot(FA_FS, FA_FQ, rig.shoulder[0], rig.shoulder[1], rig.shoulder[2]);
        const dx = x - (m[r] + FA_FS[0] * rs), dy = y - (m[r + 1] + FA_FS[1] * rs), dz = z - (m[r + 2] + FA_FS[2] * rs), lh = Math.hypot(dx, dz), hold = was ? FP_ARC_HOLD : 0, el = Math.atan2(dy, lh);
        if (el > arc.up + hold || el < -(arc.down + hold)) return false;
        if (!(lh > 1e-3 * rs) || !(Math.hypot(FA_FF[0], FA_FF[2]) > 1e-6)) return true;                  // (straight above or below: it has no side; the elevation has said)
        return Math.atan2(Math.abs(FA_FF[0] * dz - FA_FF[2] * dx), FA_FF[0] * dx + FA_FF[2] * dz) <= arc.yaw + hold;
      }
      // one frame of one aimed weapon (see above)
      function fp_aim_step(sp, h, dt, now) {
        const A = h.aim, e = h.entry, ai = e.aim, mz = e.muzzle, tol = e.fire ? e.fire.aim_tol : 0.05, c = h.parent, slot = c.slot, rig = A.rig, f = sp.fprops;
        if (h.flight || h.released) { fp_aim_end(sp, h, true); return; }
        if (A.want && now - A.said > FP_AIM_HOLD) A.want = false;                                       // (the mind stopped saying where: it lowers it)
        if (rig && ai.arc && A.want) A.front = fp_in_front(sp, slot, rig, ai, A.at[0], A.at[1], A.at[2], A.front);          // (the point is behind it, or well to the side: it is not aimed at, the weapon comes down; the creature has to turn)
        const want = A.want && A.front;
        A.s += (want ? 1 : -1) * dt / (rig ? ai.raise : 0.05);
        if (A.s > 1) A.s = 1;
        if (A.s <= 0 && !want) { fp_aim_end(sp, h, false); return; }
        if (A.s < 0) A.s = 0;
        fp_mount_row(sp, slot, h.mount, e.scale);                                                      // (where the weapon is now)
        if (!(fp_row[3] > 0)) return;                                                                  // (not drawn: the instance is out of sight)
        FA_Q[0] = fp_row[4]; FA_Q[1] = fp_row[5]; FA_Q[2] = fp_row[6]; FA_Q[3] = fp_row[7];
        let ws = fp_row[3], px = fp_row[0], py = fp_row[1], pz = fp_row[2];
        fa_rot(FA_D, FA_Q, mz.dir[0], mz.dir[1], mz.dir[2]);                                          // (the barrel's way now)
        let bx = FA_D[0], by = FA_D[1], bz = FA_D[2];
        fa_rot(FA_V, FA_Q, mz.at[0] * ws, mz.at[1] * ws, mz.at[2] * ws);
        let tx = A.at[0] - (px + FA_V[0]), ty = A.at[1] - (py + FA_V[1]), tz = A.at[2] - (pz + FA_V[2]), tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl; ty /= tl; tz /= tl;                                                                  // (the way to the point from the muzzle)
        let err, ease = 1;
        if (!rig) { err = Math.acos(Math.max(-1, Math.min(1, bx * tx + by * ty + bz * tz))); if (h.jt && A.want) fp_rig_aim(sp, h, tx, ty, tz); }          // (a rig turns its joints toward the point: its mounts are the joints' frame's)
        else {
          if (!A.has_dir) { A.dir[0] = bx; A.dir[1] = by; A.dir[2] = bz; A.has_dir = true; }
          const RC = A.rec;
          const w_rc = fp_recoil_rate(ai);
          if (RC[0] !== 0 || RC[1] !== 0) fa_spring(RC, 0, w_rc, dt);
          if (RC[2] !== 0 || RC[3] !== 0) fa_spring(RC, 2, w_rc, dt);
          if (RC[4] !== 0 || RC[5] !== 0) fa_spring(RC, 4, w_rc, dt);
          if (Math.abs(RC[0]) > A.pk[0]) A.pk[0] = Math.abs(RC[0]);                                       // (the greatest kick so far: for tests, the page's frames may be few)
          if (Math.abs(RC[2]) > A.pk[1]) A.pk[1] = Math.abs(RC[2]);
          let ux = tx, uy = ty, uz = tz;
          const lt = Math.hypot(tx, tz), cp = ai.recoil && ai.recoil.comp !== null ? ai.recoil.comp : 0.75;
          if (RC[2] !== 0 && lt > 1e-4) {                                                                  // (the shooter pulls the muzzle down against the climb: the way he aims is the point's, lowered by `comp` of the climb)
            const th = -cp * RC[2], ct = Math.cos(th), st = Math.sin(th);
            ux = tx * ct + (-tx * ty / lt) * st; uy = ty * ct + lt * st; uz = tz * ct + (-tz * ty / lt) * st;
          }
          const cs = Math.max(-1, Math.min(1, A.dir[0] * ux + A.dir[1] * uy + A.dir[2] * uz)), ang = Math.acos(cs), step = ai.rate * dt;
          if (ang <= step || ang < 1e-6) { A.dir[0] = ux; A.dir[1] = uy; A.dir[2] = uz; }
          else {
            const t = step / ang, sn = Math.sin(ang), wa = Math.sin((1 - t) * ang) / sn, wb = Math.sin(t * ang) / sn;
            const nx = A.dir[0] * wa + ux * wb, ny = A.dir[1] * wa + uy * wb, nz = A.dir[2] * wa + uz * wb, nl = Math.hypot(nx, ny, nz) || 1;
            A.dir[0] = nx / nl; A.dir[1] = ny / nl; A.dir[2] = nz / nl;
          }
          const sc = fa_bone_frame(sp, slot, rig.torso);                                               // (the torso's frame: FA_O, FA_QC)
          if (!(sc > 0)) return;
          const pk = ai.pocket, sh = rig.shoulder;
          fa_rot(FA_V, FA_QC, sh[0] * (1 - pk[0]), sh[1] + pk[1], sh[2] + pk[2]);
          FA_PW[0] = FA_O[0] + FA_V[0] * sc; FA_PW[1] = FA_O[1] + FA_V[1] * sc; FA_PW[2] = FA_O[2] + FA_V[2] * sc;          // (the pocket of the shoulder, in the world)
          ws = sc * e.scale;
          fa_frame_q(FA_QA, A.dir[0], A.dir[1], A.dir[2], 0, 1, 0);                                    // (the weapon's turn when it is up: its muzzle's way along the aim, its up up)
          fa_mul(FA_QA, FA_QA, ai.ql_inv);
          const ll = Math.hypot(A.dir[0], A.dir[2]);
          if ((RC[2] !== 0 || RC[4] !== 0) && ll > 1e-4) {                                                // (the recoil's turn: the climb about the weapon's side axis (its way x up: + lifts the muzzle), the yaw about the up, the butt stays where it is)
            FA_AX[0] = -A.dir[2] / ll; FA_AX[1] = 0; FA_AX[2] = A.dir[0] / ll; fa_axq(FA_QK, FA_AX, RC[2]);
            FA_AX[0] = 0; FA_AX[1] = 1; FA_AX[2] = 0; fa_axq(FA_QY, FA_AX, RC[4]);
            fa_mul(FA_QK, FA_QY, FA_QK); fa_mul(FA_QA, FA_QK, FA_QA);
          }
          fa_rot(FA_V, FA_QA, ai.butt[0] * ws, ai.butt[1] * ws, ai.butt[2] * ws);
          FA_P[0] = FA_PW[0] - FA_V[0]; FA_P[1] = FA_PW[1] - FA_V[1]; FA_P[2] = FA_PW[2] - FA_V[2];     // (its place: the butt in the pocket)
          if (RC[0] !== 0) {                                                                               // (the kick back: along the barrel as it looks, `back` metres at the creature's size)
            fa_rot(FA_D, FA_QA, mz.dir[0], mz.dir[1], mz.dir[2]);
            FA_P[0] -= FA_D[0] * RC[0] * sc; FA_P[1] -= FA_D[1] * RC[0] * sc; FA_P[2] -= FA_D[2] * RC[0] * sc;
          }
          fp_mount_row(sp, slot, A.base, e.scale);                                                      // (where it is carried, FA_PN and FA_QN)
          FA_PN[0] = fp_row[0]; FA_PN[1] = fp_row[1]; FA_PN[2] = fp_row[2]; FA_QN[0] = fp_row[4]; FA_QN[1] = fp_row[5]; FA_QN[2] = fp_row[6]; FA_QN[3] = fp_row[7];
          ease = A.s * A.s * (3 - 2 * A.s);
          let dq = FA_QN[0] * FA_QA[0] + FA_QN[1] * FA_QA[1] + FA_QN[2] * FA_QA[2] + FA_QN[3] * FA_QA[3];
          const sg = dq < 0 ? -1 : 1;
          for (let q = 0; q < 4; q++) FA_Q[q] = FA_QN[q] + (sg * FA_QA[q] - FA_QN[q]) * ease;
          const ql = Math.hypot(FA_Q[0], FA_Q[1], FA_Q[2], FA_Q[3]) || 1;
          FA_Q[0] /= ql; FA_Q[1] /= ql; FA_Q[2] /= ql; FA_Q[3] /= ql;
          px = FA_PN[0] + (FA_P[0] - FA_PN[0]) * ease; py = FA_PN[1] + (FA_P[1] - FA_PN[1]) * ease; pz = FA_PN[2] + (FA_P[2] - FA_PN[2]) * ease;
          // the mount on the torso that puts it there: the point and the turn in the bind frame of the bone
          fa_conj(FA_A, FA_QC);
          fa_rot(FA_V, FA_A, (px - FA_O[0]) / sc, (py - FA_O[1]) / sc, (pz - FA_O[2]) / sc);
          fa_mul(FA_B, FA_A, FA_Q);
          const M = A.mount;
          M.bone = rig.torso; M.p[0] = FA_V[0]; M.p[1] = FA_V[1]; M.p[2] = FA_V[2]; M.q[0] = FA_B[0]; M.q[1] = FA_B[1]; M.q[2] = FA_B[2]; M.q[3] = FA_B[3];
          h.mount = M;
          fp_hold_put(h);
          // the hands: every hold of the weapon goes to the arm that takes it (a palm on the thing, the fingers round it)
          fa_rot(FA_D, FA_Q, mz.dir[0], mz.dir[1], mz.dir[2]);
          bx = FA_D[0]; by = FA_D[1]; bz = FA_D[2];
          for (let i = 0; i < ai.holds.length; i++) if (A.asg[i] >= 0) fp_aim_hold(sp, c, A, ai, rig, i, A.asg[i], ease, ws, sc, px, py, pz, dt, mz);
          A.moved = true;
          fa_rot(FA_V, FA_Q, mz.at[0] * ws, mz.at[1] * ws, mz.at[2] * ws);                              // (the muzzle where it is now, and the way it looks, against the point)
          tx = A.at[0] - (px + FA_V[0]); ty = A.at[1] - (py + FA_V[1]); tz = A.at[2] - (pz + FA_V[2]); tl = Math.hypot(tx, ty, tz) || 1;
          err = Math.acos(Math.max(-1, Math.min(1, (bx * tx + by * ty + bz * tz) / tl)));
        }
        A.err = err;
        const ok = want && ease >= 0.97 && err <= (A.ok ? tol * 1.2 : tol * 0.8);
        if (ok !== A.ok) { A.ok = ok; if (ok) f.stats.aimed++; fp_aim_sync(sp, slot, c.gen); }
      }
      let fp_aim_t = 0;
      function fp_aim_frame() {
        const sl = fp_state.species;
        let now = -1, dt = 0;
        for (let k = 0; k < sl.length; k++) {
          const sp = sl[k], f = sp.fprops;
          if (sp.disposed || !f.aiming.length) continue;
          if (now < 0) { now = system.props_clock(); dt = fp_aim_t > 0 ? Math.min(Math.max(now - fp_aim_t, 0), 0.1) : 1 / 60; fp_aim_t = now; }
          for (let a = f.aiming.length - 1; a >= 0; a--) { const h = f.aiming[a]; if (h && h.aim) fp_aim_step(sp, h, dt, now); }
        }
      }

      // ---- THROWN PROPS ------------------------------------------------------------------------------------------------------------------------------------------------------------------
      // The flight is the page's (a prop is not in the worker): semi-implicit Euler, once a frame (system.props_step(dt): the engine's on_frame_begin calls it when a species has a prop that can be thrown). What the prop meets is asked of the worker's
      // hitscan (system.shoot: the physics world's props, the terrain, the creatures' hit zones) with a chord of the path a few frames AHEAD of the prop (FP_LOOK frames), every frame: the answer comes back a frame or two later, and when it says
      // that something lies on the chord the prop lands where that is (or at once, when it has passed it already: the answer was late). The creature that is on the chord takes the prop's `hit` as an impact when the prop gets there.
      const FP_G = 9.81, FP_LOOK = 4;
      const fp_flight_state = { hooked: false };
      // system.props_cast(sp, c, from, dir, range, answer): the question of a chord (a test puts its own: the answer is called with the shot, { distance, hit, js, slot, gen, sp })
      system.props_cast = function (sp, c, from, dir, range, answer) {
        system.shoot({ from: from, dir: dir, range: range, shooter: { sp: sp, c: c } }, answer);
      };
      function fp_hook() {
        if (fp_flight_state.hooked || !engine.on_frame_begin || typeof engine.on_frame_begin.add !== "function") return;
        fp_flight_state.hooked = true;
        engine.on_frame_begin.add(function (time, dt) { system.props_step(dt); });
      }
      // the velocity that takes a prop from p to the point `at` at speed s (the low arc; out of reach: the angle that goes farthest) under gravity g
      function fp_aim(p, at, s, g, out) {
        const dx = at[0] - p[0], dy = at[1] - p[1], dz = at[2] - p[2], d = Math.hypot(dx, dz);
        let ang;
        if (g <= 0) ang = Math.atan2(dy, d);
        else if (d < 1e-6) ang = dy >= 0 ? Math.PI / 2 : -Math.PI / 2;
        else {
          const s2 = s * s, disc = s2 * s2 - g * (g * d * d + 2 * dy * s2);
          ang = disc >= 0 ? Math.atan2(s2 - Math.sqrt(disc), g * d) : Math.atan2(s2, g * d) * 0.5 + Math.PI / 8;
        }
        const hx = d < 1e-6 ? 0 : dx / d, hz = d < 1e-6 ? 1 : dz / d, ca = Math.cos(ang);
        out[0] = hx * ca * s; out[1] = Math.sin(ang) * s; out[2] = hz * ca * s;
      }
      SP.prop_throw = function (h, o) {
        if (!h || h.owner !== this || h.released) throw new Error("system: prop_throw: not a prop that this species gave and that is still held");
        const e = h.entry, T = e.throw;
        if (!T) throw new Error("system: prop_throw: prop '" + e.name + "' has no `throw` section (what a throw of it does: speed, gravity, spin, linger ...)");
        if (h.flight) return false;
        o = o === undefined || o === null ? {} : o;
        if (typeof o !== "object") throw new Error("system: prop_throw takes { speed, up | dir | at | vel } or nothing");
        only_keys(o, ["speed", "up", "dir", "at", "vel"], "prop_throw");
        const speed = o.speed === undefined ? T.speed : o.speed;
        if (typeof speed !== "number" || !(speed > 0 && speed <= 500)) throw new Error("system: prop_throw: speed is a number above 0 (m/s)");
        const sp = this, c = h.parent;
        fp_attached_row(sp, h);                                                                        // (where it is now: the hand's)
        const F = { mode: 0, p: [fp_row[0], fp_row[1], fp_row[2]], v: [0, 0, 0], q: [fp_row[4], fp_row[5], fp_row[6], fp_row[7]], s: fp_row[3], age: 0, lie: 0, hit: null, spin: T.spin.slice(), roll: 0, who: { sp: sp, c: c } };
        if (!(F.s > 0)) {                                                                              // (the parent is not drawn: out of sight; the prop goes from its root)
          const m = sp.mirror, r = c.slot * 8;
          F.p = [m[r], m[r + 1] + 0.8 * (m[r + 3] > 0 ? m[r + 3] : 1), m[r + 2]]; F.s = h.entry.scale * (m[r + 3] > 0 ? m[r + 3] : 1);
        }
        const v = F.v;
        if (o.vel !== undefined) { const w = vec3(o.vel, "prop_throw: vel"); v[0] = w[0]; v[1] = w[1]; v[2] = w[2]; }
        else if (o.at !== undefined) { const to = vec3(o.at, "prop_throw: at"); fp_aim(F.p, to, speed, FP_G * T.gravity, v); if (T.fuse === "aim") F.aim = [to[0], to[1], to[2]]; }      // (fuse "aim": it goes off where it was aimed)
        else {
          let dx, dy, dz;
          if (o.dir !== undefined) { const w = vec3(o.dir, "prop_throw: dir"), l = Math.hypot(w[0], w[1], w[2]); if (!(l > 1e-6)) throw new Error("system: prop_throw: dir is a direction, not [0, 0, 0]"); dx = w[0] / l; dy = w[1] / l; dz = w[2] / l; }
          else {                                                                                       // (forward: the way the parent faces, `up` radians over the horizon)
            const m = sp.mirror, r = c.slot * 8, up = o.up === undefined ? 0.3 : o.up;
            if (typeof up !== "number" || !Number.isFinite(up)) throw new Error("system: prop_throw: up is radians");
            fx_rot(m[r + 4], m[r + 5], m[r + 6], m[r + 7], 0, 0, 1, fp_a);
            const l = Math.hypot(fp_a[0], fp_a[2]) || 1, ca = Math.cos(up);
            dx = fp_a[0] / l * ca; dy = Math.sin(up); dz = fp_a[2] / l * ca;
          }
          v[0] = dx * speed; v[1] = dy * speed; v[2] = dz * speed;
        }
        if (h.aim) fp_aim_end(sp, h, true);                                                            // (it leaves the shoulder: the hands let go)
        h.flight = F; h.where = "flight";
        let k = sp.fprops.att.indexOf(h);
        if (k >= 0) { sp.fprops.att[k] = sp.fprops.att[sp.fprops.att.length - 1]; sp.fprops.att.pop(); }
        sp.fprops.fly.push(h);
        sp.fprops.stats.thrown++;
        fp_hook();
        fp_hold_put(h);                                                                                // (it leaves its bone: free, where its flight starts)
        fp_sync(sp, c.slot, c.gen);
        fp_event(sp, h, "throw", { v: v.slice() });
        return true;
      };
      // where the prop lies: `at` the point its origin goes to, `target` the creature it landed on (or null)
      function fp_land(sp, h, at, target, speed, dir) {
        const F = h.flight, T = h.entry.throw, f = sp.fprops;
        F.mode = 1; F.lie = 0; F.p[0] = at[0]; F.p[1] = at[1]; F.p[2] = at[2]; F.v[0] = F.v[1] = F.v[2] = 0; F.hit = null;
        fp_hold_put(h);                                                                                // (its entry first: what a particle on it asks for is where it lies)
        if (target) {
          f.stats.hits++;
          const tsp = target.sp;
          if ((T.hit.impulse > 0 || T.hit.damage > 0) && tsp.has_hit) {
            try { tsp.impact({ species: tsp, slot: target.slot, gen: target.gen }, { point: [at[0] + dir[0] * T.radius, at[1] + dir[1] * T.radius, at[2] + dir[2] * T.radius], dir: [dir[0], dir[1], dir[2]], impulse: T.hit.impulse, damage: T.hit.damage }); }
            catch (err) { f.stats.errors++; fp_warn(sp, "its hit: " + (err && err.message || err)); }
          }
        } else f.stats.landed++;
        system.fx_fire(sp, h.parent.slot, 3, speed, undefined, h.name, h);
        fp_event(sp, h, target ? "hit" : "land", { at: [at[0], at[1], at[2]], speed: speed, target: target ? { sp: target.sp, c: { species: target.sp, slot: target.slot, gen: target.gen } } : null });
        if (T.blast) fp_blast(sp, h, at);
      }
      // THE AREA BLAST of a landed prop (`throw.blast`): every instance of every species of the page within the blast's radius (from where it landed to the edge of the creature's body: its `body.radius` times its scale, 0 for a creature with none), its fall-off f = (1 - d / radius)^2.
      // A creature with hit zones takes an impact (the point on its trunk, the way from the blast, a lift of a third: sp.impact), and the event "blast" ({ at, radius, hits: [{ sp, c, distance, f, damage }] }, damage = the blast's damage x f) goes to whoever listens: the creatures that took it
      // and the ones that have no zones (a vehicle), for a health block to take the damage from. The thrower is not spared (a shell that lands at its own feet hurts it too), `from` is its instance. One pass over the species' instances (a blast is rare).
      function fp_blast(sp, h, at) {
        const B = h.entry.throw.blast, f = sp.fprops, hits = [], R = B.radius;
        for (let i = 0; i < system.list.length; i++) {
          const tsp = system.list[i];
          if (!tsp || tsp.static || tsp.render_only || tsp.disposed || !tsp.mirror || !tsp.alive) continue;
          const m = tsp.mirror, br = tsp.body && tsp.body.radius > 0 ? tsp.body.radius : 0;
          for (let s = 0; s < tsp.max_instances; s++) {
            if (tsp.alive[s] !== 1) continue;
            const o = s * 8, sc = m[o + 3] > 0 ? m[o + 3] : 1, px = m[o], py = m[o + 1] + 0.6 * sc, pz = m[o + 2];
            const dx = px - at[0], dy = py - at[1], dz = pz - at[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz), reach = d - br * sc;
            if (!(reach < R)) continue;
            const k = 1 - Math.max(0, reach) / R, fo = k * k, l = d > 1e-6 ? d : 1, c = { species: tsp, slot: s, gen: tsp.gen[s] };
            if ((tsp.has_hit || (tsp.vehicle && !tsp.aircraft)) && (B.impulse > 0 || B.damage > 0)) {                                    // (a vehicle has no zones: it takes the impulse, its rollover is what it does with it, species.js)
              try { tsp.impact(c, { point: [px, py, pz], dir: [dx / l, dy / l + 0.35, dz / l], impulse: B.impulse * fo, damage: B.damage * fo }); }
              catch (err) { f.stats.errors++; fp_warn(sp, "its blast: " + (err && err.message || err)); }
            }
            hits.push({ sp: tsp, c: c, distance: d, f: fo, damage: B.damage * fo });
          }
        }
        f.stats.blasts = (f.stats.blasts || 0) + 1;
        fp_event(sp, h, "blast", { at: [at[0], at[1], at[2]], radius: R, impulse: B.impulse, damage: B.damage, hits: hits, from: h.parent });
      }
      function fp_step_one(sp, h, dt) {
        const F = h.flight, T = h.entry.throw;
        if (F.mode === 1) { F.lie += dt; if (F.lie >= T.linger) sp.prop_release(h); return; }
        F.age += dt;
        const p = F.p, v = F.v;
        v[1] -= FP_G * T.gravity * dt;
        const nx = p[0] + v[0] * dt, ny = p[1] + v[1] * dt, nz = p[2] + v[2] * dt, speed = Math.hypot(v[0], v[1], v[2]);
        if (F.hit) {                                                                                   // (something lies on a chord that was asked: has the prop got there?)
          const H = F.hit, t = (nx - H.from[0]) * H.dir[0] + (ny - H.from[1]) * H.dir[1] + (nz - H.from[2]) * H.dir[2], reach = Math.max(0, H.d - T.radius);
          if (t >= reach) { fp_land(sp, h, [H.from[0] + H.dir[0] * reach, H.from[1] + H.dir[1] * reach, H.from[2] + H.dir[2] * reach], H.target, speed, H.dir); return; }
        }
        if (F.aim && (nx - F.aim[0]) * v[0] + (ny - F.aim[1]) * v[1] + (nz - F.aim[2]) * v[2] >= 0) { fp_land(sp, h, [F.aim[0], F.aim[1], F.aim[2]], null, speed, [v[0] / (speed || 1), v[1] / (speed || 1), v[2] / (speed || 1)]); return; }       // (it has got to the point it was thrown at: it goes off there)
        p[0] = nx; p[1] = ny; p[2] = nz;
        if (T.align && speed > 1e-6) {
          F.roll += F.spin[1] * dt;
          const q = fp_quat([v[0], v[1], v[2]], F.roll * 180 / Math.PI);
          F.q[0] = q[0]; F.q[1] = q[1]; F.q[2] = q[2]; F.q[3] = q[3];
        } else if (F.spin[0] !== 0 || F.spin[1] !== 0 || F.spin[2] !== 0) {
          const wx = F.spin[0], wy = F.spin[1], wz = F.spin[2], w = Math.hypot(wx, wy, wz), half = 0.5 * w * dt, sn = Math.sin(half) / w, ax = wx * sn, ay = wy * sn, az = wz * sn, aw = Math.cos(half);
          const qx = F.q[0], qy = F.q[1], qz = F.q[2], qw = F.q[3];
          const rx = qw * ax + qx * aw + qy * az - qz * ay, ry = qw * ay - qx * az + qy * aw + qz * ax, rz = qw * az + qx * ay - qy * ax + qz * aw, rw = qw * aw - qx * ax - qy * ay - qz * az, n = Math.hypot(rx, ry, rz, rw) || 1;
          F.q[0] = rx / n; F.q[1] = ry / n; F.q[2] = rz / n; F.q[3] = rw / n;
        }
        if (F.age >= T.life) { fp_land(sp, h, [p[0], p[1], p[2]], null, speed, [0, -1, 0]); return; }          // (it did not meet anything in its time: it lies where it is)
        const look = Math.max(dt, 1 / 120) * FP_LOOK, ex = p[0] + v[0] * look, ey = p[1] + v[1] * look - 0.5 * FP_G * T.gravity * look * look, ez = p[2] + v[2] * look;
        const cx = ex - p[0], cy = ey - p[1], cz = ez - p[2], len = Math.hypot(cx, cy, cz);
        if (len > 1e-4) {
          const from = [p[0], p[1], p[2]], dir = [cx / len, cy / len, cz / len], range = len + T.radius;
          sp.fprops.stats.casts++;
          try {
            system.props_cast(sp, F.who.c, from, dir, range, function (shot) {
              if (h.released || h.flight !== F || F.mode !== 0 || !(shot.distance < range - 1e-3)) return;          // (it was let go, it has landed, or the chord was clear)
              F.hit = { from: from, dir: dir, d: shot.distance, target: shot.hit && shot.sp ? { sp: shot.sp, slot: shot.slot, gen: shot.gen } : null };
            });
          } catch (err) { sp.fprops.stats.errors++; fp_warn(sp, "its look ahead: " + (err && err.message || err)); }
        }
      }
      // once a frame: every flying and lying prop
      system.props_step = function (dt) {
        if (!(dt > 0)) dt = 1 / 60;
        dt = Math.min(Math.max(dt, 1 / 240), 0.1);
        const sl = fp_state.species;
        for (let k = 0; k < sl.length; k++) {
          const sp = sl[k], f = sp.fprops;
          if (sp.disposed || !f.fly.length) continue;
          for (let a = f.fly.length - 1; a >= 0; a--) { const h = f.fly[a]; if (h && !h.released && h.flight) fp_step_one(sp, h, dt); }
        }
      };

      // ========================================================================================================================
      // frame
      // ========================================================================================================================
// system.js, a part: the worker's frame record, and the commands into the engine's buffer once a frame.
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- the worker's frame record -------------------------------------------------------------------------------------------------------------------------
      system.rejected = 0; system.rig_work = 0; system.rig_deferred = 0; system.frames = 0; system.records = 0; system.last_event = null; system.on_event = null;
      const now = typeof performance !== "undefined" && performance.now ? function () { return performance.now(); } : function () { return Date.now(); };
      system.timing = { parse: 0, upload: 0, replies: 0, frames: 0 };
      const u32_view = new Uint32Array(2), f32_view = new Float32Array(u32_view.buffer);
      function on_event(kind, js, a, b) {
        const sp = species_map.get(js);
        if (kind === 1) { if (sp) { sp.built = true; sp.table_bytes = a; } }                                             // the family is built
        else if (kind === 2) { if (sp) sp.error = a || 1; if (typeof console !== "undefined") console.error("system: building species " + js + (sp ? " '" + sp.name + "'" : "") + " failed (code " + a + ")" + (a === 6 ? ": the worker has no family left (system.init({ max_species }): every species of its own is a family; a creature's props are not, the family draws them: runtime.js)" : "")); }
        else if (kind === 3) { system.rejected++; if (sp) sp.rejected++; }                                                  // a command was refused
        else if (kind === 5) {                                                                                           // a body came down on the floor (a jump, a fall): the count and the speed of the last landing, for sp.landings / sp.landing_speed
          const slot = a & 0xffff;
          if (sp && slot < sp.max_instances && sp.alive[slot] && sp.gen[slot] === (a >>> 16)) {
            if (!sp.lands) { sp.lands = new Uint32Array(sp.max_instances); sp.land_speed = new Float32Array(sp.max_instances); }
            sp.lands[slot]++; u32_view[0] = b; sp.land_speed[slot] = f32_view[0];
            if (sp.fx) system.fx_fire(sp, slot, 0, sp.land_speed[slot]);                                                    // (the dust of a landing: runtime.js)
          }
        }
        else if (kind === 6) {                                                                                           // an arm's world reach changed its state (sp.reach_state, sp.on_reach): a = slot | generation << 16, b = arm << 8 | state
          const slot = a & 0xffff, na = sp && sp.life && sp.life.arms ? sp.life.arms.length : 0, arm = b >>> 8;
          if (na && arm < na && slot < sp.max_instances && sp.alive[slot] && sp.gen[slot] === (a >>> 16)) {
            if (!sp.reach_st) sp.reach_st = new Uint8Array(sp.max_instances * na);
            sp.reach_st[slot * na + arm] = b & 255;
            if (typeof sp.on_reach === "function") sp.on_reach({ slot: slot, gen: a >>> 16 }, arm, b & 255);
          }
        }
        else if (kind === 7) { if (sp && system.on_grip_event) system.on_grip_event(sp, a, b); }                                  // a hand's grip began or ended (sp.gripping, sp.on_grip): a = slot | generation << 16, b = arm << 8 | state (1 holding, 0 let go, 2 ended by itself)
        else if (kind === 8) system.hit_event_shot(sp, js, a, b);                                                          // a hitscan ended (system.shoot, system.on_shot): a = the distance it went (the float's bits), b = the creature it hit (slot | generation << 16, 0xffffffff none)
        else if (kind === 12) system.hit_event_fall(sp, a, b);                                                              // a creature the hit zones brought down fell or stood up (system.on_fall, sp.fallen): a = slot | generation << 16, b = state | cause << 8 | speed x 10 << 16
        else if (kind === 10) system.hit_event_limb(sp, a, b);                                                               // a limb's state changed (system.on_limb, sp.limb_state): a = slot | generation << 16, b = zone | state << 8 | alpha (a byte) << 16
        else if (kind === 9) system.hit_event_hit(sp, a, b);                                                               // a hit zone took an impact (system.on_hit, sp.zone_health): a = slot | generation << 16, b = zone | damage x 10 << 8 | health (a byte) << 24
        else if (kind === 11) { if (sp && system.on_sit_event) system.on_sit_event(sp, a, b); }                                  // a rider's seat in the WORLD changed its phase (sp.sitting, sp.on_sit; species.js): a = slot | generation << 16, b = the phase (1 down, 2 seated, 3 up, 0 free)
        else if (kind === 4) { if (sp) { u32_view[0] = a; u32_view[1] = b; sp.reach = { half: f32_view[0], turn_r: f32_view[1] }; } }          // the legs' reach, as the rig measured it (model units): the stride that fits in it is the clock of the legs
        else if (kind === 15 || kind === 16 || kind === 17) system.vehicle_event(sp, a, b, kind);                                                // (the same telemetry: the speeds, and the sprung body's pitch, roll, yaw rate and heave: species.js)
        else if (kind === 14) system.vehicle_event(sp, a, b, 14);                                                                // a dynamic vehicle's telemetry (system.on_vehicle, sp.vehicle_state; species.js): a = slot | generation << 16, b = rpm / 2 | (gear + 1) << 15 | throttle << 19 | brake << 23 | what the tyres do << 27
        else if (kind === 13) system.flip_event(sp, a, b);                                                                 // a vehicle's rollover changed its state (system.on_flip, sp.flipped; species.js): a = slot | generation << 16, b = state (0 wheels, 1 rolling, 2 side, 3 roof) | quarter turns << 8
        system.last_event = [kind, js, a, b];
        if (system.on_event) system.on_event(kind, js, a, b, sp);
      }
      // u32 / f32: the response, i = the first word after the command id; returns the index after the command
      system.on_frame = function (u32, f32, i) {
        const t0 = now();
        if (system.grab_tasks && system.grab_tasks.length) system.grab_tick();                                                  // (the page's tasks of sp.grab: once a frame, from the frame the worker answers with)
        const n = u32[i++], end = i + n;
        system.frames = u32[i++];
        system.rig_work = u32[i++]; system.rig_deferred = u32[i++];                                              // (what the rig spent last frame in the worker's work units, and the solves its budget put off)
        const ne = u32[i++];
        for (let e = 0; e < ne; e++) { on_event(u32[i], u32[i + 1], u32[i + 2], u32[i + 3]); i += 4; }
        const nf = u32[i++];
        for (let k = 0; k < nf; k++) {
          const js = u32[i++], root_n = u32[i++], pose_n = u32[i++], floats = u32[i++], sp = species_map.get(js);
          if (!sp) { i += root_n * 9 + pose_n * (1 + floats); continue; }
          const m = sp.mirror, pose_base = sp.root_rows * W * 4;
          for (let r = 0; r < root_n; r++) {
            const h = u32[i++], slot = h & 0xffff;
            if (slot < sp.max_instances && sp.alive[slot] && sp.gen[slot] === (h >>> 16)) {
              const o = slot * 8;
              for (let q = 0; q < 8; q++) m[o + q] = f32[i + q];
              sp.dirty_root = true;
              if (sp.listed) { const d = sp.skin_list ? sp.skin_list[sp.skin_at[slot]] : sp; if (m[o + 3] === 0) list_remove(d, slot); else list_add(d, slot); }                 // (a root record whose scale is 0 says the instance is out of sight: it is not in the draw; another says it is: runtime.js)
            }
            i += 8;
          }
          for (let r = 0; r < pose_n; r++) {
            const h = u32[i++], slot = h & 0xffff;
            if (slot < sp.max_instances && sp.alive[slot] && sp.gen[slot] === (h >>> 16) && floats === sp.bone_count * 8) {
              const o = pose_base + slot * floats;
              for (let q = 0; q < floats; q++) m[o + q] = f32[i + q];
              sp.dirty_pose = true;
            }
            i += floats;
          }
          system.records += root_n + pose_n;
        }
        system.timing.parse += now() - t0; system.timing.replies++;
        return end;
      };

      // once per frame, before anything is drawn: the commands into the engine's buffer, the changed rows onto the GPU
      engine.on_frame_begin.add(function () {
        const t0 = now();
        cull_auto();                                                                                         // (culling is on by default: the engine's one perspective camera is found once there is one: runtime.js)
        drain();
        if (debug_clear > 0) { debug_clear--; if (engine.debug_list) engine.debug_list.length = 0; }
        for (let i = 0; i < list.length; i++) list[i].upload();
        system.timing.upload += now() - t0; system.timing.frames++;
      });
      system._drain = drain;
      system.W = W;
      system.pack_mesh = pack_mesh; system.skinned_shader = skinned_shader; system.SKINNING_MODES = SKINNING_MODES;
