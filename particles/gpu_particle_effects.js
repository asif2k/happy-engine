packing("engine", "@/particles/gpu_particles.js")("gpu_particle_effects", function (engine) {
  // GPU PARTICLE EFFECTS (engine.gpu_particles.effect / .play): ready-made effects for engine.gpu_particles: a campfire, an explosion, smoke, sparks, rain ... each a few LAYERS (flame, embers, smoke ...) of
  // emitters that share their GPU systems with every other effect of the same kind of layer, so many effects cost many emitters, not many draw calls (and the 32 systems are not used up).
  //
  //   const gp = engine.gpu_particles;
  //   const fire = gp.effect("campfire", { x: 3, y: 0, z: -2 });        // a loop effect: starts at once.  { scale: 2 } makes it twice as big, { start: false } leaves it standing still
  //   fire.at(x, y, z);  fire.teleport(x, y, z);  fire.stop();  fire.start();  fire.dispose();      at() moves it with a trail, teleport() does not
  //   gp.play("explosion", x, y, z, scale);                              // a burst effect fired and forgotten (its emitters are kept for the next one: nothing is made or freed per shot)
  //   gp.effect("explosion", { x, y, z }).trigger(scale);                // the same on an effect of your own
  //   fire.set("flame", { rate: 400 });  fire.options();  fire.layer("smoke").emitter                 tune a layer; options() is { layer: the options that make it } (what the test bed prints)
  //   gp.presets.my_effect = { title, kind: "loop" | "burst", about, layers: [{ name, blend: "add" | "alpha", depth_fade, soft, cast_shadow, shadow_density, offset: [x, y, z], burst: n, ground_rel: m, emitter: { ...emitter options } }] }
  //
  // A burst layer has `burst: n` (particles at the trigger, at the quality's count). `ground_rel: 0` puts the plane the particles bounce on or die at at the height of the effect (plus that many metres).
  // Everything is authored for the "high" quality: gp.quality.count thins it for the lower ones. The effects stand up (+y); where they are is where the cursor, a foot or a wall is: the origin of an effect is its base.
  block$(function engine_core() {
    (function () {
      const gp = engine.gpu_particles;
      const fail = function (m) { throw new Error("gpu_particle_effects: " + m); };

      const P = {};
      // (colours are display colours: the lit image is tonemapped and gamma corrected, the particles are drawn over it; add layers are thin in alpha so that thousands of them do not turn white)
      P.campfire = {
        title: "Campfire", kind: "loop", about: "flames, a few embers and a thin smoke",
        layers: [
          { name: "flame", blend: "add", depth_fade: 0.3, offset: [0, 0.05, 0], emitter: { rate: 700, lifetime: [0.4, 0.9], speed: [0.3, 1.1], spread: 14, shape: "disc", extent: 0.22, size: [0.42, 0.06], size_random: 0.3,
            color: [[1, 0.85, 0.45, 0.55], [1, 0.45, 0.1, 0.5], [0.5, 0.1, 0.02, 0.25], [0.05, 0, 0, 0]], gravity: [0, 2.2, 0], turbulence: { strength: 1.4, scale: 1.2, speed: 1.2 }, drag: 0.6, fade: [0.04, 0.35], rotation: [0, 360], spin: [-120, 120] } },
          { name: "embers", blend: "add", depth_fade: 0.2, offset: [0, 0.3, 0], emitter: { rate: 14, lifetime: [1.2, 2.8], speed: [0.5, 1.4], spread: 35, shape: "disc", extent: 0.18, size: [0.03, 0.015],
            color: [[1, 0.8, 0.3, 1], [1, 0.4, 0.1, 0.8], [0.5, 0.1, 0.02, 0]], gravity: [0, 0.9, 0], turbulence: { strength: 1.6, scale: 1.5, speed: 1 }, drag: 0.3, fade: [0, 0.35] } },
          { name: "smoke", blend: "alpha", depth_fade: 1.0, soft: 0.9, cast_shadow: true, offset: [0, 0.7, 0], emitter: { rate: 26, lifetime: [3, 5], speed: [0.5, 0.9], spread: 10, shape: "disc", extent: 0.2, size: [0.35, 2.0], size_random: 0.3,
            color: [[0.1, 0.1, 0.1, 0], [0.22, 0.22, 0.22, 0.3], [0.35, 0.35, 0.35, 0.18], [0.5, 0.5, 0.5, 0]], gravity: [0, 0.4, 0], wind: [0.8, 0.2, 0.1], drag: 0.5, turbulence: { strength: 0.8, scale: 0.5, speed: 0.4 }, rotation: [0, 360], spin: [-20, 20], fade: [0.1, 0.5] } }
        ]
      };
      P.torch = {
        title: "Torch", kind: "loop", about: "a small flame on a stick",
        layers: [
          { name: "flame", blend: "add", depth_fade: 0.15, emitter: { rate: 260, lifetime: [0.3, 0.6], speed: [0.2, 0.6], spread: 10, shape: "disc", extent: 0.05, size: [0.2, 0.03], size_random: 0.3,
            color: [[1, 0.85, 0.45, 0.6], [1, 0.45, 0.1, 0.5], [0.5, 0.1, 0.02, 0.2], [0.05, 0, 0, 0]], gravity: [0, 1.6, 0], turbulence: { strength: 1, scale: 2, speed: 1.4 }, drag: 0.8, fade: [0.04, 0.35], rotation: [0, 360], spin: [-100, 100] } },
          { name: "smoke", blend: "alpha", depth_fade: 0.6, soft: 0.9, cast_shadow: true, offset: [0, 0.35, 0], emitter: { rate: 8, lifetime: [1.5, 2.5], speed: [0.3, 0.5], spread: 8, size: [0.1, 0.6], color: [[0.15, 0.15, 0.15, 0], [0.3, 0.3, 0.3, 0.2], [0.5, 0.5, 0.5, 0]],
            gravity: [0, 0.3, 0], drag: 0.4, turbulence: 0.5, fade: [0.1, 0.5] } }
        ]
      };
      P.inferno = {
        title: "Inferno", kind: "loop", about: "a big fire with a tall black smoke column",
        layers: [
          { name: "flame", blend: "add", depth_fade: 0.5, offset: [0, 0.1, 0], emitter: { rate: 1900, lifetime: [0.7, 1.6], speed: [0.6, 2.2], spread: 16, shape: "disc", extent: 1.2, size: [1.1, 0.12], size_random: 0.35,
            color: [[1, 0.8, 0.4, 0.2], [1, 0.4, 0.08, 0.22], [0.45, 0.08, 0.02, 0.14], [0.05, 0, 0, 0]], gravity: [0, 3.2, 0], turbulence: { strength: 2, scale: 0.7, speed: 1 }, drag: 0.5, fade: [0.04, 0.3], rotation: [0, 360], spin: [-90, 90] } },
          { name: "smoke", blend: "alpha", depth_fade: 1.6, soft: 0.9, cast_shadow: true, offset: [0, 1.4, 0], emitter: { rate: 110, lifetime: [6, 10], speed: [1.5, 2.5], spread: 8, shape: "disc", extent: 0.8, size: [1.2, 7], size_random: 0.3,
            color: [[0.03, 0.03, 0.03, 0], [0.07, 0.07, 0.07, 0.6], [0.14, 0.14, 0.14, 0.4], [0.3, 0.3, 0.3, 0]], gravity: [0, 0.8, 0], wind: [2, 0.5, 0.3], drag: 0.35, turbulence: { strength: 1.1, scale: 0.3, speed: 0.3 }, rotation: [0, 360], spin: [-15, 15], fade: [0.08, 0.5], max_distance: 250 } },
          { name: "embers", blend: "add", depth_fade: 0.2, offset: [0, 1, 0], emitter: { rate: 60, lifetime: [2, 5], speed: [1, 3], spread: 40, shape: "disc", extent: 1, size: [0.05, 0.02], color: [[1, 0.8, 0.3, 1], [1, 0.4, 0.1, 0.8], [0.5, 0.1, 0.02, 0]],
            gravity: [0, 1.2, 0], wind: [2, 0, 0.3], drag: 0.3, turbulence: { strength: 2, scale: 0.8, speed: 1 }, fade: [0, 0.3] } }
        ]
      };
      P.explosion = {
        title: "Explosion", kind: "burst", about: "a flash, a fireball, a dark smoke ball, sparks that bounce and a ring of dust",
        layers: [
          { name: "flash", blend: "add", depth_fade: 0.8, burst: 10, offset: [0, 0.8, 0], emitter: { lifetime: [0.1, 0.18], speed: 0, size: [4, 7], color: [[1, 0.95, 0.8, 0.8], [1, 0.8, 0.4, 0]], fade: [0, 0.6] } },
          { name: "fireball", blend: "add", depth_fade: 0.6, burst: 900, offset: [0, 0.6, 0], emitter: { lifetime: [0.5, 1.3], speed: [1.5, 9], spread: 180, shape: "sphere", extent: 0.5, size: [0.8, 2.2], size_random: 0.3,
            color: [[1, 1, 0.8, 0.6], [1, 0.55, 0.15, 0.5], [0.5, 0.12, 0.03, 0.25], [0.05, 0, 0, 0]], gravity: [0, 1.4, 0], drag: 2.2, turbulence: { strength: 2, scale: 0.8, speed: 1.5 }, fade: [0.02, 0.5], rotation: [0, 360], spin: [-90, 90] } },
          { name: "smoke", blend: "alpha", depth_fade: 1.4, soft: 0.9, cast_shadow: true, burst: 220, offset: [0, 0.7, 0], emitter: { lifetime: [4, 8], speed: [0.5, 5], spread: 180, shape: "sphere", extent: 0.6, size: [1.2, 4.5], size_random: 0.3,
            color: [[0.05, 0.05, 0.05, 0.6], [0.15, 0.15, 0.15, 0.6], [0.35, 0.35, 0.35, 0.3], [0.5, 0.5, 0.5, 0]], gravity: [0, 0.5, 0], wind: [1, 0.2, 0], drag: 1.2, turbulence: { strength: 1.2, scale: 0.4, speed: 0.4 }, rotation: [0, 360], spin: [-25, 25], fade: [0.03, 0.5] } },
          { name: "sparks", blend: "add", depth_fade: 0, burst: 350, ground_rel: 0, offset: [0, 0.4, 0], emitter: { lifetime: [0.7, 1.8], speed: [4, 16], spread: 180, size: 0.05, color: [[1, 0.95, 0.6, 1], [1, 0.5, 0.1, 0.8], [0.8, 0.2, 0.05, 0]],
            gravity: [0, -9.8, 0], stretch: 0.035, collide: "bounce", bounce: 0.45, friction: 0.25, fade: [0, 0.25] } },
          { name: "dust", blend: "alpha", depth_fade: 0.6, soft: 0.9, burst: 90, ground_rel: 0, offset: [0, 0.2, 0], emitter: { lifetime: [1.5, 3], speed: [3, 7], direction: [0, 0.12, 0], spread: 90, shape: "disc", extent: 0.6, size: [0.6, 2.6], size_random: 0.3,
            color: [[0.5, 0.42, 0.32, 0.5], [0.45, 0.38, 0.3, 0.3], [0.4, 0.35, 0.3, 0]], drag: 2.5, gravity: [0, 0.1, 0], rotation: [0, 360], spin: [-30, 30], collide: "slide", friction: 0.5, radius: 0.5, fade: [0.05, 0.5] } }
        ]
      };
      P.grenade = {
        title: "Grenade", kind: "burst", about: "a small, quick blast",
        layers: [
          { name: "fireball", blend: "add", depth_fade: 0.4, burst: 260, offset: [0, 0.3, 0], emitter: { lifetime: [0.25, 0.6], speed: [1, 5], spread: 180, shape: "sphere", extent: 0.2, size: [0.4, 1], size_random: 0.3,
            color: [[1, 0.95, 0.7, 0.6], [1, 0.5, 0.12, 0.5], [0.4, 0.1, 0.02, 0]], gravity: [0, 1, 0], drag: 2.5, turbulence: 1.5, fade: [0.02, 0.5] } },
          { name: "smoke", blend: "alpha", depth_fade: 0.8, soft: 0.9, cast_shadow: true, burst: 60, offset: [0, 0.4, 0], emitter: { lifetime: [2, 4], speed: [0.3, 2.5], spread: 180, shape: "sphere", extent: 0.3, size: [0.5, 2], color: [[0.1, 0.1, 0.1, 0.5], [0.3, 0.3, 0.3, 0.3], [0.5, 0.5, 0.5, 0]],
            gravity: [0, 0.4, 0], drag: 1.5, turbulence: 0.8, fade: [0.03, 0.5] } },
          { name: "sparks", blend: "add", depth_fade: 0, burst: 120, ground_rel: 0, offset: [0, 0.2, 0], emitter: { lifetime: [0.5, 1.2], speed: [3, 10], spread: 180, size: 0.04, color: [[1, 0.95, 0.6, 1], [1, 0.5, 0.1, 0]], gravity: [0, -9.8, 0], stretch: 0.03, collide: "bounce", bounce: 0.4, friction: 0.3, fade: [0, 0.25] } }
        ]
      };
      P.smoke_column = {
        title: "Smoke column", kind: "loop", about: "grey smoke rising and leaning with the wind",
        layers: [
          { name: "smoke", blend: "alpha", depth_fade: 1.2, soft: 0.9, cast_shadow: true, emitter: { rate: 60, lifetime: [4, 7], speed: [0.6, 1.2], spread: 10, shape: "disc", extent: 0.3, size: [0.5, 3.2], size_random: 0.35,
            color: [[0.1, 0.1, 0.1, 0], [0.2, 0.2, 0.2, 0.5], [0.34, 0.34, 0.34, 0.3], [0.5, 0.5, 0.5, 0]], gravity: [0, 0.35, 0], wind: [1.2, 0.3, 0.2], drag: 0.5, turbulence: { strength: 0.9, scale: 0.5, speed: 0.4 }, rotation: [0, 360], spin: [-20, 20], fade: [0.08, 0.5] } }
        ]
      };
      P.black_smoke = {
        title: "Black smoke", kind: "loop", about: "thick dark smoke from burning oil or rubber",
        layers: [
          { name: "smoke", blend: "alpha", depth_fade: 1.6, soft: 0.9, cast_shadow: true, emitter: { rate: 80, lifetime: [6, 10], speed: [1.2, 2.2], spread: 9, shape: "disc", extent: 0.5, size: [0.8, 5], size_random: 0.3,
            color: [[0.02, 0.02, 0.02, 0], [0.05, 0.05, 0.05, 0.7], [0.12, 0.12, 0.12, 0.45], [0.25, 0.25, 0.25, 0]], gravity: [0, 0.6, 0], wind: [1.8, 0.4, 0.2], drag: 0.4, turbulence: { strength: 1, scale: 0.35, speed: 0.3 }, rotation: [0, 360], spin: [-15, 15], fade: [0.08, 0.5] } }
        ]
      };
      P.steam = {
        title: "Steam", kind: "loop", about: "white vapour from a vent",
        layers: [
          { name: "steam", blend: "alpha", depth_fade: 0.8, soft: 1, emitter: { rate: 70, lifetime: [1.2, 2.2], speed: [1.5, 2.5], spread: 12, shape: "disc", extent: 0.1, size: [0.2, 1.4], size_random: 0.3,
            color: [[0.9, 0.92, 0.95, 0], [0.9, 0.92, 0.95, 0.35], [0.9, 0.92, 0.95, 0.15], [0.9, 0.92, 0.95, 0]], gravity: [0, 0.5, 0], drag: 1.2, turbulence: { strength: 1.2, scale: 1, speed: 0.8 }, rotation: [0, 360], spin: [-40, 40], fade: [0.1, 0.5] } }
        ]
      };
      P.sparks = {
        title: "Sparks", kind: "burst", about: "metal on metal: a shower that bounces",
        layers: [
          { name: "sparks", blend: "add", depth_fade: 0, burst: 160, ground_rel: 0, offset: [0, 0.3, 0], emitter: { lifetime: [0.5, 1.4], speed: [2, 8], direction: [0, 1, 0], spread: 70, size: 0.035, color: [[1, 0.95, 0.6, 1], [1, 0.5, 0.1, 0.8], [0.8, 0.2, 0.05, 0]],
            gravity: [0, -9.8, 0], stretch: 0.035, collide: "bounce", bounce: 0.45, friction: 0.25, fade: [0, 0.25] } }
        ]
      };
      P.welding = {
        title: "Welding", kind: "loop", about: "a steady fountain of small sparks",
        layers: [
          { name: "sparks", blend: "add", depth_fade: 0, ground_rel: 0, offset: [0, 0.2, 0], emitter: { rate: 140, lifetime: [0.4, 1], speed: [1.5, 5], direction: [0, 1, 0], spread: 60, size: 0.03, color: [[1, 0.95, 0.7, 1], [1, 0.55, 0.15, 0.7], [0.8, 0.2, 0.05, 0]],
            gravity: [0, -9.8, 0], stretch: 0.03, collide: "bounce", bounce: 0.35, friction: 0.3, fade: [0, 0.25] } },
          { name: "glow", blend: "add", depth_fade: 0.2, offset: [0, 0.2, 0], emitter: { rate: 40, lifetime: [0.08, 0.15], speed: 0, size: [0.4, 0.2], color: [[0.8, 0.9, 1, 0.5], [0.6, 0.8, 1, 0]], fade: [0, 0.5] } }
        ]
      };
      P.dust_puff = {
        title: "Dust puff", kind: "burst", about: "a footstep or a landing",
        layers: [
          { name: "dust", blend: "alpha", depth_fade: 0.5, soft: 0.9, burst: 34, ground_rel: 0, offset: [0, 0.05, 0], emitter: { lifetime: [0.9, 1.8], speed: [0.5, 2.2], direction: [0, 0.4, 0], spread: 80, shape: "disc", extent: 0.2, size: [0.35, 1.3], size_random: 0.3,
            color: [[0.7, 0.62, 0.5, 0.7], [0.6, 0.52, 0.42, 0]], gravity: [0, 0.2, 0], drag: 1.8, rotation: [0, 360], spin: [-60, 60], collide: "slide", friction: 0.6, radius: 0.5, fade: [0.05, 0.6] } }
        ]
      };
      P.debris = {
        title: "Debris", kind: "burst", about: "chunks thrown out of an impact that bounce and settle",
        layers: [
          { name: "chunks", blend: "alpha", depth_fade: 0.05, burst: 40, ground_rel: 0, offset: [0, 0.2, 0], emitter: { lifetime: [1, 2.5], speed: [2, 7], direction: [0, 1, 0], spread: 65, size: [0.07, 0.05], size_random: 0.5, color: [0.25, 0.2, 0.16, 1],
            gravity: [0, -9.8, 0], collide: "bounce", bounce: 0.35, friction: 0.5, radius: 1, fade: [0, 0.2], rotation: [0, 360], spin: [-400, 400] } },
          { name: "dust", blend: "alpha", depth_fade: 0.5, soft: 0.9, burst: 20, offset: [0, 0.2, 0], emitter: { lifetime: [0.8, 1.6], speed: [0.5, 2], spread: 90, size: [0.2, 0.9], color: [[0.55, 0.48, 0.4, 0.4], [0.5, 0.45, 0.4, 0]], drag: 2, gravity: [0, 0.2, 0], fade: [0.05, 0.5] } }
        ]
      };
      P.rain = {
        title: "Rain", kind: "loop", about: "falling streaks over a 20 m disc, gone at the ground",
        layers: [
          { name: "drops", blend: "alpha", depth_fade: 0.05, ground_rel: 0, offset: [0, 14, 0], emitter: { rate: 7000, lifetime: [0.9, 1.1], speed: [14, 18], direction: [0.1, -1, 0], spread: 2, shape: "disc", extent: 14, size: 0.03, color: [0.7, 0.8, 1, 0.45],
            collide: "die", stretch: 0.05, fade: [0, 0], max_distance: 45 } }
        ]
      };
      P.snow = {
        title: "Snow", kind: "loop", about: "slow flakes drifting over a 20 m disc",
        layers: [
          { name: "flakes", blend: "alpha", depth_fade: 0.1, soft: 1, ground_rel: 0, offset: [0, 10, 0], emitter: { rate: 1400, lifetime: [7, 9], speed: [0.2, 0.8], direction: [0, -1, 0], spread: 60, shape: "disc", extent: 12, size: [0.05, 0.05], size_random: 0.5,
            color: [0.95, 0.97, 1, 0.8], gravity: [0, -0.3, 0], wind: [0.8, 0, 0.3], drag: 0.8, turbulence: { strength: 0.7, scale: 0.6, speed: 0.5 }, collide: "die", fade: [0.05, 0.1], max_distance: 40 } }
        ]
      };
      P.fountain = {
        title: "Fountain", kind: "loop", about: "water thrown up that falls back",
        layers: [
          { name: "spray", blend: "alpha", depth_fade: 0.1, soft: 1, ground_rel: 0, offset: [0, 0.1, 0], emitter: { rate: 900, lifetime: [1.4, 2], speed: [6.5, 8], direction: [0, 1, 0], spread: 8, size: [0.07, 0.05], size_random: 0.3, color: [0.75, 0.88, 1, 0.5],
            gravity: [0, -9.8, 0], stretch: 0.02, collide: "die", fade: [0, 0.1] } },
          { name: "mist", blend: "alpha", depth_fade: 0.6, soft: 1, offset: [0, 0.1, 0], emitter: { rate: 60, lifetime: [1.5, 2.5], speed: [1, 3], spread: 40, size: [0.3, 1.2], color: [[0.85, 0.92, 1, 0.12], [0.85, 0.92, 1, 0]], gravity: [0, 0.1, 0], drag: 1.2, turbulence: 0.6, fade: [0.1, 0.5] } }
        ]
      };
      P.magic = {
        title: "Magic", kind: "loop", about: "glowing motes that swirl up from a spot",
        layers: [
          { name: "motes", blend: "add", depth_fade: 0.2, offset: [0, 0.2, 0], emitter: { rate: 90, lifetime: [1.2, 2.4], speed: [0.2, 0.8], direction: [0, 1, 0], spread: 50, shape: "sphere", extent: 0.5, shell: true, size: [0.08, 0.02], size_random: 0.4,
            color: [[0.7, 0.5, 1, 0.9], [0.4, 0.8, 1, 0.7], [0.2, 0.3, 1, 0]], gravity: [0, 0.5, 0], drag: 0.6, turbulence: { strength: 3, scale: 1.2, speed: 1.5 }, fade: [0.1, 0.4] } },
          { name: "glow", blend: "add", depth_fade: 0.4, offset: [0, 0.3, 0], emitter: { rate: 8, lifetime: [0.8, 1.4], speed: 0, size: [0.6, 1.4], color: [[0.6, 0.4, 1, 0.15], [0.3, 0.6, 1, 0]], fade: [0.2, 0.6] } }
        ]
      };
      P.fireflies = {
        title: "Fireflies", kind: "loop", about: "a few slow lights over a 16 m box",
        layers: [
          { name: "lights", blend: "add", depth_fade: 0.2, offset: [0, 1.5, 0], emitter: { rate: 7, lifetime: [8, 14], speed: [0.05, 0.3], spread: 180, shape: "box", extent: [8, 1.5, 8], size: [0.07, 0.07], color: [[0.8, 1, 0.3, 0], [0.8, 1, 0.3, 0.9], [0.8, 1, 0.3, 0.9], [0.8, 1, 0.3, 0]],
            drag: 0.8, turbulence: { strength: 0.6, scale: 0.4, speed: 0.4 }, fade: [0.15, 0.2], max_distance: 50 } }
        ]
      };
      P.dust_motes = {
        title: "Dust motes", kind: "loop", about: "specks in the air",
        layers: [
          { name: "motes", blend: "alpha", depth_fade: 0.1, soft: 1, offset: [0, 1.5, 0], emitter: { rate: 25, lifetime: [8, 12], speed: [0.02, 0.1], spread: 180, shape: "box", extent: [6, 1.5, 6], size: [0.025, 0.025], color: [[0.9, 0.85, 0.75, 0], [0.9, 0.85, 0.75, 0.35], [0.9, 0.85, 0.75, 0]],
            drag: 1, turbulence: { strength: 0.15, scale: 0.4, speed: 0.3 }, fade: [0.2, 0.3], max_distance: 25 } }
        ]
      };
      gp.presets = P;
      gp.preset_names = function () { return Object.keys(gp.presets); };

      // ---- the shared systems: one for every kind of layer ------------------------------------------------------------------------------------------------------
      const shared = Object.create(null);
      function lifetime_max(e) { const l = e.lifetime; return Array.isArray(l) ? Math.max(l[0], l[1]) : (l === undefined ? 1 : l); }
      function system_for(layer) {
        const long = lifetime_max(layer.emitter) > 2.5;
        // (a depth fade and an edge are in a few classes, not at every value: the 32 systems must do for every preset; the test bed can still change a system's depth fade, and so that of every layer on it)
        const df = layer.depth_fade === undefined ? 0.4 : layer.depth_fade, sf = layer.soft === undefined ? 0.5 : layer.soft;
        const o = { blend: layer.blend || "add", depth_fade: df <= 0 ? 0 : (df <= 0.25 ? 0.2 : (df <= 0.7 ? 0.5 : (df <= 1.1 ? 1 : 1.6))), soft: sf < 0.7 ? 0.5 : 1, capacity: layer.capacity || (long ? 40000 : 80000), cast_shadow: !!layer.cast_shadow };
        if (layer.shadow_density !== undefined) o.shadow_density = layer.shadow_density;
        const key = [o.blend, o.depth_fade, o.soft, long ? "long" : "short", o.capacity, o.cast_shadow ? "shadow" : "lit", o.shadow_density === undefined ? 1 : o.shadow_density].join("|");
        let sys = shared[key];
        if (!sys || sys.disposed) { sys = gp.create(o); sys.effect_key = key; shared[key] = sys; }
        return sys;
      }
      const copy = function (o) { return JSON.parse(JSON.stringify(o)); };
      // an effect of scale s: sizes, extents and speeds scale, the times and the forces do not
      function scaled(e, s) {
        if (s === 1) return e;
        const mul = function (v, k) { return typeof v === "number" ? v * k : (Array.isArray(v) ? v.map(function (x) { return x * k; }) : v); };
        ["size", "extent", "speed"].forEach(function (k) { if (e[k] !== undefined) e[k] = mul(e[k], s); });
        return e;
      }

      // ---- an effect -----------------------------------------------------------------------------------------------------------------------------------------
      gp.effect = function (name, opts) {
        opts = opts || {};
        const pre = gp.presets[name];
        if (!pre) fail("unknown effect '" + name + "' (" + gp.preset_names().join(", ") + ")");
        const s = opts.scale === undefined ? 1 : opts.scale;
        const fx = { name: name, preset: pre, x: opts.x || 0, y: opts.y || 0, z: opts.z || 0, scale: s, layers: [], disposed: false, loop: pre.kind === "loop", running: true };
        pre.layers.forEach(function (layer) {
          const eo = scaled(copy(layer.emitter), s);
          if (layer.ground_rel !== undefined) eo.ground = gp.has_ground() ? "terrain" : fx.y + layer.ground_rel;          // (a terrain set with gp.set_ground: the ground is the terrain's, not a plane at the effect's height)
          const sys = system_for(layer);
          const em = sys.emitter(name + "." + layer.name, eo);
          const off = layer.offset || [0, 0, 0];
          em.teleport(fx.x + off[0] * s, fx.y + off[1] * s, fx.z + off[2] * s);
          fx.layers.push({ name: layer.name, def: layer, emitter: em, system: sys, offset: off });
        });
        fx.layer = function (n) { for (let i = 0; i < fx.layers.length; i++) if (fx.layers[i].name === n) return fx.layers[i]; fail("the effect " + name + " has no layer '" + n + "'"); };
        // the plane (or the terrain, when there is one) the particles of the layers that bounce or die on the ground meet: kept right when the effect moves or the terrain is set later
        function refresh_ground() {
          fx.layers.forEach(function (l) {
            if (l.def.ground_rel === undefined) return;
            const e = l.emitter, p = e.params, y = fx.y + l.def.ground_rel;
            if (gp.has_ground()) { if (p[gp.P.ground_mode] !== 0) { p[gp.P.ground_mode] = 0; e.touch(); } }
            else if (p[gp.P.ground_mode] !== 1 || p[gp.P.ground_y] !== y) { p[gp.P.ground_mode] = 1; p[gp.P.ground_y] = y; e.touch(); }
          });
        }
        // where a layer stands: the effect's place + the layer's offset turned by the effect's orientation (once per placement); an attached layer stands where the worker's transform puts its emitter
        const at_layer = new Float32Array(3);
        fx.q = new Float32Array([0, 0, 0, 1]);
        function layer_at(l) {
          if (l.emitter.model) return l.emitter.pos;
          const o = l.offset, k = fx.scale, q = fx.q, vx = o[0] * k, vy = o[1] * k, vz = o[2] * k;
          const tx = 2 * (q[1] * vz - q[2] * vy), ty = 2 * (q[2] * vx - q[0] * vz), tz = 2 * (q[0] * vy - q[1] * vx);
          at_layer[0] = fx.x + vx + q[3] * tx + (q[1] * tz - q[2] * ty);
          at_layer[1] = fx.y + vy + q[3] * ty + (q[2] * tx - q[0] * tz);
          at_layer[2] = fx.z + vz + q[3] * tz + (q[0] * ty - q[1] * tx);
          return at_layer;
        }
        function place(move, q) {
          refresh_ground();
          if (q) { fx.q.set(q); fx.layers.forEach(function (l) { l.emitter.orient(q); }); }
          fx.layers.forEach(function (l) {
            if (l.emitter.model) return;                            // (attached: the worker moves it)
            const p = layer_at(l);
            move.call(l.emitter, p[0], p[1], p[2]);
          });
        }
        // glued to a physics body or a tra_model (see gpu_particles.js): every layer's emitter gets a transform parented to it in the worker, at the layer's offset (scaled) + o.offset, turning with it.
        // o: { offset: [x, y, z], rotation: [x, y, z, w], max_jump: 100 }. An attached effect is moved by the worker: at() / teleport() leave it alone until detach()
        fx.attach = function (target, o) {
          o = o || {};
          const extra = o.offset || [0, 0, 0], k = fx.scale;
          fx.layers.forEach(function (l) {
            l.emitter.attach(target, { offset: [l.offset[0] * k + extra[0], l.offset[1] * k + extra[1], l.offset[2] * k + extra[2]], rotation: o.rotation, max_jump: o.max_jump });
          });
          return fx;
        };
        fx.detach = function () { fx.layers.forEach(function (l) { l.emitter.detach(); }); return fx; };
        // (q: [x, y, z, w], optional: the effect faces that way, its layers' offsets and directions turned with it; the world axes by default)
        fx.at = function (x, y, z, q) { fx.x = x; fx.y = y; fx.z = z; place(gp.Emitter.prototype.at, q); return fx; };
        fx.teleport = function (x, y, z, q) { fx.x = x; fx.y = y; fx.z = z; place(gp.Emitter.prototype.teleport, q); return fx; };
        fx.start = function () { refresh_ground(); fx.running = true; fx.layers.forEach(function (l) { l.emitter.start(); }); return fx; };
        fx.stop = function () { fx.running = false; fx.layers.forEach(function (l) { l.emitter.stop(); }); return fx; };
        // the burst layers fire (at the effect's place, bigger with `k`)
        fx.trigger = function (k) {
          k = k === undefined ? 1 : k;
          refresh_ground();
          fx.layers.forEach(function (l) {
            if (!(l.def.burst > 0)) return;
            const p = layer_at(l);
            l.emitter.burst(l.def.burst, p[0], p[1], p[2], 0, 0, 0, k);
          });
          return fx;
        };
        fx.set = function (layer, o) { fx.layer(layer).emitter.set(o); return fx; };
        fx.options = function () { const r = {}; fx.layers.forEach(function (l) { r[l.name] = gp.options_of(l.emitter); }); return r; };
        fx.dispose = function () { if (fx.disposed) return; fx.disposed = true; fx.layers.forEach(function (l) { l.emitter.dispose(); }); };
        if (opts.start === false) fx.stop();
        if (!fx.loop && opts.trigger !== false) fx.trigger(opts.trigger_scale);
        return fx;
      };

      // a burst effect fired and forgotten: one effect per kind is made the first time and kept (nothing is made or freed per shot)
      const one_shots = Object.create(null), IDENTITY = [0, 0, 0, 1];
      gp.play = function (name, x, y, z, scale, q) {
        const pre = gp.presets[name];
        if (!pre) fail("unknown effect '" + name + "'");
        if (pre.kind === "loop") fail("'" + name + "' is a loop effect: gp.effect(name, { x, y, z }) starts it and you stop it");
        let fx = one_shots[name];
        if (!fx || fx.disposed) { fx = one_shots[name] = gp.effect(name, { x: x, y: y, z: z, trigger: false }); }
        fx.teleport(x || 0, y || 0, z || 0, q || IDENTITY);
        fx.trigger(scale);
        return fx;
      };
    })();
  });
});
