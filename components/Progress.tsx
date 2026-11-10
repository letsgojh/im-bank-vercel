export type Phase = "uploading" | "queued" | "in_progress" | "completed";

const STEPS: { key: Phase; label: string; hint: string }[] = [
  { key: "uploading", label: "파일 접수", hint: "서류를 전송하고 있습니다" },
  { key: "queued", label: "분석 대기", hint: "분석 순서를 기다리고 있습니다" },
  { key: "in_progress", label: "서류 분석", hint: "통상 3~4분 소요됩니다" },
  { key: "completed", label: "점검 완료", hint: "결과를 확인하십시오" },
];

const fmtElapsed = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function Spinner() {
  return (
    <span className="relative inline-block h-4 w-4" aria-hidden>
      <span className="absolute inset-0 rounded-full border-2 border-navy-100" />
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-navy-800" />
    </span>
  );
}

/** 처리 현황: 세로 단계 + 경과시간 + 접수번호 */
export function StatusSteps({
  phase,
  elapsed,
  jobId,
  demo,
  failed,
}: {
  phase: Phase | null;
  elapsed: number;
  jobId?: string;
  demo?: boolean;
  failed?: boolean;
}) {
  if (!phase) return <p className="py-2 text-[14px] text-slate-500">점검 요청 전입니다.</p>;

  const current = STEPS.findIndex((s) => s.key === phase);
  const done = phase === "completed";
  // 진행바: 단계 기준 (분석 단계는 경과시간으로 4분까지 서서히 채움, 실제 진행률 아님)
  const analysisShare = phase === "in_progress" ? Math.min(elapsed / 240, 0.95) : 0;
  const pct = done ? 100 : Math.round(((current + analysisShare) / (STEPS.length - 1)) * 100);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[13px]">
          <span className={`font-semibold ${failed ? "text-red-700" : "text-navy-900"}`}>
            {failed ? "처리 중단" : done ? "처리 완료" : "처리 중"}
          </span>
          <span className="tabular-nums text-slate-500">경과 {fmtElapsed(elapsed)}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden bg-slate-200">
          <div
            className={`h-full transition-all duration-700 ${failed ? "bg-red-600" : "bg-navy-800"}`}
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
      </div>

      <ol className="space-y-0">
        {STEPS.map((s, i) => {
          const isDone = i < current || done;
          const isActive = i === current && !done;
          return (
            <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
              {i < STEPS.length - 1 && (
                <span className={`absolute left-[9px] top-6 h-[calc(100%-20px)] w-px ${isDone ? "bg-navy-800" : "bg-slate-300"}`} aria-hidden />
              )}
              <span
                className={`relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  isDone
                    ? "bg-navy-800 text-white"
                    : isActive
                      ? failed
                        ? "bg-red-600 text-white"
                        : "border-2 border-navy-800 bg-white"
                      : "border border-slate-300 bg-white text-slate-400"
                }`}
              >
                {isDone ? "✓" : isActive ? failed ? "!" : <Spinner /> : i + 1}
              </span>
              <div className="min-w-0">
                <p className={`text-[14px] font-semibold ${isDone || isActive ? "text-slate-900" : "text-slate-400"}`}>{s.label}</p>
                {(isActive || (done && s.key === "completed")) && <p className="text-[13px] text-slate-500">{failed ? "처리가 중단되었습니다" : s.hint}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {(jobId || demo) && (
        <dl className="grid grid-cols-[72px_1fr] gap-y-1 border-t border-slate-200 pt-3 text-[13px]">
          {jobId && (
            <>
              <dt className="text-slate-500">접수번호</dt>
              <dd className="break-all font-mono text-[12px] text-slate-800">{jobId}</dd>
            </>
          )}
          {demo && (
            <>
              <dt className="text-slate-500">모드</dt>
              <dd className="text-slate-800">시연(데모) 데이터</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
