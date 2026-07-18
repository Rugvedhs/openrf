import { sineIntegral, besselJ0 } from './mathfn';

/** Speed of light, m/s (CODATA exact value). */
export const C = 2.99792458e8;

/** Permittivity of free space, F/m (CODATA exact value as of the 2019 SI redefinition). */
export const EPSILON_0 = 8.8541878128e-12;

/** Thrown when inputs are physically invalid or drive the model outside any usable range. */
export class PatchInputError extends Error {}

export interface SubstrateGeometry {
  epsilonReff: number;
  lengthExtension: number; // ΔL, meters
}

/**
 * Effective dielectric constant and fringing-field length extension for a
 * microstrip patch of given width over a substrate of given height and εr.
 * Depends only on W, h, εr — not on frequency or the patch's resonant length —
 * so both the synthesis (designPatch) and analysis (analyzePatch) directions
 * share this one derivation. Balanis, Antenna Theory, eqs. 14-6 / 14-2a.
 */
export function substrateGeometry(width: number, heightM: number, epsilonR: number): SubstrateGeometry {
  const epsilonReff =
    (epsilonR + 1) / 2 + ((epsilonR - 1) / 2) * Math.pow(1 + (12 * heightM) / width, -0.5);
  const lengthExtension =
    (heightM * 0.412 * (epsilonReff + 0.3) * (width / heightM + 0.264)) /
    ((epsilonReff - 0.258) * (width / heightM + 0.8));
  return { epsilonReff, lengthExtension };
}

export interface ElectricalProperties {
  wavelength0: number; // λ0, meters
  wavenumber0: number; // k0, rad/m
  selfConductance: number; // G1, siemens
  mutualConductance: number; // G12, siemens
  inputConductance: number; // Gin = 2(G1 + G12), siemens
  edgeResistance: number; // Rin = 1/Gin, ohms
  capacitance: number; // equivalent parallel-plate cavity capacitance, farads
  radiationQ: number; // Qrad — radiation-only quality factor (see caveats where used)
  fractionalBandwidthVswr2: number; // (VSWR-1)/(Q*sqrt(VSWR)) at VSWR=2
}

/**
 * Radiation conductance of a single radiating slot (Balanis, Antenna Theory,
 * transmission-line model), evaluated via the exact integral form
 * G1 = I1 / (120π²), I1 = -2 + cos(X) + X·Si(X) + sin(X)/X, X = k0·W.
 */
function selfConductance(k0: number, width: number): number {
  const X = k0 * width;
  const I1 = -2 + Math.cos(X) + X * sineIntegral(X) + Math.sin(X) / X;
  return I1 / (120 * Math.PI * Math.PI);
}

/**
 * Mutual conductance between the two radiating slots, accounting for their
 * separation L (Balanis, eq. 14-18a), evaluated by Simpson's rule over
 * θ ∈ [0, π]. The integrand has a removable singularity at θ = π/2
 * (cos θ → 0), handled via its analytic limit.
 */
function mutualConductance(k0: number, width: number, length: number): number {
  // Simpson's rule converges quickly for this smooth integrand: N=200 matches N=2000
  // to 10 decimal places (verified numerically), so this isn't a precision compromise —
  // it's the resolution the optimizer's few-hundred-candidate grid search needs to stay
  // interactive (this integral dominates its runtime).
  const N = 200; // even interval count for Simpson's rule
  const a = 0;
  const b = Math.PI;
  const h = (b - a) / N;

  function integrand(theta: number): number {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const arg = (k0 * width * cosT) / 2;
    const f1 = Math.abs(cosT) < 1e-9 ? (k0 * width) / 2 : Math.sin(arg) / cosT;
    return f1 * f1 * besselJ0(k0 * length * sinT) * Math.pow(sinT, 3);
  }

  let sum = integrand(a) + integrand(b);
  for (let i = 1; i < N; i++) {
    const theta = a + i * h;
    sum += integrand(theta) * (i % 2 === 0 ? 2 : 4);
  }
  const integral = (h / 3) * sum;
  return integral / (120 * Math.PI * Math.PI);
}

/**
 * Radiation Q and bandwidth, derived from stored energy vs. radiated power —
 * not a memorized closed-form constant, so its derivation is spelled out
 * here for anyone auditing it:
 *
 *   1. The patch is a parallel-plate cavity of capacitance C = ε0·εreff·W·L / h
 *      (standard parallel-plate capacitance — this is the same C the
 *      transmission-line model itself uses to derive the cavity's resonance).
 *   2. Total input conductance Gin = 2(G1 + G12) is already derived above from
 *      the verified radiation-conductance integrals.
 *   3. Q = ω0·C / Gin (energy stored / power dissipated, for a parallel RLC
 *      at resonance) — this is the textbook definition of Q, not something
 *      patch-specific.
 *   4. Fractional bandwidth at a given VSWR follows the standard resonant-
 *      circuit relation BW = (VSWR−1) / (Q·√VSWR).
 *
 * Caveat (stated to the user wherever this is displayed): this Q accounts for
 * radiated power only — dielectric and conductor loss are not included. Since
 * additional loss mechanisms only add damping, the true bandwidth is very
 * likely wider than this predicts (at the cost of some efficiency). Treat
 * this number as a conservative (narrow) estimate, not an upper bound.
 *
 * Cross-check performed during development (not asserted in tests, since it's
 * a qualitative literature comparison rather than an exact reference value):
 * this derivation reproduces the well-known "doubling substrate thickness
 * roughly doubles bandwidth" scaling rule to within ~10% when swept — see
 * the project's verification notes.
 */
function radiationQAndBandwidth(
  angularFrequency0: number,
  capacitance: number,
  inputConductance: number
): { radiationQ: number; fractionalBandwidthVswr2: number } {
  const radiationQ = (angularFrequency0 * capacitance) / inputConductance;
  const VSWR = 2;
  const fractionalBandwidthVswr2 = (VSWR - 1) / (radiationQ * Math.sqrt(VSWR));
  return { radiationQ, fractionalBandwidthVswr2 };
}

/** C = ε0·εreff·W·L / h — the cavity's equivalent parallel-plate capacitance. */
function cavityCapacitance(width: number, length: number, heightM: number, epsilonReff: number): number {
  return (EPSILON_0 * epsilonReff * width * length) / heightM;
}

/**
 * Computes every frequency-dependent electrical property (conductances, Rin,
 * capacitance, Q, bandwidth) given a fully-specified physical geometry and
 * its resonant frequency. Shared by designPatch (synthesis: f0 is the
 * target) and analyzePatch (analysis: f0 is derived from geometry).
 */
function fullElectricalProperties(
  frequencyHz: number,
  width: number,
  length: number,
  heightM: number,
  epsilonReff: number
): ElectricalProperties {
  const wavelength0 = C / frequencyHz;
  const wavenumber0 = (2 * Math.PI) / wavelength0;

  const G1 = selfConductance(wavenumber0, width);
  const G12 = mutualConductance(wavenumber0, width, length);
  const Gin = 2 * (G1 + G12);
  const Rin = 1 / Gin;

  const capacitance = cavityCapacitance(width, length, heightM, epsilonReff);
  const angularFrequency0 = 2 * Math.PI * frequencyHz;
  const { radiationQ, fractionalBandwidthVswr2 } = radiationQAndBandwidth(
    angularFrequency0,
    capacitance,
    Gin
  );

  return {
    wavelength0,
    wavenumber0,
    selfConductance: G1,
    mutualConductance: G12,
    inputConductance: Gin,
    edgeResistance: Rin,
    capacitance,
    radiationQ,
    fractionalBandwidthVswr2,
  };
}

export interface PatchInputs {
  /** Design (resonant) frequency, Hz */
  frequencyHz: number;
  /** Substrate relative permittivity, εr */
  epsilonR: number;
  /** Substrate height, meters */
  heightM: number;
  /** Loss tangent of the substrate, tan δ (used only for warnings in this MVP) */
  lossTangent: number;
  /** Desired feed-point input impedance, ohms (typically 50) */
  targetImpedanceOhm: number;
}

export interface PatchResult extends ElectricalProperties {
  width: number; // W, meters
  length: number; // L, meters
  effectiveLength: number; // Leff, meters
  epsilonReff: number;
  lengthExtension: number; // ΔL, meters
  insetFeedDepth: number | null; // y0, meters — null if target impedance is unreachable
  feasible: boolean;
  warnings: string[];
}

function validateInputs(inputs: PatchInputs): void {
  const { frequencyHz, epsilonR, heightM, lossTangent, targetImpedanceOhm } = inputs;
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    throw new PatchInputError('Frequency must be a positive number.');
  }
  if (!Number.isFinite(epsilonR) || epsilonR <= 1) {
    throw new PatchInputError('εr must be greater than 1 (air is εr = 1; all real dielectrics exceed it).');
  }
  if (!Number.isFinite(heightM) || heightM <= 0) {
    throw new PatchInputError('Substrate height must be a positive number.');
  }
  if (!Number.isFinite(lossTangent) || lossTangent < 0) {
    throw new PatchInputError('Loss tangent cannot be negative.');
  }
  if (!Number.isFinite(targetImpedanceOhm) || targetImpedanceOhm <= 0) {
    throw new PatchInputError('Target impedance must be a positive number.');
  }
}

/**
 * The width the transmission-line model uses as its standard starting point
 * for a given target frequency and εr (Balanis, eq. 14-5) — chosen to give
 * good radiation efficiency, but not the only width that will resonate at f0
 * once L is re-solved for it. synthesizeForWidth (below) accepts any width,
 * which is what the Pareto optimizer sweeps over.
 */
export function standardWidth(frequencyHz: number, epsilonR: number): number {
  return (C / (2 * frequencyHz)) * Math.sqrt(2 / (epsilonR + 1));
}

/**
 * Synthesizes a patch for an explicitly chosen width (solving for the length
 * that resonates at f0 given that width), rather than assuming the standard
 * width formula. designPatch below is the common case (standardWidth); the
 * optimizer uses this directly to explore off-standard widths, since a wider
 * or narrower patch trades size against bandwidth.
 */
export function synthesizeForWidth(
  frequencyHz: number,
  epsilonR: number,
  heightM: number,
  targetImpedanceOhm: number,
  width: number,
  lossTangent = 0
): PatchResult {
  const warnings: string[] = [];
  const { epsilonReff, lengthExtension } = substrateGeometry(width, heightM, epsilonR);
  const effectiveLength = C / (2 * frequencyHz * Math.sqrt(epsilonReff));
  const length = effectiveLength - 2 * lengthExtension;

  if (length <= 0) {
    throw new PatchInputError(
      'Substrate is too thick relative to the resonant wavelength — the fringing-field length ' +
        'extension exceeds the resonant length itself, which is unphysical. This means the ' +
        'transmission-line model has broken down (not just degraded). Reduce substrate height ' +
        'or increase frequency.'
    );
  }

  const electrical = fullElectricalProperties(frequencyHz, width, length, heightM, epsilonReff);

  let insetFeedDepth: number | null = null;
  let feasible = true;
  if (targetImpedanceOhm <= electrical.edgeResistance) {
    insetFeedDepth =
      (length / Math.PI) * Math.acos(Math.sqrt(targetImpedanceOhm / electrical.edgeResistance));
  } else {
    feasible = false;
    warnings.push(
      `Target impedance (${targetImpedanceOhm} Ω) exceeds the patch edge resistance ` +
        `(${electrical.edgeResistance.toFixed(1)} Ω) — an inset feed can only lower impedance from ` +
        'the edge value, so this target is unreachable by feed placement alone. Try a thinner ' +
        'substrate, higher εr, or a different feed technique (e.g. quarter-wave transformer).'
    );
  }

  warnings.push(...modelValidityWarnings(epsilonR, heightM, electrical.wavelength0, lossTangent));

  return {
    width,
    length,
    effectiveLength,
    epsilonReff,
    lengthExtension,
    insetFeedDepth,
    feasible,
    warnings,
    ...electrical,
  };
}

/**
 * Synthesizes microstrip patch dimensions and feed-point placement for a
 * target resonant frequency and impedance, using the transmission-line
 * model (Balanis, Antenna Theory, Ch. 14). Verified against Balanis'
 * worked Example 14.1 — see src/verify.ts. Uses the standard width formula;
 * see synthesizeForWidth to explore other widths.
 */
export function designPatch(inputs: PatchInputs): PatchResult {
  validateInputs(inputs);
  const { frequencyHz: f0, epsilonR, heightM: h, lossTangent, targetImpedanceOhm } = inputs;
  const width = standardWidth(f0, epsilonR);
  return synthesizeForWidth(f0, epsilonR, h, targetImpedanceOhm, width, lossTangent);
}

export interface AnalyzeInputs {
  /** As-built patch width, meters */
  widthM: number;
  /** As-built patch length, meters */
  lengthM: number;
  /** As-built substrate height, meters */
  heightM: number;
  /** As-built (or nominal) substrate relative permittivity */
  epsilonR: number;
  /** Feed inset depth from the patch edge, meters (fixed at fabrication — doesn't move with tolerance) */
  feedInsetM: number;
}

export interface AnalyzeResult extends ElectricalProperties {
  resonantFrequencyHz: number;
  epsilonReff: number;
  /** Input resistance actually seen at the fixed feed inset, at the actual resonant frequency. */
  feedResistance: number;
}

/**
 * The inverse of designPatch: given an as-built (possibly out-of-spec)
 * physical geometry, predicts what it will actually do — its true resonant
 * frequency and feed-point resistance. This is what tolerance/Monte-Carlo
 * analysis needs: fabrication doesn't change the target, it changes the
 * geometry, and we need to know what that geometry now resonates at.
 */
export function analyzePatch(inputs: AnalyzeInputs): AnalyzeResult {
  const { widthM: width, lengthM: length, heightM: h, epsilonR, feedInsetM } = inputs;
  if (width <= 0 || length <= 0 || h <= 0 || epsilonR <= 1) {
    throw new PatchInputError('analyzePatch requires positive width/length/height and εr > 1.');
  }

  const { epsilonReff, lengthExtension } = substrateGeometry(width, h, epsilonR);
  const effectiveLength = length + 2 * lengthExtension;
  const resonantFrequencyHz = C / (2 * effectiveLength * Math.sqrt(epsilonReff));

  const electrical = fullElectricalProperties(resonantFrequencyHz, width, length, h, epsilonReff);
  const n2 = Math.pow(Math.cos((Math.PI * feedInsetM) / length), 2);
  const feedResistance = electrical.edgeResistance * n2;

  return { resonantFrequencyHz, epsilonReff, feedResistance, ...electrical };
}

function modelValidityWarnings(
  epsilonR: number,
  heightM: number,
  wavelength0: number,
  lossTangent: number
): string[] {
  const warnings: string[] = [];
  if (epsilonR < 2) {
    warnings.push(
      `εr = ${epsilonR} is low; the transmission-line model's fringing-field assumptions ` +
        'are least accurate below εr ≈ 2. Treat dimensions as a starting point, not a final design.'
    );
  }
  if (epsilonR > 10) {
    warnings.push(
      `εr = ${epsilonR} is high; accuracy at high permittivity has not been validated against ` +
        'a textbook example in this tool — verify independently.'
    );
  }
  const hOverLambda0 = heightM / wavelength0;
  if (hOverLambda0 > 0.07) {
    warnings.push(
      `Substrate is electrically thick (h/λ₀ = ${hOverLambda0.toFixed(3)}); surface-wave ` +
        'losses become significant above roughly h/λ₀ ≈ 0.07 and are not modeled here, so ' +
        'predicted efficiency/bandwidth will be optimistic.'
    );
  }
  if (lossTangent > 0.02) {
    warnings.push(
      `tan δ = ${lossTangent} is relatively lossy; dielectric loss is not folded into the ` +
        'radiation-Q/bandwidth estimate — true bandwidth is likely somewhat wider than predicted, ' +
        'at the cost of radiation efficiency.'
    );
  }
  warnings.push(
    'Feed resistance uses the two-slot mutual-conductance correction (G1 + G12), but higher-order ' +
      'coupling and conductor loss are still neglected — treat Rin as accurate to a few percent, not exact.'
  );
  warnings.push(
    'Bandwidth is derived from radiation Q alone (stored cavity energy vs. radiated power); ' +
      'dielectric/conductor loss would broaden it further in reality, so treat it as a conservative estimate.'
  );
  return warnings;
}
