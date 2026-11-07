<template>
  <CardGrid :items="meterTypes" name="Zählerart">
    <template #form>
      <MeterTypeDialog button-text="Zählerart erstellen" />
    </template>
    <template #default="slotProps">
      <MeterTypeCard :meter-type="slotProps.item" />
    </template>
  </CardGrid>
</template>

<script setup lang="ts">
import { useMeterTypesQuery } from '@/composables/queries/useMeterTypes';
import { useUnitsQuery } from '@/composables/queries/useUnits';

const meterTypesQuery = useMeterTypesQuery();
useUnitsQuery();

const meterTypes = computed(() => meterTypesQuery.data.value ?? []);
</script>
