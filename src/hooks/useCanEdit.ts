import { useAdmin } from '../context/AdminContext';

// Solo presentación: decide si se muestran los controles de edición.
// La protección real son AdminRoute y las reglas de Firestore.
export function useCanEdit(): boolean {
  const { isAdmin, isEditMode } = useAdmin();
  return isAdmin === true && isEditMode === true;
}

// Solo presentación: decide si se muestran las herramientas de carga
// (p. ej. «Nuevo registro» y la columna «Admin»). No depende del modo edición.
// La protección real son AdminRoute y las reglas de Firestore.
export function useCanLoad(): boolean {
  const { isAdmin } = useAdmin();
  return isAdmin === true;
}
