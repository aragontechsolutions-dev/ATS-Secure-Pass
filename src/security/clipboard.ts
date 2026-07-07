/**
 * Copia al portapapeles con auto-borrado temporizado.
 *
 * `expo-clipboard` no expone TTL ni el flag "contenido sensible"
 * (`ClipDescription.EXTRA_IS_SENSITIVE`) — hay que implementar el borrado con un
 * timer. Al copiar una contraseña, se programa limpiar el portapapeles tras
 * `DEFAULT_CLIPBOARD_TTL_MS`, y solo se limpia si el contenido sigue siendo el
 * que copiamos (para no borrar algo que el usuario copiara después).
 *
 * Nota: en Android 13+ el sistema ya evita mostrar la preview del contenido
 * sensible en algunos casos, pero el borrado activo es responsabilidad de la app.
 */
import * as Clipboard from 'expo-clipboard';

import { shouldClearClipboard } from './clipboardCore';

export { shouldClearClipboard };

/** Tiempo por defecto antes de limpiar el portapapeles (ms). */
export const DEFAULT_CLIPBOARD_TTL_MS = 25_000;

let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function cancelPending(): void {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

export interface CopyResult {
  /** TTL aplicado en ms. */
  ttlMs: number;
  /** Cancela el borrado programado (p. ej. si se copia otra cosa). */
  cancel: () => void;
}

/**
 * Copia `text` y programa su borrado tras `ttlMs`. Cancela cualquier borrado
 * pendiente anterior.
 */
export async function copyWithAutoClear(
  text: string,
  ttlMs: number = DEFAULT_CLIPBOARD_TTL_MS
): Promise<CopyResult> {
  cancelPending();
  await Clipboard.setStringAsync(text);

  pendingTimer = setTimeout(async () => {
    pendingTimer = null;
    try {
      const current = await Clipboard.getStringAsync();
      if (shouldClearClipboard(current, text)) {
        await Clipboard.setStringAsync('');
      }
    } catch {
      // Si falla la lectura, intentamos limpiar de todas formas.
      await Clipboard.setStringAsync('').catch(() => undefined);
    }
  }, ttlMs);

  return { ttlMs, cancel: cancelPending };
}

/** Limpia el portapapeles inmediatamente y cancela cualquier borrado pendiente. */
export async function clearClipboardNow(): Promise<void> {
  cancelPending();
  await Clipboard.setStringAsync('');
}
