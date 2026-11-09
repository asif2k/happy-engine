"use strict";
// tribal_chief: a tribal chief: dark skin, a strong build, a shaved head, brows painted thick and a grey goatee, a bare chest under a leather vest. A person of the lite human (system/human_lite_studio.js): ONE JS FILE IS ONE CREATURE, the `human` of its body is the definition of the person (the sliders that differ from the default body, the look, the clothes and the hair).
// Its TEXTURE is the person's SKIN (SYSTEM.md "The skin of the human"): the body is drawn from one colour picture made when the person is built, from the pack's base skin and the `layers` below: the lines of age, freckles, stubble, brows, lips, makeup.
return {
  name: "tribal_chief", max: 16,
  family: { faction: "folk", kind: "person", hp: 100 },
  nav: { agent: "person" },
  body: {
    human: {
     "model": "lite",
     "shape": {
      "gender": 1,
      "age": 0.6,
      "height": 0.7,
      "weight": 0.5,
      "muscle": 0.85,
      "african": 1,
      "caucasian": 0,
      "asian": 0,
      "jaw": 0.5,
      "chest": 0.5
     },
     "look": {
      "tone": 0.92,
      "undertone": 0.2,
      "ruddy": 0.1
     },
     "hair": {
      "style": "bald"
     },
     "beard": {
      "style": "goatee",
      "colour": [
       0.78,
       0.78,
       0.76
      ],
      "length": 0.5
     },
     "clothes": [
      {
       "kind": "trousers",
       "colour": [
        0.42,
        0.3,
        0.16
       ]
      },
      {
       "kind": "vest",
       "colour": [
        0.3,
        0.17,
        0.08
       ]
      }
     ],
     "skin": {
      "size": 512,
      "layers": [
       {
        "kind": "age",
        "amount": 0.4
       },
       {
        "kind": "brows",
        "style": "thick",
        "colour": [
         0.03,
         0.025,
         0.02
        ],
        "thick": 0.9
       },
       {
        "kind": "mustache",
        "style": "pencil",
        "colour": [
         0.78,
         0.78,
         0.76
        ],
        "thick": 0.4
       },
       {
        "kind": "stubble",
        "amount": 0.3,
        "colour": [
         0.55,
         0.55,
         0.54
        ]
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
      var tree = { name: "tribal_chief", select: [ld.node("flee"), ld.node("greet"), ld.node("use"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
