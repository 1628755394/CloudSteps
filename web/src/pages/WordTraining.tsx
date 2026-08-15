import { Lightbulb, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CloudButton } from "../components/cloudsteps";
import { CloudSelect } from "../components/cloudsteps/arco";
import { FlowPageShell } from "../components/PageTransition";

import { TopBar } from "../components/TopBar";
import { useAuthStore } from "../stores/authStore";
import {
  listAllTeacherCoachingQuotas,
  getTeacherCoachingWeek,
  listStudentWordBooksAsTeacher,
  type StudentWordBookItem,
  type TeacherCoachingQuotaRow,
} from "../api/coaching";
import {
  fetchLighthouse,
  getCachedLighthouse,
  revalidateLighthouse,
} from "../utils/lighthouseCache";
import {
  getCachedWordBooks,
  loadWordBooksStaleWhileRevalidate,
  type CachedWordBook,
} from "../utils/wordBooksCache";
import { getTrainingStudent, setTrainingStudent } from "../utils/trainingStudent";

type LighthouseDay = { id: string; count: number; label: string };

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtYMD = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function resolvePick(wbs: CachedWordBook[]): CachedWordBook | undefined {
  const cachedName = sessionStorage.getItem("lb_wordbook_name") || "";
  const cachedId = Number(sessionStorage.getItem("lb_wordbook_id") || 0);
  return wbs.find((x) => x.id === cachedId) || wbs.find((x) => x.name === cachedName) || wbs[0];
}

function studentLabel(row: TeacherCoachingQuotaRow) {
  const s = row.student;
  return s?.displayName || s?.username || s?.email || `学员 #${row.studentId}`;
}

export default function WordTraining() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = (user as { role?: string } | null)?.role || "user";
  const isStudent = role === "student";
  const isCoach = !isStudent;

  const selfName =
    (user as { displayName?: string; username?: string } | null)?.displayName ||
    (user as { username?: string } | null)?.username ||
    (user as { email?: string } | null)?.email ||
    "-";

  const cachedStudent = getTrainingStudent();
  const [studentId, setStudentId] = useState<string>(
    cachedStudent?.id ? String(cachedStudent.id) : ""
  );
  const [studentName, setStudentName] = useState(
    isStudent ? selfName : cachedStudent?.name || ""
  );
  const [students, setStudents] = useState<TeacherCoachingQuotaRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const initialBooks = getCachedWordBooks() || [];
  const initialPick = resolvePick(initialBooks);

  const [wordBooks, setWordBooks] = useState<CachedWordBook[]>(initialBooks);
  const [studentWordBooks, setStudentWordBooks] = useState<StudentWordBookItem[]>([]);
  const userPickedByStudent = useRef<Record<string, number>>({});
  const [selectedWordBookId, setSelectedWordBookId] = useState<number>(initialPick?.id || 0);
  const [memoryData, setMemoryData] = useState<LighthouseDay[]>(() => {
    const id = initialPick?.id || 0;
    return id ? getCachedLighthouse(id)?.days || [] : [];
  });
  const [pendingCount, setPendingCount] = useState<number>(() => {
    const id = initialPick?.id || 0;
    return id ? Number(getCachedLighthouse(id)?.pendingCount || 0) : 0;
  });
  const [masteredCount, setMasteredCount] = useState<number>(() => {
    const id = initialPick?.id || 0;
    return id ? Number(getCachedLighthouse(id)?.masteredCount || 0) : 0;
  });
  const [todayNewLearned, setTodayNewLearned] = useState<number>(() => {
    const id = initialPick?.id || 0;
    return id ? Number(getCachedLighthouse(id)?.todayNewLearned || 0) : 0;
  });

  const todayLabel = useMemo(() => fmtYMD(new Date()), []);

  const handleBack = () => {
    navigate("/");
  };

  const applyLighthouse = (data: {
    days?: LighthouseDay[];
    pendingCount?: number;
    masteredCount?: number;
    todayNewLearned?: number;
  }) => {
    setMemoryData(Array.isArray(data.days) ? data.days : []);
    setPendingCount(Number(data.pendingCount || 0));
    setMasteredCount(Number(data.masteredCount || 0));
    setTodayNewLearned(Number(data.todayNewLearned ?? 0));
  };

  const pickWordBook = (wb: { id: number; name: string }, opts?: { fromUser?: boolean }) => {
    const cached = getCachedLighthouse(wb.id);
    if (cached) applyLighthouse(cached);
    setSelectedWordBookId(wb.id);
    sessionStorage.setItem("lb_wordbook_id", String(wb.id));
    sessionStorage.setItem("lb_wordbook_name", wb.name);
    revalidateLighthouse(wb.id);
    if (opts?.fromUser && studentId) {
      userPickedByStudent.current[studentId] = wb.id;
    }
  };

  useEffect(() => {
    if (isStudent) {
      setStudentName(selfName);
      return;
    }
    let mounted = true;
    setStudentsLoading(true);
    (async () => {
      try {
        const [rows, weekRes] = await Promise.all([
          listAllTeacherCoachingQuotas(),
          getTeacherCoachingWeek(fmtYMD(new Date())).catch(() => null),
        ]);
        if (!mounted) return;
        setStudents(rows);

        // 优先：已选学员 → 今日进行中课次学员 → 名下第一位
        const saved = getTrainingStudent();
        const inProgress = (weekRes?.data?.schedules || []).find((s) => s.status === "in_progress");
        const fromClassId = inProgress?.studentId ? Number(inProgress.studentId) : 0;
        const fromClassRow = fromClassId ? rows.find((r) => r.studentId === fromClassId) : undefined;
        const fromClassName =
          inProgress?.students?.[0] || (fromClassRow ? studentLabel(fromClassRow) : "");

        let pickId = saved?.id || 0;
        let pickName = saved?.name || "";
        if (!pickId && fromClassId) {
          pickId = fromClassId;
          pickName = fromClassName || `学员 #${fromClassId}`;
        }
        if (!pickId && rows[0]) {
          pickId = rows[0].studentId;
          pickName = studentLabel(rows[0]);
        }
        if (pickId) {
          setStudentId(String(pickId));
          setStudentName(pickName);
          setTrainingStudent(pickId, pickName);
        }
      } catch {
        if (mounted) setStudents([]);
      } finally {
        if (mounted) setStudentsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isStudent, selfName]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await loadWordBooksStaleWhileRevalidate();
        if (!mounted) return;
        setWordBooks(all);

        const pick = resolvePick(all);
        if (pick) {
          setSelectedWordBookId((prev) => prev || pick.id);
          sessionStorage.setItem("lb_wordbook_id", String(pick.id));
          sessionStorage.setItem("lb_wordbook_name", pick.name);
          const cached = getCachedLighthouse(pick.id);
          if (cached) applyLighthouse(cached);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 教练选学员时：拉取学员词库，优先展示；仅一本则自动选中（除非该学员已手动选过）
  useEffect(() => {
    if (!isCoach || !studentId) {
      setStudentWordBooks([]);
      return;
    }
    let mounted = true;
    const sid = Number(studentId);
    (async () => {
      try {
        const res = await listStudentWordBooksAsTeacher(sid);
        if (!mounted) return;
        const list = res.code === 200 && Array.isArray(res.data?.list) ? res.data.list : [];
        setStudentWordBooks(list);

        const manualId = userPickedByStudent.current[studentId];
        if (manualId) {
          const fromAssigned = list.find((b) => b.id === manualId);
          const fromGlobal =
            fromAssigned ||
            (getCachedWordBooks() || []).find((b) => b.id === manualId) ||
            wordBooks.find((b) => b.id === manualId);
          if (fromAssigned) {
            pickWordBook({ id: fromAssigned.id, name: fromAssigned.name });
            return;
          }
          if (fromGlobal) {
            pickWordBook({ id: fromGlobal.id, name: fromGlobal.name });
            return;
          }
        }
        if (list.length === 1) {
          pickWordBook({ id: list[0].id, name: list[0].name });
        }
      } catch {
        if (mounted) setStudentWordBooks([]);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to student change
  }, [isCoach, studentId]);

  useEffect(() => {
    let mounted = true;
    if (!selectedWordBookId) return;

    const cached = getCachedLighthouse(selectedWordBookId);
    if (cached) applyLighthouse(cached);

    (async () => {
      try {
        const data = await fetchLighthouse(selectedWordBookId);
        if (!mounted) return;
        applyLighthouse(data);
      } catch {
        if (!mounted) return;
        if (!cached) {
          setMemoryData([]);
          setPendingCount(0);
          setMasteredCount(0);
          setTodayNewLearned(0);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedWordBookId]);

  const wordBookOptions = useMemo(() => {
    const assignedIds = new Set(studentWordBooks.map((b) => b.id));
    const assigned = studentWordBooks.map((b) => ({
      label: `学员词库 · ${b.name}`,
      value: String(b.id),
    }));
    const rest = wordBooks
      .filter((w) => !assignedIds.has(w.id))
      .map((w) => ({
        label: w.name,
        value: String(w.id),
      }));
    // 学员词库可能不在全局缓存里，补全名称查找
    return [...assigned, ...rest];
  }, [studentWordBooks, wordBooks]);

  const findWordBookName = (id: number) => {
    const fromStudent = studentWordBooks.find((b) => b.id === id);
    if (fromStudent) return fromStudent.name;
    return wordBooks.find((x) => x.id === id)?.name || "";
  };

  const studentOptions = useMemo(
    () =>
      students.map((r) => ({
        label: studentLabel(r),
        value: String(r.studentId),
      })),
    [students]
  );

  return (
    <FlowPageShell className="min-h-dvh bg-gray-50 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <TopBar title="单词训练" onBack={handleBack} />

      <div className="px-4 mt-3 space-y-3 pb-4">
        <CloudSelect
          value={selectedWordBookId ? String(selectedWordBookId) : undefined}
          onChange={(v) => {
            const id = Number(v);
            const name = findWordBookName(id);
            if (id && name) pickWordBook({ id, name }, { fromUser: true });
          }}
          options={wordBookOptions}
          placeholder={wordBooks.length || studentWordBooks.length ? "选择词库" : "加载词库中…"}
          disabled={!wordBooks.length && !studentWordBooks.length}
          showSearch
          allowClear={false}
          sheetTitle="选择词库"
        />

        <div className="bg-white rounded-xl px-4 py-3 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#718096]">训练日期</span>
            <span className="text-[#2D3748] font-medium tabular-nums">{todayLabel}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#718096]">今日训新</span>
            <span className="text-[#2D3748] font-medium">{todayNewLearned} 词</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[#718096] shrink-0">学生信息</span>
            {isCoach ? (
              <div className="min-w-0 flex-1 max-w-[70%]">
                <CloudSelect
                  value={studentId || undefined}
                  onChange={(v) => {
                    const id = String(v ?? "");
                    const row = students.find((r) => String(r.studentId) === id);
                    const name = row ? studentLabel(row) : "";
                    setStudentId(id);
                    setStudentName(name);
                    if (id && name) setTrainingStudent(Number(id), name);
                  }}
                  options={studentOptions}
                  placeholder={studentsLoading ? "加载学员…" : "选择学员"}
                  disabled={studentsLoading || !studentOptions.length}
                  showSearch
                  allowClear={false}
                  sheetTitle="选择学员"
                />
              </div>
            ) : (
              <span className="text-[#2D3748] font-medium truncate max-w-[60%] text-right">
                {studentName || selfName}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div
            onClick={() => navigate("/lighthouse-words?step=today")}
            className="bg-white rounded-xl p-3 text-center shadow-sm cursor-pointer hover:bg-gray-50 active:scale-95 transition-all"
          >
            <div className="text-xl font-bold text-[#4ECDC4] mb-0.5">{todayNewLearned}</div>
            <div className="text-xs text-[#718096]">今日训新</div>
          </div>
          <div
            onClick={() => navigate("/lighthouse-words?step=01")}
            className="bg-white rounded-xl p-3 text-center shadow-sm cursor-pointer hover:bg-gray-50 active:scale-95 transition-all"
          >
            <div className="text-xl font-bold text-[#FF9800] mb-0.5">{memoryData[0]?.count ?? 0}</div>
            <div className="text-xs text-[#718096]">今日复习目标</div>
          </div>
          <div
            onClick={() => navigate("/lighthouse-words?step=mastered")}
            className="bg-white rounded-xl p-3 text-center shadow-sm cursor-pointer hover:bg-gray-50 active:scale-95 transition-all"
          >
            <div className="text-xl font-bold text-[#66BB6A] mb-0.5">{masteredCount}</div>
            <div className="text-xs text-[#718096]">累计识词</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex flex-col items-center gap-1 mb-3">
            <div className="flex items-center justify-center gap-2">
              <Lightbulb className="text-[#FFD700]" size={22} />
              <h3 className="text-base font-semibold text-[#2D3748]">智能记忆灯塔</h3>
            </div>
            <p className="text-[11px] text-[#A0AEC0] text-center px-2">
              按艾宾浩斯复习阶段（第 1～7 步）统计当前词库词汇量
            </p>
          </div>

          {/* PC 限制九宫格宽度，避免 aspect-square 在宽屏撑得过大 */}
          <div className="mx-auto w-full max-w-[340px] sm:max-w-[380px] lg:max-w-[400px] space-y-2.5">
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {memoryData.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/lighthouse-words?step=${item.id}`)}
                  className="aspect-square max-h-[7.5rem] lg:max-h-[6.75rem] bg-gradient-to-br from-[#4ECDC4] to-[#45b8b0] rounded-xl flex flex-col items-center justify-center text-white cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                >
                  <div className="text-xs opacity-80 mb-0.5">{item.id}</div>
                  <div className="text-lg lg:text-xl font-bold">{item.count}</div>
                  <div className="text-[10px] sm:text-xs opacity-90 mt-0.5 text-center leading-tight px-0.5 line-clamp-3">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {memoryData.slice(3, 6).map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/lighthouse-words?step=${item.id}`)}
                  className="aspect-square max-h-[7.5rem] lg:max-h-[6.75rem] bg-gradient-to-br from-[#66BB6A] to-[#5ca860] rounded-xl flex flex-col items-center justify-center text-white cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                >
                  <div className="text-xs opacity-80 mb-0.5">{item.id}</div>
                  <div className="text-lg lg:text-xl font-bold">{item.count}</div>
                  <div className="text-[10px] sm:text-xs opacity-90 mt-0.5 text-center leading-tight px-0.5 line-clamp-3">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {memoryData.slice(6, 7).map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/lighthouse-words?step=${item.id}`)}
                  className="aspect-square max-h-[7.5rem] lg:max-h-[6.75rem] bg-gradient-to-br from-[#FF9800] to-[#e68900] rounded-xl flex flex-col items-center justify-center text-white cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                >
                  <div className="text-xs opacity-80 mb-0.5">{item.id}</div>
                  <div className="text-lg lg:text-xl font-bold">{item.count}</div>
                  <div className="text-[10px] sm:text-xs opacity-90 mt-0.5 text-center leading-tight px-0.5 line-clamp-3">
                    {item.label}
                  </div>
                </div>
              ))}
              <div
                onClick={() => navigate("/lighthouse-words?step=pending")}
                className="aspect-square max-h-[7.5rem] lg:max-h-[6.75rem] bg-gray-100 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 active:scale-95 transition-all"
              >
                <div className="text-lg lg:text-xl font-bold text-[#718096]">{pendingCount}</div>
                <div className="text-xs text-[#718096] mt-0.5">待学</div>
              </div>
              <div
                onClick={() => navigate("/lighthouse-words?step=mastered")}
                className="aspect-square max-h-[7.5rem] lg:max-h-[6.75rem] bg-gradient-to-br from-[#FFD700] to-[#e6c200] rounded-xl flex flex-col items-center justify-center text-white cursor-pointer hover:opacity-90 active:scale-95 transition-all"
              >
                <div className="text-lg lg:text-xl font-bold">{masteredCount}</div>
                <div className="text-xs opacity-80 mt-0.5">掌握</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <CloudButton
            variant="brandOutline"
            size="pillLg"
            className="flex-1"
            onClick={() => navigate("/review-check")}
          >
            开始复习
          </CloudButton>
          <CloudButton
            variant="brand"
            size="pillLg"
            className="flex-1"
            onClick={() => navigate("/pre-training-check")}
          >
            继续练习
          </CloudButton>
        </div>
      </div>

      <div className="fixed bottom-5 right-5 z-30">
        <CloudButton
          variant="brand"
          size="iconRound"
          className="size-12 shadow-lg"
          onClick={() => navigate("/pre-training-check")}
          aria-label="进入训前检测"
        >
          <ArrowRight size={22} />
        </CloudButton>
      </div>
    </FlowPageShell>
  );
}
