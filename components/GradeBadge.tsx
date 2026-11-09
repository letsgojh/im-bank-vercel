import type { Grade, GradeLevel } from "@/lib/analysis-types";

export const GRADE_STYLE: Record<GradeLevel, { badge: string; accent: string; soft: string }> = {
  critical: { badge: "bg-red-600 text-white", accent: "border-red-500", soft: "bg-red-50" },
  high: { badge: "bg-orange-500 text-white", accent: "border-orange-500", soft: "bg-orange-50" },
  medium: { badge: "bg-yellow-400 text-yellow-950", accent: "border-yellow-400", soft: "bg-yellow-50" },
  low: { badge: "bg-green-600 text-white", accent: "border-green-600", soft: "bg-green-50" },
  undetermined: { badge: "bg-gray-400 text-white", accent: "border-gray-400", soft: "bg-gray-50" },
};

export function GradeBadge({ grade, size = "md" }: { grade: Grade | null; size?: "md" | "lg" }) {
  const g = grade ?? { label: "확인 불가", level: "undetermined" as const };
  const pad = size === "lg" ? "px-4 py-1.5 text-xl sm:text-2xl" : "px-3 py-1 text-sm";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full font-semibold ${pad} ${GRADE_STYLE[g.level].badge}`}>
      {g.label}
    </span>
  );
}
