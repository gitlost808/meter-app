<template>
  <UtilEditOrCreateButton :dialog-title="dialogTitle" :save-handler="store" @reset="reset">
    <v-text-field v-model="model.name" label="Name" />
    <v-text-field v-model="model.suffix" label="Suffix" />
  </UtilEditOrCreateButton>
</template>
<script setup lang="ts">
import type { Unit, UpdateUnitInput } from '@/api/units';
import { useSaveUnitMutation } from '@/composables/queries/useUnits';

const saveUnitMutation = useSaveUnitMutation();

type UnitFormModel = Omit<UpdateUnitInput, 'name' | 'suffix'> & {
  id?: number;
  name: string;
  suffix: string;
};

const model = defineModel<UnitFormModel>({
  default: () => ({
    name: '',
    suffix: '',
  }),
});

const props = defineProps<{
  unit?: Unit;
}>();

const dialogTitle = computed(() => {
  return props.unit ? 'Einheit bearbeiten' : 'Einheit erstellen';
});

function reset() {
  model.value = {
    id: props.unit?.id,
    name: props.unit?.name ?? '',
    suffix: props.unit?.suffix ?? '',
  };
}

async function store() {
  await saveUnitMutation.mutateAsync(model.value);
}
</script>
