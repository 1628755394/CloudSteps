import { useCallback, useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import {
  addStudentWordMarkAsTeacher,
  getStudentWordMarkIdsAsTeacher,
  removeStudentWordMarkAsTeacher,
} from "../api/coaching";
import { CloudButton } from "./cloudsteps";
import { getTrainingStudent } from "../utils/trainingStudent";
import { showToast } from "../utils/toast";

/** 当前上课学员的单词标记集合；无学员时不请求。 */
export function useStudentWordMarks(wordIds: number[]) {
  const [student, setStudent] = useState(() => getTrainingStudent());
  const [marked, setMarked] = useState<Set<number>>(() => new Set());
  const [busyId, setBusyId] = useState<number | null>(null);

  const idsKey = useMemo(
    () =>
      [...new Set(wordIds.filter((id) => Number.isFinite(id) && id > 0))]
        .sort((a, b) => a - b)
        .join(","),
    [wordIds]
  );

  useEffect(() => {
    const sync = () => setStudent(getTrainingStudent());
    window.addEventListener("lb-training-student", sync);
    return () => window.removeEventListener("lb-training-student", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const sid = student?.id || 0;
    if (sid <= 0 || !idsKey) {
      setMarked(new Set());
      return;
    }
    const ids = idsKey.split(",").map(Number).filter(Boolean);
    void (async () => {
      try {
        const res = await getStudentWordMarkIdsAsTeacher(sid, ids);
        if (cancelled) return;
        if (res.code === 200) {
          setMarked(new Set(res.data?.markedIds || []));
        }
      } catch {
        if (!cancelled) setMarked(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [student?.id, idsKey]);

  const toggle = useCallback(
    async (wordId: number, wordBookId?: number) => {
      const sid = student?.id || 0;
      if (sid <= 0) {
        showToast.warning("请先选择上课学员");
        return;
      }
      if (!wordId || busyId === wordId) return;
      const next = !marked.has(wordId);
      setBusyId(wordId);
      setMarked((prev) => {
        const n = new Set(prev);
        if (next) n.add(wordId);
        else n.delete(wordId);
        return n;
      });
      try {
        if (next) {
          const res = await addStudentWordMarkAsTeacher(sid, {
            wordId,
            wordBookId: wordBookId || undefined,
          });
          if (res.code !== 200) {
            throw new Error(res.msg || "标记失败");
          }
          showToast.success(`已为 ${student?.name || "学员"} 标记`);
        } else {
          const res = await removeStudentWordMarkAsTeacher(sid, wordId);
          if (res.code !== 200) {
            throw new Error(res.msg || "取消失败");
          }
          showToast.info("已取消标记");
        }
      } catch (e: any) {
        setMarked((prev) => {
          const n = new Set(prev);
          if (next) n.delete(wordId);
          else n.add(wordId);
          return n;
        });
        showToast.error(e?.message || e?.msg || "操作失败");
      } finally {
        setBusyId(null);
      }
    },
    [student?.id, student?.name, marked, busyId]
  );

  return {
    student,
    enabled: (student?.id || 0) > 0,
    isMarked: (wordId: number) => marked.has(wordId),
    busyId,
    toggle,
  };
}

type MarkBtnProps = {
  wordId: number;
  wordBookId?: number;
  marked: boolean;
  enabled: boolean;
  busy?: boolean;
  onToggle: (wordId: number, wordBookId?: number) => void;
  className?: string;
};

export function StudentWordMarkButton({
  wordId,
  wordBookId,
  marked,
  enabled,
  busy,
  onToggle,
  className = "",
}: MarkBtnProps) {
  if (!enabled) return null;
  return (
    <CloudButton
      type="button"
      variant={marked ? "mint" : "ghost"}
      size="iconRound"
      className={`size-12 ${className}`}
      disabled={busy}
      title={marked ? "取消标记" : "标记给学员（课后复习）"}
      aria-label={marked ? "取消标记" : "标记单词"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(wordId, wordBookId);
      }}
    >
      <Star size={20} className={marked ? "fill-current" : undefined} />
    </CloudButton>
  );
}
