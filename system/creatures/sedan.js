"use strict";
// sedan: a family saloon with four doors and four seats. WRITTEN by system/vehicles.js: edit its table and run the tool again rather than this file.
// a 4.6 m front wheel drive saloon of 1,450 kg: a petrol engine of about 100 kW behind a five speed box that shifts by itself, springs and dampers at four wheels, tyres that make their force from their slip. Four doors, four seats, a steering wheel that turns.
// A DYNAMIC VEHICLE (`vehicle.realism`, world.cpp, SYSTEM.md "Vehicles with suspension and an engine"): every wheel looks down at the ground and stands on a spring and a damper under a sprung body (it dives, squats and rolls, and the weight moves from wheel to wheel), the engine's torque goes through a gearbox that shifts by itself and a differential to wheels that are flywheels, and the tyres make their force from their slip: they grip, spin, lock and slide.
// DOORS (a door is a bone hinged at its front edge: `doors`, species.js) and SEATS (`seats`: system.enter walks a person to the door, the door opens, the person sits with its feet on the pedals and its hands on the wheel; sp.set_controls drives). The steering wheel is a bone of its own that the page turns (the `steering` entry of `doors` is its axis).
// ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS { name, family, nav, body, abilities, interaction, mind }. Metres, +x to its left, +y up, +z forward, the wheels on y = 0 (a wheel is a bone whose HEAD is the hub).
const bones = [
  { name: "root", head: [0, 0.5, -2.3], tail: [0, 0.5, 2.3] },
  { name: "wheel_f_l", parent: "root", head: [0.78, 0.32, 1.42], tail: [0.78, 0.42000000000000004, 1.42], mirror: "x" },
  { name: "wheel_r_l", parent: "root", head: [0.78, 0.32, -1.28], tail: [0.78, 0.42000000000000004, -1.28], mirror: "x" },
  { name: "steer", parent: "root", head: [0.4, 0.9, 0.5], tail: [0.5, 0.9, 0.5] },
  { name: "door_f_l", parent: "root", head: [0.9, 0.86, 0.8], tail: [0.9, 0.86, -0.1], mirror: "x" },
  { name: "door_r_l", parent: "root", head: [0.9, 0.86, -0.16], tail: [0.9, 0.86, -1.12], mirror: "x" },
];
const rig = { joints: [
    { bone: "steer", kind: "hinge", axis: [0, 0.5, -0.866], range: [-100, 100] },
    { bone: "door_f_l", kind: "hinge", axis: [0, 1, 0], range: [-100, 0] },
    { bone: "door_f_r", kind: "hinge", axis: [0, 1, 0], range: [0, 100] },
    { bone: "door_r_l", kind: "hinge", axis: [0, 1, 0], range: [-100, 0] },
    { bone: "door_r_r", kind: "hinge", axis: [0, 1, 0], range: [0, 100] },
  ], chains: [] };
const body = { max_speed: 50, accel: 8, turn_rate: 1.8, gravity: 9.81, step: 0.18, radius: 2.4 };
const vehicle = { wheels: [{ bone: "wheel_f_l", drive: 1, steer: 1, handbrake: undefined, brake: 1 }, { bone: "wheel_f_r", drive: 1, steer: 1, handbrake: undefined, brake: 1 }, { bone: "wheel_r_l", drive: 0, steer: 0, handbrake: undefined, brake: 1 }, { bone: "wheel_r_r", drive: 0, steer: 0, handbrake: undefined, brake: 1 }], model: "car", top_speed: 50, grip: 8, max_steer: 0.55, steer_rate: 5, steer_speed: 28, travel: 0.12, follow: 20, lean: 1, realism: { cg: 0.52, suspension: { hz: 1.3, damping: 0.35 }, engine: { power: 105, idle: 800, redline: 6500 }, tyres: { grip: 1.05 } } };
const couplers = { rear: [0, 0.5, -2.4], front: [0, 0.5, 2.4] };
const doors = { steering: { bone: "steer", open: 1.5, speed: 10, at: [0, 0, 0], axis: [0, 0.5, -0.866] }, f_left: { bone: "door_f_l", open: -1, speed: 3, at: [1.4, 0, 0.35] }, f_right: { bone: "door_f_r", open: 1, speed: 3, at: [-1.4, 0, 0.35] }, r_left: { bone: "door_r_l", open: -1, speed: 3, at: [1.4, 0, -0.64] }, r_right: { bone: "door_r_r", open: 1, speed: 3, at: [-1.4, 0, -0.64] } };
const seats = { driver: { at: [0.4, 0.54, -0.05], yaw: 0, feet: { left: [0.52, 0.28, 0.45], right: [0.3, 0.28, 0.5] }, hands: { left: [0.555, 0.98, 0.5], right: [0.245, 0.98, 0.5] }, door: "f_left", exit: [1.4, 0, 0.35] }, passenger: { at: [-0.4, 0.54, -0.05], yaw: 0, feet: { left: [-0.28, 0.28, 0.45], right: [-0.5, 0.28, 0.5] }, door: "f_right", exit: [-1.4, 0, 0.35] }, rear_left: { at: [0.4, 0.54, -0.95], yaw: 0, feet: { left: [0.52, 0.28, -0.45], right: [0.3, 0.28, -0.42] }, door: "r_left", exit: [1.4, 0, -0.64] }, rear_right: { at: [-0.4, 0.54, -0.95], yaw: 0, feet: { left: [-0.28, 0.28, -0.42], right: [-0.5, 0.28, -0.45] }, door: "r_right", exit: [-1.4, 0, -0.64] } };
const physics = { mass: 1450, shapes: [
    { id: "body", shape: "box", center: [0, 0.68, 0], half: [0.92, 0.45, 2.3], bone: "root" },
  ] };
// the sdf's parts: the paint is `paint_*` (the texture's), the glass `glass*`, the cabin's things are in an island of their own (the tub's cuts do not touch them), the doors in another (they swing)
const parts = [
  { id: "tyre_f", shape: "cylinder", center: [0.78, 0.32, 1.42], axis: "x", radius: 0.32, half: 0.11, round: 0.060500000000000005, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.035, 0.035, 0.04, 1], roughness: 0.9 },
  { id: "rim_f", shape: "cylinder", center: [0.78, 0.32, 1.42], axis: "x", radius: 0.21120000000000003, half: 0.122, round: 0.012, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.66, 0.68, 0.72, 1], metal: 0.85, roughness: 0.25 },
  { id: "disc_f", shape: "cylinder", center: [0.725, 0.32, 1.42], axis: "x", radius: 0.1472, half: 0.02, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.35, 0.35, 0.38, 1], metal: 0.7, roughness: 0.4 },
  { id: "boss_f", shape: "cylinder", center: [0.78, 0.32, 1.42], axis: "x", radius: 0.08320000000000001, half: 0.138, round: 0.012, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "nut_f0", shape: "sphere", center: [0.92, 0.381, 1.439], radius: 0.018, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_f1", shape: "sphere", center: [0.92, 0.321, 1.484], radius: 0.018, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_f2", shape: "sphere", center: [0.92, 0.259, 1.441], radius: 0.018, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_f3", shape: "sphere", center: [0.92, 0.282, 1.369], radius: 0.018, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_f4", shape: "sphere", center: [0.92, 0.357, 1.368], radius: 0.018, bone: "wheel_f_l", island: "wheels_f", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "tyre_r", shape: "cylinder", center: [0.78, 0.32, -1.28], axis: "x", radius: 0.32, half: 0.11, round: 0.060500000000000005, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.035, 0.035, 0.04, 1], roughness: 0.9 },
  { id: "rim_r", shape: "cylinder", center: [0.78, 0.32, -1.28], axis: "x", radius: 0.21120000000000003, half: 0.122, round: 0.012, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.66, 0.68, 0.72, 1], metal: 0.85, roughness: 0.25 },
  { id: "disc_r", shape: "cylinder", center: [0.725, 0.32, -1.28], axis: "x", radius: 0.1472, half: 0.02, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.35, 0.35, 0.38, 1], metal: 0.7, roughness: 0.4 },
  { id: "boss_r", shape: "cylinder", center: [0.78, 0.32, -1.28], axis: "x", radius: 0.08320000000000001, half: 0.138, round: 0.012, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "nut_r0", shape: "sphere", center: [0.92, 0.381, -1.261], radius: 0.018, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_r1", shape: "sphere", center: [0.92, 0.321, -1.216], radius: 0.018, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_r2", shape: "sphere", center: [0.92, 0.259, -1.259], radius: 0.018, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_r3", shape: "sphere", center: [0.92, 0.282, -1.331], radius: 0.018, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "nut_r4", shape: "sphere", center: [0.92, 0.357, -1.332], radius: 0.018, bone: "wheel_r_l", island: "wheels_r", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9 },
  { id: "steer_ring", shape: "torus", center: [0.4, 0.9, 0.5], axis: [0, 0.5, -0.866], radius: 0.18, tube: 0.021, bone: "steer", island: "steer", color: [0.03, 0.03, 0.035, 1], roughness: 0.6 },
  { id: "steer_hub", shape: "sphere", center: [0.4, 0.9, 0.5], radius: 0.045, bone: "steer", island: "steer", color: [0.09, 0.09, 0.1, 1] },
  { id: "steer_spoke", shape: "capsule", a: [0.23, 0.9, 0.5], b: [0.57, 0.9, 0.5], radius: 0.014, bone: "steer", island: "steer", color: [0.09, 0.09, 0.1, 1] },
  { id: "steer_spoke_b", shape: "capsule", a: [0.4, 0.9, 0.5], b: [0.4, 0.75, 0.413], radius: 0.014, bone: "steer", island: "steer", color: [0.09, 0.09, 0.1, 1] },
  { id: "df_panel", shape: "box", center: [0.925, 0.665, 0.35], half: [0.03, 0.195, 0.45], round: 0.02, bone: "door_f_l", island: "doors", mirror: "x", color: [0.1, 0.22, 0.46, 1] },
  { id: "df_rail", shape: "box", center: [0.9, 1.4, 0.35], half: [0.035, 0.02, 0.45], round: 0.01, bone: "door_f_l", island: "doors", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "df_post_f", shape: "box", center: [0.9, 1.14, 0.78], half: [0.03, 0.28, 0.025], bone: "door_f_l", island: "doors", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "df_post_r", shape: "box", center: [0.9, 1.14, -0.08], half: [0.03, 0.28, 0.025], bone: "door_f_l", island: "doors", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "df_handle", shape: "box", center: [0.97, 0.82, 0.04], half: [0.014, 0.018, 0.065], round: 0.008, bone: "door_f_l", island: "doors", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9, roughness: 0.2 },
  { id: "df_mirror", shape: "box", center: [1, 1.06, 0.72], half: [0.05, 0.05, 0.035], round: 0.025, bone: "door_f_l", island: "doors", mirror: "x", color: [0.1, 0.22, 0.46, 1] },
  { id: "df_mirror_stem", shape: "capsule", a: [0.92, 0.88, 0.72], b: [0.98, 1.03, 0.72], radius: 0.014, bone: "door_f_l", island: "doors", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "dr_panel", shape: "box", center: [0.925, 0.665, -0.64], half: [0.03, 0.195, 0.48], round: 0.02, bone: "door_r_l", island: "doors", mirror: "x", color: [0.1, 0.22, 0.46, 1] },
  { id: "dr_rail", shape: "box", center: [0.9, 1.4, -0.64], half: [0.035, 0.02, 0.48], round: 0.01, bone: "door_r_l", island: "doors", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "dr_post_f", shape: "box", center: [0.9, 1.14, -0.18], half: [0.03, 0.28, 0.025], bone: "door_r_l", island: "doors", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "dr_post_r", shape: "box", center: [0.9, 1.14, -1.1], half: [0.03, 0.28, 0.025], bone: "door_r_l", island: "doors", mirror: "x", color: [0.09, 0.09, 0.1, 1] },
  { id: "dr_handle", shape: "box", center: [0.97, 0.82, -0.98], half: [0.014, 0.018, 0.065], round: 0.008, bone: "door_r_l", island: "doors", mirror: "x", color: [0.82, 0.84, 0.87, 1], metal: 0.9, roughness: 0.2 },
  { id: "paint_tub", shape: "box", center: [0, 0.58, 0], half: [0.9, 0.28, 2.25], round: 0.09, bone: "root", blend: 0.02, color: [0.1, 0.22, 0.46, 1], roughness: 0.28, metal: 0.5 },
  { id: "paint_hood", shape: "box", center: [0, 0.92, 1.6], half: [0.88, 0.055, 0.68], round: 0.03, bone: "root", blend: 0.03, color: [0.1, 0.22, 0.46, 1], roughness: 0.28, metal: 0.5 },
  { id: "paint_nose", shape: "box", center: [0, 0.73, 2.2], half: [0.86, 0.2, 0.1], round: 0.06, bone: "root", blend: 0.03, color: [0.1, 0.22, 0.46, 1], roughness: 0.28, metal: 0.5 },
  { id: "paint_trunk", shape: "box", center: [0, 0.93, -1.95], half: [0.88, 0.055, 0.32], round: 0.03, bone: "root", blend: 0.03, color: [0.1, 0.22, 0.46, 1], roughness: 0.28, metal: 0.5 },
  { id: "paint_tail", shape: "box", center: [0, 0.75, -2.2], half: [0.86, 0.18, 0.07], round: 0.05, bone: "root", blend: 0.03, color: [0.1, 0.22, 0.46, 1], roughness: 0.28, metal: 0.5 },
  { id: "paint_cowl", shape: "box", center: [0, 0.97, 0.9], half: [0.86, 0.06, 0.1], round: 0.03, bone: "root", blend: 0.03, color: [0.07, 0.15, 0.33, 1], roughness: 0.35 },
  { id: "arch_f", shape: "cylinder", center: [0.78, 0.32, 1.42], axis: "x", radius: 0.43, half: 0.24, bone: "root", mirror: "x", op: "subtract" },
  { id: "arch_r", shape: "cylinder", center: [0.78, 0.32, -1.28], axis: "x", radius: 0.43, half: 0.24, bone: "root", mirror: "x", op: "subtract" },
  { id: "cabin_cut", shape: "box", center: [0, 0.66, -0.45], half: [0.76, 0.42, 1.2], bone: "root", op: "subtract" },
  { id: "door_cut_0", shape: "box", center: [0.9, 0.705, 0.35], half: [0.12, 0.275, 0.46], bone: "root", mirror: "x", op: "subtract" },
  { id: "door_cut_1", shape: "box", center: [0.9, 0.705, -0.64], half: [0.12, 0.275, 0.49], bone: "root", mirror: "x", op: "subtract" },
  { id: "pillar_a", shape: "loft", points: [[0.8, 0.93, 0.82], [0.73, 1.42, 0.24]], radii: [0.04, 0.036000000000000004], radii_v: [0.04, 0.036000000000000004], square: 0.85, bone: "root", color: [0.07, 0.15, 0.33, 1], mirror: "x", island: "greenhouse" },
  { id: "pillar_b", shape: "loft", points: [[0.88, 0.9, -0.14], [0.77, 1.42, -0.14]], radii: [0.036, 0.0324], radii_v: [0.036, 0.0324], square: 0.85, bone: "root", color: [0.09, 0.09, 0.1, 1], mirror: "x", island: "greenhouse" },
  { id: "pillar_c", shape: "loft", points: [[0.82, 0.93, -1.5], [0.72, 1.42, -1.02]], radii: [0.05, 0.045000000000000005], radii_v: [0.05, 0.045000000000000005], square: 0.85, bone: "root", color: [0.07, 0.15, 0.33, 1], mirror: "x", island: "greenhouse" },
  { id: "roof_rail", shape: "loft", points: [[0.75, 1.43, 0.24], [0.73, 1.43, -1.02]], radii: [0.03, 0.027], radii_v: [0.03, 0.027], square: 0.85, bone: "root", color: [0.07, 0.15, 0.33, 1], mirror: "x", island: "greenhouse" },
  { id: "paint_roof", shape: "box", center: [0, 1.445, -0.39], half: [0.74, 0.03, 0.66], round: 0.025, bone: "root", island: "greenhouse", color: [0.1, 0.22, 0.46, 1], roughness: 0.28, metal: 0.5 },
  { id: "glass_screen", shape: "loft", points: [[0, 0.95, 0.84], [0, 1.42, 0.24]], radii: [0.76, 0.7], radii_v: [0.02, 0.02], square: 0.9, bone: "root", island: "glass", color: [0.07, 0.1, 0.13, 1], roughness: 0.04 },
  { id: "glass_rear", shape: "loft", points: [[0, 1.42, -1.02], [0, 0.95, -1.52]], radii: [0.7, 0.76], radii_v: [0.02, 0.02], square: 0.9, bone: "root", island: "glass", color: [0.07, 0.1, 0.13, 1], roughness: 0.04 },
  { id: "glass_quarter", shape: "box", center: [0.84, 1.17, -1.27], half: [0.012, 0.2, 0.2], bone: "root", color: [0.07, 0.1, 0.13, 1], island: "glass", mirror: "x", roughness: 0.04 },
  { id: "bumper_f", shape: "box", center: [0, 0.46, 2.33], half: [0.88, 0.12, 0.06], bone: "root", color: [0.09, 0.09, 0.1, 1], island: "trim", round: 0.04 },
  { id: "bumper_r", shape: "box", center: [0, 0.46, -2.33], half: [0.88, 0.12, 0.06], bone: "root", color: [0.09, 0.09, 0.1, 1], island: "trim", round: 0.04 },
  { id: "grille", shape: "box", center: [0, 0.72, 2.3], half: [0.42, 0.08, 0.02], bone: "root", color: [0.03, 0.03, 0.035, 1], island: "trim" },
  { id: "head_lamp", shape: "ellipsoid", center: [0.62, 0.8, 2.27], radii: [0.16, 0.07, 0.04], bone: "root", island: "trim", mirror: "x", color: [0.95, 0.92, 0.75, 1], roughness: 0.1 },
  { id: "tail_lamp", shape: "box", center: [0.68, 0.8, -2.28], half: [0.14, 0.06, 0.025], bone: "root", color: [0.8, 0.05, 0.05, 1], island: "trim", mirror: "x", roughness: 0.15 },
  { id: "plate_f", shape: "box", center: [0, 0.5, 2.37], half: [0.2, 0.05, 0.01], bone: "root", color: [0.9, 0.9, 0.85, 1], island: "trim" },
  { id: "plate_r", shape: "box", center: [0, 0.78, -2.3], half: [0.2, 0.05, 0.01], bone: "root", color: [0.9, 0.9, 0.85, 1], island: "trim" },
  { id: "exhaust", shape: "cylinder", center: [0.55, 0.36, -2.36], axis: "z", radius: 0.04, half: 0.06, bone: "root", island: "trim", color: [0.82, 0.84, 0.87, 1], metal: 0.9, roughness: 0.2 },
  { id: "cabin_floor", shape: "box", center: [0, 0.24, -0.45], half: [0.76, 0.03, 1.2], bone: "root", color: [0.16, 0.15, 0.14, 1], island: "interior" },
  { id: "dash", shape: "box", center: [0, 0.9, 0.76], half: [0.8, 0.1, 0.14], bone: "root", color: [0.15, 0.14, 0.13, 1], island: "interior", round: 0.04 },
  { id: "console", shape: "box", center: [0, 0.4, -0.05], half: [0.1, 0.09, 0.5], bone: "root", color: [0.14, 0.13, 0.12, 1], island: "interior", round: 0.03 },
  { id: "seat_driver_base", shape: "box", center: [0.4, 0.3, -0.05], half: [0.2, 0.07, 0.22], bone: "root", color: [0.09, 0.09, 0.1, 1], island: "interior" },
  { id: "seat_driver_cushion", shape: "box", center: [0.4, 0.37, -0.05], half: [0.23, 0.055, 0.27], bone: "root", color: [0.62, 0.55, 0.42, 1], island: "interior", round: 0.035, roughness: 0.85 },
  { id: "seat_driver_back", shape: "loft", points: [[0.4, 0.44, -0.27], [0.4, 1.02, -0.37]], radii: [0.23, 0.2], radii_v: [0.065, 0.055], square: 0.7, bone: "root", island: "interior", color: [0.62, 0.55, 0.42, 1], roughness: 0.85 },
  { id: "seat_driver_rest", shape: "ellipsoid", center: [0.4, 1.1, -0.45], radii: [0.11, 0.09, 0.05], bone: "root", island: "interior", color: [0.62, 0.55, 0.42, 1], roughness: 0.85 },
  { id: "seat_passenger_base", shape: "box", center: [-0.4, 0.3, -0.05], half: [0.2, 0.07, 0.22], bone: "root", color: [0.09, 0.09, 0.1, 1], island: "interior" },
  { id: "seat_passenger_cushion", shape: "box", center: [-0.4, 0.37, -0.05], half: [0.23, 0.055, 0.27], bone: "root", color: [0.62, 0.55, 0.42, 1], island: "interior", round: 0.035, roughness: 0.85 },
  { id: "seat_passenger_back", shape: "loft", points: [[-0.4, 0.44, -0.27], [-0.4, 1.02, -0.37]], radii: [0.23, 0.2], radii_v: [0.065, 0.055], square: 0.7, bone: "root", island: "interior", color: [0.62, 0.55, 0.42, 1], roughness: 0.85 },
  { id: "seat_passenger_rest", shape: "ellipsoid", center: [-0.4, 1.1, -0.45], radii: [0.11, 0.09, 0.05], bone: "root", island: "interior", color: [0.62, 0.55, 0.42, 1], roughness: 0.85 },
  { id: "seat_rear_left_base", shape: "box", center: [0.4, 0.3, -0.95], half: [0.2, 0.07, 0.22], bone: "root", color: [0.09, 0.09, 0.1, 1], island: "interior" },
  { id: "seat_rear_left_cushion", shape: "box", center: [0.4, 0.37, -0.95], half: [0.23, 0.055, 0.27], bone: "root", color: [0.62, 0.55, 0.42, 1], island: "interior", round: 0.035, roughness: 0.85 },
  { id: "seat_rear_left_back", shape: "loft", points: [[0.4, 0.44, -1.17], [0.4, 1.02, -1.33]], radii: [0.23, 0.2], radii_v: [0.065, 0.055], square: 0.7, bone: "root", island: "interior", color: [0.62, 0.55, 0.42, 1], roughness: 0.85 },
  { id: "seat_rear_left_rest", shape: "ellipsoid", center: [0.4, 1.1, -1.41], radii: [0.11, 0.09, 0.05], bone: "root", island: "interior", color: [0.62, 0.55, 0.42, 1], roughness: 0.85 },
  { id: "seat_rear_right_base", shape: "box", center: [-0.4, 0.3, -0.95], half: [0.2, 0.07, 0.22], bone: "root", color: [0.09, 0.09, 0.1, 1], island: "interior" },
  { id: "seat_rear_right_cushion", shape: "box", center: [-0.4, 0.37, -0.95], half: [0.23, 0.055, 0.27], bone: "root", color: [0.62, 0.55, 0.42, 1], island: "interior", round: 0.035, roughness: 0.85 },
  { id: "seat_rear_right_back", shape: "loft", points: [[-0.4, 0.44, -1.17], [-0.4, 1.02, -1.33]], radii: [0.23, 0.2], radii_v: [0.065, 0.055], square: 0.7, bone: "root", island: "interior", color: [0.62, 0.55, 0.42, 1], roughness: 0.85 },
  { id: "seat_rear_right_rest", shape: "ellipsoid", center: [-0.4, 1.1, -1.41], radii: [0.11, 0.09, 0.05], bone: "root", island: "interior", color: [0.62, 0.55, 0.42, 1], roughness: 0.85 },
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
  name: "sedan", max: 16,
  family: { faction: "machine", kind: "vehicle", hp: 140 },
  nav: { agent: { name: "sedan", radius: 2.3, height: 1.5, step: 0.18, slope: 28, drop: 0.3 } },
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
    exhaust: { effect: "exhaust_smoke", mount: { bone: "root", at: [0.55, 0.34, -2.2], dir: [0, 0.6, -1] }, loop: { while: "speed", from: 0.3, to: 8 }, scale: 0.5 }
  },
  mind: {
    hz: 10, far_hz: 3,
    blocks: [
      ["health", { hp: 160 }],
      ["walk", { speed: 6, run_speed: 9, wp_near: 2.5, near: 2.6, stuck_time: 5 }],
      ["avoid", { radius: 1.15, length: 5.0, margin: 0.8, neighbours: 5, look: 3, brake: 6.0, other: 0.4, edge: 3, creep: 0.8, stop_gap: 0.8, push: 1.6, slow: 0.2, max_bend: 1, turn: 2.5, relax: 1.2, settle: 4, probe: 4, bodies: 8, boxed_wait: 6, ghost: 0 }],
      ["drive", { top: 40, grip: 7, wheelbase: 2.7, max_steer: 0.55, steer_speed: 28 }],
      ["wander", { speed: 6, pause_min: 2, pause_max: 7, near: 2.6 }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first.
    worker: function (api, ld) {
      var tree = { name: "sedan", select: [ld.node("wander")] };
      return { tree: tree };
    }
  }
};
