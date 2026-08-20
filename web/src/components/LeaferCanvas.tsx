import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import { App, Group, Path, Pen, Text, Rect, Ellipse, UI } from "leafer-ui";
import "@leafer-in/editor";
import "@leafer-in/text-editor";
import "@leafer-in/export";

// ---- Types ----
export type Tool = "select" | "pen" | "highlighter" | "eraser" | "circle" | "rect" | "text";

export interface LeaferCanvasHandle {
  exportJSON: () => string;
  importJSON: (json: string) => void;
  exportImage: (filename?: string) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  setBackground: (color: string) => void;
}

interface Props {
  tool: Tool;
  color: string;
  brushWidth: number;
  eraserWidth: number;
  brushStyle: "fountain" | "pencil";
  background: string;
  fontSize: number;
  storageKey: string;
  onBlankClick?: () => void;
  onContentChange?: () => void;
}

// ---- Stroke smoothing: Catmull-Rom to Bezier ----
function pointsToPathString(points: { x: number; y: number }[], width: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    // Single point: draw a dot
    const r = width / 2;
    return `M ${points[0].x - r} ${points[0].y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    // Catmull-Rom to Bezier conversion
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
}

export const LeaferCanvas = forwardRef<LeaferCanvasHandle, Props>(function LeaferCanvas(
  { tool, color, brushWidth, eraserWidth, brushStyle, background, fontSize, storageKey, onBlankClick, onContentChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<App | null>(null);
  const drawLayerRef = useRef<Group | null>(null);
  const eraserGroupRef = useRef<Group | null>(null);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);
  const currentPathRef = useRef<Path | null>(null);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const shapePreviewRef = useRef<UI | null>(null);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const brushWidthRef = useRef(brushWidth);
  const eraserWidthRef = useRef(eraserWidth);
  const brushStyleRef = useRef(brushStyle);
  const fontSizeRef = useRef(fontSize);
  const backgroundRef = useRef(background);
  const isUndoRedoRef = useRef(false);
  const undoStackRef = useRef<Snapshot[]>([]);
  const redoStackRef = useRef<Snapshot[]>([]);
  const [eraserCursor, setEraserCursor] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });

  // Keep refs in sync
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { brushWidthRef.current = brushWidth; }, [brushWidth]);
  useEffect(() => { eraserWidthRef.current = eraserWidth; }, [eraserWidth]);
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
    if (!layer) return { children: [] };
    const json = layer.toJSON();
    return { children: (json as { children?: unknown[] }).children || [] };
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
    onContentChange?.();
  }, [onContentChange]);

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

    // Draw layer: holds all pen strokes, shapes, text
    const drawLayer = new Group({ name: "drawLayer" });
    app.tree.add(drawLayer);
    drawLayerRef.current = drawLayer;

    // Eraser layer: a Group with eraser children that clip the draw layer
    // We use a separate approach: eraser paths are added to the draw layer's
    // parent group with eraser=true, clipping the draw layer below.
    const eraserGroup = new Group({ name: "eraserGroup" });
    app.tree.add(eraserGroup);
    eraserGroupRef.current = eraserGroup;

    // Load saved state from localStorage (fallback from old fabric data)
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
          }
        }
      }
    } catch { /* ignore */ }

    // Push initial snapshot
    undoStackRef.current = [captureSnapshot()];
    redoStackRef.current = [];

    // ---- Pointer events for drawing ----
    const getPoint = (e: PointerEvent | MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 2) return; // right click
      const t = toolRef.current;
      const pt = getPoint(e);

      if (t === "select") {
        // Let editor handle selection; if blank, notify
        const target = app.editor?.list?.[0];
        if (!target) {
          // Will check after editor processes the click
          setTimeout(() => {
            if (!app.editor?.list?.length) onBlankClick?.();
          }, 0);
        }
        return;
      }

      if (t === "text") {
        const text = new Text({
          text: "双击编辑文字",
          x: pt.x,
          y: pt.y,
          fill: colorRef.current,
          fontSize: fontSizeRef.current,
          editable: true,
          draggable: true,
        });
        drawLayer.add(text);
        pushUndo();
        onContentChange?.();
        app.editor.target = text;
        // Enter text editing
        setTimeout(() => {
          (text as unknown as { textEditor?: { enter: () => void } }).textEditor?.enter();
        }, 50);
        return;
      }

      if (t === "circle" || t === "rect") {
        shapeStartRef.current = pt;
        return;
      }

      // pen / highlighter / eraser: start drawing
      isDrawingRef.current = true;
      currentPointsRef.current = [pt];
      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      // Eraser cursor
      if (toolRef.current === "eraser") {
        const pt = getPoint(e);
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
      if (t !== "pen" && t !== "highlighter" && t !== "eraser") return;

      const pt = getPoint(e);
      currentPointsRef.current.push(pt);

      // For pen/highlighter: update live preview path
      if (t === "pen" || t === "highlighter") {
        if (currentPathRef.current) {
          currentPathRef.current.remove();
        }
        const pathStr = pointsToPathString(currentPointsRef.current, brushWidthRef.current);
        const strokeColor = t === "highlighter"
          ? (colorRef.current.length === 7 ? `${colorRef.current}55` : colorRef.current)
          : (brushStyleRef.current === "pencil" ? `${colorRef.current}88` : colorRef.current);
        const w = t === "highlighter" ? Math.max(brushWidthRef.current * 3, 12) : brushWidthRef.current;
        const path = new Path({
          path: pathStr,
          stroke: strokeColor,
          strokeWidth: w,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          fill: "",
          hittable: false,
        });
        currentPathRef.current = path;
        drawLayer.add(path);
      }
      // Eraser: no preview, just collect points
    };

    const onPointerUp = (e: PointerEvent) => {
      // Finalize shape
      if (shapeStartRef.current && (toolRef.current === "circle" || toolRef.current === "rect")) {
        shapeStartRef.current = null;
        if (shapePreviewRef.current) {
          // Make it permanent
          (shapePreviewRef.current as unknown as { hittable: boolean }).hittable = true;
          (shapePreviewRef.current as unknown as { draggable: boolean }).draggable = true;
          shapePreviewRef.current = null;
          pushUndo();
          onContentChange?.();
        }
        return;
      }

      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      const t = toolRef.current;
      const pts = currentPointsRef.current;

      if (t === "pen" || t === "highlighter") {
        // Replace preview with permanent path
        if (currentPathRef.current) {
          currentPathRef.current.remove();
          currentPathRef.current = null;
        }
        const pathStr = pointsToPathString(pts, brushWidthRef.current);
        if (pathStr) {
          const strokeColor = t === "highlighter"
            ? (colorRef.current.length === 7 ? `${colorRef.current}55` : colorRef.current)
            : (brushStyleRef.current === "pencil" ? `${colorRef.current}88` : colorRef.current);
          const w = t === "highlighter" ? Math.max(brushWidthRef.current * 3, 12) : brushWidthRef.current;
          const path = new Path({
            path: pathStr,
            stroke: strokeColor,
            strokeWidth: w,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            fill: "",
            draggable: true,
          });
          drawLayer.add(path);
          pushUndo();
          onContentChange?.();
        }
      } else if (t === "eraser") {
        // Create eraser path: add to a group that clips the draw layer
        if (pts.length > 0) {
          const pathStr = pointsToPathString(pts, eraserWidthRef.current);
          if (pathStr) {
            // Use the eraser property: add an eraser path to the draw layer's group
            // The eraser path clips everything below it in the same group
            const eraserPath = new Path({
              path: pathStr,
              stroke: "rgba(0,0,0,1)",
              strokeWidth: eraserWidthRef.current,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              fill: "",
              eraser: "path" as const,
              hittable: false,
            });
            drawLayer.add(eraserPath);
            pushUndo();
            onContentChange?.();
          }
        }
      }

      currentPointsRef.current = [];
      currentPathRef.current = null;
    };

    const onContextMenu = (e: MouseEvent) => {
      // Allow right-click on text for editing
      e.preventDefault();
    };

    const el = containerRef.current;
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("contextmenu", onContextMenu);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("contextmenu", onContextMenu);
      app.destroy();
      appRef.current = null;
      drawLayerRef.current = null;
      eraserGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // ---- Tool mode switching ----
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    if (tool === "select") {
      app.editor.hittable = true;
      app.tree.hittable = true;
    } else {
      // Disable editor selection in drawing modes
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
      const json = layer.toJSON();
      return JSON.stringify(json);
    },
    importJSON: (json: string) => {
      const layer = drawLayerRef.current;
      if (!layer) return;
      try {
        const parsed = JSON.parse(json);
        isUndoRedoRef.current = true;
        layer.removeAll(true);
        layer.set({ children: parsed.children || [] });
        appRef.current?.tree.forceUpdate();
        isUndoRedoRef.current = false;
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
      layer.removeAll(true);
      pushUndo();
      onContentChange?.();
    },
    setBackground: (bgColor: string) => {
      backgroundRef.current = bgColor;
      if (appRef.current) {
        appRef.current.tree.set({ fill: bgColor });
      }
    },
  }), [captureSnapshot, restoreSnapshot, pushUndo, onContentChange]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ cursor: tool === "eraser" ? "none" : tool === "select" ? "default" : "crosshair" }}
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
