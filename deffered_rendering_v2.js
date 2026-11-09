// =====================================================================================================================
// deffered_rendering v2
//
// Same public surface as v1 (engine.deffered_rendering(def) -> screen, screen.output, screen.cascades, screen.on_*,
// screen.antialias, screen.taa_feedback, screen.taa_sharpen). What changed:
//
//   Fixes
//   - smoothstep() with edge0 >= edge1 (undefined in GLSL) replaced: the eclipse term and the dead edge_fade.
//   - The moon disc was computed and thrown away. It is drawn when def.ENABLE_MOON_DISC is set.
//   - Depth bias is expressed in shadow texels (and slope scaled), converted to the cascade's depth range. In v1 the
//     constant 0.0005 meant 0.2 m on cascade 0 but 6 m on cascade 2.
//   - Last cascade fades out instead of cutting off at its split.
//   - TAA history is invalidated while the pass is disabled; the history is resampled with Catmull-Rom (less blur).
//   - def.dlight0 / def.camera are validated instead of throwing on the first frame.
//   - console.log spam is behind def.DEBUG.
//   - The G-buffer float targets are sampled with NEAREST: they are only read at texel centres (and by water's
//     screen-space reflection, where interpolating between a near and a far position is a wrong answer anyway).
//     def.GBUFFER_FILTER overrides it (GL_LINEAR = v1).
//
//   Performance
//   - The moon's atmosphere march + PBR evaluation are skipped while the sun, as the air lets it through, outshines
//     it by MOON_SKIP_RATIO (so not at dusk, when the moon's glow is part of the sky).
//   - screen.shadow_interval = [1,1,1]: re-render a cascade only every N frames (staggered). Default = every frame.
//   - The shadow pass fetches the albedo only for materials that alpha-test (#ifdef U_ALPHA_TEST, the same switch
//     end_main() uses). v1 fetched it for every textured material, opaque ones included.
//
//   Opt-in
//   - def.ENABLE_EMISSIVE_BUFFER: emissive gets its own HDR G-buffer target and is added after the lighting instead
//     of being added to the (clamped, lit) albedo. OFF by default: it costs 8 bytes a pixel, and the barycentric
//     wire overlay (u_baryframe_*) is written into mat.emissive_color, so every wire-flagged material would start
//     to glow (about 5% unlit). Turn it on when real emissive materials exist and tune EMISSIVE_SCALE.
//   - def.ENABLE_SKY_REFLECTION (with ENABLE_ATMOSPHERE): a glossy pixel (roughness under 0.7) mirrors the sky: GetAtmosphere toward
//     the reflected ray x Fresnel x (1 - roughness)^2. One more atmosphere evaluation for the glossy pixels only; off, the shader text
//     is what it always was.
//   - def.ENABLE_GLOSS: the GGX of the shared CalculatePBR caps a highlight's peak at roughness^4 * 10^4 (max(PI * denom^2, 0.0001)):
//     a surface under 0.27 has a dimmer glint the glossier it is. On, the lighting pass guards that division by 1e-30: an eye, a lens,
//     wet stone have their whole glint. Off, the chunk is the shared one.
//
//   Transparent surfaces (always there, costs nothing until something is added)
//   - screen.transparent: glass and other see-through things are drawn into ONE extra target (premultiplied lit colour + coverage) that shares the G-buffer's depth, so the nearest one wins by the
//     hardware depth test (no sorting), and that target is blended over the lit image before the antialiasing (see TRANSPARENT SURFACES below: transparent.mode, transparent.material(base), transparent.add(item))
//
//   New knobs
//   - def.ENABLE_MOON_DISC, def.MOON_DIRECTION, def.CASCADES, def.GBUFFER_FILTER, def.DEBUG
//   - screen.shadow_interval, screen.invalidate_shadows(), screen.taa_samples
//   - live tweaks (FL sliders): SHADOW_MIN, SHADOW_BIAS_TEXELS, SHADOW_NORMAL_OFFSET, SHADOW_SOFTNESS (only with
//     shadows), AMBIENT_SCALE, MOON_SKIP_RATIO, EMISSIVE_SCALE (only with the emissive buffer). They share the
//     engine's 23 FL slots (u_float_params[24]): v1 used 4, v2 uses up to 11.
//   - screen.on_shadowmap(time, delta, cascade, index) now also receives the cascade being drawn
// =====================================================================================================================

engine.deffered_rendering = function deffered_rendering(def) {
  def = def || {};
  const DEBUG = !!def.DEBUG;

  const cam = def.camera;
  const dlight0 = def.dlight0;

  let ENABLE_SHADOWS = !!def.ENABLE_SHADOWS;
  if (ENABLE_SHADOWS && !dlight0) {
    console.warn("deffered_rendering: ENABLE_SHADOWS needs def.dlight0 (the sun): the pass is made without shadows");
    ENABLE_SHADOWS = false;
  }
  const ENABLE_ATMOSPHERE = !!def.ENABLE_ATMOSPHERE;
  const ENABLE_LOGDEPTH = def.ENABLE_LOGDEPTH == undefined ? true : def.ENABLE_LOGDEPTH;
  // emissive gets its own (HDR) G-buffer target and is added after lighting. Off (the default): emissive is added to the albedo as in v1.
  const ENABLE_EMISSIVE_BUFFER = !!def.ENABLE_EMISSIVE_BUFFER;
  const ENABLE_MOON_DISC = !!def.ENABLE_MOON_DISC;
  // SKY REFLECTION (def.ENABLE_SKY_REFLECTION, with the atmosphere): a glossy pixel (G-buffer roughness under 0.7: an eye, a wet nose, a lens, a visor) mirrors the sky the atmosphere makes, toward the reflected ray, by the
  // Fresnel term (Schlick, f0 from the albedo and the metal) and (1 - roughness)^2. It costs one more GetAtmosphere (closed form, no march: about 100 operations) for the glossy pixels only. Off (the default) not a line
  // of it is in the shader: the pass is what it always was. The sky of a pass without the atmosphere is black: there is nothing to mirror.
  const ENABLE_SKY_REFLECTION = !!def.ENABLE_SKY_REFLECTION && ENABLE_ATMOSPHERE;
  if (def.ENABLE_SKY_REFLECTION && !ENABLE_ATMOSPHERE) console.warn("deffered_rendering: ENABLE_SKY_REFLECTION needs ENABLE_ATMOSPHERE (the sky it mirrors): the pass is made without it");
  // GLOSS (def.ENABLE_GLOSS): the shared CalculatePBR (shaders.js) divides its GGX by max(PI * denom * denom, 0.0001), which caps the peak of the highlight at roughness^4 * 10^4: under a roughness of 0.27 a surface's
  // glint gets DIMMER the glossier it is (0.1: a peak of 1 where it is 3183). On, the lighting pass's copy of it guards the division by 1e-30 instead (the denominator is at least roughness^4: never 0): a glossy eye
  // has its whole glint. Off (the default) the chunk is the shared one, as it always was.
  const ENABLE_GLOSS = !!def.ENABLE_GLOSS;
  const pbr_chunk = function () {
    const s = engine.shaders_cat.pbr();
    if (!ENABLE_GLOSS) return s;
    const g = s.replace("max(PI * denom * denom, 0.0001)", "max(PI * denom * denom, 1e-30)");
    if (g === s) console.warn("deffered_rendering: ENABLE_GLOSS did not find the GGX of shaders.js it changes: the lighting pass is made without it");
    return g;
  };
  // WATER (water/water.js): the sea plane is part of the lighting pass, so it shares the atmosphere, the shadows and the tone mapping. Off (the default) the pass is what it always was: not a line of
  // the water is in the shader. On, it needs the module (it provides the shader's chunk, engine.shaders_cat.water) and is then switched at run time by the module's own uniform.
  const ENABLE_WATER = !!def.ENABLE_WATER && typeof engine.shaders_cat.water === "function";
  if (def.ENABLE_WATER && !ENABLE_WATER) console.warn("deffered_rendering: ENABLE_WATER needs water/water.js (include it): the lighting pass is made without water");

  const glsl_vec3 = function (v) { return "vec3(" + Array.from(v).map(function (x) { return Number(x).toFixed(6); }).join(", ") + ")"; };
  const MOON_DIRECTION = def.MOON_DIRECTION || [0.5, 0.25, 1.0];

  // the G-buffer is read at texel centres (and by the water's reflection march, where a blend of two positions is wrong): NEAREST
  const GBUFFER_FILTER = def.GBUFFER_FILTER || (typeof GL_NEAREST !== "undefined" ? GL_NEAREST : 0x2600);

  const draw_buffers = {
    frag_position: {            // xyz: world position, w: roughness
      format_type: GL_FLOAT,
      internal_format: GL_RGBA32F,
      filter: GBUFFER_FILTER,
    },
    frag_normal: {              // xyz: world normal (zero = nothing drawn = sky), w: metallic
      format_type: GL_FLOAT,
      internal_format: GL_RGBA32F,
      filter: GBUFFER_FILTER,
    }
  };
  if (ENABLE_EMISSIVE_BUFFER) {
    draw_buffers.frag_emissive = {   // rgb: emissive radiance (HDR)
      format_type: GL_HALF_FLOAT,
      internal_format: GL_RGBA16F,
      filter: GBUFFER_FILTER,
    };
  }

  const screen = engine.render_targets.create({
    width: 1, height: 1,
    color: {}, depth: {},
    draw_buffers: draw_buffers,
  });

  // The lookup in the shader is written for exactly three cascades, nearest first. d = half extent in metres, res = texels.
  let cascade_defs = [{ d: 30, res: 4096 }, { d: 100, res: 2048 }, { d: 2048 * 2, res: 4096 }];
  if (def.CASCADES) {
    const ok = Array.isArray(def.CASCADES) && def.CASCADES.length === 3 &&
      def.CASCADES[0].d < def.CASCADES[1].d && def.CASCADES[1].d < def.CASCADES[2].d;
    if (ok) cascade_defs = def.CASCADES;
    else console.warn("deffered_rendering: def.CASCADES needs exactly 3 entries {d, res} with increasing d: the defaults are used");
  }

  const shadow_shader = function () {
    return `
void vertex(){
    super_vertex();
    // "Pancaking": a caster in front of the cascade's near plane (the tip of a tall tree is much closer to the sun than the
    // ground it shades, by height / sin(elevation), which is hundreds of metres for a low sun) would be clipped away and
    // cast no shadow. Clamping its depth onto the near plane keeps it in the map; it is still nearer to the sun than every
    // receiver behind it, which is all the depth compare needs.
    gl_Position.z = max(gl_Position.z, -gl_Position.w);
}
void fragment(){
#ifdef HAS_DISCARD
    has_discard();
#endif
    // only the alpha matters here, but end_main() still alpha-tests gl_FragColor.a (u_alpha_test): left unwritten
    // it discards every fragment of an alpha-cut material (foliage cards) and they would cast no shadow at all.
    // end_main() reads the alpha only under U_ALPHA_TEST, so only those materials pay for the albedo fetch
#if defined(U_ALPHA_TEST) && defined(U_BASE_COLOR_MAP)
    gl_FragColor = vec4(0.0, 0.0, 0.0, texture2D(u_base_color_map, mat.uv).a);
#else
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
#endif
}`;
  };

  const shadow_render_material = function (mat) {

    if (!mat.shadow_mat) {

      mat.shadow_mat = engine.materials.clone(mat, {
        shader: mat.draw_type == GL_POINTS ? `
void fragment(){
discard;
}
`: shadow_shader()
      });

      mat.shadow_mat.uniforms = mat.uniforms;
      if (DEBUG) console.log("shadow_mat", mat);
    }
    return mat.shadow_mat;
  };

  screen.cascades = cascade_defs.map(function (c) {
    // (the map's GPU texture is only allocated when it is first bound or sampled: with shadows off it never is)
    const rt = engine.render_targets.create({
      width: c.res, height: c.res,
      depth: { filter: GL_LINEAR }
    });
    const near = -c.d, far = c.d * 2;
    rt.render_material = shadow_render_material;
    rt.d = c.d;
    rt.texel_size = (c.d * 2) / c.res;      // world size of one shadow texel
    rt.depth_range = far - near;            // world length that the [0,1] depth of this cascade spans
    rt.shadow_dirty = true;                 // must be (re)drawn this frame
    rt.shadow_active = true;                // decided per frame in on_frame_begin
    rt.camera = engine.create_camera({
      type: 2,
      near: near, far: far,
      left: -c.d, right: c.d,
      top: c.d, bottom: -c.d
    });

    return rt;
  });

  // re-render a cascade only every N frames (1 = every frame). The far cascade changes slowly; staggered so the cost is spread.
  screen.shadow_interval = [1, 1, 1];
  // force every cascade to be drawn on the next frame (call after moving the sun or teleporting)
  screen.invalidate_shadows = function () {
    for (const cascade of screen.cascades) cascade.shadow_dirty = true;
  };

  screen.render_material = function (mat) {
    if (!mat.deffered_mat) {
      mat.deffered_mat = engine.materials.clone(mat, {
        shader: `
${(ENABLE_LOGDEPTH ? '#define ENABLE_LOGDEPTH' : '')}
uniform vec2 u_taa_jitter;   // sub-pixel projection offset in NDC (zero unless TAA is on); only G-buffer passes get it
void vertex(){
super_vertex();
gl_Position.xy += u_taa_jitter * gl_Position.w;
}
layout(location=1) out vec4 frag_position;
layout(location=2) out vec4 frag_normal;
${(ENABLE_EMISSIVE_BUFFER ? 'layout(location=3) out vec4 frag_emissive;' : '')}
void fragment(){
  #ifdef USE_MAT
    setup_material(mat);
    resolve_base_color(mat);
    resolve_normal_map(mat);
    resolve_shading_attributes(mat);
    gl_FragColor=mat.base_color;
    ${(ENABLE_EMISSIVE_BUFFER ? 'frag_emissive = vec4(mat.emissive_color, 1.0);' : 'gl_FragColor.rgb+= mat.emissive_color;')}
    frag_position = vec4(v_position_world,mat.roughness);
    frag_normal = vec4(mat.normal_world, mat.metallic);
  #else
    super_fragment();
    frag_position = vec4(v_position_world,1.0);
    frag_normal = vec4(0,1,0,1);
#ifdef HAS_NORMAL
    frag_normal = vec4(v_normal,1.0);
#endif
#ifdef DIFFUSE_SURFACE
    frag_normal.w = 0.0;
#endif
    ${(ENABLE_EMISSIVE_BUFFER ? 'frag_emissive = vec4(0.0);' : '')}
  #endif
}
`
      });
      mat.deffered_mat.uniforms = mat.uniforms;
      if (DEBUG) console.log("deffered_mat", mat);
    }
    return mat.deffered_mat;
  };

  const shadow_maping = `
#ifdef ENABLE_SHADOWS
uniform mat4 u_light_view_proj_matrix0;
uniform mat4 u_light_view_proj_matrix1;
uniform mat4 u_light_view_proj_matrix2;
uniform vec3 u_cascade_splits;
uniform vec3 u_shadow_depth_scale;   // 1 / (world length spanned by each cascade's depth range)
uniform sampler2DShadow u_shadow_map0;
uniform sampler2DShadow u_shadow_map1;
uniform sampler2DShadow u_shadow_map2;
uniform float u_shadow_texel_world_size0;
uniform float u_shadow_texel_world_size1;
uniform float u_shadow_texel_world_size2;

// live tweaks, assigned from FL() at the top of the lighting pass's fragment()
float SHADOW_MIN = 0.1;             // what a fully shadowed point keeps of the sun (a stand-in for sky light)
float SHADOW_BIAS_TEXELS = 1.5;     // constant depth bias, in shadow texels (doubled at grazing angles)
float SHADOW_NORMAL_OFFSET = 1.0;   // scale of the normal offset (1.5..6 texels, by the angle to the light)
float SHADOW_SOFTNESS = 1.0;        // PCF kernel spacing, in shadow texels

// 0 = shadowed, 1 = lit
float sample_shadow_cascade(sampler2DShadow shadow_map, mat4 light_view_proj, float texel_world_size, float depth_scale, vec3 fragPosWorld, vec3 normal, vec3 lightDir) {
    float n_dot_l = clamp(dot(normal, lightDir), 0.0, 1.0);
    float normal_offset = texel_world_size * mix(6.0, 1.5, n_dot_l) * SHADOW_NORMAL_OFFSET;
    vec3 offsetPos = fragPosWorld + normal * normal_offset;

    vec4 fragPosLightSpace = light_view_proj * vec4(offsetPos, 1.0);
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    projCoords = projCoords * 0.5 + 0.5;

    if(projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0 ) {
        return 1.0;
    }

    // the bias is a distance in texels (what acne scales with), turned into this cascade's [0,1] depth
    float bias = texel_world_size * SHADOW_BIAS_TEXELS * mix(2.0, 1.0, n_dot_l) * depth_scale;
    float currentDepth = projCoords.z - bias;

    float lit = 0.0;
    vec2 texelSize = SHADOW_SOFTNESS / vec2(textureSize(shadow_map, 0));
    for(int x = -1; x <= 1; ++x) {
        for(int y = -1; y <= 1; ++y) {
            lit += texture(shadow_map, vec3(projCoords.xy + vec2(x, y) * texelSize, currentDepth));
        }
    }
    return lit / 9.0;
}

float shadow_lit(vec3 fragPosWorld, vec3 normal, vec3 lightDir) {
    float dist = length(fragPosWorld - u_camera_position);

    float blend0 = u_cascade_splits[0] * 0.15;
    float blend1 = u_cascade_splits[1] * 0.15;

    if (dist < u_cascade_splits[0] - blend0) {
        return sample_shadow_cascade(u_shadow_map0, u_light_view_proj_matrix0, u_shadow_texel_world_size0, u_shadow_depth_scale[0], fragPosWorld, normal, lightDir);
    }
    else if (dist < u_cascade_splits[0]) {
        float s0 = sample_shadow_cascade(u_shadow_map0, u_light_view_proj_matrix0, u_shadow_texel_world_size0, u_shadow_depth_scale[0], fragPosWorld, normal, lightDir);
        float s1 = sample_shadow_cascade(u_shadow_map1, u_light_view_proj_matrix1, u_shadow_texel_world_size1, u_shadow_depth_scale[1], fragPosWorld, normal, lightDir);
        float t = smoothstep(u_cascade_splits[0] - blend0, u_cascade_splits[0], dist);
        return mix(s0, s1, t);
    }
    else if (dist < u_cascade_splits[1] - blend1) {
        return sample_shadow_cascade(u_shadow_map1, u_light_view_proj_matrix1, u_shadow_texel_world_size1, u_shadow_depth_scale[1], fragPosWorld, normal, lightDir);
    }
    else if (dist < u_cascade_splits[1]) {
        float s1 = sample_shadow_cascade(u_shadow_map1, u_light_view_proj_matrix1, u_shadow_texel_world_size1, u_shadow_depth_scale[1], fragPosWorld, normal, lightDir);
        float s2 = sample_shadow_cascade(u_shadow_map2, u_light_view_proj_matrix2, u_shadow_texel_world_size2, u_shadow_depth_scale[2], fragPosWorld, normal, lightDir);
        float t = smoothstep(u_cascade_splits[1] - blend1, u_cascade_splits[1], dist);
        return mix(s1, s2, t);
    }
    else if (dist < u_cascade_splits[2]) {
        float s2 = sample_shadow_cascade(u_shadow_map2, u_light_view_proj_matrix2, u_shadow_texel_world_size2, u_shadow_depth_scale[2], fragPosWorld, normal, lightDir);
        // fade out over the last 10% instead of a hard edge at the split
        return mix(s2, 1.0, smoothstep(u_cascade_splits[2] * 0.9, u_cascade_splits[2], dist));
    }

    return 1.0;
}

// same contract as v1: 1 = lit, SHADOW_MIN = fully shadowed
float ShadowCalculation(vec3 fragPosWorld, vec3 normal, vec3 lightDir) {
    return mix(SHADOW_MIN, 1.0, shadow_lit(fragPosWorld, normal, lightDir));
}
#endif // ENABLE_SHADOWS
`;

  // GLSL that only exists with a feature (plain strings, not nested template literals: the bundler's own parser cannot read those, and
  // FL() slots and sliders are made for every FL( in the source, so a feature that is off must not leave its FL( behind)
  const shadow_tweaks_code = !ENABLE_SHADOWS ? '' : [
    '    SHADOW_MIN = FL("SHADOW_MIN",0.2,0.0,1.0,0.01);',
    '    SHADOW_BIAS_TEXELS = FL("SHADOW_BIAS_TEXELS",1.5,0.0,8.0,0.1);',
    '    SHADOW_NORMAL_OFFSET = FL("SHADOW_NORMAL_OFFSET",1.0,0.0,4.0,0.1);',
    '    SHADOW_SOFTNESS = FL("SHADOW_SOFTNESS",1.0,0.25,4.0,0.05);'
  ].join('\n');
  // emitted light is not lit, shadowed or clamped with the albedo: it is added after the lighting (and still goes through the air
  // between the surface and the camera, below)
  // a glossy surface mirrors the sky (ENABLE_SKY_REFLECTION above): the atmosphere toward the reflected ray, weighed by Fresnel and the gloss; 1 - smoothstep(0.5, 0.7, roughness) fades it out before the branch cuts it off
  const sky_reflection_code = !ENABLE_SKY_REFLECTION ? '' : '\n' + [
    '        if (roughness < 0.7) {',
    '            vec4 sky_r_tr = vec4(1.0);',
    '            vec3 sky_r_in = GetAtmosphere(p, reflect(rd, N), INFINITY, sun_dir, sun_radiance, sky_r_tr);',
    '            vec3 sky_r_f0 = mix(vec3(0.04), albedo, metallic);',
    '            vec3 sky_r_f = sky_r_f0 + (1.0 - sky_r_f0) * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);',
    '            scene_color += sky_r_in * sky_r_f * ((1.0 - roughness) * (1.0 - roughness) * (1.0 - smoothstep(0.5, 0.7, roughness)));',
    '        }'
  ].join('\n');
  const emissive_code = !ENABLE_EMISSIVE_BUFFER ? '' :
    '        scene_color += texture(frag_emissive, v_uv).rgb * FL("EMISSIVE_SCALE",1.0,0.0,32.0,0.1);';

  const output_uniforms = {
    frag_normal: screen.frag_normal,
    frag_position: screen.frag_position,
    frag_albedo: screen.color,
    u_shadow_map0: screen.cascades[0].depth,
    u_shadow_map1: screen.cascades[1].depth,
    u_shadow_map2: screen.cascades[2].depth,
    u_light_view_proj_matrix0: screen.cascades[0].camera.view_projection_matrix,
    u_light_view_proj_matrix1: screen.cascades[1].camera.view_projection_matrix,
    u_light_view_proj_matrix2: screen.cascades[2].camera.view_projection_matrix,
    u_shadow_texel_world_size0: screen.cascades[0].texel_size,
    u_shadow_texel_world_size1: screen.cascades[1].texel_size,
    u_shadow_texel_world_size2: screen.cascades[2].texel_size,
    u_cascade_splits: engine.math.vec3(screen.cascades[0].d, screen.cascades[1].d, screen.cascades[2].d),
    u_shadow_depth_scale: engine.math.vec3(1 / screen.cascades[0].depth_range, 1 / screen.cascades[1].depth_range, 1 / screen.cascades[2].depth_range)
  };
  if (ENABLE_EMISSIVE_BUFFER) output_uniforms.frag_emissive = screen.frag_emissive;

  screen.output = engine.materials.clone(engine.render_texture.mat, {
    uniforms: output_uniforms,
    shader: `
${ENABLE_SHADOWS ? '#define ENABLE_SHADOWS' : ''}
${ENABLE_ATMOSPHERE ? '#define ENABLE_ATMOSPHERE' : ''}
${ENABLE_WATER ? '#define ENABLE_WATER' : ''}
${ENABLE_MOON_DISC ? '#define ENABLE_MOON_DISC' : ''}${ENABLE_SKY_REFLECTION ? '\n#define ENABLE_SKY_REFLECTION' : ''}

struct Light {
    vec3 direction;
    vec3 color;
    float illuminated;
    float attenuation;
};

uniform Light directional_lights[2];
uniform Light ambient_lights[2];
uniform sampler2D frag_normal;
uniform sampler2D frag_position;
uniform sampler2D frag_albedo;
${ENABLE_EMISSIVE_BUFFER ? 'uniform sampler2D frag_emissive;' : ''}
uniform mat4 u_projection_matrix;
uniform mat4 u_view_matrix;
uniform vec4 u_world_info;
varying vec2 v_uv;

${pbr_chunk()}
${engine.shaders_cat.atmosphere()}
${shadow_maping}
${ENABLE_WATER ? engine.shaders_cat.water() : ''}

void fragment(){
    // 1. Atmosphere Tweaks
    AERIAL_SCALE = FL("AERIAL_SCALE",0.8,0.1,5.0,0.1);
    EXPOSURE = FL("EXPOSURE",32.0,1.0,64.0,0.25);
    DENSITY = FL("DENSITY",2.0,1.0,16.0,0.1);
    SUN_DISC_SIZE = 0.15;
${shadow_tweaks_code}

    // 2. Fetch G-Buffer Data
    vec4 albedo_data = texture(frag_albedo, v_uv);
    vec3 albedo = albedo_data.rgb;
    vec4 pos_data = texture(frag_position, v_uv);
    vec3 position = pos_data.rgb;
    float roughness = pos_data.a;
    vec4 norm_data = texture(frag_normal, v_uv);
    vec3 normal = norm_data.rgb;
    float metallic = norm_data.a;
    float depth = texture(u_render_texture_texture, v_uv).r;
    bool is_sky = length(normal) < 0.1;
    #ifdef ENABLE_WATER
        // (a one pixel hole between two points of one surface is not the sky: with water the sky below the horizon is the sea, and a crack would be a line of it)
        if (is_sky && water_heal(v_uv, albedo, position, roughness, normal, metallic)) is_sky = false;
    #endif

    vec3 ro = u_camera_position;
    vec3 p = position;

    // 3. Setup Ray Direction & Length
    vec3 rd;
    float rl;

    float WORLD_SCALE =(smoothstep(0.5,FL("foq_unit",1.0,0.1,4.0,0.1),depth)* 5.0)+1.0;

    if (is_sky) {
        p = reconstruct_world_pos(v_uv, 1.0);
        rd = normalize(p - ro);
        rl = INFINITY;
    } else {
        rd = normalize(p - ro);
        rl = length(p - ro) * WORLD_SCALE;
    }

    // 4. Setup Sun and Moon Vectors
    Light sun = directional_lights[0];
    vec3 sun_dir = normalize(sun.direction);
    vec3 sun_radiance = sun.color * sun.illuminated * sun.attenuation;

    vec3 moon_dir = normalize(${glsl_vec3(MOON_DIRECTION)});
    vec3 moon_radiance = vec3(0.01) * (dot(sun_dir, -moon_dir) * 0.5 + 0.5);

    // solar eclipse: the sun goes dark where the moon covers it (written with ascending smoothstep edges: undefined otherwise)
    sun_radiance *= mix(1.0, 1.0 - smoothstep(0.99985, 1.0, dot(sun_dir, moon_dir)), 0.999);

    // the moon is 1% of the sun at best: while the sun, AS THE AIR LETS IT THROUGH, outshines it by MOON_SKIP_RATIO its air and
    // its BRDF are not worth a march per pixel. (The raw radiance is not the test: a low sun is mostly extinguished, and the
    // moon's glow is then a visible part of the sky.) Uniforms only, so the same for every pixel (no divergence). 0 = never skip.
    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
    float moon_skip_ratio = FL("MOON_SKIP_RATIO",64.0,0.0,1000.0,1.0);
    vec3 sun_seen = sun_radiance * GetLightTransmittance(ro, sun_dir, 1.0);
    bool moon_active = !(moon_skip_ratio > 0.0 && dot(sun_seen, LUMA) > moon_skip_ratio * dot(moon_radiance, LUMA));
    #ifdef ENABLE_MOON_DISC
        moon_active = true;
    #endif

    // 5. Compute Atmospheric Scattering for Both (Conditional)
    vec4 sun_transmittance = vec4(1.0);
    vec4 moon_transmittance = vec4(1.0);
    vec3 sun_scattering = vec3(0.0);
    vec3 moon_scattering = vec3(0.0);

    // (where the water covers the pixel entirely its air is not this one: the water makes its own, to the surface, and under the surface there is none: not worth two evaluations)
    bool water_covers = false;
    #ifdef ENABLE_WATER
        water_covers = water_hides(ro, rd, is_sky, p);
    #endif
    #ifdef ENABLE_ATMOSPHERE
        if (!water_covers) {
            sun_scattering = GetAtmosphere(ro, rd, rl, sun_dir, sun_radiance, sun_transmittance);
            if (moon_active) moon_scattering = GetAtmosphere(ro, rd, rl, moon_dir, moon_radiance, moon_transmittance);
        }
    #endif

    vec3 total_scattering = sun_scattering + moon_scattering;
    vec3 scene_color = vec3(0.0);

    // 6. Surface Lighting (Terrain)
    if (!is_sky) {
        vec3 N = normalize(normal);
        vec3 V = -rd;

        // CALCULATE SHADOW HERE (Conditional)
        #ifdef ENABLE_SHADOWS
            float shadow_factor = 1.0;
            // (a sea floor several metres under the water: its shadow is not seen through it; a shallower one is shadowed by what the sun's ray, bent by the waves, finds on its way: water.js)
            #ifdef ENABLE_WATER
                if (!(water_covers && water_deeper(p, 3.0))) {
                    if (water_submerged(p)) shadow_factor = water_floor_shadow(p, N, sun_dir, ro);
                    else shadow_factor = ShadowCalculation(p, N, sun_dir);
                }
            #else
                shadow_factor = ShadowCalculation(p, N, sun_dir);
            #endif
        #else
            float shadow_factor = 1.0;
        #endif

        vec3 surface_sun_rad = sun_radiance * GetLightTransmittance(p, sun_dir, 1.0) * shadow_factor;

        vec3 Lo = CalculatePBR(N, V, sun_dir, surface_sun_rad, albedo, roughness, metallic);
        if (moon_active) {
            vec3 surface_moon_rad = moon_radiance * GetLightTransmittance(p, moon_dir, 1.0);
            Lo += CalculatePBR(N, V, moon_dir, surface_moon_rad, albedo, roughness, metallic);
        }

        float ao = 1.0;

        float ambient_scale = FL("AMBIENT_SCALE",0.1,0.0,2.0,0.01);
        vec3 ambient = vec3(0.0);
        for(int i = 0; i < 2; i++) {
            ambient += ambient_lights[i].color * ambient_lights[i].illuminated * albedo * ambient_scale * ao;
        }

        scene_color = ambient + Lo;

${emissive_code}${sky_reflection_code}
    }

    // 7. Final Compositing
    vec3 final_color;
    if (is_sky) {
        float sun_mask = GetDisc(rd, sun_dir, SUN_DISC_SIZE);
        vec3 sun_disc = vec3(sun_mask) * sun_radiance * sun_transmittance.xyz * sun_transmittance.w * 50.0;

        final_color = total_scattering + sun_disc;

        #ifdef ENABLE_MOON_DISC
            float moon_mask = GetDisc(rd, moon_dir, SUN_DISC_SIZE * 0.9);
            final_color += vec3(moon_mask) * vec3(1.2) * moon_transmittance.xyz * moon_transmittance.w;
        #endif
    } else {
        final_color = (scene_color * sun_transmittance.xyz) + total_scattering;
    }

    // 7b. Water: where the ray meets the sea before it meets the scene (or the sky), what is seen is the water's: the scene through it, the sky in it, its foam, in the pass's own linear
    // radiance, with the atmosphere between the camera and the surface. Under the surface everything is seen through the water. (water/water.js; a no-op while the module's switch is off)
    #ifdef ENABLE_WATER
        final_color = water_compose(final_color, scene_color, ro, rd, is_sky, p, WORLD_SCALE, sun_dir, sun_radiance, moon_dir, moon_radiance);
    #endif

    // 8. Tonemapping & Gamma
    final_color = TonemapACES(final_color);
    final_color = pow(final_color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(final_color, 1.0);
}
`
  });

  // ---------------------------------------------------------------------------------------------
  // Anti-aliasing. The deferred pipeline cannot use MSAA, so the lit image is drawn to an offscreen target
  // and resolved to the canvas by one of:
  //   "none"  the lit image goes straight to the canvas (as before)
  //   "fxaa"  single-pass edge-directed blur on the final (tonemapped) colours: cheap, softens aliased edges,
  //           but cannot recover a sub-pixel feature that no pixel happened to hit
  //   "taa"   temporal: the projection is jittered by a sub-pixel Halton offset each frame, every frame is
  //           blended into a history target after reprojecting it with last frame's view-projection matrix
  //           (the G-buffer stores the world position of each pixel, so reprojection needs no depth maths),
  //           and the history is clamped to the colour range of the current 3x3 neighbourhood to limit ghosting.
  //           Thin geometry (grass, twigs) gets accumulated coverage instead of flickering in and out.
  //           Only camera motion is reprojected (no velocity buffer): moving objects rely on the clamp.
  // screen.antialias can be changed at any time.
  // what a pass that draws AFTER this one (the soft particles of particles/gpu_particles.js) needs to haze itself the way the lighting pass hazes the scene
  // (and the sun's shadow maps, to dim themselves where they sit in shadow: screen.cascades, only when the pass has shadows)
  screen.atmosphere = ENABLE_ATMOSPHERE; screen.logdepth = ENABLE_LOGDEPTH; screen.moon_direction = MOON_DIRECTION; screen.shadows_enabled = ENABLE_SHADOWS;
  screen.antialias = def.ANTIALIAS || "none";
  screen.taa_feedback = 0.9;     // weight of the history in the blend (0 = no accumulation)
  screen.taa_sharpen = 0.15;      // TAA softens; a light unsharp mask on the output gives some of it back (v1: 0.25, before the history was resampled bicubically)
  screen.taa_samples = 8;         // length of the jitter sequence
  if (screen.antialias === "taa" && !cam) console.warn("deffered_rendering: TAA needs def.camera (for last frame's view-projection): FXAA is used instead");
  // the mode actually in effect (TAA cannot run without the camera)
  function aa_mode() {
    const mode = screen.antialias;
    return (mode === "taa" && !cam) ? "fxaa" : mode;
  }
  const aa_lit = engine.render_targets.create({ width: 1, height: 1, color: { filter: GL_LINEAR } });
  const aa_hist = [0, 1].map(function () {
    return engine.render_targets.create({ width: 1, height: 1, color: { filter: GL_LINEAR, internal_format: GL_RGBA16F, format_type: GL_HALF_FLOAT } });
  });
  const aa_jitter = new Float32Array(2);
  const aa_prev_vp = new Float32Array(16), aa_last_vp = new Float32Array(16);
  const aa_taa_params = new Float32Array(3);                   // feedback, sharpen, (unused)
  engine.uniforms.set("u_taa_jitter", aa_jitter);
  let aa_index = 0, aa_frame = 0, aa_reset = true, aa_w = 0, aa_h = 0, aa_mode_prev = "none";

  function halton(i, b) {
    let f = 1, r = 0;
    while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
    return r;
  }

  const aa_blit_mat = engine.materials.clone(engine.render_texture.mat, {
    uniforms: { u_taa_params: aa_taa_params },
    shader: `
uniform vec2 u_render_size;
uniform vec3 u_taa_params;
varying vec2 v_uv;
void fragment(){
    vec2 px = 1.0 / u_render_size;
    vec3 c = texture(u_render_texture_texture, v_uv).rgb;
    vec3 blur = (texture(u_render_texture_texture, v_uv + vec2(px.x, 0.0)).rgb + texture(u_render_texture_texture, v_uv - vec2(px.x, 0.0)).rgb
               + texture(u_render_texture_texture, v_uv + vec2(0.0, px.y)).rgb + texture(u_render_texture_texture, v_uv - vec2(0.0, px.y)).rgb) * 0.25;
    gl_FragColor = vec4(max(c + (c - blur) * u_taa_params.y, 0.0), 1.0);
}`
  });

  const aa_fxaa_mat = engine.materials.clone(engine.render_texture.mat, {
    shader: `
uniform vec2 u_render_size;
varying vec2 v_uv;
// FXAA (after T. Lottes): find the local edge direction from the luma of the four diagonal neighbours and blur along it
vec3 fxaa(sampler2D tex, vec2 uv, vec2 texel) {
    const float REDUCE_MIN = 1.0 / 128.0, REDUCE_MUL = 1.0 / 8.0, SPAN_MAX = 8.0;
    vec3 rgbNW = texture(tex, uv + vec2(-1.0, -1.0) * texel).rgb;
    vec3 rgbNE = texture(tex, uv + vec2( 1.0, -1.0) * texel).rgb;
    vec3 rgbSW = texture(tex, uv + vec2(-1.0,  1.0) * texel).rgb;
    vec3 rgbSE = texture(tex, uv + vec2( 1.0,  1.0) * texel).rgb;
    vec3 rgbM  = texture(tex, uv).rgb;
    const vec3 luma = vec3(0.299, 0.587, 0.114);
    float lumaNW = dot(rgbNW, luma), lumaNE = dot(rgbNE, luma), lumaSW = dot(rgbSW, luma), lumaSE = dot(rgbSE, luma), lumaM = dot(rgbM, luma);
    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));
    vec2 dir;
    dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
    dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));
    float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * REDUCE_MUL), REDUCE_MIN);
    float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
    dir = min(vec2(SPAN_MAX), max(vec2(-SPAN_MAX), dir * rcpDirMin)) * texel;
    vec3 rgbA = 0.5 * (texture(tex, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture(tex, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
    vec3 rgbB = rgbA * 0.5 + 0.25 * (texture(tex, uv + dir * -0.5).rgb + texture(tex, uv + dir * 0.5).rgb);
    float lumaB = dot(rgbB, luma);
    return (lumaB < lumaMin || lumaB > lumaMax) ? rgbA : rgbB;
}
void fragment(){
    gl_FragColor = vec4(fxaa(u_render_texture_texture, v_uv, 1.0 / u_render_size), 1.0);
}`
  });

  const aa_taa_mat = engine.materials.clone(engine.render_texture.mat, {
    uniforms: {
      frag_position: screen.frag_position,
      frag_normal: screen.frag_normal,
      u_taa_prev_vp: aa_prev_vp,
      u_taa_params: aa_taa_params,
      u_taa_history: aa_hist[0].color,
    },
    shader: `
uniform sampler2D frag_position;
uniform sampler2D frag_normal;
uniform sampler2D u_taa_history;
uniform mat4 u_taa_prev_vp;
uniform mat4 u_inverse_view_projection_matrix;
uniform vec3 u_camera_position;
uniform vec3 u_taa_params;      // x: history weight
uniform vec2 u_render_size;
varying vec2 v_uv;

// Catmull-Rom history lookup in 5 bilinear taps: plain bilinear resampling of the history every frame is what makes TAA soft
vec3 sample_history(sampler2D tex, vec2 uv) {
    vec2 size = vec2(textureSize(tex, 0));
    vec2 pos = uv * size;
    vec2 center = floor(pos - 0.5) + 0.5;
    vec2 f = pos - center;
    vec2 f2 = f * f;
    vec2 f3 = f2 * f;
    vec2 w0 = f2 - 0.5 * (f3 + f);
    vec2 w1 = 1.5 * f3 - 2.5 * f2 + 1.0;
    vec2 w3 = 0.5 * (f3 - f2);
    vec2 w2 = 1.0 - w0 - w1 - w3;
    vec2 w12 = w1 + w2;
    vec2 tc0 = (center - 1.0) / size;
    vec2 tc3 = (center + 2.0) / size;
    vec2 tc12 = (center + w2 / w12) / size;
    vec3 c = texture(tex, vec2(tc12.x, tc0.y)).rgb * (w12.x * w0.y)
           + texture(tex, vec2(tc0.x, tc12.y)).rgb * (w0.x * w12.y)
           + texture(tex, tc12).rgb * (w12.x * w12.y)
           + texture(tex, vec2(tc3.x, tc12.y)).rgb * (w3.x * w12.y)
           + texture(tex, vec2(tc12.x, tc3.y)).rgb * (w12.x * w3.y);
    float wsum = (w12.x * w0.y) + (w0.x * w12.y) + (w12.x * w12.y) + (w3.x * w12.y) + (w12.x * w3.y);
    return max(c / wsum, 0.0);
}

void fragment(){
    vec2 px = 1.0 / u_render_size;
    vec3 c = texture(u_render_texture_texture, v_uv).rgb;
    // colour range of the 3x3 neighbourhood (mean +- 1.25 sigma, inside the min/max box)
    vec3 m1 = vec3(0.0), m2 = vec3(0.0), mn = c, mx = c;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec3 s = texture(u_render_texture_texture, v_uv + vec2(float(x), float(y)) * px).rgb;
            m1 += s; m2 += s * s; mn = min(mn, s); mx = max(mx, s);
        }
    }
    vec3 mean = m1 / 9.0, sigma = sqrt(max(m2 / 9.0 - mean * mean, 0.0));
    vec3 lo = max(mn, mean - 1.25 * sigma), hi = min(mx, mean + 1.25 * sigma);

    bool is_sky = length(texture(frag_normal, v_uv).rgb) < 0.1;
    vec3 result = c;
    if (u_taa_params.x > 0.0) {
        vec4 pc;
        if (is_sky) {
            // nothing was drawn here: reproject the view ray as a direction at infinity (w = 0), so a pixel that is
            // sometimes sky and sometimes a thin blade accumulates the right mix instead of flickering
            vec4 far_pt = u_inverse_view_projection_matrix * vec4(v_uv * 2.0 - 1.0, 1.0, 1.0);
            pc = u_taa_prev_vp * vec4(normalize(far_pt.xyz / far_pt.w - u_camera_position), 0.0);
        }
        else {
            pc = u_taa_prev_vp * vec4(texture(frag_position, v_uv).rgb, 1.0);
        }
        vec2 huv = pc.xy / pc.w * 0.5 + 0.5;
        if (pc.w > 0.0 && huv.x > 0.0 && huv.x < 1.0 && huv.y > 0.0 && huv.y < 1.0) {
            vec3 hist = clamp(sample_history(u_taa_history, huv), lo, hi);
            float motion = length((huv - v_uv) * u_render_size);                  // pixels moved since last frame
            float w = u_taa_params.x * (1.0 - 0.6 * smoothstep(0.5, 8.0, motion));    // trust the history less while moving
            result = mix(c, hist, w);
        }
    }
    gl_FragColor = vec4(result, 1.0);
}`
  });

  // the jitter / bookkeeping that has to happen once per frame, before anything is queued
  function aa_begin_frame() {
    const mode = aa_mode();
    const w = engine.render_width, h = engine.render_height;
    if (mode !== aa_mode_prev || w !== aa_w || h !== aa_h) aa_reset = true;     // the history is not valid any more
    aa_mode_prev = mode; aa_w = w; aa_h = h;
    if (mode === "taa" && w > 0 && h > 0) {
      const n = Math.max(1, screen.taa_samples | 0);
      const i = (aa_frame % n) + 1;
      aa_jitter[0] = (halton(i, 2) - 0.5) * 2.0 / w;
      aa_jitter[1] = (halton(i, 3) - 0.5) * 2.0 / h;
    }
    else { aa_jitter[0] = 0; aa_jitter[1] = 0; }
    aa_frame++;
  }

  // draws the lit image and resolves it to the canvas according to screen.antialias
  function aa_resolve() {
    const mode = aa_mode();
    if (mode !== "fxaa" && mode !== "taa") {
      engine.render_texture(screen.depth, 0, 0, 1, 1, screen.output);
      composite_transparent();
      return;
    }
    engine.push_render_target(aa_lit, true);
    engine.render_texture(screen.depth, 0, 0, 1, 1, screen.output);
    composite_transparent();                              // (the glass is in the picture the antialiasing sees)
    engine.pop_render_target();
    if (mode === "fxaa") {
      engine.render_texture(aa_lit.color, 0, 0, 1, 1, aa_fxaa_mat);
      return;
    }
    // TAA: aa_hist[aa_index] receives the resolved frame, aa_hist[1 - aa_index] holds the previous one
    const prev = aa_hist[1 - aa_index], next = aa_hist[aa_index];
    aa_taa_mat.uniforms.u_taa_history = prev.color;
    aa_taa_params[0] = aa_reset ? 0 : screen.taa_feedback;
    aa_taa_params[1] = screen.taa_sharpen;
    aa_prev_vp.set(aa_last_vp);                          // last frame's view-projection, unjittered (read when the frame is flushed)
    aa_last_vp.set(cam.view_projection_matrix);
    engine.push_render_target(next, false);
    engine.render_texture(aa_lit.color, 0, 0, 1, 1, aa_taa_mat);
    engine.pop_render_target();
    engine.render_texture(next.color, 0, 0, 1, 1, aa_blit_mat);
    aa_index = 1 - aa_index;
    aa_reset = false;
  }

  screen.on_frame = function (time, time_delta) { };
  screen.on_after_frame = function (time, time_delta) { };
  screen.on_shadowmap = function (time, time_delta, cascade, cascade_index) { };

  // ---------------------------------------------------------------------------------------------
  // TRANSPARENT SURFACES (screen.transparent). The G-buffer holds ONE surface a pixel and the lighting pass lights it once, so glass cannot be in it. A transparent surface is lit by its OWN fragment
  // shader (the pass's own sun, shadows, ambient, sky and air: the lighting pass's steps 5 to 8 for one surface) and blended over the lit image:
  //   screen.transparent.mode = "target" (the default)   the glass is drawn into ONE extra target (RGBA8: the premultiplied lit colour and the coverage) that SHARES THE G-BUFFER'S DEPTH TEXTURE
  //                      (attached as the depth buffer, never sampled: no feedback loop), right after the G-buffer pass; the hardware depth test hides what is behind a wall, a frame, a person, and
  //                      with the depth write on the NEAREST glass of a pixel wins whatever the order (a farther one drawn after it is rejected, a nearer one drawn after it blends over: the order
  //                      is never wrong, a layer behind a layer can be lost: one layer a pixel is the price of no sorting). The target is blended over the lit image (ONE, ONE_MINUS_SRC_ALPHA)
  //                      BEFORE the antialiasing, so TAA / FXAA see the glass as part of the picture. The cost: one RGBA8 target (8 MB at 1080p) and one full-screen blend, only on a frame that drew glass.
  //   screen.transparent.mode = "forward"                the glass is drawn after the antialiasing, on the canvas, no depth buffer: the G-buffer's own position is the depth test (in the shader),
  //                      the items with a distance() far to near. (The first version; it is clean of TAA's jitter and has no extra target.)
  //   screen.transparent.material(base, { cut })  a material made from `base` (an engine pbr material: a species', a plain one) that does the lighting above for the current mode (cached on `base` by mode).
  //                      The glass is the material's opacity (base colour alpha x a map's x the vertex's): under 0.004 nothing is drawn, and `cut` (when given) is the opacity from which a surface is SOLID
  //                      (it is in the G-buffer, not here): the pixels of an opacity map are told apart by it, a material that alpha-tests at `cut` in the G-buffer pass (u_alpha_test) and is drawn here too
  //                      shows each pixel in exactly one of the two. `u_alpha_test` is off in the transparent material.
  //   screen.transparent.add(item) / .remove(item)  item = { render(), distance()? }: render() puts the draws (engine.render_item with the transparent material) in the command stream; the items that
  //                      have a distance() are drawn far to near, after the ones that have none
  //   screen.transparent.environment = [r, g, b]  what a mirror shows when there is no atmosphere (linear, default a pale sky)       screen.transparent.reflection  how much Fresnel the glass takes (1: what the
  //                      physics says: 4 % straight on, a car's glass reads as glass with 2 to 3)
  // The shader uses the same chunks, FL sliders and cascade uniforms as the lighting pass: AMBIENT_SCALE, SHADOW_*, AERIAL_SCALE and EXPOSURE move it with the rest. Not in it: the moon, the water, the
  // emissive buffer, refraction (what is behind shows by the blend: no bending); a transparent surface casts no shadow (the shadow pass draws what is solid).
  const transparent = screen.transparent = { items: [], environment: [0.30, 0.42, 0.62], reflection: 1, drawn: 0, mode: "target" };
  transparent.add = function (item) { if (item && transparent.items.indexOf(item) < 0) transparent.items.push(item); return item; };
  transparent.remove = function (item) { const i = transparent.items.indexOf(item); if (i >= 0) transparent.items.splice(i, 1); };
  const tr_size = new Float32Array([1, 1]), tr_env = new Float32Array(3), tr_glass = new Float32Array([1, 0, 0, 0]);
  const tr_target_mode = function () { return transparent.mode === "forward" ? false : true; };

  // THE TARGET: the colour is its own, the depth is the G-buffer's (the same GL texture on a second framebuffer; it holds the opaque depth of the frame, and the glass writes its own over it: nothing reads
  // the depth after this, the next frame clears it). Filled (and blended into the lit image) only on a frame that drew glass.
  const tr_rt = engine.render_targets.create({ width: 1, height: 1, color: { filter: GL_LINEAR } });
  tr_rt.depth = screen.depth;
  const tr_comp_mat = engine.materials.clone(engine.render_texture.mat, { state: { blend: { func: [1, 771] }, depthFunc: null } });
  let tr_filled = false;
  function composite_transparent() {
    if (tr_filled) engine.render_texture(tr_rt.color, 0, 0, 1, 1, tr_comp_mat);
  }

  // the fragment shader: plain strings (the bundler's parser cannot read a template inside a template), the features that are off leave nothing behind
  const transparent_shader = function (target) {
    // (the engine splits a shader at the end of `void vertex()`: what is before it is the vertex stage's, what is after it the fragment's)
    const L = ['void vertex() { super_vertex(); }'];
    if (ENABLE_SHADOWS) L.push('#define ENABLE_SHADOWS');
    if (ENABLE_ATMOSPHERE) L.push('#define ENABLE_ATMOSPHERE');
    L.push('#ifndef PI', '#define PI 3.14159265358', '#endif');
    L.push(ENABLE_ATMOSPHERE ? engine.shaders_cat.atmosphere() : 'vec3 TonemapACES(vec3 color) { return (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14); }');
    if (ENABLE_SHADOWS) L.push('precision highp sampler2DShadow;');
    L.push(shadow_maping);
    if (!target) L.push(
      'uniform sampler2D u_tr_position;',
      'uniform sampler2D u_tr_normal;',
      'uniform vec2 u_tr_size;'
    );
    L.push(
      'uniform vec3 u_tr_env;',
      'uniform vec4 u_tr_glass;',
      'uniform float u_tr_cut;',
      'void fragment() {',
      '  setup_material(mat);',
      '  resolve_base_color(mat);',
      '  resolve_normal_map(mat);',
      '  resolve_shading_attributes(mat);',
      // (under 0.004: nothing; from `cut` on: solid, it is in the G-buffer)
      '  if (mat.opacity < 0.004 || mat.opacity >= u_tr_cut) discard;',
      '  vec3 P = v_position_world;'
    );
    // forward mode: behind a surface of the scene: gone (the G-buffer's position is the scene's, a normal of zero is the sky); the target has the hardware depth test instead
    if (!target) L.push(
      '  vec2 suv = gl_FragCoord.xy / u_tr_size;',
      '  vec4 sn = texture(u_tr_normal, suv);',
      '  if (dot(sn.xyz, sn.xyz) > 0.01) {',
      '    float ds = distance(texture(u_tr_position, suv).xyz, u_camera_position), df = distance(P, u_camera_position);',
      '    if (ds < df - (0.004 + 0.0005 * df)) discard;',
      '  }'
    );
    L.push(
      '  vec3 N = normalize(mat.normal_world);',
      '  vec3 ro = u_camera_position;',
      '  vec3 V = normalize(ro - P);',
      '  float NdotV = clamp(dot(N, V), 0.0, 1.0);',
      '  Light sun = directional_lights[0];',
      '  vec3 sun_dir = normalize(sun.direction);',
      '  vec3 sun_radiance = sun.color * sun.illuminated * sun.attenuation;',
      '  float o = clamp(mat.opacity, 0.0, 1.0);'
    );
    if (ENABLE_ATMOSPHERE) L.push(
      '  AERIAL_SCALE = FL("AERIAL_SCALE",0.8,0.1,5.0,0.1);',
      '  EXPOSURE = FL("EXPOSURE",32.0,1.0,64.0,0.25);',
      '  DENSITY = FL("DENSITY",2.0,1.0,16.0,0.1);',
      '  SUN_DISC_SIZE = 0.15;'
    );
    if (ENABLE_SHADOWS) L.push(shadow_tweaks_code, '  float shadow_factor = ShadowCalculation(P, N, sun_dir);');
    else L.push('  float shadow_factor = 1.0;');
    L.push(
      // the sun on the surface: its specular by the material's own BRDF (a diffuse of zero), its diffuse here (the tint's), the light through the air and the shadow
      '  vec3 sun_seen = sun.color * shadow_factor' + (ENABLE_ATMOSPHERE ? ' * GetLightTransmittance(P, sun_dir, 1.0).xyz' : '') + ';',
      '  Light lit_sun = sun; lit_sun.color = sun_seen;',
      '  vec3 tint = mat.diffuse_color;',
      '  mat.diffuse_color = vec3(0.0);',
      '  mat.direct_color = vec3(0.0);',
      '  apply_surface_shading(mat, lit_sun);',
      '  vec3 spec = mat.direct_color;',
      '  vec3 diffuse = tint * (1.0 / PI) * max(dot(N, sun_dir), 0.0) * sun_seen * (sun.illuminated * sun.attenuation);',
      '  vec3 ambient = vec3(0.0);',
      '  float ambient_scale = FL("AMBIENT_SCALE",0.1,0.0,2.0,0.01);',
      '  for (int i = 0; i < 2; i++) ambient += ambient_lights[i].color * ambient_lights[i].illuminated * tint * ambient_scale;',
      // the mirror: Fresnel (Schlick on the material's f0), the sky the reflected ray finds
      '  vec3 R = reflect(-V, N);',
      '  vec3 sky = u_tr_env;'
    );
    if (ENABLE_ATMOSPHERE) L.push('  vec4 sky_tr = vec4(1.0);', '  sky = GetAtmosphere(P, R, INFINITY, sun_dir, sun_radiance, sky_tr);');
    L.push(
      '  vec3 F = mat.f0 + (1.0 - mat.f0) * pow(1.0 - NdotV, 5.0);',
      '  float rk = u_tr_glass.x * (1.0 - smoothstep(0.5, 0.7, mat.roughness));',
      '  vec3 mirror = sky * F * rk;',
      '  float cover = clamp(o + (1.0 - o) * max(F.x, max(F.y, F.z)) * rk, 0.0, 1.0);',
      '  vec3 C = (diffuse + ambient) * o + mirror + spec;'
    );
    if (ENABLE_ATMOSPHERE) L.push(
      // the air between the camera and the glass: dims what it lights, adds its own light (the scene behind has its own, to its own distance)
      '  float world_scale = smoothstep(0.5, FL("foq_unit",1.0,0.1,4.0,0.1), gl_FragCoord.z) * 5.0 + 1.0;',
      '  vec3 rd = -V;',
      '  vec4 air_tr = vec4(1.0);',
      '  vec3 air = GetAtmosphere(ro, rd, distance(P, ro) * world_scale, sun_dir, sun_radiance, air_tr);',
      '  C = C * air_tr.xyz + air * cover;'
    );
    L.push(
      '  vec3 d = pow(TonemapACES(max(C, vec3(0.0))), vec3(1.0 / 2.2));',
      '  gl_FragColor = vec4(d, cover);',
      '}'
    );
    return L.join('\n');
  };
  transparent.material = function (base, o) {
    if (!base) return null;
    const target = tr_target_mode(), key = target ? "target" : "forward";
    const cache = base.transparent_cache && base.transparent_cache.screen === screen ? base.transparent_cache : (base.transparent_cache = { screen: screen });
    if (cache[key]) return (base.transparent_mat = cache[key]);
    const uniforms = { u_alpha_test: 0, u_tr_env: tr_env, u_tr_glass: tr_glass, u_tr_cut: o && o.cut > 0 ? o.cut : 2 };
    if (!target) { uniforms.u_tr_position = screen.frag_position; uniforms.u_tr_normal = screen.frag_normal; uniforms.u_tr_size = tr_size; }
    if (ENABLE_SHADOWS) for (const k in output_uniforms) if (/^u_(shadow|light_view|cascade)/.test(k)) uniforms[k] = output_uniforms[k];
    // target: the hardware depth test (the engine's default LESS) and the depth write; forward: neither (the canvas has no depth buffer), the shader tests
    const state = target ? { blend: { func: [1, 771] } } : { blend: { func: [1, 771] }, depthMask: false, depthFunc: null };
    const m = engine.materials.clone(base, { shader: transparent_shader(target), uniforms: uniforms, state: state });
    cache[key] = m; base.transparent_mat = m;
    return m;
  };
  // the items, far to near (the ones that have no distance() first)
  function transparent_items() {
    const items = transparent.items;
    if (!items.length) return null;
    tr_size[0] = engine.render_width || 1; tr_size[1] = engine.render_height || 1;
    const e = transparent.environment; tr_env[0] = e[0]; tr_env[1] = e[1]; tr_env[2] = e[2];
    tr_glass[0] = transparent.reflection;
    const order = [], keyed = [];
    for (let i = 0; i < items.length; i++) (typeof items[i].distance === "function" ? keyed : order).push(items[i]);
    if (keyed.length > 1) { const d = new Map(); keyed.forEach(function (it) { d.set(it, it.distance()); }); keyed.sort(function (a, b) { return d.get(b) - d.get(a); }); }
    return order.concat(keyed);
  }
  // mode "target": after the G-buffer pass (its depth is still the frame's), into the transparent target
  function draw_transparent_target() {
    tr_filled = false;
    if (!tr_target_mode()) return;
    const list = transparent_items();
    transparent.drawn = 0;
    if (!list) return;
    engine.push_render_target(tr_rt, false);               // (not cleared with the depth: the depth is the G-buffer's)
    engine.render_clear(GL_COLOR_BUFFER_BIT);
    list.forEach(function (it) { it.render(); transparent.drawn++; });
    engine.pop_render_target();
    tr_filled = transparent.drawn > 0;
  }
  // mode "forward": after the lit image is on the canvas
  function draw_transparent() {
    if (tr_target_mode()) return;
    const list = transparent_items();
    transparent.drawn = 0;
    if (!list) return;
    list.forEach(function (it) { it.render(); transparent.drawn++; });
  }

  function snap_to_shadow_texel(pos, right, up, texel_size) {
    const right_dist = pos[0] * right[0] + pos[1] * right[1] + pos[2] * right[2];
    const up_dist = pos[0] * up[0] + pos[1] * up[1] + pos[2] * up[2];
    const right_delta = Math.round(right_dist / texel_size) * texel_size - right_dist;
    const up_delta = Math.round(up_dist / texel_size) * texel_size - up_dist;
    pos[0] += right[0] * right_delta + up[0] * up_delta;
    pos[1] += right[1] * right_delta + up[1] * up_delta;
    pos[2] += right[2] * right_delta + up[2] * up_delta;
  }

  if (DEBUG) console.log("deffered", screen);
  const spos = [0, 0, 0];
  let shadow_frame = 0;
  engine.on_frame_begin.add(function (time, time_delta) {
    if (screen.enabled == false) {
      // nothing is drawn or accumulated while off: whatever the history / the shadow maps hold is stale when it comes back
      aa_reset = true;
      for (const cascade of screen.cascades) cascade.shadow_dirty = true;
      return;
    }
    aa_begin_frame();
    if (ENABLE_SHADOWS) {
      shadow_frame++;
      const intervals = screen.shadow_interval;
      for (let i = 0; i < screen.cascades.length; i++) {
        const cascade = screen.cascades[i];
        const interval = Math.max(1, Math.floor(intervals && intervals[i]) || 1);
        // a cascade that is not redrawn this frame keeps its camera too, so its map and the matrix the lookup uses stay a pair
        cascade.shadow_active = cascade.shadow_dirty || interval === 1 || (shadow_frame + i) % interval === 0;
        if (!cascade.shadow_active) continue;
        cascade.shadow_dirty = false;

        const scam = cascade.camera;
        engine.tra_model.set_rotation(scam.node, dlight0.world_rotation[0], dlight0.world_rotation[1], dlight0.world_rotation[2], dlight0.world_rotation[3]);


        // Centre the cascade on the camera. The lookup picks a cascade by the distance from the camera (u_cascade_splits = d)
        // and treats anything outside that cascade's window as lit, so the window must contain every point within d of the
        // camera whichever way it faces. It used to be centred d metres AHEAD of the camera, which left the ground beside and
        // behind the camera (about half of it) outside the map: the long shadow of a tall tree simply stopped at the window edge.
        spos[0] = cam.world_position[0];
        spos[1] = cam.world_position[1];
        spos[2] = cam.world_position[2];

        snap_to_shadow_texel(spos, scam.sd_vector, scam.up_vector, cascade.texel_size);

        engine.tra_model.set_position(scam.node, spos[0], spos[1], spos[2]);
      }
    }
  });

  engine.on_frame.add(function (time, time_delta) {

    if (screen.enabled == false) {
      screen.on_frame(time, time_delta);
      screen.on_after_frame(time, time_delta);
      return;
    }


    engine.push_render_target(screen, true);
    screen.on_frame(time, time_delta);


    if (ENABLE_SHADOWS) {
      for (let i = 0; i < screen.cascades.length; i++) {
        const cascade = screen.cascades[i];
        if (!cascade.shadow_active) continue;
        engine.push_render_target(cascade);
        engine.push_camera(cascade.camera);
        engine.render_clear(GL_DEPTH_BUFFER_BIT);

        screen.on_shadowmap(time, time_delta, cascade, i);


        engine.pop_camera();
        engine.pop_render_target();
      }
    }

    engine.pop_render_target();
    draw_transparent_target();                            // (mode "target": into the transparent target, before the lit image is resolved)
    aa_resolve();
    draw_transparent();                                   // (mode "forward": over the resolved frame)
    screen.on_after_frame(time, time_delta);

  });

  return screen;
}

// correctly spelled alias
engine.deferred_rendering = engine.deffered_rendering;
