'use client';

import { useEffect, useRef } from 'react';
import {
  INTAKE_SPEED,
  buildPath,
  project,
  sampleAt,
  stepSpray,
  stepTube,
  type Camera,
  type Carried,
  type Ejected,
  type Path,
  type Point,
  type Projected,
} from '@/lib/landing/paint-tube';
import { createWorld, pourInto, stepPool, type World } from '@/lib/landing/rain-sim';
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

/** Most drops in the glass at once, so a long visit cannot fill the tube. */
const MAX_IN_TUBE = 34;

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
    let camera: Camera = { cx: 0, cy: 0, focal: 900 };

    const carried: Carried[] = [];
    const spray: Ejected[] = [];
    // The pool the spray builds, on the same shallow-water solver the rain used.
    let pool: World = createWorld(1, 1);

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
      // Vanishing point a little above centre, so the ride is looked at very
      // slightly from above — which is the angle the reference is drawn from.
      camera = { cx: width * 0.42, cy: height * 0.34, focal: Math.max(520, width * 0.85) };
      const previous = pool;
      pool = createWorld(width, height);
      // Keep whatever has already been poured across a resize.
      for (let i = 0; i < pool.pool.length; i += 1) {
        const was = previous.pool[i];
        const now = pool.pool[i];
        if (was === undefined || now === undefined) continue;
        now.h = was.h;
        now.r = was.r;
        now.g = was.g;
        now.b = was.b;
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    /*
     * Fed by the weather, not by a timer.
     *
     * A fixed feed rate meant the ride ran whether or not it was raining, which
     * made the fan decorative and the whole chain a coincidence. Every particle
     * in the tube is now a raindrop the fan actually caught.
     */
    const onIntake = (event: Event) => {
      const detail = (event as CustomEvent<{ color: number; size: number }>).detail;
      if (detail === undefined || carried.length >= MAX_IN_TUBE) return;
      carried.push({
        s: 0,
        // A spread of entry speeds, or every particle takes the ride at
        // exactly the same pace and they travel as one clump.
        v: INTAKE_SPEED * (0.78 + Math.random() * 0.5),
        lane: Math.random() * 2 - 1,
        size: Math.max(5, Math.min(12, detail.size)),
        color: detail.color,
      });
    };
    host.addEventListener('rain:intake', onIntake);

    // Pointer nudges the fan, which nudges what comes out of the nozzle.
    let aim = 0;
    const onMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      aim = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
    };
    host.addEventListener('pointermove', onMove, { passive: true });

    let frame = 0;
    let last = performance.now();
    let fanAngle = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (width === 0 || path.total === 0) return;
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;

      fanAngle += dt * 26;

      for (const ejected of stepTube(carried, path, dt)) {
        // The fan's aim tilts what leaves the open end.
        ejected.vy += aim * 220;
        spray.push(ejected);
      }

      /*
       * The spray hits the right-hand wall, runs down it, and joins the pool.
       *
       * Poured in at the foot of the wall rather than where it struck, because
       * that is where it would actually arrive: paint thrown at a vertical
       * surface does not stay where it lands, it runs. The pool then takes over
       * — it is the rain's shallow-water field, so the arriving volume raises a
       * column, the slope drives flow, and the wave spreads on its own.
       */
      for (const hit of stepSpray(spray, dt, 900, width - 2, height)) {
        const rgb = toRgb(roomsRef.current[hit.color % Math.max(1, roomsRef.current.length)]);
        pourInto(pool, width - 6 - Math.random() * 26, hit.size * 0.5, rgb);
      }
      stepPool(pool, dt);

      draw(context, { width, height, dpr, path, camera, carried, spray, pool, fanAngle }, roomsRef.current);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('rain:intake', onIntake);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}

/**
 * The ride, after the reference sketch.
 *
 * The first attempt at this was a single translucent tube winding through the
 * footer, and it did not read as a rollercoaster at all — it read as a glass
 * worm. What the reference actually has, and what a coaster silhouette is made
 * of, is STRUCTURE: a dominant teardrop loop, a second smaller loop beside it,
 * a flat run underneath, and the whole thing standing on columns. The track
 * itself is two rails with ties between them, not a pipe.
 *
 * So this is laid out as that: in from the left, down the drop, up and around a
 * tall teardrop loop, along the flat, round a smaller loop, and out to an open
 * end at 70% of the height aimed at the wall. `z` swings only where the track
 * crosses itself, which is the one place depth has to be read.
 */
function layout(width: number, height: number): Point[] {
  const x = (f: number) => width * f;
  const y = (f: number) => height * f;
  const back = Math.min(150, width * 0.11);

  return [
    // In from the left, where the fan delivers.
    { x: x(-0.04), y: y(0.2), z: 0 },
    { x: x(0.07), y: y(0.24), z: 0 },
    // The drop, gathering speed for the loop.
    { x: x(0.15), y: y(0.64), z: 0 },
    { x: x(0.2), y: y(0.82), z: 0 },

    /*
     * The teardrop loop. Tall and narrow, as the reference draws it — a
     * circular loop is not what coasters use, because the g-force at the
     * bottom of one is brutal; a teardrop is the real shape and it is also the
     * more striking silhouette.
     *
     * The far side runs at depth and the near side comes forward, so the
     * crossing at the bottom is unambiguous.
     */
    { x: x(0.29), y: y(0.7), z: back },
    { x: x(0.34), y: y(0.34), z: back },
    { x: x(0.28), y: y(0.1), z: back * 0.5 },
    { x: x(0.19), y: y(0.13), z: -back * 0.4 },
    { x: x(0.16), y: y(0.42), z: -back * 0.6 },
    { x: x(0.22), y: y(0.76), z: -back * 0.3 },

    // Out along the flat, under the loop.
    { x: x(0.36), y: y(0.88) , z: 0 },
    { x: x(0.5), y: y(0.86), z: 0 },

    // The second, smaller loop.
    { x: x(0.62), y: y(0.7), z: back * 0.8 },
    { x: x(0.7), y: y(0.46), z: back * 0.4 },
    { x: x(0.64), y: y(0.34), z: -back * 0.35 },
    { x: x(0.57), y: y(0.5), z: -back * 0.5 },
    { x: x(0.63), y: y(0.76), z: -back * 0.2 },

    // The run out, levelling as it comes forward.
    { x: x(0.78), y: y(0.8), z: 0 },
    { x: x(0.9), y: y(0.72), z: 0 },
    // Open end, at 70% down, pointing at the wall.
    { x: x(1.04), y: y(0.7), z: 0 },
  ];
}

interface Scene {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly path: Path;
  readonly camera: Camera;
  readonly carried: readonly Carried[];
  readonly spray: readonly Ejected[];
  readonly pool: World;
  readonly fanAngle: number;
}

/**
 * Everything, in depth order.
 *
 * The whole reason the track is 3D is that a loop crosses over itself, and in
 * two dimensions the near and far sides of a loop are the same line. So nothing
 * here draws in the order it was written — every piece of tube and every drop
 * is collected with the depth it sits at, sorted furthest-first, and painted in
 * that order. The far side of the loop goes down before the near side and comes
 * out smaller, and the shape of the ride becomes readable.
 */
function draw(context: CanvasRenderingContext2D, scene: Scene, rooms: readonly RoomColor[]): void {
  const { width, height, dpr, path, camera } = scene;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  drawPool(context, scene);
  // Structure first: the columns stand behind the track they carry.
  drawSupports(context, path, camera, height * 0.94);

  interface Piece {
    readonly z: number;
    readonly paint: () => void;
  }
  const pieces: Piece[] = [];

  /*
   * The tubing, in depth BANDS rather than segment by segment.
   *
   * Stroking each short segment on its own is the obvious way to depth-sort a
   * tube and it renders as a string of beads: every segment gets its own round
   * cap, and a hundred overlapping translucent discs is what you see. Grouping
   * consecutive segments that sit at a similar depth and stroking each group as
   * one polyline keeps the ordering — a band at the back is still drawn before
   * one at the front — while the glass inside a band is continuous.
   */
  const count = path.at.length;
  const BANDS = 16;
  let zMin = Number.POSITIVE_INFINITY;
  let zMax = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < count; i += 1) {
    const z = path.xyz[i * 3 + 2] ?? 0;
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
  }
  const span = Math.max(1, zMax - zMin);
  const bandOf = (z: number) =>
    Math.max(0, Math.min(BANDS - 1, Math.floor(((z - zMin) / span) * BANDS)));

  let runStart = 0;
  let runBand = bandOf(path.xyz[2] ?? 0);
  const flushRun = (endIndex: number) => {
    if (endIndex - runStart < 1) return;
    const from = runStart;
    const to = endIndex;
    let zSum = 0;
    for (let i = from; i <= to; i += 1) zSum += path.xyz[i * 3 + 2] ?? 0;
    const z = zSum / (to - from + 1);

    pieces.push({
      z,
      paint: () => {
        const points: Projected[] = [];
        for (let i = from; i <= to; i += 1) {
          points.push(
            project(
              path.xyz[i * 3] ?? 0,
              path.xyz[i * 3 + 1] ?? 0,
              path.xyz[i * 3 + 2] ?? 0,
              camera
            )
          );
        }
        drawTrackRun(context, points, from);
      },
    });
  };

  for (let i = 1; i < count; i += 1) {
    const band = bandOf(path.xyz[i * 3 + 2] ?? 0);
    if (band !== runBand) {
      // Overlap by one so consecutive bands meet with no seam between them.
      flushRun(i);
      runStart = i - 1;
      runBand = band;
    }
  }
  flushRun(count - 1);

  // The paint inside it.
  for (const particle of scene.carried) {
    const here = sampleAt(path, particle.s);
    // Rides off-centre across the bore, so they do not queue single file.
    const nx = -here.ty;
    const ny = here.tx;
    const offset = particle.lane * 5;
    const at = project(here.x + nx * offset, here.y + ny * offset, here.z, camera);
    const rgb = toRgb(rooms[particle.color % Math.max(1, rooms.length)]);
    pieces.push({
      z: here.z - 1,
      paint: () => drawPaint(context, at.sx, at.sy, particle.size * at.scale, rgb),
    });
  }

  for (const particle of scene.spray) {
    const at = project(particle.x, particle.y, particle.z, camera);
    const rgb = toRgb(rooms[particle.color % Math.max(1, rooms.length)]);
    pieces.push({
      z: particle.z - 1,
      paint: () => drawPaint(context, at.sx, at.sy, particle.size * at.scale, rgb),
    });
  }

  pieces.sort((a, b) => b.z - a.z);
  for (const piece of pieces) piece.paint();

  drawFan(context, scene);
}

/**
 * A length of track: two rails, the ties between them, and the bore.
 *
 * This is the difference between a rollercoaster and a pipe. The reference's
 * track is a ladder — two rails with sleepers across them — standing on
 * columns, and that structure is what the eye reads as a coaster before it has
 * worked out the shape. The first version drew one soft tube and read as a
 * glass worm no matter what the shape underneath was doing.
 *
 * Everything is still glass: the rails are bright hairlines, the ties are thin
 * translucent bars, and the bore between them is the dark body the paint runs
 * through. All three widths follow the perspective, so a run at the back of a
 * loop is genuinely slighter than one at the front.
 */
function drawTrackRun(
  context: CanvasRenderingContext2D,
  points: readonly Projected[],
  tieOffset: number
): void {
  if (points.length < 2) return;

  let scale = 0;
  for (const point of points) scale += point.scale;
  scale /= points.length;

  // The rails sit either side of the centre line, in screen space.
  const gauge = 13 * scale;
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];

  for (let i = 0; i < points.length; i += 1) {
    const here = points[i];
    const next = points[Math.min(points.length - 1, i + 1)];
    const prev = points[Math.max(0, i - 1)];
    if (here === undefined || next === undefined || prev === undefined) continue;

    const dx = next.sx - prev.sx;
    const dy = next.sy - prev.sy;
    const length = Math.hypot(dx, dy) || 1;
    // Perpendicular, normalised.
    const nx = -dy / length;
    const ny = dx / length;

    left.push({ x: here.sx + nx * gauge, y: here.sy + ny * gauge });
    right.push({ x: here.sx - nx * gauge, y: here.sy - ny * gauge });
  }

  const trace = (path: readonly { x: number; y: number }[]) => {
    context.beginPath();
    context.moveTo(path[0]?.x ?? 0, path[0]?.y ?? 0);
    for (let i = 1; i < path.length; i += 1) context.lineTo(path[i]?.x ?? 0, path[i]?.y ?? 0);
  };

  context.lineCap = 'round';
  context.lineJoin = 'round';

  // The bore: the dark glass body the paint travels inside.
  context.beginPath();
  context.moveTo(points[0]?.sx ?? 0, points[0]?.sy ?? 0);
  for (let i = 1; i < points.length; i += 1) {
    context.lineTo(points[i]?.sx ?? 0, points[i]?.sy ?? 0);
  }
  context.lineWidth = gauge * 2.05;
  context.strokeStyle = `rgba(150,200,255,${0.045 + scale * 0.03})`;
  context.stroke();
  context.lineWidth = gauge * 1.7;
  context.strokeStyle = `rgba(8,11,18,${0.4 * scale})`;
  context.stroke();

  /*
   * The ties. Spaced along the run rather than one per sample: at one per
   * sample they merge into a solid band and the ladder disappears, which is
   * exactly the texture that makes it read as track.
   */
  const spacing = Math.max(2, Math.round(5 / Math.max(0.35, scale)));
  context.lineWidth = Math.max(0.5, 1.5 * scale);
  context.strokeStyle = `rgba(214,236,255,${0.1 + scale * 0.16})`;
  context.beginPath();
  for (let i = (tieOffset % spacing); i < left.length; i += spacing) {
    const a = left[i];
    const b = right[i];
    if (a === undefined || b === undefined) continue;
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
  }
  context.stroke();

  // The rails themselves — the brightest thing, because they are the edges
  // where glass catches light.
  context.lineWidth = Math.max(0.7, 1.8 * scale);
  context.strokeStyle = `rgba(255,255,255,${0.18 + scale * 0.34})`;
  trace(left);
  context.stroke();
  trace(right);
  context.stroke();
}

/**
 * The columns the ride stands on.
 *
 * Placed where a real coaster is supported — under stretches of track that are
 * running roughly level, which is where the load is — and never inside a loop,
 * where a post would be crossing the track it holds up. Each runs from the
 * track down to the ground line and finishes in a base plate, which is the
 * detail in the reference that most says "structure" rather than "line".
 */
function drawSupports(
  context: CanvasRenderingContext2D,
  path: Path,
  camera: Camera,
  groundY: number
): void {
  const count = path.at.length;
  const every = 9;

  context.save();
  for (let i = every; i < count - every; i += every) {
    const ax = path.xyz[(i - 2) * 3] ?? 0;
    const ay = path.xyz[(i - 2) * 3 + 1] ?? 0;
    const bx = path.xyz[(i + 2) * 3] ?? 0;
    const by = path.xyz[(i + 2) * 3 + 1] ?? 0;
    const dx = bx - ax;
    const dy = by - ay;
    const slope = Math.abs(dy) / (Math.hypot(dx, dy) || 1);
    // Only under track that is running level enough to be carrying load.
    if (slope > 0.34) continue;

    const y = path.xyz[i * 3 + 1] ?? 0;
    if (y > groundY - 12) continue;

    const top = project(path.xyz[i * 3] ?? 0, y, path.xyz[i * 3 + 2] ?? 0, camera);
    const foot = project(path.xyz[i * 3] ?? 0, groundY, path.xyz[i * 3 + 2] ?? 0, camera);

    context.beginPath();
    context.moveTo(top.sx, top.sy);
    context.lineTo(foot.sx, foot.sy);
    context.lineWidth = Math.max(0.6, 2.4 * top.scale);
    context.strokeStyle = `rgba(190,214,240,${0.1 + top.scale * 0.12})`;
    context.stroke();

    // Base plate.
    const plate = 9 * foot.scale;
    context.beginPath();
    context.moveTo(foot.sx - plate, foot.sy);
    context.lineTo(foot.sx + plate, foot.sy);
    context.lineWidth = Math.max(0.8, 3 * foot.scale);
    context.strokeStyle = `rgba(200,222,246,${0.14 + foot.scale * 0.14})`;
    context.stroke();
  }
  context.restore();
}

/**
 * The fan, sitting on the line between the pale section above and this one.
 *
 * Drawn rather than imported: it is four blades and a hub, and an asset for
 * that would be a request, a cache entry and a licence to no purpose. It spins
 * fast enough to blur, which is the whole reason it reads as blowing.
 */
function drawFan(context: CanvasRenderingContext2D, scene: Scene): void {
  const { width, fanAngle } = scene;
  const x = width * 0.075;
  const y = 0;
  const r = Math.min(38, width * 0.03);

  context.save();
  context.translate(x, y);

  // Housing, straddling the edge so it reads as mounted on the seam.
  context.beginPath();
  context.arc(0, 0, r * 1.16, 0, Math.PI * 2);
  context.fillStyle = 'rgba(16,20,28,0.9)';
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = 'rgba(255,255,255,0.5)';
  context.stroke();

  // Blades. Two passes a few degrees apart, which is a cheap motion blur and
  // reads better than either a sharp blade or a plain smear.
  for (const [lag, alpha] of [[0, 0.55], [-0.22, 0.28], [-0.44, 0.14]] as const) {
    context.save();
    context.rotate(fanAngle + lag);
    for (let blade = 0; blade < 4; blade += 1) {
      context.rotate(Math.PI / 2);
      context.beginPath();
      context.moveTo(0, 0);
      context.quadraticCurveTo(r * 0.75, -r * 0.42, r * 0.94, r * 0.1);
      context.quadraticCurveTo(r * 0.5, r * 0.2, 0, 0);
      context.fillStyle = `rgba(226,240,255,${alpha})`;
      context.fill();
    }
    context.restore();
  }

  context.beginPath();
  context.arc(0, 0, r * 0.2, 0, Math.PI * 2);
  context.fillStyle = 'rgba(240,248,255,0.9)';
  context.fill();
  context.restore();
}

/**
 * The pool the spray builds at the foot of the footer.
 *
 * The same shallow-water field the rain used to gather in — depth at cell
 * centres, flow at the faces — so it sloshes, levels and carries waves at
 * `sqrt(g·h)` exactly as that one did. Reusing it rather than writing a second
 * liquid means there is one set of fluid behaviour on this page and one set of
 * tests behind it.
 */
function drawPool(context: CanvasRenderingContext2D, scene: Scene): void {
  const { width, height, pool } = scene;
  const columns = pool.pool.length;
  const columnWidth = width / columns;
  const floor = height;
  const surfaceY = (i: number) => floor - (pool.pool[i]?.h ?? 0);

  context.save();
  context.beginPath();
  context.moveTo(0, surfaceY(0));
  for (let i = 0; i < columns - 1; i += 1) {
    const x = (i + 0.5) * columnWidth;
    const nextX = (i + 1.5) * columnWidth;
    context.quadraticCurveTo(x, surfaceY(i), (x + nextX) / 2, (surfaceY(i) + surfaceY(i + 1)) / 2);
  }
  context.lineTo(width, surfaceY(columns - 1));
  context.lineTo(width, floor);
  context.lineTo(0, floor);
  context.closePath();

  const paint = context.createLinearGradient(0, 0, width, 0);
  for (let stop = 0; stop <= 8; stop += 1) {
    const column = pool.pool[Math.round((stop / 8) * (columns - 1))];
    if (column === undefined) continue;
    paint.addColorStop(
      stop / 8,
      `rgb(${Math.round(column.r)} ${Math.round(column.g)} ${Math.round(column.b)})`
    );
  }
  context.fillStyle = paint;
  context.fill();

  // A bright meniscus, which is what makes it read as wet.
  context.strokeStyle = 'rgba(255,255,255,0.3)';
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();
}

function drawPaint(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rgb: readonly [number, number, number]
): void {
  const r = Math.max(0.8, size / 2);
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
