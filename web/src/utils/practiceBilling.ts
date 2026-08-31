import { endCoachingAppointment, startPracticeSession } from "../api/coaching";
import i18n from "../i18n";
import { getTrainingStudent } from "./trainingStudent";
import { formatApiMessage } from "./apiMessage";
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
    showToast.warning(i18n.t("practice_billing.select_student"));
    return null;
  }

  try {
    const res = await startPracticeSession({
      studentId: student.id,
      plannedMinutes: Math.max(1, Math.min(180, Math.round(durationMin) || 45)),
    });
    if (res.code !== 200) {
      showToast.error(formatApiMessage(res.msg, "practice_billing.start_failed"));
      return null;
    }
    const data = res.data;
    const apptId = Number(data?.appointmentId || data?.appointment?.id || 0);
    if (!apptId) {
      showToast.error(i18n.t("practice_billing.no_appointment"));
      return null;
    }
    const name =
      data?.appointment?.students?.[0] ||
      student.name ||
      i18n.t("practice_billing.student_fallback", { id: student.id });
    const owned = data?.reused ? false : data?.owned !== false;
    if (data?.reused) {
      showToast.info(i18n.t("practice_billing.reused_session", { name }));
    } else {
      showToast.info(i18n.t("practice_billing.will_bill", { name }));
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
        ? formatApiMessage(String((e as { msg: string }).msg), "practice_billing.cannot_start")
        : i18n.t("practice_billing.cannot_start");
    showToast.error(msg);
    return null;
  }
}

/** 结束练习课次并扣额度；复用原排课的不在此下课 */
export async function finishPracticeBilling(link: PracticeBillingLink | null | undefined) {
  if (!link?.owned || !link.appointmentId) return;
  try {
    await endCoachingAppointment(link.appointmentId);
    showToast.success(i18n.t("practice_billing.settled", { name: link.studentName }));
  } catch (e: unknown) {
    const msg =
      e && typeof e === "object" && "msg" in e
        ? formatApiMessage(String((e as { msg: string }).msg), "practice_billing.settle_failed")
        : i18n.t("practice_billing.settle_failed");
    showToast.error(msg);
  }
}
