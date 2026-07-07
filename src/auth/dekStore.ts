/**
 * Almacén de la DEK protegido por biometría (Android Keystore vía
 * `expo-secure-store`).
 *
 * PATRÓN "wrap key": la DEK (32 bytes hex) se guarda con
 * `requireAuthentication: true`, que en Android equivale a
 * `setUserAuthenticationRequired(true)`. El sistema operativo solo libera el
 * valor tras una autenticación biométrica FUERTE (Class 3) — la biometría
 * desbloquea la clave, no autentica por sí sola.
 *
 * INVALIDACIÓN: al añadir/cambiar una biometría, la clave del Keystore se
 * invalida de forma irreversible y el valor se vuelve ilegible. Por eso la
 * lectura envuelve en try/catch y el llamador SIEMPRE debe poder caer al
 * desbloqueo por master password (que re-deriva la DEK y la vuelve a guardar).
 *
 * Notas:
 *  - El valor (64 hex chars) cabe de sobra en el límite de 2048 bytes.
 *  - No se usa `keychainService` junto a `requireAuthentication` (la doc de
 *    expo-secure-store advierte que no funcionan en tándem).
 */
import * as SecureStore from 'expo-secure-store';

import { isRawKeyHex } from '../crypto/params';
import { BiometricUnlockError } from './errors';

const AUTH_PROMPT = 'Desbloquea tu bóveda con tu biometría';

/** Clave de secure-store donde se guarda la DEK de un usuario. */
export function dekStoreKey(userId: string): string {
  return `dek_${userId}`;
}

const authOptions = (): SecureStore.SecureStoreOptions => ({
  requireAuthentication: true,
  authenticationPrompt: AUTH_PROMPT,
});

/**
 * Guarda la DEK protegida por biometría. En Android esto puede pedir
 * autenticación (genera una clave fresca ligada a la biometría actual).
 * Lanza `BiometricUnlockError('unavailable')` si el dispositivo no puede.
 */
export async function storeDek(userId: string, dekHex: string): Promise<void> {
  if (!isRawKeyHex(dekHex)) {
    throw new BiometricUnlockError('unknown', 'DEK inválida al guardar en secure-store.');
  }
  if (!SecureStore.canUseBiometricAuthentication()) {
    throw new BiometricUnlockError(
      'unavailable',
      'El dispositivo no tiene biometría fuerte configurada.'
    );
  }
  try {
    await SecureStore.setItemAsync(dekStoreKey(userId), dekHex, authOptions());
  } catch (err) {
    throw mapSecureStoreError(err);
  }
}

/**
 * Lee la DEK exigiendo biometría (el OS muestra el prompt). Devuelve la DEK en
 * hex. Lanza `BiometricUnlockError` con el motivo correspondiente si no hay
 * valor, el usuario cancela, o la clave se invalidó.
 */
export async function readDek(userId: string): Promise<string> {
  let value: string | null;
  try {
    value = await SecureStore.getItemAsync(dekStoreKey(userId), authOptions());
  } catch (err) {
    throw mapSecureStoreError(err);
  }
  if (value == null) {
    throw new BiometricUnlockError('not-enrolled', 'No hay DEK guardada para este usuario.');
  }
  if (!isRawKeyHex(value)) {
    throw new BiometricUnlockError('unknown', 'La DEK almacenada está corrupta.');
  }
  return value;
}

/** Borra la DEK guardada (desactivar biometría). No falla si no existe. */
export async function deleteDek(userId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(dekStoreKey(userId), authOptions());
  } catch {
    // Borrar es idempotente para nuestros fines; ignoramos errores.
  }
}

/**
 * Traduce un error nativo de expo-secure-store a un `BiometricUnlockError`
 * clasificado. Los códigos varían entre versiones/plataformas, así que se hace
 * lo posible por heurística y se cae a 'failed' de forma segura.
 */
function mapSecureStoreError(err: unknown): BiometricUnlockError {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : undefined;
  const message = err instanceof Error ? err.message : String(err);
  const haystack = `${code ?? ''} ${message}`.toLowerCase();

  if (haystack.includes('not_configured') || haystack.includes('not configured')) {
    return new BiometricUnlockError('unavailable', 'Biometría fuerte no configurada.', {
      cause: err,
      nativeCode: code,
    });
  }
  if (
    haystack.includes('invalidat') || // KeyPermanentlyInvalidatedException
    haystack.includes('key not found') ||
    haystack.includes('decrypt')
  ) {
    return new BiometricUnlockError('invalidated', 'La clave biométrica se invalidó (cambió la biometría).', {
      cause: err,
      nativeCode: code,
    });
  }
  if (haystack.includes('cancel') || haystack.includes('authentication') || haystack.includes('auth')) {
    return new BiometricUnlockError('failed', 'Autenticación biométrica cancelada o fallida.', {
      cause: err,
      nativeCode: code,
    });
  }
  return new BiometricUnlockError('unknown', `Fallo de secure-store: ${message}`, {
    cause: err,
    nativeCode: code,
  });
}
