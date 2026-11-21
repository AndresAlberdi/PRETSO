import { useEffect, useRef, useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { useAdmin } from '../context/AdminContext';
import { googleLoginErrorMessage, loginErrorCode } from '../utils/authErrors';

// Acceso de la portada (sin sesión): solo con la cuenta de Google. Al iniciar sesión no navega: la portada cambia sola
// cuando el contexto de administración recibe al usuario.
export default function AccesoForm() {
  const { authNotice, clearAuthNotice } = useAdmin();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'google' | null>(null);
  const avisoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authNotice) avisoRef.current?.focus();
  }, [authNotice]);

  async function handleGoogle() {
    if (pending !== null) return;
    setError(null);
    clearAuthNotice();
    setPending('google');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: unknown) {
      // Solo el código de Firebase al registro: nunca el correo ni los datos del error.
      console.error('Error al iniciar sesión con Google:', loginErrorCode(err));
      setError(googleLoginErrorMessage(err));
    } finally {
      setPending(null);
    }
  }

  const mensaje = error ?? authNotice;

  return (
    <div className="acceso">
      <h2 className="acceso-titulo">Iniciar sesión</h2>
      {mensaje && <div ref={avisoRef} tabIndex={-1} role="alert" className="acceso-error">{mensaje}</div>}
      <button type="button" className="boton boton-secundario acceso-google" onClick={handleGoogle} aria-disabled={pending !== null || undefined}>
        {pending === 'google' ? 'Conectando con Google...' : 'Continuar con Google'}
      </button>
    </div>
  );
}
