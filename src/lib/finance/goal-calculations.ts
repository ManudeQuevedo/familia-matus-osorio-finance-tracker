export type GoalMetrics = {
  monthsLeft: number;
  monthlyRequired: number;
  biweeklyRequired: number;
  progressPercent: number;
};

function parseLocalDate(iso: string): Date {
  return new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
}

/** Whole months between today and target (minimum 0). */
export function monthsUntil(targetDateIso: string, from = new Date()): number {
  const target = parseLocalDate(targetDateIso);
  const fromNorm = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const targetNorm = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  if (targetNorm <= fromNorm) return 0;
  let months =
    (targetNorm.getFullYear() - fromNorm.getFullYear()) * 12 +
    (targetNorm.getMonth() - fromNorm.getMonth());
  if (targetNorm.getDate() < fromNorm.getDate()) months -= 1;
  return Math.max(0, months);
}

export function computeGoalMetrics(
  targetAmount: number,
  currentAmount: number,
  targetDateIso: string,
): GoalMetrics {
  const remaining = Math.max(0, targetAmount - currentAmount);
  const monthsLeft = monthsUntil(targetDateIso);
  const monthlyRequired =
    monthsLeft > 0 ? remaining / monthsLeft : remaining > 0 ? remaining : 0;
  const progressPercent =
    targetAmount > 0
      ? Math.min(100, (currentAmount / targetAmount) * 100)
      : 100;

  return {
    monthsLeft,
    monthlyRequired: Math.round(monthlyRequired * 100) / 100,
    biweeklyRequired: Math.round((monthlyRequired / 2) * 100) / 100,
    progressPercent,
  };
}
