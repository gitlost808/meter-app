import type { ReportRow } from '@/api/reports';
import { endOfDay, isAfter, isBefore, isSameDay } from 'date-fns';

export type ValueEntrySelection = {
  selectedValue?: ReportRow;
  selectedNewMeterValue?: ReportRow;
  newMeter: boolean;
};

export function resolveValueEntrySelection(
  selectedForMeterType: ReportRow[],
): ValueEntrySelection {
  if (selectedForMeterType.length > 1) {
    const selectedNewMeterValue = selectedForMeterType[selectedForMeterType.length - 1];
    const selectedValue = selectedForMeterType[selectedForMeterType.length - 2];

    return {
      selectedValue,
      selectedNewMeterValue,
      newMeter: selectedValue?.meterId !== selectedNewMeterValue?.meterId,
    };
  }

  if (selectedForMeterType.length === 1) {
    return {
      selectedValue: selectedForMeterType[0],
      selectedNewMeterValue: undefined,
      newMeter: false,
    };
  }

  return {
    selectedValue: undefined,
    selectedNewMeterValue: undefined,
    newMeter: false,
  };
}

export function selectValueEntryRowsForDay(
  reportRows: ReportRow[],
  selectedDate: Date,
): ReportRow[] {
  return reportRows.filter((reportRow) => isSameDay(reportRow.timestamp, selectedDate));
}

export function selectValueEntryHistory(
  reportRows: ReportRow[],
  selectedDate: Date,
): ReportRow[] {
  return reportRows
    .filter((reportRow) => isBefore(reportRow.timestamp, selectedDate))
    .slice(-3);
}

export function selectLatestReportRow(
  reportRows: ReportRow[],
): ReportRow | undefined {
  return reportRows[reportRows.length - 1];
}

export function isMeterChangePossible(
  reportRows: ReportRow[],
  selectedDate: Date,
): boolean {
  const latestTimestamp = selectLatestReportRow(reportRows)?.timestamp;

  if (!latestTimestamp) {
    return true;
  }

  const endOfSelectedDate = endOfDay(selectedDate);
  const endOfLatestReport = endOfDay(latestTimestamp);

  return (
    isAfter(endOfSelectedDate, endOfLatestReport) ||
    isSameDay(endOfSelectedDate, endOfLatestReport)
  );
}
