packing("@/engine.js", "@/debug.js", "@/system/system.js")(function (engine, dom, httprequest) {
  // GAITS + ACTIONS DEMO (/demos/gaits_actions_demo.html): the motion libraries of system.bin on a lineup of twelve creatures (4 people, 4 animals, 2 dinosaurs, a spider, an ant) on a grid floor. EVERY creature plays a DIFFERENT gait
  // style (sp.set_style(name): a style of the libraries put on the legs while it walks; the creature walks in place on the treadmill, sp.set_treadmill) and then ACTIONS of the pack's action sets (designed_basic, designed_life, designed_dance,
  // mixamo, corpus_quadrupeds, corpus_dinosaurs, corpus_insects, corpus_birds), played through the creature's OWN worker function (`mind` below: api.action("<set>::<name>") and me.act(h), asked by sp.worker_send).
  // Every creature goes through its own list in turn (a gait, a gait, an action ... some start with an action) and they are staggered, so at any moment some walk in one style while others play an action.
  //   ?mode=both | gait | action     both (default): gaits and actions in turn      ?gait=<style>   every creature walks in this style (a style of the libraries: person_walk, wolf_trot, spider_run ...)
  //   ?action=<name>&set=<set>       every creature plays this action (an action of any body: ?set=designed_basic&action=wave)      ?slot=3     seconds of one step of the list (3)      ?labels=1   the name of the style or the action over each creature
  //   ?stats=1   the engine's numbers panel      ?atmosphere=1   the sky      ?shadows=0   no shadows      ?wire=1   wireframe      ?hold=1   do not stop at `done`: go on cycling (done is still set once)
  // `window.happy_demo` is what a test reads: { done, error, mode, creatures: [{ name, file, ok, error, gaits: [styles that were set], actions: [actions the worker began], rejected: [what was refused], now, step, ended }], applied, began, frames,
  //   moved: how many creatures' skeletons changed their pose between two looks (a gait or an action is playing) }.
  const CAST = [
    // people (the four of the front row): [file, x, z, scale, yaw, gaits, actions]
    ["knight", -4.6, 3.2, 1, -0.45, ["person_walk_strut", "mx_catwalk_walking", "person_walk_creeping"], ["designed_basic::bow", "designed_basic::slash", "designed_life::salute"]],
    ["punk_girl", -1.55, 3.2, 1, -0.45, ["person_walk_cheerful", "person_walk_happy_dance", "rl_panic_jog"], ["designed_basic::kick", "designed_dance::dance_disco", "designed_life::cheer_arms"]],
    ["zombie_soldier", 1.55, 3.2, 1, -0.45, ["rl_38_zombie_walk", "mx_zombie_running", "rl_34_limping_walk"], ["mixamo::mx_zombie_scratch_idle", "designed_basic::punch", "designed_basic::roar"]],
    ["grandmother", 4.6, 3.2, 1, -0.45, ["cmu_137_33_old_man_walk", "rl_15_limping_walk_2", "person_walk_relaxed"], ["designed_life::talk_calm", "designed_life::wave_big", "designed_life::stretch_up"]],
    // four legged and a bird (second row)
    ["wolf_animations_own_3620", -5.2, -1.4, 1, -0.45, ["wolf_walk", "wolf_trot_3", "wolf_fast_run"], ["corpus_quadrupeds::wolf_call", "corpus_quadrupeds::wolf_attack", "corpus_quadrupeds::wolf_eat_2"]],
    ["horse", -1.8, -1.4, 0.75, -0.45, ["horse_walk", "horse_trot", "horse_gallop"], ["corpus_quadrupeds::horse_emote", "corpus_quadrupeds::horse_jump", "corpus_quadrupeds::horse_idle"]],
    ["bear", 1.7, -1.4, 0.9, -0.45, ["bear_walk", "bear_crouch_walk", "bear_gallop"], ["corpus_quadrupeds::bear_attack", "corpus_quadrupeds::bear_emote_2", "corpus_quadrupeds::bear_eat"]],
    ["owl", 5.2, -1.4, 3, -0.45, ["owl_walk", "chicken_walk_2", "bird_run"], ["corpus_birds::owl_call", "corpus_birds::owl_flap_2", "corpus_birds::owl_idle"]],
    // dinosaurs, a spider and an ant (back row)
    ["trex", -5.4, -7.2, 0.5, -0.45, ["trex_walk", "trex_run", "tyrannosaurus_monster_walk"], ["corpus_dinosaurs::trex_attack", "corpus_dinosaurs::trex_call", "corpus_dinosaurs::trex_emote"]],
    ["parasaurolophus", -1.9, -7.2, 0.6, -0.45, ["parasaurolophus_walk", "parasaurolophus_run", "parasaurolophus_monster_walk"], ["corpus_dinosaurs::parasaurolophus_attack", "corpus_dinosaurs::parasaurolophus_hit", "corpus_dinosaurs::parasaurolophus_idle_2"]],
    ["spider", 1.7, -7.2, 1, -0.45, ["spider_walk_2", "spider_sting_run", "spider_monster_walk"], ["corpus_insects::spider_hit", "designed_basic::bite", "corpus_insects::spider_idle"]],
    ["ant", 5.2, -7.2, 4, -0.45, ["ant_walk", "ant_walk_2", "spider_run"], ["corpus_insects::ant_idle_2", "designed_basic::bite", "designed_basic::lunge"]]
  ];
  // how a creature goes through its list: g = the next gait of its own list, a = the next action; the even ones begin with a gait, the odd ones with an action pattern
  const PATTERN_A = "ggaga", PATTERN_B = "gagag";

  // The creature's own function (SENT to the worker as text: it holds nothing of this page, everything it uses is `api`; ES5). The page asks it with sp.worker_send:
  //   { kind: "play", slot, name: "<set>::<action>" }  looks the action up in the library (api.action), stops the creature and plays it (me.act)      { kind: "stop", slot }  stops the action
  // It tells the page what happens with me.say (the tag `began` with the handle, `ended` with how it ended) and with api.post for a refusal.
  const mind = function (api) {
    var T_BEGAN = api.tag("began"), T_ENDED = api.tag("ended");
    return {
      message: function (A, data) {
        var s = data.slot;
        if (data.kind === "stop") { try { A.at(s).act_stop(); } catch (e) { /* not live yet */ } return; }
        if (data.kind !== "play") return;
        try {
          var me = A.at(s), h = A.action(data.name);
          try { me.stop(); } catch (e) { /* a body that does not walk */ }
          me.act(h);
          me.say(T_BEGAN, h);
        } catch (e) {
          A.post("action_refused", { slot: s, name: data.name, error: String(e && e.message || e) });
        }
      },
      on: { end: function (me, how) { me.say(T_ENDED, how); } }
    };
  };

  function ready(engine) {
    const system = engine.system;
    const q = new URLSearchParams(location.search);
    const mode = q.get("mode") || "both", slot_s = +(q.get("slot") || 3), only_gait = q.get("gait"), only_action = q.get("action") ? (q.get("action").indexOf("::") >= 0 ? q.get("action") : (q.get("set") || "designed_basic") + "::" + q.get("action")) : null;
    const demo = window.happy_demo = { done: false, error: null, mode: mode, summary: [], applied: 0, began: 0, frames: 0, moved: 0, refused: [], creatures: [] };

    if (window.PR$ && q.get("stats") !== "1") window.PR$.style.display = "none";
    const scene = engine.debug.scene();
    scene.use_deffered_rendering({ ENABLE_ATMOSPHERE: q.get("atmosphere") === "1", ENABLE_SHADOWS: q.get("shadows") !== "0" });
    scene.on_shadow_pass.add(function () { system.render_all(); engine.debug.render(); });
    scene.on_render_pass.add(function () { engine.debug.grid.render_ground(); system.render_all(); engine.debug.render(); });
    const camera = scene.camera;
    camera.update_perspective(0.05, 1500, 60);
    camera.control.distance = +(q.get("dist") || 12.5);
    engine.tra_model.yaw_pitch(camera.control, 0.0, -0.45);
    engine.tra_model.set_position(camera.control, 0, 0.6, -1.5);

    const labels = document.createElement("div");
    labels.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:5";
    if (q.get("labels") === "1") document.body.appendChild(labels);
    function project(p) {
      const m = camera.view_projection_matrix, cv = engine.canvas || document.querySelector("canvas");
      if (!m || !cv) return null;
      const r = cv.getBoundingClientRect(), cx = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], cy = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], cw = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
      if (!(cw > 0)) return null;
      return [r.left + (cx / cw * 0.5 + 0.5) * r.width, r.top + (0.5 - cy / cw * 0.5) * r.height];
    }

    const crew = [];
    const note_refused = function (t) { if (demo.refused.length < 20) demo.refused.push(String(t).slice(0, 200)); };
    engine.happy_worker_action_refused = function (d) { note_refused((d && d.name) + ": " + (d && d.error)); const k = crew.filter(function (x) { return x.c && x.c.slot === d.slot; })[0]; if (k) { k.rec.rejected.push(d.name + " (" + String(d.error).slice(0, 80) + ")"); k.busy_until = 0; } };

    function begin_step(k, now) {                                                    // the creature's next step: a gait (set_style, then the treadmill) or an action (the worker plays it)
      const pat = (k.i % 2 === 0 ? PATTERN_A : PATTERN_B);
      let kind = pat.charAt(k.step % pat.length);
      if (mode === "gait") kind = "g"; else if (mode === "action") kind = "a";
      if (only_gait && kind === "g") k.gi = k.gi || 0;
      const rec = k.rec;
      k.step_t = now;
      if (kind === "g") {
        const list = only_gait ? [only_gait] : k.gaits, name = list[k.gi % list.length]; k.gi++;
        try {
          k.sp.set_style(name, { fade: 0.4 });
          if (rec.gaits.indexOf(name) < 0) rec.gaits.push(name); rec.gait_n++; rec.now = "gait " + name; demo.applied++;
          const st = system.gaits.get(name), speed = st && st.speed ? st.speed : 1;
          k.sp.set_treadmill(k.c, 0, speed * k.leg);
        } catch (e) { rec.rejected.push(name + " (" + String(e && e.message || e).slice(0, 100) + ")"); rec.now = "gait refused"; note_refused(name + ": " + (e && e.message || e)); }
      } else {
        const list = only_action ? [only_action] : k.actions, name = list[k.ai % list.length]; k.ai++;
        try { k.sp.set_treadmill(k.c, 0, 0); } catch (e) { /* no legs */ }
        rec.now = "action " + name;
        k.sp.worker_send({ kind: "play", slot: k.c.slot, name: name });
        k.playing = name;
      }
      rec.step = k.step; k.step++;
    }

    system.init({ table_bytes: 192 << 20, max_species: CAST.length + 4 });
    system.load("/system/system.bin", { all: true }).then(function () {
      let chain = Promise.resolve();
      CAST.forEach(function (cast, i) {
        chain = chain.then(function () {
          const rec = { name: cast[0], file: cast[0], ok: false, gaits: [], gait_n: 0, actions: [], action_n: 0, rejected: [], now: "", step: -1, ended: 0, drift: 0 };
          demo.creatures.push(rec);
          return httprequest.get_url("/system/creatures/" + cast[0] + ".js").then(function (text) {
            return system.make_creature(text, { max_instances: 1, mind: false, worker: mind });
          }).then(function (r) {
            if (q.get("wire") === "1") r.sp.set_wireframe(true);
            const c = r.sp.spawn({ x: cast[1], y: 0, z: cast[2], scale: cast[3], yaw: cast[4] });
            const k = { i: i, sp: r.sp, c: c, root: r.def.skeleton[0].name, tip: r.def.skeleton[Math.floor(r.def.skeleton.length * 0.7)].name, gaits: cast[5], actions: cast[6], gi: 0, ai: 0, step: 0, step_t: 0, rec: rec, leg: 0.9 * cast[3], playing: null, cast: cast, title: "" };
            r.sp.on_worker_event = function (slot, gen, tag, value) {
              if (tag === "began") { if (rec.actions.indexOf(k.playing) < 0) rec.actions.push(k.playing); rec.action_n++; demo.began++; }
              else if (tag === "ended") rec.ended++;
            };
            crew.push(k);
            rec.ok = true;
            rec.legs = r.sp.legs ? r.sp.legs.legs.length : 0; rec.bones = r.def.skeleton.length; rec.triangles = r.def.mesh ? r.def.mesh.indices.length / 3 : (r.sp.mesh && r.sp.mesh.indices ? r.sp.mesh.indices.length / 3 : undefined);
          }).catch(function (e) { rec.error = String(e && e.message || e).slice(0, 240); });
        });
      });
      return chain;
    }).then(function () {
      if (!crew.length) { demo.error = "no creature could be made: " + JSON.stringify(demo.creatures).slice(0, 500); demo.done = true; return; }
      let started = 0, last_look = 0, poses = {};
      engine.on_frame.add(function () {
        demo.frames++;
        const now = performance.now() / 1000;
        if (demo.frames < 30) return;                                                // (the worker has made the columns of its family by now: it can be told things)
        if (!started) {
          started = now;
          crew.forEach(function (k) {                                                // (the walking height of the root bone = about one leg length: the treadmill's speed is in leg lengths a second)
            try { const p = k.sp.bone_world(k.c, k.root); if (p && p[1] > 0.05) k.leg = p[1]; } catch (e) { /* keep the estimate */ }
          });
        }
        crew.forEach(function (k) {
          const t = now - started - k.i * 0.45;                                       // (staggered)
          if (t < 0) return;
          if (k.step_t === 0 || t - k.rel >= slot_s) {
            if (k.step_t !== 0 && k.playing) { try { k.sp.worker_send({ kind: "stop", slot: k.c.slot }); } catch (e) { /* gone */ } k.playing = null; }
            k.rel = t; begin_step(k, now);
          }
        });
        if (q.get("labels") === "1" && demo.frames % 6 === 0) {
          labels.innerHTML = "";
          crew.forEach(function (k) {
            const p = k.sp.bone_world(k.c, k.root); if (!p) return;
            const s = project([p[0], p[1] + 0.5 * k.cast[3] + 0.5, p[2]]); if (!s) return;
            const e = document.createElement("div"); e.textContent = k.rec.now.replace(/ [a-z_]+::/, " ");
            e.style.cssText = "position:fixed;transform:translate(-50%,-100%);left:" + s[0] + "px;top:" + s[1] + "px;font:11px monospace;color:#fff;background:rgba(0,0,0,0.6);padding:1px 3px;white-space:nowrap";
            labels.appendChild(e);
          });
        }
        if (now - last_look > 0.5 && demo.frames > 40) {                              // (do they move: the pose of a creature's bones, two looks apart)
          last_look = now; let moved = 0;
          crew.forEach(function (k) {
            let a = null, b = null; try { a = k.sp.bone_world(k.c, k.tip); } catch (e) { a = null; }
            if (a) { const prev = poses[k.i]; if (prev && Math.hypot(a[0] - prev[0], a[1] - prev[1], a[2] - prev[2]) > 0.004) moved++; poses[k.i] = a; }
          });
          demo.moved = Math.max(demo.moved, moved);
        }
        if (demo.frames % 10 === 0) crew.forEach(function (k) { try { const p = k.sp.bone_world(k.c, k.root); if (p) { if (k.p0 === undefined) k.p0 = p; k.rec.drift = +Math.hypot(p[0] - k.p0[0], p[2] - k.p0[2]).toFixed(2); k.rec.y = +p[1].toFixed(2); } } catch (e) { /* gone */ } });
        const all_in = crew.every(function (k) { return k.step >= 4 && (mode === "gait" || k.rec.action_n >= 1 || k.rec.rejected.length > 0); });
        if (!demo.done && all_in) {
          demo.summary = crew.map(function (k) { return k.rec.file.replace(/_own_[0-9a-f]+$/, "") + " styles " + k.rec.gait_n + " (" + k.rec.gaits.length + " kinds) actions " + k.rec.action_n + " (" + k.rec.actions.length + " kinds) ended " + k.rec.ended + " drift " + k.rec.drift + (k.rec.rejected.length ? " REFUSED " + k.rec.rejected.length : ""); });
          demo.done = true;
          console.log("happy.demo: " + crew.length + " creatures, " + demo.applied + " styles set, " + demo.began + " actions begun");
        }
      });
    }).catch(function (e) { demo.error = String(e && e.stack || e); console.error("happy.demo: " + demo.error); demo.done = true; });
  }

  engine({})(ready);
});
