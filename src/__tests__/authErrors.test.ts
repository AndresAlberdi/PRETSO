import { describe, it, expect } from 'vitest';
import { loginErrorMessage } from '../utils/authErrors';

const CRED = 'Correo o contraseña incorrectos.';

describe('loginErrorMessage', () => {
  it('cada código produce su texto', () => {
    expect(loginErrorMessage({ code: 'auth/invalid-credential' })).toBe(CRED);
    expect(loginErrorMessage({ code: 'auth/invalid-email' })).toBe(CRED);
    expect(loginErrorMessage({ code: 'auth/too-many-requests' })).toBe(
      'Demasiados intentos. Espere unos minutos e inténtelo de nuevo.',
    );
    expect(loginErrorMessage({ code: 'auth/network-request-failed' })).toBe(
      'No se pudo conectar. Revise su conexión e inténtelo de nuevo.',
    );
    expect(loginErrorMessage({ code: 'auth/algo-raro' })).toBe('No se pudo iniciar sesión. Inténtelo de nuevo.');
  });

  it('no distingue usuario inexistente, contraseña incorrecta ni cuenta deshabilitada', () => {
    const base = loginErrorMessage({ code: 'auth/invalid-credential' });
    expect(loginErrorMessage({ code: 'auth/user-not-found' })).toBe(base);
    expect(loginErrorMessage({ code: 'auth/wrong-password' })).toBe(base);
    expect(loginErrorMessage({ code: 'auth/user-disabled' })).toBe(base);
  });

  it('el mensaje de configuración se detecta por código o por texto y usa «habilítela»', () => {
    const porCodigo = loginErrorMessage({ code: 'auth/configuration-not-found' });
    const porTexto = loginErrorMessage(new Error('Firebase: Error (auth/configuration-not-found).'));
    expect(porCodigo).toBe(porTexto);
    expect(porCodigo).toContain('habilítela');
    expect(porCodigo).not.toContain('habilítala');
  });

  it('los textos de autenticación no contienen auth/ ni Firebase (salvo el de configuración, que nombra la consola)', () => {
    const codes = [
      'auth/invalid-credential',
      'auth/user-not-found',
      'auth/wrong-password',
      'auth/invalid-email',
      'auth/user-disabled',
      'auth/too-many-requests',
      'auth/network-request-failed',
      'auth/algo-raro',
    ];
    for (const code of codes) {
      const texto = loginErrorMessage({ code, message: `Firebase: Error (${code}).` });
      expect(texto.includes('auth/')).toBe(false);
      expect(texto.includes('Firebase')).toBe(false);
    }
  });

  it('sin código usa el mensaje o el genérico', () => {
    expect(loginErrorMessage(new Error('fallo'))).toBe('fallo');
    expect(loginErrorMessage({})).toBe('Error al iniciar sesión.');
    expect(loginErrorMessage(null)).toBe('Error al iniciar sesión.');
    expect(loginErrorMessage({ message: '' })).toBe('Error al iniciar sesión.');
  });
});
