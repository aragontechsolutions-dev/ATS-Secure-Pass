/**
 * Utilidades de codificación puras (sin dependencias nativas).
 *
 * Están aisladas a propósito: no importan `expo-crypto` ni ningún módulo
 * nativo, de modo que se pueden ejecutar y testear en Node (ver
 * `tests/encoding.test.ts`). Toda la lógica sensible de conversión de bytes
 * vive aquí para poder auditarla y probarla de forma determinista.
 */

const HEX_ALPHABET = '0123456789abcdef';
const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Convierte bytes a una cadena hexadecimal en minúsculas. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    hex += HEX_ALPHABET[(b >> 4) & 0x0f] + HEX_ALPHABET[b & 0x0f];
  }
  return hex;
}

/** Devuelve `true` si `value` es una cadena hexadecimal válida de longitud par. */
export function isHex(value: string): boolean {
  return value.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(value);
}

/** Convierte una cadena hexadecimal a bytes. Lanza si el formato es inválido. */
export function hexToBytes(hex: string): Uint8Array {
  if (!isHex(hex)) {
    throw new Error('hexToBytes: cadena hexadecimal inválida');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

/** Codifica bytes en base64 estándar (con relleno `=`). Implementación pura. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      BASE64_ALPHABET[(n >> 18) & 63] +
      BASE64_ALPHABET[(n >> 12) & 63] +
      BASE64_ALPHABET[(n >> 6) & 63] +
      BASE64_ALPHABET[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += BASE64_ALPHABET[(n >> 18) & 63] + BASE64_ALPHABET[(n >> 12) & 63] + '==';
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      BASE64_ALPHABET[(n >> 18) & 63] +
      BASE64_ALPHABET[(n >> 12) & 63] +
      BASE64_ALPHABET[(n >> 6) & 63] +
      '=';
  }
  return out;
}

/** Decodifica una cadena base64 estándar a bytes. Implementación pura. */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  // Cota superior de bytes: 6 bits por carácter base64.
  const out = new Uint8Array(Math.floor((clean.length * 6) / 8));
  let outIndex = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE64_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIndex++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, outIndex);
}

/** Codifica una cadena UTF-8 a bytes usando `TextEncoder` (disponible en RN/Node). */
export function utf8ToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Comparación en tiempo constante entre dos cadenas.
 *
 * Evita ataques de temporización al verificar secretos. Devuelve `false`
 * inmediatamente si las longitudes difieren (la longitud no es secreta).
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Sobrescribe un buffer de bytes con ceros (mitigación de residuos en memoria). */
export function zeroBytes(bytes: Uint8Array): void {
  bytes.fill(0);
}
