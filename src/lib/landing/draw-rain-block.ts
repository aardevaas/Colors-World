export interface DrawableBlock {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly size: number;
  readonly cornerRadius: number;
  readonly color: string;
}

function traceRoundedRect(ctx: CanvasRenderingContext2D, size: number, cornerRadius: number): void {
  const half = size / 2;
  ctx.beginPath();
  ctx.moveTo(-half + cornerRadius, -half);
  ctx.arcTo(half, -half, half, half, cornerRadius);
  ctx.arcTo(half, half, -half, half, cornerRadius);
  ctx.arcTo(-half, half, -half, -half, cornerRadius);
  ctx.arcTo(-half, -half, half, -half, cornerRadius);
  ctx.closePath();
}

/**
 * A soft top-light band per block reads as depth without a real light
 * source — cheap, and it's what keeps a pile (or sphere) of flat rectangles
 * from looking like a flat pile of rectangles.
 */
export function drawRainBlock(ctx: CanvasRenderingContext2D, block: DrawableBlock): void {
  ctx.save();
  ctx.translate(block.x, block.y);
  ctx.rotate(block.angle);

  traceRoundedRect(ctx, block.size, block.cornerRadius);
  ctx.fillStyle = block.color;
  ctx.fill();

  ctx.save();
  traceRoundedRect(ctx, block.size, block.cornerRadius);
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fillRect(-block.size / 2, -block.size / 2, block.size, block.size * 0.35);
  ctx.restore();

  ctx.restore();
}
