# ATS Secure Pass

Gestor de contraseñas **offline-first** para Android, cifrado de extremo a
extremo. Construido con **Expo (development build)** + **React Native** +
**SQLCipher** + **Argon2id**.

> ⚠️ **Requiere un development build (NO Expo Go).** El cifrado (SQLCipher), la
> derivación de clave (Argon2) y el Keystore son módulos nativos.

## Estado actual

- ✅ **Etapa 0** — Proyecto Expo con prebuild + dev client, config plugins.
- ✅ **Etapa 1** — Núcleo criptográfico: BD cifrada con SQLCipher (AES-256) +
  derivación de clave con Argon2id (parámetros OWASP). Una BD cifrada por
  usuario con clave propia (aislamiento criptográfico).
- ✅ **Etapa 3** — Biometría + Android Keystore: la DEK se envuelve tras
  `expo-secure-store` (`requireAuthentication`); la biometría desbloquea la
  clave, con fallback obligatorio al master password.
- ✅ **Etapa 4** — Hardening: anti-captura (FLAG_SECURE), portapapeles con
  auto-borrado, auto-lock por segundo plano/inactividad y detección de root
  (jail-monkey).

El detalle de la arquitectura y la hoja de ruta por etapas está en
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Puesta en marcha

```bash
npm install

# Verificación sin dispositivo:
npm run typecheck      # tsc de la app y de los tests
npm run test:crypto    # tests de lógica pura (encoding, parámetros KDF)

# Development build en Android (requiere Android Studio / Android SDK):
npx expo prebuild --clean
npx expo run:android
```

Al abrir la app verás el **banco de pruebas de la Etapa 1**: crear bóveda,
benchmark de Argon2id, guardar/leer credenciales cifradas y probar el rechazo de
un master password incorrecto. No es la UI final (Etapa 6).

## Stack

| Función | Librería |
|---|---|
| BD cifrada | `expo-sqlite` + `useSQLCipher` (SQLCipher, AES-256) |
| KDF | `@sphereon/react-native-argon2` (Argon2id) |
| Aleatoriedad segura | `expo-crypto` |
| Biometría (Etapa 3) | `expo-secure-store` + `expo-local-authentication` |

## Seguridad

- El master password nunca se usa como clave directa: se deriva con Argon2id.
- La base de datos completa se cifra con SQLCipher (AES-256).
- No se persiste ningún verificador de contraseña ni la clave en claro.
- Sin credenciales por defecto (OWASP Mobile Top 10 — M1).

Los parámetros de Argon2id son un mínimo de arranque: **calíbralos en tu
dispositivo** con el benchmark incluido (objetivo 250–400 ms).
