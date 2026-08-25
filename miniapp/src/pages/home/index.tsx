import React from 'react'
import { View, Text } from '@tarojs/components'
import { CloudButton } from '../../components/button'
import './index.scss'

export default function Home() {
  return (
    <View className="page page--home">
      <View className="page__header">
        <Text className="page__title">云阶 CloudSteps</Text>
        <Text className="page__subtitle">陪练与词汇训练平台</Text>
      </View>

      <View className="page__body">
        <View className="cs-card">
          <Text className="cs-card__title">快速入口</Text>
          <View className="cs-card__actions">
            <CloudButton variant="brand" size="lg">开始训练</CloudButton>
            <CloudButton variant="brand-outline" size="lg">词库选择</CloudButton>
            <CloudButton variant="mint" size="lg">情景口语</CloudButton>
          </View>
        </View>

        <View className="cs-card">
          <Text className="cs-card__title">按钮样式预览</Text>
          <View className="btn-grid">
            <CloudButton variant="brand">brand</CloudButton>
            <CloudButton variant="brand-outline">outline</CloudButton>
            <CloudButton variant="mint">mint</CloudButton>
            <CloudButton variant="mint-outline">mint-outline</CloudButton>
            <CloudButton variant="destructive">destructive</CloudButton>
            <CloudButton variant="outline">outline</CloudButton>
            <CloudButton variant="secondary">secondary</CloudButton>
            <CloudButton variant="ghost">ghost</CloudButton>
            <CloudButton variant="brand" size="sm">sm</CloudButton>
            <CloudButton variant="brand" size="pill">pill</CloudButton>
            <CloudButton variant="brand" loading>loading</CloudButton>
          </View>
        </View>
      </View>
    </View>
  )
}
