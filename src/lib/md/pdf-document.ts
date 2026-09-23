// Converts an mdast tree into a pdfmake document definition.
// Pure data transform — no DOM, no network. Remote images are never passed to pdfmake.

import type {
  Root,
  RootContent,
  PhrasingContent,
  List,
  ListItem,
  Table,
  Code,
  Definition,
  FootnoteDefinition,
} from "mdast";
import type { Root as HastRoot, ElementContent } from "hast";
import { createLowlight, common } from "lowlight";
import { isPdfEmbeddableImage, isSafeHref } from "./urls";

// pdfmake's document model is loosely typed JSON; keep our own minimal shape.
export type PdfNode = string | { [key: string]: unknown } | PdfNode[];
export interface PdfDocDefinition {
  info: { title: string; creator: string; producer: string };
  pageSize: string;
  pageMargins: [number, number, number, number];
  content: PdfNode[];
  styles: Record<string, Record<string, unknown>>;
  defaultStyle: Record<string, unknown>;
  footer: (currentPage: number, pageCount: number) => PdfNode;
  pageBreakBefore: (current: { headlineLevel?: number }, followingOnPage: unknown[]) => boolean;
}

const PAGE_WIDTH = 595.28; // A4 in pt
const MARGIN_X = 52;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const CODE_FONT = "Courier";

const C = {
  text: "#0f172a",
  muted: "#475569",
  subtle: "#94a3b8",
  rule: "#e2e8f0",
  link: "#2563eb",
  codeBg: "#f6f8fa",
  inlineCodeBg: "#eef2f6",
  tableHeadBg: "#f1f5f9",
  quoteBar: "#cbd5e1",
};

// GitHub-light token colours keyed by highlight.js class.
const TOKEN_COLORS: Record<string, string> = {
  keyword: "#cf222e",
  doctag: "#cf222e",
  "template-tag": "#cf222e",
  "template-variable": "#cf222e",
  type: "#cf222e",
  title: "#8250df",
  attr: "#0550ae",
  attribute: "#0550ae",
  literal: "#0550ae",
  meta: "#0550ae",
  number: "#0550ae",
  operator: "#0550ae",
  variable: "#0550ae",
  "selector-attr": "#0550ae",
  "selector-class": "#0550ae",
  "selector-id": "#0550ae",
  section: "#0550ae",
  regexp: "#0a3069",
  string: "#0a3069",
  built_in: "#953800",
  symbol: "#953800",
  bullet: "#953800",
  comment: "#6e7781",
  code: "#6e7781",
  formula: "#6e7781",
  name: "#116329",
  quote: "#116329",
  "selector-tag": "#116329",
  "selector-pseudo": "#116329",
  addition: "#116329",
  deletion: "#82071e",
};

const lowlight = createLowlight(common);

// Emoji and pictographs aren't in the embedded Roboto font; strip them rather than
// print empty boxes. (Print → "Save as PDF" keeps them — see README.)
const PICTOGRAPHS = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|\u{FE0F}|\u{200D}|\u{20E3}/gu;
function cleanText(s: string): string {
  return s.replace(PICTOGRAPHS, "");
}

// The standard Courier font is WinAnsi-encoded (Latin-1 + CP1252 extras).
const WINANSI_EXTRA = new Set(
  "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split("").map((c) => c.codePointAt(0)!),
);
const CODE_FALLBACK: Record<string, string> = {
  "─": "-",
  "━": "-",
  "═": "=",
  "│": "|",
  "┃": "|",
  "║": "|",
  "├": "+",
  "┤": "+",
  "┬": "+",
  "┴": "+",
  "┼": "+",
  "└": "`",
  "┘": "'",
  "┌": ",",
  "┐": ",",
  "╭": ",",
  "╮": ",",
  "╰": "`",
  "╯": "'",
  "→": "->",
  "←": "<-",
  "⇒": "=>",
  "≤": "<=",
  "≥": ">=",
  "≠": "!=",
  "✓": "v",
  "✔": "v",
  "✗": "x",
  "✘": "x",
  " ": " ",
};
export function toWinAnsi(s: string): string {
  let out = "";
  for (const ch of s.replace(/\t/g, "    ")) {
    const cp = ch.codePointAt(0)!;
    if (
      cp === 10 ||
      (cp >= 0x20 && cp <= 0x7e) ||
      (cp >= 0xa1 && cp <= 0xff) ||
      WINANSI_EXTRA.has(cp)
    ) {
      out += ch;
    } else {
      out += CODE_FALLBACK[ch] ?? "?";
    }
  }
  return out;
}

interface Ctx {
  definitions: Map<string, Definition>;
  footnotes: Map<string, FootnoteDefinition>;
  footnoteOrder: string[];
  /** Heading destination ids, in document order (deduplicated like GitHub: foo, foo-1). */
  headingIds: string[];
  headingCursor: number;
  anchors: Set<string>;
}

interface InlineStyle {
  bold?: boolean;
  italics?: boolean;
  decoration?: string;
  color?: string;
  link?: string;
  linkToDestination?: string;
}

function inlines(nodes: PhrasingContent[], ctx: Ctx, style: InlineStyle = {}): PdfNode[] {
  const out: PdfNode[] = [];
  for (const node of nodes) out.push(...inline(node, ctx, style));
  return out;
}

function run(text: string, style: InlineStyle, extra: Record<string, unknown> = {}): PdfNode {
  return { text, ...style, ...extra };
}

function inline(node: PhrasingContent, ctx: Ctx, style: InlineStyle): PdfNode[] {
  switch (node.type) {
    case "text":
      return [run(cleanText(node.value), style)];
    case "strong":
      return inlines(node.children, ctx, { ...style, bold: true });
    case "emphasis":
      return inlines(node.children, ctx, { ...style, italics: true });
    case "delete":
      return inlines(node.children, ctx, { ...style, decoration: "lineThrough" });
    case "inlineCode":
      return [
        run(toWinAnsi(node.value), style, {
          font: CODE_FONT,
          fontSize: 9,
          background: C.inlineCodeBg,
        }),
      ];
    case "break":
      return ["\n"];
    case "link":
      return linkRuns(node.url, node.children, ctx, style);
    case "linkReference": {
      const def = ctx.definitions.get(node.identifier);
      if (def) return linkRuns(def.url, node.children, ctx, style);
      return inlines(node.children, ctx, style);
    }
    case "image":
    case "imageReference": {
      const alt = node.alt || "image";
      return [run(`[Image: ${cleanText(alt)}]`, { ...style, italics: true, color: C.subtle })];
    }
    case "footnoteReference": {
      const n = footnoteNumber(node.identifier, ctx);
      return [
        run(
          String(n),
          {
            ...style,
            color: C.link,
            ...(ctx.footnotes.has(node.identifier)
              ? { linkToDestination: `fn-${node.identifier}` }
              : {}),
          },
          { sup: true },
        ),
      ];
    }
    case "html":
      return [run(node.value, { ...style, color: C.subtle })];
    default:
      return [];
  }
}

function linkRuns(url: string, children: PhrasingContent[], ctx: Ctx, style: InlineStyle) {
  const next: InlineStyle = { ...style, color: C.link, decoration: "underline" };
  if (isSafeHref(url)) {
    if (!url.startsWith("#")) next.link = url;
    else if (ctx.anchors.has(url.slice(1))) next.linkToDestination = url.slice(1);
  }
  return inlines(children, ctx, next);
}

function footnoteNumber(id: string, ctx: Ctx): number {
  let idx = ctx.footnoteOrder.indexOf(id);
  if (idx === -1) {
    ctx.footnoteOrder.push(id);
    idx = ctx.footnoteOrder.length - 1;
  }
  return idx + 1;
}

function rule(margin: [number, number, number, number] = [0, 2, 0, 8], color = C.rule): PdfNode {
  return {
    canvas: [
      { type: "line", x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.75, lineColor: color },
    ],
    margin,
  };
}

function blocks(nodes: RootContent[], ctx: Ctx, tight = false): PdfNode[] {
  const out: PdfNode[] = [];
  for (const node of nodes) out.push(...block(node, ctx, tight));
  return out;
}

function block(node: RootContent, ctx: Ctx, tight: boolean): PdfNode[] {
  switch (node.type) {
    case "heading": {
      const h: PdfNode[] = [
        {
          text: inlines(node.children, ctx),
          style: `h${node.depth}`,
          headlineLevel: node.depth,
          id: ctx.headingIds[ctx.headingCursor++],
        },
      ];
      if (node.depth <= 2) h.push(rule());
      return h;
    }
    case "paragraph": {
      const onlyImages = node.children.every(
        (c) => c.type === "image" || (c.type === "text" && c.value.trim() === ""),
      );
      if (onlyImages && node.children.some((c) => c.type === "image")) {
        return node.children.flatMap((c) => (c.type === "image" ? imageBlock(c.url, c.alt) : []));
      }
      return [{ text: inlines(node.children, ctx), style: tight ? "pTight" : "p" }];
    }
    case "thematicBreak":
      return [rule([0, 8, 0, 12])];
    case "blockquote":
      return [
        {
          table: { widths: ["*"], body: [[{ stack: blocks(node.children, ctx), color: C.muted }]] },
          layout: "mdQuote",
          margin: [0, 2, 0, 10],
        },
      ];
    case "code":
      return [codeBlock(node)];
    case "list":
      return [list(node, ctx)];
    case "table":
      return [table(node, ctx)];
    case "html":
      return [{ text: node.value, style: "p", color: C.subtle }];
    case "definition":
    case "footnoteDefinition":
      return [];
    default:
      return [];
  }
}

function plainText(nodes: PhrasingContent[]): string {
  return nodes
    .map((c) => ("value" in c ? c.value : "children" in c ? plainText(c.children) : ""))
    .join("");
}

function slugify(children: PhrasingContent[]): string {
  const text = plainText(children)
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
  return text || "section";
}

function imageBlock(url: string, alt?: string | null): PdfNode[] {
  if (isPdfEmbeddableImage(url)) {
    return [{ image: url, fit: [CONTENT_WIDTH, 560], margin: [0, 4, 0, 10] }];
  }
  return [
    {
      text: `[Image: ${cleanText(alt || "image")}]`,
      italics: true,
      color: C.subtle,
      style: "p",
    },
  ];
}

function codeBlock(node: Code): PdfNode {
  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            text: highlight(node.value, node.lang),
            font: CODE_FONT,
            fontSize: 8.5,
            lineHeight: 1.2,
            preserveLeadingSpaces: true,
            color: "#1f2328",
          },
        ],
      ],
    },
    layout: "mdCode",
    margin: [0, 2, 0, 10],
  };
}

// Courier is 0.6 em wide: at 8.5pt that's ~92 columns inside the code box. pdfmake only
// wraps at spaces, so long tokens would overflow — hard-wrap them ourselves.
export const CODE_COLUMNS = 92;

type Run = string | { text: string; color?: string };

export function wrapRuns(runs: Run[], columns = CODE_COLUMNS): Run[] {
  const out: Run[] = [];
  let col = 0;
  for (const r of runs) {
    const text = typeof r === "string" ? r : r.text;
    let chunk = "";
    for (const ch of text) {
      if (ch === "\n") {
        chunk += ch;
        col = 0;
        continue;
      }
      if (col >= columns) {
        chunk += "\n";
        col = 0;
      }
      chunk += ch;
      col++;
    }
    out.push(typeof r === "string" ? chunk : { ...r, text: chunk });
  }
  return out;
}

export function highlight(code: string, lang?: string | null): Run[] {
  const value = toWinAnsi(code);
  if (!lang || !lowlight.registered(lang)) return wrapRuns([value]);
  let tree: HastRoot;
  try {
    tree = lowlight.highlight(lang, value);
  } catch {
    return wrapRuns([value]);
  }
  const out: Run[] = [];
  const walk = (nodes: ElementContent[], color?: string) => {
    for (const n of nodes) {
      if (n.type === "text") out.push(color ? { text: n.value, color } : n.value);
      else if (n.type === "element") {
        const classes = (n.properties?.className as string[] | undefined) ?? [];
        const token = classes.find((c) => c.startsWith("hljs-"))?.slice(5);
        walk(n.children, (token && TOKEN_COLORS[token]) || color);
      }
    }
  };
  walk(tree.children as ElementContent[]);
  return wrapRuns(out);
}

function checkbox(checked: boolean): PdfNode {
  const box = {
    type: "rect",
    x: 0,
    y: 2.5,
    w: 8,
    h: 8,
    r: 1.5,
    lineWidth: 0.8,
    lineColor: checked ? C.link : "#64748b",
    ...(checked ? { color: C.link } : {}),
  };
  const tick = {
    type: "polyline",
    lineWidth: 1.2,
    lineColor: "#ffffff",
    points: [
      { x: 1.8, y: 6.6 },
      { x: 3.4, y: 8.3 },
      { x: 6.4, y: 4.4 },
    ],
  };
  return { canvas: checked ? [box, tick] : [box], width: 10 };
}

function listItem(item: ListItem, ctx: Ctx, spread: boolean): PdfNode {
  const tight = !spread;
  const first = item.children[0];
  const body: PdfNode =
    item.children.length === 1 && first?.type === "paragraph"
      ? { text: inlines(first.children, ctx), style: tight ? "pTight" : "p" }
      : { stack: blocks(item.children, ctx, tight) };
  if (typeof item.checked === "boolean") {
    return {
      columns: [checkbox(item.checked), { width: "*", stack: [body] }],
      columnGap: 4,
      listType: "none",
    };
  }
  return body;
}

function list(node: List, ctx: Ctx): PdfNode {
  const spread = !!node.spread || node.children.some((c) => c.spread);
  const items = node.children.map((c) => listItem(c, ctx, spread));
  const base = { margin: [0, 0, 0, 8], markerColor: C.muted };
  return node.ordered ? { ...base, ol: items, start: node.start ?? 1 } : { ...base, ul: items };
}

function table(node: Table, ctx: Ctx): PdfNode {
  const cols = Math.max(...node.children.map((r) => r.children.length), 1);
  const align = (i: number) => node.align?.[i] ?? "left";
  const body = node.children.map((row, r) =>
    Array.from({ length: cols }, (_, i) => {
      const cell = row.children[i];
      return {
        text: cell ? inlines(cell.children, ctx) : "",
        bold: r === 0,
        alignment: align(i) ?? "left",
        fillColor: r === 0 ? C.tableHeadBg : undefined,
      };
    }),
  );
  return {
    table: { headerRows: 1, widths: Array(cols).fill("*"), body, dontBreakRows: true },
    layout: "mdTable",
    fontSize: 9.5,
    margin: [0, 2, 0, 12],
  };
}

function footnoteSection(ctx: Ctx): PdfNode[] {
  // Footnotes may reference other footnotes; iterate the order list as it grows.
  const items: PdfNode[] = [];
  for (let i = 0; i < ctx.footnoteOrder.length; i++) {
    const id = ctx.footnoteOrder[i];
    const def = ctx.footnotes.get(id);
    if (!def) continue;
    items.push({
      columns: [
        { text: `${i + 1}.`, width: 16, color: C.muted },
        { width: "*", stack: blocks(def.children, ctx, true) },
      ],
      id: `fn-${id}`,
      fontSize: 9,
      margin: [0, 0, 0, 2],
    });
  }
  if (!items.length) return [];
  return [rule([0, 16, 0, 6]), ...items];
}

function collect(tree: Root, ctx: Ctx) {
  const seen = new Map<string, number>();
  const visit = (nodes: RootContent[]) => {
    for (const n of nodes) {
      if (n.type === "definition") ctx.definitions.set(n.identifier, n);
      else if (n.type === "footnoteDefinition") {
        ctx.footnotes.set(n.identifier, n);
        ctx.anchors.add(`fn-${n.identifier}`);
      } else if (n.type === "heading") {
        const base = slugify(n.children);
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const id = count ? `${base}-${count}` : base;
        ctx.headingIds.push(id);
        ctx.anchors.add(id);
      }
      if ("children" in n && Array.isArray(n.children)) visit(n.children as RootContent[]);
    }
  };
  visit(tree.children);
}

export function buildPdfDocument(tree: Root, title: string): PdfDocDefinition {
  const ctx: Ctx = {
    definitions: new Map(),
    footnotes: new Map(),
    footnoteOrder: [],
    headingIds: [],
    headingCursor: 0,
    anchors: new Set(),
  };
  collect(tree, ctx);
  const content = blocks(tree.children, ctx);
  content.push(...footnoteSection(ctx));

  return {
    info: { title, creator: "MD Clarity", producer: "MD Clarity (pdfmake)" },
    pageSize: "A4",
    pageMargins: [MARGIN_X, 56, MARGIN_X, 56],
    content,
    defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.3, color: C.text },
    styles: {
      h1: { fontSize: 21, bold: true, margin: [0, 14, 0, 4] },
      h2: { fontSize: 16.5, bold: true, margin: [0, 14, 0, 4] },
      h3: { fontSize: 13.5, bold: true, margin: [0, 12, 0, 4] },
      h4: { fontSize: 12, bold: true, margin: [0, 10, 0, 3] },
      h5: { fontSize: 11, bold: true, margin: [0, 8, 0, 3] },
      h6: { fontSize: 10.5, bold: true, color: C.muted, margin: [0, 8, 0, 3] },
      p: { margin: [0, 0, 0, 8] },
      pTight: { margin: [0, 0, 0, 2] },
    },
    footer: (currentPage, pageCount) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: "center",
      fontSize: 8,
      color: C.subtle,
      margin: [0, 20, 0, 0],
    }),
    // Never leave a heading stranded at the bottom of a page.
    pageBreakBefore: (current, followingOnPage) =>
      !!current.headlineLevel && followingOnPage.length === 0,
  };
}

/** Custom table layouts registered with pdfmake (see pdf.ts). */
export const TABLE_LAYOUTS = {
  mdCode: {
    fillColor: () => C.codeBg,
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => C.rule,
    vLineColor: () => C.rule,
    paddingLeft: () => 8,
    paddingRight: () => 8,
    paddingTop: () => 7,
    paddingBottom: () => 7,
  },
  mdQuote: {
    hLineWidth: () => 0,
    vLineWidth: (i: number) => (i === 0 ? 3 : 0),
    vLineColor: () => C.quoteBar,
    paddingLeft: () => 10,
    paddingRight: () => 0,
    paddingTop: () => 2,
    paddingBottom: () => 2,
  },
  mdTable: {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => C.rule,
    vLineColor: () => C.rule,
    paddingLeft: () => 6,
    paddingRight: () => 6,
    paddingTop: () => 4,
    paddingBottom: () => 4,
  },
};
