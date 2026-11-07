<template>
  <UtilSelect v-model="model" placeholder="Zählerart auswählen" :items="meterTypes" />
</template>

<script setup lang="ts">
import { useMeterTypesQuery } from '@/composables/queries/useMeterTypes';

const model = defineModel<number | null>()
const meterTypesQuery = useMeterTypesQuery();

const meterTypes = computed(() => meterTypesQuery.data.value ?? []);
</script>
