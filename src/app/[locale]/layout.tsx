import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { DocumentLang } from "@/components/DocumentLang";
import { AppToaster } from "@/components/providers/AppToaster";
import { ModalEscapeStackProvider } from "@/contexts/modal-escape-stack-context";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <ModalEscapeStackProvider>
        <DocumentLang locale={locale} />
        <AppToaster />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </ModalEscapeStackProvider>
    </NextIntlClientProvider>
  );
}
