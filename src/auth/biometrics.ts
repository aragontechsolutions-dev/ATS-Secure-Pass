/**
 * Comprobación de capacidades biométricas del dispositivo.
 *
 * Usa `expo-local-authentication` SOLO para decidir si se puede OFRECER la
 * biometría (hardware presente + biometría fuerte enrolada). La autenticación
 * real que protege la DEK la impone el sistema operativo al leerla de
 * `expo-secure-store` con `requireAuthentication: true` (ver `dekStore.ts`);
 * no llamamos a `authenticateAsync` para no duplicar el prompt.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export interface BiometricCapability {
  /** Hay hardware biométrico en el dispositivo. */
  hasHardware: boolean;
  /** Hay al menos una biometría enrolada. */
  isEnrolled: boolean;
  /** El nivel enrolado es BIOMETRIC_STRONG (Class 3), requerido por secure-store. */
  isStrong: boolean;
  /** Tipos soportados (huella, cara, iris). */
  types: LocalAuthentication.AuthenticationType[];
  /**
   * `expo-secure-store` puede guardar valores con `requireAuthentication`.
   * Es la señal definitiva para permitir activar la biometría en esta app.
   */
  canUseForVault: boolean;
}

/** Consulta las capacidades biométricas actuales del dispositivo. */
export async function getBiometricCapability(): Promise<BiometricCapability> {
  const [hasHardware, isEnrolled, level, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  const isStrong = level === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG;
  // `canUseBiometricAuthentication` comprueba que secure-store puede generar una
  // clave protegida por biometría fuerte en este dispositivo.
  const canUseForVault = SecureStore.canUseBiometricAuthentication();

  return { hasHardware, isEnrolled, isStrong, types, canUseForVault };
}

/** Devuelve una etiqueta legible del tipo de biometría principal disponible. */
export function describeBiometrics(cap: BiometricCapability): string {
  if (!cap.hasHardware) return 'Sin hardware biométrico';
  if (!cap.isEnrolled) return 'Sin biometría enrolada';
  const t = cap.types;
  if (t.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Huella';
  if (t.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Reconocimiento facial';
  if (t.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'Iris';
  return 'Biometría';
}
