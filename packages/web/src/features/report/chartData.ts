import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { format } from 'date-fns';
import type { Note } from '@/api/notes';
import type { ReportRow } from '@/api/reports';

// Points carry epoch milliseconds on a Chart.js `time` x-axis, so every point
// (report row or note) lands at its chronological position. A category axis
// would append note dates that have no report row to the end of the labels.
export type ReportChartPoint = {
  x: number;
  y: number | null;
  text?: string;
};

type ReportRowDataKey = 'deltaYear' | 'deltaYearAvg' | 'deltaLast4Avg';

export const NOTE_Y = 0.95;

const lineDatasets: { label: string; dataKey: ReportRowDataKey; borderColor: string; backgroundColor?: string }[] = [
  { label: 'usage/year', dataKey: 'deltaYear', borderColor: 'transparent', backgroundColor: 'cyan' },
  { label: 'avgusage/year', dataKey: 'deltaYearAvg', borderColor: 'blue' },
  { label: 'avglast4/year', dataKey: 'deltaLast4Avg', borderColor: 'red' },
];

function byTimestamp(a: { timestamp: Date }, b: { timestamp: Date }) {
  return a.timestamp.getTime() - b.timestamp.getTime();
}

export function buildReportChartData(
  rows: ReportRow[],
  notes: Note[],
): ChartData<'line', ReportChartPoint[]> {
  const sortedRows = [...rows].sort(byTimestamp);
  const sortedNotes = [...notes].sort(byTimestamp);

  return {
    datasets: [
      ...lineDatasets.map(({ label, dataKey, borderColor, backgroundColor }) => ({
        label,
        // TODO figure out why we get negative usage values on gas meter (temp fix is set min to 0)
        data: sortedRows.map((row) => ({ x: row.timestamp.getTime(), y: row[dataKey] })),
        borderColor,
        ...(backgroundColor ? { backgroundColor } : {}),
      })),
      {
        label: 'notes',
        data: sortedNotes.map((note) => ({ x: note.timestamp.getTime(), y: NOTE_Y, text: note.text })),
        backgroundColor: 'yellow',
        borderColor: 'transparent',
        pointRadius: 8,
        pointHoverRadius: 12,
        yAxisID: 'textAxis',
      },
    ],
  };
}

export function buildReportChartOptions(unit: string, dateFormat: string, compact = false): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest',
      intersect: false,
    },
    elements: {
      point: {
        hitRadius: 12,
      },
    },
    scales: {
      y: {
        // this is the temporary fix for the negative values on gas meter
        min: 0,
        display: true,
        title: {
          display: true,
          text: unit,
        },
        ticks: {
          maxTicksLimit: compact ? 6 : 10,
        },
      },
      x: {
        type: 'time',
        display: true,
        time: {
          minUnit: 'day',
          tooltipFormat: dateFormat,
        },
        ticks: {
          autoSkip: true,
          maxRotation: 0,
          maxTicksLimit: compact ? 3 : 10,
          callback: (value) => format(Number(value), dateFormat),
        },
        title: {
          display: true,
          text: 'Datum',
        },
      },
      textAxis: {
        display: false,
        min: 0,
        max: 1,
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          boxHeight: 12,
          padding: 16,
        },
      },
      tooltip: {
        callbacks: {
          // Note points show their text; returning undefined keeps the default label for the other datasets.
          label: (context: TooltipItem<'line'>) => (context.raw as ReportChartPoint).text,
        },
      },
    },
  };
}
