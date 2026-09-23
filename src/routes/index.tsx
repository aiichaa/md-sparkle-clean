import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MD Clarity — Private Markdown Previewer & PDF Export" },
      {
        name: "description",
        content:
          "A fast, private, no-ads Markdown previewer. Render GitHub-flavored Markdown beautifully and download it as PDF — processed locally in your browser, never uploaded.",
      },
      { property: "og:title", content: "MD Clarity" },
      {
        property: "og:description",
        content:
          "Preview Markdown and export it to PDF locally in your browser. No tracking, no uploads.",
      },
      { property: "og:url", content: "/" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "MD Clarity" },
      {
        name: "twitter:description",
        content:
          "Preview Markdown and export it to PDF locally in your browser. No tracking, no uploads.",
      },
      { name: "theme-color", content: "#0f172a" },
    ],
    links: [
      { rel: "canonical", href: "/" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  component: Index,
});

function Index() {
  // Monaco's bundle imports .css and uses window — only load it on the client.
  const [App, setApp] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/components/md-clarity/MdClarityApp").then((mod) => {
      if (!cancelled) setApp(() => mod.MdClarityApp);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!App) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading MD Clarity…
      </div>
    );
  }
  return <App />;
}
