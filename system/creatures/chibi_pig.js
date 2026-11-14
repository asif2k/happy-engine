"use strict";
// chibi_pig: drawn from the picture of "Lowpoly Pig" (OpenGameArt): a pink chibi pig on two legs, 0.8 m tall, with a head wider than its body, a big flat oval snout with two dark nostrils, small angry eyes under slanted brows,
// flat pointed ears out at the sides, round blushing cheeks, a pot belly, stubby arms with mitten hands, short legs with round feet and a little curl of a tail. Skeleton, rig, parts and texture are written for it (nothing is copied from another creature file).
// ONE JS FILE IS ONE CREATURE (creature_file.js): it is read as text, run with new Function("api", text) and RETURNS { name, max, family, nav, body, abilities, interaction, mind }. Metres, +x to its left, +y up, +z forward.
const bones = [
  { name: "hips", parent: null, head: [0, 0.27, 0], tail: [0, 0.32, 0] },
  { name: "spine", parent: "hips", head: [0, 0.32, 0], tail: [0, 0.4, 0.01] },
  { name: "chest", parent: "spine", head: [0, 0.4, 0.01], tail: [0, 0.48, 0.02] },
  { name: "neck", parent: "chest", head: [0, 0.48, 0.02], tail: [0, 0.52, 0.03] },
  { name: "head", parent: "neck", head: [0, 0.52, 0.03], tail: [0, 0.78, 0.05] },
  { name: "eye_l", parent: "head", head: [0.095, 0.62, 0.205], tail: [0.095, 0.62, 0.235], mirror: "x" },
  { name: "ear_l", parent: "head", head: [0.2, 0.72, 0.0], tail: [0.3, 0.8, -0.02], mirror: "x" },
  { name: "tail1", parent: "hips", head: [0, 0.3, -0.14], tail: [0, 0.33, -0.19] },
  { name: "tail2", parent: "tail1", head: [0, 0.33, -0.19], tail: [0.012, 0.38, -0.2] },
  { name: "upper_l", parent: "chest", head: [0.17, 0.44, 0], tail: [0.23, 0.34, 0.02], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.23, 0.34, 0.02], tail: [0.26, 0.25, 0.05], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.26, 0.25, 0.05], tail: [0.27, 0.2, 0.07], mirror: "x" },
  { name: "thigh_l", parent: "hips", head: [0.085, 0.27, 0], tail: [0.09, 0.15, 0.01], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.09, 0.15, 0.01], tail: [0.09, 0.05, 0], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.09, 0.05, 0], tail: [0.09, 0.02, 0.1], mirror: "x" },
];
const rig = {
  joints: [
    { bone: "thigh_l", mirror: "x", kind: "ball", fwd: 75, back: 55, out: 40, in: 20, twist: [-25, 25] },
    { bone: "shin_l", mirror: "x", kind: "hinge", axis: [1, 0, 0], range: [-14, 130] },
    { bone: "foot_l", mirror: "x", kind: "ball", fwd: 45, back: 45, lat: 20, twist: 15 },
    { bone: "upper_l", mirror: "x", kind: "ball", fwd: 120, back: 55, out: 95, in: 35, twist: [-70, 70] },
    { bone: "fore_l", mirror: "x", kind: "hinge", axis: [-1, 0, 0], range: [-15, 130] },
    { bone: "spine", kind: "ball", fwd: 35, back: 20, lat: 20, twist: 25 },
    { bone: "chest", kind: "ball", fwd: 25, back: 15, lat: 20, twist: 25 },
    { bone: "neck", kind: "ball", fwd: 40, back: 40, lat: 35, twist: 50 },
    { bone: "head", kind: "ball", fwd: 35, back: 40, lat: 35, twist: 50 },
    { bone: "tail1", kind: "ball", fwd: 45, back: 45, lat: 45, twist: 20 },
    { bone: "tail2", kind: "ball", fwd: 45, back: 45, lat: 45, twist: 20 },
    { bone: "eye_l", mirror: "x", kind: "ball", fwd: 30, back: 30, lat: 30, twist: [-10, 10] },
    { bone: "ear_l", mirror: "x", kind: "ball", fwd: 40, back: 50, lat: 35, twist: 25 },
  ],
  chains: [
    { name: "leg_l", mirror: "x", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0, 0, 1], pole_w: 1 },
    { name: "arm_l", mirror: "x", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0.8, 0, -0.6], pole_w: 1 },
    { name: "head", bones: ["spine", "chest", "neck", "head"] },
    { name: "tail", bones: ["tail1", "tail2"] },
  ],
};
const legs = { legs: [{ chain: "leg_l", mirror: "x" }], gait: { from: "person_walk_cheerful" } };
const roles = { hips: "hips", spine: ["spine", "chest"], chest: "chest", neck: ["neck"], head: "head", arms: [{ chain: "arm_l", rest: [0.364, -0.92, 0.086] }, { chain: "arm_r", rest: [0.364, -0.92, 0.086] }], eyes: ["eye_l", "eye_r"], ears: [["ear_l"], ["ear_r"]], tail: ["tail1", "tail2"] };
const physics = { mass: 22, shapes: [
    { id: "body", shape: "capsule", a: [0, 0.27, 0], b: [0, 0.45, 0], radius: 0.17, bone: "hips" },
    { id: "head", shape: "sphere", center: [0, 0.64, 0.05], radius: 0.22, bone: "head" },
    { id: "leg_l", shape: "capsule", a: [0.09, 0.26, 0], b: [0.09, 0.04, 0], radius: 0.05 },
    { id: "leg_r", shape: "capsule", a: [-0.09, 0.26, 0], b: [-0.09, 0.04, 0], radius: 0.05 },
  ] };

const PINK = [1, 0.72, 0.78, 1], PINK_D = [0.93, 0.5, 0.6, 1], PINK_L = [1, 0.78, 0.82, 1], DARK = [0.2, 0.08, 0.1, 1];
const parts = [
  // body: a small round trunk with a pot belly and a rump
  { id: "torso", shape: "ellipsoid", center: [0, 0.38, 0], radii: [0.17, 0.15, 0.14], bone: "spine", blend: 0.06, color: PINK },
  { id: "belly", shape: "ellipsoid", center: [0, 0.33, 0.07], radii: [0.15, 0.14, 0.11], bone: "hips", blend: 0.07, color: PINK_L },
  { id: "rump", shape: "ellipsoid", center: [0, 0.29, -0.06], radii: [0.15, 0.1, 0.11], bone: "hips", blend: 0.06, color: PINK },
  { id: "neck", shape: "capsule", a: [0, 0.48, 0.02], b: [0, 0.53, 0.03], radius: 0.09, bone: "neck", blend: 0.05, color: PINK },
  // head: wider than the body, a flat face
  { id: "head", shape: "ellipsoid", center: [0, 0.63, 0.04], radii: [0.235, 0.18, 0.19], bone: "head", blend: 0.06, color: PINK },
  { id: "cheek_l", shape: "ellipsoid", center: [0.15, 0.57, 0.14], radii: [0.075, 0.055, 0.04], bone: "head", mirror: "x", blend: 0.03, color: PINK_D },
  { id: "snout", shape: "ellipsoid", center: [0, 0.56, 0.2], radii: [0.105, 0.075, 0.06], bone: "head", blend: 0.025, color: PINK_L },
  { id: "snout_rim", shape: "ellipsoid", center: [0, 0.56, 0.245], radii: [0.09, 0.062, 0.02], bone: "head", blend: 0.01, color: PINK_D },
  { id: "nostril_l", shape: "ellipsoid", center: [0.036, 0.565, 0.262], radii: [0.016, 0.026, 0.012], bone: "head", mirror: "x", blend: 0.004, color: DARK },
  { id: "brow_l", shape: "capsule", a: [0.03, 0.658, 0.228], b: [0.15, 0.705, 0.178], radius: 0.014, bone: "head", mirror: "x", blend: 0.012, color: PINK_D },
  { id: "ear", shape: "ellipsoid", center: [0.225, 0.755, -0.005], radii: [0.09, 0.075, 0.022], bone: "ear_l", mirror: "x", blend: 0.012, color: PINK },
  { id: "ear_in", shape: "ellipsoid", center: [0.225, 0.755, 0.014], radii: [0.055, 0.045, 0.01], bone: "ear_l", mirror: "x", blend: 0.006, color: PINK_D },
  { id: "eye_white", shape: "sphere", center: [0.095, 0.62, 0.205], radius: 0.032, bone: "eye_l", mirror: "x", island: "eyes", color: [0.98, 0.97, 0.95, 1] },
  { id: "eye_pupil", shape: "sphere", center: [0.095, 0.62, 0.234], radius: 0.016, bone: "eye_l", mirror: "x", island: "eyes", color: DARK },
  // limbs: stubby, mitten hands, round feet
  { id: "arm_up", shape: "loft", bones: ["upper_l"], radii: [0.055, 0.047], mirror: "x", blend: 0.03, color: PINK },
  { id: "arm_low", shape: "loft", bones: ["fore_l"], radii: [0.047, 0.04], mirror: "x", blend: 0.03, color: PINK },
  { id: "hand", shape: "ellipsoid", center: [0.27, 0.2, 0.07], radii: [0.05, 0.055, 0.045], bone: "hand_l", mirror: "x", blend: 0.02, color: PINK_D },
  { id: "thigh", shape: "loft", bones: ["thigh_l"], radii: [0.075, 0.06], mirror: "x", blend: 0.035, color: PINK },
  { id: "shin", shape: "loft", bones: ["shin_l"], radii: [0.06, 0.05], mirror: "x", blend: 0.03, color: PINK },
  { id: "foot", shape: "ellipsoid", center: [0.09, 0.035, 0.04], radii: [0.062, 0.04, 0.095], bone: "foot_l", mirror: "x", blend: 0.025, color: PINK_D },
  { id: "tail", shape: "loft", bones: ["tail1", "tail2"], radii: [0.025, 0.02, 0.012], blend: 0.015, color: PINK_D },
];
const sdf = { cell: 0.007, adaptive: { min_cell: 0.0035, max_cell: 0.014 }, decimate: { ratio: 0.35 }, skin: { falloff: 1.2 }, shade: { ao: 0.5, ao_radius: 0.03, tone: 0.2, color_blend: 0.15 }, islands: { eyes: { cell: 0.0025, adaptive: false, decimate: { ratio: 0.35 } } }, parts: parts };

// TEXTURE (maps.js): soft skin with a faint mottle, a pale belly, blushing cheeks, the snout's fine pores, and the eyes painted: an amber iris ring round the pupil (a gradient along z on the white of the eye)
const texture = { size: 512, seed: 7, layers: [
  { kind: "fill", roughness: 0.5, metal: 0 },
  { kind: "noise", scale: 0.03, amount: 0.07 },
  { kind: "gradient", parts: ["head", "torso", "rump"], by: "normal", axis: [0, 1, 0], from: 0.2, to: 1, colour: [1, 0.82, 0.86], strength: 0.3 },
  { kind: "gradient", parts: ["belly"], by: "normal", axis: [0, 0, 1], from: 0.2, to: 1, colour: [1, 0.9, 0.9], strength: 0.45 },
  { kind: "spots", parts: ["cheek*"], size: 0.05, radius: 0.5, density: 1, vary: 0.1, colour: [1, 0.35, 0.45], edge: 0.9, strength: 0.7 },
  { kind: "cells", parts: ["snout", "snout_rim"], size: 0.005, line: 0.25, colour: [0.55, 0.22, 0.3], vary: 0.25, edge: 0.45, strength: 0.35 },
  { kind: "gradient", parts: ["eye_white"], by: "position", axis: [0, 0, 1], from: 0.222, to: 0.24, colour: [0.95, 0.6, 0.1], strength: 1 },
  { kind: "fill", parts: ["eye_white", "eye_pupil"], roughness: 0.15, metal: 0 },
  { kind: "stripes", parts: ["ear_in"], axis: [0, 1, 0], period: 0.012, width: 0.3, colour: [0.8, 0.35, 0.45], strength: 0.5 }
] };

return {
  name: "chibi_pig",
  max: 16,
  family: { faction: "animal", kind: "person", hp: 30 },
  nav: { agent: { name: "chibi_pig", radius: 0.2, height: 0.8, step: 0.08, slope: 35, drop: 0.25 } },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, radius: 0.2, turn_rate: 3.5 },
    roles: roles,
    traits: { gait: 1.3, breath: 1.5, idle: 1.2 },
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
      "curious",
      "idle_life",
      "injured",
      ["wander", { speed: 0.8 }]
    ],
    worker: function (api, ld) {
      var tree = { name: "chibi_pig", select: [ld.node("flee"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
