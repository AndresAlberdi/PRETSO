import { useState } from 'react';
import { useNavigate } from 'react-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { loginErrorMessage } from '../utils/authErrors';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      // Solo el código de Firebase al registro: nunca el correo, la contraseña ni el mensaje completo.
      const code = typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string' ? err.code : 'sin código';
      console.error('Error al iniciar sesión:', code);
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="contenido" tabIndex={-1} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1rem' }}>
      
      {/* HEADER ORIGINAL DE PRETSO V1 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3rem', gap: '2rem', flexWrap: 'wrap', width: '100%', maxWidth: '1200px' }}>
        <img src="/logo_this.jpg?v=2" alt="Logo THIS" style={{ width: '320px', maxWidth: '100%', objectFit: 'contain' }} />
        <div style={{ flex: 1, textAlign: 'center', minWidth: 'min(280px, 100%)' }}>
          <h1 style={{ whiteSpace: 'pre-line', margin: '0 0 1rem 0', color: 'var(--primary-color)' }}>
            {"PRETSO\nPrecios del Teatro del Siglo de Oro"}
          </h1>
          <p className="titulo-secundario" style={{ fontSize: '1.2rem', fontWeight: 500, margin: '0 0 0.5rem 0' }}>
            Base de datos para el estudio de las dinámicas económicas del teatro comercial en los territorios hispanos (siglos XVI-XVII)
          </p>
          <p className="titulo-secundario" style={{ fontSize: '1rem', fontWeight: 400, margin: 0, opacity: 0.8 }}>
            Proyecto: [101150056] — [THIS] — [HORIZON-MSCA-2023-PF-01]
          </p>
          <p className="titulo-secundario" style={{ fontSize: '1rem', fontWeight: 400, margin: 0, opacity: 0.8 }}>
            IP: Laura Paz Rescala
          </p>
        </div>
        <img src="/logo_ue.png?v=2" alt="Logo UE" style={{ width: '220px', maxWidth: '100%', objectFit: 'contain' }} />
      </div>

      {/* FORMULARIO DE LOGIN */}
      <div style={{ background: 'var(--bg-card)', padding: '3rem', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        
        <h2 style={{ textAlign: 'center', fontSize: '2rem', marginTop: '0.67em', marginBottom: '1.5rem' }}>Iniciar Sesión</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600 }}>
            Correo Electrónico
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Ej. testadmin@example.com"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600 }}>
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
          
          {error && <div role="alert" style={{ color: '#ff6b6b', fontSize: '0.9rem', textAlign: 'center', background: 'rgba(255, 107, 107, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>{error}</div>}
          
          <button type="submit" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Cargando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}