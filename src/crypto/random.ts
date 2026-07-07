/**
 * Generación de aleatoriedad criptográficamente segura.
 *
 * Usa `expo-crypto` (primera parte, respaldado por el RNG seguro del sistema
 * operativo). NO usar `Math.random()` para nada relacionado con seguridad.
 */
import * as Crypto from 'expo-crypto';

import { encodeArgon2Salt } from './argon2Salt';
import { SALT_BYTES } from './params';

/** Devuelve `n` bytes aleatorios criptográficamente seguros. */
export function randomBytes(n: number): Uint8Array {
  return Crypto.getRandomBytes(n);
}

/**
 * Genera un salt aleatorio de 32 bytes y lo devuelve codificado en el formato
 * hexadecimal que espera el módulo nativo de Argon2 (ver `argon2Salt.ts`).
 * El valor se persiste tal cual en el manifiesto (no es secreto).
 */
export function generateSaltHex(): string {
  return encodeArgon2Salt(randomBytes(SALT_BYTES));
}

/** Genera un identificador único (UUID v4) para un usuario/registro. */
export function randomUUID(): string {
  return Crypto.randomUUID();
}
