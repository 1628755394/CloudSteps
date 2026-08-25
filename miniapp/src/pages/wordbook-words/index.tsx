/**
 * 词库单词列表 — 对齐 web/src/pages/WordBookWords.tsx。
 *
 * 接收参数:id(词库ID)、name(词库名)
 * 功能:搜索、单词卡片列表、播放音频、触底分页加载。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { ArrowLeft, Search } from '@nutui/icons-react-taro'
import { listWordBookWords, type WordBookWord } from '../../api/wordbooks'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import './index.scss'

function formatPhonetic(w: WordBookWord): string {
  const parts = [w.phonetic, w.phoneticUs, w.phoneticUk].filter((x) => x && String(x).trim())
  if (parts.length === 0) return ''
  return Array.from(new Set(parts.map((p) => String(p).trim()))).join(' · ')
}

function formatMeaning(w: WordBookWord): string {
  const def = w.definition?.trim()
  if (def) return def
  const raw = w.translation?.trim()
  if (!raw) return '—'
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean).join('；')
    }
    if (typeof parsed === 'string') return parsed
  } catch {
    /* not JSON */
  }
  return raw
}

export default function WordBookWords() {
  const params = getCurrentInstance().router?.params || {}
  const bookId = Number(params.id)
  const bookNameParam = decodeURIComponent(params.name || '')

  const [bookName] = useState(bookNameParam)
  const [keyword, setKeyword] = useState('')
  const [debouncedKw, setDebouncedKw] = useState('')
  const [list, setList] = useState<WordBookWord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 40
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const audioCtxRef = useRef<Taro.InnerAudioContext | null>(null)

  // 防抖搜索
  useEffect(() => {
    const t = setTimeout(() => setDebouncedKw(keyword.trim()), 350)
    return () => clearTimeout(t)
  }, [keyword])

  // 搜索关键字变化时重置分页
  useEffect(() => {
    setPage(1)
  }, [debouncedKw])

  const loadFirst = useCallback(async () => {
    if (!Number.isFinite(bookId) || bookId <= 0) return
    setLoading(true)
    setErr(null)
    try {
      const res = await listWordBookWords(bookId, {
        page: 1,
        pageSize,
        keyword: debouncedKw || undefined,
      })
      if (res.code !== 200) {
        setErr(res.msg || '加载单词失败')
        setList([])
        return
      }
      const d = res.data
      setList(Array.isArray(d?.list) ? d.list : [])
      setTotal(Number(d?.total ?? 0))
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'msg' in e ? String((e as { msg: string }).msg) : '加载失败'
      setErr(msg)
      setList([])
    } finally {
      setLoading(false)
    }
  }, [bookId, debouncedKw, pageSize])

  useEffect(() => {
    void loadFirst()
  }, [loadFirst])

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return
    const nextPage = page + 1
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    if (nextPage > totalPages) return
    setLoadingMore(true)
    try {
      const res = await listWordBookWords(bookId, {
        page: nextPage,
        pageSize,
        keyword: debouncedKw || undefined,
      })
      if (res.code === 200) {
        const d = res.data
        const next = Array.isArray(d?.list) ? d.list : []
        setList((prev) => [...prev, ...next])
        setPage(nextPage)
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false)
    }
  }, [bookId, debouncedKw, page, pageSize, total, loading, loadingMore])

  const play = (w: WordBookWord) => {
    if (!w.audioUrl) {
      Taro.showToast({ title: '暂无发音音频', icon: 'none' })
      return
    }
    const urls = w.audioUrl.split(';').map((u) => u.trim()).filter(Boolean)
    if (urls.length === 0) {
      Taro.showToast({ title: '暂无有效的发音音频', icon: 'none' })
      return
    }
    const src = resolveMediaUrl(urls[0])
    if (!src) {
      Taro.showToast({ title: '暂无有效的发音音频', icon: 'none' })
      return
    }
    // 停掉上一个
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.stop()
        audioCtxRef.current.destroy()
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null
    }
    const ctx = Taro.createInnerAudioContext()
    ctx.src = src
    ctx.autoplay = true
    ctx.onEnded(() => {
      setPlayingId(null)
    })
    ctx.onError(() => {
      setPlayingId(null)
      Taro.showToast({ title: '音频播放失败', icon: 'none' })
    })
    audioCtxRef.current = ctx
    setPlayingId(w.id)
  }

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.destroy()
        } catch {
          /* ignore */
        }
      }
    }
  }, [])

  const handleBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.reLaunch({ url: '/pages/wordbooks/index' })
    })
  }

  if (!Number.isFinite(bookId) || bookId <= 0) {
    return (
      <View className="wbw wbw--empty">
        <Text className="wbw__empty-text">无效词库</Text>
        <Text className="wbw__back-link" onClick={handleBack}>返回</Text>
      </View>
    )
  }

  return (
    <View className="wbw">
      {/* 顶部导航 */}
      <View className="wbw__nav">
        <View className="wbw__nav-back" onClick={handleBack}>
          <ArrowLeft size={20} color="#37352f" />
        </View>
        <Text className="wbw__nav-title">{bookName || `词库 #${bookId}`}</Text>
        <View className="wbw__nav-placeholder" />
      </View>

      {/* 搜索框 */}
      <View className="wbw__search">
        <Search size={20} color="#a4a097" />
        <Input
          className="wbw__search-input"
          type="text"
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          placeholder="搜索单词、释义…"
          placeholderClass="wbw__search-ph"
          confirmType="search"
        />
        {keyword ? (
          <Text className="wbw__search-clear" onClick={() => setKeyword('')}>清除</Text>
        ) : null}
      </View>

      {/* 统计 */}
      <View className="wbw__meta">
        <Text className="wbw__meta-text">
          共 {total} 个单词{debouncedKw ? '（已筛选）' : ''}
        </Text>
      </View>

      {err ? (
        <View className="wbw__error">
          <Text className="wbw__error-text">{err}</Text>
        </View>
      ) : null}

      <ScrollView
        className="wbw__list"
        scrollY
        enableFlex
        onScrollToLower={loadMore}
        lowerThreshold={120}
      >
        {loading ? (
          <View className="wbw__state">
            <Text className="wbw__state-text">加载中…</Text>
          </View>
        ) : list.length === 0 ? (
          <View className="wbw__state">
            <Text className="wbw__state-text">暂无单词</Text>
          </View>
        ) : (
          <View className="wbw__cards">
            {list.map((w) => {
              const ipa = formatPhonetic(w)
              const mean = formatMeaning(w)
              const hasAudio = Boolean(
                w.audioUrl &&
                  w.audioUrl.split(';').some((u) => resolveMediaUrl(u.trim()))
              )
              const isPlaying = playingId === w.id
              return (
                <View key={w.id} className="wbw__card">
                  <View className="wbw__card-main">
                    <View className="wbw__word-row">
                      <Text className="wbw__word">{w.word}</Text>
                      {w.partOfSpeech ? (
                        <Text className="wbw__pos">{w.partOfSpeech}</Text>
                      ) : null}
                    </View>
                    {ipa ? <Text className="wbw__phonetic">{ipa}</Text> : null}
                    <Text className="wbw__meaning">{mean}</Text>
                    {w.exampleSentence ? (
                      <Text className="wbw__example">{w.exampleSentence}</Text>
                    ) : null}
                  </View>
                  <View
                    className={`wbw__play ${!hasAudio ? 'wbw__play--disabled' : ''} ${isPlaying ? 'wbw__play--playing' : ''}`}
                    onClick={() => hasAudio && play(w)}
                  >
                    <Text className="wbw__play-text">
                      {hasAudio ? (isPlaying ? '播放中' : '播放') : '无音频'}
                    </Text>
                  </View>
                </View>
              )
            })}
            {loadingMore ? (
              <View className="wbw__state wbw__state--more">
                <Text className="wbw__state-text">加载更多…</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
