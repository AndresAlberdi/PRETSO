import { Navigate } from 'react-router';
import { useAdmin } from '../context/AdminContext';

// Guarda para rutas que exigen privilegio de administrador. Debe ir dentro de
// ProtectedRoute: mientras el claim se resuelve no redirige.
export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, adminLoading } = useAdmin();

  if (adminLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>Cargando...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
