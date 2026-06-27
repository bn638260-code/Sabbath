"use client";

import { IconBrandWindows } from "@tabler/icons-react";
import { Button } from "./button";
import { windowsInstallerDownloadLinkProps } from "../../_lib/windows-installer-download";

export function DownloadButton({
  size = "md",
  className,
}: {
  size?: "md" | "lg";
  className?: string;
}) {
  // A single Windows installer is shipped for everyone, so the CTA is always
  // labelled for Windows rather than guessing the visitor's platform.
  // target="_self" + download keeps the click in the current tab so the
  // browser triggers a download instead of flashing a blank "_blank" tab.
  const downloadLink = windowsInstallerDownloadLinkProps();
  return (
    <Button
      href={downloadLink.href}
      target={downloadLink.target}
      download={downloadLink.download}
      variant="primary"
      size={size}
      className={className}
    >
      <IconBrandWindows size={16} aria-hidden stroke={2} />
      <span>Download for Windows</span>
    </Button>
  );
}
