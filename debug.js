packing("engine")("happy_debug", function (engine, dom) {
  // THE SCENE HOST, trimmed from the first version's debug.js: what a page needs to put things on screen and nothing else. engine.debug has
  //   debug.scene()  -> { camera, dlight0, alight0, on_render_pass, on_shadow_pass, use_deffered_rendering(def), ... }   a camera with orbit controls (left drag turns, right drag pans, the wheel zooms), a sun and an ambient light, and the passes
  //                     a page adds its drawing to: scene.on_shadow_pass.add(fn) (what casts a shadow) and scene.on_render_pass.add(fn) (what is seen); scene.use_deffered_rendering({ ENABLE_ATMOSPHERE, ENABLE_SHADOWS }) turns the deferred pass on
  //   debug.grid     the floor: debug.grid.render_ground() (a lit checker ground), .render() (a grid of lines), .render_plane()
  //   debug.mesh(def)  debug.lines_mesh(n, material)  debug.points_mesh(def)  debug.cube  debug.axes_lines  debug.render()  debug.clear()      queued debug shapes, drawn by debug.render() inside a pass
  // Not here: the panels (the sidebar, the status windows) and the physics test bed of the first version.
  block$(function engine_core() {

    engine.debug = (function () {

      const debug = {};

      debug.grid = {
        geo: engine.geometries.plane(1, 1, 256, 256, 1),
        mat: engine.materials.create({
          state: {
            cullFace: null

          },

          shader: `


						void vertex(){
								v_position_world = a_position.xzy*4000.;
								//v_position_world.xz += u_camera_position.xz;
								v_uv=v_position_world.xz;
                gl_Position = u_view_projection_matrix* vec4(v_position_world,1.0);
								
						}


						float log10(float x){return log(x) / log(10.0);}
						float satf(float x){return clamp(x, 0.0, 1.0);}
						vec2 satv(vec2 x){return clamp(x, vec2(0.0), vec2(1.0));}
						float max2(vec2 v){return max(v.x, v.y);}

						float gridSize = 10000.0;
						float gridCellSize = 0.05;


						vec4 gridColorThick = vec4(0.21, 0.21, 0.21, 0.5);
							vec4 grid_color(vec2 uv, vec2 camPos){
								vec2 dudv = vec2(
									length(vec2(dFdx(uv.x), dFdy(uv.x))),
									length(vec2(dFdx(-uv.y), dFdy(-uv.y)))
								);

								float cell=mix(gridCellSize*pow(2.,2.),gridCellSize,(1.0- satf(length(uv) / gridSize)));

								float lod0 =8.0;// cell;// * pow(1024.0, 1.);

								uv += dudv / 2.0;

							float lod0a = max2( vec2(1.0) - abs(satv(mod(uv, lod0) / dudv) * 2.0 - vec2(1.0)) );
							uv -= camPos;
								if(lod0a <= 0.0 ){
//return mix(vec4(0),vec4(0.125),(1.0- satf(length(uv) / gridSize)));
//return vec4(0.25);
									discard;

								}
								return  mix(vec4(0),gridColorThick,(1.0- satf(length(uv) / gridSize)));
							}
#define HAS_NORMAL
vec3 v_normal;
							void fragment(void){
v_normal=vec3(0,1,0);
									gl_FragColor=grid_color(v_uv,u_camera_position.xz);
							}


`
        }),
        plane: engine.materials.create({
          wireframe: !true,
          state: {
            cullFace: null

          },

          shader: `
						void vertex(){
								v_position_world = a_position.xzy*1000.;
v_position_world.xz += u_camera_position.xz;
                gl_Position = u_view_projection_matrix* vec4(v_position_world,1.0);
								
						}

#define HAS_NORMAL
vec3 v_normal;
	void fragment(void){
            v_normal=vec3(0,1,0);
								gl_FragColor=vec4(0.5);
							}
`
        }),
        ground : engine.materials.create({
          state: { cullFace: null },
          shader: `
void vertex(){
	v_position_world = a_position.xzy * 16000.0;
	v_position_world.xz += u_camera_position.xz;
	gl_Position = u_view_projection_matrix * vec4(v_position_world, 1.0);
}
#define HAS_NORMAL
vec3 v_normal;
float checker(vec2 p, vec2 dx, vec2 dy) {
	vec2 w = max(abs(dx), abs(dy)) + 0.001;
	vec2 i = 2.0 * (abs(fract((p - 0.5 * w) * 0.5) - 0.5) - abs(fract((p + 0.5 * w) * 0.5) - 0.5)) / w;
	return 0.5 - 0.5 * i.x * i.y;
}
void fragment(void){
	v_normal = vec3(0.0, 1.0, 0.0);
	vec2 p = v_position_world.xz;
	vec3 col = mix(vec3(0.60, 0.64, 0.58), vec3(0.52, 0.56, 0.50), checker(p, dFdx(p), dFdy(p)));
	float d = length(p - u_camera_position.xz);
	gl_FragColor = vec4(mix(col, vec3(0.80, 0.86, 0.92), smoothstep(30.0, 420.0, d)), 1.0);
}`
        })
      };

      debug.grid.render = function () {
        engine.render_item(debug.grid.geo, debug.grid.mat, 0, 0, 0);
      };

      debug.grid.render_ground = function () {
        engine.render_item(debug.grid.geo, debug.grid.ground, 0, 0, 0);
      };

      debug.grid.render_plane = function () {
        engine.render_item(debug.grid.geo, debug.grid.plane, 0, 0, 0);
      };


      debug.cube = engine.geometries.cube(1, 1, 1, 1);

      debug.axes_lines = engine.geometries.create({
        attributes: {
          a_position: {
            data: new Float32Array([
              0, 0, 0, 1, 0, 0,
              0, 0, 0, 0, 1, 0,
              0, 0, 0, 0, 0, -1
            ]),
            item_size: 3,
          },
          a_color: {
            data: new Float32Array([
              5, 0, 0, 5, 5, 0, 0, 5,

              0, 5, 0, 5, 0, 5, 0, 5,

              0, 0, 5, 5, 0, 0, 5, 5

            ]),
            item_size: 4
          },

        }
      })

      debug.mesh = function debug_mesh(def) {
        def = def || {};
        def.max_items = def.max_items || (4096 * 4);
        let _shader;
        if (def.material && def.material.shader) {
          _shader = def.material.shader;
          delete def.material.shader;
        }


        const props = {
          flat_normals: true,
          enable_vertex_color: true,

        };
        if (def.material) {
          def.material.props = Object.assign(props, def.material.props || {});
        }


        const mesh = {
          geo: def.geo || engine.geometries.cube(1, 1, 1, 1),
          needs_update: false,
          mat: engine.materials.create(Object.assign({
            wireframe1: true,
            compiler: "pbr",
            props: props,
            shader: `
attribute vec3 a_mesh_position;
attribute vec3 a_mesh_scale;
attribute vec4 a_mesh_rotation;
attribute vec3 a_mesh_color;
vec3 transform_quat(vec4 q, vec3 v)
{
   return (v + cross(2.0 * q.xyz, cross(q.xyz, v) + q.w * v));
}
vec4 get_a_color(vec4 color){
return color;
}
void vertex(){
#ifdef ENABLE_VERTEX_COLOR
	v_color.rgb=a_mesh_color*get_a_color(a_color).rgb;
#endif
v_uv=a_uv;

v_position_world.xyz=transform_quat(a_mesh_rotation,get_a_position(a_position.xyz)*a_mesh_scale)+a_mesh_position;


v_position_world=(u_model_matrix*vec4(v_position_world, 1.0)).xyz;


v_normal_world=(u_model_matrix*vec4(transform_quat(a_mesh_rotation, a_normal),0)).xyz;
v_position_view = (u_view_matrix * vec4(v_position_world, 1.0)).xyz;
gl_Position = u_view_projection_matrix*vec4(v_position_world,1.0);

}`
          }, Object.assign({}, def.material || {})))
        };

        const data = wa.fp32_array(def.max_items * 6);
        mesh.data = data;
        mesh.dattr = engine.geometry_set_attr({ buffer_type: GL_DYNAMIC_DRAW, item_size: 3, divisor: 1, stride: 13 * 4, offset: 0 });

        mesh.geo.attr.a_mesh_position = mesh.dattr.uuid;
        mesh.geo.attr.a_mesh_scale = engine.geometry_set_attr({ buffer_type: GL_DYNAMIC_DRAW, item_size: 3, divisor: 1, stride: 13 * 4, offset: 3 * 4 }).uuid;
        mesh.geo.attr.a_mesh_rotation = engine.geometry_set_attr({ buffer_type: GL_DYNAMIC_DRAW, item_size: 4, divisor: 1, stride: 13 * 4, offset: 6 * 4 }).uuid;
        mesh.geo.attr.a_mesh_color = engine.geometry_set_attr({ buffer_type: GL_DYNAMIC_DRAW, item_size: 3, divisor: 1, stride: 13 * 4, offset: 10 * 4 }).uuid;




        if (_shader) {
          mesh.mat = engine.materials.clone(mesh.mat, { shader: _shader });
        }


        let i = 0;
        mesh.color = [1, 1, 1];
        mesh.set_color = function (r, g, b) {
          this.color[0] = r;
          this.color[1] = g;
          this.color[2] = b;
          return this;
        };
        mesh.add = function (x, y, z, sx, sy, sz, rx, ry, rz, rw) {

          data[i++] = x;
          data[i++] = y;
          data[i++] = z;



          data[i++] = sx;
          data[i++] = sy;
          data[i++] = sz;

          data[i++] = rx;
          data[i++] = ry;
          data[i++] = rz;
          data[i++] = rw;


          data[i++] = this.color[0];
          data[i++] = this.color[1];
          data[i++] = this.color[2];

          this.needs_update = true;
          return this;
        };

        mesh.add_pos_rot = function (x, y, z, rx, ry, rz, rw) {
          return this.add(x, y, z, 1, 1, 1, rx, ry, rz, rw);
        };

        mesh.add_posv_rotv_scale = function (p, r, sx, sy, sz) {
          return this.add(p[0], p[1], p[2], sx, sy, sz, r[0], r[1], r[2], r[3]);
        };

        mesh.add_pos_rot_scale = function (x, y, z, rx, ry, rz, rw, sx, sy, sz) {
          return this.add(x, y, z, sx, sy, sz, rx, ry, rz, rw);
        };

        mesh.add_pos_rot_scale01 = function (x, y, z, rx, ry, rz, rw, ss) {
          return this.add(x, y, z, ss, ss, ss, rx, ry, rz, rw);
        };


        mesh.add_pos = function (x, y, z) {
          return this.add(x, y, z, 1, 1, 1, 0, 0, 0, 1);
        };

        mesh.add_pos_scale = function (x, y, z, sx, sy, sz) {
          return this.add(x, y, z, sx, sy, sz, 0, 0, 0, 1);
        };
        mesh.add_pos_scale01 = function (x, y, z, s) {
          return this.add(x, y, z, s, s, s, 0, 0, 0, 1);
        };
        mesh.add_posv_scale = function (p, sx, sy, sz) {
          return this.add(p[0], p[1], p[2], sx, sy, sz, 0, 0, 0, 1);
        };

        let x, y, z, sx, sy, sz
        mesh.add_aabb = function (minx, miny, minz, maxx, maxy, maxz) {
          sx = maxx - minx;
          sy = maxy - miny;
          sz = maxz - minz;
          x = minx + sx * 0.5;
          y = miny + sy * 0.5;
          z = minz + sz * 0.5;

          return this.add_pos_scale(x, y, z, sx, sy, sz);

        };

        mesh.clear = function () {
          i = 0;
          this.draw_instances = 0;
        };

        mesh.render = function () {


          if (i > 0) {
            this.data_length = i;
            this.draw_instances = 0;
            engine.geometry_set_attr(mesh.dattr, this.data, this.data_length);
            this.needs_update = false;
            this.draw_instances = this.data_length / 13;
          }
          if (this.draw_instances > 0) {
            engine.render_item(this.geo, this.mat, 0, 0, this.draw_instances);
          }

          return this;
        };
        return mesh;
      }


      // `material` (optional) is merged into the material's definition: { state: { depthFunc: null } } draws the lines over everything (the gizmo's), like points_mesh's
      debug.lines_mesh = function (max_lines, material) {
        max_lines = max_lines || (4096 * 1);
        const mesh = {
          geo: engine.create_geometry(),
          mat: engine.materials.create(Object.assign({
            props: {
              draw_type: GL_LINES,
              enable_vertex_color: true,
            },

            shader: `
attribute vec3 a_position;
attribute vec4 a_color;

void vertex(){
  v_color=a_color;
	vec3 v_position=a_position.xyz;
  gl_Position = u_view_projection_matrix*vec4(v_position,1.0);
}

void fragment(void){
	gl_FragColor=v_color;
}
` }, material || {}))
        };

        const data = new Float32Array(max_lines * 7);
        let i = 0;

        mesh.data = data;
        mesh.a_position = engine.geometry_set_attr({ buffer_type: GL_DYNAMIC_DRAW, item_size: 3, stride: 7 * 4, offset: 0 });
        mesh.geo.attr.a_color = engine.geometry_set_attr({ buffer_type: GL_DYNAMIC_DRAW, item_size: 4, stride: 7 * 4, offset: 3 * 4 }).uuid;
        mesh.geo.attr.a_position = mesh.a_position.uuid;



        mesh.color = [1, 1, 1, 1];
        mesh.set_color = function (r, g, b) {
          this.color[0] = r;
          this.color[1] = g;
          this.color[2] = b;
          return this;
        };
        mesh.add = function (x0, y0, z0, r0, g0, b0, x1, y1, z1, r1, g1, b1) {
          data[i++] = x0;
          data[i++] = y0;
          data[i++] = z0;
          data[i++] = r0;
          data[i++] = g0;
          data[i++] = b0;
          data[i++] = 1;


          data[i++] = x1;
          data[i++] = y1;
          data[i++] = z1;
          data[i++] = r1;
          data[i++] = g1;
          data[i++] = b1;
          data[i++] = 1;

          this.needs_update = true;
          return this;
        };

        mesh.add_xyz = function (x0, y0, z0, x1, y1, z1) {
          this.add(
            x0, y0, z0, this.color[0], this.color[1], this.color[2],
            x1, y1, z1, this.color[0], this.color[1], this.color[2]
          );
          return this;
        };
        mesh.add_dirv = function (pos, dir, length) {
          mesh.add_xyz(pos[0], pos[1], pos[2], pos[0] + dir[0] * length, pos[1] + dir[1] * length, pos[2] + dir[2] * length);
        }

        mesh.data_length = 0;

        mesh.clear = function () {
          i = 0;
          this.data_length = 0;
        };

        mesh.render = function () {

          if (i > 0) {
            this.data_length = i;
            engine.geometry_set_attr(mesh.a_position, data, this.data_length);
            i = 0;
          }

          if (this.data_length > 0) {
            engine.render_item(this.geo, this.mat, 0, this.data_length / 7, 0);

          }
          return this;
        };

        return mesh;

      }


      debug.points_mesh = function (def) {
        def = def || {};
        max_points = def.max_points || (2048 * 1);
        let _shader;
        if (def.material && def.material.shader) {
          _shader = def.material.shader;
          delete def.material.shader;
        }
        const props = {
          draw_type: GL_POINTS,
          enable_vertex_color: true,
        };
        if (def.material) {
          def.material.props = Object.assign(props, def.material.props || {});
        }
        const mesh = {
          geo: engine.create_geometry(),

          mat: engine.materials.create(Object.assign({
            props: props,
            shader: `
attribute vec4 a_point_position;
attribute vec4 a_point_color;

void vertex(){
  v_color=a_point_color;
	v_position_world=a_point_position.xyz;
  gl_Position = u_view_projection_matrix*vec4(v_position_world,1.0);
  gl_PointSize=(32.0/gl_Position.w)*a_point_position.w;
}

void fragment(void){
	gl_FragColor=v_color;
}`
          }, Object.assign({}, def.material || {}))),
        };

        if (_shader) {
          mesh.mat = engine.materials.clone(mesh.mat, { shader: _shader });
        }

        const data = new Float32Array(max_points * 8);
        let i = 0;


        mesh.a_point_position = engine.geometry_set_attr({ buffer_type: GL_DYNAMIC_DRAW, item_size: 4, stride: 8 * 4, offset: 0 });
        mesh.geo.attr.a_point_color = engine.geometry_set_attr({ buffer_type: GL_DYNAMIC_DRAW, item_size: 4, stride: 8 * 4, offset: 4 * 4 }).uuid;
        mesh.geo.attr.a_point_position = mesh.a_point_position.uuid;


        mesh.color = [1, 1, 1, 1];
        mesh.set_color = function (r, g, b) {
          this.color[0] = r;
          this.color[1] = g;
          this.color[2] = b;
          return this;
        };
        mesh.add = function (x0, y0, z0, r0, g0, b0, s0) {

          data[i++] = x0;
          data[i++] = y0;
          data[i++] = z0;
          data[i++] = s0;

          data[i++] = r0;
          data[i++] = g0;
          data[i++] = b0;
          data[i++] = 1;

          this.needs_update = true;
          return this;
        };

        mesh.add2 = function (x0, y0, z0, s0) {

          data[i++] = x0;
          data[i++] = y0;
          data[i++] = z0;
          data[i++] = s0;
          data[i++] = this.color[0];
          data[i++] = this.color[1];
          data[i++] = this.color[2];
          data[i++] = 1;

          this.needs_update = true;
          return this;
        };

        mesh.data = data;
        mesh.data_length = 0;

        mesh.clear = function () {
          i = 0;

          this.data_length = 0;
        };

        mesh.render = function () {

          if (i > 0) {
            this.data_length = i;

            engine.geometry_set_attr(this.a_point_position, data, this.data_length);
            i = 0;
          }

          if (this.data_length > 0) {
            PR.points = this.data_length / 8;
            PR.pdata = data.length + "/" + this.data_length;

            engine.render_item(this.geo, this.mat, 0, this.data_length / 8, 0);

          }
          return this;
        };

        return mesh;

      }




      engine.debug_lines = new debug.lines_mesh();
      engine.debug_points = new debug.points_mesh({
        material: {
          state: { depthFunc: null }
        }
      });
      engine.solid_boxes = debug.mesh();
      engine.wired_boxes = debug.mesh({ material: { wireframe: true }});
      engine.solid_spheres = debug.mesh({ geo: engine.geometries.sphere(1, 8, 8) });
      engine.solid_capsules = debug.mesh({ geo: engine.geometries.capsule(1, 1, 6, 4) });
      engine.wired_capsules = debug.mesh({ geo: engine.geometries.capsule(1, 1, 6, 4), material: { wireframe: true } });
      engine.wired_spheres = debug.mesh({ geo: engine.geometries.sphere(1, 6, 6), material: { wireframe: true } });
      // DBG_CAPSULE is drawn exactly as two end spheres + 4 side lines (the unit capsule mesh above scales its
      // domes and cylinder together, so it can't show a tall capsule's real width); own mesh so its colour
      // doesn't leak into DBG_SPHERE
      engine.wired_capsule_caps = debug.mesh({ geo: engine.geometries.sphere(1, 8, 8), material: { wireframe: true } });

      engine.axes_lines = debug.mesh({ geo: debug.axes_lines, material: { props: {draw_type:GL_LINES} } });


      engine.solid_bone = debug.mesh({ geo: engine.geometries.cube_offset(1, 1, 1, 1, 0, 0.5, 0), material: { wireframe1: true } });



      engine.aabbs = debug.mesh({
        material: {
          wireframe: true,
        },
        geo: engine.geometries.cube(1, 1, 1, 1),
      });

      engine.draw_aabb = function (minx, miny, minz, maxx, maxy, maxz) {
        engine.aabbs.set_color(1, 0, 0).add_aabb(minx, miny, minz, maxx, maxy, maxz);
      };

      debug.clear = function () {
        engine.aabbs.clear();
        engine.debug_lines.clear();
        engine.debug_points.clear();
        engine.solid_boxes.clear();
        engine.wired_boxes.clear();
        engine.solid_spheres.clear();
        engine.solid_capsules.clear();
        engine.wired_capsules.clear();
        engine.wired_spheres.clear();
        engine.wired_capsule_caps.clear();
        engine.solid_bone.clear();
        engine.axes_lines.clear();
      };

      debug.render = function () {
        engine.aabbs.render();
        engine.solid_boxes.render();
        engine.wired_boxes.render();
        engine.wired_capsules.render();
        engine.wired_spheres.render();
        engine.wired_capsule_caps.render();
        engine.solid_spheres.render();
        engine.solid_capsules.render();
        engine.debug_lines.render();
        engine.debug_points.render();
        engine.solid_bone.render();
        engine.axes_lines.render();
      };


      debug.scene = function () {
        const camera = engine.create_camera();

        const scene = {
          camera: camera,
          engine:engine,
          dlight0: engine.create_light({ eular: [-2.08500075340271, -1.147500991821289, 0] }),
          alight0: engine.create_light({ color: [0.5, 0.5, 0.5] }),




          model: engine.math.mat4(),
          world_size:1024


        };

        console.log("scene", scene);

        scene.on_render_pass = new events.event(scene, [0, 0]);
        scene.on_shadow_pass = new events.event(scene, [0, 0]);

        camera.update_aspect(engine.render_width / engine.render_height);
        engine.on_resize.add(function () {
          console.log("engine.on_resize", engine.render_width / engine.render_height)
          camera.update_aspect(engine.render_width / engine.render_height);

        });
        const drag_points = {
          points: [], points_cb: new Map(),
          hover_point: null,
          active_point: null,
          sindex: -1,
          size: 14,         // point size of a handle (like every debug point it shrinks with the distance; hover / active are a little larger)
          radius: 0.8,      // world radius of the mouse ray test that hovers / picks a handle
          def_cb: function (a, p) {
            math.vec3.add(p, p, a);
          },
          add: function (p, cb) {
            let i = this.points.length;
            this.points_cb.set(p, cb || this.def_cb);

            this.points.push(p);
            return p;
          }
        };

        const canv = engine.webgl.canvas;

        engine.webgl.elm = dom.use_mouse(canv);


        drag_points.process = function () {
          const points = this.points;
          const deg = engine.webgl.canvas.hover_dt;
          let hindex = -1;
          if (deg > 0) this.hover_point = null;
          points.forEach(function (poi, i) {

            if (deg > 0 && !camera.locked) {
              if (camera.mouse_ray_test_sphere(poi, drag_points.radius)) {
                drag_points.hover_point = poi;
                hindex = i;
              }
            }
            if (drag_points.hover_point !== poi && drag_points.active_point !== poi) engine.debug_points.add(poi[0], poi[1], poi[2], 0.8, 0.8, 0.8, drag_points.size);

          });

          if (drag_points.hover_point) {

            this.sindex = hindex;
            engine.debug_points.add(drag_points.hover_point[0], drag_points.hover_point[1], drag_points.hover_point[2], 1, 0, 0, drag_points.size * (16 / 14));
          }

          if (canv.mouse_down_buttons == 1 && this.hover_point) {
            camera.locked = true;
            if (this.hover_point !== this.active_point) {
              this.active_point = this.hover_point;

              camera.mouse_ray_set_drag_plane(this.active_point);
            }

          }

          if (canv.mouse_down_buttons !== 1) this.active_point = null;
          if (this.active_point && canv.mouse_drag_buttons == 1) {

            camera.mouse_ray_intersect_drag_plane();

            const cb = this.points_cb.get(this.active_point);
            if (cb) cb(camera.mouse_drag_plane_hit, this.active_point);

            engine.debug_points.add(drag_points.active_point[0], drag_points.active_point[1], drag_points.active_point[2], 1, 0, 0, drag_points.size * (17 / 14));
          }

        };

        scene.drag_points = drag_points;
        engine.phy.plane_body();

        camera.use_mouse_drag_features();
        const rc = engine.phy.raycast_hit();
        engine.on_frame_begin.add(function (time, time_delta) {
         
          camera.update_mouse_ray(canv.mouse_x, canv.mouse_y, engine.render_offset_width, engine.render_offset_height);

          if (rc.position_distance[3] > 0) {
            engine.debug_lines.add_dirv(rc.position_distance, rc.normal, 5);
            scene.raycast_pos = rc.position_distance;
            scene.raycast_normal = rc.normal;
            //engine.debug_points.add(camera.control.world_position[0], camera.control.world_position[1], camera.control.world_position[2], 1, 1, 0.5, 2);


          }

          engine.uniforms.set('u_model_matrix', scene.model);
          engine.uniforms.set('sun_direction', scene.dlight0.fw_vector);
          engine.uniforms.set('directional_lights[0].direction', scene.dlight0.fw_vector);
          engine.uniforms.set('directional_lights[0].color', scene.dlight0.color);
          engine.uniforms.set('directional_lights[0].illuminated', scene.dlight0.illuminated);
          engine.uniforms.set('directional_lights[0].attenuation', scene.dlight0.attenuation);
          engine.uniforms.set('ambient_lights[0].color', scene.alight0.color);
          engine.uniforms.set('ambient_lights[0].illuminated', scene.alight0.illuminated);
          engine.uniforms.set('ambient_lights[0].attenuation', scene.alight0.attenuation);

          canv.hover_dt = Math.sqrt(Math.pow(canv.hover_dx, 2) + Math.pow(canv.hover_dy, 2));

          PR.mouse_drag_buttons = canv.mouse_drag_buttons;
          PR.hover_dt = engine.webgl.canvas.hover_dt;
          if (engine.keys[KBD_KEY_W]) {
            engine.tra_model.front_back(camera.control, -0.5);
          }
          if (engine.keys[KBD_KEY_S]) {
            engine.tra_model.front_back(camera.control, 0.5);
          }

          drag_points.process();
          camera.update_look_at(time_delta);

          engine.push_camera(camera);
          engine.global_camera_position[0] = camera.world_position[0];
          engine.global_camera_position[1] = camera.world_position[1];
          engine.global_camera_position[2] = camera.world_position[2];

          engine.global_camera_position[3] = camera.far;

          if (engine.debug_list.length > 0) {
            let i = 0, cmd;
            const f32 = engine.debug_list;
            while (i < f32.length) {
              cmd = f32[i++];
              switch (cmd) {
                case DBG_SPHERE:
                  engine.wired_spheres.add_pos_rot_scale01(f32[i++], f32[i++], f32[i++], f32[i++], f32[i++], f32[i++], f32[i++], f32[i++]);
                  break;

                case DBG_AXES_LINES:
                  engine.axes_lines.add_pos_rot_scale01(f32[i++], f32[i++], f32[i++], f32[i++], f32[i++], f32[i++], f32[i++], f32[i++]);
                  break;

                case DBG_CAPSULE: {
                  // pos(3) quat(4) radius, cylinder length (the shape's `height`, tips add `radius` each)
                  const px = f32[i], py = f32[i + 1], pz = f32[i + 2];
                  const qx = f32[i + 3], qy = f32[i + 4], qz = f32[i + 5], qw = f32[i + 6];
                  const cr = f32[i + 7], half = f32[i + 8] * 0.5;
                  i += 9;
                  // capsule axis (local Y) and the two perpendicular axes, rotated by the quaternion
                  const ax = 2 * (qx * qy - qz * qw), ay = 1 - 2 * (qx * qx + qz * qz), az = 2 * (qy * qz + qx * qw);
                  const xx = 1 - 2 * (qy * qy + qz * qz), xy = 2 * (qx * qy + qz * qw), xz = 2 * (qx * qz - qy * qw);
                  const zx = 2 * (qx * qz + qy * qw), zy = 2 * (qy * qz - qx * qw), zz = 1 - 2 * (qx * qx + qy * qy);
                  const tx = px + ax * half, ty = py + ay * half, tz = pz + az * half;
                  const bx = px - ax * half, by = py - ay * half, bz = pz - az * half;
                  engine.wired_capsule_caps.set_color(1, 0, 0)
                    .add_pos_rot_scale01(tx, ty, tz, qx, qy, qz, qw, cr)
                    .add_pos_rot_scale01(bx, by, bz, qx, qy, qz, qw, cr);
                  for (let s = 0; s < 4; s++) { // +x, -x, +z, -z
                    const ox = (s < 2 ? xx : zx) * cr * (s & 1 ? -1 : 1), oy = (s < 2 ? xy : zy) * cr * (s & 1 ? -1 : 1), oz = (s < 2 ? xz : zz) * cr * (s & 1 ? -1 : 1);
                    engine.debug_lines.set_color(1, 0, 0).add_xyz(tx + ox, ty + oy, tz + oz, bx + ox, by + oy, bz + oz);
                  }
                  break;
                }

                

                case DBG_POINT:
                  engine.debug_points.add(f32[i + 0], f32[i + 1], f32[i + 2], f32[i + 3], f32[i + 4], f32[i + 5], f32[i + 6]);
                  i += 7;
                  break;

                case DBG_AABB:
                  engine.draw_aabb(f32[i + 0], f32[i + 1], f32[i + 2], f32[i + 3], f32[i + 4], f32[i + 5]);
                  i += 6;
                  break;

                case DBG_LINE:
                  engine.debug_lines.set_color(f32[i + 6], f32[i + 7], f32[i + 8]).add_xyz(f32[i + 0], f32[i + 1], f32[i + 2], f32[i + 3], f32[i + 4], f32[i + 5]);
                  i += 9;
                  break;
              }
            }
          }

        });


        scene.use_deffered_rendering = function (def) {
          this.dfd = engine.deffered_rendering(Object.assign({
            camera: scene.camera,
            dlight0: scene.dlight0,
            ENABLE_ATMOSPHERE: !true,
            ENABLE_SHADOWS: true,
            ENABLE_LOGDEPTH: false,
          }, def || {}));
          this.dfd.enabled = true;
          this.dfd.on_shadowmap = function (time, time_delta) {
            scene.on_shadow_pass.params[0] = time;
            scene.on_shadow_pass.params[1] = time_delta;

            scene.on_shadow_pass.trigger_params();
          };
          this.dfd.on_frame = function (time, time_delta) {
            scene.on_render_pass.params[0] = time;
            scene.on_render_pass.params[1] = time_delta;

            scene.on_render_pass.trigger_params();
          };
        };

        engine.on_frame.add(function (time, time_delta) {
          if (scene.dfd && scene.dfd.enabled) {

            return;
          }
          scene.on_render_pass.params[0] = time;
          scene.on_render_pass.params[1] = time_delta;

          scene.on_render_pass.trigger_params();

        });

        engine.on_frame_end.add(function (time, time_delta) {
          if (canv.mouse_down_buttons < 0) camera.locked = false;
          engine.pop_camera();
          canv.hover_dx = 0;
          canv.hover_dy = 0;
          canv.mouse_drag_start_buttons = -1;
          engine.phy.world_camera_raycast(rc.uuid, camera.uuid, 1000);
          engine.debug.clear();
          scene.raycast_pos = null;
        });

        engine.webgl.elm.mouse_drag = function (dx, dy, e) {
          if (camera.locked) return;
          if (e.buttons == 1) {

            engine.tra_model.yaw_pitch(camera.control, -dx * 0.0025, -dy * 0.0025);
          }
          else if (e.buttons == 2) {
            engine.tra_model.pan_xz(camera.control, -dx *0.25, -dy * 0.25);
          }
          else if (e.buttons == 3) { engine.tra_model.yaw_pitch(scene.dlight0, -dx * 0.0025, -dy * 0.0025); }

        };




        engine.webgl.elm.mouse_wheel = function (sp, x, y, e) {
          camera.control.distance += (-sp * 0.215125);
        };

        return scene;

      }

      return debug;

    })();
  });
});
