/**
 * GLSL for the landing-page particle system.
 *
 * Everything the experience does — the ambient hero trickle, the storm
 * ramping up with scroll, and (next phase) the morph onto the globe — is a
 * uniform change against these two shaders. There is no per-frame CPU work
 * and no geometry swap at any point in the story; that continuity is the
 * whole reason the phases can blend into each other rather than cut.
 */

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

  attribute vec3 aRainStart;      // x,z = column; y = 0..1 fall phase
  attribute vec3 aSpherePos;
  attribute vec3 aColor;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aIndexNorm;

  varying vec3 vColor;
  varying float vAlpha;

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

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Grow slightly as the shell closes, so ~30k discrete points overlap into
    // one continuous surface instead of reading as a dotted screen.
    float sizeGain = mix(1.0, 1.5, uMorphProgress);
    gl_PointSize = aSize * sizeGain * uPixelRatio * (9.0 / -mvPosition.z);

    // Fade at the top and bottom of the field so particles arrive and leave
    // rather than popping in and out at the wrap seam.
    float edgeFade = smoothstep(0.0, 0.07, phase) * (1.0 - smoothstep(0.9, 1.0, phase));
    // Once morphed onto the globe there is no fall phase to fade against.
    edgeFade = mix(edgeFade, 1.0, uMorphProgress);

    // Additive blending has no depth sorting, so without this the far side of
    // the shell sums straight through the near side and the globe blows out
    // to a white ball. Dimming by depth restores the read of a solid sphere
    // lit from the front, and costs nothing.
    float depthFade = smoothstep(-uSphereRadius * 0.85, uSphereRadius * 0.6, spherePos.z);
    float facing = mix(1.0, 0.12 + depthFade * 0.88, uMorphProgress);

    vAlpha = exists * edgeFade * facing;
  }
`;

export const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

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
    if (alpha <= 0.001) discard;

    gl_FragColor = vec4(vColor, alpha);
  }
`;
