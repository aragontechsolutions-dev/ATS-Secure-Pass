/**
 * Lógica pura del portapapeles (sin dependencias nativas), testeable en Node.
 * El resto (`clipboard.ts`) la consume junto a `expo-clipboard`.
 */

/**
 * Decide si se debe limpiar el portapapeles: solo si su contenido actual sigue
 * siendo exactamente el que copiamos.
 */
export function shouldClearClipboard(current: string, copied: string): boolean {
  return current === copied;
}
