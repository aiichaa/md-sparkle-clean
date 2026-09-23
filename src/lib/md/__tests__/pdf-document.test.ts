import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../parse";
import { buildPdfDocument, toWinAnsi, wrapRuns, highlight } from "../pdf-document";
import { SAMPLE_MARKDOWN } from "../sample";

const build = (md: string) => buildPdfDocument(parseMarkdown(md), "Test");
const json = (md: string) => JSON.stringify(build(md).content);

describe("buildPdfDocument", () => {
  it("builds the sample document", () => {
    const doc = build(SAMPLE_MARKDOWN);
    expect(doc.info.title).toBe("Test");
    expect(doc.content.length).toBeGreaterThan(10);
    const s = JSON.stringify(doc.content);
    expect(s).toContain('"style":"h1"');
    expect(s).toContain('"layout":"mdTable"');
    expect(s).toContain('"layout":"mdCode"');
    expect(s).toContain('"ol"');
  });

  it("never hands remote images to pdfmake", () => {
    const s = json(
      "![tracker](https://evil.example/p.png)\n\n![x][ref]\n\n[ref]: http://e.x/a.png",
    );
    expect(s).not.toContain('"image"');
    expect(s).toContain("[Image: tracker]");
  });

  it("embeds inline PNG data images", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(json(`![dot](${png})`)).toContain(`"image":"${png}"`);
  });

  it("only links safe URLs", () => {
    const s = json("[a](javascript:alert(1)) [b](https://ok.example) [c](#missing)");
    expect(s).not.toContain("javascript:");
    expect(s).toContain('"link":"https://ok.example"');
    expect(s).not.toContain("linkToDestination");
  });

  it("links in-page anchors to deduplicated heading ids", () => {
    const s = json("# Intro\n\n# Intro\n\n[go](#intro-1)");
    expect(s).toContain('"id":"intro"');
    expect(s).toContain('"id":"intro-1"');
    expect(s).toContain('"linkToDestination":"intro-1"');
  });

  it("renders task list checkboxes and footnotes", () => {
    const s = json("- [x] done\n- [ ] todo\n\nText[^n]\n\n[^n]: The note.");
    expect(s).toContain('"listType":"none"');
    expect(s).toContain('"sup":true');
    expect(s).toContain('"id":"fn-n"');
    expect(s).toContain("The note.");
  });

  it("keeps raw HTML inert (as plain text)", () => {
    const s = json('<script>alert(1)</script>\n\nhi <b onclick="x">b</b>');
    expect(s).toContain("<script>alert(1)</script>");
  });
});

describe("code helpers", () => {
  it("maps non-WinAnsi characters for the Courier font", () => {
    expect(toWinAnsi("├── a\t→ é €")).toBe("+-- a    -> é €");
    expect(toWinAnsi("日本")).toBe("??");
  });

  it("hard-wraps long code lines", () => {
    const out = wrapRuns(["abcdef", { text: "ghij", color: "red" }], 4);
    expect(out).toEqual(["abcd\nef", { text: "gh\nij", color: "red" }]);
  });

  it("highlights known languages with colours", () => {
    const runs = highlight("const x = 1;", "ts");
    expect(runs.some((r) => typeof r !== "string" && r.color)).toBe(true);
    expect(highlight("plain", "nope-lang")).toEqual(["plain"]);
  });
});
