/** Pantalla de primer uso: crear la primera bóveda (sin credenciales por defecto). */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Notice, PasswordField, ScreenHeader } from '../components';
import type { Controller } from '../useController';
import { useTheme } from '../theme';

export function OnboardingScreen({ c }: { c: Controller }) {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    name.trim().length > 0 && password.length >= 8 && password === confirm && !c.busy;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader theme={theme} title="ATS Secure Pass" subtitle="Crea tu bóveda cifrada" />

        {c.notice ? <Notice theme={theme} kind={c.notice.kind}>{c.notice.text}</Notice> : null}

        <Card theme={theme}>
          <Text style={[styles.intro, { color: theme.muted }]}>
            Elige un nombre y una contraseña maestra. La contraseña maestra cifra tu bóveda con
            Argon2id + AES-256 y NO se puede recuperar si la olvidas: no hay contraseña por defecto.
          </Text>

          <Field
            theme={theme}
            label="Nombre de usuario"
            value={name}
            onChangeText={setName}
            autoCapitalize="none"
            placeholder="p. ej. personal"
          />
          <PasswordField
            theme={theme}
            label="Contraseña maestra"
            value={password}
            onChangeText={setPassword}
            placeholder="mínimo 8 caracteres"
          />
          {tooShort ? (
            <Text style={[styles.hint, { color: theme.warning }]}>
              Usa al menos 8 caracteres (mejor una frase larga).
            </Text>
          ) : null}
          <PasswordField
            theme={theme}
            label="Repite la contraseña maestra"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="repite la contraseña"
          />
          {mismatch ? (
            <Text style={[styles.hint, { color: theme.danger }]}>No coinciden.</Text>
          ) : null}

          <Button
            theme={theme}
            label="Crear bóveda"
            onPress={() => c.createFirstVault(name.trim(), password)}
            disabled={!canSubmit}
            loading={c.busy}
            style={{ marginTop: 4 }}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingTop: 64, gap: 16 },
  intro: { fontSize: 13.5, lineHeight: 20 },
  hint: { fontSize: 12.5 },
});
