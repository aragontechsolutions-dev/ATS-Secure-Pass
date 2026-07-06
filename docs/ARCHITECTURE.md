# Arquitectura de seguridad — ATS Secure Pass

Gestor de contraseñas **offline-first** para Android construido con **Expo
(development build)** + **React Native**. Este documento describe la
arquitectura y el estado de implementación por etapas.

> ⚠️ **Requiere development build, NO Expo Go.** SQLCipher, Argon2 y el Keystore
> son módulos nativos. El flujo es Continuous Native Generation: editas
> `app.json`/config plugins y ejecutas `npx expo prebuild` + `npx expo run:android`.

---

## Estado por etapas

| Etapa | Descripción | Estado |
|------|-------------|--------|
| 0 | Preparación del proyecto (Expo + prebuild + dev client) | ✅ Hecho |
| 1 | **BD cifrada (SQLCipher) + KDF (Argon2id)** | ✅ Hecho (este entregable) |
| 2 | Multi-usuario con aislamiento criptográfico | 🟡 Base lista (manifest + una BD/clave por usuario) |
| 3 | Biometría + Android Keystore (wrap de la DEK) | ⬜ Pendiente |
| 4 | Hardening (FLAG_SECURE, portapapeles, auto-lock, root) | ⬜ Pendiente |
| 5 | Backup / restore cifrado | ⬜ Pendiente |
| 6 | UI/UX final (iconos de marca, mostrar/ocultar, copiar) | ⬜ Pendiente |
| 7 | Auditoría contra el perfil MAS-L2 del MASTG | ⬜ Pendiente |

La Etapa 2 tiene su cimiento ya construido: el modelo de datos es **una BD
cifrada por usuario, cada una con su propia clave**. Falta el selector de
usuario en la UI (Etapa 6).

---

## Flujo criptográfico (Etapa 1)

```
Master password ──┐
                  ├─► Argon2id(m=19MiB, t=2, p=1) ──► DEK (32 bytes / 64 hex)
   Salt (16B) ────┘                                        │
                                                           ▼
                                     PRAGMA key = "x'<DEK hex>'"
                                                           │
                                                           ▼
                                   BD SQLCipher (AES-256, archivo por usuario)
```

1. **Crear bóveda**: el usuario fija su master password → se genera un salt
   aleatorio de 16 bytes (`expo-crypto`) → `DEK = Argon2id(masterPassword, salt)`
   → se crea la BD SQLCipher con esa DEK como clave raw → se guardan en el
   manifiesto (en claro, no secretos) el salt y los parámetros KDF.
2. **Desbloquear**: se leen salt + parámetros del manifiesto → se re-deriva la
   DEK → se abre la BD. **SQLCipher es el verificador**: si la DEK es incorrecta,
   leer el catálogo falla → `InvalidMasterPasswordError`.
3. **Bloquear**: se cierra la conexión. La DEK es transitoria y no se conserva
   en el objeto de sesión.

### Decisiones clave

- **Clave RAW en SQLCipher** (`PRAGMA key = "x'<64 hex>'"`): como ya derivamos
  con Argon2id, se usa la DEK como clave directa y SQLCipher **no** aplica su
  PBKDF2 encima (evita doble KDF redundante).
- **No se persiste ningún verificador de contraseña.** El `encodedHash` de
  Argon2 contiene exactamente los mismos bytes que la DEK; guardarlo equivaldría
  a guardar la clave en claro. La verificación se delega a SQLCipher.
- **Cifrado de toda la BD** (no campo a campo): protege también metadatos,
  índices y nombres de tablas.
- **Aislamiento criptográfico multi-usuario**: la BD del usuario A no se puede
  descifrar con la clave del usuario B (archivos y claves distintos). No hay
  columna `user_id` ni particionado lógico.
- **Sin credenciales por defecto** (OWASP Mobile Top 10 M1): no existe master
  password preconfigurado; el usuario debe crear el suyo.

### Parámetros KDF

Por defecto: perfil OWASP equilibrado **Argon2id m=19456 KiB (19 MiB), t=2, p=1**,
salida de 32 bytes. Son un **mínimo de arranque**: hay que calibrar con
`benchmarkArgon2id()` en el dispositivo objetivo apuntando a **250–400 ms** por
derivación. El banco de pruebas (`App.tsx`) incluye un botón "Benchmark KDF".

---

## Estructura del código

```
src/
├── crypto/
│   ├── encoding.ts   # hex/base64/utf8, comparación en tiempo constante (puro, testeado)
│   ├── params.ts     # parámetros Argon2id OWASP + validación (puro, testeado)
│   ├── random.ts     # aleatoriedad segura (expo-crypto): salt, UUID
│   ├── kdf.ts        # derivación DEK con Argon2id + benchmark
│   └── index.ts
├── db/
│   ├── database.ts    # apertura SQLCipher, PRAGMA key, verificación, rekey
│   ├── schema.ts      # esquema + migraciones (PRAGMA user_version)
│   ├── credentials.ts # CRUD de credenciales (parametrizado, anti-inyección)
│   ├── errors.ts      # errores tipados (InvalidMasterPasswordError, …)
│   └── index.ts
├── vault/
│   ├── manifest.ts      # metadatos no secretos por usuario (salt, KDF) en JSON
│   ├── vaultManager.ts  # crear / desbloquear / bloquear bóveda
│   └── index.ts
└── types/
    └── react-native-argon2.d.ts  # tipos del módulo Argon2 (no trae .d.ts)

tests/                # tests de lógica pura (Node): encoding, params
App.tsx               # banco de pruebas de diagnóstico de la Etapa 1
```

### Qué es testeable en CI vs. en dispositivo

- **En Node/CI** (`npm run test:crypto`): módulos puros (`encoding`, `params`).
  No importan código nativo, así que se prueban de forma determinista.
- **Solo en dispositivo / dev build**: todo lo que toca `expo-crypto`,
  `@sphereon/react-native-argon2` y `expo-sqlite` (SQLCipher). Se valida con el
  banco de pruebas de `App.tsx`.

---

## Cómo compilar y probar (Etapa 0/1)

```bash
npm install
npm run typecheck      # tsc de app + tests
npm run test:crypto    # tests de lógica pura

# Development build en Android (requiere Android SDK / Android Studio):
npx expo prebuild --clean
npx expo run:android   # instala el dev build en el dispositivo/emulador
```

### Checkpoint de seguridad de la Etapa 1

1. **La BD es ilegible sin la clave.** Extrae el archivo
   `vault_<userId>.db` del dispositivo e intenta abrirlo con un visor SQLite
   estándar → debe fallar ("file is not a database").
2. **Master password incorrecto se rechaza.** En el banco de pruebas: crea una
   bóveda, bloquéala, e intenta desbloquear con una contraseña distinta → debe
   registrar el rechazo de SQLCipher.
3. **Argon2id en ventana.** El benchmark debe dar ~250–400 ms; si no, ajusta
   `memoryKiB`/`iterations` en `src/crypto/params.ts`.

---

## Próximos pasos (Etapa 3 en adelante)

- **Biometría**: envolver la DEK con `expo-secure-store`
  (`requireAuthentication: true`) — la biometría **desbloquea** la DEK, no
  autentica por sí sola. Fallback **obligatorio** al master password (los
  cambios de enrolamiento biométrico invalidan las claves del Keystore de forma
  irreversible).
- **Hardening**: `expo-screen-capture` (FLAG_SECURE), limpieza del portapapeles
  con timer, auto-lock por inactividad (`AppState`), `jail-monkey`.
- **Backup**: `PRAGMA wal_checkpoint(FULL)` → copiar el `.db` (ya cifrado) con
  `expo-file-system` → compartir con `expo-sharing`.
