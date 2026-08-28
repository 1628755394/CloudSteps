import { useCallback, useEffect, useState } from "react";
import { getCaptcha, type CaptchaResponse, type CaptchaFields } from "../api/auth";

interface CaptchaWidgetProps {
  /** Called whenever the captcha challenge changes or is solved by the user. */
  onChange: (fields: CaptchaFields | null) => void;
  /** Optional className for the container. */
  className?: string;
}

const SKIPPED_CAPTCHA_TYPES = new Set(["click", "jigsaw", "rotate", "slider"]);

const inputClass =
  "flex-1 min-w-0 h-[46px] px-4 rounded-xl bg-card border border-input text-charcoal outline-none focus:border-primary";

/**
 * CaptchaWidget renders login captcha challenges (image + math only).
 */
export default function CaptchaWidget({ onChange, className }: CaptchaWidgetProps) {
  const [captcha, setCaptcha] = useState<CaptchaResponse | null>(null);
  const [value, setValue] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setValue(null);
    onChange(null);
    try {
      const res = await getCaptcha();
      if (res.code === 200 && res.data) {
        if (SKIPPED_CAPTCHA_TYPES.has(res.data.type)) {
          refresh();
          return;
        }
        setCaptcha(res.data);
      } else {
        setError(res.msg || "获取验证码失败");
      }
    } catch {
      setError("获取验证码失败");
    }
  }, [onChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const reportValue = useCallback(
    (v: any) => {
      setValue(v);
      if (captcha && v != null && v !== "") {
        onChange({ captchaId: captcha.id, captchaType: captcha.type, captchaValue: v });
      } else {
        onChange(null);
      }
    },
    [captcha, onChange],
  );

  const renderImage = () => {
    const img = (captcha?.data?.image as string) || "";
    return (
      <div className="w-full min-w-0">
        <div className="flex items-center gap-2 w-full min-w-0">
          <input
            type="text"
            value={value || ""}
            onChange={(e) => reportValue(e.target.value)}
            placeholder="输入图中字符"
            className={inputClass}
          />
          <button
            type="button"
            onClick={refresh}
            className="h-[46px] shrink-0 rounded-xl border border-input bg-card overflow-hidden leading-none"
            aria-label="刷新验证码"
          >
            {img ? (
              <img
                src={img}
                alt="captcha"
                className="h-full w-auto max-h-[46px] block select-none"
                draggable={false}
              />
            ) : (
              <span className="inline-flex h-full items-center px-3 text-xs text-muted-foreground">
                加载中
              </span>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderMath = () => {
    const q = (captcha?.data?.question as string) || "";
    return (
      <div className="flex items-center gap-2 w-full min-w-0">
        <span className="shrink-0 px-3 py-2 rounded-xl bg-muted text-sm font-mono">
          {q}
        </span>
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => reportValue(Number(e.target.value))}
          placeholder="答案"
          className={inputClass}
        />
        <button
          type="button"
          onClick={refresh}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground px-1"
        >
          换一题
        </button>
      </div>
    );
  };

  if (error) {
    return (
      <div className={className}>
        <div className="text-sm text-destructive">{error}</div>
        <button type="button" onClick={refresh} className="text-xs text-primary mt-1">
          重试
        </button>
      </div>
    );
  }

  if (!captcha) {
    return (
      <div className={className}>
        <span className="text-xs text-muted-foreground">加载中...</span>
      </div>
    );
  }

  return (
    <div className={className}>
      {captcha.type === "image" && renderImage()}
      {captcha.type === "math" && renderMath()}
    </div>
  );
}
