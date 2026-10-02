import { describe, it, expect, vi } from 'vitest';
import { ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import type { FirebaseApp } from 'firebase/app';
import type { AppCheck } from 'firebase/app-check';
import { startAppCheck, defaultAppCheckDeps } from '../utils/appCheck';
import type { AppCheckDeps, DebugTokenGlobal } from '../utils/appCheck';
import { recaptchaSiteKey as validKey } from '../environments/staging/firebase';

const app = {} as FirebaseApp;
const provider = { kind: 'provider' };
const appCheck = { kind: 'appCheck' } as unknown as AppCheck;

function makeDeps(overrides: Partial<Pick<AppCheckDeps, 'init' | 'createProvider' | 'target'>> = {}) {
  const target: DebugTokenGlobal = {};
  const deps = {
    init: vi.fn(() => appCheck),
    createProvider: vi.fn(() => provider as never),
    target,
    ...overrides,
    warn: vi.fn<(message: string) => void>(),
  } satisfies AppCheckDeps;
  return deps;
}

describe('startAppCheck', () => {
  it('initializes once with a valid key', () => {
    const deps = makeDeps();
    const result = startAppCheck(app, validKey, { MODE: 'staging', DEV: false }, deps);
    expect(result).toBe(appCheck);
    expect(deps.createProvider).toHaveBeenCalledWith(validKey);
    expect(deps.init).toHaveBeenCalledTimes(1);
    expect(deps.init).toHaveBeenCalledWith(app, { provider, isTokenAutoRefreshEnabled: true });
  });

  it('does nothing in test mode', () => {
    const deps = makeDeps();
    expect(startAppCheck(app, validKey, { MODE: 'test', DEV: true }, deps)).toBeNull();
    expect(deps.init).not.toHaveBeenCalled();
    expect(deps.warn).not.toHaveBeenCalled();
  });

  it.each(['', 'AIzaNotAKey'])('warns once and skips with invalid key «%s»', (key) => {
    const deps = makeDeps();
    expect(startAppCheck(app, key, { MODE: 'production', DEV: false }, deps)).toBeNull();
    expect(deps.init).not.toHaveBeenCalled();
    expect(deps.warn).toHaveBeenCalledTimes(1);
    const message = String(deps.warn.mock.calls[0][0]);
    expect(message).toContain('production');
    if (key) expect(message).not.toContain(key);
  });

  it('does not propagate an init error and reports its code', () => {
    const deps = makeDeps({
      init: vi.fn(() => {
        throw { code: 'appCheck/already-initialized' };
      }),
    });
    expect(startAppCheck(app, validKey, { MODE: 'staging', DEV: false }, deps)).toBeNull();
    expect(deps.warn).toHaveBeenCalledTimes(1);
    expect(String(deps.warn.mock.calls[0][0])).toContain('appCheck/already-initialized');
  });

  it('reports an unknown error when the thrown value has no code', () => {
    const deps = makeDeps({
      init: vi.fn(() => {
        throw 'x';
      }),
    });
    expect(startAppCheck(app, validKey, { MODE: 'staging', DEV: false }, deps)).toBeNull();
    expect(String(deps.warn.mock.calls[0][0])).toContain('error desconocido');
  });

  it('does not propagate an error from createProvider', () => {
    const deps = makeDeps({
      createProvider: vi.fn(() => {
        throw new Error('boom');
      }),
    });
    expect(startAppCheck(app, validKey, { MODE: 'staging', DEV: false }, deps)).toBeNull();
    expect(deps.init).not.toHaveBeenCalled();
    expect(deps.warn).toHaveBeenCalledTimes(1);
  });

  it('sets the debug token before init in development and never logs it', () => {
    const target: DebugTokenGlobal = {};
    let seen: unknown;
    const deps = makeDeps({
      target,
      init: vi.fn(() => {
        seen = target.FIREBASE_APPCHECK_DEBUG_TOKEN;
        return appCheck;
      }),
    });
    startAppCheck(app, validKey, { MODE: 'development', DEV: true, VITE_APPCHECK_DEBUG_TOKEN: 'tok' }, deps);
    expect(seen).toBe('tok');
    for (const call of deps.warn.mock.calls) expect(String(call[0])).not.toContain('tok');
  });

  it.each(['staging', 'production'])('never sets the debug token in %s', (MODE) => {
    const deps = makeDeps();
    startAppCheck(app, validKey, { MODE, DEV: false, VITE_APPCHECK_DEBUG_TOKEN: 'tok' }, deps);
    expect('FIREBASE_APPCHECK_DEBUG_TOKEN' in deps.target).toBe(false);
  });
});

describe('defaultAppCheckDeps', () => {
  it('creates a ReCaptchaEnterpriseProvider', () => {
    expect(defaultAppCheckDeps.createProvider(validKey)).toBeInstanceOf(ReCaptchaEnterpriseProvider);
  });
});
