// THE SPECIES: the blob (the compile), the mesh, the mesher's glue, the sdf, tissue, the species and the page's API of every feature (flight, wheels, seats, physics, legs, ragdoll, hits, grips, props, fingers, hands, face, style).
// Ported 2026-11-05 from the first version of the creature system, renamed and merged by domain. From here this file is the source.
// Its parts are INCLUDED (the bundler's import directive) into the one closure that makes engine.system (system.js), so each sees every name of the parts before it.

      // ========================================================================================================================
      // blob
      // ========================================================================================================================
// system.js, a part: the family blob: the header and the sections the worker reads (body.cpp: the skeleton; body.cpp: the rig; body.cpp: the mover; body.cpp: the gait).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- the blob ---------------------------------------------------------------------------------------------------------------------------------
      // [MAGIC, VERSION, total words, sections, max instances, 0, 0, 0] and the sections [type, words, payload]. The skeleton section: [n, np, 0], the parent of every bone (-1 a root), the order (parents first), the
      // posable bones (all of them), and the bind frames: head xyz, the bone's length, rotation xyzw.
      function skeleton_section(sk) {
        const n = sk.n, words = new Uint32Array(3 + 2 * n + n + 8 * n), fw = new Float32Array(words.buffer), q = new Float64Array(4);
        let k = 0;
        words[k++] = n; words[k++] = n; words[k++] = 0;
        for (let b = 0; b < n; b++) words[k++] = sk.parent[b] >>> 0;
        for (let i = 0; i < n; i++) words[k++] = sk.order[i];
        for (let b = 0; b < n; b++) words[k++] = b;
        for (let b = 0; b < n; b++) {
          mat_to_quat(sk.bind, b * 12, q, 0);
          fw[k] = sk.head[b * 3]; fw[k + 1] = sk.head[b * 3 + 1]; fw[k + 2] = sk.head[b * 3 + 2]; fw[k + 3] = sk.length[b];
          fw[k + 4] = q[0]; fw[k + 5] = q[1]; fw[k + 6] = q[2]; fw[k + 7] = q[3];
          k += 8;
        }
        return words;
      }
      // a definition { skeleton, rig, legs, body, roles, traits } -> { words, sk, rig, legs, body, life }: the pure part (no engine, no worker): the tests read the blob without a browser
      // THE PROPS OF A CREATURE (SYSTEM.md "Props a creature shows and hides"): `props: { sword: { bone: "sword", hidden: true } }`. A prop is a bone of the skeleton that carries an island of the sdf (a sword on a hand, a rifle on a back): drawn with the
      // creature, always. What the file says here is that the WORKER may show and hide it (me.prop_show, me.prop_hide): hiding is the scale of the bone 0 (its vertices fall to the bone's head), showing is 1. The bone has no joint and no chain. A prop has ONE place
      // (`bone`) or several (`bones: { hand: "sword_hand", back: "sword_back" }`: the same thing on two bones, one shown at a time). `hidden: true` (or `start: null`): it begins hidden; `start: "back"`: it begins in that place.
      // -> [{ name, places: [{ name, bone (the number) }], start (the number of the place shown, -1 none) }] | null
      function compile_props(input, sk, rig) {
        if (input === undefined || input === null) return null;
        if (typeof input !== "object" || Array.isArray(input)) fail("props is an object { name: { bone | bones, start, hidden } }");
        const names = Object.keys(input), out = [], jointed = {}, chained = {};
        if (names.length > 16) fail("props: at most 16 props (" + names.length + ")");
        if (rig) { rig.joints.forEach(function (j) { jointed[j.bone] = true; }); rig.chains.forEach(function (c) { c.bones.forEach(function (b) { chained[b] = true; }); if (c.tip >= 0) chained[c.tip] = true; }); }
        names.forEach(function (name) {
          const d = input[name], where = "props." + name, places = [];
          if (!/^[a-z][a-z0-9_]*$/.test(name)) fail("props: the name '" + name + "' is lower case letters, digits and _ (sword, satchel)");
          if (!d || typeof d !== "object" || Array.isArray(d)) fail(where + " is { bone | bones, start, hidden }");
          only_keys(d, ["bone", "bones", "start", "hidden"], where);
          if ((d.bone === undefined) === (d.bones === undefined)) fail(where + ": give `bone` (one place) or `bones` ({ place: bone, ... }), not both and not neither");
          const add = function (place, b) {
            const i = typeof b === "string" ? sk.index[b] : undefined;
            if (i === undefined) fail(where + ": " + (place === "on" && d.bone !== undefined ? "" : "place '" + place + "': ") + "no bone named '" + b + "' in the skeleton");
            if (sk.parent[i] < 0) fail(where + ": the root bone '" + b + "' cannot be a prop (it carries the whole creature)");
            if (jointed[i]) fail(where + ": the bone '" + b + "' has a joint in the rig: a prop bone is rigid on its parent (it is moved by the worker, a joint would hold it)");
            if (chained[i]) fail(where + ": the bone '" + b + "' is in a chain of the rig: a prop bone is moved by the worker, not solved");
            places.push({ name: place, bone: i });
          };
          if (d.bone !== undefined) add("on", d.bone);
          else {
            if (!d.bones || typeof d.bones !== "object" || Array.isArray(d.bones) || !Object.keys(d.bones).length) fail(where + ".bones is { place: bone, ... }, one place at least");
            if (Object.keys(d.bones).length > 4) fail(where + ".bones: at most 4 places");
            Object.keys(d.bones).forEach(function (p) { if (!/^[a-z][a-z0-9_]*$/.test(p)) fail(where + ".bones: the place '" + p + "' is lower case letters, digits and _ (hand, back)"); add(p, d.bones[p]); });
          }
          const seen = {};
          places.forEach(function (p) { if (seen[p.bone]) fail(where + ": two places on the bone number " + p.bone); seen[p.bone] = true; });
          if (d.hidden !== undefined && typeof d.hidden !== "boolean") fail(where + ".hidden is true or false");
          if (d.hidden !== undefined && d.start !== undefined) fail(where + ": give `hidden` or `start`, not both");
          let start = d.hidden === true ? -1 : 0;
          if (d.start !== undefined) {
            if (d.start === null || d.start === false) start = -1;
            else { start = -1; places.forEach(function (p, k) { if (p.name === d.start) start = k; }); if (start < 0) fail(where + ".start is null (hidden) or one of its places (" + places.map(function (p) { return p.name; }).join(", ") + "): " + d.start); }
          }
          out.push({ name: name, places: places, start: start });
        });
        return out.length ? out : null;
      }
      function compile(input, max_instances) {
        if (!input || typeof input !== "object") fail("a species needs a definition { name, skeleton, rig }");
        only_keys(input, ["name", "skeleton", "rig", "legs", "body", "roles", "traits", "flight", "wings", "vehicle", "wheels", "couplers", "aircraft", "rotors", "physics", "max_instances", "system", "sdf", "mesh", "texture", "material", "variants", "bound", "skinning", "creator", "tissue", "worker", "actions", "gaits", "props", "ragdoll", "hit", "particles", "family_props", "seats", "doors", "skins"], "the definition of a species");     // (`creator`: how the creature creator made it, creator/: kept for the studio, read by nothing here. `actions`, `gaits`: the creature's OWN, designs the worker makes before its function runs: pure.js declare)
        input = tissue_pre(input);                                                                     // (`tissue`: the tissue bones it asks for, added before anything is compiled: species.js)
        const max = max_instances === undefined ? 16 : max_instances;
        if (!Number.isInteger(max) || max < 1 || max > 65535) fail("max_instances must be a whole number from 1 to 65535 (" + max + ")");
        const sk = make_skeleton(input.skeleton);
        const rig = compile_rig(sk, input.rig !== undefined ? input.rig : (input.system && input.system.rig));
        const roles_in = input.roles !== undefined ? input.roles : (input.system && input.system.roles), traits_in = input.traits !== undefined ? input.traits : (input.system && input.system.traits);
        const legs = compile_legs(sk, rig, input.legs !== undefined ? input.legs : (input.system && input.system.legs), roles_in !== undefined || traits_in !== undefined);
        const body = compile_body(input.body !== undefined ? input.body : (input.system && input.system.body), legs);
        const life = compile_roles(sk, rig, legs, roles_in, traits_in);
        const material = compile_material(input.material, sk, life);                                   // (the material, checked: the bones' roughness and metal, the eyes: draw.js, "MATERIALS BY PART")
        const bound = compile_bound(input.bound);                                                       // (the sphere culling tests an instance by, when the definition gives it: runtime.js)
        const props_c = compile_props(input.props, sk, rig);                                            // (the props the worker may show and hide: checked here, sent to the worker with the function)
        const variants = compile_variants(input.variants, sk); const skins = compile_skins(input.skins, sk, life, input, variants);                                         // (what can differ between the instances: a dye's region and palette, the pieces an instance may not have: runtime.js)
        if (input.sdf !== undefined && input.sdf !== null) sdf_part_materials(input.sdf, typeof input.name === "string" ? input.name : "system");          // (and the roughness and metal of an sdf's parts: sdf.js)
        const flight_in = input.flight !== undefined ? input.flight : (input.system && input.system.flight), wings_in = input.wings !== undefined ? input.wings : (input.system && input.system.wings);
        const flight = flight_in ? compile_flight(flight_in, body) : null;
        const wings = wings_in ? compile_wings(wings_in, sk, rig, flight ? flight.flight : null) : null;
        const vehicle_in = input.vehicle !== undefined ? input.vehicle : (input.system && input.system.vehicle), wheels_in = input.wheels !== undefined ? input.wheels : (input.system && input.system.wheels);
        const couplers_in = input.couplers !== undefined ? input.couplers : (input.system && input.system.couplers), wing_def = wings ? wings.wings : null;
        const vehicle = vehicle_in ? compile_vehicle(vehicle_in, sk, rig, body, legs, wing_def, input.physics) : null;
        const wheels = wheels_in ? compile_wheels(wheels_in, sk, rig, wing_def, vehicle ? vehicle.vehicle : null) : null;
        const couplers = compile_couplers(couplers_in, sk);
        const aircraft_in = input.aircraft !== undefined ? input.aircraft : (input.system && input.system.aircraft), rotors_in = input.rotors !== undefined ? input.rotors : (input.system && input.system.rotors);
        if (aircraft_in && vehicle && vehicle.vehicle.real) fail("creature '" + (typeof input.name === "string" ? input.name : "system") + "': an aircraft taxis on the kinematic car's wheels: `realism` is for a car");
        const aircraft = aircraft_in ? compile_aircraft(aircraft_in, sk, rig, body, vehicle ? vehicle.vehicle : null, wing_def, wheels ? wheels.wheels : null) : null;
        const rotors = rotors_in ? compile_rotors(rotors_in, sk, rig, flight ? flight.flight : null, wing_def, vehicle ? vehicle.vehicle : null, wheels ? wheels.wheels : null, aircraft ? aircraft.aircraft : null) : null;
        const ragdoll = compile_ragdoll(sk, rig, legs, life, input.ragdoll);                              // (a person that dies falls: the particles feed the rig: body.js, world.cpp)
        const hit = compile_hit(sk, rig, legs, life, input.hit);                                       // (the hit zones of an organic creature that asks for them: body.js, world.cpp)
        const family_props = compile_family_props(input.family_props, sk, rig, life);                    // (the things that only this creature and its family know, each a species of its own: runtime.js)
        const particles = compile_particles(input.particles, sk);                                      // (what it asks the world's particle system to play, and where on the body: runtime.js)
        const phys = compile_species_physics(input, sk, body);                                         // (the creature in the physics world: body.js, world.cpp)
        const sections = [];                                                                           // (in the order of their ids: the worker builds them in that order, and a section may need the ones before it)
        if (body) sections.push([SEC_BODY, body.words]);
        sections.push([SEC_SKELETON, skeleton_section(sk)]);
        if (rig) sections.push([SEC_RIG, rig.words]);
        if (legs) sections.push([SEC_LEGS, legs.words]);
        if (life && life.words) sections.push([SEC_LIFE, life.words]);
        if (phys) sections.push([SEC_PHYS, phys.words]);
        if (flight) sections.push([SEC_FLIGHT, flight.words]);
        if (wings) sections.push([SEC_WINGS, wings.words]);
        if (vehicle) sections.push([SEC_VEHICLE, vehicle.words]);
        if (wheels) sections.push([SEC_WHEELS, wheels.words]);
        if (aircraft) sections.push([SEC_AIRCRAFT, aircraft.words]);
        if (rotors) sections.push([SEC_ROTOR, rotors.words]);
        if (ragdoll) sections.push([SEC_RAGDOLL, ragdoll.words]);
        if (hit) sections.push([SEC_HIT, hit.words]);
        let total = 8;
        sections.forEach(function (s) { total += 2 + s[1].length; });
        const words = new Uint32Array(total);
        words[0] = MAGIC; words[1] = VERSION; words[2] = total; words[3] = sections.length; words[4] = max; words[5] = 0; words[6] = 0; words[7] = 0;
        let k = 8;
        sections.forEach(function (s) { words[k++] = s[0]; words[k++] = s[1].length; words.set(s[1], k); k += s[1].length; });
        return { words: words, props: props_c, sk: sk, rig: rig, legs: legs, body: body ? body.body : null, life: life, flight: flight ? flight.flight : null, wings: wings ? wings.wings : null, vehicle: vehicle ? vehicle.vehicle : null, wheels: wheels ? wheels.wheels : null, couplers: couplers, aircraft: aircraft ? aircraft.aircraft : null, rotors: rotors ? rotors.rotors : null, physics: phys ? phys.physics : null, ragdoll: ragdoll ? ragdoll.ragdoll : null, hit: hit ? hit.hit : null, particles: particles, family_props: family_props, material: material, variants: variants, skins: skins, bound: bound };
      }
      system.compile = compile;
      system.MAGIC = MAGIC; system.VERSION = VERSION; system.SEC = { BODY: SEC_BODY, SKELETON: SEC_SKELETON, RIG: SEC_RIG, LEGS: SEC_LEGS, LIFE: SEC_LIFE, PHYS: SEC_PHYS, FLIGHT: SEC_FLIGHT, WINGS: SEC_WINGS, VEHICLE: SEC_VEHICLE, WHEELS: SEC_WHEELS, AIRCRAFT: SEC_AIRCRAFT, ROTOR: SEC_ROTOR, RAGDOLL: SEC_RAGDOLL, HIT: SEC_HIT };

      // ========================================================================================================================
      // mesh
      // ========================================================================================================================
// system.js, a part: the mesh (plain arrays, checked, the skin data made ready) and the shaders that draw it.
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- the mesh: plain arrays, checked, the skin data made ready for the shader ---------------------------------------------------------------------
      // mesh = { positions, normals, indices, uvs?, colors?, skin_indices?, skin_weights?, skin_count?, roughness?, metallic?, part_ids?, parts? }  (SYSTEM.md, "Meshes", "Materials") -> { n, a_position, a_normal, a_uv,
      // a_color, indices (Uint32Array), bone_indices and bone_weights (Float32Array, 4 a vertex: the strongest first, the weights add up to 1), influences: the most a vertex has (1 .. 4: the shader of the species is the
      // cheapest that has them all), roughness / metallic (Float32Array or null; -1: not said), part_ids (Uint16Array or null), parts ([{ id, source, roughness, metal }] or null; -1: not said) }
      function pack_mesh(mesh, sk) {
        if (!mesh || typeof mesh !== "object") fail("mesh must be an object of arrays");
        const P = mesh.positions, N = mesh.normals, idx = mesh.indices;
        if (!P || typeof P.length !== "number" || P.length < 9 || P.length % 3 !== 0) fail("mesh.positions must be an array of 3 n numbers (n >= 3)");
        const nv = P.length / 3;
        if (!N || N.length !== P.length) fail("mesh.normals must be an array of 3 n numbers, as many as the positions");
        if (!idx || typeof idx.length !== "number" || idx.length < 3 || idx.length % 3 !== 0) fail("mesh.indices must be an array of 3 t vertex numbers (triangles)");
        for (let i = 0; i < idx.length; i++) if (!(idx[i] >= 0 && idx[i] < nv) || idx[i] !== (idx[i] | 0)) fail("mesh.indices[" + i + "] = " + idx[i] + " is not a vertex (0 .. " + (nv - 1) + ")");
        for (let i = 0; i < P.length; i++) if (!Number.isFinite(P[i]) || !Number.isFinite(N[i])) fail("mesh.positions and mesh.normals must be finite numbers (index " + i + ")");
        const out = { n: nv, a_position: Float32Array.from(P), a_normal: Float32Array.from(N), indices: Uint32Array.from(idx) };
        if (mesh.uvs) { if (mesh.uvs.length !== nv * 2) fail("mesh.uvs must hold 2 numbers for each of the " + nv + " vertices"); out.a_uv = Float32Array.from(mesh.uvs); }
        else out.a_uv = new Float32Array(nv * 2);
        if (mesh.colors) {
          const k = mesh.colors.length / nv;
          if (k !== 3 && k !== 4) fail("mesh.colors must hold 3 or 4 numbers for each of the " + nv + " vertices");
          if (k === 4) out.a_color = Float32Array.from(mesh.colors);
          else { out.a_color = new Float32Array(nv * 4); for (let i = 0; i < nv; i++) { out.a_color[i * 4] = mesh.colors[i * 3]; out.a_color[i * 4 + 1] = mesh.colors[i * 3 + 1]; out.a_color[i * 4 + 2] = mesh.colors[i * 3 + 2]; out.a_color[i * 4 + 3] = 1; } }
        } else { out.a_color = new Float32Array(nv * 4); out.a_color.fill(1); }
        // the MATERIAL of the vertices (optional; SYSTEM.md "Materials", draw.js): `roughness` / `metallic`, a number a vertex (0 .. 1; a negative one says nothing: the vertex takes its part's, its bones' or the species'
        // value), and the PARTS the vertices belong to: `part_ids` (a part a vertex: an index into `parts`) and `parts` ([{ id, roughness?, metal? }]: the mesher's parts of an sdf, or a plain mesh's own groups)
        out.roughness = material_array(mesh.roughness, nv, "roughness"); out.metallic = material_array(mesh.metallic, nv, "metallic");
        out.part_ids = null; out.parts = null;
        // GLASS (SYSTEM.md "Transparent surfaces"): `glass_from` is the number of the first triangle of the mesh that is glass; the triangles from it to the end are not drawn in the G-buffer (nor in the shadow maps): they are drawn with the transparent material, after the lighting pass (a deferred page) or after the opaque things (a forward one)
        out.glass_from = -1;
        if (mesh.glass_from !== undefined && mesh.glass_from !== null) {
          const nt = idx.length / 3;
          if (!Number.isInteger(mesh.glass_from) || mesh.glass_from < 0 || mesh.glass_from > nt) fail("mesh.glass_from must be a whole number from 0 to " + nt + " (the first triangle that is glass: the ones from it to the end are; " + mesh.glass_from + ")");
          if (mesh.glass_from < nt) out.glass_from = mesh.glass_from;
        }
        if (mesh.part_ids !== undefined && mesh.part_ids !== null || mesh.parts !== undefined && mesh.parts !== null) {
          const PID = mesh.part_ids, PL = mesh.parts;
          if (!Array.isArray(PL) || !PL.length || PL.length > 65535) fail("mesh.parts must be a list of 1 .. 65535 parts [{ id, roughness?, metal? }] (what mesh.part_ids index)");
          if (!PID || PID.length !== nv) fail("mesh.part_ids must hold a part for each of the " + nv + " vertices (an index into mesh.parts)");
          out.parts = PL.map(function (p, i) {
            if (!p || typeof p !== "object" || Array.isArray(p)) fail("mesh.parts[" + i + "] must be an object { id, roughness?, metal? }");
            const id = p.id !== undefined && p.id !== null ? String(p.id) : "p" + i;
            return { id: id, source: p.source !== undefined && p.source !== null ? String(p.source) : id, roughness: part_value(p.roughness, "mesh.parts[" + i + "].roughness"), metal: part_value(p.metal, "mesh.parts[" + i + "].metal") };
          });
          out.part_ids = new Uint16Array(nv);
          for (let v = 0; v < nv; v++) { const q = PID[v]; if (!(q >= 0 && q < PL.length) || q !== (q | 0)) fail("mesh.part_ids[" + v + "] = " + q + " is not a part (0 .. " + (PL.length - 1) + ")"); out.part_ids[v] = q; }
        }
        const bi = new Float32Array(nv * 4), bw = new Float32Array(nv * 4), root = sk.order[0];
        let influences = 1;
        if (mesh.skin_indices === undefined && mesh.skin_weights === undefined) { for (let v = 0; v < nv; v++) { bi[v * 4] = root; bw[v * 4] = 1; } }          // (no skin: the creature is one rigid thing on its first root bone)
        else {
          const k = mesh.skin_count === undefined ? 4 : mesh.skin_count, SI = mesh.skin_indices, SW = mesh.skin_weights;
          if (!Number.isInteger(k) || k < 1 || k > 4) fail("mesh.skin_count must be 1 .. 4 (" + mesh.skin_count + ")");
          if (!SI || !SW || SI.length !== nv * k || SW.length !== nv * k) fail("mesh.skin_indices and mesh.skin_weights must hold skin_count (" + k + ") numbers for each of the " + nv + " vertices");
          const bone = [0, 0, 0, 0], wgt = [0, 0, 0, 0];
          for (let v = 0; v < nv; v++) {
            let m = 0, sum = 0;
            for (let j = 0; j < k; j++) {                                               // the influences of this vertex, the same bone listed twice made one, the zero ones dropped
              const b = SI[v * k + j], w = SW[v * k + j];
              if (!(b >= 0 && b < sk.n) || b !== (b | 0)) fail("mesh.skin_indices[" + (v * k + j) + "] = " + b + " is not a bone (0 .. " + (sk.n - 1) + ")");
              if (!Number.isFinite(w) || w < 0) fail("mesh.skin_weights[" + (v * k + j) + "] = " + w + " must be a finite number, not negative");
              if (!(w > 0)) continue;
              let at = -1;
              for (let q = 0; q < m; q++) if (bone[q] === b) at = q;
              if (at >= 0) wgt[at] += w; else { bone[m] = b; wgt[m] = w; m++; }
              sum += w;
            }
            if (!(sum > 0)) { bi[v * 4] = root; bw[v * 4] = 1; continue; }
            for (let a = 1; a < m; a++) { const b0 = bone[a], w0 = wgt[a]; let q = a - 1; while (q >= 0 && wgt[q] < w0) { bone[q + 1] = bone[q]; wgt[q + 1] = wgt[q]; q--; } bone[q + 1] = b0; wgt[q + 1] = w0; }       // (the strongest first)
            let keep = 0, kept = 0;
            for (let q = 0; q < m; q++) if (wgt[q] / sum > 1e-4) { keep = q + 1; kept += wgt[q]; }
            if (keep > influences) influences = keep;
            for (let q = 0; q < keep; q++) { bi[v * 4 + q] = bone[q]; bw[v * 4 + q] = wgt[q] / kept; }
          }
        }
        out.bone_indices = bi; out.bone_weights = bw; out.influences = influences;
        return out;
      }
      // a material array of the mesh (n numbers: 0 .. 1, a negative one says nothing) -> Float32Array, or null when there is none
      function material_array(a, nv, what) {
        if (a === undefined || a === null) return null;
        if (typeof a.length !== "number" || a.length !== nv) fail("mesh." + what + " must hold a number for each of the " + nv + " vertices (0 .. 1; a negative one: not said)");
        const out = Float32Array.from(a);
        for (let v = 0; v < nv; v++) if (!Number.isFinite(out[v]) || out[v] > 1) fail("mesh." + what + "[" + v + "] = " + a[v] + " must be a number of at most 1 (0 .. 1; a negative one: not said)");
        return out;
      }
      // the roughness or the metal a part says: a number 0 .. 1, or -1 when it says none (nothing, null, a negative number: "the species'")
      function part_value(x, what) {
        if (x === undefined || x === null) return -1;
        if (typeof x !== "number" || !Number.isFinite(x) || x > 1) fail(what + " = " + x + " must be a number of at most 1 (0 .. 1; -1: not said, the species')");
        return x < 0 ? -1 : x;
      }

      // ---- the shaders: the root and the skinning transforms of the bones from the species' texture ------------------------------------------------------
      // A bone row is two texels: [translation xyz, scale] [rotation xyzw], both relative to the bind pose and to the instance's root (the worker makes them from the forward kinematics). The scale is 1 for every bone (a prop that is away
      // will be a bone of scale 0: a vertex that is bound to it goes to the bone's head, where its triangles have no area). A vertex carries its bind position and normal and up to four (bone, weight) pairs.
      // system skins with DUAL QUATERNIONS (the default; the idea and the shaders are system 2.0's): a bone's rotation q and translation t are the dual quaternion (q, q_d = 0.5 (0, t) q); the vertex's influences are blended as dual quaternions (the ones
      // that lie in the other hemisphere of the first, strongest, influence are flipped to its side, so that two rotations never cancel), the sum is normalised by the length of its rotation part, and the vertex goes to
      // R p + t of the result: a wrist that twists keeps its volume (linear blending collapses it into a candy wrapper) and an elbow that bends does not pinch. The scale of a prop is blended apart and applied to the vertex first
      // (every bone of a vertex has the same scale but for a prop's, whose vertices all belong to it). The normal is rotated by the blended rotation. A vertex of ONE influence is rigid and needs no blending.
      // The plain way (linear blend skinning: the sum over the influences of w (s R p + t) and of w R n) is the mode "linear" (species.skinning, system.species({ skinning })). The species picks the shader with as many
      // influences as its mesh has (one, two, three or four: a mesh that only has two pays for two).
      const SKINNING_MODES = ["dual_quaternion", "linear"];
      const SKIN_COMMON = `
uniform highp sampler2D happy_tex;	// (highp: the rows are floats; a vertex shader's default for a sampler is lowp)
uniform vec4 happy_info;				// W, H, first texel of the pose region, bones per instance
attribute vec4 happy_bone_indices;	// the bones of the vertex's influences, the strongest first
attribute vec4 happy_bone_weights;	// their weights (they add up to 1)

vec4 happy_fetch(float t) {
	float row = floor(t / happy_info.x);
	float col = t - row * happy_info.x;
	return texture2D(happy_tex, vec2((col + 0.5) / happy_info.x, (row + 0.5) / happy_info.y));
}
vec3 happy_rotate(vec4 q, vec3 v) {
	return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}
vec4 happy_qmul(vec4 a, vec4 b) {
	return vec4(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz));
}
void happy_skin_bone(float bone, float w, float inst, inout vec3 pos, inout vec3 nrm) {
	float t = happy_info.z + (inst * happy_info.w + floor(bone + 0.5)) * 2.0;
	vec4 tr = happy_fetch(t);
	vec4 q = happy_fetch(t + 1.0);
	pos += w * (tr.w * happy_rotate(q, a_position) + tr.xyz);
	nrm += w * happy_rotate(q, a_normal);
}
vec4 happy_dq_first(float bone, float w, float inst, inout vec4 dq_r, inout vec4 dq_d, inout float dq_s) {
	float t = happy_info.z + (inst * happy_info.w + floor(bone + 0.5)) * 2.0;
	vec4 tr = happy_fetch(t);
	vec4 q = happy_fetch(t + 1.0);
	dq_r += w * q;
	dq_d += (0.5 * w) * happy_qmul(vec4(tr.xyz, 0.0), q);
	dq_s += w * tr.w;
	return q;
}
void happy_dq_bone(float bone, float w, float inst, vec4 q0, inout vec4 dq_r, inout vec4 dq_d, inout float dq_s) {
	float t = happy_info.z + (inst * happy_info.w + floor(bone + 0.5)) * 2.0;
	vec4 tr = happy_fetch(t);
	vec4 q = happy_fetch(t + 1.0);
	float s = dot(q, q0) < 0.0 ? -w : w;
	dq_r += s * q;
	dq_d += (0.5 * s) * happy_qmul(vec4(tr.xyz, 0.0), q);
	dq_s += w * tr.w;
}
`;
      const SKIN_LINEAR_HEAD = `
void vertex(){
	v_color = a_color;
	v_uv = a_uv;
	float inst = float(gl_InstanceID);
	vec3 pos = vec3(0.0), nrm = vec3(0.0);
`;
      const SKIN_DQ_HEAD = `
void vertex(){
	v_color = a_color;
	v_uv = a_uv;
	float inst = float(gl_InstanceID);
	vec4 dq_r = vec4(0.0), dq_d = vec4(0.0);
	float dq_s = 0.0;
`;
      const SKIN_DQ_END = `
	float dq_len = length(dq_r);
	dq_r /= dq_len; dq_d /= dq_len;
	vec3 pos = happy_rotate(dq_r, dq_s * a_position) + 2.0 * (dq_r.w * dq_d.xyz - dq_d.w * dq_r.xyz + cross(dq_r.xyz, dq_d.xyz));
	vec3 nrm = happy_rotate(dq_r, a_normal);
`;
      const SKIN_TAIL = `
	vec4 r0 = happy_fetch(inst * 2.0);			// root: position xyz, scale
	vec4 r1 = happy_fetch(inst * 2.0 + 1.0);		// root: rotation
	vec3 world = r0.xyz + happy_rotate(r1, pos * r0.w);
	v_position_world = (u_model_matrix * vec4(world, 1.0)).xyz;
	v_position_view = (u_view_matrix * vec4(v_position_world, 1.0)).xyz;
	v_normal_world = normalize((u_model_matrix * vec4(happy_rotate(r1, normalize(nrm)), 0.0)).xyz);
	gl_Position = u_view_projection_matrix * vec4(v_position_world, 1.0);
}
`;
      // THE MATERIAL CHANNEL of a mesh (draw.js: a species whose vertices say a roughness or a metal of their own): an attribute of four bytes a vertex (the roughness, how much of it the vertex takes, the metal, how much
      // of it: 0 .. 255, read as floats that are not normalised), passed on to the fragment by a varying
      const SKIN_MAT_DECL = `attribute vec4 happy_mat;			// the vertex's own material: roughness, its weight, metal, its weight (bytes: 0 .. 255)
varying vec4 v_happy_mat;
`;
      const SKIN_MAT_COPY = "\tv_happy_mat = happy_mat * (1.0 / 255.0);\n";
      // THE VARIANTS of an instance (runtime.js): the vertex carries the dyes' shares and its piece (`happy_variant`, four bytes); the LOOKS are a table of vec4 in a uniform array of the species' material (`happy_looks[M]`: K vec4
      // a look, a vec4 a dye, the colour over the dye's reference luminance with w = 1 when the look says it, then the pieces' flags four to a vec4; the first look is all zeros: the file's own), and the instance's look is the second
      // number of its entry in the draw list (`happy_inst`: (slot, look), divisor 1). A dye replaces the hue of the vertex's colour and keeps its shading: mix(colour, the look's colour x the vertex's luminance, share x w), with no
      // branch and no fetch (and no ternary: the piece's flag is read with step() and a dot product, so the variant code has no `if` at all); a vertex in a piece that the look leaves out has its position scaled to the root's point
      // (the triangles of a piece, all of whose vertices go there, have no area). Written into the vertex shader after the
      // instance is known; none of it is in a shader of a species with no variants. spec: { dyes: how many, optional: how many pieces, K: vec4 a look, M: vec4 in the table }
      const SKIN_VAR_DECL = function (spec) { return "attribute vec4 happy_variant;\t// the vertex's dye shares (three bytes) and its piece (0: none, else the piece + 1)\nuniform vec4 happy_looks[" + spec.M + "];\t// the looks, K vec4 each: the first look (all zeros) is the file's own\n"; };
      const SKIN_INST_LINE = "\tfloat inst = float(gl_InstanceID);\n";
      const SKIN_LIST_DECL = "attribute float happy_slot;\t// the instance this one of the draw is (the draw of a species that culls is a LIST of the instances that are not culled, one entry an instance: runtime.js)\n";
      const SKIN_LIST_INST = "\tfloat inst = happy_slot;\n";
      const SKIN_VLIST_DECL = "attribute vec2 happy_inst;\t// the instance this one of the draw is and the look it wears (a species that has variants is drawn from a LIST: runtime.js)\n";
      const SKIN_VLIST_INST = "\tfloat inst = happy_inst.x;\n";
      const SKIN_WORLD_FROM = "vec3 world = r0.xyz + happy_rotate(r1, pos * r0.w);";
      const SKIN_WORLD_TO = "vec3 world = r0.xyz + happy_rotate(r1, pos * (r0.w * happy_keep));";
      function variant_code(spec) {
        const comp = ["x", "y", "z"];
        let s = "\tvec3 happy_col = a_color.rgb;\n";
        if (spec.optional) s += "\tfloat happy_keep = 1.0;\n";
        s += "\t{\n\t\tint happy_lb = int(happy_inst.y + 0.5) * " + spec.K + ";\n";
        if (spec.dyes) s += "\t\tfloat happy_lum = dot(happy_col, vec3(0.2126, 0.7152, 0.0722));\n\t\tvec3 happy_amt = happy_variant.xyz * (1.0 / 255.0);\n\t\tvec4 e;\n";
        for (let k = 0; k < spec.dyes; k++) s += "\t\te = happy_looks[happy_lb + " + k + "]; happy_col = mix(happy_col, e.rgb * happy_lum, happy_amt." + comp[k] + " * e.w);\n";
        if (spec.optional) s += "\t\tfloat g = max(happy_variant.w - 1.0, 0.0), tx = floor(g * 0.25), c = g - 4.0 * tx;\n\t\tvec4 f = happy_looks[happy_lb + " + spec.dyes + " + int(tx)];\n\t\thappy_keep = 1.0 - step(0.5, happy_variant.w) * dot(f, vec4(1.0 - step(0.5, c), step(0.5, c) - step(1.5, c), step(1.5, c) - step(2.5, c), step(2.5, c)));\n";
        return s + "\t}\n\tv_color = vec4(happy_col, a_color.a);\n";
      }
      // influences: 1 .. 4 (the most a vertex of the mesh has); mode: "dual_quaternion" (the default) or "linear". One influence is the same in both: it is skinned the plain way. channel: the mesh has the material
      // channel (the text of a mesh that has none is what it always was); variant: the mesh has variants { dyes, optional, K, M } (likewise); listed: the draw is a list of instances: the instance is an attribute of the draw
      // (happy_slot, divisor 1), not gl_InstanceID (likewise; a species that has variants is always listed: its attribute is (slot, look))
      function skinned_shader(influences, mode, channel, variant, listed) {
        const comp = ["x", "y", "z", "w"], at = function (k) { return "happy_bone_indices." + comp[k] + ", happy_bone_weights." + comp[k]; };
        if (mode !== undefined && SKINNING_MODES.indexOf(mode) < 0) throw new Error("system: skinning must be one of " + SKINNING_MODES.join(", ") + " (" + mode + ")");
        listed = listed || !!variant;
        const decl = (channel ? SKIN_MAT_DECL : "") + (variant ? SKIN_VAR_DECL(variant) + SKIN_VLIST_DECL : (listed ? SKIN_LIST_DECL : "")), copy = channel ? SKIN_MAT_COPY : "", inst_line = variant ? SKIN_VLIST_INST : SKIN_LIST_INST;
        const head = function (h) { return listed ? h.replace(SKIN_INST_LINE, inst_line + (variant ? variant_code(variant) : "")) : h; }, tail = variant && variant.optional ? SKIN_TAIL.replace(SKIN_WORLD_FROM, SKIN_WORLD_TO) : SKIN_TAIL;
        let calls = "";
        if (mode === "linear" || influences < 2) {
          for (let k = 0; k < influences; k++) calls += "\thappy_skin_bone(" + at(k) + ", inst, pos, nrm);\n";
          return SKIN_COMMON + decl + head(SKIN_LINEAR_HEAD) + copy + calls + tail;
        }
        calls = "\tvec4 dq_q0 = happy_dq_first(" + at(0) + ", inst, dq_r, dq_d, dq_s);\n";
        for (let k = 1; k < influences; k++) calls += "\thappy_dq_bone(" + at(k) + ", inst, dq_q0, dq_r, dq_d, dq_s);\n";
        return SKIN_COMMON + decl + head(SKIN_DQ_HEAD) + copy + calls + SKIN_DQ_END + tail;
      }
      // THE HOLDER SHADER (runtime.js): a PROP is a mesh built round ONE imaginary bone, drawn by the family's own render loop with the family's own texture of rows: no species, no rows of its own. Each prop instance has
      // three attributes (divisor 1): `happy_hold` (the holder instance's slot, the holder's bone, the prop's scale), `happy_at` and `happy_rot`. HELD (bone >= 0): happy_at / happy_rot take the prop's frame to the bone's bind pose (the
      // mount: the grip, the rest), the bone's row (its skinning transform: the same two texels a vertex of the creature's own mesh reads) takes that to the model, the holder's root row to the world. So the prop is on the bone
      // the frame the bone is, with nothing written by the page, and a holder that is out of sight (root scale 0) collapses it to a point. FREE (bone < 0: a thrown prop, one that lies): happy_at / happy_rot ARE its world place.
      // NO BRANCH: the two are mixed by step(0, bone) (both are computed: a prop has a few hundred vertices and a few instances).
      const HOLD_COMMON = `
uniform highp sampler2D happy_tex;	// the HOLDER's rows (highp: the rows are floats)
uniform vec4 happy_info;				// W, H, first texel of the pose region, bones per instance (of the holder)
attribute vec4 happy_hold;			// the holder instance's slot, the holder's bone (< 0: the prop is free), the prop's scale
attribute vec3 happy_at;				// held: the mount's point in the bone's bind pose; free: the world position
attribute vec4 happy_rot;			// held: the mount's turn; free: the world turn
vec4 happy_fetch(float t) {
	float row = floor(t / happy_info.x);
	float col = t - row * happy_info.x;
	return texture2D(happy_tex, vec2((col + 0.5) / happy_info.x, (row + 0.5) / happy_info.y));
}
vec3 happy_rotate(vec4 q, vec3 v) {
	return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}
`;
      const HOLD_VERTEX = `
void vertex(){
	v_color = a_color;
	v_uv = a_uv;
	float held = step(0.0, happy_hold.y);
	float t = happy_info.z + (happy_hold.x * happy_info.w + max(happy_hold.y, 0.0)) * 2.0;
	vec4 tr = happy_fetch(t);						// the holder's bone: translation xyz, scale
	vec4 bq = happy_fetch(t + 1.0);					// its turn
	vec4 r0 = happy_fetch(happy_hold.x * 2.0);		// the holder's root: position xyz, scale
	vec4 r1 = happy_fetch(happy_hold.x * 2.0 + 1.0);	// its turn
	vec3 own = happy_rotate(happy_rot, happy_hold.z * a_position);
	vec3 bone_at = happy_at + own;												// the bind pose's point
	vec3 held_world = r0.xyz + happy_rotate(r1, (tr.w * happy_rotate(bq, bone_at) + tr.xyz) * r0.w);
	vec3 held_nrm = happy_rotate(r1, happy_rotate(bq, happy_rotate(happy_rot, a_normal)));
	vec3 world = mix(happy_at + own, held_world, held);
	vec3 nrm = mix(happy_rotate(happy_rot, a_normal), held_nrm, held);
	v_position_world = (u_model_matrix * vec4(world, 1.0)).xyz;
	v_position_view = (u_view_matrix * vec4(v_position_world, 1.0)).xyz;
	v_normal_world = normalize((u_model_matrix * vec4(normalize(nrm), 0.0)).xyz);
	gl_Position = u_view_projection_matrix * vec4(v_position_world, 1.0);
}
`;
      // channel: the mesh has the material channel (the text of a mesh that has none is what it always was)
      function holder_shader(channel) { return HOLD_COMMON + (channel ? SKIN_MAT_DECL : "") + HOLD_VERTEX.replace("\tv_uv = a_uv;\n", "\tv_uv = a_uv;\n" + (channel ? SKIN_MAT_COPY : "")); }

      // ---- the material in the fragment: happy_material() (SYSTEM.md "Materials") ----------------------------------------------------------------------------
      // The engine's pbr material makes the roughness and the metal of a pixel in resolve_shading_attributes (u_roughness or the roughness map, u_metallic) and derives from them what it shades with (f0, the diffuse
      // colour, the linear roughness). happy_material(mat) is the helper that a species' override of that function calls AFTER the engine's (super_resolve_shading_attributes): it mixes the vertex's own values in by their
      // weights (a weight of 1 replaces what the species says, 0 leaves it), keeps the roughness above the engine's MIN_ROUGHNESS and derives f0, the diffuse colour and the linear roughness again, the engine's way. The
      // forward pass and the deferred G-buffer pass (and every clone the deferred renderer makes) run the same resolve_shading_attributes, so both honour it. A species whose own `shader_extra` overrides
      // resolve_shading_attributes (the human's HUMAN_SHADER) calls happy_material(mat) at its end; one that does not gets system's override that does nothing else. A species with no channel has no varying and no
      // helper, unless its shader_extra calls happy_material: then it is a function that does nothing (the same shader serves a mesh with a channel and one without).
      // SPECULAR ANTIALIASING (on unless the material says `specular_aa: false`): the sun is a light of no size, and a glossy part that is small and curved (an eye seen from a few metres) turns its normal so much within a
      // pixel that the glint of a low roughness is smaller than the pixel: it falls between the samples and is not seen, or it sparkles as the creature moves. The roughness is widened by how much the normal turns
      // across the pixel (Tokuyoshi and Kaplanyan 2019: alpha^2 + min(2 * 0.25 * (|dN/dx|^2 + |dN/dy|^2), 0.18), alpha = roughness^2, the engine's mapping): the lobe that the pixel sees, a catchlight of a pixel
      // or more whose energy is the glint's. Up close, where the normal hardly turns within a pixel, it changes nothing.
      const MAT_FRAG_HEAD = `
varying vec4 v_happy_mat;
void happy_material(inout Material mat){
	mat.roughness = mix(mat.roughness, v_happy_mat.x, v_happy_mat.y);
`;
      const MAT_FRAG_AA = `	vec3 happy_dnx = dFdx(mat.normal_world), happy_dny = dFdy(mat.normal_world);
	float happy_a2 = mat.roughness * mat.roughness;
	happy_a2 = clamp(happy_a2 * happy_a2 + min(0.5 * (dot(happy_dnx, happy_dnx) + dot(happy_dny, happy_dny)), 0.18), 0.0, 1.0);
	mat.roughness = sqrt(sqrt(happy_a2));
`;
      const MAT_FRAG_TAIL = `	mat.roughness = clamp(mat.roughness, MIN_ROUGHNESS, 1.0);
	mat.metallic = mix(mat.metallic, v_happy_mat.z, v_happy_mat.w);
	mat.f0 = 0.16 * u_reflectance * u_reflectance * (1.0 - mat.metallic) + mat.base_color.rgb * mat.metallic;
	mat.diffuse_color = mat.base_color.rgb * (1.0 - mat.metallic);
	mat.linear_roughness = mat.roughness * mat.roughness;
`;
      const MAT_FRAG_END = `}
`;
      // THE SKY IN A GLOSSY PART (a forward page: the lab, the studios; the material's `sky`, on by default for a species whose eyes are glossy by the eyes' default): the engine lights a forward pass with the sun alone,
      // so an eye catches the light only when the sun is in front of it. A glossy pixel (its roughness under 0.6, as the antialiasing left it: a crease or an outline, where the normal turns fast across the pixel, mirrors a
      // blur and is left out, not a bright seam) mirrors an ANALYTIC SKY as well: the gradient of the lab's stage from the horizon to the zenith by the height of the reflected ray, the ground's tint below the horizon,
      // a soft glow round the sun; times Schlick's Fresnel (the material's f0) and (1 - roughness)^2 (fading out from 0.4 to 0.6), times a strength. It goes into mat.indirect_specular, which the forward fragment() adds to the colour and the deferred G-buffer pass never reads (its lighting pass has a sky reflection of its own:
      // deffered_rendering_v2.js ENABLE_SKY_REFLECTION); DEFFERED_RENDERING, which the engine tests for and no pass defines yet, leaves it out too. The colours and the strength are uniforms of the species' material
      // (u_happy_sky_horizon, u_happy_sky_zenith, u_happy_sky_ground, u_happy_sky_strength): sp.set_sky, sp.set_uniform. A rough pixel pays one comparison.
      const MAT_SKY_FN = `
uniform vec3 u_happy_sky_horizon;
uniform vec3 u_happy_sky_zenith;
uniform vec3 u_happy_sky_ground;
uniform float u_happy_sky_strength;
vec3 happy_sky(vec3 r){
	vec3 c = r.y >= 0.0 ? mix(u_happy_sky_horizon, u_happy_sky_zenith, pow(max(r.y, 1e-4), 0.55)) : mix(u_happy_sky_horizon, u_happy_sky_ground, min(1.0, -6.0 * r.y));
	vec3 l = normalize(directional_lights[0].direction);
	return c + directional_lights[0].color * (directional_lights[0].illuminated * directional_lights[0].attenuation * 0.5 * pow(max(dot(r, l), 0.0), 32.0));
}
`;
      const MAT_SKY_ADD = `#ifndef DEFFERED_RENDERING
	if (mat.roughness < 0.6) {
		vec3 happy_rv = reflect(-mat.view_world, mat.normal_world);
		vec3 happy_f = mat.f0 + (1.0 - mat.f0) * pow(1.0 - clamp(dot(mat.normal_world, mat.view_world), 0.0, 1.0), 5.0);
		float happy_g = (1.0 - mat.roughness) * (1.0 - mat.roughness) * (1.0 - smoothstep(0.4, 0.6, mat.roughness));
		mat.indirect_specular += happy_sky(happy_rv) * happy_f * (happy_g * u_happy_sky_strength);
	}
#endif
`;
      const MAT_STUB = `
void happy_material(inout Material mat){ }
`;
      const MAT_OVERRIDE = `
void resolve_shading_attributes(inout Material mat){
	super_resolve_shading_attributes(mat);
	happy_material(mat);
}
`;
      // the engine's metallic map is switched by U_METALLIC_MAP, a define that no flag of its material makes (the flag is spelled u_matallic_map): a species that has a metal map says it itself
      const MAT_METAL_MAP = `
#define U_METALLIC_MAP
`;
      // THE PACKED MAP (maps.js): ONE read of ONE picture says four things of a pixel: R the occlusion, G the roughness, B the metal, A the opacity (255 is solid; the species' `alpha_test` cuts what is under it). They are taken after the engine's own
      // resolve (they REPLACE the species' u_roughness and u_metallic, as the engine's roughness and metal maps do) and before the vertex channel, if there is one, mixes its own values in. The occlusion goes two ways, by u_happy_pack_ao = [ambient, colour]:
      // mat.ao (the forward pass lights its ambient light by it; the deferred pass has no occlusion of its own) and the colour (both passes: darkened by mix(1, ao, share)). The opacity is on mat.opacity (the forward pass) and on the colour's alpha (the deferred
      // G-buffer pass tests that one). No `if` and no ternary: every line is arithmetic, a species that has the map pays one texture read.
      const MAT_PACK_DECL = `
uniform sampler2D u_happy_pack;
uniform vec2 u_happy_pack_ao;
`;
      const MAT_PACK_CODE = `	vec4 happy_p = texture2D(u_happy_pack, mat.uv);
	mat.roughness = happy_p.g;
	mat.metallic = happy_p.b;
	mat.ao *= mix(1.0, happy_p.r, u_happy_pack_ao.x);
	mat.base_color.rgb *= mix(1.0, happy_p.r, u_happy_pack_ao.y);
	mat.opacity *= happy_p.a;
	mat.base_color.a *= happy_p.a;
`;
      // THE NORMAL MAP (maps.js, `material.maps.normal`): a tangent-space normal, read at the pixel's uv and put on the surface's own normal in the frame of its uv. The frame is made from the derivatives of the WORLD POSITION and of the uv (Schuler's cotangent
      // frame: no tangents in the mesh), so it is exact at any angle. (The engine's own normal map, U_NORMAL_MAP, builds its frame from the derivatives of the normalized view vector, which turns the frame toward the screen on a surface seen at a slant, so its relief is not exact there.)
      // The vectors are unit ones, as the picture was baked in them (the unwrap's uvs are the same scale both ways). It runs FIRST in happy_material, so the specular antialiasing that follows
      // widens the glint by how much the PERTURBED normal turns across a pixel (a fine relief does not sparkle). u_happy_normal_scale (1) says how much of the slope is used; mat.facing turns it round on the back of a double-sided face.
      const MAT_NORMAL_DECL = `
uniform sampler2D u_happy_normal;
uniform float u_happy_normal_scale;
`;
      const MAT_NORMAL_CODE = `	vec3 happy_nm = texture2D(u_happy_normal, mat.uv).rgb * 2.0 - 1.0;
	happy_nm.xy *= u_happy_normal_scale * mat.facing;
	vec3 happy_n = normalize(mat.normal_world);
	vec3 happy_dp1 = dFdx(mat.position_world), happy_dp2 = dFdy(mat.position_world);
	vec2 happy_duv1 = dFdx(mat.uv), happy_duv2 = dFdy(mat.uv);
	vec3 happy_p2 = cross(happy_dp2, happy_n), happy_p1 = cross(happy_n, happy_dp1);
	vec3 happy_t = happy_p2 * happy_duv1.x + happy_p1 * happy_duv2.x;
	vec3 happy_b = happy_p2 * happy_duv1.y + happy_p1 * happy_duv2.y;
	float happy_tl = dot(happy_t, happy_t), happy_bl = dot(happy_b, happy_b);
	happy_t *= inversesqrt(max(happy_tl, 1e-30));
	happy_b *= inversesqrt(max(happy_bl, 1e-30));
	mat.normal_world = normalize(happy_t * happy_nm.x + happy_b * happy_nm.y + happy_n * happy_nm.z);
`;
      const MAT_PACK_HEAD = "\nvoid happy_material(inout Material mat){\n" + MAT_PACK_CODE;
      const MAT_PACK_TAIL = MAT_FRAG_TAIL.replace(/\tmat\.metallic = mix\(mat\.metallic, v_happy_mat\.z, v_happy_mat\.w\);\n/, "");                // (no vertex channel: nothing to mix the metal with)
      // does a species' own shader text override resolve_shading_attributes (a function with a body, the way the engine's inheritance finds one)?
      function overrides_shading(text) { return typeof text === "string" && /(?:\w+\s+)+resolve_shading_attributes\s*\([^)]*\)\s*\{/.test(text.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")); }
      // the fragment text system puts after the skinning shader, before the species' shader_extra: "" for a species with no channel and no metal map whose shader_extra does not call happy_material (bit for bit the old shader).
      // aa: the specular antialiasing (the material's `specular_aa`, true unless it is false); sky: the sky in the glossy parts (a channel's only)
      function material_shader(channel, extra, metal_map, aa, sky, pack, normal) {
        let s = metal_map ? MAT_METAL_MAP : "";
        const calls = typeof extra === "string" && /\bhappy_material\s*\(/.test(extra.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ""));
        if (channel) {
          s += (pack ? MAT_PACK_DECL : "") + (normal ? MAT_NORMAL_DECL : "") + (sky ? MAT_SKY_FN : "") + (pack || normal ? MAT_FRAG_HEAD.replace("{\n", "{\n" + (normal ? MAT_NORMAL_CODE : "") + (pack ? MAT_PACK_CODE : "")) : MAT_FRAG_HEAD) + (aa === false ? "" : MAT_FRAG_AA) + MAT_FRAG_TAIL + (sky ? MAT_SKY_ADD : "") + MAT_FRAG_END;
          if (!overrides_shading(extra)) s += MAT_OVERRIDE;
        } else if (pack || normal) {                                                                            // (a packed map or a normal map and no vertex channel: the same helper without the varying)
          s += (pack ? MAT_PACK_DECL : "") + (normal ? MAT_NORMAL_DECL : "") + "\nvoid happy_material(inout Material mat){\n" + (normal ? MAT_NORMAL_CODE : "") + (pack ? MAT_PACK_CODE : "") + (aa === false ? "" : MAT_FRAG_AA) + MAT_PACK_TAIL + MAT_FRAG_END;
          if (!overrides_shading(extra)) s += MAT_OVERRIDE;
        } else if (calls) s += MAT_STUB;
        return s;
      }

      // ========================================================================================================================
      // integral
      // ========================================================================================================================
// system.js, a part: the modules that are built in (the mesher).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- the built in modules ------------------------------------------------------------------------------------------------------------------------------------------------------------------
      // system makes a creature's geometry itself, from the `sdf` of its definition (the def of the mesher: parts on the creature's own bones), so the mesher is system's: mesher.js is INCLUDED HERE AS TEXT, into a function
      // of its own (the bundler's import directive puts the file's text in place; the closure of system.js is the engine's scope). The file is written as a module (packing()("name", function () { ... return the module }))
      // so that node's tools and tests load it as it is; here `packing` is a stand-in that hands the module's value back. The page lists @/system/system.js and nothing else, and nothing is supplied from outside:
      // system.use_mesher only puts another mesher in its place (a test's stand-in). The mesher MAKES nothing until the first creature with an `sdf` asks (system.build_sdf): a species without one never starts it.
      const mesher_libs = (function () { const libs = {}; const packing = function () { return function (name, factory) { libs[name] = factory; }; }; import("@/system/mesher.js"); return libs; })();          // (the mesher and the part codecs: modules of mesher.js, made when they are asked for)
      const happy_mesher = mesher_libs.happy_mesher();
      // the pieces of the parts catalogue (SYSTEM.md): a creature's sdf may name a PIECE as a volume (species.js, "VOLUMES"); its .happypart is read by the catalogue's own reader and mesh codec, built in the
      // same way (pure packing modules: parts/part_file.js and parts/optimize/mesh_optimize.js), and baked by the mesher when it is first needed
      const happy_part_file = (function () { const lib = mesher_libs.happy_part_file(); lib.use_meshpack(mesher_libs.happy_mesh_optimize()); return lib; })();

      // ========================================================================================================================
      // sdf
      // ========================================================================================================================
// system.js, a part: geometry from an sdf: the mesher's geometry made into the arrays system takes (SYSTEM.md, "Meshes").
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- geometry from an sdf: only for a creature whose definition HAS `sdf` ------------------------------------------------------------------------------------------------------------------
      // A creature that has its mesh as plain arrays never comes here. A creature whose definition has `sdf` -- { cell, shade, skin, adaptive, decimate, islands, parts: [...] }: the mesher's def (SYSTEM.md) without its
      // bones -- gets its mesh and its skin weights made by system's own mesher (mesher.js, built in, see integral.js) ON ITS OWN SKELETON: the bones of the def are the creature's, the twins written out, in the order of
      // the species' bones, so a part says `bone: "forearm_l"` and the weights it makes are weights of the creature's own bones (a weight is found by the bone's NAME, not its place in the mesher's list). The mesher is
      // asynchronous (the GPU in a worker, else the CPU in one), so making the mesh is ONE asynchronous step, system.build_sdf(input | [inputs]), done before system.species(input); everything after it is synchronous plain
      // arrays like any creature's. The geometry is kept with the def object it was made from (a WeakMap: it lives as long as the def does) and by the text of the def and its bones (the last 16: a library that is read
      // again does not make the same sdf again). A def that is changed in place is a new def: what was made is found again only for the same TEXT (the def's JSON and the bones').
      let sdf_made = new WeakMap(), sdf_epoch = 0;                                  // (the epoch counts the meshers: what an earlier one was still making is not kept)
      const sdf_texts = [], SDF_TEXTS = 16;
      let sdf_source, sdf_options = null, sdf_engine = null;                          // what use_mesher gave (undefined: the built in mesher, null: none), and the mesher made of it (a Promise)
      // use_mesher(m, o) puts another mesher in the place of the built in one: the module, a mesher that create() made, or the Promise of one (a test's stand-in); o: the options of create(); null: no mesher at all. What
      // the one before made is forgotten (the geometry of a def is the mesher's)
      system.use_mesher = function (m, o) {
        if (m !== null && m !== undefined && typeof m.then !== "function" && typeof m.build !== "function" && typeof m.create !== "function") throw new Error("system: use_mesher takes the happy_mesher module, or a mesher that happy_mesher.create() made (or the Promise of one)");
        sdf_source = m === undefined ? undefined : (m || null); sdf_options = o || {}; sdf_engine = null;
        sdf_made = new WeakMap(); sdf_texts.length = 0; sdf_epoch++;
        vol_given = new Map();                                                         // (the volumes given to the mesher before: the new one has none of them)
      };
      function get_mesher() {
        const source = sdf_source !== undefined ? sdf_source : happy_mesher;
        if (!source) return Promise.reject(new Error("system: this creature has an sdf and system has no mesher (system.use_mesher(null) took it away)"));
        if (!sdf_engine) sdf_engine = Promise.resolve(source).then(function (x) {
          if (x && typeof x.build === "function") return x;
          if (x && typeof x.create === "function") return x.create(sdf_options);
          throw new Error("system: use_mesher was given something that is neither a mesher nor the happy_mesher module");
        }).catch(function (e) { sdf_engine = null; throw e; });
        return sdf_engine;
      }
      // the bones the mesher is given: the species' own, in its order, the twins written out (a plain list: no `mirror`, no `roll`)
      function sdf_bones(sk) {
        const out = [];
        for (let i = 0; i < sk.n; i++) {
          const p = sk.parent[i];
          out.push({ name: sk.names[i], parent: p >= 0 ? sk.names[p] : null, head: [sk.head[i * 3], sk.head[i * 3 + 1], sk.head[i * 3 + 2]], tail: [sk.tail[i * 3], sk.tail[i * 3 + 1], sk.tail[i * 3 + 2]] });
        }
        return out;
      }
      function sdf_def_error(def, who) {
        return !def || typeof def !== "object" || Array.isArray(def) || !Array.isArray(def.parts) || !def.parts.length ? "creature '" + who + "': sdf: the sdf is the mesher's def { cell, shade, parts ... }, with parts" : null;
      }
      // THE MATERIAL OF A PART (SYSTEM.md "Materials"): a part may say its `roughness` and its `metal` (numbers 0 .. 1; -1: none, the species'): a glossy eye, a wet nose, a lens of glass, a visor of metal. They shape nothing,
      // so the mesher is not told them and the geometry is not keyed by them (a part made glossy is the same mesh: not made again); the mesher is asked for the PART of every vertex (part_ids), the geometry keeps it with
      // the parts' ids, and the species takes the values from the def's parts by id (a mirror twin, "eye#x", has its part's: draw.js makes the channel of them)
      const PART_MATERIAL = ["roughness", "metal"];
      const has_part_material = function (p) { return !!p && typeof p === "object" && (p.roughness !== undefined || p.metal !== undefined); };
      function sdf_shape_def(def) {                                                                          // the def without the parts' material (what the mesher is given, what the geometry is keyed by)
        if (!def || !Array.isArray(def.parts) || !def.parts.some(has_part_material)) return def;
        return Object.assign({}, def, { parts: def.parts.map(function (p) { if (!has_part_material(p)) return p; const q = Object.assign({}, p); PART_MATERIAL.forEach(function (k) { delete q[k]; }); return q; }) });
      }
      // the parts' material of a def, checked (every complaint is listed) -> { <part id>: { roughness, metal } } (-1: not said) or null when no part says one
      function sdf_part_materials(def, who) {
        if (!def || !Array.isArray(def.parts) || !def.parts.some(has_part_material)) return null;
        const out = {}, errs = [];
        def.parts.forEach(function (p, i) {
          if (!has_part_material(p)) return;
          const id = p.id !== undefined ? String(p.id) : "p" + i, v = { roughness: -1, metal: -1 };
          PART_MATERIAL.forEach(function (k) {
            const x = p[k];
            if (x === undefined || x === null) return;
            if (typeof x !== "number" || !Number.isFinite(x) || x > 1) errs.push("part '" + id + "': " + k + " must be a number of at most 1 (0 .. 1; -1: not said, the species') (" + x + ")");
            else if (x >= 0) v[k] = x;
          });
          out[id] = v;
        });
        if (errs.length) fail("creature '" + who + "': sdf: " + errs.join("; "));
        return out;
      }
      // ---- VOLUMES: parts of shape "volume" (a baked triangle mesh: SYSTEM.md "Volumes"; pieces of the parts catalogue, an imported torso) ------------------------------------------------------------------
      // A creature whose sdf has volume parts SAYS WHICH VOLUMES IT NEEDS: sdf.volumes = { <id>: { hash, file | data } }. hash: happy_mesher.bytes_hash of the volume's .sdfvol bytes (FNV-1a, 8 hex digits): the bytes,
      // not the name, are what the mesh is made of, so the cache keys have the hash (a new bake of a piece is a new mesh); file: where the .sdfvol is, a path relative to system.volume_url (the library's folder:
      // the file next to the creature) or from system.volume_base (the server's root) when it starts with "/"; data: the bytes themselves (base64 text, or a Uint8Array: a creature file that carries its volumes).
      // Bytes the host gave (system.add_volume(bytes)) are used by their hash before anything is read. system.build_sdf reads each volume once, checks its hash, decodes it and gives it to the mesher ONCE, under
      // "<id>#<hash>" (two creatures that name two volumes by one id never meet), and the parts are given to the mesher under that name. A def with no `volumes` is given to the mesher as it was (a page that
      // loaded its volumes into the mesher it gave system: system.use_mesher, the creator studio's way).
      // A PIECE of the parts catalogue (a .happypart: a closed, skinned, coloured mesh with its bones, no baked grid in it) is a volume source too: { hash (of the .happypart's bytes), piece: its path (the same rules
      // as file) | piece_data: its bytes, bake?: { cell, band } }. system reads it with the catalogue's reader (integral.js), and the mesher BAKES its mesh, colours and skin (its bones by name: `@host`, its own, a
      // torso's `@<socket>`) when it is first needed, once, at `bake.cell` or else 0.6 of the creature's cell divided by the largest `scale` a part gives it (a piece scaled x2 is baked at twice the cell), band
      // `bake.band` (6); the mesher keeps it under "<id>#<hash>@<cell>/<band>", and the cache keys have those too
      system.volume_base = "/";
      system.volume_url = "creatures/";
      const vol_bytes = new Map(), vol_reading = new Map();                          // hash -> the bytes (given, carried or read: a .sdfvol or a .happypart), hash -> the Promise of a read that is under way
      let vol_given = new Map();                                                       // the mesher's name of a volume -> the Promise of its add_volume (or its bake) in the mesher system has now (use_mesher forgets them)
      const is_sdfvol = function (u8) { return u8.length >= 12 && u8[0] === 0x53 && u8[1] === 0x44 && u8[2] === 0x46 && u8[3] === 0x56; };
      const is_piece_bytes = function (u8) { return u8.length >= 16 && u8[0] === 0x48 && u8[1] === 0x53 && u8[2] === 0x59 && u8[3] === 0x53 && u8[4] === 0x50 && u8[5] === 0x41 && u8[6] === 0x52 && u8[7] === 0x54; };   // ("HSYSPART")
      const is_piece = function (e) { return !!e && (e.piece !== undefined || e.piece_data !== undefined || e.bake !== undefined); };
      // the bytes of a .sdfvol or of a .happypart given by the host (an ArrayBuffer or a Uint8Array): kept by their hash, which a creature's sdf.volumes names -> { hash, bytes, kind: "sdfvol" | "piece" }
      system.add_volume = function (bytes) {
        const u8 = bytes instanceof Uint8Array ? bytes : (bytes && ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : (bytes && typeof bytes.byteLength === "number" && typeof bytes.slice === "function" ? new Uint8Array(bytes) : null));     // (an ArrayBuffer by its shape: one of another realm is no instance of this one's)
        if (!u8 || (!is_sdfvol(u8) && !is_piece_bytes(u8))) fail("system.add_volume takes the bytes of a .sdfvol or of a .happypart (an ArrayBuffer or a Uint8Array that starts with SDFV or HSYSPART)");
        const hash = happy_mesher.bytes_hash(u8);
        vol_bytes.set(hash, u8);
        return { hash: hash, bytes: u8.length, kind: is_piece_bytes(u8) ? "piece" : "sdfvol" };
      };
      system.volume_hash = function (bytes) { return happy_mesher.bytes_hash(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)); };
      function volume_url_of(file) { return /^[a-z][a-z0-9+.-]*:/i.test(file) ? file : (file.charAt(0) === "/" ? system.volume_base + file.slice(1) : system.volume_base + system.volume_url + file); }
      const B64 = (function () { const t = new Int16Array(256).fill(-1), s = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; for (let i = 0; i < 64; i++) t[s.charCodeAt(i)] = i; t[45] = 62; t[95] = 63; return t; })();
      function b64_bytes(str) {
        const out = new Uint8Array(Math.floor(str.length * 3 / 4) + 3);
        let o = 0, acc = 0, bits = 0;
        for (let i = 0; i < str.length; i++) { const v = B64[str.charCodeAt(i) & 255]; if (v < 0) continue; acc = ((acc << 6) | v) & 0xffffff; bits += 6; if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255; } }
        return out.subarray(0, o);
      }
      // the volumes a def declares, checked (every complaint at once): [{ id, hash, file, data }], or null when it declares none
      function sdf_volumes_of(def, who) {
        const V = def.volumes;
        if (V === undefined || V === null) return null;
        const tag = "creature '" + who + "': sdf.volumes: ";
        if (typeof V !== "object" || Array.isArray(V)) fail(tag + "an object { <id>: { hash, file | data } }");
        const out = [], errs = [];
        Object.keys(V).forEach(function (id) {
          const e = V[id];
          if (!e || typeof e !== "object") { errs.push("'" + id + "' is { hash, file | data } (a .sdfvol) or { hash, piece | piece_data, bake? } (a .happypart)"); return; }
          if (typeof e.hash !== "string" || !/^[0-9a-f]{8}$/.test(e.hash)) errs.push("'" + id + "': hash is happy_mesher.bytes_hash of its .sdfvol or .happypart, 8 hex digits (" + JSON.stringify(e.hash) + ")");
          if (e.file !== undefined && (typeof e.file !== "string" || !e.file)) errs.push("'" + id + "': file is a path (" + JSON.stringify(e.file) + ")");
          if (e.data !== undefined && typeof e.data !== "string" && !(e.data instanceof Uint8Array)) errs.push("'" + id + "': data is the .sdfvol's bytes, base64 text or a Uint8Array");
          if (e.piece !== undefined && (typeof e.piece !== "string" || !e.piece)) errs.push("'" + id + "': piece is the path of a .happypart (" + JSON.stringify(e.piece) + ")");
          if (e.piece_data !== undefined && typeof e.piece_data !== "string" && !(e.piece_data instanceof Uint8Array)) errs.push("'" + id + "': piece_data is the .happypart's bytes, base64 text or a Uint8Array");
          if (is_piece(e) && (e.file !== undefined || e.data !== undefined)) errs.push("'" + id + "': a piece (piece, piece_data, bake) or a .sdfvol (file, data), not both");
          if (e.bake !== undefined && (typeof e.bake !== "object" || !e.bake || (e.bake.cell !== undefined && !(e.bake.cell > 0)) || (e.bake.band !== undefined && !(e.bake.band >= 2)) || (e.bake.flat !== undefined && !(e.bake.flat > 0)) || (e.bake.sheet !== undefined && !(e.bake.sheet > 0)))) errs.push("'" + id + "': bake is { cell (m, > 0), band (cells, >= 2), flat? (cells, > 0: a closed shell thinner than that, 3 V / A, is a sheet), sheet? (cells, > 0: a sheet's thickness) }");
          out.push({ id: id, hash: e.hash, file: e.file, data: e.data, piece: e.piece, piece_data: e.piece_data, bake: e.bake, is_piece: is_piece(e) });
        });
        def.parts.forEach(function (p, i) { if (p && p.shape === "volume" && !Object.prototype.hasOwnProperty.call(V, p.volume)) errs.push("the part '" + (p.id !== undefined ? p.id : "p" + i) + "' names the volume '" + p.volume + "', which is not declared"); });
        if (errs.length) fail(tag + errs.join("; "));
        return out;
      }
      // the bake of a piece: the declaration's cell and band, else 0.6 of the creature's cell over the largest scale a part gives the piece (rounded to a tenth of a millimetre: the mesher's name has it) and 6 cells
      function piece_bake(def, id) {
        const e = def.volumes[id], b = (e && e.bake) || {};
        let s = 0;
        def.parts.forEach(function (p) { if (p && p.shape === "volume" && p.volume === id) s = Math.max(s, p.scale > 0 ? p.scale : 1); });
        const cell = b.cell > 0 ? b.cell : Math.max(0.0015, Math.round(0.6 * (def.cell > 0 ? def.cell : 0.05) / (s || 1) * 1e4) / 1e4);
        const out = { cell: cell, band: b.band >= 2 ? Math.round(b.band) : 6 };
        if (b.flat > 0) out.flat = b.flat;                                                                      // (a thin piece baked as a SHEET: the creator's thin "sheet" mode; the mesher's bake option)
        if (b.sheet > 0) out.sheet = b.sheet;
        return out;
      }
      // the name the mesher has a declared volume under: "<id>#<hash>" (a .sdfvol), "<id>#<hash>@<cell>/<band>" (a piece: one bake a setting; "/f<flat>/s<sheet>" after it when the bake says them)
      function volume_key(def, id) {
        const e = def.volumes[id];
        if (!is_piece(e)) return id + "#" + e.hash;
        const b = piece_bake(def, id);
        return id + "#" + e.hash + "@" + b.cell + "/" + b.band + (b.flat ? "/f" + b.flat : "") + (b.sheet ? "/s" + b.sheet : "");
      }
      // the bytes of a declared volume -> Promise: the host's or a read's of before (by the hash), its `data` / `piece_data`, or its `file` / `piece`, read once; the bytes must hash to what the creature says and be
      // what it says they are (a .sdfvol, a .happypart)
      function volume_bytes(e, who) {
        const known = vol_bytes.get(e.hash);
        const tag = "system: creature '" + who + "': the volume '" + e.id + "' (" + e.hash + ")";
        const kind = function (u8) { if (e.is_piece ? !is_piece_bytes(u8) : !is_sdfvol(u8)) throw new Error(tag + ": its bytes are not a " + (e.is_piece ? ".happypart (a piece of the catalogue)" : ".sdfvol") + " as its declaration says"); return u8; };
        if (known) return Promise.resolve(known).then(kind);
        if (vol_reading.has(e.hash)) return vol_reading.get(e.hash).then(kind);
        let p;
        const data = e.is_piece ? e.piece_data : e.data, file = e.is_piece ? e.piece : e.file;
        if (data !== undefined) p = Promise.resolve(typeof data === "string" ? b64_bytes(data) : data);
        else if (file !== undefined) {
          const url = volume_url_of(file);
          p = Promise.resolve().then(function () { return httprequest.get_url(url, "arraybuffer"); }).then(function (b) { return b instanceof Uint8Array ? b : new Uint8Array(b); }, function (err) { throw new Error(tag + " could not be read from '" + url + "' (" + String(err && err.message !== undefined ? err.message : err) + ")"); });
        } else p = Promise.reject(new Error(tag + " has no " + (e.is_piece ? "piece and no piece_data" : "file and no data") + ", and the host gave no volume of that hash (system.add_volume(bytes))"));
        p = p.then(function (u8) {
          const h = happy_mesher.bytes_hash(u8);
          if (h !== e.hash) throw new Error(tag + " is not the volume it was made with: these bytes hash to " + h + (file !== undefined ? " (" + volume_url_of(file) + ")" : ""));
          kind(u8);
          vol_bytes.set(h, u8);
          return u8;
        });
        vol_reading.set(e.hash, p);
        const done = function () { vol_reading.delete(e.hash); };
        p.then(done, done);
        return p;
      }
      // a declared volume given to the mesher m, once, under its name (volume_key): a .sdfvol decoded and added, a piece read (its mesh, colours and skin by the names of its bones) and BAKED by the mesher (in its
      // worker) -> Promise of that name
      function volume_in_mesher(m, e, u8, who, def) {
        const key = volume_key(def, e.id);
        let p = vol_given.get(key);
        if (p) return p;
        if (!m || typeof m.add_volume !== "function" || (e.is_piece && typeof m.bake !== "function")) return Promise.reject(new Error("system: creature '" + who + "': its sdf has volumes and the mesher system was given has no " + (e.is_piece ? "bake" : "add_volume")));
        if (e.is_piece) {
          const b = piece_bake(def, e.id);
          p = Promise.resolve().then(function () {
            const pc = happy_part_file.read(u8), pm = pc.mesh, names = pc.bones.map(function (bo) { return bo.name; });
            const parents = pc.bones.map(function (bo) { return bo.parent === null || bo.parent === undefined ? -1 : names.indexOf(bo.parent); });       // (the piece's anchor chain: a name the creature has no bone for goes up it, to @host)
            const bo = { id: key, cell: b.cell, band: b.band, cap: true };
            if (b.flat) bo.flat = b.flat;
            if (b.sheet) bo.sheet = b.sheet;
            return m.bake({ positions: pm.positions, indices: pm.indices, colors: pm.colors, joints: pm.skin_indices, weights: pm.skin_weights, joint_names: names, joint_parents: parents }, bo);
          }).then(function () { return key; }, function (err) { throw new Error("system: creature '" + who + "': the piece '" + e.id + "' (" + e.hash + ") could not be baked: " + String(err && err.message !== undefined ? err.message : err)); });
        } else p = Promise.resolve().then(function () { const vol = happy_mesher.decode_volume(u8); vol.id = key; return m.add_volume(vol); }).then(function () { return key; });
        vol_given.set(key, p);
        p.then(null, function () { if (vol_given.get(key) === p) vol_given.delete(key); });
        return p;
      }
      // what the cache keys are made of: the def's shape with its volumes by the mesher's names of them (the bytes' hash, and a piece's bake: not where they came from, a def that carries its data is keyed as one
      // that names its file)
      function sdf_key(def) {
        const d = sdf_shape_def(def), V = d && d.volumes;
        if (!V || typeof V !== "object") return JSON.stringify(d);
        const h = {};
        Object.keys(V).forEach(function (id) { h[id] = V[id] && typeof V[id].hash === "string" ? volume_key(d, id) : null; });
        return JSON.stringify(Object.assign({}, d, { volumes: h }));
      }

      // ---- PIECES AS THEIR OWN MESH (sdf.meshes; SYSTEM.md "Meshes", the creator's thin pieces) ------------------------------------------------------------------------------------------------------------------------
      // A piece of the parts catalogue too thin for the creature's cell (a wing's membrane, a flamingo's leg: the grid shreds it) is not baked and meshed: its OWN closed, decimated, skinned, coloured mesh is APPENDED to
      // what the mesher made. sdf.meshes = [{ id, volume (a piece declared in sdf.volumes: { hash, piece | piece_data }), origin | center, rotate?, scale?, mirror?: "x", bone, bone_map?, color? (a tint), roughness?,
      // metal? }]: placed as a volume part is (happy_mesher.volume_place: w = origin + s R p, R = Rz Ry Rx of `rotate` in degrees; `center` puts the middle of the piece's box there; the mirror copy at x negated, its
      // triangles turned over), its skin's names mapped to the creature's bones as a volume part's are (happy_mesher's skin_name_map: `bone_map`, `@host` to `bone`, `@host:k` up the creature's chain, `@<name>:k` down it,
      // a name that resolves to nothing up the piece's own chain of anchors, else into `@host`'s bone; the mirror copy takes the twin of every bone), its colours (linear) times the tint, its normals turned. It never
      // blends and is never baked: it meets the body where it pokes into it. A def with no `meshes` is made exactly as before (the same mesh, the same keys)
      const MESH_KEYS = ["id", "volume", "origin", "center", "rotate", "scale", "mirror", "bone", "bone_map", "color", "roughness", "metal"];
      const is_v3 = function (v) { return Array.isArray(v) && v.length === 3 && v.every(function (x) { return typeof x === "number" && Number.isFinite(x); }); };
      function sdf_meshes_of(def, who) {
        const L = def.meshes;
        if (L === undefined || L === null) return null;
        const tag = "creature '" + who + "': sdf.meshes: ", errs = [], V = def.volumes && typeof def.volumes === "object" ? def.volumes : {};
        if (!Array.isArray(L)) fail(tag + "a list of [{ id, volume, origin, rotate, scale, mirror, bone, bone_map, color }] (pieces appended as their own mesh)");
        L.forEach(function (e, i) {
          const w = "meshes[" + i + "]" + (e && typeof e.id === "string" ? " '" + e.id + "'" : "");
          if (!e || typeof e !== "object" || Array.isArray(e)) { errs.push(w + " is an object"); return; }
          for (const k in e) if (MESH_KEYS.indexOf(k) < 0) errs.push(w + ": unknown key '" + k + "' (" + MESH_KEYS.join(", ") + ")");
          if (typeof e.id !== "string" || !e.id) errs.push(w + ": id is a name");
          if (typeof e.volume !== "string" || !V[e.volume] || !is_piece(V[e.volume])) errs.push(w + ": volume names a piece declared in sdf.volumes ({ hash, piece | piece_data }) (" + JSON.stringify(e.volume) + ")");
          if (!is_v3(e.origin) && !is_v3(e.center)) errs.push(w + ": origin (where the piece's own origin, its socket, stands) or center is [x, y, z]");
          if (e.rotate !== undefined && !is_v3(e.rotate)) errs.push(w + ": rotate is [rx, ry, rz] (degrees)");
          if (e.scale !== undefined && !(typeof e.scale === "number" && e.scale > 0)) errs.push(w + ": scale is a number over 0");
          if (e.mirror !== undefined && e.mirror !== false && e.mirror !== "x") errs.push(w + ": mirror is \"x\" or false");
          if (typeof e.bone !== "string" || !e.bone) errs.push(w + ": bone is the bone of the creature the piece hangs on (its `@host`)");
          if (e.bone_map !== undefined && (!e.bone_map || typeof e.bone_map !== "object" || Array.isArray(e.bone_map))) errs.push(w + ": bone_map is { name in the piece's skin: bone of the creature | null }");
          if (e.color !== undefined && !(Array.isArray(e.color) && (e.color.length === 3 || e.color.length === 4) && e.color.every(function (x) { return typeof x === "number" && x >= 0 && x <= 1; }))) errs.push(w + ": color is [r, g, b(, a)] (0 .. 1): a tint");
        });
        if (errs.length) fail(tag + errs.join("; "));
        return L;
      }
      // the pieces the meshes are made of, decoded once (the bytes' hash -> { bones, mesh, mid })
      const mesh_pieces = new Map();
      function mesh_piece(u8, hash) {
        let pc = mesh_pieces.get(hash);
        if (pc) return pc;
        const r = happy_part_file.read(u8), P = r.mesh.positions, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { const v = P[i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
        pc = { bones: r.bones, mesh: r.mesh, mid: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2] };
        mesh_pieces.set(hash, pc);
        if (mesh_pieces.size > 64) mesh_pieces.delete(mesh_pieces.keys().next().value);
        return pc;
      }
      // the creature's bone of every name of a piece's skin (-1: dropped): happy_mesher's skin_name_map, the same rules
      function sdf_mesh_names(pc, e, sk, mirrored, info) {
        const names = pc.bones.map(function (b) { return b.name; }), bm = e.bone_map && typeof e.bone_map === "object" ? e.bone_map : null, DROP = -2;
        const at = Object.create(null);
        names.forEach(function (n, i) { at[n] = i; });
        const has = function (k) { return !!bm && Object.prototype.hasOwnProperty.call(bm, k); };
        const own = function (n) {
          const rel = has(n) ? null : /^(@[^:]+):(\d+)$/.exec(n), base = rel ? rel[1] : n;
          const t = has(base) ? bm[base] : (base === "@host" ? e.bone : base);
          if (t === null) return DROP;
          let b = sk.index[t];
          if (b !== undefined && rel) {
            for (let s = +rel[2], up = base === "@host"; s > 0; s--) {
              if (up) { if (sk.parent[b] < 0) break; b = sk.parent[b]; }
              else { if (sk.children[b].length !== 1) break; b = sk.children[b][0]; }
            }
          }
          return b;
        };
        const ht = has("@host") ? bm["@host"] : e.bone, host = ht === null || ht === undefined ? undefined : sk.index[ht];
        const out = new Int32Array(names.length);
        for (let j = 0; j < names.length; j++) {
          let b = own(names[j]), folded = false;
          if (b === undefined) for (let k = at[pc.bones[j].parent], s = 0; k !== undefined && s < names.length; k = at[pc.bones[k].parent], s++) { const c = own(names[k]); if (c !== undefined) { b = c; folded = true; break; } }
          if (b === undefined && host !== undefined) { b = host; folded = true; }
          if (b === DROP) b = undefined;
          else if (b === undefined) { if (info) info.dropped[e.id + ":" + names[j]] = 1; }
          else if (folded && info) info.folded[e.id + ":" + names[j]] = 1;
          if (b !== undefined && mirrored) { const nm = sk.names[b], tw = /_l$/.test(nm) ? nm.replace(/_l$/, "_r") : (/_r$/.test(nm) ? nm.replace(/_r$/, "_l") : null); if (tw && sk.index[tw] !== undefined) b = sk.index[tw]; }
          out[j] = b === undefined ? -1 : b;
        }
        return out;
      }
      // the mesher's geometry made into system's arrays (sdf_from_geometry's) with the pieces of sdf.meshes appended -> a new `made` (the mesher's arrays are not changed)
      function sdf_append_meshes(made, def, list, sk, who, bytes_of) {
        const base = made.mesh, n0 = base.positions.length / 3, i0 = base.indices.length, info = { folded: {}, dropped: {} }, copies = [];
        list.forEach(function (e) {
          const decl = def.volumes[e.volume], pc = mesh_piece(bytes_of(decl.hash), decl.hash);
          copies.push({ e: e, pc: pc, mirrored: false, map: sdf_mesh_names(pc, e, sk, false, info) });
          if (e.mirror === "x") copies.push({ e: e, pc: pc, mirrored: true, map: sdf_mesh_names(pc, e, sk, true, info) });
        });
        let nv = n0, ni = i0;
        copies.forEach(function (c) { nv += c.pc.mesh.positions.length / 3; ni += c.pc.mesh.indices.length; });
        if (nv > 4294967295) fail("creature '" + who + "': sdf.meshes: too many vertices");
        const any_color = !!base.colors || copies.some(function (c) { return !!c.pc.mesh.colors || !!c.e.color; });
        const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), I = new Uint32Array(ni), CO = any_color ? new Float32Array(nv * 4) : null;
        P.set(base.positions); N.set(base.normals); I.set(base.indices);
        if (CO) { if (base.colors) CO.set(base.colors); else CO.fill(1, 0, n0 * 4); }
        const skin = !!(base.skin_indices && base.skin_weights), SI = skin ? new Uint16Array(nv * 4) : null, SW = skin ? new Float32Array(nv * 4) : null;
        if (skin) { SI.set(base.skin_indices); SW.set(base.skin_weights); }
        const UV = base.uvs ? new Float32Array(nv * 2) : null;
        if (UV) UV.set(base.uvs);
        const has_parts = !!(base.part_ids && base.parts), PID = has_parts ? new Uint16Array(nv) : null, parts = has_parts ? base.parts.slice() : null;
        if (has_parts) PID.set(base.part_ids);
        const islands = made.islands ? made.islands.slice() : null, lo = made.bounds ? made.bounds.slice(0, 3) : [Infinity, Infinity, Infinity], hi = made.bounds ? made.bounds.slice(3, 6) : [-Infinity, -Infinity, -Infinity];
        let v0 = n0, t0 = i0;
        const TB = new Int32Array(16), TW = new Float64Array(16);
        copies.forEach(function (c) {
          const e = c.e, m = c.pc.mesh, PP = m.positions, NN = m.normals, nvc = PP.length / 3, s = e.scale > 0 ? e.scale : 1, rot = e.rotate || [0, 0, 0], D = Math.PI / 180;
          const ca = Math.cos(rot[0] * D), sa = Math.sin(rot[0] * D), cb = Math.cos(rot[1] * D), sb = Math.sin(rot[1] * D), cc = Math.cos(rot[2] * D), sc = Math.sin(rot[2] * D);
          const R = [cc * cb, cc * sb * sa - sc * ca, cc * sb * ca + sc * sa, sc * cb, sc * sb * sa + cc * ca, sc * sb * ca - cc * sa, -sb, cb * sa, cb * ca];
          // w = O + s R p: O = origin, or center - s R mid (the middle of the piece's box at center)
          let O = e.origin;
          if (!O) { const md = c.pc.mid; O = [e.center[0] - s * (R[0] * md[0] + R[1] * md[1] + R[2] * md[2]), e.center[1] - s * (R[3] * md[0] + R[4] * md[1] + R[5] * md[2]), e.center[2] - s * (R[6] * md[0] + R[7] * md[1] + R[8] * md[2])]; }
          const fx = c.mirrored ? -1 : 1, tint = e.color ? [e.color[0], e.color[1], e.color[2], e.color.length > 3 ? e.color[3] : 1] : null, MC = m.colors, MSI = m.skin_indices, MSW = m.skin_weights;
          for (let v = 0; v < nvc; v++) {
            const x = PP[v * 3], y = PP[v * 3 + 1], z = PP[v * 3 + 2], o = (v0 + v) * 3;
            const wx = fx * (O[0] + s * (R[0] * x + R[1] * y + R[2] * z)), wy = O[1] + s * (R[3] * x + R[4] * y + R[5] * z), wz = O[2] + s * (R[6] * x + R[7] * y + R[8] * z);
            P[o] = wx; P[o + 1] = wy; P[o + 2] = wz;
            if (wx < lo[0]) lo[0] = wx; if (wy < lo[1]) lo[1] = wy; if (wz < lo[2]) lo[2] = wz; if (wx > hi[0]) hi[0] = wx; if (wy > hi[1]) hi[1] = wy; if (wz > hi[2]) hi[2] = wz;
            if (NN) { const a = NN[v * 3], b = NN[v * 3 + 1], d = NN[v * 3 + 2]; let nx = fx * (R[0] * a + R[1] * b + R[2] * d), ny = R[3] * a + R[4] * b + R[5] * d, nz = R[6] * a + R[7] * b + R[8] * d; const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; N[o] = nx / l; N[o + 1] = ny / l; N[o + 2] = nz / l; }
            if (CO) { const q = (v0 + v) * 4, ch = MC ? MC.length / nvc : 0; for (let k = 0; k < 4; k++) { const cv = MC ? (k < ch ? MC[v * ch + k] : 1) : 1; CO[q + k] = tint ? cv * tint[k] : cv; } }
            if (skin) {
              let n = 0;
              for (let k = 0; k < 4; k++) {
                const w = MSW ? MSW[v * 4 + k] : 0;
                if (!(w > 0)) continue;
                const b = c.map[MSI[v * 4 + k]];
                if (b < 0) continue;
                let a = -1;
                for (let j = 0; j < n; j++) if (TB[j] === b) { a = j; break; }
                if (a < 0) { a = n++; TB[a] = b; TW[a] = 0; }
                TW[a] += w;
              }
              let sum = 0;
              for (let j = 0; j < n; j++) sum += TW[j];
              const q = (v0 + v) * 4;
              if (n && sum > 0) {
                const ord = []; for (let j = 0; j < n; j++) ord.push(j);
                ord.sort(function (p1, p2) { return TW[p2] - TW[p1]; });
                let kept = 0; for (let k = 0; k < 4 && k < n; k++) if (k === 0 || TW[ord[k]] >= 0.005 * sum) kept += TW[ord[k]];
                for (let k = 0; k < 4; k++) { const j = k < n ? ord[k] : -1, ok = j >= 0 && (k === 0 || TW[j] >= 0.005 * sum); SI[q + k] = ok ? TB[j] : TB[ord[0]]; SW[q + k] = ok ? TW[j] / kept : 0; }
              } else { const hb = sk.index[e.bone]; for (let k = 0; k < 4; k++) { SI[q + k] = hb === undefined ? 0 : hb; SW[q + k] = k === 0 ? 1 : 0; } }
            }
          }
          const MI = m.indices;
          for (let t = 0; t < MI.length; t += 3) { I[t0 + t] = v0 + MI[t]; if (c.mirrored) { I[t0 + t + 1] = v0 + MI[t + 2]; I[t0 + t + 2] = v0 + MI[t + 1]; } else { I[t0 + t + 1] = v0 + MI[t + 1]; I[t0 + t + 2] = v0 + MI[t + 2]; } }
          if (has_parts) {
            const pid = e.id + (c.mirrored ? "#x" : ""), entry = { id: pid, source: e.id };
            if (e.roughness >= 0) entry.roughness = e.roughness;
            if (e.metal >= 0) entry.metal = e.metal;
            let q = parts.findIndex(function (p) { return p.id === pid; });
            if (q < 0) { q = parts.length; parts.push(entry); }
            for (let v = 0; v < nvc; v++) PID[v0 + v] = q;
          }
          if (islands) islands.push({ name: "mesh:" + e.id + (c.mirrored ? "#x" : ""), vertex_start: v0, vertex_count: nvc, index_start: t0, index_count: MI.length, appended: true });
          v0 += nvc; t0 += MI.length;
        });
        const mesh = Object.assign({}, base, { positions: P, normals: N, indices: I });
        if (CO) mesh.colors = CO;
        if (skin) { mesh.skin_indices = SI; mesh.skin_weights = SW; mesh.skin_count = 4; }
        if (UV) mesh.uvs = UV;
        if (has_parts) { mesh.part_ids = PID; mesh.parts = parts; }
        const stats = Object.assign({}, made.stats || {}, { appended: { meshes: list.length, copies: copies.length, vertices: nv - n0, triangles: (ni - i0) / 3, folded: Object.keys(info.folded).length, dropped: Object.keys(info.dropped).length, dropped_names: Object.keys(info.dropped) } });
        return { mesh: mesh, stats: stats, bounds: [lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]], islands: islands };
      }

      // the def the mesher is given: the sdf with the creature's bones (an `sdf.bones` of its own is not used: the skeleton is the creature's), without the parts' material, asking for the part of every vertex; a
      // volume part names its volume by the name the mesher has it under ("<id>#<hash>"), and the declarations stay with system
      function sdf_mesher_def(sdf, sk) {
        const d = Object.assign({}, sdf_shape_def(sdf), { bones: sdf_bones(sk), part_ids: true }), V = sdf.volumes;
        if (V && typeof V === "object") {
          d.parts = d.parts.map(function (p) { return p && p.shape === "volume" && V[p.volume] ? Object.assign({}, p, { volume: volume_key(sdf, p.volume) }) : p; });
          delete d.volumes;
        }
        if (d.meshes !== undefined) delete d.meshes;                                                         // (the pieces appended as their own mesh are system's: sdf_append_meshes)
        return d;
      }
      // the mesher's geometry -> the mesh arrays system takes, the skin indices in the order of the species' bones
      function sdf_from_geometry(geo, who, sk) {
        const tag = "creature '" + who + "': sdf: ";
        if (!geo || !geo.positions || !(geo.positions.length >= 9) || !geo.indices || !(geo.indices.length >= 3) || !geo.normals) fail(tag + "the mesher made no mesh (is the shape empty?)");
        const mesh = { positions: geo.positions, normals: geo.normals, indices: geo.indices };
        if (geo.uvs) mesh.uvs = geo.uvs;
        if (geo.colors) mesh.colors = geo.colors;
        if (geo.bone_indices && geo.bone_weights && Array.isArray(geo.skeleton) && geo.skeleton.length) {
          const map = new Int32Array(geo.skeleton.length);
          geo.skeleton.forEach(function (b, i) {
            const k = sk.index[b.name];
            if (k === undefined) fail(tag + "the mesher's bone '" + b.name + "' is not a bone of the creature");
            map[i] = k;
          });
          const si = new Uint16Array(geo.bone_indices.length);
          for (let i = 0; i < si.length; i++) si[i] = map[geo.bone_indices[i]];
          mesh.skin_indices = si; mesh.skin_weights = geo.bone_weights; mesh.skin_count = 4;
        }
        if (geo.part_ids && geo.part_ids.length === geo.positions.length / 3 && Array.isArray(geo.parts) && geo.parts.length) {      // (the part of every vertex: the parts' material, sp.set_material(<part id>))
          mesh.part_ids = geo.part_ids;
          mesh.parts = geo.parts.map(function (p, i) { const id = p && p.id !== undefined ? String(p.id) : "p" + i; return { id: id, source: p && p.source !== undefined ? String(p.source) : id }; });
        }
        return { mesh: mesh, stats: geo.stats || null, bounds: geo.bounds || null, islands: geo.islands || null };
      }
      // the geometry already made for this def (and these bones): with the def object, or with the same text (of its shape: the parts' material is not in it); null when there is none
      function sdf_lookup(def, bones_key) {
        if (!def || typeof def !== "object") return null;
        const key = sdf_key(def) + bones_key, h = sdf_made.get(def);
        if (h && h.made && h.key === key) return h.made;
        for (let i = 0; i < sdf_texts.length; i++) if (sdf_texts[i].key === key) { const hit = sdf_texts.splice(i, 1)[0]; sdf_texts.unshift(hit); sdf_made.set(def, { made: hit.made, key: key }); return hit.made; }
        return null;
      }
      function sdf_bones_key(sk) { return JSON.stringify([sk.names, Array.from(sk.parent), Array.from(sk.head), Array.from(sk.tail)]); }
      // makes the geometry of the sdfs of x -- a definition { sdf, skeleton, ... }, a creature file, or a list of them -- with the mesher, once for each def -> Promise of x. Nothing is done for what has no sdf, or has it made
      // the entries of x and, after each, one for every skin of it that has an sdf (runtime.js): the skins are built on the same bones, each by the mesher, once
      function sdf_with_skins(items) {
        const out = [];
        items.forEach(function (item) {
          out.push(item);
          let t = item;
          try { t = tissue_pre(item); } catch (e) { return; }                                                // (its own entry tells what is wrong with it)
          if (t && typeof t === "object" && Array.isArray(t.skins)) t.skins.forEach(function (s, i) {
            if (s && typeof s === "object" && s.sdf !== undefined && s.sdf !== null && (s.mesh === undefined || s.mesh === null)) out.push({ name: (t.name || "system") + "#" + (typeof s.name === "string" && s.name ? s.name : i + 1), skeleton: t.skeleton, sdf: s.sdf });
          });
        });
        return out;
      }
      system.build_sdf = function (x) {
        return Promise.all(sdf_with_skins(Array.isArray(x) ? x : [x]).map(function (item) {
          try { item = tissue_pre(item); } catch (e) { return Promise.reject(e); }                        // (the tissue bones it asks for: their parts are meshed with the body, species.js)
          if (!item || typeof item !== "object" || item.sdf === undefined || item.sdf === null) return null;
          const def = item.sdf, who = item.name || "system", tag = "creature '" + who + "': sdf: ";
          return Promise.resolve().then(function () {
            const bad = sdf_def_error(def, who);
            if (bad) fail(bad);
            sdf_part_materials(def, who);                                                                      // (the parts' material is checked before anything is made)
            const vols = sdf_volumes_of(def, who), meshes = sdf_meshes_of(def, who);                           // (and the volumes it declares, the pieces it appends as their own mesh)
            const sk = make_skeleton(item.skeleton), bk = sdf_bones_key(sk);
            const known = sdf_lookup(def, bk);
            if (known) return known;
            const key = sdf_key(def) + bk, pending = sdf_made.get(def);
            if (pending && pending.promise && pending.key === key) return pending.promise;
            const md = JSON.stringify(sdf_mesher_def(def, sk)), epoch = sdf_epoch;
            // a volume that only a mesh of sdf.meshes names is read, never baked
            const baked = function (e) { return !meshes || def.parts.some(function (q) { return q && q.shape === "volume" && q.volume === e.id; }); };
            const p = get_mesher().then(function (m) {
              const ready = vols ? Promise.all(vols.map(function (e) { return volume_bytes(e, who).then(function (u8) { return baked(e) ? volume_in_mesher(m, e, u8, who, def) : u8; }); })) : null;      // (each volume read, checked and given to the mesher once: a piece baked by it)
              return Promise.resolve(ready).then(function () { return m.build(JSON.parse(md)); }).then(null, function (e) { throw new Error(/^system: /.test(String(e && e.message)) ? e.message : "system: " + tag + String(e && e.message !== undefined ? e.message : e).replace(/^happy_mesher: /, "")); });          // (a copy of the def: the mesher takes what it is given)
            }).then(function (geo) {
              let made = sdf_from_geometry(geo, who, sk);
              if (meshes && meshes.length) made = sdf_append_meshes(made, def, meshes, sk, who, function (hash) { const u = vol_bytes.get(hash); if (!u) fail(tag + "the bytes of the piece " + hash + " are gone"); return u; });
              if (epoch === sdf_epoch) {                                                                                       // (another mesher while this was made: its geometry is not the new one's)
                if (sdf_made.get(def) && sdf_made.get(def).promise === p) sdf_made.set(def, { made: made, key: key });         // (and a def that was changed in place meanwhile has another entry now)
                sdf_texts.unshift({ key: key, made: made });
                if (sdf_texts.length > SDF_TEXTS) sdf_texts.pop();
              }
              return made;
            }).catch(function (e) { if (sdf_made.get(def) && sdf_made.get(def).promise === p) sdf_made.delete(def); throw e; });
            sdf_made.set(def, { promise: p, key: key });
            return p;
          });
        })).then(function () {
          const list = Array.isArray(x) ? x : [x];                                                      // (the maps a creature file keeps encoded -- a JPEG, deflated planes -- are decoded now, once: runtime.js)
          return Promise.all(list.map(function (item) { const m = item && typeof item === "object" && item.material && item.material.maps; return m && (happy_maps.encoded(m.color) || happy_maps.encoded(m.pack) || happy_maps.encoded(m.normal)) ? system.maps.decode(m) : null; }));
        }).then(function () { return x; });
      };
      // whether the geometry of the sdf of x is made: true for what has no sdf. A page that makes the meshes when they are first needed asks this
      system.sdf_made = function (x) {
        try { x = tissue_pre(x); } catch (e) { return false; }                                           // (a request for tissue bones that cannot be made: nothing is made)
        if (!x || typeof x !== "object") return true;
        const own = x.sdf !== undefined && x.sdf !== null, skins = Array.isArray(x.skins) ? x.skins.filter(function (s) { return s && s.sdf !== undefined && s.sdf !== null; }) : [];          // (the skins that are made of an sdf: runtime.js)
        if (!own && !skins.length) return true;
        const bk = sdf_bones_key(make_skeleton(x.skeleton));
        return (!own || !!sdf_lookup(x.sdf, bk)) && skins.every(function (s) { return !!sdf_lookup(s.sdf, bk); });
      };
      // the geometry build_sdf made for the sdf of x -- { mesh: the arrays system takes (the skin indices in the order of the species' bones), stats: the mesher's numbers, bounds, islands: what each island has of the vertices } -- or null (no sdf, or not made yet): for what
      // measures, exports or picks (the arrays are the species' own: read them, do not change them)
      system.sdf_mesh = function (x) {
        try { x = tissue_pre(x); } catch (e) { return null; }
        if (!x || typeof x !== "object" || x.sdf === undefined || x.sdf === null) return null;
        return tissue_skin_made(x, sdf_lookup(x.sdf, sdf_bones_key(make_skeleton(x.skeleton))));          // (a tissue's carved skin over the mesher's: species.js)
      };
      // an input -> the mesh it is drawn with: its own `mesh` (plain arrays), or the one its sdf made (build_sdf first), or null (a creature with no geometry: the rig lab's, a test's)
      function resolve_mesh(input, sk) {
        const has_sdf = input.sdf !== undefined && input.sdf !== null;
        if (input.mesh !== undefined && input.mesh !== null) return { mesh: input.mesh, notes: has_sdf ? ["creature '" + (input.name || "system") + "': the mesh that it has is used, not its sdf"] : [] };
        if (!has_sdf) return null;
        const bad = sdf_def_error(input.sdf, input.name || "system");
        if (bad) fail(bad);
        const who = input.name || "system", mats = sdf_part_materials(input.sdf, who);
        const made = tissue_skin_made(input, sdf_lookup(input.sdf, sdf_bones_key(sk)));                    // (the tissue bones it asked for: the mesher's mesh with its skin carved, species.js)
        if (!made) fail("creature '" + who + "': its sdf has not been made: system.build_sdf(input) makes it with the mesher, asynchronously, before the species");
        if (!mats) return { mesh: made.mesh, notes: [], made: made };
        if (!made.mesh.parts) return { mesh: made.mesh, notes: ["creature '" + who + "': sdf: the mesher gave no part ids: the parts' roughness and metal are not used"], made: made };
        // the parts' material of THIS def on the geometry (a copy of its list of parts: the geometry is shared by the defs of the same shape)
        const mesh = Object.assign({}, made.mesh, { parts: made.mesh.parts.map(function (p) { const v = mats[p.source]; return v ? { id: p.id, source: p.source, roughness: v.roughness, metal: v.metal } : p; }) });
        return { mesh: mesh, notes: [], made: made };
      }

      // ========================================================================================================================
      // tissue
      // ========================================================================================================================
// system.js, a part: TISSUE BONES (pure.js and kinds.js; SYSTEM.md "Tissue bones"): a definition's request `tissue: [...]` made into the bones, the carved skin of a mesh or the parts of an sdf, BEFORE the
// definition is compiled and before its sdf is meshed.
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js (after integral: the mesher's own field is what an sdf's surface is read from).
      // ---- tissue bones ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
      // The two modules are written as packing modules (node's tools and tests load them as they are: tools/tissue_tool.js); here `packing` hands their values back. A definition with `tissue` is EXPANDED once (the
      // result is kept with the definition object, a WeakMap, as long as the request, the skeleton, the roles, the legs, the rig and the body are the same): system.compile, system.species, system.build_sdf, system.sdf_made and
      // system.sdf_mesh all take the expanded one, so an sdf creature's parts are meshed once and its species finds them. A definition without `tissue` costs nothing here.
      const happy_tissue = (function () { const lib = pure.happy_tissue(); lib.use_kinds(pure.happy_tissue_kinds()).use_mesher(happy_mesher); return lib; })();
      const tissue_made = new WeakMap(), tissue_skin = new WeakMap(), tissue_carved = new WeakMap();
      function tissue_key(input) {
        const S = input.system && typeof input.system === "object" ? input.system : {};
        return JSON.stringify([input.tissue, input.skeleton, input.roles !== undefined ? input.roles : S.roles, input.legs !== undefined ? input.legs : S.legs, input.rig !== undefined ? input.rig : S.rig, input.sdf || null]);
      }
      // the definition as system takes it: the expanded one for a definition that asks for tissue bones, the same object otherwise
      function tissue_pre(input) {
        if (!input || typeof input !== "object" || input.tissue === undefined || input.tissue === null) return input;
        const key = tissue_key(input), hit = tissue_made.get(input);
        if (hit && hit.key === key && hit.mesh === input.mesh) return hit.def;
        const r = happy_tissue.expand(input, input.tissue, {});
        if (r.warnings.length && typeof console !== "undefined") r.warnings.forEach(function (m) { console.warn("system: " + (input.name ? "creature '" + input.name + "': " : "") + m); });
        tissue_made.set(input, { key: key, mesh: input.mesh, def: r.def, result: r });
        if (r.skin) tissue_skin.set(r.def, r.skin);
        return r.def;
      }
      // TEXTURE (maps.js `paint`, SYSTEM.md "Texture on an sdf creature"): a definition's `texture` is a RECIPE (size, seed, layers: stripes, spots, cells, gradient, noise), baked when the species is made: the mesh the creature is drawn
      // with (its own, or the one its sdf made, the tissue's carve included) is unwrapped and painted into a colour map and a packed map, and the definition the species is made of is the same creature with that mesh (new uvs, white
      // vertices) and `material.maps`. The recipe is the file's, the pictures are not: they are made again, the same bytes, in 0.1 to 0.4 s, and kept for the next species of the same shape and recipe. The sdf of a creature that asks
      // for a texture must be made first (system.build_sdf), as for any species.
      const texture_done = new WeakMap(), texture_info = new WeakMap(), texture_texts = [];
      function texture_pre(input) {
        if (!input || typeof input !== "object" || input.texture === undefined || input.texture === null) return input;
        const hit = texture_done.get(input);
        if (hit && hit.tex === JSON.stringify(input.texture) && hit.mesh === input.mesh) return hit.out;
        const who = typeof input.name === "string" ? input.name : "system", sk = make_skeleton(input.skeleton), has_sdf = input.sdf !== undefined && input.sdf !== null && (input.mesh === undefined || input.mesh === null);
        const tex = JSON.stringify(input.texture), key = has_sdf ? tex + "|" + sdf_key(input.sdf) + sdf_bones_key(sk) + "|" + JSON.stringify(input.tissue === undefined ? null : input.tissue) : null;
        let made = null;
        if (key) for (let i = 0; i < texture_texts.length; i++) if (texture_texts[i].key === key) { made = texture_texts.splice(i, 1)[0].made; texture_texts.unshift({ key: key, made: made }); break; }
        if (!made) {
          const geo = resolve_mesh(input, sk);
          if (!geo) fail("creature '" + who + "': a texture needs a mesh or an sdf to paint");
          try { made = happy_maps.paint(geo.mesh, input.texture); } catch (e) { fail("creature '" + who + "': " + String(e && e.message).replace(/^system maps: /, "")); }
          if (key) { texture_texts.unshift({ key: key, made: made }); if (texture_texts.length > 8) texture_texts.pop(); }
        }
        const out = Object.assign({}, input, { mesh: made.mesh, material: Object.assign({}, input.material, { maps: Object.assign({}, input.material && input.material.maps, made.maps) }) });
        delete out.texture; delete out.sdf;
        texture_done.set(input, { tex: tex, mesh: input.mesh, out: out }); texture_info.set(out, made.report);
        if (made.report.notes && made.report.notes.length && typeof console !== "undefined") made.report.notes.forEach(function (n) { console.warn("system: creature '" + who + "': " + n); });
        return out;
      }
      // the report of the last bake of a definition's texture (or null): { unwrap, bake: { size, covered, texels, rays, ao_mean, ms }, notes, layers }
      system.texture_report = function (def) { const o = def && typeof def === "object" ? texture_done.get(def) : null; return o ? texture_info.get(o.out) : (def && texture_info.get(def)) || null; };
      // the geometry an sdf made, for the (expanded) definition it is drawn for: the mesher's own when the definition carves no tissue, else a copy whose skin is carved by the tissue's regions (the positions, the normals,
      // the part ids are the mesher's arrays: the shape is the creature's own). Kept with the geometry (a WeakMap): a species made again of the same definition carves nothing again
      function tissue_skin_made(input, made) {
        const skin = made && input && typeof input === "object" ? tissue_skin.get(input) : null;
        if (!skin) return made;
        const hit = tissue_carved.get(made);
        if (hit && hit.skin === skin) return hit.made;
        const out = Object.assign({}, made, { mesh: happy_tissue.carve_mesh(made.mesh, skin).mesh });
        tissue_carved.set(made, { skin: skin, made: out });
        return out;
      }
      // the tools' and the pages' own: the same functions (the mesher given), and what a definition's request made (null: it asks for none, or it was not expanded yet)
      system.tissue = {
        expand: function (def, spec, options) { return happy_tissue.expand(def, spec, options); },
        placement: function (def, kind, options) { return happy_tissue.placement(def, kind, options); },
        describe: function (kind) { return happy_tissue.describe(kind); },
        kinds: function () { return happy_tissue.kinds(); },
        check: function (def, options) { return happy_tissue.check(def, options); },
        made: function (input) { const h = input && typeof input === "object" ? tissue_made.get(input) : null; return h ? h.result : null; },
        module: happy_tissue,
      };

      // ========================================================================================================================
      // species
      // ========================================================================================================================
// system.js, a part: init, the species and its instances (the page's calls on them).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js.
      // ---- init ------------------------------------------------------------------------------------------------------------------------------------
      let initialized = false;
      const species_map = new Map();                    // worker-side js id -> species
      const list = [];
      system.species_map = species_map; system.list = list;
      system.init = function (o) {
        if (initialized) return;
        o = o || {};
        initialized = true;
        opts.command_budget = o.command_budget || opts.command_budget;
        const resp_limit = o.resp_limit || (PAYLOAD_SIZE - 4096);
        q_begin(11); q_u(CMD_HAPPY_INIT);
        q_u(o.max_species || 64); q_u(o.table_bytes || (16 << 20)); q_u(o.dirty_budget || 24000); q_u(o.staging_words || 16384); q_u(resp_limit);
        q_f(o.near_radius || 40); q_u(o.max_near || 0); q_u(o.lod_near || 1); q_u(o.lod_far || 4); q_f(o.tier_interval || 0.25);
      };
      system.tiers = function (o) {
        q_begin(6); q_u(CMD_HAPPY_TIERS); q_f(o.near_radius || 40); q_u(o.max_near || 0); q_u(o.lod_near || 1); q_u(o.lod_far || 4); q_f(o.tier_interval || 0.25);
      };
      system.reset = function () { q_begin(1); q_u(CMD_HAPPY_RESET); species_map.forEach(function (sp) { sp.reset_local(); }); };
      // What the worker DRAWS of the instances (debug lines and points, every frame, through the engine's debug draw): system.debug({ bones: true, limits: true }) for all of them, system.debug({ rig: true }, sp) for the instances
      // of a species, system.debug({ ... }, sp, c) for one instance; system.debug(null) draws nothing. A number is a mask of system.DEBUG's bits. Returns the mask.
      system.DEBUG = { bones: 1, axes: 2, rig: 4, limits: 8, root: 16, legs: 32, shapes: 64, life: 128, hit: 256 };          // (life: where a creature looks, its soft tissue's masses: body.cpp)
      // (the engine draws the list of debug calls that the worker sent LAST, every frame, until the worker sends another: a worker that has nothing more to draw sends nothing. So when the mask is 0 the page wipes the
      // list itself, for the few frames that the worker needs to take the command and its last list to arrive. The worker has ONE debug state, the last command's (body.cpp: dbg_mask, dbg_js, dbg_slot): a mask of 0
      // for one species or instance draws nothing at all, of any, and the wipe is right for it)
      let debug_clear = 0;
      system.debug = function (what, sp, c) {
        let mask = 0;
        if (typeof what === "number") mask = what >>> 0;
        else if (what !== null && what !== undefined) {
          if (typeof what !== "object" || Array.isArray(what)) throw new Error("system: debug needs an object of flags, a mask or null");
          for (const k in what) { if (system.DEBUG[k] === undefined) throw new Error("system: debug: unknown key '" + k + "'"); if (what[k]) mask |= system.DEBUG[k]; }
        }
        if ((mask & ~511) !== 0) throw new Error("system: debug: unknown bits in the mask");
        if (c && (!sp || c.species !== sp)) throw new Error("system: debug: the instance is not of that species");
        if (c && c.slot < 0) { c = null; mask = 0; }                                                 // (a released instance: nothing to draw)
        q_begin(4); q_u(CMD_HAPPY_DEBUG); q_u(mask); q_u(sp ? sp.js_id : 0); q_u(c ? c.slot : 0xffffffff);
        debug_clear = mask === 0 ? 12 : 0;
        return mask;
      };

      // ---- how hard the rig works --------------------------------------------------------------------------------------------------------------------------
      // The two tiers (system.tiers: the nearest instances are NEAR and update every frame, the rest are FAR and update every few: lod_far) have a solve of their own. A unit is solved by the cheapest means that is right
      // (an answer that is still good is kept, the last answer is the start of a target that moved a little, FABRIK from the animation is the last resort: SYSTEM.md, body.cpp); what is left to say is how long each
      // means may go on:  iterations (FABRIK), tries (starts when it misses: 1 .. 3), refine (steps of the joint-space refinement that makes the answer exact), and the BUDGET: the most work (in the units that
      // system.rig_work reports: about one bone of forward kinematics) the rig may spend in a frame, 0: no limit. A solve that does not fit is put off a frame, in turn (nobody starves, nobody is torn).
      //   system.rig_settings({ near: { iterations: 4, tries: 2, refine: 8 }, far: { iterations: 3, tries: 1, refine: 2 }, budget: 0 })     every field is optional: what is left out keeps its value
      system.rig = { near: { iterations: 4, tries: 2, refine: 8 }, far: { iterations: 3, tries: 1, refine: 2 }, budget: 0 };
      system.rig_settings = function (o) {
        o = o || {};
        const v = JSON.parse(JSON.stringify(system.rig));
        ["near", "far"].forEach(function (tier) {
          if (o[tier] === undefined) return;
          if (!o[tier] || typeof o[tier] !== "object") throw new Error("system: rig_settings: " + tier + " must be { iterations, tries, refine }");
          for (const k in o[tier]) { if (v[tier][k] === undefined) throw new Error("system: rig_settings: " + tier + ": unknown key '" + k + "' (iterations, tries, refine)"); v[tier][k] = o[tier][k]; }
        });
        for (const k in o) if (k !== "near" && k !== "far" && k !== "budget") throw new Error("system: rig_settings: unknown key '" + k + "' (near, far, budget)");
        if (o.budget !== undefined) v.budget = o.budget;
        const whole = function (x, what, lo, hi) { if (!Number.isInteger(x) || x < lo || x > hi) throw new Error("system: rig_settings: " + what + " must be a whole number from " + lo + " to " + hi + " (" + x + ")"); return x; };
        ["near", "far"].forEach(function (tier) { whole(v[tier].iterations, tier + ".iterations", 1, 64); whole(v[tier].tries, tier + ".tries", 1, 3); whole(v[tier].refine, tier + ".refine", 0, 64); });
        whole(v.budget, "budget", 0, 1000000000);
        if (!initialized) system.init({});
        q_begin(8); q_u(CMD_HAPPY_RIG); q_u(v.near.iterations); q_u(v.near.tries); q_u(v.near.refine); q_u(v.far.iterations); q_u(v.far.tries); q_u(v.far.refine); q_u(v.budget);
        system.rig = v;
        return v;
      };

      // ---- the species ------------------------------------------------------------------------------------------------------------------------------
      function Species() { }
      const SP = Species.prototype;
      const TIERS = { far: 0, near: 1, auto: 255 };

      function send_blob(js, words) {
        const total = words.length, CH = 1000;
        for (let off = 0; off < total; off += CH) {
          const cnt = Math.min(CH, total - off);
          q_begin(5 + cnt); q_u(CMD_HAPPY_BLOB); q_u(js); q_u(total); q_u(off); q_u(cnt);
          for (let k = 0; k < cnt; k++) q_u(words[off + k]);
        }
      }

      // a species from a definition { name, skeleton, rig, max_instances }: compiled here (every mistake is thrown, naming the bone or the chain), sent to the worker as a blob, built there at once
      system.species = function (input, opts) {
        if (!initialized) system.init({});
        input = tissue_pre(input);                                                                      // (the tissue bones it asks for: the bones, the carved skin or the sdf's parts, species.js)
        input = texture_pre(input);                                                                     // (its texture recipe, baked: the mesh with new uvs and the maps of its material, species.js)
        const tex_report = texture_info.get(input) || null;
        const max = input && input.max_instances !== undefined ? input.max_instances : 16;
        const holder = opts && opts.holder ? opts.holder : null;                                   // (holder: the species whose bones a PROP rides on: runtime.js)
        const stat = !!(opts && opts.static) && !holder;                                                   // (static: a STATIC MESH, drawn instanced like a species but not a family of the worker: nothing in the worker moves it, the page writes its rows. A chair, a rock, a wall piece, a door's leaf: world items)
        const comp = compile(input, max), ro = !!(opts && opts.render_only) || !!holder || stat;           // (render_only: a DRAWABLE of a family -- a prop of a creature: its mesh round one imaginary bone -- that the family draws in its own render loop with the family's own rows: not a species, nothing is sent to the worker for it, no list holds it, no texture of its own)
        const geometry = resolve_mesh(input, comp.sk); if (geometry) ragdoll_with_skin(comp, input, geometry.mesh), hit_with_skin(comp, input, geometry.mesh);                                                 // (its own mesh, or the one its sdf made: system.build_sdf first)
        const packed = geometry ? pack_mesh(geometry.mesh, comp.sk) : null;                             // (checked now: a bad mesh throws before anything is sent to the worker)
        if (packed && comp.variants) make_variant_channel(comp.variants, packed, typeof input.name === "string" ? input.name : "species");          // (and so is a variant that its mesh cannot have: a dye with no vertex, an optional piece that is welded to the body)
        if (geometry) couplers_of_mesh(comp.couplers, input.couplers !== undefined ? input.couplers : (input.system && input.system.couplers), geometry.mesh.positions);          // (the ends of its mesh: the hitch's front and rear, unless the definition names them)
        if (geometry && !holder) texture_fits(typeof input.name === "string" ? input.name : "species", max, comp.sk.n);
        const skin_geo = skins_resolve(input, comp, ro);                                                  // (the meshes of its skins, made and checked now: a skin whose sdf is not made throws before anything is sent to the worker: runtime.js)
        const skinning = input.skinning === undefined || input.skinning === null ? "dual_quaternion" : input.skinning;
        if (SKINNING_MODES.indexOf(skinning) < 0) throw new Error("system: skinning must be one of " + SKINNING_MODES.join(", ") + " (" + input.skinning + ")");
        const sp = new Species();
        sp.name = typeof input.name === "string" ? input.name : "species"; sp.texture = tex_report;
        sp.sk = comp.sk; sp.rig = comp.rig; sp.words = comp.words; sp.legs = comp.legs; sp.body = comp.body; sp.life = comp.life; sp.flight = comp.flight; sp.wings = comp.wings; sp.physics = comp.physics; sp.vehicle = comp.vehicle; sp.wheels = comp.wheels; sp.couplers = comp.couplers; sp.seat_defs = compile_seats(input.seats, input.doors, comp.sk); sp.aircraft = comp.aircraft; sp.rotors = comp.rotors; sp.input = input;                 // (the definition: sp.set_style compiles its legs again)
        sp.notes = (comp.legs ? comp.legs.notes.slice() : []).concat(comp.life ? comp.life.warnings.map(function (w) { return "system: roles: " + w; }) : []).concat(comp.aircraft ? comp.aircraft.notes : []);       // (what the creature should be told: a style's feet that a leg has no foot of its own for, what its roles lack)
        if (sp.notes.length && typeof console !== "undefined") sp.notes.forEach(function (n) { console.warn(n); });
        sp.bone_names = comp.sk.names; sp.bone_count = comp.sk.n; sp.max_instances = max;
        sp.fprops = fp_setup(sp, comp.family_props, max);                                                  // (its props: a species of each, made first: a prop whose sdf is not made throws before this species is registered: runtime.js)
        sp.fx = fx_setup(sp, comp.particles, max);                                                         // (the particles it asks for: runtime.js)
        sp.has_hit = !!comp.hit; sp.hit = comp.hit || null;                                                                         // (the hit zones: body.js)
        sp.has_ragdoll = !!comp.ragdoll;                                                                   // (a person has the section: body.js)
        sp.chain_names = comp.rig ? comp.rig.chains.map(function (c) { return c.name; }) : [];
        sp.chain_index = Object.create(null); sp.chain_names.forEach(function (n, i) { sp.chain_index[n] = i; });
        sp.js_id = engine.guid();
        sp.alive = new Uint8Array(max); sp.gen = new Uint16Array(max); sp.live = 0; sp.hw = 0;
        sp.variants = comp.variants;                                                 // (what can differ between the instances: the dyes, the pieces and the list of looks: runtime.js; null: nothing)
        sp.look_of = sp.variants || comp.skins ? new Uint16Array(max) : null; sp.look_els = sp.variants ? variant_make_table(sp.variants) : null;          // (the look every instance wears, its number in the table of looks (0: the file's own); the table, a vec4 an element, that the material holds)
        sp.listed = !ro && (culling_active() || !!sp.variants || !!comp.skins); sp.draw_list = null; sp.draw_pos = null; sp.draw_n = 0; sp.dirty_list = false; if (sp.listed) list_init(sp);          // (drawn from a list of its instances: while culling is on, and always for a species that has variants, whose look is an attribute of the draw: runtime.js)
        sp.prop_defs = comp.props || null; sp.bound_def = comp.bound; sp.bound = null;                                    // (the sphere that culling tests its instances by: the definition's, else the mesh's: runtime.js)
        sp.root_rows = holder ? 0 : Math.ceil(max * 2 / W); sp.pose_rows = holder ? 0 : Math.ceil(max * sp.bone_count * 2 / W); sp.rows = sp.root_rows + sp.pose_rows;
        sp.vx = null; sp.mat_variant = "";
        sp.mirror = new Float32Array(W * sp.rows * 4);                               // the rows as a species' texture will hold them: the instances' roots, then their bones' skinning transforms (a prop has none: it reads its holder's)
        sp.holder = holder; sp.pn = 0; sp.hold_dirty = false; sp.hold_lo = 1 << 30; sp.hold_hi = -1;
        if (holder) { sp.hold = new Float32Array(max * 4); sp.at = new Float32Array(max * 3); sp.rot = new Float32Array(max * 4); sp.hold_pos = new Int32Array(max).fill(-1); sp.hold_slot = new Int32Array(max); }          // (the instances of a prop, compact: attributes of its draw, runtime.js; the slot of the pool each is, and where each slot is)
        sp.built = ro; sp.render_only = ro; sp.static = stat; sp.error = 0; sp.rejected = 0; sp.table_bytes = 0;
        sp.material = input.material || null; sp.skinning = skinning; sp.geo = null; sp.tex = null; sp.mat = null; sp.dirty_root = false; sp.dirty_pose = false; sp.uploads = 0; sp.disposed = false; sp.visible = true; sp.wire = false;
        sp.mat_spec = comp.material || null; sp.mesh_src = null; sp.matx = null; sp.mat_live = null; sp.mat_channel = false; sp.sky_live = null; sp.mat_sky = false;          // (the material by part: the bones' values and the eyes (compile_material), the mesh it is made from, its index and channel, what the page set, the sky of its glossy parts: draw.js)
        sp.mesh_stats = geometry && geometry.made ? geometry.made.stats : null;
        if (geometry) geometry.notes.forEach(function (n) { sp.notes.push(n); if (typeof console !== "undefined") console.warn(n); });
        if (!ro) { species_map.set(sp.js_id, sp); list.push(sp); send_blob(sp.js_id, comp.words); }
        else if (stat) list.push(sp);                                                                      // (drawn by system.render_all like any species; the worker never hears of it: no blob, no family, no frame record)
        if (geometry) sp.set_mesh(geometry.mesh);
        else if (sp.bound_def) send_bound(sp, null);                                    // (a species with no mesh that says its sphere)

        if (comp.skins) skins_attach(sp, comp, skin_geo, input);                                           // (its other skins, each drawn with this body's rows: runtime.js)
        sp.worker_cfg = opts && opts.cfg !== undefined ? opts.cfg : null;                                                                   // (data for the creature's function: api.cfg, runtime.js)
        sp.mind_on = !(opts && opts.mind === false); sp.has_worker = input.worker !== undefined && !!engine._worker;                      // (opts.mind: false makes the family without its own function deciding: sp.mind)
        if (input.worker !== undefined && engine._worker) sp.worker_setup(input.worker);                  // (the creature's function for the worker: runtime.js)
        return sp;
      };

      // The ORBIT: a driver IN THE WORKER. Every chain of every instance of the species is asked, every frame, for a place that circles about a point a tenth nearer the chain's root than its end stands at rest,
      // `amplitude` reaches wide (0 .. 1; 0 stops it and lets the chains go), `rate` radians a second. It is what a gait will do from inside the worker (the page can send a few hundred commands a frame; the worker can
      // drive thousands of creatures), and what the lab's wiggle and the scale tests are made of.
      SP.orbit = function (amplitude, rate) {
        if (typeof amplitude !== "number" || !(amplitude >= 0 && amplitude <= 1)) throw new Error("system: orbit: the amplitude is a number from 0 to 1 (in reaches: " + amplitude + ")");
        if (rate === undefined) rate = 2;
        fin(rate, "rate");
        if (!this.rig) throw new Error("system: orbit: species '" + this.name + "' has no rig");
        q_begin(4); q_u(CMD_HAPPY_ORBIT); q_u(this.js_id); q_f(amplitude); q_f(rate);
      };
      // ---- the mover and the gait (body.cpp, body.cpp) -----------------------------------------------------------------------------------------
      // Where an instance WANTS to go: a world velocity (vx, vz: model units a second, times the instance's scale) and which way it wants to face (fx, fz: a world direction; 0, 0: it faces the way it goes and TURNS TO GO; "hold" in place of fx: it keeps its heading and walks backward or sideways). Said once, and
      // again only when it changes. The mover accelerates to the wish, turns the body (the legs say how fast: a creature turns by stepping) and keeps it on the ground; the legs step as much as the body really moves.
      function need(sp, what, part) { if (!sp[part]) throw new Error("system: " + what + ": species '" + sp.name + "' has no " + part + " (the definition's `" + part + "`)"); }
      // The facing may be "hold" (`sp.set_intent(c, vx, vz, "hold")`): the instance keeps the heading it has when the hold begins and does not turn to go, so a wish that points behind it or to its side is walked BACKWARD or SIDEWAYS
      // (the gait steps in the direction of the body's own motion). It is a facing wish like any other (the heading it keeps is the one it had, held until a facing or a wish with no facing is said);
      // a TURN is asked for by a facing wish of its own (`sp.heading(c)` plus a share of a turn). `sp.heading(c)`: where the instance faces now, in radians, 0 = +z, toward +x positive (the page's copy of the root: a frame behind the worker).
      SP.heading = function (c) {
        live_instance(this, c, "heading");
        const m = this.mirror, o = c.slot * 8, x = m[o + 4], y = m[o + 5], z = m[o + 6], w = m[o + 7];
        return Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y));                                 // (the forward vector (0, 0, 1) turned by the root's quaternion: x', z')
      };
      SP.set_intent = function (c, vx, vz, fx, fz) {
        live_instance(this, c, "set_intent"); need(this, "set_intent", "body");
        vx = fin(vx, "vx"); vz = fin(vz, "vz");
        if (fx === "hold") { if (!c.hold) { const h = this.heading(c); c.hold = [Math.sin(h), Math.cos(h)]; } fx = c.hold[0]; fz = c.hold[1]; }      // (the heading it had when the hold began, until another facing is said)
        else { c.hold = null; fx = fx === undefined ? 0 : fin(fx, "fx"); fz = fz === undefined ? 0 : fin(fz, "fz"); }
        const l = c.intent;
        if (l[0] === vx && l[1] === vz && l[2] === fx && l[3] === fz) return;
        c.intent = [vx, vz, fx, fz];
        q_begin(8); q_u(CMD_HAPPY_INTENT); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_f(vx); q_f(vz); q_f(fx); q_f(fz);
      };
      // A LAUNCH: the vertical velocity of an instance is set (world units a second, up is positive); `{ air: true }` lets it jump again in the air (a double jump). The body needs a gravity and the ground (the definition's `body: { gravity }`)
      SP.jump = function (c, vy, o) {
        live_instance(this, c, "jump"); need(this, "jump", "body");
        if (!(this.body.gravity > 0)) throw new Error("system: jump: species '" + this.name + "' has no gravity (body: { gravity: 9.8 }): nothing would bring it down");
        fin(vy, "vy");
        q_begin(6); q_u(CMD_HAPPY_JUMP); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_f(vy); q_u(o && o.air ? 1 : 0);
      };
      // A SHOVE: the velocity of an instance changes by (vx, vz) at once, and by vy while it is in the air; the mover brings it back to its wish at its acceleration
      SP.push = function (c, vx, vz, vy) {
        live_instance(this, c, "push"); need(this, "push", "body");
        fin(vx, "vx"); fin(vz, "vz"); if (vy !== undefined) fin(vy, "vy");                                  // (checked before the command is begun: a throw in the middle of one would leave half a command in the queue)
        q_begin(7); q_u(CMD_HAPPY_PUSH); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_f(vx); q_f(vz); q_f(vy === undefined ? 0 : vy);
      };
      // The numbers of a gait of the species, for every instance of it: sp.set_gait({ stride: 0.3, swing: 0.45 }, which) in model units, `which` the gait of sp.legs.gaits (default 0)
      SP.set_gait = function (values, which) {
        need(this, "set_gait", "legs");
        which = which === undefined ? 0 : which;
        if (!Number.isInteger(which) || which < 0 || which >= this.legs.gaits.length) throw new Error("system: set_gait: this species has " + this.legs.gaits.length + " gait(s) (0 .. " + (this.legs.gaits.length - 1) + ")");
        if (!values || typeof values !== "object") throw new Error("system: set_gait needs an object of gait numbers (" + GAIT_FIELDS.join(", ") + ")");
        const keys = Object.keys(values);
        keys.forEach(function (k) { if (GAIT_FIELDS.indexOf(k) < 0) throw new Error("system: set_gait: unknown gait field '" + k + "' (" + GAIT_FIELDS.join(", ") + ")"); if (!gait_ok(k, values[k])) throw new Error("system: set_gait: " + k + " = " + values[k] + " is out of range"); });
        const sp = this;
        keys.forEach(function (k) { sp.legs.gaits[which].numbers[k] = values[k]; q_begin(5); q_u(CMD_HAPPY_GAIT); q_u(sp.js_id); q_u(which); q_u(GAIT_FIELDS.indexOf(k)); q_f(values[k]); });
      };
      // An instance mixes two of the species' gaits (a walk and a run) by their weights; it starts on the first alone
      SP.set_gait_blend = function (c, gait_a, weight_a, gait_b, weight_b) {
        live_instance(this, c, "set_gait_blend"); need(this, "set_gait_blend", "legs");
        const n = this.legs.gaits.length;
        if (!Number.isInteger(gait_a) || !Number.isInteger(gait_b) || gait_a < 0 || gait_b < 0 || gait_a >= n || gait_b >= n) throw new Error("system: set_gait_blend: this species has " + n + " gait" + (n === 1 ? "" : "s") + " (0 .. " + (n - 1) + ")");
        if (!Number.isFinite(weight_a) || !Number.isFinite(weight_b) || weight_a < 0 || weight_b < 0) throw new Error("system: set_gait_blend: the weights are numbers, 0 or more");
        const sum = weight_a + weight_b, t = sum > 0 ? weight_b / sum : 0, b = c.gait_blend;
        if (b && b[0] === gait_a && b[1] === gait_b && b[2] === t) return;
        c.gait_blend = [gait_a, gait_b, t];
        q_begin(7); q_u(CMD_HAPPY_GAIT_BLEND); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(gait_a); q_u(gait_b); q_f(t);
      };
      SP.set_gait_mix = function (c, w) { return this.set_gait_blend(c, 0, 1 - w, 1, w); };
      // Walking in place: the ground scrolls under the feet of an instance at (vx, vz), a world velocity, while its body stays. The gait takes it as the body's own and a planted foot slides back under the body at it
      SP.set_treadmill = function (c, vx, vz) {
        live_instance(this, c, "set_treadmill"); need(this, "set_treadmill", "legs");
        fin(vx, "vx"); fin(vz, "vz");
        if (Math.abs(vx) > 1e4 || Math.abs(vz) > 1e4) throw new Error("system: set_treadmill: a velocity of at most 10000 world units a second");
        q_begin(6); q_u(CMD_HAPPY_TREAD); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_f(vx); q_f(vz);
      };
      // ---- the roles and their layers (body.cpp, body.js) ---------------------------------------------------------------------------------------------
      //   sp.set_trait(name, value)                a trait of the species, for every instance (system.TRAITS: breath, breath_rate, idle, gait, stabilise, seed, arms, arm_swing)
      //   sp.life_on(c, on)                        an instance's life on (the default) or off (it fades out: the overlay goes to nothing and the arms let go)
      //   sp.role_pose(c, role, { yaw, pitch, roll, x, y, z })     the page's own layer on a role bone, added to what the layers say (radians, model units; the layers' signs: yaw to the left, pitch FORWARD (the
      //                                            nose down) is positive, roll to the right): `role` is a bone that has a role (a name or a number) or "hips", "chest", "head"; no numbers: let it go
      //   system.life_settings({ visible_px, px_k }) the visible-change gate (pixels: 0 shows every change; 0.5 at first) and the pixels that a creature of height 1 at distance 1 shows as (600 at first); what is not said stays
      //                                            system.life_off(on)  every life eases back to the plain pose
      function life_cmd(sp, c, op, k, v) {
        q_begin(12); q_u(CMD_HAPPY_LIFE); q_u(sp ? sp.js_id : 0); q_u(c ? c.slot : 0); q_u(c ? c.gen : 0); q_u(op); q_u(k);
        for (let i = 0; i < 6; i++) q_f(v && v[i] !== undefined ? v[i] : 0);
      }
      function need_life(sp, what) { if (!sp.life || !sp.life.words) throw new Error("system: " + what + ": species '" + sp.name + "' has no roles (the definition's `roles`: a bone for at least one of them)"); }
      SP.set_trait = function (name, value) {
        need_life(this, "set_trait");
        const i = TRAIT_INDEX[name];
        if (i === undefined) throw new Error("system: set_trait: unknown trait '" + name + "' (" + TRAITS.map(function (t) { return t[0]; }).join(", ") + ")");
        const t = TRAITS[i];
        if (typeof value !== "number" || !Number.isFinite(value) || value < t[3] || value > t[4]) throw new Error("system: set_trait: " + name + " = " + value + " is out of range (" + t[3] + " .. " + t[4] + ")");
        this.life.traits[i] = value * t[2];
        life_cmd(this, null, 2, i, [value * t[2]]);
      };
      SP.life_on = function (c, on) {
        live_instance(this, c, "life_on"); need_life(this, "life_on");
        life_cmd(this, c, 0, 0, [on === false ? 0 : 1]);
      };
      SP.role_pose = function (c, role, o) {
        live_instance(this, c, "role_pose"); need_life(this, "role_pose");
        const life = this.life, sk = this.sk;
        let k = -1;
        if (role === "hips" || role === "chest" || role === "head") k = life.roles[role];
        else { const b = typeof role === "number" ? role : sk.index[role]; if (b !== undefined && b >= 0 && b < sk.n) k = life.slot_of[sk.names[b]] === undefined ? -1 : life.slot_of[sk.names[b]]; }
        if (k === undefined || k < 0) throw new Error("system: role_pose: '" + role + "' is not a role bone of species '" + this.name + "' (its role bones: " + Object.keys(life.slot_of).join(", ") + ")");
        o = o || {};
        for (const key in o) if (["yaw", "pitch", "roll", "x", "y", "z"].indexOf(key) < 0) throw new Error("system: role_pose: unknown key '" + key + "' (yaw, pitch, roll in radians; x, y, z in model units)");
        const v = ["yaw", "pitch", "roll", "x", "y", "z"].map(function (key) { return o[key] === undefined ? 0 : fin(o[key], key); });
        if (v.slice(0, 3).some(function (a) { return Math.abs(a) > 2; })) throw new Error("system: role_pose: an angle of at most 2 radians");
        const bname = sk.names[life.bones[k]];
        if (life.arm_bones.indexOf(bname) >= 0) throw new Error("system: role_pose: '" + bname + "' is a bone of an arm: the life poses the arms (sp.chain asks the rig for a reach, the trait `arms` 0 leaves them alone)");
        if (v.slice(3).some(function (a) { return a !== 0; }) && !life.moves[bname]) throw new Error("system: role_pose: '" + bname + "' is solved by the rig (a bone of a chain): it turns and does not move; a move is for the hips and for the bones that no chain has");
        life_cmd(this, c, 1, k, v);
      };
      system.life_settings = function (o) {
        o = o || {};
        for (const key in o) if (key !== "visible_px" && key !== "px_k") throw new Error("system: life_settings: unknown key '" + key + "' (visible_px, px_k)");
        const vp = o.visible_px === undefined ? -1 : o.visible_px, pk = o.px_k === undefined ? 0 : o.px_k;                 // (what is not said is left as it is: the worker takes a negative gate and a zero px_k as "no change")
        if (o.visible_px !== undefined && (!Number.isFinite(vp) || vp < 0) || o.px_k !== undefined && (!Number.isFinite(pk) || pk <= 0)) throw new Error("system: life_settings: visible_px is a number, 0 or more, px_k a number over 0");
        if (!initialized) system.init({});
        life_cmd(null, null, 4, 0, [vp, pk]);
      };
      system.life_off = function (on) { if (!initialized) system.init({}); life_cmd(null, null, 3, 0, [on === false ? 0 : 1]); };
      SP.reset_local = function () { this.alive.fill(0); this.live = 0; this.hw = 0; this.mirror.fill(0); if (this.look_of) this.look_of.fill(0); if (this.skin_list) { this.skin_at.fill(0); for (let k = 1; k < this.skin_list.length; k++) list_init(this.skin_list[k]); } if (this.listed) list_init(this); };
      function bone_of(sp, bone, what) {
        const b = typeof bone === "number" ? bone : sp.sk.index[bone];
        if (b === undefined || !(b >= 0 && b < sp.bone_count) || b !== (b | 0)) throw new Error("system: " + what + ": no bone '" + bone + "' in species '" + sp.name + "'");
        return b;
      }
      function chain_of(sp, name, what) {
        const k = typeof name === "number" ? name : sp.chain_index[name];
        if (k === undefined || !(k >= 0 && k < sp.chain_names.length)) throw new Error("system: " + what + ": no chain '" + name + "' in species '" + sp.name + "' (" + sp.chain_names.join(", ") + ")");
        return k;
      }
      function live_instance(sp, c, what) {
        if (!c || c.species !== sp || !(c.slot >= 0) || !sp.alive[c.slot] || sp.gen[c.slot] !== c.gen) throw new Error("system: " + what + ": not a live instance of species '" + sp.name + "'");
        return c;
      }
      function fin(v, what) { if (typeof v !== "number" || !Number.isFinite(v)) throw new Error("system: " + what + " must be a number"); return v; }

      // ---- instances: the lowest free slot, a generation that changes every time, handles that go stale ---------------------------------------------------
      SP.spawn = function (o) {
        o = o || {};
        const skin = skin_for_spawn(this, o), drawer = this.skin_list ? this.skin_list[skin] : this, variant = variant_for_spawn(drawer, o);                                                         // (what it wears: a mistake is thrown before a slot is taken; null for a species with no variants)
        let slot = -1;
        for (let i = 0; i < this.max_instances; i++) if (!this.alive[i]) { slot = i; break; }
        if (slot < 0) throw new Error("system: species '" + this.name + "' is full (" + this.max_instances + " instances: max_instances)");
        let g = (this.gen[slot] + 1) & 0xffff;
        if (g === 0) g = 1;
        this.gen[slot] = g; this.alive[slot] = 1; this.live++;
        if (this.reach_st) { const na = this.life.arms.length; for (let a = 0; a < na; a++) this.reach_st[slot * na + a] = 0; }                // (a new instance reaches for nothing: sp.reach_state)
        if (this.grip_st) { const na = this.life.arms.length; for (let a = 0; a < na; a++) { this.grip_st[slot * na + a] = 0; this.grip_body[slot * na + a] = null; } }          // (a new instance holds nothing: sp.gripping)
        if (this.fx) fx_reset(this, slot);                                                                    // (a new instance has said nothing to its particles)
        if (this.lands) { this.lands[slot] = 0; this.land_speed[slot] = 0; }                                  // (a new instance has not landed yet: sp.landings)
        if (slot + 1 > this.hw) this.hw = slot + 1;
        if (this.look_of) this.look_of[slot] = variant;                                                     // (the look it wears: set before the list takes the instance in, which carries it)
        if (this.skin_at) this.skin_at[slot] = skin;
        if (this.listed) list_add(drawer, slot);
        this.rest_rows(slot, o);
        if (this.static) return { species: this, slot: slot, gen: g, intent: [0, 0, 0, 0], gait_blend: null, scale0: o.scale === undefined ? 1 : o.scale };           // (a static mesh: rest_rows wrote its root where it was put and its one bone at rest; nothing is sent)
        q_begin(9); q_u(CMD_HAPPY_SPAWN); q_u(this.js_id); q_u(slot); q_u(g); q_f(fin(o.x || 0, "x")); q_f(fin(o.y || 0, "y")); q_f(fin(o.z || 0, "z")); q_f(o.scale === undefined ? 1 : fin(o.scale, "scale")); q_f(fin(o.yaw || 0, "yaw"));
        const born = { species: this, slot: slot, gen: g, intent: [0, 0, 0, 0], gait_blend: null, scale0: o.scale === undefined ? 1 : o.scale };            // (a new instance wants nothing, in the worker too: a zero wish is not sent)
        if (this.fprops && this.fprops.starts.length) fp_start(this, born);                                   // (what it is born with: a holstered pistol, a helmet: runtime.js)
        return born;
      };
      // the rows of an instance that has just been spawned, until the worker's first answer: the root where it was put (position, scale, the turn about up), every bone at its bind pose (no move, the scale 1, no turn)
      // so that a species that is drawn never draws a row of zeros (a rotation that is no rotation)
      SP.rest_rows = function (slot, o) {
        const m = this.mirror, r = slot * 8, h = 0.5 * (o.yaw || 0);
        m[r] = o.x || 0; m[r + 1] = o.y || 0; m[r + 2] = o.z || 0; m[r + 3] = o.scale === undefined ? 1 : o.scale;
        m[r + 4] = 0; m[r + 5] = Math.sin(h); m[r + 6] = 0; m[r + 7] = Math.cos(h);
        const base = this.root_rows * W * 4 + slot * this.bone_count * 8;
        for (let b = 0; b < this.bone_count; b++) { const q = base + b * 8; m[q] = 0; m[q + 1] = 0; m[q + 2] = 0; m[q + 3] = 1; m[q + 4] = 0; m[q + 5] = 0; m[q + 6] = 0; m[q + 7] = 1; }
        this.dirty_root = true; this.dirty_pose = true;
      };
      SP.release = function (c) {
        live_instance(this, c, "release");
        if (this.fprops) fp_release_all(this, c);                                                          // (what it held goes back to the pool)
        if (!this.static) { q_begin(4); q_u(CMD_HAPPY_RELEASE); q_u(this.js_id); q_u(c.slot); q_u(c.gen); }
        if (this.listed) list_remove(this.skin_list ? this.skin_list[this.skin_at[c.slot]] : this, c.slot);
        if (this.look_of) this.look_of[c.slot] = 0; if (this.skin_at) this.skin_at[c.slot] = 0;
        this.alive[c.slot] = 0; this.live--;
        this.mirror[c.slot * 8 + 3] = 0; this.dirty_root = true;                               // (the draw is of the first `hw` slots, a dead one among them: its root scale 0 collapses it to a point of no area; spawn puts the row back)
        c.slot = -1;
        while (this.hw > 0 && !this.alive[this.hw - 1]) this.hw--;
      };
      SP.set_root = function (c, x, y, z, q, scale) {
        live_instance(this, c, "set_root");
        q = q || [0, 0, 0, 1];
        if (this.static) {                                                                                 // (a static mesh is moved by the page: its root row is written here, the next draw uploads it; a scale not given stays)
          const m = this.mirror, o = c.slot * 8;
          m[o] = fin(x, "x"); m[o + 1] = fin(y, "y"); m[o + 2] = fin(z, "z"); if (scale !== undefined) m[o + 3] = fin(scale, "scale");
          m[o + 4] = fin(q[0], "q"); m[o + 5] = fin(q[1], "q"); m[o + 6] = fin(q[2], "q"); m[o + 7] = fin(q[3], "q");
          this.dirty_root = true;
          return;
        }
        q_begin(12); q_u(CMD_HAPPY_SET_ROOT); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_f(fin(x, "x")); q_f(fin(y, "y")); q_f(fin(z, "z")); q_f(fin(q[0], "q")); q_f(fin(q[1], "q")); q_f(fin(q[2], "q")); q_f(fin(q[3], "q")); q_f(scale === undefined ? 0 : fin(scale, "scale"));
      };
      SP.set_tier = function (c, tier) {
        live_instance(this, c, "set_tier");
        if (TIERS[tier] === undefined) throw new Error("system: tier must be far, near or auto (" + tier + ")");
        q_begin(5); q_u(CMD_HAPPY_SET_TIER); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(TIERS[tier]);
      };
      // The Euler angles of a rotation q (x, y, z, w), the way the pose command has them: q = qx(rx) * qz(rz) * qy(ry), ry about the bone's own axis (its twist), rx and rz bend it. As a matrix this is
      // R01 = -sin rz, R00 = cos rz cos ry, R02 = cos rz sin ry, R11 = cos rx cos rz, R21 = sin rx cos rz; rz = +-90 degrees has no ry (it is taken as 0)
      function euler_of(q) {
        const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1, x = q[0] / n, y = q[1] / n, z = q[2] / n, w = q[3] / n;
        const r00 = 1 - 2 * (y * y + z * z), r01 = 2 * (x * y - z * w), r02 = 2 * (x * z + y * w), r11 = 1 - 2 * (x * x + z * z), r21 = 2 * (y * z + x * w), r10 = 2 * (x * y + z * w), r12 = 2 * (y * z - x * w);
        const rz = Math.asin(Math.max(-1, Math.min(1, -r01))) + 0;                  // (+ 0: not -0)
        if (Math.abs(Math.cos(rz)) < 1e-6) return { rx: Math.atan2(-r12, r10 * Math.sign(-r01)), ry: 0, rz: rz };
        return { rx: Math.atan2(r21, r11) + 0, ry: Math.atan2(r02, r00) + 0, rz: rz };
      }
      system.euler_of = euler_of;
      // what the animation says of a bone: a turn (radians, in the bone's own frame: ry about its own axis, rx and rz bend it; or `q`: a quaternion [x, y, z, w] in the bone's own frame), a move (x, y, z in the
      // parent's frame: for a bone that slides, y is the slide), how fast it gets there (stiffness 1/s; 0: at once). The rig holds a bone that has a joint to it: what is asked past the joint's limit is not done.
      SP.pose = function (c, bone, o) {
        live_instance(this, c, "pose");
        o = o || {};
        const b = bone_of(this, bone, "pose");
        let rx = o.rx || 0, ry = o.ry || 0, rz = o.rz || 0;
        if (o.q !== undefined) {
          if (!Array.isArray(o.q) || o.q.length !== 4) throw new Error("system: pose: q must be [x, y, z, w]");
          if (o.rx !== undefined || o.ry !== undefined || o.rz !== undefined) throw new Error("system: pose: q and rx / ry / rz are two ways to say the same turn: give one");
          o.q.forEach(function (v) { fin(v, "q"); });
          const e = euler_of(o.q); rx = e.rx; ry = e.ry; rz = e.rz;
        }
        q_begin(12); q_u(CMD_HAPPY_BONE); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(b);
        q_f(fin(o.x || 0, "x")); q_f(fin(o.y || 0, "y")); q_f(fin(o.z || 0, "z")); q_f(fin(rx, "rx")); q_f(fin(ry, "ry")); q_f(fin(rz, "rz")); q_f(fin(o.stiffness || 0, "stiffness"));
      };

      // ---- chains: where the end of a chain of the rig is wanted --------------------------------------------------------------------------------------
      SP.chain = function (c, name, o) {
        live_instance(this, c, "chain");
        o = o || {};
        const k = chain_of(this, name, "chain"), def = this.rig.chains[k];
        const tg = o.target;
        if (!Array.isArray(tg) || tg.length !== 3) throw new Error("system: chain '" + this.chain_names[k] + "': target must be [x, y, z] (the model's space)");
        const q = o.orient === undefined || o.orient === null ? [0, 0, 0, 1] : o.orient;
        if (!Array.isArray(q) || q.length !== 4) throw new Error("system: chain '" + this.chain_names[k] + "': orient must be [x, y, z, w]");
        const pole = o.pole === undefined || o.pole === null ? def.pole : o.pole;
        if (!Array.isArray(pole) || pole.length !== 3) throw new Error("system: chain '" + this.chain_names[k] + "': pole must be [x, y, z]");
        const weight = o.weight === undefined ? def.weight : fin(o.weight, "weight"), pole_w = o.pole_w === undefined ? def.pole_w : fin(o.pole_w, "pole_w");
        q_begin(18); q_u(CMD_HAPPY_CHAIN); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(k); q_u(1 | (o.orient ? 2 : 0));
        q_f(fin(tg[0], "target")); q_f(fin(tg[1], "target")); q_f(fin(tg[2], "target"));
        q_f(fin(q[0], "orient")); q_f(fin(q[1], "orient")); q_f(fin(q[2], "orient")); q_f(fin(q[3], "orient"));
        q_f(weight); q_f(fin(pole[0], "pole")); q_f(fin(pole[1], "pole")); q_f(fin(pole[2], "pole")); q_f(pole_w);
      };
      // the chain is not asked for any more: its bones go back to the animation's pose (held to their joints)
      SP.release_chain = function (c, name) {
        live_instance(this, c, "release_chain");
        const k = chain_of(this, name, "release_chain");
        q_begin(18); q_u(CMD_HAPPY_CHAIN); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(k); q_u(0);
        for (let i = 0; i < 12; i++) q_f(i === 6 ? 1 : 0);                           // (a unit quaternion, nothing else)
      };

      // ---- where things are, from the rows the worker sent ------------------------------------------------------------------------------------------
      // the instance's skinning rows (8 floats a bone: translation, scale, rotation) as the page has them
      SP.rows_of = function (c) {
        live_instance(this, c, "rows_of");
        const floats = this.bone_count * 8, base = this.root_rows * W * 4 + c.slot * floats;
        return this.mirror.subarray(base, base + floats);
      };
      // a point that is fixed to a bone, given where it is at the bind pose (the model's space), as it is now (the model's space): the skinning transform of the bone takes it there
      SP.point_on = function (c, bone, p) {
        const b = bone_of(this, bone, "point_on"), r = this.rows_of(c), o = b * 8, v = quat_rot([r[o + 4], r[o + 5], r[o + 6], r[o + 7]], vec3(p, "point_on: the point")), s = r[o + 3];
        return [v[0] * s + r[o], v[1] * s + r[o + 1], v[2] * s + r[o + 2]];
      };
      // a bone's head in the model's space
      SP.bone_position = function (c, bone) {
        const b = bone_of(this, bone, "bone_position");
        return this.point_on(c, b, [this.sk.head[b * 3], this.sk.head[b * 3 + 1], this.sk.head[b * 3 + 2]]);
      };
      // where the end of a chain is (the head of its tip bone, else the tail of its last bone): what sp.chain's target asks it to be at
      SP.chain_end = function (c, name) {
        const k = chain_of(this, name, "chain_end"), def = this.rig.chains[k], sk = this.sk;
        if (def.tip >= 0) return this.point_on(c, def.tip, [sk.head[def.tip * 3], sk.head[def.tip * 3 + 1], sk.head[def.tip * 3 + 2]]);
        const last = def.bones[def.bones.length - 1];
        return this.point_on(c, last, [sk.tail[last * 3], sk.tail[last * 3 + 1], sk.tail[last * 3 + 2]]);
      };
      // where a chain's end is at the bind pose
      SP.chain_rest_end = function (name) {
        const k = chain_of(this, name, "chain_rest_end"), def = this.rig.chains[k], sk = this.sk;
        if (def.tip >= 0) return [sk.head[def.tip * 3], sk.head[def.tip * 3 + 1], sk.head[def.tip * 3 + 2]];
        const last = def.bones[def.bones.length - 1];
        return [sk.tail[last * 3], sk.tail[last * 3 + 1], sk.tail[last * 3 + 2]];
      };
      SP.bone_world = function (c, bone) {
        const m = this.bone_position(c, bone), o = c.slot * 8, rt = this.mirror, s = rt[o + 3], v = quat_rot([rt[o + 4], rt[o + 5], rt[o + 6], rt[o + 7]], m);
        return [rt[o] + v[0] * s, rt[o + 1] + v[1] * s, rt[o + 2] + v[2] * s];
      };
      function quat_rot(q, v) {
        const cx = q[1] * v[2] - q[2] * v[1] + q[3] * v[0], cy = q[2] * v[0] - q[0] * v[2] + q[3] * v[1], cz = q[0] * v[1] - q[1] * v[0] + q[3] * v[2];
        return [v[0] + 2 * (q[1] * cz - q[2] * cy), v[1] + 2 * (q[2] * cx - q[0] * cz), v[2] + 2 * (q[0] * cy - q[1] * cx)];
      }
      system.quat_rot = quat_rot;

      // ========================================================================================================================
      // flight_api
      // ========================================================================================================================
// system.js, a part: the page's calls of flight and the pilot's stick (world.cpp): fly, the climb wish, the controls, the wings by hand. It is included after species.js (it adds to the species' methods).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system.
      // ---- flight: the page's calls -----------------------------------------------------------------------------------------------------------------------
      // what a species flies as: its flight ({ model: "wing" | "hover", stall_speed, cruise_speed, max_speed, clearance ... }), or, for an aircraft (world.cpp), a record of the same shape with the model "plane" (an
      // aircraft is a wing that rolls on its gear: it takes off by itself from the wish or the stick, it needs no flight section), or null if it does not fly
      Object.defineProperty(SP, "flyer", { get: function () {
        if (this.flight) return this.flight;
        if (!this.aircraft) return null;
        if (!this._plane) this._plane = { model: "plane", stall_speed: this.aircraft.stall_speed, cruise_speed: this.aircraft.cruise_speed, max_speed: this.aircraft.max_speed, thrust: this.aircraft.thrust, max_bank: this.aircraft.max_bank, max_pitch: this.aircraft.max_pitch, pivot: this.aircraft.pivot, clearance: 0 };
        return this._plane;
      } });
      // take off (on) or land (off): the species needs a flight (flight: { ... } in its file). A wing that is slower than it can fly is thrown along its nose at the cruise speed; landing leaves the instance upright and in
      // the air, with its speed: the body's gravity takes it down, on its open wings if it has them (a body without the ground flag stays where it is). c.flying is what was asked for last.
      SP.fly = function (c, on) {
        live_instance(this, c, "fly");
        if (!this.flyer) throw new Error("system: fly: species '" + this.name + "' has no flight (flight: { model: 'wing' | 'hover' ... } or aircraft: { ... })");
        on = !!on;
        q_begin(5); q_u(CMD_HAPPY_FLY); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(on ? 1 : 0);
        c.flying = on;
      };
      // the vertical velocity a flying instance wants (world units / s, up is positive); it stays until the next one and the same number again sends nothing
      SP.set_climb = function (c, vy) {
        live_instance(this, c, "set_climb");
        if (!this.flyer) throw new Error("system: set_climb: species '" + this.name + "' has no flight (a climb wish is for a flyer)");
        fin(vy, "vy");
        if (vy === c.climb || (vy === 0 && c.climb === undefined)) return;
        c.climb = vy;
        q_begin(5); q_u(CMD_HAPPY_CLIMB); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_f(vy);
      };
      // the pilot's controls: { throttle (0 .. 1), brake, steer (-1 .. 1), handbrake, pitch (+ nose up), roll (+ right wing down), yaw (+ nose right), flaps } (what is not said is 0); null gives the stick back (the craft flies itself from
      // the wish). A hover flown with the stick: the throttle is its collective, pitch and roll tilt it, yaw turns it
      const CONTROL_KEYS = ["throttle", "brake", "steer", "handbrake", "pitch", "roll", "yaw", "flaps"];
      const control_scratch = [0, 0, 0, 0, 0, 0, 0, 0];                                                    // (what a call says, before it is compared with what was sent last: a page says it every frame, and a call makes no array, object or closure)
      SP.set_controls = function (c, o) {
        live_instance(this, c, "set_controls"); need(this, "set_controls", "body");
        const v = control_scratch;
        let flags = 0, i;
        for (i = 0; i < 8; i++) v[i] = 0;
        if (o !== null && o !== undefined) {
          if (typeof o !== "object" || Array.isArray(o)) throw new Error("system: set_controls needs { throttle, pitch, roll, yaw ... } or null");
          for (const k in o) if (CONTROL_KEYS.indexOf(k) < 0) throw new Error("system: set_controls: unknown control '" + k + "' (" + CONTROL_KEYS.join(", ") + ")");
          for (i = 0; i < 8; i++) { const x = o[CONTROL_KEYS[i]]; if (x !== undefined) v[i] = fin(x, CONTROL_KEYS[i]); }
          flags = 1;
        }
        const last = c.controls;
        if (last) {
          if (last.flags === flags) { for (i = 0; i < 8 && last.v[i] === v[i]; i++); if (i === 8) return; }          // (the same as the last, nothing is sent)
          last.flags = flags;
          for (i = 0; i < 8; i++) last.v[i] = v[i];
        } else c.controls = { flags: flags, v: v.slice() };
        q_begin(13); q_u(CMD_HAPPY_CONTROLS); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(flags);
        for (i = 0; i < 8; i++) q_f(v[i]);
      };
      // the wings of an instance by hand (a species with `wings`): { fold: 0 .. 1 (0), hz (0: they glide, level), amplitude (a multiple of the species', 1) }, or null / undefined: the automatic animation again
      SP.set_wings = function (c, o) {
        live_instance(this, c, "set_wings");
        if (!this.wings) throw new Error("system: set_wings: species '" + this.name + "' has no wings (wings: [...])");
        let mode = 0, fold = 0, hz = 0, amp = 1;
        if (o !== null && o !== undefined) {
          if (typeof o !== "object" || Array.isArray(o)) throw new Error("system: set_wings needs { fold, hz, amplitude } or null");
          for (const k in o) if (["fold", "hz", "amplitude"].indexOf(k) < 0) throw new Error("system: set_wings: unknown field '" + k + "'");
          mode = 1; fold = o.fold === undefined ? 0 : o.fold; hz = o.hz === undefined ? 0 : o.hz; amp = o.amplitude === undefined ? 1 : o.amplitude;
          if (!Number.isFinite(fold) || fold < 0 || fold > 1) throw new Error("system: set_wings: fold = " + fold + " is out of range (0 .. 1)");
          if (!Number.isFinite(hz) || hz < 0 || hz > 50) throw new Error("system: set_wings: hz = " + hz + " is out of range (0 .. 50)");
          if (!Number.isFinite(amp) || amp < 0 || amp > 3) throw new Error("system: set_wings: amplitude = " + amp + " is out of range (0 .. 3)");
        }
        const w = c.wings;
        if (w ? (w.mode === mode && w.fold === fold && w.hz === hz && w.amp === amp) : mode === 0) return;
        c.wings = { mode: mode, fold: fold, hz: hz, amp: amp };
        q_begin(8); q_u(CMD_HAPPY_WINGS); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(mode); q_f(fold); q_f(hz); q_f(amp);
      };

      // ========================================================================================================================
      // wheels_api
      // ========================================================================================================================
// system.js, a part: the page's calls of the hitch (world.cpp): link and unlink. (The driver's controls of a vehicle are flight_api.js's set_controls: the same four numbers and the same words.) It is included after species.js
// (it adds to the species' methods).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system.
      // ---- the hitch: the page's calls --------------------------------------------------------------------------------------------------------------------
      // what a species drives as: its vehicle ({ model: "car" | "tracked", wheels, top_speed ... }), or null if it does not
      Object.defineProperty(SP, "drivable", { get: function () { return this.vehicle || null; } });
      function is_live(sp, c) { return !!(c && c.species === sp && c.slot >= 0 && sp.alive[c.slot] && sp.gen[c.slot] === c.gen); }
      // the instance c follows `leader_c` of `leader_sp`: its coupler `from` (a name of this species' `couplers`, default "front") is pinned to the leader's `to` (default "rear"), it faces the hitch point and stands on the
      // floor behind it; its own mover is left alone, its legs walk it and its wheels roll. A chain is solved leader first in one frame. Linking again replaces the link. o: { from, to, max_angle (rad, 0.05 .. 3.1,
      // default 1.4: the most its heading may differ from the leader's), lead_point, fol_point (points [x, y, z] instead of coupler names) }. Returns true; false when the leader is not a live instance
      const LINK_FIELDS = ["from", "to", "max_angle", "lead_point", "fol_point"];
      SP.link = function (c, leader_sp, leader_c, o) {
        o = o || {};
        live_instance(this, c, "link");
        if (!leader_sp || typeof leader_sp.spawn !== "function" || !is_live(leader_sp, leader_c)) return false;
        if (leader_sp === this && leader_c === c) throw new Error("system: link: an instance cannot follow itself");
        for (const k in o) if (LINK_FIELDS.indexOf(k) < 0) throw new Error("system: link: unknown field '" + k + "' (" + LINK_FIELDS.join(", ") + ")");
        const from = o.from === undefined ? "front" : o.from, to = o.to === undefined ? "rear" : o.to;
        const fol = o.fol_point || this.couplers[from], lead = o.lead_point || leader_sp.couplers[to];
        if (!fol) throw new Error("system: link: this species has no coupler '" + from + "' (its couplers: " + Object.keys(this.couplers).join(", ") + ")");
        if (!lead) throw new Error("system: link: the leader's species has no coupler '" + to + "' (its couplers: " + Object.keys(leader_sp.couplers).join(", ") + ")");
        const pt = function (p, what) { if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite) || !p.every(function (v) { return Math.abs(v) < 1e5; })) throw new Error("system: link: " + what + " must be [x, y, z] (numbers under 100000)"); };
        pt(fol, "fol_point"); pt(lead, "lead_point");
        const max_angle = o.max_angle === undefined ? 1.4 : o.max_angle;
        if (!Number.isFinite(max_angle) || max_angle < 0.05 || max_angle > 3.1) throw new Error("system: link: max_angle = " + max_angle + " is out of range (0.05 .. 3.1 rad)");
        let depth = 0;                                                                              // (the worker refuses a cycle and a chain over 32 as well: the page says why)
        for (let cur = leader_c; cur; cur = cur.link ? cur.link.leader : null) {
          if (cur === c) throw new Error("system: link: a chain cannot go round (the leader is led by this instance)");
          if (++depth > 32) throw new Error("system: link: a chain is 32 links at most (33 creatures)");
        }
        q_begin(15); q_u(CMD_HAPPY_LINK); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(leader_sp.js_id); q_u(leader_c.slot); q_u(leader_c.gen); q_u(0);
        lead.forEach(function (v) { q_f(v); }); fol.forEach(function (v) { q_f(v); }); q_f(max_angle);
        if (c.link && c.link.leader.followers) c.link.leader.followers.delete(c);                   // (linked again: it is no longer the old leader's)
        c.link = { leader_species: leader_sp, leader: leader_c, from: from, to: to, max_angle: max_angle, lead: lead.slice(), fol: fol.slice() };
        (leader_c.followers || (leader_c.followers = new Set())).add(c);
        return true;
      };
      // free: it stays where it is, its mover has it again
      SP.unlink = function (c) {
        live_instance(this, c, "unlink");
        if (!c.link) return true;
        if (c.link.leader.followers) c.link.leader.followers.delete(c);
        c.link = null;
        q_begin(4); q_u(CMD_HAPPY_UNLINK); q_u(this.js_id); q_u(c.slot); q_u(c.gen);
        return true;
      };
      // a released instance breaks its links in the worker (as a follower and as a leader): the page forgets them too
      const release_unlinked = SP.release;
      SP.release = function (c) {
        if (c && c.link) { if (c.link.leader.followers) c.link.leader.followers.delete(c); c.link = null; }
        if (c && c.followers) { c.followers.forEach(function (f) { f.link = null; }); c.followers = null; }
        return release_unlinked.call(this, c);
      };

      // ========================================================================================================================
      // seat_api
      // ========================================================================================================================
// system.js, a part: SEATS and DOORS of a vehicle, and a rider who gets in and out (world.cpp, CMD_HAPPY_SEAT; SYSTEM.md "Seats and doors"). It is included after wheels_api.js (it adds to the species' methods).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
      // ---- the definition: `seats` and `doors` of a VEHICLE'S body (page only: the worker is told a seat when a rider sits) ---------------------------------------------------------------------------------
      //   doors: { left: { bone: "door_l", open: -1.2, speed: 3, at: [x, y, z], axis: [0, 1, 0] } }      a DOOR is a bone that swings about a hinge: `bone` (its head is the hinge, it runs along the door: the hinge turns across it, like
      //                                  any hinge of the rig: give the bone a joint { kind: "hinge", axis, range }), `axis` the hinge's axis in the vehicle's model space (up by default), `open` the angle it swings to, in radians (its sign
      //                                  is the way: a door on the left of a car, hinged at its front edge, opens with a negative angle about up), `speed` radians a second, `at` where a rider stands outside to get in (the vehicle's model space)
      //   seats: { driver: { at: [x, y, z], yaw: 0, feet: { left: [x, y, z], right: [x, y, z] }, hands: { left: [x, y, z], right: [x, y, z] }, door: "left", exit: [x, y, z], board: [x, y, z] } }     a SEAT: `at` where the rider's HIPS are (the
      //                                  vehicle's model space: the body bone's head of the rider is pinned to it), `yaw` how far the rider faces from the vehicle's front, `feet` where its two ankles go (the pedals, the floor), `hands` where its two
      //                                  hands go (the rim of the wheel; optional: a passenger's hang), `door` the door it gets in by (a seat with none is boarded over the side: a buggy, a tractor), `board` the place outside where a rider stands to
      //                                  get on a seat that has no door (the vehicle's model space), `exit` where it stands when it gets out (default: the door's `at`, else `board`)
      // The page's calls:
      //   sp.seat(c, vehicle_sp, vehicle_c, { seat })   the instance c SITS on a seat of the vehicle at once (no sitting down: the hips are on the seat, the gait is off, the feet are on the pedals, the hands are on the wheel). world.cpp keeps
      //                                              it there whatever the vehicle does (it is rigid, it leans with it). sp.seated(c) -> { vehicle_sp, vehicle, seat } | null      sp.unseat(c, { at: [x, y, z], yaw }) -> it gets up (stands at
      //                                              `at`, the seat's `exit` by default, in the world)
      //   sp.door(c, name, open)       the door opens (true) or closes (false) at its own speed (the page moves its bone every frame it is on its way: system.seat_frame)      sp.door_state(c, name) -> 0 (shut) .. 1 (open)
      //   system.enter(rider_sp, rider_c, vehicle_sp, vehicle_c, { seat, speed, on_done, on_fail }) -> a task      the rider WALKS to the door's place, the door OPENS, the rider sits, the door CLOSES (`on_done`; `task.state`, `task.cancel()`); a seat with no door
      //                                              is boarded at its `board` place: walk, sit
      //   system.leave(rider_sp, rider_c, { speed, on_done }) -> a task      the door opens, the rider gets up and stands outside it, the door closes once it is away (no door: the rider gets up at once)
      // A rider's own mind should be off (it would give the walk its wishes: nothing moves a seated rider, but its arms and head are the page's and the mind's).
      // A seat in the WORLD (no vehicle: a chair, a bench, a log; CMD_HAPPY_SIT) is further down: sp.sit(c, { at, yaw, dur, floor, feet }) sits the instance down on a point of the world over `dur` seconds (gait off from the first frame, hips pinned
      // there, feet on the floor), sp.stand(c, { to, yaw, dur }) gets it up, sp.sitting(c) -> { phase, t, error }, sp.on_sit(c, phase)
      function compile_seats(seats, doors, sk) {
        if (seats === undefined && doors === undefined) return null;
        const out = { seats: Object.create(null), doors: Object.create(null), seat_names: [], door_names: [] };
        const p3 = function (v, what) {
          if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite) || !v.every(function (x) { return Math.abs(x) < 1e4; })) fail(what + " is [x, y, z] (numbers)");
          return v.slice();
        };
        const dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
        if (doors !== undefined) {
          if (!doors || typeof doors !== "object" || Array.isArray(doors)) fail("doors is { name: { bone, open, speed, at, axis } }");
          Object.keys(doors).forEach(function (n) {
            const d = doors[n], where = "doors." + n;
            if (!/^[a-z][a-z0-9_]*$/.test(n)) fail(where + ": a name is lower case letters, digits and _");
            if (!d || typeof d !== "object" || Array.isArray(d)) fail(where + " is { bone, open, speed, at, axis }");
            only_keys(d, ["bone", "open", "speed", "at", "axis"], where);
            const b = sk.index[d.bone];
            if (b === undefined) fail(where + ".bone '" + d.bone + "' is not a bone of the skeleton");
            const open = d.open === undefined ? 1.2 : d.open, speed = d.speed === undefined ? 3 : d.speed;
            if (typeof open !== "number" || !Number.isFinite(open) || open === 0 || Math.abs(open) > 2.5) fail(where + ".open is the angle it swings to in radians, not 0, at most 2.5 (its sign is the way)");
            if (typeof speed !== "number" || !(speed > 0 && speed <= 50)) fail(where + ".speed is radians a second, above 0");
            const axis = d.axis === undefined ? [0, 1, 0] : p3(d.axis, where + ".axis"), R = bone_axes(sk, b);
            const a = [dot(R.x, axis), dot(R.y, axis), dot(R.z, axis)], l = Math.hypot(a[0], a[1], a[2]);
            if (!(l > 1e-6)) fail(where + ".axis is not an axis");
            if (Math.abs(a[1]) / l > 0.5) fail(where + ".axis lies along the bone '" + d.bone + "': a door's bone runs along the door (its head is the hinge) and the hinge turns across it");
            out.doors[n] = { name: n, bone: d.bone, open: open, speed: speed, at: p3(d.at, where + ".at"), axis_local: [a[0] / l, a[1] / l, a[2] / l] };
            out.door_names.push(n);
          });
        }
        if (seats !== undefined) {
          if (!seats || typeof seats !== "object" || Array.isArray(seats)) fail("seats is { name: { at, yaw, feet, hands, door, exit } }");
          Object.keys(seats).forEach(function (n) {
            const s = seats[n], where = "seats." + n;
            if (!/^[a-z][a-z0-9_]*$/.test(n)) fail(where + ": a name is lower case letters, digits and _");
            if (!s || typeof s !== "object" || Array.isArray(s)) fail(where + " is { at, yaw, feet, hands, door, exit }");
            only_keys(s, ["at", "yaw", "feet", "hands", "door", "exit", "board"], where);
            const yaw = s.yaw === undefined ? 0 : s.yaw;
            if (typeof yaw !== "number" || !Number.isFinite(yaw) || Math.abs(yaw) > 6.4) fail(where + ".yaw is radians");
            const pair = function (o, what, required) {
              if (o === undefined && !required) return null;
              if (!o || typeof o !== "object" || Array.isArray(o)) fail(where + "." + what + " is { left: [x, y, z], right: [x, y, z] }");
              only_keys(o, ["left", "right"], where + "." + what);
              return { left: p3(o.left, where + "." + what + ".left"), right: p3(o.right, where + "." + what + ".right") };
            };
            if (s.door !== undefined && out.doors[s.door] === undefined) fail(where + ".door '" + s.door + "' is not one of its doors (" + (out.door_names.join(", ") || "it has none") + ")");
            out.seats[n] = { name: n, at: p3(s.at, where + ".at"), yaw: yaw, feet: pair(s.feet, "feet", true), hands: pair(s.hands, "hands", false), door: s.door === undefined ? null : s.door, exit: s.exit === undefined ? null : p3(s.exit, where + ".exit"), board: s.board === undefined ? null : p3(s.board, where + ".board") };
            if (!out.seats[n].exit) out.seats[n].exit = s.door !== undefined ? out.doors[s.door].at.slice() : (out.seats[n].board ? out.seats[n].board.slice() : null);
            out.seat_names.push(n);
          });
        }
        return out;
      }
      system.compile_seats = compile_seats;

      const seat_state = { tasks: [], riders: [], doors: [], sitters: [], hooked: false };
      function seat_hook() {
        if (seat_state.hooked || !engine.on_frame_begin || typeof engine.on_frame_begin.add !== "function") return;
        seat_state.hooked = true;
        engine.on_frame_begin.add(function (time, dt) { system.seat_frame(dt); });
      }
      function need_seats(sp, what) { if (!sp.seat_defs || !sp.seat_defs.seat_names.length) throw new Error("system: " + what + ": species '" + sp.name + "' has no seats (the body's `seats`)"); return sp.seat_defs; }
      // an instance that is out of sight (culled: runtime.js) has a root scale of 0 in the page's rows and its rows are what it last had: its scale is what it was spawned with (c.scale0), its place the last it was seen at
      function scale_of(sp, c) { const s = sp.mirror[c.slot * 8 + 3]; return s > 0 ? s : (c.scale0 > 0 ? c.scale0 : 1); }
      function seen_of(sp, c) { return sp.mirror[c.slot * 8 + 3] > 0; }
      function rider_rows(sp, c) { const m = sp.mirror, r = c.slot * 8; return { p: [m[r], m[r + 1], m[r + 2]], s: scale_of(sp, c), q: [m[r + 4], m[r + 5], m[r + 6], m[r + 7]] }; }
      // a vehicle's model point -> the world (the page's copy of the root: a frame behind the worker)
      function vehicle_world(sp, c, p) {
        const r = rider_rows(sp, c), v = quat_rot(r.q, [p[0] * r.s, p[1] * r.s, p[2] * r.s]);
        return [r.p[0] + v[0], r.p[1] + v[1], r.p[2] + v[2]];
      }

      // ---- doors ---------------------------------------------------------------------------------------------------------------------------------------
      SP.door = function (c, name, open) {
        live_instance(this, c, "door");
        const defs = need_seats(this, "door"), d = defs.doors[name];
        if (!d) throw new Error("system: door: species '" + this.name + "' has no door '" + name + "' (" + (defs.door_names.join(", ") || "none") + ")");
        const st = c.doors || (c.doors = Object.create(null)), e = st[name] || (st[name] = { frac: 0, target: 0 });
        e.target = open === false || open === 0 ? 0 : (open === true || open === undefined ? 1 : Math.max(0, Math.min(1, fin(open, "open"))));
        if (e.frac !== e.target && seat_state.doors.indexOf(c) < 0) { seat_state.doors.push(c); seat_hook(); }
        return e.frac;
      };
      SP.door_state = function (c, name) {
        live_instance(this, c, "door_state");
        const e = c.doors && c.doors[name];
        return e ? e.frac : 0;
      };
      function door_put(sp, c, d, frac) {
        const ang = d.open * frac, s = Math.sin(ang / 2), a = d.axis_local;
        sp.pose(c, d.bone, { q: [a[0] * s, a[1] * s, a[2] * s, Math.cos(ang / 2)] });
      }

      // ---- the seat ------------------------------------------------------------------------------------------------------------------------------------
      // the rider's hips (the body bone's head, in its model space): what the worker pins to the seat. A creature with no legs cannot sit
      function hips_of(sp) {
        if (!sp.legs) throw new Error("system: seat: species '" + sp.name + "' has no legs: a rider sits with its legs' chains (the definition's `legs`)");
        const b = sp.legs.body;
        return [sp.sk.head[b * 3], sp.sk.head[b * 3 + 1], sp.sk.head[b * 3 + 2]];
      }
      // a point of the vehicle's model space -> the rider's model space, for a rider on `seat` (the seat's point is the hips, the rider is turned by the seat's yaw; both are scaled by their roots': a metre is a metre)
      function to_rider(seat, hips, p, SL, SF) {
        const rx = (p[0] - seat.at[0]) * SL / SF, ry = (p[1] - seat.at[1]) * SL / SF, rz = (p[2] - seat.at[2]) * SL / SF, ca = Math.cos(seat.yaw), sa = Math.sin(seat.yaw);
        return [hips[0] + rx * ca - rz * sa, hips[1] + ry, hips[2] + rx * sa + rz * ca];
      }
      function seat_hands(sp, c, st) {                                                                  // the hands on the wheel: in arm lengths from each shoulder, in the body's frame (the worker holds them 30 frames: the page says it again)
        if (!st.hands) return;
        sp.life.arms.forEach(function (arm) {
          const t = arm.side > 0 ? st.hands.left : st.hands.right, b = sp.sk.index[arm.shoulder];
          const d = [(t[0] - sp.sk.head[b * 3]) / arm.length, (t[1] - sp.sk.head[b * 3 + 1]) / arm.length, (t[2] - sp.sk.head[b * 3 + 2]) / arm.length];
          sp.hand(c, arm.name, { x: d[0], y: d[1], z: d[2], body: true, w: 1 });
        });
      }
      SP.seat = function (c, vehicle_sp, vehicle_c, o) {
        live_instance(this, c, "seat");
        o = o || {};
        only_keys(o, ["seat"], "seat");
        if (!vehicle_sp || typeof vehicle_sp.spawn !== "function" || !is_live(vehicle_sp, vehicle_c)) return false;
        const defs = need_seats(vehicle_sp, "seat"), name = o.seat === undefined ? defs.seat_names[0] : o.seat, seat = defs.seats[name];
        if (!seat) throw new Error("system: seat: species '" + vehicle_sp.name + "' has no seat '" + name + "' (" + defs.seat_names.join(", ") + ")");
        if (vehicle_sp === this && vehicle_c === c) throw new Error("system: seat: an instance cannot sit on itself");
        const hips = hips_of(this), SL = scale_of(vehicle_sp, vehicle_c), SF = scale_of(this, c);
        const lf = to_rider(seat, hips, seat.feet.left, SL, SF), rf = to_rider(seat, hips, seat.feet.right, SL, SF);
        q_begin(21); q_u(CMD_HAPPY_SEAT); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(vehicle_sp.js_id); q_u(vehicle_c.slot); q_u(vehicle_c.gen); q_u(0);
        seat.at.forEach(function (v) { q_f(v); }); hips.forEach(function (v) { q_f(v); }); q_f(seat.yaw); lf.forEach(function (v) { q_f(v); }); rf.forEach(function (v) { q_f(v); });
        if (c.link && c.link.leader.followers) c.link.leader.followers.delete(c);
        c.link = { seat: name, leader_species: vehicle_sp, leader: vehicle_c };
        (vehicle_c.followers || (vehicle_c.followers = new Set())).add(c);
        const st = { sp: this, c: c, vsp: vehicle_sp, vc: vehicle_c, seat: seat, hands: seat.hands ? { left: to_rider(seat, hips, seat.hands.left, SL, SF), right: to_rider(seat, hips, seat.hands.right, SL, SF) } : null, tick: 0 };
        c.seated = st;
        if (seat_state.riders.indexOf(st) < 0) seat_state.riders.push(st);
        seat_hooks_on();
        if (this.life && this.life.arms.length) seat_hands(this, c, st);
        return true;
      };
      function seat_hooks_on() { seat_hook(); }
      SP.seated = function (c) {
        live_instance(this, c, "seated");
        const st = c.seated;
        if (st && st.world) return { world: true, anchor: st.anchor.slice(), phase: st.phase };                         // (a seat in the world: no vehicle)
        return st && c.link && c.link.seat ? { vehicle_sp: st.vsp, vehicle: st.vc, seat: st.seat.name } : null;
      };
      // it gets up: the link is gone (the legs begin again where the rider is), the hands let go, and the rider is put where it says (by default the seat's `exit`, in the world, facing the way the vehicle does)
      SP.unseat = function (c, o) {
        live_instance(this, c, "unseat");
        o = o || {};
        only_keys(o, ["at", "yaw"], "unseat");
        const st = c.seated;
        if (st && st.world) {                                                                           // (a seat in the world: it is let go at once, where the rider is; `at` and `yaw` put it somewhere: the rider's root)
          this.unlink(c);
          sit_forget(st);
          if (o.at !== undefined) { const at = vec3(o.at, "unseat: at"), yaw = o.yaw !== undefined ? fin(o.yaw, "yaw") : st.yaw; this.set_root(c, at[0], at[1], at[2], [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]); }
          return true;
        }
        if (!st || !c.link || !c.link.seat) return false;
        c.seated = null;
        const k = seat_state.riders.indexOf(st);
        if (k >= 0) seat_state.riders.splice(k, 1);
        this.unlink(c);
        if (this.life) this.life.arms.forEach(function (arm) { st.sp.hand(c, arm.name, { w: 0 }); });
        const at = o.at !== undefined ? vec3(o.at, "unseat: at") : (st.seat.exit ? vehicle_world(st.vsp, st.vc, st.seat.exit) : null);
        if (at && is_live(st.vsp, st.vc)) {
          const ground = st.vsp.mirror[st.vc.slot * 8 + 1], yaw = o.yaw !== undefined ? fin(o.yaw, "yaw") : st.vsp.heading(st.vc);
          this.set_root(c, at[0], ground, at[2], [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]);
        }
        return true;
      };

      // ---- a seat in the WORLD (CMD_HAPPY_SIT, world.cpp): no vehicle, a point of the world: a chair, a bench, a log --------------------------------------------------------------------------------------------
      //   sp.sit(c, { at: [x, y, z], yaw, dur, floor, feet })    the instance sits down on a point of the world: `at` is where its HIPS go (the body bone's head: a creature of 0.95 m hips on a chair 0.45 high is 0.14 over the cushion,
      //                                              scaled), `yaw` the way it faces (forward is (sin yaw, cos yaw)), `dur` the seconds the sitting down takes (0.9: the root eases to the seat, horizontal first, the feet
      //                                              slide to the floor under it; 0: it is on the seat at once), `floor` (REQUIRED) the world height of the floor its feet stand on (a chair on an upper storey stands on a
      //                                              prop that the worker's terrain does not know), `feet` { left: [x, y, z], right: [x, y, z] } in the rider's own model space at the seat (optional: each leg's stance place on
      //                                              the floor, a two-legged rider's pushed forward so the knees go forward). -> true; false when the instance is gone. The gait is off from the next frame on. Throws for a bad option
      //   sp.stand(c, { to: [x, y, z], yaw, dur })     the instance gets up (0.8 s) and stands with its ROOT at `to` (y is the floor there), facing `yaw` (the seat's by default); the gait begins again there. -> true; false when it is
      //                                              gone or sits in no world seat. A sit while it stands up goes on from where it is
      //   sp.sitting(c) -> null | { phase: "down" | "seated" | "up", t, error }     the phase the worker last said (system.on_sit_event), t how far the blend is (0 .. 1: the page counts the time), error how far the rider's hips are from
      //                                              `at` as the page's rows have them (metres)         sp.seated(c) -> { world: true, anchor, phase }      sp.unseat(c) lets it go at once, where it is
      //   sp.on_sit(c, phase)                        called when the worker says the phase changed: "down", "seated", "up" and "free" (the seat is over: it has stood up, was unlinked or released)
      const SIT_NAMES = ["free", "down", "seated", "up"];
      function sit_forget(st) {                                                                         // the page forgets a world seat (not the worker's: that is the caller's)
        const k = seat_state.sitters.indexOf(st);
        if (k >= 0) seat_state.sitters.splice(k, 1);
        if (st.c.seated === st) { st.c.seated = null; if (st.c.link && st.c.link.world_seat) st.c.link = null; }
      }
      function sit_point(v, what) {                                                                     // [x, y, z] of numbers, a metre at most 100 km from the origin (the worker refuses more)
        if (!Array.isArray(v) || v.length !== 3 || !v.every(function (x) { return typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 1e5; })) fail(what + " is [x, y, z] (numbers, at most 100 km)");
        return v.slice();
      }
      function sit_pair(o, what) {
        if (!o || typeof o !== "object" || Array.isArray(o)) fail(what + " is { left: [x, y, z], right: [x, y, z] }");
        only_keys(o, ["left", "right"], what);
        return sit_point(o.left, what + ".left").concat(sit_point(o.right, what + ".right"));
      }
      function sit_words(sp, c, flags, x, y, z, yaw, dur, floor, feet) {
        q_begin(17); q_u(CMD_HAPPY_SIT); q_u(sp.js_id); q_u(c.slot); q_u(c.gen); q_u(flags);
        q_f(x); q_f(y); q_f(z); q_f(yaw); q_f(dur); q_f(floor);
        for (let k = 0; k < 6; k++) q_f(feet ? feet[k] : 0);
      }
      SP.sit = function (c, o) {
        if (!is_live(this, c)) return false;
        if (!o || typeof o !== "object" || Array.isArray(o)) fail("sit: options are { at, yaw, dur, floor, feet }");
        only_keys(o, ["at", "yaw", "dur", "floor", "feet"], "sit");
        hips_of(this);                                                                                  // (throws for a creature with no legs: it sits on its legs' chains)
        const at = sit_point(o.at, "sit: at"), yaw = o.yaw === undefined ? 0 : fin(o.yaw, "sit: yaw"), dur = o.dur === undefined ? 0.9 : fin(o.dur, "sit: dur"), floor = fin(o.floor, "sit: floor (the world height of the floor its feet stand on)");
        if (Math.abs(yaw) > 6.4) fail("sit: yaw is radians (at most 6.4)");
        if (!(dur >= 0 && dur <= 30)) fail("sit: dur is seconds, 0 .. 30");
        if (Math.abs(floor) > 1e5) fail("sit: floor is metres (at most 100 km)");
        const feet = o.feet === undefined ? null : sit_pair(o.feet, "sit: feet");
        sit_words(this, c, feet ? 1 : 0, at[0], at[1], at[2], yaw, dur, floor, feet);
        if (c.link && c.link.leader && c.link.leader.followers) c.link.leader.followers.delete(c);
        if (c.seated && c.seated.world) sit_forget(c.seated);
        c.link = { world_seat: true, leader: { followers: null } };                                      // (a leader that has no followers: sp.unlink and sp.release read it as they read a vehicle's)
        const st = { world: true, sp: this, c: c, anchor: at, yaw: yaw, floor: floor, phase: dur > 0 ? "down" : "seated", t: dur > 0 ? 0 : 1, dur: dur };
        c.seated = st;
        seat_state.sitters.push(st);
        seat_hook();
        return true;
      };
      SP.stand = function (c, o) {
        if (!is_live(this, c)) return false;
        const st = c.seated;
        if (!st || !st.world) return false;
        if (!o || typeof o !== "object" || Array.isArray(o)) fail("stand: options are { to, yaw, dur }");
        only_keys(o, ["to", "yaw", "dur"], "stand");
        const to = sit_point(o.to, "stand: to"), yaw = o.yaw === undefined ? st.yaw : fin(o.yaw, "stand: yaw"), dur = o.dur === undefined ? 0.8 : fin(o.dur, "stand: dur");
        if (Math.abs(yaw) > 6.4) fail("stand: yaw is radians (at most 6.4)");
        if (!(dur >= 0 && dur <= 30)) fail("stand: dur is seconds, 0 .. 30");
        sit_words(this, c, 2, to[0], to[1], to[2], yaw, dur, to[1], null);
        st.phase = "up"; st.t = 0; st.dur = dur;
        if (dur === 0) { sit_forget(st); st.phase = "free"; if (typeof this.on_sit === "function") this.on_sit(c, "free"); }          // (at once: the worker has put it at `to` and set it free)
        return true;
      };
      SP.sitting = function (c) {
        live_instance(this, c, "sitting");
        const st = c.seated;
        if (!st || !st.world) return null;
        const r = rider_rows(this, c), h = hips_of(this), v = quat_rot(r.q, [h[0] * r.s, h[1] * r.s, h[2] * r.s]);
        return { phase: st.phase, t: st.t, error: Math.hypot(r.p[0] + v[0] - st.anchor[0], r.p[1] + v[1] - st.anchor[1], r.p[2] + v[2] - st.anchor[2]) };
      };
      // the worker's event (HAPPY_EV_SIT 11: slot | generation << 16, the phase: 1 down, 2 seated, 3 up, 0 free). frame.js calls it
      system.on_sit_event = function (sp, a, b) {
        const slot = a & 0xffff, gen = a >>> 16;
        for (let k = 0; k < seat_state.sitters.length; k++) {
          const st = seat_state.sitters[k], c = st.c;
          if (st.sp !== sp || c.slot !== slot || c.gen !== gen) continue;
          if (c.seated !== st) { seat_state.sitters.splice(k, 1); return; }
          if (b === 0) { sit_forget(st); st.phase = "free"; }
          else { st.phase = SIT_NAMES[b] || st.phase; if (b === 2) st.t = 1; else st.t = 0; }
          if (typeof sp.on_sit === "function") sp.on_sit(c, SIT_NAMES[b] || "free");
          return;
        }
      };

      // ---- the frame: the doors on their way, the hands kept, the tasks of a rider that gets in or out ------------------------------------------------------------
      system.seat_frame = function (dt) {
        if (!(dt > 0)) dt = 1 / 60;
        dt = Math.min(dt, 0.1);
        for (let k = seat_state.doors.length - 1; k >= 0; k--) {
          const c = seat_state.doors[k], sp = c.species;
          if (!c || c.slot < 0 || !sp || sp.disposed || !sp.alive[c.slot] || sp.gen[c.slot] !== c.gen) { seat_state.doors.splice(k, 1); continue; }
          let moving = false;
          for (const n in c.doors) {
            const e = c.doors[n], d = sp.seat_defs.doors[n];
            if (e.frac === e.target) continue;
            const step = d.speed * dt / Math.abs(d.open);
            e.frac = e.target > e.frac ? Math.min(e.target, e.frac + step) : Math.max(e.target, e.frac - step);
            door_put(sp, c, d, e.frac);
            if (e.frac !== e.target) moving = true;
          }
          if (!moving) seat_state.doors.splice(k, 1);
        }
        for (let k = seat_state.riders.length - 1; k >= 0; k--) {
          const st = seat_state.riders[k], c = st.c;
          if (!c.link || !c.link.seat || c.slot < 0 || c.seated !== st) { seat_state.riders.splice(k, 1); continue; }
          if (++st.tick >= 12) { st.tick = 0; if (st.sp.life && st.sp.life.arms.length) seat_hands(st.sp, c, st); }
        }
        for (let k = seat_state.sitters.length - 1; k >= 0; k--) {                                          // (the riders on a seat of the world: the page counts the time of a blend; the worker pins them)
          const st = seat_state.sitters[k];
          if (st.c.seated !== st || !is_live(st.sp, st.c)) { seat_state.sitters.splice(k, 1); continue; }
          if (st.phase === "down" || st.phase === "up") st.t = st.dur > 0 ? Math.min(1, st.t + dt / st.dur) : 1;
        }
        for (let k = seat_state.tasks.length - 1; k >= 0; k--) {
          const T = seat_state.tasks[k];
          let done = false;
          try { done = T.step(dt); } catch (err) { T.state = "failed"; T.error = err; done = true; if (typeof T.fail === "function") T.fail(err); else if (typeof console !== "undefined") console.warn("system: " + T.kind + ": " + (err && err.message || err)); }
          if (done) seat_state.tasks.splice(k, 1);
        }
      };
      function task_add(T) { seat_state.tasks.push(T); seat_hook(); return T; }
      function alive_pair(a, b) { return is_live(a.sp, a.c) && is_live(b.sp, b.c); }

      // THE WAY TO THE DOOR: a rider that has to cross the vehicle to get to its door would walk into it (a vehicle is solid: the physics world's proxy). The vehicle's footprint is the union of the boxes of its `physics` (else a box
      // of its seats' and doors' places); the straight way from the rider to the door's place is tried against it (in the vehicle's own frame, grown by the rider's width): when it crosses, the rider goes round the nearer END of the vehicle,
      // along the side of the door, and in. The points are in the vehicle's model space (the vehicle may drive off meanwhile: they go with it)
      function vehicle_box(sp) {
        const out = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 }, ph = sp.input && sp.input.physics && sp.input.physics.shapes;
        if (Array.isArray(ph)) ph.forEach(function (h) { if (h.shape === "box" && h.center && h.half) { out.x0 = Math.min(out.x0, h.center[0] - h.half[0]); out.x1 = Math.max(out.x1, h.center[0] + h.half[0]); out.z0 = Math.min(out.z0, h.center[2] - h.half[2]); out.z1 = Math.max(out.z1, h.center[2] + h.half[2]); } });
        if (out.x0 > out.x1) { const d = sp.seat_defs; out.x0 = -1; out.x1 = 1; out.z0 = -2; out.z1 = 2; if (d) d.seat_names.forEach(function (n) { const a = d.seats[n].at; out.x0 = Math.min(out.x0, a[0] - 0.4); out.x1 = Math.max(out.x1, a[0] + 0.4); out.z0 = Math.min(out.z0, a[2] - 1); out.z1 = Math.max(out.z1, a[2] + 1); }); }
        return out;
      }
      function world_to_vehicle(sp, c, p) {                                                           // a world point -> the vehicle's model space (the root's turn undone, its scale divided)
        const r = rider_rows(sp, c), v = quat_rot([-r.q[0], -r.q[1], -r.q[2], r.q[3]], [p[0] - r.p[0], p[1] - r.p[1], p[2] - r.p[2]]);
        return [v[0] / r.s, v[1] / r.s, v[2] / r.s];
      }
      function hits_box(a, b, B) {                                                                    // does the segment a-b (x, z) cross the box? (Liang - Barsky)
        let t0 = 0, t1 = 1;
        const dx = b[0] - a[0], dz = b[2] - a[2], P = [-dx, dx, -dz, dz], Q = [a[0] - B.x0, B.x1 - a[0], a[2] - B.z0, B.z1 - a[2]];
        for (let i = 0; i < 4; i++) {
          if (P[i] === 0) { if (Q[i] < 0) return false; continue; }
          const t = Q[i] / P[i];
          if (P[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
        }
        return true;
      }
      function approach_route(vsp, vc, rsp, rc, stand) {
        const B = vehicle_box(vsp), m = 0.2, G = { x0: B.x0 - m, x1: B.x1 + m, z0: B.z0 - m, z1: B.z1 + m };
        if (stand[0] >= 0) G.x1 = Math.min(G.x1, stand[0] - 0.02); else G.x0 = Math.max(G.x0, stand[0] + 0.02);      // (the place beside a seat may be within the rider's width of the box: that is not a crossing)
        const s = world_to_vehicle(vsp, vc, rider_rows(rsp, rc).p);
        if (!hits_box(s, stand, G)) return [stand];
        const ze = s[2] < (G.z0 + G.z1) / 2 ? G.z0 - 1.2 : G.z1 + 1.2, side = stand[0] >= 0 ? 1 : -1, xs = Math.abs(s[0]) > G.x1 || s[0] < G.x0 ? (s[0] >= 0 ? Math.max(s[0], G.x1 + 0.6) : Math.min(s[0], G.x0 - 0.6)) : s[0];
        const route = [[xs, stand[1], ze], [side > 0 ? Math.max(stand[0], G.x1 + 0.3) : Math.min(stand[0], G.x0 - 0.3), stand[1], ze], stand];
        return route;
      }
      // system.enter: walk to the door, the door opens, sit, the door closes
      system.enter = function (rider_sp, rider_c, vehicle_sp, vehicle_c, o) {
        o = o || {};
        only_keys(o, ["seat", "speed", "on_done", "on_fail", "reach"], "enter");
        live_instance(rider_sp, rider_c, "enter");
        const defs = need_seats(vehicle_sp, "enter"), name = o.seat === undefined ? defs.seat_names[0] : o.seat, seat = defs.seats[name];
        if (!seat) throw new Error("system: enter: species '" + vehicle_sp.name + "' has no seat '" + name + "' (" + defs.seat_names.join(", ") + ")");
        const door = seat.door ? defs.doors[seat.door] : null, stand = door ? door.at : seat.board;
        if (!stand) throw new Error("system: enter: the seat '" + name + "' has no door and no `board` place to walk to: sp.seat puts a rider on it at once");
        const speed = o.speed === undefined ? 1.4 : fin(o.speed, "speed"), reach = o.reach === undefined ? 0.3 : fin(o.reach, "reach");
        const route = approach_route(vehicle_sp, vehicle_c, rider_sp, rider_c, stand);
        const T = { kind: "enter", state: "walk", leg: 0, route: route, rider: { sp: rider_sp, c: rider_c }, vehicle: { sp: vehicle_sp, c: vehicle_c }, seat: name, time: 0, done: false, error: null, fail: o.on_fail || null,
          cancel: function () { if (rider_c.slot >= 0) rider_sp.set_intent(rider_c, 0, 0); this.state = "cancelled"; this.cancelled = true; } };
        T.step = function (dt) {
          if (this.cancelled) return true;
          if (!alive_pair(this.rider, this.vehicle)) { this.state = "failed"; return true; }
          this.time += dt;
          const rsp = this.rider.sp, rc = this.rider.c, vsp = this.vehicle.sp, vc = this.vehicle.c;
          if (this.state === "walk") {
            // where the rider is: the page's rows when it is in sight, else (culled: the worker sends nothing of it) where the page counts it to be: its last place, the way on at the speed it was told, so a rider out of sight gets to the door too
            const last = this.leg === this.route.length - 1, door_at = vehicle_world(vsp, vc, this.route[this.leg]), R = rider_rows(rsp, rc), seen = seen_of(rsp, rc);
            if (seen || !this.est) this.est = R.p.slice();
            const dx = door_at[0] - this.est[0], dz = door_at[2] - this.est[2], d = Math.hypot(dx, dz);
            if (!last && d <= 0.7) { this.leg++; return false; }                                         // (a point on the way round the vehicle)
            if (d <= reach) {
              rsp.set_intent(rc, 0, 0);
              if (!seen) {                                                                                // (out of sight: it is put at the door's place, where it was counted to get to, facing the vehicle)
                const v = rider_rows(vsp, vc), yaw = Math.atan2(v.p[0] - door_at[0], v.p[2] - door_at[2]);
                rsp.set_root(rc, door_at[0], door_at[1], door_at[2], [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]);
              }
              if (!door) {                                                                                  // (no door: it sits on arrival)
                if (!rsp.seat(rc, vsp, vc, { seat: name })) { this.state = "failed"; return true; }
                this.state = "done"; if (typeof o.on_done === "function") o.on_done(this);
                return true;
              }
              this.state = "open"; vsp.door(vc, seat.door, true); return false;
            }
            if (this.time > 30) { rsp.set_intent(rc, 0, 0); this.state = "failed"; if (typeof o.on_fail === "function") o.on_fail(this); return true; }
            rsp.set_intent(rc, dx / d * speed, dz / d * speed);
            if (!seen) { const st = Math.min(d, speed * R.s * dt); this.est[0] += dx / d * st; this.est[2] += dz / d * st; }
            return false;
          }
          if (this.state === "open") {
            if (vsp.door_state(vc, seat.door) < 0.98) return false;
            if (!rsp.seat(rc, vsp, vc, { seat: name })) { this.state = "failed"; return true; }
            this.state = "close"; vsp.door(vc, seat.door, false);
            return false;
          }
          if (this.state === "close") {
            if (vsp.door_state(vc, seat.door) > 0.001) return false;
            this.state = "done";
            if (typeof o.on_done === "function") o.on_done(this);
            return true;
          }
          return true;
        };
        return task_add(T);
      };
      // system.leave: the door opens, the rider gets up outside it, the door closes
      system.leave = function (rider_sp, rider_c, o) {
        o = o || {};
        only_keys(o, ["on_done", "away"], "leave");
        live_instance(rider_sp, rider_c, "leave");
        const st = rider_c.seated;
        if (st && st.world) throw new Error("system: leave: the instance sits in the world, not on a vehicle: sp.stand gets it up");
        if (!st || !rider_c.link || !rider_c.link.seat) throw new Error("system: leave: the instance is not seated");
        const seat = st.seat, vsp = st.vsp, vc = st.vc, away = o.away === undefined ? 0.8 : fin(o.away, "away");
        if (!seat.door) {                                                                                 // (no door: it gets up at once)
          rider_sp.unseat(rider_c);
          const T0 = { kind: "leave", state: "done", rider: { sp: rider_sp, c: rider_c }, vehicle: { sp: vsp, c: vc }, seat: seat.name, time: 0, error: null, cancel: function () { } };
          if (typeof o.on_done === "function") o.on_done(T0);
          return T0;
        }
        vsp.door(vc, seat.door, true);
        const T = { kind: "leave", state: "open", rider: { sp: rider_sp, c: rider_c }, vehicle: { sp: vsp, c: vc }, seat: seat.name, time: 0, error: null, fail: null, cancelled: false, cancel: function () { this.cancelled = true; this.state = "cancelled"; } };
        T.step = function (dt) {
          if (this.cancelled) return true;
          if (!alive_pair(this.rider, this.vehicle)) { this.state = "failed"; return true; }
          this.time += dt;
          if (this.state === "open") {
            if (vsp.door_state(vc, seat.door) < 0.98) return false;
            rider_sp.unseat(rider_c);
            this.state = "away";
            return false;
          }
          if (this.state === "away") {                                                                  // (the door is shut when the rider is clear of it)
            const d = vehicle_world(vsp, vc, seat.exit || [0, 0, 0]), r = rider_rows(rider_sp, rider_c);
            if (this.time > 1.2 || Math.hypot(d[0] - r.p[0], d[2] - r.p[2]) > away) {
              vsp.door(vc, seat.door, false); this.state = "close";
            }
            return false;
          }
          if (this.state === "close") {
            if (vsp.door_state(vc, seat.door) > 0.001) return false;
            this.state = "done";
            if (typeof o.on_done === "function") o.on_done(this);
            return true;
          }
          return true;
        };
        return task_add(T);
      };

      // ========================================================================================================================
      // physics_api
      // ========================================================================================================================
// system.js, a part: the page's calls of the creature in the physics world (world.cpp): the mode of an instance, and the world's way with all the creatures. It is included after species.js (it adds to the species' methods).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system.
      // ---- the creature in the physics world: the page's calls ---------------------------------------------------------------------------------------------------------------------
      // the instance's proxy: "off" (none), "kinematic" (it pushes the world's dynamic bodies and the other creatures, nothing pushes it) or "dynamic" (it pushes them and they push it: the velocity of its body takes the
      // knock). The proxy is made, changed or freed by the next frame (a far instance has none); c.physics is what was asked for last (undefined: what the species' file says: sp.physics.mode), and the same mode again sends
      // nothing. Needs a species with `physics: { ... }`; "dynamic" needs a body (a creature that nothing moves cannot be pushed). sp.push(c, vx, vz, vy) is the shove (species.js)
      SP.set_physics = function (c, mode) {
        live_instance(this, c, "set_physics");
        if (!this.physics) throw new Error("system: set_physics: species '" + this.name + "' has no physics (physics: { shapes: [...] } or physics: true in its definition)");
        const m = typeof mode === "number" ? mode : PHYS_MODES.indexOf(mode);
        if (!(m === 0 || m === 1 || m === 2)) throw new Error("system: set_physics: mode must be one of " + PHYS_MODES.join(", ") + " (" + mode + ")");
        if (m === 2 && !this.body) throw new Error("system: set_physics: 'dynamic' needs a body (body: { ... }): a creature that nothing moves cannot be pushed");
        const now = c.physics === undefined ? this.physics.mode : c.physics;
        c.physics = PHYS_MODES[m];
        if (now === PHYS_MODES[m]) return true;
        q_begin(5); q_u(CMD_HAPPY_PHYS); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(m);
        return true;
      };
      // the physics world's way with the creatures, for all of them: { creatures: do the proxies have contacts with each other (default true), weight: the factor the dynamic proxies' masses are multiplied by, 0.001 .. 1000
      // (default 1) }. A creature's kilograms (its physics `mass`) are not a test bed's, where the boxes weigh a kilogram a cubic metre: a thrown ball would not move a creature of 70 kg, a weight of 0.03 makes it a
      // fair fight. No argument: what is set now.
      const world_physics = { creatures: true, weight: 1 };
      system.physics_world = function (o) {
        if (o !== undefined) {
          if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("system: physics_world needs an object { creatures, weight }");
          for (const k in o) if (k !== "creatures" && k !== "weight") throw new Error("system: physics_world: unknown field '" + k + "' (creatures, weight)");
          if (o.creatures !== undefined && typeof o.creatures !== "boolean") throw new Error("system: physics_world: creatures must be true or false (" + o.creatures + ")");
          if (o.weight !== undefined && (typeof o.weight !== "number" || !(o.weight >= 0.001) || !(o.weight <= 1000))) throw new Error("system: physics_world: weight must be a number from 0.001 to 1000 (" + o.weight + ")");
          const creatures = o.creatures === undefined ? world_physics.creatures : o.creatures, weight = o.weight === undefined ? world_physics.weight : o.weight;
          if (creatures !== world_physics.creatures || weight !== world_physics.weight) {
            if (!initialized) system.init({});
            q_begin(3); q_u(CMD_HAPPY_PHYS_SET); q_u(creatures ? 1 : 0); q_f(weight);
            world_physics.creatures = creatures; world_physics.weight = weight;
          }
        }
        return { creatures: world_physics.creatures, weight: world_physics.weight };
      };

      // ========================================================================================================================
      // human
      // ========================================================================================================================
// system.js, a part: the HUMAN of a creature: `human: { model: "lite", shape?, look?, wear?, hair?, gait?, ... }` in a definition makes a person of a few sliders: its skeleton, its rig, its roles, its legs and its skinned mesh,
// from ONE data file (the pack's `human.model`: the mesh, the weights, the macro model, the sliders). `model` may be left out: the lite human is the only one. Its modules are human.js.
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
//   system.build_human(x) -> Promise of x      system.human_made(x)      system.human_creature(x) -> Promise of the creature's plain definition (what system.species takes)      system.human(def, o) the same for a human def alone
//   system.human_info(def)   system.human_mutation(def)   system.human_lite (the module: sliders, shape, look, ...)   system.human_lite_model() -> Promise of the file, read   system.human_lite_people (the people as plain data)
      // ---- the modules of the lite human (human.js: packing modules, kept by name and made here, each with the ones it is made of) ----------------------------------------------------------------------------
      const human_libs = (function () { const libs = {}; const packing = function () { return function (name, factory) { libs[name] = factory; }; }; import("@/system/human.js"); return libs; })();
      const human_lite_parts = human_libs.human_lite_parts();
      const human_lite_look = human_libs.human_lite_look();
      const human_lite_mutate = human_libs.human_lite_mutate();
      const human_lite_wear = human_libs.human_lite_wear();
      const human_lite_hair = human_libs.human_lite_hair(human_lite_wear);
      const human_lite = human_libs.human_lite(human_lite_parts, human_lite_look, human_lite_mutate, human_lite_wear, human_lite_hair, null, null);      // (no skin module and no face shape here: a person is drawn from the palette)
      const human_lite_people = human_libs.human_lite_people();
      // Nothing is made until the first creature with a `human` asks (system.build_human): a species without one never reads a byte of the person's data.
      const human_made = new WeakMap(), human_texts = [], HUMAN_TEXTS = 8;
      // the roughness of a person's skin (the species' value of a human: human skin has a sheen, 0.8 is a matte cloth) and the names the rigs give the eyes (human_creature.js PROFILES: the eyeballs are 100 % on them)
      const HUMAN_SKIN_ROUGHNESS = 0.55;
      const HUMAN_EYE_BONES = ["eye.L", "eye.R", "mixamorig:LeftEye", "mixamorig:RightEye"];
      // the lite human is made offline of whatever it is given: its own checks run when it is built (human_lite.build); here only that the def is an object and that the model, when it is said, is the lite one
      function human_def_error(def, who) {
        const tag = "creature '" + who + "': human: ";
        if (!def || typeof def !== "object" || Array.isArray(def)) return tag + "the human is { model: \"lite\", shape, look, wear, hair, gait }";
        if (def.model !== undefined && def.model !== "lite") return tag + "model is \"lite\" (the only human there is) or left out";
        return null;
      }
      function style_names(input) {
        const names = [], g = input.human && input.human.gait, l = input.legs;
        names.push(g && g.walk ? g.walk : "person_walk");
        if (g && g.run) names.push(g.run);
        if (l && typeof l === "object") {
          [].concat(l.gait ? [l.gait] : [], l.gaits || []).forEach(function (x) { if (x && x.from) names.push(x.from); });
          if (typeof l.phases_from === "string") names.push(l.phases_from);
        }
        return names;
      }
      // the lite human is made offline of whatever it is given: a gait style that no library has, or that is not a biped's, is left out (the person's own walk) and said, not refused
      function lite_gait_check(d, who) {
        const g = d && d.gait; if (!g || typeof g !== "object" || Array.isArray(g)) return;
        ["walk", "run"].forEach(function (k) {
          if (g[k] === undefined) return;
          const st = typeof g[k] === "string" ? system.gaits.get(g[k]) : null;
          if (st && st.legs === 2) return;
          if (typeof console !== "undefined") console.warn("system: creature '" + who + "': human_lite: gait." + k + " " + JSON.stringify(g[k]) + " is " + (st ? "a style of " + st.legs + " legs, not a biped's" : "no gait style of the libraries") + ": left out");
          delete g[k];
        });
      }
      // the styles a def names (its walk and run, its legs' gaits) are in the page's registry before it is built: those that are not are looked up in the pack's index (which library has which style) and the library is put there
      // (system.use: the page's registry and the worker's). A host may give `system.gaits.resolve` (a node tool that reads the libraries from disk): it is asked first.
      function get_gaits(input) {
        const todo = style_names(input).filter(function (n) {
          if (system.gaits.get(n)) return false;
          if (typeof system.gaits.resolve === "function") system.gaits.resolve(n);
          return !system.gaits.get(n);
        });
        if (!todo.length || !system.pack) return Promise.resolve();
        return system.pack.tree("index.gaits").then(function (idx) {
          const libs = {};
          todo.forEach(function (n) { Object.keys(idx).some(function (lib) { if (idx[lib].indexOf(n) >= 0) { libs[lib] = true; return true; } return false; }); });
          const names = Object.keys(libs);
          return names.length ? system.use({ gaits: names, actions: [] }) : undefined;
        });
      }
      // the file of the lite human (the pack's `human.model`: the mesh, the weights, the macro model, the sliders): read once, when the first person is built
      let lite_model = null;
      function get_lite_model() {
        if (!lite_model) {
          lite_model = Promise.resolve().then(function () {
            if (!system.pack) throw new Error("load() the system first (system.load(url))");
            return system.pack.bytes("human.model");
          }).then(function (b) {
            const model = human_lite.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
            return model;
          }).catch(function (e) { lite_model = null; throw new Error("system: the file of the lite human could not be read from the pack (" + String(e && e.message !== undefined ? e.message : e) + ")"); });
        }
        return lite_model;
      }
      function merge_def(base, over) {
        if (over === undefined) return base;
        if (!base || !over || typeof base !== "object" || typeof over !== "object" || Array.isArray(base) || Array.isArray(over)) return over;
        const out = Object.assign({}, base);
        Object.keys(over).forEach(function (k) { out[k] = merge_def(out[k], over[k]); });
        return out;
      }
      function human_lookup(def) {
        if (!def || typeof def !== "object") return null;
        const h = human_made.get(def);
        if (h && h.made) return h.made;
        const key = JSON.stringify(def);
        for (let i = 0; i < human_texts.length; i++) if (human_texts[i].key === key) { const hit = human_texts.splice(i, 1)[0]; human_texts.unshift(hit); human_made.set(def, { made: hit.made }); return hit.made; }
        return null;
      }
      // makes the geometry of the humans of x -- an input { human, ... }, a creature file, or a list of them -- once for each def -> Promise of x. Nothing is done for what has no human, or has it made already
      system.build_human = function (x) {
        return Promise.all((Array.isArray(x) ? x : [x]).map(function (item) {
          if (!item || typeof item !== "object" || item.human === undefined || item.human === null) return null;
          const def = item.human, who = item.name || "system";
          return Promise.resolve().then(function () {
            const bad = human_def_error(def, who);
            if (bad) fail(bad);
            const known = human_lookup(def);
            if (known) return known;
            const pending = human_made.get(def);
            if (pending && pending.promise) return pending.promise;
            const key = JSON.stringify(def);
            const p = (Promise.all([get_lite_model(), get_gaits(item)]).then(function (r) { const dk = JSON.parse(key); lite_gait_check(dk, who); const lm = human_lite.build(r[0], dk, who); if (lm.notes.length && typeof console !== "undefined") lm.notes.forEach(function (n) { console.warn("system: " + n); }); return lm; })).then(function (made) {
              human_made.set(def, { made: made });
              human_texts.unshift({ key: key, made: made });
              if (human_texts.length > HUMAN_TEXTS) human_texts.pop();
              return made;
            }).catch(function (e) { human_made.delete(def); throw e; });
            human_made.set(def, { promise: p });
            return p;
          });
        })).then(function () { return x; });
      };
      // whether the geometry of the human of x is made: true for what has no human
      system.human_made = function (x) { return !x || typeof x !== "object" || x.human === undefined || x.human === null || !!human_lookup(x.human); };
      // the sections a creature file's own keys may say over the human's
      const HUMAN_SECTIONS = ["rig", "legs", "body", "roles", "traits", "physics"];
      // a creature input { human, name, legs?, roles? ... } whose human is made -> { input: the plain definition system.species takes, notes }: the system's skeleton, rig, roles, legs, body, physics and mesh, the creature's own over them
      function resolve_human(input) {
        const who = input.name || "system", bad = human_def_error(input.human, who);
        if (bad) fail(bad);
        const g = human_lookup(input.human), notes = [];
        if (!g) fail("creature '" + who + "': its human has not been made: system.build_human(input) makes it, asynchronously, before the species (system.human_creature does it and gives the plain definition)");
        if (input.mesh) notes.push("the human makes the mesh: the mesh that the creature has as well is not used");
        if (input.skeleton) notes.push("the human has bones: the skeleton that the creature has as well is not used");
        const out = Object.assign({}, input);
        delete out.human; delete out.sdf;
        out.skeleton = g.file.skeleton;
        HUMAN_SECTIONS.forEach(function (k) {
          const own = input[k] !== undefined ? input[k] : (input.system && input.system[k] !== undefined ? input.system[k] : undefined);
          if (own === false || own === null) { delete out[k]; return; }
          let base = g.file[k];
          if (base === undefined) { if (own !== undefined) out[k] = own; return; }
          if (k === "legs" && own && typeof own === "object") { base = Object.assign({}, base); if (own.gait !== undefined) delete base.gaits; if (own.gaits !== undefined) delete base.gait; }
          out[k] = merge_def(base, own);
        });
        if (g.file.tissue && g.file.tissue.length) out.tissue = input.tissue ? [].concat(input.tissue, g.file.tissue) : g.file.tissue.slice();     // (the lite human asks for the tissue bones of its fat, after the creature's own: system.species expands them)
        if (out.roles === undefined && input.traits === undefined) {                                                  // (no roles, nobody to play the traits or the upper body of a style)
          delete out.traits;
          if (out.legs && out.legs.gaits && !(input.legs && input.legs.gait)) out.legs = Object.assign({}, out.legs, { gaits: out.legs.gaits.map(function (g) { return g.upper === undefined || g.upper === false ? g : Object.assign({}, g, { upper: false }); }) });
        }
        if (out.system) { const s = Object.assign({}, out.system); HUMAN_SECTIONS.forEach(function (k) { delete s[k]; }); if (Object.keys(s).length) out.system = s; else delete out.system; }
        if (g.file.mesh) {
          out.mesh = g.file.mesh; human_of_mesh.set(g.file.mesh, g);
          // the material: the eyes are glossy and are the eye bones of the rig (sp.set_material("eyes") reaches the eyeballs, whatever the roles say); the skin's roughness is the species' (what the mesh's vertices do not say)
          const eyes = g.file.skeleton.map(function (b) { return b.name; }).filter(function (nm) { return HUMAN_EYE_BONES.indexOf(nm) >= 0; });
          out.material = Object.assign({ roughness: HUMAN_SKIN_ROUGHNESS, metal: 0 }, eyes.length ? { eyes_bones: eyes } : {}, g.skin ? { maps: g.skin.maps } : {}, { shader_extra: g.skin ? human_lite.SHADER_MAP : human_lite.SHADER }, input.material || {});            // (the lite human: the eyes drawn by its shader, the skin the vertex colours: no picture)
        } else delete out.mesh;
        return { input: out, notes: notes, made: g };
      }
      // the plain definition of a creature that is a human: made (asynchronously: the data is read the first time), the sections explicit, no `human` key left: what system.species and the lab take
      system.human_creature = function (input) {
        return system.build_human(input).then(function () { return resolve_human(input).input; });
      };
      system.human = function (def, o) { return system.human_creature(Object.assign({ name: "human" }, o || {}, { human: def })); };
      // a species of an input that has `human` (made by system.build_human) is the species of its plain definition
      const species_plain = system.species, human_of_mesh = new WeakMap();                  // (the mesh a human made is what a species of its plain definition knows it by: the lab copies the definition, the mesh is the same object)
      system.species = function (input, opts) {
        if (!input || typeof input !== "object" || input.human === undefined || input.human === null) {
          const sp = species_plain(input, opts), g = input && input.mesh ? human_of_mesh.get(input.mesh) : null;
          if (g) sp.human = g;
          return sp;
        }
        const r = resolve_human(input), sp = species_plain(r.input, opts);
        sp.human = r.made;
        r.notes.forEach(function (n) { sp.notes.push(n); if (typeof console !== "undefined") console.warn(n); });
        return sp;
      };
      // A species made AGAIN where it stands (a human whose slider moved): the same family id in the worker, so that its table is built again in the same place of the arena (the worker never gives a table back: a species made new
      // for every move of a slider would use it up in a few dozen); the page's resources of the old species go, its instances are gone (the page releases them BEFORE and spawns again after: the commands are in that order in the queue).
      // The old species leaves without a word to the worker: its DESTROY, queued by dispose, is taken out again (it would take the new family away)
      system.species_again = function (old, input, opts) {
        if (!old || typeof old !== "object" || old.disposed || !old.js_id) throw new Error("system: species_again takes a species that is not disposed");
        const id = old.js_id;
        old.dispose();
        if (qlen - qhead >= 3 && queue[qlen - 3] === 2 && queue[qlen - 2] === CMD_HAPPY_DESTROY && queue[qlen - 1] === id) qlen -= 3;
        const guid = engine.guid;
        engine.guid = function () { engine.guid = guid; return id; };                       // (the species' own js id, once: it is the first thing that species() asks of the engine's counter)
        let sp;
        try { sp = system.species(input, opts !== undefined ? opts : { mind: old.mind_on !== false }); } finally { engine.guid = guid; }
        if (sp.js_id !== id) throw new Error("system: species_again could not give the species the family it had");
        system.carry_material(old, sp);                                                         // (what the page set of its material holds for the species made again: draw.js, by selector)
        return sp;
      };
      // the lite human's modules, for the tools that make people (the sliders, the look, the dice, the clothes and the hair), its file, and its people as plain data
      system.human_lite_look = human_lite_look; system.human_lite_parts = human_lite_parts; system.human_lite_mutate = human_lite_mutate; system.human_lite_wear = human_lite_wear; system.human_lite_hair = human_lite_hair;
      system.human_lite = human_lite;                                                       // (the lite human's module: sliders, shape, look; system.human_lite_model() is its file, read)
      system.human_lite_model = function () { return get_lite_model(); };         // (the file of the lite human, read)
      system.human_lite_people = human_lite_people;                                         // (the people as plain data: records, edits, the human def a person makes)
      // what a human def made, once it is made (null before): { height, hips, leg, arm, vertices, triangles, parts, look } in metres
      system.human_mutation = function (def) { const g = human_lookup(def); return g && g.mutation ? g.mutation : null; };                  // (what the dice did to a lite human that was made: its kind, its tags, the mutations, the growth; null: it has none)
      system.human_info = function (def) { const g = human_lookup(def); return g ? { height: g.measure.height, hips: g.measure.hips, leg: g.measure.leg, arm: g.measure.arm, scale: g.measure.scale, vertices: g.vertices, triangles: g.triangles, parts: g.parts, hidden_triangles: g.hidden_triangles, look: g.look, ball_heel: g.ball_heel, dynamic: g.dynamic } : null; };
      // the geometry of whatever makes it: an sdf (the mesher) or a human (the human system)
      system.build_geometry = function (x) { return system.build_sdf(x).then(function () { return system.build_human(x); }); };
      system.geometry_made = function (x) { return system.sdf_made(x) && system.human_made(x); };

      // ========================================================================================================================
      // world
      // ========================================================================================================================
// system.js, a part: THE WORLD and its AI (world.js: the world's builder, its kit of things, its pieces of sdf, its blocks, its runtime and its host; the AI's blocks and clip sets are the pack's `blocks` and `clip_sets`).
// A creature that lives in a world has a MIND: a tree of BLOCKS (behaviours) that its worker function loads by name; the blocks are texts the worker registers (system.worker_modules). A world is a program (a JS text with a builder:
// w.add("chair", { pos, yaw })) that the host makes live: the physics bodies, the navigation map the worker bakes, the creatures it is given, the runtime's tick.
// It is not a module of its own: system.js includes it, in the middle of the closure that makes engine.system, after the human.
//   system.world(opts) -> host       opts: { fx, tolerant, rand, on_event, on_ready, verbose }       host.load({ world_text | world (a url), creatures: { name: creature file text | url }, creatures_for(spec), gaits: [library names], actions: [set names], name }) -> Promise<host>
//                                  host.start()  host.update(dt)  host.each_box(fn)  host.spawn(family, x, y, z, yaw)  host.hurt(h, damage)  host.where(h)  host.stats()  host.R  host.spec  host.nav  host.families
//   system.ai.blocks() -> Promise<{ index, sets, texts }>   the pack's blocks: the names, the ready-made minds (sets), the texts      system.ai.names() -> Promise<[name]>      system.ai.sets() -> Promise<{ sets }>
//   system.ai.use(names | "all") -> Promise<[name]>   the worker registers the blocks (a creature's worker function asks for them by name)      system.ai.clip_sets() -> Promise<index>   the clips a block needs, by species and pack, as system.ai.clips (the module) reads them
//   system.ai.clips   the clip sets' module (classify, resolve, pick ...)      system.creature_file_module()   the creature file's module (read and write a creature as text), made without the registry
//   system.make_creature(text, opts?) -> Promise<{ creature, def, sp }>   a creature file's text -> body -> species, nothing spawned (opts: name worker max_instances mind: true | { hz, far_hz, blocks, worker } | function (mind) -> mind: the file's AI blocks run, the file's mind with these over it, or edited by the function; world: false keeps the page's own worker world, a spec object installs that one, else an empty flat world is installed for the blocks to ask; modules: { block name: text | function (the pack's text) -> text } blocks of the page's own or the pack's changed; hit: true | { realism, zones ... } gives the species hit zones, what system.shoot and sp.impact find)
      const world_libs = (function () { const libs = {}; const packing = function () { return function (name, factory) { libs[name] = factory; }; }; import("@/system/world.js"); return libs; })();
      const creature_file_libs = (function () { const libs = {}; const packing = function () { return function (name, factory) { libs[name] = factory; }; }; import("@/system/creature_file.js"); return libs; })();
      let creature_file_mod = null;
      system.creature_file_module = function () { return creature_file_mod || (creature_file_mod = creature_file_libs.happy_creature_file()); };
      // system.make_creature(text, { name, worker, max_instances }) -> Promise<{ creature, def, sp }>: a creature file's text -> its body (a `human` part made first, an sdf built) -> the species. Nothing is spawned: sp.spawn({ x, y, z, scale, yaw }) up to max_instances times (default 1).
      // The file's family, abilities and mind are left out (it is a body, not a world). Each call makes a species of its own (a unique name); sp.dispose() takes it away. Rejects with the file's error.
      let make_creature_n = 0;
      system.make_creature = function (text, o) {
        o = o || {};
        let creature, def, cfg = null, blocks = [], agent = null;
        try {
          const CF = system.creature_file_module(); creature = CF.load(text);
          if (o.mind) {                                                                                     // the file's mind (or the file's with `o.mind` over it: { hz, far_hz, blocks, worker }): the compile makes the worker that loads the blocks, and the data it reads
            if (typeof o.mind === "function") creature.mind = o.mind(creature.mind) || creature.mind;      // (a function edits the file's own mind: change a block's settings, add a block, or give a whole new one)
            else if (o.mind !== true) creature.mind = Object.assign({}, creature.mind, o.mind);
            if (o.mind !== true) {
              const src = creature.mind && typeof creature.mind.worker === "function" ? Function.prototype.toString.call(creature.mind.worker) : "";
              if (src && !/^function\b/.test(src)) creature.mind.worker = new Function("return (function " + src.replace(/^[\w$]*\s*(?=\()/, "") + ")")();      // (a method, `worker(api, ld) { }`, as a bundler may write it: the compile wants the text to begin with `function`)
            }
            const comp = CF.compile(creature, { required: [], give: [] });
            def = comp.def; cfg = comp.cfg; agent = comp.agent;
            blocks = creature.mind.blocks.map(function (b) { return typeof b === "string" ? b : Array.isArray(b) ? b[0] : b.block; });
          } else def = CF.body_def(creature);
        } catch (e) { return Promise.reject(e); }
        def.name = (o.name || "mc" + (++make_creature_n) + "_" + creature.name); def.max_instances = o.max_instances || 1;
        if (o.worker) def.worker = o.worker;
        if (o.hit !== undefined) def.hit = o.hit;
        return (blocks.length ? system.ai.use(blocks) : Promise.resolve()).then(function () {            // (the worker registers the blocks before the species is made)
          if (!o.modules) return null;
          return system.ai.blocks().then(function (b) {                                                  // o.modules: { block name: text | function (the pack's text) -> text }: a block of the page's own, or the pack's block changed; registered after the pack's, so it wins
            const texts = {}; for (const n in o.modules) texts[n] = typeof o.modules[n] === "function" ? o.modules[n](b.texts[n]) : o.modules[n];
            system.worker_modules(texts);
          });
        }).then(function () {
          return def.human ? system.human_creature(def) : def;
        }).then(function (made) {
          made.name = def.name; made.max_instances = def.max_instances; if (o.worker) made.worker = o.worker; if (o.hit !== undefined) made.hit = o.hit;      // (set BEFORE build_sdf: a file with `tissue` is expanded once into a copy that the species is made of)
          return Promise.resolve(system.build_sdf(made)).then(function () { return made; });
        }).then(function (made) {
          if (cfg && o.world && typeof o.world === "object") system.worker_world(o.world, {});            // (the page's own spec: one world for several creatures)
          else if (cfg && o.world !== false) {                                                             // (the blocks ask the world things (zones, slots, nav): an EMPTY flat world of 64 m answers them; o.world: false when the page installed its own with system.worker_world)
            const agents = {}; if (agent) agents[agent.name] = { radius: agent.radius, height: agent.height, step: agent.step, slope: agent.slope, drop: agent.drop };
            system.worker_world({ format: "system-world", version: 1, name: "make_creature", nav: { cell: 0.25, bounds: [-32, -32, 32, 32], agents: agents, default_agent: "person" }, ground: { y: 0 }, terrain: {},
              boxes: [], stairs: [], ramps: [], links: [], doors: [], zones: [], scenes: [], entities: [], slots: [], bindings: [], spawn_rules: [], required_blocks: [], gives: [], block_params: {}, keys: [], relations: [], roles: [] }, {});
          }
          return { creature: creature, def: made, sp: cfg ? system.species(made, { cfg: cfg }) : system.species(made) };
        });
      };
      system.world = function (opts) { return world_libs.happy_world_host().create(engine, system, opts); };
      system.ai = (function () {
        const ai = {};
        let blocks = null, clips = null;
        const need = function () { if (!system.pack) throw new Error("system: load() the system first (system.load(url))"); return system.pack; };
        ai.blocks = function () { return blocks || (blocks = need().tree("blocks")); };
        ai.names = function () { return ai.blocks().then(function (b) { return b.index.slice(); }); };
        ai.sets = function () { return ai.blocks().then(function (b) { return b.sets; }); };
        ai.use = function (names) {
          return ai.blocks().then(function (b) {
            const all = Object.keys(b.texts), want = names === "all" ? all : [].concat(names || []), texts = {};
            want.forEach(function (n) { if (all.indexOf(n) < 0) throw new Error("system: ai.use: no block '" + n + "' in the pack (it has: " + all.join(", ") + ")"); texts[n] = b.texts[n]; });
            if (want.length) system.worker_modules(texts);
            return want;
          });
        };
        ai.clips = world_libs.happy_ai_clip_sets();
        ai.clip_sets = function () { return clips || (clips = need().tree("clip_sets").then(function (d) { return ai.clips.make(d); })); };
        return ai;
      })();

      // ========================================================================================================================
      // legs_api
      // ========================================================================================================================
// system.js, a part: the page's calls that take a leg from the gait (body.cpp, CMD_HAPPY_FOOT and CMD_HAPPY_KNEE) and what the body tells the page about its flight (a landing). It is included after species.js (it adds to the
// species' methods). It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system.
      // ---- a script's foot and knee: the page's calls ---------------------------------------------------------------------------------------------------------------
      //   sp.foot(c, leg, { cov, x, y, z })     leg `leg` (its number in sp.legs.legs, or its chain's name) goes to the place (x, y, z) in LEG LENGTHS from its hip as the gait has it, in the body's frame (x to the creature's LEFT, y up:
      //                                         -1 is straight down, z forward), as far as `cov` (0 .. 1, 1 when not said) says: 0 is the gait's foot again. The worker holds it 30 frames unless it is said again (a script that is gone lets
      //                                         the foot go by itself), `sp.foot(c, leg, { cov: 0 })` lets it go (it eases back where it was, 10 a second). A place beyond what the leg reaches is the leg stretched toward it; a foot is never put through the floor.
      //                                         The species needs legs (and `legs: { script: false }` leaves it no places for this)
      //   sp.knee(c, leg, { cov, angle })       the bend plane of the leg turned about the line from the hip to the foot by `angle` radians (+ out, for both sides), as far as `cov` says; held and let go the same way
      //   sp.landings(c)                        how many times the body has come down on the floor since the instance was made (a jump, a fall); sp.landing_speed(c): the speed it hit the ground at, world units / s
      SP.foot = function (c, leg, o) {
        live_instance(this, c, "foot");
        const k = leg_of(this, leg, "foot");
        o = o || {};
        for (const key in o) if (key !== "cov" && key !== "x" && key !== "y" && key !== "z") throw new Error("system: foot: unknown key '" + key + "' (cov, x, y, z)");
        const cov = o.cov === undefined ? 1 : fin(o.cov, "cov"), x = o.x === undefined ? 0 : fin(o.x, "x"), y = o.y === undefined ? -1 : fin(o.y, "y"), z = o.z === undefined ? 0 : fin(o.z, "z");
        if (Math.abs(x) > 10 || Math.abs(y) > 10 || Math.abs(z) > 10) throw new Error("system: foot: a place of at most 10 leg lengths from the hip");
        q_begin(9); q_u(CMD_HAPPY_FOOT); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(k); q_f(cov); q_f(x); q_f(y); q_f(z);
      };
      SP.knee = function (c, leg, o) {
        live_instance(this, c, "knee");
        const k = leg_of(this, leg, "knee");
        o = o || {};
        for (const key in o) if (key !== "cov" && key !== "angle") throw new Error("system: knee: unknown key '" + key + "' (cov, angle)");
        const cov = o.cov === undefined ? 1 : fin(o.cov, "cov"), angle = o.angle === undefined ? 0 : fin(o.angle, "angle");
        q_begin(7); q_u(CMD_HAPPY_KNEE); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(k); q_f(cov); q_f(angle);
      };
      function leg_of(sp, leg, what) {
        if (!sp.legs) throw new Error("system: " + what + ": species '" + sp.name + "' has no legs (the definition's `legs`)");
        if (!sp.legs.script) throw new Error("system: " + what + ": species '" + sp.name + "' was made with legs: { script: false }: its feet and knees are the gait's");
        const per = sp.legs.legs;
        const k = typeof leg === "number" ? leg : per.findIndex(function (p) { return p.name === leg; });
        if (!Number.isInteger(k) || k < 0 || k >= per.length) throw new Error("system: " + what + ": no leg '" + leg + "' in species '" + sp.name + "' (" + per.map(function (p) { return p.name; }).join(", ") + ")");
        return k;
      }
      SP.landings = function (c) { live_instance(this, c, "landings"); return this.lands ? this.lands[c.slot] : 0; };
      SP.landing_speed = function (c) { live_instance(this, c, "landing_speed"); return this.land_speed ? this.land_speed[c.slot] : 0; };
      // DUCKING UNDER A CEILING (body.cpp, CMD_HAPPY_DUCK; SYSTEM.md "Ducking under a ceiling"): a walker of the physics world ducks by itself under what is over its way (a beam, a lintel, a low ceiling that the props of the world
      // make; what its head touches, by rays: any body): it comes down as the ceiling comes near, in stages (the neck and the head nod first, then the trunk stoops, and only for a low ceiling do the knees bend) as far as it needs for its head to pass (a creature much higher than the thing walks across it), and a way that is lower than the most it can come down to stops it, like a wall. sp.duck(c, false) turns that off for an instance (it
      // walks through what is over it), sp.duck(c, true, { margin }) turns it on again; `margin` is how far its head stays under the ceiling, a share of its height (0 .. 0.3, 0.04 when not said)
      SP.duck = function (c, on, o) {
        live_instance(this, c, "duck"); need(this, "duck", "body");
        o = o || {};
        for (const key in o) if (key !== "margin") throw new Error("system: duck: unknown key '" + key + "' (margin)");
        const margin = o.margin === undefined ? 0.04 : fin(o.margin, "margin");
        if (margin < 0 || margin > 0.3) throw new Error("system: duck: margin is 0 .. 0.3 (a share of the creature's height that its head stays under the ceiling by)");
        q_begin(6); q_u(CMD_HAPPY_DUCK); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(on === false || on === 0 ? 0 : 1); q_f(margin);
      };
      // An ACTION DRIVES THE BODY: sp.drive(c, vx, vz) sets the velocity of an instance (world units a second) and holds it, with no acceleration, no top speed and no wish in the way (a dash, a lunge, the forward speed of a
      // leap: body.cpp, CMD_HAPPY_DRIVE); sp.drive(c, null) lets it go (the velocity then goes back to the wish at the body's acceleration). The same numbers again send nothing. c.driving is what was asked for last
      SP.drive = function (c, vx, vz) {
        live_instance(this, c, "drive"); need(this, "drive", "body");
        if (vx === null || vx === undefined) {
          if (!c.driving) return;
          c.driving = null;
          q_begin(7); q_u(CMD_HAPPY_DRIVE); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(0); q_f(0); q_f(0);
          return;
        }
        fin(vx, "vx"); fin(vz, "vz");
        if (Math.abs(vx) > 1e4 || Math.abs(vz) > 1e4) throw new Error("system: drive: a velocity of at most 10000 world units a second");
        const d = c.driving;
        if (d && d[0] === vx && d[1] === vz) return;
        c.driving = [vx, vz];
        q_begin(7); q_u(CMD_HAPPY_DRIVE); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(1); q_f(vx); q_f(vz);
      };
      // AN ACTION TAKES AN ARM'S HAND: sp.hand(c, arm, { x, y, z, w, body, pole, pole_w }) (body.cpp, CMD_HAPPY_HAND): arm `arm` (its number among sp.life.arms, or its chain's name) puts its hand at (x, y, z) in ARM LENGTHS
      // from the shoulder joint (x to the creature's LEFT, y up, z forward), as far as `w` (0 .. 1, 1 when not said) says: 0 is the arm's own hand again (it hangs, swings, goes where the gait's style says). The place is in the
      // (`turn: true` with the lean: the body's help is only its TURN, as far as 52 degrees, with a pitch and a roll of 10 at most: the bladed stance of a shooter's support arm, which brings the shoulder forward and does not bow the trunk)
      // TORSO's own frame, or in the BODY's (`body: true`: the creature's own heading, whatever its trunk does: the life turns the numbers back by the turn of the bones above the arm as they are, so the hand keeps the offset from
      // the shoulder that the numbers say). The life solves the arm in closed form, held to its joints: the spine takes no part, so a hand that cannot be reached falls short and the chest does not lean to reach it. `pole`: the
      // turn of the elbow about the line from the shoulder to the hand, radians, + out, as far as `pole_w` (1 when a pole is given) says, else the chain's own pole. The worker holds the hand 30 frames unless it is said again
      // (a page that is gone lets the arm go, eased out), `{ w: 0 }` lets it go (it eases out the same way)
      // THE WORLD REACH: sp.hand_world(c, arm, { x, y, z, w, lean, crouch, surface, pole, pole_w }) (body.cpp, CMD_HAPPY_HAND flags bit 1): arm `arm` puts its hand on the point (x, y, z) of the WORLD (metres) and keeps it there whatever the body does
      // (the walk, a turn), as far as `w` (0 .. 1, 1 when not said) says; `{ w: 0 }` lets it go. A point that is farther than the arm reaches is helped, when `lean` is not false, by the BODY: the spine leans (forward, to a side, a
      // turn: 55, 40 and 25 degrees at most) as far as it takes to bring the shoulder to 0.92 of the arm's length from it, and, when `crouch` is not false, the legs bend (the hips go down, up to 0.22 of the creature's size, the feet stay) for a point below the
      // shoulder; `surface: true`: the hand stops at the first surface between the shoulder and the point. AN ARM THAT CANNOT MAKE THE POINT STOPS TRYING: a point that the arm and what is left of the lean and the crouch cannot make (a prop
      // too far away) is not even begun, one that was tried and not made (the help ran out, or the arm's joints do not go there) is let go after a fifth of a second: the hand is its own again, the body stands upright, the state stays 3
      // (out of reach) and nothing is tried until the point is 0.08 of an arm nearer than it was (or it is another point). A layer of its own
      // over the arm's hand and an action's: the worker holds it 30 frames unless it is said again. sp.reach_state(c, arm) is the state the worker last told (0 none, 1 reaching, 2 on the point, 3 out of reach), and
      // sp.on_reach = function (c, arm, state) {} is called when it changes. Only a NEAR instance reaches (a far one's hands hang)
      SP.hand_world = function (c, arm, o) {
        live_instance(this, c, "hand_world");
        need_life(this, "hand_world");
        const arms = this.life.arms, j = typeof arm === "number" ? arm : arms.findIndex(function (a) { return a.name === arm; });
        if (!Number.isInteger(j) || j < 0 || j >= arms.length) throw new Error("system: hand_world: no arm '" + arm + "' in species '" + this.name + "' (" + (arms.length ? arms.map(function (a) { return a.name; }).join(", ") : "it has no arms: roles: { arms: [...] }") + ")");
        o = o || {};
        for (const key in o) if (["x", "y", "z", "w", "lean", "crouch", "surface", "turn", "pole", "pole_w"].indexOf(key) < 0) throw new Error("system: hand_world: unknown key '" + key + "' (x, y, z, w, lean, crouch, surface, turn, pole, pole_w)");
        const w = o.w === undefined ? 1 : fin(o.w, "w"), x = o.x === undefined ? 0 : fin(o.x, "x"), y = o.y === undefined ? 0 : fin(o.y, "y"), z = o.z === undefined ? 0 : fin(o.z, "z");
        if (Math.abs(x) > 1e6 || Math.abs(y) > 1e6 || Math.abs(z) > 1e6) throw new Error("system: hand_world: a point of at most a million world units from the origin");
        let pa = 0, pw = 0;
        if (o.pole !== undefined && o.pole !== null) { pa = fin(o.pole, "pole"); pw = o.pole_w === undefined ? 1 : fin(o.pole_w, "pole_w"); }
        q_begin(12); q_u(CMD_HAPPY_HAND); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(j); q_u(2 | (o.lean === false ? 0 : 4) | (o.surface ? 8 : 0) | (o.crouch === false ? 0 : 16) | (o.turn === true ? 32 : 0)); q_f(w); q_f(x); q_f(y); q_f(z); q_f(pa); q_f(pw);
      };
      SP.reach_state = function (c, arm) {
        live_instance(this, c, "reach_state");
        need_life(this, "reach_state");
        const na = this.life.arms.length, j = typeof arm === "number" ? arm : this.life.arms.findIndex(function (a) { return a.name === arm; });
        if (!Number.isInteger(j) || j < 0 || j >= na) throw new Error("system: reach_state: no arm '" + arm + "' in species '" + this.name + "'");
        return this.reach_st ? this.reach_st[c.slot * na + j] : 0;
      };
      SP.hand = function (c, arm, o) {
        live_instance(this, c, "hand");
        need_life(this, "hand");
        const arms = this.life.arms, j = typeof arm === "number" ? arm : arms.findIndex(function (a) { return a.name === arm; });
        if (!Number.isInteger(j) || j < 0 || j >= arms.length) throw new Error("system: hand: no arm '" + arm + "' in species '" + this.name + "' (" + (arms.length ? arms.map(function (a) { return a.name; }).join(", ") : "it has no arms: roles: { arms: [...] }") + ")");
        o = o || {};
        for (const key in o) if (["x", "y", "z", "w", "body", "pole", "pole_w"].indexOf(key) < 0) throw new Error("system: hand: unknown key '" + key + "' (x, y, z, w, body, pole, pole_w)");
        const w = o.w === undefined ? 1 : fin(o.w, "w"), x = o.x === undefined ? 0 : fin(o.x, "x"), y = o.y === undefined ? 0 : fin(o.y, "y"), z = o.z === undefined ? 0 : fin(o.z, "z");
        if (Math.abs(x) > 4 || Math.abs(y) > 4 || Math.abs(z) > 4) throw new Error("system: hand: a place of at most 4 arm lengths from the shoulder");
        let pa = 0, pw = 0;
        if (o.pole !== undefined && o.pole !== null) { pa = fin(o.pole, "pole"); pw = o.pole_w === undefined ? 1 : fin(o.pole_w, "pole_w"); }
        q_begin(12); q_u(CMD_HAPPY_HAND); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(j); q_u(o.body ? 1 : 0); q_f(w); q_f(x); q_f(y); q_f(z); q_f(pa); q_f(pw);
      };

      // ========================================================================================================================
      // ragdoll_api
      // ========================================================================================================================
// system.js, a part: the page's call that lets a creature fall (world.cpp, CMD_HAPPY_RAGDOLL). It is included after species.js (it adds to the species' methods). It is not a module of its own: system.js includes it, by the bundler's
// import directive, in the middle of the closure that makes engine.system.
      // ---- a creature that dies falls ------------------------------------------------------------------------------------------------------------------------
      //   sp.ragdoll(c, true, { velocity: [vx, vy, vz], dir: [dx, dz], push })     the body falls from the pose it has now, whatever its shape: a ragdoll of the physics world's own bodies and joints (a body for each bone of the rig's
      //                                         chains and one for the trunk, joined by the rig's joints, as thick as the skin) falls, lies on the floor and the props, and is the poses of the bones (held to the rig's joints) and the root (no word
      //                                         from the page after this one); it lies asleep and solid until something hits it. The world's `solver_iterations` (16) hold its joints better. `velocity` is the body's own speed (world units / s: it goes on a way),
      //                                         `dir` the way it falls (a push at what is high: the way it was hit; not said: the way it faces), `push` the speed of it (1.6 m/s). `ragdoll: false` in the creature's definition leaves
      //                                         it out: `sp.has_ragdoll` is false and the call throws
      //   sp.ragdoll(c, false)                  it stands again where it lies: the mover, the gait and the life have it back
      SP.ragdoll = function (c, on, o) {
        live_instance(this, c, "ragdoll");
        if (!this.has_ragdoll) throw new Error("system: ragdoll: species '" + this.name + "' has no ragdoll (`ragdoll: false` leaves it out)");
        o = o || {};
        for (const key in o) if (["velocity", "dir", "push"].indexOf(key) < 0) throw new Error("system: ragdoll: unknown key '" + key + "' (velocity, dir, push)");
        const v = o.velocity || [0, 0, 0], d = o.dir || [0, 0];
        if (!Array.isArray(v) || v.length !== 3 || !Array.isArray(d) || d.length !== 2) throw new Error("system: ragdoll: velocity is [vx, vy, vz] and dir is [dx, dz]");
        q_begin(11); q_u(CMD_HAPPY_RAGDOLL); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(on === false ? 0 : 1);
        q_f(fin(v[0], "velocity")); q_f(fin(v[1], "velocity")); q_f(fin(v[2], "velocity")); q_f(fin(d[0], "dir")); q_f(fin(d[1], "dir")); q_f(o.push === undefined ? 0 : fin(o.push, "push"));
      };

      // ========================================================================================================================
      // hit_api
      // ========================================================================================================================
// system.js, a part: the page's calls of the hit zones (world.cpp): an impact on one creature, a hitscan from a muzzle, and what the worker tells back. It is included after species.js (it adds to the species' methods).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system.
      // ---- the hit zones: the page's calls ---------------------------------------------------------------------------------------------------------------------------------------
      //   sp.impact(c, { point: [x, y, z], dir: [dx, dy, dz], impulse, damage, zone })   an impact on one creature: `point` is where (world units), `dir` the way it travels, `impulse` the momentum in kg m/s (a pistol's bullet is about 3, a rifle's
      //                                         8, a blast's thousands: what shoves a body; with the creature's mass, strength and gain it is the shove and the kick of the trunk), `damage` what the zone's health loses (times the zone's worth and
      //                                         armor). `zone` is a kind ("head", "torso", "pelvis", "arm", "leg", "tail": the first of that kind), a number (the index in sp.hit.zones) or { kind, which } (the arm or the leg of that number); left out, it is the zone
      //                                         whose capsule the point is nearest to. Needs `hit` in the species' definition (sp.has_hit)
      //   system.shoot({ from: [x, y, z], dir: [dx, dy, dz], range, impulse, damage, shooter: { sp, c } })   a hitscan: the ray stops at the first prop of the physics world, the terrain or creature's hit zone that it meets, and the impact
      //                                         lands there. The shooter's own body is left out. range: 200 when not said. The worker answers with an event: system.last_shot = { distance, hit, js, slot, gen }
      //   system.on_shot(shot)   called for every hitscan that ended:  { distance, hit, js, slot, gen, sp }
      //   system.shoot(o, answer)   a hitscan of the page's own code (the thrown props' look ahead, runtime.js): `answer(shot)` is called with the shot and nobody else is told of it (system.last_shot, system.on_shot). The worker answers the shots in the order they
      //                         were asked, one answer each, so the page keeps the order of who asked
      //   system.on_hit(sp, c, zone, damage, health)   called for every impact that landed: zone is the index in sp.hit.zones, damage what the zone lost, health what it has left (0 .. 1)
      //   sp.zone_health(c)   the health of each zone of the instance as the last event said it (0 .. 1, an array of sp.hit.zones.length); sp.hits_taken(c) how many impacts it has had
      //   THE LIMBS (realism 2: `hit: { realism: 2 }`): a leg or an arm whose zone has lost health is a dumb appendage by its ALPHA (0 the gait's, 1 passive: the share of the zone's health that is lost, a twentieth either way aside)
      //   system.on_limb(sp, c, zone, state, alpha)   a limb's state changed: 0 whole, 1 hurt (alpha 0.1 or more), 2 disabled (0.9 or more), with a hysteresis; alpha is as it was then (0 .. 1)
      //   sp.limb_state(c)   the state of each zone as the last event said it (an array of sp.hit.zones.length, 0 for a zone that is no limb); sp.limb_alpha(c) the alpha it said
      //   sp.heal(c, { zone, amount })   health comes back: zone is a kind, an index, { kind, which } or left out (every zone), amount the health (left out: all of it); a limb's alpha eases back to the gait's
      //   system.on_heal(sp, c, zone, health)   a zone's health came back (heal, or the creature's own `heal`): health 0 .. 1
      const hit_zone_index = function (sp, zone, what) {
        const zs = sp.hit.zones;
        if (zone === undefined || zone === null) return 255;
        if (typeof zone === "number") { if (!Number.isInteger(zone) || zone < 0 || zone >= zs.length) throw new Error("system: " + what + ": zone " + zone + " is not one of the species' " + zs.length + " zones"); return zone; }
        const kind = typeof zone === "string" ? zone : zone.kind, which = typeof zone === "object" ? zone.which : undefined;
        for (let i = 0; i < zs.length; i++) if (zs[i].kind === kind && (which === undefined || zs[i].which === which)) return i;
        throw new Error("system: " + what + ": the species '" + sp.name + "' has no zone '" + kind + (which === undefined ? "" : " " + which) + "' (" + zs.map(function (z) { return z.kind + (z.kind === "arm" || z.kind === "leg" ? " " + z.which : ""); }).join(", ") + ")");
      };
      const hit_vec = function (v, what) {
        if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite)) throw new Error("system: " + what + " is [x, y, z]");
        return v;
      };
      const hit_nonneg = function (v, what, dflt) {
        if (v === undefined) return dflt;
        if (typeof v !== "number" || !(v >= 0) || !Number.isFinite(v)) throw new Error("system: " + what + " must be a number, 0 or more (" + v + ")");
        return v;
      };
      SP.impact = function (c, o) {
        live_instance(this, c, "impact");
        if (!this.has_hit) throw new Error("system: impact: species '" + this.name + "' has no hit zones (`hit: true` in its definition)");
        if (!o || typeof o !== "object") throw new Error("system: impact needs { point, dir, impulse, damage, zone }");
        for (const k in o) if (["point", "dir", "impulse", "damage", "zone"].indexOf(k) < 0) throw new Error("system: impact: unknown key '" + k + "' (point, dir, impulse, damage, zone)");
        const p = hit_vec(o.point, "impact: point"), d = hit_vec(o.dir, "impact: dir");
        if (!(Math.hypot(d[0], d[1], d[2]) > 1e-6)) throw new Error("system: impact: dir is the way the impact travels, not [0, 0, 0]");
        const impulse = hit_nonneg(o.impulse, "impact: impulse", 0), damage = hit_nonneg(o.damage, "impact: damage", 0), zone = hit_zone_index(this, o.zone, "impact");          // (every mistake is thrown before the first word of the command is queued)
        q_begin(13); q_u(CMD_HAPPY_IMPACT); q_u(this.js_id); q_u(c.slot); q_u(c.gen);
        q_f(p[0]); q_f(p[1]); q_f(p[2]); q_f(d[0]); q_f(d[1]); q_f(d[2]); q_f(impulse); q_f(damage); q_u(zone);
      };
      const shot_owners = [];                                                                                  // (who asked for each hitscan that is not answered yet: a function, or null for a call that wants system.on_shot)
      system.shoot = function (o, answer) {
        if (!o || typeof o !== "object") throw new Error("system: shoot needs { from, dir, range, impulse, damage, shooter }");
        for (const k in o) if (["from", "dir", "range", "impulse", "damage", "shooter"].indexOf(k) < 0) throw new Error("system: shoot: unknown key '" + k + "' (from, dir, range, impulse, damage, shooter)");
        const p = hit_vec(o.from, "shoot: from"), d = hit_vec(o.dir, "shoot: dir");
        if (!(Math.hypot(d[0], d[1], d[2]) > 1e-6)) throw new Error("system: shoot: dir is the way the shot travels, not [0, 0, 0]");
        const range = hit_nonneg(o.range, "shoot: range", 200);
        if (!(range > 0)) throw new Error("system: shoot: range must be more than 0");
        let sj = 0, ss = 0xffffffff, sg = 0;
        if (o.shooter) { live_instance(o.shooter.sp, o.shooter.c, "shoot"); sj = o.shooter.sp.js_id; ss = o.shooter.c.slot; sg = o.shooter.c.gen; }
        const impulse = hit_nonneg(o.impulse, "shoot: impulse", 0), damage = hit_nonneg(o.damage, "shoot: damage", 0);
        if (!initialized) system.init({});
        q_begin(13); q_u(CMD_HAPPY_SHOT);
        q_f(p[0]); q_f(p[1]); q_f(p[2]); q_f(d[0]); q_f(d[1]); q_f(d[2]); q_f(range); q_f(impulse); q_f(damage); q_u(sj); q_u(ss); q_u(sg);
        shot_owners.push(typeof answer === "function" ? answer : null);
      };
      //   THE FALL (`hit` is not `fall: false`): a shove the creature cannot step out of brings it down as a ragdoll (a hurt leg does not: it is disabled and the posture follows); it lies `getup` seconds and stands
      //   system.on_fall(sp, c, state, cause, speed)   state 1: it went down, 0: it stood up; cause 1: a shove (the only one so far); speed the shove (m/s) it went down with
      //   sp.fallen(c)   true while the hit zones have it down (a creature the page made fall itself, sp.ragdoll(c, true), is not this one: it is the page's; sp.ragdoll(c, false) stands either)
      system.on_shot = null; system.on_hit = null; system.on_limb = null; system.on_heal = null; system.on_fall = null; system.last_shot = null;
      // the worker's events (frame.js calls these): HAPPY_EV_SHOT a hitscan ended, HAPPY_EV_HIT a zone took an impact
      system.hit_event_shot = function (sp, js, a, b) {
        const fv = new Float32Array(new Uint32Array([a]).buffer);
        const shot = { distance: fv[0], hit: b !== 0xffffffff, js: js, slot: b !== 0xffffffff ? b & 0xffff : -1, gen: b !== 0xffffffff ? b >>> 16 : -1, sp: sp || null };
        const who = shot_owners.length ? shot_owners.shift() : null;
        if (who !== null) { who(shot); return; }
        system.last_shot = shot;
        if (system.on_shot) system.on_shot(shot);
      };
      // the arrays of an instance's zones (health, limbs' states and alphas): made when the first event of the species comes, an instance whose slot was released and spawned again starts whole
      const hit_slot = function (sp, slot, gen) {
        const nz = sp.hit.zones.length;
        if (!sp.hit_health) { sp.hit_health = new Float32Array(sp.max_instances * nz).fill(1); sp.hit_count = new Uint32Array(sp.max_instances); sp.hit_gen = new Uint16Array(sp.max_instances).fill(0xffff); sp.limb_st = new Uint8Array(sp.max_instances * nz); sp.limb_al = new Float32Array(sp.max_instances * nz); }
        if (sp.hit_gen[slot] !== gen) { sp.hit_gen[slot] = gen; sp.hit_count[slot] = 0; for (let z = 0; z < nz; z++) { sp.hit_health[slot * nz + z] = 1; sp.limb_st[slot * nz + z] = 0; sp.limb_al[slot * nz + z] = 0; } }
      };
      system.hit_event_limb = function (sp, a, b) {
        if (!sp || !sp.hit) return;
        const slot = a & 0xffff, gen = a >>> 16;
        if (slot >= sp.max_instances || !sp.alive[slot] || sp.gen[slot] !== gen) return;
        const nz = sp.hit.zones.length, zone = b & 255, state = (b >>> 8) & 255, alpha = ((b >>> 16) & 255) / 255;
        if (zone >= nz) return;
        hit_slot(sp, slot, gen);
        sp.limb_st[slot * nz + zone] = state; sp.limb_al[slot * nz + zone] = alpha;
        if (system.on_limb) system.on_limb(sp, { slot: slot, gen: gen }, zone, state, alpha);
      };
      system.hit_event_fall = function (sp, a, b) {
        if (!sp || !sp.hit) return;
        const slot = a & 0xffff, gen = a >>> 16;
        if (slot >= sp.max_instances || !sp.alive[slot] || sp.gen[slot] !== gen) return;
        const state = b & 255, cause = (b >>> 8) & 255, speed = ((b >>> 16) & 255) / 10;
        if (!sp.fall_st) { sp.fall_st = new Uint8Array(sp.max_instances); sp.fall_gen = new Uint16Array(sp.max_instances); }
        sp.fall_st[slot] = state; sp.fall_gen[slot] = gen;
        if (system.on_fall) system.on_fall(sp, { slot: slot, gen: gen }, state, cause, speed);
      };
      system.hit_event_hit = function (sp, a, b) {
        if (!sp || !sp.hit) return;
        const slot = a & 0xffff, gen = a >>> 16;
        if (slot >= sp.max_instances || !sp.alive[slot] || sp.gen[slot] !== gen) return;
        const nz = sp.hit.zones.length, heal = (b & 0x80) !== 0, zone = b & 0x7f, damage = heal ? 0 : ((b >>> 8) & 0xffff) / 10, health = (b >>> 24) / 255;          // (bit 7 of the zone: it is a healing, not an impact)
        if (zone >= nz) return;
        hit_slot(sp, slot, gen);
        sp.hit_health[slot * nz + zone] = health;
        if (!heal) sp.hit_count[slot]++;
        if (!heal && sp.fx) system.fx_fire(sp, slot, 1, damage);                                                // (what a hit throws up: runtime.js)
        if (heal) { if (system.on_heal) system.on_heal(sp, { slot: slot, gen: gen }, zone, health); }
        else if (system.on_hit) system.on_hit(sp, { slot: slot, gen: gen }, zone, damage, health);
      };
      SP.fallen = function (c) {
        live_instance(this, c, "fallen");
        if (!this.has_hit) throw new Error("system: fallen: species '" + this.name + "' has no hit zones");
        return !!(this.fall_st && this.fall_gen[c.slot] === c.gen && this.fall_st[c.slot] === 1);          // (a slot released and spawned again is up)
      };
      SP.limb_state = function (c) {
        live_instance(this, c, "limb_state");
        if (!this.has_hit) throw new Error("system: limb_state: species '" + this.name + "' has no hit zones");
        const nz = this.hit.zones.length, out = new Array(nz).fill(0);
        if (this.limb_st && this.hit_gen[c.slot] === c.gen) for (let z = 0; z < nz; z++) out[z] = this.limb_st[c.slot * nz + z];
        return out;
      };
      SP.limb_alpha = function (c) {
        live_instance(this, c, "limb_alpha");
        if (!this.has_hit) throw new Error("system: limb_alpha: species '" + this.name + "' has no hit zones");
        const nz = this.hit.zones.length, out = new Array(nz).fill(0);
        if (this.limb_al && this.hit_gen[c.slot] === c.gen) for (let z = 0; z < nz; z++) out[z] = this.limb_al[c.slot * nz + z];
        return out;
      };
      SP.heal = function (c, o) {
        live_instance(this, c, "heal");
        if (!this.has_hit) throw new Error("system: heal: species '" + this.name + "' has no hit zones (`hit: true` in its definition)");
        const q = o === undefined ? {} : o;
        if (q === null || typeof q !== "object") throw new Error("system: heal needs { zone, amount } or nothing");
        for (const k in q) if (["zone", "amount"].indexOf(k) < 0) throw new Error("system: heal: unknown key '" + k + "' (zone, amount)");
        const zone = hit_zone_index(this, q.zone, "heal"), amount = hit_nonneg(q.amount, "heal: amount", 1.0e9);
        q_begin(6); q_u(CMD_HAPPY_HEAL); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(zone); q_f(amount);
      };
      SP.zone_health = function (c) {
        live_instance(this, c, "zone_health");
        if (!this.has_hit) throw new Error("system: zone_health: species '" + this.name + "' has no hit zones");
        const nz = this.hit.zones.length, out = new Array(nz).fill(1);
        if (this.hit_health && this.hit_gen[c.slot] === c.gen) for (let z = 0; z < nz; z++) out[z] = this.hit_health[c.slot * nz + z];
        return out;
      };
      SP.hits_taken = function (c) { live_instance(this, c, "hits_taken"); return this.hit_count && this.hit_gen[c.slot] === c.gen ? this.hit_count[c.slot] : 0; };

      // ========================================================================================================================
      // flip_api
      // ========================================================================================================================
// system.js, a part: the page's calls of the VEHICLE'S ROLLOVER (world.cpp "THE ROLLOVER", SYSTEM.md "The rollover"): an impact on a vehicle, whether it has rolled over, and righting it. It is included after hit_api.js (it takes the
// impact of a species that has no hit zones, and uses hit_api.js's argument checks).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system.
      // ---- the rollover: the page's calls ---------------------------------------------------------------------------------------------------------------------------------
      //   sp.impact(c, { point: [x, y, z], dir: [dx, dy, dz], impulse, damage })   on a VEHICLE (a species with `vehicle` and no hit zones): a blast, a shot, a thrown crate: the impulse (kg m/s) over the vehicle's mass (its physics section's) is
      //                                         a velocity change along `dir`, at `point`. What the tyres hold (under 1.5 g of its weight across its nose) is a skid; a blow from the side that gives it more than its weight can lift over its outer wheels'
      //                                         edge TIPS it, and it rolls over (SYSTEM.md "The rollover"). `damage` is the health block's, the worker does nothing with it. A creature with hit zones is still sp.impact of species.js
      //   sp.flipped(c)    where the vehicle is as the last event said: 0 on its wheels, 1 rolling, 2 a wreck on its side, 3 a wreck on its roof
      //   sp.right(c)      sets a vehicle that has rolled over (or still rolls) on its wheels again: it turns to them and comes down in a second. A definition's `flip: { recover }` does it by itself after that many seconds
      //   system.on_flip(sp, c, state, turns)    called when the state changes: 1 it began to roll, 2 / 3 it lies on its side / roof, 0 it is on its wheels again (after a roll that came back, or righted); turns: the quarter turns it made
      const flip_impact = SP.impact;
      SP.impact = function (c, o) {
        if (this.has_hit || !this.vehicle || this.aircraft) return flip_impact.call(this, c, o);
        live_instance(this, c, "impact");
        if (!o || typeof o !== "object") throw new Error("system: impact needs { point, dir, impulse, damage }");
        for (const k in o) if (["point", "dir", "impulse", "damage"].indexOf(k) < 0) throw new Error("system: impact: unknown key '" + k + "' (point, dir, impulse, damage: a vehicle has no zones)");
        const p = hit_vec(o.point, "impact: point"), d = hit_vec(o.dir, "impact: dir");
        if (!(Math.hypot(d[0], d[1], d[2]) > 1e-6)) throw new Error("system: impact: dir is the way the impact travels, not [0, 0, 0]");
        const impulse = hit_nonneg(o.impulse, "impact: impulse", 0), damage = hit_nonneg(o.damage, "impact: damage", 0);
        q_begin(13); q_u(CMD_HAPPY_IMPACT); q_u(this.js_id); q_u(c.slot); q_u(c.gen);
        q_f(p[0]); q_f(p[1]); q_f(p[2]); q_f(d[0]); q_f(d[1]); q_f(d[2]); q_f(impulse); q_f(damage); q_u(0);
      };
      SP.right = function (c) {
        live_instance(this, c, "right");
        if (!this.vehicle || this.aircraft) throw new Error("system: right: species '" + this.name + "' is not a vehicle");
        q_begin(13); q_u(CMD_HAPPY_IMPACT); q_u(this.js_id); q_u(c.slot); q_u(c.gen);
        q_f(0); q_f(0); q_f(0); q_f(0); q_f(1); q_f(0); q_f(0); q_f(0); q_u(0x200);                       // (the impact command's bit 9 of the zone word: set it on its wheels)
        if (this.flip_st && this.flip_gen[c.slot] === c.gen && this.flip_st[c.slot] !== 0) this.flip_st[c.slot] = 1;
      };
      SP.flipped = function (c) {
        live_instance(this, c, "flipped");
        return this.flip_st && this.flip_gen[c.slot] === c.gen ? this.flip_st[c.slot] : 0;
      };
      system.on_flip = null;
      // the worker's event (HAPPY_EV_FLIP 13: slot | generation << 16, state | quarter turns << 8). frame.js calls it
      system.flip_event = function (sp, a, b) {
        if (!sp || !sp.vehicle) return;
        const slot = a & 0xffff, gen = a >>> 16;
        if (slot >= sp.max_instances || !sp.alive[slot] || sp.gen[slot] !== gen) return;
        if (!sp.flip_st) { sp.flip_st = new Uint8Array(sp.max_instances); sp.flip_gen = new Uint16Array(sp.max_instances).fill(0xffff); }
        sp.flip_st[slot] = b & 255; sp.flip_gen[slot] = gen;
        if (system.on_flip) system.on_flip(sp, { slot: slot, gen: gen }, b & 255, (b >>> 8) & 255);
      };
      // THE TELEMETRY of a dynamic vehicle (`vehicle: { realism: true }`, world.cpp HAPPY_EV_VEHICLE 14): the engine's revs, the gear, the pedals and what the tyres do, about ten times a second
      //   sp.vehicle_state(c) -> null (not a dynamic vehicle, or nothing said yet) or { rpm, gear (-1 reverse, 0 neutral, 1 ... the gear it is in), throttle, brake (0 .. 1: what the engine and the brakes are asked), spinning (a driven wheel spins), locked (a wheel is locked under the brakes),
      //                     sliding (the tyres slide), airborne (a wheel is off the ground), speed (m/s along the nose), lateral (m/s across it), pitch / roll (rad of the sprung body: + nose down, + the left side up), yaw_rate (rad/s, + to the left), heave (m), age (seconds since it was said) }
      //   system.on_vehicle(sp, c, state)   called as each report comes
      system.on_vehicle = null;
      const veh_state = function (t) {
        return t ? { rpm: t.rpm, gear: t.gear, throttle: t.throttle, brake: t.brake, spinning: t.spinning, locked: t.locked, sliding: t.sliding, airborne: t.airborne, speed: t.speed, lateral: t.lateral, pitch: t.pitch, roll: t.roll, yaw_rate: t.yaw_rate, heave: t.heave, sim: t.sim || 0, age: (performance.now() - t.at) / 1000 } : null;
      };
      SP.vehicle_state = function (c) {
        live_instance(this, c, "vehicle_state");
        return veh_state(this.veh_tel && this.veh_gen[c.slot] === c.gen ? this.veh_tel[c.slot] : null);
      };
      system.vehicle_event = function (sp, a, b, kind) {
        if (!sp || !sp.vehicle) return;
        const slot = a & 0xffff, gen = a >>> 16;
        if (slot >= sp.max_instances || !sp.alive[slot] || sp.gen[slot] !== gen) return;
        if (!sp.veh_tel) { sp.veh_tel = new Array(sp.max_instances).fill(null); sp.veh_gen = new Uint16Array(sp.max_instances).fill(0xffff); }
        if (sp.veh_gen[slot] !== gen || !sp.veh_tel[slot]) { sp.veh_tel[slot] = { rpm: 0, gear: 0, throttle: 0, brake: 0, spinning: false, locked: false, sliding: false, airborne: false, speed: 0, lateral: 0, pitch: 0, roll: 0, yaw_rate: 0, heave: 0, sim: 0, at: performance.now() }; sp.veh_gen[slot] = gen; }
        const t = sp.veh_tel[slot], sb = function (v) { return v > 127 ? v - 256 : v; };
        if (kind === 15) { t.speed = ((b << 16) >> 16) / 100; t.lateral = (b >> 16) / 100; }
        else if (kind === 17) { t.sim = new Float32Array(new Uint32Array([b >>> 0]).buffer)[0]; return; }
        else if (kind === 16) { t.pitch = sb(b & 255) / 127 * 0.3; t.roll = sb((b >>> 8) & 255) / 127 * 0.35; t.yaw_rate = sb((b >>> 16) & 255) / 127 * 2; t.heave = sb((b >>> 24) & 255) / 127 * 0.3; return; }
        else { const bits = (b >>> 27) & 15; t.rpm = (b & 32767) * 2; t.gear = ((b >>> 15) & 15) - 1; t.throttle = ((b >>> 19) & 15) / 15; t.brake = ((b >>> 23) & 15) / 15; t.spinning = (bits & 1) !== 0; t.locked = (bits & 2) !== 0; t.sliding = (bits & 4) !== 0; t.airborne = (bits & 8) !== 0; t.at = performance.now(); }
        if (kind !== 14) return;
        if (system.on_vehicle) system.on_vehicle(sp, { slot: slot, gen: gen }, veh_state(t));
      };

      // ========================================================================================================================
      // grip_api
      // ========================================================================================================================
// system.js, a part: the page's calls of the GRIPS (world.cpp, CMD_HAPPY_GRIP) and sp.grab, the whole of picking a body up, carrying it, putting it down or throwing it. It is included after legs_api.js (it uses the world reach and the
// page's hand of that part). It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system.
      // ---- the calls ------------------------------------------------------------------------------------------------------------------------------------------------
      //   sp.grip(c, arm, body, { follow, curl })   arm `arm` (its number among sp.life.arms, or its chain's name) HOLDS `body`, a body of engine.phy (phy.body ...: the page's own, dynamic): from the next frame the worker puts it where the hand carries it (world.cpp),
      //                                at the offset it has from the hand now, so it does not jump. No gravity, no contacts with the carrier's own shapes and rays, it pushes what it is carried into. Two hands may hold one body (it is at the average of
      //                                what they say). `follow` (0 .. 1, 0 when not said): how much the HAND's own turn is the body's: 0 keeps it level and turned with the creature's heading (a crate), 1 makes it the hand's as a tool is (a sword,
      //                                a cup: the wrist and the arm turn it), between is a mix. `curl` (0 .. 1): how far the hand's fingers close on it (species.js: a creature with finger bones closes the hand when the worker says it
      //                                holds, and opens it when the grip is over; the default is 0.35 for a body held level, 0.8 for one the hand turns). Refused (the worker's event: system.rejected): a static body, a body another creature holds, a hand that holds something,
      //                                a body heavier than the creature (the worker says so as sp.on_grip state 3: it cannot lift it). What it holds is a LOAD: the mass of the bodies in its hands slows it (SYSTEM.md "Grips and carrying")
      //   sp.ungrip(c, arm?, { throw: [x, y, z], inherit })    the hand lets go (no arm, or "all": every arm of the instance): the body leaves with the hand's velocity (`inherit: false`: it does not) plus `throw` (world units / s)
      //   sp.gripping(c, arm) -> the body or null      sp.on_grip = function (c, arm, state) {}   state 1 holding, 0 let go by the page, 2 ended by itself (the carrier is gone, the body was taken out of the world), 3 refused: too heavy to lift
      //   sp.grip_refused(c, arm) -> true when the last grip of that arm was refused for the weight of the body
      SP.grip = function (c, arm, body, o) {
        live_instance(this, c, "grip");
        need_life(this, "grip");
        const j = grip_arm(this, arm, "grip");
        if (!body || typeof body !== "object" || !Number.isInteger(body.uuid)) throw new Error("system: grip: the body is a body of engine.phy (phy.body({ ... }): it has a uuid)");
        o = o || {};
        for (const key in o) if (key !== "follow" && key !== "curl") throw new Error("system: grip: unknown key '" + key + "' (follow, curl)");
        const follow = o.follow === undefined ? 0 : fin(o.follow, "follow");
        if (follow < 0 || follow > 1) throw new Error("system: grip: follow is 0 .. 1 (0: the body follows the creature's heading, level; 1: the hand's own turn)");
        if (o.curl !== undefined && (fin(o.curl, "curl") < 0 || o.curl > 1)) throw new Error("system: grip: curl is 0 (an open hand) .. 1 (a fist)");
        q_begin(11); q_u(CMD_HAPPY_GRIP); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(j); q_u(1); q_u(body.uuid); q_f(follow); q_f(0); q_f(0); q_u(0);
        const na = this.life.arms.length;
        if (!this.grip_body) { this.grip_body = new Array(this.max_instances * na); this.grip_st = new Uint8Array(this.max_instances * na); }
        if (this.grip_no) this.grip_no[c.slot * na + j] = 0;
        this.grip_body[c.slot * na + j] = body;
        if (system.grip_curl_of) system.grip_curl_of(this, c, j, follow, o.curl);
      };
      SP.grip_refused = function (c, arm) {
        live_instance(this, c, "grip_refused");
        need_life(this, "grip_refused");
        const j = grip_arm(this, arm, "grip_refused");
        return !!(this.grip_no && this.grip_no[c.slot * this.life.arms.length + j] === 1);
      };
      SP.ungrip = function (c, arm, o) {
        live_instance(this, c, "ungrip");
        need_life(this, "ungrip");
        o = o || {};
        for (const key in o) if (key !== "throw" && key !== "inherit") throw new Error("system: ungrip: unknown key '" + key + "' (throw, inherit)");
        const j = arm === undefined || arm === null || arm === "all" ? 255 : grip_arm(this, arm, "ungrip");
        const t = o.throw === undefined || o.throw === null ? [0, 0, 0] : o.throw;
        if (!Array.isArray(t) || t.length !== 3) throw new Error("system: ungrip: throw is [x, y, z] (world units a second)");
        fin(t[0], "throw[0]"); fin(t[1], "throw[1]"); fin(t[2], "throw[2]");
        if (Math.abs(t[0]) > 1e3 || Math.abs(t[1]) > 1e3 || Math.abs(t[2]) > 1e3) throw new Error("system: ungrip: a throw of at most 1000 world units a second");
        q_begin(11); q_u(CMD_HAPPY_GRIP); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(j); q_u(2); q_u(0); q_f(t[0]); q_f(t[1]); q_f(t[2]); q_u(o.inherit === false ? 1 : 0);
      };
      SP.gripping = function (c, arm) {
        live_instance(this, c, "gripping");
        need_life(this, "gripping");
        const j = grip_arm(this, arm, "gripping");
        return this.grip_body && this.grip_st[c.slot * this.life.arms.length + j] === 1 ? this.grip_body[c.slot * this.life.arms.length + j] || null : null;
      };
      // ---- HOW A BODY IS HELD (world.cpp, CMD_HAPPY_HOLD; SYSTEM.md "Holding things"): said after sp.grip, to the arm that holds
      //   sp.hold_pose(c, arm, off, rot)   the body goes (eased, 5 a second) to this pose: `off` its centre from the hand, [x, y, z] in the creature's frame (x to its left, y up, z forward), `rot` its turn there as a rotation vector
      //                                    (the axis times the angle, radians): a sword that points up and forward whatever the wrist does. The hand stops following its own turn
      //   sp.hold_hang(c, arm, length, damping)   the body HANGS from the hand on a pendulum `length` metres long (damping 1 / s, 0 .. 20) and swings with what the hand does; its rest place is sp.hold_pose's `off` (straight under the hand)
      //   sp.hold_line(c, arm, at, up)     this hand is one of the two that hold a LONG body: `at` where on the body it holds it, `up` the body's own up, both in its frame; the body lies along the line between the hands
      //   sp.hold_rigid(c, arm)            the plain offset and turn again
      //   sp.mount(c, id, body, { bone, off, rot })   the body RIDES on a bone (a holster, a sling, a shoulder, a back): mount `id` (0 .. 15), `bone` its name or number, `off` its centre from the bone's head and `rot` its turn (a rotation
      //                                    vector), both in the BONE's frame; it goes there from where it is (eased), carried with the bone; it is a load of the creature (the posture balances it). A body that is in a hand is taken by the bone
      //   sp.unmount(c, id)                the bone lets go (it falls)         sp.mounted(c, id) -> the body last mounted there, or null (what the page said: a hand that takes the body ends the mount)
      function hold_words(sp, c, arm, op, v, what) {
        live_instance(sp, c, what);
        need_life(sp, what);
        const j = typeof arm === "number" && arm >= 16 ? arm : grip_arm(sp, arm, what);
        for (let k = 0; k < 6; k++) fin(v[k], what + ": number " + k);
        q_begin(12); q_u(CMD_HAPPY_HOLD); q_u(sp.js_id); q_u(c.slot); q_u(c.gen); q_u(j); q_u(op); for (let k = 0; k < 6; k++) q_f(v[k]);
      }
      function vec3(v, what) { if (!Array.isArray(v) || v.length !== 3) throw new Error("system: " + what + " is [x, y, z]"); return v; }
      SP.hold_pose = function (c, arm, off, rot) { vec3(off, "hold_pose: off"); vec3(rot, "hold_pose: rot"); hold_words(this, c, arm, 1, [off[0], off[1], off[2], rot[0], rot[1], rot[2]], "hold_pose"); };
      SP.hold_hang = function (c, arm, length, damping) {
        fin(length, "length"); fin(damping, "damping");
        if (length < 0.02 || length > 20) throw new Error("system: hold_hang: length is 0.02 .. 20 metres");
        if (damping < 0 || damping > 20) throw new Error("system: hold_hang: damping is 0 .. 20 (1 / s)");
        hold_words(this, c, arm, 2, [length, damping, 0, 0, 0, 0], "hold_hang");
      };
      SP.hold_line = function (c, arm, at, up) { vec3(at, "hold_line: at"); vec3(up, "hold_line: up"); hold_words(this, c, arm, 3, [at[0], at[1], at[2], up[0], up[1], up[2]], "hold_line"); };
      SP.hold_rigid = function (c, arm) { hold_words(this, c, arm, 4, [0, 0, 0, 0, 0, 0], "hold_rigid"); };
      SP.mount = function (c, id, body, o) {
        live_instance(this, c, "mount");
        if (!Number.isInteger(id) || id < 0 || id > 15) throw new Error("system: mount: the id is 0 .. 15");
        if (!body || typeof body !== "object" || !Number.isInteger(body.uuid)) throw new Error("system: mount: the body is a body of engine.phy (it has a uuid)");
        if (!o || typeof o !== "object") throw new Error("system: mount: { bone, off, rot } says where it rides");
        for (const key in o) if (key !== "bone" && key !== "off" && key !== "rot") throw new Error("system: mount: unknown key '" + key + "' (bone, off, rot)");
        const bone = typeof o.bone === "number" ? o.bone : this.sk.index[o.bone];
        if (!Number.isInteger(bone) || bone < 0) throw new Error("system: mount: no bone '" + o.bone + "' in species '" + this.name + "'");
        const off = o.off === undefined ? [0, 0, 0] : vec3(o.off, "mount: off"), rot = o.rot === undefined ? [0, 0, 0] : vec3(o.rot, "mount: rot");
        q_begin(11); q_u(CMD_HAPPY_GRIP); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(id); q_u(3); q_u(body.uuid); q_f(0); q_f(0); q_f(0); q_u(bone);
        hold_words(this, c, 16 + id, 1, [off[0], off[1], off[2], rot[0], rot[1], rot[2]], "mount");
        if (!this.mount_body) this.mount_body = new Array(this.max_instances * 16).fill(null);
        this.mount_body[c.slot * 16 + id] = body;
      };
      SP.unmount = function (c, id) {
        live_instance(this, c, "unmount");
        if (!Number.isInteger(id) || id < 0 || id > 15) throw new Error("system: unmount: the id is 0 .. 15");
        q_begin(11); q_u(CMD_HAPPY_GRIP); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(16 + id); q_u(2); q_u(0); q_f(0); q_f(0); q_f(0); q_u(1);
        if (this.mount_body) this.mount_body[c.slot * 16 + id] = null;
      };
      SP.mounted = function (c, id) { live_instance(this, c, "mounted"); return this.mount_body && this.mount_body[c.slot * 16 + id] || null; };

      // ---- a weight ON the creature that no hand holds ------------------------------------------------------------------------------------------------------------
      //   sp.wear(c, id, { kg, bone, at })   load `id` (0 .. 3: a creature wears up to four; the same id again replaces it) of `kg` kilograms rides on `bone` (a bone's name; null: the root, the model's origin) with its centre at `at` = [x, y, z],
      //                                metres in the model's axes in the bind pose (+x left, +y up, +z forward: [0, 1.38, -0.22] is a pack on a person's back). The worker carries it with the bone (world.cpp, CMD_HAPPY_WEAR) and
      //                                it is a load like a held body: the creature's mover keeps less of its strength, its legs take shorter steps and ride lower, and the life balances it (a pack behind the back leans a person forward).
      //                                It is not drawn: what shows is the page's (a mesh on the same bone). Refused (system.rejected): a creature with no body or no skeleton, a bone that is not there, a load of 0 or less
      //   sp.unwear(c, id?)              takes it off (no id, or "all": every load of the instance); it is taken off when the instance is released
      SP.wear = function (c, id, o) {
        live_instance(this, c, "wear");
        if (!Number.isInteger(id) || id < 0 || id > 3) throw new Error("system: wear: the id is 0 .. 3 (a creature wears up to four loads)");
        if (!o || typeof o !== "object") throw new Error("system: wear: { kg, bone, at } says what is worn");
        for (const key in o) if (key !== "kg" && key !== "bone" && key !== "at") throw new Error("system: wear: unknown key '" + key + "' (kg, bone, at)");
        const kg = fin(o.kg, "kg");
        if (!(kg > 0) || kg >= 1e5) throw new Error("system: wear: kg is the load's mass in kilograms, more than 0");
        const at = o.at;
        if (!Array.isArray(at) || at.length !== 3) throw new Error("system: wear: at is [x, y, z], metres in the model's axes in the bind pose");
        fin(at[0], "at[0]"); fin(at[1], "at[1]"); fin(at[2], "at[2]");
        if (Math.abs(at[0]) > 1e3 || Math.abs(at[1]) > 1e3 || Math.abs(at[2]) > 1e3) throw new Error("system: wear: a place within 1000 metres of the model's origin");
        let bone = 0xffffffff;
        if (o.bone !== undefined && o.bone !== null) {
          bone = this.sk.index[o.bone];
          if (!Number.isInteger(bone)) throw new Error("system: wear: no bone '" + o.bone + "' in species '" + this.name + "'");
        }
        q_begin(11); q_u(CMD_HAPPY_WEAR); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(1); q_u(id); q_u(bone); q_f(at[0]); q_f(at[1]); q_f(at[2]); q_f(kg);
      };
      SP.unwear = function (c, id) {
        live_instance(this, c, "unwear");
        const all = id === undefined || id === null || id === "all";
        if (!all && (!Number.isInteger(id) || id < 0 || id > 3)) throw new Error("system: unwear: the id is 0 .. 3, or none for every load");
        q_begin(11); q_u(CMD_HAPPY_WEAR); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(2); q_u(all ? 255 : id); q_u(0); q_f(0); q_f(0); q_f(0); q_f(0);
      };
      function grip_arm(sp, arm, what) {
        const arms = sp.life.arms, j = typeof arm === "number" ? arm : arms.findIndex(function (a) { return a.name === arm; });
        if (!Number.isInteger(j) || j < 0 || j >= arms.length) throw new Error("system: " + what + ": no arm '" + arm + "' in species '" + sp.name + "' (" + (arms.length ? arms.map(function (a) { return a.name; }).join(", ") : "it has no arms: roles: { arms: [...] }") + ")");
        return j;
      }
      // the worker's event (HAPPY_EV_GRIP 7: slot | generation << 16, arm << 8 | state): the table the page keeps and sp.on_grip. frame.js calls it
      system.on_grip_event = function (sp, a, b) {
        const slot = a & 0xffff, na = sp && sp.life && sp.life.arms ? sp.life.arms.length : 0, arm = b >>> 8, st = b & 255;
        if (!na || arm >= na || slot >= sp.max_instances || !sp.alive[slot] || sp.gen[slot] !== (a >>> 16)) return;
        if (!sp.grip_body) { sp.grip_body = new Array(sp.max_instances * na); sp.grip_st = new Uint8Array(sp.max_instances * na); }
        if (!sp.grip_no) sp.grip_no = new Uint8Array(sp.max_instances * na);
        sp.grip_no[slot * na + arm] = st === 3 ? 1 : 0;                                               // (refused for its weight: the worker lifted nothing)
        sp.grip_st[slot * na + arm] = st === 1 ? 1 : 0;
        if (st !== 1) sp.grip_body[slot * na + arm] = null;
        if (st <= 2 && system.grip_fingers) system.grip_fingers(sp, slot, a >>> 16, arm, st);                // (a creature with fingers closes the hand when it holds and opens it when the grip is over)
        if (typeof sp.on_grip === "function") sp.on_grip({ slot: slot, gen: a >>> 16 }, arm, st);
      };

      // ---- sp.grab: reach, grip, lift, carry, put down, throw -----------------------------------------------------------------------------------------------------
      //   const t = sp.grab(c, body, { arms, half, lean, crouch, approach, follow, carry: { out, up, ahead }, timeout, on_done })
      //     arms    "both" (the default: one hand on each side of the body), "nearest", "left", "right", or a list of arm numbers
      //     half    the body's half size, metres: a number or [x, y, z] (0.25): the hands go to its sides, at its height; a crate's half edge
      //     approach  true: the creature WALKS UP to the body first (the wish is said at every frame, toward it and facing it, until the body's middle is 0.3 of the creature's size plus the body's half depth away; the creature's own brain must
      //               say no wish meanwhile: the lab's `stand` brain says none). It fails with `stuck` when it comes no nearer for three seconds, and with `timeout` after the task's seconds plus six
      //     follow  0 .. 1: how much the hand's own turn is the body's (sp.grip's follow; 0, the default, keeps a crate level)
      //     curl    0 .. 1: how far the fingers close on it (sp.grip's curl: the default is 0.35 for a level body)
      //     carry   where the hands are in the BODY's frame while it is carried, in arm lengths from the shoulder: { out: 0.15 (away from the body), up: -0.5, ahead: from the body's half depth }
      //   What it does: (with `approach` it walks up first, state `approach`) the hands REACH the body's sides (sp.hand_world: the body leans and crouches for a low one, and an arm that cannot make it gives up: the task fails with the reason `out of reach`), when every
      //   hand has been on its place for a moment the hands HOLD it (sp.grip), and the arms go from the place on the body to the carry pose over 0.6 s (the body rises with them), then it is CARRIED: the page says the
      //   carry pose at every frame, the worker puts the body at the hands. The task is stepped by the worker's frame (system.grab_tick: once a frame); `t.state` is "approach", "reach", "lift", "carry", "lower", "done" or "failed", `t.why` why it
      //   failed: `out of reach`, `timeout`, `stuck`, `cancelled`, `too heavy` (the body weighs more than the creature), `lost it` (the grip ended by itself).
      //   t.put_down({ ahead })     the hands take the body down in front of the person (0.45 m ahead of it, on the floor: the person crouches and leans for it), let go, and the task is done
      //   t.throw(speed, up)        let go at once with a throw: speed along the heading, up a share of it (0.35) upward, and the hand's own velocity
      //   t.release()               let go at once, as it is        t.cancel()   stop, with the body where it is (held or not)
      //   t.on_done(ok, why) is called once. A task per instance: grabbing again cancels the one before
      const grab_tasks = system.grab_tasks = [];
      let grab_clock = 0;
      const smooth = function (x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };
      const qrot = function (q, v) { const cx = q[1] * v[2] - q[2] * v[1] + q[3] * v[0], cy = q[2] * v[0] - q[0] * v[2] + q[3] * v[1], cz = q[0] * v[1] - q[1] * v[0] + q[3] * v[2]; return [v[0] + 2 * (q[1] * cz - q[2] * cy), v[1] + 2 * (q[2] * cx - q[0] * cz), v[2] + 2 * (q[0] * cy - q[1] * cx)]; };
      SP.grab = function (c, body, o) {
        live_instance(this, c, "grab");
        need_life(this, "grab");
        o = o || {};
        const KEYS = ["arms", "half", "lean", "crouch", "approach", "follow", "curl", "carry", "timeout", "on_done", "prop", "main", "ride", "side", "mount_id"];
        for (const key in o) if (KEYS.indexOf(key) < 0) throw new Error("system: grab: unknown key '" + key + "' (" + KEYS.join(", ") + ")");
        const follow = o.follow === undefined ? 0 : o.follow;
        if (!(follow >= 0 && follow <= 1)) throw new Error("system: grab: follow is 0 .. 1");
        if (!body || typeof body !== "object" || !Number.isInteger(body.uuid) || !body.world_position) throw new Error("system: grab: the body is a body of engine.phy (phy.body({ ... }))");
        if (o.ride !== undefined && o.ride !== null && o.ride !== "shoulder" && o.ride !== "back") throw new Error("system: grab: ride is 'shoulder' or 'back'");
        if (o.side !== undefined && o.side !== "left" && o.side !== "right") throw new Error("system: grab: side is 'left' or 'right' (the shoulder)");
        const mount_id = o.mount_id === undefined ? 0 : o.mount_id;
        if (!Number.isInteger(mount_id) || mount_id < 0 || mount_id > 15) throw new Error("system: grab: mount_id is 0 .. 15");
        const sp = this, arms = sp.life.arms, props = system.props;
        // a PROP (system.props: a type that says where the hands go and how it is held): the plan is which arm goes to which hold point, and the hands' poses
        const plan = o.prop === false || !props ? null : props.plan(sp, c, body, { arms: o.arms, main: o.main, prop: o.prop });
        const inst = props ? props.of(body) : null, type = plan ? plan.type : (o.prop && typeof o.prop === "string" ? props.get(o.prop) : (inst ? inst.type : null)), psize = plan ? plan.size : (inst ? inst.size : 1);
        if (o.ride && (!type || !type.rides[o.ride])) throw new Error("system: grab: this body does not ride on " + (o.ride === "shoulder" ? "a shoulder" : "the back") + " (a prop type that says `rides`, or one that is carried)");
        let list;
        if (plan) list = plan.items.map(function (it) { return it.j; });
        else if (o.arms === undefined || o.arms === "both") list = arms.map(function (a, j) { return j; }).filter(function (j) { return Math.abs(arms[j].side) === 1; }).slice(0, 2);
        else if (o.arms === "left" || o.arms === "right") list = [arms.findIndex(function (a) { return a.side === (o.arms === "left" ? 1 : -1); })];
        else if (o.arms === "nearest") list = null;
        else if (Array.isArray(o.arms)) list = o.arms.map(function (a) { return grip_arm(sp, a, "grab"); });
        else throw new Error("system: grab: arms is 'both', 'nearest', 'left', 'right' or a list of arms");
        if (list && (!list.length || list.some(function (j) { return j < 0; }))) throw new Error("system: grab: the creature has no arm for that (" + o.arms + ")");
        const half = plan ? [plan.reach, 0.1, plan.reach] : (o.half === undefined ? [0.25, 0.25, 0.25] : typeof o.half === "number" ? [o.half, o.half, o.half] : o.half);
        if (!Array.isArray(half) || half.length !== 3 || !half.every(function (v) { return Number.isFinite(v) && v > 0; })) throw new Error("system: grab: half is a number or [x, y, z] (metres, more than 0)");
        for (let k = grab_tasks.length - 1; k >= 0; k--) if (grab_tasks[k].sp === sp && grab_tasks[k].c.slot === c.slot) grab_tasks[k].cancel();
        const main_side = (o.main || sp.main_hand || (props && props.main_hand) || "right") === "left" ? 1 : -1;
        const t = {
          sp: sp, c: c, body: body, arms: list, half: half, lean: o.lean !== false, crouch: o.crouch !== false, carry: Object.assign({}, o.carry), timeout: o.timeout === undefined ? 8 : o.timeout, follow: follow, curl: o.curl,
          plan: plan, type: type, size: psize, ride: o.ride || null, rides: null, side: o.side ? (o.side === "left" ? 1 : -1) : main_side, mount_id: mount_id, unloading: null, after: null,
          state: o.approach ? "approach" : "reach", why: null, time: 0, phase_time: 0, on_set: 0, held: [], lost: false, on_done: o.on_done || null, finished: false, still: 0, bad: 0, down: null, best: 1e9, stuck: 0,
          // load it on a shoulder or on the back (from the carry): the hands swing it up, the bone takes it, the hands are free; `rides` says where it is
          load: function (where, p) {
            if (where !== "shoulder" && where !== "back") throw new Error("system: grab: load: 'shoulder' or 'back'");
            if (!this.type || !this.type.rides[where]) throw new Error("system: grab: load: this body does not ride on " + (where === "shoulder" ? "a shoulder" : "the back"));
            if (this.state !== "carry" && this.state !== "lift") return false;
            if (p && p.side) this.side = p.side === "left" ? 1 : -1;
            this.ride = where; this.state = "load"; this.phase_time = 0;
            return true;
          },
          // put it down: from the hands, the person lowers it to the floor ahead; from a shoulder or the back the hands first take it (the back's load goes to the shoulder, then the hands reach it)
          put_down: function (p) {
            if (this.state === "carry" || this.state === "lift") { this.down = Object.assign({ ahead: 0.45 }, p); this.state = "lower"; this.phase_time = 0; }
            else if (this.state === "rides" || this.state === "load") { this.down = Object.assign({ ahead: 0.45 }, p); this.state = "unload"; this.unloading = null; this.phase_time = 0; }
            return this;
          },
          throw: function (speed, up) {
            if (this.finished) return this;
            if (this.state === "rides" || this.state === "load" || this.state === "unload") return this.release();
            const r = grab_root(this.sp, this.c), f = qrot([r[4], r[5], r[6], r[7]], [0, 0, 1]), h = Math.hypot(f[0], f[2]) || 1, s = speed === undefined ? 6 : speed, u = up === undefined ? 0.35 : up;
            this.sp.ungrip(this.c, "all", { throw: [f[0] / h * s, s * u, f[2] / h * s] });
            grab_hands_off(this);
            return grab_finish(this, true, null, "done");
          },
          // the body is on a bone now (sp.mount took it from the hands: the worker ended their grips): the hands are free and the task is done
          park: function () { if (this.finished) return this; grab_hands_off(this); return grab_finish(this, true, null, "done"); },
          release: function () { if (this.finished) return this; if (this.rides || this.state === "rides" || this.state === "load" || this.state === "unload") grab_unmount(this); this.sp.ungrip(this.c, "all"); grab_hands_off(this); return grab_finish(this, true, null, "done"); },
          cancel: function () { if (this.finished) return this; if (this.state === "approach") { grab_stop(this); return grab_finish(this, false, "cancelled", "failed"); } if (this.state === "reach") { grab_hands_off(this); return grab_finish(this, false, "cancelled", "failed"); } return this.release(); },
        };
        grab_tasks.push(t);
        return t;
      };
      function grab_root(sp, c) { const m = sp.mirror, o = c.slot * 8; return [m[o], m[o + 1], m[o + 2], m[o + 3], m[o + 4], m[o + 5], m[o + 6], m[o + 7]]; }
      function grab_stop(t) { try { t.sp.set_intent(t.c, 0, 0, 0, 0); } catch (e) { /* the instance is gone */ } }
      function grab_unmount(t) { try { t.sp.unmount(t.c, t.mount_id); } catch (e) { /* the instance is gone */ } }
      function grab_hands_off(t) {
        const arms = t.use || [];
        arms.forEach(function (j) { try { t.sp.hand_world(t.c, j, { w: 0 }); t.sp.hand(t.c, j, { w: 0 }); } catch (e) { /* the instance is gone */ } });
      }
      function grab_finish(t, ok, why, state) {
        if (t.finished) return t;
        t.finished = true; t.state = state; t.why = why;
        const k = grab_tasks.indexOf(t);
        if (k >= 0) grab_tasks.splice(k, 1);
        if (typeof t.on_done === "function") t.on_done(ok, why);
        return t;
      }
      // the arms a task uses: given, or the nearest to the body (the one on its side)
      function grab_arms(t, root) {
        if (t.arms) return t.arms;
        const arms = t.sp.life.arms, p = t.body.world_position, d = [p[0] - root[0], p[1] - root[1], p[2] - root[2]], l = qrot([-root[4], -root[5], -root[6], root[7]], d);
        let best = 0;
        arms.forEach(function (a, j) { if (Math.abs(l[0] - a.side * 0.2) < Math.abs(l[0] - arms[best].side * 0.2)) best = j; });
        return [best];
      }
      // the hold that a prop's hands take: closed on a handle or a grip (0.8), as a hug closes (0.35)
      function grab_grip(t, j) {
        const sp = t.sp, c = t.c, it = t.plan ? t.plan.items.filter(function (i) { return i.j === j; })[0] : null;
        sp.grip(c, j, t.body, t.plan ? { follow: 0, curl: t.curl !== undefined ? t.curl : 0.8 } : (t.follow > 0 || t.curl !== undefined ? { follow: t.follow, curl: t.curl } : undefined));
        if (it) system.props.hold(sp, c, t.plan, it);
      }
      function grab_step(t, dt) {
        const sp = t.sp, c = t.c;
        if (!sp.alive[c.slot] || sp.gen[c.slot] !== c.gen) { grab_finish(t, false, "the creature is gone", "failed"); return; }
        const root = grab_root(sp, c), q = [root[4], root[5], root[6], root[7]], sc = root[3] || 1, bp = t.body.world_position;
        if (!t.use) t.use = grab_arms(t, root);
        const arms = sp.life.arms, st = function (j) { return sp.reach_state(c, j); };
        t.time += dt; t.phase_time += dt;
        const pt = function (j, local) { const r = qrot(q, local); return [bp[0] + r[0], bp[1] + r[1], bp[2] + r[2]]; };
        // where hand j holds the body: a prop's hold point (in the body's own frame, wherever the body is turned); else its side, along the body's OWN x axis (a body that is turned is taken by its ends: the page's body.world_rotation has
        // its w negated, the true turn is the conjugate), the end that is on the hand's side of the creature; a body whose x axis is vertical is taken along the creature's own
        const item = function (j) { if (!t.plan) return null; for (let i = 0; i < t.plan.items.length; i++) if (t.plan.items[i].j === j) return t.plan.items[i]; return null; };
        const br = t.body.world_rotation, bq = br ? [br[0], br[1], br[2], -br[3]] : null, bx = bq ? qrot(bq, [1, 0, 0]) : null, bh = bx ? Math.hypot(bx[0], bx[2]) : 0;
        const left = qrot(q, [1, 0, 0]);
        const grasp = function (j) {
          const it = item(j);
          if (it) return system.props.point_world(t.body, it.at);
          if (bh < 1e-3) return pt(j, [arms[j].side * t.half[0], 0, 0]);
          const ax = bx[0] / bh, az = bx[2] / bh, sgn = arms[j].side * (ax * left[0] + az * left[2] >= 0 ? 1 : -1);
          return [bp[0] + sgn * ax * t.half[0], bp[1], bp[2] + sgn * az * t.half[0]];
        };
        const L = function (j) { return arms[j].length * sc; };
        const carry_xyz = function (j) {                                                                           // where the hand is while it is carried: the prop's pose, else the hug in front
          const it = item(j);
          if (it) { const p = system.props.carry_pose(sp, it); return [p.x, p.y, p.z]; }
          const cp = t.carry, out = cp.out === undefined ? 0.15 : cp.out, up = cp.up === undefined ? -0.5 : cp.up, ahead = cp.ahead === undefined ? Math.max(0.5, Math.min(0.78, (0.2 + t.half[2]) / L(j))) : cp.ahead;
          return [arms[j].side * out, up, ahead];
        };
        const pose = function (j, w) { const p = carry_xyz(j); sp.hand(c, j, { x: p[0], y: p[1], z: p[2], body: true, w: w }); };
        const lift_hands = function (j, k, where) {                                                                // the hand from the carry pose (k 0) to the pose that loads it (k 1)
          const a = carry_xyz(j), b = system.props.load_pose(where, { side: arms[j].side });
          sp.hand(c, j, { x: a[0] + (b.x - a[0]) * k, y: a[1] + (b.y - a[1]) * k, z: a[2] + (b.z - a[2]) * k, body: true, w: 1 });
        };
        if (t.state === "approach") {                                                                         // (walk up to it: the wish toward it, facing it; the arms' reach and the body's half depth away is near enough)
          let fx_ = bp[0], fz_ = bp[2];                                                                       // (it walks up to the body's middle, or to the middle of its hold points: a sword is taken by its hilt, which may lie a long way from its middle)
          if (t.plan) { let sx = 0, sz = 0; t.plan.items.forEach(function (it) { const w = system.props.point_world(t.body, it.at); sx += w[0]; sz += w[2]; }); fx_ = sx / t.plan.items.length; fz_ = sz / t.plan.items.length; }
          const dx = fx_ - root[0], dz = fz_ - root[2], d = Math.hypot(dx, dz), stand = 0.3 * sc + (t.plan ? 0.12 : t.half[2]);
          if (t.time > t.timeout + 6) { grab_stop(t); grab_finish(t, false, "timeout", "failed"); return; }
          if (d < t.best - 0.05) { t.best = d; t.stuck = 0; } else t.stuck += dt;
          if (t.stuck > 3) { grab_stop(t); grab_finish(t, false, "stuck", "failed"); return; }
          if (d <= stand + 0.04) { sp.set_intent(c, 0, 0, dx / (d || 1), dz / (d || 1)); t.state = "reach"; t.time = 0; t.phase_time = 0; t.use = null; return; }
          const spd = Math.min(1.4 * sc, 0.35 * sc + (d - stand) * 1.5);
          sp.set_intent(c, dx / d * spd, dz / d * spd, dx / d, dz / d);
          return;
        }
        if (t.state === "reach") {
          if (t.time > t.timeout) { grab_hands_off(t); grab_finish(t, false, "timeout", "failed"); return; }
          let all_on = true, any_bad = false;
          t.use.forEach(function (j) {
            const p = grasp(j);
            sp.hand_world(c, j, { x: p[0], y: p[1], z: p[2], w: 1, lean: t.lean, crouch: t.crouch });
            const s = st(j);
            if (s !== 2) all_on = false;
            if (s === 3) any_bad = true;
          });
          t.bad = any_bad ? t.bad + dt : 0;
          if (t.bad > 0.5) { grab_hands_off(t); grab_finish(t, false, "out of reach", "failed"); return; }
          t.still = all_on ? t.still + dt : 0;
          if (t.still > 0.25) {
            t.use.forEach(function (j) { grab_grip(t, j); });
            t.state = "lift"; t.phase_time = 0;
          }
        } else if (t.state === "lift") {
          const k = smooth(t.phase_time / 0.6);
          t.use.forEach(function (j) {
            pose(j, k);
            if (k < 1) { const p = grasp(j); sp.hand_world(c, j, { x: p[0], y: p[1], z: p[2], w: 1 - k, lean: t.lean, crouch: t.crouch }); }
            else sp.hand_world(c, j, { w: 0 });
          });
          if (k >= 1) { t.state = "carry"; t.phase_time = 0; }
          if (!grab_held(t)) { grab_hands_off(t); grab_finish(t, false, grab_why(t), "failed"); }
        } else if (t.state === "carry") {
          t.use.forEach(function (j) { pose(j, 1); });
          if (!grab_held(t)) { grab_hands_off(t); grab_finish(t, false, grab_why(t), "failed"); }
          else if (t.after === "lower") { t.after = null; t.state = "lower"; t.phase_time = 0; }
          else if (t.ride) { t.state = "load"; t.phase_time = 0; }
        } else if (t.state === "load") {                                                                       // the hands swing it up to the shoulder; at the top the bone takes it and the hands are free
          const k = smooth(t.phase_time / 0.9);
          t.use.forEach(function (j) { lift_hands(j, k, t.ride); });
          if (!grab_held(t)) { grab_hands_off(t); grab_finish(t, false, grab_why(t), "failed"); }
          else if (k >= 1) {
            const m = system.props.ride_mount(sp, c, t.type, t.size, t.ride, t.side);
            sp.mount(c, t.mount_id, t.body, { bone: m.bone, off: m.off, rot: m.rot });
            t.rides = t.ride; t.ride = null; t.state = "rides"; t.phase_time = 0;
            t.use.forEach(function (j) { try { sp.hand(c, j, { w: 0 }); } catch (e) { /* gone */ } });
          }
        } else if (t.state === "rides") {                                                                      // it rides on the bone; the hand on the side of a shoulder load steadies it
          t.use.forEach(function (j) { const s = system.props.steady_pose(t.rides, arms[j].side, t.side); if (s) sp.hand(c, j, { x: s.x, y: s.y, z: s.z, body: true, w: 1 }); });
        } else if (t.state === "unload") {                                                                     // the hands take it from the bone (a load on the back goes round to the shoulder first), and put it down
          if (t.unloading === null) {
            t.unloading = t.rides === "back" ? "slide" : "reach"; t.phase_time = 0; t.time = 0; t.still = 0; t.bad = 0;
            if (t.unloading === "slide") { const m = system.props.ride_mount(sp, c, t.type, t.size, "shoulder", t.side); sp.hold_pose(c, 16 + t.mount_id, m.off, m.rot); }
            t.rides = t.rides || t.ride; t.ride = null;
          }
          if (t.unloading === "slide") {
            const k = smooth(t.phase_time / 0.7);
            t.use.forEach(function (j) { const b = system.props.load_pose("shoulder", { side: arms[j].side }); sp.hand(c, j, { x: b.x, y: b.y, z: b.z, body: true, w: k }); });
            if (t.phase_time > 0.8) { t.unloading = "reach"; t.rides = "shoulder"; t.phase_time = 0; t.time = 0; }
          } else {
            if (t.time > t.timeout) { grab_hands_off(t); t.state = "rides"; t.unloading = null; t.why = "out of reach"; return; }
            let all_on = true, any_bad = false;
            t.use.forEach(function (j) {
              const p = grasp(j);
              sp.hand_world(c, j, { x: p[0], y: p[1], z: p[2], w: 1, lean: false, crouch: false });
              const s = st(j);
              if (s !== 2) all_on = false;
              if (s === 3) any_bad = true;
            });
            t.bad = any_bad ? t.bad + dt : 0;
            if (t.bad > 0.8) { grab_hands_off(t); t.state = "rides"; t.unloading = null; t.why = "out of reach"; return; }
            t.still = all_on ? t.still + dt : 0;
            if (t.still > 0.25) {                                                                              // (the hands take it: the bone lets go of it at once, the worker ends the mount)
              t.use.forEach(function (j) { grab_grip(t, j); });
              t.rides = null; t.unloading = null; t.after = "lower"; t.state = "lift"; t.phase_time = 0;
            }
          }
        } else if (t.state === "lower") {
          const k = smooth(t.phase_time / 0.7), d = t.down;
          if (!t.floor) {                                                                                    // (where it is put down: ahead of the person, its bottom on the floor)
            const f = qrot(q, [0, 0, 1]), h = Math.hypot(f[0], f[2]) || 1, ahead = d.ahead * sc;
            t.floor = [root[0] + f[0] / h * ahead, d.y !== undefined ? d.y : t.half[1] + 0.01, root[2] + f[2] / h * ahead];
          }
          t.use.forEach(function (j) {
            pose(j, 1 - k);
            const it = item(j), r = t.plan && t.plan.style === "long" ? qrot(q, [0, 0, it && it.order === 0 ? -0.3 : 0.3]) : qrot(q, [t.plan ? 0 : arms[j].side * t.half[0], 0, 0]);
            sp.hand_world(c, j, { x: t.floor[0] + r[0], y: t.floor[1] + r[1], z: t.floor[2] + r[2], w: k, lean: t.lean, crouch: t.crouch });
          });
          let all_on = k >= 1;
          t.use.forEach(function (j) { if (st(j) !== 2) all_on = false; });
          if (t.phase_time > 2.5 || (all_on && t.phase_time > 0.9)) {
            sp.ungrip(c, "all", { inherit: false });
            grab_hands_off(t);
            grab_finish(t, true, null, "done");
          } else if (!grab_held(t)) { grab_hands_off(t); grab_finish(t, false, grab_why(t), "failed"); }
        }
      }
      // why the hands do not hold what the task grabbed: the worker refused it for its weight (`too heavy`), or the grip ended by itself (`lost it`)
      function grab_why(t) { return t.use.some(function (j) { return t.sp.grip_refused(t.c, j); }) ? "too heavy" : "lost it"; }
      function grab_held(t) { return t.use.every(function (j) { return t.sp.grip_st && t.sp.grip_st[t.c.slot * t.sp.life.arms.length + j] === 1 || t.phase_time < 0.1; }); }
      system.grab_tick = function (dt) {
        if (!grab_tasks.length) return;
        if (dt === undefined) { const n = now(); dt = grab_clock ? Math.min(0.1, Math.max(0.001, (n - grab_clock) / 1000)) : 1 / 60; grab_clock = n; }
        const list = grab_tasks.slice();
        for (let k = 0; k < list.length; k++) { if (!list[k].finished) { try { grab_step(list[k], dt); } catch (e) { grab_finish(list[k], false, String(e && e.message || e), "failed"); } } }
        if (!grab_tasks.length) grab_clock = 0;
      };

      // ========================================================================================================================
      // props
      // ========================================================================================================================
// system.js, a part: PROP TYPES, the things a creature can hold, and the GRASP PLANNER (SYSTEM.md "Holding things"). A prop type says what a thing is to a hand: its shape and weight (for the physics world), its HOLD POINTS (where on it a
// hand goes, and which hand: the grip of a sword, the handle of a bag, the rear grip and the fore end of a rifle), HOW it is held (a style), where the hands are while it is carried, which way it points, and where it rides on a
// bone when no hand has it (a holster, a sling). The creature reads that: its hands go to the hold points, take the thing, lift it into the pose and carry it (sp.grab with a prop). It is not a module of its own: system.js includes it,
// by the bundler's import directive, after species.js, in the middle of the closure that makes engine.system.
//
//   system.props.define(name, def)     def: {
//       shape: { box: [hx, hy, hz] } | { sphere: r }         the physics body's one shape (metres, half sizes); `system.props.create(phy, name, o)` makes the body of the engine's from it
//       mass: kg,
//       hold: "carry" | "tool" | "hang" | "cane" | "long"     how it is held (below)
//       points: [{ at: [x, y, z], hand: "main" | "off" | "any" }]    the hold points, in the body's own frame (metres from its centre): one for a tool, a hanging thing, a cane; two for a long thing (the first is the REAR, the second the FORE);
//                                                            none for "carry": the hands take its two sides
//       axis: [x, y, z]      the body's long axis, from the hold point toward the tip (a blade's point, a cane's foot): [0, 1, 0]
//       up: [x, y, z]        the body's own up: the direction in it that is kept as upright as the pose allows: [0, 1, 0]
//       dir: [x, y, z]       tool, cane: where the axis points in the creature's frame (x to its left, y up, z forward): a sword [0, 0.6, 0.8], a cane [0, -1, 0]
//       pose: { main: { out, up, ahead }, off: { out, up, ahead } }    where the hands are while it is carried, in arm lengths from the shoulder in the body's frame (`out`: away from the creature's middle; the style's own when not said)
//       hang: { damping }    a hanging thing: the pendulum's damping (1 / s, 0.6); its length is the distance from the hold point to its centre
//       single: { hold, points, ... }    what it is when only ONE arm takes a two-handed thing ("carry"): a crate by its rim hangs from the hand
//       mount: { bone, at: [x, y, z], dir: [x, y, z], up }    where it rides when no hand has it, on `bone`, `at` in the bone's frame and its axis along `dir` in it (a sword on the hip, a rifle slung on the back)
//       rides: { shoulder: { axis, dir, up }, back: { axis, dir, up } }    how it is LOADED on the creature: on a shoulder, on the back (a sack, a barrel, a plank across a shoulder): the body's `axis` along `dir` in the creature's frame (upright when not
//                                                            said), its `up` kept up. A thing that is carried (hold: carry) can ride on a shoulder and on the back without saying; the others only where they say
//       parts: [{ box: [hx, hy, hz], at: [x, y, z], color: [r, g, b] }]    how it is drawn (the lab's), the body's own frame
//     }
//   system.props.get(name)   system.props.names()   system.props.tag(body, name, { size })   system.props.of(body) -> { type, size } | null
//   system.props.plan(sp, c, body, o)      what a creature does to take the body: { style, items: [{ j, side, at, role, pose, tool, hang, up }], single } or null for the plain two-sided hold; o: { main: "left" | "right", arms, prop: name | type }
//   system.props.point_world(body, at)     where a hold point is in the world now
//   the geometry (system.props.math): orient(a_local, a_world, b_local, b_world), rotvec(q), rot(q, v), from_to(a, b)
//
// THE STYLES. carry: two hands, the two sides of the body, in front (the hug of a crate, a barrel, a ball: species.js sp.grab's own). tool: one hand holds the grip, the body is rigid in the creature's frame with its axis along `dir`
// (it turns with the heading, not with the wrist). hang: one hand holds the handle, the body hangs under it on a pendulum and swings (a bag, a bucket, a lantern, a crate by its rim). cane: a tool with its axis down (the foot toward the floor).
// long: two hands, the rear and the fore: the body lies along the line between them (a rifle, a plank, a pole)
      const props = system.props = { types: Object.create(null), bodies: new Map(), main_hand: "right" };
      const PROP_STYLES = ["carry", "tool", "hang", "cane", "long"];
      // ---- the geometry: quaternions as [x, y, z, w], vectors as [x, y, z]
      const pm = props.math = {
        dot: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
        cross: function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; },
        len: function (a) { return Math.hypot(a[0], a[1], a[2]); },
        norm: function (a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
        mul: function (a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; },
        rot: function (q, v) { const cx = q[1] * v[2] - q[2] * v[1] + q[3] * v[0], cy = q[2] * v[0] - q[0] * v[2] + q[3] * v[1], cz = q[0] * v[1] - q[1] * v[0] + q[3] * v[2]; return [v[0] + 2 * (q[1] * cz - q[2] * cy), v[1] + 2 * (q[2] * cx - q[0] * cz), v[2] + 2 * (q[0] * cy - q[1] * cx)]; },
        conj: function (q) { return [-q[0], -q[1], -q[2], q[3]]; },
        axis_angle: function (ax, ang) { const s = Math.sin(ang / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; },
        // the shortest turn that takes the unit vector a to the unit vector b
        from_to: function (a, b) {
          const d = pm.dot(a, b);
          if (d < -0.999999) { const ax = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], c = pm.norm(pm.cross(a, ax)); return [c[0], c[1], c[2], 0]; }
          const c = pm.cross(a, b), l = Math.hypot(c[0], c[1], c[2], 1 + d) || 1;
          return [c[0] / l, c[1] / l, c[2] / l, (1 + d) / l];
        },
        // the turn that takes the unit vector a_local to a_world and, about that, brings b_local as near b_world as it goes (a primary direction and a secondary one: a blade's point, then its edge toward the sky)
        orient: function (a_local, a_world, b_local, b_world) {
          const aw = pm.norm(a_world), q1 = pm.from_to(pm.norm(a_local), aw);
          const bl = pm.rot(q1, pm.norm(b_local)), bt = b_world;
          const bp = [bl[0] - aw[0] * pm.dot(bl, aw), bl[1] - aw[1] * pm.dot(bl, aw), bl[2] - aw[2] * pm.dot(bl, aw)], bq = [bt[0] - aw[0] * pm.dot(bt, aw), bt[1] - aw[1] * pm.dot(bt, aw), bt[2] - aw[2] * pm.dot(bt, aw)];
          if (pm.len(bp) < 1e-4 || pm.len(bq) < 1e-4) return q1;
          const p = pm.norm(bp), t = pm.norm(bq), ang = Math.atan2(pm.dot(pm.cross(p, t), aw), pm.dot(p, t));
          return pm.mul(pm.axis_angle(aw, ang), q1);
        },
        // a turn as a rotation vector (the axis times the angle, the short way round)
        rotvec: function (q) {
          let x = q[0], y = q[1], z = q[2], w = q[3];
          if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
          const s = Math.hypot(x, y, z);
          if (s < 1e-9) return [0, 0, 0];
          const ang = 2 * Math.atan2(s, w);
          return [x / s * ang, y / s * ang, z / s * ang];
        },
      };
      // ---- the registry
      function prop_vec(v, what, name, dflt) {
        if (v === undefined) return dflt.slice();
        if (!Array.isArray(v) || v.length !== 3 || !v.every(function (e) { return typeof e === "number" && Number.isFinite(e); })) throw new Error("system: props: '" + name + "': " + what + " is [x, y, z] (numbers)");
        return v.slice();
      }
      function prop_hand_pose(p, what, name) {
        if (p === undefined) return null;
        if (!p || typeof p !== "object") throw new Error("system: props: '" + name + "': " + what + " is { out, up, ahead } (arm lengths from the shoulder)");
        for (const key in p) if (key !== "out" && key !== "up" && key !== "ahead") throw new Error("system: props: '" + name + "': " + what + ": unknown key '" + key + "' (out, up, ahead)");
        const o = {};
        ["out", "up", "ahead"].forEach(function (k) { if (p[k] !== undefined) { if (typeof p[k] !== "number" || !Number.isFinite(p[k])) throw new Error("system: props: '" + name + "': " + what + "." + k + " must be a number"); o[k] = p[k]; } });
        return o;
      }
      // what each style says when the type says nothing: where the hands are while it is carried (arm lengths from the shoulder; `out` away from the middle), per role
      const STYLE_POSE = {
        tool: { main: { out: 0.12, up: -0.38, ahead: 0.6 }, off: { out: 0.12, up: -0.38, ahead: 0.6 } },
        hang: { main: { out: 0.3, up: -0.93, ahead: 0.05 }, off: { out: 0.3, up: -0.93, ahead: 0.05 } },
        cane: { main: { out: 0.22, up: -0.75, ahead: 0.25 }, off: { out: 0.22, up: -0.75, ahead: 0.25 } },
        long: { main: { out: -0.08, up: -0.45, ahead: 0.32 }, off: { out: 0.1, up: -0.33, ahead: 0.88 } },
      };
      const STYLE_DIR = { tool: [0, 0.6, 0.8], cane: [0, -1, 0] };
      function prop_type(name, def) {
        if (typeof name !== "string" || !name) throw new Error("system: props: a prop type has a name");
        if (!def || typeof def !== "object") throw new Error("system: props: '" + name + "' is { shape, mass, hold, points, ... }");
        const known = ["shape", "mass", "hold", "points", "axis", "up", "dir", "pose", "hang", "single", "mount", "rides", "parts", "reach"];
        for (const key in def) if (known.indexOf(key) < 0) throw new Error("system: props: '" + name + "': unknown key '" + key + "' (" + known.join(", ") + ")");
        const t = { name: name };
        const sh = def.shape;
        if (!sh || typeof sh !== "object" || (sh.box === undefined) === (sh.sphere === undefined)) throw new Error("system: props: '" + name + "': shape is { box: [hx, hy, hz] } or { sphere: r }");
        if (sh.box !== undefined) { if (!Array.isArray(sh.box) || sh.box.length !== 3 || !sh.box.every(function (e) { return typeof e === "number" && e > 0; })) throw new Error("system: props: '" + name + "': shape.box is [hx, hy, hz] (metres, more than 0)"); t.shape = { box: sh.box.slice() }; }
        else { if (typeof sh.sphere !== "number" || !(sh.sphere > 0)) throw new Error("system: props: '" + name + "': shape.sphere is a radius (metres, more than 0)"); t.shape = { sphere: sh.sphere }; }
        if (typeof def.mass !== "number" || !(def.mass > 0)) throw new Error("system: props: '" + name + "': mass is in kilograms, more than 0");
        t.mass = def.mass;
        t.hold = def.hold === undefined ? "carry" : def.hold;
        if (PROP_STYLES.indexOf(t.hold) < 0) throw new Error("system: props: '" + name + "': hold is one of " + PROP_STYLES.join(", ") + " (" + t.hold + ")");
        t.points = [];
        if (def.points !== undefined) {
          if (!Array.isArray(def.points) || def.points.length > 2) throw new Error("system: props: '" + name + "': points is a list of one or two hold points");
          def.points.forEach(function (p, k) {
            if (!p || typeof p !== "object") throw new Error("system: props: '" + name + "': hold point " + k + " is { at: [x, y, z], hand }");
            for (const key in p) if (key !== "at" && key !== "hand") throw new Error("system: props: '" + name + "': hold point " + k + ": unknown key '" + key + "' (at, hand)");
            const hand = p.hand === undefined ? (k === 0 ? "main" : "off") : p.hand;
            if (hand !== "main" && hand !== "off" && hand !== "any") throw new Error("system: props: '" + name + "': a hold point's hand is main, off or any (" + hand + ")");
            t.points.push({ at: prop_vec(p.at, "hold point " + k + "'s at", name, [0, 0, 0]), hand: hand });
          });
        }
        if (t.hold === "carry") { if (t.points.length) throw new Error("system: props: '" + name + "': a thing that is carried (hold: carry) has no hold points: the hands take its two sides"); }
        else if (t.hold === "long") { if (t.points.length !== 2) throw new Error("system: props: '" + name + "': a long thing has two hold points (the rear, the fore)"); }
        else if (t.points.length !== 1) throw new Error("system: props: '" + name + "': " + t.hold + " has one hold point");
        // a long thing's axis is the line between its two hold points (rear to fore) unless it says otherwise
        t.axis = def.axis === undefined && t.hold === "long" ? pm.norm([t.points[1].at[0] - t.points[0].at[0], t.points[1].at[1] - t.points[0].at[1], t.points[1].at[2] - t.points[0].at[2]]) : pm.norm(prop_vec(def.axis, "axis", name, [0, 1, 0]));
        t.up = pm.norm(prop_vec(def.up, "up", name, [0, 1, 0]));
        t.dir = pm.norm(prop_vec(def.dir, "dir", name, STYLE_DIR[t.hold] || [0, 0, 1]));
        t.pose = { main: prop_hand_pose(def.pose && def.pose.main, "pose.main", name), off: prop_hand_pose(def.pose && def.pose.off, "pose.off", name) };
        if (def.pose !== undefined) for (const key in def.pose) if (key !== "main" && key !== "off") throw new Error("system: props: '" + name + "': pose: unknown key '" + key + "' (main, off)");
        t.hang = { damping: def.hang && def.hang.damping !== undefined ? def.hang.damping : 0.6 };
        if (typeof t.hang.damping !== "number" || !(t.hang.damping >= 0 && t.hang.damping <= 20)) throw new Error("system: props: '" + name + "': hang.damping is 0 .. 20 (1 / s)");
        t.reach = def.reach === undefined ? 0.25 : def.reach;
        if (typeof t.reach !== "number" || !(t.reach > 0)) throw new Error("system: props: '" + name + "': reach is the half depth that a creature stands off by (metres, more than 0)");
        if (def.single !== undefined) {
          if (t.hold !== "carry") throw new Error("system: props: '" + name + "': single is for a thing that is carried by two hands");
          const s = def.single;
          if (!s || typeof s !== "object" || (s.hold !== "tool" && s.hold !== "hang" && s.hold !== "cane") || !Array.isArray(s.points) || s.points.length !== 1) throw new Error("system: props: '" + name + "': single is { hold: tool | hang | cane, points: [one hold point], ... }");
          t.single = { hold: s.hold, points: [{ at: prop_vec(s.points[0].at, "single's hold point", name, [0, 0, 0]), hand: s.points[0].hand || "main" }], axis: s.axis ? pm.norm(prop_vec(s.axis, "single.axis", name, [0, 1, 0])) : t.axis, up: s.up ? pm.norm(prop_vec(s.up, "single.up", name, [0, 1, 0])) : t.up, dir: s.dir ? pm.norm(prop_vec(s.dir, "single.dir", name, [0, 0, 1])) : pm.norm(STYLE_DIR[s.hold] || [0, 0, 1]), pose: prop_hand_pose(s.pose, "single.pose", name) };
        }
        if (def.mount !== undefined) {
          const m = def.mount;
          if (!m || typeof m !== "object" || typeof m.bone !== "string") throw new Error("system: props: '" + name + "': mount is { bone, at, dir, up } (the bone's name)");
          t.mount = { bone: m.bone, at: prop_vec(m.at, "mount.at", name, [0, 0, 0]), dir: pm.norm(prop_vec(m.dir, "mount.dir", name, [0, 1, 0])), up: m.up ? pm.norm(prop_vec(m.up, "mount.up", name, [0, 0, 1])) : [0, 0, 1] };
        }
        t.rides = {};
        const ride_places = ["shoulder", "back"];
        if (def.rides !== undefined) {
          if (!def.rides || typeof def.rides !== "object") throw new Error("system: props: '" + name + "': rides is { shoulder, back }");
          for (const where in def.rides) {
            if (ride_places.indexOf(where) < 0) throw new Error("system: props: '" + name + "': rides: no place '" + where + "' (" + ride_places.join(", ") + ")");
            const r = def.rides[where] || {};
            for (const key in r) if (key !== "axis" && key !== "dir" && key !== "up") throw new Error("system: props: '" + name + "': rides." + where + ": unknown key '" + key + "' (axis, dir, up)");
            t.rides[where] = { axis: r.axis ? pm.norm(prop_vec(r.axis, "rides." + where + ".axis", name, [0, 1, 0])) : null, dir: r.dir ? pm.norm(prop_vec(r.dir, "rides." + where + ".dir", name, [0, 1, 0])) : null, up: r.up ? pm.norm(prop_vec(r.up, "rides." + where + ".up", name, [0, 1, 0])) : null };
          }
        } else if (t.hold === "carry") ride_places.forEach(function (where) { t.rides[where] = { axis: null, dir: null, up: null }; });
        t.parts = [];
        if (def.parts !== undefined) {
          if (!Array.isArray(def.parts)) throw new Error("system: props: '" + name + "': parts is a list of { box, at, color }");
          def.parts.forEach(function (p, k) {
            if (!p || !Array.isArray(p.box) || p.box.length !== 3) throw new Error("system: props: '" + name + "': part " + k + " is { box: [hx, hy, hz], at, color }");
            t.parts.push({ box: p.box.slice(), at: prop_vec(p.at, "part " + k + "'s at", name, [0, 0, 0]), color: Array.isArray(p.color) && p.color.length === 3 ? p.color.slice() : null });
          });
        }
        return t;
      }
      props.define = function (name, def) { const t = prop_type(name, def); props.types[name] = t; return t; };
      props.get = function (name) { const t = props.types[name]; if (!t) throw new Error("system: props: no prop type '" + name + "' (" + Object.keys(props.types).join(", ") + ")"); return t; };
      props.names = function () { return Object.keys(props.types); };
      // a body of the engine's physics world is a prop of a type (the size scales its points, its length and its sides, 1: as the type says)
      props.tag = function (body, name, o) {
        if (!body || typeof body !== "object" || !Number.isInteger(body.uuid)) throw new Error("system: props: tag: the body is a body of engine.phy (it has a uuid)");
        const t = props.get(name), size = o && o.size !== undefined ? o.size : 1;
        if (typeof size !== "number" || !(size > 0)) throw new Error("system: props: tag: size is more than 0");
        props.bodies.set(body.uuid, { type: t, size: size });
        return body;
      };
      props.of = function (body) { return body && props.bodies.get(body.uuid) || null; };
      props.untag = function (body) { if (body) props.bodies.delete(body.uuid); };
      // the body of the engine's physics world for a type: `phy` is engine.phy; o: { x, y, z, yaw, size }. The mass is the type's, whatever the size (a density is made of it)
      props.create = function (phy, name, o) {
        o = o || {};
        const t = props.get(name), size = o.size === undefined ? 1 : o.size;
        const b = phy.body({ type: 2, pos: [o.x || 0, o.y === undefined ? 1 : o.y, o.z || 0] });
        let vol;
        const s = t.shape.box ? phy.shape_box(t.shape.box[0] * size, t.shape.box[1] * size, t.shape.box[2] * size) : phy.shape_sphere(t.shape.sphere * size);
        vol = t.shape.box ? 8 * t.shape.box[0] * t.shape.box[1] * t.shape.box[2] * size * size * size : 4 / 3 * Math.PI * Math.pow(t.shape.sphere * size, 3);
        phy.shape_material(s, t.mass / vol, 0.5, 0.1);
        phy.body_add_shape(b, s);
        phy.body_setup_mass(b);
        props.tag(b, name, { size: size });
        return b;
      };
      // ---- where a hold point is in the world: the body's place and TRUE turn (the page's body.world_rotation has its w negated: the conjugate is the turn)
      function body_turn(body) { const r = body.world_rotation; return r ? [r[0], r[1], r[2], -r[3]] : [0, 0, 0, 1]; }
      props.point_world = function (body, at) {
        const p = body.world_position, r = pm.rot(body_turn(body), at);
        return [p[0] + r[0], p[1] + r[1], p[2] + r[2]];
      };
      // ---- the plan
      function pose_for(style, type, role) { const base = STYLE_POSE[style][role] || STYLE_POSE[style].main, own = type.pose[role] || type.pose.main || null; return own ? { out: own.out === undefined ? base.out : own.out, up: own.up === undefined ? base.up : own.up, ahead: own.ahead === undefined ? base.ahead : own.ahead } : { out: base.out, up: base.up, ahead: base.ahead }; }
      // the arm of a side (+1 left, -1 right), or -1
      function arm_of_side(sp, side) { const arms = sp.life.arms; for (let j = 0; j < arms.length; j++) if (arms[j].side === side) return j; return -1; }
      // what the creature does to take a prop: which arm goes to which hold point, where the hands are while it is carried, and what the worker is told when the hands hold it. null: a plain carry
      props.plan = function (sp, c, body, o) {
        o = o || {};
        const inst = props.of(body), type = o.prop ? (typeof o.prop === "string" ? props.get(o.prop) : o.prop) : (inst ? inst.type : null);
        if (!type) return null;
        const size = inst ? inst.size : 1, arms = sp.life.arms;
        const main_side = (o.main || sp.main_hand || props.main_hand) === "left" ? 1 : -1;
        let style = type.hold, points = type.points, axis = type.axis, up = type.up, dir = type.dir, single = false;
        const one_arm = o.arms === "left" || o.arms === "right" || o.arms === "nearest" || (Array.isArray(o.arms) && o.arms.length === 1);
        if (style === "carry") {
          if (!one_arm || !type.single) return null;                                                                // (two hands take its sides: the plain hold)
          style = type.single.hold; points = type.single.points; axis = type.single.axis; up = type.single.up; dir = type.single.dir; single = true;
        }
        const scale = function (v) { return [v[0] * size, v[1] * size, v[2] * size]; };
        const jm = arm_of_side(sp, main_side), jo = arm_of_side(sp, -main_side);
        if (jm < 0 && jo < 0) return null;
        const items = [], used = {};
        const take = function (j) { if (j < 0 || used[j]) return -1; used[j] = true; return j; };
        const side_of_point = function (at) {                                                                      // the arm on the side of the creature that a point is on now
          const m = sp.mirror, k = c.slot * 8, q = [m[k + 4], m[k + 5], m[k + 6], m[k + 7]], w = props.point_world(body, scale(at)), l = pm.rot(pm.conj(q), [w[0] - m[k], w[1] - m[k + 1], w[2] - m[k + 2]]);
          return l[0] >= 0 ? 1 : -1;
        };
        points.forEach(function (p, k) {
          let j = -1;
          if (o.arms === "left" || o.arms === "right") j = take(arm_of_side(sp, o.arms === "left" ? 1 : -1));
          else if (Array.isArray(o.arms) && o.arms.length === 1) j = take(o.arms[0]);
          else if (o.arms === "nearest") j = take(arm_of_side(sp, side_of_point(p.at)));
          else if (p.hand === "main") j = take(jm);
          else if (p.hand === "off") j = take(jo);
          else j = take(arm_of_side(sp, side_of_point(p.at)));
          if (j < 0) j = take(jm >= 0 ? jm : jo);
          if (j < 0) j = take(jo);
          if (j < 0) return;
          const role = (jm === j) ? "main" : "off", pose = pose_for(style, single ? { pose: { main: type.single.pose || type.pose.main, off: null } } : type, role);
          items.push({ j: j, side: arms[j].side, at: scale(p.at), role: role, order: k, pose: pose });
        });
        if (!items.length) return null;
        if (style === "long" && items.length < 2) style = "tool";                                                   // (a creature with one arm carries it as a tool: the fore end is out of reach)
        const plan = { type: type, style: style, items: items, single: single, size: size, axis: axis, up: up, dir: dir, reach: type.reach * size };
        items.forEach(function (it) {
          if (style === "tool" || style === "cane") {                                                               // the body rigid in the creature's frame: its axis along `dir`, its up up; the hold point at the hand
            const qb = pm.orient(axis, dir, up, [0, 1, 0]), off = pm.rot(qb, it.at);
            it.tool = { off: [-off[0], -off[1], -off[2]], rotvec: pm.rotvec(qb) };
          } else if (style === "hang") {                                                                            // upright, its front to the creature's front; it hangs from the hold point on a pendulum of the distance to its centre
            const qb = pm.orient(up, [0, 1, 0], [0, 0, 1], [0, 0, 1]), off = pm.rot(qb, it.at), L = Math.max(0.05, pm.len(it.at));
            it.hang = { length: L, damping: type.hang.damping, off: [-off[0], -off[1], -off[2]], rotvec: pm.rotvec(qb) };
          } else if (style === "long") it.line = { at: it.at, up: up };
        });
        if (style === "long") items.sort(function (a, b) { return a.order - b.order; });
        return plan;
      };
      // the hand's place while it is carried: the page's hand (sp.hand, in the body's frame), in arm lengths from the shoulder
      props.carry_pose = function (sp, it) { return { x: it.side * it.pose.out, y: it.pose.up, z: it.pose.ahead }; };
      // ---- LOADED on the creature: on a shoulder, on the back (SYSTEM.md "Holding things"). The place is the creature's: the shoulder's top (the arm's shoulder joint, a little up and toward the neck) or the middle of the back,
      // found from its skeleton at the bind pose; the body goes there upright (a sack, a barrel) or along its `dir` (a plank along the shoulder), its bottom on the shoulder or its back to the back. The mount is on the torso bone
      // (the bone whose turn the arm's hand is made in). The numbers are in world units (the creature's scale taken in); the bone's frame is taken to be the model's (a bone that stands upright, not rolled)
      function sk_height(sp) {
        if (sp.__height) return sp.__height;
        const sk = sp.sk;
        let top = 0;
        for (let b = 0; b < sk.names.length; b++) top = Math.max(top, sk.head[b * 3 + 1], sk.tail[b * 3 + 1]);
        sp.__height = top || 1;
        return sp.__height;
      }
      function bone_head(sk, name) { const b = sk.index[name]; return [sk.head[b * 3], sk.head[b * 3 + 1], sk.head[b * 3 + 2]]; }
      function bone_tail(sk, name) { const b = sk.index[name]; return [sk.tail[b * 3], sk.tail[b * 3 + 1], sk.tail[b * 3 + 2]]; }
      // where `where` ("shoulder" | "back") is for a creature: { bone, point: the place in the model's axes (the bone's head taken off: `rel`), side } for the arm of `side`
      props.ride_place = function (sp, c, where, side) {
        const arms = sp.life.arms, sk = sp.sk, H = sk_height(sp);
        let j = -1;
        for (let k = 0; k < arms.length; k++) if (arms[k].side === side && (j < 0)) j = k;
        if (j < 0) j = 0;
        const arm = arms[j], torso = arm.torso || "chest";
        if (sk.index[torso] === undefined) throw new Error("system: props: the creature has no torso bone to carry on ('" + torso + "')");
        const th = bone_head(sk, torso), tt = bone_tail(sk, torso), sh = bone_head(sk, arm.shoulder);
        const point = where === "shoulder" ? [sh[0] * 0.75, sh[1] + 0.03 * H, sh[2]] : [0, 0.5 * (th[1] + tt[1]), th[2] - 0.065 * H];
        return { bone: torso, head: th, point: point, side: side, arm: j };
      };
      // the mount that carries a body in a ride place: { bone, off, rot } in the bone's frame (world units), from the body's type and size; o: { side (+1 left, -1 right: the shoulder), main }
      props.ride_mount = function (sp, c, type, size, where, side) {
        const r = type.rides[where];
        if (!r) throw new Error("system: props: '" + type.name + "' does not ride on " + (where === "shoulder" ? "a shoulder" : "the back") + " (rides: { " + where + ": ... })");
        const place = props.ride_place(sp, c, where, side), sc = sp.mirror[c.slot * 8 + 3] || 1;
        let qb;
        const bx = type.shape.box ? type.shape.box.map(function (e) { return e * size; }) : [type.shape.sphere * size, type.shape.sphere * size, type.shape.sphere * size];
        if (r.axis || r.dir) qb = pm.orient(r.axis || type.axis, r.dir || [0, 1, 0], r.up || type.up, [0, 1, 0]);      // (it lies along `dir`)
        else qb = pm.orient(type.up, [0, 1, 0], [0, 0, 1], [0, 0, 1]);                                           // (upright, its front to the creature's front)
        // how far the turned box reaches along each of the creature's axes from its middle (the sum of its half sizes along them)
        const ax = [pm.rot(qb, [1, 0, 0]), pm.rot(qb, [0, 1, 0]), pm.rot(qb, [0, 0, 1])];
        const ext = function (c) { return Math.abs(ax[0][c]) * bx[0] + Math.abs(ax[1][c]) * bx[1] + Math.abs(ax[2][c]) * bx[2]; };
        const H = sk_height(sp), out = (side >= 0 ? 1 : -1) * (0.07 * H + ext(0));                               // (on a shoulder it sits OUTBOARD of it, its inner edge clear of the head: a barrel's middle is half its width out)
        const centre = where === "shoulder" ? [out, place.point[1] + ext(1), place.point[2]] : [place.point[0], place.point[1], place.point[2] - ext(2)];
        return { bone: place.bone, off: [(centre[0] - place.head[0]) * sc, (centre[1] - place.head[1]) * sc, (centre[2] - place.head[2]) * sc], rot: pm.rotvec(qb), place: place };
      };
      // the hands while it is loaded: from the carry pose (in front) to above the shoulder, the same hand holds on to it on the shoulder (the near hand steadies it); arm lengths from the shoulder in the body's frame
      props.load_pose = function (where, it) { return where === "shoulder" ? { x: it.side * 0.3, y: 0.28, z: 0.12 } : { x: it.side * 0.28, y: 0.22, z: -0.05 }; };
      props.steady_pose = function (where, side, mount_side) { return side === mount_side ? { x: side * 0.22, y: 0.2, z: 0.08 } : null; };
      // what the worker is told when a hand holds the body (after sp.grip): the pose, the pendulum, the line
      props.hold = function (sp, c, plan, it) {
        if (it.tool) sp.hold_pose(c, it.j, it.tool.off, it.tool.rotvec);
        else if (it.hang) { sp.hold_hang(c, it.j, it.hang.length, it.hang.damping); sp.hold_pose(c, it.j, it.hang.off, it.hang.rotvec); }
        else if (it.line) sp.hold_line(c, it.j, it.line.at, it.line.up);
      };
      // ---- the built-in prop types: a few things to hold (the lab puts them on the ground)
      props.define("sword", { shape: { box: [0.025, 0.45, 0.012] }, mass: 1.2, hold: "tool", points: [{ at: [0, -0.38, 0], hand: "main" }], axis: [0, 1, 0], up: [1, 0, 0], dir: [0, 0.6, 0.8], reach: 0.2,
        pose: { main: { out: 0.12, up: -0.38, ahead: 0.6 } }, mount: { bone: "hips", at: [0.2, -0.02, 0.02], dir: [0.12, -1, 0.1], up: [0, 0, 1] },
        parts: [{ box: [0.022, 0.31, 0.008], at: [0, 0.14, 0], color: [0.75, 0.78, 0.82] }, { box: [0.085, 0.02, 0.02], at: [0, -0.17, 0], color: [0.55, 0.45, 0.2] }, { box: [0.016, 0.1, 0.016], at: [0, -0.3, 0], color: [0.3, 0.2, 0.12] }] });
      props.define("stick", { shape: { box: [0.02, 0.55, 0.02] }, mass: 0.9, hold: "tool", points: [{ at: [0, -0.15, 0], hand: "main" }], axis: [0, 1, 0], up: [0, 0, 1], dir: [0, 0.45, 0.89], reach: 0.2,
        pose: { main: { out: 0.1, up: -0.42, ahead: 0.55 } }, parts: [{ box: [0.02, 0.55, 0.02], at: [0, 0, 0], color: [0.5, 0.36, 0.2] }] });
      props.define("cane", { shape: { box: [0.018, 0.45, 0.018] }, mass: 0.7, hold: "cane", points: [{ at: [0, 0.34, 0], hand: "main" }], axis: [0, -1, 0], up: [0, 0, 1], dir: [0, -1, 0], reach: 0.2,
        pose: { main: { out: 0.24, up: -0.8, ahead: 0.22 } }, parts: [{ box: [0.018, 0.4, 0.018], at: [0, -0.05, 0], color: [0.45, 0.32, 0.18] }, { box: [0.05, 0.018, 0.018], at: [0.03, 0.43, 0], color: [0.35, 0.25, 0.14] }] });
      props.define("bag", { shape: { box: [0.2, 0.15, 0.1] }, mass: 15, hold: "hang", points: [{ at: [0, 0.23, 0], hand: "main" }], up: [0, 1, 0], reach: 0.25, hang: { damping: 0.6 },
        pose: { main: { out: 0.3, up: -0.93, ahead: 0.05 } }, parts: [{ box: [0.2, 0.15, 0.1], at: [0, 0, 0], color: [0.28, 0.4, 0.55] }, { box: [0.1, 0.012, 0.012], at: [0, 0.23, 0], color: [0.2, 0.2, 0.22] }, { box: [0.012, 0.04, 0.012], at: [-0.1, 0.19, 0], color: [0.2, 0.2, 0.22] }, { box: [0.012, 0.04, 0.012], at: [0.1, 0.19, 0], color: [0.2, 0.2, 0.22] }] });
      props.define("rifle", { shape: { box: [0.035, 0.07, 0.5] }, mass: 3.5, hold: "long", points: [{ at: [0, -0.03, -0.28], hand: "main" }, { at: [0, -0.04, 0.22], hand: "off" }], up: [0, 1, 0], reach: 0.3,
        pose: { main: { out: -0.08, up: -0.45, ahead: 0.32 }, off: { out: 0.1, up: -0.33, ahead: 0.88 } }, mount: { bone: "chest", at: [0, 0.05, -0.2], dir: [0.1, 1, 0.05], up: [0, 0, -1] },
        parts: [{ box: [0.03, 0.04, 0.3], at: [0, 0.0, 0.2], color: [0.22, 0.23, 0.25] }, { box: [0.035, 0.06, 0.17], at: [0, -0.01, -0.33], color: [0.4, 0.28, 0.16] }, { box: [0.02, 0.05, 0.03], at: [0, -0.08, -0.12], color: [0.15, 0.15, 0.16] }] });
      props.define("plank", { shape: { box: [0.06, 0.02, 0.8] }, mass: 6, hold: "long", points: [{ at: [0, 0, -0.35], hand: "main" }, { at: [0, 0, 0.35], hand: "off" }], up: [0, 1, 0], reach: 0.45,
        pose: { main: { out: 0.34, up: -0.78, ahead: 0.1 }, off: { out: 0.34, up: -0.78, ahead: 0.1 } }, rides: { shoulder: { axis: [0, 0, 1], dir: [0, 0, 1], up: [0, 1, 0] } }, parts: [{ box: [0.06, 0.02, 0.8], at: [0, 0, 0], color: [0.7, 0.55, 0.32] }] });
      props.define("barrel", { shape: { box: [0.22, 0.3, 0.22] }, mass: 25, hold: "carry", reach: 0.25, parts: [{ box: [0.22, 0.3, 0.22], at: [0, 0, 0], color: [0.45, 0.3, 0.18] }, { box: [0.235, 0.02, 0.235], at: [0, 0.18, 0], color: [0.25, 0.25, 0.27] }, { box: [0.235, 0.02, 0.235], at: [0, -0.18, 0], color: [0.25, 0.25, 0.27] }] });
      props.define("crate", { shape: { box: [0.25, 0.25, 0.25] }, mass: 10, hold: "carry", reach: 0.25, single: { hold: "hang", points: [{ at: [0, 0.25, 0], hand: "main" }] } });
      props.define("ball", { shape: { sphere: 0.3 }, mass: 6, hold: "carry", reach: 0.3, single: { hold: "tool", points: [{ at: [0, -0.3, 0], hand: "main" }], axis: [0, 1, 0], dir: [0, 1, 0], pose: { out: 0.2, up: -0.6, ahead: 0.5 } } });

      // ========================================================================================================================
      // fingers_api
      // ========================================================================================================================
// system.js, a part: the page's calls on a hand's FINGERS (pure.js is the table and the numbers, shared with the worker). It is included after grip_api.js (a grip closes the hand). It is not a module of its own: system.js
// includes it, by the bundler's import directive, in the middle of the closure that makes engine.system.
      // ---- the calls --------------------------------------------------------------------------------------------------------------------------------------------
      //   sp.has_fingers(arm?) -> true when the creature's skeleton has the bones of fingers (the human rigs have fifteen a hand) for that arm (any arm when none is said)
      //   sp.hand_curl(c, arm, curl, { thumb, stiffness })   the hand's fingers bend toward the palm: curl 0 (open and flat) .. 1 (a fist). `thumb` (1): the thumb's share of it. `stiffness` (1 / s, 14): how fast they get there
      //                                              (0: at once). A creature with no finger bones ignores it (false). Every finger bone is posed (sp.pose: the bone's own frame), so the page's own pose of those bones is replaced
      //   sp.finger_table() -> the table that pure.js built from the skeleton (arm, hand bone, the fingers' bones, the axes they bend about), or null: what the worker is given to curl the hands of a brain's creature
      // A GRIP CLOSES THE HAND on its own: when the worker says an arm holds a body (sp.on_grip state 1) the hand closes to the grip's `curl` (sp.grip(c, arm, body, { curl }), 0 .. 1; the default is 0.35 for a body that is held
      // level (a crate between two flat hands: the fingers lie against it) and 0.8 for one the hand turns, a tool), and it opens when the grip is over (state 0, 2). sp.grab closes the hands the same way (a crate: 0.35)
      const FING = pure.happy_worker_fingers();
      SP.finger_table = function () {
        if (this.fing === undefined) {
          const L = this.life, sk = this.sk, bone = function (b) { return typeof b === "number" ? b : sk.index[b]; };          // (an arm names its bones)
          this.fing = L && L.arms && L.arms.length ? FING.build(sk, L.arms.map(function (a) { return { side: a.side, shoulder: bone(a.shoulder), wrist: bone(a.wrist) }; })) : null;
        }
        return this.fing;
      };
      function finger_entry(sp, arm, what) {
        const t = sp.finger_table();
        if (!t) return null;
        const j = grip_arm(sp, arm, what);
        for (let i = 0; i < t.length; i++) if (t[i].arm === j) return t[i];
        return null;
      }
      SP.has_fingers = function (arm) {
        const t = this.finger_table();
        if (!t) return false;
        if (arm === undefined || arm === null) return true;
        return finger_entry(this, arm, "has_fingers") !== null;
      };
      SP.hand_curl = function (c, arm, curl, o) {
        live_instance(this, c, "hand_curl");
        need_life(this, "hand_curl");
        const e = finger_entry(this, arm, "hand_curl");
        o = o || {};
        for (const key in o) if (key !== "thumb" && key !== "stiffness" && key !== "index") throw new Error("system: hand_curl: unknown key '" + key + "' (thumb, index, stiffness)");
        fin(curl, "curl");
        if (curl < 0 || curl > 1) throw new Error("system: hand_curl: curl is 0 (open) .. 1 (a fist)");
        const stiff = o.stiffness === undefined ? 14 : fin(o.stiffness, "stiffness"), js = this.js_id, slot = c.slot, gen = c.gen;
        if (!e) return false;
        FING.apply(e, curl, { thumb: o.thumb === undefined ? 1 : fin(o.thumb, "thumb"), index: o.index === undefined ? 1 : fin(o.index, "index") }, function (bone, rx, ry, rz) {
          q_begin(12); q_u(CMD_HAPPY_BONE); q_u(js); q_u(slot); q_u(gen); q_u(bone); q_f(0); q_f(0); q_f(0); q_f(rx); q_f(ry); q_f(rz); q_f(stiff);
        });
        return true;
      };
      // the hand's closure for a grip, said when the grip is asked (sp.grip's curl, or its default by the grip's follow) and used when the worker says that it holds
      system.grip_curl_of = function (sp, c, arm, follow, curl) {
        if (!sp.grip_cl) sp.grip_cl = new Float32Array(sp.max_instances * sp.life.arms.length);
        sp.grip_cl[c.slot * sp.life.arms.length + arm] = curl === undefined ? (follow > 0.5 ? 0.8 : 0.35) : curl;
      };
      // the worker's event 7 (state 1 holds, 0 and 2 are over): the hand closes and opens
      system.grip_fingers = function (sp, slot, gen, arm, st) {
        if (!sp.life || !sp.life.arms || !sp.life.arms.length || !sp.finger_table()) return;
        const na = sp.life.arms.length, c = { species: sp, slot: slot, gen: gen };
        if (st === 1) { const k = sp.grip_cl ? sp.grip_cl[slot * na + arm] : 0; sp.hand_curl(c, arm, k > 0 ? k : 0.35); }
        else if (st === 0 || st === 2) sp.hand_curl(c, arm, 0);
      };

      // ========================================================================================================================
      // hand_hold
      // ========================================================================================================================
// system.js, a part: A HAND ON WHAT IT HOLDS (species.js has the finger table and the curl; species.js the world reach, which puts the wrist where it is told). It is included after fingers_api.js. It is not a module of its own:
// system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system.
      // A hand that takes hold of a thing is not a wrist at a point: it is a PALM on the thing's surface, turned the way the thing says, with the fingers round it. The call here says where the palm is, which way it faces and which way the thumb is, in the world,
      // and the page works out the rest from the hand's own bones (the table that pure.js makes from the bind pose: where the middle of the palm is from the wrist, the way the fingers point, the palm faces, the thumb is):
      //   sp.hand_hold(c, arm, { p, n, th, w, curl, thumb, index, stiffness, pole, pole_w })     `p` the middle of the palm (the hand's bone line: the palm's skin is a couple of centimetres nearer the thing), `n` the way the palm faces (toward the thing), `th` the side the
      //                                         thumb is on (made square to n); the fingers' way follows from the two and from the hand's handedness (a left hand and a right hand are not mirrored by the caller). `w` (0 .. 1, 1) the weight: the hand's pose goes
      //                                         to the hold's as far as w, the wrist to where it puts the palm on p. `curl` (0 .. 1: 0 open, 1 a fist) closes the fingers round the thing, `thumb` and `index` the thumb's and the index finger's share of it (1: the
      //                                         same; a trigger finger: 0.3). -> 0 the hand has no bones to hold with or the creature is not drawn (nothing was done: the caller puts the wrist by itself), 1 held, 2 held but the wrist's limits stopped the palm turning all the way
      //   sp.hand_hold_end(c, arm)               the hand is its own again (the pose eases back, the fingers open, the world reach is let go)
      //   sp.hand_palm(c, arm, out)              where the palm is NOW (the rows the worker last sent): out = { p, n, f, th } (world): for tests and for whatever holds something that moves
      //   sp.hand_geometry(arm)                  the hand's palm in the bind pose, or null: { hand, parent, c, f, n, th, sh } (model units and axes)
      // The wrist is not a ball: the turn of the hand against the forearm is held to HH_LIM (bend 63 degrees, twist 80), and when the palm cannot turn all the way it turns as far as it can and the wrist is put where THAT palm is on p.
      const HH_LIM = [1.1, 1.4, 1.1];                                                                      // (rx, ry, rz of the pose: the bends and the twist about the hand's own axis, radians)
      const HH_RR = new Float64Array(9), HH_RP = new Float64Array(9), HH_FW = new Float64Array(9), HH_RT = new Float64Array(9), HH_T1 = new Float64Array(9), HH_T2 = new Float64Array(9), HH_RB = new Float64Array(9), HH_FB = new Float64Array(9), HH_RQ = new Float64Array(9), HH_P1 = new Float64Array(9);
      const HH_E = [0, 0, 0], HH_Q = [0, 0, 0, 1], HH_V = new Float64Array(3);
      function hh_q_m(o, x, y, z, w) {
        const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
        o[0] = 1 - 2 * (yy + zz); o[1] = 2 * (xy - wz); o[2] = 2 * (xz + wy);
        o[3] = 2 * (xy + wz); o[4] = 1 - 2 * (xx + zz); o[5] = 2 * (yz - wx);
        o[6] = 2 * (xz - wy); o[7] = 2 * (yz + wx); o[8] = 1 - 2 * (xx + yy);
      }
      function hh_mul(o, a, b) { for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]; }            // o = a b
      function hh_mul_bt(o, a, b) { for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c * 3] + a[r * 3 + 1] * b[c * 3 + 1] + a[r * 3 + 2] * b[c * 3 + 2]; }  // o = a b^T
      function hh_mul_at(o, a, b) { for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r] * b[c] + a[3 + r] * b[3 + c] + a[6 + r] * b[6 + c]; }                    // o = a^T b
      function hh_m_q(q, m) {
        const tr = m[0] + m[4] + m[8];
        let s;
        if (tr > 0) { s = Math.sqrt(tr + 1) * 2; q[3] = 0.25 * s; q[0] = (m[7] - m[5]) / s; q[1] = (m[2] - m[6]) / s; q[2] = (m[3] - m[1]) / s; }
        else if (m[0] > m[4] && m[0] > m[8]) { s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; q[3] = (m[7] - m[5]) / s; q[0] = 0.25 * s; q[1] = (m[1] + m[3]) / s; q[2] = (m[2] + m[6]) / s; }
        else if (m[4] > m[8]) { s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; q[3] = (m[2] - m[6]) / s; q[0] = (m[1] + m[3]) / s; q[1] = 0.25 * s; q[2] = (m[5] + m[7]) / s; }
        else { s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; q[3] = (m[3] - m[1]) / s; q[0] = (m[2] + m[6]) / s; q[1] = (m[5] + m[7]) / s; q[2] = 0.25 * s; }
      }
      // the turn the pose command means by (rx, ry, rz): qx(rx) * qz(rz) * qy(ry) (species.js euler_of)
      function hh_euler_q(q, rx, ry, rz) {
        const ax = Math.sin(rx / 2), aw = Math.cos(rx / 2), bz = Math.sin(rz / 2), bw = Math.cos(rz / 2), cy = Math.sin(ry / 2), cw = Math.cos(ry / 2);
        const x1 = aw * 0 + ax * bw, y1 = -ax * bz, z1 = aw * bz, w1 = aw * bw;                              // qx * qz
        q[0] = x1 * cw - z1 * cy;
        q[1] = y1 * cw + w1 * cy;
        q[2] = z1 * cw + x1 * cy;
        q[3] = w1 * cw - y1 * cy;
      }
      SP.hand_geometry = function (arm) {
        const j = typeof arm === "number" ? arm : (this.life && this.life.arms ? this.life.arms.findIndex(function (a) { return a.name === arm; }) : -1);
        return hh_geometry(this, j);
      };
      function hh_geometry(sp, j) {
        if (!sp.hh_geo) sp.hh_geo = [];
        if (sp.hh_geo[j] !== undefined) return sp.hh_geo[j];
        let g = null;
        const t = sp.life && sp.life.arms && sp.life.arms.length ? sp.finger_table() : null;
        if (t) for (let i = 0; i < t.length; i++) if (t[i].arm === j && t[i].palm) {
          const e = t[i], p = e.palm, sk = sp.sk, b = e.hand, o = b * 12, bind = sk.bind;
          g = { hand: b, parent: sk.parent[b], c: p.c.slice(), f: p.f.slice(), n: p.n.slice(), th: p.th.slice(), sh: p.sh, entry: e,
            rb: [bind[o], bind[o + 1], bind[o + 2], bind[o + 4], bind[o + 5], bind[o + 6], bind[o + 8], bind[o + 9], bind[o + 10]] };       // (the bone's axes are the columns of its bind matrix)
        }
        sp.hh_geo[j] = g;
        return g;
      }
      // the world's rows of an instance: the root's turn into HH_RR and its scale and place, the rows of a bone's turn into `out` (3 x 3, root x bone: bind axes to world axes); -> the scale of the bone's row in the world (the root's times the bone's), 0 when it is not drawn
      function hh_bone_m(sp, slot, bone, out) {
        const m = sp.mirror, r = slot * 8, o = sp.root_rows * W * 4 + slot * sp.bone_count * 8 + bone * 8;
        if (!(slot >= 0 && sp.alive[slot] && m[r + 3] > 0)) return 0;
        hh_q_m(HH_RR, m[r + 4], m[r + 5], m[r + 6], m[r + 7]);
        hh_q_m(HH_RQ, m[o + 4], m[o + 5], m[o + 6], m[o + 7]);
        hh_mul(out, HH_RR, HH_RQ);
        return m[r + 3] * m[o + 3];
      }
      // the hold: the palm at p facing n with the thumb to th (world); every number is a plain number (the caller checks)
      function hh_hold(sp, c, j, g, o) {
        const slot = c.slot, m = sp.mirror, r = slot * 8, w = o.w === undefined ? 1 : o.w;
        const ws = hh_bone_m(sp, slot, g.hand, HH_T2);
        if (!(ws > 0)) return 0;
        hh_bone_m(sp, slot, g.parent, HH_T1);                                                               // (the forearm's turn, bind axes to world: HH_T1)
        let nx = o.n[0], ny = o.n[1], nz = o.n[2];
        let l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        let tx = o.th[0], ty = o.th[1], tz = o.th[2];
        const d = tx * nx + ty * ny + tz * nz;
        tx -= d * nx; ty -= d * ny; tz -= d * nz; l = Math.hypot(tx, ty, tz);
        if (l < 1e-6) { tx = Math.abs(nx) < 0.9 ? 1 : 0; ty = 0; tz = Math.abs(nx) < 0.9 ? 0 : 1; const e = tx * nx + ty * ny + tz * nz; tx -= e * nx; ty -= e * ny; tz -= e * nz; l = Math.hypot(tx, ty, tz); }
        tx /= l; ty /= l; tz /= l;
        const fx = g.sh * (ny * tz - nz * ty), fy = g.sh * (nz * tx - nx * tz), fz = g.sh * (nx * ty - ny * tx);       // (the fingers' way: f = sh (n x th))
        const FW = HH_FW, FB = HH_FB, RB = HH_RB, RT = HH_RT, RP = HH_RP;
        FW[0] = fx; FW[1] = nx; FW[2] = tx; FW[3] = fy; FW[4] = ny; FW[5] = ty; FW[6] = fz; FW[7] = nz; FW[8] = tz;
        FB[0] = g.f[0]; FB[1] = g.n[0]; FB[2] = g.th[0]; FB[3] = g.f[1]; FB[4] = g.n[1]; FB[5] = g.th[1]; FB[6] = g.f[2]; FB[7] = g.n[2]; FB[8] = g.th[2];
        for (let i = 0; i < 9; i++) RB[i] = g.rb[i];
        const P1 = HH_P1;                                                                                    // (the forearm's turn kept: HH_T1 is a scratch below)
        for (let i = 0; i < 9; i++) P1[i] = HH_T1[i];
        hh_mul_bt(RT, FW, FB);                                                                              // (the turn that takes the hand's bind frame to the hold's: bind axes to world)
        hh_mul_at(HH_T1, P1, RT); hh_mul_at(HH_T2, RB, HH_T1); hh_mul(RP, HH_T2, RB);                       // (the pose: Rp = Rb^T Rs_p^T R_t Rb, in the hand bone's own frame)
        hh_m_q(HH_Q, RP);
        FING.euler(HH_Q[0], HH_Q[1], HH_Q[2], HH_Q[3], HH_E);
        let clamped = 0;
        for (let k = 0; k < 3; k++) { const lim = HH_LIM[k]; if (HH_E[k] > lim) { HH_E[k] = lim; clamped = 1; } else if (HH_E[k] < -lim) { HH_E[k] = -lim; clamped = 1; } HH_E[k] *= w; }
        hh_euler_q(HH_Q, HH_E[0], HH_E[1], HH_E[2]);
        hh_q_m(RP, HH_Q[0], HH_Q[1], HH_Q[2], HH_Q[3]);
        hh_mul(HH_T1, P1, RB); hh_mul(HH_T2, HH_T1, RP); hh_mul_bt(RT, HH_T2, RB);                          // (the hand's turn as the pose will make it: R_t = Rs_p Rb Rp Rb^T)
        const cx = g.c[0], cy = g.c[1], cz = g.c[2];
        const wx = o.p[0] - ws * (RT[0] * cx + RT[1] * cy + RT[2] * cz), wy = o.p[1] - ws * (RT[3] * cx + RT[4] * cy + RT[5] * cz), wz = o.p[2] - ws * (RT[6] * cx + RT[7] * cy + RT[8] * cz);
        const ho = sp.hh_ho || (sp.hh_ho = { x: 0, y: 0, z: 0, w: 1, lean: false, crouch: false });
        ho.x = wx; ho.y = wy; ho.z = wz; ho.w = w; ho.lean = o.lean === true; ho.crouch = false; ho.turn = o.turn === true;
        if (o.pole !== undefined && o.pole !== null) { ho.pole = o.pole; ho.pole_w = o.pole_w === undefined ? 1 : o.pole_w; } else { ho.pole = undefined; ho.pole_w = undefined; }
        sp.hand_world(c, j, ho);
        const na = sp.life.arms.length, k4 = (slot * na + j) * 4;
        if (!sp.hh_sent) sp.hh_sent = new Float32Array(sp.max_instances * na * 4).fill(1e9);
        const S = sp.hh_sent, stiff = o.stiffness === undefined ? 0 : o.stiffness;
        if (Math.abs(S[k4] - HH_E[0]) > 2e-4 || Math.abs(S[k4 + 1] - HH_E[1]) > 2e-4 || Math.abs(S[k4 + 2] - HH_E[2]) > 2e-4 || S[k4 + 3] !== stiff) {
          S[k4] = HH_E[0]; S[k4 + 1] = HH_E[1]; S[k4 + 2] = HH_E[2]; S[k4 + 3] = stiff;
          q_begin(12); q_u(CMD_HAPPY_BONE); q_u(sp.js_id); q_u(slot); q_u(c.gen); q_u(g.hand); q_f(0); q_f(0); q_f(0); q_f(HH_E[0]); q_f(HH_E[1]); q_f(HH_E[2]); q_f(stiff);
        }
        if (o.curl !== undefined) {
          if (!sp.hh_curl) sp.hh_curl = new Float32Array(sp.max_instances * na * 3).fill(-1);
          const k3 = (slot * na + j) * 3, cv = o.curl * w, th = o.thumb === undefined ? 1 : o.thumb, ix = o.index === undefined ? 1 : o.index, C = sp.hh_curl;
          if (Math.abs(C[k3] - cv) > 0.01 || C[k3 + 1] !== th || C[k3 + 2] !== ix) { C[k3] = cv; C[k3 + 1] = th; C[k3 + 2] = ix; sp.hand_curl(c, j, cv, { thumb: th, index: ix, stiffness: o.stiffness === undefined ? 16 : o.stiffness }); }
        }
        return 1 + clamped;
      }
      SP.hand_hold = function (c, arm, o) {
        live_instance(this, c, "hand_hold");
        need_life(this, "hand_hold");
        const j = grip_arm(this, arm, "hand_hold");
        if (!o || typeof o !== "object") throw new Error("system: hand_hold takes { p, n, th, w, curl }");
        for (const key in o) if (["p", "n", "th", "w", "curl", "thumb", "index", "stiffness", "lean", "turn", "pole", "pole_w"].indexOf(key) < 0) throw new Error("system: hand_hold: unknown key '" + key + "' (p, n, th, w, curl, thumb, index, stiffness, lean, turn, pole, pole_w)");
        ["p", "n", "th"].forEach(function (k) { if (!Array.isArray(o[k]) || o[k].length !== 3 || !o[k].every(Number.isFinite)) throw new Error("system: hand_hold: " + k + " is [x, y, z]"); });
        if (o.w !== undefined) fin(o.w, "w");
        const g = hh_geometry(this, j);
        if (!g) return 0;
        return hh_hold(this, c, j, g, o);
      };
      SP.hand_hold_end = function (c, arm) {
        live_instance(this, c, "hand_hold_end");
        need_life(this, "hand_hold_end");
        const j = grip_arm(this, arm, "hand_hold_end"), g = hh_geometry(this, j), na = this.life.arms.length, slot = c.slot;
        this.hand_world(c, j, { w: 0 });
        if (!g) return false;
        if (this.hh_sent) { const k4 = (slot * na + j) * 4; this.hh_sent[k4] = this.hh_sent[k4 + 1] = this.hh_sent[k4 + 2] = this.hh_sent[k4 + 3] = 1e9; }
        q_begin(12); q_u(CMD_HAPPY_BONE); q_u(this.js_id); q_u(slot); q_u(c.gen); q_u(g.hand); q_f(0); q_f(0); q_f(0); q_f(0); q_f(0); q_f(0); q_f(12);
        if (this.hh_curl) { const k3 = (slot * na + j) * 3; if (this.hh_curl[k3] !== -1) { this.hh_curl[k3] = -1; this.hand_curl(c, j, 0, { stiffness: 12 }); } }
        return true;
      };
      SP.hand_palm = function (c, arm, out) {
        live_instance(this, c, "hand_palm");
        need_life(this, "hand_palm");
        const j = grip_arm(this, arm, "hand_palm"), g = hh_geometry(this, j);
        if (!g) return null;
        const ws = hh_bone_m(this, c.slot, g.hand, HH_T1);
        if (!(ws > 0)) return null;
        const m = this.mirror, r = c.slot * 8, o = this.root_rows * W * 4 + c.slot * this.bone_count * 8 + g.hand * 8;
        out = out || { p: [0, 0, 0], n: [0, 0, 0], f: [0, 0, 0], th: [0, 0, 0] };
        const T = HH_T1, bs = m[o + 3];
        // the root's place + rs R_root (bs R_bone (head + c) + t)  ==  the hand's bone row on the palm's bind point
        hh_q_m(HH_RQ, m[o + 4], m[o + 5], m[o + 6], m[o + 7]);
        const sk = this.sk, b = g.hand, hx = sk.head[b * 3] + g.c[0], hy = sk.head[b * 3 + 1] + g.c[1], hz = sk.head[b * 3 + 2] + g.c[2], Q = HH_RQ;
        const mx = bs * (Q[0] * hx + Q[1] * hy + Q[2] * hz) + m[o], my = bs * (Q[3] * hx + Q[4] * hy + Q[5] * hz) + m[o + 1], mz = bs * (Q[6] * hx + Q[7] * hy + Q[8] * hz) + m[o + 2];
        const R = HH_RR, rs = m[r + 3];
        out.p[0] = m[r] + rs * (R[0] * mx + R[1] * my + R[2] * mz); out.p[1] = m[r + 1] + rs * (R[3] * mx + R[4] * my + R[5] * mz); out.p[2] = m[r + 2] + rs * (R[6] * mx + R[7] * my + R[8] * mz);
        const ax = [g.n, g.f, g.th], to = [out.n, out.f, out.th];
        for (let k = 0; k < 3; k++) { const v = ax[k]; to[k][0] = T[0] * v[0] + T[1] * v[1] + T[2] * v[2]; to[k][1] = T[3] * v[0] + T[4] * v[1] + T[5] * v[2]; to[k][2] = T[6] * v[0] + T[7] * v[1] + T[8] * v[2]; }
        return out;
      };

      // ========================================================================================================================
      // face_api
      // ========================================================================================================================
// system.js, a part: the page's calls on the LOOK and the FACE (body.cpp: CMD_HAPPY_LOOK, CMD_HAPPY_FACE). It is included after legs_api.js (it adds to the species' methods). It is not a module of its own: system.js includes it, by the
// bundler's import directive, in the middle of the closure that makes engine.system.
      // ---- the look and the face: the page's calls ----------------------------------------------------------------------------------------------------------------
      //   sp.look(c, target, { weight, eyes_only, no_spine, height })   where the creature looks. target: a world point ({ x, y, z } or [x, y, z]), a direction in the body's frame ({ yaw, pitch }: degrees, yaw to the left, pitch up),
      //                another instance (an instance handle { species, slot, gen }: the worker follows it, no command a frame; `height`: model units over its root, 0: where its eyes are), or null (let go). The eyes aim first (each at
      //                the goal itself: two eyes meet on a near one), then the head, the neck and, when the look is too steep for them, the spine (the cascade). weight 0 .. 1 (1). The same look again sends nothing. Needs eyes or a head
      //   sp.face(c, channels | expression, intensity?, { hold })   channels: { jaw, lids, brows, knit, smile, ears, snarl, speak } (jaw 0 .. 1.2, speak 0 .. 1, the others -1 .. 1: lids + closed / - wide open, brows + raised,
      //                knit + drawn together, smile + a smile / - a frown, ears + forward / - laid back, snarl +), times `intensity` (1); or the name of an expression (system.EXPRESSIONS) at `intensity` (1, 0 .. 4); `hold`: the seconds
      //                it is kept (0: until it is changed; a yawn and a roar let go by themselves). What a channel moves is what the creature has. Needs a face
      //   sp.speak(c, level, seconds?)   the jaw flaps in syllables (4 to 7 a second, each of its own size) at `level` (0 .. 1; 0 or false stops it, true is 1), for `seconds` (then it stops by itself). Needs a jaw
      //   sp.face_act(c, what)   now: "blink", "sniff", "ears" (a flick), "tilt" (of the head), "tail" (a flick), "chew", or a list of them
      //   sp.face_channels   ["jaw", "lids", "brows", "knit", "smile", "ears", "snarl", "speak"]      system.EXPRESSIONS      system.FACE_ACTS
      const FACE_CHANNELS = ["jaw", "lids", "brows", "knit", "smile", "ears", "snarl", "speak"];
      const FACE_CHANNEL_ALIAS = { brow: "brows" };                                                  // (system 2.0's name of the channel)
      const EXPRESSIONS = ["neutral", "happy", "sad", "angry", "surprised", "afraid", "disgusted", "sleepy", "yawn", "roar"];
      const FACE_ACTS = { blink: 1, sniff: 2, ears: 4, tilt: 8, tail: 16, chew: 32 };
      system.FACE_CHANNELS = FACE_CHANNELS.slice(); system.EXPRESSIONS = EXPRESSIONS.slice(); system.FACE_ACTS = Object.keys(FACE_ACTS);
      function need_face(sp, what, ok, lacks) {
        if (!sp.life || !sp.life.words) throw new Error("system: " + what + ": species '" + sp.name + "' has no roles (the definition's `roles`)");
        if (!ok) throw new Error("system: " + what + ": species '" + sp.name + "' has no " + lacks);
      }
      function look_point(t) { return Array.isArray(t) ? t : (t && typeof t === "object" && t.x !== undefined && t.species === undefined ? [t.x, t.y, t.z] : null); }
      SP.look = function (c, target, o) {
        live_instance(this, c, "look");
        need_face(this, "look", this.life && this.life.features && this.life.features.look, "eyes and no head to look with (roles: eyes, head)");
        o = o || {};
        for (const k in o) if (["weight", "eyes_only", "no_spine", "height"].indexOf(k) < 0) throw new Error("system: look: unknown option '" + k + "' (weight, eyes_only, no_spine, height)");
        const w = o.weight === undefined ? 1 : o.weight, h = o.height === undefined ? 0 : o.height;
        if (typeof w !== "number" || !Number.isFinite(w) || w < 0 || w > 1) throw new Error("system: look: weight is a number from 0 to 1");
        if (typeof h !== "number" || !Number.isFinite(h) || h < 0 || h > 1e5) throw new Error("system: look: height is a number, 0 or more (model units over the other's root; 0: its eyes)");
        const flags = (o.eyes_only ? 1 : 0) | (o.no_spine ? 2 : 0);
        let mode = 0, a = 0, b = 0, d = 0, key;
        const p = look_point(target);
        if (target === null || target === undefined) { key = "off"; }
        else if (p) {
          if (p.length !== 3 || !p.every(function (v) { return typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e7; })) throw new Error("system: look: a point is { x, y, z } or [x, y, z] (finite numbers)");
          mode = 1; a = p[0]; b = p[1]; d = p[2]; key = "p" + a + "," + b + "," + d;
        } else if (typeof target === "object" && target.species === undefined && (target.yaw !== undefined || target.pitch !== undefined)) {
          for (const k in target) if (k !== "yaw" && k !== "pitch") throw new Error("system: look: a direction is { yaw, pitch } (degrees), not '" + k + "'");
          const yaw = target.yaw === undefined ? 0 : target.yaw, pitch = target.pitch === undefined ? 0 : target.pitch;
          if (typeof yaw !== "number" || typeof pitch !== "number" || !Number.isFinite(yaw) || !Number.isFinite(pitch) || Math.abs(yaw) > 360 || Math.abs(pitch) > 90) throw new Error("system: look: yaw (-360 .. 360) and pitch (-90 .. 90) are degrees");
          mode = 2; a = yaw * DEG; b = pitch * DEG; key = "d" + yaw + "," + pitch;
        } else if (typeof target === "object" && target.species && typeof target.slot === "number") {
          if (!(target.slot >= 0) || !target.species.alive || !target.species.alive[target.slot] || target.species.gen[target.slot] !== target.gen) throw new Error("system: look: the instance to look at is not alive");
          mode = 3; key = "i" + target.species.js_id + "," + target.slot + "," + target.gen + "," + h;
        } else throw new Error("system: look: the target is { x, y, z }, [x, y, z], { yaw, pitch }, an instance or null");
        key += "|" + w + "|" + flags;
        if (c.look_key === key) return false;
        c.look_key = key;
        q_begin(11); q_u(CMD_HAPPY_LOOK); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(mode); q_u(flags);
        if (mode === 3) { q_u(target.species.js_id); q_u(target.slot); q_u(target.gen); } else { q_f(a); q_f(b); q_f(d); }
        q_f(w); q_f(h);
        return true;
      };
      function face_cmd(sp, c, op, a, v, hold, scale) { q_begin(9); q_u(CMD_HAPPY_FACE); q_u(sp.js_id); q_u(c.slot); q_u(c.gen); q_u(op); q_u(a); q_f(v); q_f(hold); q_f(scale); }
      const face_range = function (ch) { return ch === "jaw" ? [0, 1.2] : (ch === "speak" ? [0, 1] : [-1, 1]); };
      SP.face = function (c, what, intensity, o) {
        live_instance(this, c, "face");
        need_face(this, "face", this.life && this.life.features && this.life.features.face, "face (roles: eyes, lids, jaw, nose, brows, mouth, ears, tail, appendages)");
        o = o || {};
        for (const k in o) if (k !== "hold") throw new Error("system: face: unknown option '" + k + "' (hold)");
        const k = intensity === undefined || intensity === null ? 1 : intensity, hold = o.hold === undefined ? 0 : o.hold;
        if (typeof k !== "number" || !Number.isFinite(k) || k < 0 || k > 4) throw new Error("system: face: the intensity is a number from 0 to 4");
        if (typeof hold !== "number" || !Number.isFinite(hold) || hold < 0 || hold > 3600) throw new Error("system: face: hold is a number of seconds (0 .. 3600)");
        if (typeof what === "string") {
          const id = EXPRESSIONS.indexOf(what);
          if (id < 0) throw new Error("system: face: unknown expression '" + what + "' (" + EXPRESSIONS.join(", ") + ")");
          face_cmd(this, c, 1, id, 0, hold, k);
          return true;
        }
        if (!what || typeof what !== "object" || Array.isArray(what)) throw new Error("system: face: the face is { " + FACE_CHANNELS.join(", ") + " } or the name of an expression");
        const sends = [];                                                                              // (every channel is checked before a command is begun: a throw in the middle would leave half a command in the queue)
        for (const key in what) {
          const ch = FACE_CHANNEL_ALIAS[key] || key, i = FACE_CHANNELS.indexOf(ch);
          if (i < 0) throw new Error("system: face: unknown channel '" + key + "' (" + FACE_CHANNELS.join(", ") + ")");
          const v = what[key], r = face_range(ch);
          if (typeof v !== "number" || !Number.isFinite(v)) throw new Error("system: face: " + key + " must be a number");
          sends.push([i, Math.max(r[0], Math.min(r[1], v * k))]);
        }
        const sp = this;
        sends.forEach(function (s) { face_cmd(sp, c, 0, s[0], s[1], hold, 0); });
        return sends.length > 0;
      };
      SP.speak = function (c, level, seconds) {
        live_instance(this, c, "speak");
        need_face(this, "speak", this.life && this.life.features && this.life.features.speech, "jaw to speak with (roles: jaw)");
        const v = level === true || level === undefined ? 1 : (level === false || level === null ? 0 : level), s = seconds === undefined ? 0 : seconds;
        if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) throw new Error("system: speak: the level is a number from 0 to 1 (or true / false)");
        if (typeof s !== "number" || !Number.isFinite(s) || s < 0 || s > 3600) throw new Error("system: speak: seconds is a number from 0 to 3600 (0: until it is changed)");
        face_cmd(this, c, 0, FACE_CHANNELS.indexOf("speak"), v, s, 0);
        return true;
      };
      SP.face_act = function (c, what) {
        live_instance(this, c, "face_act");
        need_face(this, "face_act", this.life && this.life.features && (this.life.features.face || this.life.features.look), "face (roles: eyes, lids, jaw, nose, ears, tail ...)");
        const list = Array.isArray(what) ? what : [what];
        let bits = 0;
        list.forEach(function (n) { if (FACE_ACTS[n] === undefined) throw new Error("system: face_act: unknown act '" + n + "' (" + Object.keys(FACE_ACTS).join(", ") + ")"); bits |= FACE_ACTS[n]; });
        if (!bits) throw new Error("system: face_act: nothing to do (" + Object.keys(FACE_ACTS).join(", ") + ")");
        face_cmd(this, c, 2, bits, 0, 0, 0);
        return true;
      };
      SP.face_channels = FACE_CHANNELS;

      // ---- the soft tissue: the page's calls (body.cpp, happy_life_soft; CMD_HAPPY_SOFT) ---------------------------------------------------------------------------
      //   sp.set_soft(c, intensity)      the instance's soft tissue, 0 .. 4: 0 is off completely (nothing of it is worked out or kept, the overlay of those bones is what the other layers make), 1 what the family made (a new instance has 1),
      //                                  more exaggerates it; the worker eases to a new number in a quarter of a second; the family's trait `soft` multiplies it. The same number again sends nothing. A species with no soft bones refuses
      //   sp.soft_settings(bone?)        the soft bones and their numbers as the worker has them: [{ bone, slot, stiffness (Hz), damping, gain, limit, axis }] (a copy), or the row of one bone (null when it is not soft)
      //   sp.tune_soft(bone, { stiffness | hz, damping, gain, limit, axis })     the numbers of ONE soft bone for every instance of the species, while it runs (each checked as the compile checks it; the bone has to be soft already)
      function need_soft(sp, what) { if (!sp.life || !sp.life.soft_table || !sp.life.soft_table.length) throw new Error("system: " + what + ": species '" + sp.name + "' has no soft tissue (a bone with `soft` in its skeleton entry, or roles: { soft: [bones] })"); }
      SP.set_soft = function (c, intensity) {
        live_instance(this, c, "set_soft");
        need_soft(this, "set_soft");
        if (typeof intensity !== "number" || !Number.isFinite(intensity) || intensity < 0 || intensity > 4) throw new Error("system: set_soft: the intensity is a number from 0 to 4 (" + intensity + ")");
        if ((c.soft === undefined ? 1 : c.soft) === intensity) return false;
        c.soft = intensity;
        q_begin(7); q_u(CMD_HAPPY_SOFT); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(0); q_u(0); q_f(intensity);
        return true;
      };
      SP.soft_settings = function (bone) {
        const t = this.life ? this.life.soft_table : null;
        if (!t) return bone === undefined ? [] : null;
        const copy = function (r) { return Object.assign({}, r, { axis: r.axis.slice() }); };
        if (bone === undefined) return t.map(copy);
        const row = t.filter(function (r) { return r.bone === bone || r.slot === bone; })[0];
        return row ? copy(row) : null;
      };
      SP.tune_soft = function (bone, settings) {
        need_soft(this, "tune_soft");
        const t = this.life.soft_table, j = t.findIndex(function (r) { return r.bone === bone || r.slot === bone; });
        if (j < 0) throw new Error("system: tune_soft: '" + bone + "' is not a soft bone of species '" + this.name + "' (" + t.map(function (r) { return r.bone; }).join(", ") + ")");
        if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("system: tune_soft: the numbers are { " + SOFT_FIELDS + " }");
        for (const k in settings) if (k !== "hz" && k !== "axis" && SOFT_PARAM[k] === undefined) throw new Error("system: tune_soft: unknown number '" + k + "' (" + SOFT_FIELDS + ")");
        const given = Object.assign({}, settings);
        if (given.hz !== undefined) { if (given.stiffness !== undefined) throw new Error("system: tune_soft: stiffness and hz are the same number: give one"); given.stiffness = given.hz; delete given.hz; }
        const size = this.life.size, row = t[j], out = [];                                         // (every number is checked before a command is begun)
        Object.keys(given).forEach(function (k) {
          const v = given[k];
          if (k === "axis") {
            if (!Array.isArray(v) || v.length !== 3 || !v.every(function (x) { return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 4; })) throw new Error("system: tune_soft: axis is [x, y, z]: the weight of each of the model's axes, 0 .. 4");
            for (let m = 0; m < 3; m++) out.push([4 + m, v[m]]);
            return;
          }
          const r = SOFT_RANGES[k], hi = k === "limit" ? size : r[1];
          if (typeof v !== "number" || !Number.isFinite(v) || v < r[0] || v > hi) throw new Error("system: tune_soft: " + k + " = " + v + " is out of range (" + r[0] + " .. " + hi + ")");
          out.push([SOFT_PARAM[k], v]);
        });
        const sp = this;
        out.forEach(function (e) { q_begin(7); q_u(CMD_HAPPY_SOFT); q_u(sp.js_id); q_u(0); q_u(0); q_u(1); q_u((j << 8) | e[0]); q_f(e[1]); });
        Object.keys(given).forEach(function (k) { row[k] = k === "axis" ? given[k].slice() : given[k]; });
        return this.soft_settings(row.bone);
      };

      // ---- the spring chains: the page's calls (body.cpp, happy_life_chains; CMD_HAPPY_SCHAIN) -------------------------------------------------------------------------
      //   sp.chains                      the chains and their numbers as the worker has them: [{ id, bones, slots, hz, damping, gravity, inertia, limit, sway, falloff }] (a copy; [] for a species with none)
      //   sp.chain_intensity(c, v)       the instance's chains, 0 .. 4: 0 is off completely (nothing of it is worked out or kept: the overlay of those bones is what a creature with no chains makes), 1 what the family made (a new
      //                                  instance has 1), more exaggerates it; the worker eases to a new number in a quarter of a second; the family's trait `chains` multiplies it. The same number again sends nothing; a species with
      //                                  no chains refuses
      //   sp.chain_set(chain, which, v)  ONE number of ONE chain for every instance of the species, while it runs (`chain`: its id, or the name of one of its bones; `which`: hz, damping, gravity, inertia, limit, sway, falloff;
      //                                  checked as the compile checks it), or sp.chain_set(chain, { hz, gravity, ... }) for several
      //   sp.chain_colliders              the capsules the chains' links are pushed out of (roles.chain_colliders): [{ bone, a, b, r }], a copy (the model's space at the bind pose); [] when the species has none
      function need_chains(sp, what) { if (!sp.life || !sp.life.chain_table || !sp.life.chain_table.length) throw new Error("system: " + what + ": species '" + sp.name + "' has no spring chains (roles: { chains: [{ bones: [...] }] })"); }
      Object.defineProperty(SP, "chains", { get: function () { const t = this.life ? this.life.chain_table : null; return t ? t.map(function (r) { return Object.assign({}, r, { bones: r.bones.slice(), slots: r.slots.slice() }); }) : []; }, enumerable: false, configurable: true });
      Object.defineProperty(SP, "chain_colliders", { get: function () { const t = this.life ? this.life.collider_table : null; return t ? t.map(function (r) { return { bone: r.bone, a: r.a.slice(), b: r.b.slice(), r: r.r }; }) : []; }, enumerable: false, configurable: true });
      SP.chain_intensity = function (c, intensity) {
        live_instance(this, c, "chain_intensity");
        need_chains(this, "chain_intensity");
        if (typeof intensity !== "number" || !Number.isFinite(intensity) || intensity < 0 || intensity > 4) throw new Error("system: chain_intensity: the intensity is a number from 0 to 4 (" + intensity + ")");
        if ((c.chains === undefined ? 1 : c.chains) === intensity) return false;
        c.chains = intensity;
        q_begin(7); q_u(CMD_HAPPY_SCHAIN); q_u(this.js_id); q_u(c.slot); q_u(c.gen); q_u(0); q_u(0); q_f(intensity);
        return true;
      };
      SP.chain_set = function (chain, which, v) {
        need_chains(this, "chain_set");
        const t = this.life.chain_table, j = typeof chain === "number" ? chain : t.findIndex(function (r) { return r.bones.indexOf(chain) >= 0; });
        if (!(j >= 0 && j < t.length) || j !== (j | 0)) throw new Error("system: chain_set: '" + chain + "' is not a chain of species '" + this.name + "' (the ids 0 .. " + (t.length - 1) + ", or the name of one of the bones: " + t.map(function (r) { return r.bones[0]; }).join(", ") + ")");
        const given = which !== null && typeof which === "object" && !Array.isArray(which) ? which : (function () { const o = {}; o[which] = v; return o; })();
        const out = [];                                                                                          // (every number is checked before a command is begun)
        Object.keys(given).forEach(function (k) {
          if (CHAIN_PARAM[k] === undefined) throw new Error("system: chain_set: unknown number '" + k + "' (" + CHAIN_FIELDS + ")");
          const x = given[k], r = CHAIN_RANGES[k];
          if (typeof x !== "number" || !Number.isFinite(x) || x < r[0] || x > r[1]) throw new Error("system: chain_set: " + k + " = " + x + " is out of range (" + r[0] + " .. " + r[1] + ")");
          out.push([CHAIN_PARAM[k], x, k]);
        });
        const sp = this, row = t[j];
        out.forEach(function (e) { q_begin(7); q_u(CMD_HAPPY_SCHAIN); q_u(sp.js_id); q_u(0); q_u(0); q_u(1); q_u((j << 8) | e[0]); q_f(e[1]); row[e[2]] = e[1]; });
        return Object.assign({}, row, { bones: row.bones.slice(), slots: row.slots.slice() });
      };

      // ========================================================================================================================
      // style
      // ========================================================================================================================
// system.js, a part: the LIVE gait style: a style of the library put on a gait of a species that stays built (world.cpp).
// It is not a module of its own: system.js includes it, by the bundler's import directive, in the middle of the closure that makes engine.system, so it sees every name of the parts before it and they see its own.
// The order of the parts is the order in system.js (after the species: it adds to the species' prototype).
      // ---- a gait style while the creature walks -----------------------------------------------------------------------------------------------------------------
      //   sp.set_style(style, { gait?, upper?, feet?, fade?, probe? }) -> { gait, gaits, from, feet, upper, fade }
      //     `style` is the NAME of a registered style (system.gaits) or a style object (registered under its name). The legs are compiled again by the code that builds a species from a style (compile_legs: the numbers
      //     of the style in this creature's own leg lengths, the foot's path, the order the legs step in, the feet, the upper body) and the result goes to the worker as ONE command (CMD_HAPPY_STYLE, world.cpp), checked
      //     in whole there before a word is written: nothing is built again, every instance of the species walks in the style from the next frame, the species, its instances and its mesh are the same. `gait` says which
      //     gait of the species (0), `upper` and `feet` the creature's say on the style as the gait's own (true, false, or shares: kernel.js), `fade` the seconds it takes to go from the style it has to the new one (0.4 by
      //     default: the numbers, the foot's path, the order of the steps, the feet and the upper body are mixed along the way, so that a style given in the middle of a walk is not a jump; 0: at once, what a slider that
      //     turns a dial wants, and what a species built from the style has). `probe: false` leaves the rig's measuring of the legs' reach out of this command even if the style moves the ride height (it costs a person
      //     1.3 ms, a spiderbot 6.6, native: a slider that is dragged says it each frame and the page gives the style once more, without it, when the slider rests). A gait that the creature named numbers for (speed, stride, swing, step_height, bob,
      //     ride, path) takes the style's instead, as a creature built for a style does (happy_lab.js: with_style); what the style does not say (crouch, run_stride ...) stays the creature's. A later gait that names no style of
      //     its own is made of the first one's (a build makes it so): it is sent with it.
      //     WHAT THE SPECIES WAS BUILT WITHOUT IS NOT SWITCHED ON: the feet need columns that only a species built from a style that has feet (or a gait that says `feet`) has, the upper body needs roles to be played: the answer says
      //     which of them were sent (`feet`, `upper`). The body's top speed is the one it was built with.
      SP.set_style = function (style, o) {
        need(this, "set_style", "legs");
        const plan = style_plan(this, style, o), n = plan.n, name = plan.name, fade = plan.fade, lg = plan.lg, legs2 = plan.legs2, with_feet = plan.with_feet, with_upper = plan.with_upper, todo = plan.todo, js = this.js_id;
        const sent = [];
        todo.forEach(function (i, k) {
          const g = lg.gaits[i], up = lg.uppers[i], ft = lg.feets[i], len = 4 + GAIT_FIELDS.length + 1 + PATH_POINTS * 4 + (with_upper ? UPPER_WORDS : 0) + (with_feet ? FEET_WORDS : 0) + (n === 0 && k === 0 ? lg.legs.length : 0);
          q_begin(2 + len); q_u(CMD_HAPPY_STYLE); q_u(len); q_u(js); q_u(i); q_u(1 | 2 | (with_upper ? 4 : 0) | (with_feet ? 8 : 0) | (n === 0 && k === 0 ? 16 : 0) | (!plan.probe ? 64 : 0)); q_f(fade);
          GAIT_FIELDS.forEach(function (key) { q_f(g.numbers[key]); });
          q_u(g.path ? g.path.length : 0);
          for (let j = 0; j < PATH_POINTS * 4; j++) q_f(g.path && j < g.path.length * 4 ? g.path[(j / 4) | 0][j % 4] : 0);
          if (with_upper) { q_u(up.mask); q_f(up.ref); for (let j = 0; j < UPPER_N; j++) q_f(up.table[j]); }
          if (with_feet) { q_u(ft ? ft.mask : 0); for (let j = 0; j < 3 * FEET_N; j++) q_f(ft ? ft.table[j] : 0); }
          if (n === 0 && k === 0) lg.legs.forEach(function (l) { q_f(l.phase); });
          sent.push(i);
        });
        // what the page knows of the species is what the worker has now
        const mine = this.legs;
        sent.forEach(function (i) { mine.gaits[i] = lg.gaits[i]; mine.uppers[i] = lg.uppers[i]; if (mine.feets) mine.feets[i] = lg.feets[i]; });
        if (sent[0] === 0) lg.legs.forEach(function (l, k) { mine.legs[k].phase = l.phase; });
        this.style_legs = legs2;
        return { gait: n, gaits: sent.slice(), from: name, feet: with_feet, upper: with_upper, fade: fade };
      };
