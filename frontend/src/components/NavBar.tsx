import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './LanguageSwitcher'
import { useLaunchStatus } from '../hooks/useLaunchStatus'
import { useAuth } from '../hooks/useAuth'

export default function NavBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data } = useLaunchStatus()
  const { user, logout } = useAuth()
  const portalActive = data?.portal_active ?? false

  return (
    <nav style={{
      display: 'flex',
      gap: '1.2rem',
      alignItems: 'center',
      padding: '0.75rem 1.5rem',
      background: 'rgba(11, 15, 25, 0.85)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
    }}>
      <Link to="/" style={{ fontWeight: 'bold', marginRight: '1rem', color: 'var(--primary-color)', fontSize: '1.2rem', fontFamily: 'var(--font-serif)' }}>PRETSO</Link>

      <Link to="/">{t('nav.home')}</Link>

      {user && (
        <Link to="/user-home">{t('nav.user_home', 'Mi Inicio')}</Link>
      )}

      {portalActive && user && (
        <>
          <Link to="/search">{t('nav.search')}</Link>
          <Link to="/companies">{t('nav.companies')}</Link>
          <Link to="/caja">Manejo de Caja</Link>
          <Link to="/salarios">Salarios</Link>
          <Link to="/corpus-christi">Corpus Christi</Link>
          <Link to="/api-docs">{t('nav.api')}</Link>
        </>
      )}

      <Link to="/announcements">{t('nav.announcements')}</Link>

      {user && (
        <Link to="/admin" style={{ marginLeft: 'auto' }}>{t('nav.admin')}</Link>
      )}

      <div style={{ marginLeft: user ? '0px' : 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user && (
          <Link to="/change-password" style={{ fontSize: '0.9rem', opacity: 0.8 }}>
            Cambiar Contraseña
          </Link>
        )}
        <LanguageSwitcher />

        {user ? (
          <button onClick={() => logout()} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>{t('nav.logout')}</button>
        ) : (
          <button onClick={() => navigate('/login')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>{t('nav.login')}</button>
        )}
      </div>
    </nav>
  )
}
