"use strict";
// fat_monster: in soma's one form of a creature file (soma/creature_file.js): `body` is the creature as it was made, the rest is who it is to the others (family, nav, abilities) and its mind: the blocks of soma/world/blocks/ it loads by name and
// its tree. The old worker of this file is left out; the mind below is the default of a creature of its kind (robot): write the creature's own in `mind`.
// fat_monster: Fat monster, a swamp ogre made for soma that is all fat and meat: a belly in three tiers, man-boobs, flanks and back rolls, buttocks, flabby thighs, arms and forearms, round shoulders, jowls, a wattle and floppy ears: 24 soft-tissue bones that each say `soft` with their own stiffness and damping, masses on springs that gravity and the body's motion move. It waddles, breathes hard, roars, laughs till it wobbles, pounds its belly and bounces; the pack locomotion gives it a jump with a landing that shakes it all.
// ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature { name, skeleton, rig, legs, body, roles, physics, mesh | sdf }. Metres, +x to its left, +y up, +z forward.
// PORTED from soma2.0/creatures/fat_monster.js by soma/tools/port_creature.js (recipe soma/tools/port_recipes/fat_monster.js).
// THE FACE (the bones kept, named, given joints; the roles in `roles`):
//   - eye 'eye_l': the sdf's sphere on the bone, an island with a pupil, an upper lid made ('lid_up_l': a dome over it that closes down about its centre); it looks the way the donor's bone's does [0, 0, 1]
//   - jaw 'jaw': from its hinge to its chin, opens 55 degrees
//   - ears: 'ear_l'
// LEFT OUT of the donor's file (the restart has no place for it):
//   - soft tissue: 14 soft bones (belly_up, belly_mid, belly_low, moob_l ...) merged into the rigid bones they hang from: the parts that were on them are rigid now
//   - arms' `can` (rest_on, hold): 2 arms (the restart has no hands that rest or hold)
//   - actions: roar, belly_laugh, belly_pound, bounce
//   - packs: locomotion
//   - trait tail = 1.3 (not a trait of the restart)
const bones = [
  { name: "hips", parent: null, head: [0, 0.8, 0], tail: [0, 0.9, 0] },
  { name: "spine", parent: "hips", head: [0, 0.9, 0], tail: [0, 1.08, 0.02] },
  { name: "chest", parent: "spine", head: [0, 1.08, 0.02], tail: [0, 1.52, 0.04] },
  { name: "neck", parent: "chest", head: [0, 1.52, 0.04], tail: [0, 1.64, 0.1] },
  { name: "head", parent: "neck", head: [0, 1.64, 0.1], tail: [0, 1.98, 0.16] },
  { name: "jaw", parent: "head", head: [0, 1.72, 0.14], tail: [0, 1.68, 0.4] },
  { name: "eye_l", parent: "head", head: [0.1, 1.86, 0.26], tail: [0.1, 1.86, 0.3125], mirror: "x" },
  { name: "tail1", parent: "hips", head: [0, 0.84, -0.22], tail: [0, 0.76, -0.55] },
  { name: "tail2", parent: "tail1", head: [0, 0.76, -0.55], tail: [0, 0.66, -0.9] },
  { name: "tail3", parent: "tail2", head: [0, 0.66, -0.9], tail: [0, 0.62, -1.15] },
  { name: "upper_l", parent: "chest", head: [0.5, 1.44, 0], tail: [0.72, 1.02, 0.02], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.72, 1.02, 0.02], tail: [0.84, 0.58, 0.08], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.84, 0.58, 0.08], tail: [0.87, 0.38, 0.12], mirror: "x" },
  { name: "thigh_l", parent: "hips", head: [0.24, 0.8, 0], tail: [0.28, 0.42, 0.02], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.28, 0.42, 0.02], tail: [0.29, 0.1, 0], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.29, 0.1, 0], tail: [0.29, 0.05, 0.22], mirror: "x" },
  { name: "ear_l", parent: "head", head: [0.26, 1.84, 0], tail: [0.42, 1.8, -0.06], mirror: "x" },
  { name: "lid_up_l", parent: "head", head: [0.1, 1.86, 0.26], tail: [0.1, 1.86, 0.30375], mirror: "x" },
];
const rig = {
  joints: [
    { bone: "thigh_l", kind: "ball", fwd: 75, back: 60, out: 40, in: 25, twist: [-25, 25] },
    { bone: "shin_l", kind: "hinge", axis: [0.84, 0.06, -0.54], range: [-14, 132] },
    { bone: "foot_l", kind: "ball", fwd: 45, back: 45, lat: 20, twist: 15 },
    { bone: "thigh_r", kind: "ball", fwd: 75, back: 60, out: 40, in: 25, twist: [-25, 25] },
    { bone: "shin_r", kind: "hinge", axis: [0.84, -0.06, 0.54], range: [-14, 132] },
    { bone: "foot_r", kind: "ball", fwd: 45, back: 45, lat: 20, twist: 15 },
    { bone: "upper_l", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] },
    { bone: "fore_l", kind: "hinge", axis: [-0.325, -0.214, -0.921], range: [-19, 137] },
    { bone: "upper_r", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] },
    { bone: "fore_r", kind: "hinge", axis: [-0.325, 0.214, 0.921], range: [-19, 137] },
    { bone: "spine", kind: "ball", fwd: 40, back: 25, lat: 25, twist: 30 },
    { bone: "chest", kind: "ball", fwd: 30, back: 20, lat: 25, twist: 30 },
    { bone: "neck", kind: "ball", fwd: 50, back: 50, lat: 40, twist: 60 },
    { bone: "head", kind: "ball", fwd: 35, back: 45, lat: 35, twist: 50 },
    { bone: "tail1", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 },
    { bone: "tail2", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 },
    { bone: "tail3", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 },
    { bone: "eye_l", kind: "ball", fwd: 35, back: 35, lat: 35, twist: [-10, 10] },
    { bone: "eye_r", kind: "ball", fwd: 35, back: 35, lat: 35, twist: [-10, 10] },
    { bone: "lid_up_l", kind: "hinge", axis: [1, 0, 0], range: [-20, 85] },
    { bone: "lid_up_r", kind: "hinge", axis: [1, 0, 0], range: [-20, 85] },
    { bone: "jaw", kind: "hinge", axis: [1, 0, 0], range: [-3, 55] },
    { bone: "ear_l", kind: "ball", fwd: 45, back: 55, lat: 35, twist: 25 },
    { bone: "ear_r", kind: "ball", fwd: 45, back: 55, lat: 35, twist: 25 },
  ],
  chains: [
    { name: "leg_l", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0.538, 0.038, 0.842], pole_w: 1 },
    { name: "leg_r", solver: "limb", bones: ["thigh_r", "shin_r"], tip: "foot_r", pole: [-0.538, 0.038, 0.842], pole_w: 1 },
    { name: "arm_l", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0.872, 0.309, -0.38], pole_w: 1 },
    { name: "arm_r", solver: "limb", bones: ["upper_r", "fore_r"], pole: [-0.872, 0.309, -0.38], pole_w: 1 },
    { name: "head", bones: ["spine", "chest", "neck", "head"] },
    { name: "tail", bones: ["tail1", "tail2", "tail3"] },
  ],
};
const legs = { legs: ["leg_l", "leg_r"], gait: { from: "cmu_17_09_muscular_heavyset_persons_walk", speed: 0.75, ride: 0.766 } };
const roles = { hips: "hips", spine: ["spine", "chest"], chest: "chest", neck: ["neck"], head: "head", arms: [{ chain: "arm_l", rest: [0.364, -0.92, 0.086] }, { chain: "arm_r", rest: [0.364, -0.92, 0.086] }], eyes: ["eye_l", "eye_r"], lids: [{ bone: "lid_up_l", dir: 1 }, { bone: "lid_up_r", dir: 1 }], jaw: { bone: "jaw", max: 55 }, ears: [["ear_l"], ["ear_r"]], tail: ["tail1", "tail2", "tail3"] };
const physics = { mass: 280, shapes: [
    { id: "body", shape: "capsule", a: [0, 0.45, 0], b: [0, 1.45, 0], radius: 0.5, bone: "hips" },
    { id: "head", shape: "sphere", center: [0, 1.84, 0.1], radius: 0.26, bone: "head" },
    { id: "leg_l", shape: "capsule", a: [0.24, 0.72, 0], b: [0.29, 0.096, 0], radius: 0.068 },
    { id: "leg_r", shape: "capsule", a: [-0.24, 0.72, 0], b: [-0.29, 0.096, 0], radius: 0.068 },
  ] };
const parts = [
  { id: "pelvis", shape: "ellipsoid", center: [0, 0.82, -0.02], radii: [0.34, 0.2, 0.26], bone: "hips", blend: 0.05, color: [0.46, 0.58, 0.3, 1] },
  { id: "waist", shape: "ellipsoid", center: [0, 1.08, 0], radii: [0.3, 0.22, 0.22], bone: "spine", blend: 0.06, color: [0.46, 0.58, 0.3, 1] },
  { id: "ribs", shape: "ellipsoid", center: [0, 1.34, 0], radii: [0.4, 0.24, 0.26], bone: "chest", blend: 0.06, color: [0.46, 0.58, 0.3, 1] },
  { id: "neck", shape: "capsule", a: [0, 1.52, 0.04], b: [0, 1.64, 0.1], radius: 0.16, bone: "neck", blend: 0.05, color: [0.46, 0.58, 0.3, 1] },
  { id: "spike_a", shape: "capsule", a: [0, 1.5, -0.18], b: [0, 1.66, -0.36], radius: 0.032, bone: "chest", blend: 0.01, color: [0.22, 0.17, 0.13, 1] },
  { id: "spike_b", shape: "capsule", a: [0, 1.62, -0.06], b: [0, 1.8, -0.2], radius: 0.028, bone: "neck", blend: 0.01, color: [0.22, 0.17, 0.13, 1] },
  { id: "wart_a", shape: "sphere", center: [0.22, 1.5, 0.05], radius: 0.035, bone: "chest", mirror: "x", blend: 0.015, color: [0.3, 0.38, 0.19, 1] },
  { id: "belly_up", shape: "ellipsoid", center: [0, 1.22, 0.24], radii: [0.36, 0.17, 0.24], bone: "spine", blend: 0.1, color: [0.76, 0.72, 0.44, 1] },
  { id: "belly_mid", shape: "ellipsoid", center: [0, 0.98, 0.28], radii: [0.4, 0.18, 0.26], bone: "spine", blend: 0.1, color: [0.76, 0.72, 0.44, 1] },
  { id: "belly_low", shape: "ellipsoid", center: [0, 0.78, 0.28], radii: [0.36, 0.16, 0.24], bone: "hips", blend: 0.1, color: [0.76, 0.72, 0.44, 1] },
  { id: "moob_l", shape: "ellipsoid", center: [0.2, 1.32, 0.24], radii: [0.15, 0.12, 0.12], bone: "chest", mirror: "x", blend: 0.07, color: [0.34, 0.46, 0.23, 1] },
  { id: "flank_l", shape: "ellipsoid", center: [0.4, 1, 0.02], radii: [0.13, 0.17, 0.19], bone: "spine", mirror: "x", blend: 0.08, color: [0.46, 0.58, 0.3, 1] },
  { id: "back_up", shape: "ellipsoid", center: [0, 1.32, -0.26], radii: [0.3, 0.1, 0.13], bone: "chest", blend: 0.08, color: [0.34, 0.46, 0.23, 1] },
  { id: "back_low", shape: "ellipsoid", center: [0, 1.02, -0.28], radii: [0.32, 0.1, 0.13], bone: "spine", blend: 0.08, color: [0.34, 0.46, 0.23, 1] },
  { id: "butt_l", shape: "ellipsoid", center: [0.2, 0.76, -0.22], radii: [0.17, 0.18, 0.16], bone: "hips", mirror: "x", blend: 0.08, color: [0.46, 0.58, 0.3, 1] },
  { id: "skull", shape: "ellipsoid", center: [0, 1.82, 0.08], radii: [0.22, 0.22, 0.22], bone: "head", blend: 0.05, color: [0.46, 0.58, 0.3, 1] },
  { id: "brow", shape: "capsule", a: [-0.15, 1.92, 0.24], b: [0.15, 1.92, 0.24], radius: 0.04, bone: "head", blend: 0.03, color: [0.34, 0.46, 0.23, 1] },
  { id: "muzzle", shape: "ellipsoid", center: [0, 1.74, 0.26], radii: [0.14, 0.1, 0.14], bone: "head", blend: 0.04, color: [0.46, 0.58, 0.3, 1] },
  { id: "nose", shape: "sphere", center: [0, 1.76, 0.38], radius: 0.04, bone: "head", blend: 0.02, color: [0.34, 0.46, 0.23, 1] },
  { id: "horn_l", shape: "capsule", a: [0.13, 1.98, 0.05], b: [0.22, 2.2, -0.08], radius: 0.04, bone: "head", mirror: "x", blend: 0.02, color: [0.22, 0.17, 0.13, 1] },
  { id: "jaw", shape: "ellipsoid", center: [0, 1.68, 0.26], radii: [0.13, 0.05, 0.14], bone: "jaw", blend: 0.03, color: [0.34, 0.46, 0.23, 1] },
  { id: "tusk_l", shape: "capsule", a: [0.09, 1.7, 0.34], b: [0.1, 1.84, 0.38], radius: 0.018, bone: "jaw", mirror: "x", blend: 0.005, color: [0.92, 0.88, 0.74, 1] },
  { id: "jowl_l", shape: "ellipsoid", center: [0.16, 1.72, 0.18], radii: [0.1, 0.1, 0.1], bone: "head", mirror: "x", blend: 0.06, color: [0.46, 0.58, 0.3, 1] },
  { id: "wattle", shape: "ellipsoid", center: [0, 1.62, 0.25], radii: [0.11, 0.11, 0.1], bone: "head", blend: 0.06, color: [0.76, 0.72, 0.44, 1] },
  { id: "ear_l", shape: "ellipsoid", center: [0.3, 1.76, -0.02], radii: [0.1, 0.15, 0.035], bone: "ear_l", mirror: "x", blend: 0.03, color: [0.34, 0.46, 0.23, 1] },
  { id: "eye_l", shape: "sphere", center: [0.1, 1.86, 0.26], radius: 0.035, bone: "eye_l", mirror: "x", color: [0.96, 0.8, 0.14, 1], island: "eyes" },
  { id: "tail", shape: "loft", bones: ["tail1", "tail2", "tail3"], radii: [0.15, 0.11, 0.07, 0.03], blend: 0.04, color: [0.46, 0.58, 0.3, 1] },
  { id: "shoulder_l", shape: "sphere", center: [0.5, 1.46, 0], radius: 0.17, bone: "upper_l", mirror: "x", blend: 0.05, color: [0.46, 0.58, 0.3, 1] },
  { id: "shoulder_fat_l", shape: "ellipsoid", center: [0.5, 1.54, -0.05], radii: [0.15, 0.12, 0.15], bone: "chest", mirror: "x", blend: 0.07, color: [0.46, 0.58, 0.3, 1] },
  { id: "arm_up_l", shape: "loft", bones: ["upper_l"], radii: [0.16, 0.125], mirror: "x", blend: 0.04, color: [0.46, 0.58, 0.3, 1] },
  { id: "arm_fat_l", shape: "ellipsoid", center: [0.64, 1.16, -0.06], radii: [0.08, 0.14, 0.08], bone: "upper_l", mirror: "x", blend: 0.06, color: [0.46, 0.58, 0.3, 1] },
  { id: "elbow_l", shape: "sphere", center: [0.72, 1.02, 0.02], radius: 0.12, bone: "fore_l", mirror: "x", blend: 0.04, color: [0.46, 0.58, 0.3, 1] },
  { id: "arm_low_l", shape: "loft", bones: ["fore_l"], radii: [0.12, 0.1], mirror: "x", blend: 0.04, color: [0.46, 0.58, 0.3, 1] },
  { id: "fore_fat_l", shape: "ellipsoid", center: [0.79, 0.8, -0.02], radii: [0.07, 0.12, 0.07], bone: "fore_l", mirror: "x", blend: 0.05, color: [0.46, 0.58, 0.3, 1] },
  { id: "hand_l", shape: "ellipsoid", center: [0.87, 0.36, 0.12], radii: [0.11, 0.12, 0.08], bone: "hand_l", mirror: "x", blend: 0.03, color: [0.34, 0.46, 0.23, 1] },
  { id: "claw_l", shape: "capsule", a: [0.84, 0.28, 0.17], b: [0.84, 0.16, 0.25], radius: 0.015, bone: "hand_l", mirror: "x", blend: 0.005, color: [0.17, 0.15, 0.13, 1] },
  { id: "claw2_l", shape: "capsule", a: [0.88, 0.27, 0.18], b: [0.89, 0.14, 0.27], radius: 0.015, bone: "hand_l", mirror: "x", blend: 0.005, color: [0.17, 0.15, 0.13, 1] },
  { id: "claw3_l", shape: "capsule", a: [0.92, 0.28, 0.17], b: [0.94, 0.17, 0.24], radius: 0.015, bone: "hand_l", mirror: "x", blend: 0.005, color: [0.17, 0.15, 0.13, 1] },
  { id: "thigh_l", shape: "loft", bones: ["thigh_l"], radii: [0.21, 0.145], mirror: "x", blend: 0.04, color: [0.46, 0.58, 0.3, 1] },
  { id: "thigh_fat_l", shape: "ellipsoid", center: [0.34, 0.6, 0], radii: [0.1, 0.17, 0.13], bone: "thigh_l", mirror: "x", blend: 0.07, color: [0.46, 0.58, 0.3, 1] },
  { id: "knee_l", shape: "sphere", center: [0.28, 0.42, 0.04], radius: 0.14, bone: "shin_l", mirror: "x", blend: 0.04, color: [0.46, 0.58, 0.3, 1] },
  { id: "shin_l", shape: "loft", bones: ["shin_l"], radii: [0.14, 0.1], mirror: "x", blend: 0.04, color: [0.46, 0.58, 0.3, 1] },
  { id: "foot_l", shape: "ellipsoid", center: [0.29, 0.07, 0.1], radii: [0.13, 0.07, 0.19], bone: "foot_l", mirror: "x", blend: 0.03, color: [0.34, 0.46, 0.23, 1] },
  { id: "toe_l", shape: "sphere", center: [0.29, 0.05, 0.28], radius: 0.06, bone: "foot_l", mirror: "x", blend: 0.02, color: [0.34, 0.46, 0.23, 1] },
  { id: "eye_l_pupil", shape: "sphere", center: [0.1, 1.86, 0.288], radius: 0.014, bone: "eye_l", island: "eyes", color: [0.05, 0.03, 0.02, 1], mirror: "x" },
  { id: "lid_up_l", shape: "sphere", center: [0.1, 1.86, 0.26], radius: 0.0455, bone: "lid_up_l", island: "lids_up", color: [0.4, 0.52, 0.27, 1], mirror: "x" },
  { id: "lid_up_l_cut", shape: "box", center: [0.1, 1.80225, 0.26], half: [0.05915, 0.07, 0.05915], op: "subtract", bone: "lid_up_l", island: "lids_up", mirror: "x" },
];
const sdf = { cell: 0.02, adaptive: { min_cell: 0.01, max_cell: 0.04 }, shade: { ao: 0.5, ao_radius: 0.05, tone: 0.2, color_blend: 0.3 }, skin: { falloff: 1.5 }, decimate: { ratio: 0.5 }, islands: { eyes: { cell: 0.005, adaptive: false, decimate: { ratio: 0.35 } }, lids_up: { cell: 0.0076, adaptive: false, decimate: { ratio: 0.3 } } }, parts: parts };
// TEXTURE (maps.js, SYSTEM.md "Texture on an sdf creature"): a recipe baked into a colour map and a packed map (512 x 512: it is 2.5 m tall) when the species is made. A lumpy mottled hide: dark cell lines like cracked skin, brown blotches, fine grain.
const texture = { size: 512, seed: 41, layers: [
  {kind: "noise", scale: 0.08, amount: 0.25},
  {kind: "cells", size: 0.09, line: 0.1, colour: [0.2,0.3,0.13], vary: 0.3, edge: 0.5, strength: 0.45},
  {kind: "spots", size: 0.14, radius: 0.22, density: 0.35, vary: 0.6, colour: [0.32,0.24,0.12], edge: 0.4, strength: 0.5},
  {kind: "noise", scale: 0.03, amount: 0.2}
] };
// SOFT TISSUE it asks for (soma/tissue/tissue.js expands it when the file is read: a soft bone each (two for a pair) placed on this body, the skin round it carved out of the bones of its region; SOMA.md "Tissue bones")
const tissue = ["belly"];
return {
  name: "fat_monster", max: 16,
  family: { faction: "monster", kind: "monster", hp: 77 },
  nav: { agent: "person" },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, radius: 0.55, max_speed: 3.2, accel: 6, turn_rate: 3.2 },
    roles: roles,
    traits: { gait: 1.8, breath: 2.5, idle: 1.5 },
    physics: physics,
    sdf: sdf,
    texture: texture,
    tissue: tissue
  },
  abilities: ["walk", "open", "climb", "use", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 77 }],
      ["flee", { gait: "" }],
      "curious",
      "idle_life",
      "injured",
      ["wander", { speed: 1.1 }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first; the blocks without a node (health, needs, injured) act through their hooks.
    worker: function (api, ld) {
      var tree = { name: "fat_monster", select: [ld.node("flee"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
