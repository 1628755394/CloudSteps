/**
 * CloudInput — 三端兼容（微信小程序 / H5 / RN）。
 *
 * 小程序 / H5：用 scss（input.scss）+ CSS 变量，className 驱动。
 * RN：用 style + JS Token，因为 RN 不支持 CSS 变量和伪类。
 *
 * 基于 NutUI Input 封装，Warm Mint 主题。
 */
import React, { useState } from 'react'
import { Input as NutInput } from '@nutui/nutui-react-taro'
import { color, fontSize, size, radius, space, borderWidth, type RNCSSProperties } from '../../styles/tokens'
import './input.scss'

export interface CloudInputProps {
  value?: string
  defaultValue?: string
  placeholder?: string
  type?: 'text' | 'password' | 'number' | 'digit'
  disabled?: boolean
  maxLength?: number
  onChange?: (value: string) => void
  onInput?: (e: any) => void
  onFocus?: (e: any) => void
  onBlur?: (e: any) => void
  className?: string
  /** 是否自动聚焦 */
  focus?: boolean
  /** 键盘右下角按钮文字 */
  confirmType?: 'send' | 'search' | 'next' | 'go' | 'done'
}

const IS_RN = process.env.TARO_ENV === 'rn'

export const CloudInput = React.forwardRef<any, CloudInputProps>(
  (
    {
      value,
      defaultValue,
      placeholder,
      type = 'text',
      disabled,
      maxLength,
      onChange,
      onInput,
      onFocus,
      onBlur,
      className = '',
      focus,
      confirmType = 'done',
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false)

    // 小程序 / H5 端
    if (!IS_RN) {
      return (
        <NutInput
          ref={ref}
          className={`cs-input ${className}`}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          type={type}
          disabled={disabled}
          maxLength={maxLength}
          onChange={onChange}
          onInput={onInput}
          onFocus={onFocus}
          onBlur={onBlur}
          focus={focus}
          confirmType={confirmType}
        />
      )
    }

    // RN 端：style 驱动 + focus 状态切换边框色
    const rnStyle: RNCSSProperties = {
      width: '100%',
      height: size.inputHeight,
      paddingHorizontal: space.lg,
      borderRadius: radius.md,
      backgroundColor: color.card,
      borderWidth: borderWidth.hairline,
      borderColor: isFocused ? color.primary : color.input,
      color: color.charcoal,
      fontSize: fontSize.lg,
      ...(disabled ? { opacity: 0.5 } : {}),
    }

    return (
      <NutInput
        ref={ref}
        style={rnStyle}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        placeholderTextColor={color.mutedSoft}
        type={type}
        disabled={disabled}
        maxLength={maxLength}
        onChange={onChange}
        onInput={onInput}
        onFocus={(e: any) => {
          setIsFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e: any) => {
          setIsFocused(false)
          onBlur?.(e)
        }}
        focus={focus}
        confirmType={confirmType}
      />
    )
  },
)

CloudInput.displayName = 'CloudInput'

export default CloudInput
