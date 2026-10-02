import type { FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import type { AppCheck, AppCheckOptions } from 'firebase/app-check';
import { resolveDebugToken, isValidRecaptchaSiteKey } from './appCheckConfig';
import type { AppCheckEnv } from './appCheckConfig';

export interface DebugTokenGlobal {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
}

// Dependencias inyectables para poder probar sin red ni reCAPTCHA reales.
export interface AppCheckDeps {
  init: (app: FirebaseApp, options: AppCheckOptions) => AppCheck;
  createProvider: (siteKey: string) => AppCheckOptions['provider'];
  warn: (message: string) => void;
  target: DebugTokenGlobal;
}

export const defaultAppCheckDeps: AppCheckDeps = {
  init: initializeAppCheck,
  createProvider: (siteKey) => new ReCaptchaEnterpriseProvider(siteKey),
  warn: (message) => console.warn(message),
  target: globalThis as unknown as DebugTokenGlobal,
};

// Inicializa App Check con reCAPTCHA Enterprise. Nunca lanza: si algo falla, la aplicación sigue sin token
// (App Check está en monitoreo). Los mensajes nunca incluyen la clave ni el token.
export function startAppCheck(
  app: FirebaseApp,
  siteKey: string,
  env: AppCheckEnv,
  deps: AppCheckDeps = defaultAppCheckDeps,
): AppCheck | null {
  if (env.MODE === 'test') return null;

  if (!isValidRecaptchaSiteKey(siteKey)) {
    deps.warn(
      `App Check no se inicializó: la site key de reCAPTCHA Enterprise del ambiente «${env.MODE}» falta o no tiene el formato esperado. ` +
        'La aplicación sigue funcionando sin token de App Check.',
    );
    return null;
  }

  // El token de depuración solo se asigna en desarrollo local, antes de inicializar.
  const debugToken = resolveDebugToken(env);
  if (debugToken) {
    deps.target.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }

  try {
    return deps.init(app, {
      provider: deps.createProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    const rawCode = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
    const code = typeof rawCode === 'string' ? rawCode : 'error desconocido';
    deps.warn(
      `App Check no se pudo inicializar (${code}). La aplicación sigue funcionando sin token de App Check.`,
    );
    return null;
  }
}
