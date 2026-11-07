<template>
  <UtilEditOrCreateButton :dialog-title="dialogTitle" :save-handler="store" @reset="reset">
    <v-text-field v-model="model.name" label="Name" />
    <UnitSelect v-model="selectedUnitId" />
  </UtilEditOrCreateButton>
</template>
<script setup lang="ts">
import type { MeterType, UpdateMeterTypeInput } from '@/api/meter-types';
import { useSaveMeterTypeMutation } from '@/composables/queries/useMeterTypes';

const saveMeterTypeMutation = useSaveMeterTypeMutation();

type MeterTypeFormModel = Omit<UpdateMeterTypeInput, 'unitId' | 'name'> & {
  id?: number;
  name: string;
  unitId: number | null;
};

const model = defineModel<MeterTypeFormModel>({
  default: () => ({
    name: '',
    unitId: null,
  }),
});

const props = defineProps<{
  meterType?: MeterType;
}>();

const dialogTitle = computed(() => {
  return props.meterType ? 'Zählerart bearbeiten' : 'Zählerart erstellen';
});

const selectedUnitId = computed<number | null>({
  get() {
    return model.value.unitId ?? null;
  },
  set(value) {
    model.value = {
      ...model.value,
      unitId: value,
    };
  },
});

function reset() {
  model.value = {
    id: props.meterType?.id,
    name: props.meterType?.name ?? '',
    unitId: props.meterType?.unitId ?? null,
  };
}

async function store() {
  if (model.value.unitId == null) {
    throw new Error('Bitte eine Einheit auswählen.');
  }

  await saveMeterTypeMutation.mutateAsync({
    ...model.value,
    unitId: model.value.unitId,
  });
}
</script>
