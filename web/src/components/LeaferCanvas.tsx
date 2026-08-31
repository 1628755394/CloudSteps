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
  const [eraserCursor, setEraserCursor] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });

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
    onContentChange?.();
  }, [onContentChange]);

  // ---- Create a stroke Path from points and register in map ----
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

      if (t === "text") {
        // Add text at top-left, no visible border, double-click to edit
        const text = new Text({
          text: "",
          x: 16,
          y: 8,
          fill: colorRef.current,
          fontSize: fontSizeRef.current,
          editable: true,
          draggable: true,
        });
        drawLayer.add(text);
        pushUndo();
        onContentChange?.();
        // Double-click to enter edit mode
        text.on("dblclick", () => {
          app.editor.target = text;
          (text as unknown as { textEditor?: { enter: () => void } }).textEditor?.enter();
        });
        // Enter edit mode immediately for typing
        app.editor.target = text;
        setTimeout(() => {
          (text as unknown as { textEditor?: { enter: () => void } }).textEditor?.enter();
        }, 50);
        return;
      }

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
        item.remove();
      }
      editor.target = undefined;
      pushUndo();
      onContentChange?.();
    };

    const el = containerRef.current;
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown);

    // Double-click on canvas to create text at that position and start typing
    const onDblClick = (e: MouseEvent) => {
      const app = appRef.current;
      const layer = drawLayerRef.current;
      if (!app || !layer) return;
      // Only create new text when double-clicking empty canvas area (not existing text)
      if (e.target !== el) return;
      const pt = getPoint(e as unknown as PointerEvent);
      const text = new Text({
        text: "",
        x: pt.x,
        y: pt.y,
        fill: colorRef.current,
        fontSize: fontSizeRef.current,
        editable: true,
        draggable: true,
      });
      layer.add(text);
      pushUndo();
      onContentChange?.();
      text.on("dblclick", () => {
        app.editor.target = text;
        (text as unknown as { textEditor?: { enter: () => void } }).textEditor?.enter();
      });
      app.editor.target = text;
      setTimeout(() => {
        (text as unknown as { textEditor?: { enter: () => void } }).textEditor?.enter();
      }, 50);
    };
    el.addEventListener("dblclick", onDblClick);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // ---- Tool mode switching ----
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const canDrag = tool === "select";
    app.editor.hittable = canDrag;
    app.tree.hittable = canDrag;
    for (const child of drawLayerRef.current?.children || []) {
      const isText = (child as unknown as { tag?: string }).tag === "Text";
      // Text elements are always hittable/draggable for double-click editing
      (child as unknown as { draggable: boolean }).draggable = canDrag || isText;
      (child as unknown as { hittable: boolean }).hittable = true;
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
      const app = appRef.current;
      const layer = drawLayerRef.current;
      if (!app || !layer) return;
      const text = new Text({
        text: "",
        x: 16,
        y: 8,
        fill: colorRef.current,
        fontSize: fontSizeRef.current,
        editable: true,
        draggable: true,
      });
      layer.add(text);
      pushUndo();
      onContentChange?.();
      // Double-click to edit
      text.on("dblclick", () => {
        app.editor.target = text;
        (text as unknown as { textEditor?: { enter: () => void } }).textEditor?.enter();
      });
      // Enter edit mode immediately for typing
      app.editor.target = text;
      setTimeout(() => {
        (text as unknown as { textEditor?: { enter: () => void } }).textEditor?.enter();
      }, 50);
    },
  }), [captureSnapshot, restoreSnapshot, pushUndo, onContentChange]);

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
    </div>
  );
});
