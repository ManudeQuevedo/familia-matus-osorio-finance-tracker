import type { JSONContent } from "@tiptap/react";

export const EMPTY_TIPTAP_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function textToTiptapDoc(text: string): JSONContent {
  const trimmed = text.trim();
  if (!trimmed) return EMPTY_TIPTAP_DOC;
  const paragraphs = trimmed.split(/\n+/).map((line) => ({
    type: "paragraph" as const,
    content: line ? [{ type: "text" as const, text: line }] : undefined,
  }));
  return { type: "doc", content: paragraphs };
}

export function extractPlainText(
  json: JSONContent | null | undefined,
): string {
  if (!json) return "";
  const parts: string[] = [];

  const walk = (node: JSONContent) => {
    if (node.type === "text" && typeof node.text === "string") {
      parts.push(node.text);
    }
    if (node.type === "hardBreak") {
      parts.push("\n");
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
      if (
        node.type === "paragraph" ||
        node.type === "heading" ||
        node.type === "listItem" ||
        node.type === "taskItem"
      ) {
        parts.push("\n");
      }
    }
  };

  walk(json);
  return parts.join("").replace(/\n+/g, "\n").trim();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
