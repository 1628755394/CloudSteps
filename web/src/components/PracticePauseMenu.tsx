import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { CloudButton } from "./cloudsteps";
import { getReviewReturnPath } from "../utils/reviewPractice";
import { useClassTimerStore } from "../stores/classTimerStore";
import { settleAndStop } from "./ClassSessionTimer";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 继续训练文案，默认「继续训练」 */
  continueLabel?: string;
};

/**
 * 练习流通用暂停菜单：返回主页 / 继续训练 / 结束训练
 * 复习模式下回跳到进入复习前的页面（词训 → word-training；抗遗忘 → anti-forgetting）
 */
export function PracticePauseMenu({
  open,
  onClose,
  continueLabel,
}: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const resolvedContinueLabel = continueLabel ?? t("coaching.practice_continue");

  useEffect(() => {
    if (!open) setConfirmEnd(false);
  }, [open]);

  if (!open) return null;

  const isReview = sessionStorage.getItem("lb_mode") === "review";
  const homePath = isReview
    ? getReviewReturnPath("/word-training")
    : "/word-training";
  const endConfirmText = isReview
    ? homePath.includes("anti-forgetting")
      ? t("coaching.practice_end_review_af")
      : t("coaching.practice_end_review_wt")
    : t("coaching.practice_end_confirm");
  const endPath = isReview ? homePath : "/create-anti-forgetting";

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50"
      onClick={() => {
        setConfirmEnd(false);
        useClassTimerStore.getState().resume();
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
                useClassTimerStore.getState().resume();
                onClose();
                navigate(homePath);
              }}
            >
              {t("coaching.practice_back_home")}
            </CloudButton>
            <CloudButton
              variant="ghost"
              className="w-full justify-start rounded-none px-6 py-3 h-auto"
              onClick={() => {
                useClassTimerStore.getState().resume();
                onClose();
              }}
            >
              {resolvedContinueLabel}
            </CloudButton>
            <CloudButton
              variant="ghost"
              className="w-full justify-start rounded-none px-6 py-3 h-auto text-[#E53E3E]"
              onClick={() => setConfirmEnd(true)}
            >
              {t("coaching.practice_end")}
            </CloudButton>
          </>
        ) : (
          <>
            <div className="px-4 py-3 text-sm text-[#718096] border-b border-[#E2E8F0]">
              {endConfirmText}
            </div>
            <CloudButton
              variant="ghost"
              className="w-full justify-start rounded-none px-6 py-3 h-auto"
              onClick={() => setConfirmEnd(false)}
            >
              {t("ui.cancel")}
            </CloudButton>
            <CloudButton
              variant="ghost"
              className="w-full justify-start rounded-none px-6 py-3 h-auto text-[#E53E3E]"
              onClick={() => {
                void (async () => {
                  await settleAndStop();
                  onClose();
                  if (isReview) {
                    const path = homePath;
                    sessionStorage.removeItem("lb_review_return");
                    if (sessionStorage.getItem("lb_mode") === "review") {
                      sessionStorage.removeItem("lb_mode");
                    }
                    navigate(path, { replace: true });
                    return;
                  }
                  navigate(endPath, { replace: true });
                })();
              }}
            >
              {t("ui.ok")}
            </CloudButton>
          </>
        )}
      </div>
    </div>
  );
}
