interface CeldaAdminProps {
  onEditar: () => void;
  onBorrar: () => void;
}

// Celda de la columna «Admin». La página decide si se muestra con useCanEdit();
// el componente no se oculta por sí solo.
export default function CeldaAdmin({ onEditar, onBorrar }: CeldaAdminProps) {
  return (
    <td>
      <div className="acciones-celda">
        <button type="button" className="boton boton-editor boton-fila" onClick={onEditar}>Editar</button>
        <button type="button" className="boton boton-borrar boton-fila" onClick={onBorrar}>Borrar</button>
      </div>
    </td>
  );
}
