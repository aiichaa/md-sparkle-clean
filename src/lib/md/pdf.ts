// Client-side PDF export. pdfmake (+ its embedded Roboto font) is ~2 MB, so it is
// loaded lazily on first use and bundled locally — never fetched from a CDN.

import { parseMarkdown } from "./parse";
import { buildPdfDocument, TABLE_LAYOUTS } from "./pdf-document";
import { sanitizeFilename } from "./download";

interface PdfMakeOutput {
  download: (filename?: string) => Promise<void>;
}
interface PdfMakeInstance {
  createPdf: (doc: unknown) => PdfMakeOutput;
  addFontContainer: (container: unknown) => void;
  addTableLayouts: (layouts: unknown) => void;
  setUrlAccessPolicy: (cb: (url: string) => boolean) => void;
}

let pdfMakePromise: Promise<PdfMakeInstance> | undefined;

function interop<T>(mod: unknown): T {
  const m = mod as { default?: unknown };
  return (m && m.default ? m.default : mod) as T;
}

async function loadPdfMake(): Promise<PdfMakeInstance> {
  if (!pdfMakePromise) {
    pdfMakePromise = (async () => {
      const [pdfMakeMod, roboto, courier] = await Promise.all([
        import("pdfmake/build/pdfmake"),
        import("pdfmake/build/fonts/Roboto"),
        import("pdfmake/build/standard-fonts/Courier"),
      ]);
      const pdfMake = interop<PdfMakeInstance>(pdfMakeMod);
      pdfMake.addFontContainer(interop(roboto));
      pdfMake.addFontContainer(interop(courier));
      pdfMake.addTableLayouts(TABLE_LAYOUTS);
      // Defense in depth: pdfmake can fetch images by URL. We only ever pass data: URIs,
      // but deny every URL fetch outright (CSP connect-src 'self' would block it too).
      pdfMake.setUrlAccessPolicy(() => false);
      return pdfMake;
    })().catch((e) => {
      pdfMakePromise = undefined;
      throw e;
    });
  }
  return pdfMakePromise;
}

/** Warm the PDF engine in the background (e.g. on hover) so the first click is fast. */
export function preloadPdf(): void {
  void loadPdfMake().catch(() => {});
}

export async function downloadPdf(markdown: string, title: string): Promise<void> {
  const pdfMake = await loadPdfMake();
  const doc = buildPdfDocument(parseMarkdown(markdown), title);
  await pdfMake.createPdf(doc).download(sanitizeFilename(title, "pdf"));
}
