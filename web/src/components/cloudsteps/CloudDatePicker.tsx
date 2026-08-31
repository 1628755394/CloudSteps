import * as React from "react";
import { useTranslation } from "react-i18next";
import { DatePicker as ArcoDatePicker } from "@arco-design/web-react";
import { useIsMobile } from "../ui/use-mobile";
import { MobileDateWheel } from "./MobileWheelPicker";

export type CloudDatePickerProps = {
  label?: string;
  /** YYYY-MM-DD */
  value?: string;
  onChange?: (dateString: string) => void;
  className?: string;
  style?: React.CSSProperties;
  allowClear?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * 日期选择：H5 用滚轮弹层，桌面用 Arco DatePicker
 */
export function CloudDatePicker({
  label,
  value,
  onChange,
  className,
  style,
  allowClear = true,
  disabled,
  placeholder,
}: CloudDatePickerProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("ui.please_select_date");
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MobileDateWheel
        label={label}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={resolvedPlaceholder}
        className={className}
        allowClear={allowClear}
      />
    );
  }

  return (
    <div className="w-full">
      {label && (
        <label className="text-sm text-charcoal font-medium mb-1.5 block">{label}</label>
      )}
      <ArcoDatePicker
        className={`cloud-datepicker ${className ?? ""}`}
        style={{
          borderRadius: 12,
          height: 40,
          width: "100%",
          ...style,
        }}
        value={value || undefined}
        allowClear={allowClear}
        disabled={disabled}
        placeholder={resolvedPlaceholder}
        onChange={(dateString) => onChange?.(dateString || "")}
      />
    </div>
  );
}
