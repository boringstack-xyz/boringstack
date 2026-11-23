import * as React from "react";

import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/classnames";

/* Work under way, inline: in a button, a status line or a row. */
function Spinner({
  className,
  label,
  ...props
}: React.ComponentProps<"svg"> & {
  /* Read out when the spinner is the only sign of the work. */
  readonly label?: string;
}) {
  return (
    <LoaderCircle
      data-slot='spinner'
      role={label === undefined ? undefined : "status"}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      className={cn(
        "text-muted-foreground size-4 shrink-0 motion-safe:animate-spin",
        className
      )}
      {...props}
    />
  );
}

export { Spinner };
