import { useState } from "react";
import { useNavigate } from "react-router";
import { CloudButton } from "./cloudsteps";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 继续训练文案，默认「继续训练」 */
  continueLabel?: string;
};

/**
 * 练习流通用暂停菜单：返回主页 / 继续训练 / 结束训练→抗遗忘
 */
export function PracticePauseMenu({
  open,
  onClose,
  continueLabel = "继续训练",
}: Props) {
  const navigate = useNavigate();
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50"
      onClick={() => {
        setConfirmEnd(false);
        onClose();
      }}
    >
      <div
        className="absolute top-20 right-4 bg-white rounded-xl shadow-lg overflow-hidden min-w-[9.5rem]"
        onClick={(e) => e.stopPropagation()}
      >
        {!confirmEnd ? (
          <>
            <CloudButton
              variant="ghost"
              className="w-full justify-start rounded-none px-6 py-3 h-auto"
              onClick={() => {
                onClose();
                navigate("/word-training");
              }}
            >
              返回主页
            </CloudButton>
            <CloudButton
              variant="ghost"
              className="w-full justify-start rounded-none px-6 py-3 h-auto"
              onClick={onClose}
            >
              {continueLabel}
            </CloudButton>
            <CloudButton
              variant="ghost"
              className="w-full justify-start rounded-none px-6 py-3 h-auto text-[#E53E3E]"
              onClick={() => setConfirmEnd(true)}
            >
              结束训练
            </CloudButton>
          </>
        ) : (
          <>
            <div className="px-4 py-3 text-sm text-[#718096] border-b border-[#E2E8F0]">
              确定结束训练并进入抗遗忘？
            </div>
            <CloudButton
              variant="ghost"
              className="w-full justify-start rounded-none px-6 py-3 h-auto"
              onClick={() => setConfirmEnd(false)}
            >
              取消
            </CloudButton>
            <CloudButton
              variant="ghost"
              className="w-full justify-start rounded-none px-6 py-3 h-auto text-[#E53E3E]"
              onClick={() => {
                onClose();
                navigate("/anti-forgetting");
              }}
            >
              确定
            </CloudButton>
          </>
        )}
      </div>
    </div>
  );
}
