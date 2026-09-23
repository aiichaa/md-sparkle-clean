// @vitest-environment node
import { describe, it, expect } from "vitest";
import { gzipSync } from "node:zlib";
import { encodeShare, decodeShare, ShareTooLargeError } from "../share";

const toB64Url = (b: Uint8Array) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("share", () => {
  it("round-trips unicode Markdown", async () => {
    const md = "# Héllo « monde »\n\n- [x] done 🎉\n";
    const hash = await encodeShare(md);
    expect(hash.startsWith("s=")).toBe(true);
    expect(await decodeShare(`#${hash}`)).toBe(md);
  });

  it("returns null for foreign or corrupt hashes", async () => {
    expect(await decodeShare("#section-2")).toBeNull();
    expect(await decodeShare("#s=")).toBeNull();
    expect(await decodeShare("#s=not-gzip")).toBeNull();
  });

  it("refuses decompression bombs instead of expanding them", async () => {
    // 64 MB of zeros gzips to ~64 KB.
    const bomb = gzipSync(Buffer.alloc(64 * 1024 * 1024));
    const hash = `#s=${toB64Url(bomb)}`;
    await expect(decodeShare(hash, 1024 * 1024)).rejects.toBeInstanceOf(ShareTooLargeError);
  });
});
