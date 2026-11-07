import { apiRequest } from './client';

export type ReportRow = {
  id: number;
  timestamp: Date;
  meterId: number | null;
  meterTypeId: number | null;
  rawValue: number | null;
  value: number | null;
  dateDiff: number | null;
  delta: number | null;
  deltaYear: number | null;
  deltaLast4Avg: number | null;
  deltaYearAvg: number | null;
};

type ReportRowResponse = Omit<ReportRow, 'timestamp'> & {
  timestamp: string;
};

function hydrateReportRow(row: ReportRowResponse): ReportRow {
  return {
    ...row,
    timestamp: new Date(row.timestamp),
  };
}

export async function listReportRows(meterTypeId: number): Promise<ReportRow[]> {
  const rows = await apiRequest<ReportRowResponse[]>(`/api/reports/${meterTypeId}`);
  return rows.map(hydrateReportRow);
}
