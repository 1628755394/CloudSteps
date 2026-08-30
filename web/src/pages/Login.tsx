import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { CloudButton } from "../components/cloudsteps";
import CaptchaWidget from "../components/CaptchaWidget";
import {
  loginWithEmailCode,
  loginWithPassword,
  registerUser,
  sendEmailCode,
  type CaptchaFields,
  type LoginResponseData,
  type User,
} from "../api/auth";
import { useAuthStore } from "../stores/authStore";
import { formatAuthErrorMessage } from "../utils/authErrors";

const fieldClass =
  "w-full px-4 py-3 rounded-xl bg-card border border-input text-charcoal placeholder:text-muted-soft transition-colors duration-200 outline-none hover:border-border focus:border-primary focus:ring-[3px] focus:ring-primary/25";

type Screen = "login" | "register";
type Method = "password" | "email";

function isEmail(value: string) {
  const v = value.trim();
  return v.includes("@") && !v.startsWith("@") && !v.endsWith("@");
}

function pickToken(data?: LoginResponseData | null) {
  return (
    data?.token ||
    data?.authToken ||
    data?.user?.token ||
    data?.user?.authToken ||
    data?.user?.AuthToken ||
    ""
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const doLogin = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [screen, setScreen] = useState<Screen>("login");
  const [method, setMethod] = useState<Method>("password");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeWait, setCodeWait] = useState(0);
  const [captchaFields, setCaptchaFields] = useState<CaptchaFields | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastSubmitTsRef = useRef(0);
  const captchaKeyRef = useRef(0);

  const isSubmitting = isLoading || submitting;
  const registering = screen === "register";
  // Register is username+password only; email-code is a login method.
  const useEmail = !registering && method === "email";

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
    setCode("");
    setCodeWait(0);
  }, [screen, method]);

  useEffect(() => {
    if (codeWait <= 0) return;
    const t = window.setTimeout(() => setCodeWait((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [codeWait]);

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

  const onSendCode = async () => {
    const email = account.trim();
    if (!isEmail(email)) {
      setErrorText("请输入有效邮箱");
      return;
    }
    if (codeWait > 0) return;
    setErrorText(null);
    try {
      const res = await sendEmailCode({ email });
      if (res.code !== 200) {
        setErrorText(formatAuthErrorMessage(res.msg, "验证码发送失败"));
        return;
      }
      setCodeWait(60);
    } catch (e: any) {
      setErrorText(formatAuthErrorMessage(e?.msg || e?.message, "验证码发送失败"));
    }
  };

  const onSubmit = async () => {
    const now = Date.now();
    if (isSubmitting || now - lastSubmitTsRef.current < 1000) return;
    lastSubmitTsRef.current = now;
    setErrorText(null);

    const identity = account.trim();
    if (!identity) {
      setErrorText(useEmail ? "请输入邮箱" : "请输入账号");
      return;
    }
    if (useEmail && !isEmail(identity)) {
      setErrorText("请输入有效邮箱");
      return;
    }
    if (useEmail && !code.trim()) {
      setErrorText("请输入邮箱验证码");
      return;
    }
    if (!useEmail && !password) {
      setErrorText("请输入密码");
      return;
    }
    if (registering) {
      if ([...identity].length < 2) {
        setErrorText("账号至少 2 个字符");
        return;
      }
      if ([...identity].length > 30) {
        setErrorText("账号过长");
        return;
      }
      if (!password) {
        setErrorText("请设置密码");
        return;
      }
      if (password.length < 6) {
        setErrorText("密码至少 6 位");
        return;
      }
    }
    if (!captchaFields?.captchaId || captchaFields.captchaValue == null || captchaFields.captchaValue === "") {
      setErrorText("请完成验证码");
      return;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const captcha = {
      captchaId: captchaFields.captchaId,
      captchaType: captchaFields.captchaType,
      captchaValue: captchaFields.captchaValue,
    };

    setSubmitting(true);
    try {
      if (screen === "register") {
        const reg = await registerUser({
          username: identity,
          password,
          displayName: identity,
          timezone,
          source: "web",
          ...captcha,
        });
        if (reg.code !== 200) {
          setErrorText(formatAuthErrorMessage(reg.msg, "注册失败"));
          refreshCaptcha();
          return;
        }
        // 注册成功后自动登录，无需再次手动登录
        const autoLogin = await loginWithPassword({
          email: identity,
          password,
          timezone,
          authToken: true,
        });
        if (autoLogin.code === 200) {
          const token = pickToken(autoLogin.data);
          if (token) {
            const userForStore = (autoLogin.data?.user || {}) as User;
            const ok = await doLogin(token, userForStore);
            if (ok) {
              navigate(nextPath, { replace: true });
              return;
            }
          }
        }
        // 自动登录失败则回退到登录页
        setScreen("login");
        setMethod("password");
        setPassword("");
        setCode("");
        setCodeWait(0);
        refreshCaptcha();
        setErrorText("注册成功，请登录");
        return;
      }

      const res = useEmail
        ? await loginWithEmailCode({
            email: identity,
            code: code.trim(),
            timezone,
            authToken: true,
            ...captcha,
          })
        : await loginWithPassword({
            email: identity,
            password,
            timezone,
            authToken: true,
            ...captcha,
          });
      if (res.code !== 200) {
        setErrorText(formatAuthErrorMessage(res.msg, "登录失败"));
        refreshCaptcha();
        return;
      }
      const token = pickToken(res.data);
      if (!token) {
        setErrorText("登录成功但未返回 token");
        refreshCaptcha();
        return;
      }
      await finishLogin(token, res.data?.user);
    } catch (e: any) {
      setErrorText(
        formatAuthErrorMessage(
          e?.msg || e?.message,
          screen === "register" ? "注册失败" : "登录失败",
        ),
      );
      refreshCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  const title = screen === "login" ? "登录" : "注册";
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-xl p-8 bg-card border border-border">
        <div className="mb-6">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="CloudSteps"
            className="w-12 h-12 rounded-xl object-contain mb-5"
          />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">解忧</h1>
        </div>

        {screen === "login" ? (
        <div className="flex gap-2 mb-5">
          {(
            [
              { id: "password", label: "密码" },
              { id: "email", label: "邮箱验证码" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={`h-8 px-3 rounded-lg text-sm font-medium transition-colors ${
                method === m.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-5">设置账号和密码即可注册，邮箱可在登录后绑定。</p>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm text-charcoal font-medium mb-1.5 block">
              {useEmail ? "邮箱" : "账号"}
            </label>
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder={useEmail ? "name@example.com" : registering ? "用户名（2-30 个字符）" : "用户名 / 邮箱"}
              className={fieldClass}
              autoComplete={useEmail ? "email" : "username"}
            />
          </div>

          {useEmail ? (
            <div>
              <label className="text-sm text-charcoal font-medium mb-1.5 block">邮箱验证码</label>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6 位验证码"
                  className={fieldClass}
                  autoComplete="one-time-code"
                />
                <button
                  type="button"
                  onClick={() => void onSendCode()}
                  disabled={codeWait > 0}
                  className="shrink-0 px-3 rounded-xl border border-input text-sm text-foreground disabled:text-muted-foreground"
                >
                  {codeWait > 0 ? `${codeWait}s` : "发送验证码"}
                </button>
              </div>
            </div>
          ) : null}

          {(registering || !useEmail) && (
            <div>
              <label className="text-sm text-charcoal font-medium mb-1.5 block">
                {screen === "register" ? "设置密码" : "密码"}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={screen === "register" ? "至少 6 位" : "请输入密码"}
                className={fieldClass}
                autoComplete={screen === "register" ? "new-password" : "current-password"}
              />
            </div>
          )}

          <div>
            <label className="text-sm text-charcoal font-medium mb-1.5 block">图形验证码</label>
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
            loadingText={screen === "register" ? "注册中..." : "登录中..."}
            className="w-full h-11"
            disabled={isSubmitting}
          >
            {title}
          </CloudButton>

          <p className="text-center text-sm text-muted-foreground">
            {screen === "login" ? (
              <>
                还没有账号？
                <button
                  type="button"
                  className="ml-1 text-primary hover:underline"
                  onClick={() => {
                    setScreen("register");
                    setMethod("password");
                  }}
                >
                  点击注册
                </button>
              </>
            ) : (
              <>
                已有账号？
                <button
                  type="button"
                  className="ml-1 text-primary hover:underline"
                  onClick={() => setScreen("login")}
                >
                  返回登录
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
