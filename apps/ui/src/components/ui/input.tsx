import * as React from "react";

import { cn } from "@/lib/classnames";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot='input'
      className={cn(
        "border-border-strong/40 selection:bg-primary selection:text-primary-ink file:text-foreground placeholder:text-muted-foreground bg-panel-strong/60 h-10 w-full min-w-0 rounded-xl border px-3 py-2 text-base transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-primary/60 focus-visible:ring-primary/20 focus-visible:bg-panel focus-visible:ring-[3px]",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  );
}

export { Input };
