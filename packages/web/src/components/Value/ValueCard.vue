<template>
  <v-card :disabled="isSaving" :loading="isSaving" variant="outlined">
    <template #loader="{ isActive }">
      <v-progress-linear :active="isActive" color="green" height="6" indeterminate />
    </template>
    <v-card-title>
      <MeterTypeTitle :meter-type-id="model.meterTypeId" />
    </v-card-title>
    <v-card-subtitle>
      <MeterTitle :meter-id="latestMeterId" />
    </v-card-subtitle>
    <v-card-text>
      <ValueHistory :raw="true" class="mb-2" density="compact" :meter-type-id="model.meterTypeId" />
      <ValueInput
v-model="model.value" density="compact" label="Zählerstand" :original-value="model.originalValue"
        :meter-type-id="model.meterTypeId" />
      <v-expand-transition>
        <div v-show="model.newMeter">
          <ValueInput
v-model="model.newMeterValue" :hide-date="true" density="compact" label="Zählerstand neuer Zähler"
            :original-value="model.originalNewMeterValue" :meter-type-id="model.meterTypeId" />
        </div>
      </v-expand-transition>
      <v-alert
v-if="model.originalValue?.id && valueChanged" class="mb-2" type="warning"
        text="Sie editieren einen existierenden Wert!" />
    </v-card-text>
    <v-card-actions>
      <v-checkbox
v-model="model.newMeter" :disabled="!valueEntryReportState.meterChangeAllowed.value"
        label="Zählerwechsel?" />
      <v-spacer />
      <v-btn color="blue" text="Zurücksetzen" @click="reset" />
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { useMetersQuery } from '@/composables/queries/useMeters';
import { useValueEntryReportState } from '@/composables/queries/useValueEntryReports';
import { useIsSavingValueEntries } from '@/composables/queries/useValues';
import type { ValueFormState } from '@/stores/value';

const valueStore = useValueStore();
const metersQuery = useMetersQuery();
const isSaving = useIsSavingValueEntries();

const model = defineModel<ValueFormState>({
  default: () => ({
    meterTypeId: 0,
    originalValue: undefined,
    originalNewMeterValue: undefined,
    value: undefined,
    newMeterValue: undefined,
    newMeter: false,
  }),
});

const meterTypeId = computed(() => model.value.meterTypeId);
const selectedDate = toRef(valueStore, 'selectedDate');
const valueEntryReportState = useValueEntryReportState(meterTypeId, selectedDate);

const latestMeterId = computed(() => {
  const latestMeterId = valueEntryReportState.latestReportRow.value?.meterId;
  if (latestMeterId != null) {
    return latestMeterId;
  }

  return metersQuery.data.value?.find((meter) => {
    return meter.meterTypeId === model.value.meterTypeId;
  })?.id;
});

watch(valueEntryReportState.selection, ({ selectedValue, selectedNewMeterValue, newMeter }) => {
  model.value.originalValue = selectedValue;
  model.value.originalNewMeterValue = selectedNewMeterValue;
  model.value.value = selectedValue?.rawValue;
  model.value.newMeterValue = selectedNewMeterValue?.rawValue;
  model.value.newMeter = newMeter;
}, { immediate: true });

const valueChanged = computed(() => {
  return (model.value.value !== model.value.originalValue?.rawValue) ||
    (model.value.newMeterValue !== model.value.originalNewMeterValue?.rawValue);
});

function reset() {
  model.value.value = model.value.originalValue?.rawValue;
  model.value.newMeterValue = model.value.originalNewMeterValue?.rawValue;
}
</script>
