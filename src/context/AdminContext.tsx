import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, getIdTokenResult, type User } from 'firebase/auth';
import { auth } from '../firebase';
import { hasAdminClaim } from '../utils/adminClaims';

interface AdminContextProps {
  isAdmin: boolean;
  // Verdadero mientras no se resuelve el estado de sesión y el claim.
  adminLoading: boolean;
  isEditMode: boolean;
  setIsEditMode: (mode: boolean) => void;
  user: User | null;
}

const AdminContext = createContext<AdminContextProps>({
  isAdmin: false,
  adminLoading: true,
  isEditMode: false,
  setIsEditMode: () => {},
  user: null,
});

export const useAdmin = () => useContext(AdminContext);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  // Generación de la última notificación de auth: descarta resultados obsoletos.
  const generation = useRef(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      generation.current += 1;
      const current = generation.current;
      setUser(currentUser);
      if (!currentUser) {
        setIsAdmin(false);
        setIsEditMode(false);
        setAdminLoading(false);
        return;
      }
      // Hasta resolver el claim no se concede privilegio.
      setIsAdmin(false);
      setAdminLoading(true);
      void (async () => {
        let admin = false;
        try {
          // Se fuerza el refresco para ver un claim recién asignado.
          const result = await getIdTokenResult(currentUser, true);
          admin = hasAdminClaim(result.claims);
        } catch (error) {
          // Solo el código del error: el detalle puede contener datos personales.
          console.error('No se pudo leer el claim de administrador:', (error as { code?: string })?.code);
        }
        // Descartar si llegó otra notificación de auth mientras se resolvía el token.
        if (generation.current !== current) return;
        setIsAdmin(admin);
        setAdminLoading(false);
        if (!admin) {
          setIsEditMode(false);
        }
      })();
    });
    return () => unsubscribe();
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, adminLoading, isEditMode, setIsEditMode, user }}>
      {children}
    </AdminContext.Provider>
  );
};
