/**
 * Auth Store — 对齐 web/src/stores/authStore.ts。
 * 用极简 createStore(React 18 useSyncExternalStore)替代 Zustand,
 * 彻底避免 Taro 构建器把 zustand 的 create 转成 taro.react_production_min.create。
 */
import Taro from '@tarojs/taro'
import {
  getUserInfo,
  logoutUser,
  type User,
  type RegisterUserForm,
} from '../api/auth'
import { setToken, clearToken, getToken } from '../utils/request'
import { createStore, useStore, type StoreApi } from './createStore'

const USER_KEY = 'auth_user'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  token: string | null
  hasHydrated: boolean

  setHasHydrated: (hydrated: boolean) => void
  login: (token: string, user?: User) => Promise<boolean>
  register: (data: RegisterUserForm) => Promise<boolean>
  logout: () => Promise<void>
  setLoading: (loading: boolean) => void
  refreshUserInfo: () => Promise<void>
  updateProfile: (data: Partial<User>) => void
  clearUser: () => void
  hydrate: () => void
}

const store: StoreApi<AuthState> = createStore<AuthState>({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  token: null,
  hasHydrated: false,

  setHasHydrated: (hydrated) => store.setState({ hasHydrated: hydrated }),

  hydrate: () => {
    const token = getToken()
    const userStr = Taro.getStorageSync(USER_KEY)
    let user: User | null = null
    if (userStr) {
      try {
        user = typeof userStr === 'string' ? JSON.parse(userStr) : userStr
      } catch {
        user = null
      }
    }
    store.setState({
      token,
      user,
      isAuthenticated: !!token,
      hasHydrated: true,
    })
  },

  login: async (token, user) => {
    store.setState({ isLoading: true })
    try {
      setToken(token)
      store.setState({
        isAuthenticated: true,
        token,
        user: user ?? null,
      })

      if (user) {
        store.setState({ isLoading: false })
        void (async () => {
          try {
            const res = await getUserInfo()
            if (res.code === 200 && res.data) {
              store.setState({ user: res.data })
              Taro.setStorageSync(USER_KEY, JSON.stringify(res.data))
            }
          } catch {
            // ignore
          }
        })()
        return true
      }

      try {
        const res = await getUserInfo()
        if (res.code === 200 && res.data) {
          store.setState({ user: res.data, isLoading: false })
          Taro.setStorageSync(USER_KEY, JSON.stringify(res.data))
          return true
        }
      } catch {
        // ignore
      }
      store.setState({ isLoading: false })
      return false
    } catch {
      store.setState({ isLoading: false })
      return false
    }
  },

  register: async (data) => {
    void data
    return true
  },

  logout: async () => {
    try {
      await logoutUser()
    } catch {
      // ignore
    }
    store.getState().clearUser()
  },

  setLoading: (loading) => store.setState({ isLoading: loading }),

  refreshUserInfo: async () => {
    try {
      const res = await getUserInfo()
      if (res.code === 200 && res.data) {
        store.setState({ user: res.data })
        Taro.setStorageSync(USER_KEY, JSON.stringify(res.data))
      }
    } catch {
      // ignore
    }
  },

  updateProfile: (data) => {
    const current = store.getState().user
    if (!current) return
    const updated = { ...current, ...data }
    store.setState({ user: updated })
    Taro.setStorageSync(USER_KEY, JSON.stringify(updated))
  },

  clearUser: () => {
    clearToken()
    Taro.removeStorageSync(USER_KEY)
    store.setState({ user: null, isAuthenticated: false, token: null })
  },
})

/**
 * Hook:用法跟 zustand 一致。
 *   const user = useAuthStore((s) => s.user)
 */
export function useAuthStore<S>(selector: (state: AuthState) => S): S {
  return useStore(store, selector)
}

/** 直接访问 store API(非 hook 场景) */
export const authStore = store
