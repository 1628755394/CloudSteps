import * as React from "react";
import { Spin as ArcoSpin } from "@arco-design/web-react";

/**
 * CloudSpin - 基于 ArcoDesign Spin 的封装
 * 统一加载状态样式
 */
export type CloudSpinProps = {
  tip?: string;
  className?: string;
};

export function CloudSpin({ tip = "加载中…", className }: CloudSpinProps) {
  return (
    <div className={`flex justify-center items-center py-12 ${className ?? ""}`}>
      <ArcoSpin tip={tip} />
    </div>
  );
}
