"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PanelStatus = "idle" | "loading" | "error";

export function MfaSecurityPanel() {
  const t = useTranslations("Security");
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [panelStatus, setPanelStatus] = useState<PanelStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [hasVerifiedTotp, setHasVerifiedTotp] = useState(false);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshFactors = useCallback(async () => {
    setPanelStatus("loading");
    setErrorMessage(null);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setPanelStatus("error");
      setErrorMessage(t("factorsError"));
      return;
    }

    const verifiedTotp = data?.totp?.some(
      (factor) => factor.status === "verified",
    );
    setHasVerifiedTotp(Boolean(verifiedTotp));
    setPanelStatus("idle");
  }, [supabase, t]);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshFactors();
    });
  }, [refreshFactors]);

  async function startEnrollment() {
    setBusy(true);
    setErrorMessage(null);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: t("factorFriendlyName"),
    });
    setBusy(false);

    if (error || !data) {
      setErrorMessage(t("enrollStartError"));
      return;
    }

    setPendingFactorId(data.id);
    setSecret(data.totp.secret);
    setQrSrc(
      `data:image/svg+xml;utf-8,${encodeURIComponent(data.totp.qr_code)}`,
    );
    setEnrollCode("");
  }

  async function confirmEnrollment() {
    if (!pendingFactorId || enrollCode.length !== 6) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: pendingFactorId,
      code: enrollCode,
    });
    setBusy(false);

    if (error) {
      setErrorMessage(t("enrollVerifyError"));
      return;
    }

    setPendingFactorId(null);
    setQrSrc(null);
    setSecret(null);
    setEnrollCode("");
    await refreshFactors();
  }

  async function disableMfa() {
    const { data: factors, error: factorsError } =
      await supabase.auth.mfa.listFactors();
    if (factorsError || !factors?.totp?.length) {
      setErrorMessage(t("factorsError"));
      return;
    }

    const verified = factors.totp.find(
      (factor) => factor.status === "verified",
    );
    if (!verified) {
      setErrorMessage(t("noVerifiedFactor"));
      return;
    }

    if (disableCode.length !== 6) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: verified.id,
      code: disableCode,
    });

    if (verifyError) {
      setBusy(false);
      setErrorMessage(t("disableVerifyError"));
      return;
    }

    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: verified.id,
    });

    setBusy(false);

    if (unenrollError) {
      setErrorMessage(t("unenrollError"));
      return;
    }

    setDisableCode("");
    await refreshFactors();
  }

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("mfaTitle")}</CardTitle>
          <CardDescription>
            {hasVerifiedTotp
              ? t("mfaActiveDescription")
              : t("mfaInactiveDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {panelStatus === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="size-4 animate-spin" />
              {t("loading")}
            </div>
          ) : null}

          {!hasVerifiedTotp ? (
            <div className="space-y-4">
              {!pendingFactorId ? (
                <Button type="button" onClick={startEnrollment} disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t("starting")}
                    </>
                  ) : (
                    t("enableMfa")
                  )}
                </Button>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary dark:text-text-muted">
                    {t("scanQr")}
                  </p>
                  {qrSrc ? (
                    // Data URL SVG from Supabase; next/image is not a fit here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrSrc}
                      alt={t("qrAlt")}
                      className="mx-auto h-44 w-44 rounded-lg border border-border-default bg-bg-card p-2 dark:border-border-default"
                    />
                  ) : null}
                  {secret ? (
                    <div className="space-y-1">
                      <Label>{t("manualSecret")}</Label>
                      <Input
                        readOnly
                        value={secret}
                        className="font-mono text-xs"
                      />
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="enroll-code">{t("verificationCode")}</Label>
                    <Input
                      id="enroll-code"
                      inputMode="numeric"
                      maxLength={6}
                      value={enrollCode}
                      onChange={(event) =>
                        setEnrollCode(
                          event.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      className="font-mono tracking-[0.35em]"
                      placeholder="000000"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={confirmEnrollment}
                      disabled={busy || enrollCode.length !== 6}>
                      {busy ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          {t("verifying")}
                        </>
                      ) : (
                        t("confirmEnrollment")
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setPendingFactorId(null);
                        setQrSrc(null);
                        setSecret(null);
                        setEnrollCode("");
                        setErrorMessage(null);
                      }}>
                      {t("cancel")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary dark:text-text-muted">
                {t("disableIntro")}
              </p>
              <div className="space-y-2">
                <Label htmlFor="disable-code">{t("verificationCode")}</Label>
                <Input
                  id="disable-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={disableCode}
                  onChange={(event) =>
                    setDisableCode(
                      event.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  className="font-mono tracking-[0.35em]"
                  placeholder="000000"
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={disableMfa}
                disabled={busy || disableCode.length !== 6}>
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("disabling")}
                  </>
                ) : (
                  t("disableMfa")
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
