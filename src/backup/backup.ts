/**
 * Exportación de la bóveda a un archivo de backup.
 *
 * Dos destinos:
 *  - `exportVault`: abre el diálogo de compartir (`expo-sharing`) → Drive, correo,
 *    "Guardar en Archivos", etc.
 *  - `saveVaultToDevice`: deja elegir una carpeta del teléfono (Storage Access
 *    Framework vía `Directory.pickDirectoryAsync`) y guarda ahí el archivo.
 *
 * En ambos casos: `PRAGMA wal_checkpoint(FULL)` para volcar el WAL → leer el `.db`
 * (ya cifrado con SQLCipher) en base64 → empaquetar en el sobre JSON. Nunca se
 * exporta nada descifrado.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { VaultSession } from '../vault/vaultManager';
import { buildEnvelope, type BackupUserMeta } from './envelope';
import { BackupError } from './errors';

/** Normaliza una ruta de archivo a URI `file://`. */
function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 40) || 'vault';
}

function dateStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Genera el sobre JSON y el nombre de archivo a partir de la sesión abierta. */
async function prepareEnvelope(
  session: VaultSession,
  user: BackupUserMeta
): Promise<{ envelope: string; outName: string }> {
  try {
    await session.db.execAsync('PRAGMA wal_checkpoint(FULL)');
    const dbFile = new File(toFileUri(session.db.databasePath));
    if (!dbFile.exists) {
      throw new BackupError('EXPORT_FAILED', 'No se encontró el archivo de la base de datos.');
    }
    const dbBase64 = await dbFile.base64();
    const envelope = buildEnvelope(user, dbBase64);
    const outName = `ATS-SecurePass-${sanitize(user.displayName)}-${dateStamp()}.json`;
    return { envelope, outName };
  } catch (err) {
    if (err instanceof BackupError) throw err;
    throw new BackupError('EXPORT_FAILED', err instanceof Error ? err.message : String(err), {
      cause: err,
    });
  }
}

/**
 * Exporta la bóveda y abre el diálogo de compartir del sistema.
 */
export async function exportVault(session: VaultSession, user: BackupUserMeta): Promise<void> {
  const { envelope, outName } = await prepareEnvelope(session, user);
  try {
    const outFile = new File(Paths.cache, outName);
    if (outFile.exists) outFile.delete();
    outFile.create();
    outFile.write(envelope);

    if (!(await Sharing.isAvailableAsync())) {
      throw new BackupError('SHARING_UNAVAILABLE', 'Compartir no está disponible en este dispositivo.');
    }
    await Sharing.shareAsync(outFile.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Guardar backup de ATS Secure Pass',
      UTI: 'public.json',
    });
  } catch (err) {
    if (err instanceof BackupError) throw err;
    throw new BackupError('EXPORT_FAILED', err instanceof Error ? err.message : String(err), {
      cause: err,
    });
  }
}

/**
 * Guarda la bóveda en una carpeta del teléfono elegida por el usuario (SAF).
 * Devuelve el nombre del archivo guardado, o `null` si el usuario cancela la
 * selección de carpeta.
 */
export async function saveVaultToDevice(
  session: VaultSession,
  user: BackupUserMeta
): Promise<string | null> {
  const { envelope, outName } = await prepareEnvelope(session, user);

  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    return null; // el usuario canceló el selector de carpeta
  }

  try {
    const file = dir.createFile(outName, 'application/json');
    file.write(envelope);
    return outName;
  } catch (err) {
    throw new BackupError('EXPORT_FAILED', err instanceof Error ? err.message : String(err), {
      cause: err,
    });
  }
}
