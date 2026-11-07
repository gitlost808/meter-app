<template>
  <CardGrid :items="units" name="Einheit">
    <template #form>
      <UnitDialog button-text="Einheit erstellen" />
    </template>
    <template #default="slotProps">
      <UnitCard :unit="slotProps.item" />
    </template>
  </CardGrid>
</template>

<script setup lang="ts">
import { useUnitsQuery } from '@/composables/queries/useUnits';

const unitsQuery = useUnitsQuery();

const units = computed(() => unitsQuery.data.value ?? []);
</script>
