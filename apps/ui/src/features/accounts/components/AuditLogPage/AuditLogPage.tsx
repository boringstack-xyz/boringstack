import type { FC } from "react";

import { AppPage } from "@/components/core/AppPage";
import { Skeleton } from "@/components/ui/skeleton";

import type { IAuditLogEntry } from "../../AuditLog.types";
import { formatAction, formatActor } from "../../AuditLog.utils";
import { useAuditLogPage } from "./AuditLogPage.hooks";
import type { IAuditLogPageProps } from "./AuditLogPage.types";

const AuditLogRowSkeleton: FC = () => (
  <div className='border-border bg-panel flex flex-col gap-3 rounded-xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between'>
    <div className='flex flex-col gap-2'>
      <Skeleton className='h-4 w-48' />
      <Skeleton className='h-3 w-32' />
    </div>
    <Skeleton className='h-3 w-24' />
  </div>
);

AuditLogRowSkeleton.displayName = "AuditLogRowSkeleton";

const AuditLogRow: FC<{
  readonly entry: IAuditLogEntry;
  readonly systemFallback: string;
}> = ({ entry, systemFallback }) => (
  <div
    data-testid='audit-log-row'
    className='border-border bg-panel flex flex-col gap-3 rounded-xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between'
  >
    <div className='flex flex-col gap-1'>
      <p className='text-foreground text-sm font-semibold'>
        {formatAction(entry.action)}
      </p>
      <p className='text-muted-foreground text-xs'>
        {formatActor(entry, systemFallback)}
        {entry.resource !== null ? (
          <>
            <span aria-hidden='true' className='mx-1'>
              ·
            </span>
            <code className='font-mono'>{entry.resource}</code>
          </>
        ) : null}
      </p>
    </div>
    <time
      dateTime={entry.createdAt}
      className='text-muted-foreground text-xs whitespace-nowrap'
    >
      {entry.createdAt}
    </time>
  </div>
);

AuditLogRow.displayName = "AuditLogRow";

const AuditLogPage: FC<IAuditLogPageProps> = () => {
  const view = useAuditLogPage();
  const renderedRows = view.entries.map((entry) => (
    <AuditLogRow
      key={entry.id}
      entry={entry}
      systemFallback={view.systemFallback}
    />
  ));

  return (
    <AppPage
      pageTitle={view.pageTitle}
      title={view.pageTitle}
      subtitle={view.pageSubtitle}
    >
      {view.isPending ? (
        <div
          className='flex flex-col gap-3'
          role='status'
          aria-label={view.loadingLabel}
        >
          <AuditLogRowSkeleton />
          <AuditLogRowSkeleton />
          <AuditLogRowSkeleton />
          <AuditLogRowSkeleton />
          <AuditLogRowSkeleton />
        </div>
      ) : null}

      {view.isError ? (
        <p className='text-destructive text-sm' role='alert'>
          {view.errorMessage}
        </p>
      ) : null}

      {view.isSuccess && view.entries.length === 0 ? (
        <p className='text-muted-foreground text-sm'>{view.emptyMessage}</p>
      ) : null}

      {view.isSuccess && view.entries.length > 0 ? (
        <div className='flex flex-col gap-3'>{renderedRows}</div>
      ) : null}
    </AppPage>
  );
};

AuditLogPage.displayName = "AuditLogPage";

export default AuditLogPage;
export { AuditLogPage };
