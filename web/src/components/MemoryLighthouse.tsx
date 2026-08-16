/**
 * MemoryLighthouse — 智能记忆灯塔九宫格组件
 *
 * 灵感来源：李校来啦 (lxll.com) 的 WordGrid 九宫格
 * 适配 CloudSteps 的 React + Tailwind 技术栈
 */

import { useCallback, useMemo } from "react";

export interface LighthouseBox {
  count: number;
}

export interface MemoryLighthouseData {
  boxes: LighthouseBox[];
  mastered: number;
  unlearned: number;
  total: number;
}

interface MemoryLighthouseProps {
  data: MemoryLighthouseData;
  onBlockClick?: (type: string, wordNum: number, tips: string) => void;
}

const BOX_TYPES = [
  "BOX_0", "BOX_1", "BOX_2", "BOX_3",
  "BOX_4", "BOX_5", "BOX_6", "BOX_7",
];

export function MemoryLighthouse({ data, onBlockClick }: MemoryLighthouseProps) {
  const { boxes, mastered, unlearned, total } = data;

  const masteredProgress = useMemo(() => {
    const count = boxes[7]?.count ?? mastered;
    return total > 0 ? (count / total) * 100 : 0;
  }, [boxes, mastered, total]);

  const unlearnedProgress = useMemo(() => {
    const learnedSum = boxes.reduce((sum, b) => sum + (b.count || 0), 0);
    const unlearnedCount = unlearned > 0 ? unlearned : Math.max(0, total - learnedSum);
    return total > 0 ? (unlearnedCount / total) * 100 : 0;
  }, [boxes, unlearned, total]);

  const unlearnedCount = useMemo(() => {
    if (unlearned > 0) return unlearned;
    const learnedSum = boxes.reduce((sum, b) => sum + (b.count || 0), 0);
    return Math.max(0, total - learnedSum);
  }, [boxes, unlearned, total]);

  const masteredCount = boxes[7]?.count ?? mastered;

  const handleClick = useCallback(
    (boxIndex: number, tips: string) => {
      const count = boxIndex < 7 ? (boxes[boxIndex]?.count || 0) : masteredCount;
      onBlockClick?.(BOX_TYPES[boxIndex], count, tips);
    },
    [boxes, masteredCount, onBlockClick]
  );

  return (
    <div className="relative w-full aspect-square max-w-[400px] mx-auto">
      <img
        src="/course/nine_grid.png"
        alt="记忆灯塔"
        className="w-full h-full object-contain select-none pointer-events-none"
        draggable={false}
      />

      <div className="absolute inset-0 w-full h-full">
        {/* box0 — 底部偏左 */}
        <div
          className="absolute flex items-center justify-center text-white text-[0.9375rem] font-semibold cursor-pointer hover:opacity-70 active:opacity-50 transition-opacity"
          style={{ bottom: "20%", left: "26%", width: "16.5%", height: "20%", transform: "rotate(-20deg)" }}
          onClick={() => handleClick(0, "1")}
        >
          <span style={{ transform: "rotate(20deg)" }}>{boxes[0]?.count || 0}</span>
        </div>

        {/* box1 — 左侧中部 */}
        <div
          className="absolute flex items-center justify-center text-white text-[0.9375rem] font-semibold cursor-pointer hover:opacity-70 active:opacity-50 transition-opacity"
          style={{ top: "39%", left: "12%", width: "16.5%", height: "20%", transform: "rotate(-20deg)" }}
          onClick={() => handleClick(1, "2")}
        >
          <span style={{ transform: "rotate(20deg)" }}>{boxes[1]?.count || 0}</span>
        </div>

        {/* box2 — 左上 */}
        <div
          className="absolute flex items-center justify-center text-white text-[0.9375rem] font-semibold cursor-pointer hover:opacity-70 active:opacity-50 transition-opacity"
          style={{ top: "15.5%", left: "18.6%", width: "16.5%", height: "20%", transform: "rotate(40deg)" }}
          onClick={() => handleClick(2, "3")}
        >
          <span style={{ transform: "rotate(-40deg)" }}>{boxes[2]?.count || 0}</span>
        </div>

        {/* box3 — 顶部居中 */}
        <div
          className="absolute flex items-center justify-center text-white text-[0.9375rem] font-semibold cursor-pointer hover:opacity-70 active:opacity-50 transition-opacity"
          style={{ top: "9%", left: "40%", width: "22%", height: "15%" }}
          onClick={() => handleClick(3, "4")}
        >
          {boxes[3]?.count || 0}
        </div>

        {/* box4 — 右上 */}
        <div
          className="absolute flex items-center justify-center text-white text-[0.9375rem] font-semibold cursor-pointer hover:opacity-70 active:opacity-50 transition-opacity"
          style={{ top: "17%", right: "17%", width: "16.5%", height: "18%", transform: "rotate(-40deg)" }}
          onClick={() => handleClick(4, "5")}
        >
          <span style={{ transform: "rotate(40deg)" }}>{boxes[4]?.count || 0}</span>
        </div>

        {/* box5 — 右侧中部 */}
        <div
          className="absolute flex items-center justify-center text-white text-[0.9375rem] font-semibold cursor-pointer hover:opacity-70 active:opacity-50 transition-opacity"
          style={{ top: "38%", right: "9.5%", width: "16.5%", height: "20%" }}
          onClick={() => handleClick(5, "6")}
        >
          {boxes[5]?.count || 0}
        </div>

        {/* box6 — 底部偏右 */}
        <div
          className="absolute flex items-center justify-center text-white text-[0.9375rem] font-semibold cursor-pointer hover:opacity-70 active:opacity-50 transition-opacity"
          style={{ bottom: "20%", right: "24%", width: "16.5%", height: "22%", transform: "rotate(30deg)" }}
          onClick={() => handleClick(6, "7")}
        >
          <span style={{ transform: "rotate(-30deg)" }}>{boxes[6]?.count || 0}</span>
        </div>

        {/* 已掌握 — 底部右侧 */}
        <div
          className="absolute flex flex-col items-center text-[0.71875rem] cursor-pointer hover:opacity-70 active:opacity-50 transition-opacity"
          style={{ bottom: "6%", right: "13%", width: "16.5%" }}
          onClick={() => handleClick(7, "已掌握")}
        >
          <span className="leading-none text-[#43c19b] font-semibold">{masteredCount}</span>
          <span className="text-[#b7b7b7] mt-0.5">已掌握</span>
        </div>

        {/* 已掌握进度条 (4格灯) */}
        <div className="absolute flex flex-col" style={{ bottom: "7%", right: "32%" }}>
          {[0, 50, 75, 100].map((threshold, i) => (
            <img
              key={i}
              src={`/course/${masteredProgress >= threshold ? "nine_grid_light" : "nine_grid_gray"}.png`}
              alt=""
              className="w-[2.1875rem] mb-[0.0625rem] last:mb-0 select-none"
              draggable={false}
            />
          ))}
        </div>

        {/* 待学 — 底部左侧 */}
        <div
          className="absolute flex flex-col items-center text-[0.71875rem] text-[#b7b7b7] cursor-pointer hover:opacity-70 active:opacity-50 transition-opacity"
          style={{ bottom: "6%", left: "15%", width: "16.5%" }}
          onClick={() => onBlockClick?.("UNLEARNED", unlearnedCount, "待学")}
        >
          <span className="leading-none font-semibold">{unlearnedCount}</span>
          <span className="mt-0.5">待学</span>
        </div>

        {/* 待学进度条 (4格灯，反向) */}
        <div className="absolute flex flex-col" style={{ bottom: "7%", left: "34%" }}>
          {[100, 75, 50, 0].map((threshold, i) => (
            <img
              key={i}
              src={`/course/${unlearnedProgress >= threshold ? "nine_grid_light" : "nine_grid_gray"}.png`}
              alt=""
              className="w-[2.1875rem] mb-[0.0625rem] last:mb-0 select-none"
              draggable={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default MemoryLighthouse;
