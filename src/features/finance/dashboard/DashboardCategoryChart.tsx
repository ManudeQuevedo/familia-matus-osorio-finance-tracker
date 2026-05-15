"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const ChartInner = dynamic(
  () =>
    import("./DashboardCategoryChartInner").then(
      (m) => m.DashboardCategoryChartInner,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-56 w-full rounded-lg" />,
  },
);

export type CategorySlice = {
  name: string;
  value: number;
  color: string;
};

export function DashboardCategoryChart({
  data,
  locale,
  formatValue,
}: {
  data: CategorySlice[];
  locale: string;
  formatValue: (n: number) => string;
}) {
  if (data.length === 0) return null;
  return <ChartInner data={data} locale={locale} formatValue={formatValue} />;
}
