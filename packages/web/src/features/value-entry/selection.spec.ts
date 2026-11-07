import { describe, expect, it } from 'vitest';
import type { ReportRow } from '@/api/reports';
import {
  isMeterChangePossible,
  resolveValueEntrySelection,
  selectLatestReportRow,
  selectValueEntryHistory,
  selectValueEntryRowsForDay,
} from './selection';

function createReportRow(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    id: 1,
    timestamp: new Date('2026-03-26T00:00:00.000Z'),
    meterId: 10,
    meterTypeId: 20,
    rawValue: 123,
    value: 123,
    dateDiff: 1,
    delta: 1,
    deltaYear: 365,
    deltaLast4Avg: 365,
    deltaYearAvg: 365,
    ...overrides,
  };
}

describe('resolveValueEntrySelection', () => {
  it('returns an empty selection when no values exist for the selected day', () => {
    expect(resolveValueEntrySelection([])).toEqual({
      selectedValue: undefined,
      selectedNewMeterValue: undefined,
      newMeter: false,
    });
  });

  it('treats a single same-day value as a normal reading', () => {
    const row = createReportRow();

    expect(resolveValueEntrySelection([row])).toEqual({
      selectedValue: row,
      selectedNewMeterValue: undefined,
      newMeter: false,
    });
  });

  it('treats two same-day values on different meters as a meter switch', () => {
    const oldMeterRow = createReportRow({
      id: 1,
      meterId: 10,
      rawValue: 45678,
      value: 9000,
    });
    const newMeterRow = createReportRow({
      id: 2,
      meterId: 11,
      rawValue: 87,
      value: 9087,
    });

    expect(resolveValueEntrySelection([oldMeterRow, newMeterRow])).toEqual({
      selectedValue: oldMeterRow,
      selectedNewMeterValue: newMeterRow,
      newMeter: true,
    });
  });
});

describe('value entry row selectors', () => {
  it('selects rows matching the selected day', () => {
    const selectedDate = new Date('2026-03-26T12:00:00.000Z');
    const matchingRow = createReportRow({
      id: 1,
      timestamp: new Date('2026-03-26T00:00:00.000Z'),
    });
    const otherRow = createReportRow({
      id: 2,
      timestamp: new Date('2026-03-25T00:00:00.000Z'),
    });

    expect(selectValueEntryRowsForDay([otherRow, matchingRow], selectedDate)).toEqual([matchingRow]);
  });

  it('returns the last three rows before the selected day as history', () => {
    const selectedDate = new Date('2026-03-26T00:00:00.000Z');
    const rows = [
      createReportRow({ id: 1, timestamp: new Date('2026-03-20T00:00:00.000Z') }),
      createReportRow({ id: 2, timestamp: new Date('2026-03-21T00:00:00.000Z') }),
      createReportRow({ id: 3, timestamp: new Date('2026-03-22T00:00:00.000Z') }),
      createReportRow({ id: 4, timestamp: new Date('2026-03-23T00:00:00.000Z') }),
      createReportRow({ id: 5, timestamp: new Date('2026-03-26T00:00:00.000Z') }),
    ];

    expect(selectValueEntryHistory(rows, selectedDate).map((row) => row.id)).toEqual([2, 3, 4]);
  });

  it('returns the latest report row', () => {
    const rows = [
      createReportRow({ id: 1, timestamp: new Date('2026-03-20T00:00:00.000Z') }),
      createReportRow({ id: 2, timestamp: new Date('2026-03-23T00:00:00.000Z') }),
    ];

    expect(selectLatestReportRow(rows)?.id).toBe(2);
  });

  it('allows a meter change on the same day as the latest report', () => {
    const rows = [
      createReportRow({ id: 1, timestamp: new Date('2026-03-26T00:00:00.000Z') }),
    ];

    expect(isMeterChangePossible(rows, new Date('2026-03-26T12:00:00.000Z'))).toBe(true);
  });

  it('disallows a meter change before the latest report day', () => {
    const rows = [
      createReportRow({ id: 1, timestamp: new Date('2026-03-27T00:00:00.000Z') }),
    ];

    expect(isMeterChangePossible(rows, new Date('2026-03-26T12:00:00.000Z'))).toBe(false);
  });
});
