// Upstage Job 응답(include[]=all) → 화면용 AnalysisResult.
// 등급은 응답 값을 그대로 쓰고 다시 계산하지 않는다. 원값 필드는 여기서 버린다.

import type {
  AnalysisResult,
  DocumentResult,
  FindingItem,
  Grade,
  GradeLevel,
  SummaryField,
} from "./analysis-types";
import type {
  ExtractAdditional,
  ExtractResult,
  InstructAdditional,
  UpstageJob,
  UpstageOutputItem,
} from "./upstage-types";

// ---------- 공통 유틸 ----------

/** JSON 문자열이면 파싱. 문자열을 감싼 JSON("\"...\"")이면 한 번 더 벗긴다. */
export function parseMaybeJson(text: string | null | undefined): unknown {
  if (text == null) return null;
  let value: unknown = text;
  for (let i = 0; i < 2 && typeof value === "string"; i++) {
    try {
      value = JSON.parse(value);
    } catch {
      break;
    }
  }
  return value;
}

function asObject<T>(v: unknown): T | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as T) : null;
}

/** 인용 표시(【†3】)와 굵게(**) 제거 */
export function clean(s: string): string {
  return s.replace(/【†\d+】/g, "").replace(/\*\*/g, "").trim();
}

const firstText = (o: UpstageOutputItem) => o.content?.[0]?.text ?? "";
const firstAdditional = (o: UpstageOutputItem) => o.content?.[0]?.additional_values ?? null;

// ---------- 등급 ----------

/** 응답 등급 문구 → 색상용 분류. 문구 자체는 바꾸지 않는다. */
export function toGrade(label: string | null | undefined): Grade | null {
  if (!label) return null;
  const text = clean(label);
  if (!text) return null;
  const t = text.replace(/\s/g, "").toLowerCase();
  let level: GradeLevel = "undetermined";
  if (/매우높음|critical/.test(t)) level = "critical";
  else if (/높음|high/.test(t)) level = "high";
  else if (/보통|중간|medium/.test(t)) level = "medium";
  else if (/낮음|low/.test(t)) level = "low";
  return { label: text, level };
}

export const GRADE_RANK: Record<GradeLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  undetermined: 0,
};

// ---------- 단계 찾기 ----------

function isInstruct(o: UpstageOutputItem) {
  return o.step_type === "instruct" || /^Instruct\b/i.test(o.model ?? "");
}

function findGradingStep(outputs: UpstageOutputItem[]) {
  // 1순위: 이름에 "위험등급"이 들어간 instruct 단계, 2순위: additional_values.enum이 있는 instruct 단계
  return (
    outputs.find((o) => isInstruct(o) && /위험\s*등급/.test(o.model)) ??
    outputs.find((o) => isInstruct(o) && asObject<InstructAdditional>(parseMaybeJson(firstAdditional(o)))?.enum)
  );
}

// ---------- 마크다운(등급산정 단계) ----------

interface Section {
  mark: string;
  heading: string;
  body: string;
}

const CIRCLED = "①②③④⑤⑥⑦⑧⑨";

/**
 * 등급산정 마크다운을 ①②③ 절로 나눈다. 실행마다 형식이 조금씩 달라서 둘 다 받는다.
 *  - "## ① 전체 결과\n**전체 확인 위험등급: 높음**..."      (제목 줄이 따로 있음)
 *  - "① **전체 위험등급: 매우 높음 / 민감정보 포함 여부: 포함**" (제목 줄에 바로 내용)
 */
function splitSections(md: string): Section[] {
  const re = new RegExp(`^[ \\t]*(?:#{1,6}[ \\t]*)?([${CIRCLED}])[ \\t]*(.*)$`, "gm");
  const marks = [...md.matchAll(re)];
  return marks.map((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index! : md.length;
    const rest = md.slice(start, end).trim();
    const headLine = m[2].trim();
    // 제목 줄에 "라벨: 값"이 들어 있으면 제목이 아니라 본문이다.
    const headIsContent = /[:：]/.test(clean(headLine));
    return {
      mark: m[1],
      heading: headIsContent ? "" : clean(headLine),
      body: headIsContent ? `${headLine}\n${rest}` : rest,
    };
  });
}

function sectionBy(sections: Section[], mark: string, ...keywords: string[]) {
  return (
    sections.find((s) => keywords.some((k) => s.heading.includes(k)))?.body ??
    sections.find((s) => s.mark === mark)?.body
  );
}

/**
 * ① 절 → 라벨/값 목록 + 설명 문단.
 * 굵은 글씨 안의 "라벨: 값"을 " / " 단위로 나눠 읽고, 같은 줄 나머지 글은 그 항목의 설명으로,
 * 굵은 글씨가 없는 줄은 전체 설명(overview)으로 둔다.
 */
function parseSummary(body: string): { fields: SummaryField[]; overview: string[] } {
  const fields: SummaryField[] = [];
  const overview: string[] = [];
  for (const line of body.split(/\n+/)) {
    const pairs = [...line.matchAll(/\*\*(.+?)\*\*/g)]
      .flatMap((b) => b[1].split(/\s+\/\s+/))
      .map((seg) => clean(seg).match(/^([^:：]+)[:：]\s*(.+)$/))
      .filter((m): m is RegExpMatchArray => m !== null);
    const rest = clean(line.replace(/\*\*(.+?)\*\*/g, ""));
    if (pairs.length) {
      for (const p of pairs) fields.push({ label: p[1].trim(), value: p[2].trim() });
      if (rest) fields[fields.length - 1].detail = rest;
    } else if (rest) {
      overview.push(rest);
    }
  }
  return { fields, overview };
}

function parseTable(body: string): { headers: string[]; rows: string[][] } | null {
  const lines = body.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("|"));
  if (lines.length < 2) return null;
  const cells = (l: string) => l.replace(/^\||\|$/g, "").split("|").map((c) => clean(c));
  const headers = cells(lines[0]);
  const rows = lines
    .slice(1)
    .filter((l) => !/^\|\s*:?-{2,}/.test(l))
    .map(cells)
    .filter((r) => r.some(Boolean));
  return { headers, rows };
}

function parseNotes(body: string | undefined) {
  if (!body) return { notes: [] as string[], disclaimer: undefined as string | undefined };
  const notes: string[] = [];
  const rest: string[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*[-*]\s+(.*)$/);
    if (m) notes.push(clean(m[1]));
    else if (line.trim()) rest.push(clean(line));
  }
  return { notes, disclaimer: rest.join(" ") || undefined };
}

// ---------- 문서명 매칭 ----------

const norm = (s: string) => s.replace(/[^가-힣A-Za-z0-9()]/g, "");
const base = (s: string) => norm(s).replace(/\(.*$/, "");

function sameDocument(tableName: string, title: string) {
  const a = norm(tableName);
  const b = norm(title);
  if (!a || !b) return false;
  return a === b || a.startsWith(base(b)) || b.startsWith(base(a));
}

function pageLabel(ranges: [number, number][] | undefined) {
  if (!ranges?.length) return undefined;
  return ranges.map(([s, e]) => (s === e ? `${s}` : `${s}–${e}`)).join(", ") + "쪽";
}

interface ExtractDoc {
  title: string;
  readStatus?: string;
  pages?: string;
  items: FindingItem[];
}

function toItem(f: Record<string, unknown>): FindingItem {
  const s = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : "");
  // 원값(observed_value, evidence_excerpt)은 의도적으로 복사하지 않는다.
  return {
    information_type: s("information_type"),
    ...(s("masked_value") ? { masked_value: s("masked_value") } : {}),
    exposure_status: s("exposure_status"),
    usage_context: s("usage_context"),
    source_locator: s("source_locator"),
  };
}

function readExtracts(outputs: UpstageOutputItem[]): ExtractDoc[] {
  return outputs
    .filter((o) => o.step_type === "information-extract" || /^Information Extract\b/i.test(o.model))
    .map((o) => {
      const r = asObject<ExtractResult>(parseMaybeJson(firstText(o))) ?? {};
      const add = asObject<ExtractAdditional>(parseMaybeJson(firstAdditional(o))) ?? {};
      const findings = Array.isArray(r.sensitive_findings) ? r.sensitive_findings : [];
      return {
        title: typeof r.document_title === "string" ? r.document_title : o.model.replace(/^Information Extract\s*-\s*/, ""),
        readStatus: typeof r.document_read_status === "string" ? r.document_read_status : undefined,
        pages: pageLabel(add.page_ranges),
        items: findings.map((f) => toItem(f as Record<string, unknown>)),
      };
    });
}

// ---------- 메인 ----------

const isUndeterminedItem = (i: FindingItem) => /판독\s*불가|판단\s*불가|미확인|미결정/.test(i.exposure_status);

export function parseJob(job: UpstageJob): AnalysisResult {
  const outputs = Array.isArray(job.output) ? job.output : [];
  const grading = findGradingStep(outputs);
  const extracts = readExtracts(outputs);

  const result: AnalysisResult = { fileGrade: null, summary: [], documents: [], notes: [] };

  // 안내문 초안: 등급산정 이후의 마지막 instruct 단계
  const instructs = outputs.filter(isInstruct);
  const last = instructs[instructs.length - 1];
  if (last && last !== grading) {
    const text = parseMaybeJson(firstText(last));
    if (typeof text === "string" && text.trim()) {
      result.draft = { title: last.model.replace(/^Instruct\s*-\s*/, ""), text: clean(text) };
    }
  }

  if (!grading) throw new Error("grading step not found");

  const mdRaw = parseMaybeJson(firstText(grading));
  const md = typeof mdRaw === "string" ? mdRaw : "";
  const additional = asObject<InstructAdditional>(parseMaybeJson(firstAdditional(grading))) ?? {};
  const sections = splitSections(md);

  // ① 전체 결과
  const { fields, overview } = parseSummary(sectionBy(sections, "①", "전체") ?? "");
  const gradeField = fields.find((f) => f.label.includes("등급"));
  result.fileGrade = toGrade(additional.enum) ?? toGrade(gradeField?.value);
  result.summary = fields.filter((f) => f !== gradeField);
  result.overview = overview;

  // ② 문서별 결과 (절을 못 찾으면 본문의 첫 표)
  const table = parseTable(sectionBy(sections, "②", "문서") ?? "") ?? parseTable(md);
  if (table) {
    const col = (...keys: string[]) => table.headers.findIndex((h) => keys.some((k) => h.includes(k)));
    const iName = col("문서");
    const iGrade = col("위험등급", "등급");
    const iRead = col("판독");
    const iReason = col("근거");
    const iPage = col("페이지");
    const used = new Set<number>();

    table.rows.forEach((row, idx) => {
      const name = row[iName >= 0 ? iName : 0] ?? "";
      let ex = extracts.find((e, j) => !used.has(j) && sameDocument(name, e.title));
      let exIndex = ex ? extracts.indexOf(ex) : -1;
      if (!ex && extracts.length === table.rows.length && !used.has(idx)) {
        ex = extracts[idx];
        exIndex = idx;
      }
      if (exIndex >= 0) used.add(exIndex);

      const items = ex?.items ?? [];
      const doc: DocumentResult = {
        name,
        grade: iGrade >= 0 ? toGrade(row[iGrade]) : null,
        fields: table.headers
          .map((label, i) => ({ label, value: row[i] ?? "" }))
          .filter((_, i) => i !== iName && i !== iGrade && i !== iReason && i !== iRead && i !== iPage),
        readStatus: (iRead >= 0 ? row[iRead] : undefined) || ex?.readStatus,
        reason: iReason >= 0 ? row[iReason] : undefined,
        pages: ex?.pages ?? (iPage >= 0 ? row[iPage] : undefined),
        items,
        undeterminedItems: items.filter(isUndeterminedItem),
      };
      if (iPage >= 0 && row[iPage]) doc.fields.push({ label: table.headers[iPage], value: row[iPage] });
      result.documents.push(doc);
    });

    // 위험도 높은 순 (같으면 응답 순서 유지)
    result.documents.sort(
      (a, b) => GRADE_RANK[b.grade?.level ?? "undetermined"] - GRADE_RANK[a.grade?.level ?? "undetermined"],
    );
  }

  // ③ 추가 확인 사항 + 마지막 안내 문장
  const { notes, disclaimer } = parseNotes(sectionBy(sections, "③", "추가", "확인"));
  result.notes = notes;
  result.disclaimer = disclaimer;

  if (!result.fileGrade && result.documents.length === 0) {
    result.unparsedText = clean(md);
    throw Object.assign(new Error("grading step unparsable"), { partial: result });
  }
  return result;
}

/** "원본 JSON 보기"용: 단계별 결과에서 원값·좌표·파싱 원문을 제거한다. */
export function sanitizeJob(job: UpstageJob) {
  return {
    id: job.id,
    status: job.status,
    model: job.model,
    usage: job.usage,
    steps: (job.output ?? []).map((o) => {
      const step = { name: o.model, type: o.step_type ?? null };
      if (o.step_type === "document-parse") return { ...step, result: "(원문 파싱 결과 생략)" };
      const texts = (o.content ?? []).map((c) => parseMaybeJson(c.text));
      if (o.step_type === "information-extract") {
        const r = asObject<ExtractResult>(texts[0]) ?? {};
        return {
          ...step,
          result: {
            document_title: r.document_title,
            document_read_status: r.document_read_status,
            sensitive_findings: (r.sensitive_findings ?? []).map((f) => toItem(f as Record<string, unknown>)),
          },
        };
      }
      return { ...step, result: texts.length === 1 ? texts[0] : texts };
    }),
  };
}
