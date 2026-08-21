'use client';

import { useEffect, useRef } from 'react';
import { stepSuspended, type SimDrop, type Surface } from '@/lib/landing/rain-sim';
import type { RoomColor } from '@/lib/landing/room-palette';
import styles from './liquid-button.module.css';

/**
 * The blobs suspended inside the liquid pill, on the pill's own canvas.
 *
 * They used to be drawn on the page-wide rain canvas, clipped to the button's
 * rectangle. That worked and had one flaw that could not be fixed from there:
 * the rain canvas sits above the whole document, so the blobs painted OVER the
 * button's own label. In the reference the label is on top of them. The only
 * way to put it back is for the blobs to be drawn INSIDE the button, beneath
 * its text — which is what this is.
 *
 * The field is the pill's own. Rain still feeds it: when a drop lands on the
 * button, PaintRain dispatches `rain:absorb` on the element and one more blob
 * joins, carrying the colour of the drop that arrived.
 *
 * Physics is `stepSuspended` from rain-sim, the same function the rain uses, so
 * the two cannot drift apart.
 */

interface LiquidFieldProps {
  /** The generated six. Blobs are drawn from these, so the pill holds the same
   *  colours as the weather outside it. */
  readonly rooms: readonly RoomColor[];
}

/** How many the pill holds at rest. The reference is packed — sixty-odd
 *  overlapping capsules across the face — and packed from the first frame. */
const RESIDENT = 64;
/** Beyond this, arrivals replace the oldest rather than crowding the pill. */
const CAPACITY = 96;

export function LiquidField({ rooms }: LiquidFieldProps) {
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
    const drops: SimDrop[] = [];

    const resize = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width === 0) return;
      const wasEmpty = width === 0;
      width = rect.width;
      height = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      if (wasEmpty) fill();
    };

    /** Seeds the resting population, once the pill has a size to fill. */
    const fill = () => {
      for (let i = 0; i < RESIDENT; i += 1) {
        // Two low-discrepancy sequences: an even scatter with no visible
        // lattice, which is what the reference's packing looks like.
        const u = (i * 0.7548776662466927) % 1;
        const v = (i * 0.5698402909980532) % 1;
        const depth = (i * 0.3819660112501051) % 1;
        drops.push(makeBlob(u * width, v * height, depth, i % 6, i));
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    /** One more blob, from a drop that just landed on the button. */
    const onAbsorb = (event: Event) => {
      const detail = (event as CustomEvent<{ color: number; x: number }>).detail;
      if (detail === undefined || width === 0) return;
      const local = Math.min(width, Math.max(0, detail.x));
      drops.push(makeBlob(local, 2, Math.random(), detail.color, drops.length));
      // Oldest out first, so the pill stays as dense as it started and no
      // denser however long the page is left open.
      if (drops.length > CAPACITY) drops.splice(0, drops.length - CAPACITY);
    };
    host.addEventListener('rain:absorb', onAbsorb);

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (width === 0) return;
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;

      const bounds: Surface[] = [
        { left: 0, top: 0, right: width, bottom: height, absorbs: true },
      ];
      stepSuspended(drops, dt, bounds, now / 1000);

      const palette = roomsRef.current.map(toRgb);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      for (const drop of drops) {
        drawBlob(context, drop, palette[drop.color % Math.max(1, palette.length)] ?? [244, 120, 110]);
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('rain:absorb', onAbsorb);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.liquid} aria-hidden="true" />;
}

function makeBlob(x: number, y: number, depth: number, color: number, index: number): SimDrop {
  return {
    x,
    y,
    vx: (depth - 0.5) * 20,
    vy: (((index * 0.61) % 1) - 0.5) * 20,
    size: 14 + depth * 16,
    color,
    depth,
    phase: 'absorbed',
    host: 0,
    restLeft: 0,
    runoff: 1,
    seed: (index * 2.399963) % (Math.PI * 2),
    terminal: 120,
    squash: 0,
  };
}

/**
 * A capsule standing on end, soft-edged by depth.
 *
 * Pastel rather than saturated, because that is what the reference is: pale
 * coral suspended in cream, nowhere near full strength. It also keeps the dark
 * label above them readable, which full-chroma blobs did not.
 */
function drawBlob(
  context: CanvasRenderingContext2D,
  drop: SimDrop,
  rgb: readonly [number, number, number]
): void {
  const r = drop.size / 2;
  const tint = (channel: number) => Math.round(channel + (252 - channel) * 0.5);
  const [red, green, blue] = [tint(rgb[0]), tint(rgb[1]), tint(rgb[2])];
  const softness = 0.14 + drop.depth * 0.4;

  const paint = context.createRadialGradient(0, 0, 0, 0, 0, r);
  paint.addColorStop(0, `rgb(${red} ${green} ${blue})`);
  paint.addColorStop(Math.max(0.05, 1 - softness), `rgb(${red} ${green} ${blue})`);
  paint.addColorStop(1, `rgba(${red} ${green} ${blue} / 0)`);

  context.save();
  context.translate(drop.x, drop.y);
  context.globalAlpha = 0.46 + (1 - drop.depth) * 0.3;
  // Taller than wide: the reference's blobs are stretched capsules, and that is
  // most of why the field reads as suspended in liquid rather than as bubbles.
  context.scale(0.78, 1.32);
  context.beginPath();
  context.arc(0, 0, r, 0, Math.PI * 2);
  context.fillStyle = paint;
  context.fill();
  context.restore();
}

function toRgb(room: RoomColor): [number, number, number] {
  const hex = room.hex.replace('#', '');
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

export default LiquidField;
