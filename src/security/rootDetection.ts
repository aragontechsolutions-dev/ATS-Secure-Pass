/**
 * Detección de dispositivo comprometido (root / jailbreak / hooking).
 *
 * Usa `jail-monkey`. Es DEFENSA EN PROFUNDIDAD, no una garantía: los checks
 * client-side son bypasseables en un dispositivo realmente comprometido. Sirve
 * para avisar al usuario y, opcionalmente, endurecer el comportamiento.
 *
 * Requiere development build / prebuild (falla en Expo Go).
 */
import JailMonkey from 'jail-monkey';

export interface DeviceIntegrity {
  /** El dispositivo está rooteado / con jailbreak. */
  isJailBroken: boolean;
  /** Se detectó un framework de hooking (p. ej. Frida/Xposed). */
  isHooked: boolean;
  /** Se puede simular la ubicación (indicio de entorno modificado). */
  canMockLocation: boolean;
  /**
   * Veredicto combinado de jail-monkey (`trustFall`): root/jailbreak, hooking y
   * otros indicios. `true` = NO confiable.
   */
  isUntrusted: boolean;
  /** Resumen: el dispositivo se considera comprometido. */
  isCompromised: boolean;
}

/**
 * Evalúa la integridad del dispositivo. Envuelve cada check en try/catch porque
 * jail-monkey puede lanzar si el módulo nativo no está enlazado (p. ej. Expo Go).
 */
export function getDeviceIntegrity(): DeviceIntegrity {
  const safe = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };

  const isJailBroken = safe(() => JailMonkey.isJailBroken(), false);
  const isHooked = safe(() => JailMonkey.hookDetected(), false);
  const canMockLocation = safe(() => JailMonkey.canMockLocation(), false);
  const isUntrusted = safe(() => JailMonkey.trustFall(), false);

  return {
    isJailBroken,
    isHooked,
    canMockLocation,
    isUntrusted,
    isCompromised: isJailBroken || isUntrusted || isHooked,
  };
}
