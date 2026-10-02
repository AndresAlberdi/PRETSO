// Lógica pura de App Check, sin importaciones de Firebase: la usa también vite.config.ts, que corre en Node.

// Forma de una site key de reCAPTCHA Enterprise: «6L» seguido de 38 caracteres (40 en total).
export const RECAPTCHA_SITE_KEY_PATTERN = /^6L[0-9A-Za-z_-]{38}$/;

// Variable de entorno con el token de depuración de App Check (solo desarrollo local).
export const DEBUG_TOKEN_ENV_VAR = 'VITE_APPCHECK_DEBUG_TOKEN';

export interface AppCheckEnv {
  MODE: string;
  DEV: boolean;
  VITE_APPCHECK_DEBUG_TOKEN?: string;
}

// Indica si el valor tiene la forma de una site key de reCAPTCHA Enterprise.
export function isValidRecaptchaSiteKey(siteKey: string | undefined): boolean {
  return typeof siteKey === 'string' && RECAPTCHA_SITE_KEY_PATTERN.test(siteKey);
}

// El token de depuración solo se usa con `npm run dev`: exige DEV y el modo «development».
// Devuelve el valor recortado o undefined.
export function resolveDebugToken(env: AppCheckEnv): string | undefined {
  if (env.DEV !== true || env.MODE !== 'development') return undefined;
  const token = env.VITE_APPCHECK_DEBUG_TOKEN?.trim();
  return token ? token : undefined;
}

// El token de depuración es un secreto: un build o una prueba fuera de development que lo reciba
// (por ejemplo, desde un .env.local olvidado) podría incrustarlo en el paquete publicado.
export function assertNoDebugTokenOutsideDevelopment(mode: string, value: string | undefined): void {
  if (mode !== 'development' && value?.trim()) {
    throw new Error(
      `${DEBUG_TOKEN_ENV_VAR} solo se admite en desarrollo local (modo development). ` +
        `Quítelo de .env, .env.local o del entorno antes de construir o probar en modo «${mode}».`,
    );
  }
}

// Misma condición que assertPublishable (firebaseConfig.ts): solo se bloquea el build que se publica
// (tag o workflow_dispatch de producción); en PR y en push a rama el build de producción sí compila.
export function assertAppCheckPublishable(
  mode: string,
  refType: string | undefined,
  siteKey: string | undefined,
  eventName?: string,
): void {
  if (mode === 'production' && (refType === 'tag' || eventName === 'workflow_dispatch')) {
    if (!isValidRecaptchaSiteKey(siteKey)) {
      throw new Error(
        'Falta la site key de reCAPTCHA Enterprise de producción (App Check, NUB-G06). ' +
          'Complete recaptchaSiteKey en src/environments/production/firebase.ts antes de publicar.',
      );
    }
  }
}
