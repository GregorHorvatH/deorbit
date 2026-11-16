import {
  ATMO_COLOR, ATMO_NIGHT, ATMO_STRENGTH, ATMO_WIDTH, BG, CITY_COLOR, CITY_GLOW, CITY_VISIBLE_FROM, CLOUD_SCALE, HIGHLAND, OCEAN_DEEP, OCEAN_SHALLOW, SNOW,   NIGHT_DARKNESS, NIGHT_END, NIGHT_START, STAR_TWINKLE,
} from './style'

const f = (n: number): string => n.toFixed(6)

/** GLSL twin of nightFactor() in style.ts. */
export const NIGHT_GLSL = /* glsl */ `
float nightFactor(float x) {
  float s = clamp((${f(NIGHT_START)} - x) / ${f(NIGHT_START - NIGHT_END)}, 0.0, 1.0);
  return s * s * (3.0 - 2.0 * s);
}`


/** Procedural clouds: value-noise fbm, warped, shaped by a weather map. Used by the cloud shell and, for shadows, by the globe. */
export const CLOUD_GLSL = /* glsl */ `
uniform sampler2D uCoverage; // cloud fraction on a coarse lon/lat grid, in the GROUND frame
uniform mat3 uToGround;      // cloud frame -> ground frame
uniform int uCloudOct;       // octaves of the main noise (fewer on a slow machine)
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), u.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y);
  float b = mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y);
  return mix(a, b, u.z);
}
const mat3 OCT_ROT = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64); // turns each octave: no grid artefacts
float fbm(vec3 p, int oct) {
  float amp = 0.5, sum = 0.0, norm = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    sum += amp * vnoise(p);
    norm += amp;
    p = OCT_ROT * p * 2.02 + 17.1;
    amp *= 0.5;
  }
  return sum / norm;
}
/** Cloud density 0..1 in the direction d (unit, cloud frame). */
float cloudDensity(vec3 d) {
  vec3 g = uToGround * d;
  float cov = texture2D(uCoverage, vec2(atan(g.x, g.z) * 0.15915494 + 0.5, asin(clamp(g.y, -1.0, 1.0)) * 0.31830989 + 0.5)).r;
  vec3 east = normalize(vec3(d.z, 0.0, -d.x) + vec3(1e-4, 0.0, 0.0));
  vec3 q = d * 3.0;
  q -= east * dot(q, east) * 0.22;                       // a little stretched east-west, like the real bands
  vec3 w = vec3(fbm(q * 1.1 + 3.1, 2), fbm(q * 1.1 + 7.7, 2), fbm(q * 1.1 + 11.3, 2)) - 0.5;
  q += w * 0.75;                                          // swirled
  float n = fbm(q * 1.9, uCloudOct);
  float t = mix(0.72, 0.47, cov);                         // the more cover, the lower the threshold
  float c = smoothstep(t, t + 0.11, n);
  float e = fbm(q * 6.5, 3);                              // ragged edges
  return clamp(c * (0.5 + 1.0 * e), 0.0, 1.0);
}
`

/** The globe: the painted texture, darkened by the day / night curve of the WORLD x (the sun never moves). */
export const globeVert = /* glsl */ `
varying vec2 vUv;
varying float vX;
varying vec3 vObj; // the point in the mesh's own frame (a unit direction for a sphere)
void main() {
  vUv = uv;
  vObj = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vX = world.x;
  gl_Position = projectionMatrix * viewMatrix * world;
}`
export const globeFrag = /* glsl */ `
uniform sampler2D uMap;    // the continents, premultiplied; transparent where there is ocean
uniform sampler2D uRelief; // r: hill shading (128 = flat), g: height of the land, b: depth of the sea
uniform vec3 uOcean;
uniform float uNight;      // 0 = the day / night layer is off
uniform float uOceanOn;
uniform float uLandOn;
uniform float uTerrain;    // 0 = flat colours (the relief layer is off), 1 = relief
uniform mat3 uToCloud;     // ground frame -> cloud frame
uniform vec3 uSunCloud;    // the Sun's direction in the cloud frame
uniform float uCloudShadow; // 0 = no shadows (clouds off, or a slow machine)
varying vec2 vUv;
varying float vX;
varying vec3 vObj;
${NIGHT_GLSL}
${CLOUD_GLSL}
void main() {
  vec4 t = texture2D(uMap, vUv);
  vec3 rl = texture2D(uRelief, vUv).rgb;
  float la = t.a * uLandOn;

  // land: the painted colour, browner and then white with height, and shaded by the slope
  vec3 landC = t.rgb / max(t.a, 0.001);
  landC = mix(landC, vec3(${hex3(HIGHLAND)}), smoothstep(0.30, 0.68, rl.g) * 0.6 * uTerrain);
  landC = mix(landC, vec3(${hex3(SNOW)}), smoothstep(0.80, 0.96, rl.g) * 0.85 * uTerrain);
  landC *= mix(1.0, rl.r * 2.0, 0.85 * uTerrain);

  // sea: lighter over the shelf, darker in the deep, with the faintest hint of the ridges
  vec3 sea = mix(vec3(${hex3(OCEAN_SHALLOW)}), vec3(${hex3(OCEAN_DEEP)}), smoothstep(0.10, 0.75, rl.b));
  vec3 seaC = mix(uOcean, sea * mix(1.0, rl.r * 2.0, 0.4), uTerrain);

  if (uOceanOn < 0.5) {
    if (la < 0.5) discard; // no ocean: only the land is left
    gl_FragColor.rgb = landC;
  } else {
    gl_FragColor.rgb = landC * la + seaC * (1.0 - la);
  }
  if (uCloudShadow > 0.5) {
    // a cloud stands between the ground and the Sun: look for it a little towards the Sun
    vec3 pc = normalize(uToCloud * normalize(vObj));
    float shadow = cloudDensity(normalize(pc + uSunCloud * 0.07));
    gl_FragColor.rgb *= 1.0 - 0.42 * shadow * smoothstep(0.0, 0.35, dot(pc, uSunCloud));
  }
  gl_FragColor.rgb *= 1.0 - ${f(NIGHT_DARKNESS)} * nightFactor(vX) * uNight;
  gl_FragColor.a = 1.0;
}`

/** The glow: a screen-aligned plane behind the globe's rim; alpha falls off with the square of the height above the surface. */
export const atmoVert = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
export const atmoFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uNight;
varying vec2 vP;
${NIGHT_GLSL}
void main() {
  float r = length(vP);
  float t = (${f(1 + ATMO_WIDTH)} - r) / ${f(ATMO_WIDTH)};
  if (t <= 0.0 || r < 0.99) discard;
  float glow = 1.0 - (1.0 - ${f(ATMO_NIGHT)}) * nightFactor(vP.x) * uNight;
  gl_FragColor = vec4(uColor, ${f(ATMO_STRENGTH)} * t * t * glow);
}`
export const ATMO_COLOR_HEX = ATMO_COLOR

/** Twinkling stars: round points of a fixed pixel size that "breathe" and fade towards the background colour. */
export const starVert = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
attribute float aSpeed;
uniform float uTick;
uniform float uScale; // screen pixels per design pixel (window scale k * device pixel ratio)
uniform float uTwinkle;
varying vec3 vColor;
void main() {
  float b = 1.0 - ${f(STAR_TWINKLE)} * (0.5 + 0.5 * sin(uTick * aSpeed + aPhase)) * uTwinkle;
  float r = aSize * (0.7 + 0.3 * b);
  vColor = mix(vec3(${hex3(BG)}), aColor, 0.06 + 0.94 * b);
  gl_PointSize = max(1.5, 2.0 * r * uScale);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
export const starFrag = /* glsl */ `
varying vec3 vColor;
void main() {
  if (length(gl_PointCoord - 0.5) > 0.5) discard;
  gl_FragColor = vec4(vColor, 1.0);
}`



/** The cloud shell: the density comes from the procedural noise (CLOUD_GLSL), is lit from the Sun side, darkened by the night
 *  curve, and is dense enough to hide what is under it. */
export const cloudFrag = /* glsl */ `
uniform float uNight;
uniform float uDetail;   // 1 = lit from the Sun side (self-shading); 0 on a slow machine
uniform float uBlack;    // 1 = the black twin that hides glow (see Bloom.tsx)
uniform vec3 uSunCloud;  // the Sun's direction in the cloud frame
varying vec3 vObj;
varying float vX;
${NIGHT_GLSL}
${CLOUD_GLSL}
void main() {
  vec3 d = normalize(vObj);
  float dens = cloudDensity(d);
  if (dens < 0.004) discard;
  // thickness cue: where the cloud thins towards the Sun its edge is lit, where it thickens it is in its own shade
  float lit = 0.82;
  if (uDetail > 0.5) {
    vec3 towards = uSunCloud - d * dot(uSunCloud, d);
    float dSun = cloudDensity(normalize(d + normalize(towards + vec3(1e-5)) * 0.022));
    lit = clamp(0.74 + (dens - dSun) * 2.4, 0.40, 1.0);
  }
  vec3 base = mix(vec3(0.55, 0.61, 0.72), vec3(0.99, 0.995, 1.0), lit);
  float night = nightFactor(vX) * uNight;
  float a = smoothstep(0.0, 0.35, dens) * 0.99; // dense: a cloud hides what is under it, by night too
  vec3 col = base * (1.0 - ${f(NIGHT_DARKNESS)} * night);
  gl_FragColor = vec4(col * a * (1.0 - uBlack), a); // premultiplied
}`

/** City lights: square dots that glow only deep in the night, flicker slightly, and switch off near the limb. */
export const cityVert = /* glsl */ `
attribute float aSize;   // half-size, design pixels
attribute float aCore;   // 1 = the bright centre of a city
attribute float aHalo;   // 1 = the soft glow square under a core
attribute float aPhase;
uniform float uTick;
uniform float uScale;    // screen pixels per design pixel
uniform float uNight;
uniform float uCoresOnly;
uniform float uCloudsOn;      // 0 = the cloud layer is off
uniform mat3 uWorldToCloud;   // world -> the cloud frame
varying float vGlow;
varying float vHalo;
${NIGHT_GLSL}
${CLOUD_GLSL}
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float z = (modelMatrix * vec4(normalize(position), 1.0)).z; // depth of the surface point under the light
  float depth = clamp((${f(NIGHT_START)} - world.x) / ${f(NIGHT_START - NIGHT_END)}, 0.0, 1.0) * uNight;
  float glow = (depth - ${f(CITY_VISIBLE_FROM)}) / ${f(1 - CITY_VISIBLE_FROM)};
  glow *= (0.85 + 0.15 * sin(uTick * 0.03 + aPhase)) * pow(max(z, 0.0), 0.4);
  if (uCloudsOn > 0.5 && glow > 0.0) {
    // the cloud that really covers this light on the screen: the clouds float higher, so look along the line of sight
    // up to the cloud shell, not straight up from the light
    float r2 = dot(world.xy, world.xy);
    float cr = ${f(CLOUD_SCALE)};
    if (r2 < cr * cr) {
      float under = cloudDensity(normalize(uWorldToCloud * vec3(world.xy, sqrt(cr * cr - r2))));
      glow *= 1.0 - smoothstep(0.04, 0.4, under);
    }
  }
  if (z < 0.08 || glow <= 0.0 || (uCoresOnly > 0.5 && aCore < 0.5 && aHalo < 0.5)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // off screen
    gl_PointSize = 0.0;
    vGlow = 0.0;
    return;
  }
  vHalo = aHalo;
  vGlow = clamp(glow, 0.0, 1.0) * (aHalo > 0.5 ? 0.34 : 1.0); // the glow under a core is dimmer
  float b = aSize * (0.6 + 0.4 * z) * (aHalo > 0.5 ? 1.9 : 1.0);
  gl_PointSize = max(1.0, 2.0 * b * uScale);
  gl_Position = projectionMatrix * viewMatrix * world;
}`
export const cityFrag = /* glsl */ `
uniform float uGlowPass; // 1 while the bloom's glow pass is drawn
varying float vGlow;
varying float vHalo;
void main() {
  // fade by transparency, not towards a near-black colour: on a surface that is not dark yet a dim light must look
  // like a faint glow, never like a dark speck
  gl_FragColor = vec4(vec3(${hex3(CITY_COLOR)}), vGlow * mix(1.0, ${f(CITY_GLOW)}, uGlowPass)); // a light shines more than it glows
}`

function hex3(c: string): string {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v / 255)).join(', ')
}
