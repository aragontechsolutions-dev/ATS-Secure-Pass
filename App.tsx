/**
 * ATS Secure Pass — shell de la aplicación.
 *
 * Enruta por fase:
 *   loading     → pantalla de carga
 *   onboarding  → crear la primera bóveda (sin contraseña por defecto)
 *   locked      → pantalla de bloqueo (huella automática + fallback master password)
 *   unlocked    → dashboard de credenciales / ajustes (⚙️)
 *
 * Requiere un development build (NO Expo Go): SQLCipher, Argon2, biometría,
 * secure-store con autenticación, screen-capture y jail-monkey son nativos.
 */
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View, useColorScheme } from 'react-native';

import { enableScreenProtection } from './src/security';
import { DashboardScreen } from './src/ui/screens/DashboardScreen';
import { LockScreen } from './src/ui/screens/LockScreen';
import { OnboardingScreen } from './src/ui/screens/OnboardingScreen';
import { SettingsScreen } from './src/ui/screens/SettingsScreen';
import { useTheme } from './src/ui/theme';
import { useController } from './src/ui/useController';

export default function App() {
  const scheme = useColorScheme();
  const { theme } = useTheme();
  const c = useController();

  // Anti-captura (FLAG_SECURE) a nivel de toda la app.
  useEffect(() => {
    enableScreenProtection().catch(() => undefined);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {c.phase === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : c.phase === 'onboarding' ? (
        <OnboardingScreen c={c} />
      ) : c.phase === 'locked' ? (
        <LockScreen c={c} />
      ) : c.route === 'settings' ? (
        <SettingsScreen c={c} />
      ) : (
        <DashboardScreen c={c} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
