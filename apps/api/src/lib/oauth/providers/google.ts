import { generateCodeVerifier, Google } from "arctic";
import { ApiErrors } from "../../errors";
import { DEFAULT_OAUTH_SCOPES } from "../oauth.manifest";
import type {
  IOAuthCredentials,
  IOAuthProfile,
  IOAuthProviderModule,
} from "../oauth.types";
import { fetchJson, readBoolean, readString } from "../oauth.utils";

class GoogleProvider implements IOAuthProviderModule {
  private static readonly userinfoUrl =
    "https://openidconnect.googleapis.com/v1/userinfo";

  public readonly defaultScopes = [...DEFAULT_OAUTH_SCOPES.google];

  private buildClient(creds: IOAuthCredentials): Google {
    return new Google(creds.clientId, creds.clientSecret, creds.redirectURI);
  }

  buildAuthorizationURL(
    creds: IOAuthCredentials,
    state: string,
    scopes: string[]
  ): { url: URL; codeVerifier: string } {
    const codeVerifier = generateCodeVerifier();
    const url = this.buildClient(creds).createAuthorizationURL(
      state,
      codeVerifier,
      scopes
    );

    return { url, codeVerifier };
  }

  async exchangeCode(
    creds: IOAuthCredentials,
    code: string,
    codeVerifier: string | undefined
  ): Promise<{ accessToken: string }> {
    if (codeVerifier === undefined) {
      throw ApiErrors.internal(
        "Missing PKCE code_verifier for Google callback"
      );
    }

    const tokens = await this.buildClient(creds).validateAuthorizationCode(
      code,
      codeVerifier
    );

    return { accessToken: tokens.accessToken() };
  }

  async fetchProfile(accessToken: string): Promise<IOAuthProfile> {
    const raw = await fetchJson(GoogleProvider.userinfoUrl, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
        "user-agent": "api-template",
      },
    });

    const sub = readString(raw, "sub");
    const email = readString(raw, "email");

    if (sub === "" || email === "") {
      throw ApiErrors.externalService("Google userinfo missing sub or email");
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

export const googleProvider = new GoogleProvider();
