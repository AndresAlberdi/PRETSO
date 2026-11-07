import { describe, it, expect } from 'vitest';
import { codigoError } from '../utils/codigoError';
import { loginErrorCode } from '../utils/authErrors';

describe('codigoError', () => {
  it('devuelve el code cuando existe', () => {
    expect(codigoError({ code: 'permission-denied', name: 'FirebaseError' })).toBe('permission-denied');
  });
  it('usa el name si no hay code', () => {
    expect(codigoError(new TypeError('detalle'))).toBe('TypeError');
    expect(codigoError({ code: '', name: 'AbortError' })).toBe('AbortError');
  });
  it('devuelve «sin código» sin code ni name', () => {
    expect(codigoError({})).toBe('sin código');
    expect(codigoError(null)).toBe('sin código');
    expect(codigoError(undefined)).toBe('sin código');
    expect(codigoError('texto con datos personales')).toBe('sin código');
  });
  it('loginErrorCode delega en él', () => {
    expect(loginErrorCode({ code: 'auth/x' })).toBe('auth/x');
  });
});
