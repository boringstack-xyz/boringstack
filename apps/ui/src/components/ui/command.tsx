import * as React from "react";

import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";

import { cn } from "@/lib/classnames";

/*
 * A filterable list you drive with the keyboard (cmdk): the search box
 * narrows it as you type, arrows move, Enter picks. Styled to the panel.
 */
function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot='command'
      className={cn(
        "text-popover-foreground flex h-full w-full flex-col overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      data-slot='command-input-wrapper'
      className='border-border flex h-11 shrink-0 items-center gap-2 border-b px-3'
    >
      <SearchIcon
        aria-hidden='true'
        className='text-muted-foreground size-4 shrink-0'
      />
      <CommandPrimitive.Input
        data-slot='command-input'
        className={cn(
          "placeholder:text-muted-foreground flex h-10 w-full bg-transparent text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot='command-list'
      className={cn(
        "min-h-0 flex-1 scroll-py-1 overflow-x-hidden overflow-y-auto overscroll-contain p-1",
        className
      )}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot='command-empty'
      className={cn(
        "text-muted-foreground px-3 py-6 text-center text-sm",
        className
      )}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot='command-group'
      className={cn(
        "[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:bg-panel [&_[cmdk-group-heading]]:sticky [&_[cmdk-group-heading]]:-top-1 [&_[cmdk-group-heading]]:z-10 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:uppercase",
        className
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot='command-separator'
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot='command-item'
      className={cn(
        "data-[selected=true]:bg-primary/12 data-[selected=true]:text-foreground relative flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandSeparator,
  CommandItem
};
