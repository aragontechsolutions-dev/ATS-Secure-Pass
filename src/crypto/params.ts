/**
 * Parámetros de derivación de clave (KDF) y del cifrado simétrico.
 *
 * Módulo puro (sin dependencias nativas) para poder validar y testear la
 * lógica de parámetros de forma determinista. Las cifras provienen de la
 * OWASP Password Storage Cheat Sheet.
 *
 * IMPORTANTE: estos son mínimos de arranque. En la Etapa 1 hay que
 * BENCHMARQUEAR en el hardware objetivo (`benchmarkArgon2id`) y ajustar
 * `memoryKiB`/`iterations` para apuntar a 250–400 ms por derivación. No copies
 * números a ciegas: los mínimos OWASP suben con el tiempo.
 */

/**
 * Longitud del salt aleatorio en bytes. El módulo nativo de Argon2 fuerza un
 * salt de 32 bytes (ver `argon2Salt.ts`), muy por encima del mínimo OWASP (16).
 */
export const SALT_BYTES = 32;

/** Longitud de la clave derivada (DEK) en bytes → AES-256. */
export const DEK_BYTES = 32;

/** Versión de Argon2 (0x13 = 19), la actual. */
export const ARGON2_VERSION = 19;

export type KdfAlgorithm = 'argon2id';

/**
 * Descriptor serializable de los parámetros Argon2id de un usuario.
 * Se persiste (en claro; no es secreto) junto al salt para poder re-derivar
 * la DEK a partir del master password.
 */
export interface Argon2idParams {
  readonly algorithm: KdfAlgorithm;
  /** `m`: memoria en KiB. */
  readonly memoryKiB: number;
  /** `t`: número de iteraciones/pasadas. */
  readonly iterations: number;
  /** `p`: grado de paralelismo. */
  readonly parallelism: number;
  /** Longitud de la clave derivada en bytes. */
  readonly hashLength: number;
  /** Versión de Argon2. */
  readonly version: number;
}

/**
 * Perfil OWASP "equilibrado": m=19 MiB, t=2, p=1.
 * OWASP lo cita como configuración mínima con nivel de defensa equivalente al
 * perfil m=47 MiB/t=1; la diferencia es un trade-off CPU vs RAM.
 * Buen punto de partida para gama media/baja de Android.
 */
export const OWASP_ARGON2ID_BALANCED: Argon2idParams = {
  algorithm: 'argon2id',
  memoryKiB: 19456, // 19 MiB
  iterations: 2,
  parallelism: 1,
  hashLength: DEK_BYTES,
  version: ARGON2_VERSION,
};

/**
 * Perfil OWASP "high-memory": m=46 MiB, t=1, p=1.
 * Alternativa con la misma defensa pero más RAM y menos CPU.
 */
export const OWASP_ARGON2ID_HIGH_MEMORY: Argon2idParams = {
  algorithm: 'argon2id',
  memoryKiB: 47104, // 46 MiB
  iterations: 1,
  parallelism: 1,
  hashLength: DEK_BYTES,
  version: ARGON2_VERSION,
};

/** Parámetros por defecto usados al crear un nuevo usuario. */
export const DEFAULT_ARGON2ID_PARAMS: Argon2idParams = OWASP_ARGON2ID_BALANCED;

/** Ventana objetivo (ms) para una derivación en el dispositivo objetivo. */
export const TARGET_KDF_MIN_MS = 250;
export const TARGET_KDF_MAX_MS = 400;

/**
 * Valida un descriptor de parámetros Argon2id. Lanza `Error` con mensaje
 * claro si algún valor está fuera de los rangos seguros/soportados.
 */
export function validateArgon2idParams(p: Argon2idParams): void {
  if (p.algorithm !== 'argon2id') {
    throw new Error(`KDF no soportado: ${p.algorithm} (solo argon2id)`);
  }
  if (!Number.isInteger(p.memoryKiB) || p.memoryKiB < 8192) {
    throw new Error(`memoryKiB inseguro/ inválido: ${p.memoryKiB} (mínimo 8192 KiB)`);
  }
  if (!Number.isInteger(p.iterations) || p.iterations < 1) {
    throw new Error(`iterations inválido: ${p.iterations} (mínimo 1)`);
  }
  if (!Number.isInteger(p.parallelism) || p.parallelism < 1) {
    throw new Error(`parallelism inválido: ${p.parallelism} (mínimo 1)`);
  }
  if (p.hashLength !== DEK_BYTES) {
    throw new Error(`hashLength debe ser ${DEK_BYTES} bytes para AES-256, recibido ${p.hashLength}`);
  }
  if (p.version !== ARGON2_VERSION) {
    throw new Error(`version de Argon2 no soportada: ${p.version} (esperado ${ARGON2_VERSION})`);
  }
}

/**
 * Comprueba que una cadena es una clave hexadecimal raw válida para usar como
 * clave directa de SQLCipher: exactamente `DEK_BYTES` bytes (64 hex chars).
 */
export function isRawKeyHex(hex: string): boolean {
  return /^[0-9a-fA-F]+$/.test(hex) && hex.length === DEK_BYTES * 2;
}
