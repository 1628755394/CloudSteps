/**
 * 学习通式课表 — 课程新增/编辑弹窗
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { COURSE_COLORS, type Course, type TimetableConfig, type WeekType } from "../../api/timetable";
import { blankCourseInput, useTimetableStore } from "../../stores/timetableStore";
import { showToast } from "../../utils/toast";

interface CourseEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 传入课程为编辑模式；null 为新增模式 */
  course: Course | null;
  /** 新增模式下预填的星期/节次（点击空白格时带入） */
  preset?: { weekDay: number; startSection: number } | null;
  config: TimetableConfig;
}

type Input = Omit<Course, "id">;

const WEEK_TYPE_OPTIONS: Array<{ value: WeekType; key: string }> = [
  { value: 0, key: "timetable.week_all" },
  { value: 1, key: "timetable.week_single" },
  { value: 2, key: "timetable.week_double" },
];

export function CourseEditorDialog({
  open,
  onOpenChange,
  course,
  preset,
  config,
}: CourseEditorDialogProps) {
  const { t } = useTranslation();
  const addCourse = useTimetableStore((s) => s.addCourse);
  const updateCourse = useTimetableStore((s) => s.updateCourse);
  const removeCourse = useTimetableStore((s) => s.removeCourse);

  const [form, setForm] = useState<Input>(() => blankCourseInput(config));
  const [submitting, setSubmitting] = useState(false);

  // 打开时根据模式初始化表单
  useEffect(() => {
    if (!open) return;
    if (course) {
      const { id: _id, ...rest } = course;
      void _id;
      setForm(rest);
    } else {
      const base = blankCourseInput(config);
      if (preset) {
        setForm({
          ...base,
          weekDay: preset.weekDay,
          startSection: preset.startSection,
          endSection: Math.min(preset.startSection + 1, config.sections.length),
        });
      } else {
        setForm(base);
      }
    }
  }, [open, course, preset, config]);

  const isEdit = !!course;

  function patch<K extends keyof Input>(key: K, value: Input[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = isEdit
        ? await updateCourse(course!.id, form)
        : await addCourse(form);
      if (!res.ok) {
        showToast.error(res.error || t("timetable.save_failed"));
        return;
      }
      showToast.success(isEdit ? t("timetable.edit_ok") : t("timetable.add_ok"));
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!course) return;
    if (!window.confirm(t("timetable.confirm_delete"))) return;
    await removeCourse(course.id);
    showToast.success(t("timetable.delete_ok"));
    onOpenChange(false);
  }

  const sectionOptions = config.sections.map((s) => s.no);
  const weekOptions = Array.from({ length: config.totalWeek }, (_, i) => i + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("timetable.edit_title") : t("timetable.add_title")}</DialogTitle>
          <DialogDescription>{t("timetable.form_desc")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="tt-name">{t("timetable.course_name")}</Label>
            <Input
              id="tt-name"
              value={form.name}
              onChange={(e) => patch("name", e.target.value)}
              placeholder={t("timetable.course_name_ph")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tt-teacher">{t("timetable.teacher")}</Label>
            <Input
              id="tt-teacher"
              value={form.teacher}
              onChange={(e) => patch("teacher", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tt-room">{t("timetable.room")}</Label>
            <Input
              id="tt-room"
              value={form.room}
              onChange={(e) => patch("room", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tt-day">{t("timetable.week_day")}</Label>
            <NativeSelect
              id="tt-day"
              value={form.weekDay}
              onChange={(v) => patch("weekDay", Number(v))}
              options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({
                value: d,
                label: t("timetable.day_n", { n: d }),
              }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tt-weektype">{t("timetable.week_type")}</Label>
            <NativeSelect
              id="tt-weektype"
              value={form.weekType}
              onChange={(v) => patch("weekType", Number(v) as WeekType)}
              options={WEEK_TYPE_OPTIONS.map((o) => ({
                value: o.value,
                label: t(o.key),
              }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tt-start-sec">{t("timetable.start_section")}</Label>
            <NativeSelect
              id="tt-start-sec"
              value={form.startSection}
              onChange={(v) => {
                const s = Number(v);
                patch("startSection", s);
                if (form.endSection < s) patch("endSection", s);
              }}
              options={sectionOptions.map((n) => ({ value: n, label: String(n) }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tt-end-sec">{t("timetable.end_section")}</Label>
            <NativeSelect
              id="tt-end-sec"
              value={form.endSection}
              onChange={(v) => patch("endSection", Number(v))}
              options={sectionOptions.map((n) => ({ value: n, label: String(n) }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tt-start-week">{t("timetable.start_week")}</Label>
            <NativeSelect
              id="tt-start-week"
              value={form.startWeek}
              onChange={(v) => {
                const w = Number(v);
                patch("startWeek", w);
                if (form.endWeek < w) patch("endWeek", w);
              }}
              options={weekOptions.map((n) => ({ value: n, label: String(n) }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tt-end-week">{t("timetable.end_week")}</Label>
            <NativeSelect
              id="tt-end-week"
              value={form.endWeek}
              onChange={(v) => patch("endWeek", Number(v))}
              options={weekOptions.map((n) => ({ value: n, label: String(n) }))}
            />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>{t("timetable.color")}</Label>
            <div className="flex flex-wrap gap-2">
              {COURSE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => patch("color", c)}
                  className={`size-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    form.color === c ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {isEdit && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="mr-auto"
              disabled={submitting}
            >
              <Trash2 size={14} />
              {t("timetable.delete")}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("ui.cancel")}
          </Button>
          <Button variant="brand" size="sm" onClick={handleSubmit} disabled={submitting}>
            {t("ui.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 原生 select，套 Tailwind 样式与 Input 保持一致 */
function NativeSelect({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: number;
  onChange: (v: string) => void;
  options: Array<{ value: number; label: string }>;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-primary/30"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
