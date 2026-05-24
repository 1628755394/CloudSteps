import { useCallback, useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { getTeacherCoachingWeek, type CoachingWeekSchedule } from "@/api/coaching";
import { useAuthStore } from "@/stores/authStore";
import { minutesUntilCoachingEnd } from "@/utils/coachingSchedule";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CloudButton } from "@/components/cloudsteps";

const REMIND_EVERY_MS = 3 * 60 * 1000;
const POLL_MS = 30_000;

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtYMD = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

type ReminderModal = {
  open: boolean;
  title: string;
  student: string;
  slot: string;
  minutesLeft: number | null;
  appointmentId: number;
};

/**
 * 老师端全站陪练提醒（含 material-selection 等无 Layout 页面）
 * 上课中每 3 分钟弹出一次模态框，直至下课或到点自动结束
 */
export function CoachingClassReminder() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role || "";
  // @ts-ignore
  const isCoach = role === "teacher" || role === "user";

  const [modal, setModal] = useState<ReminderModal>({
    open: false,
    title: "",
    student: "",
    slot: "",
    minutesLeft: null,
    appointmentId: 0,
  });

  const lastRemindAtRef = useRef<Record<number, number>>({});
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
        const student = s.students?.[0] || s.title || `排课 #${s.id}`;
        const slot = `${s.scheduledDate?.slice(0, 10)} ${s.startTime}–${s.endTime}`;

        if (mins <= 0) {
          if (endedShownRef.current.has(s.id)) return;
          endedShownRef.current.add(s.id);
          openReminder({
            title: "陪练课已结束",
            student,
            slot,
            minutesLeft: 0,
            appointmentId: s.id,
          });
          return;
        }

        const last = lastRemindAtRef.current[s.id] ?? 0;
        if (Date.now() - last < REMIND_EVERY_MS) return;

        const title = mins <= 5 ? "陪练即将结束" : "陪练下课提醒";
        openReminder({
          title,
          student,
          slot,
          minutesLeft: mins,
          appointmentId: s.id,
        });
      } catch {
        // ignore
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => window.clearInterval(id);
  }, [isCoach, user, openReminder]);

  if (!isCoach || !user) return null;

  return (
    <Dialog open={modal.open} onOpenChange={(open) => !open && closeReminder()}>
      <DialogContent className="sm:max-w-md rounded-2xl border-[#E2E8F0] shadow-xl z-[200]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center">
              <Clock className="text-[#4ECDC4]" size={22} />
            </div>
            <DialogTitle className="text-lg text-[#2D3748]">{modal.title}</DialogTitle>
          </div>
          <DialogDescription asChild>
            <div className="text-left space-y-2 pt-2">
              <p className="text-base font-medium text-[#2D3748]">{modal.student}</p>
              <p className="text-sm text-[#718096]">{modal.slot}</p>
              {modal.minutesLeft != null && modal.minutesLeft > 0 ? (
                <p className="text-sm text-[#FF9800] font-medium">
                  还剩约 {modal.minutesLeft} 分钟，请准备下课。
                </p>
              ) : (
                <p className="text-sm text-[#718096]">
                  系统已按排课结束时间自动下课并结算（不超过计划时长）。
                </p>
              )}
              <p className="text-xs text-[#A0AEC0]">每 3 分钟提醒一次，关闭后仍会按时再次提醒。</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <CloudButton
            type="button"
            onClick={closeReminder}
            className="w-full py-3 bg-[#4ECDC4] text-white rounded-full font-medium hover:bg-[#45b8b0]"
          >
            知道了
          </CloudButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
