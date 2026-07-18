import { type ReactNode, useEffect } from 'react'
import { ConfigProvider } from '@arco-design/web-react'
import zhCN from '@arco-design/web-react/es/locale/zh-CN'
import { useThemeStore } from '../stores/themeStore'
import { ARCO_POPUP_Z_INDEX, arcoGlobalComponentConfig, arcoPopupContainer } from '../utils/arcoPopup'

const BRAND_PRIMARY = '#1671EF'

export function ArcoAppProvider({ children }: { children: ReactNode }) {
  const isDark = useThemeStore((s) => s.isDark)
  const mode = useThemeStore((s) => s.mode)

  useEffect(() => {
    const isDarkResolved = mode === 'system' ? resolveIsDark() : isDark
    if (isDarkResolved) {
      document.body.setAttribute('arco-theme', 'dark')
    } else {
      document.body.removeAttribute('arco-theme')
    }
  }, [isDark, mode])

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{ primaryColor: BRAND_PRIMARY }}
      zIndex={ARCO_POPUP_Z_INDEX}
      getPopupContainer={arcoPopupContainer}
      componentConfig={arcoGlobalComponentConfig}
    >
      {children}
    </ConfigProvider>
  )
}

function resolveIsDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
