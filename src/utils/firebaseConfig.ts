export interface FirebaseWebConfig {
  projectId: string;
  authDomain: string;
  apiKey: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

const REQUIRED_FIELDS = ['projectId', 'authDomain', 'apiKey', 'appId'] as const;

// Devuelve los campos obligatorios que están vacíos o solo contienen espacios.
export function faltantesDeConfig(config: FirebaseWebConfig): string[] {
  return REQUIRED_FIELDS.filter((field) => !config[field]?.trim());
}

// Lanza un error claro si la configuración del ambiente está incompleta.
export function assertFirebaseConfig(config: FirebaseWebConfig, ambiente: string): void {
  const faltantes = faltantesDeConfig(config);
  if (faltantes.length > 0) {
    const carpeta = ambiente === 'production' ? 'production' : 'staging';
    throw new Error(
      `Configuración de Firebase incompleta para el ambiente «${ambiente}»: falta ${faltantes.join(', ')}. ` +
        `Complete src/environments/${carpeta}/firebase.ts antes de publicar.`,
    );
  }
}

// Publicar un tag con la configuración de producción incompleta dejaría un sitio que no arranca, y la
// prueba de humo (solo mira el código HTTP) no lo detectaría. `refType` es GITHUB_REF_TYPE, que define
// GitHub Actions: en PR y en push a rama el build de producción sí compila, porque la CI lo ejecuta en
// cada run; solo falla cuando Actions lo construye para un tag.
export function assertPublishable(mode: string, refType: string | undefined, config: FirebaseWebConfig): void {
  if (mode === 'production' && refType === 'tag') {
    assertFirebaseConfig(config, mode);
  }
}
