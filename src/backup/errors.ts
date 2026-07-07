/** Errores de backup/restore. */
export type BackupErrorCode =
  | 'INVALID_BACKUP'
  | 'EXPORT_FAILED'
  | 'IMPORT_FAILED'
  | 'SHARING_UNAVAILABLE';

export class BackupError extends Error {
  readonly code: BackupErrorCode;
  constructor(code: BackupErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BackupError';
    this.code = code;
  }
}
