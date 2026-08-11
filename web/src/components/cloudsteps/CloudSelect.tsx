import * as React from "react";
import { Select as ArcoSelect } from "@arco-design/web-react";
import { useIsMobile } from "../ui/use-mobile";
import { MobileSelectSheet, type MobileSelectOption } from "./MobileWheelPicker";

type OptionLike =
  | string
  | number
  | {
      value?: string | number;
      label?: React.ReactNode;
      disabled?: boolean;
      children?: React.ReactNode;
    };

export type CloudSelectProps = React.ComponentProps<typeof ArcoSelect> & {
  label?: string;
  /** H5 弹层标题，默认用 label 或「请选择」 */
  sheetTitle?: string;
};

function normalizeOptions(options: OptionLike[] | undefined): MobileSelectOption[] {
  if (!Array.isArray(options)) return [];
  return options.map((o) => {
    if (typeof o === "string" || typeof o === "number") {
      return { value: String(o), label: String(o) };
    }
    const value = o.value != null ? String(o.value) : "";
    const labelNode = o.label ?? o.children ?? value;
    const label =
      typeof labelNode === "string" || typeof labelNode === "number"
        ? String(labelNode)
        : value;
    return { value, label, disabled: o.disabled };
  });
}

/**
 * 选择器：H5 底部弹层（取消/确认），桌面用 Arco Select
 */
export function CloudSelect({
  label,
  sheetTitle,
  className,
  style,
  options,
  value,
  onChange,
  placeholder = "请选择",
  disabled,
  showSearch,
  allowClear,
  ...props
}: CloudSelectProps) {
  const isMobile = useIsMobile();
  const mobileOptions = React.useMemo(
    () => normalizeOptions(options as OptionLike[] | undefined),
    [options]
  );

  if (isMobile) {
    const strValue =
      value === undefined || value === null || value === ""
        ? undefined
        : String(Array.isArray(value) ? value[0] : value);
    const placeholderText =
      typeof placeholder === "string"
        ? placeholder
        : Array.isArray(placeholder)
          ? String(placeholder[0] ?? "请选择")
          : "请选择";
    const classNameText = Array.isArray(className)
      ? className.filter(Boolean).join(" ")
      : className;

    return (
      <MobileSelectSheet
        label={label}
        title={sheetTitle || label || "请选择"}
        value={strValue}
        options={mobileOptions}
        placeholder={placeholderText}
        disabled={disabled}
        showSearch={Boolean(showSearch)}
        className={classNameText}
        onChange={(v) => {
          (onChange as ((value: string) => void) | undefined)?.(v);
        }}
      />
    );
  }

  return (
    <div className="w-full">
      {label && (
        <label className="text-sm text-charcoal font-medium mb-1.5 block">{label}</label>
      )}
      <ArcoSelect
        className={`cloud-select ${className ?? ""}`}
        style={{
          borderRadius: 12,
          height: 40,
          width: "100%",
          ...style,
        }}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        showSearch={showSearch}
        allowClear={allowClear}
        {...props}
      />
    </div>
  );
}
