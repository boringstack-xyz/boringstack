import type { FC } from "react";

import { cn } from "@/lib/classnames";

import { Button } from "@/components/ui/button";

import { useQueryErrorState } from "./QueryErrorState.hooks";
import type { IQueryErrorStateProps } from "./QueryErrorState.types";

/*
 * Inline error for a failed list query, with a retry action. Lists use this
 * instead of a bare message so a transient failure can be recovered without
 * reloading the page.
 */
const QueryErrorState: FC<IQueryErrorStateProps> = (props) => {
  const { message, retryLabel, className } = props;
  const { isRetrying, handleRetry } = useQueryErrorState(props);

  return (
    <div
      role='alert'
      className={cn("flex flex-col items-start gap-3 px-4 py-6", className)}
    >
      <p className='text-destructive text-sm'>{message}</p>
      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={handleRetry}
        disabled={isRetrying}
        aria-busy={isRetrying}
      >
        {retryLabel}
      </Button>
    </div>
  );
};

QueryErrorState.displayName = "QueryErrorState";

export default QueryErrorState;
export { QueryErrorState };
