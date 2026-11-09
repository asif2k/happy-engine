function float_objects(float_view) {

  function generateSeededRGB(seed) {
    var strSeed = String(seed);
    var hash = 0;
    for (var i = 0; i < strSeed.length; i++) {
      hash = strSeed.charCodeAt(i) + ((hash << 5) - hash);
    }
    var h = Math.abs((hash * 137.508) % 360);
    var s = 65;
    var l = 50;
    var c = (1 - Math.abs(2 * l / 100 - 1)) * (s / 100);
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l / 100 - c / 2;
    var r = 0, g = 0, b = 0;

    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }

    return [(r + m) * 1.5, (g + m) * 1.5, (b + m) * 1.5];
  }

  engine.generateSeededRGB = generateSeededRGB;
  engine.camera_stack = object_stack(function (cam) {
    if (cam) {
      engine.uniforms.set('u_view_projection_matrix', cam.view_projection_matrix);
      engine.uniforms.set('u_projection_matrix', cam.projection_matrix);
      engine.uniforms.set('u_view_matrix', cam.view_matrix);
      engine.uniforms.set('u_inverse_view_matrix', cam.inverse_view_matrix);
      engine.uniforms.set('u_camera_fw_vector', cam.fw_vector);
      engine.uniforms.set('u_camera_sd_vector', cam.sd_vector);
      engine.uniforms.set('u_camera_up_vector', cam.up_vector);
      engine.uniforms.set('u_camera_position', cam.world_position);
      engine.uniforms.set('u_inverse_view_projection_matrix', cam.inverse_view_projection_matrix);
      engine.uniforms.set('u_projection_inverse_matrix', cam.inverse_projection_matrix);
      engine.uniforms.set('u_relative_view_projection_matrix', cam.relative_view_projection_matrix);
      engine.uniforms.set('u_camera_bounds', cam.camera_bounds);




    }

  });

  engine.tra_model = function (tra) {
    tra = tra || {};
    tra.uuid = engine.guid();
    ubuff[ui++] = CMD_TRA_MODEL_CREATE;
    ubuff[ui++] = tra.uuid;

    tra.world_position = float_view.float32(3);
    tra.world_rotation = float_view.float32(4);
    tra.world_scale = float_view.float32(3);
    tra.model_matrix = float_view.float32(16);
    tra.up_vector = new Float32Array(tra.model_matrix.buffer, tra.model_matrix.byteOffset + (4 * 4), 3);
    tra.fw_vector = new Float32Array(tra.model_matrix.buffer, tra.model_matrix.byteOffset + (8 * 4), 3);
    tra.sd_vector = new Float32Array(tra.model_matrix.buffer, tra.model_matrix.byteOffset + 0, 3);
    tra.eular = [0, 0, 0];

    return tra;
  };

  engine.tra_model.set_eular = function (tra, x, y, z) {
    ubuff[ui++] = CMD_TRA_MODEL_SET_EULAR;
    ubuff[ui++] = tra.uuid;
    fbuff[ui++] = x;
    fbuff[ui++] = y;
    fbuff[ui++] = z;
  };

  engine.tra_model.add_position = function (tra, x, y, z) {
    ubuff[ui++] = CMD_TRA_MODEL_ADD_POSITON;
    ubuff[ui++] = tra.uuid;
    fbuff[ui++] = x;
    fbuff[ui++] = y;
    fbuff[ui++] = z;
  };

  engine.tra_model.set_position = function (tra, x, y, z) {
    ubuff[ui++] = CMD_TRA_MODEL_SET_POSITON;
    ubuff[ui++] = tra.uuid;
    fbuff[ui++] = x;
    fbuff[ui++] = y;
    fbuff[ui++] = z;
  };

  engine.tra_model.set_rotation = function (tra, x, y, z, w) {
    ubuff[ui++] = CMD_TRA_MODEL_SET_ROTATION;
    ubuff[ui++] = tra.uuid;
    fbuff[ui++] = x;
    fbuff[ui++] = y;
    fbuff[ui++] = z;
    fbuff[ui++] = w;
  };

  // The parent of a model (a model, or null for none): the model's position / rotation are then in the parent's frame and the worker composes the world pose
  // (tra.world_position / world_rotation, read back like any model's). Whatever moves the parent moves the child with no page work.
  engine.tra_model.set_parent = function (tra, parent) {
    ubuff[ui++] = CMD_TRA_MODEL_SET_PARENT;
    ubuff[ui++] = tra.uuid;
    ubuff[ui++] = parent ? parent.uuid : 0;
  };

  // The model takes a physics body's pose (its render pose, the one body.world_position / world_rotation show) in the worker every frame; null unlinks it.
  engine.tra_model.link_body = function (tra, body) {
    ubuff[ui++] = CMD_TRA_MODEL_LINK_BODY;
    ubuff[ui++] = tra.uuid;
    ubuff[ui++] = body ? body.uuid : 0;
  };

  // The model that follows a physics body (made, linked and kept on the body the first time it is asked for): parent a model to it to ride the body.
  engine.tra_model.body_model = function (body) {
    if (!body || !body.uuid || !body.shapes) throw new Error("tra_model.body_model needs a physics body (engine.phy)");
    if (!body.follow_model) {
      body.follow_model = engine.tra_model();
      engine.tra_model.link_body(body.follow_model, body);
    }
    return body.follow_model;
  };

  engine.tra_model.yaw_pitch = function (tra, dx, dy) {
    tra.eular[1] += dx;
    tra.eular[0] += dy;
    engine.tra_model.set_eular(tra, tra.eular[0], tra.eular[1], tra.eular[2]);
  };

  engine.tra_model.pan_xz = function (tra, dx, dy) {
    engine.tra_model.add_position(tra,
      (tra.sd_vector[0] * dx) + (tra.fw_vector[0] * dy),
      0,
      (tra.sd_vector[2] * dx) + (tra.fw_vector[2] * dy)
    );
  };


  engine.tra_model.front_back = function (tra, sp) {
    engine.tra_model.add_position(tra, tra.fw_vector[0] * sp, tra.fw_vector[1] * 0, tra.fw_vector[2] * sp);
  };

  engine.create_camera = function (def) {

    def = def || {};
    const cam = {
      type: def.type || 1,
      near: def.near || 0.1,
      far: def.far || 2048,
      aspect: 1,
      locked: false,

    };

    Object.assign(cam, def);

    cam.node = engine.tra_model();

    cam.uuid = engine.guid();

    
    ubuff[ui++] = CMD_TRA_CAMERA_CREATE;
    ubuff[ui++] = cam.uuid;
    ubuff[ui++] = cam.node.uuid;
    ubuff[ui++] = cam.type;
    fbuff[ui++] = cam.near;
    fbuff[ui++] = cam.far;
    fbuff[ui++] = cam.aspect;



    if (cam.type == 1) {
      cam.fov = def.fov || 80;
      fbuff[ui++] = cam.fov;
    }
    else {
      cam.left = def.left || 0;
      cam.right = def.right || 1;
      cam.top = def.top || 0;
      cam.bottom = def.bottom || 1;

      fbuff[ui++] = cam.left;
      fbuff[ui++] = cam.right;
      fbuff[ui++] = cam.top;
      fbuff[ui++] = cam.bottom;
    }

    cam.target = float_view.float32(3);
    cam.view_matrix = float_view.float32(16);
    cam.inverse_view_matrix = float_view.float32(16);
    cam.projection_matrix = float_view.float32(16);
    cam.inverse_projection_matrix = float_view.float32(16);
    cam.view_projection_matrix = float_view.float32(16);
    cam.inverse_view_projection_matrix = float_view.float32(16);
    cam.relative_view_projection_matrix = float_view.float32(16);
    cam.camera_bounds = float_view.float32(4);
    cam.world_position = float_view.float32(3);
    cam.mouse_ray = float_view.float32(3);

    cam.up_vector = new Float32Array(cam.view_matrix.buffer, cam.view_matrix.byteOffset + (4 * 4), 3);
    cam.fw_vector = new Float32Array(cam.view_matrix.buffer, cam.view_matrix.byteOffset + (8 * 4), 3);
    cam.sd_vector = new Float32Array(cam.view_matrix.buffer, cam.view_matrix.byteOffset + 0, 3);

    cam.control = engine.tra_model();
    cam.control.distance = 5;

    this._cameras.set(cam.uuid, cam);

    cam.update_look_at = function (dt) {
      // the camera eases to its target by 8% a frame (as if at 30 fps: the debug scenes' feel); a camera that has to KEEP UP with something (a creature that walks) sets look_tau: it is then that many seconds behind, at any frame rate
      let ts = 1.0 - Math.pow(0.04, 1 / 30);
     // if (this.look_tau > 0) ts = 1.0 - Math.exp(-Math.min(Math.max(dt, 0.001), 0.25) / this.look_tau);
      ubuff[ui++] = CMD_TRA_CAMERA_LOOK_AT;
      ubuff[ui++] = this.uuid;
      ubuff[ui++] = this.control.uuid;
      fbuff[ui++] = 0;
      fbuff[ui++] = 0;

      fbuff[ui++] = this.control.distance;
      fbuff[ui++] = ts;
    };


    cam.update_mouse_ray = function (mouse_x, mouse_y, width, height) {
      ubuff[ui++] = CMD_TRA_CAMERA_UPDATE_MOUSE_RAY;
      ubuff[ui++] = this.uuid;
      fbuff[ui++] = mouse_x;
      fbuff[ui++] = mouse_y;
      fbuff[ui++] = width;
      fbuff[ui++] = height;
    };


    cam.update_aspect = function (asp) {
      ubuff[ui++] = CMD_TRA_CAMERA_UPDATE_ASPECT;
      ubuff[ui++] = this.uuid;
      fbuff[ui++] = asp;
      this.aspect = asp;
    };

    cam.update_perspective = function (near, far, fov) {
      this.near = near;
      this.far = far;
      this.fov = fov;
      ubuff[ui++] = CMD_TRA_CAMERA_SET_PERSPECTIVE;
      ubuff[ui++] = this.uuid;
      fbuff[ui++] = this.near;
      fbuff[ui++] = this.far;
      fbuff[ui++] = this.aspect;
      fbuff[ui++] = this.fov;

     
    };

    cam.use_mouse_drag_features = function () {
      const cam = this;
      cam.drag_direction = [0, 0, 0];
      cam.last_drag_direction = [0, 0, 0];
      cam.mouse_drag_plane = [0, 0, 0, 0];
      cam.mouse_drag_plane_hit = [0, 0, 0];
      cam.mouse_drag_plane_hit_start = [0, 0, 0];
      cam.drag_magnitude = 0;
      let t = new Float32Array(12);
      cam.intersect_aabb = function (origin, dir, ab) {
        t[1] = (ab[0] - origin[0]) / dir[0];
        t[2] = (ab[3] - origin[0]) / dir[0];
        t[3] = (ab[1] - origin[1]) / dir[1];
        t[4] = (ab[4] - origin[1]) / dir[1];
        t[5] = (ab[2] - origin[2]) / dir[2];
        t[6] = (ab[5] - origin[2]) / dir[2];
        t[7] = Math.max(Math.max(Math.min(t[1], t[2]), Math.min(t[3], t[4])), Math.min(t[5], t[6]));
        t[8] = Math.min(Math.min(Math.max(t[1], t[2]), Math.max(t[3], t[4])), Math.max(t[5], t[6]));
        return (t[8] < 0 || t[7] > t[8]) ? null : t[7];

      };

      cam.mouse_ray_intersect_aabb = function (ab) {
        return this.intersect_aabb(this.world_position, this.mouse_ray, ab);
      };

      cam.test_mouse_sphere = function (origin, dir, center, radius) {

        t[0] = center[0] - origin[0];
        t[1] = center[1] - origin[1];
        t[2] = center[2] - origin[2];
        const tca = (t[0] * dir[0] + t[1] * dir[1] + t[2] * dir[2]);
        const d2 = ((t[0] * t[0] + t[1] * t[1] + t[2] * t[2])) - tca * tca;
        if (d2 > radius * radius) return false;
        else return true;

      };

      cam.mouse_ray_test_sphere = function (center, radius) {
        return this.test_mouse_sphere(this.world_position, this.mouse_ray, center, radius);
      };

      cam.mouse_ray_test_sphere_xyz = function (x, y, z, radius) {
        t[0] = x;
        t[1] = y;
        t[2] = z;
        return this.test_mouse_sphere(this.world_position, this.mouse_ray, t, radius);
      };
      cam.mouse_ray_set_drag_plane = function (position) {
        math.vec3.negate(this.mouse_drag_plane, this.mouse_ray);

        this.mouse_drag_plane[3] = -math.vec3.dot(position, this.mouse_drag_plane);
        this.mouse_ray_intersect_drag_plane(this.mouse_drag_plane_hit_start);
      };

      cam.mouse_ray_intersect_drag_plane = function (hit) {
        if (hit) {
          math.ray3_intersect_plane(hit, this.world_position, this.mouse_ray, this.mouse_drag_plane);
        }
        else {
          math.ray3_intersect_plane(t, this.world_position, this.mouse_ray, this.mouse_drag_plane);
          math.vec3.sub(this.mouse_drag_plane_hit, t, this.mouse_drag_plane_hit_start);
          math.vec3.copy(this.mouse_drag_plane_hit_start, t);
        }

      };

    }

    return cam;
  }


  engine.tra_model.set_terrain_position = function (tra,hei) {
    ubuff[ui++] = CMD_TERRAIN_TRA_POSITON;
    ubuff[ui++] = tra.uuid;
    fbuff[ui++] = hei;
  };

  import("physics_system.js")


  block$("float_views_core")
}


float_objects(fmem);