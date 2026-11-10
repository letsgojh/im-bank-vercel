import type { Grade, GradeLevel } from "@/lib/analysis-types";

/** 등급 색: 작은 배지·왼쪽 선에만 쓰고 배경은 칠하지 않는다. */
export const GRADE_STYLE: Record<GradeLevel, { badge: string; bar: string; dot: string; text: string }> = {
  critical: { badge: "bg-red-700 text-white", bar: "border-l-red-700", dot: "bg-red-700", text: "text-red-800" },
  high: { badge: "bg-orange-600 text-white", bar: "border-l-orange-600", dot: "bg-orange-600", text: "text-orange-800" },
  medium: { badge: "bg-amber-400 text-amber-950", bar: "border-l-amber-400", dot: "bg-amber-400", text: "text-amber-800" },
  low: { badge: "bg-emerald-700 text-white", bar: "border-l-emerald-700", dot: "bg-emerald-700", text: "text-emerald-800" },
  undetermined: { badge: "bg-slate-500 text-white", bar: "border-l-slate-400", dot: "bg-slate-400", text: "text-slate-700" },
};

export function GradeBadge({ grade, size = "md" }: { grade: Grade | null; size?: "sm" | "md" | "lg" }) {
  const g = grade ?? { label: "판정 없음", level: "undetermined" as const };
  const pad = size === "lg" ? "px-3 py-1 text-lg" : size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-[13px]";
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-[3px] font-bold leading-tight ${pad} ${GRADE_STYLE[g.level].badge}`}>
      {g.label}
    </span>
  );
}
