import { useEffect, useRef, useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { useAdmin } from '../context/AdminContext';
import { googleLoginErrorMessage, loginErrorCode, loginErrorMessage } from '../utils/authErrors';

// Acceso de la portada (sin sesión). Al iniciar sesión no navega: la portada cambia sola
// cuando el contexto de administración recibe al usuario.
export default function AccesoForm() {
  const { authNotice, clearAuthNotice } = useAdmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'email' | 'google' | null>(null);
  const avisoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authNotice) avisoRef.current?.focus();
  }, [authNotice]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    clearAuthNotice();
    setPending('email');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      // Solo el código de Firebase al registro: nunca el correo, la contraseña ni el mensaje completo.
      console.error('Error al iniciar sesión:', loginErrorCode(err));
      setError(loginErrorMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function handleGoogle() {
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
      <form className="acceso-form" onSubmit={handleSubmit}>
        <label className="acceso-campo">
          Correo electrónico
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="nombre@example.com"
          />
        </label>
        <label className="acceso-campo">
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </label>
        <button type="submit" disabled={pending !== null}>
          {pending === 'email' ? 'Cargando...' : 'Entrar'}
        </button>
      </form>
      <p className="acceso-separador">o</p>
      <button type="button" className="boton boton-secundario acceso-google" onClick={handleGoogle} disabled={pending !== null}>
        {pending === 'google' ? 'Conectando con Google...' : 'Continuar con Google'}
      </button>
    </div>
  );
}
