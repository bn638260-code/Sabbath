"use client";

import { IconBrandWindows } from "@tabler/icons-react";
import { Button } from "./button";
import { SITE } from "../../_lib/site";

export function DownloadButton({
  size = "md",
  className,
}: {
  size?: "md" | "lg";
  className?: string;
}) {
  // A single Windows installer is shipped for everyone, so the CTA is always
  // labelled for Windows rather than guessing the visitor's platform.
  return (
    <Button
      href={SITE.repo.download}
      variant="primary"
      size={size}
      className={className}
    >
      <IconBrandWindows size={16} aria-hidden stroke={2} />
      <span>Download for Windows</span>
    </Button>
  );
}
