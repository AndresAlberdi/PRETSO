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

// Publicar con la configuración de producción incompleta dejaría un sitio que no arranca, y la prueba de
// humo (solo mira el código HTTP) no lo detectaría. Los dos caminos de publicación de producción son un
// tag y un `workflow_dispatch` manual: en este dispatch el tag llega como entrada y la referencia puede ser
// `main`, así que `refType` (GITHUB_REF_TYPE) valdría `branch`; por eso se mira también el evento
// (GITHUB_EVENT_NAME). En PR y en push a rama el build de producción sí compila, porque la CI lo ejecuta en
// cada run; solo falla cuando Actions lo construye para publicar.
export function assertPublishable(
  mode: string,
  refType: string | undefined,
  config: FirebaseWebConfig,
  eventName?: string,
): void {
  if (mode === 'production' && (refType === 'tag' || eventName === 'workflow_dispatch')) {
    assertFirebaseConfig(config, mode);
  }
}
