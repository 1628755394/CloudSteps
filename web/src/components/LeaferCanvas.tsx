import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import { App, Group, Path, Text, Rect, Ellipse, UI, DragEvent as LeaferDragEvent, MoveEvent as LeaferMoveEvent } from "leafer-ui";
import "@leafer-in/editor";
import "@leafer-in/text-editor";
import "@leafer-in/export";

// ---- Types ----
export type Tool = "select" | "pen" | "eraser" | "circle" | "rect" | "text";

export interface LeaferCanvasHandle {
  exportJSON: () => string;
  importJSON: (json: string) => void;
  exportImage: (filename?: string) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  setBackground: (color: string) => void;
  addTextAtCenter: () => void;
}

interface Props {
  tool: Tool;
  color: string;
  brushWidth: number;
  eraserWidth: number;
  eraserTrailColor: string;
  eraserTrailOpacity: number;
  brushStyle: "fountain" | "pencil" | "highlighter";
  background: string;
  fontSize: number;
  storageKey: string;
  onContentChange?: () => void;
}

interface Pt { x: number; y: number }

// ---- Document-like text layout constants ----
const TEXT_LEFT_MARGIN = 48;  // avoid notebook rings on the left
const TEXT_RIGHT_MARGIN = 8;
const TEXT_FIRST_ROW = 8;
const MIN_TEXT_WIDTH = 240;

// ---- Stroke smoothing: Catmull-Rom to Bezier ----
function pointsToPathString(points: Pt[], width: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const r = width / 2;
    return `M ${points[0].x - r} ${points[0].y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

// ---- Undo/Redo stack ----
interface Snapshot {
  children: unknown[];
  strokePoints: Record<string, number[][]>;
}

// ---- Text overlay state ----
interface TextOverlay {
  id: string;
  x: number;
  y: number;
  width: number;
  text: string;
  isNew: boolean;
}

export const LeaferCanvas = forwardRef<LeaferCanvasHandle, Props>(function LeaferCanvas(
  { tool, color, brushWidth, eraserWidth, eraserTrailColor, eraserTrailOpacity, brushStyle, background, fontSize, storageKey, onContentChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<App | null>(null);
  const drawLayerRef = useRef<Group | null>(null);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<Pt[]>([]);
  const currentPathRef = useRef<Path | null>(null);
  const eraserPreviewRef = useRef<Path | null>(null);
  const shapeStartRef = useRef<Pt | null>(null);
  const shapePreviewRef = useRef<UI | null>(null);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const brushWidthRef = useRef(brushWidth);
  const eraserWidthRef = useRef(eraserWidth);
  const eraserTrailColorRef = useRef(eraserTrailColor);
  const eraserTrailOpacityRef = useRef(eraserTrailOpacity);
  const brushStyleRef = useRef(brushStyle);
  const fontSizeRef = useRef(fontSize);
  const backgroundRef = useRef(background);
  const isUndoRedoRef = useRef(false);
  const undoStackRef = useRef<Snapshot[]>([]);
  const redoStackRef = useRef<Snapshot[]>([]);
  const strokePointsMap = useRef<Map<string, Pt[]>>(new Map());
  const strokeIdCounter = useRef(0);
  const textIdCounter = useRef(0);
  const textMapRef = useRef<Map<string, Text>>(new Map());
  const [eraserCursor, setEraserCursor] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });
  const [textOverlay, setTextOverlay] = useState<TextOverlay | null>(null);
  const textOverlayRef = useRef<TextOverlay | null>(null);
  const overlayRef = useRef<HTMLTextAreaElement | null>(null);
  const isFinishingRef = useRef(false);

  // Keep textOverlayRef in sync with state
  useEffect(() => { textOverlayRef.current = textOverlay; }, [textOverlay]);

  // Keep refs in sync
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { brushWidthRef.current = brushWidth; }, [brushWidth]);
  useEffect(() => { eraserWidthRef.current = eraserWidth; }, [eraserWidth]);
  useEffect(() => { eraserTrailColorRef.current = eraserTrailColor; }, [eraserTrailColor]);
  useEffect(() => { eraserTrailOpacityRef.current = eraserTrailOpacity; }, [eraserTrailOpacity]);
  useEffect(() => { brushStyleRef.current = brushStyle; }, [brushStyle]);
  useEffect(() => { fontSizeRef.current = fontSize; }, [fontSize]);
  useEffect(() => {
    backgroundRef.current = background;
    if (appRef.current) {
      appRef.current.tree.set({ fill: background });
    }
  }, [background]);

  // ---- Snapshot helpers ----
  const captureSnapshot = useCallback((): Snapshot => {
    const layer = drawLayerRef.current;
    if (!layer) return { children: [], strokePoints: {} };
    const json = layer.toJSON();
    const strokePoints: Record<string, number[][]> = {};
    for (const [id, pts] of strokePointsMap.current) {
      strokePoints[id] = pts.map(p => [p.x, p.y]);
    }
    return {
      children: (json as { children?: unknown[] }).children || [],
      strokePoints,
    };
  }, []);

  const pushUndo = useCallback(() => {
    if (isUndoRedoRef.current) return;
    undoStackRef.current.push(captureSnapshot());
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
  }, [captureSnapshot]);

  const restoreSnapshot = useCallback((snap: Snapshot) => {
    const layer = drawLayerRef.current;
    if (!layer) return;
    isUndoRedoRef.current = true;
    layer.removeAll(true);
    (layer as unknown as { set: (data: unknown) => void }).set({ children: snap.children });
    appRef.current?.tree.forceUpdate();
    isUndoRedoRef.current = false;
    // Restore stroke points map
    strokePointsMap.current.clear();
    for (const [id, pts] of Object.entries(snap.strokePoints)) {
      strokePointsMap.current.set(id, pts.map(([x, y]) => ({ x, y })));
    }
    // Rebuild text map
    textMapRef.current.clear();
    for (const child of [...(layer.children || [])]) {
      const tid = (child as unknown as { id?: string }).id;
      if (tid && tid.startsWith("text-") && child instanceof Text) {
        textMapRef.current.set(tid, child);
      }
    }
    onContentChange?.();
  }, [onContentChange]);

  // ---- Helpers for text layout ----
  const getTextWidth = useCallback((): number => {
    const el = containerRef.current;
    if (!el) return 800;
    const rect = el.getBoundingClientRect();
    return Math.max(Math.floor(rect.width - TEXT_LEFT_MARGIN - TEXT_RIGHT_MARGIN), MIN_TEXT_WIDTH);
  }, []);
  const createStrokePath = useCallback((
    pts: Pt[],
    strokeColor: string,
    strokeWidth: number,
    opacity: number,
  ): Path | null => {
    if (pts.length < 2) return null;
    const pathStr = pointsToPathString(pts, strokeWidth);
    if (!pathStr) return null;
    const id = `stroke-${strokeIdCounter.current++}`;
    const path = new Path({
      id,
      x: 0,
      y: 0,
      path: pathStr,
      stroke: strokeColor,
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      fill: "",
      draggable: false,
      opacity,
    });
    drawLayerRef.current?.add(path);
    strokePointsMap.current.set(id, pts);
    return path;
  }, []);

  // ---- 笔画擦除：橡皮触碰到的笔画整条删除 ----
  const eraseStrokes = useCallback((eraserPoints: Pt[], eraserRadius: number) => {
    const layer = drawLayerRef.current;
    if (!layer || eraserPoints.length === 0) return;

    const r2 = eraserRadius * eraserRadius;
    for (const child of [...layer.children]) {
      if (!(child instanceof Path)) continue;
      const pathId = (child as unknown as { id?: string }).id;
      if (!pathId || !strokePointsMap.current.has(pathId)) continue;
      const pts = strokePointsMap.current.get(pathId)!;

      // 检查笔画的任意点是否落在橡皮圆内
      let hit = false;
      for (const sp of pts) {
        for (const ep of eraserPoints) {
          const dx = sp.x - ep.x;
          const dy = sp.y - ep.y;
          if (dx * dx + dy * dy <= r2) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }

      if (hit) {
        child.remove();
        strokePointsMap.current.delete(pathId);
      }
    }

    appRef.current?.tree.forceUpdate();
  }, []);

  const createTextElement = useCallback((x: number, y: number, width: number, text: string): string => {
    const layer = drawLayerRef.current;
    if (!layer) return "";
    const id = `text-${textIdCounter.current++}`;
    const textEl = new Text({
      id,
      text,
      x,
      y,
      width,
      fontSize: fontSizeRef.current,
      fill: colorRef.current,
      draggable: false,
      textWrap: "break",
    });
    layer.add(textEl);
    textMapRef.current.set(id, textEl);
    return id;
  }, []);

  // ---- Update text element content ----
  const updateTextContent = useCallback((id: string, text: string) => {
    const textEl = textMapRef.current.get(id);
    if (!textEl) return;
    textEl.text = text;
    appRef.current?.tree.forceUpdate();
  }, []);

  // ---- Remove text element ----
  const removeTextElement = useCallback((id: string) => {
    const textEl = textMapRef.current.get(id);
    if (!textEl) return;
    textEl.remove();
    textMapRef.current.delete(id);
    appRef.current?.tree.forceUpdate();
  }, []);

  // ---- Finish text editing: save or remove if empty ----
  const finishTextEditing = useCallback(() => {
    // Guard against double-call (Enter keydown + blur)
    if (isFinishingRef.current) return;
    const current = textOverlayRef.current;
    if (!current) return;
    isFinishingRef.current = true;

    const trimmed = current.text.trim();
    if (trimmed) {
      const fullWidth = getTextWidth();
      if (current.isNew) {
        createTextElement(TEXT_LEFT_MARGIN, current.y, fullWidth, trimmed);
      } else {
        // Update existing text: always full width aligned to left
        const textEl = textMapRef.current.get(current.id);
        if (textEl) {
          textEl.text = trimmed;
          (textEl as unknown as { x?: number; y?: number; width?: number; textWrap?: string }).x = TEXT_LEFT_MARGIN;
          (textEl as unknown as { x?: number; y?: number; width?: number; textWrap?: string }).y = current.y;
          (textEl as unknown as { x?: number; y?: number; width?: number; textWrap?: string }).width = fullWidth;
          (textEl as unknown as { x?: number; y?: number; width?: number; textWrap?: string }).textWrap = "break";
          appRef.current?.tree.forceUpdate();
        }
      }
      pushUndo();
      onContentChange?.();
    } else if (!current.isNew) {
      // Remove empty existing text
      const textEl = textMapRef.current.get(current.id);
      if (textEl) {
        textEl.remove();
        textMapRef.current.delete(current.id);
        appRef.current?.tree.forceUpdate();
      }
      pushUndo();
      onContentChange?.();
    }
    // Clear overlay state
    textOverlayRef.current = null;
    setTextOverlay(null);
    // Reset guard on next tick
    setTimeout(() => { isFinishingRef.current = false; }, 0);
  }, [createTextElement, pushUndo, onContentChange]);

  const startTextEditing = useCallback((x: number, y: number, width: number, existingId?: string, existingText?: string) => {
    isFinishingRef.current = false;
    // Clear the Leafer Text content while editing (so user only sees the textarea)
    if (existingId) {
      const textEl = textMapRef.current.get(existingId);
      if (textEl) {
        textEl.text = "";
        appRef.current?.tree.forceUpdate();
      }
    }
    const overlay: TextOverlay = {
      id: existingId || "",
      x,
      y,
      width,
      text: existingText || "",
      isNew: !existingId,
    };
    textOverlayRef.current = overlay;
    setTextOverlay(overlay);
  }, []);

  // ---- Init Leafer app ----
  useEffect(() => {
    if (!containerRef.current) return;
    const app = new App({
      view: containerRef.current,
      tree: {},
      editor: {},
      fill: backgroundRef.current,
    });
    appRef.current = app;

    // Draw layer: holds all pen strokes, shapes, text.
    const cw = containerRef.current.clientWidth || 800;
    const ch = containerRef.current.clientHeight || 600;
    const drawLayer = new Group({
      name: "drawLayer",
      x: 0,
      y: 0,
      width: cw,
      height: ch,
      overflow: "show",
    });
    app.tree.add(drawLayer);
    drawLayerRef.current = drawLayer;

    // Sync drawLayer size on container resize
    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !drawLayerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      if (w > 0 && h > 0) {
        drawLayerRef.current.set({ width: w, height: h });
      }
    });
    resizeObserver.observe(containerRef.current);

    // Load saved state from localStorage
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.json && typeof data.json === "string") {
          const parsed = JSON.parse(data.json);
          if (parsed.children && Array.isArray(parsed.children)) {
            isUndoRedoRef.current = true;
            drawLayer.set({ children: parsed.children });
            app.tree.forceUpdate();
            isUndoRedoRef.current = false;
            // Rebuild stroke points map from saved data
            strokePointsMap.current.clear();
            if (parsed.strokePoints) {
              for (const [id, pts] of Object.entries(parsed.strokePoints) as [string, number[][]][]) {
                strokePointsMap.current.set(id, pts.map(([x, y]) => ({ x, y })));
              }
            }
            // Rebuild text map
            textMapRef.current.clear();
            for (const child of [...drawLayer.children]) {
              const tid = (child as unknown as { id?: string }).id;
              if (tid && tid.startsWith("text-") && child instanceof Text) {
                textMapRef.current.set(tid, child);
              }
            }
          }
        }
      }
    } catch { /* ignore */ }

    // Push initial snapshot
    undoStackRef.current = [captureSnapshot()];
    redoStackRef.current = [];

    // ---- Pointer events for drawing ----
    const getPoint = (e: PointerEvent | MouseEvent): Pt => {
      const rect = containerRef.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    // 方案 A 配套：变换结束时把 Path 的完整变换（平移/缩放/旋转/skew）
    // 烘焙进 strokePointsMap 的点位，再把 Path 的变换全部归一（identity），
    // 按新画布坐标重建路径。
    // 这样所有笔迹始终满足不变量：Path 固定在 (0,0) 且无缩放/旋转，
    // 点位为画布坐标，笔画擦除时不会因坐标系混用而偏移。
    // 坐标变换委托给 Leafer 的 getWorldPointByLocal(p, drawLayer)，
    // 它内部用 worldTransform 矩阵（含 around 原点），比手写矩阵更可靠。
    const onStrokeDragEnd = () => {
      const editor = app.editor;
      const list = editor?.list;
      if (!list || list.length === 0) return;
      const drawLayer = drawLayerRef.current;
      let changed = false;
      for (const item of [...list]) {
        if (!(item instanceof Path)) continue;
        const id = (item as unknown as { id?: string }).id;
        if (!id) continue;
        const pts = strokePointsMap.current.get(id);
        if (!pts) continue;
        const data = item as unknown as {
          x?: number; y?: number;
          scaleX?: number; scaleY?: number;
          rotation?: number; skewX?: number; skewY?: number;
          strokeWidth?: number;
          set?: (d: Record<string, unknown>) => void;
          path: string;
          getWorldPointByLocal: (
            local: Pt,
            relative?: unknown,
            distance?: boolean,
          ) => Pt;
        };
        // 判断是否有非 identity 变换
        const dx = typeof data.x === "number" ? data.x : 0;
        const dy = typeof data.y === "number" ? data.y : 0;
        const sx = data.scaleX ?? 1;
        const sy = data.scaleY ?? 1;
        const rot = data.rotation ?? 0;
        const skx = data.skewX ?? 0;
        const sky = data.skewY ?? 0;
        if (dx === 0 && dy === 0 && sx === 1 && sy === 1 &&
            rot === 0 && skx === 0 && sky === 0) continue;

        // 用 Leafer 矩阵把每个局部点变换到 drawLayer 局部坐标（== 画布坐标）
        const newPts = pts.map(p => {
          const w = data.getWorldPointByLocal(p, drawLayer, false);
          return { x: w.x, y: w.y };
        });

        // strokeWidth 按缩放平均值烘焙，保持视觉粗细一致
        // （仅影响视觉；笔画擦除命中只看中心线点位，与 strokeWidth 无关）
        const oldSW = data.strokeWidth || 1;
        const newSW = oldSW * (Math.abs(sx) + Math.abs(sy)) / 2;

        const newPathStr = pointsToPathString(newPts, newSW);
        if (data.set) {
          data.set({
            path: newPathStr,
            x: 0, y: 0,
            scaleX: 1, scaleY: 1,
            rotation: 0, skewX: 0, skewY: 0,
            strokeWidth: newSW,
          });
        }
        item.forceUpdate();
        strokePointsMap.current.set(id, newPts);
        changed = true;
      }
      if (changed) {
        editor?.update?.();
        app.tree.forceUpdate();
        pushUndo();
        onContentChange?.();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary || isDrawingRef.current) return;
      const t = toolRef.current;
      const pt = getPoint(e);

      if (t === "select") return;

      if (t === "circle" || t === "rect") {
        shapeStartRef.current = pt;
        return;
      }

      // pen / eraser: start drawing
      isDrawingRef.current = true;
      currentPointsRef.current = [pt];
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      // Eraser cursor
      if (toolRef.current === "eraser") {
        const rect = containerRef.current!.getBoundingClientRect();
        setEraserCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top, show: true });
      }

      // Shape preview
      if (shapeStartRef.current && (toolRef.current === "circle" || toolRef.current === "rect")) {
        const start = shapeStartRef.current;
        const cur = getPoint(e);
        if (shapePreviewRef.current) {
          shapePreviewRef.current.remove();
        }
        const w = cur.x - start.x;
        const h = cur.y - start.y;
        if (toolRef.current === "circle") {
          const cx = start.x + w / 2;
          const cy = start.y + h / 2;
          const rx = Math.abs(w) / 2;
          const ry = Math.abs(h) / 2;
          const shape = new Ellipse({
            x: cx - rx, y: cy - ry,
            width: rx * 2, height: ry * 2,
            stroke: colorRef.current,
            strokeWidth: brushWidthRef.current,
            fill: "",
          });
          shapePreviewRef.current = shape as unknown as UI;
          drawLayer.add(shape);
        } else {
          const shape = new Rect({
            x: Math.min(start.x, cur.x), y: Math.min(start.y, cur.y),
            width: Math.abs(w), height: Math.abs(h),
            stroke: colorRef.current,
            strokeWidth: brushWidthRef.current,
            fill: "",
          });
          shapePreviewRef.current = shape as unknown as UI;
          drawLayer.add(shape);
        }
        return;
      }

      if (!isDrawingRef.current) return;
      const t = toolRef.current;
      if (t !== "pen" && t !== "eraser") return;

      const pt = getPoint(e);
      const last = currentPointsRef.current[currentPointsRef.current.length - 1];
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 0.5) return;
      currentPointsRef.current.push(pt);

      // Pen: update live preview path
      if (t === "pen") {
        if (currentPathRef.current) {
          currentPathRef.current.remove();
        }
        const isHighlighter = brushStyleRef.current === "highlighter";
        const w = isHighlighter ? Math.max(brushWidthRef.current * 3, 12) : brushWidthRef.current;
        const pathStr = pointsToPathString(currentPointsRef.current, w);
        const strokeColor = isHighlighter
          ? `${colorRef.current}55`
          : brushStyleRef.current === "pencil"
            ? `${colorRef.current}88`
            : colorRef.current;
        const path = new Path({
          x: 0,
          y: 0,
          path: pathStr,
          stroke: strokeColor,
          strokeWidth: w,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          fill: "",
          hittable: false,
          opacity: isHighlighter ? 0.5 : 1,
        });
        currentPathRef.current = path;
        drawLayer.add(path);
      }

      // Eraser: show light gray semi-transparent capsule preview (no actual erasing during drag)
      if (t === "eraser") {
        if (eraserPreviewRef.current) {
          eraserPreviewRef.current.remove();
        }
        const pathStr = pointsToPathString(currentPointsRef.current, eraserWidthRef.current);
        if (pathStr) {
          const preview = new Path({
            x: 0,
            y: 0,
            path: pathStr,
            stroke: eraserTrailColorRef.current,
            strokeWidth: eraserWidthRef.current,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            fill: "",
            hittable: false,
            opacity: eraserTrailOpacityRef.current,
          });
          eraserPreviewRef.current = preview;
          drawLayer.add(preview);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      // Finalize shape
      if (shapeStartRef.current && (toolRef.current === "circle" || toolRef.current === "rect")) {
        shapeStartRef.current = null;
        if (shapePreviewRef.current) {
          (shapePreviewRef.current as unknown as { hittable: boolean }).hittable = true;
          (shapePreviewRef.current as unknown as { draggable: boolean }).draggable = false;
          shapePreviewRef.current = null;
          pushUndo();
          onContentChange?.();
        }
        return;
      }

      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      const t = toolRef.current;
      const pts = currentPointsRef.current;

      if (t === "pen") {
        // Replace preview with permanent stroke
        if (currentPathRef.current) {
          currentPathRef.current.remove();
          currentPathRef.current = null;
        }
        const isHighlighter = brushStyleRef.current === "highlighter";
        const strokeColor = isHighlighter
          ? `${colorRef.current}55`
          : brushStyleRef.current === "pencil"
            ? `${colorRef.current}88`
            : colorRef.current;
        const w = isHighlighter ? Math.max(brushWidthRef.current * 3, 12) : brushWidthRef.current;
        if (pts.length > 1) {
          createStrokePath(pts, strokeColor, w, isHighlighter ? 0.5 : 1);
          pushUndo();
          onContentChange?.();
        }
      } else if (t === "eraser") {
        // Remove the light gray preview trail
        if (eraserPreviewRef.current) {
          eraserPreviewRef.current.remove();
          eraserPreviewRef.current = null;
        }
        // 笔画擦除：删除橡皮触碰到的整条笔画
        if (pts.length > 0) {
          const eraserRadius = eraserWidthRef.current / 2;
          eraseStrokes(pts, eraserRadius);
          pushUndo();
          onContentChange?.();
        }
      }

      currentPointsRef.current = [];
      currentPathRef.current = null;
      eraserPreviewRef.current = null;
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Delete selected element on Backspace/Delete (skip while editing text)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      // Don't intercept while typing in a text editor or input field
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const editor = app.editor;
      const list = editor?.list;
      if (!list || list.length === 0) return;
      e.preventDefault();
      for (const item of [...list]) {
        const id = (item as unknown as { id?: string }).id;
        if (id) strokePointsMap.current.delete(id);
        if (id && textMapRef.current.has(id)) textMapRef.current.delete(id);
        item.remove();
      }
      editor.target = undefined;
      pushUndo();
      onContentChange?.();
    };

    // ---- Double-click to create/edit text using HTML overlay ----
    const onDblClick = (e: MouseEvent) => {
      const layer = drawLayerRef.current;
      const app = appRef.current;
      if (!layer) return;
      // Clear any Leafer editor selection to prevent conflicts
      if (app?.editor) {
        app.editor.target = undefined;
      }
      const pt = getPoint(e);

      // Check if double-clicking on an existing text element
      // Try to find a text element near the click point
      let foundText: { id: string; text: string; x: number; y: number } | null = null;
      for (const [tid, textEl] of textMapRef.current) {
        const tx = (textEl as unknown as { x: number }).x;
        const ty = (textEl as unknown as { y: number }).y;
        const tw = (textEl as unknown as { width: number }).width || 100;
        const th = (textEl as unknown as { height: number }).height || fontSizeRef.current;
        // Check if click is within text bounds (with some padding)
        if (pt.x >= tx - 4 && pt.x <= tx + tw + 4 && pt.y >= ty - 4 && pt.y <= ty + th + 4) {
          foundText = { id: tid, text: textEl.text || "", x: tx, y: ty };
          break;
        }
      }

      if (foundText) {
        // Edit existing text: align x to left, keep y, use current full width
        startTextEditing(TEXT_LEFT_MARGIN, foundText.y, getTextWidth(), foundText.id, foundText.text);
      } else {
        // Create new text at first row (top, y=8), full page width
        startTextEditing(TEXT_LEFT_MARGIN, TEXT_FIRST_ROW, getTextWidth());
      }
    };

    const el = containerRef.current;
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("contextmenu", onContextMenu);
    el.addEventListener("dblclick", onDblClick);
    window.addEventListener("keydown", onKeyDown);
    // 编辑器拖动平移结束（MoveEvent.END）与缩放/旋转拖动结束（DragEvent.END）
    // 都会冒泡到 app；在此时合并位移，保证笔迹不变量。
    // 操作幂等：合并后 x/y 归零，重复触发不会二次位移。
    app.on(LeaferMoveEvent.END, onStrokeDragEnd);
    app.on(LeaferDragEvent.END, onStrokeDragEnd);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("contextmenu", onContextMenu);
      el.removeEventListener("dblclick", onDblClick);
      window.removeEventListener("keydown", onKeyDown);
      app.off(LeaferMoveEvent.END, onStrokeDragEnd);
      app.off(LeaferDragEvent.END, onStrokeDragEnd);
      resizeObserver.disconnect();
      app.destroy();
      appRef.current = null;
      drawLayerRef.current = null;
      strokePointsMap.current.clear();
      textMapRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // ---- Auto-focus the text overlay when it appears ----
  useEffect(() => {
    if (textOverlay && overlayRef.current) {
      const ta = overlayRef.current;
      // Focus and place cursor at end
      ta.focus();
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
    }
  }, [textOverlay]);

  // ---- Tool mode switching ----
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const canDrag = tool === "select";
    app.editor.hittable = canDrag;
    app.tree.hittable = canDrag;
    // Prevent Leafer's internal text editor from opening (we use HTML overlay instead)
    const editorConfig = (app.editor as unknown as { config?: Record<string, unknown> }).config;
    if (editorConfig) {
      editorConfig.preventEditInner = true;
    }
    for (const child of drawLayerRef.current?.children || []) {
      // Text elements are never draggable
      const isText = (child as unknown as { tag?: string }).tag === "Text";
      (child as unknown as { draggable: boolean }).draggable = canDrag && !isText;
    }
    if (!canDrag) {
      app.editor.target = undefined;
    }
  }, [tool]);

  // ---- Eraser cursor hide on mouse leave ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onLeave = () => setEraserCursor((s) => ({ ...s, show: false }));
    el.addEventListener("mouseleave", onLeave);
    return () => el.removeEventListener("mouseleave", onLeave);
  }, []);

  // ---- Imperative handle ----
  useImperativeHandle(ref, (): LeaferCanvasHandle => ({
    exportJSON: () => {
      const layer = drawLayerRef.current;
      if (!layer) return "{}";
      const json = layer.toJSON() as { children?: unknown[] };
      const strokePoints: Record<string, number[][]> = {};
      for (const [id, pts] of strokePointsMap.current) {
        strokePoints[id] = pts.map(p => [p.x, p.y]);
      }
      return JSON.stringify({ ...json, strokePoints });
    },
    importJSON: (json: string) => {
      const layer = drawLayerRef.current;
      if (!layer) return;
      try {
        const parsed = JSON.parse(json);
        const { strokePoints, ...layerJson } = parsed;
        isUndoRedoRef.current = true;
        layer.removeAll(true);
        layer.set({ children: layerJson.children || [] });
        appRef.current?.tree.forceUpdate();
        isUndoRedoRef.current = false;
        // Rebuild stroke points map
        strokePointsMap.current.clear();
        if (strokePoints) {
          for (const [id, pts] of Object.entries(strokePoints) as [string, number[][]][]) {
            strokePointsMap.current.set(id, pts.map(([x, y]) => ({ x, y })));
          }
        }
        // Rebuild text map
        textMapRef.current.clear();
        for (const child of [...(layer.children || [])]) {
          const tid = (child as unknown as { id?: string }).id;
          if (tid && tid.startsWith("text-") && child instanceof Text) {
            textMapRef.current.set(tid, child);
          }
        }
        undoStackRef.current = [captureSnapshot()];
        redoStackRef.current = [];
        onContentChange?.();
      } catch { /* ignore */ }
    },
    exportImage: (filename = "note.png") => {
      const app = appRef.current;
      if (!app) return;
      app.tree.export(filename, { pixelRatio: 2 });
    },
    undo: () => {
      if (undoStackRef.current.length <= 1) return;
      const current = undoStackRef.current.pop()!;
      redoStackRef.current.push(current);
      const prev = undoStackRef.current[undoStackRef.current.length - 1];
      if (prev) restoreSnapshot(prev);
    },
    redo: () => {
      if (redoStackRef.current.length === 0) return;
      const next = redoStackRef.current.pop()!;
      undoStackRef.current.push(next);
      restoreSnapshot(next);
    },
    clear: () => {
      const layer = drawLayerRef.current;
      if (!layer) return;
      pushUndo();
      layer.removeAll(true);
      strokePointsMap.current.clear();
      textMapRef.current.clear();
      appRef.current?.editor && (appRef.current.editor.target = undefined);
      appRef.current?.tree.forceUpdate();
      onContentChange?.();
    },
    setBackground: (bgColor: string) => {
      backgroundRef.current = bgColor;
      if (appRef.current) {
        appRef.current.tree.set({ fill: bgColor });
      }
    },
    addTextAtCenter: () => {
      const layer = drawLayerRef.current;
      if (!layer) return;
      startTextEditing(TEXT_LEFT_MARGIN, TEXT_FIRST_ROW, getTextWidth());
    },
  }), [captureSnapshot, restoreSnapshot, pushUndo, onContentChange, startTextEditing]);

  return (
    <div className="relative h-full w-full touch-none select-none">
      <div
        ref={containerRef}
        className="h-full w-full touch-none select-none"
        style={{
          cursor: tool === "eraser" ? "none" : tool === "select" ? "default" : "crosshair",
          touchAction: "none",
          userSelect: "none",
        }}
      />
      {tool === "eraser" && eraserCursor.show && (
        <div
          className="pointer-events-none absolute rounded-full border-2 border-[#5f7890]/60 bg-[#5f7890]/10"
          style={{
            width: `${eraserWidth}px`,
            height: `${eraserWidth}px`,
            left: `${eraserCursor.x - eraserWidth / 2}px`,
            top: `${eraserCursor.y - eraserWidth / 2}px`,
          }}
        />
      )}
      {/* Text editing overlay: transparent textarea, no border, looks like typing on canvas */}
      {textOverlay && (
        <textarea
          ref={overlayRef}
          value={textOverlay.text}
          onChange={(e) => {
            const val = e.target.value;
            setTextOverlay((prev) => {
              const next = prev ? { ...prev, text: val } : null;
              textOverlayRef.current = next;
              return next;
            });
          }}
          onBlur={finishTextEditing}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              finishTextEditing();
            }
            // Enter now inserts a new line (like a document)
            // Use Ctrl+Enter to finish editing
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              finishTextEditing();
            }
          }}
          className="absolute z-50 resize-none overflow-hidden border-none bg-transparent outline-none"
          style={{
            left: `${textOverlay.x}px`,
            top: `${textOverlay.y}px`,
            width: `${textOverlay.width}px`,
            color: color,
            fontSize: `${fontSize}px`,
            fontFamily: "inherit",
            lineHeight: "1.3",
            minHeight: `${fontSize * 1.3}px`,
            padding: "0",
            margin: "0",
            caretColor: color,
            boxShadow: "none",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflow: "hidden",
          }}
          autoFocus
        />
      )}
    </div>
  );
});
