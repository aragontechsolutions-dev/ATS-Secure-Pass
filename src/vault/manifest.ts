/**
 * Manifiesto de usuarios: metadatos NO secretos necesarios para re-derivar la
 * DEK de cada usuario (salt + parámetros Argon2id) y para el selector de
 * usuarios (Etapa 2).
 *
 * SEGURIDAD: aquí NO se guarda ni el master password ni la DEK. El salt no es
 * secreto (OWASP). El aislamiento real lo da que cada BD está cifrada con una
 * clave distinta.
 *
 * Se persiste como JSON en el directorio de documentos de la app. Nota: este
 * archivo NO está cifrado; contiene solo metadatos públicos.
 */
import { Directory, File, Paths } from 'expo-file-system';

import type { Argon2idParams } from '../crypto/params';
import { VaultError } from '../db/errors';

/** Entrada de un usuario en el manifiesto. */
export interface UserRecord {
  id: string;
  displayName: string;
  saltHex: string;
  kdf: Argon2idParams;
  createdAt: number;
  /** Si la DEK está guardada tras biometría (secure-store). No es secreto. */
  biometricEnabled?: boolean;
}

interface ManifestFile {
  version: 1;
  users: UserRecord[];
}

const APP_DIR = 'ats-secure-pass';
const MANIFEST_NAME = 'users.json';

function manifestFile(): File {
  return new File(Paths.document, APP_DIR, MANIFEST_NAME);
}

function ensureAppDir(): void {
  const dir = new Directory(Paths.document, APP_DIR);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
}

/** Lee el manifiesto completo (o uno vacío si aún no existe). */
export async function readManifest(): Promise<ManifestFile> {
  const file = manifestFile();
  if (!file.exists) {
    return { version: 1, users: [] };
  }
  try {
    const raw = await file.text();
    const parsed = JSON.parse(raw) as ManifestFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.users)) {
      throw new Error('estructura inesperada');
    }
    return parsed;
  } catch (err) {
    throw new VaultError('MANIFEST_CORRUPT', 'El manifiesto de usuarios está corrupto.', {
      cause: err,
    });
  }
}

async function writeManifest(manifest: ManifestFile): Promise<void> {
  ensureAppDir();
  const file = manifestFile();
  if (!file.exists) {
    file.create({ intermediates: true, overwrite: true });
  }
  file.write(JSON.stringify(manifest, null, 2));
}

/** Devuelve la lista de usuarios registrados (para el selector). */
export async function listUsers(): Promise<UserRecord[]> {
  return (await readManifest()).users;
}

/** Devuelve un usuario por id, o `null`. */
export async function getUser(id: string): Promise<UserRecord | null> {
  const { users } = await readManifest();
  return users.find((u) => u.id === id) ?? null;
}

/** Comprueba si ya existe un usuario con ese nombre visible (case-insensitive). */
export async function displayNameTaken(displayName: string): Promise<boolean> {
  const { users } = await readManifest();
  const target = displayName.trim().toLowerCase();
  return users.some((u) => u.displayName.trim().toLowerCase() === target);
}

/** Añade un usuario al manifiesto. */
export async function addUser(record: UserRecord): Promise<void> {
  const manifest = await readManifest();
  if (manifest.users.some((u) => u.id === record.id)) {
    throw new VaultError('USER_ALREADY_EXISTS', `Ya existe un usuario con id ${record.id}.`);
  }
  manifest.users.push(record);
  await writeManifest(manifest);
}

/** Actualiza los metadatos de un usuario (p. ej. salt/kdf tras cambio de clave). */
export async function updateUser(id: string, patch: Partial<UserRecord>): Promise<void> {
  const manifest = await readManifest();
  const idx = manifest.users.findIndex((u) => u.id === id);
  if (idx === -1) {
    throw new VaultError('USER_NOT_FOUND', `No existe el usuario ${id}.`);
  }
  manifest.users[idx] = { ...manifest.users[idx], ...patch, id };
  await writeManifest(manifest);
}

/** Elimina un usuario del manifiesto (no borra su archivo de BD). */
export async function removeUser(id: string): Promise<void> {
  const manifest = await readManifest();
  manifest.users = manifest.users.filter((u) => u.id !== id);
  await writeManifest(manifest);
}
