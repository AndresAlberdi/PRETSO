import { useId, useRef, useState } from "react";
import Modal from "./Modal";
import { contar } from "../utils/anuncios";
import { TEXTO_LIBRE } from "../utils/correctorOrtografico";
import {
  MAX_LONGITUD_CATEGORIA,
  RenombreParcialError,
  renombrarCategoria,
  validarNuevoNombreCategoria,
  type ErrorNombreCategoria,
} from "../utils/renombrarCategoria";

interface Props {
  categoria: string;
  existentes: readonly string[];
  cantidad: number;
  onClose: () => void;
  onRenombrada: (anterior: string, nuevo: string) => void;
  onParcial: (ids: string[], nuevo: string) => void;
}

const MENSAJES: Record<ErrorNombreCategoria, string> = {
  vacio: "Escriba el nombre nuevo de la categoría.",
  sin_cambio: "El nombre nuevo es igual al actual.",
  largo: `El nombre no puede superar los ${MAX_LONGITUD_CATEGORIA} caracteres.`,
  duplicado: "Ya existe una categoría con ese nombre. Elija otro nombre.",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};
const panelStyle: React.CSSProperties = {
  background: "var(--bg-card)", padding: "2rem", borderRadius: "8px", maxWidth: "500px", width: "90%",
};

export default function RenombrarCategoriaModal({ categoria, existentes, cantidad, onClose, onRenombrada, onParcial }: Props) {
  const titleId = useId();
  const inputId = useId();
  const descId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const enviando = useRef(false);
  // Total original y avance acumulado, para informar «A de N» aunque la lista cambie tras un fallo parcial.
  const [total] = useState(cantidad);
  const hechos = useRef(0);
  const nombreParcial = useRef<string | null>(null);
  const [valor, setValor] = useState(categoria);
  const [busy, setBusy] = useState(false);
  // Tras un fallo parcial el nombre queda fijo (estado, no ref, para poder leerlo al dibujar).
  const [nombreFijo, setNombreFijo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async () => {
    if (enviando.current) return;
    const motivo = validarNuevoNombreCategoria(
      valor,
      categoria,
      // Tras un fallo parcial el nombre nuevo ya existe en los registros ya cambiados: es el mismo intento.
      nombreParcial.current ? existentes.filter((c) => c !== nombreParcial.current) : existentes,
    );
    if (motivo) {
      setError(MENSAJES[motivo]);
      inputRef.current?.focus();
      return;
    }
    enviando.current = true;
    setBusy(true);
    setError(null);
    try {
      await renombrarCategoria(categoria, valor);
      onRenombrada(categoria, valor.trim());
      onClose();
    } catch (e) {
      if (e instanceof RenombreParcialError) {
        const nuevo = valor.trim();
        hechos.current += e.actualizados.length;
        nombreParcial.current = nuevo;
        setNombreFijo(true);
        onParcial(e.actualizados, nuevo);
        setError(`Se renombraron ${hechos.current} de ${total} registros. Vuelva a intentarlo ahora, sin cerrar esta ventana, para completar el cambio.`);
      } else {
        setError("No se pudo renombrar la categoría. Inténtelo de nuevo.");
      }
      enviando.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      labelledBy={titleId}
      describedBy={error ? `${descId} ${errorId}` : descId}
      onEscape={busy ? undefined : onClose}
      initialFocus={inputRef}
      busy={busy}
      overlayStyle={overlayStyle}
      panelStyle={panelStyle}
    >
      <h2 id={titleId} style={{ marginTop: 0 }}>Renombrar categoría</h2>
      <p id={descId}>{`Se cambiará la categoría en ${contar(total, "registro", "registros")}.`}</p>
      <label htmlFor={inputId} style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Nombre nuevo</label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        {...TEXTO_LIBRE}
        maxLength={MAX_LONGITUD_CATEGORIA}
        value={valor}
        // Solo lectura (no disabled) para conservar el foco; con nombre fijo tras un fallo parcial,
        // cambiarlo repartiría los registros en dos categorías.
        readOnly={busy || nombreFijo}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void enviar();
          }
        }}
        style={{ width: "100%", padding: "0.8rem", marginBottom: "1rem", background: "var(--bg-body, #222)", color: "var(--text-primary)", border: "1px solid var(--input-border)", borderRadius: "4px" }}
      />
      {error && <p id={errorId} role="alert" style={{ color: "var(--danger-color)" }}>{error}</p>}
      <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
        <button type="button" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="button" onClick={() => void enviar()} aria-disabled={busy || undefined}>{busy ? "Renombrando..." : "Renombrar"}</button>
      </div>
    </Modal>
  );
}
