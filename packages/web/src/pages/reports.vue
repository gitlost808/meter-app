<template>
  <ReportChart v-if="compoundReportData.data.length" :report-data="compoundReportData" :unit="unit" />
</template>

<script setup lang="ts">
import { format, isAfter, isBefore } from 'date-fns';
import { useNotesQuery } from '@/composables/queries/useNotes';
import { useMeterTypesQuery } from '@/composables/queries/useMeterTypes';
import { useReportRowsQuery } from '@/composables/queries/useReports';
import { useUnitsQuery } from '@/composables/queries/useUnits';

definePage({
  meta: {
    layout: 'reports',
  },
});

const reportStore = useReportStore();
const selectedMeterTypeId = computed(() => reportStore.selectedMeterTypeId);
const reportRowsQuery = useReportRowsQuery(selectedMeterTypeId);
const meterTypesQuery = useMeterTypesQuery();
const unitsQuery = useUnitsQuery();
const store = useStore();

const noteFilters = computed(() => ({
  from: format(reportStore.selectedFromDate, store.dateApiSendFormat),
  to: format(reportStore.selectedToDate, store.dateApiSendFormat),
}));
const notesQuery = useNotesQuery(noteFilters);

const unit = computed(() => {
  const selectedMeterType = meterTypesQuery.data.value?.find((meterType) => {
    return meterType.id === reportStore.selectedMeterTypeId;
  });
  const unitModel = unitsQuery.data.value?.find((candidate) => {
    return candidate.id === selectedMeterType?.unitId;
  });
  return unitModel ? `${unitModel.name} (${unitModel.suffix})` : '';
});

const selectedReportDataInRange = computed(() => {
  return (reportRowsQuery.data.value ?? []).filter((row) => {
    return (
      isAfter(row.timestamp, reportStore.selectedFromDate) &&
      isBefore(row.timestamp, reportStore.selectedToDate)
    );
  });
});

const compoundReportData = computed(() => ({
  data: selectedReportDataInRange.value,
  notes: notesQuery.data.value ?? [],
}));
</script>
