/**
 * 学习通式课表 — 顶部工具栏
 * 周切换、回到本周、添加课程、导出 Excel、打印/导出图片
 */
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Plus, Download, Printer, CalendarDays } from "lucide-react";
import { Button } from "../ui/button";
import { useTimetableStore } from "../../stores/timetableStore";
import { isCourseShow, weekDayLabel, weekRangeLabel } from "../../utils/timetableFilter";
import { showToast } from "../../utils/toast";
import type { Course } from "../../api/timetable";

interface TimetableToolbarProps {
  onAdd: () => void;
}

export function TimetableToolbar({ onAdd }: TimetableToolbarProps) {
  const { t } = useTranslation();
  const viewWeek = useTimetableStore((s) => s.viewWeek);
  const config = useTimetableStore((s) => s.config);
  const courses = useTimetableStore((s) => s.courses);
  const prevWeek = useTimetableStore((s) => s.prevWeek);
  const nextWeek = useTimetableStore((s) => s.nextWeek);
  const setViewWeek = useTimetableStore((s) => s.setViewWeek);
  const setCurrentWeek = useTimetableStore((s) => s.setCurrentWeek);

  const isCurrent = viewWeek === config.currentWeek;
  const weekOptions = Array.from({ length: config.totalWeek }, (_, i) => i + 1);

  function handleJump(value: string) {
    setViewWeek(Number(value));
  }

  async function handleBackToCurrent() {
    await setCurrentWeek(config.currentWeek);
  }

  /** 导出当前周可见课程为 Excel */
  async function handleExportExcel() {
    const visible = courses.filter((c) => isCourseShow(c, viewWeek));
    if (visible.length === 0) {
      showToast.warning(t("timetable.export_empty"));
      return;
    }
    const XLSX = await import("xlsx");
    const rows = visible.map((c: Course) => ({
      [t("timetable.course_name")]: c.name,
      [t("timetable.teacher")]: c.teacher,
      [t("timetable.room")]: c.room,
      [t("timetable.week_day")]: weekDayLabel(c.weekDay),
      [t("timetable.start_section")]: c.startSection,
      [t("timetable.end_section")]: c.endSection,
      [t("timetable.week_range")]: weekRangeLabel(c),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${t("timetable.week_n", { n: viewWeek })}`);
    XLSX.writeFile(wb, `timetable_week${viewWeek}.xlsx`);
    showToast.success(t("timetable.export_ok"));
  }

  /** 打印当前页（浏览器另存为 PDF/图片） */
  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        <Button variant="ghost" size="icon" onClick={prevWeek} aria-label={t("timetable.prev_week")}>
          <ChevronLeft size={18} />
        </Button>
        <div className="flex items-center gap-1.5 px-1">
          <select
            value={viewWeek}
            onChange={(e) => handleJump(e.target.value)}
            aria-label={t("timetable.jump_week")}
            className="h-8 rounded-md border border-input bg-card px-2 text-sm font-medium text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30"
          >
            {weekOptions.map((w) => (
              <option key={w} value={w}>
                {t("timetable.week_n", { n: w })}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">/ {config.totalWeek}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={nextWeek} aria-label={t("timetable.next_week")}>
          <ChevronRight size={18} />
        </Button>
      </div>

      {!isCurrent && (
        <Button variant="brandOutline" size="sm" onClick={handleBackToCurrent}>
          <CalendarDays size={14} />
          {t("timetable.back_to_current")}
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExportExcel}>
          <Download size={14} />
          {t("timetable.export_excel")}
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer size={14} />
          {t("timetable.print")}
        </Button>
        <Button variant="brand" size="sm" onClick={onAdd}>
          <Plus size={14} />
          {t("timetable.add_course")}
        </Button>
      </div>
    </div>
  );
}
