<template>
  <v-dialog v-model="dialog" max-width="600">
    <template #activator="{ props: activatorProps }">
      <v-btn
        :color="color" :icon="icon" :size="size" :text="buttonText" :aria-label="icon ? buttonText : undefined"
        v-bind="activatorProps"
        @click="$emit('reset')" />
    </template>

    <v-card :disabled="loading" :loading="loading" :title="dialogTitle">
      <v-form @submit.prevent>
        <v-card-text>
          <slot />
        </v-card-text>

        <v-divider />

        <v-card-actions>
          <v-spacer />

          <v-btn :text="cancelText" variant="plain" @click="cancelHandler" />

          <v-btn color="primary" :text="saveText" type="submit" variant="tonal" @click="confirmHandler" />
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>
<script setup>
import { useNotify } from '@/composables/useNotify';

const notify = useNotify()
defineEmits(['reset'])
const props = defineProps({
  buttonText: {
    type: String,
    default: 'Bearbeiten'
  },
  dialogTitle: {
    type: String,
    default: ''
  },
  cancelText: {
    type: String,
    default: 'Abbrechen'
  },
  saveText: {
    type: String,
    default: 'Speichern'
  },
  saveHandler: {
    type: Function,
    default: () => { }
  },
  color: {
    type: String,
    default: 'blue',
  },
  icon: {
    type: [String, Boolean],
    default: false,
  },
  size: {
    type: String,
    default: 'default',
  },
})
const dialog = ref(false);
async function cancelHandler() {
  dialog.value = false;
}
const loading = ref(false);
async function confirmHandler() {
  try {
    loading.value = true;
    await props.saveHandler()
    dialog.value = false;
  } catch (err) {
    notify.error('Speichern fehlgeschlagen', err)
  } finally {
    loading.value = false;
  }
}
</script>