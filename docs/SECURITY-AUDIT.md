# Auditoría de seguridad — ATS Secure Pass

Autoevaluación frente al perfil **MAS-L2** del OWASP MASTG (el nivel adecuado
para apps con datos altamente sensibles, como un gestor de contraseñas).

> **Aviso de terminología.** Desde MASVS v2.0.0 los niveles de verificación se
> movieron al MASTG como perfiles de testing (MAS-L1 / MAS-L2 / MAS-R). No existe
> una "certificación MASVS" oficial: esto es una autoevaluación con evidencia.

- **Fecha:** 2026-07 · **Versión app:** 0.1.0
- **Plataforma:** Android (offline-first, sin backend)
- **Alcance:** código de la app (este repositorio). No cubre el sistema operativo
  ni el hardware del dispositivo.

---

## Resumen ejecutivo

La app implementa los controles núcleo esperables de un gestor de contraseñas de
nivel MAS-L2: cifrado de toda la base de datos con SQLCipher (AES-256), derivación
de clave con Argon2id (parámetros OWASP), clave envuelta por el Android Keystore
tras biometría, y defensa en profundidad (anti-captura, auto-lock, limpieza de
portapapeles, detección de root). El modelo es **zero-knowledge**: sin la
contraseña maestra, ni la base de datos ni los backups son legibles.

Estado global: **cumple la mayoría de MAS-L2**. Pendientes menores (todos de
resiliencia/distribución) en la tabla de abajo.

---

## Modelo de amenazas (resumen)

| Amenaza | Mitigación |
|---|---|
| Robo/pérdida del dispositivo (bloqueado) | BD cifrada; DEK solo en Keystore tras biometría; auto-lock |
| Robo del dispositivo (desbloqueado) | Auto-lock por inactividad/segundo plano; biometría para reabrir |
| Extracción del almacenamiento (adb/backup) | `allowBackup=false`; BD cifrada; secure-store fuera del auto-backup |
| Malware que lee la pantalla/capturas | FLAG_SECURE (bloquea screenshots y preview de recientes) |
| Malware que lee el portapapeles | Auto-borrado del portapapeles a los 25 s + al bloquear |
| Fuerza bruta de la contraseña maestra | Argon2id memory-hard (~300 ms/intento); sin verificador expuesto |
| Dispositivo comprometido (root) | Aviso por `jail-monkey` (defensa en profundidad, no garantía) |
| Fuga de un backup | Backup cifrado con SQLCipher; inútil sin la contraseña maestra |

Fuera de alcance: atacante con root activo + la app desbloqueada (puede volcar
memoria); esto es una limitación inherente a cualquier app en un SO comprometido.

---

## Evaluación por categoría MASVS

### MASVS-STORAGE — Almacenamiento ✅
- BD completa cifrada con SQLCipher (AES-256), clave nunca en disco en claro.
  → `src/db/database.ts` (`PRAGMA key` con clave raw), `app.json` (`useSQLCipher`).
- La DEK se guarda protegida por el Keystore, no en `AsyncStorage`/preferencias en claro.
  → `src/auth/dekStore.ts` (`requireAuthentication`).
- Metadatos no secretos (salt, parámetros KDF) en JSON — el salt NO es secreto (OWASP).
  → `src/vault/manifest.ts`.
- `android.allowBackup=false` evita extracción por `adb backup`. → `app.json`.
- Sin secretos en logs; sin credenciales hardcodeadas (verificado por grep).

### MASVS-CRYPTO — Criptografía ✅
- KDF: **Argon2id** (m=19 MiB, t=3, p=1), salt aleatorio de 32 B por usuario.
  → `src/crypto/kdf.ts`, `src/crypto/params.ts`, `src/crypto/argon2Salt.ts`.
- Cifrado simétrico: AES-256 (SQLCipher). Clave raw de 32 B (sin doble KDF).
- Aleatoriedad: RNG seguro del SO (`expo-crypto`), nunca `Math.random`.
  → `src/crypto/random.ts`.
- No se persiste ningún verificador de contraseña (el `encodedHash` de Argon2
  ES la DEK; guardarlo filtraría la clave). Verificación delegada a SQLCipher.

### MASVS-AUTH — Autenticación local ✅
- Biometría **fuerte (Class 3)** requerida; la clave se libera a nivel de
  hardware (`setUserAuthenticationRequired`). No es un booleano bypasseable.
  → `src/auth/dekStore.ts`, `src/auth/biometrics.ts`.
- **Fallback obligatorio** a contraseña maestra; manejo de invalidación de clave
  por cambio de biometría (`KeyPermanentlyInvalidatedException`).
  → `src/auth/errors.ts`, `src/vault/vaultManager.ts`.
- **Sin credenciales por defecto** (OWASP Mobile Top 10 — M1): el primer arranque
  obliga a crear la contraseña maestra. → `src/ui/screens/OnboardingScreen.tsx`.

### MASVS-NETWORK — Red ➖ N/A
- La app es 100% offline; no realiza peticiones de red con datos del usuario.
  (Si en el futuro se añade sync en nube: exigir TLS + cifrado E2E y, si aplica,
  certificate pinning.)

### MASVS-PLATFORM — Interacción con la plataforma 🟡
- Capturas/preview de recientes: **FLAG_SECURE** activo. → `src/security/screenCapture.ts`.
- Portapapeles: auto-borrado con timer. → `src/security/clipboard.ts`.
- Sin componentes exportados/deep links sensibles ni WebViews.
- **Pendiente menor:** marcar el portapapeles como sensible
  (`ClipDescription.EXTRA_IS_SENSITIVE`) — `expo-clipboard` no lo expone; requiere
  un módulo nativo. Impacto bajo (Android 13+ ya limita la preview).

### MASVS-CODE — Calidad del código ✅ / 🟡
- SQL siempre parametrizado; whitelist de columnas en updates.
  → `src/db/credentials.ts`.
- Validación de entrada en backups (formato/versión/salt/KDF). → `src/backup/envelope.ts`.
- **Pendiente:** `npm audit` reporta 11 vulnerabilidades *moderate*, **todas en
  herramientas de build de Expo** (`@expo/config-plugins`, `@expo/prebuild-config`,
  plugin de `expo-sharing`). Son dependencias de **tiempo de compilación** (config
  plugins) — **no se empaquetan en el APK**. Se resuelven al actualizar el SDK de
  Expo; no aplicar `npm audit fix --force` (rompe el pin de versiones del SDK).

### MASVS-RESILIENCE — Resiliencia 🟡
- Detección de root/hooking con `jail-monkey`. → `src/security/rootDetection.ts`.
- Ofuscación nativa: **R8/ProGuard activado en release**
  (`enableProguardInReleaseBuilds: true` en `app.json`).
- **Pendiente (opcional):** ofuscar también el bundle JS
  (`obfuscator-io-metro-plugin`); anti-debugging adicional. La resiliencia es
  defensa en profundidad: bypasseable en un dispositivo comprometido.

### MASVS-PRIVACY — Privacidad ✅
- Todo local; sin telemetría, analytics ni terceros. Permisos mínimos (biometría).
- Sin recolección de datos personales fuera de la bóveda del propio usuario.

---

## Hallazgos y acciones

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| 1 | Baja | `updateCredential` interpolaba nombres de columna desde las claves del objeto | ✅ Corregido (whitelist `UPDATABLE_COLUMNS`) |
| 2 | Info | `npm audit`: vulnerabilidades solo en tooling de build (no en el APK) | Documentado; se resuelve al subir el SDK |
| 3 | Baja | Portapapeles no marcado como "sensible" a nivel nativo | Limitación de `expo-clipboard`; mitigado por auto-borrado |
| 4 | Info | Sin ofuscación del bundle JS | Opcional; R8 ya activo para el código nativo |
| 5 | Info | Backup temporal queda en caché tras compartir | Cifrado (SQLCipher); el SO limpia la caché |

No se hallaron vulnerabilidades de severidad media o alta en el código de la app.

---

## Verificación en dispositivo (lo que corres tú)

El análisis estático/dinámico completo se hace sobre el APK compilado, no aquí.

### 1. MobSF (análisis estático automático, gratis)

```bash
# con Docker
docker run -it --rm -p 8000:8000 opensecurity/mobile-security-framework-mobsf
# abre http://localhost:8000 y sube el APK de release:
#   android/app/build/outputs/apk/release/app-release.apk
```

Revisa el informe: permisos, secretos, configuración de red, uso de cripto. La
mayoría del perfil MAS-L1 se valida de forma automática aquí.

### 2. Comprobaciones manuales (perfil MAS-L2)

- **Almacenamiento en claro:** extrae `vault_<id>.db` del dispositivo e intenta
  abrirlo con un visor SQLite → debe fallar.
- **Capturas:** intenta un screenshot dentro de la app → debe bloquearse.
- **Portapapeles:** copia una contraseña, espera 25 s → el portapapeles se vacía.
- **Auto-lock:** manda la app a segundo plano → al volver, exige desbloqueo.
- **Backup:** el `.json` exportado debe ser ilegible sin la contraseña maestra.

---

## Apéndice: APK de release firmado con tu propia llave

El `expo run:android --variant release` firma con la *debug key* (perfecto para
uso personal). Para una **llave propia** (distribución / actualizaciones estables):

```bash
# 1) Genera una keystore (guárdala a buen recaudo; si la pierdes, no podrás
#    actualizar la app sin desinstalar)
keytool -genkeypair -v -storetype PKCS12 \
  -keystore ats-release.jks -alias ats-key \
  -keyalg RSA -keysize 2048 -validity 10000
```

Luego configura la firma. La vía recomendada y que sobrevive a `prebuild` es
**EAS Build** (gestiona la keystore por ti):

```bash
npm install -g eas-cli
eas login
eas build:configure
# perfil "preview" = APK instalable; "production" = AAB para Play Store
eas build -p android --profile preview
```

> Cambiar de llave de firma sobre una app ya instalada obliga a **desinstalarla
> primero** (se borran los datos). Haz un backup (Ajustes → "Guardar en teléfono")
> antes de migrar de firma.
