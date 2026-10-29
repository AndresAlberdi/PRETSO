import { useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function SinAcceso() {
  // El título debe coincidir con lo visible (WCAG 2.4.2). RouteEffects debe ir ANTES de <Routes> en App.tsx
  // para que este efecto, que corre después, prevalezca sobre el título de la ruta.
  useEffect(() => {
    document.title = 'Acceso pendiente — PRETSO';
  }, []);
  return (
    <main id="contenido" tabIndex={-1} className="contenido-principal">
      <h1>Acceso pendiente</h1>
      <p>Su sesión está iniciada, pero su cuenta todavía no tiene permiso de lectura en PRETSO. Solicítelo a la administración del proyecto.</p>
      <button type="button" onClick={() => signOut(auth)}>Salir</button>
    </main>
  );
}
