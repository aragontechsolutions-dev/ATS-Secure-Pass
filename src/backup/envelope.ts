/**
 * Formato del archivo de backup (sobre auto-contenido). Lógica PURA (testeable).
 *
 * El backup incluye la BD SQLCipher (cifrada, en base64) MÁS los metadatos no
 * secretos necesarios para re-derivar la clave (salt + parámetros Argon2id). Sin
 * ellos, el `.db` sería inservible tras restaurar. Sigue siendo zero-knowledge:
 * sin la contraseña maestra no se puede descifrar la BD.
 */
import { isHex } from '../crypto/encoding';
import { validateArgon2idParams, type Argon2idParams } from '../crypto/params';
import { BackupError } from './errors';

export const BACKUP_FORMAT = 'ats-secure-pass-backup';
export const BACKUP_VERSION = 1;

export interface BackupUserMeta {
  displayName: string;
  saltHex: string;
  kdf: Argon2idParams;
}

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: number;
  user: BackupUserMeta;
  /** Archivo SQLCipher completo, codificado en base64. */
  dbBase64: string;
}

/** Construye el sobre y lo serializa a JSON. */
export function buildEnvelope(user: BackupUserMeta, dbBase64: string): string {
  validateArgon2idParams(user.kdf);
  const envelope: BackupEnvelope = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    user: {
      displayName: user.displayName,
      saltHex: user.saltHex,
      kdf: user.kdf,
    },
    dbBase64,
  };
  return JSON.stringify(envelope);
}

/**
 * Parsea y valida un sobre de backup. Lanza `BackupError('INVALID_BACKUP')` si
 * el contenido no es un backup válido de esta app.
 */
export function parseEnvelope(text: string): BackupEnvelope {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new BackupError('INVALID_BACKUP', 'El archivo no es un backup válido (JSON inválido).', {
      cause: err,
    });
  }

  const fail = (msg: string): never => {
    throw new BackupError('INVALID_BACKUP', msg);
  };

  if (typeof raw !== 'object' || raw === null) fail('Backup con estructura inesperada.');
  const obj = raw as Record<string, unknown>;

  if (obj.format !== BACKUP_FORMAT) fail('El archivo no es un backup de ATS Secure Pass.');
  if (obj.version !== BACKUP_VERSION) fail(`Versión de backup no soportada: ${String(obj.version)}.`);
  if (typeof obj.dbBase64 !== 'string' || obj.dbBase64.length === 0) fail('El backup no contiene la base de datos.');
  if (typeof obj.createdAt !== 'number') fail('El backup no tiene fecha de creación.');

  const user = obj.user as Record<string, unknown> | undefined;
  if (!user || typeof user !== 'object') fail('El backup no contiene metadatos de usuario.');
  const u = user as Record<string, unknown>;
  if (typeof u.displayName !== 'string' || u.displayName.trim() === '') fail('Nombre de usuario inválido en el backup.');
  if (typeof u.saltHex !== 'string' || !isHex(u.saltHex)) fail('Salt inválido en el backup.');

  try {
    validateArgon2idParams(u.kdf as Argon2idParams);
  } catch (err) {
    throw new BackupError('INVALID_BACKUP', 'Parámetros KDF inválidos en el backup.', { cause: err });
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: obj.createdAt as number,
    user: {
      displayName: (u.displayName as string).trim(),
      saltHex: u.saltHex as string,
      kdf: u.kdf as Argon2idParams,
    },
    dbBase64: obj.dbBase64 as string,
  };
}
