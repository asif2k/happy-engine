packing("engine", "events")("happy_environment", function (engine, events) {
  // THE ENVIRONMENT of the editor and of the sandbox (SYSTEM.md): the ground and the sky of a world, as a module like water/water.js: the worker's half (the heights, the biomes, the collision, the chunk quadtree, the rivers,
  // the named places: environment.cpp) and the page's half (the terrain's mesh and shaders, the shadow caster, the sun and the passes) are blocks, and the page gets a namespace on the engine:
  //   const env = engine.environment.create({ world, land? })      world: the document (below); land: the vegetation module, when the world asks for trees and plants
  //   env.ready -> Promise<env>      the worker has made the ground and the page has drawn its maps      env.scene, env.camera, env.world_map, env.world, env.presets      env.ground: { y(x, z), land(x, z), sea, size } once it is made
  //   env.draw_color / env.draw_shadow: lists of functions the host adds to: what it draws in the colour pass and in the shadow pass (its creatures: system.render_all)
  //   engine.environment.world_check(doc) -> the world with the defaults filled in, or an Error that names what is wrong
  // The world is a document: { size (metres a side), terrain: { preset, seed, params, curve, height_scale, normal_slope, rivers }, sun: { azimuth, elevation }, ambient, atmosphere, shadows, vegetation, camera: { fov, near, far, min_height } }, elements: [ ... ] (what stands on the ground: system/elements.js) }.
  // This is the first cut: made once from a world, as the page it was taken from did. What the editor needs on top (a world that is built again when a number changes) comes next.
  consts$({ CMD_GAME_WORLDMAP_CHUNKS: 24350 })


    block$(function worker_process() {
      engine.game = {};

      // The parameters. The wasm (game.cpp) takes each set as a plain array of numbers, in the order of its SBP_ / GCP_ enum, and holds no table, no name and no text: the names, the defaults, the
      // ranges and which ones are whole numbers are here. [name, default, min, max, true if a whole number]. What each one does, and what the ends of its range do, is the comment of its line
      // in game.cpp's enum (and the page's world_map.params / world_map.collision). The ORDER is the enum's: a row added here is a line added there, in the same place.
      const world_param_table = [
        // the world
        ["size", 16384, 64, 1000000],
        ["min_h", -600, -50000, 50000],
        ["max_h", 2600, -50000, 50000],
        ["sea_level", 0, -50000, 50000],
        // the continent
        ["c_wave", 9000, 1, 10000000],
        ["c_oct", 8, 1, 12, true],
        ["c_gain", 0.47, 0, 1],
        ["c_lac", 2, 1.1, 4],
        ["c_contrast", 2.2, 0, 8],
        ["c_warp", 2200, 0, 1000000],
        ["c_warp_wave", 5000, 1, 10000000],
        // the mountains
        ["m_wave", 8000, 1, 10000000],
        ["m_oct", 9, 1, 12, true],
        ["m_gain", 0.43, 0, 1],
        ["m_detail", 2, 0, 10],
        ["m_lac", 2.1, 1.1, 4],
        ["m_warp", 0.08, 0, 4],
        ["m_amount", 0.45, 0, 2],
        ["m_mask_wave", 8000, 1, 10000000],
        ["m_mask_lo", 0.42, 0, 1],
        ["m_mask_hi", 0.72, 0, 1],
        ["m_land", 0.1, 0, 1],
        // the hills
        ["r_wave", 380, 1, 10000000],
        ["r_oct", 5, 1, 12, true],
        ["r_gain", 0.4, 0, 1],
        ["r_amp", 12, 0, 5000],
        ["r_damp", 1.2, 0, 20],
        // the shape of the whole
        ["terrace_steps", 0, 0, 64],
        ["terrace_amount", 0, 0, 1],
        // the edge of the world
        ["edge_mode", 1, 0, 2, true],
        ["edge_margin", 0.22, 0.01, 1],
        ["edge_power", 2, 1, 6, true],
        ["edge_round", 2, 1, 3, true],
        ["edge_noise", 0.15, 0, 0.5],
        ["edge_ocean", 0.2, 0, 0.8],
        ["edge_centre", 0.6, 0, 1],
        ["v_depth", 0, 0, 3000],
        ["v_wave", 6000, 100, 10000000],
        ["v_width", 0.1, 0.002, 0.5],
        ["v_river", 0.15, 0.02, 0.9],
        ["v_warp", 900, 0, 100000],
        ["v_bed", 15, 0, 500],
      ];
      const collision_param_table = [
        ["max_error", 10, 0.1, 200],
        ["min_cell", 0, 0, 4096],
        ["max_cell", 512, 4, 8192],
        ["max_shapes", 2000, 16, 12000, true],
        ["margin_below", 50, 1, 500],
        ["margin_above", 150, 1, 2000],
        ["sea_scale", 4, 1, 100],
      ];

      // The places (game.cpp, the GPP_ enum): what is named where, by the type of the ground (a peak, a lake, a shore, an island, and the plains, hills and mountains
      // that the land is cut into). Names, defaults, ranges and whole numbers are here; what each does is the comment of its line in game.cpp's enum (and the page's world_map.place_params).
      const places_param_table = [
        ["cell", 64, 16, 1024],
        ["peaks", 16, 0, 64, true],
        ["lakes", 12, 0, 64, true],
        ["shores", 12, 0, 64, true],
        ["islands", 12, 0, 64, true],
        ["regions", 6, 0, 32, true],
        ["region_km2", 0.25, 0, 1000],
        ["separation", 1, 0.1, 10],
        ["mountain_m", 100, 0, 50000],
        ["peak_relief", 40, 0, 5000],
        ["gentle", 0.2, 0.01, 2],
      ];
      // the array of a call: the defaults, then what the page gave by name (a value outside its range is clamped, with a warning; the whole numbers are rounded). The numbers go in a few words of the
      // permanent arena taken once per table (`holder`), a typed view of it is made for each call (the memory may have grown since the last one).
      function param_array(table, given, label, holder) {
        if (!holder.ptr) holder.ptr = wa.alloc(table.length * 4);
        const out = new Float32Array(wa.env.memory.buffer, holder.ptr, table.length);
        const index = {};
        for (let i = 0; i < table.length; i++) { out[i] = table[i][1]; index[table[i][0]] = i; }
        for (const name in given) {
          const i = index[name];
          if (i === undefined) { console.warn("game: no " + label + " parameter called", name); continue; }
          const row = table[i];
          let v = +given[name];
          if (v !== v) { console.warn("game: " + label + " parameter", name, "is not a number: the default,", row[1]); v = row[1]; }
          else if (v < row[2] || v > row[3]) {
            const c = v < row[2] ? row[2] : row[3];
            console.warn("game: " + label + " parameter", name, "=", v, "is clamped to", c, "(", row[2], "..", row[3], ")");
            v = c;
          }
          out[i] = row[4] ? Math.round(v) : v;
        }
        return out;
      }
      const world_params_holder = {}, collision_params_holder = {}, world_curve_holder = {}, places_params_holder = {};

      // the collision: ONE static body with a heightmap shape for every cell of a quadtree over the map (game.cpp, game_world_map_collision_setup); the parameters by name, as the world's
      function game_build_collision(given) {
        if (wa.game_collision_param_count() !== collision_param_table.length) throw new Error("game: the collision parameter table here has " + collision_param_table.length + " rows, game.cpp's enum " + wa.game_collision_param_count());
        const col_params = param_array(collision_param_table, given, "collision", collision_params_holder);
        engine.game.collision_boxes = wa.game_world_map_collision_setup(phys_world, engine.game.world_height, engine.game.world_size, col_params.byteOffset);
        const col_stats = wa.fp32_array(8, wa.game_collision_stats());
        engine.game.collision_stats = { boxes: col_stats[0], max_error: col_stats[1], mean_error: col_stats[2], min_box: col_stats[3], max_box: col_stats[4], budget_hit: col_stats[5] > 0, max_error_split: col_stats[6], at_min_size: col_stats[7] };
        const cs = engine.game.collision_stats;
        console.log("game collision: " + cs.boxes + " shapes (budget " + col_params[3] + "), the heights of a shape spread at most " + Math.round(cs.max_error * 100) + " cm (" + Math.round(cs.max_error_split * 100) + " cm in the ones that could be split), mean " + Math.round(cs.mean_error * 100) + " cm, shapes " + Math.round(cs.min_box) + " .. " + Math.round(cs.max_box) + " m, " + cs.at_min_size + " at the smallest size");
      }

      engine.game_boxes = function (data) {
        // GAME: the collision of the structures (game.cpp, game_boxes_build): `rows` is cx, cy, cz, hx, hy, hz, yaw for every box of every placement, one static body of the physics world
        const flat = data.rows, ptr = wa.alloc(Math.max(1, flat.length) * 4);
        new Float32Array(wa.env.memory.buffer, ptr, flat.length).set(flat);
        engine.game.structure_boxes = wa.game_boxes_build(phys_world, ptr, flat.length / 7);
        console.log("game structures: " + engine.game.structure_boxes + " collision boxes of " + flat.length / 7 + " asked");
      };
      // THE PAGE'S OWN MAP (the roads grade the ground: system/grade.js, env.set_heights): the heights go over the generator's in its memory and the collision is made again from them, so the physics' ground is the graded one. `graded` keeps them
      // for a preview that makes the live map again (it is put back after it).
      engine.game_set_map = function (data) {
        const g = engine.game, n = g.map_size, src = new Float32Array(data.data);
        if (!g.map_ptr || src.length !== n * n) { engine.call_main("game_map_set", { id: data.id, error: "game: a map of " + src.length + " heights is not the live map's " + n * n }); return; }
        wa.fp32_array(n * n, g.map_ptr).set(src);
        wa.game_world_map_touched();
        g.graded = data.graded ? src : null;
        wa.scratch_reset();
        game_build_collision(g.collision_given);
        engine.call_main("game_stats", { collision: g.collision_stats, map_size: n, world_size: g.world_size, world_height: g.world_height });
        engine.call_main("game_map_set", { id: data.id });
      };
      // THE DECKS of the bridges (env.set_decks): [cx, cy, cz, hx, hy, hz, yaw, rise] a box, one static body of the physics world (game.cpp game_decks_build), replaced by every call; none takes them away
      engine.game_decks = function (data) {
        const flat = data.rows || [], ptr = wa.alloc(Math.max(1, flat.length) * 4);
        new Float32Array(wa.env.memory.buffer, ptr, flat.length).set(flat);
        engine.game.deck_boxes = wa.game_decks_build(phys_world, ptr, flat.length / 8);
        wa.scratch_reset();
        engine.call_main("game_decks_set", { id: data.id, boxes: engine.game.deck_boxes, asked: flat.length / 8 });
      };
      engine.game_collision = function (data) { game_build_collision(data.collision); };       // (the page can ask for another quality of the ground: engine.call_worker("game_collision", { collision: { max_error: 2 } }))

      // THE HEIGHTS OF A TERRAIN (game.cpp keeps the map, the curve and the rivers of the generator in globals): the numbers go in the arena places of h and game_world_map makes the map, which comes back as a view of the generator's one memory.
      // The live world has places of its own and a preview has its own, so that a preview never writes over numbers that the live world's generator is still holding.
      const live_holders = { params: world_params_holder, curve: world_curve_holder, rivers: {} }, preview_holders = { params: {}, curve: {}, rivers: {} };
      function make_map(data, h) {
        // the tuning parameters by name -> the array of numbers game_world_map takes (the order is game.cpp's SBP_ enum, the table is above); the world's width is the page's
        if (wa.game_world_param_count() !== world_param_table.length) throw new Error("game: the world parameter table here has " + world_param_table.length + " rows, game.cpp's enum " + wa.game_world_param_count());
        const params = param_array(world_param_table, Object.assign({}, data.params, { size: data.world_size }), "world", h.params);
        // the curve: 2 .. 16 points [x, y], x increasing, both 0 .. 1 (the points are numbers in the arena too, taken once)
        const points = data.curve;
        if (!Array.isArray(points) || points.length < 2 || points.length > 16) throw new Error("game: the curve is 2 to 16 points [x, y]");
        if (!h.curve.ptr) h.curve.ptr = wa.alloc(16 * 2 * 4);
        const curve = new Float32Array(wa.env.memory.buffer, h.curve.ptr, 32);
        points.forEach(function (p, i) {
          const x = Math.min(1, Math.max(0, +p[0])), y = Math.min(1, Math.max(0, +p[1]));
          if (i > 0 && !(x > curve[i * 2 - 2])) console.warn("game: the curve's x must increase: point", i, "is", x, "after", curve[i * 2 - 2]);
          curve[i * 2] = x; curve[i * 2 + 1] = y;
        });
        {                                                    // GAME: the rivers of the terrain (game.cpp, game_rivers_set): the segments of their centre lines, which game_world_map cuts into the map (none: the call takes the last game's away)
          const rv = data.rivers || [], room = 512 * 9;      // (the generator takes 512 segments of 9 numbers; the place is made once)
          if (!h.rivers.ptr) h.rivers.ptr = wa.alloc(room * 4);
          const n = Math.min(rv.length - rv.length % 9, room);
          new Float32Array(wa.env.memory.buffer, h.rivers.ptr, n).set(n < rv.length ? rv.slice(0, n) : rv);
          wa.game_rivers_set(h.rivers.ptr, n / 9);
        }
        const map_ptr = wa.game_world_map(data.size, data.seed, params.byteOffset, curve.byteOffset, points.length);
        if (!map_ptr) throw new Error("game: no map: the range of heights is empty (max_h must be over min_h), or the size is");
        h.map_ptr = map_ptr;
        return wa.fp32_array(data.size * data.size, map_ptr);
      }
      const map_hash = function (fd) { let x = 0x811c9dc5 | 0; for (let i = 0; i < fd.length; i += 37) x = Math.imul(x ^ ((fd[i] * 1e6) | 0), 16777619); return x >>> 0; };      // (a check over a sample of the texels)

      engine.game_init = function (data) {
        const fd = make_map(data, live_holders);
        engine.game.live = { size: data.size, seed: data.seed, world_size: data.world_size, params: data.params, curve: data.curve, rivers: data.rivers };           // (what a preview makes the live map again from)
        engine.game.live_hash = map_hash(fd);
        {
          // what the heights came out as: how high, how much of it is land, and how many texels are AT the highest (a clamp is a lot of texels at exactly one height; a ridge is a handful)
          let peak = 0, low = 1, land = 0, at_peak = 0, border_land = 0;
          const n = data.size, sea = 0.1801;
          for (let i = 0; i < fd.length; i++) { const v = fd[i]; if (v > peak) peak = v; if (v < low) low = v; if (v > sea) land++; }
          for (let i = 0; i < fd.length; i++) if (fd[i] >= peak - 1e-6) at_peak++;
          for (let k = 0; k < n; k++) { if (fd[k] > sea) border_land++; if (fd[(n - 1) * n + k] > sea) border_land++; if (fd[k * n] > sea) border_land++; if (fd[k * n + n - 1] > sea) border_land++; }
          console.log("game world map: highest " + peak.toFixed(4) + " (" + at_peak + " texels at it of " + fd.length + (at_peak > fd.length * 0.0005 ? ": THAT IS A CLAMP, a flat top" : ": a peak, not a clamp") + "), lowest " + low.toFixed(4) +
            ", land " + (100 * land / fd.length).toFixed(1) + "%, land on the border " + border_land + " of " + 4 * n + " texels");
        }
        engine.game.world_map = fd;
        engine.game.map_ptr = live_holders.map_ptr;                                    // (the generator's memory can grow: a view of it is made again from here)
        engine.game.graded = null;                                                   // (the page's own map, in place of the generator's: game_set_map)
        engine.game.collision_given = data.collision;
        engine.game.map_size = data.size;
        engine.game.map_seed = data.seed;
        engine.game.world_size = data.world_size;
        engine.game.world_height = data.world_height;
        engine.game.camera = data.camera;
        engine.game.places_given = data.places;                  // (the places are made when the page asks for them: game_make_places)
        wa.scratch_reset();
        game_build_collision(data.collision);
        if (data.walls && data.walls.boxes.length) {
          // GAME: the walls round the drivable tiles (game.cpp, game_walls_build): static boxes of the physics world, which the movers of system are stopped by
          const flat = data.walls.boxes, ptr = wa.alloc(flat.length * 4);
          new Float32Array(wa.env.memory.buffer, ptr, flat.length).set(flat);
          engine.game.wall_boxes = wa.game_walls_build(phys_world, ptr, flat.length / 4, data.walls.height);
          console.log("game walls: " + engine.game.wall_boxes + " boxes of " + flat.length / 4 + " asked, " + data.walls.height + " m high");
        }

        engine.call_main("game_stats", { collision: engine.game.collision_stats, map_size: data.size, world_size: data.world_size, world_height: data.world_height });
        console.log("game", engine.game);
        const dd = new Float32Array(fd.length);
        dd.set(fd);
        wa.scratch_reset();
        engine.call_main("game_begin", { data: dd.buffer }, [dd.buffer]);

      };


      

      // A PREVIEW (the wizard's picture of the land): the heights a world document would have, made by the generator and sent back as numbers. Nothing of the live world is made (no collision, no places, no texture: the page draws these in a 2D canvas, WebGL is not
      // involved until the world is final). The generator has one memory, so the LIVE map is made again from what it was made of, in the same message, and checked against what it was (restored_ok): the live ground, its collision and its ray are as they were.
      // A preview is at most as big as the live map (a bigger one would take a new memory that the collision does not know).
      engine.game_preview = function (data) {
        let heights = null, error = "", restored_ok = null;
        const live = engine.game.live;
        try {
          if (live && data.size > live.size) throw new Error("game: a preview of " + data.size + " texels is bigger than the live map of " + live.size);
          const fd = make_map(data, preview_holders);
          heights = new Float32Array(fd.length); heights.set(fd);
        } catch (e) { error = String(e && e.message || e); }
        if (live) {
          try { restored_ok = map_hash(make_map(live, live_holders)) === engine.game.live_hash; } catch (e) { restored_ok = false; error = error || String(e && e.message || e); }
          if (!restored_ok) console.error("game: the live map could not be made again after a preview");
          else if (engine.game.graded) { engine.game.map_ptr = live_holders.map_ptr; wa.fp32_array(live.size * live.size, live_holders.map_ptr).set(engine.game.graded); wa.game_world_map_touched(); }          // (graded ground: the roads' map is what the live ground is again, its collision is still the one made from it)
        }
        engine.call_main("game_preview_done", { id: data.id, size: data.size, data: heights ? heights.buffer : null, error: error, restored_ok: restored_ok }, heights ? [heights.buffer] : []);
      };

      engine.game_make_places = function () {
        // game.cpp cuts the land by its heights and its slopes: game_places_build. The records come back as plain objects: kind, x, z, y (the drawn world's metres), radius, score, area, name.
        const place_kinds = ["peak", "lake", "shore", "island", "plains", "hills", "mountains"];
        if (wa.game_places_param_count() !== places_param_table.length) throw new Error("game: the places parameter table here has " + places_param_table.length + " rows, game.cpp's enum " + wa.game_places_param_count());
        const g = engine.game;
        const params = param_array(places_param_table, g.places_given, "places", places_params_holder);
        const count = wa.game_places_build(g.world_size, g.world_height, g.map_seed, params.byteOffset);
        const words = wa.game_place_words(), ptr = wa.game_places_ptr();
        const u32 = new Uint32Array(wa.env.memory.buffer, ptr, count * words), f32 = new Float32Array(wa.env.memory.buffer, ptr, count * words), u8 = new Uint8Array(wa.env.memory.buffer, ptr, count * words * 4);
        const places = [];
        for (let i = 0; i < count; i++) {
          const w = i * words, kind = u32[w] & 255;
          let name = "";
          for (let b = 0; b < 24 && u8[(w + 7) * 4 + b]; b++) name += String.fromCharCode(u8[(w + 7) * 4 + b]);
          places.push({ id: i, kind: kind, kind_name: place_kinds[kind], x: f32[w + 1], z: f32[w + 2], y: f32[w + 3], radius: f32[w + 4], score: f32[w + 5], area: f32[w + 6], name: name });
        }
        wa.scratch_reset();
        g.places = places;

        engine.call_main("game_places", {
          places: places,
        });
      };



    })


    block$(function engine_core() {

      engine.game_get_chunks = function (id, cam, cam_x, cam_z, snap_x, snap_z, world_size, window_size, max_height, max_lod, threshold) {
        ubuff[ui++] = CMD_GAME_WORLDMAP_CHUNKS;
        ubuff[ui++] = id;
        ubuff[ui++] = cam.uuid;
        fbuff[ui++] = cam_x;
        fbuff[ui++] = cam_z;

        fbuff[ui++] = snap_x;
        fbuff[ui++] = snap_z;

        fbuff[ui++] = world_size;
        fbuff[ui++] = window_size;
        fbuff[ui++] = max_height;

        ubuff[ui++] = max_lod;
        fbuff[ui++] = threshold;
      }

    engine.environment = (function () {
      // ---- the world: a document, checked, with the defaults filled in (what the editor edits and the sandbox reads). A key that is not a setting of the world is refused by name.
      const WORLD_KEYS = ["size", "terrain", "sun", "ambient", "atmosphere", "shadows", "vegetation", "camera", "elements", "cell", "locations"];     // (locations: what stands on the ground, kept by place; cell: the metres a side of a cell; elements: an older world's own list, system/elements.js: the ground reads none of them, it only keeps them in the world)
      const RIVER_KEYS = ["points", "width", "depth", "bank", "plain", "blend"], RIVER_SEGMENTS = 512;
      const is_num = function (v, lo, hi) { return typeof v === "number" && v === v && v >= lo && v <= hi; };
      const fail = function (msg) { throw new Error("environment: " + msg); };
      // the rivers of a terrain: width 12 m at the top of the banks, depth 8 m, a bank's run 5 m (at most half the width), a level plain 20 m beyond the channel, the hills back over 30 m
      function rivers_of(list) {
        if (list === undefined) return [];
        if (!Array.isArray(list) || list.length > 16) fail("world.terrain.rivers is a list of up to 16 rivers: [{ points: [[x, z] ...], width, depth, bank, plain, blend }]");
        let segments = 0;
        const out = list.map(function (r, i) {
          const at = "world.terrain.rivers[" + i + "]";
          if (!r || typeof r !== "object" || Array.isArray(r)) fail(at + " is { points: [[x, z] ...], width, depth, bank, plain, blend }");
          Object.keys(r).forEach(function (k) { if (RIVER_KEYS.indexOf(k) < 0) fail(at + "." + k + " is not a setting of a river (" + RIVER_KEYS.join(", ") + ")"); });
          if (!Array.isArray(r.points) || r.points.length < 2 || r.points.length > 400 || !r.points.every(function (p) { return Array.isArray(p) && p.length >= 2 && is_num(p[0], -1e6, 1e6) && is_num(p[1], -1e6, 1e6); })) fail(at + ".points is 2 to 400 points [x, z] (metres)");
          const width = r.width === undefined ? 12 : r.width, depth = r.depth === undefined ? 8 : r.depth;
          if (!is_num(width, 1, 1000)) fail(at + ".width is the metres across the channel at the top of its banks, 1 .. 1000");
          if (!is_num(depth, 0.1, 1000)) fail(at + ".depth is the metres the channel is under the plain, 0.1 .. 1000");
          const bank = r.bank === undefined ? Math.min(width / 2, 5) : r.bank, plain = r.plain === undefined ? width / 2 + 20 : r.plain, blend = r.blend === undefined ? 30 : r.blend;
          if (!is_num(bank, 0, width / 2)) fail(at + ".bank is the horizontal run of a bank, 0 .. half the width");
          if (!is_num(plain, width / 2, 5000)) fail(at + ".plain is the half width of the level strip, from half the channel's width to 5000 m");
          if (!is_num(blend, 0, 5000)) fail(at + ".blend is the metres over which the hills come back, 0 .. 5000");
          segments += r.points.length - 1;
          return { points: r.points.map(function (p) { return [p[0], p[1]]; }), width: width, depth: depth, bank: bank, plain: plain, blend: blend };
        });
        if (segments > RIVER_SEGMENTS) fail("world.terrain.rivers have " + segments + " segments between them: at most " + RIVER_SEGMENTS);
        return out;
      }
      // the rows the worker takes (game_rivers_set): per segment x0, z0, x1, z1, half the width, bank, depth (in the map's units: metres over the height of the world), plain, blend
      function river_rows(rivers, world_height) {
        const rows = [];
        (rivers || []).forEach(function (r) {
          for (let k = 0; k + 1 < r.points.length; k++) rows.push(r.points[k][0], r.points[k][1], r.points[k + 1][0], r.points[k + 1][1], r.width / 2, r.bank, r.depth / world_height, r.plain, r.blend);
        });
        return rows;
      }
      function world_check(w) {
        w = w || {};
        if (typeof w !== "object" || Array.isArray(w)) fail("the world is an object: { size, terrain, sun, ambient, atmosphere, shadows, vegetation, camera }");
        Object.keys(w).forEach(function (k) { if (WORLD_KEYS.indexOf(k) < 0) fail("world." + k + " is not a setting of the world (they are: " + WORLD_KEYS.join(", ") + ")"); });
        const size = w.size === undefined ? 4096 : w.size;
        if (!is_num(size, 64, 1000000)) fail("world.size is the metres a side of the land, 64 .. 1000000");
        const ter = Object.assign({ preset: "plains", seed: 1024, params: {}, height_scale: 0.25, normal_slope: 0.15 }, w.terrain || {});
        Object.keys(ter).forEach(function (k) { if (["preset", "seed", "params", "curve", "height_scale", "normal_slope", "rivers"].indexOf(k) < 0) fail("world.terrain." + k + " is not a setting of the terrain (preset, seed, params, curve, height_scale, normal_slope, rivers)"); });
        ter.rivers = rivers_of(ter.rivers);
        if (!is_num(ter.height_scale, 0.05, 4)) fail("world.terrain.height_scale is how tall the page makes the generator's metres, 0.05 .. 4 (0.25: a quarter; 1: as they are)");
        if (!is_num(ter.normal_slope, 0.01, 8)) fail("world.terrain.normal_slope is how steep the ground is lit, 0.01 .. 8 (0.15 for a land of kilometres; for a small one 1 / the metres a texel is)");
        if (typeof ter.preset !== "string") fail("world.terrain.preset is the name of a terrain preset");
        if (!is_num(ter.seed, -2147483648, 2147483647)) fail("world.terrain.seed is an integer");
        if (!ter.params || typeof ter.params !== "object") fail("world.terrain.params is { name: number } (the tuning numbers of the terrain)");
        if (ter.curve !== undefined && !(Array.isArray(ter.curve) && ter.curve.length >= 2 && ter.curve.length <= 16)) fail("world.terrain.curve is 2 to 16 points [x, y]");
        let sun = null;
        if (w.sun !== undefined) {
          sun = Object.assign({ azimuth: 35, elevation: 55 }, w.sun);
          if (!is_num(sun.azimuth, -360, 720) || !is_num(sun.elevation, 1, 90)) fail("world.sun is { azimuth: degrees, elevation: 1 .. 90 degrees }");
        }
        const ambient = w.ambient === undefined ? 0.5 : w.ambient;
        if (!is_num(ambient, 0, 2)) fail("world.ambient is the ambient light, 0 .. 2");
        ["atmosphere", "shadows", "vegetation"].forEach(function (k) { if (w[k] !== undefined && typeof w[k] !== "boolean") fail("world." + k + " is true or false"); });
        const cam = Object.assign({ fov: 90, near: 0.5, far: 0, min_height: 5 }, w.camera || {});
        if (!is_num(cam.fov, 10, 150) || !is_num(cam.near, 0.01, 100) || !is_num(cam.far, 0, 1000000) || !is_num(cam.min_height, 0.1, 1000)) fail("world.camera is { fov: 10 .. 150 degrees, near: metres, far: metres (0: the land's width x 0.75, at least 1.5 km), min_height: 0.1 .. 1000 metres over the ground }");
        if (w.elements !== undefined && !Array.isArray(w.elements)) fail("world.elements is a list of elements (system/structures.js)");
        if (w.cell !== undefined && !is_num(w.cell, 16, 4096)) fail("world.cell is the metres a side of a cell of the land, 16 .. 4096");
        if (w.locations !== undefined && (!Array.isArray(w.locations) || !w.locations.every(function (l) { return l && typeof l === "object" && typeof l.id === "string" && Array.isArray(l.elements); }))) fail("world.locations is a list of locations: [{ id, name, kind, x, z, r, elements: [...] }]");
        return { size: size, terrain: ter, sun: sun, ambient: ambient, atmosphere: w.atmosphere !== false, shadows: w.shadows !== false, vegetation: w.vegetation === true, camera: cam, elements: w.elements || [], cell: w.cell === undefined ? 128 : w.cell, locations: w.locations || [] };
      }
      // THE SCHEMA of the terrain's numbers: what a panel is made from (the worker's table: the ranges and the whole numbers; this page's comments: the words). Made from them by a script, not typed: a range cannot drift.
      const TERRAIN_GROUPS = [["world","Height range and sea"],["continent","Continent"],["mountains","Mountains"],["hills","Hills"],["terraces","Terraces"],["edge","Edge of the world"],["valleys","Valleys and rivers"]];
      const TERRAIN_PARAMS = [
        {"key":"min_h","label":"Lowest point","group":"world","default":-600,"min":-50000,"max":50000,"unit":"metres","help":"the lowest the shapes go (the sea floor at its deepest)"},
        {"key":"max_h","label":"Highest point","group":"world","default":2600,"min":-50000,"max":50000,"unit":"metres","help":"the highest"},
        {"key":"sea_level","label":"Sea level","group":"world","default":0,"min":-50000,"max":50000,"unit":"metres","help":"where the sea is. Raise it to flood the lowlands (lakes, fjords), lower it for more land"},
        {"key":"c_wave","label":"Continent size","group":"continent","default":9000,"min":1,"max":10000000,"unit":"metres","log":true,"help":"the wavelength of the continent noise. Small: many small landmasses; large: one or two"},
        {"key":"c_oct","label":"Coast detail","group":"continent","default":8,"min":1,"max":12,"whole":true,"help":"octaves of the continent noise (coast detail; the ones finer than a texel can show are left out)"},
        {"key":"c_gain","label":"Coast roughness","group":"continent","default":0.47,"min":0,"max":1,"help":"the amplitude of an octave against the one before. Low: smooth coasts; high: ragged"},
        {"key":"c_lac","label":"Coast lacunarity","group":"continent","default":2,"min":1.1,"max":4,"help":"the frequency of an octave against the one before"},
        {"key":"c_contrast","label":"Land / sea contrast","group":"continent","default":2.2,"min":0,"max":8,"help":"how far the noise is pushed from the middle of the curve (high: more of the world is deep sea or high land)"},
        {"key":"c_warp","label":"Coast twist","group":"continent","default":2200,"min":0,"max":1000000,"unit":"metres","help":"how far the position is bent before the continent noise (0: round blobs; high: twisted coasts, bays, peninsulas)"},
        {"key":"c_warp_wave","label":"Twist wavelength","group":"continent","default":5000,"min":1,"max":10000000,"unit":"metres","log":true,"help":"the wavelength of the bending"},
        {"key":"m_wave","label":"Range size","group":"mountains","default":8000,"min":1,"max":10000000,"unit":"metres","log":true,"help":"the wavelength of the biggest ridge"},
        {"key":"m_oct","label":"Ridge detail","group":"mountains","default":9,"min":1,"max":12,"whole":true,"help":"octaves of the ridges (the ones finer than a texel can show are left out)"},
        {"key":"m_gain","label":"Ridge roughness","group":"mountains","default":0.43,"min":0,"max":1,"help":"amplitude of an octave against the one before"},
        {"key":"m_detail","label":"Ridge crispness","group":"mountains","default":2,"min":0,"max":10,"help":"how strongly a high ridge asks for detail (the valleys stay smooth, the ridges are rough)"},
        {"key":"m_lac","label":"Ridge lacunarity","group":"mountains","default":2.1,"min":1.1,"max":4,"help":"the frequency of an octave against the one before"},
        {"key":"m_warp","label":"Ridge bending","group":"mountains","default":0.08,"min":0,"max":4,"help":"how far the lattice is bent by the gradient of the lower octaves (curved ridges)"},
        {"key":"m_amount","label":"Mountain height","group":"mountains","default":0.45,"min":0,"max":2,"help":"the height the ridges add, in the elevation's 0 .. 1 (0: no mountains)"},
        {"key":"m_mask_wave","label":"Range spacing","group":"mountains","default":8000,"min":1,"max":10000000,"unit":"metres","log":true,"help":"the wavelength of the mask that says where the mountains are (ranges, not a blanket)"},
        {"key":"m_mask_lo","label":"Range start","group":"mountains","default":0.42,"min":0,"max":1,"help":"the noise level of the mask where mountains start"},
        {"key":"m_mask_hi","label":"Range full","group":"mountains","default":0.72,"min":0,"max":1,"help":"where they are all there"},
        {"key":"m_land","label":"Inland margin","group":"mountains","default":0.1,"min":0,"max":1,"help":"how far above the sea the land must be for mountains to stand on it (0: they rise out of the shore)"},
        {"key":"r_wave","label":"Hill size","group":"hills","default":380,"min":1,"max":10000000,"unit":"metres","log":true,"help":"the wavelength of the hills"},
        {"key":"r_oct","label":"Hill detail","group":"hills","default":5,"min":1,"max":12,"whole":true,"help":"octaves of the hills"},
        {"key":"r_gain","label":"Hill roughness","group":"hills","default":0.4,"min":0,"max":1,"help":"amplitude of an octave against the one before"},
        {"key":"r_amp","label":"Hill height","group":"hills","default":12,"min":0,"max":5000,"unit":"metres","help":"the height of the hills (0: none)"},
        {"key":"r_damp","label":"Slope smoothing","group":"hills","default":1.2,"min":0,"max":20,"help":"how much a slope smooths its own fine octaves: 0 rough everywhere, high: smooth slopes, rough crests"},
        {"key":"terrace_steps","label":"Terrace steps","group":"terraces","default":0,"min":0,"max":64,"help":"the elevation is pulled onto this many steps (0: none): mesas, canyons"},
        {"key":"terrace_amount","label":"Terrace strength","group":"terraces","default":0,"min":0,"max":1,"help":"how far (0: not at all, 1: flat steps with short risers)"},
        {"key":"edge_mode","label":"Edge mode","group":"edge","default":1,"min":0,"max":2,"whole":true,"options":["none","island","ring"],"help":"0 nothing, 1 island (the border sinks into the sea), 2 ring (the border rises)"},
        {"key":"edge_margin","label":"Edge width","group":"edge","default":0.22,"min":0.01,"max":1,"help":"how much of the radius the edge takes"},
        {"key":"edge_power","label":"Edge steepness","group":"edge","default":2,"min":1,"max":6,"whole":true,"help":"the steepness of the edge's ramp (whole numbers)"},
        {"key":"edge_round","label":"Edge shape","group":"edge","default":2,"min":1,"max":3,"whole":true,"help":"the shape of the edge: 1 a circle, 2 a rounded square (the land reaches the corners), 3 nearly a square (whole numbers)"},
        {"key":"edge_noise","label":"Edge wander","group":"edge","default":0.15,"min":0,"max":0.5,"help":"how far the edge wanders, as a fraction of half the world (0: the shape above, exactly): the coast is not a perfect circle"},
        {"key":"edge_ocean","label":"Ocean band","group":"edge","default":0.2,"min":0,"max":0.8,"help":"the outer band of the world (a fraction of its half width) where whatever the mode made fades to the deepest sea at the border, in EVERY mode (0: the land may end at the border)"},
        {"key":"edge_centre","label":"Centre the land","group":"edge","default":0.6,"min":0,"max":1,"help":"how far (a fraction of half the world) the continent may be MOVED so that a lobe of land is in the middle and the middle is not a sea: the continent noise is"},
        {"key":"v_depth","label":"Valley depth","group":"valleys","default":0,"min":0,"max":3000,"unit":"metres","help":"the valleys (0: none): lowered by 0.6 of the height above the sea, at most 0.6 of this; and under this height above the sea a river is cut in them"},
        {"key":"v_wave","label":"Valley spacing","group":"valleys","default":6000,"min":100,"max":10000000,"unit":"metres","log":true,"help":"the wavelength of the noise whose zero contours are the valleys: their spacing"},
        {"key":"v_width","label":"Valley width","group":"valleys","default":0.1,"min":0.002,"max":0.5,"help":"how wide a valley is, in the units of that noise (metres: this over the noise's slope: wide where it is flat, narrow where it is steep)"},
        {"key":"v_river","label":"River share","group":"valleys","default":0.15,"min":0.02,"max":0.9,"help":"how wide the river is in it, as a fraction of the valley's width"},
        {"key":"v_warp","label":"Meander","group":"valleys","default":900,"min":0,"max":100000,"unit":"metres","help":"how far the lines are bent (0: smooth curves, high: meanders)"},
        {"key":"v_bed","label":"River depth","group":"valleys","default":15,"min":0,"max":500,"unit":"metres","help":"how far under the sea's level the bed of a river is (its depth)"}
      ];
      function create(opts) {
        opts = opts || {};
        const math = engine.math;
        let world = world_check(opts.world);
        const tile_grid = null;                                                                                         // (the tiles of a world: a later step)
        const env = { draw_color: [], draw_shadow: [], on_begin: null, started: false, ground: null, heights: null };
        const sun_euler = function (s) { const az = s.azimuth * Math.PI / 180, el = s.elevation * Math.PI / 180; return [Math.atan2(-Math.sin(el), Math.cos(el) * Math.cos(az)), Math.asin(Math.cos(el) * Math.sin(az)), 0]; };
        // make_ground: the ground the creatures and the structures stand on, as the page it was taken from made it
        function make_ground(heights, dims) {                                                                // (dims: { N, W, Hh } for a ground that is not the live world's: the wizard's preview)
      const N = dims ? dims.N : world_map.width, W = dims ? dims.W : world_map.world_size, Hh = dims ? dims.Hh : world_map.world_height, sea = world_map.sea_level * Hh;
      const ground = {
        y: function (x, z) {
          const u = (x / W + 0.5) * N - 0.5, v = (z / W + 0.5) * N - 0.5, i = Math.max(0, Math.min(N - 2, Math.floor(u))), j = Math.max(0, Math.min(N - 2, Math.floor(v))), fu = Math.max(0, Math.min(1, u - i)), fv = Math.max(0, Math.min(1, v - j));
          const a = heights[j * N + i], b = heights[j * N + i + 1], c = heights[(j + 1) * N + i], d = heights[(j + 1) * N + i + 1];
          return ((a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv) * Hh;
        },
        land: function (x, z) { return Math.abs(x) < W / 2 - Math.min(150, W * 0.05) && Math.abs(z) < W / 2 - Math.min(150, W * 0.05) && ground.y(x, z) > sea + 0.5; },
        drivable: function (x, z) { return tile_grid ? tile_grid.drivable(x, z) : true; },                              // GAME: on a drivable tile (everywhere, when the world has no tiles)
        sea: sea,
        size: W
      };
          return ground;
        }
    // SL(name, value, ...) is the engine's live-tweak slider (the deferred pass has a few: the shadow bias, the ambient scale ...): objects.js makes it when the debug sidebar is on the page (debug.js: it is). If it is not, this one
    // hands back the shader's uniform for the value: the default stays, the same name and the same uniform, no widget.
    if (!window.SL) {
      const named = {};
      let ids = 1;
      window.univalues = [];
      window.SL = function (name, value) {
        if (named[name]) return named[name];
        const uid = ids++, expr = 'u_float_params[' + uid + ']';
        window.univalues[uid] = parseFloat(value);
        engine.uniforms.set(expr, window.univalues[uid]);
        return (named[name] = expr);
      };
    }

    // THE SCENE: a camera, the sun and the ambient light, and the two passes the world is drawn in (the shadows, then the colour). The deferred pass makes the cascaded shadows and the atmosphere; the page adds its
    // draws to the passes. `scene.updates` are called every frame before the camera is placed (a game moves the camera there).
    const camera = engine.create_camera();
    const scene = {
      camera: camera,
      engine: engine,
      dlight0: engine.create_light({ eular: world.sun ? sun_euler(world.sun) : [-2.08500075340271, -1.147500991821289, 0] }),
      alight0: engine.create_light({ color: [world.ambient, world.ambient, world.ambient] }),
      model: engine.math.mat4(),
      world_size: 1024,
      updates: []
    };
    scene.on_render_pass = new events.event(scene, [0, 0]);
    scene.on_shadow_pass = new events.event(scene, [0, 0]);
    camera.update_aspect(engine.render_width / engine.render_height);
    engine.on_resize.add(function () { camera.update_aspect(engine.render_width / engine.render_height); });
    engine.on_frame_begin.add(function (time, time_delta) {
      for (let i = 0; i < scene.updates.length; i++) scene.updates[i](time, time_delta);                                // (a loop, not a closure made every frame)
      engine.uniforms.set('u_model_matrix', scene.model);
      engine.uniforms.set('sun_direction', scene.dlight0.fw_vector);
      engine.uniforms.set('directional_lights[0].direction', scene.dlight0.fw_vector);
      engine.uniforms.set('directional_lights[0].color', scene.dlight0.color);
      engine.uniforms.set('directional_lights[0].illuminated', scene.dlight0.illuminated);
      engine.uniforms.set('directional_lights[0].attenuation', scene.dlight0.attenuation);
      engine.uniforms.set('ambient_lights[0].color', scene.alight0.color);
      engine.uniforms.set('ambient_lights[0].illuminated', scene.alight0.illuminated);
      engine.uniforms.set('ambient_lights[0].attenuation', scene.alight0.attenuation);
      camera.update_look_at(time_delta);
      engine.push_camera(camera);
      engine.global_camera_position[0] = camera.world_position[0];
      engine.global_camera_position[1] = camera.world_position[1];
      engine.global_camera_position[2] = camera.world_position[2];
      engine.global_camera_position[3] = camera.far;
    });
    engine.on_frame_end.add(function () { engine.pop_camera(); });
    scene.use_deffered_rendering = function (def) {
      this.dfd = engine.deffered_rendering(Object.assign({ camera: scene.camera, dlight0: scene.dlight0, ENABLE_ATMOSPHERE: true, ENABLE_SHADOWS: true, ENABLE_LOGDEPTH: false }, def || {}));
      this.dfd.enabled = true;
      this.dfd.on_shadowmap = function (time, time_delta) { scene.on_shadow_pass.params[0] = time; scene.on_shadow_pass.params[1] = time_delta; scene.on_shadow_pass.trigger_params(); };
      this.dfd.on_frame = function (time, time_delta) { scene.on_render_pass.params[0] = time; scene.on_render_pass.params[1] = time_delta; scene.on_render_pass.trigger_params(); };
    };


    const world_map = engine.textures.create({ format_type: GL_FLOAT, internal_format: GL_R32F, format: GL_RED, filter: GL_LINEAR, clamp: true, width: Math.max(64, Math.min(4096, Math.round(+opts.map_size))) || 512 });          // (opts.map_size: texels a side, 64 .. 4096, 512 when it is not given; the shaders and the worker take the side from world_map.width)
    world_map.seed = 1024;                                                                                            // the noise of the biome pass (it is in the shader, made once); the seed of the heights is the world's: world_map.terrain_seed

    // The tuning of the world: the terrain model of the environment module (game.cpp: the SBP_ enum says what each does and what the ends of its range do). Any left out takes its default (the
    // worker's world_param_table), a value outside [min, max] is clamped (the worker warns), the order does not matter. The comment of each: min .. max, what it is. Wavelengths and heights are
    // METRES of the world, nothing is in texels: the same numbers make the same world at any size of the map (a bigger map has finer detail).
    world_map.params = {
      // the height range: the elevation 0 .. 1 of the curve is min_h .. max_h, and the sea is at sea_level between them. The world is as tall as its range (see world_height below)
      min_h: -600,            // -50000 .. 50000  metres: the lowest the shapes go (the sea floor at its deepest)
      max_h: 2600,            // -50000 .. 50000  metres: the highest
      sea_level: 0,           // -50000 .. 50000  metres: where the sea is. Raise it to flood the lowlands (lakes, fjords), lower it for more land

      // the continent: where the land and the sea are
      c_wave: 9000,           // 1 .. 1e7         metres: the wavelength of the continent noise. Small: many small landmasses; large: one or two
      c_oct: 8,               // 1 .. 12          octaves of the continent noise (coast detail; the ones finer than a texel can show are left out)
      c_gain: 0.47,           // 0 .. 1           the amplitude of an octave against the one before. Low: smooth coasts; high: ragged
      c_lac: 2,               // 1.1 .. 4         the frequency of an octave against the one before
      c_contrast: 2.2,        // 0 .. 8           how far the noise is pushed from the middle of the curve (high: more of the world is deep sea or high land)
      c_warp: 2200,           // 0 .. 1e6         metres: how far the position is bent before the continent noise (0: round blobs; high: twisted coasts, bays, peninsulas)
      c_warp_wave: 5000,      // 1 .. 1e7         metres: the wavelength of the bending

      // the mountains: a ridged multifractal under a mask
      m_wave: 8000,           // 1 .. 1e7         metres: the wavelength of the biggest ridge
      m_oct: 9,               // 1 .. 12          octaves of the ridges (the ones finer than a texel can show are left out)
      m_gain: 0.43,           // 0 .. 1           amplitude of an octave against the one before
      m_detail: 2,            // 0 .. 10          how strongly a high ridge asks for detail (the valleys stay smooth, the ridges are rough)
      m_lac: 2.1,             // 1.1 .. 4         the frequency of an octave against the one before
      m_warp: 0.08,           // 0 .. 4           how far the lattice is bent by the gradient of the lower octaves (curved ridges)
      m_amount: 0.45,         // 0 .. 2           the height the ridges add, in the elevation's 0 .. 1 (0: no mountains)
      m_mask_wave: 8000,      // 1 .. 1e7         metres: the wavelength of the mask that says where the mountains are (ranges, not a blanket)
      m_mask_lo: 0.42,        // 0 .. 1           the noise level of the mask where mountains start
      m_mask_hi: 0.72,        // 0 .. 1           where they are all there
      m_land: 0.1,            // 0 .. 1           how far above the sea the land must be for mountains to stand on it (0: they rise out of the shore)

      // the hills: an fBm weaker where the ground is steep
      r_wave: 380,            // 1 .. 1e7         metres: the wavelength of the hills
      r_oct: 5,               // 1 .. 12          octaves of the hills
      r_gain: 0.4,            // 0 .. 1           amplitude of an octave against the one before
      r_amp: 12,              // 0 .. 5000        metres: the height of the hills (0: none)
      r_damp: 1.2,            // 0 .. 20          how much a slope smooths its own fine octaves: 0 rough everywhere, high: smooth slopes, rough crests

      // the shape of the whole
      terrace_steps: 0,       // 0 .. 64          the elevation is pulled onto this many steps (0: none): mesas, canyons
      terrace_amount: 0,      // 0 .. 1           how far (0: not at all, 1: flat steps with short risers)

      // the edge of the world
      edge_mode: 1,           // 0 .. 2           0 nothing, 1 island (the border sinks into the sea), 2 ring (the border rises)
      edge_margin: 0.22,      // 0.01 .. 1        how much of the radius the edge takes
      edge_power: 2,          // 1 .. 6           the steepness of the edge's ramp (whole numbers)
      edge_round: 2,          // 1 .. 3           the shape of the edge: 1 a circle, 2 a rounded square (the land reaches the corners), 3 nearly a square (whole numbers)
      edge_noise: 0.15,       // 0 .. 0.5         how far the edge wanders, as a fraction of half the world (0: the shape above, exactly): the coast is not a perfect circle
      edge_ocean: 0.2,        // 0 .. 0.8         the outer band of the world (a fraction of its half width) where whatever the mode made fades to the deepest sea at the border, in EVERY mode (0: the land may end at the border)
      edge_centre: 0.6,       // 0 .. 1           how far (a fraction of half the world) the continent may be MOVED so that a lobe of land is in the middle and the middle is not a sea: the continent noise is
      //                  sampled at a shifted position, chosen by the seed on a coarse grid (0: where the noise puts it). Nothing is bent or raised: every land cell keeps its relief,
      //                  its plains stay plains. With edge_ocean this is a map in the middle of the world, thinning to islands and then the open sea towards the edges

      // valleys and rivers: along the zero contours of a bent noise (long winding lines across the world). A wide valley, and in the lowlands a narrow river cut into its middle down below the sea's
      // level (the biome pass paints water under 0.18), which fades out into the dry valleys as the land climbs. Water exists only at the sea's level: a river is as high as the sea
      v_depth: 0,             // 0 .. 3000        metres: the valleys (0: none): lowered by 0.6 of the height above the sea, at most 0.6 of this; and under this height above the sea a river is cut in them
      v_wave: 6000,           // 100 .. 1e7       metres: the wavelength of the noise whose zero contours are the valleys: their spacing
      v_width: 0.1,           // 0.002 .. 0.5     how wide a valley is, in the units of that noise (metres: this over the noise's slope: wide where it is flat, narrow where it is steep)
      v_river: 0.15,          // 0.02 .. 0.9      how wide the river is in it, as a fraction of the valley's width
      v_warp: 900,            // 0 .. 1e5         metres: how far the lines are bent (0: smooth curves, high: meanders)
      v_bed: 15,              // 0 .. 500         metres: how far under the sea's level the bed of a river is (its depth)
    };
    // The hypsometric curve: the continent's noise 0 .. 1 -> the elevation 0 .. 1, a monotone cubic through these points ([x, y], 2 .. 16 of them, x increasing). Where it crosses the sea (the
    // sea_level as a fraction of the range) is how much of the world is land: a curve that stays low and rises late is a world of sea and a few high lands, a steep one at the start a world of shallows.
    world_map.curve = [[0, 0], [0.18, 0.07], [0.33, 0.19], [0.46, 0.22], [0.60, 0.25], [0.80, 0.305], [0.92, 0.36], [1, 0.42]];
    const base_params = Object.assign({}, world_map.params), base_curve = world_map.curve;                           // (what a preset and a world's numbers are laid over, every time a world is applied)

    // PRESETS: each lists only what it changes from the table above (and `curve`, the curve above), so what a preset does is what a knob does. A game picks one by name (world.terrain.preset), or
    // gives its own numbers (world.terrain.params). They are the terrain of the environment module's own presets, so a world made there is made here.
    const world_presets = {
      // the environment's earth: an island continent, ranges under a mask, rolling hills (the table above)
      earth: {},

      // many islands: a lower, steeper curve, a smaller continent noise, the edge sinks far in
      islands: { curve: [[0, 0], [0.3, 0.08], [0.52, 0.19], [0.66, 0.235], [0.82, 0.31], [1, 0.45]], c_wave: 5200, c_warp: 1400, c_contrast: 2.6, m_wave: 4000, m_amount: 0.4, m_mask_lo: 0.5, m_mask_hi: 0.75, edge_mode: 1, edge_margin: 0.3, edge_power: 3 },

      // hundreds of small islands in a sea (a smaller continent noise, more contrast, almost no mountains)
      archipelago: { min_h: -300, max_h: 1200, curve: [[0, 0], [0.38, 0.09], [0.52, 0.17], [0.62, 0.22], [0.8, 0.3], [1, 0.4]], c_wave: 3000, c_contrast: 2.9, c_warp: 900, c_warp_wave: 2200, m_wave: 2600, m_amount: 0.08, m_mask_lo: 0.4, m_mask_hi: 0.7, r_amp: 6, edge_mode: 1, edge_margin: 0.1, edge_power: 2 },

      // one big landmass, steep green mountains
      tropical: { max_h: 2200, curve: [[0, 0], [0.22, 0.08], [0.4, 0.2], [0.56, 0.235], [0.75, 0.3], [1, 0.42]], c_wave: 7000, c_contrast: 2.4, m_amount: 0.2, m_mask_lo: 0.4, m_mask_hi: 0.7, edge_mode: 1, edge_margin: 0.26, edge_power: 3 },

      // rolling lowlands: low relief, wide valleys, a coast all round
      plains: { min_h: -160, max_h: 950, curve: [[0, 0], [0.2, 0.1], [0.38, 0.2], [0.55, 0.27], [0.75, 0.34], [0.9, 0.42], [1, 0.5]], c_wave: 13000, c_contrast: 1.7, c_warp: 1600, m_wave: 6000, m_amount: 0.16, m_mask_lo: 0.5, m_mask_hi: 0.8, r_wave: 520, r_amp: 16, r_damp: 0.8, edge_mode: 1, edge_margin: 0.16, edge_power: 2 },

      // very tall, sharp mountains; the valleys below 700 m are flooded (lakes and fjords), the land goes to the border
      alps: { min_h: -200, max_h: 4600, sea_level: 700, c_wave: 11000, m_wave: 6500, m_gain: 0.46, m_detail: 2.4, m_amount: 0.55, m_mask_lo: 0.3, m_mask_hi: 0.6, m_land: 0.05, r_amp: 26, r_damp: 1.5, edge_mode: 0 },

      // a high plateau ringed by mountains at the border of the world
      highlands: { max_h: 3200, c_wave: 12000, m_amount: 0.6, m_mask_lo: 0.3, m_mask_hi: 0.6, m_land: 0.2, r_amp: 20, edge_mode: 2, edge_margin: 0.25 },

      // low ground flooded to 70 m: a net of lakes, land to the border of the world
      lakeland: { sea_level: 70, curve: [[0, 0], [0.25, 0.14], [0.45, 0.22], [0.65, 0.27], [0.85, 0.34], [1, 0.45]], c_wave: 4800, c_contrast: 1.7, m_amount: 0.22, m_mask_lo: 0.5, m_mask_hi: 0.8, r_wave: 300, r_amp: 24, edge_mode: 0 },

      // stepped mesas: the elevation pulled onto 14 steps, big hills, a few ranges
      canyons: { max_h: 2300, terrace_steps: 14, terrace_amount: 0.8, m_amount: 0.35, r_wave: 700, r_amp: 90, r_damp: 0.5, edge_mode: 0 },

      // a dry rolling land with soft steps
      desert: { m_amount: 0.45, r_amp: 55, r_damp: 0.6, terrace_steps: 9, terrace_amount: 0.35 },

      // a sea of sand: low long swells, a few low ranges, a low sea
      dunes: { min_h: -150, max_h: 1300, sea_level: 90, curve: [[0, 0], [0.25, 0.14], [0.5, 0.2], [0.75, 0.26], [1, 0.34]], m_amount: 0.14, r_wave: 900, r_amp: 60, r_damp: 0.3, edge_mode: 0 },

      // land to the border, as level as the model goes: a few swells a few metres high (for testing the physics and the terrain on level ground)
      flat_test: { min_h: -100, max_h: 300, curve: [[0, 0], [0.4, 0.24], [0.5, 0.26], [1, 0.3]], c_wave: 14000, c_contrast: 1.2, c_warp: 800, m_amount: 0, r_amp: 1.5, r_wave: 600, edge_mode: 0, edge_ocean: 0, edge_centre: 0 },

      // level as a table: the curve is one height (6 m over the sea), nothing is added to it (no mountains, no hills, no valleys), the edge does nothing; the ground is the same everywhere to the last bit (for a game on level ground)
      flat: { min_h: -100, max_h: 100, sea_level: 0, curve: [[0, 0.62], [1, 0.62]], m_amount: 0, r_amp: 0, v_depth: 0, terrace_steps: 0, terrace_amount: 0, edge_mode: 0, edge_ocean: 0, edge_centre: 0 },
    };
    // ---- worlds of valleys, cliffs, mountains, plains, lakes and rivers ------------------------------------------------------------------------------------------------------------------------
    // What makes each: a steep part of the curve is a CLIFF along a contour of the continent noise and a flat part a PLAIN or a plateau; the ridged layer makes MOUNTAINS and the valleys between
    // them; v_depth > 0 cuts VALLEYS along winding lines and RIVERS in them where the land is low; a plain just above the sea with hills over it is a field of LAKES; the range (min_h, max_h) sets
    // how steep the same shapes are (a plain needs a small one: slopes grow with the range). Measured on two seeds (1024 map, share of the land): plains = slope under 3 degrees, cliffs over 55.
    Object.assign(world_presets, {
      // rolling country, 30 - 40% plains: wide soft valleys with a narrow river winding down each to the sea or a lake
      river_plains: {
        min_h: -150, max_h: 850, c_wave: 14000, m_amount: 0.18, m_wave: 2400, m_mask_lo: 0.2, m_mask_hi: 0.5, r_amp: 25, r_wave: 800, r_damp: 0.9,
        v_depth: 400, v_wave: 6000, v_width: 0.24, v_river: 0.06, v_bed: 20, v_warp: 1500,
        curve: [[0, 0], [0.22, 0.09], [0.38, 0.155], [0.55, 0.19], [0.8, 0.26], [1, 0.36]]
      },

      // a lowland just above the sea with 45 m hills over it: ponds and lakes everywhere, thin rivers joining them, 80% of the land flat
      lake_district: {
        min_h: -150, max_h: 700, c_wave: 7000, c_contrast: 1.5, r_wave: 1100, r_amp: 45, r_oct: 5, r_damp: 0.4, m_amount: 0.2, m_mask_lo: 0.5, m_mask_hi: 0.8,
        v_depth: 120, v_wave: 3500, v_width: 0.15, v_river: 0.08, v_bed: 14, v_warp: 900,
        curve: [[0, 0], [0.25, 0.1], [0.33, 0.17], [0.4, 0.19], [0.6, 0.195], [0.75, 0.24], [0.9, 0.32], [1, 0.42]]
      },

      // plateaus on stairs of cliffs (the curve jumps twice): a coastal plain, an escarpment 300 m high, a tableland, a second escarpment, the highland; rivers in the lowland, lakes in the plain
      cliff_country: {
        min_h: -300, max_h: 2100, c_wave: 9000, c_contrast: 1.8, m_amount: 0.2, m_wave: 5000, r_amp: 10, r_damp: 2,
        v_depth: 150, v_wave: 5200, v_width: 0.18, v_river: 0.06, v_bed: 18, v_warp: 1000,
        curve: [[0, 0], [0.28, 0.07], [0.40, 0.13], [0.44, 0.135], [0.47, 0.25], [0.55, 0.27], [0.62, 0.275], [0.66, 0.40], [0.75, 0.42], [1, 0.47]]
      },

      // ranges with open valleys between them: rugged ridges (half the land is steeper than 35 degrees), U-shaped valleys winding through, rivers where they come down to the lowland
      mountain_valleys: {
        min_h: -300, max_h: 2600, c_wave: 12000, c_contrast: 1.6, c_warp: 1800, m_amount: 0.45, m_wave: 4200, m_oct: 8, m_gain: 0.45, m_detail: 2.2, m_warp: 0.08, m_mask_lo: 0.1, m_mask_hi: 0.45, m_land: 0.05, r_amp: 22, r_damp: 2,
        v_depth: 500, v_wave: 4800, v_width: 0.2, v_river: 0.07, v_bed: 20, v_warp: 1300,
        curve: [[0, 0], [0.25, 0.07], [0.4, 0.13], [0.55, 0.22], [0.75, 0.36], [1, 0.5]]
      },

      // tall alpine ranges all over a land that reaches the border (the ocean band cuts it), deep valleys 3 km apart with rivers in the foothills, a sea in the middle
      alpine_valleys: {
        min_h: -300, max_h: 3800, sea_level: 300, m_amount: 0.5, m_wave: 3600, m_oct: 9, m_gain: 0.5, m_detail: 2.6, m_warp: 0.12, m_mask_lo: 0, m_mask_hi: 0.3, r_amp: 30, r_damp: 2, edge_mode: 0,
        v_depth: 700, v_wave: 3800, v_width: 0.22, v_river: 0.06, v_bed: 25, v_warp: 1100
      },

      // stepped mesas (20 steps, nearly flat tops and short cliffs) cut by winding valleys and rivers
      canyonlands: {
        min_h: -300, max_h: 2100, c_contrast: 1.8, terrace_steps: 20, terrace_amount: 0.9, m_amount: 0.35, m_mask_lo: 0.2, m_mask_hi: 0.6, r_amp: 40, r_wave: 500, r_damp: 0.5, edge_mode: 0,
        v_depth: 400, v_wave: 5000, v_width: 0.12, v_river: 0.05, v_bed: 15, v_warp: 900,
        curve: [[0, 0], [0.2, 0.1], [0.35, 0.2], [0.5, 0.3], [0.7, 0.4], [1, 0.5]]
      },

      // one of everything: a mountain mass, an escarpment, plains, a coast with lakes inland, rivers
      everything: {
        min_h: -300, max_h: 2400, c_wave: 10000, m_amount: 0.45, m_wave: 5000, m_detail: 2.4, m_mask_lo: 0.3, m_mask_hi: 0.65, r_amp: 20, r_wave: 450, r_damp: 1.4,
        v_depth: 300, v_wave: 5500, v_width: 0.18, v_river: 0.06, v_bed: 18, v_warp: 1000,
        curve: [[0, 0], [0.25, 0.07], [0.38, 0.115], [0.46, 0.135], [0.5, 0.25], [0.58, 0.28], [0.7, 0.36], [1, 0.5]]
      },
    });
    // the terrain of a world: a preset of the table above, then the world's own numbers over it (run again when the document changes)
    function terrain_inputs(w) {
      if (!world_presets[w.terrain.preset]) throw new Error("environment: world.terrain.preset `" + w.terrain.preset + "` is not a preset of the terrain (they are: " + Object.keys(world_presets).join(", ") + ")");
      const chosen = Object.assign({}, world_presets[w.terrain.preset]);
      let curve = base_curve;
      if (chosen.curve) { curve = chosen.curve; delete chosen.curve; }
      if (w.terrain.curve) curve = w.terrain.curve;
      return { preset: w.terrain.preset, curve: curve, params: Object.assign({}, base_params, chosen, w.terrain.params), height_scale: w.terrain.height_scale, seed: w.terrain.seed };
    }
    function set_terrain(w) {
      const t = terrain_inputs(w);
      world_map.preset = t.preset;
      world_map.curve = t.curve;
      world_map.params = t.params;
      world_map.height_scale = t.height_scale;
      world_map.terrain_seed = t.seed;
    }
    set_terrain(world);

    world_map.world_size = 4096;
    world_map.world_height = 1024;
    world_map.max_lod = 8;

    // The mesh: chunk_divs x chunk_divs quads a chunk and the quadtree splits to max_lod, so the nearest vertices are (the quadtree's window / 2^max_lod / chunk_divs) metres apart: 4 m at 16 km with the
    // ocean's window, and the map's own texel is 16 m. What is smaller than that is the ground's detail, below (world_map.detail).
    world_map.chunk_divs = 32;        // quads on a side of a chunk
    world_map.threshold = 2.2 * 1;        // how far a chunk is split, in its own sizes: more = the fine mesh reaches farther (and more chunks)
    world_map.sea_level = 0.18;       // the sea in the map's units (GM_SEA in game.cpp: the generator puts the definition's sea here)

    // The world is as tall as its range: the sea is at sea_level between min_h and max_h, the map puts it at world_map.sea_level (the 0.18 the shaders and the collision know), so the land above
    // it is the definition's metres (the sea floor is a little shallower or deeper). height_scale makes the whole world taller or flatter (1: the definition's metres, 0.25: a quarter as tall).
    world_map.height_scale = world.terrain.height_scale;                                                                // GAME: the game's (0.25 is what this page always did: 0.5, halved again below)

    // The world is not the end of what is drawn: the quadtree's window is `ocean_scale` times the world (its finest chunks stay the size they were: two more levels for 4), and the heights outside the
    // map are the border's (the texture clamps), which is the deep ocean the generator fades every world into. The ocean goes on to the camera's far plane, and the atmosphere takes it from there.
    world_map.ocean_scale = 8;

    // How steep the ground looks in the light (the lighting normal only, not the shape): the normal leans by this x the height of the world x the map's slope per texel. A true normal is
    // 1 / (metres a texel is): 0.0625 at 16 km, 0.125 at 8 km. The page was tuned at 8 km with 0.5, which is 4 times the true slope there; at 16 km the same 0.5 is 8 times, and every small
    // rib, dash and step of the ground pops out. 0.25 is the same 4 times at 16 km. 0.0625 is the true light (flat-looking: the world is only 2.5% as high as it is wide).
    world_map.normal_slope = world.terrain.normal_slope;                                                                // GAME: the game's (0.15 for a land of kilometres; for a small land the true light is 1 / the metres a texel is)

    // draw the shadow caster in the colour pass, as lines, to check that its instances land on the terrain and follow the camera (while this is looked at, the terrain's own draw in on_frame and
    // the caster's draw in on_shadowmap are commented out, as they were)
    world_map.debug_shadow_mesh = true;

    // The detail of the ground, cosmetic and per PIXEL (the terrain's fragment shader, detail_slope): noise leans the lighting normal, so the ground has the swells and crags that the mesh is too
    // coarse to hold. It is the NORMAL only: the surface that is drawn, shadowed and walked on is the map's, unchanged (the physics' ground, game.cpp, is not touched). The octaves a pixel is too
    // coarse to show, and the detail map's mipmaps average away, so the detail comes in as the camera comes close and does not shimmer. Two parts: the big forms (48, 24 and 12 m: rolling swells,
    // creased ridges on steep ground and rock) are noise in the shader, so they never repeat; everything finer is the DETAIL MAP (make_detail_map: ONE small tileable texture, baked once, mipmapped,
    // of rock facets and cracks in two channels and soil and grass in the other two), laid on the ground at three scales, turned and moved against each other so no tile shows, and seen from three
    // sides (triplanar) so a cliff is not a smear. Smoothed by snow, none under the sea; its strength changes over a few hundred metres so that no two places look alike. Everything is a function
    // of the position on the ground (and the ground's own height), never of the mesh under it, so it does not change with the level of detail of a chunk.
    // Changed live (world_map.detail.strength = 2): the page copies them into the shader's uniform every frame.
    world_map.detail = {
      strength: 1.0,      // 0 .. 4       how hard the noise leans the light: 1 = a few degrees on the plains, up to 20 on crags. 0: none (the smooth ground)
      wavelength: 48,     // 8 .. 400     metres of the biggest swell; each of the seven octaves is half the one before (the smallest 0.75 m)
      crags: 1.0,         // 0 .. 1.5     how much of the steep ground and of the rock is creased rather than rolling
      tile: 2.7,          // 0.5 .. 20    metres one tile of the detail map covers at its finest layer (the two coarser layers are 4.3 and 18 times that)
    };

    // The collision of the ground (the worker, game.cpp): one static body, a heightmap shape for every cell of a quadtree built on the height data (big cells on flat ground, small ones where it is rough); the cells are
    // the broadphase only, the contacts are made against the real ground.
    // Any left out takes its default, a value outside [min, max] is clamped. The comment of each: min .. max, what it is.
    world_map.collision = {
      max_error: 10,          // 0.1 .. 200     metres: a cell is split while its heights spread (highest minus lowest ground) more than this. The quality of the broadphase: less = more, smaller shapes
      min_cell: 0,            // 0 .. 4096      metres: no shape narrower than this (0: one texel of the map)
      max_cell: 512,          // 4 .. 8192      metres: no shape wider than this, however flat the ground
      max_shapes: 1000,       // 16 .. 12000    the budget of shapes (the physics world has 16384 in all): the quadtree stops here and spends them where the ground is rough
      margin_below: 50,       // 1 .. 500       metres of box under the lowest ground of a cell: how far under the ground a body is still tested against the terrain
      margin_above: 5,      // 1 .. 2000      metres of box over the highest ground of a cell: how high above the ground a body is tested against the terrain
      sea_scale: 4,           // 1 .. 100       a cell all under water may spread this many times as much (the sea floor is divided less)
    };

    // The places (game.cpp, game_places_build): a peak, a lake, a shore, an island, and the plains, hills and mountains the land is cut into by its height and its slope,
    // each large stretch a named place: "Mount Vamorham", "Lake Dilbrik", "Kraleth Shore", "Soren Plains". Found once, when the terrain is there, on a grid of `cell`
    // metres; the list is world_map.places. Any left out takes its default, a value outside [min, max] is clamped. The comment of each: min .. max, what it is.
    world_map.place_params = {
      cell: 64,               // 16 .. 1024     metres: the cell of the grid the places are found on (at most 512 cells a side). Smaller: smaller lakes and stretches are seen, at more work
      peaks: 16,              // 0 .. 64        the most peaks named (0: none)
      lakes: 12,              // 0 .. 64        the most lakes named
      shores: 12,             // 0 .. 64        the most shores named
      islands: 12,            // 0 .. 64        the most islands named
      regions: 6,             // 0 .. 32        the most stretches of EACH kind of region named (plains, hills, mountains, forest, jungle, desert, tundra)
      region_km2: 0.25,       // 0 .. 1000      square kilometres: the smallest stretch of a region that is named
      separation: 1,          // 0.1 .. 10      how far apart peaks and shores are (1: a peak is at least 1000 m from a higher one, a shore 1500 m from the next)
      mountain_m: 100,        // 0 .. 50000     metres over the sea: from here ground is mountains and has peaks (never under 0.35 of the world's highest ground)
      peak_relief: 40,        // 0 .. 5000      metres: how far a peak must stand over the lowest ground 320 m round it (a bump is not a peak)
      gentle: 0.2,            // 0.01 .. 2      rise over run: ground up to this (a cell's mean slope) is gentle: plains (steeper land that is not mountains is hills) and shores. 0.2 is a 20% grade, 11 degrees
    };

    // how tall a world is in metres: its range of heights from the sea up, with the sea where the map puts it (world_map.sea_level), times the height scale
    function world_height_of(params, height_scale) {
      const range = params.max_h - params.min_h, sea01 = Math.min(0.999, Math.max(0.001, (params.sea_level - params.min_h) / range));
      return range * (1 - sea01) / (1 - world_map.sea_level) * height_scale;
    }
    function calculate_world_size(size) {
      world_map.world_size = size;                                                                                       // GAME: metres, the game's
      world_map.world_height = world_height_of(world_map.params, world_map.height_scale);
      camera.update_perspective(world.camera.near, world.camera.far || Math.min(Math.max(world_map.world_size * 0.75, 1500), 190000), world.camera.fov);          // (GAME: the game's lens; the far plane is a 1.5 km at least)
    }
    calculate_world_size(world.size);                                                                      // GAME: the world's width is the definition's

    // The terrain's shadow caster: world_map.mesh.shadow_geo, the plain chunk_divs x chunk_divs plane, drawn shadow_instances times with ONE call, the vertex shader places the instance from gl_InstanceID
    // on a shadow_grid x shadow_grid grid of cells round the camera. A cell is the size of a finest chunk of the mesh (world_size / 2^max_lod: 256 m at 16 km), so its quads are the lit ground's own
    // (8 m), on the same vertices, with the same triangles and the same height function: the caster is the surface that is lit, to the float (a coarser caster stands above the ground by metres in
    // every hollow: a lattice of acne dots, blocky shadows). Nothing is allocated for it but the one 32 x 32 plane. 8 x 8 = 64 instances cover 2048 m round the camera (the cascades reach 2048 m
    // out: 16 x 16 = 256 instances cover all of it, at 4 times the vertices).
    let shadow_cell = world_map.world_size / Math.pow(2, world_map.max_lod);
    const shadow_grid = 64;
    const shadow_instances = shadow_grid * shadow_grid;
    const u_shadow_grid = engine.math.vec4(shadow_grid, shadow_cell, 0, 0);         // x: cells a side, y: metres a cell, zw: the world x, z of the corner of the window (the page sets them every frame)

    const u_world_info = engine.math.vec4(world_map.world_size, world_map.world_height, 1, world_map.width);

    // the shader's: strength, wavelength, crags, the sea level (the detail is none under it)
    world_map.detail_u = engine.math.vec4(world_map.detail.strength, world_map.detail.wavelength, world_map.detail.crags, world_map.sea_level);

    engine.uniforms.set("u_heightmap", world_map);
    engine.uniforms.set("u_world_info", u_world_info);
    // THE DETAIL MAP. One tileable RGBA8 texture, baked once here (about half a second at 512): the slope of two kinds of ground, each as the (x, z) of 0.5 + slope / (6 rms), in its own rms, so
    // that a layer's strength is one number in the shader. RG: ROCK (ridged noise for the big forms, then facets with ledges between them and cracks along the edges, then smaller facets). BA: SOIL
    // and GRASS (fine grain over low undulations, with tufts). Mipmapped, so a slope averages out with distance as it should, and (anisotropy) it stays sharp at a grazing angle. The noise is
    // periodic in the texture, so there is no seam; the shader lays it on the ground three times, at different scales and turns, so there is no repeat either.
    function make_detail_map(n) {
      const gx = new Float32Array(16), gy = new Float32Array(16);
      for (let i = 0; i < 16; i++) { gx[i] = Math.cos(i * Math.PI / 8 + 0.2); gy[i] = Math.sin(i * Math.PI / 8 + 0.2); }
      function hash(ix, iy, s) {
        let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(s + 1, 0x9e3779b1);
        h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
      }
      // gradient noise on a lattice that repeats every p cells, about -0.7 .. 0.7
      function gnoise(x, y, p, s) {
        const xf = Math.floor(x), yf = Math.floor(y);
        const fx = x - xf, fy = y - yf;
        const x0 = ((xf % p) + p) % p, y0 = ((yf % p) + p) % p;
        const x1 = x0 + 1 === p ? 0 : x0 + 1, y1 = y0 + 1 === p ? 0 : y0 + 1;
        const k00 = (hash(x0, y0, s) * 16) | 0, k10 = (hash(x1, y0, s) * 16) | 0, k01 = (hash(x0, y1, s) * 16) | 0, k11 = (hash(x1, y1, s) * 16) | 0;
        const v00 = gx[k00] * fx + gy[k00] * fy;
        const v10 = gx[k10] * (fx - 1) + gy[k10] * fy;
        const v01 = gx[k01] * fx + gy[k01] * (fy - 1);
        const v11 = gx[k11] * (fx - 1) + gy[k11] * (fy - 1);
        const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
        const a = v00 + ux * (v10 - v00);
        return a + uy * ((v01 + ux * (v11 - v01)) - a);
      }
      // cellular noise on a lattice that repeats every c cells: the distances to the nearest two feature points, and the nearest cell's three random numbers and the vector to its point
      const W = { f1: 0, f2: 0, r0: 0, r1: 0, r2: 0, dx: 0, dy: 0 };
      function worley(x, y, c, s) {
        const xf = Math.floor(x), yf = Math.floor(y);
        const fx = x - xf, fy = y - yf;
        let f1 = 9, f2 = 9, r0 = 0, r1 = 0, r2 = 0, bx = 0, by = 0;
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const cx = (((xf + i) % c) + c) % c, cy = (((yf + j) % c) + c) % c;
            const px = i + hash(cx, cy, s) * 0.8 + 0.1 - fx, py = j + hash(cx, cy, s + 100) * 0.8 + 0.1 - fy;
            const d = Math.sqrt(px * px + py * py);
            if (d < f1) {
              f2 = f1; f1 = d; bx = px; by = py;
              r0 = hash(cx, cy, s + 200); r1 = hash(cx, cy, s + 300); r2 = hash(cx, cy, s + 400);
            } else if (d < f2) f2 = d;
          }
        }
        W.f1 = f1; W.f2 = f2; W.r0 = r0; W.r1 = r1; W.r2 = r2; W.dx = bx; W.dy = by;
      }
      function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

      const rock = new Float32Array(n * n), soil = new Float32Array(n * n);
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const u = (x + 0.5) / n, v = (y + 0.5) / n;
          // ROCK: ridged noise (the big forms), bent a little; broken into facets with ledges between them and cracks along the edges
          const wu = u + 0.04 * gnoise(u * 3, v * 3, 3, 1), wv = v + 0.04 * gnoise(u * 3 + 7.3, v * 3 + 2.1, 3, 2);
          let h = 0, a = 1, wt = 1;
          for (let o = 0; o < 6; o++) {
            const P = 3 << o;
            const r = Math.max(0, 1 - 2 * Math.abs(gnoise(wu * P, wv * P, P, 10 + o)));
            h += a * wt * r * r;
            wt = Math.min(1, r * 1.5);
            a *= 0.55;
          }
          worley(wu * 5, wv * 5, 5, 30);
          let fh = (W.r0 - 0.5) * 0.55 + (W.dx * (W.r1 - 0.5) + W.dy * (W.r2 - 0.5)) * 1.0;
          fh -= 0.10 * (1 - smooth(0, 0.10, W.f2 - W.f1));
          worley(wu * 14, wv * 14, 14, 40);
          let fh2 = (W.r0 - 0.5) * 0.4 + (W.dx * (W.r1 - 0.5) + W.dy * (W.r2 - 0.5)) * 0.8;
          fh2 -= 0.06 * (1 - smooth(0, 0.10, W.f2 - W.f1));
          rock[y * n + x] = h * 0.5 + fh * 0.32 + fh2 * 0.14;
          // SOIL and GRASS: fine grain over low undulations, with tufts
          let g = 0; a = 1;
          for (let o = 0; o < 5; o++) { const P = 8 << o; g += a * gnoise(u * P, v * P, P, 60 + o); a *= 0.6; }
          // (the lattice of the tufts is bent, and there are two densities, or a grazing view reads the one jittered point a cell as a grid)
          const su = u + 0.035 * gnoise(u * 5, v * 5, 5, 80), sv = v + 0.035 * gnoise(u * 5 + 3.7, v * 5 + 9.1, 5, 81);
          worley(su * 22, sv * 22, 22, 70);
          let tuft = Math.pow(Math.max(0, 1 - W.f1 / 0.55), 2) * (0.3 + 0.7 * W.r0);   // (zero before the edge of the cell: the nearest cell changes there, and so would the height)
          worley(su * 13 + 0.37, sv * 13 + 0.61, 13, 90);
          tuft += 0.8 * Math.pow(Math.max(0, 1 - W.f1 / 0.62), 2) * (0.2 + 0.8 * W.r1);
          soil[y * n + x] = g * 0.25 + tuft * 0.6;
        }
      }
      // the slope of each (central differences, round the edges: the tile is seamless), in the units of the field's own rms, so that a layer's strength is one number in the shader.
      // Stored as 0.5 + slope / (6 rms): the shader reads it back as slope * 3 rms.
      const out = new Uint8Array(n * n * 4);
      function slopes(field, ch) {
        const sx = new Float32Array(n * n), sy = new Float32Array(n * n);
        let sum = 0;
        for (let y = 0; y < n; y++) {
          const ym = ((y + n - 1) % n) * n, yp = ((y + 1) % n) * n, yy = y * n;
          for (let x = 0; x < n; x++) {
            const xm = (x + n - 1) % n, xp = (x + 1) % n;
            const dx = (field[yy + xp] - field[yy + xm]) * 0.5, dy = (field[yp + x] - field[ym + x]) * 0.5;
            sx[yy + x] = dx; sy[yy + x] = dy; sum += dx * dx + dy * dy;
          }
        }
        const rms = Math.sqrt(sum / (n * n * 2)) || 1;
        const k = 1 / (6 * rms);
        for (let i = 0; i < n * n; i++) {
          out[i * 4 + ch] = Math.max(0, Math.min(255, Math.round((0.5 + sx[i] * k) * 255)));
          out[i * 4 + ch + 1] = Math.max(0, Math.min(255, Math.round((0.5 + sy[i] * k) * 255)));
        }
      }
      slopes(rock, 0);
      slopes(soil, 2);
      return out;
    }

    world_map.detail_map = engine.textures.create({ width: 512, height: 512, mipmap: true, anisotropy: 8 });         // (filled in game_begin)
    world_map.detail_u2 = engine.math.vec4(0, 0, 0, 0);       // the shader's: the metres a pixel covers per metre of distance (set every frame, with the camera and the canvas)
    engine.uniforms.set("u_detail", world_map.detail_u);
    engine.uniforms.set("u_detail2", world_map.detail_u2);
    engine.uniforms.set("u_detail_map", world_map.detail_map);

    // GROUND MATERIALS (system/ground.js, the pack's section ground.textures): the base PBR sets (grass, soil, sand, rock, snow, gravel, asphalt, paving) as two atlases. The page decodes them
    // (ground.js load) and gives them to `env.set_ground(loaded)`; until then the terrain is drawn as before (u_ground.x = 0). world_map.ground is what a page may change live: quality (1 one tile a material,
    // 2 two tiles of different scale and turn blended: no repeat shows), hue (0 .. 1: how much of a material's own colour the ground takes; the rest is the biome's colour on the material's light and shade), fade (the
    // distance in metres where the materials are gone into the biome's colour), normal and ao (0 .. 1.5: how strong). The atlases' textures are made when the pack comes (their size is the pack's).
    world_map.ground = { quality: 2, hue: 0.35, fade: 450, normal: 1.0, ao: 0.8 };
    world_map.ground_u = [engine.math.vec4(0, 2, 0.35, 450), engine.math.vec4(0, 0, 1, 1), engine.math.vec4(1, 0.8, 0, 0)];                       // u_ground, u_ground2 (a material's picture in uv, the atlas in texels), u_ground3 (normal, ao)
    world_map.ground_tex = [engine.textures.create({ width: 4, height: 4 }), engine.textures.create({ width: 4, height: 4 })];                       // (placeholders: a sampler wants a texture, the shader does not read it while u_ground.x is 0)
    engine.uniforms.set("u_ground", world_map.ground_u[0]); engine.uniforms.set("u_ground2", world_map.ground_u[1]); engine.uniforms.set("u_ground3", world_map.ground_u[2]);
    engine.uniforms.set("u_ground0", world_map.ground_tex[0]); engine.uniforms.set("u_ground1", world_map.ground_tex[1]);
    const GROUND_SLOTS = 24, ground_vec = [];
    for (let i = 0; i < GROUND_SLOTS; i++) { ground_vec.push([engine.math.vec4(0, 0, 1, 0), engine.math.vec4(0.5, 0.5, 0.5, 0)]); engine.uniforms.set("u_gm[" + i + "]", ground_vec[i][0]); engine.uniforms.set("u_gmavg[" + i + "]", ground_vec[i][1]); }
    const ground_variants = [engine.math.vec4(0, 0, 0, 0), engine.math.vec4(0, 0, 0, 0), engine.math.vec4(0, 0, 0, 0), engine.math.vec4(0, 0, 0, 0), engine.math.vec4(0, 0, 0, 0)];
    ground_variants.forEach(function (v, i) { engine.uniforms.set("u_gv[" + i + "]", v); });
    // The variants of each kind of ground, by the names of the pack's materials (a name the pack lacks is the first material): 0 grass (dry, bright, lush: by humidity), 1 soil (tan, moss, forest floor, clay), 2 sand (pale, orange:
    // by heat; gravel and olive soil after them), 3 rock (grey, dark, rust, slate: by the geology, noise over a few hundred metres), 4 snow (snow, ice).
    const GROUND_VARIANTS = [["grass_dry", "grass_bright", "grass_lush", "grass_lush"], ["soil_tan", "soil_moss", "soil_forest", "clay_red"], ["sand_pale", "sand_orange", "gravel", "soil_olive"], ["rock_grey", "rock_dark", "rock_rust", "rock_slate"], ["snow", "snow_ice", "snow", "snow_ice"]];
    // the pack, decoded (ground.js load + table): { width, height, atlas0, atlas1, table: { names, tile, origin, avg, inner, count } }
    env.set_ground = function (L) {
      if (!L || !L.atlas0 || !L.table) throw new Error("environment: set_ground takes the decoded ground pack (ground.js load, with its table)");
      const T = L.table;
      if (T.count > GROUND_SLOTS) throw new Error("environment: the shader has " + GROUND_SLOTS + " ground materials, the pack " + T.count);
      const make = function (data) { const tx = engine.textures.create({ width: L.width, height: L.height, mipmap: true, anisotropy: 8 }); engine.update_texture_source(tx, data); return tx; };
      world_map.ground_tex = [make(L.atlas0), make(L.atlas1)];
      engine.uniforms.set("u_ground0", world_map.ground_tex[0]); engine.uniforms.set("u_ground1", world_map.ground_tex[1]);
      world_map.ground_u[1][0] = T.inner[0]; world_map.ground_u[1][1] = T.inner[1]; world_map.ground_u[1][2] = L.width; world_map.ground_u[1][3] = L.height;
      for (let i = 0; i < T.count; i++) {
        const g = ground_vec[i], lum = 0.2126 * T.avg[i * 3] + 0.7152 * T.avg[i * 3 + 1] + 0.0722 * T.avg[i * 3 + 2];
        g[0][0] = T.origin[i * 2]; g[0][1] = T.origin[i * 2 + 1]; g[0][2] = T.tile[i]; g[0][3] = lum;
        g[1][0] = T.avg[i * 3]; g[1][1] = T.avg[i * 3 + 1]; g[1][2] = T.avg[i * 3 + 2];
      }
      GROUND_VARIANTS.forEach(function (names, k) { names.forEach(function (n, j) { const id = T.names.indexOf(n); ground_variants[k][j] = id < 0 ? 0 : id; }); });
      world_map.ground_u[0][0] = 1; env.ground_loaded = true; env.ground_names = T.names.slice(); if (world_map.road_u) road_materials();
    };

    // ROADS AS AN OVERLAY OF THE GROUND (system/road_field.js): no road mesh. The page gives `env.set_roads(field)` (road_field.build): the roads' segments in a grid of cells, in two float textures; the terrain's shader asks for every
    // pixel how far the nearest road is and paints asphalt, kerb, sidewalk and markings from the ground materials (they need env.set_ground). The road is the ground itself: a body on it is on the heightmap. env.set_roads(null) takes them away.
    world_map.road_u = [engine.math.vec4(0, 16, 0, 0), engine.math.vec4(1, 2048, 0, 0), engine.math.vec4(0, 0, 0, 0), engine.math.vec4(0, 0, 0, 0)];                     // u_road, u_road2, u_roadm, u_roadm2
    const road_texture = function (w, h, data) { return engine.textures.create({ width: w, height: h, clamp: true, min_filter: GL_NEAREST, mag_filter: GL_NEAREST, format_type: GL_FLOAT, internal_format: GL_RGBA32F, source: data || new Float32Array(w * h * 4) }); };
    world_map.road_tex = [road_texture(1, 1), road_texture(1, 1)];
    engine.uniforms.set("u_road", world_map.road_u[0]); engine.uniforms.set("u_road2", world_map.road_u[1]); engine.uniforms.set("u_roadm", world_map.road_u[2]); engine.uniforms.set("u_roadm2", world_map.road_u[3]);
    engine.uniforms.set("u_rcells", world_map.road_tex[0]); engine.uniforms.set("u_rlist", world_map.road_tex[1]);
    // the materials of the roads, by the pack's names: x asphalt, y paving (sidewalk, cobbles), w dirt road; x gravel (a road between places), y concrete
    const road_materials = function () {
      const T = env.ground_names; if (!T) return;
      const id = function (n) { const i = T.indexOf(n); return i < 0 ? 0 : i; }, m = world_map.road_u;
      m[2][0] = id("asphalt"); m[2][1] = id("paving"); m[2][2] = id("concrete"); m[2][3] = id("soil_tan"); m[3][0] = id("gravel"); m[3][1] = id("concrete");
    };
    env.set_roads = function (F) {
      const u = world_map.road_u;
      if (!F) { u[0][0] = 0; return; }
      world_map.road_tex = [road_texture(F.n, F.n, F.cells), road_texture(F.row, F.rows, F.list)];
      engine.uniforms.set("u_rcells", world_map.road_tex[0]); engine.uniforms.set("u_rlist", world_map.road_tex[1]);
      u[0][0] = 1; u[0][1] = F.cell; u[0][2] = F.ox; u[0][3] = F.oz; u[1][0] = F.n; u[1][1] = F.row;
      road_materials(); env.roads_loaded = true;
    };

    const sea_paint = engine.math.vec4(0, 0, 0, 0);                                    // (u_sea_paint.x = 1 is for the water module: not used here, the sea is painted)

    world_map.biome_map = engine.render_targets.create({

      draw_buffers: {
        color: { filter: GL_LINEAR },
        biome: { filter: GL_LINEAR },
        splat: { filter: GL_LINEAR },
        vegetation: { filter1: GL_LINEAR },
      },
      width: world_map.width,
      mat: engine.materials.clone(engine.render_texture.mat, {

        uniforms: {
          u_heightmap: world_map,
          u_sea_paint: sea_paint
        },

        shader: `
${engine.shaders_cat.noise(world_map.seed, world_map.seed)}
uniform sampler2D u_heightmap;
uniform vec4 u_world_info;
uniform vec4 u_sea_paint;     // x: 1 = the sea is the water module's (water/water.js): the ground under it is painted as a sea floor
float ftm(vec2 x, int type, int oct, float lacunarity, float persistence,
          float frequency, float amplitude) {
    return fbm(x, type, oct, lacunarity, persistence, frequency, amplitude) * 0.5 + 0.5;
}

// Global Wind Settings for Rain Shadow
#define WIND_DIR normalize(vec2(-1.0, 1.0))
#define WIND_FETCH_DIST 0.01

const vec2 heightmap_texel=vec2(1.0/float(${world_map.width}));
layout(location=1) out vec4 frag_biome;
layout(location=2) out vec4 frag_splat;
layout(location=3) out vec4 frag_vegetation;
struct biome_info {
  vec4 rgba;
  vec4 splat; // R=Rock, G=Grass, B=Dirt, A=Snow
  vec4 flora; // R = Tree Density, G = Bush/Shrub Density, B = Grass Density, A = Flora Type ID
};

biome_info mix_bm(in biome_info a, in biome_info b, float scale){
  biome_info r;
  r.rgba = mix(a.rgba, b.rgba, scale);
  r.splat = mix(a.splat, b.splat, scale);
  r.flora = mix(a.flora, b.flora, scale);
  return r;
}

#define BM biome_info
#define MX(a,b,s) mix_bm(a,b,s)

float get_barycentric_height(vec2 uv) {
    vec2 pixel_pos = (uv / heightmap_texel) - vec2(0.5);
    vec2 f_part = floor(pixel_pos);
    vec2 frac_part = pixel_pos - f_part;
    vec2 start_texel = (f_part + vec2(0.5)) * heightmap_texel;

    float h00 = (texture(u_heightmap, start_texel).r);
    float h10 = (texture(u_heightmap, start_texel + vec2(heightmap_texel.x, 0.0)).r);
    float h01 = (texture(u_heightmap, start_texel + vec2(0.0, heightmap_texel.y)).r);
    float h11 = (texture(u_heightmap, start_texel + heightmap_texel).r);

    float is_bottom_left = step(frac_part.x + frac_part.y, 1.0);
    float h_bl = h00 + frac_part.x * (h10 - h00) + frac_part.y * (h01 - h00);
    float h_tr = h11 + (1.0 - frac_part.x) * (h01 - h11) + (1.0 - frac_part.y) * (h10 - h11);

    return mix(h_tr, h_bl, is_bottom_left);
}

void fragment(void) {

    // Map to Dual UVs
    vec2 uv =  v_uv*1.0;
  
    // Calculate Final Absolute Y coordinate
      float h =texture(u_heightmap, v_uv).r;

    //  DOMAIN WARPING 
    // Create an offset vector using noise to shear the UVs
    vec2 warp_offset = vec2(        ftm(uv * 3.0, 1, 4, 2.0, 0.5, 1.0, 1.0),        ftm(uv * 3.0 + vec2(5.2, 1.3), 1, 4, 2.0, 0.5, 1.0, 1.0)    );
    vec2 warped_uv =uv + (warp_offset * 0.15); // The multiplier dictates warp intensity

    //  LATITUDE GRADIENT 
    // Equator is hot (0.5), poles are cold (0.0, 1.0)
    float latitude_falloff = smoothstep(0.0, 1.0, cos(3.14159 * (warped_uv.y - 0.5) * 2.0));

    //  TEMPERATURE 
    float base_temp_noise = ftm(warped_uv * 4.0, 2, 4, 2.0, 0.5, 1.0, 1.0);
    // Force the noise to reach the extremes (0.0 and 1.0)
    float base_temp = smoothstep(0.2, 0.8, base_temp_noise);

    // Blend the noise with the latitude curve, then apply altitude lapse rate
    float temp = clamp((base_temp * 0.5 + latitude_falloff * 0.5) - (h * 0.7), 0.0, 1.0);

    //  OROGRAPHIC EFFECT & HUMIDITY 
    // Note: We use the UNWARPED v_uv here because wind and mountains are physical geometry,
    // not abstract biome values. Warping geometry coords would decouple rain from actual mountains.
    
    float ds=u_world_info.y*0.25;

    float hL = (texture(u_heightmap, (v_uv) + vec2(-heightmap_texel.x, 0.0 )).r) * ds;
    float hR = (texture(u_heightmap, (v_uv) + vec2( heightmap_texel.x, 0.0 )).r) * ds;
    float hD = (texture(u_heightmap, (v_uv) + vec2( 0.0, -heightmap_texel.y)).r) * ds;
    float hU = (texture(u_heightmap, (v_uv) + vec2( 0.0,  heightmap_texel.y)).r) * ds;
    float slope = 1.0 - max(dot(normalize(vec3(hL-hR, 2.0, hD-hU)), vec3(0,1,0)), 0.0);

    // Upwind sampling
    float h_upwind = (texture(u_heightmap, (v_uv) + (WIND_DIR * WIND_FETCH_DIST)).r) * ds;
    float wind_block = max(0.0, h_upwind - (h * ds));
    float rain_shadow_penalty = smoothstep(0.0, 10.0, wind_block) * 0.35;

    // Moisture Pooling (valleys get more water)
    float pooling_bonus = (1.0 - smoothstep(0.0, 0.15, slope)) * (1.0 - h) * 0.25;

    // Final warped humidity
    float base_hum_noise = ftm(warped_uv * 6.0 + vec2(12.3, 45.6), 1, 4, 2.0, 0.5, 1.0, 1.0);
    float base_hum = smoothstep(0.15, 0.85, base_hum_noise);

    float hum = clamp(base_hum - rain_shadow_penalty + pooling_bonus, 0.0, 1.0);

    float dither =mix( ftm(uv * 32.0, 0,7, 2.1, 0.5, 1.0, 1.0),ftm(warped_uv * 64.0, 1,7, 2.0, 0.5, 1.0, 1.0),0.5);
    frag_biome.r = temp;
    frag_biome.g = hum;
    frag_biome.b =dither;
    frag_biome.a=slope;

 // Format: BM(vec4(Color, Variance), vec4(Rock, Grass, Dirt, Snow), vec4(TreeDens, BushDens, GrassDens, TreeType))

  //  WATER & SHORES 
  // Deep and shallow water get zero vegetation. Beaches get rare palms and some dune grass.
  BM DEEP_OCEAN           = BM(vec4(0.04, 0.10, 0.26, 0.02), vec4(0.0, 0.0, 1.0, 0.0), vec4(0.00, 0.00, 0.00, 0.0));
  BM SHALLOW_SEA          = BM(vec4(0.08, 0.22, 0.42, 0.04), vec4(0.0, 0.0, 1.0, 0.0), vec4(0.00, 0.00, 0.00, 0.0));
  BM BEACH                = BM(vec4(0.84, 0.80, 0.58, 0.05), vec4(0.0, 0.0, 1.0, 0.0), vec4(0.05, 0.10, 0.20, 3.0));
  BM MUDFLAT              = BM(vec4(0.54, 0.48, 0.36, 0.08), vec4(0.0, 0.0, 1.0, 0.0), vec4(0.00, 0.20, 0.30, 1.0));

  //  DESERTS 
  // Very sparse scrub. Rare palm trees might spawn in hot deserts (representing tiny oases).
  BM HOT_DESERT           = BM(vec4(0.90, 0.78, 0.40, 0.06), vec4(0.0, 0.0, 1.0, 0.0), vec4(0.02, 0.10, 0.05, 3.0));
  BM COLD_DESERT          = BM(vec4(0.74, 0.68, 0.50, 0.10), vec4(0.2, 0.0, 0.8, 0.0), vec4(0.00, 0.20, 0.10, 0.0));

  //  PLAINS & SHRUBLANDS 
  // High grass and bush density, but low tree density.
  BM SAVANNA              = BM(vec4(0.74, 0.64, 0.26, 0.15), vec4(0.0, 0.5, 0.5, 0.0), vec4(0.15, 0.60, 0.80, 1.0));
  BM SHRUBLAND            = BM(vec4(0.56, 0.54, 0.26, 0.20), vec4(0.1, 0.6, 0.3, 0.0), vec4(0.10, 0.80, 0.60, 1.0));
  BM GRASSLAND            = BM(vec4(0.44, 0.60, 0.22, 0.15), vec4(0.0, 1.0, 0.0, 0.0), vec4(0.05, 0.20, 1.00, 1.0));

  //  FORESTS & JUNGLES 
  // Maximum tree and bush densities, transitioning from Oak to Pine to Tropical.
  BM WOODLAND             = BM(vec4(0.30, 0.50, 0.20, 0.22), vec4(0.0, 0.7, 0.3, 0.0), vec4(0.60, 0.50, 0.70, 1.0));
  BM TEMPERATE_FOREST     = BM(vec4(0.16, 0.40, 0.16, 0.24), vec4(0.0, 0.8, 0.2, 0.0), vec4(0.85, 0.60, 0.60, 1.0));
  BM TEMPERATE_RAINFOREST = BM(vec4(0.10, 0.32, 0.14, 0.25), vec4(0.1, 0.8, 0.1, 0.0), vec4(0.95, 0.80, 0.50, 0.0));
  BM TROPICAL_FOREST      = BM(vec4(0.06, 0.26, 0.10, 0.25), vec4(0.0, 0.9, 0.1, 0.0), vec4(0.85, 0.70, 0.60, 2.0));
  BM JUNGLE               = BM(vec4(0.04, 0.20, 0.07, 0.26), vec4(0.0, 0.8, 0.2, 0.0), vec4(1.00, 1.00, 0.50, 2.0));

  //  COLD ENVIRONMENTS 
  // Dense pines in the Taiga, tapering off into pure bushes/grass in the Tundra, dead in the Ice.
  BM TAIGA                = BM(vec4(0.20, 0.34, 0.22, 0.22), vec4(0.1, 0.6, 0.2, 0.1), vec4(0.80, 0.40, 0.40, 0.0));
  BM TUNDRA               = BM(vec4(0.58, 0.54, 0.42, 0.16), vec4(0.2, 0.4, 0.3, 0.1), vec4(0.05, 0.60, 0.30, 0.0));
  BM COLD_TUNDRA          = BM(vec4(0.50, 0.48, 0.44, 0.14), vec4(0.3, 0.1, 0.2, 0.4), vec4(0.00, 0.30, 0.10, 0.0));
  BM ICE                  = BM(vec4(0.86, 0.90, 0.96, 0.03), vec4(0.0, 0.0, 0.0, 1.0), vec4(0.00, 0.00, 0.00, 0.0));

  //  ROCKS & MOUNTAINS 
  // Dead zones. No vegetation grows on sheer cliffs or alpine peaks.
  BM BARE_ROCK            = BM(vec4(0.38, 0.36, 0.34, 0.30), vec4(1.0, 0.0, 0.0, 0.0), vec4(0.00, 0.00, 0.00, 0.0));
  BM ALPINE_ROCK          = BM(vec4(0.52, 0.48, 0.44, 0.32), vec4(1.0, 0.0, 0.0, 0.0), vec4(0.00, 0.00, 0.00, 0.0));
  BM SNOW_CAP             = BM(vec4(0.95, 0.96, 1.00, 0.04), vec4(0.0, 0.0, 0.0, 1.0), vec4(0.00, 0.00, 0.00, 0.0));


dither*=0.1;

  float t = clamp(temp + dither, 0.0, 1.0);
  float m = clamp(hum  + dither, 0.0, 1.0);

  BM color = MX(ICE,         COLD_TUNDRA,  smoothstep(0.0,  0.70, m));


  BM boreal = MX(COLD_TUNDRA, TUNDRA,       smoothstep(0.0,  0.35, m));
  boreal = MX(boreal,      TAIGA,         smoothstep(0.35, 0.75, m));

  BM cool   = MX(COLD_DESERT, SHRUBLAND,    smoothstep(0.10, 0.32, m));
  cool   = MX(cool,        WOODLAND,      smoothstep(0.32, 0.55, m));
  cool   = MX(cool,        TEMPERATE_FOREST,   smoothstep(0.55, 0.80, m));

  BM warm   = MX(HOT_DESERT,  SAVANNA,       smoothstep(0.08, 0.28, m));
  warm   = MX(warm,        GRASSLAND,     smoothstep(0.25, 0.46, m));
  warm   = MX(warm,        WOODLAND,      smoothstep(0.44, 0.60, m));
  warm   = MX(warm,        TEMPERATE_FOREST,   smoothstep(0.58, 0.74, m));
  warm   = MX(warm,        TEMPERATE_RAINFOREST,  smoothstep(0.72, 0.90, m));

  BM trop   = MX(HOT_DESERT,  SAVANNA,       smoothstep(0.06, 0.26, m));
  trop   = MX(trop,        GRASSLAND,     smoothstep(0.22, 0.42, m));
  trop   = MX(trop,        TROPICAL_FOREST,  smoothstep(0.38, 0.58, m));
  trop   = MX(trop,        JUNGLE,        smoothstep(0.60, 0.82, m));


  color = MX(color, boreal, smoothstep(0.12, 0.24, t));
  color = MX(color, cool,   smoothstep(0.28, 0.42, t));
  color = MX(color, warm,   smoothstep(0.46, 0.60, t));
  color = MX(color, trop,   smoothstep(0.64, 0.78, t));



  //  TERRAIN MASKS (Rock, Snow, Shorelines) 
  float snow_line  = mix(0.62, 0.75, temp);
  float alp_line   = snow_line - 0.07;
  float rock_mask  = smoothstep(alp_line - 0.02, alp_line + 0.03, h + dither - slope * 0.04);
  color = MX(color, MX(BARE_ROCK, ALPINE_ROCK, smoothstep(0.1, 0.5, slope)), rock_mask);

  float snow_mask  = smoothstep(snow_line - 0.02, snow_line + 0.02, h - slope * 0.5 + dither);
  color = MX(color, SNOW_CAP, snow_mask);

  float cliff_mask = smoothstep(0.22, 0.48, slope + dither * 0.4) * (1.0 - snow_mask);
  color = MX(color, BARE_ROCK, cliff_mask);

  // The shore and the water, in METRES of the drawn world (u_world_info.y is its height, the sea is at h = 0.18): the bands were in the map's units, 125 m of a 3000 m world and 12 m of a 300 m one,
  // and dither (0 .. 0.1, never negative) lifted them by 0.05. Under the sea's level it is WATER (shallow blue, deeper further down: a lake is a hollow and a river a channel under the sea's
  // level; before, it was sand down to h = 0.12, where the deep ocean began, and SHALLOW_SEA was never used).
  float alt_m      = (h - 0.18) * u_world_info.y + (dither - 0.05) * 100.0;      // (the noise: +- 5 m)
  float beach_mask = smoothstep(0.0, 10.0, alt_m);
  float mud_mask   = smoothstep(-2.0, 6.0, alt_m);
  float water      = 1.0 - smoothstep(-4.0, 0.0, alt_m);
  float deep       = 1.0 - smoothstep(0.00, 0.12, h);

  color = MX(MUDFLAT,     color,       mud_mask);
  color = MX(BEACH,       color,       beach_mask);
  // the sea: painted blue (the sea of the terrain), or, when the water module draws it (u_sea_paint.x = 1), a sea FLOOR of sand and mud for the water to be seen over
  BM SEABED_SAND = BM(vec4(0.70, 0.62, 0.44, 0.06), vec4(0.0, 0.0, 1.0, 0.0), vec4(0.0));
  BM SEABED_MUD  = BM(vec4(0.20, 0.17, 0.13, 0.08), vec4(0.0, 0.0, 1.0, 0.0), vec4(0.0));
  BM painted_sea = MX(color, SHALLOW_SEA, water);
  painted_sea    = MX(painted_sea, DEEP_OCEAN, deep);
  BM seabed      = MX(SEABED_SAND, SEABED_MUD, max(smoothstep(1.5, 60.0, -alt_m), deep));
  BM water_sea   = MX(color, seabed, water);
  color = MX(painted_sea, water_sea, u_sea_paint.x);

  // 1. Generate a high-frequency noise for localized color variation.
  // We use 'warped_uv' or 'uv' scaled up so the detail is fine-grained.
  float lum_noise = ftm(warped_uv * 150.0, 0, 5, 2.0, 0.5, 1.0, 1.0);

  // 2. Remap noise from [0.0, 1.0] to [-1.0, 1.0] to allow darkening AND lightening
  lum_noise = (lum_noise - 0.5) * 2.0;

  // 3. Multiply the noise by the biome's specific variance allowance (node.rgba.a)
  float variance = lum_noise * color.rgba.a;

  // 4. Apply the variation to the RGB color
  // We multiply it so the variation scales naturally with the underlying brightness
  vec3 varied_color = color.rgba.rgb + (color.rgba.rgb * variance);

  // 5. Output the final color (force alpha to 1.0 for the actual texture output)
  frag_color = vec4(varied_color, 1.0);
  //frag_color.rgb=vec3(variance);


  float total_weight = dot(color.splat, vec4(1.0));
  frag_splat = color.splat / max(total_weight, 0.0001);


  // 1. Generate local clustering noise (Forest groves vs clearings)
    float cluster_noise = ftm(warped_uv * 12.0, 0, 3, 2.0, 0.5, 1.0, 1.0);

    // 2. Base Tree Probability = Biome Max Density * Local Clustering
    float tree_prob = color.flora.r * smoothstep(0.3, 0.7, cluster_noise);

    // 3. Exclude trees from steep slopes using your existing slope variable
    tree_prob *= (1.0 - smoothstep(0.2, 0.5, slope));

    // 4. Do the same for bushes/shrubs, perhaps using an inverted noise so bushes grow in tree clearings
    float bush_prob = color.flora.g * smoothstep(0.4, 0.8, 1.0 - cluster_noise);

    // 5. Output to the new FBO target for C++ to read
    // R = Final Tree Probability, G = Bush Probability, B = Grass Density, A = Tree Type ID

    // Quantize t and m from [0.0, 1.0] to [0.0, 15.0]
    float t_val = floor(t * 15.0);
    float m_val = floor(m * 15.0);

    // Pack: Temperature takes upper 4 bits (* 16.0), Humidity takes lower 4 bits
    float packed_climate = (t_val * 16.0 + m_val) / 255.0;

    frag_vegetation = vec4(tree_prob, bush_prob,smoothstep(0.35,1.0, color.flora.b), packed_climate);

}

`
      })
    });

    engine.uniforms.set("u_biome_map", world_map.biome_map.biome);
    engine.uniforms.set("u_shadow_grid", u_shadow_grid);
    engine.uniforms.set("u_biome_color_map", world_map.biome_map.color);
    engine.uniforms.set("u_biome_splat_map", world_map.biome_map.splat);
    const common_shdr = `
uniform vec4 u_world_info;
uniform sampler2D u_heightmap;
const vec2 heightmap_texel=vec2(1.0/float(${world_map.width}));
varying float v_altitude;

vec4 get_height(vec2 uv){

return texture(u_heightmap, uv);
}
const int heightmap_size = ${world_map.width};

// The ground: the map's heights joined by a Catmull-Rom bicubic (C1, through every texel). This is game_world_get_height of game.cpp, the physics' ground, line for line: keep the two in step.
// grad: the slope of the height (map units) per texel in x and z, from the same 16 texels, so the lighting normal is the normal of the surface that is drawn.
float get_smooth_height(vec2 uv, out vec2 grad) {
    vec2 p = clamp(uv * float(heightmap_size) - vec2(0.5), vec2(0.0), vec2(float(heightmap_size - 1)));
    vec2 p0 = floor(p);
    vec2 t = p - p0;
    ivec2 i0 = ivec2(p0) - ivec2(1);

    vec2 t2 = t * t;
    vec2 t3 = t2 * t;
    vec4 wx = vec4(-0.5 * t3.x + t2.x - 0.5 * t.x, 1.5 * t3.x - 2.5 * t2.x + 1.0, -1.5 * t3.x + 2.0 * t2.x + 0.5 * t.x, 0.5 * t3.x - 0.5 * t2.x);
    vec4 wy = vec4(-0.5 * t3.y + t2.y - 0.5 * t.y, 1.5 * t3.y - 2.5 * t2.y + 1.0, -1.5 * t3.y + 2.0 * t2.y + 0.5 * t.y, 0.5 * t3.y - 0.5 * t2.y);
    vec4 dx = vec4(-1.5 * t2.x + 2.0 * t.x - 0.5, 4.5 * t2.x - 5.0 * t.x, -4.5 * t2.x + 4.0 * t.x + 0.5, 1.5 * t2.x - t.x);
    vec4 dy = vec4(-1.5 * t2.y + 2.0 * t.y - 0.5, 4.5 * t2.y - 5.0 * t.y, -4.5 * t2.y + 4.0 * t.y + 0.5, 1.5 * t2.y - t.y);

    int last = heightmap_size - 1;
    float h = 0.0;
    vec2 g = vec2(0.0);
    for (int j = 0; j < 4; j++) {
        int y = clamp(i0.y + j, 0, last);
        float rh = 0.0;
        float rd = 0.0;
        for (int i = 0; i < 4; i++) {
            float v = texelFetch(u_heightmap, ivec2(clamp(i0.x + i, 0, last), y), 0).r;
            rh += wx[i] * v;
            rd += dx[i] * v;
        }
        h += wy[j] * rh;
        g.x += wy[j] * rd;
        g.y += dy[j] * rh;
    }
    grad = g;
    return h;
}

float get_smooth_height(vec2 uv) {
    vec2 grad;
    return get_smooth_height(uv, grad);
}
float get_barycentric_height(vec2 uv) {
    vec2 pixel_pos = (uv / heightmap_texel) - vec2(0.5);
    vec2 f_part = floor(pixel_pos);
    vec2 frac_part = pixel_pos - f_part;
    vec2 start_texel = (f_part + vec2(0.5)) * heightmap_texel;

    float h00 = (texture(u_heightmap, start_texel).r);
    float h10 = (texture(u_heightmap, start_texel + vec2(heightmap_texel.x, 0.0)).r);
    float h01 = (texture(u_heightmap, start_texel + vec2(0.0, heightmap_texel.y)).r);
    float h11 = (texture(u_heightmap, start_texel + heightmap_texel).r);

    float is_bottom_left = step(frac_part.x + frac_part.y, 1.0);
    float h_bl = h00 + frac_part.x * (h10 - h00) + frac_part.y * (h01 - h00);
    float h_tr = h11 + (1.0 - frac_part.x) * (h01 - h11) + (1.0 - frac_part.y) * (h10 - h11);

    return mix(h_tr, h_bl, is_bottom_left);
}

`
    // Placed by gl_InstanceID: instance i is the cell (i % n, i / n) of an n x n grid whose lower corner is u_shadow_grid.zw (a multiple of the cell, so the vertices fall on the chunks' vertices).
    // The height is the lit surface's (get_smooth_height, the Catmull-Rom bicubic that game_world_get_height of game.cpp is), not the barycentric one of the first terrain.
    const shadow_shader = `
${common_shdr}
uniform vec4 u_shadow_grid;
void vertex(void) {
    int n = int(u_shadow_grid.x + 0.5);
    int row = gl_InstanceID / n;
    int col = gl_InstanceID - row * n;
    vec2 centre = u_shadow_grid.zw + (vec2(float(col), float(row)) + 0.5) * u_shadow_grid.y;
    v_position_world.xz = a_position.xz * u_shadow_grid.y + centre;
    v_uv = (v_position_world.xz / u_world_info.x) + 0.5;
    v_altitude = get_barycentric_height(v_uv);
    v_position_world.y = v_altitude * u_world_info.y;
    gl_Position = u_view_projection_matrix * vec4(v_position_world, 1.0);
}`;

    // GAME: THE TILES (game/game_tiles.js). The world's grid of typed tiles is painted on the ground by the terrain's fragment shader: the colour of each tile that paints (alpha 1; the terrain keeps its own colour under a tile that does
    // not), and a line along the sides of a painted tile that face an unpainted one. Two small nearest-filtered textures, a texel a tile. A game without tiles gets no code in the shader. (The worker walls the drivable tiles: game_init.)
    const tile_glsl = { decl: "", apply: "float tile_cover = 0.0;" };
    if (tile_grid) {
      const tile_texture = function (data) { return engine.textures.create({ width: tile_grid.n, height: tile_grid.n, clamp: true, min_filter: GL_NEAREST, mag_filter: GL_NEAREST, source: data }); };
      world_map.tile_paint = tile_texture(tile_grid.paint());
      world_map.tile_edge = tile_texture(tile_grid.edges());
      engine.uniforms.set("u_tile_paint", world_map.tile_paint);
      engine.uniforms.set("u_tile_edge", world_map.tile_edge);
      engine.uniforms.set("u_tile_info", engine.math.vec4(tile_grid.size, tile_grid.n, 0, 0));
      tile_glsl.decl = `
uniform sampler2D u_tile_paint;      // the tiles: rgb the colour of the tile, a 1 where it paints
uniform sampler2D u_tile_edge;       // rgb the colour of the line along the edge of a painted tile, a its width (twice a share of the tile)
uniform vec4 u_tile_info;            // x: metres a side of the grid (centred on the world's middle), y: tiles a side
vec4 tile_at(ivec2 t) {
  int n = int(u_tile_info.y + 0.5);
  if (t.x < 0 || t.y < 0 || t.x >= n || t.y >= n) return vec4(0.0);
  return texelFetch(u_tile_paint, t, 0);
}
// the paint at a place on the ground: the colour, and in cover how much of the terrain's own it hides (0 or 1)
vec4 tile_paint(vec2 xz, out float cover) {
  vec2 g = (xz / u_tile_info.x + 0.5) * u_tile_info.y;
  ivec2 t = ivec2(floor(g));
  vec2 f = g - floor(g);
  vec4 c = tile_at(t);
  cover = c.a;
  if (c.a < 0.5) return c;
  vec4 e = texelFetch(u_tile_edge, t, 0);
  float w = e.a * 0.5;
  if (w > 0.0) {
    float line = 0.0;
    line = max(line, step(f.x, w) * (1.0 - tile_at(t + ivec2(-1, 0)).a));
    line = max(line, step(1.0 - w, f.x) * (1.0 - tile_at(t + ivec2(1, 0)).a));
    line = max(line, step(f.y, w) * (1.0 - tile_at(t + ivec2(0, -1)).a));
    line = max(line, step(1.0 - w, f.y) * (1.0 - tile_at(t + ivec2(0, 1)).a));
    c.rgb = mix(c.rgb, e.rgb, line);
  }
  return c;
}
`;
      tile_glsl.apply = `
  float tile_cover = 0.0;
  vec4 tile_c = tile_paint(mat.position_world.xz, tile_cover);
  mat.base_color = vec4(mix(color.rgb, tile_c.rgb, tile_cover), color.a);
`;
    }
    world_map.mesh = {


      shadow_geo: engine.geometries.plane(1, 1, 16, 16, 2),
      geo: engine.geometries.plane_skirt_unindexed_xz(1, 1, world_map.chunk_divs, world_map.chunk_divs),
      mat: engine.materials.create({
        compiler: "pbr",
        wireframe: !true,
        props: {
          enable_vertex_color: true,
          calculate_tbn: true,
        },
        uniforms: {
          u_baryframe_opacity: 0.09,
          u_baryframe_width1: 0.5,
        },
        shader: `
attribute vec3 a_chunk_data;
${common_shdr}
void vertex(void) {
     v_position_world.xz = (a_position.xz * a_chunk_data.z) + a_chunk_data.xy;

    vec2 uv = (v_position_world.xz/ u_world_info.x) + 0.5;

    vec2 grad;
    v_altitude = get_smooth_height(uv, grad);
    vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
    grad *= inside.x * inside.y;                      // (past the border of the map the ground is the border's, flat)

    // the slope of the drawn surface (world_map.normal_slope says how steep it is lit)
    float ds = u_world_info.y * ${world_map.normal_slope.toFixed(4)};
    v_normal_world = normalize(vec3(-grad.x * ds, 1.0, -grad.y * ds));

    vec3 abs_world_pos = vec3(v_position_world.x, v_altitude * u_world_info.y , v_position_world.z);
    abs_world_pos.y += a_position.y * a_chunk_data.z * 0.025;
    v_position_world = abs_world_pos;
    vec3 relative_pos = v_position_world - u_camera_position;
    gl_Position = u_view_projection_matrix * vec4(v_position_world, 1.0);
    v_color=vec4(1);
    v_uv = clamp(uv, vec2(0.0), vec2(1.0));           // (past the border the colour is the border's: the ocean)

}

uniform sampler2D u_biome_map;
uniform sampler2D u_biome_color_map;
uniform sampler2D u_biome_splat_map;
varying float v_altitude;
${engine.shaders_cat.texture_sampler()}
const vec2 biome_texel = vec2(1.0/float(${world_map.biome_map.width}));
const vec2 heightmap_texel=vec2(1.0/float(${world_map.width}));
uniform vec4 u_world_info;
uniform vec4 u_detail;        // x: strength, y: wavelength of the biggest swell (m), z: crags, w: the sea level (map units)
uniform vec4 u_detail2;       // x: the metres a pixel covers per metre of distance (the page sets it every frame)

// ---- the detail of the lit ground: noise leans the normal, per pixel (world_map.detail) ----
vec2 dn_hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

// Gradient noise with its analytic derivative: (n, dn/dx, dn/dy), n about -0.7 .. 0.7. The quintic fade leaves no creases on the lattice.
vec3 dn_noise(vec2 x) {
    vec2 i = floor(x);
    vec2 f = x - i;
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
    vec2 ga = dn_hash(i) * 2.0 - 1.0;
    vec2 gb = dn_hash(i + vec2(1.0, 0.0)) * 2.0 - 1.0;
    vec2 gc = dn_hash(i + vec2(0.0, 1.0)) * 2.0 - 1.0;
    vec2 gd = dn_hash(i + vec2(1.0, 1.0)) * 2.0 - 1.0;
    float va = dot(ga, f), vb = dot(gb, f - vec2(1.0, 0.0)), vc = dot(gc, f - vec2(0.0, 1.0)), vd = dot(gd, f - vec2(1.0, 1.0));
    float k = va - vb - vc + vd;
    float v = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * k;
    vec2 d = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) + du * (u.yx * k + vec2(vb - va, vc - va));
    return vec3(v, d);
}

// The height of the ground (map units) at uv: get_smooth_height of the vertex shader (the map's heights joined by a Catmull-Rom bicubic, C1, through every texel), line for line, without the slope.
// (the fragment stage has none of the vertex stage's code: keep the two in step)
uniform sampler2D u_heightmap;
float ground_height(vec2 uv) {
    const int size = ${world_map.width};
    vec2 p = clamp(uv * float(size) - vec2(0.5), vec2(0.0), vec2(float(size - 1)));
    vec2 p0 = floor(p);
    vec2 t = p - p0;
    ivec2 i0 = ivec2(p0) - ivec2(1);
    vec2 t2 = t * t;
    vec2 t3 = t2 * t;
    vec4 wx = vec4(-0.5 * t3.x + t2.x - 0.5 * t.x, 1.5 * t3.x - 2.5 * t2.x + 1.0, -1.5 * t3.x + 2.0 * t2.x + 0.5 * t.x, 0.5 * t3.x - 0.5 * t2.x);
    vec4 wy = vec4(-0.5 * t3.y + t2.y - 0.5 * t.y, 1.5 * t3.y - 2.5 * t2.y + 1.0, -1.5 * t3.y + 2.0 * t2.y + 0.5 * t.y, 0.5 * t3.y - 0.5 * t2.y);
    int last = size - 1;
    float h = 0.0;
    for (int j = 0; j < 4; j++) {
        int y = clamp(i0.y + j, 0, last);
        float rh = 0.0;
        for (int i = 0; i < 4; i++) rh += wx[i] * texelFetch(u_heightmap, ivec2(clamp(i0.x + i, 0, last), y), 0).r;
        h += wy[j] * rh;
    }
    return h;
}

// ---- the ground materials (world_map.ground, env.set_ground): the base PBR sets laid on the ground by the biome ----
uniform sampler2D u_ground0;     // atlas: albedo rgb (sRGB), ao
uniform sampler2D u_ground1;     // atlas: normal x y (OpenGL), roughness, height
uniform vec4 u_ground;           // x: 1 when the materials are there, y: 1 one tile, 2 two tiles blended, z: the share of a material's own hue in the colour, w: metres where the materials fade into the biome's colour
uniform vec4 u_ground2;          // xy: a material's picture in uv, zw: the atlas in texels
uniform vec4 u_ground3;          // x: normal strength, y: ao strength
uniform vec4 u_gm[24];           // a material: xy the uv of its picture's corner, z the metres a tile covers, w the luminance of its average colour (linear)
uniform vec4 u_gmavg[24];        // a material's average colour (linear)
uniform vec4 u_gv[5];            // the variants of grass, soil, sand, rock, snow (material ids)

// one tile of a material read at the world's xz p: the picture is read by fract() inside its cell of the atlas with explicit gradients, whose size keeps the mip level where the cell's border still holds (8 texels: under 7)
void gm_fetch(int id, vec2 p, vec2 dpx, vec2 dpy, out vec4 a, out vec4 n) {
  vec4 m = u_gm[id];
  vec2 uv = p / m.z;
  vec2 cuv = m.xy + fract(uv) * u_ground2.xy;
  vec2 gx = dpx / m.z * u_ground2.xy;
  vec2 gy = dpy / m.z * u_ground2.xy;
  float foot = max(length(gx * u_ground2.zw), length(gy * u_ground2.zw));
  float k = min(1.0, 7.0 / max(foot, 0.0001));
  gx *= k; gy *= k;
  a = textureGrad(u_ground0, cuv, gx, gy);
  n = textureGrad(u_ground1, cuv, gx, gy);
}
// the slope (rise per metre along the picture's u and v) of a tangent normal's x and y: v runs down the picture, the normal's y up it
vec2 gm_slope(vec2 t) {
  float z = sqrt(max(1.0 - dot(t, t), 0.06));
  return vec2(-t.x / z, t.y / z);
}
// a material at the plane p (the ground's x, z; for a cliff the caller gives (z, y) or (x, y)): colour (linear, its ao in), roughness, height, and the slope along the plane's axes.
// quality 2 reads a second tile turned 33 degrees and a little bigger and blends the two by a noise: no tile repeats the same way twice
void gm_layer(int id, vec2 p, vec2 dpx, vec2 dpy, float aa, out vec3 alb, out float rough, out float hgt, out vec2 slope) {
  vec4 a, n;
  gm_fetch(id, p, dpx, dpy, a, n);
  vec2 s = gm_slope(n.xy * 2.0 - 1.0);
  if (u_ground.y > 1.5) {
    const mat2 R = mat2(0.8387, -0.5446, 0.5446, 0.8387);
    vec4 a2, n2;
    gm_fetch(id, R * p * 0.43 + vec2(31.7, 17.3), R * dpx * 0.43, R * dpy * 0.43, a2, n2);
    vec2 s2 = gm_slope(n2.xy * 2.0 - 1.0) * R;       // (back into the plane's axes: the transpose of R times the slope)
    a = mix(a, a2, aa); n = mix(n, n2, aa); s = mix(s, s2, aa);
  }
  alb = pow(a.rgb, vec3(2.2)) * mix(1.0, a.a, u_ground3.y);
  rough = n.z; hgt = n.w; slope = s * u_ground3.x;
}
// which material of a kind of ground (0 grass, 1 soil and sand, 2 rock, 3 snow) is here: the climate chooses, a noise of a few metres breaks the choice into patches (d), a noise of a few hundred metres is the geology (geo)
int gm_pick(int c, float temp, float hum, float lum, float d, float geo) {
  if (c == 0) return int(u_gv[0][int(floor(clamp(hum * 2.0 + d, 0.0, 2.0) + 0.5))] + 0.5);
  if (c == 1) {
    float sandy = smoothstep(0.52, 0.74, lum) + d * 0.25;
    float hot = step(0.62, temp + d * 0.4);
    float soil = clamp(hum * 2.0 + d, 0.0, 2.0);
    float clay = step(0.74, geo) * step(0.3, temp);
    float id_sand = u_gv[2][int(hot)];
    float id_soil = mix(u_gv[1][int(floor(soil + 0.5))], u_gv[1][3], clay);
    return int(mix(id_soil, id_sand, step(0.5, sandy)) + 0.5);
  }
  if (c == 2) return int(u_gv[3][int(clamp(floor(geo * 4.0 + d * 0.5), 0.0, 3.0))] + 0.5);
  return int(u_gv[4][int(step(0.55, geo + d * 0.3))] + 0.5);
}

// ---- the roads as an overlay of the ground (road_field.js; env.set_roads) ----
uniform sampler2D u_rcells;      // a cell of the grid: x the first entry of its list, y how many
uniform sampler2D u_rlist;       // two texels an entry: (ax, az, bx, bz), (half width, walk, arc length at a, class + 8 for a junction disc + 16 x the road's id)
uniform vec4 u_road;             // x: 1 when there are roads, y: metres a cell, zw: the world's x and z of the grid's corner
uniform vec4 u_road2;            // x: cells a side, y: texels a row of the list
uniform vec4 u_roadm;            // material ids: x asphalt, y paving, z concrete, w dirt
uniform vec4 u_roadm2;           // x gravel
float rd_smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
// the nearest road at p: R = (smooth distance to the asphalt's edge: under 0 on it, walk: the sidewalk's width, class, 1 on a junction disc), Q = (metres left of the line of travel, arc length, half width, the distance to the nearest OTHER road's asphalt: markings stop where it begins), gd = the way the distance grows.
// The same function as road_field.js at().
void road_at(vec2 p, out vec4 R, out vec4 Q, out vec2 gd) {
  R = vec4(1000.0, 0.0, 0.0, 0.0); Q = vec4(0.0); gd = vec2(0.0, 1.0);
  vec2 g = (p - u_road.zw) / u_road.y;
  ivec2 ci = ivec2(floor(g));
  int n = int(u_road2.x + 0.5);
  if (ci.x < 0 || ci.y < 0 || ci.x >= n || ci.y >= n) return;
  vec4 c = texelFetch(u_rcells, ci, 0);
  int start = int(c.x + 0.5);
  int cnt = int(c.y + 0.5);
  int row = int(u_road2.y + 0.5);
  float dsm = 1000.0;
  float best = 1000.0;
  float best_id = -1.0;
  for (int i = 0; i < 16; i++) {
    if (i >= cnt) break;
    int e = (start + i) * 2;
    ivec2 t0 = ivec2(e % row, e / row);
    vec4 s0 = texelFetch(u_rlist, t0, 0);
    vec4 s1 = texelFetch(u_rlist, t0 + ivec2(1, 0), 0);
    vec2 ab = s0.zw - s0.xy;
    float l2 = dot(ab, ab);
    float t = l2 > 1e-6 ? clamp(dot(p - s0.xy, ab) / l2, 0.0, 1.0) : 0.0;
    vec2 v = p - (s0.xy + ab * t);
    float dist = length(v);
    float di = dist - s1.x;
    dsm = rd_smin(dsm, di, 2.0);
    if (di < best) {
      best = di;
      float len = sqrt(l2);
      float low = mod(s1.w, 16.0);
      float junc = step(8.0, low);
      best_id = floor(s1.w / 16.0);
      R.yzw = vec3(s1.y, low - junc * 8.0, junc);
      Q = vec4(l2 > 1e-6 ? (ab.x * v.y - ab.y * v.x) / len : 0.0, s1.z + t * len, s1.x, 1000.0);
      gd = v / max(dist, 1e-4);
    }
  }
  R.x = dsm;
  if (best < 0.5) {                                                  // a second look for the nearest other road (only where the first found asphalt: a marking would be painted here)
    for (int i = 0; i < 16; i++) {
      if (i >= cnt) break;
      int e = (start + i) * 2;
      ivec2 t0 = ivec2(e % row, e / row);
      vec4 s0 = texelFetch(u_rlist, t0, 0);
      vec4 s1 = texelFetch(u_rlist, t0 + ivec2(1, 0), 0);
      if (floor(s1.w / 16.0) == best_id) continue;
      vec2 ab = s0.zw - s0.xy;
      float l2 = dot(ab, ab);
      float t = l2 > 1e-6 ? clamp(dot(p - s0.xy, ab) / l2, 0.0, 1.0) : 0.0;
      Q.w = min(Q.w, length(p - (s0.xy + ab * t)) - s1.x);
    }
  }
}

uniform sampler2D u_detail_map;       // the detail map (world_map.detail_map): RG the slope of rock, BA of soil and grass, as 0.5 + slope / (6 rms)
${tile_glsl.decl}

// The slope (rise per metre, in the axes of p) of three octaves of detail at p: the big forms, 48, 24 and 12 m. They are noise, not texture, so they never repeat. An octave of wavelength w is
// the height w * n(p / w), so every octave leans the light as much, times gain^i. footprint is the metres a pixel covers: a wavelength under 2 pixels is faded out, over 5 whole. crag 0 =
// rolling noise, 1 = ridged (all but the first octave: ridged, its creases would be long straight edges), and then the detail of an octave lives on the ridges of the one before (the valley
// floors stay smooth): the look of eroded rock, not of one noise over another.
vec2 detail_slope(vec2 p, float footprint, float crag, float gain) {
    const mat2 turn = mat2(0.8, -0.6, 0.6, 0.8);       // each octave is turned against the one before, or the lattice of the noise shows in the crags
    mat2 M = mat2(1.0);
    vec2 sum = vec2(0.0);
    float w = u_detail.y;
    float a = 1.0;
    float on_ridge = 1.0;                              // how much of the octave before is a ridge here (1: all, so this octave is whole)
    for (int i = 0; i < 3; i++) {
        float fade = smoothstep(2.0 * footprint, 5.0 * footprint, w);
        if (fade <= 0.0) break;
        vec3 n = dn_noise(M * p / w + vec2(float(i) * 17.31, float(i) * 31.77));
        vec2 g = n.yz * M;                              // (n.yz * M = the transpose of M times the slope: back to the axes of p)
        vec2 s = g;
        if (i > 0) {
            // ridged: 1 - 2|n|, its slope is -2 sign(n) g. The crease is as sharp as a pixel can show (e: n changes by about |g| footprint / w across a pixel)
            float e = max(0.004, length(g) * footprint / w);
            s = mix(g, -2.0 * (n.x / sqrt(n.x * n.x + e * e)) * g, crag);
        }
        sum += s * (a * fade * on_ridge);
        on_ridge = mix(1.0, clamp((1.0 - 2.0 * abs(n.x)) * 1.5, 0.1, 1.0), crag);
        w *= 0.5;
        a *= gain;
        M = turn * M;
    }
    return sum;
}

// One layer of the detail map laid on the ground: tile metres a tile, turned by ang and moved by off. The 3D gradient (slope) of the detail at P, rock or soil by rock (0 .. 1),
// from the three sides: w are the weights of the planes (x: the face looks along x, so the plane is (z, y); y: from above, (x, z); z: (x, y)). The map is read with the derivatives of the
// position (dPdx, dPdy), which come from outside, taken where every pixel runs them: a pixel on a cliff reads a plane of the map that a pixel on the plain does not.
vec3 detail_layer(vec3 P, vec3 dPdx, vec3 dPdy, vec3 w, float tile, float ang, vec2 off, float rock) {
    float c = cos(ang);
    float s = sin(ang);
    mat2 Q = mat2(c, -s, s, c);
    vec3 G = vec3(0.0);
return G;
    vec4 t;
    vec2 sl;
    if (w.y > 0.002) {
        t = textureGrad(u_detail_map, Q * P.xz / tile + off, Q * dPdx.xz / tile, Q * dPdy.xz / tile);
        sl = ((mix(t.ba, t.rg, rock) * 2.0 - 1.0) * 3.0 * w.y) * Q;            // (* Q: the transpose of Q times the slope: back to the world's axes)
        G += vec3(sl.x, 0.0, sl.y);
    }
    if (w.x > 0.01) {
        t = textureGrad(u_detail_map, Q * P.zy / tile + off + vec2(0.37, 0.61), Q * dPdx.zy / tile, Q * dPdy.zy / tile);
        sl = ((mix(t.ba, t.rg, rock) * 2.0 - 1.0) * 3.0 * w.x) * Q;
        G += vec3(0.0, sl.y, sl.x);
    }
    if (w.z > 0.01) {
        t = textureGrad(u_detail_map, Q * P.xy / tile + off + vec2(0.71, 0.29), Q * dPdx.xy / tile, Q * dPdy.xy / tile);
        sl = ((mix(t.ba, t.rg, rock) * 2.0 - 1.0) * 3.0 * w.z) * Q;
        G += vec3(sl.x, sl.y, 0.0);
    }
    return G;
}

void resolve_shading_attributes(inout Material mat){
  vec4 color = texture_sampler_pcfx6(u_biome_color_map, v_uv, biome_texel);
  mat.base_color=color;
${tile_glsl.apply}

  // The detail of the lit ground: the normal only. (the derivatives are taken here, outside the branch: they are not defined inside one)
  vec3 dPdx = dFdx(mat.position_world);
  vec3 dPdy = dFdy(mat.position_world);
  float sea_mask = smoothstep(u_detail.w + 0.002, u_detail.w + 0.03, v_altitude);

  // THE GROUND MATERIALS: the two kinds of ground that weigh most here (the splat: rock, grass, dirt, snow), a material of each by the climate (gm_pick), the colour the biome's on the material's light and shade
  // (and the material's own hue by u_ground.z), roughness, a normal that leans the light, all faded into the biome's colour over distance. A cliff reads the rock from three sides.
  float g_fade = 0.0, g_rough = 0.8;
  vec3 Gt = vec3(0.0);
  if (u_ground.x > 0.5) {
    vec4 bio = textureLod(u_biome_map, v_uv, 0.0);                  // temp, humidity, dither, slope
    vec4 sp = textureLod(u_biome_splat_map, v_uv, 0.0);             // R rock, G grass, B dirt, A snow
    vec4 w = vec4(sp.g, sp.b, sp.r, sp.a) + vec4(0.0004, 0.0003, 0.0002, 0.0001);     // grass, dirt, rock, snow (the tie breaker keeps the two largest apart)
    float m1 = max(max(w.x, w.y), max(w.z, w.w));
    vec4 oh1 = vec4(equal(w, vec4(m1)));
    vec4 wr = w * (1.0 - oh1);
    float m2 = max(max(wr.x, wr.y), max(wr.z, wr.w));
    vec4 oh2 = vec4(equal(wr, vec4(m2)));
    int c1 = int(dot(oh1, vec4(0.0, 1.0, 2.0, 3.0)) + 0.5);
    int c2 = int(dot(oh2, vec4(0.0, 1.0, 2.0, 3.0)) + 0.5);
    vec2 gp = mat.position_world.xz;
    float d_patch = dn_noise(gp / 7.0).x * 0.63;
    float geo = clamp(0.5 + dn_noise(gp / 230.0 + vec2(3.1, 8.7)).x * 0.8, 0.0, 1.0);
    float aa = smoothstep(0.3, 0.7, 0.5 + dn_noise(gp / 19.0 + vec2(5.3, 1.9)).x * 0.9);
    vec3 biome_c = mat.base_color.rgb;
    float biome_lum = dot(biome_c, vec3(0.2126, 0.7152, 0.0722));
    vec3 Pw = mat.position_world;
    float dist_g = length(u_camera_position - Pw);
    g_fade = (1.0 - smoothstep(u_ground.w * 0.4, u_ground.w, dist_g)) * (1.0 - tile_cover);
    // a cliff: the planes the rock is read in (the lit normal is flatter than the ground: undo it, as the detail does)
    float lit_to_true_g = 1.0 / (${world_map.normal_slope.toFixed(4)} *(u_world_info.x / u_world_info.w));
    vec3 Ng = normalize(vec3(mat.normal_world.x * lit_to_true_g, max(mat.normal_world.y, 0.05), mat.normal_world.z * lit_to_true_g));
    vec3 pw3 = pow(abs(Ng), vec3(4.0)); pw3 /= pw3.x + pw3.y + pw3.z;
    vec3 col = vec3(0.0), avg = vec3(0.0), Gsum = vec3(0.0);
    float rough = 0.0, wsum = 0.0;
    for (int k = 0; k < 2; k++) {
      int cls = k == 0 ? c1 : c2;
      float wk = k == 0 ? m1 : m2;
      if (k == 1 && wk < 0.05) break;
      int id = gm_pick(cls, bio.x, bio.y, biome_lum, d_patch, geo);
      vec3 alb; float r, h; vec2 s;
      gm_layer(id, gp, dPdx.xz, dPdy.xz, aa, alb, r, h, s);
      vec3 Gk = vec3(s.x, 0.0, s.y);
      if (cls == 2 && pw3.y < 0.98) {                                // rock on a steep face: read from the sides too
        float used = pw3.y;
        alb *= pw3.y; r *= pw3.y; h *= pw3.y; Gk *= pw3.y;
        vec3 a2; float r2, h2; vec2 s2;
        if (pw3.x > 0.01) { gm_layer(id, Pw.zy, dPdx.zy, dPdy.zy, aa, a2, r2, h2, s2); alb += a2 * pw3.x; r += r2 * pw3.x; h += h2 * pw3.x; Gk += vec3(0.0, s2.y, s2.x) * pw3.x; used += pw3.x; }
        if (pw3.z > 0.01) { gm_layer(id, Pw.xy, dPdx.xy, dPdy.xy, aa, a2, r2, h2, s2); alb += a2 * pw3.z; r += r2 * pw3.z; h += h2 * pw3.z; Gk += vec3(s2.x, s2.y, 0.0) * pw3.z; used += pw3.z; }
        alb /= used; r /= used; h /= used; Gk /= used;
      }
      // the material's height decides who wins where two kinds meet: a kind weighs its share times 0.3 + its height
      float a_k = wk * (0.3 + h);
      col += alb * a_k; avg += u_gmavg[id].rgb * a_k; rough += r * a_k; Gsum += Gk * a_k; wsum += a_k;
    }
    col /= max(wsum, 1e-4); avg /= max(wsum, 1e-4); rough /= max(wsum, 1e-4); Gsum /= max(wsum, 1e-4);
    vec3 own = col * (biome_lum / max(dot(avg, vec3(0.2126, 0.7152, 0.0722)), 0.02));          // the material at the biome's brightness
    vec3 shaded = mix(biome_c * (col / max(avg, vec3(0.02))), own, u_ground.z);                // the biome's colour on the material's light and shade, and the material's own
    mat.base_color.rgb = mix(biome_c, shaded, g_fade);
    g_rough = rough;
    Gt = Gsum * g_fade;
  }

  // THE ROADS: where the field says asphalt, kerb or sidewalk the ground's colour, roughness and normal are the road's (the ground materials of the pack), with the tracks of the wheels, the markings and the kerb's step.
  float r_cover = 0.0, r_rough = 0.8;
  vec3 Gr = vec3(0.0);
  if (u_road.x > 0.5 && u_ground.x > 0.5) {
    vec4 R, Q; vec2 gd;
    road_at(mat.position_world.xz, R, Q, gd);
    float wd = clamp(fwidth(R.x), 0.012, 0.4);                       // (the pixel in metres, for the edges: taken outside the branches)
    float wl = clamp(fwidth(Q.x), 0.012, 0.3);
    vec2 rp = mat.position_world.xz;
    float walk = R.y, cls = R.z, junc = R.w, hw = Q.z;
    float ragged = step(2.5, cls) * dn_noise(rp * 0.8).x * 0.5;       // dirt and gravel have a ragged edge, a street a clean one
    float dd = R.x + ragged;
    float on_a = 1.0 - smoothstep(-wd, wd, dd);
    float on_w = (1.0 - on_a) * (1.0 - smoothstep(walk - wd, walk + wd, dd)) * step(0.05, walk);
    float kerb = smoothstep(-wd, wd, dd) * (1.0 - smoothstep(0.14 - wd, 0.14 + wd, dd)) * step(0.05, walk);
    r_cover = max(on_a, on_w);
    if (r_cover > 0.0) {
      float aa2 = smoothstep(0.3, 0.7, 0.5 + dn_noise(rp / 19.0 + vec2(5.3, 1.9)).x * 0.9);
      float dist_r = length(u_camera_position - mat.position_world);
      float det = 1.0 - smoothstep(u_ground.w * 0.4, u_ground.w, dist_r);                // (the material's detail goes into its average colour with distance)
      float idf = u_roadm.x;
      idf = mix(idf, u_roadm.y, step(1.5, cls));
      idf = mix(idf, u_roadm.w, step(2.5, cls));
      idf = mix(idf, u_roadm2.x, step(3.5, cls));
      int id_r = int(idf + 0.5);
      int id_s = int(u_roadm.y + 0.5);
      vec3 col = vec3(0.0), Gs = vec3(0.0);
      float rough = 0.8;
      if (on_a > 0.0) {                                                                   // the carriageway
        vec3 alb; float r, h; vec2 s;
        gm_layer(id_r, rp, dPdx.xz, dPdy.xz, aa2, alb, r, h, s);
        vec3 tint = mix(vec3(0.5, 0.52, 0.56), vec3(0.95), step(1.5, cls));              // (asphalt is darker than the cracked ground it is made from; cobbles, dirt and gravel as they are)
        vec3 own = mix(u_gmavg[id_r].rgb, alb, det) * tint;
        float lane = step(3.0, hw) * (1.0 - junc);
        float track = lane * exp(-pow((abs(abs(Q.x) - hw * 0.5)) / 0.65, 2.0)) * (1.0 - step(1.5, cls) * 0.5);
        own *= 1.0 - 0.2 * track;
        rough = clamp(r - 0.14 * track * (1.0 - step(1.5, cls)), 0.1, 1.0);
        // the paint: a dashed centre line on a street, a whole one and the two edge lines on an arterial; not on a junction, a cobbled road or a track
        float paint_on = (1.0 - step(1.5, cls)) * (1.0 - junc);
        float centre = (1.0 - smoothstep(0.07 - wl, 0.07 + wl, abs(Q.x)));
        float dashed = step(fract(Q.y / 9.0), 0.45);
        float centre_line = centre * mix(dashed, 1.0, step(0.5, cls));
        float edge_line = step(0.5, cls) * (1.0 - smoothstep(0.07 - wl, 0.07 + wl, abs(abs(Q.x) - (hw - 0.4))));
        float paint = max(centre_line, edge_line) * paint_on * smoothstep(0.3, 1.6, Q.w) * step(4.5, hw * 2.0 + 0.5) * (0.65 + 0.35 * (0.5 + dn_noise(rp * 3.0).x));
        own = mix(own, vec3(0.55, 0.55, 0.52), paint);
        rough = mix(rough, 0.6, paint);
        col = own; Gs = vec3(s.x, 0.0, s.y) * (1.0 - 0.5 * paint);
      }
      if (on_w > 0.0 || kerb > 0.0) {                                                     // the sidewalk and the kerb's top
        vec3 alb; float r, h; vec2 s;
        gm_layer(id_s, rp, dPdx.xz, dPdy.xz, aa2, alb, r, h, s);
        vec3 own = mix(u_gmavg[id_s].rgb, alb, det) * 1.05;
        own = mix(own, vec3(0.45, 0.44, 0.42), kerb * 0.6);
        float wsum = on_a + on_w;
        col = mix(col, own, on_w / max(wsum, 1e-3));
        rough = mix(rough, r, on_w / max(wsum, 1e-3));
        Gs = mix(Gs, vec3(s.x, 0.0, s.y), on_w / max(wsum, 1e-3));
      }
      // the kerb is a step of 12 cm up toward the sidewalk: the normal leans away from it, along the way the distance grows
      float bell = smoothstep(-0.06, 0.0, dd) * (1.0 - smoothstep(0.0, 0.1, dd)) * step(0.05, walk);
      Gs += vec3(gd.x, 0.0, gd.y) * 1.3 * bell;
      mat.base_color.rgb = mix(mat.base_color.rgb, col, r_cover);
      r_rough = rough;
      Gr = Gs;
    }
  }

  if (u_detail.x > 0.0 && sea_mask > 0.0) {
    vec3 N = mat.normal_world;
    vec2 pw = mat.position_world.xz;
    vec4 splat = textureLod(u_biome_splat_map, v_uv, 0.0);          // R rock, G grass, B dirt, A snow
    // the true slope of the ground (rise / run): the lit normal leans normal_slope x (metres a texel) times as much as the ground does
    float lit_to_true = 1.0 / (${world_map.normal_slope.toFixed(4)} * (u_world_info.x / u_world_info.w));
    float true_slope = length(N.xz) / max(N.y, 0.05) * lit_to_true;
    // the metres a pixel covers (for the noise's octaves; the map has its mipmaps): the distance x the angle of a pixel, longer on ground seen at a grazing angle. From the distance and the smooth
    // normal, NOT from the screen derivatives of the position: those are of one triangle, so they jump at every edge of the mesh and the octaves faded in and out along the grid
    vec3 to_cam = u_camera_position - mat.position_world;
    float dist = length(to_cam);
    vec3 N_true = normalize(vec3(N.x * lit_to_true, max(N.y, 0.05), N.z * lit_to_true));
    float footprint = dist * u_detail2.x / max(abs(dot(to_cam / max(dist, 0.001), N_true)), 0.12);
    float steep = smoothstep(0.25, 0.8, true_slope);
    float crag_w = max(steep, splat.x * smoothstep(0.05, 0.3, true_slope)) * (1.0 - 0.8 * splat.w);      // (gentle rock is rolling, only steep ground and steep rock is crags)
    // patches: over a few hundred metres the strength changes (0.5 .. 1.35), so that no two places look alike
    float patch_n = dn_noise(pw / 310.0 + vec2(7.7, 2.3)).x;
    float amp = u_detail.x * mix(0.22, 0.2, crag_w) * mix(0.5, 1.35, clamp(0.5 + patch_n * 1.1, 0.0, 1.0)) * (1.0 - 0.5 * splat.w) * sea_mask * (1.0 - 0.8 * tile_cover) * (1.0 - 0.9 * r_cover);
    float gain = mix(0.72, 0.85, crag_w) * (1.0 - 0.25 * splat.w);      // (each octave leans the light this much of the one before)

    // the big forms
    vec2 g = detail_slope(pw, footprint, clamp(crag_w * u_detail.z, 0.0, 1.5), gain);
    vec3 G = vec3(g.x, 0.0, g.y);

    // the detail map, three layers: the planes it is read in, by the smooth normal of the ground
    vec3 wts = pow(abs(N_true), vec3(4.0));
    wts /= wts.x + wts.y + wts.z;
    vec3 P = mat.position_world;
    // a cliff's planes use the height of the ground itself (the bicubic of the vertex shader), NOT the interpolated height of the mesh: that is a different surface at every level of detail
    // and between the mesh's own triangles, and the texture moved with it (a break along every chunk)
    if (wts.x + wts.z > 0.01) P.y = ground_height(v_uv) * u_world_info.y;
    const float tile = ${world_map.detail.tile.toFixed(3)};
    vec3 T = detail_layer(P, dPdx, dPdy, wts, tile, 0.61, vec2(0.13, 0.71), crag_w) * 0.7
           + detail_layer(P, dPdx, dPdy, wts, tile * 4.3, -0.93, vec2(0.47, 0.29), crag_w) * 1.0
           + detail_layer(P, dPdx, dPdy, wts, tile * 18.0, 1.9, vec2(0.83, 0.52), crag_w) * 0.8;
    G += T * mix(0.85, 1.0, crag_w);                 // (soil and grass lean the light a little less than rock)

    G *= amp;
    // the normal of the surface with the detail on it (the surface gradient, Mikkelsen): on flat ground this is (-G.x, 1, -G.z), on a cliff the detail still leans the face
    mat.normal_world = normalize(N - (G - N * dot(N, G)));
  }

  super_resolve_shading_attributes(mat);
  if (g_fade > 0.0 || r_cover > 0.0) {                                               // (the base material sets the roughness and the view: the ground's own after it, the road's over that)
    mat.roughness = clamp(mix(mat.roughness, g_rough, g_fade), 0.05, 1.0);
    mat.roughness = clamp(mix(mat.roughness, r_rough, r_cover), 0.05, 1.0);
    mat.linear_roughness = mat.roughness * mat.roughness;
    Gt = mix(Gt, Gr, r_cover);
    mat.normal_world = normalize(mat.normal_world - (Gt - mat.normal_world * dot(mat.normal_world, Gt)));
    mat.NdotV = abs(dot(mat.normal_world, mat.view_world)) + FLT_EPS;
  }
}

void fragment(void) {
  super_fragment();
}


`
      }),
      shadow_mat: engine.materials.create({
        state: { cullFace: GL_FRONT },
        shader: shadow_shader
      }),
      // the same placement drawn as lines in the colour pass, to see the cells (world_map.debug_shadow_mesh in on_frame)
      shadow_debug_mat: engine.materials.create({
        wireframe: true,
        shader: shadow_shader
      }),
      shadow_mat2: engine.materials.create({
        state: { cullFace: GL_FRONT },
        uniforms: {
          u_baryframe_opacity: 0.05,
          u_baryframe_width: 0.5,
        },
        shader: `
attribute vec3 a_chunk_data;
${common_shdr}
void vertex(void) {
     v_position_world.xz = (a_position.xz * a_chunk_data.z) + a_chunk_data.xy;

    vec2 uv = (v_position_world.xz/ u_world_info.x) + 0.5;

    v_altitude = get_barycentric_height(uv);

  
    vec3 abs_world_pos = vec3(v_position_world.x, v_altitude * u_world_info.y , v_position_world.z);
    abs_world_pos.y += (a_position.y) * a_chunk_data.z * 0.25;
    v_position_world = abs_world_pos;
    gl_Position = u_view_projection_matrix * vec4(v_position_world, 1.0);
    v_uv =uv;

}
`
      })

    };


    world_map.mesh.chunks_attr = engine.geometry_set_attr({
      buffer_type: GL_DYNAMIC_DRAW, item_size: 3, divisor: 1,
    }, new Float32Array(3));
    world_map.mesh.geo.attr.a_chunk_data = world_map.mesh.chunks_attr.uuid;

    world_map.cid = engine.create_data_response(function (data) {
      engine.geometry_set_attr(world_map.mesh.chunks_attr, data);
      world_map.mesh.instances = world_map.mesh.chunks_attr.data_length / 3;

      PR.chk = world_map.mesh.instances;
      world_map.request_chunks = true;
    });

    world_map.request_chunks = true;





    // the places the worker names (a peak, a lake, a plain ...) once the terrain is there: a game may look in world_map.places
    engine.game_places = function (res) { world_map.places = res.places; };

    scene.use_deffered_rendering({ ENABLE_ATMOSPHERE: world.atmosphere, ENABLE_SHADOWS: world.shadows });

    // the terrain is there (the worker made the heights): the maps are made, the vegetation starts, the passes draw the ground and the creatures, and the game begins
    engine.game_begin = function (res) {
      if (!env.detail_made) { engine.update_texture_source(world_map.detail_map, make_detail_map(512)); env.detail_made = true; }                // (once: a rebuild does not bake it again)
      let data = new Float32Array(res.data);
      const heights = new Float32Array(data);                                                                           // (a copy: the worker gets the buffer; the game reads the ground's height from it)
      engine.update_texture_source(world_map, data);

      engine._push_render_target(world_map.biome_map, true);
      engine._render_texture(world_map, 0, 0, 1, 1, world_map.biome_map.mat);
      engine._pop_render_target();

      scene.has_heightmap = true;
      scene.world_height = world_map.world_height;
      if (world.vegetation && opts.land && !env.land_started) { env.land_started = true; opts.land(scene); }                                                                 // (trees and plants only when the world asks, and the page gave `land`)
      engine.call_worker("game_make_places", {});

      if (!env.hooked) {
      env.hooked = true;                                                                                                   // (the two passes are hooked once: a rebuild replaces the maps, not the hooks)
      scene.on_shadow_pass.add(function () {
        engine.render_item(world_map.mesh.shadow_geo, world_map.mesh.shadow_mat, 0, 0, shadow_instances);
        for (let i = 0; i < env.draw_shadow.length; i++) env.draw_shadow[i]();                                         // (what the host draws in the shadow pass: its creatures)
      });

      // GPU PARTICLES (the weapons' flashes, trails and bursts, the game's explosions): they collide with the heights this ground is drawn from, are soft where they meet it and what stands on it
      if (engine.gpu_particles) {
        if (scene.dfd) engine.gpu_particles.attach(scene.dfd);
        engine.gpu_particles.set_ground({ height: world_map, get size() { return world_map.world_size; }, get scale() { return world_map.world_height; }, origin: [0, 0], filter: "bicubic" });
      }
      scene.on_render_pass.add(function () {
        engine.tra_model.set_terrain_position(camera.node, world.camera.min_height);                                    // (the camera stays this far over the ground, the game's: it looks at a point in the air)
        world_map.detail_u[0] = world_map.detail.strength; world_map.detail_u[1] = world_map.detail.wavelength; world_map.detail_u[2] = world_map.detail.crags;
        world_map.detail_u2[0] = 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, engine.render_height);
        { const gc = world_map.ground, gu = world_map.ground_u; gu[0][1] = gc.quality; gu[0][2] = gc.hue; gu[0][3] = gc.fade; gu[2][0] = gc.normal; gu[2][1] = gc.ao; }
        // the window of the shadow caster: centred on the camera, its corner on a multiple of a cell
        u_shadow_grid[2] = Math.round(camera.control.world_position[0] / shadow_cell) * shadow_cell - shadow_grid * shadow_cell * 0.5;
        u_shadow_grid[3] = Math.round(camera.control.world_position[2] / shadow_cell) * shadow_cell - shadow_grid * shadow_cell * 0.5;

        if (world_map.request_chunks) {
          world_map.request_chunks = false;
          engine.game_get_chunks(world_map.cid, camera, camera.world_position[0], camera.world_position[2], 0, 0, world_map.world_size, world_map.world_size * world_map.ocean_scale, world_map.world_height, world_map.max_lod + Math.round(Math.log2(world_map.ocean_scale)), world_map.threshold);
        }
        engine.render_item(world_map.mesh.geo, world_map.mesh.mat, 0, 0, world_map.mesh.instances);
        for (let i = 0; i < env.draw_color.length; i++) env.draw_color[i]();                                           // (what the host draws in the colour pass: its creatures)
        if (engine.gpu_particles) engine.gpu_particles.render();                                                        // (the particles that are not soft: the attached deferred pass draws the soft ones)
      });
      }
      env.heights = heights; env.heights0 = heights; env.graded = false; env.ground = make_ground(heights); env.started = true;
      if (env.on_begin) env.on_begin(env);
    };

    // env.set_heights(heights, { graded }) -> Promise<env>: the ground is a map of the page's (the roads grade it: system/grade.js, apply(env.heights0 ...)). The worker takes it over the generator's map and makes the collision again, then the texture, the
    // biome pass, env.heights and env.ground are the new ones. env.heights0 is the generator's own map, whatever has been set (a page grades from it, so that grading twice is grading once). env.reset_heights() puts it back.
    let map_id = 0;
    const map_waits = {};
    engine.game_map_set = function (res) {
      const p = map_waits[res.id]; delete map_waits[res.id];
      if (!p) return;
      if (res.error) { p.reject(new Error(res.error)); return; }
      engine.update_texture_source(world_map, new Float32Array(p.heights));
      engine._push_render_target(world_map.biome_map, true);
      engine._render_texture(world_map, 0, 0, 1, 1, world_map.biome_map.mat);
      engine._pop_render_target();
      env.heights = p.heights; env.graded = p.graded; env.ground = make_ground(p.heights);
      p.resolve(env);
    };
    env.set_heights = function (heights, o) {
      return new Promise(function (resolve, reject) {
        if (!env.started) { reject(new Error("environment: set_heights needs the ground (env.ready)")); return; }
        if (!heights || heights.length !== world_map.width * world_map.width) { reject(new Error("environment: set_heights takes " + world_map.width * world_map.width + " heights (the map's " + world_map.width + " x " + world_map.width + ")")); return; }
        const id = ++map_id, graded = !!(o && o.graded), own = new Float32Array(heights);
        map_waits[id] = { resolve: resolve, reject: reject, heights: own, graded: graded };
        engine.call_worker("game_set_map", { id: id, data: new Float32Array(own).buffer, graded: graded });
      });
    };
    // env.set_decks(rows) -> Promise<number of boxes made>: the collision of the bridges ([cx, cy, cz, hx, hy, hz, yaw, rise] rows, system/bridge.js build().rows; [] takes them away)
    const deck_waits = {};
    engine.game_decks_set = function (res) { const p = deck_waits[res.id]; delete deck_waits[res.id]; if (p) p(res.boxes); };
    env.set_decks = function (rows) {
      return new Promise(function (resolve) {
        const flat = [].concat.apply([], rows || []), id = ++map_id;
        if (flat.length % 8) throw new Error("environment: a deck is 8 numbers: cx, cy, cz, hx, hy, hz, yaw, rise");
        deck_waits[id] = resolve;
        engine.call_worker("game_decks", { id: id, rows: flat });
      });
    };
    env.reset_heights = function () { return env.graded ? env.set_heights(env.heights0, { graded: false }) : Promise.resolve(env); };

        // what the worker is given: the whole world in one message (it makes the heights, the collision, the rivers and the places again, and answers with the map)
        function build_world() {
          return {
            size: world_map.width, seed: world_map.terrain_seed, camera: scene.camera.uuid, params: world_map.params, curve: world_map.curve,
            world_size: world_map.world_size,
            world_height: world_map.world_height,
            collision: world_map.collision,
            places: world_map.place_params,
            walls: null,
            rivers: river_rows(world.terrain.rivers, world_map.world_height)
          };
        }
        // env.apply(world) -> Promise<env>: a world that has changed is built again, all of it (a change of size recalculates everything). What is live: the size, the terrain (preset, seed, numbers, curve, height_scale, rivers), the sun,
        // the ambient light and the camera's lens. What is made once with the page and is not changed by it: `normal_slope` (it is in the shaders), `atmosphere`, `shadows` (the passes), `vegetation` once started:
        // they are answered in `env.ignored`. The answer is a promise of the new ground (env.ground, env.heights) once the worker has made it and the page has drawn its maps.
        env.apply = function (doc) {
          const nw = world_check(doc), old = world;
          env.ignored = [];
          if (nw.terrain.normal_slope !== old.terrain.normal_slope) env.ignored.push("terrain.normal_slope");
          if (nw.atmosphere !== old.atmosphere) env.ignored.push("atmosphere");
          if (nw.shadows !== old.shadows) env.ignored.push("shadows");
          nw.terrain.normal_slope = old.terrain.normal_slope; nw.atmosphere = old.atmosphere; nw.shadows = old.shadows;
          world = nw; env.world = nw;
          set_terrain(nw);
          calculate_world_size(nw.size);
          shadow_cell = world_map.world_size / Math.pow(2, world_map.max_lod);
          u_shadow_grid[1] = shadow_cell; u_world_info[0] = world_map.world_size; u_world_info[1] = world_map.world_height;
          if (nw.sun) { const e = sun_euler(nw.sun); engine.tra_model.set_eular(scene.dlight0, e[0], e[1], e[2]); }
          scene.alight0.color[0] = nw.ambient; scene.alight0.color[1] = nw.ambient; scene.alight0.color[2] = nw.ambient;
          world_map.request_chunks = true;
          env.started = false;
          env.ready = new Promise(function (resolve) { env.on_begin = resolve; });
          engine.call_worker("game_init", build_world());
          return env.ready;
        };
        // the numbers a preset makes (the table's defaults under the preset's own) and its curve: what a panel shows as the value of a number that the world does not set
        // env.preview_ground(doc) -> Promise<{ ground, heights, restored }>: the ground a world document WOULD have, made by the worker's generator at the live map's size (so it is the ground the world will have, texel for texel) and given back as numbers.
        // Nothing of the live world is touched: no map, no texture, no collision, no WebGL; the wizard draws it in a 2D canvas. restored: the worker made the live map again after it and it came out as it was.
        let preview_id = 0;
        const previews = {};
        engine.game_preview_done = function (res) {
          const p = previews[res.id];
          delete previews[res.id];
          if (!p) return;
          if (res.error || !res.data) { p.reject(new Error(res.error || "the worker made no map")); return; }
          const heights = new Float32Array(res.data);
          p.resolve({ ground: make_ground(heights, { N: p.N, W: p.size, Hh: p.Hh }), heights: heights, restored: res.restored_ok });
        };
        env.preview_ground = function (doc) {
          return new Promise(function (resolve, reject) {
            const w = world_check(doc), t = terrain_inputs(w), Hh = world_height_of(t.params, t.height_scale), N = world_map.width, id = ++preview_id;
            previews[id] = { resolve: resolve, reject: reject, N: N, size: w.size, Hh: Hh };
            engine.call_worker("game_preview", { id: id, size: N, seed: t.seed, world_size: w.size, params: t.params, curve: t.curve, rivers: river_rows(w.terrain.rivers, Hh) });
          });
        };
        env.preset_info = function (name) {
          const p = world_presets[name];
          if (!p) return null;
          const chosen = Object.assign({}, p), curve = chosen.curve || base_curve;
          delete chosen.curve;
          return { params: Object.assign({}, base_params, chosen), curve: curve.map(function (q) { return [q[0], q[1]]; }) };
        };
        // the sky and the lens, live: no new ground (the sun, the ambient light, the camera's fov, near and far)
        env.set_sky = function (doc) {
          const nw = world_check(doc);
          world.sun = nw.sun; world.ambient = nw.ambient; world.camera = nw.camera; env.world = world;
          if (nw.sun) { const e = sun_euler(nw.sun); engine.tra_model.set_eular(scene.dlight0, e[0], e[1], e[2]); }
          scene.alight0.color[0] = nw.ambient; scene.alight0.color[1] = nw.ambient; scene.alight0.color[2] = nw.ambient;
          calculate_world_size(world_map.world_size);
        };
        // what the worker says of the ground it made: the collision's cost (shapes against the budget), the map's size
        engine.game_stats = function (m) { env.stats = m; if (env.on_stats) env.on_stats(m); };
        env.stats = null; env.on_stats = null;
        env.scene = scene; env.camera = camera; env.world_map = world_map; env.world = world; env.presets = world_presets; env.ignored = [];
        env.ready = new Promise(function (resolve) { env.on_begin = resolve; });
        engine.call_worker("game_init", build_world());
        return env;
      }
      return { create: create, world_check: world_check, terrain_params: TERRAIN_PARAMS, terrain_groups: TERRAIN_GROUPS };
    })();
  })
})
