/** Errores tipados del desbloqueo biométrico. */

export type BiometricUnlockReason =
  /** No hay hardware, no hay biometría fuerte enrolada, o secure-store no puede usarla. */
  | 'unavailable'
  /** No hay DEK guardada para este usuario (biometría no activada). */
  | 'not-enrolled'
  /** El usuario canceló o la autenticación falló. */
  | 'failed'
  /** La clave del Keystore se invalidó (cambio de biometría) → re-derivar del master password. */
  | 'invalidated'
  /** Fallo no clasificado. */
  | 'unknown';

/**
 * Error de desbloqueo biométrico. En TODOS los casos la app debe caer al
 * desbloqueo por master password (la biometría es una capa de conveniencia).
 */
export class BiometricUnlockError extends Error {
  readonly reason: BiometricUnlockReason;
  /** Código nativo original de expo-secure-store, si lo hubo. */
  readonly nativeCode?: string;

  constructor(reason: BiometricUnlockReason, message: string, options?: { cause?: unknown; nativeCode?: string }) {
    super(message, { cause: options?.cause });
    this.name = 'BiometricUnlockError';
    this.reason = reason;
    this.nativeCode = options?.nativeCode;
  }
}
