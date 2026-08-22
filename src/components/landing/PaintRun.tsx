'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_POOL,
  columnAt,
  createWorld,
  dropVolume,
  poolVolume,
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
/**
 * How far the valve turns at each setting.
 *
 * The pour rate is not listed per setting — it follows the handle's ACTUAL
 * position, so a change of setting is one movement and the stream builds and
 * dies away with the wheel instead of switching on at pressure.
 *
 * The turns are chosen against measured fill speeds. At 1440 the pool gains
 * about 0.8 of that. The relationship is SUBLINEAR at the top — past a point
 * the column under the spout hits the cap and the surplus is thrown away, which
 * is why the stream widens with the flow and why the top setting needs more
 * rate than a straight line would suggest. Measured at 3, 6 and 10 px/s.
 */
const MAX_POUR_RATE = 300;

const STRENGTHS = [
  { turn: 0, label: 'off' },
  { turn: 0.162, label: 'a trickle' },
  { turn: 0.387, label: 'a steady run' },
  { turn: 1, label: 'full' },
] as const;
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
  // 0.8: the whole fixture, twenty per cent down. Applied to the scale rather
  // than to each measurement, so the proportions and the hit target follow it.
  const scale = Math.max(0.72, Math.min(1.25, width / 1440)) * 0.8;
  const wallY = Math.max(96, height * 0.3);
  const spoutX = 148 * scale;
  const spoutY = wallY + 96 * scale;
  const handleX = 84 * scale;
  const handleY = wallY - 46 * scale;
  return { scale, wallY, spoutX, spoutY, handleX, handleY, pipe: 23 * scale };
}

/** Splash particles thrown up by one droplet meeting the paint. */
const SPLASH_PER_DROP = 4;

/** How fast the drain swallows paint at its own columns, px of depth a second. */
const DRAIN_RATE = 2800;

/**
 * How hard the floor is tilted toward the drain while it is running, px/s².
 *
 * Removing paint at the grate alone empties the pool at the speed the fluid can
 * carry it there, and shallow water carries MATERIAL slowly — the first version
 * took over ten seconds and had not finished. A real shallow pan does not wait
 * for that either: it gets tipped. So the whole surface is pulled toward the
 * grate, the paint runs visibly downhill, and the last of it slides across the
 * floor into the hole.
 *
 * Set so the flush BEATS the tap. At a gentler pull the two reached an
 * equilibrium — the drain carrying away exactly what a wide-open tap delivered,
 * the pool sitting at a steady 17px and never clearing. A flush that cannot
 * empty the floor while the tap is running is not a flush.
 */
const DRAIN_PULL = 3400;

/**
 * How fast the last of the film is drawn down, per second.
 *
 * The tilt moves a POOL. It cannot move a film: `stepPool` limits each face to
 * what the cell behind it can spare, so once the paint is a few pixels deep it
 * stops being able to reach the grate quickly, and a running tap simply refills
 * what the grate takes. The floor was left permanently wet at 17px.
 */
const DRAIN_SUCK = 3.6;

/**
 * Seconds the lever takes to whip down and settle.
 *
 * Long enough to see it bend. The lever is rubber, so it does not travel and
 * stop — it overshoots, comes back past its rest, and rings down.
 */
const PULL_TIME = 1.05;

/**
 * The drain, dead centre at the foot of the page, and the lever beside it.
 *
 * The lever is a FIXTURE, like the faucet — it is there whether or not there is
 * anything to flush. A control that appears only once some condition is met has
 * to be discovered twice: once as a thing that exists, and again as a thing
 * that can be pressed. Both of these are simply part of the room.
 */
export function drainGeometry(width: number, height: number) {
  const scale = Math.max(0.72, Math.min(1.25, width / 1440)) * 0.8;
  const base = height - 4 * scale;
  /*
   * The head waits clear of a FULL pool. Anything lower submerges itself at the
   * exact moment there is most to flush, and a control you cannot see is not a
   * control.
   */
  const head = height - MAX_POOL - 34 * scale;
  return {
    scale,
    /** Aligned to the centre of the page. */
    x: width / 2,
    /** All the way at the bottom. */
    grateY: height - 5 * scale,
    /*
     * Against the right-hand wall, opposite the tap.
     *
     * Beside the grate it stood in the middle of the footer's centred credit
     * line and drew its shaft straight through it. Out here the room reads as
     * what it is: paint in on the left, paint out on the right, and the hole in
     * the floor between them.
     */
    leverX: width - 112 * scale,
    leverBaseY: base,
    leverLength: base - head,
  };
}

export function PaintRun({ rooms }: PaintRunProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;

  /** 0 shut, 3 full. Read by the loop through a ref so it never restarts it. */
  const [level, setLevel] = useState(0);
  const levelRef = useRef(level);
  levelRef.current = level;

  /** Where to put the hit targets, in CSS px, refreshed on resize. */
  const [hit, setHit] = useState({ x: 0, y: 0, size: 0 });
  const [drainHit, setDrainHit] = useState({ x: 0, y: 0, size: 0 });

  /** Running while the paint is going down the drain. */
  const drainingRef = useRef(false);

  const toggle = useCallback(() => setLevel((was) => (was + 1) % STRENGTHS.length), []);
  const plunge = useCallback(() => {
    drainingRef.current = true;
  }, []);

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

      const d = drainGeometry(width, height);
      // Centred on the head of the lever, which is the part you would grab.
      const grip = 82 * d.scale;
      setDrainHit({
        x: d.leverX - grip / 2,
        y: d.leverBaseY - d.leverLength - grip * 0.4,
        size: grip,
      });
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
      /*
       * With the drain open, what lands runs straight out.
       *
       * It still splashes and still rings — the paint is arriving and you can
       * see it arrive. It simply does not gather, because the hole in the floor
       * is open. Without this the tap and the drain reached a standstill and the
       * floor never cleared, which is not what pulling a flush does.
       */
      if (!drainingRef.current) pourInto(pool, x, dropVolume(size, width), rgb);
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
    /** 0 at rest, running up on every push of the plunger. */
    /** 0 at rest; runs up while the lever is bending and ringing back. */
    let pullT = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (width === 0) return;
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;

      // `flow` is the valve's position, easing toward whatever it has been set
      // to. Everything downstream — the pour, the stream, the wheel — reads it,
      // so a change of setting is one movement rather than three.
      const setting = STRENGTHS[levelRef.current] ?? STRENGTHS[0];
      flow += Math.max(-dt / VALVE_TIME, Math.min(dt / VALVE_TIME, setting.turn - flow));

      const g = faucetGeometry(width, height);

      // --- pour ------------------------------------------------------------
      if (flow > 0.01) {
        pourDebt += MAX_POUR_RATE * flow * dt;
        while (pourDebt >= 1) {
          pourDebt -= 1;
          colorCursor += 1;
          droplets.push({
            /*
             * A stream has width, and a harder stream has MORE width.
             *
             * Not decoration. Every drop used to land within half a column of
             * the spout, so at full blast the column under it hit the cap and
             * the surplus was thrown away — the tap saturated at 7.2px/s however
             * hard it was opened. Spreading the fall with the flow lets the
             * paint actually arrive, and is what an open tap looks like.
             */
            x: g.spoutX + (Math.random() - 0.5) * (14 + flow * 78) * g.scale,
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

      // --- the drain --------------------------------------------------------
      const d = drainGeometry(width, height);
      if (drainingRef.current) {
        pullT += dt / PULL_TIME;
        /*
         * The paint is not deleted — it is taken out at ONE PLACE and the floor
         * is tipped toward it.
         *
         * Emptying every column together would drop the surface like a lift.
         * Taking it at the grate alone is honest but far too slow: shallow water
         * carries MATERIAL slowly, the same fact that governs the mixing, and
         * the first version of this took over ten seconds and had not finished.
         * A shallow pan does not wait for that either. It gets tipped.
         */
        const centre = columnAt(pool, d.x);
        for (let i = centre - 3; i <= centre + 3; i += 1) {
          const column = pool.pool[i];
          if (column === undefined) continue;
          column.h = Math.max(0, column.h - DRAIN_RATE * dt);
        }
        for (let i = 0; i <= pool.pool.length; i += 1) {
          const toward = i <= centre ? 1 : -1;
          pool.flow[i] = (pool.flow[i] ?? 0) + toward * DRAIN_PULL * dt;
        }
        const fade = Math.max(0, 1 - DRAIN_SUCK * dt);
        for (const column of pool.pool) column.h *= fade;
        // Cleared. The drain leads nowhere, and the floor starts filling again.
        if (poolVolume(pool) < 40) {
          drainingRef.current = false;
          pullT = 0;
        }
      } else if (pullT > 0) {
        // Let the lever finish ringing even after the paint has gone.
        pullT = Math.min(1, pullT + dt / PULL_TIME);
        if (pullT >= 1) pullT = 0;
      }

      stepPool(pool, dt);

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      drawPool(context, width, height, pool);
      drawRings(context, rings);
      drawDroplets(context, droplets, splashes);
      drawFaucet(context, g, flow);
      drawDrain(context, d, drainingRef.current, pullT);
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
      {/*
        The flush lever. A fixture, like the tap — present whether or not there
        is anything to flush, and a real button for the same reason the valve
        is one: a canvas cannot be tabbed to or named.
      */}
      <button
        type="button"
        className={styles.plunger}
        style={{
          left: `${drainHit.x}px`,
          top: `${drainHit.y}px`,
          width: `${drainHit.size}px`,
          height: `${drainHit.size}px`,
        }}
        onClick={plunge}
      >
        <span className={styles.valveLabel}>Pull the lever to empty the paint</span>
      </button>
      <button
        type="button"
        className={styles.valve}
        style={{ left: `${hit.x}px`, top: `${hit.y}px`, width: `${hit.size}px`, height: `${hit.size}px` }}
        onClick={toggle}
        data-level={level}
      >
        {/*
          Four states, so `aria-pressed` is the wrong shape — it can only say on
          or off. The label carries where the tap is now AND what the next press
          does, which is what someone who cannot see the handle actually needs.
        */}
        <span className={styles.valveLabel}>
          {`Paint tap: ${STRENGTHS[level]?.label ?? 'off'}. Press for ${
            STRENGTHS[(level + 1) % STRENGTHS.length]?.label ?? 'off'
          }.`}
        </span>
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

/**
 * The drain in the floor, and the flush lever beside it.
 *
 * The lever is rubber and it behaves like rubber: pulled, it does not travel to
 * a new position and stop, it WHIPS — bending hard, overshooting past its own
 * rest, and ringing down. That bend is the whole character of the thing, so it
 * is drawn as a curve whose control point carries the displacement rather than
 * as a rigid arm on a hinge, which is the version of this that reads as a
 * switch instead of as something with give in it.
 */
function drawDrain(
  context: CanvasRenderingContext2D,
  d: ReturnType<typeof drainGeometry>,
  draining: boolean,
  pullT: number
): void {
  const { scale, x, grateY, leverX, leverBaseY, leverLength } = d;

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';

  // --- the grate ------------------------------------------------------------
  context.beginPath();
  context.ellipse(x, grateY, 40 * scale, 13 * scale, 0, 0, Math.PI * 2);
  context.fillStyle = 'rgba(8,11,16,0.97)';
  context.fill();
  context.lineWidth = 3 * scale;
  context.strokeStyle = 'rgba(198,214,234,0.5)';
  context.stroke();

  context.lineWidth = 2.4 * scale;
  context.strokeStyle = 'rgba(198,214,234,0.3)';
  for (let i = -3; i <= 3; i += 1) {
    const bx = x + i * 10 * scale;
    const span = 12 * scale * Math.sqrt(Math.max(0, 1 - (i / 4.1) ** 2));
    context.beginPath();
    context.moveTo(bx, grateY - span);
    context.lineTo(bx, grateY + span);
    context.stroke();
  }

  /*
   * The vortex, drawn only while it is running.
   *
   * Two arms of a spiral tightening into the grate, turning fast. It sits on
   * top of the paint because the paint is what is turning — the surface itself
   * is already dipping here, because the solver is answering a hole.
   */
  if (draining) {
    const spin = pullT * 26;
    context.lineWidth = 2.6 * scale;
    for (let arm = 0; arm < 3; arm += 1) {
      context.beginPath();
      for (let t = 0; t <= 1.001; t += 0.045) {
        const angle = spin + (arm * Math.PI * 2) / 3 + t * Math.PI * 3.2;
        const radius = 62 * scale * (1 - t) ** 1.2;
        const px = x + Math.cos(angle) * radius;
        const py = grateY + Math.sin(angle) * radius * 0.34;
        if (t === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.strokeStyle = `rgba(255,255,255,${0.4 - arm * 0.11})`;
      context.stroke();
    }
  }

  // --- the lever ------------------------------------------------------------
  //
  // A damped ring rather than a travel-and-stop. Peaks almost at once, swings
  // back through its rest and settles — which is what a rubber arm does and a
  // hinged one does not.
  const bend = draining || pullT > 0
    ? Math.exp(-3.1 * pullT) * Math.sin(pullT * 11.5) * 1.35
    : 0;

  const tipX = leverX - bend * 78 * scale;
  const tipY = leverBaseY - leverLength + Math.abs(bend) * 34 * scale;
  // The control point leads the tip, so the arm bows through its length instead
  // of pivoting stiffly at the base.
  const ctrlX = leverX - bend * 30 * scale;
  const ctrlY = leverBaseY - leverLength * 0.52;

  // A collar bolting it to the floor.
  context.beginPath();
  context.ellipse(leverX, leverBaseY, 21 * scale, 7 * scale, 0, 0, Math.PI * 2);
  context.fillStyle = 'rgba(20,24,31,1)';
  context.fill();
  context.lineWidth = 2.2 * scale;
  context.strokeStyle = 'rgba(150,166,186,0.45)';
  context.stroke();

  // The shaft: black rubber, thick at the foot and tapering to the head.
  for (const [width_, tint] of [
    [15 * scale, 'rgba(10,12,16,1)'],
    [9 * scale, 'rgba(38,42,50,1)'],
    [3 * scale, 'rgba(96,104,118,0.55)'],
  ] as const) {
    context.beginPath();
    context.moveTo(leverX, leverBaseY - 2 * scale);
    context.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
    context.lineWidth = width_;
    context.strokeStyle = tint;
    context.stroke();
  }

  /*
   * The head: a rubber cup, leaning the way the arm is bent.
   *
   * Squashed along its lean rather than drawn upright, so the whole thing reads
   * as one flexible object under load instead of a solid shape sitting on a
   * bent stick.
   */
  const lean = Math.atan2(tipX - ctrlX, ctrlY - tipY);
  context.save();
  context.translate(tipX, tipY);
  context.rotate(-lean);
  const r = 27 * scale;
  context.beginPath();
  context.moveTo(-r, 6 * scale);
  context.quadraticCurveTo(-r, -26 * scale, 0, -26 * scale);
  context.quadraticCurveTo(r, -26 * scale, r, 6 * scale);
  context.quadraticCurveTo(r, 17 * scale, 0, 17 * scale);
  context.quadraticCurveTo(-r, 17 * scale, -r, 6 * scale);
  context.closePath();
  const rubber = context.createLinearGradient(0, -26 * scale, 0, 17 * scale);
  rubber.addColorStop(0, 'rgba(46,50,58,1)');
  rubber.addColorStop(0.55, 'rgba(16,18,23,1)');
  rubber.addColorStop(1, 'rgba(6,7,10,1)');
  context.fillStyle = rubber;
  context.fill();
  context.lineWidth = 1.8 * scale;
  context.strokeStyle = 'rgba(128,140,158,0.34)';
  context.stroke();

  // A ring around the cup, and a highlight — the two details that stop black
  // rubber rendering as a hole in the page.
  context.beginPath();
  context.ellipse(0, 4 * scale, r * 0.72, 5 * scale, 0, 0, Math.PI * 2);
  context.lineWidth = 1.4 * scale;
  context.strokeStyle = 'rgba(120,132,150,0.24)';
  context.stroke();

  context.beginPath();
  context.ellipse(-r * 0.34, -14 * scale, r * 0.28, 6 * scale, -0.4, 0, Math.PI * 2);
  context.fillStyle = 'rgba(196,210,230,0.16)';
  context.fill();
  context.restore();

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

  /*
   * One stop per few columns, not nine across the whole pool.
   *
   * Nine stops over a hundred and twenty columns averages the paint into a
   * smooth wash, and a smooth wash cannot show a colour front moving through
   * it — which, now that colour is advected by the flow, is most of what there
   * is to see down here. Sampling finely is what lets the mixing render.
   */
  const paint = context.createLinearGradient(0, 0, width, 0);
  const stops = Math.min(32, columns);
  for (let stop = 0; stop <= stops; stop += 1) {
    const column = pool.pool[Math.round((stop / stops) * (columns - 1))];
    if (column === undefined) continue;
    paint.addColorStop(
      stop / stops,
      `rgb(${Math.round(column.r)} ${Math.round(column.g)} ${Math.round(column.b)})`
    );
  }
  context.fillStyle = paint;
  context.fill();
  context.restore();

  /*
   * The meniscus, brightened where the surface is steep.
   *
   * A flat white line along the top reads as an edge; what makes moving water
   * legible is that its slopes catch the light and its flats do not. So the
   * highlight is drawn per segment against the local gradient, and the waves
   * become visible as waves rather than as a wobbling boundary.
   */
  context.save();
  context.lineWidth = 1.6;
  for (let i = 0; i < columns - 1; i += 1) {
    const here = surfaceY(i);
    const next = surfaceY(i + 1);
    const steep = Math.min(1, Math.abs(next - here) / 6);
    context.beginPath();
    context.moveTo((i + 0.5) * columnWidth, here);
    context.lineTo((i + 1.5) * columnWidth, next);
    context.strokeStyle = `rgba(255,255,255,${0.18 + steep * 0.5})`;
    context.stroke();
  }
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
