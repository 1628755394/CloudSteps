import { getVocabPoolRevision, getVocabStart } from "../api/vocab";
import i18n from "../i18n";

export type VocabTestQuestion = {
  id: number | string;
  word: string;
  options: string;
  correctAnswer: string;
  level: string;
  difficultyScore: number;
  audioUrl?: string;
};

const VOCAB_TEST_CACHE_KEY = "vocabulary_test_questions";
const VOCAB_TEST_RESULT_KEY = "vocabulary_test_result";
const CACHE_TTL_MS = 30 * 60 * 1000;

type CachedVocabPayload = {
  questions?: VocabTestQuestion[];
  savedAt?: number;
  poolRevision?: number;
};

let prefetchPromise: Promise<VocabTestQuestion[] | null> | null = null;

function readCachedPayload(): CachedVocabPayload | null {
  try {
    const raw = sessionStorage.getItem(VOCAB_TEST_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedVocabPayload;
  } catch {
    return null;
  }
}

async function fetchPoolRevision(): Promise<number> {
  try {
    const res = await getVocabPoolRevision();
    if (res.code !== 200) return 0;
    return Number(res.data?.poolRevision || 0);
  } catch {
    return 0;
  }
}

async function isCachedVocabStale(cached: CachedVocabPayload): Promise<boolean> {
  if (!cached.questions?.length) return true;
  if (cached.savedAt && Date.now() - cached.savedAt > CACHE_TTL_MS) return true;
  const serverRevision = await fetchPoolRevision();
  if (serverRevision > 0 && cached.poolRevision !== serverRevision) return true;
  return false;
}

export function loadCachedVocabQuestions(): VocabTestQuestion[] | null {
  const parsed = readCachedPayload();
  if (!parsed?.questions?.length) return null;
  if (parsed.savedAt && Date.now() - parsed.savedAt > CACHE_TTL_MS) {
    sessionStorage.removeItem(VOCAB_TEST_CACHE_KEY);
    return null;
  }
  return parsed.questions;
}

export function saveCachedVocabQuestions(questions: VocabTestQuestion[], poolRevision?: number) {
  sessionStorage.setItem(
    VOCAB_TEST_CACHE_KEY,
    JSON.stringify({ questions, savedAt: Date.now(), poolRevision: poolRevision ?? 0 }),
  );
}

export function clearVocabTestQuestionsCache() {
  sessionStorage.removeItem(VOCAB_TEST_CACHE_KEY);
  prefetchPromise = null;
}

export function clearVocabTestResultCache() {
  sessionStorage.removeItem(VOCAB_TEST_RESULT_KEY);
}

/** 后台预拉题目，多次调用会复用同一次请求 */
export function prefetchVocabTestQuestions(options?: { force?: boolean }): Promise<VocabTestQuestion[] | null> {
  if (!options?.force) {
    const cached = readCachedPayload();
    if (cached?.questions?.length) {
      return isCachedVocabStale(cached).then((stale) => {
        if (!stale) return cached.questions!;
        clearVocabTestQuestionsCache();
        return prefetchVocabTestQuestions({ force: true });
      });
    }
  }

  if (prefetchPromise) return prefetchPromise;

  prefetchPromise = (async () => {
    try {
      const res = await getVocabStart();
      if (res.code !== 200) throw new Error(res.msg || i18n.t("vocab_test.load_failed"));
      const list: VocabTestQuestion[] = res.data?.questions || [];
      const poolRevision = Number(res.data?.poolRevision || 0);
      if (!list.length) throw new Error(i18n.t("vocab_test.no_questions_contact_admin"));
      // 校验题目格式：必须有 id 和 word（id 可能是 string 或 number）
      const valid = list.filter((q) => q && q.id != null && q.word);
      if (!valid.length) throw new Error(i18n.t("vocab_test.invalid_format"));
      saveCachedVocabQuestions(valid, poolRevision);
      return valid;
    } catch (err) {
      prefetchPromise = null;
      throw err;
    }
  })();

  return prefetchPromise;
}

/** 不阻塞 UI 的预拉入口（首页、资料选择等跳转前调用） */
export function kickoffVocabTestPrefetch() {
  if (loadCachedVocabQuestions()?.length) return;
  prefetchVocabTestQuestions().catch(() => {});
}

/** 测试页使用：优先读缓存，否则等待进行中的预拉或发起新请求 */
export async function ensureVocabTestQuestions(): Promise<VocabTestQuestion[]> {
  const cached = readCachedPayload();
  if (cached?.questions?.length && !(await isCachedVocabStale(cached))) {
    return cached.questions;
  }
  if (cached?.questions?.length) clearVocabTestQuestionsCache();

  const list = await prefetchVocabTestQuestions({ force: true });
  if (!list?.length) throw new Error(i18n.t("vocab_test.no_questions"));
  return list;
}

/** 重新测试：清旧题并预拉新题 */
export function refreshVocabTestQuestions(): Promise<VocabTestQuestion[] | null> {
  clearVocabTestQuestionsCache();
  return prefetchVocabTestQuestions({ force: true });
}
