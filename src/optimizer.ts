import { standardWidth, synthesizeForWidth, PatchInputError } from './patch';
import { SUBSTRATES, type Substrate } from './substrates';

export interface OptimizerCandidate {
  substrate: Substrate;
  heightM: number;
  width: number;
  length: number;
  footprintM2: number; // W x L, the quantity that matters for board real estate
  fractionalBandwidth: number;
  edgeResistance: number;
  insetFeedDepth: number | null;
  feasible: boolean;
  hOverLambda0: number;
  withinValidatedRegime: boolean; // h/lambda0 below the model's known-good range
  dominated: boolean;
}

export interface OptimizerResult {
  /** Every candidate evaluated, feasible or not — useful for the scatter plot. */
  allCandidates: OptimizerCandidate[];
  /** The non-dominated (Pareto-optimal) subset among feasible, validated-regime candidates. */
  paretoFront: OptimizerCandidate[];
}

export interface OptimizerParams {
  frequencyHz: number;
  targetImpedanceOhm: number;
  /** Substrates to search over; defaults to the full built-in catalog. */
  substrates?: Substrate[];
  /** Multiplicative range applied to the standard width formula, e.g. [0.6, 1.6]. */
  widthScaleRange?: [number, number];
  /** How many width samples to take within widthScaleRange, per (substrate, thickness) pair. */
  widthSamples?: number;
  /** Hard cutoff on h/lambda0 beyond which a candidate is excluded from the Pareto front as unmodeled. */
  maxHOverLambda0?: number;
}

/**
 * Searches (substrate x thickness x width) for the size/bandwidth tradeoff at
 * a target frequency and feed impedance, then extracts the Pareto-optimal
 * subset (minimize footprint, maximize bandwidth).
 *
 * This is a deliberate engineering choice, not a placeholder for "a real GA
 * later": the search space here is small enough (a few materials x a few
 * thicknesses x a fine width grid — a few hundred to low thousands of
 * evaluations) that an exhaustive grid search finds the *exact* Pareto front
 * in milliseconds, with no stochastic seed-dependence and no risk of a GA
 * converging to a locally-but-not-globally optimal front. A genetic/PSO
 * search earns its keep on high-dimensional or continuous-everywhere spaces;
 * applying one here would trade an exact answer for an approximate one for
 * no benefit. (Full antenna-array synthesis, with many more free parameters,
 * is where a stochastic search would become the right tool.)
 */
export function optimizePatch(params: OptimizerParams): OptimizerResult {
  const {
    frequencyHz,
    targetImpedanceOhm,
    substrates = SUBSTRATES,
    widthScaleRange = [0.6, 1.6],
    widthSamples = 40,
    maxHOverLambda0 = 0.1,
  } = params;

  const allCandidates: OptimizerCandidate[] = [];

  for (const substrate of substrates) {
    const baseWidth = standardWidth(frequencyHz, substrate.epsilonR);
    for (const heightM of substrate.thicknessesM) {
      for (let i = 0; i < widthSamples; i++) {
        const t = widthSamples === 1 ? 0.5 : i / (widthSamples - 1);
        const scale = widthScaleRange[0] + t * (widthScaleRange[1] - widthScaleRange[0]);
        const width = baseWidth * scale;

        let result;
        try {
          result = synthesizeForWidth(
            frequencyHz,
            substrate.epsilonR,
            heightM,
            targetImpedanceOhm,
            width,
            substrate.lossTangent
          );
        } catch (err) {
          if (err instanceof PatchInputError) continue; // unphysical geometry at this grid point — skip it
          throw err;
        }

        const hOverLambda0 = heightM / result.wavelength0;
        allCandidates.push({
          substrate,
          heightM,
          width: result.width,
          length: result.length,
          footprintM2: result.width * result.length,
          fractionalBandwidth: result.fractionalBandwidthVswr2,
          edgeResistance: result.edgeResistance,
          insetFeedDepth: result.insetFeedDepth,
          feasible: result.feasible,
          hOverLambda0,
          withinValidatedRegime: hOverLambda0 <= maxHOverLambda0,
          dominated: false, // filled in below
        });
      }
    }
  }

  const eligible = allCandidates.filter((c) => c.feasible && c.withinValidatedRegime);
  const paretoFront = computeParetoFront(eligible);
  const paretoSet = new Set(paretoFront);
  for (const c of allCandidates) {
    c.dominated = eligible.includes(c) && !paretoSet.has(c);
  }

  // Sort the front by footprint ascending, so the UI can render it as a readable curve.
  paretoFront.sort((a, b) => a.footprintM2 - b.footprintM2);

  return { allCandidates, paretoFront };
}

/**
 * Non-dominated sort for two objectives (minimize footprint, maximize
 * bandwidth). O(n^2), which is fine at the scale this optimizer runs at
 * (a few hundred to low thousands of candidates).
 */
function computeParetoFront(candidates: OptimizerCandidate[]): OptimizerCandidate[] {
  return candidates.filter((candidate) => {
    return !candidates.some((other) => {
      if (other === candidate) return false;
      const notWorseInFootprint = other.footprintM2 <= candidate.footprintM2;
      const notWorseInBandwidth = other.fractionalBandwidth >= candidate.fractionalBandwidth;
      const strictlyBetterInOne =
        other.footprintM2 < candidate.footprintM2 || other.fractionalBandwidth > candidate.fractionalBandwidth;
      return notWorseInFootprint && notWorseInBandwidth && strictlyBetterInOne;
    });
  });
}
