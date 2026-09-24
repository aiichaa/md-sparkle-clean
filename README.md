# MD Clarity

A secure, fast, no-ads Markdown previewer with PDF export. Runs entirely in your browser — your Markdown is never sent to a server.

Live: <https://md.aiichaa.com>

## Features

- Paste Markdown or import a `.md` / `.markdown` / `.txt` file (up to 5 MB)
- Live, pretty preview of CommonMark + GitHub-Flavored Markdown: tables (with alignment), task lists, strikethrough, autolinks, footnotes
- Syntax-highlighted code blocks (highlight.js, GitHub light/dark palettes)
- **Download PDF**: a clean A4 PDF built in the browser with pdfmake. Text stays selectable, code keeps its highlighting, and it has page numbers, clickable links and footnotes
- **Print**: the browser print dialog with a print stylesheet. Choose “Save as PDF” for a pixel-perfect copy of the preview
- Copy the rendered document as rich text (paste into Gmail, Docs, Notion…), with the Markdown as plain-text fallback
- Download the Markdown source (`.md`), filename derived from the first heading (sanitized)
- Share link: the document is gzip-compressed into the URL fragment (`#s=…`), which is never sent to the server
- Document stats (words, lines, reading time)
- Fullscreen preview (Esc to close), light / dark theme, responsive desktop & mobile layout
- Monaco-powered editor with Markdown syntax highlighting
- Floating “Support on Ko-fi” button (bottom-left): a plain link to [ko-fi.com/aiichaa](https://ko-fi.com/aiichaa). No third-party script, so the CSP is unchanged

### PDF export notes

- The direct PDF uses the embedded Roboto font (Latin, Greek, Cyrillic) and Courier for code. Emoji and scripts outside those fonts (CJK, Arabic…) are dropped or replaced with `?` in code blocks. Use **Print → Save as PDF** for those documents; it renders exactly what the preview shows.
- Only inline base64 PNG/JPEG images (`data:image/...`) are embedded. Remote images are never fetched.

## Privacy & Security

- **Local-only processing.** Parsing, rendering and PDF generation all happen in the browser. No backend endpoint receives your Markdown, and the app ships zero server functions.
- **No storage.** No database, no server logs of input/output. Only the theme choice is kept in `localStorage`.
- **No analytics.** No third-party tracking scripts.
- **Safe rendering.** Markdown → mdast → hast → React elements. There is no `innerHTML`, raw HTML in the source is displayed as text (no `rehype-raw`), and `javascript:`, `vbscript:` and `data:` link targets are stripped. External links open with `rel="noopener noreferrer nofollow"`.
- **No remote images.** Remote images are replaced with a placeholder, so a shared document can't be used as a tracking pixel. CSP `img-src 'self' data:` enforces this.
- **Zip-bomb-safe share links.** Decompression stops at 5 MB, so a crafted link can't expand to gigabytes and crash the tab.
- **5 MB input limit** to keep the UI responsive.
- **Sanitized download filenames** prevent path traversal.
- **pdfmake URL access is disabled** (`setUrlAccessPolicy(() => false)`) on top of CSP `connect-src 'self'`.
- **Error boundary** keeps the UI alive on unexpected exceptions.
- **Bundled locally.** Monaco and pdfmake (with fonts) are bundled; nothing loads from a CDN. pdfmake is loaded lazily on first PDF export.

## Install & Develop

```bash
bun install
bun run dev
```

## Test

```bash
bunx vitest run
```

## Build

```bash
bun run build
```

The build output is written to `.output/`:

- `.output/public/`: static client assets (JS, CSS, fonts, favicon)
- `.output/server/index.mjs`: Node HTTP server entry (Nitro `node-server` preset, configured in `vite.config.ts`)

You can override the preset at build time with the `NITRO_PRESET` env var (e.g. `NITRO_PRESET=cloudflare-module bun run build` for Cloudflare Workers).

## Deployment

### Docker (self-hosted)

The repo ships a `Dockerfile` and `docker-compose.yml`. The image builds with Bun and runs on Node 24 LTS as a non-root user. It serves SSR HTML and static assets through the Nitro Node server. The compose file hardens the container: read-only filesystem, all capabilities dropped, `no-new-privileges`, and memory/pids limits.

```bash
docker compose up -d --build
```

Defaults: container `mdclarity-frontend`, exposed on `127.0.0.1:3140`. Override with the `APP_NAME` / `APP_PORT` env vars.

For deployment behind nginx + Let's Encrypt on a subdomain, point the proxy at `127.0.0.1:3140`:

```nginx
server {
    listen 80;
    server_name md.example.com;

    location ~ /\. { deny all; return 404; }
    location = /_headers { deny all; return 404; }

    # security headers — see below

    location / {
        limit_req zone=general burst=50 nodelay;
        proxy_pass http://127.0.0.1:3140;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then run `certbot --nginx -d md.example.com` to provision TLS.

### Cloudflare Pages / Netlify

Build with `NITRO_PRESET=cloudflare-module bun run build` (or use the platform's TanStack Start preset). `public/_headers` ships with the recommended security headers, and Cloudflare Pages and Netlify apply it automatically.

### Security headers (nginx, SSR mode)

The Node SSR server doesn't emit these headers. Set them on the host nginx that terminates TLS for the subdomain:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
```

CSP notes:

- TanStack Start SSR emits inline `<script>` tags for hydration and the route manifest, so `script-src` needs `'unsafe-inline'`. The CSP still blocks external script origins, `eval`, framing, plugins and outbound connections (`connect-src 'self'`).
- Monaco's bundled WASM and web workers need `'wasm-unsafe-eval'` and `worker-src 'self' blob:`.
- `img-src 'self' data:` allows inline base64 images and blocks remote ones.
- pdfmake runs fine under this CSP: it needs no `eval`, and its fonts are embedded.

Serve over HTTPS (e.g. via Let's Encrypt) so HSTS takes effect.

## Dependencies

Minimal and reputable:

- React + TypeScript
- TanStack Router / Start (file-based routing, SSR-ready)
- Tailwind CSS v4 + `@tailwindcss/typography` + shadcn primitives
- [`@monaco-editor/react`](https://github.com/suren-atoyan/monaco-react) + `monaco-editor` (MIT, Microsoft)
- [`react-markdown`](https://github.com/remarkjs/react-markdown), `remark-gfm`, `rehype-highlight`, `unified`, `remark-parse`, `lowlight` (MIT, unified collective)
- [`pdfmake`](https://github.com/bpampuch/pdfmake) (MIT): client-side PDF generation
- `sonner` for toasts, `lucide-react` for icons

## License

MIT
