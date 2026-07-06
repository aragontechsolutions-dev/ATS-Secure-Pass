/**
 * Banco de pruebas de la Etapa 1 (núcleo criptográfico).
 *
 * NO es la UI final de la app (eso es la Etapa 6). Es una pantalla de
 * diagnóstico para validar, sobre un dispositivo/development build real, que:
 *   1. Se puede crear una bóveda cifrada con master password (Argon2id → DEK).
 *   2. La BD SQLCipher guarda y lee credenciales.
 *   3. Al bloquear y desbloquear, un master password incorrecto es rechazado.
 *   4. Argon2id tarda ~250–400 ms (benchmark) en el hardware objetivo.
 *
 * Requiere un development build (NO Expo Go): SQLCipher y Argon2 son nativos.
 */
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

import { benchmarkArgon2id } from './src/crypto/kdf';
import { DEFAULT_ARGON2ID_PARAMS } from './src/crypto/params';
import { countCredentials, createCredential, listCredentials } from './src/db/credentials';
import { InvalidMasterPasswordError } from './src/db/errors';
import type { Credential } from './src/db/credentials';
import { createVault, lockVault, unlockVault, type VaultSession } from './src/vault/vaultManager';
import { listUsers } from './src/vault/manifest';

export default function App() {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? darkColors : lightColors;

  const [displayName, setDisplayName] = useState('demo');
  const [masterPassword, setMasterPassword] = useState('');
  const [session, setSession] = useState<VaultSession | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [credTitle, setCredTitle] = useState('');
  const [credUser, setCredUser] = useState('');
  const [credPass, setCredPass] = useState('');

  const append = useCallback((line: string) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 40));
  }, []);

  const run = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        append(`❌ ${label}: ${msg}`);
      } finally {
        setBusy(false);
      }
    },
    [append]
  );

  const refreshCreds = useCallback(
    async (s: VaultSession) => {
      const list = await listCredentials(s.db);
      setCredentials(list);
    },
    []
  );

  const onBenchmark = () =>
    run('benchmark', async () => {
      append('⏱️ Ejecutando Argon2id…');
      const { durationMs, params } = await benchmarkArgon2id(DEFAULT_ARGON2ID_PARAMS);
      const inWindow = durationMs >= 250 && durationMs <= 400;
      append(
        `⏱️ Argon2id m=${params.memoryKiB}KiB t=${params.iterations} → ${durationMs} ms ` +
          `${inWindow ? '✅ en ventana' : '⚠️ fuera de 250–400 ms, calibra los parámetros'}`
      );
    });

  const onCreate = () =>
    run('crear bóveda', async () => {
      const s = await createVault({ displayName, masterPassword });
      setSession(s);
      await refreshCreds(s);
      append(`🔐 Bóveda creada y abierta para "${s.displayName}" (${s.userId.slice(0, 8)}…)`);
    });

  const onUnlock = () =>
    run('desbloquear', async () => {
      const users = await listUsers();
      const target = users.find((u) => u.displayName === displayName.trim());
      if (!target) {
        append(`ℹ️ No hay usuario "${displayName}". Crea la bóveda primero.`);
        return;
      }
      try {
        const s = await unlockVault(target.id, masterPassword);
        setSession(s);
        await refreshCreds(s);
        append(`🔓 Bóveda desbloqueada (${await countCredentials(s.db)} credenciales)`);
      } catch (err) {
        if (err instanceof InvalidMasterPasswordError) {
          append('🚫 Master password incorrecto (SQLCipher rechazó la clave) ✅ esperado');
          return;
        }
        throw err;
      }
    });

  const onLock = () =>
    run('bloquear', async () => {
      if (!session) return;
      await lockVault(session);
      setSession(null);
      setCredentials([]);
      append('🔒 Bóveda bloqueada (conexión cerrada, DEK fuera de memoria)');
    });

  const onAddCredential = () =>
    run('guardar credencial', async () => {
      if (!session) {
        append('ℹ️ Abre una bóveda primero.');
        return;
      }
      if (!credTitle || !credPass) {
        append('ℹ️ Título y contraseña son obligatorios.');
        return;
      }
      await createCredential(session.db, {
        title: credTitle,
        username: credUser || undefined,
        password: credPass,
      });
      setCredTitle('');
      setCredUser('');
      setCredPass('');
      await refreshCreds(session);
      append(`💾 Credencial "${credTitle}" guardada (cifrada en disco)`);
    });

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: c.text }]}>ATS Secure Pass</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>
          Etapa 1 · Diagnóstico del núcleo criptográfico
        </Text>

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.muted }]}>Usuario</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="none"
            placeholder="nombre de usuario"
            placeholderTextColor={c.muted}
            style={[styles.input, { color: c.text, borderColor: c.border }]}
          />
          <Text style={[styles.label, { color: c.muted }]}>Contraseña maestra</Text>
          <TextInput
            value={masterPassword}
            onChangeText={setMasterPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="master password"
            placeholderTextColor={c.muted}
            style={[styles.input, { color: c.text, borderColor: c.border }]}
          />

          <View style={styles.row}>
            <Button label="Crear bóveda" onPress={onCreate} disabled={busy} c={c} />
            <Button label="Desbloquear" onPress={onUnlock} disabled={busy} c={c} />
          </View>
          <View style={styles.row}>
            <Button label="Benchmark KDF" onPress={onBenchmark} disabled={busy} c={c} kind="ghost" />
            <Button
              label="Bloquear"
              onPress={onLock}
              disabled={busy || !session}
              c={c}
              kind="ghost"
            />
          </View>
        </View>

        {session && (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>
              Bóveda abierta · {session.displayName}
            </Text>
            <Text style={[styles.label, { color: c.muted }]}>Título</Text>
            <TextInput
              value={credTitle}
              onChangeText={setCredTitle}
              placeholder="p. ej. GitHub"
              placeholderTextColor={c.muted}
              style={[styles.input, { color: c.text, borderColor: c.border }]}
            />
            <Text style={[styles.label, { color: c.muted }]}>Usuario</Text>
            <TextInput
              value={credUser}
              onChangeText={setCredUser}
              autoCapitalize="none"
              placeholder="usuario/email"
              placeholderTextColor={c.muted}
              style={[styles.input, { color: c.text, borderColor: c.border }]}
            />
            <Text style={[styles.label, { color: c.muted }]}>Contraseña</Text>
            <TextInput
              value={credPass}
              onChangeText={setCredPass}
              autoCapitalize="none"
              placeholder="contraseña a guardar"
              placeholderTextColor={c.muted}
              style={[styles.input, { color: c.text, borderColor: c.border }]}
            />
            <Button label="Guardar credencial" onPress={onAddCredential} disabled={busy} c={c} />

            <Text style={[styles.cardTitle, { color: c.text, marginTop: 16 }]}>
              Credenciales ({credentials.length})
            </Text>
            {credentials.map((cred) => (
              <View key={cred.id} style={[styles.credItem, { borderColor: c.border }]}>
                <Text style={[styles.credTitle, { color: c.text }]}>{cred.title}</Text>
                <Text style={[styles.credMeta, { color: c.muted }]}>
                  {cred.username ?? '—'} · {'•'.repeat(Math.min(cred.password.length, 10))}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Registro</Text>
          {log.length === 0 && (
            <Text style={[styles.credMeta, { color: c.muted }]}>Sin actividad todavía.</Text>
          )}
          {log.map((line, i) => (
            <Text key={i} style={[styles.logLine, { color: c.muted }]}>
              {line}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
  c,
  kind = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  c: typeof lightColors;
  kind?: 'primary' | 'ghost';
}) {
  const bg = kind === 'primary' ? c.accent : 'transparent';
  const fg = kind === 'primary' ? '#fff' : c.accent;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        { backgroundColor: bg, borderColor: c.accent, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const lightColors = {
  bg: '#F4F6FB',
  card: '#FFFFFF',
  border: '#E2E6EF',
  text: '#0B1220',
  muted: '#5B6472',
  accent: '#2F6BFF',
};

const darkColors = {
  bg: '#0B1220',
  card: '#131C2E',
  border: '#25314A',
  text: '#EAF0FF',
  muted: '#8A97AD',
  accent: '#4C86FF',
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingTop: 64, gap: 16 },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: -8 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  label: { fontSize: 12, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  button: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  credItem: { borderTopWidth: 1, paddingVertical: 8 },
  credTitle: { fontSize: 15, fontWeight: '500' },
  credMeta: { fontSize: 13, marginTop: 2 },
  logLine: { fontSize: 12, fontFamily: 'monospace', marginBottom: 2 },
});
