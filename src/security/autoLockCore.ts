/**
 * Lógica pura del auto-bloqueo (sin dependencias de React/React Native), para
 * poder testearla en Node. El hook `useAutoLock` (en `autoLock.ts`) la consume.
 */

/** ¿Ha pasado al menos `timeoutMs` entre `lastActiveAt` y `now`? */
export function isInactivityExpired(
  lastActiveAt: number,
  now: number,
  timeoutMs: number
): boolean {
  return now - lastActiveAt >= timeoutMs;
}
