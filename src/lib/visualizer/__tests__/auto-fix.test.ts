import { describe, expect, it } from 'vitest';
import { contrastRatio, parseColor } from '@/lib/color-engine';
import { WCAG_AA_LARGE, WCAG_AA_NORMAL, autoFixContrast } from '../auto-fix';

const c = parseColor;

describe('autoFixContrast — no-op cases', () => {
  it('reports already-passes without touching a pair that is fine', () => {
    const result = autoFixContrast(c('#FFFFFF'), c('#000000'));
    expect(result.status).toBe('already-passes');
    if (result.status === 'already-passes') expect(result.ratio).toBeGreaterThan(20);
  });

  it('respects a lower target for large text', () => {
    // ~3.45:1 — fails AA-normal, passes AA-large. Ratios here are measured,
    // not assumed: several plausible-looking pairs turned out to already pass.
    const text = c('#6B5BA8');
    const bg = c('#0B0B0C');
    const ratio = contrastRatio(text, bg);
    expect(ratio).toBeGreaterThan(WCAG_AA_LARGE);
    expect(ratio).toBeLessThan(WCAG_AA_NORMAL);

    expect(autoFixContrast(text, bg, { target: WCAG_AA_LARGE }).status).toBe('already-passes');
    expect(autoFixContrast(text, bg, { target: WCAG_AA_NORMAL }).status).toBe('fixed');
  });
});

describe('autoFixContrast — the core guarantee', () => {
  it('actually reaches the target it claims to', () => {
    const text = c('#5A3F73'); // 2.24:1 on the background below — genuinely fails
    const bg = c('#0B0B0C');
    const result = autoFixContrast(text, bg);
    expect(result.status).toBe('fixed');
    if (result.status !== 'fixed') return;
    expect(result.achievedRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    // And the reported ratio is the real one, not an internal estimate.
    expect(contrastRatio(result.color, bg)).toBeCloseTo(result.achievedRatio, 6);
  });

  it('preserves hue and chroma exactly — only lightness may move', () => {
    const text = c('#5A3F73');
    const bg = c('#0B0B0C');
    const result = autoFixContrast(text, bg);
    expect(result.status).toBe('fixed');
    if (result.status !== 'fixed') return;
    expect(result.color.h).toBe(text.h);
    expect(result.color.c).toBe(text.c);
    expect(result.color.l).not.toBe(text.l);
  });

  it('lightens against a dark background and darkens against a light one', () => {
    // Two different failing pairs — the direction has to follow the background,
    // not a fixed rule.
    const onDark = autoFixContrast(c('#5A3F73'), c('#0B0B0C')); // 2.24:1
    expect(onDark.status).toBe('fixed');
    if (onDark.status === 'fixed') expect(onDark.lightnessDelta).toBeGreaterThan(0);

    const onLight = autoFixContrast(c('#7C5CFF'), c('#FFFFFF')); // 4.35:1
    expect(onLight.status).toBe('fixed');
    if (onLight.status === 'fixed') expect(onLight.lightnessDelta).toBeLessThan(0);
  });

  it('makes the smallest change that works — it does not jump to black or white', () => {
    const text = c('#8E66B3');
    const bg = c('#0B0B0C');
    const result = autoFixContrast(text, bg);
    expect(result.status).toBe('fixed');
    if (result.status !== 'fixed') return;

    // Just past the threshold, not slammed to an extreme.
    expect(result.achievedRatio).toBeLessThan(WCAG_AA_NORMAL + 0.25);
    expect(result.color.l).toBeLessThan(1);
    expect(result.color.l).toBeGreaterThan(text.l);
  });
});

describe('autoFixContrast — adjusting the background instead', () => {
  it('moves the background and leaves the text alone', () => {
    const text = c('#7C5CFF');
    const bg = c('#5A3F73');
    const result = autoFixContrast(text, bg, { adjust: 'background' });
    expect(result.status).toBe('fixed');
    if (result.status !== 'fixed') return;
    expect(result.color.h).toBe(bg.h);
    expect(result.color.c).toBe(bg.c);
    expect(contrastRatio(text, result.color)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });
});

describe('autoFixContrast — honest failure', () => {
  it('reports unreachable rather than returning a color that still fails', () => {
    // Against mid-grey, a target this high is not achievable by any lightness.
    const result = autoFixContrast(c('#808080'), c('#808080'), { target: 21 });
    expect(result.status).toBe('unreachable');
    if (result.status === 'unreachable') {
      expect(result.bestRatio).toBeLessThan(21);
      expect(result.bestRatio).toBeGreaterThan(1);
    }
  });

  // The property that matters most: across a wide sweep of real pairs, the
  // function must never claim 'fixed' while leaving the pair below target.
  it('never returns a fixed result that fails its own target', () => {
    const hues = [0, 45, 90, 140, 200, 250, 300, 340];
    const backgrounds = ['#000000', '#0B0B0C', '#404040', '#808080', '#E0E0E0', '#FFFFFF'];
    let fixedCount = 0;

    for (const h of hues) {
      for (const bgHex of backgrounds) {
        for (const l of [0.2, 0.5, 0.8]) {
          const text = { l, c: 0.15, h };
          const bg = parseColor(bgHex);
          const result = autoFixContrast(text, bg);
          if (result.status === 'fixed') {
            fixedCount += 1;
            expect(contrastRatio(result.color, bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
            expect(result.color.h).toBe(h);
            expect(result.color.c).toBe(0.15);
          }
        }
      }
    }
    // Sanity: the sweep actually exercised the fixing path.
    expect(fixedCount).toBeGreaterThan(20);
  });
});
