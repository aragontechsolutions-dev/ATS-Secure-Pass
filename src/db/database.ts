/**
 * Apertura y gestión de bases de datos cifradas con SQLCipher vía expo-sqlite.
 *
 * REQUISITOS DE BUILD:
 *  - `expo-sqlite` debe compilarse con el config plugin `useSQLCipher: true`
 *    (ver app.json) y un development build (`expo prebuild` + `expo run:android`).
 *    SQLCipher NO funciona en Expo Go.
 *
 * MODELO DE CLAVE:
 *  - Usamos una clave RAW (32 bytes en hex) como clave directa de SQLCipher
 *    (`PRAGMA key = "x'<hex>'"`). Como ya derivamos la clave con Argon2id, NO
 *    queremos que SQLCipher aplique su propio PBKDF2 encima. Con exactamente 64
 *    caracteres hex, SQLCipher usa los bytes como clave sin derivación adicional.
 */
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { isRawKeyHex } from '../crypto/params';
import { InvalidMasterPasswordError, VaultError } from './errors';
import { migrate } from './schema';

/** Deriva el nombre de archivo de la BD de un usuario a partir de su id. */
export function databaseNameForUser(userId: string): string {
  return `vault_${userId}.db`;
}

/**
 * Abre una BD SQLCipher para un usuario y la deja lista (clave puesta, esquema
 * migrado). Verifica la clave leyendo el catálogo; si la DEK es incorrecta
 * lanza `InvalidMasterPasswordError`.
 *
 * @param userId Identificador del usuario (define el archivo).
 * @param dekHex DEK en hexadecimal (64 chars) derivada del master password.
 */
export async function openEncryptedDatabase(
  userId: string,
  dekHex: string
): Promise<SQLiteDatabase> {
  if (!isRawKeyHex(dekHex)) {
    throw new VaultError('DB_OPEN_FAILED', 'La DEK no es una clave raw hex válida.');
  }

  const dbName = databaseNameForUser(userId);
  // `useNewConnection` evita reutilizar una conexión cacheada (p. ej. de una
  // sesión anterior ya bloqueada) con una clave distinta.
  const db = await SQLite.openDatabaseAsync(dbName, { useNewConnection: true });

  try {
    await applyKey(db, dekHex);
    await verifyKey(db); // lanza InvalidMasterPasswordError si la clave falla
    // Endurecimiento en runtime: purga memoria sensible de SQLCipher tras cada uso.
    await db.execAsync('PRAGMA cipher_memory_security = ON');
    await migrate(db);
    return db;
  } catch (err) {
    // No dejar la conexión abierta si algo falló tras abrirla.
    await db.closeAsync().catch(() => undefined);
    throw err;
  }
}

/**
 * Aplica la clave raw a una conexión recién abierta. Debe ejecutarse antes de
 * cualquier otra sentencia sobre la BD cifrada.
 */
async function applyKey(db: SQLiteDatabase, dekHex: string): Promise<void> {
  // `dekHex` está validado como hex puro de 64 chars → no hay riesgo de inyección.
  await db.execAsync(`PRAGMA key = "x'${dekHex}'"`);
}

/**
 * Verifica que la clave aplicada descifra la BD. En SQLCipher, leer el catálogo
 * con una clave incorrecta falla (SQLITE_NOTADB / "file is not a database").
 */
async function verifyKey(db: SQLiteDatabase): Promise<void> {
  try {
    await db.getFirstAsync('SELECT count(*) AS n FROM sqlite_master');
  } catch (err) {
    throw new InvalidMasterPasswordError(err);
  }
}

/**
 * Re-cifra la BD con una nueva clave (cambio de master password).
 * La conexión `db` debe estar ya abierta y desbloqueada con la clave actual.
 * Reservado para la Etapa 3, pero incluido aquí por cohesión de la capa.
 */
export async function rekeyDatabase(db: SQLiteDatabase, newDekHex: string): Promise<void> {
  if (!isRawKeyHex(newDekHex)) {
    throw new VaultError('DB_OPEN_FAILED', 'La nueva DEK no es una clave raw hex válida.');
  }
  await db.execAsync(`PRAGMA rekey = "x'${newDekHex}'"`);
}

/** Cierra la conexión de forma segura (silencia errores de cierre). */
export async function closeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.closeAsync().catch(() => undefined);
}
