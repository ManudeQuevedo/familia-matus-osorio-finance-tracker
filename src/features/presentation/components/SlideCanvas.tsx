"use client";

import { AnimatePresence, motion } from "framer-motion";

import type { AppLocale } from "@/types/guideline";
import type {
  PresentationDocument,
  PresentationSlide,
} from "@/types/presentation";

import { PresentationBlockView } from "./PresentationBlockView";
import { PresentationThemeRoot } from "./PresentationThemeRoot";

type Props = {
  document: PresentationDocument;
  slide: PresentationSlide;
  slideIndex: number;
  locale: AppLocale;
  reducedMotion: boolean;
  transition: PresentationDocument["settings"]["transition"];
};

const variants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: 28 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
} as const;

export function SlideCanvas({
  document,
  slide,
  slideIndex,
  locale,
  reducedMotion,
  transition,
}: Props) {
  const v = variants[transition];

  const layoutClass =
    slide.layout === "cover"
      ? "flex flex-col justify-center"
      : slide.layout === "split"
        ? "grid gap-10 lg:grid-cols-2 lg:items-start"
        : "grid gap-8";

  return (
    <PresentationThemeRoot
      theme={document.theme}
      className="relative flex min-h-[min(70vh,640px)] flex-1 flex-col overflow-hidden rounded-(--pres-radius) border border-white/10 p-8 sm:p-12">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${slide.id}-${slideIndex}`}
          initial={reducedMotion ? false : v.initial}
          animate={reducedMotion ? undefined : v.animate}
          exit={reducedMotion ? undefined : v.exit}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={`flex flex-1 flex-col ${layoutClass}`}>
          {slide.blocks.map((block, bi) => (
            <PresentationBlockView
              key={`${slide.id}-${block.type}-${bi}`}
              block={block}
              locale={locale}
              reducedMotion={reducedMotion}
            />
          ))}
        </motion.div>
      </AnimatePresence>
    </PresentationThemeRoot>
  );
}
