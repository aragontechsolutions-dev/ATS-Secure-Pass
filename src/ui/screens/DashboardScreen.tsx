/** Dashboard: bóveda desbloqueada. Busca, lista (paginada), añade, copia y revela. */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { Credential } from '../../db/credentials';
import { BrandIcon } from '../brandIcon';
import { Button, Card, ConfirmDialog, Credit, Field, GearButton, Notice, PasswordField, ScreenHeader } from '../components';
import { clampPage, filterCredentials, pageCount, paginate } from '../credentialQuery';
import { FadeSlideIn } from '../motion';
import type { Controller } from '../useController';
import { useTheme, type Theme } from '../theme';

const PAGE_SIZE = 10;

export function DashboardScreen({ c }: { c: Controller }) {
  const { theme } = useTheme();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Credential | null>(null);

  const filtered = useMemo(() => filterCredentials(c.credentials, query), [c.credentials, query]);
  const totalPages = pageCount(filtered.length, PAGE_SIZE);
  const safePage = clampPage(page, filtered.length, PAGE_SIZE);
  const visible = paginate(filtered, safePage, PAGE_SIZE);

  const resetForm = () => {
    setTitle('');
    setUsername('');
    setPassword('');
    setAdding(false);
  };

  const submit = async () => {
    await c.addCredential({ title: title.trim(), username: username.trim() || undefined, password });
    resetForm();
    setPage(1);
  };

  const doDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (target) await c.removeCredential(target.id);
  };

  const hasCreds = c.credentials.length > 0;

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

        {hasCreds ? (
          <Field
            theme={theme}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setPage(1);
            }}
            autoCapitalize="none"
            placeholder="🔍  Buscar por título, usuario o web…"
          />
        ) : null}

        {!hasCreds && !adding ? (
          <Card theme={theme}>
            <Text style={[styles.empty, { color: theme.muted }]}>
              Aún no tienes credenciales. Pulsa “Añadir credencial”.
            </Text>
          </Card>
        ) : null}

        {hasCreds && filtered.length === 0 ? (
          <Card theme={theme}>
            <Text style={[styles.empty, { color: theme.muted }]}>
              Sin resultados para “{query.trim()}”.
            </Text>
          </Card>
        ) : null}

        {visible.map((cred, i) => (
          <FadeSlideIn key={cred.id} delay={Math.min(i * 45, 300)}>
            <CredentialItem cred={cred} theme={theme} c={c} onDelete={setPendingDelete} />
          </FadeSlideIn>
        ))}

        {totalPages > 1 ? (
          <View style={styles.pager}>
            <Button
              theme={theme}
              label="‹ Anterior"
              kind="ghost"
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            />
            <Text style={[styles.pagerText, { color: theme.muted }]}>
              Página {safePage} de {totalPages}
            </Text>
            <Button
              theme={theme}
              label="Siguiente ›"
              kind="ghost"
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            />
          </View>
        ) : null}

        <Button theme={theme} label="🔒 Bloquear bóveda" kind="ghost" onPress={() => c.lock('manual')} />

        <Credit theme={theme} />
      </ScrollView>

      <ConfirmDialog
        theme={theme}
        visible={pendingDelete !== null}
        title="Eliminar credencial"
        message={
          pendingDelete
            ? `¿Seguro que deseas eliminar "${pendingDelete.title}"? Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        busy={c.busy}
        onConfirm={doDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </View>
  );
}

function CredentialItem({
  cred,
  theme,
  c,
  onDelete,
}: {
  cred: Credential;
  theme: Theme;
  c: Controller;
  onDelete: (cred: Credential) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Card theme={theme} style={{ gap: 10 }}>
      <View style={styles.credHead}>
        <BrandIcon title={cred.title} url={cred.url} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.credTitle, { color: theme.text }]} numberOfLines={1}>
            {cred.title}
          </Text>
          {cred.username ? (
            <Text style={[styles.credMeta, { color: theme.muted }]} numberOfLines={1}>
              {cred.username}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => onDelete(cred)} disabled={c.busy} hitSlop={8}>
          <Text style={{ fontSize: 18 }}>🗑️</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.credPwRow}>
        <Text style={[styles.credPw, { color: theme.text }]}>
          {visible ? cred.password : '•'.repeat(Math.min(cred.password.length, 12))}
        </Text>
        <TouchableOpacity onPress={() => setVisible((v) => !v)} style={styles.credAction} hitSlop={8}>
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
  credHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  credTitle: { fontSize: 17, fontWeight: '600' },
  credMeta: { fontSize: 14 },
  credPwRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  credPw: { flex: 1, fontSize: 16, fontFamily: 'monospace', letterSpacing: 1 },
  credAction: { padding: 4 },
  copyBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pagerText: { fontSize: 13, textAlign: 'center', minWidth: 96 },
});
