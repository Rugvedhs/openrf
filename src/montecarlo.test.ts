import { describe, it, expect } from 'vitest';
import { designPatch } from './patch';
import { runMonteCarlo, defaultTolerancesFor } from './montecarlo';
import { findSubstrate } from './substrates';

/** Deterministic linear-congruential PRNG so tests don't depend on Math.random. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

describe('runMonteCarlo', () => {
  it('centers the resonant-frequency ensemble near the nominal target frequency', () => {
    const substrate = findSubstrate('fr4');
    const targetFrequencyHz = 2.45e9;
    const design = designPatch({
      frequencyHz: targetFrequencyHz,
      epsilonR: substrate.epsilonR,
      heightM: 1.6e-3,
      lossTangent: substrate.lossTangent,
      targetImpedanceOhm: 50,
    });
    const result = runMonteCarlo({
      nominalDesign: design,
      targetFrequencyHz,
      targetImpedanceOhm: 50,
      heightM: 1.6e-3,
      epsilonR: substrate.epsilonR,
      tolerances: defaultTolerancesFor(substrate),
      trials: 2000,
      random: seededRandom(42),
    });

    expect(result.trials.length).toBeGreaterThan(1900); // most trials should be physically valid
    expect(result.resonantFrequencyHz.p50).toBeCloseTo(targetFrequencyHz, -7); // within ~a few tens of MHz
    expect(result.resonantFrequencyHz.p5).toBeLessThan(result.resonantFrequencyHz.p50);
    expect(result.resonantFrequencyHz.p95).toBeGreaterThan(result.resonantFrequencyHz.p50);
  });

  it('produces a wider frequency spread for a loosely-toleranced substrate (FR4) than a tight one (Rogers 5880)', () => {
    const targetFrequencyHz = 2.45e9;
    function spreadFor(substrateId: string, heightM: number): number {
      const substrate = findSubstrate(substrateId);
      const design = designPatch({
        frequencyHz: targetFrequencyHz,
        epsilonR: substrate.epsilonR,
        heightM,
        lossTangent: substrate.lossTangent,
        targetImpedanceOhm: 50,
      });
      const result = runMonteCarlo({
        nominalDesign: design,
        targetFrequencyHz,
        targetImpedanceOhm: 50,
        heightM,
        epsilonR: substrate.epsilonR,
        tolerances: defaultTolerancesFor(substrate),
        trials: 2000,
        random: seededRandom(7),
      });
      return result.resonantFrequencyHz.p95 - result.resonantFrequencyHz.p5;
    }

    const fr4Spread = spreadFor('fr4', 1.6e-3);
    const rogersSpread = spreadFor('rt5880', 1.575e-3);
    expect(fr4Spread).toBeGreaterThan(rogersSpread);
  });

  it('is reproducible given the same seeded PRNG', () => {
    const substrate = findSubstrate('fr4');
    const design = designPatch({
      frequencyHz: 2.45e9,
      epsilonR: substrate.epsilonR,
      heightM: 1.6e-3,
      lossTangent: substrate.lossTangent,
      targetImpedanceOhm: 50,
    });
    const run = () =>
      runMonteCarlo({
        nominalDesign: design,
        targetFrequencyHz: 2.45e9,
        targetImpedanceOhm: 50,
        heightM: 1.6e-3,
        epsilonR: substrate.epsilonR,
        tolerances: defaultTolerancesFor(substrate),
        trials: 500,
        random: seededRandom(123),
      });
    const a = run();
    const b = run();
    expect(a.resonantFrequencyHz.p50).toBe(b.resonantFrequencyHz.p50);
  });

  it('throws if the nominal design has no feed solution (infeasible target)', () => {
    const substrate = findSubstrate('fr4');
    const design = designPatch({
      frequencyHz: 2.45e9,
      epsilonR: substrate.epsilonR,
      heightM: 1.6e-3,
      lossTangent: substrate.lossTangent,
      targetImpedanceOhm: 10000, // absurd, guarantees infeasible
    });
    expect(() =>
      runMonteCarlo({
        nominalDesign: design,
        targetFrequencyHz: 2.45e9,
        targetImpedanceOhm: 10000,
        heightM: 1.6e-3,
        epsilonR: substrate.epsilonR,
        tolerances: defaultTolerancesFor(substrate),
      })
    ).toThrow();
  });
});
