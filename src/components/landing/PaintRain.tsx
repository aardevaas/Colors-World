'use client';

import { useEffect, useRef } from 'react';
import { MAX_DROPS, buildDrops, fieldOpacity } from '@/lib/landing/rain';
import {
  MAX_POOL,
  POOL_COLUMNS,
  TERMINAL_FAR,
  TERMINAL_NEAR,
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
      vx: drop.sway * 0.16,
      // Starts at its own top speed rather than accelerating into frame, so
      // the field looks like rain already falling rather than rain released.
      vy: TERMINAL_FAR + (1 - drop.depth) * (TERMINAL_NEAR - TERMINAL_FAR),
      size: drop.size,
      color: drop.roomIndex,
      depth: drop.depth,
      phase: 'falling',
      host: -1,
      restLeft: 0,
      runoff: 1,
      // Deterministic, from the field's own index — a random seed here would
      // differ between server and client and trip hydration.
      seed: (index * 2.399963) % (Math.PI * 2),
      terminal: TERMINAL_FAR + (1 - drop.depth) * (TERMINAL_NEAR - TERMINAL_FAR),
      squash: 0,
      spread: 0,
    }));
    world.drops.push(...drops);

    const surfaceNodes: HTMLElement[] = [];
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

      const surfaces = readSurfaces(surfaceNodes);
      const palette = roomsRef.current.map(toRgb);

      // The floor is the foot of the DOCUMENT, not of the viewport: paint
      // gathers where the page ends, so it is only ever seen from the footer.
      world.floor = document.documentElement.scrollHeight - window.scrollY;

      recycle(world.drops, countRef.current);
      step(world, dt, surfaces, palette, now / 1000);
      handOverAbsorbed(world.drops, surfaceNodes);
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
function readSurfaces(nodesOut: HTMLElement[]): Surface[] {
  const nodes = document.querySelectorAll<HTMLElement>('[data-rain-surface]');
  const surfaces: Surface[] = [];
  nodesOut.length = 0;

  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0) continue;
    /*
     * Faded-out surfaces are not surfaces.
     *
     * This is what made the rain behave as though the footer were a button. The
     * hero lives inside `.pinned`, which is `position: fixed`, so its three
     * controls keep valid viewport rects at EVERY scroll depth — they are
     * merely faded to nothing by the scroll. Read straight from the DOM they
     * were still solid, so at the foot of the page drops were landing on and
     * running off three invisible objects hanging in mid-air.
     */
    if (effectiveOpacity(node) < 0.5) continue;

    nodesOut.push(node);
    surfaces.push({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      absorbs: node.dataset.rainSurface === 'absorb',
      // The element's real corner radius: drops run around the shoulders rather
      // than off a bounding box. `999px` on a pill resolves to half its height
      // inside `surfaceAt`, which is the same thing the browser draws.
      radius: Number.parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0,
    });
  }
  return surfaces;
}

/**
 * Hands a landed drop to the button that caught it, and lets the drop go.
 *
 * The rain no longer draws anything inside the absorbing button — that button
 * has its own canvas beneath its own label now (see LiquidField), which is the
 * only way the label can sit on top of the blobs the way the reference has it.
 * So a drop absorbed here is announced and then released back to the field,
 * rather than being kept and drawn.
 */
function handOverAbsorbed(drops: SimDrop[], nodes: readonly HTMLElement[]): void {
  for (const drop of drops) {
    if (drop.phase !== 'absorbed') continue;
    const node = nodes[drop.host];
    if (node !== undefined) {
      const rect = node.getBoundingClientRect();
      node.dispatchEvent(
        new CustomEvent('rain:absorb', {
          detail: { color: drop.color, x: drop.x - rect.left },
        })
      );
    }
    // Straight back into circulation, so the field never thins out.
    drop.phase = 'pooled';
  }
}

/**
 * An element's opacity including every ancestor's.
 *
 * `getComputedStyle(node).opacity` reports only the node's own, and the hero's
 * fade is applied several levels up. Walks to the body — a handful of nodes per
 * surface, three surfaces, once a frame.
 */
function effectiveOpacity(node: HTMLElement): number {
  let opacity = 1;
  let current: HTMLElement | null = node;
  while (current !== null && current !== document.body) {
    opacity *= Number.parseFloat(getComputedStyle(current).opacity) || 0;
    if (opacity < 0.01) return 0;
    current = current.parentElement;
  }
  return opacity;
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
    drop.vy = drop.terminal * 0.7;
    drop.vx = (Math.random() - 0.5) * 12;
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
  drawSplashes(context, world);

  for (const drop of world.drops) {
    // Absorbed drops belong to the button that caught them and are drawn on its
    // own canvas; pooled ones have become paint.
    if (drop.phase === 'pooled' || drop.phase === 'absorbed') continue;
    drawDrop(context, drop, palette[drop.color % Math.max(1, palette.length)] ?? [124, 92, 255]);
  }
  context.globalAlpha = 1;
}

/**
 * A drop, in whichever shape it currently is.
 *
 * Three, and the difference between them is the whole point: a falling drop is
 * a teardrop, a drop touching something is a BEAD — wide, low, and flat where
 * it meets the surface — and a bead that is running is that same bead stretched
 * out behind itself. Drawing an airborne teardrop while a drop sits on a button
 * is the single thing that most gave the interaction away.
 *
 * `spread` carries which of those it is: 0 in the air, rising hard on impact,
 * relaxing to a resting dome, stretching again once it runs.
 */
function drawDrop(
  context: CanvasRenderingContext2D,
  drop: SimDrop,
  rgb: readonly [number, number, number]
): void {
  const r = drop.size / 2;
  const [red, green, blue] = rgb;

  context.save();
  context.translate(drop.x, drop.y);
  context.globalAlpha *= 1 - drop.depth * 0.4;

  const body = context.createLinearGradient(0, -r, 0, r);
  body.addColorStop(0, `rgb(${lighten(red)} ${lighten(green)} ${lighten(blue)})`);
  body.addColorStop(0.55, `rgb(${red} ${green} ${blue})`);
  body.addColorStop(1, `rgb(${darken(red)} ${darken(green)} ${darken(blue)})`);
  context.fillStyle = body;

  if (drop.spread > 0.04) {
    drawBead(context, drop, r);
  } else {
    drawTeardrop(context, drop, r);
  }
  context.fill();

  // One hard specular. On a bead it sits nearer the top, because the bead is
  // flatter and the highlight rides its crown.
  context.beginPath();
  context.arc(-r * 0.3, -r * (0.34 + drop.spread * 0.2), r * 0.24, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255,255,255,0.9)';
  context.fill();
  context.restore();
}

/** In the air: round below, drawn to a point above. */
function drawTeardrop(context: CanvasRenderingContext2D, drop: SimDrop, r: number): void {
  if (drop.squash > 0.01) {
    context.scale(1 + drop.squash * 0.4, 1 - drop.squash * 0.34);
  }
  context.beginPath();
  context.moveTo(0, -r * 1.5);
  context.bezierCurveTo(r * 0.92, -r * 0.28, r, r * 0.34, 0, r);
  context.bezierCurveTo(-r, r * 0.34, -r * 0.92, -r * 0.28, 0, -r * 1.5);
}

/**
 * Touching something: a bead with a flat foot.
 *
 * Volume is held roughly constant as it spreads — a drop that flattens gets
 * WIDER, it does not shrink — so the width scales up by the same factor the
 * height scales down. The foot is flat because that is where the surface is,
 * and the trailing side is drawn out when it is moving, which is what a bead
 * running down glass actually looks like.
 */
function drawBead(context: CanvasRenderingContext2D, drop: SimDrop, r: number): void {
  const flatten = 1 - drop.spread * 0.52;
  const widen = 1 / flatten;
  const halfWidth = r * widen;
  const height = r * flatten * 2;
  const tail = Math.max(0, Math.min(1.6, Math.abs(drop.vx) / 150)) * halfWidth;
  const lead = Math.sign(drop.vx) || 1;

  // Foot on the surface, crown above it, and a tail dragged out behind.
  context.beginPath();
  context.moveTo(-halfWidth - (lead < 0 ? 0 : tail), r);
  context.bezierCurveTo(
    -halfWidth * 1.05 - (lead < 0 ? 0 : tail),
    r - height * 0.9,
    -halfWidth * 0.45,
    r - height,
    0,
    r - height
  );
  context.bezierCurveTo(
    halfWidth * 0.45,
    r - height,
    halfWidth * 1.05 + (lead > 0 ? 0 : tail),
    r - height * 0.9,
    halfWidth + (lead > 0 ? 0 : tail),
    r
  );
  context.closePath();
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

/**
 * A landing: a ring spreading outward, and a crown of thrown droplets.
 *
 * Both ease out hard, because an impact is fast at the start and nearly still
 * by the end — a linear expansion reads as a growing circle rather than as
 * something that was hit.
 */
function drawSplashes(
  context: CanvasRenderingContext2D,
  world: ReturnType<typeof createWorld>
): void {
  for (const splash of world.splashes) {
    const y = world.floor - splash.y;
    if (y < -40 || y > world.height + 40) continue;

    const eased = 1 - (1 - splash.t) ** 3;
    const fade = 1 - splash.t;
    const color = `rgb(${splash.r} ${splash.g} ${splash.b})`;

    context.save();

    // The ring.
    context.beginPath();
    context.ellipse(splash.x, y, splash.size * (0.5 + eased * 3.4), splash.size * (0.2 + eased * 1.1), 0, 0, Math.PI * 2);
    context.strokeStyle = color;
    context.globalAlpha *= fade * 0.65;
    context.lineWidth = Math.max(0.6, 2.2 * fade);
    context.stroke();

    // The crown: droplets thrown up and out, falling back as it fades.
    const crown = 7;
    for (let i = 0; i < crown; i += 1) {
      const angle = (i / crown) * Math.PI * 2 + splash.x;
      const reach = splash.size * (0.4 + eased * 2.2);
      const lift = Math.sin(splash.t * Math.PI) * splash.size * 1.5;
      context.beginPath();
      context.arc(
        splash.x + Math.cos(angle) * reach,
        y - lift + Math.sin(angle) * reach * 0.25,
        Math.max(0.5, splash.size * 0.17 * fade),
        0,
        Math.PI * 2
      );
      context.fillStyle = color;
      context.fill();
    }
    context.restore();
  }
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
