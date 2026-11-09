import { useEffect } from 'react';
import { Link } from 'react-router';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAdmin } from '../context/AdminContext';

export default function SinAcceso() {
  const { authNotice } = useAdmin();
  // El título debe coincidir con lo visible (WCAG 2.4.2). RouteEffects debe ir ANTES de <Routes> en App.tsx
  // para que este efecto, que corre después, prevalezca sobre el título de la ruta.
  useEffect(() => {
    document.title = 'Acceso pendiente — PRETSO';
  }, []);
  return (
    <>
    <main id="contenido" tabIndex={-1} className="contenido-principal">
      <h1>Acceso pendiente</h1>
      {authNotice && <div role="alert" className="acceso-error">{authNotice}</div>}
      <p>Su sesión está iniciada, pero esta cuenta no tiene permisos de administración en PRETSO. Puede consultar la base de datos sin iniciar sesión; si necesita administrarla, solicite el acceso a la administración del proyecto.</p>
      <p><Link to="/buscar">Realizar búsquedas</Link></p>
      <button type="button" onClick={() => signOut(auth)}>Salir</button>
    </main>
    </>
  );
}
