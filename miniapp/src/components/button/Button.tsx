/**
 * CloudSteps Button — 对齐 web/src/components/ui/button.tsx + CloudButton.tsx。
 *
 * 基于 Taro 原生 Button 封装,Warm Mint 主题。
 * variants 与 web 端对齐:brand / brandOutline / mint / mintOutline /
 *   destructive / outline / secondary / ghost / card
 * sizes:default / sm / lg / pill / pillLg / icon / iconRound
 * 额外:loading / loadingText
 */
import React from 'react'
import { Button as TaroButton, Text, View } from '@tarojs/components'
import './button.scss'

export type ButtonVariant =
  | 'brand'
  | 'brandOutline'
  | 'mint'
  | 'mintOutline'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'card'

export type ButtonSize = 'default' | 'sm' | 'lg' | 'pill' | 'pillLg' | 'icon' | 'iconRound'

export interface CloudButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  loading?: boolean
  loadingText?: React.ReactNode
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: (e: any) => void
  children?: React.ReactNode
  style?: React.CSSProperties
}

const variantClass: Record<ButtonVariant, string> = {
  brand: 'cs-btn--brand',
  brandOutline: 'cs-btn--brand-outline',
  mint: 'cs-btn--mint',
  mintOutline: 'cs-btn--mint-outline',
  destructive: 'cs-btn--destructive',
  outline: 'cs-btn--outline',
  secondary: 'cs-btn--secondary',
  ghost: 'cs-btn--ghost',
  card: 'cs-btn--card',
}

const sizeClass: Record<ButtonSize, string> = {
  default: 'cs-btn--md',
  sm: 'cs-btn--sm',
  lg: 'cs-btn--lg',
  pill: 'cs-btn--pill',
  pillLg: 'cs-btn--pill-lg',
  icon: 'cs-btn--icon',
  iconRound: 'cs-btn--icon-round',
}

export const CloudButton = React.forwardRef<any, CloudButtonProps>(
  (
    {
      variant = 'brand',
      size = 'default',
      className = '',
      loading = false,
      loadingText,
      disabled,
      type = 'button',
      onClick,
      children,
      style,
    },
    ref,
  ) => {
    const isDisabled = disabled || loading
    const classes = [
      'cs-btn',
      variantClass[variant],
      sizeClass[size],
      isDisabled ? 'cs-btn--disabled' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <TaroButton
        ref={ref}
        className={classes}
        disabled={isDisabled}
        type={type as any}
        onClick={onClick}
        style={style}
      >
        {loading && <Text className="cs-btn__spinner">...</Text>}
        {loading && loadingText ? loadingText : children}
      </TaroButton>
    )
  },
)

CloudButton.displayName = 'CloudButton'

export default CloudButton
