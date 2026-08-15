/** 每 5 词一小批，每 3 小批为一大组（共 15 词） */

export const WORDS_PER_BATCH = 5;
export const BATCHES_PER_MEGA_GROUP = 3;

export type StudyCheckPhase = "milestone" | "final";

export function getTotalBatches(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_BATCH));
}

/** 当前小批在大组内的位置：0=第1批 1=第2批 2=第3批 */
export function positionInMegaGroup(batchIdx: number): number {
  return batchIdx % BATCHES_PER_MEGA_GROUP;
}

/** 训后检测应包含的小批范围 [startBatch, endBatch) */
export function getMilestoneCheckBatchRange(
  batchIdx: number,
  totalBatches?: number
): { startBatch: number; endBatch: number } {
  const pos = positionInMegaGroup(batchIdx);
  let startBatch: number;
  let endBatch: number;
  if (pos === 1) {
    startBatch = batchIdx - 1;
    endBatch = batchIdx + 1;
  } else if (pos === 2) {
    startBatch = batchIdx - 2;
    endBatch = batchIdx + 1;
  } else {
    startBatch = batchIdx;
    endBatch = batchIdx + 1;
  }
  if (totalBatches != null && totalBatches > 0) {
    startBatch = Math.max(0, Math.min(startBatch, totalBatches - 1));
    endBatch = Math.max(startBatch + 1, Math.min(endBatch, totalBatches));
  }
  return { startBatch, endBatch };
}

export function sliceWordsByBatches<T>(all: T[], startBatch: number, endBatch: number): T[] {
  const start = startBatch * WORDS_PER_BATCH;
  const end = endBatch * WORDS_PER_BATCH;
  return all.slice(start, end);
}

/** 快闪结束后：是否进入训后检测 */
export function shouldEnterPostTrainingCheck(batchIdx: number, totalBatches: number): boolean {
  const pos = positionInMegaGroup(batchIdx);
  const isLast = batchIdx >= totalBatches - 1;
  if (isLast) return true;
  return pos === 1 || pos === 2;
}

/** 进入训后检测时的阶段 */
export function resolveCheckPhase(batchIdx: number, totalBatches: number): StudyCheckPhase {
  const pos = positionInMegaGroup(batchIdx);
  const isLast = batchIdx >= totalBatches - 1;
  if (isLast && pos === 0) return "final";
  if (isLast) return "milestone";
  return "milestone";
}

/** 里程碑检测提交后：是否还有总检测 */
export function needsFinalCheckAfterMilestone(batchIdx: number, totalBatches: number): boolean {
  return batchIdx >= totalBatches - 1;
}

export function getCheckPhaseLabel(
  phase: StudyCheckPhase,
  batchIdx: number,
  totalBatches: number
): { title: string; hint: string } {
  if (phase === "final") {
    return {
      title: "训后检测",
      hint: "",
    };
  }
  const { startBatch, endBatch } = getMilestoneCheckBatchRange(batchIdx, totalBatches);
  const from = startBatch + 1;
  const to = endBatch;
  return {
    title: "组内复习",
    hint: `复习第 ${from}${to > from ? `–${to}` : ""} 组 · 打 × 的单词将回到快闪重练`,
  };
}

/** 错词快闪重练 */
export const STUDY_RETRY_WORDS_KEY = "lb_study_retry_words";
export const STUDY_PENDING_ACTION_KEY = "lb_study_pending_action";
/** 快闪重练后回到检测页，仅展示这些词 */
export const STUDY_RECHECK_WORDS_KEY = "lb_study_recheck_words";
export const STUDY_RECHECK_FROM_KEY = "lb_study_recheck_from";

export type StudyPendingAction = "next_batch" | "final_check";
export type StudyRecheckFrom = "milestone" | "final";

export function setStudyRetryWords(
  words: unknown[],
  action: StudyPendingAction,
  from: StudyRecheckFrom
) {
  sessionStorage.setItem(STUDY_RETRY_WORDS_KEY, JSON.stringify(words));
  sessionStorage.setItem(STUDY_PENDING_ACTION_KEY, action);
  sessionStorage.setItem(STUDY_RECHECK_FROM_KEY, from);
}

export function clearStudyRetryFlash() {
  sessionStorage.removeItem(STUDY_RETRY_WORDS_KEY);
}

export function clearStudyRecheck() {
  sessionStorage.removeItem(STUDY_RECHECK_WORDS_KEY);
  sessionStorage.removeItem(STUDY_PENDING_ACTION_KEY);
  sessionStorage.removeItem(STUDY_RECHECK_FROM_KEY);
}

export function clearStudyRetry() {
  clearStudyRetryFlash();
  clearStudyRecheck();
}

export function getStudyRecheckWords(): unknown[] | null {
  try {
    const raw = sessionStorage.getItem(STUDY_RECHECK_WORDS_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length > 0 ? arr : null;
  } catch {
    return null;
  }
}

export function getStudyRecheckFrom(): StudyRecheckFrom | null {
  const v = sessionStorage.getItem(STUDY_RECHECK_FROM_KEY);
  return v === "milestone" || v === "final" ? v : null;
}

export function setStudyRecheckWords(words: unknown[]) {
  sessionStorage.setItem(STUDY_RECHECK_WORDS_KEY, JSON.stringify(words));
}

export function getStudyRetryWords(): unknown[] | null {
  try {
    const raw = sessionStorage.getItem(STUDY_RETRY_WORDS_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length > 0 ? arr : null;
  } catch {
    return null;
  }
}

export function getStudyPendingAction(): StudyPendingAction | null {
  const v = sessionStorage.getItem(STUDY_PENDING_ACTION_KEY);
  return v === "next_batch" || v === "final_check" ? v : null;
}
