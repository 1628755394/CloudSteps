/**
 * 防遗忘页 — 对齐 web/src/pages/AntiForgetting.tsx。
 *
 * 移动端布局:
 *  1. 顶部导航:返回 + "防遗忘"
 *  2. 日期选择卡片:上一日 / 日期显示 / 下一日
 *  3. 复习任务卡片列表:词库名 + 待复习单词数
 *  4. 点击"复习"按钮 showToast 待开发
 */
import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, Right, Clock, List } from '@nutui/icons-react-taro'
// ArrowLeft used in date navigation arrows
import { CloudButton } from '../../components/button'
import { listReviewBooksByDate, type ReviewBookStatRow } from '../../api/review'
import './index.scss'

function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseYMDLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((x) => Number(x))
  if (!y || !m || !d) return new Date()
  return new Date(y, m - 1, d)
}

function formatDateLabel(ymd: string): string {
  const d = parseYMDLocal(ymd)
  if (Number.isNaN(d.getTime())) return ymd
  const today = toDateInputValue(new Date())
  const yesterday = toDateInputValue(new Date(Date.now() - 86400000))
  const tomorrow = toDateInputValue(new Date(Date.now() + 86400000))
  let prefix = ''
  if (ymd === today) prefix = '今天 · '
  else if (ymd === yesterday) prefix = '昨天 · '
  else if (ymd === tomorrow) prefix = '明天 · '
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${prefix}${mm}月${dd}日 周${weekdays[d.getDay()]}`
}

function trainingTime(cnt: number): string {
  return `${Math.min(60, Math.max(10, Math.ceil(cnt / 20) * 10))}分钟`
}

export default function AntiForgetting() {
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()))
  const [bookStats, setBookStats] = useState<ReviewBookStatRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const tz = 'Asia/Shanghai'
        const res = await listReviewBooksByDate(selectedDate, tz)
        const arr = Array.isArray(res.data) ? (res.data as ReviewBookStatRow[]) : []
        if (mounted) setBookStats(arr)
      } catch {
        if (mounted) setBookStats([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [selectedDate])

  const shiftDate = (deltaDays: number) => {
    const d = parseYMDLocal(selectedDate)
    d.setDate(d.getDate() + deltaDays)
    setSelectedDate(toDateInputValue(d))
  }

  const handleReview = (b: ReviewBookStatRow) => {
    if (b.cnt <= 0) return
    Taro.showToast({ title: '复习功能待开发', icon: 'none' })
  }

  const totalWords = bookStats.reduce((sum, b) => sum + (b.cnt || 0), 0)

  return (
    <View className="anti">
      <ScrollView className="anti__body" scrollY enableFlex>
        {/* 日期选择卡片 */}
        <View className="anti__date-card">
          <View
            className="anti__date-arrow"
            onClick={() => shiftDate(-1)}
          >
            <ArrowLeft size={24} color="#4ECDC4" />
          </View>
          <View className="anti__date-center">
            <Text className="anti__date-label">选择日期</Text>
            <Text className="anti__date-value">{formatDateLabel(selectedDate)}</Text>
          </View>
          <View
            className="anti__date-arrow"
            onClick={() => shiftDate(1)}
          >
            <Right size={24} color="#4ECDC4" />
          </View>
        </View>

        {/* 概览 */}
        {!loading && bookStats.length > 0 && (
          <View className="anti__overview">
            <View className="anti__overview-icon">
              <List size={18} color="#4ECDC4" />
            </View>
            <Text className="anti__overview-text">
              本日 {bookStats.length} 个词库 · 共 {totalWords} 词待复习
            </Text>
          </View>
        )}

        {/* 任务列表 */}
        {loading ? (
          <View className="anti__state">
            <Text className="anti__state-text">加载中...</Text>
          </View>
        ) : bookStats.length === 0 ? (
          <View className="anti__empty">
            <View className="anti__empty-icon">
              <List size={40} color="#a4a097" />
            </View>
            <Text className="anti__empty-text">
              该日暂无待复习词库任务{'\n'}可切换日期查看其它天的计划
            </Text>
          </View>
        ) : (
          <View className="anti__tasks">
            {bookStats.map((b, idx) => (
              <View key={`${b.wordBookId}-${idx}`} className="anti__task">
                <View className="anti__task-main">
                  <View className="anti__task-icon">
                    <List size={18} color="#55A3FF" />
                  </View>
                  <View className="anti__task-info">
                    <Text className="anti__task-name">{b.name}</Text>
                    <View className="anti__task-meta">
                      <View className="anti__task-count">
                        <Clock size={12} color="#4ECDC4" />
                        <Text className="anti__task-count-text">{b.cnt} 词</Text>
                      </View>
                      <Text className="anti__task-time">{trainingTime(b.cnt)}</Text>
                    </View>
                  </View>
                </View>
                <CloudButton
                  variant="brand"
                  size="sm"
                  disabled={b.cnt <= 0}
                  onClick={() => handleReview(b)}
                >
                  {b.cnt <= 0 ? '暂无词' : '复习'}
                </CloudButton>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: '48rpx' }} />
      </ScrollView>
    </View>
  )
}
