import { ApiError } from './client';

function serverMessage(details: unknown): string | undefined {
  if (!details || typeof details !== 'object' || !('message' in details)) {
    return undefined;
  }

  const { message } = details as { message: unknown };
  if (typeof message === 'string' && message) {
    return message;
  }
  if (Array.isArray(message) && message.length > 0) {
    return message.join('; ');
  }
  return undefined;
}

/** Turns any thrown value into a message that can be shown to the user. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Server nicht erreichbar.';
    }
    if (error.status === 401) {
      return 'Nicht angemeldet. Bitte erneut anmelden.';
    }
    if (error.status === 403) {
      return 'Keine Berechtigung für diese Aktion.';
    }
    // The API only answers 409 when a meter already has a reading on that day.
    if (error.status === 409) {
      return 'Für diesen Zähler gibt es an diesem Tag bereits einen Zählerstand.';
    }
    return serverMessage(error.details)
      ?? (error.status >= 500 ? `Serverfehler (${error.status}).` : `Anfrage fehlgeschlagen (${error.status}).`);
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unbekannter Fehler.';
}
