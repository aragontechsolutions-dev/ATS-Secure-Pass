import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_ARGON2ID_PARAMS,
  DEK_BYTES,
  isRawKeyHex,
  OWASP_ARGON2ID_BALANCED,
  OWASP_ARGON2ID_HIGH_MEMORY,
  SALT_BYTES,
  validateArgon2idParams,
  type Argon2idParams,
} from '../src/crypto/params';

test('constantes de tamaño', () => {
  assert.equal(SALT_BYTES, 16);
  assert.equal(DEK_BYTES, 32);
});

test('los perfiles OWASP son válidos', () => {
  assert.doesNotThrow(() => validateArgon2idParams(OWASP_ARGON2ID_BALANCED));
  assert.doesNotThrow(() => validateArgon2idParams(OWASP_ARGON2ID_HIGH_MEMORY));
  assert.doesNotThrow(() => validateArgon2idParams(DEFAULT_ARGON2ID_PARAMS));
});

test('el perfil equilibrado coincide con el mínimo OWASP (m=19MiB, t=2, p=1)', () => {
  assert.equal(OWASP_ARGON2ID_BALANCED.memoryKiB, 19456);
  assert.equal(OWASP_ARGON2ID_BALANCED.iterations, 2);
  assert.equal(OWASP_ARGON2ID_BALANCED.parallelism, 1);
  assert.equal(OWASP_ARGON2ID_BALANCED.hashLength, 32);
});

test('validateArgon2idParams rechaza memoria insuficiente', () => {
  const bad: Argon2idParams = { ...OWASP_ARGON2ID_BALANCED, memoryKiB: 4096 };
  assert.throws(() => validateArgon2idParams(bad), /memoryKiB/);
});

test('validateArgon2idParams rechaza iterations < 1', () => {
  const bad: Argon2idParams = { ...OWASP_ARGON2ID_BALANCED, iterations: 0 };
  assert.throws(() => validateArgon2idParams(bad), /iterations/);
});

test('validateArgon2idParams exige hashLength de 32 bytes', () => {
  const bad: Argon2idParams = { ...OWASP_ARGON2ID_BALANCED, hashLength: 16 };
  assert.throws(() => validateArgon2idParams(bad), /hashLength/);
});

test('validateArgon2idParams rechaza algoritmos no argon2id', () => {
  const bad = { ...OWASP_ARGON2ID_BALANCED, algorithm: 'argon2i' } as unknown as Argon2idParams;
  assert.throws(() => validateArgon2idParams(bad));
});

test('isRawKeyHex exige exactamente 64 caracteres hex', () => {
  assert.equal(isRawKeyHex('a'.repeat(64)), true);
  assert.equal(isRawKeyHex('A'.repeat(64)), true);
  assert.equal(isRawKeyHex('a'.repeat(63)), false);
  assert.equal(isRawKeyHex('a'.repeat(66)), false);
  assert.equal(isRawKeyHex('z'.repeat(64)), false);
});
