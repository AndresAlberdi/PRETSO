import { canonizarReferencia, resolverCompania, type CompaniaRef } from '../utils/referenciaCompania';

interface ListaSiglasCompaniaProps {
  // Valores crudos guardados en el registro (número de registro, o sigla en datos heredados).
  referencias: unknown[];
  companias: CompaniaRef[];
  onAbrir: (compania: CompaniaRef) => void;
}

interface Elemento {
  clave: string;
  compania: CompaniaRef | null;
  texto: string;
}

// Muestra la sigla de cada compañía referenciada, como botón que abre el detalle.
// Una compañía repetida entre varios campos del registro (p. ej. `Compañía` y `Cmp`) se
// muestra una sola vez. Un valor que no resuelve a ninguna compañía se muestra atenuado,
// sin botón: es un dato roto que el administrador debe ver.
export default function ListaSiglasCompania({ referencias, companias, onAbrir }: ListaSiglasCompaniaProps) {
  const vistos = new Set<string>();
  const elementos: Elemento[] = [];
  for (const valor of referencias) {
    const ref = canonizarReferencia(valor);
    if (ref === '') continue;
    const compania = resolverCompania(valor, companias);
    const clave = compania
      ? `c:${canonizarReferencia(compania['Indicador de registro']) || String(compania['Sigla Compañía'] ?? '')}`
      : `r:${ref}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    elementos.push({ clave, compania, texto: compania ? String(compania['Sigla Compañía'] ?? '') : ref });
  }

  return (
    <>
      {elementos.map(e => (
        <div key={e.clave} style={{ marginBottom: '4px' }}>
          {e.compania ? (
            <button
              onClick={() => onAbrir(e.compania as CompaniaRef)}
              style={{ padding: '0.2rem 0.5rem', background: 'var(--accent-color)', color: 'var(--on-accent)', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              {e.texto}
            </button>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }} title="Compañía no encontrada">{e.texto}</span>
          )}
        </div>
      ))}
    </>
  );
}
