import { useAdmin } from '../context/AdminContext';
import SinAcceso from '../pages/SinAcceso';

// Guarda de lectura: exige el claim `reader` o `admin`. Debe ir dentro de
// ProtectedRoute y por fuera de AdminRoute.
export default function ReaderRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isReader, adminLoading } = useAdmin();

  if (adminLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-primary)' }}>Cargando...</div>;
  }

  if (!isAdmin && !isReader) {
    return <SinAcceso />;
  }

  return <>{children}</>;
}
