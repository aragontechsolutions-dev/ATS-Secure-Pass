/** Errores tipados de la capa de base de datos / bóveda. */

/** Código estable para distinguir errores en la UI/lógica de más alto nivel. */
export type VaultErrorCode =
  | 'INVALID_MASTER_PASSWORD'
  | 'DB_OPEN_FAILED'
  | 'USER_NOT_FOUND'
  | 'USER_ALREADY_EXISTS'
  | 'MANIFEST_CORRUPT';

export class VaultError extends Error {
  readonly code: VaultErrorCode;
  constructor(code: VaultErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'VaultError';
    this.code = code;
  }
}

/** Se lanza cuando la DEK no descifra la BD (master password incorrecto). */
export class InvalidMasterPasswordError extends VaultError {
  constructor(cause?: unknown) {
    super('INVALID_MASTER_PASSWORD', 'Contraseña maestra incorrecta.', { cause });
    this.name = 'InvalidMasterPasswordError';
  }
}
