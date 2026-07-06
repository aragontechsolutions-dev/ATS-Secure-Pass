/**
 * Repositorio de credenciales sobre una BD SQLCipher desbloqueada.
 *
 * Todas las funciones reciben la conexión `db` ya abierta y con la clave puesta.
 * Se usan sentencias parametrizadas (nunca interpolación) para evitar inyección
 * SQL.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { randomUUID } from '../crypto/random';

export interface Credential {
  id: string;
  title: string;
  username: string | null;
  password: string;
  url: string | null;
  notes: string | null;
  icon: string | null;
  category: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Campos que aporta quien crea una credencial. */
export type NewCredential = Pick<Credential, 'title' | 'password'> &
  Partial<Pick<Credential, 'username' | 'url' | 'notes' | 'icon' | 'category'>>;

/** Campos actualizables de una credencial existente. */
export type CredentialUpdate = Partial<
  Pick<Credential, 'title' | 'username' | 'password' | 'url' | 'notes' | 'icon' | 'category'>
>;

interface CredentialRow {
  id: string;
  title: string;
  username: string | null;
  password: string;
  url: string | null;
  notes: string | null;
  icon: string | null;
  category: string | null;
  created_at: number;
  updated_at: number;
}

function rowToCredential(row: CredentialRow): Credential {
  return {
    id: row.id,
    title: row.title,
    username: row.username,
    password: row.password,
    url: row.url,
    notes: row.notes,
    icon: row.icon,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Inserta una nueva credencial y devuelve el registro creado. */
export async function createCredential(
  db: SQLiteDatabase,
  input: NewCredential
): Promise<Credential> {
  const now = Date.now();
  const cred: Credential = {
    id: randomUUID(),
    title: input.title,
    username: input.username ?? null,
    password: input.password,
    url: input.url ?? null,
    notes: input.notes ?? null,
    icon: input.icon ?? null,
    category: input.category ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    `INSERT INTO credentials
       (id, title, username, password, url, notes, icon, category, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    cred.id,
    cred.title,
    cred.username,
    cred.password,
    cred.url,
    cred.notes,
    cred.icon,
    cred.category,
    cred.createdAt,
    cred.updatedAt
  );

  return cred;
}

/** Devuelve todas las credenciales ordenadas por título. */
export async function listCredentials(db: SQLiteDatabase): Promise<Credential[]> {
  const rows = await db.getAllAsync<CredentialRow>(
    'SELECT * FROM credentials ORDER BY title COLLATE NOCASE ASC'
  );
  return rows.map(rowToCredential);
}

/** Devuelve una credencial por id, o `null` si no existe. */
export async function getCredential(
  db: SQLiteDatabase,
  id: string
): Promise<Credential | null> {
  const row = await db.getFirstAsync<CredentialRow>(
    'SELECT * FROM credentials WHERE id = ?',
    id
  );
  return row ? rowToCredential(row) : null;
}

/** Actualiza los campos indicados de una credencial. Devuelve filas afectadas. */
export async function updateCredential(
  db: SQLiteDatabase,
  id: string,
  patch: CredentialUpdate
): Promise<number> {
  const fields = Object.keys(patch) as (keyof CredentialUpdate)[];
  if (fields.length === 0) return 0;

  // Mapa de nombres de campo TS → columnas SQL (todas snake_case iguales aquí).
  const assignments = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => patch[f] ?? null);

  const result = await db.runAsync(
    `UPDATE credentials SET ${assignments}, updated_at = ? WHERE id = ?`,
    ...values,
    Date.now(),
    id
  );
  return result.changes;
}

/** Elimina una credencial. Devuelve el número de filas eliminadas. */
export async function deleteCredential(db: SQLiteDatabase, id: string): Promise<number> {
  const result = await db.runAsync('DELETE FROM credentials WHERE id = ?', id);
  return result.changes;
}

/** Cuenta las credenciales almacenadas. */
export async function countCredentials(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT count(*) AS n FROM credentials'
  );
  return row?.n ?? 0;
}
