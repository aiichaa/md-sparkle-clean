export const SAMPLE_MARKDOWN = `# Project Handbook

Welcome to **MD Clarity** — a private Markdown previewer. Everything on this page is
rendered *locally in your browser*; nothing is uploaded.

## Text formatting

You can write **bold**, *italic*, ***both***, ~~strikethrough~~, and \`inline code\`.
Links work too: [TanStack Start](https://tanstack.com/start) or plain URLs like
https://commonmark.org. Accents and typography render correctly: « déjà vu », naïve café, Æsop — ça marche.

> **Tip:** Blockquotes are great for callouts.
> They can span several lines and contain *formatting*.

## Lists

1. Write your document
2. Preview it side by side
   - Nested bullet
   - Another one
3. Download it as **PDF** or **.md**

### Task list

- [x] Parse CommonMark + GFM
- [x] Syntax-highlight code blocks
- [ ] Take over the world

## Code

\`\`\`ts
// Code blocks are syntax highlighted (and keep their colours in the PDF).
export function greet(name: string): string {
  const time = new Date().getHours() < 12 ? "morning" : "day";
  return \`Good \${time}, \${name}!\`;
}
\`\`\`

\`\`\`bash
docker compose up -d --build   # build & run on 127.0.0.1:3140
\`\`\`

## Tables

| Feature           | Preview | PDF |
| :---------------- | :-----: | --: |
| Headings & text   |   Yes   | Yes |
| Tables (aligned)  |   Yes   | Yes |
| Task lists        |   Yes   | Yes |
| Footnotes[^1]     |   Yes   | Yes |

---

That's it. Replace this text with your own Markdown, or use **Import** to open a \`.md\` file.

[^1]: Footnotes are collected at the end of the document.
`;
