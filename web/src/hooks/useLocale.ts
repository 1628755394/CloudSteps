import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import i18n, {
  type Locale,
  SUPPORTED_LOCALES,
  getStoredLocale,
  setStoredLocale,
} from '../i18n'

export function useLocale() {
  const { t, i18n: i18nInstance } = useTranslation()
  const current = i18nInstance.language as Locale

  const changeLocale = useCallback((locale: Locale) => {
    setStoredLocale(locale)
    void i18n.changeLanguage(locale)
  }, [])

  return {
    t,
    locale: current,
    supportedLocales: SUPPORTED_LOCALES,
    changeLocale,
  }
}

export { getStoredLocale, setStoredLocale, SUPPORTED_LOCALES }
export type { Locale }
