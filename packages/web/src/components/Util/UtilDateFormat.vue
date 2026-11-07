<template>
  {{ formattedDate }}
</template>
<script setup lang="ts">
import { useDate } from 'vuetify';

const dateLib = useDate()

const props = defineProps<{
  date?: Date | string | number | null;
  format?: string;
}>()

const formattedDate = computed(() => {
  return dateLib.format(props.date, props.format || 'keyboardDate')
})
</script>
