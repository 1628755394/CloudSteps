/**
 * CloudSteps Button — 三端兼容（微信小程序 / H5 / RN）。
 *
 * 小程序 / H5：用 scss（button.scss）+ CSS 变量，className 驱动。
 * RN：用 StyleSheet.create + JS Token（tokens.ts），style 驱动，
 *     按压态用 Pressable 的 onPressEnter/onPressLeave 切换。
 *
 * variants 与 web 端对齐：brand / brandOutline / mint / mintOutline /
 *   destructive / outline / secondary / ghost / card
 * sizes: default / sm / lg / pill / pillLg / icon / iconRound
 * 额外：loading / loadingText
 */
import React, { useState } from 'react'
import { Button as TaroButton, Text } from '@tarojs/components'
import { color, fontSize, size, radius, space, borderWidth, rpx, type RNCSSProperties } from '../../styles/tokens'
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

/* ============ RN 端样式（StyleSheet + JS Token） ============ */
const IS_RN = process.env.TARO_ENV === 'rn'

const rnVariantBase: Record<ButtonVariant, RNCSSProperties> = {
  brand: { backgroundColor: color.primary, color: color.white },
  brandOutline: { backgroundColor: color.transparent, color: color.primary, borderWidth: borderWidth.hairline, borderColor: color.primary },
  mint: { backgroundColor: color.primary, color: color.white },
  mintOutline: { backgroundColor: color.transparent, color: color.primary, borderWidth: borderWidth.hairline, borderColor: color.primary },
  destructive: { backgroundColor: color.destructive, color: color.white },
  outline: { backgroundColor: color.card, color: color.charcoal, borderWidth: borderWidth.hairline, borderColor: color.input },
  secondary: { backgroundColor: color.tintSky, color: color.foreground },
  ghost: { backgroundColor: color.transparent, color: color.charcoal },
  card: {
    height: 'auto' as any,
    width: '100%' as any,
    flexDirection: 'column' as any,
    alignItems: 'flex-start' as any,
    borderRadius: radius.md,
    borderWidth: borderWidth.hairline,
    borderColor: color.border,
    backgroundColor: color.card,
    color: color.charcoal,
    padding: space.lg,
  },
}

const rnVariantActive: Record<ButtonVariant, RNCSSProperties> = {
  brand: { backgroundColor: color.primaryDeep },
  brandOutline: { backgroundColor: color.primarySoft12 },
  mint: { backgroundColor: color.primaryDeep },
  mintOutline: { backgroundColor: color.primarySoft12 },
  destructive: { backgroundColor: 'rgba(224, 49, 49, 0.9)' },
  outline: { backgroundColor: color.surfaceSoft },
  secondary: {},
  ghost: { backgroundColor: color.surfaceSoft },
  card: { borderColor: color.primary },
}

const rnSize: Record<ButtonSize, RNCSSProperties> = {
  default: { height: size.btnMd, paddingHorizontal: space.lg },
  sm: { height: size.btnSm, paddingHorizontal: space.md, fontSize: fontSize.sm, borderRadius: radius.sm },
  lg: { height: size.btnLg, paddingHorizontal: space.xl, borderRadius: radius.sm },
  pill: { height: size.btnMd, paddingHorizontal: space.lg, borderRadius: radius.pill },
  pillLg: { height: size.btnLg, paddingHorizontal: space.xl, borderRadius: radius.pill, fontSize: fontSize.md },
  icon: { width: size.btnMd, height: size.btnMd, paddingHorizontal: 0, borderRadius: radius.sm },
  iconRound: { width: size.btnMd, height: size.btnMd, paddingHorizontal: 0, borderRadius: radius.pill },
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
    const [pressed, setPressed] = useState(false)

    // 小程序 / H5 端：className 驱动
    if (!IS_RN) {
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
    }

    // RN 端：style 驱动 + Pressable 按压态
    const rnStyle: RNCSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rpx(8),
      borderRadius: radius.sm,
      fontWeight: '500',
      fontSize: fontSize.md,
      lineHeight: 1,
      borderWidth: 0,
      ...rnVariantBase[variant],
      ...rnSize[size],
      ...(isDisabled ? { opacity: 0.5 } : {}),
      ...(pressed ? rnVariantActive[variant] : {}),
      ...style,
    }

    return (
      <TaroButton
        ref={ref}
        disabled={isDisabled}
        onClick={onClick}
        style={rnStyle}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
      >
        {loading && <Text style={{ fontSize: fontSize.sm, color: 'currentColor', marginRight: rpx(8) }}>...</Text>}
        {loading && loadingText ? loadingText : children}
      </TaroButton>
    )
  },
)

CloudButton.displayName = 'CloudButton'

export default CloudButton
