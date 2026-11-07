import { BasicPlatform, Chart, Legend, LinearScale, LineController, LineElement, PointElement, TimeScale } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { describe, expect, it } from 'vitest';
import type { Note } from '@/api/notes';
import type { ReportRow } from '@/api/reports';
import { buildReportChartData, buildReportChartOptions, NOTE_Y } from './chartData';

Chart.register(Legend, LineController, LineElement, PointElement, TimeScale, LinearScale);

const UNIT = 'Water (m³)';
const DATE_FORMAT = 'dd.MM.yyyy';
const NOTE_TEXT = 'Pump replaced';

function createReportRow(timestamp: string, deltaYear: number): ReportRow {
  return {
    id: 1,
    timestamp: new Date(timestamp),
    meterId: 10,
    meterTypeId: 3,
    rawValue: 1,
    value: 1,
    dateDiff: 1,
    delta: 1,
    deltaYear,
    deltaLast4Avg: deltaYear + 1,
    deltaYearAvg: deltaYear + 2,
  };
}

const rows = [
  createReportRow('2022-01-01T00:00:00.000Z', 10),
  createReportRow('2023-01-01T00:00:00.000Z', 20),
  createReportRow('2024-01-01T00:00:00.000Z', 30),
];
// No report row exists on this date.
const note: Note = { id: 7, text: NOTE_TEXT, timestamp: new Date('2022-11-13T00:00:00.000Z') };

// Lays the chart out without a browser canvas: every other 2D context call is a no-op.
function layoutChart(width = 1000, height = 500, compact = false) {
  const canvas = { width, height, getContext: () => context };
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get: (_, property) => {
      if (property === 'canvas') return canvas;
      if (property === 'measureText') return (text: string) => ({ width: text.length * 7 });
      return () => undefined;
    },
  });
  const options = buildReportChartOptions(UNIT, DATE_FORMAT, compact);
  return new Chart(canvas as unknown as HTMLCanvasElement, {
    type: 'line',
    data: buildReportChartData(rows, [note]),
    options: { ...options, responsive: false, animation: false },
    platform: BasicPlatform,
  });
}

describe('buildReportChartData', () => {
  it('builds time-based points for the report rows and the notes', () => {
    const data = buildReportChartData(rows, [note]);

    expect(data).not.toHaveProperty('labels');
    expect(data.datasets.map((dataset) => dataset.label)).toEqual([
      'usage/year',
      'avgusage/year',
      'avglast4/year',
      'notes',
    ]);
    expect(data.datasets[0].data).toEqual([
      { x: rows[0].timestamp.getTime(), y: 10 },
      { x: rows[1].timestamp.getTime(), y: 20 },
      { x: rows[2].timestamp.getTime(), y: 30 },
    ]);
    expect(data.datasets[3]).toMatchObject({
      data: [{ x: note.timestamp.getTime(), y: NOTE_Y, text: NOTE_TEXT }],
      yAxisID: 'textAxis',
    });
  });

  it('sorts rows and notes chronologically', () => {
    const laterNote: Note = { ...note, id: 8, timestamp: new Date('2023-06-26T00:00:00.000Z') };
    const data = buildReportChartData([rows[2], rows[0], rows[1]], [laterNote, note]);

    expect(data.datasets[0].data.map((point) => point.x)).toEqual(rows.map((row) => row.timestamp.getTime()));
    expect(data.datasets[3].data.map((point) => point.x)).toEqual([
      note.timestamp.getTime(),
      laterNote.timestamp.getTime(),
    ]);
  });

  it('positions a note without a report row on its date chronologically, not at the end', () => {
    const chart = layoutChart();
    try {
      const rowPixels = chart.getDatasetMeta(0).data.map((point) => point.x);
      const [notePixel] = chart.getDatasetMeta(3).data.map((point) => point.x);

      expect(notePixel).toBeGreaterThan(rowPixels[0]);
      expect(notePixel).toBeLessThan(rowPixels[1]);
      expect(notePixel).toBeLessThan(rowPixels[2]);
    } finally {
      chart.destroy();
    }
  });
});

describe('buildReportChartOptions', () => {
  it('keeps a usable plot and unrotated date labels at phone width', () => {
    const chart = layoutChart(272, 344, true);
    try {
      expect(chart.height).toBe(344);
      expect(chart.chartArea.height).toBeGreaterThan(200);
      expect(chart.chartArea.width).toBeGreaterThan(150);
      expect(chart.scales.x.ticks.length).toBeLessThanOrEqual(3);
      expect(chart.scales.x.labelRotation).toBe(0);
      expect(chart.legend?.bottom).toBeLessThanOrEqual(chart.height);

      const ticks = chart.scales.x.ticks;
      for (let i = 1; i < ticks.length; i += 1) {
        const gap = chart.scales.x.getPixelForTick(i) - chart.scales.x.getPixelForTick(i - 1);
        expect(gap).toBeGreaterThan(DATE_FORMAT.length * 7);
      }

      const rowPixels = chart.getDatasetMeta(0).data.map((point) => point.x);
      const notePixel = chart.getDatasetMeta(3).data[0].x;
      expect(notePixel).toBeGreaterThan(rowPixels[0]);
      expect(notePixel).toBeLessThan(rowPixels[1]);
    } finally {
      chart.destroy();
    }
  });

  it('uses the available height when resizing between desktop and phone widths', () => {
    const chart = layoutChart();
    try {
      chart.options = { ...buildReportChartOptions(UNIT, DATE_FORMAT, true), responsive: false, animation: false };
      chart.resize(272, 344);
      expect(chart.width).toBe(272);
      expect(chart.height).toBe(344);
      expect(chart.chartArea.height).toBeGreaterThan(200);

      chart.options = { ...buildReportChartOptions(UNIT, DATE_FORMAT), responsive: false, animation: false };
      chart.resize(1000, 500);
      expect(chart.width).toBe(1000);
      expect(chart.height).toBe(500);
      expect(chart.chartArea.width).toBeGreaterThan(800);
    } finally {
      chart.destroy();
    }
  });

  it('uses a time x-axis with the display date format and note texts in the tooltip', () => {
    const options = buildReportChartOptions(UNIT, DATE_FORMAT);
    const x = options.scales?.x as { type: string; time: { tooltipFormat: string }; ticks: { callback: (value: number) => string } };
    const label = options.plugins?.tooltip?.callbacks?.label as (context: { raw: unknown }) => string | undefined;

    expect(x.type).toBe('time');
    expect(x.time.tooltipFormat).toBe(DATE_FORMAT);
    expect(x.ticks.callback(new Date(2022, 10, 13).getTime())).toBe('13.11.2022');
    expect(label({ raw: { x: 0, y: NOTE_Y, text: NOTE_TEXT } })).toBe(NOTE_TEXT);
    expect(label({ raw: { x: 0, y: 10 } })).toBeUndefined();
  });
});
