import * as React from "react";

import { SearchIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/classnames";

import { Input } from "./input";

/*
 * A search field: the magnifier inside, and a clear button once there is
 * something to clear. `onClear` is called with the field emptied.
 */
function SearchInput({
  className,
  wrapperClassName,
  value,
  onClear,
  clearLabel,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & {
  readonly wrapperClassName?: string;
  readonly onClear?: () => void;
  /* Translated by the caller; read out on the clear button. */
  readonly clearLabel: string;
}) {
  const hasText = typeof value === "string" && value !== "";

  return (
    <div
      data-slot='search-input'
      className={cn("relative w-full min-w-0", wrapperClassName)}
    >
      <SearchIcon
        aria-hidden='true'
        className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2'
      />
      <Input
        type='search'
        value={value}
        className={cn(
          "pl-9 [&::-webkit-search-cancel-button]:hidden",
          onClear !== undefined && "pr-9",
          className
        )}
        {...props}
      />
      {onClear !== undefined && hasText ? (
        <button
          type='button'
          onClick={onClear}
          aria-label={clearLabel}
          className='text-muted-foreground hover:text-foreground focus-visible:ring-primary/30 absolute top-1/2 right-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md outline-none focus-visible:ring-2'
        >
          <XIcon aria-hidden='true' className='size-4' />
        </button>
      ) : null}
    </div>
  );
}

export { SearchInput };
