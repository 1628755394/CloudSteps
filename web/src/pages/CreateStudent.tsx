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

const DEFAULT_PASSWORD = "student123";

/**
 * 新建学生 — 姓名 + 学时；账号由后端按姓名+随机数生成，默认密码 student123
 */
export default function CreateStudent() {
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
      showToast.success("已复制");
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      showToast.error("复制失败，请手动选择");
    }
  };

  const onSubmit = async () => {
    const name = displayName.trim();
    if (!name) {
      showToast.warning("请输入学生姓名");
      return;
    }
    const hours = Number(studyHours);
    if (Number.isNaN(hours) || hours < 0) {
      showToast.warning("学时无效");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createTeacherStudent({
        displayName: name,
        studyHours: Math.floor(hours),
      });
      if (res.code !== 200) {
        showToast.error(res.msg || "创建失败");
        return;
      }
      const sid = res.data?.student?.id || res.data?.quota?.studentId;
      if (sid) setTrainingStudent(sid, name);
      const loginName = res.data?.username || res.data?.student?.username || "";
      const initPwd = res.data?.initialPassword || DEFAULT_PASSWORD;
      if (!loginName) {
        showToast.success("学生已创建");
        navigate(sid ? `/my-students/${sid}` : "/my-students", {
          replace: true,
          state: sid ? { studentName: name } : undefined,
        });
        return;
      }
      setCreated({ username: loginName, password: initPwd, name, studentId: sid });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "创建失败";
      showToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-0 flex flex-col flex-1 bg-background">
      <PageBackHeader title="新建学生" fallbackTo="/my-students" maxWidthClass="w-full" />

      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 space-y-3">
        <section className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">基本信息</h2>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div>
              <label className="text-sm text-charcoal font-medium mb-1.5 block">
                <span className="text-destructive">*</span> 学生姓名
              </label>
              <CloudInput
                value={displayName}
                onChange={setDisplayName}
                placeholder="请输入学生姓名"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                登录账号将自动生成（姓名 + 随机数字），初始密码 {DEFAULT_PASSWORD}
              </p>
            </div>
            <div>
              <label className="text-sm text-charcoal font-medium mb-1.5 block">学时</label>
              <CloudInput
                value={studyHours}
                onChange={setStudyHours}
                inputMode="numeric"
                placeholder="0"
              />
              <p className="text-[11px] text-muted-foreground mt-1">1 学时 = 60 分钟陪练额度</p>
            </div>
          </div>
        </section>

        <button
          type="button"
          className="w-full flex items-center justify-between px-1 py-2 text-sm text-muted-foreground hover:text-primary"
          onClick={() => navigate("/my-students?link=1")}
        >
          <span>已有账号？去关联添加</span>
          <ChevronRight size={16} />
        </button>

        <div className="pt-1 pb-4">
          <CloudButton
            variant="brand"
            size="pillLg"
            className="w-full"
            loading={submitting}
            onClick={() => void onSubmit()}
          >
            创建学生
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
            <DialogTitle>创建成功</DialogTitle>
            <DialogDescription>
              {created?.name} 的登录信息如下，请复制发给学员。
            </DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/60 border border-border px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground">登录账号</div>
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
                    复制
                  </CloudButton>
                </div>
              </div>
              <div className="rounded-xl bg-muted/60 border border-border px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground">初始密码</div>
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
                    复制
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
                  `账号：${created.username}\n密码：${created.password}`,
                  "all"
                );
              }}
            >
              {copied === "all" ? <Check size={14} /> : <Copy size={14} />}
              复制全部
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
              完成
            </CloudButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
