"use strict";
// oink_grandad: the grandad: a round pig in a flat cap, a pale blue striped shirt and grey-green trousers. WRITTEN by system/cartoon_pigs.js (an ORIGINAL cartoon pig family, not any published character): edit its table and run the tool again rather than this file.
// A round pink pig of 1.25 m that walks on two legs: a big head, a flat snout, floppy ears, a curly tail, short arms, drawn from an sdf of its own parts (the pig and its clothes) on a skeleton of 15 bones (the left ones mirrored), the gait style `person_walk_cautious` of the pack.
// ITS TEXTURE is a recipe (maps.js, SYSTEM.md "Texture on an sdf creature"): soft skin with fine pores, the snout's grain, and cloth that is cloth (a weave, stripes, corduroy ribs), lacquered shoes. It names parts of the sdf (the dress, the shirt, the trousers ...).
// ITS MIND (the blocks of soma/world/blocks/): it follows the nearest `oink_dad` (`follow`: it walks up when it is more than 7 m behind and stops 4 m from it); it greets, flees what is hostile, is curious, idles and wanders as a person does.
// ONE JS FILE IS ONE CREATURE (creature_file.js): it is read as text, run with new Function("api", text) and RETURNS { name, max, family, nav, body, abilities, interaction, mind }. Metres, +x to its left, +y up, +z forward.
const bones = [
  { name: "hips", parent: null, head: [0, 0.375, 0], tail: [0, 0.475, 0] },
  { name: "spine", parent: "hips", head: [0, 0.475, 0], tail: [0, 0.625, 0.0125] },
  { name: "chest", parent: "spine", head: [0, 0.625, 0.0125], tail: [0, 0.8125, 0.025] },
  { name: "neck", parent: "chest", head: [0, 0.8125, 0.025], tail: [0, 0.8625, 0.05] },
  { name: "head", parent: "neck", head: [0, 0.8625, 0.05], tail: [0, 1.2, 0.125] },
  { name: "eye_l", parent: "head", head: [0.125, 1.05, 0.25], tail: [0.125, 1.05, 0.3], mirror: "x" },
  { name: "ear_l", parent: "head", head: [0.175, 1.1625, 0.0375], tail: [0.25, 1.25, 0.025], mirror: "x" },
  { name: "tail1", parent: "hips", head: [0, 0.4125, -0.175], tail: [0, 0.45, -0.275] },
  { name: "tail2", parent: "tail1", head: [0, 0.45, -0.275], tail: [0.01875, 0.5375, -0.3125] },
  { name: "upper_l", parent: "chest", head: [0.2125, 0.775, 0], tail: [0.3, 0.5875, 0.025], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.3, 0.5875, 0.025], tail: [0.3375, 0.4125, 0.075], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.3375, 0.4125, 0.075], tail: [0.35, 0.3375, 0.1], mirror: "x" },
  { name: "thigh_l", parent: "hips", head: [0.1, 0.375, 0], tail: [0.1125, 0.2, 0.0125], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.1125, 0.2, 0.0125], tail: [0.1125, 0.0625, 0], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.1125, 0.0625, 0], tail: [0.1125, 0.025, 0.1375], mirror: "x" },
];
const rig = { joints: [{ bone: "thigh_l", mirror: "x", kind: "ball", fwd: 75, back: 60, out: 40, in: 25, twist: [-25, 25] }, { bone: "shin_l", mirror: "x", kind: "hinge", axis: [1, 0, 0], range: [-14, 132] }, { bone: "foot_l", mirror: "x", kind: "ball", fwd: 45, back: 45, lat: 20, twist: 15 }, { bone: "upper_l", mirror: "x", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] }, { bone: "fore_l", mirror: "x", kind: "hinge", axis: [-1, 0, 0], range: [-19, 137] }, { bone: "spine", kind: "ball", fwd: 40, back: 25, lat: 25, twist: 30 }, { bone: "chest", kind: "ball", fwd: 30, back: 20, lat: 25, twist: 30 }, { bone: "neck", kind: "ball", fwd: 50, back: 50, lat: 40, twist: 60 }, { bone: "head", kind: "ball", fwd: 35, back: 45, lat: 35, twist: 50 }, { bone: "tail1", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 }, { bone: "tail2", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 }, { bone: "eye_l", mirror: "x", kind: "ball", fwd: 35, back: 35, lat: 35, twist: [-10, 10] }, { bone: "ear_l", mirror: "x", kind: "ball", fwd: 45, back: 55, lat: 35, twist: 25 }], chains: [{ name: "leg_l", mirror: "x", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0, 0, 1], pole_w: 1 }, { name: "arm_l", mirror: "x", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0.8, 0, -0.6], pole_w: 1 }, { name: "head", bones: ["spine", "chest", "neck", "head"] }, { name: "tail", bones: ["tail1", "tail2"] }] };
const legs = { legs: [{ chain: "leg_l", mirror: "x" }], gait: { from: "person_walk_cautious" } };
const roles = { hips: "hips", spine: ["spine", "chest"], chest: "chest", neck: ["neck"], head: "head", arms: [{ chain: "arm_l", rest: [0.364, -0.92, 0.086] }, { chain: "arm_r", rest: [0.364, -0.92, 0.086] }], eyes: ["eye_l", "eye_r"], ears: [["ear_l"], ["ear_r"]], tail: ["tail1", "tail2"] };
const physics = { mass: 70, shapes: [
    { id: "body", shape: "capsule", a: [0, 0.375, 0], b: [0, 0.75, 0], radius: 0.3125, bone: "hips" },
    { id: "head", shape: "sphere", center: [0, 1.0375, 0.0875], radius: 0.2875, bone: "head" },
    { id: "leg_l", shape: "capsule", a: [0.1125, 0.35, 0], b: [0.1125, 0.05, 0], radius: 0.075 },
    { id: "leg_r", shape: "capsule", a: [-0.1125, 0.35, 0], b: [-0.1125, 0.05, 0], radius: 0.075 },
  ] };
const parts = [
  { id: "head", shape: "ellipsoid", center: [0, 1.0375, 0.0875], radii: [0.29375, 0.26875, 0.28125], bone: "head", blend: 0.0375, color: [0.95, 0.66, 0.72, 1] },
  { id: "snout", shape: "ellipsoid", center: [0, 0.9875, 0.35625], radii: [0.15625, 0.11875, 0.09375], bone: "head", blend: 0.0275, color: [0.9, 0.5, 0.6, 1] },
  { id: "nostril", shape: "ellipsoid", center: [0.05, 0.9875, 0.44], radii: [0.0275, 0.04, 0.0175], bone: "head", mirror: "x", blend: 0.005, color: [0.42, 0.14, 0.2, 1] },
  { id: "ear", shape: "ellipsoid", center: [0.1875, 1.23125, 0.0375], radii: [0.09375, 0.15, 0.0375], bone: "ear_l", mirror: "x", blend: 0.015, color: [0.95, 0.66, 0.72, 1] },
  { id: "ear_in", shape: "ellipsoid", center: [0.1875, 1.21875, 0.06875], radii: [0.05625, 0.09375, 0.015], bone: "ear_l", mirror: "x", blend: 0.0075, color: [0.88, 0.5, 0.6, 1] },
  { id: "eye_white", shape: "sphere", center: [0.125, 1.0875, 0.25], radius: 0.0775, bone: "eye_l", mirror: "x", island: "eyes", color: [0.98, 0.98, 0.96, 1] },
  { id: "eye_pupil", shape: "sphere", center: [0.125, 1.0875, 0.31625], radius: 0.035, bone: "eye_l", mirror: "x", island: "eyes", color: [0.05, 0.04, 0.05, 1] },
  { id: "neck", shape: "capsule", a: [0, 0.8125, 0.025], b: [0, 0.875, 0.05], radius: 0.14375, bone: "neck", blend: 0.0375, color: [0.95, 0.66, 0.72, 1] },
  { id: "tail", shape: "loft", bones: ["tail1", "tail2"], radii: [0.0325, 0.025, 0.015], blend: 0.0125, color: [0.95, 0.66, 0.72, 1] },
  { id: "cap", shape: "ellipsoid", center: [0, 1.21875, 0.06875], radii: [0.25625, 0.09375, 0.25], bone: "head", blend: 0.025, color: [0.25, 0.32, 0.42, 1] },
  { id: "cap_brim", shape: "ellipsoid", center: [0, 1.18125, 0.25], radii: [0.175, 0.0225, 0.125], bone: "head", blend: 0.015, color: [0.25, 0.32, 0.42, 1] },
  { id: "shirt_chest", shape: "ellipsoid", center: [0, 0.75, 0.025], radii: [0.2125, 0.1375, 0.1625], bone: "chest", blend: 0.05, color: [0.6, 0.7, 0.8, 1] },
  { id: "shirt_belly", shape: "ellipsoid", center: [0, 0.5875, 0.04688], radii: [0.3125, 0.2125, 0.26563], bone: "spine", blend: 0.0625, color: [0.6, 0.7, 0.8, 1] },
  { id: "trousers_seat", shape: "ellipsoid", center: [0, 0.425, -0.0125], radii: [0.28906, 0.1625, 0.25781], bone: "hips", blend: 0.05, color: [0.36, 0.42, 0.33, 1] },
  { id: "sleeve", shape: "loft", bones: ["upper_l"], radii: [0.0775, 0.065], mirror: "x", blend: 0.025, color: [0.6, 0.7, 0.8, 1] },
  { id: "forearm", shape: "loft", bones: ["fore_l"], radii: [0.05625, 0.05], mirror: "x", blend: 0.025, color: [0.95, 0.66, 0.72, 1] },
  { id: "hand", shape: "ellipsoid", center: [0.35, 0.35625, 0.09375], radii: [0.05625, 0.0625, 0.05], bone: "hand_l", mirror: "x", blend: 0.015, color: [0.95, 0.66, 0.72, 1] },
  { id: "trousers_thigh", shape: "loft", bones: ["thigh_l"], radii: [0.09375, 0.0775], mirror: "x", blend: 0.03125, color: [0.36, 0.42, 0.33, 1] },
  { id: "trousers_shin", shape: "loft", bones: ["shin_l"], radii: [0.0725, 0.0625], mirror: "x", blend: 0.025, color: [0.36, 0.42, 0.33, 1] },
  { id: "shoe", shape: "ellipsoid", center: [0.1125, 0.04375, 0.0625], radii: [0.08125, 0.05, 0.125], bone: "foot_l", mirror: "x", blend: 0.01875, color: [0.22, 0.14, 0.1, 1] },
  { id: "shoe_sole", shape: "ellipsoid", center: [0.1125, 0.015, 0.06875], radii: [0.08375, 0.0175, 0.12875], bone: "foot_l", mirror: "x", blend: 0.0075, color: [0.12, 0.1, 0.1, 1] },
];
const sdf = { cell: 0.0175, adaptive: { min_cell: 0.00875, max_cell: 0.035 }, decimate: { ratio: 0.35 }, skin: { falloff: 1.2 }, shade: { ao: 0.5, ao_radius: 0.0625, tone: 0.2, color_blend: 0.15 }, islands: { eyes: { cell: 0.00625, adaptive: false, decimate: { ratio: 0.35 } } }, parts: parts };
const texture = { size: 256, seed: 24, layers: [
  { kind: "noise", parts: ["head", "snout", "ear*", "neck", "tail", "forearm", "hand"], scale: 0.075, octaves: 2, amount: 0.1 },
  { kind: "noise", parts: ["head", "snout", "ear*", "neck", "tail", "forearm", "hand"], scale: 0.015, amount: 0.12 },
  { kind: "cells", parts: ["snout"], size: 0.0175, line: 0.2, colour: [0.55, 0.22, 0.3], vary: 0.2, edge: 0.45, strength: 0.3 },
  { kind: "gradient", parts: ["head"], by: "position", axis: [0, 1, 0], from: 0.975, to: 1.2125, colour: [1, 0.8, 0.84], strength: 0.4 },
  { kind: "cells", parts: ["shirt*", "sleeve", "trousers*"], size: 0.01375, line: 0.28, colour: [0, 0, 0], vary: 0.1, edge: 0.5, strength: 0.16 },
  { kind: "stripes", parts: ["shirt*", "sleeve"], axis: [0, 1, 0], period: 0.0875, width: 0.4, colour: [0.9, 0.93, 0.95], edge: 0.35, strength: 0.9, height: 0.0075 },
  { kind: "stripes", parts: ["trousers*"], axis: [1, 0, 0], period: 0.0275, width: 0.35, colour: [0, 0, 0], edge: 0.5, strength: 0.3, height: 0.015 },
  { kind: "cells", parts: ["cap*"], size: 0.015, line: 0.3, colour: [0, 0, 0], vary: 0.1, edge: 0.5, strength: 0.22 },
  { kind: "fill", parts: ["shoe", "shoe_sole"], roughness: 0.3, metal: 0.02 },
  { kind: "noise", parts: ["shoe"], scale: 0.0375, amount: 0.15 }
] };
return {
  name: "oink_grandad",
  max: 16,
  family: { faction: "animal", kind: "person", hp: 55 },
  nav: { agent: { name: "oink_grandad", radius: 0.34375, height: 1.25, step: 0.125, slope: 35, drop: 0.375 } },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, radius: 0.3125, turn_rate: 3.5 },
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
      ["health", { hp: 55 }],
      ["flee", { speed: 1.4, distance: 9 }],
      ["follow", { group: "oink_dad", look: 14, lose: 60, far: 7, near: 4, speed: 0.7, run_speed: 1.4, run_from: 15.4 }],
      ["greet", { meet: 6 }],
      ["curious", { approach: 0.3, cooldown: 20, near: 0.75 }],
      ["idle_life", {}],
      ["injured", { clip_flinch: "" }],
      ["wander", { speed: 0.7, near: 0.5, pause_min: 2, pause_max: 8 }]
    ],
    // THE WORKER: the tree of the blocks above, in the order they act.
    worker: function (api, ld) {
      var tree = { name: "oink_grandad", select: [ld.node("flee"), ld.node("follow"), ld.node("greet"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
