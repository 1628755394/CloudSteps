/**
 * 词训/陪练当前学员上下文 — 对齐 web/src/utils/trainingStudent.ts。
 * 小程序端用 Taro Storage 持久化(替代 localStorage)。
 */
import Taro from '@tarojs/taro'

const ID_KEY = 'lb_student_id'
const NAME_KEY = 'lb_student_name'

export function getTrainingStudent(): { id: number; name: string } | null {
  try {
    const id = Number(Taro.getStorageSync(ID_KEY) || 0)
    const name = Taro.getStorageSync(NAME_KEY) || ''
    if (id > 0 && name) return { id, name }
    if (name) return { id: id > 0 ? id : 0, name }
    return null
  } catch {
    return null
  }
}

export function setTrainingStudent(id: number, name: string) {
  try {
    if (id > 0) {
      Taro.setStorageSync(ID_KEY, String(id))
    } else {
      Taro.removeStorageSync(ID_KEY)
    }
    Taro.setStorageSync(NAME_KEY, name)
  } catch {
    // ignore
  }
}

export function clearTrainingStudent() {
  try {
    Taro.removeStorageSync(ID_KEY)
    Taro.removeStorageSync(NAME_KEY)
  } catch {
    // ignore
  }
}

export function studentLabelFromQuota(row: {
  studentId: number
  student?: { displayName?: string; username?: string; email?: string }
}) {
  const s = row.student
  return s?.displayName || s?.username || s?.email || `学员 #${row.studentId}`
}
