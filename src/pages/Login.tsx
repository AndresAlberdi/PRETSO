import { useState } from 'react';
import { useNavigate } from 'react-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

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
    } catch (err: any) {
      // Handle missing auth error gracefully
      if (err.message.includes('auth/configuration-not-found')) {
         setError("Autenticación por Correo/Contraseña no está habilitada en Firebase Console. Por favor, habilítala.");
      } else {
         setError(err.message || "Error al iniciar sesión.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1rem' }}>
      
      {/* HEADER ORIGINAL DE PRETSO V1 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3rem', gap: '2rem', flexWrap: 'wrap', width: '100%', maxWidth: '1200px' }}>
        <img src="/logo_this.jpg?v=2" alt="Logo THIS" style={{ width: '320px', objectFit: 'contain' }} />
        <div style={{ flex: 1, textAlign: 'center', minWidth: '280px' }}>
          <h1 style={{ whiteSpace: 'pre-line', margin: '0 0 1rem 0', color: 'var(--primary-color)' }}>
            {"PRETSO\nPrecios del Teatro del Siglo de Oro"}
          </h1>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 500, margin: '0 0 0.5rem 0' }}>
            Base de datos para el estudio de las dinámicas económicas del teatro comercial en los territorios hispanos (siglos XVI-XVII)
          </h2>
          <h3 style={{ fontSize: '1rem', fontWeight: 400, margin: 0, opacity: 0.8 }}>
            Proyecto: [101150056] — [THIS] — [HORIZON-MSCA-2023-PF-01]
          </h3>
          <h3 style={{ fontSize: '1rem', fontWeight: 400, margin: 0, opacity: 0.8 }}>
            IP: Laura Paz Rescala
          </h3>
        </div>
        <img src="/logo_ue.png?v=2" alt="Logo UE" style={{ width: '220px', objectFit: 'contain' }} />
      </div>

      {/* FORMULARIO DE LOGIN */}
      <div style={{ background: 'var(--bg-card)', padding: '3rem', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        
        <h1 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '1.5rem' }}>Iniciar Sesión</h1>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600 }}>
            Correo Electrónico
            <input
              type="email"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </label>
          
          {error && <div style={{ color: '#ff6b6b', fontSize: '0.9rem', textAlign: 'center', background: 'rgba(255, 107, 107, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>{error}</div>}
          
          <button type="submit" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Cargando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}