/**
 * Exportación de la bóveda a un archivo de backup compartible.
 *
 * Flujo: `PRAGMA wal_checkpoint(FULL)` para volcar el WAL al archivo principal →
 * leer el `.db` (ya cifrado con SQLCipher) en base64 → empaquetar en el sobre
 * JSON con los metadatos (salt/params) → compartir con `expo-sharing`.
 *
 * El archivo resultante sigue estando cifrado: solo se abre con la contraseña
 * maestra del usuario. NO exportamos nada descifrado.
 */
import { File, Paths } from 'expo-file-system';
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

/**
 * Exporta la bóveda de la sesión activa y abre el diálogo de compartir.
 * `user` aporta los metadatos no secretos (salt/params) que se guardan en el
 * sobre para poder re-derivar la clave al restaurar.
 */
export async function exportVault(session: VaultSession, user: BackupUserMeta): Promise<void> {
  try {
    await session.db.execAsync('PRAGMA wal_checkpoint(FULL)');

    const dbFile = new File(toFileUri(session.db.databasePath));
    if (!dbFile.exists) {
      throw new BackupError('EXPORT_FAILED', 'No se encontró el archivo de la base de datos.');
    }
    const dbBase64 = await dbFile.base64();
    const envelope = buildEnvelope(user, dbBase64);

    const outName = `ATS-SecurePass-${sanitize(user.displayName)}-${dateStamp()}.json`;
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
