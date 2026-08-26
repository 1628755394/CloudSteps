/**
 * CaptchaWidget — 对齐 web/src/components/CaptchaWidget.tsx。
 * 适配小程序:用 Taro Image 组件显示验证码图片,Input 输入答案。
 * 只支持 image 和 math 两种类型(跳过 click/jigsaw/rotate/slider)。
 */
import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, Input, Image } from '@tarojs/components'
import { getCaptcha, type CaptchaResponse, type CaptchaFields } from '../../api/auth'
import './captcha.scss'

interface CaptchaWidgetProps {
  onChange: (fields: CaptchaFields | null) => void
}

const SKIPPED_CAPTCHA_TYPES = new Set(['click', 'jigsaw', 'rotate', 'slider'])

export default function CaptchaWidget({ onChange }: CaptchaWidgetProps) {
  const [captcha, setCaptcha] = useState<CaptchaResponse | null>(null)
  const [value, setValue] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    setValue(null)
    onChange(null)
    try {
      const res = await getCaptcha()
      if (res.code === 200 && res.data) {
        if (SKIPPED_CAPTCHA_TYPES.has(res.data.type)) {
          // 跳过不支持的类型,重新获取
          refresh()
          return
        }
        setCaptcha(res.data)
      } else {
        setError(res.msg || '获取验证码失败')
      }
    } catch {
      setError('获取验证码失败')
    }
  }, [onChange])

  useEffect(() => {
    refresh()
  }, [refresh])

  const reportValue = useCallback(
    (v: any) => {
      setValue(v)
      if (captcha && v != null && v !== '') {
        onChange({
          captchaId: captcha.id,
          captchaType: captcha.type,
          captchaValue: v,
        })
      } else {
        onChange(null)
      }
    },
    [captcha, onChange],
  )

  if (error) {
    return (
      <View className="captcha">
        <Text className="captcha__error">{error}</Text>
        <Text className="captcha__retry" onClick={refresh}>重试</Text>
      </View>
    )
  }

  if (!captcha) {
    return (
      <View className="captcha">
        <Text className="captcha__loading">加载中...</Text>
      </View>
    )
  }

  if (captcha.type === 'image') {
    const img = (captcha.data?.image as string) || ''
    return (
      <View className="captcha">
        <View className="captcha__row">
          <Input
            className="captcha__input"
            type="text"
            value={value || ''}
            onInput={(e) => reportValue(e.detail.value)}
            placeholder="输入图中字符"
            placeholderClass="captcha__placeholder"
          />
          <View className="captcha__image-btn" onClick={refresh}>
            {img ? (
              <Image className="captcha__image" src={img} mode="aspectFill" />
            ) : (
              <Text className="captcha__loading">加载中...</Text>
            )}
          </View>
        </View>
      </View>
    )
  }

  if (captcha.type === 'math') {
    const q = (captcha.data?.question as string) || ''
    return (
      <View className="captcha">
        <View className="captcha__row">
          <Text className="captcha__question">{q}</Text>
          <Input
            className="captcha__input captcha__input--math"
            type="number"
            value={value ?? ''}
            onInput={(e) => reportValue(Number(e.detail.value))}
            placeholder="答案"
            placeholderClass="captcha__placeholder"
          />
          <Text className="captcha__refresh" onClick={refresh}>换一题</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="captcha">
      <Text className="captcha__loading">不支持的验证码类型</Text>
    </View>
  )
}
