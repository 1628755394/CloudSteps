import { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Download,
  Eraser,
  Italic,
  Moon,
  PaintBucket,
  Palette,
  Pencil,
  PanelLeft,
  Type,
  Underline,
  X,
} from "lucide-react";
import { Canvas, PencilBrush, Textbox } from "fabric";
import { CloudButton } from "./cloudsteps";

type NoteData = { json?: string; text: string; color: string; background: string };
type Props = { open: boolean; onClose: () => void; storageKey: string; title?: string; subtitle?: string; side?: "left" | "right" };
const emptyNote: NoteData = { text: "", color: "#ffffff", background: "#175b37" };

function loadNote(key: string): NoteData {
  try { return { ...emptyNote, ...JSON.parse(localStorage.getItem(key) || "{}") }; } catch { return emptyNote; }
}
export function readStudyNote(key: string) { return loadNote(key).text; }

export function StudyNotePanel({ open, onClose, storageKey, title = "黑板", subtitle = "", side = "right" }: Props) {
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const [note, setNote] = useState<NoteData>(() => loadNote(storageKey));
  const [sidePos, setSidePos] = useState(side);
  const [width, setWidth] = useState(640);
  const [height, setHeight] = useState(600);
  const [fontSize, setFontSize] = useState(28);
  const [color, setColor] = useState("#ffffff");
  const [fill, setFill] = useState("#175b37");
  const [drawing, setDrawing] = useState(false);
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

  useEffect(() => {
    if (!open || !canvasElement.current) return;
    const saved = loadNote(storageKey);
    setNote(saved);
    setColor(saved.color);
    setFill(saved.background);
    const canvas = new Canvas(canvasElement.current, { width: 800, height: 600, preserveObjectStacking: true, selection: true });
    canvas.backgroundColor = saved.background;
    canvasRef.current = canvas;
    if (saved.json) canvas.loadFromJSON(saved.json).then(() => { canvas.backgroundColor = saved.background; canvas.renderAll(); });
    canvas.on("object:added", persist);
    canvas.on("object:modified", persist);
    canvas.on("object:removed", persist);
    canvas.on("text:changed", persist);
    canvas.on("mouse:dblclick", (event) => {
      if (event.target) return;
      const text = new Textbox("双击编辑文字", { left: 120, top: 160, width: 300, fill: color, fontSize, editable: true, fontFamily: "Arial", padding: 8 });
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      persist();
    });
    return () => { canvas.dispose(); canvasRef.current = null; };
    // Canvas is intentionally recreated when the panel opens or storage target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, storageKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = drawing;
    if (drawing) {
      const brush = new PencilBrush(canvas);
      brush.color = color;
      brush.width = 4;
      canvas.freeDrawingBrush = brush;
    }
  }, [drawing, color]);

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
  const clearCanvas = () => { canvasRef.current?.clear(); if (canvasRef.current) canvasRef.current.backgroundColor = fill; persist(); };
  const setBackground = (value: string) => { setFill(value); if (canvasRef.current) { canvasRef.current.backgroundColor = value; canvasRef.current.renderAll(); persist(); } };
  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${title}-黑板.png`;
    link.href = canvas.toDataURL({ format: "png", multiplier: 2 });
    link.click();
  };
  const button = (activeState = false) => `flex h-8 w-8 items-center justify-center rounded-lg ${activeState ? "bg-white/20 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`;

  if (!open) return null;
  return (
    <aside className="fixed z-50 max-w-[calc(100vw-16px)] max-h-[calc(100dvh-32px)]" style={{ top: "max(8px, env(safe-area-inset-top))", bottom: "max(8px, env(safe-area-inset-bottom))", [sidePos]: 8, width: `min(${width}px, calc(100vw - 16px))`, height: `min(${height}px, calc(100dvh - 32px))`, minWidth: "min(280px, calc(100vw - 16px))", minHeight: "min(360px, calc(100dvh - 32px))" }}>
      <div className="relative h-full w-full rounded-2xl bg-[#8c582b] p-2 shadow-2xl sm:p-3">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border-4 border-[#70431f] bg-[#175b37]">
          <div className="flex h-10 shrink-0 items-center gap-1.5 border-b-2 border-[#f1c40f] bg-[#176b42] px-2 text-white sm:h-11 sm:gap-2 sm:px-3">
            <span className="truncate text-lg font-bold sm:text-xl">{title}</span><span className="hidden truncate text-xs text-white/65 sm:inline">黑板笔记</span>
            <button type="button" className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10" onClick={() => setToolbarVisible((v) => !v)} title={toolbarVisible ? "隐藏工具栏" : "打开工具栏"} aria-label={toolbarVisible ? "隐藏工具栏" : "打开工具栏"}><PanelLeft size={17} /></button>
          </div>
          {toolbarVisible && <div className="mx-1 mt-1 flex shrink-0 flex-wrap items-center gap-0.5 rounded-md bg-transparent px-0 py-0.5 text-white sm:mx-2 sm:mt-2 sm:gap-1 sm:py-1">
            <button className={button(active()?.get("fontWeight") === "bold")} onClick={() => toggleActive("fontWeight", "bold", "normal")} title="粗体"><Bold size={16} /></button>
            <button className={button(active()?.get("fontStyle") === "italic")} onClick={() => toggleActive("fontStyle", "italic", "normal")} title="斜体"><Italic size={16} /></button>
            <button className={button(active()?.get("underline") === true)} onClick={() => toggleActive("underline", true, false)} title="下划线"><Underline size={16} /></button>
            <div className="mx-1 h-5 w-px bg-white/20" />
            <div className="flex items-center gap-1"><Type size={15} /><select value={fontSize} onChange={(e) => { const value = Number(e.target.value); setFontSize(value); updateActive({ fontSize: value }); }} className="h-7 rounded-md bg-white/10 px-1 text-xs text-white"><option className="text-black" value={20}>字号 20</option><option className="text-black" value={28}>字号 28</option><option className="text-black" value={36}>字号 36</option><option className="text-black" value={48}>字号 48</option></select></div>
            <label className={button()} title="文字颜色"><Palette size={16} /><input className="sr-only" type="color" value={color} onChange={(e) => { setColor(e.target.value); updateActive({ fill: e.target.value }); }} /></label>
            <label className={button()} title="画布填充"><PaintBucket size={16} /><input className="sr-only" type="color" value={fill} onChange={(e) => setBackground(e.target.value)} /></label>
            <button className={button(drawing)} onClick={() => setDrawing((v) => !v)} title="画板"><Pencil size={16} /></button>
            <button className={button()} onClick={addText} title="添加文本"><Type size={16} /></button>
            <button className={button()} onClick={() => updateActive({ textAlign: "left" })} title="左对齐"><AlignLeft size={16} /></button>
            <button className={button()} onClick={() => updateActive({ textAlign: "center" })} title="居中"><AlignCenter size={16} /></button>
            <button className={button()} onClick={() => updateActive({ textAlign: "right" })} title="右对齐"><AlignRight size={16} /></button>
            <div className="ml-0 flex flex-wrap items-center gap-0.5 sm:ml-auto sm:gap-1"><button className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600" onClick={() => setSidePos((s) => s === "right" ? "left" : "right")} title="切换左右"><PanelLeft size={16} /></button><button className={button()} onClick={download} title="下载"><Download size={16} /></button><button className={button()} onClick={() => setToolbarVisible(false)} title="隐藏工具栏"><Moon size={16} /></button><button className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500" onClick={clearCanvas} title="清空"><Eraser size={16} /></button><CloudButton type="button" variant="ghost" size="iconRound" onClick={onClose} className="h-8 w-8 text-white" aria-label="关闭"><X size={16} /></CloudButton></div>
          </div>}
          <div className="relative min-h-0 flex-1 p-1 sm:p-2"><canvas ref={canvasElement} className="h-full w-full" /><div className="pointer-events-none absolute left-4 top-1 text-lg text-[#b8c9be]">{subtitle}</div></div>
        </div>
        <div className={`${sidePos === "right" ? "-left-1" : "-right-1"} absolute top-1/2 h-20 w-3 touch-none -translate-y-1/2 cursor-ew-resize rounded-full bg-[#f0a060] shadow-[0_0_0_2px_rgba(255,255,255,0.18)]`} title="拖拽调节区域大小" onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); const start = e.clientX; const initial = width; const move = (event: PointerEvent) => setWidth(Math.max(280, Math.min(1000, initial + (sidePos === "right" ? start - event.clientX : event.clientX - start)))); const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); }} />
      </div>
    </aside>
  );
}
