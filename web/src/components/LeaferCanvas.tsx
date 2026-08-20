import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import { App, Group, Path, Text, Rect, Ellipse, UI } from "leafer-ui";
import "@leafer-in/editor";
import "@leafer-in/text-editor";
import "@leafer-in/export";

// ---- Types ----
export type Tool = "select" | "pen" | "eraser" | "highlighter" | "circle" | "rect" | "text";

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
  brushStyle: "fountain" | "pencil";
  background: string;
  fontSize: number;
  storageKey: string;
  onBlankClick?: () => void;
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

// ---- Geometry helpers for precision eraser ----

// Distance from point P to line segment (A, B)
function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// Minimum distance from point P to a polyline (list of points)
function minDistToPolyline(p: Pt, points: Pt[]): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return Math.hypot(p.x - points[0].x, p.y - points[0].y);
  let min = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distToSegment(p, points[i], points[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

// Bounding box of a point list
function getPointsBounds(points: Pt[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Check if two axis-aligned bounding boxes intersect
function boundsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// Densify a polyline: insert interpolated points so no gap exceeds maxGap
function densifyPoints(points: Pt[], maxGap: number): Pt[] {
  if (points.length <= 1) return [...points];
  const result: Pt[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    const steps = Math.max(1, Math.ceil(d / maxGap));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      result.push({
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      });
    }
  }
  return result;
}

// Binary search for the exact point on segment (p1→p2) where dist to eraser == radius.
// p1 is outside (dist > radius), p2 is inside (dist < radius).
function findCutPoint(p1: Pt, p2: Pt, eraserPoints: Pt[], radius: number): Pt {
  let lo = 0, hi = 1;
  for (let iter = 0; iter < 15; iter++) {
    const mid = (lo + hi) / 2;
    const px = p1.x + (p2.x - p1.x) * mid;
    const py = p1.y + (p2.y - p1.y) * mid;
    if (minDistToPolyline({ x: px, y: py }, eraserPoints) < radius) hi = mid;
    else lo = mid;
  }
  const t = (lo + hi) / 2;
  return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
}

// ---- Undo/Redo stack ----
interface Snapshot {
  children: unknown[];
  strokePoints: Record<string, number[][]>;
}

export const LeaferCanvas = forwardRef<LeaferCanvasHandle, Props>(function LeaferCanvas(
  { tool, color, brushWidth, eraserWidth, brushStyle, background, fontSize, storageKey, onBlankClick, onContentChange },
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
      draggable: true,
      opacity,
    });
    drawLayerRef.current?.add(path);
    strokePointsMap.current.set(id, pts);
    return path;
  }, []);

  // ---- Precision eraser: path boolean difference ----
  // Only erases the geometrically overlapping portion of strokes.
  // Strokes that don't intersect the eraser capsule are left completely untouched.
  const eraseStrokes = useCallback((eraserPoints: Pt[], eraserRadius: number) => {
    const layer = drawLayerRef.current;
    if (!layer || eraserPoints.length === 0) return;

    // Compute eraser capsule bounding box (expanded by radius)
    const eraserBounds = getPointsBounds(eraserPoints);
    const expandedEraserBounds = {
      x: eraserBounds.x - eraserRadius,
      y: eraserBounds.y - eraserRadius,
      width: eraserBounds.width + eraserRadius * 2,
      height: eraserBounds.height + eraserRadius * 2,
    };

    // Copy children since we'll modify the list
    const children = [...layer.children];

    for (const child of children) {
      if (!(child instanceof Path)) continue;
      const pathId = (child as unknown as { id?: string }).id;
      if (!pathId || !strokePointsMap.current.has(pathId)) continue;

      const originalPoints = strokePointsMap.current.get(pathId)!;

      // Bounding box filter (performance): skip strokes that can't possibly intersect
      const strokeBounds = getPointsBounds(originalPoints);
      // Expand stroke bounds by half stroke width for safety
      const sw = (child as unknown as { strokeWidth?: number }).strokeWidth || 1;
      const expandedStrokeBounds = {
        x: strokeBounds.x - sw / 2,
        y: strokeBounds.y - sw / 2,
        width: strokeBounds.width + sw,
        height: strokeBounds.height + sw,
      };
      if (!boundsIntersect(expandedStrokeBounds, expandedEraserBounds)) continue;

      // Densify stroke points to prevent missing thin eraser intersections
      const densified = densifyPoints(originalPoints, eraserRadius / 3);

      // Check each densified point: is it inside the eraser capsule?
      const erased: boolean[] = densified.map(p =>
        minDistToPolyline(p, eraserPoints) < eraserRadius,
      );

      // Split into segments with cut-point interpolation for clean cuts
      const segments: Pt[][] = [];
      let current: Pt[] = [];

      if (!erased[0]) {
        current.push(densified[0]);
      }

      for (let i = 1; i < densified.length; i++) {
        if (!erased[i] && !erased[i - 1]) {
          current.push(densified[i]);
        } else if (!erased[i] && erased[i - 1]) {
          // Transition from erased to non-erased: add cut point
          const cut = findCutPoint(densified[i - 1], densified[i], eraserPoints, eraserRadius);
          current = [cut, densified[i]];
        } else if (erased[i] && !erased[i - 1]) {
          // Transition from non-erased to erased: add cut point, close segment
          const cut = findCutPoint(densified[i - 1], densified[i], eraserPoints, eraserRadius);
          current.push(cut);
          if (current.length >= 2) segments.push(current);
          current = [];
        }
      }
      if (current.length >= 2) segments.push(current);

      // If nothing was erased, skip this stroke entirely
      if (segments.length === 1 && segments[0].length === densified.length) continue;
      // If no segments remain, the entire stroke was erased
      if (segments.length === 0) {
        child.remove();
        strokePointsMap.current.delete(pathId);
        continue;
      }

      // Get original style for new segments
      const strokeColor = (child as unknown as { stroke?: string }).stroke || "#000";
      const strokeWidth = (child as unknown as { strokeWidth?: number }).strokeWidth || 1;
      const opacity = (child as unknown as { opacity?: number }).opacity ?? 1;

      // Update the first segment in-place on the existing path element
      // This preserves the element's identity and prevents position shifts
      const firstSeg = segments[0];
      const firstPathStr = pointsToPathString(firstSeg, strokeWidth);
      (child as unknown as { path: string }).path = firstPathStr;
      strokePointsMap.current.set(pathId, firstSeg);

      // Create new Path elements for any additional segments
      for (let si = 1; si < segments.length; si++) {
        const seg = segments[si];
        if (seg.length < 2) continue;
        createStrokePath(seg, strokeColor, strokeWidth, opacity);
      }
    }
  }, [createStrokePath]);

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
    const drawLayer = new Group({ name: "drawLayer", x: 0, y: 0, width: cw, height: ch });
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

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 2) return;
      const t = toolRef.current;
      const pt = getPoint(e);

      if (t === "select") {
        const target = app.editor?.list?.[0];
        if (!target) {
          setTimeout(() => {
            if (!app.editor?.list?.length) onBlankClick?.();
          }, 0);
        }
        return;
      }

      if (t === "text") {
        // Add text at center of visible canvas area
        const cw = containerRef.current!.clientWidth;
        const ch = containerRef.current!.clientHeight;
        const text = new Text({
          text: "双击编辑文字",
          x: cw / 2 - 80,
          y: ch / 2 - fontSizeRef.current / 2,
          fill: colorRef.current,
          fontSize: fontSizeRef.current,
          editable: true,
          draggable: true,
        });
        drawLayer.add(text);
        pushUndo();
        onContentChange?.();
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

      // pen / highlighter / eraser: start drawing
      isDrawingRef.current = true;
      currentPointsRef.current = [pt];
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
          x: 0,
          y: 0,
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
            stroke: "rgba(120, 130, 145, 0.25)",
            strokeWidth: eraserWidthRef.current,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            fill: "",
            hittable: false,
            opacity: 0.6,
          });
          eraserPreviewRef.current = preview;
          drawLayer.add(preview);
        }
      }
    };

    const onPointerUp = () => {
      // Finalize shape
      if (shapeStartRef.current && (toolRef.current === "circle" || toolRef.current === "rect")) {
        shapeStartRef.current = null;
        if (shapePreviewRef.current) {
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
        // Replace preview with permanent stroke
        if (currentPathRef.current) {
          currentPathRef.current.remove();
          currentPathRef.current = null;
        }
        const strokeColor = t === "highlighter"
          ? (colorRef.current.length === 7 ? `${colorRef.current}55` : colorRef.current)
          : (brushStyleRef.current === "pencil" ? `${colorRef.current}88` : colorRef.current);
        const w = t === "highlighter" ? Math.max(brushWidthRef.current * 3, 12) : brushWidthRef.current;
        const opacity = t === "highlighter" ? 0.5 : 1;
        createStrokePath(pts, strokeColor, w, opacity);
        pushUndo();
        onContentChange?.();
      } else if (t === "eraser") {
        // Remove the light gray preview trail
        if (eraserPreviewRef.current) {
          eraserPreviewRef.current.remove();
          eraserPreviewRef.current = null;
        }
        // Execute precision erasure: only erases geometrically overlapping portions
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
    el.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
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
    if (tool === "select") {
      app.editor.hittable = true;
      app.tree.hittable = true;
    } else {
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
      layer.removeAll(true);
      strokePointsMap.current.clear();
      pushUndo();
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
      const container = containerRef.current;
      if (!app || !layer || !container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const text = new Text({
        text: "双击编辑文字",
        x: cw / 2 - 80,
        y: ch / 2 - fontSizeRef.current / 2,
        fill: colorRef.current,
        fontSize: fontSizeRef.current,
        editable: true,
        draggable: true,
      });
      layer.add(text);
      pushUndo();
      onContentChange?.();
      app.editor.target = text;
      setTimeout(() => {
        (text as unknown as { textEditor?: { enter: () => void } }).textEditor?.enter();
      }, 50);
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
