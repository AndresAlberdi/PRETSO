import { useTranslation } from 'react-i18next'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.language.startsWith('en') ? 'en' : 'es'

  const toggle = () => {
    i18n.changeLanguage(current === 'es' ? 'en' : 'es')
  }

  return (
    <button onClick={toggle} aria-label="Switch language">
      {current === 'es' ? 'EN' : 'ES'}
    </button>
  )
}
