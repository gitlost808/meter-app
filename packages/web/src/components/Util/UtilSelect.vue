<template>
  <v-select
    :model-value="model"
    :placeholder="placeholder"
    :items="items"
    item-title="title"
    item-value="value"
    @update:model-value="updateModel"
  />
</template>

<script setup lang="ts">
const model = defineModel<number | string | null>()

const props = defineProps<{
  items: Array<{ id: number; name: string }>;
  placeholder?: string;
}>();

const items = computed(() => {
  return props.items.map((item) => ({
    title: item.name,
    value: item.id,
  }));
});

function updateModel(value: number | string | null) {
  if (typeof value === 'string' && value !== '' && !Number.isNaN(Number(value))) {
    model.value = Number(value);
    return;
  }

  model.value = value;
}
</script>
