/**
 * 情景口语页 — 对齐 web/src/pages/ScenarioSelection.tsx。
 *
 * 移动端布局:
 *  1. 顶部导航:返回 + "情景口语"
 *  2. 口语能力概览卡片:综合分 + 练习次数 + 累计分钟
 *  3. 场景列表:场景图标 + 名称 + 难度标签 + 描述
 *  4. 点击场景 showToast "语音功能待开发"(小程序不支持 realtime voice)
 */
import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, Star, Notice } from '@nutui/icons-react-taro'
import {
  listScenarios,
  getSpeakingStats,
  type Scenario,
  type SpeakingStats,
} from '../../api/scenarioDialogue'
import './index.scss'

const difficultyLabel: Record<string, string> = {
  easy: '入门',
  medium: '进阶',
  hard: '挑战',
}

const difficultyColor: Record<string, { bg: string; text: string }> = {
  easy: { bg: 'rgba(26, 174, 57, 0.1)', text: '#1aae39' },
  medium: { bg: 'rgba(85, 163, 255, 0.1)', text: '#55A3FF' },
  hard: { bg: 'rgba(255, 107, 107, 0.1)', text: '#FF6B6B' },
}

function scenarioInitial(s: Scenario) {
  return (s.name || '?').trim().slice(0, 1).toUpperCase() || '?'
}

export default function ScenarioSelection() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [stats, setStats] = useState<SpeakingStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([listScenarios(), getSpeakingStats()])
      .then(([scRes, stRes]) => {
        if (!mounted) return
        if (scRes.code === 200) setScenarios(scRes.data || [])
        if (stRes.code === 200) setStats(stRes.data)
      })
      .catch(() => {
        // 忽略
      })
      .then(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const handleSelect = () => {
    Taro.showToast({ title: '语音功能待开发', icon: 'none' })
  }

  return (
    <View className="scenario">
      {/* 顶部导航栏 */}
      <View className="scenario__navbar">
        <View className="scenario__nav-btn" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={22} color="#37352f" />
        </View>
        <Text className="scenario__nav-title">情景口语</Text>
        <View className="scenario__nav-btn" />
      </View>

      <ScrollView className="scenario__body" scrollY enableFlex>
        {/* 流程提示 */}
        <Text className="scenario__flow">选择场景 → 语音对话 → 实时纠错 → 课后复盘</Text>

        {/* 语音提示 */}
        <View className="scenario__voice-hint">
          <View className="scenario__voice-hint-icon">
            <Notice size={16} color="#c37d0d" />
          </View>
          <View className="scenario__voice-hint-content">
            <Text className="scenario__voice-hint-title">语音功能待开发</Text>
            <Text className="scenario__voice-hint-desc">
              小程序暂不支持实时语音对话,敬请期待
            </Text>
          </View>
        </View>

        {/* 口语能力概览 */}
        {stats && stats.totalSessions > 0 && (
          <View className="scenario__stats">
            <View className="scenario__stats-header">
              <View className="scenario__stats-header-left">
                <Star size={16} color="#4ECDC4" />
                <Text className="scenario__stats-title">口语能力概览</Text>
              </View>
            </View>
            <View className="scenario__stats-grid">
              <View className="scenario__stat-card scenario__stat-card--mint">
                <Text className="scenario__stat-value scenario__stat-value--primary">
                  {stats.avgOverallScore}
                </Text>
                <Text className="scenario__stat-label">综合分</Text>
              </View>
              <View className="scenario__stat-card scenario__stat-card--sky">
                <Text className="scenario__stat-value scenario__stat-value--blue">
                  {stats.totalSessions}
                </Text>
                <Text className="scenario__stat-label">练习次数</Text>
              </View>
              <View className="scenario__stat-card scenario__stat-card--soft">
                <Text className="scenario__stat-value scenario__stat-value--green">
                  {Math.round(stats.totalMinutes)}
                </Text>
                <Text className="scenario__stat-label">累计分钟</Text>
              </View>
            </View>
          </View>
        )}

        {/* 场景列表 */}
        {loading ? (
          <View className="scenario__state">
            <Text className="scenario__state-text">加载场景中...</Text>
          </View>
        ) : scenarios.length === 0 ? (
          <View className="scenario__empty">
            <Text className="scenario__empty-text">暂无可用场景</Text>
          </View>
        ) : (
          <View className="scenario__list">
            {scenarios.map((s) => {
              const diff = difficultyColor[s.difficulty] || difficultyColor.medium
              const label = difficultyLabel[s.difficulty] || s.difficulty
              return (
                <View
                  key={s.id}
                  className="scenario__item"
                  onClick={() => handleSelect()}
                >
                  <View className="scenario__item-main">
                    <View
                      className="scenario__item-icon"
                      style={{ backgroundColor: diff.bg }}
                    >
                      <Text className="scenario__item-icon-text" style={{ color: diff.text }}>
                        {scenarioInitial(s)}
                      </Text>
                    </View>
                    <View className="scenario__item-info">
                      <View className="scenario__item-title-row">
                        <Text className="scenario__item-name">{s.name}</Text>
                        <View
                          className="scenario__item-tag"
                          style={{ backgroundColor: diff.bg }}
                        >
                          <Text className="scenario__item-tag-text" style={{ color: diff.text }}>
                            {label}
                          </Text>
                        </View>
                      </View>
                      <Text className="scenario__item-desc">{s.description}</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}
        <View style={{ height: '48rpx' }} />
      </ScrollView>
    </View>
  )
}
