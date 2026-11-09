"use strict";
// bolt: in soma's one form of a creature file (soma/creature_file.js): `body` is the creature as it was made, the rest is who it is to the others (family, nav, abilities) and its mind: the blocks of soma/world/blocks/ it loads by name and
// its tree. The old worker of this file is left out; the mind below is the default of a creature of its kind (robot): write the creature's own in `mind`.
// bolt: Bolt, a friendly helper robot made for soma: a rounded body on a spine and chest that breathe, a head with a dark visor, cyan eyes under shutter lids, a speaker chin that moves when it speaks and an antenna that springs as it moves, two legs on ik chains with a walk and a run, and two arms on ik chains whose hands swing, reach, rest on a table or a wall and hold. Its actions: wave and speak, and draw, holster, stow and shoot for the blaster that it carries as a prop: it sits in a holster on the right hip, slides into the right hand when it is drawn (and back when it is holstered), is away when it is stowed (its bone is scaled to nothing), shoots with one hand or with both (the left hand goes to the blaster's support point), and a shot tells the page where the muzzle is. Collision shapes: the body and a forearm each, and the blaster's while it is out.
// ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature { name, skeleton, rig, legs, body, roles, physics, mesh | sdf }. Metres, +x to its left, +y up, +z forward.
// PORTED from soma2.0/creatures/bolt.js by soma/tools/port_creature.js (recipe soma/tools/port_recipes/bolt.js).
// THE FACE (the bones kept, named, given joints; the roles in `roles`):
//   - eye 'eye_l': the sdf's sphere on the bone, an island with a pupil; it looks the way the donor's bone's does [0, 0, 1]
//   - lid 'lid_up_l' (upper): turns about the centre of 'eye_l'
//   - jaw 'jaw': from its hinge to its chin, opens 25 degrees
//   - appendages: 'ant1' > 'ant2' (follow)
// LEFT OUT of the donor's file (the restart has no place for it):
//   - arms' `can` (rest_on, hold): 2 arms (the restart has no hands that rest or hold)
//   - the prop's mounts, holsters, grip points and actions ('blaster'): the prop itself stays as the donor models it, a rigid piece on 'hand_r'
//   - actions: wave, speak, draw, holster, stow, shoot
//   - tags: shot
//   - limbs: {"avoid":true}
const bones = [
  { name: "hips", parent: null, head: [0, 0.6, 0], tail: [0, 0.66, 0] },
  { name: "spine", parent: "hips", head: [0, 0.66, 0], tail: [0, 0.78, 0] },
  { name: "chest", parent: "spine", head: [0, 0.78, 0], tail: [0, 0.92, 0] },
  { name: "neck", parent: "chest", head: [0, 0.92, 0], tail: [0, 0.99, 0.01] },
  { name: "head", parent: "neck", head: [0, 0.99, 0.01], tail: [0, 1.1, 0.03] },
  { name: "jaw", parent: "head", head: [0, 1.025, 0.06], tail: [0, 1.014, 0.118] },
  { name: "eye_l", parent: "head", head: [0.05, 1.065, 0.136], tail: [0.05, 1.065, 0.172], mirror: "x" },
  { name: "lid_up_l", parent: "head", head: [0.05, 1.065, 0.136], tail: [0.05, 1.065, 0.166], mirror: "x" },
  { name: "ant1", parent: "head", head: [0, 1.1, -0.03], tail: [0, 1.17, -0.03] },
  { name: "ant2", parent: "ant1", head: [0, 1.17, -0.03], tail: [0, 1.25, -0.03] },
  { name: "upper_l", parent: "chest", head: [0.2, 0.89, 0], tail: [0.22, 0.68, 0], mirror: "x" },
  { name: "fore_l", parent: "upper_l", head: [0.22, 0.68, 0], tail: [0.24, 0.48, 0], mirror: "x" },
  { name: "hand_l", parent: "fore_l", head: [0.24, 0.48, 0], tail: [0.24, 0.41, 0], mirror: "x" },
  { name: "blaster", parent: "hand_r", head: [-0.24, 0.47, 0.008], tail: [-0.24, 0.222, 0.008] },
  { name: "thigh_l", parent: "hips", head: [0.09, 0.6, 0], tail: [0.09, 0.33, 0], mirror: "x" },
  { name: "shin_l", parent: "thigh_l", head: [0.09, 0.33, 0], tail: [0.09, 0.06, 0], mirror: "x" },
  { name: "foot_l", parent: "shin_l", head: [0.09, 0.06, 0], tail: [0.09, 0.06, 0.08], mirror: "x" },
];
const rig = {
  joints: [
    { bone: "thigh_l", kind: "ball", fwd: 75, back: 60, out: 40, in: 25, twist: [-25, 25] },
    { bone: "shin_l", kind: "hinge", axis: [1, 0, 0], range: [-6, 140] },
    { bone: "foot_l", kind: "ball", fwd: 45, back: 45, lat: 20, twist: 15 },
    { bone: "thigh_r", kind: "ball", fwd: 75, back: 60, out: 40, in: 25, twist: [-25, 25] },
    { bone: "shin_r", kind: "hinge", axis: [1, 0, 0], range: [-6, 140] },
    { bone: "foot_r", kind: "ball", fwd: 45, back: 45, lat: 20, twist: 15 },
    { bone: "upper_l", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] },
    { bone: "fore_l", kind: "hinge", axis: [-0.995, -0.1, 0], range: [-6, 150] },
    { bone: "upper_r", kind: "ball", fwd: 130, back: 60, out: 100, in: 40, twist: [-80, 80] },
    { bone: "fore_r", kind: "hinge", axis: [-0.995, 0.1, 0], range: [-6, 150] },
    { bone: "spine", kind: "ball", fwd: 40, back: 25, lat: 25, twist: 30 },
    { bone: "chest", kind: "ball", fwd: 30, back: 20, lat: 25, twist: 30 },
    { bone: "neck", kind: "ball", fwd: 50, back: 50, lat: 40, twist: 60 },
    { bone: "head", kind: "ball", fwd: 35, back: 45, lat: 35, twist: 50 },
    { bone: "eye_l", kind: "ball", fwd: 35, back: 35, lat: 35, twist: [-10, 10] },
    { bone: "eye_r", kind: "ball", fwd: 35, back: 35, lat: 35, twist: [-10, 10] },
    { bone: "lid_up_l", kind: "hinge", axis: [1, 0, 0], range: [-20, 85] },
    { bone: "lid_up_r", kind: "hinge", axis: [1, 0, 0], range: [-20, 85] },
    { bone: "jaw", kind: "hinge", axis: [1, 0, 0], range: [-3, 25] },
    { bone: "ant1", kind: "ball", fwd: 35, back: 35, lat: 35, twist: 15 },
    { bone: "ant2", kind: "ball", fwd: 35, back: 35, lat: 35, twist: 15 },
  ],
  chains: [
    { name: "leg_l", solver: "limb", bones: ["thigh_l", "shin_l"], tip: "foot_l", pole: [0, 0, 1], pole_w: 1 },
    { name: "leg_r", solver: "limb", bones: ["thigh_r", "shin_r"], tip: "foot_r", pole: [0, 0, 1], pole_w: 1 },
    { name: "arm_l", solver: "limb", bones: ["upper_l", "fore_l"], pole: [0, 0, -1], pole_w: 1 },
    { name: "arm_r", solver: "limb", bones: ["upper_r", "fore_r"], pole: [0, 0, -1], pole_w: 1 },
    { name: "head", bones: ["spine", "chest", "neck", "head"] },
  ],
};
const legs = { legs: ["leg_l", "leg_r"], gait: { from: "cmu_120_21_robot", speed: 0.85, ride: 0.573 } };
const roles = { hips: "hips", spine: ["spine", "chest"], chest: "chest", neck: ["neck"], head: "head", arms: [{ chain: "arm_l", rest: [0.097, -0.995, 0] }, { chain: "arm_r", rest: [0.097, -0.995, 0] }], eyes: ["eye_l", "eye_r"], lids: [{ bone: "lid_up_l", dir: 1 }, { bone: "lid_up_r", dir: 1 }], jaw: { bone: "jaw", max: 25 }, appendages: [{ bones: ["ant1", "ant2"], kind: "follow" }] };
const physics = { mass: 45, shapes: [
    { id: "body", shape: "capsule", a: [0, 0.2, 0], b: [0, 1, 0], radius: 0.16, bone: "hips" },
    { id: "leg_l", shape: "capsule", a: [0.09, 0.54, 0], b: [0.09, 0.072, 0], radius: 0.051 },
    { id: "leg_r", shape: "capsule", a: [-0.09, 0.54, 0], b: [-0.09, 0.072, 0], radius: 0.051 },
  ] };
const parts = [
  { id: "pelvis", shape: "box", center: [0, 0.62, 0], half: [0.12, 0.07, 0.09], round: 0.045, bone: "hips", blend: 0.02, color: [0.9, 0.92, 0.96, 1] },
  { id: "waist", shape: "cylinder", center: [0, 0.72, 0], axis: "y", radius: 0.075, half: 0.055, bone: "spine", blend: 0.015, color: [0.14, 0.16, 0.2, 1] },
  { id: "torso", shape: "ellipsoid", center: [0, 0.87, 0], radii: [0.15, 0.15, 0.115], bone: "chest", blend: 0.03, blend_mode: "cubic", color: [0.9, 0.92, 0.96, 1] },
  { id: "screen", shape: "box", center: [0, 0.885, 0.105], half: [0.075, 0.055, 0.02], round: 0.015, bone: "chest", blend: 0.008, color: [0.1, 0.5, 0.75, 1] },
  { id: "light_l", shape: "sphere", center: [0.05, 0.815, 0.108], radius: 0.014, bone: "chest", mirror: "x", color: [0.96, 0.5, 0.12, 1] },
  { id: "collar", shape: "torus", center: [0, 0.945, 0], axis: "y", radius: 0.07, tube: 0.014, bone: "neck", color: [0.46, 0.49, 0.54, 1] },
  { id: "neck", shape: "cylinder", center: [0, 0.962, 0.004], axis: "y", radius: 0.04, half: 0.03, bone: "neck", blend: 0.01, color: [0.14, 0.16, 0.2, 1] },
  { id: "head", shape: "ellipsoid", center: [0, 1.065, 0.03], radii: [0.14, 0.115, 0.125], bone: "head", blend: 0.03, blend_mode: "cubic", color: [0.9, 0.92, 0.96, 1] },
  { id: "visor", shape: "ellipsoid", center: [0, 1.07, 0.085], radii: [0.118, 0.068, 0.075], bone: "head", blend: 0.012, color: [0.05, 0.07, 0.12, 1] },
  { id: "pod_l", shape: "cylinder", center: [0.14, 1.06, 0.03], axis: "x", radius: 0.045, half: 0.018, bone: "head", mirror: "x", blend: 0.01, color: [0.96, 0.5, 0.12, 1] },
  { id: "eye_l", shape: "sphere", center: [0.05, 1.065, 0.136], radius: 0.024, bone: "eye_l", mirror: "x", color: [0.35, 0.95, 1, 1], island: "eyes" },
  { id: "lid_l", shape: "ellipsoid", center: [0.05, 1.088, 0.134], radii: [0.03, 0.017, 0.03], bone: "lid_up_l", mirror: "x", color: [0.14, 0.16, 0.2, 1], island: "lids" },
  { id: "chin", shape: "loft", points: [[0, 1.027, 0.07], [0, 1.014, 0.118]], radii: [0.052, 0.034], radii_v: [0.014, 0.011], bone: "jaw", blend: 0.012, color: [0.46, 0.49, 0.54, 1] },
  { id: "antenna", shape: "loft", bones: ["ant1", "ant2"], radii: [0.009, 0.007, 0.006], bone_blend: 0, blend: 0.01, color: [0.46, 0.49, 0.54, 1] },
  { id: "bulb", shape: "sphere", center: [0, 1.268, -0.03], radius: 0.02, bone: "ant2", color: [0.96, 0.5, 0.12, 1] },
  { id: "shoulder_l", shape: "sphere", center: [0.2, 0.885, 0], radius: 0.052, bone: "upper_l", mirror: "x", blend: 0.02, color: [0.96, 0.5, 0.12, 1] },
  { id: "arm_up_l", shape: "loft", bones: ["upper_l"], radii: [0.036, 0.031], mirror: "x", blend: 0.015, color: [0.9, 0.92, 0.96, 1] },
  { id: "elbow_l", shape: "sphere", center: [0.22, 0.68, 0], radius: 0.034, bone: "fore_l", mirror: "x", blend: 0.012, color: [0.46, 0.49, 0.54, 1] },
  { id: "arm_low_l", shape: "loft", bones: ["fore_l"], radii: [0.03, 0.026], mirror: "x", blend: 0.015, color: [0.9, 0.92, 0.96, 1] },
  { id: "hand_l", shape: "ellipsoid", center: [0.24, 0.445, 0.008], radii: [0.034, 0.05, 0.038], bone: "hand_l", mirror: "x", blend: 0.012, color: [0.96, 0.5, 0.12, 1] },
  { id: "thumb_l", shape: "sphere", center: [0.268, 0.465, 0.03], radius: 0.016, bone: "hand_l", mirror: "x", blend: 0.01, color: [0.96, 0.5, 0.12, 1] },
  { id: "hip_l", shape: "sphere", center: [0.09, 0.6, 0], radius: 0.05, bone: "thigh_l", mirror: "x", blend: 0.02, color: [0.46, 0.49, 0.54, 1] },
  { id: "thigh_l", shape: "loft", bones: ["thigh_l"], radii: [0.058, 0.046], mirror: "x", blend: 0.015, color: [0.9, 0.92, 0.96, 1] },
  { id: "knee_l", shape: "sphere", center: [0.09, 0.33, 0.01], radius: 0.05, bone: "shin_l", mirror: "x", blend: 0.012, color: [0.46, 0.49, 0.54, 1] },
  { id: "shin_l", shape: "loft", bones: ["shin_l"], radii: [0.046, 0.038], mirror: "x", blend: 0.015, color: [0.96, 0.5, 0.12, 1] },
  { id: "foot_l", shape: "box", center: [0.09, 0.04, 0.035], half: [0.047, 0.035, 0.078], round: 0.03, bone: "foot_l", mirror: "x", blend: 0.012, color: [0.14, 0.16, 0.2, 1] },
  { id: "blaster_body", island: "blaster", shape: "box", center: [-0.24, 0.4, 0.008], half: [0.026, 0.07, 0.032], round: 0.014, bone: "blaster", blend: 0.006, color: [0.46, 0.49, 0.54, 1] },
  { id: "blaster_grip", island: "blaster", shape: "box", center: [-0.24, 0.435, -0.038], half: [0.02, 0.042, 0.018], round: 0.008, bone: "blaster", blend: 0.006, color: [0.14, 0.16, 0.2, 1] },
  { id: "blaster_barrel", island: "blaster", shape: "cylinder", center: [-0.24, 0.29, 0.008], axis: "y", radius: 0.017, half: 0.07, bone: "blaster", blend: 0.004, color: [0.14, 0.16, 0.2, 1] },
  { id: "blaster_cell", island: "blaster", shape: "cylinder", center: [-0.272, 0.39, 0.008], axis: "y", radius: 0.013, half: 0.035, bone: "blaster", blend: 0.004, color: [0.96, 0.5, 0.12, 1] },
  { id: "blaster_sight", island: "blaster", shape: "box", center: [-0.24, 0.34, 0.04], half: [0.007, 0.02, 0.009], bone: "blaster", color: [0.96, 0.5, 0.12, 1] },
  { id: "blaster_muzzle", island: "blaster", shape: "torus", center: [-0.24, 0.228, 0.008], axis: "y", radius: 0.02, tube: 0.008, bone: "blaster", color: [0.35, 0.95, 1, 1] },
  { id: "eye_l_pupil", shape: "sphere", center: [0.05, 1.065, 0.1552], radius: 0.0096, bone: "eye_l", island: "eyes", color: [0.02, 0.05, 0.09, 1], mirror: "x" },
];
const sdf = { cell: 0.01, adaptive: { min_cell: 0.005, max_cell: 0.02 }, shade: { ao: 0.5, ao_radius: 0.03, tone: 0.2, color_blend: 0.35 }, skin: { falloff: 1.5 }, islands: { blaster: { cell: 0.004, adaptive: false, decimate: { ratio: 0.28 } }, eyes: { cell: 0.0034, adaptive: false, decimate: { ratio: 0.35 } }, lids: { cell: 0.0034, adaptive: false, decimate: { ratio: 0.4 } } }, decimate: { ratio: 0.6 }, parts: parts };
return {
  name: "bolt", max: 16,
  family: { faction: "machine", kind: "robot", hp: 20 },
  nav: { agent: "person" },
  body: {
    skeleton: bones,
    rig: rig,
    legs: legs,
    body: { gravity: 9.8, radius: 0.18, max_speed: 3.4 },
    roles: roles,
    physics: physics,
    sdf: sdf
  },
  abilities: ["walk", "open", "climb", "use", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 100 }],
      ["avoid", { radius: 0.3, margin: 0.4, neighbours: 4, look: 1.8 }],
      ["walk", { speed: 1, near: 0.4 }],
      ["idle_life", {}],
      ["wander", { speed: 1, near: 0.4 }]
    ],
    worker: function (api, ld) {
      return { tree: { name: "bolt", select: [ld.node("idle_life"), ld.node("wander")] } };   // (no node for avoid)
    }
  }

};
