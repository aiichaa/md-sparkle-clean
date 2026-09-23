import { describe, it, expect } from "vitest";
import { sanitizeFilename } from "../download";

describe("sanitizeFilename", () => {
  it("defaults when empty", () => {
    expect(sanitizeFilename("")).toBe("document.md");
    expect(sanitizeFilename(null, "pdf")).toBe("document.pdf");
  });

  it("strips path traversal", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd.md");
  });

  it("removes unsafe characters", () => {
    expect(sanitizeFilename("my file<>?.md")).toBe("my_file_.md");
  });

  it("ensures the requested extension", () => {
    expect(sanitizeFilename("notes")).toBe("notes.md");
    expect(sanitizeFilename("notes.md")).toBe("notes.md");
    expect(sanitizeFilename("Notes.PDF", "pdf")).toBe("Notes.pdf");
    expect(sanitizeFilename("Project Handbook", "pdf")).toBe("Project_Handbook.pdf");
  });

  it("transliterates accents", () => {
    expect(sanitizeFilename("Réunion d'équipe", "pdf")).toBe("Reunion_d_equipe.pdf");
  });

  it("strips leading dots", () => {
    expect(sanitizeFilename(".hidden")).toBe("hidden.md");
  });

  it("caps length", () => {
    const out = sanitizeFilename("a".repeat(500), "pdf");
    expect(out.length).toBeLessThanOrEqual(124);
    expect(out.endsWith(".pdf")).toBe(true);
  });
});
