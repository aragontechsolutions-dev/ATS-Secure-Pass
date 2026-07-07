/**
 * Protección contra capturas de pantalla y grabación.
 *
 * En Android, `preventScreenCaptureAsync` aplica `FLAG_SECURE` a la ventana:
 * bloquea screenshots/grabación y muestra una pantalla en blanco en la vista de
 * apps recientes (app switcher). Es una defensa importante para un gestor de
 * contraseñas.
 */
import * as ScreenCapture from 'expo-screen-capture';

/** Clave para evitar que varias llamadas prevent/allow se pisen entre sí. */
const KEY = 'ats-secure-pass';

/** Activa la protección (FLAG_SECURE). Idempotente. */
export async function enableScreenProtection(): Promise<void> {
  await ScreenCapture.preventScreenCaptureAsync(KEY);
}

/** Desactiva la protección. Solo para casos concretos (p. ej. mostrar un QR). */
export async function disableScreenProtection(): Promise<void> {
  await ScreenCapture.allowScreenCaptureAsync(KEY);
}
