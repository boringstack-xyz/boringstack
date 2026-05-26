import type { FC } from "react";
import { Link } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { cn } from "@/lib/classnames";

import { Button } from "@/components/ui/button";

import { useDashboardActionItems } from "./DashboardActionItems.hooks";
import type { IDashboardActionItemsProps } from "./DashboardActionItems.types";

const DashboardActionItems: FC<IDashboardActionItemsProps> = (props) => {
  const { t } = useTranslation();
  const { className, items } = useDashboardActionItems(props);

  if (items.length === 0) {
    return null;
  }

  const renderedItems = items.map((item) => (
    <li
      key={item.id}
      className='border-border bg-panel-strong hover:border-border-strong/60 flex flex-col gap-3 rounded-xl border p-5 transition-colors'
    >
      <div className='flex flex-col gap-1'>
        <h3 className='text-foreground text-base font-semibold tracking-tight'>
          {item.title}
        </h3>
        <p className='text-muted-foreground text-sm'>{item.body}</p>
      </div>
      <div>
        <Button asChild size='sm' variant='outline'>
          <Link to={item.href}>{item.ctaLabel}</Link>
        </Button>
      </div>
    </li>
  ));

  return (
    <article
      data-testid='dashboard-action-items'
      className={cn("border-border bg-panel rounded-2xl border p-6", className)}
    >
      <header className='mb-4 flex flex-col gap-1'>
        <span className='text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase'>
          {t("dashboard.actions.eyebrow")}
        </span>
        <h2 className='text-foreground text-lg font-semibold tracking-tight'>
          {t("dashboard.actions.title")}
        </h2>
      </header>
      <ul className='grid gap-3 sm:grid-cols-2'>{renderedItems}</ul>
    </article>
  );
};

DashboardActionItems.displayName = "DashboardActionItems";

export default DashboardActionItems;
export { DashboardActionItems };
