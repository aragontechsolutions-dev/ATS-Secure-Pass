/**
 * Esquema de la base de datos de una bóveda (una BD SQLCipher por usuario).
 *
 * El aislamiento entre usuarios es CRIPTOGRÁFICO (una clave distinta por BD),
 * no lógico. Por eso NO hay columna `user_id`: cada archivo `.db` contiene solo
 * las credenciales de su dueño y solo se abre con su DEK.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

/** Versión actual del esquema. Incrementar al añadir migraciones. */
export const SCHEMA_VERSION = 1;

/**
 * Sentencias que crean el esquema desde cero (idempotentes).
 * `credentials` es la tabla principal de la bóveda.
 */
const CREATE_STATEMENTS = `
CREATE TABLE IF NOT EXISTS credentials (
  id           TEXT PRIMARY KEY NOT NULL,
  title        TEXT NOT NULL,
  username     TEXT,
  password     TEXT NOT NULL,
  url          TEXT,
  notes        TEXT,
  icon         TEXT,
  category     TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credentials_title ON credentials(title);
CREATE INDEX IF NOT EXISTS idx_credentials_category ON credentials(category);
`;

/**
 * Aplica el esquema y ejecuta migraciones incrementales usando
 * `PRAGMA user_version`. Debe llamarse con la BD ya desbloqueada (clave puesta).
 */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const current = row?.user_version ?? 0;

  if (current >= SCHEMA_VERSION) {
    return;
  }

  await db.withExclusiveTransactionAsync(async () => {
    if (current < 1) {
      await db.execAsync(CREATE_STATEMENTS);
    }
    // Migraciones futuras: if (current < 2) { ... }
  });

  // `PRAGMA user_version` no admite parámetros vinculados; el valor es una
  // constante controlada por nosotros, no entrada del usuario.
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
