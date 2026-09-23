const DEFAULT_BASE = "document";
const MAX = 120;

/**
 * Sanitize a filename for safe download.
 * - Strips path separators and control chars
 * - Allows letters, digits, dash, underscore, dot
 * - Caps length
 * - Ensures the given extension (e.g. "md", "pdf")
 */
export function sanitizeFilename(name: string | undefined | null, ext = "md"): string {
  const suffix = `.${ext}`;
  const fallback = `${DEFAULT_BASE}${suffix}`;
  if (!name) return fallback;
  let base = name.trim();
  // Take last path segment to drop traversal
  const segments = base.split(/[\\/]+/).filter(Boolean);
  base = segments.length ? segments[segments.length - 1] : "";
  // Strip control characters
  // eslint-disable-next-line no-control-regex
  base = base.replace(/[\x00-\x1f\x7f]/g, "");
  // Transliterate accents (é → e) before the whitelist so titles stay readable
  base = base.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  // Allow only safe characters
  base = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Prevent leading dots (hidden files / traversal)
  base = base.replace(/^[._]+/, "");
  // Collapse repeated underscores, drop trailing separators
  base = base.replace(/_{2,}/g, "_").replace(/[._-]+$/, "");
  if (!base) return fallback;
  // Drop the extension if already present (case-insensitive), then cap length
  if (base.toLowerCase().endsWith(suffix)) base = base.slice(0, -suffix.length);
  if (base.length > MAX) base = base.slice(0, MAX);
  if (!base) return fallback;
  return `${base}${suffix}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so download starts
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadMarkdown(content: string, filename?: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, sanitizeFilename(filename, "md"));
}
