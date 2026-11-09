# `system.bin`: what is in it and how to read it

One file, 50 sections, 7.99 MB, that holds everything the creature system reads as data: the gait styles and the actions of the motion libraries, the AI's blocks, the lite human's model, the ground's materials. It is made by a tool that is not in this repo (`build.js` of `happy`), so here it is read-only data. This page is for someone who has to read it or write JSON that goes into it: the container, the sections, and the two objects that matter most, a **gait style** and an **action**, each with a real example.

## What is in it

| sections | kind | what | packed / unzipped | read by |
|---|---|---|---|---|
| `gaits.<library>` (18) | tree | the gait styles, by library | 0.63 MB / 2.68 MB | `system.gaits`, the worker |
| `index.gaits` | tree | which library holds which style (`{ library: [style names] }`) | 0.02 MB | `system.gaits` (a creature that names a style the page has not got is given its library) |
| `actions.<set>` (27) | tree | the actions, by set | 3.58 MB / 17.03 MB | the worker (`api.action("<set>::<name>")`) |
| `blocks` | tree | the AI's 35 blocks (ES5 source texts), the index and 19 ready-made minds | 0.09 MB | `system.ai` |
| `clip_sets` | tree | the clips a block needs, by species and pack (441 sets) | 0.03 MB | `system.ai.clip_sets()` (world.js) |
| `human.model` | raw | the lite human's file (`HLT1`) | 2.75 MB unzipped | `system.human` |
| `ground.textures` | raw | the terrain's and the roads' PBR materials, as atlases (`HGT1`) | 2.23 MB | `environment.js` |

**Not in this copy.** The file of the first version (`happy`, 147 sections, 14.96 MB) also had `human.skin` (a base skin picture, `HSK1`), `human.detect` (a face detector, `HDT1`), `registry` (6,301 records: the numbers of real specimens) and `animals.index` with 93 `animal.<name>` sections (a creature's structure as JSON and its mesh as bytes). They fed the generators, the importer and the photo-face and skin modules, which are not in this repo, so they were cut out (every other section is byte for byte the same). Without `human.skin` a lite human is drawn from the palette: asking for `def.skin` or `def.face_warp` gives a note and the palette.

## How to read it

**The file**: four letters `HSY1`, the header's length (u32, little endian), the header as JSON (padded to 4 bytes), then the sections' blobs, **each gzipped on its own** (a page unzips only what it asks for).

```
header = { format: "happy.system", version: 1,
           sections: [{ name, kind: "tree" | "raw", o (offset from the end of the header), n (bytes in the file), raw (bytes unzipped), meta? }, ...] }
```

* `raw` section: the bytes as they are, in a format of their own (the four-letter magic says which: `HLT1`, `HSK1`, `HDT1`, `HGT1`; an `animal.<name>` is a u32 length, a JSON head, then a mesh).
* `tree` section: plain JSON values. To keep the file small every array that holds only numbers (a track, the harmonics of a gait) is cut out of the text and written to a pool: its length, the decimals its numbers had (0 to 6), then each number as the difference from the one before (zigzag varint). It is **lossless** (a number that would not come back as the same double stays in the text). **You never see this**: `pack.tree(name)` gives the ordinary JSON of the examples below.
* `meta` in the header says what a section holds without unzipping it: `{ count, legs }` for a gait library, `{ count, about, preset? }` for an action set.

In a page (the engine's own loader):
```js
const system = await engine.system.load("/system/system.bin");
const lib = await system.gaits.library("people");          // { format, version, description, gaits: [style ...] }
const set = await system.actions.set("designed_basic");    // { format, version, name, description, tags, actions: [action ...] }
system.sections("actions.");  system.info("actions.mixamo");  // what is in it, nothing unzipped
```
In node (`system/data.js` is a packing module with no dependency; give it zlib):
```js
const fs = require("fs"), zlib = require("zlib");
let D = null; new Function("packing", fs.readFileSync("system/data.js", "utf8"))(function () { return function (name, factory) { D = factory(); }; });
const pack = D.parse(fs.readFileSync("system/system.bin"), { inflate: function (b) { return zlib.gunzipSync(Buffer.from(b)); } });
pack.names("gaits.");                       // the sections whose names start so (nothing is unzipped)
const lib = await pack.tree("gaits.people");   // the JSON
const bytes = await pack.bytes("human.model"); // a raw section
```

## The gait libraries and the action sets

Both kinds of file have the same envelope: `{ format, version: 1, description, ... }` with the list inside (`gaits` or `actions`). A library file is `{ format: "happy.gaits", version: 1, description, gaits: [style] }`; a set is `{ format: "happy.actions", version: 1, name, description, tags, actions: [action] }` (`tags` lists the words the actions of the set `emit`).

**3,383 gait styles in 18 libraries**

| library | styles | legs |
|---|---|---|
| `accubvh` | 36 | 36 with 2 legs |
| `animals` | 63 | 10 with 2 legs, 53 with 4 legs |
| `animset` | 34 | 34 with 2 legs |
| `cmu` | 392 | 392 with 2 legs |
| `corpus_bipeds` | 425 | 425 with 2 legs |
| `corpus_birds` | 126 | 126 with 2 legs |
| `corpus_dinosaurs` | 202 | 139 with 2 legs, 62 with 4 legs, 1 with 6 legs |
| `corpus_insects` | 71 | 6 with 2 legs, 5 with 4 legs, 60 with 6 legs |
| `corpus_people` | 189 | 189 with 2 legs |
| `corpus_quadrupeds` | 1193 | 1193 with 4 legs |
| `designed` | 3 | 3 with 2 legs |
| `mixamo` | 64 | 64 with 2 legs |
| `motus` | 33 | 33 with 2 legs |
| `normal_stable` | 26 | 26 with 2 legs |
| `people` | 19 | 19 with 2 legs |
| `reallusion` | 464 | 464 with 2 legs |
| `slow_stable` | 12 | 12 with 2 legs |
| `happybvh` | 31 | 31 with 2 legs |

**7,064 actions in 27 sets** (`designed_*` are the hand-made presets; `learned_*` were measured from recorded clips; the rest are fitted from motion capture)

| set | actions |
|---|---|
| `designed_basic` | 21 |
| `designed_life` | 42 |
| `designed_dance` | 9 |
| `designed_pose` | 17 |
| `designed_legs` | 5 |
| `corpus_quadrupeds` | 1462 |
| `corpus_dinosaurs` | 213 |
| `corpus_birds` | 197 |
| `corpus_insects` | 124 |
| `corpus_people` | 78 |
| `reallusion` | 943 |
| `animset` | 703 |
| `motus` | 356 |
| `happybvh` | 243 |
| `learned_corpus_quadrupeds` | 382 |
| `learned_corpus_dinosaurs` | 50 |
| `learned_corpus_birds` | 22 |
| `learned_corpus_insects` | 24 |
| `learned_corpus_people` | 20 |
| `learned_reallusion` | 223 |
| `learned_animset` | 313 |
| `learned_motus` | 125 |
| `learned_happybvh` | 28 |
| `accubvh` | 582 |
| `learned_accubvh` | 126 |
| `mixamo` | 586 |
| `learned_mixamo` | 170 |

## A gait style

A style is one recorded gait taken out of its clip. Its numbers are in **the units of the animal that walked** (a leg length, a hips' height, a share of a cycle), so any creature can take them: its own leg length makes them its own, and each of its legs steps like the limb of its side and rank.

| field | meaning | rule |
|---|---|---|
| `name` | what a creature asks for: `legs: { gait: { from: "name" } }` | **required**: letters, digits, `_`, not starting with a digit |
| `speed` | how fast the body goes, **leg lengths a second** | **required**, above 0, at most 1000 |
| `stride` | the distance of one step, in leg lengths | **required**, above 0, at most 1000 |
| `swing` | the share of the cycle a foot is in the air | **required**, above 0, below 1 |
| `phase` | when each limb steps after the first, a share of the cycle: `{ fl, fr, ml, mr, hl, hr }` (front, middle, hind; left, right) | **required**: at least two limbs, each 0 to 1. The number of keys is the number of legs (`legs` is made from it). If the style has `upper`, its `ref` must name a limb whose phase is 0 |
| `cycle` | seconds of one cycle | optional; default `2 * stride / speed` |
| `step_height`, `bob`, `ride` | how high the foot lifts (leg lengths), how far the hips bob, how high the hips ride (a share of the creature's own, 1) | optional; `ride` 0.1 .. 3 |
| `path`, `path_tangent` | how the foot goes through a step: 2 to 8 knots `[progress 0..1, height as minus a share of the step height]` and the tangent of the spline through them (above 0, to 2) | optional |
| `feet` | what the foot and the knee do through a step: three tables `pitch`, `yaw`, `knee` of **16 numbers** over the foot's own cycle (it leaves the floor at 0), degrees | optional |
| `upper` | what everything above the legs does over a cycle: `{ ref, hips, spine, neck, head: { yaw, pitch, roll }, arm_l, arm_r: { x, y, z } }`; each channel is `[mean, A1, p1, A2, p2, A3, p3]` (a mean and up to three harmonics: amplitude and phase each; degrees, or arm lengths for a hand), the cycle counted from the step of the limb `ref` (the one whose phase is 0) | optional; checked and kept with the style |
| `species`, `source`, `pattern`, `tags`, `description`, `generic` | where it came from and how to find it (`pattern`: `alternate`, ...) | optional text |

The example is the first style of `gaits.people`, a person's creeping walk (the description is cut):
```json
{
  "name": "person_walk_creeping",
  "species": "person",
  "source": "Walk_12_Creeping_Loop",
  "legs": 2,
  "pattern": "alternate",
  "tags": ["alternate","walk","slow","creeping","crouched"],
  "speed": 0.734,
  "stride": 0.697,
  "swing": 0.341,
  "step_height": 0.108,
  "path": [
    [0,0],
    [0.168,-0.775],
    [0.276,-0.993],
    [0.385,-0.888],
    [0.505,-0.582],
    [0.641,-0.26],
    [0.8,-0.049],
    [1,0]
  ],
  "path_tangent": 0.5,
  "feet": {
    "pitch": [-41.5,-63.1,-53.9,-22.1,6.2,20.4,19,10.2,2.6,0.4,-0.3,-1.3,-2.7,-5.9,-11.4,-21.3],
    "yaw": [-2.1,1,3.6,5.5,5.7,2.8,0.9,-0.7,-2,-2.2,-2.2,-2.1,-2,-1.9,-1.9,-2.7],
    "knee": [1.8,2.5,4.4,5.4,7.3,9.3,8.6,5.8,3.1,1.1,-0.6,-1.1,-2.5,-3.1,-1,1.3]
  },
  "bob": 0.082,
  "ride": 0.877,
  "cycle": 1.9,
  "phase": {"hl":0,"hr":0.485},
  "upper": {
    "ref": "hl",
    "hips": {"pitch":[-9.769,1.053,0.308,1.699,0.469]},
    "spine": {"pitch":[-22.344,0.783,0.759,1.491,0.874],"roll":[0,2.438,0.923]},
    "neck": {"pitch":[4.715,0.531,0.823],"roll":[0,0.67,0.298]},
    "head": {"pitch":[8.449,1.662,0.732]},
    "arm_l": {"x":[0.118,0.054,0.464],"y":[-0.466],"z":[0.561,0.081,0.933]},
    "arm_r": {"x":[0.132],"y":[-0.405],"z":[0.536]}
  },
  "description": "a person's creeping walk (the clip Walk_12_Creeping_Loop, Mo..."
}
```
A minimal style that is valid by the rules above: `{ "name": "my_walk", "speed": 1, "stride": 0.8, "swing": 0.4, "phase": { "hl": 0, "hr": 0.5 } }`. A creature uses a style by name: `legs: { gait: { from: "person_walk_creeping" } }` in its file, or `sp.set_style("person_walk_creeping")` while it walks.

## An action

An action is plain data that the player plays on **any creature that has the roles it names**; a creature that lacks a role simply skips those tracks. Its numbers are creature independent (degrees, arm lengths, leg lengths, hips' heights).

| field | meaning | rule |
|---|---|---|
| `name`, `title`, `description` | the name an action is played by (`api.action("<set>::<name>")`), a label, words | `name`: letters, digits, `_`, 40 at most |
| `kind` | `attack`, `movement`, `locomotion`, `gesture`, `reaction`, `idle`, `activity`, `social`, `dance`, `pose` | |
| `priority` | which action wins when two want the body | -100 .. 100 |
| `fade` | `[in, out]` seconds blended with whatever the body was doing | |
| `end` | `"once"` (it plays and ends) or `"hold"` (it holds its last pose) | |
| `frame` | `"body"`: the hands' numbers are in the creature's own frame, forward is where it faces; `"chest"`: in the chest's, as a recorded motion's are | |
| `height` | metres: the jump of a phase marked `air` | |
| `params` | the kinds of the numbers the caller gives, in order: `target`, `power`, `speed`, `height`, `mirror` | |
| `phases` | `[{ name, t (seconds), ease, air }]`: the action is its phases one after another; `ease` is how a value moves inside the phase (`linear`, `smooth`, `ease_in`, `ease_out`, `fast_out`, `slow_in`, `back`, `spring`, `snap`, `hold`); `air`: the BODY plays it (the flight of a jump) | at most 16 phases, 20 s in all |
| `tracks` | `[{ c, v, ... }]`, one per channel (below) | at most 48 |
| `events` | `[{ at: [phase, 0 .. 1], type, ... }]`: things that happen at a moment; types `emit`, `impulse`, `hit`, `show`, `hide`, `mount` | at most 24 |
| `waits` | `[{ at: [phase, 0..1], tag, max }]`: the clock stops there until released, or `max` seconds | optional, at most 4 |
| `learn` | what the tool that measured it recorded (class, effect, tier, source ...) | optional; nothing plays it |

**A track** is `{ c, v }`: `c` the channel and `v` the value **at the start of the first phase and at the end of every phase**, so a track has `phases.length + 1` values (the wave below has 3 phases and 4 values per track). Optional keys: `e` (an ease for a phase that is not the phase's own), `h` (a hump over each phase, added as `sin(pi u)`: 0 at both ends), `lag` (seconds), `amp` (how much of it), `pw` (0: the power the caller gives does not scale it), `osc: { hz, a, ph, from, to }` (an oscillation added over the phases from index `from` to `to`).

**The channels** (`c` is `<name>.<axis>`, e.g. `head.pitch`; 58 of them). A hand or a foot is a place measured from its shoulder or hip; `legf_*` are the front legs of a four-legged body; `own` (0 .. 1) marks that foot as the action's own; `pole` turns the plane the elbow or knee bends in. Left and right have the same ranges, and the `mirror` param plays an action on the other side.

| channels | axes, range (meaning) | unit |
|---|---|---|
| `hips` | `yaw` +-90 (turn (+ left)); `pitch` +-110 (bend (+ up, back)); `roll` +-110 (tilt (+ right)) | degrees |
| `spine`, `chest` | `yaw` +-90 (turn (+ left)); `pitch` +-60 (bend (+ up, back)); `roll` +-60 (tilt (+ right)) | degrees |
| `neck` | `yaw` +-80 (turn (+ left)); `pitch` +-60 (bend (+ up, back)); `roll` +-45 (tilt (+ right)) | degrees |
| `head` | `yaw` +-90 (turn (+ left)); `pitch` +-60 (bend (+ up, back)); `roll` +-45 (tilt (+ right)) | degrees |
| `tail` | `yaw` +-120 (turn (+ left)); `pitch` +-90 (bend (+ up, back)); `roll` +-90 (tilt (+ right)) | degrees |
| `hips (moved)` | `x` +-0.6 (out); `y` -0.8 .. 0.5 (up); `z` +-0.8 (forward) | hips' heights |
| `jaw` | `open` 0 .. 60 (open) | degrees |
| `arm_l`, `arm_r` | `x` +-1.2 (out); `y` +-1.2 (up); `z` +-1.2 (forward); `grip` 0 .. 1 (grip); `pole` +-120 degrees (bend plane (+ out)) | arm lengths |
| `leg_l`, `leg_r`, `legf_l`, `legf_r` | `x` +-1.2 (out); `y` -1.1 .. 0.6 (up); `z` +-1.2 (forward); `own` 0 .. 1 (the action's foot); `pole` +-90 degrees (bend plane (+ out)) | leg lengths |
| `body` | `fwd` +-8 (forward); `side` +-8 (to the left) | hips' heights a second |
| `look` | `look` 0 .. 1 (how much) | a share, 0 .. 1 |
| `wings` | `fold` 0 .. 1 (folded (0 spread .. 1)); `hz` 0 .. 20 Hz (beats a second); `amp` 0 .. 90 degrees (beat (degrees)) | see the axes |

**An event**, as the `punch` of `designed_basic` has them: `{ "at": ["strike", 0], "type": "emit", "tag": "swing", "v": 1 }` says something a creature's mind can hear, and `{ "at": ["strike", 1], "type": "hit", "limb": "hand_r", "damage": 12, "push": 2, "up": 0.1, "kind": 1, "reach": 0.14, "win": 0.09 }` is a blow that lands at the end of the `strike` phase.

The example is `wave` of `designed_basic` (a gesture: raise, wave, lower; the right hand, or a front leg when there is no arm):
```json
{
  "name": "wave",
  "title": "Wave",
  "kind": "gesture",
  "description": "The right hand is raised and waved from side to side, and lowered. A creature with no arms waves a front leg.",
  "priority": 3,
  "fade": [0.25,0.3],
  "end": "once",
  "frame": "body",
  "height": 1.1,
  "params": ["power","speed","mirror"],
  "phases": [
    {"name":"raise","t":0.35,"ease":"smooth","air":false},
    {"name":"wave","t":1,"ease":"linear","air":false},
    {"name":"lower","t":0.35,"ease":"smooth","air":false}
  ],
  "tracks": [
    {"c":"arm_r.y","v":[-0.92,0.45,0.45,-0.92]},
    {"c":"arm_r.x","v":[0.15,0.5,0.5,0.15],"osc":{"hz":3.5,"a":0.18,"ph":0,"from":1,"to":1}},
    {"c":"arm_r.z","v":[0.3,0.15,0.15,0.3]},
    {"c":"arm_r.grip","v":[0,0,0,0]},
    {"c":"legf_r.y","v":[-0.98,-0.5,-0.5,-0.98]},
    {"c":"legf_r.x","v":[0.08,0.18,0.18,0.08],"osc":{"hz":3.5,"a":0.08,"ph":0,"from":1,"to":1}},
    {"c":"legf_r.z","v":[-0.03,0.45,0.45,-0.03]},
    {"c":"legf_r.own","v":[0,1,1,0]},
    {"c":"head.roll","v":[0,5,5,0]},
    {"c":"spine.roll","v":[0,-3,-3,0]}
  ],
  "events": []
}
```
A minimal action, checked with the real validator (`validate` in `pure.js`, which fills in the defaults): 
```json
{"name":"nod","kind":"gesture","phases":[{"name":"down","t":0.3},{"name":"up","t":0.3}],"tracks":[{"c":"head.pitch","v":[0,-20,0]}],"events":[]}
```
A creature plays one with `api.action("designed_basic::wave")` in its function and `me.act(...)` (the creature stands while it plays), and a set is put in the creatures' hands by `system.use({ actions: ["designed_basic"] })`. `MOTION.md` lists every action and gait style by type and by number of legs.

## Pruned in this export

The numbers above are those of the full file. **This copy was cut down to what the demos use and the creature files name** (tools/prune_system_bin.js, keep list tools/system_bin_keep.json, and every gait style and action that a file of system/creatures/ names): 117 of the 3383 gait styles (10 of 18 libraries), 77 of the 7064 actions (12 of 27 sets) and 72 of the 441 clip sets, the sets' lists cut to the clips that are left. The blocks, `human.model` and `ground.textures` are as they were. Every creature of system/creatures/ finds its gait styles and its actions; a block or a script that asks for another clip fails. Use the full file (the repo's `system/system.bin`) for that.
