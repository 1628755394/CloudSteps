import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Type,
  Palette,
  PaintBucket,
  Pencil,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Download,
  PanelLeft,
  X,
  Moon,
  GripVertical,
  Eraser,
} from "lucide-react";
import { CloudButton } from "./cloudsteps";

type NoteData = {
  text: string;
  drawing: string;
  color: string;
  background: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: "left" | "center" | "right";
};

type Props = {
  open: boolean;
  onClose: () => void;
  storageKey: string;
  title?: string;
  subtitle?: string;
  side?: "left" | "right";
};

const emptyNote: NoteData = {
  text: "",
  drawing: "",
  color: "#ffffff",
  background: "#1b6b3e",
  fontSize: 20,
  bold: false,
  italic: false,
  underline: false,
  align: "left",
};

function loadNote(key: string): NoteData {
  try {
    return { ...emptyNote, ...JSON.parse(localStorage.getItem(key) || "{}") };
  } catch {
    return emptyNote;
  }
}

export function readStudyNote(key: string): string {
  return loadNote(key).text;
}

export function StudyNotePanel({
  open,
  onClose,
  storageKey,
  title,
  subtitle,
  side = "right",
}: Props) {
  const [note, setNote] = useState<NoteData>(() => loadNote(storageKey));
  const [drawing, setDrawing] = useState(false);
  const [panelWidth, setPanelWidth] = useState(420);
  const [panelHeight, setPanelHeight] = useState(520);
  const [sidePos, setSidePos] = useState(side);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const resizeRef = useRef<{ startX: number; startW: number; side: "left" | "right" } | null>(null);

  useEffect(() => {
    if (open) {
      setNote(loadNote(storageKey));
      setSidePos(side);
    }
  }, [open, storageKey, side]);

  useEffect(() => {
    if (open) localStorage.setItem(storageKey, JSON.stringify(note));
  }, [note, open, storageKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !open) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (note.drawing) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0);
      image.src = note.drawing;
    }
  }, [open, note.drawing]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { startX, startW, side } = resizeRef.current;
      const delta = side === "right" ? startX - e.clientX : e.clientX - startX;
      setPanelWidth(Math.max(280, Math.min(900, startW + delta)));
    };
    const handleUp = () => {
      resizeRef.current = null;
      document.body.style.userSelect = "";
    };
    if (resizeRef.current) {
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const p = point(event);
    if (!p) return;
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = event.currentTarget.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.strokeStyle = note.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
    }
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const p = point(event);
    const ctx = event.currentTarget.getContext("2d");
    if (!p || !ctx) return;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) setNote((n) => ({ ...n, drawing: canvas.toDataURL() }));
  };

  const clearDrawing = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setNote((n) => ({ ...n, drawing: "" }));
    }
  };

  const downloadNote = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = note.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${note.bold ? "700" : "400"} ${note.fontSize}px sans-serif`;
    ctx.fillStyle = note.color;
    ctx.textAlign = note.align;
    const x = note.align === "left" ? 24 : note.align === "right" ? canvas.width - 24 : canvas.width / 2;
    const lines = note.text.split("\n");
    lines.forEach((line, i) => ctx.fillText(line, x, 80 + i * (note.fontSize + 8)));
    if (note.drawing) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = note.drawing;
    }
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${title || "note"}.png`;
    a.click();
  };

  const startResize = (e: React.MouseEvent) => {
    resizeRef.current = { startX: e.clientX, startW: panelWidth, side: sidePos };
  };

  const toggleStyle = (active: boolean) =>
    `h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
      active ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
    }`;

  if (!open) return null;
  return (
    <aside
      ref={panelRef}
      className="fixed top-16 bottom-24 z-50 overflow-hidden rounded-2xl shadow-2xl"
      style={{
        width: panelWidth,
        height: panelHeight,
        [sidePos === "right" ? "right" : "left"]: 12,
        background: "#8B5A2B",
        padding: 10,
      }}
    >
      {/* 左侧拖拽条 */}
      <div
        className="absolute top-16 bottom-16 w-3 cursor-ew-resize flex items-center justify-center z-50"
        style={{ [sidePos === "right" ? "left" : "right"]: 0 }}
        onMouseDown={startResize}
        title="拖拽调节区域大小"
      >
        <GripVertical size={16} className="text-white/60" />
      </div>

      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-xl"
        style={{ background: note.background }}
      >
        {/* 标题 */}
        <div className="px-4 pt-4 pb-1">
          <div className="flex items-baseline gap-2 text-white">
            <h2 className="text-xl font-bold">{title || "黑板笔记"}</h2>
            <span className="text-sm text-white/70">{subtitle || ""}</span>
          </div>
        </div>

        {/* 工具栏 */}
        {toolbarVisible && (
          <div className="mx-3 mt-2 flex items-center gap-1.5 rounded-xl bg-[#0f2e1c]/70 px-2 py-2 text-white">
            <button
              type="button"
              className={toggleStyle(note.bold)}
              onClick={() => setNote((n) => ({ ...n, bold: !n.bold }))}
              title="粗体"
            >
              <Bold size={16} />
            </button>
            <button
              type="button"
              className={toggleStyle(note.italic)}
              onClick={() => setNote((n) => ({ ...n, italic: !n.italic }))}
              title="斜体"
            >
              <Italic size={16} />
            </button>
            <button
              type="button"
              className={toggleStyle(note.underline)}
              onClick={() => setNote((n) => ({ ...n, underline: !n.underline }))}
              title="下划线"
            >
              <Underline size={16} />
            </button>

            <div className="mx-1 h-5 w-px bg-white/20" />

            <div className="relative flex items-center">
              <Type size={15} className="mr-1 text-white/70" />
              <select
                value={note.fontSize}
                onChange={(e) => setNote((n) => ({ ...n, fontSize: Number(e.target.value) }))}
                className="h-7 appearance-none rounded-md bg-white/10 pl-2 pr-5 text-sm text-white outline-none"
              >
                {[14, 16, 18, 20, 22, 24, 28, 32].map((s) => (
                  <option key={s} value={s} className="text-[#1e3a5f]">
                    字号 {s}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white" title="颜色">
              <Palette size={16} />
              <input
                type="color"
                value={note.color}
                onChange={(e) => setNote((n) => ({ ...n, color: e.target.value }))}
                className="sr-only"
              />
            </label>

            <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white" title="填充">
              <PaintBucket size={16} />
              <input
                type="color"
                value={note.background}
                onChange={(e) => setNote((n) => ({ ...n, background: e.target.value }))}
                className="sr-only"
              />
            </label>

            <button
              type="button"
              className={toggleStyle(drawing)}
              onClick={() => setDrawing((v) => !v)}
              title="画板"
            >
              <Pencil size={16} />
            </button>

            <div className="mx-1 h-5 w-px bg-white/20" />

            <button
              type="button"
              className={toggleStyle(note.align === "left")}
              onClick={() => setNote((n) => ({ ...n, align: "left" }))}
              title="左对齐"
            >
              <AlignLeft size={16} />
            </button>
            <button
              type="button"
              className={toggleStyle(note.align === "center")}
              onClick={() => setNote((n) => ({ ...n, align: "center" }))}
              title="居中"
            >
              <AlignCenter size={16} />
            </button>
            <button
              type="button"
              className={toggleStyle(note.align === "right")}
              onClick={() => setNote((n) => ({ ...n, align: "right" }))}
              title="右对齐"
            >
              <AlignRight size={16} />
            </button>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                className="h-8 w-8 rounded-lg bg-purple-600 text-white hover:bg-purple-500 flex items-center justify-center"
                onClick={() => setSidePos((s) => (s === "right" ? "left" : "right"))}
                title="切换左右"
              >
                <PanelLeft size={16} />
              </button>
              <button
                type="button"
                className="h-8 w-8 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 flex items-center justify-center"
                onClick={downloadNote}
                title="下载"
              >
                <Download size={16} />
              </button>
              <button
                type="button"
                className="h-8 w-8 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 flex items-center justify-center"
                onClick={() => setToolbarVisible(false)}
                title="简洁模式"
              >
                <Moon size={16} />
              </button>
              {drawing && (
                <button
                  type="button"
                  className="h-8 w-8 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 flex items-center justify-center"
                  onClick={clearDrawing}
                  title="清空手写"
                >
                  <Eraser size={16} />
                </button>
              )}
              <CloudButton
                type="button"
                variant="destructive"
                size="iconRound"
                onClick={onClose}
                aria-label="关闭"
                className="h-8 w-8"
              >
                <X size={16} />
              </CloudButton>
            </div>
          </div>
        )}

        {!toolbarVisible && (
          <div className="mx-3 mt-2 flex justify-end px-2">
            <button
              type="button"
              className="text-xs text-white/70 hover:text-white"
              onClick={() => setToolbarVisible(true)}
            >
              展开工具栏
            </button>
          </div>
        )}

        {/* 内容区 */}
        <div className="relative mt-2 flex-1 min-h-0">
          <textarea
            value={note.text}
            onChange={(e) => setNote((n) => ({ ...n, text: e.target.value }))}
            placeholder="在这里写下笔记…"
            className="absolute inset-0 z-10 h-full w-full resize-none bg-transparent p-4 outline-none placeholder:text-white/40"
            style={{
              color: note.color,
              fontSize: note.fontSize,
              fontWeight: note.bold ? 700 : 400,
              fontStyle: note.italic ? "italic" : "normal",
              textDecoration: note.underline ? "underline" : "none",
              textAlign: note.align,
            }}
          />
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className={`absolute inset-0 h-full w-full ${drawing ? "z-20 cursor-crosshair" : "z-0 pointer-events-none"}`}
            onPointerDown={startDraw}
            onPointerMove={draw}
            onPointerUp={endDraw}
            onPointerCancel={endDraw}
          />
        </div>

        <div className="px-4 py-2 text-right text-[11px] text-white/40">自动保存</div>
      </div>
    </aside>
  );
}
