import { useCallback, useEffect, useRef, useState } from "react";
import { getCaptcha, type CaptchaResponse, type CaptchaFields } from "../api/auth";

interface CaptchaWidgetProps {
  /** Called whenever the captcha challenge changes or is solved by the user. */
  onChange: (fields: CaptchaFields | null) => void;
  /** Optional className for the container. */
  className?: string;
}

/**
 * CaptchaWidget renders whatever captcha challenge the backend returns.
 * Supported types: image, math, click, jigsaw, rotate.
 * Slider is excluded server-side for mobile H5 convenience.
 */
export default function CaptchaWidget({ onChange, className }: CaptchaWidgetProps) {
  const [captcha, setCaptcha] = useState<CaptchaResponse | null>(null);
  const [value, setValue] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const jigsawDragRef = useRef<HTMLDivElement>(null);
  const dragStartXRef = useRef(0);
  const jigsawOffsetRef = useRef(0);

  const refresh = useCallback(async () => {
    setError(null);
    setValue(null);
    onChange(null);
    try {
      const res = await getCaptcha();
      if (res.code === 200 && res.data) {
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

  // ─── image captcha ───
  const renderImage = () => {
    const img = (captcha?.data?.image as string) || "";
    return (
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={value || ""}
          onChange={(e) => reportValue(e.target.value)}
          placeholder="输入图中字符"
          className="flex-1 h-[46px] px-4 rounded-xl bg-card border border-input text-charcoal outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={refresh}
          className="h-[46px] w-[120px] overflow-hidden flex items-center justify-center rounded-xl border border-input bg-card"
          aria-label="刷新验证码"
        >
          {img ? <img src={img} alt="captcha" className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">加载中...</span>}
        </button>
      </div>
    );
  };

  // ─── math captcha ───
  const renderMath = () => {
    const q = (captcha?.data?.question as string) || "";
    return (
      <div className="flex items-center gap-3">
        <span className="px-3 py-2 rounded-xl bg-muted text-sm font-mono whitespace-nowrap">{q}</span>
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => reportValue(Number(e.target.value))}
          placeholder="答案"
          className="flex-1 h-[46px] px-4 rounded-xl bg-card border border-input text-charcoal outline-none focus:border-primary"
        />
        <button type="button" onClick={refresh} className="text-xs text-muted-foreground hover:text-foreground">
          换一题
        </button>
      </div>
    );
  };

  // ─── click captcha ───
  const renderClick = () => {
    const data = captcha?.data;
    if (!data) return null;
    const width = (data.width as number) || 300;
    const height = (data.height as number) || 200;
    const chars = (data.chars as Array<{ char: string; x: number; y: number }>) || [];
    const targets = (data.targets as Array<{ char: string }>) || [];
    const img = (data.image as string) || "";
    const clicksRef = useRef<Array<{ x: number; y: number }>>([]);
    const [clicks, setClicks] = useState<Array<{ x: number; y: number }>>([]);

    const onCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);
      const next = [...clicksRef.current, { x, y }];
      clicksRef.current = next;
      setClicks(next);
      if (next.length >= targets.length) {
        reportValue(next);
      }
    };

    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          请按顺序点击: <span className="font-mono font-medium text-foreground">{targets.map((t) => t.char).join(" ")}</span>
        </div>
        <div
          onClick={onCanvasClick}
          className="relative cursor-pointer rounded-xl overflow-hidden border border-input select-none"
          style={{ width, height }}
        >
          {img ? <img src={img} alt="click-captcha" className="w-full h-full" /> : <div className="w-full h-full bg-muted" />}
          {clicks.map((c, i) => (
            <div
              key={i}
              className="absolute w-6 h-6 rounded-full bg-primary/80 text-white text-xs flex items-center justify-center pointer-events-none -translate-x-1/2 -translate-y-1/2"
              style={{ left: c.x, top: c.y }}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <button type="button" onClick={refresh} className="text-xs text-muted-foreground hover:text-foreground">
          换一张
        </button>
      </div>
    );
  };

  // ─── jigsaw captcha ───
  const renderJigsaw = () => {
    const data = captcha?.data;
    if (!data) return null;
    const width = (data.width as number) || 300;
    const height = (data.height as number) || 150;
    const bg = (data.background as string) || "";
    const piece = (data.piece as string) || "";
    const pieceSize = (data.pieceSize as number) || 40;
    const [offset, setOffset] = useState(0);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      dragStartXRef.current = e.clientX - offset;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.buttons !== 1) return;
      const raw = e.clientX - dragStartXRef.current;
      const clamped = Math.max(0, Math.min(raw, width - pieceSize));
      setOffset(clamped);
    };
    const onPointerUp = () => {
      jigsawOffsetRef.current = offset;
      reportValue(offset);
    };

    return (
      <div className="space-y-2">
        <div className="relative rounded-xl overflow-hidden border border-input" style={{ width, height }}>
          {bg ? <img src={bg} alt="jigsaw-bg" className="w-full h-full" /> : <div className="w-full h-full bg-muted" />}
          <div
            ref={jigsawDragRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="absolute top-0 cursor-grab active:cursor-grabbing touch-none"
            style={{ left: offset, width: pieceSize, height }}
          >
            {piece ? <img src={piece} alt="jigsaw-piece" className="w-full h-full" draggable={false} /> : null}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">拖动拼图块到缺口位置</div>
        <button type="button" onClick={refresh} className="text-xs text-muted-foreground hover:text-foreground">
          换一张
        </button>
      </div>
    );
  };

  // ─── rotate captcha ───
  const renderRotate = () => {
    const data = captcha?.data;
    if (!data) return null;
    const img = (data.image as string) || "";
    const [angle, setAngle] = useState(0);

    return (
      <div className="space-y-2">
        <div className="flex justify-center">
          {img ? (
            <img
              src={img}
              alt="rotate-captcha"
              className="rounded-xl border border-input"
              style={{ transform: `rotate(${angle}deg)`, transition: "transform 0.1s" }}
            />
          ) : (
            <div className="w-32 h-32 bg-muted rounded-xl" />
          )}
        </div>
        <input
          type="range"
          min={0}
          max={360}
          value={angle}
          onChange={(e) => {
            const a = Number(e.target.value);
            setAngle(a);
            reportValue(a);
          }}
          className="w-full"
        />
        <div className="text-xs text-muted-foreground text-center">拖动滑块旋转图片到正确方向 ({angle}°)</div>
        <button type="button" onClick={refresh} className="text-xs text-muted-foreground hover:text-foreground">
          换一张
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
      {captcha.type === "click" && renderClick()}
      {captcha.type === "jigsaw" && renderJigsaw()}
      {captcha.type === "rotate" && renderRotate()}
    </div>
  );
}
