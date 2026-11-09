"use strict";
// bee: a big bumblebee, 0.3 m long, that WALKS on six legs and FLIES (a hover: it can stand in the air). Made on the fly's rig (a body bone with a neck and a head, a wing and three legs on a side) and drawn from an sdf; its TEXTURE recipe (maps.js,
// SYSTEM.md "Texture on an sdf creature") gives what the mesh cannot: the black bands round the yellow abdomen, the fuzz of the thorax, the facets of the eyes and the veins of the wings.
// ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature { name, family, nav, body, abilities, mind }. Metres, +x to its left, +y up, +z forward.
const bones = [];
function run(parent, names, points, mirror) {
  names.forEach(function (name, i) {
    const b = { name: name, parent: i === 0 ? parent : names[i - 1], head: points[i], tail: points[i + 1] };
    if (mirror) b.mirror = "x";
    bones.push(b);
  });
}
run(null, ["body"], [[0, 0.13, -0.15], [0, 0.13, 0.07]]);
run("body", ["neck", "head"], [[0, 0.135, 0.07], [0, 0.14, 0.095], [0, 0.14, 0.17]]);
run("body", ["wing_l", "wing_tip_l"], [[0.02, 0.17, 0.03], [0.14, 0.18, 0.0], [0.25, 0.18, -0.05]], true);

// THE LEGS: three on a side, a short coxa, a femur that rises to the knee and a tibia that comes down to the floor
const joints = [{ bone: "neck", fwd: 30, back: 30, lat: 30, twist: 25 }, { bone: "head", fwd: 35, back: 35, lat: 40, twist: 30 }], chains = [{ name: "head", bones: ["neck", "head"] }];
[["1", 0.055, 0.5], ["2", 0.02, 0.0], ["3", -0.015, -0.5]].forEach(function (leg) {
  const id = leg[0], z = leg[1], fan = leg[2], dx = Math.cos(fan), dz = Math.sin(fan);
  const pts = [[0.022, 0.12, z], [0.022 + 0.035 * dx, 0.12, z + 0.035 * dz], [0.022 + 0.09 * dx, 0.19, z + 0.09 * dz], [0.022 + 0.17 * dx, 0.0, z + 0.17 * dz]];
  const names = ["coxa" + id + "_l", "femur" + id + "_l", "tibia" + id + "_l"];
  names.forEach(function (name, i) { bones.push({ name: name, parent: i === 0 ? "body" : names[i - 1], head: pts[i], tail: pts[i + 1], mirror: "x" }); });
  const axis = [-dz, 0, dx];
  joints.push({ bone: names[0], mirror: "x", fwd: 35, back: 35, up: 15, down: 20, twist: 5 });
  joints.push({ bone: names[1], mirror: "x", kind: "hinge", axis: axis, range: [-50, 70] });
  joints.push({ bone: names[2], mirror: "x", kind: "hinge", axis: axis, range: [-100, 40] });
  chains.push({ name: "leg" + id + "_l", mirror: "x", bones: names, pole: [0, 1, 0], pole_w: 1 });
});
const rig = { joints: joints, chains: chains };
const legs = { legs: [{ chain: "leg1_l", mirror: "x" }, { chain: "leg2_l", mirror: "x" }, { chain: "leg3_l", mirror: "x" }], gait: { speed: 0.8, stride: 0.15, swing: 0.45, step_height: 0.045 }, slots: 2 };
const roles = { hips: "body", neck: ["neck"], head: "head" };
const body = { max_speed: 2, accel: 4, turn_rate: 6, gravity: 9.8 };
// a bee HOVERS (it accelerates toward the speed it is asked for and stands in the air); its wings beat fast and small
const flight = { model: "hover", max_speed: 2.2, thrust: 1.6, max_bank: 0.5, max_pitch: 0.5, rate: 3, clearance: 0.12 };
const wings = { wings: [{ bone: "wing_l", tip: "wing_tip_l", mirror: "x" }], fold: 70, tip_fold: 20, droop: 6, amplitude: 28, tip_amplitude: 18, hz: 12, climb_hz: 3, speed_hz: 2, sink: 0.5, flare: 0.3 };

// SDF: a round yellow abdomen in two parts with a sting, a furry thorax, a dark head with big eyes, black legs and glassy wings
const YELLOW = [0.88, 0.66, 0.06, 1], FUZZ = [0.62, 0.45, 0.12, 1], BLACK = [0.05, 0.04, 0.03, 1], EYE = [0.04, 0.03, 0.03, 1], GLASS = [0.74, 0.78, 0.8, 1];
const parts = [
  { id: "abdomen_1", shape: "ellipsoid", center: [0, 0.125, -0.095], radii: [0.052, 0.052, 0.062], bone: "body", blend: 0.012, blend_mode: "cubic", color: YELLOW },
  { id: "abdomen_2", shape: "ellipsoid", center: [0, 0.12, -0.15], radii: [0.046, 0.046, 0.05], bone: "body", blend: 0.012, blend_mode: "cubic", color: YELLOW },
  { id: "sting", shape: "capsule", a: [0, 0.115, -0.195], b: [0, 0.108, -0.23], ra: 0.011, rb: 0.003, bone: "body", blend: 0.006, color: BLACK },
  { id: "thorax", shape: "ellipsoid", center: [0, 0.14, 0.025], radii: [0.052, 0.054, 0.056], bone: "body", blend: 0.014, blend_mode: "cubic", color: FUZZ },
  { id: "neck", shape: "loft", bones: ["neck"], radii: [0.024, 0.02], blend: 0.01, color: BLACK },
  { id: "skull", shape: "ellipsoid", center: [0, 0.14, 0.13], radii: [0.036, 0.036, 0.032], bone: "head", blend: 0.01, blend_mode: "cubic", color: BLACK },
  { id: "eye_l", shape: "ellipsoid", center: [0.027, 0.148, 0.14], radii: [0.018, 0.026, 0.022], bone: "head", mirror: "x", blend: 0.003, color: EYE },
  { id: "proboscis", shape: "capsule", a: [0, 0.126, 0.155], b: [0, 0.11, 0.19], radius: 0.006, bone: "head", blend: 0.006, color: BLACK },
  { id: "wing", shape: "loft", points: [[0.02, 0.17, 0.03], [0.14, 0.18, 0.0], [0.25, 0.18, -0.05]], radii: [0.012, 0.03, 0.016], radii_v: [0.0018, 0.0016, 0.0014], bone: "wing_l", mirror: "x", blend: 0.002, color: GLASS }
];
["1", "2", "3"].forEach(function (id) {
  parts.push(
    { id: "coxa" + id, shape: "loft", bones: ["coxa" + id + "_l"], radii: [0.014, 0.011], mirror: "x", blend: 0.008, color: BLACK },
    { id: "femur" + id, shape: "loft", bones: ["femur" + id + "_l"], radii: [0.011, 0.009], mirror: "x", blend: 0.006, color: BLACK },
    { id: "tibia" + id, shape: "loft", bones: ["tibia" + id + "_l"], radii: [0.008, 0.004], mirror: "x", blend: 0.006, color: BLACK });
});
const sdf = { cell: 0.005, adaptive: { min_cell: 0.002, max_cell: 0.01 }, decimate: { ratio: 0.12 }, skin: { falloff: 0.8 }, shade: { ao: 0.5, ao_radius: 0.02, tone: 0.2, color_blend: 0.15 }, parts: parts };

// TEXTURE: bands are read in the creature's own space (along z), so they run round the abdomen without a seam: black bands on the yellow, a fuzz on the abdomen and thorax, the facets of the eyes and the veins of the wings
const texture = { size: 256, seed: 9, layers: [
  { kind: "stripes", parts: ["abdomen_1", "abdomen_2"], axis: [0, 0, 1], period: 0.07, width: 0.4, offset: 0.2, colour: [0.04, 0.03, 0.02], wobble: 0.05, edge: 0.35, strength: 1 },
  { kind: "noise", parts: ["abdomen_*", "thorax", "skull"], scale: 0.005, amount: 0.45 },
  { kind: "noise", parts: ["thorax"], scale: 0.02, octaves: 2, colour: [0.25, 0.16, 0.05], threshold: 0.55, strength: 0.55, edge: 0.7 },
  { kind: "cells", parts: ["eye_*"], size: 0.006, line: 0.18, colour: [0.0, 0.0, 0.0], vary: 0.4, edge: 0.5 },
  { kind: "cells", parts: ["wing*"], size: 0.032, line: 0.06, colour: [0.25, 0.2, 0.15], strength: 0.75, vary: 0, edge: 0.4 },
  { kind: "noise", parts: ["coxa*", "femur*", "tibia*"], scale: 0.01, amount: 0.35 }
] };

return {
  name: "bee", max: 16,
  family: { faction: "animal", kind: "animal", hp: 8 },
  nav: { agent: "small" },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: body,
    roles: roles,
    flight: flight,
    wings: wings,
    physics: { mass: 0.05, shapes: [{ id: "hull", shape: "capsule", a: [0, 0.13, -0.12], b: [0, 0.14, 0.08], radius: 0.055, bone: "body" }] },
    sdf: sdf,
    texture: texture
  },
  abilities: ["fly", "walk", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 8 }],
      ["fly", { alt: 1.4, cruise: 1.6, climb: 1.2, sink: 0.9, legs: 3, min_leg: 6, roam: 12, near: 0.6, rest_min: 4, rest_max: 10 }]
    ],
    // THE WORKER: a creature declares its tree; the nodes of its blocks are put in it by name
    worker: function (api, ld) {
      var tree = { name: "bee", select: [ld.node("fly")] };
      return { tree: tree };
    }
  }
};
