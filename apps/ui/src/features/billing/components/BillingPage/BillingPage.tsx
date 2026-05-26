import type { FC } from "react";

import { AppPage } from "@/components/core/AppPage";
import { Button } from "@/components/ui/button";

import { useBillingPage, useBillingPlanRow } from "./BillingPage.hooks";
import type {
  IBillingPageProps,
  IBillingPlanRowProps
} from "./BillingPage.types";

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
      {view.state === "disabled" ? (
        <p className='text-muted-foreground text-sm'>{view.disabledMessage}</p>
      ) : null}

      {view.state === "not_owner" ? (
        <p className='text-muted-foreground text-sm'>{view.notOwnerMessage}</p>
      ) : null}

      {view.state === "loading" ? (
        <p className='text-muted-foreground text-sm' role='status'>
          {view.loadingLabel}
        </p>
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
