import type { FC } from "react";

import { cn } from "@/lib/classnames";

import { Button } from "@/components/ui/button";

import { useWebPushCard } from "./WebPushCard.hooks";
import type { IWebPushCardProps } from "./WebPushCard.types";

const WebPushCard: FC<IWebPushCardProps> = ({ className }) => {
  const view = useWebPushCard();

  return (
    <article
      data-testid='web-push-card'
      className={cn(
        "border-border bg-background flex flex-col gap-4 rounded-2xl border p-6",
        className
      )}
    >
      <header className='flex flex-col gap-1'>
        <h2 className='text-foreground text-lg font-semibold tracking-tight'>
          {view.title}
        </h2>
        <p className='text-muted-foreground text-sm'>{view.body}</p>
      </header>
      <p className='text-foreground text-sm'>{view.stateLabel}</p>
      {view.canAct ? (
        <Button
          type='button'
          size='lg'
          variant='outline'
          onClick={view.onAction}
          disabled={view.isPending}
          className='w-fit'
        >
          {view.buttonLabel}
        </Button>
      ) : null}
    </article>
  );
};

WebPushCard.displayName = "WebPushCard";

export default WebPushCard;
export { WebPushCard };
