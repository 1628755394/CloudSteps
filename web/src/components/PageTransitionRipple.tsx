import { usePageTransitionStore } from "../stores/pageTransitionStore";

const BASE_SIZE = 24;

/**
 * 全局页面过渡圆点动画：挂载在 App 根部，独立于路由树，
 * 不会因为页面切换（组件卸载）而中断动画。
 */
export function PageTransitionRipple() {
  const { active, x, y, color, scale, expanded, fading } = usePageTransitionStore();

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: BASE_SIZE,
          height: BASE_SIZE,
          marginLeft: -BASE_SIZE / 2,
          marginTop: -BASE_SIZE / 2,
          borderRadius: "9999px",
          // 放大的同时颜色由该阶段色渐渐过渡到白色，最后再淡出露出新页面
          backgroundColor: expanded ? "#ffffff" : color,
          transform: `scale(${expanded ? scale : 1})`,
          opacity: fading ? 0 : 1,
          transition:
            "transform 300ms cubic-bezier(0.22, 1, 0.36, 1), background-color 300ms ease-out, opacity 200ms ease-in",
        }}
      />
    </div>
  );
}
