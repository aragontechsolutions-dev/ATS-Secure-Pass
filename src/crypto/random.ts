/**
 * Generación de aleatoriedad criptográficamente segura.
 *
 * Usa `expo-crypto` (primera parte, respaldado por el RNG seguro del sistema
 * operativo). NO usar `Math.random()` para nada relacionado con seguridad.
 */
import * as Crypto from 'expo-crypto';

import { bytesToHex } from './encoding';
import { SALT_BYTES } from './params';

/** Devuelve `n` bytes aleatorios criptográficamente seguros. */
export function randomBytes(n: number): Uint8Array {
  return Crypto.getRandomBytes(n);
}

/**
 * Genera un salt aleatorio y lo devuelve como cadena hexadecimal.
 *
 * Se devuelve como hex (no como bytes crudos) porque `@sphereon/react-native-argon2`
 * consume el salt como una cadena y usa sus bytes UTF-8. Una cadena hex es ASCII,
 * estable entre plataformas y fácil de persistir. Con `SALT_BYTES` = 16 bytes de
 * entropía real → 32 caracteres hex.
 */
export function generateSaltHex(): string {
  return bytesToHex(randomBytes(SALT_BYTES));
}

/** Genera un identificador único (UUID v4) para un usuario/registro. */
export function randomUUID(): string {
  return Crypto.randomUUID();
}
