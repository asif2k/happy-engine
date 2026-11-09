// THE KERNEL: what a creature IS as data (mirror, skeleton, rig, gaits, legs, the plan of a live style). PURE: the page and the worker's core include these very parts.
// Ported 2026-11-05 from the first version of the creature system, renamed and merged by domain. From here this file is the source.
// Its parts are INCLUDED (the bundler's import directive) into the one closure that makes engine.system (system.js), so each sees every name of the parts before it.

      // ========================================================================================================================
      // mirror
      // ========================================================================================================================
// system.js, a part: the left half of a definition made whole. A bone, a joint or a chain with `mirror: "x"` (its name ends in _l) gets its twin on the other side of the model's x = 0 plane (_r).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- mirror ---------------------------------------------------------------------------------------------------------------------------------------
      // What a reflection does to what a rig says: a point (x, y, z) goes to (-x, y, z); a hinge's axis a goes to (a.x, -a.y, -a.z) with the same range (a reflection turns the other way round: the knee, whose axis is x, keeps its
      // axis and its sign); a twist range [lo, hi] goes to [-hi, -lo]; a pole direction (-x, y, z). The tools that read these twins never see the word `mirror`: the definition they get has both sides written out.
      const MIRROR_NAME = /^(.*)_([lL])$/;
      function mirror_ref(name) { const m = typeof name === "string" ? MIRROR_NAME.exec(name) : null; return m ? m[1] + "_" + (m[2] === "l" ? "r" : "R") : name; }
      function mirror_name(name, what) {
        if (typeof name !== "string" || !MIRROR_NAME.test(name)) fail(what + ": a name that is mirrored must end in _l (or _L): '" + name + "'");
        return mirror_ref(name);
      }
      function neg_x(v) { return Array.isArray(v) && v.length === 3 ? [-v[0], v[1], v[2]] : v; }
      function check_mirror(v, what) { if (v !== "x") fail(what + ": mirror must be \"x\" (" + JSON.stringify(v) + ")"); }

      // the bones of a skeleton definition, with the twins written out (each right after its left bone; the input is not changed)
      function expand_bones(raw) {
        if (!Array.isArray(raw)) return raw;
        const out = [];
        raw.forEach(function (b) {
          if (!b || typeof b !== "object" || b.mirror === undefined) { out.push(b); return; }
          const what = "bone '" + b.name + "'";
          check_mirror(b.mirror, what);
          const left = Object.assign({}, b), right = Object.assign({}, b);
          delete left.mirror; delete right.mirror;
          right.name = mirror_name(b.name, what);
          if (typeof b.parent === "number") fail(what + ": a bone that is mirrored names its parent (a number cannot be mirrored)");
          right.parent = mirror_ref(b.parent);
          right.head = neg_x(b.head);
          if (b.tail !== undefined && b.tail !== null) right.tail = neg_x(b.tail);
          if (b.roll) right.roll = -b.roll;
          out.push(left, right);
        });
        return out;
      }

      function mirror_joint(j) {
        const what = "joint of '" + j.bone + "'", t = Object.assign({}, j);
        delete t.mirror;
        t.bone = mirror_name(j.bone, what);
        if (j.neutral !== undefined) fail(what + ": a joint with a `neutral` cannot be mirrored (the frames of two sides of a bone are not mirror images): write both");
        if (Array.isArray(j.axis) && j.axis.length === 3) t.axis = [j.axis[0], -j.axis[1], -j.axis[2]];
        if (j.out_dir !== undefined) t.out_dir = neg_x(j.out_dir);
        if (j.side === "left") t.side = "right"; else if (j.side === "right") t.side = "left";
        if (Array.isArray(j.twist) && j.twist.length === 2) t.twist = [-j.twist[1], -j.twist[0]];
        return t;
      }
      function mirror_chain(c) {
        const what = "chain '" + c.name + "'", t = Object.assign({}, c);
        delete t.mirror;
        t.name = mirror_name(c.name, what);
        if (!Array.isArray(c.bones)) fail(what + ": bones must be a list of bone names");
        t.bones = c.bones.map(mirror_ref);
        if (!t.bones.some(function (n, i) { return n !== c.bones[i]; })) fail(what + ": a chain that is mirrored has a bone that ends in _l (its bones: " + c.bones.join(", ") + ")");
        if (c.tip !== undefined && c.tip !== null) t.tip = mirror_ref(c.tip);
        if (c.pole !== undefined && c.pole !== null) t.pole = neg_x(c.pole);
        return t;
      }

      // a rig definition { joints, chains } with the twins written out (joints as an object keyed by bone name become a list)
      function expand_rig(rig) {
        if (!rig || typeof rig !== "object" || Array.isArray(rig)) return rig;
        const out = Object.assign({}, rig);
        if (rig.joints !== undefined && rig.joints !== null) {
          let list = rig.joints;
          if (!Array.isArray(list) && typeof list === "object") list = Object.keys(list).map(function (k) { return Object.assign({ bone: k }, list[k]); });
          if (Array.isArray(list)) {
            const o2 = [];
            list.forEach(function (j) {
              if (!j || typeof j !== "object" || j.mirror === undefined) { o2.push(j); return; }
              check_mirror(j.mirror, "joint of '" + j.bone + "'");
              const left = Object.assign({}, j);
              delete left.mirror;
              o2.push(left, mirror_joint(j));
            });
            out.joints = o2;
          }
        }
        if (Array.isArray(rig.chains)) {
          const o2 = [];
          rig.chains.forEach(function (c) {
            if (!c || typeof c !== "object" || c.mirror === undefined) { o2.push(c); return; }
            check_mirror(c.mirror, "chain '" + c.name + "'");
            const left = Object.assign({}, c);
            delete left.mirror;
            o2.push(left, mirror_chain(c));
          });
          out.chains = o2;
        }
        return out;
      }
      system.expand_bones = expand_bones; system.expand_rig = expand_rig;

      // ========================================================================================================================
      // skeleton
      // ========================================================================================================================
// system.js, a part: the skeleton: bind frames from heads and tails (make_skeleton).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- the skeleton: bind frames from heads and tails ---------------------------------------------------------------------------------------------
      // the rotation of a 3x4 row-major matrix (columns = the frame's axes) as xyzw
      function mat_to_quat(m, o, q, qo) {
        const r00 = m[o], r01 = m[o + 1], r02 = m[o + 2], r10 = m[o + 4], r11 = m[o + 5], r12 = m[o + 6], r20 = m[o + 8], r21 = m[o + 9], r22 = m[o + 10], tr = r00 + r11 + r22;
        let k;
        if (tr > 0) { k = Math.sqrt(tr + 1) * 2; q[qo + 3] = 0.25 * k; q[qo] = (r21 - r12) / k; q[qo + 1] = (r02 - r20) / k; q[qo + 2] = (r10 - r01) / k; }
        else if (r00 > r11 && r00 > r22) { k = Math.sqrt(1 + r00 - r11 - r22) * 2; q[qo + 3] = (r21 - r12) / k; q[qo] = 0.25 * k; q[qo + 1] = (r01 + r10) / k; q[qo + 2] = (r02 + r20) / k; }
        else if (r11 > r22) { k = Math.sqrt(1 + r11 - r00 - r22) * 2; q[qo + 3] = (r02 - r20) / k; q[qo] = (r01 + r10) / k; q[qo + 1] = 0.25 * k; q[qo + 2] = (r12 + r21) / k; }
        else { k = Math.sqrt(1 + r22 - r00 - r11) * 2; q[qo + 3] = (r10 - r01) / k; q[qo] = (r02 + r20) / k; q[qo + 1] = (r12 + r21) / k; q[qo + 2] = 0.25 * k; }
        const l = Math.hypot(q[qo], q[qo + 1], q[qo + 2], q[qo + 3]) || 1;
        q[qo] /= l; q[qo + 1] /= l; q[qo + 2] /= l; q[qo + 3] /= l;
      }
      function fail(msg) { throw new Error("system: " + msg); }
      function vec3(v, what) {
        if (!Array.isArray(v) && !(v && typeof v.length === "number" && typeof v !== "string")) fail(what + " must be [x, y, z]");
        if (v.length !== 3 || !Number.isFinite(v[0]) || !Number.isFinite(v[1]) || !Number.isFinite(v[2]) || Math.abs(v[0]) > 1e7 || Math.abs(v[1]) > 1e7 || Math.abs(v[2]) > 1e7) fail(what + " must be [x, y, z] (finite numbers)");
        return v;
      }
      // o = a * b for 3x4 affine matrices (row major, 12 floats at the offsets); o must not alias a or b
      function mul34(o, oo, a, ao, b, bo) {
        for (let r = 0; r < 3; r++) {
          const a0 = a[ao + r * 4], a1 = a[ao + r * 4 + 1], a2 = a[ao + r * 4 + 2], a3 = a[ao + r * 4 + 3];
          o[oo + r * 4] = a0 * b[bo] + a1 * b[bo + 4] + a2 * b[bo + 8];
          o[oo + r * 4 + 1] = a0 * b[bo + 1] + a1 * b[bo + 5] + a2 * b[bo + 9];
          o[oo + r * 4 + 2] = a0 * b[bo + 2] + a1 * b[bo + 6] + a2 * b[bo + 10];
          o[oo + r * 4 + 3] = a0 * b[bo + 3] + a1 * b[bo + 7] + a2 * b[bo + 11] + a3;
        }
      }

      // the bone tree of a list of finished bones: bind frames (y along head -> tail, x by parallel transport from the parent's x, z = x cross y), the rest transforms relative to the parent, a parent-before-child order.
      // Bones are not mirrored frames: the same bend angle on a left and a right limb moves them in opposite senses. bones: [{ name, parent: name | index | null, head, tail?, roll? }] (a tail that is left out is the mean
      // head of the children, else the parent's direction times half its length). -> { n, names, index, parent, children, order, depth, head, tail, length, bind, bind_inv, rest }
      const BONE_KEYS = ["name", "parent", "head", "tail", "roll", "mirror", "soft"];          // (soft: true | { stiffness | hz, damping, gain, limit, axis }: the bone is soft tissue, body.js; a mirrored bone's twin is soft too)
      // an object that has a key which is none of `allowed`: a mistake in a name ("foward") is an error that says so, not a limit that is not there
      function only_keys(obj, allowed, what) {
        for (const k in obj) if (allowed.indexOf(k) < 0) fail(what + ": unknown key '" + k + "' (" + allowed.join(", ") + ")");
      }
      function make_skeleton(input) {
        if (!Array.isArray(input)) fail("skeleton must be an array of bones");
        input.forEach(function (b, i) { if (b && typeof b === "object") only_keys(b, BONE_KEYS, "bone " + (typeof b.name === "string" ? "'" + b.name + "'" : i)); });
        const defs = expand_bones(input), n = defs.length;
        if (n < 1) fail("the skeleton has no bones");
        if (n > MAX_BONES) fail("at most " + MAX_BONES + " bones (" + n + ")");
        const sk = {
          n: n, names: [], index: Object.create(null), parent: new Int32Array(n), children: [], order: [], depth: new Int32Array(n),
          head: new Float64Array(n * 3), tail: new Float64Array(n * 3), length: new Float64Array(n),
          bind: new Float64Array(n * 12), bind_inv: new Float64Array(n * 12), rest: new Float64Array(n * 12), soft: []
        };
        let i, k;
        for (i = 0; i < n; i++) {
          const b = defs[i];
          if (!b || typeof b !== "object" || typeof b.name !== "string" || b.name === "") fail("every bone needs a name (bone " + i + ")");
          const h = vec3(b.head, "bone '" + b.name + "'.head");
          if (sk.index[b.name] !== undefined) fail("duplicate bone name '" + b.name + "'");
          sk.index[b.name] = i; sk.names.push(b.name); sk.soft.push(b.soft === undefined ? null : b.soft);
          sk.head[i * 3] = h[0]; sk.head[i * 3 + 1] = h[1]; sk.head[i * 3 + 2] = h[2];
          sk.children.push([]);
        }
        const roots = [];
        for (i = 0; i < n; i++) {
          const b = defs[i];
          let p = -1;
          if (b.parent !== undefined && b.parent !== null) {
            p = typeof b.parent === "number" ? b.parent : sk.index[b.parent];
            if (p === undefined || !(p >= 0 && p < n) || p !== (p | 0)) fail("bone '" + b.name + "' has the unknown parent '" + b.parent + "'");
            if (p === i) fail("bone '" + b.name + "' is its own parent");
          }
          sk.parent[i] = p;
          if (p < 0) roots.push(i); else sk.children[p].push(i);
        }
        if (!roots.length) fail("the skeleton has no root bone (all bones have parents)");
        const stack = roots.slice().reverse();
        while (stack.length) {
          const j = stack.pop(), ch = sk.children[j];
          sk.order.push(j);
          for (k = ch.length - 1; k >= 0; k--) { sk.depth[ch[k]] = sk.depth[j] + 1; stack.push(ch[k]); }
        }
        if (sk.order.length !== n) fail("the bone parents form a cycle");

        const B = sk.bind, BI = sk.bind_inv;
        for (let oi = 0; oi < n; oi++) {
          i = sk.order[oi];
          const b = defs[i], p = sk.parent[i], h = i * 3, o = i * 12, pb = p * 12;
          const hx = sk.head[h], hy = sk.head[h + 1], hz = sk.head[h + 2];
          let dx = 0, dy = 1, dz = 0, tx = 0, ty = 0, tz = 0, have = false;
          if (p >= 0) { dx = B[pb + 1]; dy = B[pb + 5]; dz = B[pb + 9]; }
          if (b.tail !== undefined && b.tail !== null) { vec3(b.tail, "bone '" + b.name + "'.tail"); tx = b.tail[0]; ty = b.tail[1]; tz = b.tail[2]; have = true; }
          else if (sk.children[i].length) {
            const ch = sk.children[i];
            for (k = 0; k < ch.length; k++) { tx += sk.head[ch[k] * 3]; ty += sk.head[ch[k] * 3 + 1]; tz += sk.head[ch[k] * 3 + 2]; }
            tx /= ch.length; ty /= ch.length; tz /= ch.length;
            have = Math.hypot(tx - hx, ty - hy, tz - hz) > 1e-6;
          }
          if (!have) {
            const fallback = p >= 0 ? Math.max(0.02, 0.5 * sk.length[p]) : 0.1;
            tx = hx + dx * fallback; ty = hy + dy * fallback; tz = hz + dz * fallback;
          }
          const len = Math.hypot(tx - hx, ty - hy, tz - hz);
          if (!(len > 1e-6)) fail("bone '" + b.name + "' has no length (head and tail coincide)");
          sk.tail[h] = tx; sk.tail[h + 1] = ty; sk.tail[h + 2] = tz; sk.length[i] = len;
          const yx = (tx - hx) / len, yy = (ty - hy) / len, yz = (tz - hz) / len;

          // x: the parent's x (its z when that lies along this bone), else a world axis
          let xx = 0, xy = 0, xz = 0, found = false;
          for (k = 0; k < 5 && !found; k++) {
            let cx, cy, cz;
            if (p >= 0 && k === 0) { cx = B[pb]; cy = B[pb + 4]; cz = B[pb + 8]; }
            else if (p >= 0 && k === 1) { cx = B[pb + 2]; cy = B[pb + 6]; cz = B[pb + 10]; }
            else { const w = k - (p >= 0 ? 2 : 0); if (w < 0 || w > 2) continue; cx = w === 0 ? 1 : 0; cy = w === 1 ? 1 : 0; cz = w === 2 ? 1 : 0; }
            const d = cx * yx + cy * yy + cz * yz, vx = cx - d * yx, vy = cy - d * yy, vz = cz - d * yz, l = Math.hypot(vx, vy, vz);
            if (l > 0.2) { xx = vx / l; xy = vy / l; xz = vz / l; found = true; }
          }
          let zx = xy * yz - xz * yy, zy = xz * yx - xx * yz, zz = xx * yy - xy * yx;
          if (b.roll) {
            if (!Number.isFinite(b.roll)) fail("bone '" + b.name + "'.roll must be a number");
            const r = b.roll * DEG, c = Math.cos(r), s = Math.sin(r), nx = xx * c - zx * s, ny = xy * c - zy * s, nz = xz * c - zz * s;
            zx = xx * s + zx * c; zy = xy * s + zy * c; zz = xz * s + zz * c;
            xx = nx; xy = ny; xz = nz;
          }
          B[o] = xx; B[o + 1] = yx; B[o + 2] = zx; B[o + 3] = hx;
          B[o + 4] = xy; B[o + 5] = yy; B[o + 6] = zy; B[o + 7] = hy;
          B[o + 8] = xz; B[o + 9] = yz; B[o + 10] = zz; B[o + 11] = hz;
          BI[o] = xx; BI[o + 1] = xy; BI[o + 2] = xz; BI[o + 3] = -(xx * hx + xy * hy + xz * hz);
          BI[o + 4] = yx; BI[o + 5] = yy; BI[o + 6] = yz; BI[o + 7] = -(yx * hx + yy * hy + yz * hz);
          BI[o + 8] = zx; BI[o + 9] = zy; BI[o + 10] = zz; BI[o + 11] = -(zx * hx + zy * hy + zz * hz);
          if (p < 0) for (k = 0; k < 12; k++) sk.rest[o + k] = B[o + k];
          else mul34(sk.rest, o, BI, pb, B, o);
        }
        return sk;
      }
      system.make_skeleton = make_skeleton;
      system.mat_to_quat = mat_to_quat;

      // ========================================================================================================================
      // rig
      // ========================================================================================================================
// system.js, a part: the rig: the joints' limits and the chains that are solved, compiled from a definition (bone names, degrees, the model's axes) into the words of the worker's rig section (body.cpp).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- the rig ------------------------------------------------------------------------------------------------------------------------------------
      const IK_SOLVERS = { limb: 0, fabrik2d: 1, z_leg: 2, spring_leg: 3, tentacle: 4, arc: 5, insect_leg: 6, catenary: 7, trapezoid: 8, accordion: 9, curl_tip: 10, curl_base: 11, tentacle_generic: 12, shock_absorber: 13, whip: 14, fabrik: 15 };
      const SOLVER_BONES = { 0: 2, 2: 3 };                                  // the classic solvers that take a fixed number of bones: a limb has two, a z leg three
      const JOINT_KINDS = { free: 0, ball: 1, hinge: 2, fixed: 3 };
      const RJ_WORDS = 24, RC_HEAD = 11, RIG_MAX_CHAINS = 64, RIG_MAX_UNITS = 32, GROUP_MAX_SLOTS = 64, GROUP_MAX_EFF = 16;
      const JOINT_KEYS = ["bone", "kind", "fwd", "back", "out", "in", "lat", "up", "down", "twist", "out_dir", "side", "neutral", "axis", "range", "slide", "mirror"];
      const CHAIN_KEYS = ["name", "solver", "bones", "tip", "pole", "pole_w", "weight", "orient", "group", "mirror"];
      system.IK_SOLVERS = IK_SOLVERS;

      // a bone's frame at the bind pose: its axes as columns of the world rotation
      function bone_axes(sk, b) {
        const B = sk.bind, o = b * 12;
        return { x: [B[o], B[o + 4], B[o + 8]], y: [B[o + 1], B[o + 5], B[o + 9]], z: [B[o + 2], B[o + 6], B[o + 10]] };
      }
      function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
      function num(v, what, lo, hi) {
        if (typeof v !== "number" || !Number.isFinite(v)) fail(what + " must be a number");
        if (v < lo || v > hi) fail(what + " must be from " + lo + " to " + hi + " (" + v + ")");
        return v;
      }
      function range2(v, what, lo, hi) {
        if (typeof v === "number") { num(v, what, 0, hi); return [-v, v]; }
        if (!Array.isArray(v) || v.length !== 2) fail(what + " must be [low, high] or a number (the most, each way)");
        num(v[0], what + "[0]", lo, hi); num(v[1], what + "[1]", lo, hi);
        if (v[0] > v[1]) fail(what + " is [low, high]: " + v[0] + " is more than " + v[1]);
        return [v[0], v[1]];
      }

      // the joints of a definition -> the records of the section: [{ bone, kind, prism, px, nx, pz, nz, ref_yaw, tw_lo, tw_hi, h_lo, h_hi, s_lo, s_hi, axis, neutral }] (radians; the axis in the bone's own rest frame)
      function compile_joints(sk, joints) {
        if (joints === undefined || joints === null) return [];
        let list;
        if (Array.isArray(joints)) list = joints;
        else if (typeof joints === "object") list = Object.keys(joints).map(function (k) { return Object.assign({ bone: k }, joints[k]); });
        else fail("rig.joints must be a list or an object keyed by bone name");
        const seen = Object.create(null), out = [];
        list.forEach(function (j, i) {
          if (!j || typeof j !== "object") fail("rig.joints[" + i + "] must be an object");
          if (typeof j.bone !== "string" || sk.index[j.bone] === undefined) fail("rig.joints[" + i + "]: no bone named '" + j.bone + "'");
          const b = sk.index[j.bone], what = "joint of '" + j.bone + "'";
          only_keys(j, JOINT_KEYS, what);
          if (seen[b]) fail("the bone '" + j.bone + "' has two joints");
          seen[b] = true;
          if (sk.parent[b] < 0) fail("the root bone '" + j.bone + "' has no joint (a joint is between a bone and its parent)");
          let kind = j.kind;
          if (kind === undefined) kind = j.axis !== undefined || j.range !== undefined ? "hinge" : (j.slide !== undefined ? "fixed" : "ball");
          if (JOINT_KINDS[kind] === undefined) fail(what + ": kind must be ball, hinge, fixed or free (" + kind + ")");
          const rec = { bone: b, kind: JOINT_KINDS[kind], prism: 0, px: Math.PI, nx: Math.PI, pz: Math.PI, nz: Math.PI, ref_yaw: 0, tw_lo: -Math.PI, tw_hi: Math.PI, h_lo: -Math.PI, h_hi: Math.PI, s_lo: 0, s_hi: 0, axis: [1, 0, 0], neutral: [0, 0, 0, 1] };
          const R = bone_axes(sk, b);
          if (kind === "ball") {
            // the four directions a bone's axis may tilt to, across the bone: forward (the model's +z; for a bone that points forward, up) and back, and the lateral pair: out / in (out: away from the body's mid-plane for
            // a bone on one side, toward +x for one on the mid-plane, or toward out_dir) or, for a bone that lies along x (an arm in a T-pose), up / down
            const fwd = num(j.fwd === undefined ? 180 : j.fwd, what + ".fwd", 0, 180), back = num(j.back === undefined ? 180 : j.back, what + ".back", 0, 180);
            const ud = j.up !== undefined || j.down !== undefined;
            if (ud && (j.out !== undefined || j.in !== undefined || j.lat !== undefined || j.out_dir !== undefined || j.side !== undefined)) fail(what + ": `up` / `down` and `out` / `in` / `lat` / `out_dir` / `side` name the same pair of directions: give one of them");
            if (j.lat !== undefined && (j.out !== undefined || j.in !== undefined)) fail(what + ": `lat` is `out` and `in` both: give `lat` or `out` / `in`");
            const lo_ = ud ? j.up : (j.out === undefined ? j.lat : j.out), li_ = ud ? j.down : (j.in === undefined ? j.lat : j.in);
            const out_ = num(lo_ === undefined ? 180 : lo_, what + (ud ? ".up" : ".out"), 0, 180), in_ = num(li_ === undefined ? 180 : li_, what + (ud ? ".down" : ".in"), 0, 180);
            const tw = j.twist === undefined ? [-180, 180] : range2(j.twist, what + ".twist", -180, 180);
            if (tw[0] > 0 || tw[1] < 0) fail(what + ".twist [" + tw[0] + ", " + tw[1] + "] must contain 0: 0 is the bind pose, and the bone at rest is inside its joint (a bind pose that is turned has its `neutral`)");
            // the limit frame: its forward is the model's +z as nearly as the bone allows (across the bone's axis); a bone that points forward takes the up direction. The worker (rg_clamp_ellipse4) turns the
            // swing's (u, v) plane, u along the bone's x and v along its z, by `yaw` so that the ellipse's axes are  x_e = cos x_b + sin z_b  (the lateral one, radii px / nx)  and  z_e = -sin x_b + cos z_b  (forward: pz / nz)
            let f = [R.x[2], R.y[2], R.z[2]];                              // (+z of the model in the bone's own frame)
            if (Math.hypot(f[0], f[2]) < 0.3) f = [R.x[1], R.y[1], R.z[1]];
            const yaw = Math.atan2(-f[0], f[2]), c = Math.cos(yaw), s = Math.sin(yaw);
            const ex = [R.x[0] * c + R.z[0] * s, R.x[1] * c + R.z[1] * s, R.x[2] * c + R.z[2] * s];       // the limit frame's +x in the model: the lateral direction
            let od = j.out_dir, explicit = od !== undefined;
            if (ud) { od = [0, 1, 0]; explicit = true; }
            else if (od === undefined && j.side !== undefined) {
              if (j.side !== "left" && j.side !== "right") fail(what + ".side must be \"left\" or \"right\" (" + JSON.stringify(j.side) + ")");
              od = j.side === "left" ? [1, 0, 0] : [-1, 0, 0];
            } else if (od === undefined) od = sk.head[b * 3] > 1e-4 ? [1, 0, 0] : (sk.head[b * 3] < -1e-4 ? [-1, 0, 0] : [0, 0, 0]);      // (a bone on the left of the model, +x, has its "out" toward +x)
            vec3(od, what + ".out_dir");
            const odl = Math.hypot(od[0], od[1], od[2]), along = odl > 1e-9 ? Math.abs(ex[0] * od[0] + ex[1] * od[1] + ex[2] * od[2]) / odl : 0;
            if (along < 0.3) {                                                  // (the direction does not tell the two lateral ways apart: out is toward + of the lateral axis's biggest component)
              if (explicit) fail(what + ": " + (ud ? "up / down" : "out_dir") + " does not lie along the bone's lateral axis [" + ex.map(function (v) { return v.toFixed(2); }).join(", ") + "] (the lateral axis is across the bone and across forward)");
              const ax = Math.abs(ex[0]), ay = Math.abs(ex[1]), az = Math.abs(ex[2]);
              od = ax >= ay && ax >= az ? [1, 0, 0] : (ay >= az ? [0, 1, 0] : [0, 0, 1]);
            }
            const pos_out = ex[0] * od[0] + ex[1] * od[1] + ex[2] * od[2] >= 0;
            rec.px = (pos_out ? out_ : in_) * DEG; rec.nx = (pos_out ? in_ : out_) * DEG; rec.pz = fwd * DEG; rec.nz = back * DEG; rec.ref_yaw = yaw;
            rec.tw_lo = tw[0] * DEG; rec.tw_hi = tw[1] * DEG;
            if (j.neutral !== undefined) {
              if (!Array.isArray(j.neutral) || j.neutral.length !== 4) fail(what + ".neutral must be a quaternion [x, y, z, w]");
              const l = Math.hypot(j.neutral[0], j.neutral[1], j.neutral[2], j.neutral[3]);
              if (!(l > 1e-6)) fail(what + ".neutral is not a rotation");
              rec.neutral = j.neutral.map(function (v) { return v / l; });
            }
          } else if (kind === "hinge") {
            const axis = j.axis === undefined ? [1, 0, 0] : vec3(j.axis, what + ".axis");
            let a = [dot3(R.x, axis), dot3(R.y, axis), dot3(R.z, axis)];     // the axis in the bone's own rest frame, across the bone's own axis
            a[1] = 0;
            const l = Math.hypot(a[0], a[1], a[2]);
            if (!(l > 1e-3)) fail(what + ": the hinge's axis lies along the bone (a hinge turns across its bone)");
            rec.axis = [a[0] / l, 0, a[2] / l];
            const rg = j.range === undefined ? [-180, 180] : range2(j.range, what + ".range", -360, 360);
            if (rg[0] > 0 || rg[1] < 0) fail(what + ".range [" + rg[0] + ", " + rg[1] + "] must contain 0: 0 is the bind pose, and the bone at rest is inside its joint (a hinge that rests bent has its bind pose bent: the range is measured from it)");
            rec.h_lo = rg[0] * DEG; rec.h_hi = rg[1] * DEG;
          } else if (kind === "fixed") {
            if (j.slide !== undefined) {
              if (!Array.isArray(j.slide) || j.slide.length !== 2) fail(what + ".slide must be [low, high] (model units)");
              num(j.slide[0], what + ".slide[0]", -1e6, 1e6); num(j.slide[1], what + ".slide[1]", -1e6, 1e6);
              if (j.slide[0] > j.slide[1]) fail(what + ".slide is [low, high]");
              if (j.slide[0] > 0 || j.slide[1] < 0) fail(what + ".slide [" + j.slide[0] + ", " + j.slide[1] + "] must contain 0: the rest place is inside the slide");
              rec.prism = 1; rec.s_lo = j.slide[0]; rec.s_hi = j.slide[1];
            }
          }
          if (rec.kind === 0 && !rec.prism) return;                         // (a free bone needs no record)
          out.push(rec);
        });
        return out;
      }

      // the chains of a definition -> { chains: [{ name, solver, flags, bones, tip, unit, root, pole, pole_w, weight }], units: n }. Every mistake names the chain and the bone.
      function compile_chains(sk, chains) {
        if (chains === undefined || chains === null) return { chains: [], units: 0 };
        if (!Array.isArray(chains)) fail("rig.chains must be a list");
        if (chains.length > RIG_MAX_CHAINS) fail("a rig has at most " + RIG_MAX_CHAINS + " chains (" + chains.length + ")");
        const names = Object.create(null), unit_of = Object.create(null), unit_chains = [], bone_unit = new Int32Array(sk.n).fill(-1), bone_chain = new Array(sk.n).fill(null), out = [];
        chains.forEach(function (c, i) {
          if (!c || typeof c !== "object") fail("rig.chains[" + i + "] must be an object");
          if (typeof c.name !== "string" || c.name === "") fail("rig.chains[" + i + "] needs a name");
          if (names[c.name]) fail("two chains are called '" + c.name + "'");
          names[c.name] = true;
          const what = "chain '" + c.name + "'";
          only_keys(c, CHAIN_KEYS, what);
          const sname = c.solver === undefined ? "fabrik" : c.solver;
          if (IK_SOLVERS[sname] === undefined) fail(what + ": unknown solver '" + sname + "' (" + Object.keys(IK_SOLVERS).join(", ") + ")");
          const solver = IK_SOLVERS[sname];
          if (!Array.isArray(c.bones) || c.bones.length < 1) fail(what + ": bones must be a list of bone names, from the root down");
          const bones = c.bones.map(function (n) { if (typeof n !== "string" || sk.index[n] === undefined) fail(what + ": no bone named '" + n + "'"); return sk.index[n]; });
          if (solver !== 15 && bones.length < 2) fail(what + ": the solver " + sname + " takes at least two bones");
          if (SOLVER_BONES[solver] !== undefined && bones.length !== SOLVER_BONES[solver]) fail(what + ": the solver " + sname + " takes " + SOLVER_BONES[solver] + " bones (" + bones.length + " given)");
          const root = sk.parent[bones[0]];
          if (root < 0) fail(what + ": the first bone '" + sk.names[bones[0]] + "' is a root bone: a chain hangs from a bone whose frame is final (the pelvis, the chassis)");
          // each bone the child of the one before, each one continuing the one before along its axis
          const axis_check = function (parent_b, child_b) {
            const y = bone_axes(sk, parent_b).y, d = [sk.head[child_b * 3] - sk.head[parent_b * 3], sk.head[child_b * 3 + 1] - sk.head[parent_b * 3 + 1], sk.head[child_b * 3 + 2] - sk.head[parent_b * 3 + 2]];
            const along = dot3(d, y), dl = Math.hypot(d[0], d[1], d[2]), perp = Math.sqrt(Math.max(0, dl * dl - along * along));
            if (!(along > 1e-6) || perp > 2e-3 * dl + 1e-6) fail(what + ": the bone '" + sk.names[child_b] + "' does not continue '" + sk.names[parent_b] + "' along its axis (its head is " + perp.toFixed(4) + " off the axis, " + (Math.atan2(perp, along) / DEG).toFixed(1) +
              " degrees): the rig bends a chain about its joints, so a bone must point at the next one (give '" + sk.names[parent_b] + "' a tail at the head of '" + sk.names[child_b] + "', or take a bone between)");
          };
          for (let k = 0; k < bones.length; k++) {
            if (k > 0 && sk.parent[bones[k]] !== bones[k - 1]) fail(what + ": '" + sk.names[bones[k]] + "' is not a child of '" + sk.names[bones[k - 1]] + "' (a chain's bones are each the child of the one before)");
            if (k > 0) axis_check(bones[k - 1], bones[k]);
          }
          let tip = -1;
          if (c.tip !== undefined && c.tip !== null) {
            if (typeof c.tip !== "string" || sk.index[c.tip] === undefined) fail(what + ": no bone named '" + c.tip + "' (tip)");
            tip = sk.index[c.tip];
            if (sk.parent[tip] !== bones[bones.length - 1]) fail(what + ": the tip '" + c.tip + "' must be a child of the last bone '" + sk.names[bones[bones.length - 1]] + "'");
            axis_check(bones[bones.length - 1], tip);
          }
          let pole = [0, 0, 0];
          if (c.pole !== undefined && c.pole !== null) {
            vec3(c.pole, what + ".pole");
            const l = Math.hypot(c.pole[0], c.pole[1], c.pole[2]);
            if (l > 1e-9) pole = [c.pole[0] / l, c.pole[1] / l, c.pole[2] / l];
          }
          const pole_w = c.pole_w === undefined ? (pole[0] || pole[1] || pole[2] ? 1 : 0) : num(c.pole_w, what + ".pole_w", 0, 1);
          const weight = c.weight === undefined ? 1 : num(c.weight, what + ".weight", 0, 1);
          if (c.group !== undefined && typeof c.group !== "string") fail(what + ".group must be a string");
          out.push({ name: c.name, solver: solver, solver_name: sname, flags: c.orient ? 1 : 0, bones: bones, tip: tip, unit: -1, root: root, pole: pole, pole_w: pole_w, weight: weight, group: c.group });
        });
        // THE UNITS: what is solved together. A classic solver's chain is a unit of its own. FABRIK chains are one TREE when they have a bone in common (a spine that a head and two arms hang from: a pull on a hand pulls
        // the chest), and chains that share only their root (a person's two legs and its torso, hanging from the pelvis; the six legs of a machine on its body) are separate solves, each converging, stopping and starting
        // over on its own. A `group` names chains that are solved together although they share no bone (the same root and the same group, two chains that one result should serve).
        const uf = out.map(function (c, i) { return i; }), find = function (i) { while (uf[i] !== i) { uf[i] = uf[uf[i]]; i = uf[i]; } return i; }, joined = new Map();
        out.forEach(function (c, i) {
          if (c.solver !== 15) return;
          const keys = c.bones.concat(c.tip >= 0 ? [c.tip] : []).map(function (b) { return "b|" + c.root + "|" + b; });
          if (c.group !== undefined) keys.push("g|" + c.root + "|" + c.group);
          keys.forEach(function (k) { if (joined.has(k)) uf[find(i)] = find(joined.get(k)); else joined.set(k, i); });
        });
        out.forEach(function (c, i) {
          const key = c.solver === 15 ? "f|" + find(i) : "c|" + i;
          let unit = unit_of[key];
          if (unit === undefined) {
            unit = unit_chains.length;
            if (unit >= RIG_MAX_UNITS) fail("a rig has at most " + RIG_MAX_UNITS + " units (groups of chains solved together)");
            unit_of[key] = unit; unit_chains.push([]);
          }
          unit_chains[unit].push(i);
          c.unit = unit;
          c.bones.concat(c.tip >= 0 ? [c.tip] : []).forEach(function (b) {
            if (bone_unit[b] >= 0 && bone_unit[b] !== unit) fail("the bone '" + sk.names[b] + "' is solved by two units: chain '" + bone_chain[b] + "' and chain '" + c.name + "' (they hang from different roots or classic solvers: give them different bones)");
            bone_unit[b] = unit; bone_chain[b] = c.name;
          });
        });
        // the size of every unit: the root, its bones, a virtual end for every chain without a tip bone
        unit_chains.forEach(function (ci, u) {
          const slots = new Set([out[ci[0]].root]);
          let ends = 0;
          ci.forEach(function (c) { out[c].bones.forEach(function (b) { slots.add(b); }); if (out[c].tip >= 0) slots.add(out[c].tip); else ends++; });
          if (slots.size + ends > GROUP_MAX_SLOTS) fail("the unit of chain '" + out[ci[0]].name + "' has " + (slots.size + ends) + " bones: at most " + GROUP_MAX_SLOTS + " (split the chains into groups)");
          if (ci.length > GROUP_MAX_EFF) fail("the unit of chain '" + out[ci[0]].name + "' has " + ci.length + " chains: at most " + GROUP_MAX_EFF);
        });
        return { chains: out, units: unit_chains.length };
      }

      // the rig section: [flags, nj, nc] the joint records, the chains (see body.cpp for the layout)
      function compile_rig(sk, input) {
        if (input === undefined || input === null) return null;
        if (typeof input !== "object" || Array.isArray(input)) fail("rig must be an object { joints, chains }");
        only_keys(input, ["joints", "chains"], "rig");
        const rig = expand_rig(input);
        const joints = compile_joints(sk, rig.joints), cc = compile_chains(sk, rig.chains);
        let n = 3 + joints.length * RJ_WORDS;
        cc.chains.forEach(function (c) { n += RC_HEAD + c.bones.length; });
        const words = new Uint32Array(n), fw = new Float32Array(words.buffer);
        let k = 0;
        words[k++] = 0; words[k++] = joints.length; words[k++] = cc.chains.length;
        joints.forEach(function (j) {
          words[k] = j.bone; words[k + 1] = j.kind; words[k + 2] = j.prism;
          fw[k + 3] = j.px; fw[k + 4] = j.nx; fw[k + 5] = j.pz; fw[k + 6] = j.nz; fw[k + 7] = j.ref_yaw; fw[k + 8] = j.tw_lo; fw[k + 9] = j.tw_hi; fw[k + 10] = j.h_lo; fw[k + 11] = j.h_hi; fw[k + 12] = j.s_lo; fw[k + 13] = j.s_hi;
          fw[k + 14] = j.axis[0]; fw[k + 15] = j.axis[1]; fw[k + 16] = j.axis[2]; fw[k + 17] = j.neutral[0]; fw[k + 18] = j.neutral[1]; fw[k + 19] = j.neutral[2]; fw[k + 20] = j.neutral[3];
          k += RJ_WORDS;
        });
        cc.chains.forEach(function (c) {
          words[k] = c.solver; words[k + 1] = c.flags; words[k + 2] = c.bones.length; words[k + 3] = c.tip >= 0 ? c.tip + 1 : 0; words[k + 4] = c.unit; words[k + 5] = c.root;
          fw[k + 6] = c.pole[0]; fw[k + 7] = c.pole[1]; fw[k + 8] = c.pole[2]; fw[k + 9] = c.pole_w; fw[k + 10] = c.weight;
          for (let j = 0; j < c.bones.length; j++) words[k + RC_HEAD + j] = c.bones[j];
          k += RC_HEAD + c.bones.length;
        });
        return { words: words, joints: joints, chains: cc.chains, units: cc.units };
      }
      system.compile_rig = compile_rig; system.compile_joints = compile_joints; system.compile_chains = compile_chains;

      // ========================================================================================================================
      // gaits
      // ========================================================================================================================
// system.js, a part: the library of GAIT STYLES: ways of walking, trotting and running that a creature of any shape can take (SYSTEM.md, "the gait styles").
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- gait styles ----------------------------------------------------------------------------------------------------------------------------------
      // A style is a recorded gait taken out of its clip (the gait of every clip of an animal or a person that walks, trots or runs): how fast the body goes, how long a step is, how much of a cycle a foot is in the air,
      // how high it lifts, how far the hips bob, how high the hips ride, and when each limb steps after the first one. The numbers are in the units of the animal that walked (a leg length, a hips' height, a share of a
      // cycle), so any creature can take them: its legs' length makes them its own and each of its legs steps like the limb of its side and rank. A creature's legs name a style where they would give numbers:
      // `legs: { gait: { from: "lion_walk" } }` or `gaits: [{ from: "jackal_walk" }, { from: "jackal_run" }]` (kernel.js).
      //   system.gaits.add(style | [styles] | library)     register styles: { name, species, source, legs, pattern, tags, speed, stride, swing, step_height, bob, ride (a share of the creature's own: 1), cycle, phase: { fl, fr, ml, mr, hl, hr }, ... }, by their names
      //   system.gaits.load(url) -> Promise<[names]>        a library file (happy_gaits/*.gaits.json)      system.gaits.decode(text | object) -> { description, gaits }      system.gaits.get(name)      system.gaits.names()      system.gaits.clear()
      //   `path` is how the foot goes through a step, fitted to the clip: 2 to 8 knots [progress along the step 0..1, height over the line between the ends as minus a share of the step height], and `path_tangent` the tangent of
      // the spline through them (the knots are where the swing is at j / (n - 1) of its smoothstep time): the gait of the worker walks it in place of its own trapezoid.
      //   `feet` is what the foot and the knee do through a step, three tables of 16 numbers over the foot's own cycle (it leaves the floor at 0), degrees: `pitch` (the toe up is positive, 0 is flat on the floor), `yaw`
      // (the toes out) and `knee` (the way the knee points: out). The worker turns the foot by them and rolls it on the floor (the heel strikes, the sole comes down, the heel rises, the toe is down in the swing).
      //   `upper` is what everything above the legs does over a cycle of the steps: { ref, hips, spine, neck, head: { yaw, pitch, roll }, arm_l, arm_r: { x, y, z } }, each channel [mean, A1, p1, A2, p2, A3, p3] (a mean and up
      // to three harmonics of the cycle, an amplitude and a phase each: degrees, or arm lengths for a hand), the cycle counted from the step of the limb `ref` (the one with phase 0). It is kept and checked with the style but
      // nothing plays it yet: the bones above the legs get their roles in a later layer of system.
      //   system.gaits.list({ legs, pattern, tag, species, generic, text, upper, feet }) -> [styles]      the ones that have what the filter says (a tag, a number of legs, a word of the name or the description)
      //   system.gaits.resolve      a function a host sets for a style that is not registered: it may register more (a node tool reads the libraries of happy_gaits/ from disk); a page uses system.gaits.load first
      const gait_table = {}, GAIT_SLOTS = ["fl", "fr", "ml", "mr", "hl", "hr"], GAIT_FILE_FORMAT = "happy.gaits", GAIT_FILE_VERSION = 1, FEET_N = 16;
      // the upper body of a style: the parts and their axes (hips, spine, neck and head are turned: yaw to the left, pitch up, roll tilting to the right, degrees; a hand is a place from the shoulder in the chest's frame, arm lengths: x OUT, y up, z forward)
      const UPPER_AXES = { hips: ["yaw", "pitch", "roll"], spine: ["yaw", "pitch", "roll"], neck: ["yaw", "pitch", "roll"], head: ["yaw", "pitch", "roll"], arm_l: ["x", "y", "z"], arm_r: ["x", "y", "z"] };
      function upper_make(u, phase, errs) {
        if (!u || typeof u !== "object" || Array.isArray(u)) { errs.push("upper is { ref, hips, spine, neck, head, arm_l, arm_r }: each part an object of channels, a channel [mean, A1, p1, A2, p2, A3, p3]"); return null; }
        const out = {};
        Object.keys(u).forEach(function (g) {
          const src = u[g];
          if (g === "ref") {
            if (typeof src !== "string" || !phase || phase[src] !== 0) errs.push("upper.ref = " + JSON.stringify(src) + " is not a limb that steps first (a limb of the phase with the number 0)");
            else out.ref = src;
            return;
          }
          if (!UPPER_AXES[g]) { errs.push("upper." + g + " is not a part of the upper body (" + Object.keys(UPPER_AXES).join(", ") + ")"); return; }
          if (!src || typeof src !== "object" || Array.isArray(src)) { errs.push("upper." + g + " is { " + UPPER_AXES[g].join(", ") + " }, each a channel [mean, A1, p1, A2, p2, A3, p3]"); return; }
          const hand = g.indexOf("arm") === 0, o = {};
          Object.keys(src).forEach(function (ax) {
            const c = src[ax], where = "upper." + g + "." + ax;
            if (UPPER_AXES[g].indexOf(ax) < 0) { errs.push(where + " is not an axis of " + g + " (" + UPPER_AXES[g].join(", ") + ")"); return; }
            if (!Array.isArray(c) || (c.length !== 1 && c.length !== 3 && c.length !== 5 && c.length !== 7) || c.some(function (v) { return typeof v !== "number" || !Number.isFinite(v); })) { errs.push(where + " is [mean, A1, p1, A2, p2, A3, p3]: a mean and up to three harmonics (an amplitude and a phase each)"); return; }
            if (Math.abs(c[0]) > (hand ? 3 : 180)) errs.push(where + ": the mean " + c[0] + " is out of range");
            for (let q = 1; q < c.length; q += 2) {
              if (!(c[q] >= 0 && c[q] <= (hand ? 2 : 90))) errs.push(where + ": the amplitude " + c[q] + " is out of range");
              if (!(c[q + 1] >= 0 && c[q + 1] < 1)) errs.push(where + ": the phase " + c[q + 1] + " is not a share of a cycle (0 to under 1)");
            }
            o[ax] = Object.freeze(c.slice());
          });
          out[g] = Object.freeze(o);
        });
        return Object.freeze(out);
      }
      // the foot's path of a style: 2 to 8 knots [progress 0 .. 1, height]: the height is minus the share of the step's height that the foot is over the line between the two ends (up is negative, as the gait's own path)
      function path_make(p, errs) {
        if (!Array.isArray(p) || p.length < 2 || p.length > PATH_POINTS) { errs.push("path is 2 to " + PATH_POINTS + " knots [progress, height]"); return null; }
        const out = [];
        p.forEach(function (k, i) {
          if (!Array.isArray(k) || k.length !== 2 || k.some(function (v) { return typeof v !== "number" || !Number.isFinite(v); })) errs.push("path[" + i + "] is [progress, height]");
          else if (!(k[0] >= 0 && k[0] <= 1)) errs.push("path[" + i + "]: the progress " + k[0] + " is not a share of the step (0 to 1)");
          else if (Math.abs(k[1]) > 4) errs.push("path[" + i + "]: the height " + k[1] + " is out of range (a share of the step's height: -4 to 4)");
          else out.push(Object.freeze(k.slice()));
        });
        return out.length === p.length ? Object.freeze(out) : null;
      }
      // the feet of a style: three tables of FEET_N numbers over the foot's own cycle (degrees)
      const FEET_TABLES = [["pitch", 90], ["yaw", 60], ["knee", 60]];
      function feet_make(f, errs) {
        if (!f || typeof f !== "object" || Array.isArray(f)) { errs.push("feet is { pitch, yaw, knee }: three tables of " + FEET_N + " numbers over the foot's own cycle (degrees)"); return null; }
        const out = {}, n0 = errs.length;
        Object.keys(f).forEach(function (k) { if (!FEET_TABLES.some(function (x) { return x[0] === k; })) errs.push("feet." + k + " is not a table of the foot (pitch, yaw, knee)"); });
        FEET_TABLES.forEach(function (tb) {
          const a = f[tb[0]];
          if (a === undefined) { out[tb[0]] = Object.freeze(new Array(FEET_N).fill(0)); return; }
          if (!Array.isArray(a) || a.length !== FEET_N || a.some(function (v) { return typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > tb[1]; })) { errs.push("feet." + tb[0] + " is " + FEET_N + " numbers, degrees, none over " + tb[1]); return; }
          out[tb[0]] = Object.freeze(a.slice());
        });
        return errs.length > n0 ? null : Object.freeze(out);
      }
      // one style of a library -> its stored form (a frozen copy), or throws with every complaint of it
      function gait_style_make(s, i) {
        if (!s || typeof s !== "object" || Array.isArray(s)) throw new Error("system: gaits: #" + i + ": a style is an object { name, speed, stride, swing, step_height, bob, phase }");
        const who = typeof s.name === "string" && s.name ? "'" + s.name + "'" : "#" + i, errs = [];
        if (typeof s.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(s.name)) errs.push("name is letters, digits and _ (a style is taken by its name: from: \"name\")");
        const num = function (k, lo, hi, lo_open, hi_open) { const v = s[k]; if (typeof v !== "number" || !Number.isFinite(v) || (lo_open ? !(v > lo) : !(v >= lo)) || (hi_open ? !(v < hi) : !(v <= hi))) errs.push(k + " = " + v + " is out of range (" + lo + (lo_open ? " not included" : "") + " to " + hi + (hi_open ? " not included" : "") + ")"); };
        num("speed", 0, 1000, true, false); num("stride", 0, 1000, true, false); num("swing", 0, 1, true, true);
        if (s.step_height !== undefined) num("step_height", 0, 100, false, false);
        if (s.bob !== undefined) num("bob", 0, 100, false, false);
        if (s.ride !== undefined) num("ride", 0.1, 3, true, false);
        if (s.cycle !== undefined) num("cycle", 0, 1000, true, false);
        let phase = null;
        if (!s.phase || typeof s.phase !== "object" || Array.isArray(s.phase)) errs.push("phase is { fl, fr, ml, mr, hl, hr }: the share of a cycle each limb steps after the first (the limbs the animal had: two at least)");
        else {
          phase = {};
          Object.keys(s.phase).forEach(function (k) {
            if (GAIT_SLOTS.indexOf(k) < 0) errs.push("phase." + k + " is not a limb (" + GAIT_SLOTS.join(", ") + ")");
            else if (typeof s.phase[k] !== "number" || !(s.phase[k] >= 0 && s.phase[k] <= 1)) errs.push("phase." + k + " = " + s.phase[k] + " is not a share of a cycle (0 to 1)");
            else phase[k] = s.phase[k];
          });
          if (Object.keys(phase).length < 2) errs.push("phase has " + Object.keys(phase).length + " limbs: a gait is the steps of two at least");
        }
        let upper = null, path = null, feet = null;
        if (s.upper !== undefined && s.upper !== null) upper = upper_make(s.upper, phase, errs);
        if (s.path !== undefined && s.path !== null) path = path_make(s.path, errs);
        if (s.feet !== undefined && s.feet !== null) feet = feet_make(s.feet, errs);
        if (s.path_tangent !== undefined && !(typeof s.path_tangent === "number" && s.path_tangent > 0 && s.path_tangent <= 2)) errs.push("path_tangent = " + s.path_tangent + " is out of range (above 0, to 2: the tangent of the spline through the path's knots)");
        if (s.tags !== undefined && (!Array.isArray(s.tags) || s.tags.some(function (x) { return typeof x !== "string"; }))) errs.push("tags is a list of words");
        ["species", "source", "pattern", "description"].forEach(function (k) { if (s[k] !== undefined && typeof s[k] !== "string") errs.push(k + " is text"); });
        if (errs.length) throw new Error("system: gaits: " + who + ": " + errs.slice(0, 6).join("; ") + (errs.length > 6 ? "; and " + (errs.length - 6) + " more" : ""));
        const out = { name: s.name, species: s.species || "", source: s.source || "", legs: Object.keys(phase).length, pattern: s.pattern || "", tags: s.tags ? s.tags.slice() : [], generic: !!s.generic, speed: s.speed, stride: s.stride, swing: s.swing,
          step_height: s.step_height || 0, bob: s.bob || 0, ride: s.ride !== undefined ? s.ride : 1, cycle: s.cycle !== undefined ? s.cycle : 2 * s.stride / s.speed, phase: Object.freeze(phase), upper: upper, path: path, feet: feet, path_tangent: s.path_tangent !== undefined ? s.path_tangent : 0.5, description: s.description || "" };
        out.tags = Object.freeze(out.tags);
        return Object.freeze(out);
      }
      // a library: the text of a file or its object { format, version, description, gaits: [styles] } -> { description, gaits: [stored styles] }; every style that is wrong is named
      function gaits_decode(source) {
        let raw = source;
        if (typeof source === "string") {
          try { raw = JSON.parse(source); } catch (e) {
            throw new Error("system: gaits: json error: " + e.message);
          }
        }
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("system: gaits: a library is { format: \"" + GAIT_FILE_FORMAT + "\", version: 1, gaits: [styles] }");
        if (raw.format !== GAIT_FILE_FORMAT) throw new Error("system: gaits: format must be \"" + GAIT_FILE_FORMAT + "\" (it is " + JSON.stringify(raw.format) + ")");
        if (raw.version !== GAIT_FILE_VERSION) throw new Error("system: gaits: version must be " + GAIT_FILE_VERSION + " (" + raw.version + "): this system reads version " + GAIT_FILE_VERSION);
        if (!Array.isArray(raw.gaits)) throw new Error("system: gaits: gaits is the list of the styles");
        const out = [], errs = [], seen = {};
        raw.gaits.forEach(function (s, i) {
          try {
            const g = gait_style_make(s, i);
            if (seen[g.name]) errs.push("system: gaits: '" + g.name + "' is in the library twice"); seen[g.name] = true; out.push(g);
          } catch (e) { errs.push(e.message); }
        });
        if (errs.length) throw new Error(errs.slice(0, 6).join("\n") + (errs.length > 6 ? "\n... and " + (errs.length - 6) + " more" : ""));
        return {
          description: typeof raw.description === "string" ? raw.description : "", gaits: out
        };
      }
      system.gaits = {
        FORMAT: GAIT_FILE_FORMAT, VERSION: GAIT_FILE_VERSION, SLOTS: GAIT_SLOTS.slice(),
        decode: gaits_decode,
        add: function (v) {
          const list = v && v.format === GAIT_FILE_FORMAT ? gaits_decode(v).gaits : (Array.isArray(v) ? v : [v]).map(function (s, i) { return s && Object.isFrozen(s) && s.phase && Object.isFrozen(s.phase) ? s : gait_style_make(s, i); });
          list.forEach(function (g) { gait_table[g.name] = g; });
          return list.map(function (g) { return g.name; });
        },
        load: function (url) {
          return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("system: gaits: " + r.status + " " + url); return r.text(); }).then(function (text) { return system.gaits.add(gaits_decode(text).gaits); });
        },
        get: function (name) { return gait_table[name] || null; },
        names: function () { return Object.keys(gait_table); },
        list: function (f) {
          f = f || {};
          const q = f.text ? String(f.text).toLowerCase() : "";
          return Object.keys(gait_table).map(function (k) { return gait_table[k]; }).filter(function (g) {
            return (f.legs === undefined || g.legs === f.legs) && (!f.pattern || g.pattern === f.pattern) && (!f.tag || g.tags.indexOf(f.tag) >= 0) && (f.species === undefined || g.species === f.species) && (f.generic === undefined || g.generic === !!f.generic)
              && (f.upper === undefined || !!g.upper === !!f.upper) && (f.feet === undefined || !!g.feet === !!f.feet)
              && (!q || g.name.toLowerCase().indexOf(q) >= 0 || g.tags.join(" ").toLowerCase().indexOf(q) >= 0 || g.description.toLowerCase().indexOf(q) >= 0 || g.species.toLowerCase().indexOf(q) >= 0);
          });
        },
        clear: function () { Object.keys(gait_table).forEach(function (k) { delete gait_table[k]; }); },
        resolve: null
      };

      // ========================================================================================================================
      // legs
      // ========================================================================================================================
// system.js, a part: the legs and the body of a species, compiled from a definition (bone and chain names, model units) into the words of the worker's legs section (body.cpp) and body section (body.cpp).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- the legs and the body -----------------------------------------------------------------------------------------------------------------------
      //   legs: { body?: "hips", legs: ["leg_l", "leg_r"] | [{ chain, phase?, foot_height?, foot?: { ball, heel }, mirror? }], pattern?: "alternate" | "walk" | "bound" | "gallop" | "pronk", phases_from?: style | false, script?: true | false, gait?: {...}, gaits?: [{...}, ...] }
      //     a LEG is a chain of the rig whose end (the head of its tip bone, else the tail of its last bone: the ankle) is put where the foot stands; its hip is the head of the chain's first bone, its length the way along
      //     the chain's bones, the height of its end over the floor (y = 0) at the bind pose the foot's height. `body`: the bone that carries the ride height (the pelvis: the hips are a pose of it), by default the bone
      //     that every leg hangs from. `phase` (0 .. 1: where in the cycle the leg steps) by default from the pattern and the legs' layout: any number of legs, a biped's two, a quadruped's four, an insect's six, or from the style
      //     the first gait takes (`phases_from`: another style's, or false for the pattern's). `foot: { ball, heel }`: how far in front of the ankle the ball of the foot is and how far behind it the heel (model units: where the sole
      //     turns on the floor when the foot rolls), by default from the skeleton (the toe bone under the tip bone, else 0.62 of the tip bone's length for the ball, 0.45 of that for the heel)
      //   gait numbers (model units; what a leg's length says unless the definition gives them): ride (the body bone's height over the floor, standing), speed (the walk speed the stride is made for), warp, swing (the share of
      //     the cycle a foot is in the air), stride (the distance of a step at the walk speed), step_height, reach, apex, forward_bias, max_reach (the share of the leg's length a foot may stretch to), stance (the spread of
      //     the feet), bob, run_stride, run_swing, run_step_height, max_run, crouch, tilt, and `path`: the foot's way over a step, [[progress, height, 0, tangent], ...] 2 to 8 points
      //   a gait FROM A STYLE (kernel.js, happy_gaits/): { from: "lion_walk", ...numbers of its own, feet?: true | false | { pitch, yaw, knee } }: the style's numbers made the creature's own (the speed, the stride and the
      //     step's height in leg lengths of the first leg, the bob in hips' heights, the hips' height as a share of its own), its foot path, the order the legs step in (the limb of the same side and rank, else the style's
      //     pattern made for these legs) and its FEET (what each foot and knee do through a step: shares of what the style says, the knee 0.7 by default); what the gait names itself is over what the style says
      //   body: { max_speed?, accel?, turn_rate?, ground?, offset?, turn_radius?, gravity?, air_control?, step?, radius? }  (step: the highest prop of the physics world it climbs onto, 0.3 of a leg's length; radius: how far short of a wall it stops, 0.25 of a leg's length; 0 for either: no props / no walls: SYSTEM.md, the physics world)  the root's mover (body.cpp): `sp.set_intent(c, vx, vz, fx, fz)` says where an instance wants to go; it accelerates, turns (by the legs' steps) and stays on the ground
      const SEC_BODY = 1, SEC_LEGS = 4, MAX_LEGS = 8, MAX_GAITS = 16, PATH_POINTS = 8, LEG_WORDS = 16;
      const GAIT_FIELDS = ["ride", "speed", "warp", "swing", "stride", "step_height", "reach", "apex", "forward_bias", "max_reach", "stance", "bob", "run_stride", "run_swing", "run_step_height", "max_run", "crouch", "tilt"];
      const GAIT_WORDS = GAIT_FIELDS.length + 1 + PATH_POINTS * 4;
      const LEGS_KEYS = ["body", "legs", "gait", "gaits", "slots", "pattern", "phases_from", "script"], LEG_KEYS = ["chain", "phase", "foot_height", "foot", "mirror"], BODY_KEYS = ["max_speed", "accel", "turn_rate", "ground", "offset", "turn_radius", "gravity", "air_control", "step", "radius"];
      const LEGS_FEET = 1, LEGS_SCRIPT = 4, FEET_WORDS = 1 + 3 * FEET_N;                           // the section's flag: the gaits have feet; per gait a mask and the three tables (radians)
      const PATTERNS = ["alternate", "walk", "wave", "bound", "gallop", "pronk", "hop"];
      system.GAIT_FIELDS = GAIT_FIELDS;
      // the ranges the worker checks (happy_legs_gait_ok)
      function gait_ok(k, v) {
        if (typeof v !== "number" || !Number.isFinite(v)) return false;
        switch (k) {
          case "ride": case "speed": case "warp": case "stride": case "apex": case "stance": return v > 1e-4 && v < 1e6;
          case "swing": return v > 0 && v <= 0.8;
          case "max_reach": return v > 0 && v <= 1;
          case "max_run": return v >= 1 && v < 100;
          case "step_height": case "bob": case "crouch": case "reach": case "tilt": return v >= 0 && v < 1e6;
          case "forward_bias": return v > -1e3 && v < 1e3;
          case "run_stride": case "run_swing": case "run_step_height": return v >= 0 && v < 100;
        }
        return false;
      }
      system.gait_ok = gait_ok;

      // the LAYOUT of the legs of a creature of any number of them: told by where along the body their hips are: the ranks, front to hind (the legs of one rank are a pair, a left and a right; one rank is a biped's),
      // `index` the number of a leg's rank (0 the front one), `name` f, m or h (the front rank, the ranks between, the hind one: what a style's six limbs are called), `count` the number of ranks. A creature whose legs are as
      // many on the left as on the right takes a leg's rank from its place among the legs of its side (a spider's hips are a few centimetres apart along the body, far less than its legs are long); else the legs are
      // clustered by their distance along the body. One rank (a biped's two legs, a creature of one pair) is the hind one
      function leg_layout(legs) {
        const n = legs.side.length, along = legs.along, idx = new Array(n).fill(0), nm = new Array(n).fill("h");
        if (n < 2) return { index: idx, name: nm, count: 1 };
        const lefts = [], rights = [];
        for (let j = 0; j < n; j++) (legs.side[j] > 0 ? lefts : rights).push(j);
        if (lefts.length === rights.length && lefts.length >= 1) {
          const R = lefts.length;
          [lefts, rights].forEach(function (list) { list.sort(function (a, b) { return along[b] - along[a]; }); list.forEach(function (j, r) { idx[j] = r; nm[j] = R === 1 ? "h" : (r === 0 ? "f" : (r === R - 1 ? "h" : "m")); }); });
          return { index: idx, name: nm, count: R };
        }
        let lo = Infinity, hi = -Infinity;
        along.forEach(function (z) { if (z < lo) lo = z; if (z > hi) hi = z; });
        const mean = legs.length.reduce(function (s, v) { return s + v; }, 0) / n, tol = Math.max(0.25 * (hi - lo), 0.15 * mean);
        const order = along.map(function (z, j) { return j; }).sort(function (a, b) { return along[b] - along[a]; }), ranks = [];
        order.forEach(function (j) { const r = ranks[ranks.length - 1]; if (r && Math.abs(r.z - along[j]) <= tol) r.list.push(j); else ranks.push({ z: along[j], list: [j] }); });
        ranks.forEach(function (r, i) { const name = ranks.length === 1 ? "h" : (i === 0 ? "f" : (i === ranks.length - 1 ? "h" : "m")); r.list.forEach(function (j) { idx[j] = i; nm[j] = name; }); });
        return { index: idx, name: nm, count: ranks.length };
      }
      // the PHASES of the legs for a pattern of steps (the order a gait steps its legs in): `alternate` (a biped's walk, a quadruped's trot, an insect's tripod, a spider's two sets of four: neighbours, front to back and
      // across, are half a cycle apart), `walk` / `wave` (a wave from the hind legs to the front ones, the other side half a cycle behind: the lateral sequence of a quadruped's walk), `bound` (the legs of a rank together,
      // the ranks alternating), `gallop` (a bound whose right legs are a little behind), `pronk` / `hop` (all together)
      function pattern_phases(layout, side, pattern) {
        const R = Math.max(1, layout.count);
        return layout.index.map(function (r, j) {
          const sd = side[j] > 0 ? 0 : 1;
          switch (pattern) {
            case "walk": case "wave": return (((R - 1 - r) / R) * 0.5 + 0.5 * sd) % 1;
            case "bound": return (r % 2) * 0.5;
            case "gallop": return ((r % 2) * 0.5 + 0.1 * sd) % 1;
            case "pronk": case "hop": return 0;
            default: return ((r + sd) % 2) * 0.5;
          }
        });
      }
      system.leg_layout = leg_layout; system.pattern_phases = pattern_phases;

      // ---- a gait FROM A STYLE of the library (kernel.js): the numbers, the order of the steps and the feet of a recorded gait made the legs of THIS creature's own --------------------------------------------------
      // The numbers of a style are in the units of the animal that walked: the speed, the stride and the step's height in its leg lengths, the bob in its hips' heights, the hips' height as a share of its walk's. They are
      // multiplied by the first leg's length and the hips' height of this creature. The legs of a creature are told by their side and by where along the body their hips are (the front pair, the middle pair, the hind
      // pair; legs that are all in one place, a biped's, are the hind ones) and a leg takes the step of the limb of the same side and rank that the style has: a front leg takes the front limb's (else the middle one's),
      // a hind leg the hind limb's (else the middle one's), a middle leg the middle's (else the hind, else the front). A LIMB DRIVES ONE LEG OF ITS SIDE: the legs of the exact rank are served first and a leg that is
      // left asks for its next best limb only if that one is free. When every leg has a limb of its own in the style the order of the steps is the style's; else (a style of two legs or four on a creature of six or
      // eight, whose middle legs share the limbs or have none) it is the style's PATTERN made for these legs: alternate, walk, bound, gallop ... (two legs that took the same limb would step together)
      function body_legmap(slots, legs) {                                   // -> for each leg the limb of the style it takes (0 .. 5, GAIT_SLOTS), -1 for none
        const lay = leg_layout(legs), ranks = lay.name, have = {}, out = legs.side.map(function () { return -1; }), taken = {};
        slots.forEach(function (s) { have[s] = true; });
        for (let q = 0; q < 3; q++) {                                       // (round q: every leg that has no limb yet asks for its q-th best; a limb goes to the leg of the rank nearest to the limb's place)
          const want = {};
          legs.side.forEach(function (_, j) {
            if (out[j] >= 0) return;
            const side = legs.side[j] > 0 ? "l" : "r", order = ranks[j] === "f" ? ["f", "m"] : (ranks[j] === "m" ? ["m", "h", "f"] : ["h", "m"]);
            if (q >= order.length) return;
            const slot = order[q] + side;
            if (have[slot] && !taken[slot]) (want[slot] = want[slot] || []).push(j);
          });
          Object.keys(want).forEach(function (slot) {
            const target = slot.charAt(0) === "f" ? 0 : (slot.charAt(0) === "h" ? lay.count - 1 : 0.5 * (lay.count - 1));
            want[slot].sort(function (a, b) { return Math.abs(lay.index[a] - target) - Math.abs(lay.index[b] - target) || a - b; });
            out[want[slot][0]] = GAIT_SLOTS.indexOf(slot); taken[slot] = true;
          });
        }
        return out;
      }
      function recorded_gait(name, tag) {
        if (typeof name !== "string" || !name) fail(tag + "a gait is taken from the NAME of a gait style (system.gaits)");
        let s = system.gaits.get(name);
        if (!s && typeof system.gaits.resolve === "function") { system.gaits.resolve(name); s = system.gaits.get(name); }
        if (!s) {
          const known = system.gaits.names();
          fail(tag + "no gait style '" + name + "' (system.gaits.add or system.gaits.load it first; " + (known.length ? "known: " + known.slice(0, 6).join(", ") + (known.length > 6 ? " ... " + known.length + " in all" : "") : "there are none yet") + ")");
        }
        return s;
      }
      function gait_from(s, L, hips_h, ride0) {                           // the numbers of a gait of the worker (the half of the bob's range is its amplitude)
        const o = { speed: s.speed * L, stride: s.stride * L, swing: Math.min(0.8, s.swing), step_height: Math.max(0, s.step_height || 0) * L, bob: 0.5 * Math.max(0, s.bob || 0) * hips_h };
        if (s.path) o.path = s.path.map(function (k) { return [k[0], k[1], 0, s.path_tangent || 0.5]; });                // (the foot's path fitted to the clip: the gait walks it in place of its own trapezoid)
        if (ride0 > 0) o.ride = ride0 * s.ride;                                                                         // (a style of a person has a posture: the hips' height as a share of the plain walk's: the creature's own ride height times it; a later gait is the creature's own height too, not the first gait's)
        return o;
      }
      // -> for each leg its phase: the one of the limb of its side and rank in the style when every leg has a limb of its own in it, else the phases of the style's PATTERN made for these legs
      function recorded_phases(s, per) {
        const legs = { side: per.map(function (p) { return p.side; }), along: per.map(function (p) { return p.hip[2]; }), length: per.map(function (p) { return p.length; }) };
        const map = body_legmap(Object.keys(s.phase), legs), ph = s.phase;
        const direct = map.every(function (sl) { const d = sl >= 0 ? ph[GAIT_SLOTS[sl]] : undefined; return d >= 0 && d <= 1; }) && new Set(map).size === map.length;
        if (!direct) return pattern_phases(leg_layout(legs), legs.side, s.pattern);
        return map.map(function (sl) { return (1 - ph[GAIT_SLOTS[sl]]) % 1; });                                         // (the style says how long AFTER the first limb a limb steps, in cycles; the worker's phase is how far ahead of the cycle a leg is: a leg that steps later is behind: 1 - d)
      }
      // THE FEET of a gait: a style's `feet` are three tables over the foot's own cycle: its pitch, its yaw and the way its knee points (degrees: the toe up, the toes out and the knee out are positive). The gait's say on them
      // is `feet`: true (the defaults), false (the feet stay flat, the knee as the chain has it) or { pitch, yaw, knee }, shares of what the style says (0 to 4: 1 is all of it; the knee is 0.7 by default: the actor's knees
      // point out further than most creatures' do). The worker takes them in radians
      const FEET_SCALES = { pitch: 1, yaw: 1, knee: 0.7 };
      function feet_say(v, tag) {
        if (v === false) return false;
        const say = Object.assign({}, FEET_SCALES);
        if (v === undefined || v === null || v === true) return say;
        if (typeof v !== "object" || Array.isArray(v)) fail(tag + "feet is true, false or { pitch, yaw, knee } (shares of what the style says)");
        for (const k in v) {
          if (FEET_SCALES[k] === undefined) fail(tag + "unknown feet field '" + k + "' (pitch, yaw, knee)");
          if (typeof v[k] !== "number" || !Number.isFinite(v[k]) || v[k] < 0 || v[k] > 4) fail(tag + "feet " + k + " = " + v[k] + " is out of range (0 to 4: a share of what the style says)");
          say[k] = v[k];
        }
        return say;
      }
      function feet_table(fe, say) {
        const t = new Float32Array(3 * FEET_N);
        ["pitch", "yaw", "knee"].forEach(function (k, i) { for (let j = 0; j < FEET_N; j++) t[i * FEET_N + j] = fe[k][j] * DEG * say[k]; });
        return t;
      }
      // THE UPPER BODY of a gait (body.js, body.cpp). A style of the library has `upper`: what the hips, the spine, the neck, the head and the two hands do over a cycle of the steps (kernel.js: a mean and up to three
      // harmonics of the cycle a channel, in the clip's units). The worker takes it as a table of 18 channels, 7 numbers each (the mean, and the cosine and the sine of each harmonic: a sum of two of them is a waveform, so that
      // the mix of two gaits is a sum too), in the units of the layers: radians (the pitch the other way round: a layer's pitch forward is positive, a style's up), arm lengths (a hand: x out to the side its arm is on, y up, z
      // forward), after the gait's own say: `upper: false` (the legs only), or `upper: { arms, hips, spine, neck, head, posture }`, shares of what the style says (1: all of it; posture: the means, the way it stands, apart
      // from the way it swings: 0.5 by default, see UPPER_POSTURE). The cycle of the table starts when the first limb of the style leaves the ground: the leg of the creature that takes that limb's place (by side and rank,
      // as the phases are) steps at `phase` of its own, so the table is read at the cycle plus that, and what the arms and the spine do is locked to the feet of the creature whatever order its legs step in. A creature that
      // has no roles has nobody to play it: the tables are left out of its blob unless the gait asks for them
      const UPPER_PARTS = [["hips", 0, 1], ["spine", 3, 1], ["neck", 6, 1], ["head", 9, 1], ["arm_l", 12, 2], ["arm_r", 15, 2]], UPPER_CHANNELS = 18, UPPER_STRIDE = 7, UPPER_N = UPPER_CHANNELS * UPPER_STRIDE, UPPER_WORDS = 2 + UPPER_N;
      const UPPER_SCALES = ["hips", "spine", "neck", "head", "arms", "posture"], LEGS_UPPER = 2;
      // the posture a style says comes in at HALF by default: a recorded walk leans its trunk 6 to 10 degrees forward, of which 5 are the actor's own slouch (his relaxed standing posture is that far off the T-pose that the means are
      // counted from), and a creature that stands upright and then walks leaning looks as if it were falling over. `posture: 1` is the actor's, `posture: 0` the swing of the style alone. It is the means of the trunk and the head
      // (the pitch: the lean, the head held up to look ahead): where a hand is held is not a posture to be halved (half way to the shoulder)
      const UPPER_POSTURE = 0.5;
      function upper_say(v, tag) {                                       // the gait's say on a style's upper body -> false (the legs only) or { hips, spine, neck, head, arms, posture } (shares)
        if (v === false) return false;
        const say = { hips: 1, spine: 1, neck: 1, head: 1, arms: 1, posture: UPPER_POSTURE };
        if (v === undefined || v === null || v === true) return say;
        if (typeof v !== "object" || Array.isArray(v)) fail(tag + "upper is true, false or { " + UPPER_SCALES.join(", ") + " } (shares of what the style says)");
        for (const k in v) {
          if (UPPER_SCALES.indexOf(k) < 0) fail(tag + "unknown upper field '" + k + "' (" + UPPER_SCALES.join(", ") + ")");
          if (typeof v[k] !== "number" || !Number.isFinite(v[k]) || v[k] < 0 || v[k] > 4) fail(tag + "upper " + k + " = " + v[k] + " is out of range (0 to 4: a share of what the style says)");
          say[k] = v[k];
        }
        return say;
      }
      // the style's upper body and the gait's say -> { table: Float32Array(UPPER_N), mask (1: the hips, the spine, the neck, the head have something to say, 2: the arms do) }
      // THE TWO HANDS of a walk are one arm swinging, half a cycle apart: the recording is of an actor whose arms are not alike (one swings 7 degrees further and is carried 5 degrees further forward: the one that "flips"), and
      // an actor swings his arms further than most of us (45 to 50 degrees at the shoulder where a walk is 25 to 40). So the two hands of a style whose arms are alike (they differ by under ARM_PAIR of an arm's length,
      // one against the other half a cycle on: a hand at the ear of a phone call does not) are made the same arm, the mean of the two, and the fore and aft swing of a hand is held to ARM_CAP of an arm's length at the style's
      // walking speed (ARM_CAP_SPEED leg lengths a second: more as the style goes faster: a run swings as far as it should). The means (where a hand hangs) and the other parts are as they were recorded
      const ARM_PAIR = 0.12, ARM_CAP = 0.58, ARM_CAP_SPEED = 1.5;
      function arm_coefs(g) {                                              // a hand's three channels (x out, y up, z forward) -> each { m: the mean, a, b: the cos and the sin of its harmonics }
        return ["x", "y", "z"].map(function (ax) {
          const c = g && g[ax], o = { m: c ? c[0] : 0, a: [], b: [] };
          for (let h = 0; c && 2 * h + 1 < c.length; h++) { const A = c[2 * h + 1], ph = 2 * Math.PI * c[2 * h + 2]; o.a.push(A * Math.cos(ph)); o.b.push(A * Math.sin(ph)); }
          return o;
        });
      }
      const arm_at = function (co, c) { return co.map(function (ch) { let v = ch.m; for (let h = 0; h < ch.a.length; h++) v += ch.a[h] * Math.cos(2 * Math.PI * (h + 1) * c) + ch.b[h] * Math.sin(2 * Math.PI * (h + 1) * c); return v; }); };
      function arm_fix(u, style) {                                         // -> { arm_l: coefs, arm_r: coefs } for a style that has both hands, else null
        if (!u.arm_l || !u.arm_r) return null;
        const L = arm_coefs(u.arm_l), R = arm_coefs(u.arm_r);
        let d2 = 0;
        for (let i = 0; i < 32; i++) { const l = arm_at(L, i / 32), r = arm_at(R, (i / 32 + 0.5) % 1); for (let m = 0; m < 3; m++) d2 += (l[m] - r[m]) * (l[m] - r[m]); }
        if (Math.sqrt(d2 / 96) < ARM_PAIR) {                               // the same arm: the harmonics are the mean of the left's and the right's half a cycle on (a harmonic h turns by h half cycles: its sign by (-1)^h)
          for (let m = 0; m < 3; m++) {
            const l = L[m], r = R[m], mm = 0.5 * (l.m + r.m);
            for (let h = 0; h < Math.min(l.a.length, r.a.length); h++) {
              const sg = h % 2 === 0 ? -1 : 1;                             // (the harmonic h + 1: odd ones flip)
              const a = 0.5 * (l.a[h] + sg * r.a[h]), b = 0.5 * (l.b[h] + sg * r.b[h]);
              l.a[h] = a; l.b[h] = b; r.a[h] = sg * a; r.b[h] = sg * b;
            }
            l.m = mm; r.m = mm;
          }
        }
        const cap = ARM_CAP * Math.max(0.7, Math.min(1.7, (style && style.speed > 0 ? style.speed : ARM_CAP_SPEED) / ARM_CAP_SPEED));
        [L, R].forEach(function (co) {
          let lo = Infinity, hi = -Infinity;
          for (let i = 0; i < 48; i++) { const z = arm_at(co, i / 48)[2]; if (z < lo) lo = z; if (z > hi) hi = z; }
          if (hi - lo > cap) { const f = cap / (hi - lo); co.forEach(function (ch) { for (let h = 0; h < ch.a.length; h++) { ch.a[h] *= f; ch.b[h] *= f; } }); }
        });
        return { arm_l: L, arm_r: R };
      }
      // THE PELVIS AND THE SHOULDERS of a walk turn against each other: a person's pelvis turns 4 to 5 degrees each way about the vertical (8 to 10 in all) and the shoulders (the pelvis' turn and the spine's put together) turn
      // the other way, 3 to 5 degrees each way, so the spine turns against the pelvis by more than the pelvis turns. The recording is of an actor whose pelvis turns 15 degrees in all and whose spine turns back by 11: the
      // shoulders hardly moved (4 degrees, with the pelvis' phase half the time). So for a style with two legs the pelvis' yaw is held to YAW_CAP degrees in all at the style's walking speed (YAW_CAP_SPEED leg lengths a
      // second, more as it goes faster), and the spine's yaw is made the pelvis' yaw reversed, (1 + YAW_COUNTER) times as big: the shoulders turn YAW_COUNTER of the pelvis' turn the other way. The means (the posture) are as recorded
      const YAW_CAP = 9.5, YAW_CAP_SPEED = 1.5, YAW_COUNTER = 0.6;
      function yaw_fix(u, style) {                                         // -> { hips: a channel, spine: a channel } (degrees, [mean, A1, p1, A2, p2, A3, p3]) or null
        if (!style || !style.phase || Object.keys(style.phase).length !== 2 || !u.hips || !u.hips.yaw || !u.spine || !u.spine.yaw) return null;
        const h = u.hips.yaw, sp = u.spine.yaw;
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < 48; i++) { let v = 0; for (let k = 0; 2 * k + 2 < h.length; k++) v += h[2 * k + 1] * Math.cos(2 * Math.PI * ((k + 1) * i / 48 - h[2 * k + 2])); if (v < lo) lo = v; if (v > hi) hi = v; }
        const p2p = hi - lo;
        if (!(p2p > 2)) return null;                                       // (a style whose pelvis hardly turns is left as it is)
        const cap = YAW_CAP * Math.max(0.8, Math.min(1.8, (style.speed > 0 ? style.speed : YAW_CAP_SPEED) / YAW_CAP_SPEED)), a = Math.min(1, cap / p2p);
        const hips = h.slice(), spine = h.slice();
        spine[0] = sp[0];
        for (let k = 0; 2 * k + 2 < h.length; k++) { hips[2 * k + 1] = h[2 * k + 1] * a; spine[2 * k + 1] = h[2 * k + 1] * a * (1 + YAW_COUNTER); spine[2 * k + 2] = h[2 * k + 2] + 0.5; }
        return { hips: hips, spine: spine };
      }
      function upper_table(u, say, style) {
        const t = new Float32Array(UPPER_N);
        let mask = 0;
        const fixed = arm_fix(u, style), yf = yaw_fix(u, style);
        const ug = yf ? Object.assign({}, u, { hips: Object.assign({}, u.hips, { yaw: yf.hips }), spine: Object.assign({}, u.spine, { yaw: yf.spine }) }) : u;
        UPPER_PARTS.forEach(function (part) {
          const g = ug[part[0]];
          if (!g) return;
          const hand = part[2] === 2, share = say[hand ? "arms" : part[0]];
          if (!(share > 0)) return;
          const axes = hand ? ["x", "y", "z"] : ["yaw", "pitch", "roll"];
          axes.forEach(function (ax, i) {
            const c = g[ax];
            if (!c) return;
            const k = hand ? 1 : (ax === "pitch" ? -DEG : DEG), o = (part[1] + i) * UPPER_STRIDE;
            if (hand && fixed) {                                           // (a hand: the two arms made alike and held in, above)
              const f = fixed[part[0]][i];
              t[o] = f.m * share;
              for (let h = 0; h < f.a.length; h++) { t[o + 1 + 2 * h] = f.a[h] * share; t[o + 2 + 2 * h] = f.b[h] * share; }
              mask |= part[2];
              return;
            }
            t[o] = c[0] * k * share * (hand ? 1 : say.posture);
            for (let h = 0; 2 * h + 1 < c.length; h++) {
              const A = c[2 * h + 1], ph = 2 * Math.PI * c[2 * h + 2];
              t[o + 1 + 2 * h] = A * Math.cos(ph) * k * share; t[o + 2 + 2 * h] = A * Math.sin(ph) * k * share;
            }
            mask |= part[2];
          });
        });
        return { table: t, mask: mask };
      }
      // where the cycle of a style's upper body starts, in the phases of the creature's legs: the leg that takes the place of one of the style's limbs (the first one, when it has a leg) is at its own `phase`, and it steps
      // `d` of a cycle after the style's first limb: the table is read at the cycle + that leg's phase + d
      function upper_ref(style, per) {
        const legs = { side: per.map(function (p) { return p.side; }), along: per.map(function (p) { return p.hip[2]; }), length: per.map(function (p) { return p.length; }) };
        const map = body_legmap(Object.keys(style.phase), legs), first = style.upper.ref;
        let best = -1, bd = Infinity;
        map.forEach(function (sl, k) {
          if (sl < 0) return;
          const nm = GAIT_SLOTS[sl], d = style.phase[nm];
          if (!(d >= 0 && d <= 1)) return;
          const rank = nm === first ? -1 : d;
          if (rank < bd) { bd = rank; best = k; }
        });
        if (best < 0) return 0;
        const d = style.phase[GAIT_SLOTS[map[best]]];
        const v = (per[best].phase + d) % 1;
        return v < 0 ? v + 1 : v;
      }
      // where the sole of a foot turns on the floor: how far in front of the ankle the ball of the foot is and how far behind it the heel (model units). The leg says (`foot: { ball, heel }`), else the skeleton: the toe bone
      // under the tip bone is where the ball is, with none the ball is 0.62 of the tip bone's length; the heel is 0.45 of the ball's way
      function foot_geometry(sk, tip, lg, tag) {
        const g = lg.foot;
        if (g !== undefined) {
          if (!g || typeof g !== "object" || Array.isArray(g) || Object.keys(g).some(function (k) { return k !== "ball" && k !== "heel"; })) fail(tag + "foot is { ball, heel } (model units)");
          if ((g.ball !== undefined && !(Number.isFinite(g.ball) && g.ball >= 0)) || (g.heel !== undefined && !(Number.isFinite(g.heel) && g.heel >= 0))) fail(tag + "foot ball and heel are lengths, 0 or more");
        }
        let ball = 0.62 * sk.length[tip];
        const kids = sk.children[tip];
        if (kids && kids.length) { const c = kids[0]; ball = Math.hypot(sk.head[c * 3] - sk.head[tip * 3], sk.head[c * 3 + 2] - sk.head[tip * 3 + 2]); }
        if (g && g.ball !== undefined) ball = g.ball;
        return { ball: ball, heel: g && g.heel !== undefined ? g.heel : 0.45 * ball };
      }

      // def.legs -> { words, legs: [{ chain, name, hip, end, foot_h, length, phase, side, tip }], body, gaits: [{ numbers, path }], length, notes } (null: no legs)
      function compile_legs(sk, rig, input, with_roles) {
        if (input === undefined || input === null) return null;
        if (typeof input !== "object" || Array.isArray(input)) fail("legs must be an object { legs, gait }");
        only_keys(input, LEGS_KEYS, "legs");
        if (!rig || !rig.chains.length) fail("legs: a leg is a chain of the rig (the definition has no rig.chains)");
        const names = rig.chains.map(function (c) { return c.name; });
        const head = function (b) { return [sk.head[b * 3], sk.head[b * 3 + 1], sk.head[b * 3 + 2]]; }, tail = function (b) { return [sk.tail[b * 3], sk.tail[b * 3 + 1], sk.tail[b * 3 + 2]]; };
        if (!Array.isArray(input.legs) || input.legs.length < 1) fail("legs.legs must be a list of the rig's chains (names, or { chain, phase })");
        const entries = [];
        input.legs.forEach(function (lg, i) {
          const e = typeof lg === "string" ? { chain: lg } : lg;
          if (!e || typeof e !== "object" || Array.isArray(e)) fail("legs.legs[" + i + "] must be a chain's name or { chain, phase, foot_height, mirror }");
          only_keys(e, LEG_KEYS, "legs.legs[" + i + "]");
          entries.push(e);
          if (e.mirror !== undefined) { check_mirror(e.mirror, "legs.legs[" + i + "]"); const t = Object.assign({}, e, { chain: mirror_name(e.chain, "legs.legs[" + i + "]") }); delete t.mirror; if (e.phase !== undefined) t.phase = (e.phase + 0.5) % 1; entries.push(t); }
        });
        if (entries.length > MAX_LEGS) fail("legs: at most " + MAX_LEGS + " legs (" + entries.length + ")");
        const per = [], used = Object.create(null);
        entries.forEach(function (e, i) {
          const tag = "legs: leg " + i + " ('" + e.chain + "'): ";
          const ci = typeof e.chain === "number" ? e.chain : names.indexOf(e.chain);
          if (!(ci >= 0 && ci < names.length) || ci !== (ci | 0)) fail(tag + "no chain of the rig has that name (" + names.join(", ") + ")");
          if (used[ci]) fail(tag + "the chain is another leg's");
          used[ci] = true;
          const c = rig.chains[ci], first = c.bones[0], last = c.bones[c.bones.length - 1];
          const hip = head(first), end = c.tip >= 0 ? head(c.tip) : tail(last);
          let length = 0;
          for (let j = 0; j + 1 < c.bones.length; j++) { const a = head(c.bones[j]), b = head(c.bones[j + 1]); length += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); }
          { const a = head(last); length += Math.hypot(end[0] - a[0], end[1] - a[1], end[2] - a[2]); }
          const foot_h = e.foot_height === undefined ? end[1] : e.foot_height;
          if (!Number.isFinite(foot_h)) fail(tag + "foot_height must be a number");
          if (e.phase !== undefined && !(e.phase >= 0 && e.phase < 1)) fail(tag + "phase must be 0 to just under 1");
          const tipq = [0, 0, 0, 1];
          if (c.tip >= 0) mat_to_quat(sk.bind, c.tip * 12, tipq, 0);
          const sole = c.tip >= 0 ? foot_geometry(sk, c.tip, e, tag) : { ball: 0, heel: 0 };                  // (where the foot rolls: only a foot that is a bone of its own, the tip of the chain, has a sole)
          if (c.tip < 0 && e.foot !== undefined) fail(tag + "foot: the chain has no tip bone (a foot that is a bone of its own): there is no sole to describe");
          per.push({ chain: ci, name: c.name, root: c.root, hip: hip, end: end, foot_h: foot_h, length: length, phase: e.phase, own: e.phase !== undefined, side: hip[0] >= 0 ? 1 : -1, tip: c.tip >= 0, tip_q: tipq, solver: c.solver, ball: sole.ball, heel: sole.heel });
        });
        // the body bone: the one that every leg hangs from (the nearest bone that is an ancestor of all of their roots: a dog's front legs hang from the chest, its hind legs from the pelvis: the pelvis), unless the definition says
        let body = -1;
        if (input.body !== undefined) {
          body = typeof input.body === "number" ? input.body : sk.index[input.body];
          if (body === undefined || !(body >= 0 && body < sk.n) || body !== (body | 0)) fail("legs.body: no bone '" + input.body + "'");
        } else {
          const ancestors = function (b) { const l = []; for (; b >= 0; b = sk.parent[b]) l.push(b); return l; };
          let common = ancestors(per[0].root);
          per.forEach(function (p) { const a = ancestors(p.root); common = common.filter(function (b) { return a.indexOf(b) >= 0; }); });
          if (!common.length) fail("legs.body: the legs hang from bones that have no bone in common (" + per.map(function (p) { return sk.names[p.root]; }).join(", ") + "): name the bone that carries the ride height");
          body = common[0];
        }
        const script = input.script === undefined ? true : input.script;
        if (typeof script !== "boolean") fail("legs.script must be true or false (a script may take the feet and the knees: the action designer's leg tracks; false: the creature has no places for them)");
        const pattern = input.pattern === undefined ? "alternate" : input.pattern;
        if (PATTERNS.indexOf(pattern) < 0) fail("legs.pattern must be one of " + PATTERNS.join(", ") + " (" + pattern + ")");
        {                                                                          // a leg that names no phase steps as the pattern says for the legs there are
          const lay = { side: per.map(function (p) { return p.side; }), along: per.map(function (p) { return p.hip[2]; }), length: per.map(function (p) { return p.length; }) };
          const dp = pattern_phases(leg_layout(lay), lay.side, pattern);
          per.forEach(function (p, i) { if (!p.own) p.phase = dp[i]; });
        }
        const L = per[0].length, foot_h0 = per[0].foot_h, hip_y = per[0].hip[1], body_h = head(body)[1];
        // the first gait's numbers are what the legs' length says unless it gives them; a later gait starts from the FIRST one's (and its path) and changes what it names: a run is the walk with a longer stride
        const defaults = { ride: body_h - Math.max(0, hip_y - (foot_h0 + 0.95 * L)), speed: 1.2 * L, warp: 1, swing: 0.4, stride: 0.5 * L, step_height: 0.12 * L, reach: 1, apex: 1, forward_bias: 0, max_reach: 1, stance: 1, bob: 0,
          run_stride: 1.25, run_swing: 1.1, run_step_height: 1.25, max_run: 2.5, crouch: 0.06 * L, tilt: 0 };
        if (input.gaits !== undefined && input.gait !== undefined) fail("legs: give `gait` (one) or `gaits` (a list), not both");
        const given0 = input.gaits !== undefined ? input.gaits : [input.gait || {}];
        if (!Array.isArray(given0) || given0.length < 1 || given0.length > MAX_GAITS) fail("legs.gaits must be a list of 1 to " + MAX_GAITS + " gaits");
        // `slots`: spare gaits, each the first one's until the worker's logic writes a style into it (pure.js): an instance mixes any two of the family's gaits, so the styles it can walk are the ones that have a slot
        const spare = input.slots === undefined ? 0 : input.slots;
        if (!Number.isInteger(spare) || spare < 0 || given0.length + spare > MAX_GAITS) fail("legs.slots is a whole number of spare gaits, 0 to " + (MAX_GAITS - given0.length) + " (" + spare + ")");
        const given = spare ? given0.concat(new Array(spare).fill(0).map(function () { return {}; })) : given0;
        // the ride height of the creature's own first gait: what the shares of a style's `ride` are of (a crouched walk is 0.64 of it)
        const ride0 = given[0] && typeof given[0] === "object" && given[0].ride !== undefined ? given[0].ride : defaults.ride;
        const gaits = [], fts = [], ups = [], notes = [];
        given.forEach(function (gi, n) {
          const what = "legs: " + (input.gaits !== undefined ? "gait " + n + ": " : "");
          if (!gi || typeof gi !== "object" || Array.isArray(gi)) fail(what + "a gait must be an object");
          for (const k in gi) if (k !== "path" && k !== "from" && k !== "feet" && k !== "upper" && GAIT_FIELDS.indexOf(k) < 0) fail(what + "unknown gait field '" + k + "' (" + GAIT_FIELDS.join(", ") + ", path, from, feet, upper)");
          const own = Object.assign({}, gi); delete own.from; delete own.feet; delete own.upper;
          const style = gi.from !== undefined ? recorded_gait(gi.from, what + "from: ") : null;
          const rec = style ? gait_from(style, L, body_h, own.ride !== undefined ? own.ride : ride0) : {};              // (the style's numbers, and what the gait says itself over them)
          const fsay = feet_say(gi.feet, what);                                                                       // (the feet of the style: a later gait that names no style has the first one's, as it has its numbers)
          if (fsay === false) fts.push(null);
          else if (style && style.feet) fts.push({ style: style, say: fsay });
          else if (n > 0 && !style && fts[0]) fts.push({ style: fts[0].style, say: gi.feet === undefined ? fts[0].say : fsay });
          else {
            if (!style && gi.feet !== undefined && gi.feet !== true) fail(what + "feet: shares of what a style says, and no style is named (from)");
            fts.push(null);
          }
          const usay = upper_say(gi.upper, what);                                                                     // (the upper body of the style: as the feet's, a later gait that names no style has the first one's)
          if (usay === false) ups.push(null);
          else if (style && style.upper) ups.push({ style: style, say: usay });
          else if (n > 0 && !style && ups[0]) ups.push({ style: ups[0].style, say: gi.upper === undefined ? ups[0].say : usay });
          else {
            if (!style && gi.upper !== undefined && gi.upper !== true) fail(what + "upper: shares of what a style says, and no style is named (from)");
            ups.push(null);
          }
          if (rec.ride !== undefined) delete own.ride;                                                                // (a ride height the gait names is what a style's share is of: it is in rec.ride now)
          const g = Object.assign({}, n === 0 ? defaults : gaits[0].numbers, rec, own);
          GAIT_FIELDS.forEach(function (k) { if (!gait_ok(k, g[k])) fail(what + "gait " + k + " = " + g[k] + " is out of range"); });
          const path = own.path !== undefined ? own.path : (rec.path !== undefined ? rec.path : (n === 0 ? null : gaits[0].path));
          if (path) {
            if (!Array.isArray(path) || path.length < 2 || path.length > PATH_POINTS) fail(what + "path must be 2 to " + PATH_POINTS + " points [progress, height, 0, tangent]");
            path.forEach(function (pt) { if (!Array.isArray(pt) || pt.length !== 4 || !pt.every(Number.isFinite) || !(pt[0] >= 0 && pt[0] <= 1)) fail(what + "a path point is [progress 0..1, height, 0, tangent]"); });
          }
          const numbers = {};
          GAIT_FIELDS.forEach(function (k) { numbers[k] = g[k]; });
          gaits.push({ numbers: numbers, path: path, from: style ? style.name : null });
        });
        // the order of the steps: the style the first gait takes (unless the legs name another, or say false: the pattern's), for the legs that name no phase of their own
        const pf = input.phases_from !== undefined ? input.phases_from : (given[0] && typeof given[0] === "object" ? given[0].from : undefined);
        if (pf !== undefined && pf !== null && pf !== false) {
          const ph = recorded_phases(recorded_gait(pf, "legs: phases_from: "), per);
          per.forEach(function (p, i) { if (!p.own && ph[i] !== undefined) p.phase = ph[i]; });
        }
        // the feet: each gait's tables; a leg whose chain has no tip bone has no foot to turn (it is left flat and the creature is told), its knee still points as the table says
        const feets = fts.map(function (ft) { return ft ? { mask: 1, table: feet_table(ft.style.feet, ft.say) } : { mask: 0, table: new Float32Array(3 * FEET_N) }; });
        const has_feet = feets.some(function (x) { return x.mask !== 0; });
        // the upper bodies: each gait's table and where its cycle starts. A creature with no roles has nobody to play them: they are left out unless the gait asks (upper: true, or shares of it)
        const uppers = ups.map(function (up, n) {
          if (!up) return { mask: 0, ref: 0, table: new Float32Array(UPPER_N) };
          const tb = upper_table(up.style.upper, up.say, up.style);
          return { mask: tb.mask, ref: tb.mask ? upper_ref(up.style, per) : 0, table: tb.table };
        });
        const asked = given.some(function (g) { return g && typeof g === "object" && g.upper !== undefined && g.upper !== false; });
        let has_upper = uppers.some(function (u) { return u.mask !== 0; });
        if (has_upper && !with_roles && !asked) has_upper = false;
        else if (has_upper && !with_roles) notes.push("system: legs: the upper body of a gait style is played by the creature's roles (roles: { ... }): this creature has none, so nothing plays it");
        if (has_feet && per.some(function (p) { return !p.tip; })) notes.push("system: legs: the feet of a gait style are turned by the tip bone of a leg's chain (a foot that is a bone of its own): the legs without one (" + per.filter(function (p) { return !p.tip; }).map(function (p) { return p.name; }).join(", ") + ") keep their feet flat, and their knees still point as the style says");
        const words = new Uint32Array(4 + gaits.length * GAIT_WORDS + per.length * LEG_WORDS + (has_feet ? gaits.length * FEET_WORDS : 0) + (has_upper ? gaits.length * UPPER_WORDS : 0)), fw = new Float32Array(words.buffer);
        let k = 0;
        words[k++] = per.length; words[k++] = body; words[k++] = (has_feet ? LEGS_FEET : 0) | (has_upper ? LEGS_UPPER : 0) | (script ? LEGS_SCRIPT : 0); words[k++] = gaits.length;
        gaits.forEach(function (g) {
          GAIT_FIELDS.forEach(function (name) { fw[k++] = g.numbers[name]; });
          words[k++] = g.path ? g.path.length : 0;
          for (let i = 0; i < PATH_POINTS * 4; i++) fw[k++] = g.path && i < g.path.length * 4 ? g.path[(i / 4) | 0][i % 4] : 0;
        });
        per.forEach(function (p) {
          words[k] = p.chain; fw[k + 1] = p.phase; fw[k + 2] = p.hip[0]; fw[k + 3] = p.hip[1]; fw[k + 4] = p.hip[2]; fw[k + 5] = p.foot_h; fw[k + 6] = p.length; words[k + 7] = p.tip ? 1 : 0;
          fw[k + 8] = p.tip_q[0]; fw[k + 9] = p.tip_q[1]; fw[k + 10] = p.tip_q[2]; fw[k + 11] = p.tip_q[3]; fw[k + 12] = p.end[0]; fw[k + 13] = p.end[2];
          fw[k + 14] = has_feet ? p.ball : 0; fw[k + 15] = has_feet ? p.heel : 0;
          k += LEG_WORDS;
        });
        if (has_feet) feets.forEach(function (x) { words[k++] = x.mask; for (let i = 0; i < 3 * FEET_N; i++) fw[k++] = x.table[i]; });                // (the feet, after the legs: a gait's mask and its three tables, radians)
        if (has_upper) uppers.forEach(function (u) { words[k++] = u.mask; fw[k++] = u.ref; for (let i = 0; i < UPPER_N; i++) fw[k++] = u.table[i]; });         // (the upper bodies, after the feet: a gait's mask, where its cycle starts, its table)
        return { words: words, legs: per, body: body, gaits: gaits, declared: given0.length, length: L, hips_y: body_h, pattern: pattern, script: script, feet: has_feet, feets: feets, upper: has_upper, uppers: uppers, notes: notes };
      }

      // def.body -> { words, body } (null: the root is the page's, it has no mover). `true` or {} : every number from the legs' gaits
      function compile_body(input, legs) {
        if (input === undefined || input === null || input === false) return null;
        if (input === true) input = {};
        if (typeof input !== "object" || Array.isArray(input)) fail("body must be an object { max_speed, accel, turn_rate, ground, offset } (or true)");
        only_keys(input, BODY_KEYS, "body");
        let top = 1.4;                                                              // (the top speed a body is not given: twice the walk speed, and a little over the fastest of its gaits when they run faster than that)
        if (legs) { top = 2 * legs.gaits[0].numbers.speed; legs.gaits.forEach(function (g, i) { if (i > 0 && 1.1 * g.numbers.speed > top) top = 1.1 * g.numbers.speed; }); }
        const max_speed = input.max_speed === undefined ? top : input.max_speed;
        const o = { max_speed: max_speed, accel: input.accel === undefined ? 2 * max_speed : input.accel, turn_rate: input.turn_rate === undefined ? 6 : input.turn_rate, ground: input.ground === undefined ? true : input.ground, offset: input.offset === undefined ? 0 : input.offset, turn_radius: input.turn_radius === undefined ? 0 : input.turn_radius, gravity: input.gravity === undefined ? 0 : input.gravity, air_control: input.air_control === undefined ? 0.3 : input.air_control, step: input.step === undefined ? (legs ? 0.3 * legs.length : 0) : input.step, radius: input.radius === undefined ? (legs ? 0.25 * legs.length : 0) : input.radius };
        const chk = function (name, v, lo, hi, lo_open) { if (!Number.isFinite(v) || (lo_open ? !(v > lo) : !(v >= lo)) || !(v < hi)) fail("body: " + name + " = " + v + " is out of range"); };
        chk("max_speed", o.max_speed, 1e-6, 1e6, true); chk("accel", o.accel, 0, 1e7, false); chk("turn_rate", o.turn_rate, 1e-4, 1e3, true); chk("offset", o.offset, -1e4, 1e4, true); chk("turn_radius", o.turn_radius, 0, 1e4, false); chk("gravity", o.gravity, 0, 1e5, false); chk("air_control", o.air_control, 0, 1.0000001, false); chk("step", o.step, 0, 1e4, false); chk("radius", o.radius, 0, 1e4, false);
        if (typeof o.ground !== "boolean") fail("body: ground must be true or false");
        const words = new Uint32Array(10), fw = new Float32Array(words.buffer);
        words[0] = o.ground ? 1 : 0; fw[1] = o.max_speed; fw[2] = o.accel; fw[3] = o.turn_rate; fw[4] = o.offset; fw[5] = o.turn_radius; fw[6] = o.gravity; fw[7] = o.air_control; fw[8] = o.step; fw[9] = o.radius;
        return { words: words, body: o };
      }
      system.compile_legs = compile_legs; system.compile_body = compile_body;

      // ========================================================================================================================
      // style_plan
      // ========================================================================================================================
// system.js, a part: the PLAN of a live style: what a style of the library makes of the legs of a species (the front half of sp.set_style, species.js): the legs are compiled again with the style on one of their gaits, and the plan says which
// gaits that touched, with the tables that are to be written. PURE: no queue, no engine, no worker: the page makes the command words of it (sp.set_style) and the worker's own JS side (pure.js includes this file and
// legs.js, gaits.js, rig.js, skeleton.js and mirror.js, nothing else) makes the plan of the same species from the same data and writes the tables into a gait slot itself.
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system (and the worker's core makes a closure of its own with it), so it sees every name of the parts before it.
      //   style_plan(h, style, o) -> { n, name, fade, lg, legs2, phases, with_feet, with_upper, todo, probe }       h: { sk, rig, input, legs (the compiled legs: .gaits, .words), style_legs? } (a species, or what the worker was given of one)
      //     style: the NAME of a registered style (system.gaits) or a style object (registered under its name); o: { gait, upper, feet, fade, probe } (sp.set_style); `lg` is compile_legs' answer for the legs with the style on gait n,
      //     `todo` the gaits whose tables change: n, and when n is the first the later gaits that name no style of their own (a build makes such a gait of the first one's numbers); every mistake is thrown here: nothing has been written.
      const STYLE_FADE = 0.4;
      const STYLE_OWN = ["speed", "stride", "swing", "step_height", "bob", "ride", "path", "from", "feet", "upper"];
      function style_plan(h, style, o) {
        o = o || {};
        if (typeof o !== "object" || Array.isArray(o)) throw new Error("system: set_style: the second argument is { gait, upper, feet, fade }");
        for (const k in o) if (k !== "gait" && k !== "upper" && k !== "feet" && k !== "fade" && k !== "probe") throw new Error("system: set_style: unknown key '" + k + "' (gait, upper, feet, fade, probe)");
        if (o.probe !== undefined && typeof o.probe !== "boolean") throw new Error("system: set_style: probe is true or false (" + o.probe + ")");
        const fade = o.fade === undefined ? STYLE_FADE : o.fade;
        if (typeof fade !== "number" || !Number.isFinite(fade) || fade < 0 || fade > 10) throw new Error("system: set_style: fade is a number of seconds, 0 to 10 (" + o.fade + ")");
        const n = o.gait === undefined ? 0 : o.gait;
        if (!Number.isInteger(n) || n < 0 || n >= h.legs.gaits.length) throw new Error("system: set_style: this species has " + h.legs.gaits.length + " gait" + (h.legs.gaits.length === 1 ? "" : "s") + ": no gait " + o.gait);
        const name = style && typeof style === "object" ? system.gaits.add(style)[0] : style;
        if (typeof name !== "string" || !system.gaits.get(name)) throw new Error("system: set_style: no gait style '" + name + "' (system.gaits.add or system.gaits.load it first)");
        const input = h.input, roles_in = input.roles !== undefined ? input.roles : (input.system && input.system.roles), traits_in = input.traits !== undefined ? input.traits : (input.system && input.system.traits);
        const legs_in = h.style_legs || (input.legs !== undefined ? input.legs : (input.system && input.system.legs));
        const spare = legs_in.slots || 0;                                                                                        // (spare gaits are gaits of the legs: they are materialized here, as `{}`s, and `slots` is not said again)
        const given = (legs_in.gaits !== undefined ? legs_in.gaits : [legs_in.gait || {}]).concat(spare ? new Array(spare).fill(0).map(function () { return {}; }) : []);
        const gi = {};
        Object.keys(given[n]).forEach(function (k) { if (STYLE_OWN.indexOf(k) < 0) gi[k] = given[n][k]; });
        gi.from = name;
        const feet_say = o.feet !== undefined ? o.feet : given[n].feet, upper_say = o.upper !== undefined ? o.upper : given[n].upper;
        if (feet_say !== undefined) gi.feet = feet_say;
        if (upper_say !== undefined) gi.upper = upper_say;
        const legs2 = Object.assign({}, legs_in, { gaits: given.map(function (g, i) { return i === n ? gi : g; }) });
        delete legs2.gait; delete legs2.slots;
        const with_roles = roles_in !== undefined || traits_in !== undefined;                                              // (the upper body is a table of the legs' section that the worker always has room for: a creature that has roles to play it takes it, whatever the style it was built from said)
        const lg = compile_legs(h.sk, h.rig, legs2, with_roles);                                                     // (every mistake is thrown here: nothing is sent)
        const with_feet = (h.legs.words[2] & LEGS_FEET) !== 0, with_upper = with_roles || (h.legs.words[2] & LEGS_UPPER) !== 0;
        // the gait that is given and, when it is the first, the later gaits that name no style of their own (a build makes such a gait of the first one's numbers, its path and its tables): each is one command, the phases go with the first
        const todo = [n];
        if (n === 0) for (let i = 1; i < lg.gaits.length; i++) if (!(given[i] && typeof given[i] === "object" && given[i].from !== undefined)) todo.push(i);
        // the order of the steps of the style on this legs (the legs that name a phase of their own keep it): a gait that has one of its own is written into the worker's gait slot (body.cpp: ph_g)
        const ph = recorded_phases(recorded_gait(name, "set_style: "), lg.legs), phases = lg.legs.map(function (p, k) { return p.own || ph[k] === undefined ? p.phase : ph[k]; });
        return { n: n, name: name, fade: fade, lg: lg, legs2: legs2, phases: phases, with_feet: with_feet, with_upper: with_upper, todo: todo, probe: o.probe !== false };
      }
      system.style_plan = style_plan;
