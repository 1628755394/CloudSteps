import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowLeftRight,
  ArrowUpLeft,
  Circle,
  Eraser,
  Highlighter,
  Pencil,
  Plus,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

type Tool = "pen" | "eraser" | "highlighter" | "select" | "circle" | "rect" | "text";
type BrushMode = "fountain" | "pencil";
type DockSide = "left" | "right";

type Stroke = {
  tool: Tool;
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
  text?: string;
  brush?: BrushMode;
};

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#a855f7", "#111827", "#ffffff"];
const CUSTOM_COLORS_KEY = "lb_anno_custom_colors";
const LAST_COLOR_KEY = "lb_anno_last_color";
const DOCK_SIDE_KEY = "lb_anno_dock_side";
const PANEL_WIDTH_KEY = "lb_anno_panel_width";
const MAX_CUSTOM_COLORS = 8;
const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 480;

type AnnotationLayerProps = {
  storageKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function loadCustomColors(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_COLORS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is string => typeof c === "string").slice(0, MAX_CUSTOM_COLORS);
  } catch {
    return [];
  }
}

function loadLastColor(): string {
  try {
    const c = localStorage.getItem(LAST_COLOR_KEY);
    if (c && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(c)) return c;
  } catch {
    // ignore
  }
  return "#111827";
}

function loadDockSide(): DockSide {
  try {
    const s = localStorage.getItem(DOCK_SIDE_KEY);
    if (s === "left" || s === "right") return s;
  } catch {
    // ignore
  }
  return "right";
}

function loadPanelWidth(): number {
  try {
    const raw = localStorage.getItem(PANEL_WIDTH_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n)) return Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, n));
    }
  } catch {
    // ignore
  }
  return 260;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : h.slice(0, 6);
  if (full.length !== 6) return hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (s.tool === "text" && s.text && s.points[0]) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = s.color;
    ctx.font = `${Math.max(14, s.width * 4)}px sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(s.text, s.points[0].x, s.points[0].y);
    return;
  }

  if (s.tool === "circle" && s.points.length >= 2) {
    const a = s.points[0];
    const b = s.points[s.points.length - 1];
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.abs(b.x - a.x) / 2;
    const ry = Math.abs(b.y - a.y) / 2;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (s.tool === "rect" && s.points.length >= 2) {
    const a = s.points[0];
    const b = s.points[s.points.length - 1];
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeRect(
      Math.min(a.x, b.x),
      Math.min(a.y, b.y),
      Math.abs(b.x - a.x),
      Math.abs(b.y - a.y)
    );
    return;
  }

  if (s.points.length < 2) return;

  if (s.tool === "highlighter") {
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
  } else {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  ctx.lineWidth = s.width;
  if (s.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else if (s.tool === "highlighter") {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = s.color.length === 7 ? `${s.color}66` : s.color;
  } else if (s.tool === "pen" && s.brush === "pencil") {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = hexToRgba(s.color, 0.55);
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

/**
 * 批注层：可描画/擦除/图形/文字，关闭后保留，再次打开恢复
 */
export function AnnotationLayer({ storageKey, open, onOpenChange }: AnnotationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [brushMode, setBrushMode] = useState<BrushMode>("fountain");
  const [color, setColor] = useState(loadLastColor);
  const [customColors, setCustomColors] = useState<string[]>(loadCustomColors);
  const [width, setWidth] = useState(4);
  const [collapsed, setCollapsed] = useState(false);
  const [dockSide, setDockSide] = useState<DockSide>(loadDockSide);
  const [panelWidth, setPanelWidth] = useState(loadPanelWidth);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const drawingRef = useRef(false);
  const currentRef = useRef<Stroke | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const selectColor = useCallback((c: string) => {
    setColor(c);
    try {
      localStorage.setItem(LAST_COLOR_KEY, c);
    } catch {
      // ignore
    }
  }, []);

  const saveCustomColor = useCallback(() => {
    const normalized = color.toLowerCase();
    setCustomColors((prev) => {
      const next = [normalized, ...prev.filter((c) => c.toLowerCase() !== normalized)].slice(
        0,
        MAX_CUSTOM_COLORS
      );
      try {
        localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [color]);

  const toggleDockSide = useCallback(() => {
    setDockSide((prev) => {
      const next: DockSide = prev === "right" ? "left" : "right";
      try {
        localStorage.setItem(DOCK_SIDE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const startPanelResize = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = panelWidth;
      let latestW = startW;
      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX;
        const next = Math.max(
          MIN_PANEL_WIDTH,
          Math.min(MAX_PANEL_WIDTH, startW + (dockSide === "right" ? -delta : delta))
        );
        latestW = next;
        setPanelWidth(next);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        try {
          localStorage.setItem(PANEL_WIDTH_KEY, String(latestW));
        } catch {
          // ignore
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [panelWidth, dockSide]
  );

  const redraw = useCallback((list: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of list) {
      drawStroke(ctx, s);
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

    if (tool === "text") {
      const p = getPos(e);
      const text = window.prompt("输入批注文字");
      if (!text?.trim()) return;
      const stroke: Stroke = {
        tool: "text",
        color,
        width,
        points: [p],
        text: text.trim(),
      };
      setStrokes((prev) => [...prev, stroke]);
      setRedoStack([]);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = getPos(e);
    let strokeWidth = width;
    if (tool === "highlighter") {
      strokeWidth = Math.max(width * 3, 12);
    } else if (tool === "pen" && brushMode === "pencil") {
      strokeWidth = Math.max(1, width * 0.65);
    }
    currentRef.current = {
      tool,
      color,
      width: strokeWidth,
      points: [p],
      ...(tool === "pen" ? { brush: brushMode } : {}),
    };
    setRedoStack([]);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !currentRef.current) return;
    const p = getPos(e);
    const cur = currentRef.current;
    if (cur.tool === "circle" || cur.tool === "rect") {
      cur.points = [cur.points[0], p];
    } else {
      cur.points.push(p);
    }
    redraw([...strokes, cur]);
  };

  const onPointerUp = () => {
    if (!drawingRef.current || !currentRef.current) return;
    drawingRef.current = false;
    const done = currentRef.current;
    currentRef.current = null;
    const ok =
      done.tool === "circle" || done.tool === "rect"
        ? done.points.length >= 2
        : done.points.length > 1;
    if (ok) {
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

  // Click on blank area (outside the toolbar panel) deselects color -> switch to select tool.
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const panel = panelRef.current;
      if (panel && panel.contains(e.target as Node)) return;
      setTool("select");
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  if (!open) return null;

  const toolBtn = (
    id: Tool,
    Icon: typeof Pencil,
    tip: string
  ) => (
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
  );

  const brushChip = (
    id: BrushMode | "highlighter",
    label: string,
    active: boolean,
    onClick: () => void
  ) => (
    <button
      key={id}
      type="button"
      onClick={onClick}
      className={`flex-1 h-8 rounded-lg text-xs border ${
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-border text-charcoal hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );

  const isRight = dockSide === "right";
  const collapsedTranslate = isRight
    ? "translate-x-[calc(100%-1.25rem)]"
    : "-translate-x-[calc(100%-1.25rem)]";

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
        className={`fixed z-[80] top-16 transition-transform ${
          isRight ? "right-3" : "left-3"
        } ${collapsed ? collapsedTranslate : ""}`}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className={`absolute top-1/2 -translate-y-1/2 w-5 h-10 bg-card border border-border flex items-center justify-center text-muted-foreground ${
            isRight
              ? "-left-5 rounded-l-md border-r-0"
              : "-right-5 rounded-r-md border-l-0"
          }`}
          aria-label={collapsed ? "展开画笔工具" : "收起画笔工具"}
        >
          {isRight ? (
            collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />
          ) : collapsed ? (
            <ChevronRight size={14} />
          ) : (
            <ChevronLeft size={14} />
          )}
        </button>

        <div ref={panelRef} className="rounded-xl border border-border bg-card shadow-lg overflow-hidden" style={{ width: `${panelWidth}px` }}>
          {/* Width resize handle — inner edge (left if docked right, right if docked left) */}
          <div
            className={`${isRight ? "-left-1.5" : "-right-1.5"} absolute top-0 bottom-0 z-50 flex w-3 touch-none cursor-ew-resize items-center justify-center`}
            onPointerDown={startPanelResize}
            aria-label="拖动调整面板宽度"
            title="拖动调整宽度"
          >
            <span className="h-10 w-0.5 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-semibold text-foreground">画笔工具</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={toggleDockSide}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                aria-label={isRight ? "停靠到左侧" : "停靠到右侧"}
                title={isRight ? "停靠左侧" : "停靠右侧"}
              >
                <ArrowLeftRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                aria-label="关闭批注"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="p-3 space-y-3">
            <div className="grid grid-cols-5 gap-1.5">
              {toolBtn("select", ArrowUpLeft, "选择")}
              {toolBtn("pen", Pencil, "画笔")}
              {toolBtn("highlighter", Highlighter, "荧光笔")}
              {toolBtn("eraser", Eraser, "橡皮")}
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
              {toolBtn("circle", Circle, "圆形")}
              {toolBtn("rect", Square, "矩形")}
              {toolBtn("text", Type, "文字")}
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">笔刷</div>
              <div className="flex gap-1.5">
                {brushChip("fountain", "钢笔", tool === "pen" && brushMode === "fountain", () => {
                  setTool("pen");
                  setBrushMode("fountain");
                })}
                {brushChip("pencil", "铅笔", tool === "pen" && brushMode === "pencil", () => {
                  setTool("pen");
                  setBrushMode("pencil");
                })}
                {brushChip("highlighter", "荧光笔", tool === "highlighter", () => {
                  setTool("highlighter");
                })}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">颜色</div>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => selectColor(c)}
                    className={`w-6 h-6 rounded-full border-2 ${
                      color.toLowerCase() === c.toLowerCase() ? "border-primary scale-110" : "border-border"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
              {customColors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {customColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => selectColor(c)}
                      className={`w-6 h-6 rounded-full border-2 ${
                        color.toLowerCase() === c.toLowerCase()
                          ? "border-primary scale-110"
                          : "border-border"
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`自定义 ${c}`}
                    />
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={color.length === 7 ? color : "#111827"}
                  onChange={(e) => selectColor(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  title="自定义颜色"
                  aria-label="自定义颜色"
                />
                <button
                  type="button"
                  onClick={saveCustomColor}
                  className="h-8 px-2 rounded-lg border border-border text-xs text-charcoal hover:bg-muted inline-flex items-center gap-1"
                  title="保存当前颜色"
                >
                  <Plus size={12} />
                  保存
                </button>
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
