"use strict";
// rhino_beetle: a big rhinoceros beetle, 0.5 m long, on six stout legs: a dark chestnut shell with grooves along it, a ridged pronotum and a horn on its head. Made on the ant's rig (a body bone and three legs of three bones on a side), thicker and lower,
// with a TEXTURE recipe (maps.js, SYSTEM.md "Texture on an sdf creature"): the sdf gives the shape and the colour of its parts, the recipe paints the grooves of the wing cases, a metallic sheen with patches of lighter brown and the pits of the pronotum.
// ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature { name, family, nav, body, abilities, mind }. Metres, +x to its left, +y up, +z forward.

// 1. SKELETON & RIG
const bones = [{ name: "body", head: [0, 0.13, -0.2], tail: [0, 0.13, 0.2] }];
const joints = [], chains = [];
[["1", 0.14, 0.45], ["2", 0.0, 0.0], ["3", -0.14, -0.45]].forEach(function (leg) {
  const id = leg[0], z = leg[1], fan = leg[2], dx = Math.cos(fan), dz = Math.sin(fan);
  const pts = [[0.05, 0.13, z], [0.05 + 0.05 * dx, 0.13, z + 0.05 * dz], [0.05 + 0.13 * dx, 0.2, z + 0.13 * dz], [0.05 + 0.24 * dx, 0.0, z + 0.24 * dz]];
  const names = ["coxa" + id + "_l", "femur" + id + "_l", "tibia" + id + "_l"];
  names.forEach(function (name, i) { bones.push({ name: name, parent: i === 0 ? "body" : names[i - 1], head: pts[i], tail: pts[i + 1], mirror: "x" }); });
  const axis = [-dz, 0, dx];
  joints.push({ bone: names[0], mirror: "x", fwd: 35, back: 35, up: 15, down: 20, twist: 5 });
  joints.push({ bone: names[1], mirror: "x", kind: "hinge", axis: axis, range: [-50, 70] });
  joints.push({ bone: names[2], mirror: "x", kind: "hinge", axis: axis, range: [-100, 40] });
  chains.push({ name: "leg" + id + "_l", mirror: "x", bones: names, pole: [0, 1, 0], pole_w: 1 });
});

// 2. LEGS, ROLES, PHYSICS: a heavy slow walker
const legs = { legs: [{ chain: "leg1_l", mirror: "x" }, { chain: "leg2_l", mirror: "x" }, { chain: "leg3_l", mirror: "x" }], gait: { speed: 0.5, stride: 0.2, swing: 0.45, step_height: 0.05 }, slots: 2 };
const roles = { hips: "body" };
const physics = { mass: 1.2, shapes: [{ id: "hull", shape: "capsule", a: [0, 0.13, -0.15], b: [0, 0.13, 0.15], radius: 0.1, bone: "body" }] };

// 3. SDF MESH BODY
const SHELL = [0.22, 0.11, 0.05, 1], DARK = [0.09, 0.05, 0.03, 1], HORN = [0.14, 0.07, 0.04, 1];
const parts = [
  { id: "head", shape: "ellipsoid", center: [0, 0.12, 0.27], radii: [0.065, 0.045, 0.06], bone: "body", blend: 0.02, color: DARK },
  { id: "horn", shape: "capsule", a: [0, 0.14, 0.3], b: [0, 0.23, 0.4], ra: 0.026, rb: 0.01, bone: "body", blend: 0.02, color: HORN },
  { id: "horn_tip", shape: "capsule", a: [0, 0.23, 0.4], b: [0, 0.27, 0.36], ra: 0.01, rb: 0.006, bone: "body", blend: 0.01, color: HORN },
  { id: "eye_l", shape: "sphere", center: [0.05, 0.14, 0.3], radius: 0.014, bone: "body", mirror: "x", blend: 0.004, color: [0.02, 0.02, 0.02, 1] },
  { id: "pronotum", shape: "ellipsoid", center: [0, 0.15, 0.13], radii: [0.1, 0.08, 0.1], bone: "body", blend: 0.02, color: SHELL },
  { id: "elytra", shape: "ellipsoid", center: [0, 0.155, -0.08], radii: [0.115, 0.085, 0.2], bone: "body", blend: 0.02, color: SHELL },
  { id: "rim", shape: "ellipsoid", center: [0, 0.1, -0.06], radii: [0.105, 0.045, 0.19], bone: "body", blend: 0.02, color: DARK }
];
["1", "2", "3"].forEach(function (id) {
  parts.push(
    { id: "coxa" + id, shape: "loft", bones: ["coxa" + id + "_l"], radii: [0.03, 0.026], mirror: "x", blend: 0.012, color: DARK },
    { id: "femur" + id, shape: "loft", bones: ["femur" + id + "_l"], radii: [0.026, 0.02], mirror: "x", blend: 0.012, color: SHELL },
    { id: "tibia" + id, shape: "loft", bones: ["tibia" + id + "_l"], radii: [0.02, 0.01], mirror: "x", blend: 0.012, color: DARK });
});
const sdf = { cell: 0.006, adaptive: { min_cell: 0.003, max_cell: 0.012 }, decimate: { ratio: 0.3 }, skin: { falloff: 0.8 }, shade: { ao: 0.5, ao_radius: 0.03, tone: 0.2, color_blend: 0.1 }, parts: parts };

// 4. TEXTURE: with a normal map: the grooves of the wing cases are cut 6 mm into the shell (`height`) and the pronotum is a field of small domes (`bulge`)
const texture = { size: 256, seed: 17, layers: [
  { kind: "fill", parts: ["elytra", "pronotum", "head", "horn*", "rim"], roughness: 0.22, metal: 0.45 },
  { kind: "noise", parts: ["elytra", "pronotum"], scale: 0.06, octaves: 2, colour: [0.4, 0.22, 0.09], threshold: 0.5, strength: 0.6, edge: 0.7 },
  { kind: "stripes", parts: ["elytra"], axis: [1, 0, 0], period: 0.032, width: 0.14, colour: [0.06, 0.03, 0.015], wobble: 0.05, edge: 0.6, strength: 0.75, height: -0.006 },
  { kind: "cells", parts: ["pronotum", "head"], size: 0.014, line: 0.14, colour: [0.05, 0.025, 0.012], vary: 0.3, edge: 0.4, strength: 0.6, height: -0.003, bulge: 0.002 },
  { kind: "gradient", parts: ["elytra", "pronotum"], by: "normal", axis: [0, 1, 0], from: 0.3, to: 0.95, colour: [0.32, 0.17, 0.07], strength: 0.45 },
  { kind: "noise", parts: ["coxa*", "femur*", "tibia*"], scale: 0.01, amount: 0.35 }
] };

return {
  name: "rhino_beetle", max: 16,
  family: { faction: "animal", kind: "animal", hp: 40 },
  nav: { agent: "small" },
  body: {
    skeleton: bones,
    rig: { joints: joints, chains: chains },
    legs: legs,
    body: { gravity: 9.8 },
    roles: roles,
    physics: physics,
    sdf: sdf,
    texture: texture
  },
  abilities: ["walk", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 40 }],
      ["flee", { speed: 0.8, distance: 5 }],
      ["curious", { approach: 0.3, cooldown: 20, near: 1 }],
      ["wander", { speed: 0.22, near: 0.5 }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first.
    worker: function (api, ld) {
      var tree = { name: "rhino_beetle", select: [ld.node("flee"), ld.node("curious"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
