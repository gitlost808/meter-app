<template>
  <UtilSelect v-model="model" placeholder="Zähler auswählen" :items="meters" />
</template>

<script setup lang="ts">
import { useMetersQuery } from '@/composables/queries/useMeters';

const model = defineModel<number | null>()
const metersQuery = useMetersQuery();

const meters = computed(() => metersQuery.data.value ?? []);
</script>
