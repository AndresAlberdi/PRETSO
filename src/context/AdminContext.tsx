import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, getIdTokenResult, type User } from 'firebase/auth';
import { auth } from '../firebase';
import { hasAdminClaim } from '../utils/adminClaims';

interface AdminContextProps {
  isAdmin: boolean;
  isEditMode: boolean;
  setIsEditMode: (mode: boolean) => void;
  user: User | null;
}

const AdminContext = createContext<AdminContextProps>({
  isAdmin: false,
  isEditMode: false,
  setIsEditMode: () => {},
  user: null,
});

export const useAdmin = () => useContext(AdminContext);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsAdmin(false);
        setIsEditMode(false);
        return;
      }
      // Hasta resolver el claim no se concede privilegio.
      setIsAdmin(false);
      const uid = currentUser.uid;
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
        // Descartar si la sesión cambió mientras se resolvía el token.
        if (auth.currentUser?.uid !== uid) return;
        setIsAdmin(admin);
        if (!admin) {
          setIsEditMode(false);
        }
      })();
    });
    return () => unsubscribe();
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, isEditMode, setIsEditMode, user }}>
      {children}
    </AdminContext.Provider>
  );
};
