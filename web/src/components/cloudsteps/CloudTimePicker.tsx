import * as React from "react";
import { TimePicker as ArcoTimePicker } from "@arco-design/web-react";
import { useIsMobile } from "../ui/use-mobile";
import { MobileTimeWheel } from "./MobileWheelPicker";

export type CloudTimePickerProps = {
  label?: string;
  /** HH:mm */
  value?: string;
  onChange?: (timeString: string) => void;
  className?: string;
  style?: React.CSSProperties;
  format?: string;
  allowClear?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * 时间选择：H5 用滚轮弹层（取消/确认），桌面用 Arco TimePicker
 */
export function CloudTimePicker({
  label,
  value,
  onChange,
  className,
  style,
  format = "HH:mm",
  allowClear = true,
  disabled,
  placeholder = "请选择时间",
}: CloudTimePickerProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MobileTimeWheel
        label={label}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  return (
    <div className="w-full">
      {label && (
        <label className="text-sm text-charcoal font-medium mb-1.5 block">{label}</label>
      )}
      <ArcoTimePicker
        className={`cloud-timepicker ${className ?? ""}`}
        style={{
          borderRadius: 12,
          height: 40,
          width: "100%",
          ...style,
        }}
        format={format}
        value={value || undefined}
        allowClear={allowClear}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(timeString) => onChange?.(timeString || "")}
      />
    </div>
  );
}
