import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { Ref } from 'vue';
import {
  createNote,
  deleteNote,
  listNotes,
  updateNote,
  type CreateNoteInput,
  type Note,
  type UpdateNoteInput,
} from '@/api/notes';

type NoteFilter = {
  from?: string;
  to?: string;
};

export const notesQueryKey = ['notes'] as const;

export function useNotesQuery(filters: Ref<NoteFilter>) {
  return useQuery({
    queryKey: computed(() => [...notesQueryKey, filters.value.from ?? null, filters.value.to ?? null]),
    queryFn: () => listNotes(filters.value.from, filters.value.to),
  });
}

export function useCreateNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateNoteInput) => createNote(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notesQueryKey });
    },
  });
}

export function useUpdateNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateNoteInput }) => {
      return updateNote(id, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notesQueryKey });
    },
  });
}

export function useDeleteNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteNote(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notesQueryKey });
    },
  });
}

export type { Note };
