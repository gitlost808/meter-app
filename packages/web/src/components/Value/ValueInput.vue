<template>
  <v-number-input
v-model="model" :reverse="false" :base-color="color" :color="color" :label="label"
    :suffix="unitForMeter?.suffix" />
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import { useMeterTypesQuery } from '@/composables/queries/useMeterTypes';
import { useUnitsQuery } from '@/composables/queries/useUnits';
import type { ReportRow } from '@/api/reports';

const model = defineModel<number | null>()
const meterTypesQuery = useMeterTypesQuery();
const unitsQuery = useUnitsQuery();

const props = defineProps<{
  meterTypeId: number;
  label?: string;
  hideDate?: boolean;
  originalValue?: ReportRow;
}>()

const label = computed(() => {
  const label = props.label ?? 'Zählerstand';
  return props.hideDate ?
    label :
    `${label} am ${format(
      useValueStore().selectedDate,
      useStore().dateFormat
    )}`
});

const color = computed(() => {
  if (model.value !== props.originalValue?.rawValue) {
    return 'orange';
  }

  if (props.originalValue?.id) {
    return 'green'
  } else {
    return '';
  }
});

const unitForMeter = computed(() => {
  const meterType = meterTypesQuery.data.value?.find((candidate) => {
    return candidate.id === props.meterTypeId;
  });
  return unitsQuery.data.value?.find((candidate) => {
    return candidate.id === meterType?.unitId;
  });
});
</script>
