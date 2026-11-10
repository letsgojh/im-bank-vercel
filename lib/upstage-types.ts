// Upstage Studio Agent API 응답 타입.
// mock/response.json(실제 completed 응답, GET /v2/responses/{id}?include[]=all)을 기준으로 정의했다.

export type JobStatus = "queued" | "in_progress" | "completed" | "failed";

/** POST /v2/files 응답 */
export interface UpstageFile {
  id: string;
  object: "file";
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
}

/** output[].content[] — text, additional_values 모두 JSON 문자열(또는 일반 문자열) */
export interface UpstageContent {
  type: "output_text" | string;
  text: string;
  annotations?: unknown[];
  additional_values?: string | null;
}

/** output[] — 워크플로우의 각 단계 결과 */
export interface UpstageOutputItem {
  id: string;
  type: "message" | string;
  status: string;
  role: string;
  /** 단계 이름. 예: "step_1_parse", "Information Extract - 재직증명정보", "Instruct - 위험등급산정" */
  model: string;
  /** "document-parse" | "document-classify" | "information-extract" | "merge" | "instruct" */
  step_type?: string | null;
  content: UpstageContent[];
  /** 단계 시작/종료 시각 (Unix 초) */
  created_at?: number;
  updated_at?: number;
}

/** POST /v2/responses, GET /v2/responses/{id} 응답 */
export interface UpstageJob {
  id: string;
  object: "response";
  created_at: number;
  status: JobStatus;
  model: string;
  error: { code?: string; message?: string } | null;
  output: UpstageOutputItem[];
  output_text?: string | null;
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
}

// ---- 단계별 text(JSON.parse 후) 구조 ----

/** information-extract 단계의 sensitive_findings[] */
export interface ExtractFinding {
  information_type?: string;
  /** 원값. 서버에서 제거하고 브라우저로 보내지 않는다. */
  observed_value?: string;
  exposure_status?: string;
  usage_context?: string;
  source_locator?: string;
  /** 원문 발췌. 서버에서 제거하고 브라우저로 보내지 않는다. */
  evidence_excerpt?: string;
  /** 응답에 마스킹 값이 오면 이 필드만 화면에 표시한다. */
  masked_value?: string;
}

/** information-extract 단계 결과. 문서 종류별 추가 필드(employee_name 등)는 원값이라 사용하지 않는다. */
export interface ExtractResult {
  document_title?: string;
  document_read_status?: string;
  sensitive_findings?: ExtractFinding[];
  [key: string]: unknown;
}

/** information-extract 단계 additional_values 중 사용하는 부분 */
export interface ExtractAdditional {
  page_ranges?: [number, number][];
}

/** instruct(위험등급산정) 단계 additional_values 중 사용하는 부분 */
export interface InstructAdditional {
  /** 전체 위험등급(예: "높음") */
  enum?: string;
}
