import type { components } from '@shared-api';
import { apiRequest } from './client';

export type MeterType = components['schemas']['CreateMeterTypeDto'] & {
  id: number;
};

export type CreateMeterTypeInput = components['schemas']['CreateMeterTypeDto'];
export type UpdateMeterTypeInput = components['schemas']['UpdateMeterTypeDto'];
export type SaveMeterTypeInput = Partial<MeterType> & CreateMeterTypeInput;

export function listMeterTypes(): Promise<MeterType[]> {
  return apiRequest<MeterType[]>('/api/meter-types');
}

export function createMeterType(input: CreateMeterTypeInput): Promise<MeterType> {
  return apiRequest<MeterType>('/api/meter-types', {
    method: 'POST',
    body: input,
  });
}

export function updateMeterType(
  id: number,
  input: UpdateMeterTypeInput,
): Promise<MeterType> {
  return apiRequest<MeterType>(`/api/meter-types/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteMeterType(id: number): Promise<void> {
  return apiRequest<void>(`/api/meter-types/${id}`, {
    method: 'DELETE',
  });
}
