import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: string[] = [];

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => {
    calls.push('initializeApp');
    return { name: 'app-simulada' };
  }),
}));
vi.mock('firebase/app-check', () => ({
  initializeAppCheck: vi.fn(),
  ReCaptchaEnterpriseProvider: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => {
    calls.push('getFirestore');
    return { tipo: 'firestore' };
  }),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => {
    calls.push('getAuth');
    return { tipo: 'auth' };
  }),
}));
// En MODE «test» startAppCheck no hace nada; se simula para registrar el orden de llamadas sin pasar por red.
vi.mock('../utils/appCheck', () => ({
  startAppCheck: vi.fn(() => {
    calls.push('startAppCheck');
    return null;
  }),
}));

describe('inicialización de src/firebase.ts', () => {
  beforeEach(() => {
    calls.length = 0;
    vi.resetModules();
  });

  it('inicializa App Check después de initializeApp y antes de Firestore y Auth', async () => {
    await import('../firebase');
    expect(calls[0]).toBe('initializeApp');
    expect(calls[1]).toBe('startAppCheck');
    expect(calls.slice(2).sort()).toEqual(['getAuth', 'getFirestore']);
  });

  it('pasa a startAppCheck solo los campos explícitos, sin el objeto import.meta.env entero', async () => {
    const { startAppCheck } = await import('../utils/appCheck');
    await import('../firebase');
    const env = vi.mocked(startAppCheck).mock.calls.at(-1)?.[2] as unknown as Record<string, unknown>;
    expect(Object.keys(env).sort()).toEqual(['DEV', 'MODE', 'VITE_APPCHECK_DEBUG_TOKEN']);
  });
});
