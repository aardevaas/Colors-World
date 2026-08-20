/**
 * How the lettering moves.
 *
 * Measured from the reference rather than guessed, and the measurement
 * overturned the obvious reading: two frames captured with the pointer not
 * moved at all (its own on-screen coordinate readout stayed frozen) showed the
 * word at two different angles. The primary motion is therefore a continuous
 * idle tumble that runs whether or not anyone is touching it. Pointer input is
 * a *secondary* offset added on top, and it lags rather than tracking — the
 * word swings toward where you are, it does not snap to it.
 *
 * Building it the other way round — pointer drives rotation, idle is a garnish
 * — produces something that looks dead the moment the mouse stops, which is
 * exactly what the first attempt at this got wrong.
 *
 * Pure: no DOM, no WebGL, no React.
 */

export interface Euler3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Degrees the pointer can pull the word away from rest, per axis. */
export const POINTER_YAW_DEG = 26;
export const POINTER_PITCH_DEG = 16;

/** Idle tumble amplitudes. Deliberately not equal, and the periods below are
 *  deliberately not harmonically related, so the motion never visibly repeats. */
const IDLE_YAW_DEG = 13;
const IDLE_PITCH_DEG = 7.5;
const IDLE_ROLL_DEG = 3.2;

/** Seconds per cycle. Mutually irrational-ish, so the loop point is far away. */
const IDLE_YAW_PERIOD = 11.3;
const IDLE_PITCH_PERIOD = 7.9;
const IDLE_ROLL_PERIOD = 17.1;

const DEG = Math.PI / 180;

/**
 * The word's resting animation at time `t` seconds.
 *
 * Three sine waves at unrelated periods rather than one — a single period reads
 * as a metronome within about two cycles, and the reference plainly does not.
 */
export function idleTumble(t: number): Euler3 {
  const safe = Number.isFinite(t) ? t : 0;
  return {
    x: Math.sin((safe / IDLE_PITCH_PERIOD) * Math.PI * 2) * IDLE_PITCH_DEG * DEG,
    y: Math.sin((safe / IDLE_YAW_PERIOD) * Math.PI * 2) * IDLE_YAW_DEG * DEG,
    z: Math.sin((safe / IDLE_ROLL_PERIOD) * Math.PI * 2) * IDLE_ROLL_DEG * DEG,
  };
}

/**
 * Where the pointer wants the word to point.
 *
 * `ndcX`/`ndcY` are normalised device coordinates (-1..1). Yaw follows X and
 * pitch follows *inverted* Y, so the word turns to face the cursor rather than
 * away from it — the sign here is the difference between "it looks at me" and
 * "it recoils from me", and only one of those matches the reference.
 */
export function pointerRotation(ndcX: number, ndcY: number): Euler3 {
  const x = clamp(Number.isFinite(ndcX) ? ndcX : 0, -1, 1);
  const y = clamp(Number.isFinite(ndcY) ? ndcY : 0, -1, 1);
  return {
    x: -y * POINTER_PITCH_DEG * DEG,
    y: x * POINTER_YAW_DEG * DEG,
    z: 0,
  };
}

/**
 * Frame-rate independent damping.
 *
 * The naive `current + (target - current) * k` moves further per second on a
 * 144Hz display than on a 60Hz one, so the same code feels different on
 * different machines. The exponential form below converges at a rate set by
 * `lambda` in units of per-second, whatever the frame rate.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return current;
  const rate = Number.isFinite(lambda) && lambda > 0 ? lambda : 0;
  return target + (current - target) * Math.exp(-rate * dt);
}

export function dampEuler(
  current: Euler3,
  target: Euler3,
  lambda: number,
  dt: number
): Euler3 {
  return {
    x: damp(current.x, target.x, lambda, dt),
    y: damp(current.y, target.y, lambda, dt),
    z: damp(current.z, target.z, lambda, dt),
  };
}

/** Idle plus the damped pointer offset — what actually gets applied. */
export function composeRotation(idle: Euler3, pointer: Euler3): Euler3 {
  return { x: idle.x + pointer.x, y: idle.y + pointer.y, z: idle.z + pointer.z };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
