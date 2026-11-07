<template>
  <component :is="layoutComponent">
    <RouterView />
  </component>
</template>

<script setup lang="ts">
import LayoutDefault from '@/components/Layout/LayoutDefault.vue';
import LayoutReports from '@/components/Layout/LayoutReports.vue';

const route = useRoute();

const layoutComponent = computed(() => {
  return route.meta.layout === 'reports'
    ? LayoutReports
    : LayoutDefault;
});
</script>
