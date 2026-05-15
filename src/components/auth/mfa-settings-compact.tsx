"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function MfaSettingsCompact() {
  const t = useTranslations("Finance.settings.security");
  const tSec = useTranslations("Security");
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [hasVerifiedTotp, setHasVerifiedTotp] = useState(false);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshFactors = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setErrorMessage(tSec("factorsError"));
      setLoading(false);
      return;
    }
    setHasVerifiedTotp(
      Boolean(data?.totp?.some((f) => f.status === "verified")),
    );
    setLoading(false);
  }, [supabase, tSec]);

  useEffect(() => {
    void refreshFactors();
  }, [refreshFactors]);

  async function startEnrollment() {
    setBusy(true);
    setErrorMessage(null);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: tSec("factorFriendlyName"),
    });
    setBusy(false);
    if (error || !data) {
      setErrorMessage(tSec("enrollStartError"));
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
    if (!pendingFactorId || enrollCode.length !== 6) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: pendingFactorId,
      code: enrollCode,
    });
    setBusy(false);
    if (error) {
      setErrorMessage(tSec("enrollVerifyError"));
      return;
    }
    setPendingFactorId(null);
    setQrSrc(null);
    setSecret(null);
    setEnrollCode("");
    await refreshFactors();
  }

  async function disableMfa() {
    const { data: factors, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setErrorMessage(tSec("factorsError"));
      return;
    }
    const verified = factors?.totp?.find((f) => f.status === "verified");
    if (!verified || disableCode.length !== 6) return;
    setBusy(true);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: verified.id,
      code: disableCode,
    });
    if (verifyError) {
      setBusy(false);
      setErrorMessage(tSec("disableVerifyError"));
      return;
    }
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: verified.id,
    });
    setBusy(false);
    if (unenrollError) {
      setErrorMessage(tSec("unenrollError"));
      return;
    }
    setDisableCode("");
    setPendingFactorId(null);
    await refreshFactors();
  }

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
        ) : null}
        {hasVerifiedTotp ? (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("mfaActive")}
          </Badge>
        ) : null}
        {!hasVerifiedTotp && !pendingFactorId ? (
          <Button
            type="button"
            onClick={startEnrollment}
            disabled={busy || loading}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {tSec("starting")}
              </>
            ) : (
              t("enableMfa")
            )}
          </Button>
        ) : null}
        {hasVerifiedTotp && !pendingFactorId ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPendingFactorId("disable")}>
            {t("disableMfa")}
          </Button>
        ) : null}
      </div>
      {pendingFactorId && pendingFactorId !== "disable" ? (
        <div className="space-y-3 rounded-lg border border-border-default p-4 dark:border-border-default">
          <p className="text-sm text-text-secondary dark:text-text-muted">
            {tSec("scanQr")}
          </p>
          {qrSrc ? (
            <img
              src={qrSrc}
              alt={tSec("qrAlt")}
              className="mx-auto h-40 w-40 rounded-lg border border-border-default bg-bg-card p-2 dark:border-border-default"
            />
          ) : null}
          {secret ? (
            <Input readOnly value={secret} className="font-mono text-xs" />
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="mfa-enroll">{tSec("verificationCode")}</Label>
            <Input
              id="mfa-enroll"
              inputMode="numeric"
              maxLength={6}
              value={enrollCode}
              onChange={(e) =>
                setEnrollCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="font-mono tracking-[0.35em]"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={confirmEnrollment}
              disabled={busy || enrollCode.length !== 6}>
              {tSec("confirmEnrollment")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingFactorId(null);
                setQrSrc(null);
                setSecret(null);
              }}>
              {tSec("cancel")}
            </Button>
          </div>
        </div>
      ) : null}
      {pendingFactorId === "disable" ? (
        <div className="space-y-3 rounded-lg border border-border-default p-4 dark:border-border-default">
          <p className="text-sm text-text-secondary dark:text-text-muted">
            {tSec("disableIntro")}
          </p>
          <div className="space-y-2">
            <Label htmlFor="mfa-disable">{tSec("verificationCode")}</Label>
            <Input
              id="mfa-disable"
              inputMode="numeric"
              maxLength={6}
              value={disableCode}
              onChange={(e) =>
                setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="font-mono tracking-[0.35em]"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={disableMfa}
              disabled={busy || disableCode.length !== 6}>
              {tSec("disableMfa")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingFactorId(null);
                setDisableCode("");
              }}>
              {tSec("cancel")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
