import { analyzePatch, type PatchResult } from './patch';
import type { Substrate } from './substrates';

export interface ManufacturingTolerances {
  /** ± fractional tolerance on εr (e.g. 0.05 = ±5%), applied as a uniform perturbation. */
  epsilonRToleranceFrac: number;
  /** ± fractional tolerance on substrate thickness. */
  thicknessToleranceFrac: number;
  /** ± absolute tolerance on copper etch (width/length), meters — a fixed process tolerance, not a % of size. */
  etchToleranceM: number;
}

export function defaultTolerancesFor(substrate: Substrate): ManufacturingTolerances {
  return {
    epsilonRToleranceFrac: substrate.epsilonRToleranceFrac,
    thicknessToleranceFrac: substrate.thicknessToleranceFrac,
    // ~1 mil (0.0254mm) is a commonly quoted standard PCB etch tolerance; treat as a
    // nominal default, not a guarantee — production tolerance varies by fabricator/process.
    etchToleranceM: 0.0254e-3,
  };
}

export interface MonteCarloParams {
  nominalDesign: PatchResult;
  /** The frequency the design targeted — passed through as the reference line on the chart. */
  targetFrequencyHz: number;
  /** The impedance the design targeted — passed through as the reference line on the chart. */
  targetImpedanceOhm: number;
  heightM: number;
  epsilonR: number;
  tolerances: ManufacturingTolerances;
  trials?: number;
  /** Seeded PRNG for reproducible runs (defaults to Math.random via a simple wrapper). */
  random?: () => number;
}

export interface MonteCarloTrial {
  resonantFrequencyHz: number;
  feedResistance: number;
}

export interface MonteCarloResult {
  trials: MonteCarloTrial[];
  resonantFrequencyHz: {
    p5: number;
    p50: number;
    p95: number;
    nominal: number;
  };
  feedResistance: {
    p5: number;
    p50: number;
    p95: number;
    nominal: number;
  };
}

/** Uniform(-1, 1) sample, scaled by a tolerance fraction/magnitude — a conservative choice
 * absent a manufacturer-published distribution shape (many fabs only publish a tolerance
 * band, not a distribution), rather than assuming e.g. Gaussian and understating the tails. */
function uniformPerturbation(random: () => number, magnitude: number): number {
  return (random() * 2 - 1) * magnitude;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * Propagates realistic fabrication tolerances (dielectric constant variance,
 * laminate thickness variance, copper etch tolerance) through the *analysis*
 * direction (analyzePatch) to show how the as-built antenna's resonant
 * frequency and feed match actually shift — not just the nominal prediction.
 *
 * Etch tolerance is modeled as a fixed absolute error per edge (typical of a
 * real photolithography/etch process), not a percentage of patch size — a
 * small patch and a large patch fabricated on the same line see the same
 * absolute etch tolerance, not a scaled one.
 */
export function runMonteCarlo(params: MonteCarloParams): MonteCarloResult {
  const {
    nominalDesign,
    targetFrequencyHz,
    targetImpedanceOhm,
    heightM,
    epsilonR,
    tolerances,
    trials = 1000,
    random = Math.random,
  } = params;
  if (nominalDesign.insetFeedDepth === null) {
    throw new Error('runMonteCarlo requires a feasible nominal design (insetFeedDepth must be set).');
  }

  const results: MonteCarloTrial[] = [];
  for (let i = 0; i < trials; i++) {
    const perturbedEpsilonR =
      epsilonR * (1 + uniformPerturbation(random, tolerances.epsilonRToleranceFrac));
    const perturbedHeight =
      heightM * (1 + uniformPerturbation(random, tolerances.thicknessToleranceFrac));
    const perturbedWidth =
      nominalDesign.width + uniformPerturbation(random, tolerances.etchToleranceM);
    const perturbedLength =
      nominalDesign.length + uniformPerturbation(random, tolerances.etchToleranceM);

    try {
      const analysis = analyzePatch({
        widthM: perturbedWidth,
        lengthM: perturbedLength,
        heightM: perturbedHeight,
        epsilonR: perturbedEpsilonR,
        feedInsetM: nominalDesign.insetFeedDepth,
      });
      results.push({ resonantFrequencyHz: analysis.resonantFrequencyHz, feedResistance: analysis.feedResistance });
    } catch {
      // A small fraction of perturbations can land on unphysical geometry (e.g. feed
      // inset now exceeding the perturbed length) — skip those trials rather than
      // let one bad sample crash the whole batch.
      continue;
    }
  }

  const freqs = results.map((r) => r.resonantFrequencyHz).sort((a, b) => a - b);
  const resistances = results.map((r) => r.feedResistance).sort((a, b) => a - b);

  return {
    trials: results,
    resonantFrequencyHz: {
      p5: percentile(freqs, 0.05),
      p50: percentile(freqs, 0.5),
      p95: percentile(freqs, 0.95),
      nominal: targetFrequencyHz,
    },
    feedResistance: {
      p5: percentile(resistances, 0.05),
      p50: percentile(resistances, 0.5),
      p95: percentile(resistances, 0.95),
      nominal: targetImpedanceOhm,
    },
  };
}
