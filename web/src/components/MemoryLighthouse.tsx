/**
 * MemoryLighthouse — 智能记忆灯塔九宫格组件（纯矢量版，无图片）
 *
 * 9 段空心环形圆环（ECharts pie canvas 绘制）：
 *   01    → 待学（pending）
 *   02–08 → 复习阶段 boxes[0–6]
 *   09    → 已掌握（mastered）
 *
 * 实现要点：
 *   - 环形：ECharts pie，内环 60% / 外环 88%，起始角 180°（01 从底部顺时针）
 *   - 扇区内数字：position 'inside'，rotate:false，几何居中、水平正向
 *   - 0 值扇区：保留结构、透明度 0.3 弱化、隐藏内部数字
 *   - 外圈标签：ECharts label 'outside' + labelLine 矢量引导线（canvas 矢量，非图片）
 *     每组 = 大号阶段编号(01..09) + 小号英文(First..Ninth)
 *   - 圆心 DOM 面板：大脑图标 + 「记忆九宫格」+ MEMORY NINE-GRID + 汇总统计
 *     pointer-events:none，鼠标穿透不挡 hover
 *   - 外发光：CSS filter drop-shadow 淡黄色光晕，不模糊分割线
 *   - 图标：lucide-react 矢量 SVG（Brain / Lightbulb），非位图
 *   - 响应式：PC 完整外圈标签；移动端隐藏外圈标签，信息走 tooltip
 *   - 空状态：全 0 时隐藏环形，展示「暂无记忆词条，快去添加知识点」
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import { Brain } from "lucide-react";

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

/** 9 个阶段的语义化定义 */
interface StageDef {
  key: string;
  /** 外圈大号编号 */
  num: string;
  /** 外圈小号英文 */
  en: string;
  /** tooltip 完整名称 */
  name: string;
  color: string;
  /** 扇区内数字颜色（深色扇区白字，浅色扇区深字） */
  textColor: string;
  kind: "unlearned" | "box" | "mastered";
  boxIndex?: number;
  /** 业务首尾节点（01/09），分割线加粗 */
  keyNode?: boolean;
}

const STAGES: StageDef[] = [
  { key: "01", num: "01", en: "First",  name: "01｜待学",         color: "#F24C4C", textColor: "#fff", kind: "unlearned", keyNode: true },
  { key: "02", num: "02", en: "Second", name: "02｜第二复习阶段", color: "#FF7833", textColor: "#fff", kind: "box", boxIndex: 0 },
  { key: "03", num: "03", en: "Third",  name: "03｜第三复习阶段", color: "#FFAA22", textColor: "#222", kind: "box", boxIndex: 1 },
  { key: "04", num: "04", en: "Fourth", name: "04｜第四复习阶段", color: "#FFCC44", textColor: "#222", kind: "box", boxIndex: 2 },
  { key: "05", num: "05", en: "Fifth",  name: "05｜第五复习阶段", color: "#F9E796", textColor: "#222", kind: "box", boxIndex: 3 },
  { key: "06", num: "06", en: "Sixth",  name: "06｜第六复习阶段", color: "#A6D258", textColor: "#222", kind: "box", boxIndex: 4 },
  { key: "07", num: "07", en: "Seventh",name: "07｜第七复习阶段", color: "#27BD62", textColor: "#fff", kind: "box", boxIndex: 5 },
  { key: "08", num: "08", en: "Eighth", name: "08｜第八复习阶段", color: "#0E7D48", textColor: "#fff", kind: "box", boxIndex: 6 },
  { key: "09", num: "09", en: "Ninth",  name: "09｜已掌握",       color: "#00A88C", textColor: "#fff", kind: "mastered", keyNode: true },
];

const BOX_TYPES = ["BOX_0","BOX_1","BOX_2","BOX_3","BOX_4","BOX_5","BOX_6","BOX_7"];

export function MemoryLighthouse({ data, onBlockClick }: MemoryLighthouseProps) {
  const { boxes, mastered, unlearned, total } = data;

  const unlearnedCount = useMemo(() => {
    if (unlearned > 0) return unlearned;
    const learnedSum = boxes.reduce((s, b) => s + (b.count || 0), 0);
    return Math.max(0, total - learnedSum);
  }, [boxes, unlearned, total]);

  const masteredCount = boxes[7]?.count ?? mastered;

  /** 9 段数值，顺序对应 STAGES */
  const sectorValues = useMemo(
    () => STAGES.map((s) =>
      s.kind === "unlearned" ? unlearnedCount
      : s.kind === "mastered" ? masteredCount
      : boxes[s.boxIndex!]?.count || 0
    ),
    [boxes, unlearnedCount, masteredCount]
  );

  const reviewingCount = useMemo(
    () => sectorValues.slice(1, 8).reduce((s, v) => s + v, 0),
    [sectorValues]
  );
  const totalCount = unlearnedCount + reviewingCount + masteredCount;
  const isEmpty = totalCount === 0;

  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const buildOption = useCallback(
    (mobile: boolean): echarts.EChartsCoreOption => {
      const seriesData = STAGES.map((stage, idx) => {
        const value = sectorValues[idx];
        return {
          name: stage.name,
          value,
          itemStyle: {
            color: stage.color,
            // 0 值弱化：保留结构，透明度 0.3
            opacity: value > 0 ? 1 : 0.3,
            borderColor: "#ffffff",
            // 01、09 业务首尾节点分割线加粗
            borderWidth: stage.keyNode ? 2.5 : 2,
            borderRadius: 3,
          },
        };
      });

      return {
        title: { show: false },
        tooltip: {
          trigger: "item",
          backgroundColor: "rgba(0,0,0,0.78)",
          borderColor: "transparent",
          textStyle: { color: "#fff", fontSize: 13 },
          padding: [8, 12],
          formatter: (params: any) =>
            params.value === 0
              ? `${params.name}<br/>该阶段暂无词条`
              : `${params.name}<br/>词条数量：${params.value}`,
        },
        series: [
          {
            type: "pie",
            radius: ["60%", "88%"],
            center: ["50%", "50%"],
            // 起始角 180°：01 从底部开始顺时针排布
            startAngle: 180,
            clockwise: true,
            avoidLabelOverlap: true,
            minAngle: 2,
            itemStyle: {
              borderRadius: 3,
              borderColor: "#ffffff",
              borderWidth: 2,
            },
            // 扇区内数字：几何居中、水平正向、不旋转
            label: {
              show: true,
              position: "inside",
              rotate: false,
              align: "center",
              verticalAlign: "middle",
              fontSize: 14,
              fontWeight: "bold",
              color: (params: any) => {
                const s = STAGES[params.dataIndex];
                return s ? s.textColor : "#222";
              },
              // 0 值隐藏内部数字
              formatter: (p: any) => (p.value > 0 ? String(p.value) : ""),
            },
            labelLine: { show: false },
            emphasis: {
              scale: true,
              scaleSize: 6,
              itemStyle: {
                shadowBlur: 0,
                borderColor: "#fff",
                borderWidth: 2,
              },
              label: { show: true, fontWeight: "bold", fontSize: 15 },
            },
            data: seriesData,
            animationType: "expansion",
            animationDuration: 600,
            animationEasing: "cubicOut",
          },
          {
            // 隐形第二层：仅承载外圈阶段标签 + 矢量引导线
            type: "pie",
            radius: ["60%", "88%"],
            center: ["50%", "50%"],
            startAngle: 180,
            clockwise: true,
            avoidLabelOverlap: true,
            minAngle: 2,
            silent: true,
            z: 0,
            // PC 显示外圈标签 + 引导线；移动端隐藏（信息走 tooltip）
            label: {
              show: !mobile,
              position: "outside",
              // 大号编号 + 小号英文，rich text 排版
              formatter: (p: any) => {
                const s = STAGES[p.dataIndex];
                return `{num|${s.num}}\n{en|${s.en}}`;
              },
              rich: {
                num: { fontSize: 13, fontWeight: "bold", color: "#2D3748", lineHeight: 16 },
                en:  { fontSize: 9, color: "#A0AEC0", lineHeight: 11 },
              },
            },
            labelLine: {
              show: !mobile,
              length: 8,
              length2: 10,
              smooth: false,
              lineStyle: { color: "#bbb", width: 1 },
            },
            emphasis: { disabled: true },
            animation: false,
            data: STAGES.map((stage, idx) => ({
              name: stage.name,
              value: sectorValues[idx],
              itemStyle: { color: "transparent", borderColor: "transparent", borderWidth: 0 },
            })),
          },
        ],
      };
    },
    [sectorValues]
  );

  useEffect(() => {
    if (!chartRef.current || isEmpty) return;
    const chart = echarts.init(chartRef.current);
    chartInstance.current = chart;
    chart.setOption(buildOption(isMobile));

    const handleResize = () => {
      const w = chartRef.current!.clientWidth;
      const mobile = w < 480;
      setIsMobile(mobile);
      chart.resize();
    };
    handleResize();

    const ro = new ResizeObserver(handleResize);
    ro.observe(chartRef.current);
    window.addEventListener("resize", handleResize);

    // 点击扇区 → 触发 onBlockClick 筛选词条
    const onChartClick = (params: any) => {
      if (params.componentType !== "series" || params.seriesIndex !== 0) return;
      const idx = params.dataIndex as number;
      const stage = STAGES[idx];
      if (!stage) return;
      const count = sectorValues[idx];
      if (stage.kind === "unlearned") {
        onBlockClick?.("UNLEARNED", count, stage.name);
      } else if (stage.kind === "mastered") {
        onBlockClick?.(BOX_TYPES[7], count, stage.name);
      } else {
        onBlockClick?.(BOX_TYPES[stage.boxIndex!], count, stage.name);
      }
    };
    chart.on("click", onChartClick);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", handleResize);
      chart.off("click", onChartClick);
      chart.dispose();
      chartInstance.current = null;
    };
  }, [buildOption, isEmpty, isMobile, onBlockClick, sectorValues]);

  /** 顶部可视化彩色图例 */
  const legendGroups = useMemo(
    () => [
      { label: "01 待学", chips: [{ color: STAGES[0].color }] },
      { label: "02–08 复习阶段", chips: STAGES.slice(1, 8).map((s) => ({ color: s.color })) },
      { label: "09 已掌握", chips: [{ color: STAGES[8].color }] },
    ],
    []
  );

  return (
    <div className="w-full max-w-[440px] mx-auto">
      {/* 顶部彩色图例 */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 mb-2 text-xs text-[#555]">
        {legendGroups.map((g, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="flex items-center gap-0.5">
              {g.chips.map((c, j) => (
                <span key={j} className="inline-block w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: c.color }} />
              ))}
            </span>
            <span>{g.label}</span>
          </div>
        ))}
      </div>

      {isEmpty ? (
        /* 空状态 */
        <div className="aspect-square flex flex-col items-center justify-center text-center text-[#A0AEC0] px-6">
          <div className="text-4xl mb-2">🪹</div>
          <p className="text-sm">暂无记忆词条</p>
          <p className="text-xs mt-1">快去添加知识点</p>
        </div>
      ) : (
        /* 环形图 + 外发光 + 圆心 DOM 面板 */
        <div
          className="relative aspect-square w-full"
          style={{
            // 外圈柔和淡黄色外发光光晕（CSS filter，不模糊分割线）
            filter: "drop-shadow(0 0 12px rgba(255, 220, 120, 0.45))",
          }}
        >
          <div ref={chartRef} className="absolute inset-0 w-full h-full" />

          {/* 圆心 DOM 面板：鼠标穿透，不挡 hover */}
          <div
            className="absolute pointer-events-none text-center"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "46%",
            }}
          >
            <Brain className="mx-auto text-[#FFB300]" size={26} strokeWidth={1.8} />
            <div className="text-[14px] font-semibold text-[#2D3748] mt-1">记忆九宫格</div>
            <div className="text-[9px] tracking-wider text-[#A0AEC0] mb-1.5">MEMORY NINE-GRID</div>
            <div className="space-y-0.5 text-[11px] text-[#4A5568] leading-snug">
              <div className="flex items-center justify-center gap-1">
                <span className="inline-block w-2 h-2 rounded-[2px]" style={{ backgroundColor: STAGES[0].color }} />
                <span>待学</span>
                <span className="font-bold text-[13px] text-[#2D3748] tabular-nums">{unlearnedCount}</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <span className="inline-block w-2 h-2 rounded-[2px]" style={{ backgroundColor: "#FFAA22" }} />
                <span>复习中</span>
                <span className="font-bold text-[13px] text-[#2D3748] tabular-nums">{reviewingCount}</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <span className="inline-block w-2 h-2 rounded-[2px]" style={{ backgroundColor: STAGES[8].color }} />
                <span>已掌握</span>
                <span className="font-bold text-[13px] text-[#2D3748] tabular-nums">{masteredCount}</span>
              </div>
            </div>
            <div className="mt-1 pt-1 border-t border-[#E2E8F0] text-[10px] text-[#718096]">
              总词条 <span className="font-bold text-[12px] text-[#2D3748] tabular-nums">{totalCount}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MemoryLighthouse;
