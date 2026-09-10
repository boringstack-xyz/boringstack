import { GitHub } from "arctic";
import { ApiErrors } from "../../errors";
import { DEFAULT_OAUTH_SCOPES } from "../oauth.manifest";
import type {
  IOAuthCredentials,
  IOAuthProfile,
  IOAuthProviderModule,
} from "../oauth.types";
import {
  fetchJson,
  isRecord,
  readBoolean,
  readString,
  splitDisplayName,
} from "../oauth.utils";

class GithubProvider implements IOAuthProviderModule {
  private static readonly userinfoUrl = "https://api.github.com/user";
  private static readonly emailsUrl = "https://api.github.com/user/emails";

  public readonly defaultScopes = [...DEFAULT_OAUTH_SCOPES.github];

  private buildClient(creds: IOAuthCredentials): GitHub {
    return new GitHub(creds.clientId, creds.clientSecret, creds.redirectURI);
  }

  private headers(accessToken: string): HeadersInit {
    return {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
      "user-agent": "boringstack-api",
    };
  }

  private isPrimaryEmail(
    entry: unknown
  ): entry is { email: string; primary: boolean; verified: boolean } {
    return (
      isRecord(entry) &&
      typeof entry.email === "string" &&
      entry.primary === true &&
      typeof entry.verified === "boolean"
    );
  }

  /**
   * GitHub's `/user.email` is `null` when the user has a private email.
   * `/user/emails` (granted by the `user:email` scope) always exposes the
   * primary one + its verification status.
   */
  private async fetchPrimaryEmail(accessToken: string): Promise<{
    email: string;
    verified: boolean;
    all: readonly unknown[];
  }> {
    const emails = await fetchJson(GithubProvider.emailsUrl, {
      headers: this.headers(accessToken),
    });

    if (!Array.isArray(emails)) {
      throw ApiErrors.externalService(
        "Unexpected /user/emails response from GitHub"
      );
    }

    const primary = emails.find((entry) => this.isPrimaryEmail(entry));

    if (!primary) {
      throw ApiErrors.externalService("GitHub account has no primary email");
    }

    return {
      email: primary.email,
      verified: primary.verified,
      all: emails,
    };
  }

  /**
   * Whether `address` appears in the account's verified email list.
   *
   * A public profile email need not be the primary one, and the primary
   * entry's `verified` flag says nothing about a different address.
   */
  private isVerifiedAddress(address: string, all: readonly unknown[]): boolean {
    return all.some(
      (entry) =>
        isRecord(entry) &&
        readString(entry, "email").toLowerCase() === address.toLowerCase() &&
        readBoolean(entry, "verified")
    );
  }

  private extractProviderUserId(profile: unknown): string {
    if (!isRecord(profile) || !("id" in profile)) {
      return "";
    }

    const value = profile.id;

    if (typeof value === "number") {
      return String(value);
    }

    if (typeof value === "string") {
      return value;
    }

    return "";
  }

  buildAuthorizationURL(
    creds: IOAuthCredentials,
    state: string,
    scopes: string[]
  ): { url: URL } {
    return {
      url: this.buildClient(creds).createAuthorizationURL(state, scopes),
    };
  }

  async exchangeCode(
    creds: IOAuthCredentials,
    code: string
  ): Promise<{ accessToken: string }> {
    const tokens =
      await this.buildClient(creds).validateAuthorizationCode(code);

    return { accessToken: tokens.accessToken() };
  }

  async fetchProfile(accessToken: string): Promise<IOAuthProfile> {
    const profile = await fetchJson(GithubProvider.userinfoUrl, {
      headers: this.headers(accessToken),
    });

    const providerUserId = this.extractProviderUserId(profile);

    if (providerUserId === "") {
      throw ApiErrors.externalService("GitHub /user response missing id");
    }

    /*
     * Verification always comes from `/user/emails`, whether or not the
     * profile exposes a public email.
     *
     * GitHub's `/user` response carries no `email_verified` field at all,
     * so reading one from it yields `false` for every user with a public
     * profile email, and those signups are then refused as unverified.
     * `/user/emails` is the documented source of verification state.
     * https://docs.github.com/en/rest/users/emails
     *
     * The public email still wins as the ADDRESS when present, so the
     * identity a user sees does not change; only its verification is
     * resolved properly.
     */
    const directEmail = readString(profile, "email");
    const primary = await this.fetchPrimaryEmail(accessToken);
    const email = directEmail !== "" ? directEmail : primary.email;
    const verified =
      directEmail === "" || directEmail === primary.email
        ? primary.verified
        : this.isVerifiedAddress(directEmail, primary.all);

    const { firstName, lastName } = splitDisplayName(
      readString(profile, "name")
    );

    return {
      providerUserId,
      email,
      emailVerified: verified,
      firstName,
      lastName,
    };
  }
}

export const githubProvider = new GithubProvider();
