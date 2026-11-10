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

/** 세부 항목 판정 — 등급산정 결과의 한 줄(또는 JSON items[] 하나) */
export interface Judgment {
  /** 탐지 항목 (예: "임차인 성명·주민등록번호·전화번호·주소") */
  item: string;
  grade: Grade | null;
  masked_value?: string;
  exposure?: string;
  readStatus?: string;
  /** 페이지/기재란 */
  location?: string;
  reason?: string;
}

/** PDF 안의 문서 하나 (워크플로우의 문서 분류 기준) */
export interface DocumentResult {
  name: string;
  /** 워크플로우 문서 분류 결과 (예: "임대차계약서") */
  classLabel?: string;
  grade: Grade | null;
  /**
   * response: 응답에 문서 등급이 한 개로 적혀 있음
   * highest-item: 응답이 문서 안 항목별로만 판정해서, 그 판정 중 가장 높은 등급을 문서 등급으로 표시
   */
  gradeSource: "response" | "highest-item";
  readStatus?: string;
  reason?: string;
  pages?: string;
  /** 판정이 확정되지 않았을 때 확인된 최소 등급 (known_risk_grade) */
  knownMaxGrade?: Grade | null;
  /** 문서 판정 근거 문장들 (등급 없음) */
  reasons?: string[];
  /** 추가 확인이 필요한 사유 */
  reviewReasons?: string[];
  /** 세부 항목 판정 (위험도 높은 순) */
  judgments: Judgment[];
  /** 항목 추출 단계가 찾은 개별 민감정보 (등급 없음) */
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
  /** 파일 판정이 확정되지 않았을 때 확인된 최소 등급 */
  fileKnownMaxGrade?: Grade | null;
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
