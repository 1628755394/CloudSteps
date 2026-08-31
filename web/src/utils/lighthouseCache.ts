import { getStudyLighthouse, type StudyLighthouseResponse } from "../api/study";
import i18n from "../i18n";

const CACHE_PREFIX = "lb_lighthouse_v1_";
const CACHE_TTL_MS = 3 * 60 * 1000;

const memoryCache = new Map<number, { data: StudyLighthouseResponse; savedAt: number }>();
const inflight = new Map<number, Promise<StudyLighthouseResponse>>();

const emptyLighthouse = (): StudyLighthouseResponse => ({
  days: [],
  pendingCount: 0,
  masteredCount: 0,
  todayNewLearned: 0,
});

function loadSession(wordBookId: number): StudyLighthouseResponse | null {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${wordBookId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: StudyLighthouseResponse; savedAt?: number };
    if (!parsed.data || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(`${CACHE_PREFIX}${wordBookId}`);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function saveCache(wordBookId: number, data: StudyLighthouseResponse) {
  const entry = { data, savedAt: Date.now() };
  memoryCache.set(wordBookId, entry);
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${wordBookId}`, JSON.stringify(entry));
  } catch {
    // ignore quota errors
  }
}

function readCached(wordBookId: number): StudyLighthouseResponse | null {
  const mem = memoryCache.get(wordBookId);
  if (mem && Date.now() - mem.savedAt < CACHE_TTL_MS) return mem.data;
  const session = loadSession(wordBookId);
  if (session) {
    memoryCache.set(wordBookId, { data: session, savedAt: Date.now() });
    return session;
  }
  return null;
}

/** 后台刷新，不阻塞 UI */
export function revalidateLighthouse(wordBookId: number) {
  if (!wordBookId) return;
  void fetchLighthouse(wordBookId, { force: true }).catch(() => {});
}

export async function fetchLighthouse(
  wordBookId: number,
  options?: { force?: boolean },
): Promise<StudyLighthouseResponse> {
  if (!wordBookId) return emptyLighthouse();

  if (!options?.force) {
    const cached = readCached(wordBookId);
    if (cached) return cached;
  }

  const pending = inflight.get(wordBookId);
  if (pending) return pending;

  const promise = (async () => {
    const res = await getStudyLighthouse(wordBookId);
    if (res.code !== 200) throw new Error(res.msg || i18n.t("lighthouse.load_failed"));
    const data: StudyLighthouseResponse = {
      days: Array.isArray(res.data?.days) ? res.data.days : [],
      pendingCount: Number(res.data?.pendingCount ?? 0),
      masteredCount: Number(res.data?.masteredCount ?? 0),
      todayNewLearned: Number(res.data?.todayNewLearned ?? 0),
    };
    saveCache(wordBookId, data);
    return data;
  })().finally(() => {
    inflight.delete(wordBookId);
  });

  inflight.set(wordBookId, promise);
  return promise;
}

export function prefetchLighthouses(wordBookIds: number[]) {
  for (const id of wordBookIds) {
    if (!id || readCached(id)) continue;
    void fetchLighthouse(id).catch(() => {});
  }
}

export function getCachedLighthouse(wordBookId: number): StudyLighthouseResponse | null {
  return readCached(wordBookId);
}

export function invalidateLighthouseCache(wordBookId?: number) {
  if (wordBookId) {
    memoryCache.delete(wordBookId);
    sessionStorage.removeItem(`${CACHE_PREFIX}${wordBookId}`);
    return;
  }
  memoryCache.clear();
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(key);
  }
}
