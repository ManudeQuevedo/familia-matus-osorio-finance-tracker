/** Months to pay off with fixed payment (0 if already paid). */
export function estimatePayoffMonths(
  balance: number,
  monthlyPayment: number,
  annualRatePercent?: number | null,
): number {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0) return 999;

  const rate = (annualRatePercent ?? 0) / 100 / 12;
  if (rate <= 0) {
    return Math.ceil(balance / monthlyPayment);
  }

  const interestPortion = balance * rate;
  if (monthlyPayment <= interestPortion) return 999;

  let months = 0;
  let remaining = balance;
  while (remaining > 0.01 && months < 600) {
    const interest = remaining * rate;
    const principal = monthlyPayment - interest;
    remaining = Math.max(0, remaining - principal);
    months += 1;
  }
  return months;
}

export function addMonthsToDate(iso: string, months: number): string {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function payoffProgress(
  totalAmount: number,
  currentBalance: number,
): number {
  if (totalAmount <= 0) return 100;
  const paid = Math.max(0, totalAmount - currentBalance);
  return Math.min(100, (paid / totalAmount) * 100);
}
