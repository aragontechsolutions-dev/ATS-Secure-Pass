/**
 * Auto-bloqueo por inactividad y por segundo plano.
 *
 * Para un gestor de contraseñas, lo más seguro es BLOQUEAR al ir a segundo plano
 * (cerrar la BD y soltar la DEK) y también tras un tiempo sin actividad en
 * primer plano. Se usa la API `AppState` de React Native.
 *
 * Ojo (Android): los `setTimeout` se pausan en segundo plano, por eso se guarda
 * un timestamp al ir a background y se compara al volver, en vez de confiar en el
 * timer.
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { isInactivityExpired } from './autoLockCore';

export { isInactivityExpired };

export interface AutoLockOptions {
  /** Si está activo el auto-lock. */
  enabled: boolean;
  /**
   * Bloquear al volver si estuvo en segundo plano al menos este tiempo.
   * 0 = bloquear siempre al volver de segundo plano (lo más seguro).
   */
  backgroundGraceMs?: number;
  /** Bloquear tras este tiempo sin actividad en primer plano. */
  inactivityMs?: number;
  /** Acción de bloqueo (cerrar BD, soltar DEK). */
  onLock: () => void;
}

const FIVE_MIN = 5 * 60 * 1000;

/**
 * Hook que dispara `onLock` al ir a segundo plano (según gracia) y tras
 * inactividad. Devuelve `notifyActivity` para reiniciar el contador de
 * inactividad ante interacción del usuario.
 */
export function useAutoLock({
  enabled,
  backgroundGraceMs = 0,
  inactivityMs = FIVE_MIN,
  onLock,
}: AutoLockOptions): { notifyActivity: () => void } {
  const backgroundedAt = useRef<number | null>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref para que el listener use siempre el callback más reciente sin re-suscribir.
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  const clearInactivity = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
  }, []);

  const armInactivity = useCallback(() => {
    clearInactivity();
    if (!enabled) return;
    inactivityTimer.current = setTimeout(() => onLockRef.current(), inactivityMs);
  }, [clearInactivity, enabled, inactivityMs]);

  const notifyActivity = useCallback(() => {
    if (enabled) armInactivity();
  }, [enabled, armInactivity]);

  useEffect(() => {
    if (!enabled) {
      clearInactivity();
      backgroundedAt.current = null;
      return;
    }
    armInactivity();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now();
        clearInactivity();
      } else if (state === 'active') {
        const bg = backgroundedAt.current;
        backgroundedAt.current = null;
        if (bg != null && isInactivityExpired(bg, Date.now(), backgroundGraceMs)) {
          onLockRef.current();
        } else {
          armInactivity();
        }
      }
    });

    return () => {
      sub.remove();
      clearInactivity();
    };
  }, [enabled, backgroundGraceMs, armInactivity, clearInactivity]);

  return { notifyActivity };
}
