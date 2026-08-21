import { describe, expect, it } from 'vitest';
import { CVD_TYPES, deltaEOk, parseColor, simulateCvd } from '@/lib/color-engine';
import { deriveRoles, type RoleColor } from '../semantic-roles';
import {
  COMFORTABLE_DISTANCE,
  MERGE_DISTANCE,
  buildCvdReport,
} from '../cvd-conflicts';

function color(hex: string): RoleColor {
  return { hex, oklch: parseColor(hex) };
}

/** Separated mostly by lightness, which is what makes a palette CVD-safe. */
const LIGHTNESS_LED = deriveRoles([
  color('#0B0B0C'),
  color('#17171A'),
  color('#2A2A30'),
  color('#7C5CFF'),
  color('#FFB454'),
  color('#F2F2F5'),
]);

/** Two roles set to nearly the same color: a palette problem that must not
 *  be reported as a vision one. */
const TOO_CLOSE = deriveRoles([
  color('#0B0B0C'),
  color('#17171A'),
  color('#2A2A30'),
  color('#7C5CFF'),
  color('#7D5DFF'),
  color('#F2F2F5'),
]);

/** The textbook trap: a red and a green carrying different meanings at the
 *  same lightness, which deuteranopia collapses. */
const RED_GREEN = deriveRoles([
  color('#0B0B0C'),
  color('#17171A'),
  color('#2A2A30'),
  color('#C0392B'),
  color('#27AE60'),
  color('#F2F2F5'),
]);

describe('buildCvdReport — shape', () => {
  it('covers all four vision types', () => {
    expect(buildCvdReport(LIGHTNESS_LED).byType.map((r) => r.type)).toEqual([...CVD_TYPES]);
  });

  it('assesses every unordered pair of roles once', () => {
    const report = buildCvdReport(LIGHTNESS_LED);
    const first = report.byType[0]!;
    const total = first.pairs.length + report.alreadyClose.length;
    // Six roles, fifteen unordered pairs.
    expect(total).toBe(15);
  });

  it('agrees with the engine it is built on', () => {
    const report = buildCvdReport(RED_GREEN);
    for (const finding of report.byType[0]!.pairs) {
      const expected = deltaEOk(
        simulateCvd(RED_GREEN[finding.a].oklch, 'protanopia'),
        simulateCvd(RED_GREEN[finding.b].oklch, 'protanopia')
      );
      expect(finding.simulated).toBeCloseTo(expected, 10);
    }
  });

  it('is deterministic', () => {
    expect(buildCvdReport(RED_GREEN)).toEqual(buildCvdReport(RED_GREEN));
  });
});

describe('buildCvdReport — what counts as a finding', () => {
  it('does not blame color blindness for a pair that was never distinct', () => {
    // A pair that was already indistinguishable retains its non-difference
    // perfectly under every simulation. Reporting that four times over as a
    // vision problem would bury the real ones and blame the wrong cause.
    const report = buildCvdReport(TOO_CLOSE);
    const closePairs = report.alreadyClose.map((f) => `${f.a}/${f.b}`);
    expect(closePairs.length).toBeGreaterThan(0);
    for (const finding of report.alreadyClose) {
      expect(finding.normal).toBeLessThan(MERGE_DISTANCE);
    }
    // And they appear nowhere in the per-type findings.
    for (const type of report.byType) {
      for (const finding of type.pairs) {
        expect(closePairs).not.toContain(`${finding.a}/${finding.b}`);
      }
    }
  });

  it('finds the red/green collapse under deuteranopia', () => {
    // ΔE 0.317 in normal vision down to 0.112 -- the pair was distinct and
    // the simulation destroyed most of it.
    const report = buildCvdReport(RED_GREEN);
    const deuter = report.byType.find((r) => r.type === 'deuteranopia')!;
    const flagged = [...deuter.merged, ...deuter.weakened].map((f) => `${f.a}/${f.b}`);
    expect(flagged).toContain('primary/accent');
  });

  it('leaves a well-made dark palette free of false positives', () => {
    // background and surface sit at ΔE 0.056 -- deliberately subtle, and
    // genuinely separable. A threshold set above them would make every
    // well-made dark palette report a problem with its own panels.
    expect(buildCvdReport(LIGHTNESS_LED).alreadyClose).toEqual([]);
  });

  it('calls a lightness-separated palette safe', () => {
    // The finding worth being able to state: separate by lightness and color
    // blindness stops being a threat. A tool that flagged something here
    // would be crying wolf.
    expect(buildCvdReport(LIGHTNESS_LED).safe).toBe(true);
    expect(buildCvdReport(LIGHTNESS_LED).worst).toBeNull();
  });

  it('does not flag a pair that lost separation but kept plenty', () => {
    const report = buildCvdReport(LIGHTNESS_LED);
    for (const type of report.byType) {
      for (const finding of type.pairs) {
        if (finding.verdict === 'holds') continue;
        expect(finding.simulated).toBeLessThan(COMFORTABLE_DISTANCE);
      }
    }
  });

  it('accepts that a simulation can separate a pair more than normal vision', () => {
    // Measured: red and green come out *further* apart under tritanopia than
    // in normal vision. Retention above 1 is real and must not be treated as
    // an error.
    const report = buildCvdReport(RED_GREEN);
    const tritan = report.byType.find((r) => r.type === 'tritanopia')!;
    const pair = tritan.pairs.find((f) => `${f.a}/${f.b}` === 'primary/accent');
    expect(pair!.retained).toBeGreaterThan(1);
    expect(pair!.verdict).toBe('holds');
  });
});

describe('buildCvdReport — ordering', () => {
  it('puts merged pairs before weakened ones', () => {
    const report = buildCvdReport(RED_GREEN);
    for (const type of report.byType) {
      const ranks = type.pairs.map((f) =>
        f.verdict === 'merged' ? 0 : f.verdict === 'weakened' ? 1 : 2
      );
      for (let i = 1; i < ranks.length; i += 1) {
        expect(ranks[i]!).toBeGreaterThanOrEqual(ranks[i - 1]!);
      }
    }
  });

  it('names the single worst pair across every vision type', () => {
    const report = buildCvdReport(RED_GREEN);
    expect(report.worst).not.toBeNull();
    const flagged = report.byType.flatMap((t) => [...t.merged, ...t.weakened]);
    for (const finding of flagged) {
      expect(report.worst!.simulated).toBeLessThanOrEqual(finding.simulated + 1e-9);
    }
  });
});

describe('buildCvdReport — degenerate palettes', () => {
  it('survives a palette where every role is the same color', () => {
    const flat = deriveRoles([color('#808080')], {
      background: color('#808080'),
      surface: color('#808080'),
      primary: color('#808080'),
      text: color('#808080'),
      accent: color('#808080'),
      border: color('#808080'),
    });
    const report = buildCvdReport(flat);
    expect(() => buildCvdReport(flat)).not.toThrow();
    // Every pair is zero distance, so all fifteen are already-close and none
    // can be blamed on vision.
    expect(report.alreadyClose).toHaveLength(15);
    expect(report.safe).toBe(true);
  });

  it('survives an empty palette, which resolves to the neutral fallbacks', () => {
    expect(() => buildCvdReport(deriveRoles([]))).not.toThrow();
  });
});
