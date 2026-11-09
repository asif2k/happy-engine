"use strict";
// bird: in soma's one form of a creature file (soma/creature_file.js): `body` is the creature as it was made, the rest is who it is to the others (family, nav, abilities) and its mind: the blocks of soma/world/blocks/ it loads by name and
// its tree. The old worker of this file is left out; the mind below is the default of a creature of its kind (flyer): write the creature's own in `mind`.
// bird: a small bird, 0.3 m tall and 0.7 m across the wings. ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature { name, skeleton, rig, legs, body, flight, wings }.
// Metres, +x to its left, +y up, +z forward (the bind pose: the wings spread out along x, the feet on the floor). A bird WALKS (two legs, the engine's `limb` solver on each, the gait of a small bird) and FLIES: the body's
// `gravity` is the g of its turns, `flight` a wing (it cannot hang in the air: it flies at its stall speed or more and turns by banking), `wings` the two wings that the worker flaps and folds (the inner wing and the
// tip of each: no joint of the rig, the worker poses them; a standing bird has them folded back along its body, a flying one spreads and beats them). The legs hang under it in the air.
const bones = [];
function run(parent, names, points, mirror) {
  names.forEach(function (name, i) {
    const b = { name: name, parent: i === 0 ? parent : names[i - 1], head: points[i], tail: points[i + 1] };
    if (mirror) b.mirror = "x";
    bones.push(b);
  });
}
run(null, ["body"], [[0, 0.19, -0.09], [0, 0.19, 0.09]]);
run("body", ["neck", "head"], [[0, 0.20, 0.09], [0, 0.27, 0.14], [0, 0.275, 0.21]]);
run("body", ["tail"], [[0, 0.19, -0.09], [0, 0.17, -0.25]]);
run("body", ["wing_l", "wing_tip_l"], [[0.035, 0.22, 0.02], [0.20, 0.22, 0.02], [0.37, 0.22, -0.03]], true);
run("body", ["thigh_l", "shin_l", "foot_l"], [[0.03, 0.18, 0.0], [0.03, 0.11, 0.025], [0.03, 0.025, -0.005], [0.03, 0.01, 0.05]], true);
// THE FACE (soma/SOMA.md "Authoring a face"): the eyes (an eye looks along its bone: the head at the eyeball's centre, the tail the way it looks, out to the side and a little forward; a bird turns its eyes only a little,
// its head does the looking) and the lower half of the beak (the jaw: its hinge at the base of the beak, its tail at the tip; it opens downward about the model's x)
bones.push({ name: "eye_l", parent: "head", head: [0.0285, 0.284, 0.186], tail: [0.0394, 0.2853, 0.1927], mirror: "x" });
bones.push({ name: "jaw", parent: "head", head: [0, 0.269, 0.196], tail: [0, 0.266, 0.236] });

const rig = {
  joints: [
    { bone: "neck", fwd: 45, back: 45, lat: 45, twist: 40 },
    { bone: "head", fwd: 40, back: 40, lat: 45, twist: 40 },
    { bone: "thigh_l", mirror: "x", fwd: 80, back: 40, out: 25, in: 20, twist: 20 },
    { bone: "shin_l", mirror: "x", kind: "hinge", axis: [1, 0, 0], range: [-10, 120] },
    { bone: "foot_l", mirror: "x", fwd: 40, back: 40, lat: 15, twist: 15 },
    { bone: "eye_l", mirror: "x", kind: "ball", fwd: 15, back: 15, lat: 20, twist: [-5, 5] },
    { bone: "jaw", kind: "hinge", axis: [1, 0, 0], range: [-3, 30] },
  ],
  chains: [
    { name: "head", bones: ["neck", "head"] },
    { name: "leg_l", mirror: "x", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0, 0, 1], pole_w: 1 },
  ],
};
const legs = { legs: [{ chain: "leg_l", mirror: "x" }], gait: { speed: 0.35, stride: 0.09, swing: 0.45, step_height: 0.03, crouch: 0.01, bob: 0.004 } };
const body = { max_speed: 0.9, accel: 2, turn_rate: 5, gravity: 9.8 };
const roles = { hips: "body", neck: ["neck"], head: "head" };
// THE FACE: the roles of its eyes and its beak (soma 2.0's spelling: soma/SOMA.md "Authoring a face"), written into its roles on the next line (soma_face.cpp plays them)
const face = { eyes: [{ bone: "eye_l", yaw: 20, pitch: 15 }, { bone: "eye_r", yaw: 20, pitch: 15 }], jaw: { bone: "jaw", max: 30 } };
Object.assign(roles, face);                 // THE FACE in roles (soma/tools/face_roles.js)
// (a wing: it cruises at 6 m/s, the stall is 4: a bird of this size; it flaps from a pivot at the middle of its body)
const flight = { model: "wing", stall_speed: 4, cruise_speed: 6, max_speed: 10, thrust: 0.5, max_bank: 1.0, max_pitch: 0.7, pivot: 0.2, clearance: 0.3 };
const wings = { wings: [{ bone: "wing_l", tip: "wing_tip_l", mirror: "x" }], fold: 80, tip_fold: 25, droop: 10, amplitude: 35, tip_amplitude: 25, hz: 3, climb_hz: 2, speed_hz: 1, sink: 1.2, flare: 0.5 };
// SDF: what the mesh is made of (the mesher's grammar: soma/SOMA_MESHER.md; the parts stand on the bones above by name, a part on a _l bone with `mirror: "x"` also makes the _r twin). A swallow: a steel blue back, a
// chestnut throat and forehead, a buff belly, a forked tail with two long streamers, long narrow wings. The body is one plump skin (cubic blends of 2 cm: the breast and the back are two ellipsoids of two colours that
// cross on the flank); a FEATHER is a flat loft that tapers to a round tip (a loft ends in a cap as deep as its thinnest radius, so a feather is thinner than it is wide and narrows at both ends) and is a hard piece of its own (a
// 3 mm blend: the feathers stay separate like fingers where they overlap, and each one is skinned to the bone it stands on). The WINGS are made for the bind pose that the worker starts from (spread along +x) AND for the fold: the
// secondaries (on the inner wing) point 50 (at the body) to 33 degrees (at the wrist) back of the arm and the primaries (on the tip) 30 to 8, 25 degrees less than the secondaries, so that after the fold of 80 and 25 degrees the two
// rows lie parallel along the body, as they do on a closed wing; a pale lining under each wing shows from below. The face (the beak and the eyes: small and of other colours) is an ISLAND on a grid of its own, crisp on the head.
// The legs are thin: a feathered thigh, a bare shin and three toes forward and one back (the soles on y = 0). The octree (`adaptive`: 2 mm where there is a feather, 8 mm on the body) and a strong `decimate` (flat feathers
// collapse to a few triangles) make it 6 k vertices.
const BLUE = [0.07, 0.16, 0.40, 1], DEEP = [0.06, 0.11, 0.27, 1], SLATE = [0.13, 0.16, 0.24, 1], BELLY = [0.93, 0.81, 0.63, 1], CHEST = [0.62, 0.21, 0.10, 1], BEAK = [0.05, 0.045, 0.04, 1], LEG = [0.30, 0.23, 0.20, 1], UNDER = [0.66, 0.62, 0.58, 1], EYE = [0.02, 0.02, 0.02, 1];
const D2R = Math.PI / 180;
const parts = [];
// a feather: a flat loft from `root` along the direction `theta` degrees back of +x (in the plane of the wing) for `len` metres, `w` wide at its widest and `th` thick; (it ends on a rounded tip)
function feather(id, bone, root, theta, len, w, th, color, blend) {
  const c = Math.cos(theta * D2R), s = Math.sin(theta * D2R);
  const at = function (t) { return [root[0] + c * len * t, root[1], root[2] - s * len * t]; };
  return { id: id, shape: "loft", points: [at(0), at(0.45), at(1)], radii: [w * 0.5, w, w * 0.42], radii_v: [th, th, th], bone: bone, mirror: "x", blend: blend === undefined ? 0.003 : blend, color: color };
}
// the trunk: a breast and belly (buff) and a back (blue) that cross on the flank, a rump that runs into the tail
parts.push({ id: "belly", shape: "ellipsoid", center: [0, 0.183, 0.0], radii: [0.052, 0.054, 0.108], bone: "body", blend: 0.02, blend_mode: "cubic", color: BELLY });
parts.push({ id: "breast", shape: "ellipsoid", center: [0, 0.19, 0.062], radii: [0.053, 0.06, 0.056], bone: "body", blend: 0.02, blend_mode: "cubic", color: BELLY });
parts.push({ id: "back", shape: "ellipsoid", center: [0, 0.203, -0.012], radii: [0.051, 0.045, 0.105], bone: "body", blend: 0.02, blend_mode: "cubic", color: BLUE });
parts.push({ id: "rump", shape: "ellipsoid", center: [0, 0.185, -0.098], radii: [0.034, 0.03, 0.05], bone: "body", blend: 0.02, blend_mode: "cubic", color: BLUE });
// the neck, the head, the chestnut forehead and throat (a swallow's), the shoulders
parts.push({ id: "neck", shape: "loft", bones: ["neck"], radii: [0.044, 0.028], blend: 0.02, blend_mode: "cubic", color: BLUE });
parts.push({ id: "skull", shape: "ellipsoid", center: [0, 0.278, 0.172], radii: [0.037, 0.035, 0.039], bone: "head", blend: 0.015, blend_mode: "cubic", color: BLUE });
parts.push({ id: "forehead", shape: "ellipsoid", center: [0, 0.288, 0.196], radii: [0.024, 0.021, 0.018], bone: "head", blend: 0.006, blend_mode: "cubic", color: CHEST });
parts.push({ id: "throat", shape: "ellipsoid", center: [0, 0.252, 0.178], radii: [0.026, 0.02, 0.03], bone: "head", blend: 0.008, blend_mode: "cubic", color: CHEST });
parts.push({ id: "bib", shape: "ellipsoid", center: [0, 0.238, 0.136], radii: [0.025, 0.022, 0.018], bone: "neck", blend: 0.01, blend_mode: "cubic", color: CHEST });
// the face: a beak (flat and wide at its base, like a swallow's) and the eyes, on an island of their own
// (the beak is two halves: the upper on the head, the lower an island of its own on the jaw, so that it opens clean; the eyes and their glints are on the eye bones)
parts.push({ id: "beak", shape: "loft", points: [[0, 0.2735, 0.198], [0, 0.2715, 0.221], [0, 0.2695, 0.238]], radii: [0.0125, 0.008, 0.003], radii_v: [0.0052, 0.0033, 0.0021], bone: "head", island: "face", color: BEAK });
parts.push({ id: "beak_low", shape: "loft", points: [[0, 0.2695, 0.199], [0, 0.2675, 0.219], [0, 0.2662, 0.233]], radii: [0.0115, 0.0072, 0.0026], radii_v: [0.0046, 0.003, 0.002], bone: "jaw", island: "beak", color: BEAK });
parts.push({ id: "eye_l", shape: "sphere", center: [0.0285, 0.284, 0.186], radius: 0.0085, bone: "eye_l", mirror: "x", island: "face", color: EYE });
parts.push({ id: "glint_l", shape: "sphere", center: [0.0345, 0.2885, 0.1915], radius: 0.002, bone: "eye_l", mirror: "x", island: "face", color: [1, 1, 1, 1] });
// the tail: five feathers a side that fan out (the outer one is a long streamer: the fork)
[[0, 0.105, 0.017], [5, 0.11, 0.0165], [10, 0.12, 0.0155], [15, 0.14, 0.0125], [20, 0.205, 0.0075]].forEach(function (f, i) {
  const a = f[0] * D2R, len = f[1], dir = [Math.sin(a), -0.09, -Math.cos(a)];
  const at = function (t) { return [dir[0] * len * t, 0.186 + dir[1] * len * t, -0.095 + dir[2] * len * t]; };
  const p = { id: "rectrix_" + i, shape: "loft", points: [at(0), at(0.45), at(1)], radii: [f[2] * 0.5, f[2], f[2] * 0.45], radii_v: [0.0028, 0.0028, 0.0028], bone: "tail", blend: 0.003, color: i === 4 ? SLATE : DEEP };
  if (i > 0) p.mirror = "x";
  parts.push(p);
});
// the wings: the shoulder, a slim arm along the leading edge, the flight feathers behind it (the secondaries on the inner wing, the primaries that fan out of the hand on the tip) and a row of short blue coverts on top of their bases
parts.push({ id: "shoulder_l", shape: "sphere", center: [0.04, 0.222, 0.016], radius: 0.021, bone: "wing_l", mirror: "x", blend: 0.012, blend_mode: "cubic", color: BLUE });
parts.push({ id: "arm", shape: "loft", bones: ["wing_l"], radii: [0.0145, 0.0105], radii_v: [0.0145, 0.0095], mirror: "x", blend: 0.006, color: BLUE });
parts.push({ id: "hand", shape: "loft", bones: ["wing_tip_l"], radii: [0.0105, 0.005], radii_v: [0.0095, 0.0045], mirror: "x", blend: 0.004, color: BLUE });
for (let i = 0; i < 8; i++) {                         // the secondaries: from the body to the wrist, 50 degrees back of the arm at the body and 33 at the wrist; the trailing edge runs back as it goes out
  const rx = 0.05 + 0.0205 * i, th = 50 - 2.5 * i, zend = -0.056 - 0.0025 * i;
  parts.push(feather("secondary_" + i, "wing_l", [rx, 0.222, 0.004], th, (0.004 - zend) / Math.sin(th * D2R), 0.0135, 0.0028, SLATE));
}
[[0.02, 30, 0.300], [0.12, 26, 0.322], [0.22, 22, 0.345], [0.32, 18, 0.366], [0.42, 14, 0.38], [0.52, 11, 0.388], [0.62, 8, 0.384]].forEach(function (f, i) {
  const rx = 0.2 + 0.17 * f[0], rz = 0.006 - 0.05 * f[0], c = Math.cos(f[1] * D2R);        // the primaries: out of the hand, 30 degrees back of the arm for the first and 8 for the last: a fan whose tips make the pointed end of the wing
  parts.push(feather("primary_" + i, "wing_tip_l", [rx, 0.222, rz], f[1], (f[2] - rx) / c, 0.0115, 0.0028, SLATE));
});
for (let i = 0; i < 7; i++) parts.push(feather("covert_" + i, "wing_l", [0.055 + 0.021 * i, 0.2255, 0.011], 54 - 3 * i, 0.045, 0.0125, 0.0032, BLUE));        // the greater coverts: short blue feathers over the roots of the flight feathers
for (let j = 0; j < 4; j++) { const t = 0.05 + 0.17 * j; parts.push(feather("covert_h" + j, "wing_tip_l", [0.2 + 0.17 * t, 0.2255, 0.012 - 0.05 * t], 26 - 5 * j, 0.05 - 0.005 * j, 0.0105, 0.0032, BLUE)); }
// the underwing: a pale lining along the front of each wing, a little under the flight feathers (it shows from below, in flight)
parts.push({ id: "lining_in", shape: "loft", points: [[0.05, 0.2185, 0.008], [0.12, 0.2185, 0.0], [0.195, 0.2185, -0.004]], radii: [0.016, 0.024, 0.024], radii_v: [0.0035, 0.0035, 0.0035], bone: "wing_l", mirror: "x", blend: 0.004, color: UNDER });
parts.push({ id: "lining_out", shape: "loft", points: [[0.2, 0.2185, -0.004], [0.27, 0.2185, -0.012], [0.335, 0.2185, -0.025]], radii: [0.022, 0.016, 0.0075], radii_v: [0.0035, 0.0035, 0.0035], bone: "wing_tip_l", mirror: "x", blend: 0.004, color: UNDER });
// the legs: a feathered thigh and knee, a thin bare shin, three toes forward and one back, the tips of the toes on y = 0
parts.push({ id: "thigh", shape: "loft", bones: ["thigh_l"], radii: [0.024, 0.0135], mirror: "x", blend: 0.012, blend_mode: "cubic", color: BELLY });
parts.push({ id: "knee", shape: "sphere", center: [0.03, 0.11, 0.025], radius: 0.0125, bone: "shin_l", mirror: "x", blend: 0.01, blend_mode: "cubic", color: BELLY });
parts.push({ id: "shin", shape: "loft", bones: ["shin_l"], radii: [0.0075, 0.0045], mirror: "x", blend: 0.005, color: LEG });
parts.push({ id: "ankle", shape: "sphere", center: [0.03, 0.024, -0.005], radius: 0.0055, bone: "foot_l", mirror: "x", blend: 0.004, color: LEG });
parts.push({ id: "toe_mid", shape: "loft", points: [[0.03, 0.021, -0.004], [0.03, 0.0095, 0.025], [0.03, 0.0032, 0.056]], radii: [0.0055, 0.004, 0.003], bone: "foot_l", mirror: "x", blend: 0.004, color: LEG });
parts.push({ id: "toe_out", shape: "loft", points: [[0.03, 0.021, -0.004], [0.041, 0.0095, 0.022], [0.0505, 0.0032, 0.047]], radii: [0.005, 0.0038, 0.003], bone: "foot_l", mirror: "x", blend: 0.004, color: LEG });
parts.push({ id: "toe_in", shape: "loft", points: [[0.03, 0.021, -0.004], [0.019, 0.0095, 0.022], [0.0095, 0.0032, 0.047]], radii: [0.005, 0.0038, 0.003], bone: "foot_l", mirror: "x", blend: 0.004, color: LEG });
parts.push({ id: "toe_back", shape: "loft", points: [[0.03, 0.019, -0.008], [0.03, 0.009, -0.022], [0.03, 0.0032, -0.036]], radii: [0.005, 0.0038, 0.003], bone: "foot_l", mirror: "x", blend: 0.004, color: LEG });
const sdf = {
  cell: 0.004, adaptive: { min_cell: 0.002, max_cell: 0.008 }, decimate: { ratio: 0.11 },
  islands: { face: { cell: 0.002, adaptive: false, decimate: { ratio: 0.35 } }, beak: { cell: 0.0016, adaptive: false, decimate: { ratio: 0.35 } } },
  skin: { falloff: 1.5 }, shade: { ao: 0.4, ao_radius: 0.012, tone: 0.15, color_blend: 0.35 }, parts: parts,
};
// PHYSICS: the creature in the physics world (soma_phys.cpp, js/shapes.js): a capsule for the body and a ball for the head, on their bones; 0.12 kg (the wings are no shape: they beat through what a crate would meet)
const physics = { mass: 0.12, shapes: [
  { id: "body", shape: "capsule", a: [0, 0.19, -0.05], b: [0, 0.19, 0.06], radius: 0.055, bone: "body" },
  { id: "head", shape: "sphere", center: [0, 0.275, 0.18], radius: 0.04, bone: "head" },
] };

// The birds of a flock differ in their plumage (the blue feathers: the flight feathers, the coverts, the wing, the back, the neck, the head) and in the colour of their underside (the breast, the belly, the thighs). The throat, the
// forehead, the beak, the legs and the eyes stay as they are. `looks` is the LIST a spawn picks from: sp.spawn({ variant: 3 }) is a red one (a number is taken round the list; a name does as well), sp.spawn({ seed }) picks one by a seed.
const FEATHERS = ["primary_0", "primary_1", "primary_2", "primary_3", "primary_4", "primary_5", "primary_6", "secondary_0", "secondary_1", "secondary_2", "secondary_3", "secondary_4", "secondary_5", "secondary_6", "secondary_7",
  "rectrix_0", "rectrix_1", "rectrix_2", "rectrix_3", "rectrix_4", "covert_0", "covert_1", "covert_2", "covert_3", "covert_4", "covert_5", "covert_6", "covert_h0", "covert_h1", "covert_h2", "covert_h3",
  "arm", "hand", "shoulder_l", "back", "neck", "rump", "skull"];
// TEXTURE (maps.js, SYSTEM.md "Texture on an sdf creature"): a recipe baked into a colour map and a packed map (256 x 256) when the species is made. Scalloped feathers on the back and the wing, bars across the flight feathers and the tail,
// fine down on the breast, scales on the legs, a glossy beak. The dyes of `variants` multiply it, so every plumage keeps the same feathers.
const texture = { size: 256, seed: 31, layers: [
  {kind: "noise", parts: ["belly","breast","throat","bib","thigh"], scale: 0.006, amount: 0.25},
  {kind: "cells", parts: ["back","rump","covert_*","arm","hand","shoulder_l","neck","skull"], size: 0.012, line: 0.18, colour: [0.03,0.06,0.15], vary: 0.3, edge: 0.5, strength: 0.6},
  {kind: "stripes", parts: ["primary_*","secondary_*","rectrix_*"], axis: [0,0,1], period: 0.02, width: 0.22, colour: [0.03,0.05,0.12], wobble: 0.1, edge: 0.5, strength: 0.55},
  {kind: "cells", parts: ["shin","ankle","toe_*"], size: 0.004, line: 0.2, colour: [0.12,0.08,0.05], edge: 0.4, strength: 0.6},
  {kind: "fill", parts: ["beak","beak_low"], roughness: 0.3, metal: 0.05}
] };
const variants = {
  dyes: {
    plumage: { parts: FEATHERS, palette: [[0.08, 0.16, 0.40], [0.10, 0.36, 0.16], [0.32, 0.33, 0.35], [0.55, 0.10, 0.07], [0.62, 0.50, 0.10], [0.06, 0.06, 0.07]] },
    underside: { parts: ["breast", "belly", "thigh"], palette: [[0.85, 0.75, 0.60], [0.93, 0.92, 0.88], [0.62, 0.40, 0.20]] }
  },
  looks: { blue: { plumage: 0, underside: 0 }, green: { plumage: 1, underside: 0 }, grey: { plumage: 2, underside: 1 }, red: { plumage: 3, underside: 2 }, gold: { plumage: 4, underside: 1 }, black: { plumage: 5, underside: 0 } }
};

return {
  name: "bird", max: 16,
  family: { faction: "animal", kind: "animal", hp: 20 },
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
    variants: variants
  },
  abilities: ["fly", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 20 }],
      ["fly", { alt: 8, cruise: 6, climb: 2.4, sink: 1.8, legs: 3, min_leg: 15, roam: 60, near: 3.6, rest_min: 8, rest_max: 20 }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first; the blocks without a node (health, needs, injured) act through their hooks.
    worker: function (api, ld) {
      var tree = { name: "bird", select: [ld.node("fly")] };
      return { tree: tree };
    }
  }
};
