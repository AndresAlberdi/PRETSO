import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { updatePassword } from 'firebase/auth'
import { auth } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'

export default function ChangePassword() {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    const user = auth.currentUser
    if (!user) {
      setError('No hay ninguna sesión activa.')
      return
    }

    setSubmitting(true)
    try {
      await updatePassword(user, password)
      setSuccess(true)
      setPassword('')
      setConfirmPassword('')
      setTimeout(() => {
        navigate(authUser?.role ? '/admin' : '/search')
      }, 2000)
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Por razones de seguridad, debe haber iniciado sesión recientemente para realizar esta acción. Por favor, cierre sesión, vuelva a iniciar sesión e inténtelo de nuevo.')
      } else {
        setError(err.message || 'Error al actualizar la contraseña.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', fontWeight: 500 }}>
          ← Volver al Inicio
        </Link>
      </div>

      <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '2rem' }}>
        <h1 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '2rem', textAlign: 'center' }}>Cambiar Contraseña</h1>
        
        {error && <p style={{ color: '#ff6b6b', background: 'rgba(255, 107, 107, 0.1)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</p>}
        {success && <p style={{ color: '#50c878', background: 'rgba(80, 200, 120, 0.1)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem', marginBottom: '1rem' }}>¡Contraseña actualizada con éxito! Redirigiendo...</p>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
            Nueva Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
            Confirmar Nueva Contraseña
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          <button type="submit" disabled={submitting} style={{ marginTop: '0.5rem', padding: '0.75rem' }}>
            {submitting ? 'Actualizando...' : 'Actualizar Contraseña'}
          </button>
        </form>
      </div>
    </main>
  )
}
