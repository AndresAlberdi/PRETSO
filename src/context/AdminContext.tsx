import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

export interface AdminContextProps {
  isAdmin: boolean;
  isReader: boolean;
  // Verdadero mientras no se resuelve el estado de sesión y el claim.
  adminLoading: boolean;
  isEditMode: boolean;
  setIsEditMode: (mode: boolean) => void;
  user: User | null;
  // Aviso para el acceso (p. ej. administración que entró sin Google); sobrevive al cierre de sesión.
  authNotice: string | null;
  clearAuthNotice: () => void;
}

export const AdminContext = createContext<AdminContextProps>({
  isAdmin: false,
  isReader: false,
  adminLoading: true,
  isEditMode: false,
  setIsEditMode: () => {},
  user: null,
  authNotice: null,
  clearAuthNotice: () => {},
});

export const useAdmin = () => useContext(AdminContext);
