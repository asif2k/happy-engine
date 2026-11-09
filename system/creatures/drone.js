"use strict";
// drone: in soma's one form of a creature file (soma/creature_file.js): the body is the creature as it was made, the mind is the blocks of soma/world/blocks/ it loads and its tree.
// A quadcopter: surveys the field in lanes, circles a place it is sent to, flies about and lands on its pads.
// drone: a quadcopter, 0.5 m across. ONE JS FILE IS ONE CREATURE: it is read as text, run with new Function("api", text) and RETURNS the creature { name, skeleton, rig, body, flight }.
// Metres, +x to its left, +y up, +z forward. A HOVER: it accelerates toward the velocity it is wished to have (it tilts into its acceleration), stands in the air, turns toward the way it faces, and lands on its skids. The
// controls of a pilot (`sp.set_controls`: throttle, pitch, roll, yaw) fly it with a stick as well. Its four LIFT ROTORS (soma_aircraft.cpp) turn with the thrust it uses: a rotor's speed goes with the square root of the share of the
// thrust the hover asks for (thrust goes with the speed squared), never under 30 % of it while the engine is on; the diagonal pairs turn the other way, as a multicopter's do so that the reactions cancel.
const bones = [];
bones.push({ name: "frame", head: [0, 0.06, 0], tail: [0, 0.10, 0] });
[["fl", 1, 1], ["fr", -1, 1], ["bl", 1, -1], ["br", -1, -1]].forEach(function (a) {
  bones.push({ name: "arm_" + a[0], parent: "frame", head: [0, 0.08, 0], tail: [0.17 * a[1], 0.08, 0.17 * a[2]] });
  bones.push({ name: "rotor_" + a[0], parent: "arm_" + a[0], head: [0.17 * a[1], 0.085, 0.17 * a[2]], tail: [0.17 * a[1], 0.12, 0.17 * a[2]] });
});
// THE FACE (soma/SOMA.md "Authoring a face"): the camera under the nose is its EYE: a bone at the centre of the gimbal's ball, pointing forward, that the face turns to look (a gimbal turns far: 60 degrees to each side, 60 down)
bones.push({ name: "eye_c", parent: "frame", head: [0, 0.051, 0.066], tail: [0, 0.051, 0.096] });
const rig = { joints: [{ bone: "eye_c", kind: "ball", fwd: 25, back: 60, lat: 60, twist: [-10, 10] }], chains: [] };
const body = { max_speed: 12, accel: 8, turn_rate: 3, gravity: 9.8, air_control: 1 };
const flight = { model: "hover", max_speed: 12, thrust: 2.2, max_bank: 0.6, max_pitch: 0.6, rate: 3, clearance: 0.15 };
// THE ROTORS: four lift rotors, the bones `rotor_*` (each spins about its own y, the model's up). Nominal speed 150 rad/s (1430 rpm: slow enough that a frame of the picture shows the blades moved by under a half turn): at the hover (a thrust of 2.2 g
// holds the weight at 45 % of it) they run at 150 x sqrt(0.45) = 100 rad/s; the front left and the back right turn one way (dir 1), the other pair the other way; a 0.25 s spool (they follow the thrust quickly); idle 30 % while the engine is on
const rotors = [{ bone: "rotor_fl", role: "lift", dir: 1, omega: 150 }, { bone: "rotor_fr", role: "lift", dir: -1, omega: 150 }, { bone: "rotor_bl", role: "lift", dir: -1, omega: 150 }, { bone: "rotor_br", role: "lift", dir: 1, omega: 150 }];
// SDF: what the mesh is made of (the mesher's grammar: soma/SOMA_MESHER.md; the parts stand on the bones above by name). A white hull with a dark belly, a battery on its back, a camera on a gimbal under the nose, two skids; four
// arms (the front ones orange, so that it is seen which way it faces) with a motor on the end of each; and on every motor a ROTOR: a hub and two twisted blades in one line, centred on the axis of the rotor's bone (every part of a
// rotor stands on that bone, so a bone that turns about its axis turns the blades about their own middle). The rotors, the lights and the lens are ISLANDS (never blended into the motors, a grid of their own): the blades are thin.
// The body is rigid (every part is the bone's alone), the arms and the hull melt into one another with a blend of 8 to 12 mm.
const WHITE = [0.90, 0.91, 0.92, 1], DARK = [0.13, 0.14, 0.17, 1], NAVY = [0.10, 0.13, 0.22, 1], ARMC = [0.20, 0.21, 0.24, 1], ORANGE = [0.96, 0.45, 0.08, 1], MOTOR = [0.34, 0.35, 0.40, 1], HUB = [0.62, 0.63, 0.67, 1], BLADE = [0.07, 0.07, 0.08, 1];
const LENS = [0.03, 0.07, 0.16, 1], SILVER = [0.72, 0.73, 0.76, 1], GREEN = [0.35, 1.0, 0.5, 1], RED = [1.0, 0.14, 0.10, 1], GLINT = [0.85, 0.95, 1.0, 1], SKID = [0.19, 0.20, 0.22, 1];
const parts = [];
// the hull: a white shell over a dark belly, a battery with an orange band on its back, a sensor bar on the nose
parts.push({ id: "hull_belly", shape: "ellipsoid", center: [0, 0.079, 0.0], radii: [0.058, 0.025, 0.088], bone: "frame", blend: 0.012, blend_mode: "cubic", color: DARK });
parts.push({ id: "hull_top", shape: "ellipsoid", center: [0, 0.099, 0.0], radii: [0.062, 0.027, 0.092], bone: "frame", blend: 0.012, blend_mode: "cubic", color: WHITE });
parts.push({ id: "battery", shape: "box", center: [0, 0.122, -0.014], half: [0.034, 0.011, 0.056], round: 0.008, bone: "frame", blend: 0.006, color: NAVY });
parts.push({ id: "battery_band", shape: "box", center: [0, 0.1225, -0.071], half: [0.0345, 0.0105, 0.0035], round: 0.002, bone: "frame", blend: 0.002, color: ORANGE });
parts.push({ id: "nose_bar", shape: "ellipsoid", center: [0, 0.094, 0.087], radii: [0.042, 0.011, 0.012], bone: "frame", blend: 0.006, color: DARK });
// the camera under the nose: a gimbal ball on a short neck, a lens and its ring: the ball, the lens, the ring and the glint are an island on the eye's bone (it turns as one piece, the neck stays on the frame)
parts.push({ id: "gimbal_neck", shape: "capsule", a: [0, 0.07, 0.052], b: [0, 0.058, 0.064], radius: 0.011, bone: "frame", blend: 0.01, blend_mode: "cubic", color: DARK });
parts.push({ id: "gimbal", shape: "sphere", center: [0, 0.051, 0.066], radius: 0.0215, bone: "eye_c", island: "camera", color: DARK });
parts.push({ id: "lens", shape: "sphere", center: [0, 0.0495, 0.0855], radius: 0.0105, bone: "eye_c", island: "camera", color: LENS });
parts.push({ id: "lens_ring", shape: "torus", center: [0, 0.0495, 0.0825], axis: "z", radius: 0.0125, tube: 0.0032, bone: "eye_c", island: "camera", color: SILVER });
parts.push({ id: "lens_glint", shape: "sphere", center: [0.004, 0.0535, 0.0951], radius: 0.0024, bone: "eye_c", island: "camera", color: GLINT });
parts.push({ id: "led_nose", shape: "sphere", center: [0, 0.094, 0.0985], radius: 0.0055, bone: "frame", island: "lights", color: GREEN });
parts.push({ id: "led_tail", shape: "sphere", center: [0, 0.1, -0.0915], radius: 0.0055, bone: "frame", island: "lights", color: RED });
// two skids on struts: tubes that turn up at the ends, their lowest point on y = 0
[1, -1].forEach(function (s) {
  parts.push({ id: "skid_" + (s > 0 ? "l" : "r"), shape: "loft", points: [[0.077 * s, 0.026, -0.125], [0.077 * s, 0.0105, -0.095], [0.077 * s, 0.0070, -0.05], [0.077 * s, 0.0070, 0.05], [0.077 * s, 0.0105, 0.095], [0.077 * s, 0.026, 0.125]], radii: [0.0065, 0.0065, 0.0065, 0.0065, 0.0065, 0.0065], bone: "frame", blend: 0.004, color: SKID });
  [-0.055, 0.055].forEach(function (z) {
    parts.push({ id: "strut_" + (s > 0 ? "l" : "r") + (z > 0 ? "f" : "b"), shape: "capsule", a: [0.044 * s, 0.075, z], b: [0.075 * s, 0.012, z], radius: 0.0048, bone: "frame", blend: 0.006, color: SKID });
  });
});
// the four arms, a motor on the end of each, a light on the motor, and the rotor
[["fl", 1, 1], ["fr", -1, 1], ["bl", 1, -1], ["br", -1, -1]].forEach(function (a) {
  const name = a[0], sx = a[1], sz = a[2], cx = 0.17 * sx, cz = 0.17 * sz, front = sz > 0, arm = "arm_" + name, rotor = "rotor_" + name;
  parts.push({ id: "arm_" + name, shape: "loft", bones: [arm], radii: [0.017, 0.0105], radii_v: [0.0105, 0.0088], blend: 0.01, blend_mode: "cubic", color: front ? ORANGE : ARMC });
  parts.push({ id: "motor_" + name, shape: "cylinder", center: [cx, 0.091, cz], axis: "y", radius: 0.0215, half: 0.0135, round: 0.004, bone: arm, blend: 0.006, color: MOTOR });
  parts.push({ id: "led_" + name, shape: "sphere", center: [cx + 0.0155 * sx, 0.089, cz + 0.0155 * sz], radius: 0.0062, bone: arm, island: "lights", color: front ? GREEN : RED });
  // the rotor: a hub and two blades through its middle (12.5 degrees of pitch at the root, 5 at the tip), all on the rotor's bone and centred on its axis
  parts.push({ id: "hub_" + name, shape: "cylinder", center: [cx, 0.1115, cz], axis: "y", radius: 0.0115, half: 0.0085, round: 0.0035, bone: rotor, island: "rotors", color: HUB });
  [1, -1].forEach(function (d) {
    parts.push({ id: "blade_" + name + (d > 0 ? "a" : "b"), shape: "loft", points: [[cx + 0.008 * d, 0.1118, cz], [cx + 0.028 * d, 0.1118, cz], [cx + 0.05 * d, 0.1118, cz], [cx + 0.07 * d, 0.1118, cz]], radii: [0.0065, 0.0112, 0.0105, 0.0048], radii_v: [0.0028, 0.0027, 0.0026, 0.0026], twist: [14, 10, 7, 5], bone: rotor, island: "rotors", color: BLADE });
  });
  parts.push({ id: "tip_" + name + "a", shape: "sphere", center: [cx + 0.0675, 0.1118, cz], radius: 0.0036, bone: rotor, island: "rotors", color: front ? ORANGE : WHITE });
  parts.push({ id: "tip_" + name + "b", shape: "sphere", center: [cx - 0.0675, 0.1118, cz], radius: 0.0036, bone: rotor, island: "rotors", color: front ? ORANGE : WHITE });
});
const sdf = {
  cell: 0.004, adaptive: { min_cell: 0.002, max_cell: 0.008 }, decimate: { ratio: 0.2, max_edge: 0.03 },
  islands: { rotors: { cell: 0.0022, adaptive: false, decimate: { ratio: 0.2 } }, lights: { cell: 0.002, adaptive: false, decimate: { ratio: 0.35 } }, camera: { cell: 0.002, adaptive: false, decimate: { ratio: 0.35 } } },
  skin: { falloff: 1.5 }, shade: { ao: 0.2, ao_radius: 0.012, tone: 0.1, color_blend: 0.35 }, parts: parts,
};
// PHYSICS: the creature in the physics world (soma_phys.cpp, js/shapes.js): one box for the frame and its arms (the rotors are no shape); 1.2 kg
const physics = { mass: 1.2, shapes: [{ id: "frame", shape: "box", center: [0, 0.09, 0], half: [0.19, 0.045, 0.19], bone: "frame" }] };
// THE FACE: the role of its camera (soma 2.0's spelling: soma/SOMA.md "Authoring a face"), written into its roles on the next line (soma_face.cpp plays them)
const face = { eyes: [{ bone: "eye_c", yaw: 60, pitch: 45 }] };
const roles = face;                 // THE FACE in roles (soma/tools/face_roles.js)

return {
  name: "drone", max: 16,
  family: { faction: "machine", kind: "drone", hp: 40 },
  nav: { agent: {"name":"drone","radius":0.6,"height":0.5,"step":0.1,"slope":20,"drop":0.2} },
  body: {
    roles: roles,
    skeleton: bones,
    rig: rig,
    body: body,
    flight: flight,
    rotors: rotors,
    physics: physics,
    sdf: sdf
  },
  abilities: ["fly", "effects"],
  interaction: { uses: [] },
  mind: {
    hz: 6, far_hz: 2,
    blocks: [
      ["health", { hp: 40 }],
      ["orbit", { alt: 18, radius: 14, speed: 6 }],
      ["survey", { zone: "field", spacing: 18, alt: 22, speed: 7, near: 5 }],
      ["fly", { alt: 16, cruise: 6, climb: 3, sink: 2, legs: 3, min_leg: 15, roam: 70, near: 5, rest_min: 6, rest_max: 15, land_zone: "pads" }]
    ],
    // THE WORKER: a creature declares its tree. The nodes of the blocks that have one are put in it by name, the ones that act first first; the blocks without a node (health, needs, injured) act through their hooks.
    worker: function (api, ld) {
      var tree = { name: "drone", select: [ld.node("orbit"), ld.node("survey"), ld.node("fly")] };
      return { tree: tree };
    }
  }
};
