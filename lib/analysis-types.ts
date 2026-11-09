// 브라우저에 내려보내는 화면용 구조. 원값(observed_value, evidence_excerpt 등)은 포함하지 않는다.

import type { JobStatus } from "./upstage-types";

/** 색상·정렬용 분류. 표시 문구는 응답의 한국어 등급(label)을 그대로 쓴다. */
export type GradeLevel = "low" | "medium" | "high" | "critical" | "undetermined";

export interface Grade {
  /** 응답에 적힌 등급 문구 그대로 (예: "높음") */
  label: string;
  level: GradeLevel;
}

export interface FindingItem {
  information_type: string;
  masked_value?: string;
  exposure_status: string;
  usage_context: string;
  source_locator: string;
}

export interface DocumentResult {
  /** 등급산정 표의 "문서" 칸 */
  name: string;
  grade: Grade | null;
  /** 표의 나머지 칸: 머리글 → 값 (탐지 항목, 원본 노출 상태, 판독 상태, 페이지/기재란, 짧은 판단 근거 등) */
  fields: { label: string; value: string }[];
  readStatus?: string;
  reason?: string;
  pages?: string;
  items: FindingItem[];
  /** exposure_status가 "판독 불가"인 항목 */
  undeterminedItems: FindingItem[];
}

export interface SummaryField {
  label: string;
  value: string;
  detail?: string;
}

export interface AnalysisResult {
  fileGrade: Grade | null;
  summary: SummaryField[];
  /** ① 절의 설명 문단 */
  overview?: string[];
  documents: DocumentResult[];
  notes: string[];
  disclaimer?: string;
  /** 마지막 단계에서 생성된 안내문 초안 */
  draft?: { title: string; text: string };
  /** 등급산정 단계를 해석하지 못했을 때 원문 */
  unparsedText?: string;
}

export type ErrorCode =
  | "NO_FILE"
  | "NOT_PDF"
  | "TOO_LARGE"
  | "AUTH"
  | "UPLOAD_FAILED"
  | "JOB_CREATE_FAILED"
  | "STATUS_FAILED"
  | "JOB_FAILED"
  | "TIMEOUT"
  | "PARSE_FAILED"
  | "CONFIG"
  | "RATE_LIMITED";

export interface ApiError {
  error: { code: ErrorCode; message: string };
}

export interface AnalyzeResponse {
  job_id: string;
  demo: boolean;
}

export interface StatusResponse {
  status: JobStatus;
  result?: AnalysisResult;
  /** "원본 JSON 보기"용. 원값·좌표를 제거한 단계별 결과 */
  raw?: unknown;
  error?: { code: ErrorCode; message: string };
}
