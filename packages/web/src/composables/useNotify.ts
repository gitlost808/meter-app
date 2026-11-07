import { getErrorMessage } from '@/api/errors';

/** Shows success and error feedback as snackbars. */
export function useNotify() {
  const store = useStore();

  return {
    success(text: string) {
      store.addSnackbar({ text, color: 'success' });
    },
    /** Neutral notice, e.g. when there was nothing to do. */
    info(text: string) {
      store.addSnackbar({ text });
    },
    /** `action` names what failed, e.g. "Speichern fehlgeschlagen". */
    error(action: string, error: unknown) {
      store.addSnackbar({ text: `${action}: ${getErrorMessage(error)}`, color: 'error' });
    },
  };
}
