import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { TEXTO_LIBRE } from '../utils/correctorOrtografico';
import { validarTermino } from '../utils/busquedaGuia/termino';
import { LONGITUD_MAXIMA_TERMINO } from '../hooks/useTerminoBusqueda';

interface CampoBusquedaProps {
  etiqueta?: string;
  valorInicial: string;
  /** Solo se llama con un término válido, ya recortado. */
  onBuscar: (texto: string) => void;
  onLimpiar: () => void;
}

/** Texto del aviso según el motivo de rechazo; `texto` es lo escrito. */
export function textoAviso(motivo: 'corto' | 'conector', texto: string): string {
  if (motivo === 'corto') return 'Escriba al menos 3 letras, o un año de cuatro cifras.';
  return `La palabra «${texto.trim()}» es muy común para buscarla sola; escriba un nombre, un lugar o un año.`;
}

function avisoDe(texto: string): string | null {
  const v = validarTermino(texto);
  if (v.ok || v.motivo === 'vacio') return null;
  return textoAviso(v.motivo, texto);
}

/** Campo único de búsqueda: valida el término y no conoce el enrutador. */
export default function CampoBusqueda({ etiqueta = 'Buscar en la base de datos', valorInicial, onBuscar, onLimpiar }: CampoBusquedaProps) {
  const [texto, setTexto] = useState(valorInicial);
  const [aviso, setAviso] = useState<string | null>(() => avisoDe(valorInicial));
  const campoRef = useRef<HTMLInputElement>(null);
  const idCampo = useId();
  const idAviso = useId();

  useEffect(() => {
    setTexto(valorInicial);
    setAviso(avisoDe(valorInicial));
  }, [valorInicial]);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const recortado = texto.trim();
    if (recortado === '') {
      setAviso(null);
      onLimpiar();
      return;
    }
    const v = validarTermino(recortado);
    if (!v.ok) {
      setAviso(avisoDe(recortado));
      campoRef.current?.focus();
      return;
    }
    setAviso(null);
    onBuscar(recortado);
  };

  const limpiar = () => {
    setTexto('');
    setAviso(null);
    onLimpiar();
    campoRef.current?.focus();
  };

  return (
    <search>
      <form className="barra-busqueda" onSubmit={enviar} noValidate>
        <label htmlFor={idCampo}>{etiqueta}</label>
        <input
          ref={campoRef}
          id={idCampo}
          type="search"
          {...TEXTO_LIBRE}
          maxLength={LONGITUD_MAXIMA_TERMINO}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          aria-invalid={aviso ? 'true' : undefined}
          aria-describedby={aviso ? idAviso : undefined}
        />
        <button type="submit">Buscar</button>
        {(valorInicial !== '' || texto !== '') && <button type="button" onClick={limpiar}>Limpiar</button>}
        {aviso && <p id={idAviso} role="alert" className="aviso-busqueda">{aviso}</p>}
      </form>
    </search>
  );
}
