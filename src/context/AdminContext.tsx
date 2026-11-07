import React, { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, getIdTokenResult, signOut, type User } from 'firebase/auth';
import { auth } from '../firebase';
import { hasAdminClaim, hasReaderClaim, isAllowedAdminProvider } from '../utils/adminClaims';
import { ADMIN_GOOGLE_ONLY_MESSAGE } from '../utils/authErrors';
import { codigoError } from '../utils/codigoError';

interface AdminContextProps {
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

const AdminContext = createContext<AdminContextProps>({
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

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isReader, setIsReader] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const clearAuthNotice = useCallback(() => setAuthNotice(null), []);
  // Generación de la última notificación de auth: descarta resultados obsoletos.
  const generation = useRef(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      generation.current += 1;
      const current = generation.current;
      setUser(currentUser);
      if (!currentUser) {
        setIsAdmin(false);
        setIsReader(false);
        setIsEditMode(false);
        setAdminLoading(false);
        return;
      }
      // Hasta resolver el claim no se concede privilegio.
      setIsAdmin(false);
      setIsReader(false);
      setAdminLoading(true);
      void (async () => {
        let admin = false;
        let reader = false;
        let provider: string | null = null;
        try {
          // Se fuerza el refresco para ver un claim recién asignado.
          const result = await getIdTokenResult(currentUser, true);
          admin = hasAdminClaim(result.claims);
          reader = hasReaderClaim(result.claims);
          provider = result.signInProvider ?? null;
        } catch (error) {
          // Solo el código del error: el detalle puede contener datos personales.
          console.error('No se pudo leer el claim de administrador:', codigoError(error));
        }
        // Descartar si llegó otra notificación de auth mientras se resolvía el token.
        if (generation.current !== current) return;
        if (admin && !isAllowedAdminProvider(provider)) {
          // Administración solo por Google: sin privilegios y con adminLoading en verdadero hasta
          // la notificación de cierre, para que ninguna guarda monte páginas con datos.
          setIsEditMode(false);
          setAuthNotice(ADMIN_GOOGLE_ONLY_MESSAGE);
          console.warn('Sesión de administración sin Google; se cierra. Proveedor:', provider ?? 'sin proveedor');
          try {
            await signOut(auth);
          } catch (error) {
            console.error('No se pudo cerrar la sesión de administración:', codigoError(error));
            // Sin privilegios: aparece «Sin acceso», que tiene «Salir».
            if (generation.current === current) setAdminLoading(false);
          }
          return;
        }
        setAuthNotice(null);
        setIsAdmin(admin);
        setIsReader(reader);
        setAdminLoading(false);
        if (!admin) {
          setIsEditMode(false);
        }
      })();
    });
    return () => unsubscribe();
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, isReader, adminLoading, isEditMode, setIsEditMode, user, authNotice, clearAuthNotice }}>
      {children}
    </AdminContext.Provider>
  );
};
