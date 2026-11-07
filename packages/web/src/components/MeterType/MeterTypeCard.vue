<template>
  <v-card :title="meterType.name" :subtitle="unitSuffix">
    <v-card-text>
      <dl>
        <dt><strong>Zähler:</strong></dt>
        <dd>{{ meterCount }}</dd>
      </dl>
    </v-card-text>
    <v-card-actions>
      <v-spacer/>
      <UtilDeleteButton name="Zählerart" @delete="removeMeterType" />
      <MeterTypeDialog :meter-type="meterType" button-text="Bearbeiten"/>
    </v-card-actions>
  </v-card>
</template>
<script setup lang="ts">
import type { MeterType } from '@/api/meter-types';
import { useDeleteMeterTypeMutation } from '@/composables/queries/useMeterTypes';
import { useMetersQuery } from '@/composables/queries/useMeters';
import { useUnitsQuery } from '@/composables/queries/useUnits';
import { useNotify } from '@/composables/useNotify';

const notify = useNotify();
const metersQuery = useMetersQuery();
const unitsQuery = useUnitsQuery();
const deleteMeterTypeMutation = useDeleteMeterTypeMutation();

const props = defineProps<{
  meterType: MeterType;
}>()

const unitSuffix = computed(() => {
  return unitsQuery.data.value?.find((unit) => {
    return unit.id === props.meterType.unitId;
  })?.suffix;
})

const meterCount = computed(() => {
  return (metersQuery.data.value ?? []).filter((meter) => {
    return meter.meterTypeId === props.meterType.id;
  }).length;
});

async function removeMeterType() {
  try {
    await deleteMeterTypeMutation.mutateAsync(props.meterType.id);
    notify.success(`Zählerart „${props.meterType.name}“ gelöscht.`);
  } catch (error) {
    notify.error('Löschen fehlgeschlagen', error);
  }
}
</script>
