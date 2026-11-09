import "server-only";
import type { UpstageFile, UpstageJob } from "./upstage-types";

const BASE = "https://api.upstage.ai/v2";

export class UpstageHttpError extends Error {
  constructor(public status: number) {
    super(`Upstage HTTP ${status}`);
  }
}

function env() {
  const apiKey = process.env.UPSTAGE_API_KEY;
  const projectId = process.env.UPSTAGE_PROJECT_ID;
  const agentId = process.env.UPSTAGE_AGENT_ID;
  const configId = process.env.UPSTAGE_CONFIG_ID;
  if (!apiKey || !projectId || !agentId) return null;
  return { apiKey, projectId, agentId, configId };
}

export function isConfigured() {
  return env() !== null;
}

function headers() {
  const e = env()!;
  return { Authorization: `Bearer ${e.apiKey}`, "x-project-id": e.projectId };
}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (!res.ok) throw new UpstageHttpError(res.status);
  return (await res.json()) as T;
}

/** 1단계: 파일 업로드 → 응답의 id가 file_id */
export function uploadFile(file: File) {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("purpose", "user_data");
  return call<UpstageFile>(`${BASE}/files`, { method: "POST", headers: headers(), body: form });
}

/** 2단계: Job 생성 → 응답의 id가 job_id */
export function createJob(fileId: string) {
  const e = env()!;
  return call<UpstageJob>(`${BASE}/responses`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: e.agentId,
      ...(e.configId ? { config_id: e.configId } : {}),
      include: ["all"],
      input: [{ role: "user", content: [{ type: "input_file", file_id: fileId }] }],
    }),
  });
}

/** 3단계: Job 조회 1회. 문서별 결과가 중간 단계에 있으므로 include[]=all로 모든 단계를 받는다. */
export function getJob(jobId: string) {
  return call<UpstageJob>(`${BASE}/responses/${encodeURIComponent(jobId)}?include[]=all`, {
    method: "GET",
    headers: headers(),
  });
}
