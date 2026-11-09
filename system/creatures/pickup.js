"use strict";
// pickup: a pickup truck with a two door cab, a bed and four wheel drive. WRITTEN by system/vehicles.js: edit its table and run the tool again rather than this file.
// a 5.3 m four wheel drive pickup of 2,150 kg: a diesel engine with a lot of torque low down behind a five speed box that shifts by itself, soft long travel springs, wide tyres. Two doors, two seats, a bed behind the cab.
// A DYNAMIC VEHICLE (`vehicle.realism`, world.cpp, SYSTEM.md "Vehicles with suspension and an engine"): every wheel looks down at the ground and stands on a spring and a damper under a sprung body (it dives, squats and rolls, and the weight moves from wheel to wheel), the engine's torque goes through a gearbox that shifts by itself and a differential to wheels that are flywheels, and the tyres make their force from their slip: they grip, spin, lock and slide.
// DOORS (a door is a bone hinged at its front edge: `doors`, species.js) and SEATS (`seats`: system.enter walks a person to the door, the door opens, the person sits with its feet on the pedals and its hands on the wheel; sp.set_controls drives). The steering wheel is a bone of its own that the page turns (the `steering` entry of `doors` is its axis).
// ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS { name, family, nav, body, abilities, interaction, mind }. Metres, +x to its left, +y up, +z forward, the wheels on y = 0 (a wheel is a bone whose HEAD is the hub).
const bones = [
  { name: "root", head: [0, 0.6, -2.65], tail: [0, 0.6, 2.65] },
  { name: "wheel_f_l", parent: "root", head: [0.86, 0.38, 1.7], tail: [0.86, 0.48, 1.7], mirror: "x" },
  { name: "wheel_r_l", parent: "root", head: [0.86, 0.38, -1.5], tail: [0.86, 0.48, -1.5], mirror: "x" },
  { name: "steer", parent: "root", head: [0.4, 1.06, 0.55], tail: [0.5, 1.06, 0.55] },
  { name: "door_f_l", parent: "root", head: [1, 1.02, 0.82], tail: [1, 1.02, -0.28], mirror: "x" },
];
const rig = { joints: [
    { bone: "steer", kind: "hinge", axis: [0, 0.5, -0.866], range: [-100, 100] },
    { bone: "door_f_l", kind: "hinge", axis: [0, 1, 0], range: [-100, 0] },
    { bone: "door_f_r", kind: "hinge", axis: [0, 1, 0], range: [0, 100] },
  ], chains: [] };
const body = { max_speed: 40, accel: 6, turn_rate: 1.5, gravity: 9.81, step: 0.3, radius: 2.8 };
const vehicle = { wheels: [{ bone: "wheel_f_l", drive: 1, steer: 1, handbrake: undefined, brake: 1 }, { bone: "wheel_f_r", drive: 1, steer: 1, handbrake: undefined, brake: 1 }, { bone: "wheel_r_l", drive: 1, steer: 0, handbrake: undefined, brake: 1 }, { bone: "wheel_r_r", drive: 1, steer: 0, handbrake: undefined, brake: 1 }], model: "car", top_speed: 40, grip: 7, max_steer: 0.52, steer_rate: 4.5, steer_speed: 24, travel: 0.2, follow: 18, lean: 1, realism: { cg: 0.78, suspension: { hz: 1.05, damping: 0.4 }, engine: { idle: 750, redline: 4800, torque: 520 }, tyres: { grip: 0.98 } } };
const couplers = { rear: [0, 0.7, -2.8], front: [0, 0.7, 2.7] };
const doors = { steering: { bone: "steer", open: 1.5, speed: 10, at: [0, 0, 0], axis: [0, 0.5, -0.866] }, f_left: { bone: "door_f_l", open: -1, speed: 3, at: [1.5, 0, 0.27] }, f_right: { bone: "door_f_r", open: 1, speed: 3, at: [-1.5, 0, 0.27] } };
const seats = { driver: { at: [0.4, 0.74, -0.08], yaw: 0, feet: { left: [0.52, 0.5, 0.42], right: [0.3, 0.5, 0.47] }, hands: { left: [0.555, 1.14, 0.55], right: [0.245, 1.14, 0.55] }, door: "f_left", exit: [1.5, 0, 0.2] }, passenger: { at: [-0.4, 0.74, -0.08], yaw: 0, feet: { left: [-0.28, 0.5, 0.42], right: [-0.5, 0.5, 0.42] }, door: "f_right", exit: [-1.5, 0, 0.2] } };
const physics = { mass: 2150, shapes: [
    { id: "body", shape: "box", center: [0, 0.9, -0.05], half: [1.02, 0.55, 2.7], bone: "root" },
  ] };
// the sdf's parts: the paint is `paint_*` (the texture's), the glass `glass*`, the cabin's things are in an island of their own (the tub's cuts do not touch them), the doors in another (they swing)
const parts = [
  { id: "tyre_f", shape: "cylinder", center: [0.86, 0.38, 1.7], axis: "x", radius: 0.38, half: 0.14, round: 0.07700000000000001, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.035, 0.035, 0.04, 1], roughness: 0.9 },
  { id: "rim_f", shape: "cylinder", center: [0.86, 0.38, 1.7], axis: "x", radius: 0.2356, half: 0.15200000000000002, round: 0.012, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.66, 0.68, 0.72, 1], metal: 0.85, roughness: 0.25 },
  { id: "disc_f", shape: "cylinder", center: [0.79, 0.38, 1.7], axis: "x", radius: 0.1748, half: 0.02, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.35, 0.35, 0.38, 1], metal: 0.7, roughness: 0.4 },
  { id: "boss_f", shape: "cylinder", center: [0.86, 0.38, 1.7], axis: "x", radius: 0.0988, half: 0.168, round: 0.012, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "nut_f0", shape: "sphere", center: [1.03, 0.453, 1.722], radius: 0.018, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_f1", shape: "sphere", center: [1.03, 0.381, 1.776], radius: 0.018, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_f2", shape: "sphere", center: [1.03, 0.308, 1.725], radius: 0.018, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_f3", shape: "sphere", center: [1.03, 0.334, 1.639], radius: 0.018, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_f4", shape: "sphere", center: [1.03, 0.424, 1.638], radius: 0.018, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "tyre_r", shape: "cylinder", center: [0.86, 0.38, -1.5], axis: "x", radius: 0.38, half: 0.14, round: 0.07700000000000001, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.035, 0.035, 0.04, 1], roughness: 0.9 },
  { id: "rim_r", shape: "cylinder", center: [0.86, 0.38, -1.5], axis: "x", radius: 0.2356, half: 0.15200000000000002, round: 0.012, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.66, 0.68, 0.72, 1], metal: 0.85, roughness: 0.25 },
  { id: "disc_r", shape: "cylinder", center: [0.79, 0.38, -1.5], axis: "x", radius: 0.1748, half: 0.02, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.35, 0.35, 0.38, 1], metal: 0.7, roughness: 0.4 },
  { id: "boss_r", shape: "cylinder", center: [0.86, 0.38, -1.5], axis: "x", radius: 0.0988, half: 0.168, round: 0.012, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "nut_r0", shape: "sphere", center: [1.03, 0.453, -1.478], radius: 0.018, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_r1", shape: "sphere", center: [1.03, 0.381, -1.424], radius: 0.018, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_r2", shape: "sphere", center: [1.03, 0.308, -1.475], radius: 0.018, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_r3", shape: "sphere", center: [1.03, 0.334, -1.561], radius: 0.018, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_r4", shape: "sphere", center: [1.03, 0.424, -1.562], radius: 0.018, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "steer_ring", shape: "torus", center: [0.4, 1.06, 0.55], axis: [0, 0.5, -0.866], radius: 0.18, tube: 0.021, bone: "steer", island: "steer", color: [0.03, 0.03, 0.035, 1], roughness: 0.6 },
  { id: "steer_hub", shape: "sphere", center: [0.4, 1.06, 0.55], radius: 0.045, bone: "steer", island: "steer", color: [0.09, 0.09, 0.1, 1] },
  { id: "steer_spoke", shape: "capsule", a: [0.23, 1.06, 0.55], b: [0.57, 1.06, 0.55], radius: 0.014, bone: "steer", island: "steer", color: [0.09, 0.09, 0.1, 1] },
  { id: "steer_spoke_b", shape: "capsule", a: [0.4, 1.06, 0.55], b: [0.4, 0.91, 0.463], radius: 0.014, bone: "steer", island: "steer", color: [0.09, 0.09, 0.1, 1] },
  { id: "df_panel", shape: "box", center: [1.025, 0.8, 0.27], half: [0.03, 0.22, 0.55], round: 0.02, bone: "door_f_l", island: "doors", mirror: "x", color: [0.62, 0.1, 0.08, 1] },
  { id: "df_rail", shape: "box", center: [1, 1.6, 0.27], half: [0.035, 0.02, 0.55], round: 0.01, bone: "door_f_l", island: "doors", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "df_post_f", shape: "box", center: [1, 1.32, 0.8], half: [0.03, 0.3, 0.025], bone: "door_f_l", island: "doors", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "df_post_r", shape: "box", center: [1, 1.32, -0.26], half: [0.03, 0.3, 0.025], bone: "door_f_l", island: "doors", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "df_handle", shape: "box", center: [1.07, 0.98, -0.14], half: [0.014, 0.018, 0.065], round: 0.008, bone: "door_f_l", island: "doors", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9, roughness: 0.2 },
  { id: "df_mirror", shape: "box", center: [1.1, 1.22, 0.74], half: [0.05, 0.05, 0.035], round: 0.025, bone: "door_f_l", island: "doors", mirror: "x", color: [0.62, 0.1, 0.08, 1] },
  { id: "df_mirror_stem", shape: "capsule", a: [1.02, 1.04, 0.74], b: [1.08, 1.19, 0.74], radius: 0.014, bone: "door_f_l", island: "doors", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "paint_chassis", shape: "box", center: [0, 0.62, 0], half: [1, 0.22, 2.5], round: 0.08, bone: "root", blend: 0.02, color: [0.62, 0.1, 0.08, 1], roughness: 0.3, metal: 0.45 },
  { id: "paint_hood", shape: "box", center: [0, 1, 1.75], half: [0.96, 0.1, 0.78], round: 0.05, bone: "root", blend: 0.03, color: [0.62, 0.1, 0.08, 1], roughness: 0.3, metal: 0.45 },
  { id: "paint_nose", shape: "box", center: [0, 0.82, 2.45], half: [0.94, 0.25, 0.1], round: 0.07, bone: "root", blend: 0.03, color: [0.62, 0.1, 0.08, 1], roughness: 0.3, metal: 0.45 },
  { id: "paint_cab_lower", shape: "box", center: [0, 0.86, -0.08], half: [1, 0.28, 0.98], round: 0.06, bone: "root", blend: 0.03, color: [0.62, 0.1, 0.08, 1], roughness: 0.3, metal: 0.45 },
  { id: "paint_bed_floor", shape: "box", center: [0, 0.9, -1.78], half: [0.94, 0.04, 0.9], bone: "root", color: [0.42, 0.06, 0.05, 1], roughness: 0.5 },
  { id: "paint_bed_side", shape: "box", center: [0.95, 1.1, -1.78], half: [0.045, 0.22, 0.92], round: 0.02, bone: "root", mirror: "x", color: [0.62, 0.1, 0.08, 1], roughness: 0.3, metal: 0.45 },
  { id: "paint_bed_head", shape: "box", center: [0, 1.1, -0.9], half: [0.94, 0.22, 0.045], round: 0.02, bone: "root", color: [0.62, 0.1, 0.08, 1], roughness: 0.3, metal: 0.45 },
  { id: "paint_bed_tail", shape: "box", center: [0, 1.1, -2.7], half: [0.94, 0.22, 0.045], round: 0.02, bone: "root", color: [0.62, 0.1, 0.08, 1], roughness: 0.3, metal: 0.45 },
  { id: "arch_f", shape: "cylinder", center: [0.86, 0.38, 1.7], axis: "x", radius: 0.49, half: 0.26, bone: "root", mirror: "x", op: "subtract" },
  { id: "arch_r", shape: "cylinder", center: [0.86, 0.38, -1.5], axis: "x", radius: 0.49, half: 0.26, bone: "root", mirror: "x", op: "subtract" },
  { id: "cabin_cut", shape: "box", center: [0, 0.82, -0.12], half: [0.84, 0.46, 0.84], bone: "root", op: "subtract" },
  { id: "door_cut_0", shape: "box", center: [1, 0.84, 0.27], half: [0.12, 0.3, 0.56], bone: "root", mirror: "x", op: "subtract" },
  { id: "pillar_a", shape: "loft", points: [[0.9, 1.04, 0.84], [0.82, 1.62, 0.3]], radii: [0.045, 0.0405], radii_v: [0.045, 0.0405], square: 0.85, bone: "root", color: [0.42, 0.06, 0.05, 1], mirror: "x", island: "greenhouse" },
  { id: "pillar_b", shape: "loft", points: [[0.92, 1, -0.9], [0.84, 1.62, -0.86]], radii: [0.05, 0.045000000000000005], radii_v: [0.05, 0.045000000000000005], square: 0.85, bone: "root", color: [0.42, 0.06, 0.05, 1], mirror: "x", island: "greenhouse" },
  { id: "roof_rail", shape: "loft", points: [[0.84, 1.63, 0.3], [0.84, 1.63, -0.86]], radii: [0.035, 0.03150000000000001], radii_v: [0.035, 0.03150000000000001], square: 0.85, bone: "root", color: [0.42, 0.06, 0.05, 1], mirror: "x", island: "greenhouse" },
  { id: "paint_roof", shape: "box", center: [0, 1.65, -0.28], half: [0.86, 0.035, 0.6], round: 0.03, bone: "root", island: "greenhouse", color: [0.62, 0.1, 0.08, 1], roughness: 0.3, metal: 0.45 },
  { id: "glass_screen", shape: "loft", points: [[0, 1.04, 0.88], [0, 1.62, 0.3]], radii: [0.86, 0.8], radii_v: [0.02, 0.02], square: 0.9, bone: "root", island: "glass", color: [0.07, 0.1, 0.13, 1], roughness: 0.04 },
  { id: "glass_back", shape: "box", center: [0, 1.32, -0.88], half: [0.78, 0.26, 0.015], bone: "root", island: "glass", color: [0.07, 0.1, 0.13, 1], roughness: 0.04 },
  { id: "glass_side", shape: "box", center: [0.94, 1.32, -0.55], half: [0.012, 0.24, 0.3], bone: "root", color: [0.07, 0.1, 0.13, 1], island: "glass", mirror: "x", roughness: 0.04 },
  { id: "bumper_f", shape: "box", center: [0, 0.5, 2.58], half: [0.98, 0.14, 0.07], bone: "root", color: [0.7, 0.72, 0.75, 1], island: "trim", round: 0.04, metal: 0.8, roughness: 0.3 },
  { id: "bumper_r", shape: "box", center: [0, 0.5, -2.74], half: [0.98, 0.14, 0.06], bone: "root", color: [0.7, 0.72, 0.75, 1], island: "trim", round: 0.04, metal: 0.8, roughness: 0.3 },
  { id: "grille", shape: "box", center: [0, 0.86, 2.54], half: [0.55, 0.14, 0.02], bone: "root", color: [0.03, 0.03, 0.035, 1], island: "trim" },
  { id: "head_lamp", shape: "ellipsoid", center: [0.72, 0.9, 2.5], radii: [0.17, 0.09, 0.04], bone: "root", island: "trim", mirror: "x", color: [0.95, 0.92, 0.75, 1], roughness: 0.1 },
  { id: "tail_lamp", shape: "box", center: [0.8, 1.05, -2.76], half: [0.1, 0.12, 0.02], bone: "root", color: [0.8, 0.05, 0.05, 1], island: "trim", mirror: "x", roughness: 0.15 },
  { id: "plate_r", shape: "box", center: [0, 0.8, -2.78], half: [0.22, 0.06, 0.01], bone: "root", color: [0.9, 0.9, 0.85, 1], island: "trim" },
  { id: "exhaust", shape: "cylinder", center: [0.6, 0.42, -2.62], axis: "z", radius: 0.045, half: 0.07, bone: "root", island: "trim", color: [0.82, 0.84, 0.87, 1], metal: 0.9, roughness: 0.2 },
  { id: "step", shape: "box", center: [1.02, 0.52, -0.1], half: [0.07, 0.025, 0.65], bone: "root", mirror: "x", island: "trim", color: [0.09, 0.09, 0.1, 1] },
  { id: "cabin_floor", shape: "box", center: [0, 0.42, -0.12], half: [0.84, 0.03, 0.84], bone: "root", color: [0.14, 0.14, 0.15, 1], island: "interior" },
  { id: "dash", shape: "box", center: [0, 1.04, 0.8], half: [0.88, 0.12, 0.14], bone: "root", color: [0.13, 0.13, 0.14, 1], island: "interior", round: 0.04 },
  { id: "seat_driver_base", shape: "box", center: [0.4, 0.5, -0.08], half: [0.23, 0.07, 0.22], bone: "root", color: [0.09, 0.09, 0.1, 1], island: "interior" },
  { id: "seat_driver_cushion", shape: "box", center: [0.4, 0.57, -0.08], half: [0.26, 0.055, 0.27], bone: "root", color: [0.28, 0.27, 0.3, 1], island: "interior", round: 0.035, roughness: 0.85 },
  { id: "seat_driver_back", shape: "loft", points: [[0.4, 0.64, -0.3], [0.4, 1.22, -0.4]], radii: [0.26, 0.23], radii_v: [0.065, 0.055], square: 0.7, bone: "root", island: "interior", color: [0.28, 0.27, 0.3, 1], roughness: 0.85 },
  { id: "seat_driver_rest", shape: "ellipsoid", center: [0.4, 1.3, -0.48], radii: [0.11, 0.09, 0.05], bone: "root", island: "interior", color: [0.28, 0.27, 0.3, 1], roughness: 0.85 },
  { id: "seat_passenger_base", shape: "box", center: [-0.4, 0.5, -0.08], half: [0.23, 0.07, 0.22], bone: "root", color: [0.09, 0.09, 0.1, 1], island: "interior" },
  { id: "seat_passenger_cushion", shape: "box", center: [-0.4, 0.57, -0.08], half: [0.26, 0.055, 0.27], bone: "root", color: [0.28, 0.27, 0.3, 1], island: "interior", round: 0.035, roughness: 0.85 },
  { id: "seat_passenger_back", shape: "loft", points: [[-0.4, 0.64, -0.3], [-0.4, 1.22, -0.4]], radii: [0.26, 0.23], radii_v: [0.065, 0.055], square: 0.7, bone: "root", island: "interior", color: [0.28, 0.27, 0.3, 1], roughness: 0.85 },
  { id: "seat_passenger_rest", shape: "ellipsoid", center: [-0.4, 1.3, -0.48], radii: [0.11, 0.09, 0.05], bone: "root", island: "interior", color: [0.28, 0.27, 0.3, 1], roughness: 0.85 },
];
const sdf = { cell: 0.03, skin: { falloff: 4 }, shade: { ao: 0.3, ao_radius: 0.08, tone: 0.2, color_blend: 0 }, decimate: { ratio: 0.1, error: 0.01, max_edge: 0.8 }, islands: { wheels_f: { cell: 0.015, decimate: { ratio: 0.05, error: 0.006, max_edge: 0.3 } }, wheels_r: { cell: 0.015, decimate: { ratio: 0.05, error: 0.006, max_edge: 0.3 } }, steer: { cell: 0.01, decimate: { ratio: 0.1, error: 0.004, max_edge: 0.2 } }, doors: { cell: 0.016, decimate: { ratio: 0.08, error: 0.008, max_edge: 0.5 } }, interior: { cell: 0.016, decimate: { ratio: 0.1, error: 0.006, max_edge: 0.5 } }, greenhouse: { cell: 0.014, decimate: { ratio: 0.08, error: 0.01, max_edge: 0.8 } }, glass: { cell: 0.014, decimate: { ratio: 0.08, error: 0.01, max_edge: 0.8 } }, trim: { cell: 0.014, decimate: { ratio: 0.08, error: 0.01, max_edge: 0.8 } } }, parts: parts };
// the texture (maps.js): flakes in the paint, dirt on the lower body, the grain of the tyres
const texture = { size: 256, seed: 31, layers: [
  { kind: "noise", parts: ["paint_*"], scale: 0.004, amount: 0.12 },
  { kind: "noise", parts: ["paint_*"], scale: 0.4, octaves: 2, colour: [0, 0, 0], threshold: 0.62, strength: 0.12, edge: 0.7 },
  { kind: "gradient", parts: ["paint_*"], by: "position", axis: [0, -1, 0], from: -0.55, to: -0.3, colour: [0.22, 0.17, 0.12], strength: 0.45 },
  { kind: "cells", parts: ["tyre_*"], size: 0.035, line: 0.22, colour: [0, 0, 0], vary: 0.2, edge: 0.5, strength: 0.5 },
  { kind: "noise", parts: ["tyre_*"], scale: 0.01, amount: 0.2 }
] };
return {
  name: "pickup", max: 16,
  family: { faction: "machine", kind: "vehicle", hp: 200 },
  nav: { agent: { name: "pickup", radius: 2.7, height: 1.9, step: 0.3, slope: 32, drop: 0.4 } },
  body: {
    skeleton: bones,
    rig: rig,
    body: body,
    vehicle: vehicle,
    couplers: couplers,
    doors: doors,
    seats: seats,
    physics: physics,
    sdf: sdf,
    texture: texture
  },
  abilities: ["walk", "effects"],
  interaction: { uses: [] },
  particles: {
    exhaust: { effect: "exhaust_smoke", mount: { bone: "root", at: [0.6, 0.4, -2.7], dir: [0, 0.6, -1] }, loop: { while: "speed", from: 0.3, to: 8 }, scale: 0.5 }
  },
  mind: {
    hz: 10, far_hz: 3,
    blocks: [
      ["health", { hp: 220 }],
      ["walk", { speed: 6, run_speed: 9, wp_near: 2.5, near: 2.6, stuck_time: 5 }],
      ["avoid", { radius: 1.35, length: 5.0, margin: 0.8, neighbours: 5, look: 3, brake: 6.0, other: 0.4, edge: 3, creep: 0.8, stop_gap: 0.8, push: 1.6, slow: 0.2, max_bend: 1, turn: 2.5, relax: 1.2, settle: 4, probe: 4, bodies: 8, boxed_wait: 6, ghost: 0 }],
      ["drive", { top: 32, grip: 6, wheelbase: 3.2, max_steer: 0.52, steer_speed: 24 }],
      ["wander", { speed: 6, pause_min: 2, pause_max: 7, near: 2.6 }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first.
    worker: function (api, ld) {
      var tree = { name: "pickup", select: [ld.node("wander")] };
      return { tree: tree };
    }
  }
};
