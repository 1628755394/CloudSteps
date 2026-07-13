import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { ConfigProvider } from '@arco-design/web-react'
import zhCN from '@arco-design/web-react/es/locale/zh-CN'
import { useThemeStore } from '@/stores/themeStore'
import { readPrimaryColorFromDocument } from '@/utils/themeColor'
import { ARCO_POPUP_Z_INDEX, arcoGlobalComponentConfig, arcoPopupContainer } from '@/utils/arcoPopup'

export function ArcoAppProvider({ children }: { children: ReactNode }) {
  const isDark = useThemeStore((s) => s.isDark)
  const themeMode = useThemeStore((s) => s.theme.mode)
  const [primaryColor, setPrimaryColor] = useState(() => readPrimaryColorFromDocument())

  useEffect(() => {
    const sync = () => setPrimaryColor(readPrimaryColorFromDocument())
    sync()
    const id = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(id)
  }, [isDark, themeMode])

  useEffect(() => {
    if (isDark) {
      document.body.setAttribute('arco-theme', 'dark')
    } else {
      document.body.removeAttribute('arco-theme')
    }
  }, [isDark])

  const arcoTheme = useMemo(() => ({ primaryColor }), [primaryColor])

  return (
    <ConfigProvider
      locale={zhCN}
      theme={arcoTheme}
      zIndex={ARCO_POPUP_Z_INDEX}
      getPopupContainer={arcoPopupContainer}
      componentConfig={arcoGlobalComponentConfig}
    >
      {children}
    </ConfigProvider>
  )
}
