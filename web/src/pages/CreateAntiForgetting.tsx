import { CloudButton } from "../components/cloudsteps";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listStudySessions, updateStudySessionsPracticeTime } from "../api/study";
import { showToast } from "../utils/toast";
import { formatApiMessage } from "../utils/apiMessage";
import { getTrainingStudent } from "../utils/trainingStudent";
import { isValidSnowflakeId, normalizeSnowflakeId } from "../utils/json-snowflake";

function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatHmFromTs(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return toDateInputValue(dt);
}

function readLessonDefaults() {
  const now = Date.now();
  const endRaw = Number(sessionStorage.getItem("lb_lesson_practice_end") || now);
  const startRaw = Number(sessionStorage.getItem("lb_lesson_practice_start") || 0);
  const endTs = Number.isFinite(endRaw) && endRaw > 0 ? endRaw : now;
  const startTs =
    Number.isFinite(startRaw) && startRaw > 0 && startRaw <= endTs
      ? startRaw
      : endTs;
  return {
    date: toDateInputValue(new Date(startTs)),
    startTime: formatHmFromTs(startTs),
  };
}

export default function CreateAntiForgetting() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const trainingStudent = useMemo(() => getTrainingStudent(), []);
  const defaults = useMemo(() => readLessonDefaults(), []);

  const [lessonDate, setLessonDate] = useState(defaults.date);
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSessions(true);
      try {
        const studentId = normalizeSnowflakeId(trainingStudent?.id);
        const res = await listStudySessions({
          page: 1,
          pageSize: 50,
          sessionType: "study",
          status: "completed",
          date: defaults.date,
          ...(studentId ? { studentId } : {}),
        });
        if (cancelled) return;
        const list = Array.isArray(res.data?.list) ? res.data.list : [];
        const ids = list
          .map((row) => normalizeSnowflakeId(row.id))
          .filter((id) => isValidSnowflakeId(id));
        setSessionIds(ids);

        const latest = list.find((row) => row.startedAt) || list[0];
        if (latest?.startedAt) {
          const start = new Date(latest.startedAt);
          if (!Number.isNaN(start.getTime())) {
            setLessonDate(toDateInputValue(start));
            setStartTime(formatHmFromTs(start.getTime()));
          }
        }
      } catch {
        if (!cancelled) setSessionIds([]);
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaults.date, trainingStudent?.id]);

  const handleConfirm = async () => {
    if (!startTime) {
      showToast.warning(t("create_anti_forgetting.time_invalid"));
      return;
    }
    if (sessionIds.length === 0) {
      showToast.warning(t("create_anti_forgetting.no_sessions_hint"));
      return;
    }
    setSaving(true);
    try {
      const studentId = normalizeSnowflakeId(trainingStudent?.id);
      const res = await updateStudySessionsPracticeTime({
        date: lessonDate,
        startTime,
        ...(studentId ? { studentId } : {}),
        sessionIds,
      });
      if (res.code !== 200) {
        showToast.error(formatApiMessage(res.msg, "common.operation_failed"));
        return;
      }
      sessionStorage.removeItem("lb_lesson_practice_start");
      sessionStorage.removeItem("lb_lesson_practice_end");
      showToast.success(t("create_anti_forgetting.saved_toast"));
      // 抗遗忘从下一天开始，跳到次日日历
      navigate(`/anti-forgetting?date=${encodeURIComponent(addDaysYmd(lessonDate, 1))}`, {
        replace: true,
      });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? formatApiMessage(String((e as { msg: string }).msg))
          : t("common.operation_failed");
      showToast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="bg-card sticky top-0 z-10 border-b border-border">
        <div className="flex items-center px-4 h-14">
          <CloudButton
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="-ml-1"
          >
            <ArrowLeft size={22} className="text-charcoal" />
          </CloudButton>
          <h1 className="flex-1 text-center text-base font-semibold text-foreground -ml-8">
            {t("create_anti_forgetting.title")}
          </h1>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4 max-w-lg mx-auto pb-8">
        <div className="rounded-xl bg-primary-soft px-4 py-3">
          {trainingStudent?.name ? (
            <p className="text-xs text-muted-foreground">
              {t("create_anti_forgetting.student", { name: trainingStudent.name })}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">{t("create_anti_forgetting.time_label")}</p>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">{t("create_anti_forgetting.start_time")}</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary"
            />
          </label>
          {loadingSessions ? (
            <p className="text-xs text-muted-foreground">{t("create_anti_forgetting.loading_sessions")}</p>
          ) : sessionIds.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("create_anti_forgetting.sessions_count", { count: sessionIds.length })}
            </p>
          ) : (
            <p className="text-xs text-amber-700">{t("create_anti_forgetting.no_sessions_hint")}</p>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {t("create_anti_forgetting.count_hint")}
        </p>

        <CloudButton
          variant="brand"
          className="w-full h-11"
          loading={saving}
          disabled={!loadingSessions && sessionIds.length === 0}
          onClick={() => void handleConfirm()}
        >
          {t("create_anti_forgetting.save_view")}
        </CloudButton>
        {!loadingSessions && sessionIds.length === 0 ? (
          <CloudButton
            variant="outline"
            className="w-full h-11"
            onClick={() =>
              navigate(`/anti-forgetting?date=${encodeURIComponent(addDaysYmd(toDateInputValue(new Date()), 1))}`)
            }
          >
            {t("create_anti_forgetting.skip")}
          </CloudButton>
        ) : null}
      </div>
    </div>
  );
}
