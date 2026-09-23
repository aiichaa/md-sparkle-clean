import { forwardRef, memo } from "react";
import Markdown, { defaultUrlTransform, type Components, type UrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { ImageOff } from "lucide-react";
import { isInlineImage, isSafeHref } from "@/lib/md/urls";

// Rendering goes Markdown → mdast → hast → React elements. There is no innerHTML:
// raw HTML in the source is not interpreted (no rehype-raw), and react-markdown's
// default urlTransform strips javascript:/data: link targets.
const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [[rehypeHighlight, { detect: false }]] as never;

// Same as the default (which drops javascript:, data:, vbscript: …), except inline
// base64 images are kept for <img src> — they are local and can't run script in <img>.
const urlTransform: UrlTransform = (url, key) =>
  key === "src" && isInlineImage(url) ? url : defaultUrlTransform(url);

const components: Components = {
  a({ href, children, node: _node, ...props }) {
    if (!isSafeHref(href)) return <span>{children}</span>;
    if (href.startsWith("#")) {
      return (
        <a href={href} {...props}>
          {children}
        </a>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" {...props}>
        {children}
      </a>
    );
  },
  img({ src, alt, node: _node, ...props }) {
    const url = typeof src === "string" ? src : undefined;
    if (isInlineImage(url)) {
      return <img src={url} alt={alt ?? ""} loading="lazy" {...props} />;
    }
    return (
      <span
        className="md-blocked-image"
        title="Remote images are not loaded, to keep your document private. Inline base64 (data:) images are supported."
      >
        <ImageOff className="h-3.5 w-3.5" aria-hidden />
        {alt ? alt : "Image"} — remote image not loaded
      </span>
    );
  },
  table({ node: _node, ...props }) {
    return (
      <div className="md-table-wrap">
        <table {...props} />
      </div>
    );
  },
};

interface Props {
  markdown: string;
}

export const MarkdownPreview = memo(
  forwardRef<HTMLDivElement, Props>(function MarkdownPreview({ markdown }, ref) {
    return (
      <div
        ref={ref}
        className="md-preview prose prose-slate max-w-none dark:prose-invert prose-headings:scroll-mt-4 prose-a:text-blue-600 dark:prose-a:text-sky-400"
      >
        <Markdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          components={components}
          urlTransform={urlTransform}
        >
          {markdown}
        </Markdown>
      </div>
    );
  }),
);
