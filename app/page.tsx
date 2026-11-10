"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, Button, Panel, fmtDateTime } from "@/components/AppShell";
import { StatusSteps, type Phase } from "@/components/Progress";
import { Results, type ResultMeta } from "@/components/Results";
import type { AnalyzeResponse, ApiError, StatusResponse } from "@/lib/analysis-types";
import { ERROR_MESSAGES, MAX_BYTES, MAX_PAGES, MAX_UPLOAD_MB } from "@/lib/errors";

const POLL_MS = 5_000;
const TIMEOUT_MS = 10 * 60_000;

type View =
  | { kind: "idle" }
  | { kind: "running"; phase: Phase }
  | { kind: "done"; data: StatusResponse }
  | { kind: "error"; message: string; phase: Phase | null; data?: StatusResponse };

async function readError(res: Response, fallback: keyof typeof ERROR_MESSAGES) {
  try {
    const body = (await res.json()) as Partial<ApiError>;
    if (body.error?.message) return body.error.message;
  } catch {}
  return ERROR_MESSAGES[fallback];
}

const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(b / 1024)}KB`);

/** 인쇄할 때는 접혀 있는 문서 상세를 모두 펼쳤다가 끝나면 되돌린다. */
function usePrintExpand() {
  useEffect(() => {
    let restore: (() => void) | null = null;
    const before = () => {
      const els = [...document.querySelectorAll<HTMLDetailsElement>("details[data-print-open]")];
      const prev = els.map((e) => e.open);
      els.forEach((e) => (e.open = true));
      restore = () => els.forEach((e, i) => (e.open = prev[i]));
    };
    const after = () => {
      restore?.();
      restore = null;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [meta, setMeta] = useState<ResultMeta>({});
  const runId = useRef(0);
  const startedAt = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  usePrintExpand();
  const running = view.kind === "running";

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => () => void (runId.current += 1), []);

  const pick = (f: File | null) => {
    setInputError(null);
    setFile(null);
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return setInputError(ERROR_MESSAGES.NOT_PDF);
    if (f.size > MAX_BYTES) return setInputError(ERROR_MESSAGES.TOO_LARGE);
    setFile(f);
  };

  const start = useCallback(async () => {
    if (!file) return setInputError(ERROR_MESSAGES.NO_FILE);
    const id = ++runId.current;
    const alive = () => id === runId.current;
    startedAt.current = Date.now();
    setElapsed(0);
    setMeta({ fileName: file.name, fileSize: file.size, requestedAt: fmtDateTime(new Date()) });
    setView({ kind: "running", phase: "uploading" });

    let jobId: string;
    let demo = false;
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      if (!res.ok) throw new Error(await readError(res, "UPLOAD_FAILED"));
      const data = (await res.json()) as AnalyzeResponse;
      jobId = data.job_id;
      demo = data.demo;
    } catch (e) {
      if (alive()) setView({ kind: "error", phase: "uploading", message: e instanceof Error && e.message ? e.message : ERROR_MESSAGES.UPLOAD_FAILED });
      return;
    }
    if (!alive()) return;
    setMeta((m) => ({ ...m, jobId, demo }));
    setView({ kind: "running", phase: "queued" });

    let phase: Phase = "queued";
    while (alive()) {
      if (Date.now() - startedAt.current > TIMEOUT_MS) {
        setView({ kind: "error", phase, message: ERROR_MESSAGES.TIMEOUT });
        return;
      }
      let data: StatusResponse;
      try {
        const res = await fetch(`/api/status?job_id=${encodeURIComponent(jobId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(await readError(res, "STATUS_FAILED"));
        data = (await res.json()) as StatusResponse;
      } catch (e) {
        if (alive()) setView({ kind: "error", phase, message: e instanceof Error && e.message ? e.message : ERROR_MESSAGES.STATUS_FAILED });
        return;
      }
      if (!alive()) return;

      if (data.status === "failed") return setView({ kind: "error", phase, message: data.error?.message ?? ERROR_MESSAGES.JOB_FAILED });
      if (data.status === "completed") {
        setMeta((m) => ({ ...m, completedAt: fmtDateTime(new Date()) }));
        if (data.error) return setView({ kind: "error", phase: "completed", message: data.error.message, data });
        return setView({ kind: "done", data });
      }
      phase = data.status;
      setView({ kind: "running", phase });
      await new Promise((r) => setTimeout(r, demo ? 1_000 : POLL_MS));
    }
  }, [file]);

  const reset = () => {
    runId.current += 1;
    setView({ kind: "idle" });
    setFile(null);
    setMeta({});
    setElapsed(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const locked = view.kind === "running" || view.kind === "done";
  const phase: Phase | null = view.kind === "running" ? view.phase : view.kind === "done" ? "completed" : view.kind === "error" ? view.phase : null;
  const data = view.kind === "done" ? view.data : view.kind === "error" ? view.data : undefined;

  return (
    <AppShell>
      <div className="no-print mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">제출서류 개인정보 점검</h1>
          <p className="mt-0.5 text-[13px] text-slate-600">전세자금대출 신청 서류가 병합된 PDF의 개인정보 노출 위험도를 점검합니다.</p>
        </div>
        {view.kind === "done" && (
          <div className="flex gap-2">
            <Button onClick={() => window.print()}>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
                <path d="M5 8V3h10v5M5 14H3V8h14v6h-2M5 11h10v6H5z" />
              </svg>
              결과 인쇄
            </Button>
            <Button variant="primary" onClick={reset}>
              신규 점검
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] print:block">
        {/* 좌측: 점검 요청 + 처리 현황 */}
        <div className="no-print space-y-4">
          <Panel title="점검 요청">
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-slate-700">
                  제출 서류 <span className="text-red-600">*</span>
                </p>
                <label
                  className={`flex items-center gap-2 border border-dashed px-3 py-3 ${
                    locked ? "cursor-not-allowed border-slate-300 bg-slate-50" : "cursor-pointer border-slate-400 hover:border-navy-700 hover:bg-navy-50"
                  }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!locked) pick(e.dataTransfer.files?.[0] ?? null);
                  }}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
                    <path d="M14 3v5h5" />
                  </svg>
                  <span className="min-w-0 flex-1">
                    {file ? (
                      <>
                        <span className="block truncate text-[14px] font-semibold text-slate-900">{file.name}</span>
                        <span className="text-[12px] text-slate-500">{fmtSize(file.size)}</span>
                      </>
                    ) : (
                      <span className="text-[14px] text-slate-500">PDF 파일 선택 또는 끌어놓기</span>
                    )}
                  </span>
                  {!locked && <span className="shrink-0 rounded-[3px] border border-slate-400 bg-white px-2 py-1 text-[12px] font-semibold text-slate-700">찾아보기</span>}
                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    disabled={locked}
                    onChange={(e) => pick(e.target.files?.[0] ?? null)}
                  />
                </label>
                <ul className="mt-2 space-y-0.5 text-[12px] text-slate-500">
                  <li>· PDF 형식, {MAX_UPLOAD_MB}MB · {MAX_PAGES}페이지 이하 1건</li>
                  <li>· 여러 서류가 병합된 파일 기준으로 점검합니다</li>
                </ul>
              </div>
              {inputError && <p className="border-l-2 border-red-600 bg-red-50 px-2.5 py-1.5 text-[13px] text-red-800">{inputError}</p>}
              <Button variant="primary" className="h-10 w-full" onClick={start} disabled={!file || locked}>
                {view.kind === "running" ? "점검 진행 중" : "점검 요청"}
              </Button>
            </div>
          </Panel>

          <Panel title="처리 현황">
            <StatusSteps phase={phase} elapsed={elapsed} jobId={meta.jobId} demo={meta.demo} failed={view.kind === "error" && !view.data} />
          </Panel>
        </div>

        {/* 우측: 결과 */}
        <div className="min-w-0 space-y-4">
          {view.kind === "error" && (
            <div role="alert" className="no-print flex gap-3 border border-red-300 border-l-4 border-l-red-700 bg-white px-4 py-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-700 text-[12px] font-bold text-white">!</span>
              <div className="text-[14px]">
                <p className="font-bold text-red-800">처리 오류</p>
                <p className="text-slate-800">{view.message}</p>
                {!view.data && (
                  <button type="button" onClick={reset} className="mt-1 text-[13px] font-semibold text-navy-700 underline underline-offset-2">
                    다시 요청하기
                  </button>
                )}
              </div>
            </div>
          )}

          {data ? (
            <Results result={data.result} raw={data.raw} meta={meta} />
          ) : (
            <section className="no-print flex min-h-[320px] flex-col items-center justify-center border border-slate-300 bg-white px-6 py-12 text-center">
              {view.kind === "running" ? (
                <>
                  <span className="relative mb-4 inline-block h-10 w-10" aria-hidden>
                    <span className="absolute inset-0 rounded-full border-[3px] border-navy-100" />
                    <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-navy-800" />
                  </span>
                  <p className="text-[16px] font-bold text-slate-900">서류를 점검하고 있습니다</p>
                  <p className="mt-1 text-[14px] text-slate-600">통상 3~4분이 소요됩니다. 화면을 닫지 마십시오.</p>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 48 48" className="mb-3 h-12 w-12 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                    <rect x="10" y="6" width="28" height="36" rx="2" />
                    <path d="M16 16h16M16 23h16M16 30h10" />
                  </svg>
                  <p className="text-[16px] font-bold text-slate-700">조회된 점검 결과가 없습니다</p>
                  <p className="mt-1 text-[14px] text-slate-500">좌측에서 제출 서류(PDF)를 선택한 뒤 점검을 요청하십시오.</p>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
