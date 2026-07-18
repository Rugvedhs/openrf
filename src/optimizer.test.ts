import { describe, it, expect } from 'vitest';
import { optimizePatch } from './optimizer';

describe('optimizePatch Pareto front', () => {
  it('contains no candidate dominated by another feasible, validated-regime candidate', () => {
    const { paretoFront } = optimizePatch({ frequencyHz: 2.45e9, targetImpedanceOhm: 50 });
    expect(paretoFront.length).toBeGreaterThan(1);
    for (const a of paretoFront) {
      for (const b of paretoFront) {
        if (a === b) continue;
        const bDominatesA = b.footprintM2 <= a.footprintM2 && b.fractionalBandwidth >= a.fractionalBandwidth &&
          (b.footprintM2 < a.footprintM2 || b.fractionalBandwidth > a.fractionalBandwidth);
        expect(bDominatesA).toBe(false);
      }
    }
  });

  it('marks every non-Pareto eligible candidate as dominated by something', () => {
    const { allCandidates, paretoFront } = optimizePatch({ frequencyHz: 2.45e9, targetImpedanceOhm: 50 });
    const paretoSet = new Set(paretoFront);
    for (const c of allCandidates) {
      if (c.feasible && c.withinValidatedRegime && !paretoSet.has(c)) {
        expect(c.dominated).toBe(true);
        const dominator = paretoFront.some(
          (p) => p.footprintM2 <= c.footprintM2 && p.fractionalBandwidth >= c.fractionalBandwidth &&
            (p.footprintM2 < c.footprintM2 || p.fractionalBandwidth > c.fractionalBandwidth)
        );
        expect(dominator).toBe(true);
      }
    }
  });

  it('excludes candidates outside the validated h/lambda0 regime from the Pareto front', () => {
    const { paretoFront } = optimizePatch({ frequencyHz: 2.45e9, targetImpedanceOhm: 50, maxHOverLambda0: 0.1 });
    for (const c of paretoFront) {
      expect(c.hOverLambda0).toBeLessThanOrEqual(0.1);
    }
  });

  it('excludes infeasible (unreachable target impedance) candidates from the Pareto front', () => {
    const { paretoFront } = optimizePatch({ frequencyHz: 2.45e9, targetImpedanceOhm: 50 });
    for (const c of paretoFront) {
      expect(c.feasible).toBe(true);
    }
  });

  it('runs the full grid search in well under a second (interactive UI budget)', () => {
    const start = performance.now();
    optimizePatch({ frequencyHz: 2.45e9, targetImpedanceOhm: 50 });
    const elapsedMs = performance.now() - start;
    expect(elapsedMs).toBeLessThan(1000);
  });

  it('shows the expected tradeoff direction: the largest-footprint Pareto point has the best bandwidth', () => {
    const { paretoFront } = optimizePatch({ frequencyHz: 2.45e9, targetImpedanceOhm: 50 });
    const byFootprint = [...paretoFront].sort((a, b) => a.footprintM2 - b.footprintM2);
    const smallest = byFootprint[0];
    const largest = byFootprint[byFootprint.length - 1];
    expect(largest.fractionalBandwidth).toBeGreaterThanOrEqual(smallest.fractionalBandwidth);
  });
});
