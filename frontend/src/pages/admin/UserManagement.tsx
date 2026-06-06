import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'

interface UserRecord {
  uid: string
  email: string
  name: string
  institution: string
  phone?: string
  role: string | null
  pendingRole?: string | null
}

interface UsersResponse {
  results: UserRecord[]
  total: number
}

export default function UserManagement() {
  const { t } = useTranslation()
  const { getToken } = useAuth()

  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null) // uid being saved

  // Create form states
  const [formName, setFormName] = useState('')
  const [formInstitution, setFormInstitution] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formRole, setFormRole] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const token = await getToken()
        const res = await api.get<UsersResponse>('/admin/users', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!cancelled && res.data?.results) {
          setUsers(res.data.results.map((u) => ({ ...u, pendingRole: u.role })))
        }
      } catch {
        if (!cancelled) setError(t('errors.generic'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [getToken, t])

  function handleRoleChange(uid: string, role: string) {
    setUsers((prev) =>
      prev.map((u) => (u.uid === uid ? { ...u, pendingRole: role || null } : u))
    )
  }

  async function updateRole(uid: string) {
    const user = users.find((u) => u.uid === uid)
    if (!user) return
    setSaving(uid)
    try {
      const token = await getToken()
      await api.put(
        `/admin/users/${uid}/role`,
        { role: user.pendingRole || null },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, role: user.pendingRole ?? u.role } : u))
      )
    } catch {
      setError(t('errors.generic'))
    } finally {
      setSaving(null)
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSuccessMsg(null)
    setCreating(true)
    try {
      const token = await getToken()
      const res = await api.post<UserRecord>(
        '/admin/users',
        {
          name: formName,
          institution: formInstitution,
          email: formEmail,
          password: formPassword,
          phone: formPhone || null,
          role: formRole || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      setUsers((prev) => [...prev, { ...res.data, pendingRole: res.data.role }])
      setSuccessMsg(`Usuario ${res.data.email} creado con éxito.`)
      
      // Reset form fields
      setFormName('')
      setFormInstitution('')
      setFormEmail('')
      setFormPassword('')
      setFormPhone('')
      setFormRole('')
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || t('errors.generic'))
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <main style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1.5rem' }}><p>Cargando usuarios...</p></main>

  return (
    <main style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', fontWeight: 500 }}>
          ← Volver al Panel
        </Link>
      </div>

      <h1 style={{ marginBottom: '2rem' }}>{t('admin.users')}</h1>
      {error && <p style={{ color: '#ff6b6b', background: 'rgba(255, 107, 107, 0.1)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Formulario de creación de usuario */}
        <section style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1.35rem' }}>Crear Nuevo Usuario</h2>
          
          {formError && <p style={{ color: '#ff6b6b', background: 'rgba(255, 107, 107, 0.1)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem' }}>{formError}</p>}
          {successMsg && <p style={{ color: '#50c878', background: 'rgba(80, 200, 120, 0.1)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem' }}>{successMsg}</p>}

          <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', alignItems: 'end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
              Nombre Completo
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} required />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
              Institución
              <input type="text" value={formInstitution} onChange={(e) => setFormInstitution(e.target.value)} required />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
              Teléfono
              <input type="text" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Ej. 600000000" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
              Correo Electrónico
              <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
              Contraseña
              <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} required minLength={6} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
              Rol Asignado
              <select value={formRole} onChange={(e) => setFormRole(e.target.value)}>
                <option value="">Sin Rol (Usuario General)</option>
                <option value="editor">Editor</option>
                <option value="revisor">Revisor</option>
                <option value="administrador">Administrador</option>
              </select>
            </label>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" disabled={creating} style={{ padding: '0.75rem 2rem' }}>
                {creating ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        </section>

        {/* Tabla de usuarios */}
        <section style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.5rem', overflowX: 'auto' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1.35rem' }}>Usuarios Registrados</h2>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.15)' }}>
                <th style={th}>Nombre</th>
                <th style={th}>Institución</th>
                <th style={th}>Teléfono</th>
                <th style={th}>Email</th>
                <th style={th}>Rol</th>
                <th style={th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={td}>{u.name}</td>
                  <td style={td}>{u.institution}</td>
                  <td style={td}>{u.phone || '—'}</td>
                  <td style={td}>{u.email}</td>
                  <td style={td}>
                    <select
                      value={u.pendingRole ?? ''}
                      onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                      style={{ padding: '0.4rem', fontSize: '0.9rem', width: '140px' }}
                    >
                      <option value="">Sin Rol</option>
                      <option value="editor">editor</option>
                      <option value="revisor">revisor</option>
                      <option value="administrador">administrador</option>
                    </select>
                  </td>
                  <td style={td}>
                    <button
                      onClick={() => updateRole(u.uid)}
                      disabled={saving === u.uid || (u.pendingRole ?? null) === u.role}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    >
                      {saving === u.uid ? '…' : 'Actualizar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '1rem',
  fontWeight: 600,
  opacity: 0.9,
  fontSize: '0.9rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  borderBottom: '2px solid rgba(255, 255, 255, 0.15)',
}

const td: React.CSSProperties = {
  padding: '1rem',
  verticalAlign: 'middle',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
}
