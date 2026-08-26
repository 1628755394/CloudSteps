/**
 * 词库页 — 对齐 web/src/pages/WordBooks.tsx。
 * 搜索栏 + 分组标签横向滚动 + 词库卡片 2 列网格 + 下拉触底加载更多。
 */
import { useCallback, useEffect, useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Search, Right, Close } from '@nutui/icons-react-taro'
import {
  listWordBooks,
  type WordBookItem,
  type WordBookGroup,
} from '../../api/wordbooks'
import './index.scss'

const PAGE_SIZE = 20

const DEFAULT_GROUPS: WordBookGroup[] = [
  { key: '', label: '全部' },
  { key: 'primary', label: '小学' },
  { key: 'middle', label: '初中' },
  { key: 'high', label: '高中' },
  { key: 'cet4', label: '大学四级' },
  { key: 'cet6', label: '大学六级' },
  { key: 'kaoyan', label: '考研' },
  { key: 'abroad', label: '留学考试' },
  { key: 'tem', label: '专四专八' },
  { key: 'textbook', label: '教材' },
]

// 封面渐变色组(按 tag hash 分配)
const COVER_GRADIENTS = [
  'linear-gradient(135deg, #4ECDC4, #44A5A0)',
  'linear-gradient(135deg, #5B8DEF, #4A7BC8)',
  'linear-gradient(135deg, #F6B042, #E89832)',
  'linear-gradient(135deg, #E8718E, #D45C78)',
  'linear-gradient(135deg, #8B7FD8, #7B6BC8)',
  'linear-gradient(135deg, #66BB6A, #4CAF50)',
  'linear-gradient(135deg, #FF8A65, #FF7043)',
  'linear-gradient(135deg, #26C6DA, #00ACC1)',
]

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function pickGradient(tag: string): string {
  return COVER_GRADIENTS[hashStr(tag) % COVER_GRADIENTS.length]
}

interface CoverInfo {
  tag: string
  t1: string
  t2: string
}

function parseCover(desc?: string): CoverInfo | null {
  if (!desc) return null
  try {
    const obj = JSON.parse(desc)
    if (obj && (obj.t1 || obj.t2 || obj.tag)) return obj
    return null
  } catch {
    return null
  }
}

export default function Wordbooks() {
  const [books, setBooks] = useState<WordBookItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [group, setGroup] = useState('')
  const [groups, setGroups] = useState<WordBookGroup[]>(DEFAULT_GROUPS)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const fetchBooks = useCallback(
    async (p: number, kw: string, g: string, append: boolean) => {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setErr(null)
      try {
        const res = await listWordBooks({
          page: p,
          pageSize: PAGE_SIZE,
          keyword: kw || undefined,
          group: g || undefined,
        })
        if (res.code !== 200) {
          setErr(res.msg || '加载失败')
          setBooks([])
          setTotal(0)
          setHasMore(false)
          return
        }
        const list = Array.isArray(res.data.list) ? res.data.list : []
        setBooks((prev) => (append ? [...prev, ...list] : list))
        setTotal(res.data.total || 0)
        setHasMore(list.length >= PAGE_SIZE && append
          ? true
          : list.length >= PAGE_SIZE && p * PAGE_SIZE < (res.data.total || 0))
        if (res.data.groups && res.data.groups.length > 0) {
          setGroups(res.data.groups)
        }
      } catch (e: unknown) {
        const msg =
          e && typeof e === 'object' && 'msg' in e
            ? String((e as { msg: string }).msg)
            : '加载失败'
        setErr(msg)
        setBooks([])
        setTotal(0)
        setHasMore(false)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [],
  )

  useEffect(() => {
    fetchBooks(page, keyword, group, page > 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, keyword, group])

  const handleGroupChange = (g: string) => {
    setGroup(g)
    setPage(1)
  }

  const handleSearch = () => {
    setPage(1)
    setKeyword(searchInput.trim())
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setPage(1)
    setKeyword('')
  }

  const onScrollToLower = () => {
    if (loadingMore || loading || !hasMore) return
    setPage((p) => p + 1)
  }

  const openBook = (b: WordBookItem) => {
    Taro.navigateTo({
      url: `/pages/wordbook-words/index?id=${b.id}&name=${encodeURIComponent(b.name)}`,
    })
  }

  return (
    <ScrollView
      className="wordbooks"
      scrollY
      enableFlex
      lowerThreshold={120}
      onScrollToLower={onScrollToLower}
    >
      {/* 搜索栏 */}
      <View className="wordbooks__search">
        <View className="wordbooks__search-box">
          <Search size={18} color="#a4a097" />
          <Input
            className="wordbooks__search-input"
            value={searchInput}
            onInput={(e) => setSearchInput(e.detail.value)}
            onConfirm={handleSearch}
            placeholder="搜索词库名称…"
            placeholderClass="wordbooks__search-placeholder"
            confirmType="search"
          />
          {searchInput ? (
            <View className="wordbooks__search-clear" onClick={() => setSearchInput('')}>
              <Close size={14} color="#a4a097" />
            </View>
          ) : null}
        </View>
        {keyword ? (
          <Text className="wordbooks__search-clear-btn" onClick={handleClearSearch}>
            清除
          </Text>
        ) : null}
      </View>

      {err && (
        <View className="wordbooks__error">
          <Text>{err}</Text>
        </View>
      )}

      {/* 分组标签横向滚动 */}
      <ScrollView scrollX enableFlex showScrollbar={false} className="wordbooks__groups">
        {groups.map((g) => (
          <View
            key={g.key || 'all'}
            className={`wordbooks__group-tag ${group === g.key ? 'wordbooks__group-tag--active' : ''}`}
            onClick={() => handleGroupChange(g.key)}
          >
            <Text>{g.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 词库卡片列表 */}
      {loading ? (
        <View className="wordbooks__status">
          <Text>加载中…</Text>
        </View>
      ) : books.length === 0 ? (
        <View className="wordbooks__status">
          <Text>{keyword ? '未找到匹配的词库' : '暂无词库'}</Text>
        </View>
      ) : (
        <View className="wordbooks__grid">
          {books.map((b) => {
            const cover = parseCover(b.description)
            const gradient = pickGradient(cover?.tag || b.name)
            return (
              <View
                key={b.id}
                className="wordbooks__card"
                onClick={() => openBook(b)}
              >
                {/* 封面区域 */}
                <View
                  className="wordbooks__cover"
                  style={{ background: gradient }}
                >
                  {cover ? (
                    <>
                      <Text className="wordbooks__cover-t1">{cover.t1}</Text>
                      <Text className="wordbooks__cover-t2">{cover.t2}</Text>
                      {cover.tag ? (
                        <Text className="wordbooks__cover-tag">{cover.tag}</Text>
                      ) : null}
                    </>
                  ) : (
                    <Text className="wordbooks__cover-name">{b.name}</Text>
                  )}
                  {b.level ? (
                    <View className="wordbooks__cover-level">
                      <Text>{b.level}</Text>
                    </View>
                  ) : null}
                </View>
                {/* 信息区域 */}
                <View className="wordbooks__info">
                  <Text className="wordbooks__name">{b.name}</Text>
                  <View className="wordbooks__meta">
                    <Text className="wordbooks__count">{b.wordCount || 0} 词</Text>
                    <Right size={14} color="#a4a097" />
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      )}

      {loadingMore && (
        <View className="wordbooks__loadmore">
          <Text>加载中…</Text>
        </View>
      )}
      {!loading && !loadingMore && !hasMore && books.length > 0 && (
        <View className="wordbooks__loadmore">
          <Text>没有更多了</Text>
        </View>
      )}

      <View className="wordbooks__footer">
        <Text>共 {total} 本词库</Text>
      </View>
    </ScrollView>
  )
}
