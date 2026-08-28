import { useState, type ReactNode } from "react";
import { AnnotationToggleButton } from "./AnnotationLayer";
import { AudioMuteToggleButton } from "./AudioMuteToggleButton";
import { ClassTimerBadge, ClassTimerSetupDialog } from "./ClassSessionTimer";
import { PracticeFontSettingsButton } from "./PracticeFontSettings";
import { PracticePauseMenu } from "./PracticePauseMenu";
import { WordEditHost } from "./WordEditControls";
import { useClassTimerStore } from "../stores/classTimerStore";
import type { UserWordView } from "../api/wordbooks";

type Props = {
  annotationOpen: boolean;
  onToggleAnnotation: () => void;
  extraBefore?: ReactNode;
  pauseContinueLabel?: string;
  wordCount?: number;
  onWordPatched?: (view: UserWordView) => void;
};

/**
 * 练习流通用顶栏操作：音效、定时、画笔、设置。
 * 计时未开始时点时钟打开设置；计时中点击倒计时暂停，并出现返回/继续/结束。
 */
export function PracticeFlowToolbar({
  annotationOpen,
  onToggleAnnotation,
  extraBefore,
  pauseContinueLabel,
  wordCount = 0,
  onWordPatched,
}: Props) {
  const [timerOpen, setTimerOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const pauseTimer = useClassTimerStore((s) => s.pause);

  return (
    <>
      <div className="flex items-center justify-end gap-0.5">
        {extraBefore}
        <AudioMuteToggleButton />
        <ClassTimerBadge
          onClick={() => {
            const { endsAt, pausedRemainingMs } = useClassTimerStore.getState();
            if (endsAt != null || pausedRemainingMs != null) {
              pauseTimer();
              setPauseOpen(true);
              return;
            }
            setTimerOpen(true);
          }}
        />
        <AnnotationToggleButton
          active={annotationOpen}
          onClick={onToggleAnnotation}
        />
        <PracticeFontSettingsButton />
      </div>
      <ClassTimerSetupDialog
        open={timerOpen}
        onOpenChange={setTimerOpen}
        wordCount={wordCount}
      />
      <PracticePauseMenu
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        continueLabel={pauseContinueLabel}
      />
      <WordEditHost onSaved={onWordPatched} />
    </>
  );
}
