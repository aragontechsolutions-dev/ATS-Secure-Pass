import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ARGON2_SALT_BYTES, encodeArgon2Salt } from '../src/crypto/argon2Salt';
import { hexToBytes } from '../src/crypto/encoding';

/**
 * Réplica fiel de `java.math.BigInteger(salt, 16).toByteArray()` para un valor
 * positivo: bytes big-endian mínimos de la magnitud, con un 0x00 de signo
 * antepuesto si el bit alto del primer byte está a 1.
 */
function javaBigIntegerToByteArray(hex: string): Uint8Array {
  let v = BigInt('0x' + hex);
  if (v === 0n) return new Uint8Array([0]);
  const out: number[] = [];
  while (v > 0n) {
    out.unshift(Number(v & 0xffn));
    v >>= 8n;
  }
  if ((out[0] & 0x80) !== 0) out.unshift(0x00); // byte de signo (número positivo)
  return new Uint8Array(out);
}

/** Simula lo que hace el módulo nativo Android para obtener el salt efectivo. */
function androidEffectiveSalt(saltHex: string): Uint8Array {
  const input = javaBigIntegerToByteArray(saltHex);
  // System.arraycopy(input, input.length - 32, saltBytes, 0, 32)
  const srcPos = input.length - ARGON2_SALT_BYTES;
  assert.ok(srcPos >= 0, `underflow: input.length=${input.length}, srcPos=${srcPos}`);
  return input.subarray(srcPos, srcPos + ARGON2_SALT_BYTES);
}

test('encodeArgon2Salt exige exactamente 32 bytes', () => {
  assert.throws(() => encodeArgon2Salt(new Uint8Array(16)));
  assert.throws(() => encodeArgon2Salt(new Uint8Array(33)));
  assert.doesNotThrow(() => encodeArgon2Salt(new Uint8Array(32)));
});

test('la longitud codificada es 66 hex chars (33 bytes)', () => {
  const hex = encodeArgon2Salt(new Uint8Array(ARGON2_SALT_BYTES).fill(0xab));
  assert.equal(hex.length, 66);
});

test('el salt efectivo en Android coincide con los bytes originales (sin underflow)', () => {
  // Varios patrones, incluidos casos límite que rompían el esquema anterior.
  const patterns: Uint8Array[] = [
    new Uint8Array(32).fill(0x00), // todos ceros (byte inicial 0x00)
    new Uint8Array(32).fill(0xff), // bit alto siempre a 1
    Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 1) & 0xff),
    Uint8Array.from({ length: 32 }, (_, i) => (i === 0 ? 0x00 : (i * 13) & 0xff)),
  ];

  for (const salt of patterns) {
    const hex = encodeArgon2Salt(salt);
    const effective = androidEffectiveSalt(hex);
    assert.deepEqual([...effective], [...salt], `patrón ${[...salt.slice(0, 4)]}`);
  }
});

test('un salt de 16 bytes SÍ provocaría underflow (regresión del bug original)', () => {
  // El esquema viejo: 16 bytes en hex, sin framing → BigInteger da ≤16 bytes.
  const shortHex = '00112233445566778899aabbccddeeff'; // 16 bytes, byte inicial 0x00
  assert.throws(() => androidEffectiveSalt(shortHex), /underflow/);
  // Confirmamos que la corrección lo evita para el mismo contenido (16 bytes)
  // usando un salt válido de 32 bytes.
  assert.doesNotThrow(() => androidEffectiveSalt(encodeArgon2Salt(hexToBytes(shortHex + shortHex))));
});
