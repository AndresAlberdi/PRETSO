import { describe, it, expect, vi } from 'vitest';
import {
  AccountsAccessError, MAX_ACCOUNTS, assertAdmin, errorCodeOf, listAccounts, toAccountSummary,
  type AuthUserLike, type ListUsersPage,
} from '../../functions/src/accounts';

const usuario = (extra: Partial<AuthUserLike> = {}): AuthUserLike => ({
  email: 'a@example.com',
  disabled: false,
  customClaims: undefined,
  providerData: [],
  metadata: { lastSignInTime: undefined },
  ...extra,
});

describe('assertAdmin', () => {
  it('sin token: unauthenticated', () => {
    expect(() => assertAdmin(undefined)).toThrow(AccountsAccessError);
    try { assertAdmin(undefined); } catch (e) { expect((e as AccountsAccessError).code).toBe('unauthenticated'); }
  });

  it('sin el claim admin booleano: permission-denied', () => {
    for (const token of [{}, { admin: 'true' }, { admin: 1 }, { reader: true }]) {
      try { assertAdmin(token); expect.unreachable(); } catch (e) {
        expect((e as AccountsAccessError).code).toBe('permission-denied');
      }
    }
  });

  it('con admin === true pasa', () => {
    expect(() => assertAdmin({ admin: true })).not.toThrow();
  });
});

describe('toAccountSummary', () => {
  it('rol: admin gana a reader; sin claims es none', () => {
    expect(toAccountSummary(usuario({ customClaims: { admin: true, reader: true } })).role).toBe('admin');
    expect(toAccountSummary(usuario({ customClaims: { reader: true } })).role).toBe('reader');
    expect(toAccountSummary(usuario()).role).toBe('none');
    expect(toAccountSummary(usuario({ customClaims: { admin: 'true' } })).role).toBe('none');
  });

  it('proveedores: google, password y otro, sin duplicados', () => {
    const u = usuario({ providerData: [{ providerId: 'google.com' }, { providerId: 'password' }, { providerId: 'phone' }, { providerId: 'phone' }] });
    expect(toAccountSummary(u).providers).toEqual(['google', 'password', 'other']);
    expect(toAccountSummary(usuario()).providers).toEqual([]);
  });

  it('correo ausente es null', () => {
    expect(toAccountSummary(usuario({ email: undefined })).email).toBeNull();
  });

  it('último acceso en ISO; vacío o inválido es null', () => {
    expect(toAccountSummary(usuario({ metadata: { lastSignInTime: 'Thu, 01 Oct 2026 12:00:00 GMT' } })).lastSignInTime)
      .toBe('2026-10-01T12:00:00.000Z');
    for (const v of [undefined, null, '', 'no es fecha']) {
      expect(toAccountSummary(usuario({ metadata: { lastSignInTime: v } })).lastSignInTime).toBeNull();
    }
  });

  it('solo los cinco campos del contrato (sin uid ni hashes)', () => {
    const conSecretos = { ...usuario(), uid: 'UID', passwordHash: 'h', passwordSalt: 's', tokensValidAfterTime: 't' };
    expect(Object.keys(toAccountSummary(conSecretos)).sort())
      .toEqual(['disabled', 'email', 'lastSignInTime', 'providers', 'role']);
  });
});

describe('listAccounts', () => {
  it('rechaza antes de consultar nada', async () => {
    const listPage = vi.fn();
    await expect(listAccounts({ reader: true }, listPage)).rejects.toBeInstanceOf(AccountsAccessError);
    await expect(listAccounts(undefined, listPage)).rejects.toBeInstanceOf(AccountsAccessError);
    expect(listPage).not.toHaveBeenCalled();
  });

  it('une las páginas', async () => {
    const paginas: Record<string, ListUsersPage> = {
      inicio: { users: [usuario({ email: 'b@example.com' })], pageToken: 'p2' },
      p2: { users: [usuario({ email: 'c@example.com' })] },
    };
    const listPage = vi.fn(async (t?: string) => paginas[t ?? 'inicio']);
    const r = await listAccounts({ admin: true }, listPage);
    expect(r.accounts.map((a) => a.email)).toEqual(['b@example.com', 'c@example.com']);
    expect(r.truncated).toBe(false);
    expect(listPage).toHaveBeenCalledTimes(2);
  });

  it('tope de cuentas con aviso de truncado', async () => {
    const grande = Array.from({ length: MAX_ACCOUNTS }, (_, i) => usuario({ email: `u${i}@example.com` }));
    const r = await listAccounts({ admin: true }, async () => ({ users: grande, pageToken: 'mas' }));
    expect(r.accounts).toHaveLength(MAX_ACCOUNTS);
    expect(r.truncated).toBe(true);
  });

  it('orden: admin, lector, sin rol; por correo y sin correo al final', async () => {
    const r = await listAccounts({ admin: true }, async () => ({
      users: [
        usuario({ email: 'z@example.com', customClaims: { reader: true } }),
        usuario({ email: undefined, customClaims: { admin: true } }),
        usuario({ email: 'b@example.com', customClaims: { admin: true } }),
        usuario({ email: 'a@example.com' }),
        usuario({ email: 'a@example.com', customClaims: { reader: true } }),
      ],
    }));
    expect(r.accounts.map((a) => `${a.role}:${a.email}`)).toEqual([
      'admin:b@example.com', 'admin:null', 'reader:a@example.com', 'reader:z@example.com', 'none:a@example.com',
    ]);
  });

  it('propaga el fallo de la consulta', async () => {
    await expect(listAccounts({ admin: true }, async () => { throw new Error('x'); })).rejects.toThrow('x');
  });
});

describe('errorCodeOf', () => {
  it('devuelve el código o «sin código»', () => {
    expect(errorCodeOf({ code: 'auth/internal-error' })).toBe('auth/internal-error');
    expect(errorCodeOf(new Error('a@example.com'))).toBe('sin código');
    expect(errorCodeOf(null)).toBe('sin código');
  });
});
