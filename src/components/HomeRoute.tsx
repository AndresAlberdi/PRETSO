import { useEffect, useRef } from 'react';
import { useAdmin } from '../context/AdminContext';

// Guarda de «/»: sin sesión muestra el acceso; con sesión, la portada. Solo consulta el
// contexto (un único escuchador de auth) y no monta nada mientras se resuelve el claim.
export default function HomeRoute({ signedOut, signedIn }: { signedOut: React.ReactNode; signedIn: React.ReactNode }) {
  const { user, adminLoading, authNotice } = useAdmin();
  const lastView = useRef<'signedOut' | 'signedIn' | null>(null);

  useEffect(() => {
    if (adminLoading) return;
    const view = user ? 'signedIn' : 'signedOut';
    if (lastView.current !== null && lastView.current !== view && !authNotice) {
      document.getElementById('contenido')?.focus({ preventScroll: true });
    }
    lastView.current = view;
  }, [user, adminLoading, authNotice]);

  if (adminLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-primary)' }}>Cargando...</div>;
  }
  return <>{user ? signedIn : signedOut}</>;
}
