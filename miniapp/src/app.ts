import React, { useEffect } from 'react'
import { useDidShow, useDidHide } from '@tarojs/taro'
import { useAuthStore } from './stores/authStore'
// 全局样式
import './app.scss'

function App(props) {
  const hydrate = useAuthStore((s) => s.hydrate)

  // 启动时从 Taro Storage 恢复登录状态
  useEffect(() => {
    hydrate()
  }, [hydrate])

  // 对应 onShow
  useDidShow(() => {})

  // 对应 onHide
  useDidHide(() => {})

  return props.children
}

export default App
