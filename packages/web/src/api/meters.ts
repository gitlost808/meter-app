import type { components } from '@shared-api';
import { apiRequest } from './client';

export type Meter = components['schemas']['CreateMeterDto'] & {
  id: number;
};

export type MeterStat = Meter & {
  firstValue: number | null;
  firstValueDate: string | null;
  lastValue: number | null;
  lastValueDate: string | null;
  totalValues: number | null;
};

export type CreateMeterInput = components['schemas']['CreateMeterDto'];
export type UpdateMeterInput = components['schemas']['UpdateMeterDto'];
export type SaveMeterInput = Partial<Meter> & CreateMeterInput;

export function listMeterStats(): Promise<MeterStat[]> {
  return apiRequest<MeterStat[]>('/api/meter-stats');
}

export function createMeter(input: CreateMeterInput): Promise<Meter> {
  return apiRequest<Meter>('/api/meters', {
    method: 'POST',
    body: input,
  });
}

export function updateMeter(id: number, input: UpdateMeterInput): Promise<Meter> {
  return apiRequest<Meter>(`/api/meters/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteMeter(id: number): Promise<void> {
  return apiRequest<void>(`/api/meters/${id}`, {
    method: 'DELETE',
  });
}
