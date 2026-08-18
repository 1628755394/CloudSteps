import { useEffect, useRef, useState } from "react";
import { Check, Eraser, Maximize2, Minus, PenLine, StickyNote, X } from "lucide-react";
import { CloudButton } from "./cloudsteps";

type NoteData = { text: string; drawing: string; color: string; background: string; fontSize: number; bold: boolean };

type Props = { open: boolean; onClose: () => void; storageKey: string; title?: string; side?: "left" | "right" };

const emptyNote: NoteData = { text: "", drawing: "", color: "#1e3a5f", background: "#fffbe6", fontSize: 18, bold: false };

function loadNote(key: string): NoteData {
  try { return { ...emptyNote, ...JSON.parse(localStorage.getItem(key) || "{}") }; } catch { return emptyNote; }
}

export function readStudyNote(key: string): string {
  return loadNote(key).text;
}

export function StudyNotePanel({ open, onClose, storageKey, title = "笔记", side = "right" }: Props) {
  const [note, setNote] = useState<NoteData>(() => loadNote(storageKey));
  const [drawing, setDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => { if (open) setNote(loadNote(storageKey)); }, [open, storageKey]);
  useEffect(() => { if (open) localStorage.setItem(storageKey, JSON.stringify(note)); }, [note, open, storageKey]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !open) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (note.drawing) { const image = new Image(); image.onload = () => ctx.drawImage(image, 0, 0); image.src = note.drawing; }
  }, [open, note.drawing]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  };
  const startDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return; const p = point(event); if (!p) return;
    drawingRef.current = true; event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = event.currentTarget.getContext("2d"); if (ctx) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.strokeStyle = note.color; ctx.lineWidth = 3; ctx.lineCap = "round"; }
  };
  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return; const p = point(event); const ctx = event.currentTarget.getContext("2d"); if (!p || !ctx) return;
    ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const endDraw = () => { if (!drawingRef.current) return; drawingRef.current = false; const canvas = canvasRef.current; if (canvas) setNote((n) => ({ ...n, drawing: canvas.toDataURL() })); };
  const clearDrawing = () => { const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (canvas && ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); setNote((n) => ({ ...n, drawing: "" })); } };

  if (!open) return null;
  return (
    <aside className={`fixed top-14 bottom-20 ${side === "right" ? "right-3" : "left-3"} z-50 w-[min(92vw,390px)] min-h-[360px] resize overflow-hidden rounded-2xl border border-amber-200 shadow-2xl`} style={{ background: note.background }}>
      <div className="flex items-center justify-between border-b border-black/10 px-3 py-2">
        <div className="flex items-center gap-2 font-semibold text-[#1e3a5f]"><StickyNote size={18} />{title}</div>
        <div className="flex items-center gap-1"><CloudButton size="iconRound" variant="ghost" onClick={() => setDrawing((v) => !v)} aria-label="手写"><PenLine size={16} className={drawing ? "text-[#4ECDC4]" : ""} /></CloudButton><CloudButton size="iconRound" variant="ghost" onClick={onClose} aria-label="关闭"><X size={17} /></CloudButton></div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-black/10 px-3 py-2 text-xs">
        <label className="flex items-center gap-1">字色<input type="color" value={note.color} onChange={(e) => setNote((n) => ({ ...n, color: e.target.value }))} /></label>
        <label className="flex items-center gap-1">背景<input type="color" value={note.background} onChange={(e) => setNote((n) => ({ ...n, background: e.target.value }))} /></label>
        <button type="button" className="rounded bg-black/5 px-2 py-1" onClick={() => setNote((n) => ({ ...n, fontSize: Math.max(12, n.fontSize - 2) }))}><Minus size={13} /></button>
        <span>{note.fontSize}px</span>
        <button type="button" className="rounded bg-black/5 px-2 py-1" onClick={() => setNote((n) => ({ ...n, fontSize: Math.min(32, n.fontSize + 2) }))}><Maximize2 size={13} /></button>
        <button type="button" className={`rounded px-2 py-1 ${note.bold ? "bg-[#4ECDC4] text-white" : "bg-black/5"}`} onClick={() => setNote((n) => ({ ...n, bold: !n.bold }))}>粗体</button>
        {drawing && <button type="button" className="ml-auto rounded bg-black/5 px-2 py-1" onClick={clearDrawing}><Eraser size={13} /></button>}
      </div>
      <div className="relative h-[calc(100%-106px)] min-h-[280px]">
        <textarea value={note.text} onChange={(e) => setNote((n) => ({ ...n, text: e.target.value }))} placeholder="记录这个单词的重点…" className="absolute inset-0 z-10 h-full w-full resize-none bg-transparent p-4 outline-none placeholder:text-[#9c8f61]" style={{ color: note.color, fontSize: note.fontSize, fontWeight: note.bold ? 700 : 400 }} />
        <canvas ref={canvasRef} width={700} height={560} className={`absolute inset-0 h-full w-full ${drawing ? "z-20 cursor-crosshair" : "z-0 pointer-events-none"}`} onPointerDown={startDraw} onPointerMove={draw} onPointerUp={endDraw} onPointerCancel={endDraw} />
      </div>
      <div className="absolute bottom-2 right-3 flex items-center gap-1 text-[11px] text-black/45"><Check size={13} />自动保存</div>
    </aside>
  );
}
