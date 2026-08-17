import { ArrowLeft } from "lucide-react";

import { CloudButton } from "./cloudsteps";
import { FlowPageTitle } from "./PageTitle";

import type { ReactNode } from "react";

type Props = {
  title: string;
  onBack: () => void;
  rightSlot?: ReactNode;
};

export function TopBar({ title, onBack, rightSlot }: Props) {
  return (
    <div className="bg-white sticky top-0 z-30 shadow-sm">
      <div className="relative flex items-center h-11 px-3">
        <div className="relative z-10 flex items-center shrink-0">
          <CloudButton
            variant="ghost"
            size="iconRound"
            onClick={onBack}
            className="-ml-1"
            aria-label="返回"
          >
            <ArrowLeft size={18} className="text-[#2D3748]" />
          </CloudButton>
        </div>

        {/* 相对整条顶栏绝对居中，不受左右槽宽度影响 */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-14">
          <FlowPageTitle className="max-w-full truncate">{title}</FlowPageTitle>
        </div>

        <div className="relative z-10 ml-auto flex items-center justify-end min-w-[2.5rem] shrink-0">
          {rightSlot}
        </div>
      </div>
    </div>
  );
}
