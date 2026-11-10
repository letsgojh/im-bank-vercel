import type { AnalysisResult, DocumentResult, FindingItem, Grade, GradeLevel, Judgment } from "@/lib/analysis-types";
import { GRADE_STYLE, GradeBadge } from "./GradeBadge";
import { RichText } from "./RichText";

function Chevron() {
  return (
    <svg className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  );
}

const card = "rounded-2xl bg-white shadow-sm ring-1 ring-gray-200";

// ---------------- 결론 ----------------

export function ConclusionCard({ result }: { result: AnalysisResult }) {
  const g = result.fileGrade;
  const level = g?.level ?? "undetermined";
  const undetermined = level === "undetermined";
  return (
    <section className={`${card} overflow-hidden`}>
      <div className={`${GRADE_STYLE[level].soft} border-b border-gray-100 px-5 py-6 sm:px-8 sm:py-8`}>
        <p className="text-sm font-semibold tracking-wide text-gray-500">분석 결론</p>
        {undetermined ? (
          <p className="mt-3 text-xl font-bold leading-snug text-gray-900 sm:text-2xl">
            일부 항목을 판단하지 못해 등급을 확정하지 못했습니다.
          </p>
        ) : (
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-2xl font-bold leading-snug text-gray-900 sm:text-[28px]">
            <span>이 파일의 위험도 등급은</span>
            <GradeBadge grade={g} size="lg" />
            <span>입니다.</span>
          </p>
        )}
        {result.documents.length > 0 && (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-[15px] text-gray-700">
            문서 {result.documents.length}건 <GradeCounts grades={result.documents.map((d) => d.grade)} />
          </p>
        )}
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 text-[15px] font-medium text-blue-900 ring-1 ring-blue-100">
          <span aria-hidden>ℹ️</span> 신청 건 전체가 아니라 업로드한 파일 기준 평가입니다.
        </p>
      </div>

      <div className="space-y-5 px-5 py-6 sm:px-8">
        {result.summary.length > 0 && (
          <dl className="grid gap-3 sm:grid-cols-2">
            {result.summary.map((f) => (
              <div key={f.label} className="rounded-xl bg-gray-50 px-4 py-3">
                <dt className="text-sm font-medium text-gray-500">{f.label}</dt>
                <dd className="mt-1 text-lg font-bold text-gray-900">{f.value}</dd>
                {f.detail && <p className="mt-2 text-[15px] leading-7 text-gray-700">{f.detail}</p>}
              </div>
            ))}
          </dl>
        )}

        {result.overview?.map((p, i) => (
          <p key={i} className="text-base leading-8 text-gray-800 sm:text-[17px]">
            {p}
          </p>
        ))}

        {result.notes.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 sm:px-5">
            <p className="font-bold text-amber-900">추가 확인이 필요한 사항</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-amber-950 marker:text-amber-400 sm:text-base">
              {result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
        {result.disclaimer && <p className="text-sm text-gray-500">{result.disclaimer}</p>}
      </div>
    </section>
  );
}

// ---------------- 문서별 ----------------

const GRADE_ORDER: GradeLevel[] = ["critical", "high", "medium", "low", "undetermined"];

/** 등급별 개수 칩 (예: 매우 높음 2 · 높음 1) — 응답 등급을 세기만 한다 */
function GradeCounts({ grades }: { grades: (Grade | null)[] }) {
  const counts = new Map<string, { grade: Grade; n: number }>();
  for (const g of grades) {
    if (!g) continue;
    const c = counts.get(g.label);
    if (c) c.n += 1;
    else counts.set(g.label, { grade: g, n: 1 });
  }
  const list = [...counts.values()].sort((x, y) => GRADE_ORDER.indexOf(x.grade.level) - GRADE_ORDER.indexOf(y.grade.level));
  if (!list.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {list.map(({ grade, n }) => (
        <span key={grade.label} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-sm ring-1 ring-gray-200">
          <span className={`h-2.5 w-2.5 rounded-full ${GRADE_STYLE[grade.level].badge}`} />
          {grade.label} <strong className="font-bold">{n}</strong>
        </span>
      ))}
    </span>
  );
}

function JudgmentList({ judgments }: { judgments: Judgment[] }) {
  return (
    <ol className="divide-y divide-gray-100 overflow-hidden rounded-xl ring-1 ring-gray-200">
      {judgments.map((j, k) => (
        <li key={k} className={`flex gap-3 px-4 py-3.5 ${j.grade ? GRADE_STYLE[j.grade.level].soft : ""}`}>
          <div className="pt-0.5">
            <GradeBadge grade={j.grade} />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-base font-bold leading-7 text-gray-900">{j.item || "—"}</p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
              {j.exposure && <ExposureTag value={j.exposure} />}
              {j.masked_value && <span className="font-mono text-gray-700">{j.masked_value}</span>}
              {j.location && <span>📍 {j.location}</span>}
              {j.readStatus && !/^판독\s*가능$/.test(j.readStatus) && <span>판독: {j.readStatus}</span>}
            </p>
            {j.reason && <p className="text-[15px] leading-7 text-gray-700">{j.reason}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function FindingsTable({ items }: { items: FindingItem[] }) {
  const showMasked = items.some((i) => i.masked_value);
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200">
      <table className="w-full min-w-[600px] text-left text-[15px]">
        <thead className="bg-gray-50 text-sm text-gray-600">
          <tr>
            <th className="px-4 py-3 font-semibold">정보 유형</th>
            {showMasked && <th className="px-4 py-3 font-semibold">마스킹 값</th>}
            <th className="px-4 py-3 font-semibold">노출 상태</th>
            <th className="px-4 py-3 font-semibold">기재 성격</th>
            <th className="px-4 py-3 font-semibold">위치</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i, k) => (
            <tr key={k} className="border-t border-gray-100 align-top">
              <td className="px-4 py-3 font-semibold text-gray-900">{i.information_type || "—"}</td>
              {showMasked && <td className="px-4 py-3 font-mono text-gray-700">{i.masked_value || "—"}</td>}
              <td className="px-4 py-3">
                <ExposureTag value={i.exposure_status} />
              </td>
              <td className="px-4 py-3 text-gray-700">{i.usage_context || "—"}</td>
              <td className="px-4 py-3 text-gray-500">{i.source_locator || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocumentCard({ doc, index }: { doc: DocumentResult; index: number }) {
  const level = doc.grade?.level ?? "undetermined";
  const partialRead = doc.readStatus && !/^판독\s*가능$/.test(doc.readStatus);
  const top = doc.judgments[0];
  const multi = doc.judgments.length > 1;

  return (
    <details className={`group ${card} border-l-[6px] ${GRADE_STYLE[level].accent}`}>
      <summary className="cursor-pointer px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-400">
              문서 {index + 1}
              {doc.classLabel && <> · {doc.classLabel}</>}
            </p>
            <h3 className="mt-0.5 text-lg font-bold leading-snug text-gray-900 sm:text-xl">{doc.name}</h3>
            <p className="mt-1 text-sm text-gray-500">{[doc.pages, doc.readStatus].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex flex-col items-end gap-1 pt-1">
            <div className="flex items-center gap-2">
              <GradeBadge grade={doc.grade} />
              <Chevron />
            </div>
            {doc.gradeSource === "highest-item" && <span className="text-xs text-gray-500">세부 판정 중 최고 등급</span>}
          </div>
        </div>

        <div className="mt-4 space-y-2 text-base leading-8 text-gray-800">
          <p>
            {doc.name}의 위험도 등급은 <strong className="font-bold text-gray-900">{doc.grade?.label ?? "판정 없음"}</strong>입니다.
          </p>
          {!multi && doc.reason && <p className="text-gray-700">{doc.reason}</p>}
          {multi && top && (
            <p className="text-gray-700">
              가장 높게 판정된 항목은 <strong className="font-semibold text-gray-900">{top.item}</strong>({top.grade?.label ?? "—"})입니다.
              {top.reason && <> {top.reason}</>}
            </p>
          )}
          {multi && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              세부 판정 {doc.judgments.length}건 <GradeCounts grades={doc.judgments.map((j) => j.grade)} />
            </p>
          )}
          {partialRead && <p className="text-[15px] text-gray-600">판독 상태: {doc.readStatus}</p>}
          {doc.undeterminedItems.length > 0 && (
            <div className="rounded-xl bg-gray-100 px-4 py-3 text-[15px] leading-7">
              {doc.undeterminedItems.map((i, k) => (
                <p key={k} className="text-gray-700">
                  판단하지 못한 항목: <span className="font-semibold">{i.information_type}</span>
                  {(i.usage_context || i.exposure_status) && <> — {i.usage_context || i.exposure_status}</>}
                  {i.source_locator && <span className="text-gray-500"> ({i.source_locator})</span>}
                </p>
              ))}
            </div>
          )}
        </div>
        <p className="mt-3 text-sm font-semibold text-blue-700 group-open:hidden">세부 항목 판정 보기 ▾</p>
      </summary>

      <div className="space-y-5 border-t border-gray-100 px-5 pb-6 pt-5 sm:px-6">
        <div>
          <h4 className="mb-2 text-base font-bold text-gray-900">세부 항목별 판정</h4>
          {doc.judgments.length > 0 ? (
            <JudgmentList judgments={doc.judgments} />
          ) : (
            <p className="text-[15px] text-gray-500">응답에 이 문서의 판정이 없습니다.</p>
          )}
        </div>

        {doc.items.length > 0 && (
          <details className="group/f">
            <summary className="cursor-pointer text-sm font-semibold text-blue-700">
              추출된 개별 민감정보 {doc.items.length}건 보기 <span className="text-gray-500">(등급 없음)</span>
            </summary>
            <div className="mt-3">
              <FindingsTable items={doc.items} />
            </div>
          </details>
        )}
      </div>
    </details>
  );
}

function ExposureTag({ value }: { value: string }) {
  if (!value) return <span className="text-gray-400">—</span>;
  const tone = /전체\s*노출/.test(value)
    ? "bg-red-50 text-red-700 ring-red-200"
    : /일부\s*노출/.test(value)
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : /가림/.test(value)
        ? "bg-green-50 text-green-700 ring-green-200"
        : "bg-gray-100 text-gray-600 ring-gray-200";
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-sm font-medium ring-1 ${tone}`}>{value}</span>;
}

// ---------------- 접기 영역 ----------------

export function Collapsible({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <details className={`group ${card}`}>
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <span>
          <span className="block text-base font-bold text-gray-900 sm:text-lg">{title}</span>
          {subtitle && <span className="mt-0.5 block text-sm text-gray-500">{subtitle}</span>}
        </span>
        <Chevron />
      </summary>
      <div className="border-t border-gray-100 px-5 py-5 sm:px-6">{children}</div>
    </details>
  );
}

const STEP_TYPE_LABEL: Record<string, string> = {
  "document-parse": "문서 읽기",
  "document-classify": "문서 분류",
  "information-extract": "항목 추출",
  merge: "문서 병합",
  instruct: "판단·작성",
};

interface RawStep {
  name: string;
  type: string | null;
  result: unknown;
}

function StepBody({ result }: { result: unknown }) {
  if (typeof result === "string") return <RichText text={result} />;
  if (Array.isArray(result) && result.every((r) => typeof r === "string"))
    return <p className="text-base text-gray-800">{(result as string[]).join(", ")}</p>;
  return (
    <pre className="overflow-auto rounded-xl bg-gray-50 p-4 font-mono text-[13px] leading-6 text-gray-800 ring-1 ring-gray-200 sm:text-sm">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

function RawViewer({ raw }: { raw: unknown }) {
  const steps = (raw as { steps?: RawStep[] })?.steps;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">개인정보 보호를 위해 원값·원문 발췌·좌표는 서버에서 제거된 상태입니다.</p>
      {Array.isArray(steps) &&
        steps.map((s, i) => (
          <details key={i} className="group rounded-xl ring-1 ring-gray-200">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">{i + 1}</span>
                <span className="truncate text-[15px] font-semibold text-gray-900">{s.name}</span>
                {s.type && (
                  <span className="hidden shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 sm:inline">
                    {STEP_TYPE_LABEL[s.type] ?? s.type}
                  </span>
                )}
              </span>
              <Chevron />
            </summary>
            <div className="border-t border-gray-100 px-4 py-4">
              <StepBody result={s.result} />
            </div>
          </details>
        ))}
      <details className="group">
        <summary className="cursor-pointer py-2 text-sm font-semibold text-blue-700">JSON 그대로 보기</summary>
        <pre className="mt-2 max-h-[520px] overflow-auto rounded-xl bg-gray-900 p-4 font-mono text-[13px] leading-6 text-gray-100">
          {JSON.stringify(raw, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// ---------------- 전체 ----------------

export function Results({ result, raw }: { result?: AnalysisResult; raw?: unknown }) {
  return (
    <div className="space-y-6">
      {result && (result.fileGrade || result.documents.length > 0) && <ConclusionCard result={result} />}

      {result && result.documents.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">문서별 결과</h2>
            <span className="text-sm text-gray-500">위험도 높은 순 · {result.documents.length}건</span>
          </div>
          {result.documents.map((d, i) => (
            <DocumentCard key={`${d.name}-${i}`} doc={d} index={i} />
          ))}
        </section>
      )}

      {result?.unparsedText && (
        <Collapsible title="등급 산정 원문">
          <RichText text={result.unparsedText} />
        </Collapsible>
      )}

      {result?.draft && (
        <Collapsible title="발송 전 안내문 초안" subtitle={`자동 생성 · ${result.draft.title}`}>
          <div className="rounded-xl bg-gray-50 px-5 py-5 ring-1 ring-gray-200 sm:px-6">
            <RichText text={result.draft.text} />
          </div>
        </Collapsible>
      )}

      {raw !== undefined && (
        <Collapsible title="원본 결과 보기" subtitle="워크플로우 단계별 응답">
          <RawViewer raw={raw} />
        </Collapsible>
      )}
    </div>
  );
}
