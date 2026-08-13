import { useNavigate } from "react-router";
import {
  ChevronRight,
  Lock,
  Smartphone,
  Bell,
  Shield,
  LogOut,
  Palette,
  LayoutTemplate,
  SunMoon,
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
  type LayoutMode,
  type ThemeMode,
  useThemeStore,
} from "../stores/themeStore";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import {
  changePassword,
  getUserActivity,
  sendPhoneVerification,
  updateCurrentUser,
  updateNotificationSettings,
  verifyPhone,
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
    icon: Smartphone,
    label: "绑定手机号",
    description: "用于登录验证和找回密码",
    panel: "phone" as const,
    tint: "sky" as const,
  },
  {
    id: 3 as const,
    icon: Bell,
    label: "消息通知",
    description: "管理推送通知和提醒设置",
    panel: "notifications" as const,
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

const ACCENT_KEYS = Object.keys(ACCENT_PRESETS) as AccentColor[];
const LAYOUT_KEYS = Object.keys(LAYOUT_PRESETS) as LayoutMode[];
const MODE_KEYS = Object.keys(THEME_MODE_PRESETS) as ThemeMode[];

export default function Settings() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const clearUser = useAuthStore((s) => s.clearUser);
  const refreshUserInfo = useAuthStore((s) => s.refreshUserInfo);
  const user = useAuthStore((s) => s.user);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const themeMode = useThemeStore((s) => s.mode);
  const accent = useThemeStore((s) => s.accent);
  const layout = useThemeStore((s) => s.layout);
  const setMode = useThemeStore((s) => s.setMode);
  const setAccent = useThemeStore((s) => s.setAccent);
  const setLayout = useThemeStore((s) => s.setLayout);

  const [panel, setPanel] = useState<null | "password" | "phone" | "notifications" | "security">(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);

  const [emailNotifications, setEmailNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [systemNotifications, setSystemNotifications] = useState(false);
  const [autoCleanUnreadEmails, setAutoCleanUnreadEmails] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

  const [activityLoading, setActivityLoading] = useState(false);
  const [activities, setActivities] = useState<UserActivity[]>([]);

  useEffect(() => {
    setPhone(user?.phone ?? "");
    setEmailNotifications(Boolean(user?.emailNotifications));
    setPushNotifications(Boolean(user?.pushNotifications));
    setSystemNotifications(Boolean(user?.systemNotifications));
    setAutoCleanUnreadEmails(Boolean(user?.autoCleanUnreadEmails));
  }, [user]);

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
      <PageBackHeader title="设置" fallbackTo="/coach-center" maxWidthClass="max-w-[800px]" />

      <div className="flex-1 min-h-0 max-w-[800px] w-full mx-auto px-3 py-3 flex flex-col gap-2.5 overflow-y-auto">
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
              <div className="grid grid-cols-4 gap-2">
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
              </div>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5 px-0.5 flex items-center gap-1">
                <LayoutTemplate size={12} />
                布局
              </div>
              <div className="grid grid-cols-3 gap-1.5">
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
                  onClick={() => openPanel(option.panel)}
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

        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className="mt-auto w-full bg-card border border-border rounded-xl px-4 py-2.5 text-destructive text-sm font-medium hover:bg-destructive/5 transition-colors flex items-center justify-center gap-2 shrink-0"
        >
          <LogOut size={16} />
          <span>退出登录</span>
        </button>
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

        <Dialog open={panel !== null} onOpenChange={(v) => !v && setPanel(null)}>
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

            {panel === "phone" ? (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground">绑定手机号</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-charcoal font-medium mb-1.5 block">手机号</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="请输入手机号"
                      className={fieldClass}
                    />
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      提示：验证码发送接口要求你已在资料中设置手机号。
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <CloudButton
                      type="button"
                      variant="brand"
                      disabled={sendingPhoneCode}
                      loading={sendingPhoneCode}
                      loadingText="发送中..."
                      onClick={async () => {
                        setErrorText(null);
                        try {
                          setSendingPhoneCode(true);
                          if (!phone.trim()) {
                            setErrorText("请先填写手机号");
                            return;
                          }
                          await updateCurrentUser({ phone: phone.trim() });
                          const res = await sendPhoneVerification();
                          if (res.code !== 200) {
                            setErrorText(res.msg || "发送失败");
                            return;
                          }
                        } catch (e: any) {
                          setErrorText(e?.msg || e?.message || "发送失败");
                        } finally {
                          setSendingPhoneCode(false);
                        }
                      }}
                    >
                      发送验证码
                    </CloudButton>
                    <input
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
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
                    disabled={verifyingPhone}
                  >
                    关闭
                  </CloudButton>
                  <CloudButton
                    type="button"
                    variant="brand"
                    loading={verifyingPhone}
                    loadingText="验证中..."
                    disabled={verifyingPhone}
                    onClick={async () => {
                      setErrorText(null);
                      if (!phoneCode.trim()) {
                        setErrorText("请输入验证码");
                        return;
                      }
                      try {
                        setVerifyingPhone(true);
                        const res = await verifyPhone(phoneCode.trim());
                        if (res.code !== 200) {
                          setErrorText(res.msg || "验证失败");
                          return;
                        }
                        await refreshUserInfo();
                        setPanel(null);
                        setPhoneCode("");
                      } catch (e: any) {
                        setErrorText(e?.msg || e?.message || "验证失败");
                      } finally {
                        setVerifyingPhone(false);
                      }
                    }}
                  >
                    确认绑定
                  </CloudButton>
                </DialogFooter>
              </>
            ) : null}

            {panel === "notifications" ? (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground">消息通知</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                  {[
                    {
                      label: "邮件通知",
                      desc: "重要活动与账号提醒",
                      checked: emailNotifications,
                      onChange: setEmailNotifications,
                    },
                    {
                      label: "推送通知",
                      desc: "学习提醒与系统推送",
                      checked: pushNotifications,
                      onChange: setPushNotifications,
                    },
                    {
                      label: "系统通知",
                      desc: "系统公告与安全提醒",
                      checked: systemNotifications,
                      onChange: setSystemNotifications,
                    },
                    {
                      label: "自动清理未读邮件",
                      desc: "自动清理 7 天未读",
                      checked: autoCleanUnreadEmails,
                      onChange: setAutoCleanUnreadEmails,
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between p-4 rounded-xl border border-border"
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">{row.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{row.desc}</div>
                      </div>
                      <Switch checked={row.checked} onCheckedChange={row.onChange} />
                    </div>
                  ))}

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
                    disabled={savingNotifications}
                  >
                    关闭
                  </CloudButton>
                  <CloudButton
                    type="button"
                    variant="brand"
                    loading={savingNotifications}
                    loadingText="保存中..."
                    disabled={savingNotifications}
                    onClick={async () => {
                      setErrorText(null);
                      try {
                        setSavingNotifications(true);
                        const res = await updateNotificationSettings({
                          emailNotifications,
                          pushNotifications,
                          systemNotifications,
                          autoCleanUnreadEmails,
                        });
                        if (res.code !== 200) {
                          setErrorText(res.msg || "保存失败");
                          return;
                        }
                        await refreshUserInfo();
                        setPanel(null);
                      } catch (e: any) {
                        setErrorText(e?.msg || e?.message || "保存失败");
                      } finally {
                        setSavingNotifications(false);
                      }
                    }}
                  >
                    保存
                  </CloudButton>
                </DialogFooter>
              </>
            ) : null}

            {panel === "security" ? (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground">账号安全</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-border">
                    <div className="text-sm font-medium text-foreground">最近登录</div>
                    <div className="text-sm text-muted-foreground mt-1">{user?.lastLogin || "-"}</div>
                  </div>

                  <div className="p-4 rounded-xl border border-border">
                    <div className="text-sm font-medium text-foreground">活动记录</div>
                    <div className="text-xs text-muted-foreground mt-1">显示最近 20 条</div>

                    <div className="mt-3 space-y-2 max-h-[320px] overflow-auto pr-1">
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
                </div>

                <DialogFooter>
                  <CloudButton type="button" variant="outline" onClick={() => setPanel(null)}>
                    关闭
                  </CloudButton>
                </DialogFooter>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
    </div>
  );
}
