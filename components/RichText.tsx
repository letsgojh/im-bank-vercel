// 응답 텍스트(마크다운 일부: 제목, 목록, 표, 굵게)를 읽기 좋게 그린다. 내용은 바꾸지 않고 인용 표시(【†n】)만 지운다.

import { Fragment } from "react";

const stripCites = (s: string) => s.replace(/【†\d+】/g, "");

function Inline({ text }: { text: string }) {
  const parts = stripCites(text).split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-slate-900">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

type Block =
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

function toBlocks(src: string): Block[] {
  const lines = src.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("|")) {
      const tbl: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) tbl.push(lines[i++].trim());
      i--;
      const body = tbl.filter((l) => !/^\|\s*:?-{2,}/.test(l));
      if (body.length) blocks.push({ kind: "table", head: cells(body[0]), rows: body.slice(1).map(cells) });
      continue;
    }
    const li = line.match(/^[-*•]\s+(.*)$/);
    if (li) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "list") last.items.push(li[1]);
      else blocks.push({ kind: "list", items: [li[1]] });
      continue;
    }
    const h = line.match(/^#{1,6}\s+(.*)$/) ?? line.match(/^((?:\d+\.|[①-⑨])\s*.{1,40})$/);
    if (h && !/[.。]$/.test(h[1].replace(/\*\*/g, "").trim())) {
      blocks.push({ kind: "heading", text: h[1] });
      continue;
    }
    blocks.push({ kind: "para", text: line });
  }
  return blocks;
}

export function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-2.5 text-[14px] leading-7 text-slate-800">
      {toBlocks(text).map((b, i) => {
        if (b.kind === "heading")
          return (
            <h4 key={i} className="pt-1 text-[15px] font-bold text-slate-900">
              <Inline text={b.text.replace(/\*\*/g, "")} />
            </h4>
          );
        if (b.kind === "list")
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-gray-400">
              {b.items.map((it, k) => (
                <li key={k}>
                  <Inline text={it} />
                </li>
              ))}
            </ul>
          );
        if (b.kind === "table")
          return (
            <div key={i} className="overflow-x-auto border border-slate-300 print:overflow-visible">
              <table className="w-full min-w-[640px] text-left text-sm print:min-w-0">
                <thead className="bg-slate-100">
                  <tr>
                    {b.head.map((h, k) => (
                      <th key={k} className="whitespace-nowrap px-3 py-2.5 font-semibold text-gray-700">
                        <Inline text={h} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, k) => (
                    <tr key={k} className="border-t border-gray-100 align-top">
                      {r.map((c, j) => (
                        <td key={j} className="px-3 py-2.5 text-gray-800">
                          <Inline text={c} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        return (
          <p key={i}>
            <Inline text={b.text} />
          </p>
        );
      })}
    </div>
  );
}
