/** 词训/陪练当前学员上下文（老师端选学员后写入，跨页持久） */

import i18n from "../i18n";

const ID_KEY = "lb_student_id";
const NAME_KEY = "lb_student_name";
/** 兼容抗遗忘等旧逻辑 */
const LEGACY_NAME_KEY = "lb_user_name";

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function normalizeStudentId(raw: string | number | null | undefined): string {
  if (raw == null) return "";
  const text = String(raw).trim();
  if (!text || text === "0") return "";
  return text;
}

function migrateFromSession() {
  const ls = storage();
  if (!ls) return;
  try {
    if (!ls.getItem(ID_KEY) && sessionStorage.getItem(ID_KEY)) {
      ls.setItem(ID_KEY, sessionStorage.getItem(ID_KEY)!);
    }
    if (!ls.getItem(NAME_KEY) && sessionStorage.getItem(NAME_KEY)) {
      ls.setItem(NAME_KEY, sessionStorage.getItem(NAME_KEY)!);
    }
  } catch {
    // ignore
  }
}

export function getTrainingStudent(): { id: string; name: string } | null {
  migrateFromSession();
  try {
    const store = storage();
    const id = normalizeStudentId(store?.getItem(ID_KEY) || sessionStorage.getItem(ID_KEY));
    const name =
      store?.getItem(NAME_KEY) ||
      sessionStorage.getItem(NAME_KEY) ||
      sessionStorage.getItem(LEGACY_NAME_KEY) ||
      "";
    if (id && name) return { id, name };
    if (name) return { id, name };
    return null;
  } catch {
    return null;
  }
}

export function setTrainingStudent(id: string | number, name: string) {
  try {
    const idStr = normalizeStudentId(id);
    const store = storage();
    if (idStr) {
      store?.setItem(ID_KEY, idStr);
      sessionStorage.setItem(ID_KEY, idStr);
    } else {
      store?.removeItem(ID_KEY);
      sessionStorage.removeItem(ID_KEY);
    }
    store?.setItem(NAME_KEY, name);
    sessionStorage.setItem(NAME_KEY, name);
    sessionStorage.setItem(LEGACY_NAME_KEY, name);
    window.dispatchEvent(new CustomEvent("lb-training-student", { detail: { id: idStr, name } }));
  } catch {
    // ignore
  }
}

export function clearTrainingStudent() {
  try {
    storage()?.removeItem(ID_KEY);
    storage()?.removeItem(NAME_KEY);
    sessionStorage.removeItem(ID_KEY);
    sessionStorage.removeItem(NAME_KEY);
    sessionStorage.removeItem(LEGACY_NAME_KEY);
    window.dispatchEvent(new CustomEvent("lb-training-student", { detail: null }));
  } catch {
    // ignore
  }
}

export function studentLabelFromQuota(row: {
  studentId: string | number;
  student?: { displayName?: string; username?: string; email?: string };
}) {
  const s = row.student;
  return s?.displayName || s?.username || s?.email || i18n.t("student_detail.student_fallback", { id: row.studentId });
}
