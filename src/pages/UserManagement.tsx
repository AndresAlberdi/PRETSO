import { useState } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

const secondaryFirebaseConfig = {
  projectId: "pretso-database",
  appId: "1:48942361199:web:4295a16d5dbe400b653b9a",
  storageBucket: "pretso-database.firebasestorage.app",
  apiKey: "AIzaSyCxEhBnq_4vA3DzVwxy6MdC89l94yncfNM",
  authDomain: "pretso-database.firebaseapp.com",
  messagingSenderId: "48942361199"
};

let secondaryApp: any;
let secondaryAuth: any;
try {
  secondaryApp = initializeApp(secondaryFirebaseConfig, "SecondaryApp");
  secondaryAuth = getAuth(secondaryApp);
} catch (e) {
  // Ignorar errores de app ya inicializada
}

export default function UserManagement() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: '', type: '' });
    
    try {
      if (!secondaryAuth) {
        secondaryApp = initializeApp(secondaryFirebaseConfig, `SecondaryApp_${Date.now()}`);
        secondaryAuth = getAuth(secondaryApp);
      }
      
      await createUserWithEmailAndPassword(secondaryAuth, email, password);
      setStatus({ message: `Usuario ${email} creado exitosamente como lector.`, type: 'success' });
      setEmail('');
      setPassword('');
    } catch (error: any) {
      console.error(error);
      setStatus({ message: `Error al crear usuario: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '2rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
      <h2 style={{ marginTop: 0, color: 'var(--primary-color)' }}>Gestión de Usuarios Lectores</h2>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Crea usuarios con acceso de solo lectura. Estos usuarios podrán acceder a la plataforma pero no podrán modificar ni borrar ningún registro, dado que la Base de Datos solo permite escrituras al administrador.
      </p>
      
      <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Correo Electrónico (Lector)</label>
          <input 
            type="email" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="lector@pretso.com"
            required
            style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'white' }}
          />
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Contraseña</label>
          <input 
            type="password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="********"
            required
            minLength={6}
            style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'white' }}
          />
        </div>

        {status.message && (
          <div style={{ padding: '1rem', borderRadius: '4px', background: status.type === 'error' ? 'rgba(231,76,60,0.2)' : 'rgba(46,204,113,0.2)', color: status.type === 'error' ? '#ff6b6b' : '#2ecc71', border: `1px solid ${status.type === 'error' ? '#e74c3c' : '#2ecc71'}` }}>
            {status.message}
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading}
          style={{ padding: '1rem', marginTop: '1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Creando...' : 'Crear Usuario Lector'}
        </button>
      </form>
    </div>
  );
}
