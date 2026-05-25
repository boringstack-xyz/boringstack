import type { FC } from "react";
import { NavLink } from "react-router-dom";

import { SquareTerminal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/classnames";

import { useAppSidebar } from "./AppSidebar.hooks";
import type { IAppSidebarProps, ISidebarItemProps } from "./AppSidebar.types";

const SidebarItem: FC<ISidebarItemProps> = ({ item, onNavigate }) => {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      end={item.path === "/dashboard"}
      className='text-muted-foreground hover:bg-secondary/60 hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-foreground flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors'
    >
      <Icon className='h-4 w-4 shrink-0' aria-hidden='true' />
      <span className='truncate'>{item.label}</span>
    </NavLink>
  );
};

SidebarItem.displayName = "SidebarItem";

const AppSidebar: FC<IAppSidebarProps> = (props) => {
  const { t } = useTranslation();
  const { className, onNavigate, ariaLabel, items } = useAppSidebar(props);

  const renderedItems = items.map((item) => (
    <li key={item.id}>
      <SidebarItem item={item} onNavigate={onNavigate} />
    </li>
  ));

  return (
    <nav
      aria-label={ariaLabel}
      data-testid='app-sidebar'
      className={cn(
        "border-border bg-background flex h-full w-64 shrink-0 flex-col border-r",
        className
      )}
    >
      <div className='border-border flex h-16 items-center gap-2.5 border-b px-6'>
        <span
          aria-hidden='true'
          className='bg-primary text-primary-foreground inline-flex h-7 w-7 items-center justify-center rounded-md'
        >
          <SquareTerminal className='h-4 w-4' strokeWidth={2.5} />
        </span>
        <span className='text-foreground text-base font-semibold tracking-tight'>
          {t("app.name")}
        </span>
      </div>

      <ul className='flex flex-1 flex-col gap-1 p-3'>{renderedItems}</ul>
    </nav>
  );
};

AppSidebar.displayName = "AppSidebar";

export default AppSidebar;
export { AppSidebar };
