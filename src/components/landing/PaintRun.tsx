'use client';

import { useEffect, useRef } from 'react';
import {
  INTAKE_SPEED,
  buildPath,
  sampleAt,
  stepSpray,
  stepTube,
  type Carried,
  type Ejected,
  type Path,
  type Point,
} from '@/lib/landing/paint-tube';
import type { RoomColor } from '@/lib/landing/room-palette';
import styles from './paint-run.module.css';

/**
 * Where the rain ends up: a fan, a length of glass, and a wall it gets hosed at.
 *
 * The paint used to pool flat across the foot of the page, which is where it
 * would honestly go and is not much to watch. Here it is caught by a fan,
 * gathered to one intake, run down a tube through a full loop and a chicane,
 * and sprayed out of the far end against the right-hand edge, which it paints.
 *
 * The cheat is entirely in WHERE the paint is allowed to go. How it goes there
 * is still physics — a particle in the tube is on a track, driven by the
 * component of gravity along the tangent, so it accelerates down the entry
 * drop, spends that speed climbing the loop and is slowest at the crown. See
 * `paint-tube.ts`, which owns all of it and knows nothing about canvases.
 */

interface PaintRunProps {
  /** The generated six. The paint is the same colors as the weather. */
  readonly rooms: readonly RoomColor[];
}

/** Drops fed in per second. Independent of the rain above, which is a fixed
 *  field — this is the flow the ride is designed for. */
const FEED_PER_SECOND = 5.5;
/** Most drops in the glass at once, so a long visit cannot fill the tube. */
const MAX_IN_TUBE = 34;
/** Rows the painted wall is divided into. */
const WALL_ROWS = 90;
/** Ceiling on how far the paint creeps out from the wall, px. */
const MAX_WALL = 74;

export function PaintRun({ rooms }: PaintRunProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const host = canvas.parentElement;
    if (host === null) return;
    const context = canvas.getContext('2d');
    if (context === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let path: Path = buildPath([]);

    const carried: Carried[] = [];
    const spray: Ejected[] = [];
    const wall = new Float64Array(WALL_ROWS);
    const wallColor = new Float64Array(WALL_ROWS * 3);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width === 0) return;
      width = rect.width;
      height = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      path = buildPath(layout(width, height));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    // Pointer nudges the fan, which nudges what comes out of the nozzle.
    let aim = 0;
    const onMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      aim = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
    };
    host.addEventListener('pointermove', onMove, { passive: true });

    let frame = 0;
    let last = performance.now();
    let owed = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (width === 0 || path.total === 0) return;
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;

      // The fan, feeding the intake.
      owed += dt * FEED_PER_SECOND;
      while (owed >= 1) {
        owed -= 1;
        if (carried.length < MAX_IN_TUBE) {
          carried.push({
            s: 0,
            v: INTAKE_SPEED,
            lane: Math.random() * 2 - 1,
            size: 5 + Math.random() * 7,
            color: Math.floor(Math.random() * 6),
          });
        }
      }

      for (const ejected of stepTube(carried, path, dt)) {
        // The fan's aim tilts what leaves the nozzle.
        ejected.vy += aim * 220;
        spray.push(ejected);
      }

      for (const hit of stepSpray(spray, dt, 900, width - 2, height)) {
        paintWall(wall, wallColor, hit, height, roomsRef.current);
      }

      draw(context, { width, height, dpr, path, carried, spray, wall, wallColor }, roomsRef.current);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('pointermove', onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}

/**
 * The run, in the space available.
 *
 * Laid out in fractions so it holds its shape at any width: a funnel at the
 * left, a drop, a full loop, a chicane across the middle, and a nozzle aimed at
 * the right-hand edge. The loop is placed where there is height for it, which
 * is why the whole thing sits low.
 */
function layout(width: number, height: number): Point[] {
  const x = (fraction: number) => width * fraction;
  const y = (fraction: number) => height * fraction;

  return [
    { x: x(0.06), y: y(0.06) },
    { x: x(0.1), y: y(0.34) },
    { x: x(0.17), y: y(0.62) },
    // The loop.
    { x: x(0.26), y: y(0.82) },
    { x: x(0.34), y: y(0.5) },
    { x: x(0.26), y: y(0.26) },
    { x: x(0.18), y: y(0.5) },
    { x: x(0.26), y: y(0.82) },
    /*
     * Chicane along the FOOT of the section rather than across its middle.
     *
     * The first layout ran it straight through where the link columns are, and
     * a tube behind a list of links is a tube you cannot read links against.
     * Kept low, it passes under them.
     */
    { x: x(0.42), y: y(0.92) },
    { x: x(0.56), y: y(0.74) },
    { x: x(0.7), y: y(0.9) },
    { x: x(0.84), y: y(0.66) },
    // Nozzle, aimed at the wall.
    { x: x(0.95), y: y(0.5) },
  ];
}

function paintWall(
  wall: Float64Array,
  wallColor: Float64Array,
  hit: { y: number; color: number; size: number; speed: number },
  height: number,
  rooms: readonly RoomColor[]
): void {
  const row = Math.max(0, Math.min(WALL_ROWS - 1, Math.floor((hit.y / height) * WALL_ROWS)));
  const rgb = toRgb(rooms[hit.color % Math.max(1, rooms.length)]);
  // A faster hit spreads further, as a thrown drop does.
  const gain = hit.size * (0.5 + hit.speed / 900);

  // Spread over the neighbours too, so the wall builds as a run rather than as
  // a bar chart of individual hits.
  for (let offset = -2; offset <= 2; offset += 1) {
    const index = row + offset;
    if (index < 0 || index >= WALL_ROWS) continue;
    const share = gain * (offset === 0 ? 0.5 : offset === -1 || offset === 1 ? 0.2 : 0.05);
    const before = wall[index] ?? 0;
    wall[index] = Math.min(MAX_WALL, before + share);

    const mix = before < 0.5 ? 1 : Math.min(0.4, share / Math.max(1, before));
    for (let c = 0; c < 3; c += 1) {
      const at = index * 3 + c;
      wallColor[at] = (wallColor[at] ?? 0) + ((rgb[c] ?? 0) - (wallColor[at] ?? 0)) * mix;
    }
  }
}

interface Scene {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly path: Path;
  readonly carried: readonly Carried[];
  readonly spray: readonly Ejected[];
  readonly wall: Float64Array;
  readonly wallColor: Float64Array;
}

function draw(
  context: CanvasRenderingContext2D,
  scene: Scene,
  rooms: readonly RoomColor[]
): void {
  const { width, height, dpr, path } = scene;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  drawWall(context, scene);
  drawGlass(context, path);

  // What is in the tube.
  for (const particle of scene.carried) {
    const here = sampleAt(path, particle.s);
    // Rides off-centre across the bore, so they do not queue single file.
    const nx = -here.ty;
    const ny = here.tx;
    const offset = particle.lane * 5;
    drawPaint(
      context,
      here.x + nx * offset,
      here.y + ny * offset,
      particle.size,
      toRgb(rooms[particle.color % Math.max(1, rooms.length)])
    );
  }

  for (const particle of scene.spray) {
    drawPaint(
      context,
      particle.x,
      particle.y,
      particle.size,
      toRgb(rooms[particle.color % Math.max(1, rooms.length)])
    );
  }
}

/**
 * The tubing: three strokes on one path.
 *
 * A wide dark bore, a narrower bright fill, and a thin highlight offset toward
 * the top — which is how a cylinder of glass reads when it is drawn rather than
 * rendered. Nothing here is animated; it is the thing the paint moves through.
 */
function drawGlass(context: CanvasRenderingContext2D, path: Path): void {
  const trace = () => {
    context.beginPath();
    context.moveTo(path.xy[0] ?? 0, path.xy[1] ?? 0);
    for (let i = 1; i < path.at.length; i += 1) {
      context.lineTo(path.xy[i * 2] ?? 0, path.xy[i * 2 + 1] ?? 0);
    }
  };

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';

  trace();
  context.lineWidth = 26;
  context.strokeStyle = 'rgba(255,255,255,0.045)';
  context.stroke();

  trace();
  context.lineWidth = 22;
  context.strokeStyle = 'rgba(180,220,255,0.035)';
  context.stroke();

  // The rim is what actually says "glass"; it can stay crisp while the bore
  // behind it is quiet enough to read text over.
  trace();
  context.lineWidth = 1;
  context.strokeStyle = 'rgba(255,255,255,0.16)';
  context.stroke();
  context.restore();
}

/** The paint on the right-hand edge, built from what has hit it. */
function drawWall(context: CanvasRenderingContext2D, scene: Scene): void {
  const { width, height, wall, wallColor } = scene;
  const rowHeight = height / WALL_ROWS;

  context.save();
  context.beginPath();
  context.moveTo(width, 0);
  for (let i = 0; i < WALL_ROWS; i += 1) {
    const depth = wall[i] ?? 0;
    context.lineTo(width - depth, (i + 0.5) * rowHeight);
  }
  context.lineTo(width, height);
  context.closePath();

  const paint = context.createLinearGradient(0, 0, 0, height);
  for (let stop = 0; stop <= 6; stop += 1) {
    const row = Math.round((stop / 6) * (WALL_ROWS - 1)) * 3;
    paint.addColorStop(
      stop / 6,
      `rgb(${Math.round(wallColor[row] ?? 0)} ${Math.round(wallColor[row + 1] ?? 0)} ${Math.round(
        wallColor[row + 2] ?? 0
      )})`
    );
  }
  context.fillStyle = paint;
  context.fill();
  context.restore();
}

function drawPaint(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rgb: readonly [number, number, number]
): void {
  const r = size / 2;
  const fill = context.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  fill.addColorStop(0, `rgb(${Math.min(255, rgb[0] + 60)} ${Math.min(255, rgb[1] + 60)} ${Math.min(255, rgb[2] + 60)})`);
  fill.addColorStop(1, `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`);

  context.beginPath();
  context.arc(x, y, r, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();
}

function toRgb(room: RoomColor | undefined): [number, number, number] {
  const hex = (room?.hex ?? '#7c5cff').replace('#', '');
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

export default PaintRun;
