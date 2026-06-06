import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import LaunchProgress from '../../components/LaunchProgress'
import { useLaunchStatus } from '../../hooks/useLaunchStatus'

export default function Home() {
  const { t } = useTranslation()
  const { data } = useLaunchStatus()

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>{t('home.title')}</h1>
      <h2>{t('home.subtitle')}</h2>
      <p>{t('home.description')}</p>

      <LaunchProgress />

      {(!data || !data.portal_active) && (
        <div>
          <p><strong>{t('home.coming_soon')}</strong></p>
          <p>{t('home.launch_message', { threshold: data?.threshold ?? 10 })}</p>
        </div>
      )}

      {data && data.portal_active && (
        <nav style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <Link to="/search">{t('nav.search')}</Link>
          <Link to="/companies">{t('nav.companies')}</Link>
        </nav>
      )}
    </main>
  )
}
