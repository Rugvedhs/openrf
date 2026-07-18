/**
 * Predicted |S11| / VSWR vs. frequency near resonance, from a narrowband
 * linearized admittance model:
 *
 *   Y_edge(f) ≈ Gin + j·2·ω0·C·(f − f0)/f0        (parallel-RLC admittance,
 *                                                    linearized near f0)
 *   Y_feed(f) = Y_edge(f) / n²,  n² = cos²(π·y0/L)  (inset-feed impedance
 *                                                    transformer, Balanis eq. 14-16,
 *                                                    assumed frequency-independent)
 *   Γ(f) = (1/Y_feed(f) − Z0) / (1/Y_feed(f) + Z0)
 *
 * This is the standard way an introductory antenna course derives an
 * approximate patch frequency response from the cavity model — not a novel
 * claim of this project. Its correctness here rests on two things that ARE
 * specific to this project and are covered by tests: Gin and C are the same
 * quantities verified in patch.ts, and by construction Γ(f0) = 0 exactly,
 * since the feed inset was solved so that Z_feed(f0) equals the target
 * impedance — see the self-consistency test in frequencyResponse.test.ts.
 *
 * Valid only near resonance (linearization breaks down more than a few
 * bandwidths away from f0) — the sweep range is deliberately kept narrow.
 */

export interface FrequencyResponseParams {
  resonantFrequencyHz: number;
  inputConductance: number; // Gin, siemens
  capacitance: number; // F
  feedTransformerN2: number; // n² = cos²(π·y0/L)
  referenceImpedanceOhm: number; // Z0 — the impedance the design targets (e.g. 50Ω)
}

export interface FrequencyResponsePoint {
  frequencyHz: number;
  reflectionMagnitude: number; // |Γ|
  returnLossDb: number; // 20·log10(|Γ|) — negative dB, more negative is better
  vswr: number;
}

function complexAdmittanceAtResonance(
  frequencyHz: number,
  params: FrequencyResponseParams
): { re: number; im: number } {
  const { resonantFrequencyHz: f0, inputConductance: Gin, capacitance: capacitanceF } = params;
  const omega0 = 2 * Math.PI * f0;
  return {
    re: Gin,
    im: (2 * omega0 * capacitanceF * (frequencyHz - f0)) / f0,
  };
}

function complexDivide(a: { re: number; im: number }, b: { re: number; im: number }): { re: number; im: number } {
  const denom = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / denom, im: (a.im * b.re - a.re * b.im) / denom };
}

export function evaluateFrequencyResponse(
  frequencyHz: number,
  params: FrequencyResponseParams
): FrequencyResponsePoint {
  const yEdge = complexAdmittanceAtResonance(frequencyHz, params);
  const yFeed = { re: yEdge.re / params.feedTransformerN2, im: yEdge.im / params.feedTransformerN2 };
  const zFeed = complexDivide({ re: 1, im: 0 }, yFeed);

  const z0 = params.referenceImpedanceOhm;
  const numerator = { re: zFeed.re - z0, im: zFeed.im };
  const denominator = { re: zFeed.re + z0, im: zFeed.im };
  const gamma = complexDivide(numerator, denominator);

  const reflectionMagnitude = Math.hypot(gamma.re, gamma.im);
  const returnLossDb = 20 * Math.log10(Math.max(reflectionMagnitude, 1e-12));
  const vswr = (1 + reflectionMagnitude) / Math.max(1 - reflectionMagnitude, 1e-9);

  return { frequencyHz, reflectionMagnitude, returnLossDb, vswr };
}

/**
 * Sweeps a symmetric band around resonance, sized to a multiple of the
 * predicted −10dB-ish bandwidth so the plot always frames the interesting
 * region regardless of how narrow or wide the design is.
 */
export function sweepFrequencyResponse(
  params: FrequencyResponseParams,
  fractionalBandwidth: number,
  points = 121,
  spanInBandwidths = 4
): FrequencyResponsePoint[] {
  const { resonantFrequencyHz: f0 } = params;
  const halfSpanHz = Math.max(f0 * fractionalBandwidth * spanInBandwidths, f0 * 0.001);
  const result: FrequencyResponsePoint[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1); // 0..1
    const f = f0 - halfSpanHz + 2 * halfSpanHz * t;
    result.push(evaluateFrequencyResponse(f, params));
  }
  return result;
}
