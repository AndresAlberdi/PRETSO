import { describe, it, expect } from 'vitest';
import { createUserErrorMessage, googleLoginErrorMessage, loginErrorCode, loginErrorMessage } from '../utils/authErrors';

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
      'Su cuenta usa otro método de acceso. Inicie sesión con su correo y contraseña.',
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
