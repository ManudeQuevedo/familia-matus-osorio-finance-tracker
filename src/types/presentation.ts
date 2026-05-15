import type { AppLocale } from "./guideline";

export const PRESENTATION_SCHEMA_VERSION = 1 as const;

export type LocalizedString = { en: string; es: string };

export type HeroBlock = {
  type: "hero";
  eyebrow: LocalizedString;
  title: LocalizedString;
  subtitle: LocalizedString;
};

export type RichTextBlock = {
  type: "richText";
  body: LocalizedString;
};

export type SeoMetricsBlock = {
  type: "seoMetrics";
  chartStyle: "bars";
  metrics: { label: LocalizedString; value: number; target: number }[];
};

export type LogoShowcaseBlock = {
  type: "logoShowcase";
  items: {
    id: string;
    name: string;
    src: string;
    usage: LocalizedString;
  }[];
};

export type PresentationBlock =
  | HeroBlock
  | RichTextBlock
  | SeoMetricsBlock
  | LogoShowcaseBlock;

export type PresentationSlide = {
  id: string;
  layout: "cover" | "split" | "grid";
  blocks: PresentationBlock[];
};

export type PresentationTheme = {
  mode: "dark" | "light";
  background:
    | { kind: "solid"; value: string }
    | { kind: "gradient"; value: string };
  surface: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  fontHeading: string;
  fontBody: string;
  radius: number;
};

export type PresentationDocument = {
  version: typeof PRESENTATION_SCHEMA_VERSION;
  meta: {
    title: string;
    createdAt: string;
    updatedAt: string;
    defaultLocale: "en" | "es";
    tags: string[];
  };
  theme: PresentationTheme;
  settings: {
    transition: "fade" | "slide";
    autoplayMs: number;
    editor: {
      snapToGrid: boolean;
      showBlockOutlines: boolean;
    };
  };
  slides: PresentationSlide[];
};

export function pickBlockText(
  value: LocalizedString,
  locale: AppLocale,
): string {
  return value[locale] ?? value.en;
}
