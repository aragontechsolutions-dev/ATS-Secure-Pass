/**
 * Restauración de una bóveda desde un archivo de backup.
 *
 * Flujo: elegir archivo con `expo-document-picker` → parsear/validar el sobre →
 * escribir el `.db` cifrado en el directorio de SQLite con un id de usuario nuevo
 * → registrar el usuario en el manifiesto (salt/params del sobre). El usuario
 * luego desbloquea con su contraseña maestra.
 *
 * Se genera un id nuevo (no se sobrescribe ninguna bóveda existente) y el nombre
 * se hace único si ya existe.
 */
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File } from 'expo-file-system';
import { defaultDatabaseDirectory } from 'expo-sqlite';

import { base64ToBytes } from '../crypto/encoding';
import { randomUUID } from '../crypto/random';
import { databaseNameForUser } from '../db/database';
import { addUser, displayNameTaken } from '../vault/manifest';
import { parseEnvelope } from './envelope';
import { BackupError } from './errors';

export interface RestoreResult {
  userId: string;
  displayName: string;
}

function toDirUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/** Encuentra un nombre visible libre a partir del nombre del backup. */
async function uniqueDisplayName(base: string): Promise<string> {
  if (!(await displayNameTaken(base))) return base;
  let candidate = `${base} (restaurada)`;
  let n = 2;
  while (await displayNameTaken(candidate)) {
    candidate = `${base} (restaurada ${n})`;
    n += 1;
  }
  return candidate;
}

/**
 * Abre el selector de archivos y restaura la bóveda elegida. Devuelve el nuevo
 * usuario, o `null` si el usuario cancela la selección.
 */
export async function restoreVault(): Promise<RestoreResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled) return null;

  const asset = picked.assets[0];
  if (!asset) return null;

  let text: string;
  try {
    text = await new File(asset.uri).text();
  } catch (err) {
    throw new BackupError('IMPORT_FAILED', 'No se pudo leer el archivo seleccionado.', { cause: err });
  }

  // Lanza BackupError('INVALID_BACKUP') si no es un backup válido.
  const env = parseEnvelope(text);

  const userId = randomUUID();
  const displayName = await uniqueDisplayName(env.user.displayName);

  try {
    const dir = new Directory(toDirUri(defaultDatabaseDirectory));
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });

    const dbName = databaseNameForUser(userId);
    const dbFile = new File(dir, dbName);
    if (dbFile.exists) dbFile.delete();
    dbFile.create();
    dbFile.write(base64ToBytes(env.dbBase64));

    // Elimina posibles journals sueltos (no deberían existir para un id nuevo).
    for (const suffix of ['-wal', '-shm']) {
      const journal = new File(dir, `${dbName}${suffix}`);
      if (journal.exists) journal.delete();
    }

    await addUser({
      id: userId,
      displayName,
      saltHex: env.user.saltHex,
      kdf: env.user.kdf,
      createdAt: env.createdAt,
      biometricEnabled: false,
    });
  } catch (err) {
    if (err instanceof BackupError) throw err;
    throw new BackupError('IMPORT_FAILED', err instanceof Error ? err.message : String(err), {
      cause: err,
    });
  }

  return { userId, displayName };
}
