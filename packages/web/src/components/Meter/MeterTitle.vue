<template>
  {{ meterName }}
</template>

<script setup lang="ts">
import { useMetersQuery } from '@/composables/queries/useMeters';

const props = defineProps<{
  meterId?: number | null;
}>()

const metersQuery = useMetersQuery();

const meterName = computed(() => {
  return metersQuery.data.value?.find((meter) => {
    return meter.id === props.meterId;
  })?.name;
})
</script>
