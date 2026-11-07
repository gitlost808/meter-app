import { useQueries, useQuery } from '@tanstack/vue-query';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { toValue } from 'vue';
import { listReportRows, type ReportRow } from '@/api/reports';
import {
  isMeterChangePossible,
  resolveValueEntrySelection,
  selectLatestReportRow,
  selectValueEntryHistory,
  selectValueEntryRowsForDay,
} from '@/features/value-entry/selection';

export function useReportRowsByMeterTypeQuery(meterTypeId: Ref<number | null>) {
  return useQuery({
    queryKey: computed(() => ['reports', meterTypeId.value]),
    queryFn: () => listReportRows(meterTypeId.value as number),
    enabled: computed(() => Boolean(meterTypeId.value)),
  });
}

export function useReportRowsByMeterTypesQuery(
  meterTypeIds: MaybeRefOrGetter<number[]>,
) {
  const queries = useQueries({
    queries: computed(() =>
      toValue(meterTypeIds).map((meterTypeId) => ({
        queryKey: ['reports', meterTypeId],
        queryFn: () => listReportRows(meterTypeId),
      })),
    ),
  });

  const data = computed<ReportRow[]>(() => {
    return queries.value.flatMap((query) => query.data ?? []);
  });

  const isPending = computed(() => {
    return queries.value.some((query) => query.isPending);
  });

  return {
    queries,
    data,
    isPending,
  };
}

export function useValueEntryReportState(
  meterTypeId: Ref<number>,
  selectedDate: Ref<Date>,
) {
  const queryMeterTypeId = computed(() => meterTypeId.value);
  const reportRowsQuery = useReportRowsByMeterTypeQuery(queryMeterTypeId);

  const reportRows = computed(() => reportRowsQuery.data.value ?? []);
  const selectedRows = computed(() => {
    return selectValueEntryRowsForDay(reportRows.value, selectedDate.value);
  });
  const selection = computed(() => resolveValueEntrySelection(selectedRows.value));
  const historyRows = computed(() => {
    return selectValueEntryHistory(reportRows.value, selectedDate.value);
  });
  const latestReportRow = computed(() => selectLatestReportRow(reportRows.value));
  const meterChangeAllowed = computed(() => {
    return isMeterChangePossible(reportRows.value, selectedDate.value);
  });

  return {
    reportRowsQuery,
    reportRows,
    selectedRows,
    selection,
    historyRows,
    latestReportRow,
    meterChangeAllowed,
  };
}
