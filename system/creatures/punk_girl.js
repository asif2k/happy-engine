"use strict";
// punk_girl: a punk girl: young, a pink mohawk, heavy violet eye shadow and black liner, dark red lips, freckles, a black tank top, ripped dark jeans and boots. A person of the lite human (system/human_lite_studio.js): ONE JS FILE IS ONE CREATURE, the `human` of its body is the definition of the person (the sliders that differ from the default body, the look, the clothes and the hair).
// Its TEXTURE is the person's SKIN (SYSTEM.md "The skin of the human"): the body is drawn from one colour picture made when the person is built, from the pack's base skin and the `layers` below: the lines of age, freckles, stubble, brows, lips, makeup.
return {
  name: "punk_girl", max: 16,
  family: { faction: "folk", kind: "person", hp: 100 },
  nav: { agent: "person" },
  body: {
    human: {
     "model": "lite",
     "shape": {
      "gender": 0,
      "age": 0.22,
      "height": -0.1,
      "weight": 0.3,
      "muscle": 0.2,
      "asian": 0.5,
      "caucasian": 0.5,
      "african": 0,
      "bust_size": 0.4
     },
     "look": {
      "tone": 0.2,
      "undertone": 0.2,
      "ruddy": 0.2
     },
     "hair": {
      "style": "mohawk",
      "colour": [
       0.9,
       0.18,
       0.5
      ],
      "volume": 0.7
     },
     "clothes": [
      {
       "kind": "jeans",
       "colour": [
        0.08,
        0.08,
        0.1
       ]
      },
      {
       "kind": "tank",
       "colour": [
        0.05,
        0.05,
        0.05
       ]
      },
      {
       "kind": "boots",
       "colour": [
        0.06,
        0.05,
        0.05
       ]
      }
     ],
     "skin": {
      "size": 512,
      "layers": [
       {
        "kind": "brows",
        "style": "arched",
        "colour": [
         0.03,
         0.025,
         0.03
        ],
        "thick": 0.5
       },
       {
        "kind": "makeup",
        "shadow": {
         "colour": "violet",
         "strength": 1
        },
        "liner": {
         "colour": "black",
         "strength": 1
        },
        "nails": {
         "colour": "black",
         "strength": 0.9
        }
       },
       {
        "kind": "lips",
        "colour": "dark_red",
        "strength": 0.85,
        "gloss": 0.4
       },
       {
        "kind": "freckles",
        "amount": 0.5,
        "size": 0.8,
        "seed": 3
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
      var tree = { name: "punk_girl", select: [ld.node("flee"), ld.node("greet"), ld.node("use"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
