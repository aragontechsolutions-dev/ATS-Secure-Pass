/**
 * Codificación del salt para `@sphereon/react-native-argon2`.
 *
 * ⚠️ El módulo nativo NO trata el salt como bytes UTF-8. En Android hace:
 *
 *     byte[] in = new BigInteger(salt, 16).toByteArray();   // salt = número hex
 *     byte[] saltBytes = new byte[32];
 *     System.arraycopy(in, in.length - 32, saltBytes, 0, 32); // toma los últimos 32
 *
 * Es decir: el salt debe ser una cadena HEX que, interpretada como BigInteger y
 * convertida a bytes, tenga longitud ≥ 32. Si es más corta, `in.length - 32` es
 * negativo → ArrayIndexOutOfBounds (el bug "srcPos=-16").
 *
 * Para obtener un salt efectivo de 32 bytes aleatorios de forma robusta,
 * anteponemos un byte 0x01 (no cero) a los 32 bytes: así `toByteArray()` mide
 * exactamente 33 bytes y sus últimos 32 son justo nuestros bytes aleatorios,
 * sea cual sea su contenido (incluido un 0x00 inicial).
 *
 * NOTA DE PORTABILIDAD: en iOS (CatCrypto) el salt se consume como UTF-8, por lo
 * que este mismo string produciría otro salt. La app apunta a Android; si se
 * añade iOS habrá que unificar el manejo del salt (p. ej. parcheando el módulo
 * nativo).
 */
import { bytesToHex } from './encoding';

/** Bytes de salt efectivos que usa Argon2 (el módulo nativo fuerza 32). */
export const ARGON2_SALT_BYTES = 32;

/** Byte de relleno inicial que garantiza longitud ≥ 32 tras `toByteArray()`. */
const FRAMING_BYTE = 0x01;

/**
 * Codifica 32 bytes de salt aleatorio al string hexadecimal que espera el
 * módulo nativo (Android). Devuelve 66 caracteres hex (1 byte de framing + 32).
 */
export function encodeArgon2Salt(saltBytes: Uint8Array): string {
  if (saltBytes.length !== ARGON2_SALT_BYTES) {
    throw new Error(
      `encodeArgon2Salt: se esperaban ${ARGON2_SALT_BYTES} bytes, recibidos ${saltBytes.length}`
    );
  }
  const framed = new Uint8Array(ARGON2_SALT_BYTES + 1);
  framed[0] = FRAMING_BYTE;
  framed.set(saltBytes, 1);
  return bytesToHex(framed);
}
