import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import LaunchProgress from '../../components/LaunchProgress'
import { useLaunchStatus } from '../../hooks/useLaunchStatus'

export default function Home() {
  const { t } = useTranslation()
  const { data, loading } = useLaunchStatus()

  return (
    <main style={{ maxWidth: 1000, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', gap: '2rem', flexWrap: 'wrap' }}>
        <img src="/assets/logo_this.jpg" alt="Logo THIS" style={{ width: '120px', objectFit: 'contain' }} />
        <div style={{ flex: 1, textAlign: 'center', minWidth: '280px' }}>
          <h1 style={{ whiteSpace: 'pre-line', margin: '0 0 1rem 0' }}>
            {"PRETSO\nPrecios del Teatro del Siglo de Oro"}
          </h1>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 500, margin: '0 0 0.5rem 0' }}>
            Base de datos para el estudio de las dinámicas económicas del teatro comercial en los territorios hispanos (siglos XVI-XVII)
          </h2>
          <h3 style={{ fontSize: '1rem', fontWeight: 400, margin: 0 }}>
            Project: [101150056] — [THIS] — [HORIZON-MSCA-2023-PF-01]
          </h3>
        </div>
        <img src="/assets/logo_ue.png" alt="Logo UE" style={{ width: '120px', objectFit: 'contain' }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', margin: '2rem 0' }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>Cargando registros de la Base de Datos...</p>
        </div>
      ) : (
        <>
          <LaunchProgress />

          {(!data || !data.portal_active) && (
            <div>
              <p><strong>{t('home.coming_soon')}</strong></p>
              <p>{t('home.launch_message', { threshold: data?.threshold ?? 10 })}</p>
            </div>
          )}

          {data && data.portal_active && (
            <nav style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center' }}>
              <Link to="/search" style={btnStyle}>{t('nav.search')}</Link>
              <Link to="/companies" style={btnStyle}>{t('nav.companies')}</Link>
            </nav>
          )}
        </>
      )}
    </main>
  )
}

const btnStyle = {
  padding: '0.75rem 1.5rem',
  background: 'var(--primary-color, #ffaa00)',
  color: '#111',
  textDecoration: 'none',
  fontWeight: 'bold',
  borderRadius: '8px',
}
