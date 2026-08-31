import { useNavigate } from "react-router";
import {
  ChevronRight,
  Lock,
  Mail,
  Bell,
  Shield,
  LogOut,
  UserX,
  Palette,
  LayoutTemplate,
  SunMoon,
  Languages,
} from "lucide-react";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard } from "../components/cloudsteps/arco";
import { PageBackHeader } from "../components/PageBackHeader";
import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import {
  ACCENT_PRESETS,
  LAYOUT_PRESETS,
  THEME_MODE_PRESETS,
  type AccentColor,
  type AccentPresetKey,
  type LayoutMode,
  type ThemeMode,
  useThemeStore,
} from "../stores/themeStore";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { showToast } from "../utils/toast";
import { useLocale } from "../hooks/useLocale";
import {
  bindEmail,
  changePassword,
  deactivateAccount,
  getUserActivity,
  sendBindEmailCode,
  type UserActivity,
} from "../api/auth";

const fieldClass =
  "w-full px-4 py-3 rounded-xl bg-card border border-input text-charcoal placeholder:text-muted-soft transition-colors outline-none hover:border-border focus:border-primary focus:ring-[3px] focus:ring-primary/25";

const settingOptions = [
  {
    id: 1 as const,
    icon: Lock,
    label: "修改密码",
    description: "定期修改密码，保障账号安全",
    panel: "password" as const,
    tint: "mint" as const,
  },
  {
    id: 2 as const,
    icon: Mail,
    label: "绑定邮箱",
    description: "用于接收通知与账号找回",
    panel: "email" as const,
    tint: "mint" as const,
  },
  {
    id: 3 as const,
    icon: Bell,
    label: "系统公告",
    description: "查看系统公告与通知",
    path: "/announcements",
    tint: "mint" as const,
  },
  {
    id: 4 as const,
    icon: Shield,
    label: "账号安全",
    description: "查看登录记录和设备管理",
    panel: "security" as const,
    tint: "sky" as const,
  },
];

const otherLinks = [
  { label: "关于我们", path: "/about" },
  { label: "用户协议", path: "/terms" },
  { label: "隐私政策", path: "/privacy" },
];

const tintIcon: Record<"mint" | "sky", string> = {
  mint: "bg-primary-soft text-primary",
  sky: "bg-tint-sky text-secondary-brand",
};

const ACCENT_KEYS = Object.keys(ACCENT_PRESETS) as AccentPresetKey[];
const LAYOUT_KEYS = Object.keys(LAYOUT_PRESETS) as LayoutMode[];
const MODE_KEYS = Object.keys(THEME_MODE_PRESETS) as ThemeMode[];

export default function Settings() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const clearUser = useAuthStore((s) => s.clearUser);
  const refreshUserInfo = useAuthStore((s) => s.refreshUserInfo);
  const user = useAuthStore((s) => s.user);
  const { t, locale, changeLocale } = useLocale();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const themeMode = useThemeStore((s) => s.mode);
  const accent = useThemeStore((s) => s.accent);
  const customHex = useThemeStore((s) => s.customHex);
  const layout = useThemeStore((s) => s.layout);
  const setMode = useThemeStore((s) => s.setMode);
  const setAccent = useThemeStore((s) => s.setAccent);
  const setCustomHex = useThemeStore((s) => s.setCustomHex);
  const setLayout = useThemeStore((s) => s.setLayout);

  const [panel, setPanel] = useState<null | "password" | "email" | "security">(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [bindEmailValue, setBindEmailValue] = useState("");
  const [bindEmailCode, setBindEmailCode] = useState("");
  const [sendingBindEmailCode, setSendingBindEmailCode] = useState(false);
  const [bindingEmail, setBindingEmail] = useState(false);
  const [bindEmailCountdown, setBindEmailCountdown] = useState(0);

  useEffect(() => {
    if (bindEmailCountdown <= 0) return;
    const timer = setTimeout(() => setBindEmailCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [bindEmailCountdown]);

  const [activityLoading, setActivityLoading] = useState(false);
  const [activities, setActivities] = useState<UserActivity[]>([]);

  useEffect(() => {
    if (panel !== "security") return;
    let mounted = true;
    (async () => {
      try {
        setActivityLoading(true);
        const res = await getUserActivity({ page: 1, limit: 20 });
        if (!mounted) return;
        if (res.code === 200) {
          setActivities(res.data?.activities ?? []);
        } else {
          setActivities([]);
        }
      } catch {
        if (!mounted) return;
        setActivities([]);
      } finally {
        if (mounted) setActivityLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [panel]);

  const openPanel = (p: NonNullable<typeof panel>) => {
    setErrorText(null);
    setPanel(p);
  };

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      <PageBackHeader title="设置" fallbackTo="/coach-center" maxWidthClass="max-w-none" />

      <div className="flex-1 min-h-0 w-full py-3 flex flex-col gap-2.5 overflow-y-auto">
        <CloudCard className="p-3 shrink-0">
          <h2 className="text-xs font-semibold text-muted-foreground px-1 pb-2 flex items-center gap-1.5">
            <SunMoon size={13} />
            外观与主题
          </h2>

          <div className="space-y-3">
            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5 px-0.5">主题模式</div>
              <div className="flex flex-wrap gap-1.5">
                {MODE_KEYS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                      themeMode === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {THEME_MODE_PRESETS[m].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5 px-0.5 flex items-center gap-1">
                <Palette size={12} />
                主题色
              </div>
              <div className="grid grid-cols-5 gap-2">
                {ACCENT_KEYS.map((key) => {
                  const preset = ACCENT_PRESETS[key];
                  const active = accent === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAccent(key)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2 transition-colors ${
                        active
                          ? "border-primary bg-primary-soft"
                          : "border-border hover:border-primary/40"
                      }`}
                      title={preset.label}
                    >
                      <span
                        className={`size-7 rounded-full ring-2 ring-offset-2 ring-offset-card ${
                          active ? "ring-primary" : "ring-transparent"
                        }`}
                        style={{ backgroundColor: preset.hex }}
                      />
                      <span className="text-[10px] text-foreground leading-none">{preset.label}</span>
                    </button>
                  );
                })}
                {/* 自定义颜色 */}
                <label
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2 transition-colors cursor-pointer ${
                    accent === "custom"
                      ? "border-primary bg-primary-soft"
                      : "border-border hover:border-primary/40"
                  }`}
                  title="自定义颜色"
                >
                  <span
                    className={`size-7 rounded-full ring-2 ring-offset-2 ring-offset-card ${
                      accent === "custom" ? "ring-primary" : "ring-transparent"
                    }`}
                    style={{ backgroundColor: customHex }}
                  />
                  <span className="text-[10px] text-foreground leading-none">自定义</span>
                  <input
                    type="color"
                    value={customHex}
                    onChange={(e) => setCustomHex(e.target.value)}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5 px-0.5 flex items-center gap-1">
                <LayoutTemplate size={12} />
                布局
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {LAYOUT_KEYS.map((key) => {
                  const preset = LAYOUT_PRESETS[key];
                  const active = layout === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setLayout(key)}
                      className={`rounded-xl border px-2.5 py-2 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary-soft"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className={`text-sm font-medium ${active ? "text-primary" : "text-foreground"}`}>
                        {preset.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                        {preset.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CloudCard>

        <CloudCard className="p-1.5 shrink-0">
          <h2 className="text-xs font-semibold text-muted-foreground px-2.5 pt-1.5 pb-0.5">账号设置</h2>
          <div className="divide-y divide-border">
            {settingOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    if ("path" in option && option.path) {
                      navigate(option.path);
                    } else if (option.panel) {
                      openPanel(option.panel);
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2.5 text-left rounded-lg hover:bg-muted/60 transition-colors group"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tintIcon[option.tint]}`}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground leading-tight">{option.label}</div>
                    <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                      {option.description}
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-muted-soft group-hover:text-primary shrink-0 transition-colors"
                  />
                </button>
              );
            })}
          </div>
        </CloudCard>

        <CloudCard className="p-1.5 shrink-0">
          <h2 className="text-xs font-semibold text-muted-foreground px-2.5 pt-1.5 pb-0.5 flex items-center gap-1.5">
            <Languages size={13} />
            {t("settings.language")}
          </h2>
          <div className="divide-y divide-border">
            <div className="px-2.5 py-2.5 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{t("settings.language")}</span>
              <div className="flex gap-1.5">
                {([
                  { value: "zh-CN", label: "中文" },
                  { value: "en", label: "English" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => changeLocale(opt.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      locale === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CloudCard>

        <CloudCard className="p-1.5 shrink-0">
          <h2 className="text-xs font-semibold text-muted-foreground px-2.5 pt-1.5 pb-0.5">其他</h2>
          <div className="divide-y divide-border">
            {otherLinks.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="w-full flex items-center justify-between px-2.5 py-2.5 text-left rounded-lg hover:bg-muted/60 transition-colors group"
              >
                <span className="text-sm font-medium text-foreground">{item.label}</span>
                <ChevronRight
                  size={16}
                  className="text-muted-soft group-hover:text-primary transition-colors"
                />
              </button>
            ))}
          </div>
        </CloudCard>

        <div className="mt-auto flex flex-col gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className="w-full bg-card border border-destructive/30 rounded-xl px-4 py-2.5 text-destructive text-sm font-medium hover:bg-destructive/5 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={16} />
          <span>退出登录</span>
        </button>
        </div>
      </div>

        <ConfirmDialog
          open={logoutOpen}
          onOpenChange={setLogoutOpen}
          title="确认退出登录？"
          description="退出后需要重新登录才能继续使用。"
          confirmText="退出登录"
          cancelText="取消"
          confirmVariant="destructive"
          onConfirm={async () => {
            await logout();
            navigate("/login", { replace: true });
          }}
        />

        <Dialog open={panel !== null && panel !== "security"} onOpenChange={(v) => !v && setPanel(null)}>
          <DialogContent className="sm:max-w-[520px] rounded-xl border-border">
            {panel === "password" ? (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground">修改密码</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-charcoal font-medium mb-1.5 block">当前密码</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="请输入当前密码"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-charcoal font-medium mb-1.5 block">新密码</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="至少 6 位"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-charcoal font-medium mb-1.5 block">确认新密码</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="再次输入新密码"
                      className={fieldClass}
                    />
                  </div>

                  {errorText ? (
                    <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
                      {errorText}
                    </div>
                  ) : null}
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                  <CloudButton
                    type="button"
                    variant="outline"
                    onClick={() => setPanel(null)}
                    disabled={savingPassword}
                  >
                    取消
                  </CloudButton>
                  <CloudButton
                    type="button"
                    variant="brand"
                    loading={savingPassword}
                    loadingText="保存中..."
                    disabled={savingPassword}
                    onClick={async () => {
                      setErrorText(null);
                      if (!currentPassword) {
                        setErrorText("请输入当前密码");
                        return;
                      }
                      if (!newPassword || newPassword.length < 6) {
                        setErrorText("新密码至少 6 位");
                        return;
                      }
                      if (confirmPassword && confirmPassword !== newPassword) {
                        setErrorText("两次输入的新密码不一致");
                        return;
                      }

                      try {
                        setSavingPassword(true);
                        const res = await changePassword({
                          currentPassword,
                          newPassword,
                          confirmPassword: confirmPassword || undefined,
                        });

                        if (res.code !== 200) {
                          setErrorText(res.msg || "修改失败");
                          return;
                        }

                        setPanel(null);
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");

                        if (res.data?.logout) {
                          clearUser();
                          navigate("/login", { replace: true });
                        }
                      } catch (e: any) {
                        setErrorText(e?.msg || e?.message || "修改失败");
                      } finally {
                        setSavingPassword(false);
                      }
                    }}
                  >
                    保存
                  </CloudButton>
                </DialogFooter>
              </>
            ) : null}

            {panel === "email" ? (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground">绑定邮箱</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {user?.email ? (
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <div className="text-xs text-muted-foreground">当前绑定邮箱</div>
                      <div className="text-sm text-foreground mt-1 break-all">{user.email}</div>
                    </div>
                  ) : null}

                  <div>
                    <label className="text-sm text-charcoal font-medium mb-1.5 block">
                      {user?.email ? "换绑邮箱" : "邮箱地址"}
                    </label>
                    <input
                      type="email"
                      value={bindEmailValue}
                      onChange={(e) => setBindEmailValue(e.target.value)}
                      placeholder="请输入要绑定的邮箱"
                      className={fieldClass}
                    />
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      一个邮箱只能绑定一个账号。绑定后可用于接收通知与账号找回。
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <CloudButton
                      type="button"
                      variant="brand"
                      disabled={sendingBindEmailCode || bindEmailCountdown > 0}
                      loading={sendingBindEmailCode}
                      loadingText="发送中..."
                      onClick={async () => {
                        setErrorText(null);
                        if (!bindEmailValue.trim()) {
                          setErrorText("请先填写邮箱");
                          return;
                        }
                        try {
                          setSendingBindEmailCode(true);
                          const res = await sendBindEmailCode(bindEmailValue.trim());
                          if (res.code !== 200) {
                            setErrorText(res.msg || "发送失败");
                            return;
                          }
                          setBindEmailCountdown(60);
                        } catch (e: any) {
                          setErrorText(e?.msg || e?.message || "发送失败");
                        } finally {
                          setSendingBindEmailCode(false);
                        }
                      }}
                    >
                      {bindEmailCountdown > 0 ? `${bindEmailCountdown}s 后重发` : "发送验证码"}
                    </CloudButton>
                    <input
                      value={bindEmailCode}
                      onChange={(e) => setBindEmailCode(e.target.value)}
                      placeholder="输入验证码"
                      className={`flex-1 ${fieldClass}`}
                    />
                  </div>

                  {errorText ? (
                    <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
                      {errorText}
                    </div>
                  ) : null}
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                  <CloudButton
                    type="button"
                    variant="outline"
                    onClick={() => setPanel(null)}
                    disabled={bindingEmail}
                  >
                    关闭
                  </CloudButton>
                  <CloudButton
                    type="button"
                    variant="brand"
                    loading={bindingEmail}
                    loadingText="绑定中..."
                    disabled={bindingEmail}
                    onClick={async () => {
                      setErrorText(null);
                      if (!bindEmailValue.trim()) {
                        setErrorText("请输入邮箱");
                        return;
                      }
                      if (!bindEmailCode.trim()) {
                        setErrorText("请输入验证码");
                        return;
                      }
                      try {
                        setBindingEmail(true);
                        const res = await bindEmail(bindEmailValue.trim(), bindEmailCode.trim());
                        if (res.code !== 200) {
                          setErrorText(res.msg || "绑定失败");
                          return;
                        }
                        await refreshUserInfo();
                        showToast.success("邮箱绑定成功");
                        setPanel(null);
                        setBindEmailValue("");
                        setBindEmailCode("");
                      } catch (e: any) {
                        setErrorText(e?.msg || e?.message || "绑定失败");
                      } finally {
                        setBindingEmail(false);
                      }
                    }}
                  >
                    确认绑定
                  </CloudButton>
                </DialogFooter>
              </>
            ) : null}

            {panel === "security" ? null : null}
          </DialogContent>
        </Dialog>

        {panel === "security" ? (
          <div className="fixed inset-0 z-50 bg-background flex flex-col">
            <PageBackHeader title="账号安全" fallbackTo="/settings" onBack={() => setPanel(null)} maxWidthClass="max-w-2xl" />

            <div className="flex-1 min-h-0 w-full py-3 overflow-y-auto">
              <div className="max-w-2xl mx-auto px-3 space-y-3">
                <div className="p-4 rounded-xl border border-border bg-card">
                  <div className="text-sm font-medium text-foreground">活动记录</div>
                  <div className="text-xs text-muted-foreground mt-1">显示最近 20 条</div>

                  <div className="mt-3 space-y-2 max-h-[360px] overflow-auto pr-1">
                    {activityLoading ? (
                      <div className="text-sm text-muted-foreground">加载中...</div>
                    ) : activities.length === 0 ? (
                      <div className="text-sm text-muted-foreground">暂无记录</div>
                    ) : (
                      activities.map((a) => (
                        <div key={a.id} className="p-3 rounded-xl bg-muted border border-border">
                          <div className="text-sm font-medium text-foreground">{a.action || "-"}</div>
                          <div className="text-xs text-muted-foreground mt-1 break-words">
                            {a.createdAt}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {errorText ? (
                  <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
                    {errorText}
                  </div>
                ) : null}

                <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5">
                  <div className="text-sm font-medium text-destructive">注销账号</div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    注销后你将无法使用本账号登录，剩余学时和授课额度将全部清空。此操作不可撤销，请谨慎操作。
                  </p>
                  <button
                    type="button"
                    onClick={() => setDeactivateOpen(true)}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <UserX size={16} />
                    申请注销账号
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <Dialog open={deactivateOpen} onOpenChange={(v) => !deactivating && setDeactivateOpen(v)}>
          <DialogContent className="sm:max-w-[480px] rounded-xl border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">注销账号</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-muted-foreground space-y-3">
              <p>注销后你将无法使用本账号登录，请确认已了解以下后果：</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>账号将被停用，无法登录或继续使用功能</li>
                <li>剩余学员学时、教师授课额度将全部清空</li>
                <li>若为教师，名下学员账号将一并注销</li>
                <li>使用相同邮箱重新注册将获得新账号，与本次账号的历史数据无关</li>
              </ul>
              <p className="text-destructive font-medium">此操作不可撤销，请谨慎操作。</p>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <CloudButton
                type="button"
                variant="outline"
                disabled={deactivating}
                onClick={() => setDeactivateOpen(false)}
              >
                取消
              </CloudButton>
              <CloudButton
                type="button"
                variant="destructive"
                loading={deactivating}
                loadingText="注销中..."
                disabled={deactivating}
                onClick={async () => {
                  try {
                    setDeactivating(true);
                    const res = await deactivateAccount();
                    if (res.code !== 200) {
                      showToast.error(res.msg || "注销失败");
                      return;
                    }
                    setDeactivateOpen(false);
                    clearUser();
                    showToast.success("账号已注销");
                    navigate("/login", { replace: true });
                  } catch (e: unknown) {
                    const msg =
                      e && typeof e === "object" && "msg" in e
                        ? String((e as { msg: string }).msg)
                        : "注销失败";
                    showToast.error(msg);
                  } finally {
                    setDeactivating(false);
                  }
                }}
              >
                确认注销
              </CloudButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
