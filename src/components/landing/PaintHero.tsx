'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import {
  composeRotation,
  damp,
  dampEuler,
  idleTumble,
  pointerRotation,
  type Euler3,
} from '@/lib/landing/hero-motion';
import styles from './paint-hero.module.css';

/**
 * "Colors World" as inflated 3D lettering, built to match the reference.
 *
 * The thing that makes the reference feel alive is not the sculpt, it is what
 * happens under the cursor: the mesh near the pointer is dragged into an
 * amorphous smear and blooms iridescent, while the rest of the word stays
 * pristine, and it recovers when you leave. Captured directly — parking the
 * pointer on the `h` destroyed `h` and `e` completely and left `llo` untouched.
 *
 * That effect is geometry-agnostic, which is the reason it is built first: a
 * displacement field does not care whether the letterform underneath is a
 * swept tube or an inflated font, so the mesh can be improved later without
 * touching any of this.
 *
 * Monochrome on purpose. The iridescence only reads as iridescence against a
 * single base colour — a multi-hue word turns the bloom into noise, which is
 * exactly what the previous attempt got wrong.
 */

const MODEL_URL = '/model/colors-world.glb';
const DRACO_PATH = '/draco/';

/** Reference palette: deep royal blue word on a deeper blue ground. */
const PAINT_COLOR = '#3d44ff';
const BACKGROUND_COLOR = '#141f8c';

/** How quickly the word swings toward the pointer. Lower is heavier. */
const POINTER_LAMBDA = 2.6;
/** How quickly the deformation centre chases the cursor. Lower drags more. */
const HIT_LAMBDA = 9.0;
/** How fast the smear builds and releases, per second. */
const GRAB_ATTACK = 7.0;
const GRAB_RELEASE = 3.2;

interface PaintHeroProps {
  readonly reducedMotion?: boolean;
}

export function PaintHero({ reducedMotion = false }: PaintHeroProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

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
    renderer.toneMappingExposure = 1.25;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BACKGROUND_COLOR);

    const camera = new THREE.PerspectiveCamera(
      40,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.1,
      100
    );
    camera.position.set(0, 0, 4.4);

    // Structured environment: broad bright bands over a dark ground. This is
    // what produces the long axial highlight sliding along a stroke as the
    // word turns — it is the environment moving across the surface, not an
    // animated specular.
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envSource = new THREE.CanvasTexture(buildEnvironment());
    envSource.mapping = THREE.EquirectangularReflectionMapping;
    envSource.colorSpace = THREE.SRGBColorSpace;
    const envRT = pmrem.fromEquirectangular(envSource);
    scene.environment = envRT.texture;
    envSource.dispose();

    const key = new THREE.DirectionalLight('#ffffff', 2.4);
    key.position.set(2.5, 3.0, 4.0);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#8fa8ff', 1.1);
    fill.position.set(-3.0, -1.5, 2.0);
    scene.add(fill);

    const group = new THREE.Group();
    scene.add(group);

    interface PaintUniforms {
      uHit: { value: THREE.Vector3 };
      uGrab: { value: number };
      uRadius: { value: number };
      uStrength: { value: number };
    }

    /**
     * One material per mesh, each with its own uniforms.
     *
     * `uHit` is a point in the mesh's *local* space, and the two lines are
     * separate meshes at different positions -- so a single shared uniform made
     * a hit on "World" deform "Colors" at the same local coordinates, and both
     * lines blobbed at once. Per-mesh state is what keeps the deformation where
     * the cursor actually is.
     */
    const painted: { mesh: THREE.Mesh; uniforms: PaintUniforms }[] = [];

    function createPaintMaterial(): { material: THREE.MeshPhysicalMaterial; uniforms: PaintUniforms } {
      const uniforms: PaintUniforms = {
        uHit: { value: new THREE.Vector3(0, 0, 999) },
        uGrab: { value: 0 },
        uRadius: { value: 0.38 },
        uStrength: { value: 0.24 },
      };

      const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(PAINT_COLOR),
        roughness: 0.13,
        metalness: 0.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.035,
        envMapIntensity: 2.6,
      });

      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);

        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
uniform vec3 uHit;
uniform float uGrab;
uniform float uRadius;
uniform float uStrength;
varying float vDeform;`
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
{
  // Tight core, soft shoulder -- a linear falloff reads as a uniform bulge
  // rather than something being dragged.
  float d = distance(position, uHit);
  float fall = 1.0 - smoothstep(0.0, uRadius, d);
  fall = pow(fall, 1.7) * uGrab;

  // Smeared sideways *and* lifted: the outward term is what turns a letter
  // into an amorphous blob instead of denting it.
  vec3 away = normalize(position - uHit + 1e-4);
  vec3 dir = normalize(away * 1.25 + objectNormal * 0.9);
  transformed += dir * fall * uStrength;
  vDeform = fall;
}`
          );

        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
varying float vDeform;

// Oil-slick ramp. A cosine palette, not a thin-film model -- the reference's
// bloom is a look, not physics.
vec3 oilSlick(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(0.00, 0.33, 0.67) + t));
}`
          )
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
{
  if (vDeform > 0.001) {
    float fres = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.0);
    vec3 slick = oilSlick(vDeform * 1.6 + fres * 0.65);
    diffuseColor.rgb = mix(diffuseColor.rgb, slick, clamp(vDeform * 1.35, 0.0, 0.9));
  }
}`
          );
      };

      return { material, uniforms };
    }

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
            const made = createPaintMaterial();
            mesh.material = made.material;
            meshes.push(mesh);
            painted.push({ mesh, uniforms: made.uniforms });
          }
        });
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        gltf.scene.position.sub(center);
        gltf.scene.scale.setScalar(2.55 / Math.max(size.x, 1e-6));
        group.add(gltf.scene);
      },
      undefined,
      (err) => console.error('[PaintHero] model failed to load', err)
    );

    const handlePointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointerRef.current = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
      };
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    const handleResize = () => {
      const w = mount.clientWidth;
      const h = Math.max(1, mount.clientHeight);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(mount);

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const targetHit = new THREE.Vector3(0, 0, 999);
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

      if (painted.length > 0) {
        ndc.set(pointerRef.current.x, -pointerRef.current.y);
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectObjects(meshes, false)[0];
        const hitMesh = hit?.object;

        for (const entry of painted) {
          if (hit !== undefined && entry.mesh === hitMesh) {
            entry.mesh.worldToLocal(targetHit.copy(hit.point));
            entry.uniforms.uGrab.value = damp(entry.uniforms.uGrab.value, 1, GRAB_ATTACK, dt);
            // The contact point trails the cursor, so gliding along a stroke
            // drags the smear behind it rather than teleporting it.
            entry.uniforms.uHit.value.x = damp(entry.uniforms.uHit.value.x, targetHit.x, HIT_LAMBDA, dt);
            entry.uniforms.uHit.value.y = damp(entry.uniforms.uHit.value.y, targetHit.y, HIT_LAMBDA, dt);
            entry.uniforms.uHit.value.z = damp(entry.uniforms.uHit.value.z, targetHit.z, HIT_LAMBDA, dt);
          } else {
            entry.uniforms.uGrab.value = damp(entry.uniforms.uGrab.value, 0, GRAB_RELEASE, dt);
          }
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
      for (const entry of painted) entry.mesh.material = entry.mesh.material;
      painted.length = 0;
      scene.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} className={styles.stage} aria-hidden="true" />;
}

/** Equirect studio rig, drawn rather than shipped: broad bands over a dark
 *  ground give the surface something with shape to reflect. */
function buildEnvironment(width = 768, height = 384): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return canvas;

  ctx.fillStyle = '#0b1040';
  ctx.fillRect(0, 0, width, height);

  const bands: readonly { y: number; h: number; a: number }[] = [
    { y: 0.16, h: 0.18, a: 1.0 },
    { y: 0.40, h: 0.07, a: 0.55 },
    { y: 0.58, h: 0.035, a: 0.32 },
  ];
  for (const band of bands) {
    const top = band.y * height;
    const bottom = (band.y + band.h) * height;
    const gradient = ctx.createLinearGradient(0, top, 0, bottom);
    gradient.addColorStop(0, `rgba(255,255,255,0)`);
    gradient.addColorStop(0.5, `rgba(255,255,255,${band.a})`);
    gradient.addColorStop(1, `rgba(255,255,255,0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, top, width, bottom - top);
  }
  return canvas;
}

export default PaintHero;
