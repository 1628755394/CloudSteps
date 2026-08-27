import { useEffect, useState } from "react";
import { CoachingSchedulePanel } from "../components/CoachingSchedulePanel";
import { useAuthStore } from "../stores/authStore";

/**
 * 备课页 `/lesson-prep` — 周课表（点天排课 + 时间轴展示）。
 * 教练可排课/上下课；学员只读自己的课表。
 */
export default function Home() {
  const user = useAuthStore((s) => s.user);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const role = (user as { role?: string } | null)?.role || "user";
  const isStudent = role === "student";
  const mode = isStudent ? "student" : "coach";

  useEffect(() => {
    const t = window.setInterval(() => setNowTs(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="flex h-full flex-col min-h-0 overflow-hidden">
      <CoachingSchedulePanel nowTs={nowTs} mode={mode} />
    </div>
  );
}
