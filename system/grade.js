packing()("happy_grade", function happy_grade() {
  "use strict";
  // GRADING THE GROUND UNDER THE ROADS. The heightmap is the ground's one truth (the shader draws it, the physics' bicubic ground is it, the creatures stand on it), and a road laid on it follows every bump of it: a car tilts across the road
  // and pitches along it. A real road is graded: cut into a hill and built up over a hollow, level across, smooth along. So the heightmap itself is changed, before the collision is made from it, and the roads, the physics and the picture
  // all agree. Pure: no engine, no DOM, Node 14 and the bundler's parser (no optional chaining, no ??, no class, no async).
  //
  //   apply(heights, N, W, Hh, items, opts) -> { heights: Float32Array (a new map; the one given is not touched), texels (how many changed), max_cut, max_fill (metres), skipped (centre points left alone: water) }
  //   heights: N x N texels in the map's units (metres = units x Hh), W: the metres a side of the world, items: the capsules of the roads, [ax, az, bx, bz, half width, walk, ...] (road_field.js: field.items; a junction disc has no length).
  //   opts: smooth (50: the metres the ground is smoothed over to find the road's height: a hill's bumps shorter than this are cut or filled, a long slope stays), max_dev (4: the most a road may be cut or built up, metres; the embankment of a
  //   bigger gap is left to a bridge), run (3: metres of embankment for every metre of cut or fill, the slope's run), min_blend (3), max_blend (36) (metres: the width of the embankment at least / at most), sea (0.18: the map's unit of the sea; centre
  //   points under it +0.3 m are not graded: a road on a ford or a shore is not raised out of the water), margin (0.6: texels of flat ground added to the cross section, so that the bilinear / bicubic patch under a road is level at a coarse map).
  //   A texel under a capsule's cross section (half width + walk + margin) takes the road's height; beyond it the ground returns to its own over the embankment (a smoothstep). Where several capsules reach a texel (the pieces of a curve, a crossing) their heights are averaged by their weights (the ground has no step where the winner would change) and the strength is the union of the weights. The road's height at a point of a centre line is the smoothed ground there
  //   (ONE field, so two roads that cross agree), held within max_dev of the ground's own height at that point. A texel whose own ground is further than max_dev from that height is corrected less and less (nothing at twice max_dev): a road is not an embankment across a valley, which is for a bridge. So no texel moves by more than about 1.3 max_dev.

  function blur_window(src, N, x0, z0, x1, z1, R) {                                           // a box blur twice (a tent), over the window [x0, x1] x [z0, z1] of an N x N map; the edges of the map go on (clamp)
    const w = x1 - x0 + 1, h = z1 - z0 + 1, a = new Float32Array(w * h), b = new Float32Array(w * h);
    const at = function (x, z) { return src[Math.max(0, Math.min(N - 1, z)) * N + Math.max(0, Math.min(N - 1, x))]; };
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) a[j * w + i] = at(x0 + i, z0 + j);
    const r1 = Math.max(1, Math.round(R * 0.6)), r2 = Math.max(1, R - r1 + 1);
    const pass = function (from, to, r, horizontal) {
      const len = horizontal ? w : h, lines = horizontal ? h : w, step = horizontal ? 1 : w, line = horizontal ? w : 1;
      for (let l = 0; l < lines; l++) {
        const base = l * line; let sum = 0;
        for (let k = -r; k <= r; k++) sum += from[base + Math.max(0, Math.min(len - 1, k)) * step];
        for (let k = 0; k < len; k++) {
          to[base + k * step] = sum / (2 * r + 1);
          sum += from[base + Math.min(len - 1, k + r + 1) * step] - from[base + Math.max(0, k - r) * step];
        }
      }
    };
    pass(a, b, r1, true); pass(b, a, r1, false); pass(a, b, r2, true); pass(b, a, r2, false);
    return { data: a, x0: x0, z0: z0, w: w, h: h };
  }

  function sample(map, N, u, v) {                                                              // bilinear at texel coordinates (u, v: a texel's centre is at its integer + 0.5 - 0.5 = integer), the edges go on
    const i = Math.max(0, Math.min(N - 2, Math.floor(u))), j = Math.max(0, Math.min(N - 2, Math.floor(v))), fu = Math.max(0, Math.min(1, u - i)), fv = Math.max(0, Math.min(1, v - j));
    return (map[j * N + i] * (1 - fu) + map[j * N + i + 1] * fu) * (1 - fv) + (map[(j + 1) * N + i] * (1 - fu) + map[(j + 1) * N + i + 1] * fu) * fv;
  }

  function apply(heights, N, W, Hh, items, opts) {
    opts = opts || {};
    const smooth = opts.smooth > 0 ? opts.smooth : 50, max_dev = (opts.max_dev >= 0 ? opts.max_dev : 4) / Hh, run = opts.run > 0 ? opts.run : 3;
    const texel = W / N, min_blend = Math.max(opts.min_blend > 0 ? opts.min_blend : 3, texel * 1.5), max_blend = Math.max(opts.max_blend > 0 ? opts.max_blend : 36, min_blend);
    const sea = opts.sea === undefined ? 0.18 : opts.sea, dry = sea + 0.3 / Hh, margin = (opts.margin === undefined ? 0.6 : opts.margin) * texel;
    const out = new Float32Array(heights); const res = { heights: out, texels: 0, max_cut: 0, max_fill: 0, skipped: 0 };
    if (!items || !items.length) return res;
    const to_u = function (x) { return (x / W + 0.5) * N - 0.5; };
    // the window of the map that the roads touch (the blur is made there only)
    let lo_x = 1e30, lo_z = 1e30, hi_x = -1e30, hi_z = -1e30, reach = 0;
    items.forEach(function (e) { lo_x = Math.min(lo_x, e[0], e[2]); hi_x = Math.max(hi_x, e[0], e[2]); lo_z = Math.min(lo_z, e[1], e[3]); hi_z = Math.max(hi_z, e[1], e[3]); reach = Math.max(reach, e[4] + (e[5] || 0)); });
    const R = Math.max(1, Math.round(smooth / texel / 2)), pad = reach + margin + max_blend + 2 * texel;
    const x0 = Math.max(0, Math.floor(to_u(lo_x - pad)) - 2 * R - 2), x1 = Math.min(N - 1, Math.ceil(to_u(hi_x + pad)) + 2 * R + 2), z0 = Math.max(0, Math.floor(to_u(lo_z - pad)) - 2 * R - 2), z1 = Math.min(N - 1, Math.ceil(to_u(hi_z + pad)) + 2 * R + 2);
    if (x1 <= x0 || z1 <= z0) return res;
    const S = blur_window(heights, N, x0, z0, x1, z1, R);
    const smooth_at = function (u, v) {                                                          // the smoothed ground at texel coordinates
      const i = Math.max(S.x0, Math.min(S.x0 + S.w - 2, Math.floor(u))) - S.x0, j = Math.max(S.z0, Math.min(S.z0 + S.h - 2, Math.floor(v))) - S.z0, fu = Math.max(0, Math.min(1, u - S.x0 - i)), fv = Math.max(0, Math.min(1, v - S.z0 - j));
      return (S.data[j * S.w + i] * (1 - fu) + S.data[j * S.w + i + 1] * fu) * (1 - fv) + (S.data[(j + 1) * S.w + i] * (1 - fu) + S.data[(j + 1) * S.w + i + 1] * fu) * fv;
    };
    const keep = new Float32Array(S.w * S.h).fill(1), sum_w = new Float32Array(S.w * S.h), sum_h = new Float32Array(S.w * S.h);          // (per texel: the product of what no capsule claims, the weights, the weighted heights)
    items.forEach(function (e) {
      const ax = e[0], az = e[1], bx = e[2], bz = e[3], flat = e[4] + (e[5] || 0) + margin, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
      const reach_e = flat + max_blend;
      const ia = Math.max(x0, Math.floor(to_u(Math.min(ax, bx) - reach_e))), ib = Math.min(x1, Math.ceil(to_u(Math.max(ax, bx) + reach_e))), ja = Math.max(z0, Math.floor(to_u(Math.min(az, bz) - reach_e))), jb = Math.min(z1, Math.ceil(to_u(Math.max(az, bz) + reach_e)));
      for (let j = ja; j <= jb; j++) {
        const pz = ((j + 0.5) / N - 0.5) * W;
        for (let i = ia; i <= ib; i++) {
          const px = ((i + 0.5) / N - 0.5) * W, t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
          const qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(px - qx, pz - qz);
          if (d > reach_e) continue;
          const qu = to_u(qx), qv = to_u(qz), own = sample(heights, N, qu, qv);                      // the ground's own height on the centre line, and the smoothed one
          if (own < dry) continue;                                                                    // (water: the road is not raised out of it)
          const hr = Math.max(own - max_dev, Math.min(own + max_dev, smooth_at(qu, qv)));
          const idx = (j - S.z0) * S.w + (i - S.x0), h0 = heights[j * N + i];
          if (h0 < dry) continue;                                                                     // (nor is the water beside a road raised: a lake keeps its bed)
          const blend = Math.max(min_blend, Math.min(max_blend, Math.abs(hr - h0) * Hh * run)), s = Math.max(0, d - flat) / blend;
          if (s >= 1) continue;
          let w = 1 - s * s * (3 - 2 * s);
          const gap = Math.abs(hr - h0) * Hh;                                                            // a texel of ground far from the road's height (a valley, a cliff beside it) is left to a bridge: the correction fades out between max_dev and twice it
          if (gap > max_dev * Hh) { const q = Math.min(1, (gap - max_dev * Hh) / Math.max(1e-6, max_dev * Hh)); w *= 1 - q * q * (3 - 2 * q); }
          if (!(w > 0)) continue;
          keep[idx] *= 1 - w; sum_w[idx] += w; sum_h[idx] += w * hr;
        }
      }
    });
    for (let j = 0; j < S.h; j++) for (let i = 0; i < S.w; i++) {
      const k = j * S.w + i, sw = sum_w[k]; if (!(sw > 0)) continue;
      const w = 1 - keep[k], at = (j + S.z0) * N + i + S.x0, h0 = heights[at], v = h0 + (sum_h[k] / sw - h0) * w, d = (v - h0) * Hh;
      if (Math.abs(d) < 1e-4) continue;
      out[at] = v; res.texels++;
      if (d < 0) res.max_cut = Math.max(res.max_cut, -d); else res.max_fill = Math.max(res.max_fill, d);
    }
    return res;
  }

  // the physics' ground (environment.cpp game_world_get_height): the Catmull-Rom bicubic through the texels, in metres; the tests and a page that wants the exact ground ask it
  function bicubic(heights, N, W, Hh, x, z) {
    const u = Math.min(1, Math.max(0, x / W + 0.5)), v = Math.min(1, Math.max(0, z / W + 0.5)), px = Math.min(N - 1, Math.max(0, u * N - 0.5)), pz = Math.min(N - 1, Math.max(0, v * N - 0.5));
    const cx = Math.floor(px), cz = Math.floor(pz), fx = px - cx, fz = pz - cz;
    const cl = function (a) { return Math.max(0, Math.min(N - 1, a)); };
    const cr = function (p0, p1, p2, p3, t) { return p1 + t * (0.5 * (p2 - p0) + t * ((p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3) + t * (0.5 * (p3 - p0) + 1.5 * (p1 - p2)))); };
    const row = function (j) { const o = cl(j) * N; return cr(heights[o + cl(cx - 1)], heights[o + cl(cx)], heights[o + cl(cx + 1)], heights[o + cl(cx + 2)], fx); };
    return cr(row(cz - 1), row(cz), row(cz + 1), row(cz + 2), fz) * Hh;
  }

  return { apply: apply, bicubic: bicubic };
});
