import * as React from "react";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { cn } from "@/lib/classnames";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/* A list this long gets a search box; a shorter one reads at a glance. */
const SEARCH_FROM = 9;

interface IComboboxOption {
  readonly value: string;
  readonly label: string;
  /* A shorter label for the open list, such as a model without its maker under the maker's heading. */
  readonly listLabel?: string;
  /* Options sharing a group sit under its heading, in the order they first appear. */
  readonly group?: string;
  /* A quiet note on the right, such as a spec or a count. */
  readonly hint?: string;
  /* More words the search matches, beyond the label and group. */
  readonly keywords?: readonly string[];
}

interface IComboboxProps {
  readonly options: readonly IComboboxOption[];
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly id?: string;
  readonly name?: string;
  /* Shown when no option holds the value. */
  readonly placeholder?: string;
  /* An icon or a short muted label inside the field, before the value. */
  readonly leading?: React.ReactNode;
  /* "sm" sits in toolbars beside small buttons. */
  readonly size?: "sm" | "default";
  readonly searchPlaceholder?: string;
  readonly emptyText?: string;
  /* Search on or off; by default only a long list gets it. */
  readonly searchable?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly onBlur?: () => void;
  readonly "aria-label"?: string;
  readonly "aria-invalid"?: boolean;
  readonly "aria-describedby"?: string;
  readonly "data-testid"?: string;
}

interface IGroup {
  readonly heading: string | undefined;
  readonly options: IComboboxOption[];
}

function groupsOf(options: readonly IComboboxOption[]): IGroup[] {
  const groups: IGroup[] = [];

  for (const option of options) {
    const last = groups.at(-1);

    if (last !== undefined && last.heading === option.group) {
      last.options.push(option);
    } else {
      groups.push({ heading: option.group, options: [option] });
    }
  }

  return groups;
}

/*
 * A picker for one value from a list of any length: a field-styled button
 * that opens a panel placed to fit the screen (flipping above when there
 * is no room below), with search on long lists, group headings that stay
 * in view, and full keyboard control.
 */
const Combobox = React.forwardRef<HTMLButtonElement, IComboboxProps>(
  function Combobox(
    {
      options,
      value,
      onValueChange,
      id,
      name,
      placeholder,
      leading,
      size = "default",
      searchPlaceholder,
      emptyText,
      searchable,
      disabled = false,
      className,
      contentClassName,
      onBlur,
      ...aria
    },
    ref
  ) {
    const [open, setOpen] = React.useState(false);
    const listId = React.useId();
    const commandRef = React.useRef<HTMLDivElement>(null);
    const selected = options.find((option) => option.value === value);
    const hasSearch = searchable ?? options.length >= SEARCH_FROM;
    const groups = groupsOf(options);

    const pick = (next: string) => {
      setOpen(false);

      if (next !== value) {
        onValueChange(next);
      }
    };

    const renderedGroups = groups.map((group, index) => {
      const items = group.options.map((option) => (
        <CommandItem
          key={option.value}
          /* cmdk matches on this; the value keeps duplicate labels apart. */
          value={`${option.label} ${option.value}`}
          keywords={[
            ...(option.keywords ?? []),
            ...(group.heading === undefined ? [] : [group.heading])
          ]}
          data-option={option.value}
          onSelect={() => {
            pick(option.value);
          }}
        >
          <CheckIcon
            aria-hidden='true'
            className={cn(
              "text-primary size-4",
              option.value === value ? "opacity-100" : "opacity-0"
            )}
          />
          <span className='min-w-0 flex-1 truncate'>
            {option.listLabel ?? option.label}
          </span>
          {option.hint === undefined ? null : (
            <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>
              {option.hint}
            </span>
          )}
        </CommandItem>
      ));

      return (
        <CommandGroup
          key={group.heading ?? `ungrouped-${String(index)}`}
          heading={group.heading}
        >
          {items}
        </CommandGroup>
      );
    });

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            id={id}
            name={name}
            type='button'
            role='combobox'
            aria-expanded={open}
            aria-controls={listId}
            aria-haspopup='listbox'
            disabled={disabled}
            onBlur={onBlur}
            data-slot='combobox-trigger'
            data-value={value}
            {...aria}
            className={cn(
              "border-border-strong/40 bg-panel-strong/60 text-foreground flex h-10 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-xl border py-2 pr-2.5 pl-3 text-left text-base transition-[color,box-shadow,border-color] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              "focus-visible:border-primary/60 focus-visible:ring-primary/20 focus-visible:bg-panel focus-visible:ring-[3px]",
              "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
              "data-[state=open]:border-primary/60",
              size === "sm" && "h-8 rounded-lg py-1 pr-2 pl-2.5 text-sm",
              className
            )}
          >
            {leading === undefined ? null : (
              <span className='text-muted-foreground flex shrink-0 items-center gap-1.5 [&_svg]:size-4'>
                {leading}
              </span>
            )}
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                selected === undefined && "text-muted-foreground"
              )}
            >
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDownIcon
              aria-hidden='true'
              className='text-muted-foreground size-4 shrink-0'
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align='start'
          collisionPadding={12}
          onOpenAutoFocus={(event) => {
            /* With no search box, the list itself takes the keys. */
            if (!hasSearch) {
              event.preventDefault();
              commandRef.current?.focus();
            }
          }}
          className={cn(
            "flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-(--radix-popover-trigger-width) min-w-32 flex-col overflow-hidden p-0 shadow-lg",
            contentClassName
          )}
        >
          <Command
            ref={commandRef}
            tabIndex={-1}
            className='outline-hidden'
            loop
            /* The chosen option is where the keys start. */
            defaultValue={
              selected === undefined
                ? undefined
                : `${selected.label} ${selected.value}`
            }
          >
            {hasSearch ? (
              <CommandInput placeholder={searchPlaceholder} />
            ) : null}
            <CommandList id={listId}>
              <CommandEmpty>{emptyText}</CommandEmpty>
              {renderedGroups}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
);

Combobox.displayName = "Combobox";

export { Combobox };
export type { IComboboxOption, IComboboxProps };
