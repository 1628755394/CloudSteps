import { useEffect, useState } from "react";
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
  const [muted, setMuted] = useState(() => isAudioMuted());

  useEffect(() => subscribeAudioMuted(setMuted), []);

  return (
    <CloudButton
      type="button"
      variant="ghost"
      size="iconRound"
      className={className}
      aria-label={muted ? "开启音效" : "静音"}
      title={muted ? "音效已关，点击开启" : "音效已开，点击静音"}
      onClick={() => {
        const next = !muted;
        setAudioMuted(next);
        setMuted(next);
        showToast.info(next ? "已静音" : "已开启音效");
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
