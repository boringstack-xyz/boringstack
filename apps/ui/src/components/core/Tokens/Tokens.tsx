import type { FC } from "react";

import { cn } from "@/lib/classnames";

import {
  TOKENS_DESCRIPTION,
  TOKENS_EYEBROW,
  TOKENS_TITLE
} from "./Tokens.constants";
import { useTokens } from "./Tokens.hooks";
import type { ITokenGroup, ITokenSwatch, ITokensProps } from "./Tokens.types";

const Swatch: FC<{ readonly swatch: ITokenSwatch }> = ({ swatch }) => (
  <div
    data-testid='tokens-swatch'
    data-swatch={swatch.name}
    className='border-border-strong/40 bg-panel-strong flex items-center gap-3 rounded-xl border p-3'
  >
    <span
      aria-hidden='true'
      className={cn(
        "border-border-strong/40 inline-block size-10 shrink-0 rounded-md border",
        swatch.style
      )}
    />
    <div className='flex min-w-0 flex-col'>
      <span className='text-foreground truncate font-mono text-xs font-semibold'>
        {swatch.name}
      </span>
      <span className='text-muted-foreground truncate font-mono text-[10px]'>
        {swatch.var}
      </span>
    </div>
  </div>
);

Swatch.displayName = "Swatch";

const Group: FC<{ readonly group: ITokenGroup }> = ({ group }) => {
  const renderedSwatches = group.swatches.map((swatch) => (
    <Swatch key={swatch.name} swatch={swatch} />
  ));

  return (
    <section
      data-testid='tokens-group'
      data-group={group.id}
      className='flex flex-col gap-3'
    >
      <h3 className='text-primary text-xs font-bold tracking-[0.18em] uppercase'>
        {group.title}
      </h3>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {renderedSwatches}
      </div>
    </section>
  );
};

Group.displayName = "Group";

const Tokens: FC<ITokensProps> = ({ className }) => {
  const view = useTokens();
  const renderedGroups = view.groups.map((group) => (
    <Group key={group.id} group={group} />
  ));

  return (
    <div
      data-testid='tokens'
      className={cn("flex flex-col gap-8 p-8", className)}
    >
      <header className='flex flex-col gap-2'>
        <span className='text-primary text-xs font-bold tracking-[0.18em] uppercase'>
          {TOKENS_EYEBROW}
        </span>
        <h2 className='text-foreground text-3xl font-bold tracking-tight'>
          {TOKENS_TITLE}
        </h2>
        <p className='text-muted-foreground max-w-2xl text-sm'>
          {TOKENS_DESCRIPTION}
        </p>
      </header>

      <div className='flex flex-col gap-8'>{renderedGroups}</div>
    </div>
  );
};

Tokens.displayName = "Tokens";

export default Tokens;
export { Tokens };
