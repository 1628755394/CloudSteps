import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type NoteSide = "left" | "right";

export function useSplitScreenNote(storageKey: string) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<NoteSide>("right");
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return 420;
    const maxWidth = Math.max(200, window.innerWidth - 320);
    try {
      const stored = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(stored)) return Math.min(maxWidth, Math.max(200, stored));
    } catch {
      return Math.min(420, maxWidth);
    }
    return Math.min(420, maxWidth);
  });
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024,
  );
  const cleanupResizeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const onResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      const maxWidth = Math.max(200, window.innerWidth - 320);
      setWidth((current) => Math.min(current, maxWidth));
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cleanupResizeRef.current?.();
      cleanupResizeRef.current = null;
    };
  }, []);

  const startResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    cleanupResizeRef.current?.();
    const startX = event.clientX;
    const startWidth = width;
    let latestWidth = startWidth;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (cleanupResizeRef.current === cleanup) cleanupResizeRef.current = null;
    };
    const onMove = (nextEvent: PointerEvent) => {
      nextEvent.preventDefault();
      const delta = nextEvent.clientX - startX;
      const maxWidth = Math.max(200, window.innerWidth - 320);
      const nextWidth = Math.min(maxWidth, Math.max(200, startWidth + (side === "right" ? -delta : delta)));
      latestWidth = nextWidth;
      setWidth(nextWidth);
    };
    const onUp = () => {
      cleanup();
      try {
        localStorage.setItem(storageKey, String(latestWidth));
      } catch {
        return;
      }
    };

    cleanupResizeRef.current = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [side, storageKey, width]);

  return {
    open,
    setOpen,
    side,
    setSide,
    width,
    isDesktop,
    startResize,
  };
}
