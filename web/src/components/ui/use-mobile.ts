import * as React from "react";

/** 与 Layout 的 `lg`（1024）对齐：出现 H5 底栏时即用原生选择器 */
const MOBILE_BREAKPOINT = 1024;

function readIsMobile() {
  if (typeof window === "undefined") return false;
  const narrow = window.innerWidth < MOBILE_BREAKPOINT;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const touch = navigator.maxTouchPoints > 0 && narrow;
  return narrow || coarse || touch;
}

/** 视口宽度 < 1024 或粗指针视为 H5 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(readIsMobile);

  React.useEffect(() => {
    const mqlWidth = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const mqlPointer = window.matchMedia("(pointer: coarse)");
    const onChange = () => setIsMobile(readIsMobile());
    mqlWidth.addEventListener("change", onChange);
    mqlPointer.addEventListener("change", onChange);
    setIsMobile(readIsMobile());
    return () => {
      mqlWidth.removeEventListener("change", onChange);
      mqlPointer.removeEventListener("change", onChange);
    };
  }, []);

  return isMobile;
}
