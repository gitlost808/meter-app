<template>
  <span>{{ formattedValue }}</span>
</template>
<script setup lang="ts">
import { useUnitsQuery } from '@/composables/queries/useUnits';

const props = defineProps<{
  value?: number | null;
  unitId?: number | null;
}>()

const unitsQuery = useUnitsQuery();

const formattedValue = computed(() => {
  const unit = unitsQuery.data.value?.find((candidate) => {
    return candidate.id === props.unitId;
  })?.suffix;
  return `${props.value?.toFixed(3) ?? 0} ${unit}`;
})
</script>
