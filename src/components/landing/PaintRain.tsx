'use client';

import { useEffect, useRef } from 'react';
import { MAX_DROPS, buildDrops, fieldOpacity } from '@/lib/landing/rain';
import {
  MAX_POOL,
  POOL_COLUMNS,
  createWorld,
  step,
  type SimDrop,
  type Surface,
} from '@/lib/landing/rain-sim';
import type { RoomColor } from '@/lib/landing/room-palette';
import styles from './paint-rain.module.css';

/**
 * Paint falling across the page, and what happens when it lands on something.
 *
 * This was 150 spans each running a CSS `fall` keyframe, which is the right
 * build for weather that only has to fall and the wrong one the moment drops
 * have to interact — a keyframe cannot be told that a button is in the way. It
 * is now a single canvas driven by `rain-sim.ts`, which owns all the physics
 * and none of the drawing.
 *
 * Three interactions, all of them the simulation's doing rather than effects
 * played on top:
 *
 *   1. A drop that meets a button LANDS on it, sits for a beat, then runs off
 *      the nearer edge and carries on falling.
 *   2. The GitHub button ABSORBS what hits it. Absorbed drops drift around
 *      inside it and stay, which is why that button now ships empty: the
 *      hand-placed blobs it used to carry have been replaced by whatever the
 *      weather has put in it.
 *   3. Everything that reaches the foot of the page POOLS as paint, and the
 *      surface of that pool is a spring-coupled height field — the waves are
 *      an integration, not an animation of one.
 *
 * Surfaces are read from the DOM each frame rather than passed as props: they
 * move whenever the page scrolls, and a stale rect means drops landing on
 * nothing. Three `getBoundingClientRect` calls a frame is nothing next to the
 * 150 the old build made just by existing.
 */

interface PaintRainProps {
  /** How many drops should be in the air. The caller quantises intensity to an
   *  integer so the field only changes when it genuinely needs to. */
  readonly count: number;
  readonly rooms: readonly RoomColor[];
  readonly reducedMotion?: boolean;
}

/** Beyond this the absorbing button is full and starts shedding like the rest.
 *  Without a cap the whole field eventually ends up inside one pill. */
const ABSORB_CAPACITY = 16;

/** Longest frame the simulation will accept, seconds. A backgrounded tab hands
 *  back a delta of several seconds, and every drop would teleport through every
 *  surface in one step. */
const MAX_STEP = 1 / 30;

export function PaintRain({ count, rooms, reducedMotion = false }: PaintRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const countRef = useRef(count);
  countRef.current = count;
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const context = canvas.getContext('2d');
    if (context === null) return;

    const world = createWorld(window.innerWidth, window.innerHeight);
    const field = buildDrops(MAX_DROPS);
    const drops: SimDrop[] = field.map((drop, index) => ({
      x: (drop.left / 100) * window.innerWidth,
      // Spread through the fall on the first frame rather than released as a
      // wave from the top edge — the same job the negative CSS delay did.
      y: -window.innerHeight * 0.4 + ((index / MAX_DROPS) * 1.6 - 0.2) * window.innerHeight,
      vx: drop.sway * 0.4,
      vy: 120 + (1 - drop.depth) * 240,
      size: drop.size,
      color: drop.roomIndex,
      depth: drop.depth,
      phase: 'falling',
      host: -1,
      restLeft: 0,
      runoff: 1,
    }));
    world.drops.push(...drops);

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      world.width = window.innerWidth;
      world.height = window.innerHeight;
      canvas.width = Math.round(world.width * dpr);
      canvas.height = Math.round(world.height * dpr);
      canvas.style.width = `${world.width}px`;
      canvas.style.height = `${world.height}px`;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(MAX_STEP, (now - last) / 1000);
      last = now;

      const surfaces = readSurfaces(world.drops);
      const palette = roomsRef.current.map(toRgb);

      // The floor is the foot of the DOCUMENT, not of the viewport: paint
      // gathers where the page ends, so it is only ever seen from the footer.
      world.floor = document.documentElement.scrollHeight - window.scrollY;

      recycle(world.drops, countRef.current);
      step(world, dt, surfaces, palette);
      draw(context, world, surfaces, palette, dpr, countRef.current);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return <canvas ref={canvasRef} className={styles.field} aria-hidden="true" />;
}

/* ----------------------------------------------------------------- surfaces */

/**
 * The things the rain can land on, straight from the DOM.
 *
 * Marked with `data-rain-surface` rather than looked up by class, so a
 * component opts in where it is written instead of this file keeping a list of
 * selectors that drifts the moment anything is renamed.
 */
function readSurfaces(drops: readonly SimDrop[]): Surface[] {
  const nodes = document.querySelectorAll<HTMLElement>('[data-rain-surface]');
  const surfaces: Surface[] = [];
  let index = 0;

  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0) continue;

    const wantsToAbsorb = node.dataset.rainSurface === 'absorb';
    const held = wantsToAbsorb
      ? drops.reduce((n, d) => (d.phase === 'absorbed' && d.host === index ? n + 1 : n), 0)
      : 0;

    surfaces.push({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      // A full button sheds like any other, rather than swallowing the field.
      absorbs: wantsToAbsorb && held < ABSORB_CAPACITY,
    });
    index += 1;
  }
  return surfaces;
}

/** Puts pooled drops back at the top, keeping `target` of them in the air. */
function recycle(drops: SimDrop[], target: number): void {
  let airborne = 0;
  for (const drop of drops) {
    if (drop.phase === 'falling' || drop.phase === 'resting') airborne += 1;
  }

  for (const drop of drops) {
    if (airborne >= target) break;
    if (drop.phase !== 'pooled') continue;
    drop.phase = 'falling';
    drop.x = Math.random() * window.innerWidth;
    drop.y = -drop.size - Math.random() * window.innerHeight * 0.5;
    drop.vy = 120;
    drop.vx = (Math.random() - 0.5) * 30;
    drop.host = -1;
    airborne += 1;
  }

  // Anything airborne beyond the target is parked off-screen until it is wanted
  // again, so lowering the count thins the rain without deleting anyone's fall.
  for (let i = drops.length - 1; i >= 0 && airborne > target; i -= 1) {
    const drop = drops[i];
    if (drop === undefined || drop.phase !== 'falling') continue;
    if (drop.y < 0) {
      drop.phase = 'pooled';
      airborne -= 1;
    }
  }
}

/* ------------------------------------------------------------------ drawing */

function draw(
  context: CanvasRenderingContext2D,
  world: ReturnType<typeof createWorld>,
  surfaces: readonly Surface[],
  palette: readonly [number, number, number][],
  dpr: number,
  count: number
): void {
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, world.width, world.height);
  context.globalAlpha = fieldOpacity(count / MAX_DROPS);

  drawPool(context, world);

  for (const drop of world.drops) {
    if (drop.phase === 'pooled') continue;
    const rgb = palette[drop.color % Math.max(1, palette.length)] ?? [124, 92, 255];

    if (drop.phase === 'absorbed') {
      const surface = surfaces[drop.host];
      if (surface === undefined) continue;
      // Clipped to its host, so a drop inside a pill never draws outside it.
      context.save();
      roundedRect(context, surface, (surface.bottom - surface.top) / 2);
      context.clip();
      drawDrop(context, drop, rgb, true);
      context.restore();
      continue;
    }
    drawDrop(context, drop, rgb, false);
  }
  context.globalAlpha = 1;
}

/** A teardrop: round below, drawn to a point above, with one hard specular. */
function drawDrop(
  context: CanvasRenderingContext2D,
  drop: SimDrop,
  rgb: readonly [number, number, number],
  suspended: boolean
): void {
  const r = drop.size / 2;
  const [red, green, blue] = rgb;
  const dim = 1 - drop.depth * 0.4;

  context.save();
  context.translate(drop.x, drop.y);
  context.globalAlpha *= dim;

  context.beginPath();
  if (suspended) {
    // Inside a button it is a bubble, not a falling drop — nothing is pulling
    // it into a teardrop in there.
    context.arc(0, 0, r, 0, Math.PI * 2);
  } else {
    context.moveTo(0, -r * 1.5);
    context.bezierCurveTo(r * 0.92, -r * 0.28, r, r * 0.34, 0, r);
    context.bezierCurveTo(-r, r * 0.34, -r * 0.92, -r * 0.28, 0, -r * 1.5);
  }

  const body = context.createLinearGradient(0, -r, 0, r);
  body.addColorStop(0, `rgb(${lighten(red)} ${lighten(green)} ${lighten(blue)})`);
  body.addColorStop(0.55, `rgb(${red} ${green} ${blue})`);
  body.addColorStop(1, `rgb(${darken(red)} ${darken(green)} ${darken(blue)})`);
  context.fillStyle = body;
  context.fill();

  context.beginPath();
  context.arc(-r * 0.3, -r * 0.34, r * 0.26, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255,255,255,0.9)';
  context.fill();
  context.restore();
}

/**
 * The pool, drawn as one filled path across the width.
 *
 * The surface follows the height field column by column, smoothed with a
 * quadratic through the midpoints so a 120-column field reads as liquid rather
 * than as a bar chart. Colour is sampled from the columns, so the paint is
 * literally made of what has landed in it.
 */
function drawPool(
  context: CanvasRenderingContext2D,
  world: ReturnType<typeof createWorld>
): void {
  const floor = world.floor;
  if (floor > world.height + MAX_POOL) return;

  const columnWidth = world.width / POOL_COLUMNS;
  const surfaceY = (i: number) => floor - (world.pool[i]?.h ?? 0);

  context.save();
  context.beginPath();
  context.moveTo(0, surfaceY(0));
  for (let i = 0; i < POOL_COLUMNS - 1; i += 1) {
    const x = (i + 0.5) * columnWidth;
    const nextX = (i + 1.5) * columnWidth;
    context.quadraticCurveTo(x, surfaceY(i), (x + nextX) / 2, (surfaceY(i) + surfaceY(i + 1)) / 2);
  }
  context.lineTo(world.width, surfaceY(POOL_COLUMNS - 1));
  context.lineTo(world.width, floor + MAX_POOL);
  context.lineTo(0, floor + MAX_POOL);
  context.closePath();

  const paint = context.createLinearGradient(0, 0, world.width, 0);
  for (let stop = 0; stop <= 8; stop += 1) {
    const column = world.pool[Math.round((stop / 8) * (POOL_COLUMNS - 1))];
    if (column === undefined) continue;
    paint.addColorStop(
      stop / 8,
      `rgb(${Math.round(column.r)} ${Math.round(column.g)} ${Math.round(column.b)})`
    );
  }
  context.fillStyle = paint;
  context.fill();

  // A bright meniscus along the top, which is what makes it read as wet.
  context.strokeStyle = 'rgba(255,255,255,0.32)';
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  surface: Surface,
  radius: number
): void {
  const { left, top, right, bottom } = surface;
  const r = Math.min(radius, (right - left) / 2, (bottom - top) / 2);
  context.beginPath();
  context.moveTo(left + r, top);
  context.arcTo(right, top, right, bottom, r);
  context.arcTo(right, bottom, left, bottom, r);
  context.arcTo(left, bottom, left, top, r);
  context.arcTo(left, top, right, top, r);
  context.closePath();
}

function toRgb(room: RoomColor): [number, number, number] {
  const hex = room.hex.replace('#', '');
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

const lighten = (channel: number) => Math.min(255, Math.round(channel + (255 - channel) * 0.34));
const darken = (channel: number) => Math.round(channel * 0.72);

export default PaintRain;
