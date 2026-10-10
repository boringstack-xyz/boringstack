import type { FC } from "react";

import { AppPage } from "@/components/core/AppPage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useBillingPage, useBillingPlanRow } from "./BillingPage.hooks";
import type {
  IBillingPageProps,
  IBillingPageView,
  IBillingPlanRowProps
} from "./BillingPage.types";

const BillingPlanRowSkeleton: FC = () => (
  <div className='border-border bg-panel flex flex-col gap-3 rounded-xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between'>
    <div className='flex flex-col gap-2'>
      <Skeleton className='h-5 w-32' />
      <Skeleton className='h-3 w-24' />
    </div>
    <Skeleton className='h-9 w-28' />
  </div>
);

BillingPlanRowSkeleton.displayName = "BillingPlanRowSkeleton";

const BillingPageSkeleton: FC<{ readonly loadingLabel: string }> = ({
  loadingLabel
}) => (
  <div className='flex flex-col gap-6' role='status' aria-label={loadingLabel}>
    <article className='border-border-strong/40 bg-panel flex flex-col gap-3 rounded-2xl border p-6'>
      <Skeleton className='h-3 w-32' />
      <Skeleton className='h-7 w-48' />
      <Skeleton className='mt-2 h-9 w-40' />
    </article>
    <section className='flex flex-col gap-3'>
      <Skeleton className='h-5 w-40' />
      <div className='flex flex-col gap-3'>
        <BillingPlanRowSkeleton />
        <BillingPlanRowSkeleton />
      </div>
    </section>
  </div>
);

BillingPageSkeleton.displayName = "BillingPageSkeleton";

const BillingPlanRow: FC<IBillingPlanRowProps> = ({ plan, view }) => {
  const { isCurrent, isUpgrading, onUpgradeClick } = useBillingPlanRow(
    plan,
    view
  );

  return (
    <article
      data-current={isCurrent}
      className='border-border bg-panel data-[current=true]:border-primary/50 data-[current=true]:bg-primary-low/20 flex flex-col gap-3 rounded-xl border px-4 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between'
    >
      <div className='flex flex-col gap-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <h3 className='text-foreground text-base font-semibold'>
            {plan.name}
          </h3>
          {plan.isDefault ? (
            <span className='bg-panel-strong text-muted-foreground border-border-strong/40 rounded-md border px-2 py-0.5 text-xs font-medium'>
              {view.defaultBadge}
            </span>
          ) : null}
          {isCurrent ? (
            <span className='bg-primary-low text-primary-strong border-primary/30 rounded-md border px-2 py-0.5 text-xs font-bold tracking-wide uppercase'>
              {view.currentBadge}
            </span>
          ) : null}
        </div>
      </div>
      {!isCurrent ? (
        <Button
          type='button'
          className='w-fit'
          disabled={isUpgrading}
          aria-busy={isUpgrading}
          onClick={onUpgradeClick}
        >
          {isUpgrading ? view.upgradingLabel : view.upgradeLabel}
        </Button>
      ) : null}
    </article>
  );
};

BillingPlanRow.displayName = "BillingPlanRow";

const BillingIntervalChoice: FC<{
  readonly label: string;
  readonly options: IBillingPageView["intervalOptions"];
}> = ({ label, options }) => {
  const renderedOptions = options.map((option) => (
    <Button
      key={option.value}
      type='button'
      size='sm'
      variant={option.isSelected ? "default" : "outline"}
      aria-pressed={option.isSelected}
      onClick={option.onSelect}
    >
      {option.label}
    </Button>
  ));

  return (
    <div role='group' aria-label={label} className='flex flex-wrap gap-2'>
      {renderedOptions}
    </div>
  );
};

BillingIntervalChoice.displayName = "BillingIntervalChoice";

const BillingPage: FC<IBillingPageProps> = () => {
  const view = useBillingPage();

  const renderedPlans = view.plans.map((plan) => (
    <BillingPlanRow key={plan.id} plan={plan} view={view} />
  ));

  return (
    <AppPage
      pageTitle={view.pageTitle}
      title={view.pageTitle}
      subtitle={view.pageSubtitle}
    >
      {view.checkoutMessage !== null ? (
        <div
          role={view.checkoutOutcome === "timed_out" ? "alert" : "status"}
          aria-live='polite'
          className='border-border bg-panel mb-6 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between'
        >
          <p className='text-foreground text-sm'>{view.checkoutMessage}</p>
          {view.checkoutOutcome === "timed_out" ? (
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='w-fit'
              onClick={view.onRetryConfirmation}
            >
              {view.checkoutRetryLabel}
            </Button>
          ) : null}
        </div>
      ) : null}

      {view.state === "disabled" ? (
        <p className='text-muted-foreground text-sm'>{view.disabledMessage}</p>
      ) : null}

      {view.state === "not_owner" ? (
        <p className='text-muted-foreground text-sm'>{view.notOwnerMessage}</p>
      ) : null}

      {view.state === "loading" ? (
        <BillingPageSkeleton loadingLabel={view.loadingLabel} />
      ) : null}

      {view.state === "error" ? (
        <p className='text-muted-foreground text-sm' role='alert'>
          {view.errorMessage}
        </p>
      ) : null}

      {view.state === "ready" ? (
        <div className='flex flex-col gap-6'>
          <article className='border-border-strong/40 bg-panel flex flex-col gap-2 rounded-2xl border p-6'>
            <span className='text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase'>
              {view.currentPlanLabel}
            </span>
            <h2 className='text-foreground text-2xl font-bold tracking-tight'>
              {view.currentPlanName}
            </h2>
            {view.hasActiveSubscription ? (
              <Button
                type='button'
                variant='outline'
                className='mt-2 w-fit'
                disabled={view.isManaging}
                aria-busy={view.isManaging}
                onClick={view.onManage}
              >
                {view.isManaging ? view.managingLabel : view.manageLabel}
              </Button>
            ) : null}
          </article>

          <section className='flex flex-col gap-3'>
            <h2 className='text-foreground text-lg font-semibold tracking-tight'>
              {view.plansHeading}
            </h2>
            {view.showIntervalChoice ? (
              <BillingIntervalChoice
                label={view.intervalGroupLabel}
                options={view.intervalOptions}
              />
            ) : null}
            {renderedPlans}
          </section>
        </div>
      ) : null}
    </AppPage>
  );
};

BillingPage.displayName = "BillingPage";

export default BillingPage;
export { BillingPage };
