"use strict";
// frog_guy: drawn from the picture of "Frog Guy" (OpenGameArt): a frog-man 1.7 m tall that stands upright and a little crouched, with a wide flat head with a huge mouth and two bulging green eyes at the top corners, a narrow neck-less
// body with broad shoulders, a pale belly with creases, long thin arms with long fingers (one reaches out), long thin legs and wide splayed feet with long toes. The hide is a brown-grey camouflage mottle (painted in the texture, with
// warts and a normal map from their relief), the belly pale and wrinkled, the eyes yellow-green with a slit pupil. Skeleton, rig, parts and texture are written for it.
// ONE JS FILE IS ONE CREATURE (creature_file.js): it is read as text, run with new Function("api", text) and RETURNS { name, max, family, nav, body, abilities, interaction, mind }. Metres, +x to its left, +y up, +z forward.
const bones = [
  { name: "hips", parent: null, head: [0, 0.98, 0], tail: [0, 1.06, 0.03] },
  { name: "spine", parent: "hips", head: [0, 1.06, 0.03], tail: [0, 1.28, 0.08] },
  { name: "chest", parent: "spine", head: [0, 1.28, 0.08], tail: [0, 1.5, 0.12] },
  { name: "neck", parent: "chest", head: [0, 1.5, 0.12], tail: [0, 1.56, 0.17] },
  { name: "head", parent: "neck", head: [0, 1.56, 0.17], tail: [0, 1.74, 0.26] },
  { name: "jaw", parent: "head", head: [0, 1.62, 0.2], tail: [0, 1.58, 0.44] },
  { name: "eye_l", parent: "head", head: [0.17, 1.74, 0.2], tail: [0.17, 1.76, 0.26], mirror: "x" },
  { name: "upper_l", parent: "chest", head: [0.3, 1.46, 0.08], tail: [0.4, 1.12, 0.1], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.4, 1.12, 0.1], tail: [0.38, 0.76, 0.2], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.38, 0.76, 0.2], tail: [0.38, 0.58, 0.26], mirror: "x" },
  { name: "thigh_l", parent: "hips", head: [0.14, 0.98, 0], tail: [0.24, 0.54, 0.1], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.24, 0.54, 0.1], tail: [0.2, 0.08, -0.04], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.2, 0.08, -0.04], tail: [0.24, 0.03, 0.26], mirror: "x" },
];
const rig = {
  joints: [
    { bone: "thigh_l", mirror: "x", kind: "ball", fwd: 75, back: 55, out: 55, in: 20, twist: [-30, 30] },
    { bone: "shin_l", mirror: "x", kind: "hinge", axis: [1, 0, 0], range: [-10, 135] },
    { bone: "foot_l", mirror: "x", kind: "ball", fwd: 45, back: 45, lat: 25, twist: 20 },
    { bone: "upper_l", mirror: "x", kind: "ball", fwd: 140, back: 60, out: 110, in: 40, twist: [-85, 85] },
    { bone: "fore_l", mirror: "x", kind: "hinge", axis: [-1, 0, 0], range: [-10, 140] },
    { bone: "spine", kind: "ball", fwd: 35, back: 20, lat: 25, twist: 30 },
    { bone: "chest", kind: "ball", fwd: 25, back: 20, lat: 25, twist: 30 },
    { bone: "neck", kind: "ball", fwd: 35, back: 35, lat: 30, twist: 40 },
    { bone: "head", kind: "ball", fwd: 35, back: 40, lat: 35, twist: 45 },
    { bone: "jaw", kind: "hinge", axis: [1, 0, 0], range: [-3, 55] },
    { bone: "eye_l", mirror: "x", kind: "ball", fwd: 30, back: 30, lat: 30, twist: [-10, 10] },
  ],
  chains: [
    { name: "leg_l", mirror: "x", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0, 0, 1], pole_w: 1 },
    { name: "arm_l", mirror: "x", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0.8, 0, -0.6], pole_w: 1 },
    { name: "head", bones: ["spine", "chest", "neck", "head"] },
  ],
};
const legs = { legs: [{ chain: "leg_l", mirror: "x" }], gait: { from: "person_walk_cheerful", speed: 0.9 } };
const roles = { hips: "hips", spine: ["spine", "chest"], chest: "chest", neck: ["neck"], head: "head", arms: [{ chain: "arm_l", rest: [0.1, -0.98, 0.15] }, { chain: "arm_r", rest: [0.1, -0.98, 0.15] }], eyes: ["eye_l", "eye_r"], jaw: { bone: "jaw", max: 55 } };
const physics = { mass: 70, shapes: [
    { id: "body", shape: "capsule", a: [0, 1.0, 0.03], b: [0, 1.45, 0.1], radius: 0.24, bone: "hips" },
    { id: "head", shape: "sphere", center: [0, 1.66, 0.24], radius: 0.24, bone: "head" },
    { id: "leg_l", shape: "capsule", a: [0.2, 0.95, 0.05], b: [0.2, 0.08, 0], radius: 0.07 },
    { id: "leg_r", shape: "capsule", a: [-0.2, 0.95, 0.05], b: [-0.2, 0.08, 0], radius: 0.07 },
  ] };

const HIDE = [0.46, 0.38, 0.28, 1], HIDE_D = [0.32, 0.25, 0.18, 1], BELLY = [0.68, 0.6, 0.46, 1], MOUTH = [0.45, 0.2, 0.18, 1], DARK = [0.05, 0.04, 0.03, 1];
const parts = [
  // body: broad shoulders over a narrow waist, a pale belly, a hunched back
  { id: "pelvis", shape: "ellipsoid", center: [0, 1.0, 0.0], radii: [0.2, 0.13, 0.15], bone: "hips", blend: 0.05, color: HIDE },
  { id: "waist", shape: "ellipsoid", center: [0, 1.14, 0.04], radii: [0.16, 0.14, 0.12], bone: "spine", blend: 0.05, color: HIDE },
  { id: "belly", shape: "ellipsoid", center: [0, 1.12, 0.1], radii: [0.12, 0.17, 0.08], bone: "spine", blend: 0.06, color: BELLY },
  { id: "ribs", shape: "ellipsoid", center: [0, 1.38, 0.08], radii: [0.27, 0.17, 0.17], bone: "chest", blend: 0.07, color: HIDE },
  { id: "chest_pale", shape: "ellipsoid", center: [0, 1.38, 0.17], radii: [0.2, 0.15, 0.08], bone: "chest", blend: 0.06, color: BELLY },
  { id: "hump", shape: "ellipsoid", center: [0, 1.46, -0.05], radii: [0.25, 0.13, 0.13], bone: "chest", blend: 0.07, color: HIDE_D },
  // head: wide and flat like a frog's, a huge mouth, eye bulges at the top corners, nostrils on the snout
  { id: "head", shape: "ellipsoid", center: [0, 1.66, 0.22], radii: [0.25, 0.12, 0.2], bone: "head", blend: 0.06, color: HIDE },
  { id: "cheek_l", shape: "ellipsoid", center: [0.17, 1.6, 0.2], radii: [0.1, 0.08, 0.14], bone: "head", mirror: "x", blend: 0.05, color: HIDE },
  { id: "snout", shape: "ellipsoid", center: [0, 1.66, 0.38], radii: [0.12, 0.06, 0.08], bone: "head", blend: 0.05, color: HIDE },
  { id: "nostril_l", shape: "sphere", center: [0.04, 1.7, 0.45], radius: 0.012, bone: "head", mirror: "x", blend: 0.004, color: DARK },
  { id: "eye_bulge_l", shape: "ellipsoid", center: [0.15, 1.76, 0.2], radii: [0.085, 0.07, 0.08], bone: "eye_l", mirror: "x", blend: 0.03, color: HIDE_D },
  { id: "eye_ball", shape: "sphere", center: [0.17, 1.78, 0.25], radius: 0.052, bone: "eye_l", mirror: "x", island: "eyes", color: [0.72, 0.85, 0.2, 1] },
  { id: "eye_pupil", shape: "ellipsoid", center: [0.17, 1.79, 0.3], radii: [0.008, 0.03, 0.01], bone: "eye_l", mirror: "x", island: "eyes", color: DARK },
  { id: "jaw", shape: "ellipsoid", center: [0, 1.57, 0.28], radii: [0.2, 0.045, 0.17], bone: "jaw", blend: 0.04, color: BELLY },
  { id: "chin", shape: "ellipsoid", center: [0, 1.56, 0.4], radii: [0.12, 0.04, 0.06], bone: "jaw", blend: 0.03, color: BELLY },
  { id: "lip_line", shape: "capsule", a: [-0.2, 1.6, 0.3], b: [0.2, 1.6, 0.3], radius: 0.006, bone: "head", blend: 0.002, color: MOUTH },
  { id: "throat", shape: "ellipsoid", center: [0, 1.52, 0.22], radii: [0.12, 0.08, 0.1], bone: "neck", blend: 0.06, color: BELLY },
  // arms: long and thin, big hands with long fingers
  { id: "shoulder_l", shape: "sphere", center: [0.31, 1.44, 0.08], radius: 0.1, bone: "upper_l", mirror: "x", blend: 0.05, color: HIDE },
  { id: "arm_up", shape: "loft", bones: ["upper_l"], radii: [0.075, 0.05], mirror: "x", blend: 0.03, color: HIDE },
  { id: "elbow_l", shape: "sphere", center: [0.4, 1.12, 0.1], radius: 0.05, bone: "fore_l", mirror: "x", blend: 0.025, color: HIDE },
  { id: "arm_low", shape: "loft", bones: ["fore_l"], radii: [0.05, 0.04], mirror: "x", blend: 0.025, color: HIDE },
  { id: "palm", shape: "ellipsoid", center: [0.38, 0.66, 0.23], radii: [0.045, 0.06, 0.025], bone: "hand_l", mirror: "x", blend: 0.015, color: BELLY },
  { id: "finger1", shape: "capsule", a: [0.355, 0.62, 0.24], b: [0.34, 0.45, 0.31], radius: 0.014, bone: "hand_l", mirror: "x", blend: 0.008, color: HIDE },
  { id: "finger2", shape: "capsule", a: [0.38, 0.61, 0.245], b: [0.38, 0.43, 0.32], radius: 0.014, bone: "hand_l", mirror: "x", blend: 0.008, color: HIDE },
  { id: "finger3", shape: "capsule", a: [0.405, 0.62, 0.24], b: [0.42, 0.45, 0.31], radius: 0.014, bone: "hand_l", mirror: "x", blend: 0.008, color: HIDE },
  { id: "thumb_l", shape: "capsule", a: [0.335, 0.7, 0.23], b: [0.3, 0.6, 0.29], radius: 0.014, bone: "hand_l", mirror: "x", blend: 0.008, color: HIDE },
  // legs: long and thin, bent at the knee; big flat splayed feet with long toes
  { id: "thigh", shape: "loft", bones: ["thigh_l"], radii: [0.1, 0.07], mirror: "x", blend: 0.04, color: HIDE },
  { id: "knee_l", shape: "sphere", center: [0.24, 0.54, 0.1], radius: 0.07, bone: "shin_l", mirror: "x", blend: 0.03, color: HIDE },
  { id: "shin", shape: "loft", bones: ["shin_l"], radii: [0.07, 0.045], mirror: "x", blend: 0.03, color: HIDE },
  { id: "foot", shape: "ellipsoid", center: [0.22, 0.05, 0.08], radii: [0.06, 0.03, 0.13], bone: "foot_l", mirror: "x", blend: 0.02, color: HIDE_D },
  { id: "toe1", shape: "capsule", a: [0.2, 0.04, 0.16], b: [0.15, 0.025, 0.3], radius: 0.017, bone: "foot_l", mirror: "x", blend: 0.01, color: HIDE },
  { id: "toe2", shape: "capsule", a: [0.23, 0.04, 0.17], b: [0.23, 0.025, 0.32], radius: 0.017, bone: "foot_l", mirror: "x", blend: 0.01, color: HIDE },
  { id: "toe3", shape: "capsule", a: [0.26, 0.04, 0.16], b: [0.31, 0.025, 0.29], radius: 0.017, bone: "foot_l", mirror: "x", blend: 0.01, color: HIDE },
];
const sdf = { cell: 0.01, adaptive: { min_cell: 0.005, max_cell: 0.022 }, decimate: { ratio: 0.4 }, skin: { falloff: 1.2 }, shade: { ao: 0.5, ao_radius: 0.04, tone: 0.2, color_blend: 0.2 }, islands: { eyes: { cell: 0.003, adaptive: false, decimate: { ratio: 0.35 } } }, parts: parts };

// TEXTURE (maps.js; a layer with a height also makes the normal map): a camouflage of blotches in two browns and an olive over the back, head, arms and legs; a pale belly, throat and chin with creases across them; warts on the back and
// head; the lower jaw's wet sheen; the eyes yellow-green with a vertical slit pupil and a dark rim
const BACK = ["pelvis", "waist", "ribs", "hump", "head", "cheek*", "snout", "eye_bulge*", "shoulder*", "arm_up", "arm_low", "elbow*", "thigh", "shin", "knee*", "foot", "toe*", "finger*", "thumb*"];
const PALE = ["belly", "chest_pale", "jaw", "chin", "throat", "palm"];
const texture = { size: 512, seed: 31, layers: [
  { kind: "fill", roughness: 0.55, metal: 0 },
  { kind: "noise", parts: BACK, scale: 0.05, octaves: 3, amount: 0.2 },
  { kind: "noise", parts: BACK, scale: 0.16, octaves: 2, amount: 0.1, threshold: 0.5, colour: [0.2, 0.14, 0.08], strength: 0.95 },
  { kind: "noise", parts: BACK, scale: 0.1, octaves: 2, amount: 0.1, threshold: 0.58, colour: [0.4, 0.42, 0.2], strength: 0.9 },
  { kind: "noise", parts: BACK, scale: 0.22, octaves: 2, amount: 0.1, threshold: 0.62, colour: [0.62, 0.52, 0.36], strength: 0.8 },
  { kind: "spots", parts: BACK, size: 0.05, radius: 0.3, density: 0.3, vary: 0.5, colour: [0.2, 0.15, 0.1], edge: 0.6, strength: 0.5, height: 0.006 },
  { kind: "cells", parts: BACK, size: 0.025, line: 0.1, colour: [0.25, 0.19, 0.12], vary: 0.2, edge: 0.5, strength: 0.15, height: -0.002 },
  { kind: "stripes", parts: PALE, axis: [0, 1, 0], period: 0.045, width: 0.12, colour: [0.45, 0.38, 0.28], wobble: 0.3, wobble_scale: 0.05, strength: 0.55, height: -0.004 },
  { kind: "gradient", parts: PALE, by: "normal", axis: [0, 0, 1], from: 0.2, to: 1, colour: [0.78, 0.7, 0.55], strength: 0.4 },
  { kind: "noise", parts: PALE, scale: 0.02, amount: 0.15 },
  { kind: "fill", parts: ["jaw", "chin", "throat"], roughness: 0.3 },
  { kind: "gradient", parts: ["eye_ball"], by: "position", axis: [0, 0, 1], from: 0.285, to: 0.305, colour: [0.15, 0.2, 0.03], strength: 0.9 },
  { kind: "fill", parts: ["eye_ball", "eye_pupil"], roughness: 0.1 }
] };

return {
  name: "frog_guy",
  max: 16,
  family: { faction: "monster", kind: "monster", hp: 90 },
  nav: { agent: { name: "frog_guy", radius: 0.35, height: 1.75, step: 0.2, slope: 35, drop: 0.5 } },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, radius: 0.35, max_speed: 2.6, accel: 6, turn_rate: 3.2 },
    roles: roles,
    traits: { gait: 1.3, breath: 1.6, idle: 1.4 },
    physics: physics,
    sdf: sdf,
    texture: texture
  },
  abilities: ["walk", "open", "climb", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 90 }],
      ["flee", { gait: "" }],
      "curious",
      "idle_life",
      "injured",
      ["wander", { speed: 1 }]
    ],
    worker: function (api, ld) {
      var tree = { name: "frog_guy", select: [ld.node("flee"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
