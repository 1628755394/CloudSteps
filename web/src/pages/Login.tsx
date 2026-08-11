import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { CloudButton } from "../components/cloudsteps";
import { getCaptcha, loginWithPassword, type User } from "../api/auth";
import { useAuthStore } from "../stores/authStore";

const fieldClass =
  "w-full px-4 py-3 rounded-xl bg-card border border-input text-charcoal placeholder:text-muted-soft transition-colors duration-200 outline-none hover:border-border focus:border-primary focus:ring-[3px] focus:ring-primary/25";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const doLogin = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [captchaCode, setCaptchaCode] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastSubmitTsRef = useRef(0);

  const isSubmitting = isLoading || submitting;

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("next") || "/";
  }, [location.search]);

  const refreshCaptcha = async () => {
    try {
      const res = await getCaptcha();
      if (res.code !== 200) return;
      setCaptchaId(res.data?.id ?? null);
      setCaptchaImage(res.data?.image ?? null);
      setCaptchaCode("");
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshCaptcha();
  }, []);

  const onSubmit = async () => {
    const now = Date.now();
    if (isSubmitting || now - lastSubmitTsRef.current < 1000) return;
    lastSubmitTsRef.current = now;
    setErrorText(null);

    if (!email.trim()) {
      setErrorText("请输入账号");
      return;
    }

    if (!password) {
      setErrorText("请输入密码");
      return;
    }

    if (!captchaId || !captchaCode.trim()) {
      setErrorText("请输入验证码");
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginWithPassword({
        email,
        password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        authToken: true,
        captchaId: captchaId ?? undefined,
        captchaCode: captchaCode || undefined,
      });
      if (res.code !== 200) {
        setErrorText(res.msg || "登录失败");
        refreshCaptcha();
        return;
      }

      const token =
        res.data?.token ||
        res.data?.authToken ||
        res.data?.user?.token ||
        res.data?.user?.authToken ||
        res.data?.user?.AuthToken;

      if (!token) {
        setErrorText("登录成功但未返回 token");
        refreshCaptcha();
        return;
      }

      const userForStore: User | undefined = res.data?.user?.email
        ? {
            id: res.data.user.id,
            email: res.data.user.email,
            displayName: res.data.user.displayName ?? res.data.user.DisplayName,
            avatar: res.data.user.avatar,
            role: res.data.user.role,
            timezone: res.data.user.timezone ?? "",
            createdAt: res.data.user.createdAt ?? "",
            updatedAt: res.data.user.updatedAt ?? "",
            lastLogin: res.data.user.lastLogin ?? "",
            hasFilledDetails: (res.data.user as any).hasFilledDetails ?? false,
            emailNotifications: (res.data.user as any).emailNotifications ?? false,
          }
        : undefined;

      const ok = await doLogin(token, userForStore);
      if (!ok) {
        setErrorText("登录失败：无法获取用户信息");
        refreshCaptcha();
        return;
      }

      navigate(nextPath, { replace: true });
    } catch (e: any) {
      setErrorText(e?.msg || e?.message || "登录失败");
      refreshCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-xl p-8 bg-card border border-border">
        <div className="mb-8">
          <img
            src="/logo.png"
            alt="CloudSteps"
            className="w-12 h-12 rounded-xl object-contain mb-5"
          />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">云阶</h1>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            登录以继续陪练与单词训练
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-charcoal font-medium mb-1.5 block">账号</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入账号"
              className={fieldClass}
            />
          </div>

          <div>
            <label className="text-sm text-charcoal font-medium mb-1.5 block">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className={fieldClass}
            />
          </div>

          <div>
            <label className="text-sm text-charcoal font-medium mb-1.5 block">验证码</label>
            <div className="flex items-center gap-3">
              <input
                value={captchaCode}
                onChange={(e) => setCaptchaCode(e.target.value)}
                placeholder="请输入验证码"
                className={`flex-1 ${fieldClass}`}
              />
              <CloudButton
                type="button"
                variant="outline"
                onClick={refreshCaptcha}
                disabled={isSubmitting}
                className="h-[46px] w-[120px] overflow-hidden flex items-center justify-center p-0"
                aria-label="刷新验证码"
              >
                {captchaImage ? (
                  <img
                    src={captchaImage}
                    alt="captcha"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">加载中...</span>
                )}
              </CloudButton>
            </div>
          </div>

          {errorText ? (
            <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
              {errorText}
            </div>
          ) : null}

          <CloudButton
            variant="brand"
            onClick={onSubmit}
            loading={isSubmitting}
            loadingText="登录中..."
            className="w-full h-11"
            disabled={isSubmitting}
          >
            登录
          </CloudButton>
        </div>
      </div>
    </div>
  );
}
