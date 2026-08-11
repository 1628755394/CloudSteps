import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowUpLeft,
  Circle,
  Eraser,
  Highlighter,
  Pencil,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

type Tool = "pen" | "eraser" | "highlighter" | "select";

type Stroke = {
  tool: Tool;
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
};

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#a855f7", "#111827", "#ffffff"];

type AnnotationLayerProps = {
  storageKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * 批注层：可描画/擦除，关闭后保留，再次打开恢复
 */
export function AnnotationLayer({ storageKey, open, onOpenChange }: AnnotationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#111827");
  const [width, setWidth] = useState(4);
  const [collapsed, setCollapsed] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const drawingRef = useRef(false);
  const currentRef = useRef<Stroke | null>(null);

  const redraw = useCallback((list: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of list) {
      if (s.points.length < 2) continue;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = s.width;
      if (s.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else if (s.tool === "highlighter") {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = s.color.length === 7 ? `${s.color}66` : s.color;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = s.color;
      }
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw(strokes);
  }, [redraw, strokes]);

  // 从 sessionStorage 恢复
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`anno:${storageKey}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Stroke[];
        if (Array.isArray(parsed)) setStrokes(parsed);
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  // 持久化
  useEffect(() => {
    try {
      sessionStorage.setItem(`anno:${storageKey}`, JSON.stringify(strokes));
    } catch {
      // ignore
    }
  }, [storageKey, strokes]);

  useEffect(() => {
    if (!open) return;
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, resizeCanvas]);

  useEffect(() => {
    if (open) redraw(strokes);
  }, [open, strokes, redraw]);

  const getPos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (tool === "select") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = getPos(e);
    currentRef.current = {
      tool,
      color,
      width: tool === "highlighter" ? Math.max(width * 3, 12) : width,
      points: [p],
    };
    setRedoStack([]);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !currentRef.current) return;
    const p = getPos(e);
    currentRef.current.points.push(p);
    redraw([...strokes, currentRef.current]);
  };

  const onPointerUp = () => {
    if (!drawingRef.current || !currentRef.current) return;
    drawingRef.current = false;
    const done = currentRef.current;
    currentRef.current = null;
    if (done.points.length > 1) {
      setStrokes((prev) => [...prev, done]);
    }
  };

  const undo = () => {
    setStrokes((prev) => {
      if (!prev.length) return prev;
      const next = prev.slice(0, -1);
      const removed = prev[prev.length - 1];
      setRedoStack((r) => [...r, removed]);
      return next;
    });
  };

  const redo = () => {
    setRedoStack((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      setStrokes((s) => [...s, last]);
      return prev.slice(0, -1);
    });
  };

  const clearAll = () => {
    setStrokes([]);
    setRedoStack([]);
  };

  if (!open) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`fixed inset-0 z-[70] ${
          tool === "select" ? "pointer-events-none" : "pointer-events-auto touch-none cursor-crosshair"
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      <div
        className={`fixed z-[80] top-16 right-3 transition-transform ${
          collapsed ? "translate-x-[calc(100%-1.25rem)]" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -left-5 top-1/2 -translate-y-1/2 w-5 h-10 rounded-l-md bg-card border border-border border-r-0 flex items-center justify-center text-muted-foreground"
          aria-label={collapsed ? "展开画笔工具" : "收起画笔工具"}
        >
          {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        <div className="w-[260px] rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-semibold text-foreground">画笔工具</span>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground"
              aria-label="关闭批注"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-3 space-y-3">
            <div className="grid grid-cols-5 gap-1.5">
              {(
                [
                  { id: "select" as const, Icon: ArrowUpLeft, tip: "选择" },
                  { id: "pen" as const, Icon: Pencil, tip: "画笔" },
                  { id: "highlighter" as const, Icon: Highlighter, tip: "荧光笔" },
                  { id: "eraser" as const, Icon: Eraser, tip: "橡皮" },
                ] as const
              ).map(({ id, Icon, tip }) => (
                <button
                  key={id}
                  type="button"
                  title={tip}
                  onClick={() => setTool(id)}
                  className={`h-9 rounded-lg flex items-center justify-center border ${
                    tool === id
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border text-charcoal hover:bg-muted"
                  }`}
                >
                  <Icon size={16} />
                </button>
              ))}
              <button
                type="button"
                title="撤销"
                onClick={undo}
                className="h-9 rounded-lg flex items-center justify-center border border-border text-charcoal hover:bg-muted"
              >
                <Undo2 size={16} />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              <button
                type="button"
                title="重做"
                onClick={redo}
                className="h-9 rounded-lg flex items-center justify-center border border-border text-charcoal hover:bg-muted"
              >
                <Redo2 size={16} />
              </button>
              <button
                type="button"
                title="清空"
                onClick={clearAll}
                className="h-9 rounded-lg flex items-center justify-center border border-border text-destructive hover:bg-destructive/5"
              >
                <Trash2 size={16} />
              </button>
              <span className="h-9 rounded-lg flex items-center justify-center border border-dashed border-border text-muted-soft opacity-50">
                <Circle size={14} />
              </span>
              <span className="h-9 rounded-lg flex items-center justify-center border border-dashed border-border text-muted-soft opacity-50">
                <Square size={14} />
              </span>
              <span className="h-9 rounded-lg flex items-center justify-center border border-dashed border-border text-muted-soft opacity-50">
                <Type size={14} />
              </span>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">颜色</div>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full border-2 ${
                      color === c ? "border-primary scale-110" : "border-border"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">粗细 {width}px</div>
              <input
                type="range"
                min={1}
                max={24}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function AnnotationToggleButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${
        active ? "bg-primary-soft text-primary" : "text-charcoal hover:bg-muted"
      }`}
      aria-label="批注"
      title="批注"
    >
      <Pencil size={18} />
    </button>
  );
}
