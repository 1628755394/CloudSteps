import { create } from "zustand";

interface RippleState {
  active: boolean;
  x: number;
  y: number;
  color: string;
  /** 圆点覆盖全屏所需的缩放倍数（点击时按视口尺寸算好） */
  scale: number;
  /** 是否已经开始放大（用于触发 CSS transition，需要下一帧再置 true） */
  expanded: boolean;
  /** 是否开始淡出 */
  fading: boolean;
}

export const usePageTransitionStore = create<RippleState>(() => ({
  active: false,
  x: 0,
  y: 0,
  color: "#F45448",
  scale: 1,
  expanded: false,
  fading: false,
}));

const EXPAND_MS = 300;
const FADE_MS = 200;
const BASE_SIZE = 24;

/**
 * 触发「点击模块 -> 该模块颜色的圆点从点击位置放大铺满全屏 -> 淡出露出新页面」的过渡动画。
 * 总时长控制在 500ms 内：放大 300ms + 淡出 200ms。
 * onCovered 会在圆点刚好铺满全屏的那一刻触发（此时执行真正的页面跳转，不会有闪烁）。
 */
export function triggerPageRipple(x: number, y: number, color: string, onCovered: () => void) {
  const maxDist = Math.max(
    Math.hypot(x, y),
    Math.hypot(window.innerWidth - x, y),
    Math.hypot(x, window.innerHeight - y),
    Math.hypot(window.innerWidth - x, window.innerHeight - y)
  );
  // 留一点余量，确保圆点完全盖住四个角
  const scale = (maxDist * 2.15) / BASE_SIZE;

  usePageTransitionStore.setState({ active: true, x, y, color, scale, expanded: false, fading: false });

  // 双 rAF 保证浏览器先渲染初始（未展开）状态，再切换到展开状态，CSS transition 才会生效
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      usePageTransitionStore.setState({ expanded: true });
    });
  });

  window.setTimeout(() => {
    onCovered();
    usePageTransitionStore.setState({ fading: true });
  }, EXPAND_MS);

  window.setTimeout(() => {
    usePageTransitionStore.setState({ active: false, expanded: false, fading: false });
  }, EXPAND_MS + FADE_MS);
}
