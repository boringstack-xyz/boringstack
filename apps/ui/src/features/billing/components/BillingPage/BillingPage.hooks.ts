import { useCallback, useEffect, useMemo, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ROLE } from "@/lib/acl/acl.types";
import { CAPABILITIES_QUERY_KEY } from "@/lib/api/queries/capabilities.constants";
import { useCapabilities } from "@/lib/api/queries/useCapabilities";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger/logger";
import { SESSION_QUERY_KEYS, useMe } from "@/lib/session";

import {
  BILLING_PATH,
  CHECKOUT_POLL_INTERVAL_MS,
  CHECKOUT_POLL_TIMEOUT_MS
} from "../../Billing.constants";
import { useBillingCheckout, useBillingPortal } from "../../Billing.mutations";
import { useBillingPlans, useBillingSubscription } from "../../Billing.queries";
import type {
  IBillingInterval,
  IBillingPlan,
  IBillingSubscription
} from "../../Billing.types";
import type {
  IBillingIntervalOption,
  IBillingPageView,
  IBillingPlanRowProps,
  ICheckoutOutcome
} from "./BillingPage.types";

/*
 * After Stripe returns the browser with `?checkout=success`, the plan change
 * arrives by webhook and can lag behind the redirect. Poll the subscription
 * until it reports a paid plan, or give up and offer a manual re-check.
 */
function billingBaseUrl(): string {
  return env.VITE_PUBLIC_URL.replace(/\/$/, "");
}

function readCheckoutParam(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("checkout");
  } catch {
    return null;
  }
}

function readInitialCheckoutOutcome(): ICheckoutOutcome {
  const value = readCheckoutParam();

  if (value === "success") {
    return "polling";
  }

  if (value === "cancel") {
    return "cancelled";
  }

  return "idle";
}

/*
 * Removes only the `checkout` param and keeps the rest of the URL and the
 * router's history state, so a reload does not repeat the confirmation.
 */
function stripCheckoutParam(): void {
  try {
    const url = new URL(window.location.href);

    if (!url.searchParams.has("checkout")) {
      return;
    }

    url.searchParams.delete("checkout");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  } catch {
    // The param stays in the URL; the outcome already shown is still correct.
  }
}

/** A plan offers a Monthly/Yearly choice only when it has more than one interval. */
export function planOffersIntervalChoice(plan: IBillingPlan): boolean {
  return plan.purchasableIntervals.length > 1;
}

/*
 * The interval to send with checkout. Undefined for single-interval plans,
 * so the request carries no `interval` field at all.
 */
export function checkoutIntervalFor(
  plan: IBillingPlan | undefined,
  selected: IBillingInterval
): IBillingInterval | undefined {
  if (plan === undefined || !planOffersIntervalChoice(plan)) {
    return undefined;
  }

  return selected;
}

export function isPaidSubscription(
  subscription: IBillingSubscription | undefined
): boolean {
  return subscription?.hasStripeSubscription === true;
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

function checkoutMessageFor(
  outcome: ICheckoutOutcome,
  t: (key: string) => string
): string | null {
  if (outcome === "polling") {
    return t("billing.checkout.pending");
  }

  if (outcome === "confirmed") {
    return t("billing.checkout.confirmed");
  }

  if (outcome === "timed_out") {
    return t("billing.checkout.timeout");
  }

  if (outcome === "cancelled") {
    return t("billing.checkout.cancelled");
  }

  return null;
}

/*
 * Reconciles the Stripe return. Polling runs only while the outcome is
 * "polling" and billing queries are enabled; it stops on confirmation or
 * after the timeout.
 */
function useCheckoutReconciliation(
  subscription: IBillingSubscription | undefined,
  refetchSubscription: () => unknown,
  billingQueriesEnabled: boolean
): {
  readonly outcome: ICheckoutOutcome;
  readonly retry: () => void;
} {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<ICheckoutOutcome>(
    readInitialCheckoutOutcome
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (outcome === "cancelled") {
      stripCheckoutParam();
    }
  }, [outcome]);

  useEffect(() => {
    if (outcome !== "polling" || !isPaidSubscription(subscription)) {
      return;
    }

    setOutcome("confirmed");
    stripCheckoutParam();
    void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEYS.me });
    void queryClient.invalidateQueries({ queryKey: CAPABILITIES_QUERY_KEY });
  }, [outcome, queryClient, subscription]);

  useEffect(() => {
    if (outcome !== "polling" || !billingQueriesEnabled) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void refetchSubscription();
    }, CHECKOUT_POLL_INTERVAL_MS);
    const timeout = window.setTimeout(() => {
      setOutcome("timed_out");
    }, CHECKOUT_POLL_TIMEOUT_MS);

    return (): void => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [outcome, attempt, billingQueriesEnabled, refetchSubscription]);

  const retry = useCallback((): void => {
    setOutcome("polling");
    setAttempt((current) => current + 1);
    void refetchSubscription();
  }, [refetchSubscription]);

  return { outcome, retry };
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
  const [selectedInterval, setSelectedInterval] =
    useState<IBillingInterval>("month");

  const subscription = subscriptionQuery.data;
  const hasActiveSubscription = subscription?.hasStripeSubscription === true;
  const reconciliation = useCheckoutReconciliation(
    subscription,
    subscriptionQuery.refetch,
    billingQueriesEnabled
  );
  const currentPlanId = subscription === undefined ? null : subscription.planId;
  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);

  const currentPlanName = useMemo(() => {
    if (subscription?.planName !== undefined) {
      return subscription.planName;
    }

    return t("billing.currentPlan.free");
  }, [subscription?.planName, t]);

  const showIntervalChoice = plans.some(planOffersIntervalChoice);
  const selectMonthly = useCallback((): void => {
    setSelectedInterval("month");
  }, []);
  const selectYearly = useCallback((): void => {
    setSelectedInterval("year");
  }, []);
  const intervalOptions = useMemo<IBillingIntervalOption[]>(
    () => [
      {
        value: "month",
        label: t("billing.interval.monthly"),
        isSelected: selectedInterval === "month",
        onSelect: selectMonthly
      },
      {
        value: "year",
        label: t("billing.interval.yearly"),
        isSelected: selectedInterval === "year",
        onSelect: selectYearly
      }
    ],
    [selectedInterval, selectMonthly, selectYearly, t]
  );

  const onUpgrade = useCallback(
    (planId: number): void => {
      setUpgradingPlanId(planId);
      const base = billingBaseUrl();
      const interval = checkoutIntervalFor(
        plans.find((plan) => plan.id === planId),
        selectedInterval
      );

      checkout.mutate(
        {
          planId,
          ...(interval === undefined ? {} : { interval }),
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
    [checkout, plans, selectedInterval, t]
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
    isManaging: portal.isPending,
    showIntervalChoice,
    intervalGroupLabel: t("billing.interval.label"),
    intervalOptions,
    checkoutOutcome: reconciliation.outcome,
    checkoutMessage: checkoutMessageFor(reconciliation.outcome, t),
    checkoutRetryLabel: t("billing.checkout.retry"),
    onRetryConfirmation: reconciliation.retry
  };
}
