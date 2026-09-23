import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root } from "mdast";

const processor = unified().use(remarkParse).use(remarkGfm);

/** Parse Markdown (CommonMark + GFM) into an mdast tree. Pure — no rendering, no HTML. */
export function parseMarkdown(text: string): Root {
  return processor.runSync(processor.parse(text)) as Root;
}
