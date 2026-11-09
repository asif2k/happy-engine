// Physics system, main-thread side. import()'d into float_views.js, so it shares that file's scope: the command buffer (ubuff / fbuff / ui),
// `engine` and `float_view`. The simulation lives in the worker (physics_system2.0.cpp, fixed 1/60 s steps); this file only builds commands and
// exposes the per-frame results the worker writes into the float arena. Everything is in the namespace  engine.phy :
//
//   const phy = engine.phy;
//   const box = phy.box_body(x, y, z, w, h, d, PHS_BODY_DYNAMIC);       // sphere_body / capsule_body / plane_body / box_body, or build it by hand:
//   const bod = phy.body({ type: PHS_BODY_DYNAMIC, pos: [x, y, z] });   //   a body, shapes (phy.shape_sphere / shape_box / shape_capsule / shape_plane),
//   phy.body_add_shape(bod, phy.shape_box(1, 1, 1));                    //   phy.shape_material(shp, density, friction, restitution) / shape_relative / shape_filter,
//   phy.body_setup_mass(bod);                                           //   then setup_mass once all shapes are in
//
// A body carries what the worker writes every frame (interpolated between the fixed steps):
//   bod.world_position  [x, y, z, flags]   flags = PHS_BODY_* bits (PHS_BODY_SLEEPING ...)       bod.world_rotation [x, y, z, w]
//   bod.contacts        [count, support load N, block load N, deepest penetration, support normal xyz, block normal xyz]  (last step; normals point INTO the body)
// and each shape bod.shapes[i] has world_position / world_rotation of its own. phy.shapes_list holds every shape ever made (for debug drawing).
// Commands applied before the next step: body_set_position / body_set_orientation / body_set_velocity / body_set_angular_velocity / body_apply_force /
// body_apply_impulse(body, impulse, world point) / body_set_motor (a velocity target with an acceleration limit, what the creature mover uses; it wakes a
// sleeping body) / body_clear_motor / body_lock_rotation (PHS_LOCK_*) / body_park / body_unpark / body_allow_sleep.
// Rays: phy.raycast_hit() makes a result holder ([x, y, z, distance], .normal, .shape_body = [shape id, body id, raw shape, raw body]),
// phy.world_raycast / phy.world_camera_raycast fill it; phy.apply_impulse_world takes the RAW body id from such a hit.
// The world: phy.set_world({ gravity, linear_damping, angular_damping, solver_iterations }) and the run control phy.pause() / resume() / step(n) /
// set_run(paused, time_scale, steps); phy.world and phy.run mirror what was last sent. A test bed that uses all of it: engine.debug.physics_testbed().
// Joints between bodies: phy.joint_ball / joint_hinge / joint_slider / joint_fixed / joint_distance (limits, motors, springs, breaking), see the end of this file.
(function () {


  const phy = engine.phy = engine.phy || {};

  consts$({
    CMD_PHY_CREATE_BODY: 6470,
    CMD_PHY_CREATE_SHAPE: 6480,
    CMD_PHY_CREATE_RAYCAST_HIT: 6490,
    CMD_PHY_WORLD_RAYCAST: 6500,
    CMD_PHY_WORLD_CAMERA_RAYCAST: 6510,
    CMD_PHY_SET_SHAPE_SPHERE: 6520,
    CMD_PHY_SET_SHAPE_PLANE: 6530,
    CMD_PHY_SET_SHAPE_BOX: 6540,
    CMD_PHY_SET_SHAPE_CAPSULE: 6550,
    CMD_PHY_ADD_BODY_SHAPE: 6560,
    CMD_PHY_SETUP_BODY_MASS: 6570,
    CMD_PHY_APPLY_IMPULSE_WORLD: 6580,
    CMD_PHY_SET_BODY_POSITION: 6590,
    CMD_PHY_SET_BODY_VELOCITY: 6600,
    CMD_PHY_APPLY_FORCE: 6610,
    CMD_PHY_SET_BODY_MOTOR: 6620,
    CMD_PHY_CLEAR_BODY_MOTOR: 6630,
    CMD_PHY_SET_BODY_ROTATION_LOCK: 6640,
    CMD_PHY_PARK_BODY: 6650,
    CMD_PHY_UNPARK_BODY: 6660,
    CMD_PHY_SET_BODY_ALLOW_SLEEP: 6670,
    CMD_PHY_SET_SHAPE_MATERIAL: 6680,
    CMD_PHY_SET_SHAPE_FILTER: 6690,
    CMD_PHY_SET_SHAPE_RELATIVE: 6700,
    CMD_PHY_SET_BODY_ORIENTATION: 6710,
    CMD_PHY_SET_BODY_ANGULAR_VELOCITY: 6720,
    CMD_PHY_APPLY_IMPULSE: 6730,
    CMD_PHY_SET_WORLD: 6740,
    CMD_PHY_SET_RUN: 6750,
    CMD_PHY_CREATE_JOINT: 6760,
    CMD_PHY_JOINT_SETUP: 6770,
    CMD_PHY_JOINT_PARAMS: 6780,
    CMD_PHY_JOINT_ENABLE: 6790,
    CMD_PHY_DESTROY_JOINT: 6800
  })

  // every shape ever made (debug drawing walks it)
  phy.shapes_list = [];

  consts$({
    PHS_BODY_DYNAMIC: 2,
    PHS_BODY_STATIC: 4,
    PHS_BODY_KINEMATIC: 8,
    PHS_BODY_SLEEPING: 16,
    PHS_BODY_ALLOW_SLEEP: 32,
    PHS_BODY_PARKED: 128
  })

  phy.shape = function (shp) {

    shp = shp || {};
    shp.uuid = engine.guid();
    ubuff[ui++] = CMD_PHY_CREATE_SHAPE;
    ubuff[ui++] = shp.uuid;
    shp.world_position = float_view.float32(3);
    shp.world_rotation = float_view.float32(4);
    phy.shapes_list.push(shp);
    shp.color = engine.generateSeededRGB(shp.uuid * 123);
    return shp;
  };

  phy.shape_sphere = function (rad) {
    const shp = phy.shape();
    ubuff[ui++] = CMD_PHY_SET_SHAPE_SPHERE;
    ubuff[ui++] = shp.uuid;
    fbuff[ui++] = rad;
    shp.type = CMD_PHY_SET_SHAPE_SPHERE;
    shp.rad = rad;
    return shp;
  };

  phy.shape_plane = function (nx, ny, nz, d) {
    const shp = phy.shape();
    ubuff[ui++] = CMD_PHY_SET_SHAPE_PLANE;
    ubuff[ui++] = shp.uuid;
    fbuff[ui++] = nx;
    fbuff[ui++] = ny;
    fbuff[ui++] = nz;
    fbuff[ui++] = d;
    shp.type = CMD_PHY_SET_SHAPE_PLANE;

    return shp;
  };

  phy.shape_box = function (w, h, d) {
    const shp = phy.shape();
    ubuff[ui++] = CMD_PHY_SET_SHAPE_BOX;
    ubuff[ui++] = shp.uuid;
    fbuff[ui++] = w;
    fbuff[ui++] = h;
    fbuff[ui++] = d;

    shp.type = CMD_PHY_SET_SHAPE_BOX;
    shp.w = w; shp.h = h; shp.d = d;
    return shp;
  };

  phy.shape_capsule = function (r, h) {
    const shp = phy.shape();
    ubuff[ui++] = CMD_PHY_SET_SHAPE_CAPSULE;
    ubuff[ui++] = shp.uuid;
    fbuff[ui++] = r;
    fbuff[ui++] = h;


    shp.type = CMD_PHY_SET_SHAPE_CAPSULE;
    shp.h = h; shp.r = r;
    return shp;
  };

  phy.body_add_shape = function (bod, shp) {

    ubuff[ui++] = CMD_PHY_ADD_BODY_SHAPE;
    ubuff[ui++] = bod.uuid;
    ubuff[ui++] = shp.uuid;
    shp.body = bod;
    if (bod.shapes) bod.shapes.push(shp);
    engine.math.vec3.copy(shp.world_position, bod.pos);
    return bod;
  };



  phy.body = function (bod) {
    bod = bod || {};
    bod.pos = bod.pos || [0, 0, 0];
    bod.uuid = engine.guid();
    ubuff[ui++] = CMD_PHY_CREATE_BODY;
    ubuff[ui++] = bod.uuid;
    ubuff[ui++] = bod.type || PHS_BODY_DYNAMIC;
    fbuff[ui++] = bod.pos[0];
    fbuff[ui++] = bod.pos[1];
    fbuff[ui++] = bod.pos[2];

    bod.world_position = float_view.float32(4);
    bod.world_rotation = float_view.float32(4);
    // contact summary of the last physics step (worker writes 10 floats after the pose):
    // [0] contact count, [1] support load (ground contacts, N), [2] block load (walls / other bodies),
    // [3] deepest penetration, [4..6] support normal (into the body), [7..9] block normal
    bod.contacts = float_view.float32(10);
    bod.shapes = [];

    return bod;
  };



  phy.body_setup_mass = function (bod) {
    ubuff[ui++] = CMD_PHY_SETUP_BODY_MASS;
    ubuff[ui++] = bod.uuid;
    return bod;
  };

  phy.sphere_body = function (x, y, z, rad, t) {
    const bod = phy.body({ type: t || PHS_BODY_DYNAMIC, pos: [x, y, z] });
    phy.body_add_shape(bod, phy.shape_sphere(rad));
    phy.body_setup_mass(bod);

    return bod;
  };
  phy.plane_body = function (d, nx, ny, nz) {
    const bod = phy.body({ type: PHS_BODY_STATIC, pos: [0, 0, 0] });
    phy.body_add_shape(bod, phy.shape_plane(nx || 0, ny || 1, nz || 0, d || 0.00001));
    phy.body_setup_mass(bod);

    return bod;
  };

  phy.box_body = function (x, y, z, w, h, d, t) {
    const bod = phy.body({ type: t || PHS_BODY_DYNAMIC, pos: [x, y, z] });
    phy.body_add_shape(bod, phy.shape_box(w || 1, h || 1, d || 1));
    phy.body_setup_mass(bod);

    return bod;
  };

  phy.capsule_body = function (x, y, z, r, h, t) {

    const bod = phy.body({ type: t || PHS_BODY_DYNAMIC, pos: [x, y, z] });
    phy.body_add_shape(bod, phy.shape_capsule(r || 1, h || 1));
    phy.body_setup_mass(bod);

    return bod;
  };

  phy.raycast_hit = function () {

    const rc = {};
    rc.uuid = engine.guid();
    ubuff[ui++] = CMD_PHY_CREATE_RAYCAST_HIT;
    ubuff[ui++] = rc.uuid;
    rc.position_distance = float_view.float32(4);
    rc.normal = float_view.float32(3);
    rc.shape_body = float_view.uint_alloc(4);

    return rc;
  };

  phy.world_raycast = function (rc, ox, oy, oz, dx, dy, dz, maxDist, categoryMask, excludeShape, excludeBody) {
    ubuff[ui++] = CMD_PHY_WORLD_RAYCAST;
    ubuff[ui++] = rc;
    fbuff[ui++] = ox;
    fbuff[ui++] = oy;
    fbuff[ui++] = oz;

    fbuff[ui++] = dx;
    fbuff[ui++] = dy;
    fbuff[ui++] = dz;
    fbuff[ui++] = maxDist || 1000;

    ubuff[ui++] = categoryMask === undefined ? 0xffffffff : categoryMask;
    ubuff[ui++] = excludeShape || 0;
    ubuff[ui++] = excludeBody || 0;
  }

  phy.apply_impulse_world = function (body, ix, iy, iz, relPx, relPy, relPz) {
    ubuff[ui++] = CMD_PHY_APPLY_IMPULSE_WORLD;
    ubuff[ui++] = body;
    fbuff[ui++] = ix;
    fbuff[ui++] = iy;
    fbuff[ui++] = iz;

    fbuff[ui++] = relPx;
    fbuff[ui++] = relPy;
    fbuff[ui++] = relPz;
  }


  phy.world_camera_raycast = function (rc, cam, maxDist, categoryMask, excludeShape, excludeBody) {
    ubuff[ui++] = CMD_PHY_WORLD_CAMERA_RAYCAST;
    ubuff[ui++] = rc;
    ubuff[ui++] = cam;
    fbuff[ui++] = maxDist || 1000;
    ubuff[ui++] = categoryMask === undefined ? 0xffffffff : categoryMask;
    ubuff[ui++] = excludeShape || 0;
    ubuff[ui++] = excludeBody || 0;
  };

  // ---- physics 2.0 body / shape API (all run in the worker, applied before the next fixed step) ----
  consts$({
    PHS_LOCK_X: 1,
    PHS_LOCK_Y: 2,
    PHS_LOCK_Z: 4,
    PHS_LOCK_ALL: 7,
    PHS_LOCK_YAW_ONLY: 5
  })

  phy.body_set_position = function (bod, x, y, z) {
    ubuff[ui++] = CMD_PHY_SET_BODY_POSITION;
    ubuff[ui++] = bod.uuid;
    fbuff[ui++] = x; fbuff[ui++] = y; fbuff[ui++] = z;
    return bod;
  };

  phy.body_set_velocity = function (bod, x, y, z) {
    ubuff[ui++] = CMD_PHY_SET_BODY_VELOCITY;
    ubuff[ui++] = bod.uuid;
    fbuff[ui++] = x; fbuff[ui++] = y; fbuff[ui++] = z;
    return bod;
  };

  // force at a point relative to the body position; applies to the next step only (like phy_apply_body_force)
  phy.body_apply_force = function (bod, fx, fy, fz, rx, ry, rz) {
    ubuff[ui++] = CMD_PHY_APPLY_FORCE;
    ubuff[ui++] = bod.uuid;
    fbuff[ui++] = fx; fbuff[ui++] = fy; fbuff[ui++] = fz;
    fbuff[ui++] = rx || 0; fbuff[ui++] = ry || 0; fbuff[ui++] = rz || 0;
    return bod;
  };

  // "reach this world velocity, at most this acceleration" (horizontal x/z together, vertical separately;
  // 0 = that part not driven). Solved inside the contact iterations; stays active until changed or cleared.
  phy.body_set_motor = function (bod, vx, vy, vz, max_accel_h, max_accel_y) {
    ubuff[ui++] = CMD_PHY_SET_BODY_MOTOR;
    ubuff[ui++] = bod.uuid;
    fbuff[ui++] = vx; fbuff[ui++] = vy; fbuff[ui++] = vz;
    fbuff[ui++] = max_accel_h || 0; fbuff[ui++] = max_accel_y || 0;
    return bod;
  };

  phy.body_clear_motor = function (bod) {
    ubuff[ui++] = CMD_PHY_CLEAR_BODY_MOTOR;
    ubuff[ui++] = bod.uuid;
    return bod;
  };

  // mask of PHS_LOCK_* world axes the body cannot rotate about (PHS_LOCK_YAW_ONLY = stays upright)
  phy.body_lock_rotation = function (bod, mask) {
    ubuff[ui++] = CMD_PHY_SET_BODY_ROTATION_LOCK;
    ubuff[ui++] = bod.uuid;
    ubuff[ui++] = mask;
    return bod;
  };

  // parked = out of the broadphase entirely, state kept (see physics_system2.0.cpp)
  phy.body_park = function (bod) {
    ubuff[ui++] = CMD_PHY_PARK_BODY;
    ubuff[ui++] = bod.uuid;
    return bod;
  };

  phy.body_unpark = function (bod) {
    ubuff[ui++] = CMD_PHY_UNPARK_BODY;
    ubuff[ui++] = bod.uuid;
    return bod;
  };

  phy.body_allow_sleep = function (bod, allow) {
    ubuff[ui++] = CMD_PHY_SET_BODY_ALLOW_SLEEP;
    ubuff[ui++] = bod.uuid;
    ubuff[ui++] = allow ? 1 : 0;
    return bod;
  };

  phy.shape_material = function (shp, density, friction, restitution) {
    ubuff[ui++] = CMD_PHY_SET_SHAPE_MATERIAL;
    ubuff[ui++] = shp.uuid;
    fbuff[ui++] = density; fbuff[ui++] = friction; fbuff[ui++] = restitution;
    return shp;
  };

  // shape pose relative to its body: pos [x, y, z] and rotation quaternion [x, y, z, w]. Call before the body's
  // phy.body_setup_mass (mass / centre of mass come from it). Lying capsule: rotation [Math.SQRT1_2, 0, 0, Math.SQRT1_2].
  phy.shape_relative = function (shp, pos, quat) {
    pos = pos || [0, 0, 0];
    quat = quat || [0, 0, 0, 1];
    ubuff[ui++] = CMD_PHY_SET_SHAPE_RELATIVE;
    ubuff[ui++] = shp.uuid;
    fbuff[ui++] = pos[0]; fbuff[ui++] = pos[1]; fbuff[ui++] = pos[2];
    fbuff[ui++] = quat[0]; fbuff[ui++] = quat[1]; fbuff[ui++] = quat[2]; fbuff[ui++] = quat[3];
    return shp;
  };

  phy.shape_filter = function (shp, category_bits, mask_bits) {
    ubuff[ui++] = CMD_PHY_SET_SHAPE_FILTER;
    ubuff[ui++] = shp.uuid;
    ubuff[ui++] = category_bits;
    ubuff[ui++] = mask_bits;
    return shp;
  };

  // teleports the orientation (quaternion x y z w) and clears the interpolation history: no one-frame blend from the old one
  phy.body_set_orientation = function (bod, x, y, z, w) {
    ubuff[ui++] = CMD_PHY_SET_BODY_ORIENTATION;
    ubuff[ui++] = bod.uuid;
    fbuff[ui++] = x; fbuff[ui++] = y; fbuff[ui++] = z; fbuff[ui++] = w;
    return bod;
  };

  phy.body_set_angular_velocity = function (bod, x, y, z) {
    ubuff[ui++] = CMD_PHY_SET_BODY_ANGULAR_VELOCITY;
    ubuff[ui++] = bod.uuid;
    fbuff[ui++] = x; fbuff[ui++] = y; fbuff[ui++] = z;
    return bod;
  };

  // an impulse (N s) applied at the WORLD point (px, py, pz) of the body: changes its velocity by impulse / mass and spins it if the point is off-centre
  // (phy.apply_impulse_world takes the raw internal id of a ray hit instead)
  phy.body_apply_impulse = function (bod, ix, iy, iz, px, py, pz) {
    ubuff[ui++] = CMD_PHY_APPLY_IMPULSE;
    ubuff[ui++] = bod.uuid;
    fbuff[ui++] = ix; fbuff[ui++] = iy; fbuff[ui++] = iz;
    fbuff[ui++] = px; fbuff[ui++] = py; fbuff[ui++] = pz;
    return bod;
  };

  // ---- the world itself ----
  // What the worker's world starts with (worker.js creates it with gravity -19.8; physics_system2.0.cpp sets the rest). phy.set_world changes
  // fields of it and sends them all; every body is woken so a sleeping pile reacts. phy.world mirrors what was last sent.
  phy.world = { gravity: [0, -19.8, 0], linear_damping: 0.999, angular_damping: 0.99, solver_iterations: 8 };

  phy.set_world = function (o) {
    const w = phy.world;
    if (o.gravity) { w.gravity[0] = o.gravity[0]; w.gravity[1] = o.gravity[1]; w.gravity[2] = o.gravity[2]; }
    if (o.linear_damping !== undefined) w.linear_damping = o.linear_damping;       // per fixed step: 0.999 loses 6 % of the speed per second
    if (o.angular_damping !== undefined) w.angular_damping = o.angular_damping;
    if (o.solver_iterations !== undefined) w.solver_iterations = Math.max(1, Math.min(64, o.solver_iterations | 0));
    ubuff[ui++] = CMD_PHY_SET_WORLD;
    fbuff[ui++] = w.gravity[0]; fbuff[ui++] = w.gravity[1]; fbuff[ui++] = w.gravity[2];
    fbuff[ui++] = w.linear_damping; fbuff[ui++] = w.angular_damping;
    ubuff[ui++] = w.solver_iterations;
    return w;
  };

  // Run control: paused (the world does not advance, bodies stay as they are), time scale (1 = real time) and `steps` fixed steps to run
  // right now (use while paused to single-step; they queue up until the next frame). phy.run mirrors the state.
  phy.run = { paused: false, time_scale: 1 };

  phy.set_run = function (paused, time_scale, steps) {
    phy.run.paused = !!paused;
    phy.run.time_scale = time_scale === undefined ? phy.run.time_scale : time_scale;
    ubuff[ui++] = CMD_PHY_SET_RUN;
    ubuff[ui++] = phy.run.paused ? 1 : 0;
    fbuff[ui++] = phy.run.time_scale;
    ubuff[ui++] = steps | 0;
    return phy.run;
  };
  phy.pause = function () { return phy.set_run(true, undefined, 0); };
  phy.resume = function () { return phy.set_run(false, undefined, 0); };
  phy.step = function (n) { return phy.set_run(true, undefined, n === undefined ? 1 : n); };       // pauses (if running) and runs n fixed steps

  // ---- joints (physics_system2.0.cpp, section [12.2]) ----
  // Anchors and axes are WORLD coordinates ([x, y, z]); the bodies must already stand where they belong when the joint is made, because their current
  // poses become the joint frames. A body of null / 0 is the world. Angles are in DEGREES here (limits, cone, twist, hinge motor speed), lengths in metres.
  //
  //   phy.joint_ball(a, b, anchor, { axis, cone, twist: [lo, hi] })              ball and socket; cone = swing half angle around axis, twist about it
  //   phy.joint_hinge(a, b, anchor, { axis, limits: [lo, hi], motor: [speed, max torque] })
  //   phy.joint_slider(a, b, anchor, { axis, limits: [lo, hi] (m), motor: [speed m/s, max force] })
  //   phy.joint_fixed(a, b, anchor)                                              welded
  //   phy.joint_distance(a, b, anchor, { anchor_b, length })                     rigid rod; { max: L } is a rope, { min, max } a range,
  //                                                                              { frequency: Hz, damping: ratio, rest } a spring (rest 0 = the distance at setup);
  //                                                                              no option at all = rigid at the distance the anchors have right now
  // Every kind also takes { collide: true } (the joined bodies keep colliding with each other, default off) and { break_force: N, break_torque: Nm }.
  // A joint is a slot of the worker's joint table, so it can be reused: phy.joint_setup(j, type, a, b, anchor, o) re-configures it IN PLACE (no new
  // arena memory), phy.joint_params(j, o) changes limits / motor / spring / breaking only (o merges into the options of the joint, null switches an option off),
  // phy.joint_enable(j, on) switches it off and on (also repairs a broken one), phy.joint_destroy(j) frees the slot.
  // What the worker writes every frame is in j.state (a live Float32Array(16)), with getters on every joint:
  //   j.enabled, j.broken, j.value (hinge angle / ball swing in degrees, slider translation / distance in metres), j.force (N), j.torque (Nm),
  //   j.anchor_a / j.anchor_b (world points of the two anchors: they only differ by the constraint error), j.axis (world axis of side A).
  consts$({
    PHS_JOINT_BALL: 1,
    PHS_JOINT_HINGE: 2,
    PHS_JOINT_SLIDER: 3,
    PHS_JOINT_FIXED: 4,
    PHS_JOINT_DISTANCE: 5
  })

  const DEG = Math.PI / 180, RAD = 180 / Math.PI;
  const JOINT_PARAMS = 24;                                               // PHY_JP_COUNT
  const JF_COLLIDE = 4, JF_LIMIT = 8, JF_MOTOR = 16, JF_CONE = 32, JF_TWIST = 64;      // PHY_JF_*

  const joint_proto = {
    get enabled() { return (this.state[0] & 1) !== 0; },
    get broken() { return (this.state[0] & 2) !== 0; },
    get value() { const t = this.type, v = this.state[1]; return (t === PHS_JOINT_HINGE || t === PHS_JOINT_BALL) ? v * RAD : v; },
    get force() { return this.state[2]; },
    get torque() { return this.state[3]; },
    get anchor_a() { return this.state.subarray(4, 7); },
    get anchor_b() { return this.state.subarray(7, 10); },
    get axis() { return this.state.subarray(10, 13); }
  };
  phy.joint_proto = joint_proto;

  // writes the PHY_JP_* block at fbuff[at ..] and returns the PHY_JF_* flags the options ask for
  function joint_fill(at, type, anchor, o) {
    let flags = 0, k;
    for (k = 0; k < JOINT_PARAMS; k++) fbuff[at + k] = 0;
    if (anchor) { fbuff[at] = anchor[0]; fbuff[at + 1] = anchor[1]; fbuff[at + 2] = anchor[2]; }
    const ab = o.anchor_b || anchor;
    if (ab) { fbuff[at + 3] = ab[0]; fbuff[at + 4] = ab[1]; fbuff[at + 5] = ab[2]; }
    const ax = o.axis || [1, 0, 0];
    fbuff[at + 6] = ax[0]; fbuff[at + 7] = ax[1]; fbuff[at + 8] = ax[2];
    const angular = type === PHS_JOINT_HINGE;
    if (o.limits) { flags |= JF_LIMIT; fbuff[at + 9] = o.limits[0] * (angular ? DEG : 1); fbuff[at + 10] = o.limits[1] * (angular ? DEG : 1); }
    if (o.motor) { flags |= JF_MOTOR; fbuff[at + 11] = o.motor[0] * (angular ? DEG : 1); fbuff[at + 12] = o.motor[1]; }
    if (o.frequency > 0) { fbuff[at + 13] = o.frequency; fbuff[at + 14] = o.damping || 0; }
    fbuff[at + 15] = o.break_force || 0; fbuff[at + 16] = o.break_torque || 0;
    if (o.cone > 0) { flags |= JF_CONE; fbuff[at + 17] = o.cone * DEG; }
    if (o.twist) { flags |= JF_TWIST; fbuff[at + 18] = o.twist[0] * DEG; fbuff[at + 19] = o.twist[1] * DEG; }
    if (o.length > 0) { fbuff[at + 20] = o.length; fbuff[at + 21] = o.length; }          // rigid rod
    else { fbuff[at + 20] = o.min || 0; fbuff[at + 21] = o.max || 0; }
    fbuff[at + 22] = o.rest || 0;
    if (o.collide) flags |= JF_COLLIDE;
    return flags;
  }

  // reserves a joint slot in the worker (nothing is connected yet); it costs 16 floats of the float arena, once
  phy.joint_create = function () {
    const j = Object.create(joint_proto);
    j.uuid = engine.guid();
    ubuff[ui++] = CMD_PHY_CREATE_JOINT;
    ubuff[ui++] = j.uuid;
    j.state = float_view.float32(16);
    j.type = 0; j.a = null; j.b = null; j.o = {};
    return j;
  };

  // (re)configures slot j: kind, the two bodies (null = world), world anchor, options (see above)
  phy.joint_setup = function (j, type, a, b, anchor, o) {
    o = o || {};
    j.type = type; j.a = a || null; j.b = b || null; j.o = o;
    ubuff[ui++] = CMD_PHY_JOINT_SETUP;
    ubuff[ui++] = j.uuid;
    ubuff[ui++] = type;
    ubuff[ui++] = a ? a.uuid : 0;
    ubuff[ui++] = b ? b.uuid : 0;
    const flags_at = ui++;
    ubuff[flags_at] = joint_fill(ui, type, anchor, o);
    ui += JOINT_PARAMS;
    return j;
  };

  phy.joint_params = function (j, o) {
    Object.assign(j.o, o);
    ubuff[ui++] = CMD_PHY_JOINT_PARAMS;
    ubuff[ui++] = j.uuid;
    const flags_at = ui++;
    ubuff[flags_at] = joint_fill(ui, j.type, null, j.o);
    ui += JOINT_PARAMS;
    return j;
  };

  phy.joint_enable = function (j, on) {
    ubuff[ui++] = CMD_PHY_JOINT_ENABLE;
    ubuff[ui++] = j.uuid;
    ubuff[ui++] = on === false ? 0 : 1;
    return j;
  };

  phy.joint_destroy = function (j) {
    ubuff[ui++] = CMD_PHY_DESTROY_JOINT;
    ubuff[ui++] = j.uuid;
    j.type = 0;
    return j;
  };

  phy.joint_ball = function (a, b, anchor, o) { return phy.joint_setup(phy.joint_create(), PHS_JOINT_BALL, a, b, anchor, o); };
  phy.joint_hinge = function (a, b, anchor, o) { return phy.joint_setup(phy.joint_create(), PHS_JOINT_HINGE, a, b, anchor, o); };
  phy.joint_slider = function (a, b, anchor, o) { return phy.joint_setup(phy.joint_create(), PHS_JOINT_SLIDER, a, b, anchor, o); };
  phy.joint_fixed = function (a, b, anchor, o) { return phy.joint_setup(phy.joint_create(), PHS_JOINT_FIXED, a, b, anchor, o); };
  phy.joint_distance = function (a, b, anchor, o) { return phy.joint_setup(phy.joint_create(), PHS_JOINT_DISTANCE, a, b, anchor, o); };

})();
