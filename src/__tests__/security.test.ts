import { describe, it, expect } from 'vitest';
import { hasAdminClaim } from '../utils/adminClaims';

describe('hasAdminClaim', () => {
  it('concede privilegio solo con admin === true', () => {
    expect(hasAdminClaim({ admin: true })).toBe(true);
    expect(hasAdminClaim({ admin: true, email: 'otro@example.com' })).toBe(true);
  });

  it.each([
    ['admin como cadena', { admin: 'true' }],
    ['admin como número', { admin: 1 }],
    ['admin falso', { admin: false }],
    ['solo el correo histórico', { email: 'pretsodatabase@gmail.com' }],
    ['claims vacíos', {}],
  ])('deniega con %s', (_nombre, claims) => {
    expect(hasAdminClaim(claims)).toBe(false);
  });

  it('deniega con null o undefined', () => {
    expect(hasAdminClaim(null)).toBe(false);
    expect(hasAdminClaim(undefined)).toBe(false);
  });
});
