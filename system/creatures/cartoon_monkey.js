"use strict";
// cartoon_monkey: drawn from the picture of "Monkey 3D model. Rigged" (OpenGameArt): a brown cartoon monkey standing on two legs, 1.05 m tall, with a round head, big round ears with pink insides, big eyes with a white and a painted iris,
// a tan face mask and muzzle, a tan belly, long thin arms hanging nearly to the knees with long fingers, long feet with toes and a long tail that curls up at its end. Skeleton, rig, parts and texture are written for it.
// ONE JS FILE IS ONE CREATURE (creature_file.js): it is read as text, run with new Function("api", text) and RETURNS { name, max, family, nav, body, abilities, interaction, mind }. Metres, +x to its left, +y up, +z forward.
const bones = [
  { name: "hips", parent: null, head: [0, 0.46, 0], tail: [0, 0.52, 0] },
  { name: "spine", parent: "hips", head: [0, 0.52, 0], tail: [0, 0.64, 0.02] },
  { name: "chest", parent: "spine", head: [0, 0.64, 0.02], tail: [0, 0.78, 0.03] },
  { name: "neck", parent: "chest", head: [0, 0.78, 0.03], tail: [0, 0.84, 0.05] },
  { name: "head", parent: "neck", head: [0, 0.84, 0.05], tail: [0, 1.06, 0.07] },
  { name: "jaw", parent: "head", head: [0, 0.9, 0.1], tail: [0, 0.88, 0.2] },
  { name: "eye_l", parent: "head", head: [0.058, 0.97, 0.15], tail: [0.058, 0.97, 0.18], mirror: "x" },
  { name: "ear_l", parent: "head", head: [0.115, 0.97, 0.04], tail: [0.19, 0.99, 0.03], mirror: "x" },
  { name: "tail1", parent: "hips", head: [0, 0.5, -0.1], tail: [0, 0.44, -0.3] },
  { name: "tail2", parent: "tail1", head: [0, 0.44, -0.3], tail: [0, 0.3, -0.46] },
  { name: "tail3", parent: "tail2", head: [0, 0.3, -0.46], tail: [0, 0.2, -0.4] },
  { name: "tail4", parent: "tail3", head: [0, 0.2, -0.4], tail: [0, 0.3, -0.32] },
  { name: "upper_l", parent: "chest", head: [0.15, 0.74, 0], tail: [0.2, 0.5, 0.02], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.2, 0.5, 0.02], tail: [0.23, 0.27, 0.05], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.23, 0.27, 0.05], tail: [0.24, 0.17, 0.08], mirror: "x" },
  { name: "thigh_l", parent: "hips", head: [0.08, 0.46, 0], tail: [0.09, 0.25, 0.02], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.09, 0.25, 0.02], tail: [0.09, 0.06, 0], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.09, 0.06, 0], tail: [0.09, 0.025, 0.17], mirror: "x" },
];
const rig = {
  joints: [
    { bone: "thigh_l", mirror: "x", kind: "ball", fwd: 85, back: 55, out: 55, in: 25, twist: [-30, 30] },
    { bone: "shin_l", mirror: "x", kind: "hinge", axis: [1, 0, 0], range: [-10, 140] },
    { bone: "foot_l", mirror: "x", kind: "ball", fwd: 50, back: 50, lat: 25, twist: 20 },
    { bone: "upper_l", mirror: "x", kind: "ball", fwd: 150, back: 70, out: 120, in: 40, twist: [-90, 90] },
    { bone: "fore_l", mirror: "x", kind: "hinge", axis: [-1, 0, 0], range: [-15, 140] },
    { bone: "spine", kind: "ball", fwd: 35, back: 25, lat: 25, twist: 30 },
    { bone: "chest", kind: "ball", fwd: 25, back: 20, lat: 25, twist: 30 },
    { bone: "neck", kind: "ball", fwd: 45, back: 45, lat: 40, twist: 60 },
    { bone: "head", kind: "ball", fwd: 35, back: 45, lat: 35, twist: 50 },
    { bone: "jaw", kind: "hinge", axis: [1, 0, 0], range: [-3, 40] },
    { bone: "tail1", kind: "ball", fwd: 40, back: 40, lat: 50, twist: 20 },
    { bone: "tail2", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 },
    { bone: "tail3", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 },
    { bone: "tail4", kind: "ball", fwd: 50, back: 50, lat: 50, twist: 20 },
    { bone: "eye_l", mirror: "x", kind: "ball", fwd: 30, back: 30, lat: 30, twist: [-10, 10] },
    { bone: "ear_l", mirror: "x", kind: "ball", fwd: 40, back: 50, lat: 35, twist: 25 },
  ],
  chains: [
    { name: "leg_l", mirror: "x", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0, 0, 1], pole_w: 1 },
    { name: "arm_l", mirror: "x", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0.8, 0, -0.6], pole_w: 1 },
    { name: "head", bones: ["spine", "chest", "neck", "head"] },
    { name: "tail", bones: ["tail1", "tail2", "tail3", "tail4"] },
  ],
};
const legs = { legs: [{ chain: "leg_l", mirror: "x" }], gait: { from: "person_walk_cheerful" } };
const roles = { hips: "hips", spine: ["spine", "chest"], chest: "chest", neck: ["neck"], head: "head", arms: [{ chain: "arm_l", rest: [0.2, -0.98, 0.05] }, { chain: "arm_r", rest: [0.2, -0.98, 0.05] }], eyes: ["eye_l", "eye_r"], ears: [["ear_l"], ["ear_r"]], jaw: { bone: "jaw", max: 40 }, tail: ["tail1", "tail2", "tail3", "tail4"] };
const physics = { mass: 16, shapes: [
    { id: "body", shape: "capsule", a: [0, 0.46, 0], b: [0, 0.72, 0], radius: 0.14, bone: "hips" },
    { id: "head", shape: "sphere", center: [0, 0.96, 0.06], radius: 0.16, bone: "head" },
    { id: "leg_l", shape: "capsule", a: [0.09, 0.44, 0], b: [0.09, 0.05, 0], radius: 0.05 },
    { id: "leg_r", shape: "capsule", a: [-0.09, 0.44, 0], b: [-0.09, 0.05, 0], radius: 0.05 },
  ] };

const FUR = [0.55, 0.34, 0.14, 1], FUR_D = [0.42, 0.25, 0.1, 1], TAN = [0.9, 0.68, 0.4, 1], PINK = [0.9, 0.55, 0.55, 1], DARK = [0.1, 0.05, 0.03, 1];
const parts = [
  // trunk: a pear shape, a tan belly
  { id: "pelvis", shape: "ellipsoid", center: [0, 0.5, -0.01], radii: [0.14, 0.11, 0.115], bone: "hips", blend: 0.05, color: FUR },
  { id: "torso", shape: "ellipsoid", center: [0, 0.64, 0.0], radii: [0.14, 0.15, 0.12], bone: "spine", blend: 0.06, color: FUR },
  { id: "belly", shape: "ellipsoid", center: [0, 0.56, 0.07], radii: [0.105, 0.14, 0.07], bone: "spine", blend: 0.05, color: TAN },
  { id: "shoulders", shape: "ellipsoid", center: [0, 0.75, 0], radii: [0.16, 0.06, 0.09], bone: "chest", blend: 0.05, color: FUR },
  { id: "neck", shape: "capsule", a: [0, 0.78, 0.03], b: [0, 0.85, 0.05], radius: 0.07, bone: "neck", blend: 0.04, color: FUR },
  // head: round, with a tan face mask and a muzzle
  { id: "head", shape: "ellipsoid", center: [0, 0.95, 0.06], radii: [0.135, 0.125, 0.125], bone: "head", blend: 0.04, color: FUR },
  { id: "face", shape: "ellipsoid", center: [0, 0.945, 0.12], radii: [0.1, 0.09, 0.07], bone: "head", blend: 0.04, color: TAN },
  { id: "brow", shape: "ellipsoid", center: [0, 1.0, 0.12], radii: [0.105, 0.03, 0.05], bone: "head", blend: 0.04, color: FUR_D },
  { id: "muzzle", shape: "ellipsoid", center: [0, 0.91, 0.175], radii: [0.06, 0.045, 0.04], bone: "head", blend: 0.03, color: TAN },
  { id: "nose", shape: "ellipsoid", center: [0, 0.935, 0.205], radii: [0.03, 0.018, 0.012], bone: "head", blend: 0.01, color: DARK },
  { id: "nostril_l", shape: "sphere", center: [0.012, 0.935, 0.213], radius: 0.005, bone: "head", mirror: "x", blend: 0.002, color: DARK },
  { id: "jaw", shape: "ellipsoid", center: [0, 0.885, 0.15], radii: [0.065, 0.035, 0.06], bone: "jaw", blend: 0.03, color: TAN },
  { id: "mouth_line", shape: "capsule", a: [-0.04, 0.89, 0.205], b: [0.04, 0.89, 0.205], radius: 0.004, bone: "jaw", blend: 0.002, color: DARK },
  { id: "ear", shape: "ellipsoid", center: [0.155, 0.97, 0.035], radii: [0.03, 0.09, 0.09], bone: "ear_l", mirror: "x", blend: 0.015, color: FUR },
  { id: "ear_in", shape: "ellipsoid", center: [0.162, 0.97, 0.047], radii: [0.014, 0.065, 0.065], bone: "ear_l", mirror: "x", blend: 0.008, color: PINK },
  { id: "eye_white", shape: "sphere", center: [0.058, 0.97, 0.16], radius: 0.036, bone: "eye_l", mirror: "x", island: "eyes", color: [0.98, 0.97, 0.95, 1] },
  { id: "eye_pupil", shape: "sphere", center: [0.058, 0.97, 0.192], radius: 0.017, bone: "eye_l", mirror: "x", island: "eyes", color: DARK },
  // arms: long and thin, long fingers
  { id: "arm_up", shape: "loft", bones: ["upper_l"], radii: [0.048, 0.04], mirror: "x", blend: 0.025, color: FUR },
  { id: "arm_low", shape: "loft", bones: ["fore_l"], radii: [0.04, 0.032], mirror: "x", blend: 0.025, color: FUR },
  { id: "palm", shape: "ellipsoid", center: [0.24, 0.2, 0.075], radii: [0.03, 0.04, 0.02], bone: "hand_l", mirror: "x", blend: 0.012, color: TAN },
  { id: "finger1", shape: "capsule", a: [0.225, 0.17, 0.08], b: [0.222, 0.07, 0.1], radius: 0.008, bone: "hand_l", mirror: "x", blend: 0.006, color: TAN },
  { id: "finger2", shape: "capsule", a: [0.24, 0.165, 0.085], b: [0.24, 0.05, 0.11], radius: 0.008, bone: "hand_l", mirror: "x", blend: 0.006, color: TAN },
  { id: "finger3", shape: "capsule", a: [0.255, 0.17, 0.08], b: [0.258, 0.07, 0.1], radius: 0.008, bone: "hand_l", mirror: "x", blend: 0.006, color: TAN },
  { id: "thumb", shape: "capsule", a: [0.215, 0.2, 0.085], b: [0.19, 0.15, 0.11], radius: 0.008, bone: "hand_l", mirror: "x", blend: 0.006, color: TAN },
  // legs: thin, long feet with toes
  { id: "thigh", shape: "loft", bones: ["thigh_l"], radii: [0.065, 0.05], mirror: "x", blend: 0.03, color: FUR },
  { id: "shin", shape: "loft", bones: ["shin_l"], radii: [0.05, 0.035], mirror: "x", blend: 0.025, color: FUR },
  { id: "foot", shape: "ellipsoid", center: [0.09, 0.03, 0.06], radii: [0.036, 0.022, 0.085], bone: "foot_l", mirror: "x", blend: 0.015, color: TAN },
  { id: "toe1", shape: "capsule", a: [0.075, 0.03, 0.12], b: [0.073, 0.025, 0.2], radius: 0.01, bone: "foot_l", mirror: "x", blend: 0.006, color: TAN },
  { id: "toe2", shape: "capsule", a: [0.09, 0.03, 0.125], b: [0.09, 0.025, 0.21], radius: 0.01, bone: "foot_l", mirror: "x", blend: 0.006, color: TAN },
  { id: "toe3", shape: "capsule", a: [0.105, 0.03, 0.12], b: [0.107, 0.025, 0.2], radius: 0.01, bone: "foot_l", mirror: "x", blend: 0.006, color: TAN },
  { id: "tail", shape: "loft", bones: ["tail1", "tail2", "tail3", "tail4"], radii: [0.036, 0.03, 0.024, 0.018, 0.012], blend: 0.02, color: FUR_D },
];
const sdf = { cell: 0.007, adaptive: { min_cell: 0.0035, max_cell: 0.014 }, decimate: { ratio: 0.35 }, skin: { falloff: 1.2 }, shade: { ao: 0.5, ao_radius: 0.03, tone: 0.2, color_blend: 0.15 }, islands: { eyes: { cell: 0.0025, adaptive: false, decimate: { ratio: 0.35 } } }, parts: parts };

// TEXTURE: short fur (a fine noise and stripes of hair along the body), a darker back, the face's wrinkles, the eyes painted with a hazel iris ring, pink ears
const texture = { size: 512, seed: 19, layers: [
  { kind: "fill", roughness: 0.8, metal: 0 },
  { kind: "noise", parts: ["!eye*", "!nose", "!mouth_line"], scale: 0.012, octaves: 3, amount: 0.22 },
  { kind: "stripes", parts: ["pelvis", "torso", "shoulders", "arm*", "thigh", "shin", "tail"], axis: [0, 1, 0], period: 0.01, width: 0.3, colour: [0.3, 0.17, 0.07], wobble: 0.5, wobble_scale: 0.02, strength: 0.28 },
  { kind: "gradient", parts: ["torso", "pelvis", "head"], by: "normal", axis: [0, 1, 0], from: 0, to: 1, colour: [0.35, 0.2, 0.08], strength: 0.3 },
  { kind: "noise", parts: ["face", "muzzle", "jaw", "belly", "palm", "finger*", "thumb", "foot", "toe*"], scale: 0.01, amount: 0.12 },
  { kind: "cells", parts: ["face", "muzzle", "palm", "foot"], size: 0.012, line: 0.12, colour: [0.55, 0.35, 0.2], vary: 0.2, edge: 0.4, strength: 0.18 },
  { kind: "gradient", parts: ["eye_white"], by: "position", axis: [0, 0, 1], from: 0.178, to: 0.196, colour: [0.55, 0.4, 0.1], strength: 1 },
  { kind: "fill", parts: ["eye_white", "eye_pupil"], roughness: 0.12, metal: 0 }
] };

return {
  name: "cartoon_monkey",
  max: 16,
  family: { faction: "animal", kind: "animal", hp: 40 },
  nav: { agent: { name: "cartoon_monkey", radius: 0.2, height: 1.05, step: 0.1, slope: 35, drop: 0.3 } },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, radius: 0.2, turn_rate: 3.5 },
    roles: roles,
    traits: { gait: 1.2, breath: 1.4, idle: 1.4 },
    physics: physics,
    sdf: sdf,
    texture: texture
  },
  abilities: ["walk", "open", "climb", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 40 }],
      ["flee", { speed: 2.4, distance: 9 }],
      "curious",
      "idle_life",
      "injured",
      ["wander", { speed: 1 }]
    ],
    worker: function (api, ld) {
      var tree = { name: "cartoon_monkey", select: [ld.node("flee"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
