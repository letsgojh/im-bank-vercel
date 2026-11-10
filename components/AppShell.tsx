"use client";

import { useEffect, useState } from "react";

export const fmtDateTime = (d: Date) =>
  `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{now ? fmtDateTime(now) : ""}</span>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print bg-navy-900 text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-sky-200" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
              <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span className="text-[17px] font-bold tracking-tight">서류 개인정보 점검 시스템</span>
            <span className="hidden rounded-[3px] border border-white/25 px-1.5 py-0.5 text-[11px] font-medium text-sky-100 sm:inline">
              내부 업무용
            </span>
          </div>
          <div className="flex items-center gap-4 text-[13px] text-sky-100">
            <span className="hidden sm:inline">여신심사 담당</span>
            <span className="hidden h-3 w-px bg-white/25 sm:inline-block" />
            <Clock />
          </div>
        </div>
      </header>

      <div className="no-print border-b border-slate-300 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <nav className="flex items-center gap-1.5 text-[13px] text-slate-500" aria-label="경로">
            <span>여신</span>
            <span aria-hidden>›</span>
            <span>전세자금대출</span>
            <span aria-hidden>›</span>
            <span className="font-semibold text-navy-900">제출서류 개인정보 점검</span>
          </nav>
          <span className="hidden text-[13px] text-slate-500 md:inline">화면번호 LN-DOC-0102</span>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 print:max-w-none print:p-0">{children}</main>

      <footer className="border-t border-slate-300 bg-white print:border-t-0">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 text-[12px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>본 화면은 내부 업무용이며 외부 반출을 금지합니다. 자동 분석 결과는 담당자 확인 후 처리하십시오.</span>
          <span className="no-print">개인정보 원값은 화면에 표시되지 않습니다.</span>
        </div>
      </footer>
    </div>
  );
}

/** 업무 화면 패널: 제목 줄 + 본문 */
export function Panel({
  title,
  actions,
  children,
  className = "",
  bodyClassName = "p-4",
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`border border-slate-300 bg-white ${className}`}>
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-slate-300 bg-navy-50 px-4 py-2">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-navy-900">
          <span className="h-3.5 w-1 bg-navy-800" aria-hidden />
          {title}
        </h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const v =
    variant === "primary"
      ? "bg-navy-900 text-white hover:bg-navy-800 disabled:bg-slate-300 disabled:text-slate-500"
      : "border border-slate-400 bg-white text-slate-800 hover:bg-slate-50 disabled:text-slate-400";
  return (
    <button
      type="button"
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-[3px] px-3.5 text-[14px] font-semibold transition disabled:cursor-not-allowed ${v} ${className}`}
      {...props}
    />
  );
}
