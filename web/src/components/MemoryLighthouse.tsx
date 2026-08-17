/**
 * MemoryLighthouse — 智能记忆灯塔九宫格组件
 *
 * 灵感来源：李校来啦 (lxll.com) 的 WordGrid 九宫格
 * 适配 CloudSteps 的 React + Tailwind 技术栈
 *
 * 数字落点按 nine_grid_alt.png 圆环扇区标定（图 1190×1322）：
 *   01    → 待学（pending）
 *   02–08 → 复习阶段 boxes[0–6]
 *   09    → 已掌握（mastered）
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

type SlotKind = "box" | "unlearned" | "mastered";

interface RingSlot {
  /** 相对图片宽高的中心 % */
  left: number;
  top: number;
  kind: SlotKind;
  /** boxes 下标；仅 kind=box 时有效 */
  boxIndex?: number;
  tips: string;
}

/** 扇区 01–09 数字中心（相对图片宽高 %，按 nine_grid_alt.png 各色块中心标定） */
const RING_SLOTS: RingSlot[] = [
  { left: 22.0, top: 78.0, kind: "unlearned", tips: "待学" }, // 01 First
  { left: 16.0, top: 63.0, kind: "box", boxIndex: 0, tips: "1" }, // 02 → 复习 1
  { left: 13.0, top: 50.0, kind: "box", boxIndex: 1, tips: "2" }, // 03 → 复习 2
  { left: 17.0, top: 37.0, kind: "box", boxIndex: 2, tips: "3" }, // 04 → 复习 3
  { left: 50.0, top: 30.0, kind: "box", boxIndex: 3, tips: "4" }, // 05 → 复习 4
  { left: 83.0, top: 37.0, kind: "box", boxIndex: 4, tips: "5" }, // 06 → 复习 5
  { left: 87.0, top: 50.0, kind: "box", boxIndex: 5, tips: "6" }, // 07 → 复习 6
  { left: 84.0, top: 63.0, kind: "box", boxIndex: 6, tips: "7" }, // 08 → 复习 7
  { left: 78.0, top: 78.0, kind: "mastered", tips: "已掌握" }, // 09 Ninth
];

const BOX_TYPES = [
  "BOX_0", "BOX_1", "BOX_2", "BOX_3",
  "BOX_4", "BOX_5", "BOX_6", "BOX_7",
];

export function MemoryLighthouse({ data, onBlockClick }: MemoryLighthouseProps) {
  const { boxes, mastered, unlearned, total } = data;

  const unlearnedCount = useMemo(() => {
    if (unlearned > 0) return unlearned;
    const learnedSum = boxes.reduce((sum, b) => sum + (b.count || 0), 0);
    return Math.max(0, total - learnedSum);
  }, [boxes, unlearned, total]);

  const masteredCount = boxes[7]?.count ?? mastered;

  const slotCount = useCallback(
    (slot: RingSlot) => {
      if (slot.kind === "unlearned") return unlearnedCount;
      if (slot.kind === "mastered") return masteredCount;
      return boxes[slot.boxIndex!]?.count || 0;
    },
    [boxes, masteredCount, unlearnedCount]
  );

  const handleSlotClick = useCallback(
    (slot: RingSlot) => {
      const count = slotCount(slot);
      if (slot.kind === "unlearned") {
        onBlockClick?.("UNLEARNED", count, slot.tips);
        return;
      }
      if (slot.kind === "mastered") {
        onBlockClick?.(BOX_TYPES[7], count, slot.tips);
        return;
      }
      onBlockClick?.(BOX_TYPES[slot.boxIndex!], count, slot.tips);
    },
    [onBlockClick, slotCount]
  );

  return (
    <div className="relative w-full max-w-[400px] mx-auto aspect-[1190/1322]">
      <img
        src={`${import.meta.env.BASE_URL}course/nine_grid_alt.png`}
        alt="记忆灯塔"
        className="w-full h-full object-contain select-none pointer-events-none"
        draggable={false}
      />

      <div className="absolute inset-0 w-full h-full">
        {RING_SLOTS.map((slot, i) => (
          <div
            key={i}
            className="absolute flex items-center justify-center text-white text-[0.9375rem] font-semibold cursor-pointer hover:opacity-70 active:opacity-50 transition-opacity -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${slot.left}%`, top: `${slot.top}%`, width: "14%", height: "11%" }}
            onClick={() => handleSlotClick(slot)}
          >
            {slotCount(slot)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MemoryLighthouse;
