// Hash-based sharing: encode Markdown text into a URL fragment using gzip + base64url.
// 100% client-side — nothing is uploaded (URL fragments are never sent to the server).

import { MAX_BYTES } from "./limits";

const PREFIX = "s=";

export class ShareTooLargeError extends Error {
  constructor() {
    super("Shared content exceeds the size limit");
    this.name = "ShareTooLargeError";
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(b64: string): Uint8Array {
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const std = b64.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(std);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Pipe bytes through a (de)compression stream, aborting once the output exceeds
 * `maxBytes`. The cap matters on decode: a tiny gzip payload in a crafted link can
 * expand to gigabytes ("zip bomb") and crash the tab before any size check runs.
 */
async function pipe(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
  maxBytes = Infinity,
): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ShareTooLargeError();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export async function encodeShare(text: string): Promise<string> {
  const raw = new TextEncoder().encode(text);
  const compressed = await pipe(raw, new CompressionStream("gzip"));
  return PREFIX + bytesToBase64Url(compressed);
}

/**
 * Returns the decoded text, or null if the hash isn't a valid share payload.
 * Throws ShareTooLargeError if the decompressed payload exceeds `maxBytes`.
 */
export async function decodeShare(hash: string, maxBytes = MAX_BYTES): Promise<string | null> {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.startsWith(PREFIX)) return null;
  const b64 = raw.slice(PREFIX.length);
  if (!b64) return null;
  try {
    const bytes = base64UrlToBytes(b64);
    const decompressed = await pipe(bytes, new DecompressionStream("gzip"), maxBytes);
    return new TextDecoder().decode(decompressed);
  } catch (e) {
    if (e instanceof ShareTooLargeError) throw e;
    return null;
  }
}

export function buildShareUrl(encodedHash: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${encodedHash}`;
}
