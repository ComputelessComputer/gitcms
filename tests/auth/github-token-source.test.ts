import { describe, expect, it } from "vitest";

import type { AuthIdentity } from "../../src/auth/adapter";
import {
  OAuthTokenSource,
  ServiceTokenSource,
} from "../../src/auth/github-token-source";

const baseIdentity: AuthIdentity = {
  subject: "github:johnjeong",
  login: "johnjeong",
  email: null,
  name: null,
  avatarUrl: null,
};

describe("OAuthTokenSource", () => {
  it("returns the token stored in identity metadata", async () => {
    const source = new OAuthTokenSource();
    const identity: AuthIdentity = {
      ...baseIdentity,
      metadata: { accessToken: "ghp_test_token" },
    };
    expect(await source.getToken(identity)).toBe("ghp_test_token");
  });

  it("throws when no access token is present (e.g. JWT mode misconfig)", async () => {
    const source = new OAuthTokenSource();
    await expect(source.getToken(baseIdentity)).rejects.toThrow(
      /does not produce a GitHub access token/,
    );
  });

  it("throws when metadata.accessToken is not a string", async () => {
    const source = new OAuthTokenSource();
    const identity: AuthIdentity = {
      ...baseIdentity,
      metadata: { accessToken: 12345 as unknown as string },
    };
    await expect(source.getToken(identity)).rejects.toThrow(
      /does not produce a GitHub access token/,
    );
  });
});

describe("ServiceTokenSource", () => {
  it("returns the configured fixed token regardless of identity", async () => {
    const source = new ServiceTokenSource("ghp_service_token");
    expect(await source.getToken(baseIdentity)).toBe("ghp_service_token");

    const otherIdentity: AuthIdentity = {
      ...baseIdentity,
      subject: "jwt:user_xyz",
      login: null,
      email: "alice@example.com",
    };
    expect(await source.getToken(otherIdentity)).toBe("ghp_service_token");
  });

  it("throws at construction when no token is provided and env is unset", () => {
    expect(() => new ServiceTokenSource("")).toThrow(
      /requires GITCMS_GITHUB_SERVICE_TOKEN/,
    );
  });
});
