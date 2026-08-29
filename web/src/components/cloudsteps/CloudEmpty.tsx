import { EmptyState } from "../EmptyState";

/**
 * CloudEmpty - 统一空状态组件
 * 使用 iconfont 图标替代 ArcoDesign Empty
 */
export type CloudEmptyProps = {
  description?: string;
  className?: string;
};

export function CloudEmpty({ description = "暂无数据", className }: CloudEmptyProps) {
  return <EmptyState icon="icon-zu" description={description} className={className} />;
}
