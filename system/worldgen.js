packing()("happy_worldgen", function happy_worldgen() {
  "use strict";
  // THE WORLD GENERATOR : from what the author answered (what kind of game, how big, how many cities, villages, farms ...) it finds the places for them on the ground the terrain made, makes what stands in each
  // (the city layout, a camp, a compound ...), joins them with roads and scatters the open ground. Here: the PLAN and the ROADS (pure geometry over a ground: no engine, no DOM: node tests them), and the kinds of game; what stands in a site is made by the
  // modules the host hands in (city.js, eras.js, structures.js) through `ctx`. Node 14 and the bundler's parser: no optional chaining, no ??, no class, no async functions.
  //
  //   GAMES { id: { title, blurb, preset, size, rivers, vegetation, sun, ambient, sites: { cities, towns, villages, farms, camps, outposts, ruins }, roads, nature, style } }      the kinds of game and what each starts from (the counts are for the game's own `size`: default_spec scales them by the area when another size is asked for)
  //   KINDS { city, town, village, farm, camp, outpost, ruin } -> { title, location_kind, radius: [lo, hi], flat (metres of free flat ground it needs), rank }
  //   default_spec(game, size?, seed?) -> spec      a spec is { game, size, preset, seed, rivers, cities, towns, villages, farms, camps, outposts, ruins, roads, nature (0 .. 1: kept in the spec, nothing scatters it now), vegetation, sun: { azimuth, elevation }, ambient, style }
  //   plan(spec, ground, o) -> { sites: [{ kind, name, x, z, r, seed }], notes, grid: { n, step } }      where each place goes: on flat, dry land, apart from the others, the biggest flat land to the cities. ground: { y(x, z) -> metres, land(x, z) -> bool, sea (metres) }
  //   connect(sites, ground, spec) -> { roads: [{ points: [[x, z] ...], width, kind: "highway"|"road"|"track", a, b }], notes }      the sites joined by roads (the least that joins them all, and a second road from every city): a way over the land that keeps off water and goes round steep ground, smoothed, from the edge of one site to the edge of the next
  //   rivers_for(spec) -> [river]      the rivers the terrain is given when the spec asks for them (a document's `terrain.rivers`): across the land, from one edge to another, wandering      spec.river_lines (the same list) makes plan and connect keep off them (roads cross them by BRIDGES: `connect` says where)
  //   stages(spec, ground, ctx) -> { stages: [{ label, run() -> { areas, elements, notes } }], sites, roads, notes }      the work of making the world, in pieces the editor can run one after another with a progress bar: build each site (the roads between the places are data: `roads`, with their bridges).
  //                                       ctx = { City, Eras, structures } (the modules); what the stages make is in WORLD metres, without ids: a list of elements for elements.js
  //   build_site(site, ctx) -> { areas, elements, notes }      one place: a city / town / village (city.js: its buildings are boxes in the colours of the era's style sheet), a farm (two boxes), an outpost (a walled compound of the recipes of structures.js); a camp and a ruin are an area and nothing in it
  //   rng(seed) -> next()      a seeded random stream (mulberry32): next(), next.range(lo, hi), next.int(lo, hi), next.pick(list)
  // Everything is deterministic in (spec, ground).
  //
  // THE SPEC IS THE WORLD. A world is made from its spec and nothing else, so the spec is also what is kept with the world (`genesis`) and what is shared:
  //   GEN_VERSION      the version of the generators (a number that goes up when what a spec makes changes)
  //   ERAS { id: { title, blurb, style } }, ERAS_PLANNED [[id, title]]      the looks the generators can make (style: kept in the spec) and the ones that are planned (shown, not chosen)
  //   QUESTIONS [{ id, group, title, kind: "choice" | "multi" | "number" | "toggle" | "text", options?, min?, max?, default, help }], QUESTION_GROUPS      what the wizard asks about play, story, characters, units, nature and effects; the answers are `spec.play[id]`
  //                                       and are kept with the world for the workspaces that use them (units, logic, flow): they do not change the land
  //   normalize_spec(input) -> { spec, notes }      any object (a spec from an older editor, from a code, from a hand) made into a whole spec: held to range, junk dropped and said, the defaults of its game filled in; only an unknown game or era throws
  //   encode_spec(spec, { fp? }) -> "HGW1-..."      a world code: the spec, the generator version and (when given) the fingerprint of what it made, as text that can be pasted anywhere, with a check against a lost character
  //   decode_spec(code) -> { spec, notes, gen, fp }      the other way (an Error that says what is wrong with a code that is not one); `notes` says when it was made by another generator version
  //   terrain_part(spec) -> { size, terrain: { preset, seed, params, height_scale, rivers }, sun, ambient, vegetation }      what of the environment document a spec decides (the editor lays it over the document's defaults, for the preview and for the world)
  //   seed_of(spec, "land" | "layout" | "nature" | "style") -> int      the land's seed (the terrain, the rivers), the layout's (where the places go, the roads, the cities), the nature's (the open ground's clutter) and the style's (the palettes of the buildings: eras.js);
  //                                       the last three (`spec.seed_layout`, `spec.seed_nature`, `spec.seed_style`) follow the land's unless the spec gives them, so the land can be kept while the places are thrown again, or the look again on the same places
  //   ctx.Eras (eras.js) is given to `stages` with the other modules: the buildings and the farms then wear the palettes of the era's style sheet, a district at a time
  //   fingerprint(locations) -> "8 hex"      what was made, as a number that two machines can compare (the locations and their things, ids left out)      terrain_print(ground, size) -> "8 hex"      the same for the ground (a grid of heights to the millimetre)

  const clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  const finite = function (v) { return typeof v === "number" && isFinite(v); };
  const rng = function (seed) {
    let a = (seed | 0) ^ 0x9e3779b9;
    const next = function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    next.range = function (lo, hi) { return lo + (hi - lo) * next(); };
    next.int = function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); };
    next.pick = function (list) { return list[Math.floor(next() * list.length)]; };
    return next;
  };

  const KINDS = {
    city: { title: "City", location_kind: "city", radius: [260, 600], flat: 260, rank: 4 },
    town: { title: "Town", location_kind: "town", radius: [130, 240], flat: 130, rank: 3 },
    village: { title: "Village", location_kind: "village", radius: [70, 120], flat: 70, rank: 2 },
    farm: { title: "Farm", location_kind: "farm", radius: [45, 80], flat: 45, rank: 1 },
    camp: { title: "Camp", location_kind: "camp", radius: [22, 40], flat: 22, rank: 0 },
    outpost: { title: "Outpost", location_kind: "outpost", radius: [30, 60], flat: 30, rank: 1 },
    ruin: { title: "Ruin", location_kind: "ruin", radius: [25, 60], flat: 25, rank: 0 }
  };
  const GAMES = {
    city_action: { title: "Open-world city action", blurb: "A big city with suburbs, towns along the highways and countryside between: cars, crowds, rooftops.", preset: "river_plains", size: 4096, rivers: true, vegetation: true, sun: { azimuth: 35, elevation: 50 }, ambient: 0.55,
      sites: { cities: 1, towns: 3, villages: 3, farms: 3, camps: 1, outposts: 0, ruins: 0 }, roads: true, nature: 0.5, style: "modern" },
    medieval: { title: "Medieval kingdom", blurb: "Villages and farms among woods and hills, a market town, ruins and camps off the road.", preset: "highlands", size: 4096, rivers: true, vegetation: true, sun: { azimuth: 60, elevation: 42 }, ambient: 0.5,
      sites: { cities: 0, towns: 2, villages: 6, farms: 6, camps: 3, outposts: 2, ruins: 3 }, roads: true, nature: 0.8, style: "medieval" },
    survival: { title: "Post-apocalypse survival", blurb: "A ruined town, scattered camps and outposts, wasteland between.", preset: "canyons", size: 4096, rivers: false, vegetation: false, sun: { azimuth: 200, elevation: 30 }, ambient: 0.45,
      sites: { cities: 0, towns: 1, villages: 3, farms: 1, camps: 6, outposts: 3, ruins: 6 }, roads: true, nature: 0.6, style: "ruined" },
    military: { title: "Military / shooter arena", blurb: "Fortified compounds, outposts and a base on open hills, joined by tracks.", preset: "plains", size: 2048, rivers: false, vegetation: true, sun: { azimuth: 120, elevation: 55 }, ambient: 0.55,
      sites: { cities: 0, towns: 0, villages: 1, farms: 0, camps: 3, outposts: 8, ruins: 2 }, roads: true, nature: 0.4, style: "military" },
    farming: { title: "Farming and village life", blurb: "A river valley of farms and a village or two, fields, fences and country roads.", preset: "lake_district", size: 2048, rivers: true, vegetation: true, sun: { azimuth: 80, elevation: 55 }, ambient: 0.6,
      sites: { cities: 0, towns: 1, villages: 3, farms: 8, camps: 0, outposts: 0, ruins: 0 }, roads: true, nature: 0.7, style: "rustic" },
    island: { title: "Island survival", blurb: "Islands with beaches and jungle, a few camps and a ruin; no towns.", preset: "tropical", size: 4096, rivers: false, vegetation: true, sun: { azimuth: 140, elevation: 65 }, ambient: 0.6,
      sites: { cities: 0, towns: 0, villages: 1, farms: 0, camps: 4, outposts: 1, ruins: 2 }, roads: false, nature: 0.8, style: "rustic" },
    blank: { title: "Blank world", blurb: "Only the land and the sky: build it yourself.", preset: "plains", size: 4096, rivers: false, vegetation: false, sun: { azimuth: 35, elevation: 55 }, ambient: 0.5,
      sites: { cities: 0, towns: 0, villages: 0, farms: 0, camps: 0, outposts: 0, ruins: 0 }, roads: false, nature: 0, style: "rustic" }
  };
  const SITE_KEYS = [["cities", "city"], ["towns", "town"], ["villages", "village"], ["farms", "farm"], ["camps", "camp"], ["outposts", "outpost"], ["ruins", "ruin"]];
  const NAMES_A = ["North", "South", "East", "West", "Old", "New", "High", "Low", "Red", "Green", "Black", "White", "Stone", "River", "Lake", "Oak", "Pine", "Iron", "Gold", "Silver", "Fox", "Wolf", "Raven", "Bear"];
  const NAMES_B = { city: ["port", "haven", "gate", "bridge", "ford", "city", "heights"], town: ["market", "ford", "ton", "brook", "field", "wick", "mill"], village: ["wick", "ham", "stead", "dale", "end", "green", "by"], farm: ["farm", "grange", "barn", "meadow", "holt"], camp: ["camp", "fire", "rest", "post"], outpost: ["post", "keep", "watch", "fort", "base"], ruin: ["ruins", "fall", "hold", "remains"] };

  // ---- the version of the generators: what a spec makes changes when a generator does, so a world code carries the version it was made by and says so when another opens it
  // 2 (2026-11-06): buildings wear the palettes of a style sheet (eras.js) when the editor gives the module, so a world's colours are not what version 1 made
  // 3 (2026-11-06): a building is ONE element (a recipe of the first repository's house kit, drawn as one mesh) and not its 45 modules: the same style, size and palette, but the look of its parts (and a ruin's holes) are the facade's
  // 4 (2026-11-09): buildings are plain boxes (the recipe `box`), a farm is two boxes, a camp and a ruin are only an area, nothing is scattered on the open ground and no road pieces are laid between the places: the same spec makes another world
  const GEN_VERSION = 4;

  // ---- the eras: the look of the buildings (and later of everything else). The ones the generators can make now are chosen in the wizard; the planned ones are shown there, muted
  const ERAS = {
    modern: { title: "Modern", blurb: "Concrete, glass and asphalt: suburbs, offices, warehouses, highways.", style: "modern" },
    rustic: { title: "Rustic / countryside", blurb: "Timber houses, barns, stone walls and dirt tracks.", style: "rustic" },
    medieval: { title: "Medieval", blurb: "Timber and stone, steep roofs, a market, a keep.", style: "medieval" },
    military: { title: "Military", blurb: "Concrete bunkers, sandbags, watchtowers, wire.", style: "military" },
    ruined: { title: "Ruined / post-apocalypse", blurb: "Broken walls, rust, scavenged shelters.", style: "ruined" }
  };
  const ERAS_PLANNED = [["ancient", "Ancient"], ["wild_west", "Wild west"], ["industrial", "Industrial / Victorian"], ["ww2", "World War II"], ["cyberpunk", "Cyberpunk"], ["futuristic", "Futuristic colony"], ["fantasy", "Fantasy"], ["steampunk", "Steampunk"]];

  // ---- what the wizard asks after the land and the places. The answers are kept with the world (`spec.play`) for the workspaces that will use them; they do not change the land. A `choice` is one of its options' ids, a `multi` a list of them,
  // a `number` is held to min .. max, a `toggle` is true or false, a `text` is a line (at most 160 characters)
  const QUESTION_GROUPS = [["gameplay", "Gameplay"], ["story", "Story"], ["characters", "Characters"], ["units", "Units"], ["nature", "Nature"], ["effects", "Effects"]];
  const QUESTIONS = [
    { id: "perspective", group: "gameplay", title: "Camera", kind: "choice", options: [["third", "Third person"], ["first", "First person"], ["top", "Top-down"], ["side", "Side view"]], default: "third", help: "How the player sees the world." },
    { id: "loop", group: "gameplay", title: "What the player does", kind: "multi", options: [["explore", "Explore"], ["combat", "Fight"], ["survive", "Survive"], ["build", "Build and manage"], ["drive", "Drive and fly"], ["stealth", "Sneak"], ["trade", "Trade"], ["farm", "Farm"]], default: ["explore", "combat"], help: "The things the game is made of (pick as many as you like)." },
    { id: "difficulty", group: "gameplay", title: "Difficulty", kind: "choice", options: [["relaxed", "Relaxed"], ["normal", "Normal"], ["hard", "Hard"], ["brutal", "Brutal"]], default: "normal", help: "How hard the world pushes back." },
    { id: "players", group: "gameplay", title: "Players", kind: "choice", options: [["one", "One"], ["coop", "Co-operative"], ["versus", "Against each other"]], default: "one", help: "Who plays at once." },
    { id: "premise", group: "story", title: "How the story goes", kind: "choice", options: [["sandbox", "No story: a sandbox"], ["missions", "Missions one after another"], ["campaign", "A campaign with a plot"], ["emergent", "Stories that come from play"]], default: "missions", help: "How much of the game is written." },
    { id: "tone", group: "story", title: "Tone", kind: "choice", options: [["heroic", "Heroic"], ["grim", "Grim"], ["light", "Light-hearted"], ["mystery", "Mystery"], ["horror", "Horror"], ["epic", "Epic"]], default: "heroic", help: "The mood of the world and its people." },
    { id: "conflict", group: "story", title: "What is wrong", kind: "choice", options: [["factions", "Factions at war"], ["crime", "Crime and the law"], ["survival", "Nature and hunger"], ["invasion", "An invasion"], ["plague", "A plague"], ["rivalry", "Rival towns"], ["none", "Nothing: peace"]], default: "factions", help: "The trouble the player finds." },
    { id: "factions", group: "story", title: "Factions", kind: "number", min: 1, max: 6, whole: true, default: 2, help: "How many groups with aims of their own." },
    { id: "premise_text", group: "story", title: "Your premise", kind: "text", default: "", help: "One line in your own words (kept with the world)." },
    { id: "hero", group: "characters", title: "The player is", kind: "choice", options: [["soldier", "A soldier"], ["civilian", "A civilian"], ["hunter", "A hunter"], ["outlaw", "An outlaw"], ["officer", "An officer"], ["traveller", "A traveller"], ["survivor", "A survivor"], ["noble", "A noble"]], default: "traveller", help: "Who the player starts as." },
    { id: "companions", group: "characters", title: "Companions", kind: "choice", options: [["none", "Alone"], ["one", "One companion"], ["squad", "A squad"], ["animal", "An animal"]], default: "none", help: "Who walks with the player." },
    { id: "npc_depth", group: "characters", title: "People have", kind: "choice", options: [["crowd", "Crowd roles only"], ["routines", "Daily routines"], ["stories", "Names and stories"]], default: "routines", help: "How much each person of the world is." },
    { id: "people", group: "units", title: "Population", kind: "choice", options: [["none", "Nobody"], ["sparse", "Sparse"], ["normal", "Normal"], ["busy", "Busy"]], default: "normal", help: "How many people live in the places." },
    { id: "hostiles", group: "units", title: "Enemies", kind: "multi", options: [["humans", "People"], ["animals", "Wild animals"], ["undead", "The undead"], ["machines", "Machines"], ["monsters", "Monsters"]], default: ["humans"], help: "What the player may have to fight." },
    { id: "wildlife", group: "units", title: "Wildlife", kind: "choice", options: [["none", "None"], ["some", "Some"], ["lots", "A lot"]], default: "some", help: "Animals that live in the open." },
    { id: "vehicles", group: "units", title: "Vehicles", kind: "choice", options: [["none", "None"], ["few", "A few"], ["many", "Many"]], default: "few", help: "Cars, carts, boats and aircraft in the world." },
    { id: "season", group: "nature", title: "Season", kind: "choice", options: [["spring", "Spring"], ["summer", "Summer"], ["autumn", "Autumn"], ["winter", "Winter"]], default: "summer", help: "The time of year the world starts in." },
    { id: "weather", group: "nature", title: "Weather", kind: "choice", options: [["clear", "Clear"], ["changing", "Changing"], ["rain", "Rainy"], ["snow", "Snowy"], ["fog", "Foggy"], ["storm", "Stormy"]], default: "clear", help: "What the sky does." },
    { id: "time", group: "nature", title: "Time of day", kind: "choice", options: [["dawn", "Dawn"], ["day", "Day"], ["dusk", "Dusk"], ["night", "Night"], ["cycle", "A day that passes"]], default: "day", help: "When the game starts and whether it moves on." },
    { id: "flora", group: "nature", title: "Plant growth", kind: "number", min: 0, max: 1, default: 0.7, help: "How thick the trees, plants and grass grow where the climate allows." },
    { id: "look", group: "effects", title: "Look", kind: "choice", options: [["realistic", "Realistic"], ["gritty", "Gritty"], ["bright", "Bright and clean"], ["painterly", "Painterly"], ["noir", "Noir"]], default: "realistic", help: "The grade and mood of the picture." },
    { id: "post", group: "effects", title: "Screen effects", kind: "multi", options: [["bloom", "Bloom"], ["grain", "Film grain"], ["vignette", "Vignette"], ["grade", "Colour grade"], ["blur", "Motion blur"], ["shake", "Camera shake"]], default: ["bloom", "vignette"], help: "Effects over the finished picture." },
    { id: "ambience", group: "effects", title: "Air and ground effects", kind: "multi", options: [["dust", "Dust"], ["leaves", "Leaves"], ["fireflies", "Fireflies"], ["embers", "Embers"], ["mist", "Mist"], ["birds", "Birds"]], default: ["dust"], help: "Small things that move in the air." }
  ];
  // each kind of game starts the answers from its own (what is not said here is the question's default)
  const GAME_PLAY = {
    city_action: { perspective: "third", loop: ["drive", "combat", "explore"], tone: "grim", conflict: "crime", hero: "outlaw", people: "busy", vehicles: "many", hostiles: ["humans"], look: "gritty" },
    medieval: { loop: ["explore", "combat", "trade"], tone: "epic", conflict: "rivalry", hero: "noble", season: "spring", hostiles: ["humans", "monsters"], vehicles: "none", look: "painterly" },
    survival: { loop: ["survive", "explore", "combat"], tone: "grim", conflict: "survival", hero: "survivor", people: "sparse", hostiles: ["humans", "undead"], weather: "fog", look: "gritty", ambience: ["dust", "embers"] },
    military: { perspective: "first", loop: ["combat", "stealth"], tone: "grim", conflict: "invasion", hero: "soldier", companions: "squad", difficulty: "hard", people: "sparse", vehicles: "many", hostiles: ["humans", "machines"] },
    farming: { loop: ["farm", "build", "trade"], tone: "light", conflict: "none", hero: "civilian", season: "spring", people: "normal", hostiles: ["animals"], wildlife: "lots", difficulty: "relaxed", look: "bright", ambience: ["leaves", "birds"] },
    island: { loop: ["survive", "explore", "build"], tone: "mystery", conflict: "survival", hero: "survivor", people: "none", hostiles: ["animals"], wildlife: "lots", vehicles: "none", ambience: ["birds"] },
    blank: { loop: ["explore"], premise: "sandbox", conflict: "none", people: "none", hostiles: [], wildlife: "none", vehicles: "none" }
  };
  const SITE_MAX = { cities: 6, towns: 12, villages: 30, farms: 40, camps: 40, outposts: 30, ruins: 30 };
  const SIZE_RANGE = [256, 16384];

  function play_defaults(game) {
    const out = {}, own = GAME_PLAY[game] || {};
    QUESTIONS.forEach(function (q) { out[q.id] = JSON.parse(JSON.stringify(own[q.id] !== undefined ? own[q.id] : q.default)); });
    return out;
  }
  // one answer made to fit its question (undefined: it does not)
  function fit_answer(q, v) {
    const ids = q.options ? q.options.map(function (o) { return o[0]; }) : null;
    if (q.kind === "choice") return typeof v === "string" && ids.indexOf(v) >= 0 ? v : undefined;
    if (q.kind === "multi") { if (!Array.isArray(v)) return undefined; const out = []; v.forEach(function (x) { if (ids.indexOf(x) >= 0 && out.indexOf(x) < 0) out.push(x); }); return out; }
    if (q.kind === "number") { if (!finite(+v) || v === null || v === "" || typeof v === "boolean") return undefined; const n = clamp(+v, q.min, q.max); return q.whole ? Math.round(n) : n; }
    if (q.kind === "toggle") return typeof v === "boolean" ? v : undefined;
    if (q.kind === "text") return typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").slice(0, 160) : undefined;
    return undefined;
  }

  // the seed of one part of the making: the land's own, or one the spec gives for the layout (the places, the roads, the cities) or the nature (the open ground)
  function seed_of(spec, part) {
    const own = part === "layout" ? spec.seed_layout : part === "nature" ? spec.seed_nature : part === "style" ? spec.seed_style : undefined;
    return finite(own) ? own | 0 : (finite(spec.seed) ? spec.seed | 0 : 1);
  }

  function default_spec(game, size, seed) {
    const g = GAMES[game];
    if (!g) throw new Error("worldgen: no kind of game `" + game + "` (" + Object.keys(GAMES).join(", ") + ")");
    const sz = size === undefined ? g.size : size, k = clamp((sz / g.size) * (sz / g.size), 0.25, 6), sd = seed === undefined ? 1 : seed;
    const spec = { v: 2, game: game, era: g.style, style: ERAS[g.style].style, size: sz, preset: g.preset, seed: sd, params: {}, height_scale: 0.25, rivers: g.rivers, roads: g.roads, nature: g.nature, vegetation: g.vegetation, sun: { azimuth: g.sun.azimuth, elevation: g.sun.elevation }, ambient: g.ambient };
    SITE_KEYS.forEach(function (sk) { spec[sk[0]] = Math.min(SITE_MAX[sk[0]], Math.round(g.sites[sk[0]] * k)); });
    spec.play = play_defaults(game);
    return spec;
  }

  // any object -> a whole spec. The game decides what is not said; what is said is held to range; an unknown game or era is an error (there is no sensible guess), everything else is said in `notes`
  function normalize_spec(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("worldgen: a spec is an object (" + (Array.isArray(input) ? "a list" : typeof input) + " was given)");
    const notes = [], say = function (t) { if (notes.length < 40) notes.push(t); };
    const game = input.game === undefined ? "city_action" : input.game;
    if (!GAMES[game]) throw new Error("worldgen: no kind of game `" + game + "` (" + Object.keys(GAMES).join(", ") + ")");
    if (input.game === undefined) say("no kind of game was given: " + GAMES[game].title);
    const num = function (key, lo, hi, whole) {
      const v = input[key];
      if (v === undefined) return undefined;
      if (typeof v !== "number" || !isFinite(v)) { say(key + " is not a number: the default is used"); return undefined; }
      const c = clamp(whole ? Math.round(v) : v, lo, hi);
      if (c !== v && !(whole && Math.round(v) === c)) say(key + " " + v + " is held to " + c + " (" + lo + " .. " + hi + ")");
      return c;
    };
    const size = num("size", SIZE_RANGE[0], SIZE_RANGE[1], true), seed = num("seed", -2147483648, 2147483647, true);
    const spec = default_spec(game, size, seed === undefined ? 1 : seed);
    if (input.era !== undefined && (typeof input.era !== "string" || !input.era)) say("era is not a name: the game's is used");
    else if (input.era !== undefined) {
      if (ERAS[input.era]) { spec.era = input.era; spec.style = ERAS[input.era].style; }
      else if (ERAS_PLANNED.some(function (e) { return e[0] === input.era; })) say("the era `" + input.era + "` is planned and not made yet: " + ERAS[spec.era].title + " is used");
      else throw new Error("worldgen: no era `" + input.era + "` (" + Object.keys(ERAS).join(", ") + ")");
    } else if (input.style !== undefined && ERAS[input.style]) { spec.era = input.style; spec.style = ERAS[input.style].style; }          // (a spec of before the eras: its style was the era)
    if (typeof input.preset === "string" && input.preset) spec.preset = input.preset.slice(0, 64); else if (input.preset !== undefined) say("preset is not a name: the game's is used");
    ["seed_layout", "seed_nature", "seed_style"].forEach(function (k) { const v = num(k, -2147483648, 2147483647, true); if (v !== undefined) spec[k] = v; });                    // (left out: the part follows the land's seed)
    ["rivers", "roads", "vegetation"].forEach(function (k) { if (typeof input[k] === "boolean") spec[k] = input[k]; else if (input[k] !== undefined) say(k + " is a yes or a no: the game's is used"); });
    const nat = num("nature", 0, 1), hs = num("height_scale", 0.05, 4), amb = num("ambient", 0, 2);
    if (nat !== undefined) spec.nature = nat; if (hs !== undefined) spec.height_scale = hs; if (amb !== undefined) spec.ambient = amb;
    SITE_KEYS.forEach(function (sk) { const v = num(sk[0], 0, SITE_MAX[sk[0]], true); if (v !== undefined) spec[sk[0]] = v; });
    if (input.sun && typeof input.sun === "object") {
      if (finite(input.sun.azimuth)) spec.sun.azimuth = clamp(input.sun.azimuth, 0, 360);
      if (finite(input.sun.elevation)) spec.sun.elevation = clamp(input.sun.elevation, 1, 90);
    }
    if (input.params && typeof input.params === "object" && !Array.isArray(input.params)) {
      const names = Object.keys(input.params);
      names.slice(0, 120).forEach(function (n) { const v = input.params[n]; if (typeof v === "number" && isFinite(v)) spec.params[n] = v; else say("terrain number " + n + " is not a number: left out"); });
      if (names.length > 120) say("more than 120 terrain numbers: the rest are left out");
    }
    if (input.play && typeof input.play === "object" && !Array.isArray(input.play)) {
      Object.keys(input.play).forEach(function (id) {
        const q = QUESTIONS.filter(function (x) { return x.id === id; })[0];
        if (!q) { say("an answer to `" + id + "` is not a question of this wizard: left out"); return; }
        const v = fit_answer(q, input.play[id]);
        if (v === undefined) say("the answer to " + q.title + " does not fit the question: the game's is used"); else spec.play[id] = v;
      });
    }
    return { spec: spec, notes: notes };
  }

  // ---- the world code: "HGW1-" + the text of { g (the generator's version), s (the spec), f (the fingerprint of what it made) } in base64url + "-" + a check. Pure arithmetic: no Buffer, no btoa.
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function utf8(s) {
    const out = [];
    for (let i = 0; i < s.length; i++) {
      let c = s.charCodeAt(i);
      if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { const d = s.charCodeAt(i + 1); if (d >= 0xdc00 && d < 0xe000) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; } }
      if (c < 0x80) out.push(c); else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63)); else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function unutf8(b) {
    let s = "";
    for (let i = 0; i < b.length;) {
      const c = b[i++];
      let cp;
      if (c < 0x80) cp = c; else if (c >= 0xc0 && c < 0xe0 && i < b.length) cp = ((c & 31) << 6) | (b[i++] & 63); else if (c >= 0xe0 && c < 0xf0 && i + 1 < b.length) { cp = ((c & 15) << 12) | ((b[i] & 63) << 6) | (b[i + 1] & 63); i += 2; } else if (c >= 0xf0 && i + 2 < b.length) { cp = ((c & 7) << 18) | ((b[i] & 63) << 12) | ((b[i + 1] & 63) << 6) | (b[i + 2] & 63); i += 3; } else cp = 0xfffd;
      s += cp >= 0x10000 ? String.fromCharCode(0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 1023)) : String.fromCharCode(cp);
    }
    return s;
  }
  function b64_encode(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : 0, c = i + 2 < bytes.length ? bytes[i + 2] : 0, n = (a << 16) | (b << 8) | c;
      s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : "") + (i + 2 < bytes.length ? B64[n & 63] : "");
    }
    return s;
  }
  function b64_decode(text) {
    const bytes = [];
    for (let i = 0; i < text.length; i += 4) {
      const q = [0, 0, 0, 0], have = Math.min(4, text.length - i);
      for (let k = 0; k < have; k++) { const v = B64.indexOf(text[i + k]); if (v < 0) return null; q[k] = v; }
      if (have < 2) return null;
      const n = (q[0] << 18) | (q[1] << 12) | (q[2] << 6) | q[3];
      bytes.push((n >> 16) & 255); if (have > 2) bytes.push((n >> 8) & 255); if (have > 3) bytes.push(n & 255);
    }
    return bytes;
  }
  // FNV-1a over a text: 8 hex
  function text_hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, "0"); }
  function encode_spec(spec, o) {
    o = o || {};
    const body = { g: GEN_VERSION, s: spec };
    if (o.fp) body.f = String(o.fp);
    const text = b64_encode(utf8(JSON.stringify(body)));
    return "HGW1-" + text + "-" + text_hash(text).slice(0, 6);
  }
  function decode_spec(code) {
    if (typeof code !== "string") throw new Error("worldgen: a world code is text");
    const c = code.replace(/\s+/g, ""), m = /^HGW1-([A-Za-z0-9_-]+)-([0-9a-f]{6})$/.exec(c);
    if (!m) throw new Error("worldgen: this is not a world code (it starts HGW1- and ends with six letters and digits)");
    if (text_hash(m[1]).slice(0, 6) !== m[2]) throw new Error("worldgen: this world code is damaged (a character was lost or changed)");
    const bytes = b64_decode(m[1]);
    let body = null;
    try { body = bytes ? JSON.parse(unutf8(bytes)) : null; } catch (e) { body = null; }
    if (!body || typeof body !== "object" || !body.s) throw new Error("worldgen: this world code holds no world");
    const res = normalize_spec(body.s), notes = res.notes.slice();
    if (finite(body.g) && body.g !== GEN_VERSION) notes.unshift("made by generator version " + body.g + ", this editor has " + GEN_VERSION + ": the world may differ from the one it was made as");
    return { spec: res.spec, notes: notes, gen: finite(body.g) ? body.g : null, fp: typeof body.f === "string" ? body.f : null };
  }

  // ---- what of the environment document a spec decides: laid over the document's defaults by the editor, for the preview of the land and for the world itself
  function terrain_part(spec) {
    const part = { size: spec.size, terrain: { preset: spec.preset, seed: spec.seed | 0, params: JSON.parse(JSON.stringify(spec.params || {})), height_scale: finite(spec.height_scale) ? spec.height_scale : 0.25, rivers: [] }, sun: { azimuth: spec.sun.azimuth, elevation: spec.sun.elevation }, ambient: spec.ambient, vegetation: !!spec.vegetation };
    part.terrain.rivers = rivers_for(spec).map(function (r) { return JSON.parse(JSON.stringify(r)); });
    return part;
  }

  // ---- fingerprints: two machines that made the same world from the same code get the same numbers
  function fingerprint(locations) {
    let h = 0x811c9dc5;
    const mix = function (n) { h ^= n | 0; h = Math.imul(h, 0x01000193); };
    const mix_text = function (s) { for (let i = 0; i < s.length; i++) mix(s.charCodeAt(i)); mix(0x2c); };
    const q = function (v, k) { return Math.round((+v || 0) * k); };
    const list = (locations || []).slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    list.forEach(function (l) {
      mix_text(l.id); mix_text(l.kind || ""); mix_text(l.name || ""); mix(q(l.x, 100)); mix(q(l.z, 100)); mix(q(l.r, 100));
      const els = l.elements || [];
      mix(els.length);
      for (let i = 0; i < els.length; i++) {
        const e = els[i];
        mix_text(e.type); mix(q(e.x, 100)); mix(q(e.z, 100)); mix(q(e.yaw, 10)); mix(q(e.scale, 1000)); mix(q(e.dy, 100)); mix(q(e.pitch, 10)); mix(q(e.roll, 10));
        if (e.p) { const ks = Object.keys(e.p).sort(); for (let k = 0; k < ks.length; k++) { mix_text(ks[k]); const v = e.p[ks[k]]; if (typeof v === "number") mix(q(v, 1000)); else if (Array.isArray(v)) for (let t = 0; t < v.length; t++) mix(q(v[t], 1000)); else mix_text(String(v)); } }
      }
    });
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  function terrain_print(ground, size) {
    let h = 0x811c9dc5;
    const n = 48, half = size / 2;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { h ^= Math.round(ground.y(-half + (i + 0.5) / n * size, -half + (j + 0.5) / n * size) * 1000) | 0; h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  // ---- the plan: where each place goes
  // the distance (in cells) of each cell from the nearest cell that is not usable: two passes of a chamfer transform
  function free_distance(ok, n) {
    const d = new Float32Array(n * n), BIG = 1e9, S2 = Math.SQRT2;
    for (let k = 0; k < n * n; k++) d[k] = ok[k] ? BIG : 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i; let v = d[k];
      if (i > 0) v = Math.min(v, d[k - 1] + 1);
      if (j > 0) { v = Math.min(v, d[k - n] + 1); if (i > 0) v = Math.min(v, d[k - n - 1] + S2); if (i < n - 1) v = Math.min(v, d[k - n + 1] + S2); }
      d[k] = v;
    }
    for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
      const k = j * n + i; let v = d[k];
      if (i < n - 1) v = Math.min(v, d[k + 1] + 1);
      if (j < n - 1) { v = Math.min(v, d[k + n] + 1); if (i < n - 1) v = Math.min(v, d[k + n + 1] + S2); if (i > 0) v = Math.min(v, d[k + n - 1] + S2); }
      d[k] = v;
    }
    return d;
  }
  // is a point within `pad` metres of the bank of a river (river_lines: [{ points: [[x, z] ...], width }])
  function near_river(lines, x, z, pad) {
    if (!lines) return false;
    for (let r = 0; r < lines.length; r++) {
      const L = lines[r], p = L.points, lim = (L.width || 12) / 2 + (L.plain || 0) * 0.15 + pad;
      for (let i = 0; i + 1 < p.length; i++) {
        const ax = p[i][0], az = p[i][1], bx = p[i + 1][0], bz = p[i + 1][1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = l2 > 0 ? clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) : 0;
        const ex = x - (ax + dx * t), ez = z - (az + dz * t);
        if (ex * ex + ez * ez <= lim * lim) return true;
      }
    }
    return false;
  }
  function grid_of(spec, ground) {
    const size = spec.size, step = clamp(size / 96, 24, 128), n = Math.max(8, Math.floor(size / step)), half = size / 2, sea = finite(ground.sea) ? ground.sea : 0;
    const h = new Float32Array(n * n), dry = new Uint8Array(n * n), flat = new Uint8Array(n * n), slope = new Float32Array(n * n), river = new Uint8Array(n * n), e = step * 0.5;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = -half + (i + 0.5) * step, z = -half + (j + 0.5) * step, k = j * n + i;
      h[k] = ground.y(x, z);
      river[k] = near_river(spec.river_lines, x, z, step * 0.7) ? 1 : 0;
      dry[k] = ground.land(x, z) && h[k] > sea + 1.2 && Math.abs(x) < half - 60 && Math.abs(z) < half - 60 ? 1 : 0;
      const dx = (ground.y(x + e, z) - ground.y(x - e, z)) / step, dz = (ground.y(x, z + e) - ground.y(x, z - e)) / step;
      slope[k] = Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI;
      flat[k] = dry[k] && !river[k] && slope[k] < 8 ? 1 : 0;
    }
    return { n: n, step: step, half: half, h: h, dry: dry, flat: flat, slope: slope, river: river, sea: sea };
  }
  function plan(spec, ground, o) {
    o = o || {};
    const notes = [], g = grid_of(spec, ground), n = g.n, step = g.step, half = g.half, free = free_distance(g.flat, n), rnd = rng(((seed_of(spec, "layout") | 0) * 7919 + 13) | 0), sites = [];
    const centre = function (i, j) { return [-half + (i + 0.5) * step, -half + (j + 0.5) * step]; };
    SITE_KEYS.forEach(function (sk) {
      const want = Math.max(0, Math.round(+spec[sk[0]] || 0)), K = KINDS[sk[1]];
      let got = 0;
      for (let t = 0; t < want; t++) {
        const need = K.flat / step, cands = [];
        for (let k = 0; k < n * n; k++) {
          if (free[k] < Math.max(2, need * 0.8)) continue;
          const c = centre(k % n, Math.floor(k / n)), r = Math.min(K.radius[1], Math.max(K.radius[0], free[k] * step * 0.85));
          let clash = false;
          for (let s = 0; s < sites.length && !clash; s++) { const S = sites[s], d = Math.hypot(c[0] - S.x, c[1] - S.z); clash = d < (r + S.r) * 1.25 + 30; }
          if (!clash) cands.push([k, c, r]);
        }
        if (!cands.length) break;
        let pick;
        if (sk[1] === "city") { pick = cands[0]; for (let q = 1; q < cands.length; q++) if (free[cands[q][0]] > free[pick[0]]) pick = cands[q]; }          // (a city takes the biggest flat land there is)
        else pick = cands[Math.floor(rnd() * cands.length)];
        sites.push({ kind: sk[1], name: rnd.pick(NAMES_A) + " " + rnd.pick(NAMES_B[sk[1]]).replace(/^./, function (c) { return c.toUpperCase(); }), x: Math.round(pick[1][0]), z: Math.round(pick[1][1]), r: Math.round(pick[2]), seed: rnd.int(1, 2147483000) });
        got++;
      }
      if (got < want) notes.push("Room for " + got + " of " + want + " " + (want === 1 ? K.title.toLowerCase() : sk[0]) + " (no flat dry land of " + Math.round(K.flat * 2) + " m is left)");
    });
    // names are made different
    const seen = {}; sites.forEach(function (s) { if (seen[s.name]) s.name += " " + (++seen[s.name]); else seen[s.name] = 1; });
    return { sites: sites, notes: notes, grid: { n: n, step: step } };
  }

  // ---- the roads: sites joined over the land
  function heap_push(h, item) { h.push(item); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; const t = h[p]; h[p] = h[i]; h[i] = t; i = p; } }
  function heap_pop(h) {
    const top = h[0], last = h.pop();
    if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; const t = h[m]; h[m] = h[i]; h[i] = t; i = m; } }
    return top;
  }
  function find_way(g, a, b) {
    const n = g.n, step = g.step, half = g.half, cell = function (x, z) { return [clamp(Math.floor((x + half) / step), 0, n - 1), clamp(Math.floor((z + half) / step), 0, n - 1)]; };
    const A = cell(a[0], a[1]), B = cell(b[0], b[1]), start = A[1] * n + A[0], goal = B[1] * n + B[0];
    const cost = new Float32Array(n * n);
    for (let k = 0; k < n * n; k++) cost[k] = g.dry[k] ? (1 + Math.pow(g.slope[k] / 9, 2)) * (g.river[k] ? 14 : 1) : Infinity;          // (a river is crossed where it must be, by a bridge, at a price)
    cost[start] = Math.min(cost[start], 1); cost[goal] = Math.min(cost[goal], 1);
    const dist = new Float32Array(n * n).fill(Infinity), from = new Int32Array(n * n).fill(-1), heap = [], hx = B[0], hz = B[1];
    dist[start] = 0; heap_push(heap, [0, start]);
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (heap.length) {
      const top = heap_pop(heap), k = top[1];
      if (k === goal) break;
      if (top[0] - Math.hypot((k % n) - hx, Math.floor(k / n) - hz) > dist[k] + 1e-4) continue;
      const i = k % n, j = Math.floor(k / n);
      for (let q = 0; q < 8; q++) {
        const ni = i + D[q][0], nj = j + D[q][1];
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const nk = nj * n + ni, c = cost[nk];
        if (c === Infinity) continue;
        const nd = dist[k] + D[q][2] * (cost[k] + c) / 2;
        if (nd < dist[nk]) { dist[nk] = nd; from[nk] = k; heap_push(heap, [nd + Math.hypot(ni - hx, nj - hz), nk]); }
      }
    }
    if (from[goal] < 0 && goal !== start) return null;
    const cells = []; for (let k = goal; k >= 0; k = from[k]) { cells.push(k); if (k === start) break; }
    cells.reverse();
    return cells.map(function (k) { return [-half + ((k % n) + 0.5) * step, -half + (Math.floor(k / n) + 0.5) * step]; });
  }
  // Chaikin corner cutting (twice), the ends kept
  function smooth(pts, rounds) {
    let p = pts;
    for (let r = 0; r < rounds; r++) {
      if (p.length < 3) return p;
      const q = [p[0]];
      for (let i = 0; i + 1 < p.length; i++) { const a = p[i], b = p[i + 1]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
      q.push(p[p.length - 1]); p = q;
    }
    return p;
  }
  // the points of a way that lie outside the circles of its two ends, from where it leaves the first to where it reaches the second
  function trim(pts, A, B) {
    const out = [];
    for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (Math.hypot(p[0] - A.x, p[1] - A.z) >= A.r * 0.9 && Math.hypot(p[0] - B.x, p[1] - B.z) >= B.r * 0.9) out.push(p); }
    return out;
  }
  // where a road crosses a river: the stretch of the road inside the river's banks becomes a bridge (its middle, its way, its length: the river's width and a run each side)
  function bridges_of(road, lines) {
    const out = [];
    if (!lines || !lines.length) return out;
    const p = road.points;
    let from = -1;
    const flush = function (to) {
      if (from < 0) return;
      const a = p[from], b = p[to], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, i0 = Math.max(0, from - 1), i1 = Math.min(p.length - 1, to + 1);
      const dx = p[i1][0] - p[i0][0], dz = p[i1][1] - p[i0][1], span = Math.hypot(b[0] - a[0], b[1] - a[1]);
      out.push({ x: Math.round(mx * 10) / 10, z: Math.round(mz * 10) / 10, yaw: Math.round(Math.atan2(dx, dz) * 180 / Math.PI * 10) / 10, length: Math.round(clamp(span + 14, 14, 110)), width: road.width + 3 });
      from = -1;
    };
    for (let i = 0; i < p.length; i++) {
      const inside = near_river(lines, p[i][0], p[i][1], 0);
      if (inside && from < 0) from = i; else if (!inside && from >= 0) flush(i - 1);
    }
    flush(p.length - 1);
    return out;
  }
  function connect(sites, ground, spec) {
    const notes = [], roads = [];
    if (sites.length < 2) return { roads: roads, notes: notes };
    const g = grid_of(spec, ground), edges = [], have = {};
    const add = function (a, b) { const key = Math.min(a, b) + "-" + Math.max(a, b); if (!have[key]) { have[key] = 1; edges.push([a, b]); } };
    // the least that joins them all (Prim), then a second road from each city to its nearest other site
    const inside = [0], todo = {}; for (let i = 1; i < sites.length; i++) todo[i] = true;
    while (Object.keys(todo).length) {
      let best = null;
      inside.forEach(function (a) { Object.keys(todo).forEach(function (bs) { const b = +bs, d = Math.hypot(sites[a].x - sites[b].x, sites[a].z - sites[b].z); if (!best || d < best[2]) best = [a, b, d]; }); });
      add(best[0], best[1]); inside.push(best[1]); delete todo[best[1]];
    }
    sites.forEach(function (s, a) {
      if (s.kind !== "city") return;
      let best = null; sites.forEach(function (t, b) { if (b === a || have[Math.min(a, b) + "-" + Math.max(a, b)]) return; const d = Math.hypot(s.x - t.x, s.z - t.z); if (!best || d < best[1]) best = [b, d]; });
      if (best) add(a, best[0]);
    });
    edges.forEach(function (e) {
      const A = sites[e[0]], B = sites[e[1]], way = find_way(g, [A.x, A.z], [B.x, B.z]);
      if (!way) { notes.push("No road between " + A.name + " and " + B.name + " (water or steep ground is in the way)"); return; }
      let pts = smooth(way, 2);
      pts = trim(pts, A, B);
      if (pts.length < 2) return;
      const rank = Math.max(KINDS[A.kind].rank, KINDS[B.kind].rank), low = Math.min(KINDS[A.kind].rank, KINDS[B.kind].rank);
      const kind = A.kind === "city" && B.kind === "city" ? "highway" : (low >= 2 || rank >= 3 ? "road" : "track");
      const road = { points: pts.map(function (p) { return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; }), width: kind === "highway" ? 12 : kind === "road" ? 8 : 4, kind: kind, a: e[0], b: e[1] };
      road.bridges = bridges_of(road, spec.river_lines);
      roads.push(road);
    });
    return { roads: roads, notes: notes };
  }

  // ---- rivers: across the land from one edge to another, wandering
  function rivers_for(spec) {
    if (!spec.rivers) return [];
    const rnd = rng(((spec.seed | 0) * 104729 + 7) | 0), size = spec.size, half = size / 2, count = size >= 3000 ? 2 : 1, out = [];
    for (let r = 0; r < count; r++) {
      const along_x = rnd() < 0.5, off = rnd.range(-0.28, 0.28) * size, n = rnd.int(6, 9), pts = [];
      for (let i = 0; i < n; i++) {
        const t = -half * 0.96 + (i / (n - 1)) * half * 1.92, w = off + Math.sin(i * 1.3 + r) * size * 0.07 + rnd.range(-0.05, 0.05) * size;
        pts.push(along_x ? [Math.round(t), Math.round(w)] : [Math.round(w), Math.round(t)]);
      }
      const width = Math.round(rnd.range(11, 20));
      out.push({ points: pts, width: width, depth: 6, bank: Math.min(5, width / 2), plain: 28, blend: 36 });
    }
    return out;
  }

  // ---- what stands in a place
  // the look of a game's buildings: its STYLE SHEET (system/eras.js: the palettes of the era's flavours, graded by the kind of game, drawn with the style seed); null when the module is not given (a building then wears the first palette of its type)
  function sheet_of(spec, ctx) {
    if (!ctx || !ctx.Eras || !ctx.Eras.PROFILES[spec.era]) return null;
    return ctx.Eras.style_sheet(spec.era, seed_of(spec, "style"), { genre: spec.game });
  }
  const round3 = function (v) { return Math.round(v * 1000) / 1000; };
  // the numbers of a plain box and its colour: the wall of the palette of the district it stands in (the era's style sheet: system/eras.js), else the recipe's own
  function box_params(sheet, ctx, x, z, w, d, h) {
    const p = { width: w, depth: d, height: h }, c = sheet ? ctx.Eras.palette_for(sheet, x, z).wall : null;
    if (Array.isArray(c) && c.length >= 3) p.color = [round3(c[0]), round3(c[1]), round3(c[2])];
    return p;
  }
  // the callback city.js asks for a building with: ONE BOX fitted to the lot, in the colour of its district. Sizes in a few steps (a mesh is made for each size and colour: a city of thousands asks for dozens)
  const STEP_W = [4, 6, 8, 12, 16, 24], STEP_H = [3, 6, 9, 12, 18, 24];
  const step = function (v, list) { let b = list[0]; for (let i = 0; i < list.length; i++) if (list[i] <= v + 0.01) b = list[i]; return b; };
  function make_building_for(spec, ctx, ground) {
    const sheet = sheet_of(spec, ctx);
    return function (req) {
      return [{ type: "box", x: 0, z: 0, yaw: 0, p: box_params(sheet, ctx, req.x, req.z, step(Math.max(2, req.w - 1), STEP_W), step(Math.max(2, req.d - 1), STEP_W), step(3 * Math.max(1, req.floors), STEP_H)) }];
    };
  }
  const LAYOUT_OF = { city: ["grid", "radial", "organic"], town: ["organic", "grid"], village: ["village"] };
  const DENSITY_OF = { city: 0.7, town: 0.5, village: 0.3 }, FLOORS_OF = { city: [2, 8], town: [1, 4], village: [1, 2] };
  const WEIGHTS_OF = { city: { residential: 0.5, commercial: 0.3, industrial: 0.1, civic: 0.1 }, town: { residential: 0.6, commercial: 0.25, industrial: 0.07, civic: 0.08 }, village: { residential: 0.85, commercial: 0.05, industrial: 0.05, civic: 0.05 } };
  // a walled compound: a ring of wall pieces with a gate gap on the front, a tower at each corner, a bunker or a house inside, sandbags and tank traps at the gate
  function compound(site, ground, ctx, rnd) {
    const S = ctx.structures, R = Math.max(12, Math.min(site.r * 0.65, 30)), yaw0 = rnd() * 360, out = [], seg = 8;
    const at = function (lx, lz) { const a = yaw0 * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [site.x + lx * c + lz * s, site.z - lx * s + lz * c]; };
    const put = function (type, lx, lz, yaw, p, dims) {                                      // dims: [metres along the piece's z, along its x]: laid on the slope when given
      const w = at(lx, lz), e = { type: type, x: Math.round(w[0] * 100) / 100, z: Math.round(w[1] * 100) / 100, yaw: Math.round(((yaw0 + yaw) % 360) * 10) / 10, scale: 1, dy: 0 };
      if (p) e.p = p;
      if (dims && S && S.tilt) { const t = S.tilt(ground.y, e.x, e.z, e.yaw, dims[0], dims[1]); e.pitch = clamp(t.pitch, -25, 25); e.roll = clamp(t.roll, -25, 25); }
      out.push(e);
    };
    const side = function (x0, z0, x1, z1, yaw, gate) {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / seg));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, lx = x0 + (x1 - x0) * t, lz = z0 + (z1 - z0) * t;
        if (gate && Math.abs(lx) < 5.5 && Math.abs(lz) < 5.5) continue;
        put("wall", lx, lz, yaw, { length: Math.round(len / n * 10) / 10 + 0.4, height: 3, thick: 0.6 }, [0.6, len / n]);
      }
    };
    side(-R, -R, R, -R, 0, false); side(-R, R, R, R, 0, true); side(-R, -R, -R, R, 90, false); side(R, -R, R, R, 90, false);
    [[-R, -R], [R, -R], [-R, R], [R, R]].forEach(function (c) { put("tower", c[0], c[1], rnd() * 90, { width: 3, height: 7 }); });
    put(rnd() < 0.5 ? "bunker" : "house", -R * 0.35, -R * 0.35, 0, rnd() < 0.5 ? { width: 8, depth: 6, height: 3 } : null);
    put("sandbags", -4, R - 3, 0, { length: 5, height: 1, thick: 0.9 }); put("sandbags", 4, R - 3, 0, { length: 5, height: 1, thick: 0.9 });
    put("tank_trap", -9, R + 3.5, 20); put("tank_trap", 0, R + 5, 0); put("tank_trap", 9, R + 3.5, -20);
    for (let i = 0; i < 4; i++) put("pillar", -R * 0.6 + rnd() * R * 1.2, -R * 0.1 + rnd() * R * 0.5, rnd() * 90, { width: 0.8, height: 2.5 });
    return out;
  }
  function build_site(site, ctx, spec) {
    const ground = ctx.ground, K = KINDS[site.kind], rnd = rng(site.seed | 0), notes = [];
    spec = spec || ctx.spec || { style: "modern" };
    let areas = [], elements = [];
    if (site.kind === "city" || site.kind === "town" || site.kind === "village") {
      if (!ctx.City) { notes.push("the city module is not there: " + site.name + " is left empty"); return { areas: [{ kind: K.location_kind, name: site.name, x: site.x, z: site.z, r: site.r }], elements: [], notes: notes }; }
      let layout = rnd.pick(LAYOUT_OF[site.kind]), res = null;
      for (let tries = 0; tries < 3; tries++) {                                                      // (the ground is judged finer by the city than by the plan: a place that gets no street is tried again, smaller)
        res = ctx.City.generate({ x: site.x, z: site.z, radius: Math.max(70, site.r * 0.95 * Math.pow(0.7, tries)), seed: site.seed + tries, layout: tries === 0 ? layout : (site.kind === "city" ? "organic" : "village"), density: DENSITY_OF[site.kind], ground: ground, make_building: make_building_for(spec, ctx, ground), building_styles: WEIGHTS_OF[site.kind], floors: FLOORS_OF[site.kind], props: 0.6, structures: ctx.structures });
        if (res.elements && res.elements.length) break;
      }
      areas = res.areas || []; elements = res.elements || [];
      if (areas.length) { areas[0].name = site.name; areas[0].kind = K.location_kind; areas[0].r = Math.max(areas[0].r, site.r); } else areas.push({ kind: K.location_kind, name: site.name, x: site.x, z: site.z, r: site.r });
      (res.notes || []).forEach(function (n) { notes.push(site.name + ": " + n); });
    } else if (site.kind === "farm") {
      const sheet = sheet_of(spec, ctx), yaw = rnd() * 360, a = yaw * Math.PI / 180;
      const mk = function (w, d, h, dx, dz, turn) {                                                  // (a box of the farm: its place in the farm's frame, turned `turn` from the farm)
        const wx = site.x + dx * Math.cos(a) + dz * Math.sin(a), wz = site.z - dx * Math.sin(a) + dz * Math.cos(a);
        return { type: "box", x: round3(wx), z: round3(wz), yaw: round3(yaw + turn), scale: 1, dy: 0, p: box_params(sheet, ctx, wx, wz, w, d, h) };
      };
      elements = [mk(9, 7, 3, -site.r * 0.35, 0, 0), mk(14, 10, 6, site.r * 0.3, site.r * 0.15, 90)];
      areas = [{ kind: "farm", name: site.name, x: site.x, z: site.z, r: site.r }];
    } else if (site.kind === "camp") {
      areas = [{ kind: "camp", name: site.name, x: site.x, z: site.z, r: site.r }];
    } else if (site.kind === "ruin") {
      areas = [{ kind: "ruin", name: site.name, x: site.x, z: site.z, r: site.r }];
    } else if (site.kind === "outpost") {
      elements = compound(site, ground, ctx, rnd);
      areas = [{ kind: "outpost", name: site.name, x: site.x, z: site.z, r: site.r }];
    }
    return { areas: areas, elements: elements, notes: notes };
  }

  // ---- the stages
  function stages(spec, ground, ctx) {
    ctx = Object.assign({ ground: ground, spec: spec }, ctx);
    const pl = plan(spec, ground), conn = spec.roads ? connect(pl.sites, ground, spec) : { roads: [], notes: [] }, list = [], notes = pl.notes.concat(conn.notes);
    pl.sites.forEach(function (site, k) { list.push({ label: "Building " + site.name + " (" + (k + 1) + " of " + pl.sites.length + ")", run: function () { return build_site(site, ctx, spec); } }); });
    // (the roads between the places are DATA, `roads` of the result, with their bridges: the road field and bridge.js draw them; nothing is laid as pieces)
    return { stages: list, sites: pl.sites, roads: conn.roads, notes: notes };
  }

  return { GEN_VERSION: GEN_VERSION, ERAS: ERAS, ERAS_PLANNED: ERAS_PLANNED, QUESTIONS: QUESTIONS, QUESTION_GROUPS: QUESTION_GROUPS, GAME_PLAY: GAME_PLAY, SITE_KEYS: SITE_KEYS, SITE_MAX: SITE_MAX, SIZE_RANGE: SIZE_RANGE, normalize_spec: normalize_spec, encode_spec: encode_spec, decode_spec: decode_spec, terrain_part: terrain_part, seed_of: seed_of, fingerprint: fingerprint, terrain_print: terrain_print, play_defaults: play_defaults, GAMES: GAMES, KINDS: KINDS, default_spec: default_spec, plan: plan, connect: connect, rivers_for: rivers_for, stages: stages, build_site: build_site, rng: rng, free_distance: free_distance };
});
