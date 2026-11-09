"use strict";
// oink_dad: the dad: a big round pig with a belly, a mustard striped shirt, brown corduroy trousers and black shoes. WRITTEN by system/cartoon_pigs.js (an ORIGINAL cartoon pig family, not any published character): edit its table and run the tool again rather than this file.
// A round pink pig of 1.4 m that walks on two legs: a big head, a flat snout, floppy ears, a curly tail, short arms, drawn from an sdf of its own parts (the pig and its clothes) on a skeleton of 15 bones (the left ones mirrored), the gait style `person_walk` of the pack.
// ITS TEXTURE is a recipe (maps.js, SYSTEM.md "Texture on an sdf creature"): soft skin with fine pores, the snout's grain, and cloth that is cloth (a weave, stripes, corduroy ribs), lacquered shoes. It names parts of the sdf (the dress, the shirt, the trousers ...).
// ITS MIND (the blocks of soma/world/blocks/): it follows the nearest `oink_mum` (`follow`: it walks up when it is more than 4 m behind and stops 2 m from it); it greets, flees what is hostile, is curious, idles and wanders as a person does.
// ONE JS FILE IS ONE CREATURE (creature_file.js): it is read as text, run with new Function("api", text) and RETURNS { name, max, family, nav, body, abilities, interaction, mind }. Metres, +x to its left, +y up, +z forward.
const bones = [
  { name: "hips", parent: null, head: [0, 0.42, 0], tail: [0, 0.532, 0] },
  { name: "spine", parent: "hips", head: [0, 0.532, 0], tail: [0, 0.7, 0.014] },
  { name: "chest", parent: "spine", head: [0, 0.7, 0.014], tail: [0, 0.91, 0.028] },
  { name: "neck", parent: "chest", head: [0, 0.91, 0.028], tail: [0, 0.966, 0.056] },
  { name: "head", parent: "neck", head: [0, 0.966, 0.056], tail: [0, 1.344, 0.14] },
  { name: "eye_l", parent: "head", head: [0.14, 1.176, 0.28], tail: [0.14, 1.176, 0.336], mirror: "x" },
  { name: "ear_l", parent: "head", head: [0.196, 1.302, 0.042], tail: [0.28, 1.4, 0.028], mirror: "x" },
  { name: "tail1", parent: "hips", head: [0, 0.462, -0.196], tail: [0, 0.504, -0.308] },
  { name: "tail2", parent: "tail1", head: [0, 0.504, -0.308], tail: [0.021, 0.602, -0.35] },
  { name: "upper_l", parent: "chest", head: [0.238, 0.868, 0], tail: [0.336, 0.658, 0.028], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.336, 0.658, 0.028], tail: [0.378, 0.462, 0.084], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.378, 0.462, 0.084], tail: [0.392, 0.378, 0.112], mirror: "x" },
  { name: "thigh_l", parent: "hips", head: [0.112, 0.42, 0], tail: [0.126, 0.224, 0.014], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.126, 0.224, 0.014], tail: [0.126, 0.07, 0], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.126, 0.07, 0], tail: [0.126, 0.028, 0.154], mirror: "x" },
];
const rig = { joints: [{ bone: "thigh_l", mirror: "x", kind: "ball", fwd: 75, back: 60, out: 40, in: 25, twist: [-25, 25] }, { bone: "shin_l", mirror: "x", kind: "hinge", axis: [1, 0, 0], range: [-14, 132] }, { bone: "foot_l", mirror: "x", kind: "ball", fwd: 45, back: 45, lat: 20, twist: 15 }, { bone: "upper_l", mirror: "x", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] }, { bone: "fore_l", mirror: "x", kind: "hinge", axis: [-1, 0, 0], range: [-19, 137] }, { bone: "spine", kind: "ball", fwd: 40, back: 25, lat: 25, twist: 30 }, { bone: "chest", kind: "ball", fwd: 30, back: 20, lat: 25, twist: 30 }, { bone: "neck", kind: "ball", fwd: 50, back: 50, lat: 40, twist: 60 }, { bone: "head", kind: "ball", fwd: 35, back: 45, lat: 35, twist: 50 }, { bone: "tail1", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 }, { bone: "tail2", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 }, { bone: "eye_l", mirror: "x", kind: "ball", fwd: 35, back: 35, lat: 35, twist: [-10, 10] }, { bone: "ear_l", mirror: "x", kind: "ball", fwd: 45, back: 55, lat: 35, twist: 25 }], chains: [{ name: "leg_l", mirror: "x", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0, 0, 1], pole_w: 1 }, { name: "arm_l", mirror: "x", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0.8, 0, -0.6], pole_w: 1 }, { name: "head", bones: ["spine", "chest", "neck", "head"] }, { name: "tail", bones: ["tail1", "tail2"] }] };
const legs = { legs: [{ chain: "leg_l", mirror: "x" }], gait: { from: "person_walk" } };
const roles = { hips: "hips", spine: ["spine", "chest"], chest: "chest", neck: ["neck"], head: "head", arms: [{ chain: "arm_l", rest: [0.364, -0.92, 0.086] }, { chain: "arm_r", rest: [0.364, -0.92, 0.086] }], eyes: ["eye_l", "eye_r"], ears: [["ear_l"], ["ear_r"]], tail: ["tail1", "tail2"] };
const physics = { mass: 90, shapes: [
    { id: "body", shape: "capsule", a: [0, 0.42, 0], b: [0, 0.84, 0], radius: 0.378, bone: "hips" },
    { id: "head", shape: "sphere", center: [0, 1.162, 0.098], radius: 0.322, bone: "head" },
    { id: "leg_l", shape: "capsule", a: [0.126, 0.392, 0], b: [0.126, 0.056, 0], radius: 0.084 },
    { id: "leg_r", shape: "capsule", a: [-0.126, 0.392, 0], b: [-0.126, 0.056, 0], radius: 0.084 },
  ] };
const parts = [
  { id: "head", shape: "ellipsoid", center: [0, 1.162, 0.098], radii: [0.329, 0.301, 0.315], bone: "head", blend: 0.042, color: [0.95, 0.66, 0.72, 1] },
  { id: "snout", shape: "ellipsoid", center: [0, 1.106, 0.399], radii: [0.175, 0.133, 0.105], bone: "head", blend: 0.0308, color: [0.9, 0.5, 0.6, 1] },
  { id: "nostril", shape: "ellipsoid", center: [0.056, 1.106, 0.4928], radii: [0.0308, 0.0448, 0.0196], bone: "head", mirror: "x", blend: 0.0056, color: [0.42, 0.14, 0.2, 1] },
  { id: "ear", shape: "ellipsoid", center: [0.21, 1.379, 0.042], radii: [0.105, 0.168, 0.042], bone: "ear_l", mirror: "x", blend: 0.0168, color: [0.95, 0.66, 0.72, 1] },
  { id: "ear_in", shape: "ellipsoid", center: [0.21, 1.365, 0.077], radii: [0.063, 0.105, 0.0168], bone: "ear_l", mirror: "x", blend: 0.0084, color: [0.88, 0.5, 0.6, 1] },
  { id: "eye_white", shape: "sphere", center: [0.14, 1.218, 0.28], radius: 0.0868, bone: "eye_l", mirror: "x", island: "eyes", color: [0.98, 0.98, 0.96, 1] },
  { id: "eye_pupil", shape: "sphere", center: [0.14, 1.218, 0.3542], radius: 0.0392, bone: "eye_l", mirror: "x", island: "eyes", color: [0.05, 0.04, 0.05, 1] },
  { id: "neck", shape: "capsule", a: [0, 0.91, 0.028], b: [0, 0.98, 0.056], radius: 0.161, bone: "neck", blend: 0.042, color: [0.95, 0.66, 0.72, 1] },
  { id: "tail", shape: "loft", bones: ["tail1", "tail2"], radii: [0.0364, 0.028, 0.0168], blend: 0.014, color: [0.95, 0.66, 0.72, 1] },
  { id: "shirt_chest", shape: "ellipsoid", center: [0, 0.84, 0.028], radii: [0.238, 0.154, 0.182], bone: "chest", blend: 0.056, color: [0.86, 0.66, 0.16, 1] },
  { id: "shirt_belly", shape: "ellipsoid", center: [0, 0.658, 0.0567], radii: [0.378, 0.238, 0.3213], bone: "spine", blend: 0.07, color: [0.86, 0.66, 0.16, 1] },
  { id: "trousers_seat", shape: "ellipsoid", center: [0, 0.476, -0.014], radii: [0.34965, 0.182, 0.31185], bone: "hips", blend: 0.056, color: [0.36, 0.22, 0.12, 1] },
  { id: "sleeve", shape: "loft", bones: ["upper_l"], radii: [0.0868, 0.0728], mirror: "x", blend: 0.028, color: [0.86, 0.66, 0.16, 1] },
  { id: "forearm", shape: "loft", bones: ["fore_l"], radii: [0.063, 0.056], mirror: "x", blend: 0.028, color: [0.95, 0.66, 0.72, 1] },
  { id: "hand", shape: "ellipsoid", center: [0.392, 0.399, 0.105], radii: [0.063, 0.07, 0.056], bone: "hand_l", mirror: "x", blend: 0.0168, color: [0.95, 0.66, 0.72, 1] },
  { id: "trousers_thigh", shape: "loft", bones: ["thigh_l"], radii: [0.105, 0.0868], mirror: "x", blend: 0.035, color: [0.36, 0.22, 0.12, 1] },
  { id: "trousers_shin", shape: "loft", bones: ["shin_l"], radii: [0.0812, 0.07], mirror: "x", blend: 0.028, color: [0.36, 0.22, 0.12, 1] },
  { id: "shoe", shape: "ellipsoid", center: [0.126, 0.049, 0.07], radii: [0.091, 0.056, 0.14], bone: "foot_l", mirror: "x", blend: 0.021, color: [0.08, 0.07, 0.07, 1] },
  { id: "shoe_sole", shape: "ellipsoid", center: [0.126, 0.0168, 0.077], radii: [0.0938, 0.0196, 0.1442], bone: "foot_l", mirror: "x", blend: 0.0084, color: [0.12, 0.1, 0.1, 1] },
];
const sdf = { cell: 0.0196, adaptive: { min_cell: 0.0098, max_cell: 0.0392 }, decimate: { ratio: 0.35 }, skin: { falloff: 1.2 }, shade: { ao: 0.5, ao_radius: 0.07, tone: 0.2, color_blend: 0.15 }, islands: { eyes: { cell: 0.007, adaptive: false, decimate: { ratio: 0.35 } } }, parts: parts };
const texture = { size: 256, seed: 22, layers: [
  { kind: "noise", parts: ["head", "snout", "ear*", "neck", "tail", "forearm", "hand"], scale: 0.084, octaves: 2, amount: 0.1 },
  { kind: "noise", parts: ["head", "snout", "ear*", "neck", "tail", "forearm", "hand"], scale: 0.0168, amount: 0.12 },
  { kind: "cells", parts: ["snout"], size: 0.0196, line: 0.2, colour: [0.55, 0.22, 0.3], vary: 0.2, edge: 0.45, strength: 0.3 },
  { kind: "gradient", parts: ["head"], by: "position", axis: [0, 1, 0], from: 1.092, to: 1.358, colour: [1, 0.8, 0.84], strength: 0.4 },
  { kind: "cells", parts: ["shirt*", "sleeve", "trousers*"], size: 0.0154, line: 0.28, colour: [0, 0, 0], vary: 0.1, edge: 0.5, strength: 0.16 },
  { kind: "stripes", parts: ["shirt*", "sleeve"], axis: [0, 1, 0], period: 0.098, width: 0.4, colour: [0.55, 0.38, 0.08], edge: 0.35, strength: 0.9, height: 0.0084 },
  { kind: "stripes", parts: ["trousers*"], axis: [1, 0, 0], period: 0.0308, width: 0.35, colour: [0, 0, 0], edge: 0.5, strength: 0.3, height: 0.0168 },
  { kind: "fill", parts: ["shoe", "shoe_sole"], roughness: 0.3, metal: 0.02 },
  { kind: "noise", parts: ["shoe"], scale: 0.042, amount: 0.15 }
] };
return {
  name: "oink_dad",
  max: 16,
  family: { faction: "animal", kind: "person", hp: 80 },
  nav: { agent: { name: "oink_dad", radius: 0.4158, height: 1.4, step: 0.14, slope: 35, drop: 0.42 } },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, radius: 0.378, turn_rate: 3.5 },
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
      ["health", { hp: 80 }],
      ["flee", { speed: 2, distance: 9 }],
      ["follow", { group: "oink_mum", look: 14, lose: 60, far: 4, near: 2, speed: 1, run_speed: 2, run_from: 8.8 }],
      ["greet", { meet: 6 }],
      ["curious", { approach: 0.3, cooldown: 20, near: 0.84 }],
      ["idle_life", {}],
      ["injured", { clip_flinch: "" }],
      ["wander", { speed: 1, near: 0.5, pause_min: 2, pause_max: 8 }]
    ],
    // THE WORKER: the tree of the blocks above, in the order they act.
    worker: function (api, ld) {
      var tree = { name: "oink_dad", select: [ld.node("flee"), ld.node("follow"), ld.node("greet"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
