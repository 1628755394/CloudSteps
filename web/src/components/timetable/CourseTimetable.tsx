/**
 * 学习通式课表 — 节次网格主体
 *
 * 用 CSS Grid 实现：第 1 列为节次标签，后 7 列为周一~周日；
 * 每一节对应一行，课程色块通过 gridColumn / gridRow 跨行渲染。
 * 不使用 <table>，避免跨行合并难以处理。
 */
import { forwardRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import type { Course, TimetableConfig } from "../../api/timetable";
import { isCourseShow, weekRangeLabel } from "../../utils/timetableFilter";

const DAY_KEYS = [
  "timetable.day_mon",
  "timetable.day_tue",
  "timetable.day_wed",
  "timetable.day_thu",
  "timetable.day_fri",
  "timetable.day_sat",
  "timetable.day_sun",
];

/** hex → rgba，用于色块的浅色边框 */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

interface CourseTimetableProps {
  courses: Course[];
  config: TimetableConfig;
  viewWeek: number;
  onEdit: (course: Course) => void;
  onPickSlot?: (weekDay: number, section: number) => void;
}

export const CourseTimetable = forwardRef<HTMLDivElement, CourseTimetableProps>(
  function CourseTimetable({ courses, config, viewWeek, onEdit, onPickSlot }, ref) {
    const { t } = useTranslation();
    const sections = config.sections;
    const totalRows = sections.length;

    // 当前周可见课程
    const visible = useMemo(
      () => courses.filter((c) => isCourseShow(c, viewWeek)),
      [courses, viewWeek],
    );

    // 网格：第 1 列 56px，后 7 列 1fr；第 1 行表头 44px，其余每节 64px
    const gridStyle = {
      gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))`,
      gridTemplateRows: `44px repeat(${totalRows}, 64px)`,
    } as const;

    return (
      <div ref={ref} className="overflow-x-auto">
        <div
          className="grid min-w-[720px] rounded-xl border border-border bg-card"
          style={gridStyle}
        >
          {/* 表头：左上角 + 7 天 */}
          <div className="flex items-center justify-center border-b border-r border-border text-xs font-medium text-muted-foreground">
            {t("timetable.section")}
          </div>
          {DAY_KEYS.map((key, i) => (
            <div
              key={key}
              className={`flex items-center justify-center border-b border-border text-sm font-medium ${
                i === 6 ? "" : "border-r"
              } ${viewWeek === config.currentWeek && isToday(i + 1) ? "text-primary" : "text-foreground"}`}
            >
              {t(key)}
            </div>
          ))}

          {/* 节次标签 + 空白格（构成网格线） */}
          {sections.map((sec, rowIdx) => (
            <div key={`sec-${sec.no}`} className="contents">
              <div className="flex flex-col items-center justify-center border-b border-r border-border px-1 text-center">
                <span className="text-sm font-semibold text-foreground">{sec.no}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">{sec.start}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">{sec.end}</span>
              </div>
              {Array.from({ length: 7 }, (_, dayIdx) => (
                <button
                  key={`cell-${sec.no}-${dayIdx}`}
                  type="button"
                  onClick={() => onPickSlot?.(dayIdx + 1, sec.no)}
                  className={`border-b border-border ${dayIdx === 6 ? "" : "border-r"} hover:bg-accent/40 transition-colors`}
                  aria-label={`${t(DAY_KEYS[dayIdx])} ${t("timetable.section")} ${sec.no}`}
                />
              ))}
            </div>
          ))}

          {/* 课程色块：跨行渲染 */}
          {visible.map((c) => {
            const col = c.weekDay + 1; // 第 1 列是节次标签
            const rowStart = c.startSection + 1; // +1 因为第 1 行是表头
            const rowEnd = c.endSection + 2; // grid-row-end 不含，+1 表头 +1 包含末节
            const span = c.endSection - c.startSection + 1;
            const showDetail = span >= 2;
            return (
              <button
                key={c.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(c);
                }}
                className="group relative m-0.5 flex flex-col overflow-hidden rounded-md p-1.5 text-left text-white shadow-sm transition-transform hover:z-10 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                style={{
                  gridColumn: col,
                  gridRow: `${rowStart} / ${rowEnd}`,
                  backgroundColor: c.color,
                  borderColor: hexToRgba(c.color, 0.5),
                }}
                title={`${c.name} · ${c.teacher} · ${c.room} · ${weekRangeLabel(c)}`}
              >
                <span className="line-clamp-2 text-xs font-semibold leading-tight">{c.name}</span>
                {showDetail && (
                  <>
                    {c.room && (
                      <span className="mt-0.5 line-clamp-1 text-[10px] leading-tight opacity-90">@{c.room}</span>
                    )}
                    <span className="mt-auto line-clamp-1 text-[10px] leading-tight opacity-80">
                      {weekRangeLabel(c)}
                    </span>
                  </>
                )}
                <span className="pointer-events-none absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Pencil size={12} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);

/** 判断星期几是否是今天（用于表头高亮） */
function isToday(weekDay: number): boolean {
  const jsDay = new Date().getDay(); // 0=周日
  const monBased = jsDay === 0 ? 7 : jsDay;
  return monBased === weekDay;
}
