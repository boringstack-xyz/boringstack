import type { FC } from "react";

import { useTranslation } from "react-i18next";

import { cn } from "@/lib/classnames";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useActivityFeed } from "./ActivityFeed.hooks";
import type { IActivityFeedProps } from "./ActivityFeed.types";

const ActivityFeed: FC<IActivityFeedProps> = (props) => {
  const { t } = useTranslation();
  const {
    className,
    items,
    isLoading,
    isError,
    isEmpty,
    hasNextPage,
    isFetchingNextPage,
    onLoadMore
  } = useActivityFeed(props);

  const renderedItems = items.map((item) => (
    <li
      key={item.id}
      className='border-border flex items-baseline justify-between gap-4 border-b py-3 last:border-b-0'
    >
      <span className='text-foreground text-sm'>{item.title}</span>
      <time
        dateTime={item.timestamp}
        className='text-muted-foreground shrink-0 font-mono text-xs'
      >
        {new Date(item.timestamp).toLocaleDateString()}
      </time>
    </li>
  ));

  const renderedSkeleton = (
    <ul className='flex flex-col'>
      <li className='border-border flex items-baseline justify-between gap-4 border-b py-3'>
        <Skeleton className='h-4 w-48' />
        <Skeleton className='h-3 w-20' />
      </li>
      <li className='border-border flex items-baseline justify-between gap-4 border-b py-3'>
        <Skeleton className='h-4 w-64' />
        <Skeleton className='h-3 w-20' />
      </li>
      <li className='flex items-baseline justify-between gap-4 py-3'>
        <Skeleton className='h-4 w-40' />
        <Skeleton className='h-3 w-20' />
      </li>
    </ul>
  );

  return (
    <article
      data-testid='activity-feed'
      className={cn(
        "border-border bg-background flex flex-col gap-4 rounded-2xl border p-6",
        className
      )}
    >
      <header className='flex flex-col gap-1'>
        <span className='text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase'>
          {t("dashboard.activity.eyebrow")}
        </span>
        <h2 className='text-foreground text-lg font-semibold tracking-tight'>
          {t("dashboard.activity.title")}
        </h2>
      </header>

      {isLoading ? renderedSkeleton : null}

      {isError ? (
        <p role='alert' className='text-destructive text-sm'>
          {t("dashboard.activity.error")}
        </p>
      ) : null}

      {isEmpty && !isError ? (
        <p className='text-muted-foreground text-sm'>
          {t("dashboard.activity.empty")}
        </p>
      ) : null}

      {!isLoading && !isError && items.length > 0 ? (
        <ul className='flex flex-col'>{renderedItems}</ul>
      ) : null}

      {hasNextPage ? (
        <div className='flex justify-center pt-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage
              ? t("dashboard.activity.loadingMore")
              : t("dashboard.activity.loadMore")}
          </Button>
        </div>
      ) : null}
    </article>
  );
};

ActivityFeed.displayName = "ActivityFeed";

export default ActivityFeed;
export { ActivityFeed };
