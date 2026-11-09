export type Phase = "uploading" | "queued" | "in_progress" | "completed";

const STEPS: { key: Phase; label: string; hint?: string }[] = [
  { key: "uploading", label: "업로드 중" },
  { key: "queued", label: "대기 중" },
  { key: "in_progress", label: "분석 중", hint: "3~4분 소요" },
  { key: "completed", label: "완료" },
];

// 대기하는 동안 돌아가며 보여주는 안내 문구 (실제 단계 진행률이 아니라 일반 안내)
const TIPS = [
  "분석은 문서 읽기 → 문서 분류 → 항목 추출 → 등급 산정 순서로 진행돼요.",
  "병합된 PDF 안의 문서를 하나씩 나눠서 살펴봐요.",
  "주민등록번호·계좌번호·소득 정보가 얼마나 드러나 있는지 확인해요.",
  "보통 3~4분 정도 걸려요. 이 화면을 열어 두면 끝나는 대로 결과가 나타나요.",
  "결과는 업로드한 파일 기준 평가예요.",
];

const HEADLINE: Record<Exclude<Phase, "completed">, string> = {
  uploading: "파일을 올리고 있어요",
  queued: "분석 순서를 기다리고 있어요",
  in_progress: "서류를 분석하고 있어요",
};

function Spinner({ phase, elapsed }: { phase: Exclude<Phase, "completed">; elapsed: number }) {
  const tip = TIPS[Math.floor(elapsed / 5) % TIPS.length];
  return (
    <div className="mt-6 flex flex-col items-center gap-3" role="status" aria-live="polite">
      <div className="relative h-14 w-14">
        <span className="absolute inset-0 rounded-full border-4 border-blue-100" />
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-600 border-r-blue-600" />
        <span className="absolute inset-3 animate-ping rounded-full bg-blue-200/60" />
      </div>
      <p className="flex items-center gap-1 font-semibold text-gray-900">
        {HEADLINE[phase]}
        <span className="inline-flex gap-0.5" aria-hidden>
          <span className="h-1 w-1 animate-bounce rounded-full bg-gray-900 [animation-delay:-0.3s]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-gray-900 [animation-delay:-0.15s]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-gray-900" />
        </span>
      </p>
      <p key={tip} className="min-h-[2.5rem] max-w-md animate-[fadeIn_0.6s_ease-out] text-center text-sm text-gray-600">
        {tip}
      </p>
    </div>
  );
}

export function Progress({ phase, elapsed, demo }: { phase: Phase; elapsed: number; demo: boolean }) {
  const current = STEPS.findIndex((s) => s.key === phase);
  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => {
          const done = i < current || phase === "completed";
          const active = i === current && phase !== "completed";
          return (
            <li key={s.key} className="flex flex-col items-center gap-1.5 text-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  done ? "bg-blue-600 text-white" : active ? "bg-blue-100 text-blue-700 ring-2 ring-blue-600" : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? "✓" : active ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-600" /> : i + 1}
              </span>
              <span className={`text-xs font-medium sm:text-sm ${done || active ? "text-gray-900" : "text-gray-400"}`}>{s.label}</span>
              {s.hint && <span className="text-[11px] text-gray-500">{s.hint}</span>}
            </li>
          );
        })}
      </ol>
      {phase !== "completed" && <Spinner phase={phase} elapsed={elapsed} />}
      {phase !== "completed" && (
        <p className="mt-3 text-center text-sm text-gray-500">
          경과 시간 {mm}:{ss}
          {demo && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs">데모 모드</span>}
        </p>
      )}
    </div>
  );
}
