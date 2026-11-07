<template>
  <v-table>
    <thead />
    <tbody>
      <tr v-for="value in valueHistory" :key="value.id">
        <td width="1">
          <UtilDateFormat :date="value.timestamp" />
        </td>
        <td>
          <MeterValue :value="value.value" :unit-id="meterTypeUnitId" />
        </td>
        <td>
          <MeterTitle :meter-id="value.meterId" />
        </td>
      </tr>
    </tbody>
  </v-table>
</template>
<script setup lang="ts">
import { useMeterTypesQuery } from '@/composables/queries/useMeterTypes';
import { useUnitsQuery } from '@/composables/queries/useUnits';
import { useValueEntryReportState } from '@/composables/queries/useValueEntryReports';
import type { ReportRow } from '@/api/reports';

type ValueHistoryRow = ReportRow & {
  value: number | null;
};

const valueStore = useValueStore();
const meterTypesQuery = useMeterTypesQuery();
const unitsQuery = useUnitsQuery();

const props = defineProps<{
  meterTypeId: number;
  raw?: boolean;
}>()

const valueEntryReportState = useValueEntryReportState(
  toRef(props, 'meterTypeId'),
  toRef(valueStore, 'selectedDate'),
);

const valueHistory = computed<ValueHistoryRow[]>(() => {
  const history = valueEntryReportState.historyRows.value;
  return props.raw
    ? history.map((reportRow) => ({
      ...reportRow,
      value: reportRow.rawValue,
    }))
    : history;
});

const meterTypeUnitId = computed(() => {
  const meterType = meterTypesQuery.data.value?.find((candidate) => {
    return candidate.id === props.meterTypeId;
  });
  return unitsQuery.data.value?.find((candidate) => {
    return candidate.id === meterType?.unitId;
  })?.id;
});
</script>
