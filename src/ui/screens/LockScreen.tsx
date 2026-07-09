/**
 * Pantalla de bloqueo (app abierta, bóveda cerrada).
 *
 * Si el usuario activo tiene biometría activada y el dispositivo la soporta,
 * lanza el prompt de huella automáticamente al abrir. Siempre ofrece el fallback
 * por contraseña maestra. Si hay varios usuarios, muestra un selector.
 */
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button, Card, Credit, Notice, PasswordField, ScreenHeader } from '../components';
import { PopIn } from '../motion';
import type { Controller } from '../useController';
import { useTheme } from '../theme';

export function LockScreen({ c }: { c: Controller }) {
  const { theme } = useTheme();
  const [password, setPassword] = useState('');
  const autoTried = useRef<string | null>(null);

  const biometricAvailable =
    !!c.activeUser?.biometricEnabled && !!c.cap?.canUseForVault;

  // Lanza la huella automáticamente una vez por usuario activo.
  const { activeUserId, unlockWithBiometrics } = c;
  useEffect(() => {
    if (!biometricAvailable || !activeUserId) return;
    if (autoTried.current === activeUserId) return;
    autoTried.current = activeUserId;
    unlockWithBiometrics();
  }, [biometricAvailable, activeUserId, unlockWithBiometrics]);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <PopIn>
            <Text style={styles.lockIcon}>🔒</Text>
          </PopIn>
          <ScreenHeader theme={theme} title="ATS Secure Pass" subtitle="Desbloquea tu bóveda" />
        </View>

        {c.notice ? <Notice theme={theme} kind={c.notice.kind}>{c.notice.text}</Notice> : null}

        {c.users.length > 1 ? (
          <View style={styles.userRow}>
            {c.users.map((u) => {
              const active = u.id === c.activeUserId;
              return (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => c.setActiveUserId(u.id)}
                  style={[
                    styles.userChip,
                    {
                      borderColor: active ? theme.accent : theme.border,
                      backgroundColor: active ? theme.accent : theme.card,
                    },
                  ]}
                >
                  <Text style={{ color: active ? theme.accentText : theme.text, fontWeight: '600' }}>
                    {u.displayName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <Card theme={theme}>
          {biometricAvailable ? (
            <Button
              theme={theme}
              label="🔑 Desbloquear con huella"
              onPress={() => c.unlockWithBiometrics()}
              disabled={c.busy}
            />
          ) : null}

          <PasswordField
            theme={theme}
            label="Contraseña maestra"
            value={password}
            onChangeText={setPassword}
            placeholder="tu contraseña maestra"
            autoFocus={!biometricAvailable}
          />
          <Button
            theme={theme}
            label="Desbloquear"
            kind={biometricAvailable ? 'ghost' : 'primary'}
            onPress={() => c.unlockWithPassword(password)}
            disabled={c.busy || password.length === 0}
            loading={c.busy}
          />
        </Card>

        <Credit theme={theme} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingTop: 96, gap: 16 },
  hero: { alignItems: 'center', gap: 8 },
  lockIcon: { fontSize: 44 },
  userRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  userChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
});
