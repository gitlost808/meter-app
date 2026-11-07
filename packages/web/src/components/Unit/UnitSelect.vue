<template>
  <UtilSelect v-model="model" placeholder="Einheit auswählen" :items="units" />
</template>

<script setup lang="ts">
import { useUnitsQuery } from '@/composables/queries/useUnits';

const model = defineModel<number | null>()
const unitsQuery = useUnitsQuery();

const units = computed(() => unitsQuery.data.value ?? []);
</script>
