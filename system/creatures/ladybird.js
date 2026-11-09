"use strict";
// ladybird: a big ladybird, 0.25 m long, on six short legs: a glossy red shell (the elytra) with black spots, a black pronotum with two white patches and a small black head. Made on the ant's rig (a body bone and three legs of three bones on a side)
// with a TEXTURE recipe (maps.js, SYSTEM.md "Texture on an sdf creature"): the sdf gives the shape and the red of the shell, the recipe paints what is finer than its mesh: the spots, the gloss and the white patches.
// ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature { name, family, nav, body, abilities, mind }. Metres, +x to its left, +y up, +z forward.

// 1. SKELETON & RIG: a body bone, three legs (coxa, femur, tibia) on a side that fan out from the body: the first forward, the last back
const bones = [{ name: "body", head: [0, 0.075, -0.11], tail: [0, 0.075, 0.1] }];
const joints = [], chains = [];
[["1", 0.06, 0.4], ["2", 0.0, 0.0], ["3", -0.06, -0.4]].forEach(function (leg) {
  const id = leg[0], z = leg[1], fan = leg[2], dx = Math.cos(fan), dz = Math.sin(fan);
  const pts = [[0.03, 0.075, z], [0.03 + 0.025 * dx, 0.075, z + 0.025 * dz], [0.03 + 0.06 * dx, 0.12, z + 0.06 * dz], [0.03 + 0.11 * dx, 0.0, z + 0.11 * dz]];
  const names = ["coxa" + id + "_l", "femur" + id + "_l", "tibia" + id + "_l"];
  names.forEach(function (name, i) { bones.push({ name: name, parent: i === 0 ? "body" : names[i - 1], head: pts[i], tail: pts[i + 1], mirror: "x" }); });
  const axis = [-dz, 0, dx];
  joints.push({ bone: names[0], mirror: "x", fwd: 35, back: 35, up: 15, down: 20, twist: 5 });
  joints.push({ bone: names[1], mirror: "x", kind: "hinge", axis: axis, range: [-50, 70] });
  joints.push({ bone: names[2], mirror: "x", kind: "hinge", axis: axis, range: [-100, 40] });
  chains.push({ name: "leg" + id + "_l", mirror: "x", bones: names, pole: [0, 1, 0], pole_w: 1 });
});

// 2. LEGS, ROLES, PHYSICS
const legs = { legs: [{ chain: "leg1_l", mirror: "x" }, { chain: "leg2_l", mirror: "x" }, { chain: "leg3_l", mirror: "x" }], gait: { speed: 0.7, stride: 0.12, swing: 0.45, step_height: 0.035 }, slots: 2 };
const roles = { hips: "body" };
const physics = { mass: 0.15, shapes: [{ id: "hull", shape: "capsule", a: [0, 0.075, -0.07], b: [0, 0.075, 0.08], radius: 0.065, bone: "body" }] };

// 3. SDF MESH BODY: the shell is a flat-bottomed dome (an ellipsoid with a second, lower one under it for the rim), the pronotum a low cap, the head a small ball with two eyes
const RED = [0.78, 0.07, 0.04, 1], BLACK = [0.05, 0.05, 0.05, 1], WHITE = [0.9, 0.9, 0.85, 1];
const parts = [
  { id: "head", shape: "ellipsoid", center: [0, 0.07, 0.115], radii: [0.036, 0.028, 0.03], bone: "body", blend: 0.012, color: BLACK },
  { id: "eye_l", shape: "sphere", center: [0.026, 0.078, 0.133], radius: 0.011, bone: "body", mirror: "x", blend: 0.004, color: WHITE },
  { id: "pronotum", shape: "ellipsoid", center: [0, 0.078, 0.072], radii: [0.056, 0.04, 0.036], bone: "body", blend: 0.012, color: BLACK },
  { id: "elytra", shape: "ellipsoid", center: [0, 0.088, -0.03], radii: [0.085, 0.062, 0.115], bone: "body", blend: 0.012, color: RED },
  { id: "rim", shape: "ellipsoid", center: [0, 0.062, -0.03], radii: [0.088, 0.025, 0.115], bone: "body", blend: 0.012, color: BLACK }
];
["1", "2", "3"].forEach(function (id) {
  parts.push(
    { id: "coxa" + id, shape: "loft", bones: ["coxa" + id + "_l"], radii: [0.013, 0.011], mirror: "x", blend: 0.008, color: BLACK },
    { id: "femur" + id, shape: "loft", bones: ["femur" + id + "_l"], radii: [0.011, 0.009], mirror: "x", blend: 0.008, color: BLACK },
    { id: "tibia" + id, shape: "loft", bones: ["tibia" + id + "_l"], radii: [0.009, 0.004], mirror: "x", blend: 0.008, color: BLACK });
});
const sdf = { cell: 0.004, adaptive: { min_cell: 0.002, max_cell: 0.008 }, decimate: { ratio: 0.3 }, skin: { falloff: 0.8 }, shade: { ao: 0.5, ao_radius: 0.02, tone: 0.2, color_blend: 0.1 }, parts: parts };

// 4. TEXTURE: the spots are the recipe's (seven on a shell, big and round), the shell is lacquered (low roughness), the pronotum has its two pale patches, the legs a fine grain
const texture = { size: 256, seed: 14, layers: [
  { kind: "fill", parts: ["elytra", "pronotum", "head", "rim"], roughness: 0.1, metal: 0.04 },
  { kind: "spots", parts: ["elytra"], size: 0.062, radius: 0.34, density: 0.8, vary: 0.35, colour: [0.02, 0.02, 0.02], edge: 0.3, strength: 1 },
  { kind: "spots", parts: ["pronotum"], size: 0.04, radius: 0.32, density: 0.55, vary: 0.2, colour: [0.92, 0.92, 0.86], edge: 0.35, strength: 0.9 },
  { kind: "noise", parts: ["elytra"], scale: 0.05, amount: 0.12 },
  { kind: "noise", parts: ["coxa*", "femur*", "tibia*"], scale: 0.008, amount: 0.3 }
] };

return {
  name: "ladybird", max: 16,
  family: { faction: "animal", kind: "animal", hp: 12 },
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
      ["health", { hp: 12 }],
      ["flee", { speed: 1.0, distance: 5 }],
      ["curious", { approach: 0.3, cooldown: 20, near: 1 }],
      ["wander", { speed: 0.3, near: 0.5 }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first.
    worker: function (api, ld) {
      var tree = { name: "ladybird", select: [ld.node("flee"), ld.node("curious"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
