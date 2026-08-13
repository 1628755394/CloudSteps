import { endCoachingAppointment, startPracticeSession } from "../api/coaching";
import { getTrainingStudent } from "./trainingStudent";
import { showToast } from "./toast";

export type PracticeBillingLink = {
  appointmentId: number;
  /** 是否由练习定时创建/接管且结束时应下课结账 */
  owned: boolean;
  studentId: number;
  studentName: string;
};

/**
 * 无排课练习开课：走后端 /practice/start，按当前学员计时扣额度。
 * 若该学员已有上课中课次则复用；其他学员上课中则失败。
 */
export async function beginPracticeBilling(durationMin: number): Promise<PracticeBillingLink | null> {
  const student = getTrainingStudent();
  if (!student?.id) {
    showToast.warning("请先在首页选择学员，练习时长将计入该学员");
    return null;
  }

  try {
    const res = await startPracticeSession({
      studentId: student.id,
      plannedMinutes: Math.max(1, Math.min(180, Math.round(durationMin) || 45)),
    });
    if (res.code !== 200) {
      showToast.error(res.msg || "开始练习计时失败");
      return null;
    }
    const data = res.data;
    const apptId = Number(data?.appointmentId || data?.appointment?.id || 0);
    if (!apptId) {
      showToast.error("开始练习计时失败：未返回课次");
      return null;
    }
    const name =
      data?.appointment?.students?.[0] ||
      student.name ||
      `学员 #${student.id}`;
    const owned = data?.reused ? false : data?.owned !== false;
    if (data?.reused) {
      showToast.info(`已挂接「${name}」进行中的课次`);
    } else {
      showToast.info(`练习时长将计入「${name}」`);
    }
    return {
      appointmentId: apptId,
      owned,
      studentId: Number(data?.studentId) || student.id,
      studentName: name,
    };
  } catch (e: unknown) {
    const msg =
      e && typeof e === "object" && "msg" in e
        ? String((e as { msg: string }).msg)
        : "无法为学员开始计时";
    showToast.error(msg);
    return null;
  }
}

/** 结束练习课次并扣额度；复用原排课的不在此下课 */
export async function finishPracticeBilling(link: PracticeBillingLink | null | undefined) {
  if (!link?.owned || !link.appointmentId) return;
  try {
    await endCoachingAppointment(link.appointmentId);
    showToast.success(`已结算「${link.studentName}」的练习时长`);
  } catch (e: unknown) {
    const msg =
      e && typeof e === "object" && "msg" in e
        ? String((e as { msg: string }).msg)
        : "练习时长结算失败，请稍后在排课中手动下课";
    showToast.error(msg);
  }
}
