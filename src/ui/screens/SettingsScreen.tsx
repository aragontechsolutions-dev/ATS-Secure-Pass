/** Ajustes: biometría, auto-lock, integridad y diagnóstico. */
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import { describeBiometrics } from '../../auth/biometrics';
import { Button, Card, Notice, PasswordField, Row, ScreenHeader } from '../components';
import type { Controller } from '../useController';
import { useTheme } from '../theme';

export function SettingsScreen({ c }: { c: Controller }) {
  const { theme } = useTheme();
  const [enrolling, setEnrolling] = useState(false);
  const [password, setPassword] = useState('');

  const bioEnabled = !!c.activeUser?.biometricEnabled;
  const canUseBio = !!c.cap?.canUseForVault;

  const bioStatus = c.cap
    ? `${describeBiometrics(c.cap)} · ${
        c.cap.canUseForVault
          ? 'disponible (Class 3)'
          : c.cap.isEnrolled
            ? 'no es biometría fuerte (Class 2)'
            : 'no configurada'
      }`
    : 'comprobando…';

  const doEnroll = async () => {
    await c.enableBiometrics(password);
    setPassword('');
    setEnrolling(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]} onTouchStart={c.notifyActivity}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          theme={theme}
          title="Ajustes"
          right={
            <TouchableOpacity onPress={() => c.setRoute('dashboard')}>
              <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '600' }}>Listo</Text>
            </TouchableOpacity>
          }
        />

        {c.notice ? <Notice theme={theme} kind={c.notice.kind}>{c.notice.text}</Notice> : null}

        {/* Biometría */}
        <Card theme={theme}>
          <Text style={[styles.section, { color: theme.text }]}>Biometría</Text>
          <Text style={[styles.desc, { color: theme.muted }]}>{bioStatus}</Text>

          {bioEnabled ? (
            <Button theme={theme} label="Desactivar biometría" kind="danger" onPress={c.disableBiometrics} disabled={c.busy} />
          ) : enrolling ? (
            <>
              <Text style={[styles.desc, { color: theme.muted }]}>
                Confirma tu contraseña maestra para envolver la clave con el Keystore.
              </Text>
              <PasswordField theme={theme} value={password} onChangeText={setPassword} placeholder="contraseña maestra" autoFocus />
              <View style={styles.btnRow}>
                <Button theme={theme} label="Cancelar" kind="ghost" onPress={() => { setEnrolling(false); setPassword(''); }} disabled={c.busy} />
                <Button theme={theme} label="Activar" onPress={doEnroll} disabled={c.busy || !password} loading={c.busy} />
              </View>
            </>
          ) : (
            <Button
              theme={theme}
              label="Activar biometría"
              onPress={() => setEnrolling(true)}
              disabled={c.busy || !canUseBio}
            />
          )}
          {!canUseBio && !bioEnabled ? (
            <Text style={[styles.hint, { color: theme.warning }]}>
              Necesitas una huella (biometría fuerte, Class 3) configurada en el sistema.
            </Text>
          ) : null}
        </Card>

        {/* Auto-lock */}
        <Card theme={theme}>
          <Text style={[styles.section, { color: theme.text }]}>Bloqueo automático</Text>
          <Row theme={theme} label="Bloquear al salir e inactividad" value="Al ir a segundo plano y tras 3 min sin uso">
            <Switch value={c.autoLockOn} onValueChange={c.setAutoLockOn} />
          </Row>
        </Card>

        {/* Copia de seguridad */}
        <Card theme={theme}>
          <Text style={[styles.section, { color: theme.text }]}>Copia de seguridad</Text>
          <Text style={[styles.desc, { color: theme.muted }]}>
            El backup incluye tu bóveda cifrada (SQLCipher) y solo se abre con tu contraseña
            maestra. Guárdalo en un lugar seguro (Drive, correo…).
          </Text>
          <View style={styles.btnRow}>
            <Button theme={theme} label="Compartir backup" onPress={c.exportBackup} disabled={c.busy} />
            <Button theme={theme} label="Guardar en teléfono" onPress={c.saveBackupToDevice} disabled={c.busy} />
          </View>
          <Button theme={theme} label="Restaurar desde backup" kind="ghost" onPress={c.importBackup} disabled={c.busy} />
        </Card>

        {/* Seguridad / diagnóstico */}
        <Card theme={theme}>
          <Text style={[styles.section, { color: theme.text }]}>Seguridad del dispositivo</Text>
          <Text style={[styles.desc, { color: theme.muted }]}>
            🛡️ Anti-captura (FLAG_SECURE): activo
          </Text>
          <Text style={[styles.desc, { color: c.integrity?.isCompromised ? theme.danger : theme.muted }]}>
            {c.integrity
              ? c.integrity.isCompromised
                ? `⚠️ Dispositivo comprometido (root:${c.integrity.isJailBroken ? 'sí' : 'no'} · hook:${c.integrity.isHooked ? 'sí' : 'no'})`
                : '✅ Integridad OK (sin root/hook detectado)'
              : 'comprobando integridad…'}
          </Text>
          <Row
            theme={theme}
            label="Benchmark del KDF (Argon2id)"
            value={c.lastBenchmarkMs != null ? `Última medición: ${c.lastBenchmarkMs} ms` : 'objetivo 250–400 ms'}
          >
            <Button theme={theme} label="Medir" kind="ghost" onPress={c.runBenchmark} disabled={c.busy} style={{ flex: 0, paddingHorizontal: 18 }} />
          </Row>
        </Card>

        <Text style={[styles.footer, { color: theme.muted }]}>
          ATS Secure Pass · cifrado SQLCipher (AES-256) + Argon2id · sin contraseña por defecto
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingTop: 64, gap: 14 },
  section: { fontSize: 16, fontWeight: '600' },
  desc: { fontSize: 13.5, lineHeight: 19 },
  hint: { fontSize: 12.5 },
  btnRow: { flexDirection: 'row', gap: 10 },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
