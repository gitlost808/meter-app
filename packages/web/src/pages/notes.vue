<template>
  <v-card>
    <v-card-text>
      <v-row align="center">
        <v-col cols="12" sm>
          <v-text-field
            v-model="search" label="Suchen" prepend-inner-icon="mdi-magnify" density="compact"
            hide-details clearable single-line />
        </v-col>
        <v-col cols="12" sm="auto">
          <NoteDialog button-text="Notiz erstellen" />
        </v-col>
      </v-row>
    </v-card-text>
    <v-alert
      v-if="notesQuery.isError.value" class="mx-4 mb-4" type="error" variant="tonal"
      :text="`Notizen konnten nicht geladen werden: ${getErrorMessage(notesQuery.error.value)}`" />
    <v-data-table
      density="compact" :headers="headers" :items="filteredRows" :loading="notesQuery.isPending.value"
      loading-text="Notizen werden geladen …" no-data-text="Keine Notizen gefunden." :items-per-page="25">
      <template #item.actions="{ item }">
        <div class="d-flex ga-1">
          <NoteDialog :note="item" button-text="Bearbeiten" icon="mdi-pencil" size="small" color="transparent" />
          <UtilDeleteButton
            name="Notiz" icon="mdi-trash-can" size="small" color="transparent"
            @delete="removeNote(item)" />
        </div>
      </template>
      <template #item.date="{ item }">
        {{ item.dateText }}
      </template>
      <template #item.text="{ value }">
        <span class="note-text">{{ value }}</span>
      </template>
    </v-data-table>
  </v-card>
</template>

<script setup lang="ts">
import type { DataTableHeader } from 'vuetify';
import { getErrorMessage } from '@/api/errors';
import { useDeleteNoteMutation, useNotesQuery } from '@/composables/queries/useNotes';
import { useNotify } from '@/composables/useNotify';
import { filterNoteRows, toNoteRows, type NoteRow } from '@/features/notes/notes';

const store = useStore();
const notify = useNotify();
// No range: the backend returns all notes (capped at 500).
const notesQuery = useNotesQuery(ref({}));
const deleteNoteMutation = useDeleteNoteMutation();

const search = ref<string | null>('');

const headers: DataTableHeader<NoteRow>[] = [
  { title: '', key: 'actions', width: '1', align: 'start', sortable: false },
  { title: 'Datum', key: 'date', width: '8rem', align: 'start' },
  { title: 'Notiz', key: 'text', align: 'start', sortable: false },
];

const rows = computed(() => toNoteRows(notesQuery.data.value ?? [], store.dateFormat));
const filteredRows = computed(() => filterNoteRows(rows.value, search.value));

async function removeNote(note: NoteRow) {
  try {
    await deleteNoteMutation.mutateAsync(note.id);
    notify.success(`Notiz vom ${note.dateText} gelöscht.`);
  } catch (error) {
    notify.error('Löschen fehlgeschlagen', error);
  }
}
</script>

<style scoped>
.note-text {
  white-space: pre-line;
}
</style>
