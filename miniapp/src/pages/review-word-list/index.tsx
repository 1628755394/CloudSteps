/**
 * 复习单词列表页 — 对齐 web/src/pages/ReviewWordList.tsx。
 *
 * 功能:
 *  1. 通过 URL 参数 wordBookId + date 加载待复习单词
 *  2. view=1 时为只读模式(查看),否则为复习模式
 *  3. 每个单词:点击播放音频、点击翻面看释义
 *  4. 标记认识(✓)/不认识(✗)
 *  5. 全部标记后提交复习结果
 *  6. 提交成功后返回上一页
 */
import React, { useEffect, useMemo, useState, useRef } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { ArrowLeft, Check, Close, VolumeMax } from '@nutui/icons-react-taro'
import {
  getReviewToday,
  startReviewSession,
  completeReviewSession,
} from '../../api/review'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { CloudButton } from '../../components/button'
import './index.scss'

interface ReviewWordItem {
  id: number
  word: string
  translation?: string
  audioUrl?: string
  status: null | 'correct' | 'wrong'
  showTranslation: boolean
  heard: boolean
}

function formatTranslation(raw?: string): string {
  if (!raw) return ''
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr.join('；')
    return String(arr)
  } catch {
    return raw
  }
}

export default function ReviewWordList() {
  const router = useRouter()
  const wordBookId = Number(router.params.wordBookId || 0)
  const reviewDate = String(router.params.date || '')
  const viewOnly = router.params.view === '1'

  const [words, setWords] = useState<ReviewWordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const audioCtxRef = useRef<any>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await getReviewToday(wordBookId, {
          date: reviewDate || undefined,
          limit: 200,
        })
        const ws = Array.isArray(res.data?.words)
          ? (res.data.words as Array<{
              id: number
              word: string
              translation?: string
              audioUrl?: string
            }>)
          : []
        const mapped: ReviewWordItem[] = ws.map((w) => ({
          id: Number(w.id),
          word: String(w.word || ''),
          translation: w.translation ? formatTranslation(String(w.translation)) : undefined,
          audioUrl: w.audioUrl ? String(w.audioUrl) : undefined,
          status: null,
          showTranslation: false,
          heard: false,
        }))
        if (!mounted) return
        setWords(mapped)
      } catch {
        if (!mounted) return
        setWords([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [wordBookId, reviewDate])

  const markedWords = useMemo(() => words.filter((w) => w.status !== null), [words])
  const markedCount = markedWords.length
  const unmarkedCount = words.length - markedCount
  const allMarked = words.length > 0 && unmarkedCount === 0
  const correctCount = words.filter((w) => w.status === 'correct').length
  const wrongCount = words.filter((w) => w.status === 'wrong').length

  const playAudio = (item: ReviewWordItem) => {
    if (!item.audioUrl) return
    const url = resolveMediaUrl(item.audioUrl)
    if (!url) return
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = Taro.createInnerAudioContext()
      }
      const ctx = audioCtxRef.current
      ctx.src = url
      ctx.stop()
      ctx.play()
      setPlayingId(item.id)
      ctx.onEnded(() => setPlayingId(null))
      ctx.onError(() => setPlayingId(null))
    } catch {
      setPlayingId(null)
    }
  }

  const handleWordClick = (item: ReviewWordItem) => {
    // 点击单词:第一次播放音频,第二次翻面看释义
    if (!item.heard && item.audioUrl) {
      playAudio(item)
      setWords((prev) => prev.map((w) => w.id === item.id ? { ...w, heard: true } : w))
      return
    }
    setWords((prev) =>
      prev.map((w) => {
        if (w.id === item.id) return { ...w, showTranslation: !w.showTranslation }
        return { ...w, showTranslation: false }
      }),
    )
  }

  const handleStatusClick = (id: number, newStatus: 'correct' | 'wrong') => {
    setHint(null)
    setWords((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w
        if (w.status === newStatus) return { ...w, status: null }
        return { ...w, status: newStatus }
      }),
    )
  }

  const markAllCorrect = () => {
    setHint(null)
    setWords((prev) => prev.map((w) => ({ ...w, status: 'correct' as const })))
  }

  const clearMarks = () => {
    setHint(null)
    setWords((prev) => prev.map((w) => ({ ...w, status: null })))
  }

  const handleSubmit = async () => {
    if (submitting) return
    if (words.length === 0) {
      setHint('当前没有可复习的单词')
      return
    }
    if (!allMarked) {
      setHint(`还有 ${unmarkedCount} 个单词未勾选，请全部选择 ✓ 或 × 后再提交`)
      return
    }
    setHint(null)
    setSubmitting(true)
    try {
      const wordIds = markedWords.map((w) => w.id)
      const startRes = await startReviewSession({ wordBookId, wordIds })
      const sid = Number(startRes.data?.sessionId || 0)
      if (!sid) {
        setHint('无待复习单词，已返回')
        setSubmitting(false)
        Taro.navigateBack()
        return
      }
      const results = markedWords.map((w) => ({
        wordId: w.id,
        remembered: w.status === 'correct',
      }))
      const res = await completeReviewSession(sid, results)
      if (res.code !== 200) {
        throw new Error(res.msg || '提交失败')
      }
      Taro.showToast({ title: '复习完成', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch {
      setHint('提交复习结果失败，请稍后重试')
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    Taro.navigateBack()
  }

  return (
    <View className="rwl">
      {/* 顶部导航 */}
      <View className="rwl__navbar">
        <View className="rwl__nav-btn" onClick={handleBack}>
          <ArrowLeft size={22} color="#37352f" />
        </View>
        <Text className="rwl__nav-title">{viewOnly ? '查看' : '开始复习'}</Text>
        <View className="rwl__nav-btn" />
      </View>

      <ScrollView className="rwl__body" scrollY enableFlex>
        {loading ? (
          <View className="rwl__state">
            <Text className="rwl__state-text">加载中...</Text>
          </View>
        ) : words.length === 0 ? (
          <View className="rwl__empty">
            <Text className="rwl__empty-text">暂无待复习单词</Text>
          </View>
        ) : (
          <>
            {/* 统计栏 */}
            <View className="rwl__stats">
              <View className="rwl__stat">
                <Text className="rwl__stat-value rwl__stat-value--total">{words.length}</Text>
                <Text className="rwl__stat-label">总数</Text>
              </View>
              <View className="rwl__stat">
                <Text className="rwl__stat-value rwl__stat-value--correct">{correctCount}</Text>
                <Text className="rwl__stat-label">认识</Text>
              </View>
              <View className="rwl__stat">
                <Text className="rwl__stat-value rwl__stat-value--wrong">{wrongCount}</Text>
                <Text className="rwl__stat-label">不认识</Text>
              </View>
              <View className="rwl__stat">
                <Text className="rwl__stat-value rwl__stat-value--pending">{unmarkedCount}</Text>
                <Text className="rwl__stat-label">待标记</Text>
              </View>
            </View>

            {/* 单词列表 */}
            <View className="rwl__word-list">
              {words.map((item, idx) => (
                <View
                  key={item.id}
                  className={`rwl__word-card ${
                    item.status === 'correct' ? 'rwl__word-card--correct' :
                    item.status === 'wrong' ? 'rwl__word-card--wrong' : ''
                  }`}
                >
                  <View
                    className="rwl__word-main"
                    onClick={() => handleWordClick(item)}
                  >
                    <View className="rwl__word-header">
                      <Text className="rwl__word-index">{idx + 1}</Text>
                      <Text className="rwl__word-text">{item.word}</Text>
                      {item.audioUrl && (
                        <View
                          className={`rwl__word-audio ${playingId === item.id ? 'rwl__word-audio--playing' : ''}`}
                          onClick={(e) => { e.stopPropagation(); playAudio(item) }}
                        >
                          <VolumeMax size={18} color="#4ECDC4" />
                        </View>
                      )}
                    </View>
                    {item.showTranslation && item.translation && (
                      <View className="rwl__word-translation">
                        <Text className="rwl__word-translation-text">{item.translation}</Text>
                      </View>
                    )}
                  </View>
                  {!viewOnly && (
                    <View className="rwl__word-actions">
                      <View
                        className={`rwl__mark rwl__mark--correct ${item.status === 'correct' ? 'rwl__mark--active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleStatusClick(item.id, 'correct') }}
                      >
                        <Check size={18} color={item.status === 'correct' ? '#fff' : '#4ECDC4'} />
                      </View>
                      <View
                        className={`rwl__mark rwl__mark--wrong ${item.status === 'wrong' ? 'rwl__mark--active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleStatusClick(item.id, 'wrong') }}
                      >
                        <Close size={18} color={item.status === 'wrong' ? '#fff' : '#e03131'} />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* 提示 */}
            {hint && (
              <View className="rwl__hint">
                <Text className="rwl__hint-text">{hint}</Text>
              </View>
            )}

            {/* 底部操作栏 */}
            {!viewOnly && (
              <View className="rwl__footer">
                <View className="rwl__footer-btn rwl__footer-btn--outline" onClick={markAllCorrect}>
                  <Text className="rwl__footer-btn-text">全部认识</Text>
                </View>
                <View className="rwl__footer-btn rwl__footer-btn--outline" onClick={clearMarks}>
                  <Text className="rwl__footer-btn-text">清空标记</Text>
                </View>
                <CloudButton
                  variant="brand"
                  loading={submitting}
                  disabled={!allMarked}
                  onClick={handleSubmit}
                >
                  提交复习
                </CloudButton>
              </View>
            )}
          </>
        )}
        <View style={{ height: '48rpx' }} />
      </ScrollView>
    </View>
  )
}
