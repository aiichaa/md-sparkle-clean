import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownPreview } from "../MarkdownPreview";

const render = (md: string) => renderToStaticMarkup(<MarkdownPreview markdown={md} />);

describe("MarkdownPreview", () => {
  it("renders GFM", () => {
    const html = render("# T\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] ok\n\n~~del~~");
    expect(html).toContain("<h1>T</h1>");
    expect(html).toContain("<table>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("<del>del</del>");
  });

  it("does not interpret raw HTML", () => {
    const html = render(
      '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\nx <b onclick="y">b</b>',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toMatch(/<img[^>]*onerror/);
    expect(html).not.toMatch(/<b onclick/);
  });

  it("neutralises dangerous links", () => {
    const html = render("[x](javascript:alert(1)) [y](data:text/html,hi) [z](vbscript:x)");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text/html");
    expect(html).not.toContain("vbscript:");
  });

  it("opens external links safely", () => {
    const html = render("[x](https://example.com)");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("blocks remote images but shows inline data images", () => {
    const remote = render("![pixel](https://tracker.example/p.gif)");
    expect(remote).not.toContain("tracker.example");
    expect(remote).toContain("remote image not loaded");
    const inline = render("![dot](data:image/png;base64,iVBORw0KGgo=)");
    expect(inline).toContain('src="data:image/png;base64,iVBORw0KGgo="');
  });

  it("highlights fenced code", () => {
    expect(render("```js\nconst a = 1;\n```")).toContain("hljs-keyword");
  });
});
