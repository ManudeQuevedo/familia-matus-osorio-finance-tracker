"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { Badge } from "@/components/ui/badge";
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
import { notify } from "@/lib/toast";

type PanelStatus = "idle" | "loading" | "error";

export function MfaSecurityPanel() {
  const t = useTranslations("Security");
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [panelStatus, setPanelStatus] = useState<PanelStatus>("loading");

  const [hasVerifiedTotp, setHasVerifiedTotp] = useState(false);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshFactors = useCallback(async () => {
    setPanelStatus("loading");
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setPanelStatus("error");
      notify.mfa.genericError();
      return;
    }

    const verifiedTotp = data?.totp?.some(
      (factor) => factor.status === "verified",
    );
    setHasVerifiedTotp(Boolean(verifiedTotp));
    setPanelStatus("idle");
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshFactors();
    });
  }, [refreshFactors]);

  async function startEnrollment() {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: t("factorFriendlyName"),
    });
    setBusy(false);

    if (error || !data) {
      notify.generic.unexpectedError();
      return;
    }

    setPendingFactorId(data.id);
    setSecret(data.totp.secret);
    setTotpUri(data.totp.uri ?? null);
    setEnrollCode("");
  }

  async function confirmEnrollment() {
    if (!pendingFactorId || enrollCode.length !== 6) {
      return;
    }

    setBusy(true);

    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: pendingFactorId });

    if (challengeError || !challengeData) {
      setBusy(false);
      notify.mfa.invalidCode();
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: pendingFactorId,
      challengeId: challengeData.id,
      code: enrollCode,
    });

    setBusy(false);

    if (verifyError) {
      notify.mfa.enableError();
      return;
    }

    setPendingFactorId(null);
    setTotpUri(null);
    setSecret(null);
    setEnrollCode("");
    notify.mfa.enableSuccess();
    await refreshFactors();
  }

  async function disableMfa() {
    const { data: factors, error: factorsError } =
      await supabase.auth.mfa.listFactors();
    if (factorsError || !factors?.totp?.length) {
      notify.mfa.genericError();
      return;
    }

    const verified = factors.totp.find(
      (factor) => factor.status === "verified",
    );
    if (!verified) {
      notify.mfa.genericError();
      return;
    }

    if (disableCode.length !== 6) {
      return;
    }

    setBusy(true);

    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: verified.id });

    if (challengeError || !challengeData) {
      setBusy(false);
      notify.mfa.invalidCode();
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: verified.id,
      challengeId: challengeData.id,
      code: disableCode,
    });

    if (verifyError) {
      setBusy(false);
      notify.mfa.disableError();
      return;
    }

    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: verified.id,
    });

    setBusy(false);

    if (unenrollError) {
      notify.mfa.disableError();
      return;
    }

    setDisableCode("");
    notify.mfa.disableSuccess();
    await refreshFactors();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("mfaTitle")}</CardTitle>
          <CardDescription>
            {hasVerifiedTotp
              ? t("mfaActiveDescription")
              : t("mfaInactiveDescription")}
          </CardDescription>
          {hasVerifiedTotp ? (
            <div className="pt-2">
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="size-3.5" />
                {t("mfaActiveBadge")}
              </Badge>
            </div>
          ) : null}
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
                  {totpUri ? (
                    <div
                      role="group"
                      aria-label={t("qrAlt")}
                      className="mx-auto w-fit rounded-lg border border-border-default bg-white p-2 dark:border-border-default">
                      <QRCodeSVG
                        value={totpUri}
                        size={200}
                        level="M"
                        marginSize={4}
                        title={t("qrAlt")}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        style={{ borderRadius: 8 }}
                      />
                    </div>
                  ) : null}
                  {secret ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-text-secondary dark:text-text-muted">
                        {t("manualSecret")}
                      </p>
                      <code className="block w-full max-w-md select-all break-all rounded-lg bg-muted px-3 py-2 font-mono text-sm">
                        {secret}
                      </code>
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
                        setTotpUri(null);
                        setSecret(null);
                        setEnrollCode("");
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
