"use client";

import { useState } from "react";
import type { AnalysisResult, DocumentResult, FindingItem, Grade, GradeLevel, Judgment } from "@/lib/analysis-types";
import { Button, Panel, fmtDateTime } from "./AppShell";
import { GRADE_STYLE, GradeBadge } from "./GradeBadge";
import { RichText } from "./RichText";

export interface ResultMeta {
  jobId?: string;
  fileName?: string;
  fileSize?: number;
  requestedAt?: string;
  completedAt?: string;
  demo?: boolean;
}

const GRADE_ORDER: GradeLevel[] = ["critical", "high", "medium", "low", "undetermined"];

function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${className}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M7.21 5.23a.75.75 0 011.06-.02l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 11-1.04-1.08L11.17 10 7.23 6.29a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
    </svg>
  );
}

/** 등급별 건수 (응답 등급을 세기만 한다) */
function GradeCounts({ grades }: { grades: (Grade | null)[] }) {
  const counts = new Map<string, { grade: Grade; n: number }>();
  for (const g of grades) {
    if (!g) continue;
    const c = counts.get(g.label);
    if (c) c.n += 1;
    else counts.set(g.label, { grade: g, n: 1 });
  }
  const list = [...counts.values()].sort((x, y) => GRADE_ORDER.indexOf(x.grade.level) - GRADE_ORDER.indexOf(y.grade.level));
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {list.map(({ grade, n }) => (
        <span key={grade.label} className="inline-flex items-center gap-1.5 text-[14px] text-slate-700">
          <span className={`h-2.5 w-2.5 ${GRADE_STYLE[grade.level].dot}`} aria-hidden />
          {grade.label} <strong className="tabular-nums text-slate-900">{n}건</strong>
        </span>
      ))}
    </span>
  );
}

const fmtSize = (b?: number) => (b == null ? "" : b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(b / 1024)}KB`);

// ---------------- 점검 요약 ----------------

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_1fr] border-b border-slate-200 last:border-b-0 sm:grid-cols-[132px_1fr]">
      <dt className="bg-slate-50 px-3 py-2.5 text-[13px] font-semibold text-slate-600">{label}</dt>
      <dd className="min-w-0 px-3 py-2.5 text-[14px] text-slate-900">{children}</dd>
    </div>
  );
}

function SummaryPanel({ result, meta }: { result: AnalysisResult; meta: ResultMeta }) {
  const g = result.fileGrade;
  const undetermined = !g || g.level === "undetermined";
  const known = result.fileKnownMaxGrade;
  const headlineLevel = undetermined && known ? known.level : (g?.level ?? "undetermined");

  return (
    <Panel title="점검 결과 요약" bodyClassName="">
      {/* 결론 문장 */}
      <div className={`border-b border-slate-300 border-l-4 px-5 py-4 ${GRADE_STYLE[headlineLevel].bar}`}>
        {undetermined ? (
          <div className="space-y-1.5">
            <p className="text-[17px] font-bold text-slate-900 sm:text-lg">일부 항목을 판단하지 못해 등급을 확정하지 못했습니다.</p>
            {known && (
              <p className="flex flex-wrap items-center gap-2 text-[17px] font-bold text-slate-900 sm:text-lg">
                확인된 최소 등급은 <GradeBadge grade={known} size="lg" /> 입니다.
              </p>
            )}
          </div>
        ) : (
          <p className="flex flex-wrap items-center gap-2 text-[17px] font-bold text-slate-900 sm:text-lg">
            이 파일의 위험도 등급은 <GradeBadge grade={g} size="lg" /> 입니다.
          </p>
        )}
        <p className="mt-2 text-[13px] text-slate-600">※ 신청 건 전체가 아니라 업로드한 파일 기준 평가입니다.</p>
      </div>

      <dl>
        {meta.jobId && (
          <KV label="접수번호">
            <span className="break-all font-mono text-[13px]">{meta.jobId}</span>
          </KV>
        )}
        {meta.fileName && (
          <KV label="점검 대상 파일">
            <span className="break-all">{meta.fileName}</span>
            {meta.fileSize != null && <span className="ml-2 text-slate-500">({fmtSize(meta.fileSize)})</span>}
          </KV>
        )}
        {(meta.requestedAt || meta.completedAt) && (
          <KV label="점검 일시">
            <span className="tabular-nums">
              {meta.requestedAt}
              {meta.completedAt && <> ~ {meta.completedAt}</>}
            </span>
          </KV>
        )}
        <KV label="최종 판정">
          <span className="flex flex-wrap items-center gap-2">
            <GradeBadge grade={g} />
            {undetermined && known && (
              <span className="text-[13px] text-slate-600">
                확인된 최소 등급 <strong className={GRADE_STYLE[known.level].text}>{known.label}</strong>
              </span>
            )}
          </span>
        </KV>
        {result.documents.length > 0 && (
          <KV label="문서별 판정">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold">총 {result.documents.length}건</span>
              <GradeCounts grades={result.documents.map((d) => d.grade)} />
            </span>
          </KV>
        )}
        {result.summary.map((f) => (
          <KV key={f.label} label={f.label}>
            <span className="font-semibold">{f.value}</span>
            {f.detail && <p className="mt-1 text-[14px] leading-6 text-slate-700">{f.detail}</p>}
          </KV>
        ))}
        {result.overview && result.overview.length > 0 && (
          <KV label="판정 요지">
            <div className="space-y-1.5 leading-7">
              {result.overview.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </KV>
        )}
      </dl>
    </Panel>
  );
}

function ActionPanel({ result }: { result: AnalysisResult }) {
  if (!result.notes.length && !result.disclaimer) return null;
  return (
    <Panel title="조치 필요 사항" className="print-avoid-break">
      {result.notes.length > 0 && (
        <ol className="space-y-2">
          {result.notes.map((n, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-7 text-slate-800">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center bg-amber-100 text-[12px] font-bold text-amber-900">{i + 1}</span>
              <span>{n}</span>
            </li>
          ))}
        </ol>
      )}
      {result.disclaimer && <p className="mt-3 border-t border-slate-200 pt-3 text-[13px] text-slate-500">{result.disclaimer}</p>}
    </Panel>
  );
}

// ---------------- 문서별 판정 ----------------

function ExposureTag({ value }: { value: string }) {
  if (!value) return <span className="text-slate-400">—</span>;
  const tone = /전체\s*노출/.test(value)
    ? "border-red-300 text-red-800"
    : /일부\s*노출/.test(value)
      ? "border-amber-300 text-amber-900"
      : /가림/.test(value)
        ? "border-emerald-300 text-emerald-800"
        : "border-slate-300 text-slate-600";
  return <span className={`inline-block whitespace-nowrap rounded-[3px] border bg-white px-1.5 py-px text-[12px] font-semibold ${tone}`}>{value}</span>;
}

const th = "border-b border-slate-300 bg-slate-100 px-3 py-2 text-left text-[13px] font-semibold text-slate-700";
const td = "border-b border-slate-200 px-3 py-2.5 align-top text-[14px]";

function JudgmentTable({ judgments }: { judgments: Judgment[] }) {
  return (
    <div className="overflow-x-auto border border-slate-300 print:overflow-visible">
      <table className="w-full min-w-[640px] border-collapse print:min-w-0">
        <thead>
          <tr>
            <th className={`${th} w-[92px]`}>판정</th>
            <th className={th}>탐지 항목</th>
            <th className={`${th} w-[150px]`}>노출 상태</th>
            <th className={`${th} w-[160px]`}>위치</th>
          </tr>
        </thead>
        <tbody>
          {judgments.map((j, k) => (
            <tr key={k} className="print-avoid-break">
              <td className={td}>
                <GradeBadge grade={j.grade} size="sm" />
              </td>
              <td className={td}>
                <p className="font-semibold text-slate-900">{j.item || "—"}</p>
                {j.masked_value && <p className="font-mono text-[13px] text-slate-600">{j.masked_value}</p>}
                {j.reason && <p className="mt-1 text-[13px] leading-6 text-slate-600">{j.reason}</p>}
              </td>
              <td className={td}>{j.exposure ? <span className="text-[13px] text-slate-700">{j.exposure}</span> : "—"}</td>
              <td className={`${td} text-[13px] text-slate-600`}>{j.location || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FindingsTable({ items }: { items: FindingItem[] }) {
  const showMasked = items.some((i) => i.masked_value);
  return (
    <div className="overflow-x-auto border border-slate-300 print:overflow-visible">
      <table className="w-full min-w-[600px] border-collapse print:min-w-0">
        <thead>
          <tr>
            <th className={`${th} w-[44px]`}>No</th>
            <th className={th}>정보 유형</th>
            {showMasked && <th className={th}>마스킹 값</th>}
            <th className={`${th} w-[110px]`}>노출 상태</th>
            <th className={`${th} w-[110px]`}>기재 성격</th>
            <th className={th}>위치</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i, k) => (
            <tr key={k}>
              <td className={`${td} tabular-nums text-slate-500`}>{k + 1}</td>
              <td className={`${td} font-semibold text-slate-900`}>{i.information_type || "—"}</td>
              {showMasked && <td className={`${td} font-mono text-slate-700`}>{i.masked_value || "—"}</td>}
              <td className={td}>
                <ExposureTag value={i.exposure_status} />
              </td>
              <td className={`${td} text-slate-700`}>{i.usage_context || "—"}</td>
              <td className={`${td} text-[13px] text-slate-600`}>{i.source_locator || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-2 text-[14px] font-bold text-navy-900 print:break-after-avoid">{children}</h4>;
}

function DocumentRow({ doc, index }: { doc: DocumentResult; index: number }) {
  const level = doc.grade?.level ?? "undetermined";
  const multi = doc.judgments.length > 1;
  const top = doc.judgments[0];
  const partialRead = doc.readStatus && !/^판독\s*가능$/.test(doc.readStatus);
  const gist = !multi && doc.reason ? doc.reason : multi && top ? `최고 판정 항목: ${top.item}` : doc.reasons?.[0];

  return (
    <details data-print-open className={`group border-b border-slate-200 border-l-4 last:border-b-0 ${GRADE_STYLE[level].bar}`}>
      <summary className="grid cursor-pointer grid-cols-[28px_1fr_auto] items-start gap-x-3 px-3 py-3 hover:bg-slate-50 sm:grid-cols-[36px_1fr_72px_112px_20px] sm:items-center">
        <span className="pt-0.5 text-[13px] tabular-nums text-slate-500 sm:pt-0">{String(index + 1).padStart(2, "0")}</span>
        <span className="min-w-0">
          <span className="block font-semibold text-slate-900">
            {doc.name}
            {doc.classLabel && doc.classLabel !== doc.name && <span className="ml-1.5 text-[13px] font-normal text-slate-500">({doc.classLabel})</span>}
          </span>
          {gist && <span className="mt-0.5 line-clamp-2 block text-[13px] leading-5 text-slate-600 group-open:line-clamp-none">{gist}</span>}
          <span className="mt-1 block text-[12px] text-slate-500 sm:hidden">{doc.pages}</span>
        </span>
        <span className="hidden text-[13px] tabular-nums text-slate-600 sm:block">{doc.pages ?? "—"}</span>
        <span className="flex flex-col items-end gap-0.5 sm:items-start">
          <GradeBadge grade={doc.grade} />
          {doc.gradeSource === "highest-item" && <span className="text-[11px] text-slate-500">세부 최고 등급</span>}
          {doc.knownMaxGrade && <span className="text-[11px] text-slate-500">최소 {doc.knownMaxGrade.label}</span>}
        </span>
        <span className="no-print hidden sm:block">
          <Chevron className="group-open:rotate-90" />
        </span>
      </summary>

      <div className="space-y-4 border-t border-slate-200 bg-slate-50/60 px-4 py-4 sm:pl-[52px]">
        <p className="text-[14px] leading-7 text-slate-800">
          {doc.name}의 위험도 등급은 <strong className={GRADE_STYLE[level].text}>{doc.grade?.label ?? "판정 없음"}</strong>입니다.
          {doc.gradeSource === "highest-item" && <span className="text-slate-500"> (문서 안 세부 판정 중 가장 높은 등급)</span>}
          {partialRead && <span className="text-slate-600"> · 판독 상태: {doc.readStatus}</span>}
        </p>

        {(doc.reasons?.length || (!multi && doc.reason)) && (
          <div>
            <SubHeading>판정 근거</SubHeading>
            <ul className="list-disc space-y-1 pl-5 text-[14px] leading-7 text-slate-800 marker:text-slate-400">
              {doc.reasons?.length ? doc.reasons.map((r, k) => <li key={k}>{r}</li>) : <li>{doc.reason}</li>}
            </ul>
          </div>
        )}

        {(doc.reviewReasons?.length || doc.undeterminedItems.length > 0) && (
          <div className="border border-amber-300 bg-amber-50 px-3 py-2.5 text-[14px] leading-7 text-amber-950">
            <p className="font-bold text-amber-900">추가 확인 필요</p>
            {doc.reviewReasons?.map((r, k) => (
              <p key={`r${k}`}>· {r}</p>
            ))}
            {doc.undeterminedItems.map((i, k) => (
              <p key={`u${k}`}>
                · 판단하지 못한 항목: {i.information_type}
                {(i.usage_context || i.exposure_status) && <> — {i.usage_context || i.exposure_status}</>}
                {i.source_locator && <span className="text-amber-800"> ({i.source_locator})</span>}
              </p>
            ))}
          </div>
        )}

        {doc.judgments.length > 0 && (
          <div>
            <SubHeading>세부 항목별 판정 ({doc.judgments.length}건)</SubHeading>
            <JudgmentTable judgments={doc.judgments} />
          </div>
        )}

        {doc.items.length > 0 &&
          (doc.judgments.length > 0 ? (
            <details className="group/f no-print">
              <summary className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-navy-700">
                <Chevron className="h-3.5 w-3.5 group-open/f:rotate-90" />
                추출된 개별 민감정보 {doc.items.length}건 <span className="font-normal text-slate-500">(등급 없음)</span>
              </summary>
              <div className="mt-2">
                <FindingsTable items={doc.items} />
              </div>
            </details>
          ) : (
            <div>
              <SubHeading>탐지된 민감정보 ({doc.items.length}건)</SubHeading>
              <p className="-mt-1 mb-2 text-[13px] text-slate-500">이 분석 결과에는 항목별 등급이 없어 노출 상태만 표시합니다.</p>
              <FindingsTable items={doc.items} />
            </div>
          ))}
      </div>
    </details>
  );
}

function DocumentsPanel({ documents }: { documents: DocumentResult[] }) {
  return (
    <Panel title={`문서별 판정 (${documents.length}건)`} actions={<span className="text-[12px] text-slate-500">위험도 높은 순<span className="no-print"> · 행을 눌러 상세 확인</span></span>} bodyClassName="">
      <div className="hidden grid-cols-[36px_1fr_72px_112px_20px] gap-x-3 border-b border-slate-300 bg-slate-100 py-2 pl-4 pr-3 text-[13px] font-semibold text-slate-700 sm:grid">
        <span>No</span>
        <span>문서명 / 판정 요지</span>
        <span>페이지</span>
        <span>판정</span>
        <span />
      </div>
      {documents.map((d, i) => (
        <DocumentRow key={`${d.name}-${i}`} doc={d} index={i} />
      ))}
    </Panel>
  );
}

// ---------------- 안내문 (복사) ----------------

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function NoticePanel({ draft }: { draft: NonNullable<AnalysisResult["draft"]> }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const onCopy = async () => {
    const ok = await copyText(draft.text.replace(/\*\*/g, ""));
    setState(ok ? "ok" : "fail");
    setTimeout(() => setState("idle"), 2000);
  };
  return (
    <Panel
      title="발송 전 확인 안내문 (초안)"
      actions={
        <Button onClick={onCopy} className="no-print h-8 px-3 text-[13px]" aria-live="polite">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
            <rect x="7" y="7" width="10" height="10" rx="1" />
            <path d="M13 7V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3" />
          </svg>
          {state === "ok" ? "복사됨" : state === "fail" ? "복사 실패" : "본문 복사"}
        </Button>
      }
      className="print-avoid-break"
    >
      <p className="mb-3 text-[13px] text-slate-500">자동 생성된 초안입니다 ({draft.title}). 내용 확인 후 사용하십시오.</p>
      <div className="border border-slate-300 bg-white px-5 py-5 sm:px-7">
        <RichText text={draft.text} />
      </div>
    </Panel>
  );
}

// ---------------- 분석 근거 원문 ----------------

const STEP_TYPE_LABEL: Record<string, string> = {
  "document-parse": "문서 판독",
  "document-classify": "문서 분류",
  "information-extract": "항목 추출",
  merge: "문서 병합",
  instruct: "판단·작성",
  validate: "검증",
};

interface RawStep {
  name: string;
  type: string | null;
  result: unknown;
}

function StepBody({ result }: { result: unknown }) {
  if (typeof result === "string") return <RichText text={result} />;
  if (Array.isArray(result) && result.every((r) => typeof r === "string")) return <p className="text-[14px]">{(result as string[]).join(", ")}</p>;
  return <pre className="overflow-auto border border-slate-300 bg-slate-50 p-3 font-mono text-[12px] leading-5 text-slate-800">{JSON.stringify(result, null, 2)}</pre>;
}

function EvidencePanel({ raw }: { raw: unknown }) {
  const steps = (raw as { steps?: RawStep[] })?.steps;
  return (
    <details className="group no-print border border-slate-300 bg-white">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 bg-navy-50 px-4 py-2">
        <span className="flex items-center gap-2 text-[15px] font-bold text-navy-900">
          <span className="h-3.5 w-1 bg-navy-800" aria-hidden />
          분석 근거 원문 <span className="text-[12px] font-normal text-slate-500">워크플로우 단계별 응답</span>
        </span>
        <Chevron className="group-open:rotate-90" />
      </summary>
      <div className="space-y-2 border-t border-slate-300 p-4">
        <p className="text-[13px] text-slate-500">개인정보 보호를 위해 원값·원문 발췌·좌표는 서버에서 제거되었습니다.</p>
        {Array.isArray(steps) &&
          steps.map((s, i) => (
            <details key={i} className="group/s border border-slate-200">
              <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50">
                <Chevron className="group-open/s:rotate-90" />
                <span className="text-[13px] tabular-nums text-slate-500">{String(i + 1).padStart(2, "0")}</span>
                <span className="truncate text-[14px] font-semibold text-slate-900">{s.name}</span>
                {s.type && <span className="ml-auto shrink-0 text-[12px] text-slate-500">{STEP_TYPE_LABEL[s.type] ?? s.type}</span>}
              </summary>
              <div className="border-t border-slate-200 p-3">
                <StepBody result={s.result} />
              </div>
            </details>
          ))}
        <details className="group/j">
          <summary className="cursor-pointer py-1 text-[13px] font-semibold text-navy-700">JSON 원문 보기</summary>
          <pre className="mt-2 max-h-[480px] overflow-auto bg-slate-900 p-3 font-mono text-[12px] leading-5 text-slate-100">{JSON.stringify(raw, null, 2)}</pre>
        </details>
      </div>
    </details>
  );
}

// ---------------- 전체 ----------------

export function Results({ result, raw, meta }: { result?: AnalysisResult; raw?: unknown; meta: ResultMeta }) {
  return (
    <div className="space-y-4">
      {/* 인쇄용 머리글 */}
      <div className="print-only border-b-2 border-navy-900 pb-2">
        <p className="text-[18pt] font-bold text-navy-900">제출서류 개인정보 점검 결과서</p>
        <p className="mt-1 text-[9.5pt] text-slate-600">
          접수번호 {meta.jobId ?? "—"} · 출력일시 {fmtDateTime(new Date())} · 내부 업무용(외부 반출 금지)
        </p>
      </div>

      {result && (result.fileGrade || result.documents.length > 0) && <SummaryPanel result={result} meta={meta} />}
      {result && <ActionPanel result={result} />}
      {result && result.documents.length > 0 && <DocumentsPanel documents={result.documents} />}

      {result?.unparsedText && (
        <Panel title="등급 산정 원문">
          <RichText text={result.unparsedText} />
        </Panel>
      )}

      {result?.draft && <NoticePanel draft={result.draft} />}
      {raw !== undefined && <EvidencePanel raw={raw} />}
    </div>
  );
}
