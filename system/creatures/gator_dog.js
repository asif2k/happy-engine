// gator_dog: in soma's one form of a creature file (soma/creature_file.js): `body` is the creature as it was made, the rest is who it is to the others (family, nav, abilities) and its mind: the blocks of soma/world/blocks/ it loads by name and
// its tree (an animal's own clips: the clip set `quad/dog`). The old worker of this file is left out; the mind below is the default of a creature of its kind (animal): write the creature's own in `mind`.
// gator_dog: a creature MADE OF THE PARTS CATALOGUE'S PIECES (mixed, alligator dog): built by soma/tools/piece_creatures.js from its recipe soma/creator/saved/gator_dog.creator.json (the recipe is the source of truth:
// `node soma/tools/piece_creatures.js regenerate gator_dog` makes this file again after a piece of the catalogue is built again). The creator studio opens it for modification: /soma/soma_creator_studio_demo.jh?creator=/soma/creatures/gator_dog.js
// CREDITS: the pieces were cut out of these models of the rigged corpus (D:\work\glb_skinned_meshes: the corpus keeps no author or licence fields; title and uid as the corpus has them):
//   "Dobermann Pinscher Dog Breed (Game Ready)" (uid 0fac0d10232e414e8fe077d9d108747d, mammals_domestic/0fac0d10232e414e8fe077d9d108747d_Dobermann_Pinscher_Dog_Breed_(Game_Ready).glb): dobermann_pinscher_dog_breed_torso, dobermann_pinscher_dog_breed_leg_fl, dobermann_pinscher_dog_breed_leg_hl, dobermann_pinscher_dog_breed_neck
//   "Alligator Rigged" (uid d2907726b76f43d59e3a0f59ec657bfb, reptiles_amphibians/d2907726b76f43d59e3a0f59ec657bfb_Alligator_Rigged.glb): alligator_head
//   "Saltwater crocodile" (uid 94ef0bb46ee0400ea32847d2be83ae3e, reptiles_amphibians/94ef0bb46ee0400ea32847d2be83ae3e_Saltwater_crocodile.glb): saltwater_crocodile_tail
"use strict";
// gator_dog: an alligator dog: the Dobermann's torso, legs and neck with an alligator's head and a saltwater crocodile's tail. Made by the creature creator (soma/creator/creator.js, SOMA.md "The creator") from the `creator` object at the end of this file:
// the studio opens it again from that object (creator.from_definition). ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature. Metres, +x to its left, +y up, +z forward.
const skeleton = [
  {"name":"root","parent":null,"head":[0.00033,0.68827,-0.30871],"tail":[0.00033,0.68326,-0.15358]},
  {"name":"torso_spine_1","parent":"root","head":[0.00033,0.68326,-0.15358],"tail":[0.00033,0.67815,-0.01246]},
  {"name":"torso_spine_2","parent":"torso_spine_1","head":[0.00033,0.67815,-0.01246],"tail":[0.00033,0.67052,0.12878]},
  {"name":"torso_spine_3","parent":"torso_spine_2","head":[0.00033,0.67052,0.12878],"tail":[0.00033,0.68118,0.26995]},
  {"name":"torso_spine_4","parent":"torso_spine_3","head":[0.00033,0.68118,0.26995],"tail":[0.00033,0.68828,0.41113]},
  {"name":"torso_spine_5","parent":"torso_spine_4","head":[0.00033,0.68828,0.41113],"tail":[0.00033,0.76394,0.50432]},
  {"name":"torso_clavicle_l","parent":"torso_spine_5","head":[0.08754,0.68828,0.41113],"tail":[0.11919,0.58623,0.46051]},
  {"name":"torso_clavicle_r","parent":"torso_spine_5","head":[-0.08366,0.68828,0.41113],"tail":[-0.11531,0.58623,0.46051]},
  {"name":"torso_pelvis_b1","parent":"root","head":[0.00033,0.7808,-0.32623],"tail":[0.00033,0.7818,-0.32623]},
  {"name":"torso_pelvis_b2","parent":"root","head":[0.00033,0.76913,-0.25456],"tail":[0.00033,0.77013,-0.25456]},
  {"name":"fore_thigh_l","parent":"torso_clavicle_l","head":[0.11919,0.58623,0.46051],"tail":[0.11449,0.4284,0.39197],"mirror":"x"},
  {"name":"fore_shin_l","parent":"fore_thigh_l","head":[0.11449,0.4284,0.39197],"tail":[0.1061,0.13845,0.40072],"mirror":"x"},
  {"name":"fore_cannon_l","parent":"fore_shin_l","head":[0.1061,0.13845,0.40072],"tail":[0.1061,0.04,0.42463],"mirror":"x"},
  {"name":"fore_foot_l","parent":"fore_cannon_l","head":[0.1061,0.04,0.42463],"tail":[0.1061,0.00548,0.54118],"mirror":"x"},
  {"name":"fore_toe_l","parent":"fore_foot_l","head":[0.1061,0.00548,0.54118],"tail":[0.1061,0.00648,0.54118],"mirror":"x"},
  {"name":"hind_thigh_l","parent":"root","head":[0.11151,0.59306,-0.34495],"tail":[0.11793,0.46258,-0.29399],"mirror":"x"},
  {"name":"hind_shin_l","parent":"hind_thigh_l","head":[0.11793,0.46258,-0.29399],"tail":[0.14599,0.2601,-0.42463],"mirror":"x"},
  {"name":"hind_foot_l","parent":"hind_shin_l","head":[0.14599,0.2601,-0.42463],"tail":[0.1503,0.04647,-0.39136],"mirror":"x"},
  {"name":"hind_toe_l","parent":"hind_foot_l","head":[0.1503,0.04647,-0.39136],"tail":[0.1503,-0.00071,-0.39136],"mirror":"x"},
  {"name":"neck_1","parent":"torso_spine_5","head":[0.00033,0.76394,0.50432],"tail":[0.00033,0.8757,0.57276]},
  {"name":"neck_2","parent":"neck_1","head":[0.00033,0.8757,0.57276],"tail":[0.00033,0.95899,0.66677]},
  {"name":"neck_3","parent":"neck_2","head":[0.00033,0.99782,0.60348],"tail":[0.00033,0.99882,0.60348]},
  {"name":"head_head","parent":"neck_2","head":[0.00033,0.95899,0.66677],"tail":[0.04924,0.94087,0.79494]},
  {"name":"head_head_2","parent":"head_head","head":[-0.03583,0.82437,0.76615],"tail":[-0.03578,0.82472,0.76629]},
  {"name":"head_mouth_left","parent":"head_head","head":[0.06168,0.89129,0.71001],"tail":[0.06173,0.89164,0.71015]},
  {"name":"head_mouth_right","parent":"head_head","head":[-0.07858,0.91644,0.70042],"tail":[-0.07852,0.91679,0.70056]},
  {"name":"head_eye_l","parent":"head_head","head":[0.05345,0.95669,0.79386],"tail":[0.05351,0.95705,0.794]},
  {"name":"head_eye_r","parent":"head_head","head":[-0.06487,0.97611,0.78704],"tail":[-0.06482,0.97646,0.78718]},
  {"name":"head_eye_left","parent":"head_head","head":[0.05278,0.96819,0.81209],"tail":[0.05283,0.96854,0.81223]},
  {"name":"head_eye_right","parent":"head_head","head":[-0.06313,0.99255,0.79359],"tail":[-0.06308,0.9929,0.79373]},
  {"name":"head_eye_2_r","parent":"head_head","head":[-0.06465,0.9586,0.78587],"tail":[-0.0646,0.95895,0.78601]},
  {"name":"head_eye_2_l","parent":"head_head","head":[0.04924,0.94087,0.79494],"tail":[0.04929,0.94122,0.79508]},
  {"name":"tail_1","parent":"root","head":[0.00033,0.70375,-0.22758],"tail":[0.00033,0.69041,-0.48996]},
  {"name":"tail_2","parent":"tail_1","head":[0.00033,0.69041,-0.48996],"tail":[0.00033,0.68049,-0.73686]},
  {"name":"tail_3","parent":"tail_2","head":[0.00033,0.68049,-0.73686],"tail":[0.00033,0.66758,-0.97286]},
  {"name":"tail_4","parent":"tail_3","head":[0.00033,0.66758,-0.97286],"tail":[0.00033,0.6614,-1.23063]},
  {"name":"tail_5","parent":"tail_4","head":[0.00033,0.6614,-1.23063],"tail":[0.00033,0.65591,-1.50462]},
  {"name":"tail_6","parent":"tail_5","head":[0.00033,0.65591,-1.50462],"tail":[0.00033,0.64796,-1.80925]},
  {"name":"tail_7","parent":"tail_6","head":[0.00033,0.64796,-1.80925],"tail":[0.00033,0.63136,-2.11314]},
  {"name":"tail_8","parent":"tail_7","head":[0.00033,0.63136,-2.11314],"tail":[0.00034,0.61604,-2.33804]},
  {"name":"tail_9","parent":"tail_8","head":[0.00034,0.61604,-2.33804],"tail":[0.00034,0.61657,-2.33804]},
];
const rig = {
  joints: [
    {"bone":"fore_thigh_l","kind":"ball","fwd":70,"back":60,"out":30,"in":20,"twist":20,"mirror":"x"},
    {"bone":"fore_shin_l","kind":"hinge","axis":[-1,0.029,0.002],"range":[-31,115],"mirror":"x"},
    {"bone":"fore_cannon_l","kind":"hinge","axis":[-0.99,0.033,0.135],"range":[-18,103],"mirror":"x"},
    {"bone":"fore_foot_l","kind":"ball","fwd":30,"back":30,"lat":15,"twist":15,"mirror":"x"},
    {"bone":"hind_thigh_l","kind":"ball","fwd":70,"back":60,"out":30,"in":20,"twist":20,"mirror":"x"},
    {"bone":"hind_shin_l","kind":"hinge","axis":[0.993,0.082,0.086],"range":[-60,86],"mirror":"x"},
    {"bone":"hind_foot_l","kind":"ball","fwd":30,"back":30,"lat":15,"twist":15,"mirror":"x"},
    {"bone":"neck_1","kind":"ball","fwd":50,"back":50,"lat":50,"twist":20},
    {"bone":"neck_2","kind":"ball","fwd":50,"back":50,"lat":50,"twist":20},
    {"bone":"tail_1","kind":"ball","fwd":19,"back":19,"lat":19,"twist":20},
    {"bone":"tail_2","kind":"ball","fwd":19,"back":19,"lat":19,"twist":20},
    {"bone":"tail_3","kind":"ball","fwd":19,"back":19,"lat":19,"twist":20},
    {"bone":"tail_4","kind":"ball","fwd":19,"back":19,"lat":19,"twist":20},
    {"bone":"tail_5","kind":"ball","fwd":19,"back":19,"lat":19,"twist":20},
    {"bone":"tail_6","kind":"ball","fwd":19,"back":19,"lat":19,"twist":20},
    {"bone":"tail_7","kind":"ball","fwd":19,"back":19,"lat":19,"twist":20},
    {"bone":"tail_8","kind":"ball","fwd":19,"back":19,"lat":19,"twist":20},
  ],
  chains: [
    {"name":"fore_l","bones":["fore_thigh_l","fore_shin_l","fore_cannon_l"],"solver":"z_leg","tip":"fore_foot_l","pole":[-0.014,0.066,-0.998],"pole_w":1,"mirror":"x"},
    {"name":"hind_l","bones":["hind_thigh_l","hind_shin_l"],"solver":"limb","tip":"hind_foot_l","pole":[-0.064,-0.238,0.969],"pole_w":1,"mirror":"x"},
    {"name":"neck","bones":["neck_1","neck_2"]},
    {"name":"tail","bones":["tail_1","tail_2","tail_3","tail_4","tail_5","tail_6","tail_7","tail_8"]},
  ],
};
const legs = {"legs":[{"chain":"fore_l","mirror":"x","foot_height":0.03496},{"chain":"hind_l","mirror":"x","foot_height":0.2601}],"gait":{"from":"pinscher_dobermann_dog_walk","ride":0.6711}};
const body = {"gravity":9.8,"turn_rate":2.09,"max_speed":3};
const roles = {"hips":"root","spine":["torso_spine_1","torso_spine_2","torso_spine_3","torso_spine_4","torso_spine_5"],"neck":["neck_1","neck_2","neck_3"],"head":"head_head","eyes":["head_eye_l","head_eye_r","head_eye_left","head_eye_right","head_eye_2_r","head_eye_2_l"],"tail":["tail_1","tail_2","tail_3","tail_4","tail_5","tail_6","tail_7","tail_8","tail_9"],"mouth":{"corners":["head_head_2","head_mouth_left","head_mouth_right"]}};
const traits = {"tail":2,"ears":1.3,"fidget":1.2};
const physics = {"mass":135.086,"shapes":[{"id":"body","shape":"capsule","a":[0.00012,0.64783,-0.25469],"b":[0.00012,0.64783,0.41666],"radius":0.147,"bone":"root"},{"id":"head","shape":"sphere","center":[-0.00362,0.86282,0.84587],"radius":0.268,"bone":"head_head"},{"id":"fore_l","shape":"capsule","a":[0.11919,0.52987,0.46051],"b":[0.1061,0.06764,0.42463],"radius":0.039,"mirror":"x"},{"id":"hind_l","shape":"capsule","a":[0.11151,0.55478,-0.34495],"b":[0.14599,0.04594,-0.42463],"radius":0.033,"mirror":"x"}]};
const parts = [
  {"id":"torso_0","shape":"volume","volume":"dobermann_pinscher_dog_breed_torso","origin":[0.00033,0.68827,-0.30871],"rotate":[0,0,0],"scale":1,"bone":"root","bone_map":{"@host":"root","torso_pelvis":"root","torso_spine_1":"torso_spine_1","torso_spine_2":"torso_spine_2","torso_spine_3":"torso_spine_3","torso_spine_4":"torso_spine_4","torso_spine_5":"torso_spine_5","torso_clavicle_l":"torso_clavicle_l","torso_clavicle_r":"torso_clavicle_r","torso_pelvis_b1":"torso_pelvis_b1","torso_pelvis_b2":"torso_pelvis_b2","@neck":"neck_1","@leg_f_l":"fore_thigh_l","@leg_f_r":"fore_thigh_r","@leg_h_l":"hind_thigh_l","@leg_h_r":"hind_thigh_r"}},
  {"id":"fore_thigh_0","shape":"volume","volume":"dobermann_pinscher_dog_breed_leg_fl","origin":[0.11919,0.58623,0.46051],"rotate":[0,0,0],"scale":1,"mirror":"x","bone":"torso_clavicle_l","bone_map":{"@host":"torso_clavicle_l","leg_thigh_l":"fore_thigh_l","leg_shin_l":"fore_shin_l","leg_cannon_l":"fore_cannon_l","leg_foot_l":"fore_foot_l","leg_toe_l":"fore_toe_l","Wolf_r_Clavicle_01_01SHJnt_13":"torso_clavicle_r","Wolf_Neck_01SHJnt_35":"neck_1","Wolf_r_FrontLeg_HipSHJnt_12":"fore_thigh_r"},"blend":0.01963,"blend_mode":"cubic"},
  {"id":"hind_thigh_0","shape":"volume","volume":"dobermann_pinscher_dog_breed_leg_hl","origin":[0.11151,0.59306,-0.34495],"rotate":[-0.00053,0,-0.00001],"scale":1.00931,"mirror":"x","bone":"root","bone_map":{"@host":"root","leg_thigh_l":"hind_thigh_l","leg_shin_l":"hind_shin_l","leg_foot_l":"hind_foot_l","leg_toe_l":"hind_toe_l","Wolf_Spine_01SHJnt_40":"torso_spine_1","Wolf_r_HindLeg_HipSHJnt_52":"hind_thigh_r","Wolf_ROOTSHJnt.002_54":"torso_pelvis_b2","Wolf_Spine_02SHJnt_39":"torso_spine_2"},"blend":0.01657,"blend_mode":"cubic"},
  {"id":"neck_1_0","shape":"volume","volume":"dobermann_pinscher_dog_breed_neck","origin":[0.00033,0.76394,0.50432],"rotate":[0,0,0],"scale":1,"bone":"torso_spine_5","bone_map":{"@host":"torso_spine_5","neck_1":"neck_1","neck_2":"neck_2","neck_3":"neck_3","@wolf_neck_top":"head_head","Wolf_l_Clavicle_01_01SHJnt_7":"torso_clavicle_l","Wolf_r_Clavicle_01_01SHJnt_13":"torso_clavicle_r","Wolf_l_FrontLeg_HipSHJnt_6":"fore_thigh_l","Wolf_r_FrontLeg_HipSHJnt_12":"fore_thigh_r"},"blend":0.02709,"blend_mode":"cubic"},
  {"id":"head_head_0","shape":"volume","volume":"alligator_head","origin":[0.00033,0.95899,0.66677],"rotate":[21.43447,-2.82784,-9.71253],"scale":0.38166,"bone":"neck_2","bone_map":{"@host":"neck_2","head_head":"head_head","head_head_2":"head_head_2","head_mouth_left":"head_mouth_left","head_mouth_right":"head_mouth_right","head_eye_l":"head_eye_l","head_eye_r":"head_eye_r","head_eye_left":"head_eye_left","head_eye_right":"head_eye_right","head_eye_2_r":"head_eye_2_r","head_eye_2_l":"head_eye_2_l"},"blend":0.05344,"blend_mode":"cubic","roughness":0.054,"metal":0.997},
  {"id":"tail_1_0","shape":"volume","volume":"saltwater_crocodile_tail","origin":[0.00033,0.70375,-0.22758],"rotate":[0,0,0],"scale":0.52653,"bone":"root","bone_map":{"@host":"root","tail_1":"tail_1","tail_2":"tail_2","tail_3":"tail_3","tail_4":"tail_4","tail_5":"tail_5","tail_6":"tail_6","tail_7":"tail_7","tail_8":"tail_8","tail_9":"tail_9"},"blend":0.04261,"blend_mode":"cubic","roughness":0.5,"metal":0.7},
];
const sdf = Object.assign({"cell":0.0334,"decimate":{"ratio":0.4},"skin":{"falloff":1.5,"seam":1},"shade":{"ao":0.45,"ao_radius":0.1002,"tone":0.2,"color_blend":1},"volumes":{"dobermann_pinscher_dog_breed_torso":{"hash":"5527e94a","piece":"/soma/parts/catalog/torso/dobermann_pinscher_dog_breed_torso.somapart","bake":{"cell":0.0186,"band":6}},"dobermann_pinscher_dog_breed_leg_fl":{"hash":"cb740902","piece":"/soma/parts/catalog/leg/dobermann_pinscher_dog_breed_leg_fl.somapart","bake":{"cell":0.0186,"band":6}},"dobermann_pinscher_dog_breed_leg_hl":{"hash":"ad4a3a4f","piece":"/soma/parts/catalog/leg/dobermann_pinscher_dog_breed_leg_hl.somapart","bake":{"cell":0.0186,"band":6}},"dobermann_pinscher_dog_breed_neck":{"hash":"1cc2a058","piece":"/soma/parts/catalog/neck/dobermann_pinscher_dog_breed_neck.somapart","bake":{"cell":0.0186,"band":6}},"alligator_head":{"hash":"abeffdcc","piece":"/soma/parts/catalog/head/alligator_head.somapart","bake":{"cell":0.0526,"band":6}},"saltwater_crocodile_tail":{"hash":"b5f4a3a7","piece":"/soma/parts/catalog/tail/saltwater_crocodile_tail.somapart","bake":{"cell":0.0372,"band":6}}}}, { parts: parts });
const material = {"roughness":0.72,"metal":0};
const creator = {"format":"soma.creator","version":1,"name":"gator_dog","description":"an alligator dog: the Dobermann's torso, legs and neck with an alligator's head and a saltwater crocodile's tail","torso":{"shape":"piece","size":[0.3203,0.44307,0.96602],"axis":"z","round":0,"color":[0.031,0.019,0.017],"piece":"dobermann_pinscher_dog_breed_torso","scale":1},"parts":[{"id":"fore","preset":"piece","params":{"piece":"dobermann_pinscher_dog_breed_leg_fl","scale":1,"blend":-1,"inset":-1,"turn_x":0,"turn_y":0,"turn_z":0,"flap":true,"thin":"auto","roughness":-1,"metal":-1},"attach":{"bone":"torso_clavicle_l","t":1,"dir":[-0.201619,0.620553,0.757802],"socket":"leg_f_l"},"mirror":"x","color":null,"colors":{},"ik":{"on":true},"walk":true,"roles":{}},{"id":"hind","preset":"piece","params":{"piece":"dobermann_pinscher_dog_breed_leg_hl","scale":1,"blend":-1,"inset":-1,"turn_x":0,"turn_y":0,"turn_z":0,"flap":true,"thin":"auto","roughness":-1,"metal":-1},"attach":{"bone":"root","t":0,"dir":[0.73729,-0.21982,0.638813],"socket":"leg_h_l"},"mirror":"x","color":null,"colors":{},"ik":{"on":true},"walk":true,"roles":{}},{"id":"neck","preset":"piece","params":{"piece":"dobermann_pinscher_dog_breed_neck","scale":1,"blend":-1,"inset":-1,"turn_x":0,"turn_y":0,"turn_z":0,"flap":true,"thin":"auto","roughness":-1,"metal":-1},"attach":{"bone":"torso_spine_5","t":1,"dir":[0,0.942961,-0.332904],"socket":"neck"},"mirror":false,"color":null,"colors":{},"ik":{"on":true},"roles":{}},{"id":"head","preset":"piece","params":{"piece":"alligator_head","scale":0.4,"blend":-1,"inset":-1,"turn_x":0,"turn_y":0,"turn_z":0,"flap":true,"thin":"auto","roughness":-1,"metal":-1},"attach":{"bone":"neck_2","t":1,"dir":[0.35341,0.606467,0.712249],"socket":"neck.wolf_neck_top"},"mirror":false,"color":null,"colors":{},"ik":{"on":false},"roles":{}},{"id":"tail","preset":"piece","params":{"piece":"saltwater_crocodile_tail","scale":0.45,"blend":-1,"inset":-1,"turn_x":0,"turn_y":0,"turn_z":0,"flap":true,"thin":"auto","roughness":-1,"metal":-1},"attach":{"bone":"root","t":0,"dir":[0,-0.966602,-0.256281]},"mirror":false,"color":null,"colors":{},"ik":{"on":true},"roles":{}}],"pieces":{"dobermann_pinscher_dog_breed_torso":{"hash":"5527e94a","file":"/soma/parts/catalog/torso/dobermann_pinscher_dog_breed_torso.somapart"},"dobermann_pinscher_dog_breed_leg_fl":{"hash":"cb740902","file":"/soma/parts/catalog/leg/dobermann_pinscher_dog_breed_leg_fl.somapart"},"dobermann_pinscher_dog_breed_leg_hl":{"hash":"ad4a3a4f","file":"/soma/parts/catalog/leg/dobermann_pinscher_dog_breed_leg_hl.somapart"},"dobermann_pinscher_dog_breed_neck":{"hash":"1cc2a058","file":"/soma/parts/catalog/neck/dobermann_pinscher_dog_breed_neck.somapart"},"alligator_head":{"hash":"abeffdcc","file":"/soma/parts/catalog/head/alligator_head.somapart"},"saltwater_crocodile_tail":{"hash":"b5f4a3a7","file":"/soma/parts/catalog/tail/saltwater_crocodile_tail.somapart"}},"roles":{},"soft":{},"material":{},"settings":{"gait":"auto","pattern":"auto","slack":0.05,"center":true,"face_roles":true,"soft_roles":true,"body":{"turn_rate":2.09,"max_speed":3},"physics":"auto","traits":{"tail":2,"ears":1.3,"fidget":1.2},"flight":"auto","wave":"auto","sdf":{},"vehicle":"auto","aircraft":"auto","rotors":"auto"},"ui":{"library":{"built_from":"pieces","kind":"mixed","species":"alligator dog","sources":[{"uid":"0fac0d10232e414e8fe077d9d108747d","title":"Dobermann Pinscher Dog Breed (Game Ready)"},{"uid":"d2907726b76f43d59e3a0f59ec657bfb","title":"Alligator Rigged"},{"uid":"94ef0bb46ee0400ea32847d2be83ae3e","title":"Saltwater crocodile"}],"recipe":"soma/creator/saved/gator_dog.creator.json"}}};
return {
  name: "gator_dog", max: 16,
  family: { faction: "animal", kind: "animal", hp: 79 },
  nav: { agent: { name: "gator_dog", radius: 0.71, height: 1.1, step: 0.2, slope: 35, drop: 0.3 } },
  body: {
    skeleton: skeleton,
    rig: rig,
    legs: legs,
    body: body,
    roles: roles,
    traits: traits,
    physics: physics,
    sdf: sdf,
    material: material,
    creator: creator
  },
  abilities: ["walk", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 79 }],
      ["flee", { speed: 3.6, distance: 9 }],
      ["curious", { approach: 0.3, cooldown: 20, near: 2.1 }],
      ["idle_life", { clip_look: "dog_idle_2", clip_stretch: "dog_idle_3", clip_shift: "dog_idle", clip_sit: "dog_rest_2" }],
      ["injured", { clip_flinch: "" }],
      ["wander", { speed: 1.35, near: 0.8 }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first; the blocks without a node (health, needs, injured) act through their hooks.
    worker: function (api, ld) {
      var tree = { name: "gator_dog", select: [ld.node("flee"), ld.node("curious"), ld.node("idle_life"), ld.node("wander")] };
      return { tree: tree };
    }
  }
};
