<template>
  <v-card :title="meter.name" :subtitle="subtitle">
    <v-card-text>
      <dl>
        <dt class="mt-1"><strong>Erster Eintrag:</strong></dt>
        <dd>
          <UtilDateFormat :date="meter.firstValueDate" />
        </dd>
        <dd>
          <MeterValue :value="meter.firstValue" :unit-id="unit?.id"/>
        </dd>
        <dt class="mt-1"><strong>Letzter Eintrag:</strong></dt>
        <dd>
          <UtilDateFormat :date="meter.lastValueDate" />
        </dd>
        <dd>
          <MeterValue :value="meter.lastValue" :unit-id="unit?.id" />
        </dd>
        <dt class="mt-1"><strong>Erfasste Messwerte:</strong></dt>
        <dd>{{ meter.totalValues }}</dd>
      </dl>
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <UtilDeleteButton name="Zähler" @delete="removeMeter" />
      <MeterDialog :meter="meter" button-text="Bearbeiten" />
    </v-card-actions>
  </v-card>
</template>
<script setup lang="ts">
import type { MeterStat } from '@/api/meters';
import { useDeleteMeterMutation } from '@/composables/queries/useMeters';
import { useMeterTypesQuery } from '@/composables/queries/useMeterTypes';
import { useUnitsQuery } from '@/composables/queries/useUnits';
import { useNotify } from '@/composables/useNotify';

const notify = useNotify();
const meterTypesQuery = useMeterTypesQuery();
const unitsQuery = useUnitsQuery();
const deleteMeterMutation = useDeleteMeterMutation();

const props = defineProps({
  meter: {
    type: Object as PropType<MeterStat>,
    required: true,
  },
})

const meterType = computed(() => {
  return meterTypesQuery.data.value?.find((meterType) => {
    return meterType.id === props.meter?.meterTypeId;
  })
})

const unit = computed(() => {
  return unitsQuery.data.value?.find((unit) => {
    return unit.id === meterType.value?.unitId;
  })
})

const subtitle = computed(() => {
  return `${meterType.value?.name} (${unit.value?.suffix})`;
})

async function removeMeter() {
  try {
    await deleteMeterMutation.mutateAsync(props.meter.id);
    notify.success(`Zähler „${props.meter.name}“ gelöscht.`);
  } catch (error) {
    notify.error('Löschen fehlgeschlagen', error);
  }
}
</script>
