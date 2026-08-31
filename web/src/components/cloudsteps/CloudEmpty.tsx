import { useTranslation } from "react-i18next";
import { EmptyState } from "../EmptyState";

/**
 * CloudEmpty - 统一空状态组件
 * 使用 iconfont 图标替代 ArcoDesign Empty
 */
export type CloudEmptyProps = {
  description?: string;
  className?: string;
};

export function CloudEmpty({ description, className }: CloudEmptyProps) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon="icon-zu"
      description={description ?? t("ui.empty")}
      className={className}
    />
  );
}
