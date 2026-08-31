/**
 * The cloud field, as a fragment shader.
 *
 * ## Why the source is written here rather than vendored
 *
 * Aceternity distributes Cloud Shader through `npx shadcn add
 * @aceternity/cloud-shader` — the source is not published on the component
 * page, so there is nothing to copy. What IS published is the contract: soft
 * procedural clouds drifting across a sky, tuned by speed, count, and three
 * colours. That is the effect this reproduces, written from scratch. The
 * result is a component with no licence question attached to it at all.
 *
 * ## How it works
 *
 * Fractal Brownian motion: value noise summed over octaves, each half the
 * amplitude and twice the frequency of the last. That single idea is what
 * turns a smooth blob field into something with the self-similar wispiness of
 * cloud. `count` is the octave count, so it is genuinely "how much detail",
 * not a number of sprites.
 *
 * The clouds are lit rather than flat: sampling the density field slightly
 * toward the sun and taking the difference gives a cheap directional gradient,
 * which is what stops the result reading as grey smoke.
 */
export const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_octaves;
uniform float u_coverage;
uniform vec3  u_cloud;
uniform vec3  u_skyTop;
uniform vec3  u_skyBottom;

out vec4 fragColor;

/*
  Hash and value noise. A texture would be faster and would also be an asset to
  ship, load, and cache-bust; this is a page background, and an arithmetic hash
  costs less than the request would.
*/
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  /* Quintic rather than smoothstep: continuous second derivative, so the
     octaves stack without visible grid creases. */
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  /*
    Rotate between octaves. Without it every layer shares an axis and the sum
    shows the lattice as faint diagonal banding — the single most common tell
    of hand-rolled noise.
  */
  mat2 rotate = mat2(0.8, 0.6, -0.6, 0.8);

  for (int i = 0; i < 8; i++) {
    if (float(i) >= u_octaves) break;
    value += amplitude * noise(p);
    p = rotate * p * 2.02;
    amplitude *= 0.5;
  }
  return value;
}

/* Density at a point, drifting on the wind. */
float clouds(vec2 uv, float time) {
  vec2 wind = vec2(time * 0.05, time * 0.012);
  float base = fbm(uv * 2.5 + wind);
  /* Warping the lookup by more noise is what gives the billow its curl. */
  float warp = fbm(uv * 1.4 + base * 0.6 - wind * 0.4);
  return smoothstep(u_coverage, u_coverage + 0.42, base * 0.65 + warp * 0.55);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  /* Aspect-correct, or the clouds stretch on a wide viewport. */
  vec2 p = vec2(uv.x * (u_resolution.x / u_resolution.y), uv.y);

  vec3 sky = mix(u_skyBottom, u_skyTop, smoothstep(0.0, 1.0, uv.y));

  float density = clouds(p, u_time);
  /*
    A second sample offset toward the light. The difference is a directional
    derivative of the density field — free shading, and the reason these read
    as volumes rather than as fog.
  */
  float lit = clouds(p + vec2(0.012, 0.03), u_time);
  float shade = clamp((density - lit) * 2.2 + 0.72, 0.45, 1.15);

  vec3 color = mix(sky, u_cloud * shade, density);

  /* Toward the horizon everything washes into haze, as it does outdoors. */
  color = mix(color, u_skyBottom, smoothstep(0.42, 0.0, uv.y) * 0.35);

  fragColor = vec4(color, 1.0);
}
`;
