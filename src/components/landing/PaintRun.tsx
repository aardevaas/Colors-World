'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createWorld,
  dropVolume,
  pourInto,
  stepPool,
  type World,
} from '@/lib/landing/rain-sim';
import type { RoomColor } from '@/lib/landing/room-palette';
import styles from './paint-run.module.css';

/**
 * Where the rain ends up: a faucet in the wall, and paint stacking up on the
 * floor.
 *
 * There was a fan here, and before that a glass rollercoaster. Both were
 * scenery that asked to be looked at and gave nothing back — the fan in
 * particular was an appliance the visitor could not touch, blowing weather
 * sideways for no reason anyone could act on. The faucet is the same amount of
 * drawing and it is a CONTROL: it is the one thing on this page that does what
 * you tell it to, and what it does is fill the floor with paint.
 *
 * The paint is the same shallow-water field the rain has always poured into, so
 * a hard pour raises a column at the spout, the slope drives flow, and the wave
 * runs off to the right and comes back — one set of fluid behaviour on the page
 * and one set of tests behind it.
 */

interface PaintRunProps {
  /** The generated six. The paint is the same colors as the weather. */
  readonly rooms: readonly RoomColor[];
}

/** Seconds the valve takes to open or close. */
const VALVE_TIME = 0.42;
/** Droplets a second while the faucet is wide open. */
const POUR_RATE = 46;
/** Splash particles thrown up by one droplet meeting the paint. */
const SPLASH_PER_DROP = 4;

interface Droplet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rgb: [number, number, number];
}

interface Splash {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 1 at impact, 0 when finished. */
  life: number;
  rgb: [number, number, number];
  size: number;
}

/** A ring spreading on the surface where something landed. */
interface Ring {
  x: number;
  y: number;
  t: number;
  size: number;
  rgb: [number, number, number];
}

/**
 * Where the faucet sits, given the canvas.
 *
 * One function, used by the drawing AND by the hit target positioned over it,
 * so the thing the visitor clicks cannot drift away from the thing they see.
 */
export function faucetGeometry(width: number, height: number) {
  const scale = Math.max(0.72, Math.min(1.25, width / 1440));
  const wallY = Math.max(96, height * 0.3);
  const spoutX = 148 * scale;
  const spoutY = wallY + 96 * scale;
  const handleX = 84 * scale;
  const handleY = wallY - 46 * scale;
  return { scale, wallY, spoutX, spoutY, handleX, handleY, pipe: 23 * scale };
}

export function PaintRun({ rooms }: PaintRunProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;

  /** Open/closed. Read by the loop through a ref so toggling never restarts it. */
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  /** Where to put the hit target, in CSS px, refreshed on resize. */
  const [hit, setHit] = useState({ x: 0, y: 0, size: 0 });

  const toggle = useCallback(() => setOpen((was) => !was), []);

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
    let pool: World = createWorld(1, 1);

    const droplets: Droplet[] = [];
    const splashes: Splash[] = [];
    const rings: Ring[] = [];

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

      const previous = pool;
      pool = createWorld(width, height);
      // Whatever has already gathered survives a resize.
      for (let i = 0; i < pool.pool.length; i += 1) {
        const was = previous.pool[i];
        const now = pool.pool[i];
        if (was === undefined || now === undefined) continue;
        now.h = was.h;
        now.r = was.r;
        now.g = was.g;
        now.b = was.b;
      }

      const g = faucetGeometry(width, height);
      // Centred on the wheel, which is the part that looks turnable.
      const reach = 74 * g.scale;
      setHit({ x: g.handleX - reach / 2, y: g.handleY - reach / 2, size: reach });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    /** Surface height of the paint at an x, in canvas coordinates. */
    const surfaceAtX = (x: number) => {
      const index = Math.max(
        0,
        Math.min(pool.pool.length - 1, Math.floor((x / Math.max(1, width)) * pool.pool.length))
      );
      return height - (pool.pool[index]?.h ?? 0);
    };

    const roomRgb = (index: number): [number, number, number] =>
      toRgb(roomsRef.current[index % Math.max(1, roomsRef.current.length)]);

    /** A droplet has met the paint: it becomes volume, a ring and a crown. */
    const impact = (x: number, y: number, size: number, rgb: [number, number, number]) => {
      pourInto(pool, x, dropVolume(size, width), rgb);
      rings.push({ x, y, t: 0, size, rgb });
      if (rings.length > 18) rings.shift();
      for (let i = 0; i < SPLASH_PER_DROP; i += 1) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.1;
        const speed = 60 + Math.random() * 130;
        splashes.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          rgb,
          size: Math.max(1.4, size * (0.16 + Math.random() * 0.2)),
        });
      }
      if (splashes.length > 200) splashes.splice(0, splashes.length - 200);
    };

    /*
     * A drop from the weather has reached the floor.
     *
     * Announced by the rain rather than detected here: the rain already knows
     * when a drop has run out of page, and duplicating that test would mean two
     * definitions of where the floor is.
     */
    const onLand = (event: Event) => {
      const detail = (event as CustomEvent<{ x: number; color: number; size: number }>).detail;
      if (detail === undefined || width === 0) return;
      impact(detail.x, surfaceAtX(detail.x), detail.size, roomRgb(detail.color));
    };
    host.addEventListener('rain:land', onLand);

    let frame = 0;
    let last = performance.now();
    /** 0 shut, 1 wide open. Eased, so the valve has a throw to it. */
    let flow = 0;
    let pourDebt = 0;
    let colorCursor = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (width === 0) return;
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;

      const target = openRef.current ? 1 : 0;
      flow += Math.max(-dt / VALVE_TIME, Math.min(dt / VALVE_TIME, target - flow));

      const g = faucetGeometry(width, height);

      // --- pour ------------------------------------------------------------
      if (flow > 0.01) {
        pourDebt += POUR_RATE * flow * dt;
        while (pourDebt >= 1) {
          pourDebt -= 1;
          colorCursor += 1;
          droplets.push({
            // A stream has width: jittered, so the column at the spout is not a
            // single spike that the solver then has to flatten.
            x: g.spoutX + (Math.random() - 0.5) * 14 * g.scale,
            y: g.spoutY + 6 * g.scale,
            vx: (Math.random() - 0.5) * 16,
            vy: 150 + Math.random() * 90,
            size: 5 + Math.random() * 7,
            rgb: roomRgb(colorCursor),
          });
        }
      }

      // --- droplets in the air ---------------------------------------------
      for (let i = droplets.length - 1; i >= 0; i -= 1) {
        const d = droplets[i];
        if (d === undefined) continue;
        d.vy += 900 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        const surface = surfaceAtX(d.x);
        if (d.y + d.size / 2 >= surface) {
          impact(d.x, surface, d.size, d.rgb);
          droplets.splice(i, 1);
        } else if (d.y > height + 40) {
          droplets.splice(i, 1);
        }
      }

      // --- thrown paint -----------------------------------------------------
      for (let i = splashes.length - 1; i >= 0; i -= 1) {
        const s = splashes[i];
        if (s === undefined) continue;
        s.vy += 1100 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt * 1.7;
        if (s.life <= 0 || s.y > surfaceAtX(s.x) + 4) splashes.splice(i, 1);
      }

      for (let i = rings.length - 1; i >= 0; i -= 1) {
        const r = rings[i];
        if (r === undefined) continue;
        r.t += dt / 0.85;
        if (r.t >= 1) rings.splice(i, 1);
      }

      stepPool(pool, dt);

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      drawPool(context, width, height, pool);
      drawRings(context, rings);
      drawDroplets(context, droplets, splashes);
      drawFaucet(context, g, flow);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('rain:land', onLand);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {/*
        The faucet is drawn on a canvas, which cannot be focused, labelled or
        reached from a keyboard. So the control is a real button sitting exactly
        where the handle is drawn — same geometry, one source — and the canvas
        stays what it is: a picture.
      */}
      <button
        type="button"
        className={styles.valve}
        style={{ left: `${hit.x}px`, top: `${hit.y}px`, width: `${hit.size}px`, height: `${hit.size}px` }}
        onClick={toggle}
        aria-pressed={open}
      >
        <span className={styles.valveLabel}>{open ? 'Turn the paint off' : 'Turn the paint on'}</span>
      </button>
    </>
  );
}

/**
 * The faucet: a pipe out of the wall, an elbow, a spout, and a handle on top.
 *
 * Drawn rather than imported. It is a few strokes and a wheel, and an asset for
 * that would be a request, a cache entry and a licence to no purpose.
 *
 * `flow` does three things at once — turns the handle, opens the throat, and
 * hangs a stream off the spout — because that is what makes it read as one
 * mechanism rather than as a picture with an effect played over it.
 */
function drawFaucet(
  context: CanvasRenderingContext2D,
  g: ReturnType<typeof faucetGeometry>,
  flow: number
): void {
  const { scale, wallY, spoutX, spoutY, handleX, handleY, pipe } = g;
  const steel = (a: number) => `rgba(206,222,241,${a})`;
  const dark = 'rgba(24,31,42,1)';

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';

  /**
   * A length of pipe: a dark body with a highlight along its upper third, which
   * is the whole of what separates a cylinder from a line.
   */
  const run = (x1: number, y1: number, x2: number, y2: number, w = pipe) => {
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.lineWidth = w;
    context.strokeStyle = dark;
    context.stroke();
    context.lineWidth = w * 0.9;
    context.strokeStyle = steel(0.34);
    context.stroke();
    // The specular line, offset toward the light.
    context.beginPath();
    context.moveTo(x1, y1 - w * 0.24);
    context.lineTo(x2 - (y1 === y2 ? w * 0.3 : 0), y2 - w * 0.24);
    context.lineWidth = w * 0.2;
    context.strokeStyle = steel(0.85);
    context.stroke();
  };

  // The escutcheon where it leaves the wall.
  context.beginPath();
  context.roundRect(-10 * scale, wallY - 27 * scale, 26 * scale, 54 * scale, 4 * scale);
  context.fillStyle = 'rgba(32,41,55,1)';
  context.fill();
  context.lineWidth = 2.2 * scale;
  context.strokeStyle = steel(0.55);
  context.stroke();

  // The horizontal run out of the wall, and the gooseneck down to the spout.
  run(6 * scale, wallY, spoutX - 16 * scale, wallY);
  context.beginPath();
  context.moveTo(spoutX - 16 * scale, wallY);
  context.quadraticCurveTo(spoutX, wallY, spoutX, wallY + 18 * scale);
  context.lineTo(spoutX, spoutY - 6 * scale);
  context.lineWidth = pipe;
  context.strokeStyle = dark;
  context.stroke();
  context.lineWidth = pipe * 0.9;
  context.strokeStyle = steel(0.32);
  context.stroke();

  // A collar just above the mouth — the detail that says "tap" rather than
  // "bent tube".
  context.beginPath();
  context.roundRect(spoutX - pipe * 0.62, spoutY - 22 * scale, pipe * 1.24, 9 * scale, 2 * scale);
  context.fillStyle = 'rgba(38,48,63,1)';
  context.fill();
  context.lineWidth = 1.6 * scale;
  context.strokeStyle = steel(0.5);
  context.stroke();

  // The mouth, flared wider than the pipe.
  context.beginPath();
  context.roundRect(spoutX - pipe * 0.78, spoutY - 8 * scale, pipe * 1.56, 13 * scale, 3 * scale);
  context.fillStyle = 'rgba(20,27,37,1)';
  context.fill();
  context.lineWidth = 2 * scale;
  context.strokeStyle = steel(0.6);
  context.stroke();

  // Paint standing in the throat once it is running.
  if (flow > 0.02) {
    context.beginPath();
    context.ellipse(spoutX, spoutY + 3 * scale, pipe * 0.5, 3 * scale, 0, 0, Math.PI * 2);
    context.fillStyle = `rgba(255,255,255,${0.12 + flow * 0.2})`;
    context.fill();
  }

  // --- the handle ----------------------------------------------------------
  run(handleX, wallY - 6 * scale, handleX, handleY + 6 * scale, pipe * 0.52);

  context.save();
  context.translate(handleX, handleY);
  // A quarter turn — the throw of a real quarter-turn valve.
  context.rotate(flow * Math.PI * 0.5);
  // Squashed, so the wheel reads as a disc seen at an angle, not face-on.
  context.scale(1, 0.55);

  const r = 25 * scale;
  context.beginPath();
  context.arc(0, 0, r, 0, Math.PI * 2);
  context.lineWidth = 7 * scale;
  context.strokeStyle = dark;
  context.stroke();
  context.lineWidth = 4.6 * scale;
  context.strokeStyle = steel(0.72);
  context.stroke();

  context.lineWidth = 4.4 * scale;
  context.strokeStyle = steel(0.6);
  for (let i = 0; i < 4; i += 1) {
    context.save();
    context.rotate((i * Math.PI) / 2);
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(r, 0);
    context.stroke();
    context.restore();
  }
  context.restore();

  // The nut at the centre, drawn unsquashed so it stays round.
  context.beginPath();
  context.arc(handleX, handleY, 6 * scale, 0, Math.PI * 2);
  context.fillStyle = steel(0.92);
  context.fill();
  context.lineWidth = 1.4 * scale;
  context.strokeStyle = 'rgba(40,52,68,0.9)';
  context.stroke();

  // --- the stream ----------------------------------------------------------
  //
  // Only the first stretch below the mouth is solid. Past that the individual
  // droplets take over, which is what a falling stream does — it holds together
  // for an inch and then breaks up.
  if (flow > 0.02) {
    const length = 34 * scale * flow;
    const half = pipe * 0.3 * flow;
    context.beginPath();
    context.moveTo(spoutX - half, spoutY + 3 * scale);
    context.lineTo(spoutX + half, spoutY + 3 * scale);
    context.lineTo(spoutX + half * 0.5, spoutY + length);
    context.lineTo(spoutX - half * 0.5, spoutY + length);
    context.closePath();
    context.fillStyle = `rgba(238,246,255,${0.26 * flow})`;
    context.fill();
  }

  context.restore();
}

/** Droplets in the air, and the paint thrown up by the ones that have landed. */
function drawDroplets(
  context: CanvasRenderingContext2D,
  droplets: readonly Droplet[],
  splashes: readonly Splash[]
): void {
  context.save();
  for (const d of droplets) {
    // Stretched along the fall, as a fast drop is.
    const stretch = Math.max(1, Math.min(2.6, d.vy / 260));
    context.save();
    context.translate(d.x, d.y);
    context.scale(1, stretch);
    context.beginPath();
    context.arc(0, 0, d.size / 2, 0, Math.PI * 2);
    context.fillStyle = `rgb(${d.rgb[0]} ${d.rgb[1]} ${d.rgb[2]})`;
    context.fill();
    context.restore();
  }

  for (const s of splashes) {
    context.beginPath();
    context.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    context.fillStyle = `rgba(${s.rgb[0]},${s.rgb[1]},${s.rgb[2]},${Math.max(0, s.life)})`;
    context.fill();
  }
  context.restore();
}

/** The ring spreading out from an impact, easing out hard as impacts do. */
function drawRings(context: CanvasRenderingContext2D, rings: readonly Ring[]): void {
  context.save();
  for (const r of rings) {
    const eased = 1 - (1 - r.t) ** 3;
    const fade = 1 - r.t;
    context.beginPath();
    context.ellipse(
      r.x,
      r.y,
      r.size * (0.5 + eased * 3.6),
      r.size * (0.18 + eased * 1.05),
      0,
      0,
      Math.PI * 2
    );
    context.strokeStyle = `rgba(${r.rgb[0]},${r.rgb[1]},${r.rgb[2]},${fade * 0.6})`;
    context.lineWidth = Math.max(0.6, 2.2 * fade);
    context.stroke();
  }
  context.restore();
}

/**
 * The paint on the floor.
 *
 * The rain's own shallow-water field: depth at cell centres, flow at the faces
 * between them, so a drop landing raises a column, the slope drives flow and
 * the wave spreads on its own. Colour is sampled across the width, so the pool
 * is literally made of what has landed in it.
 */
function drawPool(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  pool: World
): void {
  const columns = pool.pool.length;
  const columnWidth = width / columns;
  const surfaceY = (i: number) => height - (pool.pool[i]?.h ?? 0);

  context.save();
  context.beginPath();
  context.moveTo(0, surfaceY(0));
  for (let i = 0; i < columns - 1; i += 1) {
    const x = (i + 0.5) * columnWidth;
    const nextX = (i + 1.5) * columnWidth;
    context.quadraticCurveTo(x, surfaceY(i), (x + nextX) / 2, (surfaceY(i) + surfaceY(i + 1)) / 2);
  }
  context.lineTo(width, surfaceY(columns - 1));
  context.lineTo(width, height);
  context.lineTo(0, height);
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
  context.strokeStyle = 'rgba(255,255,255,0.32)';
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();
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
