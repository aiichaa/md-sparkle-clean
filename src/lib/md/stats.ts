export interface DocStats {
  words: number;
  characters: number;
  lines: number;
  readingMinutes: number;
}

const WORDS_PER_MINUTE = 220;

/** Cheap document statistics. Counts words in the raw Markdown (syntax chars are ignored). */
export function computeStats(text: string): DocStats {
  if (!text || text.trim() === "") {
    return { words: 0, characters: 0, lines: 0, readingMinutes: 0 };
  }
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length ?? 0;
  const characters = [...text].length;
  const lines = text.split(/\r\n|\r|\n/).length;
  const readingMinutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return { words, characters, lines, readingMinutes };
}

/** First ATX (`# Title`) or setext heading, used as the default download filename. */
export function extractTitle(text: string): string | null {
  const lines = text.split(/\r\n|\r|\n/);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const atx = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (atx) return stripInline(atx[1]) || null;
    const next = lines[i + 1];
    if (line.trim() && next && /^\s{0,3}(=+|-+)\s*$/.test(next) && !/^\s{0,3}[-*+]\s/.test(line)) {
      return stripInline(line.trim()) || null;
    }
  }
  return null;
}

function stripInline(s: string): string {
  return s
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();
}
