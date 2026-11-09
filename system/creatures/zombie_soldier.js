"use strict";
// zombie_soldier: a zombie of a soldier: green-grey skin, milky eyes, dark sockets, rot, a wound across the brow and cheek, a stubbled jaw, an olive jacket and a beret. A person of the lite human (system/human_lite_studio.js) with a ROTTEN TEXTURED SKIN: ONE JS FILE IS ONE CREATURE, the `human` of its body is the definition of the person.
// Its TEXTURE is the person's SKIN (SYSTEM.md "The skin of the human"): the body is drawn from one colour picture made when the person is built, from the pack's base skin moved to a dead grey-green `tone` and the `layers` below: the lines of age, big freckles as rot,
// smaller ones as bruises, sunken sockets (eyelid shadow), dark lips, grey stubble and decals of wounds (drawn here, in code, and put on the head's sheet by `at`). The eyes are milky (`look.eyes`) and it shambles with a real zombie walk of the pack (`zombie_walk`).
// the picture of a decal is base64 text (a definition is copied as data: a Uint8Array would not survive)
const b64 = function (u) {
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; let s = '';
  for (let i = 0; i < u.length; i += 3) { const n = (u[i] << 16) | ((u[i + 1] || 0) << 8) | (u[i + 2] || 0); s += T[(n >> 18) & 63] + T[(n >> 12) & 63] + (i + 1 < u.length ? T[(n >> 6) & 63] : '=') + (i + 2 < u.length ? T[n & 63] : '='); }
  return s;
};
// a wound as a picture for the skin's `decal` layer: a ragged blotch of torn flesh with a dark middle and a livid rim (RGBA, w x w, the same every time: a few sines of the angle make its edge)
const wound = function (w, seed) {
  const d = new Uint8Array(w * w * 4);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w * 2 - 1, v = (y + 0.5) / w * 2 - 1, a = Math.atan2(v, u), r = Math.hypot(u, v);
    const edge = 0.7 + 0.1 * Math.sin(2 * a + seed) + 0.07 * Math.sin(5 * a + 2.3 * seed) + 0.04 * Math.sin(11 * a + 1.7 * seed), t = r / edge + 0.16 * Math.sin(9 * u + seed) * Math.sin(8 * v + 2 * seed);
    if (t >= 1) continue;
    const o = 4 * (y * w + x), rim = Math.min(1, Math.max(0, (t - 0.55) / 0.45)), mid = 1 - rim;
    d[o] = Math.round(58 * mid + 110 * rim);
    d[o + 1] = Math.round(6 * mid + 52 * rim);
    d[o + 2] = Math.round(8 * mid + 62 * rim);
    d[o + 3] = Math.round(255 * Math.min(1, (1 - t) * 4) * 0.92);
  }
  return { width: w, height: w, data: b64(d) };
};
return {
  name: "zombie_soldier", max: 16,
  family: { faction: "monster", kind: "monster", hp: 90 },
  nav: { agent: "person" },
  body: {
    human: {
      model: "lite",
      shape: {"gender":1,"age":0.4,"height":0.55,"weight":0.5,"muscle":0.6,"african":0.3,"caucasian":0.7},
      look: { tone: 0.15, undertone: -0.3, ruddy: 0, eyes: [0.8, 0.82, 0.72] },
      hair: {"style":"crop","colour":[0.1,0.09,0.07],"volume":0.3},
      clothes: [{"kind":"trousers","colour":[0.2,0.23,0.14]},{"kind":"jacket","colour":[0.25,0.3,0.18]},{"kind":"boots","colour":[0.07,0.06,0.05]},{"kind":"beret","colour":[0.15,0.17,0.1]}],
      skin: { size: 512, tone: [0.5, 0.62, 0.42], layers: [
        { kind: "age", amount: 1 },
        { kind: "freckles", amount: 1, size: 3, colour: [0.16, 0.24, 0.09], seed: 6 },
        { kind: "freckles", amount: 0.7, size: 2, colour: [0.3, 0.06, 0.05], seed: 3 },
        { kind: "brows", style: "none" },
        { kind: "makeup", shadow: { colour: [0.1, 0.08, 0.12], strength: 1 }, liner: { colour: [0.08, 0.06, 0.06], strength: 1 }, blush: { colour: [0.17, 0.2, 0.13], strength: 0.85 } },
        { kind: "lips", colour: [0.18, 0.08, 0.08], strength: 0.95 },
        { kind: "stubble", amount: 0.55, colour: [0.1, 0.1, 0.08] },
        { kind: "decal", image: wound(64, 4.4), at: [372, 120], scale: 0.85, rotate: -15, mask: "head", opacity: 0.95 },
        { kind: "decal", image: wound(64, 1.1), at: [398, 380], scale: 0.6, rotate: 50, mask: "head", opacity: 0.95 }
      ] }
    },
    legs: { gait: { from: "zombie_walk" } }
  },
  abilities: ["walk", "open", "climb", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 90 }],
      ["fight", { sight: 16, reach: 0.9, speed: 0.8, run_speed: 1.3, damage: 12, gap: 1, windup: 0.4, retreat: 0.1, stalk: 0, clip_attack: "", clip_eat: "" }],
      "injured",
      ["wander", { speed: 0.6, near: 0.5, pause_min: 1.5, pause_max: 6 }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first: it goes for what it sees and shambles about otherwise.
    worker: function (api, ld) {
      var tree = { name: "zombie_soldier", select: [ld.node("fight"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
