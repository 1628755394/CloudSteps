/**
 * CloudCard — 三端兼容（微信小程序 / H5 / RN）。
 *
 * 小程序 / H5：用 scss（card.scss）+ CSS 变量。
 * RN：用 StyleSheet + JS Token。
 *
 * white canvas, hairline border, radius 12px, padding 16-24px
 */
import React from 'react'
import { View } from '@tarojs/components'
import { color, radius, space, borderWidth, type RNCSSProperties } from '../../styles/tokens'
import './card.scss'

export interface CloudCardProps {
  className?: string
  children?: React.ReactNode
  /** 内边距:default=32rpx, compact=24rpx, none=0 */
  padding?: 'default' | 'compact' | 'none'
  /** 点击事件 */
  onClick?: (e: any) => void
}

const IS_RN = process.env.TARO_ENV === 'rn'

const rnPaddingMap: Record<NonNullable<CloudCardProps["padding"]>, number> = {
  default: space.lg, // 32rpx = 16px
  compact: space.md, // 24rpx = 12px
  none: 0,
}

export const CloudCard = React.forwardRef<any, CloudCardProps>(
  ({ className = '', children, padding = 'default', onClick }, ref) => {
    if (!IS_RN) {
      const paddingClass = `cs-card--pad-${padding}`
      return (
        <View
          ref={ref}
          className={`cs-card ${paddingClass} ${className}`}
          onClick={onClick}
        >
          {children}
        </View>
      )
    }

    // RN 端
    const rnStyle: RNCSSProperties = {
      backgroundColor: color.card,
      borderWidth: borderWidth.hairline,
      borderColor: color.border,
      borderRadius: radius.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
      padding: rnPaddingMap[padding],
    }

    return (
      <View ref={ref} style={rnStyle} onClick={onClick}>
        {children}
      </View>
    )
  },
)

CloudCard.displayName = 'CloudCard'

export default CloudCard
