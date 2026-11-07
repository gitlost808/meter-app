<template>
  <v-card :title="unit.name" :subtitle="unit.suffix">
    <v-card-text>
      <dl>
        <dt><strong>Zählerarten:</strong></dt>
        <dd>{{ meterTypeCount }}</dd>
      </dl>
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <UtilDeleteButton name="Einheit" @delete="removeUnit" />
      <UnitDialog :unit="unit" button-text="Bearbeiten" />
    </v-card-actions>
  </v-card>
</template>
<script setup lang="ts">
import type { Unit } from '@/api/units';
import { useMeterTypesQuery } from '@/composables/queries/useMeterTypes';
import { useDeleteUnitMutation } from '@/composables/queries/useUnits';
import { useNotify } from '@/composables/useNotify';

const notify = useNotify();
const meterTypesQuery = useMeterTypesQuery();
const deleteUnitMutation = useDeleteUnitMutation();

const props = defineProps<{
  unit: Unit;
}>();

const meterTypeCount = computed(() => {
  return (meterTypesQuery.data.value ?? []).filter((meterType) => {
    return meterType.unitId === props.unit.id;
  }).length;
});

async function removeUnit() {
  try {
    await deleteUnitMutation.mutateAsync(props.unit.id);
    notify.success(`Einheit „${props.unit.name}“ gelöscht.`);
  } catch (error) {
    notify.error('Löschen fehlgeschlagen', error);
  }
}
</script>
