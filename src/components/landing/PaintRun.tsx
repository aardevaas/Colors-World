'use client';

import { useEffect, useRef } from 'react';
import { createWorld, pourInto, stepPool, type World } from '@/lib/landing/rain-sim';
import type { RoomColor } from '@/lib/landing/room-palette';
import styles from './paint-run.module.css';

/**
 * Where the rain ends up: a fan in the corner, and paint stacking up on the
 * floor.
 *
 * This replaced a glass rollercoaster — a tube that carried the drops through a
 * loop and hosed them at a wall. It was a lot of machinery and it never earned
 * its place: it took the eye away from the page, it needed a whole path-and-
 * transport module behind it, and the thing it was decorating is a footer. The
 * tube, its physics module and its tests are all deleted rather than left to
 * rot.
 *
 * What is left is the part that was actually good. A fan stands in the corner
 * and blows, the weather answers it, and the paint gathers on the floor as a
 * real liquid — the same shallow-water field the rain has used all along, so it
 * sloshes, levels and carries waves at sqrt(g·h) with one set of fluid
 * behaviour on the page and one set of tests behind it.
 */

interface PaintRunProps {
  /** The generated six. The paint is the same colors as the weather. */
  readonly rooms: readonly RoomColor[];
}

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
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    /*
     * A drop has reached the floor. It becomes paint.
     *
     * Announced by the rain rather than detected here: the rain already knows
     * when a drop has run out of page, and duplicating that test would mean two
     * definitions of where the floor is.
     */
    const onLand = (event: Event) => {
      const detail = (event as CustomEvent<{ x: number; color: number; size: number }>).detail;
      if (detail === undefined || width === 0) return;
      const rgb = toRgb(roomsRef.current[detail.color % Math.max(1, roomsRef.current.length)]);
      // Volume conserved: the drop's area spread across a column's width.
      const columnWidth = width / pool.pool.length;
      pourInto(pool, detail.x, (Math.PI * (detail.size / 2) ** 2) / Math.max(1, columnWidth), rgb);
    };
    host.addEventListener('rain:land', onLand);

    let frame = 0;
    let last = performance.now();
    let spin = 0;
    let sway = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (width === 0) return;
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;

      spin += dt * 22;
      // A slow look left and right, which is most of what makes it a character
      // rather than an appliance.
      sway = Math.sin(now / 2600) * 0.16;

      stepPool(pool, dt);

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      drawPool(context, width, height, pool);
      drawFan(context, width, height, spin, sway);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('rain:land', onLand);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}

/**
 * The fan, built like the lamp.
 *
 * A weighted base, a lower arm, an elbow, an upper arm, and a head that leans
 * — which is the whole of what makes that little lamp read as a character
 * rather than as office equipment. Nothing here is rigged or animated beyond a
 * slow look left and right; the posture does the work.
 *
 * Drawn rather than imported. It is a few strokes and a spinning disc, and an
 * asset for that would be a request, a cache entry and a licence to no purpose.
 */
function drawFan(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  spin: number,
  sway: number
): void {
  const scale = Math.max(0.62, Math.min(1.15, width / 1440));
  const baseX = Math.max(74, width * 0.085);
  const baseY = height - 16;

  const ink = 'rgba(214,232,255,';
  context.save();
  context.translate(baseX, baseY);
  context.scale(scale, scale);
  context.lineCap = 'round';
  context.lineJoin = 'round';

  // Base: a weighted disc, drawn as an ellipse so it sits ON the floor rather
  // than in front of it.
  context.beginPath();
  context.ellipse(0, 0, 40, 11, 0, 0, Math.PI * 2);
  context.fillStyle = 'rgba(22,28,38,0.95)';
  context.fill();
  context.lineWidth = 2.4;
  context.strokeStyle = `${ink}0.5)`;
  context.stroke();

  // Lower arm, leaning back over the base as the lamp does.
  const elbowX = 22 + sway * 30;
  const elbowY = -84;
  context.beginPath();
  context.moveTo(0, -6);
  context.lineTo(elbowX, elbowY);
  context.lineWidth = 7;
  context.strokeStyle = `${ink}0.34)`;
  context.stroke();
  context.lineWidth = 2.2;
  context.strokeStyle = `${ink}0.72)`;
  context.stroke();

  // Elbow.
  context.beginPath();
  context.arc(elbowX, elbowY, 7, 0, Math.PI * 2);
  context.fillStyle = 'rgba(26,34,46,1)';
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = `${ink}0.68)`;
  context.stroke();

  // Upper arm, reaching forward and down — the lamp's characteristic stoop.
  const headX = elbowX + 54 + sway * 26;
  const headY = elbowY - 34;
  context.beginPath();
  context.moveTo(elbowX, elbowY);
  context.lineTo(headX, headY);
  context.lineWidth = 6;
  context.strokeStyle = `${ink}0.3)`;
  context.stroke();
  context.lineWidth = 2;
  context.strokeStyle = `${ink}0.68)`;
  context.stroke();

  /*
   * The head: a cage with blades in it, tilted to look where it is blowing.
   *
   * Squashed horizontally rather than drawn as a circle, so it reads as a disc
   * seen at an angle — which is what tips the whole thing from a diagram of a
   * fan into something pointed somewhere.
   */
  context.save();
  context.translate(headX, headY);
  context.rotate(0.42 + sway);
  context.scale(0.52, 1);

  const r = 30;
  context.beginPath();
  context.arc(0, 0, r, 0, Math.PI * 2);
  context.fillStyle = 'rgba(14,19,28,0.92)';
  context.fill();
  context.lineWidth = 5;
  context.strokeStyle = `${ink}0.62)`;
  context.stroke();

  // Blades, three passes a few degrees apart — a cheap motion blur that reads
  // better than either a sharp blade or a plain smear.
  for (const [lag, alpha] of [[0, 0.5], [-0.24, 0.26], [-0.48, 0.12]] as const) {
    context.save();
    context.rotate(spin + lag);
    for (let blade = 0; blade < 4; blade += 1) {
      context.rotate(Math.PI / 2);
      context.beginPath();
      context.moveTo(0, 0);
      context.quadraticCurveTo(r * 0.72, -r * 0.44, r * 0.9, r * 0.12);
      context.quadraticCurveTo(r * 0.46, r * 0.22, 0, 0);
      context.fillStyle = `rgba(226,240,255,${alpha})`;
      context.fill();
    }
    context.restore();
  }

  // Hub, and the guard bars across the cage.
  context.beginPath();
  context.arc(0, 0, r * 0.19, 0, Math.PI * 2);
  context.fillStyle = 'rgba(240,248,255,0.9)';
  context.fill();

  context.lineWidth = 1.4;
  context.strokeStyle = `${ink}0.3)`;
  for (let i = 0; i < 3; i += 1) {
    context.save();
    context.rotate((i * Math.PI) / 3);
    context.beginPath();
    context.moveTo(-r, 0);
    context.lineTo(r, 0);
    context.stroke();
    context.restore();
  }
  context.restore();
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
