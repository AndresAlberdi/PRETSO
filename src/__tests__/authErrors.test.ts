import { describe, it, expect } from 'vitest';
import { createUserErrorMessage, loginErrorCode, loginErrorMessage } from '../utils/authErrors';

const CRED = 'Correo o contraseña incorrectos. Si el problema persiste, comuníquese con la administración del proyecto.';
const GENERICO = 'No se pudo iniciar sesión. Inténtelo de nuevo.';

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

  it('sin código de auth nunca muestra el mensaje crudo', () => {
    expect(loginErrorMessage(new Error('fallo'))).toBe(GENERICO);
    expect(loginErrorMessage({})).toBe(GENERICO);
    expect(loginErrorMessage(null)).toBe(GENERICO);
    expect(loginErrorMessage({ message: '' })).toBe(GENERICO);
    expect(loginErrorMessage('x')).toBe(GENERICO);
    expect(loginErrorMessage({ code: 42, message: 'm' })).toBe(GENERICO);
  });
});

describe('loginErrorCode', () => {
  it('devuelve el code, el name del error o «sin código»', () => {
    expect(loginErrorCode({ code: 'auth/user-not-found', message: 'a@b.c' })).toBe('auth/user-not-found');
    expect(loginErrorCode(new TypeError('x'))).toBe('TypeError');
    expect(loginErrorCode({})).toBe('sin código');
    expect(loginErrorCode(null)).toBe('sin código');
    expect(loginErrorCode('texto')).toBe('sin código');
  });
});

describe('createUserErrorMessage', () => {
  const GENERICO_ALTA = 'No se pudo crear el usuario. Inténtelo de nuevo.';

  it('cada código produce su texto', () => {
    expect(createUserErrorMessage({ code: 'auth/email-already-in-use' })).toBe('Ya existe un usuario con ese correo.');
    expect(createUserErrorMessage({ code: 'auth/weak-password' })).toBe(
      'La contraseña es demasiado débil; use al menos 6 caracteres.',
    );
    expect(createUserErrorMessage({ code: 'auth/invalid-email' })).toBe('El correo no es válido.');
    expect(createUserErrorMessage({ code: 'auth/network-request-failed' })).toBe(
      'No se pudo conectar. Revise su conexión e inténtelo de nuevo.',
    );
    expect(createUserErrorMessage({ code: 'auth/algo-raro' })).toBe(GENERICO_ALTA);
  });

  it('el alta deshabilitada y el exceso de intentos tienen su texto', () => {
    const deshabilitada = 'El alta de usuarios desde la aplicación está deshabilitada en este proyecto.';
    expect(createUserErrorMessage({ code: 'auth/admin-restricted-operation' })).toBe(deshabilitada);
    expect(createUserErrorMessage({ code: 'auth/operation-not-allowed' })).toBe(deshabilitada);
    expect(createUserErrorMessage({ code: 'auth/too-many-requests' })).toBe(
      'Demasiados intentos. Espere unos minutos e inténtelo de nuevo.',
    );
  });

  it('ningún texto contiene auth/ ni Firebase', () => {
    const codes = [
      'auth/email-already-in-use',
      'auth/weak-password',
      'auth/invalid-email',
      'auth/network-request-failed',
      'auth/admin-restricted-operation',
      'auth/operation-not-allowed',
      'auth/too-many-requests',
      'auth/algo-raro',
    ];
    for (const code of codes) {
      const texto = createUserErrorMessage({ code, message: `Firebase: Error (${code}).` });
      expect(texto.includes('auth/')).toBe(false);
      expect(texto.includes('Firebase')).toBe(false);
    }
  });

  it('sin código reconocido devuelve el genérico y nunca el mensaje crudo', () => {
    expect(createUserErrorMessage(new Error('x'))).toBe(GENERICO_ALTA);
    expect(createUserErrorMessage(null)).toBe(GENERICO_ALTA);
    expect(createUserErrorMessage({})).toBe(GENERICO_ALTA);
    expect(createUserErrorMessage('x')).toBe(GENERICO_ALTA);
  });

  it('no filtra el correo de customData', () => {
    const texto = createUserErrorMessage({ code: 'auth/email-already-in-use', customData: { email: 'a@b.c' } });
    expect(texto.includes('a@b.c')).toBe(false);
  });
});
