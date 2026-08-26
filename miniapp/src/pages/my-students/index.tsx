/**
 * 我的学生页 — 对齐 web/src/pages/MyStudents.tsx。
 *
 * 移动端布局:
 *  1. 顶部导航:返回 + "我的学生" + 新建按钮
 *  2. 搜索框
 *  3. 学员卡片列表:头像 + 姓名 + 剩余时长(低于30分钟红色) + 账号 + 统计(测评/陪练/训练)
 *  4. 密码设置:点击弹出 modal 设置密码
 *  5. 触底加载更多(游标分页)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, Search, Plus, Clock, Setting, Refresh } from '@nutui/icons-react-taro'
import { CloudButton } from '../../components/button'
import {
  getTeacherCoachingQuotas,
  setTeacherStudentPassword,
  type TeacherCoachingQuotaRow,
} from '../../api/coaching'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import './index.scss'

const DEFAULT_PASSWORD = 'student123'
const PAGE_LIMIT = 20

function studentLabel(row: TeacherCoachingQuotaRow) {
  const s = row.student
  return s?.displayName || s?.username || s?.email || `学员 #${row.studentId}`
}

function studentInitial(row: TeacherCoachingQuotaRow) {
  return (studentLabel(row) || '?').trim().slice(0, 1).toUpperCase() || '?'
}

function studentAvatarUrl(row: TeacherCoachingQuotaRow) {
  return resolveMediaUrl(row.student?.avatar)
}

function loginAccount(row: TeacherCoachingQuotaRow) {
  return row.student?.username || row.student?.email || ''
}

function minsLabel(n: number) {
  if (n >= 60) {
    const h = Math.floor(n / 60)
    const m = n % 60
    return m ? `${h}小时${m}分` : `${h}小时`
  }
  return `${n}分钟`
}

export default function MyStudents() {
  const [rows, setRows] = useState<TeacherCoachingQuotaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [hasMore, setHasMore] = useState(false)

  // 密码 modal
  const [pwdTarget, setPwdTarget] = useState<TeacherCoachingQuotaRow | null>(null)
  const [pwdValue, setPwdValue] = useState(DEFAULT_PASSWORD)
  const [pwdSaving, setPwdSaving] = useState(false)

  const loadingMoreRef = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedQ(keyword.trim()), 300)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [keyword])

  const fetchPage = useCallback(
    async (opts: { cursor?: string; append: boolean; q: string }) => {
      if (opts.append) {
        if (loadingMoreRef.current) return
        loadingMoreRef.current = true
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      try {
        const res = await getTeacherCoachingQuotas({
          cursor: opts.cursor,
          limit: PAGE_LIMIT,
          q: opts.q || undefined,
        })
        if (res.code !== 200) {
          Taro.showToast({ title: res.msg || '加载失败', icon: 'none' })
          if (!opts.append) setRows([])
          return
        }
        const data = res.data as any
        const list: TeacherCoachingQuotaRow[] = Array.isArray(data?.list) ? data.list : []
        setRows((prev) => (opts.append ? [...prev, ...list] : list))
        setNextCursor(data?.nextCursor || undefined)
        setHasMore(Boolean(data?.hasMore))
      } catch (e: any) {
        Taro.showToast({ title: e?.msg || '加载失败', icon: 'none' })
        if (!opts.append) setRows([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
        loadingMoreRef.current = false
      }
    },
    [],
  )

  useEffect(() => {
    void fetchPage({ append: false, q: debouncedQ })
  }, [debouncedQ, fetchPage])

  const onScrollToLower = () => {
    if (loading || loadingMore || !hasMore || !nextCursor) return
    void fetchPage({ cursor: nextCursor, append: true, q: debouncedQ })
  }

  const openPwdModal = (r: TeacherCoachingQuotaRow) => {
    setPwdTarget(r)
    setPwdValue(DEFAULT_PASSWORD)
  }

  const closePwdModal = () => {
    if (pwdSaving) return
    setPwdTarget(null)
    setPwdValue(DEFAULT_PASSWORD)
  }

  const savePassword = async (resetDefault: boolean) => {
    if (!pwdTarget) return
    const pwd = resetDefault ? DEFAULT_PASSWORD : pwdValue.trim()
    if (!pwd || pwd.length < 6) {
      Taro.showToast({ title: '密码至少 6 位', icon: 'none' })
      return
    }
    setPwdSaving(true)
    try {
      const res = await setTeacherStudentPassword(pwdTarget.studentId, pwd)
      if (res.code !== 200) {
        Taro.showToast({ title: res.msg || '设置失败', icon: 'none' })
        return
      }
      const account = res.data?.username || loginAccount(pwdTarget) || studentLabel(pwdTarget)
      Taro.showToast({
        title: resetDefault ? `已重置:${account}` : '密码已更新',
        icon: 'success',
      })
      setPwdTarget(null)
    } catch (e: any) {
      Taro.showToast({ title: e?.msg || '设置失败', icon: 'none' })
    } finally {
      setPwdSaving(false)
    }
  }

  const handleCreate = () => {
    Taro.showToast({ title: '新建学员待开发', icon: 'none' })
  }

  return (
    <View className="students">
      {/* 顶部导航栏 */}
      <View className="students__navbar">
        <View className="students__nav-btn" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={22} color="#37352f" />
        </View>
        <Text className="students__nav-title">我的学生</Text>
        <View className="students__nav-actions">
          <View
            className="students__nav-icon"
            onClick={() => void fetchPage({ append: false, q: debouncedQ })}
          >
            <Refresh size={18} color="#787671" />
          </View>
          <View className="students__nav-create" onClick={handleCreate}>
            <Plus size={16} color="#4ECDC4" />
            <Text className="students__nav-create-text">新建</Text>
          </View>
        </View>
      </View>

      {/* 搜索框 */}
      <View className="students__search">
        <View className="students__search-box">
          <Search size={18} color="#a4a097" />
          <Input
            className="students__search-input"
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
            placeholder="搜索姓名 / 账号 / 手机…"
            placeholderClass="students__search-placeholder"
            confirmType="search"
          />
          {keyword.length > 0 && (
            <View className="students__search-clear" onClick={() => setKeyword('')}>
              <Text className="students__search-clear-text">×</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        className="students__body"
        scrollY
        enableFlex
        lowerThreshold={120}
        onScrollToLower={onScrollToLower}
      >
        {loading ? (
          <View className="students__state">
            <Text className="students__state-text">加载中...</Text>
          </View>
        ) : rows.length === 0 ? (
          <View className="students__empty">
            <Text className="students__empty-text">
              {debouncedQ ? '没有匹配的学员' : '暂无学员,点击右上角「新建」创建账号'}
            </Text>
          </View>
        ) : (
          <View className="students__list">
            {rows.map((r) => {
              const low = (r.remainingMinutes || 0) < 30
              const account = loginAccount(r)
              const avatar = studentAvatarUrl(r)
              return (
                <View key={r.id} className="students__card">
                  <View className="students__card-main">
                    <View className="students__avatar">
                      {avatar ? (
                        <Image className="students__avatar-img" src={avatar} mode="aspectFill" />
                      ) : (
                        <Text className="students__avatar-text">{studentInitial(r)}</Text>
                      )}
                    </View>

                    <View className="students__info">
                      <View className="students__name-row">
                        <Text className="students__name">{studentLabel(r)}</Text>
                        <View
                          className={`students__mins ${low ? 'students__mins--low' : ''}`}
                        >
                          <Clock size={12} color={low ? '#e03131' : '#4ECDC4'} />
                          <Text
                            className="students__mins-text"
                            style={{ color: low ? '#e03131' : '#4ECDC4' }}
                          >
                            {minsLabel(r.remainingMinutes || 0)}
                          </Text>
                        </View>
                      </View>
                      <Text className="students__account">
                        {account || '—'}
                      </Text>
                      <View className="students__stats">
                        <Text className="students__stat">
                          测评 <Text className="students__stat-num">{r.vocabTestCount ?? 0}</Text>
                        </Text>
                        <Text className="students__stat-divider">·</Text>
                        <Text className="students__stat">
                          陪练 <Text className="students__stat-num">{r.coachingSessionCount ?? 0}</Text>
                        </Text>
                        <Text className="students__stat-divider">·</Text>
                        <Text className="students__stat">
                          训练 <Text className="students__stat-num">{r.studySessionCount ?? 0}</Text>
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="students__card-actions">
                    <View
                      className="students__action-btn"
                      onClick={() => openPwdModal(r)}
                    >
                      <Setting size={14} color="#4ECDC4" />
                      <Text className="students__action-text">密码</Text>
                    </View>
                  </View>
                </View>
              )
            })}

            {loadingMore && (
              <View className="students__more">
                <Text className="students__more-text">加载中...</Text>
              </View>
            )}
            {!loading && !hasMore && rows.length > 0 && (
              <View className="students__more">
                <Text className="students__more-text">没有更多了</Text>
              </View>
            )}
          </View>
        )}
        <View style={{ height: '48rpx' }} />
      </ScrollView>

      {/* 密码设置 Modal */}
      {pwdTarget && (
        <View className="students__mask" onClick={closePwdModal}>
          <View className="students__modal" onClick={(e) => e.stopPropagation()}>
            <View className="students__modal-header">
              <Text className="students__modal-title">设置登录密码</Text>
              <View className="students__modal-close" onClick={closePwdModal}>
                <Text className="students__modal-close-icon">×</Text>
              </View>
            </View>
            <Text className="students__modal-desc">
              {studentLabel(pwdTarget)}
              {loginAccount(pwdTarget) ? ` · ${loginAccount(pwdTarget)}` : ''}
            </Text>

            <View className="students__modal-field">
              <Input
                className="students__modal-input"
                value={pwdValue}
                onInput={(e) => setPwdValue(e.detail.value)}
                placeholder={DEFAULT_PASSWORD}
                placeholderClass="students__modal-placeholder"
                password
                maxlength={32}
              />
            </View>

            <View className="students__modal-footer">
              <CloudButton
                variant="outline"
                size="lg"
                disabled={pwdSaving}
                onClick={() => void savePassword(true)}
                className="students__modal-btn"
              >
                重置为默认
              </CloudButton>
              <CloudButton
                variant="brand"
                size="lg"
                loading={pwdSaving}
                onClick={() => void savePassword(false)}
                className="students__modal-btn"
              >
                保存密码
              </CloudButton>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
