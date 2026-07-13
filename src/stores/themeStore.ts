import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  isDark: boolean
  setMode: (mode: ThemeMode) => void
  toggleMode: () => void
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(mode: ThemeMode, isDark: boolean) {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(isDark ? 'dark' : 'light')
  if (isDark) {
    document.body.setAttribute('arco-theme', 'dark')
  } else {
    document.body.removeAttribute('arco-theme')
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      isDark: false,
      setMode: (mode) => {
        const isDark = resolveIsDark(mode)
        applyTheme(mode, isDark)
        set({ mode, isDark })
      },
      toggleMode: () => {
        const next = get().isDark ? 'light' : 'dark'
        get().setMode(next)
      },
    }),
    {
      name: 'cloudsteps-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const isDark = resolveIsDark(state.mode)
          state.isDark = isDark
          applyTheme(state.mode, isDark)
        }
      },
    },
  ),
)
