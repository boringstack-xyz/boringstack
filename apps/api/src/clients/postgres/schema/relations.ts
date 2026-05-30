import { relations } from "drizzle-orm";

import {
  accountFeatureOverrides,
  accountInvitations,
  accountJoinRequests,
  accountOwnershipTransfers,
  accounts,
} from "./app.schema";
import { auditLog } from "./audit.schema";
import {
  authSessions,
  emailVerificationTokens,
  mfaRecoveryCodes,
  passwordResetTokens,
  userAuthProviders,
  users,
} from "./auth.schema";
import { accountPlans, planFeatures, plans } from "./billing.schema";
import { accountMemberships } from "./memberships.schema";
import {
  notification,
  notificationDelivery,
  notificationPreference,
  pushSubscription,
} from "./notifications.schema";

export const usersRelations = relations(users, ({ many }) => ({
  authProviders: many(userAuthProviders),
  authSessions: many(authSessions),
  emailVerificationTokens: many(emailVerificationTokens),
  passwordResetTokens: many(passwordResetTokens),
  memberships: many(accountMemberships),
  notifications: many(notification),
  notificationPreferences: many(notificationPreference),
  pushSubscriptions: many(pushSubscription),
}));

export const accountsRelations = relations(accounts, ({ many }) => ({
  memberships: many(accountMemberships),
  invitations: many(accountInvitations),
  joinRequests: many(accountJoinRequests),
  ownershipTransfers: many(accountOwnershipTransfers),
  featureOverrides: many(accountFeatureOverrides),
  plans: many(accountPlans),
}));

export const accountOwnershipTransfersRelations = relations(
  accountOwnershipTransfers,
  ({ one }) => ({
    account: one(accounts, {
      fields: [accountOwnershipTransfers.accountId],
      references: [accounts.id],
    }),
    fromUser: one(users, {
      fields: [accountOwnershipTransfers.fromUserId],
      references: [users.id],
    }),
    toUser: one(users, {
      fields: [accountOwnershipTransfers.toUserId],
      references: [users.id],
    }),
  })
);

export const accountJoinRequestsRelations = relations(
  accountJoinRequests,
  ({ one }) => ({
    account: one(accounts, {
      fields: [accountJoinRequests.accountId],
      references: [accounts.id],
    }),
    user: one(users, {
      fields: [accountJoinRequests.userId],
      references: [users.id],
    }),
  })
);

export const accountMembershipsRelations = relations(
  accountMemberships,
  ({ one }) => ({
    account: one(accounts, {
      fields: [accountMemberships.accountId],
      references: [accounts.id],
    }),
    user: one(users, {
      fields: [accountMemberships.userId],
      references: [users.id],
    }),
  })
);

export const accountInvitationsRelations = relations(
  accountInvitations,
  ({ one }) => ({
    account: one(accounts, {
      fields: [accountInvitations.accountId],
      references: [accounts.id],
    }),
  })
);

export const accountFeatureOverridesRelations = relations(
  accountFeatureOverrides,
  ({ one }) => ({
    account: one(accounts, {
      fields: [accountFeatureOverrides.accountId],
      references: [accounts.id],
    }),
  })
);

export const accountPlansRelations = relations(accountPlans, ({ one }) => ({
  account: one(accounts, {
    fields: [accountPlans.accountId],
    references: [accounts.id],
  }),
  plan: one(plans, {
    fields: [accountPlans.planId],
    references: [plans.id],
  }),
}));

export const userAuthProvidersRelations = relations(
  userAuthProviders,
  ({ one }) => ({
    user: one(users, {
      fields: [userAuthProviders.userId],
      references: [users.id],
    }),
  })
);

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, {
    fields: [authSessions.userId],
    references: [users.id],
  }),
}));

export const emailVerificationTokensRelations = relations(
  emailVerificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerificationTokens.userId],
      references: [users.id],
    }),
  })
);

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  })
);

export const mfaRecoveryCodesRelations = relations(
  mfaRecoveryCodes,
  ({ one }) => ({
    user: one(users, {
      fields: [mfaRecoveryCodes.userId],
      references: [users.id],
    }),
  })
);

export const plansRelations = relations(plans, ({ many }) => ({
  accountPlans: many(accountPlans),
  planFeatures: many(planFeatures),
}));

export const planFeaturesRelations = relations(planFeatures, ({ one }) => ({
  plan: one(plans, {
    fields: [planFeatures.planId],
    references: [plans.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}));

export const notificationRelations = relations(
  notification,
  ({ one, many }) => ({
    recipient: one(users, {
      fields: [notification.recipientUserId],
      references: [users.id],
    }),
    deliveries: many(notificationDelivery),
  })
);

export const notificationDeliveryRelations = relations(
  notificationDelivery,
  ({ one }) => ({
    notification: one(notification, {
      fields: [notificationDelivery.notificationId],
      references: [notification.id],
    }),
  })
);

export const notificationPreferenceRelations = relations(
  notificationPreference,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreference.userId],
      references: [users.id],
    }),
  })
);

export const pushSubscriptionRelations = relations(
  pushSubscription,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscription.userId],
      references: [users.id],
    }),
  })
);
