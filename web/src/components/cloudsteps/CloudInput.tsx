import * as React from "react";
import { useTranslation } from "react-i18next";
import { Input as ArcoInput } from "@arco-design/web-react";

/**
 * CloudInput - Warm Mint 输入框
 */
export type CloudInputProps = React.ComponentProps<typeof ArcoInput> & {
  label?: string;
};

export function CloudInput({ label, className, style, ...props }: CloudInputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="text-sm text-charcoal font-medium mb-1.5 block">{label}</label>
      )}
      <ArcoInput
        className={`cloud-input ${className ?? ""}`}
        style={{
          borderRadius: 12,
          height: 40,
          ...style,
        }}
        {...props}
      />
    </div>
  );
}

/**
 * CloudInputSearch - 搜索输入框
 */
export function CloudInputSearch(props: CloudInputProps) {
  const { t } = useTranslation();
  return (
    <div className="w-full">
      {props.label && (
        <label className="text-sm text-charcoal font-medium mb-1.5 block">{props.label}</label>
      )}
      <ArcoInput.Search
        className="cloud-input"
        style={{
          borderRadius: 12,
          ...props.style,
        }}
        searchButton={
          <span
            style={{
              borderRadius: 12,
              background: "var(--primary)",
              borderColor: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            {t("ui.search")}
          </span>
        }
        {...props}
      />
    </div>
  );
}
