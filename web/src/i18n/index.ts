import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from './locales/zh-CN.json'
import en from './locales/en.json'

export const SUPPORTED_LOCALES = ['zh-CN', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'zh-CN'

const STORAGE_KEY = 'app_locale'

export function getStoredLocale(): Locale {
  const v = localStorage.getItem(STORAGE_KEY)
  if (v && SUPPORTED_LOCALES.includes(v as Locale)) return v as Locale
  // 浏览器语言检测
  const nav = navigator.language
  if (nav.startsWith('zh')) return 'zh-CN'
  if (nav.startsWith('en')) return 'en'
  return DEFAULT_LOCALE
}

export function setStoredLocale(locale: Locale) {
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.lang = locale
}

void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    en: { translation: en },
  },
  lng: getStoredLocale(),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    escapeValue: false, // React already escapes
  },
})

document.documentElement.lang = i18n.language

export default i18n
