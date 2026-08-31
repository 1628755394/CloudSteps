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
import { CloudCard, CloudSelect } from "../components/cloudsteps/arco";
import { PageBackHeader } from "../components/PageBackHeader";
import { useEffect, useMemo, useState } from "react";
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
import { useLocale, type Locale } from "../hooks/useLocale";
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
    labelKey: "settings.change_password",
    descKey: "settings.change_password_desc",
    panel: "password" as const,
    tint: "mint" as const,
  },
  {
    id: 2 as const,
    icon: Mail,
    labelKey: "settings.bind_email",
    descKey: "settings.bind_email_desc",
    panel: "email" as const,
    tint: "mint" as const,
  },
  {
    id: 3 as const,
    icon: Bell,
    labelKey: "settings.announcements",
    descKey: "settings.announcements_desc",
    path: "/announcements",
    tint: "mint" as const,
  },
  {
    id: 4 as const,
    icon: Shield,
    labelKey: "settings.security",
    descKey: "settings.security_desc",
    panel: "security" as const,
    tint: "sky" as const,
  },
];

const otherLinks = [
  { labelKey: "settings.about", path: "/about" },
  { labelKey: "settings.terms", path: "/terms" },
  { labelKey: "settings.privacy", path: "/privacy" },
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
  const languageOptions = useMemo(
    () => [
      { value: "zh-CN", label: t("settings.lang_zh") },
      { value: "en", label: t("settings.lang_en") },
    ],
    [t],
  );
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
      <PageBackHeader title={t("settings.title")} fallbackTo="/coach-center" maxWidthClass="max-w-none" />

      <div className="flex-1 min-h-0 w-full py-3 flex flex-col gap-2.5 overflow-y-auto">
        <CloudCard className="p-3 shrink-0">
          <h2 className="text-xs font-semibold text-muted-foreground px-1 pb-2 flex items-center gap-1.5">
            <SunMoon size={13} />
            {t("settings.appearance")}
          </h2>

          <div className="space-y-3">
            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5 px-0.5">{t("settings.theme")}</div>
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
                    {t(THEME_MODE_PRESETS[m].labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5 px-0.5 flex items-center gap-1">
                <Palette size={12} />
                {t("settings.accent")}
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
                      title={t(preset.labelKey)}
                    >
                      <span
                        className={`size-7 rounded-full ring-2 ring-offset-2 ring-offset-card ${
                          active ? "ring-primary" : "ring-transparent"
                        }`}
                        style={{ backgroundColor: preset.hex }}
                      />
                      <span className="text-[10px] text-foreground leading-none">{t(preset.labelKey)}</span>
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
                  title={t("settings.custom_color")}
                >
                  <span
                    className={`size-7 rounded-full ring-2 ring-offset-2 ring-offset-card ${
                      accent === "custom" ? "ring-primary" : "ring-transparent"
                    }`}
                    style={{ backgroundColor: customHex }}
                  />
                  <span className="text-[10px] text-foreground leading-none">{t("settings.custom")}</span>
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
                {t("settings.layout")}
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
                        {t(preset.labelKey)}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                        {t(preset.descKey)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                <Languages size={12} />
                {t("settings.language")}
              </div>
              <CloudSelect
                className="w-auto min-w-[6.5rem] shrink-0"
                style={{ width: "auto" }}
                size="small"
                value={locale}
                onChange={(v) => v && changeLocale(v as Locale)}
                options={languageOptions}
                allowClear={false}
                sheetTitle={t("settings.language")}
              />
            </div>
          </div>
        </CloudCard>

        <CloudCard className="p-1.5 shrink-0">
          <h2 className="text-xs font-semibold text-muted-foreground px-2.5 pt-1.5 pb-0.5">{t("settings.account_settings")}</h2>
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
                    <div className="text-sm font-medium text-foreground leading-tight">{t(option.labelKey)}</div>
                    <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                      {t(option.descKey)}
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
          <h2 className="text-xs font-semibold text-muted-foreground px-2.5 pt-1.5 pb-0.5">{t("settings.other")}</h2>
          <div className="divide-y divide-border">
            {otherLinks.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="w-full flex items-center justify-between px-2.5 py-2.5 text-left rounded-lg hover:bg-muted/60 transition-colors group"
              >
                <span className="text-sm font-medium text-foreground">{t(item.labelKey)}</span>
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
          <span>{t("settings.logout")}</span>
        </button>
        </div>
      </div>

        <ConfirmDialog
          open={logoutOpen}
          onOpenChange={setLogoutOpen}
          title={t("settings.logout_confirm_title")}
          description={t("settings.logout_confirm_desc")}
          confirmText={t("settings.logout")}
          cancelText={t("settings.cancel")}
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
                  <DialogTitle className="text-foreground">{t("settings.change_password")}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-charcoal font-medium mb-1.5 block">{t("settings.current_password")}</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={t("settings.enter_current_password")}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-charcoal font-medium mb-1.5 block">{t("settings.new_password")}</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t("settings.password_min_6_placeholder")}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-charcoal font-medium mb-1.5 block">{t("settings.confirm_password")}</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t("settings.reenter_new_password")}
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
                    {t("settings.cancel")}
                  </CloudButton>
                  <CloudButton
                    type="button"
                    variant="brand"
                    loading={savingPassword}
                    loadingText={t("settings.saving")}
                    disabled={savingPassword}
                    onClick={async () => {
                      setErrorText(null);
                      if (!currentPassword) {
                        setErrorText(t("settings.enter_current_password"));
                        return;
                      }
                      if (!newPassword || newPassword.length < 6) {
                        setErrorText(t("settings.password_min_6"));
                        return;
                      }
                      if (confirmPassword && confirmPassword !== newPassword) {
                        setErrorText(t("settings.password_mismatch"));
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
                          setErrorText(res.msg || t("settings.change_failed"));
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
                        setErrorText(e?.msg || e?.message || t("settings.change_failed"));
                      } finally {
                        setSavingPassword(false);
                      }
                    }}
                  >
                    {t("settings.save")}
                  </CloudButton>
                </DialogFooter>
              </>
            ) : null}

            {panel === "email" ? (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground">{t("settings.bind_email")}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {user?.email ? (
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <div className="text-xs text-muted-foreground">{t("settings.current_bound_email")}</div>
                      <div className="text-sm text-foreground mt-1 break-all">{user.email}</div>
                    </div>
                  ) : null}

                  <div>
                    <label className="text-sm text-charcoal font-medium mb-1.5 block">
                      {user?.email ? t("settings.change_email") : t("settings.email_address")}
                    </label>
                    <input
                      type="email"
                      value={bindEmailValue}
                      onChange={(e) => setBindEmailValue(e.target.value)}
                      placeholder={t("settings.enter_bind_email")}
                      className={fieldClass}
                    />
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {t("settings.bind_email_notice")}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <CloudButton
                      type="button"
                      variant="brand"
                      disabled={sendingBindEmailCode || bindEmailCountdown > 0}
                      loading={sendingBindEmailCode}
                      loadingText={t("settings.sending")}
                      onClick={async () => {
                        setErrorText(null);
                        if (!bindEmailValue.trim()) {
                          setErrorText(t("settings.enter_email_first"));
                          return;
                        }
                        try {
                          setSendingBindEmailCode(true);
                          const res = await sendBindEmailCode(bindEmailValue.trim());
                          if (res.code !== 200) {
                            setErrorText(res.msg || t("settings.send_failed"));
                            return;
                          }
                          setBindEmailCountdown(60);
                        } catch (e: any) {
                          setErrorText(e?.msg || e?.message || t("settings.send_failed"));
                        } finally {
                          setSendingBindEmailCode(false);
                        }
                      }}
                    >
                      {bindEmailCountdown > 0 ? t("settings.resend_in", { seconds: bindEmailCountdown }) : t("settings.send_code")}
                    </CloudButton>
                    <input
                      value={bindEmailCode}
                      onChange={(e) => setBindEmailCode(e.target.value)}
                      placeholder={t("settings.enter_code_placeholder")}
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
                    {t("settings.close")}
                  </CloudButton>
                  <CloudButton
                    type="button"
                    variant="brand"
                    loading={bindingEmail}
                    loadingText={t("settings.binding")}
                    disabled={bindingEmail}
                    onClick={async () => {
                      setErrorText(null);
                      if (!bindEmailValue.trim()) {
                        setErrorText(t("settings.enter_email"));
                        return;
                      }
                      if (!bindEmailCode.trim()) {
                        setErrorText(t("settings.enter_code"));
                        return;
                      }
                      try {
                        setBindingEmail(true);
                        const res = await bindEmail(bindEmailValue.trim(), bindEmailCode.trim());
                        if (res.code !== 200) {
                          setErrorText(res.msg || t("settings.bind_failed"));
                          return;
                        }
                        await refreshUserInfo();
                        showToast.success(t("settings.bind_success"));
                        setPanel(null);
                        setBindEmailValue("");
                        setBindEmailCode("");
                      } catch (e: any) {
                        setErrorText(e?.msg || e?.message || t("settings.bind_failed"));
                      } finally {
                        setBindingEmail(false);
                      }
                    }}
                  >
                    {t("settings.confirm_bind")}
                  </CloudButton>
                </DialogFooter>
              </>
            ) : null}

            {panel === "security" ? null : null}
          </DialogContent>
        </Dialog>

        {panel === "security" ? (
          <div className="fixed inset-0 z-50 bg-background flex flex-col">
            <PageBackHeader title={t("settings.security")} fallbackTo="/settings" onBack={() => setPanel(null)} maxWidthClass="max-w-2xl" />

            <div className="flex-1 min-h-0 w-full py-3 overflow-y-auto">
              <div className="max-w-2xl mx-auto px-3 space-y-3">
                <div className="p-4 rounded-xl border border-border bg-card">
                  <div className="text-sm font-medium text-foreground">{t("settings.activity_log")}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t("settings.recent_20")}</div>

                  <div className="mt-3 space-y-2 max-h-[360px] overflow-auto pr-1">
                    {activityLoading ? (
                      <div className="text-sm text-muted-foreground">{t("settings.loading")}</div>
                    ) : activities.length === 0 ? (
                      <div className="text-sm text-muted-foreground">{t("settings.no_records")}</div>
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
                  <div className="text-sm font-medium text-destructive">{t("settings.deactivate_account")}</div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    {t("settings.deactivate_desc")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setDeactivateOpen(true)}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <UserX size={16} />
                    {t("settings.request_deactivate")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <Dialog open={deactivateOpen} onOpenChange={(v) => !deactivating && setDeactivateOpen(v)}>
          <DialogContent className="sm:max-w-[480px] rounded-xl border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">{t("settings.deactivate_account")}</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-muted-foreground space-y-3">
              <p>{t("settings.deactivate_warning")}</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>{t("settings.deactivate_consequence_1")}</li>
                <li>{t("settings.deactivate_consequence_2")}</li>
                <li>{t("settings.deactivate_consequence_3")}</li>
                <li>{t("settings.deactivate_consequence_4")}</li>
              </ul>
              <p className="text-destructive font-medium">{t("settings.deactivate_irreversible")}</p>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <CloudButton
                type="button"
                variant="outline"
                disabled={deactivating}
                onClick={() => setDeactivateOpen(false)}
              >
                {t("settings.cancel")}
              </CloudButton>
              <CloudButton
                type="button"
                variant="destructive"
                loading={deactivating}
                loadingText={t("settings.deactivating")}
                disabled={deactivating}
                onClick={async () => {
                  try {
                    setDeactivating(true);
                    const res = await deactivateAccount();
                    if (res.code !== 200) {
                      showToast.error(res.msg || t("settings.deactivate_failed"));
                      return;
                    }
                    setDeactivateOpen(false);
                    clearUser();
                    showToast.success(t("settings.deactivated"));
                    navigate("/login", { replace: true });
                  } catch (e: unknown) {
                    const msg =
                      e && typeof e === "object" && "msg" in e
                        ? String((e as { msg: string }).msg)
                        : t("settings.deactivate_failed");
                    showToast.error(msg);
                  } finally {
                    setDeactivating(false);
                  }
                }}
              >
                {t("settings.confirm_deactivate")}
              </CloudButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
