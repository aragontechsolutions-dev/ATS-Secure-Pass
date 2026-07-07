import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OWASP_ARGON2ID_BALANCED } from '../src/crypto/params';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  buildEnvelope,
  parseEnvelope,
  type BackupUserMeta,
} from '../src/backup/envelope';
import { BackupError } from '../src/backup/errors';

const user: BackupUserMeta = {
  displayName: 'demo',
  saltHex: '01' + 'ab'.repeat(32), // 66 hex chars, como genera la app
  kdf: OWASP_ARGON2ID_BALANCED,
};

test('buildEnvelope → parseEnvelope round-trip', () => {
  const json = buildEnvelope(user, 'ZGItYnl0ZXM='); // "db-bytes" en base64
  const env = parseEnvelope(json);
  assert.equal(env.format, BACKUP_FORMAT);
  assert.equal(env.version, BACKUP_VERSION);
  assert.equal(env.user.displayName, 'demo');
  assert.equal(env.user.saltHex, user.saltHex);
  assert.equal(env.dbBase64, 'ZGItYnl0ZXM=');
  assert.equal(env.user.kdf.iterations, OWASP_ARGON2ID_BALANCED.iterations);
  assert.ok(env.createdAt > 0);
});

test('parseEnvelope rechaza JSON inválido', () => {
  assert.throws(() => parseEnvelope('no es json'), BackupError);
});

test('parseEnvelope rechaza formato incorrecto', () => {
  const bad = JSON.stringify({ format: 'otra-cosa', version: 1, dbBase64: 'x', createdAt: 1, user });
  assert.throws(() => parseEnvelope(bad), /no es un backup de ATS/);
});

test('parseEnvelope rechaza versión no soportada', () => {
  const bad = JSON.stringify({ format: BACKUP_FORMAT, version: 99, dbBase64: 'x', createdAt: 1, user });
  assert.throws(() => parseEnvelope(bad), /Versión de backup/);
});

test('parseEnvelope rechaza db ausente', () => {
  const bad = JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, dbBase64: '', createdAt: 1, user });
  assert.throws(() => parseEnvelope(bad), /no contiene la base de datos/);
});

test('parseEnvelope rechaza salt inválido', () => {
  const badUser = { ...user, saltHex: 'zzzz' };
  const bad = JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, dbBase64: 'x', createdAt: 1, user: badUser });
  assert.throws(() => parseEnvelope(bad), /Salt inválido/);
});

test('parseEnvelope rechaza KDF inválido', () => {
  const badUser = { ...user, kdf: { ...OWASP_ARGON2ID_BALANCED, memoryKiB: 100 } };
  const bad = JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, dbBase64: 'x', createdAt: 1, user: badUser });
  assert.throws(() => parseEnvelope(bad), /KDF inválidos/);
});
