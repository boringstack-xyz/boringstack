import * as React from "react";

import { type VariantProps, cva } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/classnames";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-ink [a&]:hover:bg-primary-strong",
        secondary:
          "bg-primary-low text-primary-strong border-primary/30 [a&]:hover:bg-primary-low/80",
        destructive:
          "bg-destructive text-white focus-visible:ring-destructive/20 [a&]:hover:bg-destructive/90",
        outline:
          "border-border-strong text-foreground [a&]:hover:bg-primary-low [a&]:hover:text-primary-strong",
        ghost: "[a&]:hover:bg-primary-low [a&]:hover:text-primary-strong",
        link: "text-primary underline-offset-4 [a&]:hover:underline"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot='badge'
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
