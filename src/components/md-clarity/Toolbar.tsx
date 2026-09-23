import { useRef } from "react";
import {
  FileDown,
  Printer,
  Copy,
  Download,
  Upload,
  Trash2,
  Moon,
  Sun,
  Share2,
  BookOpen,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onDownloadPdf: () => void;
  onPreloadPdf: () => void;
  onPrint: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onClear: () => void;
  onImport: (file: File) => void;
  onShare: () => void;
  onSample: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  hasContent: boolean;
  pdfBusy: boolean;
}

export function Toolbar({
  onDownloadPdf,
  onPreloadPdf,
  onPrint,
  onCopy,
  onDownload,
  onClear,
  onImport,
  onShare,
  onSample,
  theme,
  onToggleTheme,
  hasContent,
  pdfBusy,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={onDownloadPdf}
        onPointerEnter={onPreloadPdf}
        onFocus={onPreloadPdf}
        size="sm"
        className="gap-1.5"
        disabled={!hasContent || pdfBusy}
      >
        {pdfBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <FileDown className="h-4 w-4" aria-hidden />
        )}
        Download PDF
      </Button>
      <Button
        onClick={onPrint}
        size="sm"
        variant="secondary"
        className="gap-1.5"
        disabled={!hasContent}
        title="Open the browser print dialog (choose “Save as PDF” for a pixel-perfect copy)"
      >
        <Printer className="h-4 w-4" aria-hidden /> Print
      </Button>
      <Button
        onClick={onCopy}
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={!hasContent}
        title="Copy the rendered document as rich text (Markdown source as plain-text fallback)"
      >
        <Copy className="h-4 w-4" aria-hidden /> Copy
      </Button>
      <Button
        onClick={onDownload}
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={!hasContent}
      >
        <Download className="h-4 w-4" aria-hidden /> Download .md
      </Button>
      <Button
        onClick={() => fileRef.current?.click()}
        size="sm"
        variant="outline"
        className="gap-1.5"
      >
        <Upload className="h-4 w-4" aria-hidden /> Import
      </Button>
      <Button
        onClick={onShare}
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={!hasContent}
        title="Copy a shareable link that loads this Markdown directly"
      >
        <Share2 className="h-4 w-4" aria-hidden /> Share link
      </Button>
      <Button onClick={onSample} size="sm" variant="ghost" className="gap-1.5">
        <BookOpen className="h-4 w-4" aria-hidden /> Sample
      </Button>
      <Button onClick={onClear} size="sm" variant="ghost" className="gap-1.5">
        <Trash2 className="h-4 w-4" aria-hidden /> Clear
      </Button>
      <div className="ml-auto">
        <Button
          onClick={onToggleTheme}
          size="sm"
          variant="ghost"
          aria-label="Toggle theme"
          className="gap-1.5"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" aria-hidden />
          ) : (
            <Moon className="h-4 w-4" aria-hidden />
          )}
          <span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"}</span>
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".md,.markdown,.mdown,.mkd,.txt,text/markdown,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImport(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
