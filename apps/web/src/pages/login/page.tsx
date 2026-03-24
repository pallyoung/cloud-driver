import { FormEvent, useEffect, useState } from "react";
import clsx from "clsx";
import { Globe2, LockKeyhole } from "lucide-react";
import { Navigate } from "react-router-dom";
import { AuthShell } from "../../app/layouts/auth-shell";
import {
  authErrorState,
  authStatusState,
  authSubmittingState,
  loadSessionAction,
  loginAction,
  setLanguageAction,
} from "../../state/app-state";
import { useI18n } from "../../hooks/use-i18n";
import { useActions, useRelaxValue } from "../../state/relax";

export function LoginPage() {
  const [password, setPassword] = useState("");
  const authStatus = useRelaxValue(authStatusState);
  const authError = useRelaxValue(authErrorState);
  const isSubmitting = useRelaxValue(authSubmittingState);
  const { language, pick } = useI18n();
  const [loginWithPassword, loadSession, setLanguage] = useActions([
    loginAction,
    loadSessionAction,
    setLanguageAction,
  ] as const);

  useEffect(() => {
    if (authStatus === "unknown") {
      void loadSession();
    }
  }, [authStatus, loadSession]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password.trim()) {
      return;
    }

    await loginWithPassword({ password });
  }

  if (authStatus === "authenticated") {
    return <Navigate to="/explorer" replace />;
  }

  return (
    <AuthShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Cloud Driver</p>
          <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
            <span className="flex h-9 w-9 items-center justify-center text-muted">
              <Globe2 className="h-4 w-4" />
            </span>
            {[
              { label: "中", value: "zh-CN" as const, testId: "login-language-zh" },
              { label: "EN", value: "en-US" as const, testId: "login-language-en" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                data-testid={item.testId}
                onClick={() => setLanguage(item.value)}
                className={clsx(
                  "inline-flex min-h-9 min-w-11 items-center justify-center rounded-lg px-2 text-xs font-semibold transition duration-150 ease-out",
                  language === item.value
                    ? "bg-ink-strong text-white"
                    : "text-ink hover:bg-surface-alt",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="inline-flex rounded-[18px] border border-accent/20 bg-accent-soft p-3 text-accent">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-[28px] font-semibold leading-tight text-ink-strong">
            {pick("输入口令进入 Cloud Driver", "Enter Cloud Driver")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {pick(
              "当前版本为单用户口令登录。输入服务器已配置的访问口令后即可进入文件管理。",
              "This build uses single-user passphrase access. Enter the configured password to open the file manager.",
            )}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label
            className="block text-sm font-medium text-ink"
            htmlFor="password"
          >
            {pick("访问口令", "Access Password")}
          </label>
          <input
            id="password"
            data-testid="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={pick("请输入访问口令", "Enter your access password")}
            className="input-soft"
          />
          {authError ? (
            <p className="text-sm text-danger">{authError}</p>
          ) : null}
          <button
            type="submit"
            data-testid="login-submit"
            disabled={isSubmitting}
            className="action-button action-button-primary w-full"
          >
            {isSubmitting
              ? pick("登录中...", "Signing In...")
              : pick("登录", "Sign In")}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
