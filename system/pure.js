// THE PURE MODULES of the creature system: no engine, no DOM, no node module. Each is `packing()("name", function name() { ... })` (the bundler's, and node's own loader: new Function("packing", text)); the page and the worker
// include this file where they need it with a `packing` that keeps the factories by name, and make the ones they use (system.js: `pure`).
// Ported 2026-11-05 from the first version of the creature system, renamed and merged by domain. From here this file is the source.

// ========================================================================================================================
// tissue_kinds
// ========================================================================================================================
packing()("happy_tissue_kinds", function happy_tissue_kinds() {
  "use strict";
  // HAPPY TISSUE KINDS: the DATA of the soft tissue bones a creature can be given (pure.js adds them; SYSTEM.md "Tissue bones"). Pure data: no engine, no DOM, no files; node and the page read the same
  // object. Node 14 and the bundler's parser: no optional chaining, no ??, no class.
  //
  // A TISSUE BONE is a new bone placed on the body where it carries more fat and meat than the bone under it (a belly, breasts, buttocks, thighs, the underside of the upper arms, flanks, jowls, cheeks, a dewlap, a hump,
  // a brisket). It is a LEAF that hangs from a bone of the body (its HOST, never a bone of a rig chain itself), it carries the skin round it (a mesh: weights carved out of the bones round it; an sdf: a part that stands on it)
  // and it is SOFT by default: a mass on a spring that gravity and the body's motion move (body.cpp happy_life_soft; the bone's `soft` in the skeleton, body.js).
  //
  // Every kind says:
  //   title, what       a name and a line of words (what it is, on what)
  //   suits             the creatures it is for: "person" (an upright trunk with arms), "biped" (two legs), "quadruped" (four legs, a level trunk), "any"; posture: "upright" | "level" | "any" (the trunk's: hips -> neck)
  //   needs             what the creature must have: "trunk" (a hips bone and a neck or a head above it), "legs" (leg chains: the hind ones), "arms" (roles.arms), "head" (roles.head), "neck" (roles.neck)
  //   pair              true: one on each side (a twin, the mirror image of the left one), false: one on the middle
  //   soft              the spring at the REFERENCE size (SIZE_REF, a person's): hz (the natural frequency, Hz), damping (the ratio), gain (how much of the mass's motion the bone takes), limit (the most the bone moves,
  //                     a share of the skeleton's size), axis (the weight of the model's x (left), y (up), z (forward)). tissue.js scales the frequency by sqrt(SIZE_REF / the creature's size) (a pendulum of its own size:
  //                     an elephant's belly is slower than a dog's) and the limit by the size; the worker scales the frequency again by 1 / sqrt(the instance's scale)
  //   where             the placement in words, and as data:
  //     region          "trunk": the line from the hips' head to the neck's head (the hips bone, the spine, the chest: the nearest of them is the host)
  //                     "leg": the first bone of each HIND leg chain (a leg whose root hangs from the hips; a biped's two), "arm": the upper arm of each arm of roles.arms (the second last bone of its chain)
  //                     "head": the head bone (a start on the jaw's line when the creature has a jaw bone), "neck": the line from the first neck bone's head to the head's head (the nearest neck bone is the host)
  //     u               where along the region's line (0 its start: the hips, a bone's head; 1 its end): a number, or { upright, level } by the trunk's posture
  //     offset          (pairs) how far to the side the start is, a share of the body's half width there (the breasts, the buttocks: not on the middle line)
  //     dir             the way from the start (on the region's axis) to the skin: { frame: "region", v } in the region's frame (x: out to the side, mirrored for a right twin; y: along the region's line, toward its end;
  //                     z: VENTRAL, the belly's side: forward for an upright trunk, down for a level one), or { frame: "body", v } in the model's axes (x out to the side, y up, z forward), made square to the region's line
  //   size              the tissue's ellipsoid: along (its radius along the region's line, a share of the region's length: the trunk's, the bone's, the head's, the neck's), across (its radius across, a share of the body's
  //                     half width there), through (its radius into the body, a share of the body's thickness along dir), under (how deep under the skin its middle is, a share of the thickness), tail (the bone's length
  //                     out along dir, a share of the thickness)
  //   peak              the share of its skin a vertex at the middle gives the tissue bone (a vertex at the edge gives none; at rest everything is where it was): `strength` of a request is this number
  //   takes             the bones a weight may be taken from (never from an arm into a belly): "trunk" (the hips, the spine, the chest), "neck", "head", "jaw", "chest" (the chest bone alone), "hind_legs" (the first bone of
  //                     each hind leg), "fore_legs" (of each fore leg: a glb's brisket is skinned to the shoulders), "host" (the bone it hangs from), "host_parent" (that bone's parent)
  //
  // The numbers: breast, buttock, belly, flank, thigh and upper_arm are system 2.0's (v1/human/human_happy.js: soft_def's formulas from the body's macros and FAT's regions), the breast and the buttock at the default body
  // (every macro 0.5), the four fat kinds at a heavier one (weight 0.75: a creature that ASKS for a belly has one); jowl, cheek, dewlap, hump and chest (a brisket) are new, set from what the worker made of them
  // (tests/tissue_native_test.cpp, a walk at 0.9 m/s and a run at the top speed of a jaguar, a bear, a hound, the person and an elephant): a jowl at 3 Hz and gain 0.8 sat on the head's bob (2 to 3 Hz) and swung 9 to
  // 22 mm at a walk, 80 at a bear's run; at 4.5 Hz and 0.35 it is 1 to 4 mm of the vertices at a walk, 6 to 23 at a run. A dewlap and a hump swung sideways 5 to 10 cm at a run (the neck and the withers yaw with the gait):
  // their side weight is halved (0.45, 0.5) and the dewlap's gain 0.7. The belly (system 2.0's) moves its vertices 1 to 2 cm at a walk and 1 to 4 cm at a run: kept.

  const VERSION = 1;
  const SIZE_REF = 1.7;                           // metres: the size (the largest extent of the skeleton) the springs' frequencies are for: system 2.0's numbers are a person's of 1.7 m

  const KINDS = {
    belly: {
      title: "belly", what: "the fat of the abdomen: in front of an upright trunk (a person's paunch), under a level one (a dog's, a pig's, a bear's belly)",
      suits: ["person", "biped", "quadruped"], posture: "any", needs: ["trunk"], pair: false,
      soft: { hz: 2.25, damping: 0.4, gain: 0.88, limit: 0.07, axis: [0.5, 1, 0.9] },
      where: "on the trunk a quarter of the way from the hips to the neck (an upright one; 0.42 of a level one), on its belly side",
      region: "trunk", u: { upright: 0.26, level: 0.42 }, offset: 0, dir: { frame: "region", v: [0, 0, 1] },
      size: { along: 0.38, across: 1.0, through: 0.45, under: 0.15, tail: 0.15 }, peak: 0.85, takes: ["trunk"],
    },
    breast: {
      title: "breast", what: "a breast: on the chest of an upright trunk, a little to each side of the middle",
      suits: ["person", "biped"], posture: "upright", needs: ["trunk"], pair: true,
      soft: { hz: 3.0, damping: 0.22, gain: 1.0, limit: 0.08, axis: [0.55, 1, 0.8] },
      where: "on the chest, two thirds of the way from the hips to the neck, 0.42 of the half width to each side, facing forward and a little out",
      region: "trunk", u: { upright: 0.68, level: 0.75 }, offset: 0.42, dir: { frame: "region", v: [0.2, 0, 1] },
      size: { along: 0.2, across: 0.6, through: 0.45, under: 0.12, tail: 0.15 }, peak: 0.85, takes: ["trunk"],
    },
    buttock: {
      title: "buttock", what: "a buttock: behind the hips, one on each side, a little under the hip joints",
      suits: ["person", "biped"], posture: "upright", needs: ["trunk"], pair: true,
      soft: { hz: 3.4, damping: 0.35, gain: 1.0, limit: 0.06, axis: [0.5, 1, 0.7] },
      where: "behind the hips' head and a little below it, 0.45 of the half width to each side, facing back",
      region: "trunk", u: { upright: -0.1, level: 0.02 }, offset: 0.45, dir: { frame: "region", v: [0.15, -0.1, -1] },
      size: { along: 0.23, across: 0.75, through: 0.5, under: 0.12, tail: 0.15 }, peak: 0.85, takes: ["trunk", "hind_legs"],
    },
    flank: {
      title: "flank", what: "the flanks (love handles): the sides of the trunk over the hips, which swing sideways with the gait more than they bounce",
      suits: ["person", "biped", "quadruped"], posture: "any", needs: ["trunk"], pair: true,
      soft: { hz: 2.45, damping: 0.42, gain: 0.7, limit: 0.05, axis: [0.9, 0.8, 0.5] },
      where: "on each side of the trunk, a little above the hips (0.28 of an upright trunk, 0.45 of a level one)",
      region: "trunk", u: { upright: 0.28, level: 0.45 }, offset: 0, dir: { frame: "region", v: [1, 0, 0] },
      size: { along: 0.23, across: 1.0, through: 0.38, under: 0.1, tail: 0.15 }, peak: 0.85, takes: ["trunk"],
    },
    thigh: {
      title: "thigh", what: "the fat on the outside and the back of the thigh (a quadruped's hams): on the first bone of each hind leg",
      suits: ["person", "biped", "quadruped"], posture: "any", needs: ["legs"], pair: true,
      soft: { hz: 3.25, damping: 0.42, gain: 0.84, limit: 0.05, axis: [0.7, 1, 0.6] },
      where: "0.4 of the way down the thigh bone of every hind leg, on its outside and its back",
      region: "leg", u: 0.4, offset: 0, dir: { frame: "body", v: [0.65, 0, -0.45] },
      size: { along: 0.46, across: 1.0, through: 0.5, under: 0.1, tail: 0.15 }, peak: 0.85, takes: ["host", "host_parent"],
    },
    upper_arm: {
      title: "upper arm", what: "the underside and the back of the upper arm (what swings under a raised arm): on the upper arm of each arm",
      suits: ["person", "biped"], posture: "any", needs: ["arms"], pair: true,
      soft: { hz: 3.45, damping: 0.42, gain: 0.51, limit: 0.04, axis: [0.5, 1, 0.6] },
      where: "the middle of the upper arm of every arm, on its back and its underside",
      region: "arm", u: 0.5, offset: 0, dir: { frame: "body", v: [0, -0.35, -0.94] },
      size: { along: 0.45, across: 1.0, through: 0.55, under: 0.2, tail: 0.15 }, peak: 0.85, takes: ["host", "host_parent"],
    },
    jowl: {
      title: "jowl", what: "jowls: the loose skin that hangs at each side of the lower jaw (a bulldog's, a mastiff's, an old person's)",
      suits: ["any"], posture: "any", needs: ["head"], pair: true,
      soft: { hz: 4.5, damping: 0.35, gain: 0.35, limit: 0.012, axis: [0.6, 1, 0.5] },
      where: "at each side of the lower jaw: from the middle of the jaw bone (of the head bone when there is no jaw) out and down",
      region: "head", u: 0.45, offset: 0, dir: { frame: "body", v: [0.75, -0.6, 0.1] },
      size: { along: 0.28, across: 0.6, through: 0.5, under: 0.15, tail: 0.15 }, peak: 0.85, takes: ["head", "jaw", "neck"],
    },
    cheek: {
      title: "cheek", what: "full cheeks: the soft side of the face under the eyes",
      suits: ["any"], posture: "any", needs: ["head"], pair: true,
      soft: { hz: 5.5, damping: 0.35, gain: 0.25, limit: 0.008, axis: [0.5, 1, 0.5] },
      where: "at each side of the face, 0.4 of the way along the head bone, out and forward",
      region: "head", u: 0.4, offset: 0, dir: { frame: "body", v: [0.85, -0.25, 0.45] },
      size: { along: 0.2, across: 0.45, through: 0.4, under: 0.12, tail: 0.15 }, peak: 0.85, takes: ["head", "jaw"],
    },
    dewlap: {
      title: "dewlap", what: "a dewlap: the fold of skin that hangs under the throat (a cow's, a zebu's, an iguana's; a person's double chin)",
      suits: ["quadruped", "any"], posture: "any", needs: ["neck"], pair: false,
      soft: { hz: 2.6, damping: 0.3, gain: 0.7, limit: 0.035, axis: [0.45, 1, 0.6] },
      where: "under the throat: on the neck's belly side, near the middle of a level neck (0.8 of the way up an upright one: under the chin)",
      region: "neck", u: { upright: 0.8, level: 0.45 }, offset: 0, dir: { frame: "region", v: [0, 0, 1] },
      size: { along: 0.4, across: 0.6, through: 0.45, under: 0.12, tail: 0.15 }, peak: 0.85, takes: ["neck", "head", "chest", "fore_legs"],
    },
    hump: {
      title: "hump", what: "a hump: the fat over the withers (a zebu's, a bison's, a camel's)",
      suits: ["quadruped"], posture: "level", needs: ["trunk"], pair: false,
      soft: { hz: 2.6, damping: 0.35, gain: 0.6, limit: 0.035, axis: [0.5, 1, 0.5] },
      where: "on the back over the shoulders: 0.82 of the way from the hips to the neck of a level trunk, on its back side",
      region: "trunk", u: { upright: 0.92, level: 0.82 }, offset: 0, dir: { frame: "region", v: [0, 0, -1] },
      size: { along: 0.22, across: 0.6, through: 0.4, under: 0.15, tail: 0.15 }, peak: 0.85, takes: ["trunk", "neck"],
    },
    chest: {
      title: "chest", what: "a heavy chest (a brisket): the front of a level trunk between the fore legs (a bull's, a bear's)",
      suits: ["quadruped"], posture: "level", needs: ["trunk"], pair: false,
      soft: { hz: 2.6, damping: 0.35, gain: 0.7, limit: 0.04, axis: [0.5, 1, 0.8] },
      where: "under the front of the trunk: 0.88 of the way from the hips to the neck of a level trunk, down and forward",
      region: "trunk", u: { upright: 0.62, level: 0.88 }, offset: 0, dir: { frame: "region", v: [0, 0.4, 1] },
      size: { along: 0.2, across: 0.6, through: 0.4, under: 0.15, tail: 0.15 }, peak: 0.85, takes: ["trunk", "neck", "fore_legs"],
    },
  };
  const ORDER = ["belly", "breast", "buttock", "flank", "thigh", "upper_arm", "jowl", "cheek", "dewlap", "hump", "chest"];
  const REGIONS = ["trunk", "leg", "arm", "head", "neck"];
  const SUITS = ["person", "biped", "quadruped", "any"];
  const POSTURES = ["upright", "level", "any"];

  // a deep copy of a kind (null: no such kind): the data cannot be changed through what is handed out
  function kind(name) { const k = typeof name === "string" && Object.prototype.hasOwnProperty.call(KINDS, name) ? KINDS[name] : null; return k ? JSON.parse(JSON.stringify(k)) : null; }
  function names() { return ORDER.slice(); }

  return { VERSION: VERSION, SIZE_REF: SIZE_REF, KINDS: KINDS, ORDER: ORDER, REGIONS: REGIONS, SUITS: SUITS, POSTURES: POSTURES, kind: kind, names: names };
});

// ========================================================================================================================
// tissue
// ========================================================================================================================
packing()("happy_tissue", function happy_tissue() {
  "use strict";
  // HAPPY TISSUE: TISSUE BONES added to a creature (SYSTEM.md "Tissue bones"). The user asks for a belly, breasts, buttocks, thighs, the undersides of the upper arms, flanks, jowls, cheeks, a dewlap, a hump or a heavy chest
  // (the kinds: pure.js) and gets a NEW BONE for each, placed on THIS creature's body: a leaf that hangs from a bone of the body (never a bone of a rig chain itself), that carries the skin there and that is SOFT by
  // default (a mass on a spring: body.cpp happy_life_soft, the bone's `soft` in the skeleton, body.js). Pure: plain arrays and objects in, plain objects out (no engine, no DOM, no files); node and the page run the same
  // code. Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no class; the word that includes files is never written here.
  //
  // THE REQUEST: a definition says `tissue: [ ... ]` (system.species / system.compile expand it: species.js), each entry a kind's name or
  //   { kind, parent?: bone, at?: [x, y, z] (model space, the bind pose: a point on the skin, a click), dir?: [x, y, z] (from the bone's axis out to the skin), radius?: metres | [through, along, across],
  //     strength?: 0 .. 1 (the share of its skin a vertex at the middle gives the new bone: the kind's peak, 0.85), mirror?: true | false (a pair kind is two, a twin on each side: the kind's), side?: "l" | "r" (one of a pair),
  //     name?: the bone's (a pair: name_l and name_r), soft?: true | false | { stiffness | hz, damping, gain, limit, axis } (false: a plain helper bone, no spring; an object: what the bone says, over the kind's numbers),
  //     shape?: "carve" (the default) | "grow" (an sdf creature: a part grows the tissue), bulge?: metres (grow, the part that far proud of the skin) }
  //
  // THE API (every call returns new objects: the definition given is never changed; the sections it does not change are shared with it):
  //   use_kinds(happy_tissue_kinds) -> this module (the kinds' data: pure.js; node: tools/tissue_tool.js load() wires them)      use_mesher(happy_mesher) -> this module (an sdf creature's surface is the mesher's own field)
  //   expand(def, spec?, options?) -> { def (a NEW definition: the bones added, a mesh's skin carved, an sdf's grown parts added, no `tissue` key), added: [bone names], placements, notes, warnings, stats, skin? (an sdf's
  //                                     regions for the skin of its meshed body: carve_mesh) }      (spec: def.tissue when left out)
  //   carve_mesh(mesh, skin) -> { mesh (the same arrays but a carved skin), per, touched }
  //   placement(def, kind, options?) -> [{ kind, name, side, parent, at (the bone's head: the middle of the tissue, under the skin), tail, dir, surface (the point of the skin), radius: [through, along, across], axes,
  //                                       mirror (it has a twin), thickness, width, length, takes: [bones], posture, fallback }]: where a kind goes on THIS creature (a UI shows it, the user overrides it)
  //   describe(kind) -> words      kinds() -> [{ name, title, what, suits, posture, needs, pair, soft, where }]      check(def) -> { kinds: [what suits it and where], soft: [the bones that are soft already], ... }
  //   options: { soft: true (write the bone's `soft`; false: none), mesher (the happy_mesher module: else the one use_mesher gave), strength (every request's that says none) }
  //
  // WHAT IT DOES TO A CREATURE.
  //   The bone: a child of the host bone (the nearest bone of the kind's region), its head at the middle of the tissue (just under the skin), its tail out along the placement's direction. It is appended to the skeleton (no
  //   index of a bone that was there moves: a mesh's skin stays valid); a host that had no `tail` of its own gets the tail it had written in (a bone's tail is the mean head of its children when it is not given: a new
  //   child would move it), and a host that was the twin of a `mirror: "x"` entry has that entry written out as its two bones (the same order). No joint and no chain: the soft layer moves it, nothing else does.
  //   A MESH (plain arrays): the skin weights round the tissue are CARVED out of the bones of the kind's region (`takes`): the tissue is an ellipsoid (radii through the body, along the region, across it); a vertex at its
  //   middle gives `strength` of its weight to the new bone, one at its edge none, by the falloff (1 - q^2)^2 (q: the vertex's place in the ellipsoid, 0 at the middle, 1 on its surface) and a facing gate (a vertex that faces
  //   away from the tissue's direction gives nothing: the back of a thin creature; the normals are the winding's, shared by the copies of a vertex at a uv seam, not the file's: a glb's can point in); only the weights of the
  //   bones it takes from are made smaller, in proportion; a vertex keeps at most 4 bones (the weakest of the bones that
  //   give goes into the new one, so that no other bone's weight is touched) and its weights add up to 1, strongest first. The positions and the normals are the same arrays: at rest everything is where it was, and a vertex
  //   that no tissue reaches keeps its weights to the last bit.
  //   An SDF, the DEFAULT: the shape is the creature's own (the parts are not touched: the meshed creature is the same to the last bit, with or without the request); the regions go with the result (`skin`) and the
  //   skin of the mesh the mesher makes is carved by them afterwards exactly as a mesh's is (carve_mesh; the page does it: species.js, after the mesher's output). `shape: "grow"` (or `bulge: <metres>`): a PART
  //   that stands on the new bone grows the tissue out of the body (an ellipsoid at the tissue's place, the colour and the material of the body there, no island: it blends in), as proud of the skin as the mesher's own
  //   weight rule needs for its middle to give `strength` of its skin to the new bone (at most a third of its depth; `bulge` says how far), and the mesher gives it its skin: the creator's intended geometry.
  //   The surface is the mesher's own field (compile + make_field of mesher.js: exactly what is meshed).
  //   NO BODY (a definition whose mesh or sdf was taken away: a test's, a tool's): the bones are placed by the skeleton alone (the skin a share of the region's length from its line: REACH) and a warning says so.
  //   A MARK (no kind, no new bone, no spring): { mark: "<a bone the creature has>", at: [x, y, z] (a point of the skin), dir: [x, y, z] (the way out of the skin there), radius: metres (the PATCH), strength?: 0 .. 1 (1: how hard the patch
  //   follows the bone; its middle gives that share of its weight), core?: 0 .. 0.95 (the share of the radius that follows the bone as a whole: 0.5; the weight falls smoothly to nothing at the radius), color?: [r, g, b] (painted
  //   into the vertex colours of the patch, a crisp smoothstep of the patch's own falloff: a patch is PAINTED where it is, whichever bone the weight ends on), skin?: true (instead of a colour: the vertex's own colour, the
  //   mesher's, painted back: a lid that closes over an eye is skin), tint?: 0 .. 1 (how much of it: 1), takes?: [bones] (the skin is taken from these: the bone's parent), crisp?: 0 .. 0.95 (how sharp the painted edge is: 0, the default, blends over most of the falloff), radii?: [a, b] metres and axis?: [x, y, z]
  //   (an ELLIPTICAL patch: half extents a along the tangent `axis` and b across it, on the skin; `radius` is how far it reaches through it) }. The patches are taken IN THE ORDER OF THE REQUEST, a later one from what the
  //   earlier ones left and from the bones `takes` names (a pupil takes from its iris, which took from its white, which took from the skin of the host), and painted in the same order. The creator's `mark` parts are made into
  //   these. It adds no geometry and no bone: the SHAPE is the creature's own; the skin of the patch is carved to the bone (a mesh's now, an sdf's after the mesher, as for the kinds above), so the patch moves with the
  //   bone: a single sphere with marks is a creature whose eyes, ears and mouth are bones. A mark names a bone with `mirror: "x"` or its _r twin: the twin's request is the caller's (`at`, `dir` and `axis` mirrored).
  //   The SOFT flag: the kind's spring, the frequency times sqrt(SIZE_REF / the creature's size) (the size is the skeleton's largest extent, as body.js measures it: a big animal's tissue is slower), the limit a share of
  //   the size; `soft: {...}` of the request over it, field by field, as the bone's own `soft` says it (stiffness in Hz, limit in model units).

  let K = null, MESHER = null;
  const STRIDE = 20;                                                   // the mesher's primitive record (mesher.js compile: prim, n * 20 numbers; [1] op, [2] blend, [3] part, [13] bone row, [18] island)
  const REACH = { trunk: 0.18, leg: 0.18, arm: 0.16, head: 0.4, neck: 0.35 };     // a creature with no body: the skin is this share of the region's length from its line
  const SPEC_KEYS = ["kind", "parent", "at", "dir", "radius", "strength", "mirror", "side", "name", "soft", "shape", "bulge"];
  const MARK_KEYS = ["mark", "at", "dir", "radius", "strength", "core", "color", "skin", "tint", "takes", "radii", "axis", "crisp"];
  const MARK_CORE = 0.5;                                              // a mark's patch: the share of its radius that follows the bone whole (then the weight falls to nothing at the radius)
  const SOFT_FIELDS = ["stiffness", "hz", "damping", "gain", "limit", "axis"];
  const SOFT_RANGE = { stiffness: [0.2, 20], hz: [0.2, 20], damping: [0.01, 1], gain: [0, 16] };
  const MAX_BONES = 255, MAX_ADDED = 64;                             // system's bones (system.js MAX_BONES); the bones one request may add
  const NAME_RE = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
  const MIRROR_RE = /^(.*)_([lL])$/;
  const FACE_LO = -0.25, FACE_HI = 0.25;                              // the facing gate: a vertex whose normal is at n . dir <= -0.25 gives nothing, >= 0.25 gives all (smooth between)
  const SDF_PROUD = 0.33;                                              // an sdf tissue stands at most this share of its depth proud of the skin

  function use_kinds(k) { if (!k || !k.KINDS || !k.ORDER) throw new Error("happy_tissue: use_kinds takes the module of pure.js"); K = k; return api; }
  function use_mesher(m) { if (m !== null && m !== undefined && (typeof m.compile !== "function" || typeof m.make_field !== "function")) throw new Error("happy_tissue: use_mesher takes the happy_mesher module (compile, make_field)"); MESHER = m || null; return api; }
  function kinds_mod() { if (!K) throw new Error("happy_tissue: no kinds (use_kinds(happy_tissue_kinds) first)"); return K; }

  // ---- small helpers -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function madd(a, b, k) { return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); }
  function unit(a, fb) { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : (fb ? fb.slice() : [0, 1, 0]); }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function neg_x(v) { return [-v[0], v[1], v[2]]; }
  function r6(v) { return Math.round(v * 1e6) / 1e6; }
  function r3(v) { return Math.round(v * 1e3) / 1e3; }
  function v6(v) { return [r6(v[0]), r6(v[1]), r6(v[2])]; }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function is_vec3(v) { return Array.isArray(v) && v.length === 3 && v.every(function (x) { return typeof x === "number" && isFinite(x); }); }
  function mirror_ref(name) { const m = typeof name === "string" ? MIRROR_RE.exec(name) : null; return m ? m[1] + "_" + (m[2] === "l" ? "r" : "R") : name; }
  function fail_list(list) { const e = new Error("system: tissue: " + list.join("; ")); e.list = list; return e; }
  function now() { return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now(); }

  // ---- the skeleton as system reads it (kernel.js, kernel.js): the twins of `mirror: "x"` written out right after their left bone, a tail that is not given is the mean head of the children, else the parent's
  //      direction times half its length (at least 0.02), a root's 0.1 up. -> { n, names, index, parent, children, head(i), tail(i), length(i), given (the def's own tail), entry (the def's entry of the bone), twin_of_entry }
  function skeleton_of(raw) {
    if (!Array.isArray(raw) || !raw.length) throw fail_list(["the creature has no skeleton (a list of bones)"]);
    const defs = [], entry = [], twin = [];
    raw.forEach(function (b, e) {
      if (!b || typeof b !== "object" || typeof b.name !== "string") throw fail_list(["the skeleton's bone " + e + " has no name"]);
      defs.push(b); entry.push(e); twin.push(false);
      if (b.mirror !== undefined && b.mirror !== null) {
        const r = Object.assign({}, b);
        delete r.mirror;
        r.name = mirror_ref(b.name); r.parent = b.parent === null || b.parent === undefined ? b.parent : mirror_ref(b.parent);
        if (is_vec3(b.head)) r.head = neg_x(b.head);
        if (is_vec3(b.tail)) r.tail = neg_x(b.tail);
        if (b.roll) r.roll = -b.roll;
        defs.push(r); entry.push(e); twin.push(true);
      }
    });
    const n = defs.length, index = Object.create(null), names = [], parent = new Int32Array(n), children = [], H = new Float64Array(n * 3), T = new Float64Array(n * 3), L = new Float64Array(n), given = new Uint8Array(n);
    defs.forEach(function (b, i) {
      if (!is_vec3(b.head)) throw fail_list(["the bone '" + b.name + "' has no head [x, y, z]"]);
      if (index[b.name] !== undefined) throw fail_list(["two bones are named '" + b.name + "'"]);
      index[b.name] = i; names.push(b.name); children.push([]);
      H[i * 3] = b.head[0]; H[i * 3 + 1] = b.head[1]; H[i * 3 + 2] = b.head[2];
    });
    const roots = [];
    defs.forEach(function (b, i) {
      let p = -1;
      if (b.parent !== undefined && b.parent !== null) {
        p = typeof b.parent === "number" ? b.parent : index[b.parent];
        if (p === undefined || !(p >= 0 && p < n)) throw fail_list(["the bone '" + b.name + "' has the unknown parent '" + b.parent + "'"]);
      }
      parent[i] = p;
      if (p < 0) roots.push(i); else children[p].push(i);
    });
    const order = [], stack = roots.slice().reverse();
    while (stack.length) { const j = stack.pop(); order.push(j); for (let k = children[j].length - 1; k >= 0; k--) stack.push(children[j][k]); }
    if (order.length !== n) throw fail_list(["the bones' parents form a cycle"]);
    order.forEach(function (i) {
      const b = defs[i], p = parent[i], hx = H[i * 3], hy = H[i * 3 + 1], hz = H[i * 3 + 2];
      let tx = 0, ty = 0, tz = 0, have = false;
      if (is_vec3(b.tail)) { tx = b.tail[0]; ty = b.tail[1]; tz = b.tail[2]; have = true; given[i] = 1; }
      else if (children[i].length) {
        children[i].forEach(function (c) { tx += H[c * 3]; ty += H[c * 3 + 1]; tz += H[c * 3 + 2]; });
        tx /= children[i].length; ty /= children[i].length; tz /= children[i].length;
        have = Math.sqrt((tx - hx) * (tx - hx) + (ty - hy) * (ty - hy) + (tz - hz) * (tz - hz)) > 1e-6;
      }
      if (!have) {
        let dx = 0, dy = 1, dz = 0, fb = 0.1;
        if (p >= 0) { const l = L[p] || 1; dx = (T[p * 3] - H[p * 3]) / l; dy = (T[p * 3 + 1] - H[p * 3 + 1]) / l; dz = (T[p * 3 + 2] - H[p * 3 + 2]) / l; fb = Math.max(0.02, 0.5 * L[p]); }
        tx = hx + dx * fb; ty = hy + dy * fb; tz = hz + dz * fb;
      }
      T[i * 3] = tx; T[i * 3 + 1] = ty; T[i * 3 + 2] = tz;
      L[i] = Math.sqrt((tx - hx) * (tx - hx) + (ty - hy) * (ty - hy) + (tz - hz) * (tz - hz));
    });
    const sk = { n: n, names: names, index: index, parent: parent, children: children, given: given, entry: entry, twin_of_entry: twin, defs: defs };
    sk.head = function (i) { return [H[i * 3], H[i * 3 + 1], H[i * 3 + 2]]; };
    sk.tail = function (i) { return [T[i * 3], T[i * 3 + 1], T[i * 3 + 2]]; };
    sk.length = function (i) { return L[i]; };
    let lo = [1e30, 1e30, 1e30], hi = [-1e30, -1e30, -1e30];
    for (let i = 0; i < n; i++) for (let q = 0; q < 3; q++) { lo[q] = Math.min(lo[q], H[i * 3 + q], T[i * 3 + q]); hi[q] = Math.max(hi[q], H[i * 3 + q], T[i * 3 + q]); }
    sk.size = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1e-3);              // (body.js's sk_size: the soft limit is under it)
    sk.lo = lo; sk.hi = hi;
    return sk;
  }
  // the distance of a point from a bone's segment, and where along it (0 .. 1)
  function seg_dist(sk, i, p) {
    const h = sk.head(i), t = sk.tail(i), ab = sub(t, h), l2 = dot(ab, ab);
    const u = l2 > 1e-18 ? clamp(dot(sub(p, h), ab) / l2, 0, 1) : 0;
    return { d: len(sub(p, madd(h, ab, u))), u: u };
  }
  // the bone on the other side of the model (its name's _l / _r twin, else the bone whose head and tail are the mirror image), itself for a bone on the middle plane, -1 for none
  function twin_of(sk, i) {
    const tol = 1e-4 * sk.size, h = sk.head(i), t = sk.tail(i);
    if (Math.abs(h[0]) < tol && Math.abs(t[0]) < tol) return i;
    const nm = sk.names[i], m = /^(.*?)([_.]?)(l|r|L|R|left|right|Left|Right)$/.exec(nm);
    if (m) {
      const map = { l: "r", r: "l", L: "R", R: "L", left: "right", right: "left", Left: "Right", Right: "Left" }, other = m[1] + m[2] + map[m[3]];
      if (sk.index[other] !== undefined) return sk.index[other];
    }
    const tol2 = 0.01 * sk.size, hm = neg_x(h), tm = neg_x(t);
    let best = -1, bd = tol2;
    for (let j = 0; j < sk.n; j++) { if (j === i) continue; const d = Math.max(len(sub(sk.head(j), hm)), len(sub(sk.tail(j), tm))); if (d < bd) { bd = d; best = j; } }
    return best;
  }

  // ---- the creature's anatomy: the roles, the legs and the rig's chains (twins written out) -> the regions a kind is placed on --------------------------------------------------------------------------------------
  function anatomy(def, sk) {
    const S = def.system && typeof def.system === "object" ? def.system : {};
    const roles = def.roles && typeof def.roles === "object" ? def.roles : (S.roles && typeof S.roles === "object" ? S.roles : {});
    const legs_in = def.legs && typeof def.legs === "object" ? def.legs : (S.legs && typeof S.legs === "object" ? S.legs : null);
    const rig = def.rig && typeof def.rig === "object" ? def.rig : (S.rig && typeof S.rig === "object" ? S.rig : null);
    const bone = function (v) { return typeof v === "string" && sk.index[v] !== undefined ? sk.index[v] : -1; };
    const role_bone = function (v) { return typeof v === "string" ? bone(v) : (v && typeof v === "object" && !Array.isArray(v) ? bone(v.bone) : -1); };
    const list = function (v) { return (Array.isArray(v) ? v : (v === undefined || v === null ? [] : [v])).map(role_bone).filter(function (i) { return i >= 0; }); };
    const chains = [];
    if (rig && Array.isArray(rig.chains)) rig.chains.forEach(function (c) {
      if (!c || typeof c !== "object" || !Array.isArray(c.bones)) return;
      chains.push({ name: c.name, bones: c.bones.slice(), tip: c.tip });
      if (c.mirror) chains.push({ name: mirror_ref(c.name), bones: c.bones.map(mirror_ref), tip: c.tip ? mirror_ref(c.tip) : c.tip });
    });
    const chain_by = {}; chains.forEach(function (c) { chain_by[c.name] = c; });
    let hips = role_bone(roles.hips);
    if (hips < 0 && legs_in && typeof legs_in.body === "string") hips = bone(legs_in.body);
    ["hips", "pelvis", "root"].forEach(function (nm) { if (hips < 0) hips = bone(nm); });
    if (hips < 0) for (let i = 0; i < sk.n && hips < 0; i++) if (sk.parent[i] < 0) hips = i;
    const spine = list(roles.spine), neck = list(roles.neck);
    let head = role_bone(roles.head); if (head < 0) head = bone("head");
    let jaw = role_bone(roles.jaw); if (jaw < 0) jaw = bone("jaw");
    let chest = role_bone(roles.chest);
    if (!neck.length) for (let i = 0; i < sk.n; i++) if (/^neck/i.test(sk.names[i]) && (head < 0 || is_above(sk, i, head))) neck.push(i);
    // the trunk: the bones from the hips up to the bone the neck (the head) hangs from
    const top = neck.length ? sk.parent[neck[0]] : (head >= 0 ? sk.parent[head] : (chest >= 0 ? chest : (spine.length ? spine[spine.length - 1] : hips)));
    let trunk = [hips];
    if (top >= 0) {
      const up = []; let p = top;
      while (p >= 0 && p !== hips) { up.push(p); p = sk.parent[p]; }
      if (p === hips) trunk = [hips].concat(up.reverse());
      else trunk = [hips].concat(spine.filter(function (i) { return i !== hips; }));
    }
    if (chest < 0) chest = trunk[trunk.length - 1];
    const A = sk.head(hips);
    let B = neck.length ? sk.head(neck[0]) : (head >= 0 ? sk.head(head) : sk.tail(trunk[trunk.length - 1]));
    if (len(sub(B, A)) < 1e-6) B = sk.tail(hips);
    const tl = len(sub(B, A)), tv = unit(sub(B, A), [0, 1, 0]);
    const posture = tv[1] > 0.7 ? "upright" : "level";
    // the legs: the chains of `legs`, a HIND leg's root is nearer the hips than the neck along the trunk
    const legs = [], leg_names = [];
    if (legs_in && Array.isArray(legs_in.legs)) legs_in.legs.forEach(function (e) {
      if (typeof e === "string") leg_names.push(e);
      else if (e && typeof e === "object" && typeof e.chain === "string") { leg_names.push(e.chain); if (e.mirror) leg_names.push(mirror_ref(e.chain)); }
    });
    else chains.forEach(function (c) {                                   // (no `legs`: a tool took them away, a rig lab: the chains that reach the ground from the trunk are the legs, so the tissue goes where it would)
      const root = bone(c.bones[0]), last = bone(c.bones[c.bones.length - 1]), tip = bone(c.tip);
      if (root < 0 || last < 0 || an_trunk_has(c.bones)) return;
      const end = tip >= 0 ? sk.head(tip) : sk.tail(last);
      if (end[1] < 0.35 * A[1] && sk.head(root)[1] > 0.4 * A[1]) leg_names.push(c.name);
    });
    leg_names.forEach(function (nm) {
      const c = chain_by[nm]; if (!c || !c.bones.length) return;
      const root = bone(c.bones[0]); if (root < 0) return;
      legs.push({ chain: nm, root: root, hind: dot(sub(sk.head(root), A), tv) < 0.5 * tl });
    });
    function an_trunk_has(names) { return names.some(function (nm) { const i = bone(nm); return i >= 0 && trunk.indexOf(i) >= 0; }); }
    const arms = [], arm_names = [];
    if (Array.isArray(roles.arms)) roles.arms.forEach(function (e) {
      if (!e || typeof e !== "object" || typeof e.chain !== "string") return;
      arm_names.push(e.chain); if (e.mirror) arm_names.push(mirror_ref(e.chain));
    });
    else chains.forEach(function (c) { if (/arm/i.test(String(c.name)) && c.bones.length >= 2 && leg_names.indexOf(c.name) < 0) arm_names.push(c.name); });     // (no roles: the chains called arms)
    arm_names.forEach(function (nm) {
      const c = chain_by[nm]; if (!c || !c.bones.length) return;
      const up = bone(c.bones[Math.max(0, c.bones.length - 2)]); if (up >= 0) arms.push({ chain: nm, upper: up });
    });
    return { hips: hips, trunk: trunk, spine: spine, chest: chest, neck: neck, head: head, jaw: jaw, legs: legs, hind: legs.filter(function (l) { return l.hind; }), arms: arms, chains: chains,
      A: A, B: B, t: tv, L: tl, posture: posture, roles: roles };
  }
  function is_above(sk, a, b) { for (let p = sk.parent[b]; p >= 0; p = sk.parent[p]) if (p === a) return true; return false; }
  // the frame of a region: y along its line, x the model's left made square to it, z = x cross y (VENTRAL: forward for an upright line, down for a level one)
  function region_frame(t) {
    let x = sub([1, 0, 0], mul(t, t[0]));
    if (len(x) < 0.2) x = sub([0, 0, 1], mul(t, t[2]));
    x = unit(x);
    return { x: x, y: t, z: cross(x, t) };
  }

  // ---- the body's surface: a mesh (rays against its triangles) or an sdf (the mesher's own field) ---------------------------------------------------------------------------------------------------------------------
  // body.cast(o, d, allowed) -> { fwd, back }: the distances along +d and -d from o to the first place where the ray LEAVES the body (null: none) through the skin of the bones `allowed` (a mesh: a triangle
  // whose vertices' weights are mostly on them; null: any)
  // The skin's way OUT is the winding's (counter clockwise from outside: the signed volume says which way a mesh is wound), not the file's normals: a glb's normals can point in over a whole region (the jaguar's belly)
  function mesh_body(mesh, sk) {
    const P = mesh.positions, I = mesh.indices, nv = (P.length / 3) | 0, nt = (I.length / 3) | 0;
    const SI = mesh.skin_indices || null, SW = mesh.skin_weights || null, KC = SI ? (mesh.skin_count || Math.round(SI.length / nv)) : 0;
    const proj = new Float64Array(nv * 3), share_buf = new Float32Array(nv);
    let share_key = null;
    let vol = 0;
    for (let t = 0; t < nt; t++) {
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      vol += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
    }
    const wsign = vol < 0 ? -1 : 1;
    let N = null;
    const outward = function () { if (!N) N = outward_normals(P, I, nv, nt, wsign); return N; };          // (made when the carve asks: a placement does not need them)
    function shares(allowed) {                                         // the share of each vertex's weight that is on the allowed bones (no skin: every vertex is the first root's)
      if (share_key === allowed) return share_buf;
      share_key = allowed;
      for (let v = 0; v < nv; v++) {
        let s = 0;
        if (SI) for (let k = 0; k < KC; k++) { const w = SW[v * KC + k]; if (w > 0 && allowed[SI[v * KC + k]]) s += w; }
        else s = allowed[0] ? 1 : 0;
        share_buf[v] = s;
      }
      return share_buf;
    }
    function cast(o, d, allowed) {
      const e1 = unit(Math.abs(d[0]) < 0.9 ? cross(d, [1, 0, 0]) : cross(d, [0, 1, 0])), e2 = cross(d, e1);
      for (let v = 0; v < nv; v++) {
        const x = P[v * 3] - o[0], y = P[v * 3 + 1] - o[1], z = P[v * 3 + 2] - o[2];
        proj[v * 3] = x * e1[0] + y * e1[1] + z * e1[2]; proj[v * 3 + 1] = x * e2[0] + y * e2[1] + z * e2[2]; proj[v * 3 + 2] = x * d[0] + y * d[1] + z * d[2];
      }
      const sh = allowed ? shares(allowed) : null;
      let fwd = Infinity, back = Infinity;
      for (let t = 0; t < nt; t++) {
        const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
        const ua = proj[a * 3], ub = proj[b * 3], uc = proj[c * 3];
        if ((ua > 0 && ub > 0 && uc > 0) || (ua < 0 && ub < 0 && uc < 0)) continue;
        const va = proj[a * 3 + 1], vb = proj[b * 3 + 1], vc = proj[c * 3 + 1];
        if ((va > 0 && vb > 0 && vc > 0) || (va < 0 && vb < 0 && vc < 0)) continue;
        const area = (ub - ua) * (vc - va) - (uc - ua) * (vb - va);
        if (area === 0) continue;
        const la = (ub * vc - uc * vb) / area, lb = (uc * va - ua * vc) / area, lc = (ua * vb - ub * va) / area;
        if (la < 0 || lb < 0 || lc < 0) continue;
        if (sh && (sh[a] + sh[b] + sh[c]) < 0.9) continue;              // (the skin of other bones: an arm in front of a flank, an eye in a head; a glb's trunk is often shared with the shoulder blades)
        const s = la * proj[a * 3 + 2] + lb * proj[b * 3 + 2] + lc * proj[c * 3 + 2];
        const ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2], fx = P[c * 3] - P[a * 3], fy = P[c * 3 + 1] - P[a * 3 + 1], fz = P[c * 3 + 2] - P[a * 3 + 2];
        const nx = (ey * fz - ez * fy) * wsign, ny = (ez * fx - ex * fz) * wsign, nz = (ex * fy - ey * fx) * wsign;          // (the face's way out)
        const nd = nx * d[0] + ny * d[1] + nz * d[2];
        if (s > 1e-9 && nd > 0 && s < fwd) fwd = s;
        else if (s < -1e-9 && nd < 0 && -s < back) back = -s;
      }
      const r = { fwd: fwd < Infinity ? fwd : null, back: back < Infinity ? back : null };
      if (allowed && (r.fwd === null || r.back === null)) {              // (none of the skin of those bones that way: the first skin of any bone)
        const any = cast(o, d, null);
        if (r.fwd === null) r.fwd = any.fwd;
        if (r.back === null) r.back = any.back;
      }
      return r;
    }
    return { kind: "mesh", cast: cast, vertices: nv, triangles: nt, outward: outward, wound: wsign };
  }
  // the vertices' normals from the winding (the area weighted sum of the faces round each, out of the body): what the carve's facing gate reads. The copies of a vertex at one place (a glb is split at every uv seam)
  // share theirs, so that the carve, a function of the place, the normal and the weights, gives them the same skin (a seam that tears when the bone moves is what it would make otherwise)
  function outward_normals(P, I, nv, nt, wsign) {
    const rep = weld(P, nv);
    const N = new Float32Array(nv * 3);
    for (let t = 0; t < nt; t++) {
      const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
      const ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2], fx = P[c * 3] - P[a * 3], fy = P[c * 3 + 1] - P[a * 3 + 1], fz = P[c * 3 + 2] - P[a * 3 + 2];
      const nx = (ey * fz - ez * fy) * wsign, ny = (ez * fx - ex * fz) * wsign, nz = (ex * fy - ey * fx) * wsign, ra = rep[a] * 3, rb = rep[b] * 3, rc = rep[c] * 3;
      N[ra] += nx; N[ra + 1] += ny; N[ra + 2] += nz; N[rb] += nx; N[rb + 1] += ny; N[rb + 2] += nz; N[rc] += nx; N[rc + 1] += ny; N[rc + 2] += nz;
    }
    for (let v = 0; v < nv; v++) {
      const r = rep[v] * 3, l = Math.sqrt(N[r] * N[r] + N[r + 1] * N[r + 1] + N[r + 2] * N[r + 2]);
      if (rep[v] === v) { if (l > 0) { N[r] /= l; N[r + 1] /= l; N[r + 2] /= l; } }
    }
    for (let v = 0; v < nv; v++) if (rep[v] !== v) { const r = rep[v] * 3; N[v * 3] = N[r]; N[v * 3 + 1] = N[r + 1]; N[v * 3 + 2] = N[r + 2]; }
    return N;
  }
  // the first vertex at the same place (to a micron) as each vertex: an open addressed table of the places, no strings
  function weld(P, nv) {
    const rep = new Int32Array(nv);
    let cap = 1; while (cap < nv * 2) cap <<= 1;
    const tab = new Int32Array(cap).fill(-1), mask = cap - 1, q = new Float64Array(3);
    for (let v = 0; v < nv; v++) {
      q[0] = Math.round(P[v * 3] * 1e6); q[1] = Math.round(P[v * 3 + 1] * 1e6); q[2] = Math.round(P[v * 3 + 2] * 1e6);
      let h = ((q[0] * 73856093) ^ (q[1] * 19349663) ^ (q[2] * 83492791)) & mask;
      for (;;) {
        const s = tab[h];
        if (s < 0) { tab[h] = v; rep[v] = v; break; }
        if (Math.round(P[s * 3] * 1e6) === q[0] && Math.round(P[s * 3 + 1] * 1e6) === q[1] && Math.round(P[s * 3 + 2] * 1e6) === q[2]) { rep[v] = s; break; }
        h = (h + 1) & mask;
      }
    }
    return rep;
  }
  // the sdf's body: the main island of the def (the islands are closed surfaces of their own: eyes, lids, a jaw, a collar) as the mesher's own field. bones: the creature's bones as the page gives them to the mesher
  function sdf_body(sdf, bones, mesher) {
    const comp = mesher.compile(Object.assign({}, sdf, { bones: bones }));
    const field = mesher.make_field(comp), Pr = comp.prim, list = [];
    for (let i = 0; i < comp.n; i++) if (Pr[i * STRIDE + 18] === 0) list.push(i);
    const Lst = Int32Array.from(list), nl = Lst.length;
    const st = comp.settings || {}, ad = sdf.adaptive && typeof sdf.adaptive === "object" ? sdf.adaptive : null;
    const cell = ad && ad.min_cell > 0 ? ad.min_cell : (st.cell > 0 ? st.cell : (sdf.cell > 0 ? sdf.cell : 0.01));
    const lip = Math.max(1, comp.lip || 1), BIGD = 4 * Math.max(1e-3, (comp.gmax && comp.gmin) ? Math.max(comp.gmax[0] - comp.gmin[0], comp.gmax[1] - comp.gmin[1], comp.gmax[2] - comp.gmin[2]) : 2);
    function f(p) { return field.eval(p[0], p[1], p[2], Lst, 0, nl, false); }
    // the first place along the ray from o where the field goes from inside (< 0) to outside: from a start inside, or after the ray has come in from outside; null: none within the body's reach
    function exit(o, d) {
      const step_min = 0.25 * cell;
      let t = 0, v = f(o), inside = v < 0, guard = 0;
      while (t < BIGD && guard++ < 4000) {
        const st_ = Math.max(Math.abs(v) / lip, step_min), t1 = t + st_, v1 = f(madd(o, d, t1));
        if (!inside && v1 < 0) inside = true;
        else if (inside && v1 > 0) {
          let a = t, b = t1;
          for (let k = 0; k < 40; k++) { const m = 0.5 * (a + b); if (f(madd(o, d, m)) > 0) b = m; else a = m; }
          return 0.5 * (a + b);
        }
        t = t1; v = v1;
      }
      return null;
    }
    function cast(o, d) {
      const a = exit(o, d), b = exit(o, mul(d, -1));
      return { fwd: a, back: b };
    }
    function color_at(p) {                                            // the part that owns the skin there (the last union part closer than the running union: the mesher's own rule): its colour and its id
      field.eval(p[0], p[1], p[2], Lst, 0, nl, true);
      const h = field.hit();
      const part = h >= 0 && comp.parts[h] ? comp.parts[h] : null;
      return part ? { color: part.color.slice(), source: part.source } : null;
    }
    return { kind: "sdf", cast: cast, color_at: color_at, comp: comp, field: field, list: Lst, f: f, cell: cell, lip: lip };
  }

  // ---- placement: where a kind goes on THIS creature -------------------------------------------------------------------------------------------------------------------------------------------------------------------
  function kind_of(name) { const KM = kinds_mod(); return typeof name === "string" && Object.prototype.hasOwnProperty.call(KM.KINDS, name) ? KM.KINDS[name] : null; }
  function u_of(kind, posture) { return typeof kind.u === "number" ? kind.u : (kind.u && typeof kind.u[posture] === "number" ? kind.u[posture] : 0.5); }
  // the bones a kind may take weight from (a Uint8Array over the bones) and their names
  function takes_of(kind, an, sk, host, extra) {
    const out = new Uint8Array(sk.n + 64), names = [];
    const put = function (i) { if (i >= 0 && i < sk.n && !out[i]) { out[i] = 1; names.push(sk.names[i]); } };
    (kind.takes || ["host"]).forEach(function (g) {
      if (g === "trunk") an.trunk.forEach(put);
      else if (g === "neck") an.neck.forEach(put);
      else if (g === "head") put(an.head);
      else if (g === "jaw") put(an.jaw);
      else if (g === "chest") put(an.chest);
      else if (g === "hind_legs") an.hind.forEach(function (l) { put(l.root); });
      else if (g === "fore_legs") an.legs.forEach(function (l) { if (!l.hind) put(l.root); });
      else if (g === "host") put(host);
      else if (g === "host_parent") put(host >= 0 ? sk.parent[host] : -1);
    });
    put(host);
    (extra || []).forEach(put);
    return { mask: out, names: names };
  }
  // the region of a kind on this creature: the starts (one for a single kind, one a side for a pair) -> [{ side, host, P (on the region's line), axis (unit), L (the region's length), frame }]
  function region_starts(kind, an, sk, want_side) {
    const out = [], u = u_of(kind, an.posture);
    const sides = kind.pair ? (want_side ? [want_side] : [1, -1]) : [0];
    if (kind.region === "trunk") {
      if (an.hips < 0) return { list: out, why: "no hips bone (roles.hips)" };
      const P0 = madd(an.A, an.t, u * an.L);
      let host = an.trunk[0], bd = Infinity;
      an.trunk.forEach(function (i) { const d = seg_dist(sk, i, P0).d; if (d < bd - 1e-12) { bd = d; host = i; } });
      sides.forEach(function (s) { out.push({ side: s, host: host, P: P0, axis: an.t, L: an.L, offset: kind.offset || 0 }); });
    } else if (kind.region === "neck") {
      if (!an.neck.length) return { list: out, why: "no neck (roles.neck)" };
      const a = sk.head(an.neck[0]), b = an.head >= 0 ? sk.head(an.head) : sk.tail(an.neck[an.neck.length - 1]), L = len(sub(b, a));
      if (!(L > 1e-6)) return { list: out, why: "the neck has no length" };
      const P0 = lerp(a, b, u), ax = unit(sub(b, a));
      let host = an.neck[0], bd = Infinity;
      an.neck.forEach(function (i) { const d = seg_dist(sk, i, P0).d; if (d < bd - 1e-12) { bd = d; host = i; } });
      sides.forEach(function (s) { out.push({ side: s, host: host, P: P0, axis: ax, L: L, offset: kind.offset || 0 }); });
    } else if (kind.region === "head") {
      if (an.head < 0) return { list: out, why: "no head (roles.head)" };
      const hb = an.head, ph = lerp(sk.head(hb), sk.tail(hb), u), P0 = an.jaw >= 0 ? lerp(ph, lerp(sk.head(an.jaw), sk.tail(an.jaw), u), 0.5) : ph;      // (between the head's line and the jaw's: the mouth's level)
      const L = Math.max(sk.length(hb), an.jaw >= 0 ? sk.length(an.jaw) : 0);
      sides.forEach(function (s) { out.push({ side: s, host: hb, P: P0, axis: unit(sub(sk.tail(hb), sk.head(hb))), L: L, offset: 0 }); });
    } else if (kind.region === "leg" || kind.region === "arm") {
      const hosts = kind.region === "leg" ? an.hind.map(function (l) { return l.root; }) : an.arms.map(function (a) { return a.upper; });
      if (!hosts.length) return { list: out, why: kind.region === "leg" ? "no hind legs (legs: chains whose root hangs at the hips)" : "no arms (roles.arms)" };
      hosts.forEach(function (h) {
        const hd = sk.head(h), tl = sk.tail(h), s = hd[0] + tl[0] > 1e-9 ? 1 : (hd[0] + tl[0] < -1e-9 ? -1 : 1);
        if (want_side && s !== want_side) return;
        out.push({ side: s, host: h, P: lerp(hd, tl, u), axis: unit(sub(tl, hd)), L: sk.length(h), offset: 0 });
      });
    }
    return { list: out, why: out.length ? null : "nothing of the region on that side" };
  }
  // the direction from the start to the skin: the kind's, in the region's frame or the model's (a limb's: made square to the bone, the tissue is beside it; a head's as it is), x mirrored for a right twin
  function kind_dir(kind, axis, side) {
    const v = kind.dir.v, s = side < 0 ? -1 : 1;
    if (kind.dir.frame === "region") { const F = region_frame(axis); return unit(add(add(mul(F.x, v[0] * s), mul(F.y, v[1])), mul(F.z, v[2])), F.z); }
    const w = [v[0] * s, v[1], v[2]];
    if (kind.region !== "leg" && kind.region !== "arm") return unit(w);
    const sq = sub(w, mul(axis, dot(w, axis)));
    return unit(len(sq) > 1e-6 ? sq : region_frame(axis).z);
  }
  // one placement: from a start P on the region's line, along d, to the skin -> the tissue's ellipsoid and its bone
  function place_one(ctx, kind, st, d, take, o) {
    const sk = ctx.sk, body = ctx.body, axis0 = st.axis;
    let t_ax = sub(axis0, mul(d, dot(axis0, d)));
    t_ax = len(t_ax) > 1e-6 ? unit(t_ax) : unit(cross(d, Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
    const w_ax = unit(cross(d, t_ax));
    let P = st.P, fallback = null, nearD = null, farD = null, wid = null;
    // a pair's start is to the side of the line by a share of the half width there
    if (st.offset > 0 && st.side !== 0) {
      const F = region_frame(axis0), sx = mul(F.x, st.side);
      let W = null;
      if (body) { const c = body.cast(P, sx, take.mask); if (c.fwd !== null && c.back !== null) W = 0.5 * (c.fwd + c.back); else if (c.fwd !== null) W = c.fwd; }
      if (W === null) W = REACH[kind.region] * st.L;
      W = Math.min(W, 0.6 * st.L);
      P = madd(P, sx, st.offset * W);
    }
    if (o && o.at) {                                                     // (the user's point: the start is under it on the region's line, the direction toward it)
      P = o.start;
    }
    if (body) {
      const c = body.cast(P, d, take.mask);
      nearD = c.fwd; farD = c.back;
      const cw = body.cast(P, w_ax, take.mask);
      if (cw.fwd !== null && cw.back !== null) wid = 0.5 * (cw.fwd + cw.back); else if (cw.fwd !== null) wid = cw.fwd; else if (cw.back !== null) wid = cw.back;
      if (nearD === null) fallback = "the ray from the bone's axis did not meet the skin";
    } else fallback = "no body (no mesh, no sdf)";
    const R0 = REACH[kind.region] * st.L;
    if (nearD === null) nearD = o && o.at ? Math.max(len(sub(o.at, P)), 1e-3) : R0;
    if (farD === null) farD = nearD;
    if (wid === null) wid = 0.5 * (nearD + farD);
    wid = Math.min(wid, Math.max(0.6 * (nearD + farD), 0.35 * st.L));                  // (a ray across that runs down a limb (a person's T-pose arm from the chest) is not the body's width)
    const S = madd(P, d, nearD), T = Math.max(nearD + farD, 1e-4);
    const sz = kind.size;
    let r_t = sz.along * st.L, r_w = sz.across * wid, r_d = Math.min(sz.through * T, 1.2 * Math.max(r_t, r_w));          // (no deeper than it is wide: a ray through a whole head is not the jowl's depth)
    if (o && o.radius !== undefined) {
      if (typeof o.radius === "number") { r_t = o.radius; r_w = o.radius; r_d = Math.min(o.radius, 0.8 * T); }
      else { r_d = o.radius[0]; r_t = o.radius[1]; r_w = o.radius[2]; }
    }
    const c = madd(S, d, -sz.under * T), tail_len = Math.max(sz.tail * T, 0.002 * sk.size);
    return { side: st.side, host: st.host, start: P, surface: S, center: c, tail: madd(c, d, tail_len), d: d, t: t_ax, w: w_ax, r: [r_d, r_t, r_w], thickness: T, width: wid, length: st.L, fallback: fallback };
  }
  // the mirror image of a placement (x -> -x) on the twin host
  function mirror_place(p, host) {
    const d = neg_x(p.d), t = neg_x(p.t);
    return { side: -p.side, host: host, start: neg_x(p.start), surface: neg_x(p.surface), center: neg_x(p.center), tail: neg_x(p.tail), d: d, t: t, w: unit(cross(d, t)), r: p.r.slice(), thickness: p.thickness, width: p.width, length: p.length, fallback: p.fallback, mirrored: true };
  }

  // the placements of one request (a kind and what the user said over it) on this creature: [{ ... the placement, kind, req }], or throws an error that says why
  function places_of(ctx, req, idx) {
    const sk = ctx.sk, an = ctx.an, kind = kind_of(req.kind), tag = "tissue[" + idx + "] (" + req.kind + "): ";
    const errs = [];
    let host_given = -1;
    if (req.parent !== undefined) host_given = sk.index[req.parent];
    const want_side = req.side === "l" ? 1 : (req.side === "r" ? -1 : 0);
    const pair = kind.pair && req.mirror !== false && !want_side, results = [];
    if (req.at !== undefined) {
      // the user's point: the host is the parent given or the region's bone nearest it, the start is the point's foot on that bone's segment (a trunk kind: on the trunk's line), the direction toward the point
      let host = host_given;
      const cand = kind.region === "trunk" ? an.trunk : (kind.region === "neck" ? an.neck : (kind.region === "head" ? [an.head] : (kind.region === "leg" ? an.hind.map(function (l) { return l.root; }) : an.arms.map(function (a) { return a.upper; }))));
      if (host < 0) {
        let bd = Infinity;
        (cand.filter(function (i) { return i >= 0; }).length ? cand : Array.from({ length: sk.n }, function (x, i) { return i; })).forEach(function (i) { if (i < 0) return; const dd = seg_dist(sk, i, req.at).d; if (dd < bd - 1e-12) { bd = dd; host = i; } });
      }
      if (host < 0) { errs.push(tag + "no bone to hang it from: give `parent`"); throw fail_list(errs); }
      const sd = seg_dist(sk, host, req.at), hb = sk.head(host), tb = sk.tail(host), foot = lerp(hb, tb, sd.u), axis = unit(sub(tb, hb));
      const start = kind.region === "trunk" && an.trunk.indexOf(host) >= 0 && host_given < 0 ? madd(an.A, an.t, clamp(dot(sub(req.at, an.A), an.t), -0.25 * an.L, 1.25 * an.L)) : foot;
      let d = req.dir !== undefined ? unit(req.dir) : unit(sub(req.at, start), kind_dir(kind, axis, req.at[0] >= 0 ? 1 : -1));
      const side = Math.abs(req.at[0]) < 1e-4 * sk.size ? 0 : (req.at[0] > 0 ? 1 : -1);
      const st = { side: kind.pair ? (side || 1) : 0, host: host, P: start, axis: kind.region === "trunk" && host_given < 0 ? an.t : axis, L: kind.region === "trunk" ? an.L : sk.length(host), offset: 0 };
      const take = takes_of(kind, an, sk, host, []);
      const p = place_one(ctx, kind, st, d, take, { at: req.at, start: start, radius: req.radius });
      results.push({ p: p, take: take });
      if (pair && side !== 0) {
        const tw = twin_of(sk, host);
        if (tw < 0) ctx.warnings.push(tag + "no twin of '" + sk.names[host] + "' on the other side: one tissue bone, not two");
        else results.push({ p: mirror_place(p, tw), take: takes_of(kind, an, sk, tw, []) });
      }
      return results;
    }
    const R = region_starts(kind, an, sk, want_side);
    if (!R.list.length && host_given < 0) { errs.push(tag + "the creature has " + R.why + ": give `parent` (the bone it hangs from) or `at`"); throw fail_list(errs); }
    let starts = R.list;
    if (host_given >= 0) {                                               // (the user's host: the kind's start where it is on the region, else along that bone)
      const inreg = starts.filter(function (s) { return s.host === host_given; });
      if (inreg.length) starts = inreg;
      else {
        const hb = sk.head(host_given), tb = sk.tail(host_given), s = kind.pair ? (hb[0] + tb[0] >= 0 ? 1 : -1) : 0;
        starts = [{ side: want_side || s, host: host_given, P: lerp(hb, tb, u_of(kind, an.posture)), axis: unit(sub(tb, hb)), L: sk.length(host_given), offset: kind.offset || 0 }];
        const tw = pair ? twin_of(sk, host_given) : -1;                  // (a pair on a bone of one side: its twin on the other side's twin bone)
        if (tw >= 0 && tw !== host_given) { const h2 = sk.head(tw), t2 = sk.tail(tw); starts.push({ side: -s, host: tw, P: lerp(h2, t2, u_of(kind, an.posture)), axis: unit(sub(t2, h2)), L: sk.length(tw), offset: kind.offset || 0 }); }
      }
    }
    if (!pair && kind.pair && starts.length > 1) {                       // (one of a pair: the side said, else the left)
      const s0 = want_side || 1, pick = starts.filter(function (s) { return s.side === s0; });
      starts = pick.length ? [pick[0]] : [starts[0]];
    }
    starts = starts.map(function (s, k) { return { s: s, k: k }; }).sort(function (a, b) { return (b.s.side - a.s.side) || (a.k - b.k); }).map(function (x) { return x.s; });     // (the left ones first: a right twin is the mirror of its left)
    // a pair whose left start has a twin host (or one on the middle) is placed on the left and MIRRORED: the twins are mirror images
    const done = [];
    starts.forEach(function (st) {
      if (st.side < 0 && pair) {                                         // (two on one bone (the trunk, the head) or on twin bones: the right one is the mirror of the left)
        const left = done.filter(function (q) { return q.st.side > 0 && (q.st.host === st.host || twin_of(sk, q.st.host) === st.host); })[0];
        if (left) { results.push({ p: mirror_place(left.p, st.host), take: takes_of(kind, an, sk, st.host, []) }); return; }
      }
      const d = req.dir !== undefined ? unit(st.side < 0 ? neg_x(req.dir) : req.dir) : kind_dir(kind, st.axis, st.side);
      const take = takes_of(kind, an, sk, st.host, []);
      const p = place_one(ctx, kind, st, d, take, { radius: req.radius });
      done.push({ st: st, p: p });
      results.push({ p: p, take: take });
    });
    return results;
  }

  // ---- the request: checked, every complaint named -------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // a MARK (a patch of the skin carved to a bone the creature has): its mistakes, all of them
  function check_mark(r, tag, sk, errs, list) {
    let ok = true;
    const bad = function (m) { errs.push(tag + " (mark): " + m); ok = false; };
    Object.keys(r).forEach(function (k) { if (MARK_KEYS.indexOf(k) < 0) bad("unknown key '" + k + "' (" + MARK_KEYS.join(", ") + ")"); });
    if (typeof r.mark !== "string" || sk.index[r.mark] === undefined) bad("mark " + JSON.stringify(r.mark) + " is not a bone of the creature (the bone whose skin the patch becomes)");
    if (!is_vec3(r.at)) bad("at is [x, y, z] (model space, the bind pose: a point of the skin)");
    if (!is_vec3(r.dir) || !(len(r.dir) > 1e-9)) bad("dir is [x, y, z], not all 0 (the way out of the skin there)");
    if (!(typeof r.radius === "number" && isFinite(r.radius) && r.radius > 0 && r.radius <= 10 * sk.size)) bad("radius is metres, over 0 and at most 10 times the skeleton's size (the patch)");
    if (r.strength !== undefined && !(typeof r.strength === "number" && isFinite(r.strength) && r.strength > 0 && r.strength <= 1)) bad("strength is a number over 0 and at most 1 (the share of its skin the middle of the patch gives the bone)");
    if (r.core !== undefined && !(typeof r.core === "number" && isFinite(r.core) && r.core >= 0 && r.core <= 0.95)) bad("core is 0 .. 0.95 (the share of the radius that follows the bone whole)");
    if (r.color !== undefined && !(Array.isArray(r.color) && (r.color.length === 3 || r.color.length === 4) && r.color.every(function (x) { return typeof x === "number" && isFinite(x) && x >= 0 && x <= 1; }))) bad("color is [r, g, b] (0 .. 1)");
    if (r.tint !== undefined && !(typeof r.tint === "number" && isFinite(r.tint) && r.tint >= 0 && r.tint <= 1)) bad("tint is 0 .. 1 (how much of the colour is blended into the patch)");
    if (r.crisp !== undefined && !(typeof r.crisp === "number" && isFinite(r.crisp) && r.crisp >= 0 && r.crisp <= 0.95)) bad("crisp is 0 .. 0.95 (how sharp the edge of the painted colour is against the patch's falloff: 0 the widest blend, 0.95 nearly a step)");
    if (r.skin !== undefined && typeof r.skin !== "boolean") bad("skin is true (the vertex's own colour painted back over the patch) or false");
    if (r.skin === true && r.color !== undefined) bad("skin and color say two colours for one patch: give one");
    if (r.radii !== undefined && !(Array.isArray(r.radii) && r.radii.length === 2 && r.radii.every(function (x) { return typeof x === "number" && isFinite(x) && x > 0 && x <= 10 * sk.size; }))) bad("radii is [a, b] metres, each over 0 and at most 10 times the skeleton's size (half extents along `axis` and across it)");
    if (r.axis !== undefined && !(is_vec3(r.axis) && len(r.axis) > 1e-9)) bad("axis is [x, y, z], not all 0 (the direction of the patch's first half extent, along the skin)");
    if (r.takes !== undefined && !(Array.isArray(r.takes) && r.takes.length > 0 && r.takes.every(function (n) { return typeof n === "string" && sk.index[n] !== undefined; }))) bad("takes is a list of bones of the creature (the skin is taken from them)");
    if (ok) list.push(Object.assign({}, r));
  }
  function check_spec(spec, sk) {
    const KM = kinds_mod(), errs = [], list = [];
    if (spec === undefined || spec === null) return { list: list, errors: errs };
    if (!Array.isArray(spec)) { errs.push("tissue is a list of kinds or of { kind, parent, at, dir, radius, strength, mirror, side, name, soft, shape, bulge } (the kinds: " + KM.ORDER.join(", ") + ") or of marks { mark, at, dir, radius, strength, core, color, tint, takes }"); return { list: list, errors: errs }; }
    spec.forEach(function (e, i) {
      const r = typeof e === "string" ? { kind: e } : e, tag = "tissue[" + i + "]";
      if (!r || typeof r !== "object" || Array.isArray(r)) { errs.push(tag + " is a kind's name or { kind, ... }"); return; }
      if (r.mark !== undefined) { check_mark(r, tag, sk, errs, list); return; }
      let ok = true;
      Object.keys(r).forEach(function (k) { if (SPEC_KEYS.indexOf(k) < 0) { errs.push(tag + ": unknown key '" + k + "' (" + SPEC_KEYS.join(", ") + ")"); ok = false; } });
      const kt = tag + (typeof r.kind === "string" ? " (" + r.kind + ")" : "");
      if (typeof r.kind !== "string" || !kind_of(r.kind)) { errs.push(tag + ": kind " + JSON.stringify(r.kind) + " is not a kind (" + KM.ORDER.join(", ") + ")"); ok = false; }
      if (r.parent !== undefined && (typeof r.parent !== "string" || sk.index[r.parent] === undefined)) { errs.push(kt + ": parent " + JSON.stringify(r.parent) + " is not a bone of the creature"); ok = false; }
      if (r.at !== undefined && !is_vec3(r.at)) { errs.push(kt + ": at is [x, y, z] (model space, the bind pose: a point on the skin)"); ok = false; }
      if (r.dir !== undefined && (!is_vec3(r.dir) || !(len(r.dir) > 1e-9))) { errs.push(kt + ": dir is [x, y, z], not all 0 (from the bone's axis out to the skin)"); ok = false; }
      if (r.radius !== undefined && !((typeof r.radius === "number" && isFinite(r.radius) && r.radius > 0) || (is_vec3(r.radius) && r.radius.every(function (x) { return x > 0; })))) { errs.push(kt + ": radius is metres > 0, or [through, along, across] (each > 0)"); ok = false; }
      if (r.strength !== undefined && !(typeof r.strength === "number" && isFinite(r.strength) && r.strength > 0 && r.strength <= 1)) { errs.push(kt + ": strength is a number over 0 and at most 1 (the share of its skin the middle gives the tissue bone)"); ok = false; }
      if (r.mirror !== undefined && typeof r.mirror !== "boolean") { errs.push(kt + ": mirror is true or false"); ok = false; }
      if (r.side !== undefined && r.side !== "l" && r.side !== "r") { errs.push(kt + ": side is \"l\" or \"r\""); ok = false; }
      if (r.side !== undefined && r.mirror === true) { errs.push(kt + ": side (one of the pair) and mirror: true (both) say different things"); ok = false; }
      if (r.name !== undefined && (typeof r.name !== "string" || !NAME_RE.test(r.name))) { errs.push(kt + ": name " + JSON.stringify(r.name) + " is not a bone's name (letters, digits, _ . : -; not a digit first)"); ok = false; }
      if (r.shape !== undefined && r.shape !== "carve" && r.shape !== "grow") { errs.push(kt + ": shape is \"carve\" (the default: the skin is carved, the shape is the creature's) or \"grow\" (an sdf creature: a part grows the tissue)"); ok = false; }
      if (r.bulge !== undefined && !(typeof r.bulge === "number" && isFinite(r.bulge) && r.bulge >= -sk.size && r.bulge <= sk.size)) { errs.push(kt + ": bulge is metres (how far the grown part stands proud of the skin; under 0: sunk), at most the skeleton's size"); ok = false; }
      if (r.bulge !== undefined && r.shape === "carve") { errs.push(kt + ": bulge grows a part and shape \"carve\" grows none: give one"); ok = false; }
      if (r.soft !== undefined && r.soft !== true && r.soft !== false) {
        if (!r.soft || typeof r.soft !== "object" || Array.isArray(r.soft)) { errs.push(kt + ": soft is true, false or { " + SOFT_FIELDS.join(", ") + " }"); ok = false; }
        else {
          Object.keys(r.soft).forEach(function (k) { if (SOFT_FIELDS.indexOf(k) < 0) { errs.push(kt + ": soft: unknown field '" + k + "' (" + SOFT_FIELDS.join(", ") + ")"); ok = false; } });
          if (r.soft.hz !== undefined && r.soft.stiffness !== undefined) { errs.push(kt + ": soft: stiffness and hz are the same number: give one"); ok = false; }
          ["stiffness", "hz", "damping", "gain"].forEach(function (k) {
            const v = r.soft[k], rg = SOFT_RANGE[k];
            if (v !== undefined && !(typeof v === "number" && isFinite(v) && v >= rg[0] && v <= rg[1])) { errs.push(kt + ": soft." + k + " = " + v + " is out of range (" + rg[0] + " .. " + rg[1] + ")"); ok = false; }
          });
          if (r.soft.limit !== undefined && !(typeof r.soft.limit === "number" && isFinite(r.soft.limit) && r.soft.limit > 0 && r.soft.limit <= sk.size)) { errs.push(kt + ": soft.limit = " + r.soft.limit + " is out of range (over 0, at most the skeleton's size " + r3(sk.size) + ")"); ok = false; }
          if (r.soft.axis !== undefined && !(is_vec3(r.soft.axis) && r.soft.axis.every(function (x) { return x >= 0 && x <= 4; }))) { errs.push(kt + ": soft.axis is [x, y, z], each 0 .. 4"); ok = false; }
        }
      }
      if (ok) list.push(Object.assign({}, r));
    });
    const n_kinds = spec.filter(function (e) { return !(e && typeof e === "object" && !Array.isArray(e) && e.mark !== undefined); }).length;       // (the marks add no bone: only the bones the skeleton can hold limit them)
    if (n_kinds > MAX_ADDED) errs.push("tissue: " + n_kinds + " requests: at most " + MAX_ADDED);
    return { list: list, errors: errs };
  }

  // the bone's `soft`: the kind's spring at the creature's size, the request's over it
  function soft_of(kind, size, req) {
    const KM = kinds_mod(), s = kind.soft, k = Math.sqrt(KM.SIZE_REF / Math.max(size, 1e-3));
    const out = { stiffness: r3(clamp(s.hz * k, 0.2, 20)), damping: r3(clamp(s.damping, 0.01, 1)), gain: r3(clamp(s.gain, 0, 16)), limit: r6(Math.min(s.limit * size, size)), axis: s.axis.slice() };
    if (req && req.soft && typeof req.soft === "object") {
      const o = req.soft;
      if (o.stiffness !== undefined) out.stiffness = o.stiffness;
      if (o.hz !== undefined) out.stiffness = o.hz;
      if (o.damping !== undefined) out.damping = o.damping;
      if (o.gain !== undefined) out.gain = o.gain;
      if (o.limit !== undefined) out.limit = o.limit;
      if (o.axis !== undefined) out.axis = o.axis.slice();
    }
    return out;
  }

  // ---- the carve of a mesh's skin -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // regions: [{ c, d, t, w (unit), r: [through, along, across], peak, allowed (Uint8Array over the bones), index (the new bone) }]. -> { skin_indices, skin_weights, skin_count, touched, per: [{ vertices, weight, strong }] }
  // A vertex is moved in the order of the regions (a later region takes from what the earlier left; it never takes from a tissue bone it is not allowed to)
  function carve(mesh, regions, nbones, root, normals) {
    const P = mesh.positions, N = normals || null, nv = (P.length / 3) | 0, R0 = root > 0 ? root : 0;
    const SI = mesh.skin_indices || null, SW = mesh.skin_weights || null, K0 = SI ? (mesh.skin_count || Math.round(SI.length / nv)) : 0;
    const per = regions.map(function () { return { vertices: 0, weight: 0, strong: 0 }; });
    const lists = new Array(nv);                                         // (the vertices that change: their new lists of [bone, weight]; undefined: untouched)
    const C0 = mesh.colors && mesh.colors.length >= nv * 3 ? mesh.colors : null, CK = C0 ? Math.round(C0.length / nv) : 0;
    let colors = null, painted = false;                                 // (the colours: a copy of the mesher's, made when the first patch with a colour touches a vertex)
    let touched = 0, need = Math.max(K0, 1);
    for (let v = 0; v < nv; v++) {
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      let cur = null, changed = false;                                     // (a vertex that no tissue took weight from is written as it was, to the last bit)
      for (let r = 0; r < regions.length; r++) {
        const R = regions[r], qx = x - R.c[0], qy = y - R.c[1], qz = z - R.c[2];
        const a = (qx * R.d[0] + qy * R.d[1] + qz * R.d[2]) / R.r[0], b = (qx * R.t[0] + qy * R.t[1] + qz * R.t[2]) / R.r[1], c = (qx * R.w[0] + qy * R.w[1] + qz * R.w[2]) / R.r[2];
        const q2 = a * a + b * b + c * c;
        if (q2 >= 1) continue;
        const nd = N ? (N[v * 3] * R.d[0] + N[v * 3 + 1] * R.d[1] + N[v * 3 + 2] * R.d[2]) : 1;
        const g = facing(nd);
        if (!(g > 0)) continue;
        let f;
        if (R.core > 0) {                                                  // (a mark's patch: whole up to `core` of the radius, then a smoothstep down to nothing at the radius)
          const q = Math.sqrt(q2);
          if (q <= R.core) f = 1;
          else { const s = (q - R.core) / (1 - R.core); f = 1 - s * s * (3 - 2 * s); }
        } else f = (1 - q2) * (1 - q2);
        if (R.paint) {                                                     // (a patch with a colour is PAINTED where it is, in the order of the regions, whichever bone the weight ends on: a crisp smoothstep of the weight it would give)
          const wv = R.peak * f * g, lo = 0.1 + 0.4 * R.crisp, hi = 0.9 - 0.4 * R.crisp, u = wv < lo ? 0 : (wv > hi ? 1 : (wv - lo) / (hi - lo)), cw = u * u * (3 - 2 * u) * R.tint;
          if (cw > 0 && C0) {
            if (!colors) { colors = new Float32Array(C0); painted = true; }
            const o = v * CK;
            if (R.skin) { for (let j = 0; j < 3; j++) colors[o + j] = colors[o + j] * (1 - cw) + C0[o + j] * cw; }
            else { for (let j = 0; j < 3; j++) colors[o + j] = colors[o + j] * (1 - cw) + R.color[j] * cw; }
          }
        }
        if (!cur) {                                                       // (the vertex's own list, as it is)
          cur = [];
          if (SI) for (let k = 0; k < K0; k++) { const wk = SW[v * K0 + k]; if (wk > 0) cur.push([SI[v * K0 + k], wk]); }
          if (!cur.length) cur.push([R0, 1]);                              // (a mesh with no skin is rigid on the first root bone)
          let tot = 0; cur.forEach(function (e) { tot += e[1]; });
          if (Math.abs(tot - 1) > 1e-6 && tot > 0) cur = cur.map(function (e) { return [e[0], e[1] / tot]; });
        }
        let avail = 0;
        for (let k = 0; k < cur.length; k++) if (R.allowed[cur[k][0]]) avail += cur[k][1];
        if (!(avail > 0)) continue;
        const take = Math.min(R.peak * f * g, avail);
        if (!(take > 1e-4)) continue;
        const keep = 1 - take / avail;
        let next = [], give = take;
        for (let k = 0; k < cur.length; k++) { const e = cur[k], w2 = R.allowed[e[0]] ? e[1] * keep : e[1]; if (w2 > 1e-7) next.push([e[0], w2]); else if (R.allowed[e[0]]) give += w2; }
        if (next.length >= 4) {                                           // (four bones at most: the weakest of the bones that give goes into the new one, no other bone's weight is touched)
          let wi = -1;
          for (let k = 0; k < next.length; k++) if (R.allowed[next[k][0]] && (wi < 0 || next[k][1] < next[wi][1])) wi = k;
          if (wi < 0) continue;
          give += next[wi][1]; next.splice(wi, 1);
        }
        next.push([R.index, give]);
        cur = next; changed = true;
        per[r].vertices++; per[r].weight += give; if (give > 0.5) per[r].strong++;
      }
      if (changed) {
        cur.sort(function (p, q) { return q[1] - p[1] || p[0] - q[0]; });
        if (cur.length > 4) cur.length = 4;
        let tot = 0; cur.forEach(function (e) { tot += e[1]; });
        lists[v] = cur.map(function (e) { return [e[0], e[1] / tot]; });
        touched++;
        if (cur.length > need) need = cur.length;
      }
    }
    const KN = Math.min(4, Math.max(K0, need)), big = nbones > 256;
    const SIo = big || (SI && SI.BYTES_PER_ELEMENT > 1) ? new Uint16Array(nv * KN) : new Uint8Array(nv * KN), SWo = new Float32Array(nv * KN);
    for (let v = 0; v < nv; v++) {
      const l = lists[v];
      if (l) { for (let k = 0; k < l.length; k++) { SIo[v * KN + k] = l[k][0]; SWo[v * KN + k] = l[k][1]; } continue; }
      if (SI) for (let k = 0; k < K0; k++) { SIo[v * KN + k] = SI[v * K0 + k]; SWo[v * KN + k] = SW[v * K0 + k]; }        // (untouched: its weights to the last bit)
      else { SIo[v * KN] = R0; SWo[v * KN] = 1; }
    }
    return { skin_indices: SIo, skin_weights: SWo, skin_count: KN, touched: touched, per: per, colors: painted ? colors : null };
  }
  function facing(nd) { if (nd <= FACE_LO) return 0; if (nd >= FACE_HI) return 1; const s = (nd - FACE_LO) / (FACE_HI - FACE_LO); return s * s * (3 - 2 * s); }

  // ---- an sdf's tissue part: an ellipsoid on the new bone, as proud of the skin as the mesher's weight rule needs for its middle to give `strength` of its skin to it -----------------------------------------------------
  // (the mesher's rules, mesher.js: the union's smooth fold of a part (cubic: min - h^3 k / 6), the skin claim of every union primitive with a bone (1 - t)^2 with t = (d - dmin) / (range (blend falloff + min_blend)))
  function fold_cubic(d, dd, k) { const m = d < dd ? d : dd; if (k > 0) { let h = k - Math.abs(d - dd); if (h > 0) { h /= k; return m - h * h * h * k / 6; } } return m; }
  function ell_dist(c, r, p) { const x = (p[0] - c[0]) / r[0], y = (p[1] - c[1]) / r[1], z = (p[2] - c[2]) / r[2]; return (Math.sqrt(x * x + y * y + z * z) - 1) * Math.min(r[0], r[1], r[2]); }
  function ell_wdist(c, r, p) {
    const x = (p[0] - c[0]) / r[0], y = (p[1] - c[1]) / r[1], z = (p[2] - c[2]) / r[2], k0 = Math.sqrt(x * x + y * y + z * z);
    const x1 = x / r[0], y1 = y / r[1], z1 = z / r[2], k1 = Math.sqrt(x1 * x1 + y1 * y1 + z1 * z1);
    return k1 > 1e-12 ? k0 * (k0 - 1) / k1 : -Math.min(r[0], r[1], r[2]);
  }
  // the axis aligned radii of the oriented ellipsoid (the mesher's ellipsoid has its axes on the model's): the half extents of its box
  function aligned_radii(p) {
    const out = [0, 0, 0];
    for (let k = 0; k < 3; k++) out[k] = Math.sqrt(Math.pow(p.r[0] * p.d[k], 2) + Math.pow(p.r[1] * p.t[k], 2) + Math.pow(p.r[2] * p.w[k], 2));
    return out;
  }
  function sdf_tissue(body, p, strength, bulge) {                       // (bulge: metres the part stands proud of the skin; undefined: as proud as the share asks, capped)
    const comp = body.comp, Pr = comp.prim, st = comp.settings || {}, falloff = st.skin_falloff !== undefined ? st.skin_falloff : 0.5, range = st.skin_range > 0 ? st.skin_range : 1;
    const min_blend = st.skin_min_blend > 0 ? st.skin_min_blend : 0.5 * body.cell;
    const rr = aligned_radii(p), sr = 1 / Math.sqrt(Math.pow(p.d[0] / rr[0], 2) + Math.pow(p.d[1] / rr[1], 2) + Math.pow(p.d[2] / rr[2], 2));      // (how far its surface is from its middle along d)
    const k = Math.max(0.6 * Math.min(p.r[1], p.r[2]), 2 * body.cell), tau_t = k * falloff + min_blend;
    const bones = [];                                                    // (the main island's union primitives that have a bone: what claims a vertex's skin)
    for (let j = 0; j < body.list.length; j++) { const i = body.list[j], o = i * STRIDE; if (Pr[o + 1] === 0 && Pr[o + 13] >= 0) bones.push(o); }
    const T = p.thickness, start = p.start, t0 = len(sub(p.surface, start));
    // the share of the skin that the vertex at the middle (where the new surface crosses the ray from the start along d) gives the tissue, for the part standing `pr` proud of the old skin
    function share(pr) {
      const C = madd(p.surface, p.d, pr - sr);
      const F = function (t) { const x = madd(start, p.d, t); return fold_cubic(body.f(x), ell_dist(C, rr, x), k); };
      let a = Math.max(0, t0 - 0.5 * T), fa = F(a), b = a, fb = fa, step = Math.max(body.cell * 0.25, (t0 + Math.max(pr, 0) + k - a) / 48), guard = 0;
      while (fb <= 0 && guard++ < 400) { a = b; fa = fb; b = a + step; fb = F(b); }
      if (fb <= 0) return { share: 0, at: null, center: C };
      for (let it = 0; it < 40; it++) { const m = 0.5 * (a + b); if (F(m) > 0) b = m; else a = m; }
      const X = madd(start, p.d, 0.5 * (a + b));
      let dmin = ell_wdist(C, rr, X);
      const wd = new Float64Array(bones.length);
      for (let j = 0; j < bones.length; j++) { wd[j] = body.field.wdist(bones[j], X[0], X[1], X[2]); if (wd[j] < dmin) dmin = wd[j]; }
      const acc = {};
      let tt = (ell_wdist(C, rr, X) - dmin) / (range * tau_t);
      if (tt < 1) acc.tissue = (1 - tt) * (1 - tt);
      for (let j = 0; j < bones.length; j++) {
        const o = bones[j], tau = Pr[o + 2] * falloff + min_blend;
        tt = (wd[j] - dmin) / (range * tau);
        if (tt < 1) { const b_ = "b" + Pr[o + 13]; acc[b_] = (acc[b_] || 0) + (1 - tt) * (1 - tt); }
      }
      const vals = Object.keys(acc).map(function (key) { return [key, acc[key]]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 4);
      let sum = 0, mine = 0; vals.forEach(function (e) { sum += e[1]; if (e[0] === "tissue") mine = e[1]; });
      return { share: sum > 0 ? mine / sum : 0, at: X, center: C };
    }
    const lo = -0.6 * sr, hi = SDF_PROUD * sr;
    let best = share(bulge !== undefined ? bulge : hi), pr = bulge !== undefined ? bulge : hi;
    if (bulge === undefined && best.share > strength) {
      let a = lo, b = hi, sa = share(a);
      if (sa.share >= strength) { best = sa; pr = a; }
      else {
        for (let it = 0; it < 18; it++) { const m = 0.5 * (a + b), sm = share(m); if (sm.share > strength) { b = m; best = sm; pr = m; } else a = m; }
      }
    }
    const own = body.color_at(madd(p.surface, p.d, -0.5 * body.cell)), color = own ? own.color : [0.8, 0.6, 0.5, 1];
    return { part: { id: null, shape: "ellipsoid", center: v6(best.center), radii: v6(rr), bone: null, blend: r6(k), blend_mode: "cubic", color: color.map(function (x) { return r6(x); }) }, proud: pr, share: best.share, bulge: best.at ? len(sub(best.at, p.surface)) : 0,
      owner: own ? own.source : null };
  }

  // ---- expand: the request made into a new definition ----------------------------------------------------------------------------------------------------------------------------------------------------------------
  function expand(def, spec, options) {
    const t_start = now(), KM = kinds_mod();
    if (!def || typeof def !== "object" || Array.isArray(def)) throw fail_list(["expand takes a creature definition { skeleton, ... }"]);
    const o = options || {}, warnings = [], notes = [];
    if (spec === undefined) spec = def.tissue;
    else if (def.tissue !== undefined && def.tissue !== null && spec !== def.tissue) warnings.push("tissue: the definition's own `tissue` was replaced by the request given to expand");
    const sk = skeleton_of(def.skeleton);
    const chk = check_spec(spec, sk);
    if (chk.errors.length) throw fail_list(chk.errors);
    const out = Object.assign({}, def);
    delete out.tissue;
    if (!chk.list.length) { out.skeleton = def.skeleton.map(function (b) { return Object.assign({}, b); }); return { def: out, added: [], placements: [], notes: notes, warnings: warnings, stats: { ms: now() - t_start } }; }
    const an = anatomy(def, sk), soft_on = o.soft !== false, mesher = o.mesher || MESHER;
    const has_mesh = def.mesh && typeof def.mesh === "object" && def.mesh.positions && def.mesh.indices && def.mesh.normals;
    const has_sdf = !has_mesh && def.sdf && typeof def.sdf === "object" && Array.isArray(def.sdf.parts) && def.sdf.parts.length;
    const page_bones = function (extra) { const L = []; for (let i = 0; i < sk.n; i++) { const p = sk.parent[i]; L.push({ name: sk.names[i], parent: p >= 0 ? sk.names[p] : null, head: sk.head(i), tail: sk.tail(i) }); } return L.concat(extra || []); };
    // (the kinds are placed on the body's surface; the marks are given their place and need none: a request of marks alone reads no surface and meshes nothing)
    const marks = chk.list.filter(function (r) { return r.mark !== undefined; }), n_kinds = chk.list.length - marks.length;
    let body = null;
    if (has_mesh) body = mesh_body(def.mesh, sk);
    else if (has_sdf) {
      if (!n_kinds) body = null;
      else if (!mesher) warnings.push("tissue: the creature's body is an sdf and no mesher was given (use_mesher): the bones are placed by the skeleton alone");
      else {
        try { body = sdf_body(def.sdf, page_bones([]), mesher); }
        catch (e) { warnings.push("tissue: the sdf could not be read for its surface (" + String(e && e.message) + "): the bones are placed by the skeleton alone"); body = null; }
      }
    } else warnings.push("tissue: the creature has no body (no mesh, no sdf): " + (n_kinds ? "the bones are placed by the skeleton alone, the skin " + REACH.trunk + " of the trunk's length from its line" : "the marks carve nothing"));
    const ctx = { sk: sk, an: an, body: body, warnings: warnings };
    // the names that are taken: the creature's bones and the ones made here
    const taken = Object.create(null); sk.names.forEach(function (n) { taken[n] = true; });
    const errs = [], made = [];
    chk.list.forEach(function (req, i) {
      if (req.mark !== undefined) return;                                                  // (a mark: below)
      const kind = KM.KINDS[req.kind], tag = "tissue[" + i + "] (" + req.kind + "): ";
      if (kind.posture !== "any" && kind.posture !== an.posture && req.at === undefined) warnings.push(tag + "a " + kind.title + " is for " + (kind.posture === "upright" ? "an upright" : "a level") + " trunk; this creature's is " + an.posture + " (the place is a guess: check it, or give `at`)");
      let pl;
      try { pl = places_of(ctx, req, i); } catch (e) { (e.list || [String(e.message)]).forEach(function (m) { errs.push(m.replace(/^system: tissue: /, "")); }); return; }
      // names: the request's (a pair: name_l / name_r), else tissue_<kind>[_l | _r], a number after a name that is taken (two requests of a kind)
      const base = req.name !== undefined ? req.name : "tissue_" + req.kind;
      const sides_seen = {};
      pl.forEach(function (q) {
        const sfx = q.p.side > 0 ? "_l" : (q.p.side < 0 ? "_r" : "");
        let nm;
        if (req.name !== undefined) {
          const m = MIRROR_RE.exec(base);
          nm = pl.length > 1 || kind.pair ? (m ? (q.p.side < 0 ? mirror_ref(base) : base) : base + sfx) : base;
          const key = nm;
          if (sides_seen[key]) nm = nm + (sides_seen[key] + 1);
          sides_seen[key] = (sides_seen[key] || 0) + 1;
          if (taken[nm]) { errs.push(tag + "the creature has a bone '" + nm + "' already: give the tissue another `name`"); return; }
        } else {
          nm = base + sfx;
          let k = 2;
          while (taken[nm]) nm = base + sfx + (k++);
        }
        taken[nm] = true;
        made.push({ req: req, kind: kind, p: q.p, take: q.take, name: nm, index: -1 });
      });
    });
    if (errs.length) throw fail_list(errs);
    if (sk.n + made.length > MAX_BONES) throw fail_list(["the creature has " + sk.n + " bones and the request adds " + made.length + ": system takes at most " + MAX_BONES]);
    if (made.length > MAX_ADDED) throw fail_list(["the request adds " + made.length + " bones: at most " + MAX_ADDED]);
    made.forEach(function (m, j) { m.index = sk.n + j; });
    // the skeleton: the def's entries copied, a host that gets a child keeps the tail it had (written in; a mirrored entry that is a host written out as its two bones), the new bones appended
    const host_set = {}; made.forEach(function (m) { host_set[m.p.host] = true; });
    const entries = def.skeleton.map(function (b) { return Object.assign({}, b); });
    const unroll = {};
    Object.keys(host_set).forEach(function (hs) {
      const h = +hs, e = sk.entry[h];
      if (sk.given[h]) return;
      if (def.skeleton[e].mirror !== undefined && def.skeleton[e].mirror !== null) unroll[e] = true;
      else entries[e].tail = v6(sk.tail(h));
    });
    let bones_out = [];
    entries.forEach(function (b, e) {
      if (!unroll[e]) { bones_out.push(b); return; }
      const li = sk.index[def.skeleton[e].name], ri = li + 1, L = Object.assign({}, b), R = Object.assign({}, b);
      delete L.mirror; delete R.mirror;
      L.tail = v6(sk.tail(li));
      R.name = sk.names[ri]; R.parent = sk.parent[ri] >= 0 ? sk.names[sk.parent[ri]] : null; R.head = sk.head(ri); R.tail = v6(sk.tail(ri)); if (b.roll) R.roll = -b.roll;
      bones_out.push(L, R);
      notes.push("the bone entry '" + b.name + "' (mirror: \"x\") is written out as its two bones: a tissue bone hangs from one of them and their tails are kept");
    });
    const size = sk.size;
    made.forEach(function (m) {
      const nb = { name: m.name, parent: sk.names[m.p.host], head: v6(m.p.center), tail: v6(m.p.tail) };
      const want_soft = soft_on && m.req.soft !== false;
      if (want_soft) nb.soft = soft_of(m.kind, size, m.req);
      m.bone = nb;
      bones_out.push(nb);
    });
    out.skeleton = bones_out;
    const strength_default = function (m) { return m.req.strength !== undefined ? m.req.strength : (o.strength !== undefined ? o.strength : m.kind.peak); };
    // the marks: a patch of skin for a bone that is there (no bone is added, nothing grows)
    const mark_regions = marks.map(function (r) { return mark_region(r, sk); });
    // the body
    let stats = { ms: 0 }, skin = null;
    if (has_mesh) {
      made.forEach(function (m, j) { if (m.req.shape === "grow" || m.req.bulge !== undefined) errs.push("tissue (" + m.req.kind + "): shape \"grow\" and bulge are for an sdf creature: a mesh creature's shape is its mesh (its skin is carved)"); });
      if (errs.length) throw fail_list(errs);
      const regions = made.map(function (m) { return { c: m.p.center, d: m.p.d, t: m.p.t, w: m.p.w, r: m.p.r, peak: strength_default(m), allowed: m.take.mask, index: m.index }; }).concat(mark_regions);
      let root0 = 0; for (let i = 0; i < sk.n; i++) if (sk.parent[i] < 0) { root0 = i; break; }
      const cv = carve(def.mesh, regions, sk.n + made.length, root0, body.outward());
      out.mesh = Object.assign({}, def.mesh, { skin_indices: cv.skin_indices, skin_weights: cv.skin_weights, skin_count: cv.skin_count });
      if (cv.colors) out.mesh.colors = cv.colors;
      made.forEach(function (m, j) { m.carve = cv.per[j]; });
      mark_regions.forEach(function (r, j) { r.carve = cv.per[made.length + j]; });
      stats.touched = cv.touched; stats.vertices = body.vertices; stats.skin_count = cv.skin_count;
      if (def.mesh.skin_count !== cv.skin_count) notes.push("the mesh's skin has " + cv.skin_count + " bones a vertex now (it had " + (def.mesh.skin_count || "none") + ")");
    } else if (has_sdf) {
      // the DEFAULT: the shape is the creature's own; the skin of the mesh the mesher makes is carved afterwards, as a mesh's is (the regions go with the result: `skin`, species.js applies them to the meshed sdf).
      // `shape: "grow"` or `bulge: <metres>`: a part on the new bone grows the tissue out of the body (the creator's intended geometry) and the mesher gives it its skin
      const parts = def.sdf.parts.slice(), extra = [], regions = [];
      made.forEach(function (m) {
        extra.push({ name: m.name, parent: sk.names[m.p.host], head: m.bone.head, tail: m.bone.tail });
        if (!(m.req.shape === "grow" || m.req.bulge !== undefined)) { regions.push({ c: m.p.center, d: m.p.d, t: m.p.t, w: m.p.w, r: m.p.r, peak: strength_default(m), allowed: m.take.mask, index: m.index }); m.sdf_carve = true; return; }
        if (!body) { m.grow_blind = true; return; }
        let b2 = body;
        if (parts.length > def.sdf.parts.length) { try { b2 = sdf_body(Object.assign({}, def.sdf, { parts: parts }), page_bones(extra.slice(0, -1)), mesher); } catch (e) { b2 = body; } }
        const r = sdf_tissue(b2, m.p, strength_default(m), m.req.bulge);
        let pid = m.name, pk = 2;
        while (parts.some(function (q, qi) { return (q.id !== undefined ? String(q.id) : "p" + qi) === pid; })) pid = m.name + "_part" + (pk++);
        r.part.id = pid; r.part.bone = m.name;
        const owner = r.owner !== null && r.owner !== undefined ? parts.filter(function (q, qi) { return (q.id !== undefined ? String(q.id) : "p" + qi) === String(r.owner).replace(/#x$/, ""); })[0] : null;
        if (owner) ["roughness", "metal"].forEach(function (k) { if (owner[k] !== undefined) r.part[k] = owner[k]; });     // (the material of the skin it grows from: SYSTEM.md "Materials")
        parts.push(r.part);
        m.sdf = { proud: r.proud, share: r.share, bulge: r.bulge };
      });
      made.forEach(function (m) {                                         // (a part to grow and no field to read: a plain ellipsoid at the guessed place, the body's first colour)
        if (!m.grow_blind) return;
        const c0 = def.sdf.parts[0] && def.sdf.parts[0].color ? def.sdf.parts[0].color.slice() : [0.8, 0.6, 0.5, 1];
        parts.push({ id: m.name, shape: "ellipsoid", center: v6(m.p.center), radii: v6(aligned_radii(m.p)), bone: m.name, blend: r6(0.6 * Math.min(m.p.r[1], m.p.r[2])), blend_mode: "cubic", color: c0 });
      });
      if (n_kinds) out.sdf = Object.assign({}, def.sdf, { parts: parts });                       // (a new object: the shape's parts are the creature's own unless a tissue grows; marks alone leave the sdf as it is)
      mark_regions.forEach(function (r) { regions.push(r); });
      if (regions.length) {
        let root0 = 0; for (let i = 0; i < sk.n; i++) if (sk.parent[i] < 0) { root0 = i; break; }
        skin = { regions: regions, bones: sk.n + made.length, root: root0 };
      }
    }
    // what was made, in words
    const placements = made.map(function (m) { return public_place(m, sk); });
    made.forEach(function (m) {
      let line = m.name + ": a " + m.kind.title + " on '" + sk.names[m.p.host] + "' at [" + m.p.center.map(r3).join(", ") + "] (" + r3(m.p.r[1]) + " x " + r3(m.p.r[2]) + " x " + r3(m.p.r[0]) + " m)";
      if (m.carve) line += ", " + m.carve.vertices + " vertices give it " + r3(m.carve.weight) + " of their weight (" + m.carve.strong + " more than half) from " + m.take.names.join(", ");
      if (m.sdf) line += ", an sdf part that grows it " + (m.sdf.proud >= 0 ? r3(m.sdf.proud * 1000) + " mm proud" : r3(-m.sdf.proud * 1000) + " mm under the skin") + " (the middle's share " + r3(m.sdf.share) + ", the skin " + r3(m.sdf.bulge * 1000) + " mm out)";
      if (m.sdf_carve) line += ", the skin of the meshed sdf carved (the middle gives " + r3(strength_default(m)) + ": the shape is the creature's own) from " + m.take.names.join(", ");
      if (m.bone.soft) line += "; soft " + m.bone.soft.stiffness + " Hz, damping " + m.bone.soft.damping + ", gain " + m.bone.soft.gain + ", limit " + m.bone.soft.limit;
      if (m.p.fallback) line += " [" + m.p.fallback + ": placed by the skeleton]";
      notes.push(line);
      if (m.carve && m.carve.vertices === 0) warnings.push(m.name + ": no vertex of the mesh is in its reach: the bone carries nothing (a wrong place? give `at` or a bigger `radius`)");
    });
    mark_regions.forEach(function (r) {
      notes.push("mark " + r.bone + ": a patch of " + r3(r.r[0]) + " m at [" + r.c.map(r3).join(", ") + "], whole up to " + r3(r.core * r.r[0]) + " m, its skin carved to the bone from " + (r.takes.join(", ") || "no bone") + (r.carve ? ", " + r.carve.vertices + " vertices follow it (" + r.carve.strong + " more than half)" : " (the skin of the meshed sdf carved after the mesher)"));
      if (r.carve && r.carve.vertices === 0) warnings.push("mark " + r.bone + ": no vertex of the mesh is in its reach: the bone carries nothing (a wrong place? a bigger `radius`)");
    });
    stats.ms = now() - t_start;
    const res = { def: out, added: made.map(function (m) { return m.name; }), marked: mark_regions.map(function (r) { return r.bone; }), placements: placements, notes: notes, warnings: warnings, stats: stats };
    if (skin) res.skin = skin;                                           // (an sdf's: carve_mesh(the meshed sdf, skin) is its skin; the page does it, species.js)
    return res;
  }
  // a MARK's region (what carve takes): the patch round a point of the skin, a sphere of the radius (so a mark and its mirrored twin are mirror images), whole up to `core` of it; the skin is taken from `takes` or the bone's parent
  function mark_region(req, sk) {
    const idx = sk.index[req.mark], d = unit(req.dir), allowed = new Uint8Array(sk.n + 64), takes = [];
    // the patch's axes: d through the skin, t along `axis` (a tangent: its part across d), w across them. A round patch has no axis of its own (the ball's: any two across d)
    let t = null;
    if (req.axis) { const a = unit(req.axis), k = dot(a, d), x = [a[0] - d[0] * k, a[1] - d[1] * k, a[2] - d[2] * k]; if (len(x) > 1e-6) t = unit(x); }
    if (!t) t = unit(cross(d, Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
    const w = cross(d, t);
    const put = function (i) { if (i !== undefined && i >= 0 && i < sk.n && i !== idx && !allowed[i]) { allowed[i] = 1; takes.push(sk.names[i]); } };
    if (req.takes) req.takes.forEach(function (n) { put(sk.index[n]); });
    else if (sk.parent[idx] >= 0) put(sk.parent[idx]);
    else for (let i = 0; i < sk.n; i++) put(i);                       // (a bone that has no parent: any other bone's skin)
    const R = req.radius, ra = req.radii ? req.radii[0] : R, rb = req.radii ? req.radii[1] : R;
    const paint = !!(req.skin || req.color), tint = req.tint !== undefined ? req.tint : 1;
    return { c: req.at.slice(), d: d, t: t, w: w, r: [Math.max(R, ra, rb), ra, rb], peak: req.strength !== undefined ? req.strength : 1, core: req.core !== undefined ? req.core : MARK_CORE, allowed: allowed, index: idx, mark: true, bone: req.mark, takes: takes,
      color: req.color ? [req.color[0], req.color[1], req.color[2]] : null, skin: req.skin === true, tint: tint, crisp: req.crisp !== undefined ? req.crisp : 0, paint: paint && tint > 0 };
  }
  // the skin of a mesh carved by the regions of an expand (an sdf creature's: `skin` of its result) -> { mesh (a new object: the same arrays but the skin, and the colours of a mark that has one), per, touched }
  function carve_mesh(mesh, skin) {
    if (!mesh || !mesh.positions || !mesh.indices || !skin || !Array.isArray(skin.regions)) throw new Error("system: tissue: carve_mesh takes a mesh and the `skin` of an expand");
    const body = mesh_body(mesh, null), cv = carve(mesh, skin.regions, skin.bones, skin.root, body.outward());
    const out = Object.assign({}, mesh, { skin_indices: cv.skin_indices, skin_weights: cv.skin_weights, skin_count: cv.skin_count });
    if (cv.colors) out.colors = cv.colors;
    return { mesh: out, per: cv.per, touched: cv.touched };
  }
  function public_place(m, sk) {
    const p = m.p;
    return { kind: m.req ? m.req.kind : m.kind_name, name: m.name, side: p.side > 0 ? "l" : (p.side < 0 ? "r" : null), parent: sk.names[p.host], at: v6(p.center), tail: v6(p.tail), dir: v6(p.d), surface: v6(p.surface),
      radius: v6(p.r), axes: { d: v6(p.d), t: v6(p.t), w: v6(p.w) }, mirror: !!p.mirrored, thickness: r6(p.thickness), width: r6(p.width), length: r6(p.length), takes: m.take.names.slice(), fallback: p.fallback };
  }

  // ---- placement / describe / kinds / check ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // what a placement reads of a creature: its skeleton, its anatomy, its body's surface (made once for many placements: check)
  function context(def, o) {
    const sk = skeleton_of(def.skeleton), an = anatomy(def, sk), mesher = (o && o.mesher) || MESHER;
    let body = null;
    if (def.mesh && def.mesh.positions && def.mesh.indices && def.mesh.normals) body = mesh_body(def.mesh, sk);
    else if (def.sdf && Array.isArray(def.sdf.parts) && def.sdf.parts.length && mesher) {
      const bones = []; for (let i = 0; i < sk.n; i++) bones.push({ name: sk.names[i], parent: sk.parent[i] >= 0 ? sk.names[sk.parent[i]] : null, head: sk.head(i), tail: sk.tail(i) });
      try { body = sdf_body(def.sdf, bones, mesher); } catch (e) { body = null; }
    }
    return { sk: sk, an: an, body: body, warnings: [] };
  }
  function placement(def, kind, options) {
    const o = options || {}, req = Object.assign({}, o.request || {}, { kind: kind });
    const ctx = o.context || context(def, o), sk = ctx.sk, chk = check_spec([req], sk);
    if (chk.errors.length) throw fail_list(chk.errors);
    ctx.warnings = [];
    const pl = places_of(ctx, chk.list[0], 0);
    const KM = kinds_mod();
    return pl.map(function (q) { const r = public_place({ req: chk.list[0], p: q.p, take: q.take, name: "tissue_" + kind + (q.p.side > 0 ? "_l" : (q.p.side < 0 ? "_r" : "")) }, sk); r.posture = ctx.an.posture; r.suits = KM.KINDS[kind].posture === "any" || KM.KINDS[kind].posture === ctx.an.posture; r.warnings = ctx.warnings.slice(); return r; });
  }
  function describe(name) {
    const k = kind_of(name);
    if (!k) return "no tissue kind '" + name + "' (" + kinds_mod().ORDER.join(", ") + ")";
    const s = k.soft;
    return k.title + ": " + k.what + ". " + (k.pair ? "A pair (one on each side). " : "One, on the middle. ") + "Where: " + k.where + ". For: " + k.suits.join(", ") + (k.posture !== "any" ? " (an " + k.posture + " trunk)" : "") + ". Needs: " + k.needs.join(", ") +
      ". The spring at " + kinds_mod().SIZE_REF + " m: " + s.hz + " Hz, damping " + s.damping + ", gain " + s.gain + ", limit " + s.limit + " of the size, axes " + JSON.stringify(s.axis) + ". It takes skin from: " + (k.takes || []).join(", ") +
      "; the middle gives " + k.peak + " of its skin.";
  }
  function kinds() {
    const KM = kinds_mod();
    return KM.ORDER.map(function (n) { const k = KM.KINDS[n]; return { name: n, title: k.title, what: k.what, suits: k.suits.slice(), posture: k.posture, needs: k.needs.slice(), pair: k.pair, soft: JSON.parse(JSON.stringify(k.soft)), where: k.where }; });
  }
  // what a creature has (its soft bones, the tissue bones made before) and what it could have (every kind that suits it, where)
  function check(def, options) {
    const KM = kinds_mod(), ctx = context(def, options), sk = ctx.sk, an = ctx.an;
    const soft = [], tissue = [];
    for (let i = 0; i < sk.n; i++) { const v = sk.defs[i].soft; if (v !== undefined && v !== null && v !== false) soft.push(sk.names[i]); if (/^tissue_/.test(sk.names[i])) tissue.push(sk.names[i]); }
    const roles = an.roles && Array.isArray(an.roles.soft) ? an.roles.soft.map(function (e) { return typeof e === "string" ? e : (e && e.bone); }) : [];
    const could = [];
    KM.ORDER.forEach(function (n) {
      const k = KM.KINDS[n];
      const fits = k.posture === "any" || k.posture === an.posture;
      let where = null, why = null;
      try { where = placement(def, n, Object.assign({}, options || {}, { context: ctx })); } catch (e) { why = String(e.message).replace(/^system: tissue: /, ""); }
      could.push({ kind: n, suits: fits && !!where && where.length > 0, posture_ok: fits, where: where, why: why });
    });
    return { name: def.name || null, bones: sk.n, posture: an.posture, size: r3(sk.size), body: def.mesh ? "mesh" : (def.sdf ? "sdf" : "none"), soft: soft, soft_roles: roles, tissue: tissue, kinds: could };
  }

  const api = { use_kinds: use_kinds, use_mesher: use_mesher, expand: expand, carve_mesh: carve_mesh, placement: placement, describe: describe, kinds: kinds, check: check, check_spec: function (spec, def) { return check_spec(spec, skeleton_of(def.skeleton)); },
    skeleton_of: skeleton_of, anatomy: anatomy, carve: carve, soft_of: function (kind, size, req) { return soft_of(kind_of(kind), size, req); }, facing: facing, REACH: REACH, SPEC_KEYS: SPEC_KEYS, MARK_KEYS: MARK_KEYS, MARK_CORE: MARK_CORE, SDF_PROUD: SDF_PROUD,
    FACE_LO: FACE_LO, FACE_HI: FACE_HI };
  return api;
});

// ========================================================================================================================
// action_player
// ========================================================================================================================
packing()("happy_action_player", function happy_action_player() {
  "use strict";
  // THE PLAYER of a designed action, the PURE part (SYSTEM.md "The action designer"): what a spec says at a time. An action is DATA (the spec of action_spec.js: phases with a duration and an ease, tracks of numbers in units that
  // belong to no creature, events, params, a loop, a fade) and this is the one place that knows how it is played: the eases, the curves between the key values, the humps, the delays, the wobbles, the power, the mirror, the loop and its
  // cycles, the events that came due, the fade in and out. It takes the spec (compiled) and the clock and answers with a table of numbers by channel; it has no engine, no DOM and no creature in it, so the window draws exactly what the
  // creature is told, a test reads it against formulas, and a player that lives in the worker one day plays the same data. The page's layer (action_runtime.js) turns the table into commands (role_pose, chain, set_intent).
  // The numbers are the donor's (v1/packs/designed.js: degrees for the angles of a role (yaw to the left, pitch UP, roll to the right), arm lengths from the shoulder for a hand (x OUT to the side the arm is on, y up, z forward),
  // leg lengths for a foot, the hips' heights for the hips and for the body's speed), so that the presets are the same data. Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no class.
  //
  //   compile(spec) -> C      the spec made ready (a cache by the spec's identity: cached(name, spec))
  //   make_state() -> st      the clock's state of one run;  step(C, st, dt, o) -> st      one frame: the clock, the table, the events due, the weight; o: { power (1), speed (1), mirror (false), props ({ name: true }) }
  //                           o.pin (seconds along the phases, 0 or more): the clock is set to it instead of being advanced by dt (the air phase of a jump is as far through as the body's flight says: the runtime pins it)
  //   hold(st, tau | null)    freeze the run at a time of the action (the designer's scrubbing): the pose of that time, no clock, no events;  stop(st)  the run fades out
  //   values(C, tau, power, mirror, V, H)     the numbers at a time: V[i] the value of component i, H[i] 1 when the spec has a track for it       table(st) -> { id: value } of the components with a track
  //   COMP, COMP_INDEX, NEU, EASE_LIST, ease(name, u), uses(spec) -> the kinds of channel the spec speaks in
  // LEARNED ACTIONS (SYSTEM.md "Learned actions: events and states", tools/action_learn.js) add three things the AI listens to, all here so that the page and the worker cannot differ:
  //   `pw: true` on an emit event: the value it says is multiplied by the run's power (st.power: the clamp of o.power), so a strike's value is how hard the action was asked to hit;
  //   a `hit` event is told as an emit `hit` (value: the LIMBS index of its limb, 0 .. 7) at its time AND an emit `hit_end` (the same value) at its time + `win` (at most the action's end): no spatial test is made here, the listener
  //   makes it (the limb is where the blow is; the hit's damage, push and reach stay in the spec for whoever tests). The hit_end of a spec's 8th hit and after is not told (event bits 24 .. 30 are the hit ends', 7 of them);
  //   `waits: [{ at: [phase, 0 .. 1], tag, max }]`: a WAIT POINT. The clock of the run STOPS at that moment (the pose of it is held, the fade in goes on) until release(st) or until `max` seconds (real ones: not scaled by the speed;
  //   0: for ever) have passed; reaching it tells an emit `tag` (value 1), leaving it an emit `tag_end` (value 1). A wait is passed once a round (a loop arms it again at every turn); the events of its moment are told before the stop;
  //   release(st) says nothing when the clock is not standing at one; stopping the run ends the wait (nothing more is told: a run that is stopped tells no events). st.wait is the index (in C.waits, by time) of the wait the clock stands at, -1 else.
  //   phase_at(C, tau) -> the index of the phase that tau is in (the last one from the end on).
  const DEG = Math.PI / 180, MAX_EVENTS = 24, MAX_WAITS = 4, BIT_HIT_END = 24, MAX_HIT_ENDS = 7, BIT_WAIT = 31;
  const LIMBS = ["hand_l", "hand_r", "foot_l", "foot_r", "foot_fl", "foot_fr", "weapon", "point"];          // (the value of a hit's emits: action_spec.js LIMBS, the same list)
  const clamp = function (x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); };
  const has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };                  // (a name that is a key of every object, constructor, valueOf ..., is not a name of ours)
  const smooth = function (u) { u = u < 0 ? 0 : (u > 1 ? 1 : u); return u * u * (3 - 2 * u); };

  // ---- the eases: u in 0 .. 1 -> 0 .. 1; a phase moves a track from its value at the phase's start to its value at the phase's end by one of them ----
  const EASE_LIST = ["linear", "smooth", "ease_in", "ease_out", "fast_out", "slow_in", "back", "spring", "snap", "hold"];
  const EASES = {
    linear: function (u) { return u; },
    smooth: function (u) { return u * u * (3 - 2 * u); },
    ease_in: function (u) { return u * u; },                                          // (slow at the start, fast at the end: a wind-up that gathers)
    ease_out: function (u) { return 1 - (1 - u) * (1 - u); },
    fast_out: function (u) { const v = 1 - u; return 1 - v * v * v; },                  // (all of it in the first part: a blow)
    slow_in: function (u) { return u * u * u; },
    back: function (u) { const c1 = 1.70158, v = u - 1; return 1 + (c1 + 1) * v * v * v + c1 * v * v; },          // (goes past the end by a tenth and comes back)
    spring: function (u) { const s = 1 - Math.exp(-6 * u) * Math.cos(12.566 * u); return s + (1 - (1 - Math.exp(-6) * Math.cos(12.566))) * u; },          // (rings about the end: a hit reaction, a tail)
    snap: function (u) { return u > 0 ? 1 : 0; },                                     // (at the end value from the first instant)
    hold: function (u) { return u >= 1 ? 1 : 0; }                                     // (at the start value until the end, then the end value)
  };
  const ease = function (name, u) { return (has(EASES, name) ? EASES[name] : EASES.smooth)(clamp(u, 0, 1)); };

  // ---- the numbers a role can be told: [id, group, neutral, lowest, highest, mirror (-1: the sign turns when left and right are swapped)] ----
  const COMP = [], COMP_INDEX = {};
  function add(id, group, neutral, lo, hi, sign) { COMP_INDEX[id] = COMP.length; COMP.push({ id: id, group: group, neutral: neutral, lo: lo, hi: hi, sign: sign || 1, mirror: id }); }
  // (the hips' pitch and roll reach 110 degrees since 2026-10-19: a creature that lies on its side, a death that rolls it over, a horse that rears; under the worker's 2 radians a bone. A spec of before is the same: its
  // numbers were inside the old 60)
  const ROT = [["hips", 90, 110, 110], ["spine", 90, 60, 60], ["chest", 90, 60, 60], ["neck", 80, 60, 45], ["head", 90, 60, 45], ["tail", 120, 90, 90]];
  const SIDES = ["l", "r"];
  let r, s, k, i;
  for (r = 0; r < ROT.length; r++) {
    add(ROT[r][0] + ".yaw", ROT[r][0], 0, -ROT[r][1], ROT[r][1], -1);                  // (degrees: yaw to the creature's left, pitch up, roll tilts to the right)
    add(ROT[r][0] + ".pitch", ROT[r][0], 0, -ROT[r][2], ROT[r][2], 1);
    add(ROT[r][0] + ".roll", ROT[r][0], 0, -ROT[r][3], ROT[r][3], -1);
  }
  add("hips.x", "hips_move", 0, -0.6, 0.6, -1); add("hips.y", "hips_move", 0, -0.8, 0.5, 1); add("hips.z", "hips_move", 0, -0.8, 0.8, 1);          // (hips' heights: x to the left, y up, z forward)
  add("jaw.open", "jaw", 0, 0, 60, 1);
  for (s = 0; s < 2; s++) {                                                            // (arm lengths from the shoulder: x out to the side the arm is on, y up, z forward; grip 0 open .. 1 closed)
    add("arm_" + SIDES[s] + ".x", "arm_" + SIDES[s], 0.15, -1.2, 1.2); add("arm_" + SIDES[s] + ".y", "arm_" + SIDES[s], -0.92, -1.2, 1.2); add("arm_" + SIDES[s] + ".z", "arm_" + SIDES[s], 0.3, -1.2, 1.2); add("arm_" + SIDES[s] + ".grip", "arm_" + SIDES[s], 0, 0, 1);
    add("arm_" + SIDES[s] + ".pole", "arm_" + SIDES[s], 0, -120, 120);                                 // (the elbow: the bend plane of the arm turned about the line from the shoulder to the hand, degrees, + out)
  }
  const LEGS = ["leg", "legf"];
  for (k = 0; k < 2; k++) for (s = 0; s < 2; s++) {                                    // (leg lengths from the hip: x out, y up (-1 is straight down), z forward; own 0 the gait's foot .. 1 the action's)
    const lg = LEGS[k] + "_" + SIDES[s];
    add(lg + ".x", lg, 0.08, -1.2, 1.2); add(lg + ".y", lg, -0.98, -1.1, 0.6); add(lg + ".z", lg, -0.03, -1.2, 1.2); add(lg + ".own", lg, 0, 0, 1);
    add(lg + ".pole", lg, 0, -90, 90);                                                    // (the knee: the bend plane of the leg turned about the line from the hip to the foot, degrees, + out)
  }
  add("body.fwd", "body", 0, -8, 8, 1); add("body.side", "body", 0, -8, 8, -1);        // (the body's speed, hips' heights a second: forward, to the left)
  add("look", "look", 0, 0, 1, 1);                                                      // (how much the head looks at the target)
  // the WINGS (a flyer's: world.cpp's WINGS model, sp.set_wings): how far they are folded (0 spread .. 1 folded, the tip swept back), how fast they beat (beats a second; 0: they hold still) and how far (degrees of the
  // tip's lift either way, the corpus' body layout's own unit; the runtime makes it a multiple of the species' own amplitude). Added at the end: no other number's index moves, and a spec without them is what it was
  add("wings.fold", "wings", 0, 0, 1, 1); add("wings.hz", "wings", 0, 0, 20, 1); add("wings.amp", "wings", 0, 0, 90, 1);
  for (i = 0; i < COMP.length; i++) {                                                  // (the number that takes this one's place when left and right are swapped)
    const id = COMP[i].id, m = id.replace(/_l\./, "_X.").replace(/_r\./, "_l.").replace(/_X\./, "_r.");
    COMP[i].mirror = COMP_INDEX[m] === undefined ? id : m;
    COMP[i].mi = COMP_INDEX[COMP[i].mirror];
  }
  const NEU = new Float64Array(COMP.length);
  for (i = 0; i < COMP.length; i++) NEU[i] = COMP[i].neutral;

  // ---- a spec made ready: the phases' times, the tracks' curves, the events in time ----
  function compile(S) {
    const C = { name: S && S.name, loop: false, cycles: 0, hold: false, n: 0, dur: [], start: [], total: 0, air: -1, tracks: [], ev: [], hits: 0, fade: [0.12, 0.2], priority: 5, frame: "body", S: null };
    const phases = S && S.phases && S.phases.length ? S.phases : [{ name: "all", t: 1, ease: "smooth" }], n = phases.length, pidx = {};
    let tot = 0, j, i;
    for (i = 0; i < n; i++) {
      let d = +phases[i].t;
      if (!(d >= 0.005)) d = 0.005;
      C.dur.push(d); C.start.push(tot); tot += d; pidx["$" + phases[i].name] = i;
      if (phases[i].air && C.air < 0) C.air = i;
    }
    // the FLIGHT is the air phase and the air phases right after it (a RUN of them, one flight: the legs' tuck has key poses of its own inside it); the runtime pins the run's span by the body's height
    C.air_end = C.air; if (C.air >= 0) while (C.air_end + 1 < n && phases[C.air_end + 1].air) C.air_end++;
    C.air_span = C.air >= 0 ? C.start[C.air_end] + C.dur[C.air_end] - C.start[C.air] : 0;
    C.n = n; C.total = tot; C.hold = !!S && S.end === "hold"; C.lies = C.hold && S.kind !== "movement" && S.kind !== "locomotion"; C.frame = S && S.frame === "chest" ? "chest" : "body";
    C.loop = !!S && S.end === "loop" && C.air < 0; C.cycles = C.loop && S.cycles > 0 ? Math.min(100, Math.floor(S.cycles)) : 0;          // (a loop plays its phases again and again, its events each time, until it is stopped or has made `cycles` of them; an air phase is the body's and does not loop)
    if (S && Array.isArray(S.fade) && S.fade.length === 2) C.fade = [clamp(+S.fade[0] || 0, 0, 2), clamp(+S.fade[1] || 0, 0, 2)];
    if (S && S.priority === S.priority && typeof S.priority === "number") C.priority = S.priority;
    const tr = S && S.tracks ? S.tracks : [];
    for (i = 0; i < tr.length; i++) {
      const T = tr[i], ci = has(COMP_INDEX, T.c) ? COMP_INDEX[T.c] : undefined;
      if (ci === undefined || !T.v) continue;
      const v = new Float64Array(n + 1), e = [];
      for (j = 0; j <= n; j++) { const x = T.v[j] !== undefined ? +T.v[j] : (j > 0 ? v[j - 1] : NEU[ci]); v[j] = x === x ? x : NEU[ci]; }
      for (j = 0; j < n; j++) { const en = T.e && T.e[j] ? T.e[j] : phases[j].ease; e.push(has(EASES, en) ? EASES[en] : EASES.smooth); }
      const o = T.osc && T.osc.hz > 0 && T.osc.a !== 0 ? { hz: +T.osc.hz, a: +T.osc.a, ph: +T.osc.ph || 0, from: clamp(Math.floor(+T.osc.from) || 0, 0, n - 1), to: clamp(Math.floor(T.osc.to === undefined ? n - 1 : +T.osc.to), 0, n - 1) } : null;
      if (o && o.to < o.from) o.to = o.from;
      let hp = null;
      if (T.h) { hp = new Float64Array(n); let any = false; for (j = 0; j < n; j++) { const hv = +T.h[j]; hp[j] = hv === hv ? hv : 0; if (hp[j] !== 0) any = true; } if (!any) hp = null; }          // (a hump: a number added over a phase as sin(pi u): it rises in the middle and is gone at both ends)
      C.tracks.push({ ci: ci, v: v, e: e, h: hp, lag: T.lag > 0 ? +T.lag : 0, amp: T.amp === undefined ? 1 : +T.amp, pw: T.pw === 0 ? 0 : 1, osc: o });
    }
    const ev = S && S.events ? S.events : [];
    let hit_ends = 0;
    for (i = 0; i < ev.length && i < MAX_EVENTS; i++) {
      const E = ev[i], pi = E.at ? (typeof E.at[0] === "number" ? (E.at[0] >= 0 && E.at[0] < n ? Math.floor(E.at[0]) : undefined) : pidx["$" + E.at[0]]) : undefined;
      if (pi === undefined) continue;
      const tau = C.start[pi] + clamp(E.at[1] === undefined ? 0 : +E.at[1], 0, 1) * C.dur[pi], when = typeof E.when === "string" ? E.when : "";
      if (E.type === "hit") {                                                           // (told as an emit `hit` whose value is its limb's index in LIMBS, and a `hit_end` `win` seconds later: the listener tests where the limb is)
        let lx = LIMBS.indexOf(E.limb); if (lx < 0) lx = 1;
        C.ev.push({ i: i, tau: tau, kind: "hit", tag: E.tag, v: lx, pw: false, prop: E.prop, limb: E.limb, dir: E.dir, speed: 0, up: 0, when: when });
        C.hits++;
        if (hit_ends < MAX_HIT_ENDS) C.ev.push({ i: BIT_HIT_END + hit_ends++, tau: Math.min(C.total, tau + clamp(E.win >= 0 ? +E.win : 0.1, 0, 1)), kind: "emit", tag: "hit_end", v: lx, pw: false, prop: undefined, limb: undefined, dir: undefined, speed: 0, up: 0, when: when });
        continue;
      }
      C.ev.push({ i: i, tau: tau, kind: E.type, tag: E.tag, v: E.v === undefined ? 1 : +E.v, pw: E.type === "emit" && E.pw === true, prop: E.prop, limb: E.limb, dir: E.dir, speed: +E.speed || 0, up: +E.up || 0, when: when });
    }
    // the wait points, by time (a wait that names a phase that is not there is not made): the two events of each (reaching it, leaving it) are made here as the other events are
    C.waits = [];
    const wl = S && S.waits ? S.waits : [];
    for (i = 0; i < wl.length && C.waits.length < MAX_WAITS; i++) {
      const Wt = wl[i], pi = Wt && Wt.at ? (typeof Wt.at[0] === "number" ? (Wt.at[0] >= 0 && Wt.at[0] < n ? Math.floor(Wt.at[0]) : undefined) : pidx["$" + Wt.at[0]]) : undefined;
      if (pi === undefined || phases[pi].air) continue;
      const tag = typeof Wt.tag === "string" && Wt.tag ? Wt.tag : "hold", mk = function (tg) { return { i: BIT_WAIT, tau: 0, kind: "emit", tag: tg, v: 1, pw: false, prop: undefined, limb: undefined, dir: undefined, speed: 0, up: 0, when: "" }; };
      C.waits.push({ k: i, tau: C.start[pi] + clamp(Wt.at[1] === undefined ? 0 : +Wt.at[1], 0, 1) * C.dur[pi], tag: tag, max: Wt.max >= 0 ? +Wt.max : 10, enter: mk(tag), leave: mk(tag + "_end") });
    }
    C.waits.sort(function (a, b) { return a.tau - b.tau || a.k - b.k; });
    return C;
  }
  const cache = {};
  function cached(name, S) { let c = cache[name]; if (c === undefined || c.S !== S) { c = cache[name] = compile(S); c.S = S; } return c; }

  // ---- the curves ----
  function seg_value(tr, C, tau) {
    if (tau <= 0) return tr.v[0];
    if (tau >= C.total) return tr.v[C.n];
    let q = C.n - 1;
    while (q > 0 && tau < C.start[q]) q--;
    const u = (tau - C.start[q]) / C.dur[q];
    let x = tr.v[q] + (tr.v[q + 1] - tr.v[q]) * tr.e[q](u);
    if (tr.h !== null && tr.h[q] !== 0) x += tr.h[q] * Math.sin(3.14159265 * u);
    return x;
  }
  function osc_env(o, C, tau) {                                                         // (the wobble's weight: 0 outside its phases, eased in and out over a sixth of them)
    const a = C.start[o.from], b = C.start[o.to] + C.dur[o.to];
    if (tau <= a || tau >= b) return 0;
    const x = (tau - a) / (b - a), q = Math.min(1, x / 0.17, (1 - x) / 0.17);
    return q * q * (3 - 2 * q);
  }
  // the value of every number the spec has a track for at the time tau (seconds along the phases): V[c] and H[c] (1: there is a track); `power` scales what moves away from the number's neutral, `mirror` swaps left and right
  function values(C, tau, power, mirror, V, H) {
    for (let q = 0; q < COMP.length; q++) H[q] = 0;
    for (let q = 0; q < C.tracks.length; q++) {
      const tr = C.tracks[q], c = COMP[tr.ci], te = tau - tr.lag;
      let x = seg_value(tr, C, te);
      if (tr.osc) x += tr.osc.a * Math.sin(6.283185307 * (tr.osc.hz * te + tr.osc.ph)) * osc_env(tr.osc, C, te);
      const nu = c.neutral;
      x = nu + (x - nu) * tr.amp * (tr.pw ? power : 1);
      const cj = mirror ? c.mi : tr.ci;
      V[cj] = mirror ? x * c.sign : x;
      H[cj] = 1;
    }
  }

  // ---- the clock of a run and what it says at each frame ----
  // st: the run's state, made by make_state and changed by step. After a step it is also the ANSWER: st.V / st.H (the numbers and which of them the spec has: by the index of COMP), st.tau (seconds along the phases), st.weight (the
  // fade in and out: 0 .. 1), st.fire (the events whose time came this frame: [{ i, kind, tag, v, prop, limb }]), st.ending (the action is over: its last pose is held while it fades out), st.done (the fade is over: the run is finished),
  // st.cycle (the round of a loop). The clock accumulates (a change of `speed` in the middle never makes it jump).
  function make_state() {
    return { age: 0, ts: 0, cycle: 0, tau: 0, weight: 0, ending: false, settled: false, stopping: false, done: false, end_age: 0, stop_age: 0, hold_at: -1, fired: [], fire: [], V: new Float64Array(COMP.length), H: new Uint8Array(COMP.length), steps: 0, power: 1,
      wait: -1, wait_age: 0, waited: 0, release_req: false };
  }
  // let the clock go on from the wait point it stands at (said once, by the time the next step is made; nothing when it stands at none)
  function release(st) { if (st.wait >= 0) st.release_req = true; }
  function phase_at(C, tau) { let q = C.n - 1; while (q > 0 && tau < C.start[q]) q--; return q; }
  // a phase called windup3 (a name that was taken gets 2, 3 ...: action_spec.js validate) is the phase `windup`: the name without its trailing number (windup_2 too); a name that is only a number keeps it
  function phase_base(name) { const s = String(name), b = s.replace(/_?[0-9]+$/, ""); return b.length > 0 ? b : s; }
  function when_ok(w, props) {                                                          // an event with `when: "sword"` is for a creature that has that prop, `when: "!sword"` for one that has not
    if (!w) return true;
    const neg = w.charAt(0) === "!", name = neg ? w.slice(1) : w, have = !!props && has(props, name) && !!props[name];
    return neg ? !have : have;
  }
  function step(C, st, dt, o) {
    o = o || {};
    const power = clamp(o.power === undefined ? 1 : +o.power, 0, 3), speed = clamp(o.speed > 0 ? +o.speed : 1, 0.2, 4), mirror = !!o.mirror, props = o.props || null;
    st.fire.length = 0;
    if (st.done) return st;
    if (!(dt >= 0)) dt = 0;
    st.age += dt; st.steps++;
    let tau, i2;
    if (st.hold_at >= 0) {                                                              // (held: the pose of that time, nothing else)
      tau = st.hold_at; st.tau = tau; st.ending = false;
      values(C, tau, power, mirror, st.V, st.H);
      st.weight = C.fade[0] > 0 ? smooth(st.age / C.fade[0]) : 1;
      if (st.stopping) {                                                                // (a held pose that is stopped fades out as it is)
        const q = st.age - st.stop_age;
        st.weight *= C.fade[1] > 0 ? 1 - smooth(q / C.fade[1]) : 0;
        if (q >= C.fade[1]) st.done = true;
      }
      return st;
    }
    st.power = power;
    let ts, wait_in = null;
    if (o.pin >= 0) ts = +o.pin;                                                        // (o.pin: the clock is somebody else's for a moment: the body's, in the air phase of a jump: it is at that time of the action now)
    else {
      if (st.wait >= 0) {                                                               // (the clock stands at a wait point: it goes on when released, when the wait's time is up, or when the run is told to stop)
        const Wt = C.waits[st.wait];
        st.wait_age += dt;
        if (st.stopping) st.wait = -1;
        else if (st.release_req || (Wt.max > 0 && st.wait_age >= Wt.max)) { st.waited |= 1 << st.wait; st.wait = -1; st.fire.push(Wt.leave); }
        st.release_req = false;
      }
      if (st.wait >= 0) ts = st.ts;
      else {
        ts = st.ts + dt * speed;
        if (C.waits.length > 0 && !st.stopping) {                                       // (does the clock come to a wait point this frame? the first one it reaches (a loop: in this round, or in the next one if the frame crosses the turn) holds it)
          const c0 = C.loop ? Math.floor(st.ts / C.total) : 0, c1 = C.loop ? Math.floor(ts / C.total) : 0;
          let found = -1, at = 0;
          for (let c = c0; c <= c1 && found < 0; c++) for (let k = 0; k < C.waits.length; k++) {
            if (c === c0 && ((st.waited >> k) & 1) === 1) continue;
            const p = c * C.total + C.waits[k].tau;
            if (st.ts <= p && ts >= p) { found = k; at = p; break; }
          }
          if (found >= 0) { ts = at; st.wait = found; st.wait_age = 0; wait_in = C.waits[found].enter; }
        }
      }
    }
    st.ts = ts; tau = ts;
    let ending = tau >= C.total && !C.hold && !C.loop && st.wait < 0;
    if (C.loop) {                                                                       // (the round the clock is in: the events are armed again at every turn of it)
      const cyc = Math.floor(ts / C.total);
      if (C.cycles > 0 && cyc >= C.cycles) { tau = C.total; ending = true; }
      else {
        tau = ts - cyc * C.total; ending = false;
        if (cyc > st.cycle) {                                                           // (a frame longer than the margin of a moment near the end of the round jumped over it: the moments of the round that was are told now, late, and not lost)
          if (!st.stopping) for (i2 = 0; i2 < C.ev.length; i2++) { const e = C.ev[i2]; if (e.kind !== "hit" && !st.fired[e.i] && when_ok(e.when, props)) st.fire.push(e); }
          st.fired.length = 0; st.cycle = cyc; st.waited = 0;
        }
      }
    }
    st.tau = tau;
    values(C, tau, power, mirror, st.V, st.H);
    if (!st.stopping) for (i2 = 0; i2 < C.ev.length; i2++) {
      const e = C.ev[i2];
      if (tau >= e.tau && !st.fired[e.i] && when_ok(e.when, props)) { st.fired[e.i] = true; st.fire.push(e); }
    }
    for (i2 = 0; i2 < st.fire.length; i2++) st.fired[st.fire[i2].i] = true;
    if (wait_in !== null) st.fire.push(wait_in);                                        // (reaching a wait point is told after the moments up to it)
    st.settled = C.lies === true && !C.loop && tau >= C.total;                          // (a HOLD action that is not a movement (a death, a pose) lies still past its end: the body does not go on at the speed of its last key: a corpse does not creep. A held MOVEMENT is a walk that goes on)
    if (ending && !st.ending) { st.ending = true; st.end_age = st.age; }
    // the weight: faded in from the start, faded out from the moment the action is over or is told to stop
    const w_in = C.fade[0] > 0 ? smooth(st.age / C.fade[0]) : 1;
    let w_out = 1, out_at = -1;
    if (st.stopping) out_at = st.stop_age; else if (st.ending) out_at = st.end_age;
    if (out_at >= 0) {
      if (st.stopping && st.ending) out_at = Math.min(st.stop_age, st.end_age);
      const q = st.age - out_at;
      w_out = C.fade[1] > 0 ? 1 - smooth(q / C.fade[1]) : 0;
      if (q >= C.fade[1]) st.done = true;
    }
    st.weight = w_in * w_out;
    return st;
  }
  function hold(st, tau) { st.hold_at = tau === null || tau === undefined ? -1 : Math.max(0, +tau); if (st.hold_at < 0) { st.fired.length = 0; } }
  function stop(st) { if (!st.stopping) { st.stopping = true; st.stop_age = st.age; } }
  // the numbers of a state by channel id (the ones the spec has a track for)
  function table(st) { const out = {}; for (let q = 0; q < COMP.length; q++) if (st.H[q]) out[COMP[q].id] = st.V[q]; return out; }

  // what a spec says it needs of the creature and of the channels it speaks in (the window and the runtime ask)
  const ROT_GROUP = {};
  ROT.forEach(function (x) { ROT_GROUP[x[0]] = true; });
  function uses(S) {
    const out = {}, tr = S && S.tracks ? S.tracks : [], ev = S && S.events ? S.events : [];
    let i;
    for (i = 0; i < tr.length; i++) {
      const c = has(COMP_INDEX, tr[i].c) ? COMP[COMP_INDEX[tr[i].c]] : undefined;
      if (!c) continue;
      const g0 = c.group;
      if (g0 === "hips_move" || g0 === "jaw" || ROT_GROUP[g0]) out.bones = 1;
      else if (g0 === "arm_l" || g0 === "arm_r") { if (/\.grip$/.test(c.id)) out.fingers = 1; else out.hand = 1; }
      else if (g0 === "body") out.body = 1;
      else if (g0 === "look") out.look = 1;
      else if (g0 === "wings") out.wings = 1;
      else if (/^leg/.test(g0)) out.legs = 1;
    }
    for (i = 0; i < ev.length; i++) {
      const k0 = ev[i].type;
      if (k0 === "impulse") out.body = 1;
      else if (k0 === "show" || k0 === "hide" || k0 === "mount") out.props = 1;
      else if (k0 === "hit" && ev[i].limb === "weapon") out.props = 1;
    }
    if (S && S.phases) for (i = 0; i < S.phases.length; i++) if (S.phases[i].air) out.body = 1;
    const list = [], order = ["look", "hand", "fingers", "bones", "body", "props", "legs", "wings"];
    for (i = 0; i < order.length; i++) if (out[order[i]]) list.push(order[i]);
    return list;
  }

  return { compile: compile, cached: cached, make_state: make_state, step: step, hold: hold, stop: stop, release: release, phase_at: phase_at, phase_base: phase_base, values: values, table: table, ease: ease, EASE_LIST: EASE_LIST, COMP: COMP, COMP_INDEX: COMP_INDEX, NEU: NEU, uses: uses, MAX_EVENTS: MAX_EVENTS, MAX_WAITS: MAX_WAITS, BIT_HIT_END: BIT_HIT_END, MAX_HIT_ENDS: MAX_HIT_ENDS, LIMBS: LIMBS, DEG: DEG, when_ok: when_ok };
});

// ========================================================================================================================
// action_runtime
// ========================================================================================================================
packing()("happy_action_runtime", function happy_action_runtime() {
  "use strict";
  // THE PLAYER of designed actions on the creatures of system, the page's part (SYSTEM.md "The action designer"). An action is data (action_spec.js); what it says at a time is the PURE function of action_player.js
  // (step: the clock, the eases, the loop, the power, the mirror, the fade: a table of numbers by channel). This file is the thin layer that says the table to the creature through the page's API that system has:
  //   the role bones (hips, spine, chest, neck, head)   sp.role_pose(c, bone, { yaw, pitch, roll, x, y, z }): the life's page layer, ADDED to what the life says (the breath, the sway, the gait) and held to the joints by the rig;
  //                                                     a group of tracks turns the bones of the role (the spine's angle is shared between the bones of the spine), the hips are moved by `hips.x y z` (hips' heights);
  //   the tail and the jaw                              the same role_pose: `tail.yaw pitch roll` are shared between the bones of the tail role (its tip turns by the whole angle, as the corpus' tail tip did), on top of the life's own
  //                                                     wave and lag; `jaw.open` (degrees) opens every bone of the jaw role down by its angle (a positive pitch, as the face's channel), held to 1.2 of that bone's own opening
  //                                                     (body.js jaw_max: the role's `max`, else the trait jaw_max);
  //   the wings                                         sp.set_wings(c, { fold, hz, amplitude }) while a `wings.*` track is there (fold 0 spread .. 1, beats a second, degrees of the tip's lift as a multiple of the species'
  //                                                     amplitude), eased by the fade from where the automatic animation holds them; given back (null) when the run ends;
  //   the hands                                         sp.chain(c, arm, { target, weight, pole }): a hand goal in the BODY's frame (arm lengths from the shoulder: x out to the side the arm is on, y up, z forward; the body's frame is the
  //                                                     model's: the trunk may turn, the hand goes where the numbers say from the shoulder) with the weight of the action's fade: the rig solves the arm from the life's pose, so a hand
  //                                                     that is let go goes back to where it hung or swung;
  //   the body's speed                                  sp.drive(c, vx, vz) (the body's velocity IS the track's: no acceleration, no top speed: a dash, a lunge, a leap) and sp.set_intent for the facing: `body.fwd` and `body.side`
  //                                                     (hips' heights a second), the creature faces where it faced;
  //   the legs                                          sp.foot(c, leg, { cov, x, y, z }) and sp.knee(c, leg, { cov, angle }): a foot goal in LEG LENGTHS from the hip as the gait has it (x out, y up, -1 straight down, z forward) as far as the
  //                                                     track `own` and the fade say (0: the gait's foot), the knee's bend plane turned by `pole`. leg_l / leg_r are the legs of a biped, the hind legs of a quadruped (the rear pair of
  //                                                     six), legf_l / legf_r the fore legs (the front pair); the middle pair of six goes where the other two pairs' average is when the action names both (else the gait's). A leg the action
  //                                                     does not name stays the gait's. The worker lets a foot go after 30 frames that it was not said: it is said again every 12;
  //   an air phase (`air: true`)                        is the BODY's: at its start the body is launched (sp.jump) to `height` (metres; the spec's, in proportion to the creature's size: it is a person's), the phase is as far through as the height says (0 at the launch, 1/2 at the top, 1 at
  //                                                     the touchdown: the same at any height), and the next phase begins when the worker tells it came down (sp.landings); a creature that cannot jump (no gravity) plays it by the clock;
  //   the head's look                                   `look` turns the neck and the head to the target (the number says how much);
  //   the events                                        `emit` tags are told to the listener, `impulse` pushes the body (sp.push, sp.jump for an `up`); `hit`, `show`, `hide` and `mount` need what system has not (physics, props): they are
  //                                                     accepted by the spec and skipped here, and said (run.skipped, rt.capabilities(sp).events). A `hit` is told as an emit `hit` (value: its limb's index in the player's LIMBS) and, `win` seconds
  //                                                     later, `hit_end`; the damage and the reach are still skipped. A learned action's `pw` emits are told times the power, its wait points stop the clock (rt.release, rt.waiting: action_player.js).
  // What a creature lacks is skipped (a role it has not, a tail, a jaw, a leg it has not): `capabilities(sp)` says which groups of tracks it can play, `run.skipped` which tracks were left out.
  // Cost: a command (12 words) for every role bone that changed and one for each hand that moved, only for an ACTING creature, and nothing for the others; commands that did not change are not sent. A frame that finds the page's
  // queue of commands full (system.queued_words() over `queue_limit`) goes on with the next run in turn the next frame (nobody starves).
  //
  //   const rt = create(system, { player, engine?, queue_limit? })      player: action_player.js; engine: when given, the runtime updates itself once a frame before the engine draws (the engine's own time)
  //   rt.start(sp, c, spec, { power, speed, mirror, height, target, props, on_event }) -> run      one run an instance: another action on it replaces the one that was on      target: [x, y, z] | function () -> [x, y, z] | { sp, c, height }
  //   rt.stop(run)  fade out and let go     rt.end(run)  let go at once     rt.hold(run, tau | null)  freeze at a time of the action     rt.set_spec(run, spec)  replace the spec of a run that is going      rt.set(run, { power, speed, mirror, height, target })
  //   rt.update(dt)  one frame (when no engine is given)     rt.capabilities(sp) -> { hips, hips_move, spine, chest, neck, head, jaw, tail, arm_l, arm_r, leg_*, body, look, props, events }     rt.runs      rt.stats
  //   run: { sp, c, spec, C, st (the pure state), o, skipped: { tracks: [ids], events: [types] }, done, how }      rt.on_event(e): { type: "emit" | "end" | "skipped", run, tag, value, how }
  const DEG = Math.PI / 180;
  const now = typeof performance !== "undefined" && performance.now ? function () { return performance.now(); } : function () { return Date.now(); };
  const ROT_GROUPS = ["hips", "spine", "chest", "neck", "head"], ROT_GROUPS_ALL = ROT_GROUPS.concat(["tail"]);          // (the tail turns as the others do: yaw, pitch, roll shared by its bones)
  const MAX_ANGLE = 1.99, EPS_A = 2e-4, EPS_M = 1e-4, EPS_T = 3e-4, EPS_W = 4e-3;

  function create(system, opt) {
    opt = opt || {};
    const P = opt.player;
    if (!P || typeof P.step !== "function") throw new Error("happy_action_runtime: create(system, { player }): the player of action_player.js is needed");
    const runs = [], plans = new Map();
    const rt = { runs: runs, on_event: null, queue_limit: opt.queue_limit > 0 ? opt.queue_limit : 2400, stats: { frames: 0, runs: 0, commands: 0, words: 0, ms: 0, ms_max: 0, deferred: 0 }, engine: opt.engine || null };
    let cursor = 0, attached = false;
    const S = rt.stats;

    // ---- what a creature can play: the bones of its roles, its arms, its body (a plan, made once for a species) ----
    function plan_of(sp) {
      let pl = plans.get(sp);
      if (pl) return pl;
      const L = sp.life, sk = sp.sk;
      const bone_of_slot = function (k) { return k >= 0 && L && L.bones[k] !== undefined ? L.bones[k] : -1; };
      pl = { sp: sp, bones: { hips: [], spine: [], chest: [], neck: [], head: [], tail: [], jaw: [] }, jaw_max: [], arm: { l: null, r: null }, body: !!sp.body, hh: 1, hips_moves: false, groups: {}, legs: { leg_l: [], leg_r: [], legf_l: [], legf_r: [], mid_l: [], mid_r: [] } };
      if (L && L.words) {
        const R = L.roles;
        if (R.hips >= 0) pl.bones.hips.push(bone_of_slot(R.hips));
        (R.spine || []).forEach(function (k) { pl.bones.spine.push(bone_of_slot(k)); });
        if (R.chest >= 0) pl.bones.chest.push(bone_of_slot(R.chest));
        (R.neck || []).forEach(function (k) { pl.bones.neck.push(bone_of_slot(k)); });
        if (R.head >= 0) pl.bones.head.push(bone_of_slot(R.head));
        // the tail (a chain down from the body: its angles are shared between its bones, as the spine's) and the jaw (each jaw bone opens by the track's angle, held to 1.2 of its own opening: body.js jaw_max)
        (R.tail || []).forEach(function (k) { const b = bone_of_slot(k); if (b >= 0) pl.bones.tail.push(b); });
        (R.jaw || []).forEach(function (k, j) { const b = bone_of_slot(k); if (b >= 0) { pl.bones.jaw.push(b); pl.jaw_max.push(L.jaw_max && L.jaw_max[j] > 0 ? L.jaw_max[j] : 30 * DEG); } });
        pl.hips_moves = pl.bones.hips.length > 0 && !!L.moves[sk.names[pl.bones.hips[0]]];
        L.arms.forEach(function (a, j) { const key = a.side > 0 ? "l" : "r"; if (!pl.arm[key]) { const sh = sk.index[a.shoulder], up = []; for (let b = sk.parent[sh]; b >= 0; b = sk.parent[b]) up.push(b); pl.arm[key] = { name: a.name, j: j, chain: sp.chain_index[a.name], side: a.side, length: a.length, shoulder: sh, rest: a.rest, up: up }; } });
      }
      const hb = pl.bones.hips.length ? pl.bones.hips[0] : 0;
      pl.hh = Math.max(0.05, sk.head[hb * 3 + 1]);                                       // the hips' height at the bind pose: the unit of the hips' moves and of the body's speed
      const g = pl.groups;
      ROT_GROUPS.forEach(function (k) { g[k] = pl.bones[k].length > 0; });
      g.hips_move = pl.hips_moves; g.jaw = pl.bones.jaw.length > 0; g.tail = pl.bones.tail.length > 0;
      g.arm_l = !!pl.arm.l; g.arm_r = !!pl.arm.r;
      if (sp.legs && sp.legs.script) {                                                    // the legs by where along the body their hips are: the hind (or only) rank is leg_*, the front rank legf_*, the ranks between follow their average
        const per = sp.legs.legs, lay = system.leg_layout({ side: per.map(function (p) { return p.side; }), along: per.map(function (p) { return p.hip[2]; }), length: per.map(function (p) { return p.length; }) });
        per.forEach(function (p, k) { const key = p.side > 0 ? "l" : "r", nm = lay.name[k]; pl.legs[(nm === "f" ? "legf_" : (nm === "m" ? "mid_" : "leg_")) + key].push(k); });
        // where each foot stands when the creature stands, in leg lengths from its hip as the gait has it (x to the left, y up, z forward): the spec's numbers are the donor's, a person's (the foot at rest is at 0.08, -0.98,
        // -0.03), and are taken as a change from THAT rest: the foot goes where its own rest place is moved by the spec's number less the spec's rest, so a creature whose feet stand wide (a spider), far forward or under it
        // (a hound) keeps its stance when the action says "at rest", and a jump that lands does not leave a person's feet 7 cm wider than its hips
        const gn = sp.legs.gaits[0].numbers, hips_y = sp.legs.hips_y;
        pl.legrest = per.map(function (p) { return [(p.end[0] * gn.stance - p.hip[0]) / p.length, -(gn.ride + p.hip[1] - hips_y - p.foot_h) / p.length, (p.end[2] - p.hip[2]) / p.length]; });
      }
      g.leg_l = pl.legs.leg_l.length > 0; g.leg_r = pl.legs.leg_r.length > 0; g.legf_l = pl.legs.legf_l.length > 0; g.legf_r = pl.legs.legf_r.length > 0;
      g.air = !!(sp.body && sp.body.gravity > 0);                                         // (a body with a gravity can be launched and told when it lands)
      g.wings = !!(sp.wings && sp.wings.wings && sp.wings.wings.length);                  // (a species with `wings`: the worker's WINGS model, sp.set_wings)
      pl.wing_amp = g.wings && sp.wings.amplitude > 0 ? sp.wings.amplitude : 32;          // (degrees: the species' own beat, what an amplitude of 1 is: body.js)
      g.body = pl.body; g.look = g.head || g.neck;
      plans.set(sp, pl);
      return pl;
    }
    rt.plan = plan_of;
    rt.capabilities = function (sp) {
      const g = plan_of(sp).groups;
      return { hips: g.hips, hips_move: g.hips_move, spine: g.spine, chest: g.chest, neck: g.neck, head: g.head, jaw: g.jaw, tail: g.tail, wings: g.wings, arm_l: g.arm_l, arm_r: g.arm_r, leg_l: g.leg_l, leg_r: g.leg_r, legf_l: g.legf_l, legf_r: g.legf_r, body: g.body, look: g.look, air: g.air, props: [], mounts: {}, points: {}, events: g.body ? ["emit", "impulse"] : ["emit"] };
    };

    // ---- a run ----
    const alive = function (run) { const sp = run.sp, c = run.c; return !!c && c.slot >= 0 && sp.alive[c.slot] === 1 && sp.gen[c.slot] === c.gen; };
    function new_run(sp, c, spec, o) {
      const pl = plan_of(sp), run = { sp: sp, c: c, plan: pl, spec: spec, C: P.compile(spec), st: P.make_state(), o: { power: 1, speed: 1, mirror: false, target: null, props: {}, height: null, pin: -1 }, done: false, how: "", on_event: null,
        acc: new Map(), sent_bone: new Map(), sent_arm: { l: null, r: null }, sent_leg: new Map(), sent_knee: new Map(), air: null, frame: 0, used_body: false, skipped: { tracks: [], events: [] }, emitted: 0, started: now() };
      if (o) Object.keys(o).forEach(function (k) { if (k === "on_event") run.on_event = o[k]; else if (k in run.o) run.o[k] = o[k]; });
      work_out_skips(run);
      return run;
    }
    // the tracks the creature cannot play, and the events nothing plays: said once, when the spec is set
    function work_out_skips(run) {
      const g = run.plan.groups, tr = [], ev = [], seen = {};
      run.spec.tracks.forEach(function (t) { const c = P.COMP[P.COMP_INDEX[t.c]]; if (c && !g[c.group]) tr.push(t.c); });
      run.spec.events.forEach(function (e) { if (e.type !== "emit" && !(e.type === "impulse" && run.plan.body) && !seen[e.type]) { seen[e.type] = 1; ev.push(e.type); } });
      run.skipped.tracks = tr; run.skipped.events = ev;
    }
    rt.start = function (sp, c, spec, o) {
      if (!sp.alive || !c || c.slot < 0 || !sp.alive[c.slot]) throw new Error("happy_action_runtime: start: not a live instance");
      for (let i = runs.length - 1; i >= 0; i--) if (runs[i].c === c && runs[i].sp === sp) finish(runs[i], "replaced");
      const run = new_run(sp, c, spec, o);
      runs.push(run);
      S.runs = runs.length;
      return run;
    };
    rt.set = function (run, o) { Object.keys(o || {}).forEach(function (k) { if (k in run.o) run.o[k] = o[k]; }); return run; };
    rt.set_spec = function (run, spec) { run.spec = spec; run.C = P.compile(spec); work_out_skips(run); return run; };
    rt.hold = function (run, tau) { P.hold(run.st, tau); return run; };
    rt.stop = function (run) { if (!run.done) P.stop(run.st); return run; };
    rt.end = function (run) { if (!run.done) finish(run, "stopped"); return run; };
    // the states of a learned action (action_player.js: waits): release lets the clock go on from the wait point it stands at; waiting(run) is the TAG of that wait (a string) or null; tau(run) the seconds along the phases,
    // phase(run) the index of the phase it is in and phase_name(run) its name
    rt.release = function (run) { if (!run.done) P.release(run.st); return run; };
    rt.waiting = function (run) { return run.st.wait >= 0 && !run.done ? run.C.waits[run.st.wait].tag : null; };
    rt.tau = function (run) { return run.st.tau; };
    rt.phase = function (run) { return P.phase_at(run.C, run.st.tau); };
    rt.phase_name = function (run) { const ph = run.spec.phases; return ph[Math.min(ph.length - 1, P.phase_at(run.C, run.st.tau))].name; };
    rt.phase_base = function (run) { return P.phase_base(rt.phase_name(run)); };          // (windup3 is `windup`: the name the worker tells the AI by)

    // ---- the page's words ----
    const acc_of = function (run, bone) { let a = run.acc.get(bone); if (!a) { a = new Float64Array(6); run.acc.set(bone, a); } return a; };
    function root_of(run) { const m = run.sp.mirror, o = run.c.slot * 8; return m.subarray(o, o + 8); }
    function heading_of(r) { const fx = 2 * (r[4] * r[6] + r[7] * r[5]), fz = 1 - 2 * (r[4] * r[4] + r[5] * r[5]), l = Math.hypot(fx, fz) || 1; return [fx / l, fz / l]; }
    function target_of(run) {
      let t = run.o.target;
      if (typeof t === "function") t = t();
      if (!t) return null;
      if (Array.isArray(t)) return t;
      if (t.sp && t.c) {                                                                  // an instance: its hips' height above its feet (a place at the height of a head)
        if (!t.sp.alive[t.c.slot]) return null;
        const m = t.sp.mirror, o = t.c.slot * 8;
        return [m[o], m[o + 1] + (t.height === undefined ? 1.8 * plan_of(t.sp).hh : t.height) * m[o + 3], m[o + 2]];
      }
      return null;
    }
    function say(run, e) { e.run = run; if (run.on_event) run.on_event(e); if (rt.on_event) rt.on_event(e); }
    function send_bone(run, bone, v) {
      const sent = run.sent_bone.get(bone);
      let same = !!sent;
      if (same) for (let i = 0; i < 6; i++) if (Math.abs(sent[i] - v[i]) > (i < 3 ? EPS_A : EPS_M)) { same = false; break; }
      if (same) return 0;
      const o = { yaw: Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, v[0])), pitch: Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, v[1])), roll: Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, v[2])), x: v[3], y: v[4], z: v[5] };
      run.sp.role_pose(run.c, bone, o);
      if (!sent) run.sent_bone.set(bone, new Float64Array(6));
      run.sent_bone.get(bone).set(v);
      return 1;
    }
    // THE HANDS. An action says a hand in ARM LENGTHS from the shoulder in the BODY's frame (forward is where the creature faces whatever its trunk does: a punch goes forward while the trunk turns). The life solves the arm
    // (body.cpp, CMD_HAPPY_HAND): in closed form, held to its joints, with nothing of the spine in it (the rig's FABRIK tree took the spine along to reach a goal, and the chest leaned 6 to 37 degrees for the same pose).
    // The numbers go to the worker as they are, `body: true`: the life turns them back by the turn of the bones above the arm as that update has them (the trunk the action asks for, and the breath, the sway and the gait's
    // coupling on top of it), so the hand keeps the offset from its shoulder that the numbers say, wherever the trunk puts the shoulder. A spec of `frame: "chest"` says its hands in the chest's own frame: they go as they are.
    // The elbow's pole is the chain's own, turned about the line from the shoulder to the hand by the spec's `pole` (+ out)
    function send_hand(run, key, x, y, z, pole, weight) {
      const arm = run.plan.arm[key], sp = run.sp, c = run.c;
      const d = [arm.side * x, y, z];                                                       // (x OUT to the side the arm is on is x to the left for the left arm, to the right for the other)
      const last = run.sent_arm[key];
      if (last && Math.abs(last[0] - d[0]) < EPS_T && Math.abs(last[1] - d[1]) < EPS_T && Math.abs(last[2] - d[2]) < EPS_T && Math.abs(last[3] - weight) < EPS_W && Math.abs(last[4] - pole) < 2e-3 && run.frame - last[5] < LEG_REFRESH) { last[6] = run.frame; return 0; }
      const o = { x: d[0], y: d[1], z: d[2], w: weight, body: run.C.frame !== "chest" };
      if (pole !== 0 || (last && last[4] !== 0)) { o.pole = pole * DEG; o.pole_w = pole !== 0 ? 1 : 0; }
      sp.hand(c, arm.j, o);
      run.sent_arm[key] = [d[0], d[1], d[2], weight, pole, run.frame, run.frame];
      return 1;
    }
    // ---- the feet and the knees: a goal in leg lengths from the hip as the gait has it; the worker holds a goal 30 frames unless it is said again, so a goal that has not changed is said again every LEG_REFRESH frames ----
    const LEG_NEU = [P.NEU[P.COMP_INDEX["leg_l.x"]], P.NEU[P.COMP_INDEX["leg_l.y"]], P.NEU[P.COMP_INDEX["leg_l.z"]]];                      // (the spec's rest place of a foot: out, up, forward)
    const LEG_EPS = 1.5e-3, LEG_REFRESH = 12, CLAMP01 = function (x) { return x < 0 ? 0 : (x > 1 ? 1 : x); };
    function send_foot(run, k, cov, x_left, y, z) {
      const last = run.sent_leg.get(k);
      if (last && Math.abs(last[0] - cov) < EPS_W && Math.abs(last[1] - x_left) < LEG_EPS && Math.abs(last[2] - y) < LEG_EPS && Math.abs(last[3] - z) < LEG_EPS && run.frame - last[4] < LEG_REFRESH) { last[5] = run.frame; return 0; }
      run.sp.foot(run.c, k, { cov: cov, x: x_left, y: y, z: z });
      run.sent_leg.set(k, [cov, x_left, y, z, run.frame, run.frame]);
      return 1;
    }
    function send_knee(run, k, cov, angle) {
      const last = run.sent_knee.get(k);
      if (last && Math.abs(last[0] - cov) < EPS_W && Math.abs(last[1] - angle) < EPS_A && run.frame - last[2] < LEG_REFRESH) { last[3] = run.frame; return 0; }
      run.sp.knee(run.c, k, { cov: cov, angle: angle });
      run.sent_knee.set(k, [cov, angle, run.frame, run.frame]);
      return 1;
    }
    // the legs the action did not say this frame (its track ended, the spec was edited, a fade is over) go back to the gait
    function release_legs(run, all) {
      let n = 0;
      run.sent_leg.forEach(function (v, k) { if (all || v[5] !== run.frame) { run.sp.foot(run.c, k, { cov: 0, x: 0, y: -1, z: 0 }); run.sent_leg.delete(k); n++; } });
      run.sent_knee.forEach(function (v, k) { if (all || v[3] !== run.frame) { run.sp.knee(run.c, k, { cov: 0, angle: 0 }); run.sent_knee.delete(k); n++; } });
      return n;
    }

    // ---- the air phase: the BODY plays it. The clock waits at its start, the body is launched to the height the spec says, and the phase is as far through as the body's height says (the flight is a parabola: y / H = 4 u (1 - u),
    //      u the share of the flight, so u = (1 - sqrt(1 - y / H)) / 2 on the way up and (1 + sqrt(1 - y / H)) / 2 on the way down, whatever the height and the gravity); when the worker says the body is down the clock goes on from the
    //      phase's end. run.air: { s: 0 waiting for the launch, 1 in the flight, 2 landed, ... }. air_pin gives the time of the action the clock is to be set to (-1: the clock goes on by itself) ----
    function root_y(run) { return run.sp.mirror[run.c.slot * 8 + 1]; }
    function air_pin(run, dt) {
      const C = run.C, st = run.st, pl = run.plan;
      if (C.air < 0 || !pl.groups.air || st.hold_at >= 0 || st.stopping || st.done) return -1;
      const A = C.start[C.air], B = A + (C.air_span > 0 ? C.air_span : C.dur[C.air]), sp = run.sp, c = run.c;          // (the flight: the air phase and the ones right after it, one run)
      let a = run.air;
      if (!a) a = run.air = { s: 0 };
      if (a.s === 0) {
        const speed = run.o.speed > 0 ? Math.max(0.2, Math.min(4, +run.o.speed)) : 1;
        if (st.ts + dt * speed < A) return -1;
        // the height: the number the page gave (metres), else the spec's `height`, which is the jump of a creature as tall as a person (hips 0.95 m): a smaller or a larger one jumps in proportion to its own size
        const given = run.o.height > 0, base = given ? +run.o.height : (run.spec.height > 0 ? +run.spec.height : 1.1);
        const h = Math.max(0.05, Math.min(30, given ? base : base * pl.hh * root_of(run)[3] / 0.95)), g = sp.body.gravity;
        a.s = 1; a.h = h; a.v0 = Math.sqrt(2 * g * h); a.T = 2 * a.v0 / g; a.y0 = root_y(run); a.ymax = 0; a.up = true; a.u = 0; a.t = 0; a.n0 = sp.landings(c); a.seen_up = false;
        sp.jump(c, a.v0);
        say(run, { type: "emit", tag: "jumped", value: h });
        return A;
      }
      if (a.s === 1) {
        a.t += dt;
        const dy = root_y(run) - a.y0;
        if (dy > a.ymax) a.ymax = dy; else if (a.ymax - dy > 0.004 * a.h + 0.002) a.up = false;
        if (dy > 0.02 * a.h) a.seen_up = true;
        const r = Math.sqrt(Math.max(0, 1 - Math.min(1, Math.max(0, dy) / a.h)));
        let u = a.up ? 0.5 * (1 - r) : 0.5 * (1 + r);
        if (u < a.u) u = a.u;
        a.u = u;
        const down = sp.landings(c) > a.n0 && (a.seen_up || a.t > 0.5), late = a.t > 2 * a.T + 0.8;                // (the worker said it came down; or it never will: the clock goes on)
        if (down || late) { a.s = 2; say(run, { type: "emit", tag: "landed", value: sp.landing_speed(c) }); return B; }
        return A + u * (B - A);
      }
      return -1;
    }

    // an impulse event: the body's speed changes by `speed` hips' heights a second along `dir` (and `up` upward: a launch when it stands on the floor), times the power
    function impulse(run, e) {
      const sp = run.sp, c = run.c, pl = run.plan, r = root_of(run), f = heading_of(r), k = pl.hh * r[3] * run.o.power;
      let d = e.dir || "fwd";
      if (run.o.mirror && (d === "left" || d === "right")) d = d === "left" ? "right" : "left";
      let x = f[0], z = f[1];
      if (d === "back") { x = -f[0]; z = -f[1]; }
      else if (d === "left") { x = f[1]; z = -f[0]; }
      else if (d === "right") { x = -f[1]; z = f[0]; }
      else if (d === "target") { const tg = target_of(run); if (tg) { const dx = tg[0] - r[0], dz = tg[2] - r[2], l = Math.hypot(dx, dz); if (l > 1e-6) { x = dx / l; z = dz / l; } } }
      sp.push(c, x * e.speed * k, z * e.speed * k, e.up * k);
      if (e.up > 0 && pl.groups.air) sp.jump(c, e.up * k);
    }

    // one frame of one run: the pure step, then the words
    function frame_of(run, dt) {
      const sp = run.sp, c = run.c, pl = run.plan, st = run.st, D = P.COMP_INDEX, V = st.V, H = st.H;
      run.frame++;
      run.o.pin = air_pin(run, dt);
      P.step(run.C, st, dt, run.o);
      const w = st.weight;
      let n = 0;
      const g = function (id) { const i = D[id]; return H[i] ? V[i] : P.NEU[i]; };
      // the role bones: the angles of a group are shared between its bones
      run.acc.forEach(function (a) { a.fill(0); });
      const yaw_sum = { trunk: 0, neck: 0 };
      ROT_GROUPS_ALL.forEach(function (grp) {
        const iy = D[grp + ".yaw"], ip = D[grp + ".pitch"], ir = D[grp + ".roll"];
        if (!(H[iy] || H[ip] || H[ir]) || !pl.groups[grp]) return;
        const bones = pl.bones[grp], k = bones.length, yaw = g(grp + ".yaw") * DEG * w, pitch = -g(grp + ".pitch") * DEG * w, roll = g(grp + ".roll") * DEG * w;          // (the spec's pitch is UP; role_pose's is forward)
        for (let b = 0; b < k; b++) { const a = acc_of(run, bones[b]); a[0] += yaw / k; a[1] += pitch / k; a[2] += roll / k; }
        if (grp === "hips" || grp === "spine" || grp === "chest") yaw_sum.trunk += yaw; else if (grp === "neck") yaw_sum.neck += yaw;
      });
      // the jaw: every jaw bone opens DOWN by the track's angle (a positive pitch of its role, as the face's own opening), held to 1.2 of how far that bone opens (the face channel's ceiling: a person's 22 degrees, not a crocodile's 60)
      if (pl.groups.jaw && H[D["jaw.open"]]) {
        const open = Math.max(0, g("jaw.open")) * DEG;
        for (let j = 0; j < pl.bones.jaw.length; j++) { const a = acc_of(run, pl.bones.jaw[j]); a[1] += Math.min(open, 1.2 * pl.jaw_max[j]) * w; }
      }
      if (pl.groups.hips_move && (H[D["hips.x"]] || H[D["hips.y"]] || H[D["hips.z"]])) {
        const a = acc_of(run, pl.bones.hips[0]), hh = pl.hh;
        a[3] += g("hips.x") * hh * w; a[4] += g("hips.y") * hh * w; a[5] += g("hips.z") * hh * w;
      }
      // the look: the neck and the head turn to the target, as much as the number says (the trunk's own turn taken off)
      if (pl.groups.look && H[D.look] && V[D.look] > 0.02) {
        const tg = target_of(run), hb = pl.bones.head.length ? pl.bones.head[0] : pl.bones.neck[0];
        if (tg && w > 0.001) {
          const hp = sp.bone_world(c, hb), r = root_of(run), f = heading_of(r), dx = tg[0] - hp[0], dy = tg[1] - hp[1], dz = tg[2] - hp[2];
          const fwd = dx * f[0] + dz * f[1], left = dx * f[1] - dz * f[0], flat = Math.hypot(fwd, left);
          const k = Math.min(1, V[D.look]) * w;
          const yaw = Math.max(-1.3, Math.min(1.3, Math.atan2(left, fwd))), up = Math.max(-0.8, Math.min(0.8, Math.atan2(dy, flat)));
          const want_y = (yaw - yaw_sum.trunk - yaw_sum.neck) * k, want_p = -up * k;
          const nk = pl.bones.neck.length, share = nk && pl.bones.head.length ? 0.4 : (nk ? 1 : 0);
          if (nk && share > 0) pl.bones.neck.forEach(function (b) { const a = acc_of(run, b); a[0] += want_y * share / nk; a[1] += want_p * share / nk; });
          if (pl.bones.head.length) { const a = acc_of(run, pl.bones.head[0]); a[0] += want_y * (1 - share); a[1] += want_p * (1 - share); }
        }
      }
      run.acc.forEach(function (a, bone) { n += send_bone(run, bone, a); });
      // the hands
      ["l", "r"].forEach(function (key) {
        const x = D["arm_" + key + ".x"], y = D["arm_" + key + ".y"], z = D["arm_" + key + ".z"], po = D["arm_" + key + ".pole"];
        if (!(H[x] || H[y] || H[z]) || !pl.arm[key]) return;
        if (w < 0.0005 && !run.sent_arm[key]) return;
        n += send_hand(run, key, g("arm_" + key + ".x"), g("arm_" + key + ".y"), g("arm_" + key + ".z"), H[po] ? V[po] : 0, w);
      });
      // the legs: a foot goal for the legs of every group the action has a track for (leg_l / leg_r the legs of a biped or the hind legs, legf_l / legf_r the fore legs, the middle pair of six at the average of the two
      // when both are said), the knee's bend plane, and the legs it said before and does not say now go back to the gait
      if (pl.groups.leg_l || pl.groups.leg_r || pl.groups.legf_l || pl.groups.legf_r) {
        const place = {}, put = function (k, key, cov, x, y, z) { const r = pl.legrest[k]; return send_foot(run, k, cov, r[0] + (key === "l" ? 1 : -1) * (x - LEG_NEU[0]), r[1] + y - LEG_NEU[1], r[2] + z - LEG_NEU[2]); };
        ["leg", "legf"].forEach(function (kind) {
          ["l", "r"].forEach(function (key) {
            const id = kind + "_" + key, legs = pl.legs[id];
            if (!legs.length) return;
            const ix = D[id + ".x"], iy = D[id + ".y"], iz = D[id + ".z"], io = D[id + ".own"], ip = D[id + ".pole"];
            if (H[ix] || H[iy] || H[iz] || H[io]) {
              const cov = CLAMP01(H[io] ? V[io] : 1) * w, x = g(id + ".x"), y = g(id + ".y"), z = g(id + ".z");
              place[id] = [cov, x, y, z];
              if (cov > 0.001) for (let j = 0; j < legs.length; j++) n += put(legs[j], key, cov, x, y, z);
            }
            if (H[ip] && w > 0.001) for (let j = 0; j < legs.length; j++) n += send_knee(run, legs[j], w, V[ip] * DEG);
          });
        });
        ["l", "r"].forEach(function (key) {                                                // the middle pair of a creature with three ranks of legs: where the average of the hind and the front pair would have it
          const mid = pl.legs["mid_" + key], a = place["leg_" + key], b = place["legf_" + key];
          if (!mid.length || !a || !b || a[0] + b[0] <= 0.002) return;
          const cov = 0.5 * (a[0] + b[0]), ia = a[0] / (a[0] + b[0]), ib = 1 - ia;
          if (cov > 0.001) for (let j = 0; j < mid.length; j++) n += put(mid[j], key, cov, a[1] * ia + b[1] * ib, a[2] * ia + b[2] * ib, a[3] * ia + b[3] * ib);
        });
        n += release_legs(run, false);
      }
      // the body's speed: the body goes at the speed of the track (sp.drive: no acceleration or top speed in the way), facing where it faced
      if (pl.body && (H[D["body.fwd"]] || H[D["body.side"]])) {
        const r = root_of(run), f = heading_of(r), sc = pl.hh * r[3] * (st.ending || st.settled || st.hold_at >= 0 ? 0 : w), fv = g("body.fwd") * sc, lv = g("body.side") * sc;
        sp.set_intent(c, 0, 0, f[0], f[1]);
        sp.drive(c, fv * f[0] + lv * f[1], fv * f[1] - lv * f[0]);
        run.used_body = true; n++;
      }
      // the wings: the action has them by hand (sp.set_wings: the worker's model beats them) while its tracks say so, eased in and out by the fade from where the automatic animation holds them (folded on the ground, spread in
      // the air); the beat in degrees of the tip's lift made a multiple of the species' own amplitude (0 .. 3); the same numbers again send nothing (set_wings keeps the last)
      if (pl.groups.wings && (H[D["wings.fold"]] || H[D["wings.hz"]] || H[D["wings.amp"]])) {
        const base = c.flying ? 0 : 1, fold = H[D["wings.fold"]] ? V[D["wings.fold"]] : base, k = st.ending || st.done ? 0 : w;
        const amp = Math.max(0, Math.min(3, (H[D["wings.amp"]] ? V[D["wings.amp"]] : pl.wing_amp) / pl.wing_amp * k));
        const q = function (x, s) { return Math.round(x * s) / s; };                     // (rounded: a fold that creeps by a ten-thousandth a frame is no new command)
        sp.set_wings(c, { fold: q(Math.max(0, Math.min(1, base + (fold - base) * k)), 500), hz: q(Math.max(0, Math.min(50, H[D["wings.hz"]] ? V[D["wings.hz"]] : 0)), 100), amplitude: q(amp, 500) });
        run.used_wings = true; n++;
      }
      // the events: a tag is told, the others are skipped (and said, once)
      for (let i = 0; i < st.fire.length; i++) {
        const e = st.fire[i];
        if (e.kind === "emit") { run.emitted++; say(run, { type: "emit", tag: e.tag, value: e.pw ? e.v * st.power : e.v }); }          // (`pw`: the value is as big as the power the action was asked for)
        else if (e.kind === "impulse" && pl.body) impulse(run, e);
        else if (e.kind === "hit") { run.emitted++; say(run, { type: "emit", tag: "hit", value: e.v }); if (!run.said_hit) { run.said_hit = true; say(run, { type: "skipped", kind: "hit", tag: "hit" }); } }          // (told as `hit`, value the limb's index in LIMBS, and `hit_end` later: the damage and the reach are for whoever tests where the limb is; nothing here does)
        else if (run.skipped.events.indexOf(e.kind) >= 0 && !run["said_" + e.kind]) { run["said_" + e.kind] = true; say(run, { type: "skipped", kind: e.kind, tag: e.kind }); }
      }
      return n;
    }
    // the run is over (it faded out, was stopped, or was replaced): everything it said is let go
    function finish(run, how) {
      if (run.done) return;
      run.done = true; run.how = how;
      const i = runs.indexOf(run);
      if (i >= 0) { runs.splice(i, 1); if (cursor > i) cursor--; }
      S.runs = runs.length;
      if (alive(run)) {
        const sp = run.sp, c = run.c;
        try {
          run.sent_bone.forEach(function (v, bone) { sp.role_pose(c, bone); });
          ["l", "r"].forEach(function (key) { if (run.sent_arm[key] && run.sent_arm[key][3] > 0) sp.hand(c, run.plan.arm[key].j, { w: 0 }); });          // (a hand that the fade has let go of already is not said again)
          release_legs(run, true);
          if (run.used_body) { sp.drive(c, null); sp.set_intent(c, 0, 0, 0, 0); }
          if (run.used_wings) sp.set_wings(c, null);                                      // (the wings back to the automatic animation)
        } catch (e) { /* the instance went while it was finished */ }
      }
      run.sent_bone.clear(); run.sent_arm.l = run.sent_arm.r = null;
      say(run, { type: "end", how: how });
    }

    // ---- once a frame ----
    // The runs go in turn from the one that was put off last (a full queue of commands puts the rest off to the next frame: their clocks do not stop, they step with the time they missed).
    const queued = function () { return system.queued_words ? system.queued_words() : 0; };
    rt.update = function (dt) {
      const t0 = now();
      S.frames++;
      if (!runs.length) { S.commands = 0; S.words = 0; cursor = 0; return; }
      const q0 = queued(), order = cursor > 0 ? runs.slice(cursor).concat(runs.slice(0, cursor)) : runs.slice();
      let cmds = 0, i = 0, next = null;
      for (; i < order.length; i++) {
        const run = order[i];
        if (run.done) continue;
        if (!alive(run)) { finish(run, "gone"); continue; }
        if (queued() > rt.queue_limit) { next = run; break; }
        const r_dt = dt + (run.carry || 0);
        run.carry = 0;
        cmds += frame_of(run, r_dt);
        if (run.st.done) finish(run, run.st.stopping ? "stopped" : "finished");
      }
      if (next) {
        S.deferred++;
        for (let j = i; j < order.length; j++) if (!order[j].done) order[j].carry = (order[j].carry || 0) + dt;
        cursor = Math.max(0, runs.indexOf(next));
      } else cursor = 0;
      S.commands = cmds; S.words = queued() - q0;
      const ms = now() - t0;
      S.ms = S.ms === 0 ? ms : S.ms * 0.9 + ms * 0.1; if (ms > S.ms_max) S.ms_max = ms;
    };
    rt.attach = function (engine) {
      if (attached || !engine || !engine.on_frame_begin) return rt;
      attached = true; rt.engine = engine;
      engine.on_frame_begin.add(function () { if (attached) rt.update(Math.min(0.1, engine.time_delta || 0)); });
      return rt;
    };
    rt.detach = function () { attached = false; return rt; };
    rt.reset_stats = function () { S.frames = 0; S.commands = 0; S.words = 0; S.ms = 0; S.ms_max = 0; S.deferred = 0; };
    if (opt.engine) rt.attach(opt.engine);
    return rt;
  }
  return { create: create };
});

// ========================================================================================================================
// action_spec
// ========================================================================================================================
packing()("happy_action_spec", function happy_action_spec() {
  "use strict";
  // HAPPY ACTION SPEC: the arithmetic of the action designer (happy_action_designer.js, SYSTEM.md "The action designer"): what a designed action IS, checked, edited, drawn and kept. A designed action is DATA (plain JSON) that the player
  // (action_player.js: the pure part, action_runtime.js: the page's commands) plays on any creature that has the roles it names:
  //   { name, title, kind ("attack" | "movement" | "gesture" | "reaction"), description, priority (-100 .. 100), fade: [in, out] seconds, end ("once" | "hold"), frame ("body": the hands' numbers are in the creature's own frame, forward is
  //     where it faces whatever its trunk does | "chest": in the chest's, as a recorded motion's are), height (metres: the jump of an air phase), params: [the kinds of the numbers
  //     the page gives, in order: "target" "power" "speed" "height" "mirror"],
  //     phases: [{ name, t (seconds), ease, air (the BODY plays it: the jump's flight) }],
  //     tracks: [{ c: "arm_r.z", v: [the value at the start and at the end of every phase], e: [an ease for a phase that is not the phase's own], h: [a hump over each phase: added as sin(pi u), 0 at both ends], lag (seconds), amp (how much of it),
  //       pw (0: power does not scale it), osc: { hz, a, ph, from, to } }],
  //     events: [{ at: [phase name, 0 .. 1], type: "emit" | "impulse" | "hit" | "show" | "hide" | "mount", when ("sword": only a creature that has that prop; "!sword": only one that has not), pw (an emit: its value times the power), ... }],
  //     waits: [{ at: [phase name, 0 .. 1], tag, max }]  (WAIT POINTS: the clock stops there until released or max seconds (0: for ever) have passed; tags `tag` on reaching it and `tag_end` on leaving it; at most 4),
  //     learn: { v, tool, src, cls, eff, tier (1 .. 3), t: { name: seconds }, raw, own, edited, mix: [names], notes: [words] }  (what tools/action_learn.js measured: data for whoever reads the action, nothing plays it) }
  //   Phase names are free identifiers (the tool of learned actions names them windup, strike, recover ...: set_phase renames one and every event and wait that names it follows).
  // The numbers are creature independent (COMPONENTS: degrees, arm lengths, leg lengths, hips' heights ...); a creature that lacks a role skips its tracks. Pure: no DOM, no engine, no file. The CURVES are not computed here: they are the player's
  // own (action_player.js, given to use_player), so that the window draws what the creature is told and the two cannot differ. Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no class.
  //
  //   use_player(the player module) -> the player    player()      COMPONENTS, TARGETS, EASES, KINDS, PARAM_KINDS, EVENT_TYPES, LIMBS, DIRS      component(id)
  //   blank(name, kind) -> a spec      clone(spec)      validate(spec) -> { spec (normalised), errors, warnings }      normal(spec) -> the spec or throws
  //   timeline(spec) -> { starts, ends, total, events }      sample(spec, id, n, o) -> n values of a number over the whole action      values_at(spec, tau, o) -> { id: value } of every track
  //   needs(spec) -> { targets (the groups of tracks), props, uses (the channels), air, hits, tags }      skipped(spec, caps) -> the tracks a creature lacks      skipped_events(spec, caps) -> the events nothing plays yet      (caps: the runtime's capabilities(sp))
  //   describe(spec) -> words      set_phase(spec, i, fields) add_phase(spec, i) remove_phase(spec, i) move_phase(spec, i, t)      set_track(spec, id, values) remove_track(spec, id) add_event(spec, ev) remove_event(spec, i)      editing, the spec stays whole
  //   set_text(set, specs, o) -> the text of a set file (JSON: { format: "happy.actions", name, description, actions: [specs] })      set_read(text) -> { name, description, specs, problems }      tags_of(specs)
  const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
  const KINDS = ["attack", "movement", "locomotion", "gesture", "reaction", "idle", "activity", "social", "dance", "pose"];
  // the packs of the presets (tools/action_tool.js writes them from action_designer/presets*.js: they are not written over and nothing is taken out of them) and the player, which is no set of actions at all
  const PRESET_SETS = ["designed_basic", "designed_life", "designed_dance", "designed_pose"];
  const is_preset_set = function (name) { return name === "designed" || PRESET_SETS.indexOf(name) >= 0; };
  const PARAM_KINDS = ["target", "power", "speed", "height", "mirror"];
  const EVENT_TYPES = ["emit", "impulse", "hit", "show", "hide", "mount"];
  const LIMBS = ["hand_l", "hand_r", "foot_l", "foot_r", "foot_fl", "foot_fr", "weapon", "point"];
  const DIRS = ["fwd", "back", "left", "right", "target"];
  const MAX_PHASES = 16, MAX_TRACKS = 48, MAX_EVENTS = 24, MAX_TOTAL = 20, MAX_WAITS = 4;
  const clamp = function (x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); };
  const num = function (x, d) { return typeof x === "number" && isFinite(x) ? x : d; };
  const round = function (x, n) { const k = Math.pow(10, n === undefined ? 4 : n); return Math.round(x * k) / k; };
  const own = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  // ---- the player (action_player.js, the pure part), and what the page needs of its table of numbers ----
  let P = null;
  function use_player(p) {
    if (!p || typeof p.compile !== "function" || typeof p.step !== "function" || !p.COMP) throw new Error("happy_action_spec: use_player needs the player (action_player.js: compile, step, COMP ...)");
    P = p;
    build_tables();
    return p;
  }
  const player = function () { if (!P) throw new Error("happy_action_spec: use_player(the player of action_player.js) first"); return P; };

  // what the window shows for each number: its words and its steps. `group` is the target a number belongs to
  const GROUP_LABEL = { hips: "hips", spine: "spine", chest: "chest", neck: "neck", head: "head", jaw: "jaw", tail: "tail", hips_move: "hips (moved)", arm_l: "left arm", arm_r: "right arm", leg_l: "left leg", leg_r: "right leg", legf_l: "left front leg", legf_r: "right front leg", body: "body travel", look: "look at the target", wings: "wings" };
  const AXIS_WORD = { yaw: "turn (+ left)", pitch: "bend (+ up, back)", roll: "tilt (+ right)", x: "out", y: "up", z: "forward", grip: "grip", own: "the action's foot", pole: "bend plane (+ out)", open: "open", fwd: "forward", side: "to the left", wobble: "wobble", fold: "folded (0 spread .. 1)", hz: "beats a second", amp: "beat (degrees)" };
  const UNIT_OF = function (c) {
    if (/\.(yaw|pitch|roll|open|pole|amp)$/.test(c.id)) return "deg";
    if (c.id === "wings.hz") return "Hz";
    if (/^hips\.[xyz]$/.test(c.id)) return "hips";
    if (/^arm_/.test(c.id)) return /\.grip$/.test(c.id) ? "" : "arm";
    if (/^leg/.test(c.id)) return /\.own$/.test(c.id) ? "" : "leg";
    if (/^body\./.test(c.id)) return "hips/s";
    return "";
  };
  const STEP_OF = function (c) { return /\.(yaw|pitch|roll|open|pole|amp)$/.test(c.id) ? 1 : (/^body\./.test(c.id) || c.id === "wings.hz" ? 0.1 : (/\.(grip|own|fold)$/.test(c.id) || c.id === "look" ? 0.05 : 0.01)); };
  const COMPONENTS = [], COMP_BY_ID = {}, TARGETS = [];
  const TARGET_ORDER = ["hips", "hips_move", "spine", "chest", "neck", "head", "jaw", "tail", "arm_l", "arm_r", "leg_l", "leg_r", "legf_l", "legf_r", "body", "look", "wings"];
  function build_tables() {
    COMPONENTS.length = 0; TARGETS.length = 0;
    Object.keys(COMP_BY_ID).forEach(function (k) { delete COMP_BY_ID[k]; });
    player().COMP.forEach(function (c) {
      const part = c.id.split(".")[1], o = { id: c.id, group: c.group, axis: part, label: c.id, word: AXIS_WORD[part] || part, neutral: c.neutral, lo: c.lo, hi: c.hi, sign: c.sign, mirror: c.mirror, unit: "", step: 1 };
      o.unit = UNIT_OF(o); o.step = STEP_OF(o);
      if (c.id === "body.side") o.word = "to the left"; if (c.id === "look") o.word = "how much";
      COMPONENTS.push(o); COMP_BY_ID[o.id] = o;
    });
    TARGET_ORDER.forEach(function (k) { const comps = COMPONENTS.filter(function (c) { return c.group === k; }).map(function (c) { return c.id; }); if (comps.length) TARGETS.push({ key: k, label: GROUP_LABEL[k] || k, comps: comps }); });
  }
  const component = function (id) { player(); return COMP_BY_ID[id] || null; };
  const EASES = function () { return player().EASE_LIST.slice(); };

  // ---- a spec made, cloned, checked ----
  function blank(name, kind) {
    return { name: ident(name || "action"), title: "", kind: kind || "attack", description: "", priority: 5, fade: [0.12, 0.2], end: "once", frame: "body", height: 1.1, params: ["target", "power", "speed", "mirror"],
      phases: [{ name: "act", t: 0.5, ease: "smooth", air: false }], tracks: [], events: [] };
  }
  const clone = function (s) { return JSON.parse(JSON.stringify(s)); };
  function ident(s) {
    let t = String(s === undefined || s === null ? "" : s).trim().replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    if (!t) t = "action";
    if (/^[0-9]/.test(t)) t = "a_" + t;
    return t.slice(0, 40);
  }
  const phase_ident = function (s, fallback) { const t = String(s === undefined || s === null ? "" : s).trim().replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24); return t && !/^[0-9]/.test(t) ? t : fallback; };

  // the `learn` object of an action (what a tool measured): only the keys it knows, each made to its kind; null when nothing is left
  function learn_of(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const o = {}, str = function (x, n) { return typeof x === "string" && x ? x.slice(0, n) : null; };
    if (Number.isInteger(raw.v)) o.v = clamp(raw.v, 1, 99);
    [["tool", 40], ["src", 120], ["cls", 24], ["eff", 24]].forEach(function (k) { const s = str(raw[k[0]], k[1]); if (s) o[k[0]] = s; });
    if (Number.isInteger(raw.tier)) o.tier = clamp(raw.tier, 1, 3);
    if (raw.t && typeof raw.t === "object" && !Array.isArray(raw.t)) {
      const t = {};
      Object.keys(raw.t).slice(0, 24).forEach(function (k) { if (IDENT.test(k) && typeof raw.t[k] === "number" && isFinite(raw.t[k])) t[k] = round(raw.t[k], 3); });
      if (Object.keys(t).length) o.t = t;
    }
    ["raw", "own", "edited"].forEach(function (k) { if (raw[k] === true) o[k] = true; });
    if (Array.isArray(raw.mix)) { const m = raw.mix.filter(function (x) { return typeof x === "string" && x; }).slice(0, 6).map(function (x) { return x.slice(0, 40); }); if (m.length) o.mix = m; }
    if (Array.isArray(raw.notes)) { const m = raw.notes.filter(function (x) { return typeof x === "string" && x; }).slice(0, 6).map(function (x) { return x.slice(0, 120); }); if (m.length) o.notes = m; }
    return Object.keys(o).length ? o : null;
  }

  // -> { spec, errors, warnings }: the spec as the player takes it (every number in its range, every list whole, in a stable order); what could not be kept is in `errors` and the spec is then still a spec that plays
  function validate(raw) {
    player();
    const errors = [], warnings = [];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { errors.push("a spec is an object { name, phases, tracks, events }"); return { spec: blank("action"), errors: errors, warnings: warnings }; }
    const good = typeof raw.name === "string" && IDENT.test(raw.name), out = blank(good ? raw.name : ident(raw.name));
    if (!good) errors.push("name is letters, digits and _ (at most 40, not beginning with a digit): '" + raw.name + "' became '" + out.name + "'");
    out.title = typeof raw.title === "string" ? raw.title.slice(0, 60) : "";
    out.kind = KINDS.indexOf(raw.kind) >= 0 ? raw.kind : "attack";
    if (raw.kind !== undefined && KINDS.indexOf(raw.kind) < 0) errors.push("kind is one of " + KINDS.join(", "));
    out.description = typeof raw.description === "string" ? raw.description.slice(0, 500) : "";
    out.priority = Number.isInteger(raw.priority) ? clamp(raw.priority, -100, 100) : (raw.priority === undefined ? 5 : Math.round(clamp(num(raw.priority, 5), -100, 100)));
    const fd = Array.isArray(raw.fade) && raw.fade.length === 2 ? raw.fade : (typeof raw.fade === "number" ? [raw.fade, raw.fade] : [0.12, 0.2]);
    out.fade = [round(clamp(num(fd[0], 0.12), 0, 2), 3), round(clamp(num(fd[1], 0.2), 0, 2), 3)];
    out.end = raw.end === "hold" ? "hold" : (raw.end === "loop" ? "loop" : "once");
    if (out.end === "loop") { const cy = Math.floor(num(raw.cycles, 0)); if (cy > 0) out.cycles = clamp(cy, 1, 100); }          // (a loop plays its phases again and again, until it is stopped; `cycles` makes it end after that many)
    out.frame = raw.frame === "chest" ? "chest" : "body";
    out.height = round(clamp(num(raw.height, 1.1), 0.1, 30), 3);
    // phases
    const names = {}, phases = Array.isArray(raw.phases) && raw.phases.length ? raw.phases.slice(0, MAX_PHASES) : [];
    if (!phases.length) { errors.push("a spec has at least one phase"); phases.push({ name: "act", t: 0.5 }); }
    if (Array.isArray(raw.phases) && raw.phases.length > MAX_PHASES) errors.push("at most " + MAX_PHASES + " phases");
    let air = -1, air_end = -1;                                                              // (the flight: ONE run of air phases, one right after the other; the body plays it whole, its progress by the height)
    out.phases = phases.map(function (ph, i) {
      let nm = phase_ident(ph && ph.name, "phase" + (i + 1));
      if (names["$" + nm]) { let k = 2; while (names["$" + nm + k]) k++; warnings.push("two phases were called '" + nm + "': the second is '" + nm + k + "'"); nm = nm + k; }
      names["$" + nm] = true;
      const easeok = player().EASE_LIST.indexOf(ph && ph.ease) >= 0;
      if (ph && ph.ease !== undefined && !easeok) errors.push("phase '" + nm + "': ease is one of " + player().EASE_LIST.join(", "));
      const o = { name: nm, t: round(clamp(num(ph && ph.t, 0.3), 0.02, 5), 3), ease: easeok ? ph.ease : "smooth", air: !!(ph && ph.air) };
      if (o.air) { if (air >= 0 && air_end !== i - 1) { o.air = false; errors.push("only one run of phases can be the body's (air), one right after the other: '" + nm + "' is not"); } else if (air >= 0) air_end = i; else { air = i; air_end = i; } }
      return o;
    });
    if (out.end === "loop" && air >= 0) { out.end = "once"; delete out.cycles; errors.push("a loop has no air phase: the body's phase is played once, by the body"); }
    const total = out.phases.reduce(function (s, p) { return s + p.t; }, 0);
    if (total > MAX_TOTAL) errors.push("the phases add up to " + total.toFixed(1) + " s: at most " + MAX_TOTAL);
    const n = out.phases.length;
    // params: the kinds, once each; a spec with an air phase takes `height`, one with a hit takes `target`
    let pr = Array.isArray(raw.params) ? raw.params.filter(function (k, i, a) { return PARAM_KINDS.indexOf(k) >= 0 && a.indexOf(k) === i; }) : out.params.slice();
    if (Array.isArray(raw.params) && pr.length !== raw.params.length) errors.push("params are the kinds " + PARAM_KINDS.join(", ") + ", each once");
    // tracks
    const seen = {}, short = [];
    out.tracks = [];
    (Array.isArray(raw.tracks) ? raw.tracks : []).forEach(function (t, i) {
      if (!t || typeof t.c !== "string" || !own(COMP_BY_ID, t.c)) { errors.push("track " + (i + 1) + ": '" + (t && t.c) + "' is not a number of the body (" + COMPONENTS.slice(0, 4).map(function (c) { return c.id; }).join(", ") + " ...)"); return; }
      if (out.tracks.length >= MAX_TRACKS) { if (out.tracks.length === MAX_TRACKS) errors.push("at most " + MAX_TRACKS + " tracks"); return; }
      const c = COMP_BY_ID[t.c], v = [];
      for (let j = 0; j <= n; j++) v.push(round(clamp(num(Array.isArray(t.v) ? t.v[j] : undefined, j > 0 ? v[j - 1] : c.neutral), c.lo, c.hi), 4));
      if (Array.isArray(t.v) && t.v.length !== n + 1) short.push(t.c);
      const o = { c: t.c, v: v };
      if (Array.isArray(t.e) && t.e.some(function (x) { return x; })) { const e = []; for (let j = 0; j < n; j++) e.push(player().EASE_LIST.indexOf(t.e[j]) >= 0 ? t.e[j] : null); if (e.some(function (x) { return x; })) o.e = e; }
      if (Array.isArray(t.h) && t.h.some(function (x) { return x; })) { const span = c.hi - c.lo, h = []; for (let j = 0; j < n; j++) h.push(round(clamp(num(t.h[j], 0), -span, span), 4)); if (h.some(function (x) { return x; })) o.h = h; }
      if (t.lag > 0 && round(clamp(t.lag, 0, 2), 3) > 0) o.lag = round(clamp(t.lag, 0, 2), 3);
      if (t.amp !== undefined && t.amp !== null && round(clamp(num(t.amp, 1), -3, 3), 3) !== 1) o.amp = round(clamp(num(t.amp, 1), -3, 3), 3);
      if (t.pw === 0) o.pw = 0;
      if (t.osc && t.osc.hz > 0 && t.osc.a) {
        const span = Math.max(Math.abs(c.lo), Math.abs(c.hi)), from = clamp(Math.floor(num(t.osc.from, 0)), 0, n - 1), to = clamp(Math.floor(num(t.osc.to, n - 1)), from, n - 1);
        const oa = round(clamp(num(t.osc.a, 0), -span, span), 4);
        if (oa !== 0) o.osc = { hz: round(clamp(t.osc.hz, 0.1, 20), 2), a: oa, ph: round(round(num(t.osc.ph, 0) % 1, 3) % 1, 3), from: from, to: to };
      }
      if (seen[t.c] !== undefined) { out.tracks[seen[t.c]] = o; warnings.push("'" + t.c + "' has two tracks: the second is kept"); return; }
      seen[t.c] = out.tracks.length;
      out.tracks.push(o);
    });
    if (short.length) warnings.push(short.length + " tracks (" + short.slice(0, 3).join(", ") + (short.length > 3 ? " ..." : "") + ") do not have a value for the start and the end of each of the " + n + " phases (" + (n + 1) + " values): what is missing repeats the last value");
    if (out.end === "loop") out.tracks.forEach(function (tk) {                                                       // (a loop that does not close jumps: the end of the last phase is the start of the first)
      const c = COMP_BY_ID[tk.c], gap = Math.abs(tk.v[tk.v.length - 1] - tk.v[0]);
      if (gap > 0.03 * (c.hi - c.lo) + 1e-9) warnings.push("the loop does not close: '" + tk.c + "' ends at " + tk.v[tk.v.length - 1] + " and begins at " + tk.v[0]);
    });
    // events
    out.events = [];
    (Array.isArray(raw.events) ? raw.events : []).forEach(function (e, i) {
      if (!e || EVENT_TYPES.indexOf(e.type) < 0) { errors.push("event " + (i + 1) + ": type is one of " + EVENT_TYPES.join(", ")); return; }
      if (out.events.length >= MAX_EVENTS) { if (out.events.length === MAX_EVENTS) errors.push("at most " + MAX_EVENTS + " events"); return; }
      const pn = Array.isArray(e.at) ? e.at[0] : undefined;
      let at = typeof pn === "number" && pn >= 0 && pn < n ? out.phases[Math.floor(pn)].name : (typeof pn === "string" && names["$" + pn] ? pn : null);
      if (!at) { errors.push("event " + (i + 1) + " (" + e.type + "): it names a phase that is not there ('" + pn + "')"); at = out.phases[0].name; }
      const o = { at: [at, round(clamp(num(Array.isArray(e.at) ? e.at[1] : 0, 0), 0, 1), 3)], type: e.type };
      if (e.type === "emit") { o.tag = IDENT.test(String(e.tag)) ? e.tag : "strike"; if (!IDENT.test(String(e.tag))) errors.push("event " + (i + 1) + ": the tag is a name (letters, digits and _)"); o.v = round(num(e.v, 1), 3); if (e.pw === true) o.pw = true; }
      else if (e.type === "impulse") { o.dir = DIRS.indexOf(e.dir) >= 0 ? e.dir : "fwd"; o.speed = round(clamp(num(e.speed, 1), -8, 8), 3); o.up = round(clamp(num(e.up, 0), -8, 8), 3); }
      else if (e.type === "hit") {
        o.limb = LIMBS.indexOf(e.limb) >= 0 ? e.limb : "hand_r"; if (e.limb !== undefined && LIMBS.indexOf(e.limb) < 0) errors.push("event " + (i + 1) + ": limb is one of " + LIMBS.join(", "));
        o.damage = round(clamp(num(e.damage, 10), 0, 1000), 2); o.push = round(clamp(num(e.push, 2), 0, 20), 3); o.up = round(clamp(num(e.up, 0), 0, 20), 3); o.kind = Number.isInteger(e.kind) ? clamp(e.kind, 0, 31) : 0;
        o.reach = round(clamp(num(e.reach, 0.12), 0.01, 2), 3); o.win = round(clamp(num(e.win, 0.1), 0, 1), 3);
        if (o.limb === "weapon") { o.prop = IDENT.test(String(e.prop)) ? e.prop : "sword"; o.base = IDENT.test(String(e.base)) ? e.base : "grip"; o.tip = IDENT.test(String(e.tip)) ? e.tip : "tip"; }
        if (o.limb === "point") { o.ahead = round(clamp(num(e.ahead, 0.5), -2, 2), 3); o.h = round(clamp(num(e.h, 0.5), -2, 2), 3); o.side = round(clamp(num(e.side, 0), -2, 2), 3); }
        if (pr.indexOf("target") < 0) pr = ["target"].concat(pr);
      } else {
        o.prop = IDENT.test(String(e.prop)) ? e.prop : "prop"; if (!IDENT.test(String(e.prop))) errors.push("event " + (i + 1) + ": the prop is a name");
        if (e.type === "mount") o.mount = IDENT.test(String(e.mount)) ? e.mount : "hand";
        if (e.now) o.now = true;
      }
      if (typeof e.when === "string" && /^!?[A-Za-z_][A-Za-z0-9_]{0,39}$/.test(e.when)) o.when = e.when;
      out.events.push(o);
    });
    if (air >= 0 && pr.indexOf("height") < 0) pr = ["height"].concat(pr);
    if (out.tracks.some(function (t) { return t.c === "look"; }) && pr.indexOf("target") < 0) pr = ["target"].concat(pr);
    if (pr.length > 8) pr = pr.slice(0, 8);
    out.params = pr;
    // (the events stay in the order they were made in: the window lists them so, and an edit must not move a row under the hand that drags it; the player fires each when its time has come, in any order)
    if (out.end === "loop") out.events.forEach(function (e, i) {                                                    // (the clock of a loop turns back to 0 as it reaches the end: a moment at the very end of the last phase is never reached)
      if (e.at[0] === out.phases[out.phases.length - 1].name && e.at[1] > 0.99 && e.type !== "hit") warnings.push("event " + (i + 1) + " (" + e.type + ") is at the very end of a loop, which the clock never reaches before it begins again: put it a little earlier");
    });
    // wait points: the clock stops at one until it is released (the AI's call) or its `max` seconds are over
    const waits = [];
    (Array.isArray(raw.waits) ? raw.waits : []).forEach(function (w, i) {
      if (!w || typeof w !== "object") { errors.push("wait " + (i + 1) + ": a wait is { at: [phase, 0 .. 1], tag, max }"); return; }
      if (waits.length >= MAX_WAITS) { if (waits.length === MAX_WAITS) errors.push("at most " + MAX_WAITS + " waits"); return; }
      const pn = Array.isArray(w.at) ? w.at[0] : undefined, pi = typeof pn === "number" && pn >= 0 && pn < n ? Math.floor(pn) : (typeof pn === "string" && names["$" + pn] ? out.phases.findIndex(function (p) { return p.name === pn; }) : -1);
      if (pi < 0) { errors.push("wait " + (i + 1) + ": it names a phase that is not there ('" + pn + "'): it was left out"); return; }
      if (out.phases[pi].air) { errors.push("wait " + (i + 1) + ": the body plays an air phase, its clock cannot be stopped: it was left out"); return; }
      const good = typeof w.tag === "string" && IDENT.test(w.tag) && w.tag.length <= 30;
      if (w.tag !== undefined && !good) errors.push("wait " + (i + 1) + ": the tag is a name (letters, digits and _, at most 30)");
      waits.push({ at: [out.phases[pi].name, round(clamp(num(Array.isArray(w.at) ? w.at[1] : 0, 0), 0, 1), 3)], tag: good ? w.tag : "hold", max: round(clamp(num(w.max, 10), 0, 3600), 2) });
    });
    if (waits.length) {
      out.waits = waits;
      if (out.end === "loop") waits.forEach(function (w, i) { if (w.at[0] === out.phases[out.phases.length - 1].name && w.at[1] > 0.99) warnings.push("wait " + (i + 1) + " is at the very end of a loop, which the clock never reaches before it begins again: put it a little earlier"); });
    }
    const learn = learn_of(raw.learn);
    if (learn) out.learn = learn;
    if (out.tracks.length === 0 && out.events.length === 0) warnings.push("the action does nothing yet: it has no track and no event");
    return { spec: out, errors: errors, warnings: warnings };
  }
  function tau_of(spec, at) {
    let t = 0;
    for (let i = 0; i < spec.phases.length; i++) { if (spec.phases[i].name === at[0]) return t + at[1] * spec.phases[i].t; t += spec.phases[i].t; }
    return t;
  }
  function normal(spec) { const r = validate(spec); if (r.errors.length) throw new Error("happy_action_spec: " + r.errors.join("; ")); return r.spec; }

  // ---- time, curves ----
  function timeline(spec) {
    const starts = [], ends = [];
    let t = 0;
    spec.phases.forEach(function (p) { starts.push(t); t += p.t; ends.push(t); });
    return { starts: starts, ends: ends, total: t, events: spec.events.map(function (e, i) { return { i: i, tau: tau_of(spec, e.at), type: e.type }; }), waits: (spec.waits || []).map(function (w, i) { return { i: i, tau: tau_of(spec, w.at), tag: w.tag }; }) };
  }
  // the values of every track at a time (seconds along the phases): { id: value }; o: { power (1), mirror (false) }
  function values_at(spec, tau, o) {
    o = o || {};
    const p = player(), C = p.compile(spec), V = new Float64Array(p.COMP.length), H = new Uint8Array(p.COMP.length), out = {};
    p.values(C, tau, o.power === undefined ? 1 : o.power, !!o.mirror, V, H);
    p.COMP.forEach(function (c, i) { if (H[i]) out[c.id] = V[i]; });
    return out;
  }
  // n values of one number over the whole action (n >= 2), for the picture of a track; o as values_at. A number that has no track is its neutral
  function sample(spec, id, n, o) {
    o = o || {};
    const p = player(), ci = p.COMP_INDEX[id];
    if (ci === undefined) return [];
    const C = p.compile(spec), V = new Float64Array(p.COMP.length), H = new Uint8Array(p.COMP.length), tot = C.total, out = [];
    for (let i = 0; i < n; i++) { p.values(C, tot * i / (n - 1), o.power === undefined ? 1 : o.power, !!o.mirror, V, H); out.push(H[ci] ? V[ci] : p.NEU[ci]); }
    return out;
  }

  // ---- what a spec asks of a creature ----
  const ROT_GROUPS = ["hips", "spine", "chest", "neck", "head", "tail"];
  function needs(spec) {
    const p = player(), groups = {}, uses = p.uses(spec);
    spec.tracks.forEach(function (t) { const c = COMP_BY_ID[t.c]; if (c) groups[c.group] = true; });
    const props = {}, tags = {};
    spec.events.forEach(function (e) {
      if (e.prop) props[e.prop] = true;
      if (e.type === "emit") tags[e.tag] = true;
      if (e.type === "hit") tags.hit = tags.miss = true;                 // (a hit is told as `hit` and `hit_end` too (action_player.js): not listed here, so that the tags the preset sets say stay as they were built)
    });
    (spec.waits || []).forEach(function (w) { tags[w.tag] = true; tags[w.tag + "_end"] = true; });
    const air = spec.phases.some(function (ph) { return ph.air; });
    if (air) { tags.jumped = true; tags.landed = true; }
    return { targets: TARGET_ORDER.filter(function (k) { return groups[k]; }), props: Object.keys(props), uses: uses, air: air, hits: spec.events.filter(function (e) { return e.type === "hit"; }).length, tags: Object.keys(tags) };
  }
  // what a creature can do: the runtime's capabilities(sp) ({ hips, hips_move, spine, chest, neck, head, jaw, tail, arm_l, arm_r, leg_l ... body, look, props, events }: true for a group of tracks that has something to move), made whole
  // (a group that the runtime does not say is one the creature cannot play)
  const EVENT_PLAYED = ["emit"];
  function capabilities(c) {
    c = c || {};
    const out = { air: !!c.air, props: Array.isArray(c.props) ? c.props.slice() : [], mounts: c.mounts || {}, points: c.points || {}, events: Array.isArray(c.events) ? c.events.slice() : EVENT_PLAYED.slice() };
    TARGET_ORDER.forEach(function (k) { out[k] = !!c[k]; });
    return out;
  }
  // the tracks of a spec that a creature cannot play (a role it lacks): [{ c, group }]
  function skipped(spec, caps) { return spec.tracks.filter(function (t) { const c = COMP_BY_ID[t.c]; return c && !caps[c.group]; }).map(function (t) { return { c: t.c, group: COMP_BY_ID[t.c].group }; }); }

  // the events of a spec that nothing plays on this creature (a hit, an impulse, a prop: system has no physics and no props yet; an event of a prop that the creature does not have): [{ i, type }]
  function skipped_events(spec, caps) {
    const played = caps && caps.events ? caps.events : EVENT_PLAYED, props = caps && caps.props ? caps.props : [];
    return spec.events.map(function (e, i) { return { i: i, type: e.type, e: e }; }).filter(function (x) {
      if (played.indexOf(x.type) < 0) return true;
      return !!(x.e.prop && x.type !== "emit" && props.indexOf(x.e.prop) < 0);
    }).map(function (x) { return { i: x.i, type: x.type }; });
  }

  // words for a list or a status line
  function describe(spec) {
    const tl = timeline(spec), nd = needs(spec), bits = [];
    bits.push(spec.phases.length + (spec.phases.length === 1 ? " phase" : " phases") + ", " + tl.total.toFixed(2) + " s" + (nd.air ? " + the flight" : ""));
    if (nd.targets.length) bits.push("moves " + nd.targets.map(function (k) { return GROUP_LABEL[k] || k; }).join(", "));
    if (nd.hits) bits.push(nd.hits + (nd.hits === 1 ? " hit" : " hits"));
    if (spec.waits && spec.waits.length) bits.push(spec.waits.length + (spec.waits.length === 1 ? " wait" : " waits") + " (" + spec.waits.map(function (w) { return w.tag; }).join(", ") + ")");
    if (nd.props.length) bits.push("props: " + nd.props.join(", "));
    return bits.join("; ");
  }

  // ---- editing: every edit leaves a spec that is whole (a track has a number for every boundary, an event a phase that is there) ----
  function set_phase(spec, i, f) {
    const ph = spec.phases[i];
    if (!ph) return false;
    if (f.name !== undefined) {
      const nm = phase_ident(f.name, ph.name);
      if (nm !== ph.name && !spec.phases.some(function (q) { return q.name === nm; })) { spec.events.forEach(function (e) { if (e.at[0] === ph.name) e.at[0] = nm; }); (spec.waits || []).forEach(function (w) { if (w.at[0] === ph.name) w.at[0] = nm; }); ph.name = nm; }
    }
    if (f.t !== undefined) ph.t = round(clamp(num(f.t, ph.t), 0.02, 5), 3);
    if (f.ease !== undefined && player().EASE_LIST.indexOf(f.ease) >= 0) ph.ease = f.ease;
    if (f.air !== undefined) { if (f.air) spec.phases.forEach(function (q, k) { q.air = k === i; }); else ph.air = false; }
    return true;
  }
  // a phase is added after phase i (at the end for i = -1 / the last): a copy of its neighbour's end values, so the curves go on; the events keep their phases
  function add_phase(spec, i) {
    if (spec.phases.length >= MAX_PHASES) return false;
    const at = i === undefined || i < 0 || i >= spec.phases.length ? spec.phases.length - 1 : i;
    let k = spec.phases.length + 1, nm = "phase" + k;
    while (spec.phases.some(function (q) { return q.name === nm; })) nm = "phase" + (++k);
    spec.phases.splice(at + 1, 0, { name: nm, t: 0.2, ease: "smooth", air: false });
    spec.tracks.forEach(function (t) { t.v.splice(at + 1, 0, t.v[at + 1]); if (t.e) t.e.splice(at + 1, 0, null); if (t.h) t.h.splice(at + 1, 0, 0); if (t.osc) { if (t.osc.from > at) t.osc.from++; if (t.osc.to > at) t.osc.to++; } });
    return nm;
  }
  function remove_phase(spec, i) {
    if (spec.phases.length <= 1 || !spec.phases[i]) return false;
    const gone = spec.phases[i].name, into = spec.phases[i > 0 ? i - 1 : 1].name;
    spec.phases.splice(i, 1);
    spec.tracks.forEach(function (t) { t.v.splice(i + 1, 1); if (t.e) { t.e.splice(i, 1); if (!t.e.some(function (x) { return x; })) delete t.e; } if (t.h) { t.h.splice(i, 1); if (!t.h.some(function (x) { return x; })) delete t.h; } if (t.osc) { if (t.osc.from > i) t.osc.from--; if (t.osc.to >= i) t.osc.to = Math.max(0, t.osc.to - 1); if (t.osc.from > t.osc.to) t.osc.from = t.osc.to; } });
    spec.events.forEach(function (e) { if (e.at[0] === gone) { e.at = [into, i > 0 ? 1 : 0]; } });
    (spec.waits || []).forEach(function (w) { if (w.at[0] === gone) { w.at = [into, i > 0 ? 1 : 0]; } });
    return true;
  }
  // a number's values at the boundaries (a list as long as the phases plus one, or a single number for all of them): a track is made when it is not there
  function set_track(spec, id, values) {
    const c = COMP_BY_ID[id], n = spec.phases.length;
    if (!c) return false;
    let t = spec.tracks.filter(function (x) { return x.c === id; })[0];
    if (!t) { if (spec.tracks.length >= MAX_TRACKS) return false; t = { c: id, v: [] }; for (let j = 0; j <= n; j++) t.v.push(c.neutral); spec.tracks.push(t); }
    for (let j = 0; j <= n; j++) { const x = Array.isArray(values) ? values[j] : values; if (x !== undefined && x !== null) t.v[j] = round(clamp(num(x, c.neutral), c.lo, c.hi), 4); }
    return t;
  }
  function remove_track(spec, id) { const i = spec.tracks.findIndex(function (x) { return x.c === id; }); if (i < 0) return false; spec.tracks.splice(i, 1); return true; }
  function add_event(spec, ev) { if (spec.events.length >= MAX_EVENTS) return false; spec.events.push(ev); const r = validate(spec); Object.assign(spec, r.spec); return true; }
  function remove_event(spec, i) { if (!spec.events[i]) return false; spec.events.splice(i, 1); return true; }
  function add_wait(spec, w) { if ((spec.waits || []).length >= MAX_WAITS) return false; const n0 = (spec.waits || []).length; spec.waits = (spec.waits || []).concat([w]); const r = validate(spec); Object.assign(spec, r.spec); if (!r.spec.waits) delete spec.waits; return (spec.waits || []).length > n0; }
  function remove_wait(spec, i) { if (!spec.waits || !spec.waits[i]) return false; spec.waits.splice(i, 1); if (!spec.waits.length) delete spec.waits; return true; }

  // ---- EASY SLIDERS: an action made bigger or smaller, longer or shorter, by a few numbers (spec -> a new spec: nothing is kept but the spec) ----
  // The amounts are of the REGIONS of the body: how far the arms, the legs, the trunk (hips, spine, chest), the head (neck, head, look), the tail and the jaw go from where they rest (1: as the action says, 0: they do not move, 2: twice
  // as far). The time: `duration` for every phase, `first` and `last` for the first phase (the anticipation) and the last (the recovery). The poles: `elbow` and `knee` turn the bend plane of the arms and the legs out (+) or in (-), degrees,
  // all through the action; `lean` bends the spine forward (degrees), `crouch` brings the hips down (hips' heights).
  const REGIONS = ["arms", "legs", "torso", "head", "tail", "jaw"];
  const PART_KEYS = REGIONS.concat(["body"]);
  const TWEAKS = { duration: 1, first: 1, last: 1, arms: 1, legs: 1, torso: 1, head: 1, tail: 1, jaw: 1, elbow: 0, knee: 0, lean: 0, crouch: 0 };
  function region_of(group) {
    if (/^arm_/.test(group)) return "arms";
    if (/^leg/.test(group)) return "legs";
    if (group === "hips" || group === "spine" || group === "chest" || group === "hips_move") return "torso";
    if (group === "neck" || group === "head" || group === "look") return "head";
    if (group === "tail") return "tail";
    if (group === "jaw") return "jaw";
    return "body";
  }
  // a track's numbers all through an action, by a function of the number: the values and the humps
  function track_map(t, c, f) {
    t.v = t.v.map(function (x) { return round(clamp(f(x), c.lo, c.hi), 4); });
    if (t.h) { const span = c.hi - c.lo; t.h = t.h.map(function (x) { return round(clamp(f(c.neutral + x) - c.neutral, -span, span), 4); }); }
  }
  // a number held through the action, added to the track that is there (or a new one): the poles, the lean, the crouch
  function constant_track(s, id, value) {
    const c = COMP_BY_ID[id], n = s.phases.length;
    if (!c || !value) return;
    let t = s.tracks.filter(function (x) { return x.c === id; })[0];
    if (!t) { if (s.tracks.length >= MAX_TRACKS) return; t = { c: id, v: [] }; for (let j = 0; j <= n; j++) t.v.push(c.neutral); s.tracks.push(t); }
    t.v = t.v.map(function (x) { return round(clamp(x + value, c.lo, c.hi), 4); });
  }
  // tweak(spec, tw, caps) -> the new spec. caps (capabilities(msg)): when given, the poles of a limb that the creature has not are not made
  function tweak(base, tw, caps) {
    player();
    tw = Object.assign({}, TWEAKS, tw || {});
    const s = clone(base || blank("action")), n = s.phases.length;
    s.phases.forEach(function (p, i) {
      if (p.air) return;                                                                 // (the body's phase is as long as the flight)
      let k = tw.duration;
      if (i === 0) k *= tw.first;
      if (i === n - 1) k *= tw.last;
      p.t = round(clamp(p.t * k, 0.02, 5), 3);
    });
    s.tracks.forEach(function (t) {
      const c = COMP_BY_ID[t.c], reg = c ? region_of(c.group) : "body", k = reg === "body" ? 1 : tw[reg];
      if (!c || k === 1 || /\.own$/.test(t.c)) return;
      track_map(t, c, function (x) { return c.neutral + (x - c.neutral) * k; });
      if (t.osc) { const span = Math.max(Math.abs(c.lo), Math.abs(c.hi)); t.osc.a = round(clamp(t.osc.a * k, -span, span), 4); }
    });
    if (tw.elbow) ["arm_l", "arm_r"].forEach(function (g) { if (!caps || caps[g]) constant_track(s, g + ".pole", tw.elbow); });
    if (tw.knee) ["leg_l", "leg_r", "legf_l", "legf_r"].forEach(function (g) { if (caps ? caps[g] : /^leg_/.test(g)) constant_track(s, g + ".pole", tw.knee); });
    if (tw.lean) constant_track(s, "spine.pitch", -tw.lean);
    if (tw.crouch) constant_track(s, "hips.y", -tw.crouch);
    if (s.learn && Object.keys(TWEAKS).some(function (k) { return tw[k] !== TWEAKS[k]; })) s.learn.edited = true;                   // (the times a tool measured are of the action as it was: events and waits follow their phases, which are longer or shorter now)
    return validate(s).spec;
  }

  // ---- MIXING ACTIONS: several actions into one, each by an amount and, for a part of the body, by an amount of its own ----
  // blend(layers, o) -> { spec, notes }.  layers: [{ spec, amount (0 .. 1), parts: { arms, legs, torso, head, tail, jaw, body: 0 .. 1 each, 1 by default } }]
  // The action with the biggest amount gives the phases (their names, eases, the flight) and the others are played over the same time (stretched to it): the length is the amounts' average of the lengths (o.length "weighted", the
  // default), the "longest", the "shortest" or the "first". A number's value at any time is its neutral plus the layers' distances from it, each by its weight (a layer that has no track for the number says nothing), the sum cut
  // to one whole layer's (two layers that move the same arm at full weight are averaged; one that moves the arm and one that moves the legs are both whole). The mix is sampled at the boundaries of its phases and, where the line
  // that the phase's ease draws between two of them is farther than 2 % of the number's range from the sum in the middle, the phase is split in two (linear pieces; at most o.detail phases, 12 unless it says more). The wobbles of the layers go on
  // as wobbles. The events come over by their time (a blow's damage and an impulse's speed by the amount of the layer; a layer under a quarter has none). The priority is the highest of the layers that count.
  const MERGE_WINDOW = 0.2;
  // what makes two events the same moment: an emit by its tag and the sign of its value (a step with the left foot is not one with the right), a hit by its limb, a prop's by its kind and name; null (never merged): an impulse
  function event_key(e) {
    if (e.type === "emit") return "emit|" + e.tag + "|" + (e.v < 0 ? "-" : "+");
    if (e.type === "hit") return "hit|" + e.limb;
    if (e.type === "show" || e.type === "hide" || e.type === "mount") return e.type + "|" + e.prop;
    return null;
  }
  // what a mix gives up first when it has more events than a spec can hold: the windows of a combo (4), the steps (3), the rest stays (1)
  const event_rank = function (e) { return e.type === "emit" ? (/^window_(open|close)$/.test(e.tag) ? 4 : (e.tag === "step" ? 3 : 1)) : 1; };
  function blend(layers, o) {
    const P = player();
    o = o || {};
    const detail = clamp(Math.floor(num(o.detail, 12)), 2, MAX_PHASES);
    const live = (layers || []).filter(function (l) { return l && l.spec && l.amount > 0.001; }).map(function (l) {
      const spec = normal(l.spec), parts = {};
      PART_KEYS.forEach(function (k) { parts[k] = l.parts && l.parts[k] !== undefined ? clamp(num(l.parts[k], 1), 0, 1) : 1; });
      return { spec: spec, amount: clamp(l.amount, 0, 1), parts: parts, T: timeline(spec).total };
    });
    if (!live.length) return { spec: validate(Object.assign(blank(o.name || "mix"), { tracks: [], events: [] })).spec, notes: ["nothing to mix: every amount is 0"] };
    let D = live[0];
    live.forEach(function (l) { if (l.amount > D.amount + 1e-9) D = l; });
    const sum_amount = live.reduce(function (s, l) { return s + l.amount; }, 0);
    let T;
    if (o.length === "longest") T = Math.max.apply(null, live.map(function (l) { return l.T; }));
    else if (o.length === "shortest") T = Math.min.apply(null, live.map(function (l) { return l.T; }));
    else if (o.length === "first") T = live[0].T;
    else T = live.reduce(function (s, l) { return s + l.amount * l.T; }, 0) / sum_amount;
    T = clamp(T, 0.1, MAX_TOTAL);
    // every layer's curves: what the player says at a time, the wobbles taken out of them (they are kept as wobbles)
    live.forEach(function (l) {
      const flat = clone(l.spec); flat.tracks.forEach(function (t) { delete t.osc; delete t.lag; });                // (the wobbles and the delays are kept as they are: a wobble sampled at the boundaries of the phases would be nothing)
      l.C = P.compile(flat); l.V = new Float64Array(P.COMP.length); l.H = new Uint8Array(P.COMP.length);
      l.has = {}; l.spec.tracks.forEach(function (t) { l.has[t.c] = true; });
    });
    const ids = [], part_of = {};
    live.forEach(function (l) { l.spec.tracks.forEach(function (t) { if (ids.indexOf(t.c) < 0) { ids.push(t.c); part_of[t.c] = region_of(COMP_BY_ID[t.c].group); } }); });
    const weight = function (l, id) { return l.has[id] ? l.amount * l.parts[part_of[id]] : 0; };
    const total_weight = {}; ids.forEach(function (id) { total_weight[id] = live.reduce(function (s, l) { return s + weight(l, id); }, 0); });
    const cache = {};
    function mix_at(tau) {                                                                // { id: value } of the mix, seconds along it
      const key = String(round(tau, 5));
      if (cache[key]) return cache[key];
      const out = {};
      ids.forEach(function (id) {
        const c = COMP_BY_ID[id], ci = P.COMP_INDEX[id], W = total_weight[id];
        let dev = 0;
        live.forEach(function (l) {
          const w = weight(l, id);
          if (!(w > 0)) return;
          P.values(l.C, tau * l.T / T, 1, false, l.V, l.H);
          dev += w * ((l.H[ci] ? l.V[ci] : c.neutral) - c.neutral);
        });
        out[id] = clamp(c.neutral + (W > 1 ? dev / W : dev), c.lo, c.hi);
      });
      cache[key] = out;
      return out;
    }
    // the phases: the biggest layer's, stretched; cut where a wobble of a layer begins or ends
    const dt = timeline(D.spec);
    const ph = D.spec.phases.map(function (p, i) { return { name: p.name, ease: p.ease, air: !!p.air, t0: dt.starts[i] * T / D.T, t1: dt.ends[i] * T / D.T }; });
    const names = function () { return ph.map(function (p) { return p.name; }); };
    const unique_name = function (base) { let k = 2, nm = phase_ident(base, "phase"); const have = names(); while (have.indexOf(nm) >= 0) nm = phase_ident(base, "phase") + (k++); return nm; };
    function split(i, at) {                                                               // the phase i in two at the time `at` (linear pieces)
      const p = ph[i], second = { name: unique_name(p.name), ease: "linear", air: false, t0: at, t1: p.t1 };
      p.t1 = at; p.ease = "linear"; ph.splice(i + 1, 0, second);
    }
    live.forEach(function (l) {
      const lt = timeline(l.spec);
      l.spec.tracks.forEach(function (t) {
        if (!t.osc) return;
        [lt.starts[t.osc.from] * T / l.T, lt.ends[t.osc.to] * T / l.T].forEach(function (c) {
          if (ph.length >= detail) return;
          for (let i = 0; i < ph.length; i++) if (c > ph[i].t0 + 0.04 && c < ph[i].t1 - 0.04 && !ph[i].air) { split(i, c); return; }
        });
      });
    });
    for (let guard = 0; guard < 64; guard++) {
      let did = false;
      for (let i = 0; i < ph.length && ph.length < detail; i++) {
        const p = ph[i];
        if (p.air || p.t1 - p.t0 < 0.07) continue;
        const a = mix_at(p.t0), b = mix_at(p.t1);
        let err = 0;
        [0.25, 0.5, 0.75].forEach(function (u) {                                                // (the line that the phase's ease draws against the sum, a quarter, half and three quarters through)
          const m = mix_at(p.t0 + (p.t1 - p.t0) * u), e = P.ease(p.ease, u);
          ids.forEach(function (id) { const c = COMP_BY_ID[id]; err = Math.max(err, Math.abs(m[id] - (a[id] + (b[id] - a[id]) * e)) / (c.hi - c.lo)); });
        });
        if (err > 0.02) { split(i, (p.t0 + p.t1) / 2); did = true; break; }
      }
      if (!did) break;
    }
    // the spec: phases, the tracks at their boundaries (the ones that do not move are left out), the wobbles, the events, what the layers say about themselves
    const out = blank(o.name || "mix", D.spec.kind);
    out.phases = ph.map(function (p) { return { name: p.name, t: round(clamp(p.t1 - p.t0, 0.02, 5), 3), ease: p.ease, air: p.air }; });
    const bounds = ph.map(function (p) { return p.t0; }).concat([ph[ph.length - 1].t1]);
    const phase_at = function (tau) { for (let i = ph.length - 1; i >= 0; i--) if (tau >= ph[i].t0 - 1e-9) return i; return 0; };
    ids.forEach(function (id) {
      const c = COMP_BY_ID[id], v = bounds.map(function (b) { return round(mix_at(b)[id], 4); });
      let osc = null, best = 0;
      live.forEach(function (l) {
        const t = l.spec.tracks.filter(function (x) { return x.c === id; })[0], w = weight(l, id);
        if (!t || !t.osc || !(w > 0)) return;
        const score = w * Math.abs(t.osc.a);
        if (score <= best) return;
        best = score;
        const lt = timeline(l.spec), W = total_weight[id];
        osc = { hz: t.osc.hz, a: round(t.osc.a * (W > 1 ? w / W : w), 4), ph: t.osc.ph, from: phase_at(lt.starts[t.osc.from] * T / l.T + 0.001), to: phase_at(lt.ends[t.osc.to] * T / l.T - 0.001) };
        if (osc.to < osc.from) osc.to = osc.from;
      });
      if (!osc && v.every(function (x) { return Math.abs(x - c.neutral) < 1e-3 * (c.hi - c.lo); })) return;
      const tk = { c: id, v: v };
      if (osc && osc.a !== 0) tk.osc = osc;
      let lw = 0, ls = 0;                                                                // (the delay: the layers' own, by their weights)
      live.forEach(function (l) { const x = l.spec.tracks.filter(function (y) { return y.c === id; })[0], w = weight(l, id); if (x && w > 0) { lw += w; ls += w * (x.lag || 0); } });
      if (lw > 0 && ls / lw >= 0.002) tk.lag = round(ls / lw, 3);
      out.tracks.push(tk);
    });
    out.tracks = out.tracks.slice(0, MAX_TRACKS);
    // ONE EVENT PER MOMENT: two layers that both strike, both step on the same foot, both open a window within MERGE_WINDOW seconds of each other have ONE of it in the mix, between them (the layers' amounts weigh the times),
    // from the layer that has the most of it; events of one layer are never merged with each other (a loop's cycles, a walk's steps), nor are impulses (two pushes are two pushes)
    const items = [];
    live.slice().sort(function (x, y) { return (y === D ? 1 : 0) - (x === D ? 1 : 0) || y.amount - x.amount; }).forEach(function (l) {
      if (l.amount < 0.25) return;
      const lt = timeline(l.spec);
      l.spec.events.forEach(function (e, i) {
        const q = clone(e), tau = lt.events[i].tau * T / l.T, key = event_key(q);
        if (q.type === "hit") q.damage = round(num(q.damage, 10) * l.amount, 2);
        if (q.type === "impulse") q.speed = round(num(q.speed, 1) * l.amount, 3);
        const same = key ? items.filter(function (x) { return x.key === key && x.layer !== l && Math.abs(x.tau - tau) <= MERGE_WINDOW; })[0] : null;
        if (same) { same.tau = (same.tau * same.w + tau * l.amount) / (same.w + l.amount); same.w += l.amount; same.merged++; }
        else items.push({ q: q, tau: tau, key: key, layer: l, w: l.amount, merged: 0 });
      });
    });
    const events = items.map(function (x) {
      const k = phase_at(x.tau), p = ph[k];
      x.q.at = [out.phases[k].name, round(clamp((x.tau - p.t0) / Math.max(1e-6, p.t1 - p.t0), 0, 1), 3)];
      return x.q;
    });
    out.events = events.length > MAX_EVENTS ? events.map(function (e, i) { return { e: e, i: i, r: event_rank(e) }; }).sort(function (a, b) { return a.r - b.r || a.i - b.i; }).slice(0, MAX_EVENTS).sort(function (a, b) { return a.i - b.i; }).map(function (x) { return x.e; }) : events;          // (more than a spec holds: the footsteps and the windows go first, then the last of them)
    if (D.spec.waits && D.spec.waits.length) {                                          // (the wait points of the layer that gives the phases, by their time; the others' say nothing)
      const dl = timeline(D.spec);
      out.waits = D.spec.waits.map(function (w, i) {
        const tau = dl.waits[i].tau * T / D.T, k = phase_at(tau), p = ph[k];
        return { at: [out.phases[k].name, round(clamp((tau - p.t0) / Math.max(1e-6, p.t1 - p.t0), 0, 1), 3)], tag: w.tag, max: w.max };
      });
    }
    if (live.some(function (l) { return !!l.spec.learn; })) out.learn = { v: 1, mix: live.map(function (l) { return l.spec.name; }) };          // (a mix of learned actions says which: a mix of the others is what it was)
    const big = live.filter(function (l) { return l.amount >= 0.25; }), pool = big.length ? big : live;
    out.priority = Math.max.apply(null, pool.map(function (l) { return l.spec.priority; }));
    out.fade = [0, 1].map(function (k) { return round(pool.reduce(function (s, l) { return s + l.amount * l.spec.fade[k]; }, 0) / pool.reduce(function (s, l) { return s + l.amount; }, 0), 3); });
    out.end = D.spec.end === "loop" ? "loop" : (pool.some(function (l) { return l.amount >= 0.5 && l.spec.end === "hold"; }) ? "hold" : "once");
    if (out.end === "loop" && D.spec.cycles) out.cycles = D.spec.cycles;
    if (D.spec.frame === "chest") out.frame = "chest";
    out.height = D.spec.height;
    const params = [];
    [D].concat(live).forEach(function (l) { l.spec.params.forEach(function (k) { if (params.indexOf(k) < 0) params.push(k); }); });
    out.params = params.slice(0, 8);
    out.title = o.title !== undefined ? o.title : live.map(function (l) { return l.spec.name; }).join(" + ");
    out.description = "A mix: " + live.map(function (l) { return l.spec.name + " " + Math.round(l.amount * 100) + " %"; }).join(", ") + ".";
    const r = validate(out), notes = [];
    if (r.errors.length) notes.push(r.errors[0]);
    if (ph.length >= detail) notes.push("the mix has " + ph.length + " phases (the most): the curves are drawn in pieces");
    return { spec: r.spec, notes: notes };
  }
  // a mix made by chance: 2 or 3 of the specs (the ones of the kind of the first, when it can), their amounts, and for each region of the body the layer that has it whole (the others a quarter)
  // random_mix(specs, rnd, o) -> layers for blend; rnd() gives 0 .. 1 (Math.random)
  function random_mix(specs, rnd, o) {
    rnd = rnd || Math.random;
    o = o || {};
    const pick = function (a) { return a[Math.min(a.length - 1, Math.floor(rnd() * a.length))]; };
    if (!specs || !specs.length) return [];
    const first = o.first || pick(specs), k = Math.min(specs.length, rnd() < 0.55 ? 2 : 3), chosen = [first];
    while (chosen.length < k) {
      const avail = specs.filter(function (x) { return chosen.indexOf(x) < 0 && x.name !== first.name; }), same = avail.filter(function (x) { return x.kind === first.kind; });
      if (!avail.length) break;
      chosen.push(pick(same.length && rnd() < 0.6 ? same : avail));
    }
    const layers = chosen.map(function (s, i) { return { spec: s, amount: i === 0 ? 1 : round(0.35 + 0.65 * rnd(), 2), parts: {} }; });
    REGIONS.concat(["body"]).forEach(function (r) {
      const owner = Math.floor(rnd() * layers.length);
      layers.forEach(function (l, i) { l.parts[r] = i === owner ? 1 : 0.25; });
    });
    return layers;
  }

  // ---- a set of actions as a file (happy_actions/<set>.json: plain JSON, a list of specs: the packing server writes it, a page reads it) ----
  const SYSTEM_TAGS = ["hit", "hit_end", "miss", "jumped", "landed"];
  const SET_FORMAT = "happy.actions";
  function tags_of(specs) {
    const out = [];
    specs.forEach(function (s) { needs(s).tags.forEach(function (t) { if (out.indexOf(t) < 0) out.push(t); }); });
    return out;
  }
  function set_object(set, specs, o) {
    o = o || {};
    if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/.test(set)) throw new Error("happy_action_spec: the name of a set is letters, digits, _ . -");
    return { format: SET_FORMAT, version: 1, name: set, description: o.description || ("Designed actions: " + specs.map(function (s) { return s.name; }).join(", ")), tags: tags_of(specs.map(normal)), actions: specs.map(normal) };
  }
  // one spec a line, so that a set is a file a diff can be read of
  function set_text(set, specs, o) {
    const obj = set_object(set, specs, o), head = Object.assign({}, obj, { actions: undefined });
    const text = JSON.stringify(head, null, 1).replace(/\n}$/, ",\n \"actions\": [");
    return text + "\n" + obj.actions.map(function (a, i) { return "  " + JSON.stringify(a) + (i < obj.actions.length - 1 ? "," : ""); }).join("\n") + "\n ]\n}\n";
  }
  // the specs of a set file's text: { name, description, specs } (each spec made whole; the ones with something wrong are kept as they can be made and said in `problems`)
  function set_read(text) {
    const made = typeof text === "string" ? JSON.parse(text) : text;
    if (!made || typeof made !== "object" || made.format !== SET_FORMAT || !Array.isArray(made.actions)) throw new Error("happy_action_spec: that is not a set of actions (format \"" + SET_FORMAT + "\", a list `actions`)");
    const specs = [], bad = [];
    made.actions.forEach(function (raw, i) { const r = validate(raw); if (r.errors.length) bad.push((raw && raw.name || "#" + (i + 1)) + ": " + r.errors[0]); specs.push(r.spec); });
    return { name: made.name, description: made.description || "", specs: specs, problems: bad };
  }

  return { IDENT: IDENT, KINDS: KINDS, PRESET_SETS: PRESET_SETS, is_preset_set: is_preset_set, PARAM_KINDS: PARAM_KINDS, EVENT_TYPES: EVENT_TYPES, LIMBS: LIMBS, DIRS: DIRS, MAX_PHASES: MAX_PHASES, MAX_TRACKS: MAX_TRACKS, MAX_EVENTS: MAX_EVENTS, SYSTEM_TAGS: SYSTEM_TAGS, COMPONENTS: COMPONENTS, TARGETS: TARGETS, GROUP_LABEL: GROUP_LABEL,
    use_player: use_player, player: player, component: component, EASES: EASES, ident: ident, blank: blank, clone: clone, validate: validate, normal: normal, timeline: timeline, tau_of: tau_of, values_at: values_at, sample: sample, needs: needs, capabilities: capabilities, skipped: skipped, describe: describe,
    REGIONS: REGIONS, PART_KEYS: PART_KEYS, TWEAKS: TWEAKS, region_of: region_of, tweak: tweak, blend: blend, random_mix: random_mix,
    set_phase: set_phase, add_phase: add_phase, remove_phase: remove_phase, set_track: set_track, remove_track: remove_track, add_event: add_event, remove_event: remove_event, add_wait: add_wait, remove_wait: remove_wait, event_key: event_key, MAX_WAITS: MAX_WAITS, MERGE_WINDOW: MERGE_WINDOW, set_object: set_object, set_text: set_text, set_read: set_read, tags_of: tags_of, skipped_events: skipped_events, SET_FORMAT: SET_FORMAT };
});

// ========================================================================================================================
// gait_blend
// ========================================================================================================================
packing()("happy_gait_blend", function happy_gait_blend() {
  "use strict";
  // HAPPY GAIT BLEND: the arithmetic of the gait designer (happy_gait_designer.js, SYSTEM.md): a NEW gait style from the styles that there are. A style (happy_gaits/*.gaits.json, kernel.js) is a set of numbers: how fast the body goes, how long a
  // step is, how long a foot is in the air, how high it lifts, how far the hips bob, how high they ride, the order of the steps, the path of the foot, how the foot rolls (three tables over its cycle) and what the hips, the spine, the neck,
  // the head and the hands do over a cycle (a mean and up to three harmonics a channel). Numbers can be mixed: a mix of styles is a weighted mean of them, a waveform being a sum of harmonics (a cosine and a sine each) mixes by its coefficients.
  // Pure: no DOM, no engine, no file. Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no class.
  //
  //   a RECIPE says what is made (a plain object: it is what the designer's page edits, and what a seed reproduces):
  //     { name, styles: [{ style, weight (0 .. 1), regions: { pace, steps, feet, hips, spine, head, arms: 0 .. 1 (how much of this style goes into that part of the walk: 1) } }],
  //       amounts: { feet, hips, spine, head, arms: 0 .. 2 (how much the part moves, whatever the styles say: 1) }, dials: { speed, stride, lift, swing, roll, toe_out, ... } (DIALS: what is turned over the mix; the neutral is no change),
  //       variation: { amount (0 .. 1), seed }, description }
  //   blend(recipe, o) -> a style (the stored form of kernel.js, ready for system.gaits.add: o.full leaves nothing out: the path, the feet and the upper body of a gait that is changed while the creature walks are always there)
  //   REGIONS, DIALS, PERSONALITIES      what the page builds its sliders from      default_recipe(styles?)      recipe_of(style)
  //   random_mix(pool, rng, o) -> a recipe      mutate(recipe, rng, strength, pool?) -> a recipe      procedural(template, personality, seed, o) -> a recipe      random_dials(rng, strength) -> dials      template_of(styles, legs)
  //   rng(seed) -> a function that gives numbers in 0 .. 1      describe(style) -> words      curve(style, part, axis, n) -> n numbers of a cycle      reref(style, limb) -> the style counted from the cycle of that limb
  // HOW A MIX IS MADE: every region of a walk has its own weights (a style's weight times its share of that region), they are taken as shares (the sum is 1), and the region is the sum of the styles' own, each times its share. The order of the steps
  // is the one of the style with the most say in the steps (the others' are counted from its first limb and mixed along the shortest way: a walk and a trot mix to an amble); the hips' and the spine's channels of a style whose first limb is another
  // are moved to the cycle of that limb (a shift of time: a harmonic h turns by h times the shift). Then the amounts (how much a part moves: 0 holds it still) and the dials (a share of a number, or a number added) are put over the mix.
  // THE HIPS MOVE THE PELVIS AND NOTHING ABOVE IT: the spine is a child of the hips, so a pelvis that rolls carries the chest, the head and the hands unless the spine bends back (a walk records exactly that: the pelvis rolls 5 degrees, the chest
  // 2). The spine's channel is therefore made as the CHEST's own motion in the world (its styles' hips and spine channels together, scaled by the spine's amount and dials) less the hips as they are made: whatever the hips'
  // weights, amount and dials say, the chest, the head and the hands move as the spine's styles say.
  const DEG = Math.PI / 180, TAU = 2 * Math.PI, FEET_N = 16, HARMS = 3, PATH_N = 8;
  const PARTS = { hips: ["yaw", "pitch", "roll"], spine: ["yaw", "pitch", "roll"], neck: ["yaw", "pitch", "roll"], head: ["yaw", "pitch", "roll"], arm_l: ["x", "y", "z"], arm_r: ["x", "y", "z"] };
  const PART_ORDER = ["hips", "spine", "neck", "head", "arm_l", "arm_r"];
  const FEET_LIMITS = { pitch: 90, yaw: 60, knee: 60 };
  const DEFAULT_PATH = [[0, 0], [0.3, -1], [0.7, -1], [1, 0]];                                  // (the foot's path of a style that has none: the planner's trapezoid, body.cpp happy_default_path)
  // the parts of a walk a style is mixed in, separately (a style's weight in each is its weight times what its row says), and what each is made of
  const REGIONS = [
    { key: "pace", label: "pace", note: "how fast the body goes and how long a step is (speed, stride)", amount: false },
    { key: "steps", label: "steps", note: "how long a foot is in the air, how high it lifts, the path it takes, the order the legs step in", amount: false },
    { key: "feet", label: "feet", note: "how the foot rolls on the floor, turns out, how the knee points", amount: true },
    { key: "hips", label: "hips", note: "the pelvis: its sway, twist and tilt (the chest keeps its own motion), how far it bobs and how high it rides", amount: true },
    { key: "spine", label: "spine", note: "the chest's own twist, lean and side bend, as the chest moves in the world, whatever the hips do", amount: true },
    { key: "head", label: "neck and head", note: "the nod, the turn and the tilt of the head and how it is carried", amount: true },
    { key: "arms", label: "arms", note: "how the hands swing and where they are held", amount: true }
  ];
  const REGION_KEYS = REGIONS.map(function (r) { return r.key; });
  const UPPER_OF = { hips: ["hips"], spine: ["spine"], head: ["neck", "head"], arms: ["arm_l", "arm_r"] };
  // the dials: [id, region, label, neutral, lowest, highest, step, unit, what it does]; a share ("x") multiplies what the mix gives, an added number ("deg", "arm", "share") is put on it
  const DIAL_LIST = [
    ["speed", "pace", "speed", 1, 0.3, 2.5, 0.01, "x", "the speed of the body: leg lengths a second"],
    ["stride", "pace", "stride", 1, 0.3, 2.5, 0.01, "x", "how long a step is"],
    ["lift", "steps", "foot lift", 1, 0, 2.5, 0.01, "x", "how high the foot goes in a step"],
    ["swing", "steps", "air time", 0, -0.2, 0.3, 0.005, "share", "how much longer (shorter) the foot is in the air: a share of the cycle added"],
    ["roll", "feet", "foot roll", 1, 0, 2.5, 0.01, "x", "how far the foot tips: the heel strike and the toe off"],
    ["toe_out", "feet", "toes out", 0, -20, 30, 0.5, "deg", "degrees the toes point out (in: below 0)"],
    ["knee_out", "feet", "knees out", 1, 0, 3, 0.01, "x", "how far the knee points out"],
    ["hip_sway", "hips", "hip sway", 1, 0, 3, 0.01, "x", "the roll of the pelvis: the side that is up when a foot is down; the chest does not sway with it (the spine bends back)"],
    ["hip_twist", "hips", "hip twist", 1, 0, 3, 0.01, "x", "the turn of the pelvis about the vertical; the shoulders keep their own"],
    ["hip_tilt", "hips", "hip tilt", 1, 0, 3, 0.01, "x", "the pelvis' pitch: forward and back; the chest keeps its own"],
    ["bounce", "hips", "bounce", 1, 0, 4, 0.01, "x", "how far the hips bob up and down"],
    ["height", "hips", "hip height", 1, 0.55, 1.2, 0.005, "x", "how high the hips ride: a crouch, or on tiptoe"],
    ["spine_twist", "spine", "chest twist", 1, 0, 3, 0.01, "x", "how far the shoulders turn, as seen from above (0: they stay square whatever the pelvis does)"],
    ["lean", "spine", "lean", 0, -25, 35, 0.5, "deg", "degrees the trunk leans forward (back: below 0); a creature takes a share of a posture: the window's posture slider (a quarter for a person of the human system, a half for the rest)"],
    ["bend", "spine", "chest nod", 1, 0, 3, 0.01, "x", "the trunk's forward and back swing over a step, as it moves in the world"],
    ["side_bend", "spine", "side bend", 1, 0, 3, 0.01, "x", "the trunk's lean to the side over a step, as it moves in the world (0: it stays upright)"],
    ["nod", "head", "head nod", 1, 0, 3, 0.01, "x", "the head's nod (the neck's too)"],
    ["look", "head", "head turn", 1, 0, 3, 0.01, "x", "the head's turn from side to side"],
    ["head_tilt", "head", "head tilt", 1, 0, 3, 0.01, "x", "the head's tilt to the shoulder"],
    ["carry", "head", "head carried", 0, -25, 25, 0.5, "deg", "degrees the head is carried up (down: below 0); a creature takes a share of a posture, as for the lean"],
    ["arm_swing", "arms", "arm swing", 1, 0, 3, 0.01, "x", "how far the hands swing back and forth"],
    ["arm_lift", "arms", "hands up", 0, -0.35, 0.35, 0.005, "arm", "the hands held higher (lower), in arm lengths"],
    ["arm_out", "arms", "hands out", 0, -0.3, 0.5, 0.005, "arm", "the hands held away from the body (in), in arm lengths"]
  ];
  const DIALS = DIAL_LIST.map(function (d) { return { id: d[0], region: d[1], label: d[2], neutral: d[3], min: d[4], max: d[5], step: d[6], unit: d[7], note: d[8] }; });
  const DIAL_BY_ID = {};
  DIALS.forEach(function (d) { DIAL_BY_ID[d.id] = d; });
  const AMOUNT_RANGE = [0, 2];
  // characters: the dials of a way of walking, to start from (a template style with one of them is a procedural style)
  const PERSONALITIES = [
    { key: "plain", label: "plain", note: "the template as it is", dials: {}, amounts: {} },
    { key: "confident", label: "confident", note: "long steps, the chest up, the arms swing, the hips roll a little", dials: { speed: 1.1, stride: 1.15, lift: 1.1, lean: -3, carry: 5, arm_swing: 1.3, hip_sway: 1.2 }, amounts: {} },
    { key: "tired", label: "tired", note: "slow, short steps, the feet hardly lift, the trunk and the head hang, the arms are still", dials: { speed: 0.7, stride: 0.82, lift: 0.5, bounce: 0.4, lean: 12, carry: -14, arm_swing: 0.5, hip_sway: 0.8, height: 0.97 }, amounts: {} },
    { key: "sneaky", label: "sneaky", note: "low and slow, each foot placed, the arms close", dials: { speed: 0.5, stride: 0.65, lift: 1.3, bounce: 0.3, height: 0.8, lean: 10, arm_swing: 0.25, hip_sway: 0.6, spine_twist: 0.5, look: 0.7 }, amounts: {} },
    { key: "drunk", label: "drunk", note: "the hips and the shoulders roll, the head lolls, the steps are uneven", dials: { speed: 0.8, stride: 0.85, hip_sway: 2.6, hip_twist: 2, side_bend: 2.8, spine_twist: 1.8, head_tilt: 2.4, look: 2, arm_swing: 1.4, toe_out: 8, bounce: 1.3 }, amounts: {}, variation: 0.45 },
    { key: "march", label: "march", note: "high steps, nothing sways, the arms swing hard", dials: { speed: 1.05, stride: 1.05, lift: 1.7, bounce: 0.5, hip_sway: 0.3, hip_twist: 0.4, spine_twist: 0.4, side_bend: 0.3, nod: 0.4, arm_swing: 1.9, lean: -2, roll: 0.6 }, amounts: {} },
    { key: "bouncy", label: "bouncy", note: "a spring in every step: the hips bob, the feet lift", dials: { speed: 1.2, stride: 1.05, lift: 1.7, bounce: 3, arm_swing: 1.5, hip_sway: 1.2, nod: 1.5, roll: 1.4 }, amounts: {} },
    { key: "catwalk", label: "catwalk", note: "the hips swing wide, the feet cross, the arms are quiet", dials: { speed: 0.95, stride: 0.9, hip_sway: 2.2, hip_twist: 1.8, spine_twist: 1.4, lean: -4, carry: 8, arm_swing: 0.6, toe_out: -6, height: 1.02, bounce: 0.8 }, amounts: {} },
    { key: "old", label: "old", note: "slow, short, shuffling, bent forward", dials: { speed: 0.6, stride: 0.62, lift: 0.45, bounce: 0.35, lean: 16, carry: -16, arm_swing: 0.4, hip_sway: 1.4, height: 0.94, roll: 0.5 }, amounts: {} },
    { key: "heavy", label: "heavy", note: "each step lands: wide hips, short steps, the arms out", dials: { speed: 0.75, stride: 0.8, lift: 0.7, bounce: 1.5, hip_sway: 1.7, side_bend: 1.4, arm_out: 0.1, arm_swing: 0.9, lean: 4, toe_out: 6 }, amounts: {} },
    { key: "sprint", label: "sprint", note: "fast and long, the trunk forward, the arms drive", dials: { speed: 2.3, stride: 1.6, lift: 1.6, lean: 14, arm_swing: 1.9, bounce: 1.2, hip_sway: 0.8, roll: 1.2, carry: 6 }, amounts: {} },
    { key: "robot", label: "robot", note: "rigid: no sway, no twist, no nod, the arms swing like levers", dials: { hip_sway: 0.1, hip_twist: 0.1, hip_tilt: 0.1, bounce: 0.1, spine_twist: 0.1, bend: 0.1, side_bend: 0.1, nod: 0.1, look: 0.1, head_tilt: 0.1, arm_swing: 1.3, roll: 0.2, lift: 1.3 }, amounts: {} }
  ];

  // ---- small things ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  const has = function (o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); };
  const num = function (v, d) { return typeof v === "number" && isFinite(v) ? v : d; };
  const wrap1 = function (x) { const w = x - Math.floor(x); return w >= 1 ? 0 : w; };                      // (a tiny negative x wraps to 1 in floating point: a phase is under 1)
  // a random number generator that a seed makes (mulberry32): rng(seed)() -> 0 .. 1; .normal() -> a gaussian
  function rng(seed) {
    let a = (seed === undefined ? Date.now() : seed) >>> 0;
    const next = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    next.normal = function () { const u = Math.max(1e-12, next()), v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
    next.seed = a;
    return next;
  }
  // a number that a seed and a name make, the same every time (a gaussian): the variation of a channel does not change when another is turned
  function hash_normal(seed, key) {
    let h = (seed >>> 0) ^ 0x9E3779B9;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x85EBCA6B) >>> 0;
    return rng(h >>> 0).normal();
  }
  const ident = function (s) { const t = String(s === undefined || s === null ? "" : s).replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, ""); return /^[A-Za-z_]/.test(t) ? t : (t ? "g_" + t : "design"); };

  // ---- a style's upper body as coefficients: y = mean + sum over h of (c_h cos(2 pi h u) + s_h sin(2 pi h u)), u the cycle counted from the first limb ----------------------------------------------
  function chan_in(c) {
    const o = { m: 0, c: [0, 0, 0], s: [0, 0, 0] };
    if (!Array.isArray(c) || !c.length) return o;
    o.m = num(c[0], 0);
    for (let h = 0; h < HARMS && 2 * h + 2 < c.length; h++) { const A = num(c[2 * h + 1], 0), p = TAU * num(c[2 * h + 2], 0); o.c[h] = A * Math.cos(p); o.s[h] = A * Math.sin(p); }
    return o;
  }
  // the coefficients -> a channel [mean, A1, p1, ...] (null when there is nothing in it)
  function chan_out(o, eps_m, eps_a) {
    const out = [o.m];
    let last = 0;
    const amp = [], ph = [];
    for (let h = 0; h < HARMS; h++) { const A = Math.hypot(o.c[h], o.s[h]); amp.push(A); ph.push(wrap1(Math.atan2(o.s[h], o.c[h]) / TAU)); if (A > eps_a) last = h + 1; }
    for (let h = 0; h < last; h++) out.push(amp[h], ph[h]);
    return last === 0 && Math.abs(o.m) <= eps_m ? null : out;
  }
  function parts_in(u) {
    const r = {};
    PART_ORDER.forEach(function (p) { r[p] = {}; PARTS[p].forEach(function (ax) { r[p][ax] = chan_in(u && u[p] ? u[p][ax] : null); }); });
    return r;
  }
  // moving a style's cycle to the first limb of another: the new limb steps `shift` of a cycle AFTER the style's own first one, so that the style's cycle u (counted from its own first limb) is u' + shift for the new one's u'
  // and the channel, as a function of the new cycle, is y(u' + shift): c cos(w u' + a) + s sin(w u' + a) with a = w shift is (c cos a + s sin a) cos(w u') + (s cos a - c sin a) sin(w u')
  function shifted(ch, shift) {
    const o = { m: ch.m, c: [0, 0, 0], s: [0, 0, 0] };
    for (let h = 0; h < HARMS; h++) { const a = TAU * (h + 1) * shift, ca = Math.cos(a), sa = Math.sin(a); o.c[h] = ch.c[h] * ca + ch.s[h] * sa; o.s[h] = ch.s[h] * ca - ch.c[h] * sa; }
    return o;
  }
  // the limb that steps first in a style: its upper body's `ref`, else the limb with the phase 0
  function first_limb(s) {
    if (s.upper && s.upper.ref && s.phase && s.phase[s.upper.ref] === 0) return s.upper.ref;
    const k = Object.keys(s.phase || {});
    for (let i = 0; i < k.length; i++) if (s.phase[k[i]] === 0) return k[i];
    return k[0];
  }
  // a style counted from the cycle of the limb `ref`: its phases and the harmonics of its upper body (what a mix of styles whose first limbs differ needs). A limb the style has not leaves it as it is
  function reref(s, ref) {
    const delay = s.phase && has(s.phase, ref) ? s.phase[ref] : 0;
    if (!(Math.abs(delay) > 1e-12) && first_limb(s) === ref) return s;
    const phase = {};
    Object.keys(s.phase).forEach(function (k) { phase[k] = k === ref ? 0 : wrap1(s.phase[k] - delay); });
    const out = Object.assign({}, s, { phase: phase });
    if (s.upper) {
      const pi = parts_in(s.upper), u = { ref: has(phase, ref) ? ref : s.upper.ref };
      PART_ORDER.forEach(function (p) {
        if (!s.upper[p]) return;
        u[p] = {};
        Object.keys(s.upper[p]).forEach(function (ax) { const c = chan_out(shifted(pi[p][ax], delay), 0, 0); if (c) u[p][ax] = c; });
      });
      out.upper = u;
    }
    return out;
  }

  // ---- the foot's path: knots [progress, height], 2 to 8 of them; the mix needs the same number: 8, from the knots by their index (they are at equal steps of the swing's time) --------------------------------
  function path_knots(p, n) {
    const src = p && p.length >= 2 ? p : DEFAULT_PATH, m = src.length, out = [];
    for (let j = 0; j < n; j++) {
      const x = n === 1 ? 0 : j * (m - 1) / (n - 1), i = Math.min(m - 2, Math.floor(x)), f = x - i;
      out.push([src[i][0] + (src[i + 1][0] - src[i][0]) * f, src[i][1] + (src[i + 1][1] - src[i][1]) * f]);
    }
    return out;
  }
  const seq = function (n, f) { const a = []; for (let i = 0; i < n; i++) a.push(f(i)); return a; };

  // ---- the mix ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // the shares of the styles in one region: the style's weight times its row, as shares of one. Where all are 0: equal shares for the pace and the steps (a walk has a speed), none for the parts that move (they hold still)
  function shares(items, region) {
    const w = items.map(function (it) { return Math.max(0, num(it.weight, 1)) * clamp(it.regions && has(it.regions, region) ? num(it.regions[region], 1) : 1, 0, 1); });
    const sum = w.reduce(function (a, b) { return a + b; }, 0);
    if (sum > 1e-9) return { w: w.map(function (x) { return x / sum; }), any: true };
    if (region === "pace" || region === "steps") return { w: items.map(function () { return 1 / items.length; }), any: false };
    return { w: items.map(function () { return 0; }), any: false };
  }
  const dial = function (r, id) { const d = DIAL_BY_ID[id], v = r.dials && has(r.dials, id) ? num(r.dials[id], d.neutral) : d.neutral; return clamp(v, d.min, d.max); };
  const amount = function (r, key) { return r.amounts && has(r.amounts, key) ? clamp(num(r.amounts[key], 1), AMOUNT_RANGE[0], AMOUNT_RANGE[1]) : 1; };

  // the recipe -> a style
  function blend(recipe, o) {
    o = o || {};
    const items = (recipe.styles || []).filter(function (it) { return it && it.style && num(it.weight, 1) > 0; });
    if (!items.length) throw new Error("system gait blend: a recipe needs a style with a weight above 0");
    const SH = {};
    REGION_KEYS.forEach(function (k) { SH[k] = shares(items, k); });
    // the style with the most say in the steps gives the order of the steps and the limb the cycle is counted from; the others are counted from the same limb
    let dom = 0;
    SH.steps.w.forEach(function (x, i) { if (x > SH.steps.w[dom] + 1e-12) dom = i; });
    const lead = items[dom].style, ref = first_limb(lead);
    const S = items.map(function (it) { return reref(it.style, ref); });
    const mean = function (region, f) { let a = 0; S.forEach(function (s, i) { a += SH[region].w[i] * f(s, i); }); return a; };
    const vary = recipe.variation && num(recipe.variation.amount, 0) > 0 ? { a: clamp(num(recipe.variation.amount, 0), 0, 1), seed: num(recipe.variation.seed, 1) | 0 } : null;
    const noise = function (key) { return vary ? hash_normal(vary.seed, key) : 0; };

    // the numbers
    let speed = mean("pace", function (s) { return s.speed; }) * dial(recipe, "speed"), stride = mean("pace", function (s) { return s.stride; }) * dial(recipe, "stride");
    let swing = mean("steps", function (s) { return s.swing; }) + dial(recipe, "swing"), step_height = mean("steps", function (s) { return num(s.step_height, 0); }) * dial(recipe, "lift");
    const a_hips = amount(recipe, "hips");
    let bob = mean("hips", function (s) { return num(s.bob, 0); }) * a_hips * dial(recipe, "bounce"), ride = (1 + (mean("hips", function (s) { return num(s.ride, 1); }) - 1) * a_hips) * dial(recipe, "height");
    if (!SH.hips.any) { bob = 0; ride = dial(recipe, "height"); }
    if (vary) { step_height *= Math.exp(0.2 * vary.a * noise("step_height")); bob *= Math.exp(0.25 * vary.a * noise("bob")); }
    speed = clamp(speed, 0.02, 40); stride = clamp(stride, 0.02, 20); swing = clamp(swing, 0.05, 0.8); step_height = clamp(step_height, 0, 3); bob = clamp(bob, 0, 2); ride = clamp(ride, 0.3, 2);

    // the order of the steps: the lead's limbs, each limb's phase the mean of the styles' (counted from the same first limb, along the shortest way round from the lead's)
    const phase = {};
    Object.keys(S[dom].phase).forEach(function (limb) {
      const base = S[dom].phase[limb];
      let v = 0;
      S.forEach(function (s, i) { const x = has(s.phase, limb) ? s.phase[limb] : base; v += SH.steps.w[i] * (x + Math.round(base - x)); });
      phase[limb] = limb === ref ? 0 : wrap1(v);
    });

    // the foot's path: knots of all that have one (a style without is the plain trapezoid), the same number of them for all
    let path = null;
    const with_path = S.some(function (s) { return s.path && s.path.length >= 2; });
    if (with_path || o.full) {
      path = seq(PATH_N, function () { return [0, 0]; });
      S.forEach(function (s, i) { const k = path_knots(s.path, PATH_N), w = SH.steps.w[i]; for (let j = 0; j < PATH_N; j++) { path[j][0] += w * k[j][0]; path[j][1] += w * k[j][1]; } });
      for (let j = 0; j < PATH_N; j++) { path[j][0] = clamp(path[j][0], 0, 1); path[j][1] = clamp(path[j][1] * (vary && j > 0 && j < PATH_N - 1 ? Math.exp(0.18 * vary.a * noise("path" + j)) : 1), -4, 4); }
      path[0][0] = 0; path[PATH_N - 1][0] = 1;
      for (let j = 1; j < PATH_N; j++) if (path[j][0] < path[j - 1][0]) path[j][0] = path[j - 1][0];
      path = path.map(function (k) { return [+k[0].toFixed(5), +k[1].toFixed(5)]; });
    }
    const tangent = clamp(mean("steps", function (s) { return num(s.path_tangent, 0.5); }), 0.05, 2);

    // the feet: three tables over the foot's cycle; a style without them is flat (zeros): what it does not say is not rolled
    let feet = null;
    if (S.some(function (s) { return !!s.feet; }) || o.full) {
      const a_feet = amount(recipe, "feet");
      feet = {};
      ["pitch", "yaw", "knee"].forEach(function (k) {
        const t = seq(FEET_N, function () { return 0; });
        S.forEach(function (s, i) { const w = SH.feet.w[i], src = s.feet && s.feet[k]; if (src) for (let j = 0; j < FEET_N; j++) t[j] += w * num(src[j], 0); });
        const sc = a_feet * (k === "pitch" ? dial(recipe, "roll") : (k === "knee" ? dial(recipe, "knee_out") : 1)) * (vary ? Math.exp(0.3 * vary.a * noise("feet_" + k)) : 1), add = k === "yaw" ? dial(recipe, "toe_out") : 0;
        feet[k] = t.map(function (v) { return +clamp(v * sc + add, -FEET_LIMITS[k], FEET_LIMITS[k]).toFixed(3); });
      });
    }

    // the upper body: the channels of the parts, mixed by the shares of their region, then the amounts and the dials, then the variation. A hand's table is a PLACE (a creature without one keeps its own arms): a style that has no
    // table for a hand has no say in it, and a hand that no style has a table for is not given one
    // The CHEST is not the spine's own bend alone: its motion in the world is the hips' plus the spine's (the spine is a child of the hips: a roll of the pelvis carries the whole upper body unless the spine bends back, which is
    // what a walk records: a pelvis that rolls 5 degrees under a chest that rolls 2). So the spine region is made of the chest's own motion, its styles' hips and spine channels together (the amount and the dials of the spine
    // say how far the CHEST moves), less the hips as they are made: the dials, the amount and the weights of the hips move the pelvis and nothing above it
    const PI = S.map(function (s) { return parts_in(s.upper); });
    const out_parts = {}, hips_made = {};
    REGION_KEYS.forEach(function (region) {
      if (!UPPER_OF[region]) return;
      const amt = amount(recipe, region);
      UPPER_OF[region].forEach(function (p) {
        const hand = p.indexOf("arm") === 0;
        let w = SH[region].w.slice(), any = SH[region].any;
        if (hand) {
          w = w.map(function (x, i) { return S[i].upper && S[i].upper[p] && Object.keys(S[i].upper[p]).length ? x : 0; });
          const sum = w.reduce(function (a2, b2) { return a2 + b2; }, 0);
          if (!(sum > 1e-9)) return;
          w = w.map(function (x) { return x / sum; });
          any = true;
        }
        const parts = {};
        PARTS[p].forEach(function (ax) {
          const c = { m: 0, c: [0, 0, 0], s: [0, 0, 0] };
          PI.forEach(function (pi, i) {
            const ch = pi[p][ax], up = p === "spine" ? pi.hips[ax] : null;                               // (the chest of a style: its hips and its spine)
            c.m += w[i] * (ch.m + (up ? up.m : 0));
            for (let h = 0; h < HARMS; h++) { c.c[h] += w[i] * (ch.c[h] + (up ? up.c[h] : 0)); c.s[h] += w[i] * (ch.s[h] + (up ? up.s[h] : 0)); }
          });
          // what the dials of the part say of this channel: how much of the swing (k), a number added to the mean (add)
          let k = 1, add = 0;
          if (p === "hips") k = dial(recipe, ax === "roll" ? "hip_sway" : (ax === "yaw" ? "hip_twist" : "hip_tilt"));
          else if (p === "spine") { k = dial(recipe, ax === "yaw" ? "spine_twist" : (ax === "pitch" ? "bend" : "side_bend")); if (ax === "pitch") add = -dial(recipe, "lean"); }
          else if (p === "neck" || p === "head") { k = dial(recipe, ax === "pitch" ? "nod" : (ax === "yaw" ? "look" : "head_tilt")); if (ax === "pitch") add = 0.5 * dial(recipe, "carry"); }
          else { if (ax === "z") k = dial(recipe, "arm_swing"); if (ax === "y") add = dial(recipe, "arm_lift"); if (ax === "x") add = dial(recipe, "arm_out"); }
          c.m = hand ? c.m + add : c.m * amt + add;                                         // (an angle's mean is a posture, which the amount holds; a hand's is a place, kept)
          for (let h = 0; h < HARMS; h++) { c.c[h] *= amt * k; c.s[h] *= amt * k; }
          if (vary && any) {
            const g = Math.exp(0.35 * vary.a * noise(p + "." + ax));
            for (let h = 0; h < HARMS; h++) {
              const a2 = TAU * 0.08 * vary.a * noise(p + "." + ax + ".p" + h), ca = Math.cos(a2), sa = Math.sin(a2), x = c.c[h] * g, y = c.s[h] * g;
              c.c[h] = x * ca - y * sa; c.s[h] = x * sa + y * ca;
            }
            c.m += (hand ? 0.03 : 3) * vary.a * noise(p + "." + ax + ".m");
          }
          if (p === "hips") hips_made[ax] = { m: c.m, c: c.c.slice(), s: c.s.slice() };                 // (the pelvis as it is made: what the spine gives back)
          if (p === "spine" && hips_made[ax]) { const hm = hips_made[ax]; c.m -= hm.m; for (let h = 0; h < HARMS; h++) { c.c[h] -= hm.c[h]; c.s[h] -= hm.s[h]; } }
          const lim = hand ? 2 : 90, mlim = hand ? 3 : 180;
          c.m = clamp(c.m, -mlim, mlim);
          for (let h = 0; h < HARMS; h++) { const A = Math.hypot(c.c[h], c.s[h]); if (A > lim) { c.c[h] *= lim / A; c.s[h] *= lim / A; } }
          const ch = chan_out(c, 0.0005, 0.0005);
          if (ch) parts[ax] = ch.map(function (v, i) { const r = +v.toFixed(4 + (i > 0 && i % 2 === 0 ? 1 : 0)); return i > 0 && i % 2 === 0 && r >= 1 ? 0 : r; });          // (a phase that rounds to 1 is 0: kernel.js wants it under 1)
        });
        if (Object.keys(parts).length) out_parts[p] = parts;
      });
    });
    const upper = Object.keys(out_parts).length || o.full ? Object.assign({ ref: ref }, out_parts) : null;

    const count = Object.keys(phase).length;
    const name = typeof recipe.name === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(recipe.name) ? recipe.name : ident(recipe.name || "design");          // (a name that begins with _ is a page's own: the gait designer's live style)
    const names = items.map(function (it) { return it.style.name; });
    const style = { name: name, species: "designed", source: "gait designer: " + names.join(" + "), legs: count, pattern: lead.pattern || (count === 2 ? "alternate" : "walk"), tags: [], generic: false,
      speed: +speed.toFixed(4), stride: +stride.toFixed(4), swing: +swing.toFixed(4), step_height: +step_height.toFixed(4), bob: +bob.toFixed(4), ride: +ride.toFixed(4), cycle: +(2 * stride / speed).toFixed(4), phase: phase, path_tangent: +tangent.toFixed(4), description: "" };
    if (path) style.path = path;
    if (feet) style.feet = feet;
    if (upper) style.upper = upper;
    style.tags = tags_of(style, recipe, items);
    style.description = typeof recipe.description === "string" && recipe.description ? recipe.description : describe(style, items);
    return style;
  }

  function tags_of(style, recipe, items) {
    const t = ["designed"];
    if (items.length > 1) t.push("blend");
    if (style.pattern) t.push(style.pattern);
    t.push(style.speed < 1 ? "slow" : (style.speed < 2.2 ? "medium" : "fast"));
    if (recipe.personality && recipe.personality !== "plain") t.push(recipe.personality);
    return t;
  }

  // ---- words ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const f1 = function (v) { return (Math.round(v * 10) / 10).toFixed(1); };
  const f2 = function (v) { return (Math.round(v * 100) / 100).toFixed(2); };
  const amp1 = function (c) { return c && c.length > 1 ? c[1] : 0; };
  // what a style does, in words
  function describe(s, items) {
    const bits = [f2(s.speed) + " leg lengths a second, a stride of " + f2(s.stride) + ", " + Math.round(100 * s.swing) + " % of the cycle in the air, a foot lifting " + f2(s.step_height)];
    const u = s.upper;
    if (u) {
      const w = [];
      if (u.arm_l || u.arm_r) { const z = Math.max(amp1(u.arm_l && u.arm_l.z), amp1(u.arm_r && u.arm_r.z)); w.push(z > 0.03 ? "hands swing " + f2(z) + " of an arm" : "hands held"); }
      const swing_of = function (ax) { const a = curve(s, "hips", ax, 32), b = curve(s, "spine", ax, 32), y = a.map(function (v, i) { return v + b[i]; }); return (Math.max.apply(null, y) - Math.min.apply(null, y)) / 2; };          // (the chest in the world: the hips' and the spine's together)
      const lean = (u.hips && u.hips.pitch ? u.hips.pitch[0] : 0) + (u.spine && u.spine.pitch ? u.spine.pitch[0] : 0);
      if (u.spine && swing_of("yaw") > 0.5) w.push("the chest twists " + f1(swing_of("yaw")) + " degrees");
      if (Math.abs(lean) >= 1) w.push((lean < 0 ? "leans forward " : "leans back ") + Math.round(Math.abs(lean)) + " degrees");
      if (u.hips && u.hips.roll && amp1(u.hips.roll) > 0.5) w.push("the hips roll " + f1(amp1(u.hips.roll)) + " degrees");
      if (u.head && u.head.pitch && Math.abs(u.head.pitch[0]) >= 8) w.push("the head " + (u.head.pitch[0] < 0 ? "down " : "up ") + Math.round(Math.abs(u.head.pitch[0])));
      bits.push(w.length ? w.join(", ") : "an upper body that hardly moves");
    } else bits.push("no upper body (the legs only)");
    if (items && items.length > 1) {
      const sum = items.reduce(function (a, it) { return a + Math.max(0, num(it.weight, 1)); }, 0) || 1;
      bits.unshift("a mix of " + items.map(function (it) { return it.style.name + " " + Math.round(100 * Math.max(0, num(it.weight, 1)) / sum) + " %"; }).join(", "));
    }
    return bits.join("; ");
  }
  // n numbers of one cycle of a channel of a style's upper body (for a picture of it)
  function curve(s, part, axis, n) {
    n = n || 64;
    const c = chan_in(s.upper && s.upper[part] ? s.upper[part][axis] : null), out = [];
    for (let i = 0; i < n; i++) { const u = i / n; let y = c.m; for (let h = 0; h < HARMS; h++) y += c.c[h] * Math.cos(TAU * (h + 1) * u) + c.s[h] * Math.sin(TAU * (h + 1) * u); out.push(y); }
    return out;
  }

  // ---- recipes ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const neutral_dials = function () { const d = {}; DIALS.forEach(function (x) { d[x.id] = x.neutral; }); return d; };
  const neutral_amounts = function () { const a = {}; REGIONS.forEach(function (r) { if (r.amount) a[r.key] = 1; }); return a; };
  const neutral_regions = function () { const a = {}; REGION_KEYS.forEach(function (k) { a[k] = 1; }); return a; };
  function default_recipe(styles) {
    return { name: "design", styles: (styles || []).map(function (s, i) { return { style: s, weight: 1 / Math.max(1, styles.length), regions: neutral_regions() }; }), amounts: neutral_amounts(), dials: neutral_dials(), variation: { amount: 0, seed: 1 }, personality: "plain" };
  }
  const recipe_of = function (style) { const r = default_recipe([style]); r.styles[0].weight = 1; r.name = style.name + "_copy"; return r; };
  // the style that a procedural walk starts from: the plain walk of its legs (person_walk for two, a generic walk of that many legs), else the first style that has the legs
  function template_of(styles, legs) {
    const of = styles.filter(function (s) { return s.legs === legs; });
    const pick = function (f) { return of.filter(f)[0]; };
    return pick(function (s) { return s.name === "person_walk"; }) || pick(function (s) { return s.generic && /walk|alternate/.test(s.pattern) && /walk/.test(s.name); }) || pick(function (s) { return s.generic && /walk|alternate/.test(s.pattern); }) || pick(function (s) { return /walk/.test(s.name); }) || of[0] || null;
  }
  // dials at random: each a gaussian turn from the neutral (a share by its logarithm, a number added by its range), kept in a range that a person might walk in; `strength` 0 .. 2 how far they go (1: a walk you would see in a crowd)
  const RANDOM_LIMITS = { speed: [0.6, 1.7], stride: [0.65, 1.5], height: [0.82, 1.08], lift: [0.3, 2.2], bounce: [0.2, 3], roll: [0.2, 2], knee_out: [0.3, 2.5] };
  function random_dials(r, strength) {
    strength = num(strength, 1);
    const d = neutral_dials();
    DIALS.forEach(function (x) {
      const n = r.normal(), lim = RANDOM_LIMITS[x.id];
      if (x.id === "height") d[x.id] = 1 + 0.06 * strength * n;
      else if (x.unit === "x") d[x.id] = Math.exp(0.35 * strength * n);
      else d[x.id] = x.neutral + n * 0.1 * strength * (x.max - x.min) * (x.id === "swing" ? 0.5 : 1);
      d[x.id] = clamp(d[x.id], lim ? Math.max(x.min, lim[0]) : x.min, lim ? Math.min(x.max, lim[1]) : x.max);
    });
    return d;
  }
  // a procedural recipe: one template, a personality (a set of dials) or dials at random, the variation of the seed
  function procedural(template, personality, seed, o) {
    o = o || {};
    const r = rng(seed), recipe = default_recipe([template]);
    recipe.styles[0].weight = 1;
    recipe.name = o.name || ((template.name || "design") + "_" + (personality && personality.key ? personality.key : "random"));
    recipe.variation = { amount: o.variation !== undefined ? o.variation : (personality && personality.variation !== undefined ? personality.variation : 0.25), seed: (seed >>> 0) };
    if (personality && personality.dials) {
      const d = neutral_dials();
      Object.keys(personality.dials).forEach(function (k) { if (DIAL_BY_ID[k]) d[k] = clamp(personality.dials[k], DIAL_BY_ID[k].min, DIAL_BY_ID[k].max); });
      const jit = num(o.jitter, 0.06);                                                      // (a personality is not exactly its table: each dial is a little off, by the seed)
      if (jit > 0) DIALS.forEach(function (x) { if (x.unit === "x") d[x.id] = clamp(d[x.id] * Math.exp(jit * r.normal()), x.min, x.max); else d[x.id] = clamp(d[x.id] + jit * (x.max - x.min) * 0.25 * r.normal(), x.min, x.max); });
      recipe.dials = d;
      recipe.personality = personality.key;
      if (personality.amounts) Object.keys(personality.amounts).forEach(function (k) { recipe.amounts[k] = personality.amounts[k]; });
    } else { recipe.dials = random_dials(r, num(o.strength, 1)); recipe.personality = "random"; }
    return recipe;
  }
  // dirichlet shares of n (a small concentration gives one style most of a part, a large one gives them all alike)
  function dirichlet(r, n, alpha) {
    const g = seq(n, function () { const k = alpha; let x = 0; if (k < 1) { const u = Math.max(1e-9, r()); x = gamma(r, k + 1) * Math.pow(u, 1 / k); } else x = gamma(r, k); return x; }), s = g.reduce(function (a, b) { return a + b; }, 0) || 1;
    return g.map(function (x) { return x / s; });
  }
  function gamma(r, k) {                                                                      // (Marsaglia and Tsang)
    const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (let g = 0; g < 50; g++) { let x, v; do { x = r.normal(); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = Math.max(1e-12, r()); if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v; }
    return d;
  }
  // a random mix of the pool's styles: o.count (2 .. 4 styles: the number), o.chaos (0 .. 1: 0 the parts of a walk all go the same way, 1 each part has its own style), o.dials (the strength of random dials, 0: none), o.amounts (how far the amounts stray)
  function random_mix(pool, r, o) {
    o = o || {};
    if (!pool || !pool.length) throw new Error("system gait blend: random_mix needs styles to choose from");
    const count = Math.max(1, Math.min(pool.length, o.count || (2 + Math.floor(r() * 3)))), chaos = clamp(num(o.chaos, 0.6), 0, 1);
    const left = pool.slice(), picked = [];
    while (picked.length < count && left.length) picked.push(left.splice(Math.floor(r() * left.length), 1)[0]);
    const recipe = default_recipe(picked), master = dirichlet(r, picked.length, 2.5);
    recipe.name = o.name || "design";
    recipe.styles.forEach(function (it, i) { it.weight = +master[i].toFixed(3); });
    const alpha = 3.2 - 2.9 * chaos;
    REGION_KEYS.forEach(function (k) {
      const sh = dirichlet(r, picked.length, alpha), top = Math.max.apply(null, sh);
      recipe.styles.forEach(function (it, i) { it.regions[k] = +clamp(sh[i] / top, 0, 1).toFixed(3); });
    });
    const sd = num(o.amounts, 0.25) * chaos;
    Object.keys(recipe.amounts).forEach(function (k) { recipe.amounts[k] = +clamp(Math.exp(sd * r.normal()), 0.4, 1.8).toFixed(3); });
    if (num(o.dials, 0) > 0) recipe.dials = random_dials(r, o.dials);
    recipe.variation = { amount: num(o.variation, 0), seed: Math.floor(r() * 1e9) };
    recipe.personality = "random";
    return recipe;
  }
  // a recipe moved a little (strength 0 .. 1): weights and rows nudged, amounts and dials too, now and then a style replaced by one of the pool
  function mutate(recipe, r, strength, pool) {
    strength = num(strength, 0.3);
    const out = JSON.parse(JSON.stringify(recipe, function (k, v) { return k === "style" ? undefined : v; }));
    out.styles = recipe.styles.map(function (it, i) { return { style: it.style, weight: clamp(num(it.weight, 1) + r.normal() * 0.25 * strength, 0, 1), regions: Object.assign({}, it.regions) }; });
    out.styles.forEach(function (it) { REGION_KEYS.forEach(function (k) { it.regions[k] = +clamp(num(it.regions[k], 1) + r.normal() * 0.3 * strength, 0, 1).toFixed(3); }); it.weight = +it.weight.toFixed(3); });
    if (!out.styles.some(function (it) { return it.weight > 0.01; })) out.styles[0].weight = 0.5;
    out.amounts = Object.assign({}, recipe.amounts);
    Object.keys(out.amounts).forEach(function (k) { out.amounts[k] = +clamp(out.amounts[k] * Math.exp(0.25 * strength * r.normal()), 0.2, 1.9).toFixed(3); });
    out.dials = Object.assign({}, neutral_dials(), recipe.dials);
    DIALS.forEach(function (x) { if (x.unit === "x") out.dials[x.id] = +clamp(out.dials[x.id] * Math.exp(0.2 * strength * r.normal()), x.min, x.max).toFixed(3); else out.dials[x.id] = +clamp(out.dials[x.id] + r.normal() * 0.08 * strength * (x.max - x.min), x.min, x.max).toFixed(3); });
    if (pool && pool.length && r() < 0.35 * strength) {
      const i = Math.floor(r() * out.styles.length), s = pool[Math.floor(r() * pool.length)];
      if (!out.styles.some(function (it) { return it.style.name === s.name; })) out.styles[i] = { style: s, weight: out.styles[i].weight, regions: out.styles[i].regions };
    }
    out.variation = { amount: num(recipe.variation && recipe.variation.amount, 0), seed: Math.floor(r() * 1e9) };
    return out;
  }

  // A RECIPE kept in a file: the styles by name, the weights, the rows, the amounts, the dials and the variation (what a seed and a hand made), so that a walk can be opened again and turned further (the style that comes out
  // of it is kept apart: happy_gaits/designed.gaits.json). recipe_json(recipe) -> a plain object; recipe_from(json, lookup) -> { recipe, missing }: lookup(name) gives the style of that name (null: it is not in the libraries now:
  // it is left out and said). Every number is put back in its range, a dial or an amount the file does not know is dropped, more than MAX_MIX styles are cut: what comes out is a recipe that blend() takes
  const MAX_MIX = 8;
  function recipe_json(recipe) {
    const r4 = function (v, d) { return +num(v, d).toFixed(4); };
    return { name: recipe.name, styles: recipe.styles.map(function (it) { const rg = {}; REGION_KEYS.forEach(function (k) { rg[k] = r4(it.regions && it.regions[k], 1); }); return { style: it.style.name, weight: r4(it.weight, 1), regions: rg }; }),
      amounts: Object.keys(recipe.amounts).reduce(function (o, k) { o[k] = r4(recipe.amounts[k], 1); return o; }, {}), dials: DIALS.reduce(function (o, d) { o[d.id] = r4(recipe.dials && recipe.dials[d.id], d.neutral); return o; }, {}),
      variation: { amount: r4(recipe.variation && recipe.variation.amount, 0), seed: (num(recipe.variation && recipe.variation.seed, 1) >>> 0) }, personality: recipe.personality || "plain" };
  }
  function recipe_from(j, lookup) {
    if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error("a recipe is an object");
    const out = default_recipe([]), missing = [], list = Array.isArray(j.styles) ? j.styles : [];
    out.name = ident(typeof j.name === "string" && j.name ? j.name : "design");
    list.forEach(function (it, i) {
      const name = it && typeof it === "object" ? (typeof it.style === "string" ? it.style : it.name) : null;
      if (typeof name !== "string" || !name) { missing.push("(a style with no name)"); return; }
      const st = lookup(name);
      if (!st) { missing.push(name); return; }
      if (out.styles.length >= MAX_MIX) { missing.push(name + " (more than " + MAX_MIX + " styles)"); return; }
      if (out.styles.some(function (x) { return x.style.name === name; })) return;
      const regions = neutral_regions();
      REGION_KEYS.forEach(function (k) { if (it.regions && typeof it.regions[k] === "number" && isFinite(it.regions[k])) regions[k] = clamp(it.regions[k], 0, 1); });
      out.styles.push({ style: st, weight: clamp(num(it.weight, 1), 0, 1), regions: regions });
    });
    DIALS.forEach(function (d) { if (j.dials && typeof j.dials[d.id] === "number" && isFinite(j.dials[d.id])) out.dials[d.id] = clamp(j.dials[d.id], d.min, d.max); });
    Object.keys(out.amounts).forEach(function (k) { if (j.amounts && typeof j.amounts[k] === "number" && isFinite(j.amounts[k])) out.amounts[k] = clamp(j.amounts[k], AMOUNT_RANGE[0], AMOUNT_RANGE[1]); });
    if (j.variation && typeof j.variation === "object") out.variation = { amount: clamp(num(j.variation.amount, 0), 0, 1), seed: num(j.variation.seed, 1) >>> 0 };
    out.personality = typeof j.personality === "string" && (j.personality === "random" || PERSONALITIES.some(function (p) { return p.key === j.personality; })) ? j.personality : "plain";
    if (out.styles.length && !out.styles.some(function (x) { return x.weight > 0; })) out.styles[0].weight = 1;
    return { recipe: out, missing: missing };
  }

  // ---- the SIMPLE sliders (the window's top: a few sliders, as the Blend Styles and the Tweaks of Poser's Walk Designer) -------------------------------------------------------------------------------------------
  // A TWEAK is a slider from -100 to +100 percent over one dial: 0 is the dial as it is at rest, -100 is the value `lo`, +100 the value `hi` (what is meant by "none at all" and "a lot"): [key, label, dial, lo, hi, note]
  const TWEAK_LIST = [
    ["stride", "Stride", "stride", 0.4, 1.8, "how long a step is"],
    ["lift", "Leg Lift", "lift", 0, 2, "how high the feet lift"],
    ["hip_sway", "Hip Swing", "hip_sway", 0, 2.5, "how far the hips rock from side to side (the chest keeps its own)"],
    ["bounce", "Bounce", "bounce", 0, 3, "how far the body bobs up and down"],
    ["arm_swing", "Arm Swing", "arm_swing", 0, 2.5, "how far the arms swing"],
    ["arm_out", "Arm Out", "arm_out", -0.2, 0.4, "the arms held away from the body (in, below 0)"],
    ["lean", "Lean", "lean", -15, 25, "the trunk leaned forward (back, below 0)"],
    ["height", "Hip Height", "height", 0.7, 1.1, "how high the hips ride: a crouch below 0, up on the toes above"]
  ];
  const TWEAKS = TWEAK_LIST.map(function (x) { return { key: x[0], label: x[1], dial: x[2], lo: x[3], hi: x[4], note: x[5] }; });
  const TWEAK_BY_KEY = {};
  TWEAKS.forEach(function (x) { TWEAK_BY_KEY[x.key] = x; });
  // percent -> the dial's value, and the dial's value -> percent (a dial turned further than the tweak reaches shows as the end of the slider)
  function tweak_value(tw, pct) {
    const d = DIAL_BY_ID[tw.dial], p = clamp(num(pct, 0), -100, 100);
    return +(p >= 0 ? d.neutral + p / 100 * (tw.hi - d.neutral) : d.neutral + (-p / 100) * (tw.lo - d.neutral)).toFixed(4);
  }
  function tweak_percent(tw, v) {
    const d = DIAL_BY_ID[tw.dial];
    v = num(v, d.neutral);
    if (v >= d.neutral) return tw.hi > d.neutral ? clamp((v - d.neutral) / (tw.hi - d.neutral) * 100, -100, 100) : 0;
    return tw.lo < d.neutral ? clamp(-(d.neutral - v) / (d.neutral - tw.lo) * 100, -100, 100) : 0;
  }
  // The styles that the Blend Styles sliders mix in over the base walk, by the number of legs: Poser's Run, Shuffle, Stomp, Strong and Strut for a person, the gaits of an animal for four legs; any other number of legs gets a
  // spread of what the libraries have (slowest to fastest). [label, [the first style of these names that the libraries have]]
  const STYLE_SETS = {
    2: { base: ["person_walk", "biped_walk"], styles: [["Run", ["person_run", "biped_run"]], ["Shuffle", ["cmu_142_07_elderlyman", "person_walk_creeping"]], ["Stomp", ["person_walk_mad", "person_walk_power"]], ["Strong", ["cmu_137_42_strong_man_walk", "person_walk_power"]],
      ["Strut", ["person_walk_strut", "cmu_82_09_confident_walk_forward"]]] },
    4: { base: ["quad_walk"], styles: [["Trot", ["mule_trot"]], ["Gallop", ["quad_gallop"]], ["Bound", ["quad_bound"]], ["Pronk", ["quad_pronk"]], ["Prowl", ["lion_walk"]]] }
  };
  const pretty = function (name) { const s = String(name).replace(/^(person|biped|quad|cmu_d+_d+)_?/, "").replace(/_/g, " ").trim() || String(name); return s.charAt(0).toUpperCase() + s.slice(1); };
  // style_set(legs, lookup, all) -> { base: style | null (the base walk), styles: [{ key, label, style }] }. lookup(name) -> a style or null; all: the styles that have that many legs (for a number of legs that has no set above)
  function style_set(legs, lookup, all) {
    const def = STYLE_SETS[legs], out = { base: null, styles: [] }, seen = {};
    if (def) {
      for (let i = 0; i < def.base.length && !out.base; i++) out.base = lookup(def.base[i]) || null;
      def.styles.forEach(function (x) {
        for (let i = 0; i < x[1].length; i++) {
          const st = lookup(x[1][i]);
          if (st && !seen[st.name] && (!out.base || st.name !== out.base.name)) { seen[st.name] = true; out.styles.push({ key: x[0].toLowerCase(), label: x[0], style: st }); return; }
        }
      });
      return out;
    }
    const list = (all || []).filter(function (s) { return s.legs === legs && s.name.charAt(0) !== "_"; }).sort(function (a, b) { return a.speed - b.speed; });
    if (list.length < 2) return out;
    const n = Math.min(5, list.length);
    for (let i = 0; i < n; i++) { const st = list[n === 1 ? 0 : Math.round(i * (list.length - 1) / (n - 1))]; if (!seen[st.name]) { seen[st.name] = true; out.styles.push({ key: st.name, label: pretty(st.name), style: st }); } }
    return out;
  }
  // The base walk has what the others leave: 1 less their weights (none at all when they come to 1 or more: it leaves the mix). `base`: the base walk's style (null: there is none)
  function simple_rebalance(recipe, base) {
    if (!base) return;
    const bi = recipe.styles.findIndex(function (it) { return it.style.name === base.name; });
    let others = 0;
    recipe.styles.forEach(function (it, i) { if (i !== bi) others += it.weight; });
    if (bi >= 0) { if (others >= 1 - 1e-9) recipe.styles.splice(bi, 1); else recipe.styles[bi].weight = +(1 - others).toFixed(4); }
    else if (others < 1 - 1e-9) recipe.styles.unshift({ style: base, weight: +(1 - others).toFixed(4), regions: neutral_regions() });
  }
  // one Blend Styles slider: the share (0 .. 100 percent) of style `def.style` in the mix; the base walk takes the rest. -> true when the recipe changed in structure (a style came in or went out)
  function simple_style(recipe, set, key, pct) {
    const def = set.styles.filter(function (x) { return x.key === key; })[0];
    if (!def) return false;
    const p = clamp(num(pct, 0), 0, 100), names = function () { return recipe.styles.map(function (x) { return x.style.name; }).join(","); }, before = names();
    const it = recipe.styles.filter(function (x) { return x.style.name === def.style.name; })[0];
    if (p <= 0) { if (it) recipe.styles.splice(recipe.styles.indexOf(it), 1); }
    else if (it) it.weight = +(p / 100).toFixed(4);
    else if (recipe.styles.length < MAX_MIX) recipe.styles.push({ style: def.style, weight: +(p / 100).toFixed(4), regions: neutral_regions() });
    simple_rebalance(recipe, set.base);
    return names() !== before;
  }
  // what a slider says now: 0 .. 100
  function simple_percent(recipe, def) {
    const it = recipe.styles.filter(function (x) { return x.style.name === def.style.name; })[0];
    return it ? Math.round(100 * clamp(it.weight, 0, 1)) : 0;
  }

  return { REGIONS: REGIONS, DIALS: DIALS, PERSONALITIES: PERSONALITIES, MAX_MIX: MAX_MIX, TWEAKS: TWEAKS, TWEAK_BY_KEY: TWEAK_BY_KEY, STYLE_SETS: STYLE_SETS, tweak_value: tweak_value, tweak_percent: tweak_percent, style_set: style_set, simple_style: simple_style, simple_rebalance: simple_rebalance, simple_percent: simple_percent,
    recipe_json: recipe_json, recipe_from: recipe_from, PARTS: PARTS, UPPER_OF: UPPER_OF, AMOUNT_RANGE: AMOUNT_RANGE, blend: blend, default_recipe: default_recipe, recipe_of: recipe_of, random_mix: random_mix, mutate: mutate, procedural: procedural, random_dials: random_dials,
    template_of: template_of, rng: rng, describe: describe, curve: curve, reref: reref, first_limb: first_limb, neutral_dials: neutral_dials, neutral_amounts: neutral_amounts, neutral_regions: neutral_regions, ident: ident, chan_in: chan_in, chan_out: chan_out, shifted: shifted, path_knots: path_knots };
});

// ========================================================================================================================
// world_nav
// ========================================================================================================================
packing()("happy_world_nav", function happy_world_nav() {
  "use strict";
  // HAPPY WORLD NAV: where creatures may stand and how those places connect, baked from the world's WALKABLE SURFACES (SYSTEM.md). Pure JS: the page bakes it (the spawner needs it) and every worker bakes the same
  // spec again, so only the spec crosses between them. Nothing here knows a creature: an AGENT PROFILE ({ radius, height, step, slope, drop }) says who is asking, and each profile has its own bake (a mouse cannot stand
  // where a person can: the stairs are too high for it, the doorway too narrow for an elephant).
  //
  //   const nav = create(spec)        spec (world/world_spec.js `w.spec()`):
  //     spec.nav      { cell: 0.25, bounds: [x0, z0, x1, z1], agents: { person: { radius, height, step, slope, drop } }, default_agent: "person" }
  //     spec.ground   { y } | null     the flat plane everywhere inside the bounds (the walkable-surface provider of the day: a terrain replaces it, see add_provider)
  //     spec.boxes    [{ id, group, pos: [x, y, z] (centre), half: [hx, hy, hz], yaw, walk, block }]   STATIC boxes: `walk` its top is a floor, `block` it stops walking (a wall, a rail, a crate)
  //     spec.stairs   [{ id, group, pos: [x, y, z] (the middle of the first step's front edge, on the lower floor), yaw, width, count, step_h, step_d }]      the run goes along the yaw's forward (sin yaw, cos yaw)
  //     spec.ramps    [{ id, group, pos, yaw, width, length, rise }]
  //     spec.links    [{ id, kind: "climb" | "jump" | "ledge", a: [x, y, z], b: [x, y, z], bidir, cost }]    what the geometry cannot say: a ladder, a ledge
  //     spec.doors    [{ id, gate, pos: [x, y, z] (the floor at the door's middle), yaw, width, thick, height, key }]   a doorway: its cells are a GATE (open / closed / locked), not a wall
  //     spec.zones    [{ name, rect: [x0, z0, x1, z1], y: [y0, y1] }]
  //   A STAIR is declared with its step height and depth; a profile whose `step` is lower than `step_h` cannot climb it. An OPEN EDGE (a floor with nothing beside it) is not walked off (there is no cell there),
  //   and `unguarded(profile)` lists the ones that no rail or wall covers: the world's builders put rails on them, a test asserts there are none.
  //   nav.nearest(x, y, z, profile, max_d, out) -> node | -1       out: { x, y, z } (optional)
  //   nav.path(profile, ax, ay, az, bx, by, bz, opts, out) -> points | -1      out: Float32Array of 5 a point: x, y, z, link (a link's number + 1 that is crossed to reach it, 0: none), flags (1 stairs, 2 ramp, 4 gate)
  //        opts: { keys (bit mask of the keys it holds), max_nodes (20000), snap (2 m: how far from a node the ends may be), smooth (true), partial (false: the nearest it can get when the goal cannot be reached) }
  //   nav.reachable(profile, ax, ay, az, bx, by, bz, keys) -> bool       nav.random_in_zone(profile, zone, rnd, out) -> bool (rnd: a function giving 0 .. 1)      nav.zones_at(x, y, z, out) -> count
  //   nav.set_gate(gate, state)    0 open, 1 closed (it opens when walked at: a small cost), 2 locked (only its key passes)      nav.rebuild([x0, z0, x1, z1]) -> tiles baked again (a terrain changed there)
  //   nav.add_provider({ id, aabb, heights(x, z, out) -> n })   out gets (y, flags, group) triples: another walkable surface, which `rebuild` takes into account
  // Node ids are (tile << 12 | local): a tile is 16 x 16 cells, so a change of the ground bakes only its tiles. Node arrays are typed; a search allocates nothing but its heap's growth. Node 14: no optional chaining, no ??.
  const TILE = 16, TSHIFT = 12, LMASK = 4095, MAX_LAYERS = 16;
  const F_STAIRS = 1, F_RAMP = 2, F_GATE = 4;
  const HASH = 4;                                                                                        // (metres: the cell of the hash that finds the patches and the obstacles near a point)
  const DEFAULT_AGENTS = {
    small: { radius: 0.2, height: 0.6, step: 0.08, slope: 30, drop: 0.15 },
    person: { radius: 0.3, height: 1.8, step: 0.4, slope: 40, drop: 0.5 },
    large: { radius: 0.7, height: 3.0, step: 0.6, slope: 35, drop: 0.8 }
  };
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1];
  const DIST = [1, 1, 1, 1, 1.41421356, 1.41421356, 1.41421356, 1.41421356];

  // ---- the geometry of the spec as a walkable-surface provider and a list of obstacles, in a hash
  function hash_key(gx, gz) { return (gx + 4096) * 8192 + (gz + 4096); }
  function make_hash() {
    const m = new Map();
    return {
      add: function (aabb, item) {
        const g0 = Math.floor(aabb[0] / HASH), g1 = Math.floor(aabb[2] / HASH), h0 = Math.floor(aabb[1] / HASH), h1 = Math.floor(aabb[3] / HASH);
        for (let gx = g0; gx <= g1; gx++) for (let gz = h0; gz <= h1; gz++) { const k = hash_key(gx, gz); let l = m.get(k); if (!l) { l = []; m.set(k, l); } l.push(item); }
      },
      at: function (x, z) { return m.get(hash_key(Math.floor(x / HASH), Math.floor(z / HASH))) || null; }
    };
  }
  function rect_aabb(ox, oz, c, s, x0, z0, x1, z1, pad) {                                                // the box round an oriented rectangle: local x0 .. x1 (across), z0 .. z1 (along)
    let mnx = Infinity, mnz = Infinity, mxx = -Infinity, mxz = -Infinity;
    for (let i = 0; i < 4; i++) {
      const lx = i & 1 ? x1 : x0, lz = i & 2 ? z1 : z0, wx = ox + lx * c + lz * s, wz = oz - lx * s + lz * c;
      if (wx < mnx) mnx = wx; if (wx > mxx) mxx = wx; if (wz < mnz) mnz = wz; if (wz > mxz) mxz = wz;
    }
    return [mnx - pad, mnz - pad, mxx + pad, mxz + pad];
  }
  function geometry(spec, pad) {                                                                          // pad: the widest agent's radius (an obstacle is found from a point that is a radius away from it)
    const patches = new Map(), obstacles = make_hash(), surf = make_hash(), doors = make_hash(), list_patches = [];
    const patch_hash = surf;
    const add_patch = function (p) { list_patches.push(p); patch_hash.add(p.aabb, p); };
    (spec.boxes || []).forEach(function (b) {
      const c = Math.cos(b.yaw || 0), s = Math.sin(b.yaw || 0), hx = b.half[0], hy = b.half[1], hz = b.half[2];
      if (b.walk && !b.pitch) add_patch({ kind: 0, group: b.group || 0, ox: b.pos[0], oz: b.pos[2], c: c, s: s, hx: hx, z0: -hz, z1: hz, y0: b.pos[1] + hy, flags: 0, aabb: rect_aabb(b.pos[0], b.pos[2], c, s, -hx, -hz, hx, hz, 0) });
      if (b.block) obstacles.add(rect_aabb(b.pos[0], b.pos[2], c, s, -hx, -hz, hx, hz, pad), { ox: b.pos[0], oz: b.pos[2], c: c, s: s, hx: hx, hz: hz, bottom: b.pos[1] - hy, top: b.pos[1] + hy, group: b.group || 0 });
    });
    (spec.stairs || []).forEach(function (st) {
      const c = Math.cos(st.yaw || 0), s = Math.sin(st.yaw || 0), len = st.count * st.step_d;
      add_patch({ kind: 2, group: st.group || 0, ox: st.pos[0], oz: st.pos[2], c: c, s: s, hx: st.width / 2, z0: 0, z1: len, y0: st.pos[1], h: st.step_h, d: st.step_d, count: st.count, flags: F_STAIRS, aabb: rect_aabb(st.pos[0], st.pos[2], c, s, -st.width / 2, 0, st.width / 2, len, 0) });
    });
    (spec.ramps || []).forEach(function (r) {
      const c = Math.cos(r.yaw || 0), s = Math.sin(r.yaw || 0);
      add_patch({ kind: 1, group: r.group || 0, ox: r.pos[0], oz: r.pos[2], c: c, s: s, hx: r.width / 2, z0: 0, z1: r.length, y0: r.pos[1], rise: r.rise, flags: F_RAMP, aabb: rect_aabb(r.pos[0], r.pos[2], c, s, -r.width / 2, 0, r.width / 2, r.length, 0) });
    });
    (spec.doors || []).forEach(function (d) {
      const c = Math.cos(d.yaw || 0), s = Math.sin(d.yaw || 0), depth = d.thick / 2 + 0.3;
      doors.add(rect_aabb(d.pos[0], d.pos[2], c, s, -d.width / 2, -depth, d.width / 2, depth, 0), { ox: d.pos[0], oz: d.pos[2], c: c, s: s, hx: d.width / 2, hz: d.thick / 2 + 0.25, y0: d.pos[1], height: d.height, gate: d.gate });
    });
    return { patches: list_patches, surf: surf, obstacles: obstacles, doors: doors };
  }
  function patch_height(p, x, z) {                                                                       // the surface's height at (x, z), NaN when the point is not on it
    const dx = x - p.ox, dz = z - p.oz, lx = dx * p.c - dz * p.s, lz = dx * p.s + dz * p.c;
    if (lx < -p.hx || lx > p.hx || lz < p.z0 || lz > p.z1) return NaN;
    if (p.kind === 0) return p.y0;
    if (p.kind === 1) return p.y0 + p.rise * (lz / (p.z1 - p.z0));
    let i = Math.floor(lz / p.d); if (i >= p.count) i = p.count - 1;
    return p.y0 + (i + 1) * p.h;
  }

  function create(spec) {
    const N = spec.nav || {};
    const cell = N.cell || 0.25, bounds = N.bounds || [-32, -32, 32, 32];
    const agents = {};
    for (const k in DEFAULT_AGENTS) agents[k] = DEFAULT_AGENTS[k];
    for (const k in (N.agents || {})) { const a = {}; for (const f in DEFAULT_AGENTS.person) a[f] = (N.agents[k][f] !== undefined ? N.agents[k][f] : DEFAULT_AGENTS.person[f]); agents[k] = a; }
    const default_agent = N.default_agent || "person";
    const x0 = bounds[0], z0 = bounds[1], ncx = Math.ceil((bounds[2] - bounds[0]) / cell), ncz = Math.ceil((bounds[3] - bounds[1]) / cell);
    const ntx = Math.ceil(ncx / TILE), ntz = Math.ceil(ncz / TILE);
    const widest = Object.keys(agents).reduce(function (m, k) { return Math.max(m, agents[k].radius); }, 0.1);
    const G = geometry(spec, widest + 0.05), providers = [];
    const nav = { cell: cell, bounds: bounds, agents: agents, default_agent: default_agent, ncx: ncx, ncz: ncz, ntx: ntx, ntz: ntz, stats: { baked_tiles: 0, bake_ms: 0, searches: 0, expanded: 0, failed: 0 } };
    const zones = spec.zones || [];
    const ngates = (spec.doors || []).reduce(function (m, d) { return Math.max(m, d.gate + 1); }, 0);
    const gates = new Uint8Array(ngates + 1), gate_key = new Uint8Array(ngates + 1);                  // (the state of each gate, and the key number that opens it when it is locked)
    (spec.doors || []).forEach(function (d) { gate_key[d.gate] = d.key || 0; gates[d.gate] = d.locked ? 2 : (d.open ? 0 : 1); });
    const profiles = {};
    const H = new Float64Array(3 * 64), Hy = new Float64Array(64);
    const now = typeof performance !== "undefined" && performance.now ? function () { return performance.now(); } : function () { return Date.now(); };

    // ---- heights at a point: the ground, the patches, the providers (y, flags, group triples in H)
    function heights(x, z) {
      let n = 0;
      if (spec.ground && x >= bounds[0] && x <= bounds[2] && z >= bounds[1] && z <= bounds[3]) { H[0] = spec.ground.y; H[1] = 0; H[2] = -1; n = 1; }
      const l = G.surf.at(x, z);
      if (l) for (let i = 0; i < l.length && n < 60; i++) { const y = patch_height(l[i], x, z); if (y === y) { H[n * 3] = y; H[n * 3 + 1] = l[i].flags; H[n * 3 + 2] = l[i].group; n++; } }
      for (let i = 0; i < providers.length; i++) {
        const p = providers[i];
        if (x < p.aabb[0] || x > p.aabb[2] || z < p.aabb[1] || z > p.aabb[3]) continue;
        const tmp = new Float64Array(3 * 16), k = p.heights(x, z, tmp);
        for (let j = 0; j < k && n < 60; j++) { H[n * 3] = tmp[j * 3]; H[n * 3 + 1] = tmp[j * 3 + 1]; H[n * 3 + 2] = tmp[j * 3 + 2]; n++; }
      }
      return n;
    }
    function blocked(cfg, x, z, y, grp) {                                                                // an obstacle in the way of a body standing at (x, z, y) on the surface group `grp`: over its feet's step and under its head, or round its feet (inside the solid that is not its own surface's)
      const l = G.obstacles.at(x, z);
      if (!l) return false;
      const r = cfg.radius, lo = y + cfg.step + 0.001, hi = y + cfg.height - 0.001;
      for (let i = 0; i < l.length; i++) {
        const o = l[i], band = o.top > lo && o.bottom < hi, inside = o.group !== grp && y >= o.bottom - 0.03 && y < o.top - 0.03;
        if (!band && !inside) continue;
        const dx = x - o.ox, dz = z - o.oz, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
        if (band) { if (lx >= -o.hx - r && lx <= o.hx + r && lz >= -o.hz - r && lz <= o.hz + r) return true; }
        else if (lx >= -o.hx && lx <= o.hx && lz >= -o.hz && lz <= o.hz) return true;
      }
      return false;
    }
    function gate_at(x, z, y) {
      const l = G.doors.at(x, z);
      if (!l) return 0;
      for (let i = 0; i < l.length; i++) {
        const d = l[i], dx = x - d.ox, dz = z - d.oz, lx = dx * d.c - dz * d.s, lz = dx * d.s + dz * d.c;
        if (Math.abs(lx) <= d.hx && Math.abs(lz) <= d.hz && y >= d.y0 - 0.15 && y <= d.y0 + d.height) return d.gate + 1;
      }
      return 0;
    }

    // ---- one tile of one profile
    function bake_tile(P, tx, tz) {
      const cfg = P.cfg, ys = [], fl = [], gt = [], gp = [], cxs = [], czs = [], start = new Uint16Array(TILE * TILE + 1);
      for (let lz = 0; lz < TILE; lz++) for (let lx = 0; lx < TILE; lx++) {
        start[lz * TILE + lx] = ys.length;
        const cx = tx * TILE + lx, cz = tz * TILE + lz;
        if (cx >= ncx || cz >= ncz) continue;
        const x = x0 + (cx + 0.5) * cell, z = z0 + (cz + 0.5) * cell;
        const n = heights(x, z);
        if (!n) continue;
        const idx = [];
        for (let i = 0; i < n; i++) idx.push(i);
        idx.sort(function (a, b) { return H[a * 3] - H[b * 3]; });
        let kept = 0;
        for (let q = 0; q < idx.length && kept < MAX_LAYERS;) {                                          // (surfaces within 4 cm of each other are ONE candidate: the highest one's height, every flag of them)
          const base = H[idx[q] * 3];
          let y = base, f = 0, gr = -1;
          while (q < idx.length && H[idx[q] * 3] - base < 0.04) { y = H[idx[q] * 3]; f |= H[idx[q] * 3 + 1]; gr = H[idx[q] * 3 + 2]; q++; }
          if (blocked(cfg, x, z, y, gr)) continue;
          const g = gate_at(x, z, y);
          ys.push(y); fl.push(f | (g ? F_GATE : 0)); gt.push(g); gp.push(gr); cxs.push(cx); czs.push(cz); kept++;
        }
      }
      start[TILE * TILE] = ys.length;
      const n = ys.length;
      const old = P.tiles[tz * ntx + tx];
      P.tiles[tz * ntx + tx] = {
        tx: tx, tz: tz, n: n, ys: Float32Array.from(ys), fl: Uint8Array.from(fl), gate: Uint16Array.from(gt), grp: Int16Array.from(gp), cx: Int16Array.from(cxs), cz: Int16Array.from(czs), start: start,
        g: new Float32Array(n), par: new Int32Array(n), plink: new Int32Array(n), stamp: new Uint32Array(n), closed: new Uint32Array(n), comp: new Int32Array(n)
      };
      nav.stats.baked_tiles++;
      return old;
    }
    function profile(name) {
      let P = profiles[name];
      if (P) return P;
      const cfg = agents[name];
      if (!cfg) throw new Error("happy_world_nav: no agent profile `" + name + "` (" + Object.keys(agents).join(", ") + ")");
      const t0 = now();
      P = profiles[name] = { name: name, cfg: cfg, tiles: new Array(ntx * ntz), tan: Math.tan(cfg.slope * Math.PI / 180), links: new Map(), zone_nodes: [], run: 0, ncomp: 0 };
      for (let tz = 0; tz < ntz; tz++) for (let tx = 0; tx < ntx; tx++) bake_tile(P, tx, tz);
      finish(P);
      nav.stats.bake_ms += now() - t0;
      return P;
    }

    // ---- node access
    function tile_of(P, id) { return P.tiles[id >> TSHIFT]; }
    function node_x(t, l) { return x0 + (t.cx[l] + 0.5) * cell; }
    function node_z(t, l) { return z0 + (t.cz[l] + 0.5) * cell; }
    function column(P, cx, cz) {                                                                         // the first node and the end (exclusive) of a column, as ids: [tile, from, to] in `col`
      if (cx < 0 || cz < 0 || cx >= ncx || cz >= ncz) return null;
      const tx = (cx / TILE) | 0, tz = (cz / TILE) | 0, ti = tz * ntx + tx, t = P.tiles[ti], c = (cz - tz * TILE) * TILE + (cx - tx * TILE);
      return t ? { t: t, ti: ti, a: t.start[c], b: t.start[c + 1] } : null;
    }
    // the node of a column that a body at node (y, flags) can step to: the one nearest in height that the step, the drop and the slope rules allow; -1 when none
    function step_node(P, col, y0, f0, h, g0) {
      let best = -1, bd = 1e9, same = -1, sd = 1e9;
      const cfg = P.cfg;
      for (let l = col.a; l < col.b; l++) {
        const dy = col.t.ys[l] - y0, f = f0 | col.t.fl[l];
        let ok;
        if (dy >= 0) ok = dy <= cfg.step + 0.001 || ((f & F_RAMP) !== 0 && dy <= h * P.tan + 0.001);
        else ok = -dy <= cfg.drop + 0.001 || ((f & F_RAMP) !== 0 && -dy <= h * P.tan + 0.001);
        if (ok) {
          const a = dy < 0 ? -dy : dy;
          if (a < bd) { bd = a; best = (col.ti << TSHIFT) | l; }
          if (col.t.grp[l] === g0 && a < sd) { sd = a; same = (col.ti << TSHIFT) | l; }                  // (the surface it stands on goes on: a ramp over the ground stays the ramp)
        }
      }
      return same >= 0 ? same : best;
    }
    const nb_id = new Int32Array(8), nb_cost = new Float32Array(8);
    function neighbours(P, id) {                                                                         // fills nb_id / nb_cost with the walkable neighbours of a node; -> count
      const t = tile_of(P, id), l = id & LMASK, cx = t.cx[l], cz = t.cz[l], y = t.ys[l], f = t.fl[l], g0 = t.grp[l];
      let n = 0;
      const orth = [-1, -1, -1, -1];
      for (let d = 0; d < 8; d++) {
        const col = column(P, cx + DX[d], cz + DZ[d]);
        if (!col) continue;
        const h = DIST[d] * cell, to = step_node(P, col, y, f, h, g0);
        if (d < 4) { orth[d] = to; }
        if (to < 0) continue;
        if (d >= 4) {                                                                                    // (a diagonal needs both of the sides it cuts between: no corner cutting)
          const a = d === 4 ? 0 : d === 5 ? 0 : d === 6 ? 1 : 1, b = d === 4 ? 2 : d === 5 ? 3 : d === 6 ? 2 : 3;
          if (orth[a] < 0 || orth[b] < 0) continue;
        }
        const tt = P.tiles[to >> TSHIFT], tl = to & LMASK, dy = tt.ys[tl] - y;
        let c = h * (1 + (dy < 0 ? -dy : dy) * 0.3);
        if ((f | tt.fl[tl]) & F_STAIRS) c *= 1.25;
        nb_id[n] = to; nb_cost[n] = c; n++;
      }
      return n;
    }

    // ---- links (a ladder, a ledge), the zones, the components
    function nearest_id(P, x, y, z, max_d) {
      const cx = Math.floor((x - x0) / cell), cz = Math.floor((z - z0) / cell), R = Math.ceil(max_d / cell) + 1;
      let best = -1, bd = max_d * max_d;
      for (let r = 0; r <= R; r++) {
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(dx < 0 ? -dx : dx, dz < 0 ? -dz : dz) !== r) continue;
          const col = column(P, cx + dx, cz + dz);
          if (!col) continue;
          for (let l = col.a; l < col.b; l++) {
            const ex = x0 + ((cx + dx) + 0.5) * cell - x, ez = z0 + ((cz + dz) + 0.5) * cell - z, ey = (col.t.ys[l] - y) * 2, d2 = ex * ex + ez * ez + ey * ey;
            if (d2 < bd) { bd = d2; best = (col.ti << TSHIFT) | l; }
          }
        }
        if (best >= 0 && (r + 1) * cell > Math.sqrt(bd)) break;
      }
      return best;
    }
    function add_edge(P, a, b, cost, link) { let l = P.links.get(a); if (!l) { l = []; P.links.set(a, l); } l.push({ to: b, cost: cost, link: link }); }
    function build_links(P) {
      P.links.clear();
      (spec.links || []).forEach(function (k) {
        const a = nearest_id(P, k.a[0], k.a[1], k.a[2], 1.0), b = nearest_id(P, k.b[0], k.b[1], k.b[2], 1.0);
        if (a < 0 || b < 0) return;
        const dx = k.a[0] - k.b[0], dy = k.a[1] - k.b[1], dz = k.a[2] - k.b[2], c = k.cost !== undefined ? k.cost : Math.sqrt(dx * dx + dy * dy + dz * dz) * 2;
        add_edge(P, a, b, c, k.id + 1);
        if (k.bidir !== false) add_edge(P, b, a, c, k.id + 1);
      });
    }
    function build_zones(P) {
      P.zone_nodes = zones.map(function () { return []; });
      for (let ti = 0; ti < P.tiles.length; ti++) {
        const t = P.tiles[ti];
        if (!t) continue;
        for (let l = 0; l < t.n; l++) {
          const x = node_x(t, l), z = node_z(t, l), y = t.ys[l];
          for (let k = 0; k < zones.length; k++) {
            const zn = zones[k], r = zn.rect;
            if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3] && (!zn.y || (y >= zn.y[0] - 0.2 && y <= zn.y[1]))) P.zone_nodes[k].push((ti << TSHIFT) | l);
          }
        }
      }
      P.zone_nodes = P.zone_nodes.map(function (a) { return Int32Array.from(a); });
    }
    function build_components(P) {                                                                       // the islands of the walkable graph with every gate passable: a quick "no" for reachable()
      let k = 0;
      const stack = [];
      for (let ti = 0; ti < P.tiles.length; ti++) { const t = P.tiles[ti]; if (t) t.comp.fill(-1); }
      for (let ti = 0; ti < P.tiles.length; ti++) {
        const t = P.tiles[ti];
        if (!t) continue;
        for (let l = 0; l < t.n; l++) {
          if (t.comp[l] >= 0) continue;
          stack.length = 0; stack.push((ti << TSHIFT) | l); t.comp[l] = k;
          while (stack.length) {
            const id = stack.pop(), c = neighbours(P, id);
            const ids = [], cn = c;
            for (let i = 0; i < cn; i++) ids.push(nb_id[i]);
            const lk = P.links.get(id);
            if (lk) for (let i = 0; i < lk.length; i++) ids.push(lk[i].to);
            for (let i = 0; i < ids.length; i++) { const tt = P.tiles[ids[i] >> TSHIFT], ll = ids[i] & LMASK; if (tt.comp[ll] < 0) { tt.comp[ll] = k; stack.push(ids[i]); } }
          }
          k++;
        }
      }
      P.ncomp = k;
    }
    function finish(P) { build_links(P); build_zones(P); build_components(P); }

    // ---- queries
    const snap_out = { x: 0, y: 0, z: 0 };
    nav.nearest = function (x, y, z, prof, max_d, out) {
      const P = profile(prof || default_agent), id = nearest_id(P, x, y, z, max_d > 0 ? max_d : 2);
      if (id >= 0 && out) nav.pos(prof || default_agent, id, out);
      return id;
    };
    nav.pos = function (prof, id, out) { const P = profile(prof || default_agent), t = tile_of(P, id), l = id & LMASK; out.x = node_x(t, l); out.y = t.ys[l]; out.z = node_z(t, l); out.flags = t.fl[l]; return out; };
    nav.flags = function (prof, id) { const P = profile(prof || default_agent); return tile_of(P, id).fl[id & LMASK]; };
    nav.set_gate = function (gate, state) { if (gate >= 0 && gate < gates.length) gates[gate] = state; };
    nav.gate_state = function (gate) { return gates[gate]; };

    let heap_id = new Int32Array(4096), heap_f = new Float32Array(4096), hn = 0;
    function heap_push(id, f) {
      if (hn === heap_id.length) { const a = new Int32Array(hn * 2), b = new Float32Array(hn * 2); a.set(heap_id); b.set(heap_f); heap_id = a; heap_f = b; }
      let i = hn++;
      while (i > 0) { const p = (i - 1) >> 1; if (heap_f[p] <= f) break; heap_id[i] = heap_id[p]; heap_f[i] = heap_f[p]; i = p; }
      heap_id[i] = id; heap_f[i] = f;
    }
    function heap_pop() {
      const top = heap_id[0], id = heap_id[--hn], f = heap_f[hn];
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= hn) break;
        if (c + 1 < hn && heap_f[c + 1] < heap_f[c]) c++;
        if (heap_f[c] >= f) break;
        heap_id[i] = heap_id[c]; heap_f[i] = heap_f[c]; i = c;
      }
      heap_id[i] = id; heap_f[i] = f;
      return top;
    }
    const keep = [];
    function los(P, a, b) {                                                                              // a straight walk between two flat nodes over nodes that are all there at the same height
      const ta = tile_of(P, a), tb = tile_of(P, b), la = a & LMASK, lb = b & LMASK;
      const ax = node_x(ta, la), az = node_z(ta, la), ay = ta.ys[la], bx = node_x(tb, lb), bz = node_z(tb, lb), by = tb.ys[lb];
      const len = Math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az)), n = Math.ceil(len / (cell * 0.5));
      for (let i = 1; i < n; i++) {
        const u = i / n, x = ax + (bx - ax) * u, z = az + (bz - az) * u, y = ay + (by - ay) * u;
        const col = column(P, Math.floor((x - x0) / cell), Math.floor((z - z0) / cell));
        if (!col) return false;
        let ok = false;
        for (let l = col.a; l < col.b; l++) if (Math.abs(col.t.ys[l] - y) < 0.06 && col.t.fl[l] === 0) { ok = true; break; }
        if (!ok) return false;
      }
      return true;
    }
    nav.path = function (prof, ax, ay, az, bx, by, bz, opts, out) {
      const P = profile(prof || default_agent), o = opts || {}, snap = o.snap > 0 ? o.snap : 2, keys = o.keys | 0, max_nodes = o.max_nodes > 0 ? o.max_nodes : 20000;
      nav.stats.searches++;
      const s = nearest_id(P, ax, ay, az, snap), g = nearest_id(P, bx, by, bz, snap);
      if (s < 0 || g < 0) { nav.stats.failed++; return -1; }
      const ts = tile_of(P, s), tg = tile_of(P, g), gx = node_x(tg, g & LMASK), gy = tg.ys[g & LMASK], gz = node_z(tg, g & LMASK);
      if (ts.comp[s & LMASK] !== tg.comp[g & LMASK] && !o.partial) { nav.stats.failed++; return -1; }
      const run = ++P.run;
      hn = 0;
      ts.g[s & LMASK] = 0; ts.stamp[s & LMASK] = run; ts.par[s & LMASK] = -1; ts.plink[s & LMASK] = 0;
      heap_push(s, 0);
      let found = false, expanded = 0, near_id = s, near_h = 1e9;
      while (hn > 0 && expanded < max_nodes) {
        const id = heap_pop(), t = tile_of(P, id), l = id & LMASK;
        if (t.closed[l] === run) continue;
        t.closed[l] = run; expanded++;
        if (id === g) { found = true; break; }
        const px = node_x(t, l), pz = node_z(t, l), py = t.ys[l], gcur = t.g[l];
        { const hh = Math.sqrt((px - gx) * (px - gx) + (pz - gz) * (pz - gz) + (py - gy) * (py - gy)); if (hh < near_h) { near_h = hh; near_id = id; } }
        const n = neighbours(P, id);
        const ids = [], costs = [], lks = [];
        for (let i = 0; i < n; i++) { ids.push(nb_id[i]); costs.push(nb_cost[i]); lks.push(0); }
        const lk = P.links.get(id);
        if (lk) for (let i = 0; i < lk.length; i++) { ids.push(lk[i].to); costs.push(lk[i].cost); lks.push(lk[i].link); }
        for (let i = 0; i < ids.length; i++) {
          const to = ids[i], tt = P.tiles[to >> TSHIFT], tl = to & LMASK;
          if (tt.closed[tl] === run) continue;
          let c = costs[i];
          const gt = tt.gate[tl];
          if (gt > 0) {                                                                                  // (a doorway: open costs nothing, closed a little (it is opened), locked only for the key)
            const st = gates[gt - 1];
            if (st === 2 && !(gate_key[gt - 1] > 0 && (keys & (1 << (gate_key[gt - 1] - 1))) !== 0)) continue;
            if (st === 1) c += 1.5;
          }
          const ng = gcur + c;
          if (tt.stamp[tl] === run && tt.g[tl] <= ng) continue;
          tt.stamp[tl] = run; tt.g[tl] = ng; tt.par[tl] = id; tt.plink[tl] = lks[i];
          const hx = node_x(tt, tl) - gx, hz = node_z(tt, tl) - gz, hy = tt.ys[tl] - gy;
          heap_push(to, ng + Math.sqrt(hx * hx + hz * hz + hy * hy));
        }
      }
      nav.stats.expanded += expanded;
      let end = g;
      if (!found) { if (!o.partial) { nav.stats.failed++; return -1; } end = near_id; }
      // the way back, then smoothed: flat stretches with a clear line become one leg
      keep.length = 0;
      for (let id = end; id >= 0;) { keep.push(id); const t = tile_of(P, id); id = t.par[id & LMASK]; }
      keep.reverse();
      const cap = (out.length / 5) | 0;
      let n = 0, i = 0;
      const put = function (id, link) {
        if (n >= cap) return;
        const t = tile_of(P, id), l = id & LMASK;
        out[n * 5] = node_x(t, l); out[n * 5 + 1] = t.ys[l]; out[n * 5 + 2] = node_z(t, l); out[n * 5 + 3] = link; out[n * 5 + 4] = t.fl[l]; n++;
      };
      put(keep[0], 0);
      while (i < keep.length - 1) {
        let j = i + 1;
        const tj = tile_of(P, keep[j]), lj = tj.plink[keep[j] & LMASK];
        if (o.smooth !== false && lj === 0 && tile_of(P, keep[i]).fl[keep[i] & LMASK] === 0) {
          let k = j;
          for (let q = j; q < keep.length; q++) {
            const tq = tile_of(P, keep[q]);
            if (tq.fl[keep[q] & LMASK] !== 0 || tq.plink[keep[q] & LMASK] !== 0) break;
            if (los(P, keep[i], keep[q])) k = q;
          }
          j = k;
        }
        put(keep[j], tile_of(P, keep[j]).plink[keep[j] & LMASK]);
        i = j;
      }
      return n;
    };
    const reach_out = new Float32Array(5 * 1024);
    nav.reachable = function (prof, ax, ay, az, bx, by, bz, keys) {
      const P = profile(prof || default_agent), s = nearest_id(P, ax, ay, az, 2), g = nearest_id(P, bx, by, bz, 2);
      if (s < 0 || g < 0) return false;
      if (tile_of(P, s).comp[s & LMASK] !== tile_of(P, g).comp[g & LMASK]) return false;
      return nav.path(prof, ax, ay, az, bx, by, bz, { keys: keys, smooth: false, max_nodes: 30000 }, reach_out) >= 0;
    };
    nav.zone_id = function (name) { for (let i = 0; i < zones.length; i++) if (zones[i].name === name) return i; return -1; };
    nav.random_in_zone = function (prof, zone, rnd, out) {
      const P = profile(prof || default_agent), zi = typeof zone === "string" ? nav.zone_id(zone) : zone;
      if (zi < 0 || !P.zone_nodes[zi] || !P.zone_nodes[zi].length) return false;
      const list = P.zone_nodes[zi], id = list[Math.floor(rnd() * list.length) % list.length];
      nav.pos(prof, id, out);
      return true;
    };
    nav.zone_count = function (prof, zone) { const P = profile(prof || default_agent), zi = typeof zone === "string" ? nav.zone_id(zone) : zone; return zi < 0 ? 0 : P.zone_nodes[zi].length; };
    nav.zones_at = function (x, y, z, out) {
      let n = 0;
      for (let k = 0; k < zones.length; k++) {
        const r = zones[k].rect, zy = zones[k].y;
        if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3] && (!zy || (y >= zy[0] - 0.2 && y <= zy[1]))) { if (out && n < out.length) out[n] = k; n++; }
      }
      return n;
    };
    nav.node_count = function (prof) { const P = profile(prof || default_agent); let n = 0; for (let i = 0; i < P.tiles.length; i++) if (P.tiles[i]) n += P.tiles[i].n; return n; };
    nav.components = function (prof) { return profile(prof || default_agent).ncomp; };
    nav.component_of = function (prof, id) { const P = profile(prof || default_agent); return tile_of(P, id).comp[id & LMASK]; };

    // the open edges that nothing guards: a node with a neighbour cell that has no surface at all within a drop of its feet (a wall or a rail is a surface that is blocked, not a void)
    nav.unguarded = function (prof) {
      const P = profile(prof || default_agent), out = [], ends = [];
      (spec.links || []).forEach(function (k) { ends.push(k.a, k.b); });                                 // (the open edge at a ladder or a ledge is the way up: it is not guarded on purpose)
      for (let ti = 0; ti < P.tiles.length; ti++) {
        const t = P.tiles[ti];
        if (!t) continue;
        for (let l = 0; l < t.n; l++) {
          const cx = t.cx[l], cz = t.cz[l], y = t.ys[l];
          let at_link = false;
          for (let e = 0; e < ends.length; e++) { const ex = ends[e][0] - node_x(t, l), ey = ends[e][1] - y, ez = ends[e][2] - node_z(t, l); if (ex * ex + ey * ey + ez * ez < 1.5 * 1.5) { at_link = true; break; } }
          if (at_link) continue;
          for (let d = 0; d < 4; d++) {
            const nx = cx + DX[d], nz = cz + DZ[d];
            if (nx < 0 || nz < 0 || nx >= ncx || nz >= ncz) continue;                                    // (the edge of the world's bounds is not an edge to guard)
            const x = x0 + (nx + 0.5) * cell, z = z0 + (nz + 0.5) * cell, n = heights(x, z);
            let surface = false;
            for (let i = 0; i < n; i++) if (H[i * 3] >= y - P.cfg.drop - 0.001 && H[i * 3] <= y + P.cfg.step + 0.5) surface = true;
            if (!surface) out.push({ x: node_x(t, l), y: y, z: node_z(t, l), dx: DX[d], dz: DZ[d] });
          }
        }
      }
      return out;
    };

    // ---- the ground changes: only the tiles it touches are baked again
    nav.add_provider = function (p) { providers.push(p); };
    nav.rebuild = function (aabb) {
      let n = 0;
      const pad = 2;
      const c0 = Math.floor((aabb[0] - pad - x0) / cell), c1 = Math.floor((aabb[2] + pad - x0) / cell), d0 = Math.floor((aabb[1] - pad - z0) / cell), d1 = Math.floor((aabb[3] + pad - z0) / cell);
      const tx0 = Math.max(0, (c0 / TILE) | 0), tx1 = Math.min(ntx - 1, (c1 / TILE) | 0), tz0 = Math.max(0, (d0 / TILE) | 0), tz1 = Math.min(ntz - 1, (d1 / TILE) | 0);
      for (const k in profiles) {
        const P = profiles[k];
        for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) { bake_tile(P, tx, tz); n++; }
        finish(P);
      }
      return n;
    };
    return nav;
  }
  return { create: create, DEFAULT_AGENTS: DEFAULT_AGENTS, F_STAIRS: F_STAIRS, F_RAMP: F_RAMP, F_GATE: F_GATE };
});

// ========================================================================================================================
// worker_actions
// ========================================================================================================================
packing()("happy_worker_actions", function happy_worker_actions() {
  "use strict";
  // HAPPY WORKER ACTIONS: the designed actions of system (action_designer/action_spec.js: data; action_player.js: what a spec says at a time) PLAYED IN THE WORKER, on the instances' columns, with nothing allocated in a frame (SYSTEM.md, "The
  // worker's logic"). The page's runtime (action_designer/action_runtime.js) plays an action by commands from the main thread, a frame late, with a Map and an object for everything it says; this is the same thing done where the
  // creatures are: the clock and the curves are the player's own (its compile and its `values`, the very file), the clock's state of every instance is a typed array (this file's step is player.step line for line, held to it by
  // every action of the libraries), and what an action says goes into the columns by the direct writes (direct.js: the same checks and writes as the page's commands). The page's runtime stays as it
  // is (the designer's). What an action needs of the creature (which bones play which role, its arms, its legs' rest places, its body) is a PLAN, made by the page's runtime for a species (rt.plan(sp): plain data) and given to the worker.
  //
  //   const A = create({ player, D, K })      player: action_player.js (compile, values, COMP, COMP_INDEX, NEU); D: direct.js's writes (made with `check: false`: an instance that runs is a live one); K: cols.constants()
  //   const lib = A.library()      lib.add(spec) -> id (a small integer: the handle every call takes)      lib.tag(name) -> id of a tag an emit event carries      lib.prop(name) -> the bit of a prop a spec's `when` names (0 .. 31)
  //                                lib.size()      lib.tag_name(id)      lib.spec(id)
  //   const rt = A.family(fam, plan, { lib, max_events })      one runtime for a family (columns: columns.js) of a species the plan is of; the state of the runs is rt's, a slot an instance
  //   rt.start(s, id)      begin an action on instance s (the one it was playing is let go: 'replaced'); then the page's options by setters, before the next update:
  //   rt.power(s, v)  rt.speed(s, v)  rt.mirror(s, on)  rt.height(s, metres)  rt.props(s, mask)  rt.target_point(s, x, y, z)  rt.target_instance(s, rt2, s2, height)  rt.target_none(s)      (the page's start options)
  //   rt.stop(s)  rt.end(s)  rt.hold(s, tau)  rt.hold_off(s)  rt.playing(s) -> action id or -1  rt.tau(s)  rt.weight(s)  rt.is_done(s)      rt.update(dt)      one frame: every run steps and says what it says
  //   events: rt.ev_count()  rt.drain(fn(kind, slot, a, value))  rt.ev_clear()      kind EV_EMIT (a: the tag's id, value the event's), EV_END (a: how: HOW_*), EV_SKIPPED (a: the kind of event that nothing plays: a `hit`, a `show` ...)
  //   LEARNED ACTIONS (action_player.js has the arithmetic, this file its typed twin): an emit with `pw` says its value times the power; a `hit` is told as an emit `hit` (value: its limb's index) and `hit_end` after its `win` (the
  //   damage and the reach are for whoever tests where the limb is, nothing here does); a WAIT POINT stops the clock until rt.release(s) or its `max` seconds, telling `tag` on reaching it and `tag_end` on leaving it:
  //   rt.release(s)  rt.waiting(s) -> the id of the wait's tag the clock stands at | -1  rt.wait_age(s) (seconds there)  rt.phase(s) -> the index of the phase the run is in | -1  rt.phase_id(s) -> the id of its name WITHOUT its number (windup3 is windup; the tags' registry: lib.tag(name) is it)
  //   rt.stats      { runs, updates }
  // WHAT A FRAME ALLOCATES: nothing. The runs are a list of slots (swap-remove); the accumulators, the numbers of the spec (V, H), the fired events are preallocated; no closure, no object, no array literal in step, frame or update.
  // WHAT IT DOES NOT DO (as the page's runtime does not): the events `hit` (but for its two emits), `show`, `hide` and `mount` are accepted and said once as skipped (a creature's props and a hit's reach are the worker's later); an action of a species with no
  // life or legs plays what it can (a track whose group the plan lacks is skipped). The page's dedupe of what it sent (a bone's pose that moved less than 2e-4 is not sent again) is not here: writing a column is cheaper than comparing it.
  // Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no class.
  const DEG = Math.PI / 180, MAX_ANGLE = 1.99, MAX_EVENTS = 24;
  const EV_EMIT = 1, EV_END = 2, EV_SKIPPED = 3;
  const HOW_FINISHED = 0, HOW_STOPPED = 1, HOW_GONE = 2, HOW_REPLACED = 3;
  const KIND = { emit: 0, impulse: 1, hit: 2, show: 3, hide: 4, mount: 5 }, DIR = { fwd: 0, back: 1, left: 2, right: 3, target: 4 };
  const F_ENDING = 1, F_STOPPING = 2, F_DONE = 4, F_USED_BODY = 8, F_USED_WINGS = 16, F_AIR_UP = 32, F_AIR_SEEN = 64, F_SETTLED = 128;
  const clamp = function (x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); };
  const smooth = function (u) { u = u < 0 ? 0 : (u > 1 ? 1 : u); return u * u * (3 - 2 * u); };               // (the player's own)
  const q3 = function (x, s) { return Math.round(x * s) / s; };

  // the player's eases by their number in EASE_LIST (an unknown name is 'smooth', as the player has it), written as one switch so that a call is inlined and a number does not have to be boxed to be returned: the player's own functions
  // are called through an array, and each answer of one is a heap number. The arithmetic is the player's, operation for operation.
  const SAMPLES = [0, 0.07, 0.13, 0.31, 0.5, 0.64, 0.77, 0.93, 1];
  const ease_val = function (code, u) {
    switch (code) {
      case 0: return u;
      case 1: return u * u * (3 - 2 * u);
      case 2: return u * u;
      case 3: return 1 - (1 - u) * (1 - u);
      case 4: { const v = 1 - u; return 1 - v * v * v; }
      case 5: return u * u * u;
      case 6: { const c1 = 1.70158, v = u - 1; return 1 + (c1 + 1) * v * v * v + c1 * v * v; }
      case 7: { const s = 1 - Math.exp(-6 * u) * Math.cos(12.566 * u); return s + (1 - (1 - Math.exp(-6) * Math.cos(12.566))) * u; }
      case 8: return u > 0 ? 1 : 0;
      default: return u >= 1 ? 1 : 0;
    }
  };
  const osc_env = function (a, b, tau) {                                                  // (the wobble's weight: 0 outside its phases, eased in and out over a sixth of them)
    if (tau <= a || tau >= b) return 0;
    const x = (tau - a) / (b - a), q = Math.min(1, x / 0.17, (1 - x) / 0.17);
    return q * q * (3 - 2 * q);
  };
  // action_player.js values(C, tau, power, mirror, V, H) from the typed tables of an action (F.t_*): the same numbers to the last bit, and no heap number made
  const values_fast = function (F, nc, tau, power, mirror, V, H) {
    for (let q = 0; q < nc; q++) H[q] = 0;
    const n = F.n_ph, total = F.total, start = F.start, dur = F.dur;
    for (let q = 0; q < F.t_n; q++) {
      const te = tau - F.t_lag[q], vo = F.t_voff[q], eo = F.t_eoff[q];
      let x;
      if (te <= 0) x = F.t_v[vo];
      else if (te >= total) x = F.t_v[vo + n];
      else {
        let qq = n - 1;
        while (qq > 0 && te < start[qq]) qq--;
        const u = (te - start[qq]) / dur[qq];
        x = F.t_v[vo + qq] + (F.t_v[vo + qq + 1] - F.t_v[vo + qq]) * ease_val(F.t_e[eo + qq], u);
        if (F.t_hon[q] === 1 && F.t_h[eo + qq] !== 0) x += F.t_h[eo + qq] * Math.sin(3.14159265 * u);
      }
      if (F.t_oon[q] === 1) {
        const oo = q * 5;
        x += F.t_osc[oo + 1] * Math.sin(6.283185307 * (F.t_osc[oo] * te + F.t_osc[oo + 2])) * osc_env(start[F.t_osc[oo + 3]], start[F.t_osc[oo + 4]] + dur[F.t_osc[oo + 4]], te);
      }
      const nu = F.t_neu[q];
      x = nu + (x - nu) * F.t_amp[q] * (F.t_pw[q] === 1 ? power : 1);
      const cj = mirror ? F.t_mi[q] : F.t_ci[q];
      V[cj] = mirror ? x * F.t_sign[q] : x;
      H[cj] = 1;
    }
  };

  function create(o) {
    if (!o || !o.player || typeof o.player.compile !== "function" || typeof o.player.values !== "function" || !o.D || !o.K) throw new Error("happy_worker_actions: create({ player, D, K }): the player of action_player.js, the direct writes and the constants");
    const P = o.player, D = o.D, K = o.K, EASE_LIST = P.EASE_LIST;
    const NC = P.COMP.length, CI = P.COMP_INDEX, COMP = P.COMP;
    const idx = function (id) { const i = CI[id]; if (i === undefined) throw new Error("happy_worker_actions: the player has no number '" + id + "'"); return i; };
    const ROT = ["hips", "spine", "chest", "neck", "head", "tail"], ROT_N = ROT.length;
    const IY = [], IP = [], IR = [];
    for (let i = 0; i < ROT_N; i++) { IY.push(idx(ROT[i] + ".yaw")); IP.push(idx(ROT[i] + ".pitch")); IR.push(idx(ROT[i] + ".roll")); }
    const I_JAW = idx("jaw.open"), I_HX = idx("hips.x"), I_HY = idx("hips.y"), I_HZ = idx("hips.z"), I_LOOK = idx("look"), I_BF = idx("body.fwd"), I_BS = idx("body.side");
    const I_WF = idx("wings.fold"), I_WH = idx("wings.hz"), I_WA = idx("wings.amp");
    const ARM = ["l", "r"], AX = [idx("arm_l.x"), idx("arm_r.x")], AY = [idx("arm_l.y"), idx("arm_r.y")], AZ = [idx("arm_l.z"), idx("arm_r.z")], AP = [idx("arm_l.pole"), idx("arm_r.pole")];
    const LEGK = ["leg", "legf"];                                                                          // (group g = kind * 2 + side: leg_l, leg_r, legf_l, legf_r)
    const LX = [], LY = [], LZ = [], LO = [], LP = [];
    for (let k = 0; k < 2; k++) for (let sd = 0; sd < 2; sd++) { const id = LEGK[k] + "_" + ARM[sd]; LX.push(idx(id + ".x")); LY.push(idx(id + ".y")); LZ.push(idx(id + ".z")); LO.push(idx(id + ".own")); LP.push(idx(id + ".pole")); }
    const LEG_NEU = [P.NEU[CI["leg_l.x"]], P.NEU[CI["leg_l.y"]], P.NEU[CI["leg_l.z"]]];
    const LEGK_NAME = ["leg_l", "leg_r", "legf_l", "legf_r"];

    // ---- the library: the specs compiled once, and the numbers of their events in typed arrays
    function library() {
      const L = { specs: [], F: [], tags: [], tag_ix: Object.create(null), props: [], prop_ix: Object.create(null) };
      L.tag = function (name) { let i = L.tag_ix[name]; if (i === undefined) { i = L.tags.length; L.tags.push(name); L.tag_ix[name] = i; } return i; };
      L.tag_name = function (i) { return L.tags[i]; };
      L.prop = function (name) {
        let i = L.prop_ix[name];
        if (i === undefined) { if (L.props.length >= 32) throw new Error("happy_worker_actions: at most 32 props (a spec's `when`)"); i = L.props.length; L.props.push(name); L.prop_ix[name] = i; }
        return i;
      };
      // a library of files (happy_actions/*.json: { actions: [spec ...] }) is registered by NAME and each action is compiled when it is first asked for (a library has thousands): lib.register(specs, set), lib.get(name | "set::name") -> id
      L.named = Object.create(null); L.by_name = Object.create(null);
      L.register = function (specs, set) {
        let n = 0;
        for (let i = 0; i < specs.length; i++) {
          const sp = specs[i];
          if (!sp || typeof sp.name !== "string") continue;
          if (L.named[sp.name] === undefined) L.named[sp.name] = sp;
          if (set) L.named[set + "::" + sp.name] = sp;
          n++;
        }
        return n;
      };
      // A CREATURE'S OWN action (its definition's `actions`, or api.action({ name, phases })): lib.define(spec, sig) puts it under its name, so api.action("name"), a block's clip slot and the page's names find it like a library's. The
      // libraries' names are not taken (a creature's action has a name of its own: the error says so); a name a creature defined before is replaced (the editor makes the family again at every change), unless `sig` (the text the
      // definition came from) is the same: then nothing is made again and the handle that was given stays the handle (a function that calls api.action({ ... }) at every visit does not fill the library). lib.owned[name] -> sig
      L.owned = Object.create(null);
      L.define = function (spec, sig) {
        const name = spec && spec.name;
        if (typeof name !== "string" || !name) throw new Error("happy_worker_actions: define(spec): the spec has a name");
        if (L.named[name] !== undefined && L.owned[name] === undefined) throw new Error("happy_worker_actions: '" + name + "' is the name of an action of the libraries: an action of a creature's own has a name of its own (wolf_claw, not claw)");
        if (L.owned[name] !== undefined && L.owned[name] === sig && sig !== undefined) return name;
        L.named[name] = spec; L.owned[name] = sig === undefined ? "" : sig; delete L.by_name[name];
        return name;
      };
      L.has = function (name) { return L.named[name] !== undefined; };
      L.get = function (name) {
        let id = L.by_name[name];
        if (id !== undefined) return id;
        const sp = L.named[name];
        if (!sp) throw new Error("happy_worker_actions: no action '" + name + "' in the library (lib.register the files of happy_actions/ first)");
        id = L.add(sp); L.by_name[name] = id;
        return id;
      };
      L.size = function () { return L.specs.length; };
      L.spec = function (id) { return L.specs[id]; };
      L.add = function (spec) {
        const C = P.compile(spec), n = C.ev.length, nw = C.waits.length, tot = n + 2 * nw, F = { C: C, ev_n: n, ev_total: tot, ev_i: new Uint8Array(tot), ev_tau: new Float64Array(tot), ev_kind: new Uint8Array(tot), ev_tag: new Int32Array(tot), ev_v: new Float64Array(tot), ev_pw: new Uint8Array(tot), ev_speed: new Float64Array(tot), ev_up: new Float64Array(tot),
          ev_dir: new Uint8Array(tot), ev_bit: new Int8Array(tot), ev_neg: new Uint8Array(tot), kinds: 0, name: C.name };
        for (let j = 0; j < n; j++) {
          const e = C.ev[j];
          F.ev_i[j] = e.i; F.ev_tau[j] = e.tau; F.ev_kind[j] = KIND[e.kind] === undefined ? 255 : KIND[e.kind]; F.ev_tag[j] = e.kind === "emit" ? L.tag(String(e.tag)) : (e.kind === "hit" ? L.tag("hit") : -1); F.ev_pw[j] = e.pw ? 1 : 0;
          F.ev_v[j] = e.v; F.ev_speed[j] = e.speed; F.ev_up[j] = e.up; F.ev_dir[j] = e.dir === undefined || DIR[e.dir] === undefined ? 0 : DIR[e.dir];
          if (e.when) { const neg = e.when.charAt(0) === "!"; F.ev_neg[j] = neg ? 1 : 0; F.ev_bit[j] = L.prop(neg ? e.when.slice(1) : e.when); } else F.ev_bit[j] = -1;
          if (F.ev_kind[j] !== 0 && F.ev_kind[j] !== 255) F.kinds |= 1 << F.ev_kind[j];
        }
        // the wait points (by time): each has two events after the real ones, told when the clock reaches it and when it leaves it (never due by their own time: ev_n bounds the loops over the real events)
        F.w_n = nw; F.w_tau = new Float64Array(nw); F.w_max = new Float64Array(nw); F.w_tag = new Int32Array(nw);
        for (let k = 0; k < nw; k++) {
          const w = C.waits[k];
          F.w_tau[k] = w.tau; F.w_max[k] = w.max; F.w_tag[k] = L.tag(String(w.tag));
          [w.enter, w.leave].forEach(function (e, h) { const j = n + 2 * k + h; F.ev_i[j] = e.i; F.ev_tau[j] = Infinity; F.ev_kind[j] = 0; F.ev_tag[j] = L.tag(String(e.tag)); F.ev_v[j] = e.v; F.ev_bit[j] = -1; });
        }
        // MOTION WARPING: where a clip GRABS (an `emit` event named grab, v +1 the left hand, -1 the right: the learned actions have them, tools/action_learn.js) is a time the hand is at the thing it takes. The windows of the warp,
        // per grab, in the clock of the action: the hand is pulled to the action's target from WARP_LEAD seconds before (as far as the time there is: a grab at the start of a clip has less), held there WARP_HOLD seconds, and let go
        // over WARP_OUT: see warp_hands
        const tg_grab = L.tag("grab"), wl = [];
        for (let j = 0; j < n; j++) if (F.ev_kind[j] === 0 && F.ev_tag[j] === tg_grab && F.ev_tau[j] >= 0 && F.ev_tau[j] < Infinity) wl.push(j);
        F.warp_n = wl.length; F.warp_side = new Uint8Array(wl.length); F.warp_t = new Float64Array(wl.length);
        for (let k = 0; k < wl.length; k++) { F.warp_side[k] = F.ev_v[wl[k]] > 0 ? 0 : 1; F.warp_t[k] = F.ev_tau[wl[k]]; }
        F.ph_id = new Int32Array(C.n);
        for (let q = 0; q < C.n; q++) F.ph_id[q] = L.tag(P.phase_base(spec && spec.phases && spec.phases[q] && spec.phases[q].name !== undefined ? String(spec.phases[q].name) : "all"));
        // the player's tracks as typed tables (values_fast): the value at every phase boundary, the ease of every phase (by its number), the humps, the wobble
        const nt = C.tracks.length, np = C.n;
        F.n_ph = np; F.total = C.total; F.start = Float64Array.from(C.start); F.dur = Float64Array.from(C.dur);
        F.t_n = nt; F.t_ci = new Int32Array(nt); F.t_mi = new Int32Array(nt); F.t_sign = new Float64Array(nt); F.t_neu = new Float64Array(nt); F.t_lag = new Float64Array(nt); F.t_amp = new Float64Array(nt); F.t_pw = new Uint8Array(nt);
        F.t_voff = new Int32Array(nt); F.t_eoff = new Int32Array(nt); F.t_v = new Float64Array(nt * (np + 1)); F.t_e = new Uint8Array(nt * np); F.t_h = new Float64Array(nt * np); F.t_hon = new Uint8Array(nt); F.t_oon = new Uint8Array(nt); F.t_osc = new Float64Array(nt * 5);
        for (let q = 0; q < nt; q++) {
          const tr = C.tracks[q], c = COMP[tr.ci];
          F.t_ci[q] = tr.ci; F.t_mi[q] = c.mi; F.t_sign[q] = c.sign; F.t_neu[q] = c.neutral; F.t_lag[q] = tr.lag; F.t_amp[q] = tr.amp; F.t_pw[q] = tr.pw ? 1 : 0;
          F.t_voff[q] = q * (np + 1); F.t_eoff[q] = q * np;
          for (let j = 0; j <= np; j++) F.t_v[q * (np + 1) + j] = tr.v[j];
          for (let j = 0; j < np; j++) {
            let code = 1;
            for (let m = 0; m < EASE_LIST.length; m++) { let same = true; for (let i = 0; i < SAMPLES.length; i++) if (P.ease(EASE_LIST[m], SAMPLES[i]) !== tr.e[j](SAMPLES[i])) same = false; if (same) { code = m; break; } }          // (the phase's ease is one of the player's: found by what it answers)
            F.t_e[q * np + j] = code;
          }
          if (tr.h !== null) { F.t_hon[q] = 1; for (let j = 0; j < np; j++) F.t_h[q * np + j] = tr.h[j]; }
          if (tr.osc !== null) { F.t_oon[q] = 1; F.t_osc[q * 5] = tr.osc.hz; F.t_osc[q * 5 + 1] = tr.osc.a; F.t_osc[q * 5 + 2] = tr.osc.ph; F.t_osc[q * 5 + 3] = tr.osc.from; F.t_osc[q * 5 + 4] = tr.osc.to; }
        }
        L.specs.push(spec); L.F.push(F);
        return L.F.length - 1;
      };
      return L;
    }

    // ---- a family's runtime
    function family(fam, plan, opt) {
      opt = opt || {};
      const lib = opt.lib;
      if (!lib || !fam || !plan || !plan.groups || !plan.bones) throw new Error("happy_worker_actions: family(fam, plan, { lib }): the family's columns, the plan of rt.plan(sp) and a library");
      const max = fam.max, nov = fam.NOV, groups = plan.groups, bones = plan.bones, bslot = plan.bone_slot, nlegs = fam.NLEGS;
      const rt = { fam: fam, plan: plan, lib: lib, stats: { runs: 0, updates: 0 } };
      let serial = fam.serial;
      // the runs: a state a slot
      const act = new Int32Array(max).fill(-1), flags = new Uint8Array(max), run_gen = new Uint16Array(max), cycle = new Int32Array(max), fired = new Uint32Array(max), said = new Uint8Array(max);
      const chained = new Uint8Array(max), age = new Float64Array(max), ts = new Float64Array(max), tau_ = new Float64Array(max), weight = new Float64Array(max), end_age = new Float64Array(max), stop_age = new Float64Array(max), hold_at = new Float64Array(max).fill(-1);
      const pw = new Float64Array(max).fill(1), spd = new Float64Array(max).fill(1), mir = new Uint8Array(max), hgt = new Float64Array(max), pin = new Float64Array(max).fill(-1), props = new Uint32Array(max);
      const tmode = new Uint8Array(max), tgt = new Float64Array(max * 3), trt = new Array(max).fill(null), tslot = new Int32Array(max), thgt = new Float64Array(max);
      const air_s = new Uint8Array(max), air_h = new Float64Array(max), air_T = new Float64Array(max), air_y0 = new Float64Array(max), air_ymax = new Float64Array(max), air_t = new Float64Array(max), air_u = new Float64Array(max);
      const emitted = new Uint32Array(max), frame_n = new Uint32Array(max), warp_sent = new Uint8Array(max), warp_w = new Float64Array(2);
      const wt_at = new Int8Array(max).fill(-1), wt_age = new Float64Array(max), wt_done = new Uint8Array(max), wt_rel = new Uint8Array(max);          // (the wait point a run's clock stands at (-1: none), the seconds it has stood there, the waits passed this round, a release asked for)
      const touched = new Uint8Array(max * (nov > 0 ? nov : 1)), touched_n = new Uint16Array(max), leg_prev = new Uint8Array(max), leg_now = new Uint8Array(max), knee_prev = new Uint8Array(max), knee_now = new Uint8Array(max), arm_sent = new Uint8Array(max);
      const list = new Int32Array(max); let nlist = 0;                                                       // (the runs, by slot)
      const V = new Float64Array(NC), H = new Uint8Array(NC), acc = new Float64Array((nov > 0 ? nov : 1) * 6), fire = new Int32Array(MAX_EVENTS + 40);
      let nfire = 0;
      const tg = new Float64Array(3), hf = new Float64Array(2), place = new Float64Array(4 * 4), place_on = new Uint8Array(4);
      // the events: a ring of records [kind, slot, a, value]
      const RING = opt.max_events > 0 ? opt.max_events : 256, ring = new Int32Array(RING * 4), ringf = new Float32Array(ring.buffer);
      let ring_n = 0, dropped = 0;
      rt.stats.dropped = 0;
      const say = function (kind, s, a, value) {
        if (ring_n >= RING) { dropped++; rt.stats.dropped = dropped; return; }
        const i = ring_n++ * 4;
        ring[i] = kind; ring[i + 1] = s; ring[i + 2] = a; ringf[i + 3] = value;
      };
      rt.ev_count = function () { return ring_n; };
      rt.ev_clear = function () { ring_n = 0; };
      rt.drain = function (fn) { for (let i = 0; i < ring_n; i++) fn(ring[i * 4], ring[i * 4 + 1], ring[i * 4 + 2], ringf[i * 4 + 3]); ring_n = 0; };
      rt.ev_kind = function (i) { return ring[i * 4]; }; rt.ev_slot = function (i) { return ring[i * 4 + 1]; }; rt.ev_a = function (i) { return ring[i * 4 + 2]; }; rt.ev_value = function (i) { return ringf[i * 4 + 3]; };

      const reset_all = function () { act.fill(-1); wt_at.fill(-1); nlist = 0; ring_n = 0; touched_n.fill(0); serial = fam.serial; };
      const drop = function (s) { for (let i = 0; i < nlist; i++) if (list[i] === s) { list[i] = list[--nlist]; break; } };

      // ---- the page's setters (before the next update)
      rt.power = function (s, v) { pw[s] = v; }; rt.speed = function (s, v) { spd[s] = v; }; rt.mirror = function (s, on) { mir[s] = on ? 1 : 0; }; rt.height = function (s, v) { hgt[s] = v; }; rt.props = function (s, mask) { props[s] = mask >>> 0; };
      rt.target_point = function (s, x, y, z) { tmode[s] = 1; tgt[s * 3] = x; tgt[s * 3 + 1] = y; tgt[s * 3 + 2] = z; trt[s] = null; };
      rt.target_instance = function (s, rt2, s2, height) { tmode[s] = 2; trt[s] = rt2; tslot[s] = s2; thgt[s] = height === undefined ? -1 : height; };
      rt.target_none = function (s) { tmode[s] = 0; trt[s] = null; };
      rt.playing = function (s) { return act[s]; }; rt.tau = function (s) { return tau_[s]; }; rt.weight = function (s) { return weight[s]; }; rt.is_done = function (s) { return act[s] < 0 || (flags[s] & F_DONE) !== 0; };
      rt.hold = function (s, tau) { hold_at[s] = tau === null || tau === undefined ? -1 : (tau > 0 ? +tau : 0); if (hold_at[s] < 0) fired[s] = 0; };
      rt.hold_off = function (s) { hold_at[s] = -1; fired[s] = 0; };
      rt.stop = function (s) { if (act[s] >= 0 && !(flags[s] & F_STOPPING)) { flags[s] |= F_STOPPING; stop_age[s] = age[s]; } };
      rt.end = function (s) { if (act[s] >= 0) finish(s, HOW_STOPPED); };
      // the states of a learned action: the clock at a wait point goes on when released (said when it stands at one: said at any other time it is nothing), the id of the tag it waits at, the seconds it has waited
      rt.release = function (s) { if (act[s] >= 0 && wt_at[s] >= 0) wt_rel[s] = 1; };
      rt.waiting = function (s) { return act[s] >= 0 && wt_at[s] >= 0 ? lib.F[act[s]].w_tag[wt_at[s]] : -1; };
      rt.wait_age = function (s) { return act[s] >= 0 && wt_at[s] >= 0 ? wt_age[s] : 0; };
      const phase_of = function (s) { const F = lib.F[act[s]]; let q = F.n_ph - 1; while (q > 0 && tau_[s] < F.start[q]) q--; return q; };
      rt.phase = function (s) { return act[s] < 0 ? -1 : phase_of(s); };
      rt.phase_id = function (s) { return act[s] < 0 ? -1 : lib.F[act[s]].ph_id[phase_of(s)]; };

      // `chain`: the action CONTINUES the one that plays now (a clip that begins where the other ended: lying down, then asleep, then getting up): it starts at its full weight, with no fade in, so the pose does not
      // dip towards the neutral one between the two. Without it a new action fades in over its own fade[0]
      rt.start = function (s, id, chain) {
        if (!(s >= 0 && s < max) || !fam.ALIVE[s]) throw new Error("happy_worker_actions: start: not a live instance (" + s + ")");
        const F = lib.F[id];
        if (!F) throw new Error("happy_worker_actions: start: no action " + id);
        if (serial !== fam.serial) reset_all();
        const had = act[s] >= 0;
        if (had) finish(s, HOW_REPLACED);
        act[s] = id; flags[s] = 0; run_gen[s] = fam.GEN[s]; cycle[s] = 0; fired[s] = 0; said[s] = 0; age[s] = 0; chained[s] = chain === true && had ? 1 : 0; ts[s] = 0; tau_[s] = 0; weight[s] = 0; end_age[s] = 0; stop_age[s] = 0; hold_at[s] = -1; wt_at[s] = -1; wt_age[s] = 0; wt_done[s] = 0; wt_rel[s] = 0;
        pw[s] = 1; spd[s] = 1; mir[s] = 0; hgt[s] = 0; pin[s] = -1; tmode[s] = 0; trt[s] = null; air_s[s] = 0; emitted[s] = 0; frame_n[s] = 0; touched_n[s] = 0; warp_sent[s] = 0; leg_prev[s] = 0; leg_now[s] = 0; knee_prev[s] = 0; knee_now[s] = 0; arm_sent[s] = 0;
        list[nlist++] = s;
        rt.stats.runs++;
      };

      // ---- the writes: the very ones that direct.js makes (pose, hand, foot, knee, drive, intent, wings), but the numbers come in a scratch array and the arguments are whole numbers, so that a frame boxes no double to pass it. The
      // arguments of a call are not checked here: every number is the player's, held to its range. The semantics are direct.js's (itself held to the C++ commands by selftest.js), and these are held to the page's runtime.
      const sv = new Float64Array(8);
      const PI_F = Math.fround(3.1416), M_PI_F = -PI_F;
      const put_pose = function (s, k) {
        const a = k * 6, o = (s * nov + k) * 6, Pk = fam.LIFE_POKE;
        Pk[o] = clamp(acc[a], -MAX_ANGLE, MAX_ANGLE); Pk[o + 1] = clamp(acc[a + 1], -MAX_ANGLE, MAX_ANGLE); Pk[o + 2] = clamp(acc[a + 2], -MAX_ANGLE, MAX_ANGLE); Pk[o + 3] = acc[a + 3]; Pk[o + 4] = acc[a + 4]; Pk[o + 5] = acc[a + 5];
      };
      const zero_pose = function (s, k) { const o = (s * nov + k) * 6, Pk = fam.LIFE_POKE; Pk[o] = 0; Pk[o + 1] = 0; Pk[o + 2] = 0; Pk[o + 3] = 0; Pk[o + 4] = 0; Pk[o + 5] = 0; };
      const put_hand = function (s, j, body) {                                                  // sv: weight, x, y, z, pole (radians), pole weight
        const A_ = fam.ARM_ST, i = (s * fam.NARMS + j) * fam.ARM_NS;
        A_[i + K.AS_PWS] = clamp(sv[0], 0, 1); A_[i + K.AS_PFR] = fam.FRAME_NO[0];
        if (!(sv[0] > 0)) return;
        A_[i + K.AS_PUX] = sv[1]; A_[i + K.AS_PUY] = sv[2]; A_[i + K.AS_PUZ] = sv[3]; A_[i + K.AS_PFL] = body;
        A_[i + K.AS_PPA] = clamp(sv[4], M_PI_F, PI_F); A_[i + K.AS_PPW] = clamp(sv[5], 0, 1);
      };
      const put_foot = function (s, k) {                                                       // sv: coverage, x, y, z
        const il = s * nlegs + k;
        if (!(sv[0] > 0)) { fam.OVR_COV[il] = 0; return; }
        fam.OVR_COV[il] = sv[0] > 1 ? 1 : sv[0];
        fam.OVR[il * 3] = sv[1]; fam.OVR[il * 3 + 1] = sv[2]; fam.OVR[il * 3 + 2] = sv[3];
        fam.OVR_FRAME[il] = fam.FRAME_NO[0];
      };
      const put_knee = function (s, k) {                                                       // sv: coverage, angle
        const il = s * nlegs + k;
        if (!(sv[0] > 0)) { fam.KN_COV[il] = 0; return; }
        fam.KN_COV[il] = sv[0] > 1 ? 1 : sv[0];
        fam.KN[il] = sv[1] > PI_F ? PI_F : (sv[1] < M_PI_F ? M_PI_F : sv[1]);
        fam.KN_FRAME[il] = fam.FRAME_NO[0];
      };
      const put_drive = function (s, on) { const R = fam.DRIVE, i = s * 3; R[i] = on ? 1 : 0; R[i + 1] = on ? sv[0] : 0; R[i + 2] = on ? sv[1] : 0; };          // sv: vx, vz
      const put_intent = function (s) { const I = fam.INTENT, i = s * 4; I[i] = sv[0]; I[i + 1] = sv[1]; I[i + 2] = sv[2]; I[i + 3] = sv[3]; };          // sv: the wished velocity and the wished facing
      const put_wings = function (s, mode) { fam.WING_MANUAL[s] = mode; if (mode) { fam.WING_FOLD[s] = sv[0]; fam.WING_HZ[s] = sv[1]; fam.WING_AMP[s] = sv[2]; } };

      // ---- the clock: action_player.js step, for the run of instance s (the numbers it says are V and H)
      const when_ok = function (F, j, s) {
        const b = F.ev_bit[j];
        if (b < 0) return true;
        const have = ((props[s] >>> b) & 1) === 1;
        return F.ev_neg[j] === 1 ? !have : have;
      };
      const step_run = function (s, dt, pn) {
        const F = lib.F[act[s]], C = F.C;
        nfire = 0;
        if (flags[s] & F_DONE) return;
        if (!(dt >= 0)) dt = 0;
        age[s] += dt;
        const power = clamp(pw[s], 0, 3), speed = clamp(spd[s] > 0 ? spd[s] : 1, 0.2, 4), mirror = mir[s] !== 0;
        let tau, w, i2;
        if (hold_at[s] >= 0) {                                                                              // (held: the pose of that time, nothing else)
          tau = hold_at[s]; tau_[s] = tau; flags[s] &= ~F_ENDING;
          values_fast(F, NC, tau, power, mirror, V, H);
          w = C.fade[0] > 0 && chained[s] === 0 ? smooth(age[s] / C.fade[0]) : 1;
          if (flags[s] & F_STOPPING) {
            const q = age[s] - stop_age[s];
            w *= C.fade[1] > 0 ? 1 - smooth(q / C.fade[1]) : 0;
            if (q >= C.fade[1]) flags[s] |= F_DONE;
          }
          weight[s] = w;
          return;
        }
        let t_s, wait_in = -1;
        if (pn >= 0) t_s = pn;
        else {
          if (wt_at[s] >= 0) {                                                                              // (the clock stands at a wait point: it goes on when released, when the wait's time is up, or when the run is told to stop)
            const k = wt_at[s];
            wt_age[s] += dt;
            if ((flags[s] & F_STOPPING) !== 0) wt_at[s] = -1;
            else if (wt_rel[s] === 1 || (F.w_max[k] > 0 && wt_age[s] >= F.w_max[k])) { wt_done[s] |= 1 << k; wt_at[s] = -1; fire[nfire++] = F.ev_n + 2 * k + 1; }
            wt_rel[s] = 0;
          }
          if (wt_at[s] >= 0) t_s = ts[s];
          else {
            t_s = ts[s] + dt * speed;
            if (F.w_n > 0 && (flags[s] & F_STOPPING) === 0) {                                               // (does it come to a wait point this frame? the first one it reaches holds it: in a loop in this round, or in the next if the frame crosses the turn)
              const c0 = C.loop ? Math.floor(ts[s] / C.total) : 0, c1 = C.loop ? Math.floor(t_s / C.total) : 0;
              let found = -1, at = 0;
              for (let c = c0; c <= c1 && found < 0; c++) for (let k = 0; k < F.w_n; k++) {
                if (c === c0 && ((wt_done[s] >> k) & 1) === 1) continue;
                const p = c * C.total + F.w_tau[k];
                if (ts[s] <= p && t_s >= p) { found = k; at = p; break; }
              }
              if (found >= 0) { t_s = at; wt_at[s] = found; wt_age[s] = 0; wait_in = F.ev_n + 2 * found; }
            }
          }
        }
        ts[s] = t_s; tau = t_s;
        let ending = tau >= C.total && !C.hold && !C.loop && wt_at[s] < 0;
        if (C.lies && !C.loop && tau >= C.total) flags[s] |= F_SETTLED; else flags[s] &= ~F_SETTLED;          // (a HOLD action that is not a movement lies still past its end: the body does not go on at the speed of its last key; a held movement is a walk that goes on)
        if (C.loop) {
          const cyc = Math.floor(t_s / C.total);
          if (C.cycles > 0 && cyc >= C.cycles) { tau = C.total; ending = true; }
          else {
            tau = t_s - cyc * C.total; ending = false;
            if (cyc > cycle[s]) {
              if (!(flags[s] & F_STOPPING)) for (i2 = 0; i2 < F.ev_n; i2++) if (F.ev_kind[i2] !== 2 && ((fired[s] >>> F.ev_i[i2]) & 1) === 0 && when_ok(F, i2, s)) fire[nfire++] = i2;
              fired[s] = 0; cycle[s] = cyc; wt_done[s] = 0;
            }
          }
        }
        tau_[s] = tau;
        values_fast(F, NC, tau, power, mirror, V, H);
        if (!(flags[s] & F_STOPPING)) for (i2 = 0; i2 < F.ev_n; i2++) {
          if (tau >= F.ev_tau[i2] && ((fired[s] >>> F.ev_i[i2]) & 1) === 0 && when_ok(F, i2, s)) { fired[s] |= 1 << F.ev_i[i2]; fire[nfire++] = i2; }
        }
        for (i2 = 0; i2 < nfire; i2++) fired[s] |= 1 << F.ev_i[fire[i2]];
        if (wait_in >= 0) fire[nfire++] = wait_in;                                                                // (reaching a wait point is told after the moments up to it)
        if (ending && !(flags[s] & F_ENDING)) { flags[s] |= F_ENDING; end_age[s] = age[s]; }
        const w_in = C.fade[0] > 0 && chained[s] === 0 ? smooth(age[s] / C.fade[0]) : 1;
        let w_out = 1, out_at = -1;
        if (flags[s] & F_STOPPING) out_at = stop_age[s]; else if (flags[s] & F_ENDING) out_at = end_age[s];
        if (out_at >= 0) {
          if ((flags[s] & F_STOPPING) && (flags[s] & F_ENDING)) out_at = Math.min(stop_age[s], end_age[s]);
          const q = age[s] - out_at;
          w_out = C.fade[1] > 0 ? 1 - smooth(q / C.fade[1]) : 0;
          if (q >= C.fade[1]) flags[s] |= F_DONE;
        }
        weight[s] = w_in * w_out;
      };

      // ---- the creature: the root's heading, a target, a bone in the world
      const heading = function (s) {
        const R = fam.ROOT, o8 = s * 8, fx = 2 * (R[o8 + 4] * R[o8 + 6] + R[o8 + 7] * R[o8 + 5]), fz = 1 - 2 * (R[o8 + 4] * R[o8 + 4] + R[o8 + 5] * R[o8 + 5]), l = Math.hypot(fx, fz) || 1;
        hf[0] = fx / l; hf[1] = fz / l;
      };
      const target = function (s) {                                                                          // -> true, and the place is in tg
        const m = tmode[s];
        if (m === 1) { tg[0] = tgt[s * 3]; tg[1] = tgt[s * 3 + 1]; tg[2] = tgt[s * 3 + 2]; return true; }
        if (m === 2) {
          const r2 = trt[s];
          if (r2 === null || !r2.fam.ALIVE[tslot[s]]) return false;
          const R = r2.fam.ROOT, o8 = tslot[s] * 8, h = thgt[s] < 0 ? 1.8 * r2.plan.hh : thgt[s];
          tg[0] = R[o8]; tg[1] = R[o8 + 1] + h * R[o8 + 3]; tg[2] = R[o8 + 2];
          return true;
        }
        return false;
      };
      // a bone's head in the world: the skeleton's frames (model space) turned by the root's turn times its lean, scaled, moved (the page's sp.bone_world)
      const bone_world = function (s, b) {
        const R = fam.ROOT, Ln = fam.LEAN, rows = fam.SK_ROWS, rn = fam.SK_ROWS_N, o8 = s * 8, o4 = s * 4, r = rn * s + b * 8;
        const ax = R[o8 + 4], ay = R[o8 + 5], az = R[o8 + 6], aw = R[o8 + 7], bx = Ln[o4], by = Ln[o4 + 1], bz = Ln[o4 + 2], bw = Ln[o4 + 3];
        const qx = ax * bw + aw * bx + ay * bz - az * by, qy = ay * bw + aw * by + az * bx - ax * bz, qz = az * bw + aw * bz + ax * by - ay * bx, qw = aw * bw - ax * bx - ay * by - az * bz;
        const px = rows[r], py = rows[r + 1], pz = rows[r + 2];
        const cx = qy * pz - qz * py + qw * px, cy = qz * px - qx * pz + qw * py, cz = qx * py - qy * px + qw * pz, sc = R[o8 + 3];
        tg[0] = R[o8] + (px + 2 * (qy * cz - qz * cy)) * sc; tg[1] = R[o8 + 1] + (py + 2 * (qz * cx - qx * cz)) * sc; tg[2] = R[o8 + 2] + (pz + 2 * (qx * cy - qy * cx)) * sc;
      };

      // the bones: the angles of a group are shared between its bones, added into the accumulator of each bone's overlay slot
      const touch = function (s, k) {
        const at = s * nov + k;
        if (touched[at] === 0) { touched[at] = 1; touched_n[s]++; }
      };
      const add_rot = function (s, grp_bones, yaw, pitch, roll) {
        const k = grp_bones.length;
        for (let b = 0; b < k; b++) { const sl = bslot[grp_bones[b]]; touch(s, sl); const a = sl * 6; acc[a] += yaw / k; acc[a + 1] += pitch / k; acc[a + 2] += roll / k; }
      };

      // ---- the air phase: the body plays it (action_runtime.js air_pin)
      const air_pin = function (s, dt) {
        const F = lib.F[act[s]], C = F.C;
        if (C.air < 0 || !groups.air || hold_at[s] >= 0 || (flags[s] & F_STOPPING) || (flags[s] & F_DONE)) return -1;
        const A = C.start[C.air], B = A + (C.air_span > 0 ? C.air_span : C.dur[C.air]);
        if (air_s[s] === 0) {
          const speed = spd[s] > 0 ? Math.max(0.2, Math.min(4, +spd[s])) : 1;
          if (ts[s] + dt * speed < A) return -1;
          const given = hgt[s] > 0, base = given ? +hgt[s] : (lib.specs[act[s]].height > 0 ? +lib.specs[act[s]].height : 1.1);
          const h = Math.max(0.05, Math.min(30, given ? base : base * plan.hh * fam.ROOT[s * 8 + 3] / 0.95)), g = plan.gravity;
          air_s[s] = 1; air_h[s] = h; air_T[s] = 2 * Math.sqrt(2 * g * h) / g; air_y0[s] = fam.ROOT[s * 8 + 1]; air_ymax[s] = 0; flags[s] |= F_AIR_UP; flags[s] &= ~F_AIR_SEEN; air_u[s] = 0; air_t[s] = 0;
          D.jump(fam, s, Math.sqrt(2 * g * h), 0);
          say(EV_EMIT, s, lib.tag("jumped"), h);
          return A;
        }
        if (air_s[s] === 1) {
          air_t[s] += dt;
          const dy = fam.ROOT[s * 8 + 1] - air_y0[s], h = air_h[s];
          if (dy > air_ymax[s]) air_ymax[s] = dy; else if (air_ymax[s] - dy > 0.004 * h + 0.002) flags[s] &= ~F_AIR_UP;
          if (dy > 0.02 * h) flags[s] |= F_AIR_SEEN;
          const r = Math.sqrt(Math.max(0, 1 - Math.min(1, Math.max(0, dy) / h)));
          let u = (flags[s] & F_AIR_UP) ? 0.5 * (1 - r) : 0.5 * (1 + r);
          if (u < air_u[s]) u = air_u[s];
          air_u[s] = u;
          const landed = (fam.FLAGS[s] & K.F_AIR) === 0 && air_t[s] > 0.02, down = landed && ((flags[s] & F_AIR_SEEN) || air_t[s] > 0.5), late = air_t[s] > 2 * air_T[s] + 0.8;
          if (down || late) { air_s[s] = 2; say(EV_EMIT, s, lib.tag("landed"), fam.LANDED === null ? 0 : fam.LANDED[s]); return B; }
          return A + u * (B - A);
        }
        return -1;
      };

      // an impulse event: the body's speed changes by `speed` hips' heights a second along `dir` (and `up` upward), times the power
      const impulse = function (s, F, j) {
        const R = fam.ROOT, o8 = s * 8;
        heading(s);
        const k = plan.hh * R[o8 + 3] * pw[s];
        let d = F.ev_dir[j], x = hf[0], z = hf[1];
        if (mir[s] && (d === 2 || d === 3)) d = d === 2 ? 3 : 2;
        if (d === 1) { x = -hf[0]; z = -hf[1]; }
        else if (d === 2) { x = hf[1]; z = -hf[0]; }
        else if (d === 3) { x = -hf[1]; z = hf[0]; }
        else if (d === 4) { if (target(s)) { const dx = tg[0] - R[o8], dz = tg[2] - R[o8 + 2], l = Math.hypot(dx, dz); if (l > 1e-6) { x = dx / l; z = dz / l; } } }
        D.push(fam, s, x * F.ev_speed[j] * k, z * F.ev_speed[j] * k, F.ev_up[j] * k);
        if (F.ev_up[j] > 0 && groups.air) D.jump(fam, s, F.ev_up[j] * k, 0);
      };

      // ---- MOTION WARPING. An action that grabs (events `grab`, v +1 the left hand and -1 the right) plays with a TARGET (the page's target option, me.act_target: a point of the world, or an instance): the hand that grabs is pulled to
      // it, as a WORLD REACH (the lean and the crouch bring the body to it as far as it goes: a point that is out of reach is given up, as any reach is), so that at the moment of the grab the hand is on the thing, wherever the
      // clip took it. The weight is the action's own times a ramp: up over the WARP_LEAD seconds before the grab (less when the clip has less before it), full for WARP_HOLD after it (the brain closes the grip at the event: the
      // hand is on the thing), then let go over WARP_OUT: the clip's own hand carries on from there, and what the hand holds comes with it. A mirrored run grabs with the other hand. No target, or no grab in the action: nothing
      // is warped. A hand that was warped and is not now is let go (weight 0)
      const WARP_LEAD = 0.5, WARP_HOLD = 0.2, WARP_OUT = 0.4;
      const ramp = function (x) { return x <= 0 ? 0 : (x >= 1 ? 1 : x * x * (3 - 2 * x)); };
      const warp_hands = function (s, F, w) {
        warp_w[0] = 0; warp_w[1] = 0;
        if (F.warp_n > 0 && tmode[s] !== 0 && w > 0.001 && target(s)) {
          const t = tau_[s];
          for (let k = 0; k < F.warp_n; k++) {
            const t0 = F.warp_t[k], lead = t0 < WARP_LEAD ? (t0 > 0.05 ? t0 : 0.05) : WARP_LEAD;
            let ww = 0;
            if (t < t0) ww = ramp((t - (t0 - lead)) / lead);
            else if (t <= t0 + WARP_HOLD) ww = 1;
            else ww = 1 - ramp((t - t0 - WARP_HOLD) / WARP_OUT);
            const side = mir[s] ? 1 - F.warp_side[k] : F.warp_side[k];
            if (ww > warp_w[side]) warp_w[side] = ww;
          }
        }
        let sent = 0;
        for (let side = 0; side < 2; side++) {
          const arm = side === 0 ? plan.arm.l : plan.arm.r, ww = warp_w[side] * w;
          if (!arm) continue;
          if (ww > 0.001) { D.hand(fam, s, arm.j, 2 | 4 | 16, ww, tg[0], tg[1], tg[2], 0, 0); sent |= 1 << side; }
          else if (((warp_sent[s] >> side) & 1) !== 0) D.hand(fam, s, arm.j, 2, 0, 0, 0, 0, 0, 0);
        }
        warp_sent[s] = sent;
      };

      // ---- one frame of one run: the clock, then the columns (action_runtime.js frame_of)
      const frame_of = function (s, dt) {
        const F = lib.F[act[s]], C = F.C;
        frame_n[s]++;
        const pn = air_pin(s, dt);
        step_run(s, dt, pn);
        const w = weight[s], fl = flags[s];
        // the role bones
        const tn = touched_n[s];
        if (tn > 0) for (let k = 0; k < nov; k++) if (touched[s * nov + k]) { const a = k * 6; acc[a] = 0; acc[a + 1] = 0; acc[a + 2] = 0; acc[a + 3] = 0; acc[a + 4] = 0; acc[a + 5] = 0; }
        let yaw_trunk = 0, yaw_neck = 0;
        for (let g = 0; g < ROT_N; g++) {
          if (!(H[IY[g]] || H[IP[g]] || H[IR[g]]) || !groups[ROT[g]]) continue;
          const yaw = (H[IY[g]] ? V[IY[g]] : P.NEU[IY[g]]) * DEG * w, pitch = -(H[IP[g]] ? V[IP[g]] : P.NEU[IP[g]]) * DEG * w, roll = (H[IR[g]] ? V[IR[g]] : P.NEU[IR[g]]) * DEG * w;
          add_rot(s, bones[ROT[g]], yaw, pitch, roll);
          if (g < 3) yaw_trunk += yaw; else if (g === 3) yaw_neck += yaw;
        }
        if (groups.jaw && H[I_JAW]) {
          const open = Math.max(0, V[I_JAW]) * DEG, jb = bones.jaw;
          for (let j = 0; j < jb.length; j++) { const sl = bslot[jb[j]]; touch(s, sl); acc[sl * 6 + 1] += Math.min(open, 1.2 * plan.jaw_max[j]) * w; }
        }
        if (groups.hips_move && (H[I_HX] || H[I_HY] || H[I_HZ])) {
          const sl = bslot[bones.hips[0]], hh = plan.hh;
          touch(s, sl);
          acc[sl * 6 + 3] += (H[I_HX] ? V[I_HX] : P.NEU[I_HX]) * hh * w; acc[sl * 6 + 4] += (H[I_HY] ? V[I_HY] : P.NEU[I_HY]) * hh * w; acc[sl * 6 + 5] += (H[I_HZ] ? V[I_HZ] : P.NEU[I_HZ]) * hh * w;
        }
        if (groups.look && H[I_LOOK] && V[I_LOOK] > 0.02) {
          const hb = bones.head.length ? bones.head[0] : bones.neck[0];
          if (target(s) && w > 0.001) {
            const tx = tg[0], ty = tg[1], tz = tg[2];
            bone_world(s, hb);
            heading(s);
            const dx = tx - tg[0], dy = ty - tg[1], dz = tz - tg[2];
            const fwd = dx * hf[0] + dz * hf[1], left = dx * hf[1] - dz * hf[0], flat = Math.hypot(fwd, left);
            const kk = Math.min(1, V[I_LOOK]) * w;
            const yaw = Math.max(-1.3, Math.min(1.3, Math.atan2(left, fwd))), up = Math.max(-0.8, Math.min(0.8, Math.atan2(dy, flat)));
            const want_y = (yaw - yaw_trunk - yaw_neck) * kk, want_p = -up * kk;
            const nk = bones.neck.length, share = nk && bones.head.length ? 0.4 : (nk ? 1 : 0);
            if (nk && share > 0) for (let q = 0; q < nk; q++) { const sl = bslot[bones.neck[q]]; touch(s, sl); acc[sl * 6] += want_y * share / nk; acc[sl * 6 + 1] += want_p * share / nk; }
            if (bones.head.length) { const sl = bslot[bones.head[0]]; touch(s, sl); acc[sl * 6] += want_y * (1 - share); acc[sl * 6 + 1] += want_p * (1 - share); }
          }
        }
        if (touched_n[s] > 0) for (let k = 0; k < nov; k++) if (touched[s * nov + k]) {
          put_pose(s, k);
        }
        // the hands
        for (let key = 0; key < 2; key++) {
          const arm = key === 0 ? plan.arm.l : plan.arm.r;
          if (!(H[AX[key]] || H[AY[key]] || H[AZ[key]]) || !arm) continue;
          if (w < 0.0005 && ((arm_sent[s] >> key) & 1) === 0) continue;
          const pole = H[AP[key]] ? V[AP[key]] : 0;
          sv[0] = w; sv[1] = arm.side * (H[AX[key]] ? V[AX[key]] : P.NEU[AX[key]]); sv[2] = H[AY[key]] ? V[AY[key]] : P.NEU[AY[key]]; sv[3] = H[AZ[key]] ? V[AZ[key]] : P.NEU[AZ[key]]; sv[4] = pole * DEG; sv[5] = pole !== 0 ? 1 : 0;
          put_hand(s, arm.j, C.frame !== "chest" ? 1 : 0);
          arm_sent[s] |= 1 << key;
        }
        // motion warping: the hands that grab are pulled to the action's target
        if (F.warp_n > 0 || warp_sent[s] !== 0) warp_hands(s, F, w);
        // the legs: a foot for the legs of every group the action has a track for, the knee, the legs it said before and does not say now go back to the gait
        if (groups.leg_l || groups.leg_r || groups.legf_l || groups.legf_r) {
          leg_now[s] = 0; knee_now[s] = 0; place_on[0] = 0; place_on[1] = 0; place_on[2] = 0; place_on[3] = 0;
          for (let g = 0; g < 4; g++) {
            const legs = plan.legs[LEGK_NAME[g]];
            if (!legs.length) continue;
            const left = (g & 1) === 0;
            if (H[LX[g]] || H[LY[g]] || H[LZ[g]] || H[LO[g]]) {
              const cov = (H[LO[g]] ? clamp(V[LO[g]], 0, 1) : 1) * w, x = H[LX[g]] ? V[LX[g]] : P.NEU[LX[g]], y = H[LY[g]] ? V[LY[g]] : P.NEU[LY[g]], z = H[LZ[g]] ? V[LZ[g]] : P.NEU[LZ[g]];
              place[g * 4] = cov; place[g * 4 + 1] = x; place[g * 4 + 2] = y; place[g * 4 + 3] = z; place_on[g] = 1;
              if (cov > 0.001) for (let j = 0; j < legs.length; j++) { const r = plan.legrest[legs[j]]; sv[0] = cov; sv[1] = r[0] + (left ? 1 : -1) * (x - LEG_NEU[0]); sv[2] = r[1] + y - LEG_NEU[1]; sv[3] = r[2] + z - LEG_NEU[2]; put_foot(s, legs[j]); leg_now[s] |= 1 << legs[j]; }
            }
            if (H[LP[g]] && w > 0.001) for (let j = 0; j < legs.length; j++) { sv[0] = w; sv[1] = V[LP[g]] * DEG; put_knee(s, legs[j]); knee_now[s] |= 1 << legs[j]; }
          }
          for (let key = 0; key < 2; key++) {                                                                // (the middle pair of three ranks: where the average of the hind and the front pair would have it)
            const mid = plan.legs[key === 0 ? "mid_l" : "mid_r"], a = key, b = 2 + key;
            if (!mid.length || !place_on[a] || !place_on[b] || place[a * 4] + place[b * 4] <= 0.002) continue;
            const cov = 0.5 * (place[a * 4] + place[b * 4]), ia = place[a * 4] / (place[a * 4] + place[b * 4]), ib = 1 - ia;
            if (cov > 0.001) for (let j = 0; j < mid.length; j++) {
              const r = plan.legrest[mid[j]], x = place[a * 4 + 1] * ia + place[b * 4 + 1] * ib, y = place[a * 4 + 2] * ia + place[b * 4 + 2] * ib, z = place[a * 4 + 3] * ia + place[b * 4 + 3] * ib;
              sv[0] = cov; sv[1] = r[0] + (key === 0 ? 1 : -1) * (x - LEG_NEU[0]); sv[2] = r[1] + y - LEG_NEU[1]; sv[3] = r[2] + z - LEG_NEU[2]; put_foot(s, mid[j]); leg_now[s] |= 1 << mid[j];
            }
          }
          const lost = leg_prev[s] & ~leg_now[s], klost = knee_prev[s] & ~knee_now[s];
          if (lost | klost) for (let k = 0; k < nlegs; k++) { sv[0] = 0; if ((lost >> k) & 1) put_foot(s, k); if ((klost >> k) & 1) put_knee(s, k); }
          leg_prev[s] = leg_now[s]; knee_prev[s] = knee_now[s];
        }
        // the body's speed: the body goes at the speed of the track, facing where it faced
        if (plan.body && (H[I_BF] || H[I_BS])) {
          heading(s);
          const sc = plan.hh * fam.ROOT[s * 8 + 3] * ((fl & F_ENDING) || (fl & F_SETTLED) || hold_at[s] >= 0 ? 0 : w), fv = (H[I_BF] ? V[I_BF] : P.NEU[I_BF]) * sc, lv = (H[I_BS] ? V[I_BS] : P.NEU[I_BS]) * sc;
          sv[0] = 0; sv[1] = 0; sv[2] = hf[0]; sv[3] = hf[1]; put_intent(s);
          sv[0] = fv * hf[0] + lv * hf[1]; sv[1] = fv * hf[1] - lv * hf[0]; put_drive(s, 1);
          flags[s] |= F_USED_BODY;
        }
        // the wings: by hand while the tracks say so, eased in and out by the fade
        if (groups.wings && (H[I_WF] || H[I_WH] || H[I_WA])) {
          const base = (fam.FLAGS[s] & K.F_FLY) ? 0 : 1, fold = H[I_WF] ? V[I_WF] : base, kk = (fl & F_ENDING) || (flags[s] & F_DONE) ? 0 : w;
          const amp = Math.max(0, Math.min(3, (H[I_WA] ? V[I_WA] : plan.wing_amp) / plan.wing_amp * kk));
          sv[0] = q3(Math.max(0, Math.min(1, base + (fold - base) * kk)), 500); sv[1] = q3(Math.max(0, Math.min(50, H[I_WH] ? V[I_WH] : 0)), 100); sv[2] = q3(amp, 500);
          put_wings(s, 1);
          flags[s] |= F_USED_WINGS;
        }
        // the events: a tag is told, an impulse pushes, the others are said once as skipped
        for (let i = 0; i < nfire; i++) {
          const j = fire[i], kd = F.ev_kind[j];
          if (kd === 0) { emitted[s]++; say(EV_EMIT, s, F.ev_tag[j], F.ev_pw[j] === 1 ? F.ev_v[j] * clamp(pw[s], 0, 3) : F.ev_v[j]); }
          else if (kd === 1 && plan.body) impulse(s, F, j);
          else {
            if (kd === 2) { emitted[s]++; say(EV_EMIT, s, F.ev_tag[j], F.ev_v[j]); }                          // (a hit: told as an emit `hit`, its limb's index the value; and said once as skipped, its damage and reach are not played)
            if (kd !== 255 && ((said[s] >> kd) & 1) === 0) { said[s] |= 1 << kd; say(EV_SKIPPED, s, kd, 0); }
          }
        }
      };

      // the run is over: everything it said is let go
      const finish = function (s, how) {
        if (act[s] < 0) return;
        if (fam.ALIVE[s] && fam.GEN[s] === run_gen[s] && how !== HOW_GONE) {
          if (touched_n[s] > 0) for (let k = 0; k < nov; k++) if (touched[s * nov + k]) zero_pose(s, k);
          for (let key = 0; key < 2; key++) if ((arm_sent[s] >> key) & 1) { const arm = key === 0 ? plan.arm.l : plan.arm.r; if (arm) { sv[0] = 0; put_hand(s, arm.j, 0); } }
          for (let key = 0; key < 2; key++) if ((warp_sent[s] >> key) & 1) { const arm = key === 0 ? plan.arm.l : plan.arm.r; if (arm) D.hand(fam, s, arm.j, 2, 0, 0, 0, 0, 0, 0); }
          warp_sent[s] = 0;
          for (let k = 0; k < nlegs; k++) { sv[0] = 0; if ((leg_prev[s] >> k) & 1) put_foot(s, k); if ((knee_prev[s] >> k) & 1) put_knee(s, k); }
          if (flags[s] & F_USED_BODY) { put_drive(s, 0); sv[0] = 0; sv[1] = 0; sv[2] = 0; sv[3] = 0; put_intent(s); }
          if (flags[s] & F_USED_WINGS) put_wings(s, 0);
        }
        if (touched_n[s] > 0) { const at = s * nov; for (let k = 0; k < nov; k++) touched[at + k] = 0; touched_n[s] = 0; }
        act[s] = -1; flags[s] = 0;
        drop(s);
        say(EV_END, s, how, 0);
      };

      // ---- once a frame
      rt.update = function (dt) {
        if (serial !== fam.serial) reset_all();
        rt.stats.updates++;
        for (let i = 0; i < nlist; i++) {
          const s = list[i];
          if (!fam.ALIVE[s] || fam.GEN[s] !== run_gen[s]) { finish(s, HOW_GONE); i--; continue; }       // (finish took it out of the list: the one that was last is at i now)
          frame_of(s, dt);
          if (flags[s] & F_DONE) { const how = (flags[s] & F_STOPPING) ? HOW_STOPPED : HOW_FINISHED; finish(s, how); i--; }
        }
      };
      rt.finish = finish;
      return rt;
    }

    const values = function (F, tau, power, mirror, V, H) { values_fast(F, NC, tau, power, mirror, V, H); };          // (for the tests: the player's values, from the typed tables)
    return { library: library, family: family, values: values, EV_EMIT: EV_EMIT, EV_END: EV_END, EV_SKIPPED: EV_SKIPPED, HOW_FINISHED: HOW_FINISHED, HOW_STOPPED: HOW_STOPPED, HOW_GONE: HOW_GONE, HOW_REPLACED: HOW_REPLACED, KIND: KIND };
  }

  return { create: create };
});

// ========================================================================================================================
// worker_board
// ========================================================================================================================
packing()("happy_worker_board", function happy_worker_board() {
  "use strict";
  // HAPPY WORKER BOARD: the BLACKBOARD every creature (of every family) and every world block shares, so that they know how to deal with each other without knowing each other (SYSTEM.md). Like pure.js it is a
  // generic service of the worker: it knows no creature and no rule of any game; what a number means is for the blocks that write and read it. It holds three things, all in typed arrays (nothing is allocated by a read or a write):
  //   FACTS    numbers by NAME: the world's (`alarm`, `night`) and the zones' (`kitchen` has `occupied`): B.key(name) -> id once, then B.set(id, v) / B.get(id) / B.add(id, dv); B.zset(zone, id, v) / B.zget / B.zadd
  //   ROLES    the role the world's AI gave a creature (the columns role, role_kind, role_a, role_b, role_until, role_t: a role is a number from the world's w.roles, 0 none; the target is a kind and two numbers, see the `role` block of
  //            world/blocks/): written by the `role` block, read by any block straight from the columns
  //   RECORDS  one a creature that lives, found from its HANDLE (the worker world's `js << 16 | slot`): its faction, its kind (a number a block gives its family: prey, predator, person), what it does (`state`), its target (a
  //            handle), the goal it was given (a place and how to go there: the walk block executes it, any block may set it), its health and mood, its claim of a slot, free flags. B.family(js, max) gives a family its block of
  //            records when it is installed; B.rec(h) -> the index (-1: none); the columns are B.faction[i], B.kind[i], B.state[i], B.target[i], B.goal_kind[i], B.goal_x[i] ... and B.reset(i) clears one (a slot used again)
  //   EVENTS   things that happened, for whoever is near enough to hear: B.emit(type, src, x, y, z, r, a, b) (a noise, a death, a call for help: `r` is how far it carries), and a CONSUMER keeps its own cursor:
  //            const c = { n: B.head } ... for (let i = B.next(c); i >= 0; i = B.next(c)) { B.ev_type[i], B.ev_x[i] ... }   an event that fell off the ring (a consumer that was too slow) is skipped, not an error (B.lost counts them)
  //   RELATIONS between factions (B.faction_id(name), B.relate(a, b, v), B.relation(a, b): -1 hostile, 0 neutral, 1 friendly; a faction is friendly to itself until it is told otherwise)
  // The page's world host reads what must cross to it (B.public(id)): a fact set with a key marked public calls B.on_public(id, value).
  //   const B = create({ records: 4096, events: 512, keys: 256, zones: 0 })
  // Node 14: no optional chaining, no ??.
  const GOAL_NONE = 0;
  function create(o) {
    o = o || {};
    let NREC = o.records || 256;
    const NEV = o.events || 512, NKEY = o.keys || 256, NFAC = 32;
    const B = { time: 0, lost: 0, head: 0, on_public: null };
    const names = [], ids = Object.create(null);
    B.key = function (name) {
      let k = ids[name];
      if (k !== undefined) return k;
      if (names.length >= NKEY) throw new Error("happy_worker_board: " + NKEY + " names are used (key `" + name + "`)");
      k = names.length; names.push(name); ids[name] = k;
      return k;
    };
    B.name = function (k) { return names[k]; };
    B.has = function (name) { return ids[name] !== undefined; };

    // ---- facts
    const facts = new Float64Array(NKEY), pub = new Uint8Array(NKEY);
    let nz = o.zones | 0, zfacts = new Float64Array(NKEY * Math.max(1, nz));
    B.public = function (k) { pub[k] = 1; };
    B.set = function (k, v) { if (facts[k] !== v) { facts[k] = v; if (pub[k] === 1 && B.on_public !== null) B.on_public(k, v, -1); } };
    B.get = function (k) { return facts[k]; };
    B.add = function (k, dv) { B.set(k, facts[k] + dv); return facts[k]; };
    B.zones = function (n) { if (n !== nz) { nz = n; zfacts = new Float64Array(NKEY * Math.max(1, n)); } };
    B.zset = function (z, k, v) { if (z >= 0 && z < nz && zfacts[z * NKEY + k] !== v) { zfacts[z * NKEY + k] = v; if (pub[k] === 1 && B.on_public !== null) B.on_public(k, v, z); } };
    B.zget = function (z, k) { return z >= 0 && z < nz ? zfacts[z * NKEY + k] : 0; };
    B.zadd = function (z, k, dv) { if (z >= 0 && z < nz) B.zset(z, k, zfacts[z * NKEY + k] + dv); return B.zget(z, k); };

    // ---- records: a block of NREC for the families, found from the handle
    const base = Object.create(null);
    let used = 0;
    // the columns (one entry a record) and what a clean record holds; they GROW when a family is installed that does not fit (a copy: a block reads a column through B each time, it never keeps one)
    const COLS = [["faction", Uint8Array, 0], ["kind", Uint8Array, 0], ["state", Int16Array, 0], ["target", Int32Array, -1], ["claim", Int32Array, -1], ["goal_kind", Uint8Array, 0], ["goal_x", Float32Array, 0], ["goal_y", Float32Array, 0], ["goal_z", Float32Array, 0],
      ["goal_r", Float32Array, 0], ["goal_speed", Float32Array, 0], ["goal_urgent", Uint8Array, 0], ["goal_id", Int32Array, 0], ["goal_state", Uint8Array, 0], ["hp", Float32Array, 0], ["mood", Float32Array, 0], ["flags", Uint32Array, 0], ["busy", Float64Array, 0],
      ["role", Uint8Array, 0], ["role_kind", Uint8Array, 0], ["role_a", Float64Array, 0], ["role_b", Float32Array, 0], ["role_until", Float64Array, 0], ["role_t", Float64Array, 0]];
    // goal_id: a number the setter keeps to know which goal the walker is on; goal_state is written by the walker: 0 none, 1 going, 2 arrived, 3 failed
    const make_cols = function (n, from) {
      COLS.forEach(function (c) { const a = new c[1](n); if (c[2] !== 0) a.fill(c[2]); if (from) a.set(from[c[0]]); B[c[0]] = a; });
    };
    const old_cols = function () { const o = {}; COLS.forEach(function (c) { o[c[0]] = B[c[0]]; }); return o; };
    make_cols(NREC, null);
    B.family = function (js, max) {
      if (base[js] !== undefined) return base[js];
      if (used + max > NREC) { let m = NREC; while (m < used + max) m *= 2; make_cols(m, old_cols()); NREC = m; }
      base[js] = used; used += max;
      return base[js];
    };
    B.rec = function (h) { if (h < 0) return -1; const b = base[h >> 16]; return b === undefined ? -1 : b + (h & 65535); };
    B.reset = function (i) {
      B.faction[i] = 0; B.kind[i] = 0; B.state[i] = 0; B.target[i] = -1; B.claim[i] = -1; B.goal_kind[i] = GOAL_NONE; B.goal_x[i] = 0; B.goal_y[i] = 0; B.goal_z[i] = 0; B.goal_r[i] = 0; B.goal_speed[i] = 0;
      B.goal_urgent[i] = 0; B.goal_id[i] = 0; B.goal_state[i] = 0; B.hp[i] = 0; B.mood[i] = 0; B.flags[i] = 0; B.busy[i] = 0;
      B.role[i] = 0; B.role_kind[i] = 0; B.role_a[i] = 0; B.role_b[i] = 0; B.role_until[i] = 0; B.role_t[i] = 0;
    };
    // the goal of a creature: what the walk block executes. kind: 1 a place (x, y, z within r), 2 follow a creature (x of target: its handle in goal_id, within r), 3 a slot (goal_id: the slot, the walker goes to its stand point)
    B.goal = function (i, kind, x, y, z, r, speed, urgent, id) {
      B.goal_kind[i] = kind; B.goal_x[i] = x; B.goal_y[i] = y; B.goal_z[i] = z; B.goal_r[i] = r; B.goal_speed[i] = speed; B.goal_urgent[i] = urgent ? 1 : 0; B.goal_id[i] = id | 0; B.goal_state[i] = 1;
    };
    B.goal_clear = function (i) { B.goal_kind[i] = GOAL_NONE; B.goal_state[i] = 0; };

    // ---- factions and what they feel for each other
    const fac = Object.create(null), rel = new Int8Array(NFAC * NFAC);
    let nf = 1;
    fac["none"] = 0;
    B.faction_id = function (name) {
      let f = fac[name];
      if (f !== undefined) return f;
      if (nf >= NFAC) throw new Error("happy_worker_board: at most " + NFAC + " factions");
      f = nf++; fac[name] = f; rel[f * NFAC + f] = 1;
      return f;
    };
    const kinds = Object.create(null);
    let nk = 1;
    B.kind_id = function (name) {                                                                          // a family's kind (prey, predator, person ...): a number below 256, 0 for none
      let k = kinds[name];
      if (k !== undefined) return k;
      if (nk >= 255) throw new Error("happy_worker_board: at most 255 kinds");
      k = nk++; kinds[name] = k;
      return k;
    };
    B.relate = function (a, b, v) { rel[a * NFAC + b] = v; };
    B.relation = function (a, b) { return rel[a * NFAC + b]; };

    // ---- events: a ring; a consumer keeps a cursor
    B.ev_type = new Int16Array(NEV); B.ev_src = new Int32Array(NEV); B.ev_x = new Float32Array(NEV); B.ev_y = new Float32Array(NEV); B.ev_z = new Float32Array(NEV);
    B.ev_r = new Float32Array(NEV); B.ev_a = new Float32Array(NEV); B.ev_b = new Float32Array(NEV); B.ev_t = new Float64Array(NEV);
    B.emit = function (type, src, x, y, z, r, a, b) {
      const i = B.head % NEV;
      B.ev_type[i] = type; B.ev_src[i] = src; B.ev_x[i] = x; B.ev_y[i] = y; B.ev_z[i] = z; B.ev_r[i] = r; B.ev_a[i] = a || 0; B.ev_b[i] = b || 0; B.ev_t[i] = B.time;
      B.head++;
    };
    B.cursor = function () { return { n: B.head }; };
    B.next = function (c) {                                                                                // -> the index of the next event for this cursor (read B.ev_*[i]), -1 when there is none
      if (c.n < B.head - NEV) { B.lost += B.head - NEV - c.n; c.n = B.head - NEV; }
      if (c.n >= B.head) return -1;
      return (c.n++) % NEV;
    };
    // a hearer: does the event at index i carry to (x, y, z)?
    B.hears = function (i, x, y, z) { const dx = x - B.ev_x[i], dy = y - B.ev_y[i], dz = z - B.ev_z[i]; return dx * dx + dy * dy + dz * dz <= B.ev_r[i] * B.ev_r[i]; };
    B.stats = function () { return { names: names.length, records: used, of: NREC, events: B.head, lost: B.lost }; };
    return B;
  }
  return { create: create };
});

// ========================================================================================================================
// worker_bt
// ========================================================================================================================
packing()("happy_worker_bt", function happy_worker_bt() {
  "use strict";
  // HAPPY WORKER BT: the AI of a creature family, a behaviour tree, in JS (SYSTEM.md, "The AI"). The family's worker function returns it, with its other hooks, as a plain object:
  //     return { ai: { hz: 6, far_hz: 1, sense: function (me) { ... }, tree: { select: [ { when: threat, seq: [ ... ] }, { utility: [ ... ] } ] } }, ... };
  // The engine compiles the tree ONCE for the family into flat tables of nodes. An instance has no objects: its state is a few columns (the leaf that runs, when the leaf began, how long it may take, when the instance next thinks),
  // because the progress of a sequence or a selector is IMPLIED by the leaf that runs (its ancestors say which of their children it is). A tick allocates nothing.
  // THE RATE: an instance is visited when its `wake` time comes, not every frame: `hz` times a second for a near instance, `far_hz` for a far one, staggered (a family of 500 does not think on one frame), and a leaf that waits
  // longer sleeps until it is done (or until the action it plays ends: the host pokes the instance). A guard that can interrupt the running leaf keeps the instance awake at the rate. Nothing here calls into C++: the body is moved by the
  // wish the leaves write (me.go, me.stop), which the mover applies every frame; what the tree needs to know of the world comes from functions the family writes (the `sense` hook, the conditions).
  //
  // THE TREE is nested plain objects; a node has ONE kind key, and any of the common keys:
  //   { select: [node, ...] }                    the first child that does not fail (a priority list). While a child runs, the children BEFORE it that have a `when` are looked at again at every visit: one whose `when` holds takes over
  //   { seq: [node, ...] }                       the children one after the other; it fails when one fails
  //   { utility: [{ score: fn(me) -> number, do: node }, ...] }     the child with the highest score, once, when the node is entered (a child that fails is skipped for the next best); it keeps running until it is done
  //   { random: [{ w: number, do: node }, ...] }                    a child by chance, in proportion to w (the same: a child that fails is skipped)
  //   { act: handle | fn(me) -> handle, until: fn(me) -> bool, time: seconds | [min, max], keep: bool, chain: bool }        plays an action; done when it ends, when `until` holds or when the time is up (it is stopped and fades out first,
//                                              unless `keep`: it is left playing, for the next act leaf to replace; `power`, `speed`: number | fn(me) -> number, `mirror`: bool | fn(me) -> bool (me.act_opts right after me.act: how strong, how fast, which side); `aim`: fn(me, p) -> bool, writes the point it aims at into p.x, p.y, p.z (me.act_target); `chain`: it CONTINUES the action that plays (starts at full weight, no fade in): a lying-down clip, an asleep clip
//                                              and a getting-up clip are three leaves, the first two with `keep`, the last two with `chain`)
  //   { go: fn(me, p), pace: fn(me, d, p), speed: m/s, style: handle, near: metres, time: seconds | [min, max], follow: bool }
  //                                              walks to the place `go` writes into p (p.x, p.z; return false for "no place" = fail) at `speed` in the gait `style` (-1: leave the gait: but a gait that an earlier styled go put on is given back, the creature's own, by the first go that names none); `pace` may set p.style and p.speed from
  //                                              the distance d; done within `near` (0.5), fails after `time` (30); `follow`: the place is asked again at every visit (something that moves)
  //   { wait: seconds | [min, max] }             stands still
  //   { call: fn(me, elapsed) -> OK | RUNNING | FAIL }       anything else (undefined: OK); while it returns RUNNING it is visited again
  // common keys: when: fn(me) -> bool (the node fails when it does not hold, when it is entered), watch: true (and while it runs: it is aborted, and fails, when `when` stops holding), enter: fn(me), leave: fn(me) (it ran: finished or aborted),
  // cooldown: seconds (the node fails when entered again too soon after it was left, for this instance), name: any text (for errors).
  // The whole tree finishing starts it again at the next visit.
  //
  //   const R = create(ai, max)       compiles (every mistake is thrown, naming the node's path)      R.OK, R.RUNNING, R.FAIL
  //   R.spawn(me, now)  R.release(me, now)  R.restart(me, now)  R.poke(slot)  R.run(me, now)      (`sense(me, now)` of the ai object is called at the start of every visit)     R.wake (Float64Array: when each instance is next visited)     R.leaf(slot) -> the id of the leaf that runs | -1 (tests)
  // Written in ES5 on purpose (the family's own functions are): no class, no arrow.
  var OK = 0, RUNNING = 1, FAIL = 2;
  var SELECT = 1, SEQ = 2, UTILITY = 3, RANDOM = 4, ACT = 5, GO = 6, WAIT = 7, CALL = 8;
  var KIND_KEYS = ["select", "seq", "utility", "random", "act", "go", "wait", "call"];
  var KIND_OF = { select: SELECT, seq: SEQ, utility: UTILITY, random: RANDOM, act: ACT, go: GO, wait: WAIT, call: CALL };
  var COMMON = { when: 1, watch: 1, enter: 1, leave: 1, cooldown: 1, name: 1 };
  var EXTRA = { act: { until: 1, time: 1, keep: 1, chain: 1, power: 1, speed: 1, mirror: 1, aim: 1 }, go: { pace: 1, speed: 1, style: 1, near: 1, time: 1, follow: 1 }, select: {}, seq: {}, utility: {}, random: {}, wait: {}, call: {} };
  var MAX_KIDS = 31;                                                                                    // (the children that were tried are a bit mask)

  function fail(path, text) { throw new Error("happy_worker_bt: " + path + ": " + text); }
  function is_fn(x) { return typeof x === "function"; }
  function range_of(path, v, what, dflt) {                                                              // seconds or [min, max] -> [min, max]
    if (v === undefined) return dflt;
    if (typeof v === "number" && v >= 0) return [v, v];
    if (Array.isArray(v) && v.length === 2 && v[0] >= 0 && v[1] >= v[0]) return [v[0], v[1]];
    return fail(path, what + " is seconds or [min, max]");
  }

  function create(ai, max) {
    if (!ai || typeof ai !== "object") fail("ai", "an object { hz, far_hz, sense, tree }");
    var hz = ai.hz === undefined ? 6 : ai.hz, far_hz = ai.far_hz === undefined ? Math.min(1, hz) : ai.far_hz;
    if (!(hz > 0 && hz <= 60) || !(far_hz > 0 && far_hz <= hz)) fail("ai", "hz is 0 .. 60 and far_hz is above 0 and not above hz");
    for (var key in ai) if (key !== "hz" && key !== "far_hz" && key !== "sense" && key !== "steer" && key !== "tree") fail("ai", "'" + key + "' is not a key of ai (hz, far_hz, sense, steer, tree)");
    if (ai.sense !== undefined && !is_fn(ai.sense)) fail("ai.sense", "a function(me, now)");
    if (ai.steer !== undefined && !is_fn(ai.steer)) fail("ai.steer", "a function(me, w)");
    var steer = ai.steer === undefined ? null : ai.steer;
    var period_near = 1 / hz, period_far = 1 / far_hz;
    var N = [], cd_count = 0;

    // ---- compile: a node of plain objects -> an entry of the flat table (ids in the order the tree is read; the root is 0)
    function compile(def, parent, idx, path) {
      if (!def || typeof def !== "object" || Array.isArray(def)) fail(path, "a node is an object with one of the keys " + KIND_KEYS.join(", "));
      var kind = null, k;
      for (k in def) {
        if (KIND_OF[k] !== undefined) { if (kind !== null) fail(path, "a node has ONE kind: '" + kind + "' and '" + k + "'"); kind = k; }
      }
      if (kind === null) fail(path, "a node has one of the keys " + KIND_KEYS.join(", "));
      for (k in def) if (KIND_OF[k] === undefined && COMMON[k] === undefined && EXTRA[kind][k] === undefined) fail(path, "'" + k + "' is not a key of a " + kind + " node");
      var n = { id: N.length, kind: KIND_OF[kind], parent: parent, idx: idx, kids: [], guards: [], when: null, watch: false, enter: null, leave: null, cd: -1, cooldown: 0, exit: false, score: null, w: 1, name: def.name === undefined ? kind : String(def.name),
        act: null, until: null, keep: false, chain: false, power: null, speed_k: null, mirror: null, aim: null, time: null, to: null, pace: null, speed: 1, style: -1, near: 0.5, follow: false, wait: null, call: null, sc: null };
      N.push(n);
      var here = path + "." + kind;
      if (def.when !== undefined) { if (!is_fn(def.when)) fail(here, "when is a function(me) -> bool"); n.when = def.when; }
      if (def.watch !== undefined) { if (def.watch !== true) fail(here, "watch is true"); if (n.when === null) fail(here, "watch needs a `when`"); n.watch = true; }
      if (def.enter !== undefined) { if (!is_fn(def.enter)) fail(here, "enter is a function(me)"); n.enter = def.enter; }
      if (def.leave !== undefined) { if (!is_fn(def.leave)) fail(here, "leave is a function(me)"); n.leave = def.leave; }
      if (def.cooldown !== undefined) { if (!(def.cooldown > 0)) fail(here, "cooldown is seconds above 0"); n.cooldown = def.cooldown; n.cd = cd_count++; }
      n.exit = n.leave !== null || n.cd >= 0;
      var list = def[kind], i, e, c;
      if (n.kind === SELECT || n.kind === SEQ) {
        if (!Array.isArray(list) || list.length === 0) fail(here, "a non-empty list of nodes");
        for (i = 0; i < list.length; i++) n.kids.push(compile(list[i], n.id, i, here + "[" + i + "]"));
      } else if (n.kind === UTILITY || n.kind === RANDOM) {
        if (!Array.isArray(list) || list.length === 0 || list.length > MAX_KIDS) fail(here, "a list of 1 .. " + MAX_KIDS + " entries { " + (n.kind === UTILITY ? "score" : "w") + ", do }");
        for (i = 0; i < list.length; i++) {
          e = list[i];
          if (!e || typeof e !== "object") fail(here + "[" + i + "]", "an entry { " + (n.kind === UTILITY ? "score: fn(me) -> number" : "w: number") + ", do: node }");
          for (k in e) if (k !== "score" && k !== "w" && k !== "do") fail(here + "[" + i + "]", "'" + k + "' is not a key of an entry (score, w, do)");
          c = compile(e.do, n.id, i, here + "[" + i + "].do");
          if (n.kind === UTILITY) { if (!is_fn(e.score)) fail(here + "[" + i + "]", "score is a function(me) -> number"); N[c].score = e.score; }
          else { if (!(e.w > 0)) fail(here + "[" + i + "]", "w is a number above 0"); N[c].w = e.w; }
          n.kids.push(c);
        }
        if (n.kind === UTILITY) n.sc = new Float64Array(n.kids.length);
      } else if (n.kind === ACT) {
        if (!(is_fn(def.act) || typeof def.act === "number")) fail(here, "act is an action handle (a number, from api.action; -1 when the library is not there: the leaf fails) or a function(me) -> handle");
        n.act = def.act;
        if (def.until !== undefined) { if (!is_fn(def.until)) fail(here, "until is a function(me) -> bool"); n.until = def.until; }
        n.time = range_of(here, def.time, "time", null);
        if (def.keep !== undefined) { if (typeof def.keep !== "boolean") fail(here, "keep is true or false"); n.keep = def.keep; }
        if (def.chain !== undefined) { if (typeof def.chain !== "boolean") fail(here, "chain is true or false"); n.chain = def.chain; }
        if (def.power !== undefined) { if (!(is_fn(def.power) || def.power > 0)) fail(here, "power is a number above 0 or a function(me) -> number"); n.power = def.power; }
        if (def.speed !== undefined) { if (!(is_fn(def.speed) || def.speed > 0)) fail(here, "speed is a number above 0 or a function(me) -> number"); n.speed_k = def.speed; }
        if (def.mirror !== undefined) { if (!(is_fn(def.mirror) || typeof def.mirror === "boolean")) fail(here, "mirror is true, false or a function(me) -> bool"); n.mirror = def.mirror; }
        if (def.aim !== undefined) { if (!is_fn(def.aim)) fail(here, "aim is a function(me, p) that writes the point it aims at into p.x, p.y, p.z and returns true (false: no aim)"); n.aim = def.aim; }
      } else if (n.kind === GO) {
        if (!is_fn(def.go)) fail(here, "go is a function(me, p) that writes the place into p.x and p.z");
        n.to = def.go;
        if (def.pace !== undefined) { if (!is_fn(def.pace)) fail(here, "pace is a function(me, d, p)"); n.pace = def.pace; }
        if (def.speed !== undefined) { if (!(def.speed > 0)) fail(here, "speed is metres a second above 0"); n.speed = def.speed; }
        if (def.style !== undefined) { if (typeof def.style !== "number") fail(here, "style is a gait style handle (a number, from api.style)"); n.style = def.style; }
        if (def.near !== undefined) { if (!(def.near > 0)) fail(here, "near is metres above 0"); n.near = def.near; }
        n.time = range_of(here, def.time, "time", [30, 30]);
        n.follow = def.follow === true;
      } else if (n.kind === WAIT) {
        n.wait = range_of(here, def.wait, "wait", null);
        if (n.wait === null) fail(here, "wait is seconds or [min, max]");
      } else {
        if (!is_fn(def.call)) fail(here, "call is a function(me, elapsed)");
        n.call = def.call;
      }
      return n.id;
    }
    var root = ai.tree;
    if (root === undefined || root && typeof root === "object" && !Array.isArray(root) && !Object.keys(root).length) root = { wait: 1, name: "empty" };   // (no tree, or a blank `{ }`: the empty one, a creature that idles, so that blocks / hooks can still run)
    compile(root, -1, 0, "ai.tree");
    var i, j;
    for (i = 0; i < N.length; i++) {                                                                    // (for each child of a select: the children before it that have a `when`)
      if (N[i].kind === SELECT) for (j = 0; j < N[i].kids.length; j++) { var kid = N[N[i].kids[j]]; for (var g = 0; g < j; g++) if (N[N[i].kids[g]].when !== null) kid.guards.push(N[i].kids[g]); }
    }
    var watchers = [];                                                                                  // for each leaf: what is looked at again at every visit, from the root down: [a, b, ...] pairs: (a, -1) a node that is watched, (a, b) a select a whose child b runs and has guards before it
    for (i = 0; i < N.length; i++) {
      var w = [];
      if (N[i].kind >= ACT) {
        for (var at = i; at >= 0; at = N[at].parent) {
          if (N[at].watch) w.push(at, -1);
          if (N[at].parent >= 0 && N[N[at].parent].kind === SELECT && N[at].guards.length > 0) w.push(N[at].parent, at);
        }
        w.reverse();                                                                                    // (the pairs were pushed leaf first: reversed they are (b, a) -- put each pair back in order)
        for (j = 0; j + 1 < w.length; j += 2) { var t = w[j]; w[j] = w[j + 1]; w[j + 1] = t; }
      }
      watchers.push(w);
    }

    // ---- the state of the instances: columns
    var cur = new Int16Array(max).fill(-1), t0 = new Float64Array(max), aux = new Float64Array(max), flag = new Uint8Array(max), wake = new Float64Array(max);
    var tx = new Float32Array(max), tz = new Float32Array(max), style_of = new Int32Array(max).fill(-1), ready = new Float64Array(Math.max(1, cd_count) * max);
    var P = { x: 0, z: 0, style: -1, speed: 1 }, Q = { x: 0, y: 0, z: 0 }, W = { dx: 0, dz: 1, d: 0, speed: 1, style: -1 };                                                        // (what `go` and `pace` write)
    var s = 0, now = 0, forced = -1;                                                                    // (the instance and the time of the visit that runs: the helpers below use them; forced: the node R.force enters)
    var held = new Uint8Array(max), only = new Int16Array(max).fill(-1);                                // (R.hold: an instance that is held decides nothing by itself; only: the node that R.force ran in it, the tree stops there)

    function left(n, me) {                                                                              // a node that ran is done (or aborted)
      var nd = N[n];
      if (nd.leave !== null) nd.leave(me);
      if (nd.cd >= 0) ready[nd.cd * max + s] = now + nd.cooldown;
    }
    function dur(r, me) { return r === null ? 1e9 : r[0] + (r[1] - r[0]) * (r[1] > r[0] ? me.rand() : 0); }

    // enter a node: RUNNING (a leaf runs now: cur is set), or OK / FAIL (it was done at once)
    function enter(id, me) {
      var n = N[id], r;
      if (id !== forced) {                                                                              // (the node that the page asked for runs whatever its guards say: R.force)
        if (n.when !== null && !n.when(me)) return FAIL;
        if (n.cd >= 0 && now < ready[n.cd * max + s]) return FAIL;
      }
      if (n.enter !== null) n.enter(me);
      switch (n.kind) {
        case SELECT: case SEQ: case UTILITY: case RANDOM: return advance(id, -1, OK, me);
        case ACT: {
          var h = typeof n.act === "number" ? n.act : n.act(me);
          if (!(h >= 0)) { if (n.exit) left(id, me); return FAIL; }
          me.act(h, n.chain);
          if (n.power !== null || n.speed_k !== null || n.mirror !== null) me.act_opts(n.power === null ? 1 : (typeof n.power === "number" ? n.power : n.power(me)), n.speed_k === null ? 1 : (typeof n.speed_k === "number" ? n.speed_k : n.speed_k(me)), n.mirror === null ? false : (typeof n.mirror === "boolean" ? n.mirror : n.mirror(me) === true));
          if (n.aim !== null) { Q.x = 0; Q.y = 0; Q.z = 0; if (n.aim(me, Q) === true) me.act_target(Q.x, Q.y, Q.z); }
          t0[s] = now; aux[s] = dur(n.time, me); flag[s] = 0; cur[s] = id; return RUNNING;
        }
        case GO: {
          P.x = 0; P.z = 0;
          if (n.to(me, P) === false) { if (n.exit) left(id, me); return FAIL; }
          tx[s] = P.x; tz[s] = P.z; t0[s] = now; aux[s] = dur(n.time, me); cur[s] = id;
          r = update(id, me);                                                                           // (it starts walking now, not at the next visit; it may be there already)
          if (r !== RUNNING) { cur[s] = -1; if (n.exit) left(id, me); return r; }
          return RUNNING;
        }
        case WAIT: me.stop(); t0[s] = now; aux[s] = dur(n.wait, me); cur[s] = id; return RUNNING;
        default: {
          t0[s] = now;
          r = n.call(me, 0);
          if (r === RUNNING) { cur[s] = id; return RUNNING; }
          if (n.exit) left(id, me);
          return r === FAIL ? FAIL : OK;
        }
      }
    }

    // a composite: child i of it finished with st (i = -1: it was just entered). Goes on to the next child; RUNNING (a leaf runs), or OK / FAIL (the node is done, and left)
    function advance(id, i, st, me) {
      var n = N[id], kids = n.kids, j, r, k, tried, best, bs, total, x;
      if (n.kind === SEQ) {
        if (i >= 0 && st === FAIL) { if (n.exit) left(id, me); return FAIL; }
        for (j = i + 1; j < kids.length; j++) { r = enter(kids[j], me); if (r === RUNNING) return RUNNING; if (r === FAIL) { if (n.exit) left(id, me); return FAIL; } }
        if (n.exit) left(id, me);
        return OK;
      }
      if (n.kind === SELECT) {
        if (i >= 0 && st === OK) { if (n.exit) left(id, me); return OK; }
        for (j = i + 1; j < kids.length; j++) { r = enter(kids[j], me); if (r === RUNNING) return RUNNING; if (r === OK) { if (n.exit) left(id, me); return OK; } }
        if (n.exit) left(id, me);
        return FAIL;
      }
      if (i >= 0) { if (n.exit) left(id, me); return st; }                                              // (utility, random: the chosen child is done: so is the node)
      tried = 0;
      if (n.kind === UTILITY) for (k = 0; k < kids.length; k++) n.sc[k] = N[kids[k]].score(me);
      for (;;) {
        best = -1;
        if (n.kind === UTILITY) {
          bs = -Infinity;
          for (k = 0; k < kids.length; k++) if ((tried & (1 << k)) === 0 && n.sc[k] > bs) { bs = n.sc[k]; best = k; }
        } else {
          total = 0;
          for (k = 0; k < kids.length; k++) if ((tried & (1 << k)) === 0) total += N[kids[k]].w;
          if (total > 0) { x = me.rand() * total; for (k = 0; k < kids.length; k++) if ((tried & (1 << k)) === 0) { best = k; x -= N[kids[k]].w; if (x < 0) break; } }
        }
        if (best < 0) { if (n.exit) left(id, me); return FAIL; }
        tried |= 1 << best;
        r = enter(kids[best], me);
        if (r === RUNNING) return RUNNING;
        if (r === OK) { if (n.exit) left(id, me); return OK; }
      }
    }

    // `n` is done with st (its own `left` is called): tell the parents until something runs again or the whole tree is done
    function propagate(n, st, me, stop) {                                                               // (stop: a node that is the end of it: what is above it is not told)
      for (;;) {
        var p = N[n].parent, r;
        if (n === stop || p < 0) return;
        r = advance(p, N[n].idx, st, me);
        if (r === RUNNING) return;
        n = p; st = r;
      }
    }
    // the running leaf is done (or the instance was preempted): the nodes from the leaf up to `top` (exclusive, or inclusive) are left
    function abort_to(leaf, top, inclusive, me) {
      var n = leaf;
      cur[s] = -1;
      if (N[leaf].kind === ACT) me.act_end();
      while (n >= 0 && n !== top) { left(n, me); n = N[n].parent; }
      if (inclusive && n === top) left(n, me);
    }

    // what is looked at again while the leaf runs: true when the leaf was taken off (and what comes next has been entered)
    function preempted(leaf, me) {
      var w = watchers[leaf], k, a, b, g, gs, r;
      for (k = 0; k < w.length; k += 2) {
        a = w[k]; b = w[k + 1];
        if (b < 0) {
          if (!N[a].when(me)) { abort_to(leaf, a, true, me); propagate(a, FAIL, me); return true; }
        } else {
          gs = N[b].guards;
          for (g = 0; g < gs.length; g++) {
            if (!N[gs[g]].when(me) || (N[gs[g]].cd >= 0 && now < ready[N[gs[g]].cd * max + s])) continue;
            abort_to(leaf, a, false, me);
            r = advance(a, N[gs[g]].idx - 1, FAIL, me);
            if (r !== RUNNING) propagate(a, r, me);
            return true;
          }
        }
      }
      return false;
    }

    function update(id, me) {                                                                           // the running leaf, once more: RUNNING | OK | FAIL
      var n = N[id], dx, dz, d, sp, st, r, ux, uz;
      switch (n.kind) {
        case ACT:
          if (flag[s] === 1) return me.acting() < 0 ? OK : RUNNING;                                     // (stopped: it fades out)
          if (me.acting() < 0) return OK;
          if (now - t0[s] >= aux[s] || (n.until !== null && n.until(me))) { if (n.keep) return OK; me.act_stop(); flag[s] = 1; }                  // (kept: the next act leaf replaces it)
          return RUNNING;
        case GO:
          if (n.follow) { n.to(me, P); tx[s] = P.x; tz[s] = P.z; }
          dx = tx[s] - me.x; dz = tz[s] - me.z; d = Math.sqrt(dx * dx + dz * dz);
          if (d <= n.near) { me.stop(); return OK; }
          if (now - t0[s] >= aux[s]) { me.stop(); return FAIL; }
          sp = n.speed; st = n.style;
          if (n.pace !== null) { P.style = st; P.speed = sp; n.pace(me, d, P); sp = P.speed; st = P.style; }
          ux = dx / d; uz = dz / d;
          if (steer !== null) {                                                                         // (the blocks' steer hooks: the way, the speed and the gait this wish makes, said once more, and they may bend it: avoid a wall, jump a log, walk or run)
            W.dx = ux; W.dz = uz; W.d = d; W.speed = sp; W.style = st;
            steer(me, W);
            ux = W.dx; uz = W.dz; sp = W.speed; st = W.style;
            if (!(sp >= 0)) sp = 0;
          }
          if (st >= 0) { if (style_of[s] !== st) { style_of[s] = st; me.style(st, 0.6); } }
          else if (style_of[s] >= 0) { style_of[s] = -1; if (typeof me.style_own === "function") me.style_own(0.6); }   // (the gait of a styled go lasts while the gos that name one do: a go that names none gives the creature's own back; a gait that something else put on (a block's) is not touched)
          me.go(ux * sp, uz * sp);
          return RUNNING;
        case WAIT: return now - t0[s] >= aux[s] ? OK : RUNNING;
        default: r = n.call(me, now - t0[s]); return r === undefined ? OK : r;
      }
    }

    // when the instance is visited next: at the rate; later when the leaf only has to wait, and nothing can interrupt it
    function schedule(me) {
      var period = me.near === 0 ? period_far : period_near, leaf = cur[s], n, rem = period;
      if (leaf >= 0) {
        n = N[leaf];
        if (n.kind === WAIT) rem = aux[s] - (now - t0[s]);
        else if (n.kind === ACT) rem = flag[s] === 1 ? 0.1 : (n.until !== null ? period : (n.time !== null ? aux[s] - (now - t0[s]) : 2));
        if (watchers[leaf].length > 0 && rem > period) rem = period;
        else if (rem > 5) rem = 5;
      }
      if (rem < 0.02) rem = 0.02;
      wake[s] = now + rem;
    }

    var R = { OK: OK, RUNNING: RUNNING, FAIL: FAIL, wake: wake, nodes: N.length };
    R.leaf = function (slot) { return cur[slot]; };
    R.style = function (slot) { return style_of[slot]; };                                               // (the gait style that a `go` leaf put on the instance last: the handle `pace` or `style` gave, -1 none)
    var forget_cooldowns = function (slot) { var c; for (c = 0; c < cd_count; c++) ready[c * max + slot] = 0; };      // (a slot that is used again is a new creature: it does not inherit the cooldowns of the one that was there)
    R.spawn = function (me, t) { s = me.slot; now = t; cur[s] = -1; flag[s] = 0; style_of[s] = -1; held[s] = 0; only[s] = -1; forget_cooldowns(s); wake[s] = t + me.rand() * period_near; };
    R.release = function (me, t) {
      s = me.slot; now = t;
      if (cur[s] >= 0) abort_to(cur[s], -1, false, me);
      cur[s] = -1; held[s] = 0; only[s] = -1; forget_cooldowns(s); wake[s] = Infinity;
    };
    // HOLD (the AI editor's preview, its Pause): on, what the instance does is taken off, it stands, and the tree decides nothing for it, so that a node can be run by itself (R.force: it runs, with nothing of the tree around it, and when it is done
    // the instance stands again). Off, it is let go: what a node that was forced is doing goes on, and the tree goes on from there
    R.hold = function (me, t, on) {
      s = me.slot; now = t;
      if (on) {
        if (cur[s] >= 0) abort_to(cur[s], -1, false, me);
        cur[s] = -1; flag[s] = 0; held[s] = 1; only[s] = -1; me.stop(); wake[s] = Infinity;
      } else if (held[s] !== 0) { held[s] = 0; only[s] = -1; wake[s] = 0; }
    };
    R.restart = function (me, t) {                                                                      // what it does is taken off, and it thinks again at the next visit
      var s0 = s, now0 = now;                                                                           // (it may be called from a hit hook, inside the visit of ANOTHER instance of the family: that visit's place is put back)
      s = me.slot; now = t;
      if (cur[s] >= 0) abort_to(cur[s], -1, false, me);
      cur[s] = -1; wake[s] = 0;
      s = s0; now = now0;
    };
    R.poke = function (slot) { if (held[slot] === 0 || cur[slot] >= 0) wake[slot] = 0; };                                                     // (an action ended: look at it soon)
    // the page asks to SEE a branch (the AI editor's preview): what runs is taken off, the `enter` of the node's ancestors is called (as if the tree had come down to it) and the node is entered whatever its `when` and its
    // cooldown say; when it is done the tree goes on from there (the next child of a sequence, or the end of the tree and a new start). false: there is no such node
    R.force = function (me, t, id) {
      var up = [], n, k, r;
      if (!(id >= 0 && id < N.length)) return false;
      s = me.slot; now = t;
      if (cur[s] >= 0) abort_to(cur[s], -1, false, me);
      cur[s] = -1; flag[s] = 0;
      for (n = N[id].parent; n >= 0; n = N[n].parent) up.push(n);
      for (k = up.length - 1; k >= 0; k--) if (N[up[k]].enter !== null) N[up[k]].enter(me);
      forced = id;
      if (held[s] !== 0) only[s] = id;
      try { r = enter(id, me); } finally { forced = -1; }
      if (r !== RUNNING && held[s] === 0) propagate(id, r, me);                                         // (held: the node was the whole of it, the instance stands again at its next visit)
      schedule(me);
      return true;
    };
    // the shape of the compiled tree, for a tool that draws it: the parent of every node (the root's is -1), its place among its parent's children and its kind (1 select, 2 seq, 3 utility, 4 random, 5 act, 6 go, 7 wait, 8 call); the ids are the order of
    // the nodes of the tree read from the root down, a node before its children (the leaf that R.leaf says is one of them)
    R.shape = function () {
      var parent = [], idx = [], kind = [], i;
      for (i = 0; i < N.length; i++) { parent.push(N[i].parent); idx.push(N[i].idx); kind.push(N[i].kind); }
      return { parent: parent, idx: idx, kind: kind };
    };
    R.run = function (me, t) {
      var r, leaf;
      s = me.slot; now = t;
      if (ai.sense !== undefined) ai.sense(me, t);
      leaf = cur[s];
      if (leaf >= 0 && (held[s] !== 0 || !preempted(leaf, me))) {                                       // (held: the node that was asked for is not taken off by the guards of the tree)
        leaf = cur[s];
        r = update(leaf, me);
        if (r !== RUNNING) { cur[s] = -1; left(leaf, me); propagate(leaf, r, me, held[s] !== 0 ? only[s] : -2); }
      }
      if (cur[s] < 0) {
        if (held[s] !== 0) { only[s] = -1; wake[s] = Infinity; return; }                                 // (held, and nothing it was asked to run is running: it stands)
        enter(0, me);                                                                                   // (the tree is done: again, once a visit)
      }
      schedule(me);
    };
    return R;
  }

  return { create: create, OK: OK, RUNNING: RUNNING, FAIL: FAIL };
});

// ========================================================================================================================
// worker_columns
// ========================================================================================================================
packing()("happy_worker_columns", function happy_worker_columns() {
  "use strict";
  // HAPPY WORKER COLUMNS: the worker's JS side reads and writes the columns of a family straight in the wasm memory (SYSTEM.md, "The worker's logic"; the directory is world.cpp). A call into the wasm for every instance and every
  // frame costs more than the work it asks for, so the logic of the creatures (their actions, their AI) takes typed arrays over the memory and does its loops in JS; the wasm is called for what needs the wasm (a family that is built, a
  // ray, a spawn). What it has to know is where the columns are, and when that has changed:
  //
  //   const cols = create({ columns: wa.happy_columns, serials: wa.happy_serials, buffer: function () { return env.memory.buffer; } })      the host: the two exports of the worker and the memory's buffer (it is another one when the memory has grown)
  //   const fam = cols.family(js_id)      one object for a family, made ONCE: fam.js, fam.serial, fam.max (instances), fam.live, and a typed array for every column, by its name (below), over the whole column: fam.ROOT is the roots of
  //                                       all the instances, 8 numbers each, fam.ROOT[slot * fam.ROOT_N + k]; a column that the family does not have is null (fam.OVR is null for legs that refuse a script)
  //   cols.refresh(fam) -> true when the views were taken again      once a frame for every family that is worked on: it reads one word (the family's serial in the worker's table) and compares the buffer: nothing is allocated, nothing is
  //                                       called in the wasm unless the family was built again (its columns are another's), destroyed or the memory has grown; then the views are made again IN THE SAME OBJECT (its shape never changes)
  //   fam.NOV, fam.NARMS, fam.NLEGS, fam.ARM_NS, fam.FACE_NS, fam.LOOK_OK, fam.JUMP_OK, fam.FLY_OK, fam.CLIMB_OK      what the family says of itself (the overlay bones, the arms, the legs, the floats of an arm's and of a face's state, 1: it can look, 1: it can jump, 1: it
  //                                       takes off and lands (a flight section or an aircraft, and a gravity), 1: a climb is wished of it (a flight section or an aircraft), FLY_MODEL: what it flies as: 1 a wing, 2 a hover, 3 an aircraft, 0 nothing)
  //   cols.constants() -> { ERR_ARGS ..., F_AIR ..., AS_PWS ..., FS_GZ_MODE ... }      the numbers the commands write with, as the C++ has them
  //   cols.NAMES, cols.COL (name -> id), cols.COUNT      the columns, in the order of HAPPY_COLUMNS in world.cpp (the two lists have to agree)
  //
  // THE COLUMNS (kind: u8 a byte, u16 two, f32 a float, u32 a word; the `_N` of a column is its elements in a row):
  //   core, a row an instance: ALIVE u8, TIER u8, TIER_SET u8, DIV u8, DUE u8 (1: the row is updated this frame), FLAGS u8, GEN u16, ACC f32 (seconds since the row's last update), ROOT f32 x8 (position xyz, scale, rotation xyzw), LEAN f32 x4, IMPACT f32
  //   the body: VEL f32 x2, INTENT f32 x4 (the wished velocity x z, the wished facing x z), LAST f32 x3, WERR f32, VY f32, CTL f32 x8, CLIMB f32 (the climb wished), FLYWISH u8 (the worker's wish to take off 1 / land 2: the body does it at the top of its frame and clears it), MANUAL u8, DRIVE f32 x3 (on, vx, vz), LANDED f32
  //   the legs: GAIT_A u8, GAIT_B u8, GAIT_T f32 (the mix of two gaits), CYCLE f32, TREAD f32 x2, and for a family built with a script (a row a leg, a row of OVR is x y z a leg): OVR_COV, OVR_W, OVR, OVR_FRAME u32, OVR_ON u8, KN_COV, KN_W, KN, KN_FRAME u32
  //   the gaits' TABLES, a row a gait: GAIT_COUNT u32 (one), GAIT_NUM f32, GAIT_PATH f32, GAIT_NPATH u32, FEET_MASK u32, FEET f32, UP_MASK u32, UP_REF f32, UP f32
  //   the life and the face: FRAME_NO u32 (one: the number of the frame, which the script's commands write with what they say), LIFE_OFF u8, LIFE_POKE f32 (a row an instance: 6 numbers an overlay bone: yaw, pitch, roll, tx, ty, tz), ARM_ST f32 (the arms' states: ARM_NS
  //   floats an arm), FACE_ST f32 (FACE_NS floats an instance), and a row an overlay bone of the SPECIES: LIFE_ROLE u32 (its role bits), LIFE_MOVABLE u8
  //   the rig's chains (a row an instance; NCHAINS chains, NUNITS units): RIG_TGT f32 x3 a chain, RIG_ORN x4, RIG_WGT, RIG_POLE x3, RIG_POLEW, RIG_CFL u8 (HAPPY_RC_* a chain), RIG_UCHG u8 (a unit), RIG_CDIRTY u8; RIG_CUNIT u32: a row a chain, its unit
  //   the order of the steps: LEG_PHASE f32 (one row of the legs' phases: the family's), GAIT_PH f32 (a row a gait: its own phases), GAIT_PH_ON u32 (a row a gait: 1 when it has them), PH_ANY u32 (one: some gait has); HAS_UPPER, HAS_FEET u32 (one each: the family's flags)
  //   the wings' hand: WING_MANUAL u8, WING_FOLD, WING_HZ, WING_AMP f32; the face's expressions (the C++'s read only tables): FACE_PRESETS f32 (10 rows of FC_COUNT goals), FACE_HOLD f32 (10 rows: the seconds an expression holds)
  // Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no class.
  const LIST = [
    ["ALIVE", "u8"], ["TIER", "u8"], ["TIER_SET", "u8"], ["DIV", "u8"], ["DUE", "u8"], ["FLAGS", "u8"], ["GEN", "u16"], ["ACC", "f32"], ["ROOT", "f32"], ["LEAN", "f32"], ["IMPACT", "f32"],
    ["VEH_STATE", "u8"],
    ["VEL", "f32"], ["INTENT", "f32"], ["LAST", "f32"], ["WERR", "f32"], ["VY", "f32"], ["CTL", "f32"], ["CLIMB", "f32"], ["FLYWISH", "u8"], ["MANUAL", "u8"], ["DRIVE", "f32"], ["LANDED", "f32"],
    ["GAIT_A", "u8"], ["GAIT_B", "u8"], ["GAIT_T", "f32"], ["CYCLE", "f32"], ["TREAD", "f32"],
    ["OVR_COV", "f32"], ["OVR_W", "f32"], ["OVR", "f32"], ["OVR_FRAME", "u32"], ["OVR_ON", "u8"], ["KN_COV", "f32"], ["KN_W", "f32"], ["KN", "f32"], ["KN_FRAME", "u32"],
    ["GAIT_COUNT", "u32"], ["GAIT_NUM", "f32"], ["GAIT_PATH", "f32"], ["GAIT_NPATH", "u32"], ["FEET_MASK", "u32"], ["FEET", "f32"], ["UP_MASK", "u32"], ["UP_REF", "f32"], ["UP", "f32"],
    ["FRAME_NO", "u32"], ["LIFE_OFF", "u8"], ["LIFE_POKE", "f32"], ["ARM_ST", "f32"], ["FACE_ST", "f32"], ["LIFE_ROLE", "u32"], ["LIFE_MOVABLE", "u8"],
    ["RIG_TGT", "f32"], ["RIG_ORN", "f32"], ["RIG_WGT", "f32"], ["RIG_POLE", "f32"], ["RIG_POLEW", "f32"], ["RIG_CFL", "u8"], ["RIG_UCHG", "u8"], ["RIG_CDIRTY", "u8"], ["RIG_CUNIT", "u32"],
    ["WING_MANUAL", "u8"], ["WING_FOLD", "f32"], ["WING_HZ", "f32"], ["WING_AMP", "f32"], ["FACE_PRESETS", "f32"], ["FACE_HOLD", "f32"],
    ["LEG_PHASE", "f32"], ["GAIT_PH", "f32"], ["GAIT_PH_ON", "u32"], ["PH_ANY", "u32"], ["HAS_UPPER", "u32"], ["HAS_FEET", "u32"], ["DEFAULT_PATH", "f32"], ["SK_ROWS", "f32"], ["FRAME_DT", "f32"], ["SIM_TIME", "f32"]
  ];
  // what a family says of itself (HAPPY_NUMS: one word each after the columns of the directory), and the constants the commands use (HAPPY_CONSTS, happy_constants(): the C++'s own values)
  const NUMS = ["NOV", "NARMS", "NLEGS", "ARM_NS", "FACE_NS", "LOOK_OK", "JUMP_OK", "NCHAINS", "NUNITS", "NBONES", "FLY_OK", "CLIMB_OK", "FLY_MODEL"];
  const CONSTS = ["ERR_ARGS", "ERR_NO_FAMILY", "ERR_SLOT", "ERR_STALE", "ERR_BODY", "ERR_LEGS", "ERR_LIFE", "ERR_CHAIN", "ERR_WINGS", "ERR_FLIGHT",
    "F_ROOT", "F_AIR", "F_FRESH", "F_FLY", "R_UPPER", "R_FORE", "RC_LIVE", "RC_ORIENT",
    "AS_PWS", "AS_PFR", "AS_PUX", "AS_PUY", "AS_PUZ", "AS_PFL", "AS_PPA", "AS_PPW", "AS_WW", "AS_WWS", "AS_WFR", "AS_WX", "AS_WY", "AS_WZ", "AS_WFL", "AS_WPA", "AS_WPW", "AS_RUX", "AS_RUY", "AS_RUZ", "AS_LNP", "AS_LNY", "AS_LNR", "AS_RST", "AS_RGAP", "AS_RERR", "AS_RTM", "AS_WA", "AS_GU", "AS_GRF", "AS_CRH", "AS_GTM",
    "FS_GZ_MODE", "FS_GZ_UW", "FS_GZ_X", "FS_GZ_Y", "FS_GZ_Z", "FS_GZ_JS", "FS_GZ_SLOT", "FS_GZ_GEN", "FS_GZ_H", "FS_GZ_FLAGS",
    "FS_FC_T", "FS_FC_HOLD", "FS_FC_ON", "FS_ACT", "FC_COUNT", "FC_JAW", "FC_SPEAK", "FACT_ALL",
    "MAX_JS_IDS", "MAX_INSTANCES", "WORLD_MASK"];
  const COUNT = LIST.length, MAX_JS_IDS = 16384;                       // (HAPPY_MAX_JS_IDS: the length of the table of serials)
  const NAMES = LIST.map(function (x) { return x[0]; }), KIND = LIST.map(function (x) { return x[1]; });
  const COL = {};
  NAMES.forEach(function (n, i) { COL[n] = i; });
  const BYTES = { u8: 1, u16: 2, f32: 4, u32: 4 };
  const VIEW = { u8: Uint8Array, u16: Uint16Array, f32: Float32Array, u32: Uint32Array };

  // A family's object has every field from the start, in this order, as plain named fields (a constructor written out: an object that gets its fields by names that are computed leaves the fast shape after a dozen)
  const Family = new Function(["this.js = 0; this.serial = 0; this.max = 0; this.live = false; this.buf = null;"].concat(NUMS.map(function (n) { return "this." + n + " = 0;"; }), NAMES.map(function (n) { return "this." + n + " = null; this." + n + "_N = 0;"; })).join(" "));

  function create(host) {
    if (!host || typeof host.columns !== "function" || typeof host.serials !== "function" || typeof host.buffer !== "function") throw new Error("happy_worker_columns: create({ columns, serials, buffer }): the worker's exports happy_columns and happy_serials and a function that gives the memory's buffer");
    let buf = null, ser = null, ser_at = 0;
    const take = function () {                                                       // (the table of serials, over the memory as it is now)
      const b = host.buffer();
      if (b !== buf) { buf = b; if (!ser_at) ser_at = host.serials(); ser = new Uint32Array(buf, ser_at, MAX_JS_IDS); }
      return buf;
    };
    function clear(fam) {
      fam.live = false; fam.serial = 0; fam.max = 0; fam.buf = null;
      for (let k = 0; k < NUMS.length; k++) fam[NUMS[k]] = 0;
      for (let i = 0; i < COUNT; i++) { fam[NAMES[i]] = null; fam[NAMES[i] + "_N"] = 0; }
    }
    function load(fam, b) {
      const at = host.columns(fam.js);
      if (!at) { clear(fam); return true; }
      const d = new Uint32Array(b, at, 4 + COUNT * 4 + NUMS.length);
      if (d[2] !== COUNT || d[3] !== NUMS.length) throw new Error("happy_worker_columns: the worker has " + d[2] + " columns and " + d[3] + " numbers and this file " + COUNT + " and " + NUMS.length + " (world.cpp and columns.js are not of one version)");
      fam.serial = d[0]; fam.max = d[1]; fam.live = true; fam.buf = b;
      for (let i = 0; i < COUNT; i++) {
        const p = d[4 + i * 4], row = d[5 + i * 4], bytes = d[6 + i * 4], rows = d[7 + i * 4];
        if (!p) { fam[NAMES[i]] = null; fam[NAMES[i] + "_N"] = 0; continue; }
        if (bytes !== BYTES[KIND[i]]) throw new Error("happy_worker_columns: column " + NAMES[i] + " has " + bytes + " bytes an element in the worker and is " + KIND[i] + " here");
        fam[NAMES[i]] = new VIEW[KIND[i]](b, p, row * rows);
        fam[NAMES[i] + "_N"] = row;
      }
      for (let k = 0; k < NUMS.length; k++) fam[NUMS[k]] = d[4 + COUNT * 4 + k];
      return true;
    }
    let consts = null;
    return {
      NAMES: NAMES, COL: COL, COUNT: COUNT, NUMS: NUMS, CONSTS: CONSTS,
      // the constants of the commands, by name, as the C++ has them (read once)
      constants: function () {
        if (consts) return consts;
        if (typeof host.constants !== "function") throw new Error("happy_worker_columns: the host has no `constants` (the export happy_constants)");
        const at = host.constants(), n = new Uint32Array(take(), at, 1)[0];
        if (n !== CONSTS.length) throw new Error("happy_worker_columns: the worker has " + n + " constants and this file " + CONSTS.length + " (world.cpp and columns.js are not of one version)");
        const v = new Uint32Array(take(), at + 4, n);
        consts = {};
        for (let i = 0; i < n; i++) consts[CONSTS[i]] = v[i];
        return consts;
      },
      family: function (js_id) {
        if (!(js_id > 0 && js_id < MAX_JS_IDS)) throw new Error("happy_worker_columns: family(" + js_id + "): a js id is 1 .. " + (MAX_JS_IDS - 1));
        const fam = new Family();
        fam.js = js_id;
        clear(fam);
        load(fam, take());
        return fam;
      },
      refresh: function (fam) {
        const b = take();
        if (fam.buf === b && fam.serial !== 0 && ser[fam.js] === fam.serial) return false;
        if (!fam.live && ser[fam.js] === 0) return false;                       // (a family that is not there: nothing to take until it is built)
        return load(fam, b);
      }
    };
  }

  return { create: create, NAMES: NAMES, COL: COL, COUNT: COUNT, KIND: KIND, LIST: LIST, NUMS: NUMS, CONSTS: CONSTS };
});

// ========================================================================================================================
// worker_core
// ========================================================================================================================
packing()("happy_worker_core", function happy_worker_core() {
  // HAPPY WORKER CORE: the pure compile parts of system (kernel.js, skeleton.js, rig.js, gaits.js, legs.js, style_plan.js: the very files that system.js includes for the page) in a closure of their own, for the worker's JS side
  // (SYSTEM.md, "The worker's logic"). The creatures' logic that runs in the worker makes gait styles, and compiling one needs the same code as the page's: the legs are compiled from the species' skeleton and rig, the registry of
  // styles and the style's tables. This closure has them and nothing else (no queue, no species, no mesh, no engine): it is made once in the worker, the libraries are loaded into its registry (core.system.gaits.load / add),
  // and a species is given to it by the page as plain data (core.family): the compiled skeleton and rig (they are plain typed arrays and numbers: a structured clone carries them), the creature's legs, roles and traits, and what
  // the compiled legs say of themselves. What it answers is what the page's own code answers for the same species and style: the two are held together (every creature that has legs, the styles of the libraries,
  // the options of sp.set_style, the mistakes).
  //
  //   the module's value is the core: { system, family(data), plan(h, style, o) }      (the closure is made when the module is)
  //   core.system.gaits          the registry of the styles (gaits.js: add, load, decode, get, names, list)      core.system.compile_legs      kernel.js
  //   core.family({ name, sk, rig, input: { legs, roles, traits, system? }, ngaits, flags, declared, fingers }) -> h        (fingers: the table of pure.js, or none: h.fingers)      what style_plan wants of a species (kernel.js): `ngaits` is how many gaits the compiled legs have, `declared` how many of them the creature declared (the rest are spare slots), `flags` the legs' section flags
  //                            (legs.words[2]: feet, upper body, script): the page says them (sp.legs.gaits.length, sp.legs.words[2]), the worker does not compile a whole family to know them
  //   core.plan(h, style, o)   -> the plan of sp.set_style (style_plan.js): { n, name, fade, lg, legs2, with_feet, with_upper, todo, probe }, and h.style_legs is NOT changed (the caller keeps it when the plan is applied)
  // Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no class.
  const system = {};
  const MAGIC = 0x314d4f53, VERSION = 2, SEC_SKELETON = 2, SEC_RIG = 3;                      // (the names the parts take from the closure of system.js, with the values it has)
  const MAX_BONES = 255;
  const DEG = Math.PI / 180;
import("@/system/kernel.js");

  function family(d) {
    if (!d || typeof d !== "object" || !d.sk || !d.rig || !d.input || typeof d.input !== "object") throw new Error("happy_worker_core: family({ name, sk, rig, input, ngaits, flags }): the compiled skeleton and rig and the definition's legs, roles and traits");
    if (!Number.isInteger(d.ngaits) || d.ngaits < 1) throw new Error("happy_worker_core: family: ngaits is how many gaits the compiled legs have (1 or more)");
    return { name: typeof d.name === "string" ? d.name : "species", sk: d.sk, rig: d.rig, input: d.input, legs: { gaits: { length: d.ngaits }, words: [0, 0, d.flags >>> 0] }, style_legs: null, declared: Number.isInteger(d.declared) && d.declared >= 1 ? d.declared : 1, fingers: Array.isArray(d.fingers) ? d.fingers : null };
  }

  return { system: system, family: family, plan: style_plan };
});

// ========================================================================================================================
// worker_design
// ========================================================================================================================
packing()("happy_worker_design", function happy_worker_design() {
  "use strict";
  // HAPPY WORKER DESIGN: the gait designer and the action designer as FUNCTIONS OF JSON, in the worker (SYSTEM.md, "The worker's logic"). The designers' windows are for testing and the node backend (backend.js) reads the libraries from
  // disk; a creature in the game makes its styles and its actions from a few numbers, at runtime, from its own function. This is the same arithmetic (gait_designer/gait_blend.js, action_designer/action_spec.js: the very files, pure)
  // over the libraries that the worker has loaded.
  //
  //   const DZ = create({ B, S, gaits, find_action })      B: gait_blend.js   S: action_spec.js (with its player)   gaits: system.gaits (get, list, names, add, decode)   find_action(ref) -> a spec | null (the worker's library)
  //   DZ.gait(design) -> a gait STYLE (registered in `gaits` under its name: a creature takes it by that name)        DZ.action(design) -> an action SPEC (normalised)        DZ.catalog() -> what the sliders are
  //
  // GAIT DESIGN, three forms:
  //   the easy sliders of the designer's top (Blend Styles and Tweaks) over the creature's plain walk:
  //     { name?, legs?: 2 | 4 | 6 ..., base?: "person_walk", blend: { run: 30, strut: 20 }, tweaks: { stride: 20, hip_swing: -10, lean: 15 }, dials: { toe_out: 8 }, amounts: { arms: 0.5 }, variation?: { amount, seed } }
  //       blend: the share (0 .. 100 percent) of a style in the walk, by the key the legs' set has (DZ.catalog().gait.blend[legs]: Run, Shuffle, Stomp, Strong, Strut for two legs; Trot, Gallop, Bound, Pronk, Prowl for four;
  //       the base walk has the rest)   tweaks: -100 .. +100 percent of a dial, 0 at rest (stride, lift, hip_sway, bounce, arm_swing, arm_out, lean, height)   dials: the advanced dials by id, in their own units
  //   a RECIPE (the designer's object): { name, styles: [{ style: "name", weight, regions }], amounts, dials, variation, personality }
  //   a GENERATOR: { name, generate: { kind: "procedural", seed, character: "plain" | "confident" | "tired" | ... | "random", template: "style name" | legs: 2, variation, jitter, strength }
  //                                  | { kind: "random", seed, pool: [names] | { legs, tag, species, text }, count, chaos, dials, variation, amounts } }
  // ACTION DESIGN: { name?, from?: "punch" | "set::punch" | a spec, mix?: { layers: [{ ref, amount, parts }], length, detail, name }, meta?: { title, kind, description, priority, fade, end, cycles, frame, height, params },
  //   edits?: [{ op: "set_phase" | "add_phase" | "remove_phase" | "set_track" | "remove_track" | "add_event" | "remove_event" | "add_wait" ({ wait: { at, tag, max } }) | "remove_wait" ({ i }), ... }], tweaks?: { duration, first, last, arms, legs, torso, head, tail, jaw (shares: 1 as it is),
  //   elbow, knee, lean (degrees), crouch (hips' heights) }, caps?: { arm_l: true ... } }   applied in this order, as the action designer's window does.
  // Every mistake is thrown as an Error whose `.list` has every complaint. Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no class.
  const META_KEYS = ["title", "kind", "description", "priority", "fade", "end", "cycles", "frame", "height", "params"];
  const hash = function (text) { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const problem = function (list, what) { const e = new Error(what + ": " + (list.length === 1 ? list[0] : list.length + " problems: " + list.join("; "))); e.list = list; return e; };
  const clamp = function (x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); };

  function create(env) {
    if (!env || !env.B || !env.S || !env.gaits || typeof env.find_action !== "function") throw new Error("happy_worker_design: create({ B, S, gaits, find_action })");
    const B = env.B, S = env.S, gaits = env.gaits, find = env.find_action;
    const made = Object.create(null);                                                                      // (the styles that designs made: they are not in the pools of a random walk or the plain walks the sliders start from, so a design does not depend on what was made before it)
    const visible = function (s) { return s.name.charAt(0) !== "_" && !made[s.name]; };
    const lookup = function (n) { if (typeof gaits.resolve === "function" && !gaits.get(n)) gaits.resolve(n); return gaits.get(n) || null; };
    const DZ = {};

    // ---- the gait designer
    function slider_recipe(d, errors) {
      const all = gaits.list({}).filter(visible);
      let legs = d.legs;
      let base = null;
      if (d.base !== undefined) {
        base = lookup(d.base);
        if (!base) errors.push("base: there is no style '" + d.base + "' in the libraries");
        else if (legs === undefined) legs = base.legs;
      }
      if (legs === undefined) legs = 2;
      const set = B.style_set(legs, lookup, all);
      if (base) set.base = base;
      else if (!set.base) set.base = B.template_of(all, legs);
      if (!set.base) { errors.push("there is no plain walk of " + legs + " legs in the libraries to start from (base names one)"); return null; }
      const rec = B.default_recipe([set.base]);
      Object.keys(d.blend || {}).forEach(function (k) {
        const key = String(k).toLowerCase();
        if (!set.styles.some(function (x) { return x.key === key; })) { errors.push("blend." + k + ": the set of " + legs + " legs has " + (set.styles.length ? set.styles.map(function (x) { return x.key; }).join(", ") : "no styles to blend")); return; }
        const pct = +d.blend[k];
        if (!isFinite(pct)) { errors.push("blend." + k + " must be a number (percent)"); return; }
        B.simple_style(rec, set, key, pct);
      });
      Object.keys(d.tweaks || {}).forEach(function (k) {
        const tw = B.TWEAK_BY_KEY[k];
        if (!tw) { errors.push("tweaks." + k + " is not an easy slider (" + B.TWEAKS.map(function (x) { return x.key; }).join(", ") + ")"); return; }
        const pct = +d.tweaks[k];
        if (!isFinite(pct)) { errors.push("tweaks." + k + " must be a number (percent, -100 .. 100)"); return; }
        rec.dials[tw.dial] = B.tweak_value(tw, pct);
      });
      Object.keys(d.dials || {}).forEach(function (k) {
        const dl = B.DIALS.filter(function (x) { return x.id === k; })[0];
        if (!dl) { errors.push("dials." + k + " is not a dial (" + B.DIALS.map(function (x) { return x.id; }).join(", ") + ")"); return; }
        const v = +d.dials[k];
        if (!isFinite(v)) { errors.push("dials." + k + " must be a number"); return; }
        rec.dials[k] = clamp(v, dl.min, dl.max);
      });
      Object.keys(d.amounts || {}).forEach(function (k) {
        if (B.neutral_amounts()[k] === undefined) { errors.push("amounts." + k + " is not a part (" + Object.keys(B.neutral_amounts()).join(", ") + ")"); return; }
        const v = +d.amounts[k];
        if (!isFinite(v)) { errors.push("amounts." + k + " must be a number"); return; }
        rec.amounts[k] = clamp(v, 0, 2);
      });
      if (d.variation && typeof d.variation === "object") rec.variation = { amount: clamp(+d.variation.amount || 0, 0, 1), seed: (+d.variation.seed || 1) | 0 };
      return rec;
    }
    DZ.gait = function (design) {
      if (!design || typeof design !== "object" || Array.isArray(design)) throw problem(["a gait design is an object (blend / tweaks / dials, or a recipe, or a generate)"], "gait");
      const d = design, errors = [];
      let rec = null;
      if (d.generate && typeof d.generate === "object") {
        const g = d.generate, kind = g.kind || "procedural", seed = g.seed === undefined ? 1 : (+g.seed >>> 0);
        if (kind === "procedural") {
          const tpl = g.template ? lookup(g.template) : B.template_of(gaits.list({}).filter(visible), g.legs || 2);
          let pers = null;
          if (g.character !== "random" && g.character !== null) {
            pers = B.PERSONALITIES.filter(function (p) { return p.key === (g.character || "plain"); })[0];
            if (!pers) errors.push("generate.character '" + g.character + "' is not one of " + B.PERSONALITIES.map(function (p) { return p.key; }).join(", ") + ", random");
          }
          if (!tpl) errors.push(g.template ? "generate.template: there is no style '" + g.template + "' in the libraries" : "no plain walk of " + (g.legs || 2) + " legs in the libraries to start from (generate.template names one)");
          if (tpl && !errors.length) rec = B.procedural(tpl, pers, seed, { variation: g.variation, jitter: g.jitter, strength: g.strength, name: d.name });
        } else if (kind === "random") {
          let pool = [];
          if (Array.isArray(g.pool)) g.pool.forEach(function (n) { const s = lookup(n); if (s) pool.push(s); else errors.push("generate.pool: there is no style '" + n + "' in the libraries"); });
          else pool = gaits.list(Object.assign({ legs: g.legs || 2 }, g.pool || {})).filter(visible);
          if (!pool.length && !errors.length) errors.push("generate.pool: no style of the libraries is in it");
          if (pool.length && !errors.length) rec = B.random_mix(pool, B.rng(seed), { count: g.count, chaos: g.chaos, dials: g.dials, variation: g.variation, amounts: g.amounts, name: d.name });
        } else errors.push("generate.kind is \"procedural\" or \"random\" (" + kind + ")");
      } else if (Array.isArray(d.styles)) {
        const r = B.recipe_from(d, function (n) { return lookup(n); });
        r.missing.forEach(function (n) { errors.push("styles: there is no style '" + n + "' in the libraries"); });
        if (!r.recipe.styles.length && !r.missing.length) errors.push("a recipe needs styles: [{ style: <name>, weight }]");
        if (!errors.length) rec = r.recipe;
      } else rec = slider_recipe(d, errors);
      if (errors.length || !rec) throw problem(errors.length ? errors : ["no recipe was made"], "gait");
      const sig = hash(JSON.stringify(d));
      rec.name = B.ident(typeof d.name === "string" && d.name ? d.name : "g" + sig);
      let style;
      try { style = B.blend(rec, { full: true }); } catch (e) { throw problem([String(e && e.message || e)], "gait"); }
      try { gaits.decode({ format: "happy.gaits", version: 1, description: "", gaits: [style] }); } catch (e) { throw problem(["system.gaits refuses the style: " + String(e && e.message || e)], "gait"); }
      gaits.add(style);
      made[style.name] = true;
      return gaits.get(style.name);
    };

    // ---- the action designer
    const edit = function (spec, e) {
      if (!e || typeof e !== "object") return "an edit is { op, ... }";
      let ok;
      switch (e.op) {
        case "set_phase": ok = S.set_phase(spec, e.i, e.fields || {}); break;
        case "add_phase": ok = S.add_phase(spec, e.i); break;
        case "remove_phase": ok = S.remove_phase(spec, e.i); break;
        case "set_track": ok = S.set_track(spec, e.id, e.values); break;
        case "remove_track": ok = S.remove_track(spec, e.id); break;
        case "add_event": ok = S.add_event(spec, e.event); break;
        case "remove_event": ok = S.remove_event(spec, e.i); break;
        case "add_wait": ok = S.add_wait(spec, e.wait); break;
        case "remove_wait": ok = S.remove_wait(spec, e.i); break;
        default: return "an edit's op is set_phase, add_phase, remove_phase, set_track, remove_track, add_event, remove_event, add_wait or remove_wait (" + e.op + ")";
      }
      return ok ? null : "the edit " + e.op + " was refused: there is no such phase, track or event, or the action is full";
    };
    const get_spec = function (ref) {
      if (ref && typeof ref === "object") return S.validate(S.clone(ref)).spec;
      const sp = typeof ref === "string" ? find(ref) : null;
      return sp ? S.validate(S.clone(sp)).spec : null;
    };
    // the validator's complaints about a WHOLE spec (a bad ease, an unknown track, a bad kind: `get_spec` normalises them away, so a creature's declared spec is checked with this first) -> [messages]
    DZ.check_action = function (spec) { return S.validate(S.clone(spec)).errors.slice(); };
    DZ.action = function (design) {
      if (!design || typeof design !== "object" || Array.isArray(design)) throw problem(["an action design is an object (from / mix / meta / edits / tweaks)"], "action");
      const d = design, errors = [];
      let spec = null;
      if (d.from !== undefined) {
        spec = get_spec(d.from);
        if (!spec) errors.push("from: there is no action '" + (typeof d.from === "string" ? d.from : "(an object)") + "' in the library");
      } else spec = S.blank(typeof d.name === "string" && d.name ? d.name : "action", d.meta && d.meta.kind ? d.meta.kind : "attack");
      if (spec && d.mix && Array.isArray(d.mix.layers) && d.mix.layers.length) {
        const layers = [];
        d.mix.layers.forEach(function (l, i) {
          const s = get_spec(l && l.ref !== undefined ? l.ref : l && l.spec);
          if (!s) errors.push("mix.layers[" + i + "]: there is no action '" + (l && typeof l.ref === "string" ? l.ref : "?") + "'");
          else layers.push({ spec: s, amount: l.amount === undefined ? 1 : +l.amount, parts: l.parts });
        });
        if (layers.length) {
          try { spec = S.blend(layers, { name: d.mix.name || d.name || "mix", length: d.mix.length, detail: d.mix.detail }).spec; }
          catch (e) { errors.push("mix: " + String(e && e.message || e)); }
        }
      }
      if (!spec) throw problem(errors, "action");
      spec = S.validate(spec).spec;
      const meta = d.meta || {};
      META_KEYS.forEach(function (k) { if (meta[k] !== undefined) spec[k] = meta[k]; });
      if (typeof d.name === "string" && d.name) spec.name = S.ident(d.name);
      spec = S.validate(spec).spec;
      (Array.isArray(d.edits) ? d.edits : []).forEach(function (e, i) { const m = edit(spec, e); if (m) errors.push("edits[" + i + "]: " + m); });
      spec = S.validate(spec).spec;
      if (d.tweaks && typeof d.tweaks === "object") {
        const tw = {};
        Object.keys(d.tweaks).forEach(function (k) { if (S.TWEAKS[k] === undefined) errors.push("tweaks." + k + " is not an easy slider (" + Object.keys(S.TWEAKS).join(", ") + ")"); else if (!isFinite(+d.tweaks[k])) errors.push("tweaks." + k + " must be a number"); else tw[k] = +d.tweaks[k]; });
        spec = S.tweak(spec, tw, d.caps);
      }
      const v = S.validate(spec);
      v.errors.forEach(function (m) { errors.push(m); });
      if (errors.length) throw problem(errors, "action");
      return v.spec;
    };

    // ---- what the sliders are
    DZ.catalog = function () {
      const all = gaits.list({}).filter(visible), blend = {};
      [2, 4, 6].forEach(function (legs) { const set = B.style_set(legs, lookup, all); blend[legs] = set.styles.map(function (x) { return { key: x.key, label: x.label, style: x.style.name }; }); });
      return {
        gait: { blend: blend, tweaks: B.TWEAKS.map(function (x) { return { key: x.key, label: x.label, dial: x.dial, note: x.note }; }), dials: B.DIALS.map(function (x) { return { id: x.id, region: x.region, neutral: x.neutral, min: x.min, max: x.max, unit: x.unit }; }),
          amounts: Object.keys(B.neutral_amounts()), characters: B.PERSONALITIES.map(function (p) { return p.key; }).concat(["random"]), styles: gaits.names().filter(function (n) { return n.charAt(0) !== "_"; }).length },
        action: { tweaks: Object.keys(S.TWEAKS), kinds: S.KINDS, edits: ["set_phase", "add_phase", "remove_phase", "set_track", "remove_track", "add_event", "remove_event", "add_wait", "remove_wait"] }
      };
    };
    return DZ;
  }

  return { create: create };
});

// ========================================================================================================================
// worker_direct
// ========================================================================================================================
packing()("happy_worker_direct", function happy_worker_direct() {
  "use strict";
  // HAPPY WORKER DIRECT: the commands of the page, written straight into the columns of a family (SYSTEM.md, "The worker's logic"; the columns are world.cpp / columns.js). The logic of the creatures runs in the worker and
  // says what it wants of an instance many times a frame: a wish, a drive, a foot, a hand, a layer on a bone, a look. Every one of those is, in the C++, a function that checks its arguments and then writes some numbers of a
  // column (happy_set_intent, happy_body_drive, happy_legs_ovr ...): here the same checks and the same writes are made by the JS side itself, with no call into the wasm. Each function is the C++ one's twin, line for line, and
  // answers what it answers (0: done, or HAPPY_ERR_*: nothing was written), so that a test (the worker's selftest, pure.js: the real wasm, the export and this one on two instances, every byte of their columns
  // compared) can hold the two to be the same, errors included. A frame that runs these allocates nothing.
  //
  //   const D = create(cols.constants(), { check: true })      check: the instance is looked at first (a slot that is out of the table, or one that is not alive: ERR_SLOT, ERR_STALE as the commands say). false: the caller knows
  //                                                            the slot is a live one (the runtime found it by the ALIVE column this frame): nothing but the arguments is checked. The arguments are always checked: a NaN in a column
  //                                                            is a creature that disappears and is found nowhere.
  //   D.intent(fam, s, vx, vz, fx, fz)            the wished velocity (world) and the wished facing (0, 0: the way it goes)                     happy_set_intent        (CMD_HAPPY_INTENT)
  //   D.drive(fam, s, on, vx, vz)                 an action drives the body: its velocity IS this while on (1) is said                           happy_body_drive        (CMD_HAPPY_DRIVE)
  //   D.tread(fam, s, vx, vz)                     the ground scrolls under the feet, the body stays                                              happy_legs_tread        (CMD_HAPPY_TREAD)
  //   D.gait_blend(fam, s, a, b, t)               the mix of two of the family's gaits, t the weight of the second                               happy_legs_gait_blend   (CMD_HAPPY_GAIT_BLEND)
  //   D.root(fam, s, x, y, z, qx, qy, qz, qw, scale)   the root: a place, a turn (it is made a unit) and a scale (0: as it is)                    happy_set_root          (CMD_HAPPY_SET_ROOT)
  //   D.jump(fam, s, vy, flags)                   a launch (flags bit 0: also in the air)                                                         happy_body_jump         (CMD_HAPPY_JUMP)
  //   D.push(fam, s, vx, vz, vy)                  a shove                                                                                         happy_body_push         (CMD_HAPPY_PUSH)
  //   D.fly(fam, s, wish)                         the wish to take off (1) or land (2), 0 none: the body does it at the top of its next frame and clears it   happy_body_fly_wish   (the export: the page's CMD_HAPPY_FLY is the same take-off)
  //   D.climb(fam, s, vy)                         the vertical velocity a flying instance wishes (world units / s; it stays until the next)       happy_body_climb        (CMD_HAPPY_CLIMB)
  //   D.foot(fam, s, leg, cov, x, y, z)           a script takes a foot (leg lengths from the hip, as far as cov says; held 30 frames unless said again)     happy_legs_ovr          (CMD_HAPPY_FOOT)
  //   D.knee(fam, s, leg, cov, angle)             a script turns a knee (radians, + out)                                                          happy_legs_knee         (CMD_HAPPY_KNEE)
  //   D.life(fam, s, on)                          the instance's life is on (1) or off (0)                                                        happy_life_command op 0 (CMD_HAPPY_LIFE)
  //   D.pose(fam, s, k, yaw, pitch, roll, tx, ty, tz)   the page's layer on the overlay bone k (radians, model units)                             happy_life_command op 1 (CMD_HAPPY_LIFE)
  //   D.hand(fam, s, arm, flags, w, ux, uy, uz, pole_angle, pw)   an action takes an arm's hand (arm lengths from the shoulder; flags bit 0: in the body's frame; bit 1: the point is in the WORLD, metres, a reach of its own; bit 2: the body leans to reach it; bit 3: the hand stops at the first surface; bit 4: the body crouches)   happy_life_hand   (CMD_HAPPY_HAND)
  //   D.chain(fam, s, chain, flags, tx, ty, tz, qx, qy, qz, qw, weight, px, py, pz, polew)   the rig's chain: where its end is asked to be (the model's space), the turn wanted, how much, the pole; flags: 1 live, 2 orient       happy_rig_chain   (CMD_HAPPY_CHAIN)
  //   D.wings(fam, s, mode, fold, hz, amp)        the wings by hand (mode 1: fold 0 .. 1, beats a second, amplitude) or automatic (0)               happy_wings_set      (CMD_HAPPY_WINGS)
  //   D.face(fam, s, op, a, v, hold, scale)       op 0 a channel of the face (a, its goal v, held `hold` seconds), op 1 an expression (a: 0 .. 9, scaled), op 2 an act (a: the bits: a blink, a sniff ...)       happy_face_cmd    (CMD_HAPPY_FACE)
  //   D.look(fam, s, mode, flags, a, b, c, weight, height)   the look's goal: mode 0 none, 1 a world point (a, b, c = x, y, z), 2 a direction in the body's frame (a, b = yaw, pitch; c 0), 3 another instance (a, b, c = its family's js id,
  //                                               its slot, its generation) at `height` over its root                                              happy_face_look        (CMD_HAPPY_LOOK)
  // The wasm's numbers are floats: a value is made a float (Math.fround) where the C++ would take it as one, and a sum or a quotient that the C++ makes in floats is made so here, so a column holds the very bits the command
  // gives it. Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no class.
  const fr = Math.fround, sqrt = Math.sqrt, abs = Math.abs;
  const finite = function (v) { v = fr(v); return v === v && v < fr(1e30) && v > fr(-1e30); };                      // (happy_finite)
  const clamp = function (v, lo, hi) { v = fr(v); return v < lo ? lo : (v > hi ? hi : v); };                          // (happy_clampf; lo and hi are floats already)
  const PI_F = fr(3.1416), M_PI_F = fr(-3.1416), ONE = fr(1), TEN = fr(10), E4 = fr(1e4), E5 = fr(1e5), E7 = fr(1e7), SIX = fr(6.2832), HALF_PI = fr(1.5708), FOUR = fr(4), TINY = fr(1e-9);

  function create(K, opt) {
    if (!K || K.ERR_ARGS === undefined || K.F_AIR === undefined) throw new Error("happy_worker_direct: create(constants, { check }): the constants of cols.constants()");
    let check = !opt || opt.check !== false;
    const OK = 0, ERR_ARGS = K.ERR_ARGS, ERR_SLOT = K.ERR_SLOT, ERR_STALE = K.ERR_STALE, ERR_BODY = K.ERR_BODY, ERR_LEGS = K.ERR_LEGS, ERR_LIFE = K.ERR_LIFE, ERR_FLIGHT = K.ERR_FLIGHT;
    const F_ROOT = K.F_ROOT, F_AIR = K.F_AIR, R_ARM = K.R_UPPER | K.R_FORE;
    const AS_PWS = K.AS_PWS, AS_PFR = K.AS_PFR, AS_PUX = K.AS_PUX, AS_PUY = K.AS_PUY, AS_PUZ = K.AS_PUZ, AS_PFL = K.AS_PFL, AS_PPA = K.AS_PPA, AS_PPW = K.AS_PPW;
    const AS_WWS = K.AS_WWS, AS_WFR = K.AS_WFR, AS_WX = K.AS_WX, AS_WY = K.AS_WY, AS_WZ = K.AS_WZ, AS_WFL = K.AS_WFL, AS_WPA = K.AS_WPA, AS_WPW = K.AS_WPW, E6 = fr(1e6);
    const GZ_MODE = K.FS_GZ_MODE, GZ_UW = K.FS_GZ_UW, GZ_X = K.FS_GZ_X, GZ_Y = K.FS_GZ_Y, GZ_Z = K.FS_GZ_Z, GZ_JS = K.FS_GZ_JS, GZ_SLOT = K.FS_GZ_SLOT, GZ_GEN = K.FS_GZ_GEN, GZ_H = K.FS_GZ_H, GZ_FLAGS = K.FS_GZ_FLAGS;
    const MAX_JS_IDS = K.MAX_JS_IDS, MAX_INSTANCES = K.MAX_INSTANCES, ERR_CHAIN = K.ERR_CHAIN, ERR_WINGS = K.ERR_WINGS, RC_LIVE = K.RC_LIVE, RC_ORIENT = K.RC_ORIENT;
    const FS_FC_T = K.FS_FC_T, FS_FC_HOLD = K.FS_FC_HOLD, FS_FC_ON = K.FS_FC_ON, FS_ACT = K.FS_ACT, FC_COUNT = K.FC_COUNT, FC_JAW = K.FC_JAW, FC_SPEAK = K.FC_SPEAK, FACT_ALL = K.FACT_ALL;
    const J12 = fr(1.2);
    const face_clamp = function (c, v) { return c === FC_JAW ? clamp(v, 0, J12) : (c === FC_SPEAK ? clamp(v, 0, 1) : clamp(v, -1, 1)); };       // (happy_face_clamp)

    // the instance: happy_instance's checks (the family is the caller's object: a family that is not there has no columns)
    const seen = function (fam, s) { return s >= fam.max ? ERR_SLOT : (fam.ALIVE[s] ? OK : ERR_STALE); };

    const D = {
      set_check: function (on) { check = !!on; },
      get_check: function () { return check; },

      intent: function (fam, s, vx, vz, fx, fz) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        const I = fam.INTENT;
        if (I === null) return ERR_BODY;
        if (!finite(vx) || !finite(vz) || !finite(fx) || !finite(fz)) return ERR_ARGS;
        const i = s * 4;
        I[i] = vx; I[i + 1] = vz; I[i + 2] = fx; I[i + 3] = fz;
        return OK;
      },

      drive: function (fam, s, on, vx, vz) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        const R = fam.DRIVE;
        if (R === null) return ERR_BODY;
        if ((on & ~1) !== 0 || !finite(vx) || !finite(vz) || abs(fr(vx)) > E4 || abs(fr(vz)) > E4) return ERR_ARGS;
        const i = s * 3;
        R[i] = (on & 1) ? 1 : 0; R[i + 1] = (on & 1) ? vx : 0; R[i + 2] = (on & 1) ? vz : 0;
        return OK;
      },

      tread: function (fam, s, vx, vz) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        const T = fam.TREAD;
        if (T === null) return ERR_LEGS;
        if (!finite(vx) || !finite(vz) || abs(fr(vx)) > E4 || abs(fr(vz)) > E4) return ERR_ARGS;
        T[s * 2] = vx; T[s * 2 + 1] = vz;
        return OK;
      },

      gait_blend: function (fam, s, a, b, t) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        if (fam.GAIT_A === null) return ERR_LEGS;
        const n = fam.GAIT_COUNT[0];
        if (!(a >= 0 && a < n) || !(b >= 0 && b < n) || a !== (a | 0) || b !== (b | 0) || !finite(t) || fr(t) < 0 || fr(t) > 1) return ERR_ARGS;
        fam.GAIT_A[s] = a; fam.GAIT_B[s] = b; fam.GAIT_T[s] = t;
        return OK;
      },

      root: function (fam, s, x, y, z, qx, qy, qz, qw, scale) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        const R = fam.ROOT, i = s * 8;
        qx = fr(qx); qy = fr(qy); qz = fr(qz); qw = fr(qw);
        let l = fr(sqrt(fr(fr(fr(fr(qx * qx) + fr(qy * qy)) + fr(qz * qz)) + fr(qw * qw))));
        if (!(l > TINY)) { qx = 0; qy = 0; qz = 0; qw = 1; l = 1; }
        R[i] = x; R[i + 1] = y; R[i + 2] = z; R[i + 3] = fr(scale) > 0 ? scale : R[i + 3];
        R[i + 4] = fr(qx / l); R[i + 5] = fr(qy / l); R[i + 6] = fr(qz / l); R[i + 7] = fr(qw / l);
        fam.FLAGS[s] |= F_ROOT;
        return OK;
      },

      jump: function (fam, s, vy, flags) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        if (fam.VY === null || fam.JUMP_OK === 0) return ERR_BODY;
        if (!finite(vy) || (flags & ~1) !== 0) return ERR_ARGS;
        if ((fam.FLAGS[s] & F_AIR) && !(flags & 1)) return OK;
        fam.VY[s] = vy;
        fam.FLAGS[s] |= F_AIR;
        return OK;
      },

      // (a family with no flight section or aircraft, or no gravity, is refused with ERR_FLIGHT and nothing is written: `!` also holds for a family object that has not the column at all)
      fly: function (fam, s, wish) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        if (!fam.FLYWISH || !fam.FLY_OK) return ERR_FLIGHT;
        if (wish !== 0 && wish !== 1 && wish !== 2) return ERR_ARGS;
        fam.FLYWISH[s] = wish;
        return OK;
      },

      climb: function (fam, s, vy) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        if (!fam.CLIMB || !fam.CLIMB_OK) return ERR_FLIGHT;
        if (!finite(vy)) return ERR_ARGS;
        fam.CLIMB[s] = vy;
        return OK;
      },

      push: function (fam, s, vx, vz, vy) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        if (fam.VEL === null) return ERR_BODY;
        if (!finite(vx) || !finite(vz) || !finite(vy)) return ERR_ARGS;
        const V = fam.VEL;
        V[s * 2] = fr(V[s * 2] + fr(vx)); V[s * 2 + 1] = fr(V[s * 2 + 1] + fr(vz));
        if (fam.FLAGS[s] & F_AIR) fam.VY[s] = fr(fam.VY[s] + fr(vy));
        return OK;
      },

      foot: function (fam, s, leg, cov, x, y, z) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        if (fam.OVR_COV === null) return ERR_LEGS;
        if (!(leg >= 0 && leg < fam.NLEGS) || leg !== (leg | 0) || !finite(cov) || !finite(x) || !finite(y) || !finite(z) || abs(fr(x)) > TEN || abs(fr(y)) > TEN || abs(fr(z)) > TEN) return ERR_ARGS;
        const il = s * fam.NLEGS + leg;
        if (!(fr(cov) > 0)) { fam.OVR_COV[il] = 0; return OK; }
        fam.OVR_COV[il] = fr(cov) > 1 ? 1 : cov;
        const O = fam.OVR;
        O[il * 3] = x; O[il * 3 + 1] = y; O[il * 3 + 2] = z;
        fam.OVR_FRAME[il] = fam.FRAME_NO[0];
        return OK;
      },

      knee: function (fam, s, leg, cov, angle) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        if (fam.KN_COV === null) return ERR_LEGS;
        if (!(leg >= 0 && leg < fam.NLEGS) || leg !== (leg | 0) || !finite(cov) || !finite(angle)) return ERR_ARGS;
        const il = s * fam.NLEGS + leg;
        if (!(fr(cov) > 0)) { fam.KN_COV[il] = 0; return OK; }
        fam.KN_COV[il] = fr(cov) > 1 ? 1 : cov;
        fam.KN[il] = fr(angle) > PI_F ? PI_F : (fr(angle) < M_PI_F ? M_PI_F : angle);
        fam.KN_FRAME[il] = fam.FRAME_NO[0];
        return OK;
      },

      life: function (fam, s, on) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        if (fam.LIFE_OFF === null) return ERR_LIFE;
        fam.LIFE_OFF[s] = on !== 0 ? 0 : 1;
        return OK;
      },

      pose: function (fam, s, k, yaw, pitch, roll, tx, ty, tz) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        const P = fam.LIFE_POKE;
        if (P === null) return ERR_LIFE;
        if (!(k >= 0 && k < fam.NOV) || k !== (k | 0)) return ERR_ARGS;
        if (!finite(yaw) || !finite(pitch) || !finite(roll) || !finite(tx) || !finite(ty) || !finite(tz)) return ERR_ARGS;
        if (fam.LIFE_ROLE[k] & R_ARM) return ERR_ARGS;                                              // (an arm's bones are the life's: the arm's own pose)
        if (fam.LIFE_MOVABLE[k] === 0 && (fr(tx) !== 0 || fr(ty) !== 0 || fr(tz) !== 0)) return ERR_ARGS;      // (a bone that a unit of the rig solves does not move)
        const i = (s * fam.NOV + k) * 6;
        P[i] = yaw; P[i + 1] = pitch; P[i + 2] = roll; P[i + 3] = tx; P[i + 4] = ty; P[i + 5] = tz;
        return OK;
      },

      hand: function (fam, s, arm, flags, w, ux, uy, uz, pole_angle, pw) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        const A = fam.ARM_ST;
        if (fam.LIFE_OFF === null) return ERR_LIFE;                                                   // (no life: the C++ has no happy_life)
        if (A === null || !(arm >= 0 && arm < fam.NARMS) || arm !== (arm | 0) || (flags & ~31) !== 0 || !finite(w) || !finite(pw) || !finite(pole_angle)) return ERR_ARGS;
        if ((flags & 1) !== 0 && (flags & 2) !== 0) return ERR_ARGS;                                  // (the body's frame or the world, not both)
        if ((flags & 28) !== 0 && (flags & 2) === 0) return ERR_ARGS;                                 // (the lean, the surface and the crouch are the world reach's)
        const lim = (flags & 2) !== 0 ? E6 : FOUR;
        if (!finite(ux) || !finite(uy) || !finite(uz) || abs(fr(ux)) > lim || abs(fr(uy)) > lim || abs(fr(uz)) > lim) return ERR_ARGS;
        const i = (s * fam.NARMS + arm) * fam.ARM_NS;
        if ((flags & 2) !== 0) {                                                                      // the WORLD REACH: a layer of its own over the arm's hand and the page's
          A[i + AS_WWS] = clamp(w, 0, 1); A[i + AS_WFR] = fam.FRAME_NO[0];
          if (!(fr(w) > 0)) return OK;
          A[i + AS_WX] = ux; A[i + AS_WY] = uy; A[i + AS_WZ] = uz; A[i + AS_WFL] = (flags >> 2) & 7;
          A[i + AS_WPA] = clamp(pole_angle, M_PI_F, PI_F); A[i + AS_WPW] = clamp(pw, 0, 1);
          return OK;
        }
        A[i + AS_PWS] = clamp(w, 0, 1); A[i + AS_PFR] = fam.FRAME_NO[0];
        if (!(fr(w) > 0)) return OK;                                                                  // (0 lets the hand go: it eases out where it was, the place is not changed)
        A[i + AS_PUX] = ux; A[i + AS_PUY] = uy; A[i + AS_PUZ] = uz; A[i + AS_PFL] = flags;
        A[i + AS_PPA] = clamp(pole_angle, M_PI_F, PI_F); A[i + AS_PPW] = clamp(pw, 0, 1);
        return OK;
      },

      look: function (fam, s, mode, flags, a, b, c, weight, height) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        const F = fam.FACE_ST;
        if (fam.LIFE_OFF === null || F === null || fam.LOOK_OK === 0) return ERR_LIFE;               // (nothing to look with)
        if (!(mode >= 0 && mode <= 3) || mode !== (mode | 0) || !(flags >= 0 && flags <= 3) || flags !== (flags | 0) || !finite(weight) || !finite(height) || fr(height) < 0 || fr(height) > E5) return ERR_ARGS;
        const i = s * fam.FACE_NS;
        if (mode === 0) { F[i + GZ_MODE] = 0; return OK; }
        if (mode === 3) {
          if (a === 0 || a >= MAX_JS_IDS || b >= MAX_INSTANCES || c > 65535 || a < 0 || b < 0 || c < 0) return ERR_ARGS;
          F[i + GZ_JS] = a; F[i + GZ_SLOT] = b; F[i + GZ_GEN] = c; F[i + GZ_H] = height;
        } else {
          if (!finite(a) || !finite(b) || !finite(c) || abs(fr(a)) > E7 || abs(fr(b)) > E7 || abs(fr(c)) > E7) return ERR_ARGS;
          if (mode === 2 && (abs(fr(a)) > SIX || abs(fr(b)) > HALF_PI)) return ERR_ARGS;
          F[i + GZ_X] = a; F[i + GZ_Y] = b; F[i + GZ_Z] = c;
        }
        F[i + GZ_UW] = clamp(weight, 0, 1);
        F[i + GZ_FLAGS] = flags;
        F[i + GZ_MODE] = mode;
        return OK;
      },

      chain: function (fam, s, chain, flags, tx, ty, tz, qx, qy, qz, qw, weight, px, py, pz, polew) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        const TG = fam.RIG_TGT;
        if (TG === null || !(chain >= 0 && chain < fam.NCHAINS) || chain !== (chain | 0)) return ERR_CHAIN;
        if (!finite(tx) || !finite(ty) || !finite(tz) || !finite(qx) || !finite(qy) || !finite(qz) || !finite(qw) || !finite(weight) || !finite(px) || !finite(py) || !finite(pz) || !finite(polew)) return ERR_ARGS;
        if ((flags & ~(RC_LIVE | RC_ORIENT)) !== 0) return ERR_ARGS;
        const i = s * fam.NCHAINS + chain, t3 = i * 3, o4 = i * 4;
        qx = fr(qx); qy = fr(qy); qz = fr(qz); qw = fr(qw);
        let len = fr(fr(fr(fr(qx * qx) + fr(qy * qy)) + fr(qz * qz)) + fr(qw * qw));                       // (q4_normalize, in floats)
        if (len > 0) len = fr(1 / fr(sqrt(len)));
        const nx = fr(qx * len), ny = fr(qy * len), nz = fr(qz * len), nw = fr(qw * len);
        const wg = fr(weight), wgt = wg < 0 ? 0 : (wg > 1 ? 1 : wg), pl = fr(polew), pw = pl < 0 ? 0 : (pl > 1 ? 1 : pl);
        const O = fam.RIG_ORN, P = fam.RIG_POLE, CF = fam.RIG_CFL;
        // a command that says what the chain has been told already changes nothing (the page may say it every frame): the unit is not solved again for it
        if (CF[i] === flags && TG[t3] === fr(tx) && TG[t3 + 1] === fr(ty) && TG[t3 + 2] === fr(tz) && O[o4] === nx && O[o4 + 1] === ny && O[o4 + 2] === nz && O[o4 + 3] === nw &&
          fam.RIG_WGT[i] === wgt && P[t3] === fr(px) && P[t3 + 1] === fr(py) && P[t3 + 2] === fr(pz) && fam.RIG_POLEW[i] === pw) return OK;
        CF[i] = flags;
        TG[t3] = tx; TG[t3 + 1] = ty; TG[t3 + 2] = tz;
        O[o4] = nx; O[o4 + 1] = ny; O[o4 + 2] = nz; O[o4 + 3] = nw;
        fam.RIG_WGT[i] = wgt;
        P[t3] = px; P[t3 + 1] = py; P[t3 + 2] = pz;
        fam.RIG_POLEW[i] = pw;
        fam.RIG_UCHG[s * fam.NUNITS + fam.RIG_CUNIT[chain]] = 1;
        fam.RIG_CDIRTY[s] = 1;
        return OK;
      },

      wings: function (fam, s, mode, fold, hz, amp) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        if (fam.WING_MANUAL === null) return ERR_WINGS;
        if (!(mode >= 0 && mode <= 1) || mode !== (mode | 0) || !(fr(fold) >= 0) || !(fr(fold) <= 1) || !(fr(hz) >= 0) || !(fr(hz) <= 50) || !(fr(amp) >= 0) || !(fr(amp) <= 3)) return ERR_ARGS;
        fam.WING_MANUAL[s] = mode;
        if (mode) { fam.WING_FOLD[s] = fold; fam.WING_HZ[s] = hz; fam.WING_AMP[s] = amp; }
        return OK;
      },

      face: function (fam, s, op, a, v, hold, scale) {
        if (check) { const e = seen(fam, s); if (e) return e; }
        const F = fam.FACE_ST;
        if (F === null) return ERR_LIFE;
        if (!finite(v) || !finite(hold) || fr(hold) < 0 || fr(hold) > 3600 || !finite(scale) || fr(scale) < 0 || fr(scale) > 4) return ERR_ARGS;
        const i = s * fam.FACE_NS, T = i + FS_FC_T, H = i + FS_FC_HOLD;
        if (op === 0) {
          if (!(a >= 0 && a < FC_COUNT) || a !== (a | 0)) return ERR_ARGS;
          F[T + a] = face_clamp(a, v); F[H + a] = hold; F[i + FS_FC_ON] = 1;
          return OK;
        }
        if (op === 1) {
          if (!(a >= 0 && a < 10) || a !== (a | 0)) return ERR_ARGS;
          const k = fr(scale) > 0 ? fr(scale) : 1, hd = fr(hold) > 0 ? hold : fam.FACE_HOLD[a], P = fam.FACE_PRESETS, row = a * FC_COUNT;
          for (let c = 0; c < FC_COUNT; c++) { if (c === FC_SPEAK) continue; F[T + c] = face_clamp(c, fr(P[row + c] * k)); F[H + c] = hd; }
          F[i + FS_FC_ON] = 1;
          return OK;
        }
        if (op === 2) {
          if (a === 0 || a !== (a | 0) || a < 0 || (a & ~FACT_ALL) !== 0) return ERR_ARGS;
          F[i + FS_ACT] = ((F[i + FS_ACT] >>> 0) | a) >>> 0;
          return OK;
        }
        return ERR_ARGS;
      }

    };
    return D;
  }

  return { create: create };
});

// ========================================================================================================================
// worker_fingers
// ========================================================================================================================
packing()("happy_worker_fingers", function happy_worker_fingers() {
  "use strict";
  // HAPPY FINGERS: a hand's fingers curl round what it holds and open again (SYSTEM.md "Fingers"). A creature whose skeleton has bones for the fingers (the human rigs have fifteen a hand: the source body's finger1-1.L ... finger5-3.L, mixamo's
  // LeftHandIndex1 ... LeftHandThumb3) is given a TABLE here, once, from the compiled skeleton: for each arm the bone of the hand, and for each finger its bones in order and, for each joint, the axis it bends about, in the bone's own
  // frame. A finger bends about the axis that turns it toward the PALM: the palm faces the body when the arm hangs (the rigs' bind poses), and down when the arm is out sideways. The same file is the page's (species.js:
  // sp.hand_curl) and the worker's (pure.js me.fingers, grab.js: the hands close when they hold and open when they let go): the page poses the bones with its commands (CMD_HAPPY_BONE), the worker with the wasm's
  // happy_skeleton_pose; the numbers are the same.
  //
  //   F.build(sk, arms) -> table | null     sk: the compiled skeleton ({ n, names, parent, head, tail, bind }); arms: [{ side (+1 left, -1 right), shoulder (the bone of the upper arm), wrist (the bone of the forearm) }]. The table is plain data (a structured
  //                                         clone carries it to the worker): [{ arm, hand (the bone), fingers: [{ thumb, bones: [b1, b2, b3], axis: [x y z of every joint, in its bone's frame], max: [the angle of every joint at a curl of 1, radians] }] }]. null: no arm has fingers
  //   F.apply(entry, curl, o, pose) -> n    entry: one arm's record; curl 0 (open and flat) .. 1 (a fist); o: { thumb: the thumb's share of the curl (1), spread: 0 }; pose(bone, rx, ry, rz) is called for every joint with the turn in the
  //                                         euler angles that sp.pose and happy_skeleton_pose take (F.euler: the inverse of the worker's: system.euler_of). -> how many joints were posed
  //   F.euler(qx, qy, qz, qw, out)          the euler angles (out: [rx, ry, rz]) of a turn in the bone's own frame, as species.js euler_of says them
  // Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no class.
  var MAX_ANGLES = [1.35, 1.5, 1.1];                  // the bend of the three joints of a finger at a curl of 1 (radians): under 90 degrees at the largest, the euler angles of a bend about the bone's own z stop at a quarter turn
  var THUMB_ANGLES = [0.55, 0.9, 0.9];
  var HAND_NAME = /hand$|wrist/i;
  var FINGER_NAME = /(thumb|index|middle|ring|pinky|finger)/i;

  // the euler angles of a quaternion (x y z w) of a bone's own frame: the very function of species.js (system.euler_of), which the commands compose back
  function euler(x, y, z, w, out) {
    var n = Math.sqrt(x * x + y * y + z * z + w * w) || 1;
    x /= n; y /= n; z /= n; w /= n;
    var r00 = 1 - 2 * (y * y + z * z), r01 = 2 * (x * y - z * w), r02 = 2 * (x * z + y * w), r11 = 1 - 2 * (x * x + z * z), r21 = 2 * (y * z + x * w), r10 = 2 * (x * y + z * w), r12 = 2 * (y * z - x * w);
    var rz = Math.asin(Math.max(-1, Math.min(1, -r01))) + 0;
    if (Math.abs(Math.cos(rz)) < 1e-6) { out[0] = Math.atan2(-r12, r10 * (-r01 > 0 ? 1 : (-r01 < 0 ? -1 : 0))); out[1] = 0; out[2] = rz; return out; }
    out[0] = Math.atan2(r21, r11) + 0; out[1] = Math.atan2(r02, r00) + 0; out[2] = rz;
    return out;
  }

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function head(sk, b) { return [sk.head[b * 3], sk.head[b * 3 + 1], sk.head[b * 3 + 2]]; }
  function tail(sk, b) { return [sk.tail[b * 3], sk.tail[b * 3 + 1], sk.tail[b * 3 + 2]]; }
  // the bone's own frame: the columns of its bind matrix (3 x 4, row major: the x, y, z axes of the bone in the model's space, y along head -> tail)
  function local_of(sk, b, a) {
    var m = sk.bind, o = b * 12;
    return [m[o] * a[0] + m[o + 4] * a[1] + m[o + 8] * a[2], m[o + 1] * a[0] + m[o + 5] * a[1] + m[o + 9] * a[2], m[o + 2] * a[0] + m[o + 6] * a[1] + m[o + 10] * a[2]];
  }

  function children_of(sk, b) {
    var out = [], i;
    for (i = 0; i < sk.n; i++) if (sk.parent[i] === b) out.push(i);
    return out;
  }
  // a chain from a bone down through its only children (at most 3 bones)
  function chain_from(sk, b) {
    var out = [b], kids;
    while (out.length < 3) {
      kids = children_of(sk, out[out.length - 1]);
      if (kids.length !== 1) break;
      out.push(kids[0]);
    }
    return out;
  }

  // the thumb is called one (the source body's finger1-, mixamo's Thumb); a rig that does not say it has the thumb as the one of five whose base is farthest from the middle of the others
  function thumb_of(sk, kids) {
    var k, i, j, m, d, best = -1, bd = -1, c;
    for (k = 0; k < kids.length; k++) if (/thumb/i.test(sk.names[kids[k]]) || /finger1-/i.test(sk.names[kids[k]])) return k;
    if (kids.length !== 5) return -1;
    for (k = 0; k < kids.length; k++) {
      m = [0, 0, 0]; c = 0;
      for (i = 0; i < kids.length; i++) if (i !== k) { j = head(sk, kids[i]); m[0] += j[0]; m[1] += j[1]; m[2] += j[2]; c++; }
      m = [m[0] / c, m[1] / c, m[2] / c];
      d = sub(head(sk, kids[k]), m); d = dot(d, d);
      if (d > bd) { bd = d; best = k; }
    }
    return best;
  }

  function build(sk, arms) {
    var table = [], j, a, kids, hand, h, fingers, k, ch, d, axes, i, side, u, medial, thumb_i, w, loc, th, ang;
    if (!sk || !sk.names || !arms || !arms.length) return null;
    for (j = 0; j < arms.length; j++) {
      a = arms[j];
      kids = children_of(sk, a.wrist);
      hand = -1;
      for (k = 0; k < kids.length; k++) {                                               // (the hand: the forearm's child that has the fingers under it)
        h = children_of(sk, kids[k]);
        if (h.length >= 2 && (HAND_NAME.test(sk.names[kids[k]]) || FINGER_NAME.test(sk.names[h[0]]))) { hand = kids[k]; break; }                 // (a hand has at least two: the lite human's thumb and its block of four fingers)
      }
      if (hand < 0) continue;
      fingers = [];
      kids = children_of(sk, hand);
      // the palm faces the body when the arm hangs, and down when it is out to the side
      u = norm(sub(head(sk, hand), head(sk, a.shoulder)));
      side = head(sk, hand)[0] >= 0 ? 1 : -1;
      medial = Math.abs(u[1]) > 0.6 ? [-side, 0, 0] : [0, -1, 0];
      thumb_i = thumb_of(sk, kids);
      for (k = 0; k < kids.length; k++) {
        ch = chain_from(sk, kids[k]);
        if (ch.length < 1) continue;                                                       // (a chain of one bone is a thumb of the lite human)
        th = k === thumb_i;
        axes = [];
        for (i = 0; i < ch.length; i++) {
          d = norm(sub(tail(sk, ch[i]), head(sk, ch[i])));
          w = cross(d, medial);                                                          // (the bend toward the palm: a x d is the way the tip goes)
          if (dot(w, w) < 1e-6) w = cross(d, [0, 0, 1]);                                 // (a finger that lies along the palm direction: any axis across it)
          loc = local_of(sk, ch[i], norm(w));
          axes.push(loc[0], loc[1], loc[2]);
        }
        ang = th ? THUMB_ANGLES : MAX_ANGLES;
        fingers.push({ thumb: th, bones: ch, axis: axes, max: ang.slice(0, ch.length) });
      }
      if (fingers.length >= 2) table.push({ arm: j, hand: hand, fingers: fingers, palm: palm_of(sk, hand, kids, thumb_i, medial) });
    }
    return table.length ? table : null;
  }
  // THE PALM of a hand, from the bind pose (model units, model axes): `c` where the middle of the palm is, from the hand bone's head (the wrist) along the bone line (0.55 of the way to the knuckles); `f` the way the fingers point
  // when they are open, `n` the way the palm faces (the way the fingers curl: toward the palm), `th` the side the thumb is on (square to both), `sh` the hand's handedness: +1 when f x n is toward the thumb, else -1 (a hold that
  // says its palm's way and its thumb's way gets the fingers' way from it: f = sh (n x th)). A hand with no thumb has the thumb's side taken as n x f
  function palm_of(sk, hand, kids, thumb_i, medial) {
    var k, i, K = [0, 0, 0], cnt = 0, h0 = head(sk, hand), f, n, th, t, s, ch, p;
    for (k = 0; k < kids.length; k++) {
      if (k === thumb_i) continue;
      ch = head(sk, kids[k]);
      K[0] += ch[0]; K[1] += ch[1]; K[2] += ch[2]; cnt++;
    }
    if (!cnt) return null;
    K = [K[0] / cnt, K[1] / cnt, K[2] / cnt];
    f = norm(sub(K, h0));
    n = sub(medial, [f[0] * dot(medial, f), f[1] * dot(medial, f), f[2] * dot(medial, f)]);
    if (dot(n, n) < 1e-8) n = cross(f, [0, 0, 1]);
    n = norm(n);
    if (thumb_i >= 0) {
      t = sub(head(sk, kids[thumb_i]), K);
      th = sub(t, [f[0] * dot(t, f) + n[0] * dot(t, n), f[1] * dot(t, f) + n[1] * dot(t, n), f[2] * dot(t, f) + n[2] * dot(t, n)]);
    } else th = null;
    if (!th || dot(th, th) < 1e-10) th = cross(n, f);
    th = norm(th);
    s = dot(cross(f, n), th) >= 0 ? 1 : -1;
    p = [h0[0] + 0.55 * (K[0] - h0[0]), h0[1] + 0.55 * (K[1] - h0[1]), h0[2] + 0.55 * (K[2] - h0[2])];
    return { c: sub(p, h0), f: f, n: n, th: th, sh: s, index_bone: index_of(sk, kids) };
  }
  // the index finger's first bone (the one next to the thumb: the source body's finger2-, mixamo's Index): the finger of a trigger; -1 when the rig does not say
  function index_of(sk, kids) {
    var k;
    for (k = 0; k < kids.length; k++) if (/index/i.test(sk.names[kids[k]]) || /finger2-/i.test(sk.names[kids[k]])) return kids[k];
    return -1;
  }

  var q3 = [0, 0, 0], e3 = [0, 0, 0];
  function apply(entry, curl, o, pose) {
    var n = 0, k, i, f, th, s, c, ax, ay, az, b, c2 = curl < 0 ? 0 : (curl > 1 ? 1 : curl), thumb = o && o.thumb !== undefined ? o.thumb : 1;
    var ix = o && o.index !== undefined ? o.index : 1, ib = entry.palm ? entry.palm.index_bone : -1;       // (the index finger's share: a trigger finger lies straighter than the others)
    for (k = 0; k < entry.fingers.length; k++) {
      f = entry.fingers[k];
      for (i = 0; i < f.bones.length; i++) {
        th = f.max[i] * c2 * (f.thumb ? thumb : 1) * (f.bones[0] === ib ? ix : 1);
        ax = f.axis[i * 3]; ay = f.axis[i * 3 + 1]; az = f.axis[i * 3 + 2];
        s = Math.sin(th / 2); c = Math.cos(th / 2);
        euler(ax * s, ay * s, az * s, c, e3);
        pose(f.bones[i], e3[0], e3[1], e3[2]);
        n++;
      }
    }
    return n;
  }

  return { build: build, apply: apply, euler: euler, MAX_ANGLES: MAX_ANGLES, THUMB_ANGLES: THUMB_ANGLES };
});

// ========================================================================================================================
// worker_gait_slots
// ========================================================================================================================
packing()("happy_worker_gait_slots", function happy_worker_gait_slots() {
  "use strict";
  // HAPPY WORKER GAIT SLOTS: a gait style on ONE instance, decided in the worker, with no call to the page and no command (SYSTEM.md, "The worker's logic"). A family has a fixed number of gaits (the page built it with them: legs.gaits, and
  // `legs.slots` spare ones, body.cpp: HAPPY_MAX_GAITS), and every instance mixes two of them by a weight (gait_a, gait_b, gait_t: what happy_legs_gait_of, the paths, the feet and the upper body read). A style that is to be walked by
  // an instance therefore needs a SLOT: a gait of the family whose tables are the style's. The worker writes them itself, straight into the columns (the numbers, the foot's path, the feet, the upper body, and the order of the steps in the
  // gait's own phases: happy_legs_phase), the way the page's sp.set_style would for the whole family (world.cpp, with no transition: a slot nobody is on is rewritten at once), and points the instance at it.
  //
  //   const GS = create({ fields: core.system.GAIT_FIELDS })      the order of the numbers of a gait (the HAPPY_SG_* order: kernel.js GAIT_FIELDS, the page's own list)
  //   const pool = GS.pool(fam, { base })      fam: the family's columns (columns.js); base: how many gaits the creature declared (slots from `base` up are the spare ones: the pool's)
  //   pool.add(plan) -> id          a style, as the plan of core.plan gave it (the tables kept as plain arrays: nothing is kept of the compile)        pool.size()  the styles that are known
  //   pool.slot(id) -> the slot the style is in now (-1: it is in none)      pool.load(id) -> its slot, written first if it was in none (a slot no live instance is on and that was used least long ago is taken); -1 when every spare slot is in use
  //   pool.write(slot, id)          the tables of a style written into a slot (pool.load does it)      pool.used(slot) -> true when a live instance is on it (gait_a or gait_b)
  //   pool.assign(s, slot)          an instance walks the slot at once      pool.fade(s, slot, seconds)      an instance goes to the slot over a time (an eased weight, written every frame by pool.step)
  //   pool.step(dt)                 the fades go on by dt      pool.fading(s) -> true while one is under way      pool.reset()      the family was built again (its columns are another's: nothing is in any slot)
  // A fade is the mix of two gaits, nothing else: the instance is on (a, b, t) and t goes from 0 to 1 by a smoothstep of the time; at the end it is on b alone. A fade asked for while one is under way goes on from where the instance is when it
  // can (to the gait it was going to: nothing changes; back to the one it left: the weights are turned round), and otherwise starts from the gait that has more of the instance (a jump of the half of what was left of the fade at most).
  // WHAT A SLOT DOES NOT HAVE: the reach of the legs (how far the rig can put a foot from its stance place) was measured for the first gait's ride height and stance, so a style whose hips ride much higher or lower than the first
  // gait's is walked with the first gait's reach (the page's sp.set_style measures it again and tells the page; a slot does not); and the body's top speed is the one the family was built with (give `body.max_speed` for styles that run).
  // Nothing in a frame is allocated: the fades are typed arrays and a list of the instances that have one. Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no class.
  const smooth = function (u) { return u <= 0 ? 0 : (u >= 1 ? 1 : u * u * (3 - 2 * u)); };
  const unsmooth = function (y) { return y <= 0 ? 0 : (y >= 1 ? 1 : 0.5 - Math.sin(Math.asin(1 - 2 * y) / 3)); };       // (the time at which a smoothstep has the weight y)

  function create(o) {
    if (!o || !Array.isArray(o.fields) || !o.fields.length) throw new Error("happy_worker_gait_slots: create({ fields }): the order of the numbers of a gait (core.system.GAIT_FIELDS)");
    const FIELDS = o.fields, NF = FIELDS.length;

    function pool(fam, opt) {
      const base = opt && opt.base !== undefined ? opt.base : 1;
      if (!Number.isInteger(base) || base < 1) throw new Error("happy_worker_gait_slots: pool: base is how many gaits the creature declared (1 or more)");
      let styles = [], resident = new Int32Array(16).fill(-1), serial = 0, tick = 0;
      let used_at = new Float64Array(0), owner = new Int32Array(0);
      let fade_dur = new Float32Array(0), fade_t = new Float32Array(0), fade_on = new Uint8Array(0), fade_gen = new Uint16Array(0), active = new Int32Array(0), n_active = 0;
      const P = {};

      // the family as it is now: a column that is not there is the wrong kind of family (no legs, a family built before the columns had these)
      const ready = function () {
        if (!fam.live) throw new Error("happy_worker_gait_slots: the family is not there");
        if (fam.GAIT_A === null || fam.GAIT_NUM === null || fam.GAIT_PH === null) throw new Error("happy_worker_gait_slots: the family has no legs (no gait to write a style into)");
        if (fam.GAIT_NUM_N !== NF) throw new Error("happy_worker_gait_slots: the worker's gait has " + fam.GAIT_NUM_N + " numbers and this file " + NF + " (body.cpp and kernel.js GAIT_FIELDS are not of one version)");
        if (serial !== fam.serial) {                                                                    // (built again: nothing the pool did is in the new table)
          serial = fam.serial;
          for (let i = 0; i < resident.length; i++) resident[i] = -1;
          const total = fam.GAIT_COUNT[0];
          used_at = new Float64Array(total); owner = new Int32Array(total).fill(-1);
          fade_dur = new Float32Array(fam.max); fade_t = new Float32Array(fam.max); fade_on = new Uint8Array(fam.max); fade_gen = new Uint16Array(fam.max); active = new Int32Array(fam.max); n_active = 0;
          if (total <= base) { /* no spare slot: load() answers -1 */ }
        }
      };

      // a plan, kept as plain arrays (what write() needs and nothing of the compile)
      P.add = function (plan) {
        if (!plan || !plan.lg || !plan.lg.gaits || plan.n === undefined) throw new Error("happy_worker_gait_slots: add(plan): the plan of core.plan(h, style, { gait })");
        const g = plan.lg.gaits[plan.n], up = plan.lg.uppers[plan.n], ft = plan.lg.feets[plan.n];
        if (!g) throw new Error("happy_worker_gait_slots: add: the plan has no gait " + plan.n);
        const nums = new Float32Array(NF);
        for (let i = 0; i < NF; i++) { const v = g.numbers[FIELDS[i]]; if (typeof v !== "number") throw new Error("happy_worker_gait_slots: add: the plan's gait has no number '" + FIELDS[i] + "'"); nums[i] = v; }
        let path = null;
        if (g.path && g.path.length) { path = new Float32Array(g.path.length * 4); for (let k = 0; k < path.length; k++) path[k] = g.path[(k / 4) | 0][k % 4]; }
        const st = {
          name: plan.name, nums: nums, path: path, np: path ? g.path.length : 0,
          up: plan.with_upper && up ? { mask: up.mask >>> 0, ref: up.ref, table: new Float32Array(up.table) } : null, with_upper: !!plan.with_upper,
          feet: plan.with_feet && ft ? { mask: ft.mask >>> 0, table: new Float32Array(ft.table) } : null, with_feet: !!plan.with_feet,
          phases: new Float32Array(plan.phases || plan.lg.legs.map(function (p) { return p.phase; }))
        };
        styles.push(st);
        if (styles.length > resident.length) { const r = new Int32Array(resident.length * 2).fill(-1); r.set(resident); resident = r; }
        return styles.length - 1;
      };
      P.size = function () { return styles.length; };
      P.number = function (id, field) { const st = id >= 0 && id < styles.length ? styles[id] : null, k = FIELDS.indexOf(field); return st && k >= 0 ? st.nums[k] : NaN; };       // (a number of a style as it was made for this creature: its `speed`, its `stride` ...)
      // a style that nothing will ask for again (a slider that is being dragged makes a style at every value): its entry is let go; the slot it was in stays as it is until nobody is on it and a style is wanted (the least recently used goes)
      P.drop = function (id) { if (id >= 0 && id < styles.length) { styles[id] = null; resident[id] = -1; } };
      P.slot = function (id) { return id >= 0 && id < styles.length ? resident[id] : -1; };

      P.used = function (slot) {
        const A = fam.GAIT_A, B = fam.GAIT_B, AL = fam.ALIVE, n = fam.max;
        for (let s = 0; s < n; s++) if (AL[s] && (A[s] === slot || B[s] === slot)) return true;
        return false;
      };

      // the tables of a style into a slot: world.cpp's "at once" (the numbers, the path as happy_style_write_path has it, the upper body, the feet), with the phases in the gait's own and the family's flags counted again (happy_style_recount)
      P.write = function (slot, id) {
        ready();
        const total = fam.GAIT_COUNT[0];
        if (!(slot >= base && slot < total) || slot !== (slot | 0)) throw new Error("happy_worker_gait_slots: write: " + slot + " is not a spare slot (" + base + " .. " + (total - 1) + ")");
        const st = styles[id];
        if (!st) throw new Error("happy_worker_gait_slots: write: no style " + id);
        const nl = fam.NLEGS, N = NF * slot, PN = fam.GAIT_PATH_N, PB = PN * slot;
        const G = fam.GAIT_NUM;
        for (let i = 0; i < NF; i++) G[N + i] = st.nums[i];
        const GP = fam.GAIT_PATH, DP = fam.DEFAULT_PATH;
        if (st.np === 0) { for (let k = 0; k < PN; k++) GP[PB + k] = k < 16 ? DP[k] : 0; fam.GAIT_NPATH[slot] = 4; }
        else { for (let k = 0; k < PN; k++) GP[PB + k] = k < st.np * 4 ? st.path[k] : 0; fam.GAIT_NPATH[slot] = st.np; }
        const UN = fam.UP_N, UB = UN * slot;
        if (st.up) { fam.UP_MASK[slot] = st.up.mask; fam.UP_REF[slot] = st.up.ref; for (let k = 0; k < UN; k++) fam.UP[UB + k] = st.up.table[k]; }
        else { fam.UP_MASK[slot] = 0; fam.UP_REF[slot] = 0; for (let k = 0; k < UN; k++) fam.UP[UB + k] = 0; }
        const FN = fam.FEET_N, FB = FN * slot;
        if (st.feet) { fam.FEET_MASK[slot] = st.feet.mask; for (let k = 0; k < FN; k++) fam.FEET[FB + k] = st.feet.table[k]; }
        else { fam.FEET_MASK[slot] = 0; for (let k = 0; k < FN; k++) fam.FEET[FB + k] = 0; }
        const PH = fam.GAIT_PH, HB = fam.GAIT_PH_N * slot;
        for (let k = 0; k < nl; k++) PH[HB + k] = st.phases[k];
        fam.GAIT_PH_ON[slot] = 1; fam.PH_ANY[0] = 1;
        let any_up = 0, any_feet = 0;
        for (let g = 0; g < total; g++) { if (fam.UP_MASK[g] !== 0) any_up = 1; if (fam.FEET_MASK[g] !== 0) any_feet = 1; }
        fam.HAS_UPPER[0] = any_up; fam.HAS_FEET[0] = any_feet;
      };

      P.load = function (id) {
        ready();
        if (!styles[id]) throw new Error("happy_worker_gait_slots: load: the style " + id + " is not known (it was dropped)");
        const at = resident[id];
        if (at >= 0) { used_at[at] = ++tick; return at; }
        const total = fam.GAIT_COUNT[0];
        let pick = -1, best = Infinity;
        for (let g = base; g < total; g++) {
          if (owner[g] < 0) { pick = g; break; }                                                    // (a slot that has never been written)
          if (used_at[g] < best && !P.used(g)) { best = used_at[g]; pick = g; }
        }
        if (pick < 0) return -1;
        if (owner[pick] >= 0) resident[owner[pick]] = -1;
        P.write(pick, id);
        owner[pick] = id; resident[id] = pick; used_at[pick] = ++tick;
        return pick;
      };

      // ---- the instances
      P.assign = function (s, slot) {
        ready();
        fam.GAIT_A[s] = slot; fam.GAIT_B[s] = slot; fam.GAIT_T[s] = 0;
        if (fade_on[s]) { fade_on[s] = 0; drop(s); }
      };
      const drop = function (s) {                                                                    // (the instance leaves the list of the fades: the last one takes its place)
        for (let i = 0; i < n_active; i++) if (active[i] === s) { active[i] = active[--n_active]; return; }
      };
      P.fading = function (s) { return fade_on[s] === 1; };
      P.fade = function (s, slot, seconds) {
        ready();
        if (!(seconds > 0)) { P.assign(s, slot); return; }
        const A = fam.GAIT_A, B = fam.GAIT_B, T = fam.GAIT_T;
        let a = A[s], b = B[s], t = T[s];
        if (a !== b && t > 0) {                                                                      // (one is under way, or was left half way)
          if (slot === b) { fade_gen[s] = fam.GEN[s]; return; }                                      // (to the gait it is going to: nothing changes)
          if (slot === a) { A[s] = b; B[s] = a; T[s] = 1 - t; fade_dur[s] = seconds; fade_t[s] = unsmooth(1 - t); fade_gen[s] = fam.GEN[s]; if (!fade_on[s]) { fade_on[s] = 1; active[n_active++] = s; } return; }
          a = t >= 0.5 ? b : a;                                                                      // (a third gait: from the one that has more of it)
        } else if (a === slot && b === slot) { return; }
        A[s] = a; B[s] = slot; T[s] = 0;
        fade_dur[s] = seconds; fade_t[s] = 0; fade_gen[s] = fam.GEN[s];
        if (!fade_on[s]) { fade_on[s] = 1; active[n_active++] = s; }
      };
      P.step = function (dt) {
        if (n_active === 0) return;
        const A = fam.GAIT_A, B = fam.GAIT_B, T = fam.GAIT_T, AL = fam.ALIVE, GE = fam.GEN;
        for (let i = 0; i < n_active; i++) {
          const s = active[i];
          if (!AL[s] || GE[s] !== fade_gen[s]) { fade_on[s] = 0; active[i] = active[--n_active]; i--; continue; }      // (the instance is gone, or its slot is another's)
          const u = fade_t[s] + dt / fade_dur[s];
          if (u >= 1) { A[s] = B[s]; T[s] = 0; fade_on[s] = 0; active[i] = active[--n_active]; i--; continue; }
          fade_t[s] = u; T[s] = smooth(u);
        }
      };
      P.reset = function () { serial = 0; n_active = 0; };
      P.base = base;
      return P;
    }
    return { pool: pool, FIELDS: FIELDS };
  }

  return { create: create };
});

// ========================================================================================================================
// worker_goap
// ========================================================================================================================
packing()("happy_worker_goap", function happy_worker_goap() {
  "use strict";
  // HAPPY WORKER GOAP: the PLANNER of goal-oriented creatures (world/blocks/goals.js is the block that uses it; SYSTEM.md "Goals and plans"). A pure service: it knows no creature, no world and no block, only a problem written in
  // symbols. A PROBLEM has FACTS (symbols that are true now; every other symbol is false), ACTIONS (each: what must hold before, what it makes true or false, what it costs) and a GOAL (symbols and the values they must have). The
  // planner finds the CHEAPEST list of actions that takes the facts to a state where the goal holds: A* over the states, a state being the set of symbols that are true.
  //   const G = create()      const P = G.problem()
  //   P.fact("hungry")                                  true now                         P.fact("at_table", false)  (the default: a symbol that was not said is false)
  //   P.action({ name: "go_to_table", pre: { }, eff: { at_table: true }, cost: 4 })  -> its index      pre / eff: { symbol: bool }; cost: a number above 0 (the least is 0.001)
  //   P.goal({ hungry: false })                         every symbol of it must have its value
  //   const r = P.solve({ max_nodes: 2000, max_cost: 1e9 })   -> { ok, steps: [indices of the actions, in order], cost, nodes, reason }
  //   reason (when not ok): "satisfied" (nothing to do: ok is true with no steps), "unreachable: <symbol>" (no action makes it so: told at once, nothing searched), "no plan" (the search ran out of states), "budget" (it ran out of nodes or of cost)
  //   ENUM VARIABLES: P.enum("at", ["door", "table", "stove"])   a variable with one of several values, in as few bits as they need (6 bits for 60 places, not 60 symbols); the first value is the one it has when no fact says otherwise
  //     P.fact("at", "door")     pre: { at: "table" }     eff: { at: "stove" }     goal: { at: "stove" }       a symbol and an enum may be mixed in one pre / eff / goal; an enum's value that was not declared is thrown with the names that were
  //   GROUPS: P.group("places", ["at:door", "at:table"])   a set of symbols of which an action can say that it MAKES THEM ALL FALSE:  P.action({ name, pre, eff: { "at:stove": true }, clears: "places", cost })   (what a step that goes somewhere is: every other place is false
  //     now; writing it as an effect for each place is the square of the places, a group is one mask)
  // At most SYMBOLS (53) different symbols in one problem: the states are numbers of 53 bits (a lo word of 32 bits and a hi word of 21), the key of a state in the closed table is that number (an enum takes the bits of its values). A mistake (an unknown key, a cost that is not a
  // number, too many symbols) is thrown with its name. An action whose pre has a symbol the facts never mention and no action makes true can never run: the search says so by not using it.
  // Node 14: no optional chaining, no ??. ES5 style.
  var SYMBOLS = 53, TWO32 = 4294967296, MIN_COST = 0.001;

  function create() {
    var G = { SYMBOLS: SYMBOLS };

    G.problem = function () {
      var P = {}, names = [], ids = Object.create(null);
      var facts_lo = 0, facts_hi = 0;
      var acts = [];                                                                                     // { name, cost, pl, ph (pre mask), vl, vh (pre values), el, eh (eff mask), fl, fh (eff values) }
      var goal = null;                                                                                   // { ml, mh, vl, vh }

      var sym = function (name) {
        var i = ids[name];
        if (i !== undefined) return i;
        if (typeof name !== "string" || name === "") throw new Error("happy_worker_goap: a symbol is a text (" + String(name) + ")");
        if (names.length >= SYMBOLS) throw new Error("happy_worker_goap: at most " + SYMBOLS + " symbols in one problem (`" + name + "` is one too many: " + names.slice(0, 6).join(", ") + " ...)");
        i = names.length; names.push(name); ids[name] = i;
        return i;
      };
      P.sym = sym;
      P.names = function () { return names.slice(); };
      var enums = Object.create(null), groups = Object.create(null);                                         // enums: { bits: [bit numbers], values: [names], index: { name: n } }; groups: { ml, mh }
      P.enum = function (name, values) {
        var k = 0, bits = [], i, e;
        if (typeof name !== "string" || name === "") throw new Error("happy_worker_goap: an enum has a name (a text)");
        if (ids[name] !== undefined || enums[name] !== undefined) throw new Error("happy_worker_goap: `" + name + "` is a symbol or an enum already");
        if (!Array.isArray(values) || values.length < 2 || values.some(function (v) { return typeof v !== "string"; }) || values.some(function (v, j) { return values.indexOf(v) !== j; })) throw new Error("happy_worker_goap: enum " + name + ": its values are a list of two or more different texts");
        while ((1 << k) < values.length) k++;
        for (i = 0; i < k; i++) bits.push(sym(name + "#" + i));
        e = { bits: bits, values: values.slice(), index: Object.create(null) };
        values.forEach(function (v, j) { e.index[v] = j; });
        enums[name] = e;
        return P;
      };
      var enum_value = function (e, name, v, owner) {
        var j = typeof v === "string" ? e.index[v] : undefined;
        if (j === undefined) throw new Error("happy_worker_goap: " + owner + ": `" + String(v) + "` is not a value of the enum " + name + " (" + e.values.join(", ") + ")");
        return j;
      };
      P.group = function (name, symbols) {
        var g = { ml: 0, mh: 0 }, m = [0, 0], i;
        if (typeof name !== "string" || name === "") throw new Error("happy_worker_goap: a group has a name (a text)");
        if (!Array.isArray(symbols)) throw new Error("happy_worker_goap: group " + name + ": its symbols are a list");
        for (i = 0; i < symbols.length; i++) { if (enums[symbols[i]] !== undefined) throw new Error("happy_worker_goap: group " + name + ": `" + symbols[i] + "` is an enum (a group is of symbols)"); put(m, sym(symbols[i]), true); }
        g.ml = m[0]; g.mh = m[1];
        groups[name] = g;
        return P;
      };
      var put = function (lo_hi, i, v) {                                                                    // set bit i of the pair [lo, hi] to v
        if (i < 32) { lo_hi[0] = v ? (lo_hi[0] | (1 << i)) >>> 0 : (lo_hi[0] & ~(1 << i)) >>> 0; } else { lo_hi[1] = v ? (lo_hi[1] | (1 << (i - 32))) >>> 0 : (lo_hi[1] & ~(1 << (i - 32))) >>> 0; }
      };
      var mask_of = function (what, map, owner) {                                                          // { symbol: bool } -> masks [ml, mh] and values [vl, vh]
        var m = [0, 0], v = [0, 0], k, val;
        if (map === undefined || map === null) return { ml: 0, mh: 0, vl: 0, vh: 0 };
        if (typeof map !== "object" || Array.isArray(map)) throw new Error("happy_worker_goap: " + owner + ": " + what + " is an object { symbol: true | false }");
        for (k in map) {
          val = map[k];
          if (enums[k] !== undefined) {                                                                      // (an enum: all its bits are said, the value is their number)
            var e = enums[k], n = enum_value(e, k, val, owner + ": " + what), b;
            for (b = 0; b < e.bits.length; b++) { put(m, e.bits[b], true); put(v, e.bits[b], ((n >> b) & 1) === 1); }
            continue;
          }
          if (typeof val !== "boolean") throw new Error("happy_worker_goap: " + owner + ": " + what + "." + k + " is true or false (" + String(val) + ")");
          var i = sym(k);
          put(m, i, true); put(v, i, val);
        }
        return { ml: m[0], mh: m[1], vl: v[0], vh: v[1] };
      };

      P.fact = function (name, value) {
        if (enums[name] !== undefined) {                                                                     // (an enum has the value that is said)
          var e = enums[name], n = enum_value(e, name, value, "fact"), c = [facts_lo, facts_hi], q;
          for (q = 0; q < e.bits.length; q++) put(c, e.bits[q], ((n >> q) & 1) === 1);
          facts_lo = c[0]; facts_hi = c[1];
          return P;
        }
        var i = sym(name), b = [facts_lo, facts_hi];
        put(b, i, value === undefined ? true : !!value);
        facts_lo = b[0]; facts_hi = b[1];
        return P;
      };
      P.action = function (def) {
        var k, name;
        if (!def || typeof def !== "object") throw new Error("happy_worker_goap: an action is an object { name, pre, eff, cost }");
        for (k in def) if (k !== "name" && k !== "pre" && k !== "eff" && k !== "cost" && k !== "clears") throw new Error("happy_worker_goap: action " + String(def.name) + ": '" + k + "' is not a key of an action (name, pre, eff, cost, clears)");
        name = def.name === undefined ? "action" + acts.length : String(def.name);
        var cost = def.cost === undefined ? 1 : def.cost;
        if (typeof cost !== "number" || !(cost === cost)) throw new Error("happy_worker_goap: action " + name + ": cost is a number (" + String(cost) + ")");
        var pre = mask_of("pre", def.pre, name), eff = mask_of("eff", def.eff, name);
        if (eff.ml === 0 && eff.mh === 0) throw new Error("happy_worker_goap: action " + name + ": eff is empty (an action that changes nothing is of no use to a plan)");
        var gr = def.clears === undefined ? null : groups[def.clears];
        if (def.clears !== undefined && !gr) throw new Error("happy_worker_goap: action " + name + ": `" + String(def.clears) + "` is not a group (P.group first)");
        acts.push({ name: name, cost: cost < MIN_COST ? MIN_COST : cost, pl: pre.ml, ph: pre.mh, vl: pre.vl, vh: pre.vh, el: (eff.ml | (gr ? gr.ml : 0)) >>> 0, eh: (eff.mh | (gr ? gr.mh : 0)) >>> 0, fl: eff.vl, fh: eff.vh });          // (a group is in the mask and false in the values, unless the action's own effect says a member true)
        return acts.length - 1;
      };
      P.goal = function (map) {
        var g = mask_of("goal", map, "goal");
        if (g.ml === 0 && g.mh === 0) throw new Error("happy_worker_goap: the goal is empty");
        goal = g;
        return P;
      };
      P.action_name = function (i) { return acts[i] ? acts[i].name : ""; };
      P.count = function () { return acts.length; };

      // ---- the search
      var popcount = function (x) { x = x - ((x >>> 1) & 0x55555555); x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
      P.solve = function (o) {
        o = o || {};
        var max_nodes = o.max_nodes > 0 ? o.max_nodes : 2000, max_cost = o.max_cost > 0 ? o.max_cost : 1e9;
        if (goal === null) throw new Error("happy_worker_goap: no goal (P.goal)");
        var gl = goal.ml, gh = goal.mh, vl = goal.vl, vh = goal.vh, n = acts.length, i, j;
        // already true
        if ((((facts_lo ^ vl) & gl) >>> 0) === 0 && (((facts_hi ^ vh) & gh) >>> 0) === 0) return { ok: true, steps: [], cost: 0, nodes: 0, reason: "satisfied" };
        // the cheapest action that makes each goal symbol what the goal wants: the heuristic is the dearest of the ones still wrong (one action is needed for each, at least, and the cheapest of them is a bound)
        var gbits = [], gval = [], gach = [];
        for (i = 0; i < SYMBOLS; i++) {
          var inl = i < 32, bit = inl ? (1 << i) : (1 << (i - 32)), want_m = inl ? gl : gh;
          if ((want_m & bit) === 0) continue;
          var want_v = ((inl ? vl : vh) & bit) !== 0, best = Infinity;
          for (j = 0; j < n; j++) {
            var a = acts[j], em = inl ? a.el : a.eh;
            if ((em & bit) !== 0 && ((((inl ? a.fl : a.fh) & bit) !== 0) === want_v) && a.cost < best) best = a.cost;
          }
          gbits.push(i); gval.push(want_v); gach.push(best);
        }
        for (i = 0; i < gbits.length; i++) {
          var b2 = gbits[i], cur = b2 < 32 ? (((facts_lo >>> b2) & 1) === 1) : (((facts_hi >>> (b2 - 32)) & 1) === 1);
          if (cur !== gval[i] && gach[i] === Infinity) return { ok: false, steps: [], cost: 0, nodes: 0, reason: "unreachable: " + names[b2] };
        }
        var h = function (lo, hi) {
          var worst = 0, q, b, cur;
          for (q = 0; q < gbits.length; q++) {
            b = gbits[q];
            cur = b < 32 ? (((lo >>> b) & 1) === 1) : (((hi >>> (b - 32)) & 1) === 1);
            if (cur !== gval[q] && gach[q] > worst) worst = gach[q];
          }
          return worst;
        };
        // the nodes: the state (lo, hi), the cost so far, the node it came from and the action that made it; the open list is a binary heap of node numbers by f = g + h
        var nlo = [], nhi = [], ng = [], nf = [], npar = [], nact = [], heap = [], closed = Object.create(null);
        var key = function (lo, hi) { return hi * TWO32 + lo; };
        var push = function (node) {
          heap.push(node);
          var c = heap.length - 1, p, t;
          while (c > 0) { p = (c - 1) >> 1; if (nf[heap[p]] < nf[heap[c]] || (nf[heap[p]] === nf[heap[c]] && ng[heap[p]] >= ng[heap[c]])) break; t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p; }
        };
        var pop = function () {
          var top = heap[0], last = heap.pop(), c = 0, l, r, m, t;
          if (heap.length > 0) {
            heap[0] = last;
            for (;;) {
              l = 2 * c + 1; r = l + 1; m = c;
              if (l < heap.length && (nf[heap[l]] < nf[heap[m]] || (nf[heap[l]] === nf[heap[m]] && ng[heap[l]] > ng[heap[m]]))) m = l;
              if (r < heap.length && (nf[heap[r]] < nf[heap[m]] || (nf[heap[r]] === nf[heap[m]] && ng[heap[r]] > ng[heap[m]]))) m = r;
              if (m === c) break;
              t = heap[m]; heap[m] = heap[c]; heap[c] = t; c = m;
            }
          }
          return top;
        };
        nlo.push(facts_lo); nhi.push(facts_hi); ng.push(0); nf.push(h(facts_lo, facts_hi)); npar.push(-1); nact.push(-1);
        push(0);
        closed[key(facts_lo, facts_hi)] = 0;
        var expanded = 0, node, lo, hi, g, a2, nl, nh, ng2, k2, old, goal_hit, cost_cut = false;
        while (heap.length > 0) {
          node = pop();
          lo = nlo[node]; hi = nhi[node]; g = ng[node];
          if (closed[key(lo, hi)] < g) continue;                                                           // (a cheaper way to this state was found after this node was pushed)
          goal_hit = (((lo ^ vl) & gl) >>> 0) === 0 && (((hi ^ vh) & gh) >>> 0) === 0;
          if (goal_hit) {
            var steps = [], q2 = node;
            while (npar[q2] >= 0) { steps.push(nact[q2]); q2 = npar[q2]; }
            steps.reverse();
            return { ok: true, steps: steps, cost: g, nodes: expanded, reason: "" };
          }
          if (++expanded > max_nodes) return { ok: false, steps: [], cost: 0, nodes: expanded, reason: "budget" };
          for (i = 0; i < n; i++) {
            a2 = acts[i];
            if ((((lo ^ a2.vl) & a2.pl) >>> 0) !== 0 || (((hi ^ a2.vh) & a2.ph) >>> 0) !== 0) continue;      // (a precondition does not hold)
            nl = ((lo & ~a2.el) | (a2.fl & a2.el)) >>> 0; nh = ((hi & ~a2.eh) | (a2.fh & a2.eh)) >>> 0;
            if (nl === lo && nh === hi) continue;                                                           // (it changes nothing here)
            ng2 = g + a2.cost;
            if (ng2 > max_cost) { cost_cut = true; continue; }
            k2 = key(nl, nh); old = closed[k2];
            if (old !== undefined && old <= ng2) continue;
            closed[k2] = ng2;
            nlo.push(nl); nhi.push(nh); ng.push(ng2); nf.push(ng2 + h(nl, nh)); npar.push(node); nact.push(i);
            push(nlo.length - 1);
          }
        }
        return { ok: false, steps: [], cost: 0, nodes: expanded, reason: cost_cut ? "budget" : "no plan" };
      };
      return P;
    };
    return G;
  }
  return { create: create, SYMBOLS: SYMBOLS };
});

// ========================================================================================================================
// worker_grab
// ========================================================================================================================
packing()("happy_worker_grab", function happy_worker_grab() {
  "use strict";
  // HAPPY WORKER GRAB: a creature's brain picks a body of the physics world up, carries it, puts it down or throws it (SYSTEM.md "Grips and carrying"; the page's twin is species.js sp.grab). The wasm half is world.cpp:
  // a GRIP is a hand that holds a body, and the worker's frame puts the body where the hand carries it. This is the half that decides WHEN: walk up to the body, reach its two sides, hold it, lift it, carry it, put it down
  // or throw it. A brain says `me.grab(body, o)` (pure.js) once and asks `me.grab_state()` at its visits; the task is stepped by the worker every frame, because a hand that is reached with must be told every
  // frame (the worker holds a hand 30 frames, then lets the arm go) and a lift is smooth over 0.6 s whatever the rate of the tree.
  //
  //   const G = create(host)     host: { D (pure.js), K (the constants), arms(ctx) -> [{ j, side, length }] (the arms the creature has: the action plan's), grip: the wasm's half: { cmd(js, slot, gen, arm, op, body, x, y, z, flags) -> 0 or HAPPY_ERR_*,
  //                                held(js, slot, arm) -> bool, heavy() -> how many attaches were refused for weight so far, body(id) -> the body's record or null, load(js, slot) -> kg in the hands }, fingers(ctx, slot, arm, curl, o) (optional: the hand's fingers close, curl 0 .. 1) }
  //   G.begin(ctx, slot, body, o) -> true when the task began (the instance has the arms, the body is there)      o: { arms: "both" (default) | "nearest" | "left" | "right", half: metres (the body's own: x, y, z), approach: false, lean: true,
  //                                crouch: true, timeout: 8, follow: 0 (the hand's own turn is the body's, 0 .. 1), curl (how far the fingers close on it, 0 .. 1: 0.35, 0.8 when follow is more than a half; a creature with finger bones: host.fingers), out, up, ahead (the carry pose, in arm lengths: 0.15, -0.5, from the body's depth) }
  //   G.step(ctx, dt, max)       once a frame, when G.count(ctx) > 0
  //   G.state(ctx, slot) G.why(ctx, slot) G.body(ctx, slot)      what the task is and why it failed
  //   G.put_down(ctx, slot, ahead, y)   G.throw_held(ctx, slot, speed, up)   G.let_go(ctx, slot)   G.cancel(ctx, slot)
  //
  // THE STATES (what me.grab_state() says): 0 none, 1 APPROACH (walking up to it: `approach: true` only), 2 REACH (the hands go to the body's sides: the body leans and crouches for a low one), 3 LIFT (held; the hands go to the
  // carry pose over 0.6 s and the body rises with them), 4 CARRY (the hands hold the carry pose: the brain walks where it likes), 5 LOWER (put down: the hands take it to the floor ahead of the creature), 6 DONE (ended well:
  // put down, thrown, let go), 7 FAILED. A task that is DONE or FAILED stays so until the next `me.grab` or `me.grab_clear`. THE REASONS (me.grab_why()): 1 out of reach (the arms gave up for half a second), 2 timeout, 3 lost it
  // (the grip ended by itself: the body was taken from the world, the creature went far), 4 cancelled, 5 too heavy (it weighs more than the creature), 6 the body is gone, 7 the creature has no arm for it, 8 stuck (the creature
  // could not walk up to it).
  // Nothing allocates in a frame. Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no class.
  var S_NONE = 0, S_APPROACH = 1, S_REACH = 2, S_LIFT = 3, S_CARRY = 4, S_LOWER = 5, S_DONE = 6, S_FAILED = 7;
  var W_NONE = 0, W_REACH = 1, W_TIMEOUT = 2, W_LOST = 3, W_CANCELLED = 4, W_HEAVY = 5, W_GONE = 6, W_NO_ARM = 7, W_STUCK = 8;
  var ARMS_BOTH = 0, ARMS_NEAREST = 1, ARMS_LEFT = 2, ARMS_RIGHT = 3;
  var LIFT_T = 0.6, LOWER_T = 0.7, STILL_T = 0.25, BAD_T = 0.5, STUCK_T = 3;
  var STATES = { NONE: S_NONE, APPROACH: S_APPROACH, REACH: S_REACH, LIFT: S_LIFT, CARRY: S_CARRY, LOWER: S_LOWER, DONE: S_DONE, FAILED: S_FAILED };
  var WHY = { NONE: W_NONE, REACH: W_REACH, TIMEOUT: W_TIMEOUT, LOST: W_LOST, CANCELLED: W_CANCELLED, HEAVY: W_HEAVY, GONE: W_GONE, NO_ARM: W_NO_ARM, STUCK: W_STUCK };
  var NAN = 0 / 0;
  var smooth = function (x) { x = x < 0 ? 0 : (x > 1 ? 1 : x); return x * x * (3 - 2 * x); };

  function create(host) {
    var D = host.D, K = host.K, grip = host.grip, G = { S: STATES, W: WHY }, close_hand = host.fingers || null;
    var AS_RST = K.AS_RST, qx = 0, qy = 0, qz = 0;                                                         // (scratch: a rotated vector)

    // what a family keeps of the tasks of its instances: typed columns of the family's size, made when the first task begins
    function rec_of(ctx) {
      var r = ctx.gb, n;
      if (r) return r;
      n = ctx.max;
      r = ctx.gb = { n: 0, st: new Uint8Array(n), why: new Uint8Array(n), mask: new Uint8Array(n), mode: new Uint8Array(n), flags: new Uint8Array(n), gen: new Uint16Array(n), body: new Int32Array(n).fill(-1),
        time: new Float32Array(n), ph: new Float32Array(n), still: new Float32Array(n), bad: new Float32Array(n), stuck: new Float32Array(n), best: new Float32Array(n), timeout: new Float32Array(n),
        hx: new Float32Array(n), hy: new Float32Array(n), hz: new Float32Array(n), out: new Float32Array(n), up: new Float32Array(n), ahead: new Float32Array(n), follow: new Float32Array(n),
        dahead: new Float32Array(n), dy: new Float32Array(n), fx: new Float32Array(n), fy: new Float32Array(n), fz: new Float32Array(n), picked: new Uint8Array(n), floored: new Uint8Array(n), curl: new Float32Array(n), closed: new Uint8Array(n),
        farp: new Uint8Array(n) };                                                                          // (farp: 1 while the grips have the FAR carry pose)
      return r;
    }
    var active = function (st) { return st >= S_APPROACH && st <= S_LOWER; };
    // the root's turn rotates (x, y, z) into (qx, qy, qz) (scratch); the quaternion is read from the family's column at offset o
    var rot = function (R, o, x, y, z) {
      var a = R[o + 4], b = R[o + 5], c = R[o + 6], w = R[o + 7];
      var cx = b * z - c * y + w * x, cy = c * x - a * z + w * y, cz = a * y - b * x + w * z;
      qx = x + 2 * (b * cz - c * cy); qy = y + 2 * (c * cx - a * cz); qz = z + 2 * (a * cy - b * cx);
    };
    var arm_of = function (arms, j) { for (var i = 0; i < arms.length; i++) if (arms[i].j === j) return arms[i]; return null; };

    G.count = function (ctx) { return ctx.gb ? ctx.gb.n : 0; };
    G.state = function (ctx, s) { return ctx.gb ? ctx.gb.st[s] : 0; };
    G.why = function (ctx, s) { return ctx.gb ? ctx.gb.why[s] : 0; };
    G.body = function (ctx, s) { var r = ctx.gb; return r && r.st[s] >= S_LIFT && r.st[s] <= S_LOWER ? r.body[s] : -1; };

    // the hands go: the world reach and the page's hand layer are let go (eased out, in place)
    var hands_off = function (ctx, s) {
      var r = ctx.gb, fam = ctx.fam, m = r.mask[s], j;
      for (j = 0; j < 8; j++) if ((m & (1 << j)) !== 0) {
        D.hand(fam, s, j, 2, 0, 0, 0, 0, 0, 0); D.hand(fam, s, j, 1, 0, 0, 0, 0, 0, 0);
        if ((r.closed[s] & (1 << j)) !== 0 && close_hand !== null) close_hand(ctx, s, j, 0, null);              // (the fingers that closed on it open again)
      }
      r.closed[s] = 0;
    };
    var finish = function (ctx, s, st, why) {
      var r = ctx.gb;
      if (active(r.st[s])) r.n--;
      r.st[s] = st; r.why[s] = why;
    };
    var fail = function (ctx, s, why) { hands_off(ctx, s); finish(ctx, s, S_FAILED, why); };

    G.begin = function (ctx, s, body, o) {
      var r = rec_of(ctx), fam = ctx.fam, arms = host.arms(ctx), info = grip.body(body), a, i, m = 0, mode;
      o = o || {};
      if (!info || !arms || arms.length === 0) return false;
      if (active(r.st[s])) G.cancel(ctx, s);
      mode = o.arms === "nearest" ? ARMS_NEAREST : (o.arms === "left" ? ARMS_LEFT : (o.arms === "right" ? ARMS_RIGHT : ARMS_BOTH));
      for (i = 0; i < arms.length; i++) {
        a = arms[i];
        if (mode === ARMS_BOTH || (mode === ARMS_LEFT && a.side > 0) || (mode === ARMS_RIGHT && a.side < 0)) m |= 1 << a.j;
      }
      r.mode[s] = mode; r.mask[s] = m;                                                                   // ('nearest' has no arm yet: it is chosen when the body's side is known, at the first step)
      if (m === 0 && mode !== ARMS_NEAREST) { r.st[s] = S_FAILED; r.why[s] = W_NO_ARM; r.gen[s] = fam.GEN[s]; return false; }
      r.body[s] = body; r.gen[s] = fam.GEN[s]; r.time[s] = 0; r.ph[s] = 0; r.still[s] = 0; r.bad[s] = 0; r.stuck[s] = 0; r.best[s] = 1e9; r.why[s] = W_NONE; r.picked[s] = 0; r.floored[s] = 0;
      r.timeout[s] = o.timeout > 0 ? o.timeout : 8;
      r.flags[s] = (o.lean === false ? 0 : 4) | (o.crouch === false ? 0 : 16) | (o.approach ? 1 : 0);
      r.hx[s] = o.half > 0 ? o.half : (info[4] > 0.02 ? info[4] : 0.25); r.hy[s] = o.half > 0 ? o.half : (info[5] > 0.02 ? info[5] : 0.25); r.hz[s] = o.half > 0 ? o.half : (info[6] > 0.02 ? info[6] : 0.25);
      r.out[s] = o.out === undefined ? NAN : o.out; r.up[s] = o.up === undefined ? NAN : o.up; r.ahead[s] = o.ahead === undefined ? NAN : o.ahead;
      r.follow[s] = o.follow > 0 ? (o.follow > 1 ? 1 : o.follow) : 0;
      r.curl[s] = o.curl >= 0 ? (o.curl > 1 ? 1 : o.curl) : (r.follow[s] > 0.5 ? 0.8 : 0.35);                // (how far the fingers close on it)
      r.closed[s] = 0; r.farp[s] = 0;
      r.st[s] = (r.flags[s] & 1) !== 0 ? S_APPROACH : S_REACH;
      r.n++;
      return true;
    };

    // the arm a task uses when it was told `nearest`: the one on the body's side (the body's place along the creature's left, against the arm's side)
    var pick_nearest = function (ctx, s, arms, R, o, bp) {
      var r = ctx.gb, i, best = arms[0].j, bd = 1e9, l, d;
      rot(R, o, 1, 0, 0);
      l = (bp[0] - R[o]) * qx + (bp[2] - R[o + 2]) * qz;
      for (i = 0; i < arms.length; i++) { d = l - arms[i].side * 0.2; d = d < 0 ? -d : d; if (d < bd) { bd = d; best = arms[i].j; } }
      r.mask[s] = 1 << best;
    };

    var pose = function (ctx, s, arms, j, wt) {                                                         // the carry pose: the hand in the body's frame, in arm lengths from the shoulder
      var r = ctx.gb, a = arm_of(arms, j), out = isNaN(r.out[s]) ? 0.15 : r.out[s], up = isNaN(r.up[s]) ? -0.5 : r.up[s], L = a.length * ctx.fam.ROOT[s * 8 + 3] || 1, ah = r.ahead[s];
      if (isNaN(ah)) { ah = (0.2 + r.hz[s]) / L; ah = ah < 0.5 ? 0.5 : (ah > 0.78 ? 0.78 : ah); }
      D.hand(ctx.fam, s, j, 1, wt, a.side * out, up, ah, 0, 0);
    };
    // where hand j holds the body: its side (the body's own x axis, the end that is on the hand's side of the creature)
    var grasp = function (ctx, s, arms, j, bp, info, out3) {
      var r = ctx.gb, a = arm_of(arms, j), R = ctx.fam.ROOT, o = s * 8, ax = info[12], az = info[13], lat, sgn;
      rot(R, o, 1, 0, 0);                                                                              // (the creature's left, in the world)
      lat = ax * qx + az * qz;
      sgn = a.side * (lat >= 0 ? 1 : -1);
      out3[0] = bp[0] + sgn * ax * r.hx[s]; out3[1] = bp[1]; out3[2] = bp[2] + sgn * az * r.hx[s];
    };

    // THE FAR TIER. The arms of a far creature are not solved (they hang), so a hand never reaches a body and never holds the carry pose: the creature takes the body at once, no reach and no lift, and the grip carries it at a pose
    // of the creature's own frame that is made of the arm's length (the hand's rest place, up and ahead as the near carry pose is from the shoulder): x to the left, y up, z forward, from the hanging hand. The grip eases the body
    // there. A creature that comes near (or goes far) while it carries gets the pose of its tier (the near hand is at the body's side), the grip eases to it. The hand the body is held at is the root's, so it goes with the creature
    var hold_pose = function (ctx, s, arms, m, far) {
      var r = ctx.gb, fam = ctx.fam, gen = fam.GEN[s], sc = fam.ROOT[s * 8 + 3] || 1, j, a, L, ah;
      r.farp[s] = far ? 1 : 0;
      if (typeof grip.hold !== "function") return;                                                      // (a host without the hold commands: the body stays where it was taken)
      for (j = 0; j < 8; j++) {
        if ((m & (1 << j)) === 0 || (a = arm_of(arms, j)) === null) continue;
        L = a.length * sc || 1;
        if (far) {                                                                                       // (the near carry pose is `up` arm lengths from the shoulder, the hanging hand is one below it)
          ah = r.ahead[s];
          if (isNaN(ah)) { ah = (0.2 + r.hz[s]) / L; ah = ah < 0.5 ? 0.5 : (ah > 0.78 ? 0.78 : ah); }
          grip.hold(ctx.js, s, gen, j, 1, 0, (isNaN(r.up[s]) ? 0.5 : 1 + r.up[s]) * L, ah * L, 0, 0, 0);
        }
        else grip.hold(ctx.js, s, gen, j, 1, -a.side * r.hx[s], 0, 0, 0, 0, 0);
      }
    };
    var g3 = [0, 0, 0], bp3 = [0, 0, 0];
    var step_one = function (ctx, s, dt) {
      var r = ctx.gb, fam = ctx.fam, R = fam.ROOT, o = s * 8, st = r.st[s], arms = host.arms(ctx), info, js = ctx.js, gen = fam.GEN[s], m = r.mask[s], j, all_on, any_bad, k, a, heavy0, err, d, dx, dz, sp, sc = R[o + 3] || 1;
      if (!fam.ALIVE[s] || r.gen[s] !== gen) { finish(ctx, s, S_FAILED, W_GONE); return; }
      info = grip.body(r.body[s]);
      if (!info) { fail(ctx, s, W_GONE); return; }
      bp3[0] = info[1]; bp3[1] = info[2]; bp3[2] = info[3];
      r.time[s] += dt; r.ph[s] += dt;
      if (st === S_APPROACH) {
        dx = bp3[0] - R[o]; dz = bp3[2] - R[o + 2]; d = Math.sqrt(dx * dx + dz * dz);
        var stand = (0.3 * sc) + r.hz[s];                                                              // (how far from the body's middle: the arms' reach and the body's own depth)
        if (r.time[s] > r.timeout[s] + 6) { D.intent(fam, s, 0, 0, 0, 0); fail(ctx, s, W_STUCK); return; }
        if (d < r.best[s] - 0.05) { r.best[s] = d; r.stuck[s] = 0; } else r.stuck[s] += dt;
        if (r.stuck[s] > STUCK_T) { D.intent(fam, s, 0, 0, 0, 0); fail(ctx, s, W_STUCK); return; }
        if (d <= stand + 0.04) { D.intent(fam, s, 0, 0, dx / (d || 1), dz / (d || 1)); r.st[s] = S_REACH; r.time[s] = 0; r.ph[s] = 0; return; }
        sp = (d - stand) * 1.5 + 0.35 * sc; sp = sp > 1.4 * sc ? 1.4 * sc : sp;
        D.intent(fam, s, dx / d * sp, dz / d * sp, dx / d, dz / d);
        return;
      }
      if (r.mode[s] === ARMS_NEAREST && !r.picked[s]) { pick_nearest(ctx, s, arms, R, o, bp3); r.picked[s] = 1; m = r.mask[s]; }
      if (st === S_REACH && fam.TIER[s] === 0) {                                                       // (far: no reach, the body is taken at once and carried)
        for (j = 0; j < 8; j++) {
          if ((m & (1 << j)) === 0) continue;
          heavy0 = grip.heavy();
          err = grip.cmd(js, s, gen, j, 1, r.body[s], 0, 0, 0, 0);
          if (err !== 0) { for (k = 0; k < j; k++) if ((m & (1 << k)) !== 0) grip.cmd(js, s, gen, k, 2, 0, 0, 0, 0, 1); fail(ctx, s, grip.heavy() > heavy0 ? W_HEAVY : W_LOST); return; }
        }
        hold_pose(ctx, s, arms, m, true);
        r.st[s] = S_CARRY; r.ph[s] = 0;
        return;
      }
      if (st === S_REACH) {
        if (r.time[s] > r.timeout[s]) { fail(ctx, s, W_TIMEOUT); return; }
        all_on = true; any_bad = false;
        for (j = 0; j < 8; j++) {
          if ((m & (1 << j)) === 0) continue;
          grasp(ctx, s, arms, j, bp3, info, g3);
          D.hand(fam, s, j, 2 | (r.flags[s] & 20), 1, g3[0], g3[1], g3[2], 0, 0);
          k = fam.ARM_ST === null ? 0 : fam.ARM_ST[(s * fam.NARMS + j) * fam.ARM_NS + AS_RST];
          if (k !== 2) all_on = false;
          if (k === 3) any_bad = true;
        }
        r.bad[s] = any_bad ? r.bad[s] + dt : 0;
        if (r.bad[s] > BAD_T) { fail(ctx, s, W_REACH); return; }
        r.still[s] = all_on ? r.still[s] + dt : 0;
        if (r.still[s] > STILL_T) {
          for (j = 0; j < 8; j++) {
            if ((m & (1 << j)) === 0) continue;
            heavy0 = grip.heavy();
            err = grip.cmd(js, s, gen, j, 1, r.body[s], r.follow[s], 0, 0, 0);
            if (err !== 0) { for (k = 0; k < j; k++) if ((m & (1 << k)) !== 0) grip.cmd(js, s, gen, k, 2, 0, 0, 0, 0, 1); fail(ctx, s, grip.heavy() > heavy0 ? W_HEAVY : W_LOST); return; }
          }
          for (j = 0; j < 8; j++) if ((m & (1 << j)) !== 0 && close_hand !== null) { close_hand(ctx, s, j, r.curl[s], null); r.closed[s] |= 1 << j; }
          r.st[s] = S_LIFT; r.ph[s] = 0;
        }
        return;
      }
      // held from here: a grip that ended by itself (the body was taken, the creature went far) fails the task
      if (r.ph[s] >= 0.1) for (j = 0; j < 8; j++) if ((m & (1 << j)) !== 0 && !grip.held(js, s, j)) { fail(ctx, s, W_LOST); return; }
      if (st !== S_LOWER && (fam.TIER[s] === 0) !== (r.farp[s] === 1)) {                                  // (it went far or came near while it holds: the pose of the tier it is in)
        hold_pose(ctx, s, arms, m, fam.TIER[s] === 0);
        if (fam.TIER[s] === 0 && st === S_LIFT) { r.st[s] = S_CARRY; r.ph[s] = 0; st = S_CARRY; }
      }
      if (st === S_LOWER && fam.TIER[s] === 0) {                                                       // (far: put down where it is, gently: the body is let go and falls the little way to the floor)
        grip.cmd(js, s, gen, 255, 2, 0, 0, 0, 0, 1); hands_off(ctx, s); finish(ctx, s, S_DONE, W_NONE);
        return;
      }
      if (st === S_LIFT) {
        k = smooth(r.ph[s] / LIFT_T);
        for (j = 0; j < 8; j++) {
          if ((m & (1 << j)) === 0) continue;
          pose(ctx, s, arms, j, k);
          if (k < 1) { grasp(ctx, s, arms, j, bp3, info, g3); D.hand(fam, s, j, 2 | (r.flags[s] & 20), 1 - k, g3[0], g3[1], g3[2], 0, 0); }
          else D.hand(fam, s, j, 2, 0, 0, 0, 0, 0, 0);
        }
        if (k >= 1) { r.st[s] = S_CARRY; r.ph[s] = 0; }
      } else if (st === S_CARRY) {
        for (j = 0; j < 8; j++) if ((m & (1 << j)) !== 0) pose(ctx, s, arms, j, 1);
      } else if (st === S_LOWER) {
        k = smooth(r.ph[s] / LOWER_T);
        if (!r.floored[s]) {                                                                           // (where it is put down: ahead of the creature, its bottom on the floor: found once)
          rot(R, o, 0, 0, 1); d = Math.sqrt(qx * qx + qz * qz) || 1;
          r.fx[s] = R[o] + qx / d * r.dahead[s] * sc; r.fy[s] = isNaN(r.dy[s]) ? r.hy[s] + 0.01 : r.dy[s]; r.fz[s] = R[o + 2] + qz / d * r.dahead[s] * sc;
          r.floored[s] = 1;
        }
        all_on = k >= 1;
        for (j = 0; j < 8; j++) {
          if ((m & (1 << j)) === 0) continue;
          a = arm_of(arms, j);
          pose(ctx, s, arms, j, 1 - k);
          rot(R, o, a.side * r.hx[s], 0, 0);
          D.hand(fam, s, j, 2 | (r.flags[s] & 20), k, r.fx[s] + qx, r.fy[s] + qy, r.fz[s] + qz, 0, 0);
          if ((fam.ARM_ST === null ? 0 : fam.ARM_ST[(s * fam.NARMS + j) * fam.ARM_NS + AS_RST]) !== 2) all_on = false;
        }
        if (r.ph[s] > 2.5 || (all_on && r.ph[s] > 0.9)) { grip.cmd(js, s, gen, 255, 2, 0, 0, 0, 0, 1); hands_off(ctx, s); finish(ctx, s, S_DONE, W_NONE); }
      }
    };
    G.step = function (ctx, dt, max) {
      var r = ctx.gb, s, n = r.n, seen = 0;
      for (s = 0; s < max && seen < n; s++) if (active(r.st[s])) { seen++; step_one(ctx, s, dt); }
    };

    // ---- what the brain says to a task that is running
    G.put_down = function (ctx, s, ahead, y) {
      var r = ctx.gb;
      if (!r || (r.st[s] !== S_CARRY && r.st[s] !== S_LIFT)) return false;
      r.dahead[s] = ahead > 0 ? ahead : 0.45; r.dy[s] = y === undefined ? NAN : y; r.floored[s] = 0; r.st[s] = S_LOWER; r.ph[s] = 0;
      return true;
    };
    var end_now = function (ctx, s, x, y, z, flags) {
      var fam = ctx.fam;
      grip.cmd(ctx.js, s, fam.GEN[s], 255, 2, 0, x, y, z, flags);
      hands_off(ctx, s);
      finish(ctx, s, S_DONE, W_NONE);
      return true;
    };
    G.throw_held = function (ctx, s, speed, up) {
      var r = ctx.gb, R = ctx.fam.ROOT, o = s * 8, sp = speed === undefined ? 6 : speed, u = up === undefined ? 0.35 : up, d;
      if (!r || !active(r.st[s]) || r.st[s] === S_APPROACH || r.st[s] === S_REACH) return false;
      rot(R, o, 0, 0, 1); d = Math.sqrt(qx * qx + qz * qz) || 1;
      return end_now(ctx, s, qx / d * sp, sp * u, qz / d * sp, 0);
    };
    G.let_go = function (ctx, s) {
      var r = ctx.gb;
      if (!r || !active(r.st[s]) || r.st[s] === S_APPROACH || r.st[s] === S_REACH) return false;
      return end_now(ctx, s, 0, 0, 0, 0);
    };
    G.cancel = function (ctx, s) {
      var r = ctx.gb;
      if (!r || !active(r.st[s])) return false;
      if (r.st[s] === S_APPROACH) { D.intent(ctx.fam, s, 0, 0, 0, 0); finish(ctx, s, S_FAILED, W_CANCELLED); return true; }
      if (r.st[s] === S_REACH) { fail(ctx, s, W_CANCELLED); return true; }
      return end_now(ctx, s, 0, 0, 0, 0);
    };
    G.clear = function (ctx, s) { var r = ctx.gb; if (r && !active(r.st[s])) { r.st[s] = S_NONE; r.why[s] = W_NONE; } };
    // an instance that is gone: its task goes with it (no hands to take off)
    G.release = function (ctx, s) { var r = ctx.gb; if (r) { if (active(r.st[s])) r.n--; r.st[s] = S_NONE; r.why[s] = W_NONE; r.body[s] = -1; } };
    return G;
  }

  return { create: create, S: STATES, W: WHY, S_NONE: S_NONE, S_APPROACH: S_APPROACH, S_REACH: S_REACH, S_LIFT: S_LIFT, S_CARRY: S_CARRY, S_LOWER: S_LOWER, S_DONE: S_DONE, S_FAILED: S_FAILED };
});

// ========================================================================================================================
// worker_grid
// ========================================================================================================================
packing()("happy_worker_grid", function happy_worker_grid() {
  "use strict";
  // HAPPY WORKER GRID: who is near whom, for a family of instances, without looking at all of them (SYSTEM.md: api.nearest, api.near, api.world.nearest, api.world.near). A uniform grid on the ground plane (x, z), hashed into cells,
  // rebuilt from the family's root rows when it is asked (once a frame at most: pure.js decides), a linked list of the instances of each cell in two typed arrays. It knows nothing of any creature: it is a SERVICE of the
  // engine, the same for every family; a family only says how big its cells are (about the distance it cares about).
  //   const G = create(max)                 the room for `max` instances
  //   G.build(ROOT, ALIVE, n, cell [, SKIP]) -> how many are in it      ROOT: the family's rows (8 floats an instance: x, y, z ...), ALIVE: the u8 column, n: how many slots to look at, cell: the width of a cell in metres, SKIP: an
  //                                         optional u8 column: an instance that has a byte in it is left out (a dead creature that asked to be: logic.js "exclude"); the same column has to be given until the next build
  //   G.nearest(ROOT, ALIVE, slot) -> the slot of the nearest other instance | -1 (there is no other) | -2 (not found near enough: the caller looks at them all)       G.d2: the squared distance (3D) of the last answer
  //   G.near(ROOT, ALIVE, slot, radius, out) -> how many are within the radius (3D) of the slot's, their slots in `out` (as many as it holds) | -2 (the radius is wider than the grid looks: the caller looks at them all)
  // The same two from a POINT, for an asker that is not in this grid (another family's instance, a place): the asker's own slot, if it is in this grid, is `skip` (-1: none)
  //   G.nearest_at(ROOT, ALIVE, px, py, pz, skip, maxd) -> a slot | -1 (none within maxd: the grid looked everywhere it could be) | -2 (cannot tell: scan them all)      maxd: Infinity (or not a number above 0) asks for the nearest of all;
  //                                         what it gives may be farther than maxd when it was found anyway: the caller compares G.d2 with its own limit
  //   G.near_at(ROOT, ALIVE, px, py, pz, skip, radius, out, n0, tag) -> the count after the ones it added to `out` from index n0 (each as `tag | slot`: a handle when tag is the family's id << 16) | -2 (the radius is wider than the grid looks)
  // The answers are the same as looking at all of them (the grid only leaves out what cannot be nearer): it is the same as the plain scan. Written in ES5.
  var RING_MAX = 6;                                                                                     // (how many rings of cells around the instance's are looked at before the caller is told to scan: a sparse family costs what it did)

  function create(max) {
    var head = new Int32Array(64), seen = new Int32Array(64), stamp = 0, next = new Int32Array(max), mask = 63, cell = 4, inv = 0.25, count = 0, skipv = null;
    var G = { d2: Infinity, cells: 64 };

    G.build = function (ROOT, ALIVE, n, cell_size, SKIP) {
      var s, o, h, alive = 0, want = 64, sk = SKIP === undefined ? null : SKIP;
      if (!(cell_size > 0)) cell_size = 4;
      cell = cell_size; inv = 1 / cell_size; skipv = sk;
      if (sk === null) { for (s = 0; s < n; s++) alive += ALIVE[s] !== 0 ? 1 : 0; }
      else { for (s = 0; s < n; s++) alive += ALIVE[s] !== 0 && sk[s] === 0 ? 1 : 0; }
      while (want < alive * 2) want <<= 1;
      if (want !== head.length) { head = new Int32Array(want); seen = new Int32Array(want); mask = want - 1; G.cells = want; }
      head.fill(-1);
      for (s = 0; s < n; s++) {
        if (ALIVE[s] === 0 || (sk !== null && sk[s] !== 0)) continue;
        o = s * 8;
        h = (Math.imul(Math.floor(ROOT[o] * inv), 73856093) ^ Math.imul(Math.floor(ROOT[o + 2] * inv), 19349663)) & mask;
        next[s] = head[h]; head[h] = s;
      }
      count = alive;
      stamp = 0; seen.fill(0);
      return alive;
    };

    // the nearest alive instance other than `skip` to a point (the best is kept in G.d2 and the return value: nothing is allocated)
    G.nearest_at = function (ROOT, ALIVE, px, py, pz, skip, maxd) {
      var cx = Math.floor(px * inv), cz = Math.floor(pz * inv), others = count;
      var best = -1, bd = Infinity, r, dz, dx, h, s, so, ex, ey, ez, d, lim, step;
      if (!(maxd > 0)) maxd = Infinity;
      if (skip >= 0 && ALIVE[skip] !== 0 && (skipv === null || skipv[skip] === 0)) others--;           // (the asker is one of the instances that were put in the grid)
      if (others <= 0) { G.d2 = Infinity; return -1; }
      if (++stamp > 2000000000) { stamp = 1; seen.fill(0); }
      for (r = 0; r <= RING_MAX; r++) {
        for (dz = -r; dz <= r; dz++) {
          step = (dz === -r || dz === r) ? 1 : 2 * r;                                                   // (the rows at the edge of the ring: all their cells; the rows between: only the two ends)
          if (step === 0) step = 1;
          for (dx = -r; dx <= r; dx += step) {
            h = (Math.imul(cx + dx, 73856093) ^ Math.imul(cz + dz, 19349663)) & mask;
            if (seen[h] === stamp) continue;                                                            // (two cells of the ring in one bucket: once)
            seen[h] = stamp;
            for (s = head[h]; s >= 0; s = next[s]) {
              if (s === skip || ALIVE[s] === 0) continue;
              so = s * 8; ex = ROOT[so] - px; ey = ROOT[so + 1] - py; ez = ROOT[so + 2] - pz;
              d = ex * ex + ey * ey + ez * ez;
              if (d < bd) { bd = d; best = s; }
            }
          }
        }
        lim = r * cell;
        if (best >= 0 && bd <= lim * lim) { G.d2 = bd; return best; }                                    // (everything in the rings not looked at yet is at least r cells away)
        if (lim >= maxd) { G.d2 = Infinity; return -1; }                                                 // (nothing is within maxd: all the cells it could be in have been looked at)
      }
      return -2;
    };

    G.near_at = function (ROOT, ALIVE, px, py, pz, skip, radius, out, n0, tag) {
      var r2 = radius * radius, n = n0, rings = Math.ceil(radius * inv), cx = Math.floor(px * inv), cz = Math.floor(pz * inv), dx, dz, h, s, so, ex, ey, ez, cap = out.length;
      if (rings > RING_MAX) return -2;
      if (++stamp > 2000000000) { stamp = 1; seen.fill(0); }
      for (dz = -rings; dz <= rings; dz++) {
        for (dx = -rings; dx <= rings; dx++) {
          h = (Math.imul(cx + dx, 73856093) ^ Math.imul(cz + dz, 19349663)) & mask;
          if (seen[h] === stamp) continue;
          seen[h] = stamp;
          for (s = head[h]; s >= 0; s = next[s]) {
            if (s === skip || ALIVE[s] === 0) continue;
            so = s * 8; ex = ROOT[so] - px; ey = ROOT[so + 1] - py; ez = ROOT[so + 2] - pz;
            if (ex * ex + ey * ey + ez * ez <= r2 && n < cap) out[n++] = tag | s;
          }
        }
      }
      return n;
    };

    // the same from the slot's own place (a family asking about itself)
    G.nearest = function (ROOT, ALIVE, slot) {
      var o = slot * 8;
      return G.nearest_at(ROOT, ALIVE, ROOT[o], ROOT[o + 1], ROOT[o + 2], slot, Infinity);
    };
    G.near = function (ROOT, ALIVE, slot, radius, out) {
      var o = slot * 8;
      return G.near_at(ROOT, ALIVE, ROOT[o], ROOT[o + 1], ROOT[o + 2], slot, radius, out, 0, 0);
    };
    return G;
  }

  return { create: create, RING_MAX: RING_MAX };
});

// ========================================================================================================================
// worker_logic
// ========================================================================================================================
packing()("happy_worker_logic", function happy_worker_logic() {
  "use strict";
  // HAPPY WORKER LOGIC: what a creature's FILE says about how its instances behave, run in the worker (SYSTEM.md, "The worker's logic"). A creature's file is JS that the page runs at load to make the species; it may also carry a
  // function for the worker:
  //     return { name, skeleton, rig, legs: { ..., slots: 3 }, ..., worker: function (api) { const fear = api.f32(); const PUNCH = api.action("punch"); const RUN = api.style("person_run");
  //         return { think(me, dt) { ... me.go(vx, vz); me.act(PUNCH); me.style(RUN, 0.4); ... }, on: { end(me, how) { ... } } }; } };
  // The page sends the function's SOURCE (a function cannot cross to a worker; the function therefore has to be self-contained: it takes everything from `api`, and what it builds it builds in the worker, where the libraries of gait
  // styles and of actions are) and the worker calls it ONCE for the family with `api`; the object it returns is the family's HOOKS. The worker then runs them every frame, before the system frame, on the columns of the family.
  //
  //   const L = create(env)      env: { cols, D, K, lib (the actions' library), A (pure.js create), slots (gait_slots.js create), core, species(js) -> what core.family made of the installed species | null,
  //                              plan(js) -> the action plan | null, family(js) -> the family's columns, world: { ray(ox, oy, oz, dx, dy, dz, max, hit) -> distance | -1 } | null, post(name, data) }
  //     env.floor(x, z) -> the terrain's height there (optional: me.alt is the height over it; without it me.alt is y)
  //     env.design: pure.js (optional): api.gait / api.style / api.action take designs when it is there
  //     env.grid: pure.js (optional): who is near whom      env.bt: pure.js (optional): the AI      env.goap: pure.js (optional): api.goap, the planner of the goal-oriented creatures      env.world_service: pure.js (optional): api.group and api.world (the other species, the hit)
  //   L.install(js, src, { name, max }) -> ctx      evaluates the function and calls it with `api` (every mistake is thrown)      L.tick(dt)      once a frame      L.report() / L.reset_stats() / L.timing (the visits and the time that the families cost)      L.remove(js)      L.contexts()      L.stats
  //
  // THE HOOKS (all optional; a key that is not one is refused):  spawn(me)  release(me)  think(me, dt)  tick(api, dt)  message(api, data)  on: { emit(me, tag, value), end(me, how) }  msg(api, m) (numbers from the page: CMD_HAPPY_MSG)  ai: { hz, far_hz, sense, tree } (a behaviour tree, plain objects: pure.js; its visits are at its own rate, not every frame)
  //   hit(me, damage, from)   the instance `me` was hit, by api.world.hit of another creature's worker (pure.js): damage a number, from the attacker's handle (api.world) or -1. It is called AT ONCE, inside the attacker's hook, with `me` at the
  //                           victim; what a hit means (health, a flinch, death) is the family's: world/blocks/health.js is one
  //   blocks: [{ sense, spawn, release, think, tick, message, msg, hit, on: { emit, end } }, ...] (the hooks of the blocks put into the tree, world/blocks: CHAINED to the worker's own at install, see compose_blocks)
  //   message: what the page sent with sp.worker_send(data) (a plain object; api.at(slot) gives the instance it is about)
  //   think runs for an instance on the frames the C++ gives it (the tier: a far instance has a divisor, `dt` is the time since its last think); tick once a frame for the family (a crowd's logic written on the columns: api.fam).
  //   emit: an event of an action that the creature plays (a tag a spec's `emit` carries), end: an action ended (how: 0 finished, 1 stopped, 2 gone, 3 replaced). A hook that throws is reported to the page (the first three times)
  //   and, the third time, taken out: one creature's mistake does not stop the others.
  // `me` is ONE object a family whose slot moves: its fields are the instance as the columns have it NOW (slot, x, y, z, yaw, vx, vz, speed, scale, air (1: off the ground), near (the tier), dt, flying (1 while it flies), flight (what
  // it can fly as: 0 nothing, 1 a wing, 2 a hover, 3 an aircraft; 0 also when it has no gravity: it cannot take off), alt (the height of its root over the floor under it: the terrain, when the host has the floor query, else y: read when asked)) and its methods act on it:
  //   me.reach(arm, x, y, z, w, o) me.reach_off(arm) me.reach_state(arm) me.reach_gap(arm) me.reach_error(arm)   the world reach: an arm's hand goes to a point of the world and stays on it
  //   me.fingers(arm, curl, o) me.has_fingers(arm) the hand's fingers close (curl 1) and open (0): only a creature whose skeleton has finger bones; a grip closes them by itself (me.grip, me.grab)
  //   me.arm_of(side) -> the number of the arm on that side (+1 left, -1 right: what a clip's grab and release events say), -1 none
  //   me.grab(body, o) me.grab_state() me.grab_why() me.grab_body() me.put_down(ahead, y) me.throw_held(speed, up) me.let_go() me.grab_cancel() me.grab_clear()   picking a body of the physics world up, carrying it, putting it down (pure.js: a task the
  //                        worker steps every frame); me.grip(arm, body, follow) me.ungrip(arm, x, y, z) me.gripping(arm) the hand's grip itself (world.cpp); me.load the mass its hands carry (kg): the bodies come from api.bodies(me, radius, out) / api.body(id)
  //   me.act(h [, chain]) me.act_opts(power, speed, mirror) me.act_target(x, y, z) me.act_stop() me.act_end() me.acting() -> the action's handle | -1 me.act_tau() me.act_phase() me.act_phase_index() me.act_waiting() me.act_wait_age() me.act_release() (where a learned action is: seconds, the phase's name as a tag id, the wait point it stands at; release lets it go on)      me.style(h, seconds) me.style_now(h) me.style_own(seconds) (the creature's own gait again) me.styling() -> the slot it walks
  //   me.go(vx, vz) me.move(vx, vz, fx, fz) me.stop() me.look_at(x, y, z, w) me.look_off() me.push(vx, vz, vy) me.jump(vy)      me.say(tag, value) -> to the page      me.rand() -> 0 .. 1
  //   me.fly(on) -> bool   takes off (true) or lands (false); idempotent; the body does it at the top of its next frame (the column FLYWISH). A creature with no flight section (or aircraft) or no gravity ignores it (false; `flight` is 0; counted
  //                        in the family's stats as no_fly). Flying is steered by me.go / me.move (a wing flies at the wished speed, at least 1.2 stall speeds: me.stop() leaves it flying along its heading) and by me.climb(vy), the vertical
  //                        velocity wished in world units / s, which stays until the next call. Landing: me.fly(false); with the ground and a gravity the fall lands it, on open wings if it has them
  // `api`: name, max, fam (the family's columns: they are filled when the family is built, which is after the function was called: read fam.ROOT and the others when they are needed, do not keep them), K (the constants), hit (the last ray), out (a scratch Int32Array(64) for near()),  action(name | spec) -> handle, style(name, opts) -> handle, tag(name) -> id,
  //   f32() u8() i32() u16() (a typed column of the family's size: the creature's own state of its instances),  near(me, radius, out) -> how many (the slots of the same family in `out`),  nearest(me) -> slot | -1
  //   (api.near_d2: how far),  ray(ox, oy, oz, dx, dy, dz, max) -> the distance to what a ray meets in the physics world | -1 (api.hit: [distance, point xyz, normal xyz]),  rand_seed(n)
  //   bodies(me, radius, out) -> how many dynamic bodies of the physics world (props: not the creatures' proxies, not what a hand holds) are within `radius` of `me`, their ids (the engine's own, what me.grab and me.grip take) in `out` (an Int32Array), the nearest first
  //   body(id) -> the body's record (a Float32Array(16) that the next call writes again: 0 here, 1-3 the centre, 4-6 its own half sizes, 7 the mass, 8-10 the velocity, 11 held, 12-13 the direction of its x axis) | null (no such body)
  //   group(name) -> id (the GROUP of the family: "wolf", "team_red"; the default is the family's own name; call it once, in the worker function)      world: THE OTHER SPECIES (pure.js, the header says all of it): an instance of any family is ONE
  //   integer handle (js << 16 | slot, -1 none): world.self(me), world.group_id(name), world.nearest(me, group, max_dist) / near(me, radius, out, group) / count(group), the reads x y z vx vz speed yaw scale alive gen group_of family_of dist2(me, h),
  //   world.exclude(me, on) (a dead one is left out of every query), world.hit(h, damage, from) -> true when the victim's `hit` hook took it. The queries and the hit are NOT in a family that has no `env.world_service`: `api.world` is null there
  // WHAT A FRAME ALLOCATES: nothing, when the hooks allocate nothing (happy_worker_logic_test measures a crowd with a think that moves, fights and changes style). Node 14 and the bundler's parser: no optional chaining, no ??,
  // no async / await, no class.
  const MAX_ERRORS = 3, HOOKS = ["spawn", "release", "think", "tick", "message", "msg", "hit", "on", "ai"], ON = ["emit", "end"];
  const AI_BASE = 65520, MIND = AI_BASE + 7, PSYNC = AI_BASE + 8, PPOOL = AI_BASE + 9, PAIM = AI_BASE + 10;                                                                                  // (the ids of the page's messages from here up are the engine's own, not the creature's `msg` hook's: see "THE AI WATCH" below)
  const OUT_MAX = 256;                                                                                   // (what the creatures `say` waits in a buffer of OUT_MAX records until it is copied into the response: L.emit)
  const GRID_MIN = 48;                                                                                    // (a family with fewer alive instances is looked at all at once: the grid would cost more than it saves)
  const clock = typeof performance !== "undefined" && typeof performance.now === "function" ? function () { return performance.now(); } : function () { return Date.now(); };

  function eval_factory(src) {
    const text = String(src).trim();
    let f = null;
    try { f = new Function("return (" + text + ")")(); }
    catch (e) {
      if (/^[A-Za-z_$][\w$]*\s*\(/.test(text)) f = new Function("return (function " + text + ")")();        // (a method written short: `worker(api) { ... }`)
      else throw e;
    }
    if (typeof f !== "function") throw new Error("happy_worker_logic: the creature's worker is a function (api) that returns the hooks");
    return f;
  }

  // BLOCKS (world/blocks/, SYSTEM.md): a worker may return `blocks: [ { sense, spawn, release, think, tick, message, msg, hit, on: { emit, end } }, ... ]`: the hooks of the independent pieces of mind that were put
  // into the creature's tree. They are CHAINED, they are not new hooks: for every hook the worker's own comes first, then the blocks' in their order, and `sense` is chained into `ai.sense`, `steer` into `ai.steer` (bt.js: it is called with every `go` node's wish, see SYSTEM.md). It is done ONCE, at install: what runs
  // is plain hooks again (a loop over a short list of functions, nothing allocated). A block's hook that throws is reported as the hook's of the family (the third time that hook is taken out, all of its chain).
  const BLOCK_KEYS = ["sense", "steer", "spawn", "release", "think", "tick", "message", "msg", "hit", "on"];
  function chain(list) {
    const n = list.length;
    if (n === 0) return undefined;
    if (n === 1) return list[0];
    return function (a, b, c) { for (let i = 0; i < n; i++) list[i](a, b, c); };
  }
  function compose_blocks(hooks, name) {
    if (!hooks || typeof hooks !== "object" || hooks.blocks === undefined) return hooks;
    const where = "happy_worker_logic: " + name + ": ";
    if (!Array.isArray(hooks.blocks)) throw new Error(where + "blocks is a list of objects { sense, spawn, release, msg, on, ... }");
    const lists = {}, on = { emit: [], end: [] }, out = {};
    let sense_list = [], steer_list = [];
    for (const k in hooks) {
      if (k === "blocks") continue;
      if (k === "on") { if (hooks.on && typeof hooks.on === "object") for (const e in hooks.on) if (on[e] !== undefined && typeof hooks.on[e] === "function") on[e].push(hooks.on[e]); }
      else if (k === "ai") { if (hooks.ai && typeof hooks.ai.sense === "function") sense_list.push(hooks.ai.sense); if (hooks.ai && typeof hooks.ai.steer === "function") steer_list.push(hooks.ai.steer); }
      else if (typeof hooks[k] === "function") (lists[k] = lists[k] || []).push(hooks[k]);
    }
    for (let i = 0; i < hooks.blocks.length; i++) {
      const b = hooks.blocks[i], tag = where + "blocks[" + i + "]";
      if (!b || typeof b !== "object") throw new Error(tag + " is an object { sense, spawn, release, msg, on, ... }");
      for (const k in b) {
        if (BLOCK_KEYS.indexOf(k) < 0) throw new Error(tag + ": '" + k + "' is not a hook of a block (" + BLOCK_KEYS.join(", ") + ")");
        if (k === "on") {
          if (!b.on || typeof b.on !== "object") throw new Error(tag + ": on is { emit, end }");
          for (const e in b.on) { if (ON.indexOf(e) < 0) throw new Error(tag + ": '" + e + "' is not an event (" + ON.join(", ") + ")"); if (typeof b.on[e] !== "function") throw new Error(tag + ": on." + e + " is a function"); on[e].push(b.on[e]); }
        } else if (typeof b[k] !== "function") throw new Error(tag + ": " + k + " is a function");
        else if (k === "sense") sense_list.push(b.sense);
        else if (k === "steer") steer_list.push(b.steer);
        else (lists[k] = lists[k] || []).push(b[k]);
      }
    }
    for (const k in lists) out[k] = chain(lists[k]);
    if (on.emit.length || on.end.length) { out.on = {}; if (on.emit.length) out.on.emit = chain(on.emit); if (on.end.length) out.on.end = chain(on.end); }
    if (hooks.ai !== undefined) { out.ai = {}; for (const k in hooks.ai) out.ai[k] = hooks.ai[k]; delete out.ai.sense; delete out.ai.steer; if (sense_list.length) out.ai.sense = chain(sense_list); if (steer_list.length) out.ai.steer = chain(steer_list); }
    else if (sense_list.length || steer_list.length) throw new Error(where + "a block has a sense or a steer, and the worker has no ai: { tree } to run it in");
    return out;
  }

  function create(env) {
    for (const k of ["cols", "D", "K", "lib", "A", "slots", "core", "species", "family", "post"]) if (env[k] === undefined) throw new Error("happy_worker_logic: create(env): env." + k + " is needed");
    const K = env.K, D = env.D, ctxs = [], stats = { frames: 0, thinks: 0, errors: 0, tick_ms: 0, undelivered: 0 };
    const L = { stats: stats, cache: Object.create(null), timing: false };

    // the arms a creature has: [{ j (its number), side (+1 left, -1 right), length (model units) }], the first of each side, from the action plan (made once, when it is first asked for)
    function arms_of(ctx) {
      let a = ctx.arm_list;
      if (a) return a;
      const pl = env.plan(ctx.js);
      a = ctx.arm_list = [];
      if (pl && pl.arm) for (const key of ["l", "r"]) { const m = pl.arm[key]; if (m) a.push({ j: m.j, side: m.side, length: m.length }); }
      return a;
    }

    // ---- me: the instance the hooks are given (one a family; its slot moves)
    function Me(ctx) {
      this.ctx = ctx; this.slot = -1; this.gen = 0;
      this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.vx = 0; this.vz = 0; this.speed = 0; this.scale = 1; this.air = 0; this.near = 1; this.dt = 0; this.flying = 0; this.flight = 0;
    }
    const MP = Me.prototype;
    // me.alt: the height of the root over the floor under it (the host's floor query, env.floor(x, z): the terrain; the props of the physics world are not counted); without the query it is y. A read asks the wasm once: not in set_me
    Object.defineProperty(MP, "alt", { get: function () { return env.floor ? this.y - env.floor(this.x, this.z) : this.y; } });
    const need_rt = function (me) { if (me.ctx.rt === null) throw new Error("happy_worker_logic: " + me.ctx.name + " has no action plan (sp.worker_action_plan): it cannot play actions"); return me.ctx.rt; };
    MP.act = function (h, chain) { need_rt(this).start(this.slot, h, chain === true); };                       // (chain: it continues the action that plays: no fade in, see rt.start)
    MP.act_opts = function (power, speed, mirror) { const rt = need_rt(this); rt.power(this.slot, power); rt.speed(this.slot, speed); rt.mirror(this.slot, mirror); };
    MP.act_target = function (x, y, z) { need_rt(this).target_point(this.slot, x, y, z); };
    // where the action that plays is (learned actions have named phases and wait points, SYSTEM.md "Learned actions: events and states"): -1 when nothing plays or the creature has no action runtime
    MP.act_tau = function () { const rt = this.ctx.rt; return rt === null ? -1 : rt.tau(this.slot); };                         // seconds into it
    MP.act_phase = function () { const rt = this.ctx.rt; return rt === null ? -1 : rt.phase_id(this.slot); };                  // the phase's name as a tag id: compare with api.tag("windup")
    MP.act_phase_index = function () { const rt = this.ctx.rt; return rt === null ? -1 : rt.phase(this.slot); };               // the phase's number
    MP.act_waiting = function () { const rt = this.ctx.rt; return rt === null ? -1 : rt.waiting(this.slot); };                 // the tag id of the wait point its clock stands at (api.tag("guard")), -1 when it does not wait
    MP.act_wait_age = function () { const rt = this.ctx.rt; return rt === null ? -1 : rt.wait_age(this.slot); };               // seconds it has waited
    MP.act_release = function () { const rt = this.ctx.rt; if (rt !== null) rt.release(this.slot); };                           // lets a waiting action go on
    MP.act_stop = function () { const rt = this.ctx.rt; if (rt !== null) rt.stop(this.slot); };
    MP.act_end = function () { const rt = this.ctx.rt; if (rt !== null) rt.end(this.slot); };
    MP.acting = function () { const rt = this.ctx.rt; return rt === null ? -1 : rt.playing(this.slot); };
    const need_pool = function (me) { if (me.ctx.pool === null) throw new Error("happy_worker_logic: " + me.ctx.name + " has no gait slots (legs: { slots: n }) or was not installed (sp.worker_install)"); return me.ctx.pool; };
    MP.style = function (h, seconds) {
      const p = need_pool(this), at = p.load(h);
      if (at < 0) {
        this.ctx.stats.no_slot++; return;
      } p.fade(this.slot, at, seconds);
    };
    MP.style_now = function (h) { const p = need_pool(this), at = p.load(h); if (at < 0) { this.ctx.stats.no_slot++; return; } p.assign(this.slot, at); };
    MP.style_own = function (seconds) { const p = this.ctx.pool; if (p !== null) p.fade(this.slot, 0, seconds); };         // the creature's OWN gait again (slot 0), over `seconds`; a creature with no spare gait slots has only its own
    MP.styling = function () { return this.ctx.fam.GAIT_B === null ? 0 : this.ctx.fam.GAIT_B[this.slot]; };
    MP.go = function (vx, vz) { D.intent(this.ctx.fam, this.slot, vx, vz, 0, 0); };
    MP.move = function (vx, vz, fx, fz) { D.intent(this.ctx.fam, this.slot, vx, vz, fx, fz); };
    MP.stop = function () { D.intent(this.ctx.fam, this.slot, 0, 0, 0, 0); };
    MP.look_at = function (x, y, z, w) { D.look(this.ctx.fam, this.slot, 1, 0, x, y, z, w, 0); };
    MP.look_off = function () { D.look(this.ctx.fam, this.slot, 0, 0, 0, 0, 0, 1, 0); };
    MP.push = function (vx, vz, vy) { D.push(this.ctx.fam, this.slot, vx, vz, vy); };
    // me.place(x, y, z [, yaw]): the root put AT a place at once, turned to face `yaw` (the heading: forward is (sin yaw, cos yaw)); no yaw keeps the turn it has. The way onto a ladder's top, into a seat or a bed (the slot's own
    // place and yaw), out of a doorway that a body cannot cross: a body that is placed has no speed of its own to carry on with, and the legs find the floor again at its next frame
    MP.place = function (x, y, z, yaw) {
      const h = yaw === undefined ? 0 : yaw * 0.5;
      return D.root(this.ctx.fam, this.slot, x, y, z, 0, yaw === undefined ? 0 : Math.sin(h), 0, yaw === undefined ? 0 : Math.cos(h), 0) === 0;
    };
    MP.jump = function (vy) { D.jump(this.ctx.fam, this.slot, vy, 0); };
    // THE WORLD REACH (SYSTEM.md "The world reach"; CMD_HAPPY_HAND, flags bit 1): arm `arm` (its number among the creature's arms) puts its hand on the world point (x, y, z), metres, and keeps it there whatever the body does, as far as
    // `w` (0 .. 1, 1 when not said) says; say it again at every think (the worker holds it 30 frames, then lets the arm go). o: { lean (the spine leans to bring the shoulder to it, true when not said), surface (the hand
    // stops at the first surface on the way, false), pole, pole_w (the elbow's turn about the line from the shoulder to the hand, radians, + out) }. -> true when the arm took it (the creature has that arm, a life, and the
    // point is a number). Only a NEAR creature reaches: a far one's hands hang
    MP.reach = function (arm, x, y, z, w, o) {
      if (o && o.step && reach_step(this, arm, x, z)) return false;                                         // (walking up to it: the arm is not asked yet)
      const lean = !o || o.lean !== false, crouch = !o || o.crouch !== false, surface = !!(o && o.surface), pole = o && o.pole !== undefined && o.pole !== null;
      return D.hand(this.ctx.fam, this.slot, arm, 2 | (lean ? 4 : 0) | (surface ? 8 : 0) | (crouch ? 16 : 0), w === undefined ? 1 : w, x, y, z, pole ? o.pole : 0, pole ? (o.pole_w === undefined ? 1 : o.pole_w) : 0) === 0;
    };
    // THE STEP ASSIST of a reach (o.step): a point that is farther than the arm and what the body adds is walked up to first, as a person goes up to a thing it wants to take: the wish is said toward the point, facing it, at a
    // walking pace that eases off, until the point is as far as the arm is long (the lean and the crouch bring the rest: a point on the floor 0.55 m ahead is made by a person whose arm is 0.54 m long), and the arm is asked for it
    // only from there (an arm that is asked at the edge flips between trying and giving up). A hand that is on the point (state 2) or reaching it is not walked away from until the point is 0.25 m past that distance. -> true while it
    // walks (the brain says no me.go of its own meanwhile)
    const reach_step = function (me, arm, x, z) {
      const c = me.ctx, fam = c.fam, list = arms_of(c);
      let len = 0;
      for (let i = 0; i < list.length; i++) if (list[i].j === arm) len = list[i].length;
      if (!(len > 0) || fam.INTENT === null) return false;
      const sc = fam.ROOT[me.slot * 8 + 3] || 1, stand = len * sc, dx = x - me.x, dz = z - me.z, d = Math.sqrt(dx * dx + dz * dz), rs = arm_col(me, arm, "AS_RST");
      if (d <= stand + ((rs === 1 || rs === 2) ? 0.25 : 0.03)) {
        if (c.st_walk !== null && c.st_walk[me.slot] === 1) { c.st_walk[me.slot] = 0; D.intent(fam, me.slot, 0, 0, dx / (d || 1), dz / (d || 1)); }     // (it was walking up: it stops, facing the point)
        return false;
      }
      if (c.st_walk === null) c.st_walk = new Uint8Array(c.max);
      c.st_walk[me.slot] = 1;
      const sp = Math.min(1.4 * sc, 0.35 * sc + (d - stand) * 1.5);
      D.intent(fam, me.slot, dx / d * sp, dz / d * sp, dx / d, dz / d);
      return true;
    };
    // the number of the arm on a side (+1 left, -1 right, as a learned action's `grab` and `release` events say it in their value): -1 when the creature has none
    MP.arm_of = function (side) { const list = arms_of(this.ctx); for (let i = 0; i < list.length; i++) if ((list[i].side > 0) === (side > 0)) return list[i].j; return -1; };
    MP.reach_off = function (arm) { D.hand(this.ctx.fam, this.slot, arm, 2, 0, 0, 0, 0, 0, 0); };                  // (lets the arm go: its own hand again, eased)
    // what the reach of an arm is now (what the last update of the worker made of it): the state 0 none, 1 reaching, 2 on the point, 3 out of reach (past the arm and what the body can add, or past what its joints allow);
    // how far short the point is of the arm's length from the shoulder, and how far the hand is from the point, in metres
    const arm_col = function (me, arm, name) { const f = me.ctx.fam, A = f.ARM_ST; return A === null || !(arm >= 0 && arm < f.NARMS) ? 0 : A[(me.slot * f.NARMS + arm) * f.ARM_NS + K[name]]; };
    MP.reach_state = function (arm) { return arm_col(this, arm, "AS_RST"); };
    MP.reach_gap = function (arm) { return arm_col(this, arm, "AS_RGAP"); };
    MP.reach_error = function (arm) { return arm_col(this, arm, "AS_RERR"); };
    // PICKING A BODY UP (pure.js, world.cpp; SYSTEM.md "Grips and carrying"). `body` is the engine's id of a dynamic body of the physics world: api.bodies(me, radius, out) finds them. me.grab(body, o) begins a task that the worker
    // steps every frame: it walks up to the body (o.approach), reaches its two sides (o.arms "both" | "nearest" | "left" | "right"), holds it, lifts it and carries it; the brain walks where it likes and says me.put_down() or me.throw_held(speed, up)
    // or me.let_go() when it is time. o: { arms, half (metres), approach (false), lean (true), crouch (true), timeout (8), follow (0: the body follows the heading, level; 1: the hand's own turn), out, up, ahead }. -> true when it began (the body is there, the
    // creature has the arms). me.grab_state() 0 none, 1 approach, 2 reach, 3 lift, 4 carry, 5 lower, 6 done, 7 failed; me.grab_why() 0, 1 out of reach, 2 timeout, 3 lost it, 4 cancelled, 5 too heavy, 6 gone, 7 no arm, 8 stuck; me.grab_body() the body it holds
    // (-1 none); me.grab_clear() forgets a done or failed task. A body heavier than the creature is not lifted (5); a load slows its carrier (me.load: kg in its hands)
    MP.grab = function (body, o) { const g = L.grab; return g !== null && g.begin(this.ctx, this.slot, body, o); };
    MP.grab_state = function () { const g = L.grab; return g === null ? 0 : g.state(this.ctx, this.slot); };
    MP.grab_why = function () { const g = L.grab; return g === null ? 0 : g.why(this.ctx, this.slot); };
    MP.grab_body = function () { const g = L.grab; return g === null ? -1 : g.body(this.ctx, this.slot); };
    MP.put_down = function (ahead, y) { const g = L.grab; return g !== null && g.put_down(this.ctx, this.slot, ahead, y); };
    MP.throw_held = function (speed, up) { const g = L.grab; return g !== null && g.throw_held(this.ctx, this.slot, speed, up); };
    MP.let_go = function () { const g = L.grab; return g !== null && g.let_go(this.ctx, this.slot); };
    MP.grab_cancel = function () { const g = L.grab; return g !== null && g.cancel(this.ctx, this.slot); };
    MP.grab_clear = function () { const g = L.grab; if (g !== null) g.clear(this.ctx, this.slot); };
    // the hand's own grip, with no task (the brain does the reaching and the carrying): me.grip(arm, body, follow) -> true when the hand holds it (not: a body that is not a dynamic one, held by another, one that weighs more than the creature, a far creature)
    MP.grip = function (arm, body, follow, curl) {
      const ok = env.grip ? env.grip.cmd(this.ctx.js, this.slot, this.gen, arm, 1, body, follow > 0 ? follow : 0, 0, 0, 0) === 0 : false;
      if (ok) fingers_of(this.ctx, this.slot, arm, curl >= 0 ? curl : (follow > 0.5 ? 0.8 : 0.35), null);         // (a creature with fingers closes the hand on it: 0.35 for a body held level, 0.8 for a tool)
      return ok;
    };
    MP.ungrip = function (arm, x, y, z) {
      const ok = env.grip ? env.grip.cmd(this.ctx.js, this.slot, this.gen, arm === undefined ? 255 : arm, 2, 0, x || 0, y || 0, z || 0, 0) === 0 : false;      // (arm undefined: every arm; (x, y, z) a throw, world units a second, on top of the hand's own velocity)
      if (ok) { const list = arms_of(this.ctx); for (let i = 0; i < list.length; i++) if (arm === undefined || arm === 255 || list[i].j === arm) fingers_of(this.ctx, this.slot, list[i].j, 0, null); }
      return ok;
    };
    // the fingers by hand: me.fingers(arm, curl [, { thumb, stiffness }]) bends the arm's fingers toward the palm (0 open .. 1 a fist); -> false for a creature with no finger bones. me.has_fingers([arm])
    MP.fingers = function (arm, curl, o) { return fingers_of(this.ctx, this.slot, arm, curl, o || null); };
    MP.has_fingers = function (arm) { const h = env.species(this.ctx.js), t = h ? h.fingers : null; if (!t) return false; if (arm === undefined) return true; for (let i = 0; i < t.length; i++) if (t[i].arm === arm) return true; return false; };
    MP.gripping = function (arm) { return env.grip ? env.grip.held(this.ctx.js, this.slot, arm) : false; };
    // HOW A HELD BODY IS HELD (world.cpp, CMD_HAPPY_HOLD; SYSTEM.md "Holding things"), said after me.grip, to the arm that holds: me.hold_pose(arm, ox, oy, oz, rx, ry, rz) the body goes to a pose (its centre from the hand in the creature's frame, its
    // turn as a rotation vector: a sword that points up and forward whatever the wrist does); me.hold_hang(arm, length, damping) it hangs from the hand on a pendulum and swings; me.hold_line(arm, lx, ly, lz, ux, uy, uz) one of the two hands of a LONG
    // body (where on it, and its up); me.hold_rigid(arm) the plain offset again. me.mount(id, body, bone, ox, oy, oz, rx, ry, rz) the body RIDES on a bone (a holster, a sling, a shoulder, a back: the offset and turn in the bone's frame; the bone's NUMBER),
    // me.unmount(id) lets it go. All answer true when the worker took the word
    MP.hold_pose = function (arm, ox, oy, oz, rx, ry, rz) { return env.grip && env.grip.hold ? env.grip.hold(this.ctx.js, this.slot, this.gen, arm, 1, ox, oy, oz, rx, ry, rz) === 0 : false; };
    MP.hold_hang = function (arm, length, damping) { return env.grip && env.grip.hold ? env.grip.hold(this.ctx.js, this.slot, this.gen, arm, 2, length, damping > 0 ? damping : 0, 0, 0, 0, 0) === 0 : false; };
    MP.hold_line = function (arm, lx, ly, lz, ux, uy, uz) { return env.grip && env.grip.hold ? env.grip.hold(this.ctx.js, this.slot, this.gen, arm, 3, lx, ly, lz, ux, uy, uz) === 0 : false; };
    MP.hold_rigid = function (arm) { return env.grip && env.grip.hold ? env.grip.hold(this.ctx.js, this.slot, this.gen, arm, 4, 0, 0, 0, 0, 0, 0) === 0 : false; };
    MP.mount = function (id, body, bone, ox, oy, oz, rx, ry, rz) {
      if (!env.grip || !env.grip.hold || !(id >= 0 && id < 16)) return false;
      if (env.grip.cmd(this.ctx.js, this.slot, this.gen, id, 3, body, 0, 0, 0, bone) !== 0) return false;
      return env.grip.hold(this.ctx.js, this.slot, this.gen, 16 + id, 1, ox || 0, oy || 0, oz || 0, rx || 0, ry || 0, rz || 0) === 0;
    };
    MP.unmount = function (id) { return env.grip && id >= 0 && id < 16 ? env.grip.cmd(this.ctx.js, this.slot, this.gen, 16 + id, 2, 0, 0, 0, 0, 1) === 0 : false; };
    // a weight ON the creature that no hand holds (a pack: world.cpp's worn loads, SYSTEM.md "Carrying: the posture"): me.wear(id, kg, bone, x, y, z) -> true when it is on (id 0 .. 3, the same id again replaces it; bone: the skeleton's bone NUMBER, -1: the
    // root; (x, y, z): its centre in the model's axes in the bind pose, metres at scale 1: [0, 1.38, -0.22] is a pack on a person's back); me.unwear(id) takes it off (no id: every load). It slows the mover, shortens the steps and leans the creature like a held load
    MP.wear = function (id, kg, bone, x, y, z) { return env.grip && env.grip.wear ? env.grip.wear(this.ctx.js, this.slot, this.gen, 1, id, bone < 0 ? 0xffffffff : bone, x, y, z, kg) === 0 : false; };
    // DUCKING UNDER A CEILING (body.cpp; SYSTEM.md "Ducking under a ceiling"): a walker ducks by itself under what is over its way. me.duck(false) turns that off (it walks through), me.duck(true [, margin]) on again (margin: a share of its
    // height, 0 .. 0.3, 0.04 how far its head stays under); me.headroom is the height of the lowest ceiling it looks at, in metres over its floor (-1: none); me.ducking how far of its lowest it is (0 .. 1); me.duck_blocked is true
    // when the way ahead is lower than the most it can come down to (it stops short of it: take another way)
    MP.duck = function (on, margin) { return env.grip && env.grip.duck ? env.grip.duck(this.ctx.js, this.slot, this.gen, on === false ? 0 : 1, margin > 0 ? margin : 0.04) === 0 : false; };
    Object.defineProperty(MP, "headroom", { get: function () { return env.grip && env.grip.read ? env.grip.read(this.ctx.js, this.slot, 22) : -1; } });
    Object.defineProperty(MP, "ducking", { get: function () { return env.grip && env.grip.read ? env.grip.read(this.ctx.js, this.slot, 24) : 0; } });
    Object.defineProperty(MP, "duck_blocked", { get: function () { return env.grip && env.grip.read ? env.grip.read(this.ctx.js, this.slot, 23) > 0.5 : false; } });
    MP.unwear = function (id) { return env.grip && env.grip.wear ? env.grip.wear(this.ctx.js, this.slot, this.gen, 2, id === undefined ? 255 : id, 0, 0, 0, 0, 0) === 0 : false; };
    Object.defineProperty(MP, "load", { get: function () { return env.grip ? env.grip.load(this.ctx.js, this.slot) : 0; } });                  // (the mass its hands carry, kilograms of the world)
    MP.fly = function (on) {                                                                               // (a creature that cannot fly is told no: nothing is written; the family's stats count it, `flight` says it beforehand)
      if (D.fly(this.ctx.fam, this.slot, on ? 1 : 2) !== 0) { this.ctx.stats.no_fly++; return false; }
      return true;
    };
    MP.climb = function (vy) { D.climb(this.ctx.fam, this.slot, vy); };
    MP.say = function (tag, value) {
      const c = this.ctx;
      if (c.out_n >= OUT_MAX) { c.stats.dropped++; return; }
      c.stats.said++;
      const i = c.out_n++ * 4;
      c.out[i] = (c.js << 16) | this.slot; c.out[i + 1] = this.gen; c.out[i + 2] = tag; c.outf[i + 3] = value;
    };
    // me.fx(name, intensity): the creature asks its particles (the `particles` section of its file) to play: a loop of `while: "mind"` is given the intensity 0 .. 1 (0 puts it out), a `once: "mind"` is played once, `intensity` times bigger (1).
    // The page hears the event "fx:<name>" (runtime.js); a creature that has no such particle says it to nobody
    MP.fx = function (name, intensity) {
      const c = this.ctx, tags = c.fx_tags || (c.fx_tags = Object.create(null));
      let t = tags[name];
      if (t === undefined) t = tags[name] = env.lib.tag("fx:" + name);
      this.say(t, intensity === undefined ? 1 : +intensity);
    };
    MP.rand = function () {                                                                                // (xorshift32, one state a family)
      const st = this.ctx.rng;
      let x = st[0];
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      st[0] = x;
      return (x >>> 0) / 4294967296;
    };

    // ---- a creature's context
    function Ctx(js, name, fam, max) {
      this.js = js; this.name = name; this.fam = fam; this.max = max; this.hooks = null; this.me = new Me(this); this.api = null;
      this.rt = null; this.pool = null; this.serial = 0; this.frame = 0; this.gb = null; this.arm_list = null; this.st_walk = null;
      this.seen = new Uint8Array(max); this.seen_gen = new Uint16Array(max); this.acc = new Float32Array(max);
      this.out = new Int32Array(OUT_MAX * 4); this.outf = new Float32Array(this.out.buffer); this.out_n = 0; this.rng = new Uint32Array([2463534242 ^ js]);
      this.errors = Object.create(null); this.stats = { thinks: 0, spawns: 0, releases: 0, no_slot: 0, no_fly: 0, dropped: 0, errors: 0, ai_visits: 0, ai_ms: 0, said: 0, flushed: 0, hits: 0 };
      this.styles = []; this.drain = null; this.tags_sent = 0; this.ai = null; this.time = 0; this.m = { id: 0, slot: 0, n: 0, a: new Float32Array(1024) }; this.mail_at = -1;
      this.mind = true; this.mind_off = new Uint8Array(max); this.mind_pend = new Uint8Array(max);                                              // (THE MIND: whether the creature's own function decides for the family, and for each instance; what was asked of an instance that was not seen yet: 1 on, 2 off)
      this.ai_watch = false; this.ai_paused = false; this.ai_tag = -1; this.ai_last = new Int16Array(max).fill(-2);
      this.ai_gtag = -1; this.ai_gait_last = new Int16Array(max).fill(-2); this.style_names = [];                                  // (the gait that the tree put on an instance, and the names of the styles that api.style made: the page's gait log)
      this.pv_kind = new Uint8Array(max); this.pv_name = new Array(max).fill(""); this.pv_th = new Float32Array(max); this.pv_sp = new Float32Array(max); this.pv_age = new Float32Array(max); this.pv_n = 0; this.pv_tag = -1;     // (the page's PREVIEWS of a clip or a gait: AI_BASE + 4 ..)
      this.grid = env.grid ? env.grid.create(max) : null; this.gx = new Uint8Array(max); this.group = -1; this.radius = 0; this.length = 0;                                 // (who is near whom: the grid, and the instances that asked to be left out of it and of every query: api.world.exclude; the family's group)
      this.cfg = null; this.rec_base = -1;                                                                                                                                       // (what the page gave the family as data: system.species(def, { cfg }) -> api.cfg; and where its block of the blackboard's records begins)
      this.fprops = null; this.fp_held = null; this.fp_busy = null; this.fp_gen = null; this.fp_free = null; this.fp_fired = null; this.fp_tags = null; this.fp_arg_tag = -1; this.fp_aimed = null; this.fp_aim_gen = null; this.fp_aim_at = null;                                                 // (the family props the page gave: runtime.js, the mind's verbs take / put / release / throw)
      this.props = null; this.prop_on = null; this.fresh_at = -1; this.prep_at = -1; this.prep_n = 0; this.use_grid = false;                                                     // (when the columns were taken again, and the grid built, last: an epoch of the worker's frame)
    }
    const fail = function (ctx, what, e) {
      ctx.stats.errors++; stats.errors++;
      const n = (ctx.errors[what] || 0) + 1;
      ctx.errors[what] = n;
      if (n <= MAX_ERRORS) env.post("happy_worker_error", { what: "creature " + ctx.name + ": " + what, message: String(e && e.stack || e) + (n === MAX_ERRORS ? "\n(this hook is taken out)" : "") });
      if (n >= MAX_ERRORS) {
        if (what === "emit" || what === "end") ctx.hooks.on[what] = null; else if (what === "ai") ctx.ai = null; else ctx.hooks[what] = null;
      }
    };

    // ---- THE WORLD SERVICE (pure.js: api.group, api.world): what it asks of this logic. An EPOCH is a phase of the worker's frame (the page's messages, the tick, a page's own send): what a family was made ready for in
    // it is ready for the rest of it. A family is made ready for who-is-near questions once an epoch, when asked: its columns taken again if the wasm's memory has grown, its grid built from its rows
    const epoch = { n: 0 };
    const fresh = function (c) {
      if (c.fresh_at !== epoch.n) { c.fresh_at = epoch.n; env.cols.refresh(c.fam); }
      return c.fam.live;
    };
    const prepare = function (c) {                                                                          // -> how many are alive and not left out; -1: the family's columns are not there
      if (c.prep_at !== epoch.n) {
        c.prep_at = epoch.n;
        if (!fresh(c)) { c.prep_n = -1; c.use_grid = false; }
        else {
          const f = c.fam, n = f.max < c.max ? f.max : c.max;
          if (c.grid !== null) c.prep_n = c.grid.build(f.ROOT, f.ALIVE, n, c.api.grid_cell, c.gx);
          else { let k = 0; for (let s = 0; s < n; s++) if (f.ALIVE[s] !== 0 && c.gx[s] === 0) k++; c.prep_n = k; }
          c.use_grid = c.grid !== null && c.prep_n >= GRID_MIN;
        }
      }
      return c.prep_n;
    };
    // a hit: the victim's `hit` hook with `me` at the victim; `me` is put back at what it was (an attacker of the same family keeps its own `me`). The hook's mistakes are reported as any hook's
    const deliver_hit = function (c, slot, damage, from) {
      const me = c.me, prev = me.slot, hk = c.hooks.hit;
      c.stats.hits++;
      set_me(c, slot);
      try { hk(me, damage, from); } catch (e) { fail(c, "hit", e); }
      if (prev >= 0 && prev !== slot) set_me(c, prev);
    };
    const BD = env.board || null, SW = env.sworld || null;
    const W = env.world_service ? env.world_service.create({ families: ctxs, prepare: prepare, fresh: fresh, touch: function (c) { c.prep_at = -1; }, deliver: deliver_hit }) : null;
    L.world = W;
    // THE FINGERS of a hand (pure.js; the table is the page's, given with the species: env.species(js).fingers; env.pose_bone the wasm's bone pose): the hand's fingers bend toward the palm, curl 0 (open) .. 1 (a fist).
    // -> true when the creature has fingers for that arm. Nothing is allocated unless they are posed (a closure a call: a grip begins or ends, not every frame)
    const fingers_of = function (ctx, slot, arm, curl, o) {
      const h = env.species(ctx.js), t = h ? h.fingers : null;
      if (!t || !env.fingers || !env.pose_bone) return false;
      for (let i = 0; i < t.length; i++) if (t[i].arm === arm) {
        const js = ctx.js, gen = ctx.fam.GEN[slot], pb = env.pose_bone, st = o && o.stiffness !== undefined ? o.stiffness : 14;
        env.fingers.apply(t[i], curl, o, function (bone, rx, ry, rz) { pb(js, slot, gen, bone, rx, ry, rz, st); });
        return true;
      }
      return false;
    };
    // THE PROPS a creature shows and hides (its definition's `props`, species.js compile_props; SYSTEM.md "Props a creature shows and hides"): a prop is a bone that carries an island of the sdf (the knight's sword), drawn with the creature. SHOWING it is
    // the SCALE of its bone 1 (every bone of the skinning rows has one: [t, s] [R]), HIDING it is 0: every vertex of the bone falls to the bone's head and its triangles have no area (the engine's happy_skeleton_scale: not eased, the pose of the bone
    // is its own business). A prop with several places (`bones: { hand, back }`) shows one at a time. Said once, not every frame: the scale stays until the next word. A new instance (and a slot used again) begins as the definition says (`start`, `hidden`)
    const prop_put = function (ctx, slot, k, where) {
      const p = ctx.props[k], bs = env.bone_scale;
      if (!bs) return false;
      const js = ctx.js, gen = ctx.fam.GEN[slot];
      for (let i = 0; i < p.places.length; i++) bs(js, slot, gen, p.places[i].bone, i === where ? 1 : 0);
      ctx.prop_on[k][slot] = where + 1;
      return true;
    };
    const props_start = function (ctx, slot) { for (let k = 0; k < ctx.props.length; k++) prop_put(ctx, slot, k, ctx.props[k].start); };
    // me.prop_show(h [, where]): where is a place's name ("back"), its number, true (the first place), none (the first place); false or null hides. -> true when the scale was said (false: a place that is not there, or a worker whose wasm has no bone scale)
    MP.prop_show = function (h, where) {
      const ctx = this.ctx, p = ctx.props !== null ? ctx.props[h] : undefined;
      if (p === undefined) return false;
      let k = 0;
      if (where === false || where === null) k = -1;
      else if (typeof where === "string") { k = -1; for (let i = 0; i < p.places.length; i++) if (p.places[i].name === where) k = i; if (k < 0) return false; }
      else if (typeof where === "number") { if (!(where >= 0 && where < p.places.length)) return false; k = where | 0; }
      return prop_put(ctx, this.slot, h, k);
    };
    MP.prop_hide = function (h) { return this.prop_show(h, false); };
    MP.prop_shown = function (h) { const ctx = this.ctx; return ctx.props !== null && ctx.props[h] !== undefined ? ctx.prop_on[h][this.slot] - 1 : -1; };      // (the number of the place shown, -1 hidden)
    // ---- THE FAMILY PROPS (the file's `props`, runtime.js): things that only the family knows (an axe, a rifle, a bomb), drawn by the page. The page is where they are; the mind says what it wants (an event the page does:
    // "prop:take:axe", "prop:put:...", "prop:rel:...", "prop:thr:..." with the numbers of a throw before it, "prop:arg") and counts by itself, so that `holding` is right at once: what it holds (a mask of the instance's own `per` places) and what is busy
    // (held, or thrown and not back in the pool yet). The page tells the truth back (PSYNC) after everything it does, with the instance's generation: a mask of another generation is no mask. A prop is named by its name or by the handle that
    // api.fprop(name) made. `where` is "grip" (the default of a prop that has one), "off", "rest" or one of the prop's `places`. THREE THINGS NOT TO EXPECT: a call that says no (-1, false) says it at once; what the page refuses (a mistake in the
    // file) is told by the next PSYNC; an instance that is not seen by the page yet (a frame old) has its events dropped.
    const fp_index = function (ctx, what, verb) {
      const list = ctx.fprops;
      if (list === null) throw new Error("happy_worker_logic: " + ctx.name + ": me." + verb + ": the creature has no props (the file's `props` and the ability \"props\")");
      if (typeof what === "number") { if (what >= 0 && what < list.length && what === (what | 0)) return what; }
      else for (let i = 0; i < list.length; i++) if (list[i].name === what) return i;
      throw new Error("happy_worker_logic: " + ctx.name + ": me." + verb + "('" + what + "'): no such prop (" + list.map(function (p) { return p.name; }).join(", ") + ")");
    };
    const fp_masks = function (ctx, me, i) {                                                               // the index of this instance's masks of prop i: made new when they are of another generation
      const idx = me.slot * ctx.fprops.length + i;
      if (ctx.fp_gen[idx] !== me.gen) { ctx.fp_gen[idx] = me.gen; ctx.fp_held[idx] = 0; ctx.fp_busy[idx] = 0; }
      return idx;
    };
    const fp_where = function (ctx, P, where, verb) {                                                      // the number the page reads: 0 the default, else the place in the prop's list + 1
      if (where === undefined || where === null) return 0;
      const k = P.where.indexOf(where);
      if (k < 0) throw new Error("happy_worker_logic: " + ctx.name + ": me." + verb + ": the prop '" + P.name + "' has no place '" + where + "' (" + P.where.join(", ") + ")");
      return k + 1;
    };
    const fp_say = function (me, verb, P, value) {
      const ctx = me.ctx, tags = ctx.fp_tags || (ctx.fp_tags = Object.create(null)), key = verb + ":" + P.name;
      let t = tags[key];
      if (t === undefined) t = tags[key] = env.lib.tag("prop:" + key);
      me.say(t, value);
    };
    const fp_arg = function (me, v) {
      const ctx = me.ctx;
      if (ctx.fp_arg_tag < 0) ctx.fp_arg_tag = env.lib.tag("prop:arg");
      me.say(ctx.fp_arg_tag, v);
    };
    const fp_first = function (mask, k) {                                                                  // the place asked for, or the first that is in the mask: -1 none
      if (k !== undefined && k !== null) return k >= 0 && k < 8 && ((mask >> k) & 1) === 1 ? k : -1;
      for (let j = 0; j < 8; j++) if (((mask >> j) & 1) === 1) return j;
      return -1;
    };
    const fp_count = function (mask) { let n = 0; for (let j = 0; j < 8; j++) n += (mask >> j) & 1; return n; };
    // me.take(prop [, where]) -> the place (0 .. per - 1) it took, -1 when the instance has all its `per` busy
    MP.take = function (what, where) {
      const ctx = this.ctx, i = fp_index(ctx, what, "take"), P = ctx.fprops[i], idx = fp_masks(ctx, this, i), w = fp_where(ctx, P, where, "take");
      let k = 0;
      while (k < P.per && ((ctx.fp_busy[idx] >> k) & 1) === 1) k++;
      if (k === P.per || ctx.fp_free[i] === 0) return -1;                                                 // (all its own are busy, or a shared pool has none free)
      ctx.fp_held[idx] |= 1 << k; ctx.fp_busy[idx] |= 1 << k;
      if (ctx.fp_free[i] > 0) ctx.fp_free[i]--;
      fp_say(this, "take", P, w + 16 * k);
      return k;
    };
    // me.put(prop, where [, k]) -> true: one it holds goes to another place (the axe from the back to the hand); false: it holds none
    MP.put = function (what, where, k) {
      const ctx = this.ctx, i = fp_index(ctx, what, "put"), P = ctx.fprops[i], idx = fp_masks(ctx, this, i), w = fp_where(ctx, P, where, "put");
      const j = fp_first(ctx.fp_held[idx], k);
      if (j < 0) return false;
      fp_say(this, "put", P, w + 16 * j);
      return true;
    };
    // me.release(prop [, k]) -> true: it gives one it holds back to the pool (hidden); false: it holds none
    MP.release = function (what, k) {
      const ctx = this.ctx, i = fp_index(ctx, what, "release"), P = ctx.fprops[i], idx = fp_masks(ctx, this, i), j = fp_first(ctx.fp_held[idx], k);
      if (j < 0) return false;
      ctx.fp_held[idx] &= ~(1 << j); ctx.fp_busy[idx] &= ~(1 << j); ctx.fp_aimed[idx] &= ~(1 << j);
      if (ctx.fp_free[i] >= 0 && ctx.fp_free[i] < P.pool) ctx.fp_free[i]++;
      fp_say(this, "rel", P, j);
      return true;
    };
    // me.throw(prop [, speed [, up [, k]]]) -> true: one it holds leaves the hand along the way it faces, `speed` m/s (the prop's `throw.speed`), `up` radians over the horizon (0.3); it is busy until it is back in the pool
    MP.throw = function (what, speed, up, k) {
      const ctx = this.ctx, i = fp_index(ctx, what, "throw"), P = ctx.fprops[i], idx = fp_masks(ctx, this, i);
      if (!P.can_throw) throw new Error("happy_worker_logic: " + ctx.name + ": me.throw: the prop '" + P.name + "' has no `throw` section");
      const j = fp_first(ctx.fp_held[idx], k);
      if (j < 0) return false;
      ctx.fp_held[idx] &= ~(1 << j); ctx.fp_aimed[idx] &= ~(1 << j);
      fp_arg(this, speed > 0 ? speed : P.speed); fp_arg(this, up === undefined || up === null ? 0.3 : +up);
      fp_say(this, "thr", P, j);
      return true;
    };
    // me.throw_at(prop, x, y, z [, speed [, k]]) -> true: the same toward a point of the world (the low arc: the page solves it from where the hand is)
    MP.throw_at = function (what, x, y, z, speed, k) {
      const ctx = this.ctx, i = fp_index(ctx, what, "throw_at"), P = ctx.fprops[i], idx = fp_masks(ctx, this, i);
      if (!P.can_throw) throw new Error("happy_worker_logic: " + ctx.name + ": me.throw_at: the prop '" + P.name + "' has no `throw` section");
      const j = fp_first(ctx.fp_held[idx], k);
      if (j < 0) return false;
      if (P.can_aim) {                                                                                       // (a prop that has a muzzle (a rocket in its launcher) leaves it pointing at the point: it takes aim first, and goes when the page says it is aimed)
        if (ctx.time - ctx.fp_aim_at[idx] > 0.25) fp_aim_say(this, P, idx, j, x, y, z);
        if (ctx.fp_aim_gen[idx] !== this.gen || ((ctx.fp_aimed[idx] >> j) & 1) === 0) return false;
      }
      ctx.fp_held[idx] &= ~(1 << j); ctx.fp_aimed[idx] &= ~(1 << j);
      fp_arg(this, +x); fp_arg(this, +y); fp_arg(this, +z); fp_arg(this, speed > 0 ? speed : P.speed);
      fp_say(this, "thr", P, j + 16);
      return true;
    };
    // me.fire(prop, x, y, z [, k]) -> true: a prop it holds (in a hand) fires at a point of the world: the page takes the muzzle from the prop and fires the hitscan (its `fire` section: damage, spread, pellets); false when it holds none or the weapon's `rate` (shots a second) says it is too soon:
    // the worker paces it by its own time; a prop with no `fire` section is an error
    MP.fire = function (what, x, y, z, k) {
      const ctx = this.ctx, i = fp_index(ctx, what, "fire"), P = ctx.fprops[i], idx = fp_masks(ctx, this, i);
      if (!P.can_fire) throw new Error("happy_worker_logic: " + ctx.name + ": me.fire: the prop '" + P.name + "' has no `fire` section");
      const j = fp_first(ctx.fp_held[idx], k);
      if (j < 0) return false;
      if (x === undefined || x === null) {                                                                 // (no point: it fires where it looks, the way the barrel points)
        if (ctx.time - ctx.fp_fired[idx] < P.fire_gap - 1e-9) return false;
        ctx.fp_fired[idx] = ctx.time;
        fp_say(this, "fif", P, j);
        return true;
      }
      if (ctx.time - ctx.fp_aim_at[idx] > 0.25) fp_aim_say(this, P, idx, j, x, y, z);                    // (taking aim is part of firing: a call keeps the weapon on the point)
      if (ctx.time - ctx.fp_fired[idx] < P.fire_gap - 1e-9) return false;                                // (too soon for the weapon's `rate`: by the worker's own time)
      if (ctx.fp_aim_gen[idx] !== this.gen || ((ctx.fp_aimed[idx] >> j) & 1) === 0) return false;        // (the page says when it points there: nothing is fired out of a weapon that looks elsewhere)
      ctx.fp_fired[idx] = ctx.time;
      fp_arg(this, +x); fp_arg(this, +y); fp_arg(this, +z);
      fp_say(this, "fir", P, j);
      return true;
    };
    // me.aim(prop, x, y, z [, k]) -> true: the weapon it holds is brought to bear on a point of the world (the page does it: a creature with arms brings it to the shoulder, both hands on it, and swings the barrel; a weapon that is mounted on a bone is measured), me.aimed(prop [, k]) -> true when it points
    // there, within the weapon's `fire.aim_tol`. Say it at every visit: a weapon that is not told for a second is lowered. me.aim_off(prop [, k]) lowers it at once. me.fire says it too (and fires only when it is aimed)
    const fp_aim_say = function (me, P, idx, j, x, y, z) {
      fp_arg(me, +x); fp_arg(me, +y); fp_arg(me, +z);
      fp_say(me, "aim", P, j);
      me.ctx.fp_aim_at[idx] = me.ctx.time;
    };
    MP.aim = function (what, x, y, z, k) {
      const ctx = this.ctx, i = fp_index(ctx, what, "aim"), P = ctx.fprops[i], idx = fp_masks(ctx, this, i);
      if (!P.can_aim) throw new Error("happy_worker_logic: " + ctx.name + ": me.aim: the prop '" + P.name + "' has no muzzle (a `fire` section, or `aim.muzzle`)");
      const j = fp_first(ctx.fp_held[idx], k);
      if (j < 0) return false;
      fp_aim_say(this, P, idx, j, x, y, z);
      return true;
    };
    // me.turn(prop, yaw, pitch [, k]) -> true: a weapon that has joints (a rig: a turret on a car, on a dog's back) is turned to those angles, radians from where it looks when it is at rest (yaw positive to the left, pitch positive up), within the joints' ranges and at their rates: the controller's own way
    // of pointing it (a gunner at the controls, a central AI that drives both the carrier and the weapon). me.fire(prop) with no point fires where it looks. A weapon that is turned by hand is not aimed at a point until it says so
    MP.turn = function (what, yaw, pitch, k) {
      const ctx = this.ctx, i = fp_index(ctx, what, "turn"), P = ctx.fprops[i], idx = fp_masks(ctx, this, i);
      if (!P.can_turn) throw new Error("happy_worker_logic: " + ctx.name + ": me.turn: the prop '" + P.name + "' has no joints (a weapon that turns is a rig: SYSTEM.md \"Weapons are real\")");
      const j = fp_first(ctx.fp_held[idx], k);
      if (j < 0) return false;
      ctx.fp_aimed[idx] &= ~(1 << j); ctx.fp_aim_at[idx] = -1e9;
      fp_arg(this, +yaw); fp_arg(this, +pitch);
      fp_say(this, "trn", P, j);
      return true;
    };
    MP.aim_off = function (what, k) {
      const ctx = this.ctx, i = fp_index(ctx, what, "aim_off"), P = ctx.fprops[i], idx = fp_masks(ctx, this, i), j = fp_first(ctx.fp_held[idx], k);
      if (j < 0) return false;
      ctx.fp_aimed[idx] &= ~(1 << j); ctx.fp_aim_at[idx] = -1e9;
      fp_say(this, "aof", P, j);
      return true;
    };
    MP.aimed = function (what, k) {
      const ctx = this.ctx, i = fp_index(ctx, what, "aimed"), idx = fp_masks(ctx, this, i);
      if (ctx.fp_aim_gen[idx] !== this.gen) return false;
      const mask = ctx.fp_aimed[idx] & ctx.fp_held[idx];
      return k === undefined || k === null ? mask !== 0 : ((mask >> k) & 1) === 1;
    };
    // me.holding(prop) -> how many it holds (attached: in a hand, on the back); me.holding(prop, k) -> whether it holds the place k.  me.thrown(prop) -> how many it threw that are not back in the pool.  me.pool_free(prop) -> how many it may take now
    MP.holding = function (what, k) {
      const ctx = this.ctx, i = fp_index(ctx, what, "holding"), held = ctx.fp_held[fp_masks(ctx, this, i)];
      return k === undefined || k === null ? fp_count(held) : ((held >> k) & 1) === 1;
    };
    MP.thrown = function (what) { const ctx = this.ctx, i = fp_index(ctx, what, "thrown"), idx = fp_masks(ctx, this, i); return fp_count(ctx.fp_busy[idx] & ~ctx.fp_held[idx]); };
    MP.pool_free = function (what) { const ctx = this.ctx, i = fp_index(ctx, what, "pool_free"), idx = fp_masks(ctx, this, i), own = ctx.fprops[i].per - fp_count(ctx.fp_busy[idx]), fam = ctx.fp_free[i]; return fam < 0 ? own : Math.max(0, Math.min(own, fam)); };
    // how many of a SHARED pool the family has free (PPOOL, the page's word, for the whole family): a number for each prop, -1 for one that is not shared
    const fp_pool = function (ctx, F, at, cnt) {
      if (ctx.fprops === null) return;
      for (let i = 0; i < ctx.fprops.length && i < cnt; i++) if (F[at + i] >= 0) ctx.fp_free[i] = F[at + i] | 0;
    };
    // the page's truth (PSYNC): [gen] then [held mask, busy mask] of every prop, in the order of the list
    const fp_sync = function (ctx, slot, F, at, cnt) {
      if (ctx.fprops === null || slot >= ctx.max) return;
      const n = ctx.fprops.length, gen = F[at] | 0;
      for (let i = 0; i < n && 2 + 2 * i < cnt; i++) {
        const idx = slot * n + i;
        ctx.fp_gen[idx] = gen; ctx.fp_held[idx] = F[at + 1 + 2 * i] | 0; ctx.fp_busy[idx] = F[at + 2 + 2 * i] | 0;
      }
    };
    // the page's word about what is aimed (PAIM): [gen] then the aimed mask of every prop, in the order of the list
    const fp_aim_sync = function (ctx, slot, F, at, cnt) {
      if (ctx.fprops === null || slot >= ctx.max) return;
      const n = ctx.fprops.length, gen = F[at] | 0;
      for (let i = 0; i < n && 1 + i < cnt; i++) { const idx = slot * n + i; ctx.fp_aim_gen[idx] = gen; ctx.fp_aimed[idx] = F[at + 1 + i] | 0; }
    };
    // me.pose(bone, rx, ry, rz [, x, y, z [, stiffness]]): any bone of the skeleton by its NUMBER, a turn about the bone's head (radians) and a slide in its parent's frame; stiffness 1/s (0: at once). api.prop's bones are the usual use (a swing of the sword)
    MP.pose = function (bone, rx, ry, rz, x, y, z, stiffness) {
      const pb = env.pose_bone;
      return pb ? pb(this.ctx.js, this.slot, this.gen, bone, rx || 0, ry || 0, rz || 0, stiffness || 0, x || 0, y || 0, z || 0) === 0 : false;
    };
    // THE HANDS' TASK (pure.js; env.grab is the module, env.grip the wasm's half: world.cpp's exports): optional, a family has no task until a brain says me.grab
    const GB = env.grab && env.grip ? env.grab.create({ D: D, K: K, grip: env.grip, arms: arms_of, fingers: fingers_of }) : null;
    L.grab = GB;

    // ---- the blackboard's record of an instance, and the claims it holds, when it appears and when it is gone
    const born = function (ctx, s) {
      if (BD === null || ctx.rec_base < 0) return;
      const r = ctx.rec_base + s, c = ctx.cfg;
      BD.reset(r);
      if (c) { if (c.faction) BD.faction[r] = BD.faction_id(c.faction); if (c.kind) BD.kind[r] = BD.kind_id(c.kind); if (c.hp > 0) BD.hp[r] = c.hp; if (c.keys > 0) BD.flags[r] = c.keys & 255; }
    };
    const gone = function (ctx, s) {
      if (SW !== null) SW.release_all((ctx.js << 16) | s);
      if (BD !== null && ctx.rec_base >= 0) BD.reset(ctx.rec_base + s);
    };

    // ---- api
    function make_api(ctx) {
      const fam = ctx.fam, api = { name: ctx.name, max: ctx.max, fam: fam, K: K, hit: new Float64Array(7), out: new Int32Array(64), near_d2: 0, grid_cell: 4 };
      // an action: a name of the library, a spec (an object with phases), or a DESIGN (from / mix / meta / edits / tweaks: pure.js) -> a handle. The same design is the same handle.
      api.action = function (x) {
        if (typeof x === "string") return env.lib.get(x);
        if (x && typeof x === "object" && x.phases !== undefined) {                                           // a spec: with a name that is free (or that a creature defined) it is the creature's own action by that name; the same spec again is the same handle
          if (typeof x.name === "string" && x.name && typeof env.lib.define === "function" && (env.lib.named[x.name] === undefined || env.lib.owned[x.name] !== undefined)) { env.lib.define(x, JSON.stringify(x)); return env.lib.get(x.name); }
          return env.lib.add(x);
        }
        if (!env.design) throw new Error("happy_worker_logic: " + ctx.name + ": api.action(design) needs the designer in the worker");
        const key = "a" + JSON.stringify(x);
        let h = L.cache[key];
        if (h === undefined) { h = env.lib.add(env.design.action(x)); L.cache[key] = h; }
        return h;
      };
      // a gait style: a design (blend / tweaks / dials / amounts, a recipe or a generator: design.js) -> the style (registered by its name)
      api.gait = function (design) {
        if (!env.design) throw new Error("happy_worker_logic: " + ctx.name + ": api.gait needs the designer in the worker");
        return env.design.gait(design);
      };
      // the instance `slot` as `me` (for a hook that was not given one: message, tick)
      api.at = function (slot) { set_me(ctx, slot); return ctx.me; };
      // a style that will not be asked for again lets go of its entry (and of what the designs cache of it)
      api.style_drop = function (h) {
        if (ctx.pool === null) return;
        ctx.pool.drop(h);
        for (const k in L.cache) if (L.cache[k] === h && k.charAt(0) !== "a") delete L.cache[k];
      };
      // a PROP the creature's definition declared (`props: { sword: { bone: "sword" } }`): its handle, for me.prop_show / me.prop_hide / me.prop_shown. Throws for a name the definition does not have
      api.prop = function (name) {
        const list = ctx.props || [];
        for (let i = 0; i < list.length; i++) if (list[i].name === name) return i;
        throw new Error("happy_worker_logic: " + ctx.name + ": api.prop('" + name + "'): the definition has no such prop (props: { " + name + ": { bone: ... } }" + (list.length ? "; it has " + list.map(function (p) { return p.name; }).join(", ") : "") + ")");
      };
      // a FAMILY PROP (the file's `props`): its handle, for the verbs of the mind (me.take, me.release, me.holding ...: they take the name as well). Throws for a name the file does not have
      api.fprop = function (name) { return fp_index(ctx, name, "fprop"); };
      api.fprop_can = function (name, verb) { const i = fp_index(ctx, name, "fprop_can"), P = ctx.fprops[i]; return verb === "throw" ? !!P.can_throw : verb === "fire" ? !!P.can_fire : verb === "aim" ? !!P.can_aim : verb === "turn" ? !!P.can_turn : false; };          // (whether a prop has a `throw` / a `fire` section, or a muzzle to aim by: the verbs of it that are errors otherwise)
      api.fprop_names = function () { return ctx.fprops === null ? [] : ctx.fprops.map(function (p) { return p.name; }); };           // (the names of the family's props, in the order of the file: a function that serves many creatures asks)
      api.catalog = function () { return env.design ? env.design.catalog() : null; };
      api.tag = function (name) { return env.lib.tag(name); };
      // A RICH ANSWER for the page: what the page ASKED for (a message of its own: the goals block's report, `msg_report`), never what happens every frame (that is me.say: numbers, on change). `topic` says what it is; the page hears it as
      // engine.happy_worker_<topic>(data) (runtime.js routes "goals" to sp.on_worker_goals(data)). `data` is a plain object (it is copied on its way: no function, no cycle); the family's id is written into it as `js`.
      // false when the worker has no way to post (a test of the logic alone)
      api.post = function (topic, data) {
        if (typeof env.post !== "function") return false;
        data.js = ctx.js;
        env.post("happy_worker_" + topic, data);
        return true;
      };
      // the AI of the family (pure.js): the statuses a `call` leaf answers, and two things a hook may ask of it: `restart(me)` takes what the instance does off, so that it decides again at its next visit; `wake(slot)` makes it be visited at once
      api.ai = { OK: 0, RUNNING: 1, FAIL: 2, restart: function (me) { if (ctx.ai !== null) ctx.ai.restart(me, ctx.time); }, wake: function (slot) { if (ctx.ai !== null) ctx.ai.poke(slot); } };
      api.f32 = function () { return new Float32Array(ctx.max); }; api.u8 = function () { return new Uint8Array(ctx.max); };
      api.i32 = function () { return new Int32Array(ctx.max); }; api.u16 = function () { return new Uint16Array(ctx.max); };
      api.rand_seed = function (n) { ctx.rng[0] = (n >>> 0) || 1; };
      // a style on an instance: by the NAME of a style of the libraries, a style object, or a design (api.gait's): -> a handle for me.style
      api.style = function (what, opts) {
        const name = typeof what === "string" ? what : (what && what.phase !== undefined && what.speed !== undefined ? env.core.system.gaits.add(what)[0] : api.gait(what).name);
        const h = env.species(ctx.js);
        if (!h) throw new Error("happy_worker_logic: " + ctx.name + ": api.style needs the species installed (sp.worker_install) before its context");
        if (!(h.legs.gaits.length > h.declared)) throw new Error("happy_worker_logic: " + ctx.name + ": api.style needs spare gait slots (legs: { slots: n }) in the definition");
        if (ctx.pool === null) ctx.pool = env.slots.pool(fam, { base: h.declared });
        const key = ctx.js + ":" + name + JSON.stringify(opts || null);
        let id = L.cache[key];
        if (id === undefined) { id = ctx.pool.add(env.core.plan(h, name, Object.assign({}, opts || {}, { gait: h.declared }))); L.cache[key] = id; ctx.style_names[id] = name; if (ctx.ai_watch) env.post("happy_worker_ai_gaits", { js: ctx.js, names: ctx.style_names.slice() }); }
        return id;
      };
      // WHO IS NEAR: through the grid (pure.js; env.grid is optional) built from the family's rows once an epoch (a phase of the frame), when it is asked and the family has GRID_MIN alive or more; `api.grid_cell` (metres, 4) is
      // how wide its cells are: about the distance the family (and the others that look for it: api.world.nearest) asks about. When the grid cannot tell (nothing near enough, a radius that is wider than it looks) the family is looked at
      // all at once: the answer is the same either way. An instance that asked to be left out (api.world.exclude: a dead creature) is in neither
      api.near = function (me, radius, out) {
        prepare(ctx);
        if (ctx.use_grid) { const g = ctx.grid.near(fam.ROOT, fam.ALIVE, me.slot, radius, out); if (g !== -2) return g; }
        const R = fam.ROOT, AL = fam.ALIVE, GX = ctx.gx, o = me.slot * 8, r2 = radius * radius, px = R[o], py = R[o + 1], pz = R[o + 2], m = fam.max < ctx.max ? fam.max : ctx.max;
        let n = 0;
        for (let s = 0; s < m && n < out.length; s++) {
          if (!AL[s] || GX[s] !== 0 || s === me.slot) continue;
          const dx = R[s * 8] - px, dy = R[s * 8 + 1] - py, dz = R[s * 8 + 2] - pz;
          if (dx * dx + dy * dy + dz * dz <= r2) out[n++] = s;
        }
        return n;
      };
      api.nearest = function (me) {
        prepare(ctx);
        if (ctx.use_grid) { const g = ctx.grid.nearest(fam.ROOT, fam.ALIVE, me.slot); if (g !== -2) { api.near_d2 = ctx.grid.d2; return g; } }
        const R = fam.ROOT, AL = fam.ALIVE, GX = ctx.gx, o = me.slot * 8, px = R[o], py = R[o + 1], pz = R[o + 2], m = fam.max < ctx.max ? fam.max : ctx.max;
        let best = -1, bd = Infinity;
        for (let s = 0; s < m; s++) {
          if (!AL[s] || GX[s] !== 0 || s === me.slot) continue;
          const dx = R[s * 8] - px, dy = R[s * 8 + 1] - py, dz = R[s * 8 + 2] - pz, d = dx * dx + dy * dy + dz * dz;
          if (d < bd) { bd = d; best = s; }
        }
        api.near_d2 = bd;
        return best;
      };
      // THE OTHER SPECIES (pure.js): the family's group, and the world's queries, reads and hit
      api.group = function (name) {
        if (W === null) throw new Error("happy_worker_logic: " + ctx.name + ": api.group needs the world service (env.world_service: pure.js)");
        ctx.group = W.group_id(name); W.sync();
        return ctx.group;
      };
      // api.footprint(radius, length): how big the family's bodies are to the others (metres at scale 1: the half width, and the whole length of a long body: a vehicle); `api.world.radius(h)` / `length(h)` read it. 0: not said
      api.footprint = function (radius, length) { ctx.radius = radius > 0 ? +radius : 0; ctx.length = length > 0 ? +length : 0; };
      api.world = W;
      // THE WORLD A CREATURE IS HOSTED IN (SYSTEM.md): the blackboard every creature shares (pure.js), the world's service (nav, zones, slots, props: pure.js), the blocks a tree loads by name
      // (pure.js) and the data the page gave the family (system.species(def, { cfg })). Each is null where the host gave none; a block says what it needs.
      api.board = BD; api.cfg = ctx.cfg; api.goap = env.goap || null;                                          // (api.goap: the planner of the goal-oriented creatures, pure.js: null where the host gave none)
      api.handle = function (me) { return (ctx.js << 16) | me.slot; };
      api.rec = function (me) { return BD !== null && ctx.rec_base >= 0 ? ctx.rec_base + me.slot : -1; };
      api.sw = SW === null ? null : SW.bind({ profile: ctx.cfg && ctx.cfg.nav && typeof ctx.cfg.nav.agent === "string" ? ctx.cfg.nav.agent : undefined, handle: api.handle });
      api.blocks = env.modules ? { load: function (list, props) { return env.modules.load(api, list, props); }, plan: function (list, props) { return env.modules.plan(list, props); }, has: env.modules.has, names: env.modules.names } : null;
      api.ray = function (ox, oy, oz, dx, dy, dz, max) {
        if (!env.world) return -1;
        return env.world.ray(ox, oy, oz, dx, dy, dz, max, api.hit);
      };
      // THE BODIES OF THE PHYSICS WORLD that a hand can hold (world.cpp happy_grip_find / happy_grip_body)
      api.bodies = function (me, radius, out) { return env.grip ? env.grip.find(me.x, me.y, me.z, radius, out) : 0; };
      api.body = function (id) { return env.grip ? env.grip.body(id) : null; };
      return api;
    }

    // ---- a creature's OWN actions and gaits: its definition's `actions: [...]` and `gaits: [...]` (the page sends them with the function: runtime.js), made BEFORE its function is called, so api.action("wolf_claw"),
    // api.style("wolf_limp"), a block's clip slot and the page's names find them like the libraries'.
    //   actions: [{ name, phases: [...] }                                 a whole action spec (the action designer's JSON)
    //             { name, from: "punch", tweaks, edits, mix, meta }]      or a DESIGN of an action of the libraries (or of an earlier one of this list): pure.js
    //   gaits:   [{ name, base: "quad_walk", blend: {...}, tweaks: {...} } a gait DESIGN (blend / tweaks / dials, a recipe, a generator: design.js)
    //             | { name, phase, speed, ... }]                          or a whole style (system.gaits.add's)
    // A name is lower case letters, digits and `_`, and is the creature's own: the name of a library's action or gait is refused (it says so), a name a creature declared before is replaced (the editor makes the family again at
    // every change). The names are the worker's, shared by its families: begin them with the creature's (wolf_claw, wolf_limp). A gait needs spare gait slots (`legs: { slots: n }`) to be walked in, as api.style says.
    const NAME_OK = /^[a-z][a-z0-9_]*$/, owned_gaits = Object.create(null);
    L.declare = function (defs, who) {
      const out = { actions: [], gaits: [], props: [] }, where = "happy_worker_logic: " + (who || "a creature") + ": ";
      if (!defs || typeof defs !== "object") return out;
      const list = function (key) {
        if (defs[key] === undefined) return [];
        if (!Array.isArray(defs[key])) throw new Error(where + key + " is a list: [{ name, ... }, ...]");
        defs[key].forEach(function (d, i) { if (!d || typeof d !== "object" || Array.isArray(d) || typeof d.name !== "string" || !NAME_OK.test(d.name)) throw new Error(where + key + "[" + i + "]: has a `name` of lower case letters, digits and _ (wolf_" + (key === "actions" ? "claw" : "limp") + ")"); });
        return defs[key];
      };
      out.props = [];
      if (defs.props !== undefined) {                                                                          // (resolved by the page, species.js compile_props: [{ name, places: [{ name, bone }], start }])
        if (!Array.isArray(defs.props)) throw new Error(where + "props is the page's list of resolved props");
        defs.props.forEach(function (p, i) {
          if (!p || typeof p.name !== "string" || !Array.isArray(p.places) || !p.places.length) throw new Error(where + "props[" + i + "] is { name, places: [{ name, bone }], start }");
          out.props.push(p);
        });
      }
      const acts = list("actions"), gts = list("gaits");
      if ((acts.length || gts.length) && !env.design) throw new Error(where + "actions and gaits of its own need the designer in the worker (env.design: pure.js)");
      acts.forEach(function (a, i) {
        const sig = JSON.stringify(a);
        if (env.lib.owned[a.name] === sig) { out.actions.push(a.name); return; }
        let spec;
        if (a.phases !== undefined && typeof env.design.check_action === "function") { const bad = env.design.check_action(a); if (bad.length) throw new Error(where + "actions[" + i + "] '" + a.name + "': " + bad.join("; ")); }          // (a whole spec is checked, not normalised silently: a bad ease or an unknown track is a mistake)
        try { spec = env.design.action(a.phases !== undefined ? { name: a.name, from: a } : a); }
        catch (e) { throw new Error(where + "actions[" + i + "] '" + a.name + "': " + String(e && e.message || e)); }
        if (spec.name !== a.name) throw new Error(where + "actions[" + i + "]: the name '" + a.name + "' is made '" + spec.name + "': use lower case letters, digits and _");
        env.lib.define(spec, sig);
        out.actions.push(a.name);
      });
      const gaits = env.core.system.gaits;
      gts.forEach(function (g, i) {
        if (gaits.get(g.name) && !owned_gaits[g.name]) throw new Error(where + "gaits[" + i + "]: '" + g.name + "' is the name of a gait style of the libraries: a gait of a creature's own has a name of its own (wolf_limp, not limp)");
        if (g.phase !== undefined && g.speed !== undefined) gaits.add(Object.assign({}, g));
        else {
          let s;
          try { s = env.design.gait(g); }
          catch (e) { throw new Error(where + "gaits[" + i + "] '" + g.name + "': " + String(e && e.message || e)); }
          if (s.name !== g.name) throw new Error(where + "gaits[" + i + "]: the name '" + g.name + "' is made '" + s.name + "': use lower case letters, digits and _");
        }
        owned_gaits[g.name] = true;
        out.gaits.push(g.name);
      });
      return out;
    };

    // ---- installing
    L.install = function (js, src, info) {
      info = info || {};
      const fam = env.family(js), max = info.max > 0 ? info.max : 16, name = typeof info.name === "string" ? info.name : "species " + js;
      const factory = eval_factory(src), ctx = new Ctx(js, name, fam, max);
      if (info.defs) {
        const declared = L.declare(info.defs, name);
        if (declared.props.length) { ctx.props = declared.props; ctx.prop_on = declared.props.map(function () { return new Int8Array(max); }); }
      }
      ctx.cfg = info.cfg || null;
      if (info.defs && Array.isArray(info.defs.fprops) && info.defs.fprops.length) {                          // (the family props: the names and the places the page numbered, and the masks of what each instance holds)
        const n = info.defs.fprops.length;
        ctx.fprops = info.defs.fprops; ctx.fp_held = new Uint8Array(max * n); ctx.fp_busy = new Uint8Array(max * n); ctx.fp_gen = new Int32Array(max * n).fill(-1);
        ctx.fp_fired = new Float64Array(max * n).fill(-1e9);
        ctx.fp_aimed = new Uint8Array(max * n); ctx.fp_aim_gen = new Int32Array(max * n).fill(-1); ctx.fp_aim_at = new Float64Array(max * n).fill(-1e9);
        ctx.fp_free = new Int32Array(n); for (let q = 0; q < n; q++) ctx.fp_free[q] = ctx.fprops[q].pool > 0 ? ctx.fprops[q].pool : -1;
      }
      if (BD !== null) ctx.rec_base = BD.family(js, max);                                                  // (a block of the blackboard's records for the family's instances)
      ctx.mind = info.mind !== false;                                                                       // (the page's say, when the family is made: a creature that the page drives is born with its own function not deciding)
      if (W !== null) ctx.group = W.group_id(name);                                                       // (the default group of a family is its own name: api.group(name) changes it)
      for (const k in L.cache) if (k.indexOf(js + ":") === 0) delete L.cache[k];                         // (the family is made again, as the AI editor's preview does at every change: its new pool of gait slots is empty, and the style ids that the old one gave are not its own)
      ctx.api = make_api(ctx);
      const species = env.species(js);
      if (species && species.legs && species.legs.gaits.length > species.declared) ctx.pool = env.slots.pool(fam, { base: species.declared });
      const hooks = compose_blocks(factory(ctx.api), name);
      if (!hooks || typeof hooks !== "object") throw new Error("happy_worker_logic: " + name + ": the worker function returns the hooks: { spawn, release, think, tick, on }");
      for (const k in hooks) if (HOOKS.indexOf(k) < 0) throw new Error("happy_worker_logic: " + name + ": '" + k + "' is not a hook (" + HOOKS.join(", ") + ")");
      for (const k in hooks) if (k === "on") { if (!hooks.on || typeof hooks.on !== "object") throw new Error("happy_worker_logic: " + name + ": on is { emit, end }"); for (const e in hooks.on) if (ON.indexOf(e) < 0) throw new Error("happy_worker_logic: " + name + ": '" + e + "' is not an event (" + ON.join(", ") + ")"); }
        else if (k !== "ai" && typeof hooks[k] !== "function") throw new Error("happy_worker_logic: " + name + ": " + k + " is a function");
      if (hooks.ai !== undefined) { if (!env.bt) throw new Error("happy_worker_logic: " + name + ": ai needs the behaviour tree (env.bt: pure.js)"); ctx.ai = env.bt.create(hooks.ai, ctx.max); }
      ctx.hooks = { spawn: hooks.spawn || null, release: hooks.release || null, think: hooks.think || null, tick: hooks.tick || null, message: hooks.message || null, msg: hooks.msg || null, hit: hooks.hit || null, on: { emit: hooks.on && hooks.on.emit || null, end: hooks.on && hooks.on.end || null } };
      ctx.drain = function (kind, slot, a, value) {                                                       // (one function a family: the action runtime's events)
        const me = ctx.me;
        if (ctx.ai !== null) ctx.ai.poke(slot);                                                              // (an action played an event or ended: the instance is looked at soon)
        if (kind === 1) { const h = ctx.hooks.on.emit; if (h !== null) { set_me(ctx, slot); try { h(me, a, value); } catch (e) { fail(ctx, "emit", e); } } }
        else if (kind === 2) { const h = ctx.hooks.on.end; if (h !== null) { set_me(ctx, slot); try { h(me, a); } catch (e) { fail(ctx, "end", e); } } }
      };
      for (let i = ctxs.length - 1; i >= 0; i--) if (ctxs[i].js === js) ctxs.splice(i, 1);
      ctxs.push(ctx);
      if (W !== null) W.sync();
      return ctx;
    };
    // a message from the page (sp.worker_send(data)): the family's `message(api, data)` hook
    L.message = function (js, data) {
      epoch.n++;
      for (let i = 0; i < ctxs.length; i++) if (ctxs[i].js === js) {
        const ctx = ctxs[i];
        if (ctx.hooks.message === null) return false;
        env.cols.refresh(ctx.fam);
        if (ctx.serial !== ctx.fam.serial && ctx.fam.live) rebuild(ctx);
        try { ctx.hooks.message(ctx.api, data); } catch (e) { fail(ctx, "message", e); }
        return true;
      }
      return false;
    };
    // ---- THE MESSAGES of the page (CMD_HAPPY_MSG, body.cpp keeps them in a ring in the wasm's memory) and what the creatures say (CMD_HAPPY_EVENTS, appended to the response). Numbers, in the engine's own buffers: nothing is
    // serialized and nothing is allocated for a message. The ring: [words used] [capacity] [dropped] then the messages one after another, [count] [js id] [slot] [id] numbers...: they are read where they lie, the numbers are
    // copied into the one message object of the family (ctx.m: id, slot, n, a[0 .. n - 1]) that its `msg(api, m)` hook is given.
    let pend_u = new Uint32Array(256), pend_f = new Float32Array(pend_u.buffer), pend_n = 0, pend_age = 0;       // (messages whose family is not here yet: the worker is still reading its libraries; offered again for a while)
    let spare_u = new Uint32Array(256), spare_f = new Float32Array(spare_u.buffer);
    const keep = function (U, i, len) {
      if (pend_n + len > pend_u.length) {
        const n = new Uint32Array(Math.max(pend_u.length * 2, pend_n + len));
        n.set(pend_u.subarray(0, pend_n)); pend_u = n; pend_f = new Float32Array(n.buffer);
      }
      for (let k = 0; k < len; k++) pend_u[pend_n + k] = U[i + k];
      pend_n += len;
    };
    // ---- THE AI WATCH: what the AI editor's preview (the AI editor's page, which is not in this repo) asks of a family that has an `ai`. The messages of ids from AI_BASE up are answered here, whether the creature has a `msg` hook or not:
    //   AI_BASE      (a0: 1 | 0)   the instances say which leaf of their tree runs, as the event "ai_node" (the value: the id of the leaf, -1 none; the ids are the order of the tree's nodes, the root is 0), every time it changes;
    //                              the shape of the tree (bt.js R.shape: the parent, the place and the kind of every node) is posted once, as "happy_worker_ai_shape" { js, shape }. 0 puts it off: it costs nothing then
    //   AI_BASE + 1  (a0: a node)  the instance `slot` runs that node now, whatever its guards say (bt.js R.force)         AI_BASE + 2   the instance decides again (R.restart)
    //   AI_BASE + 4  (name)        PREVIEW A CLIP: the instance `slot` plays the action of the library with that name (the name is sent as its character codes, a number each); it waits up to 12 s for a library that is still being read
    //   AI_BASE + 5  (name)        PREVIEW A GAIT: the instance walks in a circle in the gait style of that name (made in a spare gait slot, at the speed the style has for this creature)        AI_BASE + 6   it stops (the clip, the walk)
    //                              these three are answered by a worker with no `ai` too (a creature with only a `think`); a creature with NO worker has no context here, so the AI editor's preview gives it a standing stand-in (preview.js STAND_IN).
    //                              what happens is said as the event "ai_preview": 1 it plays, -1 there is no such clip or gait (the reason, once, as a happy_worker_error), -2 the creature has no spare gait slots, 0 stopped.   The gait that the TREE puts on an instance is said as "ai_gait" (the id of the style; the names: "happy_worker_ai_gaits")
    //   AI_BASE + 3  (a0: 1 | 0)   PAUSE: every instance of the family stands and decides nothing by itself (bt.js R.hold), the ones that are born later too; a node that AI_BASE + 1 runs then runs by itself and the instance stands again when it is done. 0: they are let go
    const ai_report = function (ctx, s) {                                                                   // (the instance s is the `me` of the context)
      const leaf = ctx.ai.leaf(s), g = ctx.ai.style(s);
      if (ctx.ai_last[s] !== leaf) { ctx.ai_last[s] = leaf; ctx.me.say(ctx.ai_tag, leaf); }
      if (ctx.ai_gait_last[s] !== g) { ctx.ai_gait_last[s] = g; ctx.me.say(ctx.ai_gtag, g); }
    };
    const pv_name_of = function (F, i, cnt) { let n = ""; for (let k = 0; k < cnt; k++) n += String.fromCharCode(F[i + 4 + k]); return n; };
    const pv_stop = function (ctx, s) {
      if (ctx.pv_kind[s] !== 0) ctx.pv_n--;
      ctx.pv_kind[s] = 0; ctx.me.act_stop(); ctx.me.stop();
    };
    const pv_say = function (ctx, v) { if (ctx.pv_tag < 0) ctx.pv_tag = env.lib.tag("ai_preview"); ctx.me.say(ctx.pv_tag, v); };
    // the previews, once a frame: a clip waits for its library, a gait for its style and then walks in a circle
    const pv_step = function (ctx, dt, max) {
      const AL = ctx.fam.ALIVE, me = ctx.me;
      for (let s = 0; s < max; s++) {
        const k = ctx.pv_kind[s];
        if (k === 0) continue;
        if (!AL[s]) { ctx.pv_age[s] += dt; if (ctx.pv_age[s] > 5) { ctx.pv_kind[s] = 0; ctx.pv_n--; } continue; }               // (not made yet: it is waited for)
        set_me(ctx, s);
        if (k === 3) { ctx.pv_th[s] += dt * 0.6; me.go(Math.sin(ctx.pv_th[s]) * ctx.pv_sp[s], Math.cos(ctx.pv_th[s]) * ctx.pv_sp[s]); continue; }
        ctx.pv_age[s] += dt;
        try {
          if (k === 1) {
            if (!env.lib.has(ctx.pv_name[s])) throw new Error("not loaded yet");
            me.stop(); me.act(env.lib.get(ctx.pv_name[s])); ctx.pv_kind[s] = 0; ctx.pv_n--; pv_say(ctx, 1);
          } else {
            const id = ctx.api.style(ctx.pv_name[s]), sp = ctx.pool.number(id, "speed");
            me.act_stop(); me.style(id, 0.4); ctx.pv_sp[s] = sp > 0.05 ? sp : 0.5; ctx.pv_th[s] = me.yaw; ctx.pv_kind[s] = 3; pv_say(ctx, 1);
          }
        } catch (e) {
          if (/spare gait slots|has no gait slots/.test(String(e && e.message))) { ctx.pv_kind[s] = 0; ctx.pv_n--; pv_say(ctx, -2); }
          else if (ctx.pv_age[s] > 12) { ctx.pv_kind[s] = 0; ctx.pv_n--; pv_say(ctx, -1); env.post("happy_worker_error", { what: "creature " + ctx.name + ": preview of " + ctx.pv_name[s], message: String(e && e.message || e) }); }       // (the reason, once: the page shows it)
        }
      }
    };
    const ai_control = function (ctx, id, slot, a0, F, at, cnt) {
      const ai = ctx.ai;
      if (id === AI_BASE) {
        ctx.ai_watch = a0 !== 0;
        if (ctx.ai_watch) {
          if (ctx.ai_tag < 0) ctx.ai_tag = env.lib.tag("ai_node");
          ctx.ai_last.fill(-2);
          if (ctx.ai_gtag < 0) ctx.ai_gtag = env.lib.tag("ai_gait");
          ctx.ai_gait_last.fill(-2);
          env.post("happy_worker_ai_shape", { js: ctx.js, shape: ai.shape() });
          env.post("happy_worker_ai_gaits", { js: ctx.js, names: ctx.style_names.slice() });
        }
      } else if (id === AI_BASE + 3) {
        ctx.ai_paused = a0 !== 0;
        for (let s = 0; s < ctx.max && s < ctx.fam.max; s++) if (ctx.seen[s] !== 0 && ctx.fam.ALIVE[s]) { set_me(ctx, s); ai.hold(ctx.me, ctx.time, ctx.ai_paused || ctx.mind_off[s] !== 0); if (ctx.ai_watch) ai_report(ctx, s); }
      } else if ((id === AI_BASE + 4 || id === AI_BASE + 5) && slot < ctx.max) {                                // (a preview is asked for as soon as the instance is made: it waits for it, in pv_step)
        if (ctx.pv_kind[slot] === 0) ctx.pv_n++;
        ctx.pv_kind[slot] = id === AI_BASE + 4 ? 1 : 2; ctx.pv_name[slot] = pv_name_of(F, at, cnt); ctx.pv_age[slot] = 0;
      } else if (slot < ctx.max && ctx.seen[slot] !== 0 && ctx.fam.ALIVE[slot]) {
        set_me(ctx, slot);
        if (id === AI_BASE + 1) ai.force(ctx.me, ctx.time, a0); else if (id === AI_BASE + 2) ai.restart(ctx.me, ctx.time);
        else if (id === AI_BASE + 6) { pv_stop(ctx, slot); pv_say(ctx, 0); }
        if (ctx.ai_watch) ai_report(ctx, slot);
      }
    };
    // ---- THE MIND (MIND = AI_BASE + 7: [slot] [1 | 0]; slot 65535 is the whole family). The creature's own function (its spawn / think / tick, the `ai` tree) decides for an instance, or it does not: a page that drives the
    // creature (a designer, the keys, a click) turns it off and nothing else moves it. Off: no think, no tick for the family (when the family is off), and the tree is HELD exactly as the AI editor's Pause holds it (bt.js R.hold: what it
    // runs is aborted, the instance stands, it is never woken: a node that the page asks for, AI_BASE + 1, still runs by itself and the instance stands again when it is done); the wish it had is stopped once. Still run: spawn, release,
    // message, msg, hit, the events of its actions, the page's previews (the AI editor's play). An instance that was not seen yet gets the answer when it is found (a page asks as soon as it spawns one)
    const mind_set = function (ctx, s, on) {
      const fam = ctx.fam;
      if (!(ctx.seen[s] !== 0 && fam.ALIVE[s] !== 0)) { ctx.mind_pend[s] = on ? 1 : 2; return; }
      ctx.mind_pend[s] = 0;
      const was = ctx.mind_off[s] === 0;
      ctx.mind_off[s] = on ? 0 : 1;
      if (was === on) return;
      if (ctx.ai !== null) { set_me(ctx, s); ctx.ai.hold(ctx.me, ctx.time, ctx.ai_paused || !on); if (ctx.ai_watch) ai_report(ctx, s); }
      if (!on) D.intent(fam, s, 0, 0, 0, 0); else ctx.acc[s] = 0;
    };
    const mind_control = function (ctx, slot, on) {
      if (slot >= 65535) {
        ctx.mind = on;
        for (let s = 0; s < ctx.max; s++) { if (ctx.seen[s] !== 0 && ctx.fam.ALIVE[s] !== 0) mind_set(ctx, s, on); else ctx.mind_pend[s] = 0; }
      } else if (slot < ctx.max) mind_set(ctx, slot, on);
    };
    const deliver = function (U, F, i) {                                                                    // one message at word i; how many words it has
      const cnt = U[i], js = U[i + 1], len = 4 + cnt;
      let ctx = null;
      for (let c = 0; c < ctxs.length; c++) if (ctxs[c].js === js) { ctx = ctxs[c]; break; }
      if (ctx === null) { keep(U, i, len); return len; }
      if (U[i + 3] === PSYNC) { fp_sync(ctx, U[i + 2], F, i + 4, cnt); return len; }
      if (U[i + 3] === PPOOL) { fp_pool(ctx, F, i + 4, cnt); return len; }
      if (U[i + 3] === PAIM) { fp_aim_sync(ctx, U[i + 2], F, i + 4, cnt); return len; }
      const mind = U[i + 3] === MIND, own = !mind && U[i + 3] >= AI_BASE && (ctx.ai !== null || (U[i + 3] >= AI_BASE + 4 && U[i + 3] <= AI_BASE + 6));       // (the page's previews of a clip or a gait need no tree: a worker with only a `think` is played on too)
      if (ctx.hooks.msg === null && !own && !mind) { stats.undelivered++; return len; }
      if (ctx.mail_at !== stats.frames) { ctx.mail_at = stats.frames; env.cols.refresh(ctx.fam); if (ctx.serial !== ctx.fam.serial && ctx.fam.live) rebuild(ctx); }
      if (mind) { mind_control(ctx, U[i + 2], cnt > 0 ? F[i + 4] !== 0 : true); return len; }
      if (own) { ai_control(ctx, U[i + 3], U[i + 2], cnt > 0 ? F[i + 4] : 0, F, i, cnt); return len; }
      const m = ctx.m, a = m.a;
      m.slot = U[i + 2]; m.id = U[i + 3]; m.n = cnt;
      for (let k = 0; k < cnt; k++) a[k] = F[i + 4 + k];
      try { ctx.hooks.msg(ctx.api, m); } catch (e) { fail(ctx, "msg", e); }
      return len;
    };
    // the ring (u, f: views onto it): its messages are delivered in order, after what waited from before; then it is empty
    L.dispatch = function (u, f) {
      epoch.n++;
      if (pend_n > 0) {
        const U = pend_u, F = pend_f, n = pend_n;
        pend_u = spare_u; pend_f = spare_f; spare_u = U; spare_f = F; pend_n = 0;
        for (let i = 0; i < n;) i += deliver(U, F, i);
        pend_age = pend_n > 0 ? pend_age + 1 : 0;
        if (pend_age > 600) { pend_n = 0; pend_age = 0; stats.undelivered++; }                              // (ten seconds and nobody wanted it: let go)
      }
      const n = u[0];
      for (let i = 3; i < 3 + n;) i += deliver(u, f, i);
      u[0] = 0;
    };
    // what the creatures said: the records wait in each family's buffer, and are copied into the response, where the worker's JS has room for them (u32: the response, i: where it is written, cmd: the id of CMD_HAPPY_EVENTS):
    // [cmd] [number of words] then the records, 4 words each: [js id << 16 | slot] [generation] [tag] [value]. The names of the tags that creatures have made are posted once, as an object, when there are new ones
    L.tags_sent = 0;
    L.said = function () { let n = 0; for (let c = 0; c < ctxs.length; c++) n += ctxs[c].out_n; return n; };
    L.tags_new = function () { return env.lib.tags.length !== L.tags_sent; };
    L.emit = function (u32, f32, i, cmd) {
      if (env.lib.tags.length !== L.tags_sent) { env.post("happy_worker_tags", { tags: env.lib.tags.slice() }); L.tags_sent = env.lib.tags.length; }
      const room = u32.length - i - 2;
      let at = -1, o = 0;
      for (let c = 0; c < ctxs.length; c++) {
        const ctx = ctxs[c], n = ctx.out_n * 4;
        if (n === 0 || o + n > room) continue;                                                              // (a response that is full: what is left waits for the next frame)
        if (at < 0) { at = i + 1; u32[i] = cmd; }
        const out = ctx.out;
        for (let k = 0; k < n; k++) u32[at + 1 + o + k] = out[k];
        o += n; ctx.out_n = 0; ctx.stats.flushed += n / 4;
      }
      if (at < 0) return i;
      u32[at] = o;
      return at + 1 + o;
    };
    L.remove = function (js) { for (let i = ctxs.length - 1; i >= 0; i--) if (ctxs[i].js === js) ctxs.splice(i, 1); if (W !== null) W.sync(); };
    L.contexts = function () { return ctxs; };

    // ---- once a frame
    function set_me(ctx, s) {
      const fam = ctx.fam, me = ctx.me, R = fam.ROOT, o = s * 8;
      me.slot = s; me.gen = fam.GEN[s];
      me.x = R[o]; me.y = R[o + 1]; me.z = R[o + 2]; me.scale = R[o + 3];
      me.yaw = Math.atan2(2 * (R[o + 4] * R[o + 6] + R[o + 7] * R[o + 5]), 1 - 2 * (R[o + 4] * R[o + 4] + R[o + 5] * R[o + 5]));
      if (fam.VEL !== null) { me.vx = fam.VEL[s * 2]; me.vz = fam.VEL[s * 2 + 1]; } else { me.vx = 0; me.vz = 0; }
      me.speed = Math.sqrt(me.vx * me.vx + me.vz * me.vz);
      me.air = (fam.FLAGS[s] & K.F_AIR) !== 0 ? 1 : 0;
      me.flying = (fam.FLAGS[s] & K.F_FLY) !== 0 ? 1 : 0;
      me.flight = fam.FLY_OK ? fam.FLY_MODEL : 0;
      me.near = fam.TIER[s];
    }
    const rebuild = function (ctx) {                                                                      // (the family was built: nothing it had is in the new table)
      const fam = ctx.fam, plan = env.plan(ctx.js);
      ctx.serial = fam.serial; ctx.frame = 0; ctx.gb = null;
      ctx.seen.fill(0); ctx.seen_gen.fill(0); ctx.acc.fill(0); ctx.gx.fill(0); ctx.prep_at = -1;
      ctx.rt = plan ? env.A.family(fam, plan, { lib: env.lib }) : null;
      if (ctx.pool !== null) ctx.pool.reset();
    };
    const tick_ctx = function (ctx, dt) {
      const fam = ctx.fam, hk = ctx.hooks, me = ctx.me;
      env.cols.refresh(fam);
      if (!fam.live) return;
      if (ctx.serial !== fam.serial) rebuild(ctx);
      ctx.frame++; ctx.time += dt;
      const AL = fam.ALIVE, GE = fam.GEN, max = fam.max < ctx.max ? fam.max : ctx.max;
      // the instances: found by the columns (a slot that is alive with another generation was released and spawned again)
      for (let s = 0; s < max; s++) {
        if (AL[s]) {
          if (ctx.seen[s] === 0 || ctx.seen_gen[s] !== GE[s]) {
            if (ctx.seen[s] !== 0) { set_me(ctx, s); if (ctx.ai !== null) ctx.ai.release(me, ctx.time); if (hk.release !== null) { try { hk.release(me); } catch (e) { fail(ctx, "release", e); } } ctx.stats.releases++; gone(ctx, s); }
            if (ctx.gb && L.grab !== null) L.grab.release(ctx, s);
            if (ctx.gx[s] !== 0) { ctx.gx[s] = 0; ctx.prep_at = -1; }                                       // (the slot's new instance is not left out: that was the old one's)
            ctx.seen[s] = 1; ctx.seen_gen[s] = GE[s]; ctx.acc[s] = 0; ctx.stats.spawns++; born(ctx, s);
            { const pd = ctx.mind_pend[s]; ctx.mind_off[s] = pd === 0 ? (ctx.mind ? 0 : 1) : (pd === 2 ? 1 : 0); ctx.mind_pend[s] = 0; }          // (its mind: what the page asked of it before it was seen, else the family's)
            if (ctx.ai !== null) { set_me(ctx, s); ctx.ai.spawn(me, ctx.time); ctx.ai_last[s] = -2; ctx.ai_gait_last[s] = -2; if (ctx.ai_paused || ctx.mind_off[s] !== 0) ctx.ai.hold(me, ctx.time, true); }
            if (ctx.props !== null) props_start(ctx, s);                                                       // (its props as the definition has them: hidden, or in their first place)
            if (hk.spawn !== null) { set_me(ctx, s); try { hk.spawn(me); } catch (e) { fail(ctx, "spawn", e); } }
          }
        } else if (ctx.seen[s] !== 0) {
          ctx.seen[s] = 0; ctx.stats.releases++; gone(ctx, s);
          if (ctx.gb && L.grab !== null) L.grab.release(ctx, s);
          if (ctx.ai !== null || hk.release !== null) { set_me(ctx, s); if (ctx.ai !== null) ctx.ai.release(me, ctx.time); if (hk.release !== null) { try { hk.release(me); } catch (e) { fail(ctx, "release", e); } } }
          if (ctx.gx[s] !== 0) { ctx.gx[s] = 0; ctx.prep_at = -1; }
        }
      }
      if (hk.tick !== null && ctx.mind) { try { hk.tick(ctx.api, dt); } catch (e) { fail(ctx, "tick", e); } }
      if (ctx.pv_n > 0) pv_step(ctx, dt, max);
      if (ctx.ai !== null) {                                                                                  // (the AI: the instances whose time has come, not every instance every frame)
        const W = ctx.ai.wake, now = ctx.time, c0 = L.timing ? clock() : 0;
        let visits = 0;
        for (let s = 0; s < max; s++) {
          if (!AL[s] || W[s] > now) continue;                                                                   // (a held instance is visited only when a node it was asked to run is running)
          set_me(ctx, s); visits++;
          try { ctx.ai.run(me, now); if (ctx.ai_watch) ai_report(ctx, s); } catch (e) { fail(ctx, "ai", e); if (ctx.ai === null) break; W[s] = now + 1; }
        }
        ctx.stats.ai_visits += visits;
        if (L.timing) ctx.stats.ai_ms += clock() - c0;
      }
      if (hk.think !== null) {
        const DV = fam.DIV, acc = ctx.acc;
        for (let s = 0; s < max; s++) {
          if (!AL[s] || ctx.mind_off[s] !== 0) continue;
          acc[s] += dt;
          const dv = DV[s] > 0 ? DV[s] : 1;
          if (dv > 1 && (ctx.frame + s) % dv !== 0) continue;
          set_me(ctx, s); me.dt = acc[s]; acc[s] = 0;
          const think = ctx.hooks.think;
          if (think === null) break;
          try { think(me, me.dt); } catch (e) { fail(ctx, "think", e); }
          ctx.stats.thinks++;
        }
      }
      if (ctx.gb && ctx.gb.n > 0 && L.grab !== null) L.grab.step(ctx, dt, max);
      if (ctx.pool !== null) ctx.pool.step(dt);
      if (ctx.rt !== null) { ctx.rt.update(dt); if (ctx.rt.ev_count() > 0) ctx.rt.drain(ctx.drain); }
    };
    L.now = 0;
    L.tick = function (dt) {
      const c0 = L.timing ? clock() : 0;
      stats.frames++; epoch.n++;
      L.now += dt;
      if (SW !== null) SW.now = L.now;
      if (BD !== null) BD.time = L.now;
      for (let c = 0; c < ctxs.length; c++) tick_ctx(ctxs[c], dt);
      if (SW !== null) SW.flush();                                                                         // (the requests the creatures made of the world: effects, props, interactions)
      if (L.timing) stats.tick_ms += clock() - c0;
    };
    // what the families cost: counted always (visits, thinks), timed when `L.timing` is on (a clock read at both ends of a family's AI pass and of the whole tick). A page asks for it with system.worker_logic_stats()
    L.report = function () {
      return { frames: stats.frames, tick_ms: stats.tick_ms, undelivered: stats.undelivered, families: ctxs.map(function (c) {
        let alive = 0;
        for (let s = 0; s < c.fam.max && s < c.max; s++) alive += c.fam.ALIVE[s] !== 0 ? 1 : 0;
        return { js: c.js, name: c.name, max: c.max, alive: alive, time: c.time, ai: c.ai !== null, mind: c.mind, ai_visits: c.stats.ai_visits, ai_ms: c.stats.ai_ms, thinks: c.stats.thinks, hits: c.stats.hits, errors: c.stats.errors, dropped: c.stats.dropped, waiting: c.out_n, said: c.stats.said, flushed: c.stats.flushed };
      }) };
    };
    L.reset_stats = function () { stats.frames = 0; stats.tick_ms = 0; for (let c = 0; c < ctxs.length; c++) { ctxs[c].stats.ai_visits = 0; ctxs[c].stats.ai_ms = 0; ctxs[c].stats.thinks = 0; } };
    return L;
  }

  return { create: create, eval_factory: eval_factory, compose_blocks: compose_blocks };
});

// ========================================================================================================================
// worker_modules
// ========================================================================================================================
packing()("happy_worker_modules", function happy_worker_modules() {
  "use strict";
  // HAPPY WORKER MODULES: AI blocks as MODULES that a creature's tree LOADS by name (SYSTEM.md), instead of code spliced into the creature's file by `//@block` lines. A block is a file that ends with `return { ... }`; it is
  // read here as text, once (new Function), and kept in a registry. A creature's worker function asks for the blocks it wants; the loader calls each block's own function with the creature's `api` and its settings, and hands the
  // creature the pieces: the block's tree node, its hooks, its outputs. Nothing of a block is copied into a creature unless the AI editor's FLATTEN is used (it writes `source_of(name)` into the file).
  //     worker: function (api) {
  //       var ld = api.blocks.load([ "needs", ["flee", { speed: 7 }], "walk", ["wander", { radius: 8 }] ]);      // the tree names the blocks it needs; the loader loads them (and what they `uses`)
  //       return ld.mind({ hz: 6, far_hz: 1 });       // the blocks' nodes in a select by priority, their hooks chained; or: ld.mind({ tree: function (n) { return { select: [n.flee, n.wander] }; } })
  //     }
  // THE BLOCK (what a block file returns):
  //   { name, title, help, kind: "creature" | "world", params: { key: default }, needs: ["nav", "board", "world", "body"], uses: ["walk"], plug: { priority: 50, mode: "interrupt" | "base" },
  //     worker: function (api, P, ld) { ...; return { tree: node | null, hooks: { sense, steer, spawn, release, think, tick, message, msg, hit, on }, out: { anything other blocks or the creature call } }; } }
  //   `P` is the block's settings: its defaults, then what the blocks that use it supply, then the creature's own, then the world's (a world file says `w.params("goto", { speed: 1.2 })` for every creature it hosts). `ld.out(name)` is another loaded block's `out`.
  //   BLOCKS USE BLOCKS: `uses: { walk: { near: "@near", speed: 2 } }` (a list of names, or of [name, settings], is read too) loads walk first, and the block SUPPLIES its settings: a value is written out, or `"@near"` is this block's own `near`. A block puts
  //   what it uses in its own tree with `ld.node("walk")` (the used block's `tree`, or its `out.node()` when it has none: walk's executor). Two blocks that supply different values for one setting of a third are refused (the creature lists the third with
  //   the value it wants, which wins). The settings of every block are found from the creature down (the uses are a graph without a circle), the workers run from the leaves up. `ld.params[name]` is what a block was given.
  //   A creature's own worker (creature_file.js `mind.worker`) puts the blocks' nodes in ITS tree the same way: `{ select: [ld.node("use"), ld.node("wander")] }`.
  //   WHAT A BLOCK SAYS OF ITSELF for the AI editor (all optional): `group` ("life", "motion" ...), `inputs: { name: { kind: "place" | "condition" | "number" | "text", help } }` (what a creature may wire: ld.input / ld.wire below), `outputs: { name: help }` (what its `out` offers), `messages: { id: help }`
  //   (what its `msg` hook answers), `marks: [{ id, label, color, help, msgs: [[id, "x", "z"]] }]` (places that mean something: the preview puts a coloured post and sends the messages), `controls: [{ label, help, send: [[id, numbers ...]], world, then, watch, expect }]` (the situations the preview can press and check).
  //   `info: { speed: { help, unit, min, max, kind, scoped } }` (optional) says what each setting is for: the AI editor shows it; `kind: "action" | "style"` marks a setting that names a clip or a gait; `scoped: true` says that the block's code reads
  //   it for the creature in hand (`ld.scoped()(me).speed`, `ld.per_set(...)(me)`), so that the blocks above it can give it other values on their own paths (see PATHS below).
  //   PATHS AND SCOPES: a block is made once for a creature, but it can be reached by several paths (the creature lists `party`, `party` uses `celebrate` and `greet`, both use `emote` and `walk`: `party/celebrate/emote`, `party/greet/emote`). The settings of a block
  //   are found for every path: its defaults, what the block above supplies (`uses`), the `props` of the blocks above (a block's own `props: { "celebrate/emote": { clip_emote: "cheer" } }`), the creature's listing, the creature's `props` for the exact path
  //   (`mind.props: { "party/celebrate/walk": { speed: 3 } }`), the world's. The settings marked `scoped` may differ from path to path (the creature keeps, for each of its slots, the path a block is in now: it is set when a block calls an `out` function that
  //   the block lists in `scope_outs`, or enters the node of the block); the others must agree. A block's `out` functions take `me` first. `M.plan(list, props)` is all of this without running anything (the AI editor uses it).
  //   `needs` names what `api` must have (a block that needs the world says so and is refused where there is none). The function is ES5 like every worker function (nothing is parsed from text at run time but the file).
  //   const M = create({ params_of(name) -> the world's settings of a block | null })
  //   M.register(name, text | def)    M.register_source(name, { params, plug, source })    a creature block the WORLD brings (its worker's source text)      M.has(name)  M.names()  M.def(name)  M.source_of(name) -> the block's file text (flatten)
  //   M.load(api, list, props) -> ld      list: "name" | ["name", params] | { block: "name", params, plug }      ld.names, ld.tree(name), ld.out(name), ld.hooks (list), ld.mind(o) -> the hooks object of a creature's worker
  // Node 14: no optional chaining, no ??. The blocks' functions are ES5.
  const HOOK_KEYS = ["sense", "steer", "spawn", "release", "think", "tick", "message", "msg", "hit", "on"];
  const MODES = ["interrupt", "base"];
  const fail = function (where, text) { throw new Error("happy_worker_modules: " + where + ": " + text); };
  function create(env) {
    env = env || {};
    const defs = Object.create(null), texts = Object.create(null);
    const M = {};
    const check = function (name, d) {
      if (!d || typeof d !== "object") fail(name, "the block file returns an object { name, params, worker, ... }");
      if (typeof d.worker !== "function") fail(name, "worker is a function (api, P, ld) that returns { tree, hooks, out }");
      if (d.name !== undefined && d.name !== name) fail(name, "the file says its name is `" + d.name + "`");
      if (d.params !== undefined && (typeof d.params !== "object" || d.params === null)) fail(name, "params is an object of defaults");
      if (d.plug !== undefined && d.plug.mode !== undefined && MODES.indexOf(d.plug.mode) < 0) fail(name, "plug.mode is " + MODES.join(" or "));
      if (d.needs !== undefined && !Array.isArray(d.needs)) fail(name, "needs is a list of names (nav, board, world, body)");
      if (d.uses !== undefined && (typeof d.uses !== "object" || d.uses === null)) fail(name, "uses is { block: { setting: value } } or a list of block names");
      if (d.info !== undefined && (typeof d.info !== "object" || d.info === null)) fail(name, "info is { setting: { help, unit, min, max, kind } }");
      if (d.scope_outs !== undefined && (!Array.isArray(d.scope_outs) || d.scope_outs.some(function (k) { return typeof k !== "string"; }))) fail(name, "scope_outs is a list of the names of the `out` functions that start work under the caller's path (their first argument is `me`)");
      if (d.props !== undefined && (typeof d.props !== "object" || d.props === null || Array.isArray(d.props))) fail(name, "props is { \"path/of/used/blocks\": { setting: value } }");
      if (d.props) for (const pk in d.props) if (typeof d.props[pk] !== "object" || d.props[pk] === null || Array.isArray(d.props[pk])) fail(name, "props[\"" + pk + "\"] is { setting: value }");
      if (d.info) for (const ik in d.info) if (d.info[ik] && d.info[ik].scoped !== undefined && (d.info[ik].scoped !== true && d.info[ik].scoped !== false || !d.params || d.params[ik] === undefined)) fail(name, "info." + ik + ".scoped is true or false, and `" + ik + "` is one of its settings");
      ["inputs", "outputs", "messages"].forEach(function (k) { if (d[k] !== undefined && (typeof d[k] !== "object" || d[k] === null || Array.isArray(d[k]))) fail(name, k + " is an object of names and what they are"); });
      ["marks", "controls"].forEach(function (k) { if (d[k] !== undefined && !Array.isArray(d[k])) fail(name, k + " is a list (what the AI editor's preview can put and press)"); });
      return d;
    };
    M.register = function (name, what) {
      let d = what;
      if (typeof what === "string") {
        try { d = new Function(what)(); } catch (e) { fail(name, "the block file does not run: " + (e && e.message || e)); }
        texts[name] = what;
      }
      defs[name] = check(name, d);
      return defs[name];
    };
    M.register_source = function (name, o) {                                                               // a block of the world: its worker's source text and its settings
      let f;
      try { f = new Function("return (" + o.source + ")")(); } catch (e) { fail(name, "the world's block does not compile: " + (e && e.message || e)); }
      defs[name] = check(name, { name: name, kind: "creature", params: o.params || {}, plug: o.plug || {}, needs: o.needs || [], uses: o.uses || [], worker: f });
      texts[name] = "return { name: " + JSON.stringify(name) + ", params: " + JSON.stringify(o.params || {}) + ", plug: " + JSON.stringify(o.plug || {}) + ", worker: " + o.source + " };";
      return defs[name];
    };
    M.has = function (name) { return defs[name] !== undefined; };
    M.names = function () { return Object.keys(defs).sort(); };
    M.def = function (name) { return defs[name] || null; };
    M.source_of = function (name) { return texts[name] || null; };

    const uses_of = function (d, where) {                                                                  // the blocks a block uses -> [{ name, bind: { setting: value | "@own setting" } }]
      const u = d.uses, out = [];
      if (!u) return out;
      if (Array.isArray(u)) u.forEach(function (x) { out.push(typeof x === "string" ? { name: x, bind: {} } : { name: x[0], bind: x[1] || {} }); });
      else for (const k in u) out.push({ name: k, bind: u[k] || {} });
      out.forEach(function (x) { if (typeof x.name !== "string" || typeof x.bind !== "object") fail(where, "uses is { block: { setting: value } }"); });
      return out;
    };
    M.uses_of = function (name) { return defs[name] ? uses_of(defs[name], name) : []; };
    const entry = function (x) {                                                                           // one item of a list -> { name, params, plug }
      if (typeof x === "string") return { name: x, params: {}, plug: null };
      if (Array.isArray(x)) return { name: x[0], params: x[1] || {}, plug: x[2] || null };
      if (x && typeof x === "object" && typeof x.block === "string") return { name: x.block, params: x.params || {}, plug: x.plug || null };
      return fail("load", "an item is a block's name, [name, params] or { block, params }");
    };
    // THE PLAN of a list of blocks (no worker is run): the blocks the creature lists and what they use as a graph, the PATHS by which each block is reached (`party/celebrate/emote`: the names from the block the creature lists down to it), and the
    // settings of the block at each path. A block is made ONCE for a creature (one state, one mover); its settings are found for every path, and the ones its `info` marks `scoped: true` may differ from path to path (the others must agree:
    // two paths that disagree about one are refused). `props` is the creature's bag: { "party/celebrate/emote": { clip_emote: "cheer" } }; a block has one of its own (`props: { "celebrate/emote": {...} }`, paths from itself).
    // Precedence at a path: the block's defaults, what the block above supplies (`uses` binds), the `props` of the blocks above (the nearer first, the farther wins), the creature's listing (for every path), the creature's `props` for the
    // exact path, the world's. plan(list, props) -> { nodes: { name: { paths: [[names]], keys: [path text], sets: [P], set_of: [set of each path], root: index of the path [name] | 0, needs } }, order: [names, leaves first], items }
    const PATH_MAX = 4096;
    M.plan = function (list, props) {
      if (!Array.isArray(list)) fail("load", "a list of blocks: api.blocks.load([\"goto\", [\"wander\", { radius: 8 }]])");
      props = props || {};
      if (typeof props !== "object" || props === null || Array.isArray(props)) fail("load", "props is { \"path/of/blocks\": { setting: value } }");
      const items = list.map(entry), listed = Object.create(null), nodes = Object.create(null), post = [];
      items.forEach(function (e) { listed[e.name] = e; });
      // the blocks of the creature and what they use, as a graph: a block is made after what it uses (post)
      const visit = function (name, stack) {
        if (stack.indexOf(name) >= 0) fail("load", "blocks use each other in a circle (" + stack.concat([name]).join(" -> ") + ")");
        const d = defs[name];
        if (!d) fail("load", "no block `" + name + "` is registered (" + M.names().join(", ") + "): system.worker_modules([urls]) before the species is made");
        if (nodes[name]) return nodes[name];
        const n = nodes[name] = { name: name, def: d, entry: listed[name] || null, kids: [], paths: [], keys: [], index: Object.create(null), sets: [], set_of: [], root: 0, needs: false };
        uses_of(d, "block `" + name + "`").forEach(function (u) { n.kids.push({ node: visit(u.name, stack.concat([name])), bind: u.bind }); });
        post.push(n);
        return n;
      };
      items.forEach(function (e) { visit(e.name, []); });
      let total = 0;
      const walk = function (n, path) {                                                                    // (every way down: a block that two blocks use has two paths)
        if (++total > PATH_MAX) fail("load", "the blocks make more than " + PATH_MAX + " paths");
        const key = path.join("/");
        n.index[key] = n.paths.length; n.paths.push(path); n.keys.push(key);
        n.kids.forEach(function (k) { walk(k.node, path.concat([k.node.name])); });
      };
      items.forEach(function (e) { walk(nodes[e.name], [e.name]); });
      post.forEach(function (n) { n.root = n.index[n.name] !== undefined ? n.index[n.name] : 0; });
      for (const key in props) {                                                                           // (the creature's bag: a path that is there, settings that the block has)
        const names = key.split("/"), n = nodes[names[names.length - 1]];
        if (!n || n.index[key] === undefined) fail("props", "`" + key + "` is not a path of the creature's blocks (" + post.map(function (x) { return x.keys.join(", "); }).join(", ") + ")");
        if (typeof props[key] !== "object" || props[key] === null || Array.isArray(props[key])) fail("props", "`" + key + "` is { setting: value }");
        for (const k in props[key]) if (!n.def.params || n.def.params[k] === undefined) fail("props", "`" + key + "`: `" + k + "` is not one of the settings of `" + n.name + "` (" + Object.keys(n.def.params || {}).join(", ") + ")");
      }
      const scoped = function (n, k) { return !!(n.def.info && n.def.info[k] && n.def.info[k].scoped === true); };
      const memo = Object.create(null);
      const resolve = function (path) {                                                                    // the settings of the block at a path
        const key = path.join("/");
        if (memo[key]) return memo[key];
        const n = nodes[path[path.length - 1]], d = n.def, where = "block `" + n.name + "`", P = {}, from = {};
        for (const k in (d.params || {})) P[k] = d.params[k];
        if (path.length > 1) {
          const par = nodes[path[path.length - 2]], Pp = resolve(path.slice(0, -1));
          par.kids.forEach(function (kid) {
            if (kid.node !== n) return;
            for (const k in kid.bind) {
              if (!d.params || d.params[k] === undefined) fail(where, "`" + par.name + "` supplies `" + k + "`, which is not one of its settings (" + Object.keys(d.params || {}).join(", ") + ")");
              let v = kid.bind[k];
              if (typeof v === "string" && v.charAt(0) === "@") {
                const pk = v.slice(1);
                if (Pp[pk] === undefined) fail(where, "`" + par.name + "` binds `" + k + "` to its `" + pk + "`, which it does not have");
                v = Pp[pk];
              }
              P[k] = v; from[k] = par.name;
            }
          });
          for (let i = path.length - 2; i >= 0; i--) {                                                      // (the props of the blocks above: the nearer first, the farther one wins)
            const ad = nodes[path[i]].def, pr = ad.props && ad.props[path.slice(i + 1).join("/")];
            if (!pr) continue;
            for (const k in pr) {
              if (!d.params || d.params[k] === undefined) fail(where, "`" + ad.name + "` has props for `" + path.slice(i + 1).join("/") + "`: `" + k + "` is not one of its settings (" + Object.keys(d.params || {}).join(", ") + ")");
              P[k] = pr[k]; from[k] = ad.name;
            }
          }
        }
        if (n.entry) for (const k in n.entry.params) { if (d.params && d.params[k] === undefined) fail(where, "`" + k + "` is not one of its settings (" + Object.keys(d.params || {}).join(", ") + ")"); P[k] = n.entry.params[k]; from[k] = "the creature"; }
        if (props[key]) for (const k in props[key]) { P[k] = props[key][k]; from[k] = "the creature's props for " + key; }
        const wp = env.params_of ? env.params_of(n.name) : null;
        if (wp) for (const k in wp) { P[k] = wp[k]; from[k] = "the world"; }
        memo[key] = P; P.__from = from;
        return P;
      };
      post.forEach(function (n) {                                                                          // (the leaves first: the sets of the block, and where its paths differ)
        const seen = Object.create(null), shared = {}, rs = n.paths.map(function (path) { const P = resolve(path), from = P.__from; delete P.__from; return { P: P, from: from }; });
        rs.forEach(function (r, pi) {                                                                      // (a setting that is not scoped is ONE value for the creature: what is given for it on any path; two different ones are refused)
          for (const k in r.from) {
            if (scoped(n, k)) continue;
            if (shared[k] === undefined) shared[k] = { v: r.P[k], from: r.from[k] };
            else if (JSON.stringify(shared[k].v) !== JSON.stringify(r.P[k])) fail("block `" + n.name + "`", "`" + shared[k].from + "` gives `" + k + "` " + JSON.stringify(shared[k].v) + " and `" + r.from[k] + "` gives it " + JSON.stringify(r.P[k]) + ": list `" + n.name + "` in the creature with the value it should have (`" + k + "` is one value for the creature: a block marks a setting `scoped: true` in its info when its code reads it for the path it is in)");
          }
        });
        rs.forEach(function (r) {
          const flat = {};
          for (const k in r.P) flat[k] = shared[k] !== undefined ? shared[k].v : r.P[k];
          const sig = JSON.stringify(flat);
          if (seen[sig] === undefined) { seen[sig] = n.sets.length; n.sets.push(flat); }
          n.set_of.push(seen[sig]);
        });
        if (n.paths.length > 255) fail("block `" + n.name + "`", "it is reached by " + n.paths.length + " paths (at most 255)");
      });
      post.forEach(function (n) { n.needs = n.sets.length > 1 || (n.paths.length > 1 && n.kids.some(function (k) { return k.node.needs; })); });
      return { nodes: nodes, order: post, items: items, listed: listed };
    };
    M.load = function (api, list, props) {
      const plan = M.plan(list, props), nodes = plan.nodes, post = plan.order, listed = plan.listed;
      const P_of = Object.create(null);
      post.forEach(function (n) { P_of[n.name] = n.sets[0]; });
      const ld = { names: [], hooks: [], nodes: {}, outs: {}, prio: {}, support: {}, params: P_of, scopes: {} };
      post.forEach(function (n) { ld.scopes[n.name] = { paths: n.keys.slice(), sets: n.sets, set_of: n.set_of.slice(), needs: n.needs }; });
      ld.tree = function (name) { return ld.nodes[name] || null; };
      ld.has = function (name) { return ld.outs[name] !== undefined; };
      // THE SCOPE: a block that is reached by paths whose settings differ keeps, for every creature of the species (every slot), the path it is in now: a column of bytes, the index of a path of the block. The one who calls it (its `out`,
      // or its node when it is entered) says which: `map(user)` is the path of the used block that follows from the user's own path. A block reads its settings for the creature in hand with `Q = ld.scoped()` / `Q(me).speed`, and what it
      // makes of them once (a clip's handle) with `H = ld.per_set(function (S) { return api.action(S.clip_wave); })` / `H(me)`.
      ld.where = function (name, slot) { const n = nodes[name]; return n ? n.keys[n.scope ? n.scope[slot] : 0] : null; };                    // the path a block is in now for the creature in a slot: "party/greet/walk" (the editor's preview and the tests ask)
      const slot_of = function (me) { return me && typeof me.slot === "number" ? me.slot : -1; };
      post.forEach(function (n) { n.scope = n.needs ? api.u8() : null; });
      const map_from = function (user, n) {                                                                // (user: the block that calls, or null for the creature's own worker) -> function (slot) -> the index of the path of n
        if (user === null) return function () { return n.root; };
        const m = user.paths.map(function (p) { const i = n.index[p.concat([n.name]).join("/")]; return i === undefined ? n.root : i; });
        return function (s) { return m[user.scope ? user.scope[s] : 0]; };
      };
      const view_cache = Object.create(null);
      const view = function (user) {                                                                       // what a block (or the creature's worker) is given as `ld`: the same loader, with the `out` and `node` of a scoped block bound to the caller's path
        const key = user === null ? "" : user.name;
        if (view_cache[key]) return view_cache[key];
        const v = Object.create(ld), outs = Object.create(null), mapped = Object.create(null);
        v.out = function (name) {
          const o = ld.outs[name], n = nodes[name];
          if (o === undefined) fail("out", "the block `" + name + "` is not loaded (a block says `uses: { " + name + ": {} }` for what it needs)");
          if (!n || !n.needs || !n.def.scope_outs || !n.def.scope_outs.length) return o;
          if (outs[name]) return outs[name];
          const m = mapped[name] || (mapped[name] = map_from(user, n)), w = {};
          for (const k in o) {
            const f = o[k];
            w[k] = typeof f === "function" && n.def.scope_outs.indexOf(k) >= 0 ? function () { const s = slot_of(arguments[0]); if (s >= 0) n.scope[s] = m(s); return f.apply(o, arguments); } : f;
          }
          return (outs[name] = w);
        };
        v.node = function (name) {                                                                         // a loaded block's node, to put in a tree
          const o = ld.outs[name], n = nodes[name];
          if (o === undefined) fail("node", "the block `" + name + "` is not loaded (it is in the creature's mind.blocks, or a block of it uses it)");
          let t;
          if (ld.nodes[name]) t = ld.nodes[name];
          else if (typeof o.node === "function") t = o.node();
          else return fail("node", "the block `" + name + "` has no node of its own (its tree is null): it has hooks and outputs only");
          if (!n || !n.needs || !t || typeof t !== "object") return t;
          const m = mapped[name] || (mapped[name] = map_from(user, n)), prev = t.enter, c = {};
          for (const k in t) c[k] = t[k];
          c.enter = function (me) { const s = slot_of(me); if (s >= 0) n.scope[s] = m(s); if (prev) prev.apply(this, arguments); };       // (entered: the block runs under the path that put its node in the tree)
          return c;
        };
        view_cache[key] = v;
        return v;
      };
      const block_view = function (n) {
        const v = view(n);
        v.scoped = function () {
          const sets = n.sets, set_of = n.set_of, sc = n.scope;
          if (sets.length === 1) return function () { return sets[0]; };
          return function (me) { return sets[set_of[sc[me.slot]]]; };
        };
        v.per_set = function (fn) {
          const vals = n.sets.map(function (S) { return fn(S); }), set_of = n.set_of, sc = n.scope;
          if (vals.length === 1) return function () { return vals[0]; };
          return function (me) { return vals[set_of[sc[me.slot]]]; };
        };
        return v;
      };
      // INPUTS: what a creature supplies to a block. A block says `inputs: { place: { kind, help } }` and reads `ld.input("wander")` (an object that it keeps: `inp.place` is a function when the creature wired one, else nothing: the block uses its
      // own); the creature's worker wires one with `ld.wire("wander", "place", function (me, p) { ... })`, late bound, so the order of loading does not matter. A wire to an input a block does not have, or to a block that is not loaded, is refused.
      ld.inputs = {};
      ld.input = function (name) { return ld.inputs[name] || (ld.inputs[name] = {}); };
      ld.wire = function (name, input, fn) {
        const d = defs[name];
        if (!d || !nodes[name]) fail("wire", "the block `" + name + "` is not loaded (it is in the creature's mind.blocks, or a block of it uses it)");
        if (!d.inputs || !d.inputs[input]) fail("wire", "the block `" + name + "` has no input `" + input + "` (" + Object.keys(d.inputs || {}).join(", ") + ")");
        if (typeof fn !== "function") fail("wire", "an input is wired to a function");
        ld.input(name)[input] = fn;
      };
      const root = view(null);
      ld.out = root.out; ld.node = root.node;
      post.forEach(function (n) {
        const d = n.def, where = "block `" + n.name + "`", P = n.sets[0];
        (d.needs || []).forEach(function (x) {
          const ok = x === "nav" ? api.sw : x === "board" ? api.board : x === "world" ? api.world : x === "body" ? true : true;
          if (!ok) fail(where, "needs `" + x + "` (api." + (x === "nav" ? "sw" : x) + "): this creature is not hosted in a world that has it");
        });
        let r;
        try { r = d.worker(api, P, block_view(n)); } catch (e) { throw new Error("happy_worker_modules: " + where + " failed to load: " + (e && e.message || e)); }
        r = r || {};
        const hooks = r.hooks || {};
        for (const k in hooks) if (HOOK_KEYS.indexOf(k) < 0) fail(where, "its hooks have `" + k + "`, which is not a hook (" + HOOK_KEYS.join(", ") + ")");
        ld.names.push(n.name); ld.outs[n.name] = r.out || {}; ld.nodes[n.name] = r.tree || null; ld.support[n.name] = !n.entry;
        const plug = (n.entry && n.entry.plug) || d.plug || {};
        ld.prio[n.name] = typeof plug.priority === "number" ? plug.priority : (plug.mode === "base" ? 10 : 50);
        if (Object.keys(hooks).length) ld.hooks.push(hooks);
      });
      const scoped_nodes = post.filter(function (n) { return n.scope; });
      if (scoped_nodes.length) ld.hooks.unshift({ spawn: function (me) { for (let i = 0; i < scoped_nodes.length; i++) scoped_nodes[i].scope[me.slot] = scoped_nodes[i].root; } });          // (a creature begins in the path of the block it lists)
      // the creature's tree: the loaded blocks' nodes in a select, the higher priority first (a support block that has a node of its own joins only when the creature listed it)
      ld.auto_tree = function () {                                                                         // (the tree of a creature that is only its skills: the nodes of the blocks it has, the higher priority first; a block the world gives it joins it)
        const ns = ld.names.filter(function (n) { return ld.nodes[n] && !ld.support[n]; }).sort(function (a, b) { return ld.prio[b] - ld.prio[a]; });
        return ns.length ? { select: ns.map(function (n) { return root.node(n); }), name: "mind" } : { wait: 1, name: "empty" };
      };
      ld.mind = function (o) {
        o = o || {};
        const rt = typeof o.tree === "function" ? o.tree(ld.nodes) : ld.auto_tree();
        const out = { ai: { hz: o.hz || 6, far_hz: o.far_hz || 1, tree: rt }, blocks: ld.hooks.slice() };
        if (o.hooks) out.blocks.push(o.hooks);                                                              // (the creature's own hooks, after the blocks'; they join the same chain)
        return out;
      };
      return ld;
    };
    return M;
  }
  return { create: create };
});

// ========================================================================================================================
// worker_selftest
// ========================================================================================================================
packing()("happy_worker_selftest", function happy_worker_selftest() {
  "use strict";
  // HAPPY WORKER SELFTEST: the direct writes (direct.js) held to the commands (the C++ exports of body.cpp), on the REAL wasm memory, from inside the worker (the only place a JS view over that memory can be had: the main thread has
  // none). Two instances of one family are made equal, byte for byte, in every per-instance column; then a command is given to one of them by the wasm's own export and the same thing is written into the other by direct.js; the two
  // answers (0 or an error code) have to be the same and so does every byte of every column of the two. That says three things at once: the directory points at the columns the commands write (a view of the wrong column would not
  // hear the command), the direct write is the command's twin, and a refused argument leaves a column alone in the same way. A creature's own frame is not run: the frame is a function of the columns' bytes.
  //
  //   run({ wa, cols, fam, D, K, js, scratch: { words: Uint32Array, floats: Float32Array, at: byte address of both } }) -> { total, failed: [text], notes: [text], ops: { name: cases } }
  //   a family needs two live instances; a command that the family does not have the part for (no script, no arms, no face) is tried for the error it gives and the columns that stay as they were.
  // Node 14 and the bundler's parser: no optional chaining, no ??, no async / await, no class.
  const NAN = NaN;

  function run(x) {
    const wa = x.wa, cols = x.cols, fam = x.fam, D = x.D, K = x.K, js = x.js, sc = x.scratch;
    const rep = { total: 0, failed: [], notes: [], ops: {} };
    cols.refresh(fam);
    if (!fam.live) { rep.failed.push("the family " + js + " is not there"); return rep; }
    const alive = [];
    for (let s = 0; s < fam.max && alive.length < 2; s++) if (fam.ALIVE[s]) alive.push(s);
    if (alive.length < 2) { rep.failed.push("the family needs two live instances (it has " + alive.length + ")"); return rep; }
    const s0 = alive[0], s1 = alive[1], g0 = fam.GEN[s0];
    let dead = -1;
    for (let s = 0; s < fam.max; s++) if (!fam.ALIVE[s]) { dead = s; break; }

    // the columns of an instance (a row each): every column of the table that has max_instances rows, but the ones that say whether the instance is there
    const per = [];
    for (let i = 0; i < cols.COUNT; i++) {
      const name = cols.NAMES[i], v = fam[name];
      if (!v || name === "ALIVE" || name === "GEN") continue;
      const n = fam[name + "_N"];
      if (n > 0 && v.length === n * fam.max) per.push(name);
    }
    const bytes_of = function (name, s) { const v = fam[name], n = fam[name + "_N"]; return new Uint8Array(v.buffer, v.byteOffset + s * n * v.BYTES_PER_ELEMENT, n * v.BYTES_PER_ELEMENT); };
    const equalize = function () { per.forEach(function (name) { bytes_of(name, s1).set(bytes_of(name, s0)); }); };
    const diff = function () {
      for (let k = 0; k < per.length; k++) {
        const a = bytes_of(per[k], s0), b = bytes_of(per[k], s1);
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return per[k] + "[" + i + "]: the command left " + a[i] + ", the direct write " + b[i];
      }
      return "";
    };
    const changed = function (before) {                                                                      // (did the command write anything: a case that writes nothing at all is a case that proves nothing)
      for (let k = 0; k < per.length; k++) {
        const a = bytes_of(per[k], s0), b = before[per[k]];
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true;
      }
      return false;
    };
    const take = function () { const o = {}; per.forEach(function (name) { o[name] = new Uint8Array(bytes_of(name, s0)); }); return o; };

    // one case: the command by the export on instance s0, the same by direct.js on s1; `expect`: "write" (it has to change something), "refuse" (it has to change nothing and answer an error), "any"
    const both = function (op, what, by_wasm, by_direct, expect) {
      cols.refresh(fam);
      equalize();
      const before = take();
      const a = by_wasm(), b = by_direct(), moved = changed(before), d = diff();
      rep.total++;
      rep.ops[op] = (rep.ops[op] || 0) + 1;
      const tag = op + ": " + what;
      if (a !== b) rep.failed.push(tag + ": the export answers " + a + ", the direct write " + b);
      else if (d) rep.failed.push(tag + ": " + d);
      else if (expect === "write" && (a !== 0 || !moved)) rep.failed.push(tag + ": it should have written (answer " + a + ", " + (moved ? "wrote" : "wrote nothing") + ")");
      else if (expect === "refuse" && (a === 0 || moved)) rep.failed.push(tag + ": it should have been refused with nothing written (answer " + a + ", " + (moved ? "wrote" : "wrote nothing") + ")");
    };
    const floats = function () { for (let i = 0; i < arguments.length; i++) sc.floats[i] = arguments[i]; return sc.at; };

    // ---- the body and the wish
    if (fam.INTENT) {
      both("intent", "a wish", function () { return wa.happy_set_intent(js, s0, g0, 0.5, 1.25, -0.25, 0.75); }, function () { return D.intent(fam, s1, 0.5, 1.25, -0.25, 0.75); }, "write");
      both("intent", "a wish with no facing", function () { return wa.happy_set_intent(js, s0, g0, 1.7, 0, 0, 0); }, function () { return D.intent(fam, s1, 1.7, 0, 0, 0); }, "write");
      both("intent", "a NaN", function () { return wa.happy_set_intent(js, s0, g0, NAN, 1, 0, 0); }, function () { return D.intent(fam, s1, NAN, 1, 0, 0); }, "refuse");
      both("intent", "an infinity", function () { return wa.happy_set_intent(js, s0, g0, 1, Infinity, 0, 0); }, function () { return D.intent(fam, s1, 1, Infinity, 0, 0); }, "refuse");
      if (dead >= 0) both("intent", "an instance that is not there", function () { return wa.happy_set_intent(js, dead, 1, 1, 1, 0, 0); }, function () { return D.intent(fam, dead, 1, 1, 0, 0); }, "refuse");
      both("intent", "a slot beyond the table", function () { return wa.happy_set_intent(js, fam.max + 3, 1, 1, 1, 0, 0); }, function () { return D.intent(fam, fam.max + 3, 1, 1, 0, 0); }, "refuse");
      both("drive", "on", function () { return wa.happy_body_drive(js, s0, g0, 1, 1.5, -0.5); }, function () { return D.drive(fam, s1, 1, 1.5, -0.5); }, "write");
      both("drive", "off", function () { return wa.happy_body_drive(js, s0, g0, 0, 9, 9); }, function () { return D.drive(fam, s1, 0, 9, 9); }, "any");
      both("drive", "a flag that is not one", function () { return wa.happy_body_drive(js, s0, g0, 2, 1, 1); }, function () { return D.drive(fam, s1, 2, 1, 1); }, "refuse");
      both("drive", "too fast", function () { return wa.happy_body_drive(js, s0, g0, 1, 20000, 0); }, function () { return D.drive(fam, s1, 1, 20000, 0); }, "refuse");
      both("push", "a shove", function () { return wa.happy_body_push(js, s0, g0, 0.75, -1.25, 2); }, function () { return D.push(fam, s1, 0.75, -1.25, 2); }, "write");
      both("push", "a NaN", function () { return wa.happy_body_push(js, s0, g0, 1, NAN, 2); }, function () { return D.push(fam, s1, 1, NAN, 2); }, "refuse");
      fam.FLAGS[s0] |= K.F_AIR; fam.FLAGS[s1] |= K.F_AIR;
      both("push", "in the air (the vertical part counts)", function () { return wa.happy_body_push(js, s0, g0, 0.5, 0.5, 3); }, function () { return D.push(fam, s1, 0.5, 0.5, 3); }, "write");
      fam.FLAGS[s0] &= ~K.F_AIR; fam.FLAGS[s1] &= ~K.F_AIR;
      if (fam.JUMP_OK) {
        both("jump", "a launch", function () { return wa.happy_body_jump(js, s0, g0, 4.5, 0); }, function () { return D.jump(fam, s1, 4.5, 0); }, "write");
        fam.FLAGS[s0] |= K.F_AIR; fam.FLAGS[s1] |= K.F_AIR; fam.VY[s0] = 1; fam.VY[s1] = 1;
        both("jump", "in the air without the flag (it does nothing)", function () { return wa.happy_body_jump(js, s0, g0, 7, 0); }, function () { return D.jump(fam, s1, 7, 0); }, "any");
        both("jump", "in the air with the flag", function () { return wa.happy_body_jump(js, s0, g0, 7, 1); }, function () { return D.jump(fam, s1, 7, 1); }, "write");
        fam.FLAGS[s0] &= ~K.F_AIR; fam.FLAGS[s1] &= ~K.F_AIR;
        both("jump", "a flag that is not one", function () { return wa.happy_body_jump(js, s0, g0, 4, 2); }, function () { return D.jump(fam, s1, 4, 2); }, "refuse");
      } else rep.notes.push("the family cannot jump (no gravity or no ground): the launch is tried for its refusal");
      if (!fam.JUMP_OK) both("jump", "a creature that cannot jump", function () { return wa.happy_body_jump(js, s0, g0, 4, 0); }, function () { return D.jump(fam, s1, 4, 0); }, "refuse");
      // the flight: the worker's wish to take off and land (a column the body reads at the top of its frame: the export writes the same column) and the climb wished
      if (fam.FLY_OK) {
        both("fly", "a wish to take off", function () { return wa.happy_body_fly_wish(js, s0, g0, 1); }, function () { return D.fly(fam, s1, 1); }, "write");
        both("fly", "a wish to land", function () { return wa.happy_body_fly_wish(js, s0, g0, 2); }, function () { return D.fly(fam, s1, 2); }, "write");
        fam.FLYWISH[s0] = 2; fam.FLYWISH[s1] = 2;
        both("fly", "no wish (the one that waits is taken back)", function () { return wa.happy_body_fly_wish(js, s0, g0, 0); }, function () { return D.fly(fam, s1, 0); }, "write");
        both("fly", "a wish that is not one", function () { return wa.happy_body_fly_wish(js, s0, g0, 3); }, function () { return D.fly(fam, s1, 3); }, "refuse");
      } else both("fly", "a creature that cannot take off (no flight, no aircraft or no gravity)", function () { return wa.happy_body_fly_wish(js, s0, g0, 1); }, function () { return D.fly(fam, s1, 1); }, "refuse");
      if (fam.CLIMB_OK) {
        both("climb", "a climb", function () { return wa.happy_body_climb(js, s0, g0, 2.5); }, function () { return D.climb(fam, s1, 2.5); }, "write");
        both("climb", "a dive", function () { return wa.happy_body_climb(js, s0, g0, -3.25); }, function () { return D.climb(fam, s1, -3.25); }, "write");
        both("climb", "a NaN", function () { return wa.happy_body_climb(js, s0, g0, NAN); }, function () { return D.climb(fam, s1, NAN); }, "refuse");
        both("climb", "an infinity", function () { return wa.happy_body_climb(js, s0, g0, Infinity); }, function () { return D.climb(fam, s1, Infinity); }, "refuse");
      } else both("climb", "a creature with no flight", function () { return wa.happy_body_climb(js, s0, g0, 2.5); }, function () { return D.climb(fam, s1, 2.5); }, "refuse");
    } else rep.notes.push("no body: the body's commands are tried for the error they give");
    if (!fam.INTENT) both("intent", "a creature with no body", function () { return wa.happy_set_intent(js, s0, g0, 1, 1, 0, 0); }, function () { return D.intent(fam, s1, 1, 1, 0, 0); }, "refuse");
    if (!fam.INTENT) both("fly", "a creature with no body", function () { return wa.happy_body_fly_wish(js, s0, g0, 1); }, function () { return D.fly(fam, s1, 1); }, "refuse");

    both("root", "a place, a turn that is not a unit, a scale", function () { return wa.happy_set_root(js, s0, g0, 1.5, 0.25, -2.5, 0.1, 0.7, 0.2, 0.6, 1.25); }, function () { return D.root(fam, s1, 1.5, 0.25, -2.5, 0.1, 0.7, 0.2, 0.6, 1.25); }, "write");
    both("root", "no turn at all (the identity), no scale (it stays)", function () { return wa.happy_set_root(js, s0, g0, -3, 1, 4, 0, 0, 0, 0, 0); }, function () { return D.root(fam, s1, -3, 1, 4, 0, 0, 0, 0, 0); }, "write");
    both("root", "a turn about up", function () { return wa.happy_set_root(js, s0, g0, 0, 0, 0, 0, 0.3826834, 0, 0.9238795, 1); }, function () { return D.root(fam, s1, 0, 0, 0, 0, 0.3826834, 0, 0.9238795, 1); }, "write");

    // ---- the legs
    if (fam.TREAD) {
      both("tread", "the ground scrolls", function () { return wa.happy_legs_tread(js, s0, g0, 0, 0.9); }, function () { return D.tread(fam, s1, 0, 0.9); }, "write");
      both("tread", "a NaN", function () { return wa.happy_legs_tread(js, s0, g0, NAN, 0.9); }, function () { return D.tread(fam, s1, NAN, 0.9); }, "refuse");
      both("tread", "too fast", function () { return wa.happy_legs_tread(js, s0, g0, 0, 30000); }, function () { return D.tread(fam, s1, 0, 30000); }, "refuse");
      const ng = fam.GAIT_COUNT[0];
      both("gait_blend", "the first gait", function () { return wa.happy_legs_gait_blend(js, s0, g0, 0, ng - 1, 0.4); }, function () { return D.gait_blend(fam, s1, 0, ng - 1, 0.4); }, "write");
      both("gait_blend", "a gait the family does not have", function () { return wa.happy_legs_gait_blend(js, s0, g0, 0, ng, 0.4); }, function () { return D.gait_blend(fam, s1, 0, ng, 0.4); }, "refuse");
      both("gait_blend", "a weight over 1", function () { return wa.happy_legs_gait_blend(js, s0, g0, 0, 0, 1.5); }, function () { return D.gait_blend(fam, s1, 0, 0, 1.5); }, "refuse");
      both("gait_blend", "a weight under 0", function () { return wa.happy_legs_gait_blend(js, s0, g0, 0, 0, -0.1); }, function () { return D.gait_blend(fam, s1, 0, 0, -0.1); }, "refuse");
    } else both("tread", "a creature with no legs", function () { return wa.happy_legs_tread(js, s0, g0, 0, 1); }, function () { return D.tread(fam, s1, 0, 1); }, "refuse");
    if (fam.OVR_COV) {
      const nl = fam.NLEGS;
      for (let leg = 0; leg < nl; leg++) {
        both("foot", "leg " + leg + " taken", function () { return wa.happy_legs_ovr(js, s0, g0, leg, 0.75, 0.125, -0.5, 0.375); }, function () { return D.foot(fam, s1, leg, 0.75, 0.125, -0.5, 0.375); }, "write");
        both("knee", "leg " + leg + " turned", function () { return wa.happy_legs_knee(js, s0, g0, leg, 0.5, 0.3); }, function () { return D.knee(fam, s1, leg, 0.5, 0.3); }, "write");
      }
      both("foot", "a coverage over 1 is 1", function () { return wa.happy_legs_ovr(js, s0, g0, 0, 5, 0, -1, 0); }, function () { return D.foot(fam, s1, 0, 5, 0, -1, 0); }, "write");
      both("foot", "a coverage of 0 lets go (the place stays)", function () { return wa.happy_legs_ovr(js, s0, g0, 0, 0, 1, 1, 1); }, function () { return D.foot(fam, s1, 0, 0, 1, 1, 1); }, "any");
      both("foot", "a leg that is not there", function () { return wa.happy_legs_ovr(js, s0, g0, nl, 1, 0, -1, 0); }, function () { return D.foot(fam, s1, nl, 1, 0, -1, 0); }, "refuse");
      both("foot", "a place too far", function () { return wa.happy_legs_ovr(js, s0, g0, 0, 1, 11, 0, 0); }, function () { return D.foot(fam, s1, 0, 1, 11, 0, 0); }, "refuse");
      both("foot", "a NaN", function () { return wa.happy_legs_ovr(js, s0, g0, 0, NAN, 0, 0, 0); }, function () { return D.foot(fam, s1, 0, NAN, 0, 0, 0); }, "refuse");
      both("knee", "an angle past a half turn is held to it", function () { return wa.happy_legs_knee(js, s0, g0, 0, 1, 4.5); }, function () { return D.knee(fam, s1, 0, 1, 4.5); }, "write");
      both("knee", "the other way", function () { return wa.happy_legs_knee(js, s0, g0, 0, 1, -4.5); }, function () { return D.knee(fam, s1, 0, 1, -4.5); }, "write");
      both("knee", "a coverage of 0", function () { return wa.happy_legs_knee(js, s0, g0, 0, 0, 1); }, function () { return D.knee(fam, s1, 0, 0, 1); }, "any");
      both("knee", "a leg that is not there", function () { return wa.happy_legs_knee(js, s0, g0, nl + 2, 1, 0.1); }, function () { return D.knee(fam, s1, nl + 2, 1, 0.1); }, "refuse");
    } else {
      rep.notes.push("the legs refuse a script (no HAPPY_LEGS_SCRIPT): the foot and the knee are tried for their refusal");
      both("foot", "legs that refuse a script", function () { return wa.happy_legs_ovr(js, s0, g0, 0, 1, 0, -1, 0); }, function () { return D.foot(fam, s1, 0, 1, 0, -1, 0); }, "refuse");
      both("knee", "legs that refuse a script", function () { return wa.happy_legs_knee(js, s0, g0, 0, 1, 0.1); }, function () { return D.knee(fam, s1, 0, 1, 0.1); }, "refuse");
    }

    // ---- the life: the layer on a bone, the hand, the look
    if (fam.LIFE_POKE) {
      both("life", "off", function () { return wa.happy_life_command(js, s0, g0, 0, 0, floats(0, 0, 0, 0, 0, 0)); }, function () { return D.life(fam, s1, 0); }, "write");
      both("life", "on", function () { return wa.happy_life_command(js, s0, g0, 0, 0, floats(1, 0, 0, 0, 0, 0)); }, function () { return D.life(fam, s1, 1); }, "any");
      let arms = 0, fixed = 0, free = 0;
      for (let k = 0; k < fam.NOV; k++) {
        const arm = (fam.LIFE_ROLE[k] & (K.R_UPPER | K.R_FORE)) !== 0, still = fam.LIFE_MOVABLE[k] === 0;
        arms += arm ? 1 : 0; fixed += !arm && still ? 1 : 0; free += !arm && !still ? 1 : 0;
        both("pose", "bone " + k + " turned" + (arm ? " (an arm's: refused)" : ""), function () { return wa.happy_life_command(js, s0, g0, 1, k, floats(0.125, -0.25, 0.0625, 0, 0, 0)); }, function () { return D.pose(fam, s1, k, 0.125, -0.25, 0.0625, 0, 0, 0); }, arm ? "refuse" : "write");
        both("pose", "bone " + k + " turned and moved" + (arm ? " (an arm's: refused)" : (still ? " (it is not movable: refused)" : "")), function () { return wa.happy_life_command(js, s0, g0, 1, k, floats(0.1, 0.2, 0.3, 0.01, -0.02, 0.03)); }, function () { return D.pose(fam, s1, k, 0.1, 0.2, 0.3, 0.01, -0.02, 0.03); }, arm || still ? "refuse" : "write");
      }
      rep.notes.push("overlay bones: " + fam.NOV + " (" + free + " free, " + fixed + " that only turn, " + arms + " an arm's)");
      both("pose", "a bone that is not there", function () { return wa.happy_life_command(js, s0, g0, 1, fam.NOV, floats(0, 0, 0, 0, 0, 0)); }, function () { return D.pose(fam, s1, fam.NOV, 0, 0, 0, 0, 0, 0); }, "refuse");
      both("pose", "a NaN", function () { return wa.happy_life_command(js, s0, g0, 1, 0, floats(NAN, 0, 0, 0, 0, 0)); }, function () { return D.pose(fam, s1, 0, NAN, 0, 0, 0, 0, 0); }, "refuse");
      const na = fam.NARMS;
      if (na > 0) {
        for (let arm = 0; arm < na; arm++) {
          both("hand", "arm " + arm + " in the body's frame", function () { return wa.happy_life_hand(js, s0, g0, arm, 1, 0.75, floats(0.25, 0.5, 0.875), 0.2, 0.5); }, function () { return D.hand(fam, s1, arm, 1, 0.75, 0.25, 0.5, 0.875, 0.2, 0.5); }, "write");
          both("hand", "arm " + arm + " in the torso's frame, with the elbow turned", function () { return wa.happy_life_hand(js, s0, g0, arm, 0, 1, floats(-0.5, 0.25, 0.5), 9, 2); }, function () { return D.hand(fam, s1, arm, 0, 1, -0.5, 0.25, 0.5, 9, 2); }, "write");
        }
        both("hand", "a weight of 0 lets go (the place stays)", function () { return wa.happy_life_hand(js, s0, g0, 0, 1, 0, floats(1, 1, 1), 0, 0); }, function () { return D.hand(fam, s1, 0, 1, 0, 1, 1, 1, 0, 0); }, "write");
        both("hand", "an arm that is not there", function () { return wa.happy_life_hand(js, s0, g0, na, 1, 1, floats(0, 0, 0), 0, 0); }, function () { return D.hand(fam, s1, na, 1, 1, 0, 0, 0, 0, 0); }, "refuse");
        both("hand", "a place too far", function () { return wa.happy_life_hand(js, s0, g0, 0, 1, 1, floats(5, 0, 0), 0, 0); }, function () { return D.hand(fam, s1, 0, 1, 1, 5, 0, 0, 0, 0); }, "refuse");
        both("hand", "a flag that is not one", function () { return wa.happy_life_hand(js, s0, g0, 0, 16, 1, floats(0, 0, 0), 0, 0); }, function () { return D.hand(fam, s1, 0, 16, 1, 0, 0, 0, 0, 0); }, "refuse");
        for (let arm = 0; arm < na; arm++) both("hand", "arm " + arm + ": a point of the world, the body leans, the hand stops at a surface, the elbow turned", function () { return wa.happy_life_hand(js, s0, g0, arm, 14, 0.75, floats(12.5, 1.25, -40), 0.5, 0.25); }, function () { return D.hand(fam, s1, arm, 14, 0.75, 12.5, 1.25, -40, 0.5, 0.25); }, "write");
        both("hand", "a point of the world, a weight of 0 lets it go (the point stays)", function () { return wa.happy_life_hand(js, s0, g0, 0, 6, 0, floats(1, 2, 3), 0, 0); }, function () { return D.hand(fam, s1, 0, 6, 0, 1, 2, 3, 0, 0); }, "write");
        both("hand", "a point 500 km away is a place", function () { return wa.happy_life_hand(js, s0, g0, 0, 2, 1, floats(5e5, 3, -7), 0, 0); }, function () { return D.hand(fam, s1, 0, 2, 1, 5e5, 3, -7, 0, 0); }, "write");
        both("hand", "a point of the world beyond a million metres", function () { return wa.happy_life_hand(js, s0, g0, 0, 2, 1, floats(2e6, 0, 0), 0, 0); }, function () { return D.hand(fam, s1, 0, 2, 1, 2e6, 0, 0, 0, 0); }, "refuse");
        both("hand", "the body's frame and the world at once", function () { return wa.happy_life_hand(js, s0, g0, 0, 3, 1, floats(0, 0, 0), 0, 0); }, function () { return D.hand(fam, s1, 0, 3, 1, 0, 0, 0, 0, 0); }, "refuse");
        both("hand", "the lean without the world", function () { return wa.happy_life_hand(js, s0, g0, 0, 4, 1, floats(0, 0, 0), 0, 0); }, function () { return D.hand(fam, s1, 0, 4, 1, 0, 0, 0, 0, 0); }, "refuse");
      } else both("hand", "a creature with no arms", function () { return wa.happy_life_hand(js, s0, g0, 0, 1, 1, floats(0, 0, 0), 0, 0); }, function () { return D.hand(fam, s1, 0, 1, 1, 0, 0, 0, 0, 0); }, "refuse");
      // the look: its goal is three words (floats, or for another instance a js id, a slot, a generation)
      const look_f = function (mode, flags, a, b, c, w, h) { sc.floats[0] = a; sc.floats[1] = b; sc.floats[2] = c; return wa.happy_face_look(js, s0, g0, mode, flags, sc.at, w, h); };
      const look_w = function (mode, flags, a, b, c, w, h) { sc.words[0] = a; sc.words[1] = b; sc.words[2] = c; return wa.happy_face_look(js, s0, g0, mode, flags, sc.at, w, h); };
      const exp = fam.LOOK_OK ? "write" : "refuse";
      both("look", "a point in the world", function () { return look_f(1, 0, 3.5, 1.25, -2, 0.875, 0); }, function () { return D.look(fam, s1, 1, 0, 3.5, 1.25, -2, 0.875, 0); }, exp);
      both("look", "a direction in the body's frame, eyes only", function () { return look_f(2, 1, 0.5, -0.25, 0, 1, 0); }, function () { return D.look(fam, s1, 2, 1, 0.5, -0.25, 0, 1, 0); }, exp);
      both("look", "another instance", function () { return look_w(3, 2, js, s1, fam.GEN[s1], 0.5, 0.25); }, function () { return D.look(fam, s1, 3, 2, js, s1, fam.GEN[s1], 0.5, 0.25); }, exp);
      both("look", "let go", function () { return look_f(0, 0, 0, 0, 0, 1, 0); }, function () { return D.look(fam, s1, 0, 0, 0, 0, 0, 1, 0); }, "any");
      both("look", "a mode that is not one", function () { return look_f(4, 0, 0, 0, 0, 1, 0); }, function () { return D.look(fam, s1, 4, 0, 0, 0, 0, 1, 0); }, "refuse");
      both("look", "a direction beyond a turn", function () { return look_f(2, 0, 7, 0, 0, 1, 0); }, function () { return D.look(fam, s1, 2, 0, 7, 0, 0, 1, 0); }, "refuse");
      both("look", "a js id of 0", function () { return look_w(3, 0, 0, 1, 1, 1, 0); }, function () { return D.look(fam, s1, 3, 0, 0, 1, 1, 1, 0); }, "refuse");
      both("look", "a NaN weight", function () { return look_f(1, 0, 1, 1, 1, NAN, 0); }, function () { return D.look(fam, s1, 1, 0, 1, 1, 1, NAN, 0); }, "refuse");
    } else rep.notes.push("no life: the life's commands are not tried (the family has no roles)");

    // ---- the face
    if (fam.FACE_ST) {
      const fc = K.FC_COUNT;
      for (let c = 0; c < fc; c++) {
        both("face", "channel " + c + " to 0.5, held 2 s", function () { return wa.happy_face_cmd(js, s0, g0, 0, c, 0.5, 2, 0); }, function () { return D.face(fam, s1, 0, c, 0.5, 2, 0); }, "write");
        both("face", "channel " + c + " to 3 (held to its range), held until changed", function () { return wa.happy_face_cmd(js, s0, g0, 0, c, 3, 0, 0); }, function () { return D.face(fam, s1, 0, c, 3, 0, 0); }, "write");
        both("face", "channel " + c + " to -3", function () { return wa.happy_face_cmd(js, s0, g0, 0, c, -3, 0, 0); }, function () { return D.face(fam, s1, 0, c, -3, 0, 0); }, "write");
      }
      for (let e = 0; e < 10; e++) {
        both("face", "expression " + e, function () { return wa.happy_face_cmd(js, s0, g0, 1, e, 0, 0, 0); }, function () { return D.face(fam, s1, 1, e, 0, 0, 0); }, "any");
        both("face", "expression " + e + " at half, held 1.5 s", function () { return wa.happy_face_cmd(js, s0, g0, 1, e, 0, 1.5, 0.5); }, function () { return D.face(fam, s1, 1, e, 0, 1.5, 0.5); }, "any");
      }
      both("face", "an expression that is not there", function () { return wa.happy_face_cmd(js, s0, g0, 1, 10, 0, 0, 0); }, function () { return D.face(fam, s1, 1, 10, 0, 0, 0); }, "refuse");
      both("face", "a channel that is not there", function () { return wa.happy_face_cmd(js, s0, g0, 0, fc, 1, 0, 0); }, function () { return D.face(fam, s1, 0, fc, 1, 0, 0); }, "refuse");
      both("face", "a blink", function () { return wa.happy_face_cmd(js, s0, g0, 2, 1, 0, 0, 0); }, function () { return D.face(fam, s1, 2, 1, 0, 0, 0); }, "write");
      both("face", "every act at once", function () { return wa.happy_face_cmd(js, s0, g0, 2, K.FACT_ALL, 0, 0, 0); }, function () { return D.face(fam, s1, 2, K.FACT_ALL, 0, 0, 0); }, "write");
      both("face", "no act at all", function () { return wa.happy_face_cmd(js, s0, g0, 2, 0, 0, 0, 0); }, function () { return D.face(fam, s1, 2, 0, 0, 0, 0); }, "refuse");
      both("face", "an act that is not one", function () { return wa.happy_face_cmd(js, s0, g0, 2, K.FACT_ALL + 1, 0, 0, 0); }, function () { return D.face(fam, s1, 2, K.FACT_ALL + 1, 0, 0, 0); }, "refuse");
      both("face", "a negative hold", function () { return wa.happy_face_cmd(js, s0, g0, 0, 0, 1, -1, 0); }, function () { return D.face(fam, s1, 0, 0, 1, -1, 0); }, "refuse");
      both("face", "a hold of hours", function () { return wa.happy_face_cmd(js, s0, g0, 0, 0, 1, 4000, 0); }, function () { return D.face(fam, s1, 0, 0, 1, 4000, 0); }, "refuse");
      both("face", "a scale over 4", function () { return wa.happy_face_cmd(js, s0, g0, 1, 1, 0, 0, 5); }, function () { return D.face(fam, s1, 1, 1, 0, 0, 5); }, "refuse");
      both("face", "a NaN", function () { return wa.happy_face_cmd(js, s0, g0, 0, 0, NAN, 0, 0); }, function () { return D.face(fam, s1, 0, 0, NAN, 0, 0); }, "refuse");
      both("face", "an op that is not one", function () { return wa.happy_face_cmd(js, s0, g0, 3, 0, 0, 0, 0); }, function () { return D.face(fam, s1, 3, 0, 0, 0, 0); }, "refuse");
    } else both("face", "a creature with no face", function () { return wa.happy_face_cmd(js, s0, g0, 0, 0, 1, 0, 0); }, function () { return D.face(fam, s1, 0, 0, 1, 0, 0); }, "refuse");

    // ---- the rig's chains: where a chain's end is asked to be (twelve numbers: the target, the turn wanted, the weight, the pole, the pole's weight)
    if (fam.RIG_TGT) {
      const nc = fam.NCHAINS, chain12 = function (a, b, c, d, e, f, g, h, i, j, k, l) { return floats(a, b, c, d, e, f, g, h, i, j, k, l); };
      for (let c = 0; c < nc; c++) {
        both("chain", "chain " + c + " asked for a place", function () { return wa.happy_rig_chain(js, s0, g0, c, 1, chain12(0.25, 0.5, 0.75, 0, 0, 0, 1, 1, 0, 0, 1, 0.5)); }, function () { return D.chain(fam, s1, c, 1, 0.25, 0.5, 0.75, 0, 0, 0, 1, 1, 0, 0, 1, 0.5); }, "write");
      }
      both("chain", "a turn that is not a unit is made one", function () { return wa.happy_rig_chain(js, s0, g0, 0, 3, chain12(0.1, 0.2, 0.3, 0.1, 0.5, 0.25, 0.75, 0.9, 0, 1, 0, 1)); }, function () { return D.chain(fam, s1, 0, 3, 0.1, 0.2, 0.3, 0.1, 0.5, 0.25, 0.75, 0.9, 0, 1, 0, 1); }, "write");
      both("chain", "no turn at all (all zeros): the numbers stay what they come to", function () { return wa.happy_rig_chain(js, s0, g0, 0, 1, chain12(1, 2, 3, 0, 0, 0, 0, 1, 0, 0, 0, 0)); }, function () { return D.chain(fam, s1, 0, 1, 1, 2, 3, 0, 0, 0, 0, 1, 0, 0, 0, 0); }, "write");
      both("chain", "a weight and a pole's weight held to 0 .. 1", function () { return wa.happy_rig_chain(js, s0, g0, 0, 1, chain12(0, 0, 0, 0, 0, 0, 1, 4, 0, 0, 1, -2)); }, function () { return D.chain(fam, s1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 4, 0, 0, 1, -2); }, "write");
      both("chain", "the weight below 0", function () { return wa.happy_rig_chain(js, s0, g0, 0, 1, chain12(0, 0, 0, 0, 0, 0, 1, -3, 0, 0, 1, 7)); }, function () { return D.chain(fam, s1, 0, 1, 0, 0, 0, 0, 0, 0, 1, -3, 0, 0, 1, 7); }, "write");
      both("chain", "the same again (it changes nothing: the unit is not made dirty)", function () { return wa.happy_rig_chain(js, s0, g0, 0, 1, chain12(0, 0, 0, 0, 0, 0, 1, -3, 0, 0, 1, 7)); }, function () { return D.chain(fam, s1, 0, 1, 0, 0, 0, 0, 0, 0, 1, -3, 0, 0, 1, 7); }, "any");
      const same_s0 = function () { return wa.happy_rig_chain(js, s0, g0, 0, 1, chain12(5, 6, 7, 0, 0, 0, 1, 1, 0, 0, 1, 1)); }, same_s1 = function () { return D.chain(fam, s1, 0, 1, 5, 6, 7, 0, 0, 0, 1, 1, 0, 0, 1, 1); };
      same_s0(); same_s1();
      both("chain", "said twice (the second changes nothing, though a dirty flag was cleared in between)", function () { fam.RIG_CDIRTY[s0] = 0; fam.RIG_UCHG.fill(0, s0 * fam.NUNITS, (s0 + 1) * fam.NUNITS); return same_s0(); }, function () { fam.RIG_CDIRTY[s1] = 0; fam.RIG_UCHG.fill(0, s1 * fam.NUNITS, (s1 + 1) * fam.NUNITS); return same_s1(); }, "any");
      both("chain", "a chain that is not there", function () { return wa.happy_rig_chain(js, s0, g0, nc, 1, chain12(0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0)); }, function () { return D.chain(fam, s1, nc, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0); }, "refuse");
      both("chain", "a flag that is not one", function () { return wa.happy_rig_chain(js, s0, g0, 0, 4, chain12(0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0)); }, function () { return D.chain(fam, s1, 0, 4, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0); }, "refuse");
      both("chain", "a NaN", function () { return wa.happy_rig_chain(js, s0, g0, 0, 1, chain12(NAN, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0)); }, function () { return D.chain(fam, s1, 0, 1, NAN, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0); }, "refuse");
      both("chain", "let go (not live)", function () { return wa.happy_rig_chain(js, s0, g0, 0, 0, chain12(0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0)); }, function () { return D.chain(fam, s1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0); }, "any");
    } else both("chain", "a creature with no chains", function () { return wa.happy_rig_chain(js, s0, g0, 0, 1, floats(0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0)); }, function () { return D.chain(fam, s1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0); }, "refuse");

    // ---- the wings
    if (fam.WING_MANUAL) {
      both("wings", "by hand", function () { return wa.happy_wings_set(js, s0, g0, 1, 0.5, 3, 1.25); }, function () { return D.wings(fam, s1, 1, 0.5, 3, 1.25); }, "write");
      both("wings", "automatic again (the numbers stay)", function () { return wa.happy_wings_set(js, s0, g0, 0, 0.9, 9, 2); }, function () { return D.wings(fam, s1, 0, 0.9, 9, 2); }, "write");
      both("wings", "a mode that is not one", function () { return wa.happy_wings_set(js, s0, g0, 2, 0.5, 3, 1); }, function () { return D.wings(fam, s1, 2, 0.5, 3, 1); }, "refuse");
      both("wings", "a fold over 1", function () { return wa.happy_wings_set(js, s0, g0, 1, 1.5, 3, 1); }, function () { return D.wings(fam, s1, 1, 1.5, 3, 1); }, "refuse");
      both("wings", "a rate over 50", function () { return wa.happy_wings_set(js, s0, g0, 1, 0.5, 60, 1); }, function () { return D.wings(fam, s1, 1, 0.5, 60, 1); }, "refuse");
      both("wings", "an amplitude over 3", function () { return wa.happy_wings_set(js, s0, g0, 1, 0.5, 3, 4); }, function () { return D.wings(fam, s1, 1, 0.5, 3, 4); }, "refuse");
      both("wings", "a NaN", function () { return wa.happy_wings_set(js, s0, g0, 1, NAN, 3, 1); }, function () { return D.wings(fam, s1, 1, NAN, 3, 1); }, "refuse");
    } else both("wings", "a creature with no wings", function () { return wa.happy_wings_set(js, s0, g0, 1, 0.5, 3, 1); }, function () { return D.wings(fam, s1, 1, 0.5, 3, 1); }, "refuse");
    return rep;
  }

  // A STYLE IN A SPARE SLOT, against the page's own command: the page has given a style to a gait of the family with sp.set_style(style, { gait: cpp_gait, fade: 0 }) (CMD_HAPPY_STYLE: the C++ wrote the numbers, the path, the upper
  // body and the feet of the gait) and, for the first gait, the family's phases; the worker writes the same style into the spare slot `spare` by itself (gait_slots.js: the plan of core.plan, the tables into the columns); every table of the
  // two gaits has to be the same bytes, the new slot's phases the family's (the style's order of the steps), and the family's flags those of the masks. Both gaits have to be spare ones of the family (no `from`: the creature's own gait 0
  // is a different thing).
  //   slots({ cols, fam, pool, core, h, style, cpp_gait, spare, o }) -> { total, failed, notes }
  function slots(x) {
    const fam = x.fam, pool = x.pool, rep = { total: 0, failed: [], notes: [] };
    x.cols.refresh(fam);
    if (!fam.live || fam.GAIT_NUM === null) { rep.failed.push("the family is not there or has no legs"); return rep; }
    const total = fam.GAIT_COUNT[0], base = pool.base;
    if (!(x.spare >= base && x.spare < total && x.cpp_gait >= base && x.cpp_gait < total && x.spare !== x.cpp_gait)) { rep.failed.push("the gaits " + x.cpp_gait + " and " + x.spare + " must be two spare ones (" + base + " .. " + (total - 1) + ")"); return rep; }
    const check = function (what, ok, extra) { rep.total++; if (!ok) rep.failed.push(what + (extra ? ": " + extra : "")); };
    const row = function (name, g) { const v = fam[name], n = fam[name + "_N"]; return v.subarray(g * n, (g + 1) * n); };
    const same = function (name) {
      const a = row(name, x.cpp_gait), b = row(name, x.spare);
      for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return name + "[" + i + "]: the command wrote " + a[i] + ", the worker " + b[i];
      return "";
    };
    // the slot is wiped first (a write that does nothing would pass against a slot that was equal already)
    ["GAIT_NUM", "GAIT_PATH", "UP", "FEET"].forEach(function (name) { row(name, x.spare).fill(0); });
    fam.GAIT_NPATH[x.spare] = 0; fam.UP_MASK[x.spare] = 0; fam.UP_REF[x.spare] = 0; fam.FEET_MASK[x.spare] = 0;
    const plan = x.core.plan(x.h, x.style, Object.assign({}, x.o || {}, { gait: x.spare }));
    const id = pool.add(plan);
    pool.write(x.spare, id);
    ["GAIT_NUM", "GAIT_PATH", "GAIT_NPATH", "UP_MASK", "UP_REF", "UP", "FEET_MASK", "FEET"].forEach(function (name) { const d = same(name); check(x.style + ": " + name + " is the command's", d === "", d); });
    const nl = fam.NLEGS, ph = fam.GAIT_PH_N * x.spare;
    let dp = "";
    for (let k = 0; k < nl; k++) if (!Object.is(fam.LEG_PHASE[k], fam.GAIT_PH[ph + k])) dp = "leg " + k + ": the family has " + fam.LEG_PHASE[k] + " the slot " + fam.GAIT_PH[ph + k];
    check(x.style + ": the slot's order of the steps is the family's after the command", dp === "", dp);
    check(x.style + ": the slot says it has an order of its own", fam.GAIT_PH_ON[x.spare] === 1 && fam.PH_ANY[0] === 1);
    let up = 0, feet = 0;
    for (let g = 0; g < total; g++) { if (fam.UP_MASK[g] !== 0) up = 1; if (fam.FEET_MASK[g] !== 0) feet = 1; }
    check(x.style + ": the family's flags are what the masks say (upper " + up + ", feet " + feet + ")", fam.HAS_UPPER[0] === up && fam.HAS_FEET[0] === feet);
    check(x.style + ": a style that is in no slot is found in none", pool.slot(id) === -1);
    const at = pool.load(id);
    check(x.style + ": load puts it in a spare slot (" + at + ") and finds it there", at >= base && at < total && pool.slot(id) === at && pool.load(id) === at);
    if (at >= 0) { const d = (function () { const a = row("GAIT_NUM", at), b = row("GAIT_NUM", x.cpp_gait); for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return "GAIT_NUM[" + i + "]"; return ""; })(); check(x.style + ": and what load wrote is the command's too", d === "", d); }
    return rep;
  }

  // TWO INSTANCES THAT WERE GIVEN THE SAME ACTION, one by the page's runtime (commands) and one by the worker's (direct writes): what each has been told, read from the columns, is the same within what the page does not say again
  // (a bone that moved less than 2e-4, a foot less than 1.5e-3): the layer on every role bone, the hands, the feet, the knees, the body's drive, the wings.   compare_actions({ fam, a, b, K, pose_tol }) -> { total, failed }   (pose_tol: a look at a target is aimed from the head as it is, which sways a little differently on each instance: a bigger one)
  function compare_actions(x) {
    const fam = x.fam, K = x.K, a = x.a, b = x.b, rep = { total: 0, failed: [] };
    const ok = function (what, p, q, tol) { rep.total++; if (!(Math.abs(p - q) <= tol)) { if (rep.failed.length < 12) rep.failed.push(what + ": " + p + " vs " + q); } };
    if (fam.LIFE_POKE) for (let k = 0; k < fam.NOV; k++) for (let m = 0; m < 6; m++) ok("bone slot " + k + "[" + m + "]", fam.LIFE_POKE[(a * fam.NOV + k) * 6 + m], fam.LIFE_POKE[(b * fam.NOV + k) * 6 + m], x.pose_tol || 1.5e-3);
    for (let j = 0; fam.ARM_ST && j < fam.NARMS; j++) {
      const A = (a * fam.NARMS + j) * fam.ARM_NS, B = (b * fam.NARMS + j) * fam.ARM_NS;
      ok("arm " + j + " weight", fam.ARM_ST[A + K.AS_PWS], fam.ARM_ST[B + K.AS_PWS], 9e-3);
      if (fam.ARM_ST[A + K.AS_PWS] > 0.01) [K.AS_PUX, K.AS_PUY, K.AS_PUZ, K.AS_PPA, K.AS_PPW, K.AS_PFL].forEach(function (i) { ok("arm " + j + " word " + i, fam.ARM_ST[A + i], fam.ARM_ST[B + i], 3e-3); });
      ok("arm " + j + " world reach weight", fam.ARM_ST[A + K.AS_WWS], fam.ARM_ST[B + K.AS_WWS], 9e-3);
      if (fam.ARM_ST[A + K.AS_WWS] > 0.01) [K.AS_WX, K.AS_WY, K.AS_WZ, K.AS_WPA, K.AS_WPW, K.AS_WFL].forEach(function (i) { ok("arm " + j + " world word " + i, fam.ARM_ST[A + i], fam.ARM_ST[B + i], 3e-3); });
    }
    for (let k = 0; fam.OVR_COV && k < fam.NLEGS; k++) {
      const ia = a * fam.NLEGS + k, ib = b * fam.NLEGS + k;
      ok("foot " + k + " coverage", fam.OVR_COV[ia], fam.OVR_COV[ib], 9e-3);
      if (fam.OVR_COV[ia] > 0.01) for (let m = 0; m < 3; m++) ok("foot " + k + " [" + m + "]", fam.OVR[ia * 3 + m], fam.OVR[ib * 3 + m], 4e-3);
      ok("knee " + k + " coverage", fam.KN_COV[ia], fam.KN_COV[ib], 9e-3);
      if (fam.KN_COV[ia] > 0.01) ok("knee " + k + " angle", fam.KN[ia], fam.KN[ib], 3e-3);
    }
    if (fam.DRIVE) { ok("drive on", fam.DRIVE[a * 3], fam.DRIVE[b * 3], 0); ok("drive vx", fam.DRIVE[a * 3 + 1], fam.DRIVE[b * 3 + 1], 1e-3); ok("drive vz", fam.DRIVE[a * 3 + 2], fam.DRIVE[b * 3 + 2], 1e-3); }
    if (fam.WING_MANUAL) { ok("wings by hand", fam.WING_MANUAL[a], fam.WING_MANUAL[b], 0); if (fam.WING_MANUAL[a]) { ok("wings fold", fam.WING_FOLD[a], fam.WING_FOLD[b], 3e-3); ok("wings hz", fam.WING_HZ[a], fam.WING_HZ[b], 3e-3); ok("wings amp", fam.WING_AMP[a], fam.WING_AMP[b], 3e-3); } }
    return rep;
  }

  return { run: run, slots: slots, compare_actions: compare_actions };
});

// ========================================================================================================================
// worker_sworld
// ========================================================================================================================
packing()("happy_worker_sworld", function happy_worker_sworld() {
  "use strict";
  // HAPPY WORKER SWORLD: what a creature's worker knows of the WORLD it is hosted in (SYSTEM.md), as `api.sw`: the navigation map, the zones, the furniture's SLOTS and who claims them, the state of the props that world blocks move
  // (a door's openness, a lamp's light), the scenes that are awake, and a queue of REQUESTS to the page's world host (an effect, a prop thrown into the world, an impulse, "open this door", "I am dying"). Generic like the other worker
  // services: it knows no creature family and no prop: a creature asks for "a free slot that affords `sit`" and the world answers; it never asks for "a chair".
  //   const S = create({ Nav: <world/world_nav.js>, board: <board.js>, post(name, data), rand() -> 0 .. 1 })
  //   S.install(spec)      the world's spec (world/world_spec.js): bakes the nav lazily, the slots, the zones, the entities' state table      S.apply(diff)      the page's changes: { gates: [[gate, state]], ent: [[entity, key, value]], scenes: [[scene, 0 active | 1 dormant | 2 unloaded]] }
  //   S.bind({ profile, handle(me) -> the instance's handle }) -> the object `api.sw` of a family (below)      S.flush()      once a frame: the requests go to the page      S.release_all(handle)      a creature that is gone gives its claims back
  // `api.sw` (every read allocates nothing; `out` is an object or a typed array the caller owns):
  //   sw.profile                       the agent profile of the family (its radius, step ... decide where it may stand: world_nav.js)
  //   sw.nearest(x, y, z, max_d, out)  -> a node | -1, out { x, y, z }            sw.path(me, x, y, z, opts, out) -> points | -1 (5 floats a point: x, y, z, link, flags), opts { keys, partial, smooth, snap, max_nodes }, keys: sw.keys(me)
  //   sw.reachable(me, x, y, z)        sw.reachable_with(me, x, y, z, keys) (as if it held these keys: a bit mask, bit k - 1 for key k)      sw.key_count() the keys the world has      sw.random_in_zone(zone, out) -> bool          sw.zone_id(name)      sw.zones_at(x, y, z, out) -> count      sw.in_zone(zone, x, y, z)
  //   sw.find_slot(me, kind, max_d [, o]) -> a slot | -1      the NEAREST free slot of that affordance, in a scene that is loaded (o: { reach: the nav says a path exists, tag, mine: keeps one it holds, awake: only furniture of scenes that are awake })      sw.slot_count(kind)
  //   sw.slot_kind_name(slot) -> "sit" ...      sw.claim(me, slot) -> bool       sw.release(me, slot)       sw.claimed_by(slot) -> a handle | -1       sw.slot_pos(slot, out) -> out { x, y, z, yaw, sx, sy, sz (where a body stands to use it), r, entity, kind }
  //   AN ANCHORED SEAT (a seat of an sdf piece, world/world_items.js): sw.slot_seat(slot) -> true (a body sits ON it: its hips fixed to the anchor, its gait off)      sw.slot_face(slot) -> the way a body faces to back into it      sw.sit(me, slot, seconds)      sw.stand(me, slot, seconds)      (requests to the page: sp.sit / sp.stand)
  //   sw.entity(name) -> id | -1       sw.state_key(name) -> id        sw.state(entity, key) -> number        sw.entity_slots(entity, out) -> count (the slots of a piece of furniture)
  //   sw.interact(me, entity, verb, a) the world's block of that entity answers (open, close, switch, unlock, store, take ...): the effect shows in sw.state a moment later
  //   sw.effect(name, x, y, z, vx, vy, vz, n)   particles the host names (dust, spark, blood, smoke ...)      sw.spawn_prop(type, x, y, z, vx, vy, vz)      sw.impulse(entity, ix, iy, iz)      sw.life(me, state)   0 pending 1 spawning 2 alive 3 dying 4 dead 5 despawning
  //   sw.entity_type(entity) -> "door" | "chair" ...      sw.door_near(x, y, z, r) -> the door entity of a doorway near a point | -1
  //   SENSING (things by what they are): sw.find(me, q, out) -> how many, nearest first, ids in `out` (q: { type, affords, tag, max_d, zone, awake, state: {k: v}, not_state: {k: v}, has_state, skip }; sw.found_d2: how far the first is)
  //   sw.nearest_entity(me, q) -> id | -1      sw.entity_name(e)  sw.entity_pos(e, out) -> out { x, y, z, yaw }  sw.entity_affords(e, verb)  sw.entity_tagged(e, tag)  sw.state_of(e, "open") (a state by name)  sw.has_state(e, "holder")  sw.entity_zone(e) -> a zone | -1  sw.entity_count()
  //   sw.bounds(out) -> out [x0, z0, x1, z1] the world's extent      sw.zone_rect(zone, out) -> true, out [x0, z0, x1, z1] the rectangle of a zone
  //   sw.scene_of(entity) -> a scene id | -1      sw.scene_state(scene)      sw.now      the world's clock
  // Node 14: no optional chaining, no ??.
  const REQ_STRIDE = 10, REQ_MAX = 256;
  const R_EFFECT = 1, R_PROP = 2, R_IMPULSE = 3, R_INTERACT = 4, R_STATE = 5, R_LIFE = 6, R_FACT = 7, R_SIT = 8, R_STAND = 9;
  const NSK_MAX = 64;
  function create(env) {
    const Nav = env.Nav, board = env.board;
    const S = { nav: null, spec: null, now: 0, stats: { requests: 0, dropped: 0, claims: 0, refused: 0 } };
    const NO_TAGS = [];
    let slots = null, ents = null, nsk = 0, state_ids = Object.create(null), ent_ids = Object.create(null), kind_ids = Object.create(null), by_kind = [], zone_ids = Object.create(null);
    let ent_state = new Float64Array(0), scene_state = new Uint8Array(0), ent_scene = new Int32Array(0), ent_slots = [], door_ents = [];
    const names = [], name_ids = Object.create(null);
    let names_sent = 0;
    const req = new Float64Array(REQ_STRIDE * REQ_MAX);
    let nreq = 0;
    const tmp = { x: 0, y: 0, z: 0 };

    const name_id = function (n) { let i = name_ids[n]; if (i === undefined) { i = names.length; names.push(n); name_ids[n] = i; } return i; };
    S.name_id = name_id;
    S.name_of = function (i) { return names[i]; };
    const kind_names = [];
    S.kind_id = function (kind) { let k = kind_ids[kind]; if (k === undefined) { k = by_kind.length; kind_ids[kind] = k; by_kind.push([]); kind_names.push(kind); } return k; };

    S.install = function (spec) {
      S.spec = spec;
      S.nav = Nav.create(spec);
      S.nav.default_agent = spec.nav && spec.nav.default_agent ? spec.nav.default_agent : "person";
      zone_ids = Object.create(null);
      (spec.zones || []).forEach(function (z) { zone_ids[z.name] = z.id; });
      if (board) board.zones((spec.zones || []).length);
      if (board) (spec.relations || []).forEach(function (r) { board.relate(board.faction_id(r[0]), board.faction_id(r[1]), r[2]); });          // (what the world file says the factions feel for each other: w.relate)
      const n = (spec.slots || []).length;
      slots = { n: n, kind: new Int16Array(n), ent: new Int32Array(n), x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), yaw: new Float32Array(n), sx: new Float32Array(n), sy: new Float32Array(n), sz: new Float32Array(n), r: new Float32Array(n), claim: new Int32Array(n).fill(-1), excl: new Uint8Array(n), scene: new Int32Array(n).fill(-1), seat: new Uint8Array(n) };
      kind_ids = Object.create(null); by_kind = []; kind_names.length = 0;
      const scene_ids = {};
      (spec.scenes || []).forEach(function (s) { scene_ids[s.name] = s.id; });
      ents = spec.entities || [];
      ent_ids = Object.create(null); ent_slots = [];
      ents.forEach(function (e) { ent_ids[e.name] = e.id; ent_slots[e.id] = e.slots.slice(); });
      door_ents = [];
      ents.forEach(function (e) { ["gate", "gate2"].forEach(function (k) { if (e.state && e.state[k] !== undefined && spec.doors[e.state[k]]) door_ents.push({ e: e.id, x: spec.doors[e.state[k]].pos[0], y: spec.doors[e.state[k]].pos[1], z: spec.doors[e.state[k]].pos[2] }); }); });          // (an entity may have two gates: a drawbridge has one at each end of its deck)
      (spec.slots || []).forEach(function (s, i) {
        slots.kind[i] = S.kind_id(s.kind); by_kind[slots.kind[i]].push(i); slots.ent[i] = s.owner;
        slots.x[i] = s.wpos[0]; slots.y[i] = s.wpos[1]; slots.z[i] = s.wpos[2]; slots.yaw[i] = s.wyaw;
        slots.sx[i] = s.stand[0]; slots.sy[i] = s.stand[1]; slots.sz[i] = s.stand[2]; slots.r[i] = s.radius; slots.excl[i] = s.exclusive ? 1 : 0; slots.seat[i] = s.seat && s.seat.anchor ? 1 : 0;
        const e = ents[s.owner];
        slots.scene[i] = e && e.scene !== null && scene_ids[e.scene] !== undefined ? scene_ids[e.scene] : -1;
      });
      state_ids = Object.create(null); nsk = 0;
      ents.forEach(function (e) { for (const k in e.state) if (state_ids[k] === undefined) { if (nsk >= NSK_MAX) throw new Error("happy_worker_sworld: at most " + NSK_MAX + " kinds of entity state"); state_ids[k] = nsk++; } });
      ent_state = new Float64Array(Math.max(1, ents.length) * Math.max(1, nsk));
      ent_scene = new Int32Array(Math.max(1, ents.length)).fill(-1);
      ents.forEach(function (e) {
        for (const k in e.state) { const v = e.state[k]; ent_state[e.id * nsk + state_ids[k]] = typeof v === "number" ? v : 0; }
        ent_scene[e.id] = e.scene !== null && scene_ids[e.scene] !== undefined ? scene_ids[e.scene] : -1;
      });
      scene_state = new Uint8Array(Math.max(1, (spec.scenes || []).length));
      (spec.scenes || []).forEach(function (s) { scene_state[s.id] = s.state === "dormant" ? 1 : (s.state === "unloaded" ? 2 : 0); });
      nreq = 0;
      return S;
    };
    S.apply = function (d) {
      if (!d) return;
      (d.gates || []).forEach(function (g) { if (S.nav) S.nav.set_gate(g[0], g[1]); });
      (d.ent || []).forEach(function (a) { if (a[0] >= 0 && a[0] < ents.length && a[1] >= 0 && a[1] < nsk) ent_state[a[0] * nsk + a[1]] = a[2]; });
      (d.scenes || []).forEach(function (a) { if (a[0] >= 0 && a[0] < scene_state.length) scene_state[a[0]] = a[1]; });
      (d.facts || []).forEach(function (f) { if (board) { const k = board.key(f[0]); if (f[2] >= 0) board.zset(f[2], k, f[1]); else board.set(k, f[1]); } });         // (the page's world blocks write facts of the blackboard: [name, value, zone | -1])
      if (d.now !== undefined) S.now = d.now;
    };
    S.release_all = function (h) {
      if (!slots) return;
      for (let i = 0; i < slots.n; i++) if (slots.claim[i] === h) slots.claim[i] = -1;
      if (board) { const r = board.rec(h); if (r >= 0) board.claim[r] = -1; }
    };

    // ---- requests to the page
    const push = function (type, a, b, c, d, e, f, g, h, i) {
      if (nreq >= REQ_MAX) { S.stats.dropped++; return false; }
      const o = nreq * REQ_STRIDE;
      req[o] = type; req[o + 1] = a; req[o + 2] = b; req[o + 3] = c; req[o + 4] = d; req[o + 5] = e; req[o + 6] = f; req[o + 7] = g; req[o + 8] = h; req[o + 9] = i;
      nreq++; S.stats.requests++;
      return true;
    };
    S.flush = function () {
      if (nreq === 0 && names_sent === names.length) return false;
      const data = { n: nreq, data: Array.prototype.slice.call(req, 0, nreq * REQ_STRIDE), names: names.slice(names_sent), names_at: names_sent };
      names_sent = names.length; nreq = 0;
      if (env.post) env.post("happy_world_requests", data);
      return true;
    };
    S.pending = function () { return nreq; };
    // a public fact of the blackboard changed (board.on_public): it goes to the page's world blocks, which read it as a fact by name
    S.fact = function (k, v, z) { return push(R_FACT, name_id(board.name(k)), v, z, 0, 0, 0, 0, 0, 0); };

    // ---- the object of a family
    S.bind = function (o) {
      o = o || {};
      const A = { profile: o.profile || "person" }, handle = o.handle || function () { return -1; };
      const need = function () { if (!S.nav) throw new Error("happy_worker_sworld: no world is installed (system.worker_world(spec)) and this creature asks it something"); return S.nav; };
      A.nearest = function (x, y, z, max_d, out) { return need().nearest(x, y, z, A.profile, max_d, out || null); };
      A.keys = function (me) { const r = board ? board.rec(handle(me)) : -1; return r >= 0 ? board.flags[r] & 255 : 0; };    // (the keys a creature holds: the low byte of its flags; bit k - 1 opens the doors of key k)
      A.path = function (me, x, y, z, opts, out) {
        const o2 = opts || {};
        if (o2.keys === undefined) { o2.keys = A.keys(me); }
        return need().path(A.profile, me.x, me.y, me.z, x, y, z, o2, out);
      };
      A.reachable = function (me, x, y, z) { return need().reachable(A.profile, me.x, me.y, me.z, x, y, z, A.keys(me)); };
      A.reachable_with = function (me, x, y, z, keys) { return need().reachable(A.profile, me.x, me.y, me.z, x, y, z, keys); };                // (as if it held these keys: bit k - 1 for key k: what a plan asks before it has picked the key up)
      A.key_count = function () { return S.spec && S.spec.keys ? S.spec.keys.length : 0; };
      A.random_in_zone = function (zone, out) { return need().random_in_zone(A.profile, zone, env.rand, out); };
      A.zone_id = function (name) { const z = zone_ids[name]; return z === undefined ? -1 : z; };
      A.zones_at = function (x, y, z, out) { return need().zones_at(x, y, z, out); };
      A.in_zone = function (zone, x, y, z) {
        const zi = typeof zone === "string" ? A.zone_id(zone) : zone;
        if (zi < 0) return false;
        const zn = S.spec.zones[zi], r = zn.rect;
        return x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3] && (!zn.y || (y >= zn.y[0] - 0.2 && y <= zn.y[1]));
      };
      A.slot_count = function (kind) { const k = kind_ids[kind]; return k === undefined ? 0 : by_kind[k].length; };
      A.find_slot = function (me, kind, max_d, opt) {
        const k = kind_ids[kind];
        if (k === undefined || !slots) return -1;
        const list = by_kind[k], h = handle(me), o2 = opt || {}, max2 = max_d > 0 ? max_d * max_d : 1e18;
        let best = -1, bd = 1e18;
        const cand = [];
        for (let q = 0; q < list.length; q++) {
          const i = list[q];
          if (slots.claim[i] >= 0 && slots.claim[i] !== h) continue;
          if (slots.claim[i] === h && o2.mine === false) continue;
          if (slots.scene[i] >= 0 && scene_state[slots.scene[i]] !== 0 && (scene_state[slots.scene[i]] === 2 || o2.awake)) continue;     // (the furniture of an UNLOADED scene is not offered; a DORMANT scene's is: it wakes when the creature comes near, o.awake: only the awake ones)
          if (o2.tag && S.spec.slots[i].tags.indexOf(o2.tag) < 0) continue;
          const dx = slots.x[i] - me.x, dz = slots.z[i] - me.z, dy = (slots.y[i] - me.y) * 2;
          let d = dx * dx + dz * dz + dy * dy;
          if (d > max2) continue;
          if (slots.claim[i] === h) { d = -1; }
          if (o2.reach) { cand.push(i, d); } else if (d < bd) { bd = d; best = i; }
        }
        if (!o2.reach) return best;
        const idx = [];
        for (let c = 0; c < cand.length; c += 2) idx.push(c);
        idx.sort(function (a, b) { return cand[a + 1] - cand[b + 1]; });
        for (let c = 0; c < idx.length && c < 4; c++) { const i = cand[idx[c]]; if (A.reachable(me, slots.sx[i], slots.sy[i], slots.sz[i])) return i; }
        return -1;
      };
      A.claim = function (me, slot) {
        const h = handle(me);
        if (!slots || slot < 0 || slot >= slots.n) return false;
        if (slots.claim[slot] === h) return true;
        if (slots.claim[slot] >= 0 && slots.excl[slot] === 1) { S.stats.refused++; return false; }
        slots.claim[slot] = h; S.stats.claims++;
        if (board) { const r = board.rec(h); if (r >= 0) board.claim[r] = slot; }
        return true;
      };
      A.release = function (me, slot) {
        const h = handle(me);
        if (slots && slot >= 0 && slot < slots.n && slots.claim[slot] === h) slots.claim[slot] = -1;
        if (board) { const r = board.rec(h); if (r >= 0 && board.claim[r] === slot) board.claim[r] = -1; }
      };
      A.slot_kind_name = function (slot) { return slots && slot >= 0 && slot < slots.n ? kind_names[slots.kind[slot]] : ""; };
      A.claimed_by = function (slot) { return slots && slot >= 0 && slot < slots.n ? slots.claim[slot] : -1; };
      A.slot_pos = function (slot, out) {
        out.x = slots.x[slot]; out.y = slots.y[slot]; out.z = slots.z[slot]; out.yaw = slots.yaw[slot]; out.sx = slots.sx[slot]; out.sy = slots.sy[slot]; out.sz = slots.sz[slot]; out.r = slots.r[slot]; out.entity = slots.ent[slot]; out.kind = slots.kind[slot]; out.seat = slots.seat[slot];
        return out;
      };
      // AN ANCHORED SEAT (an sdf piece's seat: world/world_items.js): sw.slot_seat(slot) -> true when a body sits ON it (its hips are fixed to the anchor, its gait off) and not only at its place; sw.slot_face(slot) -> the way
      // a body faces to back into it (away from the seat, toward its stand point); sw.sit(me, slot, seconds) asks the page to sit the creature down on it (it must stand at the slot's stand point: the walk block takes it there), over `seconds`
      // (0: at once); sw.stand(me, slot, seconds) gets it up and puts it at the stand point
      A.slot_seat = function (slot) { return !!slots && slot >= 0 && slot < slots.n && slots.seat[slot] === 1; };
      A.slot_face = function (slot) { return Math.atan2(slots.sx[slot] - slots.x[slot], slots.sz[slot] - slots.z[slot]); };
      A.sit = function (me, slot, seconds) { return push(R_SIT, handle(me), slot, seconds, 0, 0, 0, 0, 0, 0); };
      A.stand = function (me, slot, seconds) { return push(R_STAND, handle(me), slot, seconds, 0, 0, 0, 0, 0, 0); };
      A.entity = function (name) { const e = ent_ids[name]; return e === undefined ? -1 : e; };
      A.state_key = function (name) { const k = state_ids[name]; return k === undefined ? -1 : k; };
      A.state = function (e, k) { return e >= 0 && k >= 0 && e < ents.length ? ent_state[e * nsk + k] : 0; };
      A.entity_slots = function (e, out) { const l = ent_slots[e] || []; for (let i = 0; i < l.length && i < out.length; i++) out[i] = l[i]; return l.length; };
      A.entity_type = function (e) { return e >= 0 && e < ents.length ? ents[e].type : ""; };
      // THE ROLES the world names (`w.roles([...])`: the world's AI gives a creature one of them and a target, world/blocks/role.js): a role is its place in the list from 1, 0 is none. Asked once, when a block is made (a list search), never in a tick
      A.role_id = function (name) { const r = S.spec && S.spec.roles; return r ? r.indexOf(name) + 1 : 0; };
      A.role_name = function (id) { const r = S.spec && S.spec.roles; return r && id >= 1 && id <= r.length ? r[id - 1] : ""; };
      A.role_count = function () { const r = S.spec && S.spec.roles; return r ? r.length : 0; };
      // ---- SENSING: the world asked for THINGS by what they are, what they afford and what state they are in (a planner's questions: every unlocked door, the nearest loose crate, the key that nobody holds), not only for the nearest slot
      A.entity_name = function (e) { return e >= 0 && e < ents.length ? ents[e].name : ""; };
      // an entity that MOVES (an item that is taken and put down) keeps its place in its state, px py pz: the place the spec gave it is only where it began. While one is carried (`holder` above 0) the place is the one it was taken from: ask for
      // the ones nobody holds (state: { holder: 0 }) when the place matters
      const ent_at = function (i, out) {
        const p = ents[i].pos, kx = state_ids.px;
        if (kx !== undefined && ents[i].state.px !== undefined) { out.x = ent_state[i * nsk + kx]; out.y = ent_state[i * nsk + state_ids.py]; out.z = ent_state[i * nsk + state_ids.pz]; }
        else { out.x = p[0]; out.y = p[1]; out.z = p[2]; }
        return out;
      };
      A.entity_pos = function (e, out) { if (e < 0 || e >= ents.length) return false; ent_at(e, out); out.yaw = ents[e].yaw; return true; };
      A.entity_affords = function (e, verb) { return e >= 0 && e < ents.length && ents[e].affords.indexOf(verb) >= 0; };
      A.entity_tagged = function (e, tag) { return e >= 0 && e < ents.length && ents[e].tags.indexOf(tag) >= 0; };
      A.entity_tags = function (e) { return e >= 0 && e < ents.length ? ents[e].tags : NO_TAGS; };            // (the tags the world file gave it, read only: `needs:<kind>` says what using it takes)
      A.state_of = function (e, name) { const k = state_ids[name]; return k === undefined ? 0 : A.state(e, k); };            // (a state by its name: 0 when no entity has such a state)
      A.has_state = function (e, name) { return e >= 0 && e < ents.length && ents[e].state[name] !== undefined; };
      A.entity_count = function () { return ents.length; };
      A.entity_zone = function (e) {                                                                          // the first zone whose rectangle holds the entity (and its height), -1 none
        if (e < 0 || e >= ents.length) return -1;
        const p = ent_at(e, fpos), zs = S.spec.zones;
        for (let i = 0; i < zs.length; i++) { const r = zs[i].rect; if (p.x >= r[0] && p.x <= r[2] && p.z >= r[1] && p.z <= r[3] && (!zs[i].y || (p.y >= zs[i].y[0] - 0.2 && p.y <= zs[i].y[1]))) return i; }
        return -1;
      };
      // sw.find(me, q, out) -> how many (at most out.length), the NEAREST first, their ids in `out`; sw.found_d2 is the squared distance of the first. q (every key is a filter, all of them must hold):
      //   type "door" | ["door", "gate"]   affords "open" | ["open", "unlock"] (any of them)   tag "loose"   max_d metres (default: the whole world)   zone "garage" (the entity stands in it)   awake true (not of a scene that sleeps)
      //   state { locked: 1 } (every one of them equals)   not_state { open: 1 } (none of them equals)   has_state "holder" (the entity has such a state at all)   skip: an entity id to leave out
      A.found_d2 = 0;
      const fid = [], fd = [], fpos = { x: 0, y: 0, z: 0 };
      A.find = function (me, q, out) {
        q = q || {};
        const types = q.type === undefined ? null : (Array.isArray(q.type) ? q.type : [q.type]), affs = q.affords === undefined ? null : (Array.isArray(q.affords) ? q.affords : [q.affords]);
        const max2 = q.max_d > 0 ? q.max_d * q.max_d : 1e18, zi = q.zone === undefined ? -2 : (typeof q.zone === "string" ? A.zone_id(q.zone) : q.zone);
        let n = 0, i, k, ok;
        if (zi === -1) { A.found_d2 = 0; return 0; }
        fid.length = 0; fd.length = 0;
        for (i = 0; i < ents.length; i++) {
          const e = ents[i];
          if (i === q.skip) continue;
          if (types !== null && types.indexOf(e.type) < 0) continue;
          if (q.tag !== undefined && e.tags.indexOf(q.tag) < 0) continue;
          if (affs !== null) { ok = false; for (k = 0; k < affs.length; k++) if (e.affords.indexOf(affs[k]) >= 0) ok = true; if (!ok) continue; }
          if (q.has_state !== undefined && e.state[q.has_state] === undefined) continue;
          if (q.awake && ent_scene[i] >= 0 && scene_state[ent_scene[i]] !== 0) continue;
          if (ent_scene[i] >= 0 && scene_state[ent_scene[i]] === 2) continue;                                   // (the things of an unloaded scene are not offered)
          if (q.state) { ok = true; for (const key in q.state) if (A.state_of(i, key) !== q.state[key]) ok = false; if (!ok) continue; }
          if (q.not_state) { ok = true; for (const key in q.not_state) if (A.state_of(i, key) === q.not_state[key]) ok = false; if (!ok) continue; }
          ent_at(i, fpos);
          const dx = fpos.x - me.x, dz = fpos.z - me.z, dy = (fpos.y - me.y) * 2, d = dx * dx + dz * dz + dy * dy;
          if (d > max2) continue;
          if (zi >= 0 && A.entity_zone(i) !== zi) continue;
          fid.push(i); fd.push(d);
        }
        const idx = fid.map(function (_, j) { return j; }).sort(function (a, b) { return fd[a] - fd[b] || fid[a] - fid[b]; });
        for (k = 0; k < idx.length && n < out.length; k++) out[n++] = fid[idx[k]];
        A.found_d2 = n > 0 ? fd[idx[0]] : 0;
        return n;
      };
      A.nearest_entity = function (me, q) { const o = A.found_one || (A.found_one = new Int32Array(1)); return A.find(me, q, o) > 0 ? o[0] : -1; };
      A.door_near = function (x, y, z, r) {                                                                // the door entity whose doorway is within r of a point (a waypoint flagged as a gate), -1 when none
        let best = -1, bd = r * r;
        for (let i = 0; i < door_ents.length; i++) { const d = door_ents[i], dx = d.x - x, dz = d.z - z, dy = d.y - y; if (dy > 1 || dy < -1) continue; const q = dx * dx + dz * dz; if (q <= bd) { bd = q; best = d.e; } }
        return best;
      };
      A.bounds = function (out) { const b = S.spec.bounds || [-50, -50, 50, 50]; out[0] = b[0]; out[1] = b[1]; out[2] = b[2]; out[3] = b[3]; return out; };                  // (the world's extent: x0, z0, x1, z1: what a flier keeps inside)
      A.zone_rect = function (zone, out) { const zi = typeof zone === "string" ? A.zone_id(zone) : zone; if (zi < 0 || zi >= S.spec.zones.length) return false; const r = S.spec.zones[zi].rect; out[0] = r[0]; out[1] = r[1]; out[2] = r[2]; out[3] = r[3]; return true; };       // (the rectangle of a zone)
      A.scene_of = function (e) { return e >= 0 && e < ents.length ? ent_scene[e] : -1; };
      A.scene_state = function (s) { return s >= 0 && s < scene_state.length ? scene_state[s] : 0; };
      A.interact = function (me, e, verb, a) { return push(R_INTERACT, handle(me), e, name_id(verb), a || 0, 0, 0, 0, 0, 0); };
      A.effect = function (name, x, y, z, vx, vy, vz, n) { return push(R_EFFECT, name_id(name), x, y, z, vx || 0, vy || 0, vz || 0, n || 1, 0); };
      A.spawn_prop = function (type, x, y, z, vx, vy, vz) { return push(R_PROP, name_id(type), x, y, z, vx || 0, vy || 0, vz || 0, 0, 0); };
      A.impulse = function (e, ix, iy, iz) { return push(R_IMPULSE, e, ix, iy, iz, 0, 0, 0, 0, 0); };
      A.set_state = function (e, key, v) { return push(R_STATE, e, name_id(key), v, 0, 0, 0, 0, 0, 0); };
      A.life = function (me, st) { return push(R_LIFE, handle(me), st, 0, 0, 0, 0, 0, 0, 0); };
      Object.defineProperty(A, "now", { get: function () { return S.now; } });
      return A;
    };
    S.R = { EFFECT: R_EFFECT, PROP: R_PROP, IMPULSE: R_IMPULSE, INTERACT: R_INTERACT, STATE: R_STATE, LIFE: R_LIFE, FACT: R_FACT, SIT: R_SIT, STAND: R_STAND, STRIDE: REQ_STRIDE };
    S.entity_state_table = function () { return { state: ent_state, nsk: nsk, ids: state_ids }; };
    S.slot_table = function () { return slots; };
    return S;
  }
  return { create: create };
});

// ========================================================================================================================
// worker_world
// ========================================================================================================================
packing()("happy_worker_world", function happy_worker_world() {
  "use strict";
  // HAPPY WORKER WORLD: what a creature's worker can see of the OTHER species and do to them (SYSTEM.md, "The world"). Today a family sees only its own instances (api.nearest, api.near); the AI blocks that are for any creature
  // (fight, hunt, guard, predator and prey) need more: to see an instance of another family, to read what it does, to hurt it. This is that, a generic service of the worker: it knows no creature and no rule of any game; a block says what
  // a hit means (world/blocks/health.js is one). Written in ES5 (the worker's logic is, and the grid it uses); nothing is allocated by a query, a read or a hit.
  //
  //   const W = create(host)       host: the logic's side (pure.js hands it):
  //       families      the array of the families' records (the logic's contexts, the SAME array, changed in place): { js, name, group, fam (the columns), max, gx (a u8 column: 1 = left out of the world), grid (pure.js | null),
  //                     use_grid (set by prepare), hooks: { hit } }
  //       prepare(c)    makes the family ready for a query in this frame: its columns taken again when the memory has grown, its grid built once a frame; -> how many instances are alive and not left out (-1: its columns are not there)
  //       fresh(c)      the columns taken again when the memory has grown (once a frame); -> true when the family is there
  //       touch(c)      the family's instances changed (one was left out or let back): what prepare made is made again
  //       deliver(c, slot, damage, from)   calls the family's `hit` hook with `me` at that slot (the logic: the hook's mistakes are its own, `me` is put back)
  //
  // GROUPS: the species have a GROUP, a name made a whole number (`api.group("wolf")`: the default is the family's own name; several families may share one: "team_red", "prey"). A query asks for one group, or for every one (-1).
  //   W.group_id(name) -> id     W.group_name(id) -> name      W.sync()  the host says that a family came, went or changed its group
  // HANDLES: an instance of any family is ONE integer `h = js << 16 | slot` (js: the family's id, below 32768: the engine has 16384; slot: below 65536, the engine's most), -1 for none. A handle names a slot, not an animal: a slot
  //   that was released and spawned again is the new animal's (`gen(h)` tells which one it is). W.self(me) -> h of the instance `me` is.
  // QUERIES (from `me`; `me` itself never appears; the left out ones never appear; 3D distances, like api.nearest):
  //   W.nearest(me, group, maxd) -> h | -1       the nearest instance of the group within `maxd` metres (not a number above 0: any), the squared distance in W.d2 (Infinity when none)
  //   W.near(me, radius, out, group) -> count    fills `out` (an Int32Array, e.g. api.out, 64 entries) with the handles within the radius, in no order
  //   W.count(group) -> n                        how many are alive and not left out
  //   They use each family's grid (a family with 48 or more alive: built once a frame, when asked; the cell is that family's `api.grid_cell`: set it to about the distance the others ask about) and look at the other families
  //   whole; only the families of the group are visited, and a family with nothing alive costs a check.
  // READS (by handle; 0 / false / -1 / "" for a handle that is not there; they read the family's columns, nothing is allocated):
  //   W.x(h) W.y(h) W.z(h) W.vx(h) W.vz(h) W.speed(h) W.yaw(h) W.scale(h)      W.alive(h) (it is there, and not left out)      W.gen(h)      W.group_of(h) -> id      W.family_of(h) -> the family's name      W.dist2(me, h) (Infinity: not there)
  // LEAVING OUT: W.exclude(me, on): a dead or hidden instance asks to be left out of every query and every hit (its own family's api.nearest, api.near too); the logic clears it when the instance is released.
  // THE HIT: W.hit(h, damage, from) -> true when it was delivered: the victim's family has a `hit(me, damage, from)` hook, the instance is alive and not left out. The hook is called AT ONCE, with `me` at the victim (and put back at
  //   what it was: an attacker of the same family keeps its own `me`); `from`: the attacker's `me` or its handle or -1 (the hook gets a handle or -1). A hit inside a hit goes MAX_DEPTH deep and no more (a thorns creature that
  //   hits back a creature that hits back: the deeper hits are refused, W.deep counts them).
  var MAX_DEPTH = 4;
  var EMPTY = [];

  function create(host) {
    var fams = host.families, by_js = [], gm = [], names = [], ids = Object.create(null), depth = 0, rc = null;
    var W = { d2: Infinity, hits: 0, refused: 0, deep: 0, MAX_DEPTH: MAX_DEPTH };

    // ---- groups
    W.group_id = function (name) {
      var k = String(name), g = ids[k];
      if (g === undefined) { g = names.length; names.push(k); ids[k] = g; }
      return g;
    };
    W.group_name = function (g) { return g >= 0 && g < names.length ? names[g] : ""; };
    W.sync = function () {
      var i, c, m;
      by_js.length = 0; gm.length = 0;
      for (i = 0; i < fams.length; i++) {
        c = fams[i];
        while (by_js.length <= c.js) by_js.push(null);
        by_js[c.js] = c;
        if (c.group >= 0) {
          while (gm.length <= c.group) gm.push(null);
          m = gm[c.group];
          if (m === null) { m = []; gm[c.group] = m; }
          m.push(c);
        }
      }
    };

    // ---- handles
    W.self = function (me) { return (me.ctx.js << 16) | me.slot; };
    // the ROOT offset of the instance a handle names, or -1 (rc: its family)
    function find(h) {
      var c, s, f;
      if (!(h >= 0)) return -1;
      c = by_js[h >>> 16];
      if (c === undefined || c === null || !host.fresh(c)) return -1;
      s = h & 65535; f = c.fam;
      if (s >= f.max || s >= c.max || f.ALIVE[s] === 0) return -1;
      rc = c;
      return s * 8;
    }

    // ---- queries
    W.nearest = function (me, group, maxd) {
      var list = group >= 0 ? (gm[group] || EMPTY) : fams, px = me.x, py = me.y, pz = me.z, own = me.ctx, mine = me.slot;
      var bd = maxd > 0 ? maxd * maxd : Infinity, best = -1, i, c, f, skip, s, m, R, AL, GX, o, dx, dy, dz, d, G;
      for (i = 0; i < list.length; i++) {
        c = list[i];
        if (host.prepare(c) <= 0) continue;
        f = c.fam; skip = c === own ? mine : -1; s = -2;
        if (c.use_grid) {
          G = c.grid;
          s = G.nearest_at(f.ROOT, f.ALIVE, px, py, pz, skip, bd === Infinity ? Infinity : Math.sqrt(bd));
          if (s >= 0) { if (G.d2 < bd) { bd = G.d2; best = (c.js << 16) | s; } continue; }
          if (s === -1) continue;
        }
        R = f.ROOT; AL = f.ALIVE; GX = c.gx; m = f.max < c.max ? f.max : c.max;                       // (a family with few alive, or the grid could not tell: all of them)
        for (s = 0; s < m; s++) {
          if (AL[s] === 0 || GX[s] !== 0 || s === skip) continue;
          o = s * 8; dx = R[o] - px; dy = R[o + 1] - py; dz = R[o + 2] - pz; d = dx * dx + dy * dy + dz * dz;
          if (d < bd) { bd = d; best = (c.js << 16) | s; }
        }
      }
      W.d2 = best >= 0 ? bd : Infinity;
      return best;
    };
    W.near = function (me, radius, out, group) {
      var list = group >= 0 ? (gm[group] || EMPTY) : fams, px = me.x, py = me.y, pz = me.z, own = me.ctx, mine = me.slot, cap = out.length, r2 = radius * radius;
      var n = 0, i, c, f, skip, s, k, m, R, AL, GX, o, dx, dy, dz, tag;
      for (i = 0; i < list.length && n < cap; i++) {
        c = list[i];
        if (host.prepare(c) <= 0) continue;
        f = c.fam; skip = c === own ? mine : -1; tag = c.js << 16; k = -2;
        if (c.use_grid) k = c.grid.near_at(f.ROOT, f.ALIVE, px, py, pz, skip, radius, out, n, tag);
        if (k >= 0) { n = k; continue; }
        R = f.ROOT; AL = f.ALIVE; GX = c.gx; m = f.max < c.max ? f.max : c.max;
        for (s = 0; s < m && n < cap; s++) {
          if (AL[s] === 0 || GX[s] !== 0 || s === skip) continue;
          o = s * 8; dx = R[o] - px; dy = R[o + 1] - py; dz = R[o + 2] - pz;
          if (dx * dx + dy * dy + dz * dz <= r2) out[n++] = tag | s;
        }
      }
      return n;
    };
    W.count = function (group) {
      var list = group >= 0 ? (gm[group] || EMPTY) : fams, n = 0, i, k;
      for (i = 0; i < list.length; i++) { k = host.prepare(list[i]); if (k > 0) n += k; }
      return n;
    };

    // ---- reads
    W.x = function (h) { var o = find(h); return o < 0 ? 0 : rc.fam.ROOT[o]; };
    W.y = function (h) { var o = find(h); return o < 0 ? 0 : rc.fam.ROOT[o + 1]; };
    W.z = function (h) { var o = find(h); return o < 0 ? 0 : rc.fam.ROOT[o + 2]; };
    W.scale = function (h) { var o = find(h); return o < 0 ? 0 : rc.fam.ROOT[o + 3]; };
    W.vx = function (h) { var o = find(h), v; if (o < 0) return 0; v = rc.fam.VEL; return v === null ? 0 : v[o >> 2]; };
    W.vz = function (h) { var o = find(h), v; if (o < 0) return 0; v = rc.fam.VEL; return v === null ? 0 : v[(o >> 2) + 1]; };
    W.speed = function (h) {
      var o = find(h), v, a, b;
      if (o < 0) return 0;
      v = rc.fam.VEL;
      if (v === null) return 0;
      a = v[o >> 2]; b = v[(o >> 2) + 1];
      return Math.sqrt(a * a + b * b);
    };
    W.yaw = function (h) {
      var o = find(h), R;
      if (o < 0) return 0;
      R = rc.fam.ROOT;
      return Math.atan2(2 * (R[o + 4] * R[o + 6] + R[o + 7] * R[o + 5]), 1 - 2 * (R[o + 4] * R[o + 4] + R[o + 5] * R[o + 5]));       // (the same as `me.yaw`)
    };
    W.alive = function (h) { var o = find(h); return o >= 0 && rc.gx[o >> 3] === 0; };
    W.gen = function (h) { var o = find(h); return o < 0 ? 0 : rc.fam.GEN[o >> 3]; };
    W.group_of = function (h) { return find(h) < 0 ? -1 : rc.group; };
    W.family_of = function (h) { return find(h) < 0 ? "" : rc.name; };
    // the FOOTPRINT a family declared (api.footprint: the half width and the length of a long body, metres at scale 1, times the instance's own scale): -1 for a family that said none (a person's body is the asker's guess)
    W.radius = function (h) { var o = find(h); return o < 0 || !(rc.radius > 0) ? -1 : rc.radius * rc.fam.ROOT[o + 3]; };
    W.length = function (h) { var o = find(h); return o < 0 || !(rc.length > 0) ? 0 : rc.length * rc.fam.ROOT[o + 3]; };
    W.dist2 = function (me, h) {
      var o = find(h), R, dx, dy, dz;
      if (o < 0) return Infinity;
      R = rc.fam.ROOT; dx = R[o] - me.x; dy = R[o + 1] - me.y; dz = R[o + 2] - me.z;
      return dx * dx + dy * dy + dz * dz;
    };

    // ---- leaving out
    W.exclude = function (me, on) {
      var c = me.ctx, s = me.slot, v = on ? 1 : 0;
      if (c.gx[s] !== v) { c.gx[s] = v; host.touch(c); }
    };

    // ---- the hit
    W.hit = function (h, damage, from) {
      var c, s, f;
      if (!(h >= 0)) { W.refused++; return false; }
      c = by_js[h >>> 16];
      if (c === undefined || c === null || c.hooks === null || c.hooks.hit === null || !host.fresh(c)) { W.refused++; return false; }
      s = h & 65535; f = c.fam;
      if (s >= f.max || s >= c.max || f.ALIVE[s] === 0 || c.gx[s] !== 0) { W.refused++; return false; }
      if (depth >= MAX_DEPTH) { W.deep++; return false; }
      if (typeof from !== "number") from = from && from.ctx ? (from.ctx.js << 16) | from.slot : -1;
      depth++; W.hits++;
      try { host.deliver(c, s, damage, from); } finally { depth--; }
      return true;
    };
    return W;
  }

  return { create: create, MAX_DEPTH: MAX_DEPTH };
});
