"use strict";
// jeep: an open four wheel car for two with a DOOR on each side. In soma's one form of a creature file (soma/creature_file.js): the body is the creature as it was made, the mind is the blocks of soma/world/blocks/ it loads and its tree.
// jeep: 3.9 m long, 1.7 m wide, an open tub, a folded windscreen frame and a roll bar. ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature { name, family, nav, body, abilities, interaction, mind }.
// Metres, +x to its left, +y up, +z forward, the wheels on y = 0 (a wheel is a bone whose HEAD is the hub). A VEHICLE of the car model: the front wheels steer, all four drive; 12 m/s.
// SEATS AND DOORS (soma/js/seat_api.js, SOMA.md "Seats and doors"): two seats (the driver on the left, the passenger on the right), each with the pedals under its feet, the wheel under the driver's hands, and a door that it gets in by.
// A DOOR is a bone hinged at its FRONT edge (its head is the hinge, it runs back along the door: the hinge turns across it): the left one opens with a negative angle about up, the right one with a positive. A rider stands behind the
// open door, at the `at` of the door, and sits at once (the sitting down is not animated). Its hips are the `at` of the seat: 0.14 over the cushion.
const WR = 0.36, TRACK = 0.8, ZF = 1.25, ZR = -1.1;
const bones = [
  { name: "root", head: [0, 0.36, -1.4], tail: [0, 0.36, 1.4] },
  { name: "door_l", parent: "root", head: [0.86, 0.76, 0.38], tail: [0.86, 0.76, -0.62], mirror: "x" },
  { name: "wheel_f_l", parent: "root", head: [TRACK, WR, ZF], tail: [TRACK, WR + 0.1, ZF], mirror: "x" },
  { name: "wheel_r_l", parent: "root", head: [TRACK, WR, ZR], tail: [TRACK, WR + 0.1, ZR], mirror: "x" },
];
const rig = {
  joints: [
    { bone: "door_l", kind: "hinge", axis: [0, 1, 0], range: [-100, 0] },                    // (the left door swings out with a negative turn about up)
    { bone: "door_r", kind: "hinge", axis: [0, 1, 0], range: [0, 100] },
  ],
  chains: [],
};
const body = { max_speed: 12, accel: 4, turn_rate: 1.8, gravity: 19.8, step: 0.3, radius: 1.9 };                // (step: the highest prop of the physics world its wheels climb onto, radius: how far short of a wall it stops)
const vehicle = { model: "car", wheels: [{ bone: "wheel_f_l" }, { bone: "wheel_f_r" }, { bone: "wheel_r_l" }, { bone: "wheel_r_r" }], top_speed: 12, grip: 6, max_steer: 0.5, steer_rate: 4, steer_speed: 10, travel: 0.06, follow: 10, lean: 1 };
const couplers = { rear: [0, 0.6, -2.0], front: [0, 0.6, 1.95] };
// THE DOORS: the bone, how far it swings (radians), how fast, and where a rider stands to get in (outside, behind the open door)
const doors = {
  left: { bone: "door_l", open: -1.0, speed: 3, at: [1.25, 0, -0.45] },
  right: { bone: "door_r", open: 1.0, speed: 3, at: [-1.25, 0, -0.45] },
};
// THE SEATS: the hips of the rider (0.14 over the cushion), the yaw (0: it faces the front), the two ankles (on the pedals, on the floor), the two hands (the wheel's rim, at ten and two), the door, where it stands outside
const seats = {
  driver: { at: [0.4, 0.72, -0.3], yaw: 0, feet: { left: [0.52, 0.5, 0.28], right: [0.3, 0.5, 0.33] }, hands: { left: [0.555, 1.1, 0.23], right: [0.245, 1.1, 0.23] }, door: "left", exit: [1.25, 0, -0.45] },
  passenger: { at: [-0.4, 0.72, -0.3], yaw: 0, feet: { left: [-0.28, 0.5, 0.28], right: [-0.5, 0.5, 0.28] }, door: "right", exit: [-1.25, 0, -0.45] },
};

// SDF (the mesher's grammar: soma/SOMA_MESHER.md; a part stands on a bone of the skeleton above by name, a `mirror: "x"` part of a `_l` bone writes the `_r` twin too, and a part of `root` with `mirror: "x"` is mirrored on `root`).
// The groups that move as one are islands: the body (the default island), the doors (a field of their own: they swing), the seats, the steering wheel, the trim, the fenders and the wheels (one island a pair: they pass through the fenders).
// The seat's cushion is 0.58 over the ground and the floor 0.42: a rider's hips are 0.14 over the cushion and its feet, on the pedals, 0.08 over the floor.
const GREEN = [0.30, 0.38, 0.21, 1], GREEN_D = [0.22, 0.29, 0.15, 1], DARK = [0.11, 0.115, 0.125, 1], BLACK = [0.035, 0.035, 0.04, 1], STEEL = [0.66, 0.68, 0.72, 1], RUBBER = [0.04, 0.04, 0.045, 1], SEAT = [0.40, 0.30, 0.20, 1], LAMP = [0.95, 0.9, 0.7, 1], RED = [0.78, 0.07, 0.05, 1], WHITE = [0.92, 0.92, 0.9, 1], MAT = [0.16, 0.16, 0.15, 1];
const parts = [
  // THE BODY (root, the default island): the frame, the floor, the hood, the grille, the sides, the rear, the dash
  { id: "frame", shape: "box", center: [0, 0.3, 0], half: [0.55, 0.08, 1.7], round: 0.03, bone: "root", color: DARK },
  { id: "floor", shape: "box", center: [0, 0.38, -0.3], half: [0.8, 0.04, 1.2], round: 0.01, bone: "root", color: MAT },
  { id: "hood", shape: "box", center: [0, 0.74, 1.12], half: [0.78, 0.2, 0.62], round: 0.1, bone: "root", blend: 0.03, color: GREEN },
  { id: "hood_ridge", shape: "box", center: [0, 0.97, 1.12], half: [0.2, 0.025, 0.55], round: 0.015, bone: "root", color: GREEN_D },
  { id: "grille", shape: "box", center: [0, 0.72, 1.76], half: [0.55, 0.16, 0.03], round: 0.015, bone: "root", island: "trim", color: DARK },
  { id: "sill", shape: "box", center: [0.86, 0.47, -0.12], half: [0.04, 0.06, 0.5], round: 0.015, bone: "root", mirror: "x", color: GREEN_D },
  { id: "side_rear", shape: "box", center: [0.86, 0.68, -1.25], half: [0.04, 0.26, 0.62], round: 0.02, bone: "root", mirror: "x", color: GREEN },
  { id: "side_front", shape: "box", center: [0.86, 0.68, 0.53], half: [0.04, 0.26, 0.15], round: 0.02, bone: "root", mirror: "x", color: GREEN },
  { id: "rear", shape: "box", center: [0, 0.66, -1.9], half: [0.86, 0.28, 0.04], round: 0.02, bone: "root", color: GREEN },
  { id: "tub_floor", shape: "box", center: [0, 0.4, -1.25], half: [0.84, 0.03, 0.64], bone: "root", color: MAT },
  { id: "dash", shape: "box", center: [0, 0.9, 0.5], half: [0.8, 0.13, 0.13], round: 0.05, bone: "root", blend: 0.03, color: GREEN_D },
  { id: "dash_top", shape: "box", center: [0, 1.04, 0.5], half: [0.72, 0.02, 0.1], round: 0.01, bone: "root", island: "trim", color: BLACK },
  { id: "bumper_f", shape: "box", center: [0, 0.5, 1.88], half: [0.82, 0.07, 0.06], round: 0.03, bone: "root", island: "trim", color: DARK },
  { id: "bumper_r", shape: "box", center: [0, 0.5, -1.94], half: [0.82, 0.07, 0.05], round: 0.03, bone: "root", island: "trim", color: DARK },
  { id: "head_lamp", shape: "sphere", center: [0.5, 0.8, 1.77], radius: 0.09, bone: "root", mirror: "x", island: "trim", color: LAMP },
  { id: "tail_lamp", shape: "box", center: [0.7, 0.8, -1.95], half: [0.07, 0.05, 0.02], round: 0.01, bone: "root", mirror: "x", island: "trim", color: RED },
  { id: "tow", shape: "box", center: [0, 0.55, -1.99], half: [0.08, 0.04, 0.04], round: 0.012, bone: "root", island: "trim", color: DARK },
  // THE WINDSCREEN FRAME (folded: no glass) and THE ROLL BAR (an island)
  { id: "screen_post", shape: "loft", points: [[0.78, 0.97, 0.62], [0.76, 1.46, 0.5]], radii: [0.03, 0.026], radii_v: [0.03, 0.026], square: 0.85, bone: "root", island: "guard", mirror: "x", color: DARK },
  { id: "screen_top", shape: "box", center: [0, 1.46, 0.5], half: [0.77, 0.022, 0.022], bone: "root", island: "guard", color: DARK },
  { id: "bar_post", shape: "loft", points: [[0.8, 0.9, -0.95], [0.8, 1.7, -0.95]], radii: [0.035, 0.03], radii_v: [0.035, 0.03], square: 0.85, bone: "root", island: "guard", mirror: "x", color: DARK },
  { id: "bar_top", shape: "box", center: [0, 1.7, -0.95], half: [0.8, 0.03, 0.03], bone: "root", island: "guard", color: DARK },
  { id: "bar_back", shape: "loft", points: [[0.8, 1.7, -0.95], [0.8, 0.95, -1.7]], radii: [0.03, 0.03], radii_v: [0.03, 0.03], square: 0.85, bone: "root", island: "guard", mirror: "x", color: DARK },
  // THE FENDERS (an island): over each wheel an arch = a cylinder minus a smaller one minus a box that takes the lower part away
  { id: "fender_f", shape: "cylinder", center: [0.8, 0.36, 1.25], axis: "x", radius: 0.44, half: 0.17, round: 0.02, bone: "root", island: "fenders", mirror: "x", color: GREEN },
  { id: "fender_f_in", shape: "cylinder", center: [0.8, 0.36, 1.25], axis: "x", radius: 0.4, half: 0.2, bone: "root", island: "fenders", mirror: "x", op: "subtract" },
  { id: "fender_f_cut", shape: "box", center: [0.8, 0.0, 1.25], half: [0.3, 0.45, 0.7], bone: "root", island: "fenders", mirror: "x", op: "subtract" },
  { id: "fender_r", shape: "cylinder", center: [0.8, 0.36, -1.1], axis: "x", radius: 0.44, half: 0.17, round: 0.02, bone: "root", island: "fenders", mirror: "x", color: GREEN },
  { id: "fender_r_in", shape: "cylinder", center: [0.8, 0.36, -1.1], axis: "x", radius: 0.4, half: 0.2, bone: "root", island: "fenders", mirror: "x", op: "subtract" },
  { id: "fender_r_cut", shape: "box", center: [0.8, 0.0, -1.1], half: [0.3, 0.45, 0.7], bone: "root", island: "fenders", mirror: "x", op: "subtract" },
  // THE SEATS (an island): the base, the cushion (its top is 0.58 over the ground), the back
  { id: "seat_base", shape: "box", center: [0.4, 0.47, -0.3], half: [0.22, 0.05, 0.24], bone: "root", island: "seats", mirror: "x", color: DARK },
  { id: "seat_cushion", shape: "box", center: [0.4, 0.52, -0.3], half: [0.25, 0.06, 0.27], round: 0.04, bone: "root", island: "seats", mirror: "x", color: SEAT },
  { id: "seat_back", shape: "loft", points: [[0.4, 0.6, -0.5], [0.4, 1.1, -0.6]], radii: [0.25, 0.22], radii_v: [0.06, 0.05], square: 0.7, bone: "root", island: "seats", mirror: "x", color: SEAT },
  // THE STEERING WHEEL (an island): the column, the ring tilted toward the driver, the hub, two spokes
  { id: "column", shape: "capsule", a: [0.4, 0.9, 0.5], b: [0.4, 1.02, 0.2], radius: 0.03, bone: "root", island: "steer", color: DARK },
  { id: "steer_ring", shape: "torus", center: [0.4, 1.02, 0.18], axis: [0, 0.5, -0.87], radius: 0.18, tube: 0.022, bone: "root", island: "steer", color: BLACK },
  { id: "steer_hub", shape: "sphere", center: [0.4, 1.02, 0.18], radius: 0.04, bone: "root", island: "steer", color: DARK },
  { id: "steer_spoke", shape: "capsule", a: [0.22, 1.02, 0.18], b: [0.58, 1.02, 0.18], radius: 0.014, bone: "root", island: "steer", color: DARK },
  // THE DOORS (an island: they swing about their hinge at the front edge, the bone's head; the bone runs back along the door): the panel, the top rail, the handle, the mirror twin on the right
  { id: "door_panel", shape: "box", center: [0.86, 0.74, -0.12], half: [0.03, 0.24, 0.5], round: 0.02, bone: "door_l", island: "doors", mirror: "x", color: GREEN },
  { id: "door_rail", shape: "box", center: [0.86, 0.99, -0.12], half: [0.035, 0.018, 0.5], round: 0.01, bone: "door_l", island: "doors", mirror: "x", color: GREEN_D },
  { id: "door_handle", shape: "box", center: [0.905, 0.88, -0.45], half: [0.014, 0.02, 0.07], round: 0.008, bone: "door_l", island: "doors", mirror: "x", color: STEEL },
  { id: "door_hinge", shape: "capsule", a: [0.88, 0.58, 0.37], b: [0.88, 0.94, 0.37], radius: 0.022, bone: "door_l", island: "doors", mirror: "x", color: DARK },
];
// the wheels, one island a pair: the tyre (a rounded cylinder on the axle), the rim disc, a boss on the outer face, five lug nuts and a white dot on the sidewall; centred on the hub (the bone's head), round about the axle; written for the LEFT wheel and mirrored
[["f", TRACK, ZF], ["r", TRACK, ZR]].forEach(function (w) {
  const k = w[0], x = w[1], z = w[2], r = WR, hw = 0.11, b = "wheel_" + k + "_l", isl = "wheels_" + k, face = x + hw, rim = r * 0.62;
  parts.push(
    { id: "tyre_" + k, shape: "cylinder", center: [x, r, z], axis: "x", radius: r, half: hw, round: hw * 0.55, bone: b, island: isl, mirror: "x", color: RUBBER },
    { id: "rim_" + k, shape: "cylinder", center: [x, r, z], axis: "x", radius: rim, half: hw + 0.012, round: 0.012, bone: b, island: isl, mirror: "x", color: STEEL },
    { id: "boss_" + k, shape: "cylinder", center: [x, r, z], axis: "x", radius: r * 0.3, half: hw + 0.03, round: 0.012, bone: b, island: isl, mirror: "x", color: DARK },
    { id: "dot_" + k, shape: "cylinder", center: [x, r + r * 0.86, z], axis: "x", radius: r * 0.07, half: hw + 0.006, bone: b, island: isl, mirror: "x", color: WHITE });
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + 0.3;
    parts.push({ id: "nut_" + k + i, shape: "sphere", center: [face + 0.03, r + Math.cos(a) * r * 0.2, z + Math.sin(a) * r * 0.2], radius: 0.022, bone: b, island: isl, mirror: "x", color: STEEL });
  }
});
const sdf = {
  cell: 0.03, skin: { falloff: 4 }, shade: { ao: 0.3, ao_radius: 0.08, tone: 0.2, color_blend: 0 }, decimate: { ratio: 0.1, error: 0.01, max_edge: 0.8 },
  islands: {
    fenders: { cell: 0.016, decimate: { ratio: 0.05, error: 0.012, max_edge: 0.6 } },
    guard: { cell: 0.014, decimate: { ratio: 0.08, error: 0.012, max_edge: 1.2 } },
    doors: { cell: 0.016, decimate: { ratio: 0.08, error: 0.008, max_edge: 0.5 } },
    trim: { cell: 0.012, decimate: { ratio: 0.05, error: 0.006, max_edge: 0.5 } },
    seats: { cell: 0.016, decimate: { ratio: 0.1, error: 0.006, max_edge: 0.5 } },
    steer: { cell: 0.012, decimate: { ratio: 0.1, error: 0.005, max_edge: 0.2 } },
    wheels_f: { cell: 0.015, decimate: { ratio: 0.05, error: 0.006, max_edge: 0.3 } },
    wheels_r: { cell: 0.015, decimate: { ratio: 0.05, error: 0.006, max_edge: 0.3 } },
  },
  parts: parts,
};
// PHYSICS: the machine in the physics world (soma_phys.cpp, js/shapes.js): a FEW shapes in the bind pose's model space, one rigid body for every NEAR instance.
const physics = { mass: 1400, shapes: [{ id: "body", shape: "box", center: [0, 0.72, -0.05], half: [0.86, 0.38, 1.85], bone: "root" }] };
return {
  name: "jeep", max: 16,
  family: { faction: "machine", kind: "vehicle", hp: 100 },
  nav: { agent: {"name":"jeep","radius":2.0,"height":1.7,"step":0.3,"slope":25,"drop":0.3} },
  body: {
    skeleton: bones,
    rig: rig,
    body: body,
    vehicle: vehicle,
    couplers: couplers,
    doors: doors,
    seats: seats,
    physics: physics,
    sdf: sdf
  },
  abilities: ["walk", "effects"],
  interaction: { uses: [] },
  // PARTICLES (soma/js/fx.js): the tail pipe under the rear bumper smokes while it drives, the rear wheels throw dust up behind them (both on the root: a wheel's own bone spins, a mount on it would circle the hub)
  particles: {
    exhaust: { effect: "exhaust_smoke", mount: { bone: "root", at: [0.55, 0.04, -0.58], dir: [0, 0.6, -1] }, loop: { while: "speed", from: 0.3, to: 8 }, scale: 0.5 },
    dust_l: { effect: "wheel_dust", mount: { bone: "root", at: [0.8, -0.24, -0.05], dir: [0, 1, -0.5] }, loop: { while: "speed", from: 3, to: 10 }, scale: 0.9 },
    dust_r: { effect: "wheel_dust", mount: { bone: "root", at: [-0.8, -0.24, -0.05], dir: [0, 1, -0.5] }, loop: { while: "speed", from: 3, to: 10 }, scale: 0.9 }
  },
  mind: {
    hz: 10, far_hz: 3,
    blocks: [
      ["health", { hp: 150 }],
      ["walk", { speed: 4, run_speed: 6, wp_near: 2, near: 2.4, stuck_time: 5 }],
      ["avoid", { radius: 1.05, length: 4.0, margin: 0.8, neighbours: 5, look: 2.5, brake: 4.0, other: 0.4, edge: 3, creep: 0.8, stop_gap: 0.8, push: 1.6, slow: 0.2, max_bend: 1, turn: 2.5, relax: 1.2, settle: 4, probe: 4, bodies: 8, boxed_wait: 6, ghost: 0, wait: 0.1, commit: 2, give_up: 8 }],
      ["drive", { top: 12, grip: 6, wheelbase: 2.35, max_steer: 0.5, steer_speed: 10 }],
      ["wander", { speed: 4, pause_min: 2, pause_max: 7, near: 2.4 }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first; the blocks without a node (health, needs, injured) act through their hooks.
    worker: function (api, ld) {
      var tree = { name: "jeep", select: [ld.node("wander")] };
      return { tree: tree };
    }
  }
};
