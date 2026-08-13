import { listWordBooks, type WordBookItem } from "../api/wordbooks";

const STORAGE_KEY = "lb_wordbooks_all_v1";
/** 词库变动少，本地缓存 7 天 */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CachedWordBook = Pick<WordBookItem, "id" | "name" | "wordCount" | "level" | "category">;

type CachePayload = {
  list: CachedWordBook[];
  total: number;
  savedAt: number;
};

let memory: CachePayload | null = null;
let inflight: Promise<CachedWordBook[]> | null = null;

function readStorage(): CachePayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!Array.isArray(parsed.list) || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(list: CachedWordBook[], total: number) {
  const payload: CachePayload = { list, total, savedAt: Date.now() };
  memory = payload;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // quota — keep memory only
  }
}

function toLite(list: WordBookItem[]): CachedWordBook[] {
  return list.map((b) => ({
    id: b.id,
    name: b.name,
    wordCount: b.wordCount,
    level: b.level,
    category: b.category,
  }));
}

/** 同步读缓存（内存 → localStorage），供首屏立刻渲染 */
export function getCachedWordBooks(): CachedWordBook[] | null {
  if (memory?.list?.length) return memory.list;
  const stored = readStorage();
  if (stored?.list?.length) {
    memory = stored;
    return stored.list;
  }
  return null;
}

async function fetchAllWordBooksFromApi(): Promise<CachedWordBook[]> {
  const all: WordBookItem[] = [];
  let page = 1;
  const pageSize = 500;
  for (;;) {
    const res = await listWordBooks({ page, pageSize });
    if (res.code !== 200) throw new Error(res.msg || "加载词库失败");
    const chunk = Array.isArray(res.data?.list) ? res.data.list : [];
    all.push(...chunk);
    const total = res.data?.total || 0;
    if (all.length >= total || chunk.length === 0 || page > 30) break;
    page += 1;
  }
  const lite = toLite(all);
  writeStorage(lite, all.length);
  return lite;
}

/**
 * 获取全部词库：优先缓存；force 时后台刷新。
 * 并发请求合并为一次。
 */
export async function loadWordBooks(options?: { force?: boolean }): Promise<CachedWordBook[]> {
  if (!options?.force) {
    const cached = getCachedWordBooks();
    if (cached?.length) return cached;
  }

  if (inflight) return inflight;

  inflight = fetchAllWordBooksFromApi().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** 有缓存则立刻返回，并后台静默刷新 */
export async function loadWordBooksStaleWhileRevalidate(): Promise<CachedWordBook[]> {
  const cached = getCachedWordBooks();
  if (cached?.length) {
    void loadWordBooks({ force: true }).catch(() => {});
    return cached;
  }
  return loadWordBooks();
}

/** 入口页预热：登录后 / 备课页点击即可提前拉 */
export function kickoffWordBooksPrefetch() {
  if (getCachedWordBooks()?.length) {
    // 有缓存也偶尔刷新（超过 1 天）
    const age = memory?.savedAt ? Date.now() - memory.savedAt : CACHE_TTL_MS;
    if (age < 24 * 60 * 60 * 1000) return;
  }
  void loadWordBooks({ force: Boolean(getCachedWordBooks()?.length) }).catch(() => {});
}

export function invalidateWordBooksCache() {
  memory = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
