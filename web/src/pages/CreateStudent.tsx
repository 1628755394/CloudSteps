import { useState } from "react";
import { useNavigate } from "react-router";
import { Check, ChevronRight, Copy } from "lucide-react";
import { PageBackHeader } from "../components/PageBackHeader";
import { CloudButton } from "../components/cloudsteps";
import { CloudInput } from "../components/cloudsteps/arco";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { createTeacherStudent } from "../api/coaching";
import { setTrainingStudent } from "../utils/trainingStudent";
import { showToast } from "../utils/toast";
import { useTranslation } from "react-i18next";
import { formatApiMessage } from "../utils/apiMessage";

const DEFAULT_PASSWORD = "student123";

/**
 * 新建学生 — 姓名 + 学时；账号由后端按姓名+随机数生成，默认密码 student123
 */
export default function CreateStudent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [studyHours, setStudyHours] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{
    username: string;
    password: string;
    name: string;
    studentId?: number;
  } | null>(null);
  const [copied, setCopied] = useState<"account" | "password" | "all" | null>(null);

  const copyText = async (text: string, key: "account" | "password" | "all") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      showToast.success(t("create_student.copied"));
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      showToast.error(t("create_student.copy_failed"));
    }
  };

  const onSubmit = async () => {
    const name = displayName.trim();
    if (!name) {
      showToast.warning(t("create_student.enter_name"));
      return;
    }
    const hours = Number(studyHours);
    if (Number.isNaN(hours) || hours < 0) {
      showToast.warning(t("create_student.invalid_hours"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await createTeacherStudent({
        displayName: name,
        studyHours: Math.floor(hours),
      });
      if (res.code !== 200) {
        showToast.error(formatApiMessage(res.msg, "common.operation_failed"));
        return;
      }
      const sid = res.data?.student?.id || res.data?.quota?.studentId;
      if (sid) setTrainingStudent(sid, name);
      const loginName = res.data?.username || res.data?.student?.username || "";
      const initPwd = res.data?.initialPassword || DEFAULT_PASSWORD;
      if (!loginName) {
        showToast.success(t("create_student.created"));
        navigate(sid ? `/my-students/${sid}` : "/my-students", {
          replace: true,
          state: sid ? { studentName: name } : undefined,
        });
        return;
      }
      setCreated({ username: loginName, password: initPwd, name, studentId: sid });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : formatApiMessage(undefined, "common.operation_failed");
      showToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-0 flex flex-col flex-1 bg-background">
      <PageBackHeader title={t("create_student.title")} fallbackTo="/my-students" maxWidthClass="max-w-none" />

      <div className="flex-1 w-full py-3 space-y-3">
        <section className="bg-card border-y border-border overflow-hidden sm:border sm:rounded-2xl">
          <div className="px-4 py-2.5 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">{t("create_student.basic_info")}</h2>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div>
              <label className="text-sm text-charcoal font-medium mb-1.5 block">
                <span className="text-destructive">*</span> {t("create_student.name_label")}
              </label>
              <CloudInput
                value={displayName}
                onChange={setDisplayName}
                placeholder={t("create_student.name_placeholder")}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {t("create_student.name_hint", { pwd: DEFAULT_PASSWORD })}
              </p>
            </div>
            <div>
              <label className="text-sm text-charcoal font-medium mb-1.5 block">{t("create_student.hours_label")}</label>
              <CloudInput
                value={studyHours}
                onChange={setStudyHours}
                inputMode="numeric"
                placeholder="0"
              />
              <p className="text-[11px] text-muted-foreground mt-1">{t("create_student.hours_hint")}</p>
            </div>
          </div>
        </section>

        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:text-primary"
          onClick={() => navigate("/my-students?link=1")}
        >
          <span>{t("create_student.link_existing")}</span>
          <ChevronRight size={16} />
        </button>

        <div className="px-3 pt-1 pb-4">
          <CloudButton
            variant="brand"
            size="pillLg"
            className="w-full"
            loading={submitting}
            onClick={() => void onSubmit()}
          >
            {t("create_student.submit")}
          </CloudButton>
        </div>
      </div>

      <Dialog
        open={!!created}
        onOpenChange={(open) => {
          if (!open) {
            const sid = created?.studentId;
            const name = created?.name;
            setCreated(null);
            navigate(sid ? `/my-students/${sid}` : "/my-students", {
              replace: true,
              state: sid ? { studentName: name } : undefined,
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("create_student.success_title")}</DialogTitle>
            <DialogDescription>
              {t("create_student.success_desc", { name: created?.name })}
            </DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/60 border border-border px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground">{t("create_student.login_account")}</div>
                    <div className="text-sm font-semibold text-foreground break-all mt-0.5">
                      {created.username}
                    </div>
                  </div>
                  <CloudButton
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1"
                    onClick={() => void copyText(created.username, "account")}
                  >
                    {copied === "account" ? <Check size={14} /> : <Copy size={14} />}
                    {t("practice.copy")}
                  </CloudButton>
                </div>
              </div>
              <div className="rounded-xl bg-muted/60 border border-border px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground">{t("create_student.initial_password")}</div>
                    <div className="text-sm font-semibold text-foreground mt-0.5">
                      {created.password}
                    </div>
                  </div>
                  <CloudButton
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1"
                    onClick={() => void copyText(created.password, "password")}
                  >
                    {copied === "password" ? <Check size={14} /> : <Copy size={14} />}
                    {t("practice.copy")}
                  </CloudButton>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <CloudButton
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                if (!created) return;
                void copyText(
                  t("create_student.account_password", { account: created.username, password: created.password }),
                  "all"
                );
              }}
            >
              {copied === "all" ? <Check size={14} /> : <Copy size={14} />}
              {t("create_student.copy_all")}
            </CloudButton>
            <CloudButton
              type="button"
              variant="brand"
              className="flex-1"
              onClick={() => {
                const sid = created?.studentId;
                const name = created?.name;
                setCreated(null);
                navigate(sid ? `/my-students/${sid}` : "/my-students", {
                  replace: true,
                  state: sid ? { studentName: name } : undefined,
                });
              }}
            >
              {t("practice.done")}
            </CloudButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
