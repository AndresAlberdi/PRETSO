import { useAdmin } from '../context/AdminContext';
import SinAcceso from '../pages/SinAcceso';

// Guarda de la portada con sesión y de las rutas de administración (la lectura pública no la usa): exige el claim `reader` o `admin`. Debe ir dentro de
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
