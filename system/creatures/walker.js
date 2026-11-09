"use strict";
// walker: in soma's one form of a creature file (soma/creature_file.js): the body is the creature as it was made, the mind is the blocks of soma/world/blocks/ it loads and its tree.
// A bird legged mech of 3.4 m: stands guard at the place it was born, turns its head, goes to look at a noise and goes back.
// walker: Walker, a bird legged mech of 3.4 m: a cockpit pod on a torso, digitigrade legs of three bones (the z_leg solver: the ankle bends as the leg is compressed) and two cannon arms. It walks from the CURVES of the bank curves_bird (the walks and runs of a pigeon, a puffin, a chough, a parrot and a rat, made by tools/curve_tool.js) in its own leg lengths, with a heavy tune of its own (a fifth of a bird's bob, long slow strides, a held head), and has the styles creep, march and stomp, and the actions salvo, sweep and roar.
// ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature { name, skeleton, rig, legs, body, roles, physics, mesh | sdf }. Metres, +x to its left, +y up, +z forward.
// PORTED from soma2.0/creatures/walker.js by soma/tools/port_creature.js (recipe soma/tools/port_recipes/walker.js).
// THE FACE (the bones kept, named, given joints; the roles in `roles`):
//   - eye 'eye_c': the sdf's sphere on the bone, an island with a pupil; it looks the way the donor's bone's does [0, 0, 1]
//   - lid 'lid_up_c' (upper): turns about the centre of 'eye_c'
//   - appendages: 'ant1' > 'ant2' (follow)
// LEFT OUT of the donor's file (the restart has no place for it):
//   - arms' `can` (rest_on, hold): 2 arms (the restart has no hands that rest or hold)
//   - actions: jab, cross, hook_l, hook_r, upper_l, combo, salvo, sweep, roar
//   - packs: curves_bird, curves_arm
//   - curves: `data` / `start` (the donor's curve banks and the actions that start)
//   - trait blink = 0.2 (not a trait of the restart)
//   - trait wander = 0.3 (not a trait of the restart)
const bones = [
  { name: "root", parent: null, head: [0, 2.05, -0.05], tail: [0, 2.3, 0] },
  { name: "spine", parent: "root", head: [0, 2.3, 0], tail: [0, 2.72, 0.3] },
  { name: "head", parent: "spine", head: [0, 2.72, 0.3], tail: [0, 2.9, 0.78] },
  { name: "eye_c", parent: "head", head: [0, 2.86, 0.92], tail: [0, 2.86, 1.0325] },
  { name: "lid_up_c", parent: "head", head: [0, 2.86, 0.92], tail: [0, 2.86, 1.01375] },
  { name: "ant1", parent: "head", head: [-0.3, 3.05, 0.25], tail: [-0.34, 3.35, 0.2] },
  { name: "ant2", parent: "ant1", head: [-0.34, 3.35, 0.2], tail: [-0.37, 3.65, 0.15] },
  { name: "upper_l", parent: "spine", head: [0.85, 2.62, 0.1], tail: [0.98, 2.15, 0.35], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.98, 2.15, 0.35], tail: [0.98, 1.85, 0.9], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.98, 1.85, 0.9], tail: [0.98, 1.8, 1.55], mirror: "x" },
  { name: "thigh_l", parent: "root", head: [0.52, 2, 0.05], tail: [0.55, 1.38, 0.66], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.55, 1.38, 0.66], tail: [0.55, 0.32, 0.04], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.55, 0.32, 0.04], tail: [0.55, 0.07, 0.62], mirror: "x" },
  { name: "toe_l", parent: "foot_l", head: [0.55, 0.07, 0.62], tail: [0.55, 0.04, 0.8], mirror: "x" },
];
const rig = {
  joints: [
    { bone: "thigh_l", kind: "ball", fwd: 75, back: 60, out: 40, in: 25, twist: [-25, 25] },
    { bone: "shin_l", kind: "hinge", axis: [0.999, 0.018, -0.031], range: [-81, 65] },
    { bone: "foot_l", kind: "hinge", axis: [-1, 0, 0], range: [-103, 25] },
    { bone: "toe_l", kind: "ball", fwd: 45, back: 45, lat: 20, twist: 15 },
    { bone: "thigh_r", kind: "ball", fwd: 75, back: 60, out: 40, in: 25, twist: [-25, 25] },
    { bone: "shin_r", kind: "hinge", axis: [0.999, -0.018, 0.031], range: [-81, 65] },
    { bone: "foot_r", kind: "hinge", axis: [-1, 0, 0], range: [-103, 25] },
    { bone: "toe_r", kind: "ball", fwd: 45, back: 45, lat: 20, twist: 15 },
    { bone: "upper_l", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] },
    { bone: "fore_l", kind: "hinge", axis: [-0.914, -0.356, -0.194], range: [-42, 114] },
    { bone: "upper_r", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] },
    { bone: "fore_r", kind: "hinge", axis: [-0.914, 0.356, 0.194], range: [-42, 114] },
    { bone: "spine", kind: "ball", fwd: 15, back: 15, lat: 20, twist: 20 },
    { bone: "head", kind: "ball", fwd: 40, back: 40, lat: 45, twist: 40 },
    { bone: "eye_c", kind: "ball", fwd: 35, back: 35, lat: 35, twist: [-10, 10] },
    { bone: "lid_up_c", kind: "hinge", axis: [1, 0, 0], range: [-20, 85] },
    { bone: "ant1", kind: "ball", fwd: 35, back: 35, lat: 35, twist: 15 },
    { bone: "ant2", kind: "ball", fwd: 35, back: 35, lat: 35, twist: 15 },
  ],
  chains: [
    { name: "leg_l", solver: "z_leg", bones: ["thigh_l", "shin_l", "foot_l"], tip: "toe_l", pole: [0.031, -0.005, 1], pole_w: 1 },
    { name: "leg_r", solver: "z_leg", bones: ["thigh_r", "shin_r", "foot_r"], tip: "toe_r", pole: [-0.031, -0.005, 1], pole_w: 1 },
    { name: "arm_l", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0.389, -0.631, -0.671], pole_w: 1 },
    { name: "arm_r", solver: "limb", bones: ["upper_r", "fore_r"], pole: [-0.389, -0.631, -0.671], pole_w: 1 },
    { name: "head", bones: ["spine", "head"] },
  ],
};
const legs = { legs: ["leg_l", "leg_r"], gait: { from: "pigeon_walk", speed: 1.6, stride: 1.3, step_height: 0.3, bob: 0.01 } };
const roles = { hips: "root", spine: ["spine"], chest: "spine", head: "head", arms: [{ chain: "arm_l", rest: [0.111, -0.656, 0.681] }, { chain: "arm_r", rest: [0.111, -0.656, 0.681] }], eyes: ["eye_c"], lids: [{ bone: "lid_up_c", dir: 1 }], appendages: [{ bones: ["ant1", "ant2"], kind: "follow" }] };
const physics = { mass: 6500, shapes: [
    { id: "pelvis", shape: "box", center: [0, 2.1, 0], half: [0.7, 0.35, 0.6], bone: "root" },
    { id: "torso", shape: "box", center: [0, 2.7, 0.1], half: [0.7, 0.5, 0.75], bone: "spine" },
    { id: "legs", shape: "capsule", a: [0.5, 1.2, 0.3], b: [0.5, 0.2, 0.3], radius: 0.2, bone: "root" },
  ] };
const parts = [
  { id: "pelvis", shape: "ellipsoid", center: [0, 2.12, 0], radii: [0.52, 0.27, 0.5], bone: "root", blend: 0.06, color: [0.36, 0.4, 0.32, 1] },
  { id: "pelvis_plate", shape: "box", center: [0, 1.93, 0.12], half: [0.34, 0.07, 0.3], round: 0.05, bone: "root", blend: 0.04, color: [0.25, 0.28, 0.23, 1] },
  { id: "torso", shape: "ellipsoid", center: [0, 2.58, 0.12], radii: [0.62, 0.42, 0.62], bone: "spine", blend: 0.07, color: [0.36, 0.4, 0.32, 1] },
  { id: "chest_plate", shape: "box", center: [0, 2.52, 0.62], half: [0.45, 0.28, 0.12], round: 0.1, bone: "spine", blend: 0.04, color: [0.55, 0.58, 0.5, 1] },
  { id: "stripe", shape: "box", center: [0, 2.62, 0.7], half: [0.5, 0.045, 0.04], round: 0.02, bone: "spine", color: [0.92, 0.72, 0.12, 1] },
  { id: "engine", shape: "box", center: [0, 2.7, -0.62], half: [0.38, 0.3, 0.26], round: 0.1, bone: "spine", blend: 0.04, color: [0.25, 0.28, 0.23, 1] },
  { id: "pipe_l", shape: "cylinder", center: [0.24, 3.12, -0.7], axis: "y", radius: 0.07, half: 0.24, bone: "spine", mirror: "x", color: [0.62, 0.65, 0.7, 1] },
  { id: "intake", shape: "box", center: [0, 2.7, -0.9], half: [0.28, 0.2, 0.03], round: 0.02, bone: "spine", color: [0.09, 0.09, 0.1, 1] },
  { id: "pod", shape: "ellipsoid", center: [0, 2.88, 0.52], radii: [0.4, 0.3, 0.46], bone: "head", blend: 0.05, color: [0.36, 0.4, 0.32, 1] },
  { id: "canopy", shape: "ellipsoid", center: [0, 2.9, 0.78], radii: [0.3, 0.2, 0.2], bone: "head", blend: 0.03, color: [0.25, 0.8, 0.95, 1] },
  { id: "eye", shape: "sphere", center: [0, 2.86, 0.92], radius: 0.075, bone: "eye_c", color: [0.85, 0.15, 0.1, 1], island: "eyes" },
  { id: "iris", shape: "ellipsoid", center: [0, 2.92, 0.92], radii: [0.085, 0.045, 0.085], bone: "lid_up_c", color: [0.09, 0.09, 0.1, 1], island: "lids" },
  { id: "antenna", shape: "loft", bones: ["ant1", "ant2"], radii: [0.03, 0.022, 0.012], color: [0.62, 0.65, 0.7, 1] },
  { id: "bulb", shape: "sphere", center: [-0.37, 3.66, 0.15], radius: 0.05, bone: "ant2", color: [0.85, 0.15, 0.1, 1] },
  { id: "shoulder_l", shape: "sphere", center: [0.8, 2.64, 0.1], radius: 0.24, bone: "upper_l", mirror: "x", blend: 0.04, color: [0.25, 0.28, 0.23, 1] },
  { id: "upper_l", shape: "loft", bones: ["upper_l"], radii: [0.17, 0.13], mirror: "x", blend: 0.03, color: [0.36, 0.4, 0.32, 1] },
  { id: "elbow_l", shape: "sphere", center: [0.98, 2.15, 0.35], radius: 0.15, bone: "fore_l", mirror: "x", blend: 0.03, color: [0.09, 0.09, 0.1, 1] },
  { id: "fore_l", shape: "loft", bones: ["fore_l"], radii: [0.14, 0.14], mirror: "x", blend: 0.03, color: [0.55, 0.58, 0.5, 1] },
  { id: "cannon_l", shape: "cylinder", center: [0.98, 1.82, 1.28], axis: "z", radius: 0.1, half: 0.34, round: 0.03, bone: "hand_l", mirror: "x", blend: 0.02, color: [0.62, 0.65, 0.7, 1] },
  { id: "muzzle_l", shape: "cylinder", center: [0.98, 1.8, 1.62], axis: "z", radius: 0.13, half: 0.07, round: 0.02, bone: "hand_l", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "breech_l", shape: "box", center: [0.98, 1.86, 1], half: [0.13, 0.15, 0.17], round: 0.05, bone: "hand_l", mirror: "x", blend: 0.03, color: [0.25, 0.28, 0.23, 1] },
  { id: "hip_l", shape: "sphere", center: [0.52, 2, 0.05], radius: 0.24, bone: "thigh_l", mirror: "x", blend: 0.04, color: [0.09, 0.09, 0.1, 1] },
  { id: "thigh_l", shape: "loft", bones: ["thigh_l"], radii: [0.2, 0.15], mirror: "x", blend: 0.03, color: [0.36, 0.4, 0.32, 1] },
  { id: "knee_l", shape: "sphere", center: [0.55, 1.38, 0.66], radius: 0.18, bone: "shin_l", mirror: "x", blend: 0.03, color: [0.92, 0.72, 0.12, 1] },
  { id: "shin_l", shape: "loft", bones: ["shin_l"], radii: [0.15, 0.1], mirror: "x", blend: 0.03, color: [0.55, 0.58, 0.5, 1] },
  { id: "piston_l", shape: "cylinder", center: [0.74, 0.9, 0.36], axis: "y", radius: 0.035, half: 0.38, bone: "shin_l", mirror: "x", color: [0.62, 0.65, 0.7, 1] },
  { id: "ankle_l", shape: "sphere", center: [0.55, 0.32, 0.04], radius: 0.13, bone: "foot_l", mirror: "x", blend: 0.03, color: [0.09, 0.09, 0.1, 1] },
  { id: "foot_l", shape: "loft", bones: ["foot_l"], radii: [0.11, 0.09], radii_v: [0.07, 0.05], mirror: "x", blend: 0.03, color: [0.25, 0.28, 0.23, 1] },
  { id: "toe_c_l", shape: "capsule", a: [0.55, 0.08, 0.6], b: [0.55, 0.045, 0.85], radius: 0.05, bone: "toe_l", mirror: "x", blend: 0.02, color: [0.62, 0.65, 0.7, 1] },
  { id: "toe_o_l", shape: "capsule", a: [0.65, 0.08, 0.56], b: [0.72, 0.045, 0.78], radius: 0.045, bone: "toe_l", mirror: "x", blend: 0.02, color: [0.62, 0.65, 0.7, 1] },
  { id: "toe_i_l", shape: "capsule", a: [0.45, 0.08, 0.56], b: [0.38, 0.045, 0.78], radius: 0.045, bone: "toe_l", mirror: "x", blend: 0.02, color: [0.62, 0.65, 0.7, 1] },
  { id: "eye_pupil", shape: "sphere", center: [0, 2.86, 0.98], radius: 0.03, bone: "eye_c", island: "eyes", color: [0.08, 0.02, 0.02, 1] },
];
const sdf = { cell: 0.028, shade: { ao: 0.5, ao_radius: 0.15, tone: 0.2, color_blend: 0.4 }, skin: { falloff: 1.2 }, decimate: { ratio: 0.3 }, islands: { eyes: { cell: 0.0107, adaptive: false, decimate: { ratio: 0.35 } }, lids: { cell: 0.0107, adaptive: false, decimate: { ratio: 0.4 } } }, parts: parts };
return {
  name: "walker", max: 16,
  family: { faction: "guard", kind: "mech", hp: 500 },
  nav: { agent: {"name":"walker","radius":0.95,"height":3.6,"step":0.8,"slope":35,"drop":1} },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, turn_rate: 1.6, radius: 0.9, max_speed: 6, accel: 3 },
    roles: roles,
    traits: { breath: 0, arm_swing: 0.25 },
    physics: physics,
    sdf: sdf
  },
  abilities: ["walk", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 500 }],
      ["guard", { speed: 2, leash: 30, look_gap: 6, near: 2.5, eye: 3 }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first; the blocks without a node (health, needs, injured) act through their hooks.
    worker: function (api, ld) {
      var tree = { name: "walker", select: [ld.node("guard")] };
      return { tree: tree };
    }
  }
};
