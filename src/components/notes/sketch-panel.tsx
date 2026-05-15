"use client";

import { Eraser, Pen, Pencil, Redo2, Trash2, Undo2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactSketchCanvasRef } from "react-sketch-canvas";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ReactSketchCanvas = dynamic(
  () => import("react-sketch-canvas").then((m) => m.ReactSketchCanvas),
  { ssr: false },
);

const COLORS = [
  { id: "black", value: "#18181b" },
  { id: "red", value: "#ef4444" },
  { id: "blue", value: "#3b82f6" },
  { id: "green", value: "#22c55e" },
  { id: "yellow", value: "#eab308" },
] as const;

export type SketchPanelProps = {
  initialSvg?: string | null;
  onExportReady?: (exportSvg: () => Promise<string>) => void;
  className?: string;
};

export function SketchPanel({
  initialSvg,
  onExportReady,
  className,
}: SketchPanelProps) {
  const t = useTranslations("Finance.notes.editor.sketch");
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const [tool, setTool] = useState<"pen" | "marker" | "eraser">("pen");
  const [color, setColor] = useState("#18181b");
  const [strokeWidth, setStrokeWidth] = useState(3);

  const exportSvg = useCallback(async () => {
    if (!canvasRef.current) return "";
    return canvasRef.current.exportSvg();
  }, []);

  useEffect(() => {
    onExportReady?.(exportSvg);
  }, [exportSvg, onExportReady]);

  const effectiveWidth =
    tool === "marker"
      ? Math.max(8, strokeWidth)
      : tool === "eraser"
        ? strokeWidth
        : Math.min(3, strokeWidth);

  const strokeColor = tool === "eraser" ? "#ffffff" : color;
  const canvasOpacity = tool === "marker" ? 0.4 : 1;

  return (
    <div
      className={cn(
        "border-b border-border-default",
        className,
      )}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border-subtle bg-bg-card-nested/80 px-2 py-2 dark:border-border-default dark:bg-bg-card-nested">
        <SketchToolButton
          active={tool === "pen"}
          label={t("pen")}
          onClick={() => setTool("pen")}>
          <Pen className="h-4 w-4" />
        </SketchToolButton>
        <SketchToolButton
          active={tool === "marker"}
          label={t("marker")}
          onClick={() => setTool("marker")}>
          <Pencil className="h-4 w-4" />
        </SketchToolButton>
        <SketchToolButton
          active={tool === "eraser"}
          label={t("eraser")}
          onClick={() => setTool("eraser")}>
          <Eraser className="h-4 w-4" />
        </SketchToolButton>

        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />

        {COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setColor(c.value);
              if (tool === "eraser") setTool("pen");
            }}
            className={cn(
              "h-6 w-6 rounded-full border-2 transition",
              color === c.value && tool !== "eraser"
                ? "border-zinc-900 dark:border-white"
                : "border-transparent",
            )}
            style={{ backgroundColor: c.value }}
            aria-label={c.id}
          />
        ))}

        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />

        <input
          type="range"
          min={1}
          max={20}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="h-8 w-24 accent-accent"
          aria-label={t("strokeWidth")}
        />

        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />

        <SketchToolButton
          label={t("undo")}
          onClick={() => void canvasRef.current?.undo()}>
          <Undo2 className="h-4 w-4" />
        </SketchToolButton>
        <SketchToolButton
          label={t("redo")}
          onClick={() => void canvasRef.current?.redo()}>
          <Redo2 className="h-4 w-4" />
        </SketchToolButton>
        <SketchToolButton
          label={t("clear")}
          onClick={() => void canvasRef.current?.clearCanvas()}>
          <Trash2 className="h-4 w-4" />
        </SketchToolButton>
      </div>

      <div className="relative h-[300px] md:h-[400px]">
        <ReactSketchCanvas
          ref={canvasRef}
          className="h-full w-full bg-bg-card"
          canvasColor="transparent"
          backgroundImage={initialSvg ?? undefined}
          exportWithBackgroundImage
          strokeColor={strokeColor}
          strokeWidth={effectiveWidth}
          style={{
            border: "none",
            width: "100%",
            height: "100%",
            opacity: canvasOpacity,
          }}
        />
      </div>
    </div>
  );
}

function SketchToolButton({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0",
            active && "bg-accent-muted text-accent",
          )}
          onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
