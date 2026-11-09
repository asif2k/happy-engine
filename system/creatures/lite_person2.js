"use strict";
// lite_person: a person of the lite human, made in its studio (system/human_lite_studio.js). ONE JS FILE IS ONE CREATURE: the `human` of its body is the definition of the person; the sliders are the ones that differ from the default body.
return {
  name: "lite_person", max: 16,
  family: { faction: "folk", kind: "person", hp: 100 },
  nav: { agent: "person" },
  body: {
    human: {
     "model": "lite",
     "shape": {
      "gender": 0,
      "bust_size": 0.97
     },
     "soft": {
      "generate": true
     },
     "skin": true
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
      var tree = { name: "lite_person", select: [ld.node("flee"), ld.node("greet"), ld.node("use"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
