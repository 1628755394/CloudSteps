import { useState, type ReactNode } from "react";
import { Pause } from "lucide-react";
import { AnnotationToggleButton } from "./AnnotationLayer";
import { AudioMuteToggleButton } from "./AudioMuteToggleButton";
import { ClassTimerBadge, ClassTimerSetupDialog } from "./ClassSessionTimer";
import { PracticeFontSettingsButton } from "./PracticeFontSettings";
import { PracticePauseMenu } from "./PracticePauseMenu";
import { CloudButton } from "./cloudsteps";

type Props = {
  annotationOpen: boolean;
  onToggleAnnotation: () => void;
  /** 插在定时按钮前，例如训前检测的正序/乱序标记 */
  extraBefore?: ReactNode;
  pauseContinueLabel?: string;
  wordCount?: number;
};

/**
 * 练习流通用顶栏操作：音效、定时、画笔、设置、暂停。
 * 训前/练习/听音/快闪/训后等页面共用。
 */
export function PracticeFlowToolbar({
  annotationOpen,
  onToggleAnnotation,
  extraBefore,
  pauseContinueLabel,
  wordCount = 0,
}: Props) {
  const [timerOpen, setTimerOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-end gap-0.5">
        {extraBefore}
        <AudioMuteToggleButton />
        <ClassTimerBadge onClick={() => setTimerOpen(true)} />
        <AnnotationToggleButton
          active={annotationOpen}
          onClick={onToggleAnnotation}
        />
        <PracticeFontSettingsButton />
        <CloudButton
          type="button"
          variant="ghost"
          size="iconRound"
          onClick={() => setPauseOpen(true)}
          aria-label="暂停"
        >
          <Pause size={18} className="text-[#2D3748]" />
        </CloudButton>
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
    </>
  );
}
