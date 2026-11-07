import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  createMeterType,
  deleteMeterType,
  listMeterTypes,
  updateMeterType,
  type SaveMeterTypeInput,
} from '@/api/meter-types';

export const meterTypesQueryKey = ['meter-types'] as const;

export function useMeterTypesQuery() {
  return useQuery({
    queryKey: meterTypesQueryKey,
    queryFn: listMeterTypes,
  });
}

export function useSaveMeterTypeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveMeterTypeInput) => {
      if (input.id) {
        return updateMeterType(input.id, {
          name: input.name,
          unitId: input.unitId,
        });
      }

      return createMeterType({
        name: input.name,
        unitId: input.unitId,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meterTypesQueryKey });
    },
  });
}

export function useDeleteMeterTypeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMeterType,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meterTypesQueryKey });
    },
  });
}
