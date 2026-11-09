# The city generator (`system/city.js`)

A street network, its blocks, its lots and a box on every lot, in world metres. Pure: no engine, no DOM, deterministic (a seeded mulberry32). The streets are DATA (`roads`, `junctions`): the road field (`road_field.js`) and the road mesh (`road_mesh.js`) draw them, `grade.js` grades the ground under them and `bridge.js` crosses water and gorges. What `elements` holds are the buildings (boxes) and the trees of the yards, as ordinary elements of `structures.js`, shown by `elements.js`.

The road pieces and the street furniture (types `road_*` and `street_*`) were the recipes of a road kit that is not in this repo. The generator still lays them (the geometry of a street is made from them) and does not return them: `pieces: true` returns them, for a host that has the recipes.

## `generate(opts)` -> `{ areas, elements, blocks, roads, junctions, exits, lots, stats, notes }`

`opts`: `x z radius seed layout density ground make_building building_styles floors road_width props structures pieces`. The header of city.js is the reference; out-of-range numbers are held to range and said in `notes`, a wrong layout throws and lists the five names.

**Layouts** (all make a graph of nodes and edges, then the same pipeline):
`grid` a rotated lattice with 2.5 % jitter and mild bends, every third line an arterial; `organic` the same warped by noise (30 % of a block) with irregular lines; `radial` a roundabout, rings every ~100 m and spokes that double outward;
`suburb` big collector blocks with cul-de-sacs grown into them (turning heads); `village` one winding cobbled main street with dirt lanes (and lanes off lanes) that end in half discs. Lattice layouts thin their local streets outward (every 2nd line, then every 4th), more or less by `density`.

**Pipeline**
1. Edges into water (`land` false, also 2.5 m beside them), off the radius, or steeper than 10 / 13 / 15 % along (arterial / street / lane) or 34 % across are dropped; spurs are pruned (not the lanes that were grown on purpose); only the biggest connected piece stays. If the middle is wet or steep it moves to the nearest ground that is not (said in `notes`).
2. **Exits**: for every 100 m of radius (2 .. 10) the street nearest the rim in some direction is carried straight out to R - 6 m (unless it would cross another street or leave dry land): `exits: [{ x, z, yaw, width, kind }]`, yaw = the way out (+z of an element at `yaw` is (sin yaw, cos yaw)). The end is free: no pad, no cap.
3. **Chains** (the streets between junctions) are rounded with fillets as wide as the segments allow, up to a layout's preferred radius (never tighter than a lorry's turn when the geometry allows: `stats.tight_bends` counts the rest).
4. **Junctions**: a square pad when 3 or 4 arms of a grid lie within 6 degrees of a pair of axes, a roundabout for 5+ arms of a radial plan, else a round pad (radius 5 .. 16, the arms end on its chord); a dead end is a turning head (suburb), a cap (village) or an exit.
5. **Pieces**: a chain is cut into equal chords whose ends are on the curve, each piece 4, 6 or 8 m (more of them where the bend is tight), tilted with `S.tilt` and lifted until the ground does not cover it. They are the geometry of a street; they are returned only with `pieces: true`.
6. **Blocks** are the faces of the graph (half-edge walk); the outside of the streets is a face too (a village is all outside) and is lotted the same.
7. **Lots**: along each street's frontage, widths by style, at three set-backs and four depths (the first that does not meet a street, a junction, the radius, water, a slope over 2 m or another lot), so that a block is lotted from every side and the second row shrinks to what is left. A lot's front looks at its street. Pocket parks (3.5 %), parks (5 .. 15 % of the blocks that are 0.12 .. 2.2 ha) and one plaza near the middle are left without a building.
8. **Buildings**: every lot calls `make_building(request)`; the default makes ONE `box` (structures.js: a width, a depth, a height and a colour) in a few sizes, so that a city of thousands asks for dozens of meshes. `worldgen.js` gives its own callback: the same sizes in the colour of the district (the era's style sheet, `eras.js`). The caller's elements are in the building's frame (x right, z toward the street, yaw added) unless `world: true`. A callback that throws or returns junk leaves the lot empty (`stats.builder_errors`, said in `notes`).
9. **Furniture** (`props`): trees in the yards; the lamps, benches, bins, bus stops, hydrants, signposts and crossings along the streets are `street_*` and `road_*` pieces, so they are returned only with `pieces: true`.
10. **Areas**: the whole place (`city` / `village`) and, from R = 150, districts of 100 m radius (squares of 140 m that hold at least 12 elements) so that a streamer can load one at a time.

## `lay(roads, opts)` -> `{ elements, notes, stats }`

For roads that are not a city's streets: `roads = [{ points, width, kind: "highway" | "road" | "track" }]` (centre lines, already smooth), `opts = { ground, structures, props, gaps: [{ x, z, r }], pieces }`. It lays the same pieces, so without `pieces: true` it returns no elements: the roads between places are the data `worldgen.connect` gives (points, width, kind, bridges).

## Numbers (flat dry ground, seed 7, radius 300 m, node 14)

| layout | roads | junctions | lots | boxes | trees (broad + pine) | distinct box meshes |
|---|---|---|---|---|---|---|
| grid | 27 | 18 | 157 | 153 | 130 + 21 | 48 |
| organic | 23 | 16 | 122 | 116 | 78 + 16 | 44 |
| radial | 42 | 25 | 225 | 215 | 252 + 53 | 47 |
| suburb | 48 | 46 | 143 | 141 | 54 + 14 | 54 |
| village | 19 | 20 | 137 | 131 | 57 + 22 | 13 |

A mesh is made for every distinct size and colour of box. With the system mesher (CPU) a box of 4 m is about 750 triangles and one of 24 m about 3,100, because `decimate` is the native mesher's; a mesh of the box itself would be 12. With `pieces: true` the same grid returns 962 elements.

## Not done / known

* A street never crosses water: bridges are `worldgen.connect`'s (`bridges`) and `bridge.js`'s. Streets that are too steep are dropped, not bent into switchbacks.
* The buildings are plain boxes: no roof, no windows, no storeys. The modular buildings of `happy` (a kit, `buildings.js`, `facade.js`) are not in this repo.
* A box is made through the sdf mesher; a direct mesh recipe would be 12 triangles instead of hundreds (`elements.js` has no path for it yet).
