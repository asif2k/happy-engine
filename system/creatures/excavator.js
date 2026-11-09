"use strict";
// excavator: in soma's one form of a creature file (soma/creature_file.js): the body is the creature as it was made, the mind is the blocks of soma/world/blocks/ it loads and its tree.
// A tracked excavator at work: the cab swings, the boom, the stick and the bucket dig, lift and tip, one pose after the other.
// excavator: a tracked excavator, 5 m long, 3.2 m high. ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature { name, skeleton, rig }.
// Metres, +x to its left, +y up, +z forward. A machine, not an animal: its joints are HINGES with the range of a hydraulic ram (the boom, the stick and the bucket turn about x and nothing else), the turntable is a
// joint that only twists (a ball with no swing at all), and the arm is a FABRIK chain of the three of them: a target that the bucket's teeth are asked to reach is reached if the arm can, and the hinges' ranges are
// never exceeded. The turntable is turned by the page (sp.pose(c, "cab", { ry })): the arm's chain works in the cab's frame, so it digs where the cab faces.
const bones = [
  { name: "hull", head: [0, 0.9, 0], tail: [0, 1.0, 0.5] },
  { name: "cab", parent: "hull", head: [0, 1.3, 0], tail: [0, 2.3, 0] },                         // (the turntable: a vertical bone that twists)
  { name: "boom", parent: "cab", head: [0, 1.65, 1.15], tail: [0, 3.95, 4.55] },
  { name: "stick", parent: "boom", head: [0, 3.95, 4.55], tail: [0, 2.35, 6.45] },
  { name: "bucket", parent: "stick", head: [0, 2.35, 6.45], tail: [0, 1.45, 7.15] },
];
const rig = {
  joints: [
    { bone: "cab", kind: "ball", fwd: 0, back: 0, lat: 0, twist: 180 },                          // the turntable slews: it turns about its own axis, it does not tilt
    { bone: "boom", kind: "hinge", axis: [1, 0, 0], range: [-41, 44] },                         // (0 is the bind pose, the boom 34 degrees above the horizontal: it goes up to 75 and down to -10)
    { bone: "stick", kind: "hinge", axis: [1, 0, 0], range: [-60, 100] },
    { bone: "bucket", kind: "hinge", axis: [1, 0, 0], range: [-70, 70] },
  ],
  chains: [
    { name: "arm", bones: ["boom", "stick", "bucket"] },                                          // (its end is the teeth of the bucket)
  ],
};

// SDF: what the mesh is made of (the mesher's grammar: soma/SOMA_MESHER.md; the bones are the skeleton above, a part stands on one by name). A MACHINE, not a body: every group of parts that moves as one is an ISLAND
// (a part with `island: "name"` melts into the parts of that island only), so a link keeps its shape whatever the arm does and its skin weight is its bone's alone: nothing stretches or tears at a hinge. What hides
// the gap that a turn opens at a hinge is a PIN, a cylinder whose axis is the hinge's (it looks the same turned), and the links' round ends turn about the same point. The islands: under (the hull bone: carbody, tracks),
// upper (the cab bone: deck, counterweight, hood, tank, cab), boom, stick, bucket (their own bones) and one for each hydraulic cylinder. A cylinder is the one place where two bones meet in a part: its body is on the bone that
// holds it and its rod on the bone it moves, and a rod that is rigid on a bone that turns about another point than the body's would part from the body at any angle: the two halves have a `blend` and the skin's falloff
// (8: the weights of a part change over its blend times that) lets their weights mix over a stretch of the cylinder, so it BENDS a little to stay joined at both ends instead of coming apart (the cost: two influences a vertex
// for the cylinders). Windows are `subtract` boxes (a pocket in the cab) with a pane of glass in them. The mesh is 11 k vertices: a grid of 3 cm (2 to 2.5 cm for the bucket, the cylinders and the cab), then the quadric
// decimation of each island (flat plates of a machine collapse to a few triangles; `error` says how far the surface may move), no soft colours (`color_blend` 0: a pane keeps its own colour inside a pocket).
const YELLOW = [1.0, 0.82, 0.10, 1], YELLOW_D = [0.90, 0.68, 0.07, 1], BLACK = [0.05, 0.05, 0.06, 1], TRACK = [0.10, 0.10, 0.11, 1], TRACK_L = [0.17, 0.17, 0.18, 1], DARK = [0.20, 0.21, 0.23, 1], STEEL = [0.66, 0.68, 0.72, 1], CHROME = [0.86, 0.87, 0.89, 1], GLASS = [0.14, 0.24, 0.32, 1], LAMP = [1.0, 0.94, 0.72, 1], BUCKET = [0.42, 0.43, 0.46, 1], RED = [0.75, 0.08, 0.06, 1];
const BP = [0, 2.35, 6.45], BA = [0, -0.789, 0.614], BV = [0, 0.614, 0.789];                       // (the bucket's pin, its axis toward the teeth, its back)
const B = function (s, w, x) { return [x || 0, BP[1] + BA[1] * s + BV[1] * w, BP[2] + BA[2] * s + BV[2] * w]; };
const S = function (s, w, x) { return B(0.85 * s, w, x); };                                      // (the scoop: a bucket 0.9 m deep, the teeth reach the rest of the way to the bone's tail)
// a smooth curve through key points (arrays of numbers: Catmull-Rom, every component alike), sampled n times: a plate that bends is a loft of many short pieces, so that the bends between them do not show
const spline = function (keys, n) {
  const out = [], last = keys.length - 1;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) * last, k = Math.min(last - 1, Math.floor(u)), t = u - k, p0 = keys[Math.max(0, k - 1)], p1 = keys[k], p2 = keys[k + 1], p3 = keys[Math.min(last, k + 2)];
    out.push(p1.map(function (v, c) { return 0.5 * (2 * v + (p2[c] - p0[c]) * t + (2 * p0[c] - 5 * v + 4 * p2[c] - p3[c]) * t * t + (3 * v - p0[c] - 3 * p2[c] + p3[c]) * t * t * t); }));
  }
  return out;
};
const BACK = spline([[0.0, 0.14, 0.45], [0.3, 0.40, 0.57], [0.6, 0.50, 0.59], [0.9, 0.26, 0.59], [1.05, 0.05, 0.57]], 9);                   // (s, w, half width) of the back plate
const CHEEK = spline([[0.05, 0.05, 0.16], [0.3, 0.07, 0.35], [0.6, 0.11, 0.41], [0.9, 0.04, 0.24], [1.05, 0.0, 0.06]], 9);              // (s, w, half height) of a cheek
const RIB = spline([[0.25, 0.37], [0.4, 0.5], [0.6, 0.58], [0.9, 0.34], [1.03, 0.12]], 9);                                                // (s, w) of a rib on the back plate
const parts = [
  // THE UNDERCARRIAGE (the hull bone: it does not move): the carbody, the ring the turntable turns on, and a track each side: a dark band with a yellow frame on its side, a sprocket behind, an idler in front, rollers
  { id: "carbody", shape: "box", center: [0, 0.78, 0], half: [1.0, 0.3, 1.4], round: 0.1, bone: "hull", island: "under", blend: 0.03, color: YELLOW_D },
  { id: "ring", shape: "cylinder", center: [0, 1.2, 0], axis: "y", radius: 1.05, half: 0.14, round: 0.03, bone: "hull", island: "under", color: DARK },
  { id: "track", shape: "box", center: [1.25, 0.47, 0], half: [0.3, 0.47, 1.83], round: 0.04, bone: "hull", island: "under", mirror: "x", color: TRACK },
  { id: "track_end", shape: "cylinder", center: [1.25, 0.47, 1.83], axis: "x", radius: 0.47, half: 0.3, round: 0.04, bone: "hull", island: "under", mirror: "xz", color: TRACK },
  { id: "frame", shape: "box", center: [1.585, 0.47, 0], half: [0.035, 0.36, 1.83], bone: "hull", island: "under", mirror: "x", color: YELLOW_D },
  { id: "frame_end", shape: "cylinder", center: [1.585, 0.47, 1.83], axis: "x", radius: 0.36, half: 0.035, bone: "hull", island: "under", mirror: "xz", color: YELLOW_D },
  { id: "sprocket", shape: "cylinder", center: [1.25, 0.47, -1.83], axis: "x", radius: 0.3, half: 0.41, round: 0.03, bone: "hull", island: "under", mirror: "x", color: STEEL },
  { id: "idler", shape: "cylinder", center: [1.25, 0.47, 1.83], axis: "x", radius: 0.3, half: 0.41, round: 0.03, bone: "hull", island: "under", mirror: "x", color: STEEL },
  { id: "hub", shape: "cylinder", center: [1.25, 0.47, 1.83], axis: "x", radius: 0.12, half: 0.43, round: 0.02, bone: "hull", island: "under", mirror: "xz", color: DARK },
  { id: "roller", shape: "cylinder", center: [1.25, 0.2, 0.0], axis: "x", radius: 0.15, half: 0.4, round: 0.02, bone: "hull", island: "under", mirror: "x", color: STEEL },
  { id: "roller_f", shape: "cylinder", center: [1.25, 0.2, 0.62], axis: "x", radius: 0.15, half: 0.4, round: 0.02, bone: "hull", island: "under", mirror: "xz", color: STEEL },
  { id: "roller_ff", shape: "cylinder", center: [1.25, 0.2, 1.24], axis: "x", radius: 0.15, half: 0.4, round: 0.02, bone: "hull", island: "under", mirror: "xz", color: STEEL },
  // THE UPPER STRUCTURE (the cab bone: it turns with the turntable): the deck, the counterweight, the engine hood, a tank, the cab with its windows and roof, the brackets of the boom
  { id: "deck", shape: "box", center: [0, 1.45, -0.2], half: [1.4, 0.1, 1.7], round: 0.05, bone: "cab", island: "upper", blend: 0.03, color: YELLOW_D },
  { id: "counterweight", shape: "box", center: [0, 1.9, -1.55], half: [1.3, 0.55, 0.45], round: 0.3, bone: "cab", island: "upper", blend: 0.04, color: YELLOW },
  { id: "tail_stripe", shape: "box", center: [0, 2.12, -2.02], half: [0.8, 0.07, 0.05], round: 0.02, bone: "cab", island: "upper", color: BLACK },
  { id: "tail_lamp", shape: "box", center: [0.8, 1.72, -2.01], half: [0.12, 0.07, 0.06], round: 0.02, bone: "cab", island: "upper", mirror: "x", color: RED },
  { id: "vent", shape: "box", center: [-0.45, 2.47, -1.0], half: [0.65, 0.03, 0.05], round: 0.01, bone: "cab", island: "upper", color: BLACK },
  { id: "vent_2", shape: "box", center: [-0.45, 2.47, -0.7], half: [0.65, 0.03, 0.05], round: 0.01, bone: "cab", island: "upper", color: BLACK },
  { id: "vent_3", shape: "box", center: [-0.45, 2.47, -0.4], half: [0.65, 0.03, 0.05], round: 0.01, bone: "cab", island: "upper", color: BLACK },
  { id: "hood", shape: "box", center: [-0.45, 2.0, -0.5], half: [0.95, 0.45, 0.95], round: 0.2, bone: "cab", island: "upper", blend: 0.04, color: YELLOW },
  { id: "exhaust", shape: "cylinder", center: [-1.1, 2.75, -0.2], axis: "y", radius: 0.06, half: 0.35, round: 0.02, bone: "cab", island: "upper", color: DARK },
  { id: "tank", shape: "box", center: [-1.0, 1.85, 0.85], half: [0.38, 0.3, 0.55], round: 0.1, bone: "cab", island: "upper", blend: 0.03, color: YELLOW_D },
  { id: "bracket", shape: "box", center: [0.36, 1.85, 1.12], half: [0.07, 0.3, 0.34], round: 0.03, bone: "cab", island: "upper", mirror: "x", color: YELLOW_D },
  { id: "step", shape: "box", center: [1.55, 1.7, 0.3], half: [0.14, 0.03, 0.3], round: 0.01, bone: "cab", island: "upper", color: DARK },
  { id: "cab", shape: "box", center: [1.04, 2.35, 0.55], half: [0.42, 0.8, 0.75], round: 0.08, bone: "cab", island: "upper", blend: 0.03, color: YELLOW },
  { id: "win_front", shape: "box", center: [1.04, 2.62, 1.3], half: [0.34, 0.5, 0.08], blend: 0.02, bone: "cab", island: "upper", op: "subtract" },
  { id: "win_left", shape: "box", center: [1.46, 2.62, 0.55], half: [0.08, 0.5, 0.52], blend: 0.02, bone: "cab", island: "upper", op: "subtract" },
  { id: "win_right", shape: "box", center: [0.62, 2.62, 0.8], half: [0.08, 0.5, 0.4], blend: 0.02, bone: "cab", island: "upper", op: "subtract" },
  { id: "win_back", shape: "box", center: [1.04, 2.62, -0.19], half: [0.3, 0.45, 0.08], blend: 0.02, bone: "cab", island: "upper", op: "subtract" },
  { id: "glass_front", shape: "box", center: [1.04, 2.62, 1.2], half: [0.34, 0.5, 0.05], bone: "cab", island: "upper", color: GLASS, roughness: 0.08 },          // (glass: glossy, SOMA.md "Materials")
  { id: "glass_left", shape: "box", center: [1.36, 2.62, 0.55], half: [0.05, 0.5, 0.52], bone: "cab", island: "upper", color: GLASS, roughness: 0.08 },
  { id: "glass_right", shape: "box", center: [0.72, 2.62, 0.8], half: [0.05, 0.5, 0.4], bone: "cab", island: "upper", color: GLASS, roughness: 0.08 },
  { id: "glass_back", shape: "box", center: [1.04, 2.62, -0.09], half: [0.3, 0.45, 0.05], bone: "cab", island: "upper", color: GLASS, roughness: 0.08 },
  { id: "roof", shape: "box", center: [1.04, 3.2, 0.6], half: [0.5, 0.05, 0.9], round: 0.03, bone: "cab", island: "upper", color: YELLOW_D },
  { id: "lamp", shape: "box", center: [0.75, 3.28, 1.4], half: [0.07, 0.05, 0.04], round: 0.02, bone: "cab", island: "upper", color: LAMP },
  { id: "lamp_2", shape: "box", center: [1.33, 3.28, 1.4], half: [0.07, 0.05, 0.04], round: 0.02, bone: "cab", island: "upper", color: LAMP },
  // THE BOOM (the boom bone): a box section with a bend, its pin at the foot, the lugs where the cylinders hold it
  { id: "boom", shape: "loft", points: [[0, 1.65, 1.15], [0, 2.72, 1.91], [0, 3.37, 2.72], [0, 3.78, 3.67], [0, 3.95, 4.55]], radii: [0.27, 0.28, 0.26, 0.23, 0.2], radii_v: [0.32, 0.4, 0.38, 0.3, 0.25], square: 0.75, bone: "boom", island: "boom", blend: 0.03, color: YELLOW },
  { id: "boom_pin", shape: "cylinder", center: [0, 1.65, 1.15], axis: "x", radius: 0.11, half: 0.46, round: 0.02, bone: "boom", island: "boom", color: DARK },
  { id: "boom_lug", shape: "box", center: [0.4, 2.42, 2.17], half: [0.15, 0.07, 0.1], round: 0.03, bone: "boom", island: "boom", mirror: "x", color: YELLOW_D },
  { id: "boom_top_lug", shape: "box", center: [0, 3.85, 2.5], half: [0.09, 0.16, 0.1], round: 0.03, bone: "boom", island: "boom", color: YELLOW_D },
  // THE STICK (the stick bone)
  { id: "stick", shape: "loft", points: [[0, 3.95, 4.55], [0, 3.226, 5.405], [0, 2.35, 6.45]], radii: [0.19, 0.17, 0.12], radii_v: [0.34, 0.26, 0.14], square: 0.6, bone: "stick", island: "stick", blend: 0.02, color: YELLOW },
  { id: "elbow_pin", shape: "cylinder", center: [0, 3.95, 4.55], axis: "x", radius: 0.14, half: 0.34, round: 0.02, bone: "stick", island: "stick", color: DARK },
  { id: "stick_horn", shape: "box", center: [0, 4.33, 4.62], half: [0.08, 0.15, 0.1], round: 0.03, bone: "stick", island: "stick", color: YELLOW_D },
  { id: "stick_lug", shape: "box", center: [0, 3.95, 5.0], half: [0.08, 0.17, 0.1], round: 0.03, bone: "stick", island: "stick", color: YELLOW_D },
  { id: "stick_boss", shape: "cylinder", center: [0, 2.35, 6.45], axis: "x", radius: 0.15, half: 0.2, round: 0.02, bone: "stick", island: "stick", color: DARK },
  // THE BUCKET (the bucket bone): a back plate that curves from the pin round to the lip, two cheeks, ears for the pin, a lip with five teeth, ribs. All of them lofts (an oriented plate: the cross section is a thin ellipse):
  // B(s, w, x) is a point of the bucket (S: of its scoop), s along its axis from the pin to the teeth, w toward its back, x across. The mouth is open toward -w (toward the machine, down) at the bind pose
  { id: "back", shape: "loft", points: BACK.map(function (p) { return S(p[0], p[1]); }), radii: BACK.map(function (p) { return p[2]; }), radii_v: BACK.map(function () { return 0.04; }), square: 0.9, bone: "bucket", island: "bucket", blend: 0.01, color: BUCKET },
  { id: "cheek", shape: "loft", points: CHEEK.map(function (p) { return S(p[0], p[1], 0.6); }), radii: CHEEK.map(function () { return 0.04; }), radii_v: CHEEK.map(function (p) { return p[2]; }), square: 0.6, bone: "bucket", island: "bucket", mirror: "x", blend: 0.01, color: BUCKET },
  { id: "rib", shape: "loft", points: RIB.map(function (p) { return S(p[0], p[1] + 0.08); }), radii: RIB.map(function () { return 0.04; }), radii_v: RIB.map(function () { return 0.035; }), bone: "bucket", island: "bucket", blend: 0.01, color: DARK },
  { id: "rib_2", shape: "loft", points: RIB.map(function (p) { return S(p[0], p[1] + 0.08, 0.3); }), radii: RIB.map(function () { return 0.04; }), radii_v: RIB.map(function () { return 0.035; }), bone: "bucket", island: "bucket", mirror: "x", blend: 0.01, color: DARK },
  { id: "ear", shape: "loft", points: [S(0.0, 0.0, 0.28), S(0.3, 0.38, 0.28)], radii: [0.05, 0.05], radii_v: [0.16, 0.1], square: 0.6, bone: "bucket", island: "bucket", mirror: "x", blend: 0.01, color: BUCKET },
  { id: "lip", shape: "capsule", a: S(1.04, 0.04, -0.62), b: S(1.04, 0.04, 0.62), radius: 0.05, bone: "bucket", island: "bucket", color: STEEL },
  { id: "bucket_pin", shape: "cylinder", center: [0, 2.35, 6.45], axis: "x", radius: 0.13, half: 0.4, round: 0.02, bone: "bucket", island: "bucket", color: DARK },
  { id: "tooth", shape: "capsule", a: B(0.84, 0.04, 0), b: B(1.14, 0.0, 0), ra: 0.065, rb: 0.012, bone: "bucket", island: "bucket", mirror: "x", color: STEEL },
  { id: "tooth_2", shape: "capsule", a: B(0.84, 0.04, 0.26), b: B(1.14, 0.0, 0.26), ra: 0.065, rb: 0.012, bone: "bucket", island: "bucket", mirror: "x", color: STEEL },
  { id: "tooth_3", shape: "capsule", a: B(0.84, 0.04, 0.52), b: B(1.14, 0.0, 0.52), ra: 0.065, rb: 0.012, bone: "bucket", island: "bucket", mirror: "x", color: STEEL },
  // THE CYLINDERS: each a body on the bone that holds it and a rod on the bone that it moves
  { id: "boom_cyl", shape: "capsule", a: [0.53, 1.6, 0.75], b: [0.53, 1.96, 1.36], radius: 0.085, blend: 0.03, bone: "cab", island: "cyl_boom", mirror: "x", color: DARK },
  { id: "boom_cyl_eye", shape: "sphere", center: [0.53, 1.6, 0.75], radius: 0.1, bone: "cab", island: "cyl_boom", mirror: "x", color: DARK },
  { id: "boom_rod", shape: "capsule", a: [0.53, 1.88, 1.22], b: [0.53, 2.4, 2.15], radius: 0.05, blend: 0.03, bone: "boom", island: "cyl_boom", mirror: "x", color: CHROME },
  { id: "boom_rod_eye", shape: "sphere", center: [0.53, 2.4, 2.15], radius: 0.085, bone: "boom", island: "cyl_boom", mirror: "x", color: DARK },
  { id: "arm_cyl", shape: "capsule", a: [0, 4.0, 2.5], b: [0, 4.17, 3.65], radius: 0.1, blend: 0.03, bone: "boom", island: "cyl_arm", color: DARK },
  { id: "arm_cyl_eye", shape: "sphere", center: [0, 4.0, 2.5], radius: 0.12, bone: "boom", island: "cyl_arm", color: DARK },
  { id: "arm_rod", shape: "capsule", a: [0, 4.14, 3.5], b: [0, 4.45, 4.62], radius: 0.06, blend: 0.03, bone: "stick", island: "cyl_arm", color: CHROME },
  { id: "arm_rod_eye", shape: "sphere", center: [0, 4.45, 4.62], radius: 0.1, bone: "stick", island: "cyl_arm", color: DARK },
  { id: "bucket_cyl", shape: "capsule", a: [0, 4.1, 5.0], b: [0, 3.46, 5.77], radius: 0.085, blend: 0.03, bone: "stick", island: "cyl_bucket", color: DARK },
  { id: "bucket_cyl_eye", shape: "sphere", center: [0, 4.1, 5.0], radius: 0.11, bone: "stick", island: "cyl_bucket", color: DARK },
  { id: "bucket_rod", shape: "capsule", a: [0, 3.55, 5.66], b: [0, 3.0, 6.3], radius: 0.05, blend: 0.03, bone: "stick", island: "cyl_bucket", color: CHROME },
  { id: "bucket_link", shape: "capsule", a: [0, 3.0, 6.3], b: B(0.12, 0.3), radius: 0.05, blend: 0.03, bone: "bucket", island: "cyl_bucket", color: STEEL },
];
// the shoes of the tracks: a bar across the top run of each track every 0.28 m
for (let i = 0; i < 13; i++) parts.push({ id: "shoe_" + i, shape: "box", center: [1.25, 0.96, -1.68 + i * 0.28], half: [0.31, 0.03, 0.045], round: 0.01, bone: "hull", island: "under", mirror: "x", color: TRACK_L });
const sdf = {
  cell: 0.03, skin: { falloff: 8 }, shade: { ao: 0.4, ao_radius: 0.12, tone: 0.2, color_blend: 0 }, decimate: { ratio: 0.045, error: 0.03, max_edge: 1.5 },
  islands: {
    upper: { cell: 0.025, decimate: { ratio: 0.05, error: 0.015, max_edge: 1.0 } },
    bucket: { cell: 0.02, decimate: { ratio: 0.12, error: 0.005, max_edge: 0.5 } },
    cyl_boom: { cell: 0.025, decimate: { ratio: 0.12, error: 0.012, max_edge: 0.5 } },
    cyl_arm: { cell: 0.025, decimate: { ratio: 0.12, error: 0.012, max_edge: 0.5 } },
    cyl_bucket: { cell: 0.025, decimate: { ratio: 0.12, error: 0.012, max_edge: 0.5 } },
  },
  parts: parts,
};

return {
  name: "excavator", max: 16,
  family: { faction: "machine", kind: "machine", hp: 400 },
  nav: { agent: {"name":"excavator","radius":2.6,"height":3.6,"step":0.3,"slope":20,"drop":0.3} },
  body: {
    skeleton: bones,
    rig: rig,
    sdf: sdf
  },
  abilities: ["effects"],
  interaction: { uses: [] },
  // PARTICLES (soma/js/fx.js): the engine idles: a thin smoke from the stack behind the cab
  particles: {
    exhaust: { effect: "exhaust_smoke", mount: { bone: "cab", at: [-0.6, 1.1, -0.9], dir: [0, 1, 0] }, loop: { while: "always" }, scale: 1.2 }
  },
  mind: {
    hz: 4, far_hz: 1,
    blocks: [
      ["health", { hp: 400 }],
      ["operate", { joints: [{ bone: "cab", axis: "y" }, { bone: "boom", axis: "x" }, { bone: "stick", axis: "x" }, { bone: "bucket", axis: "x" }], poses: [[0, -10, 10, 20], [0, 25, -35, 30], [0, 20, -55, -30], [70, 5, -10, -50], [70, 5, -10, 60], [0, -10, 10, 20]], pause: 1.2, ease: 1.6 }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first; the blocks without a node (health, needs, injured) act through their hooks.
    worker: function (api, ld) {
      var tree = { name: "excavator", select: [ld.node("operate")] };
      return { tree: tree };
    }
  }
};
