packing("@/engine.js", "@/debug.js", "@/system/system.js")(function (engine, dom, httprequest) {
  // VEHICLES DEMO (/demos/vehicles_demo.html): wheeled creatures with a DYNAMIC chassis (`vehicle: { realism: true }`: a spring and a damper at every wheel, an engine, a gearbox that shifts by itself, tyres that make their forces from
  // their slip; SYSTEM.md "Vehicles with suspension and an engine"). Five cars of system/creatures/ (hatchback, sedan, pickup, sports_car, jeep) drive round on their own, each on a lane of its own of a round track, on a grid floor: an
  // AUTOPILOT drives them (no UI): the controls are the ones a driver gives (sp.set_controls(c, { throttle, brake, steer })): the throttle holds a speed (a proportional controller on the speed the worker reports: sp.vehicle_state), the
  // steering is what the lane's radius says (the wheelbase and the car's own `max_steer`) with a little correction for the way it has drifted from the lane.
  //   ?cars=hatchback,sedan,pickup,sports_car,jeep   which files (names in system/creatures/, no .js)      ?omega=0.42   how fast they go round (rad/s: a car's speed is omega x the radius of its lane)
  //   ?r0=8   ?dr=3.2   the radius of the first lane and the step between lanes      ?cam=overview | chase      ?car=0   which car the chase camera follows      ?dist=   the camera's distance
  //   ?stats=1   the engine's numbers panel      ?atmosphere=1   the sky      ?shadows=0   no shadows      ?wire=1   wireframe
  // `window.happy_demo` is what a test reads: { done, error, cars: [{ name, ok, error, realism, wheels, mass, radius, target, speed (m/s, last report), max_speed, rpm, gear, pitch, roll (degrees), sliding, travelled (radians round the track), lane_error (mean |distance - radius| in metres) }], frames }.
  const FILES = ["hatchback", "sedan", "pickup", "sports_car", "jeep"];

  function ready(engine) {
    const system = engine.system;
    const q = new URLSearchParams(location.search);
    const files = q.get("cars") ? q.get("cars").split(",") : FILES, omega = +(q.get("omega") || 0.42), r0 = +(q.get("r0") || 8), dr = +(q.get("dr") || 3.2), cam = q.get("cam") === "chase" ? "chase" : "overview", chase_i = +(q.get("car") || 0);
    const demo = window.happy_demo = { done: false, error: null, cars: [], frames: 0 };

    if (window.PR$ && q.get("stats") !== "1") window.PR$.style.display = "none";
    const scene = engine.debug.scene();
    scene.use_deffered_rendering({ ENABLE_ATMOSPHERE: q.get("atmosphere") === "1", ENABLE_SHADOWS: q.get("shadows") !== "0" });
    scene.dfd.transparent.mode = "target";
    scene.on_shadow_pass.add(function () { system.render_all(); });
    scene.on_render_pass.add(function () { engine.debug.grid.render_ground(); system.render_all(); });
    system.transparent(scene.dfd);                                                   // (the glass of a car: the transparent pass)
    const camera = scene.camera, ctl = camera.control;
    camera.update_perspective(0.05, 800, 50);
    const R_out = r0 + dr * (files.length - 1);
    ctl.distance = +(q.get("dist") || (cam === "chase" ? 14 : R_out * 1.45 + 4));
    engine.tra_model.yaw_pitch(ctl, cam === "chase" ? 0.5 : 0.35, cam === "chase" ? -0.3 : -0.8);
    engine.tra_model.set_position(ctl, 0, 0.5, 0);

    const cars = [];
    system.init({ table_bytes: 128 << 20, max_species: files.length + 4 });
    system.load("/system/system.bin", { all: true }).then(function () {
      let chain = Promise.resolve();
      files.forEach(function (name, i) {
        chain = chain.then(function () {
          const rec = { name: name, ok: false, max_speed: 0 };
          demo.cars.push(rec);
          return httprequest.get_url("/system/creatures/" + name + ".js").then(function (text) {
            return system.make_creature(text, { max_instances: 1, mind: false });
          }).then(function (r) {
            const v = r.sp.vehicle;
            if (!v) throw new Error(name + " has no vehicle");
            if (q.get("wire") === "1") r.sp.set_wireframe(true);
            const R = r0 + dr * i, a0 = (i * 2 * Math.PI / files.length) * 0.5;              // (a lane's radius and where on it the car starts: the cars are spread round the track)
            // the car starts on its lane at the angle a0, facing the way it goes, and the middle of the track is on its LEFT (a left turn: + steer). A creature at yaw faces (sin yaw, cos yaw) in (x, z) and its left is (cos yaw, -sin yaw); the left must point at the middle: (-cos a, -sin a), so yaw = pi - a
            const x = R * Math.cos(a0), z = R * Math.sin(a0), yaw = Math.PI - a0;
            const c = r.sp.spawn({ x: x, y: 0, z: z, scale: 1, yaw: yaw });
            const wb = (function () {                                                          // the wheelbase: the distance between the front and the rear wheel bones
              const b = r.def.skeleton, find = function (n) { return b.filter(function (s) { return s.name === n; })[0]; };
              const f = find(v.wheels[0].bone), rr = v.wheels.map(function (w) { return find(w.bone); }).filter(function (s) { return s && s.head[2] < f.head[2] - 0.5; })[0];
              return rr ? Math.abs(f.head[2] - rr.head[2]) : 2.7;
            })();
            const k = { i: i, sp: r.sp, c: c, root: r.def.skeleton[0].name, R: R, wb: wb, target: omega * R, thr: 0, steer: 0, max_steer: v.max_steer || 0.55, st: null, ang: a0, ang0: a0, est: 0, travelled: 0, err_sum: 0, err_n: 0, rec: rec };
            rec.ok = true; rec.realism = !!v.real; rec.wheels = v.wheels.length; rec.mass = v.real ? Math.round(v.real.mass) : (r.def.physics && r.def.physics.mass) || null;
            rec.radius = R; rec.target = +k.target.toFixed(2); rec.wheelbase = +wb.toFixed(2); rec.max_steer = k.max_steer;
            rec.triangles = r.sp.index_data ? r.sp.index_data.length / 3 : undefined; rec.seats = r.sp.seat_defs && r.sp.seat_defs.seat_names ? r.sp.seat_defs.seat_names.length : 0; rec.doors = r.sp.seat_defs && r.sp.seat_defs.door_names ? r.sp.seat_defs.door_names.length : 0;
            cars.push(k);
          }).catch(function (e) { rec.error = String(e && e.message || e).slice(0, 240); });
        });
      });
      return chain;
    }).then(function () {
      if (!cars.length) { demo.error = "no car could be made: " + JSON.stringify(demo.cars).slice(0, 500); demo.done = true; return; }
      let last = 0;
      engine.on_frame.add(function () {
        demo.frames++;
        const now = performance.now() / 1000, dt = Math.min(0.1, last ? now - last : 0.05); last = now;
        if (demo.frames < 15) return;                                                  // (the worker has the species by now)
        cars.forEach(function (k) {
          let p = null; try { p = k.sp.bone_world(k.c, k.root); } catch (e) { p = null; }
          if (!p) return;
          let st = null; try { st = k.sp.vehicle_state(k.c); } catch (e) { st = null; }
          if (st) { k.st = st; k.rec.speed = +st.speed.toFixed(2); k.rec.rpm = Math.round(st.rpm); k.rec.gear = st.gear; k.rec.pitch = +(st.pitch * 57.296).toFixed(1); k.rec.roll = +(st.roll * 57.296).toFixed(1); k.rec.sliding = !!st.sliding; if (st.speed > k.rec.max_speed) k.rec.max_speed = +st.speed.toFixed(2); }
          if (q.get("trace") === "1" && demo.frames % 12 === 0) { (k.rec.trace = k.rec.trace || []).push([+p[0].toFixed(1), +p[2].toFixed(1), k.st ? +k.st.speed.toFixed(1) : null, +k.steer.toFixed(2)]); }
          const d = Math.hypot(p[0], p[2]), ang = Math.atan2(p[2], p[0]);
          let da = ang - k.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
          k.travelled += da; k.ang = ang; k.rec.travelled = +Math.abs(k.travelled).toFixed(2);
          if (k.px !== undefined && dt > 0) k.est += (Math.hypot(p[0] - k.px, p[2] - k.pz) / dt - k.est) * Math.min(1, dt * 3);     // (the speed from the places, for a car that reports none: the kinematic one)
          k.px = p[0]; k.pz = p[2];
          const speed = st ? st.speed : k.est, err = d - k.R;
          if (!st) k.rec.speed = +k.est.toFixed(2);
          if (speed > 2) { k.err_sum += Math.abs(err); k.err_n++; k.rec.lane_error = +(k.err_sum / k.err_n).toFixed(2); }
          // the throttle holds the lane's speed; the steering is the radius' (a bicycle model) with a correction for the drift from the lane (outside it: more to the left)
          const e_v = k.target - speed, want_thr = Math.max(0, Math.min(1, 0.12 + 0.3 * e_v)), want_brk = e_v < -1 ? Math.min(1, 0.25 * (-e_v - 1)) : 0;
          const want_steer = Math.max(-1, Math.min(1, Math.atan(k.wb / k.R) / k.max_steer + 0.1 * err));
          k.thr += (want_thr - k.thr) * Math.min(1, dt * 6); k.steer += (want_steer - k.steer) * Math.min(1, dt * 5);
          try { k.sp.set_controls(k.c, { throttle: speed < 0.5 ? 1 : k.thr, brake: want_brk, steer: k.steer, handbrake: 0 }); } catch (e) { /* not live yet */ }
        });
        if (cam === "chase" && cars[chase_i]) {                                         // (the chase camera: on the car, a little behind it)
          const k = cars[chase_i]; let p = null; try { p = k.sp.bone_world(k.c, k.root); } catch (e) { p = null; }
          if (p) engine.tra_model.set_position(ctl, p[0], 0.6, p[2]);
          if (p) engine.tra_model.yaw_pitch(ctl, Math.atan2(p[0], p[2]) * 0 + 0.6 + (Math.PI - Math.atan2(p[2], p[0])), -0.3);
        }
        const moving = cars.every(function (k) { return k.rec.speed > k.target * 0.7 && Math.abs(k.travelled) > 0.5; });
        if (!demo.done && (moving && demo.frames > 120 || demo.frames > 1500)) {
          demo.done = true;
          console.log("happy.demo: " + cars.length + " cars on the track, speeds " + cars.map(function (k) { return k.rec.speed; }).join(" "));
        }
      });
    }).catch(function (e) { demo.error = String(e && e.stack || e); console.error("happy.demo: " + demo.error); demo.done = true; });
  }

  engine({})(ready);
});
