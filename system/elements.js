packing()("happy_elements", function happy_elements() {
  "use strict";
  // THE ELEMENTS of an environment, made visible: the list `elements` of a world's document (structures.js: a rock, a house, a tree ...) as instances of static meshes on the ground. It is the LOOK only: no physics, no creature, no mind.
  // The editor shows a document with it (what is drawn is the document and nothing else: an element that is moved is a change of the document, and the look follows it), the sandbox shows the same document, and the compile of a game will keep what it makes.
  // One module for both, like environment.js. It draws nothing itself: the host adds `system.render_all` to the passes (the environment's draw_color and draw_shadow), which draws every static species.
  //
  //   const run = create({ system, structures, ground: function () { return { y(x, z) } | null }, on_error(text) })
  //   run.set(list) -> Promise<run>         the list is the truth: instances are made, moved and let go until it is shown (a species is meshed the first time its type and numbers are asked for: about 0.1 s each); the newest call wins when several wait
  //   run.patch({ set: { group: list }, drop: [group] }) -> Promise<run>     a world that is STREAMED shows its elements in GROUPS (a location: the grouping of a streamed world, `locations.js` of `happy`, which is not kept here): `set` makes a group's list the truth (the elements of the other groups are not touched), `drop` lets a whole group go.
  //                                         The calls are done one after the other, in the order they were made (a `set` of the whole list, above, takes the place of every call made before it). An element's id is unique over all the groups.
  //   run.batch_list() -> [{ group, tris, count, origin, bounds (the mesh's box in the frame of its instance: plus the origin it is the world's), species }]   the meshes the buildings of the groups are drawn as (see MESH RECIPES)
  //   run.resync() -> Promise<run>          the definitions of the units changed (o.units(def)): every unit whose kind, seed or dials changed is made again as the new species, the others stay
  //   run.groups() -> { group: count }      run.group_of(id) -> group | null      run.has_group(group)
  //   run.regrade()                         every element is put on the ground again (the terrain was built again)
  //   run.preview(id, { x, z, yaw, scale, dy, pitch, roll })    moves ONE instance now (a gizmo being dragged: the document is changed when the drag ends)      run.unpreview(id)  puts it back where the list had it
  //   run.pick(origin, dir) -> { id, t } | null    the nearest element a ray hits (its box: oriented, scaled)      run.near(x, z, r) -> [id]  the elements within r metres of a point (the brush)
  //   run.obb(id) -> { center, q, half } | null    the box round an element in the world (a selection is drawn with it)      run.y_of(e) -> metres: where the element stands      run.type_bounds(type, p) -> { lo, hi }
  //   run.position(id) -> { x, y, z, yaw, scale } | null  where an instance is now      run.errors -> [text]      run.stats() -> { elements, shown, species, batches, groups, by_type: { rock: 3 }, pending (jobs that wait), triangles }      run.dispose()
  //   CREATURE RECIPES (none now: the `unit` recipe was in the unit kit of `happy`): a recipe with `creature: true` makes its species with `system.unit(kind, { seed, dials })` from the definition `create({ units(def) -> { kind, seed, dials } | null, units_ready() -> Promise })` says (no mind: the unit stands), and stands ON the ground (`sink: 0`).
  //   MESH RECIPES (none now: `building` was in the house kit of `happy`): the elements of a recipe with `mesh: true` are not species of their own: the ones of a group are drawn as ONE mesh (see BATCHES below), one species a location, made again when the group's buildings or the ground change.
  // Node 14 and the bundler's parser: no optional chaining, no ??, no class, no async functions.
  const DEG = Math.PI / 180, MAX_PER_SPECIES = 16384, KEEP_SPECIES = 96;

  function create(o) {
    const system = o.system, S = o.structures;
    const run = { errors: [], shown: 0 };
    const species = new Map();                         // key -> { key, type, p, sdf, bounds, name, sp, max, count, def }
    const inst = new Map();                            // id -> { e, rec, c, key, put: { x, y, z, yaw, scale }, group }
    const counts = new Map();                          // group -> how many elements it has (the valid ones)
    const batches = new Map();                         // group -> { sp, c, sig, tris, count, origin }: the one mesh of the buildings (the elements of a mesh recipe) of a group
    let chain = Promise.resolve(), latest = 0, latest_all = 0, pending = 0, counter = 0, disposed = false, ground_gen = 0;
    const fail = function (text) { if (run.errors.indexOf(text) < 0) run.errors.push(text); if (run.errors.length > 40) run.errors.shift(); if (o.on_error) o.on_error(text); };
    const ground = function () { return o.ground ? o.ground() : null; };
    const gy = function (x, z) { const g = ground(); return g ? g.y(x, z) : 0; };
    const pow2 = function (n) { let v = 16; while (v < n) v *= 2; return v; };
    run.y_of = function (e) { const R = S.RECIPES[e.type]; return gy(e.x, e.z) - (R && R.sink !== undefined ? R.sink : S.SINK) + (e.dy || 0); };

    // ---- species: one a type and its numbers, with room for the instances it has (made bigger when it is not enough). A CREATURE recipe (`creature: true`: the unit) makes its species with the system's generators, from the definition the host says (`o.units(def)`
    // -> { kind, seed, dials }): one species for each (definition number, its kind, seed and dials), so a definition that is changed is another species and the instances of the old one are made again (`run.resync()`); `o.units_ready()` is a promise of the pack.
    const is_creature = function (type) { const R = S.RECIPES[type]; return !!(R && R.creature); };
    const sink_of = function (type) { const R = S.RECIPES[type]; return R && R.sink !== undefined ? R.sink : S.SINK; };
    const def_id = function (e) { const R = S.RECIPES[e.type]; return e.p && e.p.def !== undefined ? e.p.def : (R && R.params.def ? R.params.def[0] : 1); };
    const unit_of = function (e) { return o.units ? o.units(def_id(e)) : null; };
    const key_for = function (e) {
      if (!is_creature(e.type)) return S.key_of(e.type, e.p);
      const d = unit_of(e);
      return S.key_of(e.type, e.p) + "#" + (d ? JSON.stringify([d.kind, d.seed, d.dials || null]) : "missing");
    };
    const mesh_bounds = function (sp) {
      const m = sp && sp.mesh_src, P = m && m.positions;
      if (!P || P.length < 3) return null;
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i + 2 < P.length; i += 3) for (let k = 0; k < 3; k++) { const v = P[i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
      return lo.concat(hi).every(isFinite) ? { lo: lo, hi: hi } : null;
    };
    function make_creature(rec, max) {
      const d = rec.unit;
      return Promise.resolve(o.units_ready ? o.units_ready() : null).then(function () { throw new Error("a creature recipe needs system.unit, which is not in this repo"); }).then(function (u) {
        if (disposed) return null;
        const def = Object.assign({}, u.def, { name: rec.name + "_" + max, max_instances: max });
        const sp = system.species(def, { mind: false });                                                  // (a unit of the editor stands: it is authored here and plays in the sandbox)
        rec.sp = sp; rec.max = max; rec.def = def; rec.card = u.artifact || null;
        rec.bounds = mesh_bounds(sp) || rec.bounds;
        return rec;
      });
    }
    function make_species(rec, max) {
      if (rec.creature) return make_creature(rec, max);
      const def = S.species_def(rec.name, rec.sdf, max);
      return Promise.resolve(system.build_sdf(def)).then(function () {
        if (disposed) return null;
        const sp = system.species(def, { static: true });
        rec.sp = sp; rec.max = max; rec.def = def;
        return rec;
      });
    }
    function ensure(type, p, need, key, e0) {
      need = Math.min(need, MAX_PER_SPECIES);                                                        // (more than that of one kind are not shown: the mesh is not made again for them every time)
      key = key || S.key_of(type, p);
      let rec = species.get(key);
      if (!rec) {
        if (is_creature(type)) {
          const d = e0 ? unit_of(e0) : null;
          if (!d) { fail("a unit of a definition that is not there (" + (e0 ? def_id(e0) : "?") + ")"); return Promise.resolve(null); }
          rec = { key: key, type: type, p: p, sdf: null, bounds: { lo: [-0.4, 0, -0.4], hi: [0.4, 1.8, 0.4] }, name: "el_unit_" + (++counter), sp: null, max: 0, count: 0, def: null, failed: false, building: null, creature: true, unit: { kind: d.kind, seed: d.seed, dials: d.dials || {} } };
        } else {
          let sdf;
          try { sdf = S.sdf_of(type, p); } catch (e) { fail(String(e && e.message || e).replace(/^structures: /, "")); return Promise.resolve(null); }
          rec = { key: key, type: type, p: p, sdf: sdf, bounds: S.bounds(sdf), name: "el_" + type + "_" + (++counter), sp: null, max: 0, count: 0, def: null, failed: false, building: null };
        }
        species.set(key, rec);
      }
      if (rec.failed) return Promise.resolve(null);
      if (rec.sp && rec.max >= need) return Promise.resolve(rec);
      if (rec.building) return rec.building.then(function () { return ensure(type, p, need, key, e0); });
      const max = Math.min(MAX_PER_SPECIES, pow2(Math.ceil(need * 1.5))), old = rec.sp;
      rec.building = make_species(rec, max).then(function (r) {
        rec.building = null;
        if (r && old) {                                                                              // (it was too small: the instances it had go to the new one, then it goes)
          inst.forEach(function (it) {
            if (it.rec !== rec || !it.c || it.c.species !== old) return;
            old.release(it.c); it.c = rec.sp.spawn({ x: it.put.x, y: it.put.y, z: it.put.z, scale: it.put.scale, yaw: it.put.yaw }); if (it.put.pitch || it.put.roll) it.c.species.set_root(it.c, it.put.x, it.put.y, it.put.z, quat(it.put.yaw, it.put.pitch, it.put.roll), it.put.scale);
          });
          try { old.dispose(); } catch (e) { /* gone */ }
        }
        return r;
      }, function (e) {
        rec.building = null; rec.failed = true;
        fail("the " + (rec.creature ? "unit" : type) + " could not be made: " + String(e && e.message || e).replace(/^system: /, ""));
        return null;
      });
      return rec.building;
    }

    // ---- the transform of an instance
    // the turn of an element: about up by `yaw`, then (about its own x) so that its +z end climbs by `pitch`, then (about its own z) so that its +x side climbs by `roll`: q = Ry(yaw) Rx(-pitch) Rz(roll)
    const quat = function (yaw, pitch, roll) {
      if (!pitch && !roll) { const h = 0.5 * yaw; return [0, Math.sin(h), 0, Math.cos(h)]; }
      const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cx = Math.cos(-(pitch || 0) / 2), sx = Math.sin(-(pitch || 0) / 2), cz = Math.cos((roll || 0) / 2), sz = Math.sin((roll || 0) / 2);
      const ax = cy * sx, ay = sy * cx, az = -sy * sx, aw = cy * cx;
      return [ax * cz + ay * sz, -ax * sz + ay * cz, aw * sz + az * cz, aw * cz - az * sz];
    };
    const target = function (e) { return { x: e.x, y: run.y_of(e), z: e.z, yaw: (e.yaw || 0) * DEG, pitch: (e.pitch || 0) * DEG, roll: (e.roll || 0) * DEG, scale: e.scale === undefined ? 1 : e.scale }; };
    const put = function (it, t) {
      it.put = t;
      if (it.batch !== undefined) return;                                                                 // (a member of a batch is in the mesh of its group: only its box moves)
      it.c.species.set_root(it.c, t.x, t.y, t.z, quat(t.yaw, t.pitch, t.roll), t.scale);
    };
    const same = function (a, b) { return a.x === b.x && a.y === b.y && a.z === b.z && a.yaw === b.yaw && a.pitch === b.pitch && a.roll === b.roll && a.scale === b.scale; };
    const same_p = function (a, b) { return JSON.stringify(a || null) === JSON.stringify(b || null); };

    // ---- BATCHES: the elements of a MESH RECIPE (none now: the house kit of `happy` had them; `mesh: true` and `draw(M, p, ctx)` in the recipe) are drawn together, the ones of a group (a location) as ONE mesh and ONE species, not a species each: a city is 1,500 buildings
    // and one mesh for each location, where the modules made 69,000 elements and 226 meshes. The mesh is made again when the group's buildings change (or the ground under them: a plinth is as deep as the ground says), and the old one is shown until the new one is there.
    // A member of a batch is an element like any other to the asking (pick, obb, near, position: its box is what `draw` said); a preview of one (a gizmo's drag) moves its box and not its walls: the mesh follows when the drag ends.
    const is_mesh = function (type) { const R = S.RECIPES[type]; return !!(R && R.mesh); };
    const sig_of = function (list) {
      let h = ground_gen + ":";
      list.forEach(function (e) { h += e.id + "|" + e.type + "|" + e.x + "|" + e.z + "|" + (e.yaw || 0) + "|" + (e.scale === undefined ? 1 : e.scale) + "|" + (e.dy || 0) + "|" + (e.pitch || 0) + "|" + (e.roll || 0) + "|" + JSON.stringify(e.p || null) + ";"; });
      return h;
    };
    // the mesh of a list of elements, in slices of about 8 ms with a frame between them: the frame of the mesh is the middle of the buildings at the lowest of their heights (the numbers in it stay small: each building is pushed into that frame, so finish() is not given the origin again)
    function build_batch(list) {
      if (typeof S.mesh_builder !== "function") return Promise.reject(new Error("a mesh recipe is asked for and the structures have no mesh builder (no recipe of this folder is a mesh recipe)"));
      const M = S.mesh_builder(), boxes = new Array(list.length);
      let sx = 0, sz = 0, miny = Infinity;
      list.forEach(function (e) { sx += e.x; sz += e.z; miny = Math.min(miny, run.y_of(e)); });
      const origin = [Math.round(sx / list.length), Math.round(miny), Math.round(sz / list.length)];
      let i = 0;
      return new Promise(function (resolve, reject) {
        const step = function () {
          if (disposed) { resolve(null); return; }
          const t0 = Date.now();
          try {
            while (i < list.length && Date.now() - t0 < 8) {
              const e = list[i], R = S.RECIPES[e.type], yaw = (e.yaw || 0) * DEG, k = e.scale === undefined ? 1 : e.scale, y = run.y_of(e), c = Math.cos(yaw), s = Math.sin(yaw);
              const ground_here = function (lx, lz) { return gy(e.x + (lx * c + lz * s) * k, e.z + (-lx * s + lz * c) * k) - y; };       // (the ground over the element's own origin, at a place of its own frame)
              M.push(e.x - origin[0], y - origin[1], e.z - origin[2], yaw, k, (e.pitch || 0) * DEG, (e.roll || 0) * DEG);
              try { boxes[i] = R.draw(M, e.p || {}, { ground: ground_here }); }
              catch (err) { fail((e.id || "a building") + ": " + String(err && err.message || err).replace(/^[a-z_]+: /, "")); boxes[i] = { lo: [-1, 0, -1], hi: [1, 3, 1] }; }                  // (one that cannot be drawn is said and left out: the others of its group are still shown)
              M.pop();
              i++;
            }
          } catch (err) { reject(err); return; }
          if (i < list.length) setTimeout(step, 0); else resolve({ geometry: M.finish(), boxes: boxes, origin: origin });
        };
        step();
      });
    }
    const drop_batch = function (gid) {
      const b = batches.get(gid);
      if (!b) return;
      try { b.sp.release(b.c); } catch (e) { /* gone */ }
      try { b.sp.dispose(); } catch (e) { /* gone */ }
      batches.delete(gid);
    };
    // the batches of the groups in `lists` ({ group: [element] }, the mesh elements it has now): one that has nothing is let go, one that is the same is kept, the others are made (one after the other) and shown, the old one let go after
    function batch_pass(lists, force) {
      let pr = Promise.resolve();
      Object.keys(lists).forEach(function (gid) {
        const list = lists[gid], cur = batches.get(gid);
        if (!list.length) { drop_batch(gid); return; }
        const sig = sig_of(list);
        if (cur && cur.sig === sig && !force) { list.forEach(function (e) { const it = inst.get(e.id); if (it) it.e = e; }); return; }
        pr = pr.then(function () {
          if (disposed) return null;
          return build_batch(list).then(function (r) {
            if (!r || disposed) return null;
            const g = r.geometry;
            if (!g.triangles) { fail("a group of buildings has nothing to draw (" + list.length + " elements)"); return null; }
            const def = { name: "el_batch_" + (++counter), max_instances: 1, skeleton: [{ name: "root", head: [0, 0, 0], tail: [0, 0.1, 0] }], mesh: { positions: g.positions, normals: g.normals, indices: g.indices, colors: g.colors } };
            const sp = system.species(def, { static: true }), c = sp.spawn({ x: r.origin[0], y: r.origin[1], z: r.origin[2], scale: 1, yaw: 0 });
            const old = batches.get(gid);
            batches.set(gid, { sp: sp, c: c, sig: sig, tris: g.triangles, count: list.length, origin: r.origin, bounds: g.bounds });
            if (old) { try { old.sp.release(old.c); } catch (e) { /* gone */ } try { old.sp.dispose(); } catch (e) { /* gone */ } }
            list.forEach(function (e, i) { inst.set(e.id, { e: e, rec: { bounds: r.boxes[i] }, c: null, key: e.type, put: target(e), preview: false, group: gid, batch: gid }); });
            run.shown = inst.size;
            return null;
          }).catch(function (e) { fail("buildings could not be made: " + String(e && e.message || e).replace(/^system: /, "")); return null; });
        });
      });
      return pr;
    }

    // ---- a job: the elements of some groups are shown. A GROUP is what is shown and let go together (a location, when the world is streamed); `set(list)` is one group, "", that is the whole list (every group that there is is replaced by it).
    // What is let go goes at ONCE; the elements of a mesh recipe (buildings) are made into a mesh a group, then what can be shown (its species is made) is shown; the kinds that are not made yet follow, the biggest first, each shown when its species is there (a district
    // appears piece by piece and not all at once after the last mesh). A long list of one kind is made in slices of 1500 with a frame between them.
    function apply(job) {
      if (job.resync) {                                                                                   // (a definition of a unit changed: the groups that have units are set again as they are; a unit of another species is made again)
        const groups = {}, set = {};
        inst.forEach(function (it) { if (is_creature(it.e.type)) groups[it.group] = true; });
        inst.forEach(function (it) { if (groups[it.group]) (set[it.group] = set[it.group] || []).push(it.e); });
        job = { all: false, set: set, drop: [] };
      }
      if (job.rebuild) {                                                                                  // (the ground changed: every batch is made again, from the elements it has)
        const lists = {};
        inst.forEach(function (it) { if (it.batch !== undefined) (lists[it.batch] = lists[it.batch] || []).push(it.e); });
        return batch_pass(lists, true).then(function () { run.shown = inst.size; return run; });
      }
      const sets = job.all ? { "": job.list } : (job.set || {}), drops = job.all ? [] : (job.drop || []);
      const gids = Object.keys(sets), affected = {}, want = {}, seen = {}, by_key = {}, valid = {}, meshes = {};
      if (job.all) { inst.forEach(function (it) { affected[it.group] = true; }); batches.forEach(function (b, g) { affected[g] = true; }); }
      gids.forEach(function (g) { affected[g] = true; }); drops.forEach(function (g) { affected[g] = true; });
      gids.forEach(function (gid) {
        const out = valid[gid] = [];
        sets[gid].forEach(function (e) {
          const bad = S.check_element(e);
          if (bad) { fail((e && e.id ? e.id : "an element") + ": " + bad); return; }
          if (seen[e.id]) { fail(e.id + ": two elements have this id"); return; }
          const held = inst.get(e.id);
          if (held && !affected[held.group]) { fail(e.id + ": two elements have this id (the other is in " + (held.group === "" ? "the list" : "`" + held.group + "`") + ")"); return; }
          seen[e.id] = true; want[e.id] = e; out.push(e);
          if (is_mesh(e.type)) { (meshes[gid] = meshes[gid] || []).push(e); return; }
          const key = key_for(e), b = by_key[key] = by_key[key] || { type: e.type, p: e.p, n: 0, list: [], e0: e };
          b.n++; b.list.push({ e: e, gid: gid });
        });
      });
      // 1. what the groups no longer have, or have as another type, is let go AT ONCE: a location that is dropped is gone now, not after the meshes of the ones that come have been made
      inst.forEach(function (it, id) {
        if (!affected[it.group]) return;
        const e = want[id];
        if (it.batch !== undefined) { if (!(e && is_mesh(e.type))) inst.delete(id); return; }               // (a member of a batch: its mesh is made again below when the group changed)
        if (e && !is_mesh(e.type) && key_for(e) === it.key && it.rec.sp === it.c.species) return;
        it.c.species.release(it.c); inst.delete(id); it.rec.count--;
      });
      if (job.all) counts.clear();
      drops.forEach(function (g) { counts.delete(g); });
      gids.forEach(function (gid) { counts.set(gid, valid[gid].length); });
      const kept = {};
      inst.forEach(function (it) { if (!affected[it.group] && it.batch === undefined) kept[it.key] = (kept[it.key] || 0) + 1; });
      let skipped = 0;
      // 2. the instances of one kind: made now when the species is there, else after it has been meshed. A long list is made in slices (a frame is drawn between them)
      const SLICE = 1500;
      const spawn_key = function (key) {
        const b = by_key[key], rec = species.get(key);
        if (!rec || !rec.sp) { skipped += b.list.length; return Promise.resolve(); }
        let i = 0;
        const step = function () {
          if (disposed) return Promise.resolve();
          const end = Math.min(b.list.length, i + SLICE);
          for (; i < end; i++) {
            const e = b.list[i].e, gid = b.list[i].gid, t = target(e);
            let it = inst.get(e.id);
            if (it) { it.e = e; it.group = gid; if (!same(it.put, t) || it.preview) { it.preview = false; put(it, t); } continue; }
            if (rec.count >= rec.max) { skipped++; continue; }
            const c = rec.sp.spawn({ x: t.x, y: t.y, z: t.z, scale: t.scale, yaw: t.yaw });
            it = { e: e, rec: rec, c: c, key: key, put: t, preview: false, group: gid };
            if (t.pitch || t.roll) put(it, t);                                                       // (spawn turns about up only: a tilted piece is turned now)
            inst.set(e.id, it); rec.count++;
          }
          run.shown = inst.size;
          return i < b.list.length ? new Promise(function (r) { setTimeout(r, 0); }).then(step) : Promise.resolve();
        };
        return step();
      };
      const keys = Object.keys(by_key), ready = keys.filter(function (k) { const r = species.get(k); return r && r.sp && !r.building && r.max >= by_key[k].n + (kept[k] || 0); }), later = keys.filter(function (k) { return ready.indexOf(k) < 0; }).sort(function (a, b) { return by_key[b].n - by_key[a].n; });
      const lists = {};
      Object.keys(affected).forEach(function (g) { lists[g] = meshes[g] || []; });
      let pr = batch_pass(lists, false);                                                                  // (the buildings first: they are most of what is seen of a place)
      ready.forEach(function (k) { pr = pr.then(function () { return spawn_key(k); }); });                  // (what can be shown is shown first)
      later.forEach(function (k) { pr = pr.then(function () { return ensure(by_key[k].type, by_key[k].p, by_key[k].n + (kept[k] || 0), k, by_key[k].e0); }).then(function () { return spawn_key(k); }); });
      return pr.then(function () {
        if (disposed) return run;
        if (skipped) fail(skipped + " elements are not shown (their type could not be made, or there are more than " + MAX_PER_SPECIES + " of one)");
        run.shown = inst.size;
        if (species.size > KEEP_SPECIES) species.forEach(function (rec, key) { if (rec.count === 0 && rec.sp && !rec.building) { try { rec.sp.dispose(); } catch (e) { /* gone */ } species.delete(key); } });
        return run;
      });
    }
    // the jobs are done one after the other, in order; a job that sets the whole list takes the place of every one made before it
    function enqueue(job) {
      job.ticket = ++latest; if (job.all) latest_all = job.ticket;
      pending++;
      chain = chain.then(function () { return job.ticket < latest_all ? run : apply(job); }).catch(function (e) { fail(String(e && e.message || e)); return run; }).then(function (r) { pending--; return r; });
      return chain;
    }
    run.set = function (list) { return enqueue({ all: true, list: list }); };
    run.patch = function (o) {
      o = o || {};
      if (o.set !== undefined && (!o.set || typeof o.set !== "object" || Array.isArray(o.set))) throw new Error("elements: patch.set is { group: [element ...] }");
      if (o.drop !== undefined && !Array.isArray(o.drop)) throw new Error("elements: patch.drop is [group ...]");
      return enqueue({ all: false, set: o.set, drop: o.drop });
    };
    run.batch_list = function () { const out = []; batches.forEach(function (b, g) { out.push({ group: g, tris: b.tris, count: b.count, origin: b.origin.slice(), bounds: b.bounds, species: b.sp }); }); return out; };                  // (the meshes of the buildings: what a test or a debug view asks for)
    run.resync = function () { return enqueue({ resync: true }); };                                      // (the definitions of the units changed)
    run.groups = function () { const out = {}; counts.forEach(function (n, g) { out[g] = n; }); return out; };
    run.has_group = function (g) { return counts.has(g); };
    run.group_of = function (id) { const it = inst.get(id); return it ? it.group : null; };
    run.regrade = function () {
      inst.forEach(function (it) { if (!it.preview) put(it, target(it.e)); });
      if (batches.size) { ground_gen++; enqueue({ rebuild: true }); }                                    // (the buildings are made again: a plinth is as deep as the ground says)
    };
    run.preview = function (id, v) {
      const it = inst.get(id);
      if (!it) return false;
      const t = target(Object.assign({}, it.e, v));
      it.preview = true; put(it, t);
      return true;
    };
    run.unpreview = function (id) { const it = inst.get(id); if (it && it.preview) { it.preview = false; put(it, target(it.e)); } };

    // ---- asking
    run.type_bounds = function (type, p) { const rec = species.get(S.key_of(type, p)); return rec ? rec.bounds : S.bounds(S.sdf_of(type, p)); };
    const frame = function (it) {
      const t = it.put, c = Math.cos(t.yaw), s = Math.sin(t.yaw), b = it.rec.bounds;
      return { t: t, c: c, s: s, b: b };
    };
    run.obb = function (id) {
      const it = inst.get(id);
      if (!it) return null;
      const f = frame(it), b = f.b, k = f.t.scale, cx = (b.lo[0] + b.hi[0]) / 2 * k, cy = (b.lo[1] + b.hi[1]) / 2 * k, cz = (b.lo[2] + b.hi[2]) / 2 * k;
      return { center: [f.t.x + cx * f.c + cz * f.s, f.t.y + cy, f.t.z - cx * f.s + cz * f.c], q: quat(f.t.yaw, f.t.pitch, f.t.roll), half: [(b.hi[0] - b.lo[0]) / 2 * k, (b.hi[1] - b.lo[1]) / 2 * k, (b.hi[2] - b.lo[2]) / 2 * k] };
    };
    // the ray in the element's own frame (translated, turned back, divided by the scale: the same t), against its box
    run.pick = function (origin, dir) {
      let best = null;
      inst.forEach(function (it, id) {
        const f = frame(it), b = f.b, k = f.t.scale, rx = origin[0] - f.t.x, ry = origin[1] - f.t.y, rz = origin[2] - f.t.z;
        const r = Math.max(b.hi[0] - b.lo[0], b.hi[2] - b.lo[2], b.hi[1] - b.lo[1]) * k;                    // (a sphere first: the box only for what is near the ray)
        const mx = f.t.x, my = f.t.y + (b.lo[1] + b.hi[1]) / 2 * k, mz = f.t.z, wx = mx - origin[0], wy = my - origin[1], wz = mz - origin[2], tc = wx * dir[0] + wy * dir[1] + wz * dir[2];
        const d2 = wx * wx + wy * wy + wz * wz - tc * tc;
        if (d2 > r * r) return;
        const ox = (rx * f.c - rz * f.s) / k, oy = ry / k, oz = (rx * f.s + rz * f.c) / k, dx = (dir[0] * f.c - dir[2] * f.s) / k, dy = dir[1] / k, dz = (dir[0] * f.s + dir[2] * f.c) / k;
        let t0 = 0, t1 = Infinity;
        const o3 = [ox, oy, oz], d3 = [dx, dy, dz];
        for (let a = 0; a < 3; a++) {
          if (Math.abs(d3[a]) < 1e-12) { if (o3[a] < b.lo[a] || o3[a] > b.hi[a]) return; continue; }
          let u0 = (b.lo[a] - o3[a]) / d3[a], u1 = (b.hi[a] - o3[a]) / d3[a];
          if (u0 > u1) { const x = u0; u0 = u1; u1 = x; }
          t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
          if (t0 > t1) return;
        }
        if (!best || t0 < best.t) best = { id: id, t: t0 };
      });
      return best;
    };
    run.position = function (id) { const it = inst.get(id); return it ? { x: it.put.x, y: it.put.y, z: it.put.z, yaw: it.put.yaw, scale: it.put.scale } : null; };
    run.near = function (x, z, r) {
      const out = [];
      inst.forEach(function (it, id) { if (Math.hypot(it.put.x - x, it.put.z - z) <= r) out.push(id); });
      return out;
    };
    run.stats = function () {
      const by = {}; let tris = 0;
      inst.forEach(function (it) { by[it.e.type] = (by[it.e.type] || 0) + 1; });
      species.forEach(function (rec) { if (rec.sp && rec.count > 0 && rec.sp.mesh_stats) tris += (rec.sp.mesh_stats.triangles || 0) * rec.count; });
      batches.forEach(function (bt) { tris += bt.tris; });
      let elements = 0; counts.forEach(function (n) { elements += n; });
      return { elements: elements, shown: inst.size, species: species.size, batches: batches.size, groups: counts.size, by_type: by, pending: pending, triangles: tris };
    };
    // what the triangles are made of: { type: { elements, triangles } } (a species' mesh x its instances, a batch's mesh as it is): where a frame goes, for a test or a debug view
    run.triangles_by_type = function () {
      const out = {};
      species.forEach(function (rec) { if (rec.sp && rec.count > 0 && rec.sp.mesh_stats) { const o = out[rec.type] = out[rec.type] || { elements: 0, triangles: 0 }; o.elements += rec.count; o.triangles += (rec.sp.mesh_stats.triangles || 0) * rec.count; } });
      batches.forEach(function (b) { const o = out.building = out.building || { elements: 0, triangles: 0 }; o.elements += b.count; o.triangles += b.tris; });
      return out;
    };
    run.dispose = function () {
      disposed = true;
      inst.forEach(function (it) { try { if (it.c) it.c.species.release(it.c); } catch (e) { /* gone */ } });
      species.forEach(function (rec) { try { if (rec.sp) rec.sp.dispose(); } catch (e) { /* gone */ } });
      batches.forEach(function (bt) { try { bt.sp.dispose(); } catch (e) { /* gone */ } });
      inst.clear(); species.clear(); counts.clear(); batches.clear();
    };
    return run;
  }
  return { create: create, MAX_PER_SPECIES: MAX_PER_SPECIES };
});
