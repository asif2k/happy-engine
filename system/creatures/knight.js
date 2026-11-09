"use strict";
// knight: in soma's one form of a creature file (soma/creature_file.js): the body is the creature as it was made, the mind is the blocks of soma/world/blocks/ it loads and its tree.
// A knight on duty: stands watch at the place it was born, turns its head now and then, goes to look at a noise and goes back to its post, never further than its leash.
// knight: Knight, an armoured knight made for soma: a great helm with a visor slit and two glowing eyes behind it that look, a plume that springs after its motion, a breastplate on a spine and chest that breathe, pauldrons, gauntlets, greaves, two legs on ik chains that walk (and run, heavily) and two arms on ik chains whose hands swing, reach, rest on a table or a wall and hold. It carries a sword as a prop with two mounts: on its back, the hilt over the right shoulder and the blade across the back, and in its right hand. Its actions: draw (the hand goes up behind the shoulder, the sword slides into it), sheathe (it goes back over the shoulder), guard (the sword held up in front), slash (a cut down across the body, the spine turning with it, told to the page) and bow. Collision shapes: the body, the head and each forearm, and the blade's while the sword is out.
// ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature { name, skeleton, rig, legs, body, roles, physics, mesh | sdf }. Metres, +x to its left, +y up, +z forward.
// PORTED from soma2.0/creatures/knight.js by soma/tools/port_creature.js (recipe soma/tools/port_recipes/knight.js).
// THE FACE (the bones kept, named, given joints; the roles in `roles`):
//   - eye 'eye_l': the sdf's sphere on the bone, an island with a pupil; it looks the way the donor's bone's does [0, 0, 1]
//   - appendages: 'plume1' > 'plume2' > 'plume3' (follow)
// LEFT OUT of the donor's file (the restart has no place for it):
//   - arms' `can` (rest_on, hold): 2 arms (the restart has no hands that rest or hold)
//   - the prop's mounts, holsters, grip points and actions ('sword'): the prop itself stays as the donor models it, a rigid piece on 'hand_r'
//   - actions: draw, sheathe, guard, slash, bow
//   - tags: slash
//   - limbs: {"avoid":true}
const bones = [
  { name: "hips", parent: null, head: [0, 0.8, 0], tail: [0, 0.86, 0] },
  { name: "spine", parent: "hips", head: [0, 0.86, 0], tail: [0, 1.02, 0] },
  { name: "chest", parent: "spine", head: [0, 1.02, 0], tail: [0, 1.26, 0] },
  { name: "neck", parent: "chest", head: [0, 1.26, 0], tail: [0, 1.33, 0.01] },
  { name: "head", parent: "neck", head: [0, 1.33, 0.01], tail: [0, 1.52, 0.03] },
  { name: "eye_l", parent: "head", head: [0.045, 1.42, 0.148], tail: [0.045, 1.42, 0.1735], mirror: "x" },
  { name: "plume1", parent: "head", head: [0, 1.55, -0.03], tail: [0, 1.605, -0.09] },
  { name: "plume2", parent: "plume1", head: [0, 1.605, -0.09], tail: [0, 1.625, -0.17] },
  { name: "plume3", parent: "plume2", head: [0, 1.625, -0.17], tail: [0, 1.6, -0.25] },
  { name: "upper_l", parent: "chest", head: [0.215, 1.22, 0], tail: [0.235, 0.96, 0], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.235, 0.96, 0], tail: [0.245, 0.72, 0], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.245, 0.72, 0], tail: [0.245, 0.63, 0], mirror: "x" },
  { name: "sword", parent: "hand_r", head: [-0.245, 0.675, 0.02], tail: [-0.245, 0.161, 0.633] },
  { name: "thigh_l", parent: "hips", head: [0.1, 0.8, 0], tail: [0.105, 0.44, 0], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.105, 0.44, 0], tail: [0.105, 0.085, 0], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.105, 0.085, 0], tail: [0.105, 0.06, 0.12], mirror: "x" },
];
const rig = {
  joints: [
    { bone: "thigh_l", kind: "ball", fwd: 75, back: 60, out: 40, in: 25, twist: [-25, 25] },
    { bone: "shin_l", kind: "hinge", axis: [1, 0, 0], range: [-6, 140] },
    { bone: "foot_l", kind: "ball", fwd: 45, back: 45, lat: 20, twist: 15 },
    { bone: "thigh_r", kind: "ball", fwd: 75, back: 60, out: 40, in: 25, twist: [-25, 25] },
    { bone: "shin_r", kind: "hinge", axis: [1, 0, 0], range: [-6, 140] },
    { bone: "foot_r", kind: "ball", fwd: 45, back: 45, lat: 20, twist: 15 },
    { bone: "upper_l", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] },
    { bone: "fore_l", kind: "hinge", axis: [-0.975, -0.041, -0.219], range: [-6, 150] },
    { bone: "upper_r", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] },
    { bone: "fore_r", kind: "hinge", axis: [-0.975, 0.041, 0.219], range: [-6, 150] },
    { bone: "spine", kind: "ball", fwd: 40, back: 25, lat: 25, twist: 30 },
    { bone: "chest", kind: "ball", fwd: 30, back: 20, lat: 25, twist: 30 },
    { bone: "neck", kind: "ball", fwd: 50, back: 50, lat: 40, twist: 60 },
    { bone: "head", kind: "ball", fwd: 35, back: 45, lat: 35, twist: 50 },
    { bone: "eye_l", kind: "ball", fwd: 35, back: 35, lat: 35, twist: [-10, 10] },
    { bone: "eye_r", kind: "ball", fwd: 35, back: 35, lat: 35, twist: [-10, 10] },
    { bone: "plume1", kind: "ball", fwd: 35, back: 35, lat: 35, twist: 15 },
    { bone: "plume2", kind: "ball", fwd: 35, back: 35, lat: 35, twist: 15 },
    { bone: "plume3", kind: "ball", fwd: 35, back: 35, lat: 35, twist: 15 },
  ],
  chains: [
    { name: "leg_l", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0, 0, 1], pole_w: 1 },
    { name: "leg_r", solver: "limb", bones: ["thigh_r", "shin_r"], tip: "foot_r", pole: [0, 0, 1], pole_w: 1 },
    { name: "arm_l", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0.25, -0.6, -1], pole_w: 1 },
    { name: "arm_r", solver: "limb", bones: ["upper_r", "fore_r"], pole: [-0.25, -0.6, -1], pole_w: 1 },
    { name: "head", bones: ["spine", "chest", "neck", "head"] },
  ],
};
const legs = { legs: ["leg_l", "leg_r"], gait: { from: "cmu_137_42_strong_man_walk", speed: 0.85, ride: 0.764 } };
const roles = { hips: "hips", spine: ["spine", "chest"], chest: "chest", neck: ["neck"], head: "head", arms: [{ chain: "arm_l", rest: [0.06, -0.998, 0] }, { chain: "arm_r", rest: [0.06, -0.998, 0] }], eyes: ["eye_l", "eye_r"], appendages: [{ bones: ["plume1", "plume2", "plume3"], kind: "follow" }] };
const physics = { mass: 130, shapes: [
    { id: "body", shape: "capsule", a: [0, 0.3, 0], b: [0, 1.12, 0], radius: 0.19, bone: "hips" },
    { id: "head", shape: "sphere", center: [0, 1.41, 0.02], radius: 0.14, bone: "head" },
    { id: "leg_l", shape: "capsule", a: [0.1, 0.72, 0], b: [0.105, 0.096, 0], radius: 0.068 },
    { id: "leg_r", shape: "capsule", a: [-0.1, 0.72, 0], b: [-0.105, 0.096, 0], radius: 0.068 },
  ] };
const parts = [
  { id: "fauld", shape: "box", center: [0, 0.84, 0], half: [0.165, 0.07, 0.115], round: 0.05, bone: "hips", blend: 0.02, color: [0.66, 0.7, 0.76, 1] },
  { id: "belt", shape: "torus", center: [0, 0.925, 0], axis: "y", radius: 0.15, tube: 0.016, bone: "spine", color: [0.38, 0.24, 0.13, 1] },
  { id: "buckle", shape: "box", center: [0, 0.925, 0.152], half: [0.028, 0.025, 0.012], round: 0.008, bone: "spine", color: [0.88, 0.7, 0.25, 1] },
  { id: "waist", shape: "cylinder", center: [0, 0.99, 0], axis: "y", radius: 0.125, half: 0.05, bone: "spine", blend: 0.015, color: [0.3, 0.33, 0.39, 1] },
  { id: "torso", shape: "ellipsoid", center: [0, 1.14, 0], radii: [0.19, 0.22, 0.135], bone: "chest", blend: 0.03, blend_mode: "cubic", color: [0.66, 0.7, 0.76, 1] },
  { id: "ridge", shape: "loft", points: [[0, 1.02, 0.118], [0, 1.14, 0.142], [0, 1.26, 0.118]], radii: [0.009, 0.012, 0.009], bone: "chest", blend: 0.008, color: [0.88, 0.7, 0.25, 1] },
  { id: "gorget", shape: "cylinder", center: [0, 1.275, 0], axis: "y", radius: 0.085, half: 0.03, bone: "neck", blend: 0.012, color: [0.3, 0.33, 0.39, 1] },
  { id: "back_up", shape: "box", center: [0, 1.14, -0.13], half: [0.1, 0.09, 0.022], round: 0.015, bone: "chest", blend: 0.012, color: [0.38, 0.24, 0.13, 1] },
  { id: "back_low", shape: "box", center: [0, 0.935, -0.125], half: [0.14, 0.04, 0.022], round: 0.015, bone: "spine", blend: 0.012, color: [0.38, 0.24, 0.13, 1] },
  { id: "helm", shape: "ellipsoid", center: [0, 1.41, 0.02], radii: [0.12, 0.135, 0.135], bone: "head", blend: 0.03, color: [0.66, 0.7, 0.76, 1] },
  { id: "band", shape: "torus", center: [0, 1.36, 0.02], axis: "y", radius: 0.118, tube: 0.009, bone: "head", color: [0.88, 0.7, 0.25, 1] },
  { id: "visor", shape: "loft", points: [[-0.105, 1.42, 0.0845], [-0.08, 1.42, 0.1202], [-0.04, 1.42, 0.1469], [0, 1.42, 0.1546], [0.04, 1.42, 0.1469], [0.08, 1.42, 0.1202], [0.105, 1.42, 0.0845]], radii: [0.011, 0.011, 0.011, 0.011, 0.011, 0.011, 0.011], bone: "head", blend: 0.004, color: [0.04, 0.05, 0.07, 1] },
  { id: "bar", shape: "box", center: [0, 1.385, 0.155], half: [0.011, 0.045, 0.012], round: 0.006, bone: "head", blend: 0.006, color: [0.66, 0.7, 0.76, 1] },
  { id: "crest", shape: "capsule", a: [0, 1.53, 0.08], b: [0, 1.52, -0.06], radius: 0.016, bone: "head", blend: 0.012, color: [0.88, 0.7, 0.25, 1] },
  { id: "eye_l", shape: "sphere", center: [0.045, 1.42, 0.148], radius: 0.017, bone: "eye_l", mirror: "x", color: [1, 0.78, 0.3, 1], island: "eyes" },
  { id: "plume", shape: "loft", bones: ["plume1", "plume2", "plume3"], radii: [0.009, 0.012, 0.011, 0.004], radii_v: [0.026, 0.04, 0.036, 0.012], bone_blend: 0, blend: 0.012, color: [0.72, 0.13, 0.13, 1] },
  { id: "pauldron_l", shape: "ellipsoid", center: [0.255, 1.205, 0], radii: [0.09, 0.06, 0.095], bone: "upper_l", mirror: "x", blend: 0.02, color: [0.66, 0.7, 0.76, 1] },
  { id: "arm_up_l", shape: "loft", bones: ["upper_l"], radii: [0.05, 0.043], mirror: "x", blend: 0.015, color: [0.3, 0.33, 0.39, 1] },
  { id: "elbow_l", shape: "sphere", center: [0.235, 0.96, 0], radius: 0.048, bone: "fore_l", mirror: "x", blend: 0.012, color: [0.66, 0.7, 0.76, 1] },
  { id: "arm_low_l", shape: "loft", bones: ["fore_l"], radii: [0.044, 0.037], mirror: "x", blend: 0.015, color: [0.66, 0.7, 0.76, 1] },
  { id: "gauntlet_l", shape: "ellipsoid", center: [0.245, 0.665, 0.012], radii: [0.042, 0.058, 0.05], bone: "hand_l", mirror: "x", blend: 0.012, color: [0.3, 0.33, 0.39, 1] },
  { id: "thumb_l", shape: "sphere", center: [0.28, 0.69, 0.035], radius: 0.018, bone: "hand_l", mirror: "x", blend: 0.01, color: [0.3, 0.33, 0.39, 1] },
  { id: "hip_l", shape: "sphere", center: [0.1, 0.8, 0], radius: 0.065, bone: "thigh_l", mirror: "x", blend: 0.02, color: [0.3, 0.33, 0.39, 1] },
  { id: "thigh_l", shape: "loft", bones: ["thigh_l"], radii: [0.078, 0.062], mirror: "x", blend: 0.015, color: [0.66, 0.7, 0.76, 1] },
  { id: "knee_l", shape: "sphere", center: [0.105, 0.44, 0.03], radius: 0.066, bone: "shin_l", mirror: "x", blend: 0.012, color: [0.3, 0.33, 0.39, 1] },
  { id: "shin_l", shape: "loft", bones: ["shin_l"], radii: [0.06, 0.044], mirror: "x", blend: 0.015, color: [0.66, 0.7, 0.76, 1] },
  { id: "foot_l", shape: "box", center: [0.105, 0.045, 0.05], half: [0.052, 0.04, 0.1], round: 0.03, bone: "foot_l", mirror: "x", blend: 0.012, color: [0.3, 0.33, 0.39, 1] },
  { id: "sword_blade", island: "sword", shape: "loft", points: [[-0.245, 0.62036, 0.08511], [-0.245, 0.22504, 0.55623], [-0.245, 0.16072, 0.63283]], radii: [0.0065, 0.006, 0.0025], radii_v: [0.026, 0.024, 0.003], bone: "sword", blend: 0.004, color: [0.86, 0.89, 0.94, 1] },
  { id: "sword_guard", island: "sword", shape: "capsule", a: [-0.245, 0.54376, 0.02083], b: [-0.245, 0.69696, 0.14939], radius: 0.013, bone: "sword", blend: 0.004, color: [0.88, 0.7, 0.25, 1] },
  { id: "sword_grip", island: "sword", shape: "capsule", a: [-0.245, 0.73606, -0.05277], b: [-0.245, 0.63001, 0.07362], radius: 0.017, bone: "sword", blend: 0.004, color: [0.38, 0.24, 0.13, 1] },
  { id: "sword_pommel", island: "sword", shape: "sphere", center: [-0.245, 0.75215, -0.07192], radius: 0.022, bone: "sword", color: [0.88, 0.7, 0.25, 1] },
  { id: "eye_l_pupil", shape: "sphere", center: [0.045, 1.42, 0.1616], radius: 0.0068, bone: "eye_l", island: "eyes", color: [0.12, 0.05, 0.02, 1], mirror: "x" },
];
const sdf = { cell: 0.012, adaptive: { min_cell: 0.006, max_cell: 0.024 }, shade: { ao: 0.5, ao_radius: 0.03, tone: 0.2, color_blend: 0.35 }, skin: { falloff: 1.5 }, islands: { sword: { cell: 0.004, adaptive: false, decimate: { ratio: 0.3 } }, eyes: { cell: 0.0024, adaptive: false, decimate: { ratio: 0.35 } } }, decimate: { ratio: 0.4 }, parts: parts };
return {
  name: "knight", max: 16,
  family: { faction: "guard", kind: "person", hp: 150 },
  nav: { agent: "person" },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, radius: 0.22, max_speed: 3.8, accel: 10, turn_rate: 4 },
    roles: roles,
    physics: physics,
    sdf: sdf,
    props: { sword: { bone: "sword" } }
  },
  abilities: ["walk", "open", "climb", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 150 }],
      ["guard", { speed: 1.2, look_gap: 5 }],
      ["idle_life", { gap_min: 8, gap_max: 20 }],
      "injured"
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first; the blocks without a node (health, needs, injured) act through their hooks.
    worker: function (api, ld) {
      var tree = { name: "knight", select: [ld.node("guard")] };
      return { tree: tree };
    }
  }
};
