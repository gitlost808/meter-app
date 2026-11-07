<template>
  <v-dialog v-model="dialog" width="auto">
    <template #activator="{ props: activatorProps }">
      <v-btn :color="color" :icon="icon" :size="size" text="Löschen" v-bind="activatorProps" />
    </template>

    <v-card :title="`${name} löschen?`">
      <v-card-actions>
        <v-spacer />

        <v-btn text="Abbrechen" variant="plain" @click="dialog = false" />

        <v-btn color="red" text="Löschen" variant="tonal" @click="deleteHandler" />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script setup>
const dialog = ref(false);
defineProps({
  name: {
    type: String,
    default: 'Item'
  },
  color: {
    type: String,
    default: 'red',
  },
  icon: {
    default: false,
  },
  size: {
    type: String,
    default: 'default',
  },
})
const emit = defineEmits(["delete"])

function deleteHandler() {
  dialog.value = false;
  emit("delete");
}
</script>