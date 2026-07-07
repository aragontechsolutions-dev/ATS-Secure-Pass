/** Dashboard: bóveda desbloqueada. Lista, añade, copia y revela credenciales. */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { Credential } from '../../db/credentials';
import { Button, Card, Field, GearButton, Notice, PasswordField, ScreenHeader } from '../components';
import type { Controller } from '../useController';
import { useTheme, type Theme } from '../theme';

export function DashboardScreen({ c }: { c: Controller }) {
  const { theme } = useTheme();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const resetForm = () => {
    setTitle('');
    setUsername('');
    setPassword('');
    setAdding(false);
  };

  const submit = async () => {
    await c.addCredential({ title: title.trim(), username: username.trim() || undefined, password });
    resetForm();
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]} onTouchStart={c.notifyActivity}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          theme={theme}
          title={c.activeUser?.displayName ?? 'Bóveda'}
          subtitle={`${c.credentials.length} credencial${c.credentials.length === 1 ? '' : 'es'}`}
          right={<GearButton theme={theme} onPress={() => c.setRoute('settings')} />}
        />

        {c.notice ? <Notice theme={theme} kind={c.notice.kind}>{c.notice.text}</Notice> : null}

        {adding ? (
          <Card theme={theme}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Nueva credencial</Text>
            <Field theme={theme} label="Título" value={title} onChangeText={setTitle} placeholder="p. ej. GitHub" />
            <Field
              theme={theme}
              label="Usuario / email"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholder="usuario@correo.com"
            />
            <PasswordField theme={theme} label="Contraseña" value={password} onChangeText={setPassword} placeholder="contraseña" />
            <View style={styles.btnRow}>
              <Button theme={theme} label="Cancelar" kind="ghost" onPress={resetForm} disabled={c.busy} />
              <Button
                theme={theme}
                label="Guardar"
                onPress={submit}
                disabled={c.busy || !title.trim() || !password}
                loading={c.busy}
              />
            </View>
          </Card>
        ) : (
          <Button theme={theme} label="＋ Añadir credencial" onPress={() => setAdding(true)} disabled={c.busy} />
        )}

        {c.credentials.length === 0 && !adding ? (
          <Card theme={theme}>
            <Text style={[styles.empty, { color: theme.muted }]}>
              Aún no tienes credenciales. Pulsa “Añadir credencial”.
            </Text>
          </Card>
        ) : null}

        {c.credentials.map((cred) => (
          <CredentialItem key={cred.id} cred={cred} theme={theme} c={c} />
        ))}

        <Button theme={theme} label="🔒 Bloquear bóveda" kind="ghost" onPress={() => c.lock('manual')} />
      </ScrollView>
    </View>
  );
}

function CredentialItem({ cred, theme, c }: { cred: Credential; theme: Theme; c: Controller }) {
  const [visible, setVisible] = useState(false);
  return (
    <Card theme={theme} style={{ gap: 6 }}>
      <View style={styles.credHead}>
        <Text style={[styles.credTitle, { color: theme.text }]}>{cred.title}</Text>
        <TouchableOpacity onPress={() => c.removeCredential(cred.id)} disabled={c.busy}>
          <Text style={{ fontSize: 18 }}>🗑️</Text>
        </TouchableOpacity>
      </View>
      {cred.username ? (
        <Text style={[styles.credMeta, { color: theme.muted }]}>{cred.username}</Text>
      ) : null}
      <View style={styles.credPwRow}>
        <Text style={[styles.credPw, { color: theme.text }]}>
          {visible ? cred.password : '•'.repeat(Math.min(cred.password.length, 12))}
        </Text>
        <TouchableOpacity onPress={() => setVisible((v) => !v)} style={styles.credAction}>
          <Text style={{ fontSize: 18 }}>{visible ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => c.copyPassword(cred)}
          disabled={c.busy}
          style={[styles.copyBtn, { borderColor: theme.accent }]}
        >
          <Text style={{ color: theme.accent, fontWeight: '600' }}>Copiar</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingTop: 64, gap: 14 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  credHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  credTitle: { fontSize: 17, fontWeight: '600' },
  credMeta: { fontSize: 14 },
  credPwRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  credPw: { flex: 1, fontSize: 16, fontFamily: 'monospace', letterSpacing: 1 },
  credAction: { padding: 4 },
  copyBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
});
