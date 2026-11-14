packing("engine", "@/particles/gpu_particle_effects.js")("soma_fx_presets", function (engine) {
  // SOMA'S EFFECTS: the effects that creatures ask of the GPU particle system (the `particles` section of a creature file: soma/js/fx.js, SOMA.md "Creature particles"), added to its library (engine.gpu_particles.presets)
  // the way its own are (particles/gpu_particle_effects.js): a preset is { title, kind: "loop" | "burst", about, layers: [{ name, blend, depth_fade, soft, offset, burst, ground_rel, emitter: { ... } }] }. They are authored
  // at the size of the thing that makes them (an exhaust pipe, a nozzle, a wheel) and stand up (+y): the creature's mount turns them (`dir`), `scale` makes them bigger. A loop's `rate` is its full intensity: the creature's
  // intensity 0 .. 1 is the share of it.
  //   exhaust_smoke  a pipe's grey smoke, going up (a truck, a tank, a tractor)      jet_exhaust  the flame and the heat of a nozzle, going out along +y (aim it back)      wheel_dust  tan dust a wheel throws up
  //   muzzle_flash   a flash and a puff of smoke at a barrel (aim it along the barrel)      engine_steam  white vapour from a vent      turbine_haze  the hot haze out of a turbine's pipe (a helicopter)
  //   contrail  the white vapour trail off a wing tip (aim it backward)
  block$(function engine_core() {
    (function () {
      const gp = engine.gpu_particles, P = gp.presets;
      P.exhaust_smoke = {
        title: "Exhaust smoke", kind: "loop", about: "grey smoke from an exhaust pipe: it goes up and thins out",
        layers: [
          { name: "smoke", blend: "alpha", depth_fade: 0.5, soft: 0.9, emitter: { rate: 60, lifetime: [1.0, 2.0], speed: [0.8, 1.6], spread: 10, shape: "disc", extent: 0.03, size: [0.08, 0.6], size_random: 0.3,
            color: [[0.1, 0.1, 0.1, 0], [0.22, 0.22, 0.22, 0.45], [0.38, 0.38, 0.38, 0.2], [0.5, 0.5, 0.5, 0]], gravity: [0, 0.5, 0], drag: 0.7, turbulence: { strength: 0.6, scale: 0.6, speed: 0.5 }, rotation: [0, 360], spin: [-30, 30], fade: [0.06, 0.5], inherit: 0.3 } }
        ]
      };
      P.jet_exhaust = {
        title: "Jet exhaust", kind: "loop", about: "the flame of a nozzle (aim +y along the thrust) and a thin trail of heat haze behind it",
        layers: [
          { name: "flame", blend: "add", depth_fade: 0.2, emitter: { rate: 900, lifetime: [0.12, 0.28], speed: [7, 11], spread: 4, shape: "disc", extent: 0.1, size: [0.28, 0.06], size_random: 0.2,
            color: [[1, 0.9, 0.6, 0.6], [1, 0.5, 0.15, 0.5], [0.5, 0.15, 0.05, 0.2], [0.05, 0, 0, 0]], drag: 0.6, turbulence: { strength: 0.8, scale: 2, speed: 2 }, fade: [0.03, 0.4], stretch: 0.02, inherit: 0.1 } },
          { name: "haze", blend: "alpha", depth_fade: 0.8, soft: 0.9, emitter: { rate: 70, lifetime: [0.6, 1.2], speed: [5, 8], spread: 6, shape: "disc", extent: 0.12, size: [0.25, 1.0], size_random: 0.3,
            color: [[0.6, 0.6, 0.62, 0], [0.55, 0.55, 0.58, 0.14], [0.5, 0.5, 0.52, 0]], drag: 1.2, turbulence: { strength: 1, scale: 0.8, speed: 1 }, fade: [0.1, 0.5], inherit: 0.1 } }
        ]
      };
      P.wheel_dust = {
        title: "Wheel dust", kind: "loop", about: "tan dust that a wheel throws up behind it",
        layers: [
          { name: "dust", blend: "alpha", depth_fade: 0.6, soft: 0.9, emitter: { rate: 40, lifetime: [0.8, 1.6], speed: [0.4, 1.2], spread: 40, shape: "disc", extent: 0.15, size: [0.2, 0.9], size_random: 0.3,
            color: [[0.7, 0.62, 0.5, 0.35], [0.62, 0.54, 0.44, 0.2], [0.55, 0.48, 0.4, 0]], gravity: [0, 0.2, 0], drag: 1.6, turbulence: { strength: 0.5, scale: 0.8, speed: 0.5 }, rotation: [0, 360], spin: [-40, 40], fade: [0.05, 0.6], inherit: 0.15 } }
        ]
      };
      P.turbine_haze = {
        title: "Turbine haze", kind: "loop", about: "the faint hot haze and thin smoke out of a turbine's exhaust pipe: it leaves quickly and thins out (aim +y out of the pipe)",
        layers: [
          { name: "haze", blend: "alpha", depth_fade: 0.8, soft: 0.9, emitter: { rate: 50, lifetime: [0.5, 1.0], speed: [3, 5], spread: 6, shape: "disc", extent: 0.04, size: [0.1, 0.55], size_random: 0.3,
            color: [[0.7, 0.7, 0.72, 0], [0.6, 0.6, 0.62, 0.18], [0.55, 0.55, 0.57, 0]], drag: 1.4, turbulence: { strength: 1, scale: 1.2, speed: 1.5 }, fade: [0.1, 0.5] } }
        ]
      };
      P.contrail = {
        title: "Contrail", kind: "loop", about: "the thin white vapour that a wing tip leaves behind it: it widens and fades over a few seconds (aim +y backward, the way it came from)",
        layers: [
          { name: "vapour", blend: "alpha", depth_fade: 0.6, soft: 1, emitter: { rate: 160, lifetime: [2.5, 4.5], speed: [0.1, 0.5], spread: 20, shape: "disc", extent: 0.05, size: [0.12, 1.4], size_random: 0.25,
            color: [[1, 1, 1, 0], [0.95, 0.97, 1, 0.3], [0.9, 0.93, 1, 0.14], [0.9, 0.93, 1, 0]], drag: 0.8, turbulence: { strength: 0.15, scale: 0.4, speed: 0.2 }, fade: [0.05, 0.6] } }
        ]
      };
      P.muzzle_flash = {
        title: "Muzzle flash", kind: "burst", about: "a flash and a puff of smoke at a barrel (aim +y along the barrel)",
        layers: [
          { name: "flash", blend: "add", depth_fade: 0.3, burst: 14, emitter: { lifetime: [0.04, 0.09], speed: [2, 7], spread: 18, shape: "disc", extent: 0.02, size: [0.22, 0.04], color: [[1, 0.95, 0.7, 0.9], [1, 0.6, 0.2, 0]], fade: [0, 0.5] } },
          { name: "smoke", blend: "alpha", depth_fade: 0.5, soft: 0.9, burst: 8, emitter: { lifetime: [0.5, 1.0], speed: [0.6, 2], spread: 25, shape: "disc", extent: 0.03, size: [0.06, 0.35], size_random: 0.3,
            color: [[0.5, 0.5, 0.5, 0.4], [0.4, 0.4, 0.4, 0]], gravity: [0, 0.3, 0], drag: 1.5, fade: [0.05, 0.6] } }
        ]
      };
      // ---- WEAPONS (soma/weapons/, soma/generate/weapon.js): a flash for each class of weapon, the brass it throws, the smoke that hangs at a barrel, and the tracer of a bullet. All are authored at the size of the weapon (metres) and stand up (+y) along the barrel
      //   muzzle_flash_pistol  a short flash and a thin puff      muzzle_flash_rifle  a flash with a ring of blast and sparks      muzzle_flash_mg  a long narrow flame      muzzle_flash_shotgun  a fireball and a heavy cloud
      //   muzzle_flash_heavy  a big flash, a blast to both sides (a muzzle brake) and a cloud      muzzle_flash_suppressed  hardly a flash, a puff of gas      shell_eject  a brass case thrown out to the right (aim +y where it goes)
      //   barrel_smoke  a thread of smoke that leaves the barrel and hangs      tracer  the glow and the streak of a bullet (a loop: soma.fx_player flies it along the shot: the `trail` of the player)
      const flash = function (title, about, n_flash, size, life, spread, n_smoke, smoke_size, n_spark, blast) {
        const layers = [
          { name: "flash", blend: "add", depth_fade: 0.3, burst: n_flash, emitter: { lifetime: life, speed: [2, 8], spread: spread, shape: "disc", extent: 0.015, size: size, color: [[1, 0.96, 0.75, 0.95], [1, 0.62, 0.22, 0]], fade: [0, 0.5], stretch: 0.01 } },
          { name: "smoke", blend: "alpha", depth_fade: 0.5, soft: 0.9, burst: n_smoke, emitter: { lifetime: [0.5, 1.1], speed: [0.5, 2.2], spread: 28, shape: "disc", extent: 0.03, size: smoke_size, size_random: 0.3,
            color: [[0.55, 0.55, 0.55, 0.38], [0.42, 0.42, 0.42, 0]], gravity: [0, 0.3, 0], drag: 1.5, fade: [0.05, 0.6] } }
        ];
        if (n_spark > 0) layers.push({ name: "sparks", blend: "add", depth_fade: 0.2, burst: n_spark, emitter: { lifetime: [0.1, 0.22], speed: [5, 13], spread: 22, shape: "point", size: [0.014, 0.004], color: [[1, 0.9, 0.5, 1], [1, 0.5, 0.15, 0]], gravity: [0, -6, 0], drag: 0.3, fade: [0, 0.6], stretch: 0.02 } });
        if (blast) layers.push({ name: "blast", blend: "add", depth_fade: 0.3, burst: blast, emitter: { lifetime: [0.04, 0.09], speed: [3, 9], spread: 100, shape: "disc", extent: 0.02, size: [0.2, 0.05], color: [[1, 0.85, 0.5, 0.5], [1, 0.5, 0.2, 0]], fade: [0, 0.5] } });
        return { title: title, kind: "burst", about: about, layers: layers };
      };
      P.muzzle_flash_pistol = flash("Muzzle flash (pistol)", "a short flash and a thin puff of a pistol (aim +y along the barrel)", 6, [0.12, 0.02], [0.03, 0.06], 20, 4, [0.04, 0.2], 3, 0);
      P.muzzle_flash_rifle = flash("Muzzle flash (rifle)", "a flash, a ring of blast and a few sparks of a rifle (aim +y along the barrel)", 12, [0.22, 0.035], [0.04, 0.08], 16, 7, [0.06, 0.32], 6, 6);
      P.muzzle_flash_mg = flash("Muzzle flash (machine gun)", "a long narrow flame and sparks of a machine gun (aim +y along the barrel)", 14, [0.3, 0.04], [0.05, 0.1], 7, 6, [0.06, 0.3], 8, 0);
      P.muzzle_flash_shotgun = flash("Muzzle flash (shotgun)", "a fireball and a heavy cloud of a shotgun (aim +y along the barrel)", 24, [0.5, 0.09], [0.05, 0.12], 26, 16, [0.12, 0.7], 12, 8);
      P.muzzle_flash_heavy = flash("Muzzle flash (heavy)", "a big flash with a blast to both sides and a cloud, a heavy rifle's or a brake's (aim +y along the barrel)", 26, [0.6, 0.1], [0.06, 0.13], 14, 14, [0.12, 0.6], 14, 16);
      P.muzzle_flash_suppressed = flash("Muzzle flash (suppressed)", "hardly a flash, a puff of gas out of a suppressor (aim +y along the barrel)", 2, [0.05, 0.01], [0.02, 0.04], 25, 7, [0.05, 0.22], 0, 0);
      P.shell_eject = {
        title: "Shell eject", kind: "burst", about: "one brass case thrown out of the ejection port, falling (aim +y the way it leaves)",
        layers: [
          { name: "brass", blend: "alpha", depth_fade: 0, burst: 1, emitter: { lifetime: [0.45, 0.6], speed: [2.2, 3.6], spread: 14, shape: "point", size: [0.02, 0.018], color: [[0.9, 0.7, 0.28, 1], [0.8, 0.58, 0.2, 1], [0.7, 0.5, 0.18, 0]], gravity: [0, -9.8, 0], drag: 0.05, rotation: [0, 360], spin: [-900, 900], fade: [0, 0.2] } }
        ]
      };
      P.barrel_smoke = {
        title: "Barrel smoke", kind: "burst", about: "a thread of thin smoke that leaves the barrel and hangs (aim +y up)",
        layers: [
          { name: "wisp", blend: "alpha", depth_fade: 0.5, soft: 1, burst: 3, emitter: { lifetime: [1.2, 2.2], speed: [0.1, 0.4], spread: 20, shape: "disc", extent: 0.01, size: [0.03, 0.22], size_random: 0.3,
            color: [[0.7, 0.72, 0.78, 0.2], [0.6, 0.62, 0.68, 0.1], [0.6, 0.62, 0.68, 0]], gravity: [0, 0.35, 0], drag: 1.2, turbulence: { strength: 0.25, scale: 1.2, speed: 0.5 }, rotation: [0, 360], spin: [-20, 20], fade: [0.1, 0.6] } }
        ]
      };
      P.tracer = {
        title: "Tracer", kind: "loop", about: "the glow and the streak of a bullet: moved along the shot (its emitter's own speed makes the streak: `inherit` 1 and a `stretch`)",
        layers: [
          { name: "core", blend: "add", depth_fade: 0, emitter: { rate: 1600, lifetime: [0.05, 0.08], speed: [0, 0.01], spread: 0, shape: "point", size: [0.04, 0.01], color: [[1, 0.97, 0.82, 1], [1, 0.74, 0.3, 0.7], [1, 0.4, 0.1, 0]], fade: [0, 0.6], stretch: 0.012, inherit: 1 } },
          { name: "glow", blend: "add", depth_fade: 0, emitter: { rate: 500, lifetime: [0.08, 0.12], speed: [0, 0.01], spread: 0, shape: "point", size: [0.14, 0.05], color: [[1, 0.6, 0.2, 0.25], [1, 0.35, 0.1, 0]], fade: [0, 0.8], inherit: 0.5 } }
        ]
      };
      // ---- THE OTHER WEAPONS (soma/generate/weapon_more.js): the light of an energy weapon in each of its five colours (a flash at the muzzle, the bolt that flies: a laser's thin streak, a plasma gun's glowing ball), a railgun's, a flamethrower's jet, its stream and its pilot light, an arrow's faint streak
      //   energy_flash_<colour>  a short glow and a few sparks      laser_bolt_<colour>  a thin bright streak (a loop: soma.fx_player flies it along the shot)      plasma_bolt_<colour>  a glowing ball with a halo      (colours: cyan green red violet amber)
      //   rail_flash  a white-blue crack and a ring      rail_trail  a hair-thin white streak with a blue halo      flame_jet  a tongue of fire and black smoke at the muzzle      flame_stream  the burning stream, flown along the shot      pilot_flame  the small flame of the pilot light      arrow_trail  a faint pale streak
      const GLOWS = { cyan: [0.2, 0.9, 1], green: [0.25, 1, 0.35], red: [1, 0.15, 0.1], violet: [0.7, 0.3, 1], amber: [1, 0.65, 0.1] };
      Object.keys(GLOWS).forEach(function (name) {
        const c = GLOWS[name], a = function (al) { return [c[0], c[1], c[2], al]; }, hot = [Math.min(1, c[0] + 0.5), Math.min(1, c[1] + 0.5), Math.min(1, c[2] + 0.5), 1];
        P["energy_flash_" + name] = { title: "Energy flash (" + name + ")", kind: "burst", about: "a short " + name + " glow and a few sparks at the muzzle of an energy weapon (aim +y along the barrel)", layers: [
          { name: "flash", blend: "add", depth_fade: 0.3, burst: 8, emitter: { lifetime: [0.04, 0.08], speed: [1, 5], spread: 20, shape: "disc", extent: 0.012, size: [0.18, 0.03], color: [hot, a(0.8), a(0)], fade: [0, 0.5], stretch: 0.01 } },
          { name: "sparks", blend: "add", depth_fade: 0.2, burst: 7, emitter: { lifetime: [0.1, 0.22], speed: [3, 9], spread: 35, shape: "point", size: [0.014, 0.003], color: [hot, a(0)], gravity: [0, -3, 0], drag: 0.3, fade: [0, 0.6], stretch: 0.02 } }
        ] };
        P["laser_bolt_" + name] = { title: "Laser bolt (" + name + ")", kind: "loop", about: "a thin bright " + name + " streak flown along the shot (its emitter's own speed makes the streak: `inherit` 1 and a `stretch`)", layers: [
          { name: "core", blend: "add", depth_fade: 0, emitter: { rate: 1800, lifetime: [0.04, 0.07], speed: [0, 0.01], spread: 0, shape: "point", size: [0.035, 0.008], color: [[1, 1, 1, 1], a(0.85), a(0)], fade: [0, 0.6], stretch: 0.02, inherit: 1 } },
          { name: "glow", blend: "add", depth_fade: 0, emitter: { rate: 500, lifetime: [0.08, 0.12], speed: [0, 0.01], spread: 0, shape: "point", size: [0.12, 0.04], color: [a(0.3), a(0)], fade: [0, 0.8], inherit: 0.5 } }
        ] };
        P["plasma_bolt_" + name] = { title: "Plasma bolt (" + name + ")", kind: "loop", about: "a glowing " + name + " ball with a halo and a short tail, flown along the shot", layers: [
          { name: "core", blend: "add", depth_fade: 0, emitter: { rate: 500, lifetime: [0.12, 0.18], speed: [0, 0.05], spread: 0, shape: "point", size: [0.1, 0.05], color: [[1, 1, 1, 1], a(0.9), a(0)], fade: [0, 0.6], inherit: 0.9 } },
          { name: "halo", blend: "add", depth_fade: 0, emitter: { rate: 160, lifetime: [0.12, 0.2], speed: [0, 0.1], spread: 0, shape: "point", size: [0.34, 0.12], color: [a(0.3), a(0)], fade: [0, 0.8], inherit: 0.6 } }
        ] };
      });
      P.rail_flash = { title: "Rail flash", kind: "burst", about: "a white-blue crack and a ring of light at the muzzle of a railgun (aim +y along the barrel)", layers: [
        { name: "crack", blend: "add", depth_fade: 0.3, burst: 12, emitter: { lifetime: [0.03, 0.06], speed: [3, 10], spread: 14, shape: "disc", extent: 0.015, size: [0.4, 0.04], color: [[1, 1, 1, 1], [0.6, 0.8, 1, 0.7], [0.3, 0.5, 1, 0]], fade: [0, 0.5], stretch: 0.02 } },
        { name: "ring", blend: "add", depth_fade: 0.3, burst: 5, emitter: { lifetime: [0.06, 0.12], speed: [4, 9], spread: 100, shape: "disc", extent: 0.02, size: [0.22, 0.06], color: [[0.7, 0.85, 1, 0.5], [0.3, 0.5, 1, 0]], fade: [0, 0.5] } }
      ] };
      P.rail_trail = { title: "Rail trail", kind: "loop", about: "a hair-thin white streak with a blue halo, flown along the shot", layers: [
        { name: "core", blend: "add", depth_fade: 0, emitter: { rate: 2200, lifetime: [0.06, 0.1], speed: [0, 0.01], spread: 0, shape: "point", size: [0.03, 0.006], color: [[1, 1, 1, 1], [0.7, 0.85, 1, 0.8], [0.3, 0.5, 1, 0]], fade: [0, 0.6], stretch: 0.03, inherit: 1 } },
        { name: "halo", blend: "add", depth_fade: 0, emitter: { rate: 600, lifetime: [0.1, 0.16], speed: [0, 0.01], spread: 0, shape: "point", size: [0.14, 0.05], color: [[0.5, 0.7, 1, 0.25], [0.3, 0.5, 1, 0]], fade: [0, 0.8], inherit: 0.5 } }
      ] };
      P.flame_jet = { title: "Flame jet", kind: "burst", about: "a tongue of fire and black smoke at the nozzle of a flamethrower (aim +y along the barrel)", layers: [
        { name: "fire", blend: "add", depth_fade: 0.3, burst: 26, emitter: { lifetime: [0.12, 0.3], speed: [5, 12], spread: 9, shape: "disc", extent: 0.015, size: [0.12, 0.34], size_random: 0.3, color: [[1, 0.95, 0.6, 0.95], [1, 0.55, 0.12, 0.7], [0.5, 0.12, 0.04, 0]], gravity: [0, 0.8, 0], drag: 0.6, fade: [0, 0.5], turbulence: { strength: 0.6, scale: 1.4, speed: 1 } } },
        { name: "smoke", blend: "alpha", depth_fade: 0.5, soft: 0.9, burst: 7, emitter: { lifetime: [0.7, 1.4], speed: [1, 3], spread: 20, shape: "disc", extent: 0.03, size: [0.08, 0.5], size_random: 0.3, color: [[0.12, 0.12, 0.12, 0.4], [0.1, 0.1, 0.1, 0]], gravity: [0, 0.6, 0], drag: 1.4, fade: [0.05, 0.6] } }
      ] };
      P.flame_stream = { title: "Flame stream", kind: "loop", about: "the burning stream of a flamethrower: glowing blobs that grow and cool along the shot (flown by the shot's own player)", layers: [
        { name: "fire", blend: "add", depth_fade: 0, emitter: { rate: 260, lifetime: [0.18, 0.3], speed: [0.2, 1.2], spread: 10, shape: "disc", extent: 0.01, size: [0.18, 0.5], size_random: 0.3, color: [[1, 0.95, 0.6, 0.9], [1, 0.5, 0.1, 0.6], [0.4, 0.1, 0.03, 0]], gravity: [0, 1, 0], drag: 0.8, fade: [0, 0.5], inherit: 0.7, turbulence: { strength: 0.7, scale: 1.6, speed: 1.2 } } }
      ] };
      P.pilot_flame = { title: "Pilot flame", kind: "loop", about: "the small blue and yellow flame of a pilot light, going up (aim +y up)", layers: [
        { name: "flame", blend: "add", depth_fade: 0, emitter: { rate: 40, lifetime: [0.12, 0.22], speed: [0.1, 0.4], spread: 6, shape: "disc", extent: 0.003, size: [0.012, 0.03], color: [[0.5, 0.7, 1, 0.9], [1, 0.75, 0.25, 0.7], [1, 0.4, 0.1, 0]], gravity: [0, 0.6, 0], drag: 1, fade: [0, 0.5] } }
      ] };
      P.arrow_trail = { title: "Arrow trail", kind: "loop", about: "the faint pale streak of an arrow or a bolt in flight, flown along the shot", layers: [
        { name: "streak", blend: "add", depth_fade: 0, emitter: { rate: 300, lifetime: [0.06, 0.1], speed: [0, 0.01], spread: 0, shape: "point", size: [0.014, 0.004], color: [[0.95, 0.92, 0.8, 0.55], [0.9, 0.88, 0.75, 0]], fade: [0, 0.7], stretch: 0.02, inherit: 1 } }
      ] };
      P.engine_steam = {
        title: "Engine steam", kind: "loop", about: "white vapour from a vent: it goes up and thins out",
        layers: [
          { name: "steam", blend: "alpha", depth_fade: 0.5, soft: 1, emitter: { rate: 40, lifetime: [0.8, 1.5], speed: [0.9, 1.6], spread: 12, shape: "disc", extent: 0.04, size: [0.1, 0.7], size_random: 0.3,
            color: [[0.9, 0.92, 0.95, 0], [0.9, 0.92, 0.95, 0.3], [0.9, 0.92, 0.95, 0.12], [0.9, 0.92, 0.95, 0]], gravity: [0, 0.5, 0], drag: 1, turbulence: { strength: 0.8, scale: 1, speed: 0.8 }, rotation: [0, 360], spin: [-40, 40], fade: [0.1, 0.5] } }
        ]
      };
    })();
  });
});
