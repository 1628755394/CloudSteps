import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";

type NoteSide = "left" | "right";

export function useSplitScreenNote(storageKey: string) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<NoteSide>("right");
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return 420;
    try {
      const stored = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(stored)) return Math.max(200, stored);
    } catch {
      return 420;
    }
    return 420;
  });
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024,
  );

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const startResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = width;
    let latestWidth = startWidth;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";

    const onMove = (nextEvent: PointerEvent) => {
      nextEvent.preventDefault();
      const delta = nextEvent.clientX - startX;
      const nextWidth = Math.max(200, startWidth + (side === "right" ? -delta : delta));
      latestWidth = nextWidth;
      setWidth(nextWidth);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      try {
        localStorage.setItem(storageKey, String(latestWidth));
      } catch {
        return;
      }
    };

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
