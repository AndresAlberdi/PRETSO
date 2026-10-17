import {
  canonizarReferencia, resolverCompania, valorDeReferencia, etiquetaCompania, type CompaniaRef,
} from '../utils/referenciaCompania';

interface SelectorCompaniaProps {
  companias: CompaniaRef[];
  value: unknown;
  // Recibe el número de registro (con su tipo numérico) o null si se elige «Ninguna».
  onChange: (valor: number | string | null) => void;
  required?: boolean;
  disabled?: boolean;
  textoVacio?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  id?: string;
}

// Selector de compañía: muestra «sigla - autores» y entrega el número de registro.
export default function SelectorCompania({
  companias, value, onChange, required, disabled, textoVacio = 'Ninguna', style, ariaLabel, id,
}: SelectorCompaniaProps) {
  const actual = canonizarReferencia(value);
  const resuelta = resolverCompania(value, companias);
  const valorSeleccionado = resuelta ? canonizarReferencia(resuelta['Indicador de registro']) : actual;
  const sinResolver = actual !== '' && !resuelta;

  return (
    <select
      id={id}
      aria-label={ariaLabel}
      required={required}
      disabled={disabled}
      style={style}
      value={valorSeleccionado}
      onChange={e => {
        const elegido = e.target.value;
        if (elegido === '') return onChange(null);
        const c = resolverCompania(elegido, companias);
        onChange(c ? valorDeReferencia(c) : elegido);
      }}
    >
      <option value="">{textoVacio}</option>
      {sinResolver && <option value={actual}>(sin resolver: {actual})</option>}
      {companias.map(c => (
        <option key={c.id} value={canonizarReferencia(c['Indicador de registro'])}>{etiquetaCompania(c)}</option>
      ))}
    </select>
  );
}
