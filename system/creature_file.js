// THE CREATURE FILE: the one form of a creature as text (a JS file run as the body of a function, ending with `return { name, family, nav, body, abilities, interaction, ... }`): read, checked, turned into a species definition and its mind.
// Kept from the first version's generators file (gen.js, which also held the registry and the weapon and unit generators: not in this repo). A packing module, kept by name where it is included (species.js: creature_file_libs).
packing()("happy_creature_file", function happy_creature_file() {
  "use strict";
  // HAPPY CREATURE FILE: the ONE form of every file of creatures/ (a creature of the library, and a creature that a world hosts: SYSTEM.md). One JS file, run as the body of a function with one argument (`api`, an empty object: nothing at load) that
  // RETURNS the definition. Where the old files were one flat object with a function for the worker inside, this one has sections, and its mind is DATA: the blocks its tree loads by name.
  //     return {
  //       name: "mannequin", max: 16,
  //       family: { faction: "folk", kind: "person", hp: 100, keys: 0 },        who it is to the others (the blackboard's record: faction, kind, health, the keys it holds as bits)
  //       nav: { agent: "person" },                                             where it may stand: a profile of the world's nav, or its own { name, radius, height, step, slope, drop }
  //       body: { skeleton, rig, legs, body, roles, traits, sdf, physics, ... },  everything system's compile takes (SYSTEM.md): what it is made of and how it moves
  //       abilities: ["walk", "open", "climb", "use", "grab"],                  what it can do to the world (a block that needs one that the creature lacks is refused)
  //       interaction: { uses: ["sit", "sleep", "eat"] },                       which affordances it knows how to use
  //       mind: { hz: 6, far_hz: 2, blocks: ["health", ["use", { max_time: 30 }], "wander"],
  //               worker: function (api, ld) { return { tree: { select: [ld.node("use"), ld.node("wander")] }, hooks: {} }; } }
  //     };
  //   `mind.blocks` is what the creature loads (world/blocks/, pure.js): a name, [name, settings] or { block, params }: the settings are the creature's own values for the block's parameters (the block lists them
  //   with their defaults). `mind.worker` is the creature's WORKER, and it is NOT OPTIONAL: a creature declares its TREE. It is an ES5 function written as `function (api, ld) { ... }` that runs in the worker with the loaded blocks and
  //   returns { tree, hooks? }: the tree is written out (the AI editor draws it), the nodes of the blocks are put in it with `ld.node("name")`, and `hooks` are the creature's own (they join the blocks'). Its source is sent as text: it takes
  //   everything from `api` and `ld`. The rates `hz` and `far_hz` are the tree's visits a second.
  //   compile(c, { required: [block names], give: [{ blocks, props, remove }] }) -> { def, cfg, agent }   (required: what the world demands of every creature it hosts: appended to mind.blocks when the creature does not list it; give: what the world gives
  //   this creature, w.give: blocks added or given settings (the world's win), blocks taken away, settings of paths)
  //   body_def(c) -> def      the flat definition system.species takes, with no mind (the lab, the designers, the studios read a creature this way: { ...c.body, name, max_instances })
  //   defaults(def, o) -> { kind, family, nav, abilities, interaction, mind }      what a body that has nothing else is given (the body's legs, wings, wheels and size decide; o: { kind, hp, clips, name })
  //   tail(name, entries, def, o) -> text      the final `return { ... };` of a file (entries: ["skeleton: skeleton", ...] the body's keys, as source) with those defaults: how every writer of a creature file ends it
  //   `particles` (optional): what the creature asks the world's particle system to play and where on its body ({ name: { effect, mount: { bone, at, dir }, loop | once, scale } }: runtime.js); it needs the ability "effects"
  //   WEAPONS: a weapon is a prop, and the ones that more than one creature carries are in a LIBRARY (weapons/*.js, one file each, put into this file by `node tools/weapons_build.js`): `props: { rifle: api.weapon("assault_rifle", { rest: {...}, start: "grip" }) }` is the library's
  //   prop (its sdf, its grip, its muzzle and shots, how it is aimed, its flash at the muzzle) with the creature's own say over it (a key of the second argument replaces the weapon's; `fire`, `aim` and `throw` are changed key by key). The flash of the muzzle becomes the creature's particle
  //   `<prop>_flash` (which the creature can say itself, or leave out with `flash: null`). A creature whose body has no arms mounts a weapon on a bone (`rest: { bone, at, dir }`: a turret's gun, a cradle) and its own body points it. CF.weapons: the library ({ name: { title, kind, about, prop } })
  //   `props` (optional): the things that only this creature and its family know, each a species of its own that the family keeps a pool of ({ name: { sdf | mesh, grip, rest, scale, per } }: runtime.js, SYSTEM.md "Family props"); it needs the ability "props".
  //   (`body.props` is another thing: an sdf island on a bone of the creature's own mesh.) In the flat definition system takes, the section is `family_props`
  //   compile(c, o) -> { def, cfg, agent }       def: what system.species takes (the body, the name, `worker`: the bootstrap that loads the blocks), cfg: the data the worker reads (api.cfg), agent: the nav profile
  //   to register in the world ({ name, radius, ... }) when the creature brings its own.      load(text) -> c      the file's text run
  // Node 14: no optional chaining, no ??. The bootstrap `boot` is ES5: it is sent to the worker as text.
  const TOP = ["name", "max", "family", "nav", "body", "abilities", "interaction", "mind", "particles", "props", "needs", "tags"];
  const FAMILY = ["faction", "kind", "hp", "keys"];
  const AGENT = ["name", "radius", "height", "step", "slope", "drop"];
  const MIND = ["hz", "far_hz", "blocks", "props", "worker"];
  const ABILITIES = ["walk", "open", "climb", "use", "grab", "carry", "melee", "ranged", "throw", "effects", "props", "social", "fly", "swim"];
  const fail = function (where, text) { throw new Error("happy_creature_file: " + where + ": " + text); };
  const known = function (where, o, keys) { for (const k in o) if (keys.indexOf(k) < 0) fail(where, "`" + k + "` is not a key (" + keys.join(", ") + ")"); };

  // ---- THE WEAPON LIBRARY: the weapons' files (weapons/*.js of the first repository), put here by a build tool that stayed there. A creature file is read as text and has no way to read another file, so the library is in the one module that reads it
  // BEGIN WEAPONS
  const WEAPONS = {
    "assault_rifle": {"title":"Assault rifle","kind":"rifle","about":"a wooden-stocked assault rifle: eight shots a second, a magazine to the creature's own count. Two hands: the grip, and the handguard.","prop":{"sdf":{"cell":0.006,"shade":{"ao":0.4,"ao_radius":0.02,"tone":0.1},"parts":[{"id":"receiver","shape":"box","center":[0,0.1025,-0.0775],"half":[0.026,0.13,0.036],"round":0.006,"color":[0.025,0.025,0.03,1]},{"id":"handguard","shape":"box","center":[0,0.3725,-0.0775],"half":[0.031,0.12,0.033],"round":0.01,"color":[0.24,0.13,0.06,1]},{"id":"barrel","shape":"capsule","a":[0,0.4825,-0.0775],"b":[0,0.8025,-0.0775],"radius":0.01,"color":[0.13,0.13,0.15,1]},{"id":"hider","shape":"cylinder","center":[0,0.8225,-0.0775],"axis":[0,1,0],"radius":0.016,"half":0.03,"color":[0.025,0.025,0.03,1]},{"id":"stock","shape":"box","center":[0,-0.1575,-0.0775],"half":[0.022,0.12,0.04],"round":0.01,"color":[0.24,0.13,0.06,1]},{"id":"grip","shape":"capsule","a":[0,0.0125,-0.0475],"b":[0,-0.0125,0.0475],"radius":0.017,"color":[0.24,0.13,0.06,1]},{"id":"magazine","shape":"capsule","a":[0,0.2025,-0.0475],"b":[0,0.1025,0.0825],"radius":0.018,"color":[0.06,0.06,0.07,1]},{"id":"sight","shape":"box","center":[0,0.6825,-0.1175],"half":[0.004,0.008,0.014],"color":[0.025,0.025,0.03,1]},{"id":"gas","shape":"cylinder","center":[0,0.6025,-0.1075],"axis":[0,1,0],"radius":0.01,"half":0.12,"color":[0.13,0.13,0.15,1]}]},"grip":{"along":0.09,"dir":[-0.127,0.694,0.709],"roll":-36.7,"hand":"main"},"rest":{"bone":"spine02","at":[0,0.1,-0.17],"dir":[0.4,1,0.05]},"fire":{"muzzle":{"at":[0,0.8625,-0.0775]},"range":140,"impulse":5,"damage":16,"spread":0.014,"rate":8,"modes":["auto","burst","single"],"burst":3,"velocity":900,"tracer":3},"aim":{"butt":[0,-0.275,-0.0775],"hands":[[0,0,0],[0,0.3,-0.02]],"pocket":[0.55,-0.02,0.05],"holds":[{"name":"grip","kind":"grip","at":[0,0,0],"axis":[0,0.254,-0.967],"from":[-1,-0.3,0],"radius":0.017,"hand":"main","trigger":true},{"name":"handguard","kind":"handguard","at":[0,0.27,-0.0775],"to":[0,0.45,-0.0775],"axis":[0,1,0],"from":[0,0,1],"radius":0.033,"hand":"off"}]},"flash":{"effect":"muzzle_flash_rifle","at":[0,0.8625,-0.0775],"scale":0.8},"particles":{"smoke":{"effect":"barrel_smoke","at":[0,0.8625,-0.0775],"dir":[0,0,-1],"once":"fire","scale":1},"eject":{"effect":"shell_eject","at":[-0.03,0.12,-0.0875],"dir":[-1,-0.4,-0.8],"once":"fire","scale":1}}}},
    "carbine": {"title":"Carbine","kind":"rifle","about":"a short black carbine with a rail and an optic: nine shots a second. Two hands: the grip, and the handguard.","prop":{"sdf":{"cell":0.006,"shade":{"ao":0.4,"ao_radius":0.02,"tone":0.1},"parts":[{"id":"receiver","shape":"box","center":[0,0.1025,-0.0775],"half":[0.026,0.13,0.036],"round":0.006,"color":[0.025,0.025,0.03,1]},{"id":"handguard","shape":"box","center":[0,0.3625,-0.0775],"half":[0.03,0.12,0.032],"round":0.008,"color":[0.11,0.12,0.14,1]},{"id":"barrel","shape":"capsule","a":[0,0.4625,-0.0775],"b":[0,0.7025,-0.0775],"radius":0.01,"color":[0.13,0.13,0.15,1]},{"id":"hider","shape":"cylinder","center":[0,0.7175,-0.0775],"axis":[0,1,0],"radius":0.016,"half":0.025,"color":[0.025,0.025,0.03,1]},{"id":"stock","shape":"box","center":[0,-0.1375,-0.0725],"half":[0.022,0.1,0.035],"round":0.008,"color":[0.025,0.025,0.03,1]},{"id":"grip","shape":"capsule","a":[0,0.0125,-0.0475],"b":[0,-0.0125,0.0475],"radius":0.017,"color":[0.06,0.06,0.07,1]},{"id":"magazine","shape":"box","center":[0,0.1625,0.0025],"half":[0.015,0.03,0.055],"round":0.004,"color":[0.06,0.06,0.07,1]},{"id":"rail","shape":"box","center":[0,0.2525,-0.1225],"half":[0.01,0.2,0.01],"color":[0.13,0.13,0.15,1]},{"id":"optic","shape":"box","center":[0,0.1825,-0.1455],"half":[0.016,0.04,0.018],"round":0.004,"color":[0.025,0.025,0.03,1]}]},"grip":{"along":0.09,"dir":[-0.127,0.694,0.709],"roll":-36.7,"hand":"main"},"rest":{"bone":"spine02","at":[0,0.1,-0.17],"dir":[0.4,1,0.05]},"fire":{"muzzle":{"at":[0,0.7425,-0.0775]},"range":120,"impulse":5,"damage":14,"spread":0.012,"rate":9,"modes":["auto","burst","single"],"burst":3,"velocity":880,"tracer":3},"aim":{"butt":[0,-0.2375,-0.0725],"hands":[[0,0,0],[0,0.3,-0.02]],"holds":[{"name":"grip","kind":"grip","at":[0,0,0],"axis":[0,0.254,-0.967],"from":[-1,-0.3,0],"radius":0.017,"hand":"main","trigger":true},{"name":"handguard","kind":"handguard","at":[0,0.26,-0.0775],"to":[0,0.44,-0.0775],"axis":[0,1,0],"from":[0,0,1],"radius":0.032,"hand":"off"}]},"flash":{"effect":"muzzle_flash_rifle","at":[0,0.7525,-0.0775],"scale":0.75},"particles":{"smoke":{"effect":"barrel_smoke","at":[0,0.7525,-0.0775],"dir":[0,0,-1],"once":"fire","scale":1},"eject":{"effect":"shell_eject","at":[-0.03,0.12,-0.0875],"dir":[-1,-0.4,-0.8],"once":"fire","scale":1}}}},
    "grenade": {"title":"Grenade","kind":"grenade","about":"a hand grenade: it is thrown from the hand at a place (the arc is solved), it goes off where it lands (`throw.blast`), and the burst plays there.","prop":{"sdf":{"cell":0.004,"shade":{"ao":0.4,"ao_radius":0.02,"tone":0.1},"parts":[{"id":"body","shape":"ellipsoid","center":[0,0,0],"radii":[0.034,0.045,0.034],"color":[0.09,0.11,0.055,1]},{"id":"neck","shape":"cylinder","center":[0,0.05,0],"axis":[0,1,0],"radius":0.014,"half":0.012,"color":[0.5,0.52,0.57,1]},{"id":"lever","shape":"capsule","a":[0.012,0.062,0],"b":[0.03,0.01,0],"radius":0.006,"color":[0.5,0.52,0.57,1]},{"id":"ring","shape":"torus","center":[-0.02,0.07,0],"axis":[0,0,1],"radius":0.012,"tube":0.003,"color":[0.5,0.52,0.57,1]}]},"grip":{"along":0.09,"dir":[0.024,0.841,0.541],"roll":-33.9,"hand":"main"},"rest":{"bone":"spine05","at":[0.17,-0.08,0.11],"dir":[0,1,0]},"throw":{"speed":14,"gravity":1,"spin":[5,0,0],"radius":0.05,"life":6,"linger":0.2,"fuse":"aim","hit":{"impulse":0,"damage":0},"blast":{"radius":5,"impulse":350,"damage":110}},"particles":{"burst":{"effect":"grenade","at":[0,0,0],"scale":1.4,"once":"impact"}}}},
    "light_machine_gun": {"title":"Light machine gun","kind":"machine_gun","about":"a belt-fed light machine gun with a bipod and an ammunition box: twelve shots a second, little accuracy. Two hands, held low against the body: the grip, and the receiver.","prop":{"sdf":{"cell":0.007,"shade":{"ao":0.4,"ao_radius":0.02,"tone":0.1},"parts":[{"id":"receiver","shape":"box","center":[0,0.125,-0.09],"half":[0.03,0.16,0.04],"round":0.008,"color":[0.13,0.13,0.15,1]},{"id":"shroud","shape":"cylinder","center":[0,0.525,-0.09],"axis":[0,1,0],"radius":0.027,"half":0.2,"round":0.006,"color":[0.025,0.025,0.03,1]},{"id":"barrel","shape":"capsule","a":[0,0.705,-0.09],"b":[0,1.055,-0.09],"radius":0.012,"color":[0.13,0.13,0.15,1]},{"id":"hider","shape":"cylinder","center":[0,1.075,-0.09],"axis":[0,1,0],"radius":0.02,"half":0.03,"color":[0.025,0.025,0.03,1]},{"id":"stock","shape":"box","center":[0,-0.165,-0.09],"half":[0.025,0.13,0.042],"round":0.01,"color":[0.06,0.06,0.07,1]},{"id":"grip","shape":"capsule","a":[0,0.025,-0.06],"b":[0,-0.01,0.04],"radius":0.018,"color":[0.06,0.06,0.07,1]},{"id":"foregrip","shape":"capsule","a":[0,0.405,-0.06],"b":[0,0.405,0.05],"radius":0.016,"color":[0.06,0.06,0.07,1]},{"id":"ammo_box","shape":"box","center":[0,0.125,0.05],"half":[0.045,0.075,0.075],"round":0.008,"color":[0.14,0.17,0.09,1]},{"id":"belt","shape":"capsule","a":[0,0.205,-0.06],"b":[0,0.205,0],"radius":0.012,"color":[0.6,0.45,0.14,1]},{"id":"handle","shape":"box","center":[0,0.605,-0.145],"half":[0.006,0.07,0.012],"color":[0.025,0.025,0.03,1]},{"id":"bipod_l","shape":"capsule","a":[0.025,0.605,-0.05],"b":[0.075,0.555,0.1],"radius":0.007,"color":[0.13,0.13,0.15,1]},{"id":"bipod_r","shape":"capsule","a":[-0.025,0.605,-0.05],"b":[-0.075,0.555,0.1],"radius":0.007,"color":[0.13,0.13,0.15,1]}]},"grip":{"along":0.09,"dir":[-0.127,0.694,0.709],"roll":-36.7,"hand":"main"},"rest":{"bone":"spine02","at":[0,0.1,-0.17],"dir":[0.4,1,0.05]},"fire":{"muzzle":{"at":[0,1.115,-0.09]},"range":160,"impulse":4,"damage":12,"spread":0.03,"rate":12,"modes":["auto","burst"],"burst":5,"velocity":900,"tracer":4},"aim":{"butt":[0,-0.295,-0.09],"hands":[[0,0,0],[0,0.17,0]],"pocket":[0.55,-0.08,0.06],"holds":[{"name":"grip","kind":"grip","at":[0,0.007,-0.01],"axis":[0,0.33,-0.94],"from":[-1,-0.3,0],"radius":0.018,"hand":"main","trigger":true},{"name":"shroud","kind":"shroud","at":[0,0.14,-0.09],"to":[0,0.34,-0.09],"axis":[0,1,0],"from":[0,0,1],"radius":0.027,"hand":"off"}]},"flash":{"effect":"muzzle_flash_mg","at":[0,1.115,-0.09],"scale":1},"particles":{"smoke":{"effect":"barrel_smoke","at":[0,1.115,-0.09],"dir":[0,0,-1],"once":"fire","scale":1},"eject":{"effect":"shell_eject","at":[-0.035,0.12,-0.1],"dir":[-1,-0.4,-0.8],"once":"fire","scale":1}}}},
    "machine_gun_turret": {"title":"Machine gun turret","kind":"turret","about":"a machine gun on a pedestal with a gun shield: a head that turns the whole way round and a gun that nods from -15 to 65 degrees, twelve shots a second. No mind: whoever carries it turns and fires it.","parts":{"base":{"sdf":{"cell":0.007,"shade":{"ao":0.4,"ao_radius":0.02,"tone":0.1},"parts":[{"id":"foot","shape":"box","center":[0,0,-0.012],"half":[0.15,0.15,0.012],"round":0.004,"color":[0.19,0.22,0.12,1]},{"id":"post","shape":"cylinder","center":[0,0,-0.14],"axis":[0,0,1],"radius":0.03,"half":0.13,"color":[0.08,0.085,0.09,1]},{"id":"collar","shape":"cylinder","center":[0,0,-0.262],"axis":[0,0,1],"radius":0.062,"half":0.014,"color":[0.19,0.22,0.12,1]}]}},"head":{"sdf":{"cell":0.007,"shade":{"ao":0.4,"ao_radius":0.02,"tone":0.1},"parts":[{"id":"turntable","shape":"cylinder","center":[0,0,-0.29],"axis":[0,0,1],"radius":0.078,"half":0.013,"color":[0.19,0.22,0.12,1]},{"id":"yoke_l","shape":"box","center":[0.095,0.1,-0.385],"half":[0.012,0.08,0.1],"round":0.004,"color":[0.19,0.22,0.12,1]},{"id":"yoke_r","shape":"box","center":[-0.095,0.1,-0.385],"half":[0.012,0.08,0.1],"round":0.004,"color":[0.19,0.22,0.12,1]},{"id":"shield","shape":"box","center":[0,0.2,-0.43],"half":[0.2,0.012,0.14],"round":0.004,"color":[0.3,0.33,0.2,1]}]},"joint":{"name":"yaw","parent":"base","axis":[0,0,-1],"at":[0,0,-0.27],"range":[-180,180],"rate":3}},"gun":{"sdf":{"cell":0.007,"shade":{"ao":0.4,"ao_radius":0.02,"tone":0.1},"parts":[{"id":"receiver","shape":"box","center":[0,0.14,-0.4],"half":[0.04,0.16,0.045],"round":0.008,"color":[0.08,0.085,0.09,1]},{"id":"jacket","shape":"cylinder","center":[0,0.5,-0.4],"axis":[0,1,0],"radius":0.03,"half":0.22,"round":0.006,"color":[0.5,0.52,0.55,1]},{"id":"barrel","shape":"capsule","a":[0,0.7,-0.4],"b":[0,1,-0.4],"radius":0.013,"color":[0.08,0.085,0.09,1]},{"id":"hider","shape":"cylinder","center":[0,1.02,-0.4],"axis":[0,1,0],"radius":0.022,"half":0.03,"color":[0.08,0.085,0.09,1]},{"id":"box","shape":"box","center":[-0.07,0.14,-0.42],"half":[0.04,0.07,0.07],"round":0.008,"color":[0.19,0.22,0.12,1]},{"id":"belt","shape":"capsule","a":[-0.04,0.18,-0.4],"b":[-0.025,0.18,-0.37],"radius":0.01,"color":[0.6,0.45,0.14,1]},{"id":"handle","shape":"box","center":[0,0.4,-0.45],"half":[0.008,0.07,0.014],"color":[0.08,0.085,0.09,1]},{"id":"trunnion","shape":"capsule","a":[-0.1,0.12,-0.4],"b":[0.1,0.12,-0.4],"radius":0.014,"color":[0.5,0.52,0.55,1]}]},"joint":{"name":"pitch","parent":"head","axis":[-1,0,0],"at":[0,0.12,-0.4],"range":[-15,65],"rate":2},"fire":{"muzzle":{"at":[0,1.06,-0.4]},"range":160,"impulse":5,"damage":12,"spread":0.02,"rate":12},"flash":{"effect":"muzzle_flash","at":[0,1.07,-0.4],"scale":1.1}}}},
    "mounted_machine_gun": {"title":"Mounted machine gun","kind":"machine_gun","about":"a machine gun for a mount: it has no grip and no hands, it rides on a bone of the creature (a turret's gun, a cradle) and the creature's own body points it: twelve shots a second.","prop":{"sdf":{"cell":0.007,"shade":{"ao":0.4,"ao_radius":0.02,"tone":0.1},"parts":[{"id":"receiver","shape":"box","center":[0,0.14,0],"half":[0.04,0.16,0.045],"round":0.008,"color":[0.08,0.085,0.09,1]},{"id":"jacket","shape":"cylinder","center":[0,0.5,0],"axis":[0,1,0],"radius":0.03,"half":0.22,"round":0.006,"color":[0.5,0.52,0.55,1]},{"id":"barrel","shape":"capsule","a":[0,0.7,0],"b":[0,1,0],"radius":0.013,"color":[0.08,0.085,0.09,1]},{"id":"hider","shape":"cylinder","center":[0,1.02,0],"axis":[0,1,0],"radius":0.022,"half":0.03,"color":[0.08,0.085,0.09,1]},{"id":"box","shape":"box","center":[-0.07,0.14,-0.02],"half":[0.04,0.07,0.07],"round":0.008,"color":[0.19,0.22,0.12,1]},{"id":"belt","shape":"capsule","a":[-0.04,0.18,0],"b":[-0.025,0.18,0.03],"radius":0.01,"color":[0.6,0.45,0.14,1]},{"id":"handle","shape":"box","center":[0,0.4,-0.05],"half":[0.008,0.07,0.014],"color":[0.08,0.085,0.09,1]}]},"fire":{"muzzle":{"at":[0,1.06,0]},"range":160,"impulse":5,"damage":12,"spread":0.02,"rate":12},"flash":{"effect":"muzzle_flash","at":[0,1.07,0],"scale":1.1}}},
    "pistol": {"title":"Pistol","kind":"pistol","about":"a self-loading pistol: four shots a second. One hand, the arm out in front: the weapon comes up to the end of the arm.","prop":{"sdf":{"cell":0.005,"shade":{"ao":0.4,"ao_radius":0.02,"tone":0.1},"parts":[{"id":"slide","shape":"box","center":[0,0.083,-0.075],"half":[0.012,0.095,0.016],"round":0.004,"color":[0.13,0.13,0.15,1]},{"id":"frame","shape":"box","center":[0,0.048,-0.051],"half":[0.011,0.06,0.012],"round":0.003,"color":[0.06,0.06,0.07,1]},{"id":"handle","shape":"capsule","a":[0,0.018,-0.045],"b":[0,-0.017,0.045],"radius":0.015,"color":[0.06,0.06,0.07,1]},{"id":"guard","shape":"capsule","a":[0,0.063,-0.047],"b":[0,0.04,-0.015],"radius":0.005,"color":[0.06,0.06,0.07,1]}]},"grip":{"along":0.09,"dir":[-0.143,0.675,0.724],"roll":-37,"hand":"main"},"rest":{"bone":"spine05","at":[-0.2,-0.12,0.02],"dir":[0,-1,0.1]},"fire":{"muzzle":{"at":[0,0.183,-0.075]},"range":60,"impulse":3,"damage":18,"spread":0.02,"rate":4,"modes":["single"],"burst":3,"velocity":360,"tracer":0},"aim":{"butt":[0,0,0],"hands":[[0,0,0]],"pocket":[0.38,-0.02,0.38],"holds":[{"name":"grip","kind":"grip","at":[0,0,0],"axis":[0,0.363,-0.932],"from":[-1,-0.3,0],"radius":0.015,"hand":"main","trigger":true}]},"flash":{"effect":"muzzle_flash_pistol","at":[0,0.188,-0.075],"scale":0.45},"particles":{"smoke":{"effect":"barrel_smoke","at":[0,0.188,-0.075],"dir":[0,0,-1],"once":"fire","scale":1},"eject":{"effect":"shell_eject","at":[-0.014,0.08,-0.075],"dir":[-1,-0.4,-0.8],"once":"fire","scale":1}}}},
    "rocket": {"title":"Rocket","kind":"rocket","about":"the rocket of a launcher: it is held in the hand with the launcher (the same grip and the same `aim`), the warhead out of the muzzle; thrown it flies nearly flat, its trail of smoke behind it, and blasts a ring where it lands.","prop":{"sdf":{"cell":0.007,"shade":{"ao":0.4,"ao_radius":0.02,"tone":0.1},"parts":[{"id":"stem","shape":"cylinder","center":[0,0.35,-0.1],"axis":[0,1,0],"radius":0.034,"half":0.2,"color":[0.09,0.11,0.055,1]},{"id":"neck","shape":"cylinder","center":[0,0.56,-0.1],"axis":[0,1,0],"radius":0.024,"half":0.03,"color":[0.13,0.13,0.15,1]},{"id":"head","shape":"capsule","a":[0,0.6,-0.1],"b":[0,0.9,-0.1],"ra":0.062,"rb":0.012,"color":[0.42,0.45,0.2,1]},{"id":"band","shape":"cylinder","center":[0,0.64,-0.1],"axis":[0,1,0],"radius":0.064,"half":0.012,"color":[0.6,0.45,0.14,1]},{"id":"fin_a","shape":"box","center":[0.05,0.2,-0.1],"half":[0.032,0.05,0.004],"color":[0.13,0.13,0.15,1]},{"id":"fin_b","shape":"box","center":[-0.05,0.2,-0.1],"half":[0.032,0.05,0.004],"color":[0.13,0.13,0.15,1]},{"id":"fin_c","shape":"box","center":[0,0.2,-0.05],"half":[0.004,0.05,0.032],"color":[0.13,0.13,0.15,1]},{"id":"fin_d","shape":"box","center":[0,0.2,-0.15],"half":[0.004,0.05,0.032],"color":[0.13,0.13,0.15,1]}]},"grip":{"along":0.09,"dir":[-0.143,0.675,0.724],"roll":-37,"hand":"main"},"rest":{"bone":"spine02","at":[0.1,0,-0.2],"dir":[0.1,1,0]},"throw":{"speed":45,"gravity":0.15,"align":true,"radius":0.9,"life":6,"linger":0,"fuse":"aim","hit":{"impulse":200,"damage":60},"blast":{"radius":6,"impulse":700,"damage":140}},"aim":{"butt":[0,-0.05,-0.1],"hands":[[0,0,0],[0,0.28,0.005]],"holds":[{"name":"grip","kind":"grip","at":[0,-0.01,0.01],"axis":[0,0.196,-0.98],"from":[-1,-0.3,0],"radius":0.018,"hand":"main","trigger":true},{"name":"tube","kind":"tube","at":[0,0.28,-0.1],"to":[0,0.5,-0.1],"axis":[0,1,0],"from":[0,0,1],"radius":0.046,"hand":"off"}],"pocket":[0.3,0.1,0],"muzzle":{"at":[0,0.9,-0.1],"dir":[0,1,0]}},"particles":{"trail":{"effect":"exhaust_smoke","at":[0,0.15,-0.02],"dir":[0,-1,0],"scale":0.6,"loop":{"while":"thrown"}},"burst":{"effect":"grenade","at":[0,0.8,0],"scale":2.6,"once":"impact"}}}},
    "rocket_launcher": {"title":"Rocket launcher","kind":"launcher","about":"a shoulder-fired launcher, with a rocket in it: the launcher and its rocket are two props held and aimed together (the same `aim`), the rocket is the one that is thrown, and it goes only when it is aimed. Two hands: the grip, and the foregrip.","prop":{"sdf":{"cell":0.007,"shade":{"ao":0.4,"ao_radius":0.02,"tone":0.1},"parts":[{"id":"tube","shape":"cylinder","center":[0,0.1,-0.1],"axis":[0,1,0],"radius":0.046,"half":0.46,"round":0.01,"color":[0.13,0.16,0.08,1]},{"id":"bell","shape":"capsule","a":[0,-0.35,-0.1],"b":[0,-0.52,-0.1],"ra":0.046,"rb":0.078,"color":[0.09,0.11,0.055,1]},{"id":"rim","shape":"cylinder","center":[0,0.56,-0.1],"axis":[0,1,0],"radius":0.056,"half":0.014,"color":[0.025,0.025,0.03,1]},{"id":"sight","shape":"box","center":[0,0.18,-0.175],"half":[0.01,0.06,0.022],"color":[0.025,0.025,0.03,1]},{"id":"optic","shape":"cylinder","center":[0,0.18,-0.2],"axis":[0,1,0],"radius":0.014,"half":0.045,"color":[0.025,0.025,0.03,1]},{"id":"grip","shape":"capsule","a":[0,0,-0.04],"b":[0,-0.02,0.06],"radius":0.018,"color":[0.06,0.06,0.07,1]},{"id":"foregrip","shape":"capsule","a":[0,0.28,-0.04],"b":[0,0.28,0.05],"radius":0.015,"color":[0.06,0.06,0.07,1]},{"id":"wood","shape":"box","center":[0,0.34,-0.12],"half":[0.05,0.1,0.012],"round":0.006,"color":[0.24,0.13,0.06,1]}]},"grip":{"along":0.09,"dir":[-0.143,0.675,0.724],"roll":-37,"hand":"main"},"rest":{"bone":"spine02","at":[-0.02,0.05,-0.17],"dir":[0.35,1,0.05]},"aim":{"butt":[0,-0.05,-0.1],"hands":[[0,0,0],[0,0.28,0.005]],"holds":[{"name":"grip","kind":"grip","at":[0,-0.01,0.01],"axis":[0,0.196,-0.98],"from":[-1,-0.3,0],"radius":0.018,"hand":"main","trigger":true},{"name":"tube","kind":"tube","at":[0,0.28,-0.1],"to":[0,0.5,-0.1],"axis":[0,1,0],"from":[0,0,1],"radius":0.046,"hand":"off"}],"pocket":[0.3,0.1,0],"muzzle":{"at":[0,0.9,-0.1],"dir":[0,1,0]}}}},
    "sniper_rifle": {"title":"Sniper rifle","kind":"rifle","about":"a scoped bolt rifle: one heavy, accurate shot every one and a half seconds, a long way. Two hands: the grip, and the forend under the action.","prop":{"sdf":{"cell":0.006,"shade":{"ao":0.4,"ao_radius":0.02,"tone":0.1},"parts":[{"id":"action","shape":"box","center":[0,0.125,-0.07],"half":[0.024,0.16,0.03],"round":0.006,"color":[0.13,0.13,0.15,1]},{"id":"barrel","shape":"capsule","a":[0,0.285,-0.07],"b":[0,1.065,-0.07],"ra":0.013,"rb":0.009,"color":[0.13,0.13,0.15,1]},{"id":"stock","shape":"capsule","a":[0,-0.015,-0.067],"b":[0,-0.415,-0.085],"ra":0.03,"rb":0.036,"color":[0.32,0.27,0.16,1]},{"id":"cheek","shape":"box","center":[0,-0.195,-0.107],"half":[0.018,0.1,0.014],"round":0.006,"color":[0.32,0.27,0.16,1]},{"id":"scope","shape":"cylinder","center":[0,0.145,-0.12],"axis":[0,1,0],"radius":0.024,"half":0.13,"color":[0.025,0.025,0.03,1]},{"id":"scope_front","shape":"cylinder","center":[0,0.29,-0.12],"axis":[0,1,0],"radius":0.031,"half":0.02,"color":[0.025,0.025,0.03,1]},{"id":"grip","shape":"capsule","a":[0,0.015,-0.045],"b":[0,-0.015,0.045],"radius":0.017,"color":[0.32,0.27,0.16,1]},{"id":"magazine","shape":"box","center":[0,0.125,-0.015],"half":[0.015,0.03,0.04],"round":0.004,"color":[0.06,0.06,0.07,1]}]},"grip":{"along":0.09,"dir":[-0.127,0.694,0.709],"roll":-36.7,"hand":"main"},"rest":{"bone":"spine02","at":[-0.02,0.05,-0.17],"dir":[0.35,1,0.05]},"fire":{"muzzle":{"at":[0,1.085,-0.07]},"range":300,"impulse":22,"damage":85,"spread":0.002,"rate":0.7,"modes":["single"],"burst":3,"velocity":850,"tracer":0},"aim":{"butt":[0,-0.45,-0.085],"hands":[[0,0,0],[0,0.12,0]],"pocket":[0.45,-0.02,0],"holds":[{"name":"grip","kind":"grip","at":[0,0,0],"axis":[0,0.254,-0.967],"from":[-1,-0.3,0],"radius":0.017,"hand":"main","trigger":true},{"name":"forend","kind":"forend","at":[0,0.16,-0.07],"to":[0,0.3,-0.07],"axis":[0,1,0],"from":[0,0,1],"radius":0.035,"hand":"off"}]},"flash":{"effect":"muzzle_flash_rifle","at":[0,1.095,-0.07],"scale":1},"particles":{"smoke":{"effect":"barrel_smoke","at":[0,1.095,-0.07],"dir":[0,0,-1],"once":"fire","scale":1}}}}
  };
  // END WEAPONS
  // api.weapon(name, over) -> the library's prop for a creature's `props`, with the creature's say over it: a key of `over` replaces the weapon's own (rest, start, grip, pool, per, scale, sdf ...), except `fire`, `aim` and `throw`, which are changed key by key; `flash: null` leaves the muzzle's flash out
  const weapon = function (name, over) {
    const w = WEAPONS[name];
    if (!w) fail("api.weapon", "no weapon '" + name + "' in the library (" + Object.keys(WEAPONS).filter(function (n) { return WEAPONS[n].prop; }).join(", ") + ")");
    if (!w.prop) fail("api.weapon", "'" + name + "' is a rig of parts that turn: `props: Object.assign({}, api.rig(\"" + name + "\", \"mg\", { rest: { bone, at, dir } }))`");
    const p = JSON.parse(JSON.stringify(w.prop));
    if (over === undefined || over === null) return p;
    if (typeof over !== "object" || Array.isArray(over)) fail("api.weapon('" + name + "')", "the second argument is { rest, start, ... }: what the creature says over the weapon");
    for (const k in over) {
      const v = over[k];
      if ((k === "fire" || k === "aim" || k === "throw") && v && typeof v === "object" && !Array.isArray(v) && p[k] && typeof p[k] === "object") for (const j in v) p[k][j] = JSON.parse(JSON.stringify(v[j]));
      else if (v === null || v === undefined) delete p[k];
      else p[k] = JSON.parse(JSON.stringify(v));
    }
    return p;
  };
  // api.rig(name, prefix, over) -> the props of a RIG of the library: a weapon with a skeleton (weapons/machine_gun_turret.js: a base, a head that turns, a gun that nods), no mind of its own: whoever mounts it turns it (SYSTEM.md "Weapons are real"). The part that fires is the prefix itself (the prop
  // `mg`: the weapon that the mind names), the others `<prefix>_<part>` (`mg_base`, `mg_head`); `over.rest` is where the rig is mounted ({ bone, at, dir }: the one place of every part, the way the assembly's +y points: [0, 0, 1] is forward, up is up) and is required; `over.start` (born with it: "rest"), `scale`, and
  // `fire`, `flash` for the weapon part. `Object.assign({}, api.rig(...), { other: props })` is how a file puts it with its other props
  const rig = function (name, prefix, over) {
    const w = WEAPONS[name];
    if (!w || !w.parts) fail("api.rig", "no rig '" + name + "' in the library (" + Object.keys(WEAPONS).filter(function (n) { return WEAPONS[n].parts; }).join(", ") + ")");
    if (typeof prefix !== "string" || !/^[a-z][a-z0-9_]*$/.test(prefix)) fail("api.rig('" + name + "')", "the second argument is the name of the weapon part's prop (lower case letters, digits and _: \"mg\")");
    if (!over || typeof over !== "object" || Array.isArray(over) || !over.rest) fail("api.rig('" + name + "')", "the third argument is { rest: { bone, at, dir }, start, scale ... }: a rig is mounted somewhere");
    const names = {}, out = {};
    Object.keys(w.parts).forEach(function (k) { names[k] = w.parts[k].fire || w.parts[k].throw ? prefix : prefix + "_" + k; });
    Object.keys(w.parts).forEach(function (k) {
      const p = JSON.parse(JSON.stringify(w.parts[k]));
      if (p.joint) p.joint.parent = names[p.joint.parent];
      p.rest = JSON.parse(JSON.stringify(over.rest));
      if (over.start === null) delete p.start; else p.start = over.start === undefined ? "rest" : over.start;                // (`start: null`: the carrier is not born with it: its controller mounts it when it wants, taking the parts: me.take("mg_base"), me.take("mg_head"), me.take("mg"))
      if (over.scale !== undefined) p.scale = over.scale;
      if (p.fire && over.fire) for (const j in over.fire) p.fire[j] = JSON.parse(JSON.stringify(over.fire[j]));
      if (p.fire && over.flash !== undefined) { if (over.flash === null) delete p.flash; else p.flash = JSON.parse(JSON.stringify(over.flash)); }
      out[names[k]] = p;
    });
    return out;
  };
  // what comes with a library weapon is the creature's particles (the creature's own of the same name stays): the `flash` key of a prop (the muzzle's flash) is taken out and made into `<prop>_flash`, and each of its `particles` ({ trail: { effect, at, dir, scale, loop | once } }: a rocket's
  // smoke, the burst where it lands) into `<prop>_<name>`
  const flashes = function (c) {
    if (!c || !c.props || typeof c.props !== "object") return;
    const put = function (name, n, f, extra) {
      c.particles = c.particles || {};
      if (c.particles[name] !== undefined) return;
      const d = { effect: f.effect, mount: { prop: n, at: f.at.slice(), dir: f.dir ? f.dir.slice() : [0, 1, 0] } };
      if (extra) d.once = extra; else if (f.loop) d.loop = JSON.parse(JSON.stringify(f.loop)); else d.once = f.once;
      if (f.scale !== undefined) d.scale = f.scale;
      c.particles[name] = d;
    };
    for (const n in c.props) {
      const p = c.props[n];
      if (!p || typeof p !== "object") continue;
      if (p.flash !== undefined) { const f = p.flash; delete p.flash; if (f) put(n + "_flash", n, f, "fire"); }
      if (p.particles !== undefined) { const q = p.particles; delete p.particles; if (q) for (const k in q) put(n + "_" + k, n, q[k]); }
    }
  };

  // the worker's function for every hosted creature: it loads the blocks the creature's data names and returns the mind. ES5, self-contained: the page sends it as text
  const boot = function (api) {
    var m = api.cfg && api.cfg.mind;
    if (!m || !m.blocks) throw new Error("a hosted creature has mind.blocks in its definition (api.cfg.mind.blocks)");
    var ld = api.blocks.load(m.blocks, m.props || {}), r, o;
    if (!m.worker) throw new Error("a hosted creature declares its tree: mind.worker (api.cfg.mind.worker)");
    r = (new Function("return (" + m.worker + ")"))()(api, ld);
    if (!r || typeof r !== "object" || !r.tree || typeof r.tree !== "object") throw new Error("the creature's mind.worker returns { tree, hooks? }: the tree is an object");
    o = { hz: m.hz, far_hz: m.far_hz, tree: function () { return r.tree; } };
    if (r.hooks) o.hooks = r.hooks;
    return ld.mind(o);
  };

  // the names of the skeleton's bones in the order system numbers them (a bone with a `mirror` has its twin, the name ending _r, right after it: SYSTEM.md): a block that poses a joint by its name finds its number here (cfg.bones)
  const bone_names = function (sk) {
    const out = [];
    if (!Array.isArray(sk)) return out;
    sk.forEach(function (b) { out.push(b.name); if (b.mirror) out.push(String(b.name).replace(/_l$/, "_r")); });
    return out;
  };

  function load(text) {
    let c;
    try { c = new Function("api", String(text))({ weapon: weapon, rig: rig }); } catch (e) { throw new Error("happy_creature_file: the file does not run: " + (e && e.message || e)); }
    if (!c || typeof c !== "object") fail("file", "it ends with `return { name, body, mind, ... }`");
    flashes(c);
    if (c.skeleton || c.human || c.rig) fail("file", "it is the OLD flat form (`return { name, skeleton, rig, ... }`): the body's keys go into `body: { ... }` and the creature has a family, a nav, abilities and a mind (`node tools/creature_upgrade.js <file>` writes the form)");
    return c;
  }
  // the flat definition of the body, the one system.species and the compile of system take: the body's keys with the name and the number of instances of the file. No mind: it is what a page that only shows a creature needs
  function body_def(c) {
    if (!c || typeof c !== "object") fail("body_def", "a definition object");
    if (typeof c.name !== "string" || !/^[a-z][a-z0-9_]*$/.test(c.name)) fail("name", "lower case letters, digits and _ (" + JSON.stringify(c.name) + ")");
    if (!c.body || typeof c.body !== "object" || (!c.body.skeleton && !c.body.human)) fail("creature `" + c.name + "` body", "the system definition of its body: { skeleton, rig, legs, ... } (or { human })");
    const def = {};
    for (const k in c.body) def[k] = c.body[k];
    def.name = c.name; def.max_instances = c.max === undefined ? 16 : c.max;
    if (c.particles !== undefined) def.particles = c.particles;                                   // (the species checks it against its skeleton: runtime.js)
    if (c.props !== undefined) def.family_props = c.props;                                        // (its props, each a species of its own: runtime.js; `props` of the body stays the body's)
    return def;
  }

  // ---- DEFAULTS: what a body with nothing else is given (creatures/ has one form, so every creature has a family, a nav profile, abilities and a mind). The facts of the body decide: legs, wings, wheels, its size. The mind is the
  // blocks of world/blocks/ a creature of its kind lives by, with numbers scaled to its size; `o.clips` are the settings of `idle_life` (the clips of the creature's species: the block's own defaults are a person's)
  const num = function (x, d) { const p = Math.pow(10, d === undefined ? 2 : d); return Math.round(x * p) / p; };
  const clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  const facts = function (def) {
    const sk = Array.isArray(def.skeleton) ? def.skeleton : [], f = { h: 0, w: 0, l: 0, legs: 0, arms: false };
    let zmin = 1e9, zmax = -1e9, xmax = 0;
    sk.forEach(function (b) {
      [b.head, b.tail].forEach(function (p) { if (!p) return; f.h = Math.max(f.h, p[1]); xmax = Math.max(xmax, Math.abs(p[0])); zmin = Math.min(zmin, p[2]); zmax = Math.max(zmax, p[2]); });
      if (/(^|_)(arm|forearm|upperarm|hand)(_|$)/i.test(String(b.name))) f.arms = true;
    });
    f.w = 2 * xmax; f.l = zmax > zmin ? zmax - zmin : 0;
    const lg = def.legs && def.legs.legs;
    if (Array.isArray(lg)) lg.forEach(function (l) { f.legs += l.mirror ? 2 : 1; });
    if (def.human) { f.h = f.h || 1.7; f.w = f.w || 0.5; f.l = f.l || 0.3; f.legs = 2; f.arms = true; }
    f.speed = def.body && def.body.max_speed > 0 ? def.body.max_speed : 1.1 * Math.sqrt(Math.max(f.h, 0.3));       // (a creature that does not say how fast it goes: a bigger one is quicker)
    return f;
  };
  const kind_of = function (def, f) {
    if (def.human) return "person";
    if (def.aircraft || def.rotors) return "aircraft";
    if (def.wheels || def.vehicle) return "vehicle";
    if (def.flight && def.wings) return "flyer";
    if (f.legs === 2 && f.arms && f.h >= 1.2 && f.h <= 2.4) return "person";
    return "animal";
  };
  const HOUSE = ["walk", "open", "climb", "use", "effects"], USES = ["sit", "sleep", "eat", "use"], SEAT = { clip_sit: "sit_chair", clip_sleep: "lie_on_back" };
  function defaults(def, o) {
    o = o || {};
    const f = facts(def), kind = o.kind || kind_of(def, f), name = o.name || def.name || "creature";
    const walk = num(clamp(f.speed * 0.45, 0.25, 3)), run = num(clamp(f.speed * 1.2, 1.2, 9)), near = num(clamp(0.25 * f.l, 0.5, 5), 1);
    const hp = o.hp || (kind === "person" ? 100 : Math.round(clamp(25 * f.h * Math.max(f.l, 0.5), 20, 1000)));
    const fam = { faction: "animal", kind: "animal", hp: hp };
    let nav = "person", abilities = ["walk", "effects"], interaction = { uses: [] }, blocks, tree, size_agent = true;
    if (kind === "person") {
      fam.faction = "folk"; fam.kind = "person"; abilities = HOUSE.slice(); interaction = { uses: USES.slice() }; size_agent = false;
      blocks = [["health", { hp: hp }], "needs", ["use", Object.assign({ kinds: [] }, SEAT)], ["flee", { gait: "" }], ["greet", { meet: 6 }], "curious", "idle_life", "injured", ["wander", { speed: 1.1 }]];
      tree = ["flee", "greet", "use", "curious", "idle_life", "wander"];
    } else if (kind === "robot") {
      fam.faction = "machine"; fam.kind = "robot"; abilities = HOUSE.slice(); size_agent = false;
      blocks = [["health", { hp: hp }], ["flee", { gait: "" }], "curious", "idle_life", "injured", ["wander", { speed: 1.1 }]];
      tree = ["flee", "curious", "idle_life", "wander"];
    } else if (kind === "vehicle") {
      fam.faction = "machine"; fam.kind = "vehicle";
      blocks = [["health", { hp: hp }], ["flee", { speed: num(f.speed), distance: 10, gait: "" }], ["walk", { speed: num(f.speed * 0.8), run_speed: num(f.speed), wp_near: num(Math.max(0.9, f.l)), near: num(Math.max(1.1, f.l)), stuck_time: 5 }], ["wander", { speed: num(f.speed * 0.8), pause_min: 2, pause_max: 6, near: num(Math.max(1.1, f.l)) }]];
      tree = ["flee", "wander"];
    } else if (kind === "flyer") {
      const cruise = def.flight && def.flight.cruise_speed > 0 ? def.flight.cruise_speed : 8;
      abilities = ["fly", "effects"];
      blocks = [["health", { hp: hp }], ["fly", { alt: num(clamp(6 + 4 * Math.sqrt(f.h), 8, 24), 0), cruise: num(cruise, 1), climb: num(cruise * 0.4, 1), sink: num(cruise * 0.3, 1), legs: 3, min_leg: 15, roam: 60, near: num(clamp(cruise * 0.6, 2.5, 8), 1), rest_min: 8, rest_max: 20 }]];
      tree = ["fly"];
    } else if (kind === "aircraft") {
      fam.faction = "machine"; fam.kind = "aircraft"; abilities = ["fly", "effects"];
      blocks = [["health", { hp: hp }], ["fly", { alt: 20, cruise: 9, climb: 4, sink: 3, legs: 3, min_leg: 25, roam: 80, near: 6, rest_min: 8, rest_max: 20 }]];
      tree = ["fly"];
    } else {                                                                                                           // (an animal: it follows the same needs a dog does)
      blocks = [["health", { hp: hp }], ["flee", { speed: run, distance: num(clamp(9 * Math.sqrt(Math.max(f.h, 0.3) / 0.9), 6, 25), 0) }], ["curious", { approach: 0.3, cooldown: 20, near: num(clamp(0.5 * f.l + 0.5, 1, 6), 1) }], ["idle_life", o.clips || {}], ["injured", { clip_flinch: "" }], ["wander", { speed: walk, near: near }]];
      tree = ["flee", "curious", "idle_life", "wander"];
    }
    if (kind === "person" || kind === "robot") { const i = blocks.indexOf("idle_life"); if (i >= 0 && o.clips) blocks[i] = ["idle_life", o.clips]; }
    if (size_agent) {
      if (kind !== "vehicle" && f.h <= 0.6 && f.l <= 1.2) nav = "small";                                      // (a vehicle has a lane of its own: it cannot turn on the spot)
      else if (kind !== "vehicle" && f.l <= 1.0 && f.w <= 0.6 && f.h <= 2.0) nav = "person";
      else nav = { name: name, radius: num(clamp(0.5 * Math.max(f.w, 0.45 * f.l), 0.2, 6)), height: num(f.h + 0.1), step: num(clamp(0.2 * f.h, 0.08, 1)), slope: 35, drop: num(clamp(0.3 * f.h, 0.15, 2)) };
    }
    return { kind: kind, family: fam, nav: nav, abilities: abilities, interaction: interaction, mind: { hz: 6, far_hz: 2, blocks: blocks, tree: tree }, facts: f };
  }

  const lit = function (v) {
    if (Array.isArray(v)) return "[" + v.map(lit).join(", ") + "]";
    if (v && typeof v === "object") { const ks = Object.keys(v); return ks.length ? "{ " + ks.map(function (k) { return (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ": " + lit(v[k]); }).join(", ") + " }" : "{}"; }
    return JSON.stringify(v);
  };
  // the end of a creature file: `return { name, family, nav, body, abilities, interaction, mind };`. `entries`: the body's keys, each "key: source" (the writer has them as the file's own constants); `def`: the flat object of the body
  // (what the defaults look at); `o`: { kind, hp, clips, max, header } as for defaults
  function tail(name, entries, def, o) {
    o = o || {};
    const d = defaults(Object.assign({ name: name }, def), Object.assign({ name: name }, o)), pad = "      ";
    const lines = [
      "return {",
      "  name: " + JSON.stringify(name) + ", max: " + (o.max || 16) + ",",
      "  family: " + lit(d.family) + ",",
      "  nav: { agent: " + lit(d.nav) + " },",
      "  body: {",
      entries.map(function (e) { return "    " + String(e).replace(/\n/g, "\n    "); }).join(",\n"),
      "  },",
      "  abilities: " + lit(d.abilities) + ",",
      "  interaction: " + lit(d.interaction) + ",",
      "  mind: {",
      "    hz: " + d.mind.hz + ", far_hz: " + d.mind.far_hz + ",",
      "    blocks: [",
      d.mind.blocks.map(function (b) { return pad + lit(b); }).join(",\n"),
      "    ],",
      "    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first; the blocks without a node (health, needs, injured) act through their hooks.",
      "    worker: function (api, ld) {",
      "      var tree = { name: " + JSON.stringify(name) + ", select: [" + d.mind.tree.map(function (n) { return "ld.node(" + JSON.stringify(n) + ")"; }).join(", ") + "] };",
      "      return { tree: tree };",
      "    }",
      "  }",
      "};"
    ];
    return lines.join("\n") + "\n";
  }
  // the `particles` section as far as the file can tell (system checks the bones when the species is made): an object of { effect, mount: { bone }, loop | once }, and the ability "effects" that a world demands of what plays effects
  function check_particles(where, c) {
    const p = c.particles;
    if (!p || typeof p !== "object" || Array.isArray(p)) fail(where + " particles", "{ name: { effect, mount: { bone, at, dir }, loop | once, scale } }");
    const has_sk = !!(c.body && Array.isArray(c.body.skeleton)), names = bone_names(c.body && c.body.skeleton);              // (a person of the human system has no list of bones in the file)
    for (const n in p) {
      const d = p[n];
      if (!/^[a-z][a-z0-9_]*$/.test(n)) fail(where + " particles", "`" + n + "` is not a name (lower case letters, digits and _)");
      if (!d || typeof d !== "object" || typeof d.effect !== "string" || !d.effect) fail(where + " particles." + n, "{ effect: \"name of an effect\", mount: { bone }, loop | once }");
      if (!d.mount || typeof d.mount !== "object" || (typeof d.mount.bone === "string") === (typeof d.mount.prop === "string")) fail(where + " particles." + n, "mount is { bone, at, dir } or { prop, at, dir }: the bone or the prop it is played on");
      if (typeof d.mount.prop === "string" && !(c.props && c.props[d.mount.prop])) fail(where + " particles." + n, "mount.prop `" + d.mount.prop + "` is not a prop of the creature (its `props`)");
      if (typeof d.mount.bone === "string" && has_sk && names.indexOf(d.mount.bone) < 0) fail(where + " particles." + n, "mount.bone `" + d.mount.bone + "` is not a bone of the skeleton");
      if ((d.loop === undefined) === (d.once === undefined)) fail(where + " particles." + n, "it is a `loop` or a `once` (one of them)");
    }
    if ((c.abilities || []).indexOf("effects") < 0) fail(where + " particles", "a creature that plays effects has the ability \"effects\" (abilities: [..., \"effects\"])");
  }
  // the `props` section as far as the file can tell (system checks the arms, the hands and the bones when the species is made): { name: { sdf | mesh, grip, rest, scale, per } }, and the ability "props"
  function check_props(where, c) {
    const p = c.props;
    if (!p || typeof p !== "object" || Array.isArray(p)) fail(where + " props", "{ name: { sdf | mesh, grip, rest, scale, per } }");
    const has_sk = !!(c.body && Array.isArray(c.body.skeleton)), names = bone_names(c.body && c.body.skeleton);
    for (const n in p) {
      const d = p[n];
      if (!/^[a-z][a-z0-9_]*$/.test(n)) fail(where + " props", "`" + n + "` is not a name (lower case letters, digits and _)");
      if (!d || typeof d !== "object" || Array.isArray(d)) fail(where + " props." + n, "{ sdf | mesh, grip, rest, scale, per }");
      if ((d.sdf === undefined) === (d.mesh === undefined)) fail(where + " props." + n, "it has an `sdf` or a `mesh` (one of them): its body");
      if (d.per !== undefined && !(Number.isInteger(d.per) && d.per >= 1 && d.per <= 8)) fail(where + " props." + n, "per is a whole number from 1 to 8");
      if (d.pool !== undefined && !(Number.isInteger(d.pool) && d.pool >= 1 && d.pool <= 65535)) fail(where + " props." + n, "pool is a whole number from 1 to 65535 (how many of it the whole family has)");
      if (d.rest !== undefined && has_sk && (!d.rest || names.indexOf(d.rest.bone) < 0)) fail(where + " props." + n, "rest.bone `" + (d.rest && d.rest.bone) + "` is not a bone of the skeleton");
    }
    if ((c.abilities || []).indexOf("props") < 0) fail(where + " props", "a creature that has props has the ability \"props\" (abilities: [..., \"props\"])");
  }
  function compile(c, o) {
    o = o || {};
    if (!c || typeof c !== "object") fail("compile", "a definition object");
    known("creature", c, TOP);
    if (typeof c.name !== "string" || !/^[a-z][a-z0-9_]*$/.test(c.name)) fail("name", "lower case letters, digits and _ (" + JSON.stringify(c.name) + ")");
    const where = "creature `" + c.name + "`";
    if (!c.body || typeof c.body !== "object" || (!c.body.skeleton && !c.body.human)) fail(where + " body", "the system definition of its body: { skeleton, rig, legs, ... } (or { human })");
    if (c.body.name !== undefined || c.body.worker !== undefined || c.body.max_instances !== undefined) fail(where + " body", "`name`, `worker` and `max_instances` are not the body's: the creature file has them (`name`, `max`; the mind is `mind`)");
    const family = c.family || {};
    known(where + " family", family, FAMILY);
    if (family.hp !== undefined && !(family.hp > 0)) fail(where + " family", "hp is above 0");
    if (family.keys !== undefined && !(family.keys >= 0 && family.keys <= 255)) fail(where + " family", "keys is a mask of 8 bits");
    let agent = null, agent_name = "person";
    const nav = c.nav || { agent: "person" };
    known(where + " nav", nav, ["agent"]);
    if (typeof nav.agent === "string") agent_name = nav.agent;
    else if (nav.agent && typeof nav.agent === "object") {
      known(where + " nav.agent", nav.agent, AGENT);
      if (typeof nav.agent.name !== "string") fail(where + " nav.agent", "an agent of its own has a name (it is registered in the world's nav)");
      for (const k of ["radius", "height", "step", "slope", "drop"]) if (!(nav.agent[k] > 0)) fail(where + " nav.agent", k + " is a number above 0");
      agent = JSON.parse(JSON.stringify(nav.agent)); agent_name = agent.name;
    } else fail(where + " nav", "agent is the name of a profile or { name, radius, height, step, slope, drop }");
    (c.abilities || []).forEach(function (a) { if (ABILITIES.indexOf(a) < 0) fail(where + " abilities", "`" + a + "` is not an ability (" + ABILITIES.join(", ") + ")"); });
    const mind = c.mind;
    if (!mind || typeof mind !== "object") fail(where + " mind", "{ hz, far_hz, blocks: [...] }");
    known(where + " mind", mind, MIND);
    if (!Array.isArray(mind.blocks) || !mind.blocks.length) fail(where + " mind", "blocks is a list of the blocks its tree loads");
    const blocks = mind.blocks.map(function (b, i) {
      const n = typeof b === "string" ? b : Array.isArray(b) ? b[0] : b && b.block;
      if (typeof n !== "string" || !n) fail(where + " mind.blocks[" + i + "]", "a block's name, [name, settings] or { block, params }");
      const plug = Array.isArray(b) ? b[2] : (b && typeof b === "object" ? b.plug : undefined);                // (a block's own place in the tree: { priority, mode }, pure.js)
      if (plug !== undefined) {
        if (!plug || typeof plug !== "object") fail(where + " mind.blocks[" + i + "]", "plug is { priority, mode }");
        if (plug.priority !== undefined && typeof plug.priority !== "number") fail(where + " mind.blocks[" + i + "]", "plug.priority is a number");
        if (plug.mode !== undefined && plug.mode !== "interrupt" && plug.mode !== "base") fail(where + " mind.blocks[" + i + "]", "plug.mode is interrupt or base");
      }
      if (typeof b === "string") return b;
      if (Array.isArray(b)) return plug === undefined ? [b[0], b[1] || {}] : [b[0], b[1] || {}, plug];
      return plug === undefined ? { block: b.block, params: b.params || {} } : { block: b.block, params: b.params || {}, plug: plug };
    });
    // mind.props: the creature's bag of settings for blocks on a PATH of its blocks (pure.js): { "party/celebrate/emote": { clip_emote: "cheer" } }
    const props = {};
    if (mind.props !== undefined) {
      if (typeof mind.props !== "object" || mind.props === null || Array.isArray(mind.props)) fail(where + " mind.props", "{ \"block/used_block\": { setting: value } }: the path of the blocks from the one the creature lists");
      for (const pk in mind.props) {
        if (!/^[a-z][a-z0-9_]*(\/[a-z][a-z0-9_]*)*$/.test(pk)) fail(where + " mind.props", "`" + pk + "` is not a path (block names joined by /)");
        const pv = mind.props[pk];
        if (!pv || typeof pv !== "object" || Array.isArray(pv)) fail(where + " mind.props", "`" + pk + "` is { setting: value }");
        try { JSON.stringify(pv); } catch (e) { fail(where + " mind.props", "`" + pk + "` is data"); }
        props[pk] = JSON.parse(JSON.stringify(pv));
      }
    }
    const hz = mind.hz === undefined ? 6 : mind.hz, far = mind.far_hz === undefined ? Math.min(2, hz) : mind.far_hz;
    if (!(hz > 0 && hz <= 60) || !(far > 0 && far <= hz)) fail(where + " mind", "hz is 0 .. 60 and far_hz is above 0 and not above hz");
    if (typeof mind.worker !== "function") fail(where + " mind.worker", "a creature declares its tree: mind.worker is an ES5 function written `function (api, ld) { ... }` that returns { tree, hooks? }");
    const worker = Function.prototype.toString.call(mind.worker);
    if (!/^function\b/.test(worker)) fail(where + " mind.worker", "write it as `worker: function (api, ld) { ... }` (it is sent to the worker as text)");
    const def = {};
    for (const k in c.body) def[k] = c.body[k];
    def.name = c.name; def.max_instances = c.max === undefined ? 16 : c.max;
    if (c.particles !== undefined) { check_particles(where, c); def.particles = c.particles; }
    if (c.props !== undefined) { check_props(where, c); def.family_props = c.props; }
    def.worker = boot;
    const cfg = {
      name: c.name, nav: { agent: agent_name }, faction: family.faction || "", kind: family.kind || "", hp: family.hp || 0, keys: family.keys || 0,
      abilities: (c.abilities || []).slice(), interaction: JSON.parse(JSON.stringify(c.interaction || {})), tags: (c.tags || []).slice(),
      bones: bone_names(c.body.skeleton),
      mind: { hz: hz, far_hz: far, blocks: JSON.parse(JSON.stringify(blocks)), props: props, worker: worker }
    };
    // the blocks the world requires of everything it hosts (w.require): the creature's own listing stays as it is; one it lacks is appended
    (o.required || []).forEach(function (n) {
      if (!cfg.mind.blocks.some(function (b) { return (typeof b === "string" ? b : Array.isArray(b) ? b[0] : b.block) === n; })) cfg.mind.blocks.push(n);
    });
    // what the world GIVES the creature (w.give: world/world_spec.js): skills (blocks) with the settings the world says (they win over the creature's own, goals among them), the ones it takes away, the settings of paths. The world is
    // the last word: a block the creature has gets the world's settings, one it lacks is added, one the world removes is gone
    (o.give || []).forEach(function (g) {
      (g.remove || []).forEach(function (n) { cfg.mind.blocks = cfg.mind.blocks.filter(function (b) { return (typeof b === "string" ? b : Array.isArray(b) ? b[0] : b.block) !== n; }); });
      (g.blocks || []).forEach(function (b) {
        const n = typeof b === "string" ? b : Array.isArray(b) ? b[0] : b.block, st = typeof b === "string" ? {} : Array.isArray(b) ? (b[1] || {}) : (b.params || {});
        let at = -1;
        cfg.mind.blocks.forEach(function (x, i) { if ((typeof x === "string" ? x : Array.isArray(x) ? x[0] : x.block) === n) at = i; });
        if (at < 0) { cfg.mind.blocks.push(Object.keys(st).length ? [n, JSON.parse(JSON.stringify(st))] : n); return; }
        const x = cfg.mind.blocks[at], cur = typeof x === "string" ? {} : Array.isArray(x) ? (x[1] || {}) : (x.params || {}), merged = Object.assign({}, cur, JSON.parse(JSON.stringify(st)));
        cfg.mind.blocks[at] = Array.isArray(x) && x[2] !== undefined ? [n, merged, x[2]] : [n, merged];
      });
      for (const pk in (g.props || {})) cfg.mind.props[pk] = Object.assign({}, cfg.mind.props[pk] || {}, JSON.parse(JSON.stringify(g.props[pk])));
    });
    if (o.override_mind) cfg.mind.blocks = o.override_mind;
    return { def: def, cfg: cfg, agent: agent };
  }
  return { compile: compile, load: load, body_def: body_def, defaults: defaults, tail: tail, boot: boot, ABILITIES: ABILITIES, weapons: WEAPONS, weapon: weapon, rig: rig };
});
