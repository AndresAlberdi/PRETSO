import {
  canonizarReferencia, resolverCompania, valorDeReferencia, etiquetaCompania, type CompaniaRef,
} from '../utils/referenciaCompania';

interface SelectorCompaniaProps {
  companias: CompaniaRef[];
  value: unknown;
  // Recibe el número de registro (con su tipo numérico), el valor original si se
  // vuelve a elegir una opción «sin resolver» / «por sigla», o null si se elige «Ninguna».
  onChange: (valor: unknown) => void;
  required?: boolean;
  disabled?: boolean;
  // Verdadero mientras las compañías aún no llegaron: evita mostrar «sin resolver» en falso.
  cargando?: boolean;
  textoVacio?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  id?: string;
}

// Selector de compañía: muestra «sigla - autores» y entrega el número de registro.
export default function SelectorCompania({
  companias, value, onChange, required, disabled, cargando, textoVacio = 'Ninguna', style, ariaLabel, id,
}: SelectorCompaniaProps) {
  // Solo se pueden elegir compañías con número de registro (la llave de la referencia)
  const opciones = companias.filter(c => canonizarReferencia(c['Indicador de registro']) !== '');
  const actual = canonizarReferencia(value);
  const resuelta = cargando ? null : resolverCompania(value, opciones);
  const numeroResuelta = resuelta ? canonizarReferencia(resuelta['Indicador de registro']) : '';
  // Guardada como sigla en texto: resuelve, pero el valor guardado no es el número
  const porSigla = resuelta !== null && numeroResuelta !== actual;
  const valorSeleccionado = resuelta && !porSigla ? numeroResuelta : actual;
  const sinResolver = !cargando && actual !== '' && !resuelta;

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
        // Se volvió a elegir la opción heredada: se conserva el valor original, con su tipo
        if (elegido === actual && (sinResolver || porSigla)) return onChange(value);
        const c = resolverCompania(elegido, opciones);
        onChange(c ? valorDeReferencia(c) : elegido);
      }}
    >
      <option value="">{textoVacio}</option>
      {cargando && actual !== '' && <option value={actual}>Cargando…</option>}
      {sinResolver && <option value={actual}>(sin resolver: {actual})</option>}
      {porSigla && <option value={actual}>(por sigla: {actual})</option>}
      {opciones.map(c => (
        <option key={c.id} value={canonizarReferencia(c['Indicador de registro'])}>{etiquetaCompania(c)}</option>
      ))}
    </select>
  );
}
