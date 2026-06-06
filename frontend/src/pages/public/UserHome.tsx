import { useTranslation } from 'react-i18next'
import Dashboard from '../../components/Dashboard'

export default function UserHome() {
  const { t } = useTranslation()

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>{t('nav.user_home', 'Mi Inicio')}</h1>
      <p>Bienvenido a tu panel principal. A continuación puedes explorar las estadísticas de la plataforma.</p>
      <Dashboard />
    </main>
  )
}
