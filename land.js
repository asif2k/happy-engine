packing()("land", function () {

  consts$({ CMD_LAND_FRAME: 25360 })
  block$(function worker_process() {

    engine.land_init = (function () {
      // Deterministic hash for random rolls
      function hash(x, z, salt) {
        var h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
        h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
      }

      // Smooth 2D value noise for natural groves and patches
      function smooth_noise(x, z, salt) {
        var ix = Math.floor(x), iz = Math.floor(z);
        var fx = x - ix, fz = z - iz;
        var u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
        var v = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
        var a = hash(ix, iz, salt);
        var b = hash(ix + 1, iz, salt);
        var c = hash(ix, iz + 1, salt);
        var d = hash(ix + 1, iz + 1, salt);
        return a + u * (b - a) + v * (c - a) + u * v * (a - b - c + d);
      };
      const rules = import("@/vegi/vegetation_rules.json");
      console.log("rules", rules);

      function generate_vegetation(world_size, world_height, phy_ground_height, biomemap, biomemap_size) {
        var sea_level_frac = 0.1801;
        var sea_level_m = sea_level_frac * world_height;

        var species_list = [];
        var species_idx = 0;

        var parse_category = function (category, is_tree) {
          for (var name in category) {
            if (category.hasOwnProperty(name)) {
              var sp = category[name];
              if (sp.enabled === false) continue; // Left out (the crops and garden plants)[cite: 1]

              var r = hash(species_idx, 0, 100);
              var g = hash(species_idx, 0, 200);
              var b = hash(species_idx, 0, 300);

              species_list.push({
                id: species_idx++,
                name: name,
                is_tree: is_tree,
                t_lo: sp.temperature ? sp.temperature[0] : 0.0,
                t_hi: sp.temperature ? sp.temperature[1] : 1.0,
                h_lo: sp.humidity ? sp.humidity[0] : 0.0,
                h_hi: sp.humidity ? sp.humidity[1] : 1.0,
                a_lo: sp.altitude ? sp.altitude[0] : 0.0,
                a_hi: sp.altitude ? sp.altitude[1] : 0.5,
                slope_max: sp.slope || 0.8,
                weight: sp.weight || 1.0,
                scale_lo: sp.scale ? sp.scale[0] : (is_tree ? 0.85 : 0.7),
                scale_hi: sp.scale ? sp.scale[1] : (is_tree ? 1.2 : 1.3),
                stand: sp.stand || 0,
                clearance: is_tree ? 4.0 : 1.0,
                driver: sp.driver || (is_tree ? "canopy" : "grass"),
                debug_color: [r, g, b]
              });
            }
          }
        };

        if (rules.trees) parse_category(rules.trees, true);
        if (rules.plants) parse_category(rules.plants, false);

        var max_instances = 200000;
        var out_buffer = new Float32Array(max_instances * 6);
        var out_idx = 0;

        function scatter() {
          var hash_cell_m = 10.0;
          var hash_grid_dim = Math.ceil(world_size / hash_cell_m);
          var grid_head = new Int32Array(hash_grid_dim * hash_grid_dim).fill(-1);
          var grid_next = new Int32Array(max_instances);

          var dart_cell_m = 8.0;
          var dart_grid_dim = Math.floor(world_size / dart_cell_m);

          // Scale settings for procedural noise mapping fallback
          var biome_scale = 600.0;
          var density_scale = 150.0;

          var texel_m = biomemap ? (world_size / biomemap_size) : 0;

          for (var gx = 0; gx < dart_grid_dim; gx++) {
            for (var gz = 0; gz < dart_grid_dim; gz++) {
              if (out_idx >= out_buffer.length) break;

              var wx = (gx + hash(gx, gz, 1) * 1.5 - 0.25) * dart_cell_m - world_size * 0.5;
              var wz = (gz + hash(gx, gz, 2) * 1.5 - 0.25) * dart_cell_m - world_size * 0.5;

              // Direct Height Query
              var world_y = phy_ground_height(wx, wz);
              if (world_y <= sea_level_m) continue;

              // World-Space Finite Difference for Slope
              var hy_xm = phy_ground_height(wx - 1.0, wz);
              var hy_xp = phy_ground_height(wx + 1.0, wz);
              var hy_zm = phy_ground_height(wx, wz - 1.0);
              var hy_zp = phy_ground_height(wx, wz + 1.0);

              var dx = (hy_xp - hy_xm) * 0.5;
              var dz = (hy_zp - hy_zm) * 0.5;
              var slope = Math.sqrt(dx * dx + dz * dz);

              var altitude_frac = (world_y - sea_level_m) / (world_height - sea_level_m);

              // Biome Data: Extract from map if supplied, otherwise generate procedurally
              var temp, hum, r_val, g_val, b_val;

              if (biomemap && biomemap_size) {
                var tx = Math.min(biomemap_size - 1, Math.max(0, Math.floor((wx + world_size * 0.5) / texel_m)));
                var tz = Math.min(biomemap_size - 1, Math.max(0, Math.floor((wz + world_size * 0.5) / texel_m)));
                var map_idx = tz * biomemap_size + tx;

                // Trees drawn from RED, understory from GREEN, grass/plants from BLUE[cite: 1]
                r_val = biomemap[map_idx * 4 + 0] / 255.0;
                g_val = biomemap[map_idx * 4 + 1] / 255.0;
                b_val = biomemap[map_idx * 4 + 2] / 255.0;
                var a_val = biomemap[map_idx * 4 + 3]; // 4 + 4 bits of the vegetation map's alpha[cite: 1]

                temp = Math.floor(a_val / 16) / 15.0;
                hum = (a_val % 16) / 15.0;
              } else {
                var raw_temp = smooth_noise(wx / biome_scale, wz / biome_scale, 137);
                temp = Math.max(0.0, raw_temp - (0.7 * altitude_frac)); // Temperature already falls with the height[cite: 1]
                hum = smooth_noise(wx / biome_scale, wz / biome_scale, 942);

                r_val = smooth_noise(wx / density_scale, wz / density_scale, 42);
                g_val = smooth_noise(wx / density_scale, wz / density_scale, 43);
                b_val = smooth_noise(wx / (density_scale * 0.5), wz / (density_scale * 0.5), 44);
              }

              var best_sp = null;
              var best_score = -1;

              for (var si = 0; si < species_list.length; si++) {
                var sp = species_list[si];

                if (temp < sp.t_lo || temp > sp.t_hi) continue;
                if (hum < sp.h_lo || hum > sp.h_hi) continue;
                if (altitude_frac < sp.a_lo || altitude_frac > sp.a_hi) continue; // Fits within altitude limits[cite: 1]
                if (slope > sp.slope_max) continue; // Fits within slope limit (rise over run)[cite: 1]

                var prob = 0;
                if (sp.is_tree) prob = r_val;
                else if (sp.driver === "bush") prob = g_val;
                else if (sp.driver === "tree") prob = r_val;
                else prob = b_val;

                if (prob <= 0.05) continue;

                var score = prob * sp.weight * hash(gx, gz, sp.id + 10);

                if (sp.stand > 0) {
                  var stand_noise = smooth_noise(wx / sp.stand, wz / sp.stand, sp.id); // Generates natural groves using stand size[cite: 1]
                  if (stand_noise < 0.4) score = 0;
                  else score *= stand_noise;
                }

                if (score > best_score) {
                  best_score = score;
                  best_sp = sp;
                }
              }

              if (best_sp && best_score > 0.2) {
                var scale = best_sp.scale_lo + (best_sp.scale_hi - best_sp.scale_lo) * hash(gx, gz, 4);
                var my_radius = best_sp.clearance * scale;
                var clear = true;

                var cx = Math.floor((wx + world_size * 0.5) / hash_cell_m);
                var cz = Math.floor((wz + world_size * 0.5) / hash_cell_m);

                for (var nx = Math.max(0, cx - 1); nx <= Math.min(hash_grid_dim - 1, cx + 1); nx++) {
                  for (var nz = Math.max(0, cz - 1); nz <= Math.min(hash_grid_dim - 1, cz + 1); nz++) {
                    var cell_idx = nz * hash_grid_dim + nx;
                    var other_id = grid_head[cell_idx];

                    while (other_id !== -1) {
                      var ox = out_buffer[other_id * 6];
                      var oz = out_buffer[other_id * 6 + 2];
                      var o_sp = species_list[out_buffer[other_id * 6 + 5]];
                      var o_scale = out_buffer[other_id * 6 + 4];

                      var dist_sq = (ox - wx) * (ox - wx) + (oz - wz) * (oz - wz);
                      var min_dist = my_radius + (o_sp.clearance * o_scale);

                      if (dist_sq < min_dist * min_dist) {
                        clear = false;
                        break;
                      }
                      other_id = grid_next[other_id];
                    }
                    if (!clear) break;
                  }
                  if (!clear) break;
                }

                if (clear) {
                  var inst_id = out_idx / 6;
                  out_buffer[out_idx++] = wx;
                  out_buffer[out_idx++] = world_y;
                  out_buffer[out_idx++] = wz;
                  out_buffer[out_idx++] = hash(gx, gz, 3) * Math.PI * 2.0;
                  out_buffer[out_idx++] = scale;
                  out_buffer[out_idx++] = best_sp.id;

                  var my_cell = cz * hash_grid_dim + cx;
                  grid_next[inst_id] = grid_head[my_cell];
                  grid_head[my_cell] = inst_id;
                }
              }
            }
          }

          var chunk_size_m = 256.0;
          var chunk_grid_dim = Math.ceil(world_size / chunk_size_m);
          var chunks = [];

          for (var ci = 0; ci < chunk_grid_dim * chunk_grid_dim; ci++) {
            var chk_cx = (ci % chunk_grid_dim) * chunk_size_m - world_size * 0.5 + chunk_size_m * 0.5;
            var chk_cz = Math.floor(ci / chunk_grid_dim) * chunk_size_m - world_size * 0.5 + chunk_size_m * 0.5;
            chunks[ci] = {
              id: ci,
              center: [chk_cx, 0, chk_cz],
              radius: chunk_size_m * 0.7071,
              instances: [],
              start_index: 0,
              count: 0
            };
          }

          for (var j = 0; j < out_idx; j += 6) {
            var px = out_buffer[j];
            var py = out_buffer[j + 1];
            var pz = out_buffer[j + 2];

            var col = Math.floor((px + world_size * 0.5) / chunk_size_m);
            var row = Math.floor((pz + world_size * 0.5) / chunk_size_m);

            var c_idx = Math.max(0, Math.min(chunk_grid_dim - 1, row)) * chunk_grid_dim + Math.max(0, Math.min(chunk_grid_dim - 1, col));
            var chunk = chunks[c_idx];

            chunk.instances.push(px, py, pz, out_buffer[j + 3], out_buffer[j + 4], out_buffer[j + 5]);
            if (py > chunk.center[1]) chunk.center[1] = py;
          }

          var sorted_buffer = new Float32Array(out_idx);
          var current_offset = 0;
          var active_chunks = [];

          for (var c = 0; c < chunks.length; c++) {
            var chk = chunks[c];
            if (chk.instances.length === 0) continue;

            chk.count = chk.instances.length / 6;
            chk.start_index = current_offset / 6;

            for (var p = 0; p < chk.instances.length; p++) {
              sorted_buffer[current_offset++] = chk.instances[p];
            }
            chk.instances = null;
            active_chunks.push(chk);
          }

          return {
            chunks2: chunks,
            chunks: active_chunks,
            instances: Array.prototype.slice.call(sorted_buffer),
            count: out_idx / 6,
            species_map: species_list
          };
        }


        function scatter2() {
          // Zero-Garbage Spatial Hash for Clearance Testing
          var hash_cell_m = 10.0;
          var hash_grid_dim = Math.ceil(world_size / hash_cell_m);
          var grid_head = new Int32Array(hash_grid_dim * hash_grid_dim);
          for (var i = 0; i < grid_head.length; i++) grid_head[i] = -1;
          var grid_next = new Int32Array(max_instances);

          // 3. Dart Throwing Pass (Iterating over a fine grid)
          var dart_cell_m = 8.0;
          var dart_grid_dim = Math.floor(world_size / dart_cell_m);
          var texel_m = world_size / map_size;

          for (var gx = 0; gx < dart_grid_dim; gx++) {
            for (var gz = 0; gz < dart_grid_dim; gz++) {
              if (out_idx >= out_buffer.length) break;

              // Throw a dart with heavy jitter
              var wx = (gx + hash(gx, gz, 1) * 1.5 - 0.25) * dart_cell_m - world_size * 0.5;
              var wz = (gz + hash(gx, gz, 2) * 1.5 - 0.25) * dart_cell_m - world_size * 0.5;

              var tx = Math.min(map_size - 1, Math.max(0, Math.floor((wx + world_size * 0.5) / texel_m)));
              var tz = Math.min(map_size - 1, Math.max(0, Math.floor((wz + world_size * 0.5) / texel_m)));
              var map_idx = tz * map_size + tx;

              var h_val = heights[map_idx];
              if (h_val <= sea_level) continue;

              // Calculate local slope
              var t_xm = Math.max(0, tx - 1), t_xp = Math.min(map_size - 1, tx + 1);
              var t_zm = Math.max(0, tz - 1), t_zp = Math.min(map_size - 1, tz + 1);
              var dx = (heights[tz * map_size + t_xp] - heights[tz * map_size + t_xm]) * 0.5 * world_height / texel_m;
              var dz = (heights[t_zp * map_size + tx] - heights[t_zm * map_size + tx]) * 0.5 * world_height / texel_m;
              var slope = Math.sqrt(dx * dx + dz * dz);

              var altitude_frac = (h_val - sea_level) / (1.0 - sea_level);

              var r_val = biomemap[map_idx * 4 + 0] / 255.0;
              var g_val = biomemap[map_idx * 4 + 1] / 255.0;
              var b_val = biomemap[map_idx * 4 + 2] / 255.0;
              var a_val = biomemap[map_idx * 4 + 3];

              var temp = Math.floor(a_val / 16) / 15.0;
              var hum = (a_val % 16) / 15.0;

              var best_sp = null;
              var best_score = -1;

              // Score species based on rules and organic noise
              for (var si = 0; si < species_list.length; si++) {
                var sp = species_list[si];

                if (temp < sp.t_lo || temp > sp.t_hi) continue;
                if (hum < sp.h_lo || hum > sp.h_hi) continue;
                if (altitude_frac < sp.a_lo || altitude_frac > sp.a_hi) continue;
                if (slope > sp.slope_max) continue;

                var prob = 0;
                if (sp.is_tree) prob = r_val;
                else if (sp.driver === "bush") prob = g_val;
                else if (sp.driver === "tree") prob = r_val;
                else prob = b_val;

                if (prob <= 0.05) continue;

                var score = prob * sp.weight * hash(gx, gz, sp.id + 10);

                // Simulate Groves: If the species forms stands, mask it with smooth noise[cite: 2]
                if (sp.stand > 0) {
                  var stand_noise = smooth_noise(wx / sp.stand, wz / sp.stand, sp.id);
                  if (stand_noise < 0.4) score = 0; // Reject if outside the grove
                  else score *= stand_noise; // Denser towards the center of the grove
                }

                if (score > best_score) {
                  best_score = score;
                  best_sp = sp;
                }
              }

              // Poisson Clearance Check
              if (best_sp && best_score > 0.2) {
                var scale = best_sp.scale_lo + (best_sp.scale_hi - best_sp.scale_lo) * hash(gx, gz, 4);
                var my_radius = best_sp.clearance * scale;
                var clear = true;

                var cx = Math.floor((wx + world_size * 0.5) / hash_cell_m);
                var cz = Math.floor((wz + world_size * 0.5) / hash_cell_m);

                // Check 3x3 neighborhood in the spatial hash
                for (var nx = Math.max(0, cx - 1); nx <= Math.min(hash_grid_dim - 1, cx + 1); nx++) {
                  for (var nz = Math.max(0, cz - 1); nz <= Math.min(hash_grid_dim - 1, cz + 1); nz++) {
                    var cell_idx = nz * hash_grid_dim + nx;
                    var other_id = grid_head[cell_idx];

                    while (other_id !== -1) {
                      var ox = out_buffer[other_id * 6];
                      var oz = out_buffer[other_id * 6 + 2];
                      var o_sp = species_list[out_buffer[other_id * 6 + 5]];
                      var o_scale = out_buffer[other_id * 6 + 4];

                      var dist_sq = (ox - wx) * (ox - wx) + (oz - wz) * (oz - wz);
                      var min_dist = my_radius + (o_sp.clearance * o_scale);

                      if (dist_sq < min_dist * min_dist) {
                        clear = false;
                        break;
                      }
                      other_id = grid_next[other_id];
                    }
                    if (!clear) break;
                  }
                  if (!clear) break;
                }

                if (clear) {
                  var inst_id = out_idx / 6;
                  out_buffer[out_idx++] = wx;
                  out_buffer[out_idx++] = h_val * world_height;
                  out_buffer[out_idx++] = wz;
                  out_buffer[out_idx++] = hash(gx, gz, 3) * Math.PI * 2.0; // Rotation
                  out_buffer[out_idx++] = scale;
                  out_buffer[out_idx++] = best_sp.id;

                  // Add to spatial hash for future clearance checks
                  var my_cell = cz * hash_grid_dim + cx;
                  grid_next[inst_id] = grid_head[my_cell];
                  grid_head[my_cell] = inst_id;
                }
              }
            }
          }

          // 4. Frustum Culling Chunk Generation
          var chunk_size_m = 128.0;
          var chunk_grid_dim = Math.ceil(world_size / chunk_size_m);
          var chunks = [];

          for (var ci = 0; ci < chunk_grid_dim * chunk_grid_dim; ci++) {
            var chk_cx = (ci % chunk_grid_dim) * chunk_size_m - world_size * 0.5 + chunk_size_m * 0.5;
            var chk_cz = Math.floor(ci / chunk_grid_dim) * chunk_size_m - world_size * 0.5 + chunk_size_m * 0.5;
            chunks[ci] = {
              id: ci,
              center: [chk_cx, 0, chk_cz],
              radius: chunk_size_m * 0.7071,
              instances: [],
              start_index: 0,
              count: 0
            };
          }

          for (var j = 0; j < out_idx; j += 6) {
            var px = out_buffer[j];
            var py = out_buffer[j + 1];
            var pz = out_buffer[j + 2];

            var col = Math.floor((px + world_size * 0.5) / chunk_size_m);
            var row = Math.floor((pz + world_size * 0.5) / chunk_size_m);

            var c_idx = Math.max(0, Math.min(chunk_grid_dim - 1, row)) * chunk_grid_dim + Math.max(0, Math.min(chunk_grid_dim - 1, col));
            var chunk = chunks[c_idx];

            chunk.instances.push(px, py, pz, out_buffer[j + 3], out_buffer[j + 4], out_buffer[j + 5]);
            if (py > chunk.center[1]) chunk.center[1] = py;
          }

          var sorted_buffer = new Float32Array(out_idx);
          var current_offset = 0;
          var active_chunks = [];

          for (var c = 0; c < chunks.length; c++) {
            var chk = chunks[c];
            if (chk.instances.length === 0) continue;

            chk.count = chk.instances.length / 6;
            chk.start_index = current_offset / 6;

            for (var p = 0; p < chk.instances.length; p++) {
              sorted_buffer[current_offset++] = chk.instances[p];
            }

            chk.instances = null;
            active_chunks.push(chk);
          }

          return {
            chunks: active_chunks,
            instances: Array.prototype.slice.call(sorted_buffer),
            count: out_idx / 6,
            species_map: species_list
          };

        }

        return scatter();
      }

      return function (def) {


     
        console.log("land_init", def);
        const res = generate_vegetation(def.world_size, def.world_height, def.has_heightmap ? wa.world_ground_height : function (x, z) {
          return hash(x / def.world_size, z / def.world_size, 4343) * 0.85
        }, def.biome_map, def.biome_map_size);



        const land_active_chunks = wa.fp32_array(res.chunks.length * 4);
        let ci = 0;
        for (let i = 0; i < res.chunks.length; i++) {
          const cha = res.chunks[i];
          land_active_chunks[ci++] = cha.center[0];
          land_active_chunks[ci++] = cha.center[1];
          land_active_chunks[ci++] = cha.center[2];
          land_active_chunks[ci++] = cha.radius;
        }
        wa.land_set_active_chunks(land_active_chunks.byteOffset, land_active_chunks.length);

        

        engine.call_main("land_output", res);

      }

    })();



  });




  const tree_presets = import("@/vegi/tree_trunk_presets.json");
  const plant_presets = import("@/vegi/plant_presets.json");

  import("@/vegi/vegi_textures_lib.js");

  const TREE_PROP_NAMES = [
    "clumpMax", "clumpMin", "lengthFalloffFactor", "lengthFalloffPower",
    "branchFactor", "radiusFalloffRate", "climbRate", "trunkKink", "maxRadius",
    "taperRate", "twistRate", "sweepAmount", "initialBranchLength", "trunkLength",
    "dropAmount", "growAmount", "vMultiplier", "twigScale", "seed",
    "branchFactorTrunk", "clumpMaxTrunk", "clumpMinTrunk",
    "barkColorR", "barkColorG", "barkColorB", "barkColorVariance",
    "fruitChance", "fruitSize", "fruitColorR", "fruitColorG", "fruitColorB",
    "treeSteps", "segments", "levels",
    "rootFlare", "twigAngleJitter", "fruitClusterCount",
    "lengthJitter", "radiusJitter", "azimuthJitter", "elevationJitter",
    "twigCards", "twigNormalBlend",
  ];
  const TREE_WHOLE_NUMBER_NAMES = [
    "treeSteps", "segments", "levels", "fruitClusterCount", "twigCards",
  ];
  const TREE_COLOR_NAMES = ["barkColor", "fruitColor"];



  const PLANT_PROP_NAMES = [
    "bladeLength", "bladeLengthVariance", "bladeWidth", "bladeWidthVariance",
    "tipTaper", "curveAmount", "curveVariance", "lean", "leanVariance",
    "twistVariance", "clusterRadius", "vMultiplier", "seed",
    "bladeColorBaseR", "bladeColorBaseG", "bladeColorBaseB",
    "bladeColorTipR", "bladeColorTipG", "bladeColorTipB", "colorVariance",
    "flowerChance", "flowerSize", "flowerColorR", "flowerColorG", "flowerColorB",
    "bladeCount", "segments", "arrangement",
    "bladeFold", "tuftRadius", "tuftCount",
  ];
  const PLANT_WHOLE_NUMBER_NAMES = ["bladeCount", "segments", "arrangement", "tuftCount"];
  const PLANT_COLOR_NAMES = ["bladeColorBase", "bladeColorTip", "flowerColor"];

  const RICH_PLANT_PROP_NAMES = [
    "stemLength", "stemWidth", "stemLean", "stemCurve",
    "leafLength", "leafLengthVariance", "leafWidth", "leafWidthVariance", "leafTipTaper",
    "leafAttachStart", "leafAttachEnd", "leafOutwardAngle", "leafOutwardVariance",
    "petalLength", "petalWidth", "petalTipTaper", "petalCurl",
    "flowerRadius", "bloomSize", "vMultiplier", "seed",
    "stemColorR", "stemColorG", "stemColorB",
    "leafColorR", "leafColorG", "leafColorB",
    "petalColorR", "petalColorG", "petalColorB", "colorVariance",
    "petalPitch", "petalPitchOuter", "petalRadiusInner",
    "leafCount", "petalCount", "segments", "petalArrangement",
  ];
  const RICH_PLANT_WHOLE_NUMBER_NAMES = ["leafCount", "petalCount", "segments", "petalArrangement"];
  const RICH_PLANT_COLOR_NAMES = ["stemColor", "leafColor", "petalColor"];

  // 8-bit channel -> float, exactly (i / 255 in float64, as tile.js computed per point).
  // The sums are Float64Array, so using a Float64Array here keeps the averages bit-identical.
  const COLOR_LUT = new Float64Array(256);
  for (let i = 0; i < 256; i++) COLOR_LUT[i] = i / 255;

  function make_named_props(wa, opts) {
    console.log("make_named_props", opts);
    const ptr = opts.create();
    const count = opts.count();

    if (count !== opts.prop_names.length) {
      console.warn(opts.label + ": prop name list in demo_global is out of sync with its C++ struct layout");
    }

    const f = wa.fp32_array(count, ptr); // ONE typed array over the whole (now unified) struct

    const props = { ptr, preset_count: opts.preset_count(), needs_update: false };
    const whole_number_names = opts.whole_number_names || [];

    opts.prop_names.forEach(function (name, idx) {
      const whole = whole_number_names.indexOf(name) >= 0;
      Object.defineProperty(props, name, {
        get: function () { return f[idx]; },
        set: function (v) { f[idx] = whole ? Math.round(v) : v; },
        enumerable: true,
      });
    });

    (opts.color_names || []).forEach(function (name) {
      Object.defineProperty(props, name, {
        get: function () { return [props[name + "R"], props[name + "G"], props[name + "B"], 255]; },
        set: function (v) { props[name + "R"] = v[0]; props[name + "G"] = v[1]; props[name + "B"] = v[2]; },
        enumerable: true,
      });
    });

    return props;
  }

  function make_tree_props(wa) {
    return make_named_props(wa, {
      label: "tree_props",
      create: wa.tree_props_create,
      count: wa.tree_props_count,
      preset_count: wa.tree_props_preset_count,
      apply_preset: wa.tree_props_apply_preset,
      prop_names: TREE_PROP_NAMES,
      whole_number_names: TREE_WHOLE_NUMBER_NAMES,
      color_names: TREE_COLOR_NAMES,
    });
  }

  function make_plant_props(wa) {
    return make_named_props(wa, {
      label: "plant_props",
      create: wa.plant_props_create,
      count: wa.plant_props_count,
      prop_names: PLANT_PROP_NAMES,
      preset_count: wa.plant_props_preset_count,
      whole_number_names: PLANT_WHOLE_NUMBER_NAMES,
      color_names: PLANT_COLOR_NAMES,
    });
  }

  // ---- billboard fitting --------------------------------------------------
  // Measure the tree that was really generated (trunk + twig cards, i.e. every
  // vertex tree_generate wrote) instead of trusting sp.generated, which is one
  // seed's number from an earlier run and ignores how far the twig cards stick
  // out past the branch tips. y is up, the trunk stands on x = z = 0.
  function measure_tree(positions, vertex_count) {
    var i, x, y, z, r2, min_y = Infinity, max_y = -Infinity, max_r2 = 0;
    for (i = 0; i < vertex_count; i++) {
      x = positions[i * 3]; y = positions[i * 3 + 1]; z = positions[i * 3 + 2];
      if (y < min_y) min_y = y;
      if (y > max_y) max_y = y;
      r2 = x * x + z * z;
      if (r2 > max_r2) max_r2 = r2;
    }
    // radius = farthest any vertex is from the trunk axis: the half width the
    // billboard needs so the crown fits whichever way the billboard turns
    return {
      min_y: min_y, max_y: max_y, radius: Math.sqrt(max_r2),
      height: max_y - min_y
    };
  }

  // Box (ortho volume + world size of the billboard quad) that wraps the tree
  // with the SAME scale on x and y for a target_w x target_h render target.
  // The box is centred on the trunk (so a billboard pivoting on the trunk
  // stays put) and padded by `pad` (fraction of the box) on every side.
  function fit_billboard(b, target_w, target_h, pad) {
    var aspect = target_w / target_h;
    var need_h = b.max_y - b.min_y;
    var need_w = 2 * b.radius;
    var box_h = Math.max(need_h, need_w / aspect) * (1 + 2 * pad);
    var box_w = box_h * aspect;
    var cy = (b.min_y + b.max_y) * 0.5;
    var depth = b.radius * (1 + 2 * pad) + 0.01;
    var bottom = cy - box_h * 0.5;
    // the tight rectangle around the tree (same margin), for drawing only the part of
    // the square texture that has tree in it: a quad of crop.width x crop.height whose
    // lower-left corner is at (-crop.width/2, crop.y0), sampling u0..u1, v0..v1.
    // v is in render-target space (0 = bottom of the box); flip it (1 - v) if your
    // engine samples render targets top-down.
    var m = pad * box_h;
    var u0 = Math.max(0, (box_w * 0.5 - b.radius - m) / box_w);
    var v0 = Math.max(0, (b.min_y - m - bottom) / box_h), v1 = Math.min(1, (b.max_y + m - bottom) / box_h);
    return {
      left: -box_w * 0.5, right: box_w * 0.5,
      bottom: bottom, top: cy + box_h * 0.5,
      near: -depth, far: depth,
      // the full square box: a quad x -width/2..width/2, y y0..y0+height shows the whole texture 1:1
      width: box_w, height: box_h, y0: bottom,
      crop: { width: (1 - 2 * u0) * box_w, height: (v1 - v0) * box_h, y0: bottom + v0 * box_h, u0: u0, u1: 1 - u0, v0: v0, v1: v1 }
    };
  }





  block$(function engine_core() {

    engine.land_frame = function (id, cam) {
      ubuff[ui++] = CMD_LAND_FRAME;
      ubuff[ui++] = id;
      ubuff[ui++] = cam.uuid;
    };


  });
  function land(scene) {
    land.species = {};
    const engine = scene.engine;


    const math = engine.math;
    const wa = engine.wa;
    const max_instances = 1024;


    // Generates a fitted mesh for a tree billboard, with optional multi-plane cross support.
    // pixel_data:  Uint8Array from gl.readPixels
    // img_w, img_h: Width and height of the render target
    // box:          The bounding box object from fit_billboard()
    // segments:     Number of vertical slices (e.g., 24)
    // plane_count:  Number of intersecting planes (1 for flat, 2 for cross, 3 for asterisk)
    function generate_tree_mesh(pixel_data, img_w, img_h, box, segments, plane_count) {
      var alpha_threshold = 64; // Treat alpha > 64 (0.25) as opaque
      var padding = 2;          // Pixel padding to preserve antialiased edges
      var segments_count = segments || 16;
      var planes = plane_count || 1;

      var min_y = img_h;
      var max_y = 0;
      var x, y, idx, i, j;

      // 1. Find absolute vertical bounds of the visible tree pixels
      for (y = 0; y < img_h; y++) {
        for (x = 0; x < img_w; x++) {
          idx = (y * img_w + x) * 4;
          if (pixel_data[idx + 3] > alpha_threshold) {
            if (y < min_y) min_y = y;
            if (y > max_y) max_y = y;
          }
        }
      }

      if (min_y > max_y) return null; // Image is completely transparent

      // 2. Build the base plane envelope (temporary arrays)
      var base_pos = [];
      var base_uvs = [];
      var base_idx = [];
      var step = (max_y - min_y) / segments_count;

      for (i = 0; i <= segments_count; i++) {
        var scan_y = Math.floor(min_y + (i * step));
        if (scan_y >= img_h) scan_y = img_h - 1;

        var band_min = Math.max(0, Math.floor(scan_y - (step / 2)));
        var band_max = Math.min(img_h - 1, Math.floor(scan_y + (step / 2)));

        var left_x = img_w - 1;
        var right_x = 0;
        var found = false;

        for (var by = band_min; by <= band_max; by++) {
          for (x = 0; x < img_w; x++) {
            idx = (by * img_w + x) * 4;
            if (pixel_data[idx + 3] > alpha_threshold) {
              if (x < left_x) left_x = x;
              if (x > right_x) right_x = x;
              found = true;
            }
          }
        }

        if (!found) {
          left_x = img_w / 2;
          right_x = img_w / 2;
        } else {
          left_x = Math.max(0, left_x - padding);
          right_x = Math.min(img_w - 1, right_x + padding);
        }

        var u_left = left_x / img_w;
        var u_right = right_x / img_w;
        var v = scan_y / img_h;

        // Map to world coordinates based on the bounding box
        var wx_left = box.left + (u_left * box.width);
        var wx_right = box.left + (u_right * box.width);
        var wy = box.bottom + (v * box.height);

        base_pos.push(wx_left, wy, 0.0);
        base_uvs.push(u_left, v);

        base_pos.push(wx_right, wy, 0.0);
        base_uvs.push(u_right, v);
      }

      for (j = 0; j < segments_count; j++) {
        var l0 = j * 2;
        var r0 = l0 + 1;
        var l1 = l0 + 2;
        var r1 = l0 + 3;
        base_idx.push(l0, r0, l1);
        base_idx.push(r0, r1, l1);
      }

      // 3. Duplicate, rotate, and combine into final TypedArrays
      var v_count = base_pos.length / 3;
      var i_count = base_idx.length;

      var out_pos = new Float32Array(base_pos.length * planes);
      var out_uvs = new Float32Array(base_uvs.length * planes);
      var out_nor = new Float32Array(base_pos.length * planes);
      var out_idx = new Uint32Array(i_count * planes);

      for (var p = 0; p < planes; p++) {
        var theta = p * (Math.PI / planes);
        var cos_t = Math.cos(theta);
        var sin_t = Math.sin(theta);

        var v_offset = p * v_count;
        var pos_offset = p * base_pos.length;
        var uv_offset = p * base_uvs.length;
        var idx_offset = p * i_count;

        for (var v = 0; v < v_count; v++) {
          var bx = base_pos[v * 3];
          var by_pos = base_pos[v * 3 + 1];
          var bz = base_pos[v * 3 + 2]; // This is 0.0 from the base plane

          // X and Z rotated around Y
          var out_x = (bx * cos_t) + (bz * sin_t);
          var out_y = by_pos;
          var out_z = (-bx * sin_t) + (bz * cos_t);

          out_pos[pos_offset + v * 3] = out_x;
          out_pos[pos_offset + v * 3 + 1] = out_y;
          out_pos[pos_offset + v * 3 + 2] = out_z;

          out_uvs[uv_offset + v * 2] = base_uvs[v * 2];
          out_uvs[uv_offset + v * 2 + 1] = base_uvs[v * 2 + 1];

          // Foliage Spherical Normals Trick:
          // Calculate the center Y of the tree's bounding box
          var cy = box.bottom + (box.height * 0.5);

          // Point the normal radially outward from the trunk, and spherically from the center Y
          var nx = out_x;
          var ny = (out_y - cy) * 0.8; // Multiply by 0.8 to bias slightly more horizontal
          var nz = out_z;

          if (planes === 1) {
            // The billboard: the vertex shader turns this normal with the quad, so it is a normal in the camera's frame (x right, y up, z towards the viewer).
            // A full dome (the normal turning 90 degrees across the card, which is all the silhouette vertices can say) lights half of every tree with a
            // razor sharp terminator and leaves the other half on the ambient alone when the sun is low and to the side. A real crown is nothing like that:
            // its leaves face every way, so the dark side still gets scattered light. So: mostly UP, leaning towards the viewer, with only a LITTLE of the dome.
            //   round  how much dome (0 = every point has the same normal, 1 = a ball)
            //   up     the share of "up" (the sun's height lights the whole tree, whichever way the camera looks)
            //   lean   the share of "towards the viewer"
            var round = 0.45, up = 0.75, lean = 0.65;
            var half_w = box.width * 0.5, half_h = box.height * 0.5;
            nx = round * out_x / half_w;
            ny = up + round * 0.65 * (out_y - cy) / half_h;   // the top of the crown a little more up than the bottom
            nz = lean;
          }

          // Normalize the vector
          var len = Math.sqrt(nx * nx + ny * ny + nz * nz);

          // Fallback for vertices perfectly dead-center on the trunk
          if (len < 0.001) {
            nx = 0.0; ny = 1.0; nz = 0.0; len = 1.0;
          }

          out_nor[pos_offset + v * 3] = nx / len;
          out_nor[pos_offset + v * 3 + 1] = ny / len;
          out_nor[pos_offset + v * 3 + 2] = nz / len;
        }

        for (var idx_i = 0; idx_i < i_count; idx_i++) {
          out_idx[idx_offset + idx_i] = base_idx[idx_i] + v_offset;
        }
      }

      return engine.geometries.create({
        attributes: {
          a_position: { item_size: 3, data: out_pos },
          a_normal: { item_size: 3, data: out_nor },
          a_uv: { item_size: 2, data: out_uvs },
          //a_color: {item_size:4,data:out_colors}
        },
        indices: out_idx

      });

    }



    // the leaf card of a species as a texture (demo.js: the canvas has v = 1 on its top row, GL row 0 is v = 0)
    const leaf_textures = {};
    function leaf_texture_for(sp) {
      if (!leaf_textures[sp.id]) {
        const px = vegi_textures.leaf.pixels(sp.twig, 256), stride = px.width * 4, flipped = new Uint8Array(px.data.length);
        for (let y = 0; y < px.height; y++) flipped.set(px.data.subarray(y * stride, (y + 1) * stride), (px.height - 1 - y) * stride);
        leaf_textures[sp.id] = engine.textures.create({ width: px.width, height: px.height, source: flipped, clamp: true });
      }
      return leaf_textures[sp.id];
    }

    function preload() {
      const max_verts = 120000;


      const positions = wa.fp32_array_scratch(max_verts * 3);
      const normals = wa.fp32_array_scratch(max_verts * 3);
      const uvs = wa.fp32_array_scratch(max_verts * 2);
      const colors = wa.fp32_array_scratch(max_verts * 4);
      const trunk_count_buf = wa.u32_array_scratch(1);
      const tree = make_tree_props(wa);
      const plant = make_plant_props(wa);


      const all_species = [];
      land.all_species = all_species;


      function load_meshes(resp) {

        function load_type(items, type) {
          items.forEach((sp, ii) => {
            if (ii > 10) return;
            let total, geo;

            if (type == "tree") {
              wa.tree_props_apply_preset(tree.ptr, 0);

              Object.keys(sp.props).forEach(function (k) { tree[k] = sp.props[k]; });
              total = wa.tree_generate(
                tree.ptr,
                positions.byteOffset,
                normals.byteOffset,
                uvs.byteOffset,
                colors.byteOffset,
                max_verts,
                trunk_count_buf.byteOffset
              );

              const trunk_count = trunk_count_buf[0];
              geo = engine.geometries.create({
                attributes: {
                  a_position: { item_size: 3, data: positions.subarray(0, total * 3) },
                  a_normal: { item_size: 3, data: normals.subarray(0, total * 3) },
                  a_uv: { item_size: 2, data: uvs.subarray(0, total * 2) },
                  a_color: { item_size: 4, data: colors.subarray(0, total * 4) },
                },
              });
              geo.drawing_count = trunk_count;
              geo.twig_count = total - trunk_count;
            }

            else if (type == "plant") {
              wa.plant_props_apply_preset(plant.ptr, 0);

              Object.keys(sp.props).forEach(function (k) { tree[k] = sp.props[k]; });
              const total = wa.plant_generate(
                plant.ptr,
                positions.byteOffset,
                normals.byteOffset,
                uvs.byteOffset,
                colors.byteOffset,
                max_verts
              );


              geo = engine.geometries.create({
                attributes: {
                  a_position: { item_size: 3, data: positions.subarray(0, total * 3) },
                  a_normal: { item_size: 3, data: normals.subarray(0, total * 3) },
                  a_uv: { item_size: 2, data: uvs.subarray(0, total * 2) },
                  a_color: { item_size: 4, data: colors.subarray(0, total * 4) },
                }
              });
              geo.drawing_count = total;

            }



            const t = {
              id: sp.id, sp: sp, type: type,
              draw_count: geo.drawing_count, used: 0,

              bounds: measure_tree(positions, total),
              draw_instances: 0, geo: geo,
              rad: {
                h: sp.generated.height,
                r: sp.generated.radius || sp.generated.crown_width
              },
            };

            if (t.bounds.radius < 1) {
              t.bounds.height = t.rad.h;
              t.bounds.radius = t.rad.r;
              t.bounds.min_y = 0;
              t.bounds.max_y = t.bounds.height;

            }
            land.species[t.id] = t;
            t.index = all_species.length;
            all_species.push(t);

          })
        }

        load_type(tree_presets.trees, "tree");
        load_type(plant_presets.plants, "plant");

        land.species_instances = engine.textures.create({
          width: max_instances, height: all_species.length, clamp: true,
          min_filter: GL_NEAREST, mag_filter: GL_NEAREST,
          format_type: GL_FLOAT, internal_format: GL_RGBA32F,
          data: new Float32Array(all_species.length * max_instances * 4)
        });

        const shader = `
uniform sampler2D u_instances;
uniform float u_index;
uniform float u_max_instances;
vec3 get_a_position(vec3 pos){
  float ti=((float(gl_InstanceID)+0.5)/u_max_instances);
vec4 p=texture2D(u_instances,vec2(ti,u_index));
  return (pos*p.w)+p.xyz;
}
void vertex(){
super_vertex();
}

`;
        land.default_mat = engine.materials.create({
          wireframe: !true, compiler: "pbr",
          props: {
            enable_vertex_color: true,
          },
          uniforms: {
            u_baryframe_opacity: 0.15,
            u_baryframe_width1: 0.5,
            u_instances: land.species_instances,
            u_max_instances: max_instances,
            u_base_color_map1: engine.dummy_texture_rgba,
            u_index: 0
          },
          shader: shader
        });

        land.default_mat_alpha = engine.materials.create({
          wireframe: !true, compiler: "pbr",
          props: {
            enable_vertex_color1: true,
          },
          uniforms: {
            u_alpha_test: 0.5,
            u_baryframe_opacity: 0.15,
            u_baryframe_width1: 0.5,
            u_instances: land.species_instances,
            u_max_instances: max_instances,
            u_base_color_map: engine.dummy_texture_rgba,
            u_index: 0
          },
          shader: shader
        });

        land.default_mat_alpha_bilb = engine.materials.create({
          wireframe: !true, compiler: "pbr",
          props: {
            enable_bilboard: true,
          },
          state: { cullFace: null },
          uniforms: {
            u_alpha_test: 0.5,
            u_baryframe_opacity: 0.15,
            u_baryframe_width1: 0.5,
            u_instances: land.species_instances,
            u_max_instances: max_instances,
            u_base_color_map: engine.dummy_texture_rgba,
            u_index: 0
          },
          shader: `
uniform sampler2D u_instances;
uniform float u_index;
uniform float u_max_instances;
uniform vec3 sun_direction;
void vertex(){
  super_vertex();
  float ti=((float(gl_InstanceID)+0.5)/u_max_instances);
  vec4 p=texture2D(u_instances,vec2(ti,u_index));
  vec3 right=vec3(u_camera_sd_vector.x,0.0,u_camera_sd_vector.z);
  vec3 toward=vec3(u_camera_fw_vector.x,0.0,u_camera_fw_vector.z);
  float rl=length(right);
  float tl=length(toward);
  right=rl>0.001?right/rl:vec3(1.0,0.0,0.0);
  toward=tl>0.001?toward/tl:vec3(0.0,0.0,1.0);
  vec3 world=p.xyz+right*(a_position.x*p.w)+vec3(0.0,a_position.y*p.w,0.0);
  v_position_world=world;
  v_position_view=(u_view_matrix*vec4(world,1.0)).xyz;
  v_normal_world=normalize(right*a_normal.x+vec3(0.0,1.0,0.0)*a_normal.y+toward*a_normal.z);
  gl_Position=u_view_projection_matrix*vec4(world,1.0);

float sun_len = length(sun_direction);
if (sun_len > 0.5) {
	vec3 sun_toward = sun_direction / sun_len;
	v_position_world -= sun_toward * dot(world, sun_toward);
}
}
`
        });

        resp();

      }




      return new Promise(load_meshes);
    }

    preload();
    land.chunks_id = engine.create_data_response(function (data) {
      PR.land_chunks = data.length;
      land.update_on_frame = true;

      land.loaded.chunks.forEach(cha => {
        cha.visibled = false;
      });
      for (let i = 0; i < data.length; i++) {
        land.loaded.chunks[data[i]].visibled = true;
      }

    });
    land.update_on_frame = true;
    console.log(land);

    land.vegid = engine.debug.mesh({
      max_items: 4096 * 128,
      material: { wireframe: true },
      geo: engine.geometries.cube_offset(1, 1, 1, 1, 0, 0.5, 0)
    });

    land.add_instance = function (i, x, y, z, s) {
      const sp = land.all_species[i];
      i = sp.index;
      const d = (i * max_instances * 4) + (sp.draw_instances * 4);



      land.species_instances.data[d] = x;
      land.species_instances.data[d + 1] = y;
      land.species_instances.data[d + 2] = z;
      land.species_instances.data[d + 3] = s;
      sp.draw_instances++;
      land.species_instances.needs_update = true;

    };

    land.render_debug = function () {
      PR.drawn_instances = 0;
      if (!this.loaded) return;
      land.all_species.forEach((sp, i) => {
        if (sp.draw_instances > 0) {



          if (sp.bilb && sp.bilb.mes) {

            engine.begin_render_item(sp.bilb.mes, land.default_mat_alpha_bilb);
            engine.render_uniform_value("u_index", ((i + 0.5) / land.all_species.length));
            engine.render_uniform_texture("u_base_color_map", sp.bilb.color);
            engine.end_render_item(0, 0, sp.draw_instances);
            /*
             

            engine.begin_render_item(sp.vxl, land.default_mat);
            engine.render_uniform_value("u_index", ((i + 0.5) / land.all_species.length));
            engine.render_uniform_texture("u_base_color_map", sp.bilb.color);
            engine.end_render_item(0, 0, sp.draw_instances);
            

           
          */
          }
          else {
            engine.begin_render_item(sp.geo, land.default_mat);
            engine.render_uniform_value("u_index", ((i + 0.5) / land.all_species.length));
            engine.end_render_item(0, sp.draw_count, sp.draw_instances);
            if (sp.geo.twig_count > 0) {
              engine.begin_render_item(sp.geo, land.default_mat_alpha);
              engine.render_uniform_texture("u_base_color_map", sp.twig_texture)
              engine.render_uniform_value("u_index", ((i + 0.5) / land.all_species.length));
              engine.end_render_item(sp.draw_count, sp.geo.twig_count, sp.draw_instances);
            }
          }



          PR.drawn_instances += sp.draw_instances;
        }
      });
      land.vegid.render();
    };

    land.update_instances = function () {
      if (!this.loaded) return;
      const vins = this.loaded.instances;
      land.vegid.clear();
      land.all_species.forEach(sp => {
        sp.draw_instances = 0;
      });

      this.loaded.chunks.forEach(cha => {
        if (cha.count > 0 && cha.visibled) {
          //   land.vegid.set_color(0, 1, 0).add_pos_scale(cha.center[0], cha.center[1], cha.center[2], cha.radius * 2, cha.radius * 0.125, cha.radius * 2);

          for (let a = 0; a < cha.count; a++) {
            const i = (cha.start_index + a) * 6;
            const sp = land.loaded.species_map[vins[i + 5]];
            if (sp.ii > -1) {
              land.add_instance(sp.ii, vins[i], vins[i + 1], vins[i + 2], vins[i + 4]);
            }
            else {
              land.vegid.set_color(sp.debug_color[0], sp.debug_color[1], sp.debug_color[2]).add_pos_scale(vins[i], vins[i + 1], vins[i + 2], vins[i + 4] * sp.radius, vins[i + 4] * sp.height, vins[i + 4] * sp.radius);

            }

          }
        }


      });


      if (land.species_instances.needs_update) {
        land.species_instances.needs_update = false;
        engine.update_texture_source(land.species_instances, land.species_instances.data);
      }
    }
    scene.on_shadow_pass.add(function () {
      land.render_debug();

    });

    scene.on_render_pass.add(function () {
      land.update_instances();
      if (land.update_on_frame && land.loaded) {
        land.update_on_frame = false;
        engine.land_frame(land.chunks_id, scene.camera);
      }
      land.render_debug();


      if (land.used_species) {
        land.used_species.forEach((sp, i) => {
          if (sp.used > 0 && i == 0) {
            //engine.render_texture(fbo_voxel.color, 0.25, 0.25, 0.5, 0.5);
          }
        });
      }


    });

    console.log("land", [land]);
    engine.land_output = function (def) {
      console.log("land_output", def);
      def.species_map.forEach(function (sp) {
        sp.sps = land.species[sp.name];
        if (sp.sps) {
          sp.ii = sp.sps.index;
          sp.height = sp.sps.bounds.height;
          sp.radius = sp.sps.bounds.radius;
        }
        else {
          sp.ii = -1;
          sp.height = 1;
          sp.radius = 1;

        }
      });
      land.loaded = def;


      const vins = def.instances;
      const m2 = math.mat4();

      let bchunk = def.chunks[0];
      def.chunks.forEach(cha => {
        if (cha.count > bchunk.count) {
          bchunk = cha;
        }
        for (let a = 0; a < cha.count; a++) {
          const i = (cha.start_index + a) * 6;
          const sp = def.species_map[vins[i + 5]];
          if (sp.sps) {
            sp.sps.used++;
          }

        }

      });
      land.biggest_chunk = bchunk;
      const bmat = engine.materials.create({
        wireframe1: true,
        props: {
          enable_vertex_color: true,
        },

        uniforms: {
          u_base_color_map1: engine.dummy_texture_rgba,
          u_view_projection_matrix: m2
        },
      });
      const bmat_twig = engine.materials.create({
        wireframe1: true,

        props: { enable_vertex_color: true },
        uniforms: {
          u_base_color_map: engine.dummy_texture_rgba,
          u_view_projection_matrix: m2,
          u_alpha_test: 0.5,
        }
      });




      land.used_species = [];
      const pixels = new Uint8Array(512 * 512 * 4);



      let max_res = 128;
      land.all_species.forEach(sp => {
        if (sp.used > 0) {
          console.log([sp.id, sp]);
          // 1. Calculate the tree's natural physical dimensions
          var need_h = sp.bounds.max_y - sp.bounds.min_y;
          var need_w = sp.bounds.radius * 2.0;

          // 2. Derive optimal framebuffer dimensions clamping to max_res
          var target_w, target_h;
          if (need_h > need_w) {
            target_h = max_res;
            target_w = Math.max(1, Math.ceil((need_w / need_h) * max_res));
          } else {
            target_w = max_res;
            target_h = Math.max(1, Math.ceil((need_h / need_w) * max_res));
          }

          // 3. Fit the billboard using the new dynamic aspect ratio
          const box = fit_billboard(sp.bounds, target_w, target_h, 0.02);

          math.mat4.ortho(m2, box.left, box.right, box.bottom, box.top, box.near, box.far);

          sp.box = box;
          sp.bilb = engine.render_targets.create({ width: target_w, height: target_h, color: {} });
          sp.twig_texture = engine.textures.create({ width: 256, source: vegi_textures.leaf.pixels(sp.twig, 256).data, });

          engine._push_render_target(sp.bilb, true, true);
          engine._render_item(sp.geo, bmat, 0, sp.draw_count, 0);
          if (sp.geo.twig_count > 0) {
            bmat_twig.uniforms.u_base_color_map = sp.twig_texture;
            engine._render_item(sp.geo, bmat_twig, sp.draw_count, sp.geo.twig_count, 0);
          }
          engine.webgl.gl.readPixels(0, 0, target_w, target_h, GL_RGBA, GL_UNSIGNED_BYTE, pixels);
          engine._pop_render_target();
          sp.bilb.mes = generate_tree_mesh(pixels, target_w, target_h, box, 8, 1);

          land.used_species.push(sp);
        }
      });


    };

    return;

    engine.call_worker("land_init", {
      world_size: scene.world_size, world_height: scene.world_height || 1, has_heightmap: scene.has_heightmap,
      biome_data: scene.biome_map, biome_map_size: scene.biome_map_size,
      // species: pack.ids.map(function (id) { return { id: id, type: pack.defs[id].type, rule: pack.defs[id].rule }; }),
    }, scene.biome_map ? [scene.biome_map] : undefined);
  }




  return land;


});