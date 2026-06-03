import Image from "next/image";

import { cn } from "../../_lib/utils";
import { APP_DISPLAY_NAME } from "../../_lib/app-brand";

const HEIGHT_CLASS = {
  sm: "h-7",
  md: "h-10",
  lg: "h-12",
} as const;

export function SabbathCueLogo({
  className,
  wordmarkClassName,
  size = "md",
  showWordmark = false,
}: {
  className?: string;
  wordmarkClassName?: string;
  size?: keyof typeof HEIGHT_CLASS;
  /** Full logo image already includes the wordmark; enable for compact text-only layouts. */
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/sabbathcue-logo.png"
        alt={APP_DISPLAY_NAME}
        width={1280}
        height={1024}
        className={cn("w-auto object-contain", HEIGHT_CLASS[size])}
      />
      {showWordmark ? (
        <span className={cn("font-medium text-foreground text-lg", wordmarkClassName)}>
          {APP_DISPLAY_NAME}
        </span>
      ) : null}
    </span>
  );
}
