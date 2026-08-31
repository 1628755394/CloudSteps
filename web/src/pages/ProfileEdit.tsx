import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Camera, ChevronLeft, Loader2 } from "lucide-react";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard, CloudSelect } from "../components/cloudsteps/arco";
import { updateCurrentUser, uploadAvatar } from "../api/auth";
import { useAuthStore } from "../stores/authStore";
import { teacherAvatarSrc } from "../utils/avatar";
import { showToast } from "../utils/toast";

const fieldClass =
  "w-full px-3 py-2 rounded-xl bg-card border border-input text-sm text-charcoal placeholder:text-muted-soft outline-none transition-colors hover:border-border focus:border-primary focus:ring-[3px] focus:ring-primary/25";

export default function ProfileEdit() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const refreshUserInfo = useAuthStore((s) => s.refreshUserInfo);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const avatarUrl = teacherAvatarSrc(avatarPreview || user?.avatar);

  const profileComplete = useMemo(() => {
    if (typeof user?.profileComplete === "number") return user.profileComplete;
    // 本地兜底（刷新前）：与后端计分项一致
    const checks = [
      Boolean(displayName.trim() || user?.displayName),
      Boolean(avatarPreview || user?.avatar),
      Boolean(phone.trim() || user?.phone),
      Boolean(gender.trim() || user?.gender),
      Boolean(city.trim() || user?.city),
      Boolean(region.trim() || user?.region),
      Boolean(user?.locale),
    ];
    const n = checks.filter(Boolean).length;
    return Math.round((n / checks.length) * 100);
  }, [user, displayName, avatarPreview, phone, gender, city, region]);

  const stats = useMemo(() => {
    return [
      { label: t("profile_edit.login_count"), value: String(user?.loginCount ?? "-") },
      { label: t("profile_edit.profile_completeness"), value: `${profileComplete}%` },
      {
        label: t("profile_edit.streak_days"),
        value: typeof user?.streakDays === "number" ? `${user.streakDays}${t("profile_edit.day_unit")}` : "-",
      },
    ];
  }, [user, profileComplete, t]);

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
    setPhone(user?.phone ?? "");
    setGender(user?.gender ?? "");
    setRegion(user?.region ?? "");
    setCity(user?.city ?? "");
    setTimezone(user?.timezone ?? "");
  }, [user]);

  const genderOptions = useMemo(
    () => [
      { value: "male", label: t("profile_edit.male") },
      { value: "female", label: t("profile_edit.female") },
      { value: "other", label: t("profile_edit.other") },
    ],
    [t],
  );

  const timezoneOptions = useMemo(
    () => [
      { value: "Asia/Shanghai", label: t("profile_edit.timezone_shanghai") },
      { value: "Asia/Hong_Kong", label: "Asia/Hong_Kong" },
      { value: "Asia/Taipei", label: "Asia/Taipei" },
      { value: "Asia/Singapore", label: "Asia/Singapore" },
      { value: "Asia/Tokyo", label: "Asia/Tokyo" },
      { value: "America/Los_Angeles", label: "America/Los_Angeles" },
      { value: "America/New_York", label: "America/New_York" },
      { value: "Europe/London", label: "Europe/London" },
      { value: "Europe/Paris", label: "Europe/Paris" },
    ],
    [t]
  );

  const onPickAvatar = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const onAvatarFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast.warning(t("profile_edit.select_image"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast.warning(t("profile_edit.image_too_large"));
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);
    setUploading(true);
    setErrorText(null);
    try {
      const res = await uploadAvatar(file);
      if (res.code !== 200 || !res.data?.avatar) {
        setErrorText(res.msg || t("profile_edit.avatar_upload_failed"));
        setAvatarPreview(null);
        return;
      }
      updateProfile({ avatar: res.data.avatar });
      setAvatarPreview(res.data.avatar);
      await refreshUserInfo();
      showToast.success(t("profile_edit.avatar_updated"));
    } catch (err: unknown) {
      setAvatarPreview(null);
      const msg =
        err && typeof err === "object" && "msg" in err
          ? String((err as { msg: string }).msg)
          : t("profile_edit.avatar_upload_failed");
      setErrorText(msg);
      showToast.error(msg);
    } finally {
      URL.revokeObjectURL(localUrl);
      setUploading(false);
    }
  };

  const onSave = async () => {
    setErrorText(null);

    if (!displayName.trim()) {
      setErrorText(t("profile_edit.enter_nickname"));
      return;
    }

    try {
      setSaving(true);
      const res = await updateCurrentUser({
        displayName: displayName.trim(),
        phone: phone.trim(),
        gender: gender.trim(),
        region: region.trim(),
        city: city.trim(),
        timezone: timezone.trim(),
      });

      if (res.code !== 200) {
        setErrorText(res.msg || t("profile_edit.save_failed"));
        return;
      }

      await refreshUserInfo();
      navigate("/coach-center", { replace: true });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : e instanceof Error
            ? e.message
            : t("profile_edit.save_failed");
      setErrorText(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3 max-w-2xl w-full mx-auto">
      <div className="flex items-center gap-2 shrink-0">
        <CloudButton
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label={t("profile_edit.back")}
          className="shrink-0"
        >
          <ChevronLeft size={18} />
        </CloudButton>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold tracking-tight text-foreground">{t("profile_edit.title")}</span>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {t("profile_edit.account_label")}{user?.email || "-"}
          </p>
        </div>
        <CloudButton
          type="button"
          variant="brand"
          size="sm"
          onClick={onSave}
          disabled={saving || uploading}
          loading={saving}
          loadingText={t("profile_edit.saving")}
          className="shrink-0"
        >
          {t("profile_edit.save")}
        </CloudButton>
      </div>

      <div className="grid grid-cols-3 gap-2 shrink-0">
        {stats.map((s) => (
          <CloudCard key={s.label} tint="mint" className="px-2.5 py-2 border-transparent text-center">
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
            <div className="text-sm font-semibold text-foreground mt-0.5 tabular-nums">{s.value}</div>
          </CloudCard>
        ))}
      </div>

      <CloudCard className="p-3.5 space-y-3 flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col items-center gap-2 pb-0.5">
          <div className="relative size-16 shrink-0">
            <button
              type="button"
              onClick={onPickAvatar}
              disabled={uploading}
              className="group relative block size-full appearance-none overflow-hidden rounded-full border border-border bg-primary-soft p-0 shadow-sm transition-[box-shadow,opacity] hover:shadow-md focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30 disabled:opacity-60 [clip-path:circle(50%_at_50%_50%)]"
              aria-label={t("profile_edit.change_avatar")}
            >
              <img
                src={avatarUrl}
                alt=""
                className="block size-full rounded-full object-cover"
              />
              <span className="pointer-events-none absolute inset-0 rounded-full bg-black/0 transition-colors group-hover:bg-black/25" />
            </button>
            <span className="pointer-events-none absolute bottom-0 right-0 z-10 flex size-6 items-center justify-center rounded-full border border-border bg-card text-charcoal shadow-sm">
              {uploading ? (
                <Loader2 size={12} className="animate-spin text-primary" />
              ) : (
                <Camera size={12} />
              )}
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={onAvatarFile}
          />
          <p className="text-[11px] text-muted-foreground">{t("profile_edit.click_avatar_to_change")}</p>
        </div>

        <div>
          <label className="text-xs font-medium text-charcoal mb-1 block">{t("profile_edit.nickname")}</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("profile_edit.enter_nickname")}
            className={fieldClass}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-charcoal mb-1 block">{t("profile_edit.phone")}</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("profile_edit.enter_phone")}
              className={fieldClass}
            />
          </div>

          <CloudSelect
            label={t("profile_edit.gender")}
            value={gender || undefined}
            onChange={(v) => setGender(v ?? "")}
            options={genderOptions}
            placeholder={t("profile_edit.select_gender")}
            allowClear
            sheetTitle={t("profile_edit.select_gender_title")}
          />

          <CloudSelect
            label={t("profile_edit.timezone")}
            value={timezone || undefined}
            onChange={(v) => setTimezone(v ?? "")}
            options={timezoneOptions}
            placeholder={t("profile_edit.select_timezone")}
            allowClear={false}
            showSearch
            sheetTitle={t("profile_edit.select_timezone_title")}
          />

          <div>
            <label className="text-xs font-medium text-charcoal mb-1 block">{t("profile_edit.region")}</label>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder={t("profile_edit.region_placeholder")}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-charcoal mb-1 block">{t("profile_edit.city")}</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t("profile_edit.city_placeholder")}
              className={fieldClass}
            />
          </div>
        </div>

        {errorText ? (
          <div className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-3 py-2.5">
            {errorText}
          </div>
        ) : null}
      </CloudCard>
    </div>
  );
}
