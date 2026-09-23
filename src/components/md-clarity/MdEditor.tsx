import Editor, { loader, type OnMount } from "@monaco-editor/react";
import * as monacoNs from "monaco-editor";

// Bundle Monaco locally — never load from CDN. Keeps CSP connect-src 'self' valid.
loader.config({ monaco: monacoNs });

interface MdEditorProps {
  value: string;
  onChange?: (v: string) => void;
  theme: "light" | "dark";
  ariaLabel: string;
}

export function MdEditor({ value, onChange, theme, ariaLabel }: MdEditorProps) {
  const handleMount: OnMount = (editor) => {
    editor.getDomNode()?.setAttribute("aria-label", ariaLabel);
  };

  return (
    <div className="h-full w-full overflow-hidden rounded-md border border-border bg-card">
      <Editor
        height="100%"
        language="markdown"
        value={value}
        theme={theme === "dark" ? "vs-dark" : "vs"}
        onChange={(v) => onChange?.(v ?? "")}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: "on",
          tabSize: 2,
          renderWhitespace: "selection",
          smoothScrolling: true,
          padding: { top: 12, bottom: 12 },
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
          quickSuggestions: false,
          unicodeHighlight: { ambiguousCharacters: false },
        }}
        loading={
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading editor…
          </div>
        }
      />
    </div>
  );
}
