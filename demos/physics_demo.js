packing("@/engine.js", "@/debug.js", "@/system/system.js")(function (engine, dom, httprequest) {
  // PHYSICS DEMO (/demos/physics_demo.html): the engine's physics world (engine.phy, the worker's fixed 1/60 s steps) with a script that runs on its own, and creatures in the same world.
  //   RAIN        spheres, boxes and capsules dropped onto the floor from different heights: they land, roll, settle and fall asleep
  //   WALL        a wall of 39 bricks in a running bond; at T = 3 s a heavy ball is thrown at it (?wrecker=0: nobody throws, the wall stays up)
  //   JOINTS      a pendulum on a rigid rod (distance joint to the world), a chain of four capsules (ball joints), a door on a hinge (hinge joint with limits) that a ball is thrown at
  //   RAYS        a fan of nine rays (phy.world_raycast) from a sensor in front of the wall: the lines go to what they hit, the hit points are dots; the distances are in the state
  //   CREATURES   three knights (system.make_creature with hit zones): A stands in the world as a DYNAMIC proxy and is hit by a heavy crate at T = 4 s, B is shot with system.shoot (a hitscan into its hit zones) from
  //               T = 3 s, C falls as a ragdoll (sp.ragdoll) at T = 2 s. The red shapes are the proxies of the physics world (system.debug({ shapes: true }))
  // Left drag turns the camera, right drag pans, the wheel zooms.
  //   ?wrecker=0     no ball thrown at the wall      ?creatures=0    no creatures (loads faster)      ?gravity=9.81      the world's gravity      ?atmosphere=0  ?shadows=0  ?sun_azimuth=60  ?sun_elevation=42  as the render demo (the sky is on by default)      ?stats=1   the engine's panel
  //   ?proxy=0       do not draw the creatures' proxies      ?until=9    the script's seconds (done is set when the world has run that long)      ?creature=knight    the file of system/creatures/
  // `window.happy_demo` is what a test reads: { done, error, t, frames, bodies, rain: [...], wall: { before, after, fallen }, pendulum, chain, door, rays, creatures: { a, b, c }, ... }.
  const q = new URLSearchParams(location.search);
  const num = function (k, d) { const v = parseFloat(q.get(k)); return isFinite(v) ? v : d; };
  const r2 = function (v) { return Math.round(v * 100) / 100; };

  function ready(engine) {
    const system = engine.system, phy = engine.phy;
    const demo = window.happy_demo = { done: false, error: null, t: 0, frames: 0, bodies: 0, joints: 0, wrecker: q.get("wrecker") !== "0", creatures_on: q.get("creatures") !== "0" };
    if (window.PR$ && q.get("stats") !== "1") window.PR$.style.display = "none";
    try {
      const scene = engine.debug.scene();
      scene.use_deffered_rendering({ ENABLE_ATMOSPHERE: q.get("atmosphere") !== "0", ENABLE_SHADOWS: q.get("shadows") !== "0" });
      const sun_az = num("sun_azimuth", 60) * Math.PI / 180, sun_el = num("sun_elevation", 42) * Math.PI / 180;      // (the sun, as the render demo: fw_vector = the way TO the sun)
      engine.tra_model.set_eular(scene.dlight0, -sun_el, Math.atan2(Math.cos(sun_az), Math.sin(sun_az)), 0);
      scene.camera.control.distance = num("distance", 12);
      engine.tra_model.yaw_pitch(scene.camera.control, 0.45, -0.58);
      engine.tra_model.set_position(scene.camera.control, 0, 1, 1.5);
      const until = num("until", 9);

      phy.set_world({ gravity: [0, -num("gravity", 9.81), 0], solver_iterations: 16 });

      // ---- bodies ------------------------------------------------------------------------------------------------------------------------------------------------------------------
      const items = [];       // { name, kind: "sphere" | "box" | "capsule", body, d: { r | hx, hy, hz | r, h }, color, group }
      const make = function (name, group, kind, x, y, z, d, color, o) {
        o = o || {};
        const body = phy.body({ type: o.type || PHS_BODY_DYNAMIC, pos: [x, y, z] });
        const shp = kind === "sphere" ? phy.shape_sphere(d.r) : kind === "box" ? phy.shape_box(d.hx, d.hy, d.hz) : phy.shape_capsule(d.r, d.h);
        phy.shape_material(shp, o.density || 1, o.friction === undefined ? 0.6 : o.friction, o.restitution === undefined ? 0.15 : o.restitution);
        phy.body_add_shape(body, shp);
        phy.body_setup_mass(body);
        if (o.rot) phy.body_set_orientation(body, o.rot[0], o.rot[1], o.rot[2], o.rot[3]);
        const it = { name: name, group: group, kind: kind, body: body, d: d, color: color, x0: x, y0: y, z0: z };
        items.push(it);
        return it;
      };
      const yaw_q = function (a) { return [0, Math.sin(a / 2), 0, Math.cos(a / 2)]; };

      // RAIN: three columns of eight, dropped from 3 to 14 m
      const rain = [];
      for (let i = 0; i < 18; i++) {
        const col = i % 3, k = Math.floor(i / 3), x = -9 + col * 1.5 + (k % 2) * 0.4, z = -3 + k * 1.1, y = 3 + (i * 7) % 12 + 0.5;
        if (col === 0) rain.push(make("rain_sphere_" + k, "rain", "sphere", x, y, z, { r: 0.45 }, [0.95, 0.6 + 0.05 * k, 0.2], { restitution: 0.45 }));
        else if (col === 1) rain.push(make("rain_box_" + k, "rain", "box", x, y, z, { hx: 0.4, hy: 0.3, hz: 0.5 }, [0.3, 0.6, 0.95 - 0.05 * k], { rot: yaw_q(k * 0.7) }));
        else rain.push(make("rain_capsule_" + k, "rain", "capsule", x, y, z, { r: 0.3, h: 0.8 }, [0.5, 0.85, 0.4 + 0.08 * k], { rot: [0.3, 0, 0.2, 0.93] }));
      }

      // WALL
      const wall = [], ROWS = 6;
      for (let r = 0; r < ROWS; r++) {                                              // even rows: six bricks; odd rows: five bricks and a half brick at each end (a running bond)
        const odd = r % 2, y = 0.25 + r * 0.5, col = [0.72 - 0.05 * odd, 0.35, 0.28], o = { friction: 0.7, restitution: 0 };
        if (!odd) for (let c = 0; c < 6; c++) wall.push(make("brick_" + r + "_" + c, "wall", "box", c - 2.5, y, 0, { hx: 0.5, hy: 0.25, hz: 0.25 }, [col[0], col[1] + 0.04 * (c % 2), col[2]], o));
        else {
          for (let c = 0; c < 5; c++) wall.push(make("brick_" + r + "_" + c, "wall", "box", c - 2, y, 0, { hx: 0.5, hy: 0.25, hz: 0.25 }, [col[0], col[1] + 0.04 * (c % 2), col[2]], o));
          wall.push(make("brick_" + r + "_l", "wall", "box", -2.75, y, 0, { hx: 0.25, hy: 0.25, hz: 0.25 }, col, o));
          wall.push(make("brick_" + r + "_r", "wall", "box", 2.75, y, 0, { hx: 0.25, hy: 0.25, hz: 0.25 }, col, o));
        }
      }
      demo.wall = { bricks: wall.length, top0: 0 };

      // JOINTS
      const joints = [];
      // pendulum: a heavy ball on a rigid rod 2.5 m long from a point of the world 5.5 m up
      const pend = make("pendulum_ball", "joint", "sphere", 8.5, 5.5, -3, { r: 0.55 }, [0.9, 0.2, 0.25], { density: 3, restitution: 0.1 });
      phy.body_allow_sleep(pend.body, false);
      joints.push({ name: "pendulum", j: phy.joint_distance(null, pend.body, [6, 5.5, -3], { anchor_b: [8.5, 5.5, -3], length: 2.5 }), a: [6, 5.5, -3], body: pend });
      // chain: four capsules hung one under the other by ball joints, the first from the world
      const links = [];
      for (let i = 0; i < 4; i++) {
        const it = make("chain_" + i, "joint", "capsule", 2, 5.5 - i * 1.0, -6, { r: 0.16, h: 0.7 }, [0.95, 0.85 - 0.12 * i, 0.3], { density: 2 });
        phy.body_allow_sleep(it.body, false);
        links.push(it);
      }
      joints.push({ name: "chain_0", j: phy.joint_ball(null, links[0].body, [2, 6, -6], { cone: 70 }), a: [2, 6, -6], body: links[0] });
      for (let i = 1; i < 4; i++) joints.push({ name: "chain_" + i, j: phy.joint_ball(links[i - 1].body, links[i].body, [2, 6 - i, -6], { cone: 70 }), a: null, body: links[i] });
      phy.body_set_velocity(links[3].body, 5, 0, 0);
      // door: a slab on a vertical hinge at its left edge (limits -100 .. 100 degrees)
      const door = make("door", "joint", "box", -4.5 + 0.9, 1.1, -6, { hx: 0.9, hy: 1.1, hz: 0.07 }, [0.55, 0.38, 0.22], { density: 1.2 });
      phy.body_allow_sleep(door.body, false);
      joints.push({ name: "door", j: phy.joint_hinge(null, door.body, [-4.5, 1.1, -6], { axis: [0, 1, 0], limits: [-100, 100] }), a: [-4.5, 1.1, -6], body: door });
      demo.joints = joints.length;

      // thrown things (made when it is time): the wrecker, the ball at the door, the crate at creature A
      const wrecker = make("wrecker", "thrown", "sphere", 0, -50, 0, { r: 0.8 }, [0.25, 0.25, 0.3], { density: 4, restitution: 0.1 });
      const door_ball = make("door_ball", "thrown", "sphere", 0, -52, 0, { r: 0.35 }, [0.95, 0.9, 0.3], { density: 6 });
      const crate = make("crate", "thrown", "box", 0, -54, 0, { hx: 0.4, hy: 0.4, hz: 0.4 }, [0.8, 0.55, 0.2], { density: 300 });
      [wrecker, door_ball, crate].forEach(function (it) { phy.body_set_position(it.body, 0, -50, 0); phy.body_allow_sleep(it.body, false); });
      [wrecker, door_ball, crate].forEach(function (it) { it.hidden = true; phy.body_park(it.body); });

      demo.bodies = items.length;

      // ---- rays: a fan of nine from the sensor -------------------------------------------------------------------------------------------------------------------------------------------
      const SENSOR = [0, 1.2, 12], rays = [];
      for (let i = 0; i < 9; i++) {
        const a = (i - 4) * 0.06, rc = phy.raycast_hit();
        rays.push({ rc: rc, dir: [Math.sin(a), 0, -Math.cos(a)], first: null });
      }
      const down = phy.raycast_hit();                // one more, straight down onto the pendulum's ball from above
      const by_uuid = {};
      items.forEach(function (it) { by_uuid[it.body.uuid] = it; });

      // ---- drawing -----------------------------------------------------------------------------------------------------------------------------------------------------------------
      const capsule_meshes = {};
      const capsule_mesh = function (d) {
        const key = d.r + "/" + d.h;
        return capsule_meshes[key] || (capsule_meshes[key] = engine.debug.mesh({ geo: engine.geometries.capsule(d.r, d.h, 12, 6), material: { uniforms: { u_roughness: 0.55, u_metallic: 0.1 } } }));
      };
      const boxes = engine.debug.mesh({ geo: engine.geometries.cube(1, 1, 1, 1), material: { uniforms: { u_roughness: 0.8, u_metallic: 0 } } });
      const spheres = engine.debug.mesh({ geo: engine.geometries.sphere(1, 20, 14), material: { uniforms: { u_roughness: 0.4, u_metallic: 0.2 } } });
      items.forEach(function (it) { if (it.kind === "capsule") capsule_mesh(it.d); });
      const asleep_tint = [0.82, 0.82, 0.86];
      const queue = function () {
        for (let n = 0; n < items.length; n++) {
          const it = items[n];
          if (it.hidden) continue;
          const sh = it.body.shapes[0], p = sh.world_position, qu = sh.world_rotation, d = it.d;
          const asleep = ((it.body.world_position[3] | 0) & PHS_BODY_SLEEPING) !== 0, c = it.color, k = asleep ? 0.8 : 1;
          if (it.kind === "sphere") spheres.set_color(c[0] * k, c[1] * k, c[2] * k).add(p[0], p[1], p[2], d.r, d.r, d.r, qu[0], qu[1], qu[2], qu[3]);
          else if (it.kind === "box") boxes.set_color(c[0] * k, c[1] * k, c[2] * k).add(p[0], p[1], p[2], d.hx * 2, d.hy * 2, d.hz * 2, qu[0], qu[1], qu[2], qu[3]);
          else capsule_mesh(d).set_color(c[0] * k, c[1] * k, c[2] * k).add(p[0], p[1], p[2], 1, 1, 1, qu[0], qu[1], qu[2], qu[3]);
        }
        // joints: a line from where it is fixed to the body, the hinge pin
        joints.forEach(function (J) {
          const b = J.j.anchor_b, a = J.j.anchor_a;
          if (J.name === "pendulum") engine.debug_lines.add(J.a[0], J.a[1], J.a[2], 1, 1, 0.2, J.body.body.world_position[0], J.body.body.world_position[1], J.body.body.world_position[2], 1, 1, 0.2);
          if (J.name === "door") engine.debug_lines.add(-4.5, 0, -6, 0.2, 1, 0.2, -4.5, 2.2, -6, 0.2, 1, 0.2);
          engine.debug_points.add(a[0], a[1], a[2], 0.2, 1, 1, 5);
        });
        // rays
        rays.forEach(function (R) {
          const hit = R.rc.position_distance[3] > 0, pd = R.rc.position_distance;
          const ex = hit ? pd[0] : SENSOR[0] + R.dir[0] * 30, ey = hit ? pd[1] : SENSOR[1], ez = hit ? pd[2] : SENSOR[2] + R.dir[2] * 30;
          engine.debug_lines.add(SENSOR[0], SENSOR[1], SENSOR[2], 0.3, 1, 0.4, ex, ey, ez, hit ? 1 : 0.3, hit ? 0.3 : 1, 0.3);
          if (hit) engine.debug_points.add(ex, ey, ez, 1, 0.2, 0.2, 5);
        });
        engine.debug_points.add(SENSOR[0], SENSOR[1], SENSOR[2], 0.3, 1, 0.4, 9);
      };
      const render = function () { boxes.render(); spheres.render(); for (const k in capsule_meshes) capsule_meshes[k].render(); };
      engine.on_frame_begin.add(queue);
      scene.on_shadow_pass.add(function () { render(); system.render_all(); });
      scene.on_render_pass.add(function () { engine.debug.grid.render_ground(); render(); system.render_all(); engine.debug.render(); });
      // (the debug meshes of the bodies are cleared with engine.debug.clear at the end of the frame only for the engine's own: ours are cleared here)
      engine.on_frame_end.add(function () { boxes.clear(); spheres.clear(); for (const k in capsule_meshes) capsule_meshes[k].clear(); });

      // ---- creatures -----------------------------------------------------------------------------------------------------------------------------------------------------------------
      const cr = demo.creatures = { loaded: false, error: null, hits: 0, shots_asked: 0, shots_hit: 0, last_shot: null };
      const knights = {};
      const root_y = function (k) { try { const p = k.sp.bone_world(k.c, k.root); return p ? p : null; } catch (e) { return null; } };
      const creatures_ready = demo.creatures_on ? (function () {
        system.init({ table_bytes: 128 << 20, max_species: 8 });
        return system.load("/system/system.bin", { all: true }).then(function () {
          return httprequest.get_url("/system/creatures/" + (q.get("creature") || "knight") + ".js");
        }).then(function (text) {
          return system.make_creature(text, { name: "phy_person", max_instances: 4, hit: true });
        }).then(function (r) {
          const at = { a: [4.2, 0, 4, -1.57], b: [-3, 0, 5, 3.14], c: [2.4, 0, 7, 3.14] };
          ["a", "b", "c"].forEach(function (id) {
            const p = at[id], c = r.sp.spawn({ x: p[0], y: p[1], z: p[2], scale: 1, yaw: p[3] });
            knights[id] = { sp: r.sp, c: c, root: r.def.skeleton[0].name, x0: p[0], z0: p[2], id: id };
          });
          cr.loaded = true; cr.has_hit = !!r.sp.has_hit; cr.has_ragdoll = !!r.sp.has_ragdoll; cr.physics = r.sp.physics ? { mode: r.sp.physics.mode, mass: r.sp.physics.mass, shapes: r.sp.physics.shapes.length } : null;
          if (r.sp.physics) r.sp.set_physics(knights.a.c, "dynamic");
          if (q.get("proxy") !== "0") system.debug({ shapes: true });
          system.on_hit = function (sp, c, zone, damage, health) { cr.hits++; cr.last_hit = { zone: zone, damage: r2(damage), health: r2(health) }; };
          system.on_fall = function (sp, c, state, cause, speed) { cr.fall_events = (cr.fall_events || 0) + 1; cr.last_fall = { state: state, speed: r2(speed) }; };
        }).catch(function (e) { cr.error = String(e && e.message || e).slice(0, 300); });
      })() : Promise.resolve();

      // ---- the script: the clock is the sum of the frames' times, as the world sees them (at most four fixed steps a frame) ------------------------------------------------------------------
      let T = 0, stage = 0, last_shot_t = -9;
      const stage_log = demo.log = [];
      const snapshot = function (label) { stage_log.push([label, r2(T), r2(wall_top()), awake_count()]); };
      const wall_top = function () { let s = 0; wall.forEach(function (it) { s += it.body.world_position[1]; }); return s / wall.length; };
      const awake_count = function () { let n = 0; items.forEach(function (it) { if (!it.hidden && !(((it.body.world_position[3] | 0) & PHS_BODY_SLEEPING))) n++; }); return n; };
      const throw_it = function (it, x, y, z, vx, vy, vz) {
        it.hidden = false; phy.body_unpark(it.body); phy.body_set_position(it.body, x, y, z); phy.body_set_velocity(it.body, vx, vy, vz); phy.body_set_angular_velocity(it.body, 0, 0, 0);
      };

      let dist_min = {};
      engine.on_frame.add(function (time, dt) {
        demo.frames++;
        if (demo.frames < 3) return;
        if (demo.creatures_on && !cr.loaded && !cr.error) return;               // (the script starts when the creatures are in)
        T += Math.min(dt, 4 / 60);                 // (dt is in seconds)
        demo.t = r2(T);
        // rays every frame: from the sensor, nine rays; and one straight down from above the pendulum's ball
        rays.forEach(function (R) { phy.world_raycast(R.rc.uuid, SENSOR[0], SENSOR[1], SENSOR[2], R.dir[0], R.dir[1], R.dir[2], 60); });
        const bp = pend.body.world_position;
        phy.world_raycast(down.uuid, bp[0], bp[1] + 20, bp[2], 0, -1, 0, 60);
        if (T > 0.6) rays.forEach(function (R, i) { const d = R.rc.position_distance[3]; if (R.first === null && d > 0) R.first = r2(d); });
        if (stage === 0 && T > 0.2) { stage = 1; snapshot("start"); demo.wall.top0 = r2(wall_top()); }
        if (stage === 1 && T >= 2.0) {
          stage = 2; snapshot("ragdoll C"); demo.wall.dropped = wall.filter(function (it) { return it.y0 - it.body.world_position[1] > 0.1; }).length; demo.wall.settle_max = r2(Math.max.apply(null, wall.map(function (it) { return it.y0 - it.body.world_position[1]; })));
          if (knights.c) { try { knights.c.sp.ragdoll(knights.c.c, true, { dir: [0, -1], push: 2.5 }); cr.ragdoll_called = true; } catch (e) { cr.ragdoll_error = String(e.message).slice(0, 200); } }
        }
        if (stage === 2 && T >= 3.0) {
          stage = 3; snapshot("wrecker + door ball");
          demo.wall.before = r2(wall_top());
          if (demo.wrecker) throw_it(wrecker, 0, 1.0, 14, 0, 3.0, -15);
          throw_it(door_ball, -5.5, 1.5, 4, 2.9, 4.0, -13.6);
          cr.shots_t0 = T;
        }
        if (stage >= 3 && T >= 3.0 && T - last_shot_t > 0.45 && cr.shots_asked < 6 && knights.b) {            // knight B is shot from 8 m away along -z, at the height of its chest
          last_shot_t = T; cr.shots_asked++;
          const b = knights.b, p = root_y(b);
          if (p) system.shoot({ from: [p[0], 1.2, p[2] + 8], dir: [0, 0, -1], range: 40, impulse: 40, damage: 25 }, function (shot) { cr.last_shot = { hit: shot.hit, distance: r2(shot.distance), slot: shot.slot }; if (shot.hit) cr.shots_hit++; });
        }
        if (stage === 3 && T >= 4.0) {
          stage = 4; snapshot("crate at A");
          const a = knights.a, p = a ? root_y(a) : null;
          cr.a_before = p ? [r2(p[0]), r2(p[2])] : null;
          throw_it(crate, (p ? p[0] : 4.2) + 6, 1.0, p ? p[2] : 4, -14, 1, 0);
        }
        if (stage >= 3) {
          const pb = pend.body.world_position;
          dist_min.px_min = Math.min(dist_min.px_min === undefined ? 99 : dist_min.px_min, pb[0]); dist_min.px_max = Math.max(dist_min.px_max === undefined ? -99 : dist_min.px_max, pb[0]);
        }
        if (T >= until && !demo.done) finish();
      });

      const finish = function () {
        snapshot("end");
        // the rain: where each came to rest against what it should be (a sphere: its radius; a box: its half height or half width; a capsule lying: its radius or standing: half the length + radius)
        const rain_list = rain.map(function (it) {
          const p = it.body.world_position, flags = p[3] | 0;
          return { name: it.name, y: r2(p[1]), asleep: !!(flags & PHS_BODY_SLEEPING), from: r2(it.y0) };
        });
        if (q.get("detail") === "1") demo.rain = rain_list;
        demo.rain_on_floor = rain_list.filter(function (r) { return r.y < 1.2; }).length;
        demo.rain_asleep = rain_list.filter(function (r) { return r.asleep; }).length;
        demo.rain_min_y = Math.min.apply(null, rain_list.map(function (r) { return r.y; }));
        demo.wall.after = r2(wall_top());
        demo.wall.fallen = wall.filter(function (it) { return it.body.world_position[1] < it.y0 - 0.2 || Math.hypot(it.body.world_position[0] - it.x0, it.body.world_position[2] - it.z0) > 0.8; }).length;
        demo.wall.max_z_shift = r2(Math.max.apply(null, wall.map(function (it) { return Math.abs(it.body.world_position[2] - it.z0); })));
        const wp = wrecker.body.world_position;
        demo.wrecker_at = [r2(wp[0]), r2(wp[1]), r2(wp[2])];
        demo.pendulum = { x_min: r2(dist_min.px_min), x_max: r2(dist_min.px_max), rod: r2(Math.hypot(pend.body.world_position[0] - 6, pend.body.world_position[1] - 5.5, pend.body.world_position[2] + 3)), force: r2(joints[0].j.force) };
        demo.chain = links.map(function (it) { const p = it.body.world_position; return [r2(p[0]), r2(p[1])]; });
        demo.door = { angle_deg: r2(joints[joints.length - 1].j.value), broken: joints[joints.length - 1].j.broken };
        demo.rays = rays.map(function (R) { return [R.first, r2(R.rc.position_distance[3]) > 0 ? r2(R.rc.position_distance[3]) : null, (by_uuid[R.rc.shape_body[1]] || {}).name || null]; });
        demo.ray_down = { distance: r2(down.position_distance[3]), at_y: r2(down.position_distance[1]), hit: (by_uuid[down.shape_body[1]] || {}).name || ("id " + down.shape_body[1]) };
        cr.bodies = {};
        for (const id in knights) {
          const k = knights[id], p = root_y(k);
          cr.bodies[id] = { root: p ? [r2(p[0]), r2(p[1]), r2(p[2])] : null, moved: p ? r2(Math.hypot(p[0] - k.x0, p[2] - k.z0)) : null, fallen: !!(k.sp.fallen && k.sp.fallen(k.c)), health: k.sp.zone_health ? Array.prototype.slice.call(k.sp.zone_health(k.c)).map(r2) : null };
        }
        demo.done = true;
        console.log("happy.demo: physics demo done after " + demo.t + " s of world time");
      };

      // a safety net: if the clock never gets there (the creatures never loaded and no frames) the page still ends
      creatures_ready.then(function () { if (!cr.loaded && demo.creatures_on) console.warn("happy.demo: creatures not loaded: " + cr.error); });
    } catch (e) { demo.error = String(e && e.stack || e); console.error("happy.demo: " + demo.error); demo.done = true; }
  }

  engine({})(ready);
});
