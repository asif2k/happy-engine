"use strict";
// grandmother: a grandmother: pale, soft, deeply lined skin, white hair in a bun, thin grey brows, a little blush and a pale lip, a plum cardigan over a long skirt. A person of the lite human (system/human_lite_studio.js): ONE JS FILE IS ONE CREATURE, the `human` of its body is the definition of the person (the sliders that differ from the default body, the look, the clothes and the hair).
// Its TEXTURE is the person's SKIN (SYSTEM.md "The skin of the human"): the body is drawn from one colour picture made when the person is built, from the pack's base skin and the `layers` below: the lines of age, freckles, stubble, brows, lips, makeup.
return {
  name: "grandmother", max: 16,
  family: { faction: "folk", kind: "person", hp: 100 },
  nav: { agent: "person" },
  body: {
    human: {
     "model": "lite",
     "shape": {
      "gender": 0,
      "age": 0.96,
      "height": -0.35,
      "weight": 0.62,
      "muscle": 0.1,
      "caucasian": 1,
      "african": 0,
      "asian": 0,
      "bust_size": 0.6
     },
     "look": {
      "tone": 0.08,
      "undertone": -0.1,
      "ruddy": 0.3
     },
     "hair": {
      "style": "bun",
      "colour": [
       0.9,
       0.9,
       0.88
      ],
      "volume": 0.5
     },
     "clothes": [
      {
       "kind": "skirt",
       "colour": [
        0.22,
        0.2,
        0.26
       ]
      },
      {
       "kind": "sweater",
       "colour": [
        0.4,
        0.15,
        0.3
       ]
      },
      {
       "kind": "shoes",
       "colour": [
        0.12,
        0.1,
        0.1
       ]
      }
     ],
     "skin": {
      "size": 512,
      "layers": [
       {
        "kind": "age",
        "amount": 1
       },
       {
        "kind": "brows",
        "style": "thin",
        "colour": [
         0.78,
         0.78,
         0.76
        ],
        "thick": 0.4
       },
       {
        "kind": "lips",
        "colour": "nude",
        "strength": 0.5
       },
       {
        "kind": "makeup",
        "blush": {
         "colour": "blush",
         "strength": 0.5
        }
       },
       {
        "kind": "freckles",
        "amount": 0.25,
        "size": 1.8,
        "seed": 9
       }
      ]
     }
    }
  },
  abilities: ["walk", "open", "climb", "use", "effects"],
  interaction: { uses: ["sit", "sleep", "eat", "use"] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 100 }],
      "needs",
      ["use", { kinds: [], clip_sit: "sit_chair", clip_sleep: "lie_on_back" }],
      ["flee", { gait: "" }],
      ["greet", { meet: 6 }],
      "curious",
      "idle_life",
      "injured",
      ["wander", { speed: 1.1 }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first; the blocks without a node (health, needs, injured) act through their hooks.
    worker: function (api, ld) {
      var tree = { name: "grandmother", select: [ld.node("flee"), ld.node("greet"), ld.node("use"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
