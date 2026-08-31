import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { getTeacherCoachingWeek, type CoachingWeekSchedule } from "../api/coaching";
import { useAuthStore } from "../stores/authStore";
import { minutesUntilCoachingEnd } from "../utils/coachingSchedule";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { CloudButton } from "./cloudsteps";

const FINAL_REMIND_THRESHOLD_MIN = 5;
const POLL_MS = 30_000;

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtYMD = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

type ReminderTitleKey = "coaching.class_ended_title" | "coaching.class_ending_title";

type ReminderModal = {
  open: boolean;
  titleKey: ReminderTitleKey;
  student: string;
  slot: string;
  minutesLeft: number | null;
  appointmentId: number;
};

/**
 * 老师端全站陪练提醒（含 material-selection 等无 Layout 页面）
 * 仅在最后 5 分钟提醒一次，到点自动下课
 */
export function CoachingClassReminder() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = user?.role || "";
  // @ts-ignore
  const isCoach = role === "teacher" || role === "user";

  const [modal, setModal] = useState<ReminderModal>({
    open: false,
    titleKey: "coaching.class_ending_title",
    student: "",
    slot: "",
    minutesLeft: null,
    appointmentId: 0,
  });

  const lastRemindAtRef = useRef<Record<number, number>>({});
  const finalRemindShownRef = useRef<Set<number>>(new Set());
  const endedShownRef = useRef<Set<number>>(new Set());
  const modalOpenRef = useRef(false);

  useEffect(() => {
    modalOpenRef.current = modal.open;
  }, [modal.open]);

  const openReminder = useCallback(
    (payload: Omit<ReminderModal, "open">) => {
      lastRemindAtRef.current[payload.appointmentId] = Date.now();
      setModal({ ...payload, open: true });
    },
    []
  );

  const closeReminder = useCallback(() => {
    setModal((m) => ({ ...m, open: false }));
  }, []);

  useEffect(() => {
    if (!isCoach || !user) return;

    const pickUrgent = (list: CoachingWeekSchedule[]) => {
      let best: { s: CoachingWeekSchedule; mins: number } | null = null;
      for (const s of list) {
        if (s.status !== "in_progress") continue;
        const mins = minutesUntilCoachingEnd(s.scheduledDate, s.endTime);
        if (mins == null) continue;
        if (!best || mins < best.mins) {
          best = { s, mins };
        }
      }
      return best;
    };

    const tick = async () => {
      if (modalOpenRef.current) return;

      try {
        const ref = fmtYMD(new Date());
        const res = await getTeacherCoachingWeek(ref);
        const schedules: CoachingWeekSchedule[] = Array.isArray(res.data?.schedules)
          ? res.data!.schedules!
          : [];

        const urgent = pickUrgent(schedules);
        if (!urgent) return;

        const { s, mins } = urgent;
        const student = s.students?.[0] || s.title || t("coaching.lesson_fallback", { id: s.id });
        const slot = `${s.scheduledDate?.slice(0, 10)} ${s.startTime}–${s.endTime}`;

        if (mins <= 0) {
          if (endedShownRef.current.has(s.id)) return;
          endedShownRef.current.add(s.id);
          openReminder({
            titleKey: "coaching.class_ended_title",
            student,
            slot,
            minutesLeft: 0,
            appointmentId: s.id,
          });
          return;
        }

        // 只在进入最后 5 分钟时提醒一次
        if (mins <= FINAL_REMIND_THRESHOLD_MIN) {
          if (finalRemindShownRef.current.has(s.id)) return;
          finalRemindShownRef.current.add(s.id);
          openReminder({
            titleKey: "coaching.class_ending_title",
            student,
            slot,
            minutesLeft: mins,
            appointmentId: s.id,
          });
        }
      } catch {
        // ignore
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => window.clearInterval(id);
  }, [isCoach, user, openReminder, t]);

  if (!isCoach || !user) return null;

  return (
    <Dialog open={modal.open} onOpenChange={(open) => !open && closeReminder()}>
      <DialogContent className="sm:max-w-md rounded-2xl border-[#E2E8F0] shadow-xl z-[200]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center">
              <Clock className="text-[#4ECDC4]" size={22} />
            </div>
            <DialogTitle className="text-lg text-[#2D3748]">{t(modal.titleKey)}</DialogTitle>
          </div>
          <DialogDescription asChild>
            <div className="text-left space-y-2 pt-2">
              <p className="text-base font-medium text-[#2D3748]">{modal.student}</p>
              <p className="text-sm text-[#718096]">{modal.slot}</p>
              {modal.minutesLeft != null && modal.minutesLeft > 0 ? (
                <p className="text-sm text-[#FF9800] font-medium">
                  {t("coaching.mins_left_prepare", { count: modal.minutesLeft })}
                </p>
              ) : (
                <p className="text-sm text-[#718096]">{t("coaching.auto_end_note")}</p>
              )}
              <p className="text-xs text-[#A0AEC0]">{t("coaching.final_remind_note")}</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <CloudButton
            type="button"
            onClick={closeReminder}
            className="w-full py-3 bg-[#4ECDC4] text-white rounded-full font-medium hover:bg-[#45b8b0]"
          >
            {t("announcements.got_it")}
          </CloudButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
