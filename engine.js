packing("create_worker", "events", "dom", "hash_str", "guid", "uint8_str", "json_bin","define",
  "httprequest", "dom.color_input", "timer", "stack", "webgl2_context", "object_stack","ds_array")("engine",
    function (create_worker, dom, frontend, hash_str, httprequest, events, uint8_str, stack, define, timer, webgl2_context, ds_array, object_stack) {
      const PR$ = dom.display_status({ $style: "pointer-events:none; position:absolute;left:0;top:0;color:white;background-color:rgba(1,1,1,0.2);font-size:80%;", delay: 100 });

      window.PR = PR$.params;
      window.PR$ = PR$;


      bundle_calls$({
        consts$: function (node, entry, print) {
          entry._engine_constants = entry._engine_constants || 0;

          entry._engine_constants += 1000;
          node.arguments.forEach(function (arg) {

            if (arg.type == "Identifier") {
              entry.__constants[arg.name] = entry._engine_constants;
              entry._engine_constants += 10;
            }
            else if (arg.type == "ObjectExpression") {
              arg.properties.forEach(function (p) {                
                entry.__constants[p.key.name] = eval(print(p.value));
                
              });
            }
          });
          return '';
        },
      });

      consts$({
        MAX_CMDS: 4096 * 16,
        WASM_MEMORY: (4096 * 4096)*4,
        PAYLOAD_SIZE: 4096 * 16,
      })

      consts$({
        CMD_ON_FRAME: 2000,
        CMD_CALLBACK: 2010,
        CMD_UPDATE_FLOAT_VIEWS: 2320,
        CMD_DATA_RESPONSE: 2330,
        CMD_CLEAR: 2040,
        CMD_VIEWPORT: 2050,
        CMD_PUSH_CAMERA: 2060,
        CMD_POP_CAMERA: 2070,
        CMD_SET_RENDER_TARGET: 2080,
        CMD_RENDER_UNIFORM_VALUE: 2090,
        CMD_RENDER_UNIFORM_TEXTURE: 2100,
        CMD_RENDER_UNIFORM_FLOAT_ARRAY: 2110,
        CMD_RENDER_UNIFORM_INT_ARRAY: 2120,
        CMD_PUSH_RT: 2130,
        CMD_POP_RT: 2140,
        CMD_SET_RT_TEX: 2150,
        CMD_SET_RT_TEX_LAYER: 2160,
        CMD_BEGIN_RENDER_ITEM: 2170,
        CMD_END_RENDER_ITEM: 2180,
        CMD_RENDER_ITEM: 2190,
        CMD_TRA_CREATE: 2200,
        CMD_TRA_MODEL_CREATE: 2210,
        CMD_TRA_MODEL_SET_EULAR: 2220,
        CMD_TRA_MODEL_SET_POSITON: 2230,
        CMD_TRA_MODEL_ADD_POSITON: 2240,
        CMD_TRA_MODEL_SET_ROTATION: 2250,
        CMD_TRA_CAMERA_CREATE: 2260,
        CMD_TRA_CAMERA_LOOK_AT: 2270,
        CMD_TRA_CAMERA_UPDATE_ASPECT: 2280,
        CMD_TRA_CAMERA_UPDATE_MOUSE_RAY: 2290,
        CMD_TRA_CAMERA_SET_PERSPECTIVE: 2300,
        CMD_ONFRAME: 2310,
        CMD_UPDATE_FLOAT_VIEWS: 2320,
        CMD_DATA_RESPONSE: 2330,
        CMD_TERRAIN_GET_CHUNKS: 2340,
        CMD_UPLOAD_TERRAIN_DATA: 2350,
        CMD_TERRAIN_UPDATE_PHYSICS_GRID: 2360,
        CMD_TERRAIN_TRA_POSITON: 2370,
        CMD_TRA_MODEL_SET_PARENT: 2380,
        CMD_TRA_MODEL_LINK_BODY: 2390
      })

     
    

      function engine(def) {


        def = def || {};
        const engine = { loaders: [] };


        

        console.log("CMD _DATA_RESPONSE", CMD_DATA_RESPONSE, GL_BOOL_VEC3);

        engine.on_init = new events.event(engine, [engine, null]);
        engine.on_resize = new events.event(engine, [0, 0]);
        engine.on_frame = new events.event(engine, [0, 0]);
        engine.on_frame_end = new events.event(engine, [0, 0]);
        engine.on_frame_begin = new events.event(engine, [0, 0]);
        engine.on_flush_payload = new events.event(engine, [engine, null]);

        engine.on_ready = new events.event(engine, [engine]);

        engine.webgl = webgl2_context(Object.assign({ screen_scale: 1}, def.webgl || {}));
        const gl = engine.webgl.gl;


        Object.assign(engine, {
          uniforms: new Map(),
          _geometries: new Map(),
          _vaos: new Map(),
          _attributes: new Map(),
          _materials: new Map(),
          _textures: new Map(),
          _shaders: new Map(),
          _cameras: new Map(),
        });
        engine.gl_states = {
          depthMask: null,
          colorMask: null,
          blendFunc0: -1,
          blendFunc1: -1,
          frontFace: null,
          cullFace: undefined,

          blendEquationSeparate0: -1,
          blendEquationSeparate1: -1,
          flags: new Uint8Array(65536),
        };





        let guidi = 1;
        engine.guid = function () {
          PR.guid = guidi;
          return guidi++;
        };


        return function (cb) {
          const ubuff = new Uint32Array(4096*8);
          const fbuff = new Float32Array(ubuff.buffer);
          const ibuff = new Int32Array(ubuff.buffer);
          let ui = 4;
          import("worker.js")
          import("@/wasm_runtime.js");
          const _worker = create_worker(happy_worker_source(engine_worker), !true);
          engine._worker = _worker;


          function begin() {
            const wasm = happy_wasm("main");
            wasm().then(function (env) {
              const wa = Object.assign({}, env.wa.exports);

              const wmem = WASM_MEMORY;
              wa.init(wmem);

              wa.init_scratchpad(Math.floor(wmem * (1 / 2)));


              env.memory.check();
              wa.env = env;
              wa.fp32_array = function (size, poi) { return new Float32Array(env.memory.buffer, poi || wa.alloc(size * 4), size); };
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

              engine.wa = wa;

              import("math.js")

              const fmem = math.float_mem(4096 * 16);

              let payload = new Uint32Array(PAYLOAD_SIZE);

              engine.fmem = fmem;
              engine.frame_time = 0;

              engine.datas = [payload.buffer, (new Float32Array(PAYLOAD_SIZE * 8)).buffer];
              engine.ready_to_flush = true;
              engine.flush_payload = function (u32, ui) {
                if (engine.ready_to_flush) {
                  engine.ready_to_flush = false;
                  u32[0] = ui;
                  (new Uint32Array(engine.datas[0])).set(u32);
                  _worker.postMessage(engine.datas, engine.datas);
                  PR.ui = ui;
                  u32[1] = 0;
                  return 4;
                }
                return ui;
              };


              engine.data_respones = {};

              engine.create_data_response = function (cb) {
                const id = engine.guid();
                engine.data_respones[id] = cb;
                return id;
              };


              engine.create_callback = function (cb) {
                const id = engine.guid();
                engine.data_respones[id] = cb;
                return id;
              };


            
              engine.worker_command_response_data = function (cmd, p1, p2, p3, p4, cb) {
                const id= engine.create_data_response(cb);
                ubuff[ui++] = cmd;
                ubuff[ui++] = id;
                ubuff[ui++] = p1;
                ubuff[ui++] = p2;
                ubuff[ui++] = p3;
                ubuff[ui++] = p4;
                return id;
              };

              engine.du = 0;
              engine.upload_float_data = function (size) {

                const fd = new Float32Array(engine.datas[1], engine.du * 4, size);
                engine.du += size;
                ubuff[1] = engine.du;
                return fd;
              };
              engine.on_worker_command = new events.event(engine, [engine, 0, 0]);
              _worker.onmessage = function (m) {

                if (!Array.isArray(m.data)) {
                  if (m.data.call) {
                    if (engine[m.data.call]) engine[m.data.call](m.data);
                    return;
                  }

                  return;
                }

                PR.du = engine.du;
                engine.du = 0;

                const u32 = new Uint32Array(m.data[0]);
                const f32 = new Float32Array(u32.buffer);
                let i = 4, sz = 0, id = 0;
                engine.datas = m.data;

                let cmd_count = u32[0];
                let cmd;
                PR.cmd_count = cmd_count + " / " + PAYLOAD_SIZE;
                while (i < cmd_count) {
                  cmd = u32[i++];

                  switch (cmd) {
                    case CMD_ONFRAME:
                      PR.frame_id = u32[i++];
                      PR.frame = Date.now() - engine.frame_time;
                      engine.frame_time = Date.now();

                      PR.heap = (((u32[i++] / 1024) / 1024).toFixed(2) + " mb");
                      PR.memory = u32[i++];
                      PR.memory = (((((u32[i++]) / 1024) / 1024).toFixed(2) + " mb")) + "/" + (((PR.memory / 1024) / 1024).toFixed(2) + " mb");
                      i++;
                      engine.worker_frame_time = u32[i++];
                      PR.worker_frame = engine.worker_frame_time;
                      break;

                    case CMD_UPDATE_FLOAT_VIEWS:
                      sz = u32[i++];
                      PR.float_views = fmem.mem.length + " / " + sz;
                      fmem.mem.set(f32.subarray(i, i + sz));
                      i += (sz - 1);
                      break;

                    case CMD_DATA_RESPONSE:
                      id = u32[i++];
                      sz = u32[i++];
                      //console.log("CMD DATA RESPONSE", id, sz);
                      if (engine.data_respones[id]) {
                        engine.data_respones[id](f32.subarray(i, i + sz));
                      }
                      i += (sz - 1);
                      break;


                    case CMD_CALLBACK:
                      id = u32[i++];
                      if (engine.data_respones[id]) {
                        engine.data_respones[id](u32,i,m.data);
                      }
                      break;

                    case CMD_DEBUG_CALLS:
                      sz = i + u32[i++];
                      engine.debug_list.length = 0;
                      while (i <= sz) {
                        engine.debug_list[engine.debug_list.length] = f32[i++];
                      }

                      break;
                  }

                  block$("engine_worker_message")

                }

                engine.ready_to_flush = true;
              };

              import("objects.js")
              import("geometries.js")
              import("rendering.js")

              import("float_views.js")

              block$("engine_core")

              function run() {

                let tm = 0, ltime = 0;
                engine.active = true;
                const u_render_size = engine.math.vec2(0, 0);
                engine.uniforms.set('u_render_size', u_render_size);


                engine.keys = {};
                engine.keys_up = new Uint8Array(255);

                document.addEventListener("mouseenter", function (e) {
                  engine.active = true;
                  e.preventDefault();
                  e.stopPropagation();
                });
                document.addEventListener("mouseleave", function (e) {
                  engine.active = false;
                  e.preventDefault();
                  e.stopPropagation();
                });


                document.addEventListener('keydown', function (e) {
                  engine.keys[e.keyCode] = true;
                  engine.keys_up[e.keyCode] = 1;
                  engine.keys.shift = e.shiftKey;
                  engine.keys.ctrl = e.ctrlKey;
                });

                document.addEventListener('keyup', function (e) {
                  engine.keys[e.keyCode] = false;

                  engine.keys.shift = false;
                  engine.keys.ctrl = false;
                });
                dom.disable_right_click();

                document.body.appendChild(engine.webgl.canvas);
                document.body.appendChild(PR$);

                engine.was_resized = true;
                engine.webgl.canvas.addEventListener("canvas_resized", function () {

                  engine.render_width = engine.webgl.canvas.width;
                  engine.render_height = engine.webgl.canvas.height;
                  engine.render_offset_width = engine.webgl.canvas.offsetWidth;
                  engine.render_offset_height = engine.webgl.canvas.offsetHeight;


                  engine.on_resize.params[0] = engine.render_width;
                  engine.on_resize.params[1] = engine.render_height;
                  u_render_size[0] = engine.render_width;
                  u_render_size[1] = engine.render_height;
                  engine.on_resize.trigger_params();
                  engine.was_resized = true;
                });



                let frame_id = 0;
                engine.global_camera_position = [0, 0, 0, 0];
                engine.debug_list = [];

                engine.error = null;
                timer(function (time, time_delta, fps) {
                  engine.time = time;
                  engine.time_delta = time_delta;
                  if (engine.active && !engine.error) {

                    PR.fps = fps;

                    ubuff[ui++] = CMD_ONFRAME;
                    fbuff[ui++] = time;
                    fbuff[ui++] = time_delta;
                    ubuff[ui++] = frame_id++;
                    fbuff[ui++] = engine.global_camera_position[0];
                    fbuff[ui++] = engine.global_camera_position[1];
                    fbuff[ui++] = engine.global_camera_position[2];
                    fbuff[ui++] = engine.global_camera_position[3];



                    try {
                      gl.clearColor(0, 0, 0, 0);
                      gl.viewport(0, 0, engine.render_width, engine.render_height);

                      engine.render_clear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);


                      engine.on_frame_begin.params[0] = time;
                      engine.on_frame_begin.params[1] = time_delta;
                      engine.on_frame_begin.trigger_params();


                      engine.on_frame.params[0] = time;
                      engine.on_frame.params[1] = time_delta;
                      engine.on_frame.trigger_params();


                      engine.on_frame_end.params[0] = time;
                      engine.on_frame_end.params[1] = time_delta;
                      engine.on_frame_end.trigger_params();

                      engine.flush_rendering();

                      engine.wa.scratch_reset();

                      gl.bindVertexArray(null);
                      engine.gl_states.depthFunc = null;
                      engine.was_resized = false;
                    }
                    catch (e) {
                      engine.error = e;
                      throw (e);
                    }


                    ui = engine.flush_payload(ubuff, ui);


                  }

                  engine.webgl.canvas.mouse_click_buttons = -1;
                  engine.keys_up.fill(0);
                }, 1 / 60);

              };



              
              run();
              setTimeout(function () {
                cb(engine);
              }, 100);
              
            });

          }

          engine.call_worker = function (name, data, transfer) {
            _worker.postMessage(Object.assign({ call: name }, data || {}), transfer);

          };


          _worker.onmessage = function (m) {
            begin();
          };

         

        }





      }

     
      return engine;
    });