import("shaders.js")

engine.shaders_cat = shaders;


const cmds = wa.u32_array(MAX_CMDS);
const cmds_float = new Float32Array(cmds.buffer, cmds.byteOffset, cmds.length);
const cmds_i32 = new Int32Array(cmds.buffer, cmds.byteOffset, cmds.length);

engine.cmds = cmds;
engine.cmds_float = cmds_float;
let ci = 0;

// Comparison mode for a shadow map needs to live on the *binding*, not the texture
// itself: the same depth texture also gets sampled as a plain sampler2D elsewhere
// (e.g. a debug preview via engine.render_texture), and a texture with
// TEXTURE_COMPARE_MODE baked in throws GL_INVALID_OPERATION ("mismatch between
// texture format and sampler type") the moment a non-shadow sampler touches it. A
// WebGL2 sampler object overrides the texture's own filter/wrap/compare state only
// for the unit it's bound to, so the debug preview (bound with sampler = null) keeps
// reading the texture's own state while sampler2DShadow reads get compared, filtered.
let shadow_compare_sampler = null;
function get_shadow_compare_sampler(gl) {
  if (!shadow_compare_sampler) {
    shadow_compare_sampler = gl.createSampler();
    gl.samplerParameteri(shadow_compare_sampler, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    gl.samplerParameteri(shadow_compare_sampler, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    gl.samplerParameteri(shadow_compare_sampler, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    gl.samplerParameteri(shadow_compare_sampler, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    gl.samplerParameteri(shadow_compare_sampler, GL_TEXTURE_COMPARE_MODE, GL_COMPARE_REF_TO_TEXTURE);
    gl.samplerParameteri(shadow_compare_sampler, GL_TEXTURE_COMPARE_FUNC, GL_LEQUAL);
  }
  return shadow_compare_sampler;
}


engine.render_texture = (function () {
  const geo = engine.geometries.plane(1, 1, 1, 1, 1);

  const u_rect = engine.math.vec4(0, 0, 1, 1);

  const mat = engine.materials.create({
    shader: `
uniform vec4  u_render_texture_rect;
uniform float u_float_params[24];
void vertex(){
v_uv=a_uv;
vec3 ppo=a_position+0.5;
float x = u_render_texture_rect.x;
    float y = u_render_texture_rect.y;
    float w = u_render_texture_rect.z;
    float h = u_render_texture_rect.w;

    // Scale and translate unit quad into rect position
    // a_position is 0..1, map it into x..x+w, y..y+h
    vec2 pos = vec2(
        x + ppo.x * w,
        y + ppo.y * h
    );

    // Convert from 0..1 normalized to clip space -1..1
    // flip y so 0,0 is top-left
    vec2 clip = vec2(
        pos.x * 2.0 - 1.0,
       -(pos.y * 2.0 - 1.0)  // flip Y
    );

    v_uv        = a_uv;
    gl_Position = vec4(clip, 0.0, 1.0);
gl_Position.z=-1.0;
//gl_Position = vec4(a_position, 1.0);

}

uniform float u_float_params[24];
uniform vec3 sun_direction;
uniform sampler2D  u_render_texture_texture;

vec2 packHeight(float h) {
    // Clamp to ensure we don't overflow the 16-bit range
    h = clamp(h, 0.0, 1.0);
    // Convert 0.0-1.0 to 0-65535 integer space
    float i = floor(h * 65535.0);
    // R gets the High byte (i / 256), G gets the Low byte (i % 256)
    // Divide by 255.0 to normalize for gl_FragColor
    return vec2(floor(i * 0.00390625), mod(i, 256.0)) * 0.00392156862;
}
${engine.shaders_cat.bicubic_height()}
uniform mat4 u_projection_inverse_matrix;
uniform mat4 u_view_inverse_matrix;
uniform mat4 u_view_matrix;
uniform mat4 u_projection_matrix;
uniform vec4 u_camera_bounds;
uniform vec3 u_camera_position;

float linearize_depth(in float depth){
    float a = u_camera_bounds[1] / (u_camera_bounds[1] - u_camera_bounds[0]);
    float b = u_camera_bounds[1] * u_camera_bounds[0] / (u_camera_bounds[0] -u_camera_bounds[1]);
    return a + b / depth;
}

vec3 reconstruct_world_position(vec2 uv,float depth){
	depth=pow(2.0, depth * log2(u_camera_bounds[1] + 1.0)) - 1.0;
	vec4 wpos =u_projection_inverse_matrix *(vec4(uv, linearize_depth(depth), 1.0) * 2.0 - 1.0);
	wpos=u_view_matrix*wpos;

	return wpos.xyz / wpos.w;
}

vec3 reconstruct_world_pos(vec2 uv,float depth){
	depth=pow(2.0, depth * log2(u_camera_bounds[1] + 1.0)) - 1.0;
	vec4 wpos =u_projection_inverse_matrix *(vec4(uv, linearize_depth(depth), 1.0) * 2.0 - 1.0);
	wpos=u_view_matrix*wpos;

	return wpos.xyz / wpos.w;
}

void fragment(void){
gl_FragColor =texture2D(u_render_texture_texture, v_uv);
}
`,
    state: {
      depthFunc: null
    },
    uniforms: {
      u_render_texture_rect: u_rect,
      u_render_texture_texture: engine.dummy_texture_rgba,

    }
  });

  let mat_array_range = engine.materials.clone(mat, {
    shader: `
uniform mediump sampler2DArray u_render_texture_texture_array;
uniform float u_render_texture_array_index;
uniform float u_render_texture_array_count;

void fragment(void){
    // Multiply the 0.0 - 1.0 X-coordinate by the number of layers we want to show
    float scaled_x = v_uv.x * u_render_texture_array_count;
    
    // fract() gives us the repeating 0.0 - 1.0 UV for the individual layer
    float local_x = fract(scaled_x);
    
    // floor() gives us the integer offset (0, 1, 2...) for the layer index
    float layer_offset = floor(scaled_x);
    
    // Clamp the offset to prevent sampling out of bounds if v_uv.x is exactly 1.0
    layer_offset = min(layer_offset, u_render_texture_array_count - 1.0);
    
    float layer = u_render_texture_array_index + layer_offset;
    
    gl_FragColor = texture(u_render_texture_texture_array, vec3(local_x, v_uv.y, layer));
}`, uniforms: {
      u_render_texture_array_index: 0,
      u_render_texture_array_count: 1
    }
  });
  const u_render_texture_channels = math.vec4(1, 1, 1, 1);
  let mat_channel = engine.materials.clone(mat, {
    shader: `
uniform vec4 u_render_texture_channels;

void fragment(void){
vec4 c =texture2D(u_render_texture_texture, v_uv);

float c0=c[0]*u_render_texture_channels[0];
float c1=c[1]*u_render_texture_channels[1];
float c2=c[2]*u_render_texture_channels[2];
float c3=c[3]*u_render_texture_channels[3];
gl_FragColor=vec4(c0+c1+c2+c3);
}`,
    uniforms: {
      u_render_texture_channels: u_render_texture_channels
    }

  });
  mat_channel.render_uniforms = function () {
    this.render_uniform_float_array("u_render_texture_channels", u_render_texture_channels);
  };


  let mat_shadow_map = engine.materials.clone(mat, {
    shader: `
uniform sampler2DShadow u_shadow_map_texture;

void fragment(void){
gl_FragColor =vec4(1);

}`,
  });


  function render_texture(tex, x, y, w, h, mt) {

    mt = mt || mat;
    tex = tex || this.dummy_texture_rgba;
    this.begin_render_item(geo, mt);

    if (mt.render_uniforms) {
      mt.render_uniforms.apply(this);
    }
    this.render_uniform_texture("u_render_texture_texture", tex);
    u_rect[0] = x;
    u_rect[1] = y;
    u_rect[2] = w;
    u_rect[3] = h;
    this.render_uniform_float_array("u_render_texture_rect", u_rect)
    this.end_render_item(0, 0, 0);

  }

  engine._render_texture = function (tex, x, y, w, h, mt) {


    mt = mt || mat;
    tex = tex || engine.dummy_texture_rgba;
    mt.uniforms.u_render_texture_texture = tex;
    u_rect[0] = x;
    u_rect[1] = y;
    u_rect[2] = w;
    u_rect[3] = h;
    this._render_item(geo, mt, 0, 0, 0);

  }
  render_texture.active_channel = function (c) {
    u_render_texture_channels.fill(0);
    u_render_texture_channels[c] = 1;

    return mat_channel;
  };


  engine.render_texture_array = function (tex, i, c, x, y, w, h, mt) {


    mt = mt || mat_array_range;
    engine.begin_render_item(geo, mt);
    engine.render_uniform_value("u_render_texture_array_index", i);
    engine.render_uniform_value("u_render_texture_array_count", c);
    engine.render_uniform_texture("u_render_texture_texture_array", tex);
    u_rect[0] = x;
    u_rect[1] = y;
    u_rect[2] = w;
    u_rect[3] = h;
    engine.render_uniform_float_array("u_render_texture_rect", u_rect);
    engine.end_render_item(0, 0, 0);
  }


  engine.render_shadow_map = function (tex, x, y, w, h, mt) {


    mt = mt || mat_shadow_map;
    engine.begin_render_item(geo, mt);
    engine.render_uniform_texture("u_shadow_map_texture", tex);
    u_rect[0] = x;
    u_rect[1] = y;
    u_rect[2] = w;
    u_rect[3] = h;
    engine.render_uniform_float_array("u_render_texture_rect", u_rect);
    engine.end_render_item(0, 0, 0);
  };


  render_texture.mat = mat;

  return render_texture;

})();


engine.create_display = function (def) {
  const disp = engine.render_targets.create(Object.assign({
    width: 1, height: 1, color: {}, depth: {}
  }, def || {}));


  disp.A = engine.render_targets.create({ width: disp.width, height: disp.height, color: {} });
  disp.B = engine.render_targets.create({ width: disp.width, height: disp.height, color: {} });

  const eff_mat = engine.materials.clone(engine.render_texture.mat, {
    shader: `



uniform float u_time;
uniform sampler2D u_color_input;
uniform sampler2D u_depth_input;
void fragment(void){
gl_FragColor=texture2D(u_color_input,v_uv);
}
`
  });


  disp.effects = [];
  let eff, temp, output, input;
  disp.apply_effect = function (eff) {
    engine.push_render_target(this.A);

    eff.material.uniforms.u_color_input = this.color;
    eff.material.uniforms.u_depth_input = this.depth;


    eff.apply(this, this.A);
    engine.pop_render_target();

    engine.render_texture(this.A.color, 0, 0, 1, 1);
  };

  disp.show_color = function () {
    engine.render_texture(this.color, 0, 0, 1, 1);
  };

  disp.show_depth = function () {
    engine.render_texture(this.depth, 0, 0, 1, 1);
  };


  disp.push = function () {
    engine.push_render_target(this);
    engine.render_clear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
  };

  disp.pop = function () {
    engine.pop_render_target();
  };

  disp.create_effect = function (shdr, def) {
    if (!!(shdr && shdr.constructor && shdr.call && shdr.apply)) {
      shdr = shdr(this);
    }
    def = def || {};
    const eff = {
      material: engine.materials.clone(eff_mat, { shader: shdr }),
      apply: function (input, output) {
        engine.render_texture(input.color, 0, 0, 1, 1, this.material);
      },
    };
    eff.uniforms = eff.material.uniforms;
    eff.material.render_uniforms = function () {
      engine.render_uniform_texture("u_color_input", this.uniforms.u_color_input);
      engine.render_uniform_texture("u_depth_input", this.uniforms.u_depth_input);
    };

    if (def) {

      eff.name = def.name || eff.name || ("effect" + this.effects.length);
      if (def.enabled !== undefined) eff.enabled = def.enabled;
      if (def.uniforms) {
        Object.assign(eff.material.uniforms, def.uniforms);
      }
    }

    return eff;
  };

  return disp;

}

engine.create_light = function (def) {
  def = def || {};
  const l = engine.tra_model();
  Object.assign(l, {
    color: engine.math.vec3(def.color || [1, 1, 1]),
    illuminated: def.illuminated || 1, attenuation: def.attenuation || 2,
  });

  if (def.eular) {
    engine.tra_model.set_eular(l, def.eular[0], def.eular[1], def.eular[2]);
  }

  return l;
}

engine.render_clear = function (mask) {
  cmds[ci++] = CMD_CLEAR;
  cmds[ci++] = mask || (GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
};


engine.render_view_port = function (x, y, w, h) {
  cmds[ci++] = CMD_VIEWPORT;
  cmds[ci++] = x;
  cmds[ci++] = y;
  cmds[ci++] = w;
  cmds[ci++] = h;
};

engine.push_camera = function (camera) {
  cmds[ci++] = CMD_PUSH_CAMERA;
  cmds[ci++] = camera.uuid;
};

engine.pop_camera = function () {
  cmds[ci++] = CMD_POP_CAMERA;
};


engine.push_render_target = function (fbo, clear_screen) {
  cmds[ci++] = CMD_PUSH_RT;
  cmds[ci++] = fbo.uuid;

  if (clear_screen) {
    engine.render_clear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
  }
};

engine._set_render_target_texture_layer = function (tex, attachment, layer) {
  engine.update_texture(tex);
  gl.framebufferTextureLayer(GL_FRAMEBUFFER, attachment, tex.gl_texture, 0, layer);
};

engine.set_render_target_texture_layer = function (tex, attachment, layer) {
  cmds[ci++] = CMD_SET_RT_TEX_LAYER;
  cmds[ci++] = tex.uuid;
  cmds[ci++] = attachment;
  cmds[ci++] = layer;
};

engine.set_render_target_texture = function (tex, attachment) {
  cmds[ci++] = CMD_SET_RT_TEX;
  cmds[ci++] = tex.uuid;
  cmds[ci++] = attachment;

};

engine.pop_render_target = function () {
  cmds[ci++] = CMD_POP_RT;
};

engine._push_camera = function (camera) {
  this.camera_stack.push(camera);
};

engine._pop_camera = function () {
  this.camera_stack.pop();
};

engine._push_render_target = function (fbo, clear,viewport) {
  this.render_targets.stack.push(fbo);
  if (clear) {
    this.webgl.gl.clear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
  }
  if (viewport) {
    gl.viewport(0, 0, fbo.width, fbo.height);
  }
};

engine._set_render_to_texture = (function () {
  engine._free_render_to_texture = function () {
    this.render_targets.stack.pop();

  };

  return function (tex) {
    if (!this.def_fbo) {
      this.def_fbo = this.render_targets.create({ width:2, height: 2 });

    }
    this.update_texture(tex);
    this.render_targets.stack.push(this.def_fbo);
  
    gl.bindTexture(tex.target, tex.gl_texture);
    gl.framebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, tex.active_side, tex.gl_texture, 0);
    //gl.bindTexture(tex.target, null);
  }

})();

engine._pop_render_target = function () {
  this.render_targets.stack.pop();
};

engine._render_item = function (geo, mat, draw_offset, draw_count, draw_instances) {
  mat = mat || engine.default_mat;
  const state = mat.state;
  const shdr = mat.shader;
  const gl_states = this.gl_states;
  const gl = this.webgl.gl;

  draw_count = draw_count || geo.draw_count;
  let draw_type = mat.draw_type;

  if (!shdr.compiled) {
    this.shaders.compile(shdr);
  }
  gl.useProgram(shdr.program);


  let mask = state.depthMask;
  gl.depthMask(mask);


  mask = state.colorMask;
  gl.colorMask(mask, mask, mask, mask);

  gl.frontFace(state.frontFace)



  if (state.depthFunc == null) {
    gl.disable(GL_DEPTH_TEST)
  }
  else {

    gl.enable(GL_DEPTH_TEST)
    gl.depthFunc(state.depthFunc);
  }

  if (state.cullFace !== null) {
    if (state.cullFace !== gl_states.cullFace) {
      gl_states.cullFace = state.cullFace;
      gl.enable(GL_CULL_FACE)
      gl.cullFace(state.cullFace)
    }
  }
  else {
    gl.disable(GL_CULL_FACE)
  }

  const blend_state = state.blend;


  if (blend_state !== undefined) {
    if (blend_state.enabled !== false) {
      gl.enable(GL_BLEND)
      if (blend_state.func) {
        gl.blendFunc(blend_state.func[0], blend_state.func[1])
      }
      else {
        gl.blendFunc(GL_ONE, GL_ONE)
      }

      if (blend_state.equation) {
        gl.blendEquation(blend_state.equation)
      }
      else {
        gl.blendEquation(GL_FUNC_ADD)
      }
    }
  }
  else {
    gl.disable(GL_BLEND)
  }
  let ti = 0;
  let uname, uni, cuni, u;

  let geo_vaos = engine._vaos.get(geo.uuid);
  if (!geo_vaos) {
    geo_vaos = new Map();
    engine._vaos.set(geo.uuid, geo_vaos);
  }

  let vao = geo_vaos.get(shdr.uuid);

  if (!vao) {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    for (let a = 0; a < shdr.all_attributes.length; a++) {
      const att = shdr.all_attributes[a];

      let ratt;
      const aid = geo.attr[att.name];
      if (aid) {
        ratt = engine._attributes.get(aid);
      }
      else {
        if (att.name === "a_barycentric") {
          if (!engine._attributes.has("a_barycentric")) engine.prepare_barycentric();
          ratt = engine._attributes.get(att.name);
        }
        else if (att.name === "a_color") {
          if (!engine._attributes.has("a_color")) engine.prepare_color();
          ratt = engine._attributes.get(att.name);
        }
      }
      if (ratt) {
        if (ratt.buffer) {
          gl.bindBuffer(GL_ARRAY_BUFFER, ratt.buffer);
        }
        att.ratt = ratt;
        gl.enableVertexAttribArray(att.location);
        gl.vertexAttribPointer(att.location, ratt.item_size, ratt.data_type, false, ratt.stride, ratt.offset);
        gl.vertexAttribDivisor(att.location, ratt.divisor);
      }
      else {
        gl.disableVertexAttribArray(att.location);
      }

    }
    geo_vaos.set(shdr.uuid, vao);

  }
  else {
    gl.bindVertexArray(vao);
  }




  let indices = geo.indices;

  for (u = 0; u < shdr.all_uniforms.length; u++) {
    uname = shdr.all_uniforms[u];
    uni = shdr.uniforms[uname];
    if (uni) {
      cuni = mat.uniforms[uname];
      if (cuni === undefined) {
        cuni = engine.uniforms.get(uname);
      }



      if (uni.type === 35678 || uni.type === 35680 || uni.type === 36289 || uni.type === 35682) {
        if (cuni === undefined) {
          //samplerCube
          if (uni.type === 35680) {
            cuni = engine.dummy_cube_texture;
          }
          else if (uni.type === 36289) {
            cuni = engine.dummy_texture_array;
          }
          else {
            cuni = engine.dummy_texture_rgba;
          }
        }

        if (cuni.update_source) engine.update_texture(cuni);
        gl.uniform1i(uni.location, ti);
        gl.activeTexture(GL_TEXTURE0 + ti);
        gl.bindTexture(cuni.target, cuni.gl_texture);
        gl.bindSampler(ti, uni.type === 35682 ? get_shadow_compare_sampler(gl) : null);


        ti++;

      }
      else {
        if (cuni !== undefined) {
          uni.value = cuni;
          switch (uni.type) {
            case 5124://uniform1i
            case 35678://uniform1i
            case 35680://uniform1i
            case 36289://uniform1i
            case 36282://uniform1i
            case 35670://uniform1i
              gl.uniform1i(uni.location, cuni);
              break;
            case 5126://uniform1f
              gl.uniform1f(uni.location, cuni);
              break;
            case 35664://uniform2fv
              gl.uniform2fv(uni.location, cuni);
              break;
            case 35665://uniform3fv
              gl.uniform3fv(uni.location, cuni);
              break;
            case 35666://uniform4fv
              gl.uniform4fv(uni.location, cuni);
              break;
            case 35675://uniformMatrix3fv
              gl.uniformMatrix3fv(uni.location, false, cuni);
              break;
            case 35676://uniformMatrix4fv
              gl.uniformMatrix4fv(uni.location, false, cuni);
              break;
          }

        }
      }


    }


  }

  if (mat.wireframe) {
    if (indices) {
      indices = indices.wireframe;
    }
    else {
      if (engine.wireframe_indices == undefined) {
        engine.prepare_wireframe_indices();
      }
      indices = engine.wireframe_indices;
    }

    draw_count *= 2;
    draw_offset *= 2;
    draw_type = GL_LINES;
  }

  if (indices) {
    gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER, indices.buffer);
  //  PR.i1 = indices.data_length + "/" + draw_count;

    if (draw_instances > 0) {
      gl.drawElementsInstanced(draw_type, draw_count, GL_UNSIGNED_INT, draw_offset, draw_instances);
    } else {
      gl.drawElements(draw_type, draw_count, GL_UNSIGNED_INT, draw_offset);
    }

  }
  else {
    if (draw_instances > 0) {
      gl.drawArraysInstanced(draw_type, draw_offset, draw_count, draw_instances);
    } else {
      gl.drawArrays(draw_type, draw_offset, draw_count);
    }


  }


};

engine.prepare_wireframe_indices = function () {
  engine.wireframe_indices = { buffer: gl.createBuffer(), buffer_type: GL_DYNAMIC_DRAW };

  let wire_count = 4096 * 64;
  let i, ii, a, b, c;
  ii = 0;
  const wdata = engine.wa.u32_array_scratch(wire_count);
  for (i = 0; i < wire_count - 1; i += 3) {
    a = i + 0;
    b = i + 1;
    c = i + 2;
    wdata[ii++] = a;
    wdata[ii++] = b;
    wdata[ii++] = b;
    wdata[ii++] = c;
    wdata[ii++] = c;
    wdata[ii++] = a;

  }

  gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER, engine.wireframe_indices.buffer);
  gl.bufferData(GL_ELEMENT_ARRAY_BUFFER, wdata, engine.wireframe_indices.buffer_type);
};

engine.prepare_barycentric = function () {
  engine._attributes.set("a_barycentric", (function () {
    const f = []
    for (i = 0; i < 1024 * 1024; i++) f.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
    return engine.geometry_set_attr({}, new Float32Array(f))
  })());
};

engine.prepare_color = function () {
  engine._attributes.set("a_color", (function () {
    const d = new Float32Array(1024 * 1024);
    d.fill(1);
    return engine.geometry_set_attr({ item_size: 4 }, d);
  })());
};


engine.render_item = function (geo, mat, draw_offset, draw_count, draw_instances) {
  mat = mat || engine.default_mat;
  cmds[ci++] = CMD_BEGIN_RENDER_ITEM;
  cmds[ci++] = geo.uuid;
  cmds[ci++] = mat.uuid;

  cmds[ci++] = CMD_END_RENDER_ITEM;
  cmds[ci++] = draw_offset || 0;
  cmds[ci++] = draw_count || 0;
  cmds[ci++] = draw_instances || 0;
  return ci;
};


engine.begin_render_item = function (geo, mat) {
  cmds[ci++] = CMD_BEGIN_RENDER_ITEM;
  cmds[ci++] = geo.uuid;
  cmds[ci++] = mat.uuid;
  return ci;
};

engine.end_render_item = function (draw_offset, draw_count, draw_instances) {
  cmds[ci++] = CMD_END_RENDER_ITEM;
  cmds[ci++] = draw_offset;
  cmds[ci++] = draw_count;
  cmds[ci++] = draw_instances;
  return ci;
};


engine._render_uniforms = new Array(1024);
engine._rui = 0;


//punch uniform  value into command stream
engine.render_uniform_value = function (name, value) {
  cmds[ci++] = CMD_RENDER_UNIFORM_VALUE;
  cmds[ci++] = engine._rui;
  cmds_float[ci++] = value;
  engine._render_uniforms[engine._rui++] = name;
  return ci;
};

engine.render_uniform_texture = function (name, tex) {
  cmds[ci++] = CMD_RENDER_UNIFORM_TEXTURE;
  cmds[ci++] = engine._rui;
  cmds[ci++] = tex.uuid;
  engine._render_uniforms[engine._rui++] = name;
  return ci;
};

engine.render_uniform_float_array = function (name, value) {
  cmds[ci++] = CMD_RENDER_UNIFORM_FLOAT_ARRAY;
  cmds[ci++] = engine._rui;
  cmds[ci++] = value.length;
  for (let i = 0; i < value.length; i++) {
    cmds_float[ci++] = value[i];
  }
  engine._render_uniforms[engine._rui++] = name;
  return ci;
};

engine.render_uniform_int_array = function (name, value) {
  cmds[ci++] = CMD_RENDER_UNIFORM_INT_ARRAY;
  cmds[ci++] = engine._rui;
  cmds[ci++] = value.length;
  for (let i = 0; i < value.length; i++) {
    cmds_int32[ci++] = value[i];
  }
  engine._render_uniforms[engine._rui++] = name;
  return ci;
};


engine._read_pixel_pbo_from_buffer = function (fbo, vx, vy, vw, vh, vd, format, type, data) {


  gl.bindFramebuffer(GL_READ_FRAMEBUFFER, fbo.buffer);

  gl.readBuffer(vd);
  gl.bindFramebuffer(GL_READ_FRAMEBUFFER, fbo.buffer);
  fbo.pbos = fbo.pbos || {};
  let pbo = fbo.pbos[vd];
  if (!pbo) {
    pbo = gl.createBuffer();
    fbo.pbos[vd] = pbo;
    gl.bindBuffer(GL_PIXEL_PACK_BUFFER, pbo);
    gl.bufferData(GL_PIXEL_PACK_BUFFER, data.byteLength, GL_STREAM_READ);
  }
  gl.bindBuffer(GL_PIXEL_PACK_BUFFER, pbo);
  gl.readPixels(vx, vy, vw, vh, format, type, 0);
  gl.getBufferSubData(GL_PIXEL_PACK_BUFFER, 0, data);


  gl.bindBuffer(GL_PIXEL_PACK_BUFFER, null);
  gl.bindFramebuffer(GL_READ_FRAMEBUFFER, null);


};


engine._read_pixel = function (attachment, vx, vy, vw, vh, format, type, data) {
  gl.readBuffer(attachment);
  gl.readPixels(vx, vy, vw, vh, format, type, data);



};


engine.flush_rendering = function () {

  if (ci <= 0) return;
  let i = 0, d = 0;
  let uname, uni, cuni, u;
  let mask, opcode;
  let geo, mat, ti, draw_offset, draw_count, draw_instances, draw_type, tex, fbo, attach;

  let state, shdr, blend_state;
  const gl = this.webgl.gl;
  let current_shader = null;
  let current_mat = null;
  let current_vao = null;
  const gl_states = engine.gl_states;
  const _materials = engine._materials;
  const _geometries = engine._geometries;
  const _shaders = engine._shaders;

  let current_rt;
  let x, y, w, h;
  while (i < ci) {

    current_rt = fbo; // engine.render_targets.stack.current;

    gl_states.depthFunc = null;
    gl_states.cullFace = GL_NONE;
    opcode = cmds[i++];

    switch (opcode) {
      case CMD_CLEAR:

        // (a clear is done with the masks open: the last material drawn may have left the depth or the colour write off, as a transparent one does, and a clear under them leaves the old picture)
        gl.depthMask(true);
        gl.colorMask(true, true, true, true);
        gl.clear(cmds[i++]);
        break;

      case CMD_VIEWPORT:
        x = cmds[i++]; y = cmds[i++]; w = cmds[i++]; h = cmds[i++];
        gl.viewport(x, (gl.canvas.height - y) - h, w, h);
        break;

      case CMD_PUSH_CAMERA:
        engine.camera_stack.push(engine._cameras.get(cmds[i++]));
        break;


      case CMD_POP_CAMERA:
        engine.camera_stack.pop();
        break;

      case CMD_PUSH_RT:
        fbo = engine._render_targets.get(cmds[i++]);

        engine.render_targets.stack.push(fbo);
        break;


      case CMD_POP_RT:
        fbo = engine.render_targets.stack.pop();

        break;

      case CMD_SET_RT_TEX:
        tex = engine._textures.get(cmds[i++]);
        attach = cmds[i++];
        if (tex.update_source) engine.update_texture(tex);
        gl.framebufferTexture2D(GL_FRAMEBUFFER, attach, GL_TEXTURE_2D, tex.gl_texture, 0);

        break;

      case CMD_SET_RT_TEX_LAYER:
        tex = engine._textures.get(cmds[i++]);
        attach = cmds[i++];
        d = cmds[i++];

        if (tex.update_source) engine.update_texture(tex);
        gl.framebufferTextureLayer(GL_FRAMEBUFFER, attach, tex.gl_texture, 0, d);
        break;


      case CMD_BEGIN_RENDER_ITEM:

        geo = _geometries.get(cmds[i++]);
        mat = _materials.get(cmds[i++]);

        if (fbo) {
          if (fbo.render_material) {
            mat = fbo.render_material(mat);
          }
        }

        ti = 0;

        draw_type = mat.draw_type;

        if (mat && mat.shader) {

          state = mat.state;
          shdr = mat.shader;
          if (current_shader !== shdr.uuid) {
            if (!shdr.compiled) {
              engine.shaders.compile(shdr);
            }
            gl.useProgram(shdr.program);
            current_shader = shdr.uuid;
          }

          if (current_mat !== mat.uuid) {
            current_mat = mat.uuid;


            mask = state.depthMask;

            if (mask !== gl_states.depthMask) {
              gl_states.depthMask = mask;
              gl.depthMask(mask);
            }


            mask = state.colorMask;
            if (mask !== gl_states.colorMask) {
              gl_states.colorMask = mask;
              gl.colorMask(mask, mask, mask, mask);
            }



            if (state.frontFace !== gl_states.frontFace) {
              gl_states.frontFace = state.frontFace;
              gl.frontFace(state.frontFace)
            }


            if (state.depthFunc !== gl_states.depthFunc) {
              gl_states.depthFunc = state.depthFunc;
              gl.enable(GL_DEPTH_TEST)
              gl.depthFunc(state.depthFunc);
            }
            else if (state.depthFunc == null) {
              gl.disable(GL_DEPTH_TEST)
            }

            if (state.cullFace !== null) {
              if (state.cullFace !== gl_states.cullFace) {
                gl_states.cullFace = state.cullFace;
                gl.enable(GL_CULL_FACE)
                gl.cullFace(state.cullFace)
              }
            }
            else {
              gl.disable(GL_CULL_FACE)
            }

            blend_state = state.blend;


            if (blend_state !== undefined) {
              if (blend_state.enabled !== false) {
                gl.enable(GL_BLEND)
                if (blend_state.func) {
                  gl.blendFunc(blend_state.func[0], blend_state.func[1])
                }
                else {
                  gl.blendFunc(GL_ONE, GL_ONE)
                }

                if (blend_state.equation) {
                  gl.blendEquation(blend_state.equation)
                }
                else {
                  gl.blendEquation(GL_FUNC_ADD)
                }
              }
            }
            else {
              gl.disable(GL_BLEND)
            }



          }

          let geo_vaos = engine._vaos.get(geo.uuid);
          if (!geo_vaos) {
            geo_vaos = new Map();
            engine._vaos.set(geo.uuid, geo_vaos);
          }

          let vao = geo_vaos.get(current_shader);

          if (!vao) {
            vao = gl.createVertexArray();
            gl.bindVertexArray(vao);

            for (let a = 0; a < shdr.all_attributes.length; a++) {
              const att = shdr.all_attributes[a];

              let ratt;
              const aid = geo.attr[att.name];
              if (aid) {
                ratt = engine._attributes.get(aid);
              }
              else {
                if (att.name === "a_barycentric") {
                  if (!engine._attributes.has("a_barycentric")) engine.prepare_barycentric();
                  ratt = engine._attributes.get(att.name);
                }
                else if (att.name === "a_color") {
                  if (!engine._attributes.has("a_color")) engine.prepare_color();
                  ratt = engine._attributes.get(att.name);
                }
              }
              if (ratt) {
                if (ratt.buffer) {
                  gl.bindBuffer(GL_ARRAY_BUFFER, ratt.buffer);
                }
                att.ratt = ratt;
                gl.enableVertexAttribArray(att.location);
                gl.vertexAttribPointer(att.location, ratt.item_size, ratt.data_type, false, ratt.stride, ratt.offset);
                gl.vertexAttribDivisor(att.location, ratt.divisor);
              }
              else {
                gl.disableVertexAttribArray(att.location);
              }

            }
            geo_vaos.set(current_shader, vao);
            current_vao = vao;
          }
          else if (current_vao !== vao) {
            gl.bindVertexArray(vao);
            current_vao = vao;
          }



        }

        break;

      case CMD_RENDER_UNIFORM_VALUE:
        uname = engine._render_uniforms[cmds[i++]];
        if (mat && mat.uniforms[uname] !== undefined) {
          mat.uniforms[uname] = cmds_float[i++];
        }
        else {
          engine.uniforms.set(uname, cmds_float[i++]);
        }

        break;

      case CMD_RENDER_UNIFORM_TEXTURE:
        uname = engine._render_uniforms[cmds[i++]];
        mat.uniforms[uname] = engine._textures.get(cmds[i++]);
        break;

      case CMD_RENDER_UNIFORM_FLOAT_ARRAY:
        uname = engine._render_uniforms[cmds[i++]];
        d = cmds[i++];
        cuni = mat.uniforms[uname];
        if (cuni == undefined) {
          cuni = new Float32Array(d);
          engine.uniforms.set(uname, cuni);
        }
        for (u = 0; u < d; u++) {
          cuni[u] = cmds_float[i++];
        }
        break;

      case CMD_RENDER_UNIFORM_INT_ARRAY:
        uname = engine._render_uniforms[cmds[i++]];
        d = cmds[i++];
        cuni = mat.uniforms[uname];
        if (cuni == undefined) {
          cuni = new Int32Array(d);
          engine.uniforms.set(uname, cuni);
        }
        for (u = 0; u < d; u++) {
          cuni[u] = cmds_int32[i++];
        }
        break;


      case CMD_END_RENDER_ITEM:

        draw_offset = cmds[i++];
        draw_count = cmds[i++] || geo.draw_count;
        draw_instances = cmds[i++];



        let indices = geo.indices;

        if (mat && shdr) {

          for (u = 0; u < shdr.all_uniforms.length; u++) {
            uname = shdr.all_uniforms[u];
            uni = shdr.uniforms[uname];
            if (uni) {
              cuni = mat.uniforms[uname];
              if (cuni === undefined) {
                cuni = engine.uniforms.get(uname);
              }



              if (uni.type === 35678 || uni.type === 35680 || uni.type === 36289 || uni.type === 35682) {
                if (cuni === undefined) {
                  //samplerCube
                  if (uni.type === 35680) {
                    cuni = engine.dummy_cube_texture;
                  }
                  else if (uni.type === 36289) {
                    cuni = engine.dummy_texture_array;
                  }
                  else {
                    cuni = engine.dummy_texture_rgba;
                  }
                }

                if (cuni.update_source) engine.update_texture(cuni);
                gl.uniform1i(uni.location, ti);
                gl.activeTexture(GL_TEXTURE0 + ti);
                gl.bindTexture(cuni.target, cuni.gl_texture);
                gl.bindSampler(ti, uni.type === 35682 ? get_shadow_compare_sampler(gl) : null);


                ti++;

              }
              else {
                if (cuni !== undefined) {
                  uni.value = cuni;
                  switch (uni.type) {
                    case 5124://uniform1i
                    case 35678://uniform1i
                    case 35680://uniform1i
                    case 36289://uniform1i
                    case 36282://uniform1i
                    case 35670://uniform1i
                      gl.uniform1i(uni.location, cuni);
                      break;
                    case 5126://uniform1f
                      gl.uniform1f(uni.location, cuni);
                      break;
                    case 35664://uniform2fv
                      gl.uniform2fv(uni.location, cuni);
                      break;
                    case 35665://uniform3fv
                      gl.uniform3fv(uni.location, cuni);
                      break;
                    case 35666://uniform4fv
                      gl.uniform4fv(uni.location, cuni);
                      break;
                    case 35675://uniformMatrix3fv
                      gl.uniformMatrix3fv(uni.location, false, cuni);
                      break;
                    case 35676://uniformMatrix4fv
                      gl.uniformMatrix4fv(uni.location, false, cuni);
                      break;
                  }

                }
              }

              //  uni.value = cuni;
            }


          }

          if (mat.wireframe) {
            if (indices) {
              indices = indices.wireframe;
            }
            else {
              if (engine.wireframe_indices == undefined) {
                engine.prepare_wireframe_indices();

              }
              indices = engine.wireframe_indices;
            }

            draw_count *= 2;
            draw_offset *= 2;
            draw_type = GL_LINES;
          }
        }

        if (indices) {
          PR.draw_type = draw_type;
          PR.draw_offset = draw_offset;
          PR.draw_count = draw_count;
          gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER, indices.buffer);
          if (draw_instances > 0) {
            gl.drawElementsInstanced(draw_type, draw_count, GL_UNSIGNED_INT, draw_offset * 4, draw_instances);
          } else {


            gl.drawElements(draw_type, draw_count, GL_UNSIGNED_INT, draw_offset);
          }

        }
        else {
          if (draw_instances > 0) {
            gl.drawArraysInstanced(draw_type, draw_offset, draw_count, draw_instances);
          } else {
            gl.drawArrays(draw_type, draw_offset, draw_count);
          }


        }

        break;

    }


  }

  PR.ci = ci;
  ci = 0;
  engine._rui = 0;

}

engine.dummy_texture_rgba = engine.textures.create({
  width: 4, height: 1,

  source: new Uint8Array([
    255, 0, 0, 255,
    0, 255, 0, 255,
    0, 0, 255, 255,
    0, 0, 0, 255
  ])
});


engine.particle_system = (function () {
  const index_width = 1024;
  const index_depth = 8;
  const index_size = index_width * index_depth;
  const max_particles = 4096;



  const emitter = define(function (proto) {
    let emi = 0;
    const slots = new Float32Array(512);

    proto.emit = function (si, x, y, z, dx, dy, dz, rate) {
      rate = rate || this.rate;


      if (engine.time - slots[si] > rate) {
        slots[si] = engine.time;
        this.ps.emit(x, y, z, dx, dy, dz, this.index, 1, 0);
      }
    };

    function _arr(d, c) {
      if (d) {
        if (ArrayBuffer.isView(d)) return d;
        return new Float32Array(d);
      }
      return new Float32Array(c);
    }

    return function emitter(def, pars) {
      this.index = pars.emi++;

      this.rate = def.rate || (1 / 10);
      this.area = _arr(def.area, [0, 0, 0]);
      this.atlas = _arr(def.atlas, [0, 0, 1, 1]);
      this.sprites = _arr(def.sprites, [0, 0, 0]);
      this.spread = _arr(def.spread, [0, 0, 0]);
      this.fade = _arr(def.fade, [0.4, 0.8, 3]);
      this.scale = _arr(def.scale, [1, 1]);
      this.rotation = _arr(def.rotation, [0, 0]);
      this.direction = _arr(def.direction, [0, 0, 0, 1]);
      this.texture = def.texture || engine.dummy_texture_rgba;
      this.wind = _arr(def.wind, [0, 0, 0]);
      this.color_start = _arr(def.color_start, [1, 1, 1]);
      this.color_end = _arr(def.color_end, [0, 0, 0]);

      this.gravity = _arr(def.gravity, [0, 0, 0]);
      this.ps = pars;

      this.ps.set_emitter(this.index, this);


    }

  });


  const all_pars = [];
  const data = new Float32Array(max_particles * 4);
  const free_particles = [];
  let fpi = 0, fcreated = 0;

  let idd = 0;
  function create(idc) {
    idc = idc || 4;
    const pars = engine.geometries.create({
      attributes: {
        "a_particle": {
          item_size: 4, divisor: 1, buffer_type: GL_DYNAMIC_DRAW
        },
        "a_position": {
          item_size: 3, data: (function () {
            const verts = [];
            for (let i = 0; i < idc; i++) {
              verts.push(
                -0.5, -0.5, i / idc,
                0.5, -0.5, i / idc,
                0.5, 0.5, i / idc,
                -0.5, -0.5, i / idc,
                0.5, 0.5, i / idc,
                -0.5, 0.5, i / idc
              );
            }
            return new Float32Array(verts);
          })()
        }
      }
    });

    pars.emi = 0;
    pars.a_particle = engine._attributes.get(pars.attr.a_particle);


    pars.material = engine.materials.create({
      compiler1: "pbr",
      props: {
        enable_vertex_color: true,
      },
      uniforms: {},
      shader: `
${(shaders.hash33())}
struct emitter {
	vec3 area;
	vec2 scale;
	vec2 rotation;
	vec3 fade;
	vec4 direction;
	vec3 spread;
	vec3 wind;
	vec3 gravity;
	vec4 atlas;
	vec3 sprites;
	vec3 color_start;
	vec3 color_end;
};
uniform emitter emitters[16];
uniform mat4 u_inverse_view_matrix;
attribute vec4 a_particle;
const float index_width=float(${(index_width)});
const float index_depth=float(${(index_depth)});
const float index_size=float(${(index_size)});
vec3 rotate_z(vec3 p, float theta) {
  float s = sin(theta);
  float c = cos(theta);
  return vec3(p.x * c - p.y * s, p.y * c + p.x * s, p.z);
}
void vertex(void){
           float index=a_particle.w;
float life = floor(index / index_size)/index_width;
float remaining = floor(mod(index ,index_size));
float id = floor(remaining / index_depth);
float type = floor(mod(remaining , index_depth));


vec3 pos=a_particle.xyz;

id+=a_position.z*1024.0;


vec3 rgb=hash33(vec3(id));


vec3 rnd=rgb*2.0-1.0;

vec3 right 	= vec3( u_inverse_view_matrix[0][0], u_inverse_view_matrix[1][0], u_inverse_view_matrix[2][0] ),
			 up 	= vec3( u_inverse_view_matrix[0][1], u_inverse_view_matrix[1][1], u_inverse_view_matrix[2][1] );

emitter em=emitters[int(type)];
vec3 emit_area=em.area*rnd;
vec3 emit_spread=em.spread*rnd;
vec3 emit_direction=em.direction.xyz;

emit_direction+=emit_spread;
emit_direction=normalize(emit_direction);
emit_direction*=em.direction.w;

vec3 force=(em.wind+em.gravity);

emit_direction+=force*life;

emit_area+=emit_direction*life;

float rotation=mix(em.rotation.x,em.rotation.y,life)*rnd.r;
float scale=mix(em.scale.x,em.scale.y,life);



v_position_world.xy=a_position.xy;
v_position_world.xyz= rotate_z(v_position_world.xyz,-rotation);
v_position_world.xy*=scale;

pos+=force*life;
v_position_world.xyz+=emit_area;
v_position_world.xyz =  (right * v_position_world.x)  + (up * v_position_world.y) ;
v_position_world.xyz += pos.xyz;
gl_Position = u_view_projection_matrix * vec4(v_position_world,1);
v_color.rgb=mix(em.color_start,em.color_end,life);

v_uv=a_position.xy+0.5;


//v_uv=sprite_sheet_uvs(v_uv,em.sprites.xy,life);
//v_uv.xy*=em.atlas.zw;

//v_uv.xy+=em.atlas.xy;



v_color.a= saturate((pow(life,em.fade.x)*pow(1.0-life,em.fade.y))*(em.fade.z));
//v_normal_world=normalize(vec3(0,1,0));
						}


float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
#define HAS_DISCARD
void has_discard(){
if(gl_FragColor.a+hash12(gl_FragCoord.xy)<0.5) discard;
}

void fragment(){
gl_FragColor=v_color;
gl_FragColor.a*=(gl_FragColor.a+hash12(gl_FragCoord.xy));
if(gl_FragColor.a<0.5) discard;
}

`
    });

    pars.set_emitter = function (i, em) {

      this.material.uniforms['emitters[' + i + '].area'] = em.area;
      this.material.uniforms['emitters[' + i + '].atlas'] = em.atlas;
      this.material.uniforms['emitters[' + i + '].sprites'] = em.sprites;
      this.material.uniforms['emitters[' + i + '].spread'] = em.spread;
      this.material.uniforms['emitters[' + i + '].direction'] = em.direction;
      this.material.uniforms['emitters[' + i + '].fade'] = em.fade;
      this.material.uniforms['emitters[' + i + '].scale'] = em.scale;
      this.material.uniforms['emitters[' + i + '].rotation'] = em.rotation;
      this.material.uniforms['emitters[' + i + '].wind'] = em.wind;
      this.material.uniforms['emitters[' + i + '].gravity'] = em.gravity;
      this.material.uniforms['emitters[' + i + '].color_start'] = em.color_start;
      this.material.uniforms['emitters[' + i + '].color_end'] = em.color_end;

    };



    const active_particles = [];
    let pti = 0, par;


    pars.free_particles = free_particles;
    pars.active_particles = active_particles;

    pars.emit = function (x, y, z, vx, vy, vz, type, life, time) {

      if (fpi > 0) {
        par = free_particles[--fpi];
      }
      else {
        par = {
          pos: [0, 0, 0], type: 0, id: 0, time: 0, life: 0,
          vel: [0, 0, 0]
        };
        fcreated++;
        //console.log(par);
      }

      active_particles[pti++] = par;
      par.pos[0] = x;
      par.pos[1] = y;
      par.pos[2] = z;

      par.vel[0] = vx;
      par.vel[1] = vy;
      par.vel[2] = vz;

      par.id = idd++;
      par.life = life;
      par.type = type;
      par.time = engine.time + time;
      idd = (idd % index_width);

      par.index = index_size + par.id * index_depth + par.type;
    };



    let par_life, pi, tp, tm, td, di, plife;




    pars.tick = function () {
      pi = 0;
      tp = pti;
      pti = 0;
      di = 0;
      tm = engine.time;
      td = engine.time_delta;
      ld = 1;

      while (pi < tp) {
        par = active_particles[pi++];
        par_life = tm - par.time;

        if (par_life < par.life) {
          plife = par_life / par.life;

          if (par_life >= 0) {


            if (di < max_particles) {
              data[di++] = par.pos[0];
              data[di++] = par.pos[1];
              data[di++] = par.pos[2];
              data[di++] = Math.floor(plife * index_width) * index_size + par.id * index_depth + par.type;
            }


            par_life = (1 - plife) * td;
            par.pos[0] += par.vel[0] * par_life;
            par.pos[1] += par.vel[1] * par_life;
            par.pos[2] += par.vel[2] * par_life;

          }

          active_particles[pti++] = par;
        }
        else {
          free_particles[fpi++] = par;
        }


      }

      this.instances = 0;


      PR["par_count " + this.index] = pti + "/" + di;



      if (di > 0) {
        this.instances = di / 4;;
        engine.geometry_set_attr(this.a_particle, data, di);
      }
    };


    pars.emitters = {};
    pars._emitters = [];
    pars.draw_offset = 0;


    pars.create_emitter = function (name, def) {
      const em = new emitter(def, this);
      this._emitters[em.index] = em;
      this.emitters[name] = em;
      return em;
    };

    pars.render = function () {
      if (this.instances > 0) {
        engine.render_item(this, this.material, this.draw_offset, this.draw_count, this.instances);
      }

    };

    pars.index = all_pars.length;
    all_pars.push(pars);




    return pars;
  }

  let pi = 0;

  function tick() {
    for (pi = 0; pi < all_pars.length; pi++) {
      all_pars[pi].tick();
    }
    PR.pids = idd;
    PR["free "] = fcreated + "/" + fpi;

  }
  console.log("all_pars", all_pars);
  function render() {
    for (pi = 0; pi < all_pars.length; pi++) {
      all_pars[pi].render();
    }

  }

  return {
    create: create,
    tick: tick,
    render: render
  }



})();

import("deffered_rendering_v2.js")