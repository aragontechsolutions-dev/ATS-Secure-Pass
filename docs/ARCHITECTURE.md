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
| 3 | **Biometría + Android Keystore (wrap de la DEK)** | ✅ Hecho |
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
   Salt (32B) ────┘                                        │
                                                           ▼
                                     PRAGMA key = "x'<DEK hex>'"
                                                           │
                                                           ▼
                                   BD SQLCipher (AES-256, archivo por usuario)
```

1. **Crear bóveda**: el usuario fija su master password → se genera un salt
   aleatorio de 32 bytes (`expo-crypto`) → `DEK = Argon2id(masterPassword, salt)`
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

> ⚠️ **Encoding del salt (específico de Android).** `@sphereon/react-native-argon2`
> en Android interpreta el salt como `BigInteger(salt, 16).toByteArray()` y toma
> los últimos 32 bytes; en iOS (CatCrypto) lo usa como UTF-8. Por eso el salt se
> genera con `encodeArgon2Salt` (32 bytes aleatorios + 1 byte de framing → 66 hex
> chars), garantizando ≥32 bytes y evitando el `ArrayIndexOutOfBounds`. Ver
> `src/crypto/argon2Salt.ts`. Si se añade iOS habrá que unificar este manejo.

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
├── auth/
│   ├── biometrics.ts  # capacidades biométricas (expo-local-authentication)
│   ├── dekStore.ts    # DEK protegida por Keystore (secure-store + requireAuthentication)
│   ├── errors.ts      # BiometricUnlockError (reason: invalidated, failed, …)
│   └── index.ts
├── vault/
│   ├── manifest.ts      # metadatos no secretos por usuario (salt, KDF, flag biometría)
│   ├── vaultManager.ts  # crear / desbloquear / bloquear + activar/usar biometría
│   └── index.ts
└── types/
    └── react-native-argon2.d.ts  # tipos del módulo Argon2 (no trae .d.ts)

tests/                # tests de lógica pura (Node): encoding, params, salt Argon2
App.tsx               # banco de pruebas de diagnóstico (Etapas 1 + 3)
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

## Biometría (Etapa 3)

La biometría **desbloquea la DEK; no autentica por sí sola.** El patrón "wrap
key" ata la DEK a la biometría a nivel de hardware:

```
Activar:      master password → DEK (Argon2id) → secure-store.setItem(
                 "dek_<userId>", DEK, requireAuthentication:true)  ← Android Keystore
Desbloquear:  secure-store.getItem(...)  →  el OS exige biometría  →  DEK  →  abrir BD
Fallback:     si la biometría falla / se invalida  →  master password (re-deriva la DEK)
```

- **`requireAuthentication: true`** equivale en Android a
  `setUserAuthenticationRequired(true)` y requiere **biometría fuerte
  (Class 3)** — huella siempre; muchos face-unlock son Class 2 y no sirven. La
  lectura de la DEK dispara el prompt del sistema; no llamamos a
  `authenticateAsync` aparte (evita doble prompt). `expo-local-authentication`
  se usa solo para decidir si se puede **ofrecer** la biometría.
- **Fallback obligatorio.** La DEK vive también tras el master password (que la
  re-deriva). El archivo SQLCipher es la fuente de datos; secure-store es solo
  una caché de conveniencia (se borra al desinstalar y no entra en Auto Backup).
- **Invalidación por enrolamiento.** Al añadir/cambiar una biometría, la clave
  del Keystore se invalida de forma irreversible y la DEK guardada se vuelve
  ilegible. `readDek` lo detecta (`BiometricUnlockError('invalidated')`) y el
  flujo cae al master password; tras desbloquear, se puede re-activar la
  biometría (`enableBiometricUnlock`), que genera una clave fresca.
- El flag `biometricEnabled` se guarda por usuario en el manifiesto (no secreto).

### Checkpoint de seguridad de la Etapa 3

1. **Activar y usar.** Crea/desbloquea una bóveda, "Activar biometría", bloquea,
   y "Desbloquear con huella" → debe pedir la huella y abrir la bóveda.
2. **Fallback por invalidación.** Añade/cambia una huella en Ajustes de Android,
   vuelve y pulsa "Desbloquear con huella" → debe fallar limpiamente
   (`invalidated`) y NO dejar la bóveda inaccesible; el master password sigue
   funcionando.
3. **Sin biometría fuerte.** En un dispositivo sin huella (solo PIN/cara Class 2)
   la opción de activar aparece deshabilitada.

---

## Próximos pasos (Etapa 4 en adelante)

- **Hardening**: `expo-screen-capture` (FLAG_SECURE), limpieza del portapapeles
  con timer, auto-lock por inactividad (`AppState`), `jail-monkey`.
- **Backup**: `PRAGMA wal_checkpoint(FULL)` → copiar el `.db` (ya cifrado) con
  `expo-file-system` → compartir con `expo-sharing`.
