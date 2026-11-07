<template>
  <v-row>
    <v-col cols="12" md="auto">
      <v-card>
        <v-card-text>
          <v-date-picker :allowed-dates="datesOfFilteredReportData" :min="firstTimestamp" :max="lastTimestamp" hide-header width="100%" />
          <MeterSelect v-model="meterId" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="blue" text="Zurücksetzen" />
        </v-card-actions>
      </v-card>
    </v-col>
    <v-col cols="12" md>
      <v-data-table density="compact" :headers="headers" :items="filteredReportData">
        <template #item.actions="{ item }">
          <UtilDeleteButton
name="Messwert" icon="mdi-trash-can" size="xs" color="transparent"
            @delete="deleteValue(item.id)" />
        </template>
        <template #item.timestamp="{ value }">
          <UtilDateFormat :date="value" />
        </template>
        <template #item.meterId="{ value }">
          {{ meters.find((meter) => meter.id === value)?.name }}
        </template>
        <template #item.rawValue="{ value, item }">
          <MeterValue
            :value="value"
            :unit-id="units.find((unit) => {
              const meter = meters.find((candidate) => candidate.id === item?.meterId);
              const meterType = meterTypes.find((candidate) => candidate.id === meter?.meterTypeId);
              return unit.id === meterType?.unitId;
            })?.id"
          />
        </template>
      </v-data-table>
    </v-col>
  </v-row>
</template>
<script setup lang="ts">
import type { DataTableHeader } from 'vuetify';
import { useMeterTypesQuery } from '@/composables/queries/useMeterTypes';
import { useMetersQuery } from '@/composables/queries/useMeters';
import { useUnitsQuery } from '@/composables/queries/useUnits';
import { useReportRowsByMeterTypesQuery } from '@/composables/queries/useValueEntryReports';
import { useDeleteValueMutation } from '@/composables/queries/useValues';
import { useNotify } from '@/composables/useNotify';

const notify = useNotify();
const metersQuery = useMetersQuery();
const meterTypesQuery = useMeterTypesQuery();
const unitsQuery = useUnitsQuery();
const deleteValueMutation = useDeleteValueMutation();

async function deleteValue(id: number) {
  try {
    await deleteValueMutation.mutateAsync(id);
    notify.success('Messwert gelöscht.');
  } catch (error) {
    notify.error('Löschen fehlgeschlagen', error);
  }
}

const headers: DataTableHeader[] = [
  { title: '', key: 'actions', width: '1', align: 'start', sortable: false },
  { title: 'Datum', key: 'timestamp', width: '8rem', align: 'start' },
  { title: 'Wert', key: 'rawValue', width: '10rem', align: 'end' },
  { title: 'Zähler', key: 'meterId', align: 'start' },
];

const meterId = ref<number | null>(null);
const meterTypeIds = computed(() => meterTypesQuery.data.value?.map((meterType) => meterType.id) ?? []);
const reportRowsByMeterTypesQuery = useReportRowsByMeterTypesQuery(meterTypeIds);

const filteredReportData = computed(() => {
  return reportRowsByMeterTypesQuery.data.value.filter((reportRow) => {
    return meterId.value == null || reportRow.meterId === meterId.value;
  });
});
const firstTimestamp = computed(() => {
  return filteredReportData.value[0]?.timestamp;
});
const lastTimestamp = computed(() => {
  return filteredReportData.value[filteredReportData.value.length - 1]?.timestamp;
});
const datesOfFilteredReportData = computed(() => {
  return filteredReportData.value.map((reportRow) => reportRow.timestamp);
});

const meters = computed(() => metersQuery.data.value ?? []);
const meterTypes = computed(() => meterTypesQuery.data.value ?? []);
const units = computed(() => unitsQuery.data.value ?? []);
</script>
