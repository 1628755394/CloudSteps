/**
 * 学习材料选择 — 对齐 web/src/pages/MaterialSelection.tsx。
 *
 * 顶部导航:返回 + "选择学习材料"
 * 材料卡片列表,点击跳转对应页面或提示待开发。
 */
import React from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, Right, Star, List, ShieldCheck, Clock, Check, Notice } from '@nutui/icons-react-taro'
import { color } from '../../styles/tokens'
import './index.scss'

interface Material {
  id: number
  name: string
  desc: string
  icon: React.ReactNode
  enabled: boolean
  action: () => void
}

export default function MaterialSelection() {
  const handleBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.reLaunch({ url: '/pages/home/index' })
    })
  }

  const goVocabTest = () => {
    Taro.navigateTo({ url: '/pages/vocab-test/index' })
  }
  const goWordbooks = () => {
    Taro.navigateTo({ url: '/pages/wordbooks/index' })
  }
  const goScenario = () => {
    Taro.navigateTo({ url: '/pages/scenario-selection/index' })
  }
  const todo = () => {
    Taro.showToast({ title: '功能待开发', icon: 'none' })
  }

  const materials: Material[] = [
    {
      id: 1,
      name: '词汇测试',
      desc: '测一测你的词汇量水平',
      icon: <Star size={24} color={color.primary} />,
      enabled: true,
      action: goVocabTest,
    },
    {
      id: 2,
      name: '单词练习',
      desc: '选择词库进行单词训练',
      icon: <List size={24} color={color.secondaryBrand} />,
      enabled: true,
      action: goWordbooks,
    },
    {
      id: 3,
      name: '解析语法',
      desc: '深入理解句子语法结构',
      icon: <ShieldCheck size={24} color={color.primary} />,
      enabled: true,
      action: todo,
    },
    {
      id: 4,
      name: '阅读理解',
      desc: '提升阅读分析与理解力',
      icon: <Clock size={24} color={color.secondaryBrand} />,
      enabled: true,
      action: todo,
    },
    {
      id: 5,
      name: '完形填空',
      desc: '语境填空强化语感',
      icon: <Check size={24} color={color.primary} />,
      enabled: true,
      action: todo,
    },
    {
      id: 6,
      name: '情景口语',
      desc: '真实场景对话练习',
      icon: <Notice size={24} color={color.secondaryBrand} />,
      enabled: true,
      action: goScenario,
    },
  ]

  return (
    <View className="ms">
      {/* 顶部导航 */}
      <View className="ms__nav">
        <View className="ms__nav-back" onClick={handleBack}>
          <ArrowLeft size={20} color={color.charcoal} />
        </View>
        <Text className="ms__nav-title">选择学习材料</Text>
        <View className="ms__nav-placeholder" />
      </View>

      <ScrollView className="ms__body" scrollY enableFlex>
        <Text className="ms__subtitle">为你设计有针对性的资料，迅速提高水平</Text>

        <View className="ms__list">
          {materials.map((m) => (
            <View
              key={m.id}
              className={`ms__card ${!m.enabled ? 'ms__card--disabled' : ''}`}
              onClick={m.enabled ? m.action : undefined}
            >
              <View className="ms__card-icon">{m.icon}</View>
              <View className="ms__card-content">
                <Text className="ms__card-title">{m.name}</Text>
                <Text className="ms__card-desc">{m.desc}</Text>
              </View>
              <Right size={18} color={color.mutedSoft} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
