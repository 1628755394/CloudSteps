/**
 * CloudInput — 对齐 web 端 fieldClass 风格的输入框。
 * 基于 NutUI Input 封装,Warm Mint 主题。
 */
import React from 'react'
import { Input as NutInput } from '@nutui/nutui-react-taro'
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
  },
)

CloudInput.displayName = 'CloudInput'

export default CloudInput
