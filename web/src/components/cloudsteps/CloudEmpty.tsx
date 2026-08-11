import * as React from "react";
import { Empty as ArcoEmpty } from "@arco-design/web-react";

/**
 * CloudEmpty - 基于 ArcoDesign Empty 的封装
 * 统一空状态样式
 */
export type CloudEmptyProps = {
  description?: string;
  className?: string;
};

export function CloudEmpty({ description = "暂无数据", className }: CloudEmptyProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className ?? ""}`}>
      <ArcoEmpty description={description} />
    </div>
  );
}
