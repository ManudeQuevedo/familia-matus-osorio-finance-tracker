"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { notify } from "@/lib/toast";

export function MfaSettingsCompact() {
  const t = useTranslations("Finance.settings.security");
  const tSec = useTranslations("Security");
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [hasVerifiedTotp, setHasVerifiedTotp] = useState(false);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshFactors = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      notify.mfa.genericError();
      setLoading(false);
      return;
    }
    setHasVerifiedTotp(
      Boolean(data?.totp?.some((f) => f.status === "verified")),
    );
    setLoading(false);
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
      friendlyName: tSec("factorFriendlyName"),
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
    if (!pendingFactorId || enrollCode.length !== 6) return;

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
    const { data: factors, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      notify.mfa.genericError();
      return;
    }
    const verified = factors?.totp?.find((f) => f.status === "verified");
    if (!verified || disableCode.length !== 6) return;
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
    setPendingFactorId(null);
    notify.mfa.disableSuccess();
    await refreshFactors();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 max-md:flex-col max-md:items-stretch">
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
            className="max-md:min-h-12 max-md:w-full"
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
            className="max-md:min-h-12 max-md:w-full"
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
          {totpUri ? (
            <div
              role="group"
              aria-label={tSec("qrAlt")}
              className="mx-auto w-fit rounded-lg border border-border-default bg-white p-2 dark:border-border-default">
              <QRCodeSVG
                value={totpUri}
                size={176}
                level="M"
                marginSize={4}
                title={tSec("qrAlt")}
                bgColor="#ffffff"
                fgColor="#000000"
                style={{ borderRadius: 8 }}
              />
            </div>
          ) : null}
          {secret ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-secondary dark:text-text-muted">
                {tSec("manualSecret")}
              </p>
              <code className="block w-full select-all break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">
                {secret}
              </code>
            </div>
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
              className="font-mono tracking-[0.35em] max-md:h-12 max-md:min-h-12 max-md:text-base"
            />
          </div>
          <div className="flex gap-2 max-md:flex-col">
            <Button
              type="button"
              className="max-md:min-h-12 max-md:w-full"
              onClick={confirmEnrollment}
              disabled={busy || enrollCode.length !== 6}>
              {tSec("confirmEnrollment")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="max-md:min-h-12 max-md:w-full"
              onClick={() => {
                setPendingFactorId(null);
                setTotpUri(null);
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
              className="font-mono tracking-[0.35em] max-md:h-12 max-md:min-h-12 max-md:text-base"
            />
          </div>
          <div className="flex gap-2 max-md:flex-col">
            <Button
              type="button"
              variant="destructive"
              className="max-md:min-h-12 max-md:w-full"
              onClick={disableMfa}
              disabled={busy || disableCode.length !== 6}>
              {tSec("disableMfa")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="max-md:min-h-12 max-md:w-full"
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
