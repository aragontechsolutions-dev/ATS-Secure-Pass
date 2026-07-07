/**
 * Orquestador de la bóveda: crea usuarios, desbloquea y bloquea sesiones.
 *
 * Flujo criptográfico (Etapa 1):
 *  - Crear: master password → salt aleatorio → Argon2id → DEK → abrir/crear BD
 *    SQLCipher con esa DEK → guardar metadatos (salt, params) en el manifiesto.
 *  - Desbloquear: leer salt/params del manifiesto → re-derivar DEK → abrir BD
 *    (SQLCipher verifica la clave; si falla → master password incorrecto).
 *  - Bloquear: cerrar la BD. La DEK es transitoria y no se conserva en la sesión.
 *
 * Biometría (Etapa 3): la DEK se guarda protegida por el Keystore
 * (`secure-store` + `requireAuthentication`). La biometría DESBLOQUEA la DEK;
 * el fallback al master password es SIEMPRE obligatorio (los cambios de
 * enrolamiento biométrico invalidan la clave del Keystore).
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { deleteDek, readDek, storeDek } from '../auth/dekStore';
import { deriveDek } from '../crypto/kdf';
import { DEFAULT_ARGON2ID_PARAMS, type Argon2idParams } from '../crypto/params';
import { generateSaltHex, randomUUID } from '../crypto/random';
import { closeDatabase, openEncryptedDatabase } from '../db/database';
import { VaultError } from '../db/errors';
import { addUser, displayNameTaken, getUser, updateUser } from './manifest';

/** Sesión abierta de una bóveda. Contiene la conexión desbloqueada. */
export interface VaultSession {
  readonly userId: string;
  readonly displayName: string;
  readonly db: SQLiteDatabase;
}

export interface CreateVaultInput {
  displayName: string;
  masterPassword: string;
  /** Parámetros Argon2id; por defecto los de OWASP calibrables. */
  params?: Argon2idParams;
}

/**
 * Crea un nuevo usuario y su bóveda cifrada, devolviendo la sesión abierta.
 *
 * Aplica el principio de "sin credenciales por defecto" (OWASP M1): no hay
 * ningún master password preconfigurado; el usuario debe establecer el suyo.
 */
export async function createVault(input: CreateVaultInput): Promise<VaultSession> {
  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new VaultError('USER_ALREADY_EXISTS', 'El nombre de usuario no puede estar vacío.');
  }
  if (!input.masterPassword) {
    throw new VaultError('INVALID_MASTER_PASSWORD', 'La contraseña maestra no puede estar vacía.');
  }
  if (await displayNameTaken(displayName)) {
    throw new VaultError('USER_ALREADY_EXISTS', `Ya existe un usuario "${displayName}".`);
  }

  const params = input.params ?? DEFAULT_ARGON2ID_PARAMS;
  const userId = randomUUID();
  const saltHex = generateSaltHex();

  const dekHex = await deriveDek(input.masterPassword, saltHex, params);
  // Abrir crea el archivo cifrado y aplica el esquema.
  const db = await openEncryptedDatabase(userId, dekHex);

  try {
    await addUser({
      id: userId,
      displayName,
      saltHex,
      kdf: params,
      createdAt: Date.now(),
    });
  } catch (err) {
    await closeDatabase(db);
    throw err;
  }

  return { userId, displayName, db };
}

/**
 * Desbloquea la bóveda de un usuario con su master password.
 * Lanza `InvalidMasterPasswordError` si la contraseña es incorrecta y
 * `VaultError('USER_NOT_FOUND')` si el usuario no existe.
 */
export async function unlockVault(
  userId: string,
  masterPassword: string
): Promise<VaultSession> {
  const record = await getUser(userId);
  if (!record) {
    throw new VaultError('USER_NOT_FOUND', `No existe el usuario ${userId}.`);
  }

  const dekHex = await deriveDek(masterPassword, record.saltHex, record.kdf);
  const db = await openEncryptedDatabase(userId, dekHex);
  return { userId, displayName: record.displayName, db };
}

/** Bloquea la sesión: cierra la BD. La DEK ya no vive en memoria de JS. */
export async function lockVault(session: VaultSession): Promise<void> {
  await closeDatabase(session.db);
}

// ---------------------------------------------------------------------------
// Biometría (Etapa 3)
// ---------------------------------------------------------------------------

/**
 * Activa el desbloqueo biométrico para un usuario.
 *
 * Verifica el master password (deriva la DEK y abre/cierra la BD para confirmar
 * que es correcto), guarda la DEK protegida por biometría en el Keystore y marca
 * el flag en el manifiesto. En Android, guardar puede pedir autenticación
 * biométrica (se genera una clave fresca ligada a la biometría actual).
 *
 * Lanza `InvalidMasterPasswordError` si el master password es incorrecto, o
 * `BiometricUnlockError('unavailable')` si el dispositivo no tiene biometría
 * fuerte configurada.
 */
export async function enableBiometricUnlock(
  userId: string,
  masterPassword: string
): Promise<void> {
  const record = await getUser(userId);
  if (!record) {
    throw new VaultError('USER_NOT_FOUND', `No existe el usuario ${userId}.`);
  }

  const dekHex = await deriveDek(masterPassword, record.saltHex, record.kdf);
  // Verifica el master password antes de guardar nada (abre y cierra).
  const db = await openEncryptedDatabase(userId, dekHex);
  await closeDatabase(db);

  await storeDek(userId, dekHex);
  await updateUser(userId, { biometricEnabled: true });
}

/** Desactiva el desbloqueo biométrico: borra la DEK del Keystore y limpia el flag. */
export async function disableBiometricUnlock(userId: string): Promise<void> {
  await deleteDek(userId);
  await updateUser(userId, { biometricEnabled: false });
}

/**
 * Desbloquea la bóveda con biometría: lee la DEK de secure-store (el sistema
 * operativo exige la autenticación biométrica) y abre la BD.
 *
 * Lanza `BiometricUnlockError` si no se puede desbloquear con biometría (no
 * activada, cancelada, o clave invalidada por cambio de biometría). El llamador
 * DEBE caer entonces al desbloqueo por master password. Si el motivo es
 * `invalidated`, tras el desbloqueo por master password conviene re-activar la
 * biometría con `enableBiometricUnlock`.
 */
export async function unlockVaultWithBiometrics(userId: string): Promise<VaultSession> {
  const record = await getUser(userId);
  if (!record) {
    throw new VaultError('USER_NOT_FOUND', `No existe el usuario ${userId}.`);
  }

  const dekHex = await readDek(userId);
  const db = await openEncryptedDatabase(userId, dekHex);
  return { userId, displayName: record.displayName, db };
}
