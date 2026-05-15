export type AppLocale = "en" | "es";

export type L10nString = { en: string; es: string };

export type GuidelineSectionPhase =
  | "discovery"
  | "concept"
  | "craft"
  | "delivery";

export type GuidelineSection = {
  id: string;
  phase: GuidelineSectionPhase;
  eyebrow: L10nString;
  title: L10nString;
  body: L10nString;
};

export type BrandGuidelineProject = {
  version: number;
  clientName: string;
  accentHex: string;
  heroTagline: L10nString;
  colorTokens: { name: L10nString; hex: string }[];
  sections: GuidelineSection[];
};

export function pickL10n(value: L10nString, locale: AppLocale): string {
  return value[locale] ?? value.en;
}
