const shaders = {};


shaders.noise = function (seedx, seedy) {
	seedx = seedx || Math.random() * 256;
	seedy = seedy || Math.random() * 256;
	seedx = 1024; seedy = 512;
	const setup_seed = function () {
		return `
void setup_seed(){
	seed.x=float(${(seedx)});
	seed.y=float(${(seedy)});
}`;
	};
	return `

vec2 seed;

vec2 hash(vec2 p)
{
    p = vec2( dot(p,vec2(127.1,311.7)+seed),
			  dot(p,vec2(269.5,183.3)));

    //return normalize(-1.0 + 2.0 * fract(sin(p)*43758.5453123));
    return -1.0 + 2.0 * fract(sin(p)*43758.5453123);
}

// Requires WebGL2 ( #version 300 es )
vec2 hashi(vec2 p) {
    uvec2 q = floatBitsToUint(p);

    // Hash bit-mixing operations
    q = 1103515245U * ((q >> 1U) ^ (q.yx));
    uint n = 1103515245U * ((q.x) ^ (q.y >> 3U));

    // Convert back to float [-1.0, 1.0] range
    vec2 f = vec2(n, n * 16807U) * (1.0 / float(0xffffffffU));
    return -1.0 + 2.0 * f;
}

float noise(in vec2 p )
{
  vec2 i = floor( p );
  vec2 f = fract( p );
	vec2 u = f*f*(3.0-2.0*f);
    return mix( mix( dot( hash( i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ),
                     dot( hash( i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                mix( dot( hash( i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ),
                     dot( hash( i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y)*2.;
}

vec3 noised( in vec2 p )
{
  vec2 i = floor( p );
  vec2 f = fract( p );
	vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  vec2 du = 30.0*f*f*(f*(f-2.0)+1.0);
  vec2 ga = hash( i + vec2(0.0,0.0) );
  vec2 gb = hash( i + vec2(1.0,0.0) );
  vec2 gc = hash( i + vec2(0.0,1.0) );
  vec2 gd = hash( i + vec2(1.0,1.0) );
  float va = dot( ga, f - vec2(0.0,0.0) );
  float vb = dot( gb, f - vec2(1.0,0.0) );
  float vc = dot( gc, f - vec2(0.0,1.0) );
  float vd = dot( gd, f - vec2(1.0,1.0) );
  return vec3( va + u.x*(vb-va) + u.y*(vc-va) + u.x*u.y*(va-vb-vc+vd),
                ga + u.x*(gb-ga) + u.y*(gc-ga) + u.x*u.y*(ga-gb-gc+gd) +
                du * (u.yx*(va-vb-vc+vd) + vec2(vb,vc) - va));
}


float noise_type(vec2 d, int type) {
  float d2 = dot(d, d);
if(type==0) {
	return 1.0;
}
else if(type==1) {
	return 1.0 / (1.0 + d2);
}
else if(type==2) {
	 return (1.0 -abs( 1.0 / (1.0 + d2)));
}
else if(type==3) {
	 return 1.0 / (1.0 + pow(d2, 8.0));
}
else if(type==4) {
	return 1.0 / (1.0 + pow(d2, 0.5));
}
else if(type==5) {
	return exp(-d2);
}
else if(type==6) {
	return exp(-2.0 * pow(d2, 2.0));
}

}
const mat2 m2=mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 x,int type, int oct, float  lacunarity,float persistence,float frequency, float amplitude){
  vec2 p0 = x*frequency;
  float a = 0.0;
  float b =amplitude;
  vec2  d = vec2(0.0);
  for (int i = 0; i < 12; i++) {
		if(i>oct-1) break;
    vec3 n = noised(p0);
    // Accumulate derivative
    // (Interesting there is no b*, but with b* it also creates decent results)
    d += n.yz;
    // Accumulate height
    a += b * n.x * noise_type(d, type);
    b *= persistence;
    // This rotation here is to decorlate different octaves of
    // the noised, as it is of poor quality.
    p0 = m2 * p0 * lacunarity;
  }
  return a;
}

float fbm(vec2 x,int oct){
	return fbm(x,0,oct,2.0,0.5,1.0,1.0);
}
float fbm(vec2 x,int oct,float freq){
	return fbm(x,0,oct,2.0,0.5,freq,1.0);
}
float fbm(vec2 x,int type,int oct, float  lacunarity,float persistence, float frequency,float amplitude,float warp_freq,float warp_amp){


			vec2 q = vec2(fbm(x,4,warp_freq),fbm(x + vec2(5.2,1.3),4,warp_freq));
			vec2 r = vec2(fbm(x+2.0*q+vec2(1.7,9.2),4,warp_freq),fbm(x+2.0*q+vec2(8.3,2.8),4,warp_freq));


return fbm(mix(x,r,warp_amp),type,oct,lacunarity,persistence,frequency,amplitude);
}


float mountains(vec2 p, int octaves, float lacunarity , float gain ,float warp )
{

     float sum = 0.0;
     float freq = 1.0, amp = 1.0;
     vec2 dsum = vec2(0,0);
     for(int i=0; i < 8; i++)
     {
         vec3 n = noised((p + warp * dsum)*freq);
         sum += amp * (1.0 - abs(n.x));
         dsum += amp * n.yz * -n.x;
         freq *= lacunarity;
         amp *= gain * saturate(sum);
    }
    return sum*0.5;
}


float noi(vec2 uv){
	return min(1.0,max(0.0,smoothstep(0.5,-1.0,(fbm( uv,0,4,2.1,0.5,1.0,1.0 ))*2.0)));
}

float noi(vec2 uv,int type,int oct, float  lacunarity,float persistence){
float i=fbm( uv,type,4,lacunarity,persistence,1.0,1.0 )+0.5;
return min(1.0,max(i,0.0));
}

float noi2(vec2 uv,int type,int oct, float  lacunarity,float persistence){

	return min(1.0,max(0.0,smoothstep(0.5,-0.5,(fbm( uv,type,oct,lacunarity,persistence,1.0,1.0 ))*1.8)));
}

float rand_seed(vec2 uv, float seed)
{
    float xx = mod((uv.x * 20860.0), 65536.0) * 100.0;
    float yy = mod((uv.y * 20860.0), 65536.0) * 100.0;
    xx = floor((xx * 40501.0) / 65536.0);
    xx /= 65536.0;
    yy /= 65536.0;
    xx += seed;
    return fract(xx * yy * (xx+yy) + xx + yy);
}



// WebGL-Safe Modulo for seamless negative wrapping
vec2 safe_mod(vec2 x, float y) {
    return mod(mod(x, y) + y, y);
}

// 1. Analytical Derivative Noise (Seamless)
// Returns: vec3( value, derivative_X, derivative_Y )
vec3 seamless_noised( in vec2 p, in float period ) {
    vec2 i = floor( p );
    vec2 f = fract( p );

    // Quintic interpolant & derivative (from your shaders.js)
    vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
    vec2 du = 30.0*f*f*(f*(f-2.0)+1.0);

    // WRAP INTEGER BOUNDARIES PERFECTLY
    vec2 i0 = safe_mod(i + vec2(0.0, 0.0), period);
    vec2 i1 = safe_mod(i + vec2(1.0, 0.0), period);
    vec2 i2 = safe_mod(i + vec2(0.0, 1.0), period);
    vec2 i3 = safe_mod(i + vec2(1.0, 1.0), period);

    vec2 ga = hash( i0 );
    vec2 gb = hash( i1 );
    vec2 gc = hash( i2 );
    vec2 gd = hash( i3 );

    float va = dot( ga, f - vec2(0.0,0.0) );
    float vb = dot( gb, f - vec2(1.0,0.0) );
    float vc = dot( gc, f - vec2(0.0,1.0) );
    float vd = dot( gd, f - vec2(1.0,1.0) );

    return vec3( va + u.x*(vb-va) + u.y*(vc-va) + u.x*u.y*(va-vb-vc+vd),
                 ga + u.x*(gb-ga) + u.y*(gc-ga) + u.x*u.y*(ga-gb-gc+gd) +
                 du * (u.yx*(va-vb-vc+vd) + vec2(vb,vc) - va));
}

// 2. Seamless FBM accumulating analytical derivatives
vec3 seamless_fbm_d(vec2 p, float period, int octaves) {
    float a = 0.0;
    float b = 0.5;
    vec2 d = vec2(0.0);
    float freq = 1.0;

    for (int i = 0; i < 4; i++) {
        if (i >= octaves) break;

        vec3 n = seamless_noised(p * freq, period * freq);

        // Accumulate analytical derivatives (chain rule applied via freq)
        d += n.yz * b * freq;
        a += b * n.x;

        b *= 0.5;
        freq *= 2.0;
        // CRITICAL: No matrix rotation here! Rotation breaks seamless tiling.
    }
    return vec3(a, d.x, d.y);
}
${(setup_seed())}
`
};

shaders.rgba_packing = function () {
	return `
const float depth_16_1= (256.0*256.0 - 1.0) / (256.0*256.0);
		const vec3 depth_16_2 =vec3(1.0, 256.0, 256.0*256.0);
		const float depth_16_3=256.0 + 1.0/512.0;

		vec2 rgba_packing_depth_16( in highp float depth )
		{
				float depthVal = depth * depth_16_1;
				vec3 encode = fract( depthVal * depth_16_2 );
				return encode.xy - encode.yz / depth_16_3;
		}

		const vec2 undepth_16_1=1.0 / vec2(1.0, 256.0);
		const float undepth_16_2=(256.0*256.0) / (256.0*256.0 - 1.0);

		float rgba_packing_undepth_16( in highp vec2 pack )
		{
				return dot(pack, undepth_16_1) *undepth_16_2;
		}



`
}


shaders.heightmap = function (width, height) {
	height = height || width;
	return `
uniform sampler2D u_heightmap;
const vec2 heightmap_texel=vec2(1.0/float(${(width)}),1.0/float(${(height)}));


float heightmap_height16(vec2 v){
	vec2 hei=texture2D(u_heightmap,v).xy;
	return (((hei.x) + ((hei.y) * 0.00390625)) * 1.0000152590218967);
}

float heightmap_height16zw(vec2 v){
	vec2 hei=texture2D(u_heightmap,v).zw;
	return (((hei.x) + ((hei.y) * 0.00390625)) * 1.0000152590218967);
}

float heightmap_float(vec2 hei){
	return (((hei.x) + ((hei.y) * 0.00390625)) * 1.0000152590218967);
}

float heightmap_height8(vec2 v){
	return texture2D(u_heightmap,v).r;
}
float heightmap_height8(sampler2D heightmap,vec2 v){
	return texture2D(heightmap,v).r;
}
float heightmap_sheight8(vec2 v){
	vec2 pixel_pos = v / heightmap_texel + vec2(0.5);
	vec2 frac_part = fract(pixel_pos);
	vec2 start_texel = (pixel_pos - frac_part) * heightmap_texel;
	float blTexel = heightmap_height8(start_texel);
	float brTexel = heightmap_height8(start_texel + vec2(heightmap_texel.x, 0.0));
	float tlTexel = heightmap_height8(start_texel + vec2(0.0, heightmap_texel.y));
	float trTexel = heightmap_height8(start_texel + heightmap_texel);
	return mix(mix(blTexel, tlTexel, frac_part.y),mix(brTexel, trTexel, frac_part.y),frac_part.x);
}
float heightmap_sheight8(sampler2D heightmap,vec2 v){
vec2 heightmap_texel=1.0/vec2(textureSize(heightmap,0));
	vec2 pixel_pos = v / heightmap_texel + vec2(0.5);
	vec2 frac_part = fract(pixel_pos);
	vec2 start_texel = (pixel_pos - frac_part) * heightmap_texel;
	float blTexel = heightmap_height8(heightmap,start_texel);
	float brTexel = heightmap_height8(heightmap,start_texel + vec2(heightmap_texel.x, 0.0));
	float tlTexel = heightmap_height8(heightmap,start_texel + vec2(0.0, heightmap_texel.y));
	float trTexel = heightmap_height8(heightmap,start_texel + heightmap_texel);
	return mix(mix(blTexel, tlTexel, frac_part.y),mix(brTexel, trTexel, frac_part.y),frac_part.x);
}


float heightmap_sheight16(vec2 v){
	vec2 pixel_pos = v / heightmap_texel + vec2(0.5);
	vec2 frac_part = fract(pixel_pos);
	vec2 start_texel = (pixel_pos - frac_part) * heightmap_texel;
	float blTexel = heightmap_height16(start_texel);
	float brTexel = heightmap_height16(start_texel + vec2(heightmap_texel.x, 0.0));
	float tlTexel = heightmap_height16(start_texel + vec2(0.0, heightmap_texel.y));
	float trTexel = heightmap_height16(start_texel + heightmap_texel);
	return mix(mix(blTexel, tlTexel, frac_part.y),mix(brTexel, trTexel, frac_part.y),frac_part.x);
}


float heightmap_sheight16zw(vec2 v){
	vec2 pixel_pos = v / heightmap_texel + vec2(0.5);
	vec2 frac_part = fract(pixel_pos);
	vec2 start_texel = (pixel_pos - frac_part) * heightmap_texel;
	float blTexel = heightmap_height16zw(start_texel);
	float brTexel = heightmap_height16zw(start_texel + vec2(heightmap_texel.x, 0.0));
	float tlTexel = heightmap_height16zw(start_texel + vec2(0.0, heightmap_texel.y));
	float trTexel = heightmap_height16zw(start_texel + heightmap_texel);
	return mix(mix(blTexel, tlTexel, frac_part.y),mix(brTexel, trTexel, frac_part.y),frac_part.x);
}

vec4 heightmap_height(sampler2D tex,vec2 v){
	vec2 pixel_pos = v / heightmap_texel + vec2(0.5);
	vec2 frac_part = fract(pixel_pos);
	vec2 start_texel = (pixel_pos - frac_part) * heightmap_texel;
	vec4 blTexel = texture2D(tex,start_texel);
	vec4 brTexel = texture2D(tex,start_texel + vec2(heightmap_texel.x, 0.0));
	vec4 tlTexel = texture2D(tex,start_texel + vec2(0.0, heightmap_texel.y));
	vec4 trTexel = texture2D(tex,start_texel + heightmap_texel);
	return mix(mix(blTexel, tlTexel, frac_part.y),mix(brTexel, trTexel, frac_part.y),frac_part.x);
}


vec4 heightmap_height_bary(sampler2D tex,vec2 v){
	vec2 pixel_pos = v / heightmap_texel + vec2(0.5);
	vec2 frac_part = fract(pixel_pos);
	vec2 start_texel = (pixel_pos - frac_part) * heightmap_texel;
	vec4 blTexel = texture2D(tex,start_texel);
	vec4 brTexel = texture2D(tex,start_texel + vec2(heightmap_texel.x, 0.0));
	vec4 tlTexel = texture2D(tex,start_texel + vec2(0.0, heightmap_texel.y));
	vec4 trTexel = texture2D(tex,start_texel + heightmap_texel);


// Calculate both possible results
    vec4 lowerTriangle = blTexel + frac_part.x * (brTexel - blTexel) + frac_part.y * (tlTexel - blTexel);
    vec4 upperTriangle = trTexel + (1.0 - frac_part.x) * (tlTexel - trTexel) + (1.0 - frac_part.y) * (brTexel - trTexel);

    // Determine which side of the diagonal we are on
    // returns 0.0 if tx + tz <= 1.0, and 1.0 if tx + tz > 1.0
    float side = step(1.0, frac_part.x + frac_part.y);

    // Mix between the two based on the side
    return mix(lowerTriangle, upperTriangle, side);



}

vec4 heightmap_height_bary(vec2 v){
	return heightmap_height_bary(u_heightmap,v);
}

vec4 heightmap_height(vec2 v){
	return heightmap_height(u_heightmap,v);
}

vec4 heightmap_get_texel(vec2 v){
	return texture2D(u_heightmap,v);
}


vec3 heightmap_normal16(vec2 v_uv,float ds){
	vec3 off = vec3(heightmap_texel,0.0);
	return normalize(vec3(
	ds*heightmap_height16(v_uv - off.xz) - ds*heightmap_height16(v_uv + off.xz),
	2.0,
	ds*heightmap_height16(v_uv - off.zy) -  ds*heightmap_height16(v_uv + off.zy)
	));
}

vec3 heightmap_normal16zw(vec2 v_uv,float ds){
	vec3 off = vec3(heightmap_texel,0.0);
	return normalize(vec3(
	ds*heightmap_height16zw(v_uv - off.xz) - ds*heightmap_height16zw(v_uv + off.xz),
	2.0,
	ds*heightmap_height16zw(v_uv - off.zy) -  ds*heightmap_height16zw(v_uv + off.zy)
	));
}


vec3 heightmap_normal8(vec2 v_uv,float ds){
	vec3 off = vec3(heightmap_texel,0.0);
	return normalize(vec3(
	ds*heightmap_height8(v_uv - off.xz) - ds*heightmap_height8(v_uv + off.xz),
	2.0,
	ds*heightmap_height8(v_uv - off.zy) -  ds*heightmap_height8(v_uv + off.zy)
	));
}



vec3 heightmap_normal8(sampler2D heightmap,vec2 v_uv,float ds){
vec2 heightmap_texel=1.0/vec2(textureSize(heightmap,0));

	vec3 off = vec3(heightmap_texel,0.0);
	return normalize(vec3(
	ds*heightmap_height8(heightmap,v_uv - off.xz) - ds*heightmap_height8(heightmap,v_uv + off.xz),
	2.0,
	ds*heightmap_height8(heightmap,v_uv - off.zy) -  ds*heightmap_height8(heightmap,v_uv + off.zy)
	));
}


vec3 heightmap_snormal16(vec2 v_uv,float ds){

	vec3 off = vec3(heightmap_texel,0.0);
	return normalize(vec3(
	ds*heightmap_sheight16(v_uv - off.xz) - ds*heightmap_sheight16(v_uv + off.xz),
	2.0,
	ds*heightmap_sheight16(v_uv - off.zy) -  ds*heightmap_sheight16(v_uv + off.zy)
	));

}

vec3 heightmap_snormal8(vec2 v_uv,float ds){
	vec3 off = vec3(heightmap_texel,0.0);
	return normalize(vec3(
	ds*heightmap_sheight8(v_uv - off.xz) - ds*heightmap_sheight8(v_uv + off.xz),
	2.0,
	ds*heightmap_sheight8(v_uv - off.zy) -  ds*heightmap_sheight8(v_uv + off.zy)
	));
}

vec3 heightmap_snormal8(sampler2D heightmap,vec2 v_uv,float ds){
vec2 heightmap_texel=1.0/vec2(textureSize(heightmap,0));
	vec3 off = vec3(heightmap_texel,0.0);
	return normalize(vec3(
	ds*heightmap_sheight8(heightmap,v_uv - off.xz) - ds*heightmap_sheight8(heightmap,v_uv + off.xz),
	2.0,
	ds*heightmap_sheight8(heightmap,v_uv - off.zy) -  ds*heightmap_sheight8(heightmap,v_uv + off.zy)
	));
}
`
};

shaders.texture_sampler = function () {
	return `
vec4 texture_sampler_pcfx3(sampler2D tex, vec2 coords,vec2 texel_size)
{
	const float NUM_SAMPLES = 3.0;
	const float SAMPLES_START = (NUM_SAMPLES - 1.0) / 2.0;
	const float NUM_SAMPLES_SQUARED = NUM_SAMPLES * NUM_SAMPLES;
	vec4 result = vec4(0.0);
	for (float y = -SAMPLES_START; y <= SAMPLES_START; y += 1.0)
	{
		for (float x = -SAMPLES_START; x <= SAMPLES_START; x += 1.0)
		{
			vec2 coordsOffset = vec2(x, y) * texel_size;
			result += texture2D(tex,coords + coordsOffset);
		}
	}
	return result / NUM_SAMPLES_SQUARED;
}

vec4 texture_sampler_pcfx6(sampler2D tex, vec2 coords,vec2 texel_size)
{
	const float NUM_SAMPLES = 6.0;
	const float SAMPLES_START = (NUM_SAMPLES - 1.0) / 2.0;
	const float NUM_SAMPLES_SQUARED = NUM_SAMPLES * NUM_SAMPLES;
	vec4 result = vec4(0.0);
	for (float y = -SAMPLES_START; y <= SAMPLES_START; y += 1.0)
	{
		for (float x = -SAMPLES_START; x <= SAMPLES_START; x += 1.0)
		{
			vec2 coordsOffset = vec2(x, y) * texel_size;
			result += texture2D(tex,coords + coordsOffset);
		}
	}
	return result / NUM_SAMPLES_SQUARED;
}

`;
}

shaders.float_compare = function () {

	return `
float float_eq(float x, float y) {
  return 1.0 - abs(sign(x - y));
}

float float_neq(float x, float y) {
  return abs(sign(x - y));
}

float float_gt(float x, float y) {
  return max(sign(x - y), 0.0);
}

float float_lt(float x, float y) {
  return max(sign(y - x), 0.0);
}

float float_ge(float x, float y) {
  return 1.0 - float_lt(x, y);
}

float float_le(float x, float y) {
  return 1.0 - float_gt(x, y);
}

`
};

shaders.bicubic_height = function () {
	return `
float catmullRom(float p0, float p1, float p2, float p3, float t) {
    float t2 = t * t;
    float t3 = t2 * t;
    return 0.5 * (
        (2.0 * p1) +
        (-p0 + p2) * t +
        (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 +
        (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
    );
}
float fetchHeight(sampler2D tex, vec2 pixelIndex, vec2 textureSize) {
    // Add 0.5 to sample the exact center of the texel
    vec2 uv = (pixelIndex + 0.5) / textureSize;
    return texture(tex, uv).r;
}

// 2D Bicubic Interpolation
float get_bicubic_height(sampler2D tex, vec2 uv, vec2 textureSize) {
    vec2 pixelPos = uv * textureSize - 0.5;
    vec2 i = floor(pixelPos);
    vec2 f = fract(pixelPos);

    // Read a 4x4 grid of pixels around our target
    // We calculate 4 horizontal splines first
    float row0 = catmullRom(
        fetchHeight(tex, i + vec2(-1.0, -1.0), textureSize),
        fetchHeight(tex, i + vec2( 0.0, -1.0), textureSize),
        fetchHeight(tex, i + vec2( 1.0, -1.0), textureSize),
        fetchHeight(tex, i + vec2( 2.0, -1.0), textureSize),
        f.x
    );

    float row1 = catmullRom(
        fetchHeight(tex, i + vec2(-1.0, 0.0), textureSize),
        fetchHeight(tex, i + vec2( 0.0, 0.0), textureSize),
        fetchHeight(tex, i + vec2( 1.0, 0.0), textureSize),
        fetchHeight(tex, i + vec2( 2.0, 0.0), textureSize),
        f.x
    );

    float row2 = catmullRom(
        fetchHeight(tex, i + vec2(-1.0, 1.0), textureSize),
        fetchHeight(tex, i + vec2( 0.0, 1.0), textureSize),
        fetchHeight(tex, i + vec2( 1.0, 1.0), textureSize),
        fetchHeight(tex, i + vec2( 2.0, 1.0), textureSize),
        f.x
    );

    float row3 = catmullRom(
        fetchHeight(tex, i + vec2(-1.0, 2.0), textureSize),
        fetchHeight(tex, i + vec2( 0.0, 2.0), textureSize),
        fetchHeight(tex, i + vec2( 1.0, 2.0), textureSize),
        fetchHeight(tex, i + vec2( 2.0, 2.0), textureSize),
        f.x
    );

    // Finally, interpolate vertically between the 4 horizontal splines
    return catmullRom(row0, row1, row2, row3, f.y);
}

float get_bicubic_height2(sampler2D tex, vec2 uv, vec2 textureSize) {
    vec2 pixelPos = uv * textureSize - 0.5;
    vec2 i = floor(pixelPos);
    vec2 f = fract(pixelPos);
float s1=2.0;
float s2=s1*2.0;

    // Read a 4x4 grid of pixels around our target
    // We calculate 4 horizontal splines first
    float row0 = catmullRom(
        fetchHeight(tex, i + vec2(-s1, -s1), textureSize),
        fetchHeight(tex, i + vec2( 0.0, -s1), textureSize),
        fetchHeight(tex, i + vec2( s1, -s1), textureSize),
        fetchHeight(tex, i + vec2( s2, -s1), textureSize),
        f.x
    );

    float row1 = catmullRom(
        fetchHeight(tex, i + vec2(-s1, 0.0), textureSize),
        fetchHeight(tex, i + vec2( 0.0, 0.0), textureSize),
        fetchHeight(tex, i + vec2( s1, 0.0), textureSize),
        fetchHeight(tex, i + vec2( s2, 0.0), textureSize),
        f.x
    );

    float row2 = catmullRom(
        fetchHeight(tex, i + vec2(-s1, s1), textureSize),
        fetchHeight(tex, i + vec2( 0.0, s1), textureSize),
        fetchHeight(tex, i + vec2(s1, s1), textureSize),
        fetchHeight(tex, i + vec2( s2, s1), textureSize),
        f.x
    );

    float row3 = catmullRom(
        fetchHeight(tex, i + vec2(-s1, s2), textureSize),
        fetchHeight(tex, i + vec2( 0.0, s2), textureSize),
        fetchHeight(tex, i + vec2( s1, s2), textureSize),
        fetchHeight(tex, i + vec2( s2, s2), textureSize),
        f.x
    );

    // Finally, interpolate vertically between the 4 horizontal splines
    return catmullRom(row0, row1, row2, row3, f.y);
}


float biome_spline(float t,float ocean_floor,float low_plains,float rolling_hills,float mountain_peaks) {

    // These are our macroscopic world elevations.
    // Notice how it stays flat at 0.1 for a while (plains), then abruptly shoots to 0.8 (mountains)
    const int NUM_POINTS = 6;
    float points[NUM_POINTS];
    points[0] = -0.2; // Guide point (Invisible, used for math)
    points[1] =ocean_floor;
    points[2] =low_plains;
    points[3] = rolling_hills;
    points[4] = mountain_peaks;
    points[5] = 1.0;  // Guide point (Invisible, used for math)



    // We have 6 points, which gives us 3 valid segments (between points 1-2, 2-3, 3-4)
    float scaledT = clamp(t, 0.0, 0.999) * float(NUM_POINTS - 3);

    // Find which segment we are in
    int i = int(floor(scaledT));

    // Find our local t value inside that specific segment
    float localT = fract(scaledT);

    // Because GLSL ES requires constant indices in some older compilers,
    // we use a safe fetch loop or unroll it. For WebGL2, dynamic indexing is fine.
    float p0 = points[i];
    float p1 = points[i + 1];
    float p2 = points[i + 2];
    float p3 = points[i + 3];

    return catmullRom(p0, p1, p2, p3, localT);
}


`;

};

shaders.pbr = function () {

  return `
// --- PBR FUNCTIONS ---
float DistributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float denom = (NdotH * NdotH * (a2 - 1.0) + 1.0);
    return a2 / max(PI * denom * denom, 0.0001);
}

float GeometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
}

float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    return GeometrySchlickGGX(max(dot(N, V), 0.0), roughness) *
           GeometrySchlickGGX(max(dot(N, L), 0.0), roughness);
}

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec3 CalculatePBR(vec3 N, vec3 V, vec3 L, vec3 radiance, vec3 albedo, float roughness, float metallic) {
    vec3 H = normalize(V + L);
    vec3 F0 = mix(vec3(0.04), albedo, metallic);

    float NDF = DistributionGGX(N, H, roughness);
    float G   = GeometrySmith(N, V, L, roughness);
    vec3 F    = fresnelSchlick(max(dot(H, V), 0.0), F0);

    vec3 numerator    = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
    vec3 specular     = numerator / denominator;

    vec3 kD = (vec3(1.0) - F) * (1.0 - metallic);
    float NdotL = max(dot(N, L), 0.0);

    return (kD * albedo / PI + specular) * radiance * NdotL;
}
`

    ;
}

shaders.hash33 = function () {

	return `
const float h33DDD=(1.0 / 4294967295.0);
vec3 hash33(vec3 p){
	uvec3 v = uvec3(round(p));
	v.x ^= 1103515245U;
	v.y ^= v.x + v.z;
	v.y = v.y * 134775813U;
	v.z += v.x ^ v.y;
	v.y += v.x ^ v.z;
	v.x += v.y * v.z;
	v.x = v.x * 668265261U;
	v.z ^= v.x << 3;
	v.y += v.z << 3;
	return vec3(v) * h33DDD;
}`
};

shaders.math2d = function () {

	return `
#ifndef MATH2D
#define MATH2D
vec2 math2d_rotate(float x, float y, float r) {
	float c = cos(r);
	float s = sin(r);
	return vec2(x * c - y * s, x * s + y * c);
}
#endif
`
};

shaders.atmosphere = function () {
  return `


#define DRAW_PLANET
#define PREVENT_CAMERA_GROUND_CLIP
#define LIGHT1_COLOR_IS_RADIANCE
// VITAL FIX: Disabled the fake ambient night glow so the sky goes pitch black
#define NIGHT_LIGHT   0.0
#define INFINITY 3.402823466e38

#define C_RAYLEIGH        (vec3(5.802, 13.558, 33.100) * 1e-6)
#define C_MIE             (vec3(3.996, 3.996, 3.996) * 1e-6)
#define C_OZONE           (vec3(0.650, 1.881, 0.085) * 1e-6)
//#define ATMOSPHERE_HEIGHT 220000.0
#define PLANET_RADIUS 6272000.0*1.0

#define ATMOSPHERE_HEIGHT 60000.0

#define M_TRANSMITTANCE       0.75
#define M_LIGHT_TRANSMITTANCE 1e6
#define M_MIN_LIGHT_ELEVATION -0.4

#define RAYLEIGH_MAX_LUM 1.0
#define MIE_MAX_LUM 0.25
#define M_DENSITY_HEIGHT_MOD  1e-12
#define M_DENSITY_CAM_MOD     10.0

const vec3 PLANET_CENTER = vec3(0, -PLANET_RADIUS, 0);

float SUN_DISC_SIZE;
float AERIAL_SCALE;
float EXPOSURE;
float DENSITY;

// --- MATH UTILS ---
float sq(float x) { return x*x; }
float pow4(float x) { return sq(x)*sq(x); }
float pow8(float x) { return pow4(x)*pow4(x); }

float hashOld12(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}



// --- ATMOSPHERE FUNCTIONS ---
vec2 SphereIntersection(vec3 rayStart, vec3 rayDir, vec3 sphereCenter, float sphereRadius) {
    vec3 oc = rayStart - sphereCenter;
    float b = dot(oc, rayDir);
    float c = dot(oc, oc) - sq(sphereRadius);
    float h = sq(b) - c;
    if (h < 0.0) return vec2(-1.0, -1.0);
    h = sqrt(h);
    return vec2(-b-h, -b+h);
}

vec2 PlanetIntersection(vec3 rayStart, vec3 rayDir) {
    return SphereIntersection(rayStart, rayDir, PLANET_CENTER, PLANET_RADIUS);
}

vec2 AtmosphereIntersection(vec3 rayStart, vec3 rayDir) {
    return SphereIntersection(rayStart, rayDir, PLANET_CENTER, PLANET_RADIUS + ATMOSPHERE_HEIGHT);
}

float PhaseR(float costh) { return (1.0+sq(costh))*0.06; }
float PhaseM(float costh, float g) {
    float k = 1.55*g-0.55*sq(g)*g;
    return (1.0-sq(k)) / (12.57*sq(1.0-k*costh));
}

vec3 GetLightTransmittance(vec3 position, vec3 lightDir, float multiplier) {
    float lightExtinctionAmount = pow8(smoothstep(1.0, M_MIN_LIGHT_ELEVATION, lightDir.y));
    return exp(-(C_RAYLEIGH + C_MIE + C_OZONE) * lightExtinctionAmount * DENSITY * multiplier * M_LIGHT_TRANSMITTANCE);
}

void GetRayleighMie(float opticalDepth, float densityR, float densityM, out vec3 R, out vec3 M) {
    R = (1.0 - exp(-opticalDepth * densityR * C_RAYLEIGH / RAYLEIGH_MAX_LUM)) * RAYLEIGH_MAX_LUM;
    M = (1.0 - exp(-opticalDepth * densityM * C_MIE / MIE_MAX_LUM)) * MIE_MAX_LUM;
}

vec3 GetAtmosphere(vec3 rayStart, vec3 rayDir, float rayLength, vec3 lightDir, vec3 lightColor, out vec4 transmittance) {
    vec2 t1 = PlanetIntersection(rayStart, rayDir);
    vec2 t2 = AtmosphereIntersection(rayStart, rayDir);
    float normAltitude = rayStart.y / ATMOSPHERE_HEIGHT;

    if (t2.y < 0.0) {
        transmittance = vec4(1, 1, 1, 0);
        return vec3(0);
    }

    t2.y -= max(0.0, t2.x);
    float opticalDepth = t1.x > 0.0 ? min(t1.x, t2.y) : t2.y;
    opticalDepth = min(rayLength, opticalDepth);
    opticalDepth = min(opticalDepth * AERIAL_SCALE, t2.y);

    float h = 1.0-1.0/(2.0+sq(t2.y)*M_DENSITY_HEIGHT_MOD);
    h = pow(h, 1.0+normAltitude*M_DENSITY_CAM_MOD);
    float sqh = sq(h);
    float densityR = sqh * DENSITY;
    float densityM = sq(sqh)*h * DENSITY;

    lightColor *= GetLightTransmittance(rayStart, lightDir, h);

    vec3 R, M;
    GetRayleighMie(opticalDepth, densityR, densityM, R, M);

    float costh = dot(rayDir, lightDir);
    vec3 A = PhaseR(costh) * lightColor + NIGHT_LIGHT;
    vec3 B = PhaseM(costh, 0.85) * lightColor + NIGHT_LIGHT;
    vec3 C = (C_RAYLEIGH * densityR + C_MIE * densityM + C_OZONE * densityR) * pow4(1.0 - normAltitude) * M_TRANSMITTANCE;

    transmittance.xyz = exp(-opticalDepth * C);

    // transmittance.w is 0 if the ray hits the planet, 1 if it goes into space
    transmittance.w = step(t1.x, 0.0);

    return (R * A + M * B) * EXPOSURE;
}



vec3 TonemapACES(vec3 color) {
    const float a = 2.51; const float b = 0.03; const float c = 2.43;
    const float d = 0.59; const float e = 0.14;
    return (color * (a * color + b)) / (color * (c * color + d) + e);
}
float GetDisc(vec3 rayDir, vec3 lightDir, float size_degrees) {
    // Convert size from degrees to radians
    float ang = size_degrees * (PI / 180.0);
    float A = cos(ang);
    float costh = dot(rayDir, lightDir);

    // Fade from slightly outside the boundary (A - 0.0002) to the boundary (A).
    // This guarantees everything closer to the center (costh > A) is a solid 1.0.
    return smoothstep(A - 0.0003, A, costh);
}
`
}
