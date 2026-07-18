/**
 * A small catalog of real, commercially available PCB substrates with
 * published nominal εr / tan δ and the thicknesses each is actually sold in.
 * These are nominal datasheet figures for the material family, not a
 * measurement of any specific panel — always confirm against the
 * manufacturer's current datasheet before committing to a fabrication run.
 * Manufacturing tolerances are typical figures used for the Monte Carlo
 * tolerance analysis (see montecarlo.ts), not per-vendor guarantees.
 */

export interface Substrate {
  id: string;
  name: string;
  epsilonR: number;
  lossTangent: number;
  /** Available laminate thicknesses, meters. */
  thicknessesM: number[];
  /** Typical ± fractional tolerance on εr (e.g. 0.05 = ±5%). */
  epsilonRToleranceFrac: number;
  /** Typical ± fractional tolerance on thickness. */
  thicknessToleranceFrac: number;
  notes: string;
}

export const SUBSTRATES: Substrate[] = [
  {
    id: 'fr4',
    name: 'FR4 (generic)',
    epsilonR: 4.4,
    lossTangent: 0.02,
    thicknessesM: [0.4e-3, 0.8e-3, 1.6e-3, 3.2e-3],
    epsilonRToleranceFrac: 0.08,
    thicknessToleranceFrac: 0.1,
    notes:
      'Cheapest, most available option. εr varies noticeably by manufacturer and with ' +
      'frequency (commonly quoted 4.3–4.6 in the low-GHz range) and its loss tangent is high ' +
      'enough to matter above a few GHz — fine for 2.4GHz ISM-band work, a poor choice above ~6GHz.',
  },
  {
    id: 'ro4003c',
    name: 'Rogers RO4003C',
    epsilonR: 3.55,
    lossTangent: 0.0027,
    thicknessesM: [0.203e-3, 0.508e-3, 0.813e-3, 1.524e-3],
    epsilonRToleranceFrac: 0.021,
    thicknessToleranceFrac: 0.03,
    notes:
      'Woven-glass PTFE-free laminate, much tighter εr control and lower loss than FR4. ' +
      'Common choice for real 2.4–10GHz designs where FR4\'s loss becomes a problem.',
  },
  {
    id: 'rt5880',
    name: 'Rogers RT/duroid 5880',
    epsilonR: 2.2,
    lossTangent: 0.0009,
    thicknessesM: [0.254e-3, 0.508e-3, 0.787e-3, 1.575e-3],
    epsilonRToleranceFrac: 0.014,
    thicknessToleranceFrac: 0.03,
    notes:
      'PTFE/glass-microfiber, very low loss, the substrate Balanis\' own worked example ' +
      '(Ch. 14, Example 14.1) uses. Common at higher microwave/mm-wave frequencies.',
  },
  {
    id: 'alumina',
    name: 'Alumina (96%) ceramic',
    epsilonR: 9.8,
    lossTangent: 0.0002,
    thicknessesM: [0.254e-3, 0.508e-3, 0.635e-3, 1.0e-3],
    epsilonRToleranceFrac: 0.02,
    thicknessToleranceFrac: 0.05,
    notes:
      'High-εr ceramic — shrinks the patch substantially for a given frequency, at the cost ' +
      'of narrower bandwidth and being far more expensive/fragile to fabricate on than PCB laminates.',
  },
];

export function findSubstrate(id: string): Substrate {
  const substrate = SUBSTRATES.find((s) => s.id === id);
  if (!substrate) {
    throw new Error(`Unknown substrate id: ${id}`);
  }
  return substrate;
}
