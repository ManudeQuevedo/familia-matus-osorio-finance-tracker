"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { CategorySlice } from "./DashboardCategoryChart";

export function DashboardCategoryChartInner({
  data,
  formatValue,
}: {
  data: CategorySlice[];
  locale: string;
  formatValue: (n: number) => string;
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={56}
            outerRadius={80}
            paddingAngle={2}
            isAnimationActive
            animationDuration={800}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatValue(Number(value ?? 0))}
            contentStyle={{
              background: "var(--bg-modal)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              boxShadow: "var(--shadow-md)",
              color: "var(--text-primary)",
              fontSize: "13px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
