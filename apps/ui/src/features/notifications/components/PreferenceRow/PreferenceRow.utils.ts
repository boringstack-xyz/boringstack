/**
 * The translation key that names a notification event on the preferences
 * page, or null for an event this UI does not know yet (shown as its code).
 */
export function eventLabelKey(eventType: string): string | null {
  switch (eventType) {
    case "auth.welcome":
      return "notifications.preferences.events.authWelcome";
    case "auth.password_reset_completed":
      return "notifications.preferences.events.passwordResetCompleted";
    case "account.invitation_accepted":
      return "notifications.preferences.events.invitationAccepted";
    case "account.ownership_transferred":
      return "notifications.preferences.events.ownershipTransferred";
    case "lifecycle.welcome-follow-up":
      return "notifications.preferences.events.welcomeFollowUp";
    default:
      return null;
  }
}
