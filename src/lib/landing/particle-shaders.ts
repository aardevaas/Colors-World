/**
 * GLSL for the landing-page particle system.
 *
 * Everything the experience does — the ambient hero trickle, the storm
 * ramping up with scroll, the morph onto the globe, and now the explosion —
 * is a uniform change against these two shaders. There is no per-frame CPU
 * work and no geometry swap at any point in the story; that continuity is
 * the whole reason the phases can blend into each other rather than cut.
 */

/**
 * Hash-based value noise, not simplex. A curl-noise field only needs *some*
 * organic, continuous noise to be divergence-free by construction — which
 * primitive supplies it barely matters visually. Value noise was chosen
 * deliberately over hand-rolling simplex noise because this GLSL can't be
 * unit tested at all; the simpler primitive is much harder to get subtly
 * wrong than a from-scratch simplex implementation would have been.
 */
const NOISE_GLSL = /* glsl */ `
  float hash13(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float valueNoise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
    float nx00 = mix(n000, n100, u.x);
    float nx10 = mix(n010, n110, u.x);
    float nx01 = mix(n001, n101, u.x);
    float nx11 = mix(n011, n111, u.x);
    float nxy0 = mix(nx00, nx10, u.y);
    float nxy1 = mix(nx01, nx11, u.y);
    return mix(nxy0, nxy1, u.z);
  }

  // Three independently-offset noise channels stand in for a vector
  // potential (Fx, Fy, Fz).
  vec3 noiseVec3(vec3 p) {
    return vec3(
      valueNoise3(p + vec3(17.3, 4.7, 92.1)),
      valueNoise3(p + vec3(63.1, 8.4, 15.9)),
      valueNoise3(p + vec3(31.6, 77.2, 3.5))
    );
  }

  // curl = del x F, computed by central differences on that potential. Curl
  // is divergence-free by construction — this is what gives swirling,
  // fluid-like turbulence instead of the plain radial blast the shockwave
  // term alone would produce.
  vec3 curlNoise(vec3 p) {
    float e = 0.1;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);

    vec3 pX0 = noiseVec3(p - dx);
    vec3 pX1 = noiseVec3(p + dx);
    vec3 pY0 = noiseVec3(p - dy);
    vec3 pY1 = noiseVec3(p + dy);
    vec3 pZ0 = noiseVec3(p - dz);
    vec3 pZ1 = noiseVec3(p + dz);

    float cx = pY1.z - pY0.z - pZ1.y + pZ0.y;
    float cy = pZ1.x - pZ0.x - pX1.z + pX0.z;
    float cz = pX1.y - pX0.y - pY1.x + pY0.x;

    float divisor = 1.0 / (2.0 * e);
    return normalize(vec3(cx, cy, cz) * divisor + 1e-5);
  }
`;

export const PARTICLE_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;          // 0..1 through the pinned section
  uniform float uPixelRatio;
  uniform float uVisibleFraction; // ramps ~0.0017 (50 cubes) -> 1.0 (full storm)
  uniform float uSpeedBoost;      // scroll-velocity driven, 0 when idle
  uniform float uFieldHeight;
  uniform float uMorphProgress;   // 0 = raining, 1 = fully assembled globe
  uniform float uRotation;        // accumulated spin, radians
  uniform float uTilt;            // fixed axial tilt, radians
  uniform float uSphereRadius;
  uniform float uExplodeProgress; // 0 = assembled, ramps to 1 across the climax, stays there while settled
  uniform float uHoveredIndexNorm; // aIndexNorm of the hovered particle, or -1 for none

  attribute vec3 aRainStart;      // x,z = column; y = 0..1 fall phase
  attribute vec3 aSpherePos;
  attribute vec3 aColor;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aIndexNorm;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vEmphasis;

  vec3 rotateY(vec3 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }

  vec3 rotateZ(vec3 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
  }

  ${NOISE_GLSL}

  void main() {
    vColor = aColor;

    // Progressive reveal: a particle only exists once the storm has ramped
    // far enough to include it. Ordering by index means the ambient hero
    // trickle is a stable subset of the storm, not a different set of points.
    float exists = step(aIndexNorm, uVisibleFraction);

    // Endless fall. Wrapping a 0..1 phase means the field never empties and
    // never needs respawning on the CPU.
    float rate = aSpeed * (0.045 + uSpeedBoost);
    float phase = fract(aRainStart.y + uTime * rate + uScroll * aSpeed * 1.6);
    float y = mix(uFieldHeight * 0.5, uFieldHeight * -0.5, phase);

    vec3 rainPos = vec3(aRainStart.x, y, aRainStart.z);
    // Lateral drift so the fall reads as air, not a conveyor belt.
    rainPos.x += sin(uTime * 0.25 + aRainStart.z * 1.7) * 0.18;

    // Spin about the globe's own axis, then tilt that axis off vertical.
    // Rotating the sphere seat here rather than the whole object keeps the
    // rain upright — only the destination turns, so the fall never skews.
    vec3 spherePos = rotateZ(rotateY(aSpherePos, uRotation), uTilt);

    vec3 pos = mix(rainPos, spherePos, uMorphProgress);

    // Explosion: a radial shockwave (each particle flung outward along its
    // own sphere normal, with per-particle speed variance from aSpeed) plus
    // curl-noise turbulence that keeps growing through the settle, so the
    // dispersed field drifts gently forever rather than freezing solid.
    vec3 outward = normalize(spherePos + 1e-5);
    float shock = smoothstep(0.0, 0.4, uExplodeProgress);
    vec3 turbulence = curlNoise(spherePos * 0.6 + uTime * 0.15);
    vec3 exploded = spherePos
      + outward * shock * 3.2 * (0.6 + aSpeed * 0.4)
      + turbulence * uExplodeProgress * 1.6;
    pos = mix(pos, exploded, uExplodeProgress);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Hover emphasis: an exact match within a tolerance comfortably between
    // float-rounding noise and the ~1/30000 spacing between neighbouring
    // indices, so precisely one particle lights up, never its neighbours.
    float isHovered = step(-1.0e-5, uHoveredIndexNorm) * step(abs(aIndexNorm - uHoveredIndexNorm), 5.0e-6);

    // Grow slightly as the shell closes, so ~30k discrete points overlap into
    // one continuous surface instead of reading as a dotted screen — then
    // shrink a little through the settle for "elegant ambient depth" rather
    // than a field of equally bright dots behind future foreground content.
    float sizeGain = mix(1.0, 1.5, uMorphProgress) * mix(1.0, 0.82, smoothstep(0.3, 1.0, uExplodeProgress));
    gl_PointSize = aSize * sizeGain * (1.0 + isHovered * 0.9) * uPixelRatio * (9.0 / -mvPosition.z);

    // Fade at the top and bottom of the field so particles arrive and leave
    // rather than popping in and out at the wrap seam.
    float edgeFade = smoothstep(0.0, 0.07, phase) * (1.0 - smoothstep(0.9, 1.0, phase));
    // Once morphed onto the globe there is no fall phase to fade against.
    edgeFade = mix(edgeFade, 1.0, uMorphProgress);

    // Additive blending has no depth sorting, so without this the far side of
    // the shell sums straight through the near side and the globe blows out
    // to a white ball. Dimming by depth restores the read of a solid sphere
    // lit from the front — relaxed back to full visibility once exploding,
    // since a dispersed field in open space has no "far side" to hide.
    float depthFade = smoothstep(-uSphereRadius * 0.85, uSphereRadius * 0.6, spherePos.z);
    float facing = mix(1.0, 0.12 + depthFade * 0.88, uMorphProgress * (1.0 - uExplodeProgress));

    // Dim slightly through the settle, same reasoning as the size shrink.
    float settleFade = mix(1.0, 0.55, smoothstep(0.4, 1.0, uExplodeProgress));

    vAlpha = exists * edgeFade * facing * settleFade;
    vEmphasis = isHovered * (1.0 - uExplodeProgress);
  }
`;

export const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vEmphasis;

  void main() {
    if (vAlpha <= 0.001) discard;

    vec2 offset = gl_PointCoord - 0.5;

    // A soft-edged square core reads as a tumbling cube at small sizes, which
    // is the look the hero asks for, while staying a single point sprite.
    float square = max(abs(offset.x), abs(offset.y));
    float core = 1.0 - smoothstep(0.26, 0.40, square);

    // A rounder halo around it does the glow. Additive blending against the
    // near-black stage turns this into emitted light rather than a drawn dot.
    float halo = 1.0 - smoothstep(0.0, 0.5, length(offset));

    float alpha = clamp(core + halo * halo * 0.45, 0.0, 1.0) * vAlpha;
    // The hovered particle gets a brighter, whiter glow on top of its own
    // colour — cheap to read as "this one is interactive" without a
    // separate highlight object.
    alpha = clamp(alpha + vEmphasis * halo * 0.6, 0.0, 1.0);
    if (alpha <= 0.001) discard;

    vec3 emphasized = mix(vColor, vec3(1.0), vEmphasis * 0.55);
    gl_FragColor = vec4(emphasized, alpha);
  }
`;
