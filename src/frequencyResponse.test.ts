import { describe, it, expect } from 'vitest';
import { designPatch } from './patch';
import { evaluateFrequencyResponse, sweepFrequencyResponse } from './frequencyResponse';

function feedTransformerN2(insetFeedDepth: number, length: number): number {
  return Math.pow(Math.cos((Math.PI * insetFeedDepth) / length), 2);
}

describe('frequency response self-consistency', () => {
  it('gives exactly zero reflection at the resonant frequency, by mathematical construction', () => {
    // The feed inset is solved (in designPatch) so that Z_feed(f0) equals the target
    // impedance exactly. If this test ever fails, the frequency-response model and the
    // feed-synthesis math have drifted out of sync with each other.
    const design = designPatch({
      frequencyHz: 2.45e9,
      epsilonR: 4.4,
      heightM: 1.6e-3,
      lossTangent: 0.02,
      targetImpedanceOhm: 50,
    });
    const point = evaluateFrequencyResponse(2.45e9, {
      resonantFrequencyHz: 2.45e9,
      inputConductance: design.inputConductance,
      capacitance: design.capacitance,
      feedTransformerN2: feedTransformerN2(design.insetFeedDepth!, design.length),
      referenceImpedanceOhm: 50,
    });
    expect(point.reflectionMagnitude).toBeLessThan(1e-9);
    expect(point.vswr).toBeCloseTo(1, 6);
  });

  it('is symmetric in |Gamma| around resonance for small symmetric detuning (linearized model)', () => {
    const design = designPatch({
      frequencyHz: 5.8e9,
      epsilonR: 2.2,
      heightM: 0.787e-3,
      lossTangent: 0.0009,
      targetImpedanceOhm: 50,
    });
    const params = {
      resonantFrequencyHz: 5.8e9,
      inputConductance: design.inputConductance,
      capacitance: design.capacitance,
      feedTransformerN2: feedTransformerN2(design.insetFeedDepth!, design.length),
      referenceImpedanceOhm: 50,
    };
    const delta = 5.8e9 * 0.002;
    const below = evaluateFrequencyResponse(5.8e9 - delta, params);
    const above = evaluateFrequencyResponse(5.8e9 + delta, params);
    expect(below.reflectionMagnitude).toBeCloseTo(above.reflectionMagnitude, 6);
  });

  it('degrades monotonically as frequency moves away from resonance, within the swept band', () => {
    const design = designPatch({
      frequencyHz: 2.45e9,
      epsilonR: 4.4,
      heightM: 1.6e-3,
      lossTangent: 0.02,
      targetImpedanceOhm: 50,
    });
    const points = sweepFrequencyResponse(
      {
        resonantFrequencyHz: 2.45e9,
        inputConductance: design.inputConductance,
        capacitance: design.capacitance,
        feedTransformerN2: feedTransformerN2(design.insetFeedDepth!, design.length),
        referenceImpedanceOhm: 50,
      },
      design.fractionalBandwidthVswr2,
      41
    );
    const midpoint = Math.floor(points.length / 2);
    for (let i = midpoint; i < points.length - 1; i++) {
      expect(points[i + 1].reflectionMagnitude).toBeGreaterThanOrEqual(points[i].reflectionMagnitude - 1e-9);
    }
  });
});
