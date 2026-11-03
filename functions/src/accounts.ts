// Lógica pura de la lista de cuentas (sin firebase-admin ni firebase-functions): se prueba con el
// Vitest de la raíz (tests/functions). index.ts solo la envuelve en la función callable.

export type AccountRole = "admin" | "reader" | "none";
export type AccountProvider = "google" | "password" | "other";

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

export interface AuthUserLike {
  email?: string;
  disabled: boolean;
  customClaims?: Record<string, unknown>;
  providerData: Array<{ providerId: string }>;
  metadata: { lastSignInTime?: string | null };
}

export interface ListUsersPage {
  users: AuthUserLike[];
  pageToken?: string;
}

export const MAX_ACCOUNTS = 1000;
export const PAGE_SIZE = 1000;

export class AccountsAccessError extends Error {
  constructor(public readonly code: "unauthenticated" | "permission-denied", message: string) {
    super(message);
    this.name = "AccountsAccessError";
  }
}

export function assertAdmin(token: Record<string, unknown> | undefined): void {
  if (!token) {
    throw new AccountsAccessError("unauthenticated", "Debe iniciar sesión para ver la lista de usuarios.");
  }
  if (token.admin !== true) {
    throw new AccountsAccessError("permission-denied", "Solo un administrador puede ver la lista de usuarios.");
  }
}

function roleOf(claims: Record<string, unknown> | undefined): AccountRole {
  if (claims?.admin === true) return "admin";
  if (claims?.reader === true) return "reader";
  return "none";
}

function providersOf(user: AuthUserLike): AccountProvider[] {
  const out: AccountProvider[] = [];
  for (const { providerId } of user.providerData) {
    const p: AccountProvider = providerId === "google.com" ? "google" : providerId === "password" ? "password" : "other";
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

function isoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = new Date(value);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

// Solo los cinco campos del contrato: nunca uid, hashes ni claims crudos.
export function toAccountSummary(user: AuthUserLike): AccountSummary {
  return {
    email: user.email ?? null,
    role: roleOf(user.customClaims),
    providers: providersOf(user),
    disabled: user.disabled === true,
    lastSignInTime: isoOrNull(user.metadata?.lastSignInTime),
  };
}

const ROLE_ORDER: Record<AccountRole, number> = { admin: 0, reader: 1, none: 2 };

function compareAccounts(a: AccountSummary, b: AccountSummary): number {
  if (ROLE_ORDER[a.role] !== ROLE_ORDER[b.role]) return ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
  if (a.email === null && b.email === null) return 0;
  if (a.email === null) return 1;
  if (b.email === null) return -1;
  return a.email.localeCompare(b.email, "es");
}

export async function listAccounts(
  token: Record<string, unknown> | undefined,
  listPage: (pageToken?: string) => Promise<ListUsersPage>
): Promise<ListAccountsResult> {
  assertAdmin(token);
  const accounts: AccountSummary[] = [];
  let pageToken: string | undefined;
  do {
    const page = await listPage(pageToken);
    for (const u of page.users) accounts.push(toAccountSummary(u));
    pageToken = page.pageToken;
  } while (pageToken && accounts.length < MAX_ACCOUNTS);
  const truncated = Boolean(pageToken) || accounts.length > MAX_ACCOUNTS;
  accounts.length = Math.min(accounts.length, MAX_ACCOUNTS);
  accounts.sort(compareAccounts);
  return { accounts, truncated };
}

export function errorCodeOf(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && code !== "" ? code : "sin código";
}
