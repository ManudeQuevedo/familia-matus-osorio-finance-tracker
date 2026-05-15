"use client";

import Image from "next/image";

import { pickBlockText } from "@/types/presentation";
import type { AppLocale } from "@/types/guideline";
import type { PresentationBlock } from "@/types/presentation";

import { SeoMetricsAnimated } from "./SeoMetricsAnimated";

type Props = {
  block: PresentationBlock;
  locale: AppLocale;
  reducedMotion: boolean;
};

export function PresentationBlockView({ block, locale, reducedMotion }: Props) {
  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-(--pres-muted)">
            {pickBlockText(block.eyebrow, locale)}
          </p>
          <h2
            className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ fontFamily: "var(--pres-font-heading)" }}>
            {pickBlockText(block.title, locale)}
          </h2>
          <p className="max-w-prose text-pretty text-base leading-relaxed text-(--pres-muted)">
            {pickBlockText(block.subtitle, locale)}
          </p>
        </div>
      );
    case "richText":
      return (
        <p className="max-w-prose text-pretty text-base leading-relaxed text-(--pres-muted)">
          {pickBlockText(block.body, locale)}
        </p>
      );
    case "seoMetrics":
      return (
        <SeoMetricsAnimated
          block={block}
          locale={locale}
          reducedMotion={reducedMotion}
        />
      );
    case "logoShowcase":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {block.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-(--pres-radius) border border-white/10 bg-(--pres-surface) p-4">
              <div className="relative flex h-24 items-center justify-center rounded-lg bg-black/20">
                <Image
                  src={item.src}
                  alt={item.name}
                  width={48}
                  height={48}
                  className="object-contain opacity-90"
                  unoptimized={item.src.startsWith("http")}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-(--pres-text)">
                  {item.name}
                </p>
                <p className="mt-1 text-xs text-(--pres-muted)">
                  {pickBlockText(item.usage, locale)}
                </p>
              </div>
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}
