import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { BookOpen, ChevronRight, ChevronLeft, Plus, Search } from "lucide-react";
import { CloudCard, CloudEmpty, CloudSpin, CloudInput } from "../components/cloudsteps/arco";
import { listWordBooks, type WordBookItem, type WordBookGroup } from "../api/wordbooks";
import { resolveMediaUrl } from "../utils/mediaUrl";
import { cn } from "../utils/cn";

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

interface CoverInfo {
  tag: string;
  t1: string;
  t2: string;
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

const PAGE_SIZE = 12;

const CUSTOM_GROUP: WordBookGroup = { key: "custom", label: "自定义" };

const DEFAULT_GROUPS: WordBookGroup[] = [
  { key: "", label: "全部" },
  CUSTOM_GROUP,
  { key: "primary", label: "小学" },
  { key: "middle", label: "初中" },
  { key: "high", label: "高中" },
  { key: "university", label: "大学" },
  { key: "cet4", label: "四级" },
  { key: "cet6", label: "六级" },
  { key: "kaoyan", label: "考研" },
  { key: "abroad", label: "留学考试" },
  { key: "tem", label: "专四专八" },
  { key: "textbook", label: "教材" },
];

function withCustomGroup(list: WordBookGroup[]): WordBookGroup[] {
  const rest = list.filter((g) => g.key !== "custom");
  const hasAll = rest.some((g) => g.key === "");
  const withoutCustom = hasAll ? rest : [{ key: "", label: "全部" }, ...rest];
  const all = withoutCustom.find((g) => g.key === "");
  const others = withoutCustom.filter((g) => g.key !== "");
  return all ? [all, CUSTOM_GROUP, ...others] : [CUSTOM_GROUP, ...withoutCustom];
}

export default function WordBookShelf() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<WordBookItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [group, setGroup] = useState("");
  const [groups, setGroups] = useState<WordBookGroup[]>(DEFAULT_GROUPS);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const isCustomGroup = group === CUSTOM_GROUP.key;

  const fetchBooks = useCallback(async (p: number, kw: string, g: string) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await listWordBooks({
        page: p,
        pageSize: PAGE_SIZE,
        keyword: kw || undefined,
        group: g || undefined,
      });
      if (res.code !== 200) {
        setErr(res.msg || "加载失败");
        setBooks([]);
        setTotal(0);
        return;
      }
      setBooks(Array.isArray(res.data.list) ? res.data.list : []);
      setTotal(res.data.total || 0);
      if (res.data.groups && res.data.groups.length > 0) {
        setGroups(withCustomGroup(res.data.groups));
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

  // 预取分组标签
  useEffect(() => {
    let mounted = true;
    listWordBooks({ page: 1, pageSize: 1 })
      .then((res) => {
        if (!mounted || res.code !== 200 || !res.data?.groups?.length) return;
        setGroups(withCustomGroup(res.data.groups));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

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

  return (
    <div className="space-y-4 min-w-0 w-full">
      <section className="space-y-3 min-w-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground tracking-tight shrink-0">
            我的书架
          </h2>
          <div className="relative flex-1 min-w-0 max-w-md ml-auto">
            <CloudInput
              value={searchInput}
              onChange={(val: string) => {
                setSearchInput(val);
                if (!val.trim() && keyword) {
                  setPage(1);
                  setKeyword("");
                }
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="搜索词库名称…"
              prefix={<Search size={16} className="text-muted-foreground" />}
              allowClear
            />
          </div>
        </div>

        {/* min-w-0 限制宽度，才能在父级 overflow-x-hidden 下横向滑到最后一项 */}
        <div
          className="min-w-0 w-full overflow-x-auto overscroll-x-contain touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex w-max items-stretch gap-5 pr-4">
            {groups.map((g) => {
              const active = group === g.key;
              return (
                <button
                  key={g.key || "all"}
                  type="button"
                  onClick={() => handleGroupChange(g.key)}
                  className={cn(
                    "relative shrink-0 whitespace-nowrap pb-2.5 pt-0.5 text-sm transition-colors",
                    active ? "text-primary font-semibold" : "text-muted-foreground font-medium",
                  )}
                >
                  {g.label}
                  {active ? (
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-0.5 w-5 rounded-full bg-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {err && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {isCustomGroup ? (
        <div className="space-y-3">
          <div className="rounded-2xl bg-card border border-border px-4 py-10 flex items-center justify-center">
            <button
              type="button"
              onClick={() => navigate("/word-books/custom/new")}
              className="inline-flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground transition-colors"
            >
              <Plus size={18} className="text-primary" strokeWidth={2.5} />
              <span>自定义词书</span>
            </button>
          </div>
          {loading ? (
            <CloudCard className="p-10">
              <CloudSpin tip="加载中…" />
            </CloudCard>
          ) : books.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {books.map((b) => {
                  const cover = parseCover(b.description);
                  const gradient = pickGradient(cover?.tag || b.name);
                  const coverImage = resolveMediaUrl(b.coverUrl);
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
                        <div
                          className={`relative w-full aspect-[1792/1024] ${
                            coverImage ? "bg-muted" : `bg-gradient-to-br ${gradient}`
                          }`}
                        >
                          {coverImage ? (
                            <img
                              src={coverImage}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-2">
                              <span className="text-white text-sm font-bold text-center line-clamp-2">
                                {b.name}
                              </span>
                            </div>
                          )}
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
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-2">
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
          ) : null}
        </div>
      ) : loading ? (
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
              const coverImage = resolveMediaUrl(b.coverUrl);
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
                    {/* 封面区域 1792×1024 */}
                    <div
                      className={`relative w-full aspect-[1792/1024] ${
                        coverImage ? "bg-muted" : `bg-gradient-to-br ${gradient}`
                      }`}
                    >
                      {coverImage ? (
                        <img
                          src={coverImage}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : cover ? (
                        <div className='flex h-full w-full flex-col items-center justify-center'>
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
                        </div>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-2">
                          <span className="text-white text-sm font-bold text-center line-clamp-2">
                            {b.name}
                          </span>
                        </div>
                      )}
                      {b.level ? (
                        <span className="absolute top-2 left-2 z-10 text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/90 text-charcoal">
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
    </div>
  );
}
