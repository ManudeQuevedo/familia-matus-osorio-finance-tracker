"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

import "sonner/dist/styles.css";

const MOBILE_MQ = "(max-width: 600px)";

const toastSurfaceStyle: CSSProperties = {
  background: "var(--bg-modal)",
  border: "1px solid var(--border-default)",
  borderRadius: "10px",
  color: "var(--text-primary)",
  fontSize: "14px",
  boxShadow: "var(--shadow-md)",
  padding: "12px 40px 12px 16px",
  gap: "8px",
  minWidth: "280px",
  maxWidth: "360px",
};

export function AppToaster() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <Toaster
      closeButton
      position={isMobile ? "top-center" : "bottom-right"}
      offset={
        isMobile
          ? undefined
          : {
              bottom: 80,
              right: 24,
            }
      }
      mobileOffset={
        isMobile
          ? {
              top: 12,
              left: 16,
              right: 16,
            }
          : undefined
      }
      icons={{
        success: null,
        error: null,
        warning: null,
        info: null,
      }}
      toastOptions={{
        duration: 4000,
        style: toastSurfaceStyle,
        classNames: {
          toast: "!items-start !w-auto",
          title:
            "!text-[14px] !font-medium !leading-snug !text-[var(--text-primary)] !p-0",
          description:
            "!text-[13px] !font-normal !leading-snug !text-[var(--text-muted)] !p-0",
          content: "!gap-1",
          actionButton:
            "!h-auto !min-h-0 !rounded-none !bg-transparent !px-0 !py-0 !text-[13px] !font-medium !text-[hsl(var(--accent))] !shadow-none hover:!bg-transparent hover:!opacity-90",
          cancelButton:
            "!h-auto !min-h-0 !rounded-none !bg-transparent !px-2 !py-0 !text-[13px] !font-medium !text-[var(--text-muted)] !shadow-none hover:!bg-transparent hover:!text-[var(--text-primary)]",
        },
      }}
    />
  );
}
