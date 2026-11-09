packing()("happy_eras", function happy_eras() {
  "use strict";
  // ERA PROFILES AND STYLE SHEETS: what a game's ERA and GENRE make of its look. Pure: no engine, no DOM: node tests it.
  //
  // An ERA is data (`PROFILES`): the look that its buildings can have, as FLAVOURS (a family of palettes: "timber and plaster", "stone and slate", "ochre and terracotta" ...: each role of a palette (wall, trim, roof, door, accent) is a box of hue, saturation
  // and lightness that a colour is drawn from), how much detail its buildings carry, and how fallen in they are. Two games of one era must not look alike, so a profile is not a look: a STYLE SHEET is. It is made from the profile, a seed and the game's genre:
  // the seed picks a primary flavour (and often a second one for the other districts), draws a few palettes from them, and the genre grades them (a survival game is washed out and dark, a farming game warm and bright, a military one drab). The same
  // (era, seed, genre) is always the same sheet. Which palette a building wears is decided by where it stands (`palette_for`: a district of 140 m is one or two palettes, so a street is coherent and a city is varied) and the number of palettes is small (4 by
  // default): a colour is a mesh of its own (elements.js has no per-instance colour yet), so the number of palettes is what a world's meshes cost.
  //
  //   PROFILES { era: { flavours: [{ id, title, weight, wall, trim, roof, door, accent }], details: [lo, hi], ruin } }      the ids are the ids of worldgen.ERAS; a role is [h0, h1, s0, s1, l0, l1] (hue in degrees 0 .. 360, saturation and lightness 0 .. 1)
  //   GENRE_GRADE { game: { sat, lum } }      what a kind of game does to every colour: saturation times `sat`, lightness plus `lum`
  //   style_sheet(era, seed, { genre?, count? }) -> { era, genre, seed, count, primary, secondary, flavours: [{ id, title }], palettes: [{ wall, trim, roof, door, accent, flavour }], details, ruin }      an unknown era throws and names the valid ones; count is held to 2 .. 8
  //   palette_for(sheet, x, z) -> { wall, trim, roof, door, accent }      the palette of the district a point is in (colours as [r, g, b], 0 .. 1)
  //   hsl_to_rgb(h, s, l) -> [r, g, b]      rgb_to_hsl(r, g, b) -> [h, s, l]      luma([r, g, b]) -> 0 .. 1      the helpers, for the panels and the tests
  // Node 14 and the bundler's parser: no optional chaining, no ??, no class.

  const clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  const r3 = function (v) { return Math.round(v * 1000) / 1000; };
  function hsl_to_rgb(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    const a = s * Math.min(l, 1 - l), f = function (n) { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [f(0), f(8), f(4)];
  }
  function rgb_to_hsl(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < 1e-9) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
    return [h, s, l];
  }
  const luma = function (c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };

  // a flavour: the roles are [h0, h1, s0, s1, l0, l1]
  const F = function (id, title, weight, wall, trim, roof, door, accent) { return { id: id, title: title, weight: weight, wall: wall, trim: trim, roof: roof, door: door, accent: accent }; };
  const PROFILES = {
    modern: {
      flavours: [
        F("concrete_glass", "Concrete and glass", 1.2, [200, 225, 0.04, 0.12, 0.52, 0.72], [200, 220, 0.02, 0.08, 0.80, 0.92], [210, 230, 0.04, 0.10, 0.18, 0.30], [200, 215, 0.40, 0.65, 0.25, 0.40], [170, 190, 0.45, 0.65, 0.35, 0.50]),
        F("brick", "Brick", 1.0, [6, 16, 0.38, 0.52, 0.34, 0.46], [30, 45, 0.08, 0.18, 0.76, 0.86], [210, 225, 0.06, 0.12, 0.20, 0.28], [130, 160, 0.25, 0.40, 0.18, 0.28], [8, 20, 0.50, 0.60, 0.30, 0.40]),
        F("pastel_suburb", "Pastel suburbs", 1.0, [28, 60, 0.28, 0.45, 0.74, 0.86], [40, 50, 0.05, 0.12, 0.90, 0.96], [8, 18, 0.42, 0.56, 0.34, 0.44], [200, 225, 0.40, 0.60, 0.30, 0.45], [150, 170, 0.20, 0.30, 0.30, 0.40]),
        F("whitewash", "Whitewash and terracotta", 0.8, [38, 50, 0.06, 0.14, 0.88, 0.95], [200, 215, 0.30, 0.50, 0.35, 0.50], [12, 18, 0.55, 0.65, 0.40, 0.50], [205, 220, 0.50, 0.65, 0.30, 0.42], [330, 350, 0.35, 0.50, 0.45, 0.55]),
        F("nordic", "Nordic timber", 0.8, [6, 12, 0.50, 0.62, 0.30, 0.40], [40, 50, 0.05, 0.10, 0.90, 0.95], [20, 30, 0.05, 0.15, 0.16, 0.24], [40, 50, 0.05, 0.10, 0.88, 0.94], [200, 215, 0.40, 0.55, 0.30, 0.40])
      ], details: [0.5, 0.9], ruin: 0
    },
    rustic: {
      flavours: [
        F("thatch", "Plaster and thatch", 1.2, [32, 44, 0.22, 0.36, 0.62, 0.74], [22, 30, 0.35, 0.45, 0.18, 0.26], [38, 46, 0.36, 0.48, 0.38, 0.48], [20, 28, 0.40, 0.55, 0.16, 0.24], [95, 120, 0.22, 0.35, 0.28, 0.38]),
        F("red_barn", "Red barns", 1.0, [4, 10, 0.50, 0.62, 0.28, 0.36], [40, 48, 0.05, 0.12, 0.88, 0.94], [210, 225, 0.05, 0.10, 0.22, 0.30], [4, 10, 0.50, 0.60, 0.24, 0.32], [95, 115, 0.20, 0.30, 0.30, 0.40]),
        F("fieldstone", "Fieldstone and slate", 1.0, [28, 40, 0.07, 0.16, 0.46, 0.58], [28, 36, 0.08, 0.14, 0.28, 0.36], [210, 225, 0.05, 0.10, 0.26, 0.34], [22, 30, 0.35, 0.50, 0.20, 0.30], [95, 110, 0.25, 0.35, 0.28, 0.36]),
        F("whitewash_slate", "Whitewash and slate", 0.9, [40, 50, 0.05, 0.12, 0.86, 0.93], [22, 30, 0.30, 0.40, 0.22, 0.30], [215, 225, 0.05, 0.10, 0.24, 0.32], [215, 230, 0.45, 0.60, 0.30, 0.40], [0, 8, 0.40, 0.50, 0.38, 0.46])
      ], details: [0.5, 0.9], ruin: 0
    },
    medieval: {
      flavours: [
        F("timber_tile", "Timber and plaster", 1.2, [36, 46, 0.18, 0.30, 0.72, 0.84], [20, 28, 0.35, 0.45, 0.14, 0.22], [8, 16, 0.40, 0.52, 0.30, 0.40], [18, 26, 0.40, 0.50, 0.14, 0.22], [95, 115, 0.25, 0.35, 0.28, 0.36]),
        F("stone_slate", "Stone and slate", 1.0, [30, 45, 0.05, 0.12, 0.44, 0.56], [28, 40, 0.05, 0.10, 0.30, 0.38], [210, 225, 0.05, 0.10, 0.24, 0.32], [22, 28, 0.35, 0.45, 0.18, 0.26], [0, 8, 0.50, 0.60, 0.30, 0.38]),
        F("ochre", "Ochre and terracotta", 0.9, [32, 40, 0.45, 0.58, 0.56, 0.66], [38, 46, 0.12, 0.20, 0.84, 0.90], [12, 18, 0.52, 0.62, 0.38, 0.48], [20, 28, 0.40, 0.50, 0.20, 0.28], [200, 215, 0.40, 0.50, 0.34, 0.42]),
        F("dark_wood", "Dark wood and turf", 0.9, [20, 28, 0.35, 0.48, 0.22, 0.30], [22, 30, 0.30, 0.40, 0.12, 0.18], [85, 105, 0.25, 0.38, 0.28, 0.36], [18, 24, 0.40, 0.50, 0.14, 0.20], [0, 8, 0.45, 0.55, 0.28, 0.36])
      ], details: [0.55, 1.0], ruin: 0
    },
    military: {
      flavours: [
        F("olive", "Olive and concrete", 1.2, [60, 90, 0.08, 0.18, 0.38, 0.50], [60, 80, 0.05, 0.10, 0.26, 0.34], [75, 100, 0.10, 0.20, 0.20, 0.28], [80, 100, 0.12, 0.20, 0.20, 0.26], [48, 56, 0.60, 0.75, 0.45, 0.52]),
        F("desert", "Desert sand", 1.0, [34, 42, 0.30, 0.42, 0.56, 0.66], [34, 42, 0.20, 0.30, 0.40, 0.50], [30, 38, 0.22, 0.32, 0.38, 0.46], [30, 38, 0.20, 0.30, 0.28, 0.34], [10, 20, 0.45, 0.55, 0.34, 0.42]),
        F("winter", "Winter grey", 0.9, [205, 220, 0.05, 0.10, 0.52, 0.62], [205, 215, 0.04, 0.08, 0.80, 0.88], [210, 222, 0.05, 0.10, 0.26, 0.34], [210, 222, 0.12, 0.20, 0.22, 0.28], [18, 28, 0.70, 0.80, 0.50, 0.56]),
        F("jungle", "Jungle drab", 0.9, [85, 110, 0.15, 0.26, 0.30, 0.40], [80, 100, 0.10, 0.18, 0.20, 0.28], [95, 120, 0.15, 0.25, 0.20, 0.28], [30, 38, 0.20, 0.30, 0.20, 0.26], [40, 50, 0.50, 0.60, 0.40, 0.46])
      ], details: [0.1, 0.35], ruin: 0
    },
    ruined: {
      flavours: [
        F("ash_rust", "Ash and rust", 1.2, [20, 30, 0.04, 0.10, 0.36, 0.48], [20, 30, 0.05, 0.10, 0.26, 0.34], [15, 25, 0.10, 0.20, 0.20, 0.28], [15, 22, 0.50, 0.65, 0.28, 0.36], [18, 24, 0.60, 0.75, 0.30, 0.38]),
        F("bleached", "Sun-bleached", 1.0, [36, 46, 0.10, 0.18, 0.62, 0.74], [38, 46, 0.08, 0.14, 0.76, 0.84], [28, 36, 0.10, 0.18, 0.40, 0.50], [190, 205, 0.20, 0.30, 0.40, 0.50], [10, 18, 0.45, 0.55, 0.40, 0.48]),
        F("overgrown", "Overgrown", 1.0, [70, 100, 0.12, 0.22, 0.32, 0.44], [60, 80, 0.10, 0.16, 0.24, 0.32], [90, 110, 0.14, 0.24, 0.22, 0.30], [25, 32, 0.30, 0.40, 0.20, 0.26], [100, 120, 0.30, 0.40, 0.30, 0.36]),
        F("scorched", "Scorched", 0.8, [18, 28, 0.06, 0.14, 0.18, 0.28], [18, 26, 0.05, 0.10, 0.12, 0.20], [18, 26, 0.05, 0.10, 0.10, 0.16], [10, 18, 0.30, 0.40, 0.16, 0.22], [14, 22, 0.70, 0.80, 0.34, 0.42])
      ], details: [0.3, 0.7], ruin: 0.8
    }
  };
  const ROLES = ["wall", "trim", "roof", "door", "accent"];
  // what a kind of game does to every colour (not said: no grade)
  const GENRE_GRADE = {
    city_action: { sat: 1.05, lum: 0 }, medieval: { sat: 1.0, lum: 0 }, survival: { sat: 0.55, lum: -0.08 }, military: { sat: 0.75, lum: -0.03 },
    farming: { sat: 1.12, lum: 0.03 }, island: { sat: 1.2, lum: 0.04 }, blank: { sat: 1.0, lum: 0 }
  };

  // a seeded stream (mulberry32) and a hash of three integers
  function stream(seed) {
    let a = (seed | 0) ^ 0x9e3779b9;
    const next = function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return next;
  }
  function hash3(a, b, c) {
    let h = Math.imul(a | 0, 0x85ebca6b) ^ Math.imul(b | 0, 0xc2b2ae35) ^ Math.imul(c | 0, 0x27d4eb2f);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const lerp = function (a, b, t) { return a + (b - a) * t; };
  const pick_weighted = function (rnd, list, skip) {
    let total = 0; list.forEach(function (f) { if (f !== skip) total += f.weight; });
    let t = rnd() * total, last = null;
    for (let i = 0; i < list.length; i++) { if (list[i] === skip) continue; last = list[i]; t -= list[i].weight; if (t <= 0) return list[i]; }
    return last;
  };

  // a colour from a role's box, graded; then a palette is fitted so that it can be read: the roof is not the wall's lightness, the trim stands out from the wall
  function draw_role(rnd, box, grade) {
    const h = lerp(box[0], box[1], rnd()), s = lerp(box[2], box[3], rnd()) * grade.sat, l = lerp(box[4], box[5], rnd()) + grade.lum;
    return [h, clamp(s, 0, 1), clamp(l, 0.04, 0.97)];
  }
  // the lightness of `b` is moved away from `a` (on the side it is on) until the two colours differ in luma by `min_d`; if a bound of lightness is reached first, from the other side
  const lum_of = function (c) { return luma(hsl_to_rgb(c[0], c[1], c[2])); };
  function separate(a, b, min_d) {
    const la = lum_of(a), l0 = b[2];
    if (Math.abs(lum_of(b) - la) >= min_d) return;
    const first = lum_of(b) === la ? (la > 0.5 ? -1 : 1) : (lum_of(b) > la ? 1 : -1);
    for (let k = 0; k < 2; k++) {
      const dir = k === 0 ? first : -first;
      b[2] = l0;
      for (let i = 0; i < 12; i++) { b[2] = clamp(b[2] + dir * 0.05, 0.04, 0.97); if (Math.abs(lum_of(b) - la) >= min_d) return; }
    }
  }
  function palette_from(rnd, flavour, grade) {
    const hsl = {};
    ROLES.forEach(function (r) { hsl[r] = draw_role(rnd, flavour[r], grade); });
    separate(hsl.wall, hsl.roof, 0.14); separate(hsl.wall, hsl.trim, 0.09);
    const pal = { flavour: flavour.id };
    ROLES.forEach(function (r) { pal[r] = hsl_to_rgb(hsl[r][0], hsl[r][1], hsl[r][2]).map(r3); });
    return pal;
  }

  function style_sheet(era, seed, o) {
    o = o || {};
    const prof = PROFILES[era];
    if (!prof) throw new Error("eras: no era `" + era + "` (" + Object.keys(PROFILES).join(", ") + ")");
    const sd = typeof seed === "number" && isFinite(seed) ? seed | 0 : 1, count = clamp(Math.round(typeof o.count === "number" && isFinite(o.count) ? o.count : 4), 2, 8);
    const grade = GENRE_GRADE[o.genre] || { sat: 1, lum: 0 }, rnd = stream((Math.imul(sd, 0x9e3779b1) + era.length * 40503 + era.charCodeAt(0) * 977) | 0);
    const primary = pick_weighted(rnd, prof.flavours, null), secondary = rnd() < 0.55 ? pick_weighted(rnd, prof.flavours, primary) : null;
    const nprimary = secondary ? Math.max(1, Math.ceil(count * 0.6)) : count, palettes = [];
    for (let i = 0; i < count; i++) palettes.push(palette_from(rnd, i < nprimary ? primary : secondary, grade));
    const used = {}, flavours = [];
    palettes.forEach(function (p) { if (!used[p.flavour]) { used[p.flavour] = 1; flavours.push({ id: p.flavour, title: prof.flavours.filter(function (f) { return f.id === p.flavour; })[0].title }); } });
    return { era: era, genre: GENRE_GRADE[o.genre] ? o.genre : null, seed: sd, count: count, primary: primary.id, secondary: secondary ? secondary.id : null, flavours: flavours, palettes: palettes, details: r3(lerp(prof.details[0], prof.details[1], rnd())), ruin: prof.ruin };
  }

  // the palette of the district a point stands in: districts are 140 m squares, and the first palettes are the commonest (so a district has one or two and a city has all of them)
  const DISTRICT = 140;
  function palette_for(sheet, x, z) {
    const u = hash3(Math.floor(x / DISTRICT), Math.floor(z / DISTRICT), sheet.seed), n = sheet.palettes.length, p = sheet.palettes[Math.min(n - 1, Math.floor(Math.pow(u, 1.5) * n))];
    return { wall: p.wall.slice(), trim: p.trim.slice(), roof: p.roof.slice(), door: p.door.slice(), accent: p.accent.slice() };
  }

  return { PROFILES: PROFILES, GENRE_GRADE: GENRE_GRADE, ROLES: ROLES, DISTRICT: DISTRICT, style_sheet: style_sheet, palette_for: palette_for, hsl_to_rgb: hsl_to_rgb, rgb_to_hsl: rgb_to_hsl, luma: luma };
});
