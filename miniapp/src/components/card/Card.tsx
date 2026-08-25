/**
 * CloudCard — 对齐 web 端卡片样式:
 * white canvas, hairline border, radius 12-16px, padding 16-24px
 */
import React from 'react'
import { View } from '@tarojs/components'
import './card.scss'

export interface CloudCardProps {
  className?: string
  children?: React.ReactNode
  /** 内边距:default=32rpx, compact=24rpx, none=0 */
  padding?: 'default' | 'compact' | 'none'
  /** 点击事件 */
  onClick?: (e: any) => void
}

export const CloudCard = React.forwardRef<any, CloudCardProps>(
  ({ className = '', children, padding = 'default', onClick }, ref) => {
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
  },
)

CloudCard.displayName = 'CloudCard'

export default CloudCard
