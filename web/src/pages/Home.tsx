import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";
import { CourseTimetable } from "../components/timetable/CourseTimetable";
import { TimetableToolbar } from "../components/timetable/TimetableToolbar";
import { CourseEditorDialog } from "../components/timetable/CourseEditorDialog";
import { CloudSpin } from "../components/cloudsteps/arco";
import { useTimetableStore } from "../stores/timetableStore";
import { isCourseShow } from "../utils/timetableFilter";
import type { Course } from "../api/timetable";

/**
 * 备课页 `/lesson-prep` — 学习通式节次网格课表。
 * 支持周切换、单双周/起止周过滤、课程增删改查、Excel 导出、打印。
 * 数据 localStorage 持久化，仓储抽象层预留后端 HTTP 实现。
 */
export default function Home() {
  const { t } = useTranslation();
  const load = useTimetableStore((s) => s.load);
  const loaded = useTimetableStore((s) => s.loaded);
  const loading = useTimetableStore((s) => s.loading);
  const courses = useTimetableStore((s) => s.courses);
  const config = useTimetableStore((s) => s.config);
  const viewWeek = useTimetableStore((s) => s.viewWeek);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [preset, setPreset] = useState<{ weekDay: number; startSection: number } | null>(null);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const visibleCount = useMemo(
    () => courses.filter((c) => isCourseShow(c, viewWeek)).length,
    [courses, viewWeek],
  );

  function openAdd() {
    setEditing(null);
    setPreset(null);
    setEditorOpen(true);
  }

  function openEdit(course: Course) {
    setEditing(course);
    setPreset(null);
    setEditorOpen(true);
  }

  function pickSlot(weekDay: number, section: number) {
    setEditing(null);
    setPreset({ weekDay, startSection: section });
    setEditorOpen(true);
  }

  if (!loaded || loading) {
    return (
      <div className="flex h-full items-center justify-center" aria-busy="true">
        <CloudSpin />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col min-h-0 overflow-hidden">
      {/* 顶部标题 + 工具栏 */}
      <div className="flex flex-col gap-2 px-1 pb-2 print:hidden">
        <div className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-foreground sm:text-lg">
          <CalendarDays size={18} className="text-primary" />
          {t("timetable.title")}
        </div>
        <TimetableToolbar onAdd={openAdd} />
        <div className="text-xs text-muted-foreground">
          {t("timetable.week_summary", { count: visibleCount })}
        </div>
      </div>

      {/* 网格主体：可滚动 */}
      <div className="flex-1 min-h-0 overflow-auto">
        <CourseTimetable
          courses={courses}
          config={config}
          viewWeek={viewWeek}
          onEdit={openEdit}
          onPickSlot={pickSlot}
        />
      </div>

      <CourseEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        course={editing}
        preset={preset}
        config={config}
      />
    </div>
  );
}
