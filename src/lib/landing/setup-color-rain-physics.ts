import type Matter from 'matter-js';

/**
 * Scroll-driven "rain" of colour blocks that pile up under real physics.
 * Spawn rate is tied to how far the visitor has scrolled through the
 * section (`section.getBoundingClientRect()` against viewport height), not
 * to time — scrolling faster or slower changes how much falls, scrolling
 * back up never un-spawns a block, since a pile you already caused
 * shouldn't vanish under you.
 *
 * This is deliberately the first pass: blocks fall, collide, and settle
 * into a floor pile inside the sticky viewport. Where they end up and how
 * a visitor can interact with the pile is a separate follow-up.
 */

const MAX_BLOCKS = 220;
const SPAWN_PER_SCROLL_UNIT = 140;
const MIN_BLOCK_SIZE = 22;
const MAX_BLOCK_SIZE = 54;
const WALL_THICKNESS = 80;

interface FallingBlock {
  readonly body: Matter.Body;
  readonly size: number;
  readonly color: string;
  readonly cornerRadius: number;
}

export function setupColorRainPhysics(
  matter: typeof Matter,
  section: HTMLElement,
  canvas: HTMLCanvasElement,
  swatchHexes: readonly string[]
): () => void {
  const { Engine, Bodies, Composite, Body } = matter;

  const engine = Engine.create();
  engine.enableSleeping = true;

  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    return () => {};
  }

  let width = canvas.clientWidth;
  let height = canvas.clientHeight;

  function sizeCanvas(): void {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeCanvas();

  const floor = Bodies.rectangle(width / 2, height + WALL_THICKNESS / 2, width * 2, WALL_THICKNESS, {
    isStatic: true,
  });
  const leftWall = Bodies.rectangle(-WALL_THICKNESS / 2, height / 2, WALL_THICKNESS, height * 3, {
    isStatic: true,
  });
  const rightWall = Bodies.rectangle(width + WALL_THICKNESS / 2, height / 2, WALL_THICKNESS, height * 3, {
    isStatic: true,
  });
  Composite.add(engine.world, [floor, leftWall, rightWall]);

  const blocks: FallingBlock[] = [];

  function spawnBlock(): void {
    if (blocks.length >= MAX_BLOCKS || swatchHexes.length === 0) return;
    const size = MIN_BLOCK_SIZE + Math.random() * (MAX_BLOCK_SIZE - MIN_BLOCK_SIZE);
    const x = size / 2 + Math.random() * Math.max(1, width - size);
    const color = swatchHexes[Math.floor(Math.random() * swatchHexes.length)] ?? '#ffffff';
    const cornerRadius = size * 0.18;
    const body = Bodies.rectangle(x, -size, size, size, {
      restitution: 0.35,
      friction: 0.6,
      frictionAir: 0.001,
      chamfer: { radius: cornerRadius },
    });
    Body.setAngle(body, Math.random() * Math.PI);
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2);
    Composite.add(engine.world, body);
    blocks.push({ body, size, color, cornerRadius });
  }

  // --- scroll-progress-driven spawn budget ---
  let spawnBudget = 0;
  let maxProgressSeen = 0;

  function currentProgress(): number {
    const rect = section.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) return 1;
    return Math.min(1, Math.max(0, -rect.top / total));
  }

  function handleScroll(): void {
    const progress = currentProgress();
    if (progress > maxProgressSeen) {
      spawnBudget += (progress - maxProgressSeen) * SPAWN_PER_SCROLL_UNIT;
      maxProgressSeen = progress;
    }
  }
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // Pause the whole loop while the section is off-screen — no point
  // stepping physics or drawing frames nobody can see.
  let sectionVisible = true;
  const observer = new IntersectionObserver(
    (entries) => {
      sectionVisible = entries[0]?.isIntersecting ?? false;
    },
    { threshold: 0 }
  );
  observer.observe(section);

  function drawRoundedRect(radius: number, size: number): void {
    if (ctx === null) return;
    const half = size / 2;
    ctx.beginPath();
    ctx.moveTo(-half + radius, -half);
    ctx.arcTo(half, -half, half, half, radius);
    ctx.arcTo(half, half, -half, half, radius);
    ctx.arcTo(-half, half, -half, -half, radius);
    ctx.arcTo(-half, -half, half, -half, radius);
    ctx.closePath();
  }

  function drawBlock(block: FallingBlock): void {
    if (ctx === null) return;
    const { position, angle } = block.body;
    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(angle);

    drawRoundedRect(block.cornerRadius, block.size);
    ctx.fillStyle = block.color;
    ctx.fill();

    // A soft top-light band per block reads as depth without a real light
    // source — cheap, and it's what keeps a pile of flat rectangles from
    // looking like a flat pile of rectangles.
    ctx.save();
    drawRoundedRect(block.cornerRadius, block.size);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(-block.size / 2, -block.size / 2, block.size, block.size * 0.35);
    ctx.restore();

    ctx.restore();
  }

  let frameId = 0;
  let lastTime = performance.now();

  function tick(time: number): void {
    frameId = requestAnimationFrame(tick);
    const delta = Math.min(32, time - lastTime);
    lastTime = time;
    if (!sectionVisible || ctx === null) return;

    while (spawnBudget >= 1) {
      spawnBlock();
      spawnBudget -= 1;
    }

    Engine.update(engine, delta);

    ctx.clearRect(0, 0, width, height);
    for (const block of blocks) drawBlock(block);
  }
  frameId = requestAnimationFrame(tick);

  function handleResize(): void {
    sizeCanvas();
    Body.setPosition(floor, { x: width / 2, y: height + WALL_THICKNESS / 2 });
    Body.setPosition(leftWall, { x: -WALL_THICKNESS / 2, y: height / 2 });
    Body.setPosition(rightWall, { x: width + WALL_THICKNESS / 2, y: height / 2 });
  }
  window.addEventListener('resize', handleResize);

  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('resize', handleResize);
    observer.disconnect();
    Composite.clear(engine.world, false);
    Engine.clear(engine);
  };
}
