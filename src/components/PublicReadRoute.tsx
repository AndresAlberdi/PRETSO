import { useAdmin } from '../context/AdminContext';

// Lectura pública: no exige sesión. Solo espera a que se resuelva la sesión y el claim.
// La protección real de los datos son las reglas de Firestore y App Check.
export default function PublicReadRoute({ children }: { children: React.ReactNode }) {
  const { adminLoading } = useAdmin();
  if (adminLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-primary)' }}>Cargando...</div>;
  }
  return <>{children}</>;
}
