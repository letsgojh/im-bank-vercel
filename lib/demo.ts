import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { JobStatus, UpstageJob } from "./upstage-types";

// DEMO_MODE=true: Upstage를 호출하지 않고 mock/response.json(실제 completed 응답, 개인정보 가짜 값)으로
// queued → in_progress → completed 흐름을 몇 초 만에 재현한다.

export const isDemo = () => process.env.DEMO_MODE === "true";

const QUEUED_MS = 3_000;
const IN_PROGRESS_MS = 9_000;

export const newDemoJobId = () => `demo_${Date.now()}`;

export function demoStatus(jobId: string): JobStatus | null {
  const started = Number(jobId.replace(/^demo_/, ""));
  if (!jobId.startsWith("demo_") || !Number.isFinite(started)) return null;
  const elapsed = Date.now() - started;
  if (elapsed < QUEUED_MS) return "queued";
  if (elapsed < IN_PROGRESS_MS) return "in_progress";
  return "completed";
}

let cache: UpstageJob | null = null;

export async function loadMockJob(): Promise<UpstageJob> {
  if (!cache) {
    const file = path.join(process.cwd(), "mock", "response.json");
    cache = JSON.parse(await readFile(file, "utf8")) as UpstageJob;
  }
  return cache;
}
