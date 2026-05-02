import { generateKeyPair, SignJWT, exportJWK } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JwtAuthAdapter } from "../../src/auth/jwt-adapter";

// Test keys. Generated once per test file run.
const ISSUER = "https://issuer.test/";
const AUDIENCE = "gitcms-test";

async function setupKeys() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "test-kid";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  return { privateKey, publicJwk };
}

async function signToken(
  privateKey: CryptoKey,
  claims: Record<string, unknown>,
  opts: { issuer?: string; audience?: string } = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
    .setIssuedAt()
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(opts.audience ?? AUDIENCE)
    .setExpirationTime("5m")
    .sign(privateKey);
}

describe("JwtAuthAdapter", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let privateKey: CryptoKey;
  let publicJwk: Awaited<ReturnType<typeof setupKeys>>["publicJwk"];
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    const keys = await setupKeys();
    privateKey = keys.privateKey;
    publicJwk = keys.publicJwk;

    process.env.GITCMS_AUTH_MODE = "jwt";
    process.env.GITCMS_AUTH_JWT_ISSUER = ISSUER;
    process.env.GITCMS_AUTH_JWT_AUDIENCE = AUDIENCE;
    process.env.GITCMS_AUTH_JWT_JWKS_URL = "https://issuer.test/.well-known/jwks.json";
    process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef";

    // Mock the JWKS endpoint that jose's createRemoteJWKSet hits.
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("jwks.json")) {
        return new Response(JSON.stringify({ keys: [publicJwk] }), {
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unmocked fetch: ${url}`);
    }) as typeof globalThis.fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  it("verifies a valid bearer token and maps configured claims", async () => {
    const adapter = new JwtAuthAdapter();
    const token = await signToken(privateKey, {
      sub: "user_abc123",
      email: "john@fastrepl.com",
      name: "John Jeong",
      preferred_username: "johnjeong",
      picture: "https://example.com/avatar.png",
    });

    const request = new Request("https://gitcms.local/api/test", {
      headers: { authorization: `Bearer ${token}` },
    });
    const identity = await adapter.resolveIdentity(request);

    expect(identity).not.toBeNull();
    expect(identity?.subject).toBe("jwt:user_abc123");
    expect(identity?.email).toBe("john@fastrepl.com");
    expect(identity?.name).toBe("John Jeong");
    expect(identity?.login).toBe("johnjeong");
    expect(identity?.avatarUrl).toBe("https://example.com/avatar.png");
  });

  it("returns null when the token is missing", async () => {
    const adapter = new JwtAuthAdapter();
    const request = new Request("https://gitcms.local/api/test");
    expect(await adapter.resolveIdentity(request)).toBeNull();
  });

  it("returns null when the issuer does not match", async () => {
    const adapter = new JwtAuthAdapter();
    const token = await signToken(
      privateKey,
      { sub: "user_x" },
      { issuer: "https://wrong-issuer.test/" },
    );
    const request = new Request("https://gitcms.local/api/test", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await adapter.resolveIdentity(request)).toBeNull();
  });

  it("returns null when the audience does not match", async () => {
    const adapter = new JwtAuthAdapter();
    const token = await signToken(privateKey, { sub: "user_x" }, { audience: "other-app" });
    const request = new Request("https://gitcms.local/api/test", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await adapter.resolveIdentity(request)).toBeNull();
  });

  it("reads the token from a cookie when no Authorization header is present", async () => {
    const adapter = new JwtAuthAdapter();
    const token = await signToken(privateKey, { sub: "user_cookie" });
    const request = new Request("https://gitcms.local/api/test", {
      headers: { cookie: `gitcms_jwt=${token}` },
    });
    const identity = await adapter.resolveIdentity(request);
    expect(identity?.subject).toBe("jwt:user_cookie");
  });

  it("does not support interactive sign-in", async () => {
    const adapter = new JwtAuthAdapter();
    expect(adapter.supportsInteractiveSignIn).toBe(false);
    await expect(adapter.startSignIn()).rejects.toThrow(/does not handle sign-in/);
    await expect(adapter.completeSignIn()).rejects.toThrow(/does not handle sign-in/);
  });
});
