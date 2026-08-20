'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import {
  composeRotation,
  dampEuler,
  idleTumble,
  pointerRotation,
  type Euler3,
} from '@/lib/landing/hero-motion';
import type { RoomColor } from '@/lib/landing/room-palette';
import { drawStudioEnvironment } from '@/lib/landing/studio-environment';
import styles from './paint-hero.module.css';

/**
 * The hero: "Colors World" as inflated 3D lettering in wet paint.
 *
 * Plain three.js rather than react-three-fiber. The scene is one model, one
 * environment and one loop — a reconciler re-rendering a React tree to drive
 * that would add weight and a hook-ordering surface for no gain, and the globe
 * this replaces was lost to exactly that class of bug.
 *
 * Two things here are measured from the reference rather than assumed:
 *
 *  - The primary motion is a continuous idle tumble, not pointer tracking. Two
 *    captures with the mouse unmoved showed the word at different angles. The
 *    pointer contributes a damped offset on top (see hero-motion.ts).
 *  - The sweeping highlight is the *environment* sliding across the surface as
 *    the mesh turns, not an animated specular. Get the env right and it is
 *    free; animate it by hand and it will always look wrong.
 *
 * The colour is ours rather than the reference's flat blue: the six generated
 * room hues are laid across the strokes, so turning the word sweeps you through
 * the exact palette the six rooms below are about to be painted in.
 */

const MODEL_URL = '/model/colors-world.glb';
const DRACO_PATH = '/draco/';

/** How quickly the word swings toward the pointer. Lower is heavier. */
const POINTER_LAMBDA = 2.6;
/** Seconds for a touch ripple to decay. */
const RIPPLE_DECAY = 0.9;
/** Radius of the ripple in normalised model units. */
const RIPPLE_RADIUS = 0.42;

interface PaintHeroProps {
  readonly seedHue: number;
  readonly rooms: readonly RoomColor[];
  readonly reducedMotion?: boolean;
}

export function PaintHero({ rooms, reducedMotion = false }: PaintHeroProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  // Pointer and palette live in refs: both change without needing a React
  // render, and the loop reads them every frame.
  const pointerRef = useRef({ x: 0, y: 0 });
  const reducedRef = useRef(reducedMotion);
  const roomsRef = useRef(rooms);
  reducedRef.current = reducedMotion;
  roomsRef.current = rooms;

  useEffect(() => {
    const mount = mountRef.current;
    if (mount === null) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, Math.max(1, mount.clientHeight));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070a1c');

    const camera = new THREE.PerspectiveCamera(
      42,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.1,
      100
    );
    camera.position.set(0, 0, 4.2);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envSource = new THREE.CanvasTexture(drawStudioEnvironment(768, 384));
    envSource.mapping = THREE.EquirectangularReflectionMapping;
    envSource.colorSpace = THREE.SRGBColorSpace;
    const envRT = pmrem.fromEquirectangular(envSource);
    scene.environment = envRT.texture;
    envSource.dispose();

    const group = new THREE.Group();
    scene.add(group);

    // Shader-injected uniforms, shared by the material and the loop.
    const uniforms = {
      uRoomColors: { value: paletteToColors(roomsRef.current) },
      uSpan: { value: new THREE.Vector2(-1, 1) },
      uHit: { value: new THREE.Vector3(0, 0, 0) },
      uHitStrength: { value: 0 },
    };

    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.14,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.045,
      envMapIntensity: 1.35,
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uRoomColors = uniforms.uRoomColors;
      shader.uniforms.uSpan = uniforms.uSpan;
      shader.uniforms.uHit = uniforms.uHit;
      shader.uniforms.uHitStrength = uniforms.uHitStrength;

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObjectPos;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n  vObjectPos = position;'
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vObjectPos;
uniform vec3 uRoomColors[6];
uniform vec2 uSpan;
uniform vec3 uHit;
uniform float uHitStrength;

// Six generated hues laid across the word, blended so the seams are not
// visible as bands -- the point is a spectrum, not a colour chart.
vec3 spectrumAt(float t) {
  float scaled = clamp(t, 0.0, 1.0) * 5.0;
  int i = int(floor(scaled));
  float f = fract(scaled);
  vec3 a = uRoomColors[min(i, 5)];
  vec3 b = uRoomColors[min(i + 1, 5)];
  return mix(a, b, smoothstep(0.0, 1.0, f));
}`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  float t = (vObjectPos.x - uSpan.x) / max(1e-5, uSpan.y - uSpan.x);
  diffuseColor.rgb *= spectrumAt(t);

  // Touch ripple: a local brightening where the pointer meets a stroke, the
  // way a finger disturbs wet paint. Decays on its own (see the loop).
  float d = distance(vObjectPos, uHit);
  float ring = smoothstep(${RIPPLE_RADIUS.toFixed(3)}, 0.0, d) * uHitStrength;
  diffuseColor.rgb += ring * 0.55;
}`
        );
    };

    let disposed = false;
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_PATH);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    const meshes: THREE.Mesh[] = [];

    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        gltf.scene.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.material = material;
            meshes.push(mesh);
          }
        });
        // Normalise whatever transform the export carried, so composition does
        // not depend on where the sculpt happened to sit in Blender.
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        gltf.scene.position.sub(center);
        gltf.scene.scale.setScalar(2.0 / Math.max(size.x, 1e-6));
        group.add(gltf.scene);
        // Sits above centre: the flat claim lives bottom-left, and the word
        // needs to clear it rather than share the same band of the stage.
        group.position.set(0.42, 0.34, 0);

        // The spectrum ramps across the model's own X extent, measured rather
        // than assumed, so a re-export at a different size still reads right.
        const local = new THREE.Box3().setFromObject(gltf.scene);
        uniforms.uSpan.value.set(local.min.x, local.max.x);
      },
      undefined,
      (err) => {
        console.error('[PaintHero] model failed to load', err);
      }
    );

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    function handlePointerMove(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointerRef.current = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
      };
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    // Arrow rather than a declaration: a hoisted function loses the non-null
    // narrowing `mount` got from the early return above it.
    const handleResize = () => {
      const w = mount.clientWidth;
      const h = Math.max(1, mount.clientHeight);
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(mount);

    const clock = new THREE.Clock();
    let smoothed: Euler3 = { x: 0, y: 0, z: 0 };
    let frame = 0;

    function tick() {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.elapsedTime;

      const idle = reducedRef.current ? { x: 0, y: 0, z: 0 } : idleTumble(t);
      const wanted = pointerRotation(pointerRef.current.x, pointerRef.current.y);
      smoothed = dampEuler(smoothed, wanted, POINTER_LAMBDA, dt);
      const applied = composeRotation(idle, smoothed);
      group.rotation.set(applied.x, applied.y, applied.z);

      // Ripple is raycast against the real mesh, so it only fires when the
      // pointer is genuinely over a stroke rather than over the gaps.
      if (meshes.length > 0) {
        ndc.set(pointerRef.current.x, -pointerRef.current.y);
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(meshes, false);
        const first = hits[0];
        if (first !== undefined) {
          uniforms.uHit.value.copy(first.object.worldToLocal(first.point.clone()));
          uniforms.uHitStrength.value = 1;
        } else {
          uniforms.uHitStrength.value = Math.max(
            0,
            uniforms.uHitStrength.value - dt / RIPPLE_DECAY
          );
        }
      }

      renderer.render(scene, camera);
    }
    frame = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);
      draco.dispose();
      envRT.dispose();
      pmrem.dispose();
      material.dispose();
      scene.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // Repaint the spectrum when a new palette is generated, without rebuilding
  // the scene — the uniform holds the same Color objects the shader reads.
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  return <div ref={mountRef} className={styles.stage} aria-hidden="true" />;
}

function paletteToColors(rooms: readonly RoomColor[]): THREE.Color[] {
  const out: THREE.Color[] = [];
  for (let i = 0; i < 6; i += 1) {
    const room = rooms[i % Math.max(1, rooms.length)];
    // No convertSRGBToLinear here: three's ColorManagement already treats a
    // hex as sRGB and converts it for the linear pipeline. Doing it twice
    // crushed the generated hues into muddy near-blacks on screen.
    out.push(new THREE.Color(room?.hex ?? '#7c5cff'));
  }
  return out;
}

export default PaintHero;
