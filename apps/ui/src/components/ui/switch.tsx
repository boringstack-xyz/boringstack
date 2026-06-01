"use client";

import * as React from "react";

import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/classnames";

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot='switch'
      data-size={size}
      className={cn(
        "peer group/switch focus-visible:ring-primary/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary-strong/50 data-[state=unchecked]:bg-panel-strong data-[state=unchecked]:border-border-strong/40 inline-flex shrink-0 items-center rounded-full border transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot='switch-thumb'
        className={cn(
          "data-[state=checked]:bg-primary-ink data-[state=unchecked]:bg-foreground pointer-events-none block rounded-full ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
