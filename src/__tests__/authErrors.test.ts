import { describe, it, expect } from 'vitest';
import { ADMIN_GOOGLE_ONLY_MESSAGE, googleLoginErrorMessage, loginErrorCode } from '../utils/authErrors';

describe('loginErrorCode', () => {
  it('devuelve el code, el name del error o «sin código»', () => {
    expect(loginErrorCode({ code: 'auth/user-not-found', message: 'a@b.c' })).toBe('auth/user-not-found');
    expect(loginErrorCode(new TypeError('x'))).toBe('TypeError');
    expect(loginErrorCode({})).toBe('sin código');
    expect(loginErrorCode(null)).toBe('sin código');
    expect(loginErrorCode('texto')).toBe('sin código');
  });
});


describe('googleLoginErrorMessage', () => {
  const CERRADA = 'Se cerró la ventana de Google antes de terminar. Inténtelo de nuevo.';
  const NO_AUTORIZADA =
    'Esta cuenta de Google no está autorizada en PRETSO. Solicite el acceso a la administración del proyecto.';
  const GENERICO_GOOGLE = 'No se pudo iniciar sesión con Google. Inténtelo de nuevo.';
  const casos: Array<[string, string]> = [
    ['auth/popup-closed-by-user', CERRADA],
    ['auth/cancelled-popup-request', CERRADA],
    ['auth/user-cancelled', CERRADA],
    [
      'auth/popup-blocked',
      'El navegador bloqueó la ventana de Google. Permita las ventanas emergentes para este sitio e inténtelo de nuevo.',
    ],
    [
      'auth/account-exists-with-different-credential',
      'Su cuenta usa otro método de acceso. Comuníquese con la administración del proyecto.',
    ],
    ['auth/network-request-failed', 'No se pudo conectar. Revise su conexión e inténtelo de nuevo.'],
    ['auth/user-disabled', 'Su cuenta está deshabilitada. Comuníquese con la administración del proyecto.'],
    ['auth/admin-restricted-operation', NO_AUTORIZADA],
    ['auth/operation-not-allowed', NO_AUTORIZADA],
    ['auth/too-many-requests', 'Demasiados intentos. Espere unos minutos e inténtelo de nuevo.'],
    [
      'auth/web-storage-unsupported',
      'Su navegador bloquea el almacenamiento que requiere el inicio de sesión con Google. Habilítelo o use otro navegador.',
    ],
    ['auth/algo-raro', GENERICO_GOOGLE],
  ];

  it.each(casos)('%s produce su texto exacto', (code, texto) => {
    expect(googleLoginErrorMessage({ code })).toBe(texto);
  });

  it('los códigos equivalentes comparten texto', () => {
    expect(googleLoginErrorMessage({ code: 'auth/cancelled-popup-request' })).toBe(
      googleLoginErrorMessage({ code: 'auth/popup-closed-by-user' }),
    );
    expect(googleLoginErrorMessage({ code: 'auth/user-cancelled' })).toBe(
      googleLoginErrorMessage({ code: 'auth/popup-closed-by-user' }),
    );
    expect(googleLoginErrorMessage({ code: 'auth/operation-not-allowed' })).toBe(
      googleLoginErrorMessage({ code: 'auth/admin-restricted-operation' }),
    );
  });

  it('nunca muestra códigos, Firebase ni datos del error', () => {
    for (const [code] of casos) {
      const texto = googleLoginErrorMessage({ code, message: 'Firebase: Error (' + code + ')', customData: { email: 'a@b.com' } });
      expect(texto).not.toContain('auth/');
      expect(texto).not.toContain('Firebase');
      expect(texto).not.toContain('a@b.com');
    }
  });

  it('entradas sin forma de error producen el texto genérico', () => {
    for (const entrada of [new Error('x'), null, {}, 'x', { code: 42 }]) {
      expect(googleLoginErrorMessage(entrada)).toBe(GENERICO_GOOGLE);
    }
  });
});

describe('ADMIN_GOOGLE_ONLY_MESSAGE', () => {
  it('texto exacto y sin códigos de Firebase', () => {
    expect(ADMIN_GOOGLE_ONLY_MESSAGE).toBe(
      'Las cuentas de administración solo pueden entrar con «Continuar con Google». Se cerró la sesión; vuelva a entrar con Google.');
    expect(ADMIN_GOOGLE_ONLY_MESSAGE).not.toContain('auth/');
  });
});
