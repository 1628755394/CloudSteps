import * as React from "react";
import { useTranslation } from "react-i18next";
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

function heightForSize(size: CloudSelectProps["size"]): number {
  switch (size) {
    case "mini":
      return 28;
    case "small":
      return 32;
    case "large":
      return 40;
    default:
      return 40;
  }
}

/**
 * 选择器：H5 底部弹层（取消/确认），桌面用 Arco Select
 */
export function CloudSelect({
  label,
  sheetTitle,
  className,
  style,
  size,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  showSearch,
  allowClear,
  ...props
}: CloudSelectProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const pleaseSelect = t("ui.please_select");
  const resolvedPlaceholder = placeholder ?? pleaseSelect;
  const mobileOptions = React.useMemo(
    () => normalizeOptions(options as OptionLike[] | undefined),
    [options]
  );
  const height = heightForSize(size);
  const radius = size === "mini" || size === "small" ? 8 : 12;
  const classNameText = Array.isArray(className)
    ? className.filter(Boolean).join(" ")
    : className;

  if (isMobile) {
    const strValue =
      value === undefined || value === null || value === ""
        ? undefined
        : String(Array.isArray(value) ? value[0] : value);
    const placeholderText =
      typeof resolvedPlaceholder === "string"
        ? resolvedPlaceholder
        : Array.isArray(resolvedPlaceholder)
          ? String(resolvedPlaceholder[0] ?? pleaseSelect)
          : pleaseSelect;

    return (
      <MobileSelectSheet
        label={label}
        title={sheetTitle || label || pleaseSelect}
        value={strValue}
        options={mobileOptions}
        placeholder={placeholderText}
        disabled={disabled}
        showSearch={Boolean(showSearch)}
        size={size === "mini" || size === "small" ? "small" : "default"}
        className={classNameText}
        style={style}
        onChange={(v) => {
          (onChange as ((value: string) => void) | undefined)?.(v);
        }}
      />
    );
  }

  return (
    <div className={classNameText || "w-full"} style={style}>
      {label && (
        <label className="text-sm text-charcoal font-medium mb-1.5 block">{label}</label>
      )}
      <ArcoSelect
        className="cloud-select"
        size={size}
        style={{
          borderRadius: radius,
          height,
          width: "100%",
        }}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        showSearch={showSearch}
        allowClear={allowClear}
        {...props}
        dropdownMenuStyle={{
          maxHeight: 360,
          overflowY: "auto",
          ...(typeof props.dropdownMenuStyle === "object" ? props.dropdownMenuStyle : null),
        }}
        triggerProps={{
          autoFitPosition: true,
          ...props.triggerProps,
        }}
        virtualListProps={{
          height: 320,
          ...props.virtualListProps,
        }}
      />
    </div>
  );
}
