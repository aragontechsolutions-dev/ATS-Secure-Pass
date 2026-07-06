/**
 * Derivación de clave con Argon2id.
 *
 * El master password NUNCA se usa directamente como clave de cifrado. Se pasa
 * por Argon2id (memory-hard, lento) para obtener la DEK (Data Encryption Key)
 * de 32 bytes que cifra la base de datos SQLCipher.
 *
 * SEGURIDAD:
 *  - Nunca registrar (`console.log`) ni persistir la DEK ni el master password.
 *  - La DEK devuelta es material de clave: manéjala el mínimo tiempo posible y
 *    límpiala al bloquear la app.
 */
import argon2 from '@sphereon/react-native-argon2';

import { Argon2idParams, isRawKeyHex, validateArgon2idParams } from './params';

/**
 * Deriva la DEK (en hexadecimal) a partir del master password y el salt.
 *
 * @param masterPassword Contraseña maestra del usuario (en claro, transitoria).
 * @param saltHex        Salt hexadecimal generado con `generateSaltHex`.
 * @param params         Parámetros Argon2id del usuario.
 * @returns              La DEK como cadena hex de 64 caracteres (32 bytes).
 */
export async function deriveDek(
  masterPassword: string,
  saltHex: string,
  params: Argon2idParams
): Promise<string> {
  validateArgon2idParams(params);
  if (!masterPassword) {
    throw new Error('deriveDek: el master password no puede estar vacío');
  }

  const result = await argon2(masterPassword, saltHex, {
    iterations: params.iterations,
    memory: params.memoryKiB,
    parallelism: params.parallelism,
    hashLength: params.hashLength,
    mode: 'argon2id',
  });

  const dekHex = result.rawHash.toLowerCase();
  if (!isRawKeyHex(dekHex)) {
    throw new Error(
      `deriveDek: la DEK derivada no tiene el formato esperado (64 hex chars)`
    );
  }
  // Nota: `result.encodedHash` contiene EXACTAMENTE los mismos bytes que la DEK
  // (base64). Por eso NO se persiste: hacerlo equivaldría a guardar la clave en
  // claro. La verificación del master password se delega a SQLCipher.
  return dekHex;
}

/** Resultado de un benchmark de derivación. */
export interface KdfBenchmark {
  params: Argon2idParams;
  durationMs: number;
}

/**
 * Mide cuánto tarda una derivación Argon2id con los parámetros dados en el
 * dispositivo actual. Úsalo para calibrar `memoryKiB`/`iterations` a la ventana
 * objetivo (250–400 ms) antes de fijar los parámetros de producción.
 */
export async function benchmarkArgon2id(
  params: Argon2idParams,
  samplePassword = 'benchmark-password'
): Promise<KdfBenchmark> {
  validateArgon2idParams(params);
  // Salt fijo de 32 hex chars solo para el benchmark (no se persiste).
  const salt = '00112233445566778899aabbccddeeff';
  const start = Date.now();
  await argon2(samplePassword, salt, {
    iterations: params.iterations,
    memory: params.memoryKiB,
    parallelism: params.parallelism,
    hashLength: params.hashLength,
    mode: 'argon2id',
  });
  return { params, durationMs: Date.now() - start };
}
