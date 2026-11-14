"use strict";
// troll_mauler: drawn from the picture of "Troll Mauler" (OpenGameArt): a 2.6 m brute of a troll that stands hunched, with a small bald head sunk between huge shoulders, a heavy brow and an underbite with two tusks, a barrel chest,
// arms that hang to the knees ending in fists the size of a head, thick short legs with wide feet, a leather loincloth and a belt hung with a bone. Grey-brown hide with warts, scars, creases and veins painted in its texture (and a normal
// map from their relief), yellow eyes painted with a slit iris. Skeleton, rig, parts and texture are written for it.
// ONE JS FILE IS ONE CREATURE (creature_file.js): it is read as text, run with new Function("api", text) and RETURNS { name, max, family, nav, body, abilities, interaction, mind }. Metres, +x to its left, +y up, +z forward.
const bones = [
  { name: "hips", parent: null, head: [0, 1.0, 0], tail: [0, 1.15, 0.03] },
  { name: "spine", parent: "hips", head: [0, 1.15, 0.03], tail: [0, 1.4, 0.12] },
  { name: "chest", parent: "spine", head: [0, 1.4, 0.12], tail: [0, 1.82, 0.2] },
  { name: "neck", parent: "chest", head: [0, 1.82, 0.2], tail: [0, 1.95, 0.34] },
  { name: "head", parent: "neck", head: [0, 1.95, 0.34], tail: [0, 2.24, 0.46] },
  { name: "jaw", parent: "head", head: [0, 2.04, 0.44], tail: [0, 1.98, 0.7] },
  { name: "eye_l", parent: "head", head: [0.09, 2.14, 0.6], tail: [0.09, 2.14, 0.64], mirror: "x" },
  { name: "ear_l", parent: "head", head: [0.2, 2.12, 0.4], tail: [0.34, 2.2, 0.34], mirror: "x" },
  { name: "upper_l", parent: "chest", head: [0.6, 1.8, 0.14], tail: [0.78, 1.34, 0.18], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.78, 1.34, 0.18], tail: [0.84, 0.82, 0.36], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.84, 0.82, 0.36], tail: [0.86, 0.54, 0.42], mirror: "x" },
  { name: "thigh_l", parent: "hips", head: [0.27, 1.0, 0], tail: [0.31, 0.56, 0.08], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.31, 0.56, 0.08], tail: [0.32, 0.14, -0.02], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.32, 0.14, -0.02], tail: [0.32, 0.06, 0.3], mirror: "x" },
];
const rig = {
  joints: [
    { bone: "thigh_l", mirror: "x", kind: "ball", fwd: 70, back: 55, out: 40, in: 20, twist: [-25, 25] },
    { bone: "shin_l", mirror: "x", kind: "hinge", axis: [1, 0, 0], range: [-10, 130] },
    { bone: "foot_l", mirror: "x", kind: "ball", fwd: 40, back: 40, lat: 20, twist: 15 },
    { bone: "upper_l", mirror: "x", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] },
    { bone: "fore_l", mirror: "x", kind: "hinge", axis: [-1, 0, 0], range: [-10, 135] },
    { bone: "spine", kind: "ball", fwd: 35, back: 20, lat: 25, twist: 30 },
    { bone: "chest", kind: "ball", fwd: 25, back: 20, lat: 25, twist: 30 },
    { bone: "neck", kind: "ball", fwd: 40, back: 35, lat: 35, twist: 50 },
    { bone: "head", kind: "ball", fwd: 35, back: 35, lat: 35, twist: 45 },
    { bone: "jaw", kind: "hinge", axis: [1, 0, 0], range: [-3, 50] },
    { bone: "eye_l", mirror: "x", kind: "ball", fwd: 30, back: 30, lat: 30, twist: [-10, 10] },
    { bone: "ear_l", mirror: "x", kind: "ball", fwd: 40, back: 50, lat: 35, twist: 25 },
  ],
  chains: [
    { name: "leg_l", mirror: "x", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0, 0, 1], pole_w: 1 },
    { name: "arm_l", mirror: "x", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0.8, 0, -0.6], pole_w: 1 },
    { name: "head", bones: ["spine", "chest", "neck", "head"] },
  ],
};
const legs = { legs: [{ chain: "leg_l", mirror: "x" }], gait: { from: "cmu_17_09_muscular_heavyset_persons_walk", speed: 0.8 } };
const roles = { hips: "hips", spine: ["spine", "chest"], chest: "chest", neck: ["neck"], head: "head", arms: [{ chain: "arm_l", rest: [0.2, -0.95, 0.2] }, { chain: "arm_r", rest: [0.2, -0.95, 0.2] }], eyes: ["eye_l", "eye_r"], ears: [["ear_l"], ["ear_r"]], jaw: { bone: "jaw", max: 50 } };
const physics = { mass: 450, shapes: [
    { id: "body", shape: "capsule", a: [0, 1.05, 0.05], b: [0, 1.7, 0.18], radius: 0.5, bone: "hips" },
    { id: "head", shape: "sphere", center: [0, 2.12, 0.46], radius: 0.28, bone: "head" },
    { id: "leg_l", shape: "capsule", a: [0.3, 0.95, 0.04], b: [0.32, 0.12, 0], radius: 0.16 },
    { id: "leg_r", shape: "capsule", a: [-0.3, 0.95, 0.04], b: [-0.32, 0.12, 0], radius: 0.16 },
  ] };

const SKIN = [0.5, 0.42, 0.37, 1], SKIN_D = [0.38, 0.31, 0.27, 1], SKIN_L = [0.58, 0.49, 0.42, 1], LEATHER = [0.28, 0.17, 0.1, 1], BONE = [0.9, 0.86, 0.74, 1], DARK = [0.06, 0.04, 0.03, 1];
const parts = [
  // trunk: a heavy pelvis, a belly, a barrel chest with pecs and a hump of trapezius over a hunched back
  { id: "pelvis", shape: "ellipsoid", center: [0, 1.04, 0.02], radii: [0.4, 0.22, 0.3], bone: "hips", blend: 0.08, color: SKIN },
  { id: "belly", shape: "ellipsoid", center: [0, 1.28, 0.16], radii: [0.36, 0.26, 0.26], bone: "spine", blend: 0.1, color: SKIN_L },
  { id: "ribs", shape: "ellipsoid", center: [0, 1.62, 0.14], radii: [0.5, 0.34, 0.34], bone: "chest", blend: 0.09, color: SKIN },
  { id: "pec_l", shape: "ellipsoid", center: [0.26, 1.62, 0.36], radii: [0.26, 0.2, 0.14], bone: "chest", mirror: "x", blend: 0.08, color: SKIN_L },
  { id: "back_hump", shape: "ellipsoid", center: [0, 1.82, -0.06], radii: [0.46, 0.22, 0.26], bone: "chest", blend: 0.1, color: SKIN_D },
  { id: "trap_l", shape: "ellipsoid", center: [0.3, 1.9, 0.12], radii: [0.3, 0.14, 0.24], bone: "chest", mirror: "x", blend: 0.09, color: SKIN },
  { id: "neck", shape: "capsule", a: [0, 1.84, 0.22], b: [0, 1.97, 0.36], radius: 0.21, bone: "neck", blend: 0.07, color: SKIN },
  // head: small and bald, sunk forward; a heavy brow, a flat broad nose, an underbite with two tusks
  { id: "skull", shape: "ellipsoid", center: [0, 2.14, 0.4], radii: [0.2, 0.2, 0.22], bone: "head", blend: 0.05, color: SKIN },
  { id: "brow", shape: "ellipsoid", center: [0, 2.2, 0.58], radii: [0.2, 0.05, 0.08], bone: "head", blend: 0.05, color: SKIN_D },
  { id: "cheek_l", shape: "ellipsoid", center: [0.13, 2.06, 0.55], radii: [0.08, 0.07, 0.07], bone: "head", mirror: "x", blend: 0.05, color: SKIN },
  { id: "nose", shape: "ellipsoid", center: [0, 2.08, 0.66], radii: [0.07, 0.055, 0.05], bone: "head", blend: 0.04, color: SKIN_D },
  { id: "nostril_l", shape: "sphere", center: [0.03, 2.06, 0.7], radius: 0.014, bone: "head", mirror: "x", blend: 0.004, color: DARK },
  { id: "upper_lip", shape: "ellipsoid", center: [0, 2.0, 0.6], radii: [0.12, 0.05, 0.08], bone: "head", blend: 0.04, color: SKIN },
  { id: "jaw", shape: "ellipsoid", center: [0, 1.96, 0.6], radii: [0.15, 0.07, 0.15], bone: "jaw", blend: 0.05, color: SKIN_D },
  { id: "chin", shape: "ellipsoid", center: [0, 1.93, 0.72], radii: [0.1, 0.06, 0.07], bone: "jaw", blend: 0.04, color: SKIN_D },
  { id: "tusk_l", shape: "capsule", a: [0.09, 1.96, 0.7], b: [0.11, 2.05, 0.76], radius: 0.024, bone: "jaw", mirror: "x", blend: 0.004, color: BONE },
  { id: "ear_l", shape: "ellipsoid", center: [0.26, 2.16, 0.38], radii: [0.09, 0.07, 0.025], bone: "ear_l", mirror: "x", blend: 0.02, color: SKIN },
  { id: "eye_white", shape: "sphere", center: [0.09, 2.14, 0.6], radius: 0.034, bone: "eye_l", mirror: "x", island: "eyes", color: [0.95, 0.88, 0.45, 1] },
  { id: "eye_pupil", shape: "sphere", center: [0.09, 2.14, 0.628], radius: 0.014, bone: "eye_l", mirror: "x", island: "eyes", color: DARK },
  // arms: huge shoulders, thick arms down to the knees, fists with knuckles
  { id: "shoulder_l", shape: "sphere", center: [0.62, 1.78, 0.14], radius: 0.27, bone: "upper_l", mirror: "x", blend: 0.08, color: SKIN },
  { id: "arm_up", shape: "loft", bones: ["upper_l"], radii: [0.24, 0.19], mirror: "x", blend: 0.06, color: SKIN },
  { id: "bicep_l", shape: "ellipsoid", center: [0.72, 1.58, 0.26], radii: [0.16, 0.22, 0.14], bone: "upper_l", mirror: "x", blend: 0.07, color: SKIN_L },
  { id: "elbow_l", shape: "sphere", center: [0.78, 1.34, 0.18], radius: 0.18, bone: "fore_l", mirror: "x", blend: 0.05, color: SKIN },
  { id: "arm_low", shape: "loft", bones: ["fore_l"], radii: [0.19, 0.15], mirror: "x", blend: 0.05, color: SKIN },
  { id: "fist_l", shape: "ellipsoid", center: [0.86, 0.6, 0.42], radii: [0.17, 0.19, 0.16], bone: "hand_l", mirror: "x", blend: 0.04, color: SKIN_D },
  { id: "knuckle_a", shape: "sphere", center: [0.8, 0.5, 0.55], radius: 0.05, bone: "hand_l", mirror: "x", blend: 0.02, color: SKIN },
  { id: "knuckle_b", shape: "sphere", center: [0.88, 0.5, 0.56], radius: 0.05, bone: "hand_l", mirror: "x", blend: 0.02, color: SKIN },
  { id: "knuckle_c", shape: "sphere", center: [0.96, 0.52, 0.53], radius: 0.045, bone: "hand_l", mirror: "x", blend: 0.02, color: SKIN },
  { id: "thumb_l", shape: "capsule", a: [0.74, 0.66, 0.48], b: [0.72, 0.5, 0.56], radius: 0.05, bone: "hand_l", mirror: "x", blend: 0.02, color: SKIN },
  // legs: thick and short, wide flat feet with toes
  { id: "thigh", shape: "loft", bones: ["thigh_l"], radii: [0.26, 0.19], mirror: "x", blend: 0.06, color: SKIN },
  { id: "knee_l", shape: "sphere", center: [0.31, 0.56, 0.1], radius: 0.18, bone: "shin_l", mirror: "x", blend: 0.05, color: SKIN },
  { id: "shin", shape: "loft", bones: ["shin_l"], radii: [0.19, 0.13], mirror: "x", blend: 0.05, color: SKIN },
  { id: "foot_l", shape: "ellipsoid", center: [0.32, 0.08, 0.1], radii: [0.17, 0.08, 0.26], bone: "foot_l", mirror: "x", blend: 0.04, color: SKIN_D },
  { id: "toe_a", shape: "sphere", center: [0.25, 0.06, 0.34], radius: 0.06, bone: "foot_l", mirror: "x", blend: 0.02, color: SKIN },
  { id: "toe_b", shape: "sphere", center: [0.33, 0.06, 0.37], radius: 0.06, bone: "foot_l", mirror: "x", blend: 0.02, color: SKIN },
  { id: "toe_c", shape: "sphere", center: [0.41, 0.06, 0.34], radius: 0.055, bone: "foot_l", mirror: "x", blend: 0.02, color: SKIN },
  // clothes: a belt, a leather loincloth front and back, a bone hung from the belt
  { id: "belt", shape: "capsule", a: [-0.4, 1.12, 0.2], b: [0.4, 1.12, 0.2], radius: 0.05, bone: "hips", blend: 0.02, color: [0.15, 0.1, 0.07, 1] },
  { id: "cloth_front", shape: "box", center: [0, 0.9, 0.3], half: [0.28, 0.24, 0.03], round: 0.02, bone: "hips", blend: 0.03, color: LEATHER },
  { id: "cloth_back", shape: "box", center: [0, 0.92, -0.26], half: [0.3, 0.22, 0.03], round: 0.02, bone: "hips", blend: 0.03, color: LEATHER },
  { id: "hung_bone", shape: "capsule", a: [0.3, 1.08, 0.3], b: [0.34, 0.8, 0.34], radius: 0.022, bone: "hips", blend: 0.006, color: BONE },
];
const sdf = { cell: 0.016, adaptive: { min_cell: 0.008, max_cell: 0.035 }, decimate: { ratio: 0.45 }, skin: { falloff: 1.3 }, shade: { ao: 0.5, ao_radius: 0.05, tone: 0.2, color_blend: 0.2 }, islands: { eyes: { cell: 0.005, adaptive: false, decimate: { ratio: 0.35 } } }, parts: parts };

// TEXTURE (maps.js; a layer with a height also makes the normal map): a mottled grey-brown hide, creases of the skin, warts, long scars across the chest and arm, veins along the arms, a darker back, a woven leather loincloth,
// yellowed tusks and eyes painted with a slit iris
const SK = ["!eye*", "!tusk*", "!cloth*", "!belt", "!hung_bone", "!nostril*"];
const texture = { size: 512, seed: 23, layers: [
  { kind: "fill", roughness: 0.78, metal: 0 },
  { kind: "noise", parts: SK, scale: 0.12, amount: 0.18 },
  { kind: "noise", parts: SK, scale: 0.03, octaves: 3, amount: 0.12, height: 0.003 },
  { kind: "cells", parts: SK, size: 0.07, line: 0.1, colour: [0.28, 0.21, 0.18], vary: 0.2, edge: 0.5, strength: 0.18, height: -0.005 },
  { kind: "spots", parts: SK, size: 0.2, radius: 0.1, density: 0.12, vary: 0.5, colour: [0.38, 0.3, 0.22], edge: 0.35, strength: 0.7, height: 0.012 },
  { kind: "stripes", parts: ["ribs", "pec*", "belly", "arm_up", "bicep*"], axis: [0.6, 0.8, 0.2], period: 0.5, width: 0.03, colour: [0.62, 0.5, 0.45], wobble: 0.3, wobble_scale: 0.2, strength: 0.8, height: -0.007 },
  { kind: "stripes", parts: ["arm_up", "arm_low", "bicep*", "thigh", "shin"], axis: [0, 1, 0.1], period: 0.09, width: 0.1, colour: [0.35, 0.36, 0.4], wobble: 0.6, wobble_scale: 0.06, strength: 0.28, height: 0.004 },
  { kind: "gradient", parts: SK, by: "normal", axis: [0, 1, 0], from: -0.3, to: 1, colour: [0.3, 0.24, 0.2], strength: 0.3 },
  { kind: "gradient", parts: ["belly", "chin", "upper_lip"], by: "normal", axis: [0, 0, 1], from: 0.3, to: 1, colour: [0.68, 0.58, 0.5], strength: 0.35 },
  { kind: "stripes", parts: ["cloth*"], axis: [1, 0, 0], period: 0.03, width: 0.45, colour: [0.18, 0.1, 0.06], strength: 0.5, height: 0.003 },
  { kind: "noise", parts: ["cloth*", "belt"], scale: 0.02, amount: 0.3 },
  { kind: "fill", parts: ["tusk*", "hung_bone"], roughness: 0.4 },
  { kind: "gradient", parts: ["tusk*"], by: "position", axis: [0, 1, 0], from: 1.96, to: 2.05, colour: [0.72, 0.66, 0.5], strength: 0.6 },
  { kind: "gradient", parts: ["eye_white"], by: "position", axis: [0, 0, 1], from: 0.622, to: 0.64, colour: [0.85, 0.35, 0.05], strength: 1 },
  { kind: "fill", parts: ["eye_white", "eye_pupil"], roughness: 0.15 }
] };

return {
  name: "troll_mauler",
  max: 16,
  family: { faction: "monster", kind: "monster", hp: 220 },
  nav: { agent: { name: "troll_mauler", radius: 0.6, height: 2.5, step: 0.3, slope: 35, drop: 0.8 } },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, radius: 0.55, max_speed: 3, accel: 5, turn_rate: 2.8 },
    roles: roles,
    traits: { gait: 1.6, breath: 2.2, idle: 1.6 },
    physics: physics,
    sdf: sdf,
    texture: texture
  },
  abilities: ["walk", "open", "climb", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 220 }],
      ["flee", { gait: "" }],
      "curious",
      "idle_life",
      "injured",
      ["wander", { speed: 1 }]
    ],
    worker: function (api, ld) {
      var tree = { name: "troll_mauler", select: [ld.node("flee"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
