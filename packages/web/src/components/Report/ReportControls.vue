<template>
  <v-card variant="flat" rounded="lg" aria-label="Berichtsfilter">
    <v-card-text>
      <div class="report-controls">
        <MeterTypeSelect
          v-model="reportStore.selectedMeterTypeId" class="report-controls__meter-type"
          label="Zählerart" density="comfortable" variant="outlined" hide-details />
        <v-date-input
          v-model="fromDate" label="Von"
          :min="earliestReportDate" :max="reportStore.selectedToDate"
          :clearable="false" :disabled="!reportStore.selectedMeterTypeId"
          :picker-props="{ maxWidth: 'calc(100vw - 32px)', class: 'report-date-picker' }"
          prepend-icon="" prepend-inner-icon="mdi-calendar"
          density="comfortable" variant="outlined" hide-details />
        <v-date-input
          v-model="toDate" label="Bis"
          :min="reportStore.selectedFromDate" :max="latestReportDate"
          :clearable="false" :disabled="!reportStore.selectedMeterTypeId"
          :picker-props="{ maxWidth: 'calc(100vw - 32px)', class: 'report-date-picker' }"
          prepend-icon="" prepend-inner-icon="mdi-calendar"
          density="comfortable" variant="outlined" hide-details />
      </div>
    </v-card-text>
  </v-card>
</template>
<script setup lang="ts">
import { useReportRowsQuery } from '@/composables/queries/useReports';

const reportStore = useReportStore()
const selectedMeterTypeId = computed(() => reportStore.selectedMeterTypeId);
const reportRowsQuery = useReportRowsQuery(selectedMeterTypeId);

// Date inputs can emit null while being edited; the report range must stay valid.
const fromDate = computed({
  get: () => reportStore.selectedFromDate,
  set: (value: Date | null) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      reportStore.selectedFromDate = value;
    }
  },
});
const toDate = computed({
  get: () => reportStore.selectedToDate,
  set: (value: Date | null) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      reportStore.selectedToDate = value;
    }
  },
});

const earliestReportDate = computed(() => {
  return reportRowsQuery.data.value?.[0]?.timestamp ?? new Date(0);
});

const latestReportDate = computed(() => {
  const rows = reportRowsQuery.data.value ?? [];
  const latestRow = rows[rows.length - 1];
  return latestRow?.timestamp ?? new Date(0);
});
</script>

<style scoped>
.report-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

.report-controls > * {
  min-width: 0;
}

/* The calendar is teleported outside this component. Keep all seven days visible. */
:global(.report-date-picker .v-date-picker-month__days-row) {
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

:global(.report-date-picker .v-date-picker-month__day) {
  min-width: 0;
}

:global(.report-date-picker .v-date-picker-month__day-btn) {
  max-width: 100%;
}

@media (min-width: 600px) {
  .report-controls {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .report-controls__meter-type {
    grid-column: 1 / -1;
  }
}

@media (min-width: 960px) {
  .report-controls {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .report-controls__meter-type {
    grid-column: auto;
  }
}
</style>
