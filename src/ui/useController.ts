/**
 * Controlador central de la app: mantiene todo el estado y expone las acciones
 * que consumen las pantallas. Aísla la lógica de la UI de presentación.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getBiometricCapability,
  type BiometricCapability,
} from '../auth/biometrics';
import { BiometricUnlockError } from '../auth/errors';
import { benchmarkArgon2id } from '../crypto/kdf';
import { DEFAULT_ARGON2ID_PARAMS } from '../crypto/params';
import {
  countCredentials,
  createCredential,
  deleteCredential,
  listCredentials,
  type Credential,
  type NewCredential,
} from '../db/credentials';
import { InvalidMasterPasswordError } from '../db/errors';
import { exportVault, restoreVault } from '../backup';
import {
  clearClipboardNow,
  copyWithAutoClear,
  getDeviceIntegrity,
  useAutoLock,
  type DeviceIntegrity,
} from '../security';
import { listUsers, type UserRecord } from '../vault/manifest';
import {
  createVault,
  disableBiometricUnlock,
  enableBiometricUnlock,
  lockVault,
  unlockVault,
  unlockVaultWithBiometrics,
  type VaultSession,
} from '../vault/vaultManager';

export type AppPhase = 'loading' | 'onboarding' | 'locked' | 'unlocked';
export type Route = 'dashboard' | 'settings';

export interface Notice {
  kind: 'info' | 'success' | 'error' | 'warning';
  text: string;
}

export interface Controller {
  phase: AppPhase;
  route: Route;
  busy: boolean;
  notice: Notice | null;
  users: UserRecord[];
  activeUserId: string | null;
  activeUser: UserRecord | undefined;
  cap: BiometricCapability | null;
  integrity: DeviceIntegrity | null;
  session: VaultSession | null;
  credentials: Credential[];
  autoLockOn: boolean;
  lastBenchmarkMs: number | null;

  setActiveUserId: (id: string) => void;
  setRoute: (r: Route) => void;
  setAutoLockOn: (v: boolean) => void;
  dismissNotice: () => void;
  notifyActivity: () => void;

  createFirstVault: (name: string, password: string) => Promise<void>;
  unlockWithPassword: (password: string) => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
  lock: (reason?: string) => Promise<void>;
  enableBiometrics: (password: string) => Promise<void>;
  disableBiometrics: () => Promise<void>;
  addCredential: (input: NewCredential) => Promise<void>;
  removeCredential: (id: string) => Promise<void>;
  copyPassword: (cred: Credential) => Promise<void>;
  runBenchmark: () => Promise<void>;
  exportBackup: () => Promise<void>;
  importBackup: () => Promise<void>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function useController(): Controller {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [cap, setCap] = useState<BiometricCapability | null>(null);
  const [integrity, setIntegrity] = useState<DeviceIntegrity | null>(null);
  const [session, setSession] = useState<VaultSession | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [route, setRoute] = useState<Route>('dashboard');
  const [autoLockOn, setAutoLockOn] = useState(true);
  const [lastBenchmarkMs, setLastBenchmarkMs] = useState<number | null>(null);

  // Evita que el auto-lock se dispare mientras un prompt biométrico manda la app
  // a segundo plano (el OS backgroundea la app durante la autenticación).
  const authInProgress = useRef(false);

  const activeUser = useMemo(
    () => users.find((u) => u.id === activeUserId),
    [users, activeUserId]
  );

  const refreshUsers = useCallback(async () => {
    const list = await listUsers();
    setUsers(list);
    setActiveUserId((prev) => prev ?? list[0]?.id ?? null);
    return list;
  }, []);

  // Carga inicial: usuarios, capacidades biométricas e integridad del dispositivo.
  useEffect(() => {
    (async () => {
      try {
        await refreshUsers();
        setCap(await getBiometricCapability());
        setIntegrity(getDeviceIntegrity());
      } catch (err) {
        setNotice({ kind: 'error', text: errorMessage(err) });
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshUsers]);

  const refreshCreds = useCallback(async (s: VaultSession) => {
    setCredentials(await listCredentials(s.db));
  }, []);

  const lock = useCallback(
    async (reason = 'manual') => {
      const s = session;
      if (!s) return;
      await lockVault(s);
      setSession(null);
      setCredentials([]);
      setRoute('dashboard');
      await clearClipboardNow();
      if (reason !== 'silent') {
        setNotice({ kind: 'info', text: 'Bóveda bloqueada.' });
      }
    },
    [session]
  );

  // Auto-lock (segundo plano + inactividad), respetando el guard de auth.
  const { notifyActivity } = useAutoLock({
    enabled: autoLockOn && !!session,
    backgroundGraceMs: 0,
    inactivityMs: 3 * 60 * 1000,
    onLock: () => {
      if (authInProgress.current) return;
      lock('auto-lock').catch(() => undefined);
    },
  });

  const withBusy = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }, []);

  const createFirstVault = useCallback(
    (name: string, password: string) =>
      withBusy(async () => {
        try {
          const s = await createVault({ displayName: name, masterPassword: password });
          await refreshUsers();
          setActiveUserId(s.userId);
          setSession(s);
          await refreshCreds(s);
          setRoute('dashboard');
          setNotice({ kind: 'success', text: `Bóveda creada para "${s.displayName}".` });
        } catch (err) {
          setNotice({ kind: 'error', text: errorMessage(err) });
        }
      }),
    [withBusy, refreshUsers, refreshCreds]
  );

  const unlockWithPassword = useCallback(
    (password: string) =>
      withBusy(async () => {
        if (!activeUserId) return;
        try {
          const s = await unlockVault(activeUserId, password);
          setSession(s);
          await refreshCreds(s);
          setRoute('dashboard');
          setNotice(null);
        } catch (err) {
          if (err instanceof InvalidMasterPasswordError) {
            setNotice({ kind: 'error', text: 'Contraseña maestra incorrecta.' });
            return;
          }
          setNotice({ kind: 'error', text: errorMessage(err) });
        }
      }),
    [withBusy, activeUserId, refreshCreds]
  );

  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    if (!activeUserId) return false;
    authInProgress.current = true;
    let ok = false;
    try {
      const s = await unlockVaultWithBiometrics(activeUserId);
      setSession(s);
      await refreshCreds(s);
      setRoute('dashboard');
      setNotice(null);
      ok = true;
    } catch (err) {
      if (err instanceof BiometricUnlockError) {
        if (err.reason === 'invalidated') {
          setNotice({
            kind: 'warning',
            text: 'Tu biometría cambió. Entra con la contraseña maestra y vuelve a activarla.',
          });
        } else if (err.reason === 'not-enrolled') {
          // silencioso: simplemente no había biometría configurada
        } else if (err.reason !== 'failed') {
          setNotice({ kind: 'error', text: err.message });
        }
      } else {
        setNotice({ kind: 'error', text: errorMessage(err) });
      }
    } finally {
      // Deja un margen para que AppState vuelva a 'active' sin disparar auto-lock.
      setTimeout(() => {
        authInProgress.current = false;
      }, 1000);
    }
    return ok;
  }, [activeUserId, refreshCreds]);

  const enableBiometrics = useCallback(
    (password: string) =>
      withBusy(async () => {
        if (!activeUserId) return;
        authInProgress.current = true;
        try {
          await enableBiometricUnlock(activeUserId, password);
          await refreshUsers();
          setNotice({ kind: 'success', text: 'Biometría activada.' });
        } catch (err) {
          if (err instanceof InvalidMasterPasswordError) {
            setNotice({ kind: 'error', text: 'Contraseña maestra incorrecta.' });
          } else if (err instanceof BiometricUnlockError) {
            setNotice({ kind: 'error', text: err.message });
          } else {
            setNotice({ kind: 'error', text: errorMessage(err) });
          }
        } finally {
          setTimeout(() => {
            authInProgress.current = false;
          }, 1000);
        }
      }),
    [withBusy, activeUserId, refreshUsers]
  );

  const disableBiometrics = useCallback(
    () =>
      withBusy(async () => {
        if (!activeUserId) return;
        await disableBiometricUnlock(activeUserId);
        await refreshUsers();
        setNotice({ kind: 'info', text: 'Biometría desactivada.' });
      }),
    [withBusy, activeUserId, refreshUsers]
  );

  const addCredential = useCallback(
    (input: NewCredential) =>
      withBusy(async () => {
        if (!session) return;
        await createCredential(session.db, input);
        await refreshCreds(session);
        setNotice({ kind: 'success', text: `"${input.title}" guardada.` });
      }),
    [withBusy, session, refreshCreds]
  );

  const removeCredential = useCallback(
    (id: string) =>
      withBusy(async () => {
        if (!session) return;
        await deleteCredential(session.db, id);
        await refreshCreds(session);
      }),
    [withBusy, session, refreshCreds]
  );

  const copyPassword = useCallback(
    (cred: Credential) =>
      withBusy(async () => {
        const { ttlMs } = await copyWithAutoClear(cred.password);
        setNotice({
          kind: 'info',
          text: `Contraseña copiada. Se limpiará en ${Math.round(ttlMs / 1000)} s.`,
        });
      }),
    [withBusy]
  );

  const runBenchmark = useCallback(
    () =>
      withBusy(async () => {
        const { durationMs, params } = await benchmarkArgon2id(DEFAULT_ARGON2ID_PARAMS);
        setLastBenchmarkMs(durationMs);
        const inWindow = durationMs >= 250 && durationMs <= 400;
        setNotice({
          kind: inWindow ? 'success' : 'warning',
          text: `Argon2id (t=${params.iterations}): ${durationMs} ms ${
            inWindow ? '· en ventana ✅' : '· fuera de 250–400 ms'
          }`,
        });
      }),
    [withBusy]
  );

  const exportBackup = useCallback(
    () =>
      withBusy(async () => {
        if (!session || !activeUser) return;
        authInProgress.current = true; // compartir manda la app a segundo plano
        try {
          await exportVault(session, {
            displayName: activeUser.displayName,
            saltHex: activeUser.saltHex,
            kdf: activeUser.kdf,
          });
          setNotice({ kind: 'success', text: 'Backup generado. Elige dónde guardarlo.' });
        } catch (err) {
          setNotice({ kind: 'error', text: errorMessage(err) });
        } finally {
          setTimeout(() => {
            authInProgress.current = false;
          }, 1000);
        }
      }),
    [withBusy, session, activeUser]
  );

  const importBackup = useCallback(
    () =>
      withBusy(async () => {
        authInProgress.current = true; // el selector de archivos backgroundea la app
        try {
          const res = await restoreVault();
          if (!res) return; // el usuario canceló
          await refreshUsers();
          setActiveUserId(res.userId);
          setNotice({
            kind: 'success',
            text: `Bóveda "${res.displayName}" restaurada. Desbloquéala con tu contraseña maestra.`,
          });
        } catch (err) {
          setNotice({ kind: 'error', text: errorMessage(err) });
        } finally {
          setTimeout(() => {
            authInProgress.current = false;
          }, 1000);
        }
      }),
    [withBusy, refreshUsers]
  );

  const phase: AppPhase = loading
    ? 'loading'
    : session
      ? 'unlocked'
      : users.length === 0
        ? 'onboarding'
        : 'locked';

  return {
    phase,
    route,
    busy,
    notice,
    users,
    activeUserId,
    activeUser,
    cap,
    integrity,
    session,
    credentials,
    autoLockOn,
    lastBenchmarkMs,
    setActiveUserId,
    setRoute,
    setAutoLockOn,
    dismissNotice: () => setNotice(null),
    notifyActivity,
    createFirstVault,
    unlockWithPassword,
    unlockWithBiometrics,
    lock,
    enableBiometrics,
    disableBiometrics,
    addCredential,
    removeCredential,
    copyPassword,
    runBenchmark,
    exportBackup,
    importBackup,
  };
}
