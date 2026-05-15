"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Step = "credentials" | "mfa";

type FormStatus = "idle" | "loading" | "mfa_required" | "error" | "success";

const easeOut = [0, 0, 0.2, 1] as const;

const glassCardClass =
  "w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/20 bg-white/[0.12] p-8 shadow-[0_25px_50px_rgba(0,0,0,0.3)] backdrop-blur-[20px]";

const glassLabelClass = "text-sm font-medium text-white/80";

const glassInputClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white outline-none transition-[border-color,box-shadow] placeholder:text-white/40 focus:border-white/60 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.1)] disabled:cursor-not-allowed disabled:opacity-50";

const glassDigitClass =
  "h-14 w-12 rounded-lg border border-white/20 bg-white/10 text-center text-xl font-semibold text-white outline-none transition-[border-color,box-shadow] focus:border-white/60 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.1)] disabled:cursor-not-allowed disabled:opacity-50";

function isSafeRelativeNextPath(next: string): boolean {
  return (
    next.startsWith("/") && !next.startsWith("//") && !next.includes("://")
  );
}

/** Strip locale prefix so next-intl router does not duplicate it (e.g. /en/dashboard → /dashboard). */
function pathnameForNavigation(path: string): string {
  const segments = path.split("/").filter(Boolean);
  const first = segments[0];
  if (
    first &&
    routing.locales.includes(first as (typeof routing.locales)[number])
  ) {
    const rest = segments.slice(1);
    return rest.length ? `/${rest.join("/")}` : "/";
  }
  return path;
}

function MfaCodeInput({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete: (code: string) => void;
  disabled?: boolean;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = useMemo(
    () => Array.from({ length: 6 }, (_, index) => value[index] ?? ""),
    [value],
  );

  const focusAt = (index: number) => {
    inputsRef.current[index]?.focus();
  };

  const applyDigits = (chars: string[]) => {
    const next = chars.join("").slice(0, 6);
    onChange(next);
    if (next.length === 6) {
      onComplete(next);
      return;
    }
    focusAt(Math.min(next.length, 5));
  };

  const handleChange = (index: number, char: string) => {
    const digit = char.replace(/\D/g, "").slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = digit;
    applyDigits(nextDigits);
  };

  const handleKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const nextDigits = [...digits];
      if (nextDigits[index]) {
        nextDigits[index] = "";
        applyDigits(nextDigits);
        return;
      }
      if (index > 0) {
        nextDigits[index - 1] = "";
        applyDigits(nextDigits);
        focusAt(index - 1);
      }
    }
    if (event.key === "ArrowLeft" && index > 0) {
      focusAt(index - 1);
    }
    if (event.key === "ArrowRight" && index < 5) {
      focusAt(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) {
      return;
    }
    const nextDigits = Array.from(
      { length: 6 },
      (_, index) => pasted[index] ?? "",
    );
    applyDigits(nextDigits);
  };

  return (
    <motion.div
      className="flex justify-center gap-2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: easeOut }}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1}`}
          value={digit}
          disabled={disabled}
          className={glassDigitClass}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </motion.div>
  );
}

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [step, setStep] = useState<Step>("credentials");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totp, setTotp] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dashboardHref =
    nextPath && isSafeRelativeNextPath(nextPath)
      ? pathnameForNavigation(nextPath)
      : "/dashboard";

  const isLoading = status === "loading";
  const isDisabled = isLoading || status === "success";

  const resetError = () => setErrorMessage(null);

  const verifyMfa = useCallback(
    async (code: string) => {
      if (!factorId) {
        setStatus("error");
        setErrorMessage(t("mfaMissingFactor"));
        return;
      }

      setStatus("loading");
      resetError();

      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });

      if (error) {
        setStatus("mfa_required");
        setTotp("");
        setErrorMessage(t("mfaInvalid"));
        return;
      }

      setStatus("success");
      router.replace(dashboardHref);
    },
    [dashboardHref, factorId, router, supabase, t],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser || cancelled) {
        return;
      }

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError || cancelled) {
        return;
      }

      const resumeMfa = aal.currentLevel === "aal1" && aal.nextLevel === "aal2";
      if (!resumeMfa) {
        return;
      }

      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors();
      if (factorsError || cancelled) {
        return;
      }

      const totpFactor = factors?.totp?.[0];
      if (!totpFactor) {
        return;
      }

      setFactorId(totpFactor.id);
      setTotp("");
      setStatus("mfa_required");
      setStep("mfa");
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function onSubmitCredentials(e: FormEvent) {
    e.preventDefault();
    resetError();
    setStatus("loading");

    const allowResponse = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!allowResponse.ok) {
      setStatus("error");
      if (allowResponse.status === 403) {
        setErrorMessage(t("unauthorizedEmail"));
      } else {
        setErrorMessage(t("genericError"));
      }
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setStatus("error");
      setErrorMessage(t("invalidCredentials"));
      return;
    }

    const { data: aal, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError) {
      setStatus("error");
      setErrorMessage(t("genericError"));
      return;
    }

    const needsMfa = aal.currentLevel === "aal1" && aal.nextLevel === "aal2";

    if (!needsMfa) {
      setStatus("success");
      router.replace(dashboardHref);
      return;
    }

    const { data: factors, error: factorsError } =
      await supabase.auth.mfa.listFactors();

    if (factorsError || !factors?.totp?.length) {
      setStatus("error");
      setErrorMessage(t("mfaMissingFactor"));
      return;
    }

    const totpFactor = factors.totp[0];
    setFactorId(totpFactor.id);
    setTotp("");
    setStatus("mfa_required");
    setStep("mfa");
  }

  async function handleBack() {
    await supabase.auth.signOut();
    setStep("credentials");
    setStatus("idle");
    setTotp("");
    setFactorId(null);
    resetError();
  }

  return (
    <motion.div
      className={glassCardClass}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, ease: easeOut }}>
      <AnimatePresence mode="wait" initial={false}>
        {errorMessage ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-4 rounded-lg border border-red-500/40 bg-red-500/20 px-3.5 py-2.5 text-sm text-red-300">
            {errorMessage}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {step === "credentials" ? (
          <motion.form
            key="credentials"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
            onSubmit={onSubmitCredentials}>
            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}>
              <label htmlFor="email" className={glassLabelClass}>
                {t("email")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={isDisabled}
                className={glassInputClass}
              />
            </motion.div>

            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}>
              <label htmlFor="password" className={glassLabelClass}>
                {t("password")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={isDisabled}
                  className={cn(glassInputClass, "pr-11")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-2 inline-flex items-center rounded-md p-1.5 text-white/50 transition hover:text-white/80"
                  aria-label={
                    showPassword ? t("hidePassword") : t("showPassword")
                  }>
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </motion.div>

            <motion.button
              type="submit"
              disabled={isDisabled}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border-0 bg-[hsl(var(--accent))] text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}>
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("signingIn")}
                </>
              ) : (
                t("signIn")
              )}
            </motion.button>
          </motion.form>
        ) : (
          <motion.div
            key="mfa"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: easeOut }}
            className="space-y-5">
            <div className="space-y-1 text-center">
              <h2 className="text-lg font-semibold text-white">
                {t("cardTitleMfa")}
              </h2>
              <p className="text-sm text-white/70">{t("cardDescriptionMfa")}</p>
            </div>

            <MfaCodeInput
              value={totp}
              disabled={isDisabled}
              onChange={(next) => {
                setTotp(next);
                if (errorMessage) {
                  resetError();
                }
              }}
              onComplete={(code) => {
                if (status === "mfa_required" && !isLoading) {
                  void verifyMfa(code);
                }
              }}
            />

            {isLoading ? (
              <p className="flex items-center justify-center gap-2 text-sm text-white/70">
                <Loader2 className="size-4 animate-spin" />
                {t("verifying")}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void handleBack()}
              disabled={isLoading}
              className="h-10 w-full rounded-lg text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-50">
              {t("back")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
