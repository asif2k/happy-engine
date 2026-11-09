"use strict";
// old_sailor: an old sailor: weathered, ruddy skin with the lines of sixty years at sea, sun spots, grey stubble under a white beard, bushy grey brows, a navy sweater and a cap. A person of the lite human (system/human_lite_studio.js): ONE JS FILE IS ONE CREATURE, the `human` of its body is the definition of the person (the sliders that differ from the default body, the look, the clothes and the hair).
// Its TEXTURE is the person's SKIN (SYSTEM.md "The skin of the human"): the body is drawn from one colour picture made when the person is built, from the pack's base skin and the `layers` below: the lines of age, freckles, stubble, brows, lips, makeup.
return {
  name: "old_sailor", max: 16,
  family: { faction: "folk", kind: "person", hp: 100 },
  nav: { agent: "person" },
  body: {
    human: {
     "model": "lite",
     "shape": {
      "gender": 1,
      "age": 0.92,
      "height": 0.1,
      "weight": 0.58,
      "muscle": 0.42,
      "caucasian": 1,
      "african": 0,
      "asian": 0,
      "jaw": 0.35,
      "nose_size": 0.3,
      "cheeks": -0.3
     },
     "look": {
      "tone": 0.22,
      "undertone": 0.1,
      "ruddy": 0.65
     },
     "hair": {
      "style": "short",
      "colour": [
       0.9,
       0.9,
       0.88
      ],
      "volume": 0.4
     },
     "beard": {
      "style": "full",
      "colour": [
       0.9,
       0.9,
       0.88
      ],
      "length": 0.55
     },
     "clothes": [
      {
       "kind": "trousers",
       "colour": [
        0.1,
        0.12,
        0.2
       ]
      },
      {
       "kind": "sweater",
       "colour": [
        0.14,
        0.2,
        0.34
       ]
      },
      {
       "kind": "cap",
       "colour": [
        0.07,
        0.08,
        0.1
       ]
      },
      {
       "kind": "boots",
       "colour": [
        0.1,
        0.07,
        0.05
       ]
      }
     ],
     "skin": {
      "size": 512,
      "layers": [
       {
        "kind": "age",
        "amount": 0.85
       },
       {
        "kind": "freckles",
        "amount": 0.45,
        "size": 1.5,
        "seed": 4
       },
       {
        "kind": "stubble",
        "amount": 0.5,
        "colour": [
         0.55,
         0.55,
         0.54
        ]
       },
       {
        "kind": "brows",
        "style": "bushy",
        "colour": [
         0.78,
         0.78,
         0.76
        ],
        "thick": 0.8
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
      var tree = { name: "old_sailor", select: [ld.node("flee"), ld.node("greet"), ld.node("use"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
