/**
 * The hero's shaders: wet paint lettering, lit and coloured on the GPU.
 *
 * Nothing here knows about React or the DOM — it is shader source, kept beside
 * the pure modules that feed it so the whole rendering story lives in one
 * place. The heavy lifting was already done on the CPU: `paint-surface.ts`
 * baked the letterforms into a normal map, so this only has to light it.
 *
 * ## Colour comes from movement
 *
 * The hue at every pixel is read off the direction the surface faces. That is
 * the whole idea: tilt the word and the spectrum sweeps across it, because a
 * different part of every tube is now pointing at you. Movement is not
 * decorating the colour, it is *producing* it — which is the one thing a
 * colour tool's landing page should be doing.
 *
 * The conversion is genuine OKLCH, the same space the rest of the app works
 * in, rather than an HSV shortcut. A tool that argues for perceptual uniformity
 * everywhere and then reaches for HSV the moment it wants something pretty is
 * not worth believing.
 */

export const PAINT_VERTEX_SOURCE = `#version 300 es
precision highp float;

// A single oversized triangle rather than two triangles for a quad: no seam
// down the diagonal, one fewer vertex, and no index buffer.
const vec2 VERTICES[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2( 3.0, -1.0),
  vec2(-1.0,  3.0)
);

out vec2 vUv;

void main() {
  vec2 position = VERTICES[gl_VertexID];
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const PAINT_FRAGMENT_SOURCE = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSurface;
uniform vec2  uResolution;
uniform vec2  uPointer;      // 0..1, already smoothed on the CPU
uniform float uTime;         // seconds
uniform float uSeedHue;      // radians, so every visit starts somewhere else
uniform vec4  uWordRect;     // xy top-left, zw size, in canvas uv
uniform float uRipple;       // 0..1, how live the pointer disturbance is
uniform float uReduced;      // 1.0 when the visitor asked for less motion
// The six generated room colours, as OKLCH with hue in radians. The word is
// painted in exactly the colours that will drip into the six rooms below, so
// the hero is not a decorative rainbow -- it is the palette the page is about
// to hand over, seen before it separates.
uniform vec3 uRooms[6];

const float PI = 3.14159265359;

// ---------------------------------------------------------------- colour ---

// OKLab's inverse, straight from Björn Ottosson's matrices. Takes lightness,
// chroma and hue in radians; returns linear sRGB, which may sit outside the
// cube for vivid hues -- that is what the clamp at the end is for.
vec3 oklchToLinearSrgb(float L, float C, float H) {
  float a = C * cos(H);
  float b = C * sin(H);

  float l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  float m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  float s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;

  return vec3(
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 linearToSrgb(vec3 linear) {
  vec3 clamped = clamp(linear, 0.0, 1.0);
  return mix(
    clamped * 12.92,
    1.055 * pow(clamped, vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, clamped)
  );
}

// ------------------------------------------------------------ background ---

// A slow wash that leans toward wherever the pointer is, plus a faint grid so
// the tilt has something to be measured against. Deliberately close to black:
// everything the eye should be spending on is in the lettering.
vec3 background(vec2 uv, vec2 pointer, float aspect) {
  vec2 toPointer = (uv - pointer) * vec2(aspect, 1.0);
  float glow = exp(-dot(toPointer, toPointer) * 2.2);

  float drift = sin(uv.x * 2.1 + uTime * 0.08) * cos(uv.y * 1.7 - uTime * 0.06);
  float wash = 0.06 + 0.05 * glow + 0.012 * drift;

  vec3 base = oklchToLinearSrgb(wash + 0.09, 0.035, uSeedHue + drift * 0.5);

  vec2 grid = abs(fract(uv * vec2(aspect, 1.0) * 9.0) - 0.5);
  float line = smoothstep(0.49, 0.5, max(grid.x, grid.y));
  return base + line * 0.012;
}

// ----------------------------------------------------------------- paint ---

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 uv = vUv;
  vec2 pointerOffset = uPointer - 0.5;

  vec3 colour = background(uv, uPointer, aspect);

  // Word space. The tilt is a shear plus a touch of fake perspective scale --
  // the surface is a flat texture, so it cannot truly rotate, but leaning it
  // toward the pointer and scaling the near edge up reads as a solid object on
  // a gimbal for the small angles involved here.
  vec2 word = (uv - uWordRect.xy) / uWordRect.zw;
  vec2 centred = word - 0.5;
  vec2 tilt = pointerOffset * (1.0 - uReduced * 0.75);
  centred.x += centred.y * tilt.x * 0.34;
  centred.y += centred.x * tilt.y * 0.22;
  centred *= 1.0 + dot(centred, tilt) * 0.30;
  word = centred + 0.5;

  if (word.x < 0.0 || word.x > 1.0 || word.y < 0.0 || word.y > 1.0) {
    fragColor = vec4(linearToSrgb(colour), 1.0);
    return;
  }

  vec4 surface = texture(uSurface, word);
  float coverage = surface.a;
  if (coverage < 0.002) {
    fragColor = vec4(linearToSrgb(colour), 1.0);
    return;
  }

  vec3 normal = normalize(surface.rgb * 2.0 - 1.0);

  // The pointer disturbance. Rings decaying away from the cursor, perturbing
  // the normal rather than the geometry -- the paint looks pushed without any
  // of it actually moving, which keeps this a single texture fetch.
  vec2 toPointer = (uv - uPointer) * vec2(aspect, 1.0);
  float distance = length(toPointer);
  float wave = sin(distance * 42.0 - uTime * 5.0) * exp(-distance * 11.0);
  normal = normalize(normal + vec3(normalize(toPointer + 1e-6) * wave * uRipple * 0.55, 0.0));

  // Light rides with the pointer, but is offset up and to the left even at
  // rest. A head-on key light puts its brightest point exactly on the flat top
  // of every tube, which is the one place that carries no information about the
  // form -- the letterforms come out looking embossed rather than round.
  vec3 lightDir = normalize(vec3(tilt * 1.7 + vec2(-0.42, 0.5), 0.72));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfway = normalize(lightDir + viewDir);

  float diffuse = max(dot(normal, lightDir), 0.0);
  // Two lobes: a tight one for the wet highlight and a broad one for the sheen
  // down the length of a stroke. One alone reads as either plastic or as fog.
  float sheen = pow(max(dot(normal, halfway), 0.0), 12.0);
  float specular = pow(max(dot(normal, halfway), 0.0), 96.0);
  float fresnel = pow(1.0 - max(normal.z, 0.0), 2.6);

  // Which room's paint this pixel is made of. The six run along the word, and
  // the boundaries slide with the pointer and with time -- so moving the mouse
  // pushes the colours through the letterforms rather than merely relighting
  // them. Movement is what produces the colour, which is the entire idea.
  float flow = word.x * 6.0
    + tilt.x * 1.6
    + normal.x * 0.55
    + uTime * 0.06 * (1.0 - uReduced);
  float slot = mod(flow, 6.0);
  int lower = int(floor(slot));
  int upper = int(mod(float(lower) + 1.0, 6.0));
  float blend = smoothstep(0.0, 1.0, fract(slot));

  vec3 a = uRooms[lower];
  vec3 b = uRooms[upper];
  float lightness = mix(a.x, b.x, blend);
  float chroma = mix(a.y, b.y, blend);
  // Hue is interpolated the short way round the wheel; a straight mix would
  // travel through every hue in between and put grey at the crossover.
  float hueDelta = mod(b.z - a.z + PI, 2.0 * PI) - PI;
  float hue = a.z + hueDelta * blend;

  // Shading rides on top of the room colour rather than replacing it: the tube
  // gets darker where it turns away and brighter where it faces the light, but
  // it stays recognisably the colour that is about to fall into that room.
  lightness = clamp(lightness * (0.62 + diffuse * 0.52) + fresnel * 0.10, 0.0, 1.0);
  chroma *= 0.80 + 0.30 * (1.0 - abs(normal.z));

  vec3 paint = oklchToLinearSrgb(lightness, chroma, hue);
  paint += specular * vec3(1.0, 0.99, 0.96) * 1.6;
  paint += sheen * oklchToLinearSrgb(0.9, 0.05, hue) * 0.22;
  // A cool rim where the tube rolls away, which is what sells it as wet.
  paint += fresnel * oklchToLinearSrgb(0.80, 0.13, hue + 1.7) * 0.34;

  colour = mix(colour, paint, coverage);
  fragColor = vec4(linearToSrgb(colour), 1.0);
}
`;
