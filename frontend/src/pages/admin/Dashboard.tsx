import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import LaunchProgress from '../../components/LaunchProgress'

export default function Dashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()

  const btn: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    cursor: 'pointer',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#ffffff',
    fontSize: '0.95rem',
    fontWeight: 600,
    transition: 'all 0.2s',
  }

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1.5rem' }}>
      <h1>{t('admin.dashboard')}</h1>
      {user && <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Bienvenido/a, <strong>{user.email}</strong></p>}

      <LaunchProgress />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '2rem' }}>
        <button style={btn} onClick={() => navigate('/admin/records/new')}>
          {t('admin.new_record')}
        </button>
        <button style={btn} onClick={() => navigate('/admin/records')}>
          {t('admin.records')}
        </button>
        <button style={btn} onClick={() => navigate('/admin/etl')}>
          {t('admin.etl')}
        </button>
        <button style={btn} onClick={() => navigate('/admin/announcements')}>
          Anuncios
        </button>
        {user?.role === 'administrador' && (
          <button style={btn} onClick={() => navigate('/admin/users')}>
            {t('admin.users')}
          </button>
        )}
      </div>
    </main>
  )
}
