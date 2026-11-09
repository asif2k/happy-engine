packing("@/engine.js")("system", function (engine) {
  // HAPPY SYSTEM: the creature system of the engine. A page lists @/system/system.js and has `engine.system` (written `happy.system` in the docs: the page's callback calls the engine `happy`). Two layers:
  //   THE PACK (the end of this file; data.js): system.bin holds everything the system reads, in ONE file:
  //     system.load(url?, { all? }) -> Promise<system>      one fetch (default "/system/system.bin"); nothing in it is unzipped until it is asked for; { all: true } is LOAD ALL: everything the system has is in, the worker's side too, when the one promise resolves (system.loaded says what)      system.pack   system.url   system.size
  //     system.sections(prefix?) -> [name]   system.info(name) -> { name, kind, packed, raw, meta }   system.tree(name) -> Promise<value>   system.bytes(name) -> Promise<Uint8Array>
  //     system.gaits.libraries() -> [{ name, count, legs }]   system.gaits.library(name) -> Promise<{ format, version, description, gaits: [style ...] }>
  //     system.actions.sets() -> [{ name, count, about, preset? }]   system.actions.set(name) -> Promise<{ format, version, name, description, tags, actions: [spec ...] }>   (a fitted action has no fit report)
  //     system.use({ gaits: "all" | [names], actions: "all" | [names] }) -> Promise<{ gaits, actions }>      the libraries into the creatures' hands: the styles into the page's registry (system.gaits), and the worker reads the same
  //                                                                                                      sections of system.bin itself (system.worker_pack): its gait registry and its action library
  //   THE CREATURES (the rest of this header): species, spawn, gaits, actions, flight, wheels, physics, hit zones ...
  //
  // HAPPY - creatures that live by themselves, main thread. The second system, started from nothing: its first layer is a CONTROLLED RIG (rig_*.cpp, body.cpp: joints that have limits, FABRIK on trees of bones with several end
  // effectors, and the engine's classic solvers as solvers of the same rig); the layers that come after it (the gait, the roles, the actions ...) are ported onto it one at a time. A page lists @/system/system.js and nothing else.
  //
  //   const sp = engine.system.species({ name, skeleton, rig, max_instances })      the geometry of a species is a skeleton and a SKINNED MESH (below); what moves it is its rig
  //   skeleton  = [{ name, parent: name | index | null, head: [x, y, z], tail?: [x, y, z], roll?: degrees, mirror?: "x" }, ...]   in the model's space at the bind pose (+x left, +y up, +z forward), at most 255
  //   mesh      = { positions, normals, indices, uvs?, colors?, skin_indices?, skin_weights?, skin_count?, roughness?, metallic?, part_ids?, parts? }   plain arrays: the surface at the bind pose, up to 4 bones and weights a vertex (no skin: the
  //                 creature is one rigid thing); roughness / metallic: a number a vertex (-1: not said), part_ids + parts: [{ id, roughness?, metal? }] the parts the vertices belong to (SYSTEM.md "Materials")
  //   sdf       = { cell, shade?, skin?, adaptive?, decimate?, islands?, parts: [...] }   the mesher's def (SYSTEM.md) WITHOUT bones: the parts stand on the creature's own bones (`bone: "forearm_l"`), the mesher makes the
  //                 mesh and the skin weights of them (mesher.js, built in; asynchronous: system.build_sdf(input) first, then system.species(input)); a part may say its `roughness` and `metal` (0 .. 1, -1: the species')
  //   material  = { roughness, metal, base_color_map, normal_map, roughness_map, metal_map, ao_map, alpha_test, double_sided, shader_extra, uniforms, props, bones: { <bone>: { roughness, metal } }, eyes: 0.05 | { roughness, metal } | false,
  //                 eyes_bones: [bones], specular_aa: true, sky: true | false | { horizon, zenith, ground, strength } }      the species' values, and BY PART: a vertex takes its own, its part's, its bones' (by its skin weights; the roles'
  //                 eyes are glossy by default and, in a forward page, mirror an analytic sky: `sky`, on by default with them) or the species'
  //                 (a channel of 4 bytes a vertex only for a species that has any of it: SYSTEM.md "Materials")      skinning: "dual_quaternion" | "linear"
  //                 A species is DRAWN by one instanced draw of its mesh (system.render_all(), once a frame inside the engine's pass): every instance is a row of the species' texture, the rows the worker sends.
  //                 sp.set_mesh(mesh)   sp.set_skinning(mode)   sp.set_wireframe(on)   sp.visible = false   sp.set_uniform("u_...", v)   sp.dispose()      system.use_mesher(m | null)   system.sdf_made(input)   system.sdf_mesh(input)
  //                 sp.set_material("all" | "eyes" | <part id> | "part:<id>" | "bone:<name>" | <bone>, { roughness, metal })   (null: back to the definition; live: one rewrite of the bytes)   sp.material_of(selector)   system.eye_bones(def)
  //                 sp.set_sky(true | false | { horizon, zenith, ground, strength } | null)   sp.sky_state()   system.carry_material(from, to): what the page set, given to a species made again (species_again does it itself)
  //   rig       = { joints, chains }                       (a key that is not one of those below is an error: a typo is not a limit that is not there)
  //     joints  = [{ bone, kind, ... }, ...] (or an object keyed by bone name): what a bone may do against its parent (degrees; the model's axes at the bind pose). A bone with no joint is free.
  //                 { bone, kind: "ball", fwd, back, out, in | lat, twist: [lo, hi] | n, out_dir?, side?, neutral? }   a swing and a twist: how far the bone's axis may tilt forward (+z of the model; for a bone that points
  //                                       forward, up), back, out (away from the body: toward +x for a left bone, -x for a right one, or toward out_dir) and in; for a bone that lies along x (an arm in a T-pose) give `up` and `down` in
  //                                       place of out / in. A tilt of 175 is 175 degrees (the true angle); how far it may twist about itself.
  //                 { bone, kind: "hinge", axis: [x, y, z], range: [lo, hi] }   one axis, one range, nothing else (an elbow, a knee, a boom, a control surface); 0 is the bind pose, a range contains it
  //                 { bone, kind: "fixed", slide?: [lo, hi] }   no turn at all; a slide lets the bone's head move along its parent's axis by lo .. hi (model units: a telescopic boom, a landing gear's strut)
  //                 `mirror: "x"` on a joint, a chain or a bone whose name ends in _l writes its _r twin (a hinge's axis a becomes (a.x, -a.y, -a.z), a twist [lo, hi] becomes [-hi, -lo])
  //     chains  = [{ name, solver, bones: [names, from the root down], tip?: bone, pole?: [x, y, z], pole_w?, weight?, orient?, group? }, ...]
  //                 the bones are each the child of the one before and the first is the child of the chain's ROOT (whose frame is final when the chain is solved); every bone continues the one before along its axis
  //                 (system.compile says which one does not). `tip`: the bone whose head is the end of the chain (a foot); none: the end is the tail of the last bone. `solver`: "fabrik" (FABRIK chains that share a bone are
  //                 one tree, solved together: a sub-base takes the centroid of what its branches ask; chains that share only their root are solves of their own; `group` joins chains that share no bone), or one of the
  //                 classic solvers (system.IK_SOLVERS: limb two bones, z_leg three, spring_leg, tentacle, arc, insect_leg, catenary, trapezoid, accordion, curl_tip, curl_base, tentacle_generic, shock_absorber, whip,
  //                 fabrik2d): one chain a unit; the shapes among them do not promise to reach. `pole`: which way a limb bends (the knee forward), `pole_w` how hard it is held there (0 .. 1), `weight` how far the end
  //                 goes from where the animation has it to its target, `orient`: the end's turn is asked for as well as its place.
  //   system.cull({ camera, on, lod, margin, auto })      ON BY DEFAULT, by the engine's one perspective camera (system finds it itself; system.cull(false) switches it off): the worker culls by a camera's frustum: what is outside is updated every `lod` frames, not sent and not drawn (SYSTEM.md "Culling"); definition: bound: { center, radius }, the sphere an instance is tested by (else the mesh's)
  //   definition: variants: { dyes: { coat: { parts, bones, palette } }, optional: { horns: { parts } }, looks: [{ coat: 0 }, { coat: 2, horns: false }] }      sp.spawn({ ..., variant: 2, seed })   sp.set_variant(c, 3 | "name" | null)   sp.variant_of(c)
  //                 the individuals of a species (SYSTEM.md "Variants"): the family declares its LIST of looks (a table in a uniform array of its material, happy_looks[k], set once) and an instance wears one by its NUMBER (an attribute of the draw list);
  //                 `variant` is the number of a look (taken round the list) or its name: a species that declares none is not affected
  //   definition: skins: [{ name: "officer", sdf | mesh, variants?: {..} | true, material?, bound? }, ...]      sp.spawn({ ..., skin: 2 | "officer", variant })   sp.set_skin(c, skin, { variant })   sp.skin_of(c)   sp.skin_list   sp.skin_names   sp.skin_info()
  //                 one BODY (skeleton, rig, mind, one texture of rows) in several SKINS, each its own sdf or mesh, material, variants and draw (SYSTEM.md "Skins"); the definition's own sdf / mesh is skin 0; `skin` is a number (taken round the list) or a name:
  //                 a species that has none is not affected; the look of an instance is one of ITS skin's variants
  //   sp.spawn({ x, y, z, scale, yaw }) -> c      sp.release(c)      sp.set_root(c, x, y, z, q?, scale?)      sp.set_tier(c, "far" | "near" | "auto")
  //   sp.chain(c, name, { target: [x, y, z], weight, pole, pole_w, orient: [qx, qy, qz, qw] })      sp.release_chain(c, name)      (targets in the model's space: the instance's root space)
  //   sp.pose(c, bone, { rx, ry, rz | q: [x, y, z, w], x, y, z, stiffness })      what the animation says of a bone (the rig holds it to its joint, and a chain that is asked for moves the bones it solves)
  //   sp.bone_position(c, bone) / sp.chain_end(c, chain) / sp.point_on(c, bone, p) -> [x, y, z]      where things are, in the model's space, from the rows the worker sent      sp.bone_world(c, bone): in the world
  //   legs: { body?: "hips", legs: ["leg_l", ...] | [{ chain, phase?, foot_height?, mirror? }], pattern?: "alternate" | "walk" | "bound" | "gallop" | "pronk", gait?: {...}, gaits?: [{...}, ...], slots?: spare gaits (0 .. 16 less the gaits: each the first one's until the worker's logic writes a style into it, pure.js) }     body: { max_speed?, accel?, turn_rate?, ground?, offset? }
  //                 the creature WALKS: a leg is a chain of the rig whose end is the foot (the worker's gait puts it where the body's motion says and the rig makes the leg reach it, inside every joint's limits); the body is a
  //                 mover of the root (a wish of velocity and facing, acceleration, turning by the legs' steps, the ground). The gait's numbers (kernel.js) are what the legs' length says unless the definition gives them
  //                 a gait may be taken FROM A STYLE of the library: legs: { gait: { from: "lion_walk" } } (system.gaits: happy_gaits/*.gaits.json, system.gaits.load(url) / system.gaits.add(file)): the style's numbers in the
  //                 creature's own leg lengths, the order its legs step in, the foot's path and what its feet and knees do through a step (the foot is pitched and yawed, rolls about its heel and its ball)
  //   sp.set_intent(c, vx, vz, fx, fz)      where an instance wants to go (a world velocity) and which way to face (0, 0: the way it goes), said once      sp.set_gait({ stride: 0.5 }, which?)      sp.set_gait_blend(c, a, wa, b, wb)
  //   sp.set_treadmill(c, vx, vz)      walking in place      system.debug({ ..., legs: true })      the feet, the stance places and the reach the rig found for each leg
  //   sp.set_style(style, { gait?, upper?, feet?, fade? })      a style of the library put on a gait of the species WHILE IT WALKS, for every instance: one command (world.cpp, species.js), checked in whole, the old tables go over to the new ones in `fade` seconds (0.4)
  //   sp.reach = { half, turn_r }      how far the rig can put a foot from its stance place (model units): the worker tells the page when the species is built and when a style moves the ride height; the legs' clock is the stride that fits in it
  //   vehicle: { model?: "car" | "tracked", wheels: [{ bone, radius?, steer?, drive?, brake?, handbrake?, grip? }], top_speed?, grip?, max_steer?, ... }      wheels: [{ bone, radius?, axle? }] | { wheels, coast?, lean? }      couplers: { front: [x, y, z], rear: [x, y, z], ... }
  //                 a WHEELED creature (body.js, species.js, world.cpp): a wheel is a bone whose head is the hub; the worker spins it, steers it and moves it on a suspension, and leans the chassis to the plane through the wheels.
  //                 A `vehicle` is DRIVEN (sp.set_controls(c, { throttle, brake, steer, handbrake }), or by its AI from the wish: sp.set_intent); `wheels` are passive and roll with whatever moves the hub. sp.link(c, leader_sp, leader_c, { from, to, max_angle })
  //                 tows one creature behind another by their couplers (the hitch), sp.unlink(c) frees it.
  //   aircraft: { stall_speed, cruise_speed?, max_speed?, thrust?, engine_speed?, cl_alpha?, cl_max?, incidence?, rates?: { roll, pitch, yaw }, max_bank?, max_pitch?, realism?, assists?, stability?, flaps?, rotation?, pivot?, servo_rate?, surfaces?: [{ bone, control: "aileron" | "elevator" | "rudder" | "flap", gain?, axis? }], propellers?: [{ bone, rpm, idle?, axis? }] }
  //   rotors: [{ bone, role: "main" | "tail" | "lift" | "prop", dir?, omega?, master?, ratio?, spool?, idle?, axis? }]
  //                 an AIRCRAFT (body.js, world.cpp; it needs a body with a gravity and a `vehicle`: its wheels are the landing gear; it has NO legs) is a lifting body: on the ground the vehicle's drive moves it (the throttle, the brakes, the nose wheel of
  //                 the stick), when the wing carries the weight it flies (lift and drag from the angle of attack with a stall, thrust that fades toward `engine_speed`), when its wheels reach the floor it rolls again. It is flown by the PILOT of the wish (sp.set_intent
  //                 a velocity, sp.set_climb: the take-off roll, the rotation at 1.15 stall speeds, a bank toward the heading, a landing, the brakes) or with a STICK (sp.set_controls { throttle, brake, steer, handbrake, pitch, roll, yaw, flaps }); its control surfaces and
  //                 propellers are bones the worker poses (a surface's bone may have a hinge joint in the rig: the limit stop holds it to the real range). ROTORS (a helicopter's, a multicopter's; they need a `flight`) spin with the engine, which is on while it flies:
  //                 a main / prop rotor is governed to `omega` (spool), a lift rotor follows the thrust the hover uses (omega x sqrt(the share used)), a tail rotor is geared to its `master`. sp.flyer is the flight, or for an aircraft a record { model: "plane", ... }.
  //   THE PHYSICS WORLD (SYSTEM.md, "The physics world"; body.js, species.js, world.cpp, world.cpp): a NEAR creature is stopped by and stands on the props of the engine's physics world, and has a PROXY in it that crates meet:
  //   body: { step?, radius? }      the highest prop it climbs onto and how far short of a wall it stops (0.3 and 0.25 of a leg; 0: no props / no walls)
  //   physics: true | { mode?: "off" | "kinematic" | "dynamic", shapes?: [{ id, shape: "sphere" | "box" | "capsule", center | a, b, radius | half | height, bone, rot | rotate, mirror, material }], mass?, density?, friction?, restitution?, creatures?, response?: "yield" | "stop", fit?, max_shapes? }
  //                  a FEW shapes on the bones (declared, or fitted to the mesh / the skeleton): every NEAR instance with a mode has ONE rigid body of the world with them; dynamic: it is pushed (and pushes), kinematic: it only pushes
  //   sp.set_physics(c, "off" | "kinematic" | "dynamic")   sp.push(c, vx, vz, vy)   system.physics_world({ creatures, weight })   system.debug({ shapes: true })   sp.physics: { mode, mass, source, shapes }
  //   COST (SYSTEM.md, "what it costs"): a unit whose inputs did not change costs a copy, a target that moved a little is solved from the last answer, the refinement makes it exact in a few microseconds; two tiers (system.tiers:
  //   the nearest instances are NEAR, the rest FAR and updated every few frames) with a solve of their own, and a budget a frame whose overflow is put off in turn:
  //   system.rig_settings({ near: { iterations, tries, refine }, far: {...}, budget })      system.rig_work / system.rig_deferred: what the rig spent last frame (work units, about a quarter of a microsecond), what it put off
  //   sp.orbit(amplitude, rate)      a driver IN THE WORKER: every chain of every instance circles (the traffic of a gait without a command of the page)
  //   system.debug({ bones, axes, rig, limits, root }, sp?, c?)      what the worker DRAWS: the bones, the chains' targets and poles, the cone of every ball and the arc of every hinge
  //   system.compile(input, max_instances) -> { words, sk, rig }      the pure part: a definition -> the family blob (tests read it without an engine)
  //
  // The design record is SYSTEM.md. The worker is rig.cpp, rig.cpp, rig.cpp, rig.cpp, rig.cpp (the rig's own math) and body.cpp (families, instances, tiers, the skeleton) with body.cpp, body.cpp (the mover) and body.cpp (the gait).

  consts$({
    CMD_HAPPY_INIT: 10810,
    CMD_HAPPY_TIERS: 10820,
    CMD_HAPPY_BLOB: 10830,
    CMD_HAPPY_RESET: 10840,
    CMD_HAPPY_DESTROY: 10850,
    CMD_HAPPY_SPAWN: 10860,
    CMD_HAPPY_RELEASE: 10870,
    CMD_HAPPY_SET_ROOT: 10880,
    CMD_HAPPY_SET_TIER: 10890,
    CMD_HAPPY_BONE: 10900,
    CMD_HAPPY_CHAIN: 10910,
    CMD_HAPPY_DEBUG: 10920,
    CMD_HAPPY_FRAME: 10930,
    CMD_HAPPY_RIG: 10940,
    CMD_HAPPY_ORBIT: 10950,
    CMD_HAPPY_INTENT: 10960,
    CMD_HAPPY_GAIT: 10970,
    CMD_HAPPY_GAIT_BLEND: 10980,
    CMD_HAPPY_TREAD: 10990,
    CMD_HAPPY_LIFE: 11000,
    CMD_HAPPY_STYLE: 11010
  });

  // the worker's side, through the bundler's macros (the engine needs no change): the rig's files and body.cpp are part of the worker, its commands are dispatched, its frame runs after the engine's own, its reply is written
  // into the frame's response. (ik_solvers.cpp, which the classic solvers are, is in the worker already: the engine's physics part puts it there.)


  // the messages of the page to the creatures' functions (CMD_HAPPY_MSG, body.cpp: kept in a ring that the worker's JS reads) and the events that they say back (CMD_HAPPY_EVENTS: appended to the response by the worker's JS)
  consts$({ CMD_HAPPY_MSG: 12020, CMD_HAPPY_EVENTS: 12030 });

  // the body's commands that came after the first ones (a second declaration: the bundler adds them up)
  consts$({
    CMD_HAPPY_JUMP: 13040,
    CMD_HAPPY_PUSH: 13050,
    CMD_HAPPY_FLY: 13060,
    CMD_HAPPY_CLIMB: 13070,
    CMD_HAPPY_CONTROLS: 13080,
    CMD_HAPPY_WINGS: 13090
  });

  // the hitch (world.cpp): a creature towed behind another (a third declaration: the bundler adds them up)
  consts$({
    CMD_HAPPY_LINK: 14100,
    CMD_HAPPY_UNLINK: 14110,
    CMD_HAPPY_SEAT: 14120,
    CMD_HAPPY_SIT: 14130
  });

  // the physics world (world.cpp, world.cpp): the world the creatures' rays and proxies are in is the engine's (worker.cpp's pworld, bound at the start of every payload), and the proxy's commands (a fourth declaration)
  consts$({ CMD_HAPPY_PHYS: 15140, CMD_HAPPY_PHYS_SET: 15150 });

  // a script takes a foot or a knee (body.cpp: the action designer's leg tracks, a kick, a sit, a tuck in the air; a fifth declaration)
  consts$({
    CMD_HAPPY_FOOT: 16160,
    CMD_HAPPY_KNEE: 16170,
    CMD_HAPPY_DRIVE: 16180,
    CMD_HAPPY_HAND: 16190
  });

  // the look, the face and the soft tissue (body.cpp: a goal for the eyes, the head, the neck and the spine; the face's channels, an expression, a blink, a sniff ...; an instance's soft tissue, a soft bone's numbers; a sixth declaration)
  consts$({ CMD_HAPPY_LOOK: 17200, CMD_HAPPY_FACE: 17210, CMD_HAPPY_SOFT: 17220 });

  // CULLING (body.cpp happy_cull_pass; species.js system.cull): the instances outside the frustum of a camera are updated at a coarse rate and the page is told nothing of them. The camera is the engine's: the page gives its id once
  // (CMD_HAPPY_CAMERA), and the worker reads the camera node's frustum planes, which the worker's own frame keeps current, every frame; objects[] is worker.cpp's scope (the one that this case body is in), so the address
  // of the planes is given to system from here (a seventh declaration)
  consts$({ CMD_HAPPY_CULL: 18230, CMD_HAPPY_BOUND: 18240, CMD_HAPPY_CAMERA: 18250 });

  // a hand holds a body of the engine's physics world (world.cpp): the page says the body by its js id, and objects[] (worker.cpp's scope, the one that this case body is in) turns it into the engine's internal id (an eighth declaration)
  consts$({ CMD_HAPPY_GRIP: 19260 });

  // a weight on the creature that no hand holds (a pack: world.cpp's worn loads; species.js sp.wear)
  consts$({ CMD_HAPPY_WEAR: 20270, CMD_HAPPY_DUCK: 20280, CMD_HAPPY_HOLD: 20290 });

  // a creature that dies falls (world.cpp: particles under gravity feed the rig's chains and the root; the page says when: sp.ragdoll)
  consts$({ CMD_HAPPY_RAGDOLL: 21300 });

  // a shot or a blast lands on creatures (world.cpp: the hit zones of an organic creature; species.js sp.impact, system.shoot)
  consts$({ CMD_HAPPY_IMPACT: 22310, CMD_HAPPY_SHOT: 22320, CMD_HAPPY_HEAL: 22330 });

  // the spring chains (body.cpp: hair, strands; an instance's intensity, a chain's number; the last declaration, so that its id is the last: tests/rig_native.h has the same order)
  consts$({ CMD_HAPPY_SCHAIN: 23340 });



  // The code goes into the scope of float_views.js (block$("float_views_core")): it needs the command buffer (ubuff / fbuff / ui) and engine.
  block$(function float_views_core() {
    engine.system = (function () {
      const pure = (function () { const libs = {}; const packing = function () { return function (name, factory) { libs[name] = factory; }; }; import("@/system/pure.js"); return libs; })();          // (the pure modules of pure.js: pure.happy_tissue() makes one)
      const system = {};
      const W = 256;                                    // texels per row of a species' texture (the layout of the rows that a mesh will be drawn with)
      const MAGIC = 0x314d4f53, VERSION = 2, SEC_SKELETON = 2, SEC_RIG = 3;
      const MAX_BONES = 255;
      const DEG = Math.PI / 180;

      // ---- commands: a queue, drained into the engine's command buffer a little every frame ------------------------------------------------------------
      // The buffer is 4096 words and keeps filling while the worker is busy, with no guard of its own: a command is only moved when it fits under
      // the budget, whole, in order.
      const opts = { command_budget: 2800 };
      let queue = new Uint32Array(1 << 15), queue_f = new Float32Array(queue.buffer), qlen = 0, qhead = 0;
      function q_begin(n) {                             // reserve a command of n words: [n] cmd args...
        if (qlen + n + 1 > queue.length) {
          if (qhead > 0) { queue.copyWithin(0, qhead, qlen); qlen -= qhead; qhead = 0; }
          if (qlen + n + 1 > queue.length) { const q2 = new Uint32Array(queue.length * 2); q2.set(queue.subarray(0, qlen)); queue = q2; queue_f = new Float32Array(queue.buffer); }
        }
        queue[qlen++] = n;
      }
      function q_u(v) { queue[qlen++] = v >>> 0; }
      function q_f(v) { queue_f[qlen++] = v; }
      function drain() {
        while (qhead < qlen) {
          const n = queue[qhead];
          if (ui + n > opts.command_budget) break;
          for (let k = 1; k <= n; k++) ubuff[ui++] = queue[qhead + k];
          qhead += n + 1;
        }
        if (qhead === qlen) qhead = qlen = 0;
      }
      system.queued_words = function () { return qlen - qhead; };

      // ---- the parts: files of js/, included below in this order by the bundler's import directive. They are ONE closure (each sees the names of the ones before it and of this file), cut at the places where the file
      // was one: a new layer of system is a new part here. mirror: the left half of a definition made whole · skeleton: the bind frames · rig: the joints' limits and the chains, compiled · gaits: the library of gait
      // styles · legs: the legs and the body, compiled · roles: the roles and the traits · blob: the family blob · mesh: the mesh as plain arrays and the skinning shaders · integral: the built in mesher · sdf: the geometry of an sdf · species: init, the species, the instances and the page's calls on them · draw: the texture, the material and the instanced draw · frame: the worker's frame record
import("@/system/kernel.js");
import("@/system/body.js");
import("@/system/species.js");
import("@/system/runtime.js");
      return system;
    })();
  });

  // THE WORKER'S JS SIDE (happy_worker/, SYSTEM.md "The worker's logic"): the game logic of the creatures (their actions, their AI) is JS that runs in the worker thread, where the physics world and the whole environment are, and
  // that reads and writes the columns of the families straight in the wasm memory. This block is put into worker.js, where `wa` (the wasm's exports), `env` and `engine` are: engine.happy_worker = { cols, K, D, ... }
  //   cols      the columns' views of a family (pure.js: cols.family(js_id), cols.refresh(fam), cols.constants())           D     the commands of the page written into those columns (pure.js)
  // The page can ask the worker to hold D to the commands on the real memory: engine._worker.postMessage({ call: "happy_worker_selftest", js: <family js id> }) answers engine.happy_worker_selftest_report({ report }) in the page
  // (pure.js: the family needs two live instances).
  block$(function worker_process() {
    engine.happy_worker = (function () {
      const pure = (function () { const libs = {}; const packing = function () { return function (name, factory) { libs[name] = factory; }; }; import("@/system/pure.js"); return libs; })();          // (the worker has its own: the page's closure is another scope)
      const C = pure.happy_worker_columns();
      const Direct = pure.happy_worker_direct();
      const Self = pure.happy_worker_selftest();
      const Core = pure.happy_worker_core();
      const Player = pure.happy_action_player();
      const Act = pure.happy_worker_actions();
      const Blend = pure.happy_gait_blend();
      const Spec = pure.happy_action_spec();
      const Design = pure.happy_worker_design();
      const Logic = pure.happy_worker_logic();
      const Grid = pure.happy_worker_grid();
      const Bt = pure.happy_worker_bt();
      const World = pure.happy_worker_world();
      const Fingers = pure.happy_worker_fingers();
      const Grab = pure.happy_worker_grab();
      const Slots = pure.happy_worker_gait_slots();
      // THE WORLD A CREATURE IS HOSTED IN (SYSTEM.md): the nav, the blackboard, the world service and the block modules a creature's tree loads by name
      const WNav = pure.happy_world_nav();
      const Goap = pure.happy_worker_goap();
      const Board = pure.happy_worker_board();
      const SWorld = pure.happy_worker_sworld();
      const Modules = pure.happy_worker_modules();
      const Data = (function () { let lib = null; const packing = function () { return function (name, factory) { lib = factory(); }; }; import("@/system/data.js"); return lib; })();          // (the pack's reader: the worker reads system.bin itself)
      const cols = C.create({ columns: wa.happy_columns, serials: wa.happy_serials, constants: wa.happy_constants, buffer: function () { return env.memory.buffer; } });
      const w = { cols: cols, Self: Self, Data: Data, core: Core, slots: Slots.create({ fields: Core.system.GAIT_FIELDS }), K: null, D: null, families: {}, species: {}, pools: {}, plans: {}, arts: {}, A: null, lib: null, logic: null, world: null, grip: null, loading: Promise.resolve(), scratch: null };
      // the constants and the direct writes are made when they are first asked for (the wasm has to be started: it is, when the first family is built)
      w.start = function () {
        if (!w.D) { w.K = cols.constants(); w.D = Direct.create(w.K, { check: true }); w.A = Act.create({ player: Player, D: w.D, K: w.K }); w.lib = w.A.library();
          Spec.use_player(Player);
          w.design = Design.create({ B: Blend, S: Spec, gaits: Core.system.gaits, find_action: function (ref) { return w.lib.named[ref] || null; } });
          // what a creature's rays ask of the physics world (phy_world_raycast: the props and the terrain, not the creatures' own proxies); the hit is read from the struct the wasm fills
          let hit_at = 0;
          w.world = { ray: function (ox, oy, oz, dx, dy, dz, max, hit) {
            if (!hit_at) hit_at = wa.phy_create_raycast_hit();
            if (!wa.phy_world_raycast(phys_world, ox, oy, oz, dx, dy, dz, max, w.K.WORLD_MASK, 0, 0, hit_at)) return -1;
            const v = new Float32Array(env.memory.buffer, hit_at, 7);
            for (let i = 0; i < 7; i++) hit[i] = v[i];
            return v[0];
          } };
          // what a creature's brain asks of the bodies of the physics world and of its own hands (world.cpp's exports: the answers are in two static buffers of the wasm's memory, read through views made again when the memory grows)
          if (typeof wa.happy_grip_do === "function") {
            const gv = { buf: null, ids: null, rec: null };
            const gviews = function () { if (gv.buf !== env.memory.buffer) { gv.buf = env.memory.buffer; gv.ids = new Int32Array(gv.buf, wa.happy_grip_ids(), 64); gv.rec = new Float32Array(gv.buf, wa.happy_grip_rec(), 16); } };
            w.grip = {
              cmd: function (js, slot, gen, arm, op, body, x, y, z, flags) { return wa.happy_grip_do(js, slot, gen, arm, op, body, x, y, z, flags); },
              hold: function (js, slot, gen, arm, op, a, b, c, d, e, f) { return wa.happy_hold_do(js, slot, gen, arm, op, a, b, c, d, e, f); },
              wear: function (js, slot, gen, op, id, bone, x, y, z, kg) { return wa.happy_wear_do(js, slot, gen, op, id, bone, x, y, z, kg); },
              duck: function (js, slot, gen, on, margin) { return wa.happy_body_duck(js, slot, gen, on, margin); },
              read: function (js, slot, what) { return wa.happy_body_value(js, slot, what); },
              held: function (js, slot, arm) { return wa.happy_grip_state(js, slot, arm) > 0.5; },
              heavy: function () { return wa.happy_grip_stat(5); },
              load: function (js, slot) { return wa.happy_body_value(js, slot, 13); },
              body: function (id) { if (!(id > 0) || wa.happy_grip_body(id) === 0) return null; gviews(); return gv.rec; },
              find: function (x, y, z, r, out) { const n = wa.happy_grip_find(x, y, z, r, out.length > 64 ? 64 : out.length); gviews(); for (let i = 0; i < n; i++) out[i] = gv.ids[i]; return n; }
            };
          }
          // the world service's shared pieces: one blackboard, one world, one registry of block modules for every family of the worker; the random numbers are a generator of their own (the same run, the same points)
          let wrand = 2463534242;
          w.board = Board.create({ records: 4096, events: 512, keys: 256 });
          w.sworld = SWorld.create({ Nav: WNav, board: w.board, post: function (name, data) { engine.call_main(name, data); }, rand: function () { wrand ^= wrand << 13; wrand ^= wrand >>> 17; wrand ^= wrand << 5; return (wrand >>> 0) / 4294967296; } });
          w.board.on_public = w.sworld.fact;
          w.modules = Modules.create({ params_of: function (name) { return w.block_params && w.block_params[name] ? w.block_params[name] : null; } });
          w.logic = Logic.create({ board: w.board, goap: Goap.create(), sworld: w.sworld, modules: w.modules, cols: cols, D: w.D, K: w.K, lib: w.lib, A: w.A, slots: w.slots, core: w.core, grab: Grab, grip: w.grip || null, fingers: Fingers, bone_scale: function (js, slot, gen, bone, s) { return typeof wa.happy_skeleton_scale === "function" ? wa.happy_skeleton_scale(js, slot, gen, bone, s) : 1; },
            pose_bone: function (js, slot, gen, bone, rx, ry, rz, stiffness, tx, ty, tz) { return wa.happy_skeleton_pose(js, slot, gen, bone, tx || 0, ty || 0, tz || 0, rx, ry, rz, stiffness); }, species: function (js) { return w.species[js] || null; }, plan: function (js) { return w.plans[js] || null; },
            family: function (js) { return w.family(js); }, world: w.world, design: w.design, bt: Bt, grid: Grid, world_service: World, post: function (name, data) { engine.call_main(name, data); },
            floor: typeof wa.phy_ground_height === "function" ? function (x, z) { return wa.phy_ground_height(x, z); } : undefined });          // (me.alt: the height over the terrain the creatures stand on; the engine's own query)
        }
        return w;
      };
      w.family = function (js) { return w.families[js] || (w.families[js] = cols.family(js)); };
      // once a frame, before the system frame (the hook of worker_payload_response, below): the creatures' hooks. The time is the last frame's (happy_frame tells it: the column FRAME_DT)
      // THE MESSAGES (CMD_HAPPY_MSG, body.cpp) are in the ring that body.cpp keeps: the logic delivers them to the creatures' msg hooks, then the frame; what the creatures said is appended to the response (CMD_HAPPY_EVENTS)
      // by w.events, which the worker calls once the response is made (engine.worker_on_immediate: the engine's own hook)
      let mail_ptr = 0, mail_buf = null, mail_u = null, mail_f = null;
      w.frame = function () {
        const L = w.logic;
        if (L === null) return;
        const cs = L.contexts();
        if (cs.length === 0) return;
        if (mail_buf !== env.memory.buffer) {                                                                // (the views onto the ring: made again only when the wasm's memory has grown)
          if (!mail_ptr) mail_ptr = wa.happy_mail();
          mail_buf = env.memory.buffer;
          mail_u = new Uint32Array(mail_buf, mail_ptr, 3 + 16384); mail_f = new Float32Array(mail_buf, mail_ptr, 3 + 16384);
        }
        L.dispatch(mail_u, mail_f);
        cols.refresh(cs[0].fam);
        let dt = cs[0].fam.FRAME_DT !== null ? cs[0].fam.FRAME_DT[0] : 0;
        if (!(dt > 0 && dt < 0.25)) dt = 1 / 60;
        L.tick(dt);
        if (L.said() > 0 || L.tags_new()) engine.worker_on_immediate.push(w.events);
      };
      w.events = function (u32, f32, i) { return w.logic.emit(u32, f32, i, CMD_HAPPY_EVENTS); };
      // the action runtime of an installed family (pure.js): its plan is given by the page (sp.worker_action_plan); the library is read by the worker (system.worker_actions)
      w.action_rt = function (js) {
        w.start();
        if (!w.plans[js]) throw new Error("no action plan for species " + js + " (sp.worker_action_plan)");
        return w.arts[js] || (w.arts[js] = w.A.family(w.family(js), w.plans[js], { lib: w.lib }));
      };
      // the pool of gait slots of an installed family (pure.js): the styles an instance of it can walk
      w.pool = function (js) {
        if (!w.species[js]) throw new Error("no species " + js + " was installed (sp.worker_install)");
        return w.pools[js] || (w.pools[js] = w.slots.pool(w.family(js), { base: w.species[js].declared }));
      };
      w.scratch_make = function () {                                                       // (64 words of the wasm's memory that a test may give to an export as a pointer)
        if (!w.scratch) { const at = wa.alloc(64 * 4); w.scratch = { at: at, words: new Uint32Array(env.memory.buffer, at, 64), floats: new Float32Array(env.memory.buffer, at, 64) }; }
        return w.scratch;
      };
      return w;
    })();
    // what the families' logic cost, asked by the page (system.worker_logic_stats(opts), runtime.js): { timing: true | false } turns the clock on or off, { reset: true } starts the counts again; the answer is L.report()
    engine.happy_worker_logic_stats = function (m) {
      const w = engine.happy_worker;
      w.start();
      if (m.timing !== undefined) w.logic.timing = !!m.timing;
      if (m.reset) w.logic.reset_stats();
      engine.call_main("happy_worker_logic_stats_reply", { id: m.id, report: w.logic.report() });
    };
    // what the worker keeps of a species (sp.worker_install, runtime.js): the data the core compiles a style with. The libraries of gait styles are read by the worker itself (system.worker_gaits(urls))
    engine.happy_worker_install = function (m) {
      try { engine.happy_worker.species[m.js] = engine.happy_worker.core.family(m); }
      catch (e) { engine.call_main("happy_worker_error", { what: "install " + m.js, message: String(e && e.message || e) }); }
    };
    // the libraries of actions (happy_actions/*.json), read by the worker itself and registered by name (each is compiled when it is first used)
    engine.happy_worker_actions = function (m) {
      const w = engine.happy_worker.start();
      const p = Promise.all(m.urls.map(function (u) { return fetch(u, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status + " " + u); return r.json(); }).then(function (j) { return w.lib.register(j.actions || [], j.name || null); }); })).then(function (counts) {
        engine.call_main("happy_worker_actions_done", { urls: m.urls, counts: counts });
      }).catch(function (e) { engine.call_main("happy_worker_error", { what: "actions", message: String(e && e.message || e) }); });
      w.loading = Promise.all([w.loading, p]);
    };
    engine.happy_worker_action_plan = function (m) { engine.happy_worker.plans[m.js] = m.plan; };
    // two instances of an installed family given the same action, one by the page's runtime (it has begun it) and one here: the worker plays it on instance m.slot, held at the time m.tau, every 16 ms of its own clock (a test's driver: the
    // game's own loop is the frame hook); engine.happy_worker_action_compare then reads the columns of both
    engine.happy_worker_action_run = function (m) {
      try {
        const w = engine.happy_worker.start(), rt = w.action_rt(m.js), id = w.lib.get(m.name);
        w.cols.refresh(w.family(m.js));
        rt.start(m.slot, id); rt.power(m.slot, m.power); rt.speed(m.slot, m.speed); rt.mirror(m.slot, m.mirror);
        if (m.target) rt.target_point(m.slot, m.target[0], m.target[1], m.target[2]);
        if (m.tau >= 0) rt.hold(m.slot, m.tau);
        if (w.ticker) clearInterval(w.ticker);
        let last = Date.now();
        w.ticker = setInterval(function () {
          const now = Date.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
          const fam = w.family(m.js);
          w.cols.refresh(fam);
          rt.update(dt);
        }, 16);
        engine.call_main("happy_worker_action_started", { id: id, name: m.name });
      } catch (e) { engine.call_main("happy_worker_error", { what: "action_run", message: String(e && e.stack || e) }); }
    };
    engine.happy_worker_action_compare = function (m) {
      let report;
      try {
        const w = engine.happy_worker.start(), fam = w.family(m.js);
        w.cols.refresh(fam);
        report = w.Self.compare_actions({ fam: fam, a: m.a, b: m.b, K: w.K, pose_tol: m.pose_tol });
        report.playing = [w.action_rt(m.js).playing(m.a), w.action_rt(m.js).playing(m.b)];
      } catch (e) { report = { total: 0, failed: ["the comparison threw: " + (e && e.stack || e)] }; }
      engine.call_main("happy_worker_action_report", { report: report });
    };
    engine.happy_worker_action_stop = function (m) { if (engine.happy_worker.ticker) { clearInterval(engine.happy_worker.ticker); engine.happy_worker.ticker = null; } if (m && m.slot !== undefined) { engine.happy_worker.action_rt(m.js).end(m.slot); } };
    engine.happy_worker_gaits = function (m) {
      const w = engine.happy_worker, gaits = w.core.system.gaits;
      const p = Promise.all(m.urls.map(function (u) {
        return gaits.load(u);
      })).then(function (lists) {
        engine.call_main("happy_worker_gaits_done", {
          urls: m.urls, count: gaits.names().length
        });
      }).catch(function (e) { engine.call_main("happy_worker_error", { what: "gaits", message: String(e && e.message || e) }); });
      w.loading = Promise.all([w.loading, p]);                                                              // (a creature's function waits for the libraries it asks for)
    };
    // the libraries of system.bin, read by the worker itself (system.worker_pack, runtime.js): gait libraries into its registry, action sets into its library (each action is compiled when it is first used)
    engine.happy_worker_pack = function (m) {
      const w = engine.happy_worker.start(), gaits = w.core.system.gaits;
      const p = w.Data.load(m.url).then(function (pack) {
        return Promise.all((m.gaits || []).map(function (n) { return pack.tree("gaits." + n).then(function (f) { pack.drop("gaits." + n); return gaits.add(f.gaits).length; }); })
          .concat((m.actions || []).map(function (n) { return pack.tree("actions." + n).then(function (f) { pack.drop("actions." + n); return w.lib.register(f.actions || [], f.name || n); }); })));
      }).then(function (counts) { engine.call_main("happy_worker_pack_done", { url: m.url, counts: counts }); })
        .catch(function (e) { engine.call_main("happy_worker_error", { what: "pack", message: String(e && e.message || e) }); });
      w.loading = Promise.all([w.loading, p]);                                                              // (a creature's function waits for the libraries it asks for)
    };
    // THE BLOCK MODULES (system.worker_modules, runtime.js): block files read by the worker itself (a url of one file, or of a JSON bundle { blocks: { name: text } }) or given as texts; a creature's function waits for them
    engine.happy_worker_modules = function (m) {
      const w = engine.happy_worker.start();
      const reg = function (name, text) { w.modules.register(name, text); };
      if (m.texts) for (const k in m.texts) reg(k, m.texts[k]);
      const p = Promise.all((m.urls || []).map(function (u) {
        return fetch(u, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status + " " + u); return r.text(); }).then(function (text) {
          if (/\.json(\?|$)/.test(u)) { const j = JSON.parse(text); for (const k in j.blocks) reg(k, j.blocks[k]); return Object.keys(j.blocks).length; }
          reg(u.replace(/[?#].*$/, "").replace(/^.*\//, "").replace(/\.js$/, ""), text); return 1;
        });
      })).then(function (counts) { engine.call_main("happy_worker_modules_done", { urls: m.urls, counts: counts }); })
        .catch(function (e) { engine.call_main("happy_worker_error", { what: "modules", message: String(e && e.message || e) }); });
      w.loading = Promise.all([w.loading, p]);
    };
    // a WORLD (system.worker_world, runtime.js): its spec is baked and indexed here, and the creature blocks it brings are registered; the state its page changes later comes as diffs
    engine.happy_worker_world = function (m) {
      const w = engine.happy_worker.start();
      w.loading = w.loading.then(function () {
        try {
          w.sworld.install(m.spec);
          w.block_params = m.spec.block_params || {};
          for (const k in (m.creature_blocks || {})) w.modules.register_source(k, m.creature_blocks[k]);
          engine.call_main("happy_worker_world_ready", { name: m.spec.name });
        } catch (e) { engine.call_main("happy_worker_error", { what: "world", message: String(e && e.stack || e) }); }
      });
    };
    engine.happy_worker_world_state = function (m) { const w = engine.happy_worker.start(); w.loading = w.loading.then(function () { w.sworld.apply(m.diff); }); };
    // a creature's function (sp.worker_context, runtime.js): its source, evaluated and called once for the family when the libraries that were asked for are in (and the world, and the block modules: they are
    // earlier in the same chain). Nothing is put into its source: the blocks it uses are LOADED by name from its own code (api.blocks.load, pure.js)
    engine.happy_worker_context = function (m) {
      const w = engine.happy_worker.start();
      w.loading = w.loading.then(function () {
        try {
          const src = m.src;
          w.logic.install(m.js, src, { name: m.name, max: m.max, mind: m.mind, defs: m.defs, cfg: m.cfg });
          engine.call_main("happy_worker_context_ready", { js: m.js, tags: w.lib.tags.slice() });
        } catch (e) { engine.call_main("happy_worker_error", { what: "context " + m.name, message: String(e && e.stack || e) }); }
      });
    };
    // a plan of a style for an installed species, asked for by a test (the page compares it with its own): the plan's own parts as plain data (the tables are typed arrays, which a structured clone carries)
    engine.happy_worker_plan_probe = function (m) {
      let out;
      try {
        const h = engine.happy_worker.species[m.js];
        if (!h) throw new Error("no species " + m.js + " was installed");
        if (m.style_legs) h.style_legs = m.style_legs;
        const p = engine.happy_worker.core.plan(h, m.style, m.o);
        out = { plan: p };
      } catch (e) { out = { error: String(e && e.message || e) }; }
      out.id = m.id;
      engine.call_main("happy_worker_plan_report", out);
    };
    // a style written into a spare gait slot by the worker, held to the same style written by the page's own set_style (the C++ command) into another gait: asked for by a test (pure.js: slots)
    engine.happy_worker_slot_test = function (m) {
      let report;
      try {
        const w = engine.happy_worker.start();
        report = w.Self.slots({ cols: w.cols, fam: w.family(m.js), pool: w.pool(m.js), core: w.core, h: w.species[m.js], style: m.style, cpp_gait: m.cpp_gait, spare: m.spare, o: m.o });
      } catch (e) { report = { total: 0, failed: ["the slot test threw: " + (e && e.stack || e)], notes: [] }; }
      engine.call_main("happy_worker_slot_report", { report: report });
    };
    // two instances of an installed family at the same wish, one on gait 0 and one on a style that the worker put in a spare slot by itself (the pool, pure.js), the walk cycle of each sampled for m.ms: how far it turned,
    // unwrapped (the cycle is 0 .. 1): the legs of the instance on the style go at the style's own pace. Asked for by a test; the answer is happy_worker_slot_run_report
    engine.happy_worker_slot_run = function (m) {
      try {
        const w = engine.happy_worker.start(), fam = w.family(m.js), pool = w.pool(m.js), D = w.D;
        w.cols.refresh(fam);
        const alive = [];
        for (let i = 0; i < fam.max && alive.length < 2; i++) if (fam.ALIVE[i]) alive.push(i);
        if (alive.length < 2) throw new Error("the family needs two live instances");
        const base = alive[0], fast = alive[1];
        const plan = w.core.plan(w.species[m.js], m.style, { gait: m.spare }), id = pool.add(plan), slot = pool.load(id);
        if (slot < 0) throw new Error("no spare slot");
        pool.assign(base, 0); pool.assign(fast, slot);
        D.intent(fam, base, 0, m.speed, 0, 0); D.intent(fam, fast, 0, m.speed, 0, 0);
        const last = [fam.CYCLE[base], fam.CYCLE[fast]], turned = [0, 0], t0 = Date.now(), seen = { a: [fam.GAIT_A[fast], fam.GAIT_B[fast], fam.GAIT_T[fast]] };
        const timer = setInterval(function () {
          w.cols.refresh(fam);
          const c = [fam.CYCLE[base], fam.CYCLE[fast]];
          for (let k = 0; k < 2; k++) { let d = c[k] - last[k]; if (d < -0.5) d += 1; else if (d > 0.5) d -= 1; if (d > 0) turned[k] += d; last[k] = c[k]; }          // (the cycle only goes forward: a step back is a wrap)
          if (Date.now() - t0 >= m.ms) {
            clearInterval(timer);
            D.intent(fam, base, 0, 0, 0, 0); D.intent(fam, fast, 0, 0, 0, 0);
            engine.call_main("happy_worker_slot_run_report", { ok: true, slot: slot, base: base, fast: fast, turned: turned, stride0: fam.GAIT_NUM[fam.GAIT_NUM_N * 0 + w.core.system.GAIT_FIELDS.indexOf("stride")], stride_slot: fam.GAIT_NUM[fam.GAIT_NUM_N * slot + w.core.system.GAIT_FIELDS.indexOf("stride")], speed0: fam.GAIT_NUM[w.core.system.GAIT_FIELDS.indexOf("speed")], speed_slot: fam.GAIT_NUM[fam.GAIT_NUM_N * slot + w.core.system.GAIT_FIELDS.indexOf("speed")], ms: Date.now() - t0, on: seen.a, a: fam.GAIT_A[fast], b: fam.GAIT_B[fast], a0: fam.GAIT_A[base] });
          }
        }, 20);
      } catch (e) { engine.call_main("happy_worker_slot_run_report", { ok: false, error: String(e && e.stack || e) }); }
    };
    engine.happy_worker_message = function (m) { const w = engine.happy_worker; w.loading.then(function () { if (w.logic !== null) w.logic.message(m.js, m.data); }); };
    engine.happy_worker_selftest = function (m) {
      let report;
      try {
        const w = engine.happy_worker.start();
        report = w.Self.run({ wa: wa, cols: w.cols, fam: w.family(m.js), D: w.D, K: w.K, js: m.js, scratch: w.scratch_make() });
      } catch (e) { report = { total: 0, failed: ["the selftest threw: " + (e && e.stack || e)], notes: [], ops: {} }; }
      engine.call_main("happy_worker_selftest_report", { report: report });
    };
  });

  // the creatures' logic runs once a frame in the worker, BEFORE the system frame (this hook is in the worker's onmessage after the last frame's response was made and before the commands of this payload and happy_frame are run)
  block$(function worker_payload_response() {
    if (engine.happy_worker !== undefined) engine.happy_worker.frame();
  });

  // the worker's answer, in the response loop of the engine (the hook is after the engine's own switch; `i` points after the command id)
  block$(function engine_worker_message() {
    switch (cmd) {
      case CMD_HAPPY_FRAME:
        i = engine.system.on_frame(u32, f32, i);
        break;
      case CMD_HAPPY_EVENTS:                                                                                  // what the creatures said in the frame the worker has just made (runtime.js)
        i = engine.system.on_events(u32, f32, i);
        break;
    }
  });
  // =============================================================================================================================================
  // THE PACK: system.bin (data.js says how it is laid out)
  // =============================================================================================================================================
  // It goes into the engine's own scope (block$("engine_core"), as debug.js does): engine.system is made by float_views_core, which the engine includes before it, and the pack's API is put on it.
  block$(function engine_core() {
    (function () {
      const system = engine.system;
      const data = (function () { let lib = null; const packing = function () { return function (name, factory) { lib = factory(); }; }; import("@/system/data.js"); return lib; })();
      system.data = data; system.pack = null; system.url = null; system.size = 0;
      const need = function () { if (system.pack === null) throw new Error("system: load() the system first (system.load(url) -> Promise)"); return system.pack; };

      // The worker reads the libraries itself (system.worker_pack, system.worker_modules) and says so with a message when it has: a promise of the next message of a kind, in the order the readings were asked for
      // (a page with no worker asks for none, and waits for none: system.use does the same)
      const worker_waiters = { pack: [], modules: [] };
      const worker_next = function (kind) {
        if (!engine._worker || typeof engine._worker.postMessage !== "function") return Promise.resolve(null);
        return new Promise(function (resolve, reject) { worker_waiters[kind].push({ resolve: resolve, reject: reject }); });
      };

      // system.load(url?, { all? }) -> Promise<system>
      //   one fetch of the pack: nothing in it is unzipped until it is asked for (the sections are read as the API asks).
      //   { all: true } is LOAD ALL: the whole system in ONE promise. When it resolves everything is in and nothing waits for anything: the gait styles and the action sets in the page's registry AND in the worker's (the worker has read
      //   them itself), the AI's blocks registered in the worker, the lite human's file read, the AI's clip sets made.
      //   `system.loaded` says what it did: { all, ms, stages: { libraries, blocks, human, clip_sets (ms each: they run together) }, size, sections, gait_libraries, gait_styles, action_sets, actions, blocks, human }.
      //   A page that needs less loads less: system.load(url), then system.use({ gaits: [names], actions: [names] }) and whatever it calls (system.make_creature ...) reads its own sections when it is first asked.
      system.load = function (url, opts) {
        url = url || "/system/system.bin";
        return data.load(url).then(function (pack) {
          system.pack = pack; system.url = url; system.size = pack.size;
          return opts && opts.all ? load_all() : system;
        });
      };
      function load_all() {
        const clock = typeof performance !== "undefined" && performance.now ? function () { return performance.now(); } : Date.now, t0 = clock(), ms = {};
        const stage = function (name, p) { const t = clock(); return Promise.resolve(p).then(function (v) { ms[name] = Math.round(clock() - t); return v; }); };
        const sets = system.actions.sets(), libs_n = system.gaits.libraries().length + sets.length;
        // the styles and the sets: the page and the worker are given them at once, and the promise holds until the worker says it has read them
        const libraries = stage("libraries", !libs_n ? { gaits: 0, actions: 0 } : (function () {
          const done = worker_next("pack");
          return system.use({ gaits: "all", actions: "all" }).then(function (used) { return done.then(function () { return used; }); });
        })());
        const blocks = stage("blocks", system.ai.blocks().then(function (b) {
          const n = Object.keys(b.texts).length;
          if (!n) return 0;
          const done = worker_next("modules");
          return system.ai.use("all").then(function () { return done.then(function () { return n; }); });
        }));
        const human = stage("human", system.human_lite_model());
        const clips = stage("clip_sets", system.ai.clip_sets());
        return Promise.all([libraries, blocks, human, clips]).then(function (r) {
          system.loaded = {
            all: true, ms: Math.round(clock() - t0), stages: ms, size: system.size, sections: system.sections().length, gait_libraries: system.gaits.libraries().length, gait_styles: r[0].gaits, action_sets: sets.length,
            actions: sets.reduce(function (n, s) { return n + (s.count || 0); }, 0), blocks: r[1], human: !!r[2]
          };
          return system;
        });
      }
      system.sections = function (prefix) { return need().names(prefix); };
      system.info = function (name) { return need().info(name); };
      system.tree = function (name) { return need().tree(name); };
      system.bytes = function (name) { return need().bytes(name); };

      // a family of sections ("gaits.people", "actions.designed_basic"): the listing is the header's, the content is unzipped when asked for
      const family = function (prefix, shape) {
        return {
          list: function () { const p = need(); return p.names(prefix + ".").map(function (n) { return shape(n.slice(prefix.length + 1), p.info(n).meta || {}); }); },
          get: function (name) { const p = need(); if (!p.has(prefix + "." + name)) throw new Error("system." + prefix + ": no '" + name + "' (it has: " + p.names(prefix + ".").map(function (n) { return n.slice(prefix.length + 1); }).join(", ") + ")"); return p.tree(prefix + "." + name); }
        };
      };
      const gaits = family("gaits", function (name, meta) { return { name: name, count: meta.count, legs: meta.legs }; });
      const actions = family("actions", function (name, meta) { const o = { name: name, count: meta.count, about: meta.about }; if (meta.preset) o.preset = true; return o; });
      system.gaits.libraries = gaits.list; system.gaits.library = gaits.get;                    // (system.gaits is the registry of styles, kernel.js: the libraries of the pack are put beside it)
      system.actions = { sets: actions.list, set: actions.get };

      // the libraries into the creatures' hands
      system.use = function (what) {
        const p = need();
        what = what || { gaits: "all", actions: "all" };
        const pick = function (prefix, want) {
          const all = p.names(prefix + ".").map(function (n) { return n.slice(prefix.length + 1); }), names = want === "all" ? all : (want || []);
          names.forEach(function (n) { if (all.indexOf(n) < 0) throw new Error("system: use: no " + prefix + " '" + n + "' in " + system.url + " (it has: " + all.slice(0, 8).join(", ") + (all.length > 8 ? " ..." : "") + ")"); });
          return names;
        };
        const g = pick("gaits", what.gaits), a = pick("actions", what.actions);
        if ((g.length || a.length) && engine._worker && typeof engine._worker.postMessage === "function") system.worker_pack(system.url, { gaits: g, actions: a });
        return Promise.all(g.map(function (n) { return p.tree("gaits." + n).then(function (f) { p.drop("gaits." + n); return system.gaits.add(f.gaits).length; }); })).then(function (counts) {
          return { gaits: counts.reduce(function (x, y) { return x + y; }, 0), actions: a.length };
        });
      };
      // what the worker says of the libraries it was given (system.worker_pack) and of anything that went wrong in it
      engine.happy_worker_pack_done = function (m) { system.worker_loaded = m; const w = worker_waiters.pack.shift(); if (w) w.resolve(m); };
      engine.happy_worker_modules_done = function (m) { const w = worker_waiters.modules.shift(); if (w) w.resolve(m); };
      engine.happy_worker_error = function (m) {
        (system.worker_errors = system.worker_errors || []).push(m); console.error("system: worker: " + m.what + ": " + m.message);
        const q = worker_waiters[m.what], w = q ? q.shift() : null;                                                // (a reading that failed: the promise that waited for it fails with it)
        if (w) w.reject(new Error("system: worker: " + m.what + ": " + m.message));
      };
    })();
  });
});
