"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Progress, type Phase } from "@/components/Progress";
import { Results } from "@/components/Results";
import type { AnalyzeResponse, ApiError, StatusResponse } from "@/lib/analysis-types";
import { ERROR_MESSAGES, MAX_BYTES, MAX_PAGES, MAX_UPLOAD_MB } from "@/lib/errors";

const POLL_MS = 5_000;
const TIMEOUT_MS = 10 * 60_000;

type View =
  | { kind: "idle" }
  | { kind: "running"; phase: Phase; demo: boolean }
  | { kind: "done"; data: StatusResponse }
  | { kind: "error"; message: string; data?: StatusResponse };

async function readError(res: Response, fallback: keyof typeof ERROR_MESSAGES) {
  try {
    const body = (await res.json()) as Partial<ApiError>;
    if (body.error?.message) return body.error.message;
  } catch {}
  return ERROR_MESSAGES[fallback];
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const runId = useRef(0);
  const startedAt = useRef(0);

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
    setView({ kind: "running", phase: "uploading", demo: false });

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
      if (alive()) setView({ kind: "error", message: e instanceof Error && e.message ? e.message : ERROR_MESSAGES.UPLOAD_FAILED });
      return;
    }
    if (!alive()) return;
    setView({ kind: "running", phase: "queued", demo });

    while (alive()) {
      if (Date.now() - startedAt.current > TIMEOUT_MS) {
        setView({ kind: "error", message: ERROR_MESSAGES.TIMEOUT });
        return;
      }
      let data: StatusResponse;
      try {
        const res = await fetch(`/api/status?job_id=${encodeURIComponent(jobId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(await readError(res, "STATUS_FAILED"));
        data = (await res.json()) as StatusResponse;
      } catch (e) {
        if (alive()) setView({ kind: "error", message: e instanceof Error && e.message ? e.message : ERROR_MESSAGES.STATUS_FAILED });
        return;
      }
      if (!alive()) return;

      if (data.status === "failed") return setView({ kind: "error", message: data.error?.message ?? ERROR_MESSAGES.JOB_FAILED });
      if (data.status === "completed") {
        if (data.error) return setView({ kind: "error", message: data.error.message, data });
        return setView({ kind: "done", data });
      }
      setView({ kind: "running", phase: data.status, demo });
      await new Promise((r) => setTimeout(r, demo ? 1_000 : POLL_MS));
    }
  }, [file]);

  const reset = () => {
    runId.current += 1;
    setView({ kind: "idle" });
    setFile(null);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <h1 className="text-[26px] font-extrabold tracking-tight text-gray-900 sm:text-4xl">전세대출 서류 위험도 점검</h1>
        <p className="mt-2 text-base text-gray-600 sm:text-lg">
          서류가 병합된 PDF 1개를 올리면 개인정보 위험도 등급과 문서별 근거를 보여드립니다.
        </p>
      </header>

      {(view.kind === "idle" || view.kind === "error") && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-10 text-center transition hover:border-blue-400 hover:bg-blue-50/40"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pick(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            <span className="text-3xl" aria-hidden>📄</span>
            <span className="font-semibold text-gray-900">{file ? file.name : "PDF 파일을 선택하거나 끌어다 놓으세요"}</span>
            <span className="text-xs text-gray-500">
              PDF만 가능 · {MAX_UPLOAD_MB}MB 이하 · {MAX_PAGES}페이지 이하
            </span>
            <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          </label>
          {inputError && <p className="mt-3 text-sm font-medium text-red-600">{inputError}</p>}
          <button
            type="button"
            onClick={start}
            disabled={!file}
            className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            위험도 분석 시작
          </button>
        </section>
      )}

      {view.kind === "error" && (
        <div role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-800 ring-1 ring-red-200">
          {view.message}
        </div>
      )}

      {view.kind === "running" && <Progress phase={view.phase} elapsed={elapsed} demo={view.demo} />}

      {view.kind === "done" && (
        <Progress phase="completed" elapsed={elapsed} demo={false} />
      )}

      {(view.kind === "done" || (view.kind === "error" && view.data)) && (
        <div className="mt-4">
          <Results
            result={view.kind === "done" ? view.data.result : view.data?.result}
            raw={view.kind === "done" ? view.data.raw : view.data?.raw}
          />
          {view.kind === "done" && (
            <button type="button" onClick={reset} className="mt-6 w-full rounded-xl bg-white py-3 font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">
              다른 파일 분석하기
            </button>
          )}
        </div>
      )}
    </main>
  );
}
