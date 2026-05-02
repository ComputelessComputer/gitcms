import { describe, expect, it } from "vitest";

import type { AuthIdentity } from "../../src/auth/adapter";
import { EnvMembersProvider, parseMembersSpec } from "../../src/auth/members";

function identity(overrides: Partial<AuthIdentity>): AuthIdentity {
  return {
    subject: "github:johnjeong",
    login: "johnjeong",
    email: null,
    name: null,
    avatarUrl: null,
    ...overrides,
  };
}

describe("parseMembersSpec", () => {
  it("parses a comma-separated list with explicit roles", () => {
    const map = parseMembersSpec("johnjeong:admin,john@fastrepl.com:admin");
    expect(map.get("johnjeong")).toEqual({ identifier: "johnjeong", role: "admin" });
    expect(map.get("john@fastrepl.com")).toEqual({
      identifier: "john@fastrepl.com",
      role: "admin",
    });
  });

  it("defaults to admin when role is omitted (back-compat with GITCMS_ADMIN_LOGINS)", () => {
    const map = parseMembersSpec("johnjeong, alice");
    expect(map.get("johnjeong")?.role).toBe("admin");
    expect(map.get("alice")?.role).toBe("admin");
  });

  it("lowercases identifiers for case-insensitive lookup", () => {
    const map = parseMembersSpec("JohnJeong:admin");
    expect(map.has("johnjeong")).toBe(true);
    expect(map.has("JohnJeong")).toBe(false);
  });

  it("treats trailing :unknown-role tokens as part of the identifier (not a role)", () => {
    // Allows JWT subjects like `jwt:user_abc` to be valid identifiers without
    // requiring users to escape the colon. Only `:admin` is recognized as a
    // role suffix in v0.1.
    const map = parseMembersSpec(",,foo:viewer,bar:admin,");
    expect(map.size).toBe(2);
    expect(map.get("bar")?.role).toBe("admin");
    expect(map.get("foo:viewer")?.role).toBe("admin");
  });
});

describe("EnvMembersProvider.resolve", () => {
  it("matches identity.login first (GitHub mode)", async () => {
    const provider = new EnvMembersProvider("johnjeong:admin");
    expect(await provider.resolve(identity({ login: "JohnJeong" }))).toEqual({
      identifier: "johnjeong",
      role: "admin",
    });
  });

  it("falls back to email when login does not match (JWT mode)", async () => {
    const provider = new EnvMembersProvider("john@fastrepl.com:admin");
    expect(
      await provider.resolve(
        identity({ login: null, email: "JOHN@fastrepl.com" }),
      ),
    ).toEqual({ identifier: "john@fastrepl.com", role: "admin" });
  });

  it("falls back to subject when login and email do not match", async () => {
    const provider = new EnvMembersProvider("jwt:user_abc:admin");
    expect(
      await provider.resolve(identity({ subject: "jwt:user_abc", login: null })),
    ).toEqual({ identifier: "jwt:user_abc", role: "admin" });
  });

  it("returns null when the user is not in the allowlist", async () => {
    const provider = new EnvMembersProvider("alice:admin");
    expect(await provider.resolve(identity({ login: "bob" }))).toBeNull();
  });

  it("returns null when the allowlist is empty (no GITCMS_MEMBERS configured)", async () => {
    const provider = new EnvMembersProvider("");
    expect(await provider.resolve(identity({ login: "anyone" }))).toBeNull();
  });
});
