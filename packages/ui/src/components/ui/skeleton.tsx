// Adapted from Raypx UI at b6f4ca1e72b7a8f7ccd5962f75ce32f2d5dd7738.
// Based on shadcn/ui base-nova. See NOTICE.md for source and licenses.
import type { ComponentProps } from "react";
import { cn } from "#lib/utils";

function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse motion-reduce:animate-none rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
