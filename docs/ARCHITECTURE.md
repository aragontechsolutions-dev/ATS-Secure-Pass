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
| 4 | **Hardening (FLAG_SECURE, portapapeles, auto-lock, root)** | ✅ Hecho |
| 5 | **Backup / restore cifrado** | ✅ Hecho |
| 6 | UI/UX: shell de app con pantallas reales | ✅ App real (Onboarding/Lock/Dashboard/Settings) + iconos de marca + animaciones |
| 7 | **Auditoría contra el perfil MAS-L2 del MASTG** | ✅ Autoevaluación ([`SECURITY-AUDIT.md`](SECURITY-AUDIT.md)); pendiente MobSF sobre el APK |

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
├── security/
│   ├── screenCapture.ts  # FLAG_SECURE (expo-screen-capture)
│   ├── clipboard.ts      # copiar con auto-borrado (expo-clipboard + timer)
│   ├── clipboardCore.ts  # lógica pura del portapapeles (testeada)
│   ├── autoLock.ts       # hook useAutoLock (AppState: background + inactividad)
│   ├── autoLockCore.ts   # lógica pura del auto-lock (testeada)
│   ├── rootDetection.ts  # integridad del dispositivo (jail-monkey)
│   └── index.ts
├── vault/
│   ├── manifest.ts      # metadatos no secretos por usuario (salt, KDF, flag biometría)
│   ├── vaultManager.ts  # crear / desbloquear / bloquear + activar/usar biometría
│   └── index.ts
├── backup/
│   ├── envelope.ts    # formato del backup (JSON auto-contenido, puro + testeado)
│   ├── backup.ts      # export: wal_checkpoint + base64 + expo-sharing
│   ├── restore.ts     # import: expo-document-picker + escribir db + manifest
│   ├── errors.ts      # BackupError
│   └── index.ts
├── ui/
│   ├── theme.ts          # paleta claro/oscuro + useTheme
│   ├── components.tsx    # Button, Card, Field, PasswordField (ojo), GearButton, …
│   ├── motion.tsx        # animaciones (FadeSlideIn, PopIn) con Animated nativo
│   ├── brandIcon.tsx     # icono de marca (logo SVG) o avatar de letra
│   ├── brandResolve.ts   # resolución marca por título/URL (pura, testeada)
│   ├── brandData.ts      # datos de logos (set curado de simple-icons, generado)
│   ├── useController.ts  # estado global + acciones (el "cerebro" de la app)
│   └── screens/
│       ├── OnboardingScreen.tsx  # crear la primera bóveda
│       ├── LockScreen.tsx        # huella automática + fallback master password
│       ├── DashboardScreen.tsx   # lista/añadir/copiar/mostrar credenciales
│       └── SettingsScreen.tsx    # ⚙️ biometría, auto-lock, integridad, diagnóstico
└── types/
    └── react-native-argon2.d.ts  # tipos del módulo Argon2 (no trae .d.ts)

tests/                # tests de lógica pura (Node): encoding, params, salt, seguridad
App.tsx               # shell: enruta por fase (loading/onboarding/locked/unlocked)
```

### Flujo de la app (navegación por estado, sin librería nativa)

`useController` deriva la fase a partir del estado:

```
loading ─▶ ¿hay usuarios?
             │ no ─▶ onboarding (crear bóveda)
             │ sí ─▶ locked ──(huella auto / master password)──▶ unlocked
                                                                   │
                                                    dashboard ⇄ settings (⚙️)
```

Al abrir, si el usuario activo tiene biometría activada, la `LockScreen` lanza la
huella automáticamente. Todos los ajustes técnicos (biometría, auto-lock,
integridad, benchmark) viven en `SettingsScreen`, accesible con la rueda dentada.

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

## Hardening (Etapa 4)

Defensa en profundidad (OWASP MASTG, perfil MAS-L2):

- **Anti-captura (FLAG_SECURE).** `enableScreenProtection` llama a
  `preventScreenCaptureAsync`: bloquea screenshots/grabación y muestra pantalla
  en blanco en el app switcher. Se activa al arrancar la app.
- **Portapapeles con auto-borrado.** `copyWithAutoClear` copia la contraseña y
  programa limpiar el portapapeles a los 25 s, y solo lo limpia si el contenido
  sigue siendo el que copiamos (`shouldClearClipboard`). Al bloquear la bóveda se
  limpia de inmediato. `expo-clipboard` no expone TTL ni el flag "sensible"; el
  borrado es responsabilidad de la app.
- **Auto-lock.** `useAutoLock` (API `AppState`) bloquea al ir a segundo plano
  (`backgroundGraceMs = 0`) y tras inactividad. Como los `setTimeout` se pausan en
  background, se compara un timestamp al volver (`isInactivityExpired`). Bloquear
  = cerrar la BD, soltar la DEK y limpiar el portapapeles.
- **Detección de root.** `getDeviceIntegrity` usa `jail-monkey`
  (`isJailBroken`/`trustFall`/`hookDetected`). Es DEFENSA EN PROFUNDIDAD, no una
  garantía: los checks client-side son bypasseables en un dispositivo
  comprometido.

### Checkpoint de seguridad de la Etapa 4

1. **Captura bloqueada.** Intenta hacer un screenshot → debe fallar / salir en
   negro; en apps recientes la preview se ve en blanco.
2. **Portapapeles.** Copia una contraseña, espera 25 s, pega en otra app → debe
   estar vacío. Bloquea la bóveda → se limpia de inmediato.
3. **Auto-lock.** Con "Auto-lock ON": manda la app a segundo plano y vuelve → la
   bóveda debe estar bloqueada; o espera 30 s sin tocar → se bloquea sola.
4. **Integridad.** En un dispositivo con root, el estado debe avisar
   "Dispositivo comprometido".

---

## Backup / restore (Etapa 5)

Backup **auto-contenido y cifrado**. Punto de diseño clave: la clave se deriva de
`master password + salt + parámetros`, y el salt/params viven en el manifiesto,
no en el `.db`. Por eso el backup empaqueta AMBOS:

```
Sobre (JSON):
{ format, version, createdAt,
  user: { displayName, saltHex, kdf },   ← metadatos NO secretos
  dbBase64 }                              ← archivo SQLCipher completo (cifrado)
```

- **Export** (`exportVault`): `PRAGMA wal_checkpoint(FULL)` para volcar el WAL →
  leer el `.db` en base64 → `buildEnvelope` → escribir en caché → `expo-sharing`.
  Nunca se exporta nada descifrado; el `.db` va cifrado con SQLCipher.
- **Import** (`restoreVault`): `expo-document-picker` (con `copyToCacheDirectory`)
  → `parseEnvelope` (valida formato/versión/salt/KDF) → escribir el `.db` con un
  **id de usuario nuevo** (no sobrescribe nada) → registrar en el manifiesto. El
  usuario desbloquea luego con su contraseña maestra.
- **Zero-knowledge**: el sobre incluye salt/params en claro (no son secretos),
  pero las credenciales están cifradas; sin la contraseña maestra el backup es
  inútil. Apto para subir a la nube (E2E) en el futuro.

### Checkpoint de seguridad de la Etapa 5

1. **Round-trip.** Exporta la bóveda, desinstala/borra datos de la app,
   reinstala, "Restaurar desde backup" → solo se abre con la contraseña maestra
   correcta.
2. **Aislado.** El backup no sobrescribe una bóveda existente: al restaurar se
   crea un usuario nuevo (nombre único si colisiona).
3. **Cifrado.** Abre el `.json` del backup: verás metadatos + un blob base64; la
   BD (dentro) sigue siendo ilegible sin la clave.

---

## Próximos pasos (Etapa 7)

- **UI/UX (Etapa 6, pulido)**: iconos de marca por credencial, animaciones
  (Reanimated/Moti).
- **Auditoría MAS-L2 (Etapa 7)**: revisar contra el MAS Checklist; MobSF.
