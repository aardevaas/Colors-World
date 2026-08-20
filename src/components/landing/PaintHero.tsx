'use client';

import { useEffect, useRef, useState } from 'react';
import { PAINT_FRAGMENT_SOURCE, PAINT_VERTEX_SOURCE } from '@/lib/landing/paint-shader';
import { buildPaintSurface } from '@/lib/landing/paint-surface';
import type { RoomColor } from '@/lib/landing/room-palette';
import styles from './paint-hero.module.css';

/**
 * "Colors World", poured rather than typeset.
 *
 * Raw WebGL2 on purpose. The globe this replaced pulled in three.js, fiber,
 * drei and postprocessing — some 34MB installed and the heaviest chunk on the
 * page — to do work that is, in the end, one fullscreen triangle and one
 * texture fetch. None of that machinery earns its place here, and dropping it
 * took the landing page back under its performance budget while making the
 * hero more ambitious rather than less.
 *
 * The expensive part already happened before this component renders a frame:
 * the letterforms are rasterised to an offscreen canvas, run through an exact
 * distance transform, and baked into a normal map (see `paint-surface.ts`).
 * The GPU then only lights what the CPU already shaped.
 */

interface PaintHeroProps {
  /** Where on the hue wheel this visit starts. Every visitor gets a different
   *  spectrum, and the same seed feeds the room colours further down. */
  readonly seedHue: number;
  /** The six colours the rooms below will be painted in. The word is made of
   *  exactly these, so the hero shows the palette before it separates. */
  readonly rooms: readonly RoomColor[];
  readonly reducedMotion: boolean;
}

/** Texture the word is baked into. Wide enough for the letterforms to hold up
 *  on a large display, small enough that the distance transform is a blink. */
const SURFACE_WIDTH = 1024;
const SURFACE_HEIGHT = 288;

/** How fat the tubes are, as a fraction of the cap height. */
const TUBE_RADIUS_RATIO = 0.055;

/**
 * Where the word sits, in GL texture coordinates — origin bottom-left, so a
 * high `y` is near the top of the screen. Placed in the upper band, which the
 * HUD leaves empty: the flat headline underneath is the claim, and the painted
 * word above it is the name.
 */
const WORD_RECT = { x: 0.05, y: 0.66, width: 0.9, height: 0.26 } as const;

/** How quickly the rendered pointer catches up with the real one. Low enough
 *  that a flick across the screen still reads as the paint having weight. */
const POINTER_EASING = 0.09;

export function PaintHero({ seedHue, rooms, reducedMotion }: PaintHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [unsupported, setUnsupported] = useState(false);

  // Read through refs inside the frame loop so changing either never tears
  // down and rebuilds the GL context.
  const seedRef = useRef(seedHue);
  const reducedRef = useRef(reducedMotion);
  const roomsRef = useRef(rooms);
  seedRef.current = seedHue;
  reducedRef.current = reducedMotion;
  roomsRef.current = rooms;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    if (gl === null) {
      setUnsupported(true);
      return;
    }

    let disposed = false;
    let frame = 0;
    let program: WebGLProgram | null = null;
    let texture: WebGLTexture | null = null;
    let vao: WebGLVertexArrayObject | null = null;

    const pointer = { x: 0.5, y: 0.62 };
    const target = { x: 0.5, y: 0.62 };
    let ripple = 0;

    function handlePointerMove(event: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      target.x = (event.clientX - rect.left) / rect.width;
      // Flipped: WebGL's origin is bottom-left, the DOM's is top-left.
      target.y = 1 - (event.clientY - rect.top) / rect.height;
      ripple = 1;
    }

    function handlePointerLeave() {
      target.x = 0.5;
      target.y = 0.62;
    }

    function resize() {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.round(canvas!.clientWidth * ratio);
      const height = Math.round(canvas!.clientHeight * ratio);
      if (canvas!.width === width && canvas!.height === height) return;
      canvas!.width = width;
      canvas!.height = height;
      gl!.viewport(0, 0, width, height);
    }

    async function start() {
      // The word cannot be rasterised until the display face has actually
      // arrived — measuring against a fallback would bake the wrong shapes.
      if (document.fonts !== undefined) await document.fonts.ready;
      if (disposed) return;

      program = createProgram(gl!, PAINT_VERTEX_SOURCE, PAINT_FRAGMENT_SOURCE);
      if (program === null) {
        setUnsupported(true);
        return;
      }

      const coverage = rasteriseWord(canvas!);
      const surface = buildPaintSurface(
        coverage,
        SURFACE_WIDTH,
        SURFACE_HEIGHT,
        SURFACE_HEIGHT * TUBE_RADIUS_RATIO
      );

      texture = gl!.createTexture();
      gl!.bindTexture(gl!.TEXTURE_2D, texture);
      // A 2D canvas numbers its rows from the top and GL numbers them from the
      // bottom, so uploading as-is renders the word mirrored. Flipping here
      // rather than inverting v in the shader keeps every coordinate in the
      // fragment shader in one consistent space.
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, true);
      gl!.texImage2D(
        gl!.TEXTURE_2D, 0, gl!.RGBA, SURFACE_WIDTH, SURFACE_HEIGHT, 0,
        gl!.RGBA, gl!.UNSIGNED_BYTE, surface
      );
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      // Clamped, so the tilt sampling past the edge of the word cannot wrap a
      // stroke around to the opposite side.
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);

      // The vertex shader generates its own positions from gl_VertexID, so
      // there is nothing to bind — but WebGL2 still requires a bound VAO.
      vao = gl!.createVertexArray();

      const uniforms = {
        surface: gl!.getUniformLocation(program, 'uSurface'),
        resolution: gl!.getUniformLocation(program, 'uResolution'),
        pointer: gl!.getUniformLocation(program, 'uPointer'),
        time: gl!.getUniformLocation(program, 'uTime'),
        seedHue: gl!.getUniformLocation(program, 'uSeedHue'),
        wordRect: gl!.getUniformLocation(program, 'uWordRect'),
        ripple: gl!.getUniformLocation(program, 'uRipple'),
        reduced: gl!.getUniformLocation(program, 'uReduced'),
        // The location of element zero addresses the whole array.
        rooms: gl!.getUniformLocation(program, 'uRooms'),
      };
      const roomBuffer = new Float32Array(18);

      resize();
      window.addEventListener('resize', resize);
      canvas!.addEventListener('pointermove', handlePointerMove);
      canvas!.addEventListener('pointerleave', handlePointerLeave);

      const started = performance.now();

      function render(now: number) {
        if (disposed) return;
        const reduced = reducedRef.current;

        pointer.x += (target.x - pointer.x) * POINTER_EASING;
        pointer.y += (target.y - pointer.y) * POINTER_EASING;
        // The disturbance fades on its own, so the paint settles when the
        // pointer stops rather than rippling forever.
        ripple *= 0.94;

        gl!.useProgram(program);
        gl!.bindVertexArray(vao);
        gl!.activeTexture(gl!.TEXTURE0);
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        gl!.uniform1i(uniforms.surface, 0);
        gl!.uniform2f(uniforms.resolution, canvas!.width, canvas!.height);
        gl!.uniform2f(uniforms.pointer, pointer.x, pointer.y);
        gl!.uniform1f(uniforms.time, reduced ? 0 : (now - started) / 1000);
        gl!.uniform1f(uniforms.seedHue, (seedRef.current * Math.PI) / 180);
        gl!.uniform4f(
          uniforms.wordRect,
          WORD_RECT.x, WORD_RECT.y, WORD_RECT.width, WORD_RECT.height
        );
        gl!.uniform1f(uniforms.ripple, reduced ? 0 : ripple);
        gl!.uniform1f(uniforms.reduced, reduced ? 1 : 0);

        // Packed each frame rather than on change: six colours is eighteen
        // floats, which is cheaper to just write than to track.
        const palette = roomsRef.current;
        for (let i = 0; i < 6; i += 1) {
          const colour = palette[i % Math.max(1, palette.length)];
          roomBuffer[i * 3] = colour?.oklch.l ?? 0.68;
          roomBuffer[i * 3 + 1] = colour?.oklch.c ?? 0.14;
          roomBuffer[i * 3 + 2] = ((colour?.oklch.h ?? 0) * Math.PI) / 180;
        }
        gl!.uniform3fv(uniforms.rooms, roomBuffer);
        gl!.drawArrays(gl!.TRIANGLES, 0, 3);

        frame = requestAnimationFrame(render);
      }

      frame = requestAnimationFrame(render);
    }

    void start();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      if (texture !== null) gl.deleteTexture(texture);
      if (vao !== null) gl.deleteVertexArray(vao);
      if (program !== null) gl.deleteProgram(program);
    };
  }, []);

  return (
    <div className={styles.stage} data-unsupported={unsupported}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {/* Hidden while the shader is painting it, and promoted to the visible
          hero when WebGL is unavailable. Not an h1: the HUD carries the page's
          heading, and two would be a worse document than one. */}
      <p className={styles.heading} data-fallback={unsupported}>
        Colors World
      </p>
    </div>
  );
}

/** Draws the word to an offscreen canvas and returns its coverage. */
function rasteriseWord(host: HTMLCanvasElement): Float32Array {
  const offscreen = document.createElement('canvas');
  offscreen.width = SURFACE_WIDTH;
  offscreen.height = SURFACE_HEIGHT;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });

  const coverage = new Float32Array(SURFACE_WIDTH * SURFACE_HEIGHT);
  if (ctx === null) return coverage;

  const family =
    getComputedStyle(host).getPropertyValue('--font-display').trim() || 'sans-serif';

  // Fitted rather than fixed: the word has to fill the texture at any face,
  // and a hardcoded size would either clip or leave the letterforms small
  // enough that the tubes lose their roundness.
  let size = SURFACE_HEIGHT * 0.78;
  ctx.font = `800 ${size}px ${family}, sans-serif`;
  const measured = ctx.measureText('Colors World').width;
  const maxWidth = SURFACE_WIDTH * 0.94;
  if (measured > maxWidth) size *= maxWidth / measured;

  ctx.font = `800 ${size}px ${family}, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText('Colors World', SURFACE_WIDTH / 2, SURFACE_HEIGHT / 2);

  const { data } = ctx.getImageData(0, 0, SURFACE_WIDTH, SURFACE_HEIGHT);
  for (let i = 0; i < coverage.length; i += 1) {
    coverage[i] = data[i * 4 + 3]! / 255;
  }
  return coverage;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (vertex === null || fragment === null) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  // Shaders are reference-counted by the program, so they can go now.
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (shader === null) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
