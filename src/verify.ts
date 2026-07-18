import { designPatch } from './patch';

export interface VerificationRow {
  parameter: string;
  computed: number;
  reference: number;
  units: string;
  percentError: number;
}

/**
 * Balanis, "Antenna Theory: Analysis and Design," Example 14.1:
 * f0 = 10 GHz, εr = 2.2, h = 0.1588 cm, target Zin = 50 Ω.
 * Reference values are the book's published results, used here as a
 * standing regression check — if this drifts, the physics broke.
 */
export function runBalanisExample141(): VerificationRow[] {
  const result = designPatch({
    frequencyHz: 10e9,
    epsilonR: 2.2,
    heightM: 0.1588e-2,
    lossTangent: 0.001,
    targetImpedanceOhm: 50,
  });

  const rows: Array<[string, number, number, string]> = [
    ['Patch width (W)', result.width * 100, 1.186, 'cm'],
    ['Effective εreff', result.epsilonReff, 1.972, ''],
    ['Length extension (ΔL)', result.lengthExtension * 100, 0.081, 'cm'],
    ['Patch length (L)', result.length * 100, 0.906, 'cm'],
    ['Edge resistance (Rin)', result.edgeResistance, 228, 'Ω'],
    ['Inset feed depth (y0)', (result.insetFeedDepth ?? NaN) * 100, 0.3126, 'cm'],
  ];

  return rows.map(([parameter, computed, reference, units]) => ({
    parameter,
    computed,
    reference,
    units,
    percentError: (Math.abs(computed - reference) / reference) * 100,
  }));
}
