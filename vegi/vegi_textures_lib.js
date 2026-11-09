// vegi_textures_lib.js: the code of vegi_textures.js (the procedural leaf and bark textures), as a fragment: vegi_textures.js includes it for the pages that list that file,
// and vegetation.js includes it into its own closure (a module that returns its value cannot be used from the engine_core block). The twig card painter takes an optional `style` (vegi_textures.js says what); without one the cards are painted exactly as before.
const vegi_textures = (function () {
    // Math.imul is ES6; this is the ES5 version of it
    var imul = Math.imul || function (a, b) {
      var ah = (a >>> 16) & 0xffff, al = a & 0xffff, bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
      return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0) | 0);
    };

    // Procedural leaf-card textures: the twig cards of the trees and the leaf cards of the plants.
    //
    // TWIG CARDS (trees, see tree_build_twigs in tree_system.cpp). A twig is one double-sided square card per terminal branch, with UV (0,0) at the
    // branch start and (0,1) beyond its tip, so u runs across the card and v runs up along the branch. The painter makes a transparent card
    // with a short twig along u = 0.5 and a cloud of leaves around its end. The definition of a card lives in the json of its tree
    // (tree_trunk_presets.json: trees[].twig, id = trees[].leaf_texture):
    //   kind    leaf shape: ovate oblong round heart narrow scale lobed maple fan palmate compound (one filled shape per leaf),
    //           needle feather frond (stroked), blossom (five-petal flowers mixed with a few leaves)
    //   color   base leaf rgb            count   leaves per card            size    leaf length as a fraction of the card
    //   spread  radius of the leaf cloud as a fraction of the card            hang    0 = leaves point outwards, 1 = they hang down
    //   stem    rgb of the twig itself
    //   compound only: leaflets (pairs, default 4) and lw (leaflet width / length, default 0.4)
    //   blossom only:  eye (rgb of the flower centre) and leaf_color (rgb of the few leaves)
    //
    // PLANT LEAF CARDS (plants, plant_presets.json: leaf_types, referenced by plants[].leaf_texture). One leaf per card: the base at the bottom
    // edge of the canvas (the same orientation as the twig cards), the tip at the top, the midrib at u = 0.5. The picture is neutral grey-white
    // with an alpha cut-out: the colour of a plant comes from its vertex colours, which multiply it (so veins show as darker, the clover chevron as lighter).
    // The leaf is drawn in true proportions of the blade it is mapped on (aspect = blade length / blade width), so a pinnule is as round as it is long;
    // the canvas is as wide as that needs (a 7:1 fern frond gets a card 7x narrower than it is high), see dims().
    //   kind    blade (grass: parallel veins, midrib, folded flanks)   simple (one outline: ovate, lanceolate, spatulate, cordate, ... with veins and teeth)
    //           pinnate (leaflets or lobes along a rachis, optionally two levels: ferns)   trifoliate (clover)   parted (palmately parted lobes)
    //   the other fields are listed with each painter below.
    //
    // Both need a DOM (document.createElement('canvas')). Deterministic: the same id gives the same pixels.
    var leaf_textures = (function () {
      var DEFAULT_SPEC = { kind: 'lobed', color: [78, 120, 46], count: 34, size: 0.17, spread: 0.40, hang: 0.15, stem: [70, 52, 38] };   // used (with a warning) for an id nobody registered
      var SPECS = {};                                                                    // id -> definition, filled by register() / register_presets()
      var PLANT_KINDS = { blade: 1, simple: 1, pinnate: 1, trifoliate: 1, parted: 1 };
      var TWO_PI = Math.PI * 2;
      var has_path2d = typeof Path2D === 'function';
      var shared = null;                                                                 // the one canvas every pixels() call paints on: { canvas, g, w, h }
      var cache = {};                                                                    // 'id@size' -> { width, height, data }
      var shape_paths = {};                                                              // the outline of each leaf shape, built once (Path2D)
      var warned = {};

      function is_array(a) { return Object.prototype.toString.call(a) === '[object Array]'; }

      function rng(seed) {   // small deterministic generator (mulberry32)
        var a = seed >>> 0;
        return function () {
          a = (a + 0x6D2B79F5) >>> 0;
          var t = a;
          t = imul(t ^ (t >>> 15), t | 1);
          t ^= t + imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      function hash_id(id) { var h = 2166136261; for (var i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = imul(h, 16777619); } return h >>> 0; }

      function shade(color, k) {
        return 'rgb(' + Math.max(0, Math.min(255, Math.round(color[0] * k))) + ',' + Math.max(0, Math.min(255, Math.round(color[1] * k))) + ',' + Math.max(0, Math.min(255, Math.round(color[2] * k))) + ')';
      }

      // ---- the registry ----
      function drop_cached(id) {
        var prefix = id + '@', k;
        for (k in cache) { if (cache.hasOwnProperty(k) && k.indexOf(prefix) === 0) delete cache[k]; }
      }
      function register(id, spec) {
        SPECS[id] = spec;
        delete warned[id];
        drop_cached(id);
        return spec;
      }
      // trees: trees[].twig under the id trees[].leaf_texture; plants: every entry of leaf_types. Returns how many definitions were registered.
      function register_presets(data) {
        var n = 0, i, t, k, types;
        if (!data) return 0;
        if (data.trees) {
          for (i = 0; i < data.trees.length; i++) {
            t = data.trees[i];
            if (t && t.leaf_texture && t.twig) { register(t.leaf_texture, t.twig); n++; }
          }
        }
        types = data.leaf_types;
        if (types) { for (k in types) { if (types.hasOwnProperty(k)) { register(k, types[k]); n++; } } }
        return n;
      }
      function resolve(src) {   // id or definition -> { key (cache key), id (what the seed comes from), spec }
        var spec, id;
        if (typeof src === 'string') {
          spec = SPECS[src];
          if (!spec) {
            if (!warned[src]) {
              warned[src] = true;
              if (typeof console !== 'undefined' && console.warn) console.warn('vegi_textures.leaf: nothing registered for "' + src + '", painting the default oak card (call leaf.register_presets(json) first)');
            }
            spec = DEFAULT_SPEC;
          }
          return { key: src, id: src, spec: spec };
        }
        spec = src || DEFAULT_SPEC;
        id = typeof spec.id === 'string' ? spec.id : JSON.stringify(spec);
        return { key: 'obj:' + JSON.stringify(spec), id: id, spec: spec };
      }
      function seed_of(id, spec) { return typeof spec.seed === 'number' ? (spec.seed >>> 0) : hash_id(id); }

      // ---- the twig shapes: every shape is drawn pointing along +x from (0,0) with length 1 ----
      function lens(g, w) { g.moveTo(0, 0); g.quadraticCurveTo(0.5, -w, 1, 0); g.quadraticCurveTo(0.5, w, 0, 0); }
      var SHAPES = {
        ovate: function (g) { lens(g, 0.42); },
        oblong: function (g) { lens(g, 0.26); },
        round: function (g) { g.moveTo(0, 0); g.bezierCurveTo(0.1, -0.62, 0.95, -0.55, 1, 0); g.bezierCurveTo(0.95, 0.55, 0.1, 0.62, 0, 0); },
        heart: function (g) {   // lime: broad, with two small lobes at the stalk
          g.moveTo(0.04, 0); g.bezierCurveTo(-0.14, -0.30, 0.45, -0.52, 1, 0); g.bezierCurveTo(0.45, 0.52, -0.14, 0.30, 0.04, 0); g.closePath();
        },
        narrow: function (g) { lens(g, 0.11); },
        scale: function (g) { lens(g, 0.5); },
        lobed: function (g) {   // oak: wavy outline, 3-4 rounded lobes per side
          var n = 72, side, i, t, w, y;
          for (side = 0; side < 2; side++) {
            for (i = 0; i <= n; i++) {
              t = side === 0 ? i / n : 1 - i / n;
              w = 0.30 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.8) * (0.62 + 0.38 * Math.cos(t * Math.PI * 7));
              y = side === 0 ? -w : w;
              if (side === 0 && i === 0) g.moveTo(t, y); else g.lineTo(t, y);
            }
          }
          g.closePath();
        },
        maple: function (g) {   // five pointed lobes radiating from the stalk
          var ang = [-1.25, -0.62, 0, 0.62, 1.25], len = [0.62, 0.9, 1, 0.9, 0.62];
          ang.forEach(function (a, i) {
            var c = Math.cos(a), s = Math.sin(a), L = len[i], w = 0.2;
            function p(x, y) { return [x * c - y * s, x * s + y * c]; }
            var m = p(0, 0), q1 = p(L * 0.5, -w * L), tip = p(L, 0), q2 = p(L * 0.5, w * L);
            g.moveTo(m[0], m[1]); g.lineTo(q1[0], q1[1]); g.lineTo(tip[0], tip[1]); g.lineTo(q2[0], q2[1]); g.closePath();
          });
        },
        fan: function (g) {   // ginkgo: a fan with a notch in the outer edge
          var i, a, notch;
          g.moveTo(0, 0);
          for (i = 0; i <= 14; i++) { a = -0.95 + 1.9 * i / 14; notch = Math.abs(a) < 0.12 ? 0.82 : 1.0; g.lineTo(Math.cos(a) * notch, Math.sin(a) * notch); }
          g.closePath();
        },
        palmate: function (g) {   // baobab, horse chestnut: leaflets fanning from one point
          var i;
          for (i = -2; i <= 2; i++) {
            (function (i) {
              var a = i * 0.42, c = Math.cos(a), s = Math.sin(a), L = 1 - Math.abs(i) * 0.12, w = 0.15;
              function p(x, y) { return [x * c - y * s, x * s + y * c]; }
              var a0 = p(0, 0), cp1 = p(L * 0.5, -w * L * 2), e = p(L, 0), cp2 = p(L * 0.5, w * L * 2);
              g.moveTo(a0[0], a0[1]); g.quadraticCurveTo(cp1[0], cp1[1], e[0], e[1]); g.quadraticCurveTo(cp2[0], cp2[1], a0[0], a0[1]);
            })(i);
          }
        },
        compound: function (g, s) {   // ash, walnut, locust: pairs of leaflets along a rachis and a terminal leaflet. s.leaflets = pairs, s.lw = leaflet width / length
          var n = s.leaflets || 4, lw = s.lw || 0.4, i, side, bx, L;
          function leaflet(bx, a, L) {
            var ca = Math.cos(a), sa = Math.sin(a), h = lw * L;
            function p(x, y) { return [bx + x * ca - y * sa, x * sa + y * ca]; }
            var m = p(0, 0), c1 = p(L * 0.5, -h), tip = p(L, 0), c2 = p(L * 0.5, h);
            g.moveTo(m[0], m[1]); g.quadraticCurveTo(c1[0], c1[1], tip[0], tip[1]); g.quadraticCurveTo(c2[0], c2[1], m[0], m[1]); g.closePath();
          }
          for (i = 0; i < n; i++) {
            bx = 0.10 + 0.50 * (n > 1 ? i / (n - 1) : 0);
            L = 0.30 + 0.10 * (i / n);
            for (side = -1; side <= 1; side += 2) leaflet(bx, side * 0.95, L);
          }
          leaflet(0.60, 0, 0.40);
        }
      };
      function shape_key(spec) { return spec.kind === 'compound' ? 'compound:' + (spec.leaflets || 4) + ':' + (spec.lw || 0.4) : spec.kind; }
      function shape_path(spec) {   // the Path2D of a shape, built once; null when Path2D does not exist (the shape is then rebuilt for every leaf)
        if (!has_path2d) return null;
        var key = shape_key(spec), p = shape_paths[key];
        if (!p) { p = new Path2D(); SHAPES[spec.kind](p, spec); shape_paths[key] = p; }
        return p;
      }

      // ---- the stroked twig kinds ----
      function needles_path(g, n, rand) {   // fan of thin needles from one point
        var i, a, L;
        g.beginPath();
        for (i = 0; i < n; i++) {
          a = (i / (n - 1) - 0.5) * 0.9 + (rand() - 0.5) * 0.1; L = 0.85 + rand() * 0.15;
          g.moveTo(0, 0); g.lineTo(Math.cos(a) * L, Math.sin(a) * L);
        }
      }
      function feather_path(g) {   // redwood spray: a stem with short needles to both sides
        var n = 16, i, t, L;
        g.moveTo(0, 0); g.lineTo(1, 0);
        for (i = 1; i <= n; i++) {
          t = i / (n + 1); L = 0.28 * (1 - t * 0.55);
          g.moveTo(t, 0); g.lineTo(t + 0.14, -L);
          g.moveTo(t, 0); g.lineTo(t + 0.14, L);
        }
      }
      function frond_path(g) {   // palm frond: a curved rachis with a pair of thin leaflets at each node
        var n = 22, bend = 0.45, i, t, q, L, sd;
        g.moveTo(0, 0);
        for (i = 1; i <= 16; i++) { t = i / 16; g.lineTo(t, bend * t * t); }
        for (i = 1; i <= n; i++) {
          t = i / (n + 1); q = [t, bend * t * t]; L = 0.34 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)) + 0.05;
          for (sd = -1; sd <= 1; sd += 2) { g.moveTo(q[0], q[1]); g.lineTo(q[0] + 0.12, q[1] + sd * L * 0.9 + 0.04 * L); }
        }
      }
      var STROKE_BUILDERS = { feather: feather_path, frond: frond_path };
      function stroke_builder(g, name) {
        var p;
        if (has_path2d) {
          p = shape_paths['stroke:' + name];
          if (!p) { p = new Path2D(); STROKE_BUILDERS[name](p); shape_paths['stroke:' + name] = p; }
          g.stroke(p);
        } else { g.beginPath(); STROKE_BUILDERS[name](g); g.stroke(); }
      }
      function draw_blossom(g, spec, k) {   // five-petal flower
        var i;
        g.fillStyle = shade(spec.color, k);
        for (i = 0; i < 5; i++) { g.save(); g.rotate(i * TWO_PI / 5); g.translate(0.5, 0); g.scale(0.5, 0.38); g.beginPath(); g.arc(0, 0, 1, 0, TWO_PI); g.fill(); g.restore(); }
        g.fillStyle = shade(spec.eye || [222, 150, 90], 1); g.beginPath(); g.arc(0, 0, 0.2, 0, TWO_PI); g.fill();
      }

      // ---- the twig card painter ----
      // `style` (optional; the vegetation system gives it, the other pages leave it out and get the card as it always was):
      //   leaf_size  1 = the leaves of the definition; 0.7 = each leaf 0.7 times as long and 1 / 0.49 as many of them (the same cover, finer foliage: a card of 4 m with leaves of 80 cm reads as paper up close)
      //   look       0 .. 1: how much of the realistic painting is used: a lighter midrib and side veins, a warmer base and a cooler tip, colour that differs from leaf to leaf, mottling, a scorched tip now and
      //              then, a soft shadow under every leaf (the depth between overlapping leaves is what makes a cluster read as fluffy), and light from above across the whole cluster
      var FINE_KINDS = { ovate: 1, oblong: 1, round: 1, heart: 1, narrow: 1, scale: 1, lobed: 1, maple: 1, fan: 1, palmate: 1, compound: 1 };    // (needles, sprays, fronds and flowers keep their size)
      var VEINED = { ovate: 0.21, oblong: 0.13, round: 0.40, heart: 0.34, narrow: 0.055, lobed: 0.26, scale: 0.25 };         // the kinds that get a midrib and side veins -> their widest half width (leaf lengths)
      function tone(color, k, a) {
        return 'rgba(' + Math.max(0, Math.min(255, Math.round(color[0] * k))) + ',' + Math.max(0, Math.min(255, Math.round(color[1] * k))) + ',' + Math.max(0, Math.min(255, Math.round(color[2] * k))) + ',' + a + ')';
      }
      // one broad leaf, in the leaf's own frame (it lies along +x from its stalk, length 1); `px` is how many pixels long it is
      function paint_leaf_rich(g, spec, kind, P, p, px, size, look, rand) {
        var col = spec.color, k = p.k, c = [col[0] * (1 + 0.16 * p.j), col[1] * (1 + 0.07 * (p.j2 - 0.5)), col[2] * (1 - 0.20 * p.j)];
        var hw = VEINED[kind], half = kind === 'narrow' ? 0.12 : 0.34, reach = hw || 0.25, i, side, t, n, w, x, y, grad;
        function outline() { if (P) return P; g.beginPath(); SHAPES[kind](g, spec); return null; }
        // the stalk
        g.lineCap = 'round'; g.lineWidth = 0.035; g.strokeStyle = tone(c, k * 0.95, 1);
        g.beginPath(); g.moveTo(-0.16, 0); g.lineTo(0.03, 0); g.stroke();
        // the blade, lit from one side, with a soft shadow on whatever lies under it
        g.shadowColor = 'rgba(6,12,2,' + (0.55 * look) + ')'; g.shadowBlur = Math.max(1.5, 0.016 * size * look); g.shadowOffsetX = 0.006 * size * look; g.shadowOffsetY = 0.011 * size * look;
        grad = g.createLinearGradient(0, -half, 0, half);
        grad.addColorStop(0, tone(c, k * 1.16, 1)); grad.addColorStop(0.5, tone(c, k, 1)); grad.addColorStop(1, tone(c, k * 0.76, 1));
        g.fillStyle = grad;
        if (P) g.fill(P); else { g.beginPath(); SHAPES[kind](g, spec); g.fill(); }
        g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0;
        // what is on the blade stays inside it
        g.save();
        if (P) g.clip(P); else { g.beginPath(); SHAPES[kind](g, spec); g.clip(); }
        grad = g.createLinearGradient(0, 0, 1, 0);                                       // along the leaf: warmer and lighter at the stalk, cooler and darker at the tip
        grad.addColorStop(0, 'rgba(236,226,112,' + (0.20 * look) + ')'); grad.addColorStop(0.45, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(8,30,12,' + (0.24 * look) + ')');
        g.fillStyle = grad; g.fillRect(-0.2, -1, 1.4, 2);
        for (i = 0; i < 10; i++) {                                                       // mottling: light and dark blotches, the way a blade is never one flat colour
          x = rand(); y = (rand() - 0.5) * 2 * reach * 0.9;
          g.fillStyle = rand() < 0.5 ? tone(c, k * 1.35, 0.11 * look) : tone(c, k * 0.55, 0.13 * look);
          g.beginPath(); g.arc(x, y, 0.035 + rand() * 0.07, 0, TWO_PI); g.fill();
        }
        if (hw && px >= 16) {
          n = hw < 0.1 ? 0 : (hw > 0.3 ? 5 : 6);
          if (n) {                                                                       // side veins: lighter than the blade, leaving the midrib at a slant and bending on towards the margin
            g.strokeStyle = tone(c, k * 1.4, 0.5 * look); g.lineWidth = 0.022; g.beginPath();
            for (i = 0; i < n; i++) {
              t = 0.15 + i * 0.66 / n;
              for (side = -1; side <= 1; side += 2) {
                w = hw * Math.pow(Math.sin(Math.PI * Math.min(0.98, t + 0.22)), 0.85);
                g.moveTo(t, 0); g.quadraticCurveTo(t + 0.07, side * w * 0.38, t + 0.22, side * w * 0.9);
              }
            }
            g.stroke();
          }
          g.strokeStyle = tone(c, k * 0.55, 0.32 * look); g.lineWidth = 0.065;           // the midrib: a pale core in a darker groove
          g.beginPath(); g.moveTo(0, 0); g.lineTo(0.94, 0); g.stroke();
          g.strokeStyle = tone(c, k * 1.5, 0.85 * look); g.lineWidth = 0.034;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(0.94, 0); g.stroke();
        }
        if (p.j2 > 0.9) {                                                                // now and then a tip scorched by the sun
          grad = g.createRadialGradient(0.93, 0, 0, 0.93, 0, 0.3);
          grad.addColorStop(0, 'rgba(158,112,40,' + (0.55 * look) + ')'); grad.addColorStop(1, 'rgba(158,112,40,0)');
          g.fillStyle = grad; g.fillRect(0.5, -0.5, 0.7, 1);
        }
        g.restore();
        g.lineWidth = 0.02; g.strokeStyle = tone(c, k * 0.5, 0.5 * look);                // the margin
        if (P) g.stroke(P); else { g.beginPath(); SHAPES[kind](g, spec); g.stroke(); }
      }

      function paint_twig(g, spec, size, rand, style) {
        var stem = spec.stem || (is_array(spec.twig) ? spec.twig : [90, 70, 50]);
        var kind = spec.kind, cx = 0.5, cy = 0.46, pts = [], i, a, r;
        var shape = SHAPES.hasOwnProperty(kind) ? spec : { kind: 'ovate' };
        var P = SHAPES.hasOwnProperty(kind) ? shape_path(spec) : null;
        var leaf_green = spec.leaf_color || [86, 130, 60];
        var look = style && style.look > 0 ? Math.min(1, style.look) : 0;
        var fine = style && style.leaf_size > 0 && FINE_KINDS.hasOwnProperty(kind) ? style.leaf_size : 1;
        var count = Math.min(400, Math.round(spec.count / (fine * fine))), leaf_len = spec.size * fine, rich = look > 0 && SHAPES.hasOwnProperty(kind) && FINE_KINDS.hasOwnProperty(kind) && kind !== 'palmate' && kind !== 'compound' && kind !== 'maple' && kind !== 'fan';

        // the twig itself, from the branch start (bottom centre) to the middle of the leaf cloud
        g.strokeStyle = shade(stem, 1); g.lineWidth = size * 0.016; g.lineCap = 'round';
        g.beginPath(); g.moveTo(size * 0.5, size); g.lineTo(size * 0.5, size * 0.52); g.stroke();

        // centre of the leaf cloud (y down); draw back to front so overlapping leaves read as layers: far (top of the cloud) first
        for (i = 0; i < count; i++) {
          a = rand() * TWO_PI; r = Math.sqrt(rand()) * spec.spread;
          pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 1.05, k: 0.78 + rand() * 0.42, j: rand() - 0.5, j2: rand() });
        }
        pts.sort(function (p, q) { return p.y - q.y; });
        if (look > 0) pts.forEach(function (p) {                                          // light from above across the cluster, and the rim of it a little brighter than its middle
          var shell = Math.sqrt((p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy)) / spec.spread, top = (cy - p.y) / (spec.spread * 1.05);
          p.k *= 1 + look * (0.13 * Math.max(-1, Math.min(1, top)) + 0.10 * (Math.min(1.2, shell) - 0.55));
        });
        pts.forEach(function (p) {
          var ang = Math.atan2(p.y - cy, p.x - cx), half, grad, vi, t, sd;                // outwards from the cloud centre
          ang = ang * (1 - spec.hang) + (Math.PI / 2) * spec.hang;                       // ... or hanging down (+y)
          ang += p.j * 1.1;
          g.save();
          g.translate(p.x * size, p.y * size);
          g.rotate(ang);
          g.scale(leaf_len * size, leaf_len * size);
          g.fillStyle = shade(spec.color, p.k);
          g.strokeStyle = shade(spec.color, p.k * 0.8);
          if (kind === 'needle') { g.lineWidth = 0.035; g.lineCap = 'round'; needles_path(g, 9, rand); g.stroke(); }
          else if (kind === 'feather') { g.lineWidth = 0.04; g.lineCap = 'round'; stroke_builder(g, 'feather'); }
          else if (kind === 'frond') { g.lineWidth = 0.022; g.lineCap = 'round'; stroke_builder(g, 'frond'); }
          else if (kind === 'blossom') {
            if (p.j2 < 0.82) draw_blossom(g, spec, p.k);
            else { g.fillStyle = shade(leaf_green, p.k); g.beginPath(); SHAPES.ovate(g); g.fill(); }
          }
          else if (rich) paint_leaf_rich(g, spec, kind, P, p, leaf_len * size, size, look, rand);
          else {
            // a blade is lit from one side: lighter on one half, darker on the other, which is what makes a flat shape read as a leaf
            half = kind === 'narrow' ? 0.12 : 0.34;
            grad = g.createLinearGradient(0, -half, 0, half);
            grad.addColorStop(0, shade(spec.color, p.k * 1.14));
            grad.addColorStop(0.5, shade(spec.color, p.k));
            grad.addColorStop(1, shade(spec.color, p.k * 0.78));
            g.fillStyle = grad;
            if (P) g.fill(P); else { g.beginPath(); SHAPES[shape.kind](g, shape); g.fill(); }
            g.lineWidth = 0.02; g.strokeStyle = shade(spec.color, p.k * 0.55);   // edge: a slightly darker rim separates overlapping leaves
            g.globalAlpha = 0.5; if (P) g.stroke(P); else g.stroke(); g.globalAlpha = 1;
            g.lineWidth = 0.025; g.strokeStyle = shade(spec.color, p.k * 0.62);   // midrib
            g.beginPath(); g.moveTo(0, 0); g.lineTo(0.9, 0); g.stroke();
            if (kind === 'ovate' || kind === 'round' || kind === 'lobed' || kind === 'oblong' || kind === 'heart') {   // side veins
              g.lineWidth = 0.012; g.globalAlpha = 0.55;
              g.beginPath();
              for (vi = 1; vi <= 3; vi++) { t = vi * 0.2; for (sd = -1; sd <= 1; sd += 2) { g.moveTo(t, 0); g.lineTo(t + 0.17, sd * 0.2); } }
              g.stroke();
              g.globalAlpha = 1;
            }
          }
          g.restore();
        });
      }

      // ---- the plant leaf painters ----
      // Frame of all of them: x in [-1, 1] across the leaf, y in [0, len] from the base to the tip, 1 unit = half the leaf's width (so x and y have the
      // same scale on the real blade). len = 2 * aspect. color = the neutral fill (the plant's vertex colour multiplies it).

      function leaf_w(s, t, teeth) {   // half width (0..1) of a 'simple' leaf at t = 0..1 along it
        var wp = s.widest === undefined ? 0.4 : s.widest, w, u, f, tooth;
        if (t <= wp) { u = t / wp; w = Math.pow(Math.sin(u * Math.PI / 2), s.base === undefined ? 0.8 : s.base); }
        else { u = (1 - t) / (1 - wp); w = Math.pow(Math.sin(u * Math.PI / 2), s.tip === undefined ? 1 : s.tip); }
        w *= (s.width === undefined ? 0.96 : s.width);
        if (teeth && s.teeth > 0) {
          f = t * s.teeth;
          tooth = s.tooth === 'round' ? Math.abs(Math.sin(Math.PI * f)) - 0.5 : (f - Math.floor(f)) - 0.5;
          w *= 1 + (s.tooth_amp === undefined ? 0.07 : s.tooth_amp) * tooth * 2;
        }
        return Math.min(1, Math.max(0, w));
      }
      function outline(g, s, len) {
        var N = 80, i, t;
        g.beginPath(); g.moveTo(0, 0);
        for (i = 1; i <= N; i++) { t = i / N; g.lineTo(leaf_w(s, t, true), t * len); }
        for (i = N - 1; i >= 1; i--) { t = i / N; g.lineTo(-leaf_w(s, t, true), t * len); }
        g.closePath();
      }
      function cross_gradient(g, color, edge, fold) {   // lighter in the middle, darker to the edges; fold lights one flank and shades the other
        var grad = g.createLinearGradient(-1, 0, 1, 0);
        grad.addColorStop(0, shade(color, 1 - edge + fold));
        grad.addColorStop(0.5, shade(color, 1));
        grad.addColorStop(1, shade(color, 1 - edge - fold));
        return grad;
      }

      // kind 'blade' (grass): edge, fold (0..0.4: a keeled blade lit on one flank), veins (parallel fine veins), vein (their shade), vein_w, rib (midrib width), rib_shade (> 1 a light rib, < 1 a dark crease)
      function paint_blade(g, s, color, len, rand) {
        var n = s.veins || 0, i, x;
        g.fillStyle = cross_gradient(g, color, s.edge === undefined ? 0.12 : s.edge, s.fold || 0);
        g.fillRect(-1, 0, 2, len);
        if (n > 0) {
          g.strokeStyle = shade(color, s.vein === undefined ? 0.85 : s.vein); g.lineWidth = s.vein_w || 0.05;
          g.beginPath();
          for (i = 0; i < n; i++) { x = -0.86 + 1.72 * (i + 0.5) / n + (rand() - 0.5) * 0.04; g.moveTo(x, 0); g.lineTo(x, len); }
          g.stroke();
        }
        if (s.rib > 0) {
          g.strokeStyle = shade(color, s.rib_shade === undefined ? 1.1 : s.rib_shade); g.lineWidth = s.rib;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len); g.stroke();
        }
      }

      // kind 'simple': the outline is widest at 'widest' (0..1 along the leaf); 'base' / 'tip' are the exponents of the profile on each side (< 1 full and round, > 1 narrow and pointed);
      // width (max half width, 0..1); teeth (count along the leaf), tooth ('saw' | 'round'), tooth_amp; par (pairs of parallel veins that follow the outline), pin (pairs of pinnate veins),
      // vsweep (how far along a pinnate vein runs, as a fraction of the leaf); rib (midrib width), rib_shade, vein (vein shade), vein_w, edge, fold (as in blade), rim (shade of the outline)
      function paint_simple(g, s, color, len, rand) {
        var vein = shade(color, s.vein === undefined ? 0.72 : s.vein), i, j, t, t1, x, y, y0, side, f, vs, rw;
        outline(g, s, len);
        g.fillStyle = cross_gradient(g, color, s.edge === undefined ? 0.1 : s.edge, s.fold || 0); g.fill();
        g.save();
        outline(g, s, len); g.clip();
        g.strokeStyle = vein; g.lineWidth = s.vein_w || 0.05; g.lineCap = 'round';
        if (s.par > 0) {
          for (j = 1; j <= s.par; j++) {
            f = j / (s.par + 0.6);
            for (side = -1; side <= 1; side += 2) {
              g.beginPath();
              for (i = 0; i <= 24; i++) { t = 0.02 + 0.92 * i / 24; x = side * f * leaf_w(s, t, false); y = t * len; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
              g.stroke();
            }
          }
        }
        if (s.pin > 0) {
          vs = s.vsweep === undefined ? 0.12 : s.vsweep;
          for (i = 0; i < s.pin; i++) {
            t = 0.05 + 0.8 * i / s.pin; t1 = Math.min(0.96, t + vs); y0 = t * len; y = t1 * len;
            for (side = -1; side <= 1; side += 2) {
              x = side * leaf_w(s, t1, false) * 0.94;
              g.beginPath(); g.moveTo(0, y0); g.quadraticCurveTo(x * 0.25, y0 + (y - y0) * 0.65, x, y); g.stroke();
            }
          }
        }
        rw = s.rib === undefined ? 0.1 : s.rib;
        if (rw > 0) {   // the midrib, tapering to the tip
          g.fillStyle = shade(color, s.rib_shade === undefined ? 1.12 : s.rib_shade);
          g.beginPath(); g.moveTo(-rw, 0); g.lineTo(rw, 0); g.lineTo(rw * 0.2, len * 0.97); g.lineTo(-rw * 0.2, len * 0.97); g.closePath(); g.fill();
        }
        g.restore();
        outline(g, s, len);
        g.strokeStyle = shade(color, s.rim === undefined ? 0.8 : s.rim); g.lineWidth = 0.04; g.globalAlpha = 0.6; g.stroke(); g.globalAlpha = 1;
      }

      function leaflet_path(g, shape, L, hw) {   // a leaflet along +y of the current frame, L long, 2 * hw wide
        if (shape === 'tooth') { g.moveTo(-hw, 0); g.lineTo(0, L); g.lineTo(hw, 0); }
        else { g.moveTo(0, 0); g.quadraticCurveTo(2 * hw, L * 0.5, 0, L); g.quadraticCurveTo(-2 * hw, L * 0.5, 0, 0); }
        g.closePath();
      }
      // One pinnate frond with its rachis along +y, R long. Level 0 is the leaf, o.len is then in half-widths; the leaflets of o.sub (level 1) are fronds of their own
      // whose o.len is a fraction of the length of the pinna they sit on.
      function draw_pinnate(g, o, R, level, tone, rand) {
        var top = level === 0, n = o.pairs || 6, start = o.start === undefined ? 0.06 : o.start, endgap = o.end === undefined ? 0.1 : o.end;
        var taper = o.taper || 0, angle = o.angle === undefined ? 1.1 : o.angle, lwr = o.lw === undefined ? 0.4 : o.lw;
        var Lbase = top ? o.len : o.len * R, shape = o.shape || 'lens';
        var i, side, t, s, Lf, a, ca, sa, Lt;
        g.fillStyle = tone.fill; g.strokeStyle = tone.vein; g.lineWidth = o.outline_w || 0.03;
        if (o.core > 0) { g.beginPath(); leaflet_path(g, 'lens', R * 0.98, o.core); g.fill(); }
        for (i = 0; i < n; i++) {
          t = start + (1 - start - endgap) * (n > 1 ? i / (n - 1) : 0);
          s = (t - start) / (1 - start);
          for (side = -1; side <= 1; side += 2) {
            Lf = Lbase * (1 - taper * s) * (1 + (rand() - 0.5) * 0.1);
            a = angle + (rand() - 0.5) * 0.12; ca = Math.cos(a); sa = Math.sin(a);
            g.save();
            g.transform(ca, -side * sa, side * sa, ca, 0, t * R);   // the pinna's own frame: +y along the pinna, no mirroring
            if (o.sub && top) draw_pinnate(g, o.sub, Lf, 1, tone, rand);
            else { g.beginPath(); leaflet_path(g, shape, Lf, lwr * Lf / 2); g.fill(); if (o.outline !== false) g.stroke(); }
            g.restore();
          }
        }
        if (o.terminal) {
          Lt = Math.max(Lbase * 0.25, Lbase * (1 - taper) * 1.1);
          g.save(); g.translate(0, R - Lt); g.beginPath(); leaflet_path(g, shape, Lt, lwr * Lt / 2); g.fill(); if (o.outline !== false) g.stroke(); g.restore();
        }
        g.strokeStyle = tone.rib; g.lineWidth = o.rib === undefined ? (top ? 0.08 : 0.04) : o.rib; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, R * (o.terminal ? 0.97 : 0.95)); g.stroke();
      }
      // kind 'pinnate': pairs, start / end (where along the rachis the first / last pair sits, 0..1), len (leaflet length, in half-widths), lw (leaflet width / length), angle (leaflet direction from the
      // rachis, radians; > 1.57 points back to the base), taper (0..1 how much shorter the leaflets get towards the tip), shape ('lens' | 'tooth'), core (half width of a blade joining the leaflets: a lobed leaf),
      // terminal (a leaflet at the tip), rib, outline (false = no outline), vein / rib_shade (shades), sub = { ... } the same again, so each pinna is a pinnate frond (ferns)
      function paint_pinnate(g, s, color, len, rand) {
        var tone = { fill: shade(color, 1), vein: shade(color, s.vein === undefined ? 0.72 : s.vein), rib: shade(color, s.rib_shade === undefined ? 0.8 : s.rib_shade) };
        g.lineJoin = 'round';
        draw_pinnate(g, s, len, 0, tone, rand);
      }

      // kind 'trifoliate' (clover): a terminal leaflet and two lateral ones on thin stalks; r (leaflet radius, half-widths), chevron (the pale V on each leaflet)
      function paint_trifoliate(g, s, color, len, rand) {
        var r = Math.min(s.r || 0.5, len * 0.18), i, spot;
        var spots = [{ x: -0.45, y: len * 0.40, rot: 0.35 }, { x: 0.45, y: len * 0.40, rot: -0.35 }, { x: 0, y: len * 0.76, rot: 0 }];   // the terminal leaflet last, on top
        g.strokeStyle = shade(color, 0.8); g.lineWidth = 0.07; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(0, 0); g.lineTo(0, spots[2].y - r * 0.8);
        g.moveTo(0, len * 0.28); g.lineTo(-0.3, spots[0].y - r * 0.3);
        g.moveTo(0, len * 0.28); g.lineTo(0.3, spots[1].y - r * 0.3);
        g.stroke();
        for (i = 0; i < 3; i++) {
          spot = spots[i];
          g.save();
          g.translate(spot.x, spot.y); g.rotate(spot.rot); g.scale(1, 0.9);
          g.fillStyle = shade(color, 0.86);
          g.beginPath(); g.arc(0, 0, r, 0, TWO_PI); g.fill();
          g.strokeStyle = shade(color, 0.62); g.lineWidth = 0.035;
          g.beginPath(); g.moveTo(0, -r * 0.9); g.lineTo(0, r * 0.7); g.stroke();
          if (s.chevron !== false) {
            g.strokeStyle = shade([255, 255, 255], 1); g.lineWidth = 0.075; g.lineJoin = 'round'; g.lineCap = 'round'; g.globalAlpha = 0.95;
            g.beginPath(); g.moveTo(-r * 0.6, -r * 0.3); g.lineTo(0, r * 0.1); g.lineTo(r * 0.6, -r * 0.3); g.stroke();
            g.globalAlpha = 1;
          }
          g.globalCompositeOperation = 'destination-out';   // the notch in the tip of the leaflet
          g.beginPath(); g.moveTo(-r * 0.2, r * 1.1); g.lineTo(0, r * 0.72); g.lineTo(r * 0.2, r * 1.1); g.closePath(); g.fill();
          g.restore();
        }
      }

      // kind 'parted' (buttercup): lobes lobes (default 3) fanning from near the base, spread (radians between neighbours), shrink (how much shorter the outer lobes are), lw, hw_max, base_y, vein
      function paint_parted(g, s, color, len, rand) {
        var n = s.lobes || 3, spread = s.spread || 0.32, base = len * (s.base_y === undefined ? 0.1 : s.base_y);
        var mid = (n - 1) / 2, hmax = s.hw_max || 0.7, i, m, ang, L, hw, order = [], k;
        g.fillStyle = shade(color, 1); g.strokeStyle = shade(color, s.vein === undefined ? 0.72 : s.vein); g.lineWidth = 0.04; g.lineJoin = 'round'; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, base + 0.1); g.stroke();
        for (i = 0; i < n; i++) order.push(i);
        order.sort(function (p, q) { return Math.abs(q - mid) - Math.abs(p - mid); });   // the outer lobes first, the middle one on top
        for (k = 0; k < n; k++) {
          i = order[k];
          ang = (i - mid) * spread; m = mid > 0 ? Math.abs(i - mid) / mid : 0;
          L = (len - base) * (1 - (s.shrink === undefined ? 0.35 : s.shrink) * m); hw = Math.min(hmax, (s.lw || 0.3) * L / 2);
          g.save();
          g.transform(Math.cos(ang), -Math.sin(ang), Math.sin(ang), Math.cos(ang), 0, base);
          g.beginPath(); leaflet_path(g, 'lens', L, hw); g.fill(); g.stroke();
          g.beginPath(); g.moveTo(0, 0); g.lineTo(0, L * 0.9); g.stroke();
          g.restore();
        }
      }

      function paint_leaf(g, spec, w, h, rand) {
        var A = spec.aspect > 0 ? spec.aspect : 2, len = 2 * A, color = spec.color || [226, 226, 226];
        g.setTransform(w * 0.5, 0, 0, -h / len, w * 0.5, h);   // canvas pixels <- leaf frame (y flipped: the base is the bottom edge, like the twig cards)
        if (spec.kind === 'blade') paint_blade(g, spec, color, len, rand);
        else if (spec.kind === 'simple') paint_simple(g, spec, color, len, rand);
        else if (spec.kind === 'pinnate') paint_pinnate(g, spec, color, len, rand);
        else if (spec.kind === 'trifoliate') paint_trifoliate(g, spec, color, len, rand);
        else paint_parted(g, spec, color, len, rand);
      }

      // ---- the canvas ----
      // twig cards are square; a plant leaf card is as wide as its blade needs: size / aspect, rounded to a power of two (32 .. size), size high
      function dims(spec, size) {
        var h = size || 256, w = h, target;
        if (PLANT_KINDS.hasOwnProperty(spec.kind)) {
          target = h / (spec.aspect > 0 ? spec.aspect : 2);
          w = 32;
          while (w * 1.5 < target && w < h) w *= 2;
          if (w > h) w = h;
        }
        return { w: w, h: h };
      }
      function paint(g, id, spec, w, h, style) {
        var rand = rng(seed_of(id, spec));
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0;
        g.clearRect(0, 0, w, h);
        if (PLANT_KINDS.hasOwnProperty(spec.kind)) paint_leaf(g, spec, w, h, rand); else paint_twig(g, spec, w, rand, style);
        g.setTransform(1, 0, 0, 1, 0, 0);
      }
      function acquire(w, h) {   // the one canvas all pixels() calls share (it is resized only when a card needs another size)
        var c;
        if (!shared) {
          c = document.createElement('canvas');
          c.setAttribute("style","position:absolute;left:0;top:0;")
          //document.body.appendChild(c);
          
          shared = { canvas: c, g: c.getContext('2d', { willReadFrequently: true }), w: 0, h: 0 };   // (a canvas in the CPU's memory: reading the pixels of a canvas of the GPU's costs 0.4 s each)

          
        }
        if (shared.w !== w || shared.h !== h) { shared.canvas.width = w; shared.canvas.height = h; shared.w = w; shared.h = h; }
    //   console.log("acquire", shared);
        return shared;
      }

      // a canvas of its own (to keep or draw somewhere); pixels() is the cheap way to get the image to a texture
      function create(src, size, style) {
        var r = resolve(src), d = dims(r.spec, size), canvas = document.createElement('canvas');
        canvas.width = d.w; canvas.height = d.h;
        paint(canvas.getContext('2d', { willReadFrequently: true }), r.id, r.spec, d.w, d.h, style);
        return canvas;
      }
      // the image of a card: painted on the shared canvas, read once, kept: asking again for the same id and size returns the same object
      function pixels(src, size, style) {
        var r = resolve(src), d = dims(r.spec, size), key = r.key + '@' + d.h + (style ? '#' + JSON.stringify(style) : ''), hit = cache[key], s, img;
        if (hit) return hit;
        s = acquire(d.w, d.h);
        paint(s.g, r.id, r.spec, d.w, d.h, style);
        img = s.g.getImageData(0, 0, d.w, d.h);
        hit = cache[key] = { width: d.w, height: d.h, data: new Uint8Array(img.data.buffer) };
        return hit;
      }
      function forget(src, size, style) {   // drop one card's cached pixels (a page that has put them on the GPU does not need the copy)
        var r = resolve(src), d = dims(r.spec, size);
        delete cache[r.key + '@' + d.h + (style ? '#' + JSON.stringify(style) : '')];
      }
      function clear_cache(release) {
        cache = {};
        if (release) { shared = null; shape_paths = {}; }
      }

      var KINDS = { twig: Object.keys(SHAPES).concat(['needle', 'feather', 'frond', 'blossom']), leaf: Object.keys(PLANT_KINDS) };
      return { SPECS: SPECS, KINDS: KINDS, register: register, register_presets: register_presets, create: create, pixels: pixels, forget: forget, clear_cache: clear_cache };
    })();

    // Procedural bark textures for tree trunks (see tree_build_trunk in tree_system.cpp).
    //
    // A trunk ring has u running round the trunk (mirrored: 0 -> 1 -> 0, so there is no seam) and v along the branch, so a
    // bark texture is an ordinary repeating, tileable image. Each style paints a tileable height field, from which two
    // images are made:
    //   albedo  RGB brightness (grey-ish: the species colour comes from the trunk's vertex colour, which multiplies it),
    //           darker in the crevices, plus a style colour (the white of a birch with its dark lenticels, ...)
    //   normal  tangent-space normal map of the height field (OpenGL convention: +x along u, +y along v), the "bump"
    //
    // bark_textures.pixels(style, size, seed) -> { width, height, albedo: Uint8Array RGBA, normal: Uint8Array RGBA }
    //   row 0 is v = 0, which is also GL's first row: upload as is (engine.textures.create({ source }), repeat wrapping)
    // bark_textures.STYLES                    -> the style names
    //
    // No DOM needed (plain arrays), deterministic: the same (style, size, seed) gives the same pixels.
    var bark_textures = (function () {
      function hash2(ix, iy, seed) {
        var h = imul(ix | 0, 374761393) ^ imul(iy | 0, 668265263) ^ imul(seed | 0, 1442695041);
        h = imul(h ^ (h >>> 13), 1274126177);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
      }
      var smooth = function (a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      var mix = function (a, b, t) { return a + (b - a) * t; };

      // value noise on a lattice of px x py cells that wraps, so it tiles over x, y in [0, 1)
      function vnoise(x, y, px, py, seed) {
        var fx = x * px, fy = y * py, ix = Math.floor(fx), iy = Math.floor(fy);
        var tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        var x0 = ((ix % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((iy % py) + py) % py, y1 = (y0 + 1) % py;
        return mix(mix(hash2(x0, y0, seed), hash2(x1, y0, seed), sx), mix(hash2(x0, y1, seed), hash2(x1, y1, seed), sx), sy);
      }
      function fbm(x, y, px, py, octaves, seed) {
        var sum = 0, amp = 0.5, norm = 0, o;
        for (o = 0; o < octaves; o++) {
          sum += amp * vnoise(x, y, px, py, seed + o * 31);
          norm += amp; amp *= 0.5; px *= 2; py *= 2;
        }
        return sum / norm;
      }
      // tileable cellular noise on cx x cy cells (cells are stretched when cx != cy): [nearest, second nearest] distance in cell units
      function worley(x, y, cx, cy, seed) {
        var fx = x * cx, fy = y * cy, ix = Math.floor(fx), iy = Math.floor(fy);
        var d1 = 9, d2 = 9, dx, dy, gx, gy, wx, wy, ex, ey, d;
        for (dy = -1; dy <= 1; dy++) {
          for (dx = -1; dx <= 1; dx++) {
            gx = ix + dx; gy = iy + dy; wx = ((gx % cx) + cx) % cx; wy = ((gy % cy) + cy) % cy;
            ex = gx + 0.15 + 0.7 * hash2(wx, wy, seed) - fx; ey = gy + 0.15 + 0.7 * hash2(wx, wy, seed + 77) - fy;
            d = Math.sqrt(ex * ex + ey * ey);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
          }
        }
        return [d1, d2];
      }

      // Every style: fn(x, y, seed, out) writes out[0] = height (1 = top of a ridge, 0 = bottom of a crevice) and
      // out[1] = a 0..1 mask that blends to the style's second colour. bump: normal-map slope; lo/hi: albedo for crevice / ridge top.
      var STYLES = {
        // long meandering fissures between ridges that peter out and break across: oak, elm, walnut
        furrowed: {
          bump: 7, lo: [0.34, 0.31, 0.29], hi: [1.0, 0.96, 0.92],
          fn: function (x, y, s, o) {
            var fx = 7, warp = (fbm(x, y, 2, 3, 3, s + 5) - 0.5) * 0.9 + (fbm(x, y, 6, 12, 2, s + 6) - 0.5) * 0.25;
            var sn = Math.abs(Math.sin(Math.PI * fx * (x + warp / fx * 2)));              // 0 along the fissure lines, 1 on the ridge middles
            var width = 0.25 + 0.5 * fbm(x, y, 5, 5, 2, s + 7);                            // fissure width varies along its length
            var live = smooth(0.3, 0.55, fbm(x, y, 8, 4, 2, s + 8));                       // some fissures fade out
            var h = 1 - (1 - smooth(0.0, width, sn)) * (0.35 + 0.65 * live);
            h *= 1 - 0.6 * smooth(0.72, 0.88, vnoise(x + warp * 0.1, y, 14, 18, s + 9)) * (1 - sn * 0.5);   // short cross cracks
            h = h * 0.86 + 0.14 * fbm(x, y, 44, 22, 3, s + 13);
            o[0] = h; o[1] = 0;
          }
        },
        // the same with wide, deep valleys: old oaks, cork oak, douglas fir
        deep_furrowed: {
          bump: 10, lo: [0.28, 0.25, 0.23], hi: [1.0, 0.95, 0.9],
          fn: function (x, y, s, o) {
            var fx = 4, warp = (fbm(x, y, 2, 3, 3, s + 5) - 0.5) * 1.1 + (fbm(x, y, 5, 9, 2, s + 6) - 0.5) * 0.3;
            var sn = Math.abs(Math.sin(Math.PI * fx * (x + warp / fx * 2)));
            var width = 0.4 + 0.45 * fbm(x, y, 4, 4, 2, s + 7);
            var live = smooth(0.2, 0.5, fbm(x, y, 6, 3, 2, s + 8));
            var h = 1 - (1 - smooth(0.0, width, sn)) * (0.45 + 0.55 * live);
            h *= 1 - 0.7 * smooth(0.7, 0.86, vnoise(x, y, 10, 8, s + 9)) * (1 - sn * 0.4);
            h = h * 0.84 + 0.16 * fbm(x, y, 32, 14, 3, s + 13);
            o[0] = h; o[1] = 0;
          }
        },
        // criss-crossing ridges forming diamonds: ash, hickory, date palm leaf bases
        diamond: {
          bump: 8, lo: [0.34, 0.32, 0.30], hi: [1.0, 0.97, 0.93],
          fn: function (x, y, s, o) {
            var w1 = fbm(x, y, 4, 4, 2, s + 3) - 0.5, w2 = fbm(x + 0.5, y, 4, 4, 2, s + 8) - 0.5;
            var a = Math.sin(6.2832 * (4 * x + 3 * y) + w1 * 5), b = Math.sin(6.2832 * (4 * x - 3 * y) + w2 * 5);
            var h = smooth(0.04, 0.55, Math.min(Math.abs(a), Math.abs(b)));
            h = h * 0.85 + 0.15 * fbm(x, y, 36, 36, 3, s + 13);
            o[0] = h; o[1] = 0;
          }
        },
        // one family of slanted, twisting ridges: sweet chestnut, black locust, olive
        twisted: {
          bump: 8, lo: [0.32, 0.30, 0.28], hi: [1.0, 0.96, 0.92],
          fn: function (x, y, s, o) {
            var w = fbm(x, y, 3, 5, 3, s + 4) - 0.5;
            var a = Math.sin(6.2832 * (5 * x + 1 * y) + w * 10);          // (only a slight slant: u is mirrored round the trunk, so a strong one would show as chevrons)
            var h = smooth(-0.7, 0.35, a);
            h *= 1 - 0.5 * smooth(0.7, 0.9, vnoise(x, y, 12, 18, s + 9)) * (1 - h * 0.5);
            h = h * 0.84 + 0.16 * fbm(x, y, 40, 40, 3, s + 13);
            o[0] = h; o[1] = 0;
          }
        },
        // overlapping scaly plates, taller than wide: pines, ponderosa
        plates: {
          bump: 8, lo: [0.32, 0.28, 0.26], hi: [1.0, 0.88, 0.78], c2: [1.0, 0.72, 0.5],
          fn: function (x, y, s, o) {
            var w = fbm(x, y, 3, 3, 2, s + 4) - 0.5, wl = worley(x + w * 0.05, y + w * 0.05, 6, 4, s), d1 = wl[0], d2 = wl[1];
            var edge = d2 - d1;
            var h = smooth(0.0, 0.34, edge);
            h = h * 0.7 + 0.3 * (1 - smooth(0.0, 0.85, d1));
            h += 0.05 * Math.sin(6.2832 * 40 * y + w * 30);              // fine horizontal growth lines on every plate
            o[0] = Math.min(1, Math.max(0, h)); o[1] = smooth(0.25, 0.7, h) * smooth(0.45, 0.8, vnoise(x, y, 5, 6, s + 2));   // warm plate tops
          }
        },
        // small scales, as many wide as tall: spruce, larch
        flakes: {
          bump: 9, lo: [0.34, 0.30, 0.30], hi: [1.0, 0.92, 0.88], c2: [0.86, 0.7, 0.66],
          fn: function (x, y, s, o) {
            var wl = worley(x, y, 12, 12, s), edge = wl[1] - wl[0], d1 = wl[0];
            var h = smooth(0.0, 0.26, edge) * 0.75 + 0.25 * (1 - smooth(0.0, 0.8, d1));
            h = h * 0.9 + 0.1 * fbm(x, y, 40, 40, 2, s + 13);
            o[0] = h; o[1] = smooth(0.4, 0.8, vnoise(x, y, 6, 6, s + 2)) * 0.6;
          }
        },
        // blocky, deeply checked: alligator juniper, persimmon, old cherry
        blocks: {
          bump: 11, lo: [0.26, 0.24, 0.22], hi: [1.0, 0.94, 0.88],
          fn: function (x, y, s, o) {
            var wl = worley(x, y, 6, 6, s), edge = wl[1] - wl[0];
            var h = smooth(0.03, 0.4, edge);
            h = h * 0.9 + 0.1 * fbm(x, y, 28, 28, 3, s + 13);
            o[0] = h; o[1] = 0;
          }
        },
        // long stringy fibres: redwood, cedar, bald cypress
        fibrous: {
          bump: 5, lo: [0.38, 0.33, 0.30], hi: [1.0, 0.92, 0.86],
          fn: function (x, y, s, o) {
            var w = fbm(x, y, 3, 2, 2, s + 4) - 0.5, xw = x + w * 0.12;
            var h = fbm(xw, y, 22, 2, 3, s) * 0.55 + fbm(xw, y, 9, 2, 3, s + 20) * 0.45;
            h = smooth(0.2, 0.8, h);
            h *= 1 - 0.5 * smooth(0.78, 0.92, vnoise(xw, y, 10, 5, s + 9));       // the odd tear across
            o[0] = h; o[1] = 0;
          }
        },
        // wide soft ridges with fibrous grooves: giant sequoia, coast redwood
        fluted: {
          bump: 6, lo: [0.34, 0.26, 0.22], hi: [1.0, 0.84, 0.72], c2: [0.9, 0.6, 0.45],
          fn: function (x, y, s, o) {
            var w = fbm(x, y, 2, 3, 3, s + 4) - 0.5, w2 = fbm(x, y, 5, 8, 2, s + 5) - 0.5;
            var r = 0.5 + 0.5 * Math.sin(6.2832 * 5 * (x + w * 0.25 + w2 * 0.06) + w2 * 3);
            var h = smooth(0.05, 0.85, r) * 0.55 + 0.45 * fbm(x + w * 0.1, y, 26, 3, 3, s);
            h *= 1 - 0.4 * smooth(0.74, 0.9, vnoise(x, y, 8, 6, s + 9));
            o[0] = h; o[1] = smooth(0.4, 0.9, vnoise(x, y, 3, 3, s + 2)) * 0.8;
          }
        },
        // smooth bark with dark horizontal lenticels: birch, cherry, aspen
        lenticels: {
          bump: 3, lo: [0.30, 0.29, 0.28], hi: [1.0, 1.0, 0.98], c2: [0.12, 0.11, 0.10],
          fn: function (x, y, s, o) {
            var h = 0.62 + 0.1 * (fbm(x, y, 3, 3, 3, s) - 0.5);
            var band = smooth(0.6, 0.78, vnoise(x, y, 3, 16, s + 6)) * 0.06;     // faint peeling bands
            var n = vnoise(x, y, 6, 44, s + 3) * 0.65 + vnoise(x, y, 14, 90, s + 4) * 0.35;
            var mark = smooth(0.62, 0.74, n);
            h = h - band - 0.4 * mark;
            o[0] = Math.min(1, Math.max(0, h)); o[1] = mark;
          }
        },
        // almost smooth with faint ring wrinkles and mottling: beech, hornbeam, baobab
        smooth: {
          bump: 3, lo: [0.62, 0.62, 0.58], hi: [1.0, 1.0, 0.97], c2: [0.72, 0.76, 0.7],
          fn: function (x, y, s, o) {
            var w = fbm(x, y, 3, 3, 2, s + 4) - 0.5;
            var h = 0.55 + 0.4 * (fbm(x, y, 5, 5, 5, s) - 0.5);
            h += 0.07 * Math.sin(6.2832 * 14 * y + w * 12) * vnoise(x, y, 4, 4, s + 6);   // faint ring wrinkles
            o[0] = Math.min(1, Math.max(0, h)); o[1] = smooth(0.35, 0.75, fbm(x, y, 4, 4, 4, s + 21));
          }
        },
        // flaking patches that show lighter bark below: plane tree, snow gum, sycamore
        patchy: {
          bump: 4, lo: [0.5, 0.48, 0.42], hi: [1.0, 0.98, 0.9], c2: [0.8, 0.82, 0.74],
          fn: function (x, y, s, o) {
            var n = fbm(x, y, 3, 4, 4, s), edge = smooth(0.46, 0.54, n);
            var h = 0.45 + 0.2 * edge + 0.12 * (fbm(x, y, 12, 12, 4, s + 7) - 0.5);
            o[0] = Math.min(1, Math.max(0, h)); o[1] = 1 - edge;
          }
        },
        // horizontal ring scars on a fibrous trunk: palms
        rings: {
          bump: 6, lo: [0.36, 0.32, 0.28], hi: [1.0, 0.93, 0.86],
          fn: function (x, y, s, o) {
            var w = fbm(x, y, 4, 4, 2, s + 4) - 0.5;
            var r = Math.abs(Math.sin(3.1416 * 10 * y + w * 2.5));
            var h = smooth(0.0, 0.7, r) * 0.6 + 0.4 * fbm(x, y, 28, 3, 3, s);
            o[0] = h; o[1] = 0;
          }
        },
        // thick corky, knobbly ridges: cork oak
        corky: {
          bump: 9, lo: [0.30, 0.25, 0.22], hi: [1.0, 0.86, 0.7], c2: [0.8, 0.6, 0.5],
          fn: function (x, y, s, o) {
            var w = fbm(x, y, 3, 3, 2, s + 4) - 0.5;
            var n = fbm(x + w * 0.2, y + w * 0.1, 5, 4, 5, s);
            var h = smooth(0.25, 0.75, n);
            h = h * 0.75 + 0.25 * fbm(x, y, 24, 24, 4, s + 13);
            o[0] = h; o[1] = 1 - smooth(0.2, 0.55, n);
          }
        }
      };

      function build_height(style, N, seed) {
        var def = STYLES[style] || STYLES.furrowed, h = new Float32Array(N * N), m = new Float32Array(N * N), o = [0, 0], i, j;
        for (j = 0; j < N; j++) {
          for (i = 0; i < N; i++) {
            def.fn(i / N, j / N, seed, o);
            h[j * N + i] = o[0]; m[j * N + i] = o[1];
          }
        }
        return { def: def, h: h, m: m };
      }

      function pixels(style, size, seed) {
        var N = size || 256, b = build_height(style, N, (seed || 1) * 7919), def = b.def, h = b.h, m = b.m;
        var albedo = new Uint8Array(N * N * 4), normal = new Uint8Array(N * N * 4), c2 = def.c2;
        var at = function (i, j) { return h[((j + N) % N) * N + ((i + N) % N)]; };
        var i, j, k, t, e, sh, r, g, bl, mk, dx, dy, nx, ny, nz, len;
        for (j = 0; j < N; j++) {
          for (i = 0; i < N; i++) {
            k = j * N + i; t = Math.min(1, Math.max(0, h[k])); e = k * 4;
            // albedo: crevices dark, ridge tops light, optionally blended towards the style's second colour
            sh = Math.pow(t, 0.8);
            r = mix(def.lo[0], def.hi[0], sh); g = mix(def.lo[1], def.hi[1], sh); bl = mix(def.lo[2], def.hi[2], sh);
            if (c2) {
              mk = m[k];
              if (style === "lenticels") { r = mix(r, c2[0], mk); g = mix(g, c2[1], mk); bl = mix(bl, c2[2], mk); }      // lenticels are dark outright
              else { r = mix(r, r * c2[0], mk * 0.6); g = mix(g, g * c2[1], mk * 0.6); bl = mix(bl, bl * c2[2], mk * 0.6); }
            }
            albedo[e] = Math.round(255 * Math.min(1, r)); albedo[e + 1] = Math.round(255 * Math.min(1, g)); albedo[e + 2] = Math.round(255 * Math.min(1, bl)); albedo[e + 3] = 255;
            // normal map from the height field (central differences over wrapped neighbours)
            dx = (at(i + 1, j) - at(i - 1, j)) * 0.5; dy = (at(i, j + 1) - at(i, j - 1)) * 0.5;
            nx = -dx * def.bump; ny = -dy * def.bump; nz = 1;
            len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            normal[e] = Math.round(255 * (nx / len * 0.5 + 0.5)); normal[e + 1] = Math.round(255 * (ny / len * 0.5 + 0.5)); normal[e + 2] = Math.round(255 * (nz / len * 0.5 + 0.5)); normal[e + 3] = 255;
          }
        }
        return { width: N, height: N, albedo: albedo, normal: normal };
      }

      // the noise this uses, tileable, for the other procedural textures of the environment (surfaces/surface_textures.js paints rock, soil, turf, masonry and planks the same way)
      return { pixels: pixels, STYLES: Object.keys(STYLES), noise: { hash2: hash2, smooth: smooth, mix: mix, vnoise: vnoise, fbm: fbm, worley: worley } };
    })();

    return { leaf: leaf_textures, bark: bark_textures };
})();
