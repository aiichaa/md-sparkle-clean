// URL policy for rendered Markdown. The CSP (img-src 'self' data:, connect-src 'self')
// is the enforcement layer; these helpers keep the UI honest about what will load.

const SAFE_LINK = /^(https?:|mailto:|tel:)/i;

/** Links we render as clickable: http(s), mailto, tel, and in-page anchors. */
export function isSafeHref(href: string | null | undefined): href is string {
  if (!href) return false;
  const h = href.trim();
  return h.startsWith("#") || SAFE_LINK.test(h);
}

/** Only inline base64 images are displayed; remote images are blocked for privacy. */
export function isInlineImage(src: string | null | undefined): src is string {
  if (!src) return false;
  return /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(src.trim());
}

/** pdfmake only embeds PNG and JPEG. */
export function isPdfEmbeddableImage(src: string | null | undefined): src is string {
  if (!src) return false;
  return /^data:image\/(png|jpe?g);base64,/i.test(src.trim());
}
