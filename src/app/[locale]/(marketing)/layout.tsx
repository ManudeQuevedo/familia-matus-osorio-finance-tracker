import { Suspense } from "react";

import { SiteHeader } from "@/components/SiteHeader";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Suspense
        fallback={
          <div className="h-14 border-b border-border-default bg-white/80 dark:border-border-default bg-bg-card/80" />
        }>
        <SiteHeader />
      </Suspense>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </>
  );
}
