import { FileText, Circle } from "lucide-react";
import type { DocStats } from "@/lib/md/stats";

interface Props {
  stats: DocStats;
}

export function StatusBadge({ stats }: Props) {
  if (stats.characters === 0) {
    return (
      <div
        role="status"
        className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground"
      >
        <Circle className="h-3.5 w-3.5" aria-hidden />
        Empty
      </div>
    );
  }
  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <div
      role="status"
      className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
    >
      <FileText className="h-3.5 w-3.5" aria-hidden />
      {n(stats.words)} {stats.words === 1 ? "word" : "words"}
      <span className="font-normal text-emerald-700/90 dark:text-emerald-300/90">
        · {n(stats.lines)} {stats.lines === 1 ? "line" : "lines"} · ~{stats.readingMinutes} min read
      </span>
    </div>
  );
}
