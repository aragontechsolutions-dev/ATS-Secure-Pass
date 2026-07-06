import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  constantTimeEqual,
  hexToBytes,
  isHex,
  utf8ToBytes,
  zeroBytes,
} from '../src/crypto/encoding';

test('hex roundtrip', () => {
  const bytes = new Uint8Array([0x00, 0x0f, 0xff, 0xa5, 0x10]);
  const hex = bytesToHex(bytes);
  assert.equal(hex, '000fffa510');
  assert.deepEqual([...hexToBytes(hex)], [...bytes]);
});

test('hexToBytes rechaza entradas inválidas', () => {
  assert.throws(() => hexToBytes('abc')); // longitud impar
  assert.throws(() => hexToBytes('zz')); // no hex
});

test('isHex', () => {
  assert.equal(isHex('00ff'), true);
  assert.equal(isHex('0f0'), false); // impar
  assert.equal(isHex('gg'), false);
  assert.equal(isHex(''), true);
});

// Vectores estándar RFC 4648.
const b64Vectors: [string, string][] = [
  ['', ''],
  ['f', 'Zg=='],
  ['fo', 'Zm8='],
  ['foo', 'Zm9v'],
  ['foob', 'Zm9vYg=='],
  ['fooba', 'Zm9vYmE='],
  ['foobar', 'Zm9vYmFy'],
];

test('bytesToBase64 coincide con vectores RFC 4648', () => {
  for (const [input, expected] of b64Vectors) {
    assert.equal(bytesToBase64(utf8ToBytes(input)), expected, `encode "${input}"`);
  }
});

test('base64ToBytes coincide con vectores RFC 4648', () => {
  for (const [input, expected] of b64Vectors) {
    assert.deepEqual(
      [...base64ToBytes(expected)],
      [...utf8ToBytes(input)],
      `decode "${expected}"`
    );
  }
});

test('base64 roundtrip para bytes arbitrarios', () => {
  for (let len = 0; len < 40; len++) {
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = (i * 37 + 11) & 0xff;
    const decoded = base64ToBytes(bytesToBase64(bytes));
    assert.deepEqual([...decoded], [...bytes], `len=${len}`);
  }
});

test('constantTimeEqual', () => {
  assert.equal(constantTimeEqual('abc', 'abc'), true);
  assert.equal(constantTimeEqual('abc', 'abd'), false);
  assert.equal(constantTimeEqual('abc', 'ab'), false); // longitudes distintas
  assert.equal(constantTimeEqual('', ''), true);
});

test('zeroBytes limpia el buffer', () => {
  const b = new Uint8Array([1, 2, 3, 4]);
  zeroBytes(b);
  assert.deepEqual([...b], [0, 0, 0, 0]);
});
