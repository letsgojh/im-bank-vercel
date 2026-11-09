import { apiError, codeForHttp, MAX_BYTES } from "@/lib/errors";
import { isDemo, newDemoJobId } from "@/lib/demo";
import { createJob, isConfigured, uploadFile, UpstageHttpError } from "@/lib/upstage";
import type { AnalyzeResponse } from "@/lib/analysis-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel 함수 실행 시간 상한(초). 업로드+Job 생성은 큰 파일에서 10초를 넘을 수 있다.
export const maxDuration = 60;

// POST /api/analyze: PDF 받기 → 1단계 업로드 → 2단계 Job 생성 → job_id만 반환.
// PDF는 메모리에서 바로 Upstage로 넘기고 디스크에 저장하지 않는다.
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError("NO_FILE", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return apiError("NO_FILE", 400);
  if (file.size > MAX_BYTES) return apiError("TOO_LARGE", 413);

  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const isPdf = String.fromCharCode(...head) === "%PDF-";
  if (!isPdf) return apiError("NOT_PDF", 415);

  if (isDemo()) {
    const job_id = newDemoJobId();
    console.log(`[analyze] demo job_id=${job_id}`);
    return Response.json({ job_id, demo: true } satisfies AnalyzeResponse);
  }

  if (!isConfigured()) return apiError("CONFIG", 500);

  let fileId: string;
  try {
    fileId = (await uploadFile(file)).id;
  } catch (e) {
    const status = e instanceof UpstageHttpError ? e.status : 0;
    console.log(`[analyze] upload failed http=${status}`);
    return apiError(codeForHttp(status, "UPLOAD_FAILED"), 502);
  }

  try {
    const job = await createJob(fileId);
    console.log(`[analyze] job_id=${job.id} status=${job.status}`);
    return Response.json({ job_id: job.id, demo: false } satisfies AnalyzeResponse);
  } catch (e) {
    const status = e instanceof UpstageHttpError ? e.status : 0;
    console.log(`[analyze] job create failed http=${status}`);
    return apiError(codeForHttp(status, "JOB_CREATE_FAILED"), 502);
  }
}
