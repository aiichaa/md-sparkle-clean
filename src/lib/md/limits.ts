export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_BYTES_LABEL = "5 MB";

export function byteLength(text: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text).length;
  }
  // Fallback rough estimate
  return text.length;
}

export function exceedsLimit(text: string): boolean {
  return byteLength(text) > MAX_BYTES;
}
