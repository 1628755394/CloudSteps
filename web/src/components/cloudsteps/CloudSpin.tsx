import * as React from "react";
import { useTranslation } from "react-i18next";
import { Spin as ArcoSpin } from "@arco-design/web-react";

/**
 * CloudSpin - 基于 ArcoDesign Spin 的封装
 * 统一加载状态样式
 */
export type CloudSpinProps = {
  tip?: string;
  className?: string;
};

export function CloudSpin({ tip, className }: CloudSpinProps) {
  const { t } = useTranslation();
  return (
    <div className={`flex justify-center items-center py-12 ${className ?? ""}`}>
      <ArcoSpin tip={tip ?? t("common.loading")} />
    </div>
  );
}
