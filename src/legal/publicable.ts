import { MARCADOR } from './textosLegales.ts';

// Puerta de publicación: en un build de producción que se va a publicar (tag o workflow_dispatch),
// no puede quedar ningún marcador `[[PENDIENTE: …]]`. Misma condición que assertPublishable (firebaseConfig.ts).
// Los builds de staging y de PR no se ven afectados.
export function assertTextosLegalesPublicables(
  mode: string,
  refType: string | undefined,
  textos: string[],
  eventName?: string,
): void {
  if (mode === 'production' && (refType === 'tag' || eventName === 'workflow_dispatch')) {
    if (textos.some((t) => MARCADOR.test(t))) {
      throw new Error(
        'Hay textos legales sin completar ([[PENDIENTE: …]]) en src/legal/textosLegales.ts o public/security.txt; complételos antes de publicar.',
      );
    }
  }
}
