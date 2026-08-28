/**
 * 词汇测试入口 — 对齐 web/src/pages/VocabularyTest.tsx。
 *
 * 中心内容:大标题"测一测你的词汇量"+副标题+开始测试按钮。
 * 点击开始:调用 getVocabStart() 预加载,成功后跳 vocab-test-testing。
 */
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, Star } from '@nutui/icons-react-taro'
import { CloudButton } from '../../components/button'
import { getVocabStart } from '../../api/vocab'
import { getTrainingStudent } from '../../utils/trainingStudent'
import { useAuthStore } from '../../stores/authStore'
import { color } from '../../styles/tokens'
import './index.scss'

export default function VocabTest() {
  const [preparing, setPreparing] = useState(false)
  const role = useAuthStore((s) => s.user)?.role || 'user'
  const isCoach = role === 'user' || role === 'admin' || role === 'teacher'
  const boundStudent = isCoach ? getTrainingStudent() : null

  const handleBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.reLaunch({ url: '/pages/home/index' })
    })
  }

  const handleStart = async () => {
    if (preparing) return
    if (isCoach && !boundStudent?.id) {
      Taro.showToast({ title: '请先在首页选择学员', icon: 'none' })
      Taro.navigateBack({ delta: 1 }).catch(() => {
        Taro.reLaunch({ url: '/pages/home/index' })
      })
      return
    }
    setPreparing(true)
    try {
      const res = await getVocabStart()
      if (res.code !== 200) {
        Taro.showToast({ title: res.msg || '准备题目失败', icon: 'none' })
        setPreparing(false)
        return
      }
      Taro.navigateTo({ url: '/pages/vocab-test-testing/index' })
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'msg' in e ? String((e as { msg: string }).msg) : '准备题目失败'
      Taro.showToast({ title: msg, icon: 'none' })
      setPreparing(false)
    }
  }

  return (
    <View className="vt">
      {/* 顶部导航 */}
      <View className="vt__nav">
        <View className="vt__nav-back" onClick={handleBack}>
          <ArrowLeft size={20} color={color.charcoal} />
        </View>
        <Text className="vt__nav-title">词汇测试</Text>
        <View className="vt__nav-placeholder" />
      </View>

      {/* 中心内容 */}
      <View className="vt__center">
        <View className="vt__text-block">
          <Text className="vt__title">测一测你的词汇量</Text>
          <Text className="vt__subtitle">
            {boundStudent?.name
              ? `本次测评将记入「${boundStudent.name}」的词汇测试记录`
              : '花几分钟测试一下，定位你的词汇量水平'}
          </Text>
        </View>

        <View className="vt__icon-wrap">
          <View className="vt__icon-circle">
            <Star size={48} color={color.primary} />
          </View>
        </View>

        <CloudButton
          variant="brand"
          size="pillLg"
          className="vt__start-btn"
          loading={preparing}
          loadingText="准备题目…"
          onClick={handleStart}
        >
          开始测试
        </CloudButton>

        <Text className="vt__tip">诚实做题可以得到真实的测试结果</Text>
      </View>
    </View>
  )
}
