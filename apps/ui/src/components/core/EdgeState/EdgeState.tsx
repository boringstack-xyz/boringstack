import type { FC } from "react";
import { Link } from "react-router-dom";

import { IconBadge } from "@/components/core/IconBadge";
import { Button } from "@/components/ui/button";

import {
  EDGE_STATE_ACTION_TEST_ID,
  EDGE_STATE_SECONDARY_TEST_ID
} from "./EdgeState.constants";
import { useEdgeState } from "./EdgeState.hooks";
import type { IEdgeStateAction, IEdgeStateProps } from "./EdgeState.types";

const EdgeStateButton: FC<{
  readonly action: IEdgeStateAction;
  readonly variant: "default" | "outline";
  readonly testId: string;
}> = ({ action, variant, testId }) => {
  if (action.to !== undefined) {
    return (
      <Button asChild variant={variant} data-testid={testId}>
        <Link to={action.to}>{action.label}</Link>
      </Button>
    );
  }

  return (
    <Button
      type='button'
      variant={variant}
      onClick={action.onClick}
      disabled={action.isDisabled}
      data-testid={testId}
    >
      {action.label}
    </Button>
  );
};

EdgeStateButton.displayName = "EdgeStateButton";

/*
 * The one way the product says "nothing here", "that's gone", "that
 * broke", "can't reach the server" or "working on it": an icon, a sentence
 * that says what happened, and the action that gets the user moving again.
 * Never a bare red line or a lone spinner.
 */
const EdgeState: FC<IEdgeStateProps> = (props) => {
  const { kind, title, body, action, secondaryAction, eyebrow, children } =
    props;
  const view = useEdgeState(props);

  return (
    <section
      data-testid={view.testId}
      data-kind={kind}
      role={view.role}
      aria-busy={view.isBusy}
      className={view.sectionClass}
    >
      <IconBadge icon={view.icon} tone={view.iconTone} />
      <div className='max-w-md'>
        {eyebrow === undefined ? null : (
          <p className='text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase'>
            {eyebrow}
          </p>
        )}
        {props.headingLevel === 1 ? (
          <h1 className={view.titleClass}>{title}</h1>
        ) : (
          <h2 className={view.titleClass}>{title}</h2>
        )}
        {body === undefined ? null : <p className={view.bodyClass}>{body}</p>}
      </div>
      {view.hasActions ? (
        <div className='flex flex-wrap justify-center gap-2'>
          {action === undefined ? null : (
            <EdgeStateButton
              action={action}
              variant='default'
              testId={EDGE_STATE_ACTION_TEST_ID}
            />
          )}
          {secondaryAction === undefined ? null : (
            <EdgeStateButton
              action={secondaryAction}
              variant='outline'
              testId={EDGE_STATE_SECONDARY_TEST_ID}
            />
          )}
        </div>
      ) : null}
      {children}
    </section>
  );
};

EdgeState.displayName = "EdgeState";

export default EdgeState;
export { EdgeState };
