import { apiError, codeForHttp, ERROR_MESSAGES } from "@/lib/errors";
import { demoStatus, isDemo, loadMockJob } from "@/lib/demo";
import { getJob, isConfigured, UpstageHttpError } from "@/lib/upstage";
import { parseJob, sanitizeJob } from "@/lib/parse";
import type { AnalysisResult, StatusResponse } from "@/lib/analysis-types";
import type { UpstageJob } from "@/lib/upstage-types";

/** Job 생성 시각부터 마지막 단계 종료 시각까지(초). 시각 정보가 없으면 undefined */
function jobDuration(job: UpstageJob): number | undefined {
  const end = Math.max(0, ...(job.output ?? []).map((o) => o.updated_at ?? 0));
  if (!job.created_at || !end || end < job.created_at) return undefined;
  return end - job.created_at;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel 함수 실행 시간 상한(초). 업로드+Job 생성은 큰 파일에서 10초를 넘을 수 있다.
export const maxDuration = 30;

// GET /api/status?job_id=: 3단계 조회를 1회 수행해서 status와(완료 시) 결과를 반환.
export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get("job_id") ?? "";
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(jobId)) return apiError("STATUS_FAILED", 400);

  let job: UpstageJob;
  const demoRun = isDemo() || jobId.startsWith("demo_");
  if (demoRun) {
    const status = demoStatus(jobId);
    if (!status) return apiError("STATUS_FAILED", 400);
    console.log(`[status] demo job_id=${jobId} status=${status}`);
    if (status !== "completed") return Response.json({ status } satisfies StatusResponse);
    job = await loadMockJob();
  } else {
    if (!isConfigured()) return apiError("CONFIG", 500);
    try {
      job = await getJob(jobId);
    } catch (e) {
      const http = e instanceof UpstageHttpError ? e.status : 0;
      console.log(`[status] job_id=${jobId} lookup failed http=${http}`);
      return apiError(codeForHttp(http, "STATUS_FAILED"), 502);
    }
    console.log(`[status] job_id=${jobId} status=${job.status}`);
  }

  if (job.status === "queued" || job.status === "in_progress") {
    return Response.json({ status: job.status } satisfies StatusResponse);
  }
  if (job.status === "failed") {
    return Response.json({
      status: "failed",
      error: { code: "JOB_FAILED", message: ERROR_MESSAGES.JOB_FAILED },
    } satisfies StatusResponse);
  }

  const raw = sanitizeJob(job);
  // 데모 응답의 시각은 과거 실제 실행 값이라 표시하지 않는다.
  const analysisSeconds = demoRun ? undefined : jobDuration(job);
  try {
    return Response.json({ status: "completed", result: parseJob(job), raw, analysisSeconds } satisfies StatusResponse);
  } catch (e) {
    console.log(`[status] job_id=${jobId} parse failed`);
    const partial = (e as { partial?: AnalysisResult }).partial;
    return Response.json({
      status: "completed",
      ...(partial ? { result: partial } : {}),
      raw,
      analysisSeconds,
      error: { code: "PARSE_FAILED", message: ERROR_MESSAGES.PARSE_FAILED },
    } satisfies StatusResponse);
  }
}
