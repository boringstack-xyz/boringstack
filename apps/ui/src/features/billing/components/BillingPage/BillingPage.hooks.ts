import { useCallback, useMemo, useState } from "react";

import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ROLE } from "@/lib/acl/acl.types";
import { useCapabilities } from "@/lib/api/queries/useCapabilities";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger/logger";

import { useMe } from "@/features/auth/Auth.queries";

import { BILLING_PATH } from "../../Billing.constants";
import { useBillingCheckout, useBillingPortal } from "../../Billing.mutations";
import { useBillingPlans, useBillingSubscription } from "../../Billing.queries";
import type { IBillingPlan } from "../../Billing.types";
import type {
  IBillingPageView,
  IBillingPlanRowProps
} from "./BillingPage.types";

function billingBaseUrl(): string {
  return env.VITE_PUBLIC_URL.replace(/\/$/, "");
}

export function isCurrentBillingPlan(
  plan: IBillingPlan,
  currentPlanId: number | null
): boolean {
  if (currentPlanId === null) {
    return false;
  }

  return plan.id === currentPlanId;
}

export function useBillingPlanRow(
  plan: IBillingPlanRowProps["plan"],
  view: IBillingPlanRowProps["view"]
): {
  readonly isCurrent: boolean;
  readonly isUpgrading: boolean;
  readonly onUpgradeClick: () => void;
} {
  const isCurrent = isCurrentBillingPlan(plan, view.currentPlanId);
  const isUpgrading = view.upgradingPlanId === plan.id;
  const onUpgrade = view.onUpgrade;

  const onUpgradeClick = useCallback((): void => {
    onUpgrade(plan.id);
  }, [onUpgrade, plan.id]);

  return { isCurrent, isUpgrading, onUpgradeClick };
}

export function useBillingPage(): IBillingPageView {
  const { t } = useTranslation();
  const me = useMe();
  const capabilities = useCapabilities();
  const billingEnabled = capabilities.data?.features.billing.enabled === true;
  const isOwner = me.data?.role === ROLE.owner;
  const billingQueriesEnabled = billingEnabled && isOwner;
  const plansQuery = useBillingPlans(billingQueriesEnabled);
  const subscriptionQuery = useBillingSubscription(billingQueriesEnabled);
  const checkout = useBillingCheckout();
  const portal = useBillingPortal();
  const [upgradingPlanId, setUpgradingPlanId] = useState<number | null>(null);

  const subscription = subscriptionQuery.data;
  const hasActiveSubscription = subscription?.hasStripeSubscription === true;
  const currentPlanId = subscription === undefined ? null : subscription.planId;
  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);

  const currentPlanName = useMemo(() => {
    if (subscription?.planName !== undefined) {
      return subscription.planName;
    }

    return t("billing.currentPlan.free");
  }, [subscription?.planName, t]);

  const onUpgrade = useCallback(
    (planId: number): void => {
      setUpgradingPlanId(planId);
      const base = billingBaseUrl();

      checkout.mutate(
        {
          planId,
          successUrl: `${base}${BILLING_PATH}?checkout=success`,
          cancelUrl: `${base}${BILLING_PATH}?checkout=cancel`
        },
        {
          onSuccess: (url) => {
            window.location.assign(url);
          },
          onError: () => {
            toast.error(t("billing.checkoutError"));
            logger.warn({ event: "billing.checkout_failed", planId });
          },
          onSettled: () => {
            setUpgradingPlanId(null);
          }
        }
      );
    },
    [checkout, t]
  );

  const onManage = useCallback((): void => {
    const base = billingBaseUrl();

    portal.mutate(
      { returnUrl: `${base}${BILLING_PATH}` },
      {
        onSuccess: (url) => {
          window.location.assign(url);
        },
        onError: () => {
          toast.error(t("billing.portalError"));
          logger.warn({ event: "billing.portal_failed" });
        }
      }
    );
  }, [portal, t]);

  let state: IBillingPageView["state"] = "ready";

  if (!billingEnabled) {
    state = "disabled";
  } else if (!isOwner) {
    state = "not_owner";
  } else if (plansQuery.isPending || subscriptionQuery.isPending) {
    state = "loading";
  } else if (plansQuery.isError || subscriptionQuery.isError) {
    state = "error";
  }

  return {
    pageTitle: t("billing.pageTitle"),
    pageSubtitle: t("billing.pageSubtitle"),
    state,
    disabledMessage: t("billing.disabled"),
    notOwnerMessage: t("billing.notOwner"),
    errorMessage: t("billing.loadError"),
    currentPlanLabel: t("billing.currentPlan.label"),
    currentPlanName,
    plansHeading: t("billing.plansHeading"),
    manageLabel: t("billing.manage"),
    managingLabel: t("billing.managing"),
    upgradeLabel: t("billing.upgrade"),
    upgradingLabel: t("billing.upgrading"),
    loadingLabel: t("billing.loading"),
    defaultBadge: t("billing.badges.default"),
    currentBadge: t("billing.badges.current"),
    plans,
    currentPlanId,
    hasActiveSubscription,
    isOwner,
    onUpgrade,
    onManage,
    upgradingPlanId,
    isManaging: portal.isPending
  };
}
