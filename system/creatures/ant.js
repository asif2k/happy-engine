"use strict";
// ant: in soma's one form of a creature file (soma/creature_file.js): `body` is the creature as it was made, the rest is who it is to the others (family, nav, abilities) and its mind: the blocks of soma/world/blocks/ it loads by name and
// its tree (an animal's own clips: the clip set `bug/ant`). The old worker of this file is left out; the mind below is the default of a creature of its kind (animal): write the creature's own in `mind`.
// ant: a six-legged insect creature. ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature { name, skeleton, rig }.

// 1. SKELETON & RIG
const bones = [{ name: "body", head: [0, 0.15, -0.1], tail: [0, 0.15, 0.1] }];
const joints = [], chains = [];

// Adjusted legs to be tucked in closer and shorter, more ant-like instead of a wide spider span
[["1", 0.1, 0.4], ["2", 0.0, 0.0], ["3", -0.1, -0.4]].forEach(function (leg) {
  const id = leg[0], z = leg[1], fan = leg[2];
  const dx = Math.cos(fan), dz = Math.sin(fan);
  
  const p0 = [0.03, 0.15, z];
  const p1 = [0.03 + 0.04 * dx, 0.15, z + 0.04 * dz]; // Shorter coxa
  const p2 = [0.03 + 0.10 * dx, 0.22, z + 0.10 * dz]; // Lower, tighter knee
  const p3 = [0.03 + 0.18 * dx, 0.0, z + 0.18 * dz];  // Foot closer to the body
  
  const names = ["coxa" + id + "_l", "femur" + id + "_l", "tibia" + id + "_l"], pts = [p0, p1, p2, p3];
  names.forEach(function (name, i) { 
      bones.push({ name: name, parent: i === 0 ? "body" : names[i - 1], head: pts[i], tail: pts[i + 1], mirror: "x" }); 
  });
  
  const axis = [-dz, 0, dx];
  joints.push({ bone: names[0], mirror: "x", fwd: 35, back: 35, up: 15, down: 20, twist: 5 });
  joints.push({ bone: names[1], mirror: "x", kind: "hinge", axis: axis, range: [-50, 70] });
  joints.push({ bone: names[2], mirror: "x", kind: "hinge", axis: axis, range: [-100, 40] });
  
  chains.push({ name: "leg" + id + "_l", mirror: "x", bones: names, pole: [0, 1, 0], pole_w: 1 });
});

// 2. LEGS, ROLES, PHYSICS
const legs = { 
    legs: [{ chain: "leg1_l", mirror: "x" }, { chain: "leg2_l", mirror: "x" }, { chain: "leg3_l", mirror: "x" }], 
    gait: { speed: 1.2, stride: 0.2, swing: 0.45, step_height: 0.06 }, // Shorter stride for shorter legs
    slots: 2 
};
const roles = { hips: "body" };
const physics = { 
    mass: 0.5, 
    shapes: [{ id: "hull", shape: "capsule", a: [0, 0.15, -0.1], b: [0, 0.15, 0.15], radius: 0.08, bone: "body" }] 
};

// 3. SDF MESH BODY
const BLACK = [0.1, 0.1, 0.1, 1], BROWN = [0.3, 0.15, 0.05, 1];
const parts = [
  { id: "head", shape: "ellipsoid", center: [0, 0.15, 0.2], radii: [0.06, 0.05, 0.06], bone: "body", blend: 0.02, color: BLACK },
  { id: "thorax", shape: "ellipsoid", center: [0, 0.15, 0.0], radii: [0.05, 0.05, 0.1], bone: "body", blend: 0.02, color: BROWN },
  { id: "abdomen", shape: "ellipsoid", center: [0, 0.17, -0.15], radii: [0.08, 0.08, 0.12], bone: "body", blend: 0.02, color: BLACK }
];
["1", "2", "3"].forEach(function (id) {
    parts.push(
        { id: "coxa" + id, shape: "loft", bones: ["coxa" + id + "_l"], radii: [0.02, 0.015], mirror: "x", blend: 0.01, color: BLACK },
        { id: "femur" + id, shape: "loft", bones: ["femur" + id + "_l"], radii: [0.015, 0.012], mirror: "x", blend: 0.01, color: BROWN },
        { id: "tibia" + id, shape: "loft", bones: ["tibia" + id + "_l"], radii: [0.012, 0.005], mirror: "x", blend: 0.01, color: BLACK }
    );
});
const sdf = { cell: 0.005, adaptive: { min_cell: 0.002, max_cell: 0.01 }, decimate: { ratio: 0.4 }, skin: { falloff: 0.8 }, shade: { ao: 0.5, ao_radius: 0.03, tone: 0.2, color_blend: 0.12 }, parts: parts };

// TEXTURE: a RECIPE (maps.js, SYSTEM.md "Texture on an sdf creature"), baked into a colour map and a packed map (256 x 256) when the species is made. A glossy chitin shell (low roughness, a little metal), the pits of the head and thorax,
// the pale bands between the segments of the abdomen, a lighter underside, and a fine dust on the legs. A variant's dye multiplies the picture, so the fire and amber ants keep the same markings.
const texture = { size: 256, seed: 11, layers: [
  { kind: "fill", parts: ["head", "thorax", "abdomen"], roughness: 0.32, metal: 0.12 },
  { kind: "cells", parts: ["head", "thorax"], size: 0.012, line: 0.12, colour: [0.04, 0.03, 0.03], vary: 0.25, edge: 0.45, strength: 0.7 },
  { kind: "stripes", parts: ["abdomen"], axis: [0, 0, 1], period: 0.045, width: 0.16, colour: [0.32, 0.2, 0.1], wobble: 0.1, edge: 0.5, strength: 0.8 },
  { kind: "noise", parts: ["abdomen"], scale: 0.02, amount: 0.25 },
  { kind: "gradient", parts: ["head", "thorax", "abdomen"], by: "normal", axis: [0, -1, 0], from: 0.4, to: 0.9, colour: [0.34, 0.22, 0.12], strength: 0.6 },
  { kind: "noise", parts: ["coxa*", "femur*", "tibia*"], scale: 0.008, amount: 0.35 }
] };

// 4. VARIANTS (Colors/Looks)
const variants = {
  dyes: {
    shell: { 
      parts: ["head", "thorax", "abdomen", "coxa1", "femur1", "tibia1", "coxa2", "femur2", "tibia2", "coxa3", "femur3", "tibia3"], 
      palette: [
        [0.1, 0.1, 0.1], // 0: Black Ant
        [0.6, 0.15, 0.05], // 1: Fire Ant (Red)
        [0.5, 0.3, 0.1]  // 2: Amber Ant
      ]
    }
  },
  looks: { 
    black: { shell: 0 }, 
    fire: { shell: 1 }, 
    amber: { shell: 2 } 
  }
};

return {
  name: "ant", max: 16,
  family: { faction: "animal", kind: "animal", hp: 20 },
  nav: { agent: "small" },
  body: {
    skeleton: bones,
    rig: { joints: joints, chains: chains },
    legs: legs,
    body: { gravity: 9.8 },
    roles: roles,
    physics: physics,
    sdf: sdf,
    texture: texture,
    variants: variants
  },
  abilities: ["walk", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 20 }],
      ["flee", { speed: 1.2, distance: 6 }],
      ["curious", { approach: 0.3, cooldown: 20, near: 1 }],
      ["idle_life", { clip_look: "ant_idle", clip_stretch: "ant_idle_2", clip_shift: "ant_idle", clip_sit: "ant_idle" }],
      ["injured", { clip_flinch: "" }],
      ["wander", { speed: 0.27, near: 0.5 }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first; the blocks without a node (health, needs, injured) act through their hooks.
    worker: function (api, ld) {
      var tree = { name: "ant", select: [ld.node("flee"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
