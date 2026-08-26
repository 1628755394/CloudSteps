/**
 * 词汇测试结果页 — 对齐 web/src/pages/VocabularyTestResult.tsx。
 *
 * 调用 getVocabResult() 获取结果(优先读取缓存)。
 * 显示:估算词汇量(大数字)+等级+答题统计(总数/正确数/正确率)。
 */
import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, Refresh, Star, Check, Clock } from '@nutui/icons-react-taro'
import { CloudButton } from '../../components/button'
import { getVocabResult } from '../../api/vocab'
import './index.scss'

interface VocabResult {
  level: string
  estimatedVocab: number
  correctCount: number
  totalCount: number
}

function normalizeVocabResult(raw: any): VocabResult | null {
  const data = raw?.record || raw
  if (!data) return null
  const estimatedVocab = Number(data.estimatedVocab)
  const correctCount = Number(data.correctCount)
  const totalCount = Number(data.totalCount ?? data.questionCount)
  if (!data.level && !data.estimatedLevel && !Number.isFinite(estimatedVocab)) return null
  return {
    level: String(data.level ?? data.estimatedLevel ?? ''),
    estimatedVocab: Number.isFinite(estimatedVocab) ? estimatedVocab : 0,
    correctCount: Number.isFinite(correctCount) ? correctCount : 0,
    totalCount: Number.isFinite(totalCount) ? totalCount : 0,
  }
}

export default function VocabTestResult() {
  const [result, setResult] = useState<VocabResult | null>(null)
  const [loading, setLoading] = useState(true)

  const handleBack = () => {
    Taro.navigateBack({ delta: 2 }).catch(() => {
      Taro.reLaunch({ url: '/pages/material-selection/index' })
    })
  }

  const handleRetry = () => {
    Taro.redirectTo({ url: '/pages/vocab-test/index' })
  }

  const handleHome = () => {
    Taro.reLaunch({ url: '/pages/home/index' })
  }

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const res = await getVocabResult()
      if (res.code === 200) {
        const mapped = normalizeVocabResult(res.data)
        if (mapped) setResult(mapped)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        // 优先读取缓存(测试页提交时写入)
        const cached = Taro.getStorageSync('vocabulary_test_result')
        if (cached) {
          const parsed = normalizeVocabResult(
            typeof cached === 'string' ? JSON.parse(cached) : cached
          )
          if (parsed) {
            if (mounted) setResult(parsed)
            return
          }
        }
        const res = await getVocabResult()
        if (mounted && res.code === 200) {
          const mapped = normalizeVocabResult(res.data)
          if (mapped) setResult(mapped)
        }
      } catch {
        /* ignore */
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const correctRate =
    result && result.totalCount > 0
      ? Math.round((result.correctCount / result.totalCount) * 100)
      : 0

  return (
    <View className="vtr">
      {/* 顶部导航 */}
      <View className="vtr__nav">
        <View className="vtr__nav-back" onClick={handleBack}>
          <ArrowLeft size={20} color="#37352f" />
        </View>
        <Text className="vtr__nav-title">测试结果</Text>
        <View className="vtr__nav-placeholder" />
      </View>

      <ScrollView className="vtr__body" scrollY enableFlex>
        {loading ? (
          <View className="vtr__state">
            <Text className="vtr__state-text">结果加载中...</Text>
          </View>
        ) : !result ? (
          <View className="vtr__empty">
            <Text className="vtr__empty-title">暂无测试结果</Text>
            <Text className="vtr__empty-desc">去开始一次词汇量测试吧</Text>
            <CloudButton variant="brand" size="pill" className="vtr__empty-btn" onClick={handleBack}>
              返回资料选择
            </CloudButton>
          </View>
        ) : (
          <View className="vtr__content">
            {/* 词汇量大数字 */}
            <View className="vtr__hero">
              <Text className="vtr__hero-label">估算词汇量</Text>
              <Text className="vtr__hero-number">{result.estimatedVocab.toLocaleString()}</Text>
              {result.level ? (
                <View className="vtr__hero-level">
                  <Star size={18} color="#4ECDC4" />
                  <Text className="vtr__hero-level-text">{result.level}</Text>
                </View>
              ) : null}
            </View>

            {/* 答题统计 */}
            <View className="vtr__stats">
              <View className="vtr__stat-card">
                <View className="vtr__stat-icon vtr__stat-icon--total">
                  <Clock size={22} color="#55A3FF" />
                </View>
                <Text className="vtr__stat-value">{result.totalCount}</Text>
                <Text className="vtr__stat-label">总题数</Text>
              </View>
              <View className="vtr__stat-card">
                <View className="vtr__stat-icon vtr__stat-icon--correct">
                  <Check size={22} color="#1aae39" />
                </View>
                <Text className="vtr__stat-value">{result.correctCount}</Text>
                <Text className="vtr__stat-label">正确数</Text>
              </View>
              <View className="vtr__stat-card">
                <View className="vtr__stat-icon vtr__stat-icon--rate">
                  <Star size={22} color="#4ECDC4" />
                </View>
                <Text className="vtr__stat-value">{correctRate}%</Text>
                <Text className="vtr__stat-label">正确率</Text>
              </View>
            </View>

            {/* 操作按钮 */}
            <View className="vtr__actions">
              <CloudButton variant="brand" size="pill" className="vtr__action-btn" onClick={handleRetry}>
                重新测试
              </CloudButton>
              <CloudButton variant="outline" size="pill" className="vtr__action-btn" onClick={handleHome}>
                返回首页
              </CloudButton>
            </View>

            <CloudButton variant="ghost" size="pill" className="vtr__refresh-btn" onClick={handleRefresh}>
              <Refresh size={16} color="#787671" />
              <Text style={{ marginLeft: '8rpx' }}>刷新结果</Text>
            </CloudButton>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
