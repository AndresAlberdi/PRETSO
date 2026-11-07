import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { loginErrorCode } from './authErrors';

// Contrato: functions/src/accounts.ts
export type AccountRole = 'admin' | 'reader' | 'none';
export type AccountProvider = 'google' | 'password' | 'other';

export interface AccountSummary {
  email: string | null;
  role: AccountRole;
  providers: AccountProvider[];
  disabled: boolean;
  lastSignInTime: string | null;
}

export interface ListAccountsResult {
  accounts: AccountSummary[];
  truncated: boolean;
}

export const MAX_ACCOUNTS_SHOWN = 1000;

export const ROLE_LABELS: Record<AccountRole, string> = { admin: 'Administrador', reader: 'Lector', none: 'Sin rol' };
export const PROVIDER_LABELS: Record<AccountProvider, string> = { google: 'Google', password: 'Contraseña', other: 'Otro' };

const ROLES: readonly string[] = ['admin', 'reader', 'none'];
const PROVIDERS: readonly string[] = ['google', 'password', 'other'];

const INVALID = 'respuesta-invalida';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Valida la forma de la respuesta y copia solo los cinco campos del contrato (nada más llega a la pantalla).
export function parseAccountsResult(data: unknown): ListAccountsResult {
  if (!isObject(data) || !Array.isArray(data.accounts) || typeof data.truncated !== 'boolean') throw new Error(INVALID);
  const accounts = data.accounts.map((raw): AccountSummary => {
    if (!isObject(raw)) throw new Error(INVALID);
    const { email, role, providers, disabled, lastSignInTime } = raw;
    if (email !== null && typeof email !== 'string') throw new Error(INVALID);
    if (typeof role !== 'string' || !ROLES.includes(role)) throw new Error(INVALID);
    if (!Array.isArray(providers) || !providers.every((p) => typeof p === 'string' && PROVIDERS.includes(p))) throw new Error(INVALID);
    if (typeof disabled !== 'boolean') throw new Error(INVALID);
    if (lastSignInTime !== null && typeof lastSignInTime !== 'string') throw new Error(INVALID);
    return {
      email,
      role: role as AccountRole,
      providers: providers as AccountProvider[],
      disabled,
      lastSignInTime,
    };
  });
  return { accounts, truncated: data.truncated };
}

export async function fetchAccounts(): Promise<ListAccountsResult> {
  const result = await httpsCallable(functions, 'listAccounts')();
  return parseAccountsResult(result.data);
}

export function formatLastSignIn(iso: string | null): string {
  if (iso === null) return 'Nunca';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return 'Nunca';
  return new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(fecha);
}

export function accountsErrorMessage(err: unknown): string {
  switch (loginErrorCode(err)) {
    case 'functions/permission-denied':
      return 'Su cuenta no tiene permiso para ver la lista de usuarios.';
    case 'functions/unauthenticated':
      return 'Su sesión expiró. Vuelva a iniciar sesión.';
    default:
      return 'No se pudo cargar la lista de usuarios. Inténtelo de nuevo.';
  }
}
