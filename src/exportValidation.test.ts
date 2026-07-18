import { describe, it, expect } from 'vitest';
import { designPatch } from './patch';
import { buildValidationPackage } from './exportValidation';

describe('buildValidationPackage', () => {
  it('includes every key predicted number, pulled from the design result rather than re-derived', () => {
    const frequencyHz = 2.45e9;
    const epsilonR = 4.4;
    const heightM = 1.6e-3;
    const lossTangent = 0.02;
    const targetImpedanceOhm = 50;
    const result = designPatch({ frequencyHz, epsilonR, heightM, lossTangent, targetImpedanceOhm });

    const markdown = buildValidationPackage({
      result,
      frequencyHz,
      epsilonR,
      heightM,
      lossTangent,
      targetImpedanceOhm,
      substrateName: 'FR4 (generic)',
    });

    expect(markdown).toContain('FR4 (generic)');
    expect(markdown).toContain('2.450000 GHz');
    expect(markdown).toContain((result.width * 1000).toFixed(4));
    expect(markdown).toContain(result.edgeResistance.toFixed(2));
    expect(markdown).toContain(result.radiationQ.toFixed(2));
    expect(markdown).toContain('Measurement results');
    for (const warning of result.warnings) {
      expect(markdown).toContain(warning);
    }
  });

  it('flags an unreachable feed target instead of printing a bogus inset depth', () => {
    const frequencyHz = 2.45e9;
    const epsilonR = 4.4;
    const heightM = 1.6e-3;
    const result = designPatch({
      frequencyHz,
      epsilonR,
      heightM,
      lossTangent: 0.02,
      targetImpedanceOhm: 5000,
    });
    const markdown = buildValidationPackage({
      result,
      frequencyHz,
      epsilonR,
      heightM,
      lossTangent: 0.02,
      targetImpedanceOhm: 5000,
      substrateName: 'FR4 (generic)',
    });
    expect(markdown).toContain('UNREACHABLE');
  });
});
