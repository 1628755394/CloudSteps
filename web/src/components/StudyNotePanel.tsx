import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Trash2,
  Italic,
  PaintBucket,
  Palette,
  Pencil,
  PanelLeft,
  Type,
  Underline,
  X,
} from "lucide-react";
import { Canvas, PencilBrush, Point, Textbox } from "fabric";

type PanelTool = "select" | "pen" | "eraser";
type BrushStyle = "fountain" | "pencil";

const PEN_COLORS = ["#25344a", "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#a855f7", "#111827", "#ffffff"];
import { CloudButton } from "./cloudsteps";

type NoteData = { json?: string; text: string; color: string; background: string };
type Props = { open: boolean; onClose: () => void; storageKey: string; title?: string; subtitle?: string; side?: "left" | "right"; split?: boolean; onSideChange?: (side: "left" | "right") => void };
const emptyNote: NoteData = { text: "", color: "#25344a", background: "#fff8e8" };
const initialPanelWidth = typeof window === "undefined" ? 420 : Math.min(640, Math.max(320, Math.round(window.innerWidth * 0.4)));

function loadNote(key: string): NoteData {
  try { return { ...emptyNote, ...JSON.parse(localStorage.getItem(key) || "{}") }; } catch { return emptyNote; }
}
export function readStudyNote(key: string) { return loadNote(key).text; }

export function StudyNotePanel({ open, onClose, storageKey, title = "随心记", subtitle = "", side = "right", split = false, onSideChange }: Props) {
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<NoteData>(() => loadNote(storageKey));
  const sidePos = side;
  const [width, setWidth] = useState(initialPanelWidth);
  const [fontSize, setFontSize] = useState(28);
  const [color, setColor] = useState("#25344a");
  const [fill, setFill] = useState("#fff8e8");
  const [tool, setTool] = useState<PanelTool>("select");
  const [brushWidth, setBrushWidth] = useState(4);
  const [brushStyle, setBrushStyle] = useState<BrushStyle>("fountain");
  const [penPopupOpen, setPenPopupOpen] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);

  const persist = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    const text = objects.filter((o) => o.type === "textbox").map((o) => String((o as Textbox).text || "")).join("\n");
    const next = { ...note, json: JSON.stringify(canvas.toJSON()), text, color, background: fill };
    setNote(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  // ---- Canvas init / destroy ----
  useEffect(() => {
    if (!open || !canvasElement.current) return;
    const stored = loadNote(storageKey);
    const saved = stored.background === "#175b37" ? { ...stored, background: "#fff8e8" } : stored;
    setNote(saved);
    setColor(saved.color);
    setFill(saved.background);

    // Create Fabric canvas with a tiny initial size; the real size is set by syncSize().
    const canvas = new Canvas(canvasElement.current, {
      width: 10,
      height: 10,
      preserveObjectStacking: true,
      selection: true,
    });
    canvas.backgroundColor = saved.background;
    canvasRef.current = canvas;

    // Force the Fabric wrapper + both canvas layers to fill the host container.
    // Fabric sets inline pixel styles on the layers; we override them after every render.
    const wrapper = canvas.wrapperEl;
    const applyFillStyle = () => {
      wrapper.style.position = "absolute";
      wrapper.style.inset = "0";
      wrapper.style.width = "100%";
      wrapper.style.height = "100%";
      wrapper.style.overflow = "hidden";
      const layers = wrapper.querySelectorAll("canvas");
      layers.forEach((layer) => {
        layer.style.width = "100%";
        layer.style.height = "100%";
        layer.style.display = "block";
      });
    };
    applyFillStyle();

    // Sync the drawing buffer to the host's pixel size so coordinates match.
    const host = hostRef.current;
    const syncSize = () => {
      if (!host) return;
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      canvas.setDimensions({ width: w, height: h });
      applyFillStyle();
      canvas.calcOffset();
      canvas.requestRenderAll();
    };
    const ro = new ResizeObserver(syncSize);
    if (host) ro.observe(host);
    requestAnimationFrame(syncSize);

    // Restore saved content, then re-sync (loadFromJSON resets dimensions).
    const restore = async () => {
      if (saved.json) {
        await canvas.loadFromJSON(saved.json);
        canvas.backgroundColor = saved.background;
      }
      syncSize();
    };
    restore();

    canvas.on("object:added", persist);
    canvas.on("object:modified", persist);
    canvas.on("object:removed", persist);
    canvas.on("text:changed", persist);
    canvas.on("mouse:dblclick", (event) => {
      if (event.target) return;
      const pointer = canvas.getViewportPoint(event.e);
      const text = new Textbox("双击编辑文字", { left: pointer.x, top: pointer.y, width: 300, fill: color, fontSize, editable: true, fontFamily: "Arial", padding: 8 });
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      persist();
    });

    return () => {
      ro.disconnect();
      canvas.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, storageKey]);

  // ---- Drawing / erasing mode ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const drawing = tool === "pen";
    canvas.isDrawingMode = drawing;
    canvas.selection = tool === "select";
    if (drawing) {
      const brush = new PencilBrush(canvas);
      // pencil style: semi-transparent stroke for a softer look
      brush.color = brushStyle === "pencil" ? `${color}88` : color;
      brush.width = brushWidth;
      canvas.freeDrawingBrush = brush;
    }
    // Eraser works via pointer handler below; no free drawing brush needed.
  }, [tool, color, brushWidth, brushStyle]);

  // Local eraser: remove the topmost object under the pointer on each click/drag tick.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || tool !== "eraser") return;
    const eraseAt = (point: { x: number; y: number }) => {
      const pt = new Point(point.x, point.y);
      const targets = canvas.getObjects().filter((o) => {
        try {
          return o.containsPoint(pt) && o.selectable !== false;
        } catch {
          return false;
        }
      });
      if (targets.length) {
        canvas.remove(targets[targets.length - 1]);
        canvas.requestRenderAll();
        persist();
      }
    };
    let dragging = false;
    const onMouseDown = (opt: { viewportPoint: Point }) => {
      dragging = true;
      eraseAt(opt.viewportPoint);
    };
    const onMouseMove = (opt: { viewportPoint: Point }) => {
      if (!dragging) return;
      eraseAt(opt.viewportPoint);
    };
    const onMouseUp = () => { dragging = false; };
    canvas.on("mouse:down", onMouseDown);
    canvas.on("mouse:move", onMouseMove);
    canvas.on("mouse:up", onMouseUp);
    return () => {
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:move", onMouseMove);
      canvas.off("mouse:up", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  const active = () => canvasRef.current?.getActiveObject();
  const updateActive = (patch: Record<string, unknown>) => {
    const object = active();
    if (!object) return;
    object.set(patch);
    canvasRef.current?.renderAll();
    persist();
  };
  const toggleActive = (property: string, activeValue: unknown, normalValue: unknown) => {
    const object = active();
    if (!object) return;
    const current = object.get(property);
    updateActive({ [property]: current === activeValue ? normalValue : activeValue });
  };
  const addText = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const text = new Textbox("双击编辑文字", { left: 100, top: 120, width: 320, fill: color, fontSize, editable: true, fontFamily: "Arial", padding: 8 });
    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
    persist();
  };
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = fill;
    persist();
  };
  const setBackground = (value: string) => {
    setFill(value);
    const canvas = canvasRef.current;
    if (canvas) { canvas.backgroundColor = value; canvas.renderAll(); persist(); }
  };
  const button = (activeState = false) => `flex h-8 w-8 items-center justify-center rounded-lg ${activeState ? "bg-[#d8cdb8] text-[#25344a]" : "text-[#5f7890] hover:bg-[#e9dfce] hover:text-[#25344a]"}`;
  const startEdgeResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const move = (next: PointerEvent) => {
      const delta = next.clientX - startX;
      setWidth(Math.max(280, Math.min(1000, startWidth + (sidePos === "right" ? -delta : delta))));
    };
    const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  if (!open) return null;

  // Inner board content shared by both modes.
  const board = (
    <>
      {/* Binder rings sit outside the paper, centered on its outer edge. */}
      <div className={`${sidePos === "left" ? "-right-4 left-auto" : "-left-4"} pointer-events-none absolute top-6 bottom-6 z-30 flex flex-col justify-between py-1`}>
        {Array.from({ length: 8 }).map((_, index) => (
          <span
            key={index}
            className="block h-8 w-12 rounded-full border-2 border-[#172033] bg-[#a9d9f7] shadow-[4px_0_0_#5c9bd7]"
          />
        ))}
      </div>

      {/* Single rounded board clips its own background at every corner. */}
      <div
        className="relative z-10 h-full w-full overflow-hidden rounded-[24px] border-2 border-[#1f2937] shadow-[0_10px_24px_rgba(38,91,115,0.18)]"
        style={{ background: fill }}
      >
        <div className="relative z-10 flex h-full w-full flex-col overflow-hidden rounded-[22px]">
          {/* Title bar */}
          <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-[#d8cdb8] pl-10 pr-2 text-[#25344a] sm:h-10 sm:gap-2 sm:pl-11 sm:pr-3">
            <span className="truncate text-base font-bold sm:text-lg">{title}</span>
            <span className="hidden truncate text-xs text-[#9b927f] sm:inline">随心笔记</span>
            <button
              type="button"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-[#5f7890] hover:bg-[#e9dfce]"
              onClick={() => setToolbarVisible((v) => !v)}
              title={toolbarVisible ? "隐藏工具栏" : "打开工具栏"}
              aria-label={toolbarVisible ? "隐藏工具栏" : "打开工具栏"}
            >
              <PanelLeft size={16} />
            </button>
          </div>

          {/* Toolbar */}
          <div className={`shrink-0 overflow-hidden transition-[max-height] duration-200 ease-out ${toolbarVisible ? "max-h-64" : "max-h-0"}`}>
            {toolbarVisible && (
              <div className="mx-1 mt-1 flex flex-wrap items-center gap-0.5 pl-10 pr-0 py-0.5 text-[#25344a] sm:mx-2 sm:mt-1.5 sm:gap-1 sm:pl-11 sm:pr-0 sm:py-1">
                <button className={button(active()?.get("fontWeight") === "bold")} onClick={() => toggleActive("fontWeight", "bold", "normal")} title="粗体"><Bold size={16} /></button>
                <button className={button(active()?.get("fontStyle") === "italic")} onClick={() => toggleActive("fontStyle", "italic", "normal")} title="斜体"><Italic size={16} /></button>
                <button className={button(active()?.get("underline") === true)} onClick={() => toggleActive("underline", true, false)} title="下划线"><Underline size={16} /></button>
                <div className="mx-1 h-5 w-px bg-[#d8cdb8]" />
                <div className="flex items-center gap-1">
                  <Type size={15} />
                  <select
                    value={fontSize}
                    onChange={(e) => { const value = Number(e.target.value); setFontSize(value); updateActive({ fontSize: value }); }}
                    className="h-7 rounded-md bg-[#eee5d5] px-1 text-xs text-[#25344a]"
                  >
                    <option className="text-black" value={20}>字号 20</option>
                    <option className="text-black" value={28}>字号 28</option>
                    <option className="text-black" value={36}>字号 36</option>
                    <option className="text-black" value={48}>字号 48</option>
                  </select>
                </div>
                <label className={button()} title="文字颜色">
                  <Palette size={16} />
                  <input className="sr-only" type="color" value={color} onChange={(e) => { setColor(e.target.value); updateActive({ fill: e.target.value }); }} />
                </label>
                <label className={button()} title="画布填充">
                  <PaintBucket size={16} />
                  <input className="sr-only" type="color" value={fill} onChange={(e) => setBackground(e.target.value)} />
                </label>
                <button className={button(tool === "select")} onClick={() => setTool("select")} title="选择"><Type size={16} /></button>
                <div className="relative">
                  <button
                    className={button(tool === "pen" || penPopupOpen)}
                    onClick={() => { setTool("pen"); setPenPopupOpen((v) => !v); }}
                    title="画笔（点击弹出设置）"
                  >
                    <Pencil size={16} />
                  </button>
                  {penPopupOpen && (
                    <>
                      {/* 点击外部关闭 */}
                      <div className="fixed inset-0 z-40" onClick={() => setPenPopupOpen(false)} />
                      {/* PS 风格画笔设置弹窗 */}
                      <div className="absolute top-9 left-0 z-50 w-56 rounded-xl border border-[#c4b89f] bg-[#fffdf5] p-3.5 shadow-2xl">
                        {/* 标题栏 */}
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-bold text-[#25344a]">画笔设置</span>
                          <button
                            type="button"
                            onClick={() => setPenPopupOpen(false)}
                            className="flex h-5 w-5 items-center justify-center rounded text-[#9b927f] hover:bg-[#e9dfce] hover:text-[#25344a]"
                            aria-label="关闭"
                          >
                            <X size={12} />
                          </button>
                        </div>

                        {/* 颜色选择 */}
                        <div className="mb-3">
                          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9b927f]">颜色</div>
                          <div className="grid grid-cols-5 gap-1.5">
                            {PEN_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => { setColor(c); updateActive({ fill: c }); }}
                                className={`h-6 w-6 rounded-full border-2 transition-transform ${color.toLowerCase() === c.toLowerCase() ? "border-[#25344a] scale-110 shadow-sm" : "border-[#d8cdb8] hover:scale-105"}`}
                                style={{ backgroundColor: c }}
                                aria-label={`颜色 ${c}`}
                              />
                            ))}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <label className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-[#d8cdb8] px-2 text-[10px] text-[#5f7890] hover:bg-[#e9dfce]">
                              <Palette size={12} />
                              自定义
                              <input
                                className="sr-only"
                                type="color"
                                value={color.length === 7 ? color : "#25344a"}
                                onChange={(e) => { setColor(e.target.value); updateActive({ fill: e.target.value }); }}
                              />
                            </label>
                            <span className="text-[10px] tabular-nums text-[#9b927f]">{color}</span>
                          </div>
                        </div>

                        {/* 分隔线 */}
                        <div className="my-2 h-px bg-[#e9dfce]" />

                        {/* 笔迹粗细 */}
                        <div className="mb-3">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9b927f]">粗细</span>
                            <span className="text-[10px] tabular-nums font-bold text-[#25344a]">{brushWidth}px</span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={40}
                            value={brushWidth}
                            onChange={(e) => setBrushWidth(Number(e.target.value))}
                            className="w-full cursor-pointer accent-[#25344a]"
                          />
                        </div>

                        {/* 笔迹样式 */}
                        <div className="mb-3">
                          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9b927f]">样式</div>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setBrushStyle("fountain")}
                              className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${brushStyle === "fountain" ? "border-[#25344a] bg-[#d8cdb8] text-[#25344a] font-semibold" : "border-[#d8cdb8] text-[#5f7890] hover:bg-[#e9dfce]"}`}
                            >
                              钢笔
                            </button>
                            <button
                              type="button"
                              onClick={() => setBrushStyle("pencil")}
                              className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${brushStyle === "pencil" ? "border-[#25344a] bg-[#d8cdb8] text-[#25344a] font-semibold" : "border-[#d8cdb8] text-[#5f7890] hover:bg-[#e9dfce]"}`}
                            >
                              铅笔
                            </button>
                          </div>
                        </div>

                        {/* 实时预览 */}
                        <div className="rounded-md bg-white/70 p-2">
                          <div className="mb-1 text-[9px] text-[#9b927f]">预览</div>
                          <svg className="w-full" height="36" viewBox="0 0 200 36">
                            <path
                              d="M 10 28 Q 50 8 100 18 T 190 14"
                              fill="none"
                              stroke={brushStyle === "pencil" ? `${color}88` : color}
                              strokeWidth={brushWidth}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <button className={button(tool === "eraser")} onClick={() => setTool("eraser")} title="橡皮 局部擦除" aria-label="橡皮"><span className="text-sm font-bold leading-none">橡皮</span></button>
                <button className={button()} onClick={addText} title="添加文本"><Type size={16} /></button>
                <div className="contents">
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#a9d9f7] text-[#25344a] hover:bg-[#8fc8ed]" onClick={() => { const next = sidePos === "right" ? "left" : "right"; onSideChange?.(next); }} title="切换左右"><PanelLeft size={16} /></button>
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#a9d9f7] text-[#25344a] hover:bg-[#8fc8ed]" onClick={clearCanvas} title="清空 一键清空全部" aria-label="清空"><Trash2 size={16} /></button>
                  <CloudButton type="button" variant="ghost" size="iconRound" onClick={onClose} className="h-8 w-8 text-[#25344a]" aria-label="关闭"><X size={16} /></CloudButton>
                </div>
              </div>
            )}
          </div>

          {/* Canvas host: fills remaining space. Fabric canvas syncs to this. */}
          <div ref={hostRef} className="relative min-h-0 flex-1 overflow-hidden">
            <canvas ref={canvasElement} className="block h-full w-full" />
            {subtitle && <div className="pointer-events-none absolute left-4 top-1 text-lg text-[#b8c9be]">{subtitle}</div>}
          </div>
        </div>
      </div>

      {/* Edge resize handle — only in standalone floating mode.
          In split mode the parent (ReviewWordList) controls width via its own drag handle. */}
      {!split && (
        <div
          className={`${sidePos === "right" ? "-left-1.5" : "-right-1.5"} absolute top-0 bottom-0 z-50 flex w-3 touch-none cursor-ew-resize items-center justify-center`}
          onPointerDown={startEdgeResize}
          aria-label="拖动分屏边缘调整宽度"
          title="拖动调整宽度"
        >
          <span className="h-10 w-0.5 rounded-full bg-[#5f7890]/40" />
        </div>
      )}
    </>
  );

  if (split) {
    // In split mode, render as a flex child (same layer as word content).
    return (
      <div className="relative h-full w-full box-border">
        {board}
      </div>
    );
  }

  // Standalone floating mode.
  return (
    <aside
      className="fixed z-50 box-border max-w-[calc(100vw-16px)]"
      style={{
        top: "3.5rem",
        bottom: "5.5rem",
        [sidePos]: 0,
        width: `min(${width}px, calc(100vw - 16px))`,
        maxWidth: "calc(100vw - 16px)",
        minWidth: "min(280px, calc(100vw - 16px))",
      }}
    >
      {board}
    </aside>
  );
}
