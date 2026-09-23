# CLAUDE.md — MD Clarity

## Project

MD Clarity (repo: `md-sparkle-clean`) is a **client-side** Markdown previewer and PDF exporter built with TanStack Start + React 19 + Vite. All parsing, rendering and PDF generation happen in the browser. There is no backend API. The user-facing language is English.

It is a sibling of `json-sparkle-clean` (JSON Clarity) and shares that project's structure, UI shell and deployment model.

Deployment: self-hosted Docker behind a reverse proxy that terminates TLS, at https://md.aiichaa.com (nginx → `127.0.0.1:3140`). See README → Deployment.

## Commands

```sh
bun install
bun run dev              # Dev server
bun run build            # Build production (vite + Nitro node-server preset) → .output/
bun run lint             # ESLint
bunx vitest run          # Tests (jsdom; share.test.ts runs in node env)
docker compose up -d --build   # Build & run container (127.0.0.1:3140 → 3000)
```

Bun is not installed on the host. Run it through Docker:
`docker run --rm --user $(id -u):$(id -g) -v "$PWD":/app -w /app -e HOME=/tmp oven/bun:1-alpine bun <cmd>`

## Architecture

- **TanStack Start** (file-based routing + SSR). Single route: `src/routes/index.tsx`, which lazy-loads the app on the client (Monaco needs `window`). Root layout: `src/routes/__root.tsx`.
- **Vite config** wraps `@lovable.dev/vite-tanstack-config`. That wrapper bundles tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro, componentTagger, env injection and the `@` path alias. Do **not** add these manually, or the build breaks with duplicate plugins. Since wrapper 2.2x the build output lands in `.output/` (not `dist/`). The Dockerfile copies `.output`.
- **SSR entry** `src/server.ts` and **start init** `src/start.ts`: error-fallback wrappers, unchanged from JSON Clarity.
- **App** `src/components/md-clarity/`:
  - `MdClarityApp.tsx`: state, toolbar actions, debounced preview (200 ms), fullscreen, print, share, copy.
  - `MdEditor.tsx`: Monaco (markdown language), bundled locally.
  - `MarkdownPreview.tsx`: `react-markdown` + `remark-gfm` + `rehype-highlight`, with custom `a` / `img` / `table` components and a custom `urlTransform`.
- **Lib** `src/lib/md/`:
  - `parse.ts`: unified + remark-parse + remark-gfm → mdast.
  - `pdf-document.ts`: **pure** mdast → pdfmake document definition (headings, lists, task checkboxes drawn on canvas, tables, lowlight-coloured code, blockquotes, footnotes, anchors). Unit-tested.
  - `pdf.ts`: lazily imports `pdfmake/build/pdfmake` + Roboto + Courier font containers and triggers the download.
  - `share.ts`: gzip + base64url URL-fragment sharing, with a **decompression size cap** (zip-bomb guard).
  - `urls.ts`: link / image allow-lists. `download.ts`: filename sanitizing. `stats.ts`: word count + title extraction. `limits.ts`: 5 MB cap.
- **Styles** `src/styles.css`: `@tailwindcss/typography` (`prose`), `.md-preview` overrides, hljs token colours (light/dark), print stylesheet (`@page` A4).
- **UI primitives** `src/components/ui/`: shadcn/ui, pruned to what is used (`button`, `tooltip`, `sonner`). Add components back with the shadcn CLI; do not edit them manually.

## Points d'attention

- **No backend.** Don't introduce server-side data fetching, API routes, or any `fetch` to external services from the app. CSP is locked to `connect-src 'self'`.
- **No `createServerFn` in production.** TanStack Start auto-exposes every `createServerFn` via `/_serverFn/`. The project ships zero server functions.
- **Markdown rendering must stay non-HTML.** Never add `rehype-raw`, never use `dangerouslySetInnerHTML`, and keep the custom `urlTransform` (it only lets base64 images through, for `src`). Reading `innerHTML` for the rich-text Copy is fine. Writing it is not.
- **No remote images**, in the preview or the PDF. CSP `img-src 'self' data:` enforces it, `isInlineImage` / `isPdfEmbeddableImage` reflect it in the UI, and `setUrlAccessPolicy(() => false)` disables pdfmake URL fetches.
- **PDF fonts.** Roboto (Latin/Greek/Cyrillic) + standard Courier (WinAnsi only: `toWinAnsi` maps box-drawing chars, everything else → `?`). Emoji are stripped. Code lines are hard-wrapped at 92 columns (`wrapRuns`). Print → Save as PDF is the full-fidelity fallback.
- **Monaco workers / WASM.** CSP needs `worker-src 'self' blob:` and `wasm-unsafe-eval`. Monaco and pdfmake are bundled locally, **not** loaded from a CDN.
- **Security headers come from the reverse proxy** (`/etc/nginx/sites-available/md.aiichaa.com`), not the Node server. `public/_headers` is only for static hosts and is blocked at the proxy.
- **Supply chain.** `bunfig.toml` sets `minimumReleaseAge = 86400`. `package.json` `overrides` pins `dompurify` (pulled by monaco-editor) to a patched 3.4.x. Run `bun audit` after dependency changes. It should report 0 vulnerabilities.

## Style

- Tailwind CSS v4 + shadcn/ui primitives + typography plugin
- Icons: lucide-react
- Toasts: sonner
- Light/dark theme via Tailwind class strategy (print always renders light)
- Responsive (desktop + mobile)
