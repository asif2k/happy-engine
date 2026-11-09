// THE BODY'S PARTS: roles, flight, wheels, aircraft, ragdoll, hit zones and the shapes of the physics proxy (the page's side of each).
// Ported 2026-11-05 from the first version of the creature system, renamed and merged by domain. From here this file is the source.
// Its parts are INCLUDED (the bundler's import directive) into the one closure that makes engine.system (system.js), so each sees every name of the parts before it.

      // ========================================================================================================================
      // roles
      // ========================================================================================================================
// system.js, a part: the role map and the traits, compiled into the LIFE section (the layout is documented in body.cpp).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- roles: which bone plays which part of a creature -------------------------------------------------------------------------------------------------
      //   roles: { hips?, spine?, chest?, neck?, head?, eyes?, lids?, jaw?, nose?, brows?, mouth?, ears?, tail?, appendages?, arms?, wave?, soft?, chains?, chain_colliders?, face_unit? }
      //   traits: { breath, breath_rate, idle, gait, stabilise, seed, arms, arm_swing, wave, blink, blink_close, eye_yaw, eye_pitch, wander, tail, ears, fidget, appendages, gaze_lead, gaze_comfort, head_yaw, head_pitch,
      //             neck_yaw, neck_pitch, spine_yaw, spine_pitch, gaze_speed, gaze_path, jaw_max, face }
      //   THE FACE AND THE REST (body.cpp; as many of each as the creature has: the only limit is the skeleton's 255 bones). A list role takes bones by name or number, or entries { bone, ... }; `mirror: "x"` on an entry
      //   whose bone ends in _l adds its _r twin with the same fields.
      //     eyes    [bone | { bone, yaw?, pitch?, mirror? }]: an eye LOOKS ALONG ITS BONE (the head of the bone is the middle of the eyeball, the tail is the pupil) and turns from there, about up and about the level axis across it;
      //             yaw / pitch: its limits in degrees (0 .. 90; none: the traits eye_yaw, eye_pitch)
      //     lids    [bone | { bone, dir?, mirror? }]: a lid turns about the level axis across its bone (or the model's x for a bone that stands up, the donor's way: the head at the middle of the eye, the tail up); dir 1 (an upper
      //             lid: a positive turn, down, closes it) or -1 (a lower lid)
      //     jaw     bone | { bone, max?, axis?, mirror? } | a list of them: a jaw bone opens DOWN about the level axis across it (the head at the hinge, the tail toward the chin), or about `axis` (model space; a mirror turns it
      //             over: two fangs that open apart); max: the angle in degrees it opens to (0 .. 90; none: the trait jaw_max)
      //     nose    one bone (a sniff, the snarl)        brows  [bone | { bone, side?, mirror? }] (raised, knit; the side is the bone's own unless said)
      //     mouth   { corners?, upper?, lower? }: bones (or lists): a corner goes out and up in a smile, the upper lip up in a snarl, the lower lip down with the jaw
      //     ears    [ear, ...]: an ear is a bone, a list of bones going down the tree, or { bones, mirror? }: springs that lag the turn and the speed, flicks, the face's ears (+ forward); an ear's pitch takes its TIP forward
      //             whichever way it hangs
      //     tail    a bone or a list going down the tree: a wave (more as it walks), a lag      appendages  [{ bones, kind?: "follow" | "wave", mirror? }]: antennae that spring after the body (and wave)
      //     face_unit  model units: how far a brow or a corner of the mouth moves is a share of it (0.2 of the head's length, else 0.05 of the size)
      //     hips    the bone that carries the body: by default the legs' body bone, else the first bone of the spine
      //     spine   a bone or a list of them (1 to 16), going down the tree: each below the one before     chest  the bone of the lungs: by default the top of the spine     neck  a bone or a list (1 to 6)     head  one bone
      //     arms    [{ chain, mirror?, side?, rest? }]: a chain of the RIG is an arm. Its last two bones are the arm proper (the upper arm, whose head is the shoulder joint, and the forearm; the chain's end is the wrist), the
      //             bone before them in the chain, when it reaches out to the side (a clavicle), is the shoulder (the breath lifts it). `rest`: where the hand hangs from the shoulder, in arm lengths ([out, up, forward]: x is OUT,
      //             away from the body on the side the arm is on, whichever side that is: [0.05, -0.93, 0.03] by default). The life poses the two bones of an arm (they have overlay slots of their own) and the page does not
      //             pose them by role_pose; a chain that the page asks for (sp.chain) is solved by the rig from the life's pose, so that a weight under 1 blends the page's reach with the hand that hangs or swings
      //     wave    { length?, angle?, speed?, follow? }: the spine UNDULATES as the body goes and FOLLOWS the track the head leaves (a snake; needs a spine of two bones or more): `length` the wave's length (model units: the spine's own length by
      //             default), `angle` how far the heading swings along the spine (degrees: 25), `speed` the speed at which the wave is whole (model units a second: 0.5), `follow` (true) the body goes along the track of the head
      //             and bends along its curves (false: it is straight behind the head). The wave runs from the head to the tail by one length for every length the body goes (nothing slips sideways) and fades out as it stops
      //   Every role is optional: what a creature has switches a behaviour on, what it has not is skipped (a warning at most); only a contradiction (an unknown bone, a bone with two roles, a chain that does not go down
      //   the tree, an arm that is a leg's) is an error, and every complaint is listed. A bone may be the hips, a bone of the spine and the chest at once (a body of one bone is all three), not more than that.
      //   A bone that a unit of the rig solves (any bone of a chain) TURNS under its role and does not MOVE: its head is rigid in its parent's frame (body.cpp); a move (x, y, z of role_pose, the breath's chest
      //   forward) is for the hips and for the bones that no chain has. A bone of a rig chain MAY have a role: the roles' overlay is part of the animation the rig starts from, so a spine that a hand pulls
      //   starts from it and the joints' limits hold whatever a layer says. Every role of system 2.0 is played (the face, the tail, the appendages, the soft tissue: body.cpp).
      //   The traits are numbers (what each is: body.cpp): the depth and the rate of the breath, the idle drift, the gait's coupling, how much of the body's lean the head takes back, the seed (a species' variety), the
      //   arms' default behaviour (1: on, 0: the arms are left alone) and the scale of their swing
      const SEC_LIFE = 5, LIFE_MAX_OV = MAX_BONES, LIFE_REC = 20, LIFE_NT = 40, LIFE_HEADER = 8, LIFE_ARM_REC = 10, MAX_ARMS = 4;
      const R_HIPS = 1, R_SPINE = 2, R_CHEST = 4, R_NECK = 8, R_HEAD = 16, R_SHOULDER = 32, R_UPPER = 64, R_FORE = 128, R_FLEX = R_HIPS | R_SPINE | R_CHEST;
      const R_EYE = 256, R_LID = 512, R_JAW = 1024, R_NOSE = 2048, R_BROW = 4096, R_MOUTH = 8192, R_EAR = 16384, R_TAIL = 32768, R_APP = 65536, R_APPW = 131072, R_SOFT = 262144, R_CHAIN = 524288;
      const ROLE_NAMES = [[R_HIPS, "hips"], [R_SPINE, "spine"], [R_CHEST, "chest"], [R_NECK, "neck"], [R_HEAD, "head"], [R_SHOULDER, "arms (a shoulder)"], [R_UPPER, "arms (the upper arm)"], [R_FORE, "arms (the forearm)"],
        [R_EYE, "eyes"], [R_LID, "lids"], [R_JAW, "jaw"], [R_NOSE, "nose"], [R_BROW, "brows"], [R_MOUTH, "mouth"], [R_EAR, "ears"], [R_TAIL, "tail"], [R_APP, "appendages"], [R_APPW, "appendages"], [R_SOFT, "soft tissue"], [R_CHAIN, "spring chains"]];
      const ROLE_KEYS = ["hips", "spine", "chest", "neck", "head", "eyes", "lids", "jaw", "nose", "brows", "mouth", "ears", "tail", "appendages", "arms", "wave", "soft", "chains", "chain_colliders", "face_unit"];
      const FUTURE_ROLES = [];                                                         // (the roles of system 2.0 that this system does not play yet: none now)
      // SOFT TISSUE (body.cpp, happy_life_soft): a bone that is soft is a MASS ON A SPRING that gravity and the body's motion move (a breast, a buttock, a belly, jowls). The bone says so itself (the skeleton's entry:
      // `soft: true | { stiffness | hz, damping, gain, limit, axis }`, any bone of any creature; a mirrored bone's twin is soft too) and `roles.soft` (a list of bones, or of { bone, ... }) says it as well, over what the bone says,
      // field by field. The numbers: stiffness (hz is the same number, system 2.0's name) the natural frequency of the mass on its spring at scale 1 (Hz: 3, a breast's bounce), damping its ratio (0.22: tissue is well damped), gain
      // how much of the mass's motion the bone takes (1), limit the most the bone moves (model units; 0.08 of the skeleton's size), axis the weight of the model's x (left), y (up), z (forward) ([0.6, 1, 0.85]: tissue moves up
      // and down and fore and aft more than sideways). A soft bone hangs from another bone, is no bone of a rig chain (a chain's bone only turns, the mass MOVES the bone) and has no other role. As many as the creature has
      const SOFT_DEFAULTS = { hz: 3, damping: 0.22, gain: 1, limit: 0.08, axis: [0.6, 1, 0.85] };
      const SOFT_RANGES = { stiffness: [0.2, 20], damping: [0.01, 1], gain: [0, 16], limit: [1e-6, 1e6] };
      const SOFT_FIELDS = "stiffness, damping, gain, limit, axis";
      const SOFT_PARAM = { stiffness: 0, damping: 1, gain: 2, limit: 3 };              // (the numbers a page can change while it runs: CMD_HAPPY_SOFT op 1, the axis is 4 .. 6)
      const LIFE_SOFT_REC = 10;
      // SPRING CHAINS (body.cpp, happy_life_chains): `roles.chains`, a list of { bones, hz, damping, gravity, inertia, limit, sway, falloff }: `bones` a list from the anchor down (each the child of the one before it, the first the
      // child of the anchor, none of them a bone of a rig chain or of another role); hz the natural frequency of a link at scale 1 (Hz: 4), damping its ratio (0.3), gravity the share of the swing that gravity makes (1), inertia the share
      // that the anchor's acceleration makes (1), limit the most a link turns (radians: 0.6), sway the idle sway at the tip (radians: 0.03), falloff how much of the swing the root holds back (0 .. 1: 0.3). A link's pitch takes its tip FORWARD
      const CHAIN_DEFAULTS = { hz: 4, damping: 0.3, gravity: 1, inertia: 1, limit: 0.6, sway: 0.03, falloff: 0.3 };
      const CHAIN_RANGES = { hz: [0.5, 20], damping: [0.05, 1], gravity: [0, 2], inertia: [0, 4], limit: [0.05, 1.5], sway: [0, 0.5], falloff: [0, 1] };
      const CHAIN_FIELDS = "hz, damping, gravity, inertia, limit, sway, falloff";
      const CHAIN_PARAM = { hz: 0, damping: 1, gravity: 2, inertia: 3, limit: 4, sway: 5, falloff: 6 };            // (the numbers a page can change while it runs: CMD_HAPPY_SCHAIN op 1)
      const LIFE_CHAIN_REC = 12, MAX_CHAINS = 64;
      // THE CHAINS' COLLIDERS (body.cpp, happy_sch_push): `roles.chain_colliders`, a list of { bone, a: [x, y, z], b: [x, y, z], r }: capsules a bone carries, the body and its clothes, that the tips of the chains' links are pushed out of;
      // a and b are the capsule's ends in the model's space at the BIND pose (b left out: a sphere at a), r its radius in metres (0.005 .. 2): the clearance for the hair's own thickness is part of it. The chains must be there
      const LIFE_COL_REC = 8, MAX_COLLIDERS = 16;
      // the traits in the order of the worker's HAPPY_T_* enum: [name, default, unit (the angles are given in degrees), lowest, highest]
      const TRAITS = [["breath", 1, 1, 0, 4], ["breath_rate", 0, 1, 0, 10], ["idle", 1, 1, 0, 4], ["gait", 1, 1, 0, 4], ["stabilise", 0.7, 1, 0, 1], ["seed", 0, 1, -1e6, 1e6], ["arms", 1, 1, 0, 1], ["arm_swing", 1, 1, 0, 3], ["wave", 1, 1, 0, 3],
        ["blink", 4.2, 1, 0, 60], ["blink_close", 80, DEG, 0, 120], ["eye_yaw", 35, DEG, 0, 80], ["eye_pitch", 25, DEG, 0, 60], ["wander", 1, 1, 0, 8], ["tail", 1, 1, 0, 4], ["ears", 1, 1, 0, 4], ["fidget", 1, 1, 0, 8], ["appendages", 1, 1, 0, 4],
        ["gaze_lead", 0.4, 1, 0, 1], ["gaze_comfort", 0.6, 1, 0.2, 1], ["head_yaw", 70, DEG, 0, 120], ["head_pitch", 40, DEG, 0, 80], ["neck_yaw", 30, DEG, 0, 90], ["neck_pitch", 20, DEG, 0, 60], ["spine_yaw", 40, DEG, 0, 90], ["spine_pitch", 20, DEG, 0, 60],
        ["gaze_speed", 1, 1, 0.2, 4], ["gaze_path", 1, 1, 0, 1], ["jaw_max", 30, DEG, 0, 90], ["face", 1, 1, 0, 3], ["soft", 1, 1, 0, 4], ["chains", 1, 1, 0, 4]];
      const TRAIT_INDEX = {};
      TRAITS.forEach(function (t, i) { TRAIT_INDEX[t[0]] = i; });
      function role_text(bits) { const out = []; ROLE_NAMES.forEach(function (r) { if ((bits & r[0]) && out.indexOf(r[1]) < 0) out.push(r[1]); }); return out.join(" + "); }
      function life_error(list) { const e = new Error(list.join("; ")); e.list = list; return e; }
      function descends(sk, a, b) { for (let p = sk.parent[b]; p >= 0; p = sk.parent[p]) if (p === a) return true; return false; }

      // -> null (no roles and no traits), or { words (null: no role bone: no section), nov, bones (the bone of every overlay slot), slot_of (bone name -> slot), roles ({ hips: slot, spine: [slots] ... }), arms, warnings, traits (the numbers as
      //    the worker has them), features }.   legs: compile_legs' result or null (its body bone is the default of hips, its chains are not arms)
      function compile_roles(sk, rig, legs, roles, traits) {
        const bone_soft = sk.soft ? sk.soft.some(function (v) { return v !== null && v !== undefined && v !== false; }) : false;          // (a bone that says it is soft gives the creature a life, roles or not)
        if (roles === undefined && traits === undefined && !bone_soft) return null;
        const bare = roles === undefined && traits === undefined;                      // (no roles and no traits at all: only bones that say they are soft; nothing to warn about. Traits alone are roles of the defaults)
        if (roles === undefined) roles = {};
        if (traits === undefined) traits = {};
        if (roles === null || typeof roles !== "object" || Array.isArray(roles)) throw life_error(["system: roles must be an object { hips, spine, chest, neck, head, eyes, lids, jaw, nose, brows, mouth, ears, tail, appendages, arms, wave }"]);
        if (traits === null || typeof traits !== "object" || Array.isArray(traits)) throw life_error(["system: traits must be an object of numbers (" + TRAITS.map(function (t) { return t[0]; }).join(", ") + ")"]);
        const errs = [], warn = [];
        for (const k in roles) {
          if (ROLE_KEYS.indexOf(k) >= 0) continue;
          if (FUTURE_ROLES.indexOf(k) >= 0) errs.push("system: roles: '" + k + "' is a role of system 2.0 that this system does not play yet (the roles it has: " + ROLE_KEYS.join(", ") + ")");
          else errs.push("system: roles: unknown role '" + k + "' (the roles: " + ROLE_KEYS.join(", ") + ")");
        }
        const tv = new Float32Array(LIFE_NT);
        TRAITS.forEach(function (t, i) {
          let v = traits[t[0]] === undefined ? t[1] : traits[t[0]];
          if (typeof v !== "number" || !Number.isFinite(v) || v < t[3] || v > t[4]) { errs.push("system: traits: " + t[0] + " = " + v + " is out of range (" + t[3] + " .. " + t[4] + ")"); v = t[1]; }
          tv[i] = v * t[2];
        });
        for (const k in traits) if (TRAIT_INDEX[k] === undefined) errs.push("system: traits: unknown trait '" + k + "' (the traits: " + TRAITS.map(function (t) { return t[0]; }).join(", ") + ")");
        const legs_chains = legs ? legs.legs.map(function (l) { return l.chain; }) : [];
        const recs = [], by_bone = new Map();
        const bone_idx = function (b, what) {
          const i = typeof b === "number" ? b : sk.index[b];
          if (i === undefined || !(i >= 0 && i < sk.n) || i !== (i | 0)) { errs.push("system: roles: " + what + ": unknown bone '" + b + "'"); return -1; }
          return i;
        };
        // a bone takes a role; a bone may be the hips, a spine bone and the chest at once (a creature whose body is one bone), and nothing else. `extra`: the record's limits (lim_y, lim_p, rad), aux, and the axis its pitch
        // turns about (ax: null the rule, "side" the level axis across the bone (down +), "fwd" the axis that takes its tip forward, or a vector)
        const add = function (i, bits, what, arm, pos, len, extra) {
          if (i < 0) return -1;
          let r = by_bone.get(i);
          if (r) {
            if ((r.bits & ~R_FLEX) !== 0 || (bits & ~R_FLEX) !== 0) { errs.push("system: roles: " + what + ": bone '" + sk.names[i] + "' already has the role " + role_text(r.bits)); return -1; }
            r.bits |= bits;
            if (bits & (R_SPINE | R_NECK)) { r.pos = pos; r.len = len; }
          } else {
            r = { bone: i, bits: bits, arm: arm, pos: pos, len: len, lim_y: 0, lim_p: 0, aux: 0, ax: null };
            if (extra) for (const k in extra) r[k] = extra[k];
            by_bone.set(i, r); recs.push(r);
          }
          return i;
        };
        const single = function (key, bit) {
          const v = roles[key];
          if (v === undefined || v === null) return -1;
          if (Array.isArray(v)) { errs.push("system: roles: " + key + " is one bone, not a list"); return -1; }
          return add(bone_idx(v, key), bit, key, 0, 0, 1);
        };
        // a chain goes down the tree: every bone below the one before (the bones in between, if any, are not driven). `arm`: the record's word 2 (an ear's or an appendage's number), `extra` as add's
        const chain_of = function (what, list, bit, max, arm, extra) {
          if (list === undefined || list === null) return [];
          const names = Array.isArray(list) ? list : [list], out = [];
          if (names.length > max) { errs.push("system: roles: " + what + " has " + names.length + " bones: at most " + max); return out; }
          names.forEach(function (b, j) {
            const i = bone_idx(b, what + "[" + j + "]");
            if (i < 0) return;
            if (out.length && !descends(sk, out[out.length - 1], i)) errs.push("system: roles: " + what + ": '" + sk.names[i] + "' is not below '" + sk.names[out[out.length - 1]] + "' (a chain goes down the tree)");
            out.push(i);
          });
          const kept = [];
          out.forEach(function (i, j) { if (add(i, bit, what + "[" + j + "]", arm || 0, j, out.length, extra) >= 0) kept.push(i); });
          return kept;
        };
        // the entries of a list role (eyes, lids, jaw, brows, the bones of the mouth): a bone, or { bone, mirror?, <fields> }; `mirror: "x"` adds the _r twin of an entry whose bone ends in _l (the same fields)
        const entries_of = function (key, list, fields) {
          const out = [];
          if (list === undefined || list === null) return out;
          (Array.isArray(list) ? list : [list]).forEach(function (e, j) {
            const tag = key + "[" + j + "]", o = e !== null && typeof e === "object" && !Array.isArray(e) ? e : { bone: e };
            for (const k in o) if (k !== "bone" && k !== "mirror" && fields.indexOf(k) < 0) errs.push("system: roles: " + tag + ": unknown field '" + k + "' (bone, mirror" + (fields.length ? ", " + fields.join(", ") : "") + ")");
            out.push({ o: o, tag: tag, mirrored: false });
            if (o.mirror !== undefined) {
              try { check_mirror(o.mirror, "roles: " + tag); const t = Object.assign({}, o, { bone: mirror_name(o.bone, "roles: " + tag) }); delete t.mirror; out.push({ o: t, tag: tag + " (its mirror)", mirrored: true }); } catch (err) { errs.push(err.message); }
            }
          });
          return out;
        };
        const hips_given = roles.hips !== undefined && roles.hips !== null;
        let hips = hips_given ? single("hips", R_HIPS) : -1;
        const spine = chain_of("spine", roles.spine, R_SPINE, 16);
        if (!hips_given && !bare) {                                                 // (the legs' body bone, else the first spine bone; a creature that has no roles at all, only bones that say they are soft, is given none)
          if (legs && legs.body >= 0) hips = add(legs.body, R_HIPS, "hips (the legs' body bone)", 0, 0, 1);
          else if (spine.length) hips = add(spine[0], R_HIPS, "hips (the first spine bone)", 0, 0, 1);
        }
        let chest = -1;
        if (roles.chest !== undefined && roles.chest !== null) chest = single("chest", R_CHEST);
        else if (spine.length) chest = add(spine[spine.length - 1], R_CHEST, "chest (the top of the spine)", 0, 0, 1);
        const neck = chain_of("neck", roles.neck, R_NECK, 6);
        const head = single("head", R_HEAD);

        // ---- the face and the rest of the body (body.cpp): as many of each as the creature has ----
        const deg_lim = function (v, tag, what) { const x = v === undefined ? 0 : v; if (typeof x !== "number" || !(x >= 0 && x <= 90)) { errs.push("system: roles: " + tag + ": " + what + " (degrees, 0 .. 90; 0: the trait's)"); return 0; } return x * DEG; };
        const side_of = function (v, i, tag) {
          if (v === undefined || v === null) return sk.head[i * 3] >= 0 ? 1 : -1;                    // (the side is the bone's own: left is +x)
          if (v === "left" || v === 1) return 1;
          if (v === "right" || v === -1) return -1;
          errs.push("system: roles: " + tag + ": side is 'left' or 'right'");
          return 1;
        };
        const eyes = [];
        entries_of("eyes", roles.eyes, ["yaw", "pitch"]).forEach(function (en) {
          const ly = deg_lim(en.o.yaw, en.tag, "yaw is how far the eye turns sideways"), lp = deg_lim(en.o.pitch, en.tag, "pitch is how far it turns up and down");
          const i = add(bone_idx(en.o.bone, en.tag), R_EYE, en.tag, 0, eyes.length, 1, { lim_y: ly, lim_p: lp, ax: "side" });
          if (i >= 0) eyes.push(i);
        });
        const lids = [];
        entries_of("lids", roles.lids, ["dir"]).forEach(function (en) {
          const d = en.o.dir === undefined ? 1 : en.o.dir;
          if (d !== 1 && d !== -1) errs.push("system: roles: " + en.tag + ": dir is 1 (an upper lid: it turns down to close) or -1 (a lower lid)");
          const i = add(bone_idx(en.o.bone, en.tag), R_LID, en.tag, 0, lids.length, 1, { aux: d === -1 ? -1 : 1, ax: "side" });
          if (i >= 0) lids.push(i);
        });
        const jaws = [];
        entries_of("jaw", roles.jaw, ["max", "axis"]).forEach(function (en) {
          const mx = deg_lim(en.o.max, en.tag, "max is the angle the jaw opens to");
          let ax = "side";
          if (en.o.axis !== undefined) {
            const a = en.o.axis;
            if (!Array.isArray(a) || a.length !== 3 || !a.every(Number.isFinite) || Math.hypot(a[0], a[1], a[2]) < 1e-3) errs.push("system: roles: " + en.tag + ": axis is [x, y, z] (model space): the jaw opens by a positive turn about it");
            else { const l = Math.hypot(a[0], a[1], a[2]); ax = en.mirrored ? [a[0] / l, -a[1] / l, -a[2] / l] : [a[0] / l, a[1] / l, a[2] / l]; }          // (a reflection across x turns an axis to (x, -y, -z): the twin opens the other way round)
          }
          const i = add(bone_idx(en.o.bone, en.tag), R_JAW, en.tag, 0, jaws.length, 1, { lim_p: mx, ax: ax });
          if (i >= 0) jaws.push(i);
        });
        const nose = single("nose", R_NOSE);
        const brows = [];
        entries_of("brows", roles.brows, ["side"]).forEach(function (en) {
          const bi = bone_idx(en.o.bone, en.tag);
          const i = add(bi, R_BROW, en.tag, 0, brows.length, 1, { aux: bi >= 0 ? side_of(en.o.side, bi, en.tag) : 1 });
          if (i >= 0) brows.push(i);
        });
        const mouth = [];
        if (roles.mouth !== undefined && roles.mouth !== null) {
          const m = roles.mouth;
          if (typeof m !== "object" || Array.isArray(m)) errs.push("system: roles: mouth is { corners, upper, lower }: bones, or lists of bones");
          else {
            for (const k in m) if (k !== "corners" && k !== "upper" && k !== "lower") errs.push("system: roles: mouth: unknown field '" + k + "' (corners, upper, lower)");
            [["corners", 0], ["upper", 1], ["lower", 2]].forEach(function (kind) {
              entries_of("mouth." + kind[0], m[kind[0]], []).forEach(function (en) {
                const bi = bone_idx(en.o.bone, en.tag);
                const i = add(bi, R_MOUTH, en.tag, kind[1], mouth.length, 1, { aux: bi >= 0 ? side_of(undefined, bi, en.tag) : 1, ax: kind[1] === 2 ? "side" : null });
                if (i >= 0) mouth.push(i);
              });
            });
          }
        }
        // the chains: an ear (a bone, a list of bones going down the tree, or { bones, mirror }), an appendage ({ bones, kind, mirror }); their records say which one they are (word 2), their place and its length
        const chain_entries = function (key, list, fields, form) {
          const out = [];
          if (list === undefined || list === null) return out;
          if (!Array.isArray(list)) { errs.push("system: roles: " + key + " is a list of " + form); return out; }
          list.forEach(function (e, j) {
            const tag = key + "[" + j + "]";
            if (e !== null && typeof e === "object" && !Array.isArray(e)) {
              for (const k in e) if (k !== "bones" && k !== "mirror" && fields.indexOf(k) < 0) errs.push("system: roles: " + tag + ": unknown field '" + k + "' (bones, mirror" + (fields.length ? ", " + fields.join(", ") : "") + ")");
              const bl = Array.isArray(e.bones) ? e.bones : (e.bones === undefined || e.bones === null ? [] : [e.bones]);
              if (!bl.length) { errs.push("system: roles: " + tag + ": bones is a bone or a list of bones (going down the tree)"); return; }
              out.push({ bones: bl, o: e, tag: tag });
              if (e.mirror !== undefined) {
                try { check_mirror(e.mirror, "roles: " + tag); out.push({ bones: bl.map(function (b) { return mirror_name(b, "roles: " + tag); }), o: e, tag: tag + " (its mirror)" }); } catch (err) { errs.push(err.message); }
              }
            } else if (fields.indexOf("kind") >= 0) errs.push("system: roles: " + tag + " must be { bones, kind, mirror }");
            else out.push({ bones: Array.isArray(e) ? e : [e], o: {}, tag: tag });
          });
          return out;
        };
        const ears = [];
        chain_entries("ears", roles.ears, [], "ears: an ear is a bone, a list of bones going down the tree, or { bones, mirror }").forEach(function (en) { ears.push(chain_of(en.tag, en.bones, R_EAR, MAX_BONES, ears.length, { ax: "fwd" })); });
        const tail = chain_of("tail", roles.tail, R_TAIL, MAX_BONES);
        const apps = [];
        chain_entries("appendages", roles.appendages, ["kind"], "{ bones, kind, mirror }").forEach(function (en) {
          const kind = en.o.kind === undefined ? "follow" : en.o.kind;
          if (kind !== "follow" && kind !== "wave") { errs.push("system: roles: " + en.tag + ": kind is 'follow' or 'wave'"); return; }
          apps.push(chain_of(en.tag, en.bones, kind === "wave" ? R_APPW : R_APP, MAX_BONES, apps.length, { ax: "fwd" }));
        });
        let face_unit = 0;
        if (roles.face_unit !== undefined) { if (typeof roles.face_unit !== "number" || !(roles.face_unit > 0 && roles.face_unit < 1e4)) errs.push("system: roles: face_unit is a number over 0 (model units: how far a brow or a corner of the mouth moves is a share of it)"); else face_unit = roles.face_unit; }

        // the arms: [{ chain, side, rest }] -> the records of the worker; the arm proper is the last two bones of the chain
        const arms = [];
        if (roles.arms !== undefined && roles.arms !== null) {
          if (!Array.isArray(roles.arms)) errs.push("system: roles: arms is a list of { chain, mirror, side, rest }");
          else if (!rig || !rig.chains || !rig.chains.length) errs.push("system: roles: arms are chains of the rig (the definition has no rig.chains)");
          else {
            const entries = [];
            roles.arms.forEach(function (a, j) {
              if (a === null || typeof a !== "object" || Array.isArray(a)) { errs.push("system: roles: arms[" + j + "] must be { chain, mirror, side, rest }"); return; }
              for (const k in a) if (["chain", "mirror", "side", "rest"].indexOf(k) < 0) errs.push("system: roles: arms[" + j + "]: unknown field '" + k + "' (chain, mirror, side, rest)");
              entries.push(a);
              if (a.mirror !== undefined) {                                                                  // (the twin: the same place, out is out on its own side)
                try { check_mirror(a.mirror, "roles: arms[" + j + "]"); const t = Object.assign({}, a, { chain: mirror_name(a.chain, "roles: arms[" + j + "]") }); delete t.mirror; if (t.side === "left") t.side = "right"; else if (t.side === "right") t.side = "left"; entries.push(t); } catch (e) { errs.push(e.message); }
              }
            });
            if (entries.length > MAX_ARMS) errs.push("system: roles: at most " + MAX_ARMS + " arms (" + entries.length + ")");
            const names = rig.chains.map(function (c) { return c.name; });
            entries.slice(0, MAX_ARMS).forEach(function (a, j) {
              const tag = "system: roles: arms[" + j + "]: ";
              const ci = typeof a.chain === "number" ? a.chain : names.indexOf(a.chain);
              if (!(ci >= 0 && ci < names.length) || ci !== (ci | 0)) { errs.push(tag + "no chain of the rig has the name '" + a.chain + "' (" + names.join(", ") + ")"); return; }
              if (legs_chains.indexOf(ci) >= 0) { errs.push(tag + "the chain '" + names[ci] + "' is a leg's"); return; }
              if (arms.some(function (o) { return o.chain === ci; })) { errs.push(tag + "the chain '" + names[ci] + "' is another arm's"); return; }
              const cb = rig.chains[ci].bones;
              if (cb.length < 2) { errs.push(tag + "the chain '" + names[ci] + "' has " + cb.length + " bone: an arm is two bones at least (the upper arm and the forearm)"); return; }
              const upper = cb[cb.length - 2], fore = cb[cb.length - 1], length = sk.length[upper] + sk.length[fore];
              const sx = sk.head[upper * 3];
              let side = sx >= 0 ? 1 : -1;
              if (a.side !== undefined) { if (a.side === "left") side = 1; else if (a.side === "right") side = -1; else errs.push(tag + "side is 'left' or 'right'"); }
              let rest = a.rest === undefined ? [0.05, -0.93, 0.03] : a.rest;
              if (!Array.isArray(rest) || rest.length !== 3 || !rest.every(Number.isFinite) || Math.hypot(rest[0], rest[1], rest[2]) > 1.5) { errs.push(tag + "rest is [out, up, forward] in arm lengths from the shoulder (x OUT, away from the body on the side of the arm; at most 1.5 long)"); rest = [0.05, -0.93, 0.03]; }
              // the bone before the arm proper, when it reaches out to the side of the body (a clavicle): the shoulder
              let clav = -1;
              if (cb.length >= 3) { const c0 = cb[cb.length - 3]; if (side * (sx - sk.head[c0 * 3]) > 0.05 * length) clav = c0; }
              // the torso: the nearest bone above the shoulder that has the role of the chest (else the bone the arm hangs from)
              let torso = -1;
              for (let p = sk.parent[upper]; p >= 0; p = sk.parent[p]) { const r = by_bone.get(p); if (r && (r.bits & R_CHEST)) { torso = p; break; } }
              if (torso < 0) torso = sk.parent[upper];
              arms.push({ chain: ci, name: names[ci], side: side, length: length, rest: [side * rest[0] * length, rest[1] * length, rest[2] * length], rest_u: rest.slice(), shoulder: upper, wrist: fore, torso: torso, clav: clav });
            });
            arms.forEach(function (a, j) {                                                               // (the clavicle, the upper arm and the forearm have overlay slots: the life poses them)
              if (a.clav >= 0) add(a.clav, R_SHOULDER, "arms[" + j + "].shoulder", j, 0, 1);
              add(a.shoulder, R_UPPER, "arms[" + j + "].upper arm", j, 0, 1);
              add(a.wrist, R_FORE, "arms[" + j + "].forearm", j, 0, 1);
            });
          }
        }
        // the wave: the spine undulates as the body goes and follows the track the head leaves
        let wave = null;
        if (roles.wave !== undefined && roles.wave !== null && roles.wave !== false) {
          const w = roles.wave === true ? {} : roles.wave;
          if (typeof w !== "object" || Array.isArray(w)) errs.push("system: roles: wave is { length, angle, speed, follow } (or true)");
          else {
            for (const k in w) if (["length", "angle", "speed", "follow"].indexOf(k) < 0) errs.push("system: roles: wave: unknown field '" + k + "' (length, angle, speed, follow)");
            let total = 0;
            spine.forEach(function (i) { total += sk.length[i]; });
            const length = w.length === undefined ? total : w.length, angle = w.angle === undefined ? 25 : w.angle, speed = w.speed === undefined ? 0.5 : w.speed, follow = w.follow === undefined ? true : w.follow;
            if (spine.length < 2) errs.push("system: roles: wave: the wave runs along a spine of two bones at least (roles.spine)");
            if (typeof length !== "number" || !(length > 1e-3 && length < 1e4)) errs.push("system: roles: wave: length = " + length + " is out of range (model units, over 0.001)");
            if (typeof angle !== "number" || !(angle >= 0 && angle <= 85)) errs.push("system: roles: wave: angle = " + angle + " is out of range (degrees, 0 .. 85)");
            if (typeof speed !== "number" || !(speed > 1e-4 && speed < 1e5)) errs.push("system: roles: wave: speed = " + speed + " is out of range (model units a second, over 0.0001)");
            if (typeof follow !== "boolean") errs.push("system: roles: wave: follow is true or false");
            if (!errs.length) wave = { length: length, angle: angle, speed: speed, follow: follow };
          }
        }
        // ---- spring chains (body.cpp, happy_life_chains; `roles.chains`): hair, a ponytail, a cape's strips, a scarf: a chain is a list of bones from an ANCHOR down (each the child of the one before it, the first the child of the anchor:
        //      the head), and every link of it is a spring in angle space that gravity and the anchor's acceleration turn. Every bone after every other role (a bone that has one is refused, and why) ----
        const chains = [];
        if (roles.chains !== undefined && roles.chains !== null) {
          if (!Array.isArray(roles.chains)) errs.push("system: roles: chains is a list of { bones, " + CHAIN_FIELDS + " }");
          else {
            if (roles.chains.length > MAX_CHAINS) errs.push("system: roles: at most " + MAX_CHAINS + " chains (" + roles.chains.length + ")");
            const rig_chain_of = function (bi) { if (!rig || !rig.chains) return null; for (let c = 0; c < rig.chains.length; c++) if (rig.chains[c].bones.indexOf(bi) >= 0 || rig.chains[c].tip === bi) return rig.chains[c].name; return null; };
            roles.chains.slice(0, MAX_CHAINS).forEach(function (e, j) {
              const tag = "system: roles: chains[" + j + "]: ";
              if (e === null || typeof e !== "object" || Array.isArray(e)) { errs.push(tag + "a chain is { bones, " + CHAIN_FIELDS + " }"); return; }
              let ok = true;
              for (const k in e) if (k !== "bones" && CHAIN_RANGES[k] === undefined) { errs.push(tag + "unknown field '" + k + "' (bones, " + CHAIN_FIELDS + ")"); ok = false; }
              const bl = Array.isArray(e.bones) ? e.bones : (e.bones === undefined || e.bones === null ? [] : [e.bones]);
              if (!bl.length) { errs.push(tag + "bones is a bone or a list of bones from the anchor down (each the child of the one before it)"); return; }
              const rec = Object.assign({}, CHAIN_DEFAULTS), idx = [];
              Object.keys(CHAIN_RANGES).forEach(function (key) {
                const v = e[key];
                if (v === undefined) return;
                const r = CHAIN_RANGES[key];
                if (typeof v !== "number" || !Number.isFinite(v) || v < r[0] || v > r[1]) { errs.push(tag + key + " = " + v + " is out of range (" + r[0] + " .. " + r[1] + ")"); ok = false; }
                else rec[key] = v;
              });
              bl.forEach(function (b, q) {
                const i = bone_idx(b, "chains[" + j + "].bones[" + q + "]");
                if (i < 0) { ok = false; return; }
                if (idx.indexOf(i) >= 0 || chains.some(function (c) { return c.bones.indexOf(i) >= 0; })) { errs.push(tag + "the bone '" + sk.names[i] + "' is in a chain twice (a bone is in one chain, once)"); ok = false; return; }
                if (q === 0 && sk.parent[i] < 0) { errs.push(tag + "'" + sk.names[i] + "' has no parent bone: a chain hangs from an anchor"); ok = false; return; }
                if (q > 0 && sk.parent[i] !== idx[q - 1]) { errs.push(tag + "'" + sk.names[i] + "' is not a child of '" + sk.names[idx[q - 1]] + "' (each bone of a chain is the child of the one before it)"); ok = false; return; }
                const rc = rig_chain_of(i);
                if (rc !== null) { errs.push(tag + "'" + sk.names[i] + "' is a bone of the rig's chain '" + rc + "' (the rig holds its head: a spring chain is bones of its own that hang from the anchor)"); ok = false; return; }
                idx.push(i);
              });
              if (!ok || idx.length !== bl.length) return;
              rec.bones = idx.slice();
              const id = chains.length;
              idx.forEach(function (i, q) { add(i, R_CHAIN, "chains[" + j + "].bones[" + q + "]", id, q, idx.length, { ax: "fwd" }); });
              chains.push(rec);
            });
          }
        }
        // ---- the chains' colliders (body.cpp, happy_sch_push; `roles.chain_colliders`) ----
        const colliders = [];
        if (roles.chain_colliders !== undefined && roles.chain_colliders !== null) {
          if (!Array.isArray(roles.chain_colliders)) errs.push("system: roles: chain_colliders is a list of { bone, a: [x, y, z], b: [x, y, z], r }");
          else if (!chains.length) { if (roles.chain_colliders.length) errs.push("system: roles: chain_colliders push the links of the chains: the definition has no chains (roles.chains)"); }
          else {
            if (roles.chain_colliders.length > MAX_COLLIDERS) errs.push("system: roles: at most " + MAX_COLLIDERS + " chain colliders (" + roles.chain_colliders.length + ")");
            roles.chain_colliders.slice(0, MAX_COLLIDERS).forEach(function (e, j) {
              const tag = "system: roles: chain_colliders[" + j + "]: ";
              if (e === null || typeof e !== "object" || Array.isArray(e)) { errs.push(tag + "a collider is { bone, a: [x, y, z], b: [x, y, z], r }"); return; }
              let ok = true;
              for (const k in e) if (k !== "bone" && k !== "a" && k !== "b" && k !== "r") { errs.push(tag + "unknown field '" + k + "' (bone, a, b, r)"); ok = false; }
              const pt = function (v, n) { if (!Array.isArray(v) || v.length !== 3 || !v.every(function (x) { return typeof x === "number" && Number.isFinite(x); })) { errs.push(tag + n + " is [x, y, z] (three numbers)"); ok = false; return null; } return v.slice(); };
              const i = bone_idx(e.bone, "chain_colliders[" + j + "].bone"), a = pt(e.a, "a"), b = e.b === undefined ? (a ? a.slice() : null) : pt(e.b, "b");
              if (typeof e.r !== "number" || !Number.isFinite(e.r) || e.r < 0.005 || e.r > 2) { errs.push(tag + "r = " + e.r + " is out of range (0.005 .. 2 metres)"); ok = false; }
              if (!ok || i < 0 || !a || !b) return;
              colliders.push({ bone: i, a: a, b: b, r: e.r });
            });
          }
        }
        // ---- soft tissue: the skeleton's own `soft` (in the bones' order), then roles.soft over it, field by field; every bone after every other role (a bone that has one is refused, and why) ----
        let size_box = [1e30, 1e30, 1e30, -1e30, -1e30, -1e30];
        for (let i = 0; i < sk.n; i++) for (let q = 0; q < 3; q++) { size_box[q] = Math.min(size_box[q], sk.head[i * 3 + q], sk.tail[i * 3 + q]); size_box[q + 3] = Math.max(size_box[q + 3], sk.head[i * 3 + q], sk.tail[i * 3 + q]); }
        const sk_size = Math.max(size_box[3] - size_box[0], size_box[4] - size_box[1], size_box[5] - size_box[2], 1e-3);
        const soft = [];
        {
          const given = [], at = new Map();                                                       // [{ bone, raw, from }]: the skeleton's bones in their order, then the bones that only roles.soft names
          const take = function (bi, raw, from) {
            if (at.has(bi)) { const g = at.get(bi); g.raw = Object.assign({}, g.raw, raw); g.from += " and " + from; }
            else { const g = { bone: bi, raw: Object.assign({}, raw), from: from }; at.set(bi, g); given.push(g); }
          };
          for (let i = 0; i < sk.n; i++) {
            const v = sk.soft ? sk.soft[i] : null;
            if (v === null || v === undefined || v === false) continue;
            if (v === true) take(i, {}, "the bone '" + sk.names[i] + "'");
            else if (typeof v === "object" && !Array.isArray(v)) take(i, v, "the bone '" + sk.names[i] + "'");
            else errs.push("system: the bone '" + sk.names[i] + "': soft is true or { " + SOFT_FIELDS + " }");
          }
          if (roles.soft !== undefined && roles.soft !== null) {
            if (!Array.isArray(roles.soft)) errs.push("system: roles: soft is a list of bones, or of { bone, " + SOFT_FIELDS + " }");
            else roles.soft.forEach(function (e, j) {
              const o = e !== null && typeof e === "object" && !Array.isArray(e) ? e : { bone: e }, bi = bone_idx(o.bone, "soft[" + j + "]");
              if (bi < 0) return;
              const raw = Object.assign({}, o); delete raw.bone;
              take(bi, raw, "roles.soft[" + j + "]");
            });
          }
          const chain_of_bone = function (bi) { if (!rig || !rig.chains) return null; for (let c = 0; c < rig.chains.length; c++) if (rig.chains[c].bones.indexOf(bi) >= 0 || rig.chains[c].tip === bi) return rig.chains[c].name; return null; };
          given.forEach(function (g) {
            const bi = g.bone, o = g.raw, tag = "system: soft tissue (" + g.from + "): ";
            let ok = true;
            for (const k in o) if (k !== "hz" && k !== "axis" && SOFT_RANGES[k] === undefined) { errs.push(tag + "unknown field '" + k + "' (" + SOFT_FIELDS + ")"); ok = false; }
            if (o.hz !== undefined && o.stiffness !== undefined) { errs.push(tag + "stiffness and hz are the same number: give one"); ok = false; }
            if (sk.parent[bi] < 0) { errs.push(tag + "'" + sk.names[bi] + "' has no parent bone: soft tissue hangs from a bone"); return; }
            const ch = chain_of_bone(bi);
            if (ch !== null) { errs.push(tag + "'" + sk.names[bi] + "' is a bone of the rig's chain '" + ch + "': a chain's bone only turns (the rig holds its head), and soft tissue MOVES the bone: put the tissue on a bone of its own that hangs from it"); return; }
            const had = by_bone.get(bi);
            if (had) { errs.push(tag + "'" + sk.names[bi] + "' has the role " + role_text(had.bits) + ": soft tissue moves every vertex that a bone carries, so it goes on a bone of its own that hangs from it"); return; }
            const rec = { hz: SOFT_DEFAULTS.hz, damping: SOFT_DEFAULTS.damping, gain: SOFT_DEFAULTS.gain, limit: SOFT_DEFAULTS.limit * sk_size, axis: SOFT_DEFAULTS.axis.slice(), from: g.from };
            const num = function (key, into) {
              const v = o[key];
              if (v === undefined) return;
              const r = SOFT_RANGES[key === "hz" ? "stiffness" : key];
              if (typeof v !== "number" || !Number.isFinite(v) || v < r[0] || v > r[1]) { errs.push(tag + key + " = " + v + " is out of range (" + r[0] + " .. " + (key === "limit" ? "the skeleton's size" : r[1]) + ")"); ok = false; }
              else if (key === "limit" && v > sk_size) { errs.push(tag + "limit = " + v + " is more than the skeleton's size (" + sk_size.toFixed(3) + ")"); ok = false; }
              else rec[into] = v;
            };
            num("stiffness", "hz"); num("hz", "hz"); num("damping", "damping"); num("gain", "gain"); num("limit", "limit");
            if (o.axis !== undefined) {
              if (!Array.isArray(o.axis) || o.axis.length !== 3 || !o.axis.every(function (v) { return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 4; })) { errs.push(tag + "axis is [x, y, z]: the weight of each of the model's axes, 0 .. 4"); ok = false; }
              else rec.axis = o.axis.slice();
            }
            if (ok && add(bi, R_SOFT, "soft tissue", 0, soft.length, 1) >= 0) { rec.bone = bi; soft.push(rec); }
          });
        }
        if (recs.length > LIFE_MAX_OV) errs.push("system: roles: " + recs.length + " bones have a role: at most " + LIFE_MAX_OV);
        if (errs.length) throw life_error(errs);
        // what is missing is a warning, not an error
        if (!recs.length) warn.push("no role bones: nothing for the life to move");
        else if (!bare) {                                                           // (a creature that has no roles, only bones that say they are soft, is not missing a head)
          if (head < 0) warn.push("no head: no stabilisation, no idle sway of the head");
          if (chest < 0 && !spine.length && tv[0] > 0) warn.push("no chest and no spine: no breath");
        }
        let lo = [1e30, 1e30, 1e30], hi = [-1e30, -1e30, -1e30];
        for (let i = 0; i < sk.n; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], sk.head[i * 3 + k], sk.tail[i * 3 + k]); hi[k] = Math.max(hi[k], sk.head[i * 3 + k], sk.tail[i * 3 + k]); }
        const size = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1e-3);
        if (!recs.length) return { words: null, nov: 0, bones: [], slot_of: {}, roles: {}, arms: [], arm_bones: [], moves: {}, warnings: warn, traits: tv, features: { breath: false, gait: false, arms: 0, look: false, face: false, eyes: 0, lids: 0, jaw: 0, speech: false, ears: 0, tail: false, appendages: 0, brows: 0, mouth: 0, nose: false, soft: 0, chains: 0 }, size: size, face_unit: 0, soft_table: [], chain_table: [], collider_table: [] };
        // the face's unit: what the definition says, else 0.2 of the head's length, else 0.05 of the size (only a creature that has brows, a mouth or a nose moves by it)
        const fu = brows.length || mouth.length || nose >= 0 ? (face_unit > 0 ? face_unit : (head >= 0 ? 0.2 * sk.length[head] : 0.05 * size)) : 0;
        // the axis a record's pitch turns about (model space): the rule (x, or z for a bone that lies along x), the level axis across the bone ("side": up x its direction, so that a positive turn takes it DOWN; a bone that stands
        // up has the rule's), the axis that takes its tip forward ("fwd": its direction x z), or the one the definition gave
        const pitch_axis = function (i, mode) {
          const B = sk.bind, d = [B[i * 12 + 1], B[i * 12 + 5], B[i * 12 + 9]], rule = Math.abs(d[0]) > 0.9 ? [0, 0, 1] : [1, 0, 0];
          if (Array.isArray(mode)) return mode;
          if (mode === "side") { const l = Math.hypot(d[2], d[0]); return l > 0.3 ? [d[2] / l, 0, -d[0] / l] : rule; }
          if (mode === "fwd") { const l = Math.hypot(d[1], d[0]); return l > 0.3 ? [d[1] / l, -d[0] / l, 0] : [1, 0, 0]; }
          return rule;
        };
        // a bone of a chain is solved by a unit of the rig (its head is rigid in its parent's frame): it turns under its role and does not move
        const in_unit = new Set();
        if (rig && rig.chains) rig.chains.forEach(function (c) { c.bones.forEach(function (b) { in_unit.add(b); }); if (c.tip >= 0) in_unit.add(c.tip); });
        const soft_at = LIFE_HEADER + LIFE_NT + recs.length * LIFE_REC + arms.length * LIFE_ARM_REC;
        const chain_at = soft_at + (soft.length ? 2 + soft.length * LIFE_SOFT_REC : 0);
        const col_at = chain_at + (chains.length ? 2 + chains.length * LIFE_CHAIN_REC : 0);                       // (the colliders' table follows the chains')
        const total = col_at + (colliders.length ? 1 + colliders.length * LIFE_COL_REC : 0), words = new Uint32Array(total), wf = new Float32Array(words.buffer);
        words[0] = (wave ? 1 | (wave.follow ? 2 : 0) : 0) | (soft.length ? 4 : 0) | (chains.length ? 8 : 0) | (colliders.length ? 16 : 0); words[1] = recs.length; words[2] = arms.length;          // (flag 4: the soft tissue's table follows the arms)
        if (wave) { wf[3] = wave.length; wf[4] = wave.angle * Math.PI / 180; wf[5] = wave.speed; }
        wf[6] = fu; words[7] = 0;
        for (let k = 0; k < LIFE_NT; k++) wf[LIFE_HEADER + k] = tv[k];
        const slot_of = Object.create(null), bones = [], bq = new Float32Array(4), bp = new Float32Array(4);
        recs.forEach(function (r, k) {
          const o = LIFE_HEADER + LIFE_NT + k * LIFE_REC, i = r.bone, B = sk.bind, p = sk.parent[i];
          mat_to_quat(B, i * 12, bq, 0);
          if (p >= 0) mat_to_quat(B, p * 12, bp, 0); else { bp[0] = 0; bp[1] = 0; bp[2] = 0; bp[3] = 1; }
          words[o] = i; words[o + 1] = r.bits; words[o + 2] = r.arm; words[o + 3] = r.pos; words[o + 4] = r.len;
          for (let m = 0; m < 4; m++) { wf[o + 5 + m] = bq[m]; wf[o + 9 + m] = bp[m]; }
          const ax = pitch_axis(i, r.ax);                                           // (the rule: a bone that lies along the model's x pitches about z, the others about x; an eye, a lid, a jaw about the level axis across it, an ear its tip forward)
          wf[o + 13] = ax[0]; wf[o + 14] = ax[1]; wf[o + 15] = ax[2];
          wf[o + 17] = r.lim_y; wf[o + 18] = r.lim_p; wf[o + 19] = r.aux;
          let reach = 0;                                                            // how far from the bone's head the farthest part below it lies (a turn of the bone moves that much per radian): the visible-change gate's lever
          const stack = [i], hx = sk.head[i * 3], hy = sk.head[i * 3 + 1], hz = sk.head[i * 3 + 2];
          while (stack.length) {
            const j = stack.pop();
            reach = Math.max(reach, Math.hypot(sk.head[j * 3] - hx, sk.head[j * 3 + 1] - hy, sk.head[j * 3 + 2] - hz), Math.hypot(sk.tail[j * 3] - hx, sk.tail[j * 3 + 1] - hy, sk.tail[j * 3 + 2] - hz));
            for (let q = 0; q < sk.children[j].length; q++) stack.push(sk.children[j][q]);
          }
          wf[o + 16] = reach;
          slot_of[sk.names[i]] = k; bones.push(i);
        });
        const slots = function (list) { return list.map(function (i) { return slot_of[sk.names[i]]; }); };
        arms.forEach(function (a, j) {
          const ao = LIFE_HEADER + LIFE_NT + recs.length * LIFE_REC + j * LIFE_ARM_REC;
          words[ao] = a.chain; wf[ao + 1] = a.side; wf[ao + 2] = a.length;
          for (let m = 0; m < 3; m++) wf[ao + 3 + m] = a.rest[m];
          words[ao + 6] = a.shoulder; words[ao + 7] = a.wrist; words[ao + 8] = a.torso >= 0 ? a.torso : 0xffffffff; words[ao + 9] = 0;
        });
        if (soft.length) {                                                          // the soft tissue's table: the count, the intensity of a new instance, a line of numbers for each bone
          words[soft_at] = soft.length; wf[soft_at + 1] = 1;
          soft.forEach(function (r, j) {
            const o = soft_at + 2 + j * LIFE_SOFT_REC;
            words[o] = slot_of[sk.names[r.bone]]; wf[o + 1] = r.hz; wf[o + 2] = r.damping; wf[o + 3] = r.gain; wf[o + 4] = r.limit;
            wf[o + 5] = r.axis[0]; wf[o + 6] = r.axis[1]; wf[o + 7] = r.axis[2]; words[o + 8] = 0; words[o + 9] = 0;
          });
        }
        if (chains.length) {                                                        // the spring chains' table: the count, the intensity of a new instance, a line of numbers for each chain
          words[chain_at] = chains.length; wf[chain_at + 1] = 1;
          chains.forEach(function (r, j) {
            const o = chain_at + 2 + j * LIFE_CHAIN_REC;
            words[o] = j; wf[o + 1] = r.hz; wf[o + 2] = r.damping; wf[o + 3] = r.gravity; wf[o + 4] = r.inertia; wf[o + 5] = r.limit; wf[o + 6] = r.sway; wf[o + 7] = r.falloff;
            words[o + 8] = 0; words[o + 9] = 0; words[o + 10] = 0; words[o + 11] = 0;
          });
        }
        if (colliders.length) {                                                     // the colliders' table: the count, a line for each capsule (the bone, its ends, its radius)
          words[col_at] = colliders.length;
          colliders.forEach(function (r, j) {
            const o = col_at + 1 + j * LIFE_COL_REC;
            words[o] = r.bone; for (let m = 0; m < 3; m++) { wf[o + 1 + m] = r.a[m]; wf[o + 4 + m] = r.b[m]; } wf[o + 7] = r.r;
          });
        }
        // the chains as the worker has them (sp.chains, sp.chain_set): a row for each chain, in the order of the table
        const chain_table = chains.map(function (r, j) { return { id: j, bones: r.bones.map(function (i) { return sk.names[i]; }), slots: r.bones.map(function (i) { return slot_of[sk.names[i]]; }), hz: r.hz, damping: r.damping, gravity: r.gravity, inertia: r.inertia, limit: r.limit, sway: r.sway, falloff: r.falloff }; });
        const collider_table = colliders.map(function (r) { return { bone: sk.names[r.bone], a: r.a.slice(), b: r.b.slice(), r: r.r }; });          // (sp.chain_colliders)
        // the soft tissue's table as the worker has it (sp.soft_settings, sp.tune_soft): a row for each soft bone, in the order of the table
        const soft_table = soft.map(function (r) { return { bone: sk.names[r.bone], slot: slot_of[sk.names[r.bone]], stiffness: r.hz, damping: r.damping, gain: r.gain, limit: r.limit, axis: r.axis.slice() }; });
        const moves = Object.create(null), arm_bones = [];
        recs.forEach(function (r) { moves[sk.names[r.bone]] = !in_unit.has(r.bone); if (r.bits & (R_UPPER | R_FORE)) arm_bones.push(sk.names[r.bone]); });
        const info = { hips: hips >= 0 ? slot_of[sk.names[hips]] : -1, chest: chest >= 0 ? slot_of[sk.names[chest]] : -1, head: head >= 0 ? slot_of[sk.names[head]] : -1, spine: slots(spine), neck: slots(neck),
          eyes: slots(eyes), lids: slots(lids), jaw: slots(jaws), nose: nose >= 0 ? slot_of[sk.names[nose]] : -1, brows: slots(brows), mouth: slots(mouth), ears: ears.map(slots), tail: slots(tail), appendages: apps.map(slots),
          soft: slots(soft.map(function (r) { return r.bone; })), chains: chains.map(function (r) { return slots(r.bones); }) };
        const features = { breath: tv[0] > 0 && (chest >= 0 || spine.length > 0 || head >= 0), idle: tv[2] > 0 && (hips >= 0 || head >= 0 || spine.length > 0), gait: tv[3] > 0 && (hips >= 0 || spine.length > 0 || head >= 0), stabilise: tv[4] > 0 && head >= 0,
          head: head >= 0, neck: neck.length > 0, spine: spine.length > 0, wave: !!wave, arms: arms.length, shoulders: arms.filter(function (a) { return a.clav >= 0; }).length,
          // what the look and the face can do, from what the creature has: a look needs eyes or a head (the spine takes part when it has one), the face's channels move what it has (the speech needs a jaw)
          look: head >= 0 || eyes.length > 0, eyes: eyes.length, lids: lids.length, jaw: jaws.length, speech: jaws.length > 0, nose: nose >= 0, brows: brows.length, mouth: mouth.length, ears: ears.length, tail: tail.length > 0, appendages: apps.length, chains: chains.length,
          face: jaws.length > 0 || lids.length > 0 || brows.length > 0 || mouth.length > 0 || ears.length > 0 || nose >= 0 || eyes.length > 0 || tail.length > 0 || apps.length > 0, soft: soft.length };
        // how far each jaw bone opens (radians, in the order of roles.jaw): its own `max`, else the trait jaw_max (what the face's channel 1 is; an action's jaw track is held to 1.2 of it, the channel's own ceiling)
        const jaw_max = jaws.map(function (i) { const r = by_bone.get(i); return r && r.lim_p > 0 ? r.lim_p : tv[TRAIT_INDEX.jaw_max]; });
        return { words: words, nov: recs.length, bones: bones, slot_of: slot_of, roles: info, arm_bones: arm_bones, moves: moves, arms: arms.map(function (a) { return { chain: a.chain, name: a.name, side: a.side, length: a.length, rest: a.rest_u.slice(), shoulder: sk.names[a.shoulder], wrist: sk.names[a.wrist], torso: a.torso >= 0 ? sk.names[a.torso] : null, clavicle: a.clav >= 0 ? sk.names[a.clav] : null }; }),
          warnings: warn, traits: tv, features: features, size: size, face_unit: fu, soft_table: soft_table, chain_table: chain_table, collider_table: collider_table, jaw_max: jaw_max };
      }
      system.compile_roles = compile_roles;
      system.TRAITS = TRAITS.map(function (t) { return { name: t[0], default: t[1], min: t[3], max: t[4], degrees: t[2] !== 1 }; });

      // ========================================================================================================================
      // flight
      // ========================================================================================================================
// system.js, a part: flight and wings: the compile of def.flight and def.wings into the words the worker reads (world.cpp). The page's calls (fly, the climb wish, the controls, the wings by hand) are species.js.
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- flight and wings ----------------------------------------------------------------------------------------------------------------------------
      // def.flight -> the words of the SEC_FLIGHT section ({ words, flight }); the ranges are the worker's (happy_flight_build). A creature that is flown has a MODEL: a wing (a bird, a bat, a glider: it cannot hang in the
      // air, it flies at its stall speed or more and turns by banking) or a hover (an insect, a drone: it accelerates toward the wished velocity and can stand in the air). Speeds are in model units / s (times the
      // instance's scale = world), the thrust in g, the angles in radians. A flyer needs a body with a gravity (the g of its turns and of its thrust)
      const SEC_FLIGHT = 8, SEC_WINGS = 9;
      const FLIGHT_FIELDS = ["model", "stall_speed", "cruise_speed", "max_speed", "thrust", "max_bank", "max_pitch", "rate", "pivot", "clearance"];
      function compile_flight(fl, body) {
        if (!fl || typeof fl !== "object" || Array.isArray(fl)) throw new Error("system: flight must be an object");
        const tag = "system: flight: ";
        for (const k in fl) if (FLIGHT_FIELDS.indexOf(k) < 0) throw new Error(tag + "unknown field '" + k + "' (" + FLIGHT_FIELDS.join(", ") + ")");
        if (!body) throw new Error(tag + "needs a body (body: { gravity })");
        if (!(body.body.gravity > 0)) throw new Error(tag + "needs a body with a gravity (the g of the turns and of the thrust): body: { gravity: 9.8 }");
        const model = fl.model === undefined ? "wing" : fl.model;
        if (model !== "wing" && model !== "hover") throw new Error(tag + "model must be 'wing' or 'hover'");
        const wing = model === "wing", dv = function (v, d) { return v === undefined ? d : v; };
        const stall = wing ? dv(fl.stall_speed, 8) : Math.min(1, dv(fl.max_speed, 10));            // (a hover has none: they are only there to be valid)
        const cruise = wing ? dv(fl.cruise_speed, 1.5 * stall) : stall;
        const o = { model: model, stall_speed: stall, cruise_speed: cruise, max_speed: dv(fl.max_speed, wing ? 1.5 * cruise : 10), thrust: dv(fl.thrust, wing ? 0.3 : 2),
          max_bank: dv(fl.max_bank, wing ? 1.0 : 0.6), max_pitch: dv(fl.max_pitch, 0.6), rate: dv(fl.rate, 2), pivot: dv(fl.pivot, 0), clearance: dv(fl.clearance, 0.5) };
        const num = function (name, v, lo, hi, lo_open) { if (!Number.isFinite(v) || (lo_open ? !(v > lo) : !(v >= lo)) || !(v < hi)) throw new Error(tag + name + " = " + v + " is out of range"); };
        num("stall_speed", o.stall_speed, 1e-6, 1e6, true); num("cruise_speed", o.cruise_speed, o.stall_speed, 1e6, false); num("max_speed", o.max_speed, o.cruise_speed, 1e6, false);
        num("thrust", o.thrust, 0, 1e3, true); num("max_bank", o.max_bank, 0, 1.5, true); num("max_pitch", o.max_pitch, 0, 1.5, true); num("rate", o.rate, 0, 1e3, true);
        num("pivot", o.pivot, -1e4, 1e4, true); num("clearance", o.clearance, 0, 1e4, false);
        const f1 = new Float32Array(1), u1 = new Uint32Array(f1.buffer), words = [0, wing ? 1 : 2];
        [o.stall_speed, o.cruise_speed, o.max_speed, o.thrust, o.max_bank, o.max_pitch, o.rate, o.pivot, o.clearance].forEach(function (v) { f1[0] = v; words.push(u1[0]); });
        words.push(0);
        return { words: Uint32Array.from(words), flight: o };
      }

      // def.wings -> the words of the SEC_WINGS section ({ words, wings }); the ranges are the worker's (happy_wings_build). A wing is a bone (the inner wing) and optionally its child (the tip); the flap is about the
      // model's forward axis (z) and the fold about the vertical one, turned for a wing that reaches toward -x so that the two of a pair beat in step; the axes are worked out here in each bone's own frame. Angles are in
      // degrees here (a page's sliders), the worker has radians. `wings` is a list of wings or { wings: [...], amplitude, tip_amplitude, tip_lag, fold, tip_fold, droop, fold_rate, hz, climb_hz, speed_hz, speed_ref,
      // climb_ref, sink, flare }; a wing is { bone, tip, side, open, tip_open }. SIDE (1: the wing reaches toward +x, the creature's left; -1: toward -x) is told from the bone's x when it is not said (a creature whose middle is not over
      // x = 0 says it). OPEN is for a creature whose wings are FOLDED in its bind pose (a bird's hang down its sides, an insect's lie along its back): { axis: [x, y, z], angle } is the
      // rotation (a model-space axis, degrees) that turns the bone from its bind pose to its spread pose, `tip_open` the same for the tip once its inner bone is open. The bind pose is then the folded one (fold 1: standing),
      // the wing opens when it flies (fold 0) and flaps from the open pose; a species whose wings are made so says `fold: 0, tip_fold: 0, droop: 0` (the fold that swings a spread wing back is no use to them).
      // The wings' bones are posed by the worker: they are no bone of a chain of the rig and have no joint of the rig (its limit stop would hold them)
      const WINGS_FIELDS = ["wings", "amplitude", "tip_amplitude", "tip_lag", "fold", "tip_fold", "droop", "fold_rate", "hz", "climb_hz", "speed_hz", "speed_ref", "climb_ref", "sink", "flare"];
      const WING_FIELDS = ["bone", "tip", "side", "open", "tip_open", "mirror"];
      // a vector turned about a unit axis by an angle (Rodrigues)
      function turn_about(v, a, ang) {
        const c = Math.cos(ang), s = Math.sin(ang), d = a[0] * v[0] + a[1] * v[1] + a[2] * v[2], x = [a[1] * v[2] - a[2] * v[1], a[2] * v[0] - a[0] * v[2], a[0] * v[1] - a[1] * v[0]];
        return [v[0] * c + x[0] * s + a[0] * d * (1 - c), v[1] * c + x[1] * s + a[1] * d * (1 - c), v[2] * c + x[2] * s + a[2] * d * (1 - c)];
      }
      function compile_wings(wg, sk, rig, flight) {
        const tag = "system: wings: ";
        if (Array.isArray(wg)) wg = { wings: wg };
        if (!wg || typeof wg !== "object") throw new Error("system: wings must be a list of wings or an object { wings, ... }");
        for (const k in wg) if (WINGS_FIELDS.indexOf(k) < 0) throw new Error(tag + "unknown field '" + k + "' (" + WINGS_FIELDS.join(", ") + ")");
        if (!Array.isArray(wg.wings) || wg.wings.length < 1 || wg.wings.length > 8) throw new Error(tag + "wings must be a list of 1 to 8 wings");
        const dv = function (v, d) { return v === undefined ? d : v; }, D2R = Math.PI / 180;
        const num = function (name, v, lo, hi) { if (!Number.isFinite(v) || !(v >= lo) || !(v <= hi)) throw new Error(tag + name + " = " + v + " is out of range"); };
        const speed_ref = dv(wg.speed_ref, flight ? flight.max_speed : 0);
        const o = { amplitude: dv(wg.amplitude, 32), tip_amplitude: dv(wg.tip_amplitude, 24), tip_lag: dv(wg.tip_lag, 0.9 / D2R), fold: dv(wg.fold, 80), tip_fold: dv(wg.tip_fold, 10), droop: dv(wg.droop, 12),
          fold_rate: dv(wg.fold_rate, 6), hz: dv(wg.hz, 2.5), climb_hz: dv(wg.climb_hz, 1.5), speed_hz: dv(wg.speed_hz, 1), speed_ref: speed_ref, climb_ref: dv(wg.climb_ref, 0.3 * speed_ref),
          sink: dv(wg.sink, flight ? 0.4 * flight.stall_speed : 3), flare: dv(wg.flare, 0.4) };
        num("amplitude", o.amplitude, 0, 90); num("tip_amplitude", o.tip_amplitude, 0, 90); num("tip_lag", o.tip_lag, 0, 180); num("fold", o.fold, 0, 180); num("tip_fold", o.tip_fold, 0, 180); num("droop", o.droop, 0, 90);
        if (!Number.isFinite(o.fold_rate) || !(o.fold_rate > 0) || !(o.fold_rate < 1000)) throw new Error(tag + "fold_rate = " + o.fold_rate + " is out of range");
        num("hz", o.hz, 0, 50); num("climb_hz", o.climb_hz, 0, 50); num("speed_hz", o.speed_hz, 0, 50); num("speed_ref", o.speed_ref, 0, 999999); num("climb_ref", o.climb_ref, 0, 999999); num("sink", o.sink, 0, 999999); num("flare", o.flare, 0, 5);
        const taken = new Set(), jointed = new Set();
        if (rig && rig.chains) rig.chains.forEach(function (c) { c.bones.forEach(function (b) { taken.add(b); }); if (c.tip >= 0) taken.add(c.tip); });
        if (rig && rig.joints) rig.joints.forEach(function (j) { jointed.add(j.bone); });
        const f1 = new Float32Array(1), u1 = new Uint32Array(f1.buffer), words = [0, wg.wings.length], pushf = function (v) { f1[0] = v; words.push(u1[0]); };
        [o.amplitude * D2R, o.tip_amplitude * D2R, o.tip_lag * D2R, o.fold * D2R, o.tip_fold * D2R, o.droop * D2R, o.fold_rate, o.hz, o.climb_hz, o.speed_hz, o.speed_ref, o.climb_ref, o.sink, o.flare].forEach(pushf);
        const used = new Set(), m = sk.bind;
        const bone_of = function (what, v) {
          const b = typeof v === "number" ? v : sk.index[v];
          if (b === undefined || !(b >= 0 && b < sk.n) || b !== (b | 0)) throw new Error(tag + what + ": unknown bone '" + v + "'");
          if (sk.parent[b] < 0) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' is a root: a wing hangs from a bone");
          if (taken.has(b)) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' is in a chain of the rig (the rig would pose it)");
          if (jointed.has(b)) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' has a joint in the rig (its limit stop would hold the wing): the worker poses the wings, they have none");
          if (used.has(b)) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' is used twice");
          used.add(b);
          return b;
        };
        // a model-space direction in a bone's own frame (the transpose of its bind rotation applied to it)
        const in_frame = function (b, a) { return [0, 1, 2].map(function (j) { return m[b * 12 + j] * a[0] + m[b * 12 + 4 + j] * a[1] + m[b * 12 + 8 + j] * a[2]; }); };
        const side = function (b) { return m[b * 12 + 3] < 0 ? -1 : 1; };
        // a wing with `mirror: "x"` (its bones' names end in _l) is two: the twin has the names of the right-hand bones and the other side (an `open` rotation turns with the mirror: its axis a becomes (a.x, -a.y, -a.z))
        const list = [];
        wg.wings.forEach(function (w, i) {
          if (w && typeof w === "object" && w.mirror !== undefined) { const own = Object.assign({}, w); delete own.mirror; list.push(own); } else list.push(w);
          if (w && typeof w === "object" && w.mirror !== undefined) {
            check_mirror(w.mirror, "wings[" + i + "]");
            const t = Object.assign({}, w, { bone: mirror_name(w.bone, "wings[" + i + "]") });
            delete t.mirror;
            if (w.tip !== undefined && w.tip !== null) t.tip = mirror_name(w.tip, "wings[" + i + "]");
            if (w.side !== undefined) t.side = -w.side;
            const mir = function (o) { return o ? { axis: [o.axis[0], -o.axis[1], -o.axis[2]], angle: o.angle } : o; };
            if (w.open) t.open = mir(w.open);
            if (w.tip_open) t.tip_open = mir(w.tip_open);
            list.push(t);
          }
        });
        if (list.length > 8) throw new Error(tag + "at most 8 wings (" + list.length + ")");
        words[1] = list.length;                                                          // (a mirrored wing is two)
        o.wings = list.map(function (w, i) {
          const what = "wing " + i;
          if (!w || typeof w !== "object" || Array.isArray(w)) throw new Error(tag + what + " must be an object");
          for (const k in w) if (WING_FIELDS.indexOf(k) < 0) throw new Error(tag + what + ": unknown field '" + k + "' (" + WING_FIELDS.join(", ") + ")");
          if (w.bone === undefined) throw new Error(tag + what + ": bone is needed");
          const b = bone_of(what, w.bone), t = w.tip === undefined || w.tip === null ? -1 : bone_of(what + " tip", w.tip);
          if (t >= 0 && sk.parent[t] !== b) throw new Error(tag + what + ": the tip bone '" + sk.names[t] + "' is not a child of '" + sk.names[b] + "'");
          // the open rotations: a model-space axis (unit) and an angle (rad); one with no angle is none
          const open_of = function (v, name) {
            if (v === undefined || v === null) return null;
            if (typeof v !== "object" || Array.isArray(v)) throw new Error(tag + what + ": " + name + " must be { axis: [x, y, z], angle }");
            for (const k in v) if (k !== "axis" && k !== "angle") throw new Error(tag + what + ": " + name + ": unknown field '" + k + "'");
            if (!Array.isArray(v.axis) || v.axis.length !== 3 || !v.axis.every(Number.isFinite) || !(Math.hypot(v.axis[0], v.axis[1], v.axis[2]) > 1e-6)) throw new Error(tag + what + ": " + name + ": axis must be a vector [x, y, z] that is not zero");
            if (!Number.isFinite(v.angle) || v.angle < 0 || v.angle > 180) throw new Error(tag + what + ": " + name + ": angle = " + v.angle + " is out of range (0 .. 180 degrees)");
            const l = Math.hypot(v.axis[0], v.axis[1], v.axis[2]);
            return v.angle > 0 ? { axis: [v.axis[0] / l, v.axis[1] / l, v.axis[2] / l], angle: v.angle * D2R, degrees: v.angle } : null;
          };
          const op = open_of(w.open, "open"), top = open_of(w.tip_open, "tip_open");
          if (w.tip_open !== undefined && w.tip_open !== null && t < 0) throw new Error(tag + what + ": tip_open needs a tip");
          // a tip follows its inner bone, which is turned by the open rotation when the wing is spread: the axes of the tip (the flap about the forward axis, the fold about the vertical one, its own open rotation) are
          // those of the world turned back by it. One side for both bones: the wing's
          if (w.side !== undefined && w.side !== 1 && w.side !== -1) throw new Error(tag + what + ": side must be 1 or -1");
          const sd = w.side === undefined ? side(b) : w.side, back = function (a) { return op ? turn_about(a, op.axis, -op.angle) : a; };
          words.push(b, t + 1);
          in_frame(b, [0, 0, sd]).forEach(pushf); in_frame(b, [0, sd, 0]).forEach(pushf);
          if (t >= 0) { in_frame(t, back([0, 0, sd])).forEach(pushf); in_frame(t, back([0, sd, 0])).forEach(pushf); } else { [0, 1, 0, 0, 1, 0].forEach(pushf); }
          if (op) { in_frame(b, op.axis).forEach(pushf); pushf(op.angle); } else { [0, 0, 0, 0].forEach(pushf); }
          if (top) { in_frame(t, back(top.axis)).forEach(pushf); pushf(top.angle); } else { [0, 0, 0, 0].forEach(pushf); }
          words.push(0, 0);
          return { bone: sk.names[b], tip: t >= 0 ? sk.names[t] : null, side: sd, open: op ? { axis: op.axis.map(function (x) { return +x.toFixed(6); }), angle: op.degrees } : null, tip_open: top ? { axis: top.axis.map(function (x) { return +x.toFixed(6); }), angle: top.degrees } : null };
        });
        return { words: Uint32Array.from(words), wings: o };
      }
      system.compile_flight = compile_flight; system.compile_wings = compile_wings;

      // ========================================================================================================================
      // wheels
      // ========================================================================================================================
// system.js, a part: wheels, vehicles and couplers: the compile of def.vehicle, def.wheels and def.couplers into the words the worker reads (world.cpp). The page's calls (the driver's controls are flight_api.js's
// set_controls, the hitch is wheels_api.js's link and unlink) are not here.
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- wheels and vehicles ------------------------------------------------------------------------------------------------------------------------
      // A wheel is a BONE of the skeleton whose head is the wheel's centre (the hub) at the bind pose: the worker poses it (its spin, its steering, its suspension), nothing else does, so it is no bone of a chain of the rig, no
      // bone of a wing and has no joint of the rig (its limit stop would hold it). The model stands on y = 0, +z is its front, +x its left, and the radius of a wheel is the hub's height unless it says another.
      const SEC_VEHICLE = 10, SEC_WHEELS = 11;
      // the bones that the rig's chains pose, the bones that have a joint, and the bones of the wings and of a vehicle's wheels: a wheel takes none of them
      function bones_owned(rig, wings, vehicle, sk) {
        const taken = new Set(), jointed = new Set();
        if (rig && rig.chains) rig.chains.forEach(function (c) { c.bones.forEach(function (b) { taken.add(b); }); if (c.tip >= 0) taken.add(c.tip); });
        if (rig && rig.joints) rig.joints.forEach(function (j) { jointed.add(j.bone); });
        if (wings) wings.wings.forEach(function (w) { taken.add(sk.index[w.bone]); if (w.tip) taken.add(sk.index[w.tip]); });
        if (vehicle) vehicle.wheels.forEach(function (w) { taken.add(sk.index[w.bone]); });
        return { taken: taken, jointed: jointed };
      }
      function wheel_num(name, v, lo, hi, lo_open) { if (!Number.isFinite(v) || (lo_open ? !(v > lo) : !(v >= lo)) || !(v < hi)) throw new Error(name + " = " + v + " is out of range"); }
      // the bone a wheel stands on (a name or an index): it must exist, hang from a parent (the suspension moves it in its parent's frame), be free
      function wheel_bone(tag, what, v, sk, own) {
        const b = typeof v === "number" ? v : sk.index[v];
        if (b === undefined || !(b >= 0 && b < sk.n) || b !== (b | 0)) throw new Error(tag + what + ": unknown bone '" + v + "'");
        if (sk.parent[b] < 0) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' is a root: a wheel hangs from a bone (the suspension moves it in its parent's frame)");
        if (own.taken.has(b)) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' is in a chain of the rig, a wing or another wheel (one thing a bone)");
        if (own.jointed.has(b)) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' has a joint in the rig (its limit stop would hold the wheel): the worker poses the wheels, they have none");
        return b;
      }

      // ---- THE REALISM of a vehicle: a dynamic car (world.cpp, SYSTEM.md "Vehicles with suspension and an engine") --------------------------------------------------------------------------------------------------------------
      // `vehicle: { realism: true | { ... } }` (or `suspension`, the same flag) turns the vehicle from a kinematic one (a bicycle model: its velocity is set, its wheels follow the ground) into a DYNAMIC one: a sprung body on a spring and a damper at
      // every wheel (heave, pitch and roll: it dives under the brakes, squats under the throttle, rolls in a bend, and the weight moves from wheel to wheel), an ENGINE (a torque curve, a rev limiter, engine braking), a gearbox with ratios that shifts
      // by itself (and a reverse), a differential, a wheel that is a flywheel (it spins up and locks), a TYRE that makes the force from its slip (a ratio along, an angle across, the friction circle of its load), brakes with a torque, drag
      // and rolling resistance. Everything has a default worked out from the vehicle's mass, top speed and wheels; every number may be said:
      //   mass (kg: the physics section's, 1200)   cg (m: the height of the centre of gravity, 1.55 wheel radii)   cg_z (m: its place along the car, the middle of the wheels)   inertia (kg m^2: about the vertical, 1.1 m (wheelbase / 2)^2)
      //   suspension: { hz (the body's bounce, 1.3), damping (the share of critical, 0.35), bar (an anti-roll bar, N m / rad: 0 the springs' own), bump (the bump stop's stiffness over the spring's, 12) }
      //   engine: { power (kW), torque (N m, the peak: from the power), idle (rpm), redline (rpm), inertia (kg m^2), brake (N m of engine braking), curve: [[rpm, N m] ... up to 8] }
      //   gearbox: { ratios: [first ... last] (up to 8), reverse, final, up (rpm), down (rpm), time (s), efficiency }
      //   tyres: { grip (the friction: 1.05), grip_long, grip_lat, stiff_long, stiff_lat (the slope of the force at small slip: 16, 18), rolling (0.013), inertia (a wheel: kg m^2) }
      //   brakes: { torque (a wheel's, N m), hand (the handbrake's), abs (true: the brakes ease off a wheel that is about to lock) }      aero: { drag (N per (m/s)^2: half the air's density times Cd times the area), downforce }      diff: 0 .. 1 (how much of the open differential's limit it overcomes: 0.3)
      const REALISM_FIELDS = ["mass", "cg", "cg_z", "inertia", "suspension", "engine", "gearbox", "tyres", "brakes", "aero", "diff"];
      const REAL_SUSP = ["hz", "damping", "bar", "bump"], REAL_ENGINE = ["power", "torque", "idle", "redline", "inertia", "brake", "curve"], REAL_GEARBOX = ["ratios", "reverse", "final", "up", "down", "time", "efficiency"];
      const REAL_TYRES = ["grip", "grip_long", "grip_lat", "stiff_long", "stiff_lat", "rolling", "inertia"], REAL_BRAKES = ["torque", "hand", "abs"], REAL_AERO = ["drag", "downforce"];
      const REAL_WORDS = 64;                                                                                // (HAPPY_REAL_WORDS: the section's words after the rollover's four)
      // the shape of a petrol engine's torque against its revs (the share of the peak, at a share of the redline): rises, a broad peak at half the redline, falls toward the limiter
      const REAL_CURVE_SHAPE = [[0.14, 0.6], [0.25, 0.8], [0.4, 0.95], [0.55, 1.0], [0.7, 0.96], [0.8, 0.9], [0.9, 0.78], [1.0, 0.55]];
      function compile_realism(rin, o, hubs, wheels_in, mass_in, skid, radii, drives) {
        const tag = "system: vehicle: realism: ";
        if (skid) throw new Error(tag + "a tracked vehicle has no suspension of this kind: realism is for the car model");
        if (!rin || typeof rin !== "object" || Array.isArray(rin)) throw new Error(tag + "realism is true or { " + REALISM_FIELDS.join(", ") + " }");
        for (const k in rin) if (REALISM_FIELDS.indexOf(k) < 0) throw new Error(tag + "unknown field '" + k + "' (" + REALISM_FIELDS.join(", ") + ")");
        const sub = function (name, list) {
          const v = rin[name];
          if (v === undefined) return {};
          if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(tag + name + " must be { " + list.join(", ") + " }");
          for (const k in v) if (list.indexOf(k) < 0) throw new Error(tag + name + ": unknown field '" + k + "' (" + list.join(", ") + ")");
          return v;
        };
        const dv = function (v, d) { return v === undefined ? d : v; }, num = function (name, v, lo, hi, lo_open) { wheel_num(tag + name, v, lo, hi, lo_open); };
        const su = sub("suspension", REAL_SUSP), en = sub("engine", REAL_ENGINE), gb = sub("gearbox", REAL_GEARBOX), ty = sub("tyres", REAL_TYRES), br = sub("brakes", REAL_BRAKES), ae = sub("aero", REAL_AERO);
        const n = wheels_in.length, driven = [];
        wheels_in.forEach(function (w, i) { if (drives[i] > 0) driven.push(i); });
        if (!driven.length) throw new Error(tag + "no wheel drives (a wheel's `drive` is more than 0 for one that does)");
        const ravg = radii.reduce(function (a, b) { return a + b; }, 0) / n, rdrv = driven.reduce(function (a, i) { return a + radii[i]; }, 0) / driven.length;
        const mass = dv(rin.mass, dv(mass_in, 1200)), cg = dv(rin.cg, o.flip && o.flip.cg > 0 ? o.flip.cg : 1.55 * ravg), g0 = 9.81;
        const zmean = hubs.reduce(function (a, h) { return a + h.z; }, 0) / n;
        num("mass", mass, 1, 1e7, true); num("cg", cg, 0.01, 1e3, true);
        const cg_z = dv(rin.cg_z, 1e30);
        if (rin.cg_z !== undefined) num("cg_z", cg_z, -1e3, 1e3, false);
        const inertia = dv(rin.inertia, 0);
        num("inertia", inertia, 0, 1e9, false);
        const hz = dv(su.hz, 1.3), damping = dv(su.damping, 0.35), bar = dv(su.bar, 0), bump = dv(su.bump, 12);
        num("suspension.hz", hz, 0.1, 20, true); num("suspension.damping", damping, 0, 5, false); num("suspension.bar", bar, 0, 1e9, false); num("suspension.bump", bump, 0, 1e4, false);
        // the resistance of the road and the air at the top speed, and so the power that it takes to get there (and to be quick on the way)
        const cda = dv(ae.drag, 0.45), crr = dv(ty.rolling, 0.013), vtop = o.top_speed;
        num("aero.drag", cda, 0, 1e5, false); num("aero.downforce", dv(ae.downforce, 0), 0, 1e5, false); num("tyres.rolling", crr, 0, 1, false);
        const p_req = (cda * vtop * vtop * vtop + crr * mass * g0 * vtop) / 0.9;
        const idle = dv(en.idle, 850), redline = dv(en.redline, 6200);
        num("engine.idle", idle, 100, 1e5, false); num("engine.redline", redline, 200, 2e5, true);
        if (!(redline > idle * 2)) throw new Error(tag + "engine.redline must be over twice the idle");
        let curve = en.curve;
        if (curve !== undefined) {
          if (!Array.isArray(curve) || curve.length < 2 || curve.length > 8 || !curve.every(function (p) { return Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] >= 0 && p[1] >= 0; })) throw new Error(tag + "engine.curve is 2 to 8 points [rpm, N m]");
          for (let i = 1; i < curve.length; i++) if (!(curve[i][0] > curve[i - 1][0])) throw new Error(tag + "engine.curve: the rpm of the points must rise");
          curve = curve.map(function (p) { return [p[0], p[1]]; });
        } else {
          let pk = en.torque;
          if (pk === undefined) {
            const kw = dv(en.power, Math.max(0.05 * mass, 1.7 * p_req / 1000)), shape_p = Math.max.apply(null, REAL_CURVE_SHAPE.map(function (p) { return p[1] * p[0] * redline * 2 * Math.PI / 60; }));
            num("engine.power", kw, 0.1, 1e5, true);
            pk = kw * 1000 / shape_p;
          }
          num("engine.torque", pk, 0.1, 1e6, true);
          curve = REAL_CURVE_SHAPE.map(function (p) { return [p[0] * redline, p[1] * pk]; });
        }
        if (curve[curve.length - 1][0] < redline * 0.9) curve.push([redline * 1.02, curve[curve.length - 1][1] * 0.5]);
        if (curve.length > 8) curve = curve.slice(0, 8);
        const tmax = Math.max.apply(null, curve.map(function (p) { return p[1]; }));
        const ebrake = dv(en.brake, 0.09 * tmax), einertia = dv(en.inertia, 0.25);
        num("engine.brake", ebrake, 0, 1e6, false); num("engine.inertia", einertia, 1e-3, 1e4, false);
        // the gearbox: a final drive and five ratios, from the engine's top revs at the top speed down to a first that gets a car off the line
        const eta = dv(gb.efficiency, 0.9);
        num("gearbox.efficiency", eta, 0.1, 1.0000001, false);
        let ratios = gb.ratios, final = gb.final;
        if (ratios !== undefined && (!Array.isArray(ratios) || ratios.length < 1 || ratios.length > 8 || !ratios.every(function (x) { return Number.isFinite(x) && x > 0.05 && x < 50; }))) throw new Error(tag + "gearbox.ratios is 1 to 8 ratios (a first gear first)");
        if (final === undefined) {
          const w_eng = redline * 0.93 * 2 * Math.PI / 60, top_total = w_eng * rdrv / (vtop * 1.08), top_gear = ratios ? ratios[ratios.length - 1] : 0.78;
          final = top_total / top_gear;
        }
        num("gearbox.final", final, 0.1, 100, true);
        if (!ratios) {
          const first = 3.5, topg = 0.78, ng = 5;
          ratios = []; for (let i = 0; i < ng; i++) ratios.push(first * Math.pow(topg / first, i / (ng - 1)));
        }
        const reverse = dv(gb.reverse, 3.4), up = dv(gb.up, 0.84 * redline), down = dv(gb.down, 0.4 * redline), shift_time = dv(gb.time, 0.22);
        num("gearbox.reverse", reverse, 0.05, 50, true); num("gearbox.up", up, 100, 2e5, true); num("gearbox.down", down, 50, 2e5, true); num("gearbox.time", shift_time, 0, 10, false);
        if (!(up > down * 1.2)) throw new Error(tag + "gearbox.up must be over 1.2 times gearbox.down (it would shift up and down at once)");
        const grip = dv(ty.grip, 1.05), gl = dv(ty.grip_long, grip), gt = dv(ty.grip_lat, grip), bl = dv(ty.stiff_long, 16), bt = dv(ty.stiff_lat, 18), winertia = dv(ty.inertia, 12 * ravg * ravg);
        num("tyres.grip", grip, 0.01, 10, true); num("tyres.grip_long", gl, 0.01, 10, true); num("tyres.grip_lat", gt, 0.01, 10, true); num("tyres.stiff_long", bl, 1, 200, true); num("tyres.stiff_lat", bt, 1, 200, true); num("tyres.inertia", winertia, 1e-3, 1e4, true);
        const tb = dv(br.torque, 1.05 * mass * g0 * ravg / n), th = dv(br.hand, 1.2 * tb);
        num("brakes.torque", tb, 0, 1e7, false); num("brakes.hand", th, 0, 1e7, false);
        const abs_on = br.abs === undefined ? true : br.abs;
        if (typeof abs_on !== "boolean") throw new Error(tag + "brakes.abs is true (the default: the brakes do not lock the wheels) or false");
        const diff = dv(rin.diff, 0.3);
        num("diff", diff, 0, 1.0000001, false);
        const words = new Array(REAL_WORDS).fill(0);
        const put = function (i, v) { words[i] = v; };
        put(0, mass); put(1, cg); put(2, cg_z); put(3, inertia); put(4, hz); put(5, damping); put(6, bar); put(7, bump);
        put(8, idle); put(9, redline); put(10, einertia); put(11, ebrake); put(12, curve.length);
        curve.forEach(function (p, i) { put(13 + 2 * i, p[0]); put(14 + 2 * i, p[1]); });
        put(29, ratios.length); put(30, reverse); put(31, final); put(32, up); put(33, down); put(34, shift_time); put(35, eta);
        ratios.forEach(function (x, i) { put(36 + i, x); });
        put(44, gl); put(45, gt); put(46, bl); put(47, bt); put(48, crr); put(49, winertia); put(50, tb); put(51, th); put(52, cda); put(53, dv(ae.downforce, 0)); put(54, diff); put(55, abs_on ? 1 : 0);
        return { words: words, real: { mass: mass, cg: cg, cg_z: cg_z === 1e30 ? zmean : cg_z, suspension: { hz: hz, damping: damping, bar: bar, bump: bump }, engine: { idle: idle, redline: redline, inertia: einertia, brake: ebrake, curve: curve, peak_torque: tmax },
          gearbox: { ratios: ratios, reverse: reverse, final: final, up: up, down: down, time: shift_time, efficiency: eta }, tyres: { grip_long: gl, grip_lat: gt, stiff_long: bl, stiff_lat: bt, rolling: crr, inertia: winertia }, brakes: { torque: tb, hand: th, abs: abs_on }, aero: { drag: cda, downforce: dv(ae.downforce, 0) }, diff: diff } };
      }

      // def.vehicle -> the words of the SEC_VEHICLE section ({ words, vehicle }); the ranges are the worker's (happy_vehicle_build). A wheel's hub is the head of its bone, it rolls about the model's x and steers about the model's
      // up; the axes are worked out here in the bone's own frame (the pose of a bone is in its own frame). model: "car" (a bicycle model: the front wheels steer) or "tracked" (skid steering: it pivots)
      const VEHICLE_FIELDS = ["model", "wheels", "max_steer", "steer_rate", "wheelbase", "top_speed", "reverse", "accel", "brake", "grip", "roll", "turn_rate", "steer_speed", "travel", "follow", "lean", "flip", "realism", "suspension"];
      const FLIP_FIELDS = ["recover", "width", "height", "cg"];
      const WHEEL_FIELDS = ["bone", "radius", "steer", "drive", "brake", "handbrake", "grip"];
      function compile_vehicle(vh, sk, rig, body, legs, wings, physics) {
        if (!vh || typeof vh !== "object" || Array.isArray(vh)) throw new Error("system: vehicle must be an object");
        const tag = "system: vehicle: ";
        for (const k in vh) if (VEHICLE_FIELDS.indexOf(k) < 0) throw new Error(tag + "unknown field '" + k + "' (" + VEHICLE_FIELDS.join(", ") + ")");
        if (!body) throw new Error(tag + "needs a body (body: { max_speed ... }): the body moves the chassis and holds the driver's controls");
        if (legs) throw new Error(tag + "a vehicle has no legs (both would own the heading and the lean of the chassis): a creature that walks has `wheels` (passive ones) instead");
        const model = vh.model === undefined ? "car" : vh.model;
        if (model !== "car" && model !== "tracked") throw new Error(tag + "model must be 'car' or 'tracked'");
        if (!Array.isArray(vh.wheels) || vh.wheels.length < 1 || vh.wheels.length > 8) throw new Error(tag + "wheels must be a list of 1 to 8 wheels");
        const skid = model === "tracked", dv = function (v, d) { return v === undefined ? d : v; }, own = bones_owned(rig, wings, null, sk);
        const hubs = vh.wheels.map(function (w, i) {
          if (!w || typeof w !== "object" || Array.isArray(w)) throw new Error(tag + "wheel " + i + " must be an object");
          for (const k in w) if (WHEEL_FIELDS.indexOf(k) < 0) throw new Error(tag + "wheel " + i + ": unknown field '" + k + "' (" + WHEEL_FIELDS.join(", ") + ")");
          const b = wheel_bone(tag, "wheel " + i, w.bone, sk, own);
          return { b: b, x: sk.bind[b * 12 + 3], y: sk.bind[b * 12 + 7], z: sk.bind[b * 12 + 11] };
        });
        if (new Set(hubs.map(function (h) { return h.b; })).size !== hubs.length) throw new Error(tag + "a bone is two wheels");
        const zs = hubs.map(function (h) { return h.z; }), zmean = zs.reduce(function (a, b) { return a + b; }, 0) / zs.length;
        const front = hubs.map(function (h) { return h.z > zmean + 1e-9; });                                   // (the front: ahead of the middle of the wheels, along the model's +z)
        const steered = vh.wheels.map(function (w, i) { return w.steer === undefined ? (skid ? 0 : (front[i] ? 1 : 0)) : w.steer; });
        let wheelbase = vh.wheelbase;
        if (wheelbase === undefined) {
          const fz = hubs.filter(function (h, i) { return steered[i] > 0; }).map(function (h) { return h.z; }), rz = hubs.filter(function (h, i) { return steered[i] === 0; }).map(function (h) { return h.z; }), mean = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; };
          wheelbase = fz.length && rz.length ? mean(fz) - mean(rz) : Math.max.apply(null, zs) - Math.min.apply(null, zs);
          if (!(wheelbase > 1e-6)) wheelbase = 1;
        }
        const grip = dv(vh.grip, 6);
        const o = { model: model, max_steer: dv(vh.max_steer, 0.55), steer_rate: dv(vh.steer_rate, 8), wheelbase: wheelbase, top_speed: dv(vh.top_speed, 20), reverse: dv(vh.reverse, 0.4), accel: dv(vh.accel, 0.8 * grip),
          brake: dv(vh.brake, 1.6 * grip), grip: grip, roll: dv(vh.roll, 0.4), turn_rate: dv(vh.turn_rate, 1.5), steer_speed: dv(vh.steer_speed, 0), travel: dv(vh.travel, 0.15), follow: dv(vh.follow, 12), lean: dv(vh.lean, 1) };
        const num = function (name, v, lo, hi, lo_open) { wheel_num(tag + name, v, lo, hi, lo_open); };
        num("max_steer", o.max_steer, 0, 1.5, false); num("steer_rate", o.steer_rate, 0, 1e3, true); num("wheelbase", o.wheelbase, 1e-6, 1e5, true); num("top_speed", o.top_speed, 1e-6, 1e6, true);
        num("reverse", o.reverse, 0, 1.0000001, false); num("accel", o.accel, 0, 1e6, true); num("brake", o.brake, 0, 1e6, true); num("grip", o.grip, 0, 1e6, true); num("roll", o.roll, 0, 1e6, false);
        num("turn_rate", o.turn_rate, 0, 1e3, true); num("steer_speed", o.steer_speed, 0, 1e6, false); num("travel", o.travel, 0, 1e4, false); num("follow", o.follow, 0, 1e3, true); num("lean", o.lean, 0, 1.0000001, false);
        // THE ROLLOVER (world.cpp, SYSTEM.md "The rollover"): flip: { recover, width, height, cg }: recover (s) a wreck rights itself after that long (0, the default: it lies until sp.right); width (m) the body's whole width, height (m) its height,
        // cg (m) the height of its centre of gravity: each 0, the default, is worked out from the wheels (their outer edges) and the physics shapes of the root (the box they fill), the centre of gravity 0.4 of the way from the wheels' radius to the top
        let flip_tail = null;
        if (vh.flip !== undefined) {
          const fl = vh.flip;
          if (!fl || typeof fl !== "object" || Array.isArray(fl)) throw new Error(tag + "flip must be { recover, width, height, cg }");
          for (const k in fl) if (FLIP_FIELDS.indexOf(k) < 0) throw new Error(tag + "flip: unknown field '" + k + "' (" + FLIP_FIELDS.join(", ") + ")");
          const fr = dv(fl.recover, 0), fw = dv(fl.width, 0), fh = dv(fl.height, 0), fc = dv(fl.cg, 0);
          num("flip.recover", fr, 0, 1e6, false); num("flip.width", fw, 0, 2e5, false); num("flip.height", fh, 0, 1e5, false); num("flip.cg", fc, 0, 1e5, false);
          if (fh > 0 && fc > fh) throw new Error(tag + "flip.cg is the height of the centre of gravity: it cannot be over flip.height");
          flip_tail = [fr, fw * 0.5, fh, fc];
          o.flip = { recover: fr, width: fw, height: fh, cg: fc };
        }
        // THE REALISM (above): `realism` or `suspension` is true or its numbers; the section then carries the rollover's four words and the 64 of the dynamic model
        if (vh.realism !== undefined && vh.suspension !== undefined) throw new Error(tag + "`realism` and `suspension` are the same flag: give one");
        const rin = vh.realism !== undefined ? vh.realism : vh.suspension;
        let real = null;
        if (rin !== undefined && rin !== false && rin !== null) {
          const radii = vh.wheels.map(function (w, i) { return dv(w.radius, hubs[i].y); }), drives = vh.wheels.map(function (w) { return dv(w.drive, 1); });
          real = compile_realism(rin === true ? {} : rin, o, hubs, vh.wheels, physics && typeof physics === "object" && Number.isFinite(physics.mass) ? physics.mass : undefined, skid, radii, drives);
          o.real = real.real;
          if (!flip_tail) flip_tail = [0, 0, 0, 0];
        }
        const f1 = new Float32Array(1), u1 = new Uint32Array(f1.buffer), words = [(skid ? 1 : 0) | (real ? 2 : 0), vh.wheels.length], pushf = function (v) { f1[0] = v; words.push(u1[0]); };
        [o.max_steer, o.steer_rate, o.wheelbase, o.top_speed, o.reverse, o.accel, o.brake, o.grip, o.roll, o.turn_rate, o.steer_speed, o.travel, o.follow, o.lean].forEach(pushf);
        words.push(flip_tail ? (real ? 4 + REAL_WORDS : 4) : 0);
        o.wheels = vh.wheels.map(function (w, i) {
          const b = hubs[i].b, r = dv(w.radius, hubs[i].y), steer = steered[i], drive = dv(w.drive, 1), brake = dv(w.brake, 1), hand = dv(w.handbrake, skid ? 0 : (front[i] || hubs.length < 2 ? 0 : 1)), wgrip = dv(w.grip, 1);
          const tag_w = tag + "wheel " + i + ": ";
          wheel_num(tag_w + "radius", r, 1e-6, 1e5, true); wheel_num(tag_w + "steer", steer, -1, 1.0000001, false); wheel_num(tag_w + "drive", drive, 0, 1e6, false); wheel_num(tag_w + "brake", brake, 0, 1e6, false);
          wheel_num(tag_w + "handbrake", hand, 0, 1e6, false); wheel_num(tag_w + "grip", wgrip, 0, 1e6, true);
          const m = sk.bind, o3 = b * 12, up_in = function (bone) { return bone < 0 ? [0, 1, 0] : [m[bone * 12 + 4], m[bone * 12 + 5], m[bone * 12 + 6]]; };            // the model's up in a bone's own frame: the second row of its bind rotation
          words.push(b); pushf(hubs[i].x); pushf(hubs[i].y); pushf(hubs[i].z); pushf(r); pushf(steer); pushf(drive); pushf(brake); pushf(hand); pushf(wgrip);
          up_in(b).forEach(pushf); [m[o3], m[o3 + 1], m[o3 + 2]].forEach(pushf); up_in(sk.parent[b]).forEach(pushf);                                      // (the steering axis, the axle: the first row, the up of the parent)
          return { bone: sk.names[b], radius: r, steer: steer, drive: drive, brake: brake, handbrake: hand, grip: wgrip, hub: [hubs[i].x, hubs[i].y, hubs[i].z] };
        });
        if (flip_tail) flip_tail.forEach(pushf);
        if (real) real.words.forEach(pushf);
        return { words: Uint32Array.from(words), vehicle: o };
      }

      // def.wheels -> the words of the SEC_WHEELS section ({ words, wheels }); the ranges are the worker's (happy_wheels_build). A passive wheel is a free bone whose head is the wheel's centre at rest; it rolls about
      // `axle` (a model-space direction, +x unless it says another: the pose is a turn about it, worked out in the bone's own frame) while its hub touches the ground. The list of wheels, or { wheels, coast, lean }:
      // coast (s) is the time constant of the spin in the air, lean (0 .. 1) the share of the plane through the wheels that a chassis without legs and without a vehicle leans to
      const WHEELS_FIELDS = ["wheels", "coast", "lean"];
      const PASSIVE_WHEEL_FIELDS = ["bone", "radius", "axle"];
      function compile_wheels(wh, sk, rig, wings, vehicle) {
        const tag = "system: wheels: ";
        if (Array.isArray(wh)) wh = { wheels: wh };
        if (!wh || typeof wh !== "object") throw new Error("system: wheels must be a list of wheels or an object { wheels, coast, lean }");
        for (const k in wh) if (WHEELS_FIELDS.indexOf(k) < 0) throw new Error(tag + "unknown field '" + k + "' (" + WHEELS_FIELDS.join(", ") + ")");
        if (!Array.isArray(wh.wheels) || wh.wheels.length < 1 || wh.wheels.length > 8) throw new Error(tag + "wheels must be a list of 1 to 8 wheels");
        const dv = function (v, d) { return v === undefined ? d : v; }, o = { coast: dv(wh.coast, 1.5), lean: dv(wh.lean, 1) };
        wheel_num(tag + "coast", o.coast, 0, 1000, false); wheel_num(tag + "lean", o.lean, 0, 1.0000001, false);
        const own = bones_owned(rig, wings, vehicle, sk), f1 = new Float32Array(1), u1 = new Uint32Array(f1.buffer), words = [0, wh.wheels.length], pushf = function (v) { f1[0] = v; words.push(u1[0]); };
        pushf(o.coast); pushf(o.lean); words.push(0, 0, 0, 0);
        const used = new Set(), m = sk.bind;
        o.wheels = wh.wheels.map(function (w, i) {
          const what = "wheel " + i;
          if (!w || typeof w !== "object" || Array.isArray(w)) throw new Error(tag + what + " must be an object");
          for (const k in w) if (PASSIVE_WHEEL_FIELDS.indexOf(k) < 0) throw new Error(tag + what + ": unknown field '" + k + "' (" + PASSIVE_WHEEL_FIELDS.join(", ") + ")");
          const b = wheel_bone(tag, what, w.bone, sk, own);
          if (used.has(b)) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' is two wheels");
          used.add(b);
          const radius = dv(w.radius, m[b * 12 + 7]);
          wheel_num(tag + what + " radius", radius, 1e-6, 1e5, true);
          const ax = w.axle === undefined ? [1, 0, 0] : w.axle;
          if (!Array.isArray(ax) || ax.length !== 3 || !ax.every(Number.isFinite)) throw new Error(tag + what + ": axle must be [x, y, z]");
          const len = Math.hypot(ax[0], ax[1], ax[2]);
          if (!(len > 1e-9)) throw new Error(tag + what + ": axle has no length");
          const a = ax.map(function (x) { return x / len; }), o3 = b * 12, bone_frame = [0, 1, 2].map(function (j) { return m[o3 + j] * a[0] + m[o3 + 4 + j] * a[1] + m[o3 + 8 + j] * a[2]; });
          words.push(b); pushf(radius); bone_frame.forEach(pushf); words.push(0, 0, 0);
          return { bone: sk.names[b], radius: radius, axle: a };
        });
        return { words: Uint32Array.from(words), wheels: o };
      }

      // def.couplers -> { name: [x, y, z] }: points of the model where another instance's hitch meets this one (the worker is not told: a link says the points, CMD_HAPPY_LINK). `front` is where this creature is pulled
      // from, `rear` where it pulls another; they default to the ends of the creature along its axis (z), a third of the way up: its skeleton's here, its mesh's once there is one (couplers_of_mesh)
      function compile_couplers(cp, sk) {
        const out = {};
        let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (let b = 0; b < sk.n; b++) for (let k = 0; k < 2; k++) {
          const p = k ? sk.tail : sk.head;
          if (p[b * 3 + 1] < y0) y0 = p[b * 3 + 1]; if (p[b * 3 + 1] > y1) y1 = p[b * 3 + 1]; if (p[b * 3 + 2] < z0) z0 = p[b * 3 + 2]; if (p[b * 3 + 2] > z1) z1 = p[b * 3 + 2];
        }
        if ([y0, y1, z0, z1].every(Number.isFinite)) { const y = y0 + 0.35 * (y1 - y0); out.front = [0, y, z1]; out.rear = [0, y, z0]; }
        if (cp !== undefined && cp !== null) {
          if (typeof cp !== "object" || Array.isArray(cp)) throw new Error("system: couplers must be an object { name: [x, y, z] }");
          for (const k in cp) {
            const p = cp[k];
            if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite) || !p.every(function (v) { return Math.abs(v) < 1e5; })) throw new Error("system: couplers: '" + k + "' must be [x, y, z] (numbers under 100000)");
            out[k] = p.slice();
          }
        }
        return out;
      }
      // the default `front` and `rear` of a creature that has a mesh: the ends of the mesh along z (the ones the definition names itself stay)
      function couplers_of_mesh(couplers, named, positions) {
        if (!positions || positions.length < 3) return couplers;
        let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (let i = 0; i + 2 < positions.length; i += 3) { if (positions[i + 1] < y0) y0 = positions[i + 1]; if (positions[i + 1] > y1) y1 = positions[i + 1]; if (positions[i + 2] < z0) z0 = positions[i + 2]; if (positions[i + 2] > z1) z1 = positions[i + 2]; }
        if (![y0, y1, z0, z1].every(Number.isFinite)) return couplers;
        const y = y0 + 0.35 * (y1 - y0);
        if (!named || !named.front) couplers.front = [0, y, z1];
        if (!named || !named.rear) couplers.rear = [0, y, z0];
        return couplers;
      }
      system.compile_vehicle = compile_vehicle; system.compile_wheels = compile_wheels; system.compile_couplers = compile_couplers;

      // ========================================================================================================================
      // aircraft
      // ========================================================================================================================
// system.js, a part: aircraft and rotors: the compile of def.aircraft and def.rotors into the words the worker reads (world.cpp). The page's calls (fly, the climb wish and the stick are flight_api.js's) are not here.
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- aircraft and rotors -----------------------------------------------------------------------------------------------------------------------------
      // def.aircraft -> the words of the SEC_AIRCRAFT section ({ words, aircraft }); the ranges are the worker's (happy_aircraft_build). The airframe is authored with the numbers the creature system's cheap flight model is
      // derived from (stall speed, cruise speed, top speed, thrust: the wing loading and the parasitic drag follow from them) and the controls' rates; the control surfaces and the propellers are bones that turn about an axis
      // (the bone's own y axis unless `axis` says another, in model space: it is worked out in the bone's frame here, like a wheel's; a surface whose bone has a HINGE joint in the rig turns about the hinge unless it says
      // another axis, and the rig's limit stop holds it to the hinge's range). The landing gear is the vehicle's wheels: an aircraft needs a `vehicle` and a body with a gravity, and has no legs.
      const SEC_AIRCRAFT = 13, SEC_ROTOR = 14;
      const AIRCRAFT_FIELDS = ["stall_speed", "cruise_speed", "max_speed", "thrust", "engine_speed", "cl_alpha", "cl_max", "incidence", "rates", "max_bank", "max_pitch", "realism", "assists", "stability", "flaps", "rotation", "pivot", "servo_rate", "surfaces", "propellers"];
      const AC_CONTROLS = { aileron: 1, elevator: 2, rudder: 3, flap: 4 }, AC_GAIN = { aileron: 0.35, elevator: 0.4, rudder: 0.45, flap: 0.5 };
      // the bones that something already poses or holds: the rig's chains, the wings, a vehicle's wheels, the passive wheels, the aircraft's surfaces and propellers (and, in the same set, the bones that have a joint)
      function air_owned(rig, wings, vehicle, wheels, aircraft, sk) {
        const own = bones_owned(rig, wings, vehicle, sk);
        if (wheels) wheels.wheels.forEach(function (w) { own.taken.add(sk.index[w.bone]); });
        if (aircraft) { aircraft.surfaces.forEach(function (s) { own.taken.add(sk.index[s.bone]); }); aircraft.propellers.forEach(function (p) { own.taken.add(sk.index[p.bone]); }); }
        return own;
      }
      // a model-space axis in a bone's own frame: the bone's bind rotation has the bone's axes as its columns, so it is the rotation's transpose applied to the axis
      function axis_in_bone(tag, what, axis, sk, b) {
        if (!Array.isArray(axis) || axis.length !== 3 || !axis.every(Number.isFinite)) throw new Error(tag + what + ": axis must be [x, y, z]");
        const len = Math.hypot(axis[0], axis[1], axis[2]);
        if (!(len > 1e-9)) throw new Error(tag + what + ": axis has no length");
        const a = axis.map(function (x) { return x / len; }), m = sk.bind, o3 = b * 12;
        return [0, 1, 2].map(function (j) { return m[o3 + j] * a[0] + m[o3 + 4 + j] * a[1] + m[o3 + 8 + j] * a[2]; });
      }
      function compile_aircraft(ac, sk, rig, body, vehicle, wings, wheels) {
        if (!ac || typeof ac !== "object" || Array.isArray(ac)) throw new Error("system: aircraft must be an object");
        const tag = "system: aircraft: ";
        for (const k in ac) if (AIRCRAFT_FIELDS.indexOf(k) < 0) throw new Error(tag + "unknown field '" + k + "' (" + AIRCRAFT_FIELDS.join(", ") + ")");
        if (!body) throw new Error(tag + "needs a body (body: { gravity ... })");
        if (!(body.body.gravity > 0)) throw new Error(tag + "needs a body with a gravity (the g of the lift and of the thrust): body: { gravity: 9.8 }");
        if (!vehicle) throw new Error(tag + "needs a vehicle (vehicle: { wheels: [...] }): its wheels are the landing gear");
        const dv = function (v, d) { return v === undefined ? d : v; };
        if (ac.stall_speed === undefined) throw new Error(tag + "stall_speed is needed");
        const stall = ac.stall_speed, cruise = dv(ac.cruise_speed, 1.6 * stall), vmax = dv(ac.max_speed, 2 * cruise);
        const rt = ac.rates === undefined ? {} : ac.rates, rates = Array.isArray(rt) ? rt : [rt.roll, rt.pitch, rt.yaw];
        if (rates.length !== 3 || (typeof rt !== "object")) throw new Error(tag + "rates must be { roll, pitch, yaw } or [roll, pitch, yaw]");
        for (const k in (Array.isArray(rt) ? {} : rt)) if (["roll", "pitch", "yaw"].indexOf(k) < 0) throw new Error(tag + "rates: unknown field '" + k + "'");
        const as = ac.assists === undefined ? {} : ac.assists, fl = ac.flaps === undefined ? {} : ac.flaps;
        for (const k in as) if (["level", "stall"].indexOf(k) < 0) throw new Error(tag + "assists: unknown field '" + k + "'");
        for (const k in fl) if (["cl", "alpha", "drag"].indexOf(k) < 0) throw new Error(tag + "flaps: unknown field '" + k + "'");
        const o = { stall_speed: stall, cruise_speed: cruise, max_speed: vmax, thrust: dv(ac.thrust, 0.3), engine_speed: dv(ac.engine_speed, 3 * cruise), cl_alpha: dv(ac.cl_alpha, 5), cl_max: dv(ac.cl_max, 1.4), incidence: dv(ac.incidence, 0.035),
          rates: [dv(rates[0], 1.8), dv(rates[1], 1.0), dv(rates[2], 0.6)], max_bank: dv(ac.max_bank, 1.0), max_pitch: dv(ac.max_pitch, 0.5), realism: dv(ac.realism, 0.5), assists: { level: dv(as.level, 1), stall: dv(as.stall, 1) },
          stability: dv(ac.stability, 3), flaps: { cl: dv(fl.cl, 0.15), alpha: dv(fl.alpha, 0.095), drag: dv(fl.drag, 0.015) }, rotation: dv(ac.rotation, 0.25), pivot: dv(ac.pivot, 0), servo_rate: dv(ac.servo_rate, 4), notes: [] };
        const num = function (name, v, lo, hi, lo_open) { wheel_num(tag + name, v, lo, hi, lo_open); };
        num("stall_speed", o.stall_speed, 1e-6, 1e6, true); num("cruise_speed", o.cruise_speed, o.stall_speed, 1e6, false); num("max_speed", o.max_speed, o.cruise_speed, 1e6, false); num("thrust", o.thrust, 0, 1e3, true);
        num("engine_speed", o.engine_speed, 1e-6, 1e6, true); num("cl_alpha", o.cl_alpha, 0.1, 100, true); num("cl_max", o.cl_max, 0.1, 20, true); num("incidence", o.incidence, -0.5, 0.5, true);
        num("rates.roll", o.rates[0], 0, 100, true); num("rates.pitch", o.rates[1], 0, 100, true); num("rates.yaw", o.rates[2], 0, 100, true); num("max_bank", o.max_bank, 0, 1.5, true); num("max_pitch", o.max_pitch, 0, 1.5, true);
        num("realism", o.realism, 0, 1.0000001, false); num("assists.level", o.assists.level, 0, 100, false); num("assists.stall", o.assists.stall, 0, 100, false); num("stability", o.stability, 0, 1e3, false);
        num("flaps.cl", o.flaps.cl, 0, 10, false); num("flaps.alpha", o.flaps.alpha, -1, 1, true); num("flaps.drag", o.flaps.drag, 0, 10, false); num("rotation", o.rotation, 0, 1, false); num("pivot", o.pivot, -1e4, 1e4, true); num("servo_rate", o.servo_rate, 0, 1e3, true);
        const surfaces = ac.surfaces === undefined ? [] : ac.surfaces, props = ac.propellers === undefined ? [] : ac.propellers;
        if (!Array.isArray(surfaces) || surfaces.length > 8) throw new Error(tag + "surfaces must be a list of at most 8");
        if (!Array.isArray(props) || props.length > 4) throw new Error(tag + "propellers must be a list of at most 4");
        const own = air_owned(rig, wings, vehicle, wheels, null, sk), used = new Set(), joint_of = {};
        if (rig && rig.joints) rig.joints.forEach(function (j) { joint_of[j.bone] = j; });
        const bone_of = function (what, item) {
          const b = typeof item.bone === "number" ? item.bone : sk.index[item.bone];
          if (b === undefined || !(b >= 0 && b < sk.n) || b !== (b | 0)) throw new Error(tag + what + ": unknown bone '" + item.bone + "'");
          if (sk.parent[b] < 0) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' is the root: it carries the whole creature");
          if (own.taken.has(b)) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' is a wheel, a wing or in an ik chain");
          if (used.has(b)) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' is already used");
          used.add(b);
          return b;
        };
        const f1 = new Float32Array(1), u1 = new Uint32Array(f1.buffer), words = [0, surfaces.length, props.length], pushf = function (v) { f1[0] = v; words.push(u1[0]); };
        [o.stall_speed, o.cruise_speed, o.max_speed, o.thrust, o.engine_speed, o.cl_alpha, o.cl_max, o.incidence, o.rates[0], o.rates[1], o.rates[2], o.max_bank, o.max_pitch, o.realism, o.assists.level, o.assists.stall, o.stability,
          o.flaps.cl, o.flaps.alpha, o.flaps.drag, o.rotation, o.pivot, o.servo_rate].forEach(pushf);
        words.push(0);
        o.surfaces = surfaces.map(function (s, i) {
          const what = "surface " + i;
          if (!s || typeof s !== "object" || Array.isArray(s)) throw new Error(tag + what + " must be an object");
          for (const k in s) if (["bone", "control", "gain", "axis"].indexOf(k) < 0) throw new Error(tag + what + ": unknown field '" + k + "'");
          if (AC_CONTROLS[s.control] === undefined) throw new Error(tag + what + ": control must be 'aileron', 'elevator', 'rudder' or 'flap'");
          const b = bone_of(what, s), j = joint_of[b], gain = dv(s.gain, AC_GAIN[s.control]);
          // the hinge axis: the one said, else the joint's own (a surface on a hinge turns about it), else the bone's own y
          const hinge = j && j.kind === JOINT_KINDS.hinge;
          if (j && !hinge) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' has a joint that is not a hinge (a surface turns about one axis: its limit stop would hold it)");
          const ax = s.axis !== undefined ? axis_in_bone(tag, what, s.axis, sk, b) : (hinge ? j.axis.slice() : [0, 1, 0]);
          num(what + " gain", gain, -3.2, 3.2, true);
          if (hinge) {                                                                         // (the rig's limit stop holds the surface to the hinge: its axis is the hinge's and what it asks stays in the range, or a note says so)
            const d = ax[0] * j.axis[0] + ax[1] * j.axis[1] + ax[2] * j.axis[2];
            if (Math.abs(d) < 0.98) throw new Error(tag + what + ": its axis does not lie along the hinge of '" + sk.names[b] + "' (the joint holds a surface to one axis)");
            const turn = gain * (d > 0 ? 1 : -1), two_way = s.control !== "flap", lo = two_way ? -Math.abs(turn) : Math.min(turn, 0), hi = two_way ? Math.abs(turn) : Math.max(turn, 0);       // (a flap's command goes from 0 to 1, the others' from -1 to 1)
            if (hi > j.h_hi + 1e-6 || lo < j.h_lo - 1e-6) o.notes.push("system: aircraft: " + what + " ('" + sk.names[b] + "'): a gain of " + gain + " rad is past the hinge's range [" + (j.h_lo / DEG).toFixed(0) + ", " + (j.h_hi / DEG).toFixed(0) + "] degrees: the limit stop holds it there");
          }
          words.push(b, AC_CONTROLS[s.control]); pushf(gain); ax.forEach(pushf); words.push(0, 0);
          return { bone: sk.names[b], control: s.control, gain: gain, axis: ax };
        });
        o.propellers = props.map(function (p, i) {
          const what = "propeller " + i;
          if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error(tag + what + " must be an object");
          for (const k in p) if (["bone", "rpm", "idle", "axis"].indexOf(k) < 0) throw new Error(tag + what + ": unknown field '" + k + "'");
          if (p.rpm === undefined) throw new Error(tag + what + ": rpm is needed (rad / s at full throttle)");
          const b = bone_of(what, p), idle = dv(p.idle, 0.15);
          if (own.jointed.has(b)) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' has a joint in the rig (its limit stop would hold the propeller): the worker poses it, it has none");
          const ax = p.axis === undefined ? [0, 1, 0] : axis_in_bone(tag, what, p.axis, sk, b);
          num(what + " rpm", p.rpm, -1e5, 1e5, true); num(what + " idle", idle, 0, 1.0000001, false);
          words.push(b); pushf(p.rpm); pushf(idle); ax.forEach(pushf); words.push(0, 0);
          return { bone: sk.names[b], rpm: p.rpm, idle: idle, axis: ax };
        });
        return { words: Uint32Array.from(words), aircraft: o };
      }

      // def.rotors -> the words of the SEC_ROTOR section ({ words, rotors }); the ranges are the worker's (happy_rotor_build). A rotor is a bone that spins about its axis (the bone's own y axis unless `axis` says another, in model
      // space) while the instance flies: a main / prop rotor is governed to `omega` (spooling up with the time constant `spool`), a lift rotor follows the thrust the hover uses (never below `idle` of `omega`), a tail rotor is
      // geared to the rotor named by `master` (a bone name, an earlier rotor of the list) at `ratio`. A species with rotors needs a flight (the engine is on while it flies); a rotor's bone has no joint in the rig
      const ROTOR_FIELDS = ["bone", "role", "dir", "omega", "master", "ratio", "spool", "idle", "axis"];
      const ROTOR_ROLES = { main: 1, tail: 2, lift: 3, prop: 4 }, ROTOR_SPOOL = { main: 3, tail: 1, lift: 0.25, prop: 0.5 };
      function compile_rotors(rts, sk, rig, flight, wings, vehicle, wheels, aircraft) {
        const tag = "system: rotors: ";
        if (!Array.isArray(rts) || rts.length < 1 || rts.length > 8) throw new Error(tag + "rotors must be a list of 1 to 8 rotors");
        if (!flight) throw new Error(tag + "needs a flight (flight: { model: 'hover' ... }): the engine is on while the instance flies");
        const dv = function (v, d) { return v === undefined ? d : v; };
        const own = air_owned(rig, wings, vehicle, wheels, aircraft, sk);
        const f1 = new Float32Array(1), u1 = new Uint32Array(f1.buffer), words = [0, rts.length], pushf = function (v) { f1[0] = v; words.push(u1[0]); };
        const num = function (name, v, lo, hi, lo_open) { wheel_num(tag + name, v, lo, hi, lo_open); };
        const out = [], index_of = {};
        rts.forEach(function (r, i) {
          const what = "rotor " + i;
          if (!r || typeof r !== "object" || Array.isArray(r)) throw new Error(tag + what + " must be an object");
          for (const k in r) if (ROTOR_FIELDS.indexOf(k) < 0) throw new Error(tag + what + ": unknown field '" + k + "'");
          const b = typeof r.bone === "number" ? r.bone : sk.index[r.bone];
          if (b === undefined || !(b >= 0 && b < sk.n) || b !== (b | 0)) throw new Error(tag + what + ": unknown bone '" + r.bone + "'");
          if (sk.parent[b] < 0) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' is the root: it carries the whole creature");
          if (own.taken.has(b)) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' is already used (a wheel, a wing, a surface, a propeller, an ik chain or a rotor)");
          if (own.jointed.has(b)) throw new Error(tag + what + ": the bone '" + sk.names[b] + "' has a joint in the rig (its limit stop would hold the rotor): the worker poses it, it has none");
          own.taken.add(b);
          const role = dv(r.role, "main");
          if (ROTOR_ROLES[role] === undefined) throw new Error(tag + what + ": role must be 'main', 'tail', 'lift' or 'prop'");
          if (r.omega === undefined && role !== "tail") throw new Error(tag + what + ": omega is needed (rad / s)");
          let master = 0;
          if (r.master !== undefined) {
            master = index_of[typeof r.master === "number" ? sk.names[r.master] : r.master];
            if (master === undefined) throw new Error(tag + what + ": master '" + r.master + "' is not an earlier rotor of the list");
            master++;
          }
          if (role === "tail" && !master) throw new Error(tag + what + ": a tail rotor needs a master (the rotor it is geared to)");
          if (role !== "tail" && master) throw new Error(tag + what + ": only a tail rotor is geared (master)");
          if (master && out[master - 1].master) throw new Error(tag + what + ": its master is geared too");
          const o = { bone: sk.names[b], role: role, dir: dv(r.dir, 1), omega: r.omega === undefined ? out[master - 1].omega * dv(r.ratio, 1) : r.omega, master: master ? out[master - 1].bone : null, ratio: dv(r.ratio, 1), spool: dv(r.spool, ROTOR_SPOOL[role]), idle: dv(r.idle, role === "lift" ? 0.3 : 0) };
          if (o.dir !== 1 && o.dir !== -1) throw new Error(tag + what + ": dir must be 1 or -1");
          num(what + " omega", o.omega, 0, 1e5, true); num(what + " ratio", o.ratio, 0, 1e3, true); num(what + " spool", o.spool, 0, 1e3, true); num(what + " idle", o.idle, 0, 1.0000001, false);
          o.axis = r.axis === undefined ? [0, 1, 0] : axis_in_bone(tag, what, r.axis, sk, b);
          index_of[o.bone] = i;
          words.push(b, ROTOR_ROLES[role]); pushf(o.dir); pushf(o.omega); words.push(master); pushf(o.ratio); pushf(o.spool); pushf(o.idle); o.axis.forEach(pushf); words.push(0);
          out.push(o);
        });
        return { words: Uint32Array.from(words), rotors: out };
      }
      system.compile_aircraft = compile_aircraft; system.compile_rotors = compile_rotors;

      // ========================================================================================================================
      // ragdoll
      // ========================================================================================================================
// system.js, a part: the compile of the RAGDOLL section (world.cpp, SEC_RAGDOLL 15): what the worker needs to let a creature that dies FALL as a ragdoll of the physics engine's own bodies and joints. It is made from the SKELETON, the rig's
// joints and (when the species has a mesh) the SKIN, so every creature has it, whatever its shape (a person, a hound, a spider, a serpent, a bird, a tank): `ragdoll: false` leaves it out, and `ragdoll: { friction, restitution, density, settle,
// release, merge, cone }` changes its numbers (`release`: the seconds that a body lies asleep before its bodies and joints go back to the physics world, 10; 0 keeps them for ever).
//   the bones of the rig's CHAINS are bodies of their own (a capsule each), joined to the body above them by the rig's own joint (a ball with a cone and a twist, a hinge with a range): unless the bone is too short to matter (fingers, toes: it
//   rides on the bone above), or its joint is FIXED or hardly lets it move (`merge`, radians: a joint whose swing is under it is the body above);
//   every other bone is the TRUNK: one body with a capsule for each of its longer bones (the root of the model is that body's frame);
//   the bones that are neither (a face, fingers, a prop) ride on the body that carries them, as a small sphere at their heads and tails.
//   THICKNESS comes from the skin: a bone's radius is the median distance of the vertices that it owns (it is their strongest bone) from the bone's axis. A species with no skin has radii from the lengths of its bones (0.12 of the length, a trunk bone at least 0.05 of the creature).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system; blob.js puts the section in the blob, and species.js calls ragdoll_with_skin once the mesh is known (the
// section is compiled before the mesh is made). The page's calls (sp.ragdoll) are in ragdoll_api.js.
      // ---- the ragdoll's section ---------------------------------------------------------------------------------------------------------------------------
      const SEC_RAGDOLL = 15, RAGDOLL_VERSION = 3, RAGDOLL_HEAD = 16, RAGDOLL_FIELDS = ["friction", "restitution", "density", "settle", "release", "merge", "cone"], RAGDOLL_CONES = { wide: 0, tight: 1, mean: 2 }, RAGDOLL_MAX_TRUNK = 24, RAGDOLL_MAX_CHECKS = 32, RAGDOLL_MAX_FLEX = 48;
      // the radius of every bone from the skin: the median distance, from the bone's axis (head to tail), of the vertices whose strongest bone it is (and that it holds by half or more), 0 for a bone that owns fewer than four.
      // mesh = { positions, skin_indices, skin_weights, skin_count? } in the model's space of the bind pose. -> Float32Array(n) | null (no skin)
      function ragdoll_radii(sk, mesh) {
        if (!mesh || !mesh.positions || !mesh.skin_indices || !mesh.skin_weights) return null;
        const P = mesh.positions, SI = mesh.skin_indices, SW = mesh.skin_weights, k = mesh.skin_count === undefined ? 4 : mesh.skin_count, nv = Math.floor(P.length / 3), n = sk.n;
        if (!(k >= 1 && k <= 4) || SI.length !== nv * k || SW.length !== nv * k) return null;
        const own = [];
        for (let b = 0; b < n; b++) own.push([]);
        for (let v = 0; v < nv; v++) {
          let best = -1, bw = 0, sum = 0;
          for (let j = 0; j < k; j++) { const w = SW[v * k + j]; sum += w > 0 ? w : 0; if (w > bw) { bw = w; best = j; } }
          if (best < 0 || !(bw >= 0.5 * sum)) continue;                                                       // (a vertex that no bone holds by half is a blend: it says nothing of a bone's thickness)
          const b = SI[v * k + best];
          if (!(b >= 0 && b < n) || !(sk.length[b] > 1.0e-4)) continue;
          const hx = sk.head[b * 3], hy = sk.head[b * 3 + 1], hz = sk.head[b * 3 + 2], dx = sk.tail[b * 3] - hx, dy = sk.tail[b * 3 + 1] - hy, dz = sk.tail[b * 3 + 2] - hz, l2 = dx * dx + dy * dy + dz * dz;
          const px = P[v * 3] - hx, py = P[v * 3 + 1] - hy, pz = P[v * 3 + 2] - hz;
          const t = (px * dx + py * dy + pz * dz) / l2;
          if (t < -0.25 || t > 1.25) continue;                                                                // (past the bone's ends: the skin of the joint, not of the bone)
          const c = t < 0 ? 0 : (t > 1 ? 1 : t), ex = px - dx * c, ey = py - dy * c, ez = pz - dz * c;
          own[b].push(Math.sqrt(ex * ex + ey * ey + ez * ez));
        }
        const out = new Float32Array(n);
        for (let b = 0; b < n; b++) { const a = own[b]; if (a.length < 4) continue; a.sort(function (x, y) { return x - y; }); out[b] = a[a.length >> 1]; }
        return out;
      }
      // -> { words, ragdoll } or null (`ragdoll: false`, or a skeleton with nothing in it)
      function compile_ragdoll(sk, rig, legs, life, opt, radii) {
        if (opt === false) return null;
        if (opt !== undefined && opt !== true && (opt === null || typeof opt !== "object" || Array.isArray(opt))) throw new Error("system: ragdoll must be false, true or { friction, restitution, density, settle, release, merge, cone }");
        const o = opt && opt !== true ? opt : {};
        for (const k in o) if (RAGDOLL_FIELDS.indexOf(k) < 0) throw new Error("system: ragdoll: unknown field '" + k + "' (" + RAGDOLL_FIELDS.join(", ") + ")");
        const n = sk.n;
        if (!(n >= 1)) return null;
        const friction = o.friction === undefined ? 0.6 : o.friction, restitution = o.restitution === undefined ? 0 : o.restitution, density = o.density === undefined ? 1000 : o.density, settle = o.settle === undefined ? 0.6 : o.settle, release = o.release === undefined ? 10 : o.release, merge = o.merge === undefined ? 0.3 : o.merge, cone = o.cone === undefined ? "tight" : o.cone;
        if (!(friction >= 0 && friction <= 10) || !(restitution >= 0 && restitution <= 1) || !(density > 0 && density < 1.0e5) || !(settle > 0 && settle < 60) || !(release >= 0 && release < 1.0e5) || !(merge >= 0 && merge <= 3)) throw new Error("system: ragdoll: friction 0 .. 10, restitution 0 .. 1, density > 0 (kg a cubic metre), settle 0 .. 60 s, release 0 .. 100000 s, merge 0 .. 3 rad");
        if (RAGDOLL_CONES[cone] === undefined) throw new Error("system: ragdoll: cone is 'tight' (the tightest side of a ball joint's ellipse: the default), 'mean' or 'wide' (" + cone + ")");
        const hv = function (b) { return [sk.head[b * 3], sk.head[b * 3 + 1], sk.head[b * 3 + 2]]; }, tv = function (b) { return [sk.tail[b * 3], sk.tail[b * 3 + 1], sk.tail[b * 3 + 2]]; };
        const dist = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };
        // ---- the size of the creature: the largest side of the box that the bones fill
        const lo = [1e30, 1e30, 1e30], hi = [-1e30, -1e30, -1e30];
        for (let b = 0; b < n; b++) [hv(b), tv(b)].forEach(function (p) { for (let k = 0; k < 3; k++) { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; } });
        const size = Math.max(1.0e-3, hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
        // ---- which bones are bodies: the bones of the rig's chains (and a chain's tip bone) that are long enough to matter and whose joint lets them move: not FIXED, and not a joint that swings (or, for a hinge, turns) by `merge` radians or less
        const joint = {};
        if (rig && rig.joints) rig.joints.forEach(function (j) { joint[j.bone] = j; });
        const rigid = function (b) {
          const j = joint[b];
          if (!j) return false;
          if (j.kind === 3) return true;
          if (j.kind === 1) return Math.max(j.px, j.nx, j.pz, j.nz) <= merge;
          if (j.kind === 2) return Math.max(Math.abs(j.h_lo), Math.abs(j.h_hi)) <= merge;
          return false;
        };
        const flex = new Uint8Array(n);
        let nflex = 0;
        if (rig && rig.chains) rig.chains.forEach(function (c) {
          c.bones.concat(c.tip >= 0 ? [c.tip] : []).forEach(function (b) { if (b >= 0 && b < n && !flex[b] && sk.length[b] >= 0.04 * size && !rigid(b) && nflex < RAGDOLL_MAX_FLEX) { flex[b] = 1; nflex++; } });
        });
        // the order (parents first); a bone that has a body above it (it rides on it); a bone that the forward kinematics of the ragdoll must pass (a body's bone and every bone above it)
        const order = sk.order, under = new Uint8Array(n), need = new Uint8Array(n);
        for (let i = 0; i < n; i++) { const b = order[i], p = sk.parent[b]; under[b] = p >= 0 && (flex[p] || under[p]) ? 1 : 0; }
        for (let i = n - 1; i >= 0; i--) { const b = order[i], p = sk.parent[b]; if (flex[b]) need[b] = 1; if (need[b] && p >= 0) need[p] = 1; }
        const fk = [], fk_of = new Int32Array(n).fill(-1);
        for (let i = 0; i < n; i++) { const b = order[i]; if (need[b]) { fk_of[b] = fk.length; fk.push(b); } }
        // ---- the thickness of a bone: from the skin, else from its length; held to what a capsule of that bone can be (a limb's no more than four fifths of its length, a trunk bone's no more than a third of the creature)
        const rad = function (b, trunk) {
          const L = sk.length[b];
          let r = radii && radii[b] > 0 ? radii[b] : (trunk ? Math.max(0.12 * L, 0.05 * size) : 0.12 * L);              // (no skin: a limb is a tenth of its length thick, a trunk bone at least a twentieth of the creature: a body of a hundredth of its neighbours' mass has no joint that holds it)
          r = Math.max(r, 0.01 * size);
          return trunk ? Math.min(r, 0.33 * size) : Math.min(r, Math.max(0.8 * L, 0.01 * size));
        };
        // ---- the trunk: the bones that are not bodies and ride on no body (every bone, for a creature with no chains): the longest of them (RAGDOLL_MAX_TRUNK), each a capsule of the one body
        const tb = [];
        for (let i = 0; i < n; i++) { const b = order[i]; if (!flex[b] && !under[b] && sk.length[b] > 0.02 * size) tb.push(b); }
        tb.sort(function (a, b) { return sk.length[b] - sk.length[a]; });
        if (tb.length > RAGDOLL_MAX_TRUNK) tb.length = RAGDOLL_MAX_TRUNK;
        // ---- the bones that only ride: a small sphere at the head, and at the tail when it has no child, of each, on the body that carries it (a body's bone, else the trunk)
        const checks = [], seen = [];
        const near_seen = function (p) { for (let i = 0; i < seen.length; i++) if (dist(seen[i], p) < 0.004 * size) return true; return false; };
        const sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; };
        const chk = function (b, p) {
          if (flex[b] || near_seen(p)) return;
          seen.push(p);
          let a = -1;
          if (under[b]) { a = sk.parent[b]; while (a >= 0 && !flex[a]) a = sk.parent[a]; }
          const r = Math.max(0.5 * rad(b, false), 0.004 * size);
          if (a >= 0) checks.push([fk_of[a], sub(p, hv(a)), r]); else checks.push([0xffff, p, r]);
        };
        for (let i = 0; i < n; i++) { const b = order[i]; if (flex[b]) continue; chk(b, hv(b)); if (!sk.children[b] || !sk.children[b].length) chk(b, tv(b)); }
        if (checks.length > RAGDOLL_MAX_CHECKS) { const keep = [], step = checks.length / RAGDOLL_MAX_CHECKS; for (let i = 0; i < RAGDOLL_MAX_CHECKS; i++) keep.push(checks[Math.floor(i * step)]); checks.length = 0; keep.forEach(function (c) { checks.push(c); }); }
        // ---- the words
        const f1 = new Float32Array(1), u1 = new Uint32Array(f1.buffer), words = [RAGDOLL_VERSION, RAGDOLL_CONES[cone], tb.length, fk.length, nflex, checks.length, 0, 0], pushf = function (v) { f1[0] = v; words.push(u1[0]); };
        [friction, restitution, density, settle, size, release, 0, 0].forEach(pushf);
        tb.forEach(function (b) { words.push(b); pushf(rad(b, true)); });
        fk.forEach(function (b) { words.push(b, flex[b] ? 1 : 0); pushf(flex[b] ? rad(b, false) : 0); });
        checks.forEach(function (c) { words.push(c[0]); c[1].forEach(pushf); pushf(c[2]); });
        if (words.length !== RAGDOLL_HEAD + tb.length * 2 + fk.length * 3 + checks.length * 5) throw new Error("system: ragdoll: the section has " + words.length + " words");
        return { words: Uint32Array.from(words), ragdoll: { trunk: tb.length, flexible: nflex, checks: checks.length, size: size, bones: fk.length, skin: !!radii } };
      }
      // the section again, with the thickness of the skin: the section is compiled before the species' mesh is made, so species.js calls this when it has it. comp is what compile() returned (its words and ragdoll are replaced)
      function ragdoll_with_skin(comp, input, mesh) {
        if (!comp.ragdoll) return;
        const radii = ragdoll_radii(comp.sk, mesh);
        if (!radii) return;
        const rd = compile_ragdoll(comp.sk, comp.rig, comp.legs, comp.life, input.ragdoll, radii);
        if (!rd) return;
        const w = comp.words;
        let k = 8, at = -1, len = 0;
        for (let s = 0; s < w[3]; s++) { if (w[k] === SEC_RAGDOLL) { at = k; len = w[k + 1]; } k += 2 + w[k + 1]; }
        if (at < 0) return;
        const out = new Uint32Array(w.length - len + rd.words.length);
        out.set(w.subarray(0, at + 1), 0); out[at + 1] = rd.words.length; out.set(rd.words, at + 2); out.set(w.subarray(at + 2 + len), at + 2 + rd.words.length);
        out[2] = out.length;
        comp.words = out; comp.ragdoll = rd.ragdoll;
      }
      system.compile_ragdoll = compile_ragdoll;
      system.ragdoll_radii = ragdoll_radii;
      system.ragdoll_with_skin = ragdoll_with_skin;

      // ========================================================================================================================
      // hit
      // ========================================================================================================================
// system.js, a part: the compile of the HIT section (world.cpp, SEC_HIT 16): the HIT ZONES of a creature, what a shot or a blast can find of it and what it does to the body. An ORGANIC creature asks for it with `hit` in its
// definition (a machine, an aircraft, a creature that only takes damage does not: it has no section and costs nothing); `hit: false`, `hit: { realism: 0 }` or no `hit` at all leave it out.
//   hit: true | { realism, mass, strength, gain, brace, spine, heal, zones: { torso, head, pelvis, arm, leg, tail: { hp, mult, armor } } }
//     realism    1 (the default) SHOCK: the place that was hit takes it, the legs hold some, the body moves by the rest; 2 adds the LIMBS: a leg or an arm whose zone has lost health is a DUMB APPENDAGE by its ALPHA (0 the gait's,
//                1 passive; the share of the zone's health that is lost): the foot trails, the top speed falls, the hips ride lower and go over the legs that carry, an arm hangs loose and lets go of what it holds; 3 bleeding (later; the knockdown is `fall`, below). 0 is no section.
//     fall, stumble, getup   THE FALL (on by default for a creature that has legs, `fall: false` leaves it out; one in flight or in a seat is never brought down): a shove of more than `stumble` m/s (1.5 x brace: 1.5 for two legs, a hit on a leg buckles it at 0.6 of it) brings the creature DOWN as a ragdoll with the speed
//                the shove gave it, it is not slid along the floor (a hurt leg alone does not bring it down: it is a disabled leg, the limp and the posture); it lies `getup` seconds (3; 0: until the page stands it,
//                sp.ragdoll(c, false)) and stands. system.on_fall(sp, c, state, cause), sp.fallen(c)
//     heal       health a second that every zone gets back (0: none: a limb stays as it is until CMD_HAPPY_HEAL, sp.heal); the limbs' alpha eases back with it
//     mass       kg at scale 1 (the default is 14 kg a cubic unit of the creature's size: a person of 1.8 is about 80); strength: how much of an impulse the body takes (a share of the mass it answers with: 1; 2 is a creature that
//                takes half the shock); gain: how big a shock the page sees for an impulse (6: a bullet's momentum is small, a game wants it to show)
//     spine, brace   THE ORDER OF THE SHOCK, in m/s of shove (what mass, strength and gain make of an impulse): the SPINE takes it first, up to `spine` (1.6: a lean of 0.8 radians; 0 and the trunk takes none), the LEGS hold `brace` of
//                what is left (the stance: 1 for two legs, 1.6 for three to five, 2.2 for six or more, 0.5 for none), and only the rest shoves the whole body
//     zones      per kind of zone: hp (health of the zone), mult (what a hit on it is worth: a head 2.5, a limb 0.6), armor (the share a hit loses, 0 .. 0.95)
//   THE ZONES come from the creature's own parts: the head and neck (role head, neck), the torso (spine, chest and whatever no other zone owns), the pelvis (hips), one for each arm and each leg (the chains of `roles.arms` and
//   `legs`), the tail. A bone belongs to the zone of the nearest bone above it that has one (a foot is of its leg, an ear of the head). Each bone that is long enough is a CAPSULE on its own axis (the bone's local y), as thick as
//   the skin (body.js, ragdoll_radii) or, with no skin, a tenth of its length: the hit test is a ray against those, posed by the skeleton as it is drawn. At most 32 capsules (the longest bones) and 16 zones.
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system; blob.js puts the section in the blob, species.js calls hit_with_skin once the mesh is known.
// The words (u32, floats are the same words reinterpreted):
//   [0] version (2)  [1] realism  [2] nz zones  [3] nc capsules  [4] heal (float)  [5] brace (float)  [6] spine (float)  [7] 0   floats [8] mass  [9] strength  [10] gain  [11] size (the largest side of the bones' box)  [12 13 14] the middle of the creature's bones
//   (model space)  [15] the radius of the sphere about it that holds every capsule  [16] stumble (float, m/s of shove it steps out of; 0: it never falls)  [17] getup (float, seconds it lies; 0: until the page stands it)
//   then nz x 8: [0] type (0 torso, 1 head, 2 pelvis, 3 arm, 4 leg, 5 tail)  [1] which (the arm's or the leg's number)  [2] the kick (0 the spine's: a hit above the hips, 1 the hips')  [3] hp  [4] mult  [5] armor  [6] the rig's chain of a
//   limb (0xffff: none)  [7] the side (0 the middle, 1 the creature's left, 2 its right)
//   then nc x 6: [0] zone  [1] bone  [2] y0  [3] y1 (along the bone's axis, from its head, model units)  [4] radius  [5] 0
      const SEC_HIT = 16, HIT_VERSION = 2, HIT_HEAD = 18, HIT_ZONE_WORDS = 8, HIT_CAP_WORDS = 6, HIT_MAX_ZONES = 16, HIT_MAX_CAPS = 32;
      const HIT_TORSO = 0, HIT_HEAD_Z = 1, HIT_PELVIS = 2, HIT_ARM = 3, HIT_LEG = 4, HIT_TAIL = 5;
      const HIT_KINDS = ["torso", "head", "pelvis", "arm", "leg", "tail"];
      const HIT_ZONE_DEFAULT = { torso: { hp: 100, mult: 1, armor: 0 }, head: { hp: 40, mult: 2.5, armor: 0 }, pelvis: { hp: 80, mult: 1, armor: 0 }, arm: { hp: 40, mult: 0.6, armor: 0 }, leg: { hp: 60, mult: 0.6, armor: 0 }, tail: { hp: 30, mult: 0.3, armor: 0 } };
      const HIT_FIELDS = ["realism", "mass", "strength", "gain", "brace", "spine", "heal", "fall", "stumble", "getup", "zones"], HIT_ZONE_FIELDS = ["hp", "mult", "armor"];
      // -> { words, hit } or null (no `hit`, `hit: false`, `realism: 0`). `radii`: ragdoll_radii(sk, mesh) or null
      function compile_hit(sk, rig, legs, life, opt, radii) {
        if (opt === undefined || opt === null || opt === false) return null;
        if (opt !== true && (typeof opt !== "object" || Array.isArray(opt))) throw new Error("system: hit must be false, true or { realism, mass, strength, gain, zones }");
        const o = opt === true ? {} : opt;
        for (const k in o) if (HIT_FIELDS.indexOf(k) < 0) throw new Error("system: hit: unknown field '" + k + "' (" + HIT_FIELDS.join(", ") + ")");
        const realism = o.realism === undefined ? 1 : o.realism;
        if (realism !== 0 && realism !== 1 && realism !== 2 && realism !== 3) throw new Error("system: hit: realism is 0 (no hit zones), 1 (shock), 2 (limbs) or 3 (bleeding and knockdown) (" + realism + ")");
        if (realism === 0) return null;
        const n = sk.n;
        if (!(n >= 1)) return null;
        const hv = function (b) { return [sk.head[b * 3], sk.head[b * 3 + 1], sk.head[b * 3 + 2]]; }, tv = function (b) { return [sk.tail[b * 3], sk.tail[b * 3 + 1], sk.tail[b * 3 + 2]]; };
        // ---- the size of the creature: the box of its bones
        const lo = [1e30, 1e30, 1e30], hi = [-1e30, -1e30, -1e30];
        for (let b = 0; b < n; b++) [hv(b), tv(b)].forEach(function (p) { for (let k = 0; k < 3; k++) { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; } });
        const size = Math.max(1.0e-3, hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
        const mass = o.mass === undefined ? 14 * size * size * size : o.mass, strength = o.strength === undefined ? 1 : o.strength, gain = o.gain === undefined ? 6 : o.gain;
        if (!(mass > 0 && mass < 1.0e7) || !(strength >= 0.05 && strength <= 100) || !(gain >= 0 && gain <= 1000)) throw new Error("system: hit: mass 0 .. 1e7 kg, strength 0.05 .. 100, gain 0 .. 1000");
        const nlegs = legs && legs.legs ? legs.legs.length : 0, brace = o.brace === undefined ? (nlegs >= 6 ? 2.2 : (nlegs >= 3 ? 1.6 : (nlegs >= 1 ? 1.0 : 0.5))) : o.brace, spine = o.spine === undefined ? 1.6 : o.spine;
        if (!(brace >= 0 && brace <= 100) || !(spine >= 0 && spine <= 100)) throw new Error("system: hit: brace and spine are m/s of shock, 0 .. 100");
        const heal = o.heal === undefined ? 0 : o.heal;
        // THE FALL: a shove the legs cannot answer with a step (`stumble`, m/s: 1.5 x the brace unless said) brings the creature down as a ragdoll (a hurt leg does not: it is disabled and the posture follows); it lies `getup` seconds (3; 0: until the page stands it)
        if (o.fall !== undefined && typeof o.fall !== "boolean") throw new Error("system: hit: fall is true or false (" + o.fall + ")");
        const fall = o.fall === undefined ? nlegs >= 1 : o.fall, stumble = fall ? (o.stumble === undefined ? 1.5 * brace : o.stumble) : 0, getup = o.getup === undefined ? 3 : o.getup;
        if (!(stumble >= 0 && stumble <= 1000) || !(getup >= 0 && getup <= 1.0e5)) throw new Error("system: hit: stumble is m/s of shove (0 .. 1000) and getup seconds (0 .. 100000)");
        if (!(heal >= 0 && heal <= 1.0e5)) throw new Error("system: hit: heal is the health a second that a zone gets back, 0 .. 100000");
        // ---- the numbers of the zones: the defaults, what the definition says for a kind
        const zin = o.zones === undefined ? {} : o.zones;
        if (zin === null || typeof zin !== "object" || Array.isArray(zin)) throw new Error("system: hit: zones is { torso, head, pelvis, arm, leg, tail: { hp, mult, armor } }");
        for (const k in zin) {
          if (HIT_KINDS.indexOf(k) < 0) throw new Error("system: hit: zones: unknown kind '" + k + "' (" + HIT_KINDS.join(", ") + ")");
          if (zin[k] === null || typeof zin[k] !== "object" || Array.isArray(zin[k])) throw new Error("system: hit: zones." + k + " is { hp, mult, armor }");
          for (const f in zin[k]) if (HIT_ZONE_FIELDS.indexOf(f) < 0) throw new Error("system: hit: zones." + k + ": unknown field '" + f + "' (" + HIT_ZONE_FIELDS.join(", ") + ")");
        }
        const znum = function (kind) {
          const d = HIT_ZONE_DEFAULT[kind], g = zin[kind] || {}, r = { hp: g.hp === undefined ? d.hp : g.hp, mult: g.mult === undefined ? d.mult : g.mult, armor: g.armor === undefined ? d.armor : g.armor };
          if (!(r.hp > 0 && r.hp < 1.0e6) || !(r.mult >= 0 && r.mult <= 100) || !(r.armor >= 0 && r.armor <= 0.95)) throw new Error("system: hit: zones." + kind + ": hp > 0, mult 0 .. 100, armor 0 .. 0.95");
          return r;
        };
        // ---- which zone every bone is of: the limbs' chains, then the roles, then the nearest bone above that has one
        const zone = new Int32Array(n).fill(-1), recs = [];                                                       // recs: [type, which, kick, chain]
        const add_zone = function (type, which, kick, chain, side) { recs.push([type, which, kick, chain, side === undefined ? 0 : (side > 0 ? 1 : (side < 0 ? 2 : 0))]); return recs.length - 1; };      // (side: +1 the creature's left (+x), -1 its right: a limb's)
        const bone_of_slot = function (slot) { return life && life.bones && slot >= 0 && slot < life.bones.length ? life.bones[slot] : -1; };
        const lr = life && life.roles ? life.roles : null;
        const set = function (b, z, force) { if (b >= 0 && b < n && (force || zone[b] < 0)) zone[b] = z; };
        const zt = lr ? add_zone(HIT_TORSO, 0, 0, 0xffff) : -1;
        const zh = lr && (lr.head >= 0 || (lr.neck && lr.neck.length)) ? add_zone(HIT_HEAD_Z, 0, 0, 0xffff) : -1;
        const zp = lr && lr.hips >= 0 ? add_zone(HIT_PELVIS, 0, 1, 0xffff) : -1;
        const zt2 = zt >= 0 ? zt : add_zone(HIT_TORSO, 0, 0, 0xffff);
        if (lr) {
          if (zp >= 0) set(bone_of_slot(lr.hips), zp, true);
          (lr.spine || []).forEach(function (s) { set(bone_of_slot(s), zt2, true); });
          if (lr.chest >= 0) set(bone_of_slot(lr.chest), zt2, true);
          if (zh >= 0) { set(bone_of_slot(lr.head), zh, true); (lr.neck || []).forEach(function (s) { set(bone_of_slot(s), zh, true); }); }
        }
        let ztail = -1;
        if (lr && lr.tail && lr.tail.length) { ztail = add_zone(HIT_TAIL, 0, 1, 0xffff); lr.tail.forEach(function (s) { set(bone_of_slot(s), ztail, true); }); }
        const chain_bones = function (ci) { const c = rig && rig.chains ? rig.chains[ci] : null; return c ? c.bones.concat(c.tip >= 0 ? [c.tip] : []) : []; };
        const leg_list = legs && legs.legs ? legs.legs : [];
        const hip_z = leg_list.map(function (l) { return l.hip ? l.hip[2] : 0; }), mid_z = hip_z.length ? (Math.max.apply(null, hip_z) + Math.min.apply(null, hip_z)) / 2 : 0;
        (life && life.arms ? life.arms : []).forEach(function (a, j) {
          const z = add_zone(HIT_ARM, j, 0, a.chain, a.side);
          chain_bones(a.chain).forEach(function (b) { set(b, z, false); });                                  // (an arm's chain may start at the spine: the roles' bones are the torso's already)
          if (a.clavicle) set(sk.index[a.clavicle], z, false);
        });
        leg_list.forEach(function (l, i) {
          const front = leg_list.length >= 4 && hip_z[i] > mid_z + 1e-6;                                          // (the forelegs of a quadruped are hit like its chest, a biped's legs like its hips)
          const z = add_zone(HIT_LEG, i, front ? 0 : 1, l.chain, l.side);
          chain_bones(l.chain).forEach(function (b) { set(b, z, false); });
        });
        for (let i = 0; i < n; i++) { const b = sk.order[i], p = sk.parent[b]; if (zone[b] < 0) zone[b] = p >= 0 && zone[p] >= 0 ? zone[p] : zt2; }
        // ---- the capsules: the longer bones, the longest first, the thickness of the skin
        const rad = function (b) {
          const L = sk.length[b];
          let r = radii && radii[b] > 0 ? radii[b] : 0.12 * L;
          r = Math.max(r, 0.01 * size);
          return Math.min(r, 0.4 * size);
        };
        let cand = [];
        for (let b = 0; b < n; b++) if (sk.length[b] > 0.02 * size) cand.push(b);
        cand.sort(function (a, b) { return sk.length[b] - sk.length[a] || a - b; });
        if (cand.length > HIT_MAX_CAPS) cand.length = HIT_MAX_CAPS;
        cand.sort(function (a, b) { return a - b; });
        // a zone with no capsule is no zone: the others are numbered again
        const used = new Int32Array(recs.length).fill(-1), zlist = [];
        cand.forEach(function (b) { const z = zone[b]; if (used[z] < 0) { used[z] = zlist.length; zlist.push(z); } });
        if (zlist.length > HIT_MAX_ZONES) throw new Error("system: hit: " + zlist.length + " zones (at most " + HIT_MAX_ZONES + ")");
        if (!cand.length) return null;
        const kinds = zlist.map(function (z) { return recs[z][0]; });
        // ---- the words
        const f1 = new Float32Array(1), u1 = new Uint32Array(f1.buffer), words = [HIT_VERSION, realism, zlist.length, cand.length, 0, 0, 0, 0], pushf = function (v) { f1[0] = v; words.push(u1[0]); };
        const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
        let rmax = 0;
        cand.forEach(function (b) { [hv(b), tv(b)].forEach(function (p) { rmax = Math.max(rmax, Math.hypot(p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]) + rad(b)); }); });
        f1[0] = brace; words[5] = u1[0]; f1[0] = spine; words[6] = u1[0]; f1[0] = heal; words[4] = u1[0];
        [mass, strength, gain, size, mid[0], mid[1], mid[2], rmax * 1.02, stumble, getup].forEach(pushf);
        zlist.forEach(function (z) {
          const r = recs[z], nums = znum(HIT_KINDS[r[0]]);
          words.push(r[0], r[1], r[2]); pushf(nums.hp); pushf(nums.mult); pushf(nums.armor); words.push(r[3], r[4]);
        });
        cand.forEach(function (b) { words.push(used[zone[b]], b); pushf(0); pushf(sk.length[b]); pushf(rad(b)); words.push(0); });
        if (words.length !== HIT_HEAD + zlist.length * HIT_ZONE_WORDS + cand.length * HIT_CAP_WORDS) throw new Error("system: hit: the section has " + words.length + " words");
        const zones = zlist.map(function (z, k) { const r = recs[z]; return { kind: HIT_KINDS[r[0]], which: r[1], kick: r[2] === 0 ? "upper" : "lower", side: r[4] === 1 ? "left" : (r[4] === 2 ? "right" : null), chain: r[3] === 0xffff ? -1 : r[3], capsules: cand.filter(function (b) { return used[zone[b]] === k; }).map(function (b) { return sk.names[b]; }) }; });
        return { words: Uint32Array.from(words), hit: { realism: realism, mass: mass, strength: strength, gain: gain, brace: brace, spine: spine, heal: heal, fall: fall, stumble: stumble, getup: getup, size: size, zones: zones, capsules: cand.length, skin: !!radii, center: mid, radius: rmax * 1.02 } };
      }
      // the section again, with the thickness of the skin (compiled before the species' mesh is made, so species.js calls this when it has it). comp is what compile() returned
      function hit_with_skin(comp, input, mesh) {
        if (!comp.hit) return;
        const radii = ragdoll_radii(comp.sk, mesh);
        if (!radii) return;
        const h = compile_hit(comp.sk, comp.rig, comp.legs, comp.life, input.hit, radii);
        if (!h) return;
        const w = comp.words;
        let k = 8, at = -1, len = 0;
        for (let s = 0; s < w[3]; s++) { if (w[k] === SEC_HIT) { at = k; len = w[k + 1]; } k += 2 + w[k + 1]; }
        if (at < 0) return;
        const out = new Uint32Array(w.length - len + h.words.length);
        out.set(w.subarray(0, at + 1), 0); out[at + 1] = h.words.length; out.set(h.words, at + 2); out.set(w.subarray(at + 2 + len), at + 2 + h.words.length);
        out[2] = out.length;
        comp.words = out; comp.hit = h.hit;
      }
      system.compile_hit = compile_hit;
      system.hit_with_skin = hit_with_skin;

      // ========================================================================================================================
      // shapes
      // ========================================================================================================================
// system.js, a part: the physics proxy: the grammar of the collision shapes, the fit, the words (SYSTEM.md, the physics world). Ported from system 2.0 (body.js) onto the restart's parts.
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js (it comes before the blob: compile asks it for the SEC_PHYS section).
      // ---- the physics proxy: the creature in the physics world (world.cpp) ---------------------------------------------------------------------------------------------------------------
      // def.physics -> the words of the SEC_PHYS section ({ words, physics }); the ranges are the worker's (happy_phys_build). The roots of the instances are closed form (the terrain and the props are RAYS), so a creature is no
      // body of the physics world: a crate that is thrown at one would go through it. A species with `physics` gives every NEAR instance with a mode a PROXY: one rigid body with the species' SHAPES (spheres, boxes and
      // capsules, each on a bone), put at the creature in every frame. Where the shapes come from, in this order:
      //   1. `shapes`: declared in the definition, written like the sdf's colliders (sphere / box / capsule, center, half, radius, height + axis, a + b, rotate | rot, bone by name, mirror "x" (the counterpart bone is the one
      //      whose name ends _l / _r the other way), material: { friction, restitution }), in the model space of the bind pose; `trigger: true` ones are left out
      //   2. fitted to the mesh (the creature's mesh, or the one its sdf made: system.build_sdf first): `fit` "bones" (the default: A FEW shapes, `max_shapes` (4) at the most: the parts of the body that hang together, a leg,
      //      the trunk with the head, are one shape each; fit_bones), or "box" / "capsule" / "sphere": one shape round the mesh's bounds. A creature that has no mesh (yet) is fitted to its SKELETON: the bounds of its
      //      bones, padded by a tenth. A proxy does not have to fit well, it has to be there: the physics of a creature costs by its shapes
      // { mode: "off" | "kinematic" | "dynamic" (where the instances start; default dynamic for a species with a body, kinematic without: a creature that nothing moves cannot be pushed), shapes, mass (kg at scale 1; default the shapes'
      // volume times `density`), density (kg per cubic model unit, default 300: it only makes the default mass), friction (0.5), restitution (0.1), creatures (true: false = no contacts with other creatures' proxies), response
      // "yield" (the default) | "stop" (the creature stands its ground), fit, max_shapes (how many shapes a fit makes at the most, 4) }, or true (all the defaults). A shape's own `material` gives its friction and restitution.
      const SEC_PHYS = 7;
      const PHYS_MODES = ["off", "kinematic", "dynamic"], PHYS_FITS = ["bones", "box", "capsule", "sphere"], PHYS_RESPONSES = ["yield", "stop"];
      const PHYS_FIELDS = ["mode", "shapes", "mass", "density", "friction", "restitution", "creatures", "fit", "max_shapes", "response"];
      const PHYS_SHAPE_TYPES = { sphere: 0, box: 1, capsule: 2 }, PHYS_MAX_SHAPES = 16, SHAPE_AXIS = { x: 0, y: 1, z: 2 };       // (16: world.cpp's HAPPY_PHYS_MAX_SHAPES)
      const q_mul4 = function (a, b) {                                            // quaternions x y z w
        return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
      };
      const q_degrees = function (rx, ry, rz) {                                   // degrees, x first (about the fixed axes): qz * qy * qx
        const f = function (a) { return [Math.sin(a * DEG * 0.5), Math.cos(a * DEG * 0.5)]; }, x = f(rx), y = f(ry), z = f(rz);
        return q_mul4([0, 0, z[0], z[1]], q_mul4([0, y[0], 0, y[1]], [x[0], 0, 0, x[1]]));
      };
      const q_from_to = function (u, v) {                                         // the shortest rotation taking the unit vector u onto v
        const d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
        if (d < -1 + 1e-9) {                                                      // opposite: half a turn about anything perpendicular
          const ax = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
          const c = [u[1] * ax[2] - u[2] * ax[1], u[2] * ax[0] - u[0] * ax[2], u[0] * ax[1] - u[1] * ax[0]], l = Math.hypot(c[0], c[1], c[2]);
          return [c[0] / l, c[1] / l, c[2] / l, 0];
        }
        const q = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0], 1 + d], l = Math.hypot(q[0], q[1], q[2], q[3]);
        return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
      };
      const q_reflect = function (q, axis) { return [axis === 0 ? q[0] : -q[0], axis === 1 ? q[1] : -q[1], axis === 2 ? q[2] : -q[2], q[3]]; };      // the rotation as seen in a mirror across the plane normal to `axis`
      // the other side's bone of a bone, by its name: a name that ends in _l / _r (or .l / .r, -l / -r, any case) has the same name with the other letter; -1 when there is none
      function counterpart_bone(sk, i) {
        const name = sk.names[i], m = /^(.*[._-])([lLrR])$/.exec(name);
        if (!m) return -1;
        const other = m[1] + (m[2] === "l" ? "r" : m[2] === "L" ? "R" : m[2] === "r" ? "l" : "L"), j = sk.index[other];
        return j === undefined ? -1 : j;
      }
      // a list of shape defs -> [{ id, shape, pos, rot, radius | half | height, bone (index, -1: the root), material }] with the mirrors written out
      function compile_shapes(list, sk, tag) {
        const out = [], seen = Object.create(null), finite = function (v, what) { if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(what + " must be a number"); return v; };
        const bad = function (what) { throw new Error(tag + what); };
        list.forEach(function (src, ci) {
          if (!src || typeof src !== "object" || Array.isArray(src)) bad("shapes[" + ci + "] must be an object");
          const id = src.id !== undefined ? String(src.id) : "s" + ci, label = "shape '" + id + "'";
          if (seen[id]) bad("duplicate shape id '" + id + "'");
          seen[id] = true;
          if (src.filter !== undefined) bad(label + ": `filter` is not used (the proxy's categories are the worker's)");
          const c = { id: id, shape: src.shape, pos: [0, 0, 0], rot: [0, 0, 0, 1], bone: -1, bone_name: null, material: null, trigger: src.trigger === true };
          if (src.rotate !== undefined && src.rot !== undefined) bad(label + ": give `rotate` or `rot`, not both");
          let q = [0, 0, 0, 1];
          try {
            if (src.rot !== undefined) {
              if (!src.rot || src.rot.length < 4) bad(label + ".rot must be [x, y, z, w]");
              const l = Math.hypot(finite(src.rot[0], label + ".rot"), finite(src.rot[1], label + ".rot"), finite(src.rot[2], label + ".rot"), finite(src.rot[3], label + ".rot"));
              if (!(l > 1e-9)) bad(label + ".rot is not a rotation");
              q = [src.rot[0] / l, src.rot[1] / l, src.rot[2] / l, src.rot[3] / l];
            } else if (src.rotate !== undefined) { vec3(src.rotate, label + ".rotate"); q = q_degrees(src.rotate[0], src.rotate[1], src.rotate[2]); }
            if (src.shape === "sphere") {
              c.pos = vec3(src.center || [0, 0, 0], label + ".center").slice(0, 3);
              c.radius = finite(src.radius, label + ".radius");
              if (!(c.radius > 0)) bad(label + ".radius must be > 0");
            } else if (src.shape === "box") {
              c.pos = vec3(src.center || [0, 0, 0], label + ".center").slice(0, 3);
              c.half = vec3(src.half, label + ".half").slice(0, 3);
              if (!(c.half[0] > 0 && c.half[1] > 0 && c.half[2] > 0)) bad(label + ".half must be > 0");
              c.rot = q;
            } else if (src.shape === "capsule") {
              c.radius = finite(src.radius, label + ".radius");
              if (!(c.radius > 0)) bad(label + ".radius must be > 0");
              if (src.a !== undefined || src.b !== undefined) {
                vec3(src.a, label + ".a"); vec3(src.b, label + ".b");
                if (src.center !== undefined || src.height !== undefined || src.axis !== undefined) bad(label + ": give a and b, or center / height / axis");
                if (src.rotate !== undefined || src.rot !== undefined) bad(label + ": a capsule between a and b has no rotate / rot");
                const dx = src.b[0] - src.a[0], dy = src.b[1] - src.a[1], dz = src.b[2] - src.a[2], len = Math.hypot(dx, dy, dz);
                c.height = len;
                c.pos = [(src.a[0] + src.b[0]) * 0.5, (src.a[1] + src.b[1]) * 0.5, (src.a[2] + src.b[2]) * 0.5];
                c.rot = len > 1e-9 ? q_from_to([0, 1, 0], [dx / len, dy / len, dz / len]) : [0, 0, 0, 1];
              } else {
                c.pos = vec3(src.center || [0, 0, 0], label + ".center").slice(0, 3);
                c.height = finite(src.height, label + ".height");
                if (!(c.height >= 0)) bad(label + ".height must be >= 0 (the length of the cylinder part)");
                const ax = src.axis === undefined ? 1 : SHAPE_AXIS[src.axis];
                if (ax === undefined) bad(label + ".axis must be x, y or z");
                c.rot = q_mul4(q, ax === 1 ? [0, 0, 0, 1] : q_from_to([0, 1, 0], [ax === 0 ? 1 : 0, 0, ax === 2 ? 1 : 0]));
              }
            } else bad(label + " has the unknown shape '" + src.shape + "' (sphere, box, capsule)");
            if (src.bone !== undefined && src.bone !== null) {
              const bi = typeof src.bone === "number" ? (src.bone === (src.bone | 0) && src.bone >= 0 && src.bone < sk.n ? src.bone : undefined) : sk.index[src.bone];
              if (bi === undefined) bad(label + " follows the unknown bone '" + src.bone + "'");
              c.bone = bi; c.bone_name = sk.names[bi];
            }
            if (src.material !== undefined && src.material !== null) {
              if (typeof src.material !== "object") bad(label + ".material must be { friction, restitution }");
              c.material = {};
              ["friction", "restitution"].forEach(function (k) { if (src.material[k] !== undefined) c.material[k] = finite(src.material[k], label + ".material." + k); });
            }
          } catch (e) { const msg = String(e.message); throw new Error(msg.indexOf(tag) === 0 ? msg : tag + msg.replace(/^system: /, "")); }
          out.push(c);
          const flags = typeof src.mirror === "string" ? src.mirror.split("").filter(function (a, i, s) { return SHAPE_AXIS[a] !== undefined && s.indexOf(a) === i; }) : [];
          if (src.mirror !== undefined && (typeof src.mirror !== "string" || flags.length !== src.mirror.length)) bad(label + ".mirror is a string of x, y, z");
          for (let m = 1; m < (1 << flags.length); m++) {                          // every combination of the flagged axes is written out; x moves the shape to the counterpart bone
            const axes = flags.filter(function (a, i) { return m & (1 << i); }), r = Object.assign({}, c, { pos: c.pos.slice(), rot: c.rot.slice(), half: c.half ? c.half.slice() : undefined });
            axes.forEach(function (a) { const k = SHAPE_AXIS[a]; r.pos[k] = -r.pos[k]; r.rot = q_reflect(r.rot, k); });
            r.id = id + "#" + axes.join("");
            if (axes.indexOf("x") >= 0 && c.bone >= 0) {
              const cb = counterpart_bone(sk, c.bone);
              if (cb < 0) bad(label + ": mirror x needs a left / right counterpart of the bone '" + c.bone_name + "' (a name that ends _l or _r)");
              r.bone = cb; r.bone_name = sk.names[cb];
            }
            out.push(r);
          }
        });
        return out;
      }
      // The bone-wise fit: a FEW shapes, not a perfect fit (a proxy is a start: declare `shapes` for a better one). A vertex belongs to the bone that weighs most on it, so every bone that has a part of the mesh has a
      // CLUSTER of vertices, boxed in the bone's own bind frame. Clusters are then merged into the cluster they hang on: at once what is tiny (under 0.2 % of the surface or under 8 vertices: a finger, an eye), then what adds
      // (almost) nothing to it (the union of the two boxes is hardly bigger than the boxes: a shin that goes on where the thigh stops, a head on its neck), then, while there are more than `max` (4 unless asked for more), the merge that makes the union
      // grow the least. A leg, a spine with its neck and head, a tail each become ONE shape; an arm held out from the chest is merged last (the union would be a big box). Each cluster is boxed again from its vertices
      // (leaving out the 1 % at either end of each axis: a stray vertex does not make a limb longer) and the box says the shape: a part about as long as it is wide is a sphere (a box when the corners of its box are filled, as
      // a slab's are); a part longer than 1.4 times its width whose cross section is round is a capsule along its longest axis; the rest are boxes along the bone's axes. No shape is thinner than 1.2 % of the model.
      // -> [{ id, shape, pos, rot, radius | half | height, bone }] or null when the mesh is too small or has no extent. m: pack_mesh's result (positions, triangles, 4 bone indices and weights a vertex)
      function fit_bones(m, sk, max) {
        const P = m.a_position, I = m.bone_indices, Wt = m.bone_weights, n = m.n, nb = sk.n, bm = sk.bind, T = m.indices;
        if (n < 12) return null;
        max = max > 0 ? max : 4;
        const varea = new Float64Array(n);                                        // the surface each vertex stands for: a third of every triangle it is in
        for (let t = 0; t + 2 < T.length; t += 3) {
          const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
          const s = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 6;
          varea[T[t]] += s; varea[T[t + 1]] += s; varea[T[t + 2]] += s;
        }
        let lo0 = 1e30, lo1 = 1e30, lo2 = 1e30, hi0 = -1e30, hi1 = -1e30, hi2 = -1e30;
        for (let v = 0; v < n; v++) {
          const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
          if (x < lo0) lo0 = x; if (x > hi0) hi0 = x; if (y < lo1) lo1 = y; if (y > hi1) hi1 = y; if (z < lo2) lo2 = z; if (z > hi2) hi2 = z;
        }
        const size = Math.max(hi0 - lo0, hi1 - lo1, hi2 - lo2), Rmin = 0.012 * size, s2 = Math.SQRT1_2;
        if (!(size > 0)) return null;
        const floor_y = lo1;                                                       // (the lowest point of the mesh: the ground the creature stands on)
        const AX = [], HD = [];                                                   // the axes (x, y, z) and the head of every bone in its bind frame
        for (let b = 0; b < nb; b++) { const o = b * 12; AX.push([[bm[o], bm[o + 4], bm[o + 8]], [bm[o + 1], bm[o + 5], bm[o + 9]], [bm[o + 2], bm[o + 6], bm[o + 10]]]); HD.push([bm[o + 3], bm[o + 7], bm[o + 11]]); }
        const cl = new Array(nb).fill(null);                                      // the cluster of a bone (null: it has no vertex)
        let total = 0;
        for (let v = 0; v < n; v++) {
          let best = 0, bw = -1;
          for (let k = 0; k < 4; k++) if (Wt[v * 4 + k] > bw) { bw = Wt[v * 4 + k]; best = I[v * 4 + k] | 0; }
          if (!(best >= 0 && best < nb)) continue;
          let c = cl[best];
          if (!c) c = cl[best] = { b: best, bones: [best], vs: [], area: 0, low: 1e30, lo: [1e30, 1e30, 1e30], hi: [-1e30, -1e30, -1e30], dead: false, into: null };
          if (P[v * 3 + 1] < c.low) c.low = P[v * 3 + 1];
          c.vs.push(v); c.area += varea[v]; total += varea[v];
          const ax = AX[best], hd = HD[best], d0 = P[v * 3] - hd[0], d1 = P[v * 3 + 1] - hd[1], d2 = P[v * 3 + 2] - hd[2];
          for (let k = 0; k < 3; k++) { const l = d0 * ax[k][0] + d1 * ax[k][1] + d2 * ax[k][2]; if (l < c.lo[k]) c.lo[k] = l; if (l > c.hi[k]) c.hi[k] = l; }
        }
        const live = function () { const out = []; for (let b = 0; b < nb; b++) if (cl[b] && !cl[b].dead) out.push(cl[b]); return out; };
        const parent_of = function (c) {                                          // the live cluster that c hangs on: the first bone above it that has one
          for (let p = sk.parent[c.b]; p >= 0; p = sk.parent[p]) if (cl[p]) { let r = cl[p]; while (r && r.dead) r = r.into; if (r) return r; }          // (a cluster that was let go leaves its children to the one above it)
          return null;
        };
        const vol = function (lo, hi) { return (hi[0] - lo[0] + 2 * Rmin) * (hi[1] - lo[1] + 2 * Rmin) * (hi[2] - lo[2] + 2 * Rmin); };
        const union_box = function (c, p) {                                       // the box of p grown by the box of c (its 8 corners, in the frame of p's bone)
          const ac = AX[c.b], ap = AX[p.b], hc = HD[c.b], hp = HD[p.b], d = [hc[0] - hp[0], hc[1] - hp[1], hc[2] - hp[2]], lo = p.lo.slice(), hi = p.hi.slice();
          const dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
          const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], t = [dot(ap[0], d), dot(ap[1], d), dot(ap[2], d)];
          for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) R[j][k] = dot(ap[j], ac[k]);
          for (let i = 0; i < 8; i++) {
            const x = (i & 1) ? c.hi[0] : c.lo[0], y = (i & 2) ? c.hi[1] : c.lo[1], z = (i & 4) ? c.hi[2] : c.lo[2];
            for (let j = 0; j < 3; j++) { const v = t[j] + R[j][0] * x + R[j][1] * y + R[j][2] * z; if (v < lo[j]) lo[j] = v; if (v > hi[j]) hi[j] = v; }
          }
          return { lo: lo, hi: hi };
        };
        const merge = function (c, p, ub, detail) { for (let i = 0; i < c.vs.length; i++) p.vs.push(c.vs[i]); if (!detail) for (let i = 0; i < c.bones.length; i++) p.bones.push(c.bones[i]); p.area += c.area; if (c.low < p.low) p.low = c.low; p.lo = ub.lo; p.hi = ub.hi; c.dead = true; c.into = p; c.vs = null; };      // (a detail adds its vertices to the box, and its bones are not ones that the shape could follow)
        for (let k = nb - 1; k >= 0; k--) {                                       // what is a detail joins the cluster it hangs on at once (children before their parents): few vertices, a sliver of the surface, or no longer than 6 % of the model
          const c = cl[sk.order[k]];
          if (!c || c.dead || !(c.vs.length < 8 || c.area < 0.002 * total || Math.max(c.hi[0] - c.lo[0], c.hi[1] - c.lo[1], c.hi[2] - c.lo[2]) < 0.06 * size)) continue;
          const p = parent_of(c);
          if (p) merge(c, p, union_box(c, p), true);
        }
        for (let again = true, guard = 0; again && guard < 8; guard++) {          // what goes on where its parent stops (its bone points the same way: a shin under a thigh, a neck over a spine) or adds almost nothing (the union of the two boxes is hardly bigger: under 15 % of the child's own) joins it
          again = false;
          for (let k = nb - 1; k >= 0; k--) {
            const c = cl[sk.order[k]];
            if (!c || c.dead) continue;
            const p = parent_of(c);
            if (!p) continue;
            const ub = union_box(c, p), ay = AX[c.b][1], by = AX[p.b][1], along = ay[0] * by[0] + ay[1] * by[1] + ay[2] * by[2];
            if (along >= 0.82 || vol(ub.lo, ub.hi) - vol(p.lo, p.hi) - vol(c.lo, c.hi) <= 0.15 * vol(c.lo, c.hi)) { merge(c, p, ub); again = true; }
          }
        }
        // too many: what is small is let go (a tail, a thin leg: under 5 % of the biggest shape), else the merge that makes the union grow the least (relative to the union). The ones that are equal (the left and
        // the right of a body) go together, so that a creature is the same on both sides
        for (let list = live(); list.length > max; list = live()) {
          let biggest = 0, least = 1e30;                                           // (what stands on the ground is not let go: a crate is stopped by the feet, not by a tail)
          list.forEach(function (c) { const v = vol(c.lo, c.hi); if (v > biggest) biggest = v; if (c.low > floor_y + 0.1 * size && v < least) least = v; });
          if (least < 0.05 * biggest) { list.forEach(function (c) { if (c.low > floor_y + 0.1 * size && vol(c.lo, c.hi) <= least * 1.0001) { c.dead = true; c.into = null; c.vs = null; } }); continue; }
          const cands = [];
          list.forEach(function (c) {
            const p = parent_of(c);
            if (!p) return;
            const ub = union_box(c, p), vu = vol(ub.lo, ub.hi);
            cands.push({ c: c, p: p, ub: ub, cost: (vu - vol(p.lo, p.hi) - vol(c.lo, c.hi)) / vu });
          });
          if (!cands.length) break;                                                // (clusters that hang on nothing: the biggest are kept below)
          let best = cands[0].cost;
          cands.forEach(function (x) { if (x.cost < best) best = x.cost; });
          cands.forEach(function (x) { if (x.cost <= best + 1e-6 + 1e-4 * Math.abs(best) && !x.c.dead && !x.p.dead) merge(x.c, x.p, union_box(x.c, x.p)); });          // (the box of the parent as it is now: two children may join it in one round)
        }
        const quant = function (a, q) { return a[Math.round(q * (a.length - 1))]; }, out = [];
        live().forEach(function (c) {
          const vs = c.vs, b = c.b;
          if (vs.length < 8) return;
          const ax = AX[b], head = HD[b];
          const loc = [new Float32Array(vs.length), new Float32Array(vs.length), new Float32Array(vs.length)];
          for (let i = 0; i < vs.length; i++) {
            const v = vs[i], d0 = P[v * 3] - head[0], d1 = P[v * 3 + 1] - head[1], d2 = P[v * 3 + 2] - head[2];
            for (let k = 0; k < 3; k++) loc[k][i] = d0 * ax[k][0] + d1 * ax[k][1] + d2 * ax[k][2];
          }
          const lo = [0, 0, 0], hi = [0, 0, 0];
          for (let k = 0; k < 3; k++) { const sorted = Float32Array.from(loc[k]).sort(); lo[k] = quant(sorted, 0.01); hi[k] = quant(sorted, 0.99); }
          const ext = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], mid = [(hi[0] + lo[0]) / 2, (hi[1] + lo[1]) / 2, (hi[2] + lo[2]) / 2];
          const ord = [0, 1, 2].sort(function (a, c2) { return ext[c2] - ext[a]; }), L = ext[ord[0]], M = ext[ord[1]], Sh = ext[ord[2]];
          if (!(L > 1e-5)) return;
          // how much of the cloud lies out in the corners of its box: the points of a ball or a cylinder are on its surface (the normalised radius is 1), the points of a box reach the corners
          const corner = function (axes) {
            let k2 = 0;
            for (let i = 0; i < vs.length; i++) {
              let r = 0;
              for (let j = 0; j < axes.length; j++) { const k = axes[j], u = ext[k] > 1e-9 ? (loc[k][i] - mid[k]) / (ext[k] / 2) : 0; r += u * u; }
              if (r > (axes.length === 2 ? 1.35 : 1.8)) k2++;
            }
            return k2 / vs.length;
          };
          const bq = [0, 0, 0, 1]; mat_to_quat(bm, b * 12, bq, 0);
          const box = function () { return { shape: "box", half: ext.map(function (e) { return Math.max(e / 2, Rmin); }), rot: bq }; };
          let sh;
          if (L < 1.5 * Sh) sh = corner([0, 1, 2]) > 0.3 ? box() : { shape: "sphere", radius: Math.max((L + M + Sh) / 6, Rmin), rot: [0, 0, 0, 1] };
          else if (L >= 1.4 * M && Sh / M >= 0.6 && corner([ord[1], ord[2]]) <= 0.25) {
            const R = Math.max(Rmin, (M + Sh) / 4), a0 = ord[0];
            sh = { shape: "capsule", radius: R, height: Math.max(0, L - 2 * R), rot: q_mul4(bq, a0 === 1 ? [0, 0, 0, 1] : a0 === 0 ? [0, 0, -s2, s2] : [s2, 0, 0, s2]) };
          } else sh = box();
          sh.pos = [0, 1, 2].map(function (j) { return head[j] + ax[0][j] * mid[0] + ax[1][j] * mid[1] + ax[2][j] * mid[2]; });
          // the shape follows the bone of its cluster that lies nearest its centre (a leg: a bone near its middle, so that neither end swings far from where the leg is). A shape on the middle of the body (x near 0: +x is the
          // creature's left) follows a bone on the middle of the body, not a leg that it has taken in (the body would swing with the leg)
          const central = Math.abs(sh.pos[0]) < 0.04 * size && c.bones.some(function (j) { return Math.abs(HD[j][0] + AX[j][1][0] * 0.5 * sk.length[j]) < 0.08 * size; });
          let follow = b, nearest = 1e30;
          c.bones.forEach(function (j) {
            const hd = HD[j], ay = AX[j][1];
            if (central && Math.abs(hd[0] + ay[0] * 0.5 * sk.length[j]) >= 0.08 * size) return;
            const d0 = sh.pos[0] - hd[0], d1 = sh.pos[1] - hd[1], d2 = sh.pos[2] - hd[2], t = Math.max(0, Math.min(sk.length[j], d0 * ay[0] + d1 * ay[1] + d2 * ay[2]));
            const dist = Math.hypot(d0 - ay[0] * t, d1 - ay[1] * t, d2 - ay[2] * t);
            if (dist <= nearest + 1e-6) { nearest = Math.min(nearest, dist); follow = j; }                    // (a tie, the knee, goes to the bone farther out)
          });
          sh.bone = follow; sh.id = "auto_" + sk.names[b]; sh.area = c.area;
          out.push(sh);
        });
        if (!out.length) return null;
        out.sort(function (a, c) { return c.area - a.area || a.bone - c.bone; });                          // (the parts with the most surface first, when more than `max` are left)
        return out.slice(0, Math.max(1, Math.min(max, PHYS_MAX_SHAPES))).sort(function (a, c) { return a.bone - c.bone; });
      }
      // the bounds (lo, hi) of a creature: its mesh's vertices (pack_mesh's result), or, with no mesh, the heads and the tails of its bones padded by a tenth of the biggest side (a skeleton has no thickness)
      function physics_bounds(mesh, sk) {
        const lo = [1e30, 1e30, 1e30], hi = [-1e30, -1e30, -1e30];
        if (mesh) { for (let v = 0; v < mesh.n; v++) for (let k = 0; k < 3; k++) { const x = mesh.a_position[v * 3 + k]; if (x < lo[k]) lo[k] = x; if (x > hi[k]) hi[k] = x; } return { lo: lo, hi: hi, skeleton: false }; }
        for (let b = 0; b < sk.n; b++) for (let k = 0; k < 3; k++) {
          const h = sk.head[b * 3 + k], t = sk.tail[b * 3 + k];
          lo[k] = Math.min(lo[k], h, t); hi[k] = Math.max(hi[k], h, t);
        }
        const pad = 0.1 * Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
        for (let k = 0; k < 3; k++) { lo[k] -= pad; hi[k] += pad; }
        return { lo: lo, hi: hi, skeleton: true };
      }
      // the compiled shapes of a species (system.compile's physics.shapes: { id, shape, bone_name, pos, rot, size ... }) as a definition says them: sphere { center, radius }, box { center, half, rot }, capsule { center, radius,
      // height, rot }, on a bone by its name; round numbers. A creature's file keeps the shapes a fit made (the fit is a start, a person changes them)
      function shapes_as_definition(shapes) {
        const r = function (v) { return Math.round(v * 1e5) / 1e5; }, rq = function (v) { return Math.round(v * 1e6) / 1e6; };
        return shapes.map(function (s) {
          const o = { id: s.id, shape: s.shape };
          if (s.bone_name) o.bone = s.bone_name;
          o.center = s.pos.map(r);
          if (s.shape === "sphere") o.radius = r(s.size[0]);
          else if (s.shape === "box") { o.half = s.size.map(r); o.rot = s.rot.map(rq); }
          else { o.radius = r(s.size[0]); o.height = r(s.size[1]); o.rot = s.rot.map(rq); }
          return o;
        });
      }
      // ph: the species' `physics`; sk: make_skeleton's result; get_mesh: a function that gives pack_mesh's result (or null: there is none to fit to); body: compile_body's result (or null)
      function compile_physics(ph, sk, get_mesh, body) {
        const tag = "system: physics: ";
        if (ph === true) ph = {};
        if (!ph || typeof ph !== "object" || Array.isArray(ph)) throw new Error("system: physics must be an object { mode, shapes, mass, density, friction, restitution, creatures, fit, response } (or true)");
        for (const k in ph) if (PHYS_FIELDS.indexOf(k) < 0) throw new Error(tag + "unknown field '" + k + "' (" + PHYS_FIELDS.join(", ") + ")");
        const mode = ph.mode === undefined ? (body ? 2 : 1) : PHYS_MODES.indexOf(ph.mode);
        if (mode < 0) throw new Error(tag + "mode must be one of " + PHYS_MODES.join(", ") + " (" + ph.mode + ")");
        if (mode === 2 && !body) throw new Error(tag + "mode 'dynamic' needs a body (body: { ... }): a creature that nothing moves cannot be pushed; it is 'kinematic' (it pushes bodies) or 'off'");
        if (ph.creatures !== undefined && typeof ph.creatures !== "boolean") throw new Error(tag + "creatures must be true or false (" + ph.creatures + ")");
        if (ph.response !== undefined && PHYS_RESPONSES.indexOf(ph.response) < 0) throw new Error(tag + "response must be one of " + PHYS_RESPONSES.join(", ") + " (" + ph.response + ")");
        const num = function (k, d, lo, hi) { const v = ph[k] === undefined ? d : ph[k]; if (typeof v !== "number" || !Number.isFinite(v) || !(v >= lo) || !(v <= hi)) throw new Error(tag + k + " must be a number from " + lo + " to " + hi + " (" + v + ")"); return v; };
        const friction = num("friction", 0.5, 0, 10), restitution = num("restitution", 0.1, 0, 1), density = num("density", 300, 1e-3, 1e6);
        let list = [], source = "", fit = null;
        if (ph.shapes !== undefined) {                                                                         // 1. declared
          if (!Array.isArray(ph.shapes) || !ph.shapes.length) throw new Error(tag + "shapes must be a list of at least one shape (leave it out for a fit)");
          list = compile_shapes(ph.shapes, sk, tag).filter(function (c) { return !c.trigger; });
          if (!list.length) throw new Error(tag + "every one of the shapes is a trigger");
          source = "shapes";
        } else {                                                                                               // 2. fitted
          const want = ph.fit === undefined ? "bones" : ph.fit;
          if (PHYS_FITS.indexOf(want) < 0) throw new Error(tag + "fit must be one of " + PHYS_FITS.join(", ") + " (" + want + ")");
          const max_shapes = ph.max_shapes === undefined ? 4 : ph.max_shapes;
          if (!Number.isInteger(max_shapes) || max_shapes < 1 || max_shapes > PHYS_MAX_SHAPES) throw new Error(tag + "max_shapes must be a whole number from 1 to " + PHYS_MAX_SHAPES + " (" + ph.max_shapes + ")");
          const mesh = get_mesh ? get_mesh() : null;
          const bones = want === "bones" && mesh ? fit_bones(mesh, sk, max_shapes) : null;
          if (bones) { list = bones; fit = "bones"; }
          else {
            fit = want === "bones" ? "box" : want;
            const bd = physics_bounds(mesh, sk), lo = bd.lo, hi = bd.hi, s2 = Math.SQRT1_2;
            const ext = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], mid = [(hi[0] + lo[0]) / 2, (hi[1] + lo[1]) / 2, (hi[2] + lo[2]) / 2];
            if (fit === "box") list = [{ id: "auto", shape: "box", pos: mid, rot: [0, 0, 0, 1], half: ext.map(function (e) { return Math.max(0.01, 0.45 * e); }), bone: -1, bone_name: null, material: null }];
            else if (fit === "sphere") list = [{ id: "auto", shape: "sphere", pos: mid, rot: [0, 0, 0, 1], radius: Math.max(0.01, 0.4 * (ext[0] + ext[1] + ext[2]) / 3), bone: -1, bone_name: null, material: null }];
            else {                                                                                             // a capsule along the longest side, as wide as 0.9 of the narrower of the other two
              const ax = ext[0] >= ext[1] && ext[0] >= ext[2] ? 0 : ext[1] >= ext[2] ? 1 : 2, o = [0, 1, 2].filter(function (k) { return k !== ax; }), radius = Math.max(0.01, 0.45 * Math.min(ext[o[0]], ext[o[1]]));
              list = [{ id: "auto", shape: "capsule", pos: mid, rot: ax === 1 ? [0, 0, 0, 1] : ax === 2 ? [s2, 0, 0, s2] : [0, 0, -s2, s2], radius: radius, height: Math.max(0, 0.9 * ext[ax] - 2 * radius), bone: -1, bone_name: null, material: null }];
            }
          }
          list.forEach(function (c) { if (c.bone >= 0) c.bone_name = sk.names[c.bone]; });
          source = mesh ? "fit" : "skeleton";
        }
        if (list.length > PHYS_MAX_SHAPES) throw new Error(tag + "at most " + PHYS_MAX_SHAPES + " shapes (" + (source === "shapes" ? "the shapes make " : "") + list.length + ")");
        let volume = 0;
        const shapes = list.map(function (c, i) {
          const label = tag + "shape " + (c.id !== undefined ? "'" + c.id + "'" : i), type = PHYS_SHAPE_TYPES[c.shape];
          const m = c.material || {}, fr = m.friction === undefined ? friction : m.friction, re = m.restitution === undefined ? restitution : m.restitution;
          if (!Number.isFinite(fr) || fr < 0 || fr > 10) throw new Error(label + ": friction = " + fr + " is out of range (0 .. 10)");
          if (!Number.isFinite(re) || re < 0 || re > 1) throw new Error(label + ": restitution = " + re + " is out of range (0 .. 1)");
          const size = type === 0 ? [c.radius, 0, 0] : type === 1 ? c.half.slice(0, 3) : [c.radius, c.height, 0];
          volume += type === 0 ? 4 / 3 * Math.PI * c.radius * c.radius * c.radius : type === 1 ? 8 * c.half[0] * c.half[1] * c.half[2] : Math.PI * c.radius * c.radius * c.height + 4 / 3 * Math.PI * c.radius * c.radius * c.radius;
          return { id: c.id, type: type, shape: c.shape, bone: c.bone >= 0 ? c.bone : -1, bone_name: c.bone >= 0 ? sk.names[c.bone] : null, pos: c.pos.slice(0, 3), rot: c.rot.slice(0, 4), size: size, friction: fr, restitution: re };
        });
        const mass = ph.mass !== undefined ? num("mass", 0, 1e-3, 1e7) : Math.max(1e-3, volume * density);
        if (!(mass <= 1e7)) throw new Error(tag + "the shapes' volume makes a mass of " + mass + " kg: give `mass` (at most 10 million)");
        const creatures = ph.creatures !== false, response = ph.response === undefined ? "yield" : ph.response;
        const f1 = new Float32Array(1), u1 = new Uint32Array(f1.buffer), words = [0, mode, shapes.length], pushf = function (v) { f1[0] = v; words.push(u1[0]); };
        pushf(mass); words.push((creatures ? 0 : 1) | (response === "stop" ? 2 : 0), 0, 0, 0);
        shapes.forEach(function (sh) {
          words.push(sh.type, sh.bone + 1);
          sh.pos.forEach(pushf); sh.rot.forEach(pushf); sh.size.forEach(pushf);
          pushf(sh.friction); pushf(sh.restitution); words.push(0, 0);                                         // (word 14: the prop the shape belongs to + 1: the restart has no props, 0)
        });
        return { words: Uint32Array.from(words), physics: { mode: PHYS_MODES[mode], mass: mass, density: density, friction: friction, restitution: restitution, creatures: creatures, response: response, source: source, fit: fit, auto: source !== "shapes", shapes: shapes } };
      }
      // the glue of the blob: a definition's `physics` (or its `happy.physics`) -> the section ({ words, physics }), null when it has none. A fit reads the creature's mesh (its own, or the one its sdf made); a creature whose
      // sdf is not made yet (system.build_sdf) is fitted to its skeleton, and the shapes that a fit made are what the species keeps either way
      function compile_species_physics(input, sk, body) {
        const ph = input.physics !== undefined ? input.physics : (input.system && input.system.physics);
        if (ph === undefined || ph === null || ph === false) return null;
        const get_mesh = function () {
          let g = null;
          try { g = resolve_mesh(input, sk); } catch (e) { g = null; }                                       // (an sdf that has not been made: no mesh yet)
          return g ? pack_mesh(g.mesh, sk) : null;
        };
        return compile_physics(ph, sk, get_mesh, body);
      }
      system.shapes_as_definition = shapes_as_definition; system.PHYS_MODES = PHYS_MODES; system.PHYS_FIELDS = PHYS_FIELDS;
