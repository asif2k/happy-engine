"use strict";
// oink_mum: the mum: a round pig in a teal dress with cream polka dots and brown shoes. WRITTEN by system/cartoon_pigs.js (an ORIGINAL cartoon pig family, not any published character): edit its table and run the tool again rather than this file.
// A round pink pig of 1.2 m that walks on two legs: a big head, a flat snout, floppy ears, a curly tail, short arms, drawn from an sdf of its own parts (the pig and its clothes) on a skeleton of 15 bones (the left ones mirrored), the gait style `person_walk_cheerful` of the pack.
// ITS TEXTURE is a recipe (maps.js, SYSTEM.md "Texture on an sdf creature"): soft skin with fine pores, the snout's grain, and cloth that is cloth (a weave, polka dots), lacquered shoes. It names parts of the sdf (the dress, the shirt, the trousers ...).
// ITS MIND (the blocks of soma/world/blocks/): it leads the family (the others follow it); it greets, flees what is hostile, is curious, idles and wanders as a person does.
// ONE JS FILE IS ONE CREATURE (creature_file.js): it is read as text, run with new Function("api", text) and RETURNS { name, max, family, nav, body, abilities, interaction, mind }. Metres, +x to its left, +y up, +z forward.
const bones = [
  { name: "hips", parent: null, head: [0, 0.36, 0], tail: [0, 0.456, 0] },
  { name: "spine", parent: "hips", head: [0, 0.456, 0], tail: [0, 0.6, 0.012] },
  { name: "chest", parent: "spine", head: [0, 0.6, 0.012], tail: [0, 0.78, 0.024] },
  { name: "neck", parent: "chest", head: [0, 0.78, 0.024], tail: [0, 0.828, 0.048] },
  { name: "head", parent: "neck", head: [0, 0.828, 0.048], tail: [0, 1.152, 0.12] },
  { name: "eye_l", parent: "head", head: [0.12, 1.008, 0.24], tail: [0.12, 1.008, 0.288], mirror: "x" },
  { name: "ear_l", parent: "head", head: [0.168, 1.116, 0.036], tail: [0.24, 1.2, 0.024], mirror: "x" },
  { name: "tail1", parent: "hips", head: [0, 0.396, -0.168], tail: [0, 0.432, -0.264] },
  { name: "tail2", parent: "tail1", head: [0, 0.432, -0.264], tail: [0.018, 0.516, -0.3] },
  { name: "upper_l", parent: "chest", head: [0.204, 0.744, 0], tail: [0.288, 0.564, 0.024], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.288, 0.564, 0.024], tail: [0.324, 0.396, 0.072], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.324, 0.396, 0.072], tail: [0.336, 0.324, 0.096], mirror: "x" },
  { name: "thigh_l", parent: "hips", head: [0.096, 0.36, 0], tail: [0.108, 0.192, 0.012], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.108, 0.192, 0.012], tail: [0.108, 0.06, 0], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.108, 0.06, 0], tail: [0.108, 0.024, 0.132], mirror: "x" },
];
const rig = { joints: [{ bone: "thigh_l", mirror: "x", kind: "ball", fwd: 75, back: 60, out: 40, in: 25, twist: [-25, 25] }, { bone: "shin_l", mirror: "x", kind: "hinge", axis: [1, 0, 0], range: [-14, 132] }, { bone: "foot_l", mirror: "x", kind: "ball", fwd: 45, back: 45, lat: 20, twist: 15 }, { bone: "upper_l", mirror: "x", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] }, { bone: "fore_l", mirror: "x", kind: "hinge", axis: [-1, 0, 0], range: [-19, 137] }, { bone: "spine", kind: "ball", fwd: 40, back: 25, lat: 25, twist: 30 }, { bone: "chest", kind: "ball", fwd: 30, back: 20, lat: 25, twist: 30 }, { bone: "neck", kind: "ball", fwd: 50, back: 50, lat: 40, twist: 60 }, { bone: "head", kind: "ball", fwd: 35, back: 45, lat: 35, twist: 50 }, { bone: "tail1", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 }, { bone: "tail2", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 }, { bone: "eye_l", mirror: "x", kind: "ball", fwd: 35, back: 35, lat: 35, twist: [-10, 10] }, { bone: "ear_l", mirror: "x", kind: "ball", fwd: 45, back: 55, lat: 35, twist: 25 }], chains: [{ name: "leg_l", mirror: "x", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0, 0, 1], pole_w: 1 }, { name: "arm_l", mirror: "x", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0.8, 0, -0.6], pole_w: 1 }, { name: "head", bones: ["spine", "chest", "neck", "head"] }, { name: "tail", bones: ["tail1", "tail2"] }] };
const legs = { legs: [{ chain: "leg_l", mirror: "x" }], gait: { from: "person_walk_cheerful" } };
const roles = { hips: "hips", spine: ["spine", "chest"], chest: "chest", neck: ["neck"], head: "head", arms: [{ chain: "arm_l", rest: [0.364, -0.92, 0.086] }, { chain: "arm_r", rest: [0.364, -0.92, 0.086] }], eyes: ["eye_l", "eye_r"], ears: [["ear_l"], ["ear_r"]], tail: ["tail1", "tail2"] };
const physics = { mass: 60, shapes: [
    { id: "body", shape: "capsule", a: [0, 0.36, 0], b: [0, 0.72, 0], radius: 0.24, bone: "hips" },
    { id: "head", shape: "sphere", center: [0, 0.996, 0.084], radius: 0.276, bone: "head" },
    { id: "leg_l", shape: "capsule", a: [0.108, 0.336, 0], b: [0.108, 0.048, 0], radius: 0.072 },
    { id: "leg_r", shape: "capsule", a: [-0.108, 0.336, 0], b: [-0.108, 0.048, 0], radius: 0.072 },
  ] };
const parts = [
  { id: "head", shape: "ellipsoid", center: [0, 0.996, 0.084], radii: [0.282, 0.258, 0.27], bone: "head", blend: 0.036, color: [0.95, 0.66, 0.72, 1] },
  { id: "snout", shape: "ellipsoid", center: [0, 0.948, 0.342], radii: [0.15, 0.114, 0.09], bone: "head", blend: 0.0264, color: [0.9, 0.5, 0.6, 1] },
  { id: "nostril", shape: "ellipsoid", center: [0.048, 0.948, 0.4224], radii: [0.0264, 0.0384, 0.0168], bone: "head", mirror: "x", blend: 0.0048, color: [0.42, 0.14, 0.2, 1] },
  { id: "ear", shape: "ellipsoid", center: [0.18, 1.182, 0.036], radii: [0.09, 0.144, 0.036], bone: "ear_l", mirror: "x", blend: 0.0144, color: [0.95, 0.66, 0.72, 1] },
  { id: "ear_in", shape: "ellipsoid", center: [0.18, 1.17, 0.066], radii: [0.054, 0.09, 0.0144], bone: "ear_l", mirror: "x", blend: 0.0072, color: [0.88, 0.5, 0.6, 1] },
  { id: "eye_white", shape: "sphere", center: [0.12, 1.044, 0.24], radius: 0.0744, bone: "eye_l", mirror: "x", island: "eyes", color: [0.98, 0.98, 0.96, 1] },
  { id: "eye_pupil", shape: "sphere", center: [0.12, 1.044, 0.3036], radius: 0.0336, bone: "eye_l", mirror: "x", island: "eyes", color: [0.05, 0.04, 0.05, 1] },
  { id: "neck", shape: "capsule", a: [0, 0.78, 0.024], b: [0, 0.84, 0.048], radius: 0.138, bone: "neck", blend: 0.036, color: [0.95, 0.66, 0.72, 1] },
  { id: "tail", shape: "loft", bones: ["tail1", "tail2"], radii: [0.0312, 0.024, 0.0144], blend: 0.012, color: [0.95, 0.66, 0.72, 1] },
  { id: "dress_chest", shape: "ellipsoid", center: [0, 0.72, 0.024], radii: [0.204, 0.132, 0.156], bone: "chest", blend: 0.048, color: [0.1, 0.55, 0.56, 1] },
  { id: "dress_belly", shape: "ellipsoid", center: [0, 0.564, 0.036], radii: [0.24, 0.204, 0.204], bone: "spine", blend: 0.06, color: [0.1, 0.55, 0.56, 1] },
  { id: "dress_skirt", shape: "ellipsoid", center: [0, 0.408, 0], radii: [0.282, 0.144, 0.24], bone: "hips", blend: 0.048, color: [0.1, 0.55, 0.56, 1] },
  { id: "dress_hem", shape: "ellipsoid", center: [0, 0.306, 0], radii: [0.288, 0.03, 0.246], bone: "hips", blend: 0.012, color: [0.08000000000000002, 0.44000000000000006, 0.44800000000000006, 1] },
  { id: "sleeve", shape: "loft", bones: ["upper_l"], radii: [0.0744, 0.0624], mirror: "x", blend: 0.024, color: [0.1, 0.55, 0.56, 1] },
  { id: "forearm", shape: "loft", bones: ["fore_l"], radii: [0.054, 0.048], mirror: "x", blend: 0.024, color: [0.95, 0.66, 0.72, 1] },
  { id: "hand", shape: "ellipsoid", center: [0.336, 0.342, 0.09], radii: [0.054, 0.06, 0.048], bone: "hand_l", mirror: "x", blend: 0.0144, color: [0.95, 0.66, 0.72, 1] },
  { id: "thigh", shape: "loft", bones: ["thigh_l"], radii: [0.09, 0.0744], mirror: "x", blend: 0.03, color: [0.95, 0.66, 0.72, 1] },
  { id: "shin", shape: "loft", bones: ["shin_l"], radii: [0.0696, 0.06], mirror: "x", blend: 0.024, color: [0.95, 0.66, 0.72, 1] },
  { id: "shoe", shape: "ellipsoid", center: [0.108, 0.042, 0.06], radii: [0.078, 0.048, 0.12], bone: "foot_l", mirror: "x", blend: 0.018, color: [0.35, 0.2, 0.12, 1] },
  { id: "shoe_sole", shape: "ellipsoid", center: [0.108, 0.0144, 0.066], radii: [0.0804, 0.0168, 0.1236], bone: "foot_l", mirror: "x", blend: 0.0072, color: [0.12, 0.1, 0.1, 1] },
];
const sdf = { cell: 0.0168, adaptive: { min_cell: 0.0084, max_cell: 0.0336 }, decimate: { ratio: 0.35 }, skin: { falloff: 1.2 }, shade: { ao: 0.5, ao_radius: 0.06, tone: 0.2, color_blend: 0.15 }, islands: { eyes: { cell: 0.006, adaptive: false, decimate: { ratio: 0.35 } } }, parts: parts };
const texture = { size: 256, seed: 21, layers: [
  { kind: "noise", parts: ["head", "snout", "ear*", "neck", "tail", "forearm", "hand", "thigh", "shin"], scale: 0.072, octaves: 2, amount: 0.1 },
  { kind: "noise", parts: ["head", "snout", "ear*", "neck", "tail", "forearm", "hand"], scale: 0.0144, amount: 0.12 },
  { kind: "cells", parts: ["snout"], size: 0.0168, line: 0.2, colour: [0.55, 0.22, 0.3], vary: 0.2, edge: 0.45, strength: 0.3 },
  { kind: "gradient", parts: ["head"], by: "position", axis: [0, 1, 0], from: 0.936, to: 1.164, colour: [1, 0.8, 0.84], strength: 0.4 },
  { kind: "cells", parts: ["dress*"], size: 0.0132, line: 0.28, colour: [0, 0, 0], vary: 0.1, edge: 0.5, strength: 0.16 },
  { kind: "spots", parts: ["dress_chest", "dress_belly", "dress_skirt", "sleeve"], size: 0.09, radius: 0.3, density: 1, vary: 0, colour: [0.97, 0.93, 0.8], edge: 0.3, strength: 0.95, seed: 21 },
  { kind: "fill", parts: ["shoe", "shoe_sole"], roughness: 0.3, metal: 0.02 },
  { kind: "noise", parts: ["shoe"], scale: 0.036, amount: 0.15 }
] };
return {
  name: "oink_mum",
  max: 16,
  family: { faction: "animal", kind: "person", hp: 60 },
  nav: { agent: { name: "oink_mum", radius: 0.264, height: 1.2, step: 0.12, slope: 35, drop: 0.36 } },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, radius: 0.24, turn_rate: 3.5 },
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
      ["health", { hp: 60 }],
      ["flee", { speed: 2, distance: 9 }],
      ["greet", { meet: 6 }],
      ["curious", { approach: 0.3, cooldown: 20, near: 0.72 }],
      ["idle_life", {}],
      ["injured", { clip_flinch: "" }],
      ["wander", { speed: 1, near: 0.5, pause_min: 2, pause_max: 8 }]
    ],
    // THE WORKER: the tree of the blocks above, in the order they act.
    worker: function (api, ld) {
      var tree = { name: "oink_mum", select: [ld.node("flee"), ld.node("greet"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
