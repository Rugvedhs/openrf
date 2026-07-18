import type { FrequencyResponsePoint } from './frequencyResponse';
import type { OptimizerCandidate } from './optimizer';

function linearScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  return (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

function niceTicks(min: number, max: number, count: number): number[] {
  if (min === max) return [min];
  const span = max - min;
  const rawStep = span / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const step = (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= max + step * 1e-9; t += step) ticks.push(Number(t.toPrecision(10)));
  return ticks;
}

const CHART_FONT = "font-family:'IBM Plex Mono','SFMono-Regular',Menlo,Consolas,monospace;";

export interface FrequencyChartOptions {
  width?: number;
  height?: number;
  toleranceBandHz?: [number, number]; // [p5, p95] resonant-frequency band from Monte Carlo, if available
  toleranceBandLabel?: string;
}

export function renderFrequencyResponseChart(
  points: FrequencyResponsePoint[],
  targetFrequencyHz: number,
  options: FrequencyChartOptions = {}
): string {
  const width = options.width ?? 640;
  const height = options.height ?? 320;
  const margin = { top: 16, right: 20, bottom: 40, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const freqsGHz = points.map((p) => p.frequencyHz / 1e9);
  const minF = Math.min(...freqsGHz);
  const maxF = Math.max(...freqsGHz);
  const dbValues = points.map((p) => Math.max(p.returnLossDb, -40)); // clip the plot floor at -40dB
  const minDb = Math.min(-15, Math.min(...dbValues));
  const maxDb = 0;

  const x = linearScale([minF, maxF], [margin.left, margin.left + plotW]);
  const y = linearScale([minDb, maxDb], [margin.top + plotH, margin.top]);

  const xTicks = niceTicks(minF, maxF, 6);
  const yTicks = niceTicks(minDb, maxDb, 5);

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.frequencyHz / 1e9).toFixed(2)} ${y(Math.max(p.returnLossDb, -40)).toFixed(2)}`)
    .join(' ');

  let toleranceBandSvg = '';
  if (options.toleranceBandHz) {
    const [p5, p95] = options.toleranceBandHz;
    const bx0 = x(p5 / 1e9);
    const bx1 = x(p95 / 1e9);
    toleranceBandSvg = `
      <rect x="${Math.min(bx0, bx1).toFixed(2)}" y="${margin.top}" width="${Math.abs(bx1 - bx0).toFixed(2)}" height="${plotH}"
            fill="var(--chart-band)" />
      <text x="${((bx0 + bx1) / 2).toFixed(2)}" y="${margin.top + 12}" text-anchor="middle" font-size="9"
            fill="var(--chart-band-label)" style="${CHART_FONT}">5–95th pct. resonance shift</text>
    `;
  }

  const gridlines = yTicks
    .map(
      (t) =>
        `<line x1="${margin.left}" y1="${y(t).toFixed(2)}" x2="${margin.left + plotW}" y2="${y(t).toFixed(2)}" class="chart-grid" />`
    )
    .join('');

  const referenceLine = `<line x1="${margin.left}" y1="${y(-10).toFixed(2)}" x2="${margin.left + plotW}" y2="${y(-10).toFixed(2)}" class="chart-reference" /><text x="${margin.left + plotW - 4}" y="${(y(-10) - 4).toFixed(2)}" text-anchor="end" font-size="9" class="chart-reference-label" style="${CHART_FONT}">-10 dB</text>`;

  const f0Line = `<line x1="${x(targetFrequencyHz / 1e9).toFixed(2)}" y1="${margin.top}" x2="${x(targetFrequencyHz / 1e9).toFixed(2)}" y2="${margin.top + plotH}" class="chart-f0-line" />`;

  const xAxisTicks = xTicks
    .map(
      (t) => `
      <line x1="${x(t).toFixed(2)}" y1="${margin.top + plotH}" x2="${x(t).toFixed(2)}" y2="${margin.top + plotH + 4}" class="chart-axis" />
      <text x="${x(t).toFixed(2)}" y="${margin.top + plotH + 16}" text-anchor="middle" font-size="10" class="chart-tick-label" style="${CHART_FONT}">${t.toFixed(3)}</text>
    `
    )
    .join('');

  const yAxisTicks = yTicks
    .map(
      (t) => `
      <line x1="${margin.left - 4}" y1="${y(t).toFixed(2)}" x2="${margin.left}" y2="${y(t).toFixed(2)}" class="chart-axis" />
      <text x="${margin.left - 8}" y="${(y(t) + 3).toFixed(2)}" text-anchor="end" font-size="10" class="chart-tick-label" style="${CHART_FONT}">${t}</text>
    `
    )
    .join('');

  return `
<svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Predicted return loss vs frequency">
  ${toleranceBandSvg}
  ${gridlines}
  ${referenceLine}
  ${f0Line}
  <path d="${pathD}" class="chart-line-primary" fill="none" />
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotH}" class="chart-axis" />
  <line x1="${margin.left}" y1="${margin.top + plotH}" x2="${margin.left + plotW}" y2="${margin.top + plotH}" class="chart-axis" />
  ${xAxisTicks}
  ${yAxisTicks}
  <text x="${margin.left + plotW / 2}" y="${height - 4}" text-anchor="middle" font-size="10" class="chart-axis-label" style="${CHART_FONT}">Frequency (GHz)</text>
  <text x="12" y="${margin.top + plotH / 2}" text-anchor="middle" font-size="10" class="chart-axis-label" style="${CHART_FONT}" transform="rotate(-90 12 ${margin.top + plotH / 2})">Return loss |S11| (dB)</text>
</svg>`;
}

export interface ParetoChartResult {
  svg: string;
  /** Maps SVG element id -> candidate index in allCandidates, for click-to-select wiring. */
  pointIdToIndex: Map<string, number>;
}

const SUBSTRATE_MARKERS: Record<string, { shape: 'circle' | 'square' | 'triangle' | 'diamond' }> = {
  fr4: { shape: 'circle' },
  ro4003c: { shape: 'square' },
  rt5880: { shape: 'triangle' },
  alumina: { shape: 'diamond' },
};

function markerPath(shape: string, cx: number, cy: number, r: number): string {
  switch (shape) {
    case 'square':
      return `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" />`;
    case 'triangle':
      return `<path d="M ${cx} ${cy - r} L ${cx + r} ${cy + r * 0.8} L ${cx - r} ${cy + r * 0.8} Z" />`;
    case 'diamond':
      return `<path d="M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z" />`;
    default:
      return `<circle cx="${cx}" cy="${cy}" r="${r}" />`;
  }
}

export function renderParetoScatter(
  allCandidates: OptimizerCandidate[],
  paretoFront: OptimizerCandidate[],
  selectedIndex: number | null,
  width = 640,
  height = 360
): ParetoChartResult {
  const margin = { top: 16, right: 20, bottom: 44, left: 56 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const eligible = allCandidates.filter((c) => c.feasible && c.withinValidatedRegime);
  const footprints = eligible.map((c) => c.footprintM2 * 1e6); // mm^2
  const bandwidths = eligible.map((c) => c.fractionalBandwidth * 100); // %

  const minFootprint = 0;
  const maxFootprint = Math.max(...footprints, 1) * 1.05;
  const minBw = 0;
  const maxBw = Math.max(...bandwidths, 1) * 1.15;

  const x = linearScale([minFootprint, maxFootprint], [margin.left, margin.left + plotW]);
  const y = linearScale([minBw, maxBw], [margin.top + plotH, margin.top]);

  const xTicks = niceTicks(minFootprint, maxFootprint, 5);
  const yTicks = niceTicks(minBw, maxBw, 5);

  const pointIdToIndex = new Map<string, number>();
  const paretoSet = new Set(paretoFront);

  const pointsSvg = allCandidates
    .map((c, idx) => {
      if (!c.feasible || !c.withinValidatedRegime) return '';
      const cx = x(c.footprintM2 * 1e6);
      const cy = y(c.fractionalBandwidth * 100);
      const isPareto = paretoSet.has(c);
      const isSelected = idx === selectedIndex;
      const shape = SUBSTRATE_MARKERS[c.substrate.id]?.shape ?? 'circle';
      const r = isSelected ? 6 : isPareto ? 4.5 : 2.5;
      const id = `pareto-pt-${idx}`;
      pointIdToIndex.set(id, idx);
      const cls = isSelected
        ? 'chart-point-selected'
        : isPareto
          ? 'chart-point-pareto'
          : 'chart-point-dominated';
      return `<g id="${id}" class="chart-point ${cls}" data-index="${idx}">${markerPath(shape, cx, cy, r)}</g>`;
    })
    .join('');

  const frontSorted = [...paretoFront].sort((a, b) => a.footprintM2 - b.footprintM2);
  const frontPath = frontSorted
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${x(c.footprintM2 * 1e6).toFixed(2)} ${y(c.fractionalBandwidth * 100).toFixed(2)}`)
    .join(' ');

  const gridlines = yTicks
    .map((t) => `<line x1="${margin.left}" y1="${y(t).toFixed(2)}" x2="${margin.left + plotW}" y2="${y(t).toFixed(2)}" class="chart-grid" />`)
    .join('');

  const xAxisTicks = xTicks
    .map(
      (t) => `
      <line x1="${x(t).toFixed(2)}" y1="${margin.top + plotH}" x2="${x(t).toFixed(2)}" y2="${margin.top + plotH + 4}" class="chart-axis" />
      <text x="${x(t).toFixed(2)}" y="${margin.top + plotH + 16}" text-anchor="middle" font-size="10" class="chart-tick-label" style="${CHART_FONT}">${t}</text>
    `
    )
    .join('');

  const yAxisTicks = yTicks
    .map(
      (t) => `
      <line x1="${margin.left - 4}" y1="${y(t).toFixed(2)}" x2="${margin.left}" y2="${y(t).toFixed(2)}" class="chart-axis" />
      <text x="${margin.left - 8}" y="${(y(t) + 3).toFixed(2)}" text-anchor="end" font-size="10" class="chart-tick-label" style="${CHART_FONT}">${t}</text>
    `
    )
    .join('');

  const svg = `
<svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Footprint vs bandwidth tradeoff, Pareto front highlighted">
  ${gridlines}
  <path d="${frontPath}" class="chart-pareto-front" fill="none" />
  ${pointsSvg}
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotH}" class="chart-axis" />
  <line x1="${margin.left}" y1="${margin.top + plotH}" x2="${margin.left + plotW}" y2="${margin.top + plotH}" class="chart-axis" />
  ${xAxisTicks}
  ${yAxisTicks}
  <text x="${margin.left + plotW / 2}" y="${height - 4}" text-anchor="middle" font-size="10" class="chart-axis-label" style="${CHART_FONT}">Footprint (mm&#178;)</text>
  <text x="14" y="${margin.top + plotH / 2}" text-anchor="middle" font-size="10" class="chart-axis-label" style="${CHART_FONT}" transform="rotate(-90 14 ${margin.top + plotH / 2})">Fractional bandwidth (%)</text>
</svg>`;

  return { svg, pointIdToIndex };
}
