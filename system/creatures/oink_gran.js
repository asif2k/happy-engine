"use strict";
// oink_gran: the gran: a small round pig in a lavender dress with little white flowers and brown lace-up shoes. WRITTEN by system/cartoon_pigs.js (an ORIGINAL cartoon pig family, not any published character): edit its table and run the tool again rather than this file.
// A round pink pig of 1.1 m that walks on two legs: a big head, a flat snout, floppy ears, a curly tail, short arms, drawn from an sdf of its own parts (the pig and its clothes) on a skeleton of 15 bones (the left ones mirrored), the gait style `person_walk_cautious` of the pack.
// ITS TEXTURE is a recipe (maps.js, SYSTEM.md "Texture on an sdf creature"): soft skin with fine pores, the snout's grain, and cloth that is cloth (a weave, little flowers), lacquered shoes. It names parts of the sdf (the dress, the shirt, the trousers ...).
// ITS MIND (the blocks of soma/world/blocks/): it follows the nearest `oink_mum` (`follow`: it walks up when it is more than 7 m behind and stops 4 m from it); it greets, flees what is hostile, is curious, idles and wanders as a person does.
// ONE JS FILE IS ONE CREATURE (creature_file.js): it is read as text, run with new Function("api", text) and RETURNS { name, max, family, nav, body, abilities, interaction, mind }. Metres, +x to its left, +y up, +z forward.
const bones = [
  { name: "hips", parent: null, head: [0, 0.33, 0], tail: [0, 0.418, 0] },
  { name: "spine", parent: "hips", head: [0, 0.418, 0], tail: [0, 0.55, 0.011] },
  { name: "chest", parent: "spine", head: [0, 0.55, 0.011], tail: [0, 0.715, 0.022] },
  { name: "neck", parent: "chest", head: [0, 0.715, 0.022], tail: [0, 0.759, 0.044] },
  { name: "head", parent: "neck", head: [0, 0.759, 0.044], tail: [0, 1.056, 0.11] },
  { name: "eye_l", parent: "head", head: [0.11, 0.924, 0.22], tail: [0.11, 0.924, 0.264], mirror: "x" },
  { name: "ear_l", parent: "head", head: [0.154, 1.023, 0.033], tail: [0.22, 1.1, 0.022], mirror: "x" },
  { name: "tail1", parent: "hips", head: [0, 0.363, -0.154], tail: [0, 0.396, -0.242] },
  { name: "tail2", parent: "tail1", head: [0, 0.396, -0.242], tail: [0.0165, 0.473, -0.275] },
  { name: "upper_l", parent: "chest", head: [0.187, 0.682, 0], tail: [0.264, 0.517, 0.022], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.264, 0.517, 0.022], tail: [0.297, 0.363, 0.066], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.297, 0.363, 0.066], tail: [0.308, 0.297, 0.088], mirror: "x" },
  { name: "thigh_l", parent: "hips", head: [0.088, 0.33, 0], tail: [0.099, 0.176, 0.011], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.099, 0.176, 0.011], tail: [0.099, 0.055, 0], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.099, 0.055, 0], tail: [0.099, 0.022, 0.121], mirror: "x" },
];
const rig = { joints: [{ bone: "thigh_l", mirror: "x", kind: "ball", fwd: 75, back: 60, out: 40, in: 25, twist: [-25, 25] }, { bone: "shin_l", mirror: "x", kind: "hinge", axis: [1, 0, 0], range: [-14, 132] }, { bone: "foot_l", mirror: "x", kind: "ball", fwd: 45, back: 45, lat: 20, twist: 15 }, { bone: "upper_l", mirror: "x", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] }, { bone: "fore_l", mirror: "x", kind: "hinge", axis: [-1, 0, 0], range: [-19, 137] }, { bone: "spine", kind: "ball", fwd: 40, back: 25, lat: 25, twist: 30 }, { bone: "chest", kind: "ball", fwd: 30, back: 20, lat: 25, twist: 30 }, { bone: "neck", kind: "ball", fwd: 50, back: 50, lat: 40, twist: 60 }, { bone: "head", kind: "ball", fwd: 35, back: 45, lat: 35, twist: 50 }, { bone: "tail1", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 }, { bone: "tail2", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 }, { bone: "eye_l", mirror: "x", kind: "ball", fwd: 35, back: 35, lat: 35, twist: [-10, 10] }, { bone: "ear_l", mirror: "x", kind: "ball", fwd: 45, back: 55, lat: 35, twist: 25 }], chains: [{ name: "leg_l", mirror: "x", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0, 0, 1], pole_w: 1 }, { name: "arm_l", mirror: "x", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0.8, 0, -0.6], pole_w: 1 }, { name: "head", bones: ["spine", "chest", "neck", "head"] }, { name: "tail", bones: ["tail1", "tail2"] }] };
const legs = { legs: [{ chain: "leg_l", mirror: "x" }], gait: { from: "person_walk_cautious" } };
const roles = { hips: "hips", spine: ["spine", "chest"], chest: "chest", neck: ["neck"], head: "head", arms: [{ chain: "arm_l", rest: [0.364, -0.92, 0.086] }, { chain: "arm_r", rest: [0.364, -0.92, 0.086] }], eyes: ["eye_l", "eye_r"], ears: [["ear_l"], ["ear_r"]], tail: ["tail1", "tail2"] };
const physics = { mass: 48, shapes: [
    { id: "body", shape: "capsule", a: [0, 0.33, 0], b: [0, 0.66, 0], radius: 0.253, bone: "hips" },
    { id: "head", shape: "sphere", center: [0, 0.913, 0.077], radius: 0.253, bone: "head" },
    { id: "leg_l", shape: "capsule", a: [0.099, 0.308, 0], b: [0.099, 0.044, 0], radius: 0.066 },
    { id: "leg_r", shape: "capsule", a: [-0.099, 0.308, 0], b: [-0.099, 0.044, 0], radius: 0.066 },
  ] };
const parts = [
  { id: "head", shape: "ellipsoid", center: [0, 0.913, 0.077], radii: [0.2585, 0.2365, 0.2475], bone: "head", blend: 0.033, color: [0.95, 0.66, 0.72, 1] },
  { id: "snout", shape: "ellipsoid", center: [0, 0.869, 0.3135], radii: [0.1375, 0.1045, 0.0825], bone: "head", blend: 0.0242, color: [0.9, 0.5, 0.6, 1] },
  { id: "nostril", shape: "ellipsoid", center: [0.044, 0.869, 0.3872], radii: [0.0242, 0.0352, 0.0154], bone: "head", mirror: "x", blend: 0.0044, color: [0.42, 0.14, 0.2, 1] },
  { id: "ear", shape: "ellipsoid", center: [0.165, 1.0835, 0.033], radii: [0.09075, 0.1452, 0.033], bone: "ear_l", mirror: "x", blend: 0.0132, color: [0.95, 0.66, 0.72, 1] },
  { id: "ear_in", shape: "ellipsoid", center: [0.165, 1.0725, 0.0605], radii: [0.05445, 0.09075, 0.0132], bone: "ear_l", mirror: "x", blend: 0.0066, color: [0.88, 0.5, 0.6, 1] },
  { id: "eye_white", shape: "sphere", center: [0.11, 0.957, 0.22], radius: 0.0682, bone: "eye_l", mirror: "x", island: "eyes", color: [0.98, 0.98, 0.96, 1] },
  { id: "eye_pupil", shape: "sphere", center: [0.11, 0.957, 0.2783], radius: 0.0308, bone: "eye_l", mirror: "x", island: "eyes", color: [0.05, 0.04, 0.05, 1] },
  { id: "neck", shape: "capsule", a: [0, 0.715, 0.022], b: [0, 0.77, 0.044], radius: 0.1265, bone: "neck", blend: 0.033, color: [0.95, 0.66, 0.72, 1] },
  { id: "tail", shape: "loft", bones: ["tail1", "tail2"], radii: [0.0286, 0.022, 0.0132], blend: 0.011, color: [0.95, 0.66, 0.72, 1] },
  { id: "dress_chest", shape: "ellipsoid", center: [0, 0.66, 0.022], radii: [0.187, 0.121, 0.143], bone: "chest", blend: 0.044, color: [0.58, 0.44, 0.72, 1] },
  { id: "dress_belly", shape: "ellipsoid", center: [0, 0.517, 0.03795], radii: [0.253, 0.187, 0.21505], bone: "spine", blend: 0.055, color: [0.58, 0.44, 0.72, 1] },
  { id: "dress_skirt", shape: "ellipsoid", center: [0, 0.374, 0], radii: [0.29728, 0.132, 0.253], bone: "hips", blend: 0.044, color: [0.58, 0.44, 0.72, 1] },
  { id: "dress_hem", shape: "ellipsoid", center: [0, 0.2805, 0], radii: [0.3036, 0.0275, 0.25932], bone: "hips", blend: 0.011, color: [0.46399999999999997, 0.35200000000000004, 0.576, 1] },
  { id: "sleeve", shape: "loft", bones: ["upper_l"], radii: [0.0682, 0.0572], mirror: "x", blend: 0.022, color: [0.58, 0.44, 0.72, 1] },
  { id: "forearm", shape: "loft", bones: ["fore_l"], radii: [0.0495, 0.044], mirror: "x", blend: 0.022, color: [0.95, 0.66, 0.72, 1] },
  { id: "hand", shape: "ellipsoid", center: [0.308, 0.3135, 0.0825], radii: [0.0495, 0.055, 0.044], bone: "hand_l", mirror: "x", blend: 0.0132, color: [0.95, 0.66, 0.72, 1] },
  { id: "thigh", shape: "loft", bones: ["thigh_l"], radii: [0.0825, 0.0682], mirror: "x", blend: 0.0275, color: [0.95, 0.66, 0.72, 1] },
  { id: "shin", shape: "loft", bones: ["shin_l"], radii: [0.0638, 0.055], mirror: "x", blend: 0.022, color: [0.95, 0.66, 0.72, 1] },
  { id: "shoe", shape: "ellipsoid", center: [0.099, 0.0385, 0.055], radii: [0.0715, 0.044, 0.11], bone: "foot_l", mirror: "x", blend: 0.0165, color: [0.3, 0.2, 0.14, 1] },
  { id: "shoe_sole", shape: "ellipsoid", center: [0.099, 0.0132, 0.0605], radii: [0.0737, 0.0154, 0.1133], bone: "foot_l", mirror: "x", blend: 0.0066, color: [0.12, 0.1, 0.1, 1] },
];
const sdf = { cell: 0.0154, adaptive: { min_cell: 0.0077, max_cell: 0.0308 }, decimate: { ratio: 0.35 }, skin: { falloff: 1.2 }, shade: { ao: 0.5, ao_radius: 0.055, tone: 0.2, color_blend: 0.15 }, islands: { eyes: { cell: 0.0055, adaptive: false, decimate: { ratio: 0.35 } } }, parts: parts };
const texture = { size: 256, seed: 23, layers: [
  { kind: "noise", parts: ["head", "snout", "ear*", "neck", "tail", "forearm", "hand", "thigh", "shin"], scale: 0.066, octaves: 2, amount: 0.1 },
  { kind: "noise", parts: ["head", "snout", "ear*", "neck", "tail", "forearm", "hand"], scale: 0.0132, amount: 0.12 },
  { kind: "cells", parts: ["snout"], size: 0.0154, line: 0.2, colour: [0.55, 0.22, 0.3], vary: 0.2, edge: 0.45, strength: 0.3 },
  { kind: "gradient", parts: ["head"], by: "position", axis: [0, 1, 0], from: 0.858, to: 1.067, colour: [1, 0.8, 0.84], strength: 0.4 },
  { kind: "cells", parts: ["dress*"], size: 0.0121, line: 0.28, colour: [0, 0, 0], vary: 0.1, edge: 0.5, strength: 0.16 },
  { kind: "spots", parts: ["dress_chest", "dress_belly", "dress_skirt", "sleeve"], size: 0.066, radius: 0.2, density: 0.8, vary: 0.4, colour: [0.96, 0.95, 0.9], edge: 0.3, strength: 0.95, seed: 23 },
  { kind: "spots", parts: ["dress_chest", "dress_belly", "dress_skirt", "sleeve"], size: 0.066, radius: 0.07, density: 0.8, vary: 0.2, colour: [0.9, 0.7, 0.2], edge: 0.3, strength: 0.95, seed: 24 },
  { kind: "fill", parts: ["shoe", "shoe_sole"], roughness: 0.3, metal: 0.02 },
  { kind: "noise", parts: ["shoe"], scale: 0.033, amount: 0.15 }
] };
return {
  name: "oink_gran",
  max: 16,
  family: { faction: "animal", kind: "person", hp: 45 },
  nav: { agent: { name: "oink_gran", radius: 0.2783, height: 1.1, step: 0.11, slope: 35, drop: 0.33 } },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, radius: 0.253, turn_rate: 3.5 },
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
      ["health", { hp: 45 }],
      ["flee", { speed: 1.4, distance: 9 }],
      ["follow", { group: "oink_mum", look: 14, lose: 60, far: 7, near: 4, speed: 0.7, run_speed: 1.4, run_from: 15.4 }],
      ["greet", { meet: 6 }],
      ["curious", { approach: 0.3, cooldown: 20, near: 0.66 }],
      ["idle_life", {}],
      ["injured", { clip_flinch: "" }],
      ["wander", { speed: 0.7, near: 0.5, pause_min: 2, pause_max: 8 }]
    ],
    // THE WORKER: the tree of the blocks above, in the order they act.
    worker: function (api, ld) {
      var tree = { name: "oink_gran", select: [ld.node("flee"), ld.node("follow"), ld.node("greet"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
