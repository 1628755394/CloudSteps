/**
 * 编辑资料页 — 对齐 web/src/pages/ProfileEdit.tsx。
 * 小程序适配:用 Taro.chooseImage 选头像,Taro.uploadFile 上传。
 * 优化:卡片式分组布局 + 头像相机角标 + 资料完整度进度条 + 底部固定保存栏。
 */
import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { CloudButton } from '../../components/button'
import { updateCurrentUser, uploadAvatar } from '../../api/auth'
import { useAuthStore } from '../../stores/authStore'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import './index.scss'

const TIMEZONES = [
  'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Singapore',
  'Asia/Tokyo', 'America/Los_Angeles', 'America/New_York',
  'Europe/London', 'Europe/Paris',
]

const TZ_LABELS: Record<string, string> = {
  'Asia/Shanghai': '中国标准时间 (UTC+8)',
  'Asia/Hong_Kong': '香港时间 (UTC+8)',
  'Asia/Taipei': '台北时间 (UTC+8)',
  'Asia/Singapore': '新加坡时间 (UTC+8)',
  'Asia/Tokyo': '日本时间 (UTC+9)',
  'America/Los_Angeles': '太平洋时间 (UTC-8)',
  'America/New_York': '东部时间 (UTC-5)',
  'Europe/London': '伦敦时间 (UTC+0)',
  'Europe/Paris': '巴黎时间 (UTC+1)',
}

export default function ProfileEdit() {
  const user = useAuthStore((s) => s.user)
  const refreshUserInfo = useAuthStore((s) => s.refreshUserInfo)
  const updateProfile = useAuthStore((s) => s.updateProfile)

  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [region, setRegion] = useState('')
  const [city, setCity] = useState('')
  const [timezone, setTimezone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [showTzPicker, setShowTzPicker] = useState(false)

  useEffect(() => {
    setDisplayName(user?.displayName ?? '')
    setPhone(user?.phone ?? '')
    setRegion(user?.region ?? '')
    setCity(user?.city ?? '')
    setTimezone(user?.timezone ?? '')
    setAvatarUrl(resolveMediaUrl(user?.avatar))
  }, [user])

  // 资料完整度
  const profileComplete = useMemo(() => {
    if (typeof (user as any)?.profileComplete === 'number') return (user as any).profileComplete
    const checks = [
      Boolean(displayName.trim() || user?.displayName),
      Boolean(avatarUrl || user?.avatar),
      Boolean(phone.trim() || user?.phone),
      Boolean(city.trim() || user?.city),
      Boolean(region.trim() || user?.region),
      Boolean(timezone.trim() || user?.timezone),
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [user, displayName, avatarUrl, phone, city, region, timezone])

  const onPickAvatar = async () => {
    if (uploading) return
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      })
      const filePath = res.tempFilePaths[0]
      if (!filePath) return

      setAvatarUrl(filePath)
      setUploading(true)
      setErrorText(null)
      try {
        const uploadRes = await uploadAvatar(filePath)
        if (uploadRes.code !== 200 || !uploadRes.data?.avatar) {
          setErrorText(uploadRes.msg || '头像上传失败')
          setAvatarUrl(resolveMediaUrl(user?.avatar))
          return
        }
        updateProfile({ avatar: uploadRes.data.avatar })
        setAvatarUrl(resolveMediaUrl(uploadRes.data.avatar))
        await refreshUserInfo()
        Taro.showToast({ title: '头像已更新', icon: 'success' })
      } catch (err: any) {
        setAvatarUrl(resolveMediaUrl(user?.avatar))
        setErrorText(err?.msg || '头像上传失败')
      } finally {
        setUploading(false)
      }
    } catch {
      // 用户取消选择
    }
  }

  const onSave = async () => {
    setErrorText(null)
    if (!displayName.trim()) {
      setErrorText('请输入昵称')
      return
    }
    try {
      setSaving(true)
      const res = await updateCurrentUser({
        displayName: displayName.trim(),
        phone: phone.trim(),
        region: region.trim(),
        city: city.trim(),
        timezone: timezone.trim(),
      })
      if (res.code !== 200) {
        setErrorText(res.msg || '保存失败')
        return
      }
      await refreshUserInfo()
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch (e: any) {
      setErrorText(e?.msg || e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const initial = (displayName || user?.email || '?').trim().slice(0, 1).toUpperCase() || '?'
  const tzLabel = timezone ? TZ_LABELS[timezone] || timezone : ''

  return (
    <View className="edit">
      {/* 顶部导航栏 */}
      <View className="edit__navbar">
        <View className="edit__nav-btn" onClick={() => Taro.navigateBack()}>
          <Text className="edit__nav-back">{'<'}</Text>
        </View>
        <Text className="edit__nav-title">编辑个人资料</Text>
        <View className="edit__nav-btn" />
      </View>

      <ScrollView className="edit__body" scrollY enableFlex>
        {/* 头像区 */}
        <View className="edit__avatar-card">
          <View className="edit__avatar-wrap" onClick={onPickAvatar}>
            {avatarUrl ? (
              <Image className="edit__avatar" src={avatarUrl} mode="aspectFill" />
            ) : (
              <View className="edit__avatar-placeholder">
                <Text className="edit__avatar-text">{initial}</Text>
              </View>
            )}
            {uploading && (
              <View className="edit__avatar-loading">
                <Text className="edit__avatar-loading-text">上传中</Text>
              </View>
            )}
            {/* 相机角标 */}
            <View className="edit__avatar-badge">
              <Text className="edit__avatar-badge-icon">+</Text>
            </View>
          </View>
          <Text className="edit__avatar-hint">点击更换头像</Text>

          {/* 资料完整度 */}
          <View className="edit__progress">
            <View className="edit__progress-header">
              <Text className="edit__progress-label">资料完整度</Text>
              <Text className="edit__progress-value">{profileComplete}%</Text>
            </View>
            <View className="edit__progress-bar">
              <View
                className="edit__progress-fill"
                style={{ width: `${profileComplete}%` }}
              />
            </View>
          </View>
        </View>

        {/* 基本信息 */}
        <View className="edit__section">
          <Text className="edit__section-title">基本信息</Text>
          <View className="edit__form-card">
            <View className="edit__field">
              <Text className="edit__label">昵称</Text>
              <Input
                className="edit__input"
                value={displayName}
                onInput={(e) => setDisplayName(e.detail.value)}
                placeholder="请输入昵称"
                placeholderClass="edit__placeholder"
                maxlength={20}
              />
            </View>
            <View className="edit__divider" />
            <View className="edit__field">
              <Text className="edit__label">手机号</Text>
              <Input
                className="edit__input"
                type="number"
                value={phone}
                onInput={(e) => setPhone(e.detail.value)}
                placeholder="请输入手机号"
                placeholderClass="edit__placeholder"
                maxlength={11}
              />
            </View>
          </View>
        </View>

        {/* 地区信息 */}
        <View className="edit__section">
          <Text className="edit__section-title">地区与时区</Text>
          <View className="edit__form-card">
            <View className="edit__field">
              <Text className="edit__label">时区</Text>
              <View className="edit__picker" onClick={() => setShowTzPicker(true)}>
                <Text className={tzLabel ? 'edit__picker-value' : 'edit__placeholder'}>
                  {tzLabel || '请选择时区'}
                </Text>
                <Text className="edit__picker-arrow">{'>'}</Text>
              </View>
            </View>
            <View className="edit__divider" />
            <View className="edit__field">
              <Text className="edit__label">地区</Text>
              <Input
                className="edit__input"
                value={region}
                onInput={(e) => setRegion(e.detail.value)}
                placeholder="例如:中国"
                placeholderClass="edit__placeholder"
              />
            </View>
            <View className="edit__divider" />
            <View className="edit__field">
              <Text className="edit__label">城市</Text>
              <Input
                className="edit__input"
                value={city}
                onInput={(e) => setCity(e.detail.value)}
                placeholder="例如:深圳"
                placeholderClass="edit__placeholder"
              />
            </View>
          </View>
        </View>

        {/* 账号信息(只读) */}
        <View className="edit__section">
          <Text className="edit__section-title">账号信息</Text>
          <View className="edit__form-card">
            <View className="edit__field edit__field--readonly">
              <Text className="edit__label">邮箱</Text>
              <Text className="edit__readonly-value">{user?.email || '未绑定'}</Text>
            </View>
          </View>
        </View>

        {errorText ? (
          <View className="edit__error">
            <Text>{errorText}</Text>
          </View>
        ) : null}

        <View style={{ height: '160rpx' }} />
      </ScrollView>

      {/* 底部固定保存栏 */}
      <View className="edit__footer">
        <CloudButton
          variant="brand"
          size="lg"
          onClick={onSave}
          loading={saving}
          loadingText="保存中"
          className="edit__save-btn"
        >
          保存修改
        </CloudButton>
      </View>

      {/* 时区选择弹层 */}
      {showTzPicker && (
        <View className="edit__mask" onClick={() => setShowTzPicker(false)}>
          <View className="edit__sheet" onClick={(e) => e.stopPropagation()}>
            <View className="edit__sheet-header">
              <Text className="edit__sheet-cancel" onClick={() => setShowTzPicker(false)}>取消</Text>
              <Text className="edit__sheet-title">选择时区</Text>
              <View style={{ width: '80rpx' }} />
            </View>
            <ScrollView scrollY className="edit__sheet-list">
              {TIMEZONES.map((tz) => (
                <View
                  key={tz}
                  className={`edit__sheet-item ${timezone === tz ? 'edit__sheet-item--active' : ''}`}
                  onClick={() => {
                    setTimezone(tz)
                    setShowTzPicker(false)
                  }}
                >
                  <View className="edit__sheet-item-info">
                    <Text className="edit__sheet-item-tz">{tz}</Text>
                    <Text className="edit__sheet-item-label">{TZ_LABELS[tz] || ''}</Text>
                  </View>
                  {timezone === tz && <Text className="edit__sheet-item-check">✓</Text>}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  )
}
