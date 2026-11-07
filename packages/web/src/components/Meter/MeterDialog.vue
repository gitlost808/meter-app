<template>
  <UtilEditOrCreateButton :dialog-title="dialogTitle" :save-handler="store" @reset="reset">
    <v-text-field v-model="model.name" label="Name" />
    <MeterTypeSelect v-model="selectedMeterTypeId" />
  </UtilEditOrCreateButton>
</template>
<script setup lang="ts">
import type { Meter, UpdateMeterInput } from '@/api/meters';
import { useSaveMeterMutation } from '@/composables/queries/useMeters';

const saveMeterMutation = useSaveMeterMutation();

type MeterFormModel = Omit<UpdateMeterInput, 'meterTypeId' | 'name'> & {
  id?: number;
  name: string;
  meterTypeId: number | null;
};

const model = defineModel<MeterFormModel>({
  default: () => ({
    name: '',
    meterTypeId: null,
  }),
});

const props = defineProps<{
  meter?: Meter;
}>();

const dialogTitle = computed(() => {
  return props.meter ? 'Zähler bearbeiten' : 'Zähler erstellen';
});

const selectedMeterTypeId = computed<number | null>({
  get() {
    return model.value.meterTypeId ?? null;
  },
  set(value) {
    model.value = {
      ...model.value,
      meterTypeId: value,
    };
  },
});

function reset() {
  model.value = {
    id: props.meter?.id,
    name: props.meter?.name ?? '',
    meterTypeId: props.meter?.meterTypeId ?? null,
  };
}

async function store() {
  if (model.value.meterTypeId == null) {
    throw new Error('Bitte eine Zählerart auswählen.');
  }

  await saveMeterMutation.mutateAsync({
    ...model.value,
    meterTypeId: model.value.meterTypeId,
  });
}
</script>
