import type { FC } from "react";

import { StatCardSkeleton } from "./StatCardSkeleton";
import type { IStatsSectionProps } from "./StatsSection.types";

const StatsSection: FC<IStatsSectionProps> = ({ isLoading, summary, t }) => {
  if (isLoading) {
    return (
      <div
        role='status'
        aria-live='polite'
        aria-label={t("common.loading")}
        className='grid gap-4'
      >
        <StatCardSkeleton />
      </div>
    );
  }

  if (!summary) {
    return (
      <p className='text-muted-foreground text-sm'>{t("dashboard.empty")}</p>
    );
  }

  return (
    <div className='flex flex-wrap gap-4'>
      <article className='border-border bg-panel flex min-w-[12rem] flex-col gap-3 rounded-2xl border p-6'>
        <span className='text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase'>
          {t("dashboard.stats.events")}
        </span>
        <p className='text-foreground text-3xl leading-none font-bold tracking-tight md:text-4xl'>
          {summary.totalEvents}
        </p>
      </article>
    </div>
  );
};

StatsSection.displayName = "StatsSection";

export { StatsSection };
