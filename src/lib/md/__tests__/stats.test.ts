import { describe, it, expect } from "vitest";
import { computeStats, extractTitle } from "../stats";

describe("computeStats", () => {
  it("handles empty input", () => {
    expect(computeStats("  \n ")).toEqual({ words: 0, characters: 0, lines: 0, readingMinutes: 0 });
  });

  it("counts words, ignoring Markdown syntax", () => {
    const s = computeStats("# Hello world\n\n- **déjà** vu\n- l'été");
    expect(s.words).toBe(5);
    expect(s.lines).toBe(4);
    expect(s.readingMinutes).toBe(1);
  });
});

describe("extractTitle", () => {
  it("uses the first ATX heading", () => {
    expect(extractTitle("intro\n\n## Second\n# First")).toBe("Second");
    expect(extractTitle("# **Bold** [title](http://x) #")).toBe("Bold title");
  });

  it("supports setext headings", () => {
    expect(extractTitle("My Doc\n======\n\ntext")).toBe("My Doc");
  });

  it("ignores headings inside code fences", () => {
    expect(extractTitle("```\n# not a title\n```\n\n# Real")).toBe("Real");
  });

  it("returns null when there is no heading", () => {
    expect(extractTitle("just text")).toBeNull();
  });
});
