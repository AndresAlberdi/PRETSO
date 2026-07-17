import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../firebase';

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
      const admin = currentUser?.email === 'pretsodatabase@gmail.com';
      setIsAdmin(admin);
      if (!admin) {
        setIsEditMode(false);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, isEditMode, setIsEditMode, user }}>
      {children}
    </AdminContext.Provider>
  );
};
