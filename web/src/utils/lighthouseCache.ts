import { getStudyLighthouse, type StudyLighthouseResponse } from "../api/study";
import { normalizeSnowflakeId } from "./json-snowflake";
import i18n from "../i18n";

const CACHE_PREFIX = "lb_lighthouse_v1_";
const CACHE_TTL_MS = 3 * 60 * 1000;

const memoryCache = new Map<string, { data: StudyLighthouseResponse; savedAt: number }>();
const inflight = new Map<string, Promise<StudyLighthouseResponse>>();

const emptyLighthouse = (): StudyLighthouseResponse => ({
  days: [],
  pendingCount: 0,
  masteredCount: 0,
  todayNewLearned: 0,
});

function cacheKey(wordBookId: string | number): string {
  return normalizeSnowflakeId(wordBookId);
}

function loadSession(wordBookId: string | number): StudyLighthouseResponse | null {
  const key = cacheKey(wordBookId);
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: StudyLighthouseResponse; savedAt?: number };
    if (!parsed.data || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function saveCache(wordBookId: string | number, data: StudyLighthouseResponse) {
  const key = cacheKey(wordBookId);
  if (!key) return;
  const entry = { data, savedAt: Date.now() };
  memoryCache.set(key, entry);
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // ignore quota errors
  }
}

function readCached(wordBookId: string | number): StudyLighthouseResponse | null {
  const key = cacheKey(wordBookId);
  if (!key) return null;
  const mem = memoryCache.get(key);
  if (mem && Date.now() - mem.savedAt < CACHE_TTL_MS) return mem.data;
  const session = loadSession(key);
  if (session) {
    memoryCache.set(key, { data: session, savedAt: Date.now() });
    return session;
  }
  return null;
}

/** 后台刷新，不阻塞 UI */
export function revalidateLighthouse(wordBookId: string | number) {
  if (!cacheKey(wordBookId)) return;
  void fetchLighthouse(wordBookId, { force: true }).catch(() => {});
}

export async function fetchLighthouse(
  wordBookId: string | number,
  options?: { force?: boolean },
): Promise<StudyLighthouseResponse> {
  const key = cacheKey(wordBookId);
  if (!key) return emptyLighthouse();

  if (!options?.force) {
    const cached = readCached(key);
    if (cached) return cached;
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const res = await getStudyLighthouse(key);
    if (res.code !== 200) throw new Error(res.msg || i18n.t("lighthouse.load_failed"));
    const data: StudyLighthouseResponse = {
      days: Array.isArray(res.data?.days) ? res.data.days : [],
      pendingCount: Number(res.data?.pendingCount ?? 0),
      masteredCount: Number(res.data?.masteredCount ?? 0),
      todayNewLearned: Number(res.data?.todayNewLearned ?? 0),
    };
    saveCache(key, data);
    return data;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

export function prefetchLighthouses(wordBookIds: Array<string | number>) {
  for (const id of wordBookIds) {
    const key = cacheKey(id);
    if (!key || readCached(key)) continue;
    void fetchLighthouse(key).catch(() => {});
  }
}

export function getCachedLighthouse(wordBookId: string | number): StudyLighthouseResponse | null {
  return readCached(wordBookId);
}

export function invalidateLighthouseCache(wordBookId?: string | number) {
  if (wordBookId != null && wordBookId !== "") {
    const key = cacheKey(wordBookId);
    if (!key) return;
    memoryCache.delete(key);
    sessionStorage.removeItem(`${CACHE_PREFIX}${key}`);
    return;
  }
  memoryCache.clear();
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(key);
  }
}
