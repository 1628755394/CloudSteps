/**
 * MemoryLighthouse — 智能记忆灯塔九宫格组件（纯矢量，9 等分固定环形）
 *
 * 核心实现：9 个扇区强制均分 360°（每块固定 40°），与 value 无关。
 *   - ECharts series data 的 value 全部固定为 1 → 强制 9 等分
 *   - 真实词条数存到自定义字段 realValue，label/tooltip/统计都读 realValue
 *   - 0 值扇区保留结构，opacity 0.3 弱化，隐藏内部数字
 *   - 扇区内数字 position 'inside' + rotate:0，水平正向、几何居中
 *   - 外圈阶段标签用 DOM + 三角函数定位（非 ECharts label），带 CSS 引导短线
 *   - 圆心 DOM 面板：大脑图标 + 记忆九宫格 + 统计，pointer-events:none 穿透
 *   - 外发光：CSS filter drop-shadow 淡黄色，不模糊分割线
 *   - 图标：lucide-react 矢量 SVG（Brain / Lightbulb），非位图
 *   - 空状态：全 0 时隐藏环形，展示「暂无记忆词条，快去添加知识点」
 *
 * 顺序：01(First) → 02(Second) → ... → 09(Ninth)，从底部顺时针
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

/** 9 个阶段定义 */
interface StageDef {
  num: string;
  en: string;
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
  { num: "01", en: "First",   name: "01｜待学",         color: "#F45448", textColor: "#fff", kind: "unlearned", keyNode: true },
  { num: "02", en: "Second",  name: "02｜第二复习阶段", color: "#F77C2E", textColor: "#fff", kind: "box", boxIndex: 0 },
  { num: "03", en: "Third",   name: "03｜第三复习阶段", color: "#FCAA22", textColor: "#fff", kind: "box", boxIndex: 1 },
  { num: "04", en: "Fourth",  name: "04｜第四复习阶段", color: "#FCD046", textColor: "#fff", kind: "box", boxIndex: 2 },
  { num: "05", en: "Fifth",   name: "05｜第五复习阶段", color: "#FCE79B", textColor: "#fff", kind: "box", boxIndex: 3 },
  { num: "06", en: "Sixth",   name: "06｜第六复习阶段", color: "#A7D45C", textColor: "#fff", kind: "box", boxIndex: 4 },
  { num: "07", en: "Seventh", name: "07｜第七复习阶段", color: "#28B864", textColor: "#fff", kind: "box", boxIndex: 5 },
  { num: "08", en: "Eighth",  name: "08｜第八复习阶段", color: "#147C48", textColor: "#fff", kind: "box", boxIndex: 6 },
  { num: "09", en: "Ninth",   name: "09｜已掌握",       color: "#17B3A6", textColor: "#fff", kind: "mastered", keyNode: true },
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

  /** 真实业务数据（realValue），顺序对应 STAGES */
  const rawData = useMemo(
    () => STAGES.map((s) => ({
      num: s.num,
      en: s.en,
      color: s.color,
      realValue:
        s.kind === "unlearned" ? unlearnedCount
        : s.kind === "mastered" ? masteredCount
        : boxes[s.boxIndex!]?.count || 0,
    })),
    [boxes, unlearnedCount, masteredCount]
  );

  /** 业务统计（读 realValue，不读 echarts） */
  const waitStudy = rawData[0].realValue;
  const reviewTotal = rawData.slice(1, 8).reduce((s, i) => s + i.realValue, 0);
  const masteredTotal = rawData[8].realValue;
  const totalCount = waitStudy + reviewTotal + masteredTotal;
  const isEmpty = totalCount === 0;

  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  /** 构建 ECharts option：value 全部为 1，强制 9 等分 */
  const buildOption = useCallback(
    (): echarts.EChartsCoreOption => {
      // ✅ 重点：value 全部为 1，强制 9 等分；realValue 保存真实词条数
      const chartData = STAGES.map((stage, idx) => ({
        name: stage.name,
        value: 1, // 固定 1，保证 9 块扇形大小完全相等
        realValue: rawData[idx].realValue,
        itemStyle: {
          color: stage.color,
          borderColor: "#ffffff",
          // 01、09 业务首尾节点分割线加粗
          borderWidth: stage.keyNode ? 2.5 : 2,
          borderRadius: 3,
        },
      }));

      return {
        title: { show: false },
        tooltip: {
          trigger: "item",
          backgroundColor: "rgba(0,0,0,0.78)",
          borderColor: "transparent",
          textStyle: { color: "#fff", fontSize: 13 },
          padding: [8, 12],
          // tooltip 读取自定义 realValue
          formatter: (params: any) => {
            const realVal = params.data?.realValue ?? 0;
            return `${params.name}<br/>词条数量：${realVal}`;
          },
        },
        series: [
          {
            type: "pie",
            radius: ["44%", "66%"],
            center: ["50%", "50%"],
            // 起始角 270°（ECharts 角度约定，0=右/正东，逆时针为正）：
            // 与外圈标签角度公式 110+idx*40（屏幕角度，0=右，顺时针为正）精确对齐，
            // 保证每个扇区的颜色与其外部编号、数字位置一一对应
            startAngle: 270,
            clockwise: true,
            avoidLabelOverlap: false,
            minAngle: 0,
            itemStyle: {
              borderRadius: 3,
              borderColor: "#ffffff",
              borderWidth: 2,
            },
            // 扇区内数字：几何居中、水平正向、不旋转，0 值也显示
            label: {
              show: true,
              position: "inside",
              rotate: false,
              align: "center",
              verticalAlign: "middle",
              fontSize: 14,
              fontWeight: "bold",
              color: "#ffffff",
              // 读取自定义 realValue，0 值也显示数字
              formatter: (params: any) => {
                const realVal = params.data?.realValue ?? 0;
                return String(realVal);
              },
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
            data: chartData,
            animationType: "expansion",
            animationDuration: 600,
            animationEasing: "cubicOut",
          },
        ],
      };
    },
    [rawData]
  );

  useEffect(() => {
    if (!chartRef.current || isEmpty) return;
    const chart = echarts.init(chartRef.current);
    chartInstance.current = chart;
    chart.setOption(buildOption());

    const handleResize = () => {
      const w = chartRef.current!.clientWidth;
      setIsMobile(w < 480);
      chart.resize();
    };
    handleResize();

    const ro = new ResizeObserver(handleResize);
    ro.observe(chartRef.current);
    window.addEventListener("resize", handleResize);

    // 点击扇区 → 触发 onBlockClick 筛选词条
    const onChartClick = (params: any) => {
      if (params.componentType !== "series") return;
      const idx = params.dataIndex as number;
      const stage = STAGES[idx];
      if (!stage) return;
      const count = rawData[idx].realValue;
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
  }, [buildOption, isEmpty, onBlockClick, rawData]);

  /**
   * 外圈标签 DOM 定位：9 等分，每份 40°
   * 起始角度 120°（左下方，对应 01），顺时针每块 +40°
   * 半径用 % 表示（相对容器），大于外环 88%
   */
  // 环形外缘在 33%（66%/2），移动端标签更紧凑，标签半径略微收窄避免溢出
  const labelRadius = isMobile ? 44 : 47;
  const labelPositions = useMemo(
    () =>
      STAGES.map((_, idx) => {
        // 精确匹配原型图布局：01 位于底部偏左，09 位于底部偏右，05 位于正上方
        // 01 → 02(左下) → 03(左) → 04(左上) → 05(正上) → 06(右上) → 07(右) → 08(右下) → 09(底部偏右)
        const angleDeg = 110 + idx * 40;
        const angleRad = (angleDeg * Math.PI) / 180;
        // left/top 用 % 表示，圆心在 50%
        const left = 50 + labelRadius * Math.cos(angleRad);
        const top = 50 + labelRadius * Math.sin(angleRad);
        return { left, top, angleDeg };
      }),
    [labelRadius]
  );

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
    <div className="w-full max-w-[640px] mx-auto">
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
        <div className="aspect-square flex flex-col items-center justify-center text-center text-[#A0AEC0] px-6 max-w-[440px] mx-auto">
          <div className="text-4xl mb-2">🪹</div>
          <p className="text-sm">暂无记忆词条</p>
          <p className="text-xs mt-1">快去添加知识点</p>
        </div>
      ) : (
        /* 环形图 + 外发光 + 外圈 DOM 标签 + 圆心 DOM 面板 */
        <div
          className="relative aspect-square w-full max-w-[440px] mx-auto overflow-visible"
          style={{
            // 外圈柔和淡黄色外发光光晕（CSS filter，不模糊分割线）
            filter: "drop-shadow(0 0 14px rgba(255, 224, 110, 0.38))",
          }}
        >
          <div ref={chartRef} className="absolute inset-0 w-full h-full" />

          {/* 外圈阶段标签：DOM + CSS 引导短线（非 ECharts label），按阶段色对齐每个模块 */}
          {STAGES.map((stage, idx) => {
            const pos = labelPositions[idx];
            // 引导短线方向：从圆心指向标签
            const lineAngle = pos.angleDeg;
            return (
              <div
                key={idx}
                className="absolute pointer-events-none flex flex-col items-center"
                style={{
                  left: `${pos.left}%`,
                  top: `${pos.top}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                {/* 引导短线：从标签指向圆环边缘 */}
                <div
                  className="absolute"
                  style={{
                    width: "1px",
                    height: isMobile ? "8px" : "16px",
                    backgroundColor: "#ccc",
                    // 短线指向圆心方向
                    transform: `translate(-50%, -100%) rotate(${lineAngle + 180}deg)`,
                    transformOrigin: "bottom center",
                    top: "-2px",
                    left: "50%",
                  }}
                />
                {/* 阶段编号与英文名，颜色与对应扇区颜色一致（1:1 对齐原型图） */}
                <div
                  className="font-bold leading-none whitespace-nowrap"
                  style={{ color: stage.color, fontSize: isMobile ? 14 : 18 }}
                >
                  {stage.num}
                </div>
                <div
                  className="leading-none whitespace-nowrap"
                  style={{ color: stage.color, opacity: 0.85, fontSize: isMobile ? 9 : 12, marginTop: 3 }}
                >
                  {stage.en}
                </div>
              </div>
            );
          })}

          {/* 圆心 DOM 面板：鼠标穿透，不挡 hover */}
          <div
            className="absolute pointer-events-none text-center"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "38%",
            }}
          >
            <Brain className="mx-auto text-[#FFB300]" size={isMobile ? 20 : 26} strokeWidth={1.8} />
            <div className="font-semibold text-[#2D3748] mt-1" style={{ fontSize: isMobile ? 11 : 14 }}>记忆九宫格</div>
            <div className="tracking-wider text-[#A0AEC0]" style={{ fontSize: isMobile ? 7 : 9 }}>MEMORY NINE-GRID</div>
          </div>
        </div>
      )}

      {!isEmpty && (
        /* 汇总统计：横行展示，待学/复习中/已掌握 一行排开；小屏幕自动缩小间距和字号 */
        <div className="mt-3 px-1 sm:px-2">
          <div className="flex items-stretch justify-center gap-1.5 sm:gap-4">
            <div className="flex-1 min-w-0 max-w-[180px] flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-[#FCEDEB]">
              <span className="inline-block size-2.5 sm:size-3 rounded-[3px] bg-[#F45448] shrink-0" />
              <span className="text-[11px] sm:text-[13px] text-[#4A5568] truncate">待学</span>
              <span className="ml-auto font-bold text-[16px] sm:text-[20px] leading-none text-[#2D3748] tabular-nums">{waitStudy}</span>
            </div>
            <div className="flex-1 min-w-0 max-w-[180px] flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-[#FEF3E0]">
              <span className="inline-block size-2.5 sm:size-3 rounded-[3px] bg-[#FCAA22] shrink-0" />
              <span className="text-[11px] sm:text-[13px] text-[#4A5568] truncate">复习中</span>
              <span className="ml-auto font-bold text-[16px] sm:text-[20px] leading-none text-[#2D3748] tabular-nums">{reviewTotal}</span>
            </div>
            <div className="flex-1 min-w-0 max-w-[180px] flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-[#E5F8F6]">
              <span className="inline-block size-2.5 sm:size-3 rounded-[3px] bg-[#17B3A6] shrink-0" />
              <span className="text-[11px] sm:text-[13px] text-[#4A5568] truncate">已掌握</span>
              <span className="ml-auto font-bold text-[16px] sm:text-[20px] leading-none text-[#2D3748] tabular-nums">{masteredTotal}</span>
            </div>
          </div>
          <div className="mt-2 text-center text-[11px] sm:text-[12px] text-[#718096]">
            总词条 <span className="font-bold text-[14px] sm:text-[16px] text-[#2D3748] tabular-nums">{totalCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default MemoryLighthouse;
