import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { BookOpen, ChevronRight, ChevronLeft, ClipboardList, FileText, Search, Users } from "lucide-react";
import { CloudButton } from "../components/cloudsteps";
import { CoachOnboarding } from "../components/CoachOnboarding";
import { CloudCard, CloudEmpty, CloudSpin, CloudInput } from "../components/cloudsteps/arco";
import { MobileSelectSheet } from "../components/cloudsteps/MobileWheelPicker";
import { listWordBooks, type WordBookItem, type WordBookGroup } from "../api/wordbooks";
import { useAuthStore } from "../stores/authStore";
import { listAllTeacherCoachingQuotas, type TeacherCoachingQuotaRow } from "../api/coaching";
import {
  clearTrainingStudent,
  getTrainingStudent,
  setTrainingStudent,
  studentLabelFromQuota,
} from "../utils/trainingStudent";
import { shouldShowCoachOnboarding } from "../utils/coachOnboarding";
import { showToast } from "../utils/toast";

import { kickoffVocabTestPrefetch } from "../utils/vocabTestCache";
import { kickoffWordBooksPrefetch } from "../utils/wordBooksCache";

// 封面渐变色组（按 tag hash 分配）
const COVER_GRADIENTS = [
  "from-[#4ECDC4] to-[#44A5A0]",
  "from-[#5B8DEF] to-[#4A7BC8]",
  "from-[#F6B042] to-[#E89832]",
  "from-[#E8718E] to-[#D45C78]",
  "from-[#8B7FD8] to-[#7B6BC8]",
  "from-[#66BB6A] to-[#4CAF50]",
  "from-[#FF8A65] to-[#FF7043]",
  "from-[#26C6DA] to-[#00ACC1]",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickGradient(tag: string): string {
  return COVER_GRADIENTS[hashStr(tag) % COVER_GRADIENTS.length];
}

// 从 description JSON 解析封面信息
interface CoverInfo {
  tag: string;
  t1: string; // cover_title1, e.g. "小学英语"
  t2: string; // cover_title2, e.g. "一年级上册"
  cat: string;
}

function parseCover(desc?: string): CoverInfo | null {
  if (!desc) return null;
  try {
    const obj = JSON.parse(desc);
    if (obj && (obj.t1 || obj.t2 || obj.tag)) return obj;
    return null;
  } catch {
    return null;
  }
}

const PAGE_SIZE = 24;

const DEFAULT_GROUPS: WordBookGroup[] = [
  { key: "", label: "全部" },
  { key: "primary", label: "小学" },
  { key: "middle", label: "初中" },
  { key: "high", label: "高中" },
  { key: "cet4", label: "大学四级" },
  { key: "cet6", label: "大学六级" },
  { key: "kaoyan", label: "考研" },
  { key: "abroad", label: "留学考试" },
  { key: "tem", label: "专四专八" },
  { key: "textbook", label: "教材" },
];

export default function WordBooks() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const role = user?.role || "user";
  const isCoach = role === "user" || role === "admin" || role === "teacher";
  const userId = user?.id ? Number(user.id) : 0;
  const [students, setStudents] = useState<TeacherCoachingQuotaRow[]>([]);
  const [studentId, setStudentId] = useState(() => String(getTrainingStudent()?.id || ""));
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [books, setBooks] = useState<WordBookItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [group, setGroup] = useState("");
  const [groups, setGroups] = useState<WordBookGroup[]>(DEFAULT_GROUPS);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!hasHydrated || !userId) return;
    setShowOnboarding(shouldShowCoachOnboarding(role, userId));
  }, [hasHydrated, userId, role]);

  const fetchBooks = useCallback(async (p: number, kw: string, g: string) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await listWordBooks({ page: p, pageSize: PAGE_SIZE, keyword: kw || undefined, group: g || undefined });
      if (res.code !== 200) {
        setErr(res.msg || "加载失败");
        setBooks([]);
        setTotal(0);
        return;
      }
      setBooks(Array.isArray(res.data.list) ? res.data.list : []);
      setTotal(res.data.total || 0);
      if (res.data.groups && res.data.groups.length > 0) {
        setGroups(res.data.groups);
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "加载失败";
      setErr(msg);
      setBooks([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBooks(page, keyword, group);
  }, [page, keyword, group, fetchBooks]);

  useEffect(() => {
    if (!isCoach) return;
    let mounted = true;
    setLoadingStudents(true);
    listAllTeacherCoachingQuotas()
      .then((rows) => {
        if (!mounted) return;
        setStudents(rows);
        if (!rows.length) {
          clearTrainingStudent();
          setStudentId("");
          return;
        }
        const saved = getTrainingStudent();
        const selected = (saved?.id && rows.find((row) => row.studentId === saved.id)) || rows[0];
        if (selected) {
          setStudentId(String(selected.studentId));
          setTrainingStudent(selected.studentId, studentLabelFromQuota(selected));
        }
      })
      .catch(() => {
        if (mounted) setStudents([]);
      })
      .finally(() => {
        if (mounted) setLoadingStudents(false);
      });
    return () => {
      mounted = false;
    };
  }, [isCoach]);

  const studentOptions = useMemo(
    () => students.map((row) => ({ label: studentLabelFromQuota(row), value: String(row.studentId) })),
    [students]
  );

  const handleGroupChange = (g: string) => {
    setGroup(g);
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const handleSearch = () => {
    setPage(1);
    setKeyword(searchInput.trim());
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setPage(1);
    setKeyword("");
  };

  return (
    <div className="space-y-4">
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-medium text-muted-foreground shrink-0">常用</h2>
          {isCoach ? (
            <div
              className="flex items-center gap-2 shrink-0"
              data-coach="picker"
            >
              <span className="text-xs text-muted-foreground">学员</span>
              <MobileSelectSheet
                title="选择学员"
                className="w-44 shrink-0"
                style={{ minWidth: 176 }}
                placeholder={
                  loadingStudents ? "加载中…" : studentOptions.length ? "选择学员" : "暂无学员"
                }
                options={studentOptions}
                value={studentId || undefined}
                showSearch={studentOptions.length > 4}
                disabled={loadingStudents || studentOptions.length === 0}
                onChange={(value) => {
                  const row = students.find((item) => String(item.studentId) === value);
                  if (!row) return;
                  setStudentId(String(row.studentId));
                  setTrainingStudent(row.studentId, studentLabelFromQuota(row));
                }}
              />
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <CloudButton
            type="button"
            variant="card"
            onClick={() => {
              if (isCoach && !loadingStudents && students.length === 0) {
                showToast.info("请先添加学员后再开始词汇测试");
                navigate("/my-students/new");
                return;
              }
              if (isCoach && !studentId) {
                showToast.info("请先选择学员后再开始词汇测试");
                return;
              }
              kickoffVocabTestPrefetch();
              navigate("/vocabulary-test");
            }}
            className="!min-h-0 !h-auto !flex-row !items-center gap-2.5 !p-3 sm:!p-3.5"
          >
            <div className="w-8 h-8 shrink-0 bg-primary-soft rounded-xl flex items-center justify-center">
              <FileText className="text-primary" size={16} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-foreground text-sm font-semibold leading-snug">词汇测试</div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">进入测评</p>
            </div>
          </CloudButton>

          <CloudButton
            type="button"
            variant="card"
            data-coach="training"
            onClick={() => {
              if (isCoach && !loadingStudents && students.length === 0) {
                showToast.info("请先添加学员后再开始单词训练");
                navigate("/my-students/new");
                return;
              }
              kickoffWordBooksPrefetch();
              navigate("/word-training");
            }}
            className="!min-h-0 !h-auto !flex-row !items-center gap-2.5 !p-3 sm:!p-3.5"
          >
            <div className="w-8 h-8 shrink-0 bg-tint-sky rounded-xl flex items-center justify-center">
              <BookOpen className="text-secondary-brand" size={16} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-foreground text-sm font-semibold leading-snug">单词训练</div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">选择词库</p>
            </div>
          </CloudButton>

          {isCoach && (
            <CloudButton
              type="button"
              variant="card"
              data-coach="students"
              onClick={() => navigate("/my-students")}
              className="!min-h-0 !h-auto !flex-row !items-center gap-2.5 !p-3 sm:!p-3.5"
            >
              <div className="w-8 h-8 shrink-0 bg-tint-sky rounded-xl flex items-center justify-center">
                <Users className="text-secondary-brand" size={16} />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="text-foreground text-sm font-semibold leading-snug">学员管理</div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">学员与时长</p>
              </div>
            </CloudButton>
          )}

          <CloudButton
            type="button"
            variant="card"
            onClick={() => navigate("/training-records")}
            className="!min-h-0 !h-auto !flex-row !items-center gap-2.5 !p-3 sm:!p-3.5"
          >
            <div className="w-8 h-8 shrink-0 bg-tint-mint rounded-xl flex items-center justify-center">
              <ClipboardList className="text-success" size={16} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-foreground text-sm font-semibold leading-snug">学习记录</div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">正课与复习</p>
            </div>
          </CloudButton>
        </div>
      </section>

      {/* 搜索栏 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <CloudInput
            value={searchInput}
            onChange={(val: string) => setSearchInput(val)}
            onKeyDown={handleSearchKeyDown}
            placeholder="搜索词库名称…"
            prefix={<Search size={16} className="text-muted-foreground" />}
            allowClear
          />
        </div>
        {keyword && (
          <button
            onClick={handleClearSearch}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
          >
            清除
          </button>
        )}
      </div>

      {err && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {/* 分组标签 */}
      <div className="flex items-center gap-2 flex-wrap">
        {groups.map((g) => (
          <button
            key={g.key || "all"}
            onClick={() => handleGroupChange(g.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              group === g.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {loading ? (
        <CloudCard className="p-10">
          <CloudSpin tip="加载中…" />
        </CloudCard>
      ) : books.length === 0 ? (
        <CloudCard className="p-8">
          <CloudEmpty description={keyword ? "未找到匹配的词库" : "暂无词库"} />
        </CloudCard>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {books.map((b) => {
              const cover = parseCover(b.description);
              const gradient = pickGradient(cover?.tag || b.name);
              return (
                <Link
                  key={b.id}
                  to={`/word-books/${b.id}`}
                  className="group block no-underline rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30"
                >
                  <CloudCard
                    interactive
                    className="overflow-hidden h-full transition-colors group-hover:border-primary"
                  >
                    {/* 封面区域 */}
                    <div className={`h-24 flex flex-col items-center justify-center relative bg-gradient-to-br ${gradient}`}>
                      {cover ? (
                        <>
                          <span className="text-white/90 text-xs font-medium tracking-wide">
                            {cover.t1}
                          </span>
                          <span className="text-white text-base font-bold mt-0.5">
                            {cover.t2}
                          </span>
                          {cover.tag && (
                            <span className="absolute bottom-1.5 right-2 text-[9px] text-white/60">
                              {cover.tag}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-white text-sm font-bold text-center px-2 line-clamp-2">
                          {b.name}
                        </span>
                      )}
                      {b.level ? (
                        <span className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/90 text-charcoal">
                          {b.level}
                        </span>
                      ) : null}
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        {b.name}
                      </h3>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <BookOpen size={12} />
                          {b.wordCount || 0} 词
                        </span>
                        <ChevronRight
                          size={14}
                          className="text-muted-soft group-hover:text-primary transition-colors"
                        />
                      </div>
                    </div>
                  </CloudCard>
                </Link>
              );
            })}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} /> 上一页
              </button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                下一页 <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {userId > 0 ? (
        <CoachOnboarding
          open={showOnboarding}
          userId={userId}
          onDone={() => setShowOnboarding(false)}
        />
      ) : null}
    </div>
  );
}
