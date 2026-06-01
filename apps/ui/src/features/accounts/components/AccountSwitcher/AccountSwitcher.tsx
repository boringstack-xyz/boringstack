import type { FC } from "react";

import { Check, ChevronsUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/classnames";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

import { useAccountSwitcher } from "./AccountSwitcher.hooks";
import type { IAccountSwitcherProps } from "./AccountSwitcher.types";
import { makeOnSelectHandler } from "./AccountSwitcher.utils";

const AccountSwitcher: FC<IAccountSwitcherProps> = (props) => {
  const { t } = useTranslation();
  const { memberships, activeAccountId, isSwitching, onSelect } =
    useAccountSwitcher();

  if (memberships.length < 2) {
    return null;
  }

  const active = memberships.find((m) => m.accountId === activeAccountId);
  const triggerLabel = active?.accountName ?? "";
  const handlerFor = makeOnSelectHandler(onSelect);

  const renderedItems = memberships.map((membership) => (
    <DropdownMenuItem
      key={membership.accountId}
      onSelect={handlerFor(membership.accountId)}
      data-testid='account-switcher-item'
      className='py-2'
    >
      <span className='flex-1 truncate'>{membership.accountName}</span>
      <span className='text-primary mx-2 text-xs font-bold tracking-[0.18em] uppercase'>
        {membership.role}
      </span>
      {membership.accountId === activeAccountId ? (
        <Check className='size-4 shrink-0' />
      ) : null}
    </DropdownMenuItem>
  ));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          aria-label={t("accounts.switcher.ariaLabel")}
          disabled={isSwitching}
          aria-busy={isSwitching}
          className={cn(
            "h-10 max-w-[14rem] justify-between rounded-xl px-3",
            props.className
          )}
          data-testid='account-switcher-trigger'
        >
          <span className='truncate'>{triggerLabel}</span>
          <ChevronsUpDown className='ml-2 size-4 shrink-0 opacity-60' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-64'>
        <DropdownMenuLabel>
          {t("accounts.switcher.ariaLabel")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {renderedItems}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

AccountSwitcher.displayName = "AccountSwitcher";

export default AccountSwitcher;
export { AccountSwitcher };
