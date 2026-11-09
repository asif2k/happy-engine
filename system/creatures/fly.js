"use strict";
// fly: a big blowfly, 0.3 m long, that WALKS on six legs and FLIES (a hover: it can stand in the air) and has SOFT TISSUE: the one creature of the folder that asks for tissue bones on an sdf body and on a flyer.
// ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature { name, family, nav, body, abilities, mind }. Metres, +x to its left, +y up, +z forward.
// It has a TEXTURE recipe too: the sdf gives the shape and the colour of its parts, the recipe gives what is finer than the mesh (below).
// The body is ONE bone ("body": the abdomen and the thorax are parts on it, as in the ant) with a neck and a head above it, so its trunk is a level one and the tissue kinds of a level trunk fit: the BELLY is the abdomen's
// soft underside, the HUMP the bulge of the thorax's back, the JOWL the fat of the face under the eyes. `tissue` is the definition's own request (system.species expands it: a soft bone each, the parts that stand on it grown out of
// the body: shape "grow", as proud of the skin as the mesher's own blend). The wings stand folded back in the bind pose of a bird's: spread along x, the worker folds and flaps them.
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

// THE LEGS: three on a side, a short coxa, a femur that rises to the knee and a tibia that comes down to the floor (the ant's, a little longer and under the thorax)
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
const legs = { legs: [{ chain: "leg1_l", mirror: "x" }, { chain: "leg2_l", mirror: "x" }, { chain: "leg3_l", mirror: "x" }], gait: { speed: 0.9, stride: 0.16, swing: 0.45, step_height: 0.05 }, slots: 2 };
const roles = { hips: "body", neck: ["neck"], head: "head" };
const body = { max_speed: 2, accel: 4, turn_rate: 6, gravity: 9.8 };
// a fly HOVERS (it accelerates toward the speed it is asked for and stands in the air); its wings beat fast and small
const flight = { model: "hover", max_speed: 2.5, thrust: 1.6, max_bank: 0.5, max_pitch: 0.5, rate: 3, clearance: 0.12 };
const wings = { wings: [{ bone: "wing_l", tip: "wing_tip_l", mirror: "x" }], fold: 70, tip_fold: 20, droop: 6, amplitude: 28, tip_amplitude: 18, hz: 12, climb_hz: 3, speed_hz: 2, sink: 0.5, flare: 0.3 };
// SOFT TISSUE: the belly, the hump and the jowls of a fat fly (a soft bone each: the engine's springs move them, SYSTEM.md "Tissue bones")
const tissue = ["belly", "hump", "jowl"];

// SDF: a blowfly's blue-green metallic abdomen in four bands, a grey thorax (its dark stripes are the texture's), a head that is nearly all red compound eye, a pale face, black bristly legs and thin glassy wings
const GREEN = [0.05, 0.28, 0.24, 1], DEEP = [0.03, 0.14, 0.15, 1], GREY = [0.34, 0.35, 0.33, 1], STRIPE = [0.08, 0.08, 0.08, 1], EYE = [0.55, 0.05, 0.04, 1], FACE = [0.78, 0.7, 0.5, 1], BLACK = [0.04, 0.04, 0.04, 1], GLASS = [0.72, 0.78, 0.8, 1];
const parts = [
  { id: "abdomen_1", shape: "ellipsoid", center: [0, 0.128, -0.1], radii: [0.046, 0.046, 0.055], bone: "body", blend: 0.012, blend_mode: "cubic", color: GREEN },
  { id: "abdomen_2", shape: "ellipsoid", center: [0, 0.126, -0.125], radii: [0.048, 0.048, 0.03], bone: "body", blend: 0.012, blend_mode: "cubic", color: DEEP },
  { id: "abdomen_3", shape: "ellipsoid", center: [0, 0.123, -0.15], radii: [0.04, 0.04, 0.03], bone: "body", blend: 0.012, blend_mode: "cubic", color: GREEN },
  { id: "abdomen_4", shape: "ellipsoid", center: [0, 0.12, -0.172], radii: [0.026, 0.026, 0.024], bone: "body", blend: 0.012, blend_mode: "cubic", color: DEEP },
  { id: "thorax", shape: "ellipsoid", center: [0, 0.14, 0.025], radii: [0.046, 0.05, 0.055], bone: "body", blend: 0.014, blend_mode: "cubic", color: GREY },
  { id: "neck", shape: "loft", bones: ["neck"], radii: [0.024, 0.02], blend: 0.01, color: GREY },
  { id: "skull", shape: "ellipsoid", center: [0, 0.14, 0.13], radii: [0.034, 0.036, 0.034], bone: "head", blend: 0.01, blend_mode: "cubic", color: FACE },
  { id: "eye_l", shape: "ellipsoid", center: [0.026, 0.15, 0.14], radii: [0.02, 0.026, 0.024], bone: "head", blend: 0.003, color: EYE },
  { id: "eye_r", shape: "ellipsoid", center: [-0.026, 0.15, 0.14], radii: [0.02, 0.026, 0.024], bone: "head", blend: 0.003, color: EYE },
  { id: "proboscis", shape: "capsule", a: [0, 0.125, 0.155], b: [0, 0.108, 0.185], radius: 0.007, bone: "head", blend: 0.006, color: BLACK },
];
// the wings: a thin glassy blade, wider toward its tip, and a dark vein along the front edge
parts.push({ id: "wing", shape: "loft", points: [[0.02, 0.17, 0.03], [0.14, 0.18, 0.0], [0.25, 0.18, -0.05]], radii: [0.012, 0.03, 0.016], radii_v: [0.0018, 0.0016, 0.0014], bone: "wing_l", mirror: "x", blend: 0.002, color: GLASS });
["1", "2", "3"].forEach(function (id) {
  parts.push(
    { id: "coxa" + id, shape: "loft", bones: ["coxa" + id + "_l"], radii: [0.014, 0.011], mirror: "x", blend: 0.008, color: GREY },
    { id: "femur" + id, shape: "loft", bones: ["femur" + id + "_l"], radii: [0.011, 0.009], mirror: "x", blend: 0.006, color: BLACK },
    { id: "tibia" + id, shape: "loft", bones: ["tibia" + id + "_l"], radii: [0.008, 0.004], mirror: "x", blend: 0.006, color: BLACK });
});
const sdf = { cell: 0.005, adaptive: { min_cell: 0.002, max_cell: 0.01 }, decimate: { ratio: 0.12 }, skin: { falloff: 0.8 }, shade: { ao: 0.5, ao_radius: 0.02, tone: 0.2, color_blend: 0.15 }, parts: parts };
// TEXTURE: the detail a mesh of 4,600 vertices cannot hold is a RECIPE (maps.js, SYSTEM.md "Texture on an sdf creature"): bakes into a colour map and a packed map (256 x 256) when the species is made, the same bytes every time. The thorax's dark stripes
// (they were two ellipsoids on the thorax), the bloom of the abdomen and its pale underside, the facets of the compound eyes, the veins of the wings and a dusting on the legs
const texture = { size: 256, seed: 5, layers: [
  { kind: "noise", parts: ["thorax", "neck", "skull"], scale: 0.009, amount: 0.3 },
  { kind: "stripes", parts: ["thorax"], axis: [1, 0, 0], period: 0.026, width: 0.3, colour: [0.07, 0.07, 0.07], wobble: 0.12, edge: 0.45 },
  { kind: "noise", parts: ["abdomen*"], scale: 0.012, amount: 0.35 },
  { kind: "noise", parts: ["abdomen*"], scale: 0.022, octaves: 2, colour: [0.08, 0.5, 0.38], threshold: 0.55, strength: 0.55, edge: 0.7, roughness: 0.3, metal: 0.35 },
  { kind: "gradient", parts: ["abdomen*"], by: "normal", axis: [0, -1, 0], from: 0.35, to: 0.85, colour: [0.5, 0.47, 0.34], strength: 0.85 },
  { kind: "cells", parts: ["eye_*"], size: 0.0065, line: 0.17, colour: [0.16, 0.01, 0.01], vary: 0.3, edge: 0.5 },
  { kind: "cells", parts: ["wing*"], size: 0.032, line: 0.06, colour: [0.22, 0.17, 0.12], strength: 0.75, vary: 0, edge: 0.4 },
  { kind: "noise", parts: ["coxa*", "femur*", "tibia*"], scale: 0.01, amount: 0.35 }
] };
const physics = { mass: 0.04, shapes: [{ id: "hull", shape: "capsule", a: [0, 0.13, -0.12], b: [0, 0.14, 0.08], radius: 0.05, bone: "body" }] };

const variants = {
  dyes: { abdomen: { parts: ["abdomen_1", "abdomen_2", "abdomen_3", "abdomen_4"], palette: [[0.05, 0.28, 0.24], [0.35, 0.2, 0.04], [0.12, 0.12, 0.14]] } },
  looks: { blowfly: { abdomen: 0 }, honey: { abdomen: 1 }, black: { abdomen: 2 } }
};

return {
  name: "fly", max: 16,
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
    physics: physics,
    sdf: sdf,
    texture: texture,
    variants: variants,
    tissue: tissue
  },
  abilities: ["fly", "walk", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 8 }],
      ["fly", { alt: 1.6, cruise: 1.8, climb: 1.2, sink: 0.9, legs: 3, min_leg: 6, roam: 14, near: 0.6, rest_min: 4, rest_max: 10 }]
    ],
    // THE WORKER: a creature declares its tree; the nodes of its blocks are put in it by name
    worker: function (api, ld) {
      var tree = { name: "fly", select: [ld.node("fly")] };
      return { tree: tree };
    }
  }
};
