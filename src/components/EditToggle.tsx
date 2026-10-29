import { useAdmin } from '../context/AdminContext';

// Conmuta el modo edición de la sección; solo lo ven los administradores.
export default function EditToggle() {
  const { isAdmin, isEditMode, setIsEditMode } = useAdmin();
  if (!isAdmin) return null;
  return (
    <button type="button"
      className={isEditMode ? 'boton boton-editor-activo' : 'boton boton-editor'}
      onClick={() => setIsEditMode(!isEditMode)}>
      {isEditMode ? 'Salir de edición' : 'Editar'}
    </button>
  );
}
