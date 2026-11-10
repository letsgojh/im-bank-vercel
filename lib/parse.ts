// Upstage Job 응답(include[]=all) → 화면용 AnalysisResult.
// 등급은 응답 값을 그대로 쓰고 다시 계산하지 않는다. 원값 필드는 여기서 버린다.

import type {
  AnalysisResult,
  DocumentResult,
  FindingItem,
  Grade,
  GradeLevel,
  Judgment,
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

function sameDocument(name: string, ref: string | undefined) {
  if (!ref) return false;
  const a = norm(name);
  const b = norm(ref);
  if (!a || !b) return false;
  const ba = base(a);
  const bb = base(b);
  return a === b || a.startsWith(bb) || b.startsWith(ba) || a.includes(bb) || b.includes(ba);
}

function pageLabel(ranges: [number, number][] | undefined) {
  if (!ranges?.length) return undefined;
  return ranges.map(([s, e]) => (s === e ? `${s}` : `${s}–${e}`)).join(", ") + "쪽";
}

/** 워크플로우가 나눈 문서 하나 (문서 분류 + 항목 추출 단계 기준) */
interface BaseDoc {
  title: string;
  classLabel?: string;
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

function readBaseDocs(outputs: UpstageOutputItem[]): BaseDoc[] {
  const labels = outputs
    .filter((o) => o.step_type === "document-classify")
    .flatMap((o) => (o.content ?? []).map((c) => (typeof c.text === "string" ? c.text.trim() : "")));
  const extracts = outputs.filter((o) => o.step_type === "information-extract" || /^Information Extract\b/i.test(o.model));
  return extracts.map((o, i) => {
    const r = asObject<ExtractResult>(parseMaybeJson(firstText(o))) ?? {};
    const add = asObject<ExtractAdditional>(parseMaybeJson(firstAdditional(o))) ?? {};
    const findings = Array.isArray(r.sensitive_findings) ? r.sensitive_findings : [];
    const title = typeof r.document_title === "string" ? r.document_title.trim() : "";
    return {
      title: title || labels[i] || o.model.replace(/^Information Extract\s*-\s*/, ""),
      classLabel: labels.length === extracts.length ? labels[i] : undefined,
      readStatus: typeof r.document_read_status === "string" ? r.document_read_status : undefined,
      pages: pageLabel(add.page_ranges),
      items: findings.map((f) => toItem(f as Record<string, unknown>)),
    };
  });
}

// ---------- 문서 조립 ----------

const isUndeterminedItem = (i: FindingItem) => /판독\s*불가|판단\s*불가|미확인|미결정/.test(i.exposure_status);
const isReadable = (s?: string) => !s || /^판독\s*가능$/.test(s.trim());

function highest(judgments: Judgment[]): Grade | null {
  let best: Grade | null = null;
  for (const j of judgments) {
    if (j.grade && (!best || GRADE_RANK[j.grade.level] > GRADE_RANK[best.level])) best = j.grade;
  }
  return best;
}

/** 판정 줄을 워크플로우 문서 단위로 묶는다. 같은 문서의 여러 줄은 한 문서의 세부 항목 판정이 된다. */
function assemble(baseDocs: BaseDoc[], rows: { docName: string; judgment: Judgment }[]): DocumentResult[] {
  const groups: { base?: BaseDoc; name: string; judgments: Judgment[] }[] = baseDocs.map((b) => ({
    base: b,
    name: b.title,
    judgments: [],
  }));
  for (const row of rows) {
    let g =
      groups.find((x) => x.base && (sameDocument(row.docName, x.base.title) || sameDocument(row.docName, x.base.classLabel))) ??
      groups.find((x) => !x.base && norm(x.name) === norm(row.docName));
    if (!g) {
      g = { name: row.docName, judgments: [] };
      groups.push(g);
    }
    // 표에 적힌 문서명이 있으면 그 이름을 화면에 쓴다(첫 줄 기준).
    if (g.judgments.length === 0 && row.docName) g.name = row.docName;
    g.judgments.push(row.judgment);
  }

  const docs = groups
    .filter((g) => g.judgments.length > 0 || (g.base?.items.length ?? 0) > 0)
    .map((g): DocumentResult => {
      const single = g.judgments.length === 1;
      const items = g.base?.items ?? [];
      const unreadable = g.judgments.find((j) => !isReadable(j.readStatus))?.readStatus;
      return {
        name: g.name,
        classLabel: g.base?.classLabel,
        grade: single ? g.judgments[0].grade : highest(g.judgments),
        gradeSource: single ? "response" : "highest-item",
        readStatus: unreadable ?? g.base?.readStatus ?? g.judgments[0]?.readStatus,
        reason: single ? g.judgments[0].reason : undefined,
        pages: g.base?.pages,
        judgments: [...g.judgments].sort(
          (a, b) => GRADE_RANK[b.grade?.level ?? "undetermined"] - GRADE_RANK[a.grade?.level ?? "undetermined"],
        ),
        items,
        undeterminedItems: items.filter(isUndeterminedItem),
      };
    });

  // 위험도 높은 순 (같으면 PDF 순서 유지)
  return docs.sort((a, b) => GRADE_RANK[b.grade?.level ?? "undetermined"] - GRADE_RANK[a.grade?.level ?? "undetermined"]);
}

// ---------- 등급산정 단계가 JSON으로 올 때 (계획서 [예상 구조]) ----------

const EN_LABEL: Record<string, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
  critical: "매우 높음",
  undetermined: "판단 불가",
};
const gradeOf = (v: unknown) => (typeof v === "string" ? toGrade(EN_LABEL[v.trim().toLowerCase()] ?? v) : null);
const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined);

function fromJson(obj: Record<string, unknown>, baseDocs: BaseDoc[], result: AnalysisResult) {
  result.fileGrade = gradeOf(obj.file_grade);
  const known = gradeOf(obj.file_known_max_grade);
  if (known && result.fileGrade?.level === "undetermined") result.summary.push({ label: "확인된 최소 등급", value: known.label });
  if (str(obj.file_undetermined_reason)) result.summary.push({ label: "등급 미확정 사유", value: str(obj.file_undetermined_reason)! });

  const rows: { docName: string; judgment: Judgment }[] = [];
  const docGrades = new Map<string, Grade | null>();
  for (const d of Array.isArray(obj.documents) ? obj.documents : []) {
    const doc = asObject<Record<string, unknown>>(d);
    if (!doc) continue;
    const docName = str(doc.doc_type) ?? str(doc.doc_id) ?? "";
    docGrades.set(docName, gradeOf(doc.doc_grade));
    for (const it of Array.isArray(doc.items) ? doc.items : []) {
      const item = asObject<Record<string, unknown>>(it);
      if (!item) continue;
      const page = str(asObject<Record<string, unknown>>(item.source)?.page);
      rows.push({
        docName,
        judgment: {
          item: str(item.item) ?? str(item.item_id) ?? "",
          grade: gradeOf(item.grade),
          masked_value: str(item.masked_value),
          exposure: str(item.exposure_state),
          location: page ? `${page}쪽` : undefined,
          reason: str(item.reason),
        },
      });
    }
  }
  const docs = assemble(baseDocs, rows);
  // JSON에는 문서 등급이 따로 있으므로 그 값을 그대로 쓴다.
  for (const doc of docs) {
    const key = [...docGrades.keys()].find((k) => sameDocument(doc.name, k));
    if (key !== undefined && docGrades.get(key)) {
      doc.grade = docGrades.get(key)!;
      doc.gradeSource = "response";
    }
  }
  result.documents = docs;
}

// ---------- 메인 ----------

export function parseJob(job: UpstageJob): AnalysisResult {
  const outputs = Array.isArray(job.output) ? job.output : [];
  const grading = findGradingStep(outputs);
  const baseDocs = readBaseDocs(outputs);

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

  const parsed = parseMaybeJson(firstText(grading));
  const additional = asObject<InstructAdditional>(parseMaybeJson(firstAdditional(grading))) ?? {};

  const asJson = asObject<Record<string, unknown>>(parsed);
  if (asJson && (Array.isArray(asJson.documents) || "file_grade" in asJson)) {
    fromJson(asJson, baseDocs, result);
    result.fileGrade ??= toGrade(additional.enum);
    return result;
  }

  const md = typeof parsed === "string" ? parsed : "";
  const sections = splitSections(md);

  // ① 전체 결과
  const { fields, overview } = parseSummary(sectionBy(sections, "①", "전체") ?? "");
  const gradeField = fields.find((f) => f.label.includes("등급"));
  result.fileGrade = toGrade(additional.enum) ?? toGrade(gradeField?.value);
  result.summary = fields.filter((f) => f !== gradeField);
  result.overview = overview;

  // ② 문서별 결과 표 (절을 못 찾으면 본문의 첫 표). 실행마다 한 줄이 "문서 하나"일 수도,
  //    "문서 안의 항목 묶음 하나"일 수도 있어서, 문서명으로 묶어 세부 판정으로 둔다.
  const table = parseTable(sectionBy(sections, "②", "문서") ?? "") ?? parseTable(md);
  if (table) {
    const col = (...keys: string[]) => table.headers.findIndex((h) => keys.some((k) => h.includes(k)));
    const at = (row: string[], i: number) => (i >= 0 ? row[i] || undefined : undefined);
    const iName = col("문서");
    const iItem = col("탐지", "항목");
    const iExposure = col("노출");
    const iGrade = col("위험등급", "등급");
    const iRead = col("판독");
    const iPage = col("페이지", "기재란", "위치");
    const iReason = col("근거");
    const rows = table.rows.map((row) => ({
      docName: row[iName >= 0 ? iName : 0] ?? "",
      judgment: {
        item: at(row, iItem) ?? "",
        grade: toGrade(at(row, iGrade)),
        exposure: at(row, iExposure),
        readStatus: at(row, iRead),
        location: at(row, iPage),
        reason: at(row, iReason),
      },
    }));
    result.documents = assemble(baseDocs, rows);
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
