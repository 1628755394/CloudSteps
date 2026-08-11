import * as React from "react";
import { DatePicker as ArcoDatePicker } from "@arco-design/web-react";
import { useIsMobile } from "../ui/use-mobile";

const nativeFieldClass =
  "w-full h-10 px-3 rounded-xl bg-card border border-input text-sm text-charcoal outline-none transition-colors hover:border-border focus:border-primary focus:ring-[3px] focus:ring-primary/25 appearance-none";

export type CloudMonthPickerProps = {
  label?: string;
  /** YYYY-MM */
  value?: string;
  onChange?: (monthString: string) => void;
  className?: string;
  style?: React.CSSProperties;
  allowClear?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * 月份选择：H5 用原生 month，桌面用 Arco MonthPicker
 */
export function CloudMonthPicker({
  label,
  value,
  onChange,
  className,
  style,
  allowClear = true,
  disabled,
  placeholder = "请选择月份",
}: CloudMonthPickerProps) {
  const isMobile = useIsMobile();

  return (
    <div className="w-full">
      {label && (
        <label className="text-sm text-charcoal font-medium mb-1.5 block">{label}</label>
      )}
      {isMobile ? (
        <input
          type="month"
          value={value || ""}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className={`${nativeFieldClass} ${className ?? ""}`}
          style={style}
        />
      ) : (
        <ArcoDatePicker.MonthPicker
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
          placeholder={placeholder}
          onChange={(monthString) => onChange?.(monthString || "")}
        />
      )}
    </div>
  );
}
