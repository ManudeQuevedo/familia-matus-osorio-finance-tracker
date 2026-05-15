export const NOTE_COLOR_OPTIONS = [
  "default",
  "yellow",
  "green",
  "blue",
  "pink",
  "purple",
] as const;

export type NoteColor = (typeof NOTE_COLOR_OPTIONS)[number];

export function noteCardClass(color: string): string {
  switch (color) {
    case "yellow":
      return "bg-amber-50/90 border-amber-200/80 dark:bg-amber-950/40 dark:border-amber-900/60";
    case "green":
      return "bg-emerald-50/90 border-emerald-200/80 dark:bg-emerald-950/40 dark:border-emerald-900/60";
    case "blue":
      return "bg-sky-50/90 border-sky-200/80 dark:bg-sky-950/40 dark:border-sky-900/60";
    case "pink":
      return "bg-rose-50/90 border-rose-200/80 dark:bg-rose-950/40 dark:border-rose-900/60";
    case "purple":
      return "bg-violet-50/90 border-violet-200/80 dark:bg-violet-950/40 dark:border-violet-900/60";
    default:
      return "bg-card border-border-default dark:border-border-default";
  }
}

export function noteColorDotClass(color: NoteColor): string {
  switch (color) {
    case "yellow":
      return "bg-amber-300 dark:bg-amber-500";
    case "green":
      return "bg-emerald-300 dark:bg-emerald-500";
    case "blue":
      return "bg-sky-300 dark:bg-sky-500";
    case "pink":
      return "bg-rose-300 dark:bg-rose-500";
    case "purple":
      return "bg-violet-300 dark:bg-violet-500";
    default:
      return "bg-zinc-300 dark:bg-zinc-600";
  }
}
