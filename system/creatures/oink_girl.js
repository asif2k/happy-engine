"use strict";
// oink_girl: the girl: a small round pig in a yellow dress with orange dots and orange boots. WRITTEN by system/cartoon_pigs.js (an ORIGINAL cartoon pig family, not any published character): edit its table and run the tool again rather than this file.
// A round pink pig of 0.8 m that walks on two legs: a big head, a flat snout, floppy ears, a curly tail, short arms, drawn from an sdf of its own parts (the pig and its clothes) on a skeleton of 15 bones (the left ones mirrored), the gait style `person_walk_cheerful` of the pack.
// ITS TEXTURE is a recipe (maps.js, SYSTEM.md "Texture on an sdf creature"): soft skin with fine pores, the snout's grain, and cloth that is cloth (a weave, polka dots), lacquered shoes. It names parts of the sdf (the dress, the shirt, the trousers ...).
// ITS MIND (the blocks of soma/world/blocks/): it follows the nearest `oink_mum` (`follow`: it walks up when it is more than 2.5 m behind and stops 1.2 m from it); it greets, flees what is hostile, is curious, idles and wanders as a person does.
// ONE JS FILE IS ONE CREATURE (creature_file.js): it is read as text, run with new Function("api", text) and RETURNS { name, max, family, nav, body, abilities, interaction, mind }. Metres, +x to its left, +y up, +z forward.
const bones = [
  { name: "hips", parent: null, head: [0, 0.24, 0], tail: [0, 0.304, 0] },
  { name: "spine", parent: "hips", head: [0, 0.304, 0], tail: [0, 0.4, 0.008] },
  { name: "chest", parent: "spine", head: [0, 0.4, 0.008], tail: [0, 0.52, 0.016] },
  { name: "neck", parent: "chest", head: [0, 0.52, 0.016], tail: [0, 0.552, 0.032] },
  { name: "head", parent: "neck", head: [0, 0.552, 0.032], tail: [0, 0.768, 0.08] },
  { name: "eye_l", parent: "head", head: [0.08, 0.672, 0.16], tail: [0.08, 0.672, 0.192], mirror: "x" },
  { name: "ear_l", parent: "head", head: [0.112, 0.744, 0.024], tail: [0.16, 0.8, 0.016], mirror: "x" },
  { name: "tail1", parent: "hips", head: [0, 0.264, -0.112], tail: [0, 0.288, -0.176] },
  { name: "tail2", parent: "tail1", head: [0, 0.288, -0.176], tail: [0.012, 0.344, -0.2] },
  { name: "upper_l", parent: "chest", head: [0.136, 0.496, 0], tail: [0.192, 0.376, 0.016], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.192, 0.376, 0.016], tail: [0.216, 0.264, 0.048], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.216, 0.264, 0.048], tail: [0.224, 0.216, 0.064], mirror: "x" },
  { name: "thigh_l", parent: "hips", head: [0.064, 0.24, 0], tail: [0.072, 0.128, 0.008], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.072, 0.128, 0.008], tail: [0.072, 0.04, 0], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.072, 0.04, 0], tail: [0.072, 0.016, 0.088], mirror: "x" },
];
const rig = { joints: [{ bone: "thigh_l", mirror: "x", kind: "ball", fwd: 75, back: 60, out: 40, in: 25, twist: [-25, 25] }, { bone: "shin_l", mirror: "x", kind: "hinge", axis: [1, 0, 0], range: [-14, 132] }, { bone: "foot_l", mirror: "x", kind: "ball", fwd: 45, back: 45, lat: 20, twist: 15 }, { bone: "upper_l", mirror: "x", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] }, { bone: "fore_l", mirror: "x", kind: "hinge", axis: [-1, 0, 0], range: [-19, 137] }, { bone: "spine", kind: "ball", fwd: 40, back: 25, lat: 25, twist: 30 }, { bone: "chest", kind: "ball", fwd: 30, back: 20, lat: 25, twist: 30 }, { bone: "neck", kind: "ball", fwd: 50, back: 50, lat: 40, twist: 60 }, { bone: "head", kind: "ball", fwd: 35, back: 45, lat: 35, twist: 50 }, { bone: "tail1", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 }, { bone: "tail2", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 }, { bone: "eye_l", mirror: "x", kind: "ball", fwd: 35, back: 35, lat: 35, twist: [-10, 10] }, { bone: "ear_l", mirror: "x", kind: "ball", fwd: 45, back: 55, lat: 35, twist: 25 }], chains: [{ name: "leg_l", mirror: "x", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0, 0, 1], pole_w: 1 }, { name: "arm_l", mirror: "x", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0.8, 0, -0.6], pole_w: 1 }, { name: "head", bones: ["spine", "chest", "neck", "head"] }, { name: "tail", bones: ["tail1", "tail2"] }] };
const legs = { legs: [{ chain: "leg_l", mirror: "x" }], gait: { from: "person_walk_cheerful" } };
const roles = { hips: "hips", spine: ["spine", "chest"], chest: "chest", neck: ["neck"], head: "head", arms: [{ chain: "arm_l", rest: [0.364, -0.92, 0.086] }, { chain: "arm_r", rest: [0.364, -0.92, 0.086] }], eyes: ["eye_l", "eye_r"], ears: [["ear_l"], ["ear_r"]], tail: ["tail1", "tail2"] };
const physics = { mass: 20, shapes: [
    { id: "body", shape: "capsule", a: [0, 0.24, 0], b: [0, 0.48, 0], radius: 0.168, bone: "hips" },
    { id: "head", shape: "sphere", center: [0, 0.664, 0.056], radius: 0.184, bone: "head" },
    { id: "leg_l", shape: "capsule", a: [0.072, 0.224, 0], b: [0.072, 0.032, 0], radius: 0.048 },
    { id: "leg_r", shape: "capsule", a: [-0.072, 0.224, 0], b: [-0.072, 0.032, 0], radius: 0.048 },
  ] };
const parts = [
  { id: "head", shape: "ellipsoid", center: [0, 0.664, 0.056], radii: [0.188, 0.172, 0.18], bone: "head", blend: 0.024, color: [0.95, 0.66, 0.72, 1] },
  { id: "snout", shape: "ellipsoid", center: [0, 0.632, 0.228], radii: [0.1, 0.076, 0.06], bone: "head", blend: 0.0176, color: [0.9, 0.5, 0.6, 1] },
  { id: "nostril", shape: "ellipsoid", center: [0.032, 0.632, 0.2816], radii: [0.0176, 0.0256, 0.0112], bone: "head", mirror: "x", blend: 0.0032, color: [0.42, 0.14, 0.2, 1] },
  { id: "ear", shape: "ellipsoid", center: [0.12, 0.788, 0.024], radii: [0.069, 0.1104, 0.024], bone: "ear_l", mirror: "x", blend: 0.0096, color: [0.95, 0.66, 0.72, 1] },
  { id: "ear_in", shape: "ellipsoid", center: [0.12, 0.78, 0.044], radii: [0.0414, 0.069, 0.0096], bone: "ear_l", mirror: "x", blend: 0.0048, color: [0.88, 0.5, 0.6, 1] },
  { id: "eye_white", shape: "sphere", center: [0.08, 0.696, 0.16], radius: 0.0496, bone: "eye_l", mirror: "x", island: "eyes", color: [0.98, 0.98, 0.96, 1] },
  { id: "eye_pupil", shape: "sphere", center: [0.08, 0.696, 0.2024], radius: 0.0224, bone: "eye_l", mirror: "x", island: "eyes", color: [0.05, 0.04, 0.05, 1] },
  { id: "neck", shape: "capsule", a: [0, 0.52, 0.016], b: [0, 0.56, 0.032], radius: 0.092, bone: "neck", blend: 0.024, color: [0.95, 0.66, 0.72, 1] },
  { id: "tail", shape: "loft", bones: ["tail1", "tail2"], radii: [0.0208, 0.016, 0.0096], blend: 0.008, color: [0.95, 0.66, 0.72, 1] },
  { id: "dress_chest", shape: "ellipsoid", center: [0, 0.48, 0.016], radii: [0.136, 0.088, 0.104], bone: "chest", blend: 0.032, color: [0.96, 0.8, 0.2, 1] },
  { id: "dress_belly", shape: "ellipsoid", center: [0, 0.376, 0.0252], radii: [0.168, 0.136, 0.1428], bone: "spine", blend: 0.04, color: [0.96, 0.8, 0.2, 1] },
  { id: "dress_skirt", shape: "ellipsoid", center: [0, 0.272, 0], radii: [0.1974, 0.096, 0.168], bone: "hips", blend: 0.032, color: [0.96, 0.8, 0.2, 1] },
  { id: "dress_hem", shape: "ellipsoid", center: [0, 0.204, 0], radii: [0.2016, 0.02, 0.1722], bone: "hips", blend: 0.008, color: [0.768, 0.6400000000000001, 0.16000000000000003, 1] },
  { id: "sleeve", shape: "loft", bones: ["upper_l"], radii: [0.0496, 0.0416], mirror: "x", blend: 0.016, color: [0.96, 0.8, 0.2, 1] },
  { id: "forearm", shape: "loft", bones: ["fore_l"], radii: [0.036, 0.032], mirror: "x", blend: 0.016, color: [0.95, 0.66, 0.72, 1] },
  { id: "hand", shape: "ellipsoid", center: [0.224, 0.228, 0.06], radii: [0.036, 0.04, 0.032], bone: "hand_l", mirror: "x", blend: 0.0096, color: [0.95, 0.66, 0.72, 1] },
  { id: "thigh", shape: "loft", bones: ["thigh_l"], radii: [0.06, 0.0496], mirror: "x", blend: 0.02, color: [0.95, 0.66, 0.72, 1] },
  { id: "shin", shape: "loft", bones: ["shin_l"], radii: [0.0464, 0.04], mirror: "x", blend: 0.016, color: [0.95, 0.66, 0.72, 1] },
  { id: "shoe", shape: "ellipsoid", center: [0.072, 0.028, 0.04], radii: [0.052, 0.032, 0.08], bone: "foot_l", mirror: "x", blend: 0.012, color: [0.9, 0.42, 0.1, 1] },
  { id: "shoe_sole", shape: "ellipsoid", center: [0.072, 0.0096, 0.044], radii: [0.0536, 0.0112, 0.0824], bone: "foot_l", mirror: "x", blend: 0.0048, color: [0.12, 0.1, 0.1, 1] },
];
const sdf = { cell: 0.0112, adaptive: { min_cell: 0.0056, max_cell: 0.0224 }, decimate: { ratio: 0.35 }, skin: { falloff: 1.2 }, shade: { ao: 0.5, ao_radius: 0.04, tone: 0.2, color_blend: 0.15 }, islands: { eyes: { cell: 0.004, adaptive: false, decimate: { ratio: 0.35 } } }, parts: parts };
const texture = { size: 256, seed: 25, layers: [
  { kind: "noise", parts: ["head", "snout", "ear*", "neck", "tail", "forearm", "hand", "thigh", "shin"], scale: 0.048, octaves: 2, amount: 0.1 },
  { kind: "noise", parts: ["head", "snout", "ear*", "neck", "tail", "forearm", "hand"], scale: 0.0096, amount: 0.12 },
  { kind: "cells", parts: ["snout"], size: 0.0112, line: 0.2, colour: [0.55, 0.22, 0.3], vary: 0.2, edge: 0.45, strength: 0.3 },
  { kind: "gradient", parts: ["head"], by: "position", axis: [0, 1, 0], from: 0.624, to: 0.776, colour: [1, 0.8, 0.84], strength: 0.4 },
  { kind: "cells", parts: ["dress*"], size: 0.0088, line: 0.28, colour: [0, 0, 0], vary: 0.1, edge: 0.5, strength: 0.16 },
  { kind: "spots", parts: ["dress_chest", "dress_belly", "dress_skirt", "sleeve"], size: 0.06, radius: 0.3, density: 1, vary: 0, colour: [0.95, 0.5, 0.12], edge: 0.3, strength: 0.95, seed: 25 },
  { kind: "fill", parts: ["shoe", "shoe_sole"], roughness: 0.3, metal: 0.02 },
  { kind: "noise", parts: ["shoe"], scale: 0.024, amount: 0.15 }
] };
return {
  name: "oink_girl",
  max: 16,
  family: { faction: "animal", kind: "person", hp: 30 },
  nav: { agent: { name: "oink_girl", radius: 0.1848, height: 0.8, step: 0.08, slope: 35, drop: 0.24 } },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, radius: 0.168, turn_rate: 3.5 },
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
      ["health", { hp: 30 }],
      ["flee", { speed: 2, distance: 9 }],
      ["follow", { group: "oink_mum", look: 14, lose: 60, far: 2.5, near: 1.2, speed: 1, run_speed: 2, run_from: 5.5 }],
      ["greet", { meet: 6 }],
      ["curious", { approach: 0.3, cooldown: 20, near: 0.48 }],
      ["idle_life", {}],
      ["injured", { clip_flinch: "" }],
      ["wander", { speed: 1, near: 0.5, pause_min: 2, pause_max: 8 }]
    ],
    // THE WORKER: the tree of the blocks above, in the order they act.
    worker: function (api, ld) {
      var tree = { name: "oink_girl", select: [ld.node("flee"), ld.node("follow"), ld.node("greet"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
