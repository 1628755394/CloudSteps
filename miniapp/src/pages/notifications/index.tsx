/**
 * 通知页 — 对齐 web/src/pages/Notifications.tsx。
 *
 * 移动端布局:
 *  1. 顶部导航:返回 + "通知" + 全部已读按钮
 *  2. 通知列表:未读红点 + 标题 + 内容 + 时间
 *  3. 点击单条标记已读
 *  4. 触底加载更多
 */
import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, Check, Notice } from '@nutui/icons-react-taro'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ApiNotification,
} from '../../api/notifications'
import { color } from '../../styles/tokens'
import './index.scss'

const PAGE_SIZE = 20

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso.replace(/-/g, '/'))
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}天前`
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

export default function Notifications() {
  const [items, setItems] = useState<ApiNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalUnread, setTotalUnread] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const fetchPage = useCallback(
    async (p: number, append: boolean) => {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)
      try {
        const res = await listNotifications({ page: p, size: PAGE_SIZE })
        if (res.code !== 200) {
          setError(res.msg || '加载通知失败')
          if (!append) setItems([])
          return
        }
        const data = res.data
        const list = data?.list ?? []
        setItems((prev) => (append ? [...prev, ...list] : list))
        setTotalUnread(data?.totalUnread ?? 0)
        setHasMore(list.length >= PAGE_SIZE && items.length + list.length < (data?.total ?? 0))
      } catch (e: any) {
        setError(e?.msg || e?.message || '加载通知失败')
        if (!append) setItems([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [items.length],
  )

  useEffect(() => {
    void fetchPage(1, false)
  }, [])

  const onScrollToLower = () => {
    if (loading || loadingMore || !hasMore) return
    const next = page + 1
    setPage(next)
    void fetchPage(next, true)
  }

  const markAllRead = async () => {
    if (loading || items.length === 0 || totalUnread === 0) return
    try {
      const res = await markAllNotificationsRead()
      if (res.code !== 200) {
        Taro.showToast({ title: res.msg || '操作失败', icon: 'none' })
        return
      }
      setItems((prev) => prev.map((i) => ({ ...i, read: true })))
      setTotalUnread(0)
      Taro.showToast({ title: '已全部标为已读', icon: 'success' })
    } catch (e: any) {
      Taro.showToast({ title: e?.msg || '操作失败', icon: 'none' })
    }
  }

  const markOneRead = async (id: number) => {
    const target = items.find((i) => i.id === id)
    if (!target || target.read) return
    // 乐观更新
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)))
    setTotalUnread((prev) => Math.max(0, prev - 1))
    try {
      const res = await markNotificationRead(id)
      if (res.code !== 200) {
        // 回滚
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: false } : i)))
        setTotalUnread((prev) => prev + 1)
        Taro.showToast({ title: res.msg || '标记失败', icon: 'none' })
      }
    } catch (e: any) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: false } : i)))
      setTotalUnread((prev) => prev + 1)
      Taro.showToast({ title: e?.msg || '标记失败', icon: 'none' })
    }
  }

  return (
    <View className="notif">
      {/* 顶部导航栏 */}
      <View className="notif__navbar">
        <View className="notif__nav-btn" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={22} color={color.charcoal} />
        </View>
        <Text className="notif__nav-title">通知</Text>
        <View
          className={`notif__nav-action ${totalUnread === 0 ? 'notif__nav-action--disabled' : ''}`}
          onClick={markAllRead}
        >
          <Check size={16} color={color.primary} />
          <Text className="notif__nav-action-text">全部已读</Text>
        </View>
      </View>

      {/* 未读摘要 */}
      <View className="notif__summary">
        <View className="notif__summary-icon">
          <Notice size={18} color={color.primary} />
        </View>
        <Text className="notif__summary-text">
          {totalUnread > 0 ? `你有 ${totalUnread} 条未读通知` : '暂无未读通知'}
        </Text>
      </View>

      <ScrollView
        className="notif__body"
        scrollY
        enableFlex
        lowerThreshold={120}
        onScrollToLower={onScrollToLower}
      >
        {loading ? (
          <View className="notif__state">
            <Text className="notif__state-text">加载中...</Text>
          </View>
        ) : error ? (
          <View className="notif__state notif__state--error">
            <Text className="notif__state-text">{error}</Text>
          </View>
        ) : items.length === 0 ? (
          <View className="notif__empty">
            <View className="notif__empty-icon">
              <Notice size={40} color={color.mutedSoft} />
            </View>
            <Text className="notif__empty-text">暂无通知</Text>
          </View>
        ) : (
          <View className="notif__list">
            {items.map((n) => (
              <View
                key={n.id}
                className={`notif__item ${n.read ? 'notif__item--read' : ''}`}
                onClick={() => markOneRead(n.id)}
              >
                <View className="notif__item-main">
                  <View className="notif__item-title-row">
                    {!n.read && <View className="notif__dot" />}
                    <Text className="notif__item-title">{n.title}</Text>
                  </View>
                  <Text className="notif__item-content">{n.content}</Text>
                  <Text className="notif__item-time">{formatTime(n.createdAt)}</Text>
                </View>
                {!n.read && <View className="notif__item-badge">未读</View>}
              </View>
            ))}

            {loadingMore && (
              <View className="notif__more">
                <Text className="notif__more-text">加载中...</Text>
              </View>
            )}
            {!loading && !hasMore && items.length > 0 && (
              <View className="notif__more">
                <Text className="notif__more-text">没有更多了</Text>
              </View>
            )}
          </View>
        )}
        <View style={{ height: '48rpx' }} />
      </ScrollView>
    </View>
  )
}
