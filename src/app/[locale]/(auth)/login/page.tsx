import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { LoginBranding } from "@/components/auth/login-branding";
import { LoginForm } from "@/components/auth/login-form";
import { LoginPhotoAttribution } from "@/components/auth/login-photo-attribution";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { getLoginBackground } from "@/lib/unsplash";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { next } = await searchParams;
  const t = await getTranslations({ locale, namespace: "Auth" });
  const background = await getLoginBackground();

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="absolute inset-0 bg-zinc-950" aria-hidden />
      {background ? (
        <div className="absolute inset-0" aria-hidden>
          <Image
            src={background.imageUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>
      ) : null}
      <div className="absolute inset-0 bg-black/35" aria-hidden />

      {background ? (
        <LoginPhotoAttribution
          photographerName={background.photographer.name}
          photographerUrl={background.photographer.profileUrl}
          photoUrl={background.photoPageUrl}
        />
      ) : null}

      <header className="absolute inset-x-0 top-0 z-20 flex justify-end p-4 sm:p-6">
        <Suspense
          fallback={
            <div className="h-9 w-20 animate-pulse rounded-full bg-white/15" />
          }>
          <LocaleSwitcher variant="onDark" />
        </Suspense>
      </header>

      <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-16 sm:px-6">
        <LoginBranding
          eyebrow={t("brandEyebrow")}
          title={t("brandTitle")}
          subtitle={t("brandSubtitle")}
        />
        <LoginForm nextPath={next} />
      </main>
    </div>
  );
}
