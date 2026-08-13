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
    <div className="bg-white sticky top-0 z-10 shadow-sm">
      <div className="grid grid-cols-[2.5rem_1fr_auto] items-center h-11 px-3 gap-1">
        <CloudButton
          variant="ghost"
          size="iconRound"
          onClick={onBack}
          className="-ml-1 justify-self-start"
          aria-label="返回"
        >
          <ArrowLeft size={18} className="text-[#2D3748]" />
        </CloudButton>
        <FlowPageTitle>{title}</FlowPageTitle>
        <div className="flex items-center justify-end min-w-[2.5rem]">{rightSlot}</div>
      </div>
    </div>
  );
}
