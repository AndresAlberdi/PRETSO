import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function SinAcceso() {
  return (
    <main id="contenido" tabIndex={-1} className="contenido-principal">
      <h1>Acceso pendiente</h1>
      <p>Su sesión está iniciada, pero su cuenta todavía no tiene permiso de lectura en PRETSO. Solicítelo a la administración del proyecto.</p>
      <button type="button" onClick={() => signOut(auth)}>Salir</button>
    </main>
  );
}
