"use strict";
// big_guy: the Big Guy of OpenGameArt (a hunched brute whose arms are bigger than his body: giant shoulders, a huge chest, arms that reach the floor, a small bald head, short legs in baggy grey trousers and brown shoes) made from the LITE HUMAN by turning its
// sliders (system.human): a man at full muscle and a heavy weight, wide shoulders, a big chest, very long arms, short legs, a small head, a heavy jaw and brow, a ruddy skin, with trousers and shoes. ONE JS FILE IS ONE CREATURE: the `human` of its body is the definition of the person.
return {
  name: "big_guy", max: 16,
  family: { faction: "monster", kind: "person", hp: 200 },
  nav: { agent: "person" },
  body: {
    human: {
      model: "lite",
      shape: {
        gender: 1, age: 0.5, muscle: 1, weight: 1.2, height: 0.15, scale: 1.0,
        shoulders: 1, chest: 2, belly: 0.3, hips: -0.3, butt: 0, thighs: 0.6,
        torso_length: 0.2, leg_length: -0.5, arm_length: 0.6,
        head_size: -0.5, jaw: 0.9, chin: 0.5, brow: 0.9, nose_size: 0.3, nose_width: 0.4, mouth_width: 0.5, ears: 0.2, cheeks: 0.3, eye_spacing: 0.1,
        caucasian: 1, african: 0, asian: 0
      },
      // THE MUTATION SET BY HAND (human_lite_mutate: `genes`): each part of the body made bigger or smaller, a factor of its length and its girth: the shoulders wide, the arms long and thick down to hands as big as heads, a hunched back and a small head on a thick neck,
      // short thick legs, big feet, a heavy jaw and brow, a swollen chest
      mutate: { genes: {
        bones: {
          "clavicle.*": { length: 1.4 },
          "upperarm.*": { length: 1.3, girth: 1.55 }, "lowerarm.*": { length: 1.4, girth: 1.55 },
          "hand.*": { length: 1.7, girth: 1.5 }, "fingers1.*": { length: 1.2, girth: 1.4 }, "fingers2.*": { length: 1.2, girth: 1.4 }, "thumb.*": { length: 1.2, girth: 1.4 },
          spine1: { bend: 8 }, spine2: { bend: 12, girth: 1.2 }, spine3: { bend: 10, girth: 1.3 }, neck: { bend: -14, girth: 1.25 },
          head: { length: 0.78, girth: 0.78 }, jaw: { girth: 1.3 },
          "thigh.*": { length: 0.72, girth: 1.2 }, "shin.*": { length: 0.72, girth: 1.2 }, "foot.*": { length: 1.3, girth: 1.2 }
        },
        push: { brow: 0.02 },
        swell: { chest: { r: 0.17, h: 0.07 } }
      } },
      look: { tone: 0.2, undertone: 0.6, ruddy: 1 },
      clothes: [
        { kind: "trousers", colour: [0.62, 0.64, 0.68] },
        { kind: "shoes", colour: [0.5, 0.2, 0.1] }
      ]
    }
  },
  abilities: ["walk", "open", "climb", "use", "effects"],
  interaction: { uses: ["sit", "sleep", "eat", "use"] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 200 }],
      "needs",
      ["use", { kinds: [], clip_sit: "sit_chair", clip_sleep: "lie_on_back" }],
      ["flee", { gait: "" }],
      ["greet", { meet: 6 }],
      "curious",
      "idle_life",
      "injured",
      ["wander", { speed: 0.9 }]
    ],
    worker: function (api, ld) {
      var tree = { name: "big_guy", select: [ld.node("flee"), ld.node("greet"), ld.node("use"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
