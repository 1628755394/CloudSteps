import { getVocabStart } from "../api/vocab";

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

let prefetchPromise: Promise<VocabTestQuestion[] | null> | null = null;

export function loadCachedVocabQuestions(): VocabTestQuestion[] | null {
  try {
    const raw = sessionStorage.getItem(VOCAB_TEST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { questions?: VocabTestQuestion[]; savedAt?: number };
    if (!parsed.questions?.length) return null;
    if (parsed.savedAt && Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(VOCAB_TEST_CACHE_KEY);
      return null;
    }
    return parsed.questions;
  } catch {
    return null;
  }
}

export function saveCachedVocabQuestions(questions: VocabTestQuestion[]) {
  sessionStorage.setItem(
    VOCAB_TEST_CACHE_KEY,
    JSON.stringify({ questions, savedAt: Date.now() }),
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
    const cached = loadCachedVocabQuestions();
    if (cached?.length) return Promise.resolve(cached);
  }

  if (prefetchPromise) return prefetchPromise;

  prefetchPromise = (async () => {
    try {
      const res = await getVocabStart();
      if (res.code !== 200) throw new Error(res.msg || "获取题目失败");
      const list: VocabTestQuestion[] = res.data?.questions || [];
      if (!list.length) throw new Error("题库暂无题目，请联系管理员添加");
      // 校验题目格式：必须有 id 和 word（id 可能是 string 或 number）
      const valid = list.filter((q) => q && q.id != null && q.word);
      if (!valid.length) throw new Error("题库数据格式异常");
      saveCachedVocabQuestions(valid);
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
  const cached = loadCachedVocabQuestions();
  if (cached?.length) return cached;

  const list = await prefetchVocabTestQuestions();
  if (!list?.length) throw new Error("题库暂无题目");
  return list;
}

/** 重新测试：清旧题并预拉新题 */
export function refreshVocabTestQuestions(): Promise<VocabTestQuestion[] | null> {
  clearVocabTestQuestionsCache();
  return prefetchVocabTestQuestions({ force: true });
}
