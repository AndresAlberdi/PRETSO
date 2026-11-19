import SelectorCompania from './SelectorCompania';
import { TEXTO_LIBRE } from '../utils/correctorOrtografico';
import type { CompaniaRef } from '../utils/referenciaCompania';

export type TipoEmpleador = 'compania' | 'otro';

interface Props {
  idBase: string;
  tipo: TipoEmpleador;
  onTipo: (t: TipoEmpleador) => void;
  companias: CompaniaRef[];
  cargando: boolean;
  datos: Record<string, unknown>;
  onCampo: (campo: string, valor: unknown) => void;
  errorCampo: string | null;
  errorId: string;
  disabled?: boolean;
}

const columna = { display: 'flex', flexDirection: 'column', gap: '0.4rem' } as const;

// Empleador de un registro de Remuneraciones: una compañía de la lista u «otro», escrito a mano.
export default function CamposEmpleadorSalario({
  idBase, tipo, onTipo, companias, cargando, datos, onCampo, errorCampo, errorId, disabled,
}: Props) {
  const invalido = (campo: string) => (errorCampo === campo ? { 'aria-invalid': true as const, 'aria-describedby': errorId } : {});
  const texto = (campo: string, rotulo: string) => (
    <label key={campo} style={columna}>
      <strong>{rotulo}</strong>
      <input
        type="text"
        required
        maxLength={200}
        disabled={disabled}
        {...TEXTO_LIBRE}
        {...invalido(campo)}
        value={String(datos[campo] ?? '')}
        onChange={(e) => onCampo(campo, e.target.value)}
      />
    </label>
  );
  return (
    <fieldset style={{ ...columna, border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.75rem' }}>
      <legend><strong>Empleador (obligatorio)</strong></legend>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input type="radio" name={`${idBase}-tipo-empleador`} checked={tipo === 'compania'} disabled={disabled} onChange={() => onTipo('compania')} />
          Compañía de la lista
        </label>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input type="radio" name={`${idBase}-tipo-empleador`} checked={tipo === 'otro'} disabled={disabled} onChange={() => onTipo('otro')} />
          Otro (escrito a mano)
        </label>
      </div>
      {tipo === 'compania' ? (
        <label htmlFor={`${idBase}-compania`} style={columna}>
          <strong>Sigla de la compañía (obligatorio)</strong>
          <SelectorCompania
            id={`${idBase}-compania`}
            required
            disabled={disabled}
            ariaInvalid={errorCampo === 'Sigla Compañía'}
            ariaDescribedBy={errorCampo === 'Sigla Compañía' ? errorId : undefined}
            companias={companias}
            cargando={cargando}
            value={datos['Sigla Compañía']}
            onChange={(v) => onCampo('Sigla Compañía', v ?? '')}
            textoVacio="Seleccione una compañía..."
          />
        </label>
      ) : (
        <>
          {texto('Empleador', 'Nombre del empleador (obligatorio)')}
          {texto('Temporadas teatrales', 'Temporadas teatrales (obligatorio)')}
          {texto('Ámbito', 'Ámbito (obligatorio; escriba «desconocido» si no se conoce)')}
        </>
      )}
    </fieldset>
  );
}
