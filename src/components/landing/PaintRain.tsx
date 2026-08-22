'use client';

import { useEffect, useRef } from 'react';
import { MAX_DROPS, buildDrops, fieldOpacity } from '@/lib/landing/rain';
import {
  TERMINAL_FAR,
  TERMINAL_NEAR,
  createWorld,
  recycle,
  step,
  type SimDrop,
  type Surface,
  type World,
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


      /*
       * The floor is the foot of the VIEWPORT, wherever you are on the page.
       *
       * It used to be the foot of the document, and that had two consequences
       * that both read as the rain being broken. At the top of the page a drop
       * had to fall the better part of three thousand pixels of dead space
       * below the fold before it retired, at 52–215px/s — so it left the screen
       * and did not come back for anything up to a minute, and the weather
       * visibly thinned the longer you stayed at the top. And no paint gathered
       * at all until you reached the footer, measured at zero landings in sixty
       * seconds at scrollY=0.
       *
       * It rains on this page all the time and everywhere. A drop leaves the
       * bottom of the screen, is credited to the paint, and comes straight back
       * round — so the field stays as dense at the hero as it is at the footer,
       * and the pool has something in it when you arrive.
       */
      world.floor = window.innerHeight;

      recycle(world.drops, countRef.current, window.innerWidth, window.innerHeight);
      step(world, dt, surfaces, now / 1000);
      announceLandings(world);
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
 * Tells the footer what has just landed on it.
 *
 * The floor is announced from here rather than detected in the footer, because
 * the rain already knows when a drop has run out of page and two definitions of
 * where the floor is would eventually disagree.
 */
function announceLandings(world: World): void {
  const host = document.querySelector<HTMLElement>('[data-paint-pool]');
  if (host === null) return;

  const rect = host.getBoundingClientRect();
  if (rect.width === 0) return;
  /*
   * Deliberately NOT gated on the footer being in view.
   *
   * It was, and that is what made the paint conditional on being looked at:
   * scroll away and the rain stopped counting. The footer keeps its own pool
   * whether or not it is on screen, so the paint is simply there — already
   * gathered — by the time anyone scrolls down to it.
   */

  /*
   * Drops that reached the floor this step become paint.
   *
   * Read straight off `world.landed`, which the simulation filled and which it
   * clears at the top of every step. There is nothing to deduce and nothing to
   * guard against: a landing is in that list because it happened, once, during
   * the step that just ran.
   *
   * What was here before tried to recover the same fact from each drop's phase
   * and `y` — `pooled`, and no more than 80px above the floor. Both halves were
   * wrong. `pooled` is also true of a drop parked off-screen by `recycle`, so
   * the position test was carrying the whole distinction; and the 80px assumed
   * drops always came to rest AT the floor, which stopped being true the moment
   * the rain's own undrawn pool began lifting them above it. The rain went on
   * falling and never reached the footer again.
   */
  for (const landing of world.landed) {
    host.dispatchEvent(
      new CustomEvent('rain:land', {
        detail: {
          x: Math.max(0, Math.min(rect.width, landing.x - rect.left)),
          color: landing.color,
          size: landing.size,
        },
      })
    );
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

  /*
   * The rain draws drops. It does not draw paint.
   *
   * What the rain runs into at the foot of the page is the footer's pool, and a
   * second flat pool drawn up here meant two paint systems arguing over the same
   * ground. The drawing for it went first and the pool behind it was left — and
   * that leftover, filling and levelling where nobody could see it, is what
   * eventually stopped the rain reaching the footer at all. Both are gone now:
   * a drop that meets the floor is recorded as a landing and recycled, and the
   * paint it becomes is poured in the footer, once.
   */

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

/** A room's hex as the three channels the drops are drawn with. */
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
