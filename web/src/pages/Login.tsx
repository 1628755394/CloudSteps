import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { CloudButton } from "../components/cloudsteps";
import CaptchaWidget from "../components/CaptchaWidget";
import { loginWithPassword, registerUser, type CaptchaFields, type User } from "../api/auth";
import { useAuthStore } from "../stores/authStore";

const fieldClass =
  "w-full px-4 py-3 rounded-xl bg-card border border-input text-charcoal placeholder:text-muted-soft transition-colors duration-200 outline-none hover:border-border focus:border-primary focus:ring-[3px] focus:ring-primary/25";

type Mode = "login" | "register";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const doLogin = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [mode, setMode] = useState<Mode>("login");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [captchaFields, setCaptchaFields] = useState<CaptchaFields | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastSubmitTsRef = useRef(0);
  const captchaKeyRef = useRef(0);

  const isSubmitting = isLoading || submitting;

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("next") || "/";
  }, [location.search]);

  const refreshCaptcha = useCallback(() => {
    captchaKeyRef.current += 1;
    setCaptchaFields(null);
  }, []);

  useEffect(() => {
    setErrorText(null);
  }, [mode]);

  const finishLogin = async (token: string, rawUser: any) => {
    const userForStore: User | undefined = rawUser
      ? {
          id: rawUser.id,
          email: rawUser.email || rawUser.username || "",
          displayName: rawUser.displayName ?? rawUser.DisplayName,
          avatar: rawUser.avatar,
          role: rawUser.role,
          timezone: rawUser.timezone ?? "",
          createdAt: rawUser.createdAt ?? "",
          updatedAt: rawUser.updatedAt ?? "",
          lastLogin: rawUser.lastLogin ?? "",
          hasFilledDetails: rawUser.hasFilledDetails ?? false,
          emailNotifications: rawUser.emailNotifications ?? false,
        }
      : undefined;

    const ok = await doLogin(token, userForStore);
    if (!ok) {
      setErrorText("登录失败：无法获取用户信息");
      refreshCaptcha();
      return;
    }
    navigate(nextPath, { replace: true });
  };

  const onSubmit = async () => {
    const now = Date.now();
    if (isSubmitting || now - lastSubmitTsRef.current < 1000) return;
    lastSubmitTsRef.current = now;
    setErrorText(null);

    if (!account.trim()) {
      setErrorText("请输入账号");
      return;
    }
    if (!password) {
      setErrorText("请输入密码");
      return;
    }
    if (mode === "register") {
      if (password.length < 8) {
        setErrorText("密码至少 8 位");
        return;
      }
      if (password !== password2) {
        setErrorText("两次密码不一致");
        return;
      }
    }
    if (!captchaFields?.captchaId || captchaFields.captchaValue == null || captchaFields.captchaValue === "") {
      setErrorText("请完成验证码");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "register") {
        const reg = await registerUser({
          username: account.trim(),
          password,
          displayName: account.trim(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          captchaId: captchaFields.captchaId,
          captchaType: captchaFields.captchaType,
          captchaValue: captchaFields.captchaValue,
        });
        if (reg.code !== 200) {
          setErrorText(reg.msg || "注册失败");
          refreshCaptcha();
          return;
        }
        // 注册成功后自动登录
        const loginRes = await loginWithPassword({
          email: account.trim(),
          password,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          authToken: true,
        });
        // 验证码已在注册时消费，再拉一次验证码后重试登录一次
        if (loginRes.code !== 200) {
          await refreshCaptcha();
          setMode("login");
          setErrorText("注册成功，请登录");
          setPassword("");
          setPassword2("");
          return;
        }
        const token =
          loginRes.data?.token ||
          loginRes.data?.authToken ||
          loginRes.data?.user?.token ||
          loginRes.data?.user?.authToken;
        if (!token) {
          setMode("login");
          setErrorText("注册成功，请登录");
          return;
        }
        await finishLogin(token, loginRes.data?.user);
        return;
      }

      const res = await loginWithPassword({
        email: account.trim(),
        password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        authToken: true,
        captchaId: captchaFields.captchaId,
        captchaType: captchaFields.captchaType,
        captchaValue: captchaFields.captchaValue,
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

      await finishLogin(token, res.data?.user);
    } catch (e: any) {
      setErrorText(e?.msg || e?.message || (mode === "register" ? "注册失败" : "登录失败"));
      refreshCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-xl p-8 bg-card border border-border">
        <div className="mb-6">
          <img
            src="/logo.png"
            alt="CloudSteps"
            className="w-12 h-12 rounded-xl object-contain mb-5"
          />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">云阶</h1>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            {mode === "login" ? "登录以继续陪练与单词训练" : "创建账号，开始使用云阶"}
          </p>
        </div>

        <div className="flex gap-2 mb-5 p-1 rounded-xl bg-muted">
          {(
            [
              { id: "login", label: "登录" },
              { id: "register", label: "注册" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors ${
                mode === m.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-charcoal font-medium mb-1.5 block">账号</label>
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="用户名 / 账号"
              className={fieldClass}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="text-sm text-charcoal font-medium mb-1.5 block">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "至少 8 位" : "请输入密码"}
              className={fieldClass}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
          </div>

          {mode === "register" && (
            <div>
              <label className="text-sm text-charcoal font-medium mb-1.5 block">确认密码</label>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="再输入一次"
                className={fieldClass}
                autoComplete="new-password"
              />
            </div>
          )}

          <div>
            <label className="text-sm text-charcoal font-medium mb-1.5 block">验证码</label>
            <CaptchaWidget key={captchaKeyRef.current} onChange={setCaptchaFields} />
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
            loadingText={mode === "register" ? "注册中..." : "登录中..."}
            className="w-full h-11"
            disabled={isSubmitting}
          >
            {mode === "register" ? "注册" : "登录"}
          </CloudButton>
        </div>
      </div>
    </div>
  );
}
