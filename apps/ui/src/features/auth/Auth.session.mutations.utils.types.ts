/**
 * Discriminator types for the `/auth/login` response. Two envelopes
 * arrive on the same path — `{ user }` after a non-MFA login, or
 * `{ mfaRequired, challengeToken }` when the user has TOTP enabled.
 */
export interface IMfaRequiredEnvelope {
  mfaRequired: true;
  challengeToken: string;
}

export interface ILoginUserEnvelope {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
  };
}
