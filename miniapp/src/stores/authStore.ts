/**
 * Auth Store — 对齐 web/src/stores/authStore.ts。
 * 用 Zustand + Taro Storage 持久化(替代 localStorage)。
 */
import { create as createStore } from 'zustand'
import Taro from '@tarojs/taro'
import {
  getUserInfo,
  logoutUser,
  type User,
  type RegisterUserForm,
} from '../api/auth'
import { setToken, clearToken, getToken } from '../utils/request'

const USER_KEY = 'auth_user'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  token: string | null
  /** 是否已从 storage 恢复 */
  hasHydrated: boolean

  setHasHydrated: (hydrated: boolean) => void
  login: (token: string, user?: User) => Promise<boolean>
  register: (data: RegisterUserForm) => Promise<boolean>
  logout: () => Promise<void>
  setLoading: (loading: boolean) => void
  refreshUserInfo: () => Promise<void>
  updateProfile: (data: Partial<User>) => void
  clearUser: () => void
  /** 从 Taro Storage 恢复状态(启动时调用) */
  hydrate: () => void
}

export const useAuthStore = createStore<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  token: null,
  hasHydrated: false,

  setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),

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
    set({
      token,
      user,
      isAuthenticated: !!token,
      hasHydrated: true,
    })
  },

  login: async (token, user) => {
    set({ isLoading: true })
    try {
      setToken(token)
      set({
        isAuthenticated: true,
        token,
        user: user ?? null,
      })

      if (user) {
        set({ isLoading: false })
        // 后台静默刷新一次,避免登录接口 user 字段不完整
        void (async () => {
          try {
            const res = await getUserInfo()
            if (res.code === 200 && res.data) {
              set({ user: res.data })
              Taro.setStorageSync(USER_KEY, JSON.stringify(res.data))
            }
          } catch {
            // ignore
          }
        })()
        return true
      }

      // 没有 user,主动拉一次
      try {
        const res = await getUserInfo()
        if (res.code === 200 && res.data) {
          set({ user: res.data, isLoading: false })
          Taro.setStorageSync(USER_KEY, JSON.stringify(res.data))
          return true
        }
      } catch {
        // ignore
      }
      set({ isLoading: false })
      return false
    } catch {
      set({ isLoading: false })
      return false
    }
  },

  register: async (data) => {
    // 注册逻辑由页面层调用 registerUser API 处理,这里只做状态转换
    void data
    return true
  },

  logout: async () => {
    try {
      await logoutUser()
    } catch {
      // ignore
    }
    get().clearUser()
  },

  setLoading: (loading) => set({ isLoading: loading }),

  refreshUserInfo: async () => {
    try {
      const res = await getUserInfo()
      if (res.code === 200 && res.data) {
        set({ user: res.data })
        Taro.setStorageSync(USER_KEY, JSON.stringify(res.data))
      }
    } catch {
      // ignore
    }
  },

  updateProfile: (data) => {
    const current = get().user
    if (!current) return
    const updated = { ...current, ...data }
    set({ user: updated })
    Taro.setStorageSync(USER_KEY, JSON.stringify(updated))
  },

  clearUser: () => {
    clearToken()
    Taro.removeStorageSync(USER_KEY)
    set({ user: null, isAuthenticated: false, token: null })
  },
}))
