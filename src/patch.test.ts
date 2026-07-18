import { describe, it, expect } from 'vitest';
import { runBalanisExample141 } from './verify';
import { designPatch, analyzePatch, PatchInputError } from './patch';
import { sineIntegral, besselJ0 } from './mathfn';

describe('designPatch vs. Balanis Example 14.1', () => {
  it('matches every published value within 1%', () => {
    const rows = runBalanisExample141();
    for (const row of rows) {
      expect(row.percentError, `${row.parameter} off by ${row.percentError.toFixed(2)}%`).toBeLessThan(1);
    }
  });
});

describe('designPatch edge cases', () => {
  it('flags an unreachable target impedance instead of returning a bogus feed depth', () => {
    const result = designPatch({
      frequencyHz: 2.4e9,
      epsilonR: 4.4,
      heightM: 1.6e-3,
      lossTangent: 0.02,
      targetImpedanceOhm: 1000, // absurdly high on purpose
    });
    expect(result.feasible).toBe(false);
    expect(result.insetFeedDepth).toBeNull();
    expect(result.warnings.some((w) => w.includes('unreachable'))).toBe(true);
  });

  it('warns about electrically thick substrates', () => {
    const result = designPatch({
      frequencyHz: 2.4e9,
      epsilonR: 2.2,
      heightM: 10e-3, // deliberately thick
      lossTangent: 0.001,
      targetImpedanceOhm: 50,
    });
    expect(result.warnings.some((w) => w.includes('electrically thick'))).toBe(true);
  });

  it('rejects a substrate so thick the model goes unphysical (L <= 0) instead of returning garbage', () => {
    // Empirically, h/lambda0 ~0.49 drives L negative at f0=2.45GHz, er=4.4 (h=60mm) — confirm the guard trips.
    expect(() =>
      designPatch({
        frequencyHz: 2.45e9,
        epsilonR: 4.4,
        heightM: 60e-3,
        lossTangent: 0.02,
        targetImpedanceOhm: 50,
      })
    ).toThrow(PatchInputError);
  });

  it.each([
    ['zero frequency', { frequencyHz: 0, epsilonR: 4.4, heightM: 1.6e-3, lossTangent: 0.02, targetImpedanceOhm: 50 }],
    ['negative frequency', { frequencyHz: -1e9, epsilonR: 4.4, heightM: 1.6e-3, lossTangent: 0.02, targetImpedanceOhm: 50 }],
    ['epsilonR at the air boundary', { frequencyHz: 2.4e9, epsilonR: 1, heightM: 1.6e-3, lossTangent: 0.02, targetImpedanceOhm: 50 }],
    ['epsilonR below air', { frequencyHz: 2.4e9, epsilonR: 0.5, heightM: 1.6e-3, lossTangent: 0.02, targetImpedanceOhm: 50 }],
    ['zero height', { frequencyHz: 2.4e9, epsilonR: 4.4, heightM: 0, lossTangent: 0.02, targetImpedanceOhm: 50 }],
    ['negative height', { frequencyHz: 2.4e9, epsilonR: 4.4, heightM: -1e-3, lossTangent: 0.02, targetImpedanceOhm: 50 }],
    ['negative loss tangent', { frequencyHz: 2.4e9, epsilonR: 4.4, heightM: 1.6e-3, lossTangent: -0.01, targetImpedanceOhm: 50 }],
    ['zero target impedance', { frequencyHz: 2.4e9, epsilonR: 4.4, heightM: 1.6e-3, lossTangent: 0.02, targetImpedanceOhm: 0 }],
    ['NaN frequency (e.g. empty form field)', { frequencyHz: NaN, epsilonR: 4.4, heightM: 1.6e-3, lossTangent: 0.02, targetImpedanceOhm: 50 }],
  ])('rejects invalid input: %s', (_label, inputs) => {
    expect(() => designPatch(inputs)).toThrow(PatchInputError);
  });
});

describe('physical invariants', () => {
  it('keeps X = k0*W a function of epsilonR alone, bounded in (0, pi) — guarantees Si(X) never sees a huge argument', () => {
    // W is derived purely from f0 and epsilonR (independent of h), so k0*W = pi*sqrt(2/(er+1))
    // regardless of frequency or substrate height. This is what keeps selfConductance's Si()
    // call numerically safe for literally any user input.
    for (const er of [1.01, 2.2, 4.4, 10, 100]) {
      for (const freqGHz of [0.1, 2.45, 10, 60]) {
        // Height scaled to a fixed fraction of the free-space wavelength so every
        // combination stays in the electrically-thin regime the model assumes —
        // a fixed absolute height (e.g. 1mm) becomes physically-thick at 60GHz/high-er
        // and correctly trips the L<=0 guard, which would be an unrelated failure here.
        const lambda0AtFreq = 2.99792458e8 / (freqGHz * 1e9);
        const result = designPatch({
          frequencyHz: freqGHz * 1e9,
          epsilonR: er,
          heightM: 0.01 * lambda0AtFreq,
          lossTangent: 0.001,
          targetImpedanceOhm: 1, // low enough to always be reachable
        });
        const X = result.wavenumber0 * result.width;
        const predicted = Math.PI * Math.sqrt(2 / (er + 1));
        expect(X).toBeCloseTo(predicted, 6);
        expect(X).toBeGreaterThan(0);
        expect(X).toBeLessThan(Math.PI);
      }
    }
  });

  it('places the inset feed at the patch center (y0 = L/2) when the target impedance is (near) zero', () => {
    const result = designPatch({
      frequencyHz: 2.45e9,
      epsilonR: 4.4,
      heightM: 1.6e-3,
      lossTangent: 0.02,
      targetImpedanceOhm: 1e-9,
    });
    expect(result.insetFeedDepth!).toBeCloseTo(result.length / 2, 6);
  });

  it('places the inset feed at the edge (y0 = 0) when the target impedance equals the edge resistance', () => {
    const probe = designPatch({
      frequencyHz: 2.45e9,
      epsilonR: 4.4,
      heightM: 1.6e-3,
      lossTangent: 0.02,
      targetImpedanceOhm: 1,
    });
    const result = designPatch({
      frequencyHz: 2.45e9,
      epsilonR: 4.4,
      heightM: 1.6e-3,
      lossTangent: 0.02,
      targetImpedanceOhm: probe.edgeResistance,
    });
    expect(result.insetFeedDepth!).toBeCloseTo(0, 6);
  });

  it('scales patch width exactly as 1/f0 (W depends only on f0 and epsilonR in the closed form)', () => {
    const base = designPatch({
      frequencyHz: 2.45e9,
      epsilonR: 4.4,
      heightM: 1.6e-3,
      lossTangent: 0.02,
      targetImpedanceOhm: 50,
    });
    const doubled = designPatch({
      frequencyHz: 4.9e9,
      epsilonR: 4.4,
      heightM: 1.6e-3,
      lossTangent: 0.02,
      targetImpedanceOhm: 50,
    });
    expect(doubled.width).toBeCloseTo(base.width / 2, 9);
  });

  it('keeps radiation conductances physically non-negative across a sweep of realistic inputs', () => {
    for (const er of [2.2, 4.4, 6.15, 10.2]) {
      for (const freqGHz of [0.9, 2.45, 5.8, 24]) {
        const result = designPatch({
          frequencyHz: freqGHz * 1e9,
          epsilonR: er,
          heightM: 1e-3,
          lossTangent: 0.001,
          targetImpedanceOhm: 1,
        });
        expect(result.selfConductance).toBeGreaterThan(0);
        expect(result.edgeResistance).toBeGreaterThan(0);
      }
    }
  });
});

describe('mathfn sanity checks against tabulated values', () => {
  it.each([
    [1, 0.9460830703671831],
    [2, 1.6054129768026948],
    [5, 1.5499312449446743],
    [10, 1.6583475942188739],
  ])('Si(%f) ≈ %f', (x, expected) => {
    expect(sineIntegral(x)).toBeCloseTo(expected, 6);
  });

  it.each([
    [0, 1],
    [1, 0.7651976865579666],
    [5, -0.17759677131433832],
  ])('J0(%f) ≈ %f', (x, expected) => {
    expect(besselJ0(x)).toBeCloseTo(expected, 6);
  });

  it('has its first zero at the known root x ≈ 2.404826', () => {
    expect(Math.abs(besselJ0(2.404826))).toBeLessThan(1e-5);
  });
});

describe('radiation Q and bandwidth (derived from stored energy vs. radiated power)', () => {
  it('gives a plausible Q and bandwidth on the Balanis Example 14.1 geometry', () => {
    // No published reference value to check against here (unlike Rin), but this is a
    // physically thin substrate (h/lambda0 ~ 0.053) so a moderately high Q / few-percent
    // bandwidth is the expected regime — a wildly different order of magnitude would
    // indicate a derivation error.
    const result = designPatch({
      frequencyHz: 10e9,
      epsilonR: 2.2,
      heightM: 0.1588e-2,
      lossTangent: 0.0009,
      targetImpedanceOhm: 50,
    });
    expect(result.radiationQ).toBeGreaterThan(5);
    expect(result.radiationQ).toBeLessThan(100);
    expect(result.fractionalBandwidthVswr2).toBeGreaterThan(0.005);
    expect(result.fractionalBandwidthVswr2).toBeLessThan(0.2);
  });

  it('predicts wider bandwidth for thicker substrates, monotonically, at fixed frequency/material', () => {
    const heights_mm = [0.5, 1, 1.6, 2, 4, 8];
    const bandwidths = heights_mm.map(
      (h) =>
        designPatch({
          frequencyHz: 2.45e9,
          epsilonR: 4.4,
          heightM: h / 1000,
          lossTangent: 0.02,
          targetImpedanceOhm: 1, // keep the feed always reachable across the sweep
        }).fractionalBandwidthVswr2
    );
    for (let i = 1; i < bandwidths.length; i++) {
      expect(bandwidths[i]).toBeGreaterThan(bandwidths[i - 1]);
    }
  });

  it('roughly reproduces the literature-cited "doubling h roughly doubles bandwidth" scaling rule', () => {
    // This is the actual independent cross-check: the exact doubling ratio isn't asserted
    // (the derivation isn't claiming that precision), but it should land in a sane
    // neighborhood of 2x per doubling of h, not e.g. 1.05x or 10x.
    const bw = (hMm: number) =>
      designPatch({
        frequencyHz: 2.45e9,
        epsilonR: 4.4,
        heightM: hMm / 1000,
        lossTangent: 0.02,
        targetImpedanceOhm: 1,
      }).fractionalBandwidthVswr2;
    const ratio = bw(2) / bw(1);
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(3);
  });
});

describe('analyzePatch (forward analysis) round-trips with designPatch (inverse synthesis)', () => {
  it('recovers the original target frequency when analyzing the geometry designPatch produced', () => {
    const targetFreqHz = 2.45e9;
    const design = designPatch({
      frequencyHz: targetFreqHz,
      epsilonR: 4.4,
      heightM: 1.6e-3,
      lossTangent: 0.02,
      targetImpedanceOhm: 50,
    });
    const analysis = analyzePatch({
      widthM: design.width,
      lengthM: design.length,
      heightM: 1.6e-3,
      epsilonR: 4.4,
      feedInsetM: design.insetFeedDepth!,
    });
    expect(analysis.resonantFrequencyHz).toBeCloseTo(targetFreqHz, 0);
    expect(analysis.feedResistance).toBeCloseTo(50, 6);
  });

  it('rejects non-physical geometry the same way designPatch rejects non-physical inputs', () => {
    expect(() =>
      analyzePatch({ widthM: 0, lengthM: 0.01, heightM: 0.001, epsilonR: 4.4, feedInsetM: 0 })
    ).toThrow(PatchInputError);
    expect(() =>
      analyzePatch({ widthM: 0.01, lengthM: 0.01, heightM: 0.001, epsilonR: 1, feedInsetM: 0 })
    ).toThrow(PatchInputError);
  });

  it('shows a manufacturing-tolerance shift: thinner-than-nominal substrate resonates higher', () => {
    const targetFreqHz = 2.45e9;
    const nominal = designPatch({
      frequencyHz: targetFreqHz,
      epsilonR: 4.4,
      heightM: 1.6e-3,
      lossTangent: 0.02,
      targetImpedanceOhm: 50,
    });
    // Simulate a laminate that came in 10% thinner than spec (within typical FR4 tolerance):
    // thinner h -> higher epsilonReff and smaller deltaL -> shorter effective length -> resonates higher.
    const thinner = analyzePatch({
      widthM: nominal.width,
      lengthM: nominal.length,
      heightM: 1.6e-3 * 0.9,
      epsilonR: 4.4,
      feedInsetM: nominal.insetFeedDepth!,
    });
    const thicker = analyzePatch({
      widthM: nominal.width,
      lengthM: nominal.length,
      heightM: 1.6e-3 * 1.1,
      epsilonR: 4.4,
      feedInsetM: nominal.insetFeedDepth!,
    });
    expect(thinner.resonantFrequencyHz).toBeGreaterThan(targetFreqHz);
    expect(thicker.resonantFrequencyHz).toBeLessThan(targetFreqHz);
  });
});
