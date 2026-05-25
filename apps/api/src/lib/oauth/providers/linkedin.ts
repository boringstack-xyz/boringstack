import { LinkedIn } from "arctic";
import { ApiErrors } from "../../errors";
import { DEFAULT_OAUTH_SCOPES } from "../oauth.manifest";
import type {
  IOAuthCredentials,
  IOAuthProfile,
  IOAuthProviderModule,
} from "../oauth.types";
import { fetchJson, readBoolean, readString } from "../oauth.utils";

/*
 * "Sign In with LinkedIn using OpenID Connect" — same userinfo shape as
 * any OIDC provider (sub / email / given_name / family_name).
 * https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
 */
class LinkedinProvider implements IOAuthProviderModule {
  private static readonly userinfoUrl = "https://api.linkedin.com/v2/userinfo";

  public readonly defaultScopes = [...DEFAULT_OAUTH_SCOPES.linkedin];

  private buildClient(creds: IOAuthCredentials): LinkedIn {
    return new LinkedIn(creds.clientId, creds.clientSecret, creds.redirectURI);
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
    const raw = await fetchJson(LinkedinProvider.userinfoUrl, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
        "user-agent": "boringstack-api",
      },
    });
    const sub = readString(raw, "sub");
    const email = readString(raw, "email");

    if (sub === "" || email === "") {
      throw ApiErrors.externalService("LinkedIn userinfo missing sub or email");
    }

    return {
      providerUserId: sub,
      email,
      emailVerified: readBoolean(raw, "email_verified"),
      firstName: readString(raw, "given_name"),
      lastName: readString(raw, "family_name"),
    };
  }
}

export const linkedinProvider = new LinkedinProvider();
