import './style.css';
import { designPatch, PatchInputError, type PatchResult } from './patch';
import { runBalanisExample141 } from './verify';
import { sweepFrequencyResponse } from './frequencyResponse';
import { runMonteCarlo, defaultTolerancesFor, type MonteCarloResult } from './montecarlo';
import { optimizePatch, type OptimizerResult, type OptimizerCandidate } from './optimizer';
import { SUBSTRATES, findSubstrate } from './substrates';
import { renderFrequencyResponseChart, renderParetoScatter } from './svgCharts';
import { downloadValidationPackage } from './exportValidation';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <header class="masthead">
    <div>
      <h1>OpenRF</h1>
      <p class="tagline">Microstrip patch antenna synthesis &amp; tradeoff analysis — transmission-line model, entirely client-side</p>
    </div>
    <nav>
      <button type="button" id="toggle-verify" class="linklike">textbook verification</button>
      &nbsp;·&nbsp;
      <a href="./openrf-spec.md" target="_blank" rel="noopener">spec</a>
    </nav>
  </header>

  <section id="verify-panel" class="sheet hidden">
    <div class="section-heading"><span class="num">§0</span><h2>Verification against Balanis, <em>Antenna Theory</em>, Example 14.1</h2></div>
    <p class="section-note">f0 = 10 GHz, εr = 2.2, h = 0.1588 cm, target Zin = 50 Ω — this tool's output compared against the book's published results.</p>
    <table class="datatable" id="verify-table"></table>
  </section>

  <div class="layout">
    <div class="controls">
      <section class="sheet">
        <div class="section-heading"><span class="num">§1</span><h2>Design target</h2></div>
        <div class="field">
          <label for="substrate">Substrate</label>
          <select id="substrate">
            ${SUBSTRATES.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
            <option value="custom">Custom</option>
          </select>
        </div>
        <div class="field">
          <label for="freq">Resonant frequency (GHz)</label>
          <input id="freq" type="number" step="0.01" min="0.01" value="2.45" />
        </div>
        <div class="field">
          <label for="epsr">εr</label>
          <input id="epsr" type="number" step="0.01" min="1.001" value="4.4" />
        </div>
        <div class="field">
          <label for="height">Substrate height h (mm)</label>
          <input id="height" type="number" step="0.01" min="0.001" value="1.6" />
        </div>
        <div class="field">
          <label for="losstan">Loss tangent (tan δ)</label>
          <input id="losstan" type="number" step="0.0001" min="0" value="0.02" />
        </div>
        <div class="field">
          <label for="zin">Target feed impedance (Ω)</label>
          <input id="zin" type="number" step="0.1" min="0.1" value="50" />
        </div>
        <button id="calc" type="button">Synthesize</button>
      </section>
    </div>

    <div class="results">
      <section id="error" class="sheet hidden">
        <div class="section-heading"><span class="num">!</span><h2>Invalid input</h2></div>
        <div class="notice error"><ul id="error-message"></ul></div>
      </section>

      <section id="results" class="sheet hidden">
        <div class="section-heading"><span class="num">§2</span><h2>Synthesized geometry <span id="feasible-tag"></span></h2></div>
        <table class="datatable" id="results-table"></table>
        <div id="warnings-container"></div>
        <button id="export-validation" type="button" class="secondary" style="margin-top:0.9rem;">
          Export validation package (.md)
        </button>
        <p class="section-note" style="margin-top:0.4rem;">
          Downloads a fabrication + measurement checklist pre-filled with these exact numbers — see
          <code>validation/PHYSICAL_BUILD_AND_MEASUREMENT.md</code> for the full build guide.
        </p>
      </section>

      <section id="response-section" class="sheet hidden">
        <div class="section-heading"><span class="num">§3</span><h2>Predicted frequency response</h2></div>
        <p class="section-note">
          Narrowband parallel-RLC model referenced to the target impedance (derivation and caveats in the source —
          see <code>frequencyResponse.ts</code>). By construction the reflection coefficient is exactly zero at the
          design frequency.
        </p>
        <figure class="chart-figure" id="response-chart-container"></figure>
        <div class="grid-2">
          <div class="stat-line"><span class="label">Radiation Q</span><span id="stat-q"></span></div>
          <div class="stat-line"><span class="label">Bandwidth (VSWR ≤ 2)</span><span id="stat-bw"></span></div>
        </div>
      </section>

      <section id="montecarlo-section" class="sheet hidden">
        <div class="section-heading"><span class="num">§4</span><h2>Manufacturing tolerance (Monte Carlo)</h2></div>
        <p class="section-note">
          Propagates typical fabrication tolerances (εr variance, laminate thickness variance, ±1 mil copper etch)
          through the as-built geometry to show how the real antenna's resonance and match are likely to shift from
          the nominal prediction — the feed inset stays fixed at its designed position, as it would on a fabricated board.
        </p>
        <button id="run-mc" type="button" class="secondary">Run 1,000-trial Monte Carlo</button>
        <div id="mc-results" class="hidden" style="margin-top:0.9rem;">
          <div class="grid-2">
            <div>
              <div class="stat-line"><span class="label">Resonant freq. p5</span><span id="mc-freq-p5"></span></div>
              <div class="stat-line"><span class="label">Resonant freq. p50</span><span id="mc-freq-p50"></span></div>
              <div class="stat-line"><span class="label">Resonant freq. p95</span><span id="mc-freq-p95"></span></div>
            </div>
            <div>
              <div class="stat-line"><span class="label">Feed resistance p5</span><span id="mc-zin-p5"></span></div>
              <div class="stat-line"><span class="label">Feed resistance p50</span><span id="mc-zin-p50"></span></div>
              <div class="stat-line"><span class="label">Feed resistance p95</span><span id="mc-zin-p95"></span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="optimizer-section" class="sheet">
        <div class="section-heading"><span class="num">§5</span><h2>Design-space tradeoff (Pareto front)</h2></div>
        <p class="section-note">
          Exhaustive grid search over substrate, thickness, and patch width at the target frequency/impedance —
          not a genetic/PSO search (the space is small enough that exhaustive search finds the exact Pareto front
          in milliseconds; see the reasoning in <code>optimizer.ts</code>). Minimizes footprint, maximizes bandwidth.
        </p>
        <button id="run-optimize" type="button" class="secondary">Explore tradeoffs at this frequency/impedance</button>
        <div id="optimizer-results" class="hidden" style="margin-top:1rem;">
          <figure class="chart-figure" id="pareto-chart-container"></figure>
          <div class="legend" id="pareto-legend"></div>
          <table class="datatable" id="pareto-table" style="margin-top:1rem;"></table>
        </div>
      </section>
    </div>
  </div>

  <footer class="colophon">
    Transmission-line model per Balanis, <em>Antenna Theory: Analysis and Design</em>, Ch. 14.
    Radiation Q/bandwidth derived from stored cavity energy vs. radiated power (see source comments for the full
    derivation and its cross-checks). 100% client-side — nothing you enter leaves this browser tab.
  </footer>
`;

function fmt(value: number, digits = 4): string {
  return Number.isFinite(value) ? value.toPrecision(digits) : '—';
}

// ---------------------------------------------------------------------------
// §0 verification panel
// ---------------------------------------------------------------------------

function renderVerification(): void {
  const rows = runBalanisExample141();
  const table = document.querySelector<HTMLTableElement>('#verify-table')!;
  table.innerHTML = `
    <thead><tr><th>Parameter</th><th class="num">Computed</th><th class="num">Balanis (published)</th><th class="num">Error</th></tr></thead>
    <tbody>
      ${rows
        .map(
          (r) => `
        <tr>
          <td>${r.parameter}</td>
          <td class="num">${fmt(r.computed)} ${r.units}</td>
          <td class="num">${r.reference} ${r.units}</td>
          <td class="num"><span class="tag ${r.percentError < 1 ? 'ok' : 'bad'}">${r.percentError.toFixed(2)}%</span></td>
        </tr>`
        )
        .join('')}
    </tbody>
  `;
}

// ---------------------------------------------------------------------------
// §1/§2 substrate presets + synthesis
// ---------------------------------------------------------------------------

document.querySelector<HTMLSelectElement>('#substrate')!.addEventListener('change', (e) => {
  const id = (e.target as HTMLSelectElement).value;
  if (id === 'custom') return;
  const substrate = findSubstrate(id);
  (document.querySelector<HTMLInputElement>('#epsr')!).value = String(substrate.epsilonR);
  (document.querySelector<HTMLInputElement>('#losstan')!).value = String(substrate.lossTangent);
});

let currentDesign: { result: PatchResult; frequencyHz: number; targetImpedanceOhm: number } | null = null;

function showError(message: string): void {
  for (const id of ['#results', '#response-section', '#montecarlo-section']) {
    document.querySelector<HTMLElement>(id)!.classList.add('hidden');
  }
  const errorSection = document.querySelector<HTMLElement>('#error')!;
  errorSection.classList.remove('hidden');
  document.querySelector<HTMLUListElement>('#error-message')!.innerHTML = `<li>${message}</li>`;
}

function clearError(): void {
  document.querySelector<HTMLElement>('#error')!.classList.add('hidden');
}

function renderResults(result: PatchResult): void {
  document.querySelector<HTMLElement>('#results')!.classList.remove('hidden');

  const tag = document.querySelector<HTMLSpanElement>('#feasible-tag')!;
  tag.innerHTML = result.feasible
    ? '<span class="tag ok">feed reachable</span>'
    : '<span class="tag bad">feed unreachable</span>';

  const table = document.querySelector<HTMLTableElement>('#results-table')!;
  const rows: Array<[string, string]> = [
    ['Patch width (W)', `${fmt(result.width * 1000)} mm`],
    ['Patch length (L)', `${fmt(result.length * 1000)} mm`],
    ['Effective εreff', fmt(result.epsilonReff)],
    ['Length extension (ΔL)', `${fmt(result.lengthExtension * 1000)} mm`],
    ['Free-space wavelength (λ0)', `${fmt(result.wavelength0 * 1000)} mm`],
    ['Self conductance (G1)', `${fmt(result.selfConductance)} S`],
    ['Mutual conductance (G12)', `${fmt(result.mutualConductance)} S`],
    ['Edge resistance (Rin, y=0)', `${fmt(result.edgeResistance)} Ω`],
    [
      'Inset feed depth (y0)',
      result.insetFeedDepth !== null ? `${fmt(result.insetFeedDepth * 1000)} mm from edge` : '— (unreachable)',
    ],
  ];
  table.innerHTML = `<tbody>${rows.map(([k, v]) => `<tr><td>${k}</td><td class="num">${v}</td></tr>`).join('')}</tbody>`;

  const warningsContainer = document.querySelector<HTMLDivElement>('#warnings-container')!;
  warningsContainer.innerHTML =
    result.warnings.length > 0
      ? `<div class="notice"><h3>Model notes</h3><ul>${result.warnings.map((w) => `<li>${w}</li>`).join('')}</ul></div>`
      : '';
}

function renderFrequencyResponse(result: PatchResult, frequencyHz: number, targetImpedanceOhm: number): void {
  const section = document.querySelector<HTMLElement>('#response-section')!;
  if (!result.feasible || result.insetFeedDepth === null) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  const n2 = Math.pow(Math.cos((Math.PI * result.insetFeedDepth) / result.length), 2);
  const points = sweepFrequencyResponse(
    {
      resonantFrequencyHz: frequencyHz,
      inputConductance: result.inputConductance,
      capacitance: result.capacitance,
      feedTransformerN2: n2,
      referenceImpedanceOhm: targetImpedanceOhm,
    },
    result.fractionalBandwidthVswr2
  );

  const container = document.querySelector<HTMLElement>('#response-chart-container')!;
  container.innerHTML =
    renderFrequencyResponseChart(points, frequencyHz) +
    '<figcaption>Fig. 1 — Predicted |S11| vs. frequency, narrowband model referenced to the target feed impedance.</figcaption>';

  document.querySelector<HTMLSpanElement>('#stat-q')!.textContent = result.radiationQ.toFixed(1);
  document.querySelector<HTMLSpanElement>('#stat-bw')!.textContent =
    `${(result.fractionalBandwidthVswr2 * 100).toFixed(2)}% (${(result.fractionalBandwidthVswr2 * frequencyHz / 1e6).toFixed(1)} MHz)`;
}

function readSubstrateInputs() {
  const frequencyHz = Number((document.querySelector<HTMLInputElement>('#freq')!).value) * 1e9;
  const epsilonR = Number((document.querySelector<HTMLInputElement>('#epsr')!).value);
  const heightM = Number((document.querySelector<HTMLInputElement>('#height')!).value) / 1000;
  const lossTangent = Number((document.querySelector<HTMLInputElement>('#losstan')!).value);
  const targetImpedanceOhm = Number((document.querySelector<HTMLInputElement>('#zin')!).value);
  return { frequencyHz, epsilonR, heightM, lossTangent, targetImpedanceOhm };
}

function handleCalculate(): void {
  const { frequencyHz, epsilonR, heightM, lossTangent, targetImpedanceOhm } = readSubstrateInputs();
  try {
    const result = designPatch({ frequencyHz, epsilonR, heightM, lossTangent, targetImpedanceOhm });
    clearError();
    currentDesign = { result, frequencyHz, targetImpedanceOhm };
    renderResults(result);
    renderFrequencyResponse(result, frequencyHz, targetImpedanceOhm);
    document.querySelector<HTMLElement>('#montecarlo-section')!.classList.toggle('hidden', !result.feasible);
    document.querySelector<HTMLElement>('#mc-results')!.classList.add('hidden');
  } catch (err) {
    if (err instanceof PatchInputError) {
      showError(err.message);
      currentDesign = null;
    } else {
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// §4 Monte Carlo tolerance analysis
// ---------------------------------------------------------------------------

function renderMonteCarlo(mc: MonteCarloResult): void {
  document.querySelector<HTMLElement>('#mc-results')!.classList.remove('hidden');
  const fmtFreq = (hz: number) => `${(hz / 1e9).toFixed(4)} GHz`;
  document.querySelector<HTMLElement>('#mc-freq-p5')!.textContent = fmtFreq(mc.resonantFrequencyHz.p5);
  document.querySelector<HTMLElement>('#mc-freq-p50')!.textContent = fmtFreq(mc.resonantFrequencyHz.p50);
  document.querySelector<HTMLElement>('#mc-freq-p95')!.textContent = fmtFreq(mc.resonantFrequencyHz.p95);
  document.querySelector<HTMLElement>('#mc-zin-p5')!.textContent = `${mc.feedResistance.p5.toFixed(1)} Ω`;
  document.querySelector<HTMLElement>('#mc-zin-p50')!.textContent = `${mc.feedResistance.p50.toFixed(1)} Ω`;
  document.querySelector<HTMLElement>('#mc-zin-p95')!.textContent = `${mc.feedResistance.p95.toFixed(1)} Ω`;

  if (currentDesign) {
    const { result, frequencyHz, targetImpedanceOhm } = currentDesign;
    const n2 = Math.pow(Math.cos((Math.PI * result.insetFeedDepth!) / result.length), 2);
    const points = sweepFrequencyResponse(
      {
        resonantFrequencyHz: frequencyHz,
        inputConductance: result.inputConductance,
        capacitance: result.capacitance,
        feedTransformerN2: n2,
        referenceImpedanceOhm: targetImpedanceOhm,
      },
      result.fractionalBandwidthVswr2,
      121,
      6
    );
    const container = document.querySelector<HTMLElement>('#response-chart-container')!;
    container.innerHTML =
      renderFrequencyResponseChart(points, frequencyHz, {
        toleranceBandHz: [mc.resonantFrequencyHz.p5, mc.resonantFrequencyHz.p95],
      }) +
      '<figcaption>Fig. 1 — Predicted |S11| vs. frequency, with the 5th–95th percentile resonance shift from the Monte Carlo tolerance run shaded.</figcaption>';
  }
}

document.querySelector<HTMLButtonElement>('#run-mc')!.addEventListener('click', () => {
  if (!currentDesign || !currentDesign.result.insetFeedDepth) return;
  const { epsilonR, heightM } = readSubstrateInputs();
  const substrateId = (document.querySelector<HTMLSelectElement>('#substrate')!).value;
  const tolerances =
    substrateId === 'custom'
      ? { epsilonRToleranceFrac: 0.08, thicknessToleranceFrac: 0.1, etchToleranceM: 0.0254e-3 }
      : defaultTolerancesFor(findSubstrate(substrateId));

  const mc = runMonteCarlo({
    nominalDesign: currentDesign.result,
    targetFrequencyHz: currentDesign.frequencyHz,
    targetImpedanceOhm: currentDesign.targetImpedanceOhm,
    heightM,
    epsilonR,
    tolerances,
    trials: 1000,
  });
  renderMonteCarlo(mc);
});

// ---------------------------------------------------------------------------
// §5 Pareto-front design-space exploration
// ---------------------------------------------------------------------------

let currentOptimizerResult: OptimizerResult | null = null;
let selectedCandidateIndex: number | null = null;

function renderOptimizerResults(): void {
  if (!currentOptimizerResult) return;
  document.querySelector<HTMLElement>('#optimizer-results')!.classList.remove('hidden');

  const { svg, pointIdToIndex } = renderParetoScatter(
    currentOptimizerResult.allCandidates,
    currentOptimizerResult.paretoFront,
    selectedCandidateIndex
  );
  const container = document.querySelector<HTMLElement>('#pareto-chart-container')!;
  container.innerHTML =
    svg +
    '<figcaption>Fig. 2 — Footprint vs. bandwidth for every evaluated (substrate, thickness, width) combination. Dashed line connects the Pareto-optimal front; click a point to inspect it.</figcaption>';

  container.querySelectorAll<SVGGElement>('.chart-point').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = pointIdToIndex.get(el.id);
      if (idx === undefined) return;
      selectedCandidateIndex = idx;
      renderOptimizerResults();
    });
  });

  const legend = document.querySelector<HTMLElement>('#pareto-legend')!;
  legend.innerHTML = SUBSTRATES.map((s) => `<span>${s.name}</span>`).join(' &nbsp; ');

  const table = document.querySelector<HTMLTableElement>('#pareto-table')!;
  table.innerHTML = `
    <thead><tr><th>Substrate</th><th class="num">h (mm)</th><th class="num">W×L (mm)</th>
      <th class="num">Footprint (mm&#178;)</th><th class="num">BW (%)</th><th class="num">Rin (Ω)</th></tr></thead>
    <tbody>
      ${currentOptimizerResult.paretoFront
        .map((c: OptimizerCandidate) => {
          const globalIdx = currentOptimizerResult!.allCandidates.indexOf(c);
          const selected = globalIdx === selectedCandidateIndex;
          return `<tr style="${selected ? 'font-weight:600;' : ''}">
            <td>${c.substrate.name}</td>
            <td class="num">${(c.heightM * 1000).toFixed(3)}</td>
            <td class="num">${(c.width * 1000).toFixed(2)} × ${(c.length * 1000).toFixed(2)}</td>
            <td class="num">${(c.footprintM2 * 1e6).toFixed(1)}</td>
            <td class="num">${(c.fractionalBandwidth * 100).toFixed(2)}</td>
            <td class="num">${c.edgeResistance.toFixed(0)}</td>
          </tr>`;
        })
        .join('')}
    </tbody>
  `;
}

document.querySelector<HTMLButtonElement>('#run-optimize')!.addEventListener('click', () => {
  const { frequencyHz, targetImpedanceOhm } = readSubstrateInputs();
  currentOptimizerResult = optimizePatch({ frequencyHz, targetImpedanceOhm });
  selectedCandidateIndex = null;
  renderOptimizerResults();
});

// ---------------------------------------------------------------------------
// wiring
// ---------------------------------------------------------------------------

document.querySelector<HTMLButtonElement>('#calc')!.addEventListener('click', handleCalculate);
document.querySelector<HTMLButtonElement>('#toggle-verify')!.addEventListener('click', () => {
  document.querySelector<HTMLElement>('#verify-panel')!.classList.toggle('hidden');
});
document.querySelector<HTMLButtonElement>('#export-validation')!.addEventListener('click', () => {
  if (!currentDesign) return;
  const substrateId = (document.querySelector<HTMLSelectElement>('#substrate')!).value;
  const substrateName = substrateId === 'custom' ? 'Custom' : findSubstrate(substrateId).name;
  const { epsilonR, heightM, lossTangent } = readSubstrateInputs();
  downloadValidationPackage({
    result: currentDesign.result,
    frequencyHz: currentDesign.frequencyHz,
    epsilonR,
    heightM,
    lossTangent,
    targetImpedanceOhm: currentDesign.targetImpedanceOhm,
    substrateName,
  });
});

renderVerification();
handleCalculate();
