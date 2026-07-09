/** Componentes de UI reutilizables. */
import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';

import { FadeSlideIn, PopIn } from './motion';
import type { Theme } from './theme';

type ButtonKind = 'primary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  theme,
  kind = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  theme: Theme;
  kind?: ButtonKind;
  disabled?: boolean;
  loading?: boolean;
  style?: object;
}) {
  const bg = kind === 'primary' ? theme.accent : 'transparent';
  const border = kind === 'danger' ? theme.danger : theme.accent;
  const fg = kind === 'primary' ? theme.accentText : kind === 'danger' ? theme.danger : theme.accent;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: disabled || loading ? 0.45 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Card({
  theme,
  children,
  style,
}: {
  theme: Theme;
  children: ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>
      {children}
    </View>
  );
}

export function Field({
  theme,
  label,
  ...inputProps
}: { theme: Theme; label?: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.label, { color: theme.muted }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={theme.muted}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardAlt }]}
        {...inputProps}
      />
    </View>
  );
}

/** Campo de contraseña con botón de ojo para mostrar/ocultar. Oculta por defecto. */
export function PasswordField({
  theme,
  label,
  value,
  onChangeText,
  placeholder,
  autoFocus,
}: {
  theme: Theme;
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.label, { color: theme.muted }]}>{label}</Text> : null}
      <View style={styles.passwordRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.muted}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          style={[
            styles.input,
            styles.passwordInput,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardAlt },
          ]}
        />
        <TouchableOpacity
          onPress={() => setVisible((v) => !v)}
          style={[styles.eyeBtn, { borderColor: theme.border, backgroundColor: theme.cardAlt }]}
          accessibilityLabel={visible ? 'Ocultar' : 'Mostrar'}
        >
          <Text style={{ fontSize: 18 }}>{visible ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Botón de rueda dentada (ajustes). */
export function GearButton({ theme, onPress }: { theme: Theme; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.gear, { borderColor: theme.border, backgroundColor: theme.card }]}
      accessibilityLabel="Ajustes"
    >
      <Text style={{ fontSize: 20 }}>⚙️</Text>
    </TouchableOpacity>
  );
}

/** Cabecera de pantalla con título, subtítulo y acción opcional a la derecha. */
export function ScreenHeader({
  theme,
  title,
  subtitle,
  right,
}: {
  theme: Theme;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Aviso/banner de estado (info, éxito, error). */
export function Notice({
  theme,
  kind = 'info',
  children,
}: {
  theme: Theme;
  kind?: 'info' | 'success' | 'error' | 'warning';
  children: ReactNode;
}) {
  const color =
    kind === 'error' ? theme.danger : kind === 'success' ? theme.success : kind === 'warning' ? theme.warning : theme.muted;
  return (
    <FadeSlideIn>
      <View style={[styles.notice, { borderColor: color, backgroundColor: theme.cardAlt }]}>
        <Text style={[styles.noticeText, { color }]}>{children}</Text>
      </View>
    </FadeSlideIn>
  );
}

/** Fila etiqueta/valor para pantallas de ajustes. */
export function Row({
  theme,
  label,
  value,
  children,
}: {
  theme: Theme;
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.rowItem}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        {value ? <Text style={[styles.rowValue, { color: theme.muted }]}>{value}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** Diálogo de confirmación con el estilo de la app (sustituye a Alert nativo). */
export function ConfirmDialog({
  theme,
  visible,
  title,
  message,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  kind = 'danger',
  busy,
  onConfirm,
  onCancel,
}: {
  theme: Theme;
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  kind?: ButtonKind;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <PopIn style={styles.dialogWrap}>
          <View style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>{title}</Text>
            {message ? <Text style={[styles.dialogMsg, { color: theme.muted }]}>{message}</Text> : null}
            <View style={styles.dialogRow}>
              <Button theme={theme} label={cancelLabel} kind="ghost" onPress={onCancel} disabled={busy} />
              <Button theme={theme} label={confirmLabel} kind={kind} onPress={onConfirm} disabled={busy} loading={busy} />
            </View>
          </View>
        </PopIn>
      </View>
    </Modal>
  );
}

/** Texto de crédito de autoría, mostrado en varias pantallas. */
export const APP_CREDIT = 'Desarrollado y mantenido por ATS - Aragon Tech Solutions';

/** Pie de autoría reutilizable. */
export function Credit({ theme, style }: { theme: Theme; style?: object }) {
  return <Text style={[styles.credit, { color: theme.muted }, style]}>{APP_CREDIT}</Text>;
}

export const uiStyles = StyleSheet.create({
  buttonRow: { flexDirection: 'row', gap: 10 },
});

const styles = StyleSheet.create({
  button: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  passwordRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  passwordInput: { flex: 1 },
  eyeBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gear: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 2 },
  notice: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  noticeText: { fontSize: 13.5, lineHeight: 19 },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowValue: { fontSize: 13, marginTop: 2 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  dialogWrap: { width: '100%', maxWidth: 400 },
  dialog: { borderWidth: 1, borderRadius: 18, padding: 20, gap: 12 },
  dialogTitle: { fontSize: 18, fontWeight: '700' },
  dialogMsg: { fontSize: 14.5, lineHeight: 21 },
  dialogRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  credit: { fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 17 },
});
