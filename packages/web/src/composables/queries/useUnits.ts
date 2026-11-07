import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  createUnit,
  deleteUnit,
  listUnits,
  updateUnit,
  type SaveUnitInput,
} from '@/api/units';

export const unitsQueryKey = ['units'] as const;

export function useUnitsQuery() {
  return useQuery({
    queryKey: unitsQueryKey,
    queryFn: listUnits,
  });
}

export function useSaveUnitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveUnitInput) => {
      if (input.id) {
        return updateUnit(input.id, {
          name: input.name,
          suffix: input.suffix,
        });
      }

      return createUnit({
        name: input.name,
        suffix: input.suffix,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: unitsQueryKey });
    },
  });
}

export function useDeleteUnitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUnit,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: unitsQueryKey });
    },
  });
}
