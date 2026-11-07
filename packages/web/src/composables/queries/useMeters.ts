import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  createMeter,
  deleteMeter,
  listMeterStats,
  updateMeter,
  type SaveMeterInput,
} from '@/api/meters';

export const metersQueryKey = ['meter-stats'] as const;

export function useMetersQuery() {
  return useQuery({
    queryKey: metersQueryKey,
    queryFn: listMeterStats,
  });
}

export function useSaveMeterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveMeterInput) => {
      if (input.id) {
        return updateMeter(input.id, {
          name: input.name,
          meterTypeId: input.meterTypeId,
        });
      }

      return createMeter({
        name: input.name,
        meterTypeId: input.meterTypeId,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: metersQueryKey });
    },
  });
}

export function useDeleteMeterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMeter,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: metersQueryKey });
    },
  });
}
