import type { components } from '@shared-api';
import { apiRequest } from './client';

export type ValueRecord = {
  id: number;
  value: number;
  timestamp: Date;
  meterId: number | null;
};

type ValueRecordResponse = Omit<ValueRecord, 'timestamp'> & {
  timestamp: string;
};

export type CreateValueInput = components['schemas']['CreateValueDto'];
export type UpdateValueInput = components['schemas']['UpdateValueDto'];

function hydrateValueRecord(value: ValueRecordResponse): ValueRecord {
  return {
    ...value,
    timestamp: new Date(value.timestamp),
  };
}

export async function listValues(): Promise<ValueRecord[]> {
  const values = await apiRequest<ValueRecordResponse[]>('/api/values');
  return values.map(hydrateValueRecord);
}

export async function createValue(input: CreateValueInput): Promise<ValueRecord> {
  const value = await apiRequest<ValueRecordResponse>('/api/values', {
    method: 'POST',
    body: input,
  });
  return hydrateValueRecord(value);
}

export async function updateValue(
  id: number,
  input: UpdateValueInput,
): Promise<ValueRecord> {
  const value = await apiRequest<ValueRecordResponse>(`/api/values/${id}`, {
    method: 'PATCH',
    body: input,
  });
  return hydrateValueRecord(value);
}

export function deleteValue(id: number): Promise<void> {
  return apiRequest<void>(`/api/values/${id}`, {
    method: 'DELETE',
  });
}
