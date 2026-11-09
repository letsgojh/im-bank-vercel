import type { ErrorCode } from "./analysis-types";

export const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 50;
export const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const MAX_PAGES = 100;

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  NO_FILE: "업로드할 PDF 파일을 선택해 주세요.",
  NOT_PDF: "PDF 파일만 업로드할 수 있습니다.",
  TOO_LARGE: `파일 용량이 ${MAX_UPLOAD_MB}MB를 넘습니다. ${MAX_UPLOAD_MB}MB 이하 파일로 다시 시도해 주세요.`,
  AUTH: "Upstage 인증에 실패했습니다. 서버의 API 키와 프로젝트 ID 설정을 확인해 주세요.",
  UPLOAD_FAILED: "파일 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  JOB_CREATE_FAILED: "분석 작업을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  STATUS_FAILED: "분석 상태를 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  JOB_FAILED: "분석 작업이 실패했습니다. Studio의 워크플로우 설정을 확인하거나 다시 시도해 주세요.",
  TIMEOUT: "10분이 지나도 분석이 끝나지 않아 조회를 중단했습니다. 잠시 후 다시 시도해 주세요.",
  PARSE_FAILED: "분석 결과를 해석하지 못했습니다. 아래 원본 결과를 확인해 주세요.",
  CONFIG: "서버 환경변수(UPSTAGE_API_KEY 등)가 설정되지 않았습니다.",
  RATE_LIMITED: "요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.",
};

export function apiError(code: ErrorCode, status: number) {
  return Response.json({ error: { code, message: ERROR_MESSAGES[code] } }, { status });
}

/** Upstage HTTP 상태 → 오류 코드. 401/403은 인증 실패, 429는 요청 제한. */
export function codeForHttp(status: number, fallback: ErrorCode): ErrorCode {
  if (status === 401 || status === 403) return "AUTH";
  if (status === 429) return "RATE_LIMITED";
  return fallback;
}
