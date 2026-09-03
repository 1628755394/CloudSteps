/**
 * 学习通式课程课表页面
 *
 * 功能：周视图节次网格、课程色块、单双周/起止周过滤、周切换、
 * 课程增删改查、Excel 导出、打印。数据 localStorage 持久化。
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";
import { PageTitle } from "../components/PageTitle";
import { CourseTimetable } from "../components/timetable/CourseTimetable";
import { TimetableToolbar } from "../components/timetable/TimetableToolbar";
import { CourseEditorDialog } from "../components/timetable/CourseEditorDialog";
import { CloudSpin } from "../components/cloudsteps/arco";
import { useTimetableStore } from "../stores/timetableStore";
import { isCourseShow } from "../utils/timetableFilter";
import type { Course } from "../api/timetable";

export default function Timetable() {
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
      <div className="flex flex-1 items-center justify-center py-20" aria-busy="true">
        <CloudSpin />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 print:hidden">
        <PageTitle description={t("timetable.subtitle")}>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={18} className="text-primary" />
            {t("timetable.title")}
          </span>
        </PageTitle>
      </div>

      <TimetableToolbar onAdd={openAdd} />

      <div className="text-xs text-muted-foreground print:hidden">
        {t("timetable.week_summary", { count: visibleCount })}
      </div>

      <CourseTimetable
        courses={courses}
        config={config}
        viewWeek={viewWeek}
        onEdit={openEdit}
        onPickSlot={pickSlot}
      />

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
