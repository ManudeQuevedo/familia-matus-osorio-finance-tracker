"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

import { pickBlockText } from "@/types/presentation";
import type { AppLocale } from "@/types/guideline";
import type { SeoMetricsBlock } from "@/types/presentation";

type Props = {
  block: SeoMetricsBlock;
  locale: AppLocale;
  reducedMotion: boolean;
};

export function SeoMetricsAnimated({ block, locale, reducedMotion }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reducedMotion || !rootRef.current) return;
      const bars = gsap.utils.toArray<HTMLElement>(
        rootRef.current.querySelectorAll("[data-seo-bar-fill]"),
      );
      bars.forEach((bar, i) => {
        const w = bar.getAttribute("data-width-pct");
        const pct = w ? Number.parseFloat(w) : 0;
        gsap.fromTo(
          bar,
          { scaleX: 0 },
          {
            scaleX: pct / 100,
            duration: 1.15,
            ease: "power3.out",
            delay: i * 0.08,
            transformOrigin: "left center",
          },
        );
      });
    },
    { scope: rootRef, dependencies: [block.metrics, locale, reducedMotion] },
  );

  return (
    <div ref={rootRef} className="flex flex-col gap-5">
      {block.metrics.map((m, i) => {
        const pct = Math.min(
          100,
          Math.round((m.value / Math.max(1, m.target)) * 100),
        );
        return (
          <div key={`${m.label.en}-${m.label.es}-${i}`} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-(--pres-text)">
                {pickBlockText(m.label, locale)}
              </span>
              <span className="tabular-nums text-(--pres-muted)">
                {m.value}/{m.target}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-white/5"
              style={{ borderRadius: "var(--pres-radius)" }}>
              <div
                data-seo-bar-fill
                data-width-pct={String(pct)}
                className="h-full w-full origin-left scale-x-0 rounded-full bg-(--pres-accent)"
                style={{
                  transform: reducedMotion ? `scaleX(${pct / 100})` : undefined,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
