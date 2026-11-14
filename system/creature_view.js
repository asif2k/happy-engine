packing("@/engine.js", "@/debug.js", "@/system/system.js")(function (engine, dom, httprequest) {
  // CREATURE VIEW (/system/creature_view.html?file=troll_mauler&yaw=0.6&pitch=-0.12&dist=6&walk=0): one creature file of system/creatures/ on a grid floor, standing or walking in place (the treadmill). window.happy_demo.done when it is drawn.
  function ready(engine) {
    const system = engine.system, q = new URLSearchParams(location.search);
    const demo = window.happy_demo = { done: false, error: null, frames: 0 };
    if (window.PR$) window.PR$.style.display = "none";
    const scene = engine.debug.scene();
    scene.use_deffered_rendering({ ENABLE_ATMOSPHERE: false, ENABLE_SHADOWS: true });
    scene.on_shadow_pass.add(function () { system.render_all(); engine.debug.render(); });
    scene.on_render_pass.add(function () { engine.debug.grid.render_ground(); system.render_all(); engine.debug.render(); });
    scene.camera.control.distance = +(q.get("dist") || 6);
    engine.tra_model.yaw_pitch(scene.camera.control, +(q.get("yaw") || 0.6), +(q.get("pitch") || -0.12));
    engine.tra_model.set_position(scene.camera.control, 0, +(q.get("ty") || 0), 0);
    system.init({ table_bytes: 128 << 20, max_species: 4 });
    system.load("/system/system.bin", { all: true }).then(function () {
      return httprequest.get_url("/system/creatures/" + (q.get("file") || "troll_mauler") + ".js");
    }).then(function (text) { return system.make_creature(text, { max_instances: 2 }); }).then(function (r) {
      const c = r.sp.spawn({ x: 0, y: 0, z: 0, scale: 1, yaw: +(q.get("turn") || 0) });
      demo.sp = r.sp; demo.c = c;
      if (q.get("walk") === "1") r.sp.set_intent(c, 0, 1.0, 0, 0);
      engine.on_frame.add(function () { demo.frames++; if (demo.frames > 120) demo.done = true; });
    }).catch(function (e) { demo.error = String(e && e.stack || e); demo.done = true; });
  }
  engine({})(ready);
});
