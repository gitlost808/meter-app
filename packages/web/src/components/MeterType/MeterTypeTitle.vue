<template>
  {{ meterTypeName }}
</template>

<script setup lang="ts">
import { useMeterTypesQuery } from '@/composables/queries/useMeterTypes';

const props = defineProps<{
  meterTypeId?: number | null;
}>()

const meterTypesQuery = useMeterTypesQuery();

const meterTypeName = computed(() => {
  return meterTypesQuery.data.value?.find((meterType) => {
    return meterType.id === props.meterTypeId;
  })?.name;
})

</script>
