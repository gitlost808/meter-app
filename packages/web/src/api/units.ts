import type { components } from '@shared-api';
import { apiRequest } from './client';

export type Unit = components['schemas']['CreateUnitDto'] & {
  id: number;
};

export type CreateUnitInput = components['schemas']['CreateUnitDto'];
export type UpdateUnitInput = components['schemas']['UpdateUnitDto'];
export type SaveUnitInput = Partial<Unit> & CreateUnitInput;

export function listUnits(): Promise<Unit[]> {
  return apiRequest<Unit[]>('/api/units');
}

export function createUnit(input: CreateUnitInput): Promise<Unit> {
  return apiRequest<Unit>('/api/units', {
    method: 'POST',
    body: input,
  });
}

export function updateUnit(id: number, input: UpdateUnitInput): Promise<Unit> {
  return apiRequest<Unit>(`/api/units/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteUnit(id: number): Promise<void> {
  return apiRequest<void>(`/api/units/${id}`, {
    method: 'DELETE',
  });
}
