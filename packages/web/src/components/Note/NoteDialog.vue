<template>
  <UtilEditOrCreateButton
    :button-text="buttonText" :dialog-title="dialogTitle" :save-handler="store"
    :color="color" :icon="icon" :size="size" @reset="reset">
    <v-date-picker
      v-model="model.date" :max="new Date()" :show-adjacent-months="true" hide-header
      width="100%" />
    <v-textarea
      v-model="model.text" label="Notiz" :counter="NOTE_TEXT_MAX_LENGTH" :rules="[validateNoteText]"
      auto-grow rows="3" />
  </UtilEditOrCreateButton>
</template>
<script setup lang="ts">
import { startOfToday } from 'date-fns';
import type { Note } from '@/api/notes';
import { useCreateNoteMutation, useUpdateNoteMutation } from '@/composables/queries/useNotes';
import { useNotify } from '@/composables/useNotify';
import { NOTE_TEXT_MAX_LENGTH, buildNoteInput, toNoteDate, validateNoteText } from '@/features/notes/notes';

type NoteFormModel = {
  date: Date | null;
  text: string;
};

const props = withDefaults(defineProps<{
  note?: Note;
  buttonText?: string;
  color?: string;
  icon?: string | false;
  size?: string;
}>(), {
  note: undefined,
  buttonText: 'Bearbeiten',
  color: 'blue',
  icon: false,
  size: 'default',
});

const appStore = useStore();
const notify = useNotify();
const createNoteMutation = useCreateNoteMutation();
const updateNoteMutation = useUpdateNoteMutation();

const model = ref<NoteFormModel>({ date: startOfToday(), text: '' });

const dialogTitle = computed(() => {
  return props.note ? 'Notiz bearbeiten' : 'Notiz erstellen';
});

function reset() {
  model.value = {
    date: props.note ? toNoteDate(props.note.timestamp) : startOfToday(),
    text: props.note?.text ?? '',
  };
}

// Errors propagate to UtilEditOrCreateButton, which keeps the dialog open and shows them.
async function store() {
  const input = buildNoteInput(model.value.date, model.value.text, appStore.dateApiSendFormat);

  if (props.note) {
    await updateNoteMutation.mutateAsync({ id: props.note.id, input });
    notify.success('Notiz gespeichert.');
  } else {
    await createNoteMutation.mutateAsync(input);
    notify.success('Notiz erstellt.');
  }
}
</script>
