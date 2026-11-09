"use strict";
// brawler: in soma's one form of a creature file (soma/creature_file.js): `body` is the creature as it was made, the rest is who it is to the others (family, nav, abilities) and its mind: the blocks of soma/world/blocks/ it loads by name and
// its tree. The old worker of this file is left out; the mind below is the default of a creature of its kind (person): write the creature's own in `mind`.
// brawler: Brawler, a boxer made for soma: a bare-chested fighter in blue trunks and red gloves with a head that looks and a spine that breathes, two arms and two legs on ik chains. It takes the PACK boxing and with it a boxer's whole repertoire played from recorded motion on its own bones: a stance that tires and fidgets, jab, cross, hooks, uppercuts, body and kidney shots, combos, a block, weaves and dodges, a reaction to each kind of punch, a knockout and a win; a punch lands when the fist is within reach of the body of the creature it was thrown at (the action's first number), pushes it and tells the page `hit` with the damage, or `miss`. It also takes the PACK locomotion: a jump (the launch to the height asked, the fall, the landing; it tells the page `jumped` and `landed`), hops and steps, a crouch and the stand-up, dying in eight ways; they go back to the stance. Its own action: taunt.
// ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature { name, skeleton, rig, legs, body, roles, physics, mesh | sdf }. Metres, +x to its left, +y up, +z forward.
// PORTED from soma2.0/creatures/brawler.js by soma/tools/port_creature.js (recipe soma/tools/port_recipes/brawler.js).
// THE FACE (the bones kept, named, given joints; the roles in `roles`):
//   - eye 'eye_l': the sdf's sphere on the bone, an island with a ball, an iris, a pupil, a socket in the head, an upper lid made ('lid_up_l': a dome over it that closes down about its centre); it looks the way the donor's bone's does [0, 0, 1]
//   - jaw 'jaw': from its hinge to its chin, opens 20 degrees
// LEFT OUT of the donor's file (the restart has no place for it):
//   - arms' `can` (rest_on, hold): 2 arms (the restart has no hands that rest or hold)
//   - actions: taunt
//   - packs: boxing, locomotion
//   - limbs: {"avoid":true}
const bones = [
  { name: "hips", parent: null, head: [0, 0.95, 0], tail: [0, 1, 0] },
  { name: "spine", parent: "hips", head: [0, 1, 0], tail: [0, 1.15, 0] },
  { name: "chest", parent: "spine", head: [0, 1.15, 0], tail: [0, 1.4, 0] },
  { name: "neck", parent: "chest", head: [0, 1.4, 0], tail: [0, 1.5, 0.01] },
  { name: "head", parent: "neck", head: [0, 1.5, 0.01], tail: [0, 1.74, 0.03] },
  { name: "eye_l", parent: "head", head: [0.034, 1.64, 0.1065], tail: [0.034, 1.64, 0.12525], mirror: "x" },
  { name: "upper_l", parent: "chest", head: [0.2, 1.36, 0], tail: [0.26, 1.1, 0], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.26, 1.1, 0], tail: [0.31, 0.85, 0], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.31, 0.85, 0], tail: [0.315, 0.75, 0.01], mirror: "x" },
  { name: "thigh_l", parent: "hips", head: [0.1, 0.95, 0], tail: [0.105, 0.52, 0], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.105, 0.52, 0], tail: [0.105, 0.09, 0], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.105, 0.09, 0], tail: [0.105, 0.06, 0.13], mirror: "x" },
  { name: "jaw", parent: "head", head: [0, 1.6, 0], tail: [0, 1.565, 0.116] },
  { name: "lid_up_l", parent: "head", head: [0.034, 1.64, 0.1065], tail: [0.034, 1.64, 0.12213], mirror: "x" },
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
    { bone: "fore_l", kind: "hinge", axis: [-0.973, -0.195, -0.126], range: [-6, 150] },
    { bone: "upper_r", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] },
    { bone: "fore_r", kind: "hinge", axis: [-0.973, 0.195, 0.126], range: [-6, 150] },
    { bone: "spine", kind: "ball", fwd: 40, back: 25, lat: 25, twist: 30 },
    { bone: "chest", kind: "ball", fwd: 30, back: 20, lat: 25, twist: 30 },
    { bone: "neck", kind: "ball", fwd: 50, back: 50, lat: 40, twist: 60 },
    { bone: "head", kind: "ball", fwd: 35, back: 45, lat: 35, twist: 50 },
    { bone: "eye_l", kind: "ball", fwd: 35, back: 35, lat: 35, twist: [-10, 10] },
    { bone: "eye_r", kind: "ball", fwd: 35, back: 35, lat: 35, twist: [-10, 10] },
    { bone: "lid_up_l", kind: "hinge", axis: [1, 0, 0], range: [-20, 85] },
    { bone: "lid_up_r", kind: "hinge", axis: [1, 0, 0], range: [-20, 85] },
    { bone: "jaw", kind: "hinge", axis: [1, 0, 0], range: [-3, 20] },
  ],
  chains: [
    { name: "leg_l", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0, 0, 1], pole_w: 1 },
    { name: "leg_r", solver: "limb", bones: ["thigh_r", "shin_r"], tip: "foot_r", pole: [0, 0, 1], pole_w: 1 },
    { name: "arm_l", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0.25, -0.6, -1], pole_w: 1 },
    { name: "arm_r", solver: "limb", bones: ["upper_r", "fore_r"], pole: [-0.25, -0.6, -1], pole_w: 1 },
    { name: "head", bones: ["spine", "chest", "neck", "head"] },
  ],
};
const legs = { legs: ["leg_l", "leg_r"], gait: { from: "person_walk_strut", bob: 0.02, ride: 0.907 } };
const roles = { hips: "hips", spine: ["spine", "chest"], chest: "chest", neck: ["neck"], head: "head", arms: [{ chain: "arm_l", rest: [0.211, -0.977, 0] }, { chain: "arm_r", rest: [0.211, -0.977, 0] }], eyes: ["eye_l", "eye_r"], lids: [{ bone: "lid_up_l", dir: 1 }, { bone: "lid_up_r", dir: 1 }], jaw: { bone: "jaw", max: 20 } };
const physics = { mass: 85, shapes: [
    { id: "body", shape: "capsule", a: [0, 0.32, 0], b: [0, 1.3, 0], radius: 0.2, bone: "hips" },
    { id: "head", shape: "sphere", center: [0, 1.63, 0.02], radius: 0.115, bone: "head" },
    { id: "leg_l", shape: "capsule", a: [0.1, 0.855, 0], b: [0.105, 0.114, 0], radius: 0.081 },
    { id: "leg_r", shape: "capsule", a: [-0.1, 0.855, 0], b: [-0.105, 0.114, 0], radius: 0.081 },
  ] };
const parts = [
  { id: "pelvis", shape: "ellipsoid", center: [0, 0.98, 0], radii: [0.155, 0.1, 0.105], bone: "hips", blend: 0.03, color: [0.8, 0.58, 0.45, 1] },
  { id: "trunks", shape: "ellipsoid", center: [0, 0.9, 0], radii: [0.185, 0.145, 0.13], bone: "hips", blend: 0.025, color: [0.1, 0.2, 0.58, 1] },
  { id: "trunks_leg", shape: "capsule", a: [0.1, 0.93, 0], b: [0.105, 0.77, 0], radius: 0.098, bone: "thigh_l", mirror: "x", blend: 0.02, color: [0.1, 0.2, 0.58, 1] },
  { id: "waist_band", shape: "ellipsoid", center: [0, 1.035, 0], radii: [0.142, 0.026, 0.112], bone: "hips", blend: 0.01, color: [0.94, 0.94, 0.92, 1] },
  { id: "abdomen", shape: "ellipsoid", center: [0, 1.09, 0.004], radii: [0.14, 0.115, 0.098], bone: "spine", blend: 0.03, color: [0.8, 0.58, 0.45, 1] },
  { id: "chest", shape: "ellipsoid", center: [0, 1.27, 0.004], radii: [0.185, 0.165, 0.118], bone: "chest", blend: 0.035, color: [0.8, 0.58, 0.45, 1] },
  { id: "pec_l", shape: "ellipsoid", center: [0.085, 1.28, 0.078], radii: [0.08, 0.055, 0.05], bone: "chest", mirror: "x", blend: 0.025, color: [0.68, 0.47, 0.37, 1] },
  { id: "neck", shape: "capsule", a: [0, 1.4, 0], b: [0, 1.5, 0.012], radius: 0.056, bone: "neck", blend: 0.02, color: [0.8, 0.58, 0.45, 1] },
  { id: "skull", shape: "ellipsoid", center: [0, 1.625, 0.018], radii: [0.094, 0.113, 0.104], bone: "head", blend: 0.03, color: [0.8, 0.58, 0.45, 1] },
  { id: "jaw", shape: "ellipsoid", center: [0, 1.565, 0.05], radii: [0.068, 0.052, 0.066], bone: "jaw", blend: 0.03, color: [0.8, 0.58, 0.45, 1] },
  { id: "nose", shape: "sphere", center: [0, 1.602, 0.118], radius: 0.02, bone: "head", blend: 0.015, color: [0.8, 0.58, 0.45, 1] },
  { id: "ear_l", shape: "sphere", center: [0.094, 1.622, 0], radius: 0.024, bone: "head", mirror: "x", blend: 0.012, color: [0.8, 0.58, 0.45, 1] },
  { id: "brow", shape: "capsule", a: [-0.062, 1.658, 0.098], b: [0.062, 1.658, 0.098], radius: 0.015, bone: "head", blend: 0.015, color: [0.68, 0.47, 0.37, 1] },
  { id: "hair", shape: "ellipsoid", center: [0, 1.67, -0.012], radii: [0.099, 0.07, 0.104], bone: "head", blend: 0.02, color: [0.11, 0.07, 0.05, 1] },
  { id: "eye_l", shape: "sphere", center: [0.034, 1.64, 0.1065], radius: 0.0125, bone: "eye_l", mirror: "x", color: [0.93, 0.92, 0.88, 1], island: "eyes" },
  { id: "shoulder_l", shape: "sphere", center: [0.205, 1.345, 0], radius: 0.07, bone: "upper_l", mirror: "x", blend: 0.025, color: [0.8, 0.58, 0.45, 1] },
  { id: "arm_up_l", shape: "loft", bones: ["upper_l"], radii: [0.056, 0.046], mirror: "x", blend: 0.02, color: [0.8, 0.58, 0.45, 1] },
  { id: "elbow_l", shape: "sphere", center: [0.26, 1.1, 0], radius: 0.044, bone: "fore_l", mirror: "x", blend: 0.015, color: [0.8, 0.58, 0.45, 1] },
  { id: "arm_low_l", shape: "loft", bones: ["fore_l"], radii: [0.043, 0.034], mirror: "x", blend: 0.02, color: [0.8, 0.58, 0.45, 1] },
  { id: "cuff_l", shape: "cylinder", center: [0.304, 0.87, 0], axis: "y", radius: 0.046, half: 0.025, bone: "fore_l", mirror: "x", blend: 0.01, color: [0.94, 0.94, 0.92, 1] },
  { id: "glove_l", shape: "ellipsoid", center: [0.314, 0.775, 0.03], radii: [0.068, 0.075, 0.08], bone: "hand_l", mirror: "x", blend: 0.02, color: [0.76, 0.09, 0.09, 1] },
  { id: "thumb_l", shape: "ellipsoid", center: [0.352, 0.798, 0.045], radii: [0.026, 0.04, 0.032], bone: "hand_l", mirror: "x", blend: 0.012, color: [0.76, 0.09, 0.09, 1] },
  { id: "thigh_l", shape: "loft", bones: ["thigh_l"], radii: [0.088, 0.064], mirror: "x", blend: 0.02, color: [0.8, 0.58, 0.45, 1] },
  { id: "knee_l", shape: "sphere", center: [0.105, 0.52, 0.012], radius: 0.056, bone: "shin_l", mirror: "x", blend: 0.015, color: [0.8, 0.58, 0.45, 1] },
  { id: "shin_l", shape: "loft", bones: ["shin_l"], radii: [0.06, 0.04], mirror: "x", blend: 0.02, color: [0.8, 0.58, 0.45, 1] },
  { id: "sock_l", shape: "cylinder", center: [0.105, 0.14, 0], axis: "y", radius: 0.046, half: 0.045, bone: "shin_l", mirror: "x", blend: 0.01, color: [0.94, 0.94, 0.92, 1] },
  { id: "boot_l", shape: "box", center: [0.105, 0.048, 0.04], half: [0.05, 0.04, 0.095], round: 0.03, bone: "foot_l", mirror: "x", blend: 0.012, color: [0.08, 0.08, 0.11, 1] },
  { id: "eye_l_iris", shape: "sphere", center: [0.034, 1.64, 0.11213], radius: 0.0085, bone: "eye_l", island: "eyes", color: [0.33, 0.2, 0.09, 1], mirror: "x" },
  { id: "eye_l_pupil", shape: "sphere", center: [0.034, 1.64, 0.11838], radius: 0.00375, bone: "eye_l", island: "eyes", color: [0.02, 0.02, 0.02, 1], mirror: "x" },
  { id: "lid_up_l", shape: "sphere", center: [0.034, 1.64, 0.1065], radius: 0.01775, bone: "lid_up_l", island: "lids_up", color: [0.8, 0.58, 0.45, 1], mirror: "x" },
  { id: "lid_up_l_cut", shape: "box", center: [0.034, 1.61875, 0.1065], half: [0.02308, 0.025, 0.02308], op: "subtract", bone: "lid_up_l", island: "lids_up", mirror: "x" },
  { id: "eye_l_socket", shape: "sphere", center: [0.034, 1.64, 0.1065], radius: 0.014, op: "subtract", bone: "head", blend: 0.002, mirror: "x" },
];
const sdf = { cell: 0.012, adaptive: { min_cell: 0.006, max_cell: 0.024 }, shade: { ao: 0.45, ao_radius: 0.03, tone: 0.18, color_blend: 0.3 }, skin: { falloff: 1.5 }, islands: { eyes: { cell: 0.0014, adaptive: false, decimate: { ratio: 0.35 } }, lids_up: { cell: 0.003, adaptive: false, decimate: { ratio: 0.3 } } }, parts: parts };
return {
  name: "brawler", max: 16,
  family: { faction: "folk", kind: "person", hp: 100 },
  nav: { agent: "person" },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, radius: 0.24, max_speed: 4.6, accel: 14, turn_rate: 7 },
    roles: roles,
    physics: physics,
    sdf: sdf
  },
  abilities: ["walk", "open", "climb", "use", "effects"],
  interaction: { uses: ["sit", "sleep", "eat", "use"] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 100 }],
      "needs",
      ["use", { kinds: [], clip_sit: "sit_chair", clip_sleep: "lie_on_back" }],
      ["flee", { gait: "" }],
      ["greet", { meet: 6 }],
      "curious",
      "idle_life",
      "injured",
      ["wander", { speed: 1.1 }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first; the blocks without a node (health, needs, injured) act through their hooks.
    worker: function (api, ld) {
      var tree = { name: "brawler", select: [ld.node("flee"), ld.node("greet"), ld.node("use"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
