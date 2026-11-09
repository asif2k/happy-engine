"use strict";
// sports_car: a two seat sports car with a loud engine, rear wheel drive and a wing. WRITTEN by system/vehicles.js: edit its table and run the tool again rather than this file.
// a 4.4 m rear wheel drive coupe of 1,380 kg: a high revving engine of about 330 kW behind a six speed box that shifts by itself, stiff springs, wide grippy tyres, a wing that presses it down. Two long doors, two bucket seats.
// A DYNAMIC VEHICLE (`vehicle.realism`, world.cpp, SYSTEM.md "Vehicles with suspension and an engine"): every wheel looks down at the ground and stands on a spring and a damper under a sprung body (it dives, squats and rolls, and the weight moves from wheel to wheel), the engine's torque goes through a gearbox that shifts by itself and a differential to wheels that are flywheels, and the tyres make their force from their slip: they grip, spin, lock and slide.
// DOORS (a door is a bone hinged at its front edge: `doors`, species.js) and SEATS (`seats`: system.enter walks a person to the door, the door opens, the person sits with its feet on the pedals and its hands on the wheel; sp.set_controls drives). The steering wheel is a bone of its own that the page turns (the `steering` entry of `doors` is its axis).
// ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS { name, family, nav, body, abilities, interaction, mind }. Metres, +x to its left, +y up, +z forward, the wheels on y = 0 (a wheel is a bone whose HEAD is the hub).
const bones = [
  { name: "root", head: [0, 0.4, -2.2], tail: [0, 0.4, 2.2] },
  { name: "wheel_f_l", parent: "root", head: [0.82, 0.33, 1.36], tail: [0.82, 0.43000000000000005, 1.36], mirror: "x" },
  { name: "wheel_r_l", parent: "root", head: [0.82, 0.33, -1.24], tail: [0.82, 0.43000000000000005, -1.24], mirror: "x" },
  { name: "steer", parent: "root", head: [0.4, 0.66, 0.58], tail: [0.5, 0.66, 0.58] },
  { name: "door_f_l", parent: "root", head: [0.97, 0.66, 0.62], tail: [0.97, 0.66, -0.46], mirror: "x" },
];
const rig = { joints: [
    { bone: "steer", kind: "hinge", axis: [0, 0.5, -0.866], range: [-100, 100] },
    { bone: "door_f_l", kind: "hinge", axis: [0, 1, 0], range: [-100, 0] },
    { bone: "door_f_r", kind: "hinge", axis: [0, 1, 0], range: [0, 100] },
  ], chains: [] };
const body = { max_speed: 78, accel: 10, turn_rate: 2, gravity: 9.81, step: 0.1, radius: 2.3 };
const vehicle = { wheels: [{ bone: "wheel_f_l", drive: 0, steer: 1, handbrake: undefined, brake: 1 }, { bone: "wheel_f_r", drive: 0, steer: 1, handbrake: undefined, brake: 1 }, { bone: "wheel_r_l", drive: 1, steer: 0, handbrake: undefined, brake: 1 }, { bone: "wheel_r_r", drive: 1, steer: 0, handbrake: undefined, brake: 1 }], model: "car", top_speed: 78, grip: 10, max_steer: 0.5, steer_rate: 6, steer_speed: 35, travel: 0.09, follow: 24, lean: 1, realism: { cg: 0.42, suspension: { hz: 1.9, damping: 0.5, bump: 20 }, engine: { power: 330, idle: 1000, redline: 8200, inertia: 0.18 }, gearbox: { ratios: [3.6, 2.35, 1.7, 1.3, 1.05, 0.86], up: 7600, down: 3400, time: 0.14 }, tyres: { grip: 1.3, stiff_long: 18, stiff_lat: 20 }, aero: { drag: 0.38, downforce: 0.6 }, diff: 0.6 } };
const couplers = { rear: [0, 0.4, -2.3], front: [0, 0.4, 2.3] };
const doors = { steering: { bone: "steer", open: 1.5, speed: 10, at: [0, 0, 0], axis: [0, 0.5, -0.866] }, f_left: { bone: "door_f_l", open: -1, speed: 3, at: [1.47, 0, 0.08] }, f_right: { bone: "door_f_r", open: 1, speed: 3, at: [-1.47, 0, 0.08] } };
const seats = { driver: { at: [0.4, 0.4, -0.34], yaw: 0, feet: { left: [0.52, 0.2, 0.36], right: [0.3, 0.2, 0.42] }, hands: { left: [0.555, 0.74, 0.58], right: [0.245, 0.74, 0.58] }, door: "f_left", exit: [1.45, 0, -0.1] }, passenger: { at: [-0.4, 0.4, -0.34], yaw: 0, feet: { left: [-0.28, 0.2, 0.36], right: [-0.5, 0.2, 0.36] }, door: "f_right", exit: [-1.45, 0, -0.1] } };
const physics = { mass: 1380, shapes: [
    { id: "body", shape: "box", center: [0, 0.5, 0], half: [0.98, 0.32, 2.2], bone: "root" },
  ] };
// the sdf's parts: the paint is `paint_*` (the texture's), the glass `glass*`, the cabin's things are in an island of their own (the tub's cuts do not touch them), the doors in another (they swing)
const parts = [
  { id: "tyre_f", shape: "cylinder", center: [0.82, 0.33, 1.36], axis: "x", radius: 0.33, half: 0.14, round: 0.07700000000000001, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.035, 0.035, 0.04, 1], roughness: 0.9 },
  { id: "rim_f", shape: "cylinder", center: [0.82, 0.33, 1.36], axis: "x", radius: 0.23099999999999998, half: 0.15200000000000002, round: 0.012, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.12, 0.12, 0.14, 1], metal: 0.85, roughness: 0.25 },
  { id: "disc_f", shape: "cylinder", center: [0.75, 0.33, 1.36], axis: "x", radius: 0.15180000000000002, half: 0.02, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.35, 0.35, 0.38, 1], metal: 0.7, roughness: 0.4 },
  { id: "boss_f", shape: "cylinder", center: [0.82, 0.33, 1.36], axis: "x", radius: 0.0858, half: 0.168, round: 0.012, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "nut_f0", shape: "sphere", center: [0.99, 0.393, 1.38], radius: 0.018, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_f1", shape: "sphere", center: [0.99, 0.331, 1.426], radius: 0.018, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_f2", shape: "sphere", center: [0.99, 0.268, 1.381], radius: 0.018, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_f3", shape: "sphere", center: [0.99, 0.29, 1.307], radius: 0.018, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_f4", shape: "sphere", center: [0.99, 0.368, 1.306], radius: 0.018, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "tyre_r", shape: "cylinder", center: [0.82, 0.33, -1.24], axis: "x", radius: 0.33, half: 0.14, round: 0.07700000000000001, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.035, 0.035, 0.04, 1], roughness: 0.9 },
  { id: "rim_r", shape: "cylinder", center: [0.82, 0.33, -1.24], axis: "x", radius: 0.23099999999999998, half: 0.15200000000000002, round: 0.012, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.12, 0.12, 0.14, 1], metal: 0.85, roughness: 0.25 },
  { id: "disc_r", shape: "cylinder", center: [0.75, 0.33, -1.24], axis: "x", radius: 0.15180000000000002, half: 0.02, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.35, 0.35, 0.38, 1], metal: 0.7, roughness: 0.4 },
  { id: "boss_r", shape: "cylinder", center: [0.82, 0.33, -1.24], axis: "x", radius: 0.0858, half: 0.168, round: 0.012, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "nut_r0", shape: "sphere", center: [0.99, 0.393, -1.22], radius: 0.018, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_r1", shape: "sphere", center: [0.99, 0.331, -1.174], radius: 0.018, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_r2", shape: "sphere", center: [0.99, 0.268, -1.219], radius: 0.018, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_r3", shape: "sphere", center: [0.99, 0.29, -1.293], radius: 0.018, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_r4", shape: "sphere", center: [0.99, 0.368, -1.294], radius: 0.018, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "steer_ring", shape: "torus", center: [0.4, 0.66, 0.58], axis: [0, 0.5, -0.866], radius: 0.18, tube: 0.021, bone: "steer", island: "steer", color: [0.03, 0.03, 0.035, 1], roughness: 0.6 },
  { id: "steer_hub", shape: "sphere", center: [0.4, 0.66, 0.58], radius: 0.045, bone: "steer", island: "steer", color: [0.09, 0.09, 0.1, 1] },
  { id: "steer_spoke", shape: "capsule", a: [0.23, 0.66, 0.58], b: [0.57, 0.66, 0.58], radius: 0.014, bone: "steer", island: "steer", color: [0.09, 0.09, 0.1, 1] },
  { id: "steer_spoke_b", shape: "capsule", a: [0.4, 0.66, 0.58], b: [0.4, 0.51, 0.493], radius: 0.014, bone: "steer", island: "steer", color: [0.09, 0.09, 0.1, 1] },
  { id: "df_panel", shape: "box", center: [0.995, 0.48, 0.08], half: [0.03, 0.18, 0.54], round: 0.02, bone: "door_f_l", island: "doors", mirror: "x", color: [0.85, 0.62, 0.05, 1] },
  { id: "df_rail", shape: "box", center: [0.97, 1.1, 0.08], half: [0.035, 0.02, 0.54], round: 0.01, bone: "door_f_l", island: "doors", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "df_post_f", shape: "box", center: [0.97, 0.89, 0.6], half: [0.03, 0.23, 0.025], bone: "door_f_l", island: "doors", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "df_post_r", shape: "box", center: [0.97, 0.89, -0.44], half: [0.03, 0.23, 0.025], bone: "door_f_l", island: "doors", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "df_handle", shape: "box", center: [1.04, 0.62, -0.32], half: [0.014, 0.018, 0.065], round: 0.008, bone: "door_f_l", island: "doors", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9, roughness: 0.2 },
  { id: "df_mirror", shape: "box", center: [1.07, 0.86, 0.56], half: [0.05, 0.05, 0.035], round: 0.025, bone: "door_f_l", island: "doors", mirror: "x", color: [0.85, 0.62, 0.05, 1] },
  { id: "df_mirror_stem", shape: "capsule", a: [0.99, 0.68, 0.56], b: [1.05, 0.83, 0.56], radius: 0.014, bone: "door_f_l", island: "doors", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "paint_tub", shape: "box", center: [0, 0.44, 0], half: [0.97, 0.2, 2.1], round: 0.1, bone: "root", blend: 0.03, color: [0.85, 0.62, 0.05, 1], roughness: 0.2, metal: 0.6 },
  { id: "paint_hood", shape: "box", center: [0, 0.62, 1.4], half: [0.92, 0.055, 0.78], round: 0.04, bone: "root", blend: 0.04, color: [0.85, 0.62, 0.05, 1], roughness: 0.2, metal: 0.6 },
  { id: "paint_nose", shape: "box", center: [0, 0.46, 2.1], half: [0.88, 0.14, 0.12], round: 0.07, bone: "root", blend: 0.04, color: [0.85, 0.62, 0.05, 1], roughness: 0.2, metal: 0.6 },
  { id: "paint_deck", shape: "box", center: [0, 0.66, -1.5], half: [0.92, 0.07, 0.65], round: 0.05, bone: "root", blend: 0.04, color: [0.85, 0.62, 0.05, 1], roughness: 0.2, metal: 0.6 },
  { id: "paint_tail", shape: "box", center: [0, 0.55, -2.1], half: [0.9, 0.16, 0.07], round: 0.06, bone: "root", blend: 0.03, color: [0.85, 0.62, 0.05, 1], roughness: 0.2, metal: 0.6 },
  { id: "arch_f", shape: "cylinder", center: [0.84, 0.33, 1.36], axis: "x", radius: 0.4, half: 0.24, bone: "root", mirror: "x", op: "subtract" },
  { id: "arch_r", shape: "cylinder", center: [0.84, 0.33, -1.24], axis: "x", radius: 0.4, half: 0.24, bone: "root", mirror: "x", op: "subtract" },
  { id: "cabin_cut", shape: "box", center: [0, 0.5, -0.38], half: [0.78, 0.34, 0.78], bone: "root", op: "subtract" },
  { id: "door_cut_0", shape: "box", center: [0.97, 0.52, 0.08], half: [0.12, 0.26, 0.55], bone: "root", mirror: "x", op: "subtract" },
  { id: "pillar_a", shape: "loft", points: [[0.84, 0.68, 0.64], [0.7, 1.12, -0.12]], radii: [0.035, 0.03150000000000001], radii_v: [0.035, 0.03150000000000001], square: 0.85, bone: "root", color: [0.09, 0.09, 0.1, 1], mirror: "x", island: "greenhouse" },
  { id: "pillar_c", shape: "loft", points: [[0.84, 0.7, -1.25], [0.66, 1.1, -0.84]], radii: [0.05, 0.045000000000000005], radii_v: [0.05, 0.045000000000000005], square: 0.85, bone: "root", color: [0.55, 0.38, 0.03, 1], mirror: "x", island: "greenhouse" },
  { id: "roof_rail", shape: "loft", points: [[0.7, 1.13, -0.12], [0.66, 1.11, -0.84]], radii: [0.03, 0.027], radii_v: [0.03, 0.027], square: 0.85, bone: "root", color: [0.09, 0.09, 0.1, 1], mirror: "x", island: "greenhouse" },
  { id: "paint_roof", shape: "box", center: [0, 1.135, -0.48], half: [0.68, 0.025, 0.4], round: 0.02, bone: "root", island: "greenhouse", color: [0.85, 0.62, 0.05, 1], roughness: 0.2, metal: 0.6 },
  { id: "glass_screen", shape: "loft", points: [[0, 0.68, 0.66], [0, 1.12, -0.12]], radii: [0.82, 0.68], radii_v: [0.02, 0.02], square: 0.9, bone: "root", island: "glass", color: [0.07, 0.1, 0.13, 1], roughness: 0.04 },
  { id: "glass_rear", shape: "loft", points: [[0, 1.11, -0.84], [0, 0.72, -1.3]], radii: [0.66, 0.8], radii_v: [0.02, 0.02], square: 0.9, bone: "root", island: "glass", color: [0.07, 0.1, 0.13, 1], roughness: 0.04 },
  { id: "splitter", shape: "box", center: [0, 0.2, 2.22], half: [0.9, 0.025, 0.14], bone: "root", color: [0.03, 0.03, 0.035, 1], island: "trim", round: 0.01 },
  { id: "wing_post", shape: "box", center: [0.5, 0.84, -1.95], half: [0.03, 0.15, 0.05], bone: "root", mirror: "x", island: "trim", color: [0.09, 0.09, 0.1, 1] },
  { id: "wing", shape: "box", center: [0, 1, -2], half: [0.88, 0.02, 0.2], round: 0.012, bone: "root", island: "trim", color: [0.55, 0.38, 0.03, 1], roughness: 0.25, metal: 0.5 },
  { id: "wing_end", shape: "box", center: [0.88, 1, -2], half: [0.012, 0.07, 0.2], bone: "root", mirror: "x", island: "trim", color: [0.55, 0.38, 0.03, 1] },
  { id: "intake", shape: "box", center: [0.99, 0.5, -0.9], half: [0.012, 0.07, 0.2], bone: "root", color: [0.03, 0.03, 0.035, 1], island: "trim", mirror: "x" },
  { id: "head_lamp", shape: "ellipsoid", center: [0.66, 0.56, 2.12], radii: [0.17, 0.045, 0.05], bone: "root", island: "trim", mirror: "x", color: [0.95, 0.92, 0.75, 1], roughness: 0.08 },
  { id: "grille", shape: "box", center: [0, 0.38, 2.2], half: [0.5, 0.07, 0.02], bone: "root", color: [0.03, 0.03, 0.035, 1], island: "trim" },
  { id: "tail_lamp", shape: "box", center: [0.62, 0.62, -2.15], half: [0.2, 0.035, 0.02], bone: "root", color: [0.8, 0.05, 0.05, 1], island: "trim", mirror: "x", roughness: 0.12 },
  { id: "exhaust", shape: "cylinder", center: [0.35, 0.3, -2.2], axis: "z", radius: 0.05, half: 0.07, bone: "root", island: "trim", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.95, roughness: 0.15 },
  { id: "plate_r", shape: "box", center: [0, 0.46, -2.18], half: [0.2, 0.05, 0.01], bone: "root", color: [0.9, 0.9, 0.85, 1], island: "trim" },
  { id: "cabin_floor", shape: "box", center: [0, 0.17, -0.38], half: [0.78, 0.025, 0.78], bone: "root", color: [0.1, 0.1, 0.11, 1], island: "interior" },
  { id: "dash", shape: "box", center: [0, 0.64, 0.7], half: [0.82, 0.07, 0.14], bone: "root", color: [0.09, 0.09, 0.1, 1], island: "interior", round: 0.04 },
  { id: "console", shape: "box", center: [0, 0.3, -0.38], half: [0.1, 0.08, 0.5], bone: "root", color: [0.1, 0.1, 0.11, 1], island: "interior", round: 0.03 },
  { id: "seat_driver_base", shape: "box", center: [0.4, 0.15, -0.34], half: [0.19, 0.07, 0.22], bone: "root", color: [0.09, 0.09, 0.1, 1], island: "interior" },
  { id: "seat_driver_cushion", shape: "box", center: [0.4, 0.22, -0.34], half: [0.22, 0.055, 0.27], bone: "root", color: [0.07, 0.07, 0.08, 1], island: "interior", round: 0.035, roughness: 0.85 },
  { id: "seat_driver_back", shape: "loft", points: [[0.4, 0.29, -0.56], [0.4, 0.87, -0.8]], radii: [0.22, 0.19], radii_v: [0.065, 0.055], square: 0.7, bone: "root", island: "interior", color: [0.07, 0.07, 0.08, 1], roughness: 0.85 },
  { id: "seat_driver_rest", shape: "ellipsoid", center: [0.4, 0.95, -0.88], radii: [0.11, 0.09, 0.05], bone: "root", island: "interior", color: [0.07, 0.07, 0.08, 1], roughness: 0.85 },
  { id: "seat_passenger_base", shape: "box", center: [-0.4, 0.15, -0.34], half: [0.19, 0.07, 0.22], bone: "root", color: [0.09, 0.09, 0.1, 1], island: "interior" },
  { id: "seat_passenger_cushion", shape: "box", center: [-0.4, 0.22, -0.34], half: [0.22, 0.055, 0.27], bone: "root", color: [0.07, 0.07, 0.08, 1], island: "interior", round: 0.035, roughness: 0.85 },
  { id: "seat_passenger_back", shape: "loft", points: [[-0.4, 0.29, -0.56], [-0.4, 0.87, -0.8]], radii: [0.22, 0.19], radii_v: [0.065, 0.055], square: 0.7, bone: "root", island: "interior", color: [0.07, 0.07, 0.08, 1], roughness: 0.85 },
  { id: "seat_passenger_rest", shape: "ellipsoid", center: [-0.4, 0.95, -0.88], radii: [0.11, 0.09, 0.05], bone: "root", island: "interior", color: [0.07, 0.07, 0.08, 1], roughness: 0.85 },
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
  name: "sports_car", max: 16,
  family: { faction: "machine", kind: "vehicle", hp: 110 },
  nav: { agent: { name: "sports_car", radius: 2.2, height: 1.2, step: 0.1, slope: 20, drop: 0.2 } },
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
    exhaust: { effect: "exhaust_smoke", mount: { bone: "root", at: [0.35, 0.3, -2.2], dir: [0, 0.6, -1] }, loop: { while: "speed", from: 0.3, to: 8 }, scale: 0.5 }
  },
  mind: {
    hz: 10, far_hz: 3,
    blocks: [
      ["health", { hp: 130 }],
      ["walk", { speed: 6, run_speed: 9, wp_near: 2.5, near: 2.6, stuck_time: 5 }],
      ["avoid", { radius: 1.1, length: 5.0, margin: 0.8, neighbours: 5, look: 3, brake: 6.0, other: 0.4, edge: 3, creep: 0.8, stop_gap: 0.8, push: 1.6, slow: 0.2, max_bend: 1, turn: 2.5, relax: 1.2, settle: 4, probe: 4, bodies: 8, boxed_wait: 6, ghost: 0 }],
      ["drive", { top: 60, grip: 9, wheelbase: 2.6, max_steer: 0.5, steer_speed: 35 }],
      ["wander", { speed: 6, pause_min: 2, pause_max: 7, near: 2.6 }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first.
    worker: function (api, ld) {
      var tree = { name: "sports_car", select: [ld.node("wander")] };
      return { tree: tree };
    }
  }
};
