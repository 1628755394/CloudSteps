/**
 * 极简 Store — 用 React 18 useSyncExternalStore 替代 Zustand。
 *
 * 不依赖任何外部库,彻底避免 Taro 构建器把 zustand 的 `create`
 * 错误转换成 `taro.react_production_min.create` 的问题。
 */
import { useSyncExternalStore } from 'react'

type Listener = () => void

export interface StoreApi<T> {
  getState: () => T
  setState: (partial: Partial<T> | ((prev: T) => Partial<T>)) => void
  subscribe: (listener: Listener) => () => void
}

export function createStore<T extends object>(
  initialState: T,
): StoreApi<T> {
  let state = initialState
  const listeners = new Set<Listener>()

  return {
    getState: () => state,
    setState: (partial) => {
      const next =
        typeof partial === 'function'
          ? (partial as (prev: T) => Partial<T>)(state)
          : partial
      state = { ...state, ...next }
      listeners.forEach((l) => l())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/**
 * Hook: 从 store 读取并订阅切片。
 * 用法跟 zustand 的 useAuthStore((s) => s.user) 完全一致。
 */
export function useStore<T extends object, S>(
  store: StoreApi<T>,
  selector: (state: T) => S,
): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  )
}
