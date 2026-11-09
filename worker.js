function engine_worker(engine) {

  console.log("inside engine_worker", engine);

  // creature actions: a few lines of C in a family's definition, written as  creature_action$(`...`)  and compiled into the one switch
  // in creature_system.cpp (cr_run_action). Each call gets an id (1000 up) that the JS side passes to inst.queue_action. The code sees
  // `world`, `creature`, `clock`, `state`, `args0..2` - see the action notes in creature_system.cpp. No ${ inside the template.
  // (sfm's switch is in sfm_actions.cpp, its actions are in sfm_actions.js)


  Object.assign(engine, {
    _cameras: new Map(),
    _transforms: new Map()
  });

  import("@/wasm_runtime.js");

  const wasm = happy_wasm("worker");
    

  
  consts$({ CMD_DEBUG_CALLS: 3400 })

  wasm().then(function (env) {



    const wa = Object.assign({}, env.wa.exports);

    const wmem = WASM_MEMORY*2;
    wa.init(wmem);
        
    const phys_world = wa.phy_create_world(0, -19.8, 0);

    wa.init_scratchpad(Math.floor(wmem * (1 / 4)));

    wa.tra_init(1024 * 2, 256 * 2);

    // (physics 2.0: phy_create_world allocates its own scratch)


    env.memory.check();
    wa.env = env;    
    wa.fp32_array = function (size, poi) { return new Float32Array(env.memory.buffer, poi || wa.alloc(size * 4), size); };
    wa.u32_array = function (size, poi) { return new Uint32Array(env.memory.buffer, poi || wa.alloc(size * 4), size); };
    wa.u8_array = function (size, poi) {
      if (Array.isArray(size)) {
        const a = new Uint8Array(env.memory.buffer, poi || wa.alloc(size.length), size.length);
        a.set(size);
        return a;
      }

      return new Uint8Array(env.memory.buffer, poi || wa.alloc(size), size);
    };

    wa.fp32_array_scratch = function (size, poi) { return new Float32Array(env.memory.buffer, poi || wa.scratch_alloc(size), size); };
    wa.u32_array_scratch = function (size, poi) { return new Uint32Array(env.memory.buffer, poi || wa.scratch_alloc(size), size); };



   
    const u32 = wa.u32_array(PAYLOAD_SIZE);
    const f32 = wa.fp32_array(PAYLOAD_SIZE, u32.byteOffset);

    const u32_buff = wa.u32_array(PAYLOAD_SIZE);
    engine.worker_objects = wa.u32_array(1024, wa.worker_objects());
    engine.worker_track = wa.u32_array(1024, wa.worker_track());

    let terrain = {
      data: null,

    };
    engine.wa = wa;

    


    let frame_time = 0;
    const debug_calls = [];
    let di = 0;


    (function () {
      consts$({
        DBG_SPHERE: 4410,
        DBG_CAPSULE: 4420,
        DBG_AXES_LINES: 4430,
        DBG_POINT: 4440,
        DBG_AABB: 4450,
        DBG_LINE: 4460
      })

      env.debug_calls = debug_calls;

      const u32 = new Uint32Array(env.memory.buffer);
      const f32 = new Float32Array(env.memory.buffer);
      function push_positions(position, rotation, size) {
        position = position / 4;
        rotation = rotation / 4;

        debug_calls[di++] = f32[position++];
        debug_calls[di++] = f32[position++];
        debug_calls[di++] = f32[position++];

        debug_calls[di++] = f32[rotation++];
        debug_calls[di++] = f32[rotation++];
        debug_calls[di++] = f32[rotation++];
        debug_calls[di++] = f32[rotation++];
        debug_calls[di++] = size;
      }
      env.debug_draw_sphere = function (position, rotation, size) {
        debug_calls[di++] = DBG_SPHERE;
        push_positions(position, rotation, size);
      };

      env.debug_draw_capsule = function (position, rotation, radius,height) {
        debug_calls[di++] = DBG_CAPSULE;
        push_positions(position, rotation, radius);
        debug_calls[di++] = height;
      };

      env.debug_draw_axes_lines = function (position, rotation, size) {
        debug_calls[di++] = DBG_AXES_LINES;
        push_positions(position, rotation, size);
      };

      env.debug_draw_point = function (position, r,g,b,size) {
        debug_calls[di++] = DBG_POINT;
        position = position / 4;
        debug_calls[di++] = f32[position++];
        debug_calls[di++] = f32[position++];
        debug_calls[di++] = f32[position++];
        debug_calls[di++] = r;
        debug_calls[di++] = g;
        debug_calls[di++] = b;
        debug_calls[di++] = size;
      };
      env.debug_draw_point2 = function (x,y,z, r, g, b, size) {
        debug_calls[di++] = DBG_POINT;
        debug_calls[di++] = x;
        debug_calls[di++] = y;
        debug_calls[di++] = z;
        debug_calls[di++] = r;
        debug_calls[di++] = g;
        debug_calls[di++] = b;
        debug_calls[di++] = size;
      };

      env.debug_draw_aabb = function (x0, y0, z0, x1, y1, z1) {
        debug_calls[di++] = DBG_AABB;
        debug_calls[di++] = x0;
        debug_calls[di++] = y0;
        debug_calls[di++] = z0;
        debug_calls[di++] = x1;
        debug_calls[di++] = y1;
        debug_calls[di++] = z1;

      };

      env.debug_draw_line = function (p1,p2, r, g, b) {
        debug_calls[di++] = DBG_LINE;
        p1 = p1 / 4;
        p2 = p2 / 4;
        debug_calls[di++] = f32[p1++];
        debug_calls[di++] = f32[p1++];
        debug_calls[di++] = f32[p1++];
        debug_calls[di++] = f32[p2++];
        debug_calls[di++] = f32[p2++];
        debug_calls[di++] = f32[p2++];
        debug_calls[di++] = r;
        debug_calls[di++] = g;
        debug_calls[di++] = b;
      };

      // how many words of the calls fit in `room` words, whole calls only (the main thread reads them as a list: a call cut in the middle would be read as the start of the next)
      env.debug_fit = function (room) {
        let n = 0;
        while (n < di) {
          const c = debug_calls[n], len = c == DBG_POINT ? 8 : (c == DBG_AXES_LINES || c == DBG_SPHERE) ? 9 : 10;          // (the words of a call, its id included: point 8, axes and sphere 9, line and capsule 10)
          if (n + len > room) break;
          n += len;
        }
        return n;
      };

    })();


    const worker_on_immediate = [];

    engine.worker_on_immediate = worker_on_immediate;
    block$("worker_process")
    
    engine.onmessage = function (m) {

      if (!Array.isArray(m.data)) {
        if (m.data.call) {
          if (engine[m.data.call]) engine[m.data.call](m.data);
          return;
        }

        return;
      }
      const _u32 = new Uint32Array(m.data[0]);
     
      u32_buff.set(_u32);
      let i = 4;
     
      i = wa.worker_payload_response(phys_world, u32.byteOffset, 4, env.memory.buffer.byteLength, frame_time);
     

      block$("worker_payload_response")


      const n = di;
      if (di> 0) {
        let j = 0;
        u32[i++] = CMD_DEBUG_CALLS;
        u32[i++] = di;
        while (j < di) {
          f32[i++] = debug_calls[j++];
        }
      }

      while (worker_on_immediate.length > 0) {
        i = worker_on_immediate.pop()(u32, f32, i, m);
      }

      debug_sent = n > 0;
      di = 0;
      u32[0] = i;
      _u32.set(u32);

      

      engine.postMessage(m.data, m.data);
      frame_time = Date.now();
      wa.worker_on_payload(phys_world, u32_buff.byteOffset);

      block$("worker_on_payload")


      frame_time = Date.now() - frame_time;
      
    };


    engine.call_main = function (name, data, transfer) {
      engine.postMessage(Object.assign({ call: name }, data || {}), transfer);

    };


    engine.postMessage({});



  });


}
