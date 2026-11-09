"use strict";
// oink_boy: the boy: a small round pig in green overalls over a striped red shirt and red shoes. WRITTEN by system/cartoon_pigs.js (an ORIGINAL cartoon pig family, not any published character): edit its table and run the tool again rather than this file.
// A round pink pig of 0.62 m that walks on two legs: a big head, a flat snout, floppy ears, a curly tail, short arms, drawn from an sdf of its own parts (the pig and its clothes) on a skeleton of 15 bones (the left ones mirrored), the gait style `person_walk_cheerful` of the pack.
// ITS TEXTURE is a recipe (maps.js, SYSTEM.md "Texture on an sdf creature"): soft skin with fine pores, the snout's grain, and cloth that is cloth (a weave, stripes, denim), lacquered shoes. It names parts of the sdf (the dress, the shirt, the trousers ...).
// ITS MIND (the blocks of soma/world/blocks/): it follows the nearest `oink_mum` (`follow`: it walks up when it is more than 2.5 m behind and stops 1.2 m from it); it greets, flees what is hostile, is curious, idles and wanders as a person does.
// ONE JS FILE IS ONE CREATURE (creature_file.js): it is read as text, run with new Function("api", text) and RETURNS { name, max, family, nav, body, abilities, interaction, mind }. Metres, +x to its left, +y up, +z forward.
const bones = [
  { name: "hips", parent: null, head: [0, 0.186, 0], tail: [0, 0.2356, 0] },
  { name: "spine", parent: "hips", head: [0, 0.2356, 0], tail: [0, 0.31, 0.0062] },
  { name: "chest", parent: "spine", head: [0, 0.31, 0.0062], tail: [0, 0.403, 0.0124] },
  { name: "neck", parent: "chest", head: [0, 0.403, 0.0124], tail: [0, 0.4278, 0.0248] },
  { name: "head", parent: "neck", head: [0, 0.4278, 0.0248], tail: [0, 0.5952, 0.062] },
  { name: "eye_l", parent: "head", head: [0.062, 0.5208, 0.124], tail: [0.062, 0.5208, 0.1488], mirror: "x" },
  { name: "ear_l", parent: "head", head: [0.0868, 0.5766, 0.0186], tail: [0.124, 0.62, 0.0124], mirror: "x" },
  { name: "tail1", parent: "hips", head: [0, 0.2046, -0.0868], tail: [0, 0.2232, -0.1364] },
  { name: "tail2", parent: "tail1", head: [0, 0.2232, -0.1364], tail: [0.0093, 0.2666, -0.155] },
  { name: "upper_l", parent: "chest", head: [0.1054, 0.3844, 0], tail: [0.1488, 0.2914, 0.0124], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.1488, 0.2914, 0.0124], tail: [0.1674, 0.2046, 0.0372], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.1674, 0.2046, 0.0372], tail: [0.1736, 0.1674, 0.0496], mirror: "x" },
  { name: "thigh_l", parent: "hips", head: [0.0496, 0.186, 0], tail: [0.0558, 0.0992, 0.0062], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.0558, 0.0992, 0.0062], tail: [0.0558, 0.031, 0], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.0558, 0.031, 0], tail: [0.0558, 0.0124, 0.0682], mirror: "x" },
];
const rig = { joints: [{ bone: "thigh_l", mirror: "x", kind: "ball", fwd: 75, back: 60, out: 40, in: 25, twist: [-25, 25] }, { bone: "shin_l", mirror: "x", kind: "hinge", axis: [1, 0, 0], range: [-14, 132] }, { bone: "foot_l", mirror: "x", kind: "ball", fwd: 45, back: 45, lat: 20, twist: 15 }, { bone: "upper_l", mirror: "x", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] }, { bone: "fore_l", mirror: "x", kind: "hinge", axis: [-1, 0, 0], range: [-19, 137] }, { bone: "spine", kind: "ball", fwd: 40, back: 25, lat: 25, twist: 30 }, { bone: "chest", kind: "ball", fwd: 30, back: 20, lat: 25, twist: 30 }, { bone: "neck", kind: "ball", fwd: 50, back: 50, lat: 40, twist: 60 }, { bone: "head", kind: "ball", fwd: 35, back: 45, lat: 35, twist: 50 }, { bone: "tail1", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 }, { bone: "tail2", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 }, { bone: "eye_l", mirror: "x", kind: "ball", fwd: 35, back: 35, lat: 35, twist: [-10, 10] }, { bone: "ear_l", mirror: "x", kind: "ball", fwd: 45, back: 55, lat: 35, twist: 25 }], chains: [{ name: "leg_l", mirror: "x", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0, 0, 1], pole_w: 1 }, { name: "arm_l", mirror: "x", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0.8, 0, -0.6], pole_w: 1 }, { name: "head", bones: ["spine", "chest", "neck", "head"] }, { name: "tail", bones: ["tail1", "tail2"] }] };
const legs = { legs: [{ chain: "leg_l", mirror: "x" }], gait: { from: "person_walk_cheerful" } };
const roles = { hips: "hips", spine: ["spine", "chest"], chest: "chest", neck: ["neck"], head: "head", arms: [{ chain: "arm_l", rest: [0.364, -0.92, 0.086] }, { chain: "arm_r", rest: [0.364, -0.92, 0.086] }], eyes: ["eye_l", "eye_r"], ears: [["ear_l"], ["ear_r"]], tail: ["tail1", "tail2"] };
const physics = { mass: 14, shapes: [
    { id: "body", shape: "capsule", a: [0, 0.186, 0], b: [0, 0.372, 0], radius: 0.1364, bone: "hips" },
    { id: "head", shape: "sphere", center: [0, 0.5146, 0.0434], radius: 0.1426, bone: "head" },
    { id: "leg_l", shape: "capsule", a: [0.0558, 0.1736, 0], b: [0.0558, 0.0248, 0], radius: 0.0372 },
    { id: "leg_r", shape: "capsule", a: [-0.0558, 0.1736, 0], b: [-0.0558, 0.0248, 0], radius: 0.0372 },
  ] };
const parts = [
  { id: "head", shape: "ellipsoid", center: [0, 0.5146, 0.0434], radii: [0.1457, 0.1333, 0.1395], bone: "head", blend: 0.0186, color: [0.95, 0.66, 0.72, 1] },
  { id: "snout", shape: "ellipsoid", center: [0, 0.4898, 0.1767], radii: [0.0775, 0.0589, 0.0465], bone: "head", blend: 0.01364, color: [0.9, 0.5, 0.6, 1] },
  { id: "nostril", shape: "ellipsoid", center: [0.0248, 0.4898, 0.21824], radii: [0.01364, 0.01984, 0.00868], bone: "head", mirror: "x", blend: 0.00248, color: [0.42, 0.14, 0.2, 1] },
  { id: "ear", shape: "ellipsoid", center: [0.093, 0.6107, 0.0186], radii: [0.05347, 0.08556, 0.0186], bone: "ear_l", mirror: "x", blend: 0.00744, color: [0.95, 0.66, 0.72, 1] },
  { id: "ear_in", shape: "ellipsoid", center: [0.093, 0.6045, 0.0341], radii: [0.03208, 0.05347, 0.00744], bone: "ear_l", mirror: "x", blend: 0.00372, color: [0.88, 0.5, 0.6, 1] },
  { id: "eye_white", shape: "sphere", center: [0.062, 0.5394, 0.124], radius: 0.03844, bone: "eye_l", mirror: "x", island: "eyes", color: [0.98, 0.98, 0.96, 1] },
  { id: "eye_pupil", shape: "sphere", center: [0.062, 0.5394, 0.15686], radius: 0.01736, bone: "eye_l", mirror: "x", island: "eyes", color: [0.05, 0.04, 0.05, 1] },
  { id: "neck", shape: "capsule", a: [0, 0.403, 0.0124], b: [0, 0.434, 0.0248], radius: 0.0713, bone: "neck", blend: 0.0186, color: [0.95, 0.66, 0.72, 1] },
  { id: "tail", shape: "loft", bones: ["tail1", "tail2"], radii: [0.01612, 0.0124, 0.00744], blend: 0.0062, color: [0.95, 0.66, 0.72, 1] },
  { id: "shirt_chest", shape: "ellipsoid", center: [0, 0.372, 0.0124], radii: [0.1054, 0.0682, 0.0806], bone: "chest", blend: 0.0248, color: [0.84, 0.28, 0.2, 1] },
  { id: "shirt_belly", shape: "ellipsoid", center: [0, 0.2914, 0.02046], radii: [0.1364, 0.1054, 0.11594], bone: "spine", blend: 0.031, color: [0.84, 0.28, 0.2, 1] },
  { id: "overalls_seat", shape: "ellipsoid", center: [0, 0.2108, -0.0062], radii: [0.12617, 0.0806, 0.11253], bone: "hips", blend: 0.0248, color: [0.24, 0.5, 0.28, 1] },
  { id: "overalls_bib", shape: "ellipsoid", center: [0, 0.3224, 0.0744], radii: [0.0744, 0.062, 0.0372], bone: "spine", blend: 0.0124, color: [0.24, 0.5, 0.28, 1] },
  { id: "sleeve", shape: "loft", bones: ["upper_l"], radii: [0.03844, 0.03224], mirror: "x", blend: 0.0124, color: [0.84, 0.28, 0.2, 1] },
  { id: "forearm", shape: "loft", bones: ["fore_l"], radii: [0.0279, 0.0248], mirror: "x", blend: 0.0124, color: [0.84, 0.28, 0.2, 1] },
  { id: "hand", shape: "ellipsoid", center: [0.1736, 0.1767, 0.0465], radii: [0.0279, 0.031, 0.0248], bone: "hand_l", mirror: "x", blend: 0.00744, color: [0.95, 0.66, 0.72, 1] },
  { id: "overalls_thigh", shape: "loft", bones: ["thigh_l"], radii: [0.0465, 0.03844], mirror: "x", blend: 0.0155, color: [0.24, 0.5, 0.28, 1] },
  { id: "overalls_shin", shape: "loft", bones: ["shin_l"], radii: [0.03596, 0.031], mirror: "x", blend: 0.0124, color: [0.24, 0.5, 0.28, 1] },
  { id: "shoe", shape: "ellipsoid", center: [0.0558, 0.0217, 0.031], radii: [0.0403, 0.0248, 0.062], bone: "foot_l", mirror: "x", blend: 0.0093, color: [0.75, 0.15, 0.12, 1] },
  { id: "shoe_sole", shape: "ellipsoid", center: [0.0558, 0.00744, 0.0341], radii: [0.04154, 0.00868, 0.06386], bone: "foot_l", mirror: "x", blend: 0.00372, color: [0.12, 0.1, 0.1, 1] },
];
const sdf = { cell: 0.00868, adaptive: { min_cell: 0.00434, max_cell: 0.01736 }, decimate: { ratio: 0.35 }, skin: { falloff: 1.2 }, shade: { ao: 0.5, ao_radius: 0.031, tone: 0.2, color_blend: 0.15 }, islands: { eyes: { cell: 0.0031, adaptive: false, decimate: { ratio: 0.35 } } }, parts: parts };
const texture = { size: 256, seed: 26, layers: [
  { kind: "noise", parts: ["head", "snout", "ear*", "neck", "tail", "forearm", "hand"], scale: 0.0372, octaves: 2, amount: 0.1 },
  { kind: "noise", parts: ["head", "snout", "ear*", "neck", "tail", "forearm", "hand"], scale: 0.00744, amount: 0.12 },
  { kind: "cells", parts: ["snout"], size: 0.00868, line: 0.2, colour: [0.55, 0.22, 0.3], vary: 0.2, edge: 0.45, strength: 0.3 },
  { kind: "gradient", parts: ["head"], by: "position", axis: [0, 1, 0], from: 0.4836, to: 0.6014, colour: [1, 0.8, 0.84], strength: 0.4 },
  { kind: "cells", parts: ["shirt*", "sleeve", "overalls*"], size: 0.00682, line: 0.28, colour: [0, 0, 0], vary: 0.1, edge: 0.5, strength: 0.16 },
  { kind: "stripes", parts: ["shirt*", "sleeve"], axis: [0, 1, 0], period: 0.0434, width: 0.4, colour: [0.96, 0.9, 0.85], edge: 0.35, strength: 0.9, height: 0.00372 },
  { kind: "noise", parts: ["overalls*"], scale: 0.0124, amount: 0.3 },
  { kind: "fill", parts: ["shoe", "shoe_sole"], roughness: 0.3, metal: 0.02 },
  { kind: "noise", parts: ["shoe"], scale: 0.0186, amount: 0.15 }
] };
return {
  name: "oink_boy",
  max: 16,
  family: { faction: "animal", kind: "person", hp: 24 },
  nav: { agent: { name: "oink_boy", radius: 0.15004, height: 0.62, step: 0.062, slope: 35, drop: 0.186 } },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, radius: 0.1364, turn_rate: 3.5 },
    roles: roles,
    traits: { gait: 1.2, breath: 1.5, idle: 1.2 },
    physics: physics,
    sdf: sdf,
    texture: texture
  },
  abilities: ["walk", "open", "climb", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 24 }],
      ["flee", { speed: 2, distance: 9 }],
      ["follow", { group: "oink_mum", look: 14, lose: 60, far: 2.5, near: 1.2, speed: 1, run_speed: 2, run_from: 5.5 }],
      ["greet", { meet: 6 }],
      ["curious", { approach: 0.3, cooldown: 20, near: 0.372 }],
      ["idle_life", {}],
      ["injured", { clip_flinch: "" }],
      ["wander", { speed: 1, near: 0.5, pause_min: 2, pause_max: 8 }]
    ],
    // THE WORKER: the tree of the blocks above, in the order they act.
    worker: function (api, ld) {
      var tree = { name: "oink_boy", select: [ld.node("flee"), ld.node("follow"), ld.node("greet"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
