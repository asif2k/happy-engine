"use strict";
// jet: in soma's one form of a creature file (soma/creature_file.js): the body is the creature as it was made, the mind is the blocks of soma/world/blocks/ it loads and its tree.
// A small jet: takes off, flies a wide round at 45 m/s and lands on the runway; it needs a long way to turn.
// jet: a small jet aircraft, 7 m long, 11 m across the wings. ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature { name, skeleton, rig, body, vehicle, aircraft, physics, sdf }.
// Metres, +x to its left, +y up, +z forward. An AIRCRAFT (soma_aircraft.cpp) with NO LEGS: it is a car on its tricycle landing gear (the vehicle's wheels: the nose wheel steers with the rudder, each wheel is a bone whose head is its hub,
// and hangs on a little suspension) until the wing carries the weight, and a lifting body in the air (lift and drag from the angle of attack with a stall, a side force, thrust along the nose that fades toward the engine's speed). It is flown by a
// PILOT from the wish (`sp.set_intent` a velocity, `sp.set_climb` a climb: the take-off roll with full power, the rotation at 1.15 stall speeds, a bank toward the heading, a landing and the brakes) or with a STICK (`sp.set_controls`: throttle,
// brake, steer, handbrake, pitch, roll, yaw, flaps). The wings and the tail are rigid (fixed joints); the control surfaces are hinges across the chord with the range of a real surface that the aircraft turns by the stick (the rig's limit stop
// holds each one to it: a rudder asked for 60 degrees is at 30); the three wheels are posed by the vehicle: they spin with the ground speed, the nose wheel steers, the suspension follows the ground.
const bones = [
  { name: "fuselage", head: [0, 1.0, -3.0], tail: [0, 1.0, 3.5] },
  { name: "wing_l", parent: "fuselage", head: [0.4, 0.95, 0.4], tail: [5.5, 0.95, -0.9], mirror: "x" },
  { name: "aileron_l", parent: "wing_l", head: [4.0, 0.95, -0.55], tail: [4.0, 0.95, -1.05], mirror: "x" },          // (the control surfaces point aft: the hinge is across them)
  { name: "flap_l", parent: "wing_l", head: [1.8, 0.95, -0.2], tail: [1.8, 0.95, -0.7], mirror: "x" },
  { name: "tailplane_l", parent: "fuselage", head: [0.3, 1.1, -2.6], tail: [2.0, 1.1, -3.1], mirror: "x" },
  { name: "elevator_l", parent: "tailplane_l", head: [1.2, 1.1, -2.85], tail: [1.2, 1.1, -3.3], mirror: "x" },
  { name: "fin", parent: "fuselage", head: [0, 1.15, -2.3], tail: [0, 2.6, -3.0] },
  { name: "rudder", parent: "fin", head: [0, 2.0, -2.75], tail: [0, 2.0, -3.25] },
  // the gear: a leg that stands, and the wheel on it (a wheel is a bone whose HEAD is the hub: the vehicle spins it, steers it and moves it along the leg's up axis on a suspension of 10 cm)
  { name: "gear_nose", parent: "fuselage", head: [0, 0.85, 2.2], tail: [0, 0.55, 2.2] },
  { name: "wheel_nose", parent: "gear_nose", head: [0, 0.3, 2.2], tail: [0, 0.3, 2.35] },
  { name: "gear_l", parent: "fuselage", head: [0.9, 0.9, -0.3], tail: [0.9, 0.55, -0.3], mirror: "x" },
  { name: "wheel_l", parent: "gear_l", head: [0.9, 0.3, -0.3], tail: [0.9, 0.3, -0.15], mirror: "x" },
];
const rig = {
  joints: [
    { bone: "wing_l", mirror: "x", kind: "fixed" },
    { bone: "tailplane_l", mirror: "x", kind: "fixed" },
    { bone: "fin", kind: "fixed" },
    { bone: "aileron_l", mirror: "x", kind: "hinge", axis: [1, 0, 0], range: [-25, 25] },
    { bone: "flap_l", mirror: "x", kind: "hinge", axis: [-1, 0, 0], range: [0, 40] },             // (a surface points aft: a turn about -x puts its trailing edge DOWN, which is what a flap does)
    { bone: "elevator_l", mirror: "x", kind: "hinge", axis: [1, 0, 0], range: [-20, 25] },       // (a turn about +x puts the trailing edge UP: 25 up pitches the nose up, 20 down)
    { bone: "rudder", kind: "hinge", axis: [0, 1, 0], range: [-30, 30] },                        // (a turn about +y swings the trailing edge toward -x: to the right, which turns the nose to the right)
  ],
  chains: [],
};
// THE BODY: the mover of the root on the ground (the wish capped at the top speed, the floor, the props of the physics world: it climbs a step of 25 cm with its wheels and stops 1 m short of a wall). The gravity (m/s^2) is the g of the
// lift and of the thrust
const body = { max_speed: 95, accel: 10, turn_rate: 3, gravity: 19.8, step: 0.25, radius: 1.0 };
// THE LANDING GEAR: a car on three wheels (the nose wheel steers, the mains do not and have no handbrake); top speed 95 m/s, accel 9, brakes 10 m/s^2, grip 14 (it holds on a fast roll-out), the lock of 0.5 rad halves at 25 m/s
const vehicle = { model: "car", wheels: [{ bone: "wheel_nose", steer: 1 }, { bone: "wheel_l", steer: 0, handbrake: 0 }, { bone: "wheel_r", steer: 0, handbrake: 0 }], max_steer: 0.5, steer_rate: 6, top_speed: 95, reverse: 0.05, accel: 9, brake: 10, grip: 14, roll: 0.4, steer_speed: 25, travel: 0.1 };
// THE AIRCRAFT: stall 22 m/s, cruise 50, top 95: a fast, agile jet. Thrust 0.75 g that fades out at 160 m/s, a thin wing (cl_alpha 4, cl_max 1.1: it stalls at a fast 22 m/s), banks to 1.3 rad (75 degrees), climbs to 0.9 rad, rolls at 3.4 rad/s,
// pitches at 1.4, realism 0.5 (a player's stick has half of the arcade help). The centre of the airframe is the fuselage's axis, 1 m over the root. Seven surfaces: the ailerons (gain 0.35 = 20 degrees: the left one's trailing edge goes DOWN for a roll
// to the right, so each says its axis), the flaps (0.5: 29 degrees), the two halves of the elevator (0.34: 19.5 degrees, inside its -20 .. 25) and the rudder (0.45); each turns about its own hinge. No propeller: the thrust is the engine's. It needs a long take-off roll
const aircraft = { stall_speed: 22, cruise_speed: 50, max_speed: 95, thrust: 0.75, engine_speed: 160, cl_alpha: 4, cl_max: 1.1, rotation: 0.2, pivot: 1.0, rates: { roll: 3.4, pitch: 1.4, yaw: 0.6 }, max_bank: 1.3, max_pitch: 0.9, realism: 0.5,
  surfaces: [{ bone: "aileron_l", control: "aileron", gain: 0.35, axis: [-1, 0, 0] }, { bone: "aileron_r", control: "aileron", gain: 0.35, axis: [1, 0, 0] }, { bone: "flap_l", control: "flap", gain: 0.5 }, { bone: "flap_r", control: "flap", gain: 0.5 },
    { bone: "elevator_l", control: "elevator", gain: 0.34 }, { bone: "elevator_r", control: "elevator", gain: 0.34 }, { bone: "rudder", control: "rudder", gain: 0.45 }] };
// PHYSICS: two boxes, the fuselage and the wings, 4500 kg
const physics = { mass: 4500, shapes: [{ id: "fuselage", shape: "box", center: [0, 1.0, 0.2], half: [0.55, 0.55, 3.5], bone: "fuselage" }, { id: "wings", shape: "box", center: [0, 0.95, -0.2], half: [5.5, 0.12, 0.9], bone: "fuselage" }] };

// SDF: what the mesh is made of (the mesher's grammar: soma/SOMA_MESHER.md; the bones are the skeleton above, the parts stand on them by name, in MODEL space: the bind pose). The fuselage axis is y = 1 and z runs along it.
// The airframe is rigid (the wings, the tail, the fin are fixed joints) so its parts only need to melt into each other (`blend`: a fillet at the wing root, at the fin). What MOVES is each one of the control surfaces and the
// landing gear, and those are ISLANDS: a part of an island never blends with another island's, so a surface is a closed panel of its own (every one of its vertices follows its own bone and nothing else) and turns about
// its hinge without dragging the wing, a piston slides into its leg, a wheel spins in its fork. The wing and the tail are cut where a panel sits (a `subtract` box from the hinge line aft), and the panel fills the cut.
// A loft along a bone-like line takes `radii` (one for each point: the first of the cross section's two axes) and `radii_v` (the other one): for a loft along z that is the half width (x) and the half height (y), along x
// the half chord (z) and the half thickness (y), along y the half thickness (x) and the half chord (z). The end of a loft is a cap as deep as its thinner radius.
const WHITE = [0.90, 0.91, 0.93, 1], PALE = [0.72, 0.75, 0.80, 1], SLATE = [0.24, 0.27, 0.32, 1], GLASS = [0.22, 0.42, 0.66, 1], ORANGE = [0.96, 0.44, 0.08, 1], YELLOW = [0.97, 0.78, 0.16, 1], RED = [0.78, 0.12, 0.10, 1];
const TYRE = [0.06, 0.06, 0.07, 1], STEEL = [0.66, 0.68, 0.72, 1], BURN = [0.20, 0.18, 0.18, 1];
const parts = [
  // the fuselage: a long ogive nose with a dark radome (its profile sinks into the body behind the joint, so that the colour changes where it comes out), a tail that tapers to the nozzle, a dorsal spine
  { id: "body", shape: "loft", bone: "fuselage", points: [[0, 1, -3.05], [0, 1, -2.6], [0, 1, -2.0], [0, 1, -1.2], [0, 1, -0.4], [0, 1, 0.4], [0, 1, 1.2], [0, 1, 2.0], [0, 1, 2.7], [0, 1, 3.3], [0, 1, 3.72]],
    radii: [0.29, 0.33, 0.39, 0.46, 0.51, 0.52, 0.50, 0.44, 0.34, 0.18, 0.03], radii_v: [0.29, 0.33, 0.39, 0.45, 0.50, 0.51, 0.49, 0.43, 0.33, 0.18, 0.03], blend: 0.05, blend_mode: "cubic", color: WHITE },
  { id: "radome", shape: "loft", bone: "fuselage", points: [[0, 1, 2.2], [0, 1, 2.7], [0, 1, 2.84], [0, 1, 3.3], [0, 1, 3.72]], radii: [0.30, 0.30, 0.34, 0.19, 0.04], radii_v: [0.30, 0.30, 0.34, 0.19, 0.04], blend: 0.02, color: SLATE },
  { id: "spine", shape: "loft", bone: "fuselage", points: [[0, 1.4, 0.3], [0, 1.4, -0.6], [0, 1.37, -1.6], [0, 1.36, -2.5]], radii: [0.17, 0.16, 0.11, 0.05], radii_v: [0.15, 0.15, 0.11, 0.06], blend: 0.08, blend_mode: "cubic", color: WHITE },
  { id: "nozzle", shape: "cylinder", bone: "fuselage", center: [0, 1, -3.18], axis: "z", radius: 0.275, half: 0.16, round: 0.03, blend: 0.02, color: SLATE },
  { id: "bore", shape: "cylinder", bone: "fuselage", center: [0, 1, -3.36], axis: "z", radius: 0.2, half: 0.2, op: "subtract" },
  { id: "cone", shape: "ellipsoid", bone: "fuselage", center: [0, 1, -3.1], radii: [0.1, 0.1, 0.17], color: BURN },
  // the wings (a swept leading edge, a straight tapered trailing edge: the half chord and the half thickness of a loft along the span), a root extension of the leading edge, a tip tank on each, and the notches where the
  // flap and the aileron sit
  { id: "wing_l", shape: "loft", bone: "wing_l", points: [[0.15, 0.95, 0.347], [5.5, 0.95, -0.744]], radii: [0.77, 0.53], radii_v: [0.10, 0.05], square: 0.3, mirror: "x", blend: 0.08, blend_mode: "cubic", color: PALE },
  { id: "strake_l", shape: "loft", bone: "wing_l", points: [[0.35, 0.97, 1.78], [1.15, 0.96, 0.85]], radii: [0.05, 0.25], radii_v: [0.03, 0.055], square: 0.3, mirror: "x", blend: 0.05, blend_mode: "cubic", color: PALE },
  { id: "tank_l", shape: "capsule", bone: "wing_l", island: "tanks", a: [5.5, 0.95, -1.28], b: [5.5, 0.95, 0.05], radius: 0.14, mirror: "x", blend: 0.03, color: WHITE },
  { id: "band_l", shape: "cylinder", bone: "wing_l", island: "bands", center: [5.5, 0.95, -0.62], axis: "z", radius: 0.148, half: 0.11, mirror: "x", color: RED },
  { id: "flap_cut_l", shape: "box", bone: "wing_l", center: [1.8, 0.95, -0.65], half: [0.9, 0.25, 0.45], op: "subtract", mirror: "x" },
  { id: "aileron_cut_l", shape: "box", bone: "wing_l", center: [4.0, 0.95, -0.975], half: [0.8, 0.25, 0.425], op: "subtract", mirror: "x" },
  // the tailplane and the fin
  { id: "tailplane_l", shape: "loft", bone: "tailplane_l", points: [[0.15, 1.1, -2.718], [2.1, 1.1, -2.96]], radii: [0.577, 0.338], radii_v: [0.065, 0.05], square: 0.3, mirror: "x", blend: 0.05, blend_mode: "cubic", color: PALE },
  { id: "elevator_cut_l", shape: "box", bone: "tailplane_l", center: [1.2, 1.1, -3.125], half: [0.8, 0.2, 0.275], op: "subtract", mirror: "x" },
  { id: "fin", shape: "loft", bone: "fin", points: [[0, 1.3, -2.475], [0, 2.7, -2.775]], radii: [0.07, 0.045], radii_v: [0.758, 0.465], square: 0.3, blend: 0.07, blend_mode: "cubic", color: WHITE },
  { id: "fin_cap", shape: "loft", bone: "fin", island: "tips", points: [[0, 2.42, -2.715], [0, 2.7, -2.775]], radii: [0.058, 0.053], radii_v: [0.532, 0.473], square: 0.3, color: RED },
  { id: "rudder_cut", shape: "box", bone: "fin", center: [0, 2.06, -3.075], half: [0.2, 0.64, 0.325], op: "subtract" },
  // the control surfaces: islands, each on its own bone (the hinge is the front edge, the back edge follows the trailing edge of the wing)
  { id: "flap_l", shape: "loft", bone: "flap_l", island: "surfaces", points: [[0.99, 0.95, -0.3856], [2.61, 0.95, -0.5144]], radii: [0.185, 0.314], radii_v: [0.045, 0.04], square: 0.5, mirror: "x", color: YELLOW },
  { id: "aileron_l", shape: "loft", bone: "aileron_l", island: "surfaces", points: [[3.29, 0.95, -0.7435], [4.71, 0.95, -0.8563]], radii: [0.193, 0.306], radii_v: [0.04, 0.035], square: 0.5, mirror: "x", color: ORANGE },
  { id: "elevator_l", shape: "loft", bone: "elevator_l", island: "surfaces", points: [[0.49, 1.1, -3.075], [1.91, 1.1, -3.075]], radii: [0.225, 0.225], radii_v: [0.04, 0.035], square: 0.5, mirror: "x", color: ORANGE },
  { id: "rudder", shape: "loft", bone: "rudder", island: "surfaces", points: [[0, 1.52, -3.0], [0, 2.6, -3.0]], radii: [0.045, 0.035], radii_v: [0.25, 0.25], square: 0.5, color: RED },
  // the canopy: a bubble of glass, a separate island (a different colour with a clean edge)
  { id: "canopy", shape: "loft", bone: "fuselage", island: "canopy", points: [[0, 1.42, 0.1], [0, 1.42, 0.5], [0, 1.42, 1.0], [0, 1.4, 1.6], [0, 1.38, 2.1], [0, 1.36, 2.5]], radii: [0.10, 0.23, 0.27, 0.24, 0.14, 0.03], radii_v: [0.10, 0.28, 0.35, 0.31, 0.18, 0.03], color: GLASS, roughness: 0.08 },          // (glass: glossy, SOMA.md "Materials")
  // the air intakes: a round scoop on each side of the fuselage with a hollow mouth (cut) and a dark duct at the bottom of it (a part listed after the cut is not cut)
  { id: "scoop_l", shape: "cylinder", bone: "fuselage", island: "intakes", center: [0.53, 0.92, 0.95], axis: "z", radius: 0.17, half: 0.7, round: 0.08, mirror: "x", color: WHITE },
  { id: "mouth_l", shape: "cylinder", bone: "fuselage", island: "intakes", center: [0.53, 0.92, 1.75], axis: "z", radius: 0.13, half: 0.3, op: "subtract", mirror: "x" },
  { id: "duct_l", shape: "cylinder", bone: "fuselage", island: "intakes", center: [0.53, 0.92, 1.38], axis: "z", radius: 0.129, half: 0.07, mirror: "x", color: SLATE },
  // the landing gear: the leg, the piston that slides into it with the fork, the wheel
  { id: "leg_nose", shape: "capsule", bone: "gear_nose", island: "legs", a: [0, 0.9, 2.2], b: [0, 0.55, 2.2], radius: 0.055, color: STEEL },
  { id: "leg_l", shape: "capsule", bone: "gear_l", island: "legs", a: [0.9, 0.92, -0.3], b: [0.9, 0.56, -0.3], radius: 0.055, mirror: "x", color: STEEL },
  { id: "piston_nose", shape: "capsule", bone: "wheel_nose", island: "pistons", a: [0, 0.66, 2.2], b: [0, 0.3, 2.2], radius: 0.034, color: STEEL },
  { id: "fork_nose", shape: "box", bone: "wheel_nose", island: "pistons", center: [0, 0.5, 2.2], half: [0.11, 0.03, 0.04], color: STEEL },
  { id: "arm_nose", shape: "capsule", bone: "wheel_nose", island: "pistons", a: [0.1, 0.5, 2.2], b: [0.1, 0.3, 2.2], radius: 0.028, mirror: "x", color: STEEL },
  { id: "piston_l", shape: "capsule", bone: "wheel_l", island: "pistons", a: [0.9, 0.66, -0.3], b: [0.9, 0.3, -0.3], radius: 0.034, mirror: "x", color: STEEL },
  { id: "fork_l", shape: "box", bone: "wheel_l", island: "pistons", center: [0.9, 0.5, -0.3], half: [0.11, 0.03, 0.04], mirror: "x", color: STEEL },
  { id: "arm_l_in", shape: "capsule", bone: "wheel_l", island: "pistons", a: [0.8, 0.5, -0.3], b: [0.8, 0.3, -0.3], radius: 0.028, mirror: "x", color: STEEL },
  { id: "arm_l_out", shape: "capsule", bone: "wheel_l", island: "pistons", a: [1.0, 0.5, -0.3], b: [1.0, 0.3, -0.3], radius: 0.028, mirror: "x", color: STEEL },
  { id: "tyre_nose", shape: "cylinder", bone: "wheel_nose", island: "wheels", center: [0, 0.3, 2.2], axis: "x", radius: 0.3, half: 0.07, round: 0.035, color: TYRE },
  { id: "hub_nose", shape: "cylinder", bone: "wheel_nose", island: "wheels", center: [0, 0.3, 2.2], axis: "x", radius: 0.17, half: 0.09, round: 0.02, color: STEEL },
  { id: "spoke_nose", shape: "box", bone: "wheel_nose", island: "wheels", center: [0, 0.3, 2.2], half: [0.098, 0.13, 0.024], color: ORANGE },
  { id: "tyre_l", shape: "cylinder", bone: "wheel_l", island: "wheels", center: [0.9, 0.3, -0.3], axis: "x", radius: 0.3, half: 0.07, round: 0.035, mirror: "x", color: TYRE },
  { id: "hub_l", shape: "cylinder", bone: "wheel_l", island: "wheels", center: [0.9, 0.3, -0.3], axis: "x", radius: 0.17, half: 0.09, round: 0.02, mirror: "x", color: STEEL },
  { id: "spoke_l", shape: "box", bone: "wheel_l", island: "wheels", center: [0.9, 0.3, -0.3], half: [0.098, 0.13, 0.024], mirror: "x", color: ORANGE },
];
// the grid step is the default island's (the airframe: its thinnest part, the tail, is 10 cm thick); the islands that hold the thin or the small things have a finer one of their own, and everything is simplified afterwards
// (a quadric edge collapse: a flat wing needs few triangles, a tyre needs more) so that the whole is a few thousand vertices
const sdf = {
  cell: 0.04, skin: { falloff: 0.5 }, shade: { ao: 0.5, ao_radius: 0.1, tone: 0.25, color_blend: 0.4 },
  decimate: { ratio: 0.05, max_edge: 0.6 },
  islands: {
    canopy: { cell: 0.03, decimate: { ratio: 0.1, max_edge: 0.5 } }, tanks: { cell: 0.03, decimate: { ratio: 0.1, error: 0.008, max_edge: 0.25 } }, bands: { cell: 0.025, decimate: { ratio: 0.2, error: 0.006, max_edge: 0.12 } },
    tips: { cell: 0.025, decimate: { ratio: 0.15, error: 0.01, max_edge: 0.3 } }, surfaces: { cell: 0.03, decimate: { ratio: 0.05, max_edge: 0.6 } }, intakes: { cell: 0.02, decimate: { ratio: 0.1, error: 0.014, max_edge: 0.4 } },
    legs: { cell: 0.02, decimate: { ratio: 0.2, max_edge: 0.3 } }, pistons: { cell: 0.02, decimate: { ratio: 0.2, max_edge: 0.3 } }, wheels: { cell: 0.025, decimate: { ratio: 0.2, error: 0.006, max_edge: 0.3 } },
  },
  parts: parts,
};

return {
  name: "jet", max: 16,
  family: { faction: "guard", kind: "aircraft", hp: 250 },
  nav: { agent: {"name":"jet","radius":4,"height":4,"step":0.2,"slope":15,"drop":0.3} },
  body: {
    skeleton: bones,
    rig: rig,
    body: body,
    vehicle: vehicle,
    aircraft: aircraft,
    physics: physics,
    sdf: sdf
  },
  abilities: ["fly", "effects"],
  interaction: { uses: [] },
  // PARTICLES (soma/js/fx.js): the flame and the heat of the nozzle at the tail, fuller the faster it goes; a contrail off each wing tip (the tip tank's trailing edge) above 30 m/s. It is fast and big: it is seen from far, so its LOD
  // starts at 120 m and the contrails are played to 600
  particles: {
    nozzle: { effect: "jet_exhaust", mount: { bone: "fuselage", at: [0, 0, -0.15], dir: [0, 0, -1] }, loop: { while: "speed", from: 4, to: 70 }, scale: 1.6, lod: { near: 120, far: 500 } },
    contrail_l: { effect: "contrail", mount: { bone: "wing_l", at: [5.1, 0, -1.68], dir: [0, 0, -1] }, loop: { while: "speed", from: 30, to: 70 }, scale: 1, lod: { near: 200, far: 600 } },
    contrail_r: { effect: "contrail", mount: { bone: "wing_r", at: [-5.1, 0, -1.68], dir: [0, 0, -1] }, loop: { while: "speed", from: 30, to: 70 }, scale: 1, lod: { near: 200, far: 600 } }
  },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 250 }],
      ["orbit", { alt: 70, radius: 140, speed: 45 }],
      ["fly", { alt: 70, cruise: 45, climb: 8, sink: 6, take_off_time: 150, leg_time: 200, legs: 2, min_leg: 220, roam: 420, margin: 30, near: 45, land_radius: 140, glide: 0.08, rest_min: 12, rest_max: 30, land_zone: "runway" }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first; the blocks without a node (health, needs, injured) act through their hooks.
    worker: function (api, ld) {
      var tree = { name: "jet", select: [ld.node("orbit"), ld.node("fly")] };
      return { tree: tree };
    }
  }
};
