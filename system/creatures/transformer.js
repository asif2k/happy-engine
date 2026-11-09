"use strict";
// transformer: a giant robot of 3.4 m in the manner of the shape-shifting machines of the cartoons: a blue and red body of plates with a truck's windshield across its chest, exhaust stacks on its back, a visor that glows, helmet fins, shoulder pads and
// fists. ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS { name, family, nav, body, abilities, interaction, mind }. Metres, +x to its left, +y up, +z forward.
//
// EVERYTHING IT MOVES BY IS IN THIS FILE: it reads no gait style and no action of the libraries.
//   GAITS   `body.gaits` has two whole gait styles of its own, tf_walk and tf_run (the form of a style of the gait libraries: speed, stride, swing, step_height, bob, ride, cycle, phase, the foot's path over a step, and `upper`: what the hips, the spine,
//           the head and the two hands do over a cycle). The legs' own first gait (`body.legs.gait`) is made from tf_walk by `creature_units` below (a style is in leg lengths, a gait of the legs in metres), so a host that never puts a style
//           on it still sees it walk like a tf_walk; the two styles are put on the spare gait slots (`legs.slots`) by the mind (api.style) or by the page (sp.set_style, after system.gaits.add of the file's `body.gaits`).
//   ACTIONS `body.actions` has five of its own, in the form of the action libraries (phases, tracks of the numbers of its roles, events): tf_jump (movement), tf_punch and tf_slam (attacks that hit), tf_cannon (an attack that shoots: it tells the
//           page `shoot`) and tf_power_up (a gesture). The numbers are creature independent (degrees, arm lengths, leg lengths, hips' heights), so a body of any size plays them; the weight is in the times (a jump of 1.7 s, a blow that winds up for 0.4 s).
//   MIND    the blocks it loads by name and its tree: it fights what is hostile with tf_punch, walks in tf_walk and runs from danger in tf_run.
// Names of a creature's own begin with the creature's (tf_): the name of a library's action or style is refused.

// ---- the numbers the body is made from ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const HIPS = 1.75, LEG = 1.55, RIDE = 1.67;               // the hips' height (the pelvis bone's head), hip to ankle, the hips' height while it walks (a little under the standing one: the knees give)

// ---- THE GAITS: whole styles of its own ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// speed, stride and step_height are in LEG LENGTHS (a second, a step, the foot's lift), bob in hips' heights (the whole range of the hips' rise and fall), swing the share of the cycle a foot is in the air, cycle in seconds (2 stride / speed),
// phase the share of the cycle each leg steps after the first (hl: the left hind leg, a biped's left), ride the hips' height as a share of its own ride. `path`: the foot's way over a step, [progress, height] knots (up is minus a share of step_height).
// `upper`: [mean, amplitude 1, phase 1, amplitude 2, phase 2 ...] a channel, over a cycle counted from the step of the leg `ref`: degrees for the turns (yaw to the left, pitch UP, roll to the right), arm lengths for a hand (x out, y up, z forward).
const WALK = {
  name: "tf_walk", species: "transformer", source: "authored", pattern: "alternate", tags: ["alternate", "walk", "slow", "heavy", "robot"],
  description: "a giant robot's walk: 0.95 leg lengths a second, long slow steps with the feet lifted high and put down flat, the trunk held upright and turning a little against the hips, the arms swinging stiffly",
  speed: 0.95, stride: 0.82, swing: 0.36, step_height: 0.2, bob: 0.03, ride: 1, cycle: 1.726, phase: { hl: 0, hr: 0.5 },
  path: [[0, 0], [0.13, -0.8], [0.32, -1], [0.58, -0.95], [0.85, -0.5], [1, 0]], path_tangent: 0.6,
  upper: {
    ref: "hl",
    hips: { yaw: [0, 3.5, 0.92], roll: [0, 1.5, 0.54] },
    spine: { yaw: [0, 4, 0.42], pitch: [-3.5], roll: [0, 1.5, 0.05] },
    neck: { pitch: [1.5] },
    head: { yaw: [0, 1.5, 0.78], pitch: [4] },
    arm_l: { x: [0.2], y: [-0.8, 0.04, 0.9], z: [0.4, 0.2, 0.9] },
    arm_r: { x: [0.2], y: [-0.8, 0.04, 0.4], z: [0.4, 0.2, 0.4] }
  }
};
const RUN = {
  name: "tf_run", species: "transformer", source: "authored", pattern: "alternate", tags: ["alternate", "run", "fast", "heavy", "robot"],
  description: "a giant robot's run: 3 leg lengths a second (4.6 m/s), a long driving stride with both feet off the ground between steps, the trunk leaning into it and the arms pumping",
  speed: 3, stride: 1.65, swing: 0.48, step_height: 0.3, bob: 0.05, ride: 0.92, cycle: 1.1, phase: { hl: 0, hr: 0.5 },
  path: [[0, 0], [0.15, -0.85], [0.35, -1], [0.55, -0.95], [0.8, -0.6], [1, 0]], path_tangent: 0.7,
  upper: {
    ref: "hl",
    hips: { yaw: [0, 7, 0.92], roll: [0, 3, 0.54] },
    spine: { yaw: [0, 9, 0.42], pitch: [-9], roll: [0, 3, 0.05] },
    neck: { pitch: [4] },
    head: { yaw: [0, 3, 0.78], pitch: [9] },
    arm_l: { x: [0.15], y: [-0.62, 0.12, 0.9], z: [0.38, 0.42, 0.9] },
    arm_r: { x: [0.15], y: [-0.62, 0.12, 0.4], z: [0.38, 0.42, 0.4] }
  }
};
// a style made the legs' own gait, in metres (what the page's compile does with a style that it is told to take: its numbers times the leg's length, the bob a half of its range times the hips' height)
const creature_units = function (s) {
  return { speed: s.speed * LEG, stride: s.stride * LEG, swing: Math.min(0.8, s.swing), step_height: s.step_height * LEG, bob: 0.5 * s.bob * HIPS, ride: RIDE * s.ride,
    path: s.path.map(function (k) { return [k[0], k[1], 0, s.path_tangent]; }) };
};

// ---- THE ACTIONS: five of its own ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// a track is { c: "<role>.<number>", v: the value at the start and at the end of every phase (one more than the phases), h: a hump over each phase, lag: seconds late }. The numbers: hips.y .z .x in hips' heights, the spine, head and hips
// turns in degrees, a hand's x y z in arm lengths from its shoulder (y -0.92 hangs down, 0 is level with the shoulder), grip 0 open .. 1 shut, a leg's x y z in leg lengths from its hip (y -0.98 is straight down), own 1 the action's foot / 0 the gait's.
const T = function (c, v, o) { return Object.assign({ c: c, v: v }, o || {}); };
const both = function (c, v, o) { return [T("arm_l." + c, v, o), T("arm_r." + c, v, o)]; };            // (the same number on the two arms: x is OUT on each side, so the two are one list)

const TF_JUMP = {
  name: "tf_jump", title: "Transformer jump", kind: "movement",
  description: "The legs fold under a deep crouch with the arms swung back, the body is launched to the height asked (the `height` number, in hips' heights: 0.7 is 1.2 m for this body) with the arms thrown out and up, the legs tuck in the air and the landing is taken in the knees with a thud (it tells the page `thrust` at the take off and `impact` at the landing).",
  priority: 8, fade: [0.1, 0.25], end: "once", frame: "body", height: 0.7, params: ["height", "power", "speed", "mirror"],
  phases: [{ name: "crouch", t: 0.34, ease: "ease_in", air: false }, { name: "air", t: 0.85, ease: "smooth", air: true }, { name: "land", t: 0.5, ease: "smooth", air: false }],
  tracks: [].concat([
    T("hips.y", [0, -0.2, 0.05, 0]), T("hips.pitch", [0, -8, 0, -5]),
    T("spine.pitch", [0, -18, 6, -12], { h: [0, 0, -5] }), T("head.pitch", [0, 10, 5, 6]),
    T("leg_l.y", [-0.98, -0.98, -0.98, -0.98], { h: [0, 0.4, 0] }), T("leg_l.z", [-0.03, -0.03, -0.03, -0.03], { h: [0, 0.2, 0] }), T("leg_l.own", [0, 0, 1, 1]),
    T("leg_r.y", [-0.98, -0.98, -0.98, -0.98], { h: [0, 0.4, 0] }), T("leg_r.z", [-0.03, -0.03, -0.03, -0.03], { h: [0, 0.2, 0] }), T("leg_r.own", [0, 0, 1, 1])
  ], both("x", [0.15, 0.2, 0.55, 0.15]), both("y", [-0.92, -0.55, 0.1, -0.92]), both("z", [0.3, -0.35, 0.15, 0.3])),
  events: [{ at: ["air", 0], type: "emit", tag: "thrust", v: 1 }, { at: ["land", 0.25], type: "emit", tag: "impact", v: 1 }]
};

const TF_PUNCH = {
  name: "tf_punch", title: "Transformer punch", kind: "attack",
  description: "A haymaker with the right fist: the fist goes back and out while the trunk coils, then drives across the front as the hips and the spine uncoil and the whole body goes into it; the left fist guards. The blow takes 40 hit points and throws the target back.",
  priority: 8, fade: [0.08, 0.25], end: "once", frame: "body", height: 1.1, params: ["target", "power", "speed", "mirror"],
  phases: [{ name: "windup", t: 0.4, ease: "smooth", air: false }, { name: "strike", t: 0.14, ease: "fast_out", air: false }, { name: "hold", t: 0.1, ease: "linear", air: false }, { name: "recover", t: 0.55, ease: "smooth", air: false }],
  tracks: [
    T("arm_r.x", [0.15, 0.4, 0.1, 0.1, 0.15]), T("arm_r.y", [-0.92, 0.3, 0.14, 0.14, -0.92]), T("arm_r.z", [0.3, -0.05, 1, 1, 0.3]), T("arm_r.grip", [0, 1, 1, 1, 0]),
    T("arm_l.x", [0.15, 0.25, 0.3, 0.3, 0.15]), T("arm_l.y", [-0.92, -0.2, -0.4, -0.4, -0.92]), T("arm_l.z", [0.3, 0.5, 0.25, 0.25, 0.3]), T("arm_l.grip", [0, 1, 1, 1, 0]),
    T("spine.yaw", [0, -26, 36, 36, 0]), T("hips.yaw", [0, -18, 24, 24, 0]), T("spine.pitch", [0, 4, -9, -9, 0]),
    T("head.yaw", [0, 12, -18, -18, 0], { lag: 0.05 }), T("head.pitch", [0, -3, -5, -5, 0]),
    T("hips.y", [0, -0.07, -0.07, -0.07, 0]), T("hips.z", [0, -0.03, 0.09, 0.09, 0])
  ],
  events: [{ at: ["strike", 0], type: "emit", tag: "swing", v: 1 }, { at: ["strike", 1], type: "hit", limb: "hand_r", damage: 40, push: 5, up: 0.25, kind: 1, reach: 0.2, win: 0.1 }]
};

const TF_SLAM = {
  name: "tf_slam", title: "Transformer ground slam", kind: "attack",
  description: "Both fists are raised over the head with the back arched, held a breath, and brought down together on the ground in front with the whole trunk behind them; the ground is hit hard (60 hit points, thrown up) and the page is told `impact`.",
  priority: 8, fade: [0.08, 0.3], end: "once", frame: "body", height: 1.1, params: ["target", "power", "speed", "mirror"],
  phases: [{ name: "raise", t: 0.55, ease: "smooth", air: false }, { name: "hang", t: 0.12, ease: "linear", air: false }, { name: "smash", t: 0.12, ease: "fast_out", air: false }, { name: "settle", t: 0.6, ease: "smooth", air: false }],
  tracks: [].concat(both("x", [0.15, 0.3, 0.3, 0.12, 0.15]), both("y", [-0.92, 0.55, 0.55, -0.45, -0.92]), both("z", [0.3, 0.05, 0.05, 0.85, 0.3]), both("grip", [0, 1, 1, 1, 0]), [
    T("spine.pitch", [0, 10, 10, -26, 0]), T("hips.pitch", [0, 4, 4, -10, 0]), T("hips.y", [0, 0.03, 0.03, -0.14, 0]), T("hips.z", [0, -0.03, -0.03, 0.1, 0]),
    T("head.pitch", [0, 8, 8, -10, 0], { lag: 0.05 })
  ]),
  events: [{ at: ["smash", 0], type: "emit", tag: "swing", v: 1 }, { at: ["smash", 0.85], type: "hit", limb: "point", damage: 60, push: 6, up: 0.9, kind: 10, reach: 1, win: 0.14, ahead: 0.9, h: 0, side: 0 }, { at: ["smash", 1], type: "emit", tag: "impact", v: 1 }]
};

const TF_CANNON = {
  name: "tf_cannon", title: "Transformer cannon", kind: "attack",
  description: "The right arm comes up level and points forward as a cannon, the left hand braces it at the chest and the trunk turns to aim; it fires twice, a shot at a time (the page is told `shoot` for each, and the recoil pushes the body back), then the arm is lowered.",
  priority: 8, fade: [0.1, 0.3], end: "once", frame: "body", height: 1.1, params: ["target", "power", "speed", "mirror"],
  phases: [{ name: "aim", t: 0.45, ease: "smooth", air: false }, { name: "fire", t: 0.1, ease: "fast_out", air: false }, { name: "steady", t: 0.32, ease: "smooth", air: false }, { name: "fire2", t: 0.1, ease: "fast_out", air: false }, { name: "lower", t: 0.6, ease: "smooth", air: false }],
  tracks: [
    T("arm_r.x", [0.15, 0.1, 0.1, 0.1, 0.1, 0.15]), T("arm_r.y", [-0.92, 0, 0.08, 0, 0.08, -0.92]), T("arm_r.z", [0.3, 0.95, 0.88, 0.95, 0.88, 0.3]), T("arm_r.grip", [0, 1, 1, 1, 1, 0]),
    T("arm_l.x", [0.15, 0.25, 0.25, 0.25, 0.25, 0.15]), T("arm_l.y", [-0.92, -0.35, -0.35, -0.35, -0.35, -0.92]), T("arm_l.z", [0.3, 0.55, 0.55, 0.55, 0.55, 0.3]), T("arm_l.grip", [0, 1, 1, 1, 1, 0]),
    T("spine.yaw", [0, 12, 12, 12, 12, 0]), T("hips.yaw", [0, 10, 10, 10, 10, 0]), T("spine.pitch", [0, 0, 6, 0, 6, 0]),
    T("head.yaw", [0, -12, -12, -12, -12, 0]), T("head.pitch", [0, 2, 3, 2, 3, 0]),
    T("hips.y", [0, -0.04, -0.05, -0.04, -0.05, 0]), T("hips.z", [0, -0.02, -0.06, -0.02, -0.06, 0])
  ],
  events: [
    { at: ["fire", 0], type: "emit", tag: "shoot", v: 1 }, { at: ["fire", 0], type: "impulse", dir: "back", speed: 0.8, up: 0 },
    { at: ["fire2", 0], type: "emit", tag: "shoot", v: 1 }, { at: ["fire2", 0], type: "impulse", dir: "back", speed: 0.8, up: 0 }
  ]
};

const TF_POWER_UP = {
  name: "tf_power_up", title: "Transformer power up", kind: "gesture",
  description: "A show of strength: the body braces and bends, then the chest goes out, the fists shut, the arms spread and the head goes back; it holds the pose and relaxes (the page is told `rev` as the chest goes out).",
  priority: 5, fade: [0.12, 0.3], end: "once", frame: "body", height: 1.1, params: ["power", "speed", "mirror"],
  phases: [{ name: "brace", t: 0.45, ease: "ease_in", air: false }, { name: "flare", t: 0.5, ease: "smooth", air: false }, { name: "hold", t: 0.7, ease: "linear", air: false }, { name: "relax", t: 0.6, ease: "smooth", air: false }],
  tracks: [].concat(both("x", [0.15, 0.3, 0.7, 0.7, 0.15]), both("y", [-0.92, -0.7, -0.15, -0.15, -0.92]), both("z", [0.3, 0.45, 0.1, 0.1, 0.3]), both("grip", [0, 1, 1, 1, 0]), [
    T("spine.pitch", [0, -6, 8, 8, 0]), T("head.pitch", [0, -4, 14, 14, 0]), T("hips.y", [0, -0.06, 0.02, 0.02, 0])
  ]),
  events: [{ at: ["flare", 0], type: "emit", tag: "rev", v: 1 }]
};

// ---- THE BODY ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const bones = [
  { name: "hips", parent: null, head: [0, 1.75, 0], tail: [0, 1.85, 0] },
  { name: "spine", parent: "hips", head: [0, 1.85, 0], tail: [0, 2.15, 0] },
  { name: "chest", parent: "spine", head: [0, 2.15, 0], tail: [0, 2.65, 0] },
  { name: "neck", parent: "chest", head: [0, 2.65, 0], tail: [0, 2.78, 0.02] },
  { name: "head", parent: "neck", head: [0, 2.78, 0.02], tail: [0, 3.22, 0.05] },
  { name: "upper_l", parent: "chest", head: [0.52, 2.55, 0], tail: [0.58, 2.0, 0], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.58, 2.0, 0], tail: [0.6, 1.5, 0], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.6, 1.5, 0], tail: [0.6, 1.3, 0.02], mirror: "x" },
  { name: "thigh_l", parent: "hips", head: [0.25, 1.75, 0], tail: [0.26, 0.95, 0], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.26, 0.95, 0], tail: [0.26, 0.2, 0], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.26, 0.2, 0], tail: [0.26, 0.1, 0.32], mirror: "x" },
];
const rig = {
  joints: [
    { bone: "thigh_l", kind: "ball", fwd: 70, back: 45, out: 30, in: 15, twist: [-15, 15] },
    { bone: "shin_l", kind: "hinge", axis: [1, 0, 0], range: [-3, 130] },
    { bone: "foot_l", kind: "ball", fwd: 40, back: 40, lat: 12, twist: 10 },
    { bone: "thigh_r", kind: "ball", fwd: 70, back: 45, out: 30, in: 15, twist: [-15, 15] },
    { bone: "shin_r", kind: "hinge", axis: [1, 0, 0], range: [-3, 130] },
    { bone: "foot_r", kind: "ball", fwd: 40, back: 40, lat: 12, twist: 10 },
    { bone: "upper_l", kind: "ball", fwd: 150, back: 60, out: 100, in: 40, twist: [-70, 70] },
    { bone: "fore_l", kind: "hinge", axis: [-0.994, -0.108, 0], range: [-3, 140] },
    { bone: "upper_r", kind: "ball", fwd: 150, back: 60, out: 100, in: 40, twist: [-70, 70] },
    { bone: "fore_r", kind: "hinge", axis: [-0.994, 0.108, 0], range: [-3, 140] },
    { bone: "spine", kind: "ball", fwd: 40, back: 25, lat: 25, twist: 40 },
    { bone: "chest", kind: "ball", fwd: 30, back: 20, lat: 25, twist: 40 },
    { bone: "neck", kind: "ball", fwd: 40, back: 40, lat: 35, twist: 50 },
    { bone: "head", kind: "ball", fwd: 30, back: 40, lat: 30, twist: 45 },
  ],
  chains: [
    { name: "leg_l", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0, 0, 1], pole_w: 1 },
    { name: "leg_r", solver: "limb", bones: ["thigh_r", "shin_r"], tip: "foot_r", pole: [0, 0, 1], pole_w: 1 },
    { name: "arm_l", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0, 0, -1], pole_w: 1 },
    { name: "arm_r", solver: "limb", bones: ["upper_r", "fore_r"], pole: [0, 0, -1], pole_w: 1 },
    { name: "head", bones: ["spine", "chest", "neck", "head"] },
  ],
};
// the legs: its own first gait is the walk (in metres, from the style above) and `slots` leaves two spare gaits for the styles the mind or the page puts on it
const legs = { legs: ["leg_l", "leg_r"], gait: creature_units(WALK), slots: 2 };
const roles = { hips: "hips", spine: ["spine", "chest"], chest: "chest", neck: ["neck"], head: "head", arms: [{ chain: "arm_l", rest: [0.064, -0.998, 0] }, { chain: "arm_r", rest: [0.064, -0.998, 0] }] };
const physics = { mass: 4500, shapes: [
    { id: "body", shape: "capsule", a: [0, 0.6, 0], b: [0, 2.9, 0], radius: 0.5, bone: "hips" },
    { id: "head", shape: "sphere", center: [0, 3, 0.05], radius: 0.27, bone: "head" },
    { id: "leg_l", shape: "capsule", a: [0.25, 1.7, 0], b: [0.26, 0.3, 0], radius: 0.17 },
    { id: "leg_r", shape: "capsule", a: [-0.25, 1.7, 0], b: [-0.26, 0.3, 0], radius: 0.17 },
  ] };

const BLUE = [0.13, 0.28, 0.72, 1], RED = [0.78, 0.1, 0.08, 1], SILVER = [0.72, 0.74, 0.78, 1], DARK = [0.13, 0.14, 0.17, 1], GLASS = [0.55, 0.8, 0.95, 1], GLOW = [0.35, 0.95, 1, 1], YELLOW = [0.95, 0.78, 0.15, 1];
const parts = [
  { id: "pelvis", shape: "box", center: [0, 1.78, 0], half: [0.36, 0.17, 0.24], round: 0.06, bone: "hips", blend: 0.04, color: DARK },
  { id: "belt", shape: "box", center: [0, 1.93, 0], half: [0.34, 0.05, 0.23], round: 0.02, bone: "hips", blend: 0.02, color: YELLOW },
  { id: "waist", shape: "cylinder", center: [0, 2, 0], axis: "y", radius: 0.2, half: 0.15, bone: "spine", blend: 0.03, color: DARK },
  { id: "chest", shape: "box", center: [0, 2.4, 0.02], half: [0.5, 0.27, 0.3], round: 0.09, bone: "chest", blend: 0.04, color: BLUE },
  { id: "abdomen", shape: "box", center: [0, 2.2, 0.02], half: [0.44, 0.1, 0.27], round: 0.04, bone: "chest", blend: 0.03, color: RED },
  { id: "windshield", shape: "box", center: [0, 2.47, 0.318], half: [0.36, 0.13, 0.035], round: 0.02, bone: "chest", blend: 0.01, color: GLASS },
  { id: "grille", shape: "box", center: [0, 2.27, 0.315], half: [0.26, 0.06, 0.03], round: 0.01, bone: "chest", blend: 0.01, color: SILVER },
  { id: "stack_l", shape: "cylinder", center: [0.32, 2.65, -0.3], axis: "y", radius: 0.05, half: 0.4, bone: "chest", mirror: "x", blend: 0.015, color: SILVER },
  { id: "backpack", shape: "box", center: [0, 2.4, -0.3], half: [0.34, 0.22, 0.08], round: 0.03, bone: "chest", blend: 0.02, color: DARK },
  { id: "neck", shape: "cylinder", center: [0, 2.7, 0.01], axis: "y", radius: 0.1, half: 0.09, bone: "neck", blend: 0.02, color: DARK },
  { id: "head", shape: "box", center: [0, 2.99, 0.04], half: [0.2, 0.21, 0.2], round: 0.07, bone: "head", blend: 0.03, color: SILVER },
  { id: "faceplate", shape: "box", center: [0, 2.93, 0.215], half: [0.13, 0.13, 0.03], round: 0.02, bone: "head", blend: 0.015, color: DARK },
  { id: "visor", shape: "box", center: [0, 3.03, 0.225], half: [0.16, 0.045, 0.03], round: 0.015, bone: "head", blend: 0.008, color: GLOW },
  { id: "fin_l", shape: "capsule", a: [0.2, 3.1, 0], b: [0.3, 3.42, -0.12], radius: 0.035, bone: "head", mirror: "x", blend: 0.02, color: BLUE },
  { id: "crest", shape: "box", center: [0, 3.24, -0.02], half: [0.035, 0.1, 0.15], round: 0.02, bone: "head", blend: 0.02, color: RED },
  { id: "ear_l", shape: "cylinder", center: [0.22, 2.98, 0.02], axis: "x", radius: 0.09, half: 0.04, bone: "head", mirror: "x", blend: 0.015, color: SILVER },
  { id: "shoulder_l", shape: "box", center: [0.58, 2.58, 0], half: [0.17, 0.17, 0.21], round: 0.07, bone: "upper_l", mirror: "x", blend: 0.03, color: RED },
  { id: "arm_up_l", shape: "loft", bones: ["upper_l"], radii: [0.12, 0.1], mirror: "x", blend: 0.03, color: BLUE },
  { id: "elbow_l", shape: "sphere", center: [0.58, 2, 0], radius: 0.12, bone: "fore_l", mirror: "x", blend: 0.02, color: SILVER },
  { id: "arm_low_l", shape: "loft", bones: ["fore_l"], radii: [0.14, 0.12], mirror: "x", blend: 0.03, color: RED },
  { id: "gauntlet_l", shape: "box", center: [0.67, 1.78, 0.05], half: [0.08, 0.2, 0.12], round: 0.03, bone: "fore_l", mirror: "x", blend: 0.015, color: DARK },
  { id: "fist_l", shape: "box", center: [0.6, 1.36, 0.02], half: [0.12, 0.14, 0.12], round: 0.05, bone: "hand_l", mirror: "x", blend: 0.02, color: SILVER },
  { id: "hip_joint_l", shape: "sphere", center: [0.25, 1.75, 0], radius: 0.15, bone: "thigh_l", mirror: "x", blend: 0.03, color: SILVER },
  { id: "thigh_l", shape: "loft", bones: ["thigh_l"], radii: [0.18, 0.14], mirror: "x", blend: 0.03, color: BLUE },
  { id: "knee_l", shape: "sphere", center: [0.26, 0.95, 0.04], radius: 0.15, bone: "shin_l", mirror: "x", blend: 0.02, color: SILVER },
  { id: "knee_plate_l", shape: "box", center: [0.26, 0.95, 0.16], half: [0.12, 0.12, 0.05], round: 0.03, bone: "shin_l", mirror: "x", blend: 0.015, color: RED },
  { id: "shin_l", shape: "loft", bones: ["shin_l"], radii: [0.15, 0.12], mirror: "x", blend: 0.03, color: BLUE },
  { id: "calf_l", shape: "box", center: [0.26, 0.55, -0.12], half: [0.1, 0.22, 0.08], round: 0.03, bone: "shin_l", mirror: "x", blend: 0.02, color: DARK },
  { id: "foot_l", shape: "box", center: [0.26, 0.1, 0.1], half: [0.15, 0.1, 0.27], round: 0.05, bone: "foot_l", mirror: "x", blend: 0.02, color: DARK },
];
const sdf = { cell: 0.024, adaptive: { min_cell: 0.012, max_cell: 0.048 }, shade: { ao: 0.5, ao_radius: 0.06, tone: 0.2, color_blend: 0.25 }, skin: { falloff: 1.5 }, decimate: { ratio: 0.6 }, parts: parts };

return {
  name: "transformer", max: 8,
  family: { faction: "machine", kind: "robot", hp: 600 },
  nav: { agent: { name: "giant", radius: 0.6, height: 3.5, step: 0.5, slope: 40, drop: 1 } },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, radius: 0.55, max_speed: 5.5, accel: 4, turn_rate: 2.2 },
    roles: roles,
    physics: physics,
    sdf: sdf,
    gaits: [WALK, RUN],
    actions: [TF_JUMP, TF_PUNCH, TF_SLAM, TF_CANNON, TF_POWER_UP]
  },
  abilities: ["walk", "melee", "ranged"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 600, armor: 0.2 }],
      ["flee", { gait: "tf_run", speed: 4.4 }],
      ["fight", { clip_attack: "tf_punch", reach: 2.2, damage: 40, windup: 0.54, gap: 2.4, speed: 1.4, run_speed: 4.2, sight: 22 }],
      ["walk", { gait: "tf_walk", speed: 1.4, run_speed: 4.2 }],
      ["wander", { speed: 1.2 }]
    ],
    // THE WORKER: a creature declares its tree. It stands on its own walk from the first frame (the style has the upper body too: the legs' own gait has only the legs); the nodes of the blocks are put in the tree by name.
    worker: function (api, ld) {
      var WALK_STYLE = api.style("tf_walk");
      var tree = { name: "transformer", select: [ld.node("flee"), ld.node("fight"), ld.node("wander")] };
      return { tree: tree, hooks: { spawn: function (me) { me.style(WALK_STYLE, 0); } } };
    }
  }
};
