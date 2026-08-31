import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Volume2, VolumeX } from "lucide-react";
import { CloudButton } from "./cloudsteps";
import {
  isAudioMuted,
  setAudioMuted,
  subscribeAudioMuted,
} from "../utils/audioPlayer";
import { showToast } from "../utils/toast";

/** 顶栏音效开关：静音 / 允许播放 */
export function AudioMuteToggleButton({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const [muted, setMuted] = useState(() => isAudioMuted());

  useEffect(() => subscribeAudioMuted(setMuted), []);

  return (
    <CloudButton
      type="button"
      variant="ghost"
      size="iconRound"
      className={className}
      aria-label={muted ? t("coaching.audio_unmute") : t("coaching.audio_mute")}
      title={muted ? t("coaching.audio_off_title") : t("coaching.audio_on_title")}
      onClick={() => {
        const next = !muted;
        setAudioMuted(next);
        setMuted(next);
        showToast.info(next ? t("coaching.audio_muted_toast") : t("coaching.audio_unmuted_toast"));
      }}
    >
      {muted ? (
        <VolumeX size={18} className="text-[#A0AEC0]" />
      ) : (
        <Volume2 size={18} className="text-[#2D3748]" />
      )}
    </CloudButton>
  );
}
