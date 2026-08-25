/**
 * 训练记录 — 对齐 web/src/pages/TrainingRecords.tsx。
 *
 * 顶部导航:返回 + "训练记录"
 * Tab 切换:正课记录 / 抗遗忘记录
 * 记录卡片列表:词库名+日期+单词数+正确数+状态
 * 触底加载更多
 */
import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, List, Refresh, Check, Clock } from '@nutui/icons-react-taro'
import { listStudySessions, type StudySessionListItem } from '../../api/study'
import { useAuthStore } from '../../stores/authStore'
import './index.scss'

type Tab = 'study' | 'review'

function dayKey(ts?: string | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts).slice(0, 10)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fmtTime(ts?: string | null): string {
  if (!ts) return '—'
  try {
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return ts
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ts
  }
}

/** 前端按词库+日聚合已完成会话 */
function groupSessionsClient(items: StudySessionListItem[]): StudySessionListItem[] {
  const map = new Map<string, StudySessionListItem>()
  for (const item of items) {
    if (item.status && item.status !== 'completed' && item.status !== 'grouped') continue
    const day = item.day || dayKey(item.startedAt || item.latestAt)
    const key = `${item.wordBookId || 0}|${day}`
    const prev = map.get(key)
    if (!prev) {
      map.set(key, {
        ...item,
        day,
        latestAt: item.latestAt || item.startedAt,
        sessionCount: item.sessionCount || 1,
        sessionIds: item.sessionIds?.length ? [...item.sessionIds] : item.id ? [item.id] : [],
        status: 'grouped',
      })
      continue
    }
    prev.wordCount = (prev.wordCount || 0) + (item.wordCount || 0)
    prev.correctCount = (prev.correctCount || 0) + (item.correctCount || 0)
    prev.sessionCount = (prev.sessionCount || 0) + 1
    const id = item.id
    if (id && !prev.sessionIds?.includes(id)) {
      prev.sessionIds = [...(prev.sessionIds || []), id]
    }
    const latest = item.latestAt || item.startedAt || ''
    if (latest && (!prev.latestAt || latest > prev.latestAt)) {
      prev.latestAt = latest
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    String(b.latestAt || '').localeCompare(String(a.latestAt || ''))
  )
}

export default function TrainingRecords() {
  const role = useAuthStore((s) => s.user?.role) || 'user'
  void role

  const [tab, setTab] = useState<Tab>('study')
  const [list, setList] = useState<StudySessionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 50

  const handleBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.reLaunch({ url: '/pages/home/index' })
    })
  }

  const loadFirst = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listStudySessions({
        page: 1,
        pageSize,
        sessionType: tab === 'study' ? 'learn' : 'review',
        status: 'completed',
        groupBy: 'bookDay',
      })
      if (res.code === 200) {
        const raw = res.data?.list || []
        if (res.data?.grouped) {
          setList(raw)
          setTotal(res.data?.total || 0)
        } else {
          const grouped = groupSessionsClient(raw)
          setList(grouped)
          setTotal(grouped.length)
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [tab, pageSize])

  useEffect(() => {
    setPage(1)
    void loadFirst()
  }, [loadFirst])

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const nextPage = page + 1
    if (nextPage > totalPages) return
    setLoadingMore(true)
    try {
      const res = await listStudySessions({
        page: nextPage,
        pageSize,
        sessionType: tab === 'study' ? 'learn' : 'review',
        status: 'completed',
        groupBy: 'bookDay',
      })
      if (res.code === 200) {
        const raw = res.data?.list || []
        if (res.data?.grouped) {
          setList((prev) => [...prev, ...raw])
        } else {
          setList((prev) => [...prev, ...groupSessionsClient(raw)])
        }
        setPage(nextPage)
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false)
    }
  }, [tab, page, pageSize, total, loading, loadingMore])

  return (
    <View className="tr">
      {/* 顶部导航 */}
      <View className="tr__nav">
        <View className="tr__nav-back" onClick={handleBack}>
          <ArrowLeft size={20} color="#37352f" />
        </View>
        <Text className="tr__nav-title">训练记录</Text>
        <View className="tr__nav-placeholder" />
      </View>

      {/* Tab 切换 */}
      <View className="tr__tabs">
        <View
          className={`tr__tab ${tab === 'study' ? 'tr__tab--active' : ''}`}
          onClick={() => setTab('study')}
        >
          <Text className="tr__tab-text">正课记录</Text>
        </View>
        <View
          className={`tr__tab ${tab === 'review' ? 'tr__tab--active' : ''}`}
          onClick={() => setTab('review')}
        >
          <Text className="tr__tab-text">抗遗忘记录</Text>
        </View>
      </View>

      <ScrollView
        className="tr__list"
        scrollY
        enableFlex
        onScrollToLower={loadMore}
        lowerThreshold={120}
      >
        {loading ? (
          <View className="tr__state">
            <Text className="tr__state-text">加载中...</Text>
          </View>
        ) : list.length === 0 ? (
          <View className="tr__state">
            <Text className="tr__state-title">暂无匹配记录</Text>
            <Text className="tr__state-desc">试试切换记录类型</Text>
          </View>
        ) : (
          <View className="tr__cards">
            {list.map((item, idx) => {
              const correctRate =
                item.wordCount > 0 ? Math.round((item.correctCount / item.wordCount) * 100) : 0
              const key =
                item.sessionIds?.join('-') ||
                `${item.wordBookId || 0}-${item.day || item.startedAt || item.id || idx}`
              const day = item.day || (item.startedAt ? String(item.startedAt).slice(0, 10) : '—')
              return (
                <View key={key} className="tr__card">
                  <View className="tr__card-header">
                    <View className="tr__card-title-wrap">
                      {tab === 'study' ? (
                        <List size={18} color="#4ECDC4" />
                      ) : (
                        <Refresh size={18} color="#55A3FF" />
                      )}
                      <Text className="tr__card-title">
                        {item.wordBookName || `词书 #${item.wordBookId || '—'}`}
                      </Text>
                    </View>
                    <View className="tr__card-day">
                      <Text className="tr__card-day-text">{day}</Text>
                    </View>
                  </View>

                  <View className="tr__card-meta">
                    <View className="tr__meta-item">
                      <Clock size={14} color="#a4a097" />
                      <Text className="tr__meta-text">{fmtTime(item.latestAt || item.startedAt)}</Text>
                    </View>
                    {(item.sessionCount || 0) > 1 ? (
                      <Text className="tr__meta-text">{item.sessionCount} 组</Text>
                    ) : null}
                    <Text className="tr__meta-text">单词 {item.wordCount} 个</Text>
                    <Text className="tr__meta-text">正确 {item.correctCount} 个</Text>
                    {item.wordCount > 0 ? (
                      <View className="tr__meta-rate">
                        <Check size={14} color="#1aae39" />
                        <Text className="tr__meta-rate-text">正确率 {correctRate}%</Text>
                      </View>
                    ) : null}
                  </View>

                  <View className="tr__card-status">
                    <View className={`tr__status-badge ${tab === 'study' ? 'tr__status-badge--study' : 'tr__status-badge--review'}`}>
                      <Text className="tr__status-text">
                        {tab === 'study' ? '正课' : '抗遗忘'}
                      </Text>
                    </View>
                  </View>
                </View>
              )
            })}
            {loadingMore ? (
              <View className="tr__state tr__state--more">
                <Text className="tr__state-text">加载更多…</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
