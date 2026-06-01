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
  private async fetchPrimaryEmail(
    accessToken: string
  ): Promise<{ email: string; verified: boolean }> {
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

    return { email: primary.email, verified: primary.verified };
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

    const directEmail = readString(profile, "email");
    const { email, verified } =
      directEmail !== ""
        ? {
            email: directEmail,
            verified: readBoolean(profile, "email_verified"),
          }
        : await this.fetchPrimaryEmail(accessToken);

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
