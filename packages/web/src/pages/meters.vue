<template>
  <CardGrid :items="meters" name="Zähler">
    <template #form>
      <MeterDialog button-text="Zähler erstellen"/>
    </template>
    <template #default="slotProps">
      <MeterCard :meter="slotProps.item" />
    </template>
  </CardGrid>
</template>

<script setup lang="ts">
import { useMetersQuery } from '@/composables/queries/useMeters';
import { useMeterTypesQuery } from '@/composables/queries/useMeterTypes';
import { useUnitsQuery } from '@/composables/queries/useUnits';

const metersQuery = useMetersQuery();
useMeterTypesQuery();
useUnitsQuery();

const meters = computed(() => metersQuery.data.value ?? []);
</script>
