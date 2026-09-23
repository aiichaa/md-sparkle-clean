import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Maximize2, Minimize2, Copy, FileDown, HelpCircle, Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MdEditor } from "./MdEditor";
import { MarkdownPreview } from "./MarkdownPreview";
import { Toolbar } from "./Toolbar";
import { StatusBadge } from "./StatusBadge";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useTheme } from "@/hooks/use-theme";
import { computeStats, extractTitle } from "@/lib/md/stats";
import { exceedsLimit, MAX_BYTES, MAX_BYTES_LABEL } from "@/lib/md/limits";
import { downloadMarkdown } from "@/lib/md/download";
import { downloadPdf, preloadPdf } from "@/lib/md/pdf";
import { encodeShare, decodeShare, buildShareUrl, ShareTooLargeError } from "@/lib/md/share";
import { SAMPLE_MARKDOWN } from "@/lib/md/sample";

// Most browsers and proxies accept URLs up to ~8 KB; warn beyond that.
const SHARE_URL_SOFT_LIMIT = 8000;
const PREVIEW_DEBOUNCE_MS = 200;

export function MdClarityApp() {
  const { theme, toggle } = useTheme();
  const [input, setInput] = useState("");
  // Rendered text lags the editor slightly so large documents stay responsive.
  const [rendered, setRendered] = useState("");
  const [importedName, setImportedName] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const hasContent = input.trim() !== "";
  const title = useMemo(
    () => extractTitle(input) ?? importedName ?? "document",
    [input, importedName],
  );

  const handleInputChange = useCallback((v: string) => {
    if (exceedsLimit(v)) {
      toast.warning(`Input exceeds ${MAX_BYTES_LABEL}. Please shorten or split your document.`);
      return;
    }
    setInput(v);
  }, []);

  // Live preview on input change (debounced).
  useEffect(() => {
    const id = setTimeout(() => setRendered(input), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [input]);

  const stats = useMemo(() => computeStats(rendered), [rendered]);

  const handleDownloadPdf = useCallback(async () => {
    if (!hasContent || pdfBusy) return;
    setPdfBusy(true);
    const id = toast.loading("Generating PDF…");
    try {
      await downloadPdf(input, title);
      toast.success("PDF downloaded", { id });
    } catch (e) {
      console.error("[MD Clarity] PDF export failed:", e);
      toast.error("Could not generate the PDF — try Print → Save as PDF instead", { id });
    } finally {
      setPdfBusy(false);
    }
  }, [hasContent, pdfBusy, input, title]);

  const handlePrint = useCallback(() => {
    if (!hasContent) return;
    // Make sure the preview reflects the latest keystrokes before printing.
    setRendered(input);
    setFullscreen(false);
    // Print in light mode, and use the document title as the suggested PDF filename.
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    const prevTitle = document.title;
    const restore = () => {
      if (wasDark) root.classList.add("dark");
      document.title = prevTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    requestAnimationFrame(() => {
      root.classList.remove("dark");
      document.title = title;
      window.print();
    });
  }, [hasContent, input, title]);

  const handleCopy = useCallback(async () => {
    if (!hasContent) return;
    const html = previewRef.current?.innerHTML ?? "";
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([input], { type: "text/plain" }),
          }),
        ]);
        toast.success("Copied as rich text (Markdown as plain text)");
      } else {
        await navigator.clipboard.writeText(input);
        toast.success("Markdown copied to clipboard");
      }
    } catch {
      toast.error("Copy failed — clipboard unavailable");
    }
  }, [hasContent, input]);

  const handleDownload = useCallback(() => {
    if (!hasContent) return;
    downloadMarkdown(input, title);
  }, [hasContent, input, title]);

  const handleClear = useCallback(() => {
    setInput("");
    setRendered("");
    setImportedName(null);
  }, []);

  const handleSample = useCallback(() => {
    setInput(SAMPLE_MARKDOWN);
    setImportedName(null);
  }, []);

  const handleImport = useCallback((file: File) => {
    if (file.size > MAX_BYTES) {
      toast.warning(`File exceeds ${MAX_BYTES_LABEL}. Please choose a smaller file.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (exceedsLimit(text)) {
        toast.warning(`File contents exceed ${MAX_BYTES_LABEL}.`);
        return;
      }
      setInput(text);
      setImportedName(file.name.replace(/\.(md|markdown|mdown|mkd|txt)$/i, ""));
      toast.success(`Imported ${file.name}`);
    };
    reader.onerror = () => toast.error("Could not read file");
    reader.readAsText(file);
  }, []);

  // Load shared Markdown from URL hash on mount (#s=...).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash) return;
    const clean = () =>
      history.replaceState(null, "", window.location.pathname + window.location.search);
    decodeShare(hash)
      .then((text) => {
        if (text == null) return;
        setInput(text);
        toast.success("Loaded shared Markdown from link");
        // Clean the URL so the hash doesn't linger on subsequent edits.
        clean();
      })
      .catch((e) => {
        if (e instanceof ShareTooLargeError) {
          toast.warning(`Shared Markdown exceeds ${MAX_BYTES_LABEL}.`);
          clean();
        }
      });
  }, []);

  const handleShare = useCallback(async () => {
    if (!hasContent) {
      toast.message("Nothing to share yet");
      return;
    }
    try {
      const encoded = await encodeShare(input);
      const url = buildShareUrl(encoded);
      if (url.length > SHARE_URL_SOFT_LIMIT) {
        toast.warning(
          `Share link is ${url.length.toLocaleString()} characters — some apps may truncate it.`,
        );
      }
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Could not create share link");
    }
  }, [hasContent, input]);

  // Esc closes fullscreen.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const emptyPreview = (
    <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
      <p>Start typing Markdown on the left, import a file, or load the sample.</p>
      <Button size="sm" variant="outline" onClick={handleSample}>
        Load sample
      </Button>
    </div>
  );

  const outputHeader = (inOverlay: boolean) => (
    <div className="flex items-center justify-between gap-2 print:hidden">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Preview
      </label>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          disabled={!hasContent}
          className="h-7 gap-1.5 px-2 text-xs"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDownloadPdf}
          onPointerEnter={preloadPdf}
          disabled={!hasContent || pdfBusy}
          className="h-7 gap-1.5 px-2 text-xs"
        >
          {pdfBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <FileDown className="h-3.5 w-3.5" aria-hidden />
          )}
          PDF
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setFullscreen((f) => !f)}
          aria-label={inOverlay ? "Exit fullscreen" : "Enter fullscreen"}
          className="h-7 w-7 p-0"
        >
          {inOverlay ? (
            <Minimize2 className="h-4 w-4" aria-hidden />
          ) : (
            <Maximize2 className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={150}>
        <div className="flex min-h-screen flex-col bg-background text-foreground print:block print:min-h-0">
          <header className="border-b border-border print:hidden">
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
              <div
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground"
              >
                M↓
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                  MD Clarity
                </h1>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  Secure, fast, no-ads Markdown previewer & PDF exporter.
                </p>
              </div>
            </div>
          </header>

          <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 print:block print:max-w-none print:p-0">
            <div className="print:hidden">
              <Toolbar
                onDownloadPdf={handleDownloadPdf}
                onPreloadPdf={preloadPdf}
                onPrint={handlePrint}
                onCopy={handleCopy}
                onDownload={handleDownload}
                onClear={handleClear}
                onImport={handleImport}
                onShare={handleShare}
                onSample={handleSample}
                theme={theme}
                onToggleTheme={toggle}
                hasContent={hasContent}
                pdfBusy={pdfBusy}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <StatusBadge stats={stats} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="What do Download PDF and Print do?"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <HelpCircle className="h-4 w-4" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                  <p>
                    <strong>Preview updates automatically</strong> as you type.
                  </p>
                  <p className="mt-1">
                    <strong>Download PDF</strong> — builds a clean A4 PDF (selectable text,
                    highlighted code) directly in your browser and downloads it.
                  </p>
                  <p className="mt-1">
                    <strong>Print</strong> — opens the print dialog with the preview as shown;
                    choose “Save as PDF” for a pixel-perfect copy (keeps emoji and every script).
                  </p>
                </TooltipContent>
              </Tooltip>
              <p className="text-xs text-muted-foreground">
                Your Markdown is processed locally in your browser and is never uploaded.
              </p>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 print:block">
              <section className="flex min-h-[50vh] flex-col gap-2 md:min-h-[60vh] print:hidden">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Markdown
                </label>
                <div className="flex-1">
                  <MdEditor
                    value={input}
                    onChange={handleInputChange}
                    theme={theme}
                    ariaLabel="Markdown input editor"
                  />
                </div>
              </section>
              <section className="flex min-h-[50vh] flex-col gap-2 md:min-h-[60vh] print:block print:min-h-0">
                {outputHeader(false)}
                <div className="relative flex-1 print:static">
                  <div className="absolute inset-0 overflow-auto rounded-md border border-border bg-card px-5 py-4 sm:px-8 sm:py-6 print:static print:overflow-visible print:border-0 print:bg-transparent print:p-0">
                    {rendered.trim() ? (
                      <MarkdownPreview ref={previewRef} markdown={rendered} />
                    ) : (
                      emptyPreview
                    )}
                  </div>
                </div>
              </section>
            </div>
          </main>

          <footer className="border-t border-border print:hidden">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground sm:px-6">
              <span>MD Clarity — runs entirely in your browser.</span>
              <span>No tracking. No storage. No uploads.</span>
            </div>
          </footer>

          {fullscreen ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Markdown preview, fullscreen"
              className="fixed inset-0 z-50 flex flex-col gap-2 bg-background p-3 sm:p-4 print:hidden"
            >
              {outputHeader(true)}
              <div className="flex-1 overflow-auto rounded-md border border-border bg-card">
                <div className="mx-auto max-w-4xl px-5 py-6 sm:px-10 sm:py-10">
                  {rendered.trim() ? <MarkdownPreview markdown={rendered} /> : emptyPreview}
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Press <kbd className="rounded border border-border px-1">Esc</kbd> to close
              </p>
            </div>
          ) : null}

          <div className="print:hidden">
            <Toaster position="bottom-right" theme={theme} />
          </div>
        </div>
      </TooltipProvider>
    </ErrorBoundary>
  );
}
