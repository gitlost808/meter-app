import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './client';
import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('uses the server message of an API error', () => {
    expect(getErrorMessage(new ApiError('x', 404, '/api/values/7', { message: 'Value 7 not found' })))
      .toBe('Value 7 not found');
  });

  it('joins validation messages', () => {
    expect(getErrorMessage(new ApiError('x', 400, '/api/units', { message: ['name should not be empty', 'suffix must be a string'] })))
      .toBe('name should not be empty; suffix must be a string');
  });

  it('explains missing login, missing permission and unreachable servers', () => {
    expect(getErrorMessage(new ApiError('x', 401, '/api/units'))).toBe('Nicht angemeldet. Bitte erneut anmelden.');
    expect(getErrorMessage(new ApiError('x', 403, '/api/units', { message: 'Insufficient role for write access' })))
      .toBe('Keine Berechtigung für diese Aktion.');
    expect(getErrorMessage(new ApiError('x', 409, '/api/values', { message: 'Meter 3 already has a reading on 2024-06-01' })))
      .toBe('Für diesen Zähler gibt es an diesem Tag bereits einen Zählerstand.');
    expect(getErrorMessage(new ApiError('x', 0, '/api/units'))).toBe('Server nicht erreichbar.');
  });

  it('falls back to the status when the server sends no message', () => {
    expect(getErrorMessage(new ApiError('x', 502, '/api/units', '<html>Bad Gateway</html>'))).toBe('Serverfehler (502).');
    expect(getErrorMessage(new ApiError('x', 422, '/api/units'))).toBe('Anfrage fehlgeschlagen (422).');
  });

  it('uses the message of other errors', () => {
    expect(getErrorMessage(new Error('Für den neuen Zähler (gas) fehlt der Zählerstand.')))
      .toBe('Für den neuen Zähler (gas) fehlt der Zählerstand.');
    expect(getErrorMessage('something')).toBe('Unbekannter Fehler.');
  });
});

describe('apiRequest network errors', () => {
  beforeEach(() => {
    vi.spyOn(window, 'fetch');
  });

  it('turns an unreachable server into an ApiError with status 0', async () => {
    vi.mocked(window.fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await apiRequest('/api/units').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, path: '/api/units' });
    expect(getErrorMessage(error)).toBe('Server nicht erreichbar.');
  });
});
