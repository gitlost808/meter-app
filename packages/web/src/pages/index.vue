<template>
  <v-form @submit.prevent>
    <v-row>
      <v-col cols="12" lg="auto">
        <v-card :disabled="isSaving" :loading="isSaving">
          <template #loader="{ isActive }">
            <v-progress-linear
              :active="isActive"
              color="green"
              height="6"
              indeterminate
            />
          </template>
          <v-card-text>
            <v-date-picker
              v-model="valueStore.selectedDate"
              :show-adjacent-months="true"
              :events="datesWithValues"
              event-color="green"
              width="100%"
              :max="new Date()" />
            <div class="d-flex align-center justify-center ga-2 mb-4 text-caption text-medium-emphasis">
              <v-icon icon="mdi-circle" color="green" size="8" aria-hidden="true" />
              Messwerte vorhanden
            </div>
            <v-textarea
              v-model="valueStore.note.text"
              label="Notiz"
              clearable
              :counter="NOTE_MAX_LENGTH"
              :maxlength="NOTE_MAX_LENGTH"
              :disabled="!noteLoaded"
              :error-messages="notesLoadFailed ? 'Notiz konnte nicht geladen werden.' : undefined" />
          </v-card-text>
          <v-card-actions class="pt-0">
            <v-btn text="Heute" @click="goToToday" />
            <v-spacer />
            <v-btn color="green" variant="outlined" type="submit" text="Speichern" @click="saveValues" />
          </v-card-actions>
        </v-card>
      </v-col>
      <v-col cols="12" lg>
        <!-- wrap by available width: two cards per row, one when two would be cramped (< 360px) -->
        <div class="grid gap-6 grid-cols-[repeat(auto-fill,minmax(max(min(360px,100%),calc((100%_-_1.5rem)/2)),1fr))]">
          <ValueCard
            v-for="mt in meterTypes"
            :key="mt.id"
            v-model="valueStore.inputValues[mt.id]" />
        </div>
      </v-col>
    </v-row>
  </v-form>
</template>

<script setup lang="ts">
import { format } from 'date-fns';
import { useMeterTypesQuery } from '@/composables/queries/useMeterTypes';
import { useMetersQuery } from '@/composables/queries/useMeters';
import { useNotesQuery } from '@/composables/queries/useNotes';
import { useReportRowsByMeterTypesQuery } from '@/composables/queries/useValueEntryReports';
import {
  NOTE_MAX_LENGTH,
  type SaveValueEntryResult,
  useIsSavingValueEntries,
  useSaveValueEntriesMutation,
} from '@/composables/queries/useValues';
import { useNotify } from '@/composables/useNotify';

const valueStore = useValueStore()
const store = useStore();
const notify = useNotify();
const meterTypesQuery = useMeterTypesQuery();
const metersQuery = useMetersQuery();
const saveValueEntriesMutation = useSaveValueEntriesMutation();
const isSaving = useIsSavingValueEntries();

const meterTypes = computed(() => meterTypesQuery.data.value ?? []);
const meterTypeIds = computed(() => meterTypes.value.map((meterType) => meterType.id));
const reportRowsByMeterTypesQuery = useReportRowsByMeterTypesQuery(meterTypeIds);
const datesWithValues = computed(() => [...new Set(
  reportRowsByMeterTypesQuery.data.value.map((row) => format(row.timestamp, 'yyyy-MM-dd')),
)]);

// Value entries and their note are saved at midnight UTC of the selected day,
// so the note of the day is the one at exactly that timestamp.
const entryTimestamp = computed(() => format(valueStore.selectedDate, store.dateApiSendFormat));
const noteFilters = computed(() => ({ from: entryTimestamp.value, to: entryTimestamp.value }));
const notesQuery = useNotesQuery(noteFilters);

const notes = computed(() => notesQuery.data.value);
const notesLoadFailed = computed(() => notesQuery.isError.value && !notes.value);

// The first note by id; further notes of the same day are left untouched.
const noteOfDay = computed(() => {
  const entryTime = new Date(entryTimestamp.value).getTime();
  return notes.value
    ?.filter((note) => note.timestamp.getTime() === entryTime)
    .sort((a, b) => a.id - b.id)[0];
});
const noteLoaded = computed(() => notes.value !== undefined && valueStore.note.timestamp === entryTimestamp.value);

watch([entryTimestamp, noteOfDay, () => notes.value !== undefined], ([timestamp, note, loaded]) => {
  // Until the day's notes are loaded, the note stays empty (and the textarea disabled),
  // so a previous day's text is never saved for this day.
  valueStore.applyLoadedNote(timestamp, loaded ? note : undefined);
}, { immediate: true });

function goToToday() {
  valueStore.selectedDate = new Date();
}

const latestMeterIdsByMeterType = computed<Record<number, number | undefined>>(() => {
  const latestRowsByMeterType = new Map<number, { meterId: number | null; timestamp: Date }>();

  reportRowsByMeterTypesQuery.data.value.forEach((reportRow) => {
    if (reportRow.meterTypeId == null) {
      return;
    }

    const currentLatest = latestRowsByMeterType.get(reportRow.meterTypeId);
    if (!currentLatest || currentLatest.timestamp <= reportRow.timestamp) {
      latestRowsByMeterType.set(reportRow.meterTypeId, {
        meterId: reportRow.meterId,
        timestamp: reportRow.timestamp,
      });
    }
  });

  return Object.fromEntries(
    meterTypes.value.map((meterType) => {
      const latestMeterId = latestRowsByMeterType.get(meterType.id)?.meterId ?? undefined;
      const fallbackMeterId = metersQuery.data.value?.find((meter) => {
        return meter.meterTypeId === meterType.id;
      })?.id;

      return [meterType.id, latestMeterId ?? fallbackMeterId];
    }),
  );
});

const defaultMeterNamesByMeterType = computed<Record<number, string | undefined>>(() => {
  return Object.fromEntries(
    meterTypes.value.map((meterType) => {
      const activeMeterId = latestMeterIdsByMeterType.value[meterType.id];
      const activeMeterName = metersQuery.data.value?.find((meter) => {
        return meter.id === activeMeterId;
      })?.name;

      return [
        meterType.id,
        activeMeterName
          ? `${activeMeterName} ${format(valueStore.selectedDate, 'yyyy-MM-dd')}`
          : undefined,
      ];
    }),
  );
});

const meterTypeNames = computed<Record<number, string>>(() => {
  return Object.fromEntries(meterTypes.value.map((meterType) => [meterType.id, meterType.name]));
});

async function saveValues() {
  try {
    const result = await saveValueEntriesMutation.mutateAsync({
      selectedDate: valueStore.selectedDate,
      dateApiSendFormat: store.dateApiSendFormat,
      latestMeterIdsByMeterType: latestMeterIdsByMeterType.value,
      defaultMeterNamesByMeterType: defaultMeterNamesByMeterType.value,
      inputValues: valueStore.inputValues,
      note: noteLoaded.value ? valueStore.note : undefined,
      meterTypeNames: meterTypeNames.value,
    });
    const message = savedMessage(result);
    if (message) {
      notify.success(message);
    } else {
      notify.info('Keine Änderungen zum Speichern.');
    }
  } catch (error) {
    notify.error('Speichern fehlgeschlagen', error);
  }
}

function savedMessage({ meterTypes: savedMeterTypes, note }: SaveValueEntryResult): string | undefined {
  const parts = [
    savedMeterTypes > 0 ? 'Zählerstände gespeichert' : undefined,
    note === 'delete' ? 'Notiz gelöscht' : note ? 'Notiz gespeichert' : undefined,
  ].filter(Boolean);
  return parts.length ? `${parts.join(', ')}.` : undefined;
}

watch(meterTypes, (resolvedMeterTypes) => {
  if (!resolvedMeterTypes.length) {
    return;
  }

  valueStore.initializeInputValues(resolvedMeterTypes);
}, {
  immediate: true,
})
</script>
